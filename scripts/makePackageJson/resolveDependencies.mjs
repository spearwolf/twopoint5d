import fs from 'node:fs';
import path from 'node:path';

/**
 * Replaces the `catalog:`, `workspace:` and `*` specifiers of a dependency section by the
 * version ranges they stand for. A specifier nothing resolves stays as it is.
 */
export function resolveDependencies(dependenciesSection, context) {
  if (dependenciesSection) {
    Object.entries(dependenciesSection).forEach(([depName, specifier]) => {
      if (specifier.startsWith('catalog:') || specifier.startsWith('workspace:') || specifier === '*') {
        const pkgVersion = resolvePackageVersion(depName, specifier, context);
        if (pkgVersion) {
          dependenciesSection[depName] = pkgVersion;
        }
      }
    });
  }
}

export function resolvePackageVersion(
  pkgName,
  specifier,
  {workspaceRoot, pnpmWorkspaceConfig, sharedDependencies, referencedFrom},
) {
  if (specifier.startsWith('catalog:')) {
    const catalogName = specifier.slice('catalog:'.length) || 'default';
    const pkgVersion =
      catalogName === 'default'
        ? (pnpmWorkspaceConfig.catalog?.[pkgName] ?? pnpmWorkspaceConfig.catalogs?.default?.[pkgName])
        : pnpmWorkspaceConfig.catalogs?.[catalogName]?.[pkgName];
    if (pkgVersion) {
      console.log('resolve package version from workspace catalog', catalogName, pkgName, '->', pkgVersion);
      return pkgVersion;
    }

    // a range from any other source is one pnpm never installed, so the specifier stays
    // and the manifest check refuses it
    console.warn('oops.. package not found in workspace catalog:', catalogName, pkgName, 'referenced from:', referencedFrom);
    return undefined;
  }

  const range = specifier.startsWith('workspace:') ? specifier.slice('workspace:'.length) : '*';
  if (range.includes('@')) {
    // `workspace:<name>@<range>` names another package than its key, which this script does not map
    console.warn(
      'oops.. aliased workspace package is not supported:',
      pkgName,
      '->',
      specifier,
      'referenced from:',
      referencedFrom,
    );
    return undefined;
  }

  const pkgNameWithoutScope = pkgName.replace(/^@[^/]+\//, '');
  const pkgJsonPath = path.resolve(workspaceRoot, `packages/${pkgNameWithoutScope}/package.json`);

  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const version = pkgJson.version.replace(/-dev$/, '');
    const pkgVersion = range === '*' ? `^${version}` : range === '^' || range === '~' ? `${range}${version}` : range;
    console.log('resolve package version', pkgName, '->', pkgVersion);
    return pkgVersion;
  }

  const pkgVersion = sharedDependencies[pkgName];
  if (pkgVersion && !pkgVersion.startsWith('workspace:')) {
    console.log('resolve shared package version', pkgName, '->', pkgVersion);
    return pkgVersion;
  }

  console.warn('oops.. workspace package not found:', pkgName, '->', pkgNameWithoutScope, 'referenced from:', referencedFrom);
  return undefined;
}
