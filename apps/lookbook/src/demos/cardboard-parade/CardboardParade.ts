import {
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  flatPlacement,
  GroundPlacement,
  InstancePosition,
  Orientation,
  QuadBase,
  QuadSize,
  Rotation,
  type SpriteOf,
  type TextureAtlas,
  type TextureAtlasFrame,
  TextureColor,
  Tint,
  Yaw,
  type FeatureSpritesOf,
} from '@spearwolf/twopoint5d';
import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  Quaternion,
  type Texture,
} from 'three/webgpu';
import {CardboardBack} from './CardboardBack';

/** The atlas of the cut-outs and the texture of its image, out of the texture catalog. */
export interface CardboardAtlas {
  atlas: TextureAtlas;
  texture: Texture;
}

const YawPlacement = flatPlacement({orientation: 'yaw'});
const QuaternionPlacement = flatPlacement({orientation: 'quaternion'});

// the props stand still, but not all of them upright: a signpost leans, a fence panel lies where it
// fell. Their quaternions are written once — 16 bytes a sprite, where a yaw takes 4
const PropKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, QuaternionPlacement, Orientation, QuadSize, AtlasFrame, TextureColor, CardboardBack],
});

// the figures turn where they walk and rock on their feet; no back of their own — a profile drawn
// from behind is the mirror image that walks the other way, which is what it does
const WalkerKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, YawPlacement, Yaw, QuadSize, Rotation, AtlasFrame, TextureColor],
});

// blob shadows and footprints lie on the disc; the tint fades the prints out
const GroundKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, GroundPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint],
});

type Walker = SpriteOf<typeof WalkerKind>;
type GroundSprite = SpriteOf<typeof GroundKind>;

// the atlas is drawn at 64 pixels a meter
const PX_PER_M = 64;
const DISC_RADIUS = 10;
const FENCE_RADIUS = 9.3;
const VILLAGE_RADIUS = 7.6;
const WALK_RADIUS = 5.8;
// the quad stands on its feet: from y = 0 to y = 1, the pivot at the middle of its bottom edge
const ON_FEET = [0.5, 0.5, 0, 0.5] as const;

const PRINT_LIFETIME = 7;
const PRINTS_PER_WALKER = 40;
const FOOTPRINT_SIZE = [0.13, 0.26] as const;
const PAW_SIZE = [0.13, 0.13] as const;

/** A small seeded random number generator, so that the village stands the same at every load. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The yaw that turns the local x of a quad — the right of its image — along `(dx, dz)`. */
const yawAlong = (dx: number, dz: number) => Math.atan2(-dz, dx);

/**
 * A lean of a prop off the vertical, in its own frame: `pitch` about its local x — negative tips the
 * top backwards, away from its print — and `roll` about its local z, in the plane of the print.
 */
interface Lean {
  pitch: number;
  roll: number;
}

// the yaw first, then the pitch, then the roll: Euler order 'YXZ', so the lean stays in the frame of the prop
const leanEuler = new Euler(0, 0, 0, 'YXZ');
const leanQuaternion = new Quaternion();

/** The rotation on the ground that turns the top of an image — towards −Z at 0 — along `(dx, dz)`. */
const rotationAlong = (dx: number, dz: number) => Math.atan2(-dx, -dz);

interface WalkerState {
  sprite: Walker;
  blob: GroundSprite;
  animal: boolean;
  width: number;
  height: number;
  // a circle of its own: centre, radius, sense and phase
  cx: number;
  cz: number;
  radius: number;
  turn: number;
  phase: number;
  speed: number;
  stride: number;
  steps: number;
  stepPhase: number;
}

interface Print {
  sprite: GroundSprite;
  born: number;
}

/**
 * A toy theatre on a turntable: a fence around the rim with a panel fallen over, a village of houses
 * and trees, leaning signposts at the crossroads, figures that walk in circles and leave footprints, each with a blob shadow. Three
 * sprite meshes — props, walkers, ground — draw all of it, whatever way each cut-out faces.
 */
export class CardboardParade extends Group {
  readonly props: FeatureSpritesOf<typeof PropKind>;
  readonly walkers: FeatureSpritesOf<typeof WalkerKind>;
  readonly ground: FeatureSpritesOf<typeof GroundKind>;

