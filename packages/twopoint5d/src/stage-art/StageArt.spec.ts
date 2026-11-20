import {readFileSync} from 'node:fs';
import {
  CanvasTexture,
  Group,
  ImageLoader,
  PerspectiveCamera,
  Plane,
  Quaternion,
  Texture,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu';
import {afterEach, describe, expect, expectTypeOf, test, vi} from 'vitest';

import {BillboardPlacement} from '../sprites/features/BillboardPlacement.js';
import {AtlasFrame} from '../sprites/features/AtlasFrame.js';
import {Flash, type FlashApi} from '../sprites/features/Flash.js';
import {Tint} from '../sprites/features/Tint.js';
import {CameraProjection} from '../stage/CameraProjection.js';
import {OrthographicProjection} from '../stage/OrthographicProjection.js';
import {ParallaxProjection} from '../stage/ParallaxProjection.js';
import {ProjectionPlane} from '../stage/ProjectionPlane.js';
import {AsepriteJson, type AsepriteJsonData} from '../texture/AsepriteJson.js';
import type {TextureAtlas} from '../texture/TextureAtlas.js';
import {type TexturePackerFrameData, TexturePackerJson, type TexturePackerJsonData} from '../texture/TexturePackerJson.js';
import {TextureStore} from '../texture/TextureStore.js';
import {FakeCanvas} from '../testing/fakeCanvas.js';
import type {ArtLayerDef} from './artSources.js';
import {artTrack} from './artTrack.js';
import type {StageArtSource} from './artOptions.js';
import {StageArt} from './StageArt.js';

// A canvas of 100 × 100, three layers bottom first: `back` at a depth of 50, the canvas whole; `box`,
// two frames — closed, trimmed to 20, 30, 40 × 20, and open, 20, 20, 40 × 30 —; `lamp`, 60, 10, 10 × 10
const CANVAS = {w: 100, h: 100};
const sceneJson = (): TexturePackerJsonData => ({
  frames: {
    'back@50': {
      frame: {x: 0, y: 0, w: 100, h: 100},
      trimmed: false,
      spriteSourceSize: {x: 0, y: 0, w: 100, h: 100},
      sourceSize: CANVAS,
    },
    box: {frame: {x: 100, y: 0, w: 40, h: 20}, trimmed: true, spriteSourceSize: {x: 20, y: 30, w: 40, h: 20}, sourceSize: CANVAS},
    'box-open': {
      frame: {x: 100, y: 20, w: 40, h: 30},
      trimmed: true,
      spriteSourceSize: {x: 20, y: 20, w: 40, h: 30},
      sourceSize: CANVAS,
    },
    lamp: {
      frame: {x: 140, y: 0, w: 10, h: 10},
      trimmed: true,
      spriteSourceSize: {x: 60, y: 10, w: 10, h: 10},
      sourceSize: CANVAS,
    },
  },
  meta: {image: 'scene.png', size: {w: 256, h: 128}},
});

const sceneAtlas = (): TextureAtlas<unknown> => TexturePackerJson.parse(sceneJson())[0];
const sceneSource = (): StageArtSource => ({atlas: sceneAtlas(), texture: new Texture()});

const kitchenSource = (): StageArtSource => {
  const json: AsepriteJsonData = JSON.parse(readFileSync(new URL('./fixtures/kitchen-aseprite.json', import.meta.url), 'utf8'));
  return {atlas: AsepriteJson.parse(json)[0], texture: new Texture()};
};

// a source the test hands over when it wants: the art waits for it as for a picture on its way
const heldBack = () => {
  let resolve!: (source: StageArtSource) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<StageArtSource>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const fakeRenderer = () => ({getMaxAnisotropy: () => 16, dispose() {}}) as unknown as WebGPURenderer;

// the sheets the fetch of makeStore() answers, by the name of their url; `scene.json` is the scene above
let sheets = new Map<string, TexturePackerJsonData>();

// a store whose item `scene` is the scene above, its json and its image answered at once
const makeStore = () => {
  sheets = new Map([['scene.json', sceneJson()]]);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    const name = url.slice(url.lastIndexOf('/') + 1);
    const sheet = sheets.get(name);
    return sheet === undefined ? new Response('', {status: 404}) : new Response(JSON.stringify(sheet));
  });
  vi.spyOn(ImageLoader.prototype, 'loadAsync').mockResolvedValue({width: 256, height: 128} as unknown as HTMLImageElement);
  const store = new TextureStore(fakeRenderer());
  store.parse({items: {scene: {atlasUrl: 'scene.json'}}});
  return store;
};

// the scene exported anew: `box` one frame, moved to 30, 40, 20 × 20; `lamp` gone; `cat` new, at 10, 80
const reexportedJson = (image = 'scene.png'): TexturePackerJsonData => {
  const frames = sceneJson().frames as Record<string, TexturePackerFrameData>;
  return {
    frames: {
      'back@50': frames['back@50']!,
      box: {
        frame: {x: 100, y: 0, w: 20, h: 20},
        trimmed: true,
        spriteSourceSize: {x: 30, y: 40, w: 20, h: 20},
        sourceSize: CANVAS,
      },
      cat: {
        frame: {x: 140, y: 0, w: 10, h: 10},
        trimmed: true,
        spriteSourceSize: {x: 10, y: 80, w: 10, h: 10},
        sourceSize: CANVAS,
      },
    },
    meta: {image, size: {w: 256, h: 128}},
  };
};

// the item `scene` of the store parsed anew with `sheet` under a new url, as a re-export brings it
let exports = 0;
const reexport = (store: TextureStore, sheet: TexturePackerJsonData) => {
  const name = `scene-${++exports}.json`;
  sheets.set(name, sheet);
  store.parse({items: {scene: {atlasUrl: name}}});
};

const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

