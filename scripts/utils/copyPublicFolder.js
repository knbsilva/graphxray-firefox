'use strict';

const path = require('path');
const fs = require('fs-extra');
const paths = require('../../config/paths');

function copyPublicFolder(buildFolder) {
  const allowedRelativePaths = [
    'dashboard.html',
    'dev.html',
    'dev.js',
    'devtools.html',
    'options.html',
    'popup.html',
    'logo192.png',
    path.join('img', 'icon-16.png'),
    path.join('img', 'icon-64.png'),
    path.join('img', 'icon-128.png'),
    path.join('img', 'icon-16.svg'),
  ];

  allowedRelativePaths.forEach(relativePath => {
    const sourcePath = path.join(paths.appPublic, relativePath);
    const destinationPath = path.join(buildFolder, relativePath);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing public asset required for build: ${relativePath}`);
    }

    fs.ensureDirSync(path.dirname(destinationPath));
    fs.copyFileSync(sourcePath, destinationPath);
  });

  fs.copyFileSync(paths.manifestJson, path.join(buildFolder, 'manifest.json'));
  ['LICENSE', 'PRIVACY.md', 'THIRD_PARTY_NOTICES.md'].forEach(fileName => {
    const sourcePath = path.join(paths.appPath, fileName);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing distribution document: ${fileName}`);
    }
    fs.copyFileSync(sourcePath, path.join(buildFolder, fileName));
  });
}

module.exports = copyPublicFolder;
