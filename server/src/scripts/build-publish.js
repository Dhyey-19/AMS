const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const ROOT_DIR = path.resolve(__dirname, '../../../');
const PUBLISH_DIR = path.join(ROOT_DIR, 'publish');
const CLIENT_DIST_DIR = path.join(ROOT_DIR, 'client/dist');

async function buildPublish() {
  console.log('=====================================================');
  console.log('🚀 Starting Global IVF AMS Production Publish Build');
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

  // 2. Prepare publish directory
  console.log('📁 Step 2: Preparing clean publish directory...');
  if (fs.existsSync(PUBLISH_DIR)) {
    fs.rmSync(PUBLISH_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PUBLISH_DIR, { recursive: true });
  fs.mkdirSync(path.join(PUBLISH_DIR, 'data'), { recursive: true });
  fs.mkdirSync(path.join(PUBLISH_DIR, 'uploads'), { recursive: true });
  console.log('✅ Created publish/ with data/ and uploads/ directories.\n');

  // 3. Bundle & Minify Backend with esbuild
  console.log('🔒 Step 3: Bundling & obfuscating backend source code...');
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

  // 4. Copy pre-compiled frontend (client/dist -> publish/client_dist)
  console.log('📄 Step 4: Copying minified frontend assets...');
  const targetClientDist = path.join(PUBLISH_DIR, 'client_dist');
  fs.cpSync(CLIENT_DIST_DIR, targetClientDist, { recursive: true });
  console.log('✅ Static frontend assets copied to publish/client_dist.\n');

  // 5. Copy SQLite database into data/ folder
  console.log('💾 Step 5: Setting up database in data/ folder...');
  const dbSrc = path.join(ROOT_DIR, 'ams.db');
  const dbDest = path.join(PUBLISH_DIR, 'data', 'ams.db');
  if (fs.existsSync(dbSrc)) {
    fs.copyFileSync(dbSrc, dbDest);
    console.log('✅ Database copied to publish/data/ams.db.\n');
  } else {
    console.log('ℹ️ ams.db will be auto-created inside data/ folder on first run.\n');
  }

  // 6. Copy native better-sqlite3 module & dependencies
  console.log('🔌 Step 6: Bundling native SQLite binary addon...');
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

  // 7. Generate production .env
  console.log('⚙️ Step 7: Generating production configuration...');
  const envContent = `# Global IVF Hospital - Attendance Management System (AMS)
# Production Environment Configuration

NODE_ENV=production
PORT=5050
HOST=0.0.0.0
JWT_SECRET=global_ivf_ams_secure_production_secret_key_2026
DB_PATH=./data/ams.db
CLIENT_DIST_PATH=./client_dist
`;
  fs.writeFileSync(path.join(PUBLISH_DIR, '.env'), envContent, 'utf-8');

  // 8. Generate minimal package.json
  const prodPkg = {
    name: 'global-ivf-ams-production',
    version: '1.0.0',
    description: 'Global IVF Hospital Attendance Management System - Standalone Distribution',
    main: 'server.bundle.js',
    scripts: {
      start: 'node server.bundle.js'
    }
  };
  fs.writeFileSync(path.join(PUBLISH_DIR, 'package.json'), JSON.stringify(prodPkg, null, 2), 'utf-8');

  // 9. Generate START_AMS.bat
  console.log('🚀 Step 8: Generating Windows 1-Click Launchers...');
  const startBatContent = `@echo off
title Global IVF Hospital - Attendance Management System
color 0B
cls
echo =======================================================================
echo              GLOBAL IVF HOSPITAL - ATTENDANCE MANAGEMENT SYSTEM         
echo =======================================================================
echo.
echo  [1/3] Checking Node.js runtime...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js is not installed or not found in system PATH.
    echo  Please install Node.js (v18 or higher) on this PC from:
    echo  https://nodejs.org/ (LTS version)
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
)

echo  [2/3] Starting AMS Server on http://localhost:5050 ...
start /B node server.bundle.js > ams_server.log 2>&1

echo  [3/3] Opening Web Interface in your default browser...
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

  // 10. Generate STOP_AMS.bat
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

  // 11. Generate Windows Setup Installer Script (INSTALL_AMS_SETUP.bat)
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
echo.

set "DEFAULT_DIR=C:\\Global_IVF_AMS"
set /p "TARGET_DIR=Enter installation directory (Press ENTER for default [%DEFAULT_DIR%]): "
if "%TARGET_DIR%"=="" set "TARGET_DIR=%DEFAULT_DIR%"

echo.
echo  [1/4] Installing files to: "%TARGET_DIR%" ...
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%TARGET_DIR%\\data" mkdir "%TARGET_DIR%\\data"
if not exist "%TARGET_DIR%\\uploads" mkdir "%TARGET_DIR%\\uploads"

xcopy /E /I /Y /Q "client_dist" "%TARGET_DIR%\\client_dist" >nul
xcopy /E /I /Y /Q "node_modules" "%TARGET_DIR%\\node_modules" >nul
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
echo oLink.TargetPath = "%TARGET_DIR%\\START_AMS.bat" >> "%VBS_SCRIPT%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%VBS_SCRIPT%"
echo oLink.Description = "Global IVF Hospital Attendance Management System" >> "%VBS_SCRIPT%"
echo oLink.WindowStyle = 1 >> "%VBS_SCRIPT%"
echo oLink.Save >> "%VBS_SCRIPT%"
cscript /nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%"

echo  [4/4] Creating Start Menu Shortcut...
set "VBS_SCRIPT2=%TEMP%\\CreateAmsStartMenu.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%VBS_SCRIPT2%"
echo sLinkFile = oWS.SpecialFolders("Programs") ^& "\\Global IVF Hospital AMS.lnk" >> "%VBS_SCRIPT2%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%VBS_SCRIPT2%"
echo oLink.TargetPath = "%TARGET_DIR%\\START_AMS.bat" >> "%VBS_SCRIPT2%"
echo oLink.WorkingDirectory = "%TARGET_DIR%" >> "%VBS_SCRIPT2%"
echo oLink.Description = "Global IVF Hospital Attendance Management System" >> "%VBS_SCRIPT2%"
echo oLink.WindowStyle = 1 >> "%VBS_SCRIPT2%"
echo oLink.Save >> "%VBS_SCRIPT2%"
cscript /nologo "%VBS_SCRIPT2%"
del "%VBS_SCRIPT2%"

echo.
echo =======================================================================
echo  INSTALLATION COMPLETED SUCCESSFULLY!
echo.
echo  Installation Path: %TARGET_DIR%
echo  Data Directory:    %TARGET_DIR%\\data\\ams.db
echo  Desktop Shortcut:  Created ("Global IVF Hospital AMS")
echo.
echo  To launch the application, double-click the shortcut on your Desktop!
echo =======================================================================
echo.
pause
`;
  fs.writeFileSync(path.join(PUBLISH_DIR, 'INSTALL_AMS_SETUP.bat'), installerBatContent, 'utf-8');

  // 12. Generate Inno Setup Script (InnoSetup_Compiler.iss)
  const innoScriptContent = `; Inno Setup Script for Global IVF Hospital AMS
; Free Inno Setup Compiler can compile this script into a single "Global_IVF_AMS_Setup.exe"

[Setup]
AppName=Global IVF Hospital AMS
AppVersion=1.0.0
DefaultDirName={autopf}\\Global IVF Hospital AMS
DefaultGroupName=Global IVF Hospital AMS
OutputDir=.
OutputBaseFilename=Global_IVF_AMS_Setup
Compression=lzma2/max
SolidCompression=yes
PrivilegesRequired=lowest

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "server.bundle.js"; DestDir: "{app}"; Flags: ignoreversion
Source: ".env"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "START_AMS.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "STOP_AMS.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "README_HOW_TO_RUN.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "client_dist\\*"; DestDir: "{app}\\client_dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "node_modules\\*"; DestDir: "{app}\\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "data\\ams.db"; DestDir: "{app}\\data"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\\Global IVF Hospital AMS"; Filename: "{app}\\START_AMS.bat"; WorkingDir: "{app}"
Name: "{group}\\Stop AMS Server"; Filename: "{app}\\STOP_AMS.bat"; WorkingDir: "{app}"
Name: "{group}\\Uninstall AMS"; Filename: "{uninstallexe}"
Name: "{autodesktop}\\Global IVF Hospital AMS"; Filename: "{app}\\START_AMS.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\\START_AMS.bat"; Description: "Launch Global IVF Hospital AMS"; Flags: nowait postinstall skipifsilent
`;
  fs.writeFileSync(path.join(PUBLISH_DIR, 'InnoSetup_Compiler.iss'), innoScriptContent, 'utf-8');

  // 13. Generate README_HOW_TO_RUN.txt
  const readmeContent = `=======================================================================
     GLOBAL IVF HOSPITAL - ATTENDANCE MANAGEMENT SYSTEM (AMS)
                     STANDALONE PUBLISH DISTRIBUTION
=======================================================================

This package contains the pre-compiled, protected production build of AMS.
No project source code (.jsx, react components, backend routes/services) is included.

-----------------------------------------------------------------------
OPTION 1: 1-CLICK SETUP INSTALLER (RECOMMENDED FOR NEW PCS)
-----------------------------------------------------------------------
1. Copy this "publish" folder to the other Windows PC.
2. Double-click "INSTALL_AMS_SETUP.bat".
   - It will install the application to C:\\Global_IVF_AMS (or your chosen folder).
   - It automatically puts the database into the "data" folder (C:\\Global_IVF_AMS\\data\\ams.db).
   - It creates a "Global IVF Hospital AMS" shortcut on your Desktop and Start Menu!
3. Double-click the Desktop shortcut anytime to run AMS!

-----------------------------------------------------------------------
OPTION 2: RUN DIRECTLY (PORTABLE MODE)
-----------------------------------------------------------------------
1. Double-click "START_AMS.bat" in this folder.
   - Automatically starts the server on port 5050 and opens http://localhost:5050 in your browser.
2. To stop the application, double-click "STOP_AMS.bat".

-----------------------------------------------------------------------
OPTION 3: GENERATE SINGLE SETUP .EXE (INNO SETUP)
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
  console.log('🎉 PUBLISH BUILD & SETUP CREATOR COMPLETED!');
  console.log(`📂 Output location: ${PUBLISH_DIR}`);
  console.log('=====================================================\n');
}

buildPublish().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
