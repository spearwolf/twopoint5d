const DEPENDENCY_SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'];

const UNPUBLISHABLE_PROTOCOL = /^(catalog|workspace|link|file|portal):/;

/**
 * Lists every `catalog:`, `workspace:`, `link:`, `file:` or `portal:` specifier left in a
 * manifest, and every value that is no string at all. npm installs none of these protocols,
 * and it installs no `null` or number either, so a manifest that still carries one cannot be
 * published. `link:`, `file:` and `portal:` point at a path on the machine that builds the
 * package — the consumer has no such path.
 */
export function findUnpublishableSpecifiers(packageJson) {
  const found = [];
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, specifier] of Object.entries(packageJson[section] ?? {})) {
      if (typeof specifier !== 'string' || UNPUBLISHABLE_PROTOCOL.test(specifier)) {
        found.push({section, name, specifier});
      }
    }
  }
  return found;
}
