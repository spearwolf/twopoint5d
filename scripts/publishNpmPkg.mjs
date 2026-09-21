import {execFile, execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkManifest} from './publishNpmPkg/checkManifest.mjs';
import {npmCommand} from './publishNpmPkg/npmCommand.mjs';
import {USAGE, parseArguments} from './publishNpmPkg/parseArguments.mjs';
import {isNotPublishedError, parsePublishedVersions} from './publishNpmPkg/publishedVersions.mjs';

let args;
try {
  args = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  console.error(USAGE);
  process.exit(1);
}

const DRY_RUN = args.dryRun;

const workspaceRoot = path.resolve(fileURLToPath(import.meta.url), '../../');
const projectRoot = path.resolve(process.cwd());
const packageRoot = path.resolve(projectRoot, args.packageDir);
const manifestPath = path.resolve(packageRoot, 'package.json');

let pkgJson;
try {
  pkgJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  checkManifest(pkgJson);
} catch (error) {
  console.error(`cannot publish ${manifestPath}: ${error.message}`);
  process.exit(1);
}

console.log('workspaceRoot:', workspaceRoot);
console.log('projectRoot:', projectRoot);
console.log('packageRoot:', packageRoot);
console.log('dryRun:', DRY_RUN ? 'yes' : 'no');
console.log('packageJson: ---');
console.dir(pkgJson);

if (pkgJson.version.endsWith('-dev')) {
  console.warn('skip publishing, version', pkgJson.version, 'is marked as a *development* version');
  process.exit(0);
}

// `.` because npm reads the name from the manifest in `packageRoot`, the one `npm publish` reads
// there, and no value from the manifest ends up on a command line
const show = npmCommand(['show', '.', 'versions', '--json']);

execFile(show.file, show.args, {...show.options, cwd: packageRoot}, (error, stdout, stderr) => {
  if (!error) {
    let versions;
    try {
      versions = parsePublishedVersions(stdout.trim());
    } catch (parseError) {
      console.error(`npm show printed no version list: ${parseError.message}`);
      process.exit(1);
    }
    console.log('already published versions: ---');
    console.dir(versions);

    if (versions.includes(pkgJson.version)) {
      console.warn('skip publishing, version', pkgJson.version, 'is already released');
      process.exit(0);
    } else {
      publishPackage(packageRoot);
    }
  } else if (isNotPublishedError(stderr)) {
    console.log('oh it looks like this is the first time to publish the package');
    publishPackage(packageRoot);
  } else {
    // npm gives its reason on stderr; when npm could not be started at all, stderr is empty and
    // `error.message` names the cause (`spawn npm ENOENT`)
    console.error(`npm show failed: ${stderr.trim() || error.message}`);
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

  const publish = npmCommand(['publish', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])]);
  // npm writes straight to the console — the published version on success, the reason on failure —
  // so the message of our own names only the exit code
  try {
    execFileSync(publish.file, publish.args, {...publish.options, cwd, stdio: 'inherit'});
  } catch (error) {
    console.error(`npm publish failed: ${error.status != null ? `exit code ${error.status}` : error.message}`);
    process.exit(1);
  }

  process.exit(0);
}

function copyFile(src, dst) {
  if (fs.existsSync(src)) {
    try {
      fs.copyFileSync(src, dst);
    } catch (error) {
      console.error(`cannot copy ${src} to ${dst}: ${error.message}`);
      process.exit(1);
    }
  }
}
