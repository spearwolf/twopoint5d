import {
  Camera,
  Color,
  DoubleSide,
  FloatType,
  Group,
  Matrix4,
  NoBlending,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  type Renderer,
  RenderTarget,
  Texture,
  WebGLCoordinateSystem,
  WebGPUCoordinateSystem,
} from 'three/webgpu';
import {float} from 'three/tsl';
import {describe, expect, expectTypeOf, test, vi} from 'vitest';

import {graphSignature} from '../testing/spriteGraph.js';
import {pickOutputOf, setReversedDepth} from '../testing/threeInternals.js';
import {defineSprite} from './defineSprite.js';
import {BillboardPlacement} from './features/BillboardPlacement.js';
import {FlatPlacement} from './features/FlatPlacement.js';
import {InstancePosition} from './features/InstancePosition.js';
import {QuadSize} from './features/QuadSize.js';
import {TextureColor} from './features/TextureColor.js';
import {FeatureSprites} from './FeatureSprites/FeatureSprites.js';
import {FeatureSpritesGeometry} from './FeatureSprites/FeatureSpritesGeometry.js';
import {FeatureSpritesMaterial} from './FeatureSprites/FeatureSpritesMaterial.js';
import {ShadowPass} from './passes/passPresets.js';
import {TexturedSpriteKind} from './presets.js';
import {QuadBase} from './SpriteBase.js';
import {type SpritePick, SpritePicker} from './SpritePicker.js';

const DotKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TextureColor]});

interface Rendered {
  children: Object3D[];
  projection: Matrix4;
  matrixWorld: Matrix4;
  matrixWorldInverse: Matrix4;
  layers: number;
  coordinateSystem: number;
  target: RenderTarget | null;
  mrt: unknown;
  clear: [string, number];
  autoClear: boolean[];
}

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
};

/**
 * A renderer of three as the picker sees it: it records each render and answers the read back with
 * `pixel`, or with what a test hands `readBack`. Its render prepares a camera of the wrong depth
 * convention as three does.
 */
function makeRenderer() {
  const rendered: Rendered[] = [];
  const state = {
    initialized: true,
    coordinateSystem: WebGPUCoordinateSystem as number,
    reversedDepthBuffer: false,
    autoClear: false,
    autoClearColor: false,
    autoClearDepth: false,
    autoClearStencil: false,
    target: null as RenderTarget | null,
    cubeFace: 0,
    mipmapLevel: 0,
    mrt: null as unknown,
    clearColor: new Color(0.25, 0.5, 0.75),
    clearAlpha: 0.5,
    drawingBuffer: [64, 32] as [number, number],
    pixel: [0, 0, 0, 0],
    renderError: undefined as Error | undefined,
    readBack: undefined as Promise<Float32Array> | undefined,
  };
  const renderer = {
    get initialized() {
      return state.initialized;
    },
    init: vi.fn(async () => {
      state.initialized = true;
    }),
    get coordinateSystem() {
      return state.coordinateSystem;
    },
    get reversedDepthBuffer() {
      return state.reversedDepthBuffer;
    },
    get autoClear() {
      return state.autoClear;
    },
    set autoClear(value: boolean) {
      state.autoClear = value;
    },
    get autoClearColor() {
      return state.autoClearColor;
    },
    set autoClearColor(value: boolean) {
      state.autoClearColor = value;
    },
    get autoClearDepth() {
      return state.autoClearDepth;
    },
    set autoClearDepth(value: boolean) {
      state.autoClearDepth = value;
    },
    get autoClearStencil() {
      return state.autoClearStencil;
    },
    set autoClearStencil(value: boolean) {
      state.autoClearStencil = value;
    },
    getRenderTarget: () => state.target,
    getActiveCubeFace: () => state.cubeFace,
    getActiveMipmapLevel: () => state.mipmapLevel,
    setRenderTarget(target: RenderTarget | null, cubeFace = 0, mipmapLevel = 0) {
      state.target = target;
      state.cubeFace = cubeFace;
      state.mipmapLevel = mipmapLevel;
    },
    getMRT: () => state.mrt,
    setMRT(mrt: unknown) {
      state.mrt = mrt;
    },
    getClearColor: (target: Color) => target.copy(state.clearColor),
    getClearAlpha: () => state.clearAlpha,
    setClearColor(color: Color | number, alpha = 1) {
      state.clearColor = new Color(color);
      state.clearAlpha = alpha;
    },
    getDrawingBufferSize: (target: {set(x: number, y: number): unknown}) => target.set(...state.drawingBuffer),
    render(scene: Object3D, camera: Camera) {
      if (state.reversedDepthBuffer && !camera.reversedDepth) {
        setReversedDepth(camera, true);
        (camera as unknown as {updateProjectionMatrix(): void}).updateProjectionMatrix();
      }
      rendered.push({
        children: [...scene.children],
        projection: camera.projectionMatrix.clone(),
        matrixWorld: camera.matrixWorld.clone(),
        matrixWorldInverse: camera.matrixWorldInverse.clone(),
        layers: camera.layers.mask,
        coordinateSystem: camera.coordinateSystem,
        target: state.target,
        mrt: state.mrt,
        clear: [state.clearColor.getHexString(), state.clearAlpha],
        autoClear: [state.autoClear, state.autoClearColor, state.autoClearDepth, state.autoClearStencil],
      });
      if (state.renderError) throw state.renderError;
    },
    readRenderTargetPixelsAsync: vi.fn(
      (_target: RenderTarget, _x: number, _y: number, _w: number, _h: number) =>
        state.readBack ?? Promise.resolve(new Float32Array(state.pixel)),
    ),
  };
  return {renderer: renderer as unknown as Renderer, state, rendered, fake: renderer};
}

