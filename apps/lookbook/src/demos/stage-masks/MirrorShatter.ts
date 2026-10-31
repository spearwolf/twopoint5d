import {on} from '@spearwolf/eventize';
import {OnStageUpdateFrame, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';
import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';
import {abs, attribute, float, fwidth, mix, normalView, pow, smoothstep, step, uniform, uv, vec3, vec4} from 'three/tsl';
import {
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PerspectiveCamera,
  Quaternion,
  RenderPipeline,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  type UniformNode,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import {InkRandom} from './InkWell';
import {type MirrorLayout, VIEW_HEIGHT, VIEW_WIDTH} from './MirrorBathroom';

/** the distance of the mask's camera from the plane of the wall, in units */
const CAM_Z = 1000;

/** the shards: how long one takes to turn over as the crack reaches it, and to fly past the camera */
const TURN = 0.035;
const FLIGHT = 0.4;
/** the panes of the wall: how long one takes to swing shut, and by when the last has started */
const PANE_SWING = 0.13;
/** the ring: how far away it starts and where it ends, in units from the camera */
const RING_FAR = 7000;
const RING_NEAR = 80;
/** the radius of the ouroboros, in units of its own */
const RING_R = 100;

export type MirrorMaskScene = 'shatter' | 'ouroboros';

type Point = [number, number];

/** The part of the convex polygon `poly` where `nx·x + ny·y <= c`. */
function clip(poly: Point[], nx: number, ny: number, c: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const da = nx * a[0] + ny * a[1] - c;
    const db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** The Voronoi cells of `sites` inside the rectangle, by clipping the rectangle with every bisector. */
function voronoi(sites: Point[], left: number, bottom: number, right: number, top: number): Point[][] {
  return sites.map(([px, py], i) => {
    let cell: Point[] = [
      [left, bottom],
      [right, bottom],
      [right, top],
      [left, top],
    ];
    for (let j = 0; j < sites.length && cell.length > 2; j++) {
      if (j === i) continue;
      const [qx, qy] = sites[j]!;
      cell = clip(cell, qx - px, qy - py, (qx * qx + qy * qy - px * px - py * py) / 2);
    }
    return cell;
  });
}

function centroid(poly: Point[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % poly.length]!;
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  return Math.abs(a) < 1e-9 ? poly[0]! : [cx / (3 * a), cy / (3 * a)];
}

/** A shape of `poly` around `c`, scaled by `scale` towards it. */
function shapeOf(poly: Point[], c: Point, scale: number): Shape {
  const shape = new Shape();
  poly.forEach(([x, y], i) => {
    const sx = (x - c[0]) * scale;
    const sy = (y - c[1]) * scale;
    if (i === 0) shape.moveTo(sx, sy);
    else shape.lineTo(sx, sy);
  });
  shape.closePath();
  return shape;
}

const easeOut = (u: number) => 1 - (1 - u) ** 3;
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

interface Shard {
  mesh: Mesh;
  cx: number;
  cy: number;
  /** the progress at which the crack reaches it and it turns over into the reflection */
  crackAt: number;
  /** the progress at which it comes loose and flies at the camera */
  launchAt: number;
  /** the axis it turns over about: across the line from the impact */
  turnAxis: Vector3;
  /** the axis it tumbles about in flight, and how far */
  tumbleAxis: Vector3;
  spin: number;
  /** where it drifts to on the way, in units of the wall */
  dx: number;
  dy: number;
}

interface Pane {
  mesh: Mesh;
  cx: number;
  cy: number;
  startAt: number;
  axis: Vector3;
}

// the pose of every mesh is worked out in place, through these
const qTurn = new Quaternion();
const qTumble = new Quaternion();

/**
 * The mask stage of the demo: a real 3D scene of shaded glass on transparent black, opaque
 * wherever the geometry is, under a perspective camera of its own. Two scenes, one at a time:
 *
 * - **shatter** — the glass of the mirror cracks from where her face is, the shards turn over one
 *   by one into the reflection, come loose and tumble at the camera, growing in its perspective
 *   until they fly past it; behind them each hole in the glass shows the reflection, and the panes
 *   of the wall around the mirror swing shut in a wave from the impact outwards, until the
 *   whole picture is the other side.
 * - **ouroboros** — a sigil far behind the glass: a snake eating its tail inside a ring of spikes,
 *   an eye in its middle that opens. It turns towards the camera and comes closer until the eye
 *   fills the screen.
 *
 * Every pose is a function of the progress of the transition and nothing else, laid out once from
 * a seed: the scene holds still at any frame of a scrub and runs the same way back. The stage is a
 * `StageRenderer` with a pipeline of its own: the pass of the 3D scene and a bloom over it, added to
 * the colour only — the alpha stays the coverage of the geometry.
 */
export class MirrorShatter {
  /** the mask stage: a renderer with a bloom in its own pipeline */
  readonly stage = new StageRenderer();
  /** the 3D scene, under its own perspective camera */
  readonly scene3d = new Stage2D();
  readonly camera = new PerspectiveCamera(30, VIEW_WIDTH / VIEW_HEIGHT, 1, 20000);
  /** how much of the bloom is added: 0 switches it off without a rebuild of the pipeline */
  readonly bloomStrength = uniform(1.4) as unknown as UniformNode<'float', number>;
  /** the progress the poses follow, also as a uniform for the shaders of the scene */
  readonly progress = uniform(0) as unknown as UniformNode<'float', number>;

  readonly #shatter = new Group();
  readonly #ouroboros = new Group();
  readonly #shards: Shard[] = [];
  readonly #panes: Pane[] = [];
  readonly #spinner = new Group();
  readonly #eyeOpen = uniform(0) as unknown as UniformNode<'float', number>;
  readonly #pupil = uniform(0.2) as unknown as UniformNode<'float', number>;
  readonly #ringCentre: Point;
  readonly #geometries: BufferGeometry[] = [];
  readonly #materials: MeshBasicNodeMaterial[] = [];
  #pipeline: RenderPipeline | undefined;
  #glow: {dispose(): void} | undefined;
  #source: {progress: number} | undefined;
  #scene: MirrorMaskScene = 'shatter';
  #fitWidth = 0;
  #fitHeight = 0;

  constructor(layout: MirrorLayout, seed = 1931) {
    this.stage.name = 'mirror matte';
    this.scene3d.name = 'mirror matte scene';
    this.camera.position.set(0, 0, CAM_Z);
    this.scene3d.camera = this.camera;
    this.stage.add(this.scene3d);
    this.scene3d.scene.add(this.#shatter, this.#ouroboros);

    const {glass} = layout;
    // the impact: her face in the reflection, between her eyes
    const eyes = layout.figureEyes;
    const impact: Point = eyes.length
      ? [eyes.reduce((s, e) => s + e[0], 0) / eyes.length, eyes.reduce((s, e) => s + e[1], 0) / eyes.length]
      : [(glass.left + glass.right) / 2, (glass.bottom + glass.top) / 2];
    this.#ringCentre = [(glass.left + glass.right) / 2, (glass.bottom + glass.top) / 2];

    const rng = new InkRandom(seed);
    this.#buildShatter(glass, impact, rng);
    this.#buildOuroboros(rng);
    this.setScene('shatter');
    this.#pose(0);

    on(this.scene3d, OnStageUpdateFrame, () => this.#update());
  }

  /** The mask whose progress the scene follows: the one whose transition runs. */
  follow(source: {progress: number}): void {
    this.#source = source;
  }

  get scene(): MirrorMaskScene {
    return this.#scene;
  }

  setScene(scene: MirrorMaskScene): void {
    this.#scene = scene;
    this.#shatter.visible = scene === 'shatter';
    this.#ouroboros.visible = scene === 'ouroboros';
  }

  /**
   * Builds the pipeline of the mask stage: the pass of the 3D scene with a bloom of it added to the
   * colour. three's bloom answers an alpha of its own over the whole picture, so the alpha of the
   * sum is the alpha of the scene alone: the coverage stays the silhouette, the glow is look. The
   * picture of a mask stage is premultiplied, so what glows outside the silhouette, at alpha 0,
   * does not survive into it: the bloom brightens the glass where it is, never beyond.
   */
  attachPipeline(renderer: WebGPURenderer): void {
    const pipeline = new RenderPipeline(renderer);
    this.#pipeline = pipeline;
    this.stage.pipeline = pipeline;
    this.stage.buildOutputNode = ([scenePass]) => {
      const picture = scenePass as Node<'vec4'>;
      // only what is bright blooms: the glints of the glass, not its shaded faces
      const glow = bloom(picture, this.bloomStrength as unknown as number, 0.6, 0.55);
      this.#glow?.dispose();
      this.#glow = glow;
      return vec4(picture.rgb.add((glow as unknown as Node<'vec4'>).rgb), picture.a);
    };
  }

  /**
   * Shows every part of both scenes at a pose halfway through, for `precompile()` to build each
   * shader once ahead; the next update poses the scene by the progress again.
   */
  showAllForPrecompile(): void {
    this.#shatter.visible = true;
    this.#ouroboros.visible = true;
    this.#pose(0.5);
  }

  /** After `precompile()`: back to the chosen scene at the progress it follows. */
  afterPrecompile(): void {
    this.setScene(this.#scene);
    this.#pose(this.#source?.progress ?? 0);
  }

  #update(): void {
    const w = this.scene3d.containerWidth;
    const h = this.scene3d.containerHeight;
    if (w > 0 && h > 0 && (w !== this.#fitWidth || h !== this.#fitHeight)) {
      this.#fitWidth = w;
      this.#fitHeight = h;
      this.#fit(w / h);
    }
    this.#pose(this.#source?.progress ?? 0);
  }

  /**
   * The camera sees the plane of the wall (z = 0) exactly as the scenes show it: their view of
   * 960 × 540 units under `fit: 'cover'`, cropped to the aspect of the screen.
   */
  #fit(aspect: number): void {
    const halfHeight = aspect >= VIEW_WIDTH / VIEW_HEIGHT ? VIEW_WIDTH / 2 / aspect : VIEW_HEIGHT / 2;
    this.camera.aspect = aspect;
    this.camera.fov = (2 * Math.atan(halfHeight / CAM_Z) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
  }

  /**
   * The material of every solid part: opaque — its alpha, the coverage, is 1 wherever the geometry
   * is — and shaded like glass in its colour, the look: dimmer the more a face turns away from the
   * camera, with a glint as it swings through facing it. The matte in `'alpha'` reads the first,
   * in `'luminance'` the second.
   */
  #glass(): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial({transparent: true, side: DoubleSide, depthWrite: false, depthTest: false});
    const facing = abs(normalView.z);
    const shade = mix(float(0.22), float(0.85), pow(facing, 1.5)).add(pow(facing, 60).mul(0.6));
    material.colorNode = vec4(vec3(shade.min(1)), 1);
    this.#materials.push(material);
    return material;
  }

  #buildShatter(glass: MirrorLayout['glass'], impact: Point, rng: InkRandom): void {
    const surface = this.#glass();

    // the sites of the shards: rings around the impact, closer together near it, so the shards are
    // small and splintered at the impact and long and radial towards the frame
    const sites: Point[] = [[impact[0] + rng.range(-2, 2), impact[1] + rng.range(-2, 2)]];
    let radius = 10;
    for (let ring = 0; radius < 420; ring++) {
      const count = Math.round(5 + ring * 2.4);
      const turn = rng.range(0, Math.PI * 2);
      for (let k = 0; k < count; k++) {
        const a = turn + ((k + rng.range(-0.3, 0.3)) / count) * Math.PI * 2;
        const r = radius * rng.range(0.85, 1.15);
        const x = impact[0] + Math.cos(a) * r;
        const y = impact[1] + Math.sin(a) * r;
        if (x > glass.left - 30 && x < glass.right + 30 && y > glass.bottom - 30 && y < glass.top + 30) sites.push([x, y]);
      }
      radius *= 1.5;
    }
    const cells = voronoi(sites, glass.left, glass.bottom, glass.right, glass.top).filter((c) => c.length > 2);
    let farthest = 1;
    for (const cell of cells) {
      const [cx, cy] = centroid(cell);
      farthest = Math.max(farthest, Math.hypot(cx - impact[0], cy - impact[1]));
    }

    // the holes the shards leave: one geometry of every cell at the glass, each cell shown from the
    // progress its shard comes loose — the reflection behind the glass
    const positions: number[] = [];
    const launches: number[] = [];

    for (const cell of cells) {
      const c = centroid(cell);
      const [cx, cy] = c;
      const d = Math.hypot(cx - impact[0], cy - impact[1]) / farthest;
      let area = 0;
      for (let i = 0; i < cell.length; i++) {
        const [x0, y0] = cell[i]!;
        const [x1, y1] = cell[(i + 1) % cell.length]!;
        area += x0 * y1 - x1 * y0;
      }
      const size = Math.sqrt(Math.abs(area) / 2);
      // a crack of about a unit and a half between neighbours: the gap shows the glass that still holds
      const inset = Math.max(0.6, 1 - 1.6 / size);
      const geometry = new ExtrudeGeometry(shapeOf(cell, c, inset), {depth: 2.5, bevelEnabled: false});
      geometry.translate(0, 0, -1.25);
      this.#geometries.push(geometry);
      const mesh = new Mesh(geometry, surface);
      mesh.name = 'shard';
      this.#shatter.add(mesh);

      const away = Math.atan2(cy - impact[1], cx - impact[0]);
      const launchAt = 0.14 + 0.3 * d ** 0.8 + rng.range(0, 0.06);
      const shard: Shard = {
        mesh,
        cx,
        cy,
        crackAt: 0.01 + 0.11 * d + rng.range(0, 0.012),
        launchAt,
        turnAxis: new Vector3(-Math.sin(away), Math.cos(away), 0),
        tumbleAxis: new Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-0.4, 0.4)).normalize(),
        spin: rng.range(2.5, 6) * (rng.next() < 0.5 ? -1 : 1),
        dx: Math.cos(away) * rng.range(170, 540) + rng.range(-60, 60),
        dy: Math.sin(away) * rng.range(120, 380) + rng.range(-60, 60),
      };
      this.#shards.push(shard);

      for (let i = 0; i < cell.length; i++) {
        const a = cell[i]!;
        const b = cell[(i + 1) % cell.length]!;
        positions.push(cx, cy, -2, a[0], a[1], -2, b[0], b[1], -2);
        launches.push(launchAt, launchAt, launchAt);
      }
    }

    const holes = new BufferGeometry();
    holes.setAttribute('position', new Float32BufferAttribute(positions, 3));
    holes.setAttribute('launch', new Float32BufferAttribute(launches, 1));
    this.#geometries.push(holes);
    const holeMaterial = new MeshBasicNodeMaterial({transparent: true, side: DoubleSide, depthWrite: false, depthTest: false});
    holeMaterial.colorNode = vec4(1, 1, 1, step(attribute('launch', 'float'), this.progress));
    this.#materials.push(holeMaterial);
    const holeMesh = new Mesh(holes, holeMaterial);
    holeMesh.name = 'holes in the glass';
    this.#shatter.add(holeMesh);

    // the wall around the mirror: panes over the whole view that swing shut, nearest the impact first
    const paneSites: Point[] = [];
    const cols = 13;
    const rows = 8;
    const w = VIEW_WIDTH + 60;
    const h = VIEW_HEIGHT + 60;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        paneSites.push([-w / 2 + ((i + rng.range(0.15, 0.85)) / cols) * w, -h / 2 + ((j + rng.range(0.15, 0.85)) / rows) * h]);
      }
    }
    const paneCells = voronoi(paneSites, -w / 2, -h / 2, w / 2, h / 2).filter((c) => c.length > 2);
    let paneFarthest = 1;
    for (const cell of paneCells) {
      const [cx, cy] = centroid(cell);
      paneFarthest = Math.max(paneFarthest, Math.hypot(cx - impact[0], cy - impact[1]));
    }
    for (const cell of paneCells) {
      const c = centroid(cell);
      const d = Math.hypot(c[0] - impact[0], c[1] - impact[1]) / paneFarthest;
      // a hair larger than the cell: neighbours overlap, and no seam shows between them at the end
      const geometry = new ShapeGeometry(shapeOf(cell, c, 1.01));
      this.#geometries.push(geometry);
      const mesh = new Mesh(geometry, surface);
      mesh.name = 'pane';
      this.#shatter.add(mesh);
      const a = rng.range(0, Math.PI * 2);
      this.#panes.push({
        mesh,
        cx: c[0],
        cy: c[1],
        startAt: 0.3 + 0.48 * d + rng.range(0, 0.06),
        axis: new Vector3(Math.cos(a), Math.sin(a), 0),
      });
    }
  }

  #buildOuroboros(rng: InkRandom): void {
    const surface = this.#glass();

    // the snake: a tube along the circle, a thread at the tail, thick at the head, scales along its back
    const segments = 420;
    const around = 18;
    const end = Math.PI * 2 * 0.965;
    const positions: number[] = [];
    const index: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const theta = t * end;
      const scales = 0.9 * Math.max(0, Math.sin(theta * 64)) ** 2 * t;
      const r = 2 + 13 * t ** 0.7 + scales;
      const nx = Math.cos(theta);
      const ny = Math.sin(theta);
      for (let k = 0; k < around; k++) {
        const phi = (k / around) * Math.PI * 2;
        const rr = RING_R + r * Math.cos(phi);
        positions.push(nx * rr, ny * rr, r * Math.sin(phi));
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let k = 0; k < around; k++) {
        const a = i * around + k;
        const b = i * around + ((k + 1) % around);
        index.push(a, b, b + around, a, b + around, a + around);
      }
    }
    const body = new BufferGeometry();
    body.setAttribute('position', new Float32BufferAttribute(positions, 3));
    body.setIndex(index);
    this.#geometries.push(body);
    const snake = new Mesh(body, surface);
    snake.name = 'ouroboros';
    this.#spinner.add(snake);

    // the head closing on the tail: a skull and an open jaw, both along the tangent
    const head = new SphereGeometry(1, 24, 16);
    this.#geometries.push(head);
    const tangent = end + Math.PI / 2;
    for (const [scale, offset, out] of [
      [[24, 15, 13], 0.02, 3],
      [[19, 7, 8], 0.1, -9],
    ] as const) {
      const part = new Mesh(head, surface);
      const theta = end + offset;
      part.position.set(Math.cos(theta) * (RING_R + out), Math.sin(theta) * (RING_R + out), 0);
      part.rotation.z = tangent;
      part.scale.set(scale[0], scale[1], scale[2]);
      part.name = 'head';
      this.#spinner.add(part);
    }
    this.#ouroboros.add(this.#spinner);

    // the sigil: twelve spikes out from the ring, long and short in turn, a little uneven
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rng.range(-0.03, 0.03);
      const long = i % 2 === 0;
      const length = (long ? 46 : 22) * rng.range(0.9, 1.1);
      const shape = new Shape();
      shape.moveTo(-5, 0);
      shape.lineTo(0, length);
      shape.lineTo(5, 0);
      shape.closePath();
      const geometry = new ExtrudeGeometry(shape, {depth: 3, bevelEnabled: false});
      geometry.translate(0, RING_R + 17, -1.5);
      this.#geometries.push(geometry);
      const spike = new Mesh(geometry, surface);
      spike.rotation.z = a - Math.PI / 2;
      spike.name = 'spike';
      this.#ouroboros.add(spike);
    }

    // the eye in the middle: an almond that opens into the whole disc, a slit pupil that closes
    const disc = new CircleGeometry(RING_R, 128);
    this.#geometries.push(disc);
    const eyeMaterial = new MeshBasicNodeMaterial({transparent: true, side: DoubleSide, depthWrite: false, depthTest: false});
    const q = uv().sub(0.5).mul(2);
    const open = this.#eyeOpen;
    // the lids: a pointed almond while the eye opens, the whole circle once it is open
    const lid = open.mul(pow(float(1).sub(q.x.mul(q.x)).max(0), mix(float(1), float(0.5), open)));
    const lidEdge = lid.sub(abs(q.y));
    const lidCover = smoothstep(fwidth(lidEdge).negate(), fwidth(lidEdge), lidEdge);
    const pupilEdge = this.#pupil.mul(float(1).sub(q.y.mul(q.y)).max(0).sqrt()).sub(abs(q.x));
    const pupilCover = smoothstep(fwidth(pupilEdge).negate(), fwidth(pupilEdge), pupilEdge);
    const alpha = lidCover.mul(float(1).sub(pupilCover));
    eyeMaterial.colorNode = vec4(vec3(1), alpha);
    this.#materials.push(eyeMaterial);
    const eye = new Mesh(disc, eyeMaterial);
    eye.position.z = -2;
    eye.name = 'eye';
    this.#ouroboros.add(eye);
  }

  #pose(p: number): void {
    this.progress.value = p;
    if (this.#shatter.visible) this.#poseShatter(p);
    if (this.#ouroboros.visible) this.#poseOuroboros(p);
  }

  #poseShatter(p: number): void {
    for (let i = 0; i < this.#shards.length; i++) {
      const s = this.#shards[i]!;
      const mesh = s.mesh;
      if (p < s.crackAt) {
        mesh.visible = false;
        continue;
      }
      // the crack reaches it: it turns over, from edge on into the reflection
      const turned = easeOut(clamp01((p - s.crackAt) / TURN));
      qTurn.setFromAxisAngle(s.turnAxis, (1 - turned) * 1.45);
      const f = (p - s.launchAt) / FLIGHT;
      if (f <= 0) {
        mesh.visible = true;
        mesh.position.set(s.cx, s.cy, 0);
        mesh.quaternion.copy(qTurn);
        continue;
      }
      // loose: it tumbles at the camera faster and faster, drifting away from the impact
      const z = (CAM_Z + 150) * f ** 2;
      if (z > CAM_Z - 4) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const drift = f ** 1.3;
      mesh.position.set(s.cx + s.dx * drift, s.cy + s.dy * drift, z);
      qTumble.setFromAxisAngle(s.tumbleAxis, s.spin * f);
      mesh.quaternion.multiplyQuaternions(qTumble, qTurn);
    }
    for (let i = 0; i < this.#panes.length; i++) {
      const pane = this.#panes[i]!;
      const u = (p - pane.startAt) / PANE_SWING;
      if (u <= 0) {
        pane.mesh.visible = false;
        continue;
      }
      // it swings shut from edge on, falling back into the wall from a little in front of it
      const e = easeOut(clamp01(u));
      pane.mesh.visible = true;
      pane.mesh.position.set(pane.cx, pane.cy, (1 - e) * 140);
      pane.mesh.quaternion.setFromAxisAngle(pane.axis, (1 - e) * 1.52);
    }
  }

  #poseOuroboros(p: number): void {
    // the distance shrinks by the same factor in every step of the progress: it grows steadily,
    // and covers the screen a little before the end
    const distance = RING_FAR * (RING_NEAR / RING_FAR) ** p;
    const [cx, cy] = this.#ringCentre;
    const centre = 1 - clamp01(p / 0.85) ** 2;
    this.#ouroboros.position.set(cx * centre, cy * centre, CAM_Z - distance);
    const facing = easeOut(clamp01(p / 0.75));
    this.#ouroboros.rotation.set((1 - facing) * 1.1, (1 - facing) * 1.3, (1 - facing) * 0.4);
    this.#spinner.rotation.z = -p * Math.PI * 3;
    // the eye opens through the middle of the run, the pupil narrows to nothing towards its end
    this.#eyeOpen.value = easeOut(clamp01((p - 0.12) / 0.5));
    this.#pupil.value = 0.22 * (1 - clamp01((p - 0.45) / 0.4));
  }

  dispose(): void {
    this.stage.dispose();
    this.scene3d.dispose();
    this.#glow?.dispose();
    this.#pipeline?.dispose();
    for (const geometry of this.#geometries) geometry.dispose();
    for (const material of this.#materials) material.dispose();
  }
}
