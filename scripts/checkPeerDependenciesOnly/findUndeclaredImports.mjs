import ts from 'typescript';

/**
 * The package a module specifier reaches: `@scope/name` for `@scope/name/sub/path.js`,
 * `name` for `name/sub/path`, otherwise the first segment before the `/` — `node:fs`
 * stays `node:fs`, `fs` stays `fs`.
 */
export function packageNameOf(specifier) {
  const segments = specifier.split('/');
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
}

/**
 * Lists every import of a package that is not one of the `peerDependencies`, as
 * `{file, specifier}` in the order of `files`; within a file the imports come before the
 * type references, each in source order. `files` is an array of `{file, text}`,
 * `peerDependencies` an object (may be `undefined`). Relative specifiers and subpath imports of the package itself (`#internal`, from
 * the `imports` map of its manifest) never count.
 * A `/// <reference types="x" />` counts unless `x` or `@types/x` is a peer. Comments
 * never count: the compiler's pre-processor skips them, which a regular expression
 * would not — the emitted `.js` files carry TSDoc examples with `import … from '…'`.
 */
export function findUndeclaredImports(files, peerDependencies) {
  const peers = new Set(Object.keys(peerDependencies ?? {}));
  const found = [];
  for (const {file, text} of files) {
    const {importedFiles, typeReferenceDirectives} = ts.preProcessFile(text, true, true);
    for (const {fileName} of importedFiles) {
      if (
        !fileName.startsWith('./') &&
        !fileName.startsWith('../') &&
        !fileName.startsWith('#') &&
        !peers.has(packageNameOf(fileName))
      ) {
        found.push({file, specifier: fileName});
      }
    }
    for (const {fileName} of typeReferenceDirectives) {
      if (!peers.has(fileName) && !peers.has(`@types/${fileName}`)) {
        found.push({file, specifier: fileName});
      }
    }
  }
  return found;
}
