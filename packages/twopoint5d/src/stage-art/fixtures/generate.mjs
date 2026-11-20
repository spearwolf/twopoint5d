// Writes kitchen-aseprite.json and kitchen-ftp.json next to this file: two exports of one painted
// scene, `kitchen`, as Aseprite and free-tex-packer write them (see README.md).
//
//   node packages/twopoint5d/src/stage-art/fixtures/generate.mjs
//
// writes both files; it reads nothing and imports only Node.
//
//   node <repo>/packages/twopoint5d/src/stage-art/fixtures/generate.mjs --check-packer
//
// run in a directory of its own where free-tex-packer-core@0.3.9 and pngjs@7 are installed, draws
// the layer PNGs of the scene, packs them with free-tex-packer-core and holds its json to the
// kitchen-ftp.json this script writes; it writes nothing.
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

// --- the scene --------------------------------------------------------------------------------

const CANVAS = {w: 320, h: 180};

// the duration of each of the four frames of the sprite, in ms
const DURATIONS = [200, 100, 100, 150];

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

// The layers of kitchen.aseprite, bottom first as Aseprite keeps them, a group with its layers
// bottom first. `cels` holds the box of the pixels of the layer at each frame, on the canvas;
// null where the layer has no cel. `color` and `data` are the "User Data" of a layer or group.
const LAYERS = [
  {
    name: 'backdrop',
    color: '#d95763ff',
    data: 'depth=600',
    layers: [
      {name: 'wall', cels: [WALL, WALL, WALL, WALL]},
      {name: 'window', color: '#5fcde4ff', data: 'depth=600', cels: [WINDOW, WINDOW, WINDOW, WINDOW]},
    ],
  },
  {name: 'table', cels: [TABLE, TABLE, TABLE, TABLE]},
  // full at frames 0 and 1, empty at 2 and 3: other pixels, the same box
  {name: 'carafe5', cels: [CARAFE, CARAFE, CARAFE, CARAFE]},
  // taken off the table at frame 3: no cel there
  {name: 'ladle', cels: [LADLE, LADLE, LADLE, null]},
  {name: 'steam', cels: STEAM},
];

const TAGS = [{name: 'puff', from: 1, to: 3, direction: 'pingpong', color: '#000000ff'}];

// the pivot marks the pixel (109, 121): the middle of the carafe's foot
const SLICES = [{name: 'carafe5', color: '#0000ffff', keys: [{frame: 0, bounds: CARAFE, pivot: {x: 17, y: 51}}]}];

// --- kitchen-aseprite.json: the json of Aseprite 1.3's sheet export ---------------------------

// The command it stands for. `--split-layers` comes before the file: Aseprite splits the layers
// of a file only when the option is read before the file is opened.
//   aseprite -b --split-layers --trim kitchen.aseprite --sheet kitchen.png --data kitchen.json
//     --format json-array --filename-format '{layer}#{frame}' --list-layers --list-tags --list-slices
// `--ignore-empty` would leave the entry of an empty cel out instead of writing it as 1 × 1.
const IGNORE_EMPTY = false;

const escapeForJson = (text) => text.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');

// the user data as Aseprite appends it to an entry: a color with an alpha above 0, a text not empty
const userData = ({color, data}) => `${color ? `, "color": "${color}"` : ''}${data ? `, "data": "${escapeForJson(data)}"` : ''}`;

// every image layer of the sprite, bottom first, each with the group it is in
const imageLayers = LAYERS.flatMap((entry) =>
  entry.layers ? entry.layers.map((layer) => ({...layer, parent: entry})) : [{...entry, parent: undefined}],
);

// One sample per layer and frame, layer by layer: the cel trimmed to its pixels, or 1 × 1 at the
// top left of the canvas for an empty cel. The frame number of the name counts the frames of the
// sprite, so a sample left out leaves a gap.
const samples = imageLayers.flatMap((layer) =>
  layer.cels.flatMap((cel, frame) =>
    cel === null && IGNORE_EMPTY ? [] : [{layer, frame, bounds: cel ?? {x: 0, y: 0, w: 1, h: 1}}],
  ),
);

