export const USAGE = 'Usage: node scripts/publishNpmPkg.mjs <package-dir> [--dry-run]';

/**
 * Reads the command line of publishNpmPkg.mjs: exactly one package directory and an
 * optional `--dry-run`. Anything else throws — an unknown option may be a misspelled
 * `--dry-run`, and a publish must not go ahead on a guess.
 */
export function parseArguments(args) {
  const positionals = [];
  let dryRun = false;
  for (const arg of args) {
    if (arg === '--') {
      // `pnpm run <script> -- --dry-run` hands the `--` on to the script
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  if (positionals.length === 0) {
    throw new Error('missing <package-dir>');
  }
  if (positionals.length > 1) {
    throw new Error(`expected one <package-dir>, got ${positionals.length}: ${positionals.join(' ')}`);
  }
  return {packageDir: positionals[0], dryRun};
}
