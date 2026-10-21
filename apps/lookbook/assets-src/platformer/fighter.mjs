// The kung-fu fighter: a 70s martial-arts film hero in a yellow jumpsuit with black side stripes,
// black bowl cut and black slippers, seen from the side and facing right. Every frame is a pose
// of the puppet; the animations are lists of poses with their durations.
import {hex} from '../lib/image.mjs';
import {add, bands, ik, Puppet} from './puppet.mjs';

/** @typedef {import('./puppet.mjs').Vec} Vec */
/** @typedef {import('../lib/image.mjs').RGBA} RGBA */

export const CANVAS = 64;
/** the ground: the bottom edge of the canvas; the feet stand on row 63 */
const G = CANVAS;
/** the x of the pivot */
const X0 = 32;

const THIGH = 10;
const SHIN = 9.5;
const TORSO = 12;
const NECK = 6;
const HEAD_R = 6.2;
const UPPER = 7.5;
const FORE = 7;

const C = {
  outline: hex('#140c14'),
  hair: hex('#18121e'),
  hairLit: hex('#3c3252'),
  skin: [hex('#f6c08c'), hex('#d88c5c'), hex('#9a5634'), hex('#6e3a24')],
  suit: [hex('#fff060'), hex('#f4c020'), hex('#b8800c'), hex('#7c5208')],
  stripe: hex('#1c1620'),
  shoe: hex('#26222e'),
  shoeLit: hex('#4a4458'),
};

/**
 * @typedef {object} Leg
 * @property {Vec} ankle (dx from the pivot, height above the ground)
 * @property {number} [toe] the direction of the foot: 0 forward, 90 down, −90 up
 * @property {Vec} [bend] where the knee points
 */

/**
 * @typedef {object} Pose
 * @property {Vec} hip (dx from the pivot, height above the ground)
 * @property {number} lean the torso's tilt, positive forward
 * @property {number} [head] extra tilt of the head
 * @property {Leg} near the leg on the camera side
 * @property {Leg} far
 * @property {Vec} nearHand relative to the shoulder
 * @property {Vec} farHand
 */

/**
 * @param {number} far 0 for a near part, 1 for a far one (one band darker)
 * @param {RGBA[]} ramp
 * @param {number} [stripe] the half width of the side stripe, in radii
 */
function suitShade(far, ramp, stripe = 0.3) {
  const base = bands(ramp[far], ramp[far + 1], ramp[far + 2]);
  return (/** @type {Parameters<import('./puppet.mjs').Shade>[0]} */ at) => (Math.abs(at.across) < stripe ? C.stripe : base(at));
}

/**
 * @param {Puppet} p
 * @param {Vec} hip
 * @param {Leg} leg
 * @param {number} far
 */
function drawLeg(p, hip, leg, far) {
  const ankle = /** @type {Vec} */ ([X0 + leg.ankle[0], G - leg.ankle[1]]);
  const {joint: knee, end} = ik(hip, ankle, THIGH, SHIN, leg.bend ?? [1, -0.15]);
  const toeAngle = ((leg.toe ?? 0) * Math.PI) / 180;
  const toe = /** @type {Vec} */ ([end[0] + Math.cos(toeAngle) * 4.5, end[1] + Math.sin(toeAngle) * 4.5]);
  p.capsule(end, toe, 1.7, 1.5, bands(C.shoeLit, C.shoe, C.shoe));
  p.capsule(knee, end, 2.6, 2.2, suitShade(far, C.suit));
  p.capsule(hip, knee, 3.3, 2.7, suitShade(far, C.suit));
}

/**
 * @param {Puppet} p
 * @param {Vec} shoulder
 * @param {Vec} hand relative to the shoulder
 * @param {number} far
 */
function drawArm(p, shoulder, hand, far) {
  const {joint: elbow, end} = ik(shoulder, add(shoulder, hand), UPPER, FORE, [-0.4, 1]);
  const wrist = /** @type {Vec} */ ([elbow[0] + (end[0] - elbow[0]) * 0.78, elbow[1] + (end[1] - elbow[1]) * 0.78]);
  p.capsule(shoulder, elbow, 2.5, 2.1, suitShade(far, C.suit));
  p.capsule(elbow, wrist, 2, 1.8, suitShade(far, C.suit));
  p.disc(end, 2.1, bands(C.skin[far], C.skin[far + 1], C.skin[far + 2]));
}

