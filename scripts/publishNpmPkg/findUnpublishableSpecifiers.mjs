const DEPENDENCY_SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'];

const UNPUBLISHABLE_PROTOCOL = /^(catalog|workspace|link|file|portal):/;

/**
 * Lists every `catalog:`, `workspace:`, `link:`, `file:` or `portal:` specifier left in a
 * manifest, every bare `*`, and every value that is no string at all. npm installs none of
 * these protocols, and it installs no `null` or number either, so a manifest that still
 * carries one cannot be published. `link:`, `file:` and `portal:` point at a path on the
 * machine that builds the package — the consumer has no such path. `resolveDependencies`
 * reads a bare `*` as a reference into the workspace and replaces it by the range of the
 * package it finds; a `*` that stays in the manifest is a package it did not find, and
 * would let in any version as a range.
 */
export function findUnpublishableSpecifiers(packageJson) {
  const found = [];
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, specifier] of Object.entries(packageJson[section] ?? {})) {
      if (typeof specifier !== 'string' || specifier === '*' || UNPUBLISHABLE_PROTOCOL.test(specifier)) {
        found.push({section, name, specifier});
      }
    }
  }
  return found;
}

/**
 * The one wording both callers, the build and the publish, use for an entry of
 * `findUnpublishableSpecifiers`.
 */
export function describeUnpublishable({section, name, specifier}) {
  if (specifier === '*') {
    return `${section}.${name} is "*", which lets in any version: the build replaces it by the version of a package under packages/ or in the root package.json and found neither`;
  }
  return `${section}.${name} is ${JSON.stringify(specifier)}, which resolves to no version range`;
}
