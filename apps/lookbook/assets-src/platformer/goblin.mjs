// The goblin: squat, big-eared, a spiked club in hand, facing right. It is drawn in exactly the 16
// colours of its palette's row 0, so `PaletteSwap` can turn it into the red, blue and green goblin
// of the rows below.
import {hex} from '../lib/image.mjs';
import {add, bands, ik, Puppet} from './puppet.mjs';

/** @typedef {import('./puppet.mjs').Vec} Vec */
/** @typedef {import('../lib/image.mjs').RGBA} RGBA */

export const WIDTH = 56;
export const HEIGHT = 48;
const G = HEIGHT;
const X0 = 28;

/**
 * The palette, one row per variant, 16 entries each. The entry names say what each colour paints.
 */
export const ENTRIES = [
  'outline',
  'skin light',
  'skin',
  'skin shadow',
  'eye',
  'teeth, claws',
  'cloth light',
  'cloth',
  'cloth shadow',
  'club light',
  'club',
  'club shadow',
  'strap',
  'spikes',
  'mouth',
  'inner ear',
];

/** @type {{name: string, colours: string[]}[]} */
export const VARIANTS = [
  {
    name: 'olive (source)',
    colours: [
      '#1a1016',
      '#a8b04a',
      '#788a2e',
      '#4c5a1e',
      '#ffd23a',
      '#f0e6c8',
      '#a8744a',
      '#7a4e30',
      '#4e301e',
      '#c89a60',
      '#946a3c',
      '#5e4026',
      '#2c1e1a',
      '#b8c0cc',
      '#6a1a22',
      '#d07a6a',
    ],
  },
  {
    name: 'red',
    colours: [
      '#1a1016',
      '#f07a5e',
      '#c0402e',
      '#782018',
      '#fff27a',
      '#f0e6c8',
      '#6a6a7c',
      '#46465a',
      '#2a2a36',
      '#c89a60',
      '#946a3c',
      '#5e4026',
      '#2c1e1a',
      '#b8c0cc',
      '#2a0a10',
      '#ffb0a0',
    ],
  },
  {
    name: 'blue',
    colours: [
      '#1a1016',
      '#86bcf0',
      '#4a74c0',
      '#2a4080',
      '#ff5040',
      '#f0e6c8',
      '#a678c4',
      '#6e4490',
      '#40265a',
      '#c89a60',
      '#946a3c',
      '#5e4026',
      '#2c1e1a',
      '#b8c0cc',
      '#401838',
      '#c8a8f4',
    ],
  },
  {
    name: 'green',
    colours: [
      '#1a1016',
      '#8ee86a',
      '#44a838',
      '#22661e',
      '#ff3a3a',
      '#f0e6c8',
      '#c89448',
      '#8a6020',
      '#563a12',
      '#c89a60',
      '#946a3c',
      '#5e4026',
      '#2c1e1a',
      '#b8c0cc',
      '#5a1020',
      '#f0a080',
    ],
  },
];

const P = VARIANTS[0].colours.map(hex);
const [OUTLINE, SKIN_L, SKIN, SKIN_D, EYE, TEETH, CLOTH_L, CLOTH, CLOTH_D, CLUB_L, CLUB, CLUB_D, STRAP, SPIKE, MOUTH, EAR] = P;

/**
 * @typedef {object} Pose
 * @property {Vec} hip (dx from the pivot, height above the ground)
 * @property {number} lean positive forward
 * @property {Vec} nearAnkle (dx, height)
 * @property {Vec} farAnkle
 * @property {Vec} nearHand relative to the shoulder; it holds the club
 * @property {Vec} farHand
 * @property {number} club the club's direction in degrees, 0 forward, −90 up
 */

/**
 * @param {Puppet} p
 * @param {Vec} hip
 * @param {Vec} ankle
 * @param {number} far
 */
function leg(p, hip, ankle, far) {
  const a = /** @type {Vec} */ ([X0 + ankle[0], G - ankle[1]]);
  const {joint: knee, end} = ik(hip, a, 5, 5, [1, -0.3]);
  const skin = far ? bands(SKIN, SKIN_D, SKIN_D) : bands(SKIN_L, SKIN, SKIN_D);
  p.capsule(end, add(end, [3.2, 0.6]), 1.7, 1.3, skin);
  p.img.set(end[0] + 4, end[1] + 1, TEETH); // a claw
  p.capsule(knee, end, 1.8, 1.6, skin);
  p.capsule(hip, knee, 2.3, 1.9, skin);
}

