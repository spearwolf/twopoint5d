import {
  Anchor,
  AtlasFrame,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  RepeatingTextureColor,
  Rotation,
  SegmentEnd,
  type SpriteOf,
  segmentPlacement,
  type TextureAtlas,
  type TextureAtlasFrame,
  TextureColor,
  TexturedSpriteKind,
  Tint,
  type FeatureSpritesOf,
  type SpriteKindApiOf,
} from '@spearwolf/twopoint5d';
import {
  AdditiveBlending,
  type BufferGeometry,
  Color,
  Group,
  type Material,
  Mesh,
  MeshBasicNodeMaterial,
  type Scene,
  Shape,
  ShapeGeometry,
  type Texture,
} from 'three/webgpu';
import {crossing, duelAngles} from './SaberDuel';
import {VerletRopes} from './VerletRopes';

/** The textures out of the catalog: the atlas `rope-bridge/bridge.json` and the three cave layers. */
export interface RopeBridgeAssets {
  atlas: TextureAtlas;
  texture: Texture;
  caveBack: Texture;
  caveMid: Texture;
  caveFront: Texture;
}

// ---------------------------------------------------------------------------------------------
// The sprite kinds
// ---------------------------------------------------------------------------------------------

// a segment from its instance position to its segment end, laid into the XY plane of the mesh
const InPlane = segmentPlacement({facing: 'plane'});

// every rope, chain and vine of the scene: the 64 × 16 frames repeat along each link, their texels
// kept square, however long the link is
export const RopeKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, SegmentEnd, InPlane, QuadSize, AtlasFrame, RepeatingTextureColor, Tint],
});

// the same, with the frame stretched from end to end: the kind the toggle of the page swaps in. A
// kind holds one color source, so this is another kind, and the swap builds another mesh
export const StretchedRopeKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, SegmentEnd, InPlane, QuadSize, AtlasFrame, TextureColor, Tint],
});

// a deck plank is a segment too, between two points of the deck rope: stretched over it, and with
// the anchor at the foot of the image, so that the plank lies on the rope instead of across it
const PlankKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, SegmentEnd, InPlane, QuadSize, Anchor, AtlasFrame, TextureColor, Tint],
});

// posts, lanterns, hilts: flat sprites that turn about their anchor
const PropKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Anchor, Rotation, AtlasFrame, TextureColor, Tint],
});

// one image of the cave per mesh, the whole texture: no frame feature needed
const CaveKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, TextureColor],
});

type RopeApi = SpriteKindApiOf<typeof RopeKind>;
type Rope = SpriteOf<typeof RopeKind>;
type Plank = SpriteOf<typeof PlankKind>;
type Prop = SpriteOf<typeof PropKind>;
type Glow = SpriteOf<typeof TexturedSpriteKind>;

// every mesh is drawn in the order of its renderOrder, back to front, with no depth test: the
// painter's algorithm of a 2D scene. Transparent, all of them, so three keeps them in one list
const LAYERED = {transparent: true, depthTest: false, depthWrite: false} as const;

const Layer = {
  CaveBack: 0,
  CaveMid: 1,
  Cliffs: 2,
  Props: 3,
  Ropes: 4,
  Planks: 5,
  Blades: 6,
  Glow: 7,
  CaveFront: 8,
} as const;

// ---------------------------------------------------------------------------------------------
// The scene, in units of one pixel of the art; y points up, the view is centred on the origin
// ---------------------------------------------------------------------------------------------

/** The cave is 512 × 288; the view is at least that high, see `resizeView()`. */
export const CAVE_WIDTH = 512;
export const CAVE_HEIGHT = 288;

const CLIFF_TOP = -52;
const POST_X = 180;
const DECK_Y = -46;
const HAND_Y = -9;
const DECK_SAG = 30;
const HAND_SAG = 18;
const DECK_LINKS = 10;
const PLANK_LENGTH = 32;

const CEILING = 210;
const LANTERN_CHAINS = [
  {x: -122, links: 5},
  {x: 8, links: 4},
  {x: 132, links: 5},
] as const;
const CHAIN_LINK = 30;

// hanging greenery: from the deck (point index along it) and from the ceiling
const DECK_VINES = [
  {node: 2, links: 3},
  {node: 5, links: 4},
  {node: 8, links: 3},
] as const;
const CEILING_VINES = [
  {x: -190, links: 9},
  {x: 70, links: 8},
  {x: 205, links: 10},
] as const;

