import {OrthographicProjection, Stage2D} from '@spearwolf/twopoint5d';
import {CanvasTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace} from 'three/webgpu';
import {VIEW_HEIGHT, VIEW_WIDTH} from './InkedRoom';

// the plate in units of the stage, and the texels the canvas has for each of them
const PLATE_WIDTH = 440;
const PLATE_HEIGHT = 58;
const TEXELS_PER_UNIT = 3;

/**
 * The caption under the picture, as a museum puts one under a print: a layer of its own on top of
 * the stack, without a post-process — whatever look the room below takes, the caption keeps its
 * colors and its sharp type. Drawn with the Canvas 2D API into a texture on a plane.
 */
export class Caption {
  readonly stage: Stage2D;
  readonly #canvas: HTMLCanvasElement;
  readonly #texture: CanvasTexture;
  readonly #mesh: Mesh;

  constructor() {
    // contain: the plate keeps its place at the bottom of the view on every screen
    this.stage = new Stage2D(
      new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'contain'}),
    );
    this.stage.name = 'the caption';

    this.#canvas = document.createElement('canvas');
    this.#canvas.width = PLATE_WIDTH * TEXELS_PER_UNIT;
    this.#canvas.height = PLATE_HEIGHT * TEXELS_PER_UNIT;

    this.#texture = new CanvasTexture(this.#canvas);
    this.#texture.colorSpace = SRGBColorSpace;
    this.#texture.minFilter = LinearFilter;
    this.#texture.generateMipmaps = false;

    const material = new MeshBasicMaterial({map: this.#texture, transparent: true, depthTest: false, depthWrite: false});
    this.#mesh = new Mesh(new PlaneGeometry(PLATE_WIDTH, PLATE_HEIGHT), material);
    this.#mesh.position.set(0, -VIEW_HEIGHT / 2 + 22 + PLATE_HEIGHT / 2, 0);
    this.stage.scene.add(this.#mesh);
  }

  /** Writes the plate anew: the title of the picture, and under it the look it is shown in. */
  write(title: string, look: string): void {
    const ctx = this.#canvas.getContext('2d')!;
    const {width, height} = this.#canvas;
    const s = TEXELS_PER_UNIT;
    ctx.clearRect(0, 0, width, height);

    // the plate: dark glass with a hairline of brass
    ctx.fillStyle = 'rgba(12, 10, 14, 0.82)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#b9975b';
    ctx.lineWidth = s;
    ctx.strokeRect(2.5 * s, 2.5 * s, width - 5 * s, height - 5 * s);

    // a seal of red wax, the one color the looks below never show
    ctx.fillStyle = '#c0261f';
    ctx.beginPath();
    ctx.arc(26 * s, height / 2, 8 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f1e9d6';
    ctx.font = `italic ${19 * s}px Georgia, 'Times New Roman', serif`;
    ctx.fillText(title, 46 * s, 21 * s);

    ctx.fillStyle = '#b9975b';
    ctx.font = `${10.5 * s}px Georgia, 'Times New Roman', serif`;
    ctx.fillText(look.toUpperCase().split('').join(' '), 47 * s, 42 * s);

    this.#texture.needsUpdate = true;
  }

  dispose(): void {
    this.#mesh.geometry.dispose();
    (this.#mesh.material as MeshBasicMaterial).dispose();
    this.#texture.dispose();
    this.stage.dispose();
  }
}
