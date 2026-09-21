import fs from 'node:fs';
import path from 'node:path';
import {validRange} from 'semver';

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

  // whitespace around the range belongs to no version range; every check below and the
  // manifest see the trimmed value
  const range = specifier.startsWith('workspace:') ? specifier.slice('workspace:'.length).trim() : '*';
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

  if (range !== '*' && range !== '^' && range !== '~') {
    // a spelled-out range names the version it wants; the package under packages/ only
    // supplies one for `*`, `^` and `~`, so it is not looked up for this one
    // semver's validRange('') answers '*', so the empty range needs a check of its own
    if (range === '' || validRange(range) == null) {
      // anything else would go into the published manifest as a version range and is none —
      // the specifier stays and the manifest check refuses it
      console.warn(
        'oops.. workspace range is not a version range:',
        pkgName,
        '->',
        specifier,
        'referenced from:',
        referencedFrom,
      );
      return undefined;
    }
    // the range ships as written: validRange only vouches for it, and its normalized form
    // (`^1` becomes `>=1.0.0 <2.0.0-0`) is not what the manifest says
    console.log('resolve package version', pkgName, '->', range);
    return range;
  }

  const pkgNameWithoutScope = pkgName.replace(/^@[^/]+\//, '');
  const pkgJsonPath = path.resolve(workspaceRoot, `packages/${pkgNameWithoutScope}/package.json`);

  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const version = pkgJson.version.replace(/-dev$/, '');
    const pkgVersion = range === '*' ? `^${version}` : `${range}${version}`;
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