// the duelists stand on these points of the deck and hold their hilts this far above it
const DUELIST_NODES = [3, 7] as const;
const GRIP_HEIGHT = 30;
const HILT_LENGTH = 32;
const BLADE_LENGTH = 84;
const BLADE_THICKNESS = 10;

const MAX_WEIGHTS = 6;
const WEIGHT_RADIUS = 20;
const WEIGHT_LIFE = 8;
const SPARKS = 48;
const SPARK_LIFE = 0.45;
const MOTES = 26;

// the shades of the parts in the dark of the cave: multiplied into the art by `Tint`
const ROPE_SHADE = [0.62, 0.66, 0.8] as const;
const CHAIN_SHADE = [0.55, 0.62, 0.78] as const;
const VINE_SHADE = [0.5, 0.78, 0.7] as const;
const WOOD_SHADE = [0.58, 0.6, 0.74] as const;

// Glow is a color above white in a stage that blooms with a threshold of 1 — and the threshold
// compares luminance, 0.2126 r + 0.7152 g + 0.0722 b, not the brightest channel. Cyan has the green
// to pass easily (2.3); a saturated red needs a factor of about 5 in r to pass at all (1.5 here).
const CYAN_BLADE = [0.9, 2.6, 3.4] as const;
const RED_BLADE = [4.6, 0.7, 0.6] as const;
const LANTERN_GLOW = [1.3, 2.4, 2.7] as const;
const MOTE_GLOW = [1.1, 2.6, 2.1] as const;
const SPARK_GLOW = [4, 3.4, 2.4] as const;

interface Link {
  a: number;
  b: number;
  frame: TextureAtlasFrame;
  thickness: number;
  // the extra length of the caps — the `width` of QuadSize — half of it beyond each end
  caps: number;
  shade: readonly [number, number, number];
  sprite?: Rope;
}

interface HangingLantern {
  end: number;
  before: number;
  sprite: Prop;
  halo: Glow;
  core: Glow;
  phase: number;
}

interface Weight {
  point: number;
  sprite: Prop;
  halo: Glow;
  born: number;
  active: boolean;
}

interface Mote {
  sprite: Glow;
  home: number; // a lantern, or −1 for the open air
  x: number;
  y: number;
  rx: number;
  ry: number;
  speed: number;
  phase: number;
}

interface Spark {
  sprite: Glow;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/**
 * A rope bridge in a dark cave, its ropes simulated by `VerletRopes` and drawn as segment sprites:
 * every rope link is one segment from point to point, written every frame, all of them in one mesh.
 * Planks lie on the deck rope, lanterns hang on chains and glow, and two phantom duelists cross their
 * light sabers on the deck. The pointer drags any point; a click into the air drops a lantern.
 */
export class RopeBridge {
  readonly world = new Group();

  readonly #sim = new VerletRopes(256, 256);
  readonly #assets: RopeBridgeAssets;

  readonly #links: Link[] = [];
  #ropes?: FeatureSprites<RopeApi>;
  #repeating = true;

  readonly #deck: number[] = [];
  readonly #deckSticks: [number, number][] = [];
  readonly #planks: Plank[] = [];
  readonly #lanterns: HangingLantern[] = [];
  readonly #weights: Weight[] = [];
  readonly #motes: Mote[] = [];
  readonly #sparks: Spark[] = [];
  #nextWeight = 0;
  #nextSpark = 0;

  readonly #plankSprites: FeatureSpritesOf<typeof PlankKind>;
  readonly #props: FeatureSpritesOf<typeof PropKind>;
  readonly #blades: FeatureSprites<RopeApi>;
  readonly #glow: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #cave: FeatureSpritesOf<typeof CaveKind>[] = [];
  readonly #caveTiles: SpriteOf<typeof CaveKind>[][] = [];
  readonly #caveFactors = [0.1, 0.4, 1.3];
  readonly #cliffParts: {geometry: BufferGeometry; material: Material}[] = [];

  readonly #hilts: Prop[] = [];
  readonly #bladeSprites: Rope[] = [];
  readonly #angles: [number, number] = [55, 55];
  readonly #clash = {x: 0, y: 0};
  #wasCrossing = false;
  #lockSparkTimer = 0;
  #clashCount = 0;

