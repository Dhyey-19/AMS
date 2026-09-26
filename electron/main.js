const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let serverInstance = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const PORT = process.env.PORT || 5050;
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

function getLogFile() {
  try {
    const baseDir = app.isPackaged 
      ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath)) 
      : __dirname;
    const logPath = path.join(baseDir, 'electron_app.log');
    return logPath;
  } catch (e) {
    return path.join(app.getPath('userData'), 'electron_app.log');
  }
}

function logMessage(...args) {
  const msg = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  try {
    fs.appendFileSync(getLogFile(), msg, 'utf8');
  } catch (e) {}
  console.log(...args);
}

// Ensure single instance of the application
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getAppStorageDirectory() {
  if (!app.isPackaged) {
    return path.resolve(__dirname, '..');
  }

  // Check if local installation folder or portable exe folder is writable
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  const localDataDir = path.join(exeDir, 'data');
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    const testFile = path.join(localDataDir, '.test_write');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    logMessage('Using local directory for data storage:', exeDir);
    return exeDir;
  } catch (err) {
    // If not writable (e.g. restricted permissions), fallback to AppData
    const userData = app.getPath('userData');
    logMessage('Local exe directory not writable, falling back to userData:', userData);
    return userData;
  }
}

function initAppDataDirectory() {
  const baseDir = getAppStorageDirectory();
  const dataDir = path.join(baseDir, 'data');
  const uploadsDir = path.join(baseDir, 'uploads');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const targetDb = path.join(dataDir, 'ams.db');
  const rootDb = path.join(baseDir, 'ams.db');

  const copyCleanDb = (src, dest) => {
    fs.copyFileSync(src, dest);
    const walFile = `${dest}-wal`;
    const shmFile = `${dest}-shm`;
    if (fs.existsSync(walFile)) {
      try { fs.unlinkSync(walFile); } catch (_) {}
    }
    if (fs.existsSync(shmFile)) {
      try { fs.unlinkSync(shmFile); } catch (_) {}
    }
  };

  // If local DB doesn't exist yet in data/ams.db (or is empty), copy from source
  if (!fs.existsSync(targetDb) || fs.statSync(targetDb).size === 0) {
    try {
      if (fs.existsSync(rootDb) && fs.statSync(rootDb).size > 0) {
        copyCleanDb(rootDb, targetDb);
        logMessage('Found ams.db in application root, copied to data directory:', targetDb);
      } else {
        const appDataDb = path.join(app.getPath('userData'), 'data', 'ams.db');
        if (fs.existsSync(appDataDb) && fs.statSync(appDataDb).size > 0) {
          copyCleanDb(appDataDb, targetDb);
          logMessage('Migrated existing database from AppData to local data directory:', targetDb);
        } else {
          const bundledDb = path.join(__dirname, '../ams.db');
          if (fs.existsSync(bundledDb) && fs.statSync(bundledDb).size > 0) {
            copyCleanDb(bundledDb, targetDb);
            logMessage('Copied initial database template from root to:', targetDb);
          }
        }
      }
    } catch (e) {
      logMessage('Could not copy initial database:', e.message);
    }
  }

  process.env.AMS_DATA_DIR = dataDir;
  process.env.DATA_DIR = dataDir;
  process.env.UPLOADS_DIR = uploadsDir;
  process.env.UPLOAD_DIR = uploadsDir;
  process.env.TEMP_UPLOAD_DIR = uploadsDir;
  process.env.DB_PATH = targetDb;

  logMessage('Initialized app data directory at:', dataDir);
  logMessage('Database path set to:', targetDb);
}

async function startBackendServer() {
  try {
    process.env.AUTO_OPEN = 'false';
    process.env.PORT = String(PORT);
    process.env.IS_ELECTRON = 'true';

    // Initialize database directory before loading server
    initAppDataDirectory();

    const serverPath = path.join(__dirname, '../server/src/server.js');
    logMessage('Loading server module from:', serverPath);
    const serverModule = require(serverPath);
    if (typeof serverModule.startServer === 'function') {
      serverInstance = serverModule.startServer(PORT);
      logMessage(`Backend server started on http://127.0.0.1:${PORT}`);
    }
  } catch (err) {
    logMessage('Error starting backend server inside Electron:', err.stack || err);
  }
}

