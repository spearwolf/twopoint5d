import {on} from '@spearwolf/eventize';
import {
  createMaskNode,
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  type StageMaskCoverageSource,
  type StageRendererBuildOutputNode,
  type StageUpdateFrameProps,
  type TexturedSprite,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {float, length, mix, smoothstep, uv, vec2, vec3, vec4} from 'three/tsl';
import {
  ClampToEdgeWrapping,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  type Node,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type WebGPURenderer,
  type Wrapping,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';
import {type SoftBlob, SoftBlobs} from './SoftBlobs';

/** The view every stage of the demo lays itself out in, in units; `cover` fills any window. */
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;

// one tile of the wallpaper in units: 1024 texels over 240 units stay sharp up to 4.3 device
// pixels per unit, and at 1080p (2 px per unit) the texture is minified with mipmaps
const TILE = 240;
// the wall, wider and taller than any view under `cover`
const LEFT = -600;
const RIGHT = 600;
const TOP = 290;
const DADO = -150;
const FLOOR = -290;
// the wainscot texture is 4 : 1
const WAINSCOT_TILE = (DADO - FLOOR) * 4;

// how the composed picture is lit: a dim room, and the coloured light of the glows on top
const AMBIENT = 0.14;
const LIGHT_GAIN = 1.45;

interface EyeSpec {
  x: number;
  y: number;
  rx: number;
  ry: number;
  kind: 'big' | 'scroll' | 'face';
}

interface EyesJson {
  tileSize: number;
  eyes: EyeSpec[];
  eyeParts: {sclera: [number, number, number, number]; iris: [number, number, number, number]; irisRadius: number};
}

export interface WallpaperAssets {
  plain: Texture;
  haunted: Texture;
  wainscotPlain: Texture;
  wainscotHaunted: Texture;
  eyeParts: Texture;
  eyes: EyesJson;
}

const DIR = 'stage-masks/without-director';

/** Loads the generated art of the demo (`assets-src/stage-masks/without-director/`). */
export async function loadWallpaperAssets(renderer: WebGPURenderer): Promise<WallpaperAssets> {
  const loader = new TextureLoader();
  const anisotropy = renderer.getMaxAnisotropy();
  const load = async (name: string, wrapT: Wrapping = RepeatWrapping) => {
    const texture = await loader.loadAsync(assetsUrl(`${DIR}/${name}`));
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = wrapT;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = anisotropy;
    return texture;
  };
  const [plain, haunted, wainscotPlain, wainscotHaunted, eyeParts, eyes] = await Promise.all([
    load('wallpaper-plain.webp'),
    load('wallpaper-haunted.webp'),
    load('wainscot-plain.webp', ClampToEdgeWrapping),
    load('wainscot-haunted.webp', ClampToEdgeWrapping),
    load('eye-parts.png', ClampToEdgeWrapping),
    fetch(assetsUrl(`${DIR}/eyes.json`)).then((response) => response.json() as Promise<EyesJson>),
  ]);
  eyeParts.wrapS = ClampToEdgeWrapping;
  return {plain, haunted, wainscotPlain, wainscotHaunted, eyeParts, eyes};
}

export function disposeWallpaperAssets(assets: WallpaperAssets): void {
  assets.plain.dispose();
  assets.haunted.dispose();
  assets.wainscotPlain.dispose();
  assets.wainscotHaunted.dispose();
  assets.eyeParts.dispose();
}

const makeStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}));
  stage.name = name;
  return stage;
};

/** A plane of the wall: the wallpaper from the dado up, or the wainscot below it. */
function wallPlane(map: Texture, part: 'paper' | 'wainscot', renderOrder: number, transparent = false): Mesh {
  const width = RIGHT - LEFT;
  const [bottom, top, tile] = part === 'paper' ? [DADO, TOP, TILE] : [FLOOR, DADO, WAINSCOT_TILE];
  const height = top - bottom;
  // every texture of the demo lies on exactly one plane, so the plane sets its repeat
  if (part === 'paper') {
    map.repeat.set(width / TILE, height / TILE);
    // the top edge of the wall on a tile edge: the eyes of eyes.json are measured from there
    map.offset.set(0, Math.ceil(height / TILE) - height / TILE);
  } else {
    map.repeat.set(width / tile, 1);
  }
  const mesh = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({map, transparent, depthTest: false, depthWrite: false}),
  );
  mesh.position.set((LEFT + RIGHT) / 2, (bottom + top) / 2, 0);
  mesh.renderOrder = renderOrder;
  return mesh;
}

