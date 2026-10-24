import {emit, emitStrict, type EventizedObject, eventize, off} from '@spearwolf/eventize';
import type {WebGPURenderer} from 'three/webgpu';
import {Sprite, SpriteMaterial, Texture, type Scene} from 'three/webgpu';
import {Chronometer} from '../display/Chronometer.js';
import {OnCanvas2DStageDispose, OnCanvas2DStageRender, OnCanvas2DStageResize} from '../events.js';
import {TextureFactory} from '../texture/TextureFactory.js';
import {assertFinite} from '../utils/assertFinite.js';
import {describeValue} from '../utils/describeValue.js';
import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import {throwCollected} from '../utils/throwCollected.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {Stage2D} from './Stage2D.js';
import {StageRenderer} from './StageRenderer.js';

/**
 * How the view brings the canvas into the container: `'contain'` shows the whole canvas and
 * leaves the rest of the container empty where the aspect ratios differ, `'cover'` fills the
 * container and cuts off what of the canvas does not fit.
 */
export type Canvas2DStageFitType = 'contain' | 'cover';

/**
 * The view specs a `Canvas2DStage` drives: a `contain`/`cover` fit with both sides given.
 * That is one arm of the `ProjectionFitSpecs` union, and writing `width` and `height`
 * through the union itself is not possible — its `pixelZoom` arm carries neither. The stage
 * holds the object it hands to its projection, so both read the same specs.
 */
type Canvas2DViewSpecs = {fit: Canvas2DStageFitType; width: number; height: number};

const FIT_TYPES: ReadonlySet<unknown> = new Set<Canvas2DStageFitType>(['contain', 'cover']);

// a fit the projection does not know would land in the view specs as it is, and no view follows from it
function checkFit(fit: unknown, subject: string): Canvas2DStageFitType {
  if (!FIT_TYPES.has(fit)) {
    throw new TypeError(`${subject}: fit must be "contain" or "cover", got ${describeValue(fit)}`);
  }
  return fit as Canvas2DStageFitType;
}

// a canvas takes its width and its height as whole numbers and rounds a fraction down: below 1 it has no area
function assertCanvasSide(value: unknown, subject: string, name: string): number {
  if (!isFiniteNumber(value) || value < 1) {
    throw new RangeError(`${subject}: ${name} must be a finite number of 1 or more, got ${describeValue(value)}`);
  }
  return value;
}

export interface Canvas2DStage extends EventizedObject {}

/**
 * A 2D canvas in a three.js scene: a {@link Stage2D} with an orthographic projection shows the
 * canvas on a sprite, fitted into the container. Draw into the canvas in
 * `OnCanvas2DStageRender`, set {@link needsUpdate}, and call {@link render} once per frame — the
 * stage drives its {@link StageRenderer} itself. {@link dispose} releases what the stage built.
 */
export class Canvas2DStage {
  /**
   * The `WebGPURenderer` handed to the constructor, which {@link render} draws with; it stays the
   * caller's.
   */
  readonly renderer: WebGPURenderer;

  /**
   * The `StageRenderer` the stage builds and {@link stage} hangs in: {@link setContainerSize}
   * hands it the size of the container, {@link render} updates and draws it, and {@link dispose}
   * disposes it.
   */
  readonly stageRenderer: StageRenderer;

  #fit: Canvas2DStageFitType = 'contain';

  /**
   * How the view brings the canvas into the container: `'contain'`, the default, or `'cover'`. A
   * write of any other value throws a `TypeError` and leaves the fit as it is — on a disposed
   * stage as well, where a write of a valid value does nothing.
   */
  get fit(): Canvas2DStageFitType {
    return this.#fit;
  }

