import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import YAML from 'yaml';
import {findUnpublishableSpecifiers} from './makePackageJson/findUnpublishableSpecifiers.mjs';
import {removeDistPathPrefix} from './makePackageJson/removeDistPathPrefix.mjs';
import {resolveDependencies} from './makePackageJson/resolveDependencies.mjs';

const workspaceRoot = path.resolve(fileURLToPath(import.meta.url), '../../');
const projectRoot = path.resolve(process.cwd());

console.log('workspaceRoot:', workspaceRoot);
console.log('projectRoot:', projectRoot);

// every file the manifest is made from is input that can be wrong, and gets a message instead of a stack trace
function readInput(filePath, parse) {
  try {
    return parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`cannot read ${filePath}: ${error.message}`);
    process.exit(1);
  }
}

const packageJsonPath = path.resolve(projectRoot, 'package.json');
const inPackageJson = readInput(packageJsonPath, JSON.parse);

const sharedPackageJson = readInput(path.resolve(workspaceRoot, 'package.json'), JSON.parse);
const sharedDependencies = {...(sharedPackageJson.dependencies ?? {}), ...sharedPackageJson.devDependencies};

const pnpmWorkspaceConfig = readInput(path.resolve(workspaceRoot, 'pnpm-workspace.yaml'), YAML.parse);

const packageJsonOverridePath = path.resolve(projectRoot, 'package.override.json');
const packageJsonOverride = fs.existsSync(packageJsonOverridePath) ? readInput(packageJsonOverridePath, JSON.parse) : {};

const outPackageJson = {
  ...inPackageJson,
};

removeDistPathPrefix(outPackageJson);

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

const distDir = path.resolve(projectRoot, 'dist');
const releasePackageJsonPath = path.resolve(distDir, 'package.json');
// the manifest belongs next to the compiled library; a `dist/` holding nothing but a manifest
// would be a package without code, so the script does not create the directory itself
if (!fs.existsSync(distDir)) {
  console.error(`cannot write ${releasePackageJsonPath}: ${distDir} does not exist, compile the package first`);
  process.exit(1);
}
console.log('Write to', releasePackageJsonPath);
try {
  fs.writeFileSync(releasePackageJsonPath, JSON.stringify(outPackageJson, null, 2));
} catch (error) {
  console.error(`cannot write ${releasePackageJsonPath}: ${error.message}`);
  process.exit(1);
}
