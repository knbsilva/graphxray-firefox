'use strict';

const fs = require('fs');
const path = require('path');

const DISALLOWED_PATTERNS = [
  /(^|[\\/])GraphXRay[^\\/]*\.(json|ps1|py|txt)$/i,
  /(^|[\\/]).+\.har$/i,
  /(^|[\\/])captures([\\/]|$)/i,
  /(^|[\\/])exports([\\/]|$)/i,
  /(^|[\\/])\.tools([\\/]|$)/i,
  /(^|[\\/])contentScript\.bundle\.js(\.map|\.LICENSE\.txt)?$/i,
];

function validatePackageContents(targetDirectory) {
  const root = path.resolve(targetDirectory);

  if (!fs.existsSync(root)) {
    throw new Error(`Package validation target does not exist: ${root}`);
  }

  const violations = [];

  const walk = (currentDirectory) => {
    fs.readdirSync(currentDirectory, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(currentDirectory, entry.name);
      const relativePath = path.relative(root, fullPath);

      if (entry.isDirectory()) {
        walk(fullPath);
        return;
      }

      if (DISALLOWED_PATTERNS.some((pattern) => pattern.test(relativePath))) {
        violations.push(relativePath);
      }
    });
  };

  walk(root);

  if (violations.length > 0) {
    throw new Error(
      `Packaged Firefox build contains disallowed artifacts:\n${violations
        .map((entry) => `- ${entry}`)
        .join('\n')}`
    );
  }
}

module.exports = {
  validatePackageContents,
};