interface Eye {
  x: number;
  y: number;
  /** how far the iris may roll, in units */
  reachX: number;
  reachY: number;
  /** the current offset of the iris */
  ox: number;
  oy: number;
  /** how quickly the eye follows, per second: some are slow, which looks worse */
  speed: number;
  iris: TexturedSprite;
}

interface Candle {
  blob: SoftBlob;
  // a slow Lissajous path over the wall
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  phase: number;
  radius: number;
  intensity: number;
}

/** The glows: three candles, one violet will-o'-wisp, and the candle of the pointer. */
const CANDLE_COLOR = new Color('#ffb874');
const WISP_COLOR = new Color('#8a63ff');
const HAND_COLOR = new Color('#ffe2b0');

/**
 * "The wallpaper is watching": a Victorian room in three stages for a composing `StageRenderer` —
 * `room` (the ordinary wallpaper), `haunted` (the same wallpaper whose ornament has become eyes and
 * mouths) and `glows` (soft candle glows over transparent black, the mask). {@link buildOutputNode}
 * shows `haunted` only where the glows are, through `createMaskNode()`, over `room`.
 */
export class WatchingWallpaper {
  readonly room = makeStage('room');
  readonly haunted = makeStage('haunted');
  readonly glows = makeStage('glows');

  // a candle reveals a round patch with a soft rim: full coverage out to a third of the radius
  readonly blobs = new SoftBlobs({
    capacity: 8,
    name: 'candle glows',
    falloff: (t) => {
      const s = Math.min(1, Math.max(0, (t - 0.3) / 0.7));
      return 1 - s * s * (3 - 2 * s);
    },
  });
  readonly #eyeSprites: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #eyes: Eye[] = [];
  readonly #candles: Candle[] = [];
  readonly #hand: SoftBlob;
  readonly #meshes: Mesh[] = [];

  // where the pointer is in units of the view, and when it last moved (seconds of the demo)
  readonly #pointer = {x: 0, y: 0, lastMoved: -Infinity};

  #time = 0;
  #handX = 0;
  #handY = 60;

