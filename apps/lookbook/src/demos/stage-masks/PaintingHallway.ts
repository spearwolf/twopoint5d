import {on} from '@spearwolf/eventize';
import {
  FeatureSprites,
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  ParallaxProjection,
  Stage2D,
  type TexturedSprite,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {
  abs,
  cameraPosition,
  clamp,
  dot,
  exp,
  float,
  length,
  max,
  mx_noise_float,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  AdditiveBlending,
  ClampToEdgeWrapping,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type UniformNode,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';

const DIR = 'stage-masks/portal';

/**
 * The projection of every stage of the demo: a parallax camera whose field of view shows 960 × 540
 * units on the plane z = 0 from 480 units away (about 59° high). The camera is moved along z after
 * the projection placed it, so the plane z = 0 is only where the view is measured from.
 */
export const PROJECTION = {fit: 'cover', width: 960, height: 540, distanceToProjectionPlane: 480} as const;

export const makePortalStage = (name: string) => {
  const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {...PROJECTION}));
  stage.name = name;
  return stage;
};

/** The cross-section of the hallway in units (as in `assets-src/stage-masks/portal/kit.mjs`). */
export const HALL = {floor: -200, ceiling: 220, halfWidth: 180};
/** how far the hallway reaches towards the viewer: behind the farthest the camera can go */
const HALL_NEAR = 1800;
/** one repeat of the wall strip and of the floor strip along the hallway */
const WALL_PERIOD = 128;
const FLOOR_PERIOD = 256;
/** The portrait frame: outer half extents and the oval of its canvas, in units. */
export const FRAME = {hw: 118, hh: 148, rx: 72, ry: 100};
/** the middle of the canvas on the far wall, x and y; its z is the portal depth */
export const PORTAL = {x: 0, y: 30};
/** the eye height of the camera */
export const EYE_Y = 20;
/** the camera never comes nearer to the portal than this */
export const MIN_DISTANCE = 170;
export const MAX_CAMERA_Z = 1400;

/** The sconces: 5 down each wall, the first this far in front of the far wall. */
const LAMPS_PER_SIDE = 5;
const LAMP_FIRST = 170;
const LAMP_SPACING = 300;
const LAMP_Y = 64;
const LAMP_INSET = 14;
const LAMP_POWER = 2.6;
const SCONCE_COLOR = vec3(1, 0.62, 0.3);
const PICTURE_LAMP_COLOR = vec3(1, 0.78, 0.5);

/** The doors: which frame, which wall, how far in front of the far wall. */
const DOORS = [
  {frame: 'door-13', side: -1, z: 330},
  {frame: 'door-17', side: 1, z: 630},
  {frame: 'door-13', side: 1, z: 1230},
] as const;
/** the door whose room is lit: a line of light under it, and something that walks in there */
const LIT_DOOR = 1;

interface AtlasJson {
  frames: Record<string, {frame: {x: number; y: number; w: number; h: number}}>;
  meta: {size: {w: number; h: number}};
}

interface LayoutJson {
  door: {w: number; h: number; frames: Record<string, {x: number; y: number; w: number; h: number}>};
  sprites: Record<string, {w: number; h: number}>;
}

