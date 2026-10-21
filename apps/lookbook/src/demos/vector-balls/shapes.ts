/**
 * The objects the vector balls form. Each shape lays out `n` balls — always a power of two, from 64
 * to 4096 — inside a sphere of about `SHAPE_RADIUS` around the origin, writes `x, y, z` of ball `i`
 * at `positions[3 i]` and the index of its colour (into `BALL_COLOURS`) at `colours[i]`.
 */
export interface Shape {
  readonly name: string;
  /** The size of a ball in this shape, relative to the size the ball count gives every shape. */
  readonly ballScale: number;
  place(n: number, positions: Float32Array, colours: Uint8Array): void;
}

/** The frames of `balls.json` in the order of the colour indices, a rainbow from red to pink. */
export const BALL_COLOURS = [
  'ball-red',
  'ball-orange',
  'ball-yellow',
  'ball-green',
  'ball-cyan',
  'ball-blue',
  'ball-purple',
  'ball-pink',
] as const;

export const SHAPE_RADIUS = 1.5;

const RAINBOW = BALL_COLOURS.length;

/** `t` from 0 to 1 onto a colour of the rainbow, `cycles` times round. */
const rainbow = (t: number, cycles = 1) => Math.floor(t * cycles * RAINBOW) % RAINBOW;

/** The exponent of a power of two; the ball counts are powers of two. */
const log2 = (n: number) => Math.round(Math.log2(n));

/**
 * A cube of `a × b × c` balls, the dimensions powers of two as close to each other as they get:
 * 4 × 4 × 4 for 64 balls, 8 × 4 × 4 for 128, 16 × 16 × 16 for 4096. Diagonal rainbow stripes.
 */
export const Cube: Shape = {
  name: 'cube',
  ballScale: 1,
  place(n, positions, colours) {
    const dims = [0, 0, 0];
    for (let j = 0; j < log2(n); j++) dims[j % 3]! += 1;
    const [dx, dy, dz] = dims.map((e) => 2 ** e) as [number, number, number];
    const side = SHAPE_RADIUS * 1.2;
    for (let i = 0; i < n; i++) {
      const ix = i % dx;
      const iy = Math.floor(i / dx) % dy;
      const iz = Math.floor(i / (dx * dy));
      const fx = (ix + 0.5) / dx;
      const fy = (iy + 0.5) / dy;
      const fz = (iz + 0.5) / dz;
      positions[i * 3] = (fx - 0.5) * side;
      positions[i * 3 + 1] = (fy - 0.5) * side;
      positions[i * 3 + 2] = (fz - 0.5) * side;
      colours[i] = rainbow((fx + (1 - fy) + fz) / 3);
    }
  },
};

/** A torus: rings of balls around the tube, more of them around the hole. A rainbow round the ring. */
export const Torus: Shape = {
  name: 'torus',
  ballScale: 0.9,
  place(n, positions, colours) {
    const around = 2 ** Math.ceil((log2(n) + 1) / 2);
    const tube = n / around;
    const ringRadius = SHAPE_RADIUS * 0.72;
    const tubeRadius = SHAPE_RADIUS * 0.32;
    for (let i = 0; i < n; i++) {
      const j = Math.floor(i / tube);
      const k = i % tube;
      const u = (j / around) * Math.PI * 2;
      // every other ring turned by half a step, so the balls of two rings fall into the gaps
      const v = ((k + (j % 2) * 0.5) / tube) * Math.PI * 2;
      const r = ringRadius + Math.cos(v) * tubeRadius;
      positions[i * 3] = Math.cos(u) * r;
      positions[i * 3 + 1] = Math.sin(v) * tubeRadius;
      positions[i * 3 + 2] = Math.sin(u) * r;
      colours[i] = rainbow(j / around);
    }
  },
};

/** A sphere out of a Fibonacci spiral, which spreads any number of balls evenly. Bands of latitude. */
export const Sphere: Shape = {
  name: 'sphere',
  ballScale: 1,
  place(n, positions, colours) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const a = i * golden;
      positions[i * 3] = Math.cos(a) * r * SHAPE_RADIUS;
      positions[i * 3 + 1] = y * SHAPE_RADIUS;
      positions[i * 3 + 2] = Math.sin(a) * r * SHAPE_RADIUS;
      colours[i] = rainbow((1 - y) / 2);
    }
  },
};