  constructor(assets: WallpaperAssets) {
    // the ordinary room
    this.#addMesh(this.room, wallPlane(assets.plain, 'paper', 0));
    this.#addMesh(this.room, wallPlane(assets.wainscotPlain, 'wainscot', 1));

    // the haunted room: scleras and irises first, the wallpaper with its eye holes over them
    const count = this.#countEyes(assets.eyes);
    this.#eyeSprites = new FeatureSprites(TexturedSpriteKind, {
      capacity: count * 2,
      textures: {colorMap: assets.eyeParts},
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.#eyeSprites.renderOrder = 0;
    this.haunted.scene.add(this.#eyeSprites);
    this.#placeEyes(assets.eyes);
    this.#addMesh(this.haunted, wallPlane(assets.haunted, 'paper', 1, true));
    this.#addMesh(this.haunted, wallPlane(assets.wainscotHaunted, 'wainscot', 2));

    // the mask: candles that drift, a wisp, and the candle the pointer carries
    this.glows.scene.add(this.blobs.mesh);
    const paths = [
      {cx: -260, cy: 110, ax: 150, ay: 90, fx: 0.11, fy: 0.17, phase: 0.4, radius: 170, color: CANDLE_COLOR},
      {cx: 270, cy: 40, ax: 170, ay: 120, fx: 0.09, fy: 0.13, phase: 2.1, radius: 185, color: CANDLE_COLOR},
      {cx: 30, cy: 190, ax: 320, ay: 50, fx: 0.06, fy: 0.15, phase: 4.0, radius: 155, color: CANDLE_COLOR},
      {cx: -40, cy: -110, ax: 380, ay: 95, fx: 0.07, fy: 0.21, phase: 1.3, radius: 150, color: WISP_COLOR},
    ];
    for (const path of paths) {
      const blob = this.blobs.add(path.cx, path.cy, path.radius, 1)!.setColor(path.color);
      this.#candles.push({blob, ...path, intensity: path.color === WISP_COLOR ? 0.85 : 1});
    }
    this.#hand = this.blobs.add(0, 60, 175, 1)!.setColor(HAND_COLOR);

    on(this.glows, OnStageUpdateFrame, ({deltaTime}: StageUpdateFrameProps) => this.#updateGlows(deltaTime));
    on(this.haunted, OnStageUpdateFrame, ({deltaTime}: StageUpdateFrameProps) => this.#updateEyes(deltaTime));
  }

  #addMesh(stage: Stage2D, mesh: Mesh): void {
    stage.scene.add(mesh);
    this.#meshes.push(mesh);
  }

  /** Calls `visit` for every eye of every tile that lies on the visible wallpaper. */
  #forEachEye(json: EyesJson, visit: (eye: EyeSpec, x: number, y: number) => void): void {
    for (let j = -1; j <= Math.ceil((TOP - DADO) / TILE); j++) {
      for (let i = -1; i <= Math.ceil((RIGHT - LEFT) / TILE); i++) {
        for (const eye of json.eyes) {
          const x = LEFT + (i + eye.x) * TILE;
          const y = TOP - (j + eye.y) * TILE;
          const rx = eye.rx * TILE;
          const ry = eye.ry * TILE;
          if (x + rx < LEFT || x - rx > RIGHT || y + ry < DADO || y - ry > TOP) continue;
          visit(eye, x, y);
        }
      }
    }
  }

  #countEyes(json: EyesJson): number {
    let count = 0;
    this.#forEachEye(json, () => count++);
    return count;
  }