// the names of the layers in the slot order of the mesh: the order they are drawn in
const stackOf = (art: StageArt): string[] => {
  const pool = art.mesh.spritePool!;
  return Array.from({length: pool.usedCount}, (_, i) => art.layerOf(pool.getVO(i)!)!.name);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('new StageArt()', () => {
  test('reads the layers of an atlas source at once, bottom first, with the canvas', () => {
    const art = new StageArt(sceneSource());

    expect(art).toBeInstanceOf(Group);
    expect(art.names).toEqual(['back', 'box', 'lamp']);
    expect(art.canvas).toEqual({width: 100, height: 100});
    expect(art.problems).toEqual([]);
    expect(art.children).toEqual([art.mesh]);
    expect(art.mesh.spritePool!.capacity).toBe(3);
    expect(art.mesh.getTexture('colorMap')).toBeInstanceOf(Texture);
  });

  test('builds the mesh transparent and without depth writes, and takes other material parameters', () => {
    const art = new StageArt(sceneSource());
    expect(art.mesh.material!.transparent).toBe(true);
    expect(art.mesh.material!.depthWrite).toBe(false);

    const opaque = new StageArt(sceneSource(), {material: {transparent: false, depthTest: false}});
    expect(opaque.mesh.material!.transparent).toBe(false);
    expect(opaque.mesh.material!.depthTest).toBe(false);
  });

  test('lays every layer out at its rest: the pivot where it was painted, in units of the art frame', () => {
    const art = new StageArt(sceneSource(), {pxPerUnit: 2});
    const box = art.layer('box').sprite;
    // the box is the union 20, 20, 40 × 30, its pivot the middle, (40, 35); the origin the middle of the canvas
    expect([box.x, box.y, box.z]).toEqual([-5, 7.5, -0]);
    expect([box.width, box.height]).toEqual([20, 15]);
    expect([box.anchorX, box.anchorY]).toEqual([0.5, 0.5]);
    expect(box.rotation).toBe(-0);
    expect(box.fade).toBe(1);
    expect(box.visible).toBe(1);

    const back = art.layer('back').sprite;
    expect(back.z).toBe(-25);
  });

  test('writes the frame of a layer with its trim inside the box of the layer', () => {
    const art = new StageArt(sceneSource());
    const box = art.layer('box').sprite;
    // the closed box lies 10 pixels below the top of the layer box of 30
    // float32 attributes
    expect(box.trimTop).toBeCloseTo(1 / 3, 6);
    expect([box.trimLeft, box.trimRight, box.trimBottom]).toEqual([0, 0, 0]);

    art.set('box', {frame: 1});
    expect([box.trimLeft, box.trimTop, box.trimRight, box.trimBottom]).toEqual([0, 0, 0, 0]);
  });

  test('turns the mesh to face its plane, and takes the plane of the projection before plane', () => {
    const turned = new Group();
    ProjectionPlane.get('xy|top-left').applyRotation(turned);

    const onPlane = new StageArt(sceneSource(), {plane: 'xy|top-left'});
    expect(onPlane.mesh.quaternion.angleTo(turned.quaternion)).toBeCloseTo(0, 6);
    expect(onPlane.plane.equals(ProjectionPlane.get('xy|top-left'))).toBe(true);

    const warn = silenceWarnings();
    const projection = new OrthographicProjection('xy|top-left');
    const both = new StageArt(sceneSource(), {projection, plane: 'xz|bottom-left'});
    expect(both.projection).toBe(projection);
    expect(both.mesh.quaternion.angleTo(turned.quaternion)).toBeCloseTo(0, 6);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toMatch(/^StageArt: .*projection.*plane/);

    const flat = new StageArt(sceneSource());
    expect(flat.mesh.quaternion.equals(new Quaternion())).toBe(true);
  });

  test('takes a ProjectionPlane of its own', () => {
    const plane = new ProjectionPlane(new Plane(new Vector3(1, 0, 0)), new Vector3(0, 1, 0));
    const art = new StageArt(sceneSource(), {plane});
    expect(art.plane).toBe(plane);
  });

  describe('refuses', () => {
    test('a source of none of the shapes', () => {
      for (const source of [
        undefined,
        null,
        5,
        {},
        {store: {}, id: 'a'},
        {atlas: sceneAtlas()},
        {files: 'a.png'},
        {files: ['a.png'], baseUrl: 5},
        {files: ['a.png'], layers: []},
      ]) {
        expect(() => new StageArt(source as never)).toThrow(TypeError);
      }
      expect(() => new StageArt({} as never)).toThrow(/^new StageArt\(\): the source must be /);
    });

    test('options that are no object, and a key that is no option', () => {
      expect(() => new StageArt(sceneSource(), 5 as never)).toThrow(
        new TypeError('new StageArt(): the options must be an object, got 5'),
      );
      expect(() => new StageArt(sceneSource(), {pxPerUnits: 2} as never)).toThrow(
        /^new StageArt\(\): the options have no key "pxPerUnits"; their keys are "name", /,
      );
    });

    test('a name that is no string, under the subject new StageArt()', () => {
      expect(() => new StageArt(sceneSource(), {name: 5 as never})).toThrow(
        new TypeError('new StageArt(): name must be a string, got 5'),
      );
    });

    test('pxPerUnit, origin and focus it cannot use, under the name of the art', () => {
      expect(() => new StageArt(sceneSource(), {name: 'kitchen', pxPerUnit: 0})).toThrow(/^StageArt "kitchen": pxPerUnit /);
      expect(() => new StageArt(sceneSource(), {origin: [1, Number.NaN]})).toThrow(/origin must be a pair of finite numbers/);
      expect(() => new StageArt(sceneSource(), {focus: 3 as never})).toThrow(/focus must be a pair of finite numbers/);
    });

    test('a compensateDepth that is no boolean', () => {
      expect(() => new StageArt(sceneSource(), {compensateDepth: 1 as never})).toThrow(
        new TypeError('new StageArt(): compensateDepth must be true or false, got 1'),
      );
    });

    test('a projection that is no IProjection', () => {
      expect(() => new StageArt(sceneSource(), {projection: {} as never})).toThrow(
        /^new StageArt\(\): projection must be an IProjection — stage\.projection —, got \{\}/,
      );
      expect(() => new StageArt(sceneSource(), {projection: new Group() as never})).toThrow(/got Group$/);
    });

    test('a plane that is neither a ProjectionPlane nor one of its four descriptions', () => {
      for (const plane of ['xy', 'yz|top-left', new Plane(), 5]) {
        expect(() => new StageArt(sceneSource(), {plane: plane as never})).toThrow(TypeError);
      }
      expect(() => new StageArt(sceneSource(), {plane: 'xy' as never})).toThrow(
        /^new StageArt\(\): plane must be a ProjectionPlane or one of "xy\|bottom-left", "xy\|top-left", "xz\|bottom-left", "xz\|top-left", got "xy"$/,
      );
    });

    test('only naming a layer twice and layers that is no object, before a promise source has loaded', () => {
      const {promise} = heldBack();
      expect(() => new StageArt(promise, {only: ['a', 'a']})).toThrow(/only names the layer "a" twice/);
      expect(() => new StageArt(promise, {layers: 5 as never})).toThrow(/layers must be an object/);
      expect(() => new StageArt(promise, {layers: {a: {depth: Number.NaN}}})).toThrow(/depth of the layer "a"/);
    });

    test('more than 8192 layers in only or in a list of files, which an art cannot hold', () => {
      const names = Array.from({length: 8193}, (_, i) => `layer${i}`);
      expect(() => new StageArt(heldBack().promise, {only: names})).toThrow(
        new RangeError('new StageArt(): only names 8193 layers, and an art holds at most 8192'),
      );
      const files = names.map((name) => `${name}.png`);
      expect(() => new StageArt({files}, {name: 'crowd'})).toThrow(
        new RangeError(
          'StageArt "crowd": the files name 8193 layers, and an art holds at most 8192 — split the files between two arts',
        ),
      );
      // the frames of a layer are no layers of their own
      const frames = ['strip.png', ...names.map((name) => `strip-${name}.png`)];
      expect(new StageArt({files: frames}).names).toEqual(['strip']);
    });

    test('only and layers beside a source of loose layers, which names its layers itself', () => {
      const source = {atlas: sceneAtlas(), texture: new Texture(), layers: [{name: 'lamp'}]};
      expect(() => new StageArt(source, {only: ['lamp']})).toThrow(/a source of loose layers names its layers itself/);
      expect(() => new StageArt(source, {layers: {}})).toThrow(/a source of loose layers names its layers itself/);
    });

    test('loose layers it cannot read', () => {
      const source = {atlas: sceneAtlas(), texture: new Texture(), layers: [{name: 'a'}, {name: 'a'}]};
      expect(() => new StageArt(source)).toThrow(/two layers are named "a"/);
    });

    test('a key of material that is no material parameter, or one the art sets itself', () => {
      const keys = ['capacity', 'geometry', 'material', 'grow', 'passes', 'attributeUsage', 'baseArgs'];
      for (const key of [...keys, 'textures', 'placement', 'resources', 'pass']) {
        expect(() => new StageArt(sceneSource(), {material: {[key]: 1}} as never), key).toThrow(
          new TypeError(
            `new StageArt(): material.${key} is the art's own — the art builds its mesh for its layers and draws the frames of its source with it; material takes the parameters of the material alone`,
          ),
        );
      }
      // the capacity of the mesh is the count of the layers, whatever the material says
      expect(new StageArt(sceneSource(), {material: {depthTest: false}}).mesh.spritePool!.capacity).toBe(3);
      expect(() => new StageArt(sceneSource(), {material: 5 as never})).toThrow(/material must be an object/);
    });
  });
});

describe('poses', () => {
  test('set() writes the fields it is given and keeps the rest', () => {
    const art = new StageArt(sceneSource());
    const box = art.layer('box').sprite;

    art.set('box', {x: 60});
    expect([box.x, box.y]).toEqual([10, 15]);

    art.layer('box').set({deg: 90, opacity: 0.5});
    expect(box.x).toBe(10);
    expect(box.rotation).toBeCloseTo(-Math.PI / 2, 6);
    expect(box.fade).toBe(0.5);

    art.set('box', {scaleX: 2, scaleY: 0.5});
    expect([box.width, box.height]).toEqual([80, 15]);
  });

  test('set() refuses a field it cannot use, names the layer and the field, and keeps what the layer held', () => {
    const art = new StageArt(sceneSource(), {name: 'kitchen'});
    const box = art.layer('box').sprite;

    expect(() => art.set('box', {x: 1, opacity: 1.5})).toThrow(
      new RangeError('ArtLayer "box": opacity must be a number from 0 to 1, got 1.5'),
    );
    expect(box.x).toBe(-10);
    expect(() => art.set('box', {x: Number.NaN})).toThrow(/^ArtLayer "box": x must be a finite number, got NaN$/);
    expect(() => art.set('box', {frame: 0.5})).toThrow(/^ArtLayer "box": frame must be a whole number/);
    expect(() => art.set('box', {frame: 2})).toThrow(/^ArtLayer "box": frame must be a whole number from 0 to 1/);
    expect(() => art.set('box', {order: 1024})).toThrow(/^ArtLayer "box": order must be a whole number from -1024 to 1023/);
    expect(() => art.set('box', {visible: 1 as never})).toThrow(/^ArtLayer "box": visible must be a boolean/);
    expect(() => art.set('box', {rotation: 5} as never)).toThrow(
      /^ArtLayer "box": the pose has no field "rotation"; its fields are "x", /,
    );
    expect(() => art.set('box', 5 as never)).toThrow(/^ArtLayer "box": the pose must be an object/);
    expect(box.x).toBe(-10);
  });

  test('layer() and set() of a name the art does not know list the names', () => {
    const art = new StageArt(sceneSource(), {name: 'kitchen'});
    const message = 'StageArt "kitchen": no layer "boxx" — its layers are "back", "box", "lamp"';
    expect(() => art.layer('boxx')).toThrow(new Error(message));
    expect(() => art.set('boxx', {x: 1})).toThrow(new Error(message));
  });

  test('reset() puts every layer back to its rest, and a layer reset() puts back itself', () => {
    const art = new StageArt(sceneSource());
    const {sprite} = art.layer('box');

    art.set('box', {x: 1, y: 2, deg: 30, opacity: 0.25, frame: 1, scaleX: 3});
    art.set('lamp', {x: 1});
    art.layer('box').reset();
    expect([sprite.x, sprite.y, sprite.rotation, sprite.fade, sprite.width]).toEqual([-10, 15, -0, 1, 40]);
    expect(art.layer('lamp').sprite.x).toBe(-49);

    art.reset();
    expect(art.layer('lamp').sprite.x).toBe(15);
  });

  test('rest is the pose of the layout, and the rest of the overrides beats it', () => {
    const art = new StageArt(sceneSource(), {layers: {lamp: {rest: {opacity: 0.5, deg: 10}}}});
    expect(art.layer('box').rest).toEqual({
      x: 40,
      y: 35,
      depth: 0,
      deg: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      frame: 0,
      visible: true,
      order: 0,
    });
    expect(art.layer('lamp').rest).toMatchObject({opacity: 0.5, deg: 10});
    expect(art.layer('lamp').sprite.fade).toBe(0.5);
    expect(Object.isFrozen(art.layer('box').rest)).toBe(true);
  });

  test('a layer handle answers what it read out of the source', () => {
    const art = new StageArt(sceneSource());
    const box = art.layer('box');
    expect(box.name).toBe('box');
    expect(box.box).toEqual({x: 20, y: 20, w: 40, h: 30});
    expect(box.pivot).toEqual([40, 35]);
    expect(box.frameCount).toBe(2);
    expect(box.tags).toEqual([]);
    expect(box.loaded).toBe(true);
    expect(art.layer('box')).toBe(box);
  });

  test('apply() samples a track into the layer, and leaves alone what the track has not', () => {
    const art = new StageArt(sceneSource());
    const {sprite} = art.layer('box');
    const move = artTrack([
      {at: 0, x: 40},
      {at: 2, x: 60},
    ]);
    const fade = artTrack([
      {at: 0, opacity: 1},
      {at: 1, opacity: 0.5},
    ]);

    art.apply('box', move, 1);
    expect(sprite.x).toBe(0);
    art.set('box', {x: 45});
    // the scratch pose of the art held x from the track before: it must not leak into this one
    art.layer('box').apply(fade, 1);
    expect(sprite.fade).toBe(0.5);
    expect(sprite.x).toBe(-5);
  });

  test('apply() refuses a track that is no ArtTrack', () => {
    const art = new StageArt(sceneSource());
    expect(() => art.apply('box', {} as never, 0)).toThrow(/^ArtLayer "box": apply\(\) takes an ArtTrack/);
  });

  test('frameAt() answers the frame of a tag of the layer at a time, and lists the tags for one it lacks', () => {
    const art = new StageArt(kitchenSource());
    const steam = art.layer('steam');
    expect(steam.tags).toEqual(['puff']);
    // puff is the frames 1–3 of 100, 100 and 150 ms, back and forth
    expect(steam.frameAt('puff', 0)).toBe(1);
    expect(steam.frameAt('puff', 0.15)).toBe(2);
    expect(steam.frameAt('puff', 0.25)).toBe(3);
    expect(() => steam.frameAt('puf', 0)).toThrow(new Error('ArtLayer "steam": no tag "puf" — its tags are "puff"'));
    expect(() => new StageArt(sceneSource()).layer('box').frameAt('puff', 0)).toThrow(
      new Error('ArtLayer "box": no tag "puff" — the layer has no tags'),
    );
  });

  test('a layer whose current frame is an empty cel is hidden', () => {
    const art = new StageArt(kitchenSource());
    const ladle = art.layer('ladle');
    art.takeChanged();

    art.set('ladle', {frame: 3});
    expect(ladle.sprite.visible).toBe(0);
    expect(art.takeChanged()).toBe(true);
    art.set('ladle', {frame: 2});
    expect(ladle.sprite.visible).toBe(1);
  });

  test('layerOf() names the layer of a sprite of the mesh, and nothing for another', () => {
    const art = new StageArt(sceneSource());
    const lamp = art.layer('lamp');
    expect(art.layerOf(lamp.sprite)).toBe(lamp);
    expect(art.layerOf({})).toBeUndefined();
    expect(art.layerOf(new StageArt(sceneSource()).layer('lamp').sprite)).toBeUndefined();
  });

  test('layerOf() keeps naming the layer of a sprite through a sort of the stack', () => {
    const warn = silenceWarnings();
    const art = new StageArt(sceneSource());
    const pool = art.mesh.spritePool!;
    const handles = art.names.map((name) => art.layer(name).sprite);
    art.set('back', {order: 1});
    art.set('lamp', {depth: 50});
    art.update();

    expect(stackOf(art)).toEqual(['lamp', 'back', 'box']);
    // the sprite at each slot of the pool is the one of the layer drawn there
    for (let i = 0; i < pool.usedCount; i++) expect(art.layerOf(pool.getVO(i)!)?.sprite).toBe(pool.getVO(i));
    for (const [i, name] of art.names.entries()) expect(art.layerOf(handles[i]!)?.name).toBe(name);
    warn.mockRestore();
  });
});

describe('features', () => {
  test('a feature folds into the kind, and its values are written through layer.sprite', () => {
    const art = new StageArt(sceneSource(), {features: [Flash, Tint]});
    const sprite = art.layer('box').sprite;

    sprite.setFlash(1, 0.5, 0.25, 0.6);
    expect(sprite.flashAmount).toBeCloseTo(0.6);
    expect(art.layerOf(sprite)?.name).toBe('box');
    // the art's own features are all still there
    expect(art.layer('box').sprite.width).toBeGreaterThan(0);
  });

  test('the features a caller hands in type the sprites of its layers, the mesh and layerOf()', () => {
    const art = new StageArt(sceneSource(), {features: [Flash, Tint]});
    expectTypeOf(art.layer('box').sprite.setFlash).toBeFunction();
    expectTypeOf(art.layer('box').sprite.width).toBeNumber();
    expectTypeOf(art.layerOf(art.layer('box').sprite)!.sprite).toExtend<FlashApi>();
    expectTypeOf(art.mesh.createSprite()!).toExtend<FlashApi>();

    const plain = new StageArt(sceneSource());
    // @ts-expect-error an art without the feature has no setFlash on its sprites
    expect(typeof plain.layer('box').sprite.setFlash).toBe('undefined');
  });

  test('a write through layer.sprite is outside the change detection', () => {
    const art = new StageArt(sceneSource(), {features: [Flash]});
    art.takeChanged();
    art.layer('lamp').sprite.setFlash(1, 1, 1, 0.6);
    expect(art.takeChanged()).toBe(false);
  });

  test('the kind of an art without features is shared, and one with the same features is built once', () => {
    const plain = new StageArt(sceneSource());
    expect(new StageArt(sceneSource(), {features: []}).mesh.kind).toBe(plain.mesh.kind);
    const first = new StageArt(sceneSource(), {features: [Flash]});
    expect(new StageArt(sceneSource(), {features: [Flash]}).mesh.kind).toBe(first.mesh.kind);
    expect(new StageArt(sceneSource(), {features: [Tint]}).mesh.kind).not.toBe(first.mesh.kind);
    expect(first.mesh.kind).not.toBe(plain.mesh.kind);

    // a feature object of its own — what a factory call makes anew — gets a kind of its own, and the same list its kind again
    const fresh = {...Flash};
    const own = new StageArt(sceneSource(), {features: [fresh]});
    expect(own.mesh.kind).not.toBe(first.mesh.kind);
    expect(new StageArt(sceneSource(), {features: [fresh]}).mesh.kind).toBe(own.mesh.kind);
    expect(new StageArt(sceneSource(), {features: [{...Flash}]}).mesh.kind).not.toBe(own.mesh.kind);
  });

  test('refuses a second frame source and a second placement, naming the feature', () => {
    expect(() => new StageArt(sceneSource(), {features: [AtlasFrame]})).toThrow(
      /^new StageArt\(\): features holds "atlasFrame", which the art brings itself$/,
    );
    expect(() => new StageArt(sceneSource(), {name: 'kitchen', features: [BillboardPlacement]})).toThrow(
      /^StageArt "kitchen": features cannot join the features of the art — defineSprite: /,
    );
  });

  test('refuses features that are no list, and an entry that is no feature', () => {
    expect(() => new StageArt(sceneSource(), {features: Flash as never})).toThrow(
      /^new StageArt\(\): features must be a list of sprite features, got /,
    );
    expect(() => new StageArt(sceneSource(), {features: [Flash, {}] as never})).toThrow(
      /^new StageArt\(\): features cannot join the features of the art — defineSprite: a feature needs a name, got undefined/,
    );
  });
});

describe('takeChanged()', () => {
  test('answers whether the picture changed since its last call, and starts over', () => {
    const art = new StageArt(sceneSource());
    // the pictures arrived
    expect(art.takeChanged()).toBe(true);
    expect(art.takeChanged()).toBe(false);

    art.set('box', {x: 41});
    expect(art.takeChanged()).toBe(true);
    expect(art.takeChanged()).toBe(false);
  });

  test('the same value twice, a frame index that stays and a hidden layer that moves answer false', () => {
    const art = new StageArt(sceneSource());
    art.set('box', {x: 41, frame: 1});
    art.takeChanged();

    art.set('box', {x: 41});
    art.set('box', {frame: 1});
    expect(art.takeChanged()).toBe(false);

    art.set('lamp', {visible: false});
    expect(art.takeChanged()).toBe(true);
    art.set('lamp', {x: 3, deg: 40, frame: 0, scaleX: 2});
    expect(art.takeChanged()).toBe(false);
    art.set('lamp', {visible: true});
    expect(art.takeChanged()).toBe(true);
  });

  test('a pose from or to opacity 0 answers true, a move at opacity 0 false', () => {
    const art = new StageArt(sceneSource());
    art.takeChanged();

    art.set('lamp', {opacity: 0});
    expect(art.layer('lamp').sprite.visible).toBe(0);
    expect(art.takeChanged()).toBe(true);
    art.set('lamp', {x: 9});
    expect(art.takeChanged()).toBe(false);
    art.set('lamp', {opacity: 0.25});
    expect(art.layer('lamp').sprite.visible).toBe(1);
    expect(art.takeChanged()).toBe(true);
  });

  test('a change of the stack of a shown layer answers true', () => {
    const art = new StageArt(sceneSource());
    art.takeChanged();
    art.set('lamp', {order: -1});
    expect(art.takeChanged()).toBe(true);
  });
});

describe('the stack', () => {
  test('is drawn by depth, the farthest first, then by order, then as painted', () => {
    const warn = silenceWarnings();
    const art = new StageArt(sceneSource());
    art.update();
    expect(stackOf(art)).toEqual(['back', 'box', 'lamp']);

    art.set('lamp', {depth: 50});
    art.update();
    expect(stackOf(art)).toEqual(['back', 'lamp', 'box']);

    art.set('back', {order: 1});
    art.update();
    expect(stackOf(art)).toEqual(['lamp', 'back', 'box']);
    expect(art.layer('back').sprite.artOrder).toBe((1 + 1024) * 8192 + 0);
    warn.mockRestore();
  });

  test('is the same under any history of set() calls', () => {
    const warn = silenceWarnings();
    const names = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];
    const defs: ArtLayerDef[] = names.map((name) => ({name, frames: ['lamp']}));
    const art = new StageArt({atlas: sceneAtlas(), texture: new Texture(), layers: defs});
    const final = [
      {depth: 10, order: 0},
      {depth: 0, order: 2},
      {depth: 10, order: -1},
      {depth: 0, order: 0},
      {depth: -5, order: 0},
      {depth: 10, order: 0},
      {depth: 0, order: 2},
      {depth: 0, order: -3},
    ];
    const expected = names
      .map((name, index) => ({name, index, ...final[index]!}))
      .sort((a, b) => b.depth - a.depth || a.order - b.order || a.index - b.index)
      .map(({name}) => name);

    // a small generator of its own, so that a failing history can be replayed
    let seed = 7;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let round = 0; round < 20; round++) {
      for (let step = 0; step < 12; step++) {
        art.set(names[random(names.length)]!, {depth: random(30) - 10, order: random(9) - 4});
        if (random(3) === 0) art.update();
      }
      const order = names.map((_, index) => index);
      for (let i = order.length - 1; i > 0; i--) {
        const j = random(i + 1);
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      for (const index of order) art.set(names[index]!, final[index]!);
      art.update();
      expect(stackOf(art), `round ${round}`).toEqual(expected);
    }
    warn.mockRestore();
  });

  test('says once per layer that a layer painted above another lies behind it', () => {
    const warn = silenceWarnings();
    const art = new StageArt(sceneSource(), {name: 'kitchen'});
    art.update();
    expect(warn).not.toHaveBeenCalled();

    art.set('lamp', {depth: 80});
    art.update();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toBe(
      'StageArt "kitchen": the layer "lamp", painted above "box", lies behind it — at a depth of 80 against 0 — and is drawn under it: the picture at rest differs from the painting. This warning is shown once per layer.',
    );

    art.set('lamp', {depth: 90});
    art.update();
    art.set('box', {depth: 60});
    art.update();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1]![0]).toMatch(/^StageArt "kitchen": the layer "box", painted above "back"/);
  });
});

