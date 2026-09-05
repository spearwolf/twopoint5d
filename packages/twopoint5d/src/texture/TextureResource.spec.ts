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
    test('does NOT dispose a texture that was handed in', () => {
      const foreign: StubTexture = {
        tag: 'foreign',
        name: '',
        disposed: false,
        dispose() {
          this.disposed = true;
        },
      };
      const textureDispose = sandbox.spy(foreign, 'dispose');

      const resource = TextureResource.fromImage('handed-in', 'handed-in.png');
      resource.load();
      resource.texture = foreign as unknown as Texture;

      resource.dispose();

      expect(textureDispose.called).toBe(false);
    });

    // (c) every public member behaves after dispose() as its TSDoc says.
    // There is no member of the second kind here — no getter of this class is typed as
    // always present — so the "throws" assertion of the pattern has no subject.
    test('behaves as documented after dispose()', async () => {
      const {resource} = await loadTexture('documented', 'documented');

      resource.dispose();

      expect(resource.texture).toBeUndefined();
      expect(resource.id).toBe('documented');
      expect(resource.imageUrl).toBe('documented.png');
      expect(resource.imageCoords?.width).toBe(8);
      expect(resource.textureFactory).toBeDefined();
      expect(() => {
        resource.texture = undefined;
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
  });

  describe('load()', () => {
    test('registers no dispose listener of its own', () => {
      const resource = TextureResource.fromTileSet('t', 'tiles.png', {tileWidth: 16, tileHeight: 16});

      const before = getSubscriptionCount(resource);
      resource.load();

      expect(getSubscriptionCount(resource)).toBe(before);

      resource.dispose();
    });
  });
});
