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
  const logDir = app.isPackaged ? app.getPath('userData') : __dirname;
  return path.join(logDir, 'electron_app.log');
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

  // Check if local installation folder (e.g. C:\ams) is writable
  const exeDir = path.dirname(process.execPath);
  const localDataDir = path.join(exeDir, 'data');
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    const testFile = path.join(localDataDir, '.test_write');
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    logMessage('Using local installation directory for data storage:', exeDir);
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

  // If local DB doesn't exist yet, check if there is an existing DB in AppData or bundled template
  if (!fs.existsSync(targetDb)) {
    try {
      const appDataDb = path.join(app.getPath('userData'), 'data', 'ams.db');
      if (fs.existsSync(appDataDb)) {
        fs.copyFileSync(appDataDb, targetDb);
        logMessage('Migrated existing database from AppData to local data directory:', targetDb);
      } else {
        const rootDb = path.join(__dirname, '../ams.db');
        if (fs.existsSync(rootDb)) {
          fs.copyFileSync(rootDb, targetDb);
          logMessage('Copied initial database template from root to:', targetDb);
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

  if (isDev) {
    logMessage('Loading development URL:', DEV_URL);
    mainWindow.loadURL(DEV_URL).catch((err) => {
      logMessage('Failed to load dev server URL:', err);
    });
  } else {
    const prodServerUrl = `http://127.0.0.1:${PORT}`;
    const localDistPath = path.join(__dirname, '../client/dist/index.html');

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

app.whenReady().then(async () => {
  logMessage('Electron app ready. isDev:', isDev);
  if (!isDev) {
    await startBackendServer();
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
