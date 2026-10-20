// Generates the free-tex-packer fixtures of packages/twopoint5d/src/texture/fixtures/free-tex-packer:
// three source images drawn by script, packed by free-tex-packer-core into one sheet, exported
// as JSON Hash and as JSON Array.
import {writeFileSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PNG} from 'pngjs';

const require = createRequire(import.meta.url);
const {packAsync} = require('free-tex-packer-core');

const out = process.argv[2];
if (!out) throw new Error('usage: node generate.mjs <outdir>');
mkdirSync(out, {recursive: true});

// six colors, cells of 2 × 2 texels, 2 columns and 3 rows: an image of 4 × 6 that is not square
// and in which every cell differs, so a turn or a mirror shows
const COLORS = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [0, 255, 255],
  [255, 0, 255],
];
const CELL = 2;

function image(width, height, margins, colors = COLORS) {
  const [left, top] = margins;
  const png = new PNG({width, height});
  png.data.fill(0);
  for (let row = 0; row < 3 * CELL; row++) {
    for (let column = 0; column < 2 * CELL; column++) {
      const [r, g, b] = colors[Math.floor(row / CELL) * 2 + Math.floor(column / CELL)];
      const i = ((top + row) * width + left + column) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

const reversed = [...COLORS].reverse();

const images = [
  // trimmed: 2 transparent columns left, 3 right, 1 row on top, 2 below
  {path: 'hero.png', contents: image(4 + 2 + 3, 6 + 1 + 2, [2, 1])},
  // untrimmed: the cells fill the image
  {path: 'gem.png', contents: image(4, 6, [0, 0], reversed)},
  // a long strip of opaque white that the packer wants to lay on its side
  {path: 'banner.png', contents: (() => {
    const png = new PNG({width: 24, height: 3});
    png.data.fill(255);
    return PNG.sync.write(png);
  })()},
];

const common = {
  textureName: 'sheet',
  width: 24,
  height: 64,
  fixedSize: false,
  powerOfTwo: false,
  padding: 0,
  extrude: 0,
  allowRotation: true,
  detectIdentical: true,
  allowTrim: true,
  trimMode: 'trim',
  removeFileExtension: false,
  prependFolderName: true,
  packer: 'MaxRectsBin',
  packerMethod: 'BestShortSideFit',
  appInfo: {url: 'https://github.com/odrick/free-tex-packer-core', version: '0.3.9'},
};

for (const exporter of ['JsonHash', 'JsonArray']) {
  const files = await packAsync(images, {...common, exporter});
  for (const file of files) {
    const name = file.name.endsWith('.json') ? `sheet-${exporter === 'JsonHash' ? 'hash' : 'array'}.json` : file.name;
    writeFileSync(`${out}/${name}`, file.buffer);
    console.log(exporter, file.name, '->', name);
  }
}
