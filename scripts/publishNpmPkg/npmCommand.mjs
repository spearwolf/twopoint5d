// letters, digits and _ @ . / - reach npm unchanged even through cmd.exe; quotes, spaces, % ^ & | < > ( ) ! do not
const PLAIN_ARGUMENT = /^[\w@./-]+$/;

/**
 * How to start `npm <args>` so that no shell reads anything into an argument. `npm` is started
 * directly, except on Windows: there it is `npm.cmd`, which Node starts only through `cmd.exe`,
 * so the command becomes a single string for the shell. An argument with any other character is
 * refused on every platform, so a run on Linux fails where Windows would interpret it.
 *
 * @param {string[]} args
 * @param {NodeJS.Platform} [platform]
 * @returns {{file: string, args: string[], options: {shell?: boolean}}}
 */
export function npmCommand(args, platform = process.platform) {
  for (const arg of args) {
    if (!PLAIN_ARGUMENT.test(arg)) {
      throw new Error(`refusing to pass ${JSON.stringify(arg)} to npm: an argument may hold only letters, digits and _ @ . / -`);
    }
  }
  if (platform === 'win32') {
    return {file: ['npm', ...args].join(' '), args: [], options: {shell: true}};
  }
  return {file: 'npm', args, options: {}};
}
