// `pnpm lookbook:assets [--only=<demo>,…] [--skip-render]`: regenerates the assets of the lookbook
// demos from the sources in this directory into `apps/lookbook/public/assets/<demo>/`.
//
// Needs no network and no ComfyUI: painted sources are committed under `<demo>/raw/`. Blender runs
// headless for the demo that renders 3D views (`--skip-render` reuses its render cache). No build
// or check of the repo runs this script; a change to an asset is a commit of the generator and of
// its output together. README.md in this directory documents every output.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {ASSETS_SRC, Output, REPO_ROOT} from './lib/output.mjs';

/** @typedef {{skipRender: boolean}} BuildOptions */
/** @typedef {(out: Output, opts: BuildOptions) => Promise<void> | void} Generator */

/** The demos, in build order; each has `<demo>/generate.mjs` exporting `generate`. */
const DEMOS = [
  'vector-balls',
  'sine-scroller',
  'platformer',
  'rope-bridge',
  'swaying-grass',
  'ui-panels',
  'boomer-shooter-corridor',
  'stage-masks',
];

function parseArgs() {
  const args = process.argv.slice(2);
  let only = DEMOS;
  let skipRender = false;
  for (const arg of args) {
    if (arg.startsWith('--only=')) {
      only = arg.slice('--only='.length).split(',').filter(Boolean);
      const unknown = only.filter((name) => !DEMOS.includes(name));
      if (unknown.length) throw new Error(`unknown demo ${unknown.join(', ')}; known are ${DEMOS.join(', ')}`);
    } else if (arg === '--skip-render') skipRender = true;
    else throw new Error(`unknown argument ${arg}; use --only=<demo>,… and --skip-render`);
  }
  return {only, skipRender};
}

async function main() {
  const {only, skipRender} = parseArgs();
  /** @type {string[]} */
  const written = [];
  for (const demo of DEMOS.filter((name) => only.includes(name))) {
    const started = performance.now();
    const module = /** @type {{generate: Generator}} */ (await import(`./${demo}/generate.mjs`));
    const out = new Output(demo);
    out.reset();
    await module.generate(out, {skipRender});
    written.push(...out.files);
    const bytes = out.files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(`${demo}: ${out.files.length} files, ${(bytes / 1024).toFixed(1)} KiB, ${seconds} s`);
  }
  const json = written.filter((file) => file.endsWith('.json'));
  if (json.length) {
    execFileSync(path.join(REPO_ROOT, 'node_modules/.bin/biome'), ['format', '--write', ...json], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
  }
  console.log(`done — outputs under ${path.relative(REPO_ROOT, path.join(ASSETS_SRC, '../public/assets'))}/`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
