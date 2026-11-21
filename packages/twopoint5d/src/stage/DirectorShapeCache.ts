// Builds, holds and compiles the shapes of the stack of a `StageDirector`: the graphs of its
// composition, their `RootRenderPipeline`s and the placeholders their texture nodes sample, the 16
// shapes it drew last beside those `precompile()` pinned. The director keeps its stack, its layers
// and its transitions, and asks the cache for the shape of the stack before each draw. This module is
// not in `public-api.ts`: only `StageDirector.ts` reaches it.

import {float, texture, uniform, uv} from 'three/tsl';
import {
  Color,
  ColorManagement,
  type Node,
  NoToneMapping,
  RenderTarget,
  type Texture,
  type TextureNode,
  type UniformNode,
  Vector2,
  Vector4,
  type WebGPURenderer,
} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {isRecord} from '../utils/isRecord.js';
import {type OrderRef, NO_MASKS, masksOf, type Slot} from './directorSlots.js';
import type {IStage} from './IStage.js';
import {RootRenderPipeline} from './RootRenderPipeline.js';
import {maskCoverage, maskSource} from './maskNodes.js';
import type {StageDirector} from './StageDirector.js';
import {StageMask, type StageMaskCoverageSource} from './StageMask.js';
import {StageTransitionInternals} from './StageTransition.js';
import {type StageTransitionEffect, textureSource} from './transitionEffects.js';

interface ShapeSlot {
  readonly layer?: TextureNode;
  readonly from?: TextureNode;
  readonly to?: TextureNode;
  readonly progress?: UniformNode<'float', number>;
  readonly effect?: StageTransitionEffect;
  readonly effectNode?: Node<'vec4'>;
}

/** @internal */
export interface Shape {
  readonly pipeline: RootRenderPipeline;
  readonly slots: readonly ShapeSlot[];
  /** One texture node per distinct mask stage of the shape, counted by first appearance from the bottom. */
  readonly maskNodes: readonly TextureNode[];
  readonly outputNode: Node;
  /** Every texture node of the shape, and the placeholder each one samples while it has no pass. */
  readonly textureNodes: readonly TextureNode[];
  readonly placeholders: readonly Texture[];
}

interface CachedShape {
  readonly shape: Shape;
  /**
   * Compiled by `precompile()`: it stays until `dispose()`, or until the director draws or
   * precompiles with another renderer.
   */
  pinned: boolean;
  /**
   * The compile `precompile()` runs for the shape: another `precompile()` that finds the shape waits
   * for it. An entry without one is compiled — drawn, or through a compile that went through.
   */
  compiling?: Promise<void>;
}

/**
 * How many shapes the stack built itself a director keeps beside those `precompile()` compiled; the
 * one used last stays longest.
 */
const KEPT_SHAPES = 16;

// the progress of the transition of a slot, read through a typed array (see writeProgress())
const progressScratch = new Float64Array(1);

const effectIds = new WeakMap<StageTransitionEffect, number>();
let nextEffectId = 1;

function effectId(effect: StageTransitionEffect): number {
  let id = effectIds.get(effect);
  if (id === undefined) {
    id = nextEffectId++;
    effectIds.set(effect, id);
  }
  return id;
}

/**
 * What a slot of a shape holds: a layer (no effect) or a transition through an effect, masked or
 * not, and the masks the effect names. Of a mask only its stage, `source` and `invert` count.
 * @internal
 */
export interface ShapeKind {
  readonly effect: StageTransitionEffect | undefined;
  readonly mask: StageMask | undefined;
  readonly effectMasks: readonly StageMask[];
}

const LAYER_KIND: ShapeKind = Object.freeze({effect: undefined, mask: undefined, effectMasks: NO_MASKS});

/** A distinct mask of a shape: the index of its stage among the distinct mask stages, and its options. */
interface ShapeMask {
  readonly stage: number;
  readonly source: StageMaskCoverageSource;
  readonly invert: boolean;
}

/**
 * Walks the masks of `kinds` and calls `visit` per masked slot, bottom-up, then `visitEffect` per
 * mask an effect names, slot by slot and each effect's masks in the order of its list, with its
 * position in that list. Both get the index of the distinct mask — a stage with a source and an
 * invert — and that mask, whose `stage` is the index of its stage among the distinct mask stages;
 * both count by first appearance in this walk, as the mask stages stand in `orderedStages`.
 * Answers the distinct masks.
 */
