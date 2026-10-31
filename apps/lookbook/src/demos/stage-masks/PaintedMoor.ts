import {on} from '@spearwolf/eventize';
import {
  type FeatureSpritesOf,
  OnStageUpdateFrame,
  StageMask,
  type TexturedSprite,
  type TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {
  abs,
  clamp,
  exp,
  float,
  floor,
  fract,
  fwidth,
  length,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  positionLocal,
  positionWorld,
  pow,
  sin,
  smoothstep,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {AdditiveBlending, Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry, Scene} from 'three/webgpu';
import {
  FRAME,
  frameUnits,
  type Hallway,
  HALL,
  makePortalStage,
  ovalDistance,
  PORTAL,
  type PortalAssets,
  type PortalState,
  setFrame,
  spritePool,
} from './PaintingHallway';

type FloatNode = Node<'float'>;

/**
 * The moor in its own units: the canvas is its plane z = 0, the ground lies this far below its middle —
 * below the bottom of the oval, as the ground outside lies below a window sill: a ray through the
 * bottom of the canvas still finds the ground behind it.
 */
const GROUND_Y = -130;
/** the walker is drawn larger than the generator drew it: a tall figure */
const WALKER_SCALE = 1.3;
/** where the house stands, its foot on the ground */
const HOUSE = {x: 60, z: -1850, scale: 1};
/** the walker's way, from in front of the house to just behind the canvas */
const WALK_FROM = -1760;
const WALK_TO = -42;
/** the sky, far behind: the moon on it, where it shows near the house from the far end of the hallway */
const SKY_Z = -6000;
const MOON = {x: -300, y: 540, r: 105};
/** the mist lies in banks across the moor; between them, the props stand in bands drawn far to near */
const MIST_BANKS = [-2300, -1500, -900, -420, -150];

/** The path over the moor: its x at depth `z` (negative), from the house to the canvas. Shared by the shader and the walker. */
export function pathX(z: number): number {
  const t = -z;
  const ends = Math.min(1, Math.max(0, (t - 60) / 300)) * Math.min(1, Math.max(0, (1850 - t) / 300));
  return 60 * (t / 1850) + 34 * Math.sin(t * 0.0034) * ends;
}

function pathXNode(z: FloatNode): FloatNode {
  const t = z.negate();
  const ends = clamp(t.sub(60).div(300), 0, 1).mul(clamp(float(1850).sub(t).div(300), 0, 1));
  return t
    .div(1850)
    .mul(60)
    .add(sin(t.mul(0.0034)).mul(34).mul(ends));
}

/** The haze of the moor at depth `z`: 0 at the canvas, towards 1 at the horizon. */
const hazeAt = (z: number) => 1 - Math.exp(z / 2600);
const MOON_TINT: [number, number, number] = [0.56, 0.68, 0.65];
const MIST = vec3(0.16, 0.24, 0.24);
const HORIZON = vec3(0.07, 0.15, 0.16);
const ZENITH = vec3(0.004, 0.009, 0.016);

/** a soft edge one pixel wide on `d` (negative inside) */
const coverage = (d: FloatNode) => {
  const w = max(fwidth(d), 1e-3);
  return float(1).sub(smoothstep(w.negate(), w, d));
};

/**
 * The other world: the moor inside the painting. A night sky with the moon low over the hills, three
 * ridges fading into the haze, heath with a pale path winding to a lone house whose window is lit,
 * a dead hawthorn, standing stones, banks of mist — and someone walking up the path, very slowly,
 * towards you.
 *
 * Its units start at the canvas: the plane z = 0 of this stage is the canvas of the portrait, and
 * everything of the moor lies behind it. Its camera is the camera of the hallway moved by the place
 * of the canvas, so the moor is seen as if it lay behind the far wall: it shows through the portal
 * at exactly the size of its frame, and shifts in depth as the camera walks and leans.
 */
export class Moor {
  readonly stage = makePortalStage('the moor');

  readonly #state: PortalState;
  readonly #meshes: Mesh[] = [];
  readonly #bands: FeatureSpritesOf<typeof TexturedSpriteKind>[] = [];
  readonly #walkerPool: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #walker: TexturedSprite;
  readonly #walkerSize: {w: number; h: number};
  readonly #glows: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #windowGlow: TexturedSprite;
  readonly #windowHalo: TexturedSprite;

  constructor(assets: PortalAssets, state: PortalState) {
    this.#state = state;
    const t = state.timeNode;

    // the sky: a sickly glow along the horizon, stars, the moon in its halo, clouds that drift
    const sp = positionWorld.xy;
    const elevation = sp.y.sub(GROUND_Y).div(-SKY_Z);
    let sky: Node<'vec3'> = mix(HORIZON, ZENITH, smoothstep(0, 0.32, elevation));
    const cell = floor(sp.div(70));
    const h1 = fract(sin(cell.x.mul(127.1).add(cell.y.mul(311.7))).mul(43758.55));
    const h2 = fract(sin(cell.x.mul(269.5).add(cell.y.mul(183.3))).mul(43758.55));
    const starAt = cell.add(vec2(h1, h2).mul(0.8).add(0.1)).mul(70);
    const starR = max(fwidth(sp.x).mul(0.9), 5);
    const star = exp(pow(length(sp.sub(starAt)).div(starR), float(2)).negate())
      .mul(smoothstep(0.86, 1, h1))
      .mul(
        sin(t.mul(h2.mul(3).add(1)).add(h1.mul(40)))
          .mul(0.3)
          .add(0.7),
      )
      .mul(smoothstep(0.02, 0.12, elevation));
    sky = sky.add(vec3(0.75, 0.85, 0.9).mul(star));
    const toMoon = length(sp.sub(vec2(MOON.x, MOON.y)));
    const halo = exp(toMoon.div(-520))
      .mul(0.22)
      .add(exp(toMoon.div(-160)).mul(0.35));
    sky = sky.add(vec3(0.42, 0.62, 0.56).mul(halo));
    const disc = coverage(toMoon.sub(MOON.r));
    const maria = mx_fractal_noise_float(vec3(sp.sub(vec2(MOON.x, MOON.y)).mul(0.018), 2.0), 4, 2, 0.5)
      .mul(0.5)
      .add(0.5);
    sky = mix(sky, vec3(0.86, 0.93, 0.84).mul(float(1).sub(smoothstep(0.45, 0.8, maria).mul(0.28))), disc);
    const drift = sp.add(vec2(t.mul(14), 0));
    const cloudNoise = mx_fractal_noise_float(vec3(drift.mul(vec2(0.0005, 0.0012)), t.mul(0.004)), 5, 2, 0.5);
    const cloud = smoothstep(0.02, 0.32, cloudNoise)
      .mul(smoothstep(0.04, 0.12, elevation))
      .mul(float(1).sub(smoothstep(0.35, 0.6, elevation)));
    const lit = exp(toMoon.div(-700));
    sky = mix(sky, mix(vec3(0.012, 0.02, 0.024), vec3(0.22, 0.32, 0.3), lit.mul(float(1).sub(cloud.mul(0.6)))), cloud.mul(0.92));
    const skyMaterial = new MeshBasicNodeMaterial({depthWrite: false});
    skyMaterial.colorNode = vec4(sky, 1);
    const skyMesh = new Mesh(new PlaneGeometry(26000, 15000), skyMaterial);
    skyMesh.position.set(0, 2500, SKY_Z);
    skyMesh.renderOrder = -10;
    skyMesh.name = 'sky';
    this.#meshes.push(skyMesh);

    // three ridges, each a silhouette worked out per pixel, lit along its crest by the moon
    const ridges = [
      {z: -3700, height: 210, freq: 0.0011, seed: 1.3, tone: 0.55},
      {z: -2900, height: 150, freq: 0.0019, seed: 4.7, tone: 0.42},
      {z: -2350, height: 95, freq: 0.0027, seed: 8.1, tone: 0.3},
    ];
    ridges.forEach((ridge, i) => {
      const x = positionWorld.x;
      const crest = mx_fractal_noise_float(vec3(x.mul(ridge.freq), ridge.seed, 0), 4, 2, 0.5)
        .mul(0.5)
        .add(0.5)
        .mul(ridge.height)
        .add(GROUND_Y + 20);
      const d = positionWorld.y.sub(crest);
      // above the crest the ridge is clear: the exponent stays at 0 there, or it overflows to infinity, and
      // infinity times a coverage of 0 is NaN — which no mask multiplies away
      const below = min(d, 0);
      const rim = exp(below.div(4))
        .mul(0.5)
        .add(exp(below.div(30)).mul(0.25));
      const haze = 1 - Math.exp(ridge.z / 2600);
      const body = mix(vec3(0.02, 0.035, 0.035), HORIZON, haze * ridge.tone + 0.15);
      const material = new MeshBasicNodeMaterial({transparent: true, depthWrite: true});
      material.colorNode = vec4(
        body.add(
          vec3(0.18, 0.28, 0.26)
            .mul(rim)
            .mul(1 - haze * 0.6),
        ),
        coverage(d),
      );
      const mesh = new Mesh(new PlaneGeometry(16000, 900), material);
      mesh.position.set(0, GROUND_Y - 120 + 450, ridge.z);
      mesh.renderOrder = -9 + i;
      mesh.name = `ridge ${i}`;
      this.#meshes.push(mesh);
    });

    // the heath: dark peat and heather, grey grass, the path pale in the moonlight, hazy with depth
    const gp = positionWorld.xz;
    const patches = mx_fractal_noise_float(vec3(gp.mul(0.006), 0.3), 4, 2, 0.5)
      .mul(0.5)
      .add(0.5);
    const tufts = mx_noise_float(vec3(gp.mul(0.09), 1.7))
      .mul(0.5)
      .add(0.5);
    let heath: Node<'vec3'> = mix(vec3(0.014, 0.011, 0.015), vec3(0.03, 0.036, 0.026), smoothstep(0.35, 0.7, patches));
    heath = heath.mul(tufts.mul(0.5).add(0.75));
    const pathD = abs(positionWorld.x.sub(pathXNode(positionWorld.z))).sub(float(12).add(tufts.mul(5)));
    heath = mix(heath, vec3(0.075, 0.085, 0.078).mul(tufts.mul(0.3).add(0.85)), coverage(pathD).mul(0.85));
    const groundHaze = float(1).sub(exp(positionWorld.z.div(2600)));
    const groundMaterial = new MeshBasicNodeMaterial();
    groundMaterial.colorNode = vec4(mix(heath, HORIZON, groundHaze.mul(0.92)), 1);
    const ground = new Mesh(new PlaneGeometry(9000, 4200), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, GROUND_Y, -2100);
    ground.name = 'heath';
    this.#meshes.push(ground);

    // the props in bands between the banks of mist, far to near; each band one pool
    const bandOf = (z: number) => MIST_BANKS.filter((bank) => bank > z).length;
    // far bands first: the band behind every bank draws before the farthest bank, and so on
    const bandOrder = (z: number) => 10 + (MIST_BANKS.length - bandOf(z)) * 3;
    type Prop = {frame: string; x: number; z: number; scale: number};
    const props: Prop[] = [{frame: 'house', x: HOUSE.x, z: HOUSE.z, scale: HOUSE.scale}];
    props.push({frame: 'tree', x: -250, z: -760, scale: 1.25});
    props.push({frame: 'stone-a', x: 170, z: -520, scale: 1.2});
    props.push({frame: 'stone-b', x: 215, z: -560, scale: 1.1});
    props.push({frame: 'stone-b', x: -330, z: -1350, scale: 1.3});
    let seed = 20231031;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 150; i++) {
      const z = -60 - random() ** 1.6 * 1700;
      const spread = 120 + -z * 0.9;
      let x = (random() * 2 - 1) * spread;
      if (Math.abs(x - pathX(z)) < 30) x += x > pathX(z) ? 40 : -40;
      props.push({frame: `heather-${'abc'[i % 3]}`, x, z, scale: 0.6 + random() * 0.8});
    }
    props.sort((a, b) => a.z - b.z);
    for (let b = 0; b <= MIST_BANKS.length; b++) {
      const inBand = props.filter((prop) => bandOf(prop.z) === b);
      const pool = spritePool(assets, Math.max(1, inBand.length), `moor band ${b}`);
      pool.renderOrder = 10 + (MIST_BANKS.length - b) * 3;
      for (const prop of inBand) {
        const sprite = pool.createSprite()!;
        const units = frameUnits(assets, prop.frame);
        setFrame(sprite, assets, prop.frame, units.w * prop.scale, units.h * prop.scale);
        sprite.setPosition(prop.x, GROUND_Y + (units.h * prop.scale) / 2 - 2, prop.z);
        const k = 1 - hazeAt(prop.z) * 0.75;
        sprite.setColorValues(MOON_TINT[0] * k, MOON_TINT[1] * k, MOON_TINT[2] * k, 1);
      }
      // the props never move: one upload, here, before anything (precompile() included) draws them
      pool.update();
      this.#bands.push(pool);
    }

    // the lit window of the house: a glow and a halo, flickering as a lamp does
    this.#glows = spritePool(assets, 2, 'window glow', {blending: AdditiveBlending, depthTest: false});
    this.#glows.renderOrder = bandOrder(HOUSE.z) + 1;
    const house = frameUnits(assets, 'house');
    const wx = HOUSE.x + (69 - house.w / 2) * HOUSE.scale;
    const wy = GROUND_Y + house.h * HOUSE.scale - 2 - 193 * HOUSE.scale;
    this.#windowGlow = this.#glows.createSprite()!;
    setFrame(this.#windowGlow, assets, 'glow', 34, 40);
    this.#windowGlow.setPosition(wx, wy, HOUSE.z + 1);
    this.#windowHalo = this.#glows.createSprite()!;
    setFrame(this.#windowHalo, assets, 'glow', 140, 120);
    this.#windowHalo.setPosition(wx, wy, HOUSE.z + 1);

    // the walker
    this.#walkerPool = spritePool(assets, 1, 'walker');
    this.#walker = this.#walkerPool.createSprite()!;
    this.#walkerSize = frameUnits(assets, 'walker');
    setFrame(this.#walker, assets, 'walker', this.#walkerSize.w * WALKER_SCALE, this.#walkerSize.h * WALKER_SCALE);

    // banks of mist: soft noise in planes across the moor, thickest on the ground, drifting
    MIST_BANKS.forEach((bank, i) => {
      const mp = positionLocal.xy;
      const n = mx_fractal_noise_float(vec3(mp.x.mul(0.004).add(t.mul(0.012 + i * 0.004)), mp.y.mul(0.012), i * 3.3), 4, 2, 0.5)
        .mul(0.5)
        .add(0.5);
      // thickest within some 30 units of the ground (the plane's middle is 80 units above it)
      const low = exp(max(mp.y.add(70), 0).div(-34));
      const material = new MeshBasicNodeMaterial({transparent: true, depthWrite: false});
      const density = smoothstep(0.3, 0.75, n)
        .mul(low)
        .mul(0.7 - i * 0.07);
      material.colorNode = vec4(MIST.mul(float(1).sub(hazeAt(bank) * 0.3)), density);
      const mesh = new Mesh(new PlaneGeometry(6000 + -bank * 2, 220), material);
      mesh.position.set(0, GROUND_Y + 80, bank);
      mesh.renderOrder = 10 + i * 3 + 2;
      mesh.name = `mist ${i}`;
      this.#meshes.push(mesh);
    });

    for (const mesh of this.#meshes) this.stage.scene.add(mesh);
    for (const pool of this.#bands) this.stage.scene.add(pool);
    this.stage.scene.add(this.#glows, this.#walkerPool);
    // the director may draw this stage (precompile()) before its first update: place and upload now
    this.#update();
    on(this.stage, OnStageUpdateFrame, () => this.#update());
  }

  #update(): void {
    // the hallway lies below the moor in the stack, and the director updates its layers bottom-up:
    // the state read here is the one the hallway moved this very frame
    const state = this.#state;
    // the camera of the hallway, moved by the place of the canvas: the moor lies behind the far wall
    const camera = this.stage.camera;
    if (camera) camera.position.set(state.camera.x - PORTAL.x, state.camera.y - PORTAL.y, state.camera.z - state.portalZ);

    const t = state.time;
    const z = WALK_FROM + (WALK_TO - WALK_FROM) * state.walk;
    const step = t * 2.1;
    const s = this.#walkerSize;
    const k = (1 - hazeAt(z) * 0.75) * state.walkerAlpha;
    this.#walker.setPosition(
      pathX(z) + Math.sin(step * 0.5) * 1.2,
      GROUND_Y + (s.h * WALKER_SCALE) / 2 - 5 + Math.abs(Math.sin(step)) * 1.4,
      z,
    );
    this.#walker.rotation = Math.sin(step * 0.5) * 0.025;
    this.#walker.setColorValues(MOON_TINT[0] * k, MOON_TINT[1] * k, MOON_TINT[2] * k, state.walkerAlpha);
    // drawn after the props of its band, before the mist in front of it
    let banksInFront = 0;
    for (let i = 0; i < MIST_BANKS.length; i++) if (MIST_BANKS[i]! > z) banksInFront++;
    this.#walkerPool.renderOrder = 10 + (MIST_BANKS.length - banksInFront) * 3 + 1;

    const flicker = 0.85 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.05 * Math.sin(t * 23);
    this.#windowGlow.setColorValues(1, 0.62, 0.25, 0.75 * flicker);
    this.#windowHalo.setColorValues(1, 0.5, 0.18, 0.22 * flicker);
    this.#walkerPool.update();
    this.#glows.update();
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    for (const pool of this.#bands) pool.dispose();
    this.#walkerPool.dispose();
    this.#glows.dispose();
    this.stage.dispose();
  }
}

/**
 * The portal: the canvas of the portrait as a white oval in a scene of its own, placed in the world
 * of the hallway — on the far wall, at the portal depth. `StageMask.inWorldOf(hallway.stage, scene)`
 * draws it through the camera of the hallway, wherever that camera walks; on the slot of the moor
 * it lets the moor show exactly there.
 */
export class PortalCanvas {
  readonly scene = new Scene();
  readonly mask: StageMask;
  readonly #mesh: Mesh;

  constructor(hallway: Hallway) {
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    material.colorNode = vec4(1, 1, 1, coverage(ovalDistance(positionLocal.xy)));
    this.#mesh = new Mesh(new PlaneGeometry(FRAME.rx * 2 + 8, FRAME.ry * 2 + 8), material);
    this.#mesh.name = 'canvas of the portrait';
    this.scene.add(this.#mesh);
    this.mask = StageMask.inWorldOf(hallway.stage, this.scene, {source: 'alpha'});
  }

  /** Hangs the canvas at the portal depth; the hallway calls it before the mask stage draws. */
  place(portalZ: number): void {
    this.#mesh.position.set(PORTAL.x, PORTAL.y, portalZ + 0.6);
  }

  dispose(): void {
    this.mask.dispose();
    this.#mesh.geometry.dispose();
    (this.#mesh.material as MeshBasicNodeMaterial).dispose();
  }
}

/** how many motes of dust float in the air of the hallway */
const MOTES = 70;

/**
 * The top layer, unmasked, in the world of the hallway as well: what lies in front of the canvas.
 * The shadow the frame throws into the oval (deeper at the top, the lamp is above), the varnish
 * catching the lamp, and dust floating in the light of the sconces — over the painting too.
 */
export class Glaze {
  readonly stage = makePortalStage('the glaze');

  readonly #state: PortalState;
  readonly #oval: Mesh;
  readonly #motes: FeatureSpritesOf<typeof TexturedSpriteKind>;
  readonly #moteState: {sprite: TexturedSprite; x: number; y: number; z: number; phase: number; size: number}[] = [];

  constructor(assets: PortalAssets, state: PortalState) {
    this.#state = state;
    const p = positionLocal.xy;
    const d = ovalDistance(p);
    const inside = coverage(d);
    const top = smoothstep(-FRAME.ry, FRAME.ry, p.y);
    const shade = exp(min(d, 0).div(float(7).add(top.mul(10)))).mul(top.mul(0.35).add(0.55));
    const sheen = exp(pow(length(p.sub(vec2(-14, FRAME.ry * 0.62)).mul(vec2(0.035, 0.09))), float(2)).negate()).mul(0.07);
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    // premultiplied by hand: the shadow darkens, the sheen adds a little warm light
    const alpha = clamp(shade, 0, 1).mul(inside);
    material.colorNode = vec4(vec3(1, 0.8, 0.55).mul(sheen).mul(inside), alpha);
    material.premultipliedAlpha = true;
    this.#oval = new Mesh(new PlaneGeometry(FRAME.rx * 2 + 4, FRAME.ry * 2 + 4), material);
    this.#oval.name = 'glaze of the canvas';
    this.stage.scene.add(this.#oval);

    this.#motes = spritePool(assets, MOTES, 'dust', {blending: AdditiveBlending, depthTest: false});
    let seed = 777;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < MOTES; i++) {
      const sprite = this.#motes.createSprite()!;
      setFrame(sprite, assets, 'glow', 3, 3);
      this.#moteState.push({
        sprite,
        x: (random() * 2 - 1) * (HALL.halfWidth - 20),
        y: HALL.floor + 30 + random() * 300,
        z: random() * 800,
        phase: random() * 10,
        size: 1.6 + random() * 2.4,
      });
    }
    this.stage.scene.add(this.#motes);
    // the director may draw this stage (precompile()) before its first update: place and upload now
    this.#update(0);
    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const state = this.#state;
    const camera = this.stage.camera;
    if (camera) camera.position.copy(state.camera);
    this.#oval.position.set(PORTAL.x, PORTAL.y, state.portalZ + 0.8);
    const dt = Math.min(deltaTime, 0.1);
    const t = state.time;
    // the motes live in the 800 units in front of the camera, wrapping round as it walks
    const near = state.camera.z - 30;
    for (let i = 0; i < this.#moteState.length; i++) {
      const m = this.#moteState[i]!;
      m.x += Math.sin(t * 0.3 + m.phase) * 3 * dt;
      m.y += (Math.cos(t * 0.23 + m.phase) * 2 - 0.6) * dt;
      if (m.y < HALL.floor + 20) m.y += 300;
      let z = near - ((((near - m.z) % 800) + 800) % 800);
      if (z < state.portalZ + 10) z += 800;
      m.z = z;
      // lit by the nearest sconces: a rough falloff from each wall's line of lamps
      let light = 0.15;
      for (let k = 0; k < state.lampPower.length; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const dx = side * (HALL.halfWidth - 14) - m.x;
        const dy = 74 - m.y;
        const dz = state.lampZ(k) - z;
        light += state.lampPower[k]!.value / (1 + (dx * dx + dy * dy + dz * dz) / (110 * 110));
      }
      const twinkle = 0.6 + 0.4 * Math.sin(t * 1.7 + m.phase * 3);
      m.sprite.setPosition(m.x, m.y, z);
      m.sprite.setSize(m.size, m.size);
      m.sprite.setColorValues(1, 0.75, 0.45, Math.min(1, light * 0.12) * twinkle);
    }
    this.#motes.update();
  }

  dispose(): void {
    this.#oval.geometry.dispose();
    (this.#oval.material as MeshBasicNodeMaterial).dispose();
    this.#motes.dispose();
    this.stage.dispose();
  }
}