const makeCamera = () => {
  const camera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
  camera.position.z = 10;
  camera.coordinateSystem = WebGPUCoordinateSystem;
  camera.updateProjectionMatrix();
  return camera;
};

function makeSprites(count: number, options = {}) {
  const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: count, ...options});
  const all = Array.from({length: count}, (_, i) => {
    const sprite = sprites.createSprite()!;
    sprite.setPosition(i, 0, 0);
    return sprite;
  });
  return {sprites, all};
}

const center = {x: 0, y: 0};

// the matrix that blows the pixel under `center` up to the target: the pixel (32, 16) of the drawing
// buffer of 64 × 32, whose centre is (0.015625, 0.03125)
const centerPixel = () => {
  const [w, h, cx, cy] = [64, 32, (32.5 / 64) * 2 - 1, (16.5 / 32) * 2 - 1];
  return new Matrix4().set(w, 0, 0, -w * cx, 0, h, 0, -h * cy, 0, 0, 1, 0, 0, 0, 0, 1);
};

const expectCloseTo = (actual: Matrix4, expected: Matrix4) => {
  actual.elements.forEach((value, i) => expect(value, `element ${i}`).toBeCloseTo(expected.elements[i]!, 12));
};

describe('SpritePicker', () => {
  describe('pick() refuses', () => {
    test('a camera that is no three.js camera', async () => {
      const {renderer} = makeRenderer();
      const picker = new SpritePicker(renderer);
      await expect(picker.pick(null as unknown as Camera, center, [])).rejects.toThrow(
        new TypeError('SpritePicker#pick(): the camera is no three.js Camera, got null'),
      );
      await expect(picker.pick({} as Camera, center, [])).rejects.toThrow(
        new TypeError('SpritePicker#pick(): the camera is no three.js Camera, got {}'),
      );
      await expect(picker.pick(new Group() as unknown as Camera, center, [])).rejects.toThrow(
        new TypeError('SpritePicker#pick(): the camera is no three.js Camera, got Group'),
      );
    });

    test('a pointer that is no point of the view', async () => {
      const {renderer} = makeRenderer();
      const picker = new SpritePicker(renderer);
      await expect(picker.pick(makeCamera(), {x: Number.NaN, y: 0}, [])).rejects.toThrow(
        new TypeError(
          'SpritePicker#pick(): the pointer is {x, y} in normalized device coordinates, -1 to 1 — got {x: NaN, y: 0}',
        ),
      );
      await expect(picker.pick(makeCamera(), {x: 0, y: Infinity}, [])).rejects.toThrow(TypeError);
      await expect(picker.pick(makeCamera(), null as unknown as {x: number; y: number}, [])).rejects.toThrow('got null');
      await expect(picker.pick(makeCamera(), {x: '0', y: 0} as unknown as {x: number; y: number}, [])).rejects.toThrow(
        'got {x: "0", y: 0}',
      );
      await expect(picker.pick(makeCamera(), 5 as unknown as {x: number; y: number}, [])).rejects.toThrow('got 5');
    });

    test('reads x and y of the pointer once, for the check, the message and the pick', async () => {
      const {renderer} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      const countingPointer = (x: number, y: number) => {
        const reads = {x: 0, y: 0};
        const pointer = {
          get x() {
            reads.x++;
            return x;
          },
          get y() {
            reads.y++;
            return y;
          },
        };
        return {pointer, reads};
      };

      const valid = countingPointer(0, 0);
      await picker.pick(makeCamera(), valid.pointer, [sprites]);
      expect(valid.reads).toEqual({x: 1, y: 1});

      const refused = countingPointer(Number.NaN, 0);
      await expect(picker.pick(makeCamera(), refused.pointer, [sprites])).rejects.toThrow(
        new TypeError(
          'SpritePicker#pick(): the pointer is {x, y} in normalized device coordinates, -1 to 1 — got {x: NaN, y: 0}',
        ),
      );
      expect(refused.reads).toEqual({x: 1, y: 1});

      sprites.dispose();
      picker.dispose();
    });

    test('a list that is no array, and an entry that is no FeatureSprites', async () => {
      const {renderer} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      await expect(picker.pick(makeCamera(), center, sprites as unknown as FeatureSprites[])).rejects.toThrow(
        new TypeError('SpritePicker#pick(): takes a list of FeatureSprites, got Mesh — pick(camera, pointer, [sprites])'),
      );
      await expect(picker.pick(makeCamera(), center, undefined as unknown as FeatureSprites[])).rejects.toThrow(
        new TypeError('SpritePicker#pick(): takes a list of FeatureSprites, got undefined — pick(camera, pointer, [sprites])'),
      );
      await expect(picker.pick(makeCamera(), center, [sprites, new Group() as unknown as FeatureSprites])).rejects.toThrow(
        new TypeError(
          'SpritePicker#pick(): the entry 1 of the list is no FeatureSprites, got Group — the picker draws FeatureSprites alone',
        ),
      );
      await expect(picker.pick(makeCamera(), center, [sprites, 5 as unknown as FeatureSprites])).rejects.toThrow(
        new TypeError(
          'SpritePicker#pick(): the entry 1 of the list is no FeatureSprites, got 5 — the picker draws FeatureSprites alone',
        ),
      );
      sprites.dispose();
    });

    test('invalid arguments once disposed as well', async () => {
      const {renderer} = makeRenderer();
      const picker = new SpritePicker(renderer);
      picker.dispose();
      await expect(picker.pick(makeCamera(), {x: Number.NaN, y: 0}, [])).rejects.toThrow(TypeError);
    });
  });

  test('refuses a mesh of more sprites than the float target names exactly, before it draws', async () => {
    const {renderer, rendered} = makeRenderer();
    const picker = new SpritePicker(renderer);
    const {sprites} = makeSprites(1);
    vi.spyOn(sprites.spritePool!, 'usedCount', 'get').mockReturnValue(2 ** 24 + 1);

    await expect(picker.pick(makeCamera(), center, [sprites])).rejects.toThrow(
      new RangeError(
        'SpritePicker#pick(): the entry 0 of the list holds 16777217 sprites, and the float target names a slot exactly up to 16777216 — split the sprites into meshes of at most 16777216',
      ),
    );
    expect(rendered).toHaveLength(0);
    sprites.dispose();
    picker.dispose();
  });

  test('a refused pick gives back the handles and the pick meshes of the entries before the one it refuses', async () => {
    const {renderer, rendered} = makeRenderer();
    const picker = new SpritePicker(renderer);
    const a = makeSprites(1).sprites;
    const b = makeSprites(1).sprites;
    const taken: unknown[][] = [];
    const copyVOsInto = a.spritePool!.copyVOsInto.bind(a.spritePool!);
    vi.spyOn(a.spritePool!, 'copyVOsInto').mockImplementation((into) => {
      taken.push(into);
      return copyVOsInto(into);
    });

    await picker.pick(makeCamera(), center, [a]);
    const pickMesh = rendered[0]!.children[0]!;
    const first = taken[0];

    vi.spyOn(b.spritePool!, 'usedCount', 'get').mockReturnValue(2 ** 24 + 1);
    await expect(picker.pick(makeCamera(), center, [a, b])).rejects.toThrow(RangeError);
    expect(pickMesh.parent, 'the pick mesh of the entry before the refused one').toBeNull();

    await picker.pick(makeCamera(), center, [a]);
    expect(taken.at(-1), 'the handle array the refused pick gave back').toBe(first);

    a.dispose();
    b.dispose();
    picker.dispose();
  });

  test('a pick whose copy of the handles throws gives the handle array back', async () => {
    const {renderer} = makeRenderer();
    const picker = new SpritePicker(renderer);
    const a = makeSprites(1).sprites;
    const taken: unknown[][] = [];
    const copyVOsInto = a.spritePool!.copyVOsInto.bind(a.spritePool!);
    const copy = vi.spyOn(a.spritePool!, 'copyVOsInto').mockImplementation((into) => {
      taken.push(into);
      return copyVOsInto(into);
    });

    await picker.pick(makeCamera(), center, [a]);
    const first = taken[0];

    copy.mockImplementationOnce((into) => {
      taken.push(into);
      throw new Error('copy failed');
    });
    await expect(picker.pick(makeCamera(), center, [a])).rejects.toThrow('copy failed');
    expect(taken.at(-1), 'the throwing copy was handed the spare array').toBe(first);

    await picker.pick(makeCamera(), center, [a]);
    expect(taken.at(-1), 'the handle array the throwing copy took').toBe(first);

    a.dispose();
    picker.dispose();
  });

  describe('draws nothing and answers undefined', () => {
    test('for a pointer outside the view', async () => {
      const {renderer, rendered, fake} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      for (const pointer of [
        {x: -1.01, y: 0},
        {x: 1.01, y: 0},
        {x: 0, y: -1.01},
        {x: 0, y: 1.01},
      ]) {
        expect(await picker.pick(makeCamera(), pointer, [sprites])).toBeUndefined();
      }
      expect(rendered).toHaveLength(0);
      expect(fake.readRenderTargetPixelsAsync).not.toHaveBeenCalled();
      sprites.dispose();
    });

    test('for an empty list, and for meshes that are disposed, hidden, under a hidden parent or empty', async () => {
      const {renderer, rendered} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const disposed = makeSprites(1).sprites;
      disposed.dispose();
      const hidden = makeSprites(1).sprites;
      hidden.visible = false;
      const underHidden = makeSprites(1).sprites;
      const parent = new Group();
      parent.visible = false;
      parent.add(underHidden);
      const empty = new FeatureSprites(TexturedSpriteKind, {capacity: 1});

      expect(await picker.pick(makeCamera(), center, [])).toBeUndefined();
      expect(await picker.pick(makeCamera(), center, [disposed, hidden, underHidden, empty])).toBeUndefined();

      expect(rendered).toHaveLength(0);
      for (const sprites of [hidden, underHidden, empty]) sprites.dispose();
    });

    test('for a mesh whose material is not visible, and draws the others of the list', async () => {
      const {renderer, rendered} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const hidden = makeSprites(1).sprites;
      hidden.material!.visible = false;
      const shown = makeSprites(1).sprites;

      expect(await picker.pick(makeCamera(), center, [hidden])).toBeUndefined();
      expect(rendered).toHaveLength(0);

      await picker.pick(makeCamera(), center, [hidden, shown]);
      expect(rendered[0]!.children).toHaveLength(1);
      expect((rendered[0]!.children[0] as unknown as {geometry: unknown}).geometry).toBe(shown.geometry);
      hidden.dispose();
      shown.dispose();
      picker.dispose();
    });
  });

  test('draws the meshes left in the list, each once, and answers the sprite of the pixel', async () => {
    const {renderer, rendered, state} = makeRenderer();
    const picker = new SpritePicker(renderer);
    const disposed = makeSprites(1).sprites;
    disposed.dispose();
    const first = makeSprites(2);
    const second = makeSprites(3);
    // the slot 2 of the mesh at the place 3 of the list
    state.pixel = [3, 3, 0, 1];

    const hit = await picker.pick(makeCamera(), center, [disposed, first.sprites, second.sprites, first.sprites]);

    expect(hit).toEqual({sprites: second.sprites, sprite: second.all[2], index: 2});
    expect(rendered).toHaveLength(1);
    expect(rendered[0]!.children).toHaveLength(2);
    // every pick mesh draws the geometry of its sprites with a pick material of its kind
    const [a, b] = rendered[0]!.children as unknown as {geometry: unknown; material: FeatureSpritesMaterial}[];
    expect(a!.geometry).toBe(first.sprites.geometry);
    expect(b!.geometry).toBe(second.sprites.geometry);
    expect(a!.material).toBeInstanceOf(FeatureSpritesMaterial);
    expect(a!.material.kind).toBe(TexturedSpriteKind);
    first.sprites.dispose();
    second.sprites.dispose();
    picker.dispose();
  });

  describe('the answer', () => {
    test('is undefined for an empty pixel, for a mesh number or a slot nothing was drawn at', async () => {
      const {renderer, state} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(2);
      const pick = () => picker.pick(makeCamera(), center, [sprites]);

      state.pixel = [0, 0, 0, 0];
      expect(await pick()).toBeUndefined();
      state.pixel = [1, 2, 0, 1];
      expect(await pick()).toBeUndefined();
      state.pixel = [3, 1, 0, 1];
      expect(await pick()).toBeUndefined();
      // read back as floats, rounded to the whole numbers they stand for
      state.pixel = [1.9999, 1.0001, 0, 1];
      expect((await pick())?.index).toBe(1);
      sprites.dispose();
      picker.dispose();
    });

    test('is the handle drawn under the pointer, whatever moved its slot before the read back', async () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const {renderer, state} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites, all} = makeSprites(3, {grow: true});
      all.forEach((sprite, i) => sprite.setPosition(0, 3 - i, 0));
      const pending = deferred<Float32Array>();
      state.readBack = pending.promise;

      const picked = picker.pick(makeCamera(), center, [sprites]);
      // the slot 0 held the first sprite at the draw; a sort and a growth move it before the read back
      sprites.sortBy('y');
      sprites.createSprite();
      expect(sprites.spritePool!.getVO(0)).toBe(all[2]);
      pending.resolve(new Float32Array([1, 1, 0, 1]));

      expect(await picked).toEqual({sprites, sprite: all[0], index: 0});
      sprites.dispose();
      picker.dispose();
    });

    test('is undefined for a sprite freed, or a mesh disposed, before the read back', async () => {
      const {renderer, state} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites, all} = makeSprites(2);
      const freed = deferred<Float32Array>();
      state.readBack = freed.promise;
      const picked = picker.pick(makeCamera(), center, [sprites]);
      sprites.freeSprite(all[0]!);
      freed.resolve(new Float32Array([1, 1, 0, 1]));
      expect(await picked).toBeUndefined();

      const gone = deferred<Float32Array>();
      state.readBack = gone.promise;
      const pickedGone = picker.pick(makeCamera(), center, [sprites]);
      sprites.dispose();
      gone.resolve(new Float32Array([1, 1, 0, 1]));
      expect(await pickedGone).toBeUndefined();
      picker.dispose();
    });

    test('is taken from a copy of the handles, without a look-up of each slot', async () => {
      const {renderer, state} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites, all} = makeSprites(3);
      const getVO = vi.spyOn(sprites.spritePool!, 'getVO');
      state.pixel = [2, 1, 0, 1];

      expect(await picker.pick(makeCamera(), center, [sprites])).toEqual({sprites, sprite: all[1], index: 1});
      expect(getVO).not.toHaveBeenCalled();
      sprites.dispose();
      picker.dispose();
    });

    test('gives a sprite without a handle its handle when the pick hits it, and nothing once the slots have moved since the draw', async () => {
      const {renderer, state} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 3});
      const pool = sprites.spritePool!;
      pool.createFromAttributes({instancePosition: [0, 0, 0, 1, 0, 0, 2, 0, 0]});
      const hook = vi.fn();
      pool.onCreateVO = hook;
      state.pixel = [2, 1, 0, 1];

      const hit = await picker.pick(makeCamera(), center, [sprites]);
      expect(hit?.index).toBe(1);
      expect(hit?.sprite).toBe(pool.getVO(1));
      expect(hook).toHaveBeenCalledOnce();

      // the slot 0 holds no handle at the draw; a sort moves the slots before the read back
      const pending = deferred<Float32Array>();
      state.readBack = pending.promise;
      const picked = picker.pick(makeCamera(), center, [sprites]);
      expect(sprites.sortBy('x', {descending: true})).toBe(true);
      pending.resolve(new Float32Array([1, 1, 0, 1]));
      expect(await picked).toBeUndefined();
      expect(hook).toHaveBeenCalledOnce();
      sprites.dispose();
      picker.dispose();
    });

    test('carries the type of the kinds listed', async () => {
      const {renderer} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const textured = new FeatureSprites(TexturedSpriteKind, {capacity: 1});
      const dots = new FeatureSprites(DotKind, {capacity: 1});

      const hit = await picker.pick(makeCamera(), center, [textured, dots]);

      type TexturedApi = NonNullable<(typeof TexturedSpriteKind)['__api']>;
      type DotApi = NonNullable<(typeof DotKind)['__api']>;
      expectTypeOf(hit).toEqualTypeOf<SpritePick<TexturedApi> | SpritePick<DotApi> | undefined>();
      textured.dispose();
      dots.dispose();
    });
  });

  describe('the pixel under the pointer', () => {
    test('is the projection of the camera blown up to the pixel the pointer lies in, its view and layers kept', async () => {
      const {renderer, rendered} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      const camera = makeCamera();
      camera.position.set(1, 2, 10);
      camera.layers.set(3);

      await picker.pick(camera, {x: 0.1, y: -0.3}, [sprites]);

      // a drawing buffer of 64 × 32: the pixel (35, 11), whose centre is (0.109375, -0.28125)
      const [w, h, cx, cy] = [64, 32, (35.5 / 64) * 2 - 1, (11.5 / 32) * 2 - 1];
      expect([cx, cy]).toEqual([0.109375, -0.28125]);
      const pixel = new Matrix4().set(w, 0, 0, -w * cx, 0, h, 0, -h * cy, 0, 0, 1, 0, 0, 0, 0, 1);
      const {projection, matrixWorld, matrixWorldInverse, layers} = rendered[0]!;
      expect(projection.elements).toEqual(pixel.multiply(camera.projectionMatrix).elements);
      expect(matrixWorld.elements).toEqual(camera.matrixWorld.elements);
      expect(matrixWorldInverse.elements).toEqual(camera.matrixWorldInverse.elements);
      expect(layers).toBe(camera.layers.mask);
      sprites.dispose();
      picker.dispose();
    });

    test('lies within the drawing buffer at its edges, and within a drawing buffer of no pixels', async () => {
      const {renderer, rendered, state} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      const camera = makeCamera();

      await picker.pick(camera, {x: 1, y: 1}, [sprites]);
      state.drawingBuffer = [0, 0];
      await picker.pick(camera, {x: -1, y: 1}, [sprites]);

      // the last pixel (63, 31) for the corner, and the one pixel of a buffer taken as 1 × 1
      const corner = new Matrix4().set(64, 0, 0, -64 * (63.5 / 32 - 1), 0, 32, 0, -32 * (31.5 / 16 - 1), 0, 0, 1, 0, 0, 0, 0, 1);
      expect(rendered[0]!.projection.elements).toEqual(corner.multiply(camera.projectionMatrix).elements);
      expect(rendered[1]!.projection.elements).toEqual(camera.projectionMatrix.elements);
      sprites.dispose();
      picker.dispose();
    });

    test('prepares the coordinate system of a camera as the renderer would, and leaves its depth convention alone', async () => {
      const {renderer, rendered, state} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      const camera = new PerspectiveCamera(60, 1, 0.1, 100);
      camera.coordinateSystem = WebGLCoordinateSystem;
      camera.updateProjectionMatrix();
      const update = vi.spyOn(camera, 'updateProjectionMatrix');

      await picker.pick(camera, center, [sprites]);
      expect(camera.coordinateSystem).toBe(WebGPUCoordinateSystem);
      expect(update).toHaveBeenCalledOnce();
      expect(rendered[0]!.coordinateSystem).toBe(WebGPUCoordinateSystem);

      state.reversedDepthBuffer = true;
      await picker.pick(camera, center, [sprites]);
      expect(camera.reversedDepth).toBe(false);
      expect(update).toHaveBeenCalledOnce();
      // three's own projection onto a reversed depth buffer, blown up to the pixel under the pointer
      const reference = camera.clone();
      setReversedDepth(reference, true);
      reference.updateProjectionMatrix();
      expectCloseTo(rendered[1]!.projection, centerPixel().multiply(reference.projectionMatrix));

      // a camera without a projection of its own to update keeps the one it has
      const plain = new Camera();
      plain.projectionMatrix.copy(camera.projectionMatrix);
      await expect(picker.pick(plain, center, [sprites])).resolves.toBeUndefined();
      expect(plain.coordinateSystem).toBe(WebGPUCoordinateSystem);
      sprites.dispose();
      picker.dispose();
    });

    const makePerspective = () => new PerspectiveCamera(60, 1, 0.1, 100);
    const makeOrthographic = () => new OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    test.each([
      ['perspective', 'WebGPU', WebGPUCoordinateSystem, makePerspective],
      ['orthographic', 'WebGPU', WebGPUCoordinateSystem, makeOrthographic],
      ['perspective', 'WebGL', WebGLCoordinateSystem, makePerspective],
      ['orthographic', 'WebGL', WebGLCoordinateSystem, makeOrthographic],
    ] as const)(
      'turns the projection to a reversed depth buffer as three builds it, %s under %s',
      async (_kind, _name, cs, make) => {
        const {renderer, rendered, state} = makeRenderer();
        state.coordinateSystem = cs;
        state.reversedDepthBuffer = true;
        const picker = new SpritePicker(renderer);
        const {sprites} = makeSprites(1);
        const camera = make();
        camera.position.z = 10;
        camera.coordinateSystem = cs;
        camera.updateProjectionMatrix();

        await picker.pick(camera, center, [sprites]);

        const reference = camera.clone();
        setReversedDepth(reference, true);
        reference.updateProjectionMatrix();
        expectCloseTo(rendered[0]!.projection, centerPixel().multiply(reference.projectionMatrix));
        expect(camera.reversedDepth).toBe(false);
        sprites.dispose();
        picker.dispose();
      },
    );

    test('takes the projection of a camera three has prepared for a reversed depth buffer as it is', async () => {
      const {renderer, rendered, state} = makeRenderer();
      state.reversedDepthBuffer = true;
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      const camera = makeCamera();
      setReversedDepth(camera, true);
      camera.updateProjectionMatrix();
      const update = vi.spyOn(camera, 'updateProjectionMatrix');

      await picker.pick(camera, center, [sprites]);

      expect(rendered[0]!.projection.elements).toEqual(centerPixel().multiply(camera.projectionMatrix).elements);
      expect(update).not.toHaveBeenCalled();
      sprites.dispose();
      picker.dispose();
    });
  });

  describe('the renderer', () => {
    test('draws into a one-pixel float target, without MRT, cleared to nothing, and is left as it was', async () => {
      const {renderer, rendered, state, fake} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      const own = new RenderTarget(8, 8);
      state.target = own;
      state.cubeFace = 2;
      state.mipmapLevel = 1;
      const mrt = {isMRTNode: true};
      state.mrt = mrt;

      await picker.pick(makeCamera(), center, [sprites]);

      const {target, mrt: mrtWhileDrawn, clear, autoClear} = rendered[0]!;
      expect(target).toBeInstanceOf(RenderTarget);
      expect([target!.width, target!.height, target!.texture.type, target!.depthBuffer]).toEqual([1, 1, FloatType, true]);
      expect(mrtWhileDrawn).toBeNull();
      expect(clear).toEqual(['000000', 0]);
      expect(autoClear).toEqual([true, true, true, true]);
      expect(fake.readRenderTargetPixelsAsync).toHaveBeenCalledWith(target, 0, 0, 1, 1);
      // as it was before
      expect([state.target, state.cubeFace, state.mipmapLevel, state.mrt]).toEqual([own, 2, 1, mrt]);
      expect([state.clearColor.getHexString(), state.clearAlpha]).toEqual([new Color(0.25, 0.5, 0.75).getHexString(), 0.5]);
      expect([state.autoClear, state.autoClearColor, state.autoClearDepth, state.autoClearStencil]).toEqual([
        false,
        false,
        false,
        false,
      ]);

      // one target for every pick
      await picker.pick(makeCamera(), center, [sprites]);
      expect(rendered[1]!.target).toBe(target);
      own.dispose();
      sprites.dispose();
      picker.dispose();
    });

    test('is left as it was when the render throws, and the pick rejects with the error', async () => {
      const {renderer, state} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      state.renderError = new Error('device lost');

      await expect(picker.pick(makeCamera(), center, [sprites])).rejects.toThrow('device lost');

      expect(state.target).toBeNull();
      expect(state.clearAlpha).toBe(0.5);
      expect(state.autoClear).toBe(false);
      sprites.dispose();
      picker.dispose();
    });

    test('is initialized first when it is not', async () => {
      const {renderer, state, rendered, fake} = makeRenderer();
      state.initialized = false;
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);

      await picker.pick(makeCamera(), center, [sprites]);

      expect(fake.init).toHaveBeenCalledOnce();
      expect(rendered).toHaveLength(1);
      sprites.dispose();
      picker.dispose();
    });

    test('takes the pointer and the list as they are at the call, while the renderer initializes', async () => {
      const {renderer, state, rendered, fake} = makeRenderer();
      state.initialized = false;
      const init = deferred<void>();
      fake.init.mockImplementation(() => init.promise);
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      const other = makeSprites(1).sprites;
      const camera = makeCamera();
      const pointer = {x: 0.1, y: -0.3};
      const list: (typeof sprites)[] = [sprites];

      const picked = picker.pick(camera, pointer, list);
      // a caller that reuses its pointer and its list
      pointer.x = 0.9;
      pointer.y = 0.9;
      list[0] = other;
      list.push(new Group() as unknown as typeof sprites);
      init.resolve();
      await picked;

      expect(rendered).toHaveLength(1);
      const {children, projection} = rendered[0]!;
      expect(children).toHaveLength(1);
      expect((children[0] as unknown as {geometry: unknown}).geometry).toBe(sprites.geometry);
      // the pixel (35, 11) of the drawing buffer of 64 × 32, under the pointer as it was at the call
      const [w, h, cx, cy] = [64, 32, 0.109375, -0.28125];
      const pixel = new Matrix4().set(w, 0, 0, -w * cx, 0, h, 0, -h * cy, 0, 0, 1, 0, 0, 0, 0, 1);
      expect(projection.elements).toEqual(pixel.multiply(camera.projectionMatrix).elements);
      sprites.dispose();
      other.dispose();
      picker.dispose();
    });
  });

  describe('the pick material', () => {
    test('is the graph of the kind on the resources of the mesh, then the id as its output', async () => {
      const {renderer, rendered} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const colorMap = new Texture();
      const {sprites} = makeSprites(1, {textures: {colorMap}, transparent: true, placement: BillboardPlacement});

      await picker.pick(makeCamera(), center, [sprites]);

      const material = (rendered[0]!.children[0] as unknown as {material: FeatureSpritesMaterial}).material;
      expect(material.resources).toBe(sprites.material!.resources);
      expect(material.getTexture('colorMap')).toBe(colorMap);
      expect(material.placement).toBe(BillboardPlacement);
      expect(graphSignature(material.positionNode!)).toBe(graphSignature(sprites.material!.positionNode!));
      expect(graphSignature(material.colorNode!)).toBe(graphSignature(sprites.material!.colorNode!));
      expect([material.blending, material.transparent, material.depthTest, material.depthWrite]).toEqual([
        NoBlending,
        false,
        true,
        true,
      ]);
      // the output is the slot + 1 out of instanceIndex, and the mesh number of the list
      const {readsInstanceIndex, meshNumber} = pickOutputOf(material.outputNode!);
      expect(readsInstanceIndex).toBe(true);
      expect(meshNumber?.value).toBe(1);
      sprites.dispose();
      colorMap.dispose();
      picker.dispose();
    });

    test('takes the fields that decide which fragments a sprite draws, before every pick', async () => {
      const {renderer, rendered} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1, {side: DoubleSide, alphaTest: 0.5});

      await picker.pick(makeCamera(), center, [sprites]);
      const material = (rendered[0]!.children[0] as unknown as {material: FeatureSpritesMaterial}).material;
      expect([material.side, material.alphaTest, material.alphaTestNode, material.opacity, material.alphaHash]).toEqual([
        DoubleSide,
        0.5,
        null,
        1,
        false,
      ]);
      expect([material.opacityNode, material.maskNode, material.alphaToCoverage]).toEqual([null, null, false]);

      const version = material.version;
      await picker.pick(makeCamera(), center, [sprites]);
      expect(material.version).toBe(version);
      sprites.material!.opacity = 0.25;
      const opacityNode = float(0.5);
      const maskNode = float(1);
      sprites.material!.opacityNode = opacityNode;
      sprites.material!.maskNode = maskNode;
      sprites.material!.alphaToCoverage = true;
      await picker.pick(makeCamera(), center, [sprites]);
      expect(material.opacity).toBe(0.25);
      expect([material.opacityNode, material.maskNode, material.alphaToCoverage]).toEqual([opacityNode, maskNode, true]);
      expect(material.version).toBeGreaterThan(version);
      sprites.dispose();
      picker.dispose();
    });

    test('is kept per mesh, numbered by the place of the mesh in each pick, and takes a swapped placement', async () => {
      const {renderer, rendered} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const a = makeSprites(1).sprites;
      const b = makeSprites(1).sprites;
      const numberOf = (child: Object3D) =>
        pickOutputOf((child as unknown as {material: FeatureSpritesMaterial}).material.outputNode!).meshNumber!;

      await picker.pick(makeCamera(), center, [a, b]);
      const [meshA, meshB] = rendered[0]!.children;
      expect([numberOf(meshA!).value, numberOf(meshB!).value]).toEqual([1, 2]);

      a.placement = BillboardPlacement;
      await picker.pick(makeCamera(), center, [b, a]);
      expect(rendered[1]!.children).toEqual([meshB, meshA]);
      expect([numberOf(meshB!).value, numberOf(meshA!).value]).toEqual([1, 2]);
      expect((meshA as unknown as {material: FeatureSpritesMaterial}).material.placement).toBe(BillboardPlacement);
      a.dispose();
      b.dispose();
      picker.dispose();
    });

    test('is built anew for a mesh whose material reads other resources', async () => {
      const {renderer, rendered} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      await picker.pick(makeCamera(), center, [sprites]);
      const first = rendered[0]!.children[0] as unknown as {material: FeatureSpritesMaterial};
      const firstDispose = vi.spyOn(first.material, 'dispose');
      const other = new FeatureSpritesMaterial(TexturedSpriteKind);
      sprites.material = other;

      await picker.pick(makeCamera(), center, [sprites]);

      const second = rendered[1]!.children[0] as unknown as {material: FeatureSpritesMaterial};
      expect(second).not.toBe(first);
      expect(second.material.resources).toBe(other.resources);
      expect(firstDispose).toHaveBeenCalledOnce();
      sprites.dispose();
      other.dispose();
      picker.dispose();
    });

    test('goes with the mesh it draws', async () => {
      const {renderer, rendered} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1, {passes: [ShadowPass]});
      await picker.pick(makeCamera(), center, [sprites]);
      const pickMesh = rendered[0]!.children[0] as unknown as Object3D & {material: FeatureSpritesMaterial};
      const materialDispose = vi.spyOn(pickMesh.material, 'dispose');
      const meshDisposed = vi.fn();
      pickMesh.addEventListener('dispose', meshDisposed);

      sprites.dispose();

      expect(materialDispose).toHaveBeenCalledOnce();
      expect(meshDisposed).toHaveBeenCalledOnce();
      picker.dispose();
      expect(materialDispose).toHaveBeenCalledOnce();
    });
  });

  test('the pick mesh follows the world matrix, the layers and the render order of the sprites, and is kept between picks', async () => {
    const {renderer, rendered} = makeRenderer();
    const picker = new SpritePicker(renderer);
    const {sprites} = makeSprites(1);
    const parent = new Group();
    parent.position.set(5, 0, 0);
    parent.add(sprites);
    sprites.rotation.z = 1;
    sprites.layers.set(4);
    sprites.renderOrder = 7;

    await picker.pick(makeCamera(), center, [sprites]);
    await picker.pick(makeCamera(), center, [sprites]);

    const mesh = rendered[1]!.children[0] as unknown as Object3D & {geometry: unknown};
    expect(mesh).toBe(rendered[0]!.children[0]);
    expect(mesh.geometry).toBe(sprites.geometry);
    expect(mesh.matrixWorld.elements).toEqual(sprites.matrixWorld.elements);
    expect(mesh.matrixWorld.elements[12]).toBe(5);
    expect([mesh.layers.mask, mesh.renderOrder, mesh.matrixAutoUpdate, mesh.frustumCulled]).toEqual([
      sprites.layers.mask,
      7,
      false,
      false,
    ]);
    sprites.dispose();
    picker.dispose();
  });

  test('a growth lets the pick mesh and its material go with the geometry it disposes, and the next pick builds them on the new one', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const {renderer, rendered} = makeRenderer();
    const picker = new SpritePicker(renderer);
    const {sprites} = makeSprites(1, {grow: true});
    await picker.pick(makeCamera(), center, [sprites]);
    const first = rendered[0]!.children[0] as unknown as Object3D & {material: FeatureSpritesMaterial; geometry: unknown};
    const materialDispose = vi.spyOn(first.material, 'dispose');
    const meshDisposed = vi.fn();
    first.addEventListener('dispose', meshDisposed);

    // the pool is full: the sprites grow, and dispose the geometry the pick mesh draws
    sprites.createSprite();

    expect(materialDispose).toHaveBeenCalledOnce();
    expect(meshDisposed).toHaveBeenCalledOnce();
    await picker.pick(makeCamera(), center, [sprites]);
    const next = rendered[1]!.children[0] as unknown as Object3D & {geometry: unknown};
    expect(next).not.toBe(first);
    expect(next.geometry).toBe(sprites.geometry);
    sprites.dispose();
    expect(materialDispose).toHaveBeenCalledOnce();
    picker.dispose();
  });

  test('a geometry put into the slot gets a pick mesh of its own, and the one before goes', async () => {
    const {renderer, rendered} = makeRenderer();
    const picker = new SpritePicker(renderer);
    const {sprites} = makeSprites(1);
    const other = new FeatureSpritesGeometry(TexturedSpriteKind, {capacity: 2});
    other.instancedPool.createVO();
    await picker.pick(makeCamera(), center, [sprites]);
    const first = rendered[0]!.children[0] as unknown as Object3D & {material: FeatureSpritesMaterial};
    const materialDispose = vi.spyOn(first.material, 'dispose');

    sprites.geometry = other;
    await picker.pick(makeCamera(), center, [sprites]);

    const next = rendered[1]!.children[0] as unknown as Object3D & {geometry: unknown};
    expect(next).not.toBe(first);
    expect(next.geometry).toBe(other);
    expect(materialDispose).toHaveBeenCalledOnce();
    // the geometry stays the caller's
    expect(() => {
      sprites.dispose();
      other.dispose();
    }).not.toThrow();
    picker.dispose();
  });

  describe('dispose()', () => {
    test('releases the target and every pick material, and pick() answers undefined afterwards', async () => {
      const {renderer, rendered} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      await picker.pick(makeCamera(), center, [sprites]);
      const target = rendered[0]!.target!;
      const targetDispose = vi.spyOn(target, 'dispose');
      const material = (rendered[0]!.children[0] as unknown as {material: FeatureSpritesMaterial}).material;
      const materialDispose = vi.spyOn(material, 'dispose');

      picker.dispose();
      picker.dispose();

      expect(picker.isDisposed).toBe(true);
      expect(targetDispose).toHaveBeenCalledOnce();
      expect(materialDispose).toHaveBeenCalledOnce();
      expect(await picker.pick(makeCamera(), center, [sprites])).toBeUndefined();
      expect(rendered).toHaveLength(1);
      // the picker listens to the mesh no more
      sprites.dispose();
      expect(materialDispose).toHaveBeenCalledOnce();
    });

    test('before any pick has nothing to release', () => {
      const picker = new SpritePicker(makeRenderer().renderer);
      expect(picker.isDisposed).toBe(false);
      expect(() => picker.dispose()).not.toThrow();
    });

    test('rejects a pick in flight, and a read back after it changes nothing', async () => {
      const {renderer, state} = makeRenderer();
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);
      const resolved = deferred<Float32Array>();
      state.readBack = resolved.promise;
      const first = picker.pick(makeCamera(), center, [sprites]);
      const failed = deferred<Float32Array>();
      state.readBack = failed.promise;
      const second = picker.pick(makeCamera(), center, [sprites]);

      picker.dispose();
      resolved.resolve(new Float32Array([1, 1, 0, 1]));
      failed.reject(new Error('device lost'));

      await expect(first).rejects.toThrow('SpritePicker#pick(): the picker was disposed before the pick was read back');
      await expect(second).rejects.toThrow('SpritePicker#pick(): the picker was disposed before the pick was read back');
      sprites.dispose();
    });

    test('rejects a pick that waits for the renderer to initialize, which then draws nothing', async () => {
      const {renderer, state, rendered, fake} = makeRenderer();
      state.initialized = false;
      const init = deferred<void>();
      fake.init.mockImplementation(() => init.promise);
      const picker = new SpritePicker(renderer);
      const {sprites} = makeSprites(1);

      const picked = picker.pick(makeCamera(), center, [sprites]);
      picker.dispose();
      init.resolve();

      await expect(picked).rejects.toThrow('disposed before the pick was read back');
      await Promise.resolve();
      expect(rendered).toHaveLength(0);
      sprites.dispose();
    });
  });
});