  #placeEyes(json: EyesJson): void {
    const atlas = 512;
    const [ss, st, sw, sh] = json.eyeParts.sclera;
    const [is, it, iw, ih] = json.eyeParts.iris;
    // first every sclera, then every iris: one mesh draws its sprites in the order they were made
    this.#forEachEye(json, (eye, x, y) => {
      const sclera = this.#eyeSprites.createSprite()!;
      sclera.setTexCoords(ss / atlas, st / 256, sw / atlas, sh / 256);
      sclera.setSize(eye.rx * TILE * 2.3, eye.ry * TILE * 2.6);
      sclera.setPosition(x, y, 0);
    });
    let n = 0;
    this.#forEachEye(json, (eye, x, y) => {
      const rx = eye.rx * TILE;
      const ry = eye.ry * TILE;
      // the iris a little taller than the opening: the lids always cover a sliver of it
      const radius = ry * 1.02;
      const iris = this.#eyeSprites.createSprite()!;
      iris.setTexCoords(is / atlas, it / 256, iw / atlas, ih / 256);
      const quad = (radius * 2) / json.eyeParts.irisRadius;
      iris.setSize(quad, quad);
      iris.setPosition(x, y, 0);
      // a deterministic spread of speeds: neighbours never move in step
      const speed = 2.2 + ((n * 7919) % 13) * 0.35;
      n++;
      this.#eyes.push({x, y, reachX: Math.max(0, rx - radius * 0.85), reachY: ry * 0.22, ox: 0, oy: 0, speed, iris});
    });
    this.#eyeSprites.update();
  }

  /** The pointer is at (x, y) in units of the view: the hand's candle goes there. */
  pointAt(x: number, y: number): void {
    this.#pointer.x = x;
    this.#pointer.y = y;
    this.#pointer.lastMoved = this.#time;
  }

  /** where the light the eyes follow is: the candle of the pointer */
  get handX(): number {
    return this.#handX;
  }

  get handY(): number {
    return this.#handY;
  }

  #updateGlows(deltaTime: number): void {
    const t = (this.#time += deltaTime);

    for (let i = 0; i < this.#candles.length; i++) {
      const c = this.#candles[i]!;
      // a flame flickers: a few incommensurate sines, never quite repeating
      const flicker =
        0.86 + 0.07 * Math.sin(t * 7.3 + c.phase * 3) + 0.05 * Math.sin(t * 13.1 + c.phase) + 0.03 * Math.sin(t * 23.7);
      c.blob.x = c.cx + c.ax * Math.sin(t * c.fx * Math.PI * 2 + c.phase);
      c.blob.y = c.cy + c.ay * Math.sin(t * c.fy * Math.PI * 2 + c.phase * 1.7);
      c.blob.radius = c.radius * (0.94 + 0.06 * flicker);
      c.blob.intensity = c.intensity * flicker;
    }

    // the hand: to the pointer while it moves, wandering on its own when it rests
    const idle = t - this.#pointer.lastMoved > 2.5;
    const tx = idle ? Math.sin(t * 0.23) * 300 : this.#pointer.x;
    const ty = idle ? 60 + Math.sin(t * 0.37 + 1) * 110 : this.#pointer.y;
    const follow = 1 - Math.exp(-deltaTime * (idle ? 1.2 : 9));
    this.#handX += (tx - this.#handX) * follow;
    this.#handY += (ty - this.#handY) * follow;
    this.#hand.x = this.#handX;
    this.#hand.y = this.#handY;
    this.#hand.intensity = 0.92 + 0.05 * Math.sin(t * 9.1) + 0.03 * Math.sin(t * 17.3);

    this.blobs.update();
  }

  #updateEyes(deltaTime: number): void {
    const tx = this.#handX;
    const ty = this.#handY;
    for (let i = 0; i < this.#eyes.length; i++) {
      const eye = this.#eyes[i]!;
      const dx = tx - eye.x;
      const dy = ty - eye.y;
      const dist = Math.hypot(dx, dy) || 1;
      // saturates with distance: a light far away turns the eye to the edge of its reach
      const k = dist / (dist + 120);
      const gx = (dx / dist) * k * eye.reachX;
      const gy = (dy / dist) * k * eye.reachY;
      const follow = 1 - Math.exp(-deltaTime * eye.speed);
      eye.ox += (gx - eye.ox) * follow;
      eye.oy += (gy - eye.oy) * follow;
      eye.iris.setPosition(eye.x + eye.ox, eye.y + eye.oy, 0);
    }
    this.#eyeSprites.update();
  }

  /**
   * The output node builder for the composing `StageRenderer` of the three stages, in the order
   * `room`, `haunted`, `glows`. `options()` is read on every build: a change of `source` or `invert`
   * needs `invalidateOutputNode()` and the renderer builds the node again.
   */
  createOutputNodeBuilder(options: () => {source: StageMaskCoverageSource; invert: boolean}): StageRendererBuildOutputNode {
    type Vec4 = Node<'vec4'> & {rgb: Node<'vec3'> & {mul(o: unknown): Node<'vec3'>}; a: Node<'float'>};
    return ([room, haunted, glow]: Node[]): Node => {
      const {source, invert} = options();
      // the haunted wall, where the glows cover it
      const masked = createMaskNode(haunted!, glow!, {source, invert}) as unknown as Vec4;
      // premultiplied `over`: the masked haunted wall on the ordinary one
      const composed = masked.rgb.add((room as unknown as Vec4).rgb.mul(float(1).sub(masked.a)));
      // the light of the glows, in their own colour, on everything: a candle lights the wall it
      // reveals, and with `invert` it lights the ordinary wall that only shows where it burns
      const light = (glow as unknown as Vec4).rgb.mul(LIGHT_GAIN).add(vec3(AMBIENT, AMBIENT * 0.95, AMBIENT * 1.08));
      const fromCentre = length(uv().sub(0.5).mul(vec2(1, 0.75)));
      // full brightness out to 0.2 from the centre, down to 0.45 at 0.62; smoothstep's edges stay in
      // ascending order, which GLSL and WGSL both require
      const vignette = mix(float(1), float(0.45), smoothstep(0.2, 0.62, fromCentre));
      return vec4(composed.mul(light).mul(vignette), 1) as unknown as Node;
    };
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      // the textures are the assets', released by disposeWallpaperAssets()
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.#eyeSprites.dispose();
    this.blobs.dispose();
    this.room.dispose();
    this.haunted.dispose();
    this.glows.dispose();
  }
}
