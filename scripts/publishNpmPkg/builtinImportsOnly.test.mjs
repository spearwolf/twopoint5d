import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import ts from '@typescript/typescript6';
import {findUndeclaredImports} from '../checkPeerDependenciesOnly/findUndeclaredImports.mjs';

const scripts = fileURLToPath(new URL('..', import.meta.url));

test("publishNpmPkg.mjs and its helpers import nothing but Node's built-ins and each other: the publish job of the deploy installs nothing", () => {
  const helpers = fs
    .readdirSync(path.join(scripts, 'publishNpmPkg'))
    .filter((name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs'))
    .map((name) => path.join('publishNpmPkg', name));
  // an empty or moved directory would let the check pass on nothing
  assert.ok(helpers.includes(path.join('publishNpmPkg', 'releaseFiles.mjs')), `helpers: ${helpers}`);

  const files = ['publishNpmPkg.mjs', ...helpers].map((file) => ({
    file,
    text: fs.readFileSync(path.join(scripts, file), 'utf8'),
  }));
  const packages = findUndeclaredImports(files, undefined).filter(({specifier}) => !specifier.startsWith('node:'));
  assert.deepEqual(packages, []);

  // findUndeclaredImports passes over relative specifiers, and a module elsewhere under
  // scripts/ may import a package itself, so every relative one has to land on one of
  // these files
  const ownFiles = new Set(files.map(({file}) => path.join(scripts, file)));
  const elsewhere = files.flatMap(({file, text}) =>
    ts
      .preProcessFile(text, true, true)
      .importedFiles.map(({fileName}) => fileName)
      .filter((specifier) => specifier.startsWith('./') || specifier.startsWith('../'))
      .filter((specifier) => !ownFiles.has(path.resolve(scripts, path.dirname(file), specifier)))
      .map((specifier) => ({file, specifier})),
  );
  assert.deepEqual(elsewhere, []);
});