/**
 * @param {Pose} pose
 * @returns {import('../lib/image.mjs').Img}
 */
export function drawFighter(pose) {
  // lit from the upper right: the fighter faces right, into the light
  const p = new Puppet(CANVAS, CANVAS, [0.5, -0.85]);
  const hip = /** @type {Vec} */ ([X0 + pose.hip[0], G - pose.hip[1]]);
  const tilt = (pose.lean * Math.PI) / 180;
  const dir = /** @type {Vec} */ ([Math.sin(tilt), -Math.cos(tilt)]);
  const at = (/** @type {number} */ d) => /** @type {Vec} */ ([hip[0] + dir[0] * d, hip[1] + dir[1] * d]);
  const neck = at(TORSO);
  const shoulder = at(TORSO - 2.5);
  const headTilt = ((pose.lean + (pose.head ?? 0)) * Math.PI) / 180;
  const head = /** @type {Vec} */ ([neck[0] + Math.sin(headTilt) * NECK, neck[1] - Math.cos(headTilt) * NECK]);

  drawArm(p, add(shoulder, [-1.5, 0]), pose.farHand, 1);
  drawLeg(p, add(hip, [-1, 0]), pose.far, 1);
  p.capsule(hip, at(TORSO - 1), 4.6, 5.2, suitShade(0, C.suit, 0.14));
  drawLeg(p, hip, pose.near, 0);
  p.capsule(neck, head, 2, 2, bands(C.skin[1], C.skin[1], C.skin[2]));

  // the head: skin, a bowl cut over the brow and the back of the head, one eye looking ahead
  const cos = Math.cos(-headTilt);
  const sin = Math.sin(-headTilt);
  const skin = bands(C.skin[0], C.skin[1], C.skin[2]);
  p.disc(head, HEAD_R, (s) => {
    const rx = s.nx * cos - s.ny * sin;
    const ry = s.nx * sin + s.ny * cos;
    if (ry < -0.2 || (rx < -0.15 && ry < 0.6)) return s.lit > 0.55 ? C.hairLit : C.hair;
    return skin(s);
  });
  const local = (/** @type {number} */ x, /** @type {number} */ y) =>
    /** @type {Vec} */ ([
      head[0] + x * Math.cos(headTilt) - y * Math.sin(headTilt),
      head[1] + x * Math.sin(headTilt) + y * Math.cos(headTilt),
    ]);
  const eye = local(3, 0.4);
  p.img.set(eye[0], eye[1], C.hair);

  drawArm(p, add(shoulder, [0.5, 0]), pose.nearHand, 0);
  p.img.outline(C.outline);
  return p.img;
}

/** The fighting stance, with a breath of `b` pixels. */
const stance = (/** @type {number} */ b) =>
  /** @type {Pose} */ ({
    hip: [0, 19.5 - b],
    lean: 8,
    near: {ankle: [7, 2.5]},
    far: {ankle: [-7, 2.5]},
    nearHand: [8.5, 1 + b * 0.6],
    farHand: [4.5, 2.5 + b * 0.4],
  });

/**
 * The animations in sheet order: name, Aseprite direction, Aseprite's "Repeat" (1 on the
 * one-shots, which play once and hold their last frame; absent loops), and per frame a pose and a
 * duration in milliseconds.
 * @type {{name: string, direction: 'forward' | 'pingpong', repeat?: number, color: string, frames: [Pose, number][]}[]}
 */
