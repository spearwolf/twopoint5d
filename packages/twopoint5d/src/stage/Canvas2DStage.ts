import {emit, emitStrict, type EventizedObject, eventize, off} from '@spearwolf/eventize';
import type {WebGPURenderer} from 'three/webgpu';
import {Sprite, SpriteMaterial, Texture, type Scene} from 'three/webgpu';
import {Chronometer} from '../display/Chronometer.js';
import {TextureFactory} from '../texture/TextureFactory.js';
import {throwCollected} from '../texture/internals.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {Stage2D} from './Stage2D.js';
import {StageRenderer} from './StageRenderer.js';

export type Canvas2DStageFitType = 'contain' | 'cover';

/**
 * The view specs a `Canvas2DStage` drives: a `contain`/`cover` fit with both sides given.
 * That is one arm of the `FitIntoRectangleSpecs` union, and writing `width` and `height`
 * through the union itself is not possible — its `pixelZoom` arm carries neither. The stage
 * holds the object it hands to its projection, so both read the same specs.
 */
type Canvas2DViewSpecs = {fit: Canvas2DStageFitType; width: number; height: number};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
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

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  readonly projection: OrthographicProjection;
  readonly stage: Stage2D;

  get scene(): Scene {
    return this.stage.scene;
  }

  readonly sprite: Sprite;

  // the material starts out with a blank texture, and the first updateTexture() swaps it for the
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
   * carries — a canvas handed to the constructor that was painted before included.
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

    const material = new SpriteMaterial({map: this.#placeholderTexture});
    this.sprite = new Sprite(material);

    this.sprite.scale.set(this.width, this.height, 1);

    this.scene.add(this.sprite);
  }

  private updateTexture(): void {
    if (!this.needsUpdate) return;

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

    this.sprite.material.map = this.#texture;
    this.sprite.material.needsUpdate = true;

    // the material points at the successor before the predecessor falls: nothing ever reads
    // a texture that is already released
    previous?.dispose();
  }

  setContainerSize(width: number, height: number): void {
    if (this.#disposed) return;

    // the renderer hands the size on to every stage it holds, this one included: its own
    // width and height then answer the container, and a render target built behind a pipeline
    // set on it gets that size instead of the 1×1 minimum
    this.stageRenderer.resize(width, height);
  }

  setCanvasSize(width: number, height: number): void {
    // the canvas may have been handed in, and a disposed stage does not write to it
    if (this.#disposed || (this.width === width && this.height === height)) return;

    this.canvas.width = width;
    this.canvas.height = height;

    this.sprite.scale.set(width, height, 1);

    this.#viewSpecs.width = width;
    this.#viewSpecs.height = height;

    this.stage.updateProjection(true);
  }

  #clock?: Chronometer;
  #frameNo = 0;

  /**
   * Draws one frame, in this order: the `resize` event if the canvas size changed since the last
   * frame, the `render` event — the moment to draw into the canvas and set `needsUpdate` —, the
   * upload of the canvas, `stageRenderer.updateFrame()` and `stageRenderer.renderTo()`.
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
      this.dispatchEvent('resize');

      this.#lastWidth = this.width;
      this.#lastHeight = this.height;
    }

    this.dispatchEvent('render');

    this.updateTexture();

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

  private dispatchEvent(eventName: string): void {
    emit(this, eventName, this);
  }

  #disposed = false;

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Release the three.js resources this stage built for itself: the sprite material, both
   * textures that ever sat behind it, the {@link StageRenderer} and the {@link Stage2D} behind
   * {@link stage}. The sprite leaves the scene before its material goes, so no frame reaches a
   * sprite without one. The stage releases the textures it built.
   *
   * The `WebGPURenderer` and a canvas handed to the constructor belong to the caller and are
   * left untouched — the canvas keeps the size and the content it had. `THREE.Sprite` shares
   * one geometry across every sprite of the module; it is not this stage's to release.
   *
   * Afterwards `isDisposed` is `true`, `texture` answers `undefined`, and `render()`,
   * `setCanvasSize()`, `setContainerSize()`, a write to `fit` and a further `dispose()` do
   * nothing. `canvas`, `renderer`, `projection`, `scene`, `sprite` and `needsUpdate` keep the
   * values the stage was left with. {@link width} and {@link height} read `canvas.width` and
   * `canvas.height`, so they keep answering with whatever stands at the canvas — including what
   * the caller sets there later. The `readonly` fields {@link stage} and {@link stageRenderer}
   * answer with the same instance as before, and both of them report `isDisposed === true`. A
   * `dispose` event goes out to every subscriber before this stage stops listening; no event
   * follows it.
   *
   * A listener of the `dispose` event that throws does not hold up the teardown: every subscriber
   * hears the event, the instance is torn down completely, and the error reaches the caller
   * afterwards — one unchanged, several as an `AggregateError`. That holds for the `dispose`
   * listeners of the {@link StageRenderer} and the {@link Stage2D} as well.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    const errors: unknown[] = [];

    // the listeners are still attached here: this event is what tells them to let go
    try {
      emitStrict(this, 'dispose', this);
    } catch (error) {
      errors.push(error);
    }
    off(this);

    // out of the scene graph before the material goes — a sprite without one cannot be drawn
    this.sprite.removeFromParent();

    this.sprite.material.dispose();
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

    throwCollected(
      errors,
      'Canvas2DStage#dispose(): listeners of the dispose events of the stage, its stage renderer and its Stage2D threw',
    );
  }
}
