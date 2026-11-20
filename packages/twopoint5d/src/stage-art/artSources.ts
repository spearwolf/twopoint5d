import type {PreparedSpriteFrame} from '../sprites/features/AtlasFrame.js';
import type {AnimationTiming} from '../texture/animationFrameAt.js';
import {type AsepriteFrameTag, type AsepriteMetaData, asepriteMetaOf, framesOfTag} from '../texture/AsepriteJson.js';
import type {TextureAtlas, TextureAtlasFrame} from '../texture/TextureAtlas.js';
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
 * What code says about a layer that the picture cannot (§4.4): an override of what the source says,
 * or — for loose layers (§4.5) — all there is. Pixels are artwork pixels on the canvas, save `pivot`
 * of a loose layer, which is in pixels of its frame.
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

/** A loose layer (§4.5): its name and what code says about it. */
export interface ArtLayerDef extends ArtLayerOptions {
  name: string;
}

/** What an art could not load or read out of its source (§3.8). */
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
 * Throws what an art refuses in `only` and `layers` (§8): `only` that is no list of names or names a
 * layer twice; `layers` that is no object; options of a layer that are no object, have a key no
 * option has, give `at` or `pxPerUnit` — which only a loose layer takes (§4.4) —, or a value it cannot take — a `depth` that is no finite number, a `rest` field as
 * `set()` refuses it. `undefined` is not given. To be called when the art is made, before its source
 * has loaded; `readAtlasSource()` calls it too.
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

// the frame of `name` on the canvas: undefined for a name the atlas lacks and for an empty cel
function canvasFrameOf(atlas: TextureAtlas<unknown>, name: string): ArtFrameSpec | undefined {
  const frame = atlas.frame(name);
  if (frame === undefined) return undefined;
  const placement = placementOf(frame.data);
  if (isEmptyCel(frame, placement)) return undefined;
  if (placement !== undefined) return {frame, box: placement.box};
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
}