/**
 * @param {Puppet} p
 * @param {Vec} shoulder
 * @param {Vec} hand
 * @param {number} far
 */
function arm(p, shoulder, hand, far) {
  const {joint: elbow, end} = ik(shoulder, add(shoulder, hand), 5.5, 5.5, [-0.3, 1]);
  const skin = far ? bands(SKIN, SKIN_D, SKIN_D) : bands(SKIN_L, SKIN, SKIN_D);
  p.capsule(shoulder, elbow, 1.8, 1.5, skin);
  p.capsule(elbow, end, 1.5, 1.4, skin);
  p.disc(end, 1.8, skin);
  return end;
}

/**
 * @param {Puppet} p
 * @param {Vec} hand
 * @param {number} degrees
 */
function club(p, hand, degrees) {
  const a = (degrees * Math.PI) / 180;
  const tip = /** @type {Vec} */ ([hand[0] + Math.cos(a) * 12, hand[1] + Math.sin(a) * 12]);
  const back = /** @type {Vec} */ ([hand[0] - Math.cos(a) * 2, hand[1] - Math.sin(a) * 2]);
  p.capsule(back, tip, 1.1, 2.8, bands(CLUB_L, CLUB, CLUB_D));
  for (const [t, side] of [
    [0.75, 1],
    [0.9, -1],
    [1, 1],
  ]) {
    const along = /** @type {Vec} */ ([back[0] + (tip[0] - back[0]) * t, back[1] + (tip[1] - back[1]) * t]);
    const r = 1.1 + 1.7 * t + 1.2;
    p.img.set(along[0] - Math.sin(a) * r * side, along[1] + Math.cos(a) * r * side, SPIKE);
  }
}

/**
 * @param {Pose} pose
 */
export function drawGoblin(pose) {
  const p = new Puppet(WIDTH, HEIGHT, [0.5, -0.85]);
  const hip = /** @type {Vec} */ ([X0 + pose.hip[0], G - pose.hip[1]]);
  const tilt = (pose.lean * Math.PI) / 180;
  const dir = /** @type {Vec} */ ([Math.sin(tilt), -Math.cos(tilt)]);
  const at = (/** @type {number} */ d) => /** @type {Vec} */ ([hip[0] + dir[0] * d, hip[1] + dir[1] * d]);
  const neck = at(7);
  const shoulder = at(5.5);
  const head = add(neck, [dir[0] * 4 + 2.5, dir[1] * 4]);

  arm(p, add(shoulder, [-1.5, 0]), pose.farHand, 1);
  leg(p, add(hip, [-1, 0]), pose.farAnkle, 1);
  p.capsule(hip, neck, 5.4, 4.2, bands(SKIN_L, SKIN, SKIN_D));
  // the loincloth, and a strap over the shoulder
  p.capsule(at(-0.5), at(2), 5.6, 5.2, (s) => (s.along > 0.85 && s.across > -0.2 ? STRAP : bands(CLOTH_L, CLOTH, CLOTH_D)(s)));
  const strapA = at(6.2);
  const strapB = add(at(1.8), [3.6, 0]);
  p.img.line(strapA[0] - 2, strapA[1], strapB[0], strapB[1], STRAP);
  leg(p, hip, pose.nearAnkle, 0);

  // the ear, swept back; the head; the hooked nose; eye, brow and a grin with teeth
  const ear = add(head, [-9, -4.5]);
  p.capsule(add(head, [-2.5, -1]), ear, 2.6, 0.6, (s) =>
    Math.abs(s.across) < 0.45 && s.along > 0.15 && s.along < 0.8 ? EAR : bands(SKIN_L, SKIN, SKIN_D)(s),
  );
  p.disc(head, 6.2, bands(SKIN_L, SKIN, SKIN_D, {high: 0.4, low: -0.4}));
  p.capsule(add(head, [4, -0.5]), add(head, [7.6, 1.6]), 1.7, 1, bands(SKIN_L, SKIN, SKIN_D));
  p.img.set(head[0] + 3, head[1] - 2, EYE);
  p.img.set(head[0] + 2, head[1] - 2, EYE);
  p.img.line(head[0] + 1, head[1] - 4, head[0] + 4, head[1] - 3, SKIN_D);
  p.img.line(head[0] + 1, head[1] + 3, head[0] + 5, head[1] + 2, MOUTH);
  p.img.set(head[0] + 2, head[1] + 3, TEETH);
  p.img.set(head[0] + 4, head[1] + 2, TEETH);

  const hand = arm(p, add(shoulder, [0.5, 0]), pose.nearHand, 0);
  club(p, hand, pose.club);
  p.disc(hand, 1.8, bands(SKIN_L, SKIN, SKIN_D)); // the fist closes over the handle
  p.img.outline(OUTLINE);
  return p.img;
}

