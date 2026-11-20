// Builds kitchen.aseprite with kitchen.lua and exports it with the Aseprite CLI, as the guide tells
// a user to (docs/stage-art.md), into the two fixtures next to this file (see README.md):
//
//   ASEPRITE=<path to the Aseprite binary> node packages/twopoint5d/src/stage-art/fixtures/export.mjs
//
// - kitchen-aseprite.json — with --ignore-empty: the cels without a pixel left out
// - kitchen-aseprite-empty-cels.json — without it: such a cel as an entry of 1 × 1
//
// The binary is the one ASEPRITE names, else `aseprite` on the PATH. The sheet itself, kitchen.png,
// is written to a directory of its own and dropped: the specs read the json only.
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const aseprite = process.env.ASEPRITE || 'aseprite';

const run = (args, cwd) => {
  const result = spawnSync(aseprite, args, {cwd, encoding: 'utf8'});
  if (result.error?.code === 'ENOENT') {
    console.error(
      `export.mjs: no Aseprite binary at ${JSON.stringify(aseprite)} — set ASEPRITE to the path of the Aseprite binary, or put \`aseprite\` on the PATH`,
    );
    process.exit(1);
  }
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    console.error(`export.mjs: ${aseprite} ${args.join(' ')} exited with ${result.status}\n${result.stdout}${result.stderr}`);
    process.exit(1);
  }
  return result.stdout;
};

console.log(run(['--version']).trim());

const file = join(here, 'kitchen.aseprite');
run(['-b', '--script-param', `out=${file}`, '--script', join(here, 'kitchen.lua')]);

// `--split-layers` stands before the file: Aseprite applies it to the files it opens after it
const exportSheet = (ignoreEmpty, fixture) => {
  const dir = mkdtempSync(join(tmpdir(), 'kitchen-'));
  try {
    run(
      [
        '-b',
        '--split-layers',
        '--trim',
        ...(ignoreEmpty ? ['--ignore-empty'] : []),
        file,
        '--sheet',
        'kitchen.png',
        '--data',
        'kitchen.json',
        '--format',
        'json-array',
        '--filename-format',
        '{layer}#{frame}',
        '--list-layers',
        '--list-tags',
        '--list-slices',
      ],
      dir,
    );
    copyFileSync(join(dir, 'kitchen.json'), join(here, fixture));
    console.log(`wrote ${fixture}`);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
};

exportSheet(true, 'kitchen-aseprite.json');
exportSheet(false, 'kitchen-aseprite-empty-cels.json');
