import {describeValue} from '../utils/describeValue.js';

/**
 * The pose of an art layer, and the key of a track: every field is optional, a pose writes what it
 * is given and keeps the rest. Units are those of the artwork — pixels of the canvas the art was
 * painted on.
 */
export interface ArtPose {
  /** Where the pivot stands, in artwork pixels. */
  x?: number;
  y?: number;
  /** Behind the plane, in artwork pixels; below 0 in front of it. */
  depth?: number;
  /** Clockwise, about the pivot. */
  deg?: number;
  /** About the pivot; 1 is the size of the box. */
  scaleX?: number;
  scaleY?: number;
  /** 0 … 1. */
  opacity?: number;
  /** An index into the frames of the layer, a whole number of 0 or more. */
  frame?: number;
  visible?: boolean;
  /** The stacking order within one depth, a whole number from -1024 to 1023. */
  order?: number;
}

// The slots of a pose in a Float64Array, and the bits of a field mask, in the order of POSE_FIELDS.
// `visible` is stored as 0 or 1.
export const POSE_X = 0;
export const POSE_Y = 1;
export const POSE_DEPTH = 2;
export const POSE_DEG = 3;
export const POSE_SCALE_X = 4;
export const POSE_SCALE_Y = 5;
export const POSE_OPACITY = 6;
export const POSE_FRAME = 7;
export const POSE_VISIBLE = 8;
export const POSE_ORDER = 9;
export const POSE_SIZE = 10;

export const POSE_FIELDS: readonly (keyof ArtPose)[] = [
  'x',
  'y',
  'depth',
  'deg',
  'scaleX',
  'scaleY',
  'opacity',
  'frame',
  'visible',
  'order',
];

/** The lowest and the highest `order` a layer takes. */
export const ORDER_MIN = -1024;
export const ORDER_MAX = 1023;

/** The slot of `field` in a pose, or -1 for a name that is no field of it. */
export const poseSlotOf = (field: string): number => POSE_FIELDS.indexOf(field as keyof ArtPose);

/**
 * Throws what `subject` refuses in a field of a pose: `Subject: name must be <why>, got <value>`.
 * The one place the messages of a refused field are built, for `set()` of a layer and for a track.
 */
export function refusePoseField(subject: string, field: string, value: unknown, why: string): never {
  throw new RangeError(`${subject}: ${field} must be ${why}, got ${describeValue(value)}`);
}

/**
 * Throws a `TypeError` for a key of a pose that is no field of it, `rotation` for `deg`: it names
 * the key and lists the fields a pose has, after the `extra` names that stand beside them where
 * it is found.
 */
export function refuseUnknownPoseField(subject: string, where: string, key: string, extra: readonly string[] = []): never {
  const known = [...extra, ...POSE_FIELDS].map((name) => describeValue(name)).join(', ');
  throw new TypeError(`${subject}: ${where} has no field ${describeValue(key)}; its fields are ${known}`);
}

/**
 * Throws a `RangeError` where `value` is not what the pose field `field` takes: a boolean for
 * `visible`, a number from 0 to 1 for `opacity`, a whole number of 0 or more for `frame` — the
 * frame count of the layer is for the caller to check —, a whole number from -1024 to 1023 for
 * `order`, a finite number for the rest. `name` is what the message calls the field, for a
 * track `keys[1].opacity`; the depth limit, which needs a camera, is not checked here.
 */
export function checkPoseField(subject: string, field: keyof ArtPose, value: unknown, name: string = field): void {
  switch (field) {
    case 'visible':
      if (typeof value !== 'boolean') refusePoseField(subject, name, value, 'a boolean');
      break;
    case 'opacity':
      if (typeof value !== 'number' || !(value >= 0 && value <= 1)) {
        refusePoseField(subject, name, value, 'a number from 0 to 1');
      }
      break;
    case 'frame':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        refusePoseField(subject, name, value, 'a whole number of 0 or more');
      }
      break;
    case 'order':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < ORDER_MIN || value > ORDER_MAX) {
        refusePoseField(subject, name, value, `a whole number from ${ORDER_MIN} to ${ORDER_MAX}`);
      }
      break;
    default:
      if (typeof value !== 'number' || !Number.isFinite(value)) refusePoseField(subject, name, value, 'a finite number');
  }
}
