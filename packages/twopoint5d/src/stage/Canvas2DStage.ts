import {emit, type EventizedObject, eventize, off} from '@spearwolf/eventize';
import type {WebGPURenderer} from 'three/webgpu';
import {Sprite, SpriteMaterial, Texture, type Scene} from 'three/webgpu';
import {TextureFactory} from '../texture/TextureFactory.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {Stage2D} from './Stage2D.js';
import {StageRenderer} from './StageRenderer.js';

export type Canvas2DStageFitType = 'contain' | 'cover';

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
    this.projection.viewSpecs.fit = value;
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

  /**
   * The texture the canvas content is drawn from. The stage owns whatever sits in this field:
   * `render()` releases it once its successor sits on the sprite material, and so does
   * {@link dispose}.
   */
  texture?: Texture;

  #textureFactory?: TextureFactory;

  /**
   * You should set `needsUpdate` to `true` if the canvas content has changed
   */
  needsUpdate = false;

  #lastWidth = 0;
  #lastHeight = 0;

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

    this.projection = new OrthographicProjection('xy|bottom-left', {
      width: this.width,
      height: this.height,
      fit: this.#fit as any,
    });

    this.stage = new Stage2D(this.projection);
    this.stageRenderer.add(this.stage);

    this.#placeholderTexture = new Texture();

    const material = new SpriteMaterial({map: this.#placeholderTexture});
    this.sprite = new Sprite(material);

    this.sprite.scale.set(this.width, this.height, 1);

    this.scene.add(this.sprite);
  }

  private makeTexture(): Texture {
    this.#textureFactory ||= new TextureFactory(this.renderer, ['nearest', 'flipy', 'srgb']);

    this.texture = this.#textureFactory.create(this.canvas);

    return this.texture;
  }

  private updateTexture() {
    if (this.needsUpdate) {
      const previous = this.texture;

      this.sprite.material.map = this.makeTexture();
      this.sprite.material.needsUpdate = true;
      this.needsUpdate = false;

      // the material points at the successor before the predecessor falls: nothing ever reads
      // a texture that is already released
      previous?.dispose();
    }
  }

  setContainerSize(width: number, height: number) {
    if (this.#disposed) return;

    this.stage.resize(width, height);
  }

  setCanvasSize(width: number, height: number) {
    // the canvas may have been handed in, and a disposed stage does not write to it
    if (this.#disposed || (this.width === width && this.height === height)) return;

    this.canvas.width = width;
    this.canvas.height = height;

    this.sprite.scale.set(width, height, 1);

    const viewSpecs = this.projection.viewSpecs as any;
    viewSpecs.width = width;
    viewSpecs.height = height;

    this.stage.updateProjection(true);
  }

  render() {
    if (this.#disposed) return;

    if (this.width !== this.#lastWidth || this.height !== this.#lastHeight) {
      this.dispatchEvent('resize');

      this.#lastWidth = this.width;
      this.#lastHeight = this.height;
    }

    this.dispatchEvent('render');

    this.updateTexture();

    this.stageRenderer.renderTo(this.renderer);
  }

  private dispatchEvent(eventName: string) {
    emit(this, eventName, this);
  }

  #disposed = false;

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Release the three.js resources this stage built for itself: the sprite material, both
   * textures that ever sat behind it and the {@link StageRenderer}. The sprite leaves the scene
   * before its material goes, so no frame reaches a sprite without one. {@link texture} is the
   * one field the stage owns whoever wrote it — a texture assigned there from outside is
   * released here as well.
   *
   * The `WebGPURenderer` and a canvas handed to the constructor belong to the caller and are
   * left untouched — the canvas keeps the size and the content it had. `THREE.Sprite` shares
   * one geometry across every sprite of the module; it is not this stage's to release.
   *
   * Afterwards `isDisposed` is `true`, `texture` answers `undefined`, and `render()`,
   * `setCanvasSize()`, `setContainerSize()`, a write to `fit` and a further `dispose()` do
   * nothing. `canvas`, `renderer`, `projection`, `stage`, `scene`, `sprite`, `stageRenderer`,
   * `width`, `height` and `needsUpdate` keep the values the stage was left with. A `dispose`
   * event goes out to every subscriber before this stage stops listening; no event follows it.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    // the listeners are still attached here: this event is what tells them to let go
    this.dispatchEvent('dispose');
    off(this);

    // out of the scene graph before the material goes — a sprite without one cannot be drawn
    this.sprite.removeFromParent();

    this.sprite.material.dispose();
    this.#placeholderTexture.dispose();
    this.texture?.dispose();
    this.texture = undefined;
    this.#textureFactory = undefined;

    this.stageRenderer.dispose();
  }
}
