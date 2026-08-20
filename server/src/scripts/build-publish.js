const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const esbuild = require('esbuild');
const { syncVersions, getVersionInfo } = require('../../../scripts/sync-version');

const ROOT_DIR = path.resolve(__dirname, '../../../');
const PUBLISH_DIR = path.join(ROOT_DIR, 'publish');
const CLIENT_DIST_DIR = path.join(ROOT_DIR, 'client/dist');
const LAUNCHER_DIR = path.join(__dirname, '../launcher');

function findCsc() {
  const possiblePaths = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework64\\v3.5\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v3.5\\csc.exe'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return 'csc.exe';
}

function ensureAmsIco(filePath) {
  if (fs.existsSync(filePath)) return;
  const width = 32;
  const height = 32;
  const bihSize = 40;
  const xorSize = width * height * 4;
  const andSize = Math.ceil(width / 32) * 4 * height; // 128 bytes
  const imageSize = bihSize + xorSize + andSize;

  const buffer = Buffer.alloc(6 + 16 + imageSize);
  let offset = 0;

  // ICONDIR
  buffer.writeUInt16LE(0, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;

  // ICONDIRENTRY
  buffer.writeUInt8(width, offset); offset += 1;
  buffer.writeUInt8(height, offset); offset += 1;
  buffer.writeUInt8(0, offset); offset += 1;
  buffer.writeUInt8(0, offset); offset += 1;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(32, offset); offset += 2;
  buffer.writeUInt32LE(imageSize, offset); offset += 4;
  buffer.writeUInt32LE(6 + 16, offset); offset += 4;

  // BITMAPINFOHEADER
  buffer.writeUInt32LE(bihSize, offset); offset += 4;
  buffer.writeInt32LE(width, offset); offset += 4;
  buffer.writeInt32LE(height * 2, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(32, offset); offset += 2;
  buffer.writeUInt32LE(0, offset); offset += 4;
  buffer.writeUInt32LE(xorSize + andSize, offset); offset += 4;
  buffer.writeInt32LE(0, offset); offset += 4;
  buffer.writeInt32LE(0, offset); offset += 4;
  buffer.writeUInt32LE(0, offset); offset += 4;
  buffer.writeUInt32LE(0, offset); offset += 4;

  // XOR mask (RGBA, bottom-to-top)
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      const isCorner = (dx < 4 && dy < 4 && Math.hypot(4 - dx, 4 - dy) > 4.5);

      let b = 0, g = 0, r = 0, a = 0;
      if (!isCorner) {
        // Teal (#0284c7)
        b = 199; g = 132; r = 2; a = 255;

        // White cross in center
        const inCrossV = (x >= 13 && x <= 18 && y >= 7 && y <= 24);
        const inCrossH = (x >= 7 && x <= 24 && y >= 13 && y <= 18);
        if (inCrossV || inCrossH) {
          b = 255; g = 255; r = 255; a = 255;
        }
      }

      buffer.writeUInt8(b, offset++);
      buffer.writeUInt8(g, offset++);
      buffer.writeUInt8(r, offset++);
      buffer.writeUInt8(a, offset++);
    }
  }

  // AND mask
  for (let i = 0; i < andSize; i++) {
    buffer.writeUInt8(0, offset++);
  }

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  fs.writeFileSync(filePath, buffer);
}

