const DEPENDENCY_SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'];

/**
 * Lists every `catalog:` or `workspace:` specifier left in a manifest. npm installs
 * neither protocol, so a manifest that still carries one cannot be published.
 */
export function findUnpublishableSpecifiers(packageJson) {
  const found = [];
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, specifier] of Object.entries(packageJson[section] ?? {})) {
      if (specifier.startsWith('catalog:') || specifier.startsWith('workspace:')) {
        found.push({section, name, specifier});
      }
    }
  }
  return found;
}
