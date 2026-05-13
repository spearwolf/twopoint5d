import {getSubscriptionCount, on} from '@spearwolf/eventize';
import {ImageLoader} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';
import {TextureResource, TextureResourceEvents, TextureResourceSubtypes} from './TextureResource.js';
import {TextureStore, TextureStoreEvents} from './TextureStore.js';
import type {TextureStoreData} from './types.js';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('TextureStore', () => {
  test('create', () => {
    const store = new TextureStore();
    expect(store).toBeInstanceOf(TextureStore);
  });

  test('on', () => {
    const store = new TextureStore();

    const wait = store.on('foo', ['atlas', 'imageCoords'], ([atlas, coords]) => {
      atlas.randomFrame();
      coords.flipDiagonal();
    });

    expect(wait).toBeInstanceOf(Function);
    wait();
  });

  describe('parse() input safety', () => {
    test('does not mutate data.defaultTextureClasses', () => {
      const store = new TextureStore();
      const data: TextureStoreData = {
        defaultTextureClasses: ['nearest', 'no-flipy'],
        items: {},
      };

      store.parse(data);

      expect(data.defaultTextureClasses).toEqual(['nearest', 'no-flipy']);
      expect(store.defaultTextureClasses).toEqual(['nearest', 'no-flipy']);
    });

    test('does not mutate item.texture (textureClasses) arrays', () => {
      const store = new TextureStore();
      const textureClasses: ('nearest' | 'flipy')[] = ['nearest', 'flipy'];
      const data: TextureStoreData = {
        defaultTextureClasses: [],
        items: {
          tex: {
            imageUrl: 'foo.png',
            texture: textureClasses,
          },
        },
      };

      store.parse(data);

      expect(textureClasses).toEqual(['nearest', 'flipy']);
    });

    test('re-parsing with same defaultTextureClasses still applies them', () => {
      const store = new TextureStore();
      const data: TextureStoreData = {
        defaultTextureClasses: ['linear'],
        items: {},
      };

      store.parse(data);
      store.parse(data);

      expect(store.defaultTextureClasses).toEqual(['linear']);
    });
  });

  describe('dispose()', () => {
    test('dispose() emits OnDispose on store and on each resource exactly once', () => {
      const store = new TextureStore();
      const data: TextureStoreData = {
        defaultTextureClasses: [],
        items: {a: {imageUrl: 'a.png'}, b: {imageUrl: 'b.png'}},
      };
      store.parse(data);

      const storeDispose = vi.fn();
      on(store, 'dispose', storeDispose);

      let resourceCount = 0;
      const resourceDisposes: Record<string, number> = {a: 0, b: 0};
      store.onResource('a', (r) => {
        resourceCount++;
        on(r, 'dispose', () => {
          resourceDisposes['a']++;
        });
      });
      store.onResource('b', (r) => {
        resourceCount++;
        on(r, 'dispose', () => {
          resourceDisposes['b']++;
        });
      });
      expect(resourceCount).toBe(2);

      expect(() => store.dispose()).not.toThrow();
      expect(storeDispose).toHaveBeenCalledTimes(1);
      expect(resourceDisposes).toEqual({a: 1, b: 1});
    });

    test('TextureResource.dispose() is idempotent and does not throw', () => {
      const resource = TextureResource.fromImage('x', 'x.png');
      expect(() => resource.dispose()).not.toThrow();
      expect(() => resource.dispose()).not.toThrow();
    });
  });

  describe('defaultTextureClasses as signal (§4.6)', () => {
    test('changing defaultTextureClasses propagates merged classes into existing resources on next parse()', () => {
      const store = new TextureStore();
      store.parse({
        defaultTextureClasses: ['nearest'],
        items: {a: {imageUrl: 'a.png'}},
      });
      let resource: TextureResource | undefined;
      store.onResource('a', (r) => {
        resource = r;
      });
      expect(resource?.textureClasses).toEqual(['nearest']);

      store.defaultTextureClasses = ['linear', 'no-flipy'];
      store.parse({
        defaultTextureClasses: ['linear', 'no-flipy'],
        items: {a: {imageUrl: 'a.png'}},
      });

      expect(resource?.textureClasses?.sort()).toEqual(['linear', 'no-flipy'].sort());
    });

    test('assigning defaultTextureClasses with equal content is a no-op (cmp)', () => {
      const store = new TextureStore();
      const before: ('nearest' | 'flipy')[] = ['nearest', 'flipy'];
      store.defaultTextureClasses = before;
      // re-assigning a structurally equal array should not change the stored value reference semantics
      store.defaultTextureClasses = ['nearest', 'flipy'];
      expect(store.defaultTextureClasses).toEqual(['nearest', 'flipy']);
    });
  });

  describe('parse() batching (§6.4)', () => {
    test('OnReady fires once after all resources are added', () => {
      const store = new TextureStore();
      let readyCount = 0;
      let resourcesAtReady = 0;
      on(store, TextureStoreEvents.Ready, () => {
        readyCount++;
        store.onResource('a', () => {
          resourcesAtReady++;
        });
        store.onResource('b', () => {
          resourcesAtReady++;
        });
      });

      store.parse({
        defaultTextureClasses: [],
        items: {a: {imageUrl: 'a.png'}, b: {imageUrl: 'b.png'}},
      });

      expect(readyCount).toBe(1);
      expect(resourcesAtReady).toBe(2);
    });
  });

  describe('central TextureFactory (§3.3, §6.1)', () => {
    test('TextureStore exposes a `textureFactory` that all resources share', () => {
      const store = new TextureStore();
      // assign a stub "renderer" with the expected API surface
      const stubRenderer = {getMaxAnisotropy: () => 16};
      store.renderer = stubRenderer as never;

      store.parse({
        defaultTextureClasses: [],
        items: {a: {imageUrl: 'a.png'}, b: {imageUrl: 'b.png'}},
      });

      const factory = store.textureFactory;
      expect(factory).toBeDefined();

      let resA: TextureResource | undefined;
      let resB: TextureResource | undefined;
      store.onResource('a', (r) => {
        resA = r;
      });
      store.onResource('b', (r) => {
        resB = r;
      });
      expect(resA?.textureFactory).toBe(factory);
      expect(resB?.textureFactory).toBe(factory);

      // swap renderer → new shared factory propagates
      const stubRenderer2 = {getMaxAnisotropy: () => 8};
      store.renderer = stubRenderer2 as never;
      const factory2 = store.textureFactory;
      expect(factory2).not.toBe(factory);
      expect(resA?.textureFactory).toBe(factory2);
      expect(resB?.textureFactory).toBe(factory2);
    });
  });

  describe('on()/get() accept both string-literal and constant forms', () => {
    test('string-literal form: type narrows correctly for single subtype and tuple', () => {
      const store = new TextureStore();

      // single — type assertion would fail at build if literal narrowing broke
      const u1 = store.on('a', 'texture', (val) => {
        // val should be typed as `Texture | undefined`
        void val;
      });
      // tuple — should narrow each slot to its type
      const u2 = store.on('a', ['atlas', 'imageCoords'], ([atlas, coords]) => {
        atlas.randomFrame();
        coords.flipDiagonal();
      });

      expect(typeof u1).toBe('function');
      expect(typeof u2).toBe('function');
      u1();
      u2();
    });

    test('constant form via TextureResourceSubtypes produces the same runtime + type behavior', () => {
      const store = new TextureStore();

      const u1 = store.on('a', TextureResourceSubtypes.Texture, () => {});
      const u2 = store.on('a', [TextureResourceSubtypes.Atlas, TextureResourceSubtypes.ImageCoords], () => {});

      expect(typeof u1).toBe('function');
      expect(typeof u2).toBe('function');
      u1();
      u2();
    });

    test('get() resolves with the correctly-typed tuple for the string-literal form', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});
      // Just verify we can wire the call — the resolve depends on image loading
      // which is covered elsewhere. This call serves as a TS compile-check via the
      // destructure usage below.
      const p = store.get('a', ['texture', 'imageCoords']);
      const ac = new AbortController();
      ac.abort();
      const pAborted = store.get('a', ['texture', 'imageCoords'], {signal: ac.signal});
      await expect(pAborted).rejects.toThrow();
      // p never resolves in this test (no image loader); intentionally leave dangling.
      void p;
      store.dispose();
    });
  });

  describe('event constants (§4.3, §4.7)', () => {
    test('TextureStoreEvents constants match emitted event names', () => {
      const store = new TextureStore();
      const ready = vi.fn();
      const dispose = vi.fn();
      on(store, TextureStoreEvents.Ready, ready);
      on(store, TextureStoreEvents.Dispose, dispose);
      store.parse({defaultTextureClasses: [], items: {}});
      store.dispose();
      expect(ready).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    test('TextureResourceSubtypes covers all subtypes', () => {
      expect(Object.values(TextureResourceSubtypes).sort()).toEqual(
        ['atlas', 'frameBasedAnimations', 'imageCoords', 'texture', 'tileSet'].sort(),
      );
    });

    test('TextureResourceEvents reuses subtype values', () => {
      expect(TextureResourceEvents.Atlas).toBe(TextureResourceSubtypes.Atlas);
    });
  });

  describe('error events instead of console.error (BUG-11)', () => {
    test("TextureStore.load() emits 'error' on fetch failure", async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
      try {
        const store = new TextureStore();
        const errorHandler = vi.fn();
        on(store, 'error', errorHandler);
        store.load('http://example.test/bad.json');
        await flushMicrotasks();
        await flushMicrotasks();
        expect(errorHandler).toHaveBeenCalledTimes(1);
        const event = errorHandler.mock.calls[0][0];
        expect(event.source).toBe('fetch');
      } finally {
        fetchMock.mockRestore();
      }
    });

    test("TextureStore.load() emits 'error' on parse failure", async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not-json'));
      try {
        const store = new TextureStore();
        const errorHandler = vi.fn();
        on(store, 'error', errorHandler);
        store.load('http://example.test/bad.json');
        await flushMicrotasks();
        await flushMicrotasks();
        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].source).toBe('parse');
      } finally {
        fetchMock.mockRestore();
      }
    });
  });

  describe('whenResource() / abortable get() (BUG-10)', () => {
    test('whenResource() resolves when the resource is present at call time', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});
      const resource = await store.whenResource('a');
      expect(resource.id).toBe('a');
    });

    test('whenResource() rejects after first ready if the id is missing', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {other: {imageUrl: 'o.png'}}});
      await expect(store.whenResource('missing')).rejects.toThrow(/missing/);
    });

    test('whenResource() waits until parse() is called', async () => {
      const store = new TextureStore();
      const p = store.whenResource('a');
      setTimeout(() => {
        store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});
      }, 0);
      const resource = await p;
      expect(resource.id).toBe('a');
    });

    test('get() with AbortSignal rejects when aborted', async () => {
      const store = new TextureStore();
      const ac = new AbortController();
      const p = store.get('never', 'texture', {signal: ac.signal});
      ac.abort();
      await expect(p).rejects.toThrow(/aborted/i);
    });
  });

  describe('clearUnused() (BUG-9)', () => {
    test('removes and disposes resources with refCount === 0; keeps subscribed ones', () => {
      const store = new TextureStore();
      const data: TextureStoreData = {
        defaultTextureClasses: [],
        items: {
          a: {imageUrl: 'a.png'},
          b: {imageUrl: 'b.png'},
          c: {imageUrl: 'c.png'},
        },
      };
      store.parse(data);

      // subscribe to a — this should bump a's refCount to 1
      const unsubA = store.on('a', 'imageCoords', () => {});

      // collect resource references via onResource
      const resources: Record<string, TextureResource> = {};
      store.onResource('a', (r) => {
        resources['a'] = r;
      });
      store.onResource('b', (r) => {
        resources['b'] = r;
      });
      store.onResource('c', (r) => {
        resources['c'] = r;
      });

      expect(resources['a'].refCount).toBe(1);
      expect(resources['b'].refCount).toBe(0);
      expect(resources['c'].refCount).toBe(0);

      const disposedB = vi.fn();
      const disposedC = vi.fn();
      on(resources['b'], 'dispose', disposedB);
      on(resources['c'], 'dispose', disposedC);

      const removed = store.clearUnused();
      expect(removed).toBe(2);
      expect(disposedB).toHaveBeenCalledTimes(1);
      expect(disposedC).toHaveBeenCalledTimes(1);

      // a is still there
      let resourceASeen: TextureResource | undefined;
      store.onResource('a', (r) => {
        resourceASeen = r;
      });
      expect(resourceASeen).toBe(resources['a']);

      // b/c are gone — onResource won't fire synchronously
      let resourceBSeen: TextureResource | undefined;
      store.onResource('b', (r) => {
        resourceBSeen = r;
      });
      expect(resourceBSeen).toBeUndefined();

      unsubA();
    });
  });

  describe('on()/get() listener bookkeeping (BUG-8)', () => {
    test('unsubscribe() removes the OnDispose listener', () => {
      const store = new TextureStore();
      const base = getSubscriptionCount(store);
      const unsub1 = store.on('foo', 'texture', () => {});
      const unsub2 = store.on('bar', 'texture', () => {});
      const peak = getSubscriptionCount(store);
      expect(peak).toBeGreaterThan(base);

      unsub1();
      unsub2();

      expect(getSubscriptionCount(store)).toBe(base);
    });
  });

  describe('parse() update path (BUG-3)', () => {
    test('frameBasedAnimationsData is updated on existing TileSet resources', () => {
      const store = new TextureStore();
      const initialData: TextureStoreData = {
        defaultTextureClasses: [],
        items: {
          ts: {
            imageUrl: 'tiles.png',
            tileSet: {tileWidth: 16, tileHeight: 16},
            frameBasedAnimations: {walk: {duration: 1, tileIds: [1, 2, 3]}},
          },
        },
      };
      store.parse(initialData);

      let resource: TextureResource | undefined;
      store.onResource('ts', (r) => {
        resource = r;
      });
      expect(resource?.frameBasedAnimationsData).toEqual({walk: {duration: 1, tileIds: [1, 2, 3]}});

      const updated: TextureStoreData = {
        defaultTextureClasses: [],
        items: {
          ts: {
            imageUrl: 'tiles.png',
            tileSet: {tileWidth: 16, tileHeight: 16},
            frameBasedAnimations: {run: {duration: 0.5, tileIds: [4, 5]}},
          },
        },
      };
      store.parse(updated);

      expect(resource?.frameBasedAnimationsData).toEqual({run: {duration: 0.5, tileIds: [4, 5]}});
    });

    test('frameBasedAnimationsData is updated on existing Atlas resources', () => {
      const store = new TextureStore();
      const initial: TextureStoreData = {
        defaultTextureClasses: [],
        items: {
          a: {
            atlasUrl: 'atlas.json',
            frameBasedAnimations: {idle: {duration: 1, frameNameQuery: 'idle.*'}},
          },
        },
      };
      store.parse(initial);
      let resource: TextureResource | undefined;
      store.onResource('a', (r) => {
        resource = r;
      });
      expect(resource?.frameBasedAnimationsData).toEqual({idle: {duration: 1, frameNameQuery: 'idle.*'}});

      const updated: TextureStoreData = {
        defaultTextureClasses: [],
        items: {
          a: {
            atlasUrl: 'atlas.json',
            frameBasedAnimations: {jump: {duration: 0.3, frameNameQuery: 'jump.*'}},
          },
        },
      };
      store.parse(updated);

      expect(resource?.frameBasedAnimationsData).toEqual({jump: {duration: 0.3, frameNameQuery: 'jump.*'}});
    });

    test('TextureResource.fromAtlas accepts initial frameBasedAnimations data', () => {
      const resource = TextureResource.fromAtlas('a', 'atlas.json', undefined, undefined, {
        idle: {duration: 1, frameNameQuery: 'idle.*'},
      });
      expect(resource.frameBasedAnimationsData).toEqual({idle: {duration: 1, frameNameQuery: 'idle.*'}});
    });

    test('TextureResource.fromImage accepts (but ignores) frameBasedAnimationsData setter without a signal', () => {
      const resource = TextureResource.fromImage('i', 'img.png');
      resource.frameBasedAnimationsData = {x: {duration: 1, tileIds: [1]}};
      expect(resource.frameBasedAnimationsData).toEqual({x: {duration: 1, tileIds: [1]}});
    });
  });

  describe('TextureResource.load() initial firing (lookbook regression)', () => {
    test('image-load effect runs even when factory + imageUrl are already set before load()', async () => {
      let resolveLoad!: (img: unknown) => void;
      const loadP = new Promise<unknown>((r) => {
        resolveLoad = r;
      });
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementationOnce(() => loadP as Promise<HTMLImageElement>);

      const factory = {
        create(img: {width: number; height: number; tag: string}) {
          return {tag: img.tag, name: '', disposed: false, dispose() {}};
        },
      };

      const resource = TextureResource.fromImage('rx', 'first.png');
      // mimic the store flow: both factory and url are set BEFORE load() registers effects
      resource.textureFactory = factory as never;
      resource.load();

      resolveLoad({width: 10, height: 10, tag: 'live'});
      await flushMicrotasks();
      await flushMicrotasks();

      expect((resource.texture as unknown as {tag: string} | undefined)?.tag).toBe('live');

      loadSpy.mockRestore();
      resource.dispose();
    });
  });

  describe('TextureResource.load() image race (BUG-4)', () => {
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

      const stubTextures: Array<{tag: string; disposed: boolean; dispose: () => void; name: string}> = [];
      const factory = {
        create(img: {width: number; height: number; tag: string}) {
          const tex = {
            tag: img.tag,
            disposed: false,
            name: '',
            dispose() {
              this.disposed = true;
            },
          };
          stubTextures.push(tex);
          return tex;
        },
      };

      const resource = TextureResource.fromImage('rx', 'first.png');
      resource.load();
      // setting the factory after load() triggers the image-loading effect
      resource.textureFactory = factory as never;
      // change imageUrl while first.png is still pending → forces a second load + abort
      resource.imageUrl = 'second.png';

      resolveFirst({width: 100, height: 50, tag: 'first'});
      await flushMicrotasks();

      expect(stubTextures.some((t) => t.tag === 'first')).toBe(false);
      expect(resource.texture).toBeUndefined();

      resolveSecond({width: 200, height: 100, tag: 'second'});
      await flushMicrotasks();

      expect((resource.texture as unknown as {tag: string} | undefined)?.tag).toBe('second');

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

      const createdTextures: Array<{tag: string; disposed: boolean; dispose: () => void; name: string}> = [];
      const factory = {
        create(img: {width: number; height: number; tag: string}) {
          const tex = {
            tag: img.tag,
            disposed: false,
            name: '',
            dispose() {
              this.disposed = true;
            },
          };
          createdTextures.push(tex);
          return tex;
        },
      };

      const resource = TextureResource.fromImage('ry', 'pending.png');
      resource.load();
      resource.textureFactory = factory as never;

      resource.dispose();

      resolveLoad({width: 10, height: 10, tag: 'pending'});
      await flushMicrotasks();

      // either the load was aborted before factory.create was called,
      // or the created texture was disposed afterwards — neither must leak.
      for (const t of createdTextures) {
        expect(t.disposed).toBe(true);
      }
      expect(resource.texture).toBeUndefined();

      loadSpy.mockRestore();
    });
  });

  describe('static load()', () => {
    test('awaits whenReady() before resolving — resource is present after await', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            defaultTextureClasses: [],
            items: {tex: {imageUrl: 'img.png'}},
          }),
        ),
      );

      try {
        const store = await TextureStore.load('http://example.test/data.json');
        expect(store).toBeInstanceOf(TextureStore);

        let resourceSeen: TextureResource | undefined;
        store.onResource('tex', (r) => {
          resourceSeen = r;
        });

        expect(resourceSeen).toBeDefined();
        expect(resourceSeen?.id).toBe('tex');
      } finally {
        fetchMock.mockRestore();
      }
    });
  });

  describe('TextureResource.fromX input safety', () => {
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
