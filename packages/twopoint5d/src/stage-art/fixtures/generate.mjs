// Writes kitchen-ftp.json next to this file: free-tex-packer's export of the layer PNGs of the
// painted scene `kitchen` that kitchen.lua paints in Aseprite (see README.md; export.mjs writes the
// Aseprite fixtures).
//
//   node packages/twopoint5d/src/stage-art/fixtures/generate.mjs
//
// writes it; it reads nothing and imports only Node.
//
//   node <repo>/packages/twopoint5d/src/stage-art/fixtures/generate.mjs --check-packer
//
// run in a directory of its own where free-tex-packer-core@0.3.9 and pngjs@7 are installed, draws
// the layer PNGs of the scene, packs them with free-tex-packer-core and holds its json to the
// kitchen-ftp.json this script writes; it writes nothing.
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

// --- the scene, as kitchen.lua paints it -------------------------------------------------------

const CANVAS = {w: 320, h: 180};

const WALL = {x: 0, y: 0, w: 320, h: 180};
const WINDOW = {x: 196, y: 22, w: 84, h: 64};
const TABLE = {x: 40, y: 118, w: 240, h: 62};
const CARAFE = {x: 92, y: 70, w: 34, h: 52};
const LADLE = {x: 150, y: 84, w: 18, h: 40};
// the steam grows and sinks back: a cel of its own size at every frame
const STEAM = [
  {x: 100, y: 40, w: 14, h: 26},
  {x: 98, y: 34, w: 18, h: 32},
  {x: 96, y: 28, w: 22, h: 38},
  {x: 97, y: 31, w: 20, h: 35},
];

const isTrimmed = ({x, y, w, h}) => x > 0 || y > 0 || w !== CANVAS.w || h !== CANVAS.h;

// --- kitchen-ftp.json: free-tex-packer's "JSON (hash)" over the layer PNGs ---------------------

// The PNGs a paint tool exports of the scene, one of the full canvas per picture, named after
// §4.2 of the proposal: a depth after `@`, a second picture of a layer after `-`, a strip after
// `#`, a pivot marker after `.pivot`. The box is where the pixels of the file lie.
const FILES = [
  ['wall@600', WALL],
  ['window@600', WINDOW],
  ['table', TABLE],
  ['carafe5', CARAFE],
  ['carafe5-empty', CARAFE],
  ['carafe5.pivot', {x: CARAFE.x + 17, y: CARAFE.y + 51, w: 1, h: 1}],
  ['ladle', LADLE],
  ...STEAM.map((box, frame) => [`steam#${frame}`, box]),
];

// Where free-tex-packer-core 0.3.9 put each picture with the options below, in the order it wrote
// them — the order it packed them in. `--check-packer` holds this table to the packer.
const PACKED = [
  ['wall@600', 0, 0],
  ['table', 320, 0],
  ['window@600', 560, 0],
  ['carafe5-empty', 320, 62],
  ['carafe5', 354, 62],
  ['steam#2', 388, 62],
  ['steam#3', 410, 62],
  ['ladle', 430, 62],
  ['steam#1', 410, 97],
  ['carafe5.pivot', 428, 97],
  ['steam#0', 388, 100],
];

const PACKER_OPTIONS = {
  textureName: 'kitchen',
  width: 1024,
  height: 1024,
  fixedSize: false,
  powerOfTwo: false,
  padding: 0,
  extrude: 0,
  allowRotation: false,
  detectIdentical: true,
  allowTrim: true,
  trimMode: 'trim',
  removeFileExtension: true,
  prependFolderName: true,
  packer: 'MaxRectsBin',
  packerMethod: 'BestShortSideFit',
  exporter: 'JsonHash',
  appInfo: {url: 'https://github.com/odrick/free-tex-packer-core', version: '0.3.9'},
};

const boxOf = new Map(FILES);
const packedFrames = PACKED.map(([name, x, y]) => {
  const box = boxOf.get(name);
  return {name, frame: {x, y, w: box.w, h: box.h}, box};
});

const ftpJson = JSON.stringify(
  {
    frames: Object.fromEntries(
      packedFrames.map(({name, frame, box}) => [
        name,
        {
          frame,
          rotated: false,
          trimmed: isTrimmed(box),
          spriteSourceSize: box,
          sourceSize: {w: CANVAS.w, h: CANVAS.h},
          pivot: {x: 0.5, y: 0.5},
        },
      ]),
    ),
    meta: {
      app: PACKER_OPTIONS.appInfo.url,
      version: PACKER_OPTIONS.appInfo.version,
      image: `${PACKER_OPTIONS.textureName}.png`,
      format: 'RGBA8888',
      size: {
        w: Math.max(...packedFrames.map(({frame}) => frame.x + frame.w)),
        h: Math.max(...packedFrames.map(({frame}) => frame.y + frame.h)),
      },
      scale: 1,
    },
  },
  null,
  2,
);

// --- output -----------------------------------------------------------------------------------

if (process.argv.includes('--check-packer')) {
  // the packer and pngjs are no dependency of this repo: they are resolved from the working directory
  const require = createRequire(pathToFileURL(`${process.cwd()}/`));
  const {packAsync} = require('free-tex-packer-core');
  const {PNG} = require('pngjs');

  // every picture a color of its own, so that the packer's detectIdentical merges none of them
  const images = FILES.map(([name, box], index) => {
    const png = new PNG({width: CANVAS.w, height: CANVAS.h});
    png.data.fill(0);
    for (let y = box.y; y < box.y + box.h; y++) {
      for (let x = box.x; x < box.x + box.w; x++) {
        png.data.set([40 + index * 20, 200 - index * 15, (index * 77) % 256, 255], (y * CANVAS.w + x) * 4);
      }
    }
    return {path: `${name}.png`, contents: PNG.sync.write(png)};
  });

  const files = await packAsync(images, PACKER_OPTIONS);
  const packed = files.find(({name}) => name.endsWith('.json')).buffer.toString();
  if (packed !== ftpJson) {
    console.error('kitchen-ftp.json: free-tex-packer-core writes another json:\n');
    console.error(packed);
    process.exit(1);
  }
  console.log('kitchen-ftp.json: as free-tex-packer-core writes it');
} else {
  const here = new URL('.', import.meta.url);
  writeFileSync(new URL('kitchen-ftp.json', here), ftpJson);
}
