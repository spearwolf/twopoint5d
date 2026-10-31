import {emitStrict, type EventizedObject, eventize, off} from '@spearwolf/eventize';
import type {Object3D, WebGPURenderer} from 'three/webgpu';
import {OnStageDispose} from '../events.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import type {Stage2D} from './Stage2D.js';

export interface StageMaskWorldStage extends EventizedObject {}

/**
 * The mask stage `StageMask.inWorldOf()` builds: it draws `scene` through the camera `world` has at
 * the moment of the draw. It holds no listener on `world` — a new camera of the world is simply the
 * camera of the next draw —, and it draws nothing while `world` has no camera or has been disposed,
 * which leaves the pass target of the mask transparent black: a coverage of 0.
 *
 * Its size is the size the director hands every mask stage; it leaves `world` and its camera as they
 * are. It is eventized and announces its `dispose()` with `OnStageDispose`, as a `Stage2D` does, so a
 * director that holds it lets go. The mask that built it owns it; `scene` stays the caller's.
 * @internal
 */
export class StageMaskWorldStage implements IStage, IRenderable {
  name: string;

  readonly world: Stage2D;
  readonly scene: Object3D;

  #width = 0;
  #height = 0;
  #pixelRatio = 1;
  #disposed = false;

  constructor(world: Stage2D, scene: Object3D) {
    eventize(this);
    this.world = world;
    this.scene = scene;
    this.name = `mask in the world of ${world.name}`;
  }

  /** The width of the container, as the last `resize()` handed it in. */
  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  get pixelRatio(): number {
    return this.#pixelRatio;
  }

  get isDisposed(): boolean {
    return this.#disposed;
  }

  resize(width: number, height: number, pixelRatio = 1): void {
    if (this.#disposed) return;
    this.#width = width;
    this.#height = height;
    this.#pixelRatio = isPositiveFinite(pixelRatio) ? pixelRatio : 1;
  }

  updateFrame(_now: number, _deltaTime: number, _frameNo: number): void {
    // the camera is read at the draw; the world updates itself
  }

  renderTo(renderer: WebGPURenderer): void {
    if (this.#disposed) return;
    const world = this.world;
    // a disposed Stage2D still answers the camera it was left with: the mask no longer follows it
    if (world.isDisposed) return;
    const camera = world.camera;
    if (camera) renderer.render(this.scene, camera);
  }

  /**
   * Announces the end with `OnStageDispose` — every listener hears it, and an error of one reaches
   * the caller afterwards — and stops listening. `scene` and `world` are left as they are.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    try {
      emitStrict(this, OnStageDispose, this);
    } finally {
      off(this);
    }
  }
}
