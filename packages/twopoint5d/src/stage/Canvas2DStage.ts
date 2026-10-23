import {emit, emitStrict, type EventizedObject, eventize, off} from '@spearwolf/eventize';
import type {WebGPURenderer} from 'three/webgpu';
import {Sprite, SpriteMaterial, Texture, type Scene} from 'three/webgpu';
import {Chronometer} from '../display/Chronometer.js';
import {OnCanvas2DStageDispose, OnCanvas2DStageRender, OnCanvas2DStageResize} from '../events.js';
import {TextureFactory} from '../texture/TextureFactory.js';
import {assertFinite} from '../utils/assertFinite.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {throwCollected} from '../utils/throwCollected.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {Stage2D} from './Stage2D.js';
import {StageRenderer} from './StageRenderer.js';

export type Canvas2DStageFitType = 'contain' | 'cover';

/**
 * The view specs a `Canvas2DStage` drives: a `contain`/`cover` fit with both sides given.
 * That is one arm of the `ProjectionFitSpecs` union, and writing `width` and `height`
 * through the union itself is not possible — its `pixelZoom` arm carries neither. The stage
 * holds the object it hands to its projection, so both read the same specs.
 */
type Canvas2DViewSpecs = {fit: Canvas2DStageFitType; width: number; height: number};

export interface Canvas2DStage extends EventizedObject {}

export class Canvas2DStage {
  readonly renderer: WebGPURenderer;
  readonly stageRenderer: StageRenderer;

  #fit: Canvas2DStageFitType = 'contain';

  get fit(): Canvas2DStageFitType {
    return this.#fit;
  }