async function buildPublish() {
  const versionInfo = syncVersions();
  console.log('=====================================================');
  console.log(`🚀 Starting Global IVF AMS Standalone Publish Build (${versionInfo.display})`);
  console.log('=====================================================\n');

  // 1. Build React Frontend
  console.log('📦 Step 1: Building optimized React frontend...');
  try {
    execSync('npm --workspace=client run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('✅ Frontend compiled into minified client/dist successfully.\n');
  } catch (err) {
    console.error('❌ Failed to build React frontend:', err);
    process.exit(1);
  }

  // 0. Terminate any running instances from publish folder or port 5050
  try {
    execSync('taskkill /F /IM Global_IVF_AMS.exe', { stdio: 'ignore' });
  } catch (e) {}
  try {
    execSync('cmd /c for /f "tokens=5" %a in (\'netstat -aon ^| findstr ":5050" ^| findstr "LISTENING"\') do taskkill /F /PID %a', { stdio: 'ignore' });
  } catch (e) {}

  await new Promise(resolve => setTimeout(resolve, 600));

  // 2. Prepare publish directory
  console.log('📁 Step 2: Preparing clean publish directory...');
  if (!fs.existsSync(PUBLISH_DIR)) {
    fs.mkdirSync(PUBLISH_DIR, { recursive: true });
  } else {
    // Clean contents inside publish instead of removing root dir to avoid Windows Explorer file locks
    const entries = fs.readdirSync(PUBLISH_DIR);
    for (const entry of entries) {
      const p = path.join(PUBLISH_DIR, entry);
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch (err) {
        // Retry
        try {
          execSync(`rmdir /s /q "${p}"`, { stdio: 'ignore' });
        } catch (e) {}
      }
    }
  }
  fs.mkdirSync(path.join(PUBLISH_DIR, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(PUBLISH_DIR, 'data'), { recursive: true });
  fs.mkdirSync(path.join(PUBLISH_DIR, 'uploads'), { recursive: true });
  console.log('✅ Created publish/ with bin/, data/, and uploads/ directories.\n');

  // 3. Embed Node.js Portable Runtime
  console.log('⚙️ Step 3: Embedding standalone Node.js runtime (Zero Install Required)...');
  const nodeSourcePath = process.execPath;
  const nodeDestPath = path.join(PUBLISH_DIR, 'bin', 'node.exe');
  if (fs.existsSync(nodeSourcePath)) {
    if (fs.existsSync(nodeDestPath) && fs.statSync(nodeSourcePath).size === fs.statSync(nodeDestPath).size) {
      console.log(`✅ Embedded Node runtime already up to date in publish/bin/node.exe (${(fs.statSync(nodeDestPath).size / (1024 * 1024)).toFixed(1)} MB).\n`);
    } else {
      let copied = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          fs.copyFileSync(nodeSourcePath, nodeDestPath);
          copied = true;
          break;
        } catch (err) {
          if (attempt === 3) throw err;
          await new Promise(r => setTimeout(r, 600 * attempt));
        }
      }
      if (copied) {
        console.log(`✅ Embedded Node runtime packaged into publish/bin/node.exe (${(fs.statSync(nodeDestPath).size / (1024 * 1024)).toFixed(1)} MB).\n`);
      }
    }
  } else {
    console.warn('⚠️ Warning: Could not locate local node.exe runtime to bundle.\n');
  }

  // 4. Bundle & Minify Backend with esbuild
  console.log('🔒 Step 4: Bundling & obfuscating backend source code...');
  const serverEntry = path.join(ROOT_DIR, 'server/src/server.js');
  const serverOutput = path.join(PUBLISH_DIR, 'server.bundle.js');

  await esbuild.build({
    entryPoints: [serverEntry],
    bundle: true,
    platform: 'node',
    target: 'node18',
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    outfile: serverOutput,
    external: [
      'better-sqlite3' // Native C++ addon
    ]
  });
  console.log('✅ Backend code securely bundled into publish/server.bundle.js (Zero raw source code).\n');

  // 5. Copy pre-compiled frontend (client/dist -> publish/client_dist)
  console.log('📄 Step 5: Copying minified frontend assets...');
  const targetClientDist = path.join(PUBLISH_DIR, 'client_dist');
  fs.cpSync(CLIENT_DIST_DIR, targetClientDist, { recursive: true });
  console.log('✅ Static frontend assets copied to publish/client_dist.\n');

  // 6. Copy SQLite database into data/ folder
  console.log('💾 Step 6: Setting up database in data/ folder...');
  const dbSrc = path.join(ROOT_DIR, 'ams.db');
  const dbDest = path.join(PUBLISH_DIR, 'data', 'ams.db');
  if (fs.existsSync(dbSrc)) {
    fs.copyFileSync(dbSrc, dbDest);
    console.log('✅ Database copied to publish/data/ams.db.\n');
  } else {
    console.log('ℹ️ ams.db will be auto-created inside data/ folder on first run.\n');
  }

  // 7. Copy native better-sqlite3 module & dependencies
  console.log('🔌 Step 7: Bundling native SQLite binary addon...');
  const targetNodeModules = path.join(PUBLISH_DIR, 'node_modules');
  fs.mkdirSync(targetNodeModules, { recursive: true });

  const modulesToCopy = ['better-sqlite3', 'bindings', 'file-uri-to-path'];
  for (const mod of modulesToCopy) {
    const srcMod = path.join(ROOT_DIR, 'node_modules', mod);
    const destMod = path.join(targetNodeModules, mod);
    if (fs.existsSync(srcMod)) {
      fs.cpSync(srcMod, destMod, { recursive: true });
      console.log(`   - Copied ${mod}`);
    }
  }
  console.log('✅ Native SQLite binaries packaged.\n');

  // 8. Compile Native Windows Launcher EXE (Global_IVF_AMS.exe)
  console.log('⚡ Step 8: Compiling Native Windows Executable (Global_IVF_AMS.exe)...');
  const icoPath = path.join(LAUNCHER_DIR, 'app.ico');
  const launcherCsPath = path.join(LAUNCHER_DIR, 'Launcher.cs');
  ensureAmsIco(icoPath);

  const cscPath = findCsc();
  const exeOutput = path.join(PUBLISH_DIR, 'Global_IVF_AMS.exe');

  try {
    const compileCmd = `"${cscPath}" /target:winexe /win32icon:"${icoPath}" /out:"${exeOutput}" /r:System.Windows.Forms.dll,System.Drawing.dll "${launcherCsPath}"`;
    execSync(compileCmd, { cwd: ROOT_DIR, stdio: 'pipe' });
    console.log('✅ Global_IVF_AMS.exe compiled successfully with embedded icon.\n');
  } catch (err) {
    console.warn('⚠️ Warning: Compiling with icon failed, falling back without icon...');
    try {
      execSync(`"${cscPath}" /target:winexe /out:"${exeOutput}" /r:System.Windows.Forms.dll,System.Drawing.dll "${launcherCsPath}"`, { cwd: ROOT_DIR });
      console.log('✅ Global_IVF_AMS.exe compiled without icon.\n');
    } catch (fallbackErr) {
      console.error('❌ Failed to compile launcher exe:', fallbackErr.message);
    }
  }

  // Copy app.ico to publish folder
  if (fs.existsSync(icoPath)) {
    fs.copyFileSync(icoPath, path.join(PUBLISH_DIR, 'app.ico'));
  }

  // 9. Generate production .env
  console.log('⚙️ Step 9: Generating production configuration...');
  const envContent = `# Global IVF Hospital - Attendance Management System (AMS)
# Production Environment Configuration

NODE_ENV=production
PORT=5050
HOST=0.0.0.0
JWT_SECRET=global_ivf_ams_secure_production_secret_key_2026
DB_PATH=./data/ams.db
CLIENT_DIST_PATH=./client_dist
ADMIN_EMAIL=softechit@gmail.com
EMAIL_USER=softechit@gmail.com
EMAIL_PASS=baaxyfmlzawouieb
`;
  fs.writeFileSync(path.join(PUBLISH_DIR, '.env'), envContent, 'utf-8');

  // 10. Generate minimal package.json
  const prodPkg = {
    name: 'global-ivf-ams-production',
    version: versionInfo.version,
    description: `Global IVF Hospital Attendance Management System - Standalone Distribution (${versionInfo.display})`,
    main: 'server.bundle.js',
    scripts: {
      start: 'node server.bundle.js'
    }
  };
  fs.writeFileSync(path.join(PUBLISH_DIR, 'package.json'), JSON.stringify(prodPkg, null, 2), 'utf-8');

  // 11. Generate START_AMS.bat (Legacy / Backup Launcher)
  console.log('🚀 Step 10: Generating Windows 1-Click Launchers & Installers...');
  const startBatContent = `@echo off
title Global IVF Hospital - Attendance Management System
color 0B
cls
echo =======================================================================
echo              GLOBAL IVF HOSPITAL - ATTENDANCE MANAGEMENT SYSTEM         
echo =======================================================================
echo.

set "NODE_CMD=node"
if exist "%~dp0bin\\node.exe" (
    set "NODE_CMD=%~dp0bin\\node.exe"
) else if exist "%~dp0node.exe" (
    set "NODE_CMD=%~dp0node.exe"
)

echo Starting AMS Server on http://localhost:5050 ...
start /B "" "%NODE_CMD%" server.bundle.js > ams_server.log 2>&1

echo Opening Web Interface in your default browser...
timeout /t 2 /nobreak >nul
start http://localhost:5050

echo.
echo =======================================================================
echo  AMS is running successfully!
echo  URL: http://localhost:5050 (or http://<this-pc-ip>:5050 from other PCs)
echo  Database Storage: ./data/ams.db
echo.
echo  To STOP the server, run STOP_AMS.bat or close this window.
echo =======================================================================
echo.
pause
`;
  fs.writeFileSync(path.join(PUBLISH_DIR, 'START_AMS.bat'), startBatContent, 'utf-8');

  // 12. Generate STOP_AMS.bat
  const stopBatContent = `@echo off
title Stop AMS Server
color 0C
cls
echo =======================================================================
echo           STOPPING GLOBAL IVF ATTENDANCE MANAGEMENT SYSTEM              
echo =======================================================================
echo.
echo Stopping any running AMS processes on port 5050...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5050" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo Terminated process PID: %%a
)

echo.
echo All AMS server instances have been stopped.
echo.
timeout /t 3
`;
  fs.writeFileSync(path.join(PUBLISH_DIR, 'STOP_AMS.bat'), stopBatContent, 'utf-8');

  // 13. Generate Windows Setup Installer Script (INSTALL_AMS_SETUP.bat)
  const installerBatContent = `@echo off
title Global IVF Hospital AMS - Installation Setup Wizard
color 0A
cls
echo =======================================================================
echo          GLOBAL IVF HOSPITAL - ATTENDANCE MANAGEMENT SYSTEM            
echo                       WINDOWS SETUP WIZARD                             
echo =======================================================================
echo.
echo  This wizard will install Global IVF AMS on this Windows PC.
echo  (No Node.js or additional runtimes required).
echo.

set "DEFAULT_DIR=C:\\Global_IVF_AMS"
set /p "TARGET_DIR=Enter installation directory (Press ENTER for default [%DEFAULT_DIR%]): "
if "%TARGET_DIR%"=="" set "TARGET_DIR=%DEFAULT_DIR%"

echo.
echo  [1/4] Installing files to: "%TARGET_DIR%" ...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%TARGET_DIR%\\bin" mkdir "%TARGET_DIR%\\bin"
if not exist "%TARGET_DIR%\\data" mkdir "%TARGET_DIR%\\data"
if not exist "%TARGET_DIR%\\uploads" mkdir "%TARGET_DIR%\\uploads"

xcopy /E /I /Y /Q "bin" "%TARGET_DIR%\\bin" >nul
xcopy /E /I /Y /Q "client_dist" "%TARGET_DIR%\\client_dist" >nul
xcopy /E /I /Y /Q "node_modules" "%TARGET_DIR%\\node_modules" >nul
copy /Y "Global_IVF_AMS.exe" "%TARGET_DIR%\\" >nul
copy /Y "app.ico" "%TARGET_DIR%\\" >nul
copy /Y "server.bundle.js" "%TARGET_DIR%\\" >nul
copy /Y ".env" "%TARGET_DIR%\\" >nul
copy /Y "package.json" "%TARGET_DIR%\\" >nul
copy /Y "START_AMS.bat" "%TARGET_DIR%\\" >nul
copy /Y "STOP_AMS.bat" "%TARGET_DIR%\\" >nul
copy /Y "README_HOW_TO_RUN.txt" "%TARGET_DIR%\\" >nul

if not exist "%TARGET_DIR%\\data\\ams.db" (
    if exist "data\\ams.db" (
        copy /Y "data\\ams.db" "%TARGET_DIR%\\data\\ams.db" >nul
    )
)

echo  [2/4] Verifying database in: "%TARGET_DIR%\\data\\ams.db" ...

echo  [3/4] Creating Desktop Shortcut...
set "VBS_SCRIPT=%TEMP%\\CreateAmsShortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\\Global IVF Hospital AMS.lnk" >> "%VBS_SCRIPT%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT%"
echo oLink.TargetPath = "%TARGET_DIR%\\Global_IVF_AMS.exe" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Global IVF Hospital Attendance Management System" >> "%VBS_SCRIPT%"
echo oLink.IconLocation = "%TARGET_DIR%\\Global_IVF_AMS.exe,0" >> "%VBS_SCRIPT%"
echo oLink.WindowStyle = 1 >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"
cscript /nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%"

echo  [4/4] Creating Start Menu Shortcut...
set "VBS_SCRIPT2=%TEMP%\\CreateAmsStartMenu.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT2%"
echo sLinkFile = oWS.SpecialFolders("Programs") ^& "\\Global IVF Hospital AMS.lnk" >> "%VBS_SCRIPT2%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT2%"
echo oLink.TargetPath = "%TARGET_DIR%\\Global_IVF_AMS.exe" >> "%VBS_SCRIPT2%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%VBS_SCRIPT2%"
echo oLink.Description = "Global IVF Hospital Attendance Management System" >> "%VBS_SCRIPT2%"
echo oLink.IconLocation = "%TARGET_DIR%\\Global_IVF_AMS.exe,0" >> "%VBS_SCRIPT2%"
echo oLink.WindowStyle = 1 >> "%VBS_SCRIPT2%"
echo oLink.Save >> "%VBS_SCRIPT2%"
cscript /nologo "%VBS_SCRIPT2%"
del "%VBS_SCRIPT2%"

echo.
echo =======================================================================
echo  INSTALLATION COMPLETED SUCCESSFULLY!
echo.
echo  Installation Path: %TARGET_DIR%
echo  Executable:        %TARGET_DIR%\\Global_IVF_AMS.exe
echo  Data Directory:    %TARGET_DIR%\\data\\ams.db
echo  Desktop Shortcut:  Created ("Global IVF Hospital AMS")
echo.
echo  To launch the application, double-click the shortcut on your Desktop!
echo =======================================================================
echo.
pause
`;
  fs.writeFileSync(path.join(PUBLISH_DIR, 'INSTALL_AMS_SETUP.bat'), installerBatContent, 'utf-8');

  // 14. Generate Inno Setup Script (InnoSetup_Compiler.iss)
  const innoScriptContent = `; Inno Setup Script for Global IVF Hospital AMS
; Free Inno Setup Compiler can compile this script into a single "Global_IVF_AMS_Setup_${versionInfo.version}.exe"

[Setup]
AppName=Global IVF Hospital AMS
AppVersion=${versionInfo.version}
DefaultDirName={autopf}\\Global IVF Hospital AMS
DefaultGroupName=Global IVF Hospital AMS
OutputDir=.
OutputBaseFilename=Global_IVF_AMS_Setup_${versionInfo.version}
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=lowest
SetupIconFile=app.ico
UninstallDisplayIcon={app}\\Global_IVF_AMS.exe

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "Global_IVF_AMS.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "app.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "server.bundle.js"; DestDir: "{app}"; Flags: ignoreversion
Source: ".env"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "START_AMS.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "STOP_AMS.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "README_HOW_TO_RUN.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "bin\\*"; DestDir: "{app}\\bin"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "client_dist\\*"; DestDir: "{app}\\client_dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "node_modules\\*"; DestDir: "{app}\\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "data\\ams.db"; DestDir: "{app}\\data"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\\Global IVF Hospital AMS"; Filename: "{app}\\Global_IVF_AMS.exe"; WorkingDir: "{app}"; IconFilename: "{app}\\Global_IVF_AMS.exe"
Name: "{group}\\Stop AMS Server"; Filename: "{app}\\STOP_AMS.bat"; WorkingDir: "{app}"
Name: "{group}\\Uninstall AMS"; Filename: "{uninstallexe}"
Name: "{autodesktop}\\Global IVF Hospital AMS"; Filename: "{app}\\Global_IVF_AMS.exe"; WorkingDir: "{app}"; Tasks: desktopicon; IconFilename: "{app}\\Global_IVF_AMS.exe"

[Run]
Filename: "{app}\\Global_IVF_AMS.exe"; Description: "Launch Global IVF Hospital AMS"; Flags: nowait postinstall skipifsilent
`;
  fs.writeFileSync(path.join(PUBLISH_DIR, 'InnoSetup_Compiler.iss'), innoScriptContent, 'utf-8');

  // 15. Generate README_HOW_TO_RUN.txt
  const readmeContent = `=======================================================================
     GLOBAL IVF HOSPITAL - ATTENDANCE MANAGEMENT SYSTEM (AMS)
                     STANDALONE PUBLISH DISTRIBUTION
=======================================================================

This package is 100% SELF-CONTAINED and PORTABLE.
Node.js is embedded in "bin/node.exe" — target PCs do NOT need Node.js installed!
No raw source code (.jsx, react components, backend source) is included.

-----------------------------------------------------------------------
⭐ QUICK START: DOUBLE CLICK Global_IVF_AMS.exe
-----------------------------------------------------------------------
1. Double-click "Global_IVF_AMS.exe".
   - Runs instantly using embedded runtime (no Node.js installation needed).
   - Starts the server cleanly in the background (no black CMD prompt).
   - Automatically opens http://localhost:5050 in your default browser.
   - Runs in the Windows System Tray (near the clock).
   - Right-click the tray icon to Open, Restart, View Logs, or Exit.

-----------------------------------------------------------------------
OPTION 1: 1-CLICK SETUP INSTALLER (FOR NEW PCS)
-----------------------------------------------------------------------
1. Copy this "publish" folder to the target Windows PC.
2. Double-click "INSTALL_AMS_SETUP.bat".
   - Installs AMS to C:\\Global_IVF_AMS (or chosen directory).
   - Automatically sets up database at C:\\Global_IVF_AMS\\data\\ams.db.
   - Creates a "Global IVF Hospital AMS" shortcut on your Desktop & Start Menu.
3. Double-click the Desktop icon anytime to launch AMS!

-----------------------------------------------------------------------
OPTION 2: COMPILE STANDALONE SETUP WIZARD EXE (INNO SETUP)
-----------------------------------------------------------------------
If you have Inno Setup installed (free from https://jrsoftware.org/isinfo.php),
right-click "InnoSetup_Compiler.iss" and select "Compile" to generate
a single "Global_IVF_AMS_Setup.exe" installation wizard file!

-----------------------------------------------------------------------
DATA PERSISTENCE & BACKUPS:
-----------------------------------------------------------------------
All employee records, calculations, and attendance logs are saved in:
./data/ams.db

To back up your data, simply copy the "data" folder.
=======================================================================
`;
  fs.writeFileSync(path.join(PUBLISH_DIR, 'README_HOW_TO_RUN.txt'), readmeContent, 'utf-8');

  console.log('=====================================================');
  console.log('🎉 STANDALONE BUILD COMPLETED (100% ZERO-INSTALL)!');
  console.log(`📂 Output location: ${PUBLISH_DIR}`);
  console.log(`✨ Executable: ${exeOutput}`);
  console.log('=====================================================\n');
}

buildPublish().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