export const ANIMATIONS = [
  {
    name: 'idle',
    direction: 'pingpong',
    color: '#3f9fffff',
    frames: [
      [stance(0), 160],
      [stance(0.5), 140],
      [stance(1), 140],
      [stance(1.5), 160],
    ],
  },
  {
    name: 'walk',
    direction: 'forward',
    color: '#5fd35fff',
    frames: Array.from({length: 6}, (_, i) => {
      const phi = (i / 6) * Math.PI * 2;
      const leg = (/** @type {number} */ a) =>
        /** @type {Leg} */ ({ankle: [-6 * Math.cos(a), 2.5 + Math.max(0, Math.sin(a)) * 4]});
      const lift = 1 - Math.abs(Math.cos(phi));
      return /** @type {[Pose, number]} */ ([
        {
          hip: [0, 19.2 + lift * 1.2],
          lean: 6,
          near: leg(phi),
          far: leg(phi + Math.PI),
          nearHand: [8 - 1.5 * Math.cos(phi), 1.5],
          farHand: [4.5 + 1.5 * Math.cos(phi), 3],
        },
        100,
      ]);
    }),
  },
  {
    name: 'kick',
    direction: 'forward',
    repeat: 1,
    color: '#ff7f3fff',
    frames: [
      [
        {
          hip: [-1, 19.5],
          lean: -5,
          near: {ankle: [4, 16], toe: 60, bend: [0.7, -0.7]},
          far: {ankle: [-3, 2.5]},
          nearHand: [6, 2],
          farHand: [3.5, 3],
        },
        80,
      ],
      [
        {
          hip: [-1, 19.5],
          lean: -15,
          near: {ankle: [14, 22], toe: -10, bend: [0.2, -1]},
          far: {ankle: [-3, 2.5]},
          nearHand: [4, 3],
          farHand: [1, 4],
        },
        70,
      ],
      [
        {
          hip: [-1, 19.5],
          lean: -25,
          near: {ankle: [20, 27], toe: -15, bend: [0.2, -1]},
          far: {ankle: [-3, 2.5]},
          nearHand: [3, 3],
          farHand: [-2, 5],
        },
        320,
      ],
      [
        {
          hip: [-1, 19.5],
          lean: -8,
          near: {ankle: [5, 15], toe: 60, bend: [0.7, -0.7]},
          far: {ankle: [-3, 2.5]},
          nearHand: [6, 2],
          farHand: [3.5, 3],
        },
        90,
      ],
      [{...stance(0), near: {ankle: [5, 2.5]}}, 110],
    ],
  },
  {
    name: 'flying-kick',
    direction: 'forward',
    repeat: 1,
    color: '#ff3f6fff',
    frames: [
      [{hip: [0, 15], lean: 15, near: {ankle: [6, 2.5]}, far: {ankle: [-5, 2.5]}, nearHand: [7, 3], farHand: [4, 4]}, 100],
      [
        {
          hip: [2, 27],
          lean: 10,
          near: {ankle: [5, 12], toe: 40},
          far: {ankle: [-3, 8], toe: 50},
          nearHand: [6, -2],
          farHand: [3, 0],
        },
        90,
      ],
      [
        {
          hip: [4, 33],
          lean: 0,
          near: {ankle: [8, 24], toe: 30, bend: [0.6, -0.8]},
          far: {ankle: [-2, 18], toe: 60},
          nearHand: [6, 1],
          farHand: [3, 2],
        },
        90,
      ],
      [
        {
          hip: [4, 32],
          lean: -50,
          head: 20,
          near: {ankle: [24, 36], toe: -20, bend: [0, -1]},
          far: {ankle: [-2, 26], toe: 70, bend: [1, 0.3]},
          nearHand: [4, -1],
          farHand: [-3, 3],
        },
        380,
      ],
      [
        {
          hip: [3, 24],
          lean: -10,
          near: {ankle: [10, 12], toe: 20},
          far: {ankle: [-4, 8], toe: 50},
          nearHand: [6, 0],
          farHand: [3, 2],
        },
        100,
      ],
      [{hip: [1, 15], lean: 15, near: {ankle: [7, 2.5]}, far: {ankle: [-5, 2.5]}, nearHand: [7, 3], farHand: [4, 4]}, 140],
    ],
  },
  {
    name: 'hit',
    direction: 'forward',
    repeat: 1,
    color: '#bf3fffff',
    frames: [
      [
        {
          hip: [-2, 19],
          lean: -18,
          head: -15,
          near: {ankle: [5, 2.5]},
          far: {ankle: [-7, 2.5]},
          nearHand: [-2, 8],
          farHand: [-6, 4],
        },
        80,
      ],
      [
        {
          hip: [-4, 18],
          lean: -25,
          head: -20,
          near: {ankle: [3, 2.5]},
          far: {ankle: [-8, 2.5]},
          nearHand: [-5, 7],
          farHand: [-7, 2],
        },
        180,
      ],
      [{hip: [-2, 19], lean: -5, near: {ankle: [5, 2.5]}, far: {ankle: [-7, 2.5]}, nearHand: [6, 4], farHand: [3, 5]}, 160],
    ],
  },
];

/** The pixel the feet stand on, in canvas pixels: the `pivot` slice. */
export const PIVOT = {x: X0, y: CANVAS - 1};
