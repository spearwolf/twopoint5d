import type {Texture} from 'three/webgpu';

import type {FeatureSpritesMaterialParameters} from '../sprites/FeatureSprites/FeatureSpritesMaterial.js';
import type {IProjection} from '../stage/IProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from '../stage/ProjectionPlane.js';
import {TextureAtlas} from '../texture/TextureAtlas.js';
import {TextureStore} from '../texture/TextureStore.js';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {isObject} from '../utils/isObject.js';
import {isRecord} from '../utils/isRecord.js';
import {artFrameOf} from './artLayout.js';
import {type ArtLayerDef, type ArtLayerOptions, checkArtSourceOptions, checkLayerDefs} from './artSources.js';

/**
 * Where an art takes its layers from (§3.2 of the proposal): an atlas item of a `TextureStore` —
 * an Aseprite sheet with split layers or a trimmed atlas —, or the same, already loaded, as an
 * atlas and its texture. With `layers` the layers are loose: each takes the frames and the place
 * its definition gives it. The art may be handed a promise of a source as well.
 */
export type StageArtSource =
  | {readonly store: TextureStore; readonly id: string; readonly layers?: readonly ArtLayerDef[]}
  | {readonly atlas: TextureAtlas<unknown>; readonly texture: Texture; readonly layers?: readonly ArtLayerDef[]};

/** The options of a `StageArt`. Every field is optional. */
export interface StageArtOptions {
  /** The name the messages of the art give it: `StageArt "kitchen": …`. */
  name?: string;
  /** Artwork pixels per unit of the stage. Default 1. */
  pxPerUnit?: number;
  /** The point of the canvas that lands on the origin of the art. Default the middle of the canvas, `[0, 0]` without one. */
  origin?: readonly [number, number];
  /** The point of the canvas the camera looks at in its rest, in artwork pixels. Default `origin`. */
  focus?: readonly [number, number];
  /** The projection of the stage — `stage.projection` —: its plane is the plane of the art. */
  projection?: IProjection;
  /** The plane of the art where the projection has none, or without a projection. Default `'xy|bottom-left'`. */
  plane?: ProjectionPlane | ProjectionPlaneDescription;
  /** Whether a layer at a depth is drawn as painted at the rest of a parallax camera. Default `true`. */
  compensateDepth?: boolean;
  /** The layers to take, in this stacking order, bottom first; a name the source lacks stays hidden. */
  only?: readonly string[];
  /** What code says about a layer that the picture cannot, by name. */
  layers?: Readonly<Record<string, ArtLayerOptions>>;
  /**
   * The parameters of the material of the mesh — `transparent` (default `true`), `depthWrite`
   * (default `false`), `depthTest`, `alphaTest`, … The textures, the placement and the mesh around
   * the material — its capacity, geometry and passes — are the art's own.
   */
  material?: Omit<FeatureSpritesMaterialParameters, 'textures' | 'placement' | 'resources' | 'pass'>;
}

/** An art holds at most this many layers: the index is the low part of `artOrder`, below 2^24 and so exact in a float32. */
export const MAX_LAYERS = 8192;

const OPTION_KEYS: readonly (keyof StageArtOptions)[] = [
  'name',
  'pxPerUnit',
  'origin',
  'focus',
  'projection',
  'plane',
  'compensateDepth',
  'only',
  'layers',
  'material',
];

// the keys of FeatureSprites that are no material parameter, and the material parameters the art sets itself
const OWN_MATERIAL_KEYS: readonly string[] = [
  'capacity',
  'geometry',
  'material',
  'grow',
  'passes',
  'attributeUsage',
  'baseArgs',
  'textures',
  'placement',
  'resources',
  'pass',
];

const PLANE_DESCRIPTIONS: readonly ProjectionPlaneDescription[] = [
  'xy|bottom-left',
  'xy|top-left',
  'xz|bottom-left',
  'xz|top-left',
];

const isProjection = (value: unknown): value is IProjection =>
  isObject(value) &&
  typeof value['updateViewRect'] === 'function' &&
  typeof value['getViewRect'] === 'function' &&
  typeof value['getScaleFactor'] === 'function' &&
  typeof value['createCamera'] === 'function' &&
  typeof value['updateCamera'] === 'function';

const isTexture = (value: unknown): value is Texture => isObject(value) && value['isTexture'] === true;

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

/** The shape of a source: an atlas item of a store, an atlas and its texture, or a promise of one. */
export type SourceShape = 'store' | 'atlas' | 'promise';