function distinctMasks(
  kinds: readonly ShapeKind[],
  visit: (slot: number, index: number, mask: ShapeMask) => void,
  visitEffect: (slot: number, position: number, index: number, mask: ShapeMask) => void,
): ShapeMask[] {
  const stages: IStage[] = [];
  const masks: ShapeMask[] = [];
  const indexOf = (mask: StageMask): number => {
    let stage = stages.indexOf(mask.stage);
    if (stage === -1) stage = stages.push(mask.stage) - 1;
    const index = masks.findIndex((m) => m.stage === stage && m.source === mask.source && m.invert === mask.invert);
    return index === -1 ? masks.push({stage, source: mask.source, invert: mask.invert}) - 1 : index;
  };
  kinds.forEach(({mask}, slot) => {
    if (!mask) return;
    const index = indexOf(mask);
    visit(slot, index, masks[index]!);
  });
  kinds.forEach(({effectMasks}, slot) => {
    effectMasks.forEach((mask, position) => {
      const index = indexOf(mask);
      visitEffect(slot, position, index, masks[index]!);
    });
  });
  return masks;
}

/**
 * The key of a shape: per slot `l` or `t<effect id>`, with `m<mask index>` for a masked one and
 * `e<mask index>.<mask index>…` for the masks its effect names, and after a `|` per distinct mask
 * `<source><invert>@<stage index>`. The stage index tells one texture node for two masks from two:
 * a red and a green mask on one stage and on two stages differ in it alone. The indices of the
 * effect's masks tell which texture node the graph of the effect samples: two slot masks that swap
 * their stages leave the list of distinct masks as it was, but not the place of the effect's mask
 * in it.
 */
function shapeKey(kinds: readonly ShapeKind[]): string {
  const slots = kinds.map(({effect}) => (effect ? `t${effectId(effect)}` : 'l'));
  const masks = distinctMasks(
    kinds,
    (slot, index) => {
      slots[slot] += `m${index}`;
    },
    (slot, position, index) => {
      slots[slot] += `${position === 0 ? 'e' : '.'}${index}`;
    },
  );
  if (masks.length === 0) return slots.join(',');
  return `${slots.join(',')}|${masks.map((m) => `${m.source}${m.invert ? 1 : 0}@${m.stage}`).join(',')}`;
}

const isEffect = (value: unknown): value is StageTransitionEffect =>
  typeof (value as Partial<StageTransitionEffect> | undefined)?.build === 'function';

/** @internal */
export function parseShapes(subject: string, shapes: unknown): ShapeKind[][] {
  if (!Array.isArray(shapes)) {
    throw new TypeError(`${subject}: shapes must be an array of shapes, got ${describeValue(shapes)}`);
  }
  return shapes.map((shape: unknown, i) => {
    if (!Array.isArray(shape) || shape.length === 0) {
      throw new TypeError(
        `${subject}: shapes[${i}] must be a non-empty array of 'layer', StageTransitionEffect and {effect?, mask}, got ${describeValue(shape)}`,
      );
    }
    return shape.map((slot: unknown, j): ShapeKind => {
      if (slot === 'layer') return LAYER_KIND;
      if (isEffect(slot)) return {effect: slot, mask: undefined, effectMasks: masksOf(subject, slot)};
      if (isRecord(slot) && 'mask' in slot) {
        const {effect, mask} = slot;
        if (!(mask instanceof StageMask)) {
          throw new TypeError(`${subject}: shapes[${i}][${j}].mask must be a StageMask, got ${describeValue(mask)}`);
        }
        if (effect !== undefined && !isEffect(effect)) {
          throw new TypeError(
            `${subject}: shapes[${i}][${j}].effect must be a StageTransitionEffect, got ${describeValue(effect)}`,
          );
        }
        return {effect, mask, effectMasks: effect ? masksOf(subject, effect) : NO_MASKS};
      }
      throw new TypeError(
        `${subject}: shapes[${i}][${j}] must be 'layer', a StageTransitionEffect or {effect?, mask}, got ${describeValue(slot)}`,
      );
    });
  });
}

/** `top` over `bottom`, both premultiplied. */
function over(top: Node<'vec4'>, bottom: Node<'vec4'>): Node<'vec4'> {
  return top.add(bottom.mul(float(1).sub(top.a)));
}

/**
 * Runs `draw` with `target` set — and linear output, if asked —, and gives the renderer back as it was.
 * @internal
 */
