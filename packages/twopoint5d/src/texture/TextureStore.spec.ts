import {emit, getRetainedEventNames, getSubscriptionCount, on} from '@spearwolf/eventize';
import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {ImageLoader, LinearFilter, NearestFilter, type Texture, type WebGPURenderer} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';
import {TextureResource, TextureResourceEvents, TextureResourceSubtypes} from './TextureResource.js';
import {TextureFactory} from './TextureFactory.js';
import {TextureStore, TextureStoreEvents} from './TextureStore.js';
import type {TextureStoreData} from './types.js';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// the factory asks a renderer for exactly one thing, so a stub that answers it is a renderer
// enough; `dispose` is there for the test that watches whether the store releases a renderer
const makeRendererStub = ({maxAnisotropy = 16, dispose = () => {}}: {maxAnisotropy?: number; dispose?: () => void} = {}) =>
  ({getMaxAnisotropy: () => maxAnisotropy, dispose}) as unknown as WebGPURenderer;

// a promise that never settles would run into the vitest timeout instead of failing; this races it
// against a short timer so a still-waiting promise reports itself as 'pending' in milliseconds
const settleWithin = <T>(promise: Promise<T>, ms = 50) =>
  Promise.race([
    promise.then(
      (value) => value,
      (error: unknown) => error,
    ),
    new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), ms)),
  ]);

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
    // (a) a resource the instance built itself is released exactly once
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
          resourceDisposes['a']!++;
        });
      });
      store.onResource('b', (r) => {
        resourceCount++;
        on(r, 'dispose', () => {
          resourceDisposes['b']!++;
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

    // (d) the second call throws nothing and releases nothing a second time
    test('a second dispose() does not emit the dispose event again', () => {
      const store = new TextureStore();
      store.dispose();

      const disposeAgain = vi.fn();
      on(store, TextureStoreEvents.Dispose, disposeAgain);

      expect(() => store.dispose()).not.toThrow();
      expect(disposeAgain).not.toHaveBeenCalled();
    });

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose a renderer that was handed to the constructor', () => {
      const rendererDispose = vi.fn();

      const store = new TextureStore(makeRendererStub({dispose: rendererDispose}));
      store.dispose();

      expect(rendererDispose).not.toHaveBeenCalled();
    });

    test('rejects a get() promise that is still pending', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      const pending = store.get('a', 'texture');
      store.dispose();

      await expect(pending).rejects.toThrow(/this store has been disposed/);
    });

    test('rejects a whenReady() promise that is still pending', async () => {
      const store = new TextureStore();

      const pending = store.whenReady();
      store.dispose();

      await expect(pending).rejects.toThrow(/this store has been disposed/);
    });

    test('rejects a whenResource() promise that is still pending', async () => {
      const store = new TextureStore();

      const pending = store.whenResource('a');
      store.dispose();

      await expect(pending).rejects.toThrow(/this store has been disposed/);
    });

    test('emits nothing after the dispose event', () => {
      const store = new TextureStore(makeRendererStub());

      const events: string[] = [];
      on(store, TextureStoreEvents.Dispose, () => {
        events.push(TextureStoreEvents.Dispose);
      });
      on(store, TextureStoreEvents.RendererChanged, () => {
        events.push(TextureStoreEvents.RendererChanged);
      });

      // rendererChanged is retained, so subscribing replays the renderer that is already there
      events.length = 0;

      store.dispose();

      expect(events).toEqual([TextureStoreEvents.Dispose]);

      // and nothing reaches a listener that arrives afterwards either: the store lets its
      // retain policies go along with its listeners, so there is no replay left to catch
      const late: string[] = [];
      for (const event of Object.values(TextureStoreEvents)) {
        on(store, event, () => {
          late.push(event);
        });
      }

      expect(late).toEqual([]);
    });

    test('parse() on a disposed store builds no resources', () => {
      const store = new TextureStore();
      store.dispose();

      const signalsAfterDispose = getSignalsCount();

      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});
      store.parse({defaultTextureClasses: [], items: {b: {imageUrl: 'b.png'}}});
      store.parse({defaultTextureClasses: [], items: {c: {imageUrl: 'c.png'}}});

      expect(getSignalsCount()).toBe(signalsAfterDispose);
      expect(store.clearUnused()).toBe(0);
    });

    test('load() on a disposed store does not fetch', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"items":{}}'));
      try {
        const store = new TextureStore();
        store.dispose();

        store.load('http://example.test/data.json');
        await flushMicrotasks();

        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        fetchMock.mockRestore();
      }
    });

    test('on() and onResource() on a disposed store leave no subscription', () => {
      const store = new TextureStore();
      store.dispose();

      const base = getSubscriptionCount(store);

      const unsubscribe = [
        store.on('a', 'texture', () => {}),
        store.on('b', ['atlas', 'imageCoords'], () => {}),
        store.onResource('c', () => {}),
      ];

      expect(getSubscriptionCount(store)).toBe(base);

      expect(() => {
        for (const cb of unsubscribe) cb();
      }).not.toThrow();

      expect(getSubscriptionCount(store)).toBe(base);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('behaves as documented after dispose()', () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"items":{}}'));
      try {
        const store = new TextureStore(makeRendererStub());
        store.defaultTextureClasses = ['nearest'];

        store.dispose();

        expect(store.renderer).toBeUndefined();
        expect(store.textureFactory).toBeUndefined();

        expect(() => {
          store.renderer = makeRendererStub();
        }).not.toThrow();

        expect(store.renderer).toBeUndefined();
        expect(store.textureFactory).toBeUndefined();

        expect(() => store.dispose()).not.toThrow();
        expect(() => store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}})).not.toThrow();
        expect(() => store.load('http://example.test/data.json')).not.toThrow();
        expect(store.clearUnused()).toBe(0);

        // a configuration array is no resource, and its last value stays right
        expect(store.defaultTextureClasses).toEqual(['nearest']);
      } finally {
        fetchMock.mockRestore();
      }
    });

    // (e) no signal or effect outlives the instance
    test('does not leak signals or effects', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      // subscribing is what makes the resource load(), and load() is where the effects come
      // from; without a renderer there is no texture factory, so the effect reaches no loader
      store.on('a', 'texture', () => {});

      expect(getSignalsCount()).toBeGreaterThan(baselineSignals);
      expect(getEffectsCount()).toBeGreaterThan(baselineEffects);

      store.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    // (f) has no subject here: the store takes no slot from a pool and no tile from a
    // factory. The resources it keeps are its own, and its shared TextureFactory builds
    // textures rather than lending them — nothing it hands out is ever given back.
  });

  describe('defaultTextureClasses, a field the next parse() reads', () => {
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

    test('an assignment reaches a resource with the next parse() that names it', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});
      const resource = await store.whenResource('a');

      store.defaultTextureClasses = ['nearest'];

      expect(resource.textureClasses).toBeUndefined();

      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      expect(resource.textureClasses).toEqual(['nearest']);
    });
  });

  describe('parse() emits ready once, after every resource of the data is in place', () => {
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

  describe('one TextureFactory for every resource of the store', () => {
    test('TextureStore exposes a `textureFactory` that all resources share', () => {
      const store = new TextureStore();
      store.renderer = makeRendererStub();

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
      store.renderer = makeRendererStub({maxAnisotropy: 8});
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
      await expect(pAborted).rejects.toThrow('get() aborted before subscription');
      // no image loader runs here, so `p` is still pending when the store goes away
      store.dispose();
      await expect(p).rejects.toThrow(/this store has been disposed/);
    });
  });

  describe('the event and subtype constants match what is emitted', () => {
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

  describe('error events instead of console.error', () => {
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
        const event = errorHandler.mock.calls[0]![0];
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
        expect(errorHandler.mock.calls[0]![0].source).toBe('parse');
      } finally {
        fetchMock.mockRestore();
      }
    });

    test("TextureStore.load() emits 'error' on a response that answers with a status", async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"items":{}}', {status: 404}));
      try {
        const store = new TextureStore();
        const errorHandler = vi.fn();
        const readyHandler = vi.fn();
        on(store, 'error', errorHandler);
        on(store, 'ready', readyHandler);
        store.load('http://example.test/missing.json');
        await flushMicrotasks();
        await flushMicrotasks();
        expect(errorHandler).toHaveBeenCalledTimes(1);
        const event = errorHandler.mock.calls[0]![0];
        expect(event.source).toBe('fetch');
        expect(event.status).toBe(404);
        expect(readyHandler).not.toHaveBeenCalled();
      } finally {
        fetchMock.mockRestore();
      }
    });
  });

  describe('load() answers as a promise', () => {
    test('resolves with the store once the attempt is over', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"items":{"a":{"imageUrl":"a.png"}}}'));
      try {
        const store = new TextureStore();

        const resolved = await store.load('http://example.test/data.json');

        expect(resolved).toBe(store);
        expect(await store.whenResource('a')).toBeInstanceOf(TextureResource);
      } finally {
        fetchMock.mockRestore();
      }
    });

    test('an attempt that failed resolves as well, and the reason arrives as an error event', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
      try {
        const store = new TextureStore();
        const errorHandler = vi.fn();
        on(store, 'error', errorHandler);

        const settled = await settleWithin(store.load('http://example.test/bad.json'));

        expect(settled).toBe(store);
        expect(errorHandler).toHaveBeenCalledTimes(1);
      } finally {
        fetchMock.mockRestore();
      }
    });

    test('on a disposed store it resolves right away and fetches nothing', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"items":{}}'));
      try {
        const store = new TextureStore();
        store.dispose();

        expect(await store.load('http://example.test/data.json')).toBe(store);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        fetchMock.mockRestore();
      }
    });
  });

  describe('a subtype without a value is not delivered', () => {
    test('the single-type path keeps an undefined away from the callback', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      const resource = await store.whenResource('a');
      const calls: unknown[] = [];
      store.on('a', 'texture', (texture) => {
        calls.push(texture);
      });

      // what a signal that is cleared and notifies leaves on the event
      emit(resource, 'texture', undefined);

      expect(calls).toEqual([]);

      const texture = {name: 'a'};
      emit(resource, 'texture', texture);

      expect(calls).toEqual([texture]);

      store.dispose();
    });
  });

  describe('whenResource() / abortable get()', () => {
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

    test('get() rejects once the first parse() has gone by without the id', async () => {
      const store = new TextureStore();
      const pending = store.get('missing', 'texture');

      store.parse({defaultTextureClasses: [], items: {other: {imageUrl: 'o.png'}}});

      await expect(pending).rejects.toThrow(/No resource with id "missing"/);

      store.dispose();
    });

    test('get() on an already disposed store is rejected', async () => {
      const store = new TextureStore();
      store.dispose();

      await expect(store.get('a', 'texture')).rejects.toThrow(/this store has been disposed/);
    });

    test('get() resolves when the value is already there at call time', async () => {
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 4, height: 4, tag: 'ready'}) as unknown as HTMLImageElement);

      const factory = {
        create(image: {tag: string}) {
          return {tag: image.tag, name: '', dispose() {}};
        },
      };

      try {
        const store = new TextureStore();
        store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

        // warm the resource up — this is what puts a value on the retained texture event,
        // so that the get() below is answered from within its own subscription call
        const warm = store.on('a', 'texture', () => {});
        store.onResource('a', (resource) => {
          resource.textureFactory = factory as never;
        });
        await flushMicrotasks();

        const texture = await store.get('a', 'texture');
        expect((texture as unknown as {tag: string}).tag).toBe('ready');

        warm();
        store.dispose();
      } finally {
        loadSpy.mockRestore();
      }
    });
  });

  describe('clearUnused()', () => {
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

      expect(resources['a']!.refCount).toBe(1);
      expect(resources['b']!.refCount).toBe(0);
      expect(resources['c']!.refCount).toBe(0);

      const disposedB = vi.fn();
      const disposedC = vi.fn();
      on(resources['b']!, 'dispose', disposedB);
      on(resources['c']!, 'dispose', disposedC);

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

  describe('on()/get() listener bookkeeping', () => {
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

    test('a get() that was aborted leaves no listener behind', async () => {
      const store = new TextureStore();
      const base = getSubscriptionCount(store);

      const ac = new AbortController();
      const aborted = store.get('a', 'texture', {signal: ac.signal});
      ac.abort();

      await expect(aborted).rejects.toThrow(/aborted/i);
      expect(getSubscriptionCount(store)).toBe(base);

      store.dispose();
    });

    test('a get() that gave up on a missing id leaves no listener behind', async () => {
      const store = new TextureStore();
      const base = getSubscriptionCount(store);

      const missing = store.get('missing', 'texture');
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      await expect(missing).rejects.toThrow(/No resource with id "missing"/);
      expect(getSubscriptionCount(store)).toBe(base);

      store.dispose();
    });

    test('a get() that resolved leaves no listener behind', async () => {
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 2, height: 2}) as unknown as HTMLImageElement);

      try {
        const store = new TextureStore();
        const base = getSubscriptionCount(store);
        store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});
        store.onResource('a', (resource) => {
          resource.textureFactory = {create: () => ({name: '', dispose() {}})} as never;
        });

        const value = await store.get('a', 'texture');

        expect(value).toBeDefined();
        expect(getSubscriptionCount(store)).toBe(base);

        store.dispose();
      } finally {
        loadSpy.mockRestore();
      }
    });

    test('a get() answered synchronously installs no abort listener on the caller signal', async () => {
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 2, height: 2}) as unknown as HTMLImageElement);

      try {
        const store = new TextureStore();
        store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

        // warm the resource up, so that the get() below is answered from within its own
        // subscription call and never reaches a state in which an abort could still matter
        const warm = store.on('a', 'texture', () => {});
        store.onResource('a', (resource) => {
          resource.textureFactory = {create: () => ({name: '', dispose() {}})} as never;
        });
        await flushMicrotasks();

        const ac = new AbortController();
        const addEventListener = vi.spyOn(ac.signal, 'addEventListener');

        const value = await store.get('a', 'texture', {signal: ac.signal});

        expect(value).toBeDefined();
        expect(addEventListener.mock.calls.filter(([type]) => type === 'abort')).toEqual([]);

        warm();
        store.dispose();
      } finally {
        loadSpy.mockRestore();
      }
    });

    // The fourth exit — the store being disposed under a pending get() — is deliberately
    // not measured here. dispose() ends with off(this), which drops every listener of the
    // store whether or not the promise cleaned up after itself, so a count taken around it
    // says nothing about this teardown. The exit itself is covered by "rejects a get()
    // promise that is still pending" in the dispose() block.
  });

  describe('parse() validates before it writes', () => {
    test('an item that names no source is reported', () => {
      const store = new TextureStore();
      const errors: Array<{source: string; id: string; error: Error}> = [];
      on(store, 'error', (payload: {source: string; id: string; error: Error}) => {
        errors.push(payload);
      });

      store.parse({defaultTextureClasses: [], items: {ghost: {}}});

      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('parse');
      expect(errors[0]!.id).toBe('ghost');
    });

    test('a type conflict leaves every resource of the run untouched', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}, b: {imageUrl: 'b.png'}}});

      const a = await store.whenResource('a');

      let readyCount = 0;
      on(store, 'ready', () => {
        readyCount++;
      });
      // the ready event is retained, so subscribing replays the parse that has already run
      readyCount = 0;

      expect(() =>
        store.parse({
          defaultTextureClasses: [],
          items: {a: {imageUrl: 'a2.png'}, b: {tileSet: {tileWidth: 8, tileHeight: 8}}},
        }),
      ).toThrow(
        '[TextureStore] parse() found 1 item(s) of a conflicting type: "b" is a "image" resource and cannot become "tileset"',
      );

      expect(a.imageUrl).toBe('a.png');
      expect(readyCount).toBe(0);
    });

    test('a type conflict leaves defaultTextureClasses as they were', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: ['nearest'], items: {a: {imageUrl: 'a.png'}}});

      expect(() =>
        store.parse({
          defaultTextureClasses: ['linear'],
          items: {a: {tileSet: {tileWidth: 8, tileHeight: 8}}},
        }),
      ).toThrow(
        '[TextureStore] parse() found 1 item(s) of a conflicting type: "a" is a "image" resource and cannot become "tileset"',
      );

      expect(store.defaultTextureClasses).toEqual(['nearest']);

      store.parse({defaultTextureClasses: [], items: {b: {imageUrl: 'b.png'}}});
      const b = await store.whenResource('b');

      expect(b.textureClasses).toEqual(['nearest']);
    });
  });

  describe('parse() update path', () => {
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

    test('parse({evictMissing: true}) disposes and removes resources the new data no longer names', () => {
      const store = new TextureStore();
      store.parse({
        defaultTextureClasses: [],
        items: {keep: {imageUrl: 'keep.png'}, drop: {imageUrl: 'drop.png'}, held: {imageUrl: 'held.png'}},
      });

      // a subscribed resource keeps its refCount above zero and therefore stays
      const unsubHeld = store.on('held', 'imageCoords', () => {});

      const resources: Record<string, TextureResource> = {};
      for (const id of ['keep', 'drop', 'held']) {
        store.onResource(id, (resource) => {
          resources[id] = resource;
        });
      }

      const dropDisposed = vi.fn();
      on(resources['drop']!, 'dispose', dropDisposed);
      const heldDisposed = vi.fn();
      on(resources['held']!, 'dispose', heldDisposed);

      store.parse({defaultTextureClasses: [], items: {keep: {imageUrl: 'keep.png'}}}, {evictMissing: true});

      expect(dropDisposed).toHaveBeenCalledTimes(1);
      expect(heldDisposed).not.toHaveBeenCalled();

      let dropSeen: TextureResource | undefined;
      store.onResource('drop', (resource) => {
        dropSeen = resource;
      });
      expect(dropSeen).toBeUndefined();

      let keepSeen: TextureResource | undefined;
      store.onResource('keep', (resource) => {
        keepSeen = resource;
      });
      expect(keepSeen).toBe(resources['keep']);

      unsubHeld();
      store.dispose();
    });
  });

  describe('an image is fetched once for every resource that names it', () => {
    const stubImage = () => ({width: 4, height: 4}) as unknown as HTMLImageElement;

    test('two resources that name the same image share one fetch and keep their own texture', async () => {
      const loadSpy = vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'shared.png'}, b: {imageUrl: 'shared.png'}}});

      const textures: unknown[] = [];
      store.on('a', 'texture', (texture) => {
        textures.push(texture);
      });
      store.on('b', 'texture', (texture) => {
        textures.push(texture);
      });

      await flushMicrotasks();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(textures).toHaveLength(2);
      expect(textures[0]).not.toBe(textures[1]);

      store.dispose();
      loadSpy.mockRestore();
    });

    test('the image is fetched again once no resource wants it any more', async () => {
      const loadSpy = vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'shared.png'}, b: {imageUrl: 'shared.png'}}});

      const unsubscribeA = store.on('a', 'texture', () => {});
      const unsubscribeB = store.on('b', 'texture', () => {});
      await flushMicrotasks();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      unsubscribeA();
      unsubscribeB();
      expect(store.clearUnused()).toBe(2);
      // the cache gives an image up one microtask after the last lease on it is given back
      await flushMicrotasks();

      store.parse({defaultTextureClasses: [], items: {c: {imageUrl: 'shared.png'}}});
      store.on('c', 'texture', () => {});
      await flushMicrotasks();

      expect(loadSpy).toHaveBeenCalledTimes(2);

      store.dispose();
      loadSpy.mockRestore();
    });

    test('a change of texture classes builds the new texture from the image already fetched', async () => {
      const loadSpy = vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      const textures: Texture[] = [];
      store.on('a', 'texture', (texture) => {
        textures.push(texture);
      });
      await flushMicrotasks();

      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png', texture: ['nearest']}}});
      await flushMicrotasks();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(textures).toHaveLength(2);
      expect(textures[1]).not.toBe(textures[0]);

      store.dispose();
    });

    test('a new renderer builds new textures from the images already fetched', async () => {
      const loadSpy = vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      const textures: Texture[] = [];
      store.on('a', 'texture', (texture) => {
        textures.push(texture);
      });
      await flushMicrotasks();

      store.renderer = makeRendererStub();
      await flushMicrotasks();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(textures).toHaveLength(2);
      expect(textures[1]).not.toBe(textures[0]);

      store.dispose();
    });

    test('an image still loading stays in the cache while the texture classes change', async () => {
      let resolveImage!: (image: HTMLImageElement) => void;
      const image = new Promise<HTMLImageElement>((resolve) => {
        resolveImage = resolve;
      });
      const loadSpy = vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(() => image);

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      const textures: Texture[] = [];
      store.on('a', 'texture', (texture) => {
        textures.push(texture);
      });
      await flushMicrotasks();

      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png', texture: ['nearest']}}});
      await flushMicrotasks();

      resolveImage(stubImage());
      await flushMicrotasks();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(textures).toHaveLength(1);
      expect(textures[0]!.magFilter).toBe(NearestFilter);

      store.dispose();
    });

    test('a load that failed and was retried by another resource keeps the retry cached when the first resource lets go', async () => {
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementationOnce(async () => {
          throw new Error('flaky');
        })
        .mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'shared.png'}, b: {imageUrl: 'shared.png'}}});

      const unsubscribeA = store.on('a', 'texture', () => {});
      await flushMicrotasks();

      store.on('b', 'texture', () => {});
      await flushMicrotasks();

      unsubscribeA();
      expect(store.clearUnused()).toBe(1);
      await flushMicrotasks();

      store.parse({defaultTextureClasses: [], items: {c: {imageUrl: 'shared.png'}}});
      store.on('c', 'texture', () => {});
      await flushMicrotasks();

      expect(loadSpy).toHaveBeenCalledTimes(2);

      store.dispose();
    });
  });

  describe('an atlas and the texture next to it belong to the same image', () => {
    test('every tuple a subscriber is called with carries an atlas and a texture of one image', async () => {
      const atlasJson = {
        frames: {f0: {frame: {x: 0, y: 0, w: 10, h: 10}}},
        meta: {image: 'first.png', size: {w: 100, h: 50}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));

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

      // the width of the image the texture was built from is what makes a texture
      // recognizable here; the atlas carries the same width through its frame coordinates
      const factory = {
        create(img: {width: number; height: number}) {
          return {width: img.width, name: '', dispose() {}};
        },
      };

      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {atlasUrl: 'atlas.json'}}});

      const resource = await store.whenResource('a');
      resource.textureFactory = factory as never;

      const tuples: Array<{atlasWidth: number | undefined; textureWidth: number}> = [];
      store.on('a', ['atlas', 'texture'], ([atlas, texture]) => {
        tuples.push({
          atlasWidth: atlas.frame('f0')?.coords.root?.width,
          textureWidth: (texture as unknown as {width: number}).width,
        });
      });

      await flushMicrotasks();
      resolveFirst({width: 100, height: 50});
      await flushMicrotasks();

      resource.overrideImageUrl = 'second.png';
      resolveSecond({width: 200, height: 100});
      await flushMicrotasks();
      await flushMicrotasks();

      expect(tuples.length).toBeGreaterThan(0);
      for (const tuple of tuples) {
        expect(tuple.atlasWidth).toBe(tuple.textureWidth);
      }
      // and the pair the subscriber ends up with is the second image
      expect(tuples.at(-1)).toEqual({atlasWidth: 200, textureWidth: 200});

      store.dispose();
      loadSpy.mockRestore();
      fetchMock.mockRestore();
    });

    test('an atlas resource refuses to be pointed at another image directly', async () => {
      const atlasJson = {
        frames: {f0: {frame: {x: 0, y: 0, w: 10, h: 10}}},
        meta: {image: 'first.png', size: {w: 100, h: 50}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));

      const sizeOfImage: Record<string, {width: number; height: number}> = {
        'first.png': {width: 100, height: 50},
        'other.png': {width: 200, height: 80},
      };
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async (url: string) => ({...sizeOfImage[url]}) as unknown as HTMLImageElement);

      const factory = {
        create(img: {width: number}) {
          return {width: img.width, name: '', dispose() {}};
        },
      };

      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {atlasUrl: 'atlas.json'}}});

      const resource = await store.whenResource('a');
      resource.textureFactory = factory as never;

      const tuples: Array<{atlasWidth: number | undefined; textureWidth: number}> = [];
      store.on('a', ['atlas', 'texture'], ([atlas, texture]) => {
        tuples.push({
          atlasWidth: atlas.frame('f0')?.coords.root?.width,
          textureWidth: (texture as unknown as {width: number}).width,
        });
      });

      await flushMicrotasks();
      await flushMicrotasks();

      // the image of an atlas resource is the one its json names — naming another one here
      // would leave the atlas describing a file the texture is not made of, and no later
      // json would ever bring the two back together
      const write = () => {
        resource.imageUrl = 'other.png';
      };

      expect(write).toThrow(TypeError);
      expect(write).toThrow(/takes its "imageUrl" from the atlas json/);

      await flushMicrotasks();
      await flushMicrotasks();

      expect(tuples.length).toBeGreaterThan(0);
      for (const tuple of tuples) {
        expect(tuple.atlasWidth).toBe(tuple.textureWidth);
      }
      expect(tuples.at(-1)).toEqual({atlasWidth: 100, textureWidth: 100});

      store.dispose();
      loadSpy.mockRestore();
      fetchMock.mockRestore();
    });

    test('a parse without the overrideImageUrl gives the atlas its json image back', async () => {
      const atlasJson = {
        frames: {f0: {frame: {x: 0, y: 0, w: 10, h: 10}}},
        meta: {image: 'first.png', size: {w: 100, h: 50}},
      };
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(atlasJson)));
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 100, height: 50}) as unknown as HTMLImageElement);
      const factory = {
        create() {
          return {name: '', dispose() {}};
        },
      };

      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {atlasUrl: 'atlas.json', overrideImageUrl: 'override.png'}}});
      const unsubscribe = store.on('a', 'texture', () => {});

      const resource = await store.whenResource('a');
      resource.textureFactory = factory as never;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.imageUrl).toBe('override.png');

      store.parse({defaultTextureClasses: [], items: {a: {atlasUrl: 'atlas.json'}}});
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.imageUrl).toBe('first.png');

      unsubscribe();
      store.dispose();
      loadSpy.mockRestore();
      fetchMock.mockRestore();
    });

    test('a parse that refuses the tile set options of a loaded resource reports it and completes', async () => {
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 64, height: 64}) as unknown as HTMLImageElement);
      const factory = {
        create() {
          return {name: '', dispose() {}};
        },
      };

      const store = new TextureStore();
      store.parse({
        defaultTextureClasses: [],
        items: {t: {imageUrl: 'tiles.png', tileSet: {tileWidth: 16, tileHeight: 16}}},
      });
      const unsubscribe = store.on('t', 'tileSet', () => {});

      const resource = await store.whenResource('t');
      resource.textureFactory = factory as never;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.tileSet).toBeDefined();

      const errors: unknown[] = [];
      on(resource, 'error', (payload: unknown) => errors.push(payload));
      let readyCount = 0;
      on(store, TextureStoreEvents.Ready, () => {
        readyCount++;
      });
      expect(readyCount).toBe(1);

      expect(() => {
        store.parse({
          defaultTextureClasses: [],
          items: {t: {imageUrl: 'tiles.png', tileSet: {tileWidth: 0, tileHeight: 16, tileCount: 4}}},
        });
      }).not.toThrow();
      await flushMicrotasks();

      expect(readyCount).toBe(2);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'texture', id: 't'});
      expect(resource.tileSet).toBeUndefined();

      const lateSpy = vi.fn();
      const unsubscribeLate = store.on('t', 'tileSet', lateSpy);
      await flushMicrotasks();

      expect(lateSpy).not.toHaveBeenCalled();

      unsubscribeLate();
      unsubscribe();
      store.dispose();
      loadSpy.mockRestore();
    });

    test('a parse() without animation data takes the animations of a known resource back', async () => {
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async () => ({width: 64, height: 64}) as unknown as HTMLImageElement);
      const factory = {
        create() {
          return {name: '', dispose() {}};
        },
      };

      const store = new TextureStore();
      store.parse({
        defaultTextureClasses: [],
        items: {
          t: {
            imageUrl: 'tiles.png',
            tileSet: {tileWidth: 16, tileHeight: 16},
            frameBasedAnimations: {walk: {duration: 1, tileIds: [1, 2]}},
          },
        },
      });
      const unsubscribe = store.on('t', 'frameBasedAnimations', () => {});

      const resource = await store.whenResource('t');
      resource.textureFactory = factory as never;
      await flushMicrotasks();
      await flushMicrotasks();

      expect(resource.frameBasedAnimations).toBeDefined();

      store.parse({
        defaultTextureClasses: [],
        items: {t: {imageUrl: 'tiles.png', tileSet: {tileWidth: 16, tileHeight: 16}}},
      });

      expect(resource.frameBasedAnimations).toBeUndefined();

      const lateSpy = vi.fn();
      const unsubscribeLate = store.on('t', 'frameBasedAnimations', lateSpy);
      await flushMicrotasks();

      expect(lateSpy).not.toHaveBeenCalled();

      unsubscribeLate();
      unsubscribe();
      store.dispose();
      loadSpy.mockRestore();
    });

    test('an atlas that swaps its json for one over another image of the same size follows it', async () => {
      const atlasesByUrl: Record<string, unknown> = {
        'a1.json': {frames: {f1: {frame: {x: 0, y: 0, w: 10, h: 10}}}, meta: {image: 'first.png', size: {w: 100, h: 50}}},
        'a2.json': {frames: {f2: {frame: {x: 0, y: 0, w: 10, h: 10}}}, meta: {image: 'second.png', size: {w: 100, h: 50}}},
      };
      // both images measure the same, so the coordinates built from them compare equal and
      // the frame name is what says which json — and with it which image — an atlas is from
      const imageOfFrame: Record<string, string> = {f1: 'first.png', f2: 'second.png'};

      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async (input) => new Response(JSON.stringify(atlasesByUrl[String(input)])));
      const loadSpy = vi
        .spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementation(async (url: string) => ({width: 100, height: 50, url}) as unknown as HTMLImageElement);

      const factory = {
        create(img: {url: string}) {
          return {image: img.url, name: '', dispose() {}};
        },
      };

      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {atlasUrl: 'a1.json'}}});

      const resource = await store.whenResource('a');
      resource.textureFactory = factory as never;

      const tuples: Array<{atlasImage: string | undefined; textureImage: string}> = [];
      store.on('a', ['atlas', 'texture'], ([atlas, texture]) => {
        const [frameName] = atlas.frameNames();
        tuples.push({
          atlasImage: imageOfFrame[String(frameName)],
          textureImage: (texture as unknown as {image: string}).image,
        });
      });

      await flushMicrotasks();
      await flushMicrotasks();

      resource.atlasUrl = 'a2.json';
      await flushMicrotasks();
      await flushMicrotasks();

      expect(tuples.length).toBeGreaterThan(0);
      for (const tuple of tuples) {
        expect(tuple.atlasImage).toBe(tuple.textureImage);
      }
      expect(tuples.at(-1)).toEqual({atlasImage: 'second.png', textureImage: 'second.png'});

      store.dispose();
      loadSpy.mockRestore();
      fetchMock.mockRestore();
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

    test('rejects when the fetch fails', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
      try {
        const settled = await settleWithin(TextureStore.load('http://example.test/data.json'));
        expect(settled).toBeInstanceOf(Error);
      } finally {
        fetchMock.mockRestore();
      }
    });

    test('rejects when the response is not json', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not-json'));
      try {
        const settled = await settleWithin(TextureStore.load('http://example.test/data.json'));
        expect(settled).toBeInstanceOf(Error);
      } finally {
        fetchMock.mockRestore();
      }
    });
  });

  describe('item texture classes beat the store defaults', () => {
    test('the item filter class wins over the store default', async () => {
      const store = new TextureStore();
      store.defaultTextureClasses = ['nearest'];
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png', texture: ['linear']}}});

      const resource = await store.whenResource('a');

      expect(resource.textureClasses).toEqual(['nearest', 'linear']);
      expect(new TextureFactory(makeRendererStub(), []).getOptions(resource.textureClasses!).magFilter).toBe(LinearFilter);
    });

    test('the item flipY class wins over the store default', async () => {
      const store = new TextureStore();
      store.defaultTextureClasses = ['no-flipy'];
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png', texture: ['flipy']}}});

      const resource = await store.whenResource('a');

      expect(resource.textureClasses).toEqual(['no-flipy', 'flipy']);
      expect(new TextureFactory(makeRendererStub(), []).getOptions(resource.textureClasses!).flipY).toBe(true);
    });
  });

  describe('unsubscribe() leaves the retained ready value alone', () => {
    test('the store still carries a retained ready event', () => {
      const store = new TextureStore();
      const unsubscribe = store.on('a', 'texture', () => {});
      store.parse({defaultTextureClasses: [], items: {}});

      unsubscribe();

      expect(getRetainedEventNames(store)).toContain(TextureStoreEvents.Ready);
    });

    test('a whenReady() asked afterwards is answered', async () => {
      const store = new TextureStore();
      const unsubscribe = store.on('a', 'texture', () => {});
      store.parse({defaultTextureClasses: [], items: {}});

      unsubscribe();

      const settled = await settleWithin(store.whenReady().then(() => 'ready' as const));
      expect(settled).toBe('ready');
    });
  });

  describe('on() delivers each value once, whenever it subscribed', () => {
    const stubImage = () => ({width: 4, height: 4}) as unknown as HTMLImageElement;
    const data: TextureStoreData = {defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}};

    // a subscription that finds its resource missing at the first ready listens for it on
    // the store for good, and every parse() that names the resource announces it there again

    test('a subscription made before the parse() that brings its resource is not called again by a later parse() that brings the same resource', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      const callback = vi.fn();
      store.on('a', 'texture', callback);
      store.parse({defaultTextureClasses: [], items: {other: {imageUrl: 'other.png'}}});

      store.parse(data);
      await flushMicrotasks();

      expect(callback).toHaveBeenCalledTimes(1);

      store.parse(data);
      await flushMicrotasks();

      expect(callback).toHaveBeenCalledTimes(1);
      expect((await store.whenResource('a')).refCount).toBe(1);

      store.dispose();
    });

    test('a tuple subscription made before the parse() that brings its resource is not called again by a later parse() that brings the same resource', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      const callback = vi.fn();
      store.on('a', ['texture', 'imageCoords'], callback);
      store.parse({defaultTextureClasses: [], items: {other: {imageUrl: 'other.png'}}});

      store.parse(data);
      await flushMicrotasks();

      expect(callback).toHaveBeenCalledTimes(1);

      store.parse(data);
      await flushMicrotasks();

      expect(callback).toHaveBeenCalledTimes(1);
      expect((await store.whenResource('a')).refCount).toBe(1);

      store.dispose();
    });
  });

  describe('a resource of the store keeps its count and its image source to the store', () => {
    test('refCount is read-only', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});
      const unsubscribe = store.on('a', 'texture', () => {});
      const resource = await store.whenResource('a');

      const write = () => {
        (resource as unknown as {refCount: number}).refCount = 0;
      };

      expect(write).toThrow(TypeError);
      expect(write).toThrow(/refCount/);
      expect(resource.refCount).toBe(1);

      unsubscribe();
      store.dispose();
    });

    test('a resource the store has handed out has no imageLoader', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});
      const unsubscribe = store.on('a', 'texture', () => {});
      const resource = await store.whenResource('a');

      expect('imageLoader' in resource).toBe(false);

      unsubscribe();
      store.dispose();
    });
  });

  describe('get() gives up on a resource that cannot deliver', () => {
    const stubImage = () => ({width: 4, height: 4}) as unknown as HTMLImageElement;

    // what settleWithin() answered with, as a message: a rejection gives its text, and a
    // promise still waiting gives 'pending', which a failed expectation then shows as such
    const messageOf = (settled: unknown) => (settled instanceof Error ? settled.message : settled);

    const imageFailed = '[TextureStore] get(a, texture) failed at the image step: "a.png"';

    test('get() rejects when the image does not load', async () => {
      const loaderError = new Error('404');
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockRejectedValue(loaderError);

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      const settled = await settleWithin(store.get('a', 'texture'));

      expect(messageOf(settled)).toBe(imageFailed);
      expect((settled as Error).cause).toBe(loaderError);

      store.dispose();
    });

    test('get() rejects when the atlas json cannot be fetched', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', {status: 404}));

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {atlasUrl: 'atlas.json'}}});

      const settled = await settleWithin(store.get('a', 'texture'));

      expect(messageOf(settled)).toBe('[TextureStore] get(a, texture) failed at the atlas step: "atlas.json"');

      store.dispose();
    });

    test('a get() after an atlasJson written over a failed fetch waits for the atlas', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', {status: 404}));
      let resolveImage!: (image: HTMLImageElement) => void;
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        () =>
          new Promise<HTMLImageElement>((resolve) => {
            resolveImage = resolve;
          }),
      );

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {atlasUrl: 'atlas.json'}}});
      const resource = await store.whenResource('a');

      const failed = await settleWithin(store.get('a', 'texture'));
      expect(messageOf(failed)).toBe('[TextureStore] get(a, texture) failed at the atlas step: "atlas.json"');

      // the json written from outside takes the place of the one that could not be fetched,
      // and the image it names is still on its way when the get() below asks
      resource.atlasJson = {
        frames: {f0: {frame: {x: 0, y: 0, w: 10, h: 10}}},
        meta: {image: 'a.png', size: {w: 100, h: 50}},
      } as never;
      const atlas = store.get('a', 'atlas');

      resolveImage({width: 100, height: 50} as unknown as HTMLImageElement);
      const settled = await settleWithin(atlas);

      expect(messageOf(settled)).toBe(resource.atlas);
      expect(settled).toBeDefined();

      store.dispose();
    });

    test('a get() after an atlasJson written over a fetch still in flight is not rejected when that fetch fails', async () => {
      // pays no heed to its signal: the 404 below reaches the resource even after an abort
      let answer!: (response: Response) => void;
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      );
      let resolveImage!: (image: HTMLImageElement) => void;
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(
        () =>
          new Promise<HTMLImageElement>((resolve) => {
            resolveImage = resolve;
          }),
      );

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {atlasUrl: 'atlas.json'}}});
      // subscribing loads the resource, and that sends the fetch off
      const atlas = store.get('a', 'atlas');
      const resource = await store.whenResource('a');

      resource.atlasJson = {
        frames: {f0: {frame: {x: 0, y: 0, w: 10, h: 10}}},
        meta: {image: 'a.png', size: {w: 100, h: 50}},
      } as never;
      answer(new Response('{}', {status: 404}));
      await flushMicrotasks();

      resolveImage({width: 100, height: 50} as unknown as HTMLImageElement);
      const settled = await settleWithin(atlas);

      expect(messageOf(settled)).toBe(resource.atlas);
      expect(settled).toBeDefined();

      store.dispose();
    });

    test('a subscriber that throws holds no get() back', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      store.on('a', 'texture', () => {
        throw new Error('a subscriber that throws');
      });
      const pending = store.get('a', 'texture');
      await flushMicrotasks();
      const late = store.get('a', 'texture');

      const texture = (await store.whenResource('a')).texture;

      expect(await settleWithin(pending)).toBe(texture);
      expect(await settleWithin(late)).toBe(texture);
      expect(texture).toBeDefined();

      store.dispose();
    });

    test('a get() asked after the image failed rejects as well', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockRejectedValue(new Error('404'));

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      const first = await settleWithin(store.get('a', 'texture'));
      const second = await settleWithin(store.get('a', 'texture'));

      expect(messageOf(first)).toBe(imageFailed);
      expect(messageOf(second)).toBe(imageFailed);

      store.dispose();
    });

    test('a get() for the texture of a tile set whose options TileSet refuses resolves', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {t: {imageUrl: 't.png', tileSet: {tileWidth: 0, tileHeight: 8}}}});

      const settled = await settleWithin(store.get('t', 'texture'));

      expect(settled).toBe((await store.whenResource('t')).texture);
      expect(settled).toBeDefined();

      store.dispose();
    });

    test('a get() for the tileSet of such a resource rejects at the texture step', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {t: {imageUrl: 't.png', tileSet: {tileWidth: 0, tileHeight: 8}}}});

      const settled = await settleWithin(store.get('t', 'tileSet'));

      expect(messageOf(settled)).toBe('[TextureStore] get(t, tileSet) failed at the texture step');

      store.dispose();
    });

    test('a skipped animation entry does not reject get()', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({
        defaultTextureClasses: [],
        items: {
          t: {
            imageUrl: 't.png',
            tileSet: {tileWidth: 2, tileHeight: 2},
            frameBasedAnimations: {
              walk: {duration: 1, firstTileId: 1, tileCount: 2},
              // neither a duration nor a frameRate: the entry is skipped and reported while
              // the animations the get() below waits for are still being built
              run: {firstTileId: 1, tileCount: 2} as never,
            },
          },
        },
      });
      const resource = await store.whenResource('t');
      const errors: unknown[] = [];
      on(resource, TextureResourceEvents.Error, (payload: unknown) => errors.push(payload));

      const settled = await settleWithin(store.get('t', 'frameBasedAnimations'));

      expect(errors).toMatchObject([{source: 'frameBasedAnimations', animation: 'run'}]);
      expect(settled).toBe(resource.frameBasedAnimations);
      expect(resource.frameBasedAnimations?.animId('walk')).toBeDefined();

      store.dispose();
    });

    test('a get() after a new image url waits for that image', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync')
        .mockImplementationOnce(async () => {
          throw new Error('404');
        })
        .mockImplementation(async () => stubImage());

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

      const failed = await settleWithin(store.get('a', 'texture'));
      expect(messageOf(failed)).toBe(imageFailed);

      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'b.png'}}});

      const settled = await settleWithin(store.get('a', 'texture'));

      expect(settled).toBe((await store.whenResource('a')).texture);
      expect(settled).toBeDefined();

      store.dispose();
    });

    test('a get() rejected by a failure leaves no listener behind', async () => {
      vi.spyOn(ImageLoader.prototype, 'loadAsync').mockRejectedValue(new Error('404'));

      const store = new TextureStore(makeRendererStub());
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});
      const resource = await store.whenResource('a');

      const storeBase = getSubscriptionCount(store);
      const resourceBase = getSubscriptionCount(resource);

      const settled = await settleWithin(store.get('a', 'texture'));

      expect(messageOf(settled)).toBe(imageFailed);
      expect(getSubscriptionCount(store)).toBe(storeBase);
      expect(getSubscriptionCount(resource)).toBe(resourceBase);

      store.dispose();
    });
  });

  describe('parse() checks catalog data before it writes anything', () => {
    type ParseError = {source: string; id?: string; error: Error};

    const collectErrors = (store: TextureStore) => {
      const errors: ParseError[] = [];
      on(store, 'error', (payload: ParseError) => {
        errors.push(payload);
      });
      return errors;
    };

    test.each([
      ['without items', {defaultTextureClasses: []}, 'undefined'],
      ['whose items is null', {items: null}, 'null'],
      ['whose items is an array', {items: []}, 'an array'],
    ])('data %s throws a TypeError naming what items is', (_name, data, described) => {
      const store = new TextureStore();

      expect(() => store.parse(data as never)).toThrow(TypeError);
      expect(() => store.parse(data as never)).toThrow(
        `[TextureStore] parse() got texture store data whose items is ${described} — items is an object of resource items by id`,
      );
    });

    test('data that is no object throws a TypeError naming what it is', () => {
      const store = new TextureStore();

      expect(() => store.parse(null as never)).toThrow(TypeError);
      expect(() => store.parse(null as never)).toThrow(
        '[TextureStore] parse() got null instead of texture store data, an object with an items object',
      );
    });

    test('a defaultTextureClasses that is no array throws, and neither a resource nor the defaults nor an event has changed', async () => {
      const store = new TextureStore();
      store.parse({defaultTextureClasses: ['nearest'], items: {a: {imageUrl: 'a.png'}}});
      const a = await store.whenResource('a');

      const errors = collectErrors(store);
      let readyCount = 0;
      on(store, 'ready', () => {
        readyCount++;
      });
      // the ready event is retained, so subscribing replays the parse that has already run
      readyCount = 0;

      const data = {defaultTextureClasses: 'linear', items: {a: {imageUrl: 'a2.png'}, b: {imageUrl: 'b.png'}}};
      expect(() => store.parse(data as never)).toThrow(TypeError);
      expect(() => store.parse(data as never)).toThrow(
        '[TextureStore] parse() got texture store data whose defaultTextureClasses is "linear" — defaultTextureClasses is an array of texture class names',
      );

      expect(a.imageUrl).toBe('a.png');
      expect(store.defaultTextureClasses).toEqual(['nearest']);
      expect(await settleWithin(store.whenResource('b'))).toBeInstanceOf(Error);
      expect(errors).toHaveLength(0);
      expect(readyCount).toBe(0);
    });

    test('an item that is no object builds no resource and goes out as a parse error, the other items are built', async () => {
      const store = new TextureStore();
      const errors = collectErrors(store);

      store.parse({items: {a: null, b: {imageUrl: 'b.png'}}} as never);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'parse', id: 'a'});
      expect(errors[0]!.error.message).toBe('[TextureStore] item "a" builds no resource: it is null, not an object');
      expect(await settleWithin(store.whenResource('a'))).toBeInstanceOf(Error);
      expect((await store.whenResource('b')).imageUrl).toBe('b.png');
    });

    test.each([
      ['an imageUrl of 5', {imageUrl: 5}, 'imageUrl is 5, not a string'],
      ['a tileSet of true', {tileSet: true}, 'tileSet is true, not an object'],
      ['a texture that is no array', {imageUrl: 'a.png', texture: 'srgb'}, 'texture is "srgb", not an array'],
      [
        'two fields of the wrong type',
        {imageUrl: 5, texture: 'srgb'},
        'imageUrl is 5, not a string; texture is "srgb", not an array',
      ],
    ])('an item with %s builds no resource and names what is wrong', async (_name, item, problems) => {
      const store = new TextureStore();
      const errors = collectErrors(store);

      store.parse({items: {a: item}} as never);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'parse', id: 'a'});
      expect(errors[0]!.error.message).toBe(`[TextureStore] item "a" builds no resource: ${problems}`);
      expect(await settleWithin(store.whenResource('a'))).toBeInstanceOf(Error);
    });

    test('a malformed item leaves the resource that already carries its id as it was', async () => {
      const store = new TextureStore();
      store.parse({items: {a: {imageUrl: 'a.png'}}});
      const a = await store.whenResource('a');
      const errors = collectErrors(store);

      store.parse({items: {a: {imageUrl: 5}}} as never, {evictMissing: true});

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'parse', id: 'a'});
      expect(a.imageUrl).toBe('a.png');
      expect(await store.whenResource('a')).toBe(a);
    });

    test('a type conflict still throws before any parse error of a malformed item goes out', async () => {
      const store = new TextureStore();
      store.parse({items: {a: {imageUrl: 'a.png'}}});
      await store.whenResource('a');
      const errors = collectErrors(store);

      expect(() => store.parse({items: {a: {tileSet: {tileWidth: 8, tileHeight: 8}}, b: {imageUrl: 5}}} as never)).toThrow(
        '[TextureStore] parse() found 1 item(s) of a conflicting type: "a" is a "image" resource and cannot become "tileset"',
      );

      expect(errors).toHaveLength(0);
    });

    test('a texture class no TextureFactory knows is left out and reported with the item id', async () => {
      const store = new TextureStore();
      const errors = collectErrors(store);

      store.parse({items: {a: {imageUrl: 'a.png', texture: ['nearset', 'srgb']}}} as never);

      expect((await store.whenResource('a')).textureClasses).toEqual(['srgb']);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({source: 'parse', id: 'a'});
      expect(errors[0]!.error.message).toBe(
        '[TextureStore] item "a" names "nearset" in texture, which no TextureFactory knows — left out',
      );
    });

    test('a default texture class no TextureFactory knows is left out and reported', () => {
      const store = new TextureStore();
      const errors = collectErrors(store);

      store.parse({defaultTextureClasses: ['nearset', 'linear'], items: {}} as never);

      expect(store.defaultTextureClasses).toEqual(['linear']);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.source).toBe('parse');
      expect(errors[0]).not.toHaveProperty('id');
      expect(errors[0]!.error.message).toBe(
        '[TextureStore] defaultTextureClasses names "nearset", which no TextureFactory knows — left out',
      );

      // a list that holds nothing but unknown names leaves the defaults standing
      store.parse({defaultTextureClasses: ['nearset'], items: {}} as never);

      expect(store.defaultTextureClasses).toEqual(['linear']);
      expect(errors).toHaveLength(2);
    });

    test('TextureStore.load() rejects a catalog that names an unknown texture class, naming the parse step', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({items: {a: {imageUrl: 'a.png', texture: ['nearset']}}})),
      );

      const settled = await settleWithin(TextureStore.load('http://example.test/data.json'));

      expect(settled).toBeInstanceOf(Error);
      expect((settled as Error).message).toBe('[TextureStore] load failed at the parse step: "a"');
    });
  });

  describe('load() resolves the relative urls of a catalog against the catalog', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const answerWithCatalog = (items: TextureStoreData['items']) =>
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({items})));

    test('a relative imageUrl, atlasUrl and overrideImageUrl name the files next to the catalog', async () => {
      answerWithCatalog({a: {imageUrl: 'a.png'}, b: {atlasUrl: 'atlas/b.json', overrideImageUrl: '../img/b.png'}});
      const store = new TextureStore();

      await store.load('http://example.test/assets/catalog.json');

      const a = await store.whenResource('a');
      const b = await store.whenResource('b');
      expect(a.imageUrl).toBe('http://example.test/assets/a.png');
      expect(b.atlasUrl).toBe('http://example.test/assets/atlas/b.json');
      expect(b.overrideImageUrl).toBe('http://example.test/img/b.png');
    });

    test('an absolute item url stays exactly as written', async () => {
      answerWithCatalog({a: {imageUrl: 'HTTP://Other.test/A%20b.png'}});
      const store = new TextureStore();

      await store.load('http://example.test/assets/catalog.json');

      expect((await store.whenResource('a')).imageUrl).toBe('HTTP://Other.test/A%20b.png');
    });

    test('a relative catalog url is resolved against the document first', async () => {
      vi.stubGlobal('document', {baseURI: 'http://example.test/demo/page.html'});
      answerWithCatalog({a: {imageUrl: 'a.png'}});
      const store = new TextureStore();

      await store.load('assets/catalog.json');

      expect((await store.whenResource('a')).imageUrl).toBe('http://example.test/demo/assets/a.png');
    });

    test('a catalog behind a blob: url leaves relative item urls as written', async () => {
      answerWithCatalog({a: {imageUrl: 'a.png'}});
      const store = new TextureStore();

      await store.load('blob:http://example.test/0b1c2d3e');

      expect((await store.whenResource('a')).imageUrl).toBe('a.png');
    });

    test('parse() resolves against a baseUrl it is given, and writes the urls as they are without one', async () => {
      const withBase = new TextureStore();
      withBase.parse({items: {a: {imageUrl: 'a.png'}}}, {baseUrl: 'http://example.test/assets/catalog.json'});
      expect((await withBase.whenResource('a')).imageUrl).toBe('http://example.test/assets/a.png');

      const withoutBase = new TextureStore();
      withoutBase.parse({items: {a: {imageUrl: 'a.png'}}});
      expect((await withoutBase.whenResource('a')).imageUrl).toBe('a.png');
    });
  });
});
