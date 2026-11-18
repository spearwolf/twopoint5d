import fs from 'node:fs';
import path from 'node:path';
import {valid, validRange} from 'semver';

/**
 * Replaces the `catalog:`, `workspace:` and `*` specifiers of a dependency section by the
 * version ranges they stand for. A specifier nothing resolves stays as it is, and
 * `findUnpublishableSpecifiers` refuses it, a bare `*` included.
 */
export function resolveDependencies(dependenciesSection, context) {
  if (dependenciesSection) {
    Object.entries(dependenciesSection).forEach(([depName, specifier]) => {
      // a manifest is JSON, so a value may be `null`, a number or an object; it stays
      // as it is, and the manifest check refuses it
      if (typeof specifier !== 'string') {
        console.warn(
          `makePackageJson: ${context.referencedFrom} gives ${depName} the specifier ${JSON.stringify(specifier)}, which is no string`,
        );
        return;
      }
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
    console.warn(
      `makePackageJson: the workspace catalog ${catalogName} has no entry for ${pkgName}, which ${referencedFrom} takes from it`,
    );
    return undefined;
  }

  // trimmed because a spelled-out range goes into the manifest as it stands: whitespace
  // around it would land in the published manifest verbatim, and a range of nothing but
  // whitespace would pass as `*` (semver's validRange(' ') answers '*'). Every check
  // below and the manifest see the trimmed value
  const range = specifier.startsWith('workspace:') ? specifier.slice('workspace:'.length).trim() : '*';
  if (range.includes('@')) {
    // `workspace:<name>@<range>` names another package than its key, which this script
    // does not map
    console.warn(
      `makePackageJson: ${referencedFrom} names ${pkgName} as ${specifier}, an aliased workspace package, which this script does not map`,
    );
    return undefined;
  }

  if (range !== '*' && range !== '^' && range !== '~') {
    // a spelled-out range names the version it wants; the package under packages/ only
    // supplies one for `*`, `^` and `~`, so it is not looked up for this one
    // semver's validRange('') answers '*', so the empty range needs a check of its own
    if (range === '' || validRange(range) == null) {
      // anything else would go into the published manifest as a version range and
      // is none — the specifier stays and the manifest check refuses it
      console.warn(`makePackageJson: ${referencedFrom} names ${pkgName} as ${specifier}, which holds no version range`);
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
    // the package under packages/ is the one pnpm links, so its manifest is the only
    // source of the version; without a readable one the specifier stays and the manifest
    // check refuses it, and sharedDependencies does not stand in for it
    let pkgJson;
    try {
      pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    } catch (error) {
      console.warn(
        `makePackageJson: cannot read ${pkgJsonPath}, the workspace package ${pkgName} that ${referencedFrom} names: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }

    const version = typeof pkgJson?.version === 'string' ? pkgJson.version.replace(/-dev$/, '') : undefined;
    if (valid(version) == null) {
      console.warn(
        `makePackageJson: ${pkgJsonPath}, the workspace package ${pkgName} that ${referencedFrom} names, has no version semver can read`,
      );
      return undefined;
    }

    const pkgVersion = range === '*' ? `^${version}` : `${range}${version}`;
    console.log('resolve package version', pkgName, '->', pkgVersion);
    return pkgVersion;
  }

  const pkgVersion = sharedDependencies[pkgName];
  if (typeof pkgVersion === 'string' && pkgVersion && !pkgVersion.startsWith('workspace:')) {
    console.log('resolve shared package version', pkgName, '->', pkgVersion);
    return pkgVersion;
  }

  console.warn(
    `makePackageJson: ${referencedFrom} names ${pkgName} as ${specifier}, and neither packages/${pkgNameWithoutScope} nor the root package.json provides it`,
  );
  return undefined;
}