/** Two strands wound round each other, half the balls each; the colours run up the strands twice. */
export const Spiral: Shape = {
  name: 'spiral',
  ballScale: 0.85,
  place(n, positions, colours) {
    const strand = n / 2;
    const turns = 1.5 * Math.sqrt(n / 64);
    const radius = SHAPE_RADIUS * 0.62;
    const height = SHAPE_RADIUS * 2;
    for (let i = 0; i < n; i++) {
      const s = i % 2;
      const t = (Math.floor(i / 2) + 0.5) / strand;
      const a = t * turns * Math.PI * 2 + s * Math.PI;
      positions[i * 3] = Math.cos(a) * radius;
      positions[i * 3 + 1] = (t - 0.5) * height;
      positions[i * 3 + 2] = Math.sin(a) * radius;
      colours[i] = rainbow(t, 2);
    }
  },
};

type Point = readonly [number, number];

/** The points of an arc around `(cx, cy)`, from the angle `from` to `to`, in degrees. */
function arc(cx: number, cy: number, r: number, from: number, to: number): Point[] {
  const steps = Math.ceil(Math.abs(to - from) / 10);
  const points: Point[] = [];
  for (let s = 0; s <= steps; s++) {
    const a = ((from + ((to - from) * s) / steps) * Math.PI) / 180;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return points;
}

/** The strokes of a letter, each a polyline, and the colour of the letter. */
interface Glyph {
  readonly strokes: Point[][];
  readonly colour: number;
}

const shift = (points: Point[], dx: number): Point[] => points.map(([x, y]) => [x + dx, y]);

// "2.5D" drawn in strokes on a grid six units high, each letter shifted to its place
const LOGO: Glyph[] = [
  {strokes: [[...arc(2, 4, 2, 180, -45), [0, 0], [4, 0]]], colour: 0},
  {strokes: [shift(arc(0.5, 0.4, 0.35, 0, 360), 5)], colour: 2},
  {strokes: [shift([[4, 6], [0.5, 6], [0.5, 3.3], ...arc(2, 2, 2, 140, -150)], 7)], colour: 4},
  {strokes: [shift([[1.5, 0], [0, 0], [0, 6], [1.5, 6], ...arc(1.5, 3, 3, 90, -90)], 12)], colour: 6},
];
const LOGO_WIDTH = 16.5;
const LOGO_HEIGHT = 6;

interface Segment {
  readonly from: Point;
  readonly to: Point;
  readonly start: number;
  readonly length: number;
  readonly colour: number;
}

const LOGO_SEGMENTS: Segment[] = [];
let logoLength = 0;
for (const {strokes, colour} of LOGO) {
  for (const stroke of strokes) {
    for (let p = 1; p < stroke.length; p++) {
      const from = stroke[p - 1]!;
      const to = stroke[p]!;
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
      LOGO_SEGMENTS.push({from, to, start: logoLength, length, colour});
      logoLength += length;
    }
  }
}

/**
 * The text "2.5D" in balls, spread evenly along the strokes of the letters. More balls than a layer
 * holds go into more layers one behind the other: one layer for 64 balls, eight for 4096.
 */
export const Logo: Shape = {
  name: 'logo',
  ballScale: 0.55,
  place(n, positions, colours) {
    const layers = Math.max(1, Math.round(Math.sqrt(n / 64)));
    const perLayer = n / layers;
    const scale = (SHAPE_RADIUS * 2.3) / LOGO_WIDTH;
    const depth = SHAPE_RADIUS * 0.25;
    let segment = 0;
    for (let i = 0; i < n; i++) {
      const layer = Math.floor(i / perLayer);
      const k = i % perLayer;
      if (k === 0) segment = 0;
      const at = ((k + 0.5) / perLayer) * logoLength;
      while (segment < LOGO_SEGMENTS.length - 1 && LOGO_SEGMENTS[segment]!.start + LOGO_SEGMENTS[segment]!.length < at) segment++;
      const {from, to, start, length, colour} = LOGO_SEGMENTS[segment]!;
      const f = length > 0 ? (at - start) / length : 0;
      positions[i * 3] = (from[0] + (to[0] - from[0]) * f - LOGO_WIDTH / 2) * scale;
      positions[i * 3 + 1] = (from[1] + (to[1] - from[1]) * f - LOGO_HEIGHT / 2) * scale;
      positions[i * 3 + 2] = layers > 1 ? (layer / (layers - 1) - 0.5) * depth : 0;
      colours[i] = colour;
    }
  },
};

/** The order the object morphs through, round and round. */
export const SHAPES: readonly Shape[] = [Cube, Torus, Sphere, Logo, Spiral];