// The sheet type "rows" without a width: the samples side by side, every layer on a row of its
// own, a row as high as its highest sample.
{
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let previous;
  for (const sample of samples) {
    if (previous !== undefined && previous.layer !== sample.layer) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    sample.inSheet = {x, y, w: sample.bounds.w, h: sample.bounds.h};
    x += sample.bounds.w;
    rowHeight = Math.max(rowHeight, sample.bounds.h);
    previous = sample;
  }
}

const asepriteSheet = {
  w: Math.max(...samples.map(({inSheet}) => inSheet.x + inSheet.w)),
  h: Math.max(...samples.map(({inSheet}) => inSheet.y + inSheet.h)),
};

const rect = ({x, y, w, h}) => `{ "x": ${x}, "y": ${y}, "w": ${w}, "h": ${h} }`;
// Aseprite writes the rectangles and the pivot of a slice key without the space after the opening brace
const keyRect = ({x, y, w, h}) => `{"x": ${x}, "y": ${y}, "w": ${w}, "h": ${h} }`;
const keyPoint = ({x, y}) => `{"x": ${x}, "y": ${y} }`;

const isTrimmed = ({x, y, w, h}) => x > 0 || y > 0 || w !== CANVAS.w || h !== CANVAS.h;

const frameEntry = ({layer, frame, bounds, inSheet}) =>
  [
    '   {',
    `    "filename": "${escapeForJson(`${layer.name}#${frame}`)}",`,
    `    "frame": ${rect(inSheet)},`,
    '    "rotated": false,',
    `    "trimmed": ${isTrimmed(bounds)},`,
    `    "spriteSourceSize": ${rect(bounds)},`,
    `    "sourceSize": { "w": ${CANVAS.w}, "h": ${CANVAS.h} },`,
    `    "duration": ${DURATIONS[frame]}`,
    '   }',
  ].join('\n');

// meta.layers: every exported layer, a group inserted before the first of its layers
const metaLayers = [];
for (const layer of imageLayers) {
  if (layer.parent && !metaLayers.includes(layer.parent)) metaLayers.push(layer.parent);
  metaLayers.push(layer);
}

// a group has no opacity and no blend mode of its own; a layer in a group names it by `group`
const layerEntry = (layer) =>
  layer.layers
    ? `   { "name": "${escapeForJson(layer.name)}"${userData(layer)} }`
    : `   { "name": "${escapeForJson(layer.name)}"${layer.parent ? `, "group": "${escapeForJson(layer.parent.name)}"` : ''}, "opacity": 255, "blendMode": "normal"${userData(layer)} }`;

const tagEntry = ({name, from, to, direction, color}) =>
  `   { "name": "${escapeForJson(name)}", "from": ${from}, "to": ${to}, "direction": "${direction}"${userData({color})} }`;

const sliceEntry = ({name, color, keys}) => {
  const keyList = keys
    .map(
      ({frame, bounds, center, pivot}) =>
        `{ "frame": ${frame}, "bounds": ${keyRect(bounds)}${center ? `, "center": ${keyRect(center)}` : ''}${pivot ? `, "pivot": ${keyPoint(pivot)}` : ''} }`,
    )
    .join(', ');
  return `   { "name": "${escapeForJson(name)}"${userData({color})}, "keys": [${keyList}] }`;
};

const asepriteJson = [
  '{ "frames": [',
  samples.map(frameEntry).join(',\n'),
  ' ],',
  ' "meta": {',
  '  "app": "https://www.aseprite.org/",',
  '  "version": "1.3.18.6-x64",',
  '  "image": "kitchen.png",',
  '  "format": "RGBA8888",',
  `  "size": { "w": ${asepriteSheet.w}, "h": ${asepriteSheet.h} },`,
  '  "scale": "1",',
  '  "frameTags": [',
  TAGS.map(tagEntry).join(',\n'),
  '  ],',
  '  "layers": [',
  metaLayers.map(layerEntry).join(',\n'),
  '  ],',
  '  "slices": [',
  SLICES.map(sliceEntry).join(',\n'),
  '  ]',
  ' }',
  '}',
  '',
].join('\n');

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
  writeFileSync(new URL('kitchen-aseprite.json', here), asepriteJson);
  writeFileSync(new URL('kitchen-ftp.json', here), ftpJson);
}
