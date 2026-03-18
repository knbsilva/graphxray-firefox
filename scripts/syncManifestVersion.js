'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const manifestPaths = [
  path.join(projectRoot, 'public', 'manifest.firefox.json'),
];

function readJson(jsonPath) {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function writeJson(jsonPath, value) {
  fs.writeFileSync(jsonPath, `${JSON.stringify(value, null, 2)}\n`);
}

function syncManifestVersion(version = null) {
  const packageJson = readJson(packageJsonPath);
  const nextVersion = version || packageJson.version;

  if (packageJson.version !== nextVersion) {
    packageJson.version = nextVersion;
    writeJson(packageJsonPath, packageJson);
  }

  manifestPaths.forEach(manifestPath => {
    const manifest = readJson(manifestPath);

    if (manifest.version !== nextVersion) {
      manifest.version = nextVersion;
      writeJson(manifestPath, manifest);
    }
  });

  return nextVersion;
}

if (require.main === module) {
  const syncedVersion = syncManifestVersion(process.argv[2]);
  console.log(`Synchronized manifest versions to ${syncedVersion}.`);
}

module.exports = {
  syncManifestVersion,
};
