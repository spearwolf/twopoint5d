import type {PreparedSpriteFrame} from '../sprites/features/AtlasFrame.js';
import type {AnimationTiming} from '../texture/animationFrameAt.js';
import {type AsepriteFrameTag, type AsepriteMetaData, asepriteMetaOf, framesOfTag} from '../texture/AsepriteJson.js';
import type {TextureAtlas, TextureAtlasFrame} from '../texture/TextureAtlas.js';
import {TextureCoords} from '../texture/TextureCoords.js';
import {assertFinite} from '../utils/assertFinite.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeValue} from '../utils/describeValue.js';
import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import {isObject} from '../utils/isObject.js';
import {isRecord} from '../utils/isRecord.js';
import {isStringList} from '../utils/isStringList.js';
import type {LayerBox} from './artLayout.js';
import {type ArtPose, checkPoseField, POSE_FIELDS, refuseUnknownPoseField} from './artPose.js';

/**
 * What code says about a layer that the picture cannot: an override of what the source says, or —
 * for loose layers, which take their frames and their place from code — all there is. Pixels are
 * artwork pixels on the canvas, save `pivot` of a loose layer, which is in pixels of its frame.
 */
export interface ArtLayerOptions {
  /** The point the layer stands on and turns about. */
  pivot?: readonly [number, number];
  /** Behind the plane, in artwork pixels; below 0 in front of it. */
  depth?: number;
  /** The stacking order within one depth, a whole number from -1024 to 1023. */
  order?: number;
  /** The frames of the layer, by name or as a `RegExp` over the names of the atlas. */
  frames?: readonly string[] | RegExp;
  /** A pose the layer starts in instead of the layout. */
  rest?: ArtPose;
  /** Where the pivot of a loose layer stands at rest; refused in the overrides of an atlas source. */
  at?: readonly [number, number];
  /** Artwork pixels per unit of the stage, for a loose layer; refused in the overrides of an atlas source. */
  pxPerUnit?: number;
}

/**
 * A loose layer — a prop out of an atlas, placed by code instead of a painted canvas —: its name and
 * what code says about it.
 */
export interface ArtLayerDef extends ArtLayerOptions {
  name: string;
}

/**
 * What an art could not load or read out of its source — no error, but an entry of `art.problems`,
 * said once on the console.
 */
export interface StageArtProblem {
  /** The layer it hides, `undefined` for the source as a whole. */
  layer: string | undefined;
  /** In the words of the library's messages. */
  reason: string;
  url?: string;
}

/** A frame of a layer: the atlas frame and where its picture lies on the canvas. */
export interface ArtFrameSpec {
  frame: TextureAtlasFrame<unknown>;
  box: LayerBox;
  /**
   * The texels of the atlas frame on every side of its picture — an inner padding —, which the tex
   * coords leave out.
   */
  inset?: number;
  /** The atlas frame is larger than its picture, but not by one whole number of texels on every side. */
  unevenInset?: true;
}

/** A tag of a layer: the layer frame of each step, and the timing `animationFrameAt()` reads. */
export interface ArtTagSpec extends AnimationTiming {
  readonly frames: readonly number[];
}

/**
 * A layer as the source gives it, overrides applied. A layer without a picture — one `only` names
 * that the source lacks, one whose frames are all empty — has a `box` of no size at its pivot: it
 * draws nothing, and an anchor in it is no number.
 */
export interface ArtLayerSpec {
  name: string;
  /** The union of the boxes of its frames. */
  box: LayerBox;
  pivotX: number;
  pivotY: number;
  depth: number;
  /** The frames, `undefined` for an empty cel; empty for a layer the source lacks. */
  frames: readonly (ArtFrameSpec | undefined)[];
  tags: ReadonlyMap<string, ArtTagSpec>;
  /** The `rest` of the overrides, a frozen copy; checked as a pose, save the frame count. */
  rest: Readonly<ArtPose> | undefined;
  /** The stacking order within one depth: the override, else 0. */
  order: number;
  at?: readonly [number, number];
  pxPerUnit?: number;
}

/** The options of an atlas source that pick and override its layers. */
export interface ArtSourceOptions {
  only?: readonly string[];
  layers?: Readonly<Record<string, ArtLayerOptions>>;
}

const LAYER_OPTION_KEYS: readonly (keyof ArtLayerOptions)[] = ['pivot', 'depth', 'order', 'frames', 'rest', 'at', 'pxPerUnit'];

const NO_TAGS: ReadonlyMap<string, ArtTagSpec> = new Map();

// a decimal number as a paint tool's user data or a file name writes it: no hex, no exponent, no blank
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

// --- checks ------------------------------------------------------------------------------------

function assertPair(subject: string, name: string, value: unknown): void {
  if (!Array.isArray(value) || value.length !== 2 || !isFiniteNumber(value[0]) || !isFiniteNumber(value[1])) {
    throw new TypeError(`${subject}: ${name} must be a pair of finite numbers, got ${describeValue(value)}`);
  }
}

function checkRest(subject: string, layer: string, rest: unknown): void {
  const where = `the rest of the layer ${describeValue(layer)}`;
  if (!isRecord(rest)) throw new TypeError(`${subject}: ${where} must be an object, got ${describeValue(rest)}`);
  for (const key of Object.keys(rest)) {
    if (!POSE_FIELDS.includes(key as keyof ArtPose)) refuseUnknownPoseField(subject, where, key);
    const value = rest[key];
    if (value !== undefined) checkPoseField(subject, key as keyof ArtPose, value, `the ${key} of ${where}`);
  }
}

// keys only a loose layer takes: an atlas source places its layers by the picture
const LOOSE_ONLY_KEYS: readonly (keyof ArtLayerOptions)[] = ['at', 'pxPerUnit'];

