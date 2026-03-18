'use strict';

const TARGET_ALIASES = {
  chrome: 'chromium',
  chromium: 'chromium',
  edge: 'chromium',
  firefox: 'firefox',
  ff: 'firefox',
};

function getBrowserTarget(argv = process.argv, env = process.env) {
  const argValue = argv.find(arg => arg.startsWith('--browser='));
  const rawTarget = (env.BROWSER_TARGET ||
    (argValue ? argValue.split('=')[1] : '') ||
    'firefox')
    .toLowerCase();

  const target = TARGET_ALIASES[rawTarget];

  if (!target) {
    throw new Error(
      `Unsupported browser target "${rawTarget}". Use one of: chromium, chrome, edge, firefox, ff.`
    );
  }

  return target;
}

module.exports = {
  getBrowserTarget,
};
