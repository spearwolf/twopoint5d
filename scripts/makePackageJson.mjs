import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import YAML from 'yaml';
import {findUnpublishableSpecifiers} from './makePackageJson/findUnpublishableSpecifiers.mjs';
import {resolveDependencies} from './makePackageJson/resolveDependencies.mjs';

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

const context = {workspaceRoot, pnpmWorkspaceConfig, sharedDependencies, referencedFrom: inPackageJson.name};

resolveDependencies(outPackageJson.dependencies, context);
resolveDependencies(outPackageJson.devDependencies, context);
resolveDependencies(outPackageJson.peerDependencies, context);
resolveDependencies(outPackageJson.optionalDependencies, context);

for (const [key, value] of Object.entries(packageJsonOverride)) {
  if (value == null) {
    delete outPackageJson[key];
  } else {
    outPackageJson[key] = value;
  }
}

// a manifest that still names a pnpm protocol cannot be installed from npm
const unpublishable = findUnpublishableSpecifiers(outPackageJson);
if (unpublishable.length > 0) {
  for (const {section, name, specifier} of unpublishable) {
    console.error(
      `cannot publish ${inPackageJson.name}: ${section}.${name} is "${specifier}", which resolves to no version range`,
    );
  }
  process.exit(1);
}

const releasePackageJsonPath = path.resolve(projectRoot, 'dist/package.json');
console.log('Write to', releasePackageJsonPath);
fs.writeFileSync(releasePackageJsonPath, JSON.stringify(outPackageJson, null, 2));

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
