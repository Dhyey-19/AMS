const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const betterSqliteDir = path.join(rootDir, 'node_modules', 'better-sqlite3');

try {
  const pkg = require(path.join(rootDir, 'package.json'));
  const elVersion = (pkg.devDependencies && pkg.devDependencies.electron ? pkg.devDependencies.electron.replace('^', '') : '32.2.8');
  console.log(`📦 Ensuring better-sqlite3 prebuilt binary for Electron ${elVersion}...`);
  execSync(`npx prebuild-install --runtime=electron --target=${elVersion}`, {
    cwd: betterSqliteDir,
    stdio: 'inherit'
  });
  console.log('✅ SQLite Electron binary verified.');
} catch (err) {
  console.error('Failed to setup better-sqlite3 for Electron:', err.message);
}