// throws for options of a layer that are no object, a key no option has — `at` and `pxPerUnit` outside
// a loose layer among them — and a value an option cannot take
function checkLayerOptions(subject: string, layer: string, options: unknown, loose: boolean): void {
  const of = `of the layer ${describeValue(layer)}`;
  if (!isRecord(options)) throw new TypeError(`${subject}: the options ${of} must be an object, got ${describeValue(options)}`);
  for (const key of Object.keys(options)) {
    if (!LAYER_OPTION_KEYS.includes(key as keyof ArtLayerOptions)) {
      const known = LAYER_OPTION_KEYS.map((name) => describeValue(name)).join(', ');
      throw new TypeError(`${subject}: the options ${of} have no key ${describeValue(key)}; their keys are ${known}`);
    }
    if (!loose && LOOSE_ONLY_KEYS.includes(key as keyof ArtLayerOptions) && options[key] !== undefined) {
      throw new TypeError(
        `${subject}: the options ${of} have ${key}, which only a loose layer takes — give a loose layer its at and pxPerUnit in the layers list of the source`,
      );
    }
  }
  const {pivot, depth, order, frames, rest, at, pxPerUnit} = options;
  if (pivot !== undefined) assertPair(subject, `the pivot ${of}`, pivot);
  if (depth !== undefined) assertFinite(depth, subject, `the depth ${of}`);
  if (order !== undefined) checkPoseField(subject, 'order', order, `the order ${of}`);
  if (frames !== undefined && !(frames instanceof RegExp) && !isStringList(frames)) {
    throw new TypeError(`${subject}: the frames ${of} must be a list of frame names or a RegExp, got ${describeValue(frames)}`);
  }
  if (rest !== undefined) checkRest(subject, layer, rest);
  if (at !== undefined) assertPair(subject, `the at ${of}`, at);
  if (pxPerUnit !== undefined) assertPositiveFinite(pxPerUnit, subject, `the pxPerUnit ${of}`);
}

/**
 * Throws what an art refuses in `only` and `layers` (stage-art-layers.md §8): `only` that is no list
 * of names or names a layer twice; `layers` that is no object; options of a layer that are no object,
 * have a key no option has, give `at` or `pxPerUnit` — which only a loose layer takes —, or a value
 * it cannot take — a `depth` that is no finite number, a `rest` field as `set()` refuses it.
 * `undefined` is not given. To be called when the art is made, before its source has loaded;
 * `readAtlasSource()` calls it too.
 */
export function checkArtSourceOptions(subject: string, options: {only?: unknown; layers?: unknown}): void {
  const {only, layers} = options;
  if (only !== undefined) {
    if (!isStringList(only)) throw new TypeError(`${subject}: only must be a list of layer names, got ${describeValue(only)}`);
    const seen = new Set<string>();
    for (const name of only) {
      if (seen.has(name)) throw new Error(`${subject}: only names the layer ${describeValue(name)} twice`);
      seen.add(name);
    }
  }
  if (layers !== undefined) {
    if (!isRecord(layers)) {
      throw new TypeError(`${subject}: layers must be an object of layer options by name, got ${describeValue(layers)}`);
    }
    for (const [name, layerOptions] of Object.entries(layers)) checkLayerOptions(subject, name, layerOptions, false);
  }
}

/**
 * Throws what an art refuses in the definitions of loose layers: no list, a definition that is no
 * object or is named by no string, a name twice, and what {@link checkArtSourceOptions} refuses in
 * the options of a layer.
 */
export function checkLayerDefs(subject: string, defs: unknown): void {
  if (!Array.isArray(defs)) {
    throw new TypeError(`${subject}: layers must be a list of layer definitions, got ${describeValue(defs)}`);
  }
  const seen = new Set<string>();
  for (const [index, def] of defs.entries()) {
    if (!isRecord(def)) throw new TypeError(`${subject}: the layer ${index} must be an object, got ${describeValue(def)}`);
    const {name, ...options} = def;
    if (typeof name !== 'string') {
      throw new TypeError(`${subject}: the layer ${index} must be named by a string, got ${describeValue(name)}`);
    }
    if (seen.has(name)) throw new Error(`${subject}: two layers are named ${describeValue(name)}`);
    seen.add(name);
    checkLayerOptions(subject, name, options, true);
  }
}

// --- frames and boxes ----------------------------------------------------------------------------

interface FramePlacement {
  /** Where the picture of the frame lies in its untrimmed sprite — on the canvas. */
  box: LayerBox;
  canvasW: number;
  canvasH: number;
}

// the spriteSourceSize and sourceSize of the frame data, where both are there and the one lies in the
// other — the conditions of frameTrimMargins()
function placementOf(data: unknown): FramePlacement | undefined {
  if (!isObject(data)) return undefined;
  const sss = data['spriteSourceSize'];
  const ss = data['sourceSize'];
  if (!isObject(sss) || !isObject(ss)) return undefined;
  const {x, y, w, h} = sss;
  const W = ss['w'];
  const H = ss['h'];
  if (
    isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(w) &&
    isFiniteNumber(h) &&
    isFiniteNumber(W) &&
    isFiniteNumber(H) &&
    w > 0 &&
    h > 0 &&
    x >= 0 &&
    y >= 0 &&
    x + w <= W &&
    y + h <= H
  ) {
    return {box: {x, y, w, h}, canvasW: W, canvasH: H};
  }
  return undefined;
}

// the measures the frame is drawn in: a frame drawn turned lies `height` wide in the texture
function drawnSizeOf(frame: TextureAtlasFrame<unknown>): [w: number, h: number] {
  const {width, height, flipD} = frame.coords;
  return flipD ? [height, width] : [width, height];
}

// Aseprite's entry for a cel without a pixel under --trim: 1 × 1 at the top left corner, trimmed, on a
// canvas larger than that (a ruling on the facts of the fixtures' README)
function isEmptyCel(frame: TextureAtlasFrame<unknown>, placement: FramePlacement | undefined): boolean {
  if (placement === undefined || !isObject(frame.data) || frame.data['trimmed'] !== true) return false;
  const {box, canvasW, canvasH} = placement;
  return box.x === 0 && box.y === 0 && box.w === 1 && box.h === 1 && canvasW * canvasH > 1;
}

// the frame `frame` at `box`, whose picture is `picture` large: an atlas frame larger than its picture —
// what an export with an inner padding writes, the frame grown by as many texels on every side — is
// drawn from the picture alone where it is grown by one whole number of texels on every side
function placedFrame(frame: TextureAtlasFrame<unknown>, box: LayerBox, picture: LayerBox): ArtFrameSpec {
  const [w, h] = drawnSizeOf(frame);
  const dw = w - picture.w;
  const dh = h - picture.h;
  if (dw === 0 && dh === 0) return {frame, box};
  if (dw === dh && dw > 0 && dw % 2 === 0) return {frame, box, inset: dw / 2};
  return {frame, box, unevenInset: true};
}

// the frame of `name` on the canvas: undefined for a name the atlas lacks and for an empty cel
function canvasFrameOf(atlas: TextureAtlas<unknown>, name: string): ArtFrameSpec | undefined {
  const frame = atlas.frame(name);
  if (frame === undefined) return undefined;
  const placement = placementOf(frame.data);
  if (isEmptyCel(frame, placement)) return undefined;
  if (placement !== undefined) return placedFrame(frame, placement.box, placement.box);
  const [w, h] = drawnSizeOf(frame);
  return {frame, box: {x: 0, y: 0, w, h}};
}

