/**
 * `npm show <name> versions --json` answers with a list, or with a bare string when
 * exactly one version is published. Either way this returns the list.
 */
export function parsePublishedVersions(stdout) {
  return [].concat(JSON.parse(stdout));
}

/**
 * Whether a failed `npm show` means the package was never published. Older npm
 * releases write `npm ERR! code E404`, current ones `npm error code E404` — the
 * error code is what both share.
 */
export function isNotPublishedError(stderr) {
  return /\bE404\b/.test(String(stderr ?? ''));
}
