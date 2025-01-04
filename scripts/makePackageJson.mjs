import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import YAML from 'yaml';

const workspaceRoot = path.resolve(fileURLToPath(import.meta.url), '../../');
const projectRoot = path.resolve(process.cwd());

console.log('workspaceRoot:', workspaceRoot);
console.log('projectRoot:', projectRoot);

const packageJsonPath = path.resolve(projectRoot, 'package.json');
const inPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const sharedPackageJson = JSON.parse(fs.readFileSync(path.resolve(workspaceRoot, 'package.json'), 'utf8'));
const sharedDependencies = {...(sharedPackageJson.dependencies ?? {}), ...sharedPackageJson.devDependencies};

const pnpmWorkspaceConfig = YAML.parse(fs.readFileSync(path.resolve(workspaceRoot, 'pnpm-workspace.yaml'), 'utf8'));

const packageJsonOverridePath = path.resolve(projectRoot, 'package.override.json');
const packageJsonOverride = fs.existsSync(packageJsonOverridePath)
  ? JSON.parse(fs.readFileSync(packageJsonOverridePath, 'utf8'))
  : {};

const outPackageJson = {
  ...inPackageJson,
};

[[outPackageJson, ['main', 'module', 'types']], [outPackageJson.exports]].forEach(removeDistPathPrefix);

resolveDependencies(outPackageJson.dependencies);
resolveDependencies(outPackageJson.devDependencies);
resolveDependencies(outPackageJson.peerDependencies);

for (const [key, value] of Object.entries(packageJsonOverride)) {
  if (value == null) {
    delete outPackageJson[key];
  } else {
    outPackageJson[key] = value;
  }
}

const releasePackageJsonPath = path.resolve(projectRoot, 'dist/package.json');
console.log('Write to', releasePackageJsonPath);
fs.writeFileSync(releasePackageJsonPath, JSON.stringify(outPackageJson, null, 2));

// --------------------------------------------------------------------------------------------

function resolveDependencies(dependenciesSection) {
  if (dependenciesSection) {
    Object.entries(dependenciesSection).forEach(([depName, version]) => {
      const isCatalog = version.startsWith('catalog:');
      if (isCatalog || version.startsWith('workspace:') || version === '*') {
        const pkgVersion = resolvePackageVersion(depName, isCatalog);
        if (pkgVersion) {
          dependenciesSection[depName] = pkgVersion;
        }
      }
    });
  }
}

function resolvePackageVersion(pkgName, isCatalog) {
  if (isCatalog) {
    const pkgVersion = pnpmWorkspaceConfig.catalog[pkgName];
    if (pkgVersion) {
      console.log('resolve package version from workspace catalog', pkgName, '->', pkgVersion);
      return pkgVersion;
    }
  }

  const pkgNameWithoutScope = pkgName.replace(/^@[^/]+\//, '');
  const pkgJsonPath = path.resolve(workspaceRoot, `packages/${pkgNameWithoutScope}/package.json`);

  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const pkgVersion = `^${pkgJson.version.replace(/-dev$/, '')}`;
    console.log('resolve package version', pkgName, '->', pkgVersion);
    return pkgVersion;
  }

  const pkgVersion = sharedDependencies[pkgName];
  if (pkgVersion && !pkgVersion.startsWith('workspace:')) {
    console.log('resolve shared package version', pkgName, '->', pkgVersion);
    return pkgVersion;
  }

  console.warn('oops.. workspace package not found:', pkgName, '->', pkgNameWithoutScope, 'referenced from:', inPackageJson.name);
  return undefined;
}

// --------------------------------------------------------------------------------------------

function removeDistPathPrefix([section, keys]) {
  if (keys) {
    keys.forEach((key) => {
      removePathPrefixAt(section, key);
    });
  } else {
    const replaceAllPropValues = (obj) => {
      Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === 'string') {
          removePathPrefixAt(obj, key);
        } else if (typeof obj[key] === 'object') {
          replaceAllPropValues(obj[key]);
        }
      });
    };
    replaceAllPropValues(section);
  }
}

function removePathPrefixAt(section, key, prefix = 'dist/') {
  if (section[key]) {
    section[key] = section[key].replace(prefix, '');
  }
}