function unionOf(frames: readonly (ArtFrameSpec | undefined)[]): LayerBox | undefined {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const spec of frames) {
    if (spec === undefined) continue;
    const {x, y, w, h} = spec.box;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + w);
    y1 = Math.max(y1, y + h);
  }
  return x0 <= x1 ? {x: x0, y: y0, w: x1 - x0, h: y1 - y0} : undefined;
}

// the canvas of the first frame that tells it, among the frames of string names in the order of the atlas
function canvasOf(atlas: TextureAtlas<unknown>, names: readonly string[]): {width: number; height: number} | undefined {
  for (const name of names) {
    const placement = placementOf(atlas.frame(name)?.data);
    if (placement !== undefined) return {width: placement.canvasW, height: placement.canvasH};
  }
  return undefined;
}

const numericOrder = new Intl.Collator('en', {numeric: true});

// the names a `frames` option picks: a list as it is, a RegExp over the atlas in the natural order of
// the names, so that "steam#10" follows "steam#9" whatever order the packer wrote
function frameNamesOf(atlas: TextureAtlas<unknown>, frames: readonly string[] | RegExp): string[] {
  if (!(frames instanceof RegExp)) return [...frames];
  return (atlas.frameNames(frames) as string[]).sort(numericOrder.compare);
}

// the number n of a name `<…>#<n>`, or undefined
function frameNumberOf(name: string): number | undefined {
  const hash = name.lastIndexOf('#');
  if (hash < 0) return undefined;
  const digits = name.slice(hash + 1);
  return /^\d+$/.test(digits) ? Number(digits) : undefined;
}

// --- layers ----------------------------------------------------------------------------------------

/** A layer as a reader found it in the source, before the overrides. */
interface FoundLayer {
  name: string;
  frames: (ArtFrameSpec | undefined)[];
  pivot?: readonly [number, number];
  depth?: number;
  // a depth in the file that is no number: a problem unless an override gives the depth
  depthProblem?: string;
  tags: ReadonlyMap<string, ArtTagSpec>;
  // the tags an override of the frames left out: problems of the layer where the art takes it
  tagProblems?: string[];
}

function specOf(found: FoundLayer, options: ArtLayerOptions | undefined, problems: StageArtProblem[]): ArtLayerSpec {
  const pivot = options?.pivot ?? found.pivot;
  const union = unionOf(found.frames);
  const box = union ?? {x: pivot?.[0] ?? 0, y: pivot?.[1] ?? 0, w: 0, h: 0};
  if (options?.depth === undefined && found.depthProblem !== undefined) {
    problems.push({layer: found.name, reason: found.depthProblem});
  }
  for (const reason of found.tagProblems ?? []) problems.push({layer: found.name, reason});
  if (found.frames.some((frame) => frame?.unevenInset === true)) {
    problems.push({
      layer: found.name,
      reason: `a frame of the layer ${describeValue(found.name)} is larger in the atlas than its spriteSourceSize, but not by one whole number of texels on every side, and is drawn shrunk — export the sheet without --inner-padding, or with a padding of whole texels`,
    });
  }
  const spec: ArtLayerSpec = {
    name: found.name,
    box,
    pivotX: pivot?.[0] ?? box.x + box.w / 2,
    pivotY: pivot?.[1] ?? box.y + box.h / 2,
    depth: options?.depth ?? (found.depthProblem === undefined ? (found.depth ?? 0) : 0),
    frames: found.frames,
    tags: found.tags,
    rest: options?.rest === undefined ? undefined : Object.freeze({...options.rest}),
    order: options?.order ?? 0,
  };
  if (options?.at !== undefined) spec.at = [options.at[0], options.at[1]];
  if (options?.pxPerUnit !== undefined) spec.pxPerUnit = options.pxPerUnit;
  return spec;
}

const optionsOf = (layers: ArtSourceOptions['layers'], name: string): ArtLayerOptions | undefined =>
  layers !== undefined && Object.hasOwn(layers, name) ? layers[name] : undefined;

// a layer `only` names stays in the art without a picture; the options of one only `layers` names go unused
const lacksReason = (name: string, option: 'only' | 'layers') =>
  `the source has no layer ${describeValue(name)}, which ${option} names — ${option === 'only' ? 'the layer stays hidden' : 'its options go unused'}`;

// the layers in the order of the source, or of `only`; a name twice, a name of `only` and a name of
// `layers` the source lacks are problems. `failed`: the source failed as a whole and said so already
function pickLayers(
  found: readonly FoundLayer[],
  options: ArtSourceOptions,
  problems: StageArtProblem[],
  failed: boolean,
): ArtLayerSpec[] {
  const byName = new Map<string, FoundLayer>();
  for (const layer of found) {
    if (byName.has(layer.name)) {
      problems.push({
        layer: layer.name,
        reason: `two layers of the source are named ${describeValue(layer.name)} — the art takes the first; rename one of them`,
      });
      continue;
    }
    byName.set(layer.name, layer);
  }

  const {only, layers} = options;
  const picked: ArtLayerSpec[] = [];
  if (only === undefined) {
    for (const layer of byName.values()) picked.push(specOf(layer, optionsOf(layers, layer.name), problems));
  } else {
    for (const name of only) {
      const layer = byName.get(name);
      if (layer === undefined && !failed) problems.push({layer: name, reason: lacksReason(name, 'only')});
      picked.push(specOf(layer ?? {name, frames: [], tags: NO_TAGS}, optionsOf(layers, name), problems));
    }
  }

  if (layers !== undefined && !failed) {
    for (const name of Object.keys(layers)) {
      if (!byName.has(name) && !only?.includes(name)) problems.push({layer: name, reason: lacksReason(name, 'layers')});
    }
  }
  return picked;
}

/**
 * The frames of a source, by name: the frames of an atlas, or the files of a files source by their
 * frame names. The readers of the names of layer files and of the `frames` overrides read them
 * through it.
 */
interface NamedFrames {
  /** The string names, in the order of the source. */
  readonly names: readonly string[];
  /** What a message calls the source of the frames: `the atlas`, `the list of files`. */
  readonly what: string;
  /**
   * Whether a frame `<layer>-<suffix>` joins its layer only where it stands after the frame `<layer>`:
   * a list of files keeps the order of the paint file, a packer writes its frames in an order of its own.
   */
  readonly suffixFollowsBase: boolean;
  has(name: string): boolean;
  /** The names a `frames` option picks: a list as it is, a `RegExp` over the names in their natural order. */
  pick(frames: readonly string[] | RegExp): string[];
  /** The frame on the canvas; `undefined` for one without a picture. */
  frameOf(name: string): ArtFrameSpec | undefined;
  /** The box of a pivot marker, as it lies; `undefined` where it has none. */
  markerBoxOf(name: string): LayerBox | undefined;
}

