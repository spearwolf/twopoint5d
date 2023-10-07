import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exec, execSync} from 'node:child_process';

const DRY_RUN = false || process.argv.includes('--dry-run');

const workspaceRoot = path.resolve(fileURLToPath(import.meta.url), '../../');
const projectRoot = path.resolve(process.cwd());
const packageRoot = path.resolve(projectRoot, process.argv[2]);
const pkgJson = JSON.parse(fs.readFileSync(path.resolve(packageRoot, 'package.json'), 'utf8'));

console.log('workspaceRoot:', workspaceRoot);
console.log('projectRoot:', projectRoot);
console.log('packageRoot:', packageRoot);
console.log('dryRun:', DRY_RUN ? 'yes' : 'no');
console.log('env: ---');
console.log(' - NPM_TOKEN:', process.env.NPM_TOKEN ? `${process.env.NPM_TOKEN.substring(0, 6)}...` : 'unset');
console.log(' - NODE_AUTH_TOKEN:', process.env.NODE_AUTH_TOKEN ? `${process.env.NODE_AUTH_TOKEN.substring(0, 6)}...` : 'unset');
console.log('packageJson: ---');
console.dir(pkgJson);

if (pkgJson.version.endsWith('-dev')) {
  console.warn('skip publishing, version', pkgJson.version, 'is marked as a *development* version');
  process.exit(0);
}

exec(`npm show ${pkgJson.name} versions --json`, (error, stdout, stderr) => {
  if (!error) {
    const versions = JSON.parse(stdout);
    console.log('already published versions: ---');
    console.dir(versions);

    if (versions.includes(pkgJson.version)) {
      console.warn('skip publishing, version', pkgJson.version, 'is already released');
      process.exit(0);
    } else {
      publishPackage(packageRoot);
    }
  } else if (stderr && stderr.toString().includes('npm ERR! code E404')) {
    console.log('oh it looks like this is the first time to publish the package');
    publishPackage(packageRoot);
  } else {
    console.error(`exec() panic: ${stderr}`);
    process.exit(1);
  }
});

function publishPackage(cwd, dryRun = DRY_RUN) {
  copyFile(path.resolve(workspaceRoot, '.npmrc'), path.resolve(cwd, '.npmrc'));
  copyFile(path.resolve(workspaceRoot, 'LICENSE'), path.resolve(cwd, 'LICENSE'));
  copyFile(path.resolve(projectRoot, 'CHANGELOG.md'), path.resolve(cwd, 'CHANGELOG.md'));

  const readmePkgPath = path.resolve(projectRoot, 'README-pkg.md');
  const readmeDstPath = path.resolve(cwd, 'README.md');
  if (fs.existsSync(readmePkgPath)) {
    copyFile(readmePkgPath, readmeDstPath);
  } else {
    copyFile(path.resolve(projectRoot, 'README.md'), readmeDstPath);
  }

  execSync(`npm publish --access public${dryRun ? ' --dry-run' : ''}`, {cwd});

  process.exit(0);
}

function copyFile(src, dst) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
  }
}
