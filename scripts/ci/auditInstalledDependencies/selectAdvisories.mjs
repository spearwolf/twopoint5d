export const BLOCKING_SEVERITIES = ['high', 'critical'];

/**
 * The id `pnpm audit --json` writes at the start of a path for the project in `dir`: `.` for the
 * workspace root, otherwise the directory with `__` in place of every `/`.
 *
 * @param {string} dir a project directory relative to the workspace root
 * @returns {string}
 */
export function importerId(dir) {
  return dir === '.' ? '.' : dir.replaceAll('/', '__');
}

/**
 * @typedef {{
 *   severity: string,
 *   module: string,
 *   vulnerableVersions: string,
 *   title: string,
 *   url: string,
 *   path: string,
 * }} BlockingAdvisory
 */

/**
 * The high and critical advisories of a `pnpm audit --json` report that are reached from one of
 * the given projects. pnpm audit reads the whole lockfile and takes no filter, so this is the
 * filter: the first segment of every path in `findings` names the project the path starts at.
 *
 * The report holds `advisories`, an object by advisory id; each advisory has `module_name`,
 * `severity`, `title`, `url`, `vulnerable_versions` and `findings: [{version, paths}]`.
 *
 * @param {unknown} report the parsed output of `pnpm audit --json`
 * @param {string[]} importers project ids as `importerId()` writes them
 * @returns {BlockingAdvisory[]} critical before high, then by module
 */
export function selectAdvisories(report, importers) {
  const advisories = /** @type {{advisories?: unknown} | null} */ (report)?.advisories;
  if (
    typeof report !== 'object' ||
    report === null ||
    typeof advisories !== 'object' ||
    advisories === null ||
    Array.isArray(advisories)
  ) {
    throw new Error('it holds no "advisories" object, so it is no report of pnpm audit');
  }

  /** @type {BlockingAdvisory[]} */
  const selected = [];
  for (const advisory of Object.values(advisories)) {
    if (!BLOCKING_SEVERITIES.includes(advisory.severity)) continue;
    const paths = (advisory.findings ?? []).flatMap((finding) => finding.paths ?? []);
    // the exact id: `packages__twopoint5d-testing` is no `packages__twopoint5d`
    const reached = paths.find((candidate) => importers.includes(candidate.split('>')[0]));
    if (reached === undefined) continue;
    selected.push({
      severity: advisory.severity,
      module: advisory.module_name,
      vulnerableVersions: advisory.vulnerable_versions,
      title: advisory.title,
      url: advisory.url,
      path: reached,
    });
  }

  const rank = (severity) => BLOCKING_SEVERITIES.indexOf(severity);
  return selected.sort((a, b) => rank(b.severity) - rank(a.severity) || a.module.localeCompare(b.module));
}
