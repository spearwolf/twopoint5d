import resurrect64 from '../../resurrect-64.hex?raw';

// the rainbow, walked through the hues of the Resurrect 64 palette — red, orange, yellow, green, cyan, blue, violet, pink
const RAINBOW = [
  'e83b3b',
  'ea4f36',
  'fb6b1d',
  'f79617',
  'f9c22b',
  'd5e04b',
  '91db69',
  '1ebc73',
  '30e1b9',
  '4d9be6',
  '4d65b4',
  'a884f3',
  '905ea9',
  'f04f78',
  'c32454',
];

const PALETTE = new Set(resurrect64.split(/\s+/).filter(Boolean));

for (const color of RAINBOW) {
  if (!PALETTE.has(color)) {
    throw new Error(`rainbow color #${color} is not part of resurrect-64.hex`);
  }
}

// <rainbow-line> turns its cycle-colors into evenly spaced stops of a linear gradient, renders that into a
// lookup table 1024 pixels wide and picks each slice's color from it. Between two stops the gradient blends,
// and a blended color is not one of the palette. With 2048 stops every pixel center of the table lies exactly
// on an odd stop, so the table holds only the stops' own colors and the rainbow shows nothing but the palette.
const LOOKUP_TABLE_WIDTH = 1024;
const STOP_COUNT = LOOKUP_TABLE_WIDTH * 2;

export const RAINBOW_COLORS: string[] = Array.from(
  {length: STOP_COUNT},
  (_, i) => `#${RAINBOW[Math.floor((i * RAINBOW.length) / STOP_COUNT)]}`,
);