describe('loading', () => {
  test('a layer is hidden until its picture is there, and takes the pose set before', async () => {
    const {promise, resolve} = heldBack();
    const art = new StageArt(promise, {only: ['box', 'lamp']});
    const box = art.layer('box');
    expect(art.names).toEqual(['box', 'lamp']);
    expect(box.loaded).toBe(false);
    expect(box.sprite.visible).toBe(0);
    expect(box.box).toBeUndefined();
    expect(box.rest).toBeUndefined();

    art.set('box', {x: 60, deg: 90});
    expect(box.sprite.visible).toBe(0);
    expect(art.takeChanged()).toBe(false);

    resolve(sceneSource());
    await art.loaded;
    expect(box.loaded).toBe(true);
    expect(box.sprite.visible).toBe(1);
    expect([box.sprite.x, box.sprite.y]).toEqual([10, 15]);
    expect(box.sprite.rotation).toBeCloseTo(-Math.PI / 2, 6);
    expect(art.mesh.getTexture('colorMap')).toBeInstanceOf(Texture);
    expect(art.takeChanged()).toBe(true);
  });

  test('a promise source without only: no layer until it is there, then a mesh of as many', async () => {
    const {promise, resolve} = heldBack();
    const art = new StageArt(promise, {name: 'kitchen'});
    expect(art.names).toEqual([]);
    expect(() => art.layer('box')).toThrow(
      'StageArt "kitchen": no layer "box" — the art knows no layer yet: its source is still loading; await art.loaded, or name the layers in only',
    );

    resolve(sceneSource());
    await art.loaded;
    expect(art.names).toEqual(['back', 'box', 'lamp']);
    expect(art.mesh.spritePool!.capacity).toBe(3);
    expect(art.layer('lamp').sprite.visible).toBe(1);
  });

  test('a source that fails leaves every layer hidden, one problem without a layer and a warning', async () => {
    const warn = silenceWarnings();
    const {promise, reject} = heldBack();
    const art = new StageArt(promise, {name: 'kitchen', only: ['box']});
    art.set('box', {x: 3});

    reject(new Error('gone'));
    await art.loaded;
    expect(art.problems).toEqual([{layer: undefined, reason: 'the source did not load: gone'}]);
    expect(art.names).toEqual(['box']);
    expect(art.layer('box').sprite.visible).toBe(0);
    expect(art.layer('box').loaded).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toMatch(/^StageArt "kitchen": 1 problem — art\.problems lists it/);
  });

  test('a promise that resolves with none of the shapes is a problem of the source', async () => {
    silenceWarnings();
    const art = new StageArt(Promise.resolve({files: 'a.png'} as never));
    await art.loaded;
    expect(art.problems).toHaveLength(1);
    expect(art.problems[0]!.reason).toMatch(/^the source the promise resolved with is none of the shapes/);
    expect(art.names).toEqual([]);
  });

  test('a frame set before the load beyond the frames of the layer is kept, a problem, and frame 0 shows', async () => {
    const warn = silenceWarnings();
    const {promise, resolve} = heldBack();
    const art = new StageArt(promise, {only: ['box']});
    expect(() => art.set('box', {frame: 5})).not.toThrow();
    expect(() => art.set('box', {frame: -1})).toThrow(/frame must be a whole number of 0 or more/);

    resolve(sceneSource());
    await expect(art.loaded).resolves.toBeUndefined();
    const {sprite} = art.layer('box');
    expect(art.problems).toEqual([
      {layer: 'box', reason: 'the frame 5 set before the layer loaded lies beyond its 2 frames — the layer shows frame 0'},
    ]);
    expect(sprite.visible).toBe(1);
    // frame 0, the closed box, 10 pixels below the top of the box
    expect(sprite.trimTop).toBeCloseTo(1 / 3, 6);
    expect(warn).toHaveBeenCalledOnce();
    art.set('box', {frame: 1});
    expect(sprite.trimTop).toBe(0);
  });

  test('a layer only names that the source lacks is posed and hidden, with its problem', async () => {
    silenceWarnings();
    const art = new StageArt(sceneSource(), {only: ['ghost', 'box']});
    const ghost = art.layer('ghost');
    expect(art.names).toEqual(['ghost', 'box']);
    expect(art.problems).toEqual([
      {layer: 'ghost', reason: 'the source has no layer "ghost", which only names — the layer stays hidden'},
    ]);

    art.takeChanged();
    expect(() => art.set('ghost', {x: 3, deg: 10, frame: 2, opacity: 0.5})).not.toThrow();
    expect(() => ghost.reset()).not.toThrow();
    expect(ghost.sprite.visible).toBe(0);
    expect(ghost.loaded).toBe(false);
    expect(ghost.frameCount).toBe(0);
    expect(art.takeChanged()).toBe(false);
    art.update();
    expect(art.layer('box').sprite.visible).toBe(1);
  });

  test('says its problems once on the console, naming the art and the count', () => {
    const warn = silenceWarnings();
    const art = new StageArt(sceneSource(), {name: 'kitchen', only: ['ghost', 'spook', 'box']});
    expect(art.problems).toHaveLength(2);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toMatch(/^StageArt "kitchen": 2 problems — art\.problems lists them: /);
  });

  test('a store item: the art holds a lease of the atlas and the texture until it is disposed', async () => {
    const store = makeStore();
    const art = new StageArt({store, id: 'scene'});
    await art.loaded;
    const resource = await store.whenResource('scene');

    expect(art.names).toEqual(['back', 'box', 'lamp']);
    expect(art.mesh.getTexture('colorMap')).toBe(resource.texture);
    expect(resource.refCount).toBe(1);

    art.dispose();
    expect(resource.refCount).toBe(0);
    store.dispose();
  });

  test('two arts on one store item, one disposed: the other keeps its texture and its lease', async () => {
    const store = makeStore();
    const first = new StageArt({store, id: 'scene'});
    const second = new StageArt({store, id: 'scene'});
    await Promise.all([first.loaded, second.loaded]);
    const resource = await store.whenResource('scene');
    expect(resource.refCount).toBe(2);

    first.dispose();
    first.dispose();

    expect(resource.refCount).toBe(1);
    expect(second.mesh.getTexture('colorMap')).toBe(resource.texture);
    expect(store.clearUnused()).toBe(0);
    store.dispose();
  });

  test('a store item that does not load is a problem of the source', async () => {
    silenceWarnings();
    const store = makeStore();
    const art = new StageArt({store, id: 'nothing'});
    await art.loaded;
    expect(art.problems).toHaveLength(1);
    expect(art.problems[0]).toMatchObject({layer: undefined});
    expect(art.problems[0]!.reason).toMatch(/^the store item "nothing" did not load: /);
    store.dispose();
  });
});