function specOf(found: FoundLayer, options: ArtLayerOptions | undefined, problems: StageArtProblem[]): ArtLayerSpec {
  const pivot = options?.pivot ?? found.pivot;
  const union = unionOf(found.frames);
  const box = union ?? {x: pivot?.[0] ?? 0, y: pivot?.[1] ?? 0, w: 0, h: 0};
  if (options?.depth === undefined && found.depthProblem !== undefined) {
    problems.push({layer: found.name, reason: found.depthProblem});
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

// the frames a `frames` option names, each on the canvas; a name the atlas lacks is a problem of the layer
function overrideFrames(
  atlas: TextureAtlas<unknown>,
  layer: string,
  frames: readonly string[] | RegExp,
  problems: StageArtProblem[],
): {names: string[]; frames: (ArtFrameSpec | undefined)[]} {
  const names: string[] = [];
  const specs: (ArtFrameSpec | undefined)[] = [];
  for (const name of frameNamesOf(atlas, frames)) {
    if (atlas.frame(name) === undefined) {
      problems.push({layer, reason: `the frame ${describeValue(name)} of the layer ${describeValue(layer)} is not in the atlas`});
      continue;
    }
    names.push(name);
    specs.push(canvasFrameOf(atlas, name));
  }
  if (names.length === 0 && frames instanceof RegExp) {
    problems.push({layer, reason: `the frames of the layer ${describeValue(layer)} match no frame of the atlas`});
  }
  return {names, frames: specs};
}

// --- Aseprite (§4.1) -------------------------------------------------------------------------------

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
// for the frame n of the sprite; a tag with a step no such frame shows is left out
function remappedTags(tags: ReadonlyMap<string, ArtTagSpec>, names: readonly string[]): Map<string, ArtTagSpec> {
  const indexOfNumber = new Map<number, number>();
  names.forEach((name, index) => {
    const n = frameNumberOf(name);
    if (n !== undefined && !indexOfNumber.has(n)) indexOfNumber.set(n, index);
  });
  const remapped = new Map<string, ArtTagSpec>();
  for (const [name, tag] of tags) {
    const frames = tag.frames.map((n) => indexOfNumber.get(n));
    if (frames.every((index) => index !== undefined)) {
      remapped.set(name, Object.freeze({...tag, frames: Object.freeze(frames as number[])}));
    }
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
  const frameNames = atlas.frameNames().filter((name): name is string => typeof name === 'string');

  // the frames `{layer}#{frame}` of each layer, and the duration of each frame of the sprite
  const framesByLayer = new Map<string, Map<number, string>>();
  const durations = new Map<number, number>();
  for (const name of frameNames) {
    const n = frameNumberOf(name);
    if (n === undefined) continue;
    const layer = name.slice(0, name.lastIndexOf('#'));
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

  // Review Focus 1: a sheet whose frames name no layer was exported without split layers or with
  // another filename format — one problem of the source, not an art of empty layers
  if (!metaLayers.some(({name}) => framesByLayer.has(name))) {
    problems.push({
      layer: undefined,
      reason: `no frame of the sheet is named after one of its layers — export it with --split-layers and --filename-format '{layer}#{frame}'`,
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
      const picked = overrideFrames(atlas, name, override, problems);
      layer.frames = picked.frames;
      layer.tags = remappedTags(tags, picked.names);
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
    const picked = overrideFrames(atlas, name, layerOptions.frames, problems);
    found.push({name, frames: picked.frames, tags: remappedTags(tags, picked.names)});
  }

  const layerNames = new Set(found.map(({name}) => name));
  for (const sliceName of pivots.keys()) {
    if (!layerNames.has(sliceName)) {
      problems.push({layer: undefined, reason: `the slice ${describeValue(sliceName)} has a pivot but names no layer`});
    }
  }

  return {canvas: canvasOf(atlas, frameNames), found, failed: false};
}

// --- a trimmed atlas (§4.3) ------------------------------------------------------------------------

// `<layer>@<depth>`: the depth right after the name of the layer, before a `#n`, a `-suffix` or `.pivot`
const DEPTH_IN_NAME = /^(.+?)@([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?=$|[#-]|\.pivot$)(.*)$/;

interface TrimmedLayer {
  name: string;
  // the index in the atlas of its first frame: its place in the stack
  position: number;
  base?: string;
  suffixed: string[];
  numbered: Map<number, string>;
  override?: {names: string[]; frames: (ArtFrameSpec | undefined)[]};
  depth?: number;
  pivot?: readonly [number, number];
}

function readTrimmedAtlas(
  atlas: TextureAtlas<unknown>,
  options: ArtSourceOptions,
  problems: StageArtProblem[],
): {canvas: {width: number; height: number} | undefined; found: FoundLayer[]} {
  const frameNames = atlas.frameNames().filter((name): name is string => typeof name === 'string');
  const positionOf = new Map(frameNames.map((name, index) => [name, index]));

  const layers = new Map<string, TrimmedLayer>();
  const layerOf = (name: string, position: number): TrimmedLayer => {
    let layer = layers.get(name);
    if (layer === undefined) layers.set(name, (layer = {name, position, suffixed: [], numbered: new Map()}));
    layer.position = Math.min(layer.position, position);
    return layer;
  };

  // the depth of a frame name, and the name without it
  const depthOf = new Map<string, number>();
  const plainNameOf = new Map<string, string>();
  for (const name of frameNames) {
    const match = DEPTH_IN_NAME.exec(name);
    plainNameOf.set(name, match === null ? name : match[1]! + match[3]!);
    if (match !== null) depthOf.set(name, Number(match[2]));
  }
  const giveDepth = (layer: TrimmedLayer, frameName: string) => {
    const depth = depthOf.get(frameName);
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
    const picked = overrideFrames(atlas, name, layerOptions.frames, problems);
    if (picked.names.length === 0) continue;
    const layer = layerOf(name, Math.min(...picked.names.map((frameName) => positionOf.get(frameName) ?? frameNames.length)));
    layer.override = picked;
    for (const frameName of picked.names) {
      claimed.add(frameName);
      giveDepth(layer, frameName);
    }
  }

  // the names of §4.2: `<layer>.pivot`, `<layer>#<n>`, and plain names, which are layers or `-suffix` frames
  const markers: [frameName: string, layer: string][] = [];
  const plain: string[] = [];
  for (const frameName of frameNames) {
    if (claimed.has(frameName)) continue;
    const name = plainNameOf.get(frameName)!;
    if (name.endsWith('.pivot') && name.length > '.pivot'.length) {
      markers.push([frameName, name.slice(0, -'.pivot'.length)]);
      continue;
    }
    const n = frameNumberOf(name);
    if (n !== undefined && name.lastIndexOf('#') > 0) {
      const layer = layerOf(name.slice(0, name.lastIndexOf('#')), positionOf.get(frameName)!);
      layer.numbered.set(n, frameName);
      giveDepth(layer, frameName);
      continue;
    }
    plain.push(frameName);
  }

  // a plain name `<layer>-<suffix>` is a frame of the longest layer before a hyphen; shorter names are
  // decided first, so the layers before a hyphen are known when a name is
  const sorted = [...plain].sort((a, b) => plainNameOf.get(a)!.length - plainNameOf.get(b)!.length);
  const suffixOf = new Map<string, string>();
  const isLayer = (name: string) => layers.has(name);
  for (const frameName of sorted) {
    const name = plainNameOf.get(frameName)!;
    for (let hyphen = name.lastIndexOf('-'); hyphen > 0; hyphen = name.lastIndexOf('-', hyphen - 1)) {
      const prefix = name.slice(0, hyphen);
      if (isLayer(prefix) && layers.get(prefix)!.override === undefined) {
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
  // the suffixed frames of a layer in the order of the atlas
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
    // read as it lies, not as a cel: a dot at the top left pixel is a pivot, not an empty picture
    const marker = atlas.frame(frameName)!;
    const [w, h] = drawnSizeOf(marker);
    const box = placementOf(marker.data)?.box ?? {x: 0, y: 0, w, h};
    layer.pivot = [box.x + box.w / 2, box.y + box.h / 2];
  }

  const canvas = canvasOf(atlas, frameNames);
  const found: FoundLayer[] = [];
  for (const layer of [...layers.values()].sort((a, b) => a.position - b.position)) {
    let frames: (ArtFrameSpec | undefined)[];
    if (layer.override !== undefined) {
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
      frames = Array.from({length: count}, (_, n) => {
        const frameName = layer.numbered.get(n);
        return frameName === undefined ? undefined : canvasFrameOf(atlas, frameName);
      });
    } else {
      frames = [layer.base, ...layer.suffixed].filter((name) => name !== undefined).map((name) => canvasFrameOf(atlas, name));
    }
    if (canvas !== undefined) {
      for (const spec of frames) {
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
    const spec: FoundLayer = {name: layer.name, frames, tags: NO_TAGS};
    if (layer.depth !== undefined) spec.depth = layer.depth;
    if (layer.pivot !== undefined) spec.pivot = layer.pivot;
    found.push(spec);
  }
  return {canvas, found};
}

/**
 * Reads the layers of an atlas source: an Aseprite sheet with split layers (§4.1) where
 * `asepriteMetaOf()` answers its `meta`, else a trimmed atlas with names after §4.2 (§4.3). The
 * overrides of `options.layers` beat what the source says; `options.only` picks the layers and their
 * order. What the source cannot give is a problem (§3.8); what the options cannot take is refused
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

// --- loose layers (§4.5) ---------------------------------------------------------------------------

/**
 * Reads loose layers (§4.5): each takes the frames its `frames` names — the frame of its name without
 * them —, its `pivot` in pixels of its first frame — the middle of the frame without one — stands at
 * its `at`, `[0, 0]` without one, and every frame lies where it lies in its untrimmed sprite. A frame
 * the atlas lacks is a problem of its layer; what the definitions cannot take is refused first, by
 * {@link checkLayerDefs}.
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
        return {frame, box: {x: left + x, y: top + y, w, h}};
      }
      const [w, h] = drawnSizeOf(frame);
      return {frame, box: {x: left, y: top, w, h}};
    });
    return specOf({name, frames: specs, pivot: at, tags: NO_TAGS}, {...def, at, pivot: at}, problems);
  });
  return {layers, problems};
}

// --- frames for the mesh ---------------------------------------------------------------------------

/**
 * What the sprite of a layer writes for one of its frames: the tex coords and the diagonal flip of the
 * atlas frame, and the margins of the frame's box inside the box of the layer as fractions of it —
 * the quad of the layer is its box, never the canvas (Decision 3).
 */
export function prepareLayerFrame(spec: ArtFrameSpec, layerBox: LayerBox): PreparedSpriteFrame {
  const {box} = spec;
  return {
    texCoords: spec.frame.coords.getTexCoords(),
    texFlipDiagonal: spec.frame.coords.flipD ? 1 : 0,
    texTrim: [
      (box.x - layerBox.x) / layerBox.w,
      (box.y - layerBox.y) / layerBox.h,
      (layerBox.x + layerBox.w - box.x - box.w) / layerBox.w,
      (layerBox.y + layerBox.h - box.y - box.h) / layerBox.h,
    ],
  };
}