  #time = 0;
  #drift = 0;
  #held = -1;

  /** Called on every clash of the blades: the page takes its preview image on the first. */
  onClash?: (count: number) => void;

  constructor(scene: Scene, assets: RopeBridgeAssets) {
    this.#assets = assets;
    const {texture: colorMap} = assets;

    // the cave: three layers of three tiles each, the images seamless from left to right
    for (const [name, layer, image] of [
      ['back', Layer.CaveBack, assets.caveBack],
      ['mid', Layer.CaveMid, assets.caveMid],
      ['front', Layer.CaveFront, assets.caveFront],
    ] as const) {
      const cave = new FeatureSprites(CaveKind, {capacity: 3, textures: {colorMap: image}, ...LAYERED});
      cave.name = `cave ${name}`;
      cave.renderOrder = layer;
      this.#caveTiles.push([cave.createSprite()!, cave.createSprite()!, cave.createSprite()!]);
      scene.add(cave);
      this.#cave.push(cave);
    }

    this.world.name = 'rope bridge';
    scene.add(this.world);
    this.#buildCliffs();

    this.#props = new FeatureSprites(PropKind, {
      capacity: 16,
      textures: {colorMap},
      // the dropped lanterns fade out
      attributeUsage: {dynamic: ['color']},
      ...LAYERED,
    });
    this.#props.name = 'props';
    this.#props.renderOrder = Layer.Props;

    this.#plankSprites = new FeatureSprites(PlankKind, {capacity: DECK_LINKS, textures: {colorMap}, ...LAYERED});
    this.#plankSprites.name = 'planks';
    this.#plankSprites.renderOrder = Layer.Planks;

