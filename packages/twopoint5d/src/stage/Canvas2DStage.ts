import {emit, eventize} from '@spearwolf/eventize';
import {Sprite, SpriteMaterial, Texture, type Scene} from 'three';
import type {ThreeRendererType} from '../display/types.js';
import {TextureFactory} from '../texture/TextureFactory.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {Stage2D} from './Stage2D.js';
import {StageRenderer} from './StageRenderer.js';

export type Canvas2DStageFitType = 'contain' | 'cover';

export class Canvas2DStage {
  readonly renderer: ThreeRendererType;
  readonly stageRenderer: StageRenderer;

  #fit: Canvas2DStageFitType = 'contain';

  get fit(): Canvas2DStageFitType {
    return this.#fit;
  }

  set fit(value: Canvas2DStageFitType) {
    if (this.#fit === value) return;
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

  texture?: Texture;
  #textureFactory?: TextureFactory;

  /**
   * You should set `needsUpdate` to `true` if the canvas content has changed
   */
  needsUpdate = false;

  #lastWidth = 0;
  #lastHeight = 0;

  constructor(
    renderer: ThreeRendererType,
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
    this.stageRenderer.addStage(this.stage);

    const material = new SpriteMaterial({map: new Texture()});
    this.sprite = new Sprite(material);

    this.sprite.scale.set(this.width, this.height, 1);

    this.scene.add(this.sprite);
  }

  private makeTexture(): Texture {
    if (this.texture) {
      this.texture.dispose();
    }

    this.#textureFactory ||= new TextureFactory(this.renderer, ['nearest', 'flipy', 'srgb']);

    this.texture = this.#textureFactory.create(this.canvas);

    return this.texture;
  }

  private updateTexture() {
    if (this.needsUpdate) {
      this.sprite.material.map = this.makeTexture();
      this.sprite.material.needsUpdate = true;
      this.needsUpdate = false;
    }
  }

  setContainerSize(width: number, height: number) {
    this.stage.resize(width, height);
  }

  setCanvasSize(width: number, height: number) {
    if (this.width === width && this.height === height) return;

    this.canvas.width = width;
    this.canvas.height = height;

    this.sprite.scale.set(width, height, 1);

    const viewSpecs = this.projection.viewSpecs as any;
    viewSpecs.width = width;
    viewSpecs.height = height;

    this.stage.updateProjection(true);
  }

  // TODO rename to renderFrame
  render() {
    if (this.width !== this.#lastWidth || this.height !== this.#lastHeight) {
      this.dispatchEvent('resize');

      this.#lastWidth = this.width;
      this.#lastHeight = this.height;
    }

    // TODO rename to renderFrame
    this.dispatchEvent('render');

    this.updateTexture();

    this.stageRenderer.renderFrame(this.renderer);
  }

  private dispatchEvent(eventName: string) {
    emit(this, eventName, this);
  }
}