export interface PortalAssets {
  wall: Texture;
  floor: Texture;
  doors: Texture;
  frame: Texture;
  sprites: Texture;
  atlas: AtlasJson;
  layout: LayoutJson;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/portal/`). */
export async function loadPortalAssets(renderer: WebGPURenderer): Promise<PortalAssets> {
  const loader = new TextureLoader();
  const anisotropy = renderer.getMaxAnisotropy();
  const load = async (name: string) => {
    const tex = await loader.loadAsync(assetsUrl(`${DIR}/${name}`));
    tex.colorSpace = SRGBColorSpace;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.anisotropy = anisotropy;
    return tex;
  };
  const [wall, floor, doors, frame, sprites, atlas, layout] = await Promise.all([
    load('wall.webp'),
    load('floor.webp'),
    load('doors.webp'),
    load('frame.webp'),
    load('sprites.png'),
    fetch(assetsUrl(`${DIR}/sprites.json`)).then((response) => response.json() as Promise<AtlasJson>),
    fetch(assetsUrl(`${DIR}/layout.json`)).then((response) => response.json() as Promise<LayoutJson>),
  ]);
  // the walls and the floor repeat along the hallway, which runs along their u (walls) and v (floor)
  wall.wrapS = RepeatWrapping;
  wall.wrapT = ClampToEdgeWrapping;
  floor.wrapS = ClampToEdgeWrapping;
  floor.wrapT = RepeatWrapping;
  // an atlas of the library's sprites is read upright, t from the top
  sprites.flipY = false;
  return {wall, floor, doors, frame, sprites, atlas, layout};
}

export function disposePortalAssets(assets: PortalAssets): void {
  assets.wall.dispose();
  assets.floor.dispose();
  assets.doors.dispose();
  assets.frame.dispose();
  assets.sprites.dispose();
}

/** Puts a frame of the atlas on a sprite at `w` × `h` units; `flip` mirrors it left to right. */
export function setFrame(sprite: TexturedSprite, assets: PortalAssets, name: string, w: number, h: number, flip = false): void {
  const entry = assets.atlas.frames[name];
  if (!entry) throw new Error(`PaintingHallway: the atlas has no frame "${name}"`);
  const {x, y, w: fw, h: fh} = entry.frame;
  const {w: aw, h: ah} = assets.atlas.meta.size;
  if (flip) sprite.setTexCoords((x + fw) / aw, y / ah, -fw / aw, fh / ah);
  else sprite.setTexCoords(x / aw, y / ah, fw / aw, fh / ah);
  sprite.setSize(w, h);
}

/** The size of a frame of the atlas in units, as the generator drew it. */
export function frameUnits(assets: PortalAssets, name: string): {w: number; h: number} {
  const units = assets.layout.sprites[name];
  if (!units) throw new Error(`PaintingHallway: the layout has no sprite "${name}"`);
  return units;
}

export const spritePool = (assets: PortalAssets, capacity: number, name: string, options: Record<string, unknown> = {}) => {
  const pool = new FeatureSprites(TexturedSpriteKind, {
    capacity,
    textures: {colorMap: assets.sprites},
    transparent: true,
    depthTest: true,
    depthWrite: false,
    attributeUsage: {dynamic: ['position', 'size', 'color', 'rotation']},
    ...options,
  });
  pool.name = name;
  return pool;
};

/** The signed distance to the oval of the canvas, in units, negative inside; `p` from its middle. */
export function ovalDistance(p: Node<'vec2'>): Node<'float'> {
  const r = vec2(FRAME.rx, FRAME.ry);
  const k1 = length(p.div(r));
  const k2 = max(length(p.div(r.mul(r))), 1e-5);
  return k1.mul(k1.sub(1)).div(k2);
}

/** what moves the camera: held keys, the lean of the pointer (−1 … 1 from the middle of the canvas) */
export interface WalkInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  leanX: number;
  leanY: number;
}

const smooth01 = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** How long the walker takes from the house to the canvas, and how long it stands there. */
const WALK_SECONDS = 110;
const STAND_SECONDS = 5;
const FADE_SECONDS = 2.5;

/**
 * The state of the demo, shared by the three stages and the mask: where the camera of the hallway
 * is, how deep the portal hangs, how far the walker in the painting has come, how the lamps burn.
 * The hallway, the bottom layer, calls {@link update} once a frame before anything reads it.
 */
export class PortalState {
  readonly input: WalkInput = {forward: false, back: false, left: false, right: false, leanX: 0, leanY: 0};
  /** walk to the painting and back by itself; any key, the wheel or the dolly slider stop it */
  autoWalk = true;
  /** the portal depth: the z of the far wall, the frame and the canvas */
  portalZ = 50;
  /** where the camera stands along the hallway (before the lean, the sway and the bob) */
  cameraZ = 1150;
  cameraX = 0;
  /** where the camera of the hallway is this frame */
  readonly camera = new Vector3(0, EYE_Y, 1150);
  /** seconds since the start */
  time = 0;
  /** the walker: 0 at the house, 1 at the canvas; then it stands, fades, and starts again */
  walk = 0.18;
  walkerAlpha = 1;
  /** how near the walker is to the canvas, 0 … 1: the lamps of the hallway feel it */
  dread = 0;
  /** the power of each sconce, left and right alternating from the far wall; and of the picture lamp */
  readonly lampPower = Array.from({length: LAMPS_PER_SIDE * 2}, () => uniform(LAMP_POWER));
  readonly pictureLampPower = uniform(1);
  /** the uniforms of the shaders */
  readonly portalZNode = uniform(50);
  readonly timeNode = uniform(0);
  readonly dreadNode = uniform(0);

  #walkClock = 0;
  #stand = 0;
  #leanX = 0;
  #leanY = 0;
  #stepPhase = 0;
  #lastZ = 1150;

  /** The far and the near end of the automatic walk, for the portal where it hangs now. */
  get walkRange(): {near: number; far: number} {
    return {near: this.portalZ + MIN_DISTANCE + 10, far: Math.min(MAX_CAMERA_Z - 40, this.portalZ + 1100)};
  }

  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    this.time += dt;
    const input = this.input;

    // the camera: walked by hand, or by itself — 22 s in, a pause, 14 s back, a pause
    if (this.autoWalk) {
      this.#walkClock = (this.#walkClock + dt) % 48;
      const c = this.#walkClock;
      const {near, far} = this.walkRange;
      const k = c < 22 ? smooth01(c / 22) : c < 29 ? 1 : c < 43 ? 1 - smooth01((c - 29) / 14) : 0;
      const target = far + (near - far) * k;
      this.cameraZ += (target - this.cameraZ) * (1 - Math.exp(-dt * 1.6));
      this.cameraX += (0 - this.cameraX) * (1 - Math.exp(-dt * 0.8));
    } else {
      const forward = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
      const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.cameraZ -= forward * 260 * dt;
      this.cameraX = Math.min(110, Math.max(-110, this.cameraX + strafe * 160 * dt));
    }
    this.cameraZ = Math.min(MAX_CAMERA_Z, Math.max(this.portalZ + MIN_DISTANCE, this.cameraZ));

    // a slow lean towards the pointer, and a bob and a sway while walking
    this.#leanX += (input.leanX * 34 - this.#leanX) * (1 - Math.exp(-dt * 3));
    this.#leanY += (input.leanY * 20 - this.#leanY) * (1 - Math.exp(-dt * 3));
    const speed = Math.abs(this.cameraZ - this.#lastZ) / Math.max(dt, 1e-4);
    this.#lastZ = this.cameraZ;
    const walking = Math.min(1, speed / 60);
    this.#stepPhase += dt * 7.5 * walking;
    const bob = Math.abs(Math.sin(this.#stepPhase)) * 2.2 * walking;
    const sway = Math.sin(this.#stepPhase * 0.5) * 2.4 * walking;
    this.camera.set(this.cameraX + this.#leanX + sway, EYE_Y + this.#leanY + bob, this.cameraZ);

    // the walker on the moor: very slowly from the house to the canvas, a stand, a fade, again
    if (this.walk < 1) {
      this.walk = Math.min(1, this.walk + dt / WALK_SECONDS);
      this.walkerAlpha = Math.min(1, this.walkerAlpha + dt / FADE_SECONDS);
    } else if (this.#stand < STAND_SECONDS) {
      this.#stand += dt;
    } else {
      this.walkerAlpha -= dt / FADE_SECONDS;
      if (this.walkerAlpha <= 0) {
        this.walkerAlpha = 0;
        this.walk = 0;
        this.#stand = 0;
      }
    }
    this.dread = smooth01((this.walk - 0.62) / 0.38) * this.walkerAlpha;

    // the lamps: a quiet flicker each; one that is dying; all of them stutter as the walker comes
    const t = this.time;
    for (let i = 0; i < this.lampPower.length; i++) {
      const flicker = 1 + 0.05 * Math.sin(t * 9.1 + i * 2.3) * Math.sin(t * 5.3 + i * 1.1);
      const dying = i === 4 ? (Math.sin(t * 1.7) > 0.55 && Math.sin(t * 31 + Math.sin(t * 7)) > 0 ? 0.18 : 0.8) : 1;
      const stutter = Math.sin(t * (17 + i * 3.1) + Math.sin(t * 4.3 + i)) > 1 - this.dread * 0.9 ? 1 - this.dread * 0.85 : 1;
      this.lampPower[i]!.value = LAMP_POWER * flicker * dying * stutter;
    }
    this.pictureLampPower.value = 1 - this.dread * 0.35 * (0.5 + 0.5 * Math.sin(t * 23));
    this.portalZNode.value = this.portalZ;
    this.timeNode.value = t;
    this.dreadNode.value = this.dread;
  }

  /** The z of a sconce, 0 the nearest to the far wall. */
  lampZ(index: number): number {
    return this.portalZ + LAMP_FIRST + Math.floor(index / 2) * LAMP_SPACING;
  }
}

/**
 * The light of the hallway at `p`, on a surface facing `normal`: the ten sconces down the walls and
 * the picture lamp over the portrait, a little ambient, and the dark that grows with the distance
 * from the camera. Worked out per pixel; the powers are uniforms the state sets every frame.
 */
function hallLight(state: PortalState, p: Node<'vec3'>, normal: Node<'vec3'>): Node<'vec3'> {
  let sum: Node<'vec3'> = vec3(0.012, 0.01, 0.016);
  for (let i = 0; i < state.lampPower.length; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const k = Math.floor(i / 2);
    const pos = vec3(side * (HALL.halfWidth - LAMP_INSET), LAMP_Y + 10, state.portalZNode.add(LAMP_FIRST + k * LAMP_SPACING));
    const l = pos.sub(p);
    const d2 = dot(l, l);
    const facing = clamp(dot(normal, normalize(l)).add(0.35).div(1.35), 0, 1);
    const range = pow(clamp(float(1).sub(d2.div(620 * 620)), 0, 1), float(2));
    const atten = (state.lampPower[i] as UniformNode<'float', number>).div(d2.div(85 * 85).add(1)).mul(range);
    sum = sum.add(SCONCE_COLOR.mul(facing.mul(atten)));
  }
  // the picture lamp: a long hood over the frame, throwing its light down and onto the wall
  const lampPos = vec3(PORTAL.x, PORTAL.y + FRAME.hh + 22, state.portalZNode.add(26));
  const toP = p.sub(lampPos);
  const d2 = dot(toP, toP);
  const cone = smoothstep(0.15, 0.7, dot(normalize(toP), normalize(vec3(0, -1, -0.32))));
  const facing = clamp(dot(normal, normalize(toP.negate())).add(0.2).div(1.2), 0, 1);
  const lamp = state.pictureLampPower
    .mul(cone)
    .mul(facing)
    .mul(3.2)
    .div(d2.div(150 * 150).add(1));
  sum = sum.add(PICTURE_LAMP_COLOR.mul(lamp));
  const fog = exp(length(p.sub(cameraPosition)).div(-1500));
  return sum.mul(fog);
}

/** A material that shows `albedo` lit by the hallway, for a surface facing `normal`. */
function litMaterial(
  state: PortalState,
  albedo: Node<'vec3'>,
  normal: [number, number, number],
  alpha?: Node<'float'>,
): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({transparent: alpha !== undefined, depthWrite: alpha === undefined});
  const light = hallLight(state, positionWorld, vec3(...normal));
  material.colorNode = vec4(albedo.mul(light), alpha ?? float(1));
  return material;
}

/**
 * The world: the hallway of a manor at night, built as a box in the space of the stage — a floor
 * with a runner, two papered walls over wainscot, a plaster ceiling — and seen through the parallax
 * camera, so it recedes as a hallway does. Sconces down both walls, three doors, and at the end, on
 * the far wall at the portal depth, the portrait in its gilt frame under a brass picture lamp. Its
 * canvas is not drawn here: the mask in the world of this stage cuts the slot of the moor there.
 *
 * Its stage also drives the {@link PortalState}: the director updates its layers bottom-up, so the
 * hallway, at the bottom, moves the camera before the moor and the mask read it.
 */
export class Hallway {
  readonly stage = makePortalStage('the hallway');

  readonly #state: PortalState;
  readonly #meshes: Mesh[] = [];
  /** what hangs at the portal depth and moves with it: the far wall, the frame, its shadow, the lamp */
  readonly #end = new Group();
  readonly #doors: Mesh[] = [];
  readonly #sconces: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #glows: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #sconceSprites: TexturedSprite[] = [];
  readonly #glowSprites: TexturedSprite[] = [];
  readonly #haloSprites: TexturedSprite[] = [];
  readonly #lampGlow: TexturedSprite;
  readonly #underDoor: Mesh;

  constructor(assets: PortalAssets, state: PortalState) {
    this.#state = state;
    const hallLength = HALL_NEAR + 300;
    const midZ = HALL_NEAR - hallLength / 2;
    const width = HALL.halfWidth * 2;
    const height = HALL.ceiling - HALL.floor;
    const p = positionWorld;

    // the floor: boards and the runner, repeating along the hallway
    const floorUv = vec2(p.x.add(HALL.halfWidth).div(width), p.z.div(FLOOR_PERIOD));
    const floor = new Mesh(
      new PlaneGeometry(width, hallLength),
      litMaterial(state, texture(assets.floor, floorUv).rgb, [0, 1, 0]),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, HALL.floor, midZ);
    floor.name = 'floor';

    // the ceiling: plaster, stained, a crack or two
    const plaster = mx_noise_float(vec3(p.x.mul(0.02), p.z.mul(0.02), 0.5))
      .mul(0.5)
      .add(0.5);
    const crack = float(1).sub(smoothstep(0, 0.02, abs(mx_noise_float(vec3(p.x.mul(0.018), p.z.mul(0.018), 3.1)))));
    const ceilingAlbedo = vec3(0.1, 0.085, 0.07)
      .mul(plaster.mul(0.5).add(0.75))
      .mul(float(1).sub(crack.mul(0.3)));
    const ceiling = new Mesh(new PlaneGeometry(width, hallLength), litMaterial(state, ceilingAlbedo, [0, -1, 0]));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, HALL.ceiling, midZ);
    ceiling.name = 'ceiling';

    // the two walls: the strip of the wall repeating along the hallway
    const wallV = p.y.sub(HALL.floor).div(height);
    const left = new Mesh(
      new PlaneGeometry(hallLength, height),
      litMaterial(state, texture(assets.wall, vec2(p.z.div(WALL_PERIOD), wallV)).rgb, [1, 0, 0]),
    );
    left.rotation.y = Math.PI / 2;
    left.position.set(-HALL.halfWidth, (HALL.floor + HALL.ceiling) / 2, midZ);
    left.name = 'left wall';
    const right = new Mesh(
      new PlaneGeometry(hallLength, height),
      litMaterial(state, texture(assets.wall, vec2(p.z.div(WALL_PERIOD).negate(), wallV)).rgb, [-1, 0, 0]),
    );
    right.rotation.y = -Math.PI / 2;
    right.position.set(HALL.halfWidth, (HALL.floor + HALL.ceiling) / 2, midZ);
    right.name = 'right wall';

    // the far wall: the same strip across, a panel centred under the portrait
    const far = new Mesh(
      new PlaneGeometry(width, height),
      litMaterial(state, texture(assets.wall, vec2(p.x.div(WALL_PERIOD).add(0.5), wallV)).rgb, [0, 0, 1]),
    );
    far.position.set(0, (HALL.floor + HALL.ceiling) / 2, 0);
    far.name = 'far wall';
    this.#meshes.push(floor, ceiling, left, right, far);
    this.#end.add(far);

    // the soft shadow the frame throws on the wall, lower than the frame: the lamp is above
    const shadowGeometry = new PlaneGeometry(FRAME.hw * 2 + 60, FRAME.hh * 2 + 60);
    const q = abs(positionLocal.xy).sub(vec2(FRAME.hw - 4, FRAME.hh - 4));
    const box = length(max(q, vec2(0, 0)));
    const shadowMaterial = new MeshBasicNodeMaterial({transparent: true, depthWrite: false});
    shadowMaterial.colorNode = vec4(
      0,
      0,
      0,
      float(1)
        .sub(smoothstep(0, 22, box))
        .mul(0.75),
    );
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.position.set(PORTAL.x + 3, PORTAL.y - 9, 0.3);
    shadow.renderOrder = 1;
    shadow.name = 'frame shadow';
    this.#meshes.push(shadow);
    this.#end.add(shadow);

    // the frame: its relief is shaded in the image by the lamp above; the hallway only dims it
    const frameTex = texture(assets.frame, uv());
    const frameMaterial = new MeshBasicNodeMaterial({transparent: true, depthWrite: false});
    const frameLight = hallLight(state, positionWorld, vec3(0, 0, 1));
    frameMaterial.colorNode = vec4(frameTex.rgb.mul(frameLight.mul(0.55).add(0.08)), frameTex.a);
    const frame = new Mesh(new PlaneGeometry(FRAME.hw * 2, FRAME.hh * 2), frameMaterial);
    frame.position.set(PORTAL.x, PORTAL.y, 0.6);
    frame.renderOrder = 2;
    frame.name = 'frame';
    this.#meshes.push(frame);
    this.#end.add(frame);

    // the doors, on the side walls, lit by the hallway
    const doorW = assets.layout.door.w;
    const doorH = assets.layout.door.h;
    // the doors stand side by side in one image: its width is where the last one ends
    const atlasW = Math.max(...Object.values(assets.layout.door.frames).map((f) => f.x + f.w));
    for (const door of DOORS) {
      const rect = assets.layout.door.frames[door.frame]!;
      const doorUv = vec2(
        uv()
          .x.mul(rect.w / atlasW)
          .add(rect.x / atlasW),
        uv().y,
      );
      const mesh = new Mesh(
        new PlaneGeometry(doorW, doorH),
        litMaterial(state, texture(assets.doors, doorUv).rgb, [-door.side, 0, 0]),
      );
      mesh.rotation.y = door.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      mesh.name = door.frame;
      this.#doors.push(mesh);
      this.#meshes.push(mesh);
    }

    // a line of warm light under the lit door, and feet that pass in the room behind it
    const lit = DOORS[LIT_DOOR];
    const along = positionLocal.x.div(doorW - 40).add(0.5);
    const across = positionLocal.y.div(5);
    const feet = smoothstep(
      0.55,
      0.75,
      mx_noise_float(vec3(along.mul(3).sub(state.timeNode.mul(0.25)), 0.5, state.timeNode.mul(0.05))),
    );
    const line = exp(across.mul(across).mul(-9))
      .mul(smoothstep(0, 0.12, along))
      .mul(smoothstep(0, 0.12, float(1).sub(along)));
    const underMaterial = new MeshBasicNodeMaterial({transparent: true, depthWrite: false, blending: AdditiveBlending});
    underMaterial.colorNode = vec4(vec3(1, 0.55, 0.22).mul(line.mul(float(1).sub(feet.mul(0.9))).mul(0.18)), 1);
    this.#underDoor = new Mesh(new PlaneGeometry(doorW - 40, 10), underMaterial);
    this.#underDoor.rotation.x = -Math.PI / 2;
    this.#underDoor.rotation.z = lit.side < 0 ? -Math.PI / 2 : Math.PI / 2;
    this.#underDoor.renderOrder = 3;
    this.#underDoor.name = 'light under the door';
    this.#meshes.push(this.#underDoor);

    // the sconces in profile (the wall at their left edge, mirrored on the right wall) and the picture lamp
    const sconce = frameUnits(assets, 'sconce');
    const lampUnits = frameUnits(assets, 'picture-lamp');
    this.#sconces = spritePool(assets, LAMPS_PER_SIDE * 2 + 1, 'sconces');
    this.#sconces.renderOrder = 4;
    for (let i = 0; i < LAMPS_PER_SIDE * 2; i++) {
      const sprite = this.#sconces.createSprite()!;
      setFrame(sprite, assets, 'sconce', sconce.w, sconce.h, i % 2 === 1);
      this.#sconceSprites.push(sprite);
    }
    const pictureLamp = this.#sconces.createSprite()!;
    setFrame(pictureLamp, assets, 'picture-lamp', lampUnits.w, lampUnits.h);
    pictureLamp.setPosition(PORTAL.x, PORTAL.y + FRAME.hh + 20, 14);
    this.#sconceSprites.push(pictureLamp);

    // the glow of every lamp: a tight one on the glass, a wide halo in the air
    this.#glows = spritePool(assets, LAMPS_PER_SIDE * 4 + 1, 'lamp glows', {blending: AdditiveBlending, depthTest: false});
    this.#glows.renderOrder = 5;
    for (let i = 0; i < LAMPS_PER_SIDE * 2; i++) {
      const glow = this.#glows.createSprite()!;
      setFrame(glow, assets, 'glow', 46, 46);
      this.#glowSprites.push(glow);
      const halo = this.#glows.createSprite()!;
      setFrame(halo, assets, 'glow', 220, 220);
      this.#haloSprites.push(halo);
    }
    this.#lampGlow = this.#glows.createSprite()!;
    setFrame(this.#lampGlow, assets, 'glow', 200, 40);

    for (const mesh of this.#meshes) if (!mesh.parent) this.stage.scene.add(mesh);
    this.stage.scene.add(this.#end, this.#sconces, this.#glows);
    // the director may draw this stage (precompile()) before its first update: place and upload now
    this.#place();

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => {
      state.update(deltaTime);
      this.#place();
      this.stage.camera?.position.copy(state.camera);
    });
  }

  /** Puts what hangs at the portal depth where it is now, and the lamps at their power. */
  #place(): void {
    const state = this.#state;
    const z = state.portalZ;
    this.#end.position.z = z;
    for (let i = 0; i < DOORS.length; i++) {
      const door = DOORS[i]!;
      this.#doors[i]!.position.set(door.side * (HALL.halfWidth - 0.6), HALL.floor + 150, z + door.z);
    }
    const lit = DOORS[LIT_DOOR];
    this.#underDoor.position.set(lit.side * (HALL.halfWidth - 5), HALL.floor + 0.4, z + lit.z);

    for (let i = 0; i < LAMPS_PER_SIDE * 2; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lz = state.lampZ(i);
      const power = (state.lampPower[i] as UniformNode<'float', number>).value / LAMP_POWER;
      this.#sconceSprites[i]!.setPosition(side * (HALL.halfWidth - 24), LAMP_Y, lz);
      this.#glowSprites[i]!.setPosition(side * (HALL.halfWidth - LAMP_INSET), LAMP_Y + 20, lz);
      this.#glowSprites[i]!.setColorValues(1, 0.7, 0.4, 0.9 * power);
      this.#haloSprites[i]!.setPosition(side * (HALL.halfWidth - LAMP_INSET - 10), LAMP_Y + 14, lz);
      this.#haloSprites[i]!.setColorValues(1, 0.55, 0.25, 0.16 * power);
    }
    this.#sconceSprites[LAMPS_PER_SIDE * 2]!.setPosition(PORTAL.x, PORTAL.y + FRAME.hh + 20, z + 14);
    this.#lampGlow.setPosition(PORTAL.x, PORTAL.y + FRAME.hh + 9, z + 16);
    this.#lampGlow.setColorValues(1, 0.8, 0.55, 0.5 * state.pictureLampPower.value);
    this.#sconces.update();
    this.#glows.update();
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.#sconces.dispose();
    this.#glows.dispose();
    this.stage.dispose();
  }
}
