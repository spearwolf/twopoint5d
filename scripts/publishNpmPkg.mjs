import {execFile, execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkManifest} from './publishNpmPkg/checkManifest.mjs';
import {npmCommand} from './publishNpmPkg/npmCommand.mjs';
import {USAGE, parseArguments} from './publishNpmPkg/parseArguments.mjs';
import {decidePublish, describePublishFailure, isDevelopmentVersion} from './publishNpmPkg/publishDecision.mjs';
import {NPM_SHOW_TIMEOUT_MS} from './publishNpmPkg/publishedVersions.mjs';
import {registryEnvironment} from './publishNpmPkg/registryEnvironment.mjs';
import {releaseFiles} from './publishNpmPkg/releaseFiles.mjs';

let args;
try {
  args = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
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
  console.error(`cannot publish ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

console.log('workspaceRoot:', workspaceRoot);
console.log('projectRoot:', projectRoot);
console.log('packageRoot:', packageRoot);
console.log('dryRun:', DRY_RUN ? 'yes' : 'no');
console.log('packageJson: ---');
console.dir(pkgJson);

if (isDevelopmentVersion(pkgJson.version)) {
  console.warn('skip publishing, version', pkgJson.version, 'is marked as a *development* version');
  process.exit(0);
}

// the release files go into the package directory before npm is asked anything, so that
// `npm show` and `npm publish` read the same `.npmrc`
let files;
try {
  files = releaseFiles({workspaceRoot, projectRoot, packageRoot});
} catch (error) {
  console.error(`cannot publish ${packageRoot}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
for (const {src, dst} of files) {
  copyFile(src, dst);
}

// `.` because npm reads the name from the manifest in `packageRoot`, the one
// `npm publish` reads there, and no value from the manifest ends up on a command line
const show = npmCommand(['show', '.', 'versions', '--json']);

const showOptions = {
  ...show.options,
  cwd: packageRoot,
  timeout: NPM_SHOW_TIMEOUT_MS,
  env: registryEnvironment(pkgJson),
};

execFile(show.file, show.args, showOptions, (error, stdout, stderr) => {
  const decision = decidePublish(pkgJson.version, {error, stdout, stderr});
  if (decision.action !== 'fail' && 'versions' in decision) {
    console.log('already published versions: ---');
    console.dir(decision.versions);
  }
  if (decision.action === 'skip') {
    console.warn(decision.message);
    process.exit(0);
  } else if (decision.action === 'publish') {
    if ('message' in decision) console.log(decision.message);
    publishPackage(packageRoot);
  } else {
    console.error(decision.message);
    process.exit(1);
  }
});

function publishPackage(cwd, dryRun = DRY_RUN) {
  const publish = npmCommand(['publish', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])]);
  // npm writes straight to the console — the published version on success, the reason
  // on failure — so the message of our own names only the exit code
  try {
    execFileSync(publish.file, publish.args, {...publish.options, cwd, stdio: 'inherit'});
  } catch (error) {
    // the try holds nothing but the call of execFileSync, which throws an Error with the
    // exit status
    const failure = /** @type {Error & {status?: number | null}} */ (error);
    console.error(describePublishFailure(failure));
    process.exit(1);
  }

  process.exit(0);
}

function copyFile(src, dst) {
  try {
    fs.copyFileSync(src, dst);
  } catch (error) {
    console.error(`cannot copy ${src} to ${dst}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