describe('following a store item', () => {
  // a store with its art on `scene`, loaded; the warnings silenced
  const loadedArt = async (options?: ConstructorParameters<typeof StageArt>[1]) => {
    const warn = silenceWarnings();
    const store = makeStore();
    const art = new StageArt({store, id: 'scene'}, options);
    await art.loaded;
    const resource = await store.whenResource('scene');
    return {warn, store, art, resource};
  };

  test('a re-exported sheet replaces the frames and the box of a layer, which keeps its handle, its sprite and the fields of its pose set off its rest', async () => {
    const {store, art, resource} = await loadedArt();
    const box = art.layer('box');
    const {sprite} = box;
    art.set('box', {x: 60, deg: 90});
    expect(box.frameCount).toBe(2);
    const atlasBefore = resource.atlas;

    reexport(store, reexportedJson());
    await vi.waitFor(() => expect(resource.atlas).not.toBe(atlasBefore));

    expect(art.names).toEqual(['back', 'box', 'lamp']);
    expect(art.layer('box')).toBe(box);
    expect(box.sprite).toBe(sprite);
    expect(art.layerOf(sprite)).toBe(box);
    expect(box.frameCount).toBe(1);
    expect(box.box).toEqual({x: 30, y: 40, w: 20, h: 20});
    expect(box.pivot).toEqual([40, 50]);
    expect(box.rest).toMatchObject({x: 40, y: 50, deg: 0});
    // x and deg were set off the rest and stay; y stood at its rest and takes the new one
    expect([sprite.x, sprite.y]).toEqual([10, 0]);
    expect(sprite.rotation).toBeCloseTo(-Math.PI / 2, 6);
    expect(sprite.visible).toBe(1);
    expect(sprite.trimTop).toBe(0);
    expect(() => art.set('box', {frame: 1})).toThrow(/^ArtLayer "box": frame must be a whole number from 0 to 0/);
    store.dispose();
  });

  test('a frame the reloaded sheet does not have any more is a problem, and frame 0 shows', async () => {
    const {store, art, resource} = await loadedArt();
    art.set('box', {frame: 1});
    const atlasBefore = resource.atlas;

    reexport(store, reexportedJson());
    await vi.waitFor(() => expect(resource.atlas).not.toBe(atlasBefore));

    expect(art.problems).toContainEqual({
      layer: 'box',
      reason: 'the frame 1 it showed lies beyond its 1 frame in the reloaded source — the layer shows frame 0',
    });
    expect(art.layer('box').sprite.visible).toBe(1);
    expect(() => art.set('box', {frame: 0})).not.toThrow();
    store.dispose();
  });

  test('a layer the reloaded sheet lacks stays posed and hidden, with its problem', async () => {
    const {store, art, resource} = await loadedArt();
    const lamp = art.layer('lamp');
    art.set('lamp', {x: 12});
    expect(lamp.sprite.visible).toBe(1);
    const atlasBefore = resource.atlas;

    reexport(store, reexportedJson());
    await vi.waitFor(() => expect(resource.atlas).not.toBe(atlasBefore));

    expect(art.layer('lamp')).toBe(lamp);
    expect(lamp.sprite.visible).toBe(0);
    expect(lamp.loaded).toBe(false);
    expect(lamp.frameCount).toBe(0);
    expect(art.problems).toContainEqual({
      layer: 'lamp',
      reason: 'the reloaded source has no layer "lamp" — the layer stays hidden',
    });
    expect(() => art.set('lamp', {x: 3, frame: 4})).not.toThrow();

    // the next export brings it back, at the pose it was given
    const atlasBetween = resource.atlas;
    reexport(store, sceneJson());
    await vi.waitFor(() => expect(resource.atlas).not.toBe(atlasBetween));
    expect(lamp.loaded).toBe(true);
    expect(lamp.sprite.visible).toBe(1);
    expect(lamp.sprite.x).toBe(3 - 50);
    expect(art.problems).toEqual([
      {layer: 'lamp', reason: 'the frame 4 it showed lies beyond its 1 frame in the reloaded source — the layer shows frame 0'},
    ]);
    store.dispose();
  });

  test('a layer new in the reloaded sheet does not join the running art: one problem names it', async () => {
    const {store, art, resource} = await loadedArt();
    const atlasBefore = resource.atlas;

    reexport(store, reexportedJson());
    await vi.waitFor(() => expect(resource.atlas).not.toBe(atlasBefore));

    expect(art.names).toEqual(['back', 'box', 'lamp']);
    expect(art.mesh.spritePool!.usedCount).toBe(3);
    expect(() => art.layer('cat')).toThrow(/^StageArt: no layer "cat" — its layers are "back", "box", "lamp"$/);
    expect(art.problems).toContainEqual({
      layer: 'cat',
      reason:
        'the reloaded source has a layer "cat" the art did not load with — it stays out of this art; a new StageArt takes it',
    });
    store.dispose();
  });

  test('the problems of a reload take the place of those before, and are said once on the console per reload', async () => {
    const {warn, store, art, resource} = await loadedArt({name: 'scene', only: ['box', 'ghost']});
    expect(art.problems).toEqual([
      {layer: 'ghost', reason: 'the source has no layer "ghost", which only names — the layer stays hidden'},
    ]);
    const problemsBefore = art.problems;
    expect(warn).toHaveBeenCalledOnce();
    let atlasBefore = resource.atlas;

    reexport(store, reexportedJson());
    await vi.waitFor(() => expect(resource.atlas).not.toBe(atlasBefore));

    // only names the layers: a layer of the sheet only leaves out is no new layer
    expect(art.problems).toEqual([
      {layer: 'ghost', reason: 'the source has no layer "ghost", which only names — the layer stays hidden'},
    ]);
    expect(art.problems).not.toBe(problemsBefore);
    expect(problemsBefore).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[1]![0]).toMatch(
      /^StageArt "scene": its source reloaded with 1 problem — art\.problems lists it: the layer "ghost": /,
    );

    // a reload without problems empties the list, and says nothing
    const clean = reexportedJson();
    (clean.frames as Record<string, TexturePackerFrameData>)['ghost'] = (clean.frames as Record<string, TexturePackerFrameData>)[
      'cat'
    ]!;
    atlasBefore = resource.atlas;
    reexport(store, clean);
    await vi.waitFor(() => expect(resource.atlas).not.toBe(atlasBefore));
    expect(art.problems).toEqual([]);
    expect(art.layer('ghost').loaded).toBe(true);
    expect(art.layer('ghost').sprite.visible).toBe(1);
    expect(warn).toHaveBeenCalledTimes(2);
    store.dispose();
  });

  test('takeChanged() answers true once after the swap', async () => {
    const {store, art, resource} = await loadedArt();
    art.takeChanged();
    const atlasBefore = resource.atlas;

    reexport(store, reexportedJson());
    await vi.waitFor(() => expect(resource.atlas).not.toBe(atlasBefore));

    expect(art.takeChanged()).toBe(true);
    expect(art.takeChanged()).toBe(false);
    store.dispose();
  });

  test('a sheet with another image swaps the texture of the mesh', async () => {
    const {store, art, resource} = await loadedArt();
    const textureBefore = resource.texture;
    expect(art.mesh.getTexture('colorMap')).toBe(textureBefore);

    reexport(store, reexportedJson('scene-2.png'));
    await vi.waitFor(() => expect(art.mesh.getTexture('colorMap')).not.toBe(textureBefore));

    expect(art.mesh.getTexture('colorMap')).toBe(resource.texture);
    expect(art.layer('box').frameCount).toBe(1);
    store.dispose();
  });

  test('a new texture of the same sheet — a new renderer — swaps the texture alone, and reads the sheet no more', async () => {
    const {warn, store, art, resource} = await loadedArt({only: ['box', 'ghost']});
    const textureBefore = resource.texture;
    art.set('box', {frame: 1});
    art.takeChanged();

    store.renderer = fakeRenderer();
    await vi.waitFor(() => expect(art.mesh.getTexture('colorMap')).not.toBe(textureBefore));

    expect(art.mesh.getTexture('colorMap')).toBe(resource.texture);
    expect(art.layer('box').frameCount).toBe(2);
    expect(art.problems).toHaveLength(1);
    expect(warn).toHaveBeenCalledOnce();
    expect(art.takeChanged()).toBe(true);
    store.dispose();
  });

  test('holds the store item through the following alone: one hold per art', async () => {
    const {store, art, resource} = await loadedArt();
    expect(resource.refCount).toBe(1);
    const second = new StageArt({store, id: 'scene'});
    await second.loaded;
    expect(resource.refCount).toBe(2);
    second.dispose();
    expect(resource.refCount).toBe(1);
    art.dispose();
    expect(resource.refCount).toBe(0);
    store.dispose();
  });

  test('dispose() ends the following: a sheet exported afterwards reaches the art no more', async () => {
    const {store, art, resource} = await loadedArt();
    const box = art.layer('box');
    const problems = art.problems;
    art.dispose();
    expect(resource.refCount).toBe(0);
    const atlasBefore = resource.atlas;

    // the resource is held by nobody now; a store that keeps it answers the new sheet
    const follower = vi.fn();
    const unfollow = store.on('scene', ['atlas', 'texture'], follower);
    reexport(store, reexportedJson('scene-2.png'));
    await vi.waitFor(() => expect(resource.atlas).not.toBe(atlasBefore));

    expect(box.frameCount).toBe(2);
    expect(art.problems).toBe(problems);
    expect(art.problems).toEqual([]);
    unfollow();
    store.dispose();
  });

  test('a delivery of the store that lands after dispose() is dropped', async () => {
    const store = makeStore();
    const on = store.on.bind(store);
    let deliver: ((value: [TextureAtlas<unknown>, Texture]) => void) | undefined;
    vi.spyOn(store, 'on').mockImplementation(((id: string, type: never, callback: never) => {
      deliver = callback;
      return on(id, type, callback);
    }) as typeof store.on);
    const art = new StageArt({store, id: 'scene'});
    await art.loaded;
    expect(deliver).toBeDefined();
    const box = art.layer('box');
    art.dispose();

    expect(() => deliver!([TexturePackerJson.parse(reexportedJson())[0], new Texture()])).not.toThrow();
    expect(box.frameCount).toBe(2);
    expect(art.problems).toEqual([]);
    store.dispose();
  });
});

