import {parseArgs} from 'node:util';

export const USAGE = 'usage: node scripts/publishNpmPkg.mjs <package-dir> [--dry-run]';

/**
 * Reads the command line of publishNpmPkg.mjs: exactly one package directory and an
 * optional `--dry-run`. Anything else throws — an unknown option may be a misspelled
 * `--dry-run`, and a publish must not go ahead on a guess.
 *
 * @param {string[]} args
 * @returns {{packageDir: string, dryRun: boolean}}
 */
export function parseArguments(args) {
  const {tokens} = parseArgs({
    // `pnpm run <script> -- --dry-run` hands the `--` on to the script, and parseArgs
    // would take every argument after it for a positional
    args: args.filter((arg) => arg !== '--'),
    options: {'dry-run': {type: 'boolean'}},
    allowPositionals: true,
    // the refusal names an argument as it was written, `--dry-run=true` included, in the
    // same words under every Node line; strict mode would append a hint to put it behind a
    // `--`, which this script drops
    strict: false,
    tokens: true,
  });
  const positionals = [];
  let dryRun = false;
  for (const token of tokens) {
    if (token.kind === 'positional') {
      positionals.push(token.value);
    } else if (token.kind === 'option') {
      if (token.name !== 'dry-run' || token.inlineValue) {
        throw new Error(`unknown option: ${token.inlineValue ? `${token.rawName}=${token.value}` : token.rawName}`);
      }
      dryRun = true;
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
