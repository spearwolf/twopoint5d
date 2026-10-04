// The constants and the flags of `pnpm lookbook:generate-previews`, apart from the run
// itself so a spec can import them.
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

// without these, the headless shell of Playwright's Chromium finds no WebGPU adapter on Linux
// and three.js falls back to WebGL 2 on SwiftShader; with them it gets the hardware adapter
export const CHROMIUM_GPU_ARGS = [
  '--enable-unsafe-webgpu',
  '--ignore-gpu-blocklist',
  '--enable-features=Vulkan',
  '--use-angle=vulkan',
];

/**
 * @param {string[]} argv the arguments after the script name
 * @returns {{only: string[] | undefined, url: string | undefined, headed: boolean, timeoutMs: number}}
 */
export function parsePreviewArgs(argv) {
  const {values} = parseArgs({
    args: argv,
    options: {
      only: {type: 'string'},
      url: {type: 'string'},
      headed: {type: 'boolean', default: false},
      timeout: {type: 'string'},
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
