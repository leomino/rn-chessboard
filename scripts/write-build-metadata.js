/* eslint-env node */
const { writeFileSync } = require('node:fs');
const path = require('node:path');

// Bob's esm mode rewrites extensions but does not create JavaScript package scopes.
for (const [target, type] of [
  ['commonjs', 'commonjs'],
  ['module', 'module'],
]) {
  writeFileSync(
    path.join(__dirname, '..', 'lib', target, 'package.json'),
    JSON.stringify({ type }) + '\n'
  );
}
