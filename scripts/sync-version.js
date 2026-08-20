const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function getVersionInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const monthNum = now.getMonth() + 1;
  const dayNum = now.getDate();

  const monthStr = String(monthNum).padStart(2, '0');
  const dayStr = String(dayNum).padStart(2, '0');

  // e.g. "20260820"
  const versionString = `${year}${monthStr}${dayStr}`;

  // SemVer compliant for electron-builder / Windows PE header: e.g. "2026.8.20"
  const semverString = `${year}.${monthNum}.${dayNum}`;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const displayDate = `${dayStr}-${monthNames[now.getMonth()]}-${year}`;
  const isoDate = `${year}-${monthStr}-${dayStr}`;

  return {
    version: versionString,
    semver: semverString,
    buildDate: isoDate,
    displayDate: displayDate,
    display: `v${versionString}`,
    timestamp: now.toISOString()
  };
}

function syncVersions() {
  const info = getVersionInfo();
  console.log(`[VersionSync] Date-based version: ${info.version} (SemVer: ${info.semver}, Display: ${info.display})`);

  // 1. Root package.json
  const rootPkgPath = path.join(ROOT_DIR, 'package.json');
  if (fs.existsSync(rootPkgPath)) {
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    rootPkg.version = info.semver;
    rootPkg.appVersionCode = info.version;
    fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n', 'utf8');
    console.log(`[VersionSync] Updated root package.json -> version ${info.semver}`);
  }

  // 2. Client package.json
  const clientPkgPath = path.join(ROOT_DIR, 'client', 'package.json');
  if (fs.existsSync(clientPkgPath)) {
    const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
    clientPkg.version = info.semver;
    fs.writeFileSync(clientPkgPath, JSON.stringify(clientPkg, null, 2) + '\n', 'utf8');
    console.log(`[VersionSync] Updated client/package.json -> version ${info.semver}`);
  }

  // 3. Client version.json
  const clientVersionPath = path.join(ROOT_DIR, 'client', 'src', 'version.json');
  fs.writeFileSync(clientVersionPath, JSON.stringify(info, null, 2) + '\n', 'utf8');
  console.log(`[VersionSync] Written client/src/version.json`);

  // 4. Server version.json
  const serverVersionPath = path.join(ROOT_DIR, 'server', 'src', 'version.json');
  fs.writeFileSync(serverVersionPath, JSON.stringify(info, null, 2) + '\n', 'utf8');
  console.log(`[VersionSync] Written server/src/version.json`);

  return info;
}

if (require.main === module) {
  syncVersions();
}

module.exports = { getVersionInfo, syncVersions };
