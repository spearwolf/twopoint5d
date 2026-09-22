const RUNTIME_SECTIONS = ['dependencies', 'optionalDependencies'];

/**
 * Lists every entry of a manifest that npm installs along with the package: its
 * `dependencies` and its `optionalDependencies`, as `{section, name}` in that order.
 * A package that reaches its consumers with peer dependencies only lists none.
 */
export function findRuntimeDependencies(manifest) {
  const found = [];
  for (const section of RUNTIME_SECTIONS) {
    for (const name of Object.keys(manifest?.[section] ?? {})) {
      found.push({section, name});
    }
  }
  return found;
}