    // the blades glow: drawn additively, tinted far above white, and the stage blooms
    this.#blades = new FeatureSprites<RopeApi>(RopeKind, {
      capacity: 2,
      textures: {colorMap},
      ...LAYERED,
      blending: AdditiveBlending,
    });
    this.#blades.name = 'blades';
    this.#blades.renderOrder = Layer.Blades;

    this.#glow = new FeatureSprites(TexturedSpriteKind, {
      capacity: 128,
      textures: {colorMap},
      // halos flicker, sparks shrink and fade
      attributeUsage: {dynamic: ['size', 'color']},
      ...LAYERED,
      blending: AdditiveBlending,
    });
    this.#glow.name = 'glow';
    this.#glow.renderOrder = Layer.Glow;

    this.world.add(this.#props, this.#plankSprites, this.#blades, this.#glow);

    this.#buildPosts();
    this.#buildBridge();
    this.#buildLanterns();
    this.#buildVines();
    this.#buildDuelists();
    this.#buildWeights();
    this.#buildMotes();
    this.#buildRopes();

    // let the ropes settle under their own weight before the first frame shows them
    for (let i = 0; i < 360; i++) this.#sim.step(VerletRopes.STEP);
    this.update(0);
    this.resizeView(CAVE_WIDTH, CAVE_HEIGHT);
  }

  /** Whether the ropes repeat their frame (`RepeatingTextureColor`) or stretch it (`TextureColor`). */
  get repeating(): boolean {
    return this.#repeating;
  }

  set repeating(repeating: boolean) {
    if (repeating === this.#repeating) return;
    this.#repeating = repeating;
    this.#buildRopes();
  }

  /** The number of rope, chain and vine links: all of them one mesh, one draw call. */
  get linkCount(): number {
    return this.#links.length;
  }

  /** Fits the cave to a view of `width` × `height` units: it covers the height and tiles across. */
  resizeView(width: number, height: number): void {
    const scale = Math.max(1, height / CAVE_HEIGHT, width / (CAVE_WIDTH * 3));
    this.#cave.forEach((cave, layer) => {
      this.#caveTiles[layer]!.forEach((tile, i) => {
        tile.setSize(CAVE_WIDTH * scale, CAVE_HEIGHT * scale);
        tile.setPosition((i - 1) * CAVE_WIDTH * scale, 0);
        // the size is a static attribute: a change after the first upload is marked
        cave.spritePool!.touchVO(tile, 'quadSize');
      });
      cave.update();
    });
  }

  // --- the pointer, in view units from the middle of the view ---

  /** Takes hold of the point under the pointer; with none there, drops a lantern. */
  pointerDown(viewX: number, viewY: number): 'grab' | 'drop' {
    const x = viewX - this.world.position.x;
    const y = viewY - this.world.position.y;
    const point = this.#sim.pick(x, y, 18);
    if (point >= 0 && !this.#weights.some((weight) => weight.point === point)) {
      this.#held = point;
      this.#sim.grab(point);
      return 'grab';
    }
    this.dropLantern(x, y);
    return 'drop';
  }

  pointerMove(viewX: number, viewY: number): void {
    if (this.#held < 0) return;
    this.#sim.hold(viewX - this.world.position.x, viewY - this.world.position.y);
  }

  pointerUp(): void {
    this.#held = -1;
    this.#sim.release();
  }

  /** Drops a lantern at `(x, y)` in the units of the bridge; it lands on the deck if it hits it. */
  dropLantern(x: number, y: number): void {
    const weight = this.#weights[this.#nextWeight]!;
    this.#nextWeight = (this.#nextWeight + 1) % this.#weights.length;
    this.#sim.removeWeight(weight.point);
    this.#sim.teleport(weight.point, x, y);
    this.#sim.setInvMass(weight.point, 0.35);
    this.#sim.addWeight(weight.point, WEIGHT_RADIUS);
    weight.born = this.#time;
    weight.active = true;
  }

  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    this.#time += dt;
    this.#sim.update(dt);

    // the camera drifts slowly along the bridge: the layers of the cave move by their own factors
    this.#drift = Math.sin(this.#time * ((Math.PI * 2) / 48)) * 22;
    this.world.position.x = -this.#drift;
    this.#cave.forEach((cave, i) => {
      cave.position.x = -this.#drift * this.#caveFactors[i]!;
    });

    this.#updateDuel(dt);
    this.#writeRopes();
    this.#writePlanks();
    this.#writeLanterns();
    this.#writeWeights();
    this.#writeMotes();
    this.#writeSparks(dt);

    this.#ropes!.update();
    this.#plankSprites.update();
    this.#props.update();
    this.#blades.update();
    this.#glow.update();
  }

  dispose(): void {
    this.#ropes?.dispose();
    this.#plankSprites.dispose();
    this.#props.dispose();
    this.#blades.dispose();
    this.#glow.dispose();
    for (const cave of this.#cave) cave.dispose();
    for (const {geometry, material} of this.#cliffParts) {
      geometry.dispose();
      material.dispose();
    }
    this.world.removeFromParent();
  }

  // ---------------------------------------------------------------------------------------------

  #frame(name: string): TextureAtlasFrame {
    const frame = this.#assets.atlas.frame(name);
    if (frame == null) throw new Error(`rope-bridge: the atlas has no frame "${name}"`);
    return frame;
  }

  #link(a: number, b: number, frame: string, thickness: number, caps: number, shade: Link['shade']): void {
    this.#links.push({a, b, frame: this.#frame(frame), thickness, caps, shade});
  }

  // a chain of `links` sticks hanging from point `top`, each `length` long; answers the points
  #hang(top: number, links: number, length: number, invMass = 1): number[] {
    const sim = this.#sim;
    const points = [top];
    for (let i = 1; i <= links; i++) {
      // a little sideways, so that the chain swings in from its first frame
      const point = sim.addPoint(sim.x[top]! + i * 1.5, sim.y[top]! - i * length, invMass);
      sim.addStick(points.at(-1)!, point, length);
      points.push(point);
    }
    return points;
  }

  // the ledges the bridge spans: two silhouettes of rock with a rim of the light of the cave
  #buildCliffs(): void {
    const left = [
      [-700, CLIFF_TOP],
      [-214, CLIFF_TOP + 1],
      [-196, CLIFF_TOP - 1],
      [-170, CLIFF_TOP],
      [-163, CLIFF_TOP - 7],
      [-158, CLIFF_TOP - 22],
      [-161, CLIFF_TOP - 38],
      [-148, CLIFF_TOP - 61],
      [-152, CLIFF_TOP - 90],
      [-138, CLIFF_TOP - 140],
      [-700, CLIFF_TOP - 140],
    ];
    const right = [
      [700, CLIFF_TOP + 2],
      [222, CLIFF_TOP + 1],
      [199, CLIFF_TOP + 2],
      [168, CLIFF_TOP],
      [160, CLIFF_TOP - 9],
      [164, CLIFF_TOP - 27],
      [151, CLIFF_TOP - 46],
      [156, CLIFF_TOP - 72],
      [143, CLIFF_TOP - 104],
      [147, CLIFF_TOP - 140],
      [700, CLIFF_TOP - 140],
    ];
    for (const outline of [left, right]) {
      // the rim first, a little higher, then the rock over it: the rim shows along the top edges
      for (const [color, lift] of [
        ['#3a5482', 1.5],
        ['#090c15', 0],
      ] as const) {
        const shape = new Shape();
        outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x!, y! + lift) : shape.lineTo(x!, y! + lift)));
        const geometry = new ShapeGeometry(shape);
        const material = new MeshBasicNodeMaterial({color: new Color(color), ...LAYERED});
        const cliff = new Mesh(geometry, material);
        cliff.renderOrder = Layer.Cliffs;
        this.world.add(cliff);
        this.#cliffParts.push({geometry, material});
      }
    }
  }

  #buildPosts(): void {
    const post = this.#frame('post');
    for (const x of [-POST_X, POST_X]) {
      const sprite = this.#props.createSprite()!;
      sprite.setFrame(post);
      sprite.setSize(16, 48);
      // stands on its foot
      sprite.setAnchor(0.5, 1);
      sprite.setPosition(x, CLIFF_TOP - 3);
      sprite.setColorValues(WOOD_SHADE[0], WOOD_SHADE[1], WOOD_SHADE[2], 1);
    }
  }

  #buildBridge(): void {
    const sim = this.#sim;
    const hand: number[] = [];
    for (let i = 0; i <= DECK_LINKS; i++) {
      const t = i / DECK_LINKS;
      const x = -POST_X + t * POST_X * 2;
      const sag = 1 - (2 * t - 1) ** 2;
      const pinned = i === 0 || i === DECK_LINKS;
      // the duelists weigh the deck down where they stand
      const deckMass = DUELIST_NODES.includes(i as 3 | 7) ? 0.45 : 1;
      this.#deck.push(sim.addPoint(x, DECK_Y - DECK_SAG * sag, pinned ? 0 : deckMass));
      hand.push(sim.addPoint(x, HAND_Y - HAND_SAG * sag, pinned ? 0 : 1.6));
    }

    const firstDeckStick = 0;
    for (let i = 0; i < DECK_LINKS; i++) {
      sim.addStick(this.#deck[i]!, this.#deck[i + 1]!);
      this.#deckSticks.push([this.#deck[i]!, this.#deck[i + 1]!]);
    }
    sim.setDeck(firstDeckStick, DECK_LINKS);
    for (let i = 0; i < DECK_LINKS; i++) sim.addStick(hand[i]!, hand[i + 1]!);
    // the hangers from the hand rope down to the deck carry it as well
    for (let i = 1; i < DECK_LINKS; i++) sim.addStick(hand[i]!, this.#deck[i]!);

    // the order of the links is the order they are drawn in: the hangers behind the ropes
    for (let i = 1; i < DECK_LINKS; i++) this.#link(hand[i]!, this.#deck[i]!, 'rope', 3, 3, ROPE_SHADE);
    for (let i = 0; i < DECK_LINKS; i++) this.#link(this.#deck[i]!, this.#deck[i + 1]!, 'rope', 6, 6, ROPE_SHADE);
    for (let i = 0; i < DECK_LINKS; i++) this.#link(hand[i]!, hand[i + 1]!, 'rope', 5, 5, ROPE_SHADE);

    // guy ropes from the tops of the posts down to pegs on the ledges: one long segment each, where
    // the difference of a repeated and a stretched frame shows best
    for (const side of [-1, 1]) {
      const top = sim.addPoint(side * POST_X, HAND_Y, 0);
      for (const reach of [48, 92]) {
        const peg = sim.addPoint(side * (POST_X + reach), CLIFF_TOP + 1, 0);
        this.#link(top, peg, 'rope', 4, 4, ROPE_SHADE);
      }
    }

    const planks = ['plank-0', 'plank-1', 'plank-2', 'plank-1', 'plank-0', 'plank-2'].map((name) => this.#frame(name));
    for (let i = 0; i < DECK_LINKS; i++) {
      const plank = this.#plankSprites.createSprite()!;
      plank.setFrame(planks[i % planks.length]!);
      // 8 thick, no caps: the plank ends where its segment ends
      plank.setSize(0, 8);
      // the foot of the image on the rope: the plank lies on top of it
      plank.setAnchor(0.5, 1);
      plank.setColorValues(WOOD_SHADE[0], WOOD_SHADE[1], WOOD_SHADE[2], 1);
      this.#planks.push(plank);
    }
  }

  #buildLanterns(): void {
    const lantern = this.#frame('lantern');
    const mote = this.#frame('mote');
    LANTERN_CHAINS.forEach(({x, links}, i) => {
      const top = this.#sim.addPoint(x, CEILING, 0);
      const points = this.#hang(top, links, CHAIN_LINK);
      // the lantern is heavier than a link of its chain
      this.#sim.setInvMass(points.at(-1)!, 0.25);
      for (let k = 0; k < links; k++) this.#link(points[k]!, points[k + 1]!, 'chain', 8, 0, CHAIN_SHADE);

      const sprite = this.#props.createSprite()!;
      sprite.setFrame(lantern);
      sprite.setSize(16, 24);
      // hangs from the ring at its top
      sprite.setAnchor(0.5, 0);
      const halo = this.#glow.createSprite()!;
      halo.setFrame(mote);
      const core = this.#glow.createSprite()!;
      core.setFrame(mote);
      this.#lanterns.push({end: points.at(-1)!, before: points.at(-2)!, sprite, halo, core, phase: i * 2.1});
    });
  }

  #buildVines(): void {
    for (const {node, links} of DECK_VINES) {
      const points = this.#hang(this.#deck[node]!, links, 15, 1.4);
      for (let k = 0; k < links; k++) this.#link(points[k]!, points[k + 1]!, 'vine', 8, 4, VINE_SHADE);
    }
    for (const {x, links} of CEILING_VINES) {
      const top = this.#sim.addPoint(x, CEILING, 0);
      const points = this.#hang(top, links, 18, 1.4);
      for (let k = 0; k < links; k++) this.#link(points[k]!, points[k + 1]!, 'vine', 8, 4, VINE_SHADE);
    }
  }

  #buildDuelists(): void {
    const hilt = this.#frame('saber-hilt');
    const blade = this.#frame('saber-blade');
    for (const tint of [CYAN_BLADE, RED_BLADE]) {
      const sprite = this.#props.createSprite()!;
      sprite.setFrame(hilt);
      sprite.setSize(HILT_LENGTH, 12);
      this.#hilts.push(sprite);

      const bladeSprite = this.#blades.createSprite()!;
      bladeSprite.setFrame(blade);
      bladeSprite.setSize(BLADE_THICKNESS / 2, BLADE_THICKNESS);
      bladeSprite.setColorValues(tint[0], tint[1], tint[2], 1);
      this.#bladeSprites.push(bladeSprite);
    }
  }

  #buildWeights(): void {
    const lantern = this.#frame('lantern');
    const mote = this.#frame('mote');
    for (let i = 0; i < MAX_WEIGHTS; i++) {
      const point = this.#sim.addPoint(0, -2000, 0);
      const sprite = this.#props.createSprite()!;
      sprite.setFrame(lantern);
      sprite.setSize(16, 24);
      sprite.setColorValues(1, 1, 1, 0);
      const halo = this.#glow.createSprite()!;
      halo.setFrame(mote);
      halo.setColorValues(0, 0, 0, 0);
      this.#weights.push({point, sprite, halo, born: 0, active: false});
    }
  }

  #buildMotes(): void {
    const mote = this.#frame('mote');
    // a seeded scatter, so that the motes fly the same way at every load
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < MOTES; i++) {
      const sprite = this.#glow.createSprite()!;
      sprite.setFrame(mote);
      const home = i < 9 ? i % this.#lanterns.length : -1;
      this.#motes.push({
        sprite,
        home,
        x: home < 0 ? (random() - 0.5) * 520 : 0,
        y: home < 0 ? (random() - 0.4) * 200 : 0,
        rx: home < 0 ? 20 + random() * 30 : 10 + random() * 14,
        ry: home < 0 ? 10 + random() * 20 : 8 + random() * 12,
        speed: 0.25 + random() * 0.5,
        phase: random() * Math.PI * 2,
      });
    }
    for (let i = 0; i < SPARKS; i++) {
      const sprite = this.#glow.createSprite()!;
      sprite.setFrame(mote);
      sprite.setColorValues(0, 0, 0, 0);
      this.#sparks.push({sprite, x: 0, y: 0, vx: 0, vy: 0, life: 0});
    }
  }

  // the rope mesh, of the kind the toggle asks for: each link a sprite, in the order of the links
  #buildRopes(): void {
    this.#ropes?.dispose();
    const kind = this.#repeating ? RopeKind : StretchedRopeKind;
    const ropes = new FeatureSprites<RopeApi>(kind, {
      capacity: this.#links.length,
      textures: {colorMap: this.#assets.texture},
      ...LAYERED,
    });
    ropes.name = this.#repeating ? 'ropes (repeating)' : 'ropes (stretched)';
    ropes.renderOrder = Layer.Ropes;
    for (const link of this.#links) {
      const sprite = ropes.createSprite()!;
      sprite.setFrame(link.frame);
      // QuadSize: the height is the thickness, the width the extra length of the caps
      sprite.setSize(link.caps, link.thickness);
      sprite.setColorValues(link.shade[0], link.shade[1], link.shade[2], 1);
      link.sprite = sprite;
    }
    this.world.add(ropes);
    this.#ropes = ropes;
    this.#writeRopes();
    ropes.update();
  }

  // ---------------------------------------------------------------------------------------------

  // each link from one point of the simulation to the next: both ends are dynamic attributes, and
  // update() uploads them every frame
  #writeRopes(): void {
    const {x, y} = this.#sim;
    for (const {a, b, sprite} of this.#links) {
      sprite!.setPosition(x[a]!, y[a]!);
      sprite!.setSegmentEnd(x[b]!, y[b]!);
    }
  }

  #writePlanks(): void {
    const {x, y} = this.#sim;
    this.#deckSticks.forEach(([a, b], i) => {
      const dx = x[b]! - x[a]!;
      const dy = y[b]! - y[a]!;
      const half = PLANK_LENGTH / 2 / Math.max(Math.hypot(dx, dy), 1e-6);
      const mx = (x[a]! + x[b]!) / 2;
      const my = (y[a]! + y[b]!) / 2;
      const plank = this.#planks[i]!;
      plank.setPosition(mx - dx * half, my - dy * half);
      plank.setSegmentEnd(mx + dx * half, my + dy * half);
    });
  }

  #writeLanterns(): void {
    const {x, y} = this.#sim;
    for (const {end, before, sprite, halo, core, phase} of this.#lanterns) {
      // the lantern hangs along its last link
      const angle = Math.atan2(y[end]! - y[before]!, x[end]! - x[before]!) + Math.PI / 2;
      sprite.setPosition(x[end]!, y[end]!);
      sprite.rotation = angle;
      // the glass sits 14 below the ring
      const gx = x[end]! + Math.sin(angle) * 14;
      const gy = y[end]! - Math.cos(angle) * 14;
      const flicker = 0.9 + 0.06 * Math.sin(this.#time * 9 + phase) + 0.04 * Math.sin(this.#time * 23 + phase * 3);
      halo.setPosition(gx, gy);
      halo.setSize(32 * flicker, 32 * flicker);
      halo.setColorValues(LANTERN_GLOW[0], LANTERN_GLOW[1], LANTERN_GLOW[2], 0.3 * flicker);
      core.setPosition(gx, gy);
      core.setSize(8, 8);
      core.setColorValues(2.4, 3.2, 3.2, 0.7 * flicker);
    }
  }

  #writeWeights(): void {
    const {x, y} = this.#sim;
    for (const weight of this.#weights) {
      if (!weight.active) continue;
      const age = this.#time - weight.born;
      const fade = Math.min(1, Math.max(0, WEIGHT_LIFE - age));
      if (fade <= 0) {
        weight.active = false;
        this.#sim.removeWeight(weight.point);
        this.#sim.setInvMass(weight.point, 0);
        this.#sim.teleport(weight.point, 0, -2000);
        weight.sprite.setColorValues(1, 1, 1, 0);
        weight.halo.setColorValues(0, 0, 0, 0);
        continue;
      }
      const px = x[weight.point]!;
      const py = y[weight.point]!;
      weight.sprite.setPosition(px, py);
      weight.sprite.setColorValues(1, 1, 1, fade);
      weight.halo.setPosition(px, py - 2);
      weight.halo.setSize(32, 32);
      weight.halo.setColorValues(LANTERN_GLOW[0], LANTERN_GLOW[1], LANTERN_GLOW[2], 0.3 * fade);
    }
  }

  #writeMotes(): void {
    const {x, y} = this.#sim;
    const t = this.#time;
    for (const mote of this.#motes) {
      let cx = mote.x;
      let cy = mote.y;
      if (mote.home >= 0) {
        const {end} = this.#lanterns[mote.home]!;
        cx = x[end]!;
        cy = y[end]! - 14;
      }
      const a = t * mote.speed + mote.phase;
      mote.sprite.setPosition(cx + Math.sin(a * 1.3) * mote.rx, cy + Math.cos(a * 0.9) * mote.ry);
      const pulse = 0.55 + 0.45 * Math.sin(a * 3.1);
      const size = mote.home >= 0 ? 6 : 8;
      mote.sprite.setSize(size, size);
      mote.sprite.setColorValues(MOTE_GLOW[0], MOTE_GLOW[1], MOTE_GLOW[2], pulse * (mote.home >= 0 ? 0.9 : 0.6));
    }
  }

  #updateDuel(dt: number): void {
    const {x, y} = this.#sim;
    const [left, right] = duelAngles(this.#time, this.#angles);
    const ends: number[] = [];
    DUELIST_NODES.forEach((node, i) => {
      const side = i === 0 ? 1 : -1;
      const angle = ((i === 0 ? left : right) * Math.PI) / 180;
      const dx = Math.cos(angle) * side;
      const dy = Math.sin(angle);
      const gx = x[this.#deck[node]!]! + side * 4;
      const gy = y[this.#deck[node]!]! + GRIP_HEIGHT;

      const hilt = this.#hilts[i]!;
      hilt.setPosition(gx, gy);
      hilt.rotation = Math.atan2(dy, dx);

      // the blade leaves the emitter at the end of the hilt
      const ex = gx + dx * (HILT_LENGTH / 2);
      const ey = gy + dy * (HILT_LENGTH / 2);
      const tx = ex + dx * BLADE_LENGTH;
      const ty = ey + dy * BLADE_LENGTH;
      const blade = this.#bladeSprites[i]!;
      blade.setPosition(ex, ey);
      blade.setSegmentEnd(tx, ty);
      ends.push(ex, ey, tx, ty);
    });

    const crossed = crossing(ends[0]!, ends[1]!, ends[2]!, ends[3]!, ends[4]!, ends[5]!, ends[6]!, ends[7]!, this.#clash);
    if (crossed && !this.#wasCrossing) {
      // the blow: sparks, and the deck gives under both duelists
      this.#burst(12, 160);
      for (const node of DUELIST_NODES) this.#sim.push(this.#deck[node]!, 0, -70);
      this.onClash?.(++this.#clashCount);
    } else if (crossed) {
      this.#lockSparkTimer -= dt;
      if (this.#lockSparkTimer <= 0) {
        this.#lockSparkTimer = 0.07;
        this.#burst(2, 70);
      }
    }
    this.#wasCrossing = crossed;
  }

  #burst(count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const spark = this.#sparks[this.#nextSpark]!;
      this.#nextSpark = (this.#nextSpark + 1) % this.#sparks.length;
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      spark.x = this.#clash.x;
      spark.y = this.#clash.y;
      spark.vx = Math.cos(angle) * v;
      spark.vy = Math.sin(angle) * v + 40;
      spark.life = SPARK_LIFE * (0.6 + Math.random() * 0.4);
    }
  }

  #writeSparks(dt: number): void {
    for (const spark of this.#sparks) {
      if (spark.life <= 0) continue;
      spark.life -= dt;
      spark.vy -= 380 * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      const left = Math.max(0, spark.life / SPARK_LIFE);
      spark.sprite.setPosition(spark.x, spark.y);
      spark.sprite.setSize(2 + 6 * left, 2 + 6 * left);
      spark.sprite.setColorValues(SPARK_GLOW[0], SPARK_GLOW[1], SPARK_GLOW[2], left);
    }
  }
}