function atlasFrames(atlas: TextureAtlas<unknown>): NamedFrames {
  return {
    names: atlas.frameNames().filter((name): name is string => typeof name === 'string'),
    what: 'the atlas',
    suffixFollowsBase: false,
    has: (name) => atlas.frame(name) !== undefined,
    pick: (frames) => frameNamesOf(atlas, frames),
    frameOf: (name) => canvasFrameOf(atlas, name),
    markerBoxOf: (name) => {
      // read as it lies, not as a cel: a dot at the top left pixel is a pivot, not an empty picture
      const marker = atlas.frame(name);
      if (marker === undefined) return undefined;
      const [w, h] = drawnSizeOf(marker);
      return placementOf(marker.data)?.box ?? {x: 0, y: 0, w, h};
    },
  };
}

// the frames a `frames` option names, each on the canvas; a name the source lacks is a problem of the layer
function overrideFrames(
  source: NamedFrames,
  layer: string,
  frames: readonly string[] | RegExp,
  problems: StageArtProblem[],
): {names: string[]; frames: (ArtFrameSpec | undefined)[]} {
  const names: string[] = [];
  const specs: (ArtFrameSpec | undefined)[] = [];
  for (const name of source.pick(frames)) {
    if (!source.has(name)) {
      problems.push({
        layer,
        reason: `the frame ${describeValue(name)} of the layer ${describeValue(layer)} is not in ${source.what}`,
      });
      continue;
    }
    names.push(name);
    specs.push(source.frameOf(name));
  }
  if (names.length === 0 && frames instanceof RegExp) {
    problems.push({layer, reason: `the frames of the layer ${describeValue(layer)} match no frame of ${source.what}`});
  }
  return {names, frames: specs};
}

// --- Aseprite (stage-art-layers.md §4.1) ----------------------------------------------------------

// the token depth=… of a user data text: its number, or the text that is none
function depthTokenOf(data: unknown): {depth: number} | {bad: string} | undefined {
  if (typeof data !== 'string') return undefined;
  const match = /(?:^|\s)depth=(\S*)/.exec(data);
  if (match === null) return undefined;
  const token = match[1]!;
  return DECIMAL.test(token) ? {depth: Number(token)} : {bad: token};
}

// the pivot of a slice on the canvas, from its first key: the bottom left corner of the pixel it marks,
// as setAnchorFromPivot() reads it
function slicePivots(meta: AsepriteMetaData): Map<string, readonly [number, number]> {
  const pivots = new Map<string, readonly [number, number]>();
  for (const slice of meta.slices ?? []) {
    let first: (typeof slice.keys)[number] | undefined;
    for (const key of slice.keys ?? []) if (first === undefined || key.frame < first.frame) first = key;
    if (first?.pivot != null) {
      pivots.set(slice.name, [first.bounds.x + first.pivot.x, first.bounds.y + first.pivot.y + 1]);
    }
  }
  return pivots;
}

// every tag of the sheet as the layer frames — the frames of the sprite — it steps through, with the
// durations of the sprite's frames; a tag past the frames or without a duration is a problem
function asepriteTags(
  meta: AsepriteMetaData,
  frameCount: number,
  durations: ReadonlyMap<number, number>,
  problems: StageArtProblem[],
): Map<string, ArtTagSpec> {
  const tags = new Map<string, ArtTagSpec>();
  for (const tag of (meta.frameTags ?? []) as AsepriteFrameTag[]) {
    const {indices, playback} = framesOfTag(tag, undefined);
    if (indices.some((index) => index >= frameCount)) {
      problems.push({
        layer: undefined,
        reason: `the tag ${describeValue(tag.name)} runs past the ${frameCount} frames of the sprite — the art leaves it out`,
      });
      continue;
    }
    const seconds = indices.map((index) => durations.get(index));
    if (seconds.some((duration) => duration === undefined)) {
      problems.push({
        layer: undefined,
        reason: `the tag ${describeValue(tag.name)} holds a frame without a picture in any layer, and so without a duration — the art leaves it out`,
      });
      continue;
    }
    const even = seconds.every((duration) => duration === seconds[0]);
    tags.set(
      tag.name,
      Object.freeze({
        frames: Object.freeze(indices),
        frameCount: indices.length,
        duration: seconds.reduce<number>((sum, duration) => sum + duration!, 0),
        durations: even ? undefined : Object.freeze(seconds as number[]),
        playback,
      }),
    );
  }
  return tags;
}

// the tags of a layer whose frames an override names: a step of a tag shows the frame named `…#<n>`
// for the frame n of the sprite; a tag with a step no such frame shows is left out, and the reason why
// goes into `reasons`
function remappedTags(
  layer: string,
  tags: ReadonlyMap<string, ArtTagSpec>,
  names: readonly string[],
  reasons: string[],
): Map<string, ArtTagSpec> {
  const indexOfNumber = new Map<number, number>();
  names.forEach((name, index) => {
    const n = frameNumberOf(name);
    if (n !== undefined && !indexOfNumber.has(n)) indexOfNumber.set(n, index);
  });
  const remapped = new Map<string, ArtTagSpec>();
  for (const [name, tag] of tags) {
    const missing = tag.frames.find((n) => !indexOfNumber.has(n));
    if (missing !== undefined) {
      reasons.push(
        `the frames of the layer ${describeValue(layer)} show no frame ${missing} of the sprite, which the tag ${describeValue(name)} steps through — the layer leaves the tag out`,
      );
      continue;
    }
    remapped.set(name, Object.freeze({...tag, frames: Object.freeze(tag.frames.map((n) => indexOfNumber.get(n)!))}));
  }
  return remapped;
}

interface MetaLayer {
  name: string;
  group?: string;
  data?: unknown;
}