describe('dispose()', () => {
  test('leaves the parent, releases the mesh, and every member behaves as its TSDoc says', () => {
    const art = new StageArt(sceneSource());
    const parent = new Group();
    parent.add(art);
    const box = art.layer('box');
    const {sprite} = box;
    const meshDispose = vi.spyOn(art.mesh, 'dispose');

    art.dispose();

    expect(art.parent).toBeNull();
    expect(meshDispose).toHaveBeenCalledOnce();
    expect(art.mesh.geometry).toBeUndefined();
    expect(art.isDisposed).toBe(true);
    expect(() => art.set('box', {x: 1})).not.toThrow();
    expect(() => box.set({x: 1})).not.toThrow();
    expect(() => art.apply('box', artTrack([{at: 0, x: 1}]), 0)).not.toThrow();
    expect(() => art.reset()).not.toThrow();
    expect(() => art.update()).not.toThrow();
    expect(art.takeChanged()).toBe(false);
    // what it cannot use it still turns away
    expect(() => art.set('box', {opacity: 2})).toThrow(/^ArtLayer "box": opacity must be a number from 0 to 1, got 2$/);
    expect(() => box.set({rotation: 1} as never)).toThrow(/^ArtLayer "box": the pose has no field "rotation"/);
    expect(() => box.set({frame: 2})).toThrow(/^ArtLayer "box": frame must be a whole number from 0 to 1/);
    expect(() => art.set('boxx', {x: 1})).toThrow(/^StageArt: no layer "boxx" — its layers are /);
    expect(() => art.apply('box', {} as never, 0)).toThrow(/^ArtLayer "box": apply\(\) takes an ArtTrack/);
    expect(() => box.apply(artTrack([{at: 0, x: 1}]), Number.NaN)).toThrow(/seconds must be a finite number/);
    expect(() => art.layer('box')).toThrow(/^StageArt: layer\(\) is not available: this art has been disposed$/);
    expect(art.layerOf(sprite)).toBeUndefined();

    art.dispose();
    expect(meshDispose).toHaveBeenCalledOnce();
  });

  test('does not dispose the texture or the atlas handed in', () => {
    const source = sceneSource() as {atlas: TextureAtlas<unknown>; texture: Texture};
    const textureDispose = vi.spyOn(source.texture, 'dispose');
    new StageArt(source).dispose();
    expect(textureDispose).not.toHaveBeenCalled();
  });

  test('a load that lands after it is dropped, and loaded resolves', async () => {
    const {promise, resolve} = heldBack();
    const art = new StageArt(promise);
    art.dispose();
    await expect(art.loaded).resolves.toBeUndefined();

    resolve(sceneSource());
    await flush();
    expect(art.names).toEqual([]);
    expect(art.problems).toEqual([]);
  });

  test('a store lease that lands after it is released at once', async () => {
    const store = makeStore();
    const acquire = store.acquireAsync.bind(store);
    const releases: ReturnType<typeof vi.fn>[] = [];
    const acquireSpy = vi.spyOn(store, 'acquireAsync').mockImplementation(async (id, type) => {
      const lease = await acquire(id, type);
      releases.push(vi.spyOn(lease, 'release') as unknown as ReturnType<typeof vi.fn>);
      return lease;
    });
    const onSpy = vi.spyOn(store, 'on');
    const art = new StageArt({store, id: 'scene'});
    art.dispose();
    await flush();
    await flush();
    const resource = await store.whenResource('scene');

    expect(acquireSpy).toHaveBeenCalledExactlyOnceWith('scene', ['atlas', 'texture']);
    expect(onSpy).not.toHaveBeenCalled();
    expect(releases).toHaveLength(1);
    expect(releases[0]).toHaveBeenCalledOnce();
    expect(resource.refCount).toBe(0);
    expect(art.mesh.getTexture('colorMap')).toBeUndefined();
    store.dispose();
  });

  test('releases the geometry it put into the mesh for a source of unknown size', async () => {
    const {promise, resolve} = heldBack();
    const art = new StageArt(promise);
    resolve(sceneSource());
    await art.loaded;
    const geometry = art.mesh.geometry!;
    const geometryDispose = vi.spyOn(geometry, 'dispose');

    art.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
  });
});

