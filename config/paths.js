'use strict';

const path = require('path');
const fs = require('fs');
const { getBrowserTarget } = require('./browserTarget');

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebook/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = relativePath => path.resolve(appDirectory, relativePath);

const moduleFileExtensions = [
  'web.mjs',
  'mjs',
  'web.js',
  'js',
  'web.ts',
  'ts',
  'web.tsx',
  'tsx',
  'json',
  'web.jsx',
  'jsx',
];

// Resolve file paths in the same order as webpack
const resolveModule = (resolveFn, filePath) => {
  const extension = moduleFileExtensions.find(extension =>
    fs.existsSync(resolveFn(`${filePath}.${extension}`))
  );

  if (extension) {
    return resolveFn(`${filePath}.${extension}`);
  }

  return resolveFn(`${filePath}.js`);
};

// config after eject: we're in ./config/
const browserTarget = getBrowserTarget();

module.exports = {
  dotenv: resolveApp('.env'),
  appPath: resolveApp('.'),
  browserTarget,
  appBuild: resolveApp('build/firefox'),
  devAppBuild: resolveApp('dev/firefox'),
  appPublic: resolveApp('public'),
  appFirefoxManifestJson: resolveApp('public/manifest.firefox.json'),
  manifestJson: resolveApp('public/manifest.firefox.json'),
  appOptionsHtml: resolveApp('public/options.html'),
  appDevToolsHtml: resolveApp('public/devtools.html'),
  appDashboardHtml: resolveApp('public/dashboard.html'),
  appPopupHtml: resolveApp('public/popup.html'),
  appIndexJs: resolveModule(resolveApp, 'src/index'),
  appBackgroundJs: resolveModule(resolveApp, 'src/background/index'),
  appOptionsJs: resolveModule(resolveApp, 'src/options/index'),
  appDevToolsJs: resolveModule(resolveApp, 'src/devtools/index'),
  appDashboardJs: resolveModule(resolveApp, 'src/dashboard/index'),
  appPackageJson: resolveApp('package.json'),
  appSrc: resolveApp('src'),
  appTsConfig: resolveApp('tsconfig.json'),
  appJsConfig: resolveApp('jsconfig.json'),
  yarnLockFile: resolveApp('yarn.lock'),
  testsSetup: resolveModule(resolveApp, 'src/setupTests'),
  appNodeModules: resolveApp('node_modules'),
};



module.exports.moduleFileExtensions = moduleFileExtensions;
