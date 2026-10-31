import {on} from '@spearwolf/eventize';
import {
  matte,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  StageMask,
  type StageTransitionEffect,
  type StageUpdateFrameProps,
} from '@spearwolf/twopoint5d';
import {DataTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, RGBAFormat} from 'three/webgpu';
import {SoftBlobs} from '../stage-masks/SoftBlobs';
import {VIEW_HEIGHT, VIEW_WIDTH} from './assets';

/** A mask stage over the same view as the pictures of the gallery, so the matte lines up with them. */
const makeMaskStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}));
  stage.name = name;
  return stage;
};

const INK_COLUMNS = 8;
const INK_ROWS = 5;
/** by this share of the progress every blot has its full size: the picture is covered before the end */
const INK_FULL_AT = 0.9;

/**
 * Ink blots for `matte()` in its `'coverage'` mode: a grid of blots, each shifted and sized a little
 * differently, that grow by `mask.progress` — so they follow the transition at any duration and
 * easing, and also when the slider holds it by hand. The mask stage is never in the stack.
 */
class InkBlots {
  readonly stage = makeMaskStage('ink blots');
  readonly mask: StageMask;
  readonly #blots = new SoftBlobs({
    capacity: INK_COLUMNS * INK_ROWS,
    name: 'ink blots',
    // a blot has a crisp rim, not a glow
    falloff: (t) => 1 - Math.min(1, Math.max(0, (t - 0.7) / 0.3)) ** 2,
  });
  /** the full radius of each blot, parallel to the blobs of the pool */
  readonly #reach = new Float32Array(INK_COLUMNS * INK_ROWS);

  constructor() {
    const cellWidth = VIEW_WIDTH / INK_COLUMNS;
    const cellHeight = VIEW_HEIGHT / INK_ROWS;
    // a fixed hash instead of Math.random(): the same ink every run
    const hash = (n: number) => {
      const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    for (let row = 0; row < INK_ROWS; row++) {
      for (let column = 0; column < INK_COLUMNS; column++) {
        const i = row * INK_COLUMNS + column;
        const x = (column + 0.5 + (hash(i * 3 + 1) - 0.5) * 0.7) * cellWidth;
        const y = (row + 0.5 + (hash(i * 3 + 2) - 0.5) * 0.7) * cellHeight;
        this.#blots.add(x, y, 0.001, 1);
        this.#reach[i] = cellWidth * (1.15 + hash(i * 3 + 3) * 0.55);
      }
    }
    this.stage.scene.add(this.#blots.mesh);
    // precompile() draws the mask stage before its first update: the pool has to have uploaded once
    this.#blots.update();

    this.mask = new StageMask(this.stage);
    on(this.stage, OnStageUpdateFrame, () => this.#update());
  }

  #update(): void {
    const grown = Math.min(1, this.mask.progress / INK_FULL_AT);
    // slow at first, as a drop soaks in
    const size = grown * Math.sqrt(grown);
    const blobs = this.#blots.blobs;
    for (let i = 0; i < blobs.length; i++) blobs[i]!.radius = this.#reach[i]! * size + 0.001;
    this.#blots.update();
  }

  dispose(): void {
    this.mask.dispose();
    this.#blots.dispose();
    this.stage.dispose();
  }
}

const NOISE_WIDTH = 32;
const NOISE_HEIGHT = 18;
/** how often the noise is drawn again, in seconds */
const BOIL_EVERY = 0.12;

/**
 * A boiling gray noise for `matte()` in its `'threshold'` mode: the gray of a pixel is the progress
 * at which it switches, and the noise is drawn again several times a second. It boils by its own
 * time, counted from the frames of its stage — a mask stage updates only while a transition
 * references it, so the noise stands still between the transitions.
 */
class BoilingNoise {
  readonly stage = makeMaskStage('boiling noise');
  readonly mask: StageMask;
  readonly #noise = new DataTexture(new Uint8Array(NOISE_WIDTH * NOISE_HEIGHT * 4), NOISE_WIDTH, NOISE_HEIGHT, RGBAFormat);
  readonly #plane = new Mesh(new PlaneGeometry(VIEW_WIDTH, VIEW_HEIGHT), new MeshBasicMaterial({map: this.#noise}));
  #clock = 0;

  constructor() {
    // filtered up, the cells of the noise are soft clouds, not pixels
    this.#noise.magFilter = LinearFilter;
    this.#noise.minFilter = LinearFilter;
    this.#plane.position.set(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 0);
    this.stage.scene.add(this.#plane);
    this.#boil();

    this.mask = new StageMask(this.stage, {source: 'luminance'});
    on(this.stage, OnStageUpdateFrame, (frame: StageUpdateFrameProps) => {
      this.#clock += frame.deltaTime;
      if (this.#clock < BOIL_EVERY) return;
      this.#clock %= BOIL_EVERY;
      this.#boil();
    });
  }

  #boil(): void {
    const texels = this.#noise.image.data as Uint8Array;
    for (let i = 0; i < texels.length; i += 4) {
      texels[i] = texels[i + 1] = texels[i + 2] = Math.random() * 255;
      texels[i + 3] = 255;
    }
    this.#noise.needsUpdate = true;
  }

  dispose(): void {
    this.mask.dispose();
    this.#plane.geometry.dispose();
    this.#plane.material.dispose();
    this.#noise.dispose();
    this.stage.dispose();
  }
}

/**
 * The two living mattes of the gallery, each made once with its mask stage and its `matte()` effect:
 * ink blots in `'coverage'` mode and a boiling noise in `'threshold'` mode. Neither mask stage is a
 * layer of the stack — `matte()` names it, and the director draws it while the transition runs.
 */
export class GalleryMattes {
  readonly #ink = new InkBlots();
  readonly #noise = new BoilingNoise();
  readonly effects = new Map<string, StageTransitionEffect>([
    ['matte (ink, coverage)', matte({mask: this.#ink.mask})],
    ['matte (noise, threshold)', matte({mask: this.#noise.mask, mode: 'threshold', softness: 0.12})],
  ]);

  dispose(): void {
    this.#ink.dispose();
    this.#noise.dispose();
  }
}