/** The shape of `source`, `undefined` for none — an object with a key no shape has among them. */
export function shapeOf(source: unknown): SourceShape | undefined {
  if (isObject(source) && typeof source['then'] === 'function') return 'promise';
  if (!isRecord(source)) return undefined;
  if (
    source['store'] instanceof TextureStore &&
    typeof source['id'] === 'string' &&
    hasOnlyKeys(source, ['store', 'id', 'layers'])
  ) {
    return 'store';
  }
  if (
    source['atlas'] instanceof TextureAtlas &&
    isTexture(source['texture']) &&
    hasOnlyKeys(source, ['atlas', 'texture', 'layers'])
  ) {
    return 'atlas';
  }
  return undefined;
}

/** The shapes of a source, as a message writes them. */
export const SHAPES = '{store, id} or {atlas, texture} — each with layers for loose layers —, or a promise of one';

/**
 * Throws what `new StageArt()` refuses of its source and its options (§8), each before anything is
 * built, and answers the options, the shape of the source and the subjects: `subject` for the art's
 * messages — `StageArt`, or `StageArt "<name>"` —, `where` for the refusals of the constructor —
 * `new StageArt()` until a name is given.
 */
export function checkStageArt(
  source: unknown,
  options: unknown,
): {options: StageArtOptions; shape: SourceShape; subject: string; where: string} {
  if (options !== undefined && !isRecord(options)) {
    throw new TypeError(`new StageArt(): the options must be an object, got ${describeValue(options)}`);
  }
  const opts: StageArtOptions = options ?? {};
  const {name} = opts;
  if (name !== undefined && typeof name !== 'string') {
    throw new TypeError(`new StageArt(): name must be a string, got ${describeValue(name)}`);
  }
  const subject = name === undefined ? 'StageArt' : `StageArt ${describeValue(name)}`;
  const where = name === undefined ? 'new StageArt()' : subject;
  for (const key of Object.keys(opts)) {
    if (!OPTION_KEYS.includes(key as keyof StageArtOptions)) {
      const known = OPTION_KEYS.map((option) => describeValue(option)).join(', ');
      throw new TypeError(`${where}: the options have no key ${describeValue(key)}; their keys are ${known}`);
    }
  }
  // checked here, worked out once the canvas is known
  artFrameOf(where, opts.pxPerUnit, opts.origin, opts.focus, undefined);
  if (opts.compensateDepth !== undefined && typeof opts.compensateDepth !== 'boolean') {
    throw new TypeError(`${where}: compensateDepth must be true or false, got ${describeValue(opts.compensateDepth)}`);
  }
  if (opts.projection !== undefined && !isProjection(opts.projection)) {
    throw new TypeError(
      `${where}: projection must be an IProjection — stage.projection —, got ${describeThreeValue(opts.projection, 'isObject3D')}`,
    );
  }
  const {plane} = opts;
  if (plane !== undefined && !(plane instanceof ProjectionPlane) && !PLANE_DESCRIPTIONS.includes(plane)) {
    throw new TypeError(
      `${where}: plane must be a ProjectionPlane or one of ${PLANE_DESCRIPTIONS.map((description) => describeValue(description)).join(', ')}, got ${describeThreeValue(plane, 'isPlane')}`,
    );
  }
  checkArtSourceOptions(where, {only: opts.only, layers: opts.layers});
  if (opts.only !== undefined && opts.only.length > MAX_LAYERS) {
    throw new RangeError(`${where}: only names ${opts.only.length} layers, and an art holds at most ${MAX_LAYERS}`);
  }
  const material: unknown = opts.material;
  if (material !== undefined) {
    if (!isRecord(material)) throw new TypeError(`${where}: material must be an object, got ${describeValue(material)}`);
    for (const key of OWN_MATERIAL_KEYS) {
      if (material[key] !== undefined) {
        throw new TypeError(
          `${where}: material.${key} is the art's own — the art builds its mesh for its layers and draws the frames of its source with it; material takes the parameters of the material alone`,
        );
      }
    }
  }

  const shape = shapeOf(source);
  if (shape === undefined) throw new TypeError(`${where}: the source must be ${SHAPES}, got ${describeValue(source)}`);
  const loose = shape !== 'promise' ? (source as {layers?: unknown}).layers : undefined;
  if (loose !== undefined) {
    if (opts.only !== undefined || opts.layers !== undefined) {
      throw new TypeError(
        `${where}: a source of loose layers names its layers itself — give each its options in the layers list of the source, and leave out only and layers`,
      );
    }
    checkLayerDefs(where, loose);
  }
  return {options: opts, shape, subject, where};
}