  /** Whether the turntable turns. */
  spinning = true;

  readonly #disc: Mesh;
  readonly #rim: Mesh;
  readonly #walkers: WalkerState[] = [];
  readonly #prints: Print[] = [];
  readonly #frames: Record<string, TextureAtlasFrame>;
  #nextPrint = 0;
  #time = 0;
  #spin = 0;

  constructor({atlas, texture}: CardboardAtlas, turntable: Texture) {
    super();
    this.name = 'cardboard-parade';

    const frame = (name: string) => {
      const found = atlas.frame(name);
      if (found == null) throw new Error(`cardboard-parade: the atlas has no frame "${name}"`);
      return found;
    };
    this.#frames = Object.fromEntries(
      [
        'tree_round',
        'tree_fir',
        'tree_poplar',
        'bush',
        'house_cream',
        'house_tall',
        'house_wide',
        'fence',
        'sign_yellow',
        'sign_teal',
        'sign_pink',
        'sign_orange',
        'figure_red',
        'figure_blue',
        'figure_green',
        'figure_purple',
        'dog',
        'duck',
        'blob',
        'foot_left',
        'foot_right',
        'paw',
      ].map((name) => [name, frame(name)]),
    );

    this.#disc = new Mesh(new CircleGeometry(DISC_RADIUS, 128), new MeshBasicNodeMaterial({map: turntable}));
    this.#disc.rotation.x = -Math.PI / 2;
    this.#rim = new Mesh(
      new CylinderGeometry(DISC_RADIUS, DISC_RADIUS * 0.97, 0.6, 128, 1, true),
      new MeshBasicNodeMaterial({color: new Color('#5c3e27'), side: DoubleSide}),
    );
    this.#rim.position.y = -0.3;

    this.props = new FeatureSprites(PropKind, {
      capacity: 400,
      baseArgs: ON_FEET,
      textures: {colorMap: texture},
      alphaTest: 0.5,
      side: DoubleSide,
    });
    this.walkers = new FeatureSprites(WalkerKind, {
      capacity: 32,
      baseArgs: ON_FEET,
      attributeUsage: {dynamic: ['yaw']},
      textures: {colorMap: texture},
      alphaTest: 0.5,
      side: DoubleSide,
    });
    this.ground = new FeatureSprites(GroundKind, {
      capacity: 32 * (PRINTS_PER_WALKER + 1),
      // a print takes its frame, its size and its fade when it is dropped, long after the first update()
      attributeUsage: {dynamic: ['color', 'texCoords', 'size']},
      textures: {colorMap: texture},
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    for (const sprites of [this.props, this.walkers, this.ground]) sprites.frustumCulled = false;
    this.ground.renderOrder = 1;

    this.add(this.#disc, this.#rim, this.ground, this.props, this.walkers);

    const random = seededRandom(32);
    this.#buildVillage(random);
    this.#buildWalkers(random);
    this.props.update();
  }

  /**
   * Whether the cut-outs face and lean where their quaternion or their yaw says, or all of them
   * stand upright facing +Z — a placement swap.
   */
  set facing(on: boolean) {
    this.props.placement = on ? QuaternionPlacement : FlatPlacement;
    this.walkers.placement = on ? YawPlacement : FlatPlacement;
  }

  get facing(): boolean {
    return this.props.placement === QuaternionPlacement;
  }

  // trees and bushes are printed on both sides, as the wings of a toy theatre are; houses, the
  // fence and the signs show the cardboard from behind
  #prop(name: string, x: number, z: number, yaw: number, scale = 1, lean?: Lean) {
    const sprite = this.props.createSprite();
    if (sprite == null) return;
    const {coords} = this.#frames[name]!;
    sprite.setFrame(this.#frames[name]!);
    sprite.setSize((coords.width / PX_PER_M) * scale, (coords.height / PX_PER_M) * scale);
    sprite.setPosition(x, 0, z);
    if (lean == null) {
      sprite.setYaw(yaw);
    } else {
      sprite.setQuaternion(leanQuaternion.setFromEuler(leanEuler.set(lean.pitch, yaw, lean.roll)));
    }
    sprite.twoSided = name.startsWith('tree') || name === 'bush' ? 1 : 0;
  }

  #buildVillage(random: () => number) {
    // the fence: every segment along the tangent of the circle, its print facing outward. One panel
    // has fallen inwards and lies on its back, the print to the sky; its neighbours lean after it
    const segments = Math.round((2 * Math.PI * FENCE_RADIUS) / 1.62);
    const fallen = Math.round(segments * 0.08);
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      const lean = i === fallen ? {pitch: -1.48, roll: 0.04} : Math.abs(i - fallen) === 1 ? {pitch: -0.16, roll: 0} : undefined;
      this.#prop('fence', Math.sin(angle) * FENCE_RADIUS, Math.cos(angle) * FENCE_RADIUS, angle, 1, lean);
    }

    // the village: houses facing outward, trees between them
    const houses = ['house_cream', 'house_tall', 'house_wide'];
    const trees = ['tree_round', 'tree_fir', 'tree_poplar'];
    const lots = 18;
    for (let i = 0; i < lots; i++) {
      const angle = (i / lots) * 2 * Math.PI + 0.2;
      const radius = VILLAGE_RADIUS + (random() - 0.5) * 0.5;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      if (i % 3 === 0) {
        this.#prop(houses[(i / 3) % houses.length]!, x, z, angle);
      } else {
        this.#prop(trees[Math.floor(random() * trees.length)]!, x, z, angle + (random() - 0.5) * 0.6, 0.8 + random() * 0.4);
      }
    }

    // a wood beyond the village, inside the fence
    for (let i = 0; i < 70; i++) {
      const angle = random() * 2 * Math.PI;
      const radius = 8.3 + random() * 0.6;
      const name = random() < 0.25 ? 'bush' : trees[Math.floor(random() * trees.length)]!;
      this.#prop(name, Math.sin(angle) * radius, Math.cos(angle) * radius, random() * 2 * Math.PI, 0.6 + random() * 0.4);
    }

    // trees and bushes on the green, any way they happen to stand
    for (let i = 0; i < 28; i++) {
      const angle = random() * 2 * Math.PI;
      const radius = 2.2 + random() * 4.2;
      const name = random() < 0.4 ? 'bush' : trees[Math.floor(random() * trees.length)]!;
      this.#prop(name, Math.sin(angle) * radius, Math.cos(angle) * radius, random() * 2 * Math.PI, 0.6 + random() * 0.5);
    }

    // the crossroads: four signposts, each pointing its own way, none of them quite upright — the
    // wind has had them, one sideways in the plane of its board, another backwards off it
    const signs = ['sign_yellow', 'sign_teal', 'sign_pink', 'sign_orange'];
    signs.forEach((name, i) => {
      const angle = (i / signs.length) * 2 * Math.PI + 0.4;
      const lean = {pitch: (random() - 0.5) * 0.5, roll: (random() - 0.5) * 0.4};
      this.#prop(name, Math.sin(angle) * 0.5, Math.cos(angle) * 0.5, angle - Math.PI / 2 + (random() - 0.5) * 0.4, 1, lean);
    });
  }

  #buildWalkers(random: () => number) {
    const figures = ['figure_red', 'figure_blue', 'figure_green', 'figure_purple', 'dog', 'duck'];
    for (let i = 0; i < 12; i++) {
      const name = figures[i % figures.length]!;
      const animal = name === 'dog' || name === 'duck';
      const {coords} = this.#frames[name]!;
      const sprite = this.walkers.createSprite();
      const blob = this.ground.createSprite();
      if (sprite == null || blob == null) break;
      const width = coords.width / PX_PER_M;
      const height = coords.height / PX_PER_M;
      sprite.setFrame(this.#frames[name]!);
      sprite.setSize(width, height);
      blob.setFrame(this.#frames['blob']!);
      blob.setSize(width * 0.9, width * 0.55);
      blob.setColorValues(1, 1, 1, 0.8);

      const radius = 1.2 + random() * 1.8;
      const centre = random() * (WALK_RADIUS - radius);
      const centreAngle = random() * 2 * Math.PI;
      const speed = animal ? 0.9 + random() * 0.4 : 0.6 + random() * 0.3;
      this.#walkers.push({
        sprite,
        blob,
        animal,
        width,
        height,
        cx: Math.sin(centreAngle) * centre,
        cz: Math.cos(centreAngle) * centre,
        radius,
        turn: random() < 0.5 ? 1 : -1,
        phase: random() * 2 * Math.PI,
        speed,
        stride: animal ? 0.22 : 0.34,
        steps: 0,
        stepPhase: random() * Math.PI,
      });
    }

    for (let i = 0; i < this.#walkers.length * PRINTS_PER_WALKER; i++) {
      const sprite = this.ground.createSprite();
      if (sprite == null) break;
      sprite.setColorValues(1, 1, 1, 0);
      this.#prints.push({sprite, born: -Infinity});
    }
  }

  #dropPrint(walker: WalkerState, x: number, z: number, dx: number, dz: number) {
    const print = this.#prints[this.#nextPrint];
    if (print == null) return;
    this.#nextPrint = (this.#nextPrint + 1) % this.#prints.length;
    const left = walker.steps % 2 === 0;
    // beside the line of the walk, to the left or the right of it
    const side = (left ? -1 : 1) * (walker.animal ? 0.06 : 0.1);
    const name = walker.animal ? 'paw' : left ? 'foot_left' : 'foot_right';
    const [w, h] = walker.animal ? PAW_SIZE : FOOTPRINT_SIZE;
    print.sprite.setFrame(this.#frames[name]!);
    print.sprite.setSize(w, h);
    print.sprite.setPosition(x - dz * side, 0.01, z + dx * side);
    print.sprite.rotation = rotationAlong(dx, dz);
    print.born = this.#time;
  }

  update(deltaTime: number) {
    this.#time += deltaTime;
    if (this.spinning) this.#spin += deltaTime * 0.1;
    this.rotation.y = this.#spin;
    // the turntable wobbles a little on its axis, carrying every sprite with it
    this.rotation.x = 0.05 * Math.sin(this.#time * 0.37);
    this.rotation.z = 0.04 * Math.sin(this.#time * 0.29 + 1);

    for (const walker of this.#walkers) {
      const angular = (walker.speed / walker.radius) * walker.turn;
      const angle = walker.phase + this.#time * angular;
      const x = walker.cx + Math.sin(angle) * walker.radius;
      const z = walker.cz + Math.cos(angle) * walker.radius;
      // the direction of the walk: the derivative of the circle, normalised
      const dx = Math.cos(angle) * walker.turn;
      const dz = -Math.sin(angle) * walker.turn;

      walker.stepPhase += (deltaTime * walker.speed * Math.PI) / walker.stride;
      const steps = Math.floor(walker.stepPhase / Math.PI);
      if (steps !== walker.steps) {
        walker.steps = steps;
        this.#dropPrint(walker, x, z, dx, dz);
      }

      const lift = Math.abs(Math.sin(walker.stepPhase)) * (walker.animal ? 0.05 : 0.07);
      walker.sprite.setPosition(x, lift, z);
      walker.sprite.yaw = yawAlong(dx, dz);
      walker.sprite.rotation = Math.sin(walker.stepPhase) * (walker.animal ? 0.06 : 0.13);

      walker.blob.setPosition(x, 0.005, z);
      walker.blob.rotation = rotationAlong(dx, dz);
    }

    for (const print of this.#prints) {
      const age = this.#time - print.born;
      if (age > PRINT_LIFETIME + 1) continue;
      print.sprite.setColorValues(1, 1, 1, Math.max(0, 0.8 * (1 - age / PRINT_LIFETIME)));
    }

    this.walkers.update();
    this.ground.update();
  }

  override dispose() {
    this.props.dispose();
    this.walkers.dispose();
    this.ground.dispose();
    this.#disc.geometry.dispose();
    (this.#disc.material as MeshBasicNodeMaterial).dispose();
    this.#rim.geometry.dispose();
    (this.#rim.material as MeshBasicNodeMaterial).dispose();
    this.removeFromParent();
  }
}