export function withTarget(renderer: WebGPURenderer, target: RenderTarget | null, linear: boolean, draw: () => void): void {
  const prevTarget = renderer.getRenderTarget();
  const toneMapping = renderer.toneMapping;
  const outputColorSpace = renderer.outputColorSpace;
  renderer.setRenderTarget(target);
  if (linear) {
    renderer.toneMapping = NoToneMapping;
    renderer.outputColorSpace = ColorManagement.workingColorSpace;
  }
  try {
    draw();
  } finally {
    renderer.toneMapping = toneMapping;
    renderer.outputColorSpace = outputColorSpace;
    renderer.setRenderTarget(prevTarget);
  }
}

/**
 * What a {@link DirectorShapeCache} asks of its director beyond the public members. The director
 * fills it. Not exported from the package.
 * @internal
 */
export interface DirectorShapeCacheHost {
  /**
   * The renderer the shapes are built for has changed: the targets of the layers hold no picture
   * under the new one, and every frozen layer draws once.
   */
  rendererChanged(): void;
}

/** @internal */
export class DirectorShapeCache {
  readonly #director: StageDirector;
  readonly #host: DirectorShapeCacheHost;

  // the order of insertion is the order of use: the shape unused longest comes first
  readonly #shapes = new Map<string, CachedShape>();
  #key?: string;
  #shape?: Shape;
  /** The renderer the shapes and the placeholders are built for. */
  #renderer?: WebGPURenderer;
  /**
   * Errors from `dispose()` of effects while a draw lets go of shapes; made only when one is let
   * go of, so that a frame without a change of shape allocates nothing.
   */
  #lettingGoErrors?: unknown[];

  // 1×1 transparent black targets, one per texture node of the largest shape: three.js shares one
  // uniform among the texture nodes of a graph that sample the same texture, so no two texture
  // nodes of a shape ever stand on the same placeholder while it builds
  readonly #placeholders: RenderTarget[] = [];
  readonly #clearUniform = uniform(new Vector4(0, 0, 0, 0));
  readonly #resolution = uniform(new Vector2(1, 1));
  readonly #clearColorOfRenderer = new Color();

  constructor(director: StageDirector, host: DirectorShapeCacheHost) {
    this.#director = director;
    this.#host = host;
  }

  /** Sets the resolution the effects read, in pixels of the drawing buffer; the director works it out. */
  setResolution(width: number, height: number): void {
    this.#resolution.value.set(width, height);
  }

  /** The stack has changed: the next {@link current} looks its shape up again. */
  invalidate(): void {
    this.#key = undefined;
  }