function waitForServer(url, timeout = 6000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', () => retry());
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeout) {
        resolve(false);
      } else {
        setTimeout(check, 200);
      }
    };

    check();
  });
}

function getAppVersionInfo() {
  try {
    const vPath = path.join(__dirname, '../server/src/version.json');
    if (fs.existsSync(vPath)) {
      return JSON.parse(fs.readFileSync(vPath, 'utf8'));
    }
  } catch (e) {}
  return { version: app.getVersion(), display: `v${app.getVersion()}` };
}

function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const vInfo = getAppVersionInfo();
  const winTitle = `Global IVF Hospital - Attendance Management System (${vInfo.display || 'v' + app.getVersion()})`;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: winTitle,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Fallback if ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.maximize();
      mainWindow.show();
    }
  }, 3000);

  const localDistPath = path.join(__dirname, '../client/dist/index.html');
  const prodServerUrl = `http://127.0.0.1:${PORT}`;

  if (isDev) {
    waitForServer(DEV_URL, 1200).then((devReady) => {
      if (devReady) {
        logMessage('Loading development URL:', DEV_URL);
        mainWindow.loadURL(DEV_URL).catch((err) => {
          logMessage('Failed to load dev server URL:', err);
        });
      } else {
        logMessage('Dev server on port 3000 not responding, fallback to local backend/dist');
        waitForServer(`${prodServerUrl}/api/health`, 4000).then((serverReady) => {
          if (serverReady) {
            mainWindow.loadURL(prodServerUrl);
          } else if (fs.existsSync(localDistPath)) {
            mainWindow.loadFile(localDistPath);
          } else {
            mainWindow.loadURL(DEV_URL);
          }
        });
      }
    });
  } else {
    waitForServer(`${prodServerUrl}/api/health`, 5000).then((isReady) => {
      logMessage('Server health check result:', isReady);
      if (isReady) {
        mainWindow.loadURL(prodServerUrl);
      } else if (fs.existsSync(localDistPath)) {
        mainWindow.loadFile(localDistPath);
      } else {
        mainWindow.loadURL(prodServerUrl);
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  const vInfo = getAppVersionInfo();
  return vInfo.version || app.getVersion();
});
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('download-pdf', async (event, { html, defaultFilename }) => {
  let printWin = null;
  try {
    const { dialog } = require('electron');
    printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const pdfBuffer = await printWin.webContents.printToPDF({
      landscape: true,
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.1, bottom: 0.1, left: 0.1, right: 0.1 }
    });

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Attendance Statement as PDF',
      defaultPath: defaultFilename || 'Employee_Attendance_Statement.pdf',
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, pdfBuffer);
      logMessage('PDF exported successfully to:', filePath);
      return { success: true, filePath };
    }
    return { success: false, canceled: true };
  } catch (err) {
    logMessage('Error exporting PDF in Electron:', err.message);
    return { success: false, error: err.message };
  } finally {
    if (printWin) {
      try { printWin.close(); } catch (_) {}
    }
  }
});

app.whenReady().then(async () => {
  logMessage('Electron app ready. isDev:', isDev);
  const backendHealthy = await waitForServer(`http://127.0.0.1:${PORT}/api/health`, 800);
  if (!backendHealthy) {
    logMessage('Backend server not detected, starting server inside Electron...');
    await startBackendServer();
  } else {
    logMessage(`Backend server is already running on port ${PORT}`);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverInstance && typeof serverInstance.close === 'function') {
    try {
      serverInstance.close();
      logMessage('Backend server instance closed.');
    } catch (e) {
      logMessage('Error closing server:', e);
    }
  }
});