function readAseprite(
  atlas: TextureAtlas<unknown>,
  meta: AsepriteMetaData,
  options: ArtSourceOptions,
  problems: StageArtProblem[],
): {canvas: {width: number; height: number} | undefined; found: FoundLayer[]; failed: boolean} {
  const named = atlasFrames(atlas);
  const frameNames = named.names;

  // the frames `{layer}#{frame}` of each layer, and the duration of each frame of the sprite. A name
  // `#<n>` names no layer: Aseprite writes it where --split-layers stood after the file and split nothing
  const framesByLayer = new Map<string, Map<number, string>>();
  const durations = new Map<number, number>();
  for (const name of frameNames) {
    const n = frameNumberOf(name);
    if (n === undefined) continue;
    const layer = name.slice(0, name.lastIndexOf('#'));
    if (layer === '') continue;
    let frames = framesByLayer.get(layer);
    if (frames === undefined) framesByLayer.set(layer, (frames = new Map()));
    frames.set(n, name);
    const data = atlas.frame(name)?.data;
    const duration = isObject(data) ? data['duration'] : undefined;
    if (!durations.has(n) && isFiniteNumber(duration) && duration > 0) durations.set(n, duration / 1000);
  }

  // the layers of meta.layers, bottom first; a group — an entry a later entry names as its group — is none.
  // Without meta.layers, the layers the frames name, in the order of the sheet
  const groups = new Map<string, MetaLayer>();
  const metaLayers: MetaLayer[] = [];
  if (Array.isArray(meta.layers)) {
    const entries: unknown[] = meta.layers;
    entries.forEach((entry, index) => {
      if (!isRecord(entry) || typeof entry['name'] !== 'string') {
        problems.push({
          layer: undefined,
          reason: `meta.layers holds ${describeValue(entry)}, which is no layer — the art leaves it out`,
        });
        return;
      }
      const layer: MetaLayer = {
        name: entry['name'],
        group: typeof entry['group'] === 'string' ? entry['group'] : undefined,
        data: entry['data'],
      };
      const isGroup = entries.slice(index + 1).some((later) => isRecord(later) && later['group'] === layer.name);
      if (isGroup) groups.set(layer.name, layer);
      else metaLayers.push(layer);
    });
  } else {
    for (const name of framesByLayer.keys()) metaLayers.push({name});
  }

  // a sheet whose frames name no layer was exported without split layers or with
  // another filename format — one problem of the source, not an art of empty layers
  if (!metaLayers.some(({name}) => framesByLayer.has(name))) {
    problems.push({
      layer: undefined,
      reason: `no frame of the sheet is named after one of its layers — export it with --split-layers before the file and --filename-format '{layer}#{frame}'`,
    });
    return {canvas: canvasOf(atlas, frameNames), found: [], failed: true};
  }

  let frameCount = 0;
  for (const {name} of metaLayers) {
    for (const n of framesByLayer.get(name)?.keys() ?? []) frameCount = Math.max(frameCount, n + 1);
  }
  const tags = asepriteTags(meta, frameCount, durations, problems);
  const pivots = slicePivots(meta);

  const found: FoundLayer[] = [];
  for (const metaLayer of metaLayers) {
    const {name} = metaLayer;
    const layer: FoundLayer = {name, frames: [], tags};
    const override = optionsOf(options.layers, name)?.frames;
    if (override !== undefined) {
      const picked = overrideFrames(named, name, override, problems);
      layer.frames = picked.frames;
      layer.tagProblems = [];
      layer.tags = remappedTags(name, tags, picked.names, layer.tagProblems);
    } else {
      const byNumber = framesByLayer.get(name);
      layer.frames = Array.from({length: frameCount}, (_, n) => {
        const frameName = byNumber?.get(n);
        return frameName === undefined ? undefined : canvasFrameOf(atlas, frameName);
      });
      if (layer.frames.every((frame) => frame === undefined)) {
        problems.push({layer: name, reason: `the sheet holds no picture of the layer ${describeValue(name)}`});
      }
    }
    const pivot = pivots.get(name);
    if (pivot !== undefined) layer.pivot = pivot;

    // its own depth, else the depth of the nearest group around it that has one
    let token = depthTokenOf(metaLayer.data);
    let from = `the user data of the layer ${describeValue(name)}`;
    const visited = new Set<string>();
    for (let group = metaLayer.group; token === undefined && group !== undefined && !visited.has(group); ) {
      visited.add(group);
      const groupLayer = groups.get(group);
      token = depthTokenOf(groupLayer?.data);
      from = `the user data of its group ${describeValue(group)}`;
      group = groupLayer?.group;
    }
    if (token !== undefined && 'depth' in token) layer.depth = token.depth;
    if (token !== undefined && 'bad' in token) {
      layer.depthProblem = `${from} gives a depth of ${describeValue(token.bad)}, which is no number — the layer stands on the plane`;
    }
    found.push(layer);
  }

  // a layer the overrides make of frames of their own stands above the layers of the sheet
  for (const [name, layerOptions] of Object.entries(options.layers ?? {})) {
    if (layerOptions.frames === undefined || metaLayers.some((layer) => layer.name === name)) continue;
    const picked = overrideFrames(named, name, layerOptions.frames, problems);
    const tagProblems: string[] = [];
    found.push({name, frames: picked.frames, tags: remappedTags(name, tags, picked.names, tagProblems), tagProblems});
  }

  const layerNames = new Set(found.map(({name}) => name));
  for (const sliceName of pivots.keys()) {
    if (!layerNames.has(sliceName)) {
      problems.push({layer: undefined, reason: `the slice ${describeValue(sliceName)} has a pivot but names no layer`});
    }
  }

  return {canvas: canvasOf(atlas, frameNames), found, failed: false};
}

// --- names of layer files (stage-art-layers.md §4.2): a trimmed atlas, a list of layer files ------

