'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(projectRoot, 'public', 'manifest.firefox.json');
const packageJsonPath = path.join(projectRoot, 'package.json');

const REQUIRED_GRAPH_HOSTS = [
  'https://graph.microsoft.com/',
  'https://graph.microsoft.us/',
  'https://microsoftgraph.chinacloudapi.cn/',
  'https://dod-graph.microsoft.us/',
];

const OPTIONAL_RISKY_HOSTS = [
  'https://main.iam.ad.ext.azure.com/',
  'https://elm.iga.azure.com/',
  'https://pds.iga.azure.com/',
  'https://api.accessreviews.identitygovernance.azure.com/',
  'https://management.azure.com/',
  'https://admin.microsoft.com/',
  'https://portal.office.com/',
  'https://security.microsoft.com/',
  'https://graph.windows.net/',
  'https://api.azrbac.mspim.azure.com/',
  'https://admin.powerplatform.microsoft.com/',
  'https://admin.cloud.microsoft/',
  'https://devxapi-func-prod-eastus.azurewebsites.net/',
];

const ALLOWED_EXTENSION_PERMISSIONS = ['downloads', 'storage', 'webRequest'];
const REQUIRED_DATA_COLLECTION_PERMISSIONS = ['none'];
const OPTIONAL_DATA_COLLECTION_PERMISSIONS = [
  'personallyIdentifyingInfo',
  'websiteContent',
];
const DISALLOWED_RUNTIME_DEPENDENCIES = [
  '@babel/core',
  '@svgr/webpack',
  '@testing-library/jest-dom',
  '@testing-library/react',
  '@testing-library/user-event',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  'babel-eslint',
  'babel-jest',
  'babel-loader',
  'babel-plugin-named-asset-import',
  'babel-preset-react-app',
  'bfj',
  'camelcase',
  'case-sensitive-paths-webpack-plugin',
  'css-loader',
  'dotenv',
  'dotenv-expand',
  'eslint',
  'eslint-config-react-app',
  'eslint-plugin-flowtype',
  'eslint-plugin-import',
  'eslint-plugin-jest',
  'eslint-plugin-jsx-a11y',
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'eslint-plugin-testing-library',
  'eslint-webpack-plugin',
  'file-loader',
  'fs-extra',
  'html-webpack-plugin',
  'identity-obj-proxy',
  'jest',
  'jest-circus',
  'jest-resolve',
  'jest-watch-typeahead',
  'mini-css-extract-plugin',
  'optimize-css-assets-webpack-plugin',
  'pnp-webpack-plugin',
  'postcss-flexbugs-fixes',
  'postcss-loader',
  'postcss-normalize',
  'postcss-preset-env',
  'postcss-safe-parser',
  'prism-react-renderer',
  'prompts',
  'react-app-polyfill',
  'react-dev-utils',
  'resolve',
  'resolve-url-loader',
  'sass-loader',
  'semver',
  'style-loader',
  'terser-webpack-plugin',
  'ts-pnp',
  'url-loader',
  'webpack',
  'webpack-dev-server',
  'webpack-manifest-plugin',
  'workbox-webpack-plugin',
  'write-file-webpack-plugin',
];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const assertSetEquals = (actual, expected, label, violations) => {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  const missing = [...expectedSet].filter((value) => !actualSet.has(value));
  const unexpected = [...actualSet].filter((value) => !expectedSet.has(value));

  if (missing.length || unexpected.length) {
    violations.push(
      `${label} mismatch:` +
        [
          missing.length ? ` missing [${missing.join(', ')}]` : '',
          unexpected.length ? ` unexpected [${unexpected.join(', ')}]` : '',
        ].join('')
    );
  }
};

const validateManifest = (manifest, violations) => {
  if (Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0) {
    violations.push('Firefox manifest must not define content_scripts.');
  }

  assertSetEquals(
    manifest.host_permissions || [],
    REQUIRED_GRAPH_HOSTS,
    'Required host permissions',
    violations
  );

  assertSetEquals(
    manifest.optional_host_permissions || [],
    OPTIONAL_RISKY_HOSTS,
    'Optional host permissions',
    violations
  );

  const unexpectedPermissions = (manifest.permissions || []).filter(
    (permission) => !ALLOWED_EXTENSION_PERMISSIONS.includes(permission)
  );

  if (unexpectedPermissions.length > 0) {
    violations.push(
      `Unexpected Firefox extension permissions: [${unexpectedPermissions.join(', ')}]`
    );
  }

  const dataCollectionPermissions =
    manifest.browser_specific_settings?.gecko?.data_collection_permissions;
  if (!dataCollectionPermissions) {
    violations.push('Missing browser_specific_settings.gecko.data_collection_permissions.');
  } else {
    assertSetEquals(
      dataCollectionPermissions.required || [],
      REQUIRED_DATA_COLLECTION_PERMISSIONS,
      'Required data collection permissions',
      violations
    );
    assertSetEquals(
      dataCollectionPermissions.optional || [],
      OPTIONAL_DATA_COLLECTION_PERMISSIONS,
      'Optional data collection permissions',
      violations
    );
  }

  const firefoxMinimumVersion = Number.parseFloat(
    manifest.browser_specific_settings?.gecko?.strict_min_version || '0'
  );
  if (firefoxMinimumVersion < 140) {
    violations.push(
      'Firefox strict_min_version must be 140 or newer for built-in data collection consent.'
    );
  }
};

const validatePackageJson = (packageJson, violations) => {
  const runtimeDependencies = Object.keys(packageJson.dependencies || {});
  const disallowedRuntime = runtimeDependencies.filter((dependency) =>
    DISALLOWED_RUNTIME_DEPENDENCIES.includes(dependency)
  );

  if (disallowedRuntime.length > 0) {
    violations.push(
      `Build/test/tooling packages must not live in runtime dependencies: [${disallowedRuntime.join(
        ', '
      )}]`
    );
  }
};

const validateSecurityPosture = () => {
  const manifest = readJson(manifestPath);
  const packageJson = readJson(packageJsonPath);
  const violations = [];

  validateManifest(manifest, violations);
  validatePackageJson(packageJson, violations);

  if (violations.length > 0) {
    throw new Error(
      `Security posture validation failed:\n${violations
        .map((violation) => `- ${violation}`)
        .join('\n')}`
    );
  }

  console.log('Security posture validation passed.');
};

if (require.main === module) {
  validateSecurityPosture();
}

module.exports = {
  validateSecurityPosture,
};