describe('planes, projections and depth', () => {
  // a parallax projection over a view of 100 × 100 whose camera stands `distance` units in front of
  // the plane; without a view its distance is NaN
  const parallax = (distance: number, {viewed = true} = {}): ParallaxProjection => {
    const projection = new ParallaxProjection('xy|bottom-left', {fit: 'fill', distanceToProjectionPlane: distance});
    if (viewed) projection.updateViewRect(100, 100);
    return projection;
  };
  const moveCamera = (projection: ParallaxProjection, distance: number): void => {
    projection.viewSpecs.distanceToProjectionPlane = distance;
    projection.updateViewRect(100, 100);
  };
  // the warnings that a layer lies at or behind the camera, among the others of the art
  const behindTheCamera = (warn: ReturnType<typeof silenceWarnings>): unknown[] =>
    warn.mock.calls.map(([message]) => message).filter((message) => / lies at or behind the camera, /.test(String(message)));
  const facing = (description: 'xy|top-left' | 'xz|bottom-left' | 'xz|top-left'): Quaternion => {
    const turned = new Group();
    ProjectionPlane.get(description).applyRotation(turned);
    return turned.quaternion;
  };

  test('lays a layer at a depth out at k = (D + δ) / D about the focus, so the camera at rest sees it as painted', () => {
    const art = new StageArt(sceneSource(), {projection: parallax(100)});
    // back lies 50 behind the plane: k = 1.5, about its pivot on the focus
    const back = art.layer('back').sprite;
    expect([back.x, back.y, back.z, back.width, back.height]).toEqual([0, 0, -50, 150, 150]);

    // the box, its pivot at (-10, 15) units, 100 behind the plane: k = 2
    const box = art.layer('box').sprite;
    art.set('box', {depth: 100});
    expect([box.x, box.y, box.z, box.width, box.height]).toEqual([-20, 30, -100, 80, 60]);
    // a move of a layer at a depth carries the k in force
    art.set('box', {x: 45, y: 40});
    expect([box.x, box.y]).toEqual([-10, 20]);

    // a focus on the pivot of the box leaves it where it stands, only larger
    const focused = new StageArt(sceneSource(), {projection: parallax(100), focus: [40, 35]});
    focused.set('box', {depth: 100});
    const sprite = focused.layer('box').sprite;
    expect([sprite.x, sprite.y, sprite.width, sprite.height]).toEqual([-10, 15, 80, 60]);
  });

  test('draws depth uncompensated without a projection, under an OrthographicProjection or a CameraProjection, and with compensateDepth: false', () => {
    const projection = parallax(100);
    const arts = [
      new StageArt(sceneSource()),
      new StageArt(sceneSource(), {projection: new OrthographicProjection('xy|bottom-left')}),
      new StageArt(sceneSource(), {projection: new CameraProjection(new PerspectiveCamera())}),
      new StageArt(sceneSource(), {projection, compensateDepth: false}),
    ];
    for (const art of arts) {
      art.set('box', {depth: 100});
      art.update();
      expect([art.layer('back').sprite.width, art.layer('box').sprite.x, art.layer('box').sprite.width]).toEqual([100, -10, 40]);
      art.takeChanged();
    }
    // never compensated: a new distance of the camera lays nothing out anew
    moveCamera(projection, 40);
    arts[3]!.update();
    expect(arts[3]!.takeChanged()).toBe(false);
    expect(arts[3]!.layer('back').sprite.width).toBe(100);
  });

  test('a CameraProjection leaves the art in its plane, without a word', () => {
    const warn = silenceWarnings();
    const art = new StageArt(sceneSource(), {plane: 'xy|top-left', projection: new CameraProjection(new PerspectiveCamera())});
    expect(art.plane.equals(ProjectionPlane.get('xy|top-left'))).toBe(true);
    expect(art.mesh.quaternion.angleTo(facing('xy|top-left'))).toBeCloseTo(0, 6);
    expect(warn).not.toHaveBeenCalled();
  });

  test('a new distance of the camera lays the depth layers out anew in update(), and takeChanged() answers true once', () => {
    const projection = parallax(100);
    const art = new StageArt(sceneSource(), {projection});
    const back = art.layer('back').sprite;
    art.update();
    art.takeChanged();

    moveCamera(projection, 200);
    // the distance in force is the one of the last update()
    expect(back.width).toBe(150);
    art.update();
    expect(back.width).toBe(125);
    expect(art.layer('box').sprite.width).toBe(40);
    expect(art.takeChanged()).toBe(true);
    expect(art.takeChanged()).toBe(false);
    art.update();
    expect(art.takeChanged()).toBe(false);

    // another projection of the same distance and plane changes nothing; one without a distance draws depth as it is
    art.projection = parallax(200);
    art.update();
    expect(art.takeChanged()).toBe(false);
    art.projection = new OrthographicProjection('xy|bottom-left');
    expect(back.width).toBe(125);
    art.update();
    expect(back.width).toBe(100);
    expect(art.takeChanged()).toBe(true);
  });

  test('before the first view of a parallax projection depth is drawn uncompensated, and the first update() after it lays it out', () => {
    const projection = parallax(100, {viewed: false});
    expect(projection.distanceToProjectionPlane).toBeNaN();
    const art = new StageArt(sceneSource(), {projection});
    // no distance known, nothing to stand behind
    art.set('box', {depth: -400});
    art.set('box', {depth: 100});
    art.update();
    expect(art.layer('back').sprite.width).toBe(100);
    expect(art.layer('box').sprite.width).toBe(40);
    art.takeChanged();

    projection.updateViewRect(100, 100);
    art.update();
    expect(art.layer('back').sprite.width).toBe(150);
    expect([art.layer('box').sprite.x, art.layer('box').sprite.width]).toEqual([-20, 80]);
    expect(art.takeChanged()).toBe(true);
  });

  test('set() refuses a depth at or behind the camera where its distance is known, naming the layer and the field, and the layer keeps what it held', () => {
    const art = new StageArt(sceneSource(), {name: 'kitchen', pxPerUnit: 2, projection: parallax(100)});
    const box = art.layer('box').sprite;
    const held = [box.x, box.y, box.z, box.width];

    // 100 units are 200 artwork pixels
    expect(() => art.set('box', {x: 10, depth: -200})).toThrow(
      new RangeError(
        'ArtLayer "box": depth must be a number above -200 — the camera stands 200 artwork pixels in front of the plane —, got -200',
      ),
    );
    expect(() => art.layer('box').set({depth: -300})).toThrow(/^ArtLayer "box": depth must be a number above -200 /);
    expect([box.x, box.y, box.z, box.width]).toEqual(held);

    art.set('box', {depth: -100});
    expect([box.z, box.width]).toEqual([50, 10]);
  });

  test('a layer a new distance leaves at or behind the camera is hidden, said once, and shown again once it lies in front of the camera', () => {
    const warn = silenceWarnings();
    const projection = parallax(100);
    const art = new StageArt(sceneSource(), {name: 'kitchen', projection});
    const box = art.layer('box').sprite;
    art.set('box', {depth: -80});
    art.update();
    art.takeChanged();
    expect(box.visible).toBe(1);

    // the box brought in front of the lamp, painted above it, has been said as well
    expect(behindTheCamera(warn)).toEqual([]);

    moveCamera(projection, 50);
    art.update();
    expect(box.visible).toBe(0);
    expect(art.takeChanged()).toBe(true);
    expect(behindTheCamera(warn)).toEqual([
      'StageArt "kitchen": the layer "box", at a depth of -80, lies at or behind the camera, which stands 50 artwork pixels in front of the plane — it is hidden until its depth or the distance of the camera brings it in front of the camera again. This warning is shown once until then.',
    ]);

    // still behind: no second word; moved while hidden: no change
    moveCamera(projection, 40);
    art.update();
    expect(behindTheCamera(warn)).toHaveLength(1);
    // back, at a depth as well, was laid out for the new distance
    expect(art.takeChanged()).toBe(true);
    art.set('box', {x: 41});
    expect(art.takeChanged()).toBe(false);

    moveCamera(projection, 200);
    art.update();
    expect(box.visible).toBe(1);
    expect(box.width).toBeCloseTo(40 * 0.6, 5);
    expect(art.takeChanged()).toBe(true);

    // left behind once more, it is said once more; a depth brings it back
    moveCamera(projection, 80);
    art.update();
    expect(box.visible).toBe(0);
    expect(behindTheCamera(warn)).toHaveLength(2);
    art.set('box', {depth: 0});
    expect(box.visible).toBe(1);
    expect(art.takeChanged()).toBe(true);
  });

  test('apply() of a dolly track refuses a key at or behind a camera that came closer, keeps the pose, and takes the next time in front of it', () => {
    const warn = silenceWarnings();
    const projection = parallax(300);
    const art = new StageArt(sceneSource(), {projection});
    const box = art.layer('box').sprite;
    const dolly = artTrack([
      {at: 0, depth: 0},
      {at: 1, depth: -250},
    ]);
    art.apply('box', dolly, 0.5);
    expect(box.z).toBe(125);

    moveCamera(projection, 200);
    art.update();
    expect(box.visible).toBe(1);
    expect(() => art.apply('box', dolly, 1)).toThrow(
      new RangeError(
        'ArtLayer "box": depth must be a number above -200 — the camera stands 200 artwork pixels in front of the plane —, got -250',
      ),
    );
    expect(() => art.layer('box').apply(dolly, 0.9)).toThrow(/^ArtLayer "box": depth must be a number above -200 /);
    expect(box.z).toBe(125);
    expect(box.visible).toBe(1);

    art.apply('box', dolly, 0.6);
    expect(box.z).toBe(150);
    expect(behindTheCamera(warn)).toEqual([]);
  });

  test('with compensateDepth: false the camera of a parallax projection still stands at its distance: a depth at or behind it is refused, and a layer a new distance leaves there hidden', () => {
    const warn = silenceWarnings();
    const projection = parallax(100);
    const art = new StageArt(sceneSource(), {name: 'kitchen', projection, compensateDepth: false});
    const box = art.layer('box').sprite;

    expect(() => art.set('box', {depth: -100})).toThrow(
      new RangeError(
        'ArtLayer "box": depth must be a number above -100 — the camera stands 100 artwork pixels in front of the plane —, got -100',
      ),
    );
    art.set('box', {depth: -80});
    // drawn as it is: k = 1
    expect([box.x, box.z, box.width]).toEqual([-10, 80, 40]);
    art.update();
    art.takeChanged();

    moveCamera(projection, 50);
    art.update();
    expect(box.visible).toBe(0);
    expect(art.takeChanged()).toBe(true);
    expect(behindTheCamera(warn)).toHaveLength(1);
    // nothing laid out anew
    expect([box.x, box.z, box.width, art.layer('back').sprite.width]).toEqual([-10, 80, 40, 100]);

    // a new distance that leaves it behind is no change
    moveCamera(projection, 60);
    art.update();
    expect(art.takeChanged()).toBe(false);
    moveCamera(projection, 100);
    art.update();
    expect(box.visible).toBe(1);
    expect(art.takeChanged()).toBe(true);
  });

  test('a layer the caller has hidden that a new distance leaves behind the camera is said once it would be shown', () => {
    const warn = silenceWarnings();
    const projection = parallax(100);
    const art = new StageArt(sceneSource(), {name: 'kitchen', projection});
    art.set('box', {depth: -80, visible: false});
    art.set('lamp', {depth: -80, opacity: 0});
    art.update();

    moveCamera(projection, 50);
    art.update();
    expect(behindTheCamera(warn)).toEqual([]);

    art.set('lamp', {opacity: 0.5});
    expect(art.layer('lamp').sprite.visible).toBe(0);
    expect(behindTheCamera(warn)).toHaveLength(1);
    expect(behindTheCamera(warn)[0]).toMatch(/^StageArt "kitchen": the layer "lamp", at a depth of -80, lies at or behind/);
    art.set('box', {visible: true});
    expect(art.layer('box').sprite.visible).toBe(0);
    expect(behindTheCamera(warn)).toHaveLength(2);
    art.set('box', {visible: false});
    art.set('box', {visible: true});
    expect(behindTheCamera(warn)).toHaveLength(2);
  });

  test('the plane setter turns the mesh in the next update(), writes no sprite, and an equal plane is no change', () => {
    const art = new StageArt(sceneSource());
    art.update();
    art.takeChanged();
    const box = art.layer('box').sprite;
    const held = [box.x, box.y, box.z, box.width, box.height];

    art.plane = 'xy|top-left';
    expect(art.plane.equals(ProjectionPlane.get('xy|top-left'))).toBe(true);
    expect(art.mesh.quaternion.equals(new Quaternion())).toBe(true);
    art.update();
    expect(art.mesh.quaternion.angleTo(facing('xy|top-left'))).toBeCloseTo(0, 6);
    expect(art.takeChanged()).toBe(true);
    expect([box.x, box.y, box.z, box.width, box.height]).toEqual(held);

    const turned = art.mesh.quaternion.clone();
    art.plane = new ProjectionPlane('xy|top-left');
    art.update();
    expect(art.takeChanged()).toBe(false);
    expect(art.mesh.quaternion.equals(turned)).toBe(true);

    art.plane = 'xy|bottom-left';
    art.update();
    expect(art.mesh.quaternion.equals(new Quaternion())).toBe(true);
    expect(art.takeChanged()).toBe(true);
  });

  test('the projection and plane setters refuse what they cannot use, and keep what they held', () => {
    const projection = new OrthographicProjection('xy|top-left');
    const art = new StageArt(sceneSource(), {name: 'kitchen', projection});

    expect(() => {
      art.plane = 'xy' as never;
    }).toThrow(
      new TypeError(
        'StageArt "kitchen": plane must be a ProjectionPlane or one of "xy|bottom-left", "xy|top-left", "xz|bottom-left", "xz|top-left", got "xy"',
      ),
    );
    expect(() => {
      art.plane = undefined as never;
    }).toThrow(/^StageArt "kitchen": plane must be a ProjectionPlane .*, got undefined$/);
    expect(() => {
      art.projection = {} as never;
    }).toThrow(new TypeError('StageArt "kitchen": projection must be an IProjection — stage.projection —, got {}'));
    expect(() => {
      art.projection = new Group() as never;
    }).toThrow(/^StageArt "kitchen": projection must be an IProjection — stage\.projection —, got Group$/);
    expect(art.projection).toBe(projection);
    expect(art.plane.equals(ProjectionPlane.get('xy|top-left'))).toBe(true);

    art.projection = undefined;
    expect(art.projection).toBeUndefined();
    expect(art.plane.equals(ProjectionPlane.get('xy|bottom-left'))).toBe(true);
  });

  test('an art handed a projection with a plane and a plane, by the options or the setters, says so once', () => {
    const warn = silenceWarnings();
    const art = new StageArt(sceneSource(), {plane: 'xz|bottom-left'});
    expect(warn).not.toHaveBeenCalled();

    art.projection = new OrthographicProjection('xy|top-left');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toMatch(/^StageArt: .*projection.*plane.*This warning is shown once per art\.$/);
    art.update();
    expect(art.mesh.quaternion.angleTo(facing('xy|top-left'))).toBeCloseTo(0, 6);

    art.plane = 'xz|top-left';
    art.projection = new OrthographicProjection('xy|bottom-left');
    expect(warn).toHaveBeenCalledOnce();

    // without the projection the art lies in its plane
    art.projection = undefined;
    art.update();
    expect(art.mesh.quaternion.angleTo(facing('xz|top-left'))).toBeCloseTo(0, 6);
  });
});