/** @type {{name: string, direction: 'forward' | 'pingpong', color: string, frames: [Pose, number][]}[]} */
export const ANIMATIONS = [
  {
    name: 'walk',
    direction: 'forward',
    color: '#5fd35fff',
    frames: Array.from({length: 4}, (_, i) => {
      const phi = (i / 4) * Math.PI * 2;
      const foot = (/** @type {number} */ a) => /** @type {Vec} */ ([-4 * Math.cos(a), 1.8 + Math.max(0, Math.sin(a)) * 2.5]);
      return /** @type {[Pose, number]} */ ([
        {
          hip: [0, 10 + Math.abs(Math.sin(phi)) * 0.8],
          lean: 14,
          nearAnkle: foot(phi),
          farAnkle: foot(phi + Math.PI),
          nearHand: [2.5, 1 + 0.6 * Math.cos(phi)],
          farHand: [-1 - 2 * Math.cos(phi), 7],
          club: -140,
        },
        130,
      ]);
    }),
  },
  {
    name: 'attack',
    direction: 'forward',
    color: '#ff7f3fff',
    frames: [
      [{hip: [-1, 10], lean: -5, nearAnkle: [4, 1.8], farAnkle: [-4, 1.8], nearHand: [-2, -6], farHand: [3, 5], club: -150}, 140],
      [{hip: [0, 10], lean: 10, nearAnkle: [4, 1.8], farAnkle: [-4, 1.8], nearHand: [5, -5], farHand: [1, 6], club: -40}, 60],
      [{hip: [1, 9.5], lean: 25, nearAnkle: [5, 1.8], farAnkle: [-4, 1.8], nearHand: [7, 3], farHand: [-2, 6], club: 35}, 260],
      [{hip: [0, 10], lean: 14, nearAnkle: [4, 1.8], farAnkle: [-4, 1.8], nearHand: [2.5, 1], farHand: [-1, 7], club: -140}, 140],
    ],
  },
  {
    name: 'hit',
    direction: 'forward',
    color: '#bf3fffff',
    frames: [
      [{hip: [-2, 10], lean: -20, nearAnkle: [3, 1.8], farAnkle: [-5, 1.8], nearHand: [-3, 5], farHand: [-6, 2], club: -110}, 90],
      [{hip: [-1, 10], lean: -8, nearAnkle: [4, 1.8], farAnkle: [-4, 1.8], nearHand: [2, 6], farHand: [-3, 6], club: -90}, 200],
    ],
  },
  {
    name: 'die',
    direction: 'forward',
    color: '#7f7f7fff',
    frames: [
      [{hip: [1, 9], lean: -35, nearAnkle: [4, 2.5], farAnkle: [-3, 1.8], nearHand: [-4, 2], farHand: [-6, -1], club: -160}, 120],
      [{hip: [3, 6], lean: -62, nearAnkle: [5, 4], farAnkle: [1, 2], nearHand: [-6, -2], farHand: [-7, -4], club: 170}, 120],
      [{hip: [5, 4], lean: -84, nearAnkle: [6, 3], farAnkle: [3, 2], nearHand: [-4, -4], farHand: [-7, -2], club: 180}, 400],
    ],
  },
];

/** The pixel the feet stand on: the `pivot` slice. */
export const PIVOT = {x: X0, y: HEIGHT - 1};
