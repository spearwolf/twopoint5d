import {getSubscriptionCount, on} from '@spearwolf/eventize';
import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {ImageLoader, NearestFilter, Texture, type WebGPURenderer} from 'three/webgpu';
import {afterEach, describe, expect, expectTypeOf, test, vi} from 'vitest';

import {FrameBasedAnimations} from './FrameBasedAnimations.js';
import {atlasAdapterPicker, loadFailureFor} from './internals.js';
import {
  type AnyTextureResource,
  AtlasTextureResource,
  ImageTextureResource,
  TextureResource,
  TileSetTextureResource,
} from './TextureResource.js';
import {TexturePackerJson} from './TexturePackerJson.js';
import {TextureAtlas} from './TextureAtlas.js';
import type {TileSet} from './TileSet.js';
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

// a resource loads its image with or without a texture factory, and the image loader of three has
// no document to load with here: an image that never arrives keeps a test about something else
// free of an image failure it never asked for
const holdImages = () =>
  vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(() => new Promise<HTMLImageElement>(() => {}));

describe('TextureResource', () => {
  const sandbox = createSandbox();

  const atlasJson = {
    frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
    meta: {image: 'atlas.png', size: {w: 16, h: 16}},
  };

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
      resource.activate();

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
      resource.activate();

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
      resource.activate();

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
      resource.activate();
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

  describe('a subscriber that throws keeps no value from the others', () => {
    test('a subscriber of the texture that throws leaves the texture to every other subscriber and to the retained event', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 8, height: 8, tag: 'a.png'}) as unknown as HTMLImageElement,
      );
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('rx', 'a.png');
      resource.activate();

      on(resource, 'error', () => {});
      on(resource, 'texture', () => {
        throw new Error('a subscriber that throws');
      });
      const behind = vi.fn();
      on(resource, 'texture', behind);

      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(behind).toHaveBeenCalledWith(textures[0]);

      const late = vi.fn();
      on(resource, 'texture', late);

      expect(late).toHaveBeenCalledWith(textures[0]);

      resource.dispose();
    });

    test('a subscriber of the tile set that throws leaves the atlas of that tile set on the resource', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 8, height: 8, tag: 't.png'}) as unknown as HTMLImageElement,
      );

      const resource = TextureResource.fromTileSet('ts', 't.png', {tileWidth: 4, tileHeight: 4});
      resource.activate();

      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => errors.push(payload));
      on(resource, 'tileSet', () => {
        throw new Error('a subscriber that throws');
      });

      resource.textureFactory = makeTextureFactory().factory;
      await flushMicrotasks();

      expect(resource.tileSet).toBeDefined();
      expect(resource.atlas).toBe(resource.tileSet!.atlas);
      expect(errors).toMatchObject([{source: 'texture', id: 'ts'}]);

      resource.dispose();
    });
  });

  describe('dispose()', () => {
    const loadTexture = async (id: string, tag: string) => {
      const {factory, textures} = makeTextureFactory();
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 8, height: 8, tag}) as unknown as HTMLImageElement,
      );

      const resource = TextureResource.fromImage(id, `${tag}.png`);
      resource.activate();
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
      resource.activate();
      resource.textureFactory = disposableFactory as never;

      resource.dispose();

      expect(factoryDispose.called).toBe(false);
    });

    test('a disposed tile set or atlas resource reads none of the frameBasedAnimationsData written to it', () => {
      for (const resource of [new TileSetTextureResource('tiles'), new AtlasTextureResource('frames')]) {
        resource.frameBasedAnimationsData = {walk: {duration: 1, tileIds: [1]}};
        resource.dispose();
        let reads = 0;

        resource.frameBasedAnimationsData = {
          get walk() {
            reads++;
            return {duration: 1, tileIds: [1]};
          },
        };

        expect(reads).toBe(0);
        expect(resource.frameBasedAnimationsData).toBeUndefined();
      }
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

    test('is safe to call twice on a resource that never loaded', () => {
      const resource = TextureResource.fromImage('x', 'x.png');
      expect(() => resource.dispose()).not.toThrow();
      expect(() => resource.dispose()).not.toThrow();
    });

    test('dispose() tears the resource down whole behind a dispose listener that throws, and throws afterwards', async () => {
      const {resource, textures} = await loadTexture('throwing', 'throwing');
      const textureDispose = sandbox.spy(textures[0]!, 'dispose');

      on(resource, 'dispose', () => {
        throw new Error('boom');
      });
      const second = vi.fn();
      on(resource, 'dispose', second);

      expect(() => resource.dispose()).toThrow('boom');

      expect(second).toHaveBeenCalledOnce();
      expect(textureDispose.calledOnce).toBe(true);
      expect(resource.texture).toBeUndefined();
      expect(getSubscriptionCount(resource)).toBe(0);
      expect(() => resource.dispose()).not.toThrow();
      expect(textureDispose.calledOnce).toBe(true);
    });

    test('a dispose listener of the texture that throws does not hold up the teardown', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 8, height: 8}) as unknown as HTMLImageElement,
      );
      // a three.js texture of its own: its dispose() dispatches the dispose event of the texture
      const factory = {create: () => new Texture()};

      const resource = TextureResource.fromImage('texture-listener', 'texture-listener.png');
      resource.activate();
      resource.textureFactory = factory as never;
      await flushMicrotasks();

      const texture = resource.texture!;
      expect(texture).toBeInstanceOf(Texture);

      const resourceError = new Error('a dispose listener of the resource');
      const textureError = new Error('a dispose listener of the texture');
      on(resource, 'dispose', () => {
        throw resourceError;
      });
      texture.addEventListener('dispose', () => {
        throw textureError;
      });

      let thrown: unknown;
      try {
        resource.dispose();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).errors).toEqual([resourceError, textureError]);
      expect(resource.texture).toBeUndefined();
      expect(getSubscriptionCount(resource)).toBe(0);
      expect(() => resource.dispose()).not.toThrow();
    });

    // (e) no signal or effect outlives the instance
    test('does not leak signals or effects', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      const resource = TextureResource.fromImage('counted', 'counted.png');
      resource.activate();

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
      resource.activate();

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
      resource.activate();

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
      resource.activate();

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

    test('an error listener that throws keeps the report from no other listener, and the other entries of the animation map are registered', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16}, undefined, {
        walk: {duration: 1, frameNameQuery: 'walk.*'},
        run: {duration: 1, tileIds: [1, 2]},
      });
      resource.activate();

      on(resource, 'error', () => {
        throw new Error('an error listener that throws');
      });
      const errors: Array<{source: string; animation?: string}> = [];
      on(resource, 'error', (payload: {source: string; animation?: string}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(errors).toMatchObject([{source: 'frameBasedAnimations', animation: 'walk'}]);
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
      resource.activate();

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

    test('an animation entry without a duration and without a frameRate is skipped and reported with the error FrameBasedAnimations#add() throws for it', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16}, undefined, {
        // the animation data of a store comes out of json, where neither of the two timing
        // fields has to be there
        walk: {tileIds: [1, 2]},
        run: {firstTileId: 1, tileCount: 2},
        idle: {duration: 1, tileIds: [3, 4]},
      } as unknown as FrameBasedAnimationsDataMap);
      resource.activate();

      const errors: Array<{source: string; id: string; animation: string; error: Error}> = [];
      on(resource, 'error', (payload: {source: string; id: string; animation: string; error: Error}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.source)).toEqual(['frameBasedAnimations', 'frameBasedAnimations']);
      expect(errors.map((e) => e.id)).toEqual(['tiles', 'tiles']);
      expect(errors.map((e) => e.animation)).toEqual(['walk', 'run']);
      expect(errors[0]!.error.message).toBe(
        'FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation "walk"',
      );
      expect(errors[1]!.error.message).toBe(
        'FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation "run"',
      );

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
      resource.activate();

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

    test('an atlas animation entry whose timing does not carry is skipped and reported with the error FrameBasedAnimations#add() throws for it', async () => {
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
      resource.activate();

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
      expect(errors[0]!.error.message).toBe(
        'FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation "walk"',
      );

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
      resource.activate();
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
      resource.activate();
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

    test('frameBasedAnimationsData equal to the current, written as another object, keeps the animations', async () => {
      const resource = await loadedTileSetResource();
      const animations = resource.frameBasedAnimations;
      const published = vi.fn();
      on(resource, 'frameBasedAnimations', published);
      published.mockClear();

      resource.frameBasedAnimationsData = structuredClone(tileAnimationsData);

      expect(resource.frameBasedAnimations).toBe(animations);
      expect(published).not.toHaveBeenCalled();

      resource.frameBasedAnimationsData = {walk: {duration: 1, firstTileId: 1, tileCount: 3}};

      expect(resource.frameBasedAnimations).not.toBe(animations);
      expect(published).toHaveBeenCalledTimes(1);

      resource.dispose();
    });

    test('a frameNameQuery RegExp of the same source and flags keeps the animations, another flag builds new ones', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      // a catalog in JSON names a frameNameQuery as a string; FrameBasedAnimations#add() takes a RegExp as well
      const query = (pattern: string, flags?: string) => new RegExp(pattern, flags) as unknown as string;
      const resource = TextureResource.fromAtlas('deco', 'atlas.json', undefined, undefined, {
        idle: {duration: 1, frameNameQuery: query('^idle', 'i')},
      });
      resource.activate();
      await flushMicrotasks();
      await flushMicrotasks();
      const animations = resource.frameBasedAnimations;
      expect(animations?.hasAnimation('idle')).toBe(true);

      resource.frameBasedAnimationsData = {idle: {duration: 1, frameNameQuery: query('^idle', 'i')}};

      expect(resource.frameBasedAnimations).toBe(animations);

      resource.frameBasedAnimationsData = {idle: {duration: 1, frameNameQuery: query('^idle', 'iu')}};

      expect(resource.frameBasedAnimations).not.toBe(animations);
      expect(resource.frameBasedAnimations?.hasAnimation('idle')).toBe(true);

      resource.dispose();
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
  });

  describe('what a subscriber sees', () => {
    test('a tile set is on the resource by the time the imageCoords event arrives', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16});
      resource.activate();

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
      resource.activate();

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

      resource.activate();
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

      resource.activate();
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

      resource.activate();
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

      resource.activate();
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
      resource.activate();
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

      resource.activate();
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

    const writtenAtlasJson = {
      frames: {own: {frame: {x: 0, y: 0, w: 8, h: 8}}},
      meta: {image: 'own.png', size: {w: 16, h: 16}},
    };

    test('an atlasJson written while the fetch is in flight aborts that fetch', async () => {
      const calls = stubAbortableFetch();
      holdImages();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => errors.push(payload));

      resource.activate();
      resource.atlasJson = writtenAtlasJson as never;

      expect(calls[0]!.signal.aborted).toBe(true);

      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.atlasJson).toEqual(writtenAtlasJson);
      expect(errors).toEqual([]);

      resource.dispose();
    });

    // `fetch` that pays no heed to its signal and answers only when the test says so: what it
    // answers after an abort reaches the resource, and only the resource can ignore it
    const stubDeafFetch = () => {
      let answer!: (response: Response) => void;
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      );
      return (response: Response) => answer(response);
    };

    test('a fetch that answers after an atlasJson was written leaves the written json in place', async () => {
      const answer = stubDeafFetch();
      holdImages();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => errors.push(payload));

      resource.activate();
      resource.atlasJson = writtenAtlasJson as never;

      answer(
        new Response(
          JSON.stringify({
            frames: {fetched: {frame: {x: 0, y: 0, w: 8, h: 8}}},
            meta: {image: 'fetched.png', size: {w: 16, h: 16}},
          }),
        ),
      );
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.atlasJson).toEqual(writtenAtlasJson);
      expect(resource.imageUrl).toBe('own.png');
      expect(errors).toEqual([]);

      resource.dispose();
    });

    test('a fetch that fails after an atlasJson was written reports nothing', async () => {
      const answer = stubDeafFetch();
      holdImages();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => errors.push(payload));

      resource.activate();
      resource.atlasJson = writtenAtlasJson as never;

      answer(new Response('{}', {status: 404}));
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toEqual([]);

      resource.dispose();
    });

    test('a subscriber of the atlas that throws while a fetched json is published is no failure of the fetch', async () => {
      // both jsons name the same image, so the second one finds it loaded and the atlas it
      // describes is published inside the write of the fetched json
      const atlasJsonWithFrame = (frame: string) =>
        JSON.stringify({
          frames: {[frame]: {frame: {x: 0, y: 0, w: 8, h: 8}}},
          meta: {image: 'atlas.png', size: {w: 16, h: 16}},
        });
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        async (url) => new Response(atlasJsonWithFrame(url === 'first.json' ? 'a' : 'b')),
      );
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async (url) => ({width: 16, height: 16, tag: url}) as unknown as HTMLImageElement,
      );

      const resource = TextureResource.fromAtlas('sprites', 'first.json');
      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => errors.push(payload));

      resource.activate();
      resource.textureFactory = makeTextureFactory().factory;
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.atlas!.frameNames()).toEqual(['a']);

      // throws only for the atlas of the second json, so the retained replay of the first one
      // on subscribing goes through
      on(resource, 'atlas', (atlas: TextureAtlas) => {
        if (atlas.frameNames().includes('b')) throw new Error('a subscriber that throws');
      });

      resource.atlasUrl = 'second.json';
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(errors).toMatchObject([{source: 'texture', id: 'sprites'}]);
      expect(resource[loadFailureFor](['atlas']), 'no record holds the atlas back').toBeUndefined();
      expect(resource.atlas!.frameNames()).toEqual(['b']);

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
        resource.activate();
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

        resource.activate();
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
        resource.activate();
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

      test('an atlas json that names no image is reported with the url it came from, not with an atlasUrl written after it', async () => {
        const withoutImage = {frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}}, meta: {size: {w: 16, h: 16}}};
        const fetchMock = vi
          .spyOn(globalThis, 'fetch')
          .mockImplementation((input) =>
            String(input) === 'A' ? Promise.resolve(new Response(JSON.stringify(withoutImage))) : new Promise<Response>(() => {}),
          );

        holdImages();

        const resource = TextureResource.fromAtlas('sprites', 'A', 'override.png');
        const errors: Array<{source: string; url: string; error: Error}> = [];
        on(resource, 'error', (payload: {source: string; url: string; error: Error}) => {
          errors.push(payload);
        });

        resource.activate();
        await flushMicrotasks();
        await flushMicrotasks();

        resource.atlasUrl = 'B';
        resource.overrideImageUrl = undefined;
        await flushMicrotasks();

        expect(errors).toHaveLength(1);
        expect(errors[0]!.source).toBe('atlas');
        expect(errors[0]!.url).toBe('A');
        expect(errors[0]!.error.message).toContain('"A"');

        resource.dispose();
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
      resource.activate();
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

      resource.activate();
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

      resource.activate();
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

      resource.activate();
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
      resource.activate();
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
      resource.activate();
      resource.textureFactory = factory;
      await flushMicrotasks();

      expect(resource.texture).toBeDefined();
      expect(textures).toHaveLength(1);

      resource.dispose();

      expect(textures[0]!.disposed).toBe(true);
    });
  });

  describe('tileSetOptions are kept as a frozen copy', () => {
    const loadTileSet = async (options: {tileWidth: number; tileHeight: number}) => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();
      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', options);
      resource.activate();
      resource.textureFactory = factory;
      await flushMicrotasks();
      return resource;
    };

    test('the same object written again after a change builds a new tile set with the new values', async () => {
      const options = {tileWidth: 16, tileHeight: 16};
      const resource = await loadTileSet(options);
      const before = resource.tileSet!;
      expect(before.tileWidth).toBe(16);

      options.tileWidth = 32;
      resource.tileSetOptions = options;

      expect(resource.tileSet).not.toBe(before);
      expect(resource.tileSet!.tileWidth).toBe(32);

      resource.dispose();
    });

    test('a change to the object without a write leaves the tile set and the options as they were', async () => {
      const options = {tileWidth: 16, tileHeight: 16};
      const resource = await loadTileSet(options);
      const before = resource.tileSet!;

      options.tileWidth = 32;

      expect(resource.tileSet).toBe(before);
      expect(before.tileWidth).toBe(16);
      expect(resource.tileSetOptions).toEqual({tileWidth: 16, tileHeight: 16});
      expect(Object.isFrozen(resource.tileSetOptions)).toBe(true);

      resource.dispose();
    });
  });

  // TypeScript refuses each of these writes; the browser tests and every other caller in JavaScript
  // reach the setters on the prototype of the shape, which throw
  describe('setters on the wrong shape', () => {
    test('an image resource refuses tileSetOptions', () => {
      const resource = TextureResource.fromImage('hero', 'hero.png');

      const write = () => {
        // @ts-expect-error an image resource has no tileSetOptions
        resource.tileSetOptions = {tileWidth: 16};
      };

      expect(write).toThrow(TypeError);
      expect(write).toThrow('TextureResource "hero" is an "image" resource and has no "tileSetOptions"');
      // @ts-expect-error an image resource has no tileSetOptions
      expect(resource.tileSetOptions).toBeUndefined();
      expect(Object.hasOwn(resource, 'tileSetOptions')).toBe(false);

      resource.dispose();
    });

    test('an image resource refuses frameBasedAnimationsData', () => {
      const resource = TextureResource.fromImage('hero', 'hero.png');

      const write = () => {
        // @ts-expect-error an image resource builds no animations and has no frameBasedAnimationsData
        resource.frameBasedAnimationsData = {x: {duration: 1, tileIds: [1]}};
      };

      expect(write).toThrow(TypeError);
      expect(write).toThrow('TextureResource "hero" is an "image" resource and has no "frameBasedAnimationsData"');
      // @ts-expect-error an image resource has no frameBasedAnimationsData
      expect(resource.frameBasedAnimationsData).toBeUndefined();
      expect(Object.hasOwn(resource, 'frameBasedAnimationsData')).toBe(false);

      resource.dispose();
    });

    test('a tileset resource refuses an atlasUrl', () => {
      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16});

      const write = () => {
        // @ts-expect-error a tile set resource has no atlasUrl
        resource.atlasUrl = 'x.json';
      };

      expect(write).toThrow(TypeError);
      expect(write).toThrow('TextureResource "tiles" is a "tileset" resource and has no "atlasUrl"');
      // @ts-expect-error a tile set resource has no atlasUrl
      expect(resource.atlasUrl).toBeUndefined();
      expect(Object.hasOwn(resource, 'atlasUrl')).toBe(false);

      resource.dispose();
    });

    test('an atlas resource refuses tileSetOptions', () => {
      const resource = TextureResource.fromAtlas('deco', 'deco.json');

      const write = () => {
        // @ts-expect-error an atlas resource has no tileSetOptions
        resource.tileSetOptions = {tileWidth: 16};
      };

      expect(write).toThrow('TextureResource "deco" is an "atlas" resource and has no "tileSetOptions"');
      expect(Object.hasOwn(resource, 'tileSetOptions')).toBe(false);

      resource.dispose();
    });

    test('an atlas resource refuses a write to imageUrl', () => {
      const resource = TextureResource.fromAtlas('deco', 'deco.json');

      const write = () => {
        // @ts-expect-error the imageUrl of an atlas resource comes from its json and is read-only
        resource.imageUrl = 'other.png';
      };

      expect(write).toThrow(TypeError);
      expect(write).toThrow(/takes its "imageUrl" from the atlas json/);
      expect(resource.imageUrl).toBeUndefined();
      expect(Object.hasOwn(resource, 'imageUrl')).toBe(false);

      resource.dispose();
    });

    test('a disposed resource swallows the write instead of throwing', () => {
      const image = TextureResource.fromImage('gone', 'gone.png');
      const atlas = TextureResource.fromAtlas('gone too', 'gone.json');
      image.dispose();
      atlas.dispose();

      expect(() => {
        // @ts-expect-error an image resource has no tileSetOptions
        image.tileSetOptions = {tileWidth: 16};
        // @ts-expect-error the imageUrl of an atlas resource comes from its json and is read-only
        atlas.imageUrl = 'other.png';
      }).not.toThrow();
    });
  });

  describe('the types of the shapes', () => {
    test('the static factories answer the class of the shape, and activate() and load() answer the same', () => {
      const image = TextureResource.fromImage('hero', 'hero.png');
      const tiles = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16});
      const atlas = TextureResource.fromAtlas('deco', 'deco.json');

      expectTypeOf(image).toEqualTypeOf<ImageTextureResource>();
      expectTypeOf(tiles).toEqualTypeOf<TileSetTextureResource>();
      expectTypeOf(atlas).toEqualTypeOf<AtlasTextureResource>();
      expectTypeOf(image.activate()).toEqualTypeOf<ImageTextureResource>();
      expectTypeOf(atlas.load()).toEqualTypeOf<AtlasTextureResource>();
      expect([image, tiles, atlas].map((resource) => resource instanceof TextureResource)).toEqual([true, true, true]);

      for (const resource of [image, tiles, atlas]) resource.dispose();
    });

    test('an output a shape never builds is undefined in its type', () => {
      expectTypeOf<ImageTextureResource['atlas']>().toEqualTypeOf<undefined>();
      expectTypeOf<ImageTextureResource['tileSet']>().toEqualTypeOf<undefined>();
      expectTypeOf<ImageTextureResource['frameBasedAnimations']>().toEqualTypeOf<undefined>();
      expectTypeOf<AtlasTextureResource['tileSet']>().toEqualTypeOf<undefined>();
      expectTypeOf<TileSetTextureResource['tileSet']>().toEqualTypeOf<TileSet | undefined>();
    });

    test('the imageUrl of an atlas resource cannot be written', () => {
      const atlas = new AtlasTextureResource('deco');
      const tiles = new TileSetTextureResource('tiles');

      expectTypeOf(atlas.imageUrl).toEqualTypeOf<string | undefined>();
      expect(() => {
        // @ts-expect-error the imageUrl of an atlas resource comes from its json and is read-only
        atlas.imageUrl = 'other.png';
      }).toThrow(TypeError);
      tiles.imageUrl = 'tiles.png';
      expect(tiles.imageUrl).toBe('tiles.png');

      atlas.dispose();
      tiles.dispose();
    });

    test('type narrows a resource of any shape to the class of its shape', () => {
      const resource: AnyTextureResource = new AtlasTextureResource('deco');

      if (resource.type === 'atlas') {
        expectTypeOf(resource).toEqualTypeOf<AtlasTextureResource>();
        resource.overrideImageUrl = 'deco.png';
      }
      expect(resource.type === 'atlas' && resource.overrideImageUrl).toBe('deco.png');

      resource.dispose();
    });
  });

  describe('a resource built with the constructor of its shape', () => {
    test('new TextureResource(id, type) from JavaScript is refused: the base builds no resource of its own', () => {
      // TypeScript refuses the call — the constructor of the base is protected and the class abstract —
      // so the cast stands in for a caller in JavaScript
      const Base = TextureResource as unknown as new (id: string, type: string) => TextureResource;

      expect(() => new Base('sprites', 'atlas')).toThrow(TypeError);
      expect(() => new Base('sprites', 'atlas')).toThrow(
        'new TextureResource(): TextureResource is the base of the three shapes of resource — build an ImageTextureResource, ' +
          'a TileSetTextureResource or an AtlasTextureResource, or call TextureResource.fromImage(), fromTileSet() or fromAtlas()',
      );
    });

    test('a refused new TextureResource() leaves no signal behind', () => {
      const Base = TextureResource as unknown as new (id: string, type: string) => TextureResource;
      const before = getSignalsCount();

      expect(() => new Base('sprites', 'atlas')).toThrow(TypeError);

      expect(getSignalsCount()).toBe(before);
    });

    test('new AtlasTextureResource(id) takes an atlasUrl and builds its atlas once loaded', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = new AtlasTextureResource('sprites');

      expect(resource.type).toBe('atlas');
      expect(() => {
        resource.overrideImageUrl = undefined;
        resource.atlasUrl = 'atlas.json';
      }).not.toThrow();

      resource.textureFactory = factory;
      resource.activate();
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

    test('new TileSetTextureResource(id) takes tileSetOptions and builds its tile set once loaded', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = new TileSetTextureResource('tiles');
      expect(resource.type).toBe('tileset');
      resource.imageUrl = 'tiles.png';
      resource.tileSetOptions = {tileWidth: 16, tileHeight: 16};
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();

      expect(resource.tileSet?.tileCount).toBe(16);
      expect(resource.atlas).toBe(resource.tileSet!.atlas);

      resource.dispose();
    });

    test('new ImageTextureResource(id) carries no input of another shape', () => {
      const resource = new ImageTextureResource('hero');
      expect(resource.type).toBe('image');

      const writes: Record<string, () => void> = {
        tileSetOptions: () => {
          // @ts-expect-error an image resource has no tileSetOptions
          resource.tileSetOptions = {tileWidth: 16};
        },
        atlasUrl: () => {
          // @ts-expect-error an image resource has no atlasUrl
          resource.atlasUrl = 'hero.json';
        },
        atlasJson: () => {
          // @ts-expect-error an image resource has no atlasJson
          resource.atlasJson = atlasJson;
        },
        overrideImageUrl: () => {
          // @ts-expect-error an image resource has no overrideImageUrl
          resource.overrideImageUrl = 'hero.png';
        },
        atlasAdapter: () => {
          // @ts-expect-error an image resource has no atlasAdapter
          resource.atlasAdapter = undefined;
        },
        frameBasedAnimationsData: () => {
          // @ts-expect-error an image resource has no frameBasedAnimationsData
          resource.frameBasedAnimationsData = undefined;
        },
      };

      for (const [property, write] of Object.entries(writes)) {
        expect(write).toThrow(TypeError);
        expect(write).toThrow(`TextureResource "hero" is an "image" resource and has no "${property}"`);
        // reading it answers undefined, and nothing was left on the resource
        expect((resource as unknown as Record<string, unknown>)[property]).toBeUndefined();
        expect(Object.hasOwn(resource, property)).toBe(false);
      }

      resource.dispose();
    });

    test('new TileSetTextureResource(id) carries no input of an atlas', () => {
      const resource = new TileSetTextureResource('tiles');

      const writes: Record<string, () => void> = {
        atlasUrl: () => {
          // @ts-expect-error a tile set resource has no atlasUrl
          resource.atlasUrl = 'tiles.json';
        },
        atlasJson: () => {
          // @ts-expect-error a tile set resource has no atlasJson
          resource.atlasJson = atlasJson;
        },
        overrideImageUrl: () => {
          // @ts-expect-error a tile set resource has no overrideImageUrl
          resource.overrideImageUrl = 'tiles.png';
        },
        atlasAdapter: () => {
          // @ts-expect-error a tile set resource has no atlasAdapter
          resource.atlasAdapter = undefined;
        },
      };

      for (const [property, write] of Object.entries(writes)) {
        expect(write).toThrow(`TextureResource "tiles" is a "tileset" resource and has no "${property}"`);
        expect(Object.hasOwn(resource, property)).toBe(false);
      }

      resource.dispose();
    });
  });

  describe('activate()', () => {
    test('registers no dispose listener of its own', () => {
      const resource = TextureResource.fromTileSet('t', 'tiles.png', {tileWidth: 16, tileHeight: 16});

      const before = getSubscriptionCount(resource);
      resource.activate();

      expect(getSubscriptionCount(resource)).toBe(before);

      resource.dispose();
    });

    test('load() is a deprecated alias of activate() and registers the effects once', () => {
      const baselineEffects = getEffectsCount();

      const once = TextureResource.fromTileSet('once', 'tiles.png', {tileWidth: 16, tileHeight: 16});
      expect(once.activate()).toBe(once);
      const effectsOfOne = getEffectsCount() - baselineEffects;
      expect(effectsOfOne).toBeGreaterThan(0);
      once.dispose();

      const resource = TextureResource.fromTileSet('t', 'tiles.png', {tileWidth: 16, tileHeight: 16});
      expect(resource.load()).toBe(resource);
      expect(resource.activate()).toBe(resource);
      expect(resource.load()).toBe(resource);

      expect(getEffectsCount() - baselineEffects).toBe(effectsOfOne);

      resource.dispose();
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    test('activate() on a disposed resource registers nothing', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      const resource = TextureResource.fromImage('late', 'late.png');
      resource.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);

      resource.activate();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);

      // nothing this resource could still tear down: the second call returns at the flag,
      // so whatever activate() registered here would stay for the life of the process
      resource.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    test('a tile set resource whose options were cleared before activate() builds its tile set once they are set again', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16});
      resource.tileSetOptions = undefined;
      resource.activate();
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

    test('an atlas resource whose atlasUrl was cleared before activate() fetches once it is set again', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      resource.atlasUrl = undefined;
      resource.activate();
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

    test('an atlas resource without an atlasUrl at activate() builds its atlas from an atlasJson written later', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      resource.atlasUrl = undefined;
      resource.activate();
      resource.textureFactory = factory;

      resource.atlasJson = atlasJson;
      await flushMicrotasks();

      expect(resource.imageUrl).toBe('atlas.png');
      expect(resource.texture).toBeDefined();
      expect(resource.atlas).toBeDefined();

      resource.dispose();
    });

    test('image-load effect runs even when factory + imageUrl are already set before activate()', async () => {
      let resolveLoad!: (img: unknown) => void;
      const loadP = new Promise<unknown>((r) => {
        resolveLoad = r;
      });
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementationOnce(() => loadP as Promise<HTMLImageElement>);

      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromImage('rx', 'first.png');
      // mimic the store flow: both factory and url are set BEFORE activate() registers effects
      resource.textureFactory = factory;
      resource.activate();

      resolveLoad({width: 10, height: 10, tag: 'live'});
      await flushMicrotasks();
      await flushMicrotasks();

      expect(asStub(resource.texture)?.tag).toBe('live');

      loadSpy.mockRestore();
      resource.dispose();
    });
  });

  describe('an atlasJson written before activate()', () => {
    test('builds its atlas without an atlasUrl', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      resource.atlasUrl = undefined;
      resource.atlasJson = atlasJson;
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(resource.imageUrl).toBe('atlas.png');
      expect(resource.texture).toBeDefined();
      expect(resource.atlas).toBeDefined();

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('takes the place of the fetch of the atlasUrl it was written after', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();
      const errors: unknown[] = [];

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      on(resource, 'error', (failure: unknown) => errors.push(failure));
      const ownJson = {...atlasJson, meta: {...atlasJson.meta, image: 'own.png'}};
      resource.atlasJson = ownJson;
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(resource.atlasJson).toBe(ownJson);
      expect(resource.imageUrl).toBe('own.png');
      expect(resource.atlas).toBeDefined();
      expect(errors).toEqual([]);

      resource.dispose();
      fetchMock.mockRestore();
    });

    test('an atlasUrl written after it is fetched and replaces it', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'first.json');
      resource.atlasJson = {...atlasJson, meta: {...atlasJson.meta, image: 'own.png'}};
      resource.atlasUrl = 'atlas.json';
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]![0]).toBe('atlas.json');
      expect(resource.imageUrl).toBe('atlas.png');

      resource.dispose();
      fetchMock.mockRestore();
    });
  });

  describe('a resource on its own builds its texture factory from its renderer', () => {
    // the factory asks a renderer for exactly one thing, so a stub that answers it is a renderer enough
    const makeRendererStub = (maxAnisotropy: number) => ({getMaxAnisotropy: () => maxAnisotropy}) as unknown as WebGPURenderer;

    const stubImage = () =>
      vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 16, height: 16, tag: 'hero'}) as unknown as HTMLImageElement);

    test('starts from no texture class, as the factory of a store does', async () => {
      const loadAsyncSpy = stubImage();
      const resource = TextureResource.fromImage('hero', 'hero.png');

      resource.renderer = makeRendererStub(16);
      resource.activate();
      await flushMicrotasks();

      expect(resource.textureFactory!.getOptions([]).magFilter).toBeUndefined();

      resource.dispose();
      loadAsyncSpy.mockRestore();
    });

    test('a new renderer brings a new factory with the anisotropy of that renderer', async () => {
      const loadAsyncSpy = stubImage();
      const resource = TextureResource.fromImage('hero', 'hero.png');

      resource.renderer = makeRendererStub(4);
      resource.activate();
      await flushMicrotasks();
      const first = resource.textureFactory;

      resource.renderer = makeRendererStub(16);
      await flushMicrotasks();

      expect(resource.textureFactory).not.toBe(first);
      expect(resource.textureFactory!.getOptions(['anisotropy']).anisotropy).toBe(16);

      resource.dispose();
      loadAsyncSpy.mockRestore();
    });

    test('a factory written from outside stays when a renderer is written', async () => {
      const loadAsyncSpy = stubImage();
      const {factory} = makeTextureFactory();
      const resource = TextureResource.fromImage('hero', 'hero.png');

      resource.activate();
      resource.textureFactory = factory;
      resource.renderer = makeRendererStub(16);
      await flushMicrotasks();

      expect(resource.textureFactory).toBe(factory);

      resource.dispose();
      loadAsyncSpy.mockRestore();
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
      resource.activate();
      // setting the factory after activate() triggers the image-loading effect
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
      resource.activate();
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

  describe('an imageUrl that is cleared', () => {
    // every image answers with the file name it was asked for, so two textures tell apart
    const loadByUrl = (width = 16, height = 16) =>
      vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async (url: string) => ({width, height, tag: url}) as unknown as HTMLImageElement);

    const collectErrors = (resource: TextureResource) => {
      const errors: unknown[] = [];
      on(resource, 'error', (failure: unknown) => errors.push(failure));
      return errors;
    };

    test('a resource on its own lets go of the image it fetched last once its imageUrl is cleared: the same url fetches again', async () => {
      const loadAsync = loadByUrl();
      const resource = TextureResource.fromImage('hero', 'hero.png');
      resource.activate();
      await flushMicrotasks();
      expect(resource.imageCoords).toBeDefined();

      resource.imageUrl = undefined;
      await flushMicrotasks();

      resource.imageUrl = 'hero.png';
      await flushMicrotasks();

      expect(loadAsync).toHaveBeenCalledTimes(2);
      expect(resource.imageCoords).toBeDefined();

      resource.dispose();
    });

    test('takes the texture and the imageCoords back and releases the texture', async () => {
      loadByUrl();
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('hero', 'first.png');
      const errors = collectErrors(resource);
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();

      expect(resource.texture).toBeDefined();

      resource.imageUrl = undefined;

      expect(resource.texture).toBeUndefined();
      expect(resource.imageCoords).toBeUndefined();
      expect(textures).toHaveLength(1);
      expect(textures[0]!.disposed).toBe(true);
      expect(errors).toEqual([]);

      resource.dispose();
    });

    test('a subscriber that arrives afterwards waits for the next image', async () => {
      loadByUrl();
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromImage('hero', 'first.png');
      const errors = collectErrors(resource);
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();

      resource.imageUrl = undefined;

      const late = vi.fn();
      on(resource, 'texture', late);

      expect(late).not.toHaveBeenCalled();

      resource.imageUrl = 'second.png';
      await flushMicrotasks();

      expect(late).toHaveBeenCalledTimes(1);
      expect(asStub(late.mock.calls[0]![0] as Texture)?.tag).toBe('second.png');
      expect(errors).toEqual([]);

      resource.dispose();
    });

    test('a subscriber of the texture is never handed undefined', async () => {
      loadByUrl();
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('hero', 'first.png');
      const errors = collectErrors(resource);
      const subscriber = vi.fn();
      on(resource, 'texture', subscriber);
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();

      resource.imageUrl = undefined;

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber.mock.calls[0]![0]).toBe(textures[0]);
      expect(errors).toEqual([]);

      resource.dispose();
    });

    test('a tile set resource takes its tile set, its atlas and its animations back', async () => {
      loadByUrl(64, 64);
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16}, undefined, {
        walk: {duration: 1, firstTileId: 1, tileCount: 2},
      });
      const errors = collectErrors(resource);
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();

      expect(resource.tileSet).toBeDefined();
      expect(resource.atlas).toBeDefined();
      expect(resource.frameBasedAnimations).toBeDefined();
      expect(resource.texture).toBeDefined();

      resource.imageUrl = undefined;

      expect(resource.tileSet).toBeUndefined();
      expect(resource.atlas).toBeUndefined();
      expect(resource.frameBasedAnimations).toBeUndefined();
      expect(resource.texture).toBeUndefined();
      expect(textures[0]!.disposed).toBe(true);
      expect(errors).toEqual([]);

      resource.dispose();
    });

    test('an image cleared while it loads builds no texture', async () => {
      let resolveLoad!: (image: StubImage) => void;
      const pending = new Promise<StubImage>((resolve) => {
        resolveLoad = resolve;
      });
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementationOnce(() => pending as unknown as Promise<HTMLImageElement>);
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('hero', 'first.png');
      const errors = collectErrors(resource);
      resource.textureFactory = factory;
      resource.activate();

      resource.imageUrl = undefined;
      resolveLoad({width: 16, height: 16, tag: 'first'});
      await flushMicrotasks();

      expect(resource.texture).toBeUndefined();
      expect(textures).toHaveLength(0);
      expect(errors).toEqual([]);

      resource.dispose();
    });

    test('a textureFactory that is cleared leaves the texture in place', async () => {
      loadByUrl();
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromImage('hero', 'first.png');
      const errors = collectErrors(resource);
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();

      const texture = resource.texture;
      expect(texture).toBeDefined();

      resource.textureFactory = undefined;

      expect(resource.texture).toBe(texture);
      expect(asStub(texture)!.disposed).toBe(false);
      expect(errors).toEqual([]);

      resource.dispose();
    });

    test('an atlas json written from outside that names no image takes the texture and the atlas back', async () => {
      loadByUrl();
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('sprites', 'atlas.json');
      const errors = collectErrors(resource);
      resource.atlasUrl = undefined;
      resource.activate();
      resource.textureFactory = factory;
      resource.atlasJson = atlasJson;
      await flushMicrotasks();

      expect(resource.atlas).toBeDefined();
      expect(resource.texture).toBeDefined();

      resource.atlasJson = {...atlasJson, meta: {size: atlasJson.meta.size}} as never;
      await flushMicrotasks();

      expect(resource.atlas).toBeUndefined();
      expect(resource.texture).toBeUndefined();
      expect(textures[0]!.disposed).toBe(true);
      expect(errors).toEqual([]);

      resource.dispose();
    });
  });

  describe('a resource without a texture factory', () => {
    const loadByUrl = (width = 16, height = 16) =>
      vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async (url: string) => ({width, height, tag: url}) as unknown as HTMLImageElement);

    // the factory asks a renderer for its anisotropy maximum, and for nothing else
    const rendererStub = () => ({getMaxAnisotropy: () => 16}) as unknown as WebGPURenderer;

    test('without a factory the resource publishes its imageCoords and builds no texture, and the factory that arrives builds it from the same fetch', async () => {
      const loadSpy = loadByUrl(16, 8);

      const resource = TextureResource.fromImage('hero', 'first.png');
      resource.activate();
      await flushMicrotasks();

      expect(resource.imageCoords).toMatchObject({width: 16, height: 8});
      expect(resource.texture).toBeUndefined();

      resource.renderer = rendererStub();
      await flushMicrotasks();

      expect(resource.texture).toBeInstanceOf(Texture);
      expect(loadSpy).toHaveBeenCalledTimes(1);

      resource.dispose();
    });

    test('a resource on its own fetches its image once across a change of its texture classes', async () => {
      const loadSpy = loadByUrl();
      const resource = TextureResource.fromImage('hero', 'hero.png');
      resource.renderer = rendererStub();
      resource.activate();
      await flushMicrotasks();
      const first = resource.texture!;
      expect(first).toBeInstanceOf(Texture);

      resource.textureClasses = ['nearest'];
      await flushMicrotasks();

      const second = resource.texture!;
      expect(second).toBeInstanceOf(Texture);
      expect(second).not.toBe(first);
      expect(second.magFilter).toBe(NearestFilter);
      expect(second.image).toBe(first.image);
      expect(loadSpy).toHaveBeenCalledTimes(1);

      resource.dispose();
    });

    test('a resource on its own fetches its image once across another renderer', async () => {
      const loadSpy = loadByUrl();
      const resource = TextureResource.fromImage('hero', 'hero.png');
      resource.renderer = rendererStub();
      resource.activate();
      await flushMicrotasks();
      const firstFactory = resource.textureFactory;
      const first = resource.texture!;

      resource.renderer = rendererStub();
      await flushMicrotasks();

      expect(resource.textureFactory).not.toBe(firstFactory);
      expect(resource.texture).not.toBe(first);
      expect(resource.texture!.image).toBe(first.image);
      expect(loadSpy).toHaveBeenCalledTimes(1);

      resource.dispose();
    });

    test('a new image url without a factory takes back the texture of the old image', async () => {
      loadByUrl();
      const {factory, textures} = makeTextureFactory();

      const resource = TextureResource.fromImage('hero', 'first.png');
      resource.textureFactory = factory;
      resource.activate();
      await flushMicrotasks();

      expect(asStub(resource.texture)?.tag).toBe('first.png');

      resource.textureFactory = undefined;
      loadByUrl(32, 24);
      resource.imageUrl = 'second.png';
      await flushMicrotasks();

      expect(resource.texture).toBeUndefined();
      expect(textures).toHaveLength(1);
      expect(textures[0]!.disposed).toBe(true);
      expect(resource.imageCoords).toMatchObject({width: 32, height: 24});

      resource.dispose();
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

  describe('the image an atlas json names lies next to that json', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const atlasJsonNaming = (image: string) => ({
      frames: {'walk.1': {frame: {x: 0, y: 0, w: 8, h: 8}}},
      meta: {image, size: {w: 16, h: 16}},
    });

    // the image loader stub answers every url and records which one it was asked for
    const spyOnImageLoads = () =>
      vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 16, height: 16, tag: 'atlas'}) as unknown as HTMLImageElement);

    test('an atlas resolves a relative meta.image against its atlasUrl', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJsonNaming('a.png'))));
      const imageLoads = spyOnImageLoads();
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('a', 'http://example.test/atlases/a.json');
      resource.activate();
      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.imageUrl).toBe('http://example.test/atlases/a.png');
      expect(resource.atlasJson?.meta.image).toBe('http://example.test/atlases/a.png');
      expect(imageLoads.mock.calls.map(([url]) => url)).toEqual(['http://example.test/atlases/a.png']);

      resource.dispose();
    });

    test('an overrideImageUrl is taken as written, not resolved against the atlasUrl', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJsonNaming('a.png'))));
      const imageLoads = spyOnImageLoads();
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('a', 'http://example.test/atlases/a.json', 'override.png');
      resource.activate();
      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.imageUrl).toBe('override.png');
      expect(imageLoads.mock.calls.map(([url]) => url)).toEqual(['override.png']);

      resource.dispose();
    });

    test('an atlasJson written from outside keeps its meta.image as written', async () => {
      // a fetch that never answers: the json on the resource is the one written below
      vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>(() => {}));
      const imageLoads = spyOnImageLoads();
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('a', 'http://example.test/atlases/a.json');
      resource.activate();
      resource.textureFactory = factory;
      resource.atlasJson = atlasJsonNaming('outside.png');
      await flushMicrotasks();

      expect(resource.imageUrl).toBe('outside.png');
      expect(resource.atlasJson?.meta.image).toBe('outside.png');
      expect(imageLoads.mock.calls.map(([url]) => url)).toEqual(['outside.png']);

      resource.dispose();
    });

    test('a relative atlasUrl is resolved against the document before it serves as the base', async () => {
      vi.stubGlobal('document', {baseURI: 'http://example.test/demo/page.html'});
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJsonNaming('a.png'))));
      spyOnImageLoads();
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromAtlas('a', 'atlases/a.json');
      resource.activate();
      resource.textureFactory = factory;
      await flushMicrotasks();
      await flushMicrotasks();

      // the atlasUrl itself stays as written: fetch() resolves it against the document too
      expect(resource.atlasUrl).toBe('atlases/a.json');
      expect(resource.imageUrl).toBe('http://example.test/demo/atlases/a.png');

      resource.dispose();
    });
  });

  describe('a tile set animation entry whose tiles cannot be picked is skipped', () => {
    const loadTileSetWith = async (animationsData: unknown) => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 64, height: 64, tag: 'tiles'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();

      const resource = TextureResource.fromTileSet(
        'tiles',
        'tiles.png',
        {tileWidth: 16, tileHeight: 16},
        undefined,
        // the catalog json carries what it carries
        animationsData as FrameBasedAnimationsDataMap,
      );
      resource.activate();

      const errors: Array<{source: string; id: string; animation: string; error: Error}> = [];
      on(resource, 'error', (payload: {source: string; id: string; animation: string; error: Error}) => {
        errors.push(payload);
      });

      resource.textureFactory = factory;
      await flushMicrotasks();

      return {resource, errors};
    };

    test('an entry whose tileIds is no array is skipped and reported, the other entries are registered', async () => {
      const {resource, errors} = await loadTileSetWith({
        walk: {duration: 1, tileIds: 3},
        run: {duration: 1, tileIds: [1, 2]},
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'frameBasedAnimations', id: 'tiles', animation: 'walk'});
      expect(errors[0]!.error.message).toBe(
        'TextureResource: animation "walk" of resource "tiles" carries tileIds of 3 — tileIds is an array of tile ids',
      );
      expect(resource.frameBasedAnimations!.hasAnimation('walk')).toBe(false);
      expect(resource.frameBasedAnimations!.hasAnimation('run')).toBe(true);

      resource.dispose();
    });

    test('an entry with a tileCount of "5" is skipped and reported with the message of add()', async () => {
      const {resource, errors} = await loadTileSetWith({
        walk: {duration: 1, firstTileId: 1, tileCount: '5'},
        run: {duration: 1, firstTileId: 1, tileCount: 2},
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'frameBasedAnimations', id: 'tiles', animation: 'walk'});
      expect(errors[0]!.error.message).toBe(
        `FrameBasedAnimations: add() got a tileCount of "5" for the animation "walk" — a tileCount is a whole number from 1 to ${FrameBasedAnimations.MaxTextureSize}`,
      );
      expect(resource.frameBasedAnimations!.hasAnimation('walk')).toBe(false);
      expect(resource.frameBasedAnimations!.hasAnimation('run')).toBe(true);

      resource.dispose();
    });
  });

  describe('atlas adapters', () => {
    const asepriteJson = () => ({
      frames: {
        'f 0': {frame: {x: 0, y: 0, w: 8, h: 8}, duration: 100},
        'f 1': {frame: {x: 8, y: 0, w: 8, h: 8}, duration: 300},
      },
      meta: {
        app: 'https://www.aseprite.org/',
        image: 'sheet.png',
        size: {w: 16, h: 8},
        frameTags: [{name: 'blink', from: 0, to: 1, direction: 'forward'}],
      },
    });
    const packerJson = () => ({
      frames: {'f 0': {frame: {x: 0, y: 0, w: 8, h: 8}}},
      meta: {app: 'https://www.codeandweb.com/texturepacker', image: 'sheet.png', size: {w: 16, h: 8}},
    });

    // an atlas resource on its own with `json` written, its image loaded: what it published, and
    // what it reported
    const atlasResource = async (json: object, setup?: (resource: AtlasTextureResource) => void) => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        async () => ({width: 16, height: 8, tag: 'sheet'}) as unknown as HTMLImageElement,
      );
      const {factory} = makeTextureFactory();
      const resource = new AtlasTextureResource('sheet');
      const errors: Array<{source: string; animation?: string; error: Error}> = [];
      on(resource, 'error', (payload: {source: string; animation?: string; error: Error}) => {
        errors.push(payload);
      });
      resource.atlasJson = json as never;
      setup?.(resource);
      resource.activate();
      resource.textureFactory = factory;
      await flushMicrotasks();
      return {resource, errors};
    };

    test('a json that names Aseprite as its app publishes its tags as the animations, without catalog entries', async () => {
      const {resource, errors} = await atlasResource(asepriteJson());

      expect(errors).toEqual([]);
      expect(resource.atlas!.frameNames()).toEqual(['f 0', 'f 1']);
      expect(resource.frameBasedAnimations!.animation('blink').durations).toEqual([0.1, 0.3]);
      resource.dispose();
    });

    test('a TexturePacker json without catalog entries publishes no animations, as before', async () => {
      const {resource} = await atlasResource(packerJson());

      expect(resource.atlas!.frameNames()).toEqual(['f 0']);
      expect(resource.frameBasedAnimations).toBeUndefined();
      resource.dispose();
    });

    test('the catalog entries are added to the tags, and an entry named like a tag is skipped and reported', async () => {
      const {resource, errors} = await atlasResource(asepriteJson(), (r) => {
        r.frameBasedAnimationsData = {
          first: {duration: 1, frameNameQuery: '^f 0$'},
          blink: {duration: 1, frameNameQuery: '^f 1$'},
        };
      });

      const animations = resource.frameBasedAnimations!;
      expect([animations.animId('blink'), animations.animId('first')]).toEqual([0, 1]);
      expect(animations.animation('blink').frameCount).toBe(2);
      expect(errors.map(({source, animation}) => [source, animation])).toEqual([['frameBasedAnimations', 'blink']]);
      resource.dispose();
    });

    test('a change of the catalog entries adds them to a fresh copy of the tags', async () => {
      const {resource} = await atlasResource(asepriteJson(), (r) => {
        r.frameBasedAnimationsData = {first: {duration: 1, frameNameQuery: '^f 0$'}};
      });
      const before = resource.frameBasedAnimations!;

      resource.frameBasedAnimationsData = {second: {duration: 1, frameNameQuery: '^f 1$'}};

      const after = resource.frameBasedAnimations!;
      expect(after).not.toBe(before);
      expect([after.hasAnimation('first'), after.hasAnimation('second'), after.animId('second')]).toEqual([false, true, 1]);
      expect(before.hasAnimation('second')).toBe(false);
      resource.dispose();
    });

    test('an atlasAdapter written to the resource reads the json, laid out in the coords of the image', async () => {
      const seen: unknown[] = [];
      const {resource} = await atlasResource(packerJson(), (r) => {
        r.atlasAdapter = (json, parentCoords) => {
          seen.push(json.meta.image, parentCoords.width, parentCoords.height);
          const animations = new FrameBasedAnimations();
          animations.add('custom', 1, [parentCoords]);
          return {atlas: TexturePackerJson.parse(json, parentCoords)[0], animations};
        };
      });

      expect(seen).toEqual(['sheet.png', 16, 8]);
      expect(resource.frameBasedAnimations!.hasAnimation('custom')).toBe(true);
      resource.dispose();
    });

    test('another atlasAdapter reads the json again', async () => {
      const {resource} = await atlasResource(asepriteJson());
      const first = resource.atlas;

      resource.atlasAdapter = (json, parentCoords) => ({atlas: TexturePackerJson.parse(json, parentCoords)[0]});

      expect(resource.atlas).not.toBe(first);
      expect(resource.frameBasedAnimations).toBeUndefined();
      resource.dispose();
    });

    test('the injected picker chooses the adapter of a json while none is written', async () => {
      const {resource} = await atlasResource(packerJson(), (r) => {
        r[atlasAdapterPicker] = () => (json, parentCoords) => {
          const animations = new FrameBasedAnimations();
          animations.add('picked', 1, [parentCoords]);
          return {atlas: TexturePackerJson.parse(json, parentCoords)[0], animations};
        };
      });

      expect(resource.frameBasedAnimations!.hasAnimation('picked')).toBe(true);
      resource.dispose();
    });

    test('an adapter that throws takes atlas and animations back and is reported', async () => {
      const {resource, errors} = await atlasResource(asepriteJson(), (r) => {
        r.atlasAdapter = () => {
          throw new Error('unreadable');
        };
      });

      expect([resource.atlas, resource.frameBasedAnimations]).toEqual([undefined, undefined]);
      expect(errors.map(({source, error}) => [source, error.message])).toEqual([['texture', 'unreadable']]);
      expect(resource[loadFailureFor](['atlas'])?.error).toBe(errors[0]!.error);
      resource.dispose();
    });

    test.each([
      [() => ({}), 'the atlas adapter of resource "sheet" answered no atlas — an adapter answers {atlas, animations?}'],
      [() => undefined, 'the atlas adapter of resource "sheet" answered no atlas — an adapter answers {atlas, animations?}'],
      [
        (json: never, parentCoords: never) => ({atlas: TexturePackerJson.parse(json, parentCoords)[0], animations: {}}),
        'the atlas adapter of resource "sheet" answered animations that are no FrameBasedAnimations — an adapter answers a FrameBasedAnimations or none',
      ],
    ])('an adapter answer that is no atlas is reported: %#', async (adapter, message) => {
      const {resource, errors} = await atlasResource(packerJson(), (r) => {
        r.atlasAdapter = adapter as never;
      });

      expect(resource.atlas).toBeUndefined();
      expect(errors.map(({error}) => error.message)).toEqual([`TextureResource: ${message}`]);
      resource.dispose();
    });

    test('atlasAdapter belongs to an atlas resource', () => {
      const resource = new ImageTextureResource('image');

      expect(() => {
        // @ts-expect-error an image resource has no atlasAdapter
        resource.atlasAdapter = () => ({atlas: new TextureAtlas()});
      }).toThrow(new TypeError('TextureResource "image" is an "image" resource and has no "atlasAdapter"'));
      // @ts-expect-error an image resource has no atlasAdapter
      expect(resource.atlasAdapter).toBeUndefined();
      resource.dispose();
    });
  });
});
