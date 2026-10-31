import {describeShowFailure, isNotPublishedError, parsePublishedVersions} from './publishedVersions.mjs';

/**
 * What the publish script does after it asked `npm show`: leave the package alone, publish it
 * (with a line to tell first), or stop with a message.
 *
 * @typedef {{action: 'skip', message: string, versions: string[]}
 *   | {action: 'publish', versions: string[]}
 *   | {action: 'publish', message: string}
 *   | {action: 'fail', message: string}} PublishDecision
 */

/**
 * A version marked as a development version, which no release publishes.
 *
 * @param {string} version
 * @returns {boolean}
 */
export function isDevelopmentVersion(version) {
  return version.endsWith('-dev');
}

/**
 * Which of skip, publish and fail an answer of `npm show . versions --json` means.
 *
 * @param {string} version the version in the manifest
 * @param {{error: (Error & {killed?: boolean}) | null, stdout: string, stderr: string}} answer
 *   what the `execFile` callback of `npm show` received
 * @returns {PublishDecision}
 */
export function decidePublish(version, {error, stdout, stderr}) {
  if (!error) {
    let versions;
    try {
      versions = parsePublishedVersions(stdout.trim());
    } catch (parseError) {
      return {
        action: 'fail',
        message: `npm show printed no version list: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      };
    }
    if (versions.includes(version)) {
      return {action: 'skip', message: `skip publishing, version ${version} is already released`, versions};
    }
    return {action: 'publish', versions};
  }
  // a killed npm has answered nothing, whatever it wrote before
  if (!error.killed && isNotPublishedError(stderr)) {
    return {action: 'publish', message: 'oh it looks like this is the first time to publish the package'};
  }
  return {action: 'fail', message: describeShowFailure(error, stderr)};
}

/**
 * The one line for `console.error` when `npm publish` failed. npm writes its own reason to the
 * console, so the line names only the exit code, or the message when npm never ran.
 *
 * @param {Error & {status?: number | null}} error
 * @returns {string}
 */
export function describePublishFailure(error) {
  return `npm publish failed: ${error.status != null ? `exit code ${error.status}` : error.message}`;
}