describe('a files source', () => {
  const BASE = 'https://example.test/kitchen/';

  interface ServedFile {
    width: number;
    height: number;
    // the pictures of the file, each a box of opaque pixels on the canvas
    boxes: {x: number; y: number; w: number; h: number}[];
    // the answer waits for it: a file the test holds back
    gate?: Promise<void>;
    // answered with this status instead
    status?: number;
    // the request fails with this error instead
    fail?: Error;
    // the decoding fails with this error instead
    undecodable?: Error;
    // the decoding waits for it: a bitmap the test holds back
    decodeGate?: Promise<void>;
  }

  interface FakeBitmap {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    close: ReturnType<typeof vi.fn>;
    file: string;
  }

  // the scene of the atlas specs above, as full-canvas files of 100 × 100: `back` at a depth of 50 the
  // canvas whole; `box`, closed and open; `lamp`, its pivot marker a dot at 64, 18
  const sceneFiles = (): Record<string, ServedFile> => ({
    'back@50.png': {width: 100, height: 100, boxes: [{x: 0, y: 0, w: 100, h: 100}]},
    'box.png': {width: 100, height: 100, boxes: [{x: 20, y: 30, w: 40, h: 20}]},
    'box-open.png': {width: 100, height: 100, boxes: [{x: 20, y: 20, w: 40, h: 30}]},
    'lamp.png': {width: 100, height: 100, boxes: [{x: 60, y: 10, w: 10, h: 10}]},
    'lamp.pivot.png': {width: 100, height: 100, boxes: [{x: 64, y: 18, w: 1, h: 1}]},
  });
  const SCENE_FILES = ['back@50.png', 'box.png', 'box-open.png', 'lamp.png', 'lamp.pivot.png'];

  // serves `files` under BASE through fetch() and createImageBitmap(), and builds canvases that record
  // what is drawn on them: a bitmap carries its pixels, which trimLayerImage() reads as they are
  const serve = (files: Record<string, ServedFile>) => {
    const requests: {url: string; signal: AbortSignal | undefined}[] = [];
    const bitmaps: FakeBitmap[] = [];
    const canvases: FakeCanvas[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      requests.push({url, signal: init?.signal ?? undefined});
      const name = decodeURIComponent(url.slice(BASE.length));
      const file = url.startsWith(BASE) ? files[name] : undefined;
      if (file === undefined) return new Response(null, {status: 404});
      await file.gate;
      if (file.fail !== undefined) throw file.fail;
      if (file.status !== undefined) return new Response(null, {status: file.status});
      return new Response(new Blob([name]));
    });
    vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
      const name = await blob.text();
      const file = files[name]!;
      await file.decodeGate;
      if (file.undecodable !== undefined) throw file.undecodable;
      const data = new Uint8ClampedArray(file.width * file.height * 4);
      for (const {x, y, w, h} of file.boxes) {
        for (let row = y; row < y + h; row++) data.fill(255, (row * file.width + x) * 4, (row * file.width + x + w) * 4);
      }
      const bitmap: FakeBitmap = {width: file.width, height: file.height, data, close: vi.fn(), file: name};
      bitmaps.push(bitmap);
      return bitmap;
    });
    vi.stubGlobal(
      'OffscreenCanvas',
      class extends FakeCanvas {
        constructor(width: number, height: number) {
          super(width, height);
          canvases.push(this);
        }
      },
    );
    return {requests, bitmaps, canvases};
  };

  const held = () => {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    return {gate, open};
  };

  // a renderer whose device allows textures up to `limit` texels across
  const rendererOf = (limit: number) =>
    ({backend: {device: {limits: {maxTextureDimension2D: limit}}}, render() {}}) as unknown as WebGPURenderer;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('knows its layers from the list at once, in its order, and draws each where its file put it once loaded', async () => {
    serve(sceneFiles());
    const art = new StageArt({files: SCENE_FILES, baseUrl: BASE}, {pxPerUnit: 2});
    expect(art.names).toEqual(['back', 'box', 'lamp']);
    expect(art.layer('box').sprite.visible).toBe(0);
    art.set('lamp', {deg: 90});

    await art.loaded;
    expect(art.problems).toEqual([]);
    expect(art.canvas).toEqual({width: 100, height: 100});
    const box = art.layer('box');
    expect(box.box).toEqual({x: 20, y: 20, w: 40, h: 30});
    expect(box.frameCount).toBe(2);
    expect([box.sprite.x, box.sprite.y, box.sprite.z]).toEqual([-5, 7.5, -0]);
    expect([box.sprite.width, box.sprite.height]).toEqual([20, 15]);
    expect(box.sprite.visible).toBe(1);
    expect(art.layer('back').sprite.z).toBe(-25);
    // the middle of the dot of the marker
    expect(art.layer('lamp').pivot).toEqual([64.5, 18.5]);
    expect(art.layer('lamp').sprite.rotation).toBeCloseTo(-Math.PI / 2, 6);
    expect(art.takeChanged()).toBe(true);
  });

  test('one request per file, side by side, each url the file under baseUrl with a # written %23', async () => {
    const files: Record<string, ServedFile> = {
      ...sceneFiles(),
      'steam#0.png': {width: 100, height: 100, boxes: [{x: 1, y: 1, w: 2, h: 2}]},
    };
    const {gate, open} = held();
    for (const file of Object.values(files)) file.gate = gate;
    const {requests} = serve(files);
    const art = new StageArt({files: [...SCENE_FILES, 'steam#0.png'], baseUrl: BASE});
    await flush();

    // every request is out before the first answer
    expect(requests.map(({url}) => url)).toEqual([...SCENE_FILES, 'steam%230.png'].map((file) => `${BASE}${file}`));
    open();
    await art.loaded;
    expect(art.names).toEqual(['back', 'box', 'lamp', 'steam']);
    expect(art.problems).toEqual([]);
  });

  test('packs the trimmed boxes into a DynamicAtlas of its own — the next power of two with padding 2 and extrude 1 — and closes every bitmap', async () => {
    const {bitmaps, canvases} = serve(sceneFiles());
    const art = new StageArt({files: SCENE_FILES, baseUrl: BASE});
    await art.loaded;

    const texture = art.mesh.getTexture('colorMap') as CanvasTexture;
    expect(texture).toBeInstanceOf(CanvasTexture);
    const canvas = texture.image as unknown as FakeCanvas;
    // 128 cannot hold the canvas-wide back beside the rest
    expect([canvas.width, canvas.height]).toEqual([256, 256]);
    expect(canvases).toEqual([canvas]);
    // each picture is drawn out of its file by its trimmed box, the marker not at all
    const drawn = canvas.context.callsOf('drawImage').filter(({args}) => bitmaps.includes(args[0] as FakeBitmap));
    expect(drawn.map(({args}) => [(args[0] as FakeBitmap).file, ...args.slice(1)])).toEqual([
      ['back@50.png', 0, 0, 100, 100, 0, 0, 100, 100],
      ['box.png', 20, 30, 40, 20, 0, 0, 40, 20],
      ['box-open.png', 20, 20, 40, 30, 0, 0, 40, 30],
      ['lamp.png', 60, 10, 10, 10, 0, 0, 10, 10],
    ]);
    // the first frame lies at padding 2 plus extrude 1
    expect(drawn[0]!.translation).toEqual([3, 3]);
    expect(bitmaps).toHaveLength(5);
    for (const bitmap of bitmaps) expect(bitmap.close).toHaveBeenCalledOnce();
  });

  test('sizes the atlas up to the limit of options.renderer; a set that does not fit is one problem of the source naming the size and two arts', async () => {
    const warn = silenceWarnings();
    const {bitmaps} = serve(sceneFiles());
    const art = new StageArt({files: SCENE_FILES, baseUrl: BASE}, {renderer: rendererOf(128)});
    await art.loaded;

    expect(art.problems).toEqual([
      {
        layer: undefined,
        reason:
          'the trimmed pictures of the 4 files to draw do not fit into an atlas of 128 × 128 with padding 2 and extrude 1, the largest the renderer allows — split the files between two arts, each with a renderOrder of its own',
      },
    ]);
    expect(art.names).toEqual(['back', 'box', 'lamp']);
    expect(art.layer('box').sprite.visible).toBe(0);
    expect(art.layer('box').loaded).toBe(false);
    expect(art.mesh.getTexture('colorMap')).toBeUndefined();
    for (const bitmap of bitmaps) expect(bitmap.close).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();

    serve(sceneFiles());
    const roomy = new StageArt({files: SCENE_FILES, baseUrl: BASE}, {renderer: rendererOf(16384)});
    await roomy.loaded;
    expect(roomy.problems).toEqual([]);
    expect((roomy.mesh.getTexture('colorMap')!.image as {width: number}).width).toBe(256);
  });

  test('before a renderer is known the atlas goes up to 4096, and the refusal names the renderer as well', async () => {
    silenceWarnings();
    serve({wide: {width: 5000, height: 10, boxes: [{x: 0, y: 0, w: 4100, h: 2}]}});
    const art = new StageArt({files: ['wide'], baseUrl: BASE});
    await art.loaded;

    expect(art.problems).toEqual([
      {
        layer: undefined,
        reason:
          'the trimmed pictures of the 1 file to draw do not fit into an atlas of 4096 × 4096 with padding 2 and extrude 1, the largest before a renderer is known — hand the art its renderer (options.renderer) for the limit of its device, or split the files between two arts, each with a renderOrder of its own',
      },
    ]);
  });

  test('a file that fails is a problem of its layer, one per failing url; its layer stays hidden and the rest goes on', async () => {
    silenceWarnings();
    const files = sceneFiles();
    files['lamp.png']!.status = 404;
    files['box-open.png']!.fail = new TypeError('Failed to fetch');
    files['back@50.png']!.undecodable = new Error('The source image could not be decoded.');
    serve(files);
    const art = new StageArt({files: SCENE_FILES, baseUrl: BASE});
    await art.loaded;

    expect(art.problems).toEqual([
      {
        layer: 'back',
        reason: 'the file "back@50.png" could not be decoded as an image: The source image could not be decoded.',
        url: `${BASE}back@50.png`,
      },
      {layer: 'box', reason: 'the file "box-open.png" did not load: Failed to fetch', url: `${BASE}box-open.png`},
      {layer: 'lamp', reason: 'the file "lamp.png" did not load: the server answered 404', url: `${BASE}lamp.png`},
    ]);
    expect(art.layer('back').sprite.visible).toBe(0);
    expect(art.layer('lamp').sprite.visible).toBe(0);
    expect(art.layer('lamp').loaded).toBe(false);
    expect(art.layer('box').sprite.visible).toBe(1);
    expect(art.layer('box').frameCount).toBe(2);
    expect(art.layer('box').box).toEqual({x: 20, y: 30, w: 40, h: 20});
  });

  test('a file of another canvas size is a problem of its layer; the canvas is the size of the first file that loaded', async () => {
    silenceWarnings();
    const files = sceneFiles();
    files['back@50.png']!.status = 500;
    files['lamp.png'] = {width: 200, height: 100, boxes: [{x: 60, y: 10, w: 10, h: 10}]};
    const {bitmaps} = serve(files);
    const art = new StageArt({files: SCENE_FILES, baseUrl: BASE});
    await art.loaded;

    expect(art.canvas).toEqual({width: 100, height: 100});
    expect(art.problems).toEqual([
      {layer: 'back', reason: 'the file "back@50.png" did not load: the server answered 500', url: `${BASE}back@50.png`},
      {
        layer: 'lamp',
        reason:
          'the file "lamp.png" is 200 × 100, and the canvas — the size of "box.png", the first file that loaded — is 100 × 100',
        url: `${BASE}lamp.png`,
      },
    ]);
    expect(art.layer('lamp').sprite.visible).toBe(0);
    for (const bitmap of bitmaps) expect(bitmap.close).toHaveBeenCalledOnce();
  });

  test('a promise of a files source is read once it is there', async () => {
    serve(sceneFiles());
    const {promise, resolve} = heldBack();
    const art = new StageArt(promise);
    expect(art.names).toEqual([]);

    resolve({files: SCENE_FILES, baseUrl: BASE});
    await art.loaded;
    expect(art.names).toEqual(['back', 'box', 'lamp']);
    expect(art.layer('lamp').sprite.visible).toBe(1);
  });

  test('dispose() during the load drops it: the requests are aborted, the bitmaps that arrived are closed at once, one that lands later when it lands, and no atlas is built', async () => {
    const files = sceneFiles();
    const {gate, open} = held();
    // the request of the lamp is answered, its decoding held back: aborting the request cannot stop it
    files['lamp.png']!.decodeGate = gate;
    const {requests, bitmaps, canvases} = serve(files);
    const art = new StageArt({files: SCENE_FILES, baseUrl: BASE});
    for (let i = 0; i < 5; i++) await flush();
    expect(bitmaps).toHaveLength(4);

    art.dispose();
    await expect(art.loaded).resolves.toBeUndefined();
    for (const bitmap of bitmaps) expect(bitmap.close).toHaveBeenCalledOnce();
    expect(requests.every(({signal}) => signal?.aborted === true)).toBe(true);

    open();
    for (let i = 0; i < 5; i++) await flush();
    expect(bitmaps).toHaveLength(5);
    expect(bitmaps[4]!.close).toHaveBeenCalledOnce();
    expect(canvases).toEqual([]);
    expect(art.problems).toEqual([]);
    expect(art.mesh.getTexture('colorMap')).toBeUndefined();
  });

  test('dispose() releases the DynamicAtlas the art packed its files into, and its texture', async () => {
    serve(sceneFiles());
    const art = new StageArt({files: SCENE_FILES, baseUrl: BASE});
    await art.loaded;
    const texture = art.mesh.getTexture('colorMap')!;
    const canvas = texture.image as unknown as FakeCanvas;
    const textureDispose = vi.spyOn(texture, 'dispose');

    art.dispose();
    expect(textureDispose).toHaveBeenCalledOnce();
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  test('refuses a renderer that is no renderer', () => {
    expect(() => new StageArt(sceneSource(), {renderer: 5 as never})).toThrow(
      new TypeError('new StageArt(): renderer must be the WebGPURenderer the art is drawn with, got 5'),
    );
  });
});
