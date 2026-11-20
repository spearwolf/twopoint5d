import {readFileSync} from 'node:fs';
import {Group, ImageLoader, Plane, Quaternion, Texture, Vector3, type WebGPURenderer} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';

import {OrthographicProjection} from '../stage/OrthographicProjection.js';
import {ProjectionPlane} from '../stage/ProjectionPlane.js';
import {AsepriteJson, type AsepriteJsonData} from '../texture/AsepriteJson.js';
import type {TextureAtlas} from '../texture/TextureAtlas.js';
import {TexturePackerJson, type TexturePackerJsonData} from '../texture/TexturePackerJson.js';
import {TextureStore} from '../texture/TextureStore.js';
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

// a store whose item `scene` is the scene above, its json and its image answered at once
const makeStore = () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(sceneJson())));
  vi.spyOn(ImageLoader.prototype, 'loadAsync').mockResolvedValue({width: 256, height: 128} as unknown as HTMLImageElement);
  const store = new TextureStore({getMaxAnisotropy: () => 16, dispose() {}} as unknown as WebGPURenderer);
  store.parse({items: {scene: {atlasUrl: 'scene.json'}}});
  return store;
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
      for (const source of [undefined, null, 5, {}, {store: {}, id: 'a'}, {atlas: sceneAtlas()}, {files: ['a.png']}]) {
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
    const art = new StageArt(Promise.resolve({files: []} as never));
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
    const art = new StageArt({store, id: 'scene'});
    art.dispose();
    await flush();
    await flush();
    const resource = await store.whenResource('scene');

    expect(acquireSpy).toHaveBeenCalledExactlyOnceWith('scene', ['atlas', 'texture']);
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
