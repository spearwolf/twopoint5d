// The constants, the flags and the helpers of `pnpm lookbook:generate-previews` that need no
// browser, apart from the run itself so a spec can import them.
import {parseArgs} from 'node:util';

// the lookbook cannot hand a TypeScript constant to a Node script; demoPreviewConfig.test.mjs
// holds this one equal to EVENT_GENERATE_PREVIEW in apps/lookbook/src/components/constants.ts
export const EVENT_GENERATE_PREVIEW = 'lookbook.generatePreview';

// the card shows its image in an aspect-10/7 box (apps/lookbook/src/components/Card.astro),
// up to about 450 CSS pixels wide, twice that on a high-density screen
export const PREVIEW_WIDTH = 1000;
export const PREVIEW_HEIGHT = 700;
export const PREVIEW_QUALITY = 85;

export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The launch arguments that give Playwright's Chromium a WebGPU adapter. On Linux the headless
 * shell finds one only through Vulkan, and falls back to WebGL 2 on SwiftShader without it.
 * macOS and Windows have no Vulkan backend: Chromium picks Metal or D3D there by itself, and a
 * forced Vulkan ends in software rendering, with another look.
 *
 * @param {string} [platform] a value of `process.platform`
 * @returns {string[]}
 */
export function chromiumGpuArgs(platform = process.platform) {
  const args = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'];
  if (platform === 'linux') args.push('--enable-features=Vulkan', '--use-angle=vulkan');
  return args;
}

/** @typedef {{id: string, ok: boolean, trigger?: string, seconds: number, kilobytes?: number, problems: string[]}} DemoResult */

/**
 * @param {string[]} argv the arguments after the script name
 * @returns {{only: string[] | undefined, url: string | undefined, headed: boolean, timeoutMs: number, strict: boolean}}
 */
export function parsePreviewArgs(argv) {
  const {values} = parseArgs({
    args: argv,
    options: {
      only: {type: 'string'},
      url: {type: 'string'},
      headed: {type: 'boolean', default: false},
      timeout: {type: 'string'},
      strict: {type: 'boolean', default: false},
    },
    strict: true,
    allowPositionals: false,
  });

  const timeoutMs = values.timeout === undefined ? DEFAULT_TIMEOUT_MS : Number(values.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`--timeout: expected a positive whole number of milliseconds, got ${JSON.stringify(values.timeout)}`);
  }

  return {
    only: values.only
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    url: values.url?.replace(/\/+$/, ''),
    headed: values.headed ?? false,
    timeoutMs,
    strict: values.strict ?? false,
  };
}

/**
 * @param {string[]} ids every demo, in the order of the run
 * @param {string[] | undefined} only the ids of `--only`
 * @returns {string[]}
 */
export function selectDemos(ids, only) {
  if (!only) return [...ids];
  const known = new Set(ids);
  const unknown = only.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`unknown demo id(s): ${unknown.join(', ')} — known: ${ids.join(', ')}`);
  }
  return ids.filter((id) => only.includes(id));
}

/**
 * Why the screenshot of a demo is not written, or undefined when it is.
 * @param {{pageErrors: number, consoleErrors: number}} counts what the page reported up to the screenshot
 * @param {boolean} strict `--strict`: a console error fails the demo as well
 * @returns {string | undefined}
 */
export function refuseScreenshot({pageErrors, consoleErrors}, strict) {
  if (pageErrors > 0) return `the page threw ${pageErrors} error(s)`;
  if (strict && consoleErrors > 0) return `the page logged ${consoleErrors} console error(s) under --strict`;
  return undefined;
}

/**
 * The closing lines of a run and its exit code: 1 when a demo failed.
 * @param {DemoResult[]} results
 * @returns {{summary: string, exitCode: 0 | 1}}
 */
export function summarizeRun(results) {
  const failed = results.filter(({ok}) => !ok).map(({id}) => id);
  // without --strict, the problems of a demo that passed are its console errors
  const noisy = results.filter(({ok, problems}) => ok && problems.length > 0).map(({id}) => id);
  const lines = [
    failed.length === 0
      ? `${results.length} preview(s) written`
      : `${failed.length} of ${results.length} failed, their old images stay: ${failed.join(', ')}`,
  ];
  if (noisy.length > 0) {
    lines.push(`${noisy.length} written with console errors, --strict fails them: ${noisy.join(', ')}`);
  }
  return {summary: lines.join('\n'), exitCode: failed.length === 0 ? 0 : 1};
}

/**
 * Installed with page.addInitScript() before any script of the page runs: records the first
 * EVENT_GENERATE_PREVIEW as window.__lookbookPreview. Playwright sends the function as its
 * source, so it uses nothing but its argument and the globals of the page.
 * @param {string} eventName
 */
export function recordPreviewEvent(eventName) {
  document.addEventListener(eventName, (event) => {
    const w = /** @type {any} */ (window);
    // wrapped: the generator waits for a truthy value, and an event may come without a detail
    w.__lookbookPreview ??= {detail: /** @type {CustomEvent} */ (event).detail ?? null};
  });
}