  set fit(value: Canvas2DStageFitType) {
    if (this.#disposed || this.#fit === value) return;
    this.#fit = value;
    this.#viewSpecs.fit = value;
    this.stage.updateProjection(true);
  }

  readonly canvas: HTMLCanvasElement;

  /**
   * The width of the {@link canvas}. It changes through `setCanvasSize()`, or — for a canvas
   * handed to the constructor — directly at `canvas.width`; then the next `render()` brings sprite
   * and view to the new size before `OnCanvas2DStageResize` goes out.
   */
  get width(): number {
    return this.canvas.width;
  }

  /** The height of the {@link canvas}; it changes as {@link width} does. */
  get height(): number {
    return this.canvas.height;
  }

  readonly projection: OrthographicProjection;
  readonly stage: Stage2D;

  get scene(): Scene {
    return this.stage.scene;
  }

  /**
   * The sprite that shows the canvas, through a `SpriteMaterial` the stage built. A material the
   * caller sets into the slot stays the caller's: {@link dispose} leaves it as it is, and the
   * stage goes on writing the canvas texture into its own material.
   */
  readonly sprite: Sprite;

  // the material this stage built and releases; the slot of the sprite may hold another one
  readonly #material: SpriteMaterial;

  // the material starts out with a blank texture, and the first `#updateTexture()` swaps it for the
  // one the factory built — after that this field is all that still points at it
  #placeholderTexture: Texture;

  #texture?: Texture;

  // the canvas size `#texture` was built for
  #textureWidth = 0;
  #textureHeight = 0;

  /**
   * The texture the sprite shows the canvas through. The stage builds it on the first `render()`
   * and anew on the first upload after the canvas has changed its size, and releases the previous
   * one as soon as the new one sits on the sprite material; each of them belongs to the stage,
   * and {@link dispose} releases the last. `undefined` before the first `render()` and after
   * {@link dispose}.
   */
  get texture(): Texture | undefined {
    return this.#texture;
  }

  #textureFactory?: TextureFactory;

  /**
   * Set `needsUpdate` to `true` after every change of the canvas content: the next `render()`
   * uploads it. It starts out `true`, so the first `render()` shows what the canvas already
   * carries — a canvas handed to the constructor that was painted before included. A canvas
   * without area — a width or a height of 0 — is not uploaded, and the flag stays set for the
   * first `render()` with one.
   */
  needsUpdate = true;

  #lastWidth = 0;
  #lastHeight = 0;

  #viewSpecs: Canvas2DViewSpecs;

  constructor(
    renderer: WebGPURenderer,
    ...args:
      | [width: number, height: number]
      | [width: number, height: number, fit: Canvas2DStageFitType]
      | [canvas: HTMLCanvasElement]
      | [canvas: HTMLCanvasElement, fit: Canvas2DStageFitType]
  ) {
    eventize(this);

    if (typeof args[0] === 'number') {
      // before anything is built: a canvas without area has nothing to show, and the sprite and
      // the view would take its size
      assertPositiveFinite(args[0], 'new Canvas2DStage()', 'width');
      assertPositiveFinite(args[1], 'new Canvas2DStage()', 'height');
    }

    this.renderer = renderer;
    this.stageRenderer = new StageRenderer();

    if (typeof args[0] === 'number') {
      const [width, height, fit] = args as [width: number, height: number, fit: Canvas2DStageFitType];

      this.#fit = fit ?? this.#fit;

      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
    } else {
      const [canvas, fit] = args as [canvas: HTMLCanvasElement, fit: Canvas2DStageFitType];

      this.#fit = fit ?? this.#fit;

      this.canvas = canvas;
    }

    this.#viewSpecs = {width: this.width, height: this.height, fit: this.#fit};

    this.projection = new OrthographicProjection('xy|bottom-left', this.#viewSpecs);

    this.stage = new Stage2D(this.projection);
    this.stageRenderer.add(this.stage);

    this.#placeholderTexture = new Texture();

    this.#material = new SpriteMaterial({map: this.#placeholderTexture});
    this.sprite = new Sprite(this.#material);

    this.sprite.scale.set(this.width, this.height, 1);

    this.scene.add(this.sprite);
  }

  #updateTexture(): void {
    if (!this.needsUpdate) return;

    // WebGPU builds no texture of width or height 0, and three.js hands the size of the image on
    // unchecked (Textures#updateTexture()): a canvas without area waits, flag and all, for the
    // first render() with one
    if (this.canvas.width === 0 || this.canvas.height === 0) return;

    this.needsUpdate = false;

    // three.js allocates the GPU texture once, in the size of the first upload, and copies every
    // later needsUpdate upload into it (Textures#updateTexture() creates the backend texture only
    // as long as the texture is the default one): a canvas of another size needs a texture of its own
    if (this.#texture != null && this.canvas.width === this.#textureWidth && this.canvas.height === this.#textureHeight) {
      this.#texture.needsUpdate = true;
      return;
    }

    this.#textureFactory ||= new TextureFactory(this.renderer, ['nearest', 'flipy', 'srgb']);

    const previous = this.#texture;

    this.#texture = this.#textureFactory.create(this.canvas);
    this.#textureWidth = this.canvas.width;
    this.#textureHeight = this.canvas.height;

    this.#material.map = this.#texture;
    this.#material.needsUpdate = true;

    // the material points at the successor before the predecessor falls: nothing ever reads
    // a texture that is already released
    previous?.dispose();
  }

  /**
   * Hands the size of the area the stage is drawn into — the size a `Display` reports with
   * `OnDisplayResize`, for one — to {@link stageRenderer}, which hands it on to {@link stage}:
   * the stage takes its camera from it, and before the first call nothing is drawn.
   *
   * Width and height must be finite numbers: `NaN` and an infinite value are refused with a
   * `RangeError` that names this call, before the size reaches the renderer — on a disposed
   * stage as well. A width or a height of 0 or below goes on to `StageRenderer#resize()` as it is.
   */
  setContainerSize(width: number, height: number): void {
    // checked here although StageRenderer#resize() checks the same: the refusal names the call
    // the caller made, and a disposed stage, which hands nothing on, refuses it all the same
    assertFinite(width, 'Canvas2DStage#setContainerSize()', 'width');
    assertFinite(height, 'Canvas2DStage#setContainerSize()', 'height');

    if (this.#disposed) return;

    // the renderer hands the size on to every stage it holds, this one included: its own
    // width and height then answer the container, and a render target built behind a pipeline
    // set on it gets that size instead of the 1×1 minimum
    this.stageRenderer.resize(width, height);
  }

  setCanvasSize(width: number, height: number): void {
    // refused on a disposed stage as well: a size that is no size is wrong whatever the state
    assertPositiveFinite(width, 'Canvas2DStage#setCanvasSize()', 'width');
    assertPositiveFinite(height, 'Canvas2DStage#setCanvasSize()', 'height');

    // the canvas may have been handed in, and a disposed stage does not write to it
    if (this.#disposed) return;

    if (this.width !== width || this.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.#followCanvasSize();
  }

  // sprite and view take the size the canvas has — read from the canvas, which rounds a width or a
  // height it is given down to a whole number, and which its owner may have resized in place
  #followCanvasSize(): void {
    const {width, height} = this;
    if (this.#viewSpecs.width === width && this.#viewSpecs.height === height) return;

    this.sprite.scale.set(width, height, 1);

    this.#viewSpecs.width = width;
    this.#viewSpecs.height = height;

    this.stage.updateProjection(true);
  }

  #clock?: Chronometer;
  #frameNo = 0;

  /**
   * Draws one frame, in this order: sprite and view follow a new canvas size, and
   * `OnCanvas2DStageResize` goes out, if the canvas size changed since the last frame,
   * `OnCanvas2DStageRender` — the moment to draw into the canvas and set
   * `needsUpdate` —, the upload of the canvas, `stageRenderer.updateFrame()` and
   * `stageRenderer.renderTo()`.
   *
   * The values typically come from the `DisplayEventProps` of `OnDisplayRenderFrame`. Called
   * without them, the stage takes all three from a clock of its own: the first such call passes
   * `0`, `0` and frame `1`, every further one the seconds since that call and since the one
   * before, counting frames from 1. A call with values touches neither the clock nor the count.
   *
   * Without `setContainerSize()` the {@link stage} has no camera and nothing is drawn; after 100
   * such frames the stage warns once. This method drives {@link stageRenderer} itself — hung on
   * a host such as a `Display`, it would update and draw twice per frame.
   */
  render(): void;
  render(now: number, deltaTime: number, frameNo: number): void;
  render(now?: number, deltaTime?: number, frameNo?: number): void {
    if (this.#disposed) return;

    if (this.width !== this.#lastWidth || this.height !== this.#lastHeight) {
      // ahead of the event: a listener reads sprite and view in the new size already
      this.#followCanvasSize();

      this.#dispatchEvent(OnCanvas2DStageResize);

      this.#lastWidth = this.width;
      this.#lastHeight = this.height;
    }

    this.#dispatchEvent(OnCanvas2DStageRender);

    this.#updateTexture();

    if (now === undefined || deltaTime === undefined || frameNo === undefined) {
      if (this.#clock) {
        this.#clock.update();
        now = this.#clock.time;
        deltaTime = this.#clock.deltaTime;
      } else {
        this.#clock = new Chronometer();
        now = 0;
        deltaTime = 0;
      }
      frameNo = ++this.#frameNo;
    }

    this.stageRenderer.updateFrame(now, deltaTime, frameNo);
    this.stageRenderer.renderTo(this.renderer);
  }

  #dispatchEvent(eventName: typeof OnCanvas2DStageResize | typeof OnCanvas2DStageRender): void {
    emit(this, eventName, this);
  }

  #disposed = false;

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Release the three.js resources this stage built for itself: the sprite material it built — a
   * material the caller set into the slot of {@link sprite} stays the caller's —, the blank texture
   * that material starts out with, the texture the stage built last from the canvas — each earlier
   * one was released when its successor took its place —, the {@link StageRenderer} and the
   * {@link Stage2D} behind {@link stage}. The sprite leaves the scene before the material goes, so
   * no frame reaches a sprite without one.
   *
   * The `WebGPURenderer` and a canvas handed to the constructor belong to the caller and are
   * left untouched — the canvas keeps the size and the content it had. `THREE.Sprite` shares
   * one geometry across every sprite of the module; it is not this stage's to release.
   *
   * Afterwards `isDisposed` is `true`, `texture` answers `undefined`, and `render()`,
   * `setCanvasSize()`, `setContainerSize()`, a write to `fit` and a further `dispose()` do nothing;
   * `setCanvasSize()` still refuses a size that is no finite number above 0, and
   * `setContainerSize()` one that is no finite number.
   * `canvas`, `renderer`, `projection`, `scene`, `sprite` and `needsUpdate` keep the values the
   * stage was left with. {@link width} and {@link height} read `canvas.width` and `canvas.height`,
   * so they keep answering with whatever stands at the canvas — including what the caller sets
   * there later. The `readonly` fields {@link stage} and {@link stageRenderer} answer with the same
   * instance as before, and both of them report `isDisposed === true`. An `OnCanvas2DStageDispose`
   * goes out to every subscriber before this stage stops listening; no event follows it.
   *
   * A listener of `OnCanvas2DStageDispose` that throws does not hold up the teardown: every
   * subscriber hears the event, the instance is torn down completely, and the error reaches the
   * caller afterwards — one unchanged, several as an `AggregateError`. That holds for the
   * `OnStageDispose` listeners of the {@link StageRenderer} and the {@link Stage2D} as well, for
   * the `OnStageRemoved` listeners of the `StageRenderer`, and for the release of the pass node
   * of the `Stage2D`.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    const errors: unknown[] = [];

    // the listeners are still attached here: this event is what tells them to let go
    try {
      emitStrict(this, OnCanvas2DStageDispose, this);
    } catch (error) {
      errors.push(error);
    }
    off(this);

    // out of the scene graph before the material goes — a sprite without one cannot be drawn
    this.sprite.removeFromParent();

    this.#material.dispose();
    this.#placeholderTexture.dispose();
    this.#texture?.dispose();
    this.#texture = undefined;
    this.#textureFactory = undefined;

    try {
      this.stageRenderer.dispose();
    } catch (error) {
      errors.push(error);
    }

    // the stage was built in the constructor of this class, and the renderer above has let go of it
    try {
      this.stage.dispose();
    } catch (error) {
      errors.push(error);
    }

    // the errors stand in the order of the teardown above, which is no promise to the caller
    throwCollected(
      errors,
      'Canvas2DStage#dispose(): more than one of its dispose listeners, StageRenderer#dispose() and Stage2D#dispose() threw',
    );
  }
}
