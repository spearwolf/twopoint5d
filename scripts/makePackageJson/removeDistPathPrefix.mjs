/**
 * Rewrites `main`, `module`, `types` and every target in `exports` to paths relative to `dist/`,
 * because the manifest is published from within `dist/`. Only a leading `dist/` or `./dist/`
 * falls; a `dist/` further inside a path is part of the name. Changes the manifest in place and
 * returns it.
 */
export function removeDistPathPrefix(manifest) {
  for (const key of ['main', 'module', 'types']) {
    if (typeof manifest[key] === 'string') {
      manifest[key] = removeDistPrefix(manifest[key]);
    }
  }

  if (manifest.exports !== undefined) {
    manifest.exports = removeDistPrefixFromExports(manifest.exports);
  }

  return manifest;
}

function removeDistPrefix(filePath) {
  return filePath.replace(/^(\.\/)?dist\//, '$1');
}

function removeDistPrefixFromExports(target) {
  if (typeof target === 'string') {
    return removeDistPrefix(target);
  }
  if (Array.isArray(target)) {
    return target.map(removeDistPrefixFromExports);
  }
  // a null target marks a subpath as not exported, so it stays as it is
  if (target !== null && typeof target === 'object') {
    return Object.fromEntries(Object.entries(target).map(([key, value]) => [key, removeDistPrefixFromExports(value)]));
  }
  return target;
}
