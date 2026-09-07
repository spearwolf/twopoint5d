import {getSubscriptionCount, on} from '@spearwolf/eventize';
import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {ImageLoader, type Texture} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';

import {TextureResource} from './TextureResource.js';

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
      expect(() => resource.frameBasedAnimations!.animId('walk')).toThrow();

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
      expect(() => resource.frameBasedAnimations!.animId('walk')).toThrow();

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
  });

  describe('setters on the wrong shape', () => {
    test('an image resource refuses tileSetOptions', () => {
      const resource = TextureResource.fromImage('hero', 'hero.png');

      expect(() => {
        resource.tileSetOptions = {tileWidth: 16};
      }).toThrow(TypeError);
      expect(resource.tileSetOptions).toBeUndefined();

      resource.dispose();
    });

    test('a tileset resource refuses an atlasUrl', () => {
      const resource = TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16});

      expect(() => {
        resource.atlasUrl = 'x.json';
      }).toThrow(TypeError);
      expect(resource.atlasUrl).toBeUndefined();

      resource.dispose();
    });

    test('an atlas resource refuses a write to imageUrl', () => {
      const resource = TextureResource.fromAtlas('deco', 'deco.json');

      expect(() => {
        resource.imageUrl = 'other.png';
      }).toThrow(TypeError);
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
  });
});
