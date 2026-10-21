/**
 * Rewrites the path fields of a manifest to paths relative to `dist/`, because the manifest
 * is published from within `dist/`: `main`, `module`, `types`, `typings`, `browser`, and every
 * target in `exports`, `imports`, `bin` and `typesVersions`. Only a leading `dist/` or
 * `./dist/` falls; a `dist/` further inside a path is part of the name. In `exports`,
 * `imports`, `bin` and `typesVersions` only values are rewritten, never keys — subpaths,
 * `#` names, command names and the version ranges and patterns of `typesVersions` are no
 * file paths. A `browser` map is the exception: its keys and its string values both name
 * files of the package, and a `false` value stays. Changes the manifest in place and
 * returns it.
 */
export function removeDistPathPrefix(manifest) {
  for (const key of ['main', 'module', 'types', 'typings']) {
    if (typeof manifest[key] === 'string') {
      manifest[key] = removeDistPrefix(manifest[key]);
    }
  }

  for (const key of ['exports', 'imports', 'bin', 'typesVersions']) {
    if (manifest[key] !== undefined) {
      manifest[key] = removeDistPrefixFromTargets(manifest[key]);
    }
  }

  if (typeof manifest.browser === 'string') {
    manifest.browser = removeDistPrefix(manifest.browser);
  } else if (manifest.browser !== null && typeof manifest.browser === 'object') {
    manifest.browser = Object.fromEntries(
      Object.entries(manifest.browser).map(([key, value]) => [
        removeDistPrefix(key),
        typeof value === 'string' ? removeDistPrefix(value) : value,
      ]),
    );
  }

  return manifest;
}

function removeDistPrefix(filePath) {
  return filePath.replace(/^(\.\/)?dist\//, '$1');
}

function removeDistPrefixFromTargets(target) {
  if (typeof target === 'string') {
    return removeDistPrefix(target);
  }
  if (Array.isArray(target)) {
    return target.map(removeDistPrefixFromTargets);
  }
  // a null target marks a subpath as not exported, so it stays as it is
  if (target !== null && typeof target === 'object') {
    return Object.fromEntries(Object.entries(target).map(([key, value]) => [key, removeDistPrefixFromTargets(value)]));
  }
  return target;
}
