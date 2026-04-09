'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

process.on('unhandledRejection', err => {
  throw err;
});

require('../config/env');

const fs = require('fs');
const path = require('path');
const chalk = require('react-dev-utils/chalk');
const clearConsole = require('react-dev-utils/clearConsole');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const { checkBrowsers } = require('react-dev-utils/browsersHelper');
const webpack = require('webpack');
const paths = require('../config/paths');
const configFactory = require('../config/webpack.config');

const isInteractive = process.stdout.isTTY;
const devBuildFolder = path
  .relative(paths.appPath, paths.devAppBuild)
  .replace(/\\/g, '/');

if (
  !checkRequiredFiles([
    paths.appPopupHtml,
    paths.manifestJson,
    paths.appIndexJs,
    paths.appBackgroundJs,
    paths.appOptionsHtml,
    paths.appOptionsJs,
    paths.appDevToolsHtml,
    paths.appDevToolsJs,
  ])
) {
  process.exit(1);
}

checkBrowsers(paths.appPath, isInteractive)
  .then(() => {
    const config = configFactory('development');
    const compiler = webpack(config);
    const copyPublicFolder = require('./utils/copyPublicFolder');

    prepareDevOutput(copyPublicFolder);

    let hasPrintedReadyMessage = false;
    const watcher = compiler.watch(
      {
        ignored: /node_modules/,
      },
      (err, stats) => {
        refreshDevPublicAssets(copyPublicFolder);

        if (isInteractive) {
          clearConsole();
        }

        if (err) {
          console.log(chalk.red('Failed to compile.\n'));
          console.log(err.message || err);
          return;
        }

        const messages = formatWebpackMessages(
          stats.toJson({ all: false, warnings: true, errors: true })
        );

        if (messages.errors.length) {
          console.log(chalk.red('Failed to compile.\n'));
          console.log(messages.errors.join('\n\n'));
          return;
        }

        if (messages.warnings.length) {
          console.log(chalk.yellow('Compiled with warnings.\n'));
          console.log(messages.warnings.join('\n\n'));
        } else {
          console.log(chalk.green('Compiled successfully.\n'));
        }

        if (!hasPrintedReadyMessage) {
          console.log(
            chalk.cyan(
              `Watching the ${paths.browserTarget} extension and writing output to /${devBuildFolder}.`
            )
          );
          console.log(
            `Load ${chalk.bold('manifest.json')} from ${chalk.bold(
              `/${devBuildFolder}`
            )} in about:debugging and reload the temporary add-on after changes.\n`
          );
          hasPrintedReadyMessage = true;
        }
      }
    );

    ['SIGINT', 'SIGTERM'].forEach(sig => {
      process.on(sig, () => {
        watcher.close(() => process.exit());
      });
    });

    if (process.env.CI !== 'true') {
      process.stdin.on('end', () => {
        watcher.close(() => process.exit());
      });
    }
  })
  .catch(err => {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  });

function prepareDevOutput(copyPublicFolder) {
  fs.rmSync(paths.devAppBuild, { recursive: true, force: true });
  fs.mkdirSync(paths.devAppBuild, { recursive: true });
  refreshDevPublicAssets(copyPublicFolder);
}

function refreshDevPublicAssets(copyPublicFolder) {
  copyPublicFolder(paths.devAppBuild);
}
