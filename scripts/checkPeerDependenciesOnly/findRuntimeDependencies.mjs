const RUNTIME_SECTIONS = ['dependencies', 'optionalDependencies'];

// npm knows both spellings
const BUNDLE_SECTIONS = ['bundleDependencies', 'bundledDependencies'];

/**
 * Lists every entry of a manifest that npm installs along with the package, as
 * `{section, name}`: its `dependencies` and `optionalDependencies`, then the names in
 * `bundleDependencies` and `bundledDependencies`, which ship inside the tarball. A package
 * that reaches its consumers with peer dependencies only lists none.
 */
export function findRuntimeDependencies(manifest) {
  const found = [];
  for (const section of RUNTIME_SECTIONS) {
    for (const name of Object.keys(manifest?.[section] ?? {})) {
      found.push({section, name});
    }
  }
  for (const section of BUNDLE_SECTIONS) {
    // `true` bundles every entry of `dependencies`, which are named on their own already, and
    // `false` bundles nothing; only a list names packages of its own
    const names = manifest?.[section];
    if (Array.isArray(names)) {
      for (const name of names) {
        found.push({section, name});
      }
    }
  }
  return found;
}
