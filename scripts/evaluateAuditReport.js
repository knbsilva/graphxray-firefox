'use strict';

const fs = require('fs');
const path = require('path');

const reportPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'npm-audit-report.json');

if (!fs.existsSync(reportPath)) {
  throw new Error(`Audit report not found: ${reportPath}`);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

if (report.error?.message) {
  throw new Error(
    `npm audit returned an invalid or incomplete report: ${report.error.message}`
  );
}

const vulnerabilities = report.metadata?.vulnerabilities || {};
const critical = Number(vulnerabilities.critical || 0);
const high = Number(vulnerabilities.high || 0);
const moderate = Number(vulnerabilities.moderate || 0);
const low = Number(vulnerabilities.low || 0);

console.log(`critical: ${critical}`);
console.log(`high: ${high}`);
console.log(`moderate: ${moderate}`);
console.log(`low: ${low}`);

if (critical > 0 || high > 0 || moderate > 0) {
  throw new Error(
    `Production dependency audit failed: ${critical} critical, ${high} high, and ${moderate} moderate vulnerabilities remain.`
  );
}