  set fit(value: Canvas2DStageFitType) {
    // ahead of the guard: an invalid value is turned away on a disposed stage as well
    checkFit(value, 'Canvas2DStage');
    if (this.#disposed || this.#fit === value) return;
    this.#fit = value;
    this.#viewSpecs.fit = value;
    this.stage.updateProjection(true);
  }

  /**
   * The canvas the stage shows: built by the constructor in the size handed in, or the one handed
   * in, which stays the caller's — {@link dispose} leaves it as it is.
   */
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

  /**
   * The orthographic projection of {@link stage}, `'xy|bottom-left'`, fitted to the canvas size
   * with {@link fit}.
   */
  readonly projection: OrthographicProjection;

  /**
   * The `Stage2D` that shows the canvas on {@link sprite}; the constructor builds it, and
   * {@link dispose} disposes it.
   */
  readonly stage: Stage2D;

  /** The scene of {@link stage}; it holds {@link sprite}. */
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

  /**
   * Builds a stage on a canvas of its own of `width` × `height`, or on the `canvas` handed in, and
   * `fit` — `'contain'` without one — for the view.
   *
   * @throws {RangeError} for a width or a height that is no finite number of 1 or more, before
   *   anything is built.
   * @throws {TypeError} for a fit other than `'contain'` and `'cover'`, before anything is built.
   */
  constructor(
    renderer: WebGPURenderer,
    ...args:
      | [width: number, height: number]
      | [width: number, height: number, fit: Canvas2DStageFitType]
      | [canvas: HTMLCanvasElement]
      | [canvas: HTMLCanvasElement, fit: Canvas2DStageFitType]
  ) {
    eventize(this);

    // before anything is built: a canvas without area has nothing to show, and the sprite and
    // the view would take its size; a fit the projection does not know gives no view at all
    let fit: Canvas2DStageFitType;
    if (typeof args[0] === 'number') {
      assertCanvasSide(args[0], 'new Canvas2DStage()', 'width');
      assertCanvasSide(args[1], 'new Canvas2DStage()', 'height');
      fit = checkFit(args[2] ?? 'contain', 'new Canvas2DStage()');
    } else {
      fit = checkFit(args[1] ?? 'contain', 'new Canvas2DStage()');
    }

    this.renderer = renderer;
    this.stageRenderer = new StageRenderer();

    if (typeof args[0] === 'number') {
      const [width, height] = args as [width: number, height: number];

      this.#fit = fit;

      this.canvas = document.createElement('canvas');
      this.canvas.width = width;
      this.canvas.height = height;
    } else {
      const [canvas] = args as [canvas: HTMLCanvasElement];

      this.#fit = fit;

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

  /**
   * Gives the canvas the size `width` × `height` and brings sprite and view there at once; the
   * next {@link render} sends `OnCanvas2DStageResize` if the size changed since the last frame.
   *
   * The canvas takes whole numbers and rounds down — `setCanvasSize(10.5, 8)` gives canvas,
   * sprite and view 10 × 8. A call with the size the canvas has leaves it standing, content and
   * all; a call with another size clears it, as every write to `canvas.width` does: draw anew in
   * `OnCanvas2DStageResize` or `OnCanvas2DStageRender` and set {@link needsUpdate}. A canvas
   * handed to the constructor belongs to the caller, and the call writes its width and height. On
   * a disposed stage a valid call does nothing.
   *
   * @throws {RangeError} for a width or a height that is no finite number of 1 or more, naming
   *   this call, before anything is written — after {@link dispose} as well.
   */
  setCanvasSize(width: number, height: number): void {
    // refused on a disposed stage as well: a size that is no size is wrong whatever the state
    assertCanvasSide(width, 'Canvas2DStage#setCanvasSize()', 'width');
    assertCanvasSide(height, 'Canvas2DStage#setCanvasSize()', 'height');

    // the canvas may have been handed in, and a disposed stage does not write to it
    if (this.#disposed) return;

    // the canvas takes whole numbers, and every write to its width clears it: a size it has
    // already is not written
    if (this.width !== Math.floor(width) || this.height !== Math.floor(height)) {
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
   *
   * Every listener of `OnCanvas2DStageResize` hears it, also behind one that throws. The stage has
   * taken the new size by then — the next `render()` sends no second event for it —, the frame
   * goes on with `OnCanvas2DStageRender`, the upload and the drawing, and the error reaches the
   * caller afterwards, one unchanged, several as an `AggregateError`. `OnCanvas2DStageRender` goes
   * out through `emit()`: a listener that throws ends the frame, and the canvas is neither
   * uploaded nor drawn.
   */
  render(): void;
  render(now: number, deltaTime: number, frameNo: number): void;
  render(now?: number, deltaTime?: number, frameNo?: number): void {
    if (this.#disposed) return;

    let resizeFailed = false;
    let resizeError: unknown;

    if (this.width !== this.#lastWidth || this.height !== this.#lastHeight) {
      // ahead of the event: a listener reads sprite and view in the new size already
      this.#followCanvasSize();

      // ahead of the event as well: a listener that throws must not bring the same size back as a
      // change in every frame after it
      this.#lastWidth = this.width;
      this.#lastHeight = this.height;

      try {
        // every listener hears the resize, even behind one that throws; the frame is drawn all the same
        emitStrict(this, OnCanvas2DStageResize, this);
      } catch (error) {
        resizeFailed = true;
        resizeError = error;
      }
    }

    try {
      // a listener that throws here ends the frame: a canvas drawn halfway is not uploaded
      emit(this, OnCanvas2DStageRender, this);

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
    } catch (error) {
      if (!resizeFailed) throw error;
      throwCollected(
        [resizeError, error],
        'Canvas2DStage#render(): a listener of OnCanvas2DStageResize threw, and so did the frame after it',
      );
    }

    if (resizeFailed) throw resizeError;
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
   * Afterwards `isDisposed` is `true`, `texture` answers `undefined`, `render()` and a further
   * `dispose()` do nothing, and `setCanvasSize()`, `setContainerSize()` and a write to `fit`
   * change nothing — they still refuse what they refuse on a live stage: a size that is no finite
   * number of 1 or more, one that is no finite number, and a fit that is neither `'contain'` nor
   * `'cover'`.
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
