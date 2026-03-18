'use strict';

const path = require('path');
const fs = require('fs-extra');
const paths = require('../../config/paths');

function copyPublicFolder(buildFolder) {
  const excludedFiles = new Set([
    paths.appPopupHtml,
    paths.appOptionsHtml,
    paths.appChromiumManifestJson,
    paths.appFirefoxManifestJson,
  ]);

  fs.copySync(paths.appPublic, buildFolder, {
    dereference: true,
    filter: file => !excludedFiles.has(file),
  });

  fs.copyFileSync(paths.manifestJson, path.join(buildFolder, 'manifest.json'));
}

module.exports = copyPublicFolder;
