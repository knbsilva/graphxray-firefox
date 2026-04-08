'use strict';

const fs = require('fs');
const path = require('path');
const { copyFileSync } = require('fs');
const { spawnSync } = require('child_process');
const { syncManifestVersion } = require('./syncManifestVersion');
const { validatePackageContents } = require('./validatePackageContents');

const projectRoot = path.resolve(__dirname, '..');
const buildOutputRoot = path.join(projectRoot, 'build');
const packagesDir = path.join(buildOutputRoot, 'packages');
const browserArg = process.argv.find(arg => arg.startsWith('--browser='));
const rawTarget = (browserArg ? browserArg.split('=')[1] : 'firefox').toLowerCase();

if (rawTarget !== 'firefox') {
  throw new Error(
    `Unsupported browser target "${rawTarget}". This fork packages Firefox artifacts only.`
  );
}

const version = syncManifestVersion();
fs.mkdirSync(packagesDir, { recursive: true });
clearPackagesDirectory();

buildTarget('firefox');
validatePackageContents(path.join(buildOutputRoot, 'firefox'));
packageFirefox(version);

console.log(`Created packaged artifacts in ${path.relative(projectRoot, packagesDir)}.`);

function buildTarget(target) {
  const buildScriptPath = path.join(projectRoot, 'scripts', 'build.js');
  const result = spawnSync(
    process.execPath,
    ['--openssl-legacy-provider', buildScriptPath, `--browser=${target}`],
    {
      cwd: projectRoot,
      stdio: 'inherit',
    }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to build the ${target} target.`);
  }
}

function packageFirefox(currentVersion) {
  const sourceDir = path.join(buildOutputRoot, 'firefox');
  const zipPath = path.join(packagesDir, `graphxray-firefox-v${currentVersion}.zip`);
  const xpiPath = path.join(
    packagesDir,
    `graphxray-firefox-unsigned-v${currentVersion}.xpi`
  );

  ensureDirectoryExists(sourceDir, 'Firefox build output');
  createArchive({
    sourceDir,
    destinationPath: zipPath,
    includeRootFolder: false,
  });
  fs.rmSync(xpiPath, { force: true });
  copyFileSync(zipPath, xpiPath);
}

function ensureDirectoryExists(directoryPath, label) {
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`${label} not found at ${directoryPath}.`);
  }
}

function clearPackagesDirectory() {
  fs.readdirSync(packagesDir).forEach(entryName => {
    fs.rmSync(path.join(packagesDir, entryName), { force: true, recursive: true });
  });
}

function createArchive({ sourceDir, destinationPath, includeRootFolder }) {
  const normalizedSourceDir = path.resolve(sourceDir);
  const normalizedDestinationPath = path.resolve(destinationPath);
  const shellName = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const archivePath = includeRootFolder
    ? toPowerShellLiteral(normalizedSourceDir)
    : `(Join-Path ${toPowerShellLiteral(normalizedSourceDir)} '*')`;
  const command = [
    `$destinationPath = ${toPowerShellLiteral(normalizedDestinationPath)}`,
    'if (Test-Path $destinationPath) { Remove-Item $destinationPath -Force }',
    `Compress-Archive -Path ${archivePath} -DestinationPath $destinationPath -Force`,
  ].join('; ');
  const result = spawnSync(
    shellName,
    ['-NoLogo', '-NoProfile', '-Command', command],
    {
      cwd: projectRoot,
      stdio: 'inherit',
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Failed to create archive ${path.basename(destinationPath)}.`);
  }
}

function toPowerShellLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}
