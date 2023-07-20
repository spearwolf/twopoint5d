import {TextureFactory} from '@spearwolf/twopoint5d';
import {Scene, Sprite, SpriteMaterial, type Texture, type WebGLRenderer} from 'three';

export class QuadTreeVisualization {
  width: number;
  height: number;

  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  readonly scene = new Scene();

  #texture?: Texture;
  #sprite?: Sprite;
  #renderer?: WebGLRenderer;

  constructor(width: number, height: number, canvas?: HTMLCanvasElement) {
    this.width = width;
    this.height = height;

    this.canvas = canvas || document.createElement('canvas');

    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx = this.canvas.getContext('2d');
  }

  buildScene(renderer: WebGLRenderer): Scene {
    this.#renderer = renderer;

    if (this.#sprite) return this.scene;

    const material = new SpriteMaterial({map: this.makeTexture()});
    this.#sprite = new Sprite(material);

    this.#sprite.scale.set(this.width, this.height, 1);

    this.scene.add(this.#sprite);

    return this.scene;
  }

  makeTexture(renderer: WebGLRenderer = this.#renderer): Texture {
    if (this.#texture) {
      this.#texture.dispose();
    }

    const factory = new TextureFactory(renderer, ['nearest', 'flipy']);
    this.#texture = factory.create(this.canvas);

    return this.#texture;
  }

  update(width: number, height: number) {
    this.resize(width, height, () => {
      this.render();

      if (this.#sprite) {
        this.#sprite.material.map = this.makeTexture();
        this.#sprite.material.needsUpdate = true;
      }
    });
  }

  resize(width: number, height: number, action?: () => void) {
    if (this.width === width && this.height === height) return;

    this.width = width;
    this.height = height;

    this.canvas.width = width;
    this.canvas.height = height;

    if (this.#sprite) {
      this.#sprite.scale.set(width, height, 1);
    }

    if (action) action();
  }

  render() {
    this.ctx.fillStyle = 'rgb(0, 0, 0)';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = 'rgb(255, 255, 255)';

    this.ctx.beginPath();
    this.ctx.moveTo(0, 0);
    this.ctx.lineTo(this.width, 0);
    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(0, this.height);
    this.ctx.lineTo(0, 0);
    this.ctx.stroke();

    this.ctx.font = '15px monospace';
    this.ctx.fillStyle = 'rgb(64, 64, 64)';
    this.ctx.fillText(`${this.width} x ${this.height}`, 10, 20);
  }
}
