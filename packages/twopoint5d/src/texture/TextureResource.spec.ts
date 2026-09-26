import {getSubscriptionCount, on} from '@spearwolf/eventize';
import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {ImageLoader, type Texture} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';

import {TextureResource} from './TextureResource.js';
import {TexturePackerJson} from './TexturePackerJson.js';
import type {FrameBasedAnimationsDataMap} from './types.js';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

interface StubTexture {
  tag: string;
  name: string;
  disposed: boolean;
  dispose(): void;
}

interface StubImage {
  width: number;
  height: number;
  tag: string;
}

/**
 * A stand-in for `TextureFactory` that hands out textures which remember whether they
 * were released — the state every test in here measures.
 */
const makeTextureFactory = () => {
  const textures: StubTexture[] = [];
  const factory = {
    create(image: StubImage): StubTexture {
      const texture: StubTexture = {
        tag: image.tag,
        name: '',
        disposed: false,
        dispose() {
          this.disposed = true;
        },
      };
      textures.push(texture);
      return texture;
    },
  };
  return {factory: factory as never, textures};
};

const asStub = (texture: Texture | undefined): StubTexture | undefined => texture as unknown as StubTexture | undefined;

describe('TextureResource', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('texture ownership', () => {
    test('a texture reaches the texture event only while it is alive', async () => {
      let resolveFirst!: (image: StubImage) => void;
      let resolveSecond!: (image: StubImage) => void;
      const firstImage = new Promise<StubImage>((resolve) => {
        resolveFirst = resolve;
      });
      const secondImage = new Promise<StubImage>((resolve) => {
        resolveSecond = resolve;
      });

      vi.spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementationOnce(() => firstImage as unknown as Promise<HTMLImageElement>)
        .mockImplementationOnce(() => secondImage as unknown as Promise<HTMLImageElement>);

      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('rx', 'first.png');
      resource.load();

      const deliveries: Array<{tag: string; disposed: boolean}> = [];
      on(resource, 'texture', (texture: StubTexture | undefined) => {
        if (texture) {
          deliveries.push({tag: texture.tag, disposed: texture.disposed});
        }
      });

      resource.textureFactory = factory;

      resolveFirst({width: 100, height: 50, tag: 'first'});
      await flushMicrotasks();

      expect(deliveries).toEqual([{tag: 'first', disposed: false}]);
      expect(asStub(resource.texture)).toBe(textures[0]);

      resource.imageUrl = 'second.png';

      // the predecessor is still the published value here — releasing it now would leave
      // every subscriber, and the getter, pointing at a texture that is already gone
      expect(textures[0]!.disposed).toBe(false);
      expect(asStub(resource.texture)).toBe(textures[0]);

      resolveSecond({width: 200, height: 100, tag: 'second'});
      await flushMicrotasks();

      expect(deliveries).toEqual([
        {tag: 'first', disposed: false},
        {tag: 'second', disposed: false},
      ]);
      expect(asStub(resource.texture)).toBe(textures[1]);
      expect(textures[0]!.disposed).toBe(true);
      expect(textures[1]!.disposed).toBe(false);

      resource.dispose();
    });

    // every image is 8 x 8 and tagged with the url it was loaded from
    const stubImagesByUrl = () =>
      vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async (url: string) => ({width: 8, height: 8, tag: url}) as unknown as HTMLImageElement);

    test('a subscriber of the texture that throws leaves the texture to the resource', async () => {
      stubImagesByUrl();
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('rx', 'a.png');
      resource.load();

      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => errors.push(payload));
      on(resource, 'texture', () => {
        throw new Error('a subscriber that throws');
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'texture', id: 'rx'});
      expect(asStub(resource.texture)).toBe(textures[0]);

      resource.dispose();

      expect(textures[0]!.disposed).toBe(true);
    });

    test('a texture published by a batch that threw is released by its successor', async () => {
      stubImagesByUrl();
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('rx', 'a.png');
      resource.load();

      on(resource, 'error', () => {});
      on(resource, 'texture', (texture: StubTexture) => {
        if (texture.tag === 'a.png') throw new Error('a subscriber that throws');
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      resource.imageUrl = 'b.png';
      await flushMicrotasks();

      expect(asStub(resource.texture)).toBe(textures[1]);
      expect(textures[0]!.disposed).toBe(true);
      expect(textures[1]!.disposed).toBe(false);

      resource.dispose();
    });

    test('a resource disposed by a subscriber of its new texture releases both textures', async () => {
      stubImagesByUrl();
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('rx', 'a.png');
      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();

      on(resource, 'texture', (texture: StubTexture) => {
        if (texture.tag === 'b.png') resource.dispose();
      });

      resource.imageUrl = 'b.png';
      await flushMicrotasks();

      expect(textures.map(({tag, disposed}) => ({tag, disposed}))).toEqual([
        {tag: 'a.png', disposed: true},
        {tag: 'b.png', disposed: true},
      ]);
    });
  });

  describe('dispose()', () => {
    const loadTexture = async (id: string, tag: string) => {
      const {factory, textures} = makeTextureFactory();
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 8, height: 8, tag}) as unknown as HTMLImageElement,
      );

      const resource = TextureResource.fromImage(id, `${tag}.png`);
      resource.load();
      resource.textureFactory = factory;

      await flushMicrotasks();

      return {resource, textures};
    };

    // (a) a resource the instance built itself is released exactly once
    test('disposes the texture it created itself', async () => {
      const {resource, textures} = await loadTexture('own', 'own');
      const textureDispose = sandbox.spy(textures[0]!, 'dispose');

      resource.dispose();

      expect(textureDispose.calledOnce).toBe(true);
      expect(resource.texture).toBeUndefined();
    });

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose the texture factory it was handed', () => {
      const {factory} = makeTextureFactory();
      const disposableFactory = Object.assign(factory as object, {dispose() {}});
      const factoryDispose = sandbox.spy(disposableFactory, 'dispose');

      const resource = TextureResource.fromImage('handed-in', 'handed-in.png');
      resource.load();
      resource.textureFactory = disposableFactory as never;

      resource.dispose();

      expect(factoryDispose.called).toBe(false);
    });

    // (c) every public member behaves after dispose() as its TSDoc says.
    // There is no member of the second kind here — no getter of this class is typed as
    // always present — so the "throws" assertion of the pattern has no subject.
    test('behaves as documented after dispose()', async () => {
      const {resource} = await loadTexture('documented', 'documented');

      resource.dispose();

      expect(resource.texture).toBeUndefined();
      expect(resource.id).toBe('documented');
      expect(resource.type).toBe('image');
      expect(resource.imageUrl).toBeUndefined();
      expect(resource.imageCoords).toBeUndefined();
      expect(resource.textureFactory).toBeUndefined();
      expect(() => {
        resource.imageUrl = undefined;
      }).not.toThrow();
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', async () => {
      const {resource, textures} = await loadTexture('twice', 'twice');
      const textureDispose = sandbox.spy(textures[0]!, 'dispose');

      expect(() => {
        resource.dispose();
        resource.dispose();
      }).not.toThrow();

      expect(textureDispose.calledOnce).toBe(true);
    });

    // (e) no signal or effect outlives the instance
    test('does not leak signals or effects', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      const resource = TextureResource.fromImage('counted', 'counted.png');
      resource.load();

      expect(getSignalsCount()).toBeGreaterThan(baselineSignals);
      expect(getEffectsCount()).toBeGreaterThan(baselineEffects);

      resource.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    // (f) has no subject here: TextureFactory#create() builds a new Texture and keeps no
    // record of it — there is no call that would give one back. The texture a resource
    // materializes is its own, and case (a) covers its release.
  });

  describe('frame based animations', () => {
    test('a tileset resource reports animation data it cannot use', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16}, undefined, {
        walk: {duration: 1, frameNameQuery: 'walk.*'},
      });
      resource.load();

      const errors: Array<{source: string; id: string; animation: string; error: Error}> = [];
      on(resource, 'error', (payload: {source: string; id: string; animation: string; error: Error}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('frameBasedAnimations');
      expect(errors[0]!.id).toBe('tiles');
      expect(errors[0]!.animation).toBe('walk');

      // an animation that was registered answers with its id; a name that never made it in
      // has no entry to read one from
      expect(() => resource.frameBasedAnimations!.animId('walk')).toThrow(
        'FrameBasedAnimations: there is no animation named "walk"',
      );

      resource.dispose();
    });

    test('an atlas resource reports animation data it cannot use', async () => {
      const atlasJson = {
        frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
        meta: {image: 'atlas.png', size: {w: 16, h: 16}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json', undefined, undefined, {
        walk: {duration: 1, tileIds: [1, 2]},
      });
      resource.load();

      const errors: Array<{source: string; animation: string}> = [];
      on(resource, 'error', (payload: {source: string; animation: string}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('frameBasedAnimations');
      expect(errors[0]!.animation).toBe('walk');
      expect(() => resource.frameBasedAnimations!.animId('walk')).toThrow(
        'FrameBasedAnimations: there is no animation named "walk"',
      );

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('a tileset resource skips an animation entry that is no object', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16}, undefined, {
        // the catalog json carries what it carries
        walk: null,
        run: {duration: 1, tileIds: [1, 2]},
      } as unknown as FrameBasedAnimationsDataMap);
      resource.load();

      const errors: Array<{source: string; id: string; animation?: string; error: Error}> = [];
      on(resource, 'error', (payload: {source: string; id: string; animation?: string; error: Error}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('frameBasedAnimations');
      expect(errors[0]!.animation).toBe('walk');
      expect(errors.some((e) => e.source === 'texture')).toBe(false);

      expect(resource.frameBasedAnimations!.hasAnimation('run')).toBe(true);
      expect(resource.frameBasedAnimations!.hasAnimation('walk')).toBe(false);

      resource.dispose();
    });

    test('an atlas resource skips an animation entry that is no object', async () => {
      const atlasJson = {
        frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
        meta: {image: 'atlas.png', size: {w: 16, h: 16}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json', undefined, undefined, {
        // the catalog json carries what it carries
        walk: null,
        run: {duration: 1, frameNameQuery: 'idle.*'},
      } as unknown as FrameBasedAnimationsDataMap);
      resource.load();

      const errors: Array<{source: string; id?: string; animation?: string; error: Error}> = [];
      on(resource, 'error', (payload: {source: string; id?: string; animation?: string; error: Error}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('frameBasedAnimations');
      expect(errors[0]!.animation).toBe('walk');
      expect(errors.some((e) => e.source === 'texture')).toBe(false);

      expect(resource.frameBasedAnimations!.hasAnimation('run')).toBe(true);
      expect(resource.frameBasedAnimations!.hasAnimation('walk')).toBe(false);

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('an animation entry without a duration and without a frameRate is skipped and reported', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16}, undefined, {
        // the animation data of a store comes out of json, where neither of the two timing
        // fields has to be there
        walk: {tileIds: [1, 2]},
        idle: {duration: 1, tileIds: [3, 4]},
      } as unknown as FrameBasedAnimationsDataMap);
      resource.load();

      const errors: Array<{source: string; id: string; animation: string; error: Error}> = [];
      on(resource, 'error', (payload: {source: string; id: string; animation: string; error: Error}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('frameBasedAnimations');
      expect(errors[0]!.id).toBe('tiles');
      expect(errors[0]!.animation).toBe('walk');

      // the entry beside it is registered all the same
      expect(resource.frameBasedAnimations!.animId('idle')).toBe(0);

      resource.dispose();
    });

    test('an animation entry with a frameRate of 0 is skipped and reported', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16}, undefined, {
        walk: {frameRate: 0, tileIds: [1, 2]},
        idle: {frameRate: 2, tileIds: [3, 4]},
      });
      resource.load();

      const errors: Array<{source: string; animation: string}> = [];
      on(resource, 'error', (payload: {source: string; animation: string}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('frameBasedAnimations');
      expect(errors[0]!.animation).toBe('walk');

      expect(resource.frameBasedAnimations!.animId('idle')).toBe(0);

      resource.dispose();
    });

    test('an atlas animation entry whose timing does not carry is skipped and reported', async () => {
      const atlasJson = {
        frames: {
          walk_1: {frame: {x: 0, y: 0, w: 8, h: 8}},
          walk_2: {frame: {x: 8, y: 0, w: 8, h: 8}},
          idle_1: {frame: {x: 0, y: 8, w: 8, h: 8}},
        },
        meta: {image: 'atlas.png', size: {w: 16, h: 16}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json', undefined, undefined, {
        // the animation data of a store comes out of json, where neither of the two timing
        // fields has to be there
        walk: {frameNameQuery: 'walk_.*'},
        idle: {duration: 1, frameNameQuery: 'idle_.*'},
      } as unknown as FrameBasedAnimationsDataMap);
      resource.load();

      const errors: Array<{source: string; id: string; animation: string; error: Error}> = [];
      on(resource, 'error', (payload: {source: string; id: string; animation: string; error: Error}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('frameBasedAnimations');
      expect(errors[0]!.id).toBe('sprites');
      expect(errors[0]!.animation).toBe('walk');

      // the entry beside it is registered all the same
      expect(resource.frameBasedAnimations!.animId('idle')).toBe(0);

      resource.dispose();
      fetchMock.mockRestore();
    });

    const tileAnimationsData: FrameBasedAnimationsDataMap = {walk: {duration: 1, firstTileId: 1, tileCount: 2}};

    // a tile set resource loaded until its animations stand
    const loadedTileSetResource = async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet(
        'tiles',
        'tiles.png',
        {tileWidth: 16, tileHeight: 16},
        undefined,
        tileAnimationsData,
      );
      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(resource.frameBasedAnimations).toBeDefined();

      return resource;
    };

    test('a tile set resource takes its animations back when its animation data is cleared', async () => {
      const resource = await loadedTileSetResource();

      resource.frameBasedAnimationsData = undefined;

      expect(resource.frameBasedAnimations).toBeUndefined();

      const animationsSpy = vi.fn();
      on(resource, 'frameBasedAnimations', animationsSpy);
      expect(animationsSpy).not.toHaveBeenCalled();

      resource.dispose();
    });

    test('an atlas resource takes its animations back when its animation data is cleared', async () => {
      const atlasJson = {
        frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
        meta: {image: 'atlas.png', size: {w: 16, h: 16}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json', undefined, undefined, {
        idle: {duration: 1, frameNameQuery: 'idle.*'},
      });
      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.frameBasedAnimations).toBeDefined();

      resource.frameBasedAnimationsData = undefined;

      expect(resource.frameBasedAnimations).toBeUndefined();

      const animationsSpy = vi.fn();
      on(resource, 'frameBasedAnimations', animationsSpy);
      expect(animationsSpy).not.toHaveBeenCalled();

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('animations cleared with their data come back with new data', async () => {
      const resource = await loadedTileSetResource();

      resource.frameBasedAnimationsData = undefined;
      resource.frameBasedAnimationsData = {run: {duration: 1, tileIds: [3, 4]}};

      expect(resource.frameBasedAnimations).toBeDefined();
      expect(resource.frameBasedAnimations!.hasAnimation('run')).toBe(true);
      expect(resource.frameBasedAnimations!.hasAnimation('walk')).toBe(false);

      const animationsSpy = vi.fn();
      on(resource, 'frameBasedAnimations', animationsSpy);
      expect(animationsSpy).toHaveBeenCalledTimes(1);

      resource.dispose();
    });

    test('fromAtlas accepts initial frameBasedAnimations data', () => {
      const resource = TextureResource.fromAtlas('a', 'atlas.json', undefined, undefined, {
        idle: {duration: 1, frameNameQuery: 'idle.*'},
      });
      expect(resource.frameBasedAnimationsData).toEqual({idle: {duration: 1, frameNameQuery: 'idle.*'}});
    });

    test('fromImage accepts (but ignores) frameBasedAnimationsData setter without a signal', () => {
      const resource = TextureResource.fromImage('i', 'img.png');
      resource.frameBasedAnimationsData = {x: {duration: 1, tileIds: [1]}};
      expect(resource.frameBasedAnimationsData).toEqual({x: {duration: 1, tileIds: [1]}});
    });
  });

  describe('what a subscriber sees', () => {
    test('a tile set is on the resource by the time the imageCoords event arrives', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16});
      resource.load();

      const seen: Array<{tileSet: unknown; atlas: unknown}> = [];
      on(resource, 'imageCoords', () => {
        // read off the resource, not out of the payload: the question is what is already
        // there when this bridge fires, and the priority of the derived effects is what
        // answers it
        seen.push({tileSet: resource.tileSet, atlas: resource.atlas});
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(seen).toHaveLength(1);
      expect(seen[0]!.tileSet).toBeDefined();
      expect(seen[0]!.atlas).toBeDefined();

      resource.dispose();
    });

    test('an atlas is on the resource by the time the imageCoords event arrives', async () => {
      const atlasJson = {
        frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
        meta: {image: 'atlas.png', size: {w: 16, h: 16}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      resource.load();

      const seen: unknown[] = [];
      on(resource, 'imageCoords', () => {
        seen.push(resource.atlas);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(seen).toHaveLength(1);
      expect(seen[0]).toBeDefined();

      resource.dispose();
      fetchMock.mockRestore();
    });
  });

  describe('atlas fetch', () => {
    test('a response that answers with a status is reported instead of parsed', async () => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('{"frames":{},"meta":{"image":"x.png","size":{"w":1,"h":1}}}', {status: 500}));

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      const errors: Array<{source: string; url: string; status?: number}> = [];
      on(resource, 'error', (payload: {source: string; url: string; status?: number}) => {
        errors.push(payload);
      });

      resource.load();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('atlas');
      expect(errors[0]!.url).toBe('atlas.json');
      expect(errors[0]!.status).toBe(500);
      expect(resource.atlasJson).toBeUndefined();

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('a 200 response that is no atlas json is reported instead of set', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({hello: 'world'})));

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      const errors: Array<{source: string; url: string; error: Error}> = [];
      on(resource, 'error', (payload: {source: string; url: string; error: Error}) => {
        errors.push(payload);
      });

      resource.load();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('atlas');
      expect(errors[0]!.url).toBe('atlas.json');
      expect(errors[0]!.error.message).toMatch(/is no texture atlas json/);
      expect(resource.atlasJson).toBeUndefined();

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('an atlas json that names no image and has no override is reported', async () => {
      const atlasJson = {
        frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}},
        meta: {size: {w: 16, h: 16}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      const errors: Array<{source: string}> = [];
      on(resource, 'error', (payload: {source: string}) => {
        errors.push(payload);
      });

      resource.load();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('atlas');
      expect(resource.imageUrl).toBeUndefined();

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('an atlas json without an image loads with an overrideImageUrl', async () => {
      const atlasJson = {
        frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}},
        meta: {size: {w: 16, h: 16}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      const loadAsyncSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement);
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json', 'override.png');
      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => {
        errors.push(payload);
      });

      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toHaveLength(0);
      expect(resource.atlasJson?.meta.image).toBe('override.png');

      resource.dispose();
      loadAsyncSpy.mockRestore();
      fetchMock.mockRestore();
    });

    // `fetch` as the tests below need it: every call keeps the signal it was given and answers
    // when the test says so — or rejects with an AbortError once that signal is aborted, which is
    // what a real `fetch` does
    const stubAbortableFetch = () => {
      const calls: Array<{signal: AbortSignal; resolve: (response: Response) => void}> = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        const signal = init!.signal!;
        return new Promise<Response>((resolve, reject) => {
          calls.push({signal, resolve});
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      });
      return calls;
    };

    test('dispose() while the atlas fetch is in flight aborts the fetch and loads no image', async () => {
      const calls = stubAbortableFetch();
      const loadAsyncSpy = vi.spyOn(ImageLoader.prototype, 'loadAsync');

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      resource.load();
      resource.textureFactory = makeTextureFactory().factory;

      expect(calls).toHaveLength(1);
      expect(calls[0]!.signal.aborted).toBe(false);

      resource.dispose();

      expect(calls[0]!.signal.aborted).toBe(true);

      await flushMicrotasks();
      await flushMicrotasks();

      expect(loadAsyncSpy).not.toHaveBeenCalled();
    });

    test('an atlasUrl that changes while its fetch is in flight aborts that fetch, and the json of the new url builds the atlas', async () => {
      const calls = stubAbortableFetch();
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async (url) => ({width: 16, height: 16, tag: url}) as unknown as HTMLImageElement,
      );

      const resource = TextureResource.fromAtlas('sprites', 'first.json');
      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => {
        errors.push(payload);
      });

      resource.load();
      resource.textureFactory = makeTextureFactory().factory;

      resource.atlasUrl = 'second.json';

      expect(calls).toHaveLength(2);
      expect(calls[0]!.signal.aborted).toBe(true);
      expect(calls[1]!.signal.aborted).toBe(false);

      calls[1]!.resolve(
        new Response(
          JSON.stringify({
            frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
            meta: {image: 'second.png', size: {w: 16, h: 16}},
          }),
        ),
      );
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toEqual([]);
      expect(resource.imageUrl).toBe('second.png');
      expect(resource.atlas!.frameNames()).toEqual(['idle.1']);

      resource.dispose();
    });

    describe('an overrideImageUrl that is cleared again', () => {
      const atlasJson = {
        frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
        meta: {image: 'atlas.png', size: {w: 16, h: 16}},
      };

      test('clearing the overrideImageUrl gives the image back to the one the json names', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
        const loadAsyncSpy = vi
          .spyOn(ImageLoader.prototype, 'loadAsync')
          .mockImplementation(async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement);
        const {factory} = makeTextureFactory();

        const resource = TextureResource.fromAtlas('sprites', 'atlas.json', 'override.png');
        resource.load();
        resource.textureFactory = factory;
        await flushMicrotasks();
        await flushMicrotasks();

        expect(resource.imageUrl).toBe('override.png');

        resource.overrideImageUrl = undefined;
        await flushMicrotasks();
        await flushMicrotasks();

        expect(resource.imageUrl).toBe('atlas.png');
        expect(resource.atlasJson?.meta.image).toBe('atlas.png');
        expect(loadAsyncSpy).toHaveBeenLastCalledWith('atlas.png');

        resource.dispose();
        loadAsyncSpy.mockRestore();
        fetchMock.mockRestore();
      });

      test('a json without an image reports an override that is cleared again', async () => {
        const fetchMock = vi
          .spyOn(globalThis, 'fetch')
          .mockResolvedValue(new Response(JSON.stringify({frames: atlasJson.frames, meta: {size: atlasJson.meta.size}})));
        const loadAsyncSpy = vi
          .spyOn(ImageLoader.prototype, 'loadAsync')
          .mockImplementation(async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement);
        const {factory} = makeTextureFactory();

        const resource = TextureResource.fromAtlas('sprites', 'atlas.json', 'override.png');
        const errors: Array<{source: string; url?: string}> = [];
        on(resource, 'error', (payload: {source: string; url?: string}) => {
          errors.push(payload);
        });

        resource.load();
        resource.textureFactory = factory;
        await flushMicrotasks();
        await flushMicrotasks();

        expect(errors).toHaveLength(0);
        expect(resource.imageUrl).toBe('override.png');

        resource.overrideImageUrl = undefined;
        await flushMicrotasks();
        await flushMicrotasks();

        expect(errors).toHaveLength(1);
        expect(errors[0]!.source).toBe('atlas');
        expect(errors[0]!.url).toBe('atlas.json');
        expect(resource.imageUrl).toBe('override.png');

        resource.dispose();
        loadAsyncSpy.mockRestore();
        fetchMock.mockRestore();
      });

      test('a json written from outside stays when the override changes', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
        const loadAsyncSpy = vi
          .spyOn(ImageLoader.prototype, 'loadAsync')
          .mockImplementation(async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement);
        const {factory} = makeTextureFactory();

        const resource = TextureResource.fromAtlas('sprites', 'atlas.json', 'override.png');
        resource.load();
        resource.textureFactory = factory;
        await flushMicrotasks();
        await flushMicrotasks();

        const own = {
          frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
          meta: {image: 'own.png', size: {w: 16, h: 16}},
        };
        resource.atlasJson = own;
        resource.overrideImageUrl = undefined;
        await flushMicrotasks();
        await flushMicrotasks();

        expect(resource.atlasJson).toBe(own);
        expect(resource.imageUrl).toBe('own.png');

        resource.dispose();
        loadAsyncSpy.mockRestore();
        fetchMock.mockRestore();
      });
    });
  });

  describe('an atlas json that is cleared or cannot be read', () => {
    const atlasJson = {
      frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
      meta: {image: 'atlas.png', size: {w: 16, h: 16}},
    };

    // frames without a `frame` rectangle: TexturePackerJson has no coordinates to read
    const unreadableJson = (image: string) => ({frames: {a: {}}, meta: {image, size: {w: 16, h: 16}}}) as never;

    // an atlas resource loaded until its atlas and its animations stand
    const loadedAtlasResource = async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async (url: string) => ({width: 16, height: 16, tag: url}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json', undefined, undefined, {
        idle: {duration: 1, frameNameQuery: 'idle.*'},
      });
      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.atlas).toBeDefined();
      expect(resource.frameBasedAnimations).toBeDefined();

      const errors: Array<{source: string; id?: string; error: unknown}> = [];
      on(resource, 'error', (payload: {source: string; id?: string; error: unknown}) => errors.push(payload));

      return {resource, errors, fetchMock};
    };

    test('clearing the atlasJson takes the atlas and its animations back and keeps the texture', async () => {
      const {resource, errors, fetchMock} = await loadedAtlasResource();
      const texture = resource.texture;
      expect(texture).toBeDefined();

      resource.atlasJson = undefined;

      expect(resource.atlas).toBeUndefined();
      expect(resource.frameBasedAnimations).toBeUndefined();
      expect(resource.texture).toBe(texture);
      expect(errors).toHaveLength(0);

      const atlasSpy = vi.fn();
      const animationsSpy = vi.fn();
      on(resource, 'atlas', atlasSpy);
      on(resource, 'frameBasedAnimations', animationsSpy);
      expect(atlasSpy).not.toHaveBeenCalled();
      expect(animationsSpy).not.toHaveBeenCalled();

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('an atlasJson that TexturePackerJson cannot read is reported and takes the atlas back', async () => {
      const {resource, errors, fetchMock} = await loadedAtlasResource();

      expect(() => {
        resource.atlasJson = unreadableJson('atlas.png');
      }).not.toThrow();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'texture', id: 'sprites'});
      expect(resource.atlas).toBeUndefined();
      expect(resource.frameBasedAnimations).toBeUndefined();

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('an unreadable atlasJson naming another image is reported once that image is there', async () => {
      const {resource, errors, fetchMock} = await loadedAtlasResource();
      const atlas = resource.atlas;

      resource.atlasJson = unreadableJson('other.png');

      // the image the json names is still on its way: the atlas of the one before stays
      expect(resource.atlas).toBe(atlas);
      expect(errors).toHaveLength(0);

      await flushMicrotasks();

      expect(resource.imageUrl).toBe('other.png');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'texture', id: 'sprites'});
      expect(resource.atlas).toBeUndefined();
      expect(resource.frameBasedAnimations).toBeUndefined();

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('a readable atlasJson after an unreadable one brings the atlas back', async () => {
      const {resource, fetchMock} = await loadedAtlasResource();

      resource.atlasJson = unreadableJson('atlas.png');
      resource.atlasJson = {...atlasJson, meta: {...atlasJson.meta}};

      expect(resource.atlas).toBeDefined();
      expect(resource.frameBasedAnimations).toBeDefined();
      expect(resource.frameBasedAnimations!.hasAnimation('idle')).toBe(true);

      resource.dispose();
      fetchMock.mockRestore();
    });
  });

  describe('error sources', () => {
    test('an image load that rejects is reported as an image failure', async () => {
      const loadError = new Error('boom');
      const loadAsyncSpy = vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(() => Promise.reject(loadError));
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromImage('hero', 'hero.png');
      const errors: Array<{source: string; url?: string; error?: unknown}> = [];
      on(resource, 'error', (payload: {source: string; url?: string; error?: unknown}) => {
        errors.push(payload);
      });

      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('image');
      expect(errors[0]!.url).toBe('hero.png');
      expect(errors[0]!.error).toBe(loadError);

      resource.dispose();
      loadAsyncSpy.mockRestore();
    });

    test('a failure behind a loaded image is not reported as an image failure', async () => {
      const atlasJson = {
        frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}},
        meta: {image: 'atlas.png', size: {w: 16, h: 16}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      const loadAsyncSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement);
      const parseSpy = vi.spyOn(TexturePackerJson, 'parse').mockImplementation(() => {
        throw new Error('boom');
      });
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      const errors: Array<{source: string; id?: string; url?: string}> = [];
      on(resource, 'error', (payload: {source: string; id?: string; url?: string}) => {
        errors.push(payload);
      });

      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors.some((e) => e.source === 'image')).toBe(false);
      expect(errors.some((e) => e.source === 'texture' && e.id === 'sprites')).toBe(true);

      resource.dispose();
      loadAsyncSpy.mockRestore();
      parseSpy.mockRestore();
      fetchMock.mockRestore();
    });

    test('a tile set that is refused is reported as a texture failure', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      // a tileCount keeps the layout finite whatever the tile width
      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 0, tileHeight: 16, tileCount: 4});
      const errors: Array<{source: string; id?: string; error?: unknown}> = [];
      on(resource, 'error', (payload: {source: string; id?: string; error?: unknown}) => {
        errors.push(payload);
      });

      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('texture');
      expect(errors[0]!.id).toBe('tiles');
      expect(errors[0]!.error).toBeInstanceOf(RangeError);
      expect(resource.tileSet).toBeUndefined();

      resource.dispose();
    });
  });

  describe('tile set options that are refused', () => {
    const validOptions = {tileWidth: 16, tileHeight: 16};
    // a tileCount keeps the layout finite whatever the tile width
    const refusedOptions = {tileWidth: 0, tileHeight: 16, tileCount: 4};
    const animationsData: FrameBasedAnimationsDataMap = {walk: {duration: 1, firstTileId: 1, tileCount: 2}};

    const stubImage = () =>
      vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement);

    // a tile set resource with valid options, loaded until tile set, atlas and animations stand
    const loadedResource = async () => {
      stubImage();
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', validOptions, undefined, animationsData);
      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(resource.tileSet).toBeDefined();
      expect(resource.atlas).toBeDefined();
      expect(resource.frameBasedAnimations).toBeDefined();

      return {resource};
    };

    test('options that are refused take the tile set, the atlas and the animations back', async () => {
      const {resource} = await loadedResource();

      const errors: unknown[] = [];
      const seenInListener: Array<{tileSet: unknown; atlas: unknown; animations: unknown}> = [];
      on(resource, 'error', (payload: unknown) => {
        errors.push(payload);
        seenInListener.push({tileSet: resource.tileSet, atlas: resource.atlas, animations: resource.frameBasedAnimations});
      });

      expect(() => {
        resource.tileSetOptions = refusedOptions;
      }).not.toThrow();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'texture', id: 'tiles'});
      expect((errors[0] as {error: unknown}).error).toBeInstanceOf(RangeError);
      expect(seenInListener).toEqual([{tileSet: undefined, atlas: undefined, animations: undefined}]);
      expect(resource.tileSet).toBeUndefined();
      expect(resource.atlas).toBeUndefined();
      expect(resource.frameBasedAnimations).toBeUndefined();

      resource.dispose();
    });

    test('a subscriber that arrives after the refusal is handed nothing built from other options', async () => {
      const {resource} = await loadedResource();

      resource.tileSetOptions = refusedOptions;

      const tileSetSpy = vi.fn();
      const atlasSpy = vi.fn();
      const animationsSpy = vi.fn();
      on(resource, 'tileSet', tileSetSpy);
      on(resource, 'atlas', atlasSpy);
      on(resource, 'frameBasedAnimations', animationsSpy);

      expect(tileSetSpy).not.toHaveBeenCalled();
      expect(atlasSpy).not.toHaveBeenCalled();
      expect(animationsSpy).not.toHaveBeenCalled();

      resource.dispose();
    });

    test('a subscriber is never handed undefined when a tile set is taken back', async () => {
      const {resource} = await loadedResource();

      const delivered: unknown[] = [];
      on(resource, 'tileSet', (value: unknown) => delivered.push(value));
      on(resource, 'atlas', (value: unknown) => delivered.push(value));
      on(resource, 'frameBasedAnimations', (value: unknown) => delivered.push(value));
      const before = delivered.length;
      expect(before).toBe(3);

      resource.tileSetOptions = refusedOptions;

      expect(delivered).toHaveLength(before);
      expect(delivered.every((value) => value !== undefined)).toBe(true);

      resource.dispose();
    });

    test('options that work again bring a tile set, an atlas and animations back', async () => {
      const {resource} = await loadedResource();

      const tileSets: Array<{tileWidth: number}> = [];
      on(resource, 'tileSet', (tileSet: {tileWidth: number}) => tileSets.push(tileSet));

      resource.tileSetOptions = refusedOptions;
      resource.tileSetOptions = {tileWidth: 32, tileHeight: 32};

      expect(resource.tileSet).toBeDefined();
      expect(resource.tileSet!.tileWidth).toBe(32);
      expect(resource.atlas).toBeDefined();
      expect(resource.frameBasedAnimations).toBeDefined();
      expect(tileSets.at(-1)?.tileWidth).toBe(32);

      resource.dispose();
    });

    test('options that are cleared take the tile set, the atlas and the animations back', async () => {
      const {resource} = await loadedResource();

      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => errors.push(payload));

      resource.tileSetOptions = undefined;

      expect(resource.tileSet).toBeUndefined();
      expect(resource.atlas).toBeUndefined();
      expect(resource.frameBasedAnimations).toBeUndefined();
      expect(errors).toHaveLength(0);

      const tileSetSpy = vi.fn();
      on(resource, 'tileSet', tileSetSpy);
      expect(tileSetSpy).not.toHaveBeenCalled();

      resource.dispose();
    });

    test('a tile set refused on the first image leaves the texture to the resource', async () => {
      stubImage();
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', refusedOptions);
      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(resource.texture).toBeDefined();
      expect(textures).toHaveLength(1);

      resource.dispose();

      expect(textures[0]!.disposed).toBe(true);
    });
  });

  describe('setters on the wrong shape', () => {
    test('an image resource refuses tileSetOptions', () => {
      const resource = TextureResource.fromImage('hero', 'hero.png');

      const write = () => {
        resource.tileSetOptions = {tileWidth: 16};
      };

      expect(write).toThrow(TypeError);
      expect(write).toThrow('TextureResource "hero" is an "image" resource and has no "tileSetOptions"');
      expect(resource.tileSetOptions).toBeUndefined();

      resource.dispose();
    });

    test('a tileset resource refuses an atlasUrl', () => {
      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16});

      const write = () => {
        resource.atlasUrl = 'x.json';
      };

      expect(write).toThrow(TypeError);
      expect(write).toThrow('TextureResource "tiles" is a "tileset" resource and has no "atlasUrl"');
      expect(resource.atlasUrl).toBeUndefined();

      resource.dispose();
    });

    test('an atlas resource refuses a write to imageUrl', () => {
      const resource = TextureResource.fromAtlas('deco', 'deco.json');

      const write = () => {
        resource.imageUrl = 'other.png';
      };

      expect(write).toThrow(TypeError);
      expect(write).toThrow(/takes its "imageUrl" from the atlas json/);
      expect(resource.imageUrl).toBeUndefined();

      resource.dispose();
    });

    test('a disposed resource swallows the write instead of throwing', () => {
      const resource = TextureResource.fromImage('gone', 'gone.png');
      resource.dispose();

      expect(() => {
        resource.tileSetOptions = {tileWidth: 16};
      }).not.toThrow();
    });
  });

  describe('load()', () => {
    test('registers no dispose listener of its own', () => {
      const resource = TextureResource.fromTileSet('t', 'tiles.png', {tileWidth: 16, tileHeight: 16});

      const before = getSubscriptionCount(resource);
      resource.load();

      expect(getSubscriptionCount(resource)).toBe(before);

      resource.dispose();
    });

    test('load() on a disposed resource registers nothing', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      const resource = TextureResource.fromImage('late', 'late.png');
      resource.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);

      resource.load();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);

      // nothing this resource could still tear down: the second call returns at the flag,
      // so whatever load() registered here would stay for the life of the process
      resource.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    const atlasJson = {
      frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
      meta: {image: 'atlas.png', size: {w: 16, h: 16}},
    };

    test('a tile set resource whose options were cleared before load() builds its tile set once they are set again', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16});
      resource.tileSetOptions = undefined;
      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(resource.texture).toBeDefined();
      expect(resource.tileSet).toBeUndefined();

      resource.tileSetOptions = {tileWidth: 16, tileHeight: 16};

      expect(resource.tileSet).toBeDefined();
      expect(resource.tileSet!.tileCount).toBe(16);
      expect(resource.atlas).toBe(resource.tileSet!.atlas);

      resource.dispose();
    });

    test('an atlas resource whose atlasUrl was cleared before load() fetches once it is set again', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      resource.atlasUrl = undefined;
      resource.load();
      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(fetchMock).not.toHaveBeenCalled();

      resource.atlasUrl = 'atlas.json';
      await flushMicrotasks();
      await flushMicrotasks();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]![0]).toBe('atlas.json');
      expect(resource.imageUrl).toBe('atlas.png');
      expect(resource.texture).toBeDefined();
      expect(resource.atlas).toBeDefined();

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('an atlas resource without an atlasUrl at load() builds its atlas from an atlasJson written later', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      resource.atlasUrl = undefined;
      resource.load();
      resource.textureFactory = factory;

      resource.atlasJson = atlasJson;
      await flushMicrotasks();

      expect(resource.imageUrl).toBe('atlas.png');
      expect(resource.texture).toBeDefined();
      expect(resource.atlas).toBeDefined();

      resource.dispose();
    });

    test('image-load effect runs even when factory + imageUrl are already set before load()', async () => {
      let resolveLoad!: (img: unknown) => void;
      const loadP = new Promise<unknown>((r) => {
        resolveLoad = r;
      });
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementationOnce(() => loadP as Promise<HTMLImageElement>);

      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromImage('rx', 'first.png');
      // mimic the store flow: both factory and url are set BEFORE load() registers effects
      resource.textureFactory = factory;
      resource.load();

      resolveLoad({width: 10, height: 10, tag: 'live'});
      await flushMicrotasks();
      await flushMicrotasks();

      expect(asStub(resource.texture)?.tag).toBe('live');

      loadSpy.mockRestore();
      resource.dispose();
    });
  });

  describe('an imageUrl that changes while its image loads', () => {
    test('stale image result after imageUrl change does not overwrite fresh texture', async () => {
      let resolveFirst!: (img: unknown) => void;
      let resolveSecond!: (img: unknown) => void;
      const firstP = new Promise<unknown>((r) => {
        resolveFirst = r;
      });
      const secondP = new Promise<unknown>((r) => {
        resolveSecond = r;
      });

      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementationOnce(() => firstP as Promise<HTMLImageElement>)
        .mockImplementationOnce(() => secondP as Promise<HTMLImageElement>);

      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('rx', 'first.png');
      resource.load();
      // setting the factory after load() triggers the image-loading effect
      resource.textureFactory = factory;
      // change imageUrl while first.png is still pending → forces a second load + abort
      resource.imageUrl = 'second.png';

      resolveFirst({width: 100, height: 50, tag: 'first'});
      await flushMicrotasks();

      expect(textures.some((t) => t.tag === 'first')).toBe(false);
      expect(resource.texture).toBeUndefined();

      resolveSecond({width: 200, height: 100, tag: 'second'});
      await flushMicrotasks();

      expect(asStub(resource.texture)?.tag).toBe('second');

      loadSpy.mockRestore();
      resource.dispose();
    });

    test('texture is disposed when load resolves after dispose', async () => {
      let resolveLoad!: (img: unknown) => void;
      const loadP = new Promise<unknown>((r) => {
        resolveLoad = r;
      });
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementationOnce(() => loadP as Promise<HTMLImageElement>);

      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('ry', 'pending.png');
      resource.load();
      resource.textureFactory = factory;

      resource.dispose();

      resolveLoad({width: 10, height: 10, tag: 'pending'});
      await flushMicrotasks();

      // either the load was aborted before factory.create was called,
      // or the created texture was disposed afterwards — neither must leak.
      for (const t of textures) {
        expect(t.disposed).toBe(true);
      }
      expect(resource.texture).toBeUndefined();

      loadSpy.mockRestore();
    });
  });

  describe('the static factories leave the textureClasses they are given alone', () => {
    test('fromImage does not mutate textureClasses', () => {
      const cls: ('nearest' | 'flipy')[] = ['nearest', 'flipy'];
      TextureResource.fromImage('a', 'img.png', cls);
      expect(cls).toEqual(['nearest', 'flipy']);
    });

    test('fromTileSet does not mutate textureClasses', () => {
      const cls: ('nearest' | 'flipy')[] = ['nearest', 'flipy'];
      TextureResource.fromTileSet('a', 'img.png', {tileWidth: 16, tileHeight: 16}, cls);
      expect(cls).toEqual(['nearest', 'flipy']);
    });

    test('fromAtlas does not mutate textureClasses', () => {
      const cls: ('nearest' | 'flipy')[] = ['nearest', 'flipy'];
      TextureResource.fromAtlas('a', 'atlas.json', undefined, cls);
      expect(cls).toEqual(['nearest', 'flipy']);
    });
  });
});
