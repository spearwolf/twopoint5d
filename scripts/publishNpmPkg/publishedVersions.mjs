/**
 * `npm show . versions --json`, asked in the package directory, answers with a
 * list, or with a bare string when exactly one version is published. Either way
 * this returns the list.
 *
 * @param {string} stdout
 * @returns {string[]}
 */
export function parsePublishedVersions(stdout) {
  return /** @type {string[]} */ ([]).concat(JSON.parse(stdout));
}

/**
 * Whether a failed `npm show` means the package was never published. Older npm
 * releases write `npm ERR! code E404`, current ones `npm error code E404` — the
 * error code is what both share.
 */
export function isNotPublishedError(stderr) {
  return /\bE404\b/.test(String(stderr ?? ''));
}

// the publish job of the deploy has 10 minutes; a registry that hangs should end the script with
// a line of its own, not at the limit of the workflow
export const NPM_SHOW_TIMEOUT_MS = 60_000;

/**
 * The one line for `console.error` when `npm show` failed for any reason but a package that was
 * never published. npm gives its reason on stderr; when npm could not be started at all, stderr
 * is empty and `error.message` names the cause (`spawn npm ENOENT`). A killed npm gave no reason.
 *
 * @param {Error & {killed?: boolean}} error
 * @param {string | undefined} stderr
 * @returns {string}
 */
export function describeShowFailure(error, stderr) {
  if (error.killed === true) {
    return `npm show did not answer within ${NPM_SHOW_TIMEOUT_MS / 1000} s`;
  }
  return `npm show failed: ${String(stderr ?? '').trim() || error.message}`;
}
