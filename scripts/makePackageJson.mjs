import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const workspaceRoot = path.resolve(fileURLToPath(import.meta.url), '../../');
const projectRoot = path.resolve(process.cwd());

console.log('workspaceRoot:', workspaceRoot);
console.log('projectRoot:', projectRoot);

const packageJsonPath = path.resolve(projectRoot, 'package.json');
const inPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const outPackageJson = {
  ...inPackageJson,
};

['scripts', 'devDependencies', 'rollup', 'nx', 'prettier', 'jest'].forEach((key) => {
  if (key in outPackageJson) {
    delete outPackageJson[key];
  }
});

[[outPackageJson, ['main', 'module', 'types']], [outPackageJson.exports]].forEach(remmoveDistPathPrefix);

resolveDependencies(outPackageJson.dependencies);
resolveDependencies(outPackageJson.peerDependencies);

const releasePackageJsonPath = path.resolve(projectRoot, 'dist/package.json');
console.log('Write to', releasePackageJsonPath);
fs.writeFileSync(releasePackageJsonPath, JSON.stringify(outPackageJson, null, 2));

// --------------------------------------------------------------------------------------------

function resolveDependencies(dependenciesSection) {
  if (dependenciesSection) {
    Object.entries(dependenciesSection).forEach(([depName, version]) => {
      if (version.startsWith('workspace:') || version === '*') {
        const pkgVersion = resolvePackageVersion(depName);
        if (pkgVersion) {
          dependenciesSection[depName] = pkgVersion;
        }
      }
    });
  }
}

function resolvePackageVersion(pkgName) {
  const pkgNameWithoutScope = pkgName.replace(/^@[^/]+\//, '');
  const pkgJsonPath = path.resolve(workspaceRoot, `packages/${pkgNameWithoutScope}/package.json`);
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const pkgVersion = `^${pkgJson.version.replace(/-dev$/, '')}`;
    console.log('resolve package version', pkgName, '->', pkgVersion);
    return pkgVersion;
  } else {
    console.warn(
      'oops.. workspace package not found:',
      pkgName,
      '->',
      pkgNameWithoutScope,
      'referenced from:',
      inPackageJson.name,
    );
  }
  return undefined;
}

// --------------------------------------------------------------------------------------------

function remmoveDistPathPrefix([section, keys]) {
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
