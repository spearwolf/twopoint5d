// The library reaches its consumers with peer dependencies only, and the non-blocking
// audit step in CI relies on that (docs/architecture.md, §3). This script fails on a
// package that declares anything npm would install along with it, or whose `.js`, `.mjs`
// or `.d.ts` files import a package that is not one of its `peerDependencies`.
//
//   node scripts/checkPeerDependenciesOnly.mjs <package-dir>
//
// Exit 0: <package-dir>/package.json declares no `dependencies` and no
// `optionalDependencies`, and no `.js`, `.mjs` or `.d.ts` file below <package-dir>
// (`node_modules` aside) imports anything but its peers, relative paths and `#` subpaths.
// 1: it declares some, it imports one, a file cannot be read, or the argument is missing.

import fs from 'node:fs';
import path from 'node:path';
import {findRuntimeDependencies} from './checkPeerDependenciesOnly/findRuntimeDependencies.mjs';
import {findUndeclaredImports} from './checkPeerDependenciesOnly/findUndeclaredImports.mjs';

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
  console.error(`cannot read ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const found = findRuntimeDependencies(manifest);
for (const {section, name} of found) {
  console.error(`${manifestPath} declares ${section}.${name}; the library ships with peer dependencies only`);
}

const sources = fs
  .readdirSync(packageDir, {recursive: true, encoding: 'utf8'})
  .filter((file) => /\.(js|mjs|d\.ts)$/.test(file) && !file.split(path.sep).includes('node_modules'))
  .sort()
  .map((file) => {
    const filePath = path.join(packageDir, file);
    try {
      return {file, text: fs.readFileSync(filePath, 'utf8')};
    } catch (error) {
      console.error(`cannot read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

const undeclared = findUndeclaredImports(sources, manifest.peerDependencies);
for (const {file, specifier} of undeclared) {
  console.error(`${path.join(packageDir, file)} imports ${specifier}; the library ships with peer dependencies only`);
}
if (found.length > 0 || undeclared.length > 0) {
  process.exit(1);
}