// `<layer>@<depth>`: the depth right after the name of the layer, before a `#n`, a `-suffix` or `.pivot`
const DEPTH_IN_NAME = /^(.+?)@([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?=$|[#-]|\.pivot$)(.*)$/;

const PIVOT_SUFFIX = '.pivot';

/** What the name of a frame or a file says by itself, after the names of layer files. */
export interface LayerFileName {
  /**
   * The name without its depth: a layer, or a frame `<layer>-<suffix>` of one — which of the two
   * only the other names of the source can tell —, a numbered frame or a pivot marker.
   */
  name: string;
  /** The depth of `<layer>@<depth>`, in artwork pixels. */
  depth?: number;
  /** The layer whose pivot a marker `<layer>.pivot` marks. */
  pivotOf?: string;
  /** The layer whose frame `frame` a numbered name `<layer>#<n>` is. */
  frameOf?: string;
  frame?: number;
}

/**
 * Reads the name of a frame of a trimmed atlas or of a layer file — without its extension —:
 * `window@600` is `window` at a depth of 600, `wall@-120` one in front of the plane, `steam#3`
 * the frame 3 of `steam`, `carafe5.pivot` the pivot marker of `carafe5`. A mark with no name before
 * it, and an `@` without a number, are part of the name.
 */
export function parseLayerFileName(name: string): LayerFileName {
  const match = DEPTH_IN_NAME.exec(name);
  const plain = match === null ? name : match[1]! + match[3]!;
  const parsed: LayerFileName = {name: plain};
  if (match !== null) parsed.depth = Number(match[2]);
  if (plain.endsWith(PIVOT_SUFFIX) && plain.length > PIVOT_SUFFIX.length) {
    parsed.pivotOf = plain.slice(0, -PIVOT_SUFFIX.length);
    return parsed;
  }
  const n = frameNumberOf(plain);
  const hash = plain.lastIndexOf('#');
  if (n !== undefined && hash > 0) {
    parsed.frameOf = plain.slice(0, hash);
    parsed.frame = n;
  }
  return parsed;
}

/** The frame name of a layer file: its name without the directory and the extension — `carafe5.pivot` of `art/carafe5.pivot.png`. */
export function frameNameOfFile(file: string): string {
  const base = file.slice(file.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

interface NamedLayer {
  name: string;
  // the index in the source of its first frame: its place in the stack
  position: number;
  base?: string;
  suffixed: string[];
  numbered: Map<number, string>;
  override?: {names: string[]; frames: (ArtFrameSpec | undefined)[]};
  depth?: number;
  pivot?: readonly [number, number];
  marker?: string;
}

/** A layer of {@link readNamedFrames}, with the names of the frames and the marker it took. */
interface NamedFoundLayer extends FoundLayer {
  taken: readonly string[];
}

// the layers the names of layer files make of the frames of `source`, in the order of their first
// frames, the `frames` overrides applied; what the names cannot give is a problem
function readNamedFrames(source: NamedFrames, options: ArtSourceOptions, problems: StageArtProblem[]): NamedFoundLayer[] {
  const frameNames = source.names;
  const positionOf = new Map<string, number>();
  frameNames.forEach((name, index) => {
    if (!positionOf.has(name)) positionOf.set(name, index);
  });

  const layers = new Map<string, NamedLayer>();
  const layerOf = (name: string, position: number): NamedLayer => {
    let layer = layers.get(name);
    if (layer === undefined) layers.set(name, (layer = {name, position, suffixed: [], numbered: new Map()}));
    layer.position = Math.min(layer.position, position);
    return layer;
  };

  // what each name says by itself
  const parsedOf = new Map(frameNames.map((name) => [name, parseLayerFileName(name)]));
  const giveDepth = (layer: NamedLayer, frameName: string) => {
    const depth = parsedOf.get(frameName)?.depth;
    if (depth === undefined) return;
    if (layer.depth === undefined) layer.depth = depth;
    else if (layer.depth !== depth) {
      problems.push({
        layer: layer.name,
        reason: `the frames of the layer ${describeValue(layer.name)} give the depths ${layer.depth} and ${depth} — the art takes the first`,
      });
    }
  };

  // the frames an override names are its layer's alone
  const claimed = new Set<string>();
  for (const [name, layerOptions] of Object.entries(options.layers ?? {})) {
    if (layerOptions.frames === undefined) continue;
    const picked = overrideFrames(source, name, layerOptions.frames, problems);
    if (picked.names.length === 0) continue;
    const layer = layerOf(name, Math.min(...picked.names.map((frameName) => positionOf.get(frameName) ?? frameNames.length)));
    layer.override = picked;
    for (const frameName of picked.names) {
      claimed.add(frameName);
      giveDepth(layer, frameName);
    }
  }

  // `<layer>.pivot`, `<layer>#<n>`, and plain names, which are layers or `-suffix` frames
  const markers: [frameName: string, layer: string][] = [];
  const plain: string[] = [];
  for (const frameName of frameNames) {
    if (claimed.has(frameName)) continue;
    const parsed = parsedOf.get(frameName)!;
    if (parsed.pivotOf !== undefined) {
      markers.push([frameName, parsed.pivotOf]);
      continue;
    }
    if (parsed.frameOf !== undefined) {
      const layer = layerOf(parsed.frameOf, positionOf.get(frameName)!);
      layer.numbered.set(parsed.frame!, frameName);
      giveDepth(layer, frameName);
      continue;
    }
    plain.push(frameName);
  }

  // a plain name `<layer>-<suffix>` is a frame of the longest layer before a hyphen — in a source that
  // keeps the order of the paint file, only where the frame `<layer>` stands before it; shorter names
  // are decided first, so the layers before a hyphen are known when a name is
  const plainNameOf = (frameName: string) => parsedOf.get(frameName)!.name;
  const sorted = [...plain].sort((a, b) => plainNameOf(a).length - plainNameOf(b).length);
  const suffixOf = new Map<string, string>();
  const joins = (layer: NamedLayer | undefined, frameName: string): boolean => {
    if (layer === undefined || layer.override !== undefined) return false;
    if (!source.suffixFollowsBase) return true;
    return layer.base !== undefined && positionOf.get(layer.base)! < positionOf.get(frameName)!;
  };
  for (const frameName of sorted) {
    const name = plainNameOf(frameName);
    for (let hyphen = name.lastIndexOf('-'); hyphen > 0; hyphen = name.lastIndexOf('-', hyphen - 1)) {
      const prefix = name.slice(0, hyphen);
      if (joins(layers.get(prefix), frameName)) {
        suffixOf.set(frameName, prefix);
        break;
      }
    }
    if (!suffixOf.has(frameName)) {
      const layer = layers.get(name);
      if (layer?.override === undefined && layer?.base !== undefined) {
        problems.push({
          layer: name,
          reason: `two layers of the source are named ${describeValue(name)} — the art takes the first; rename one of them`,
        });
        continue;
      }
      if (layer?.override !== undefined) continue;
      const created = layerOf(name, positionOf.get(frameName)!);
      created.base = frameName;
      giveDepth(created, frameName);
    }
  }
  // the suffixed frames of a layer in the order of the source
  for (const frameName of plain) {
    const prefix = suffixOf.get(frameName);
    if (prefix === undefined) continue;
    const layer = layerOf(prefix, positionOf.get(frameName)!);
    layer.suffixed.push(frameName);
    giveDepth(layer, frameName);
  }

  for (const [frameName, name] of markers) {
    const layer = layers.get(name);
    if (layer === undefined) {
      problems.push({layer: undefined, reason: `the pivot marker ${describeValue(frameName)} names no layer`});
      continue;
    }
    layer.marker = frameName;
    const box = source.markerBoxOf(frameName);
    if (box !== undefined) layer.pivot = [box.x + box.w / 2, box.y + box.h / 2];
  }

  const found: NamedFoundLayer[] = [];
  for (const layer of [...layers.values()].sort((a, b) => a.position - b.position)) {
    let names: string[];
    let frames: (ArtFrameSpec | undefined)[];
    if (layer.override !== undefined) {
      names = layer.override.names;
      frames = layer.override.frames;
    } else if (layer.numbered.size > 0) {
      const named = [layer.base, ...layer.suffixed].filter((name) => name !== undefined);
      if (named.length > 0) {
        problems.push({
          layer: layer.name,
          reason: `the layer ${describeValue(layer.name)} mixes numbered frames with ${named.map((name) => describeValue(name)).join(', ')} — the art takes the numbered ones`,
        });
      }
      const count = Math.max(...layer.numbered.keys()) + 1;
      names = [...layer.numbered.values()];
      frames = Array.from({length: count}, (_, n) => {
        const frameName = layer.numbered.get(n);
        return frameName === undefined ? undefined : source.frameOf(frameName);
      });
    } else {
      names = [layer.base, ...layer.suffixed].filter((name) => name !== undefined);
      frames = names.map((name) => source.frameOf(name));
    }
    const spec: NamedFoundLayer = {
      name: layer.name,
      frames,
      tags: NO_TAGS,
      taken: layer.marker === undefined ? names : [...names, layer.marker],
    };
    if (layer.depth !== undefined) spec.depth = layer.depth;
    if (layer.pivot !== undefined) spec.pivot = layer.pivot;
    found.push(spec);
  }
  return found;
}

// a trimmed atlas: the names of layer files over the frames of the atlas; the canvas is the
// sourceSize of its first frame that tells one, and a frame on another canvas is a problem of its layer
function readTrimmedAtlas(
  atlas: TextureAtlas<unknown>,
  options: ArtSourceOptions,
  problems: StageArtProblem[],
): {canvas: {width: number; height: number} | undefined; found: FoundLayer[]} {
  const source = atlasFrames(atlas);
  const found = readNamedFrames(source, options, problems);
  const canvas = canvasOf(atlas, source.names);
  if (canvas !== undefined) {
    for (const layer of found) {
      for (const spec of layer.frames) {
        const placement = spec === undefined ? undefined : placementOf(spec.frame.data);
        if (placement !== undefined && (placement.canvasW !== canvas.width || placement.canvasH !== canvas.height)) {
          problems.push({
            layer: layer.name,
            reason: `a frame of the layer ${describeValue(layer.name)} lies on a canvas of ${placement.canvasW} × ${placement.canvasH}, the first frame of the atlas on one of ${canvas.width} × ${canvas.height}`,
          });
          break;
        }
      }
    }
  }
  return {canvas, found};
}

/**
 * Reads the layers of an atlas source (stage-art-layers.md §4.1, §4.3): an Aseprite sheet with split
 * layers where `asepriteMetaOf()` answers its `meta`, else a trimmed atlas with the names of layer
 * files. The overrides of `options.layers` beat what the source says; `options.only` picks the layers
 * and their order. What the source cannot give is a problem; what the options cannot take is refused
 * first, by {@link checkArtSourceOptions}.
 */
export function readAtlasSource(
  subject: string,
  atlas: TextureAtlas<unknown>,
  options: ArtSourceOptions = {},
): {canvas: {width: number; height: number} | undefined; layers: ArtLayerSpec[]; problems: StageArtProblem[]} {
  checkArtSourceOptions(subject, options);
  const problems: StageArtProblem[] = [];
  const meta = asepriteMetaOf(atlas);
  if (meta !== undefined) {
    const {canvas, found, failed} = readAseprite(atlas, meta, options, problems);
    return {canvas, layers: pickLayers(found, options, problems, failed), problems};
  }
  const {canvas, found} = readTrimmedAtlas(atlas, options, problems);
  return {canvas, layers: pickLayers(found, options, problems, false), problems};
}

// --- layer files (stage-art-layers.md §4.2) -------------------------------------------------------

/**
 * What became of one file of a files source: its trimmed `box` on the canvas and, for a file that is
 * drawn, its `frame` in the atlas of the art; a `box` of `undefined` for a file without a pixel; or
 * the `problem` that kept it out — it did not load, it is no image, it lies on another canvas.
 */
export type LayerFileResult =
  | {readonly url: string; readonly box: LayerBox; readonly frame?: TextureAtlasFrame<unknown>}
  | {readonly url: string; readonly box: undefined}
  | {readonly url: string; readonly problem: string};

/**
 * Reads the layers of a files source (stage-art-layers.md §4.2): the order of `files` is the
 * stacking order, bottom first; each file is a layer or a frame of one by its name without the
 * extension, read after {@link parseLayerFileName} — a file `<layer>-<suffix>` is a frame of
 * `<layer>` only where it stands after the file of the layer, else a layer of its own; a pivot
 * marker is not drawn, the middle of its box is the pivot of its layer. `results` holds what the
 * load made of each file, in the order of `files`, and before the load is `undefined`: the list
 * alone names the layers then. A file that failed is a problem of its layer with its url, in the
 * order of the list, and so is a layer whose files hold no pixel; the overrides of `options` work
 * as on an atlas, a `frames` override naming files by their frame names. What the options cannot
 * take is refused first, by {@link checkArtSourceOptions}.
 */
export function readLayerFiles(
  subject: string,
  files: readonly string[],
  results: readonly LayerFileResult[] | undefined,
  canvas: {width: number; height: number} | undefined,
  options: ArtSourceOptions = {},
): {canvas: {width: number; height: number} | undefined; layers: ArtLayerSpec[]; problems: StageArtProblem[]} {
  checkArtSourceOptions(subject, options);
  const problems: StageArtProblem[] = [];
  const names = files.map(frameNameOfFile);
  // the result of the first file of each frame name: a second file of the name is a layer of the name twice
  const resultOf = new Map<string, LayerFileResult>();
  const fileOf = new Map<string, string>();
  names.forEach((name, index) => {
    if (fileOf.has(name)) return;
    fileOf.set(name, files[index]!);
    const result = results?.[index];
    if (result !== undefined) resultOf.set(name, result);
  });
  const boxOf = (name: string): LayerBox | undefined => {
    const result = resultOf.get(name);
    return result !== undefined && 'box' in result ? result.box : undefined;
  };

  const source: NamedFrames = {
    names,
    what: 'the list of files',
    suffixFollowsBase: true,
    has: (name) => fileOf.has(name),
    pick: (frames) => {
      if (!(frames instanceof RegExp)) return [...frames];
      // a copy, so that every name is tested from its start whatever the flags of the RegExp
      const regex = new RegExp(frames);
      return [...fileOf.keys()]
        .filter((name) => {
          regex.lastIndex = 0;
          return regex.test(name);
        })
        .sort(numericOrder.compare);
    },
    frameOf: (name) => {
      const result = resultOf.get(name);
      return result !== undefined && 'frame' in result && result.frame !== undefined
        ? {frame: result.frame, box: result.box}
        : undefined;
    },
    markerBoxOf: boxOf,
  };
  const found = readNamedFrames(source, options, problems);

  if (results !== undefined) {
    // the problems of the files, in the order of the list, each for the layer that took the file
    const ownerOf = new Map<string, string>();
    for (const layer of found) for (const name of layer.taken) ownerOf.set(name, layer.name);
    names.forEach((name, index) => {
      const result = results[index];
      if (result === undefined) return;
      const layer = ownerOf.get(name);
      if ('problem' in result) {
        problems.push({layer, reason: result.problem, url: result.url});
      } else if (result.box === undefined && layer !== undefined && parseLayerFileName(name).pivotOf !== undefined) {
        problems.push({
          layer,
          reason: `the pivot marker ${describeValue(files[index]!)} holds no pixel with an alpha above 0 — the layer turns about the middle of its box`,
          url: result.url,
        });
      }
    });
    // a layer whose files all loaded and hold no pixel is left without a picture: said once for the layer
    const isEmpty = (name: string) => {
      const result = resultOf.get(name);
      return result !== undefined && 'box' in result && result.box === undefined;
    };
    for (const layer of found) {
      const drawn = layer.taken.filter((name) => parseLayerFileName(name).pivotOf === undefined);
      if (drawn.length === 0 || !drawn.every(isEmpty)) continue;
      const which = drawn.map((name) => describeValue(fileOf.get(name)!));
      const problem: StageArtProblem =
        which.length === 1
          ? {
              layer: layer.name,
              reason: `the file ${which[0]} of the layer ${describeValue(layer.name)} holds no pixel with an alpha above 0`,
            }
          : {
              layer: layer.name,
              reason: `the files ${which.join(', ')} of the layer ${describeValue(layer.name)} hold no pixel with an alpha above 0`,
            };
      const url = which.length === 1 ? resultOf.get(drawn[0]!)?.url : undefined;
      if (url !== undefined) problem.url = url;
      problems.push(problem);
    }
  }
  return {canvas, layers: pickLayers(found, options, problems, false), problems};
}

// --- loose layers (stage-art-layers.md §4.5) ------------------------------------------------------

/**
 * Reads loose layers (stage-art-layers.md §4.5): each takes the frames its `frames` names — the
 * frame of its name without them —, its `pivot` in pixels of its first frame — the middle of the
 * frame without one — stands at its `at`, `[0, 0]` without one, and every frame lies where it lies
 * in its untrimmed sprite. A frame the atlas lacks is a problem of its layer; what the definitions
 * cannot take is refused first, by {@link checkLayerDefs}.
 */
export function readLooseLayers(
  subject: string,
  atlas: TextureAtlas<unknown>,
  defs: readonly ArtLayerDef[],
): {layers: ArtLayerSpec[]; problems: StageArtProblem[]} {
  checkLayerDefs(subject, defs);
  const problems: StageArtProblem[] = [];
  const layers = defs.map((def) => {
    const {name} = def;
    const at = def.at ?? [0, 0];
    const frames: TextureAtlasFrame<unknown>[] = [];
    for (const frameName of frameNamesOf(atlas, def.frames ?? [name])) {
      const frame = atlas.frame(frameName);
      if (frame === undefined) {
        problems.push({
          layer: name,
          reason: `the frame ${describeValue(frameName)} of the layer ${describeValue(name)} is not in the atlas`,
        });
      } else {
        frames.push(frame);
      }
    }
    if (frames.length === 0 && def.frames instanceof RegExp) {
      problems.push({layer: name, reason: `the frames of the layer ${describeValue(name)} match no frame of the atlas`});
    }

    // the untrimmed sprite of each frame, its top left corner where the pivot puts the first one
    const spriteSizeOf = (frame: TextureAtlasFrame<unknown>): [w: number, h: number] => {
      const placement = placementOf(frame.data);
      return placement === undefined ? drawnSizeOf(frame) : [placement.canvasW, placement.canvasH];
    };
    const [firstW, firstH] = frames.length > 0 ? spriteSizeOf(frames[0]!) : [0, 0];
    const pivot = def.pivot ?? [firstW / 2, firstH / 2];
    const left = at[0] - pivot[0];
    const top = at[1] - pivot[1];
    const specs = frames.map((frame): ArtFrameSpec => {
      const placement = placementOf(frame.data);
      if (placement !== undefined) {
        const {x, y, w, h} = placement.box;
        return placedFrame(frame, {x: left + x, y: top + y, w, h}, placement.box);
      }
      const [w, h] = drawnSizeOf(frame);
      return {frame, box: {x: left, y: top, w, h}};
    });
    return specOf({name, frames: specs, pivot: at, tags: NO_TAGS}, {...def, at, pivot: at}, problems);
  });
  return {layers, problems};
}

// --- frames for the mesh ---------------------------------------------------------------------------

// the coords of the picture inside an atlas frame grown by `inset` texels on every side, flipped as the frame
function insetCoords(coords: TextureCoords, inset: number): TextureCoords {
  const inner = new TextureCoords(coords, inset, inset, coords.width - 2 * inset, coords.height - 2 * inset);
  inner.flip = coords.flip;
  return inner;
}

/**
 * What the sprite of a layer writes for one of its frames: the tex coords — of the picture alone in
 * an atlas frame with an inner padding — and the diagonal flip of the atlas frame, and the margins of
 * the frame's box inside the box of the layer as fractions of it — the quad of the layer is its box,
 * never the canvas.
 */
export function prepareLayerFrame(spec: ArtFrameSpec, layerBox: LayerBox): PreparedSpriteFrame {
  const {box} = spec;
  const {coords} = spec.frame;
  return {
    texCoords: (spec.inset === undefined ? coords : insetCoords(coords, spec.inset)).getTexCoords(),
    texFlipDiagonal: coords.flipD ? 1 : 0,
    texTrim: [
      (box.x - layerBox.x) / layerBox.w,
      (box.y - layerBox.y) / layerBox.h,
      (layerBox.x + layerBox.w - box.x - box.w) / layerBox.w,
      (layerBox.y + layerBox.h - box.y - box.h) / layerBox.h,
    ],
  };
}
