// Writes fighter-hash.json and fighter-array.json next to this file, in the layout and the
// formatting of Aseprite's "Export Sprite Sheet" json (see README.md). Run it with
// `node packages/twopoint5d/src/texture/fixtures/aseprite/generate.mjs`; it reads nothing and imports only Node.
import {writeFileSync} from 'node:fs';

const TITLE = 'fighter';
const FRAME = 16;
const COLUMNS = 4;

// the duration of every frame in ms, by tag: idle 0–3, walk 4–7, kick 8–10, block 11–12, spin 13–15
const DURATIONS = [100, 100, 100, 100, 100, 100, 100, 100, 80, 80, 240, 120, 120, 60, 60, 120];

const TAGS = [
  {name: 'idle', from: 0, to: 3, direction: 'pingpong'},
  {name: 'walk', from: 4, to: 7, direction: 'forward'},
  {name: 'kick', from: 8, to: 10, direction: 'forward', repeat: '1'},
  {name: 'block', from: 11, to: 12, direction: 'reverse'},
  {name: 'spin', from: 13, to: 15, direction: 'pingpong_reverse'},
];

const SLICES = [
  {
    name: 'hitbox',
    color: '#0000ffff',
    keys: [
      {frame: 0, bounds: {x: 4, y: 2, w: 8, h: 14}, pivot: {x: 4, y: 14}},
      {frame: 8, bounds: {x: 2, y: 2, w: 13, h: 14}, pivot: {x: 6, y: 14}},
    ],
  },
  {name: 'panel', color: '#ff0000ff', keys: [{frame: 0, bounds: {x: 0, y: 0, w: 16, h: 16}, center: {x: 4, y: 4, w: 8, h: 8}}]},
];

const rect = ({x, y, w, h}) => `{ "x": ${x}, "y": ${y}, "w": ${w}, "h": ${h} }`;
// Aseprite writes the rectangles of a slice key without the space after the opening brace
const keyRect = ({x, y, w, h}) => `{"x": ${x}, "y": ${y}, "w": ${w}, "h": ${h} }`;
const keyPoint = ({x, y}) => `{"x": ${x}, "y": ${y} }`;

// the fields of a frame entry, each on a line of its own at the indentation of `pad`
const frameFields = (index, trimmed, pad) => {
  const x = (index % COLUMNS) * FRAME;
  const y = Math.floor(index / COLUMNS) * FRAME;
  // the trimmed sheet cuts a margin of 2 off the left, the top and the right of every frame
  const source = trimmed ? {x: 2, y: 2, w: FRAME - 4, h: FRAME - 2} : {x: 0, y: 0, w: FRAME, h: FRAME};
  return [
    `"frame": ${rect({x, y, w: source.w, h: source.h})},`,
    `"rotated": false,`,
    `"trimmed": ${trimmed},`,
    `"spriteSourceSize": ${rect(source)},`,
    `"sourceSize": { "w": ${FRAME}, "h": ${FRAME} },`,
    `"duration": ${DURATIONS[index]}`,
  ]
    .map((line) => pad + line)
    .join('\n');
};

const meta = () => {
  const tags = TAGS.map(
    ({name, from, to, direction, repeat}) =>
      `   { "name": "${name}", "from": ${from}, "to": ${to}, "direction": "${direction}"${repeat ? `, "repeat": "${repeat}"` : ''}, "color": "#000000ff" }`,
  ).join(',\n');
  const slices = SLICES.map(({name, color, keys}) => {
    const keyList = keys
      .map(
        ({frame, bounds, center, pivot}) =>
          `{ "frame": ${frame}, "bounds": ${keyRect(bounds)}${center ? `, "center": ${keyRect(center)}` : ''}${pivot ? `, "pivot": ${keyPoint(pivot)}` : ''} }`,
      )
      .join(', ');
    return `   { "name": "${name}", "color": "${color}", "keys": [${keyList}] }`;
  }).join(',\n');
  return [
    ' "meta": {',
    '  "app": "https://www.aseprite.org/",',
    '  "version": "1.3.10-x64",',
    `  "image": "${TITLE}.png",`,
    '  "format": "RGBA8888",',
    `  "size": { "w": ${COLUMNS * FRAME}, "h": ${(DURATIONS.length / COLUMNS) * FRAME} },`,
    '  "scale": "1",',
    '  "frameTags": [',
    tags,
    '  ],',
    '  "layers": [',
    '   { "name": "Layer 1", "opacity": 255, "blendMode": "normal" }',
    '  ],',
    '  "slices": [',
    slices,
    '  ]',
    ' }',
    '}',
    '',
  ].join('\n');
};

const name = (index) => `${TITLE} ${index}.aseprite`;

const hash = [
  '{ "frames": {',
  DURATIONS.map((_, i) => `   "${name(i)}": {\n${frameFields(i, false, '    ')}\n   }`).join(',\n'),
  ' },',
  meta(),
].join('\n');

const array = [
  '{ "frames": [',
  DURATIONS.map((_, i) => `   {\n    "filename": "${name(i)}",\n${frameFields(i, true, '    ')}\n   }`).join(',\n'),
  ' ],',
  meta(),
].join('\n');

const here = new URL('.', import.meta.url);
writeFileSync(new URL('fighter-hash.json', here), hash);
writeFileSync(new URL('fighter-array.json', here), array);