  /**
   * The shape of `slots` for `renderer`: the one used last, the one cached under its key — which goes
   * to the end of the order of use —, or a new one, after which the shapes the stack built itself
   * beyond the 16 kept ones go.
   */
  current(renderer: WebGPURenderer, slots: readonly Slot[]): Shape {
    if (renderer !== this.#renderer) {
      // the first renderer has nothing to let go of
      if (this.#renderer === undefined) this.#renderer = renderer;
      else this.bindTo(renderer, (this.#lettingGoErrors ??= []));
    }
    if (this.#key === undefined || this.#shape === undefined) {
      const kinds = slots.map(
        (slot): ShapeKind =>
          slot.run || slot.mask
            ? {effect: slot.run?.transition.effect, mask: slot.mask, effectMasks: slot.run?.masks ?? NO_MASKS}
            : LAYER_KIND,
      );
      const key = shapeKey(kinds);
      let entry = this.#shapes.get(key);
      if (entry) {
        // the one used last goes to the end
        this.#shapes.delete(key);
        this.#shapes.set(key, entry);
      } else {
        entry = {shape: this.#buildShape(renderer, kinds), pinned: false};
        this.#shapes.set(key, entry);
        this.#evictShapes(entry);
      }
      this.#key = key;
      this.#shape = entry.shape;
    }
    return this.#shape;
  }

  /** Writes the progress of the transition of each slot of `slots` into the uniform of its slot of `shape`. */
  writeProgress(shape: Shape, slots: readonly Slot[]): void {
    for (let i = 0; i < shape.slots.length; i++) {
      const progress = shape.slots[i]!.progress;
      const run = slots[i]?.run;
      if (!progress || !run) continue;
      // read through a typed array, since StageTransition#progress answered to a caller that is not
      // inlined boxes, and written only when it changed: a double stored again is boxed again —
      // 16 bytes per draw either way
      StageTransitionInternals.copyProgress(run.transition, progressScratch, 0);
      const value = progressScratch[0]!;
      if (progress.value !== value) progress.value = value;
    }
  }

  /** Sets the color the shapes compose over: the clear color of the director, premultiplied, or none. */
  updateClear(renderer: WebGPURenderer): void {
    const value = this.#clearUniform.value;
    const director = this.#director;
    if (!director.clear) {
      value.set(0, 0, 0, 0);
      return;
    }
    const color = director.clearColor ?? renderer.getClearColor(this.#clearColorOfRenderer);
    const alpha = director.clearAlpha;
    value.set(color.r * alpha, color.g * alpha, color.b * alpha, alpha);
  }

  /**
   * Points the texture nodes of the current shape at the pass textures of the layers; `refs` tells
   * which slot and which of its sources each pass is.
   */
  fill(passes: Node[], refs: readonly OrderRef[]): Node {
    const shape = this.#shape;
    if (!shape) throw new Error('StageDirector: the shape of the stack is built before the composition');
    const {textureNodes, placeholders} = shape;
    for (let i = 0; i < textureNodes.length; i++) textureNodes[i]!.value = placeholders[i]!;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i]!;
      const pass = passes[i] as Partial<TextureNode> | undefined;
      if (ref.side === 'mask') {
        const node = shape.maskNodes[ref.maskStage];
        if (node && pass?.value) node.value = pass.value;
        continue;
      }
      const slot = shape.slots[ref.slot];
      const node = ref.side === 'layer' ? slot?.layer : ref.side === 'from' ? slot?.from : slot?.to;
      if (node && pass?.value) node.value = pass.value;
    }
    return shape.outputNode;
  }

  /**
   * Binds the shapes and the placeholders to `renderer`: they belong to the renderer they are built
   * for, and another one lets go of every shape and every placeholder, which build again for it.
   */
  bindTo(renderer: WebGPURenderer, errors: unknown[]): void {
    if (renderer === this.#renderer) return;
    if (this.#renderer !== undefined) {
      for (const entry of this.#shapes.values()) this.#disposeShape(entry.shape, errors);
      this.#shapes.clear();
      this.#shape = undefined;
      this.#key = undefined;
      for (const placeholder of this.#placeholders) placeholder.dispose();
      this.#placeholders.length = 0;
      this.#host.rendererChanged();
    }
    this.#renderer = renderer;
  }

  /**
   * One shape of `precompile()`: binds the cache to `renderer` and pins the shape of `kinds`. A shape
   * that is compiled already answers `true` at once, so that the director pins the next one in the
   * same task, before a draw can let go of it. Otherwise the answer is a promise: it waits for a
   * compile another call runs for the shape, or builds, pins and compiles it. `nestedTarget` answers
   * the pass target of a parent to compile for, called only for a shape that is built here.
   * The promise answers whether the call goes on: `false` once a compile failed after `stopped()`
   * turned true.
   */
  precompile(
    renderer: WebGPURenderer,
    kinds: readonly ShapeKind[],
    nestedTarget: () => RenderTarget | undefined,
    errors: unknown[],
    stopped: () => boolean,
  ): true | Promise<boolean> {
    this.bindTo(renderer, errors);
    const key = shapeKey(kinds);
    const cached = this.#shapes.get(key);
    if (cached) {
      cached.pinned = true;
      if (cached.compiling === undefined) return true;
      return this.#joinCompile(cached.compiling, stopped);
    }
    return this.#buildAndCompile(renderer, kinds, key, nestedTarget, errors, stopped);
  }

  /** Waits for the compile of a shape that another `precompile()` runs. */
  async #joinCompile(compiling: Promise<void>, stopped: () => boolean): Promise<boolean> {
    // the compile another call runs: its outcome is this call's, a failure included
    try {
      await compiling;
    } catch (error) {
      if (stopped()) return false;
      throw error;
    }
    return true;
  }

  /** Builds the shape of `kinds`, pins it under `key` and compiles it. */
  async #buildAndCompile(
    renderer: WebGPURenderer,
    kinds: readonly ShapeKind[],
    key: string,
    nestedTarget: () => RenderTarget | undefined,
    errors: unknown[],
    stopped: () => boolean,
  ): Promise<boolean> {
    const entry: CachedShape = {shape: this.#buildShape(renderer, kinds), pinned: true};
    this.#shapes.set(key, entry);
    const compiling = this.#compileShape(renderer, entry.shape, nestedTarget());
    entry.compiling = compiling;
    try {
      await compiling;
      entry.compiling = undefined;
    } catch (error) {
      this.#forgetFailedShape(key, entry, errors);
      // the shape has gone with the director, and the failure has nothing left to be about
      if (stopped()) return false;
      throw error;
    }
    return true;
  }

  /** Answers what effects threw from `dispose()` as a draw let go of shapes, and forgets it. */
  takeLettingGoErrors(): unknown[] | undefined {
    const errors = this.#lettingGoErrors;
    this.#lettingGoErrors = undefined;
    return errors;
  }

  /**
   * Lets go of every shape and every placeholder; what effects throw from `dispose()` — now, and as
   * a draw let go of shapes before, without a draw since to throw it — goes into `errors`.
   */
  dispose(errors: unknown[]): void {
    for (const entry of this.#shapes.values()) this.#disposeShape(entry.shape, errors);
    this.#shapes.clear();
    this.#shape = undefined;
    this.#key = undefined;
    this.#renderer = undefined;
    for (const placeholder of this.#placeholders) placeholder.dispose();
    this.#placeholders.length = 0;
    // what effects threw as a draw let go of shapes, that no draw has thrown yet
    if (this.#lettingGoErrors) {
      errors.push(...this.#lettingGoErrors);
      this.#lettingGoErrors = undefined;
    }
  }

  /** The `index`th 1×1 transparent black target, which stands in for nothing. */
  #placeholder(renderer: WebGPURenderer, index: number): Texture {
    while (this.#placeholders.length <= index) {
      const placeholder = new RenderTarget(1, 1, {type: renderer.getOutputBufferType()});
      const prev = renderer.getRenderTarget();
      const prevAlpha = renderer.getClearAlpha();
      renderer.getClearColor(this.#clearColorOfRenderer);
      renderer.setRenderTarget(placeholder);
      try {
        renderer.setClearColor(new Color(0x000000), 0);
        renderer.clear(true, true, false);
      } finally {
        renderer.setClearColor(this.#clearColorOfRenderer, prevAlpha);
        renderer.setRenderTarget(prev);
      }
      this.#placeholders.push(placeholder);
    }
    return this.#placeholders[index]!.texture;
  }

  /**
   * Lets go of the shapes the stack built itself, the one unused longest first, while more than
   * `KEPT_SHAPES` of them are left; never of `newest`, nor of a shape `precompile()` compiled.
   */
  #evictShapes(newest: CachedShape): void {
    let unpinned = 0;
    for (const entry of this.#shapes.values()) if (!entry.pinned) unpinned++;
    for (const [key, entry] of this.#shapes) {
      if (unpinned <= KEPT_SHAPES) break;
      if (entry.pinned || entry === newest) continue;
      this.#shapes.delete(key);
      unpinned--;
      this.#disposeShape(entry.shape, (this.#lettingGoErrors ??= []));
    }
  }

  /**
   * Lets go of the shape under `key` whose compile failed, so that the next `precompile()` builds and
   * compiles it anew — unless a draw since has made it the shape of the stack: then it stays, as one
   * the stack built itself.
   */
  #forgetFailedShape(key: string, entry: CachedShape, errors: unknown[]): void {
    entry.compiling = undefined;
    // a dispose() or a draw with another renderer has let go of it already
    if (this.#shapes.get(key) !== entry) return;
    if (this.#shape === entry.shape) {
      entry.pinned = false;
      return;
    }
    this.#shapes.delete(key);
    this.#disposeShape(entry.shape, errors);
  }

  /** Disposes the pipeline of `shape` and the nodes its effects built; a call that throws holds up none of the others. */
  #disposeShape(shape: Shape, errors: unknown[]): void {
    try {
      shape.pipeline.dispose();
    } catch (error) {
      errors.push(error);
    }
    for (const slot of shape.slots) {
      if (!slot.effect?.dispose || !slot.effectNode) continue;
      try {
        slot.effect.dispose(slot.effectNode);
      } catch (error) {
        errors.push(error);
      }
    }
  }

  #buildShape(renderer: WebGPURenderer, kinds: readonly ShapeKind[]): Shape {
    const at = uv();
    const slots: ShapeSlot[] = [];
    const textureNodes: TextureNode[] = [];
    const placeholders: Texture[] = [];
    const textureNode = (): TextureNode => {
      const placeholder = this.#placeholder(renderer, textureNodes.length);
      const node = texture(placeholder);
      textureNodes.push(node);
      placeholders.push(placeholder);
      return node;
    };
    // one texture node per distinct mask stage, in the order of the stage indices, and one coverage
    // per distinct mask, shared by every slot it masks
    const maskNodes: TextureNode[] = [];
    const coverages: Node<'float'>[] = [];
    const coverageOf: (Node<'float'> | undefined)[] = [];
    // per slot, the index of the mask stage of each mask its effect names, by its place in the list
    const effectMaskStages: number[][] = [];
    distinctMasks(
      kinds,
      (slot, index, {stage, source, invert}) => {
        const maskNode = (maskNodes[stage] ??= textureNode());
        coverageOf[slot] = coverages[index] ??= maskCoverage(maskNode.sample(at), source, invert);
      },
      (slot, position, _index, {stage}) => {
        maskNodes[stage] ??= textureNode();
        (effectMaskStages[slot] ??= [])[position] = stage;
      },
    );
    const masked = (slot: number, color: Node<'vec4'>): Node<'vec4'> => {
      const coverage = coverageOf[slot];
      return coverage ? (color.mul(coverage) as Node<'vec4'>) : color;
    };

    let out: Node<'vec4'> = this.#clearUniform;
    for (let index = 0; index < kinds.length; index++) {
      const {effect, effectMasks} = kinds[index]!;
      if (effect) {
        const from = textureNode();
        const to = textureNode();
        const progress = uniform(0);
        const stages = effectMaskStages[index];
        const effectNode = effect.build({
          from: textureSource(from),
          to: textureSource(to),
          progress,
          uv: at,
          resolution: this.#resolution,
          mask: (mask) => {
            const position = effectMasks.indexOf(mask);
            if (position === -1 || !stages) {
              const named = mask instanceof StageMask ? `the mask on ${describeValue(mask.stage.name)}` : describeValue(mask);
              throw new Error(
                `StageTransitionInput#mask(): the effect ${describeValue(effect.name)} did not name ${named} in its masks`,
              );
            }
            return maskSource(maskNodes[stages[position]!]!, mask);
          },
        });
        slots.push({from, to, progress, effect, effectNode});
        out = over(masked(index, effectNode), out);
      } else {
        const layer = textureNode();
        slots.push({layer});
        out = over(masked(index, layer), out);
      }
    }
    return {pipeline: new RootRenderPipeline(renderer), slots, maskNodes, outputNode: out, textureNodes, placeholders};
  }

  /**
   * Compiles the material of `shape` through `RenderPipeline#render()` itself, with the one draw it
   * makes turned into a `compileAsync()`: the pipeline sets up the renderer and its quad as for a
   * frame — the output transform, no XR, the vertex node of the quad —, and the node build of the
   * compile sees what the draw of a frame would see. `nestedTarget` stands for the pass target of a
   * parent, which the director draws into on linear output; without it the director's own target
   * applies. Every texture node of the shape samples a placeholder of its own; the pass textures
   * that take their places later have their type, so they change a binding and no shader. The
   * pipeline keeps the output node, and the first frame of the shape finds it in place and builds
   * nothing.
   */
  async #compileShape(renderer: WebGPURenderer, shape: Shape, nestedTarget: RenderTarget | undefined): Promise<void> {
    const pipeline = shape.pipeline;
    pipeline.outputNode = shape.outputNode;
    pipeline.needsUpdate = true;

    let compiled: Promise<void> | undefined;
    const ownRender = Object.hasOwn(renderer, 'render');
    const render = renderer.render;
    renderer.render = ((scene, camera) => {
      compiled = renderer.compileAsync(scene, camera);
    }) as WebGPURenderer['render'];
    try {
      const target = nestedTarget ?? this.#director.outputRenderTarget ?? renderer.getRenderTarget();
      withTarget(renderer, target, nestedTarget !== undefined, () => pipeline.render());
    } finally {
      if (ownRender) renderer.render = render;
      else delete (renderer as Partial<WebGPURenderer>).render;
    }
    // three.js draws the quad of a RenderPipeline through renderer.render(); a draw that went another
    // way compiled nothing, and the first frame of the shape would build what precompile() promised
    if (compiled === undefined) {
      throw new Error(
        'StageDirector#precompile(): the render pipeline drew without calling renderer.render(), and nothing was compiled',
      );
    }
    await compiled;
  }
}
