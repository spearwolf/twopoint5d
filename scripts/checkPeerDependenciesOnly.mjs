// The library reaches its consumers with peer dependencies only, and the non-blocking audit
// step in CI relies on that (docs/architecture.md, §3). This script fails on a manifest that
// declares anything npm would install along with the package.
//
//   node scripts/checkPeerDependenciesOnly.mjs <package-dir>
//
// Exit 0: <package-dir>/package.json declares no `dependencies` and no `optionalDependencies`.
// 1: it declares some, it cannot be read, or the argument is missing.

import fs from 'node:fs';
import path from 'node:path';
import {findRuntimeDependencies} from './checkPeerDependenciesOnly/findRuntimeDependencies.mjs';

const [packageDir] = process.argv.slice(2);
if (packageDir == null) {
  console.error('usage: node scripts/checkPeerDependenciesOnly.mjs <package-dir>');
  process.exit(1);
}

const manifestPath = path.join(packageDir, 'package.json');
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  console.error(`cannot read ${manifestPath}: ${error.message}`);
  process.exit(1);
}

const found = findRuntimeDependencies(manifest);
for (const {section, name} of found) {
  console.error(`${manifestPath} declares ${section}.${name}; the library ships with peer dependencies only`);
}
if (found.length > 0) {
  process.exit(1);
}
