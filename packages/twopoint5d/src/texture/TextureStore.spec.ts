import {emit, getRetainedEventNames, getSubscriptionCount, on} from '@spearwolf/eventize';
import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {ImageLoader, LinearFilter, type WebGPURenderer} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';
import {TextureResource, TextureResourceEvents, TextureResourceSubtypes} from './TextureResource.js';
import {TextureFactory} from './TextureFactory.js';
import {TextureStore, TextureStoreEvents} from './TextureStore.js';
import type {TextureStoreData} from './types.js';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// the factory asks a renderer for exactly one thing, so a stub that answers it is a renderer enough
const rendererStub = {getMaxAnisotropy: () => 16} as unknown as WebGPURenderer;

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
      const renderer = {getMaxAnisotropy: () => 16, dispose: rendererDispose};

      const store = new TextureStore(renderer as never);
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
      // the store never reads the renderer it is given; it only has to be something
      const store = new TextureStore({backend: {}} as never);

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
        const store = new TextureStore({backend: {}} as never);
        store.defaultTextureClasses = ['nearest'];

        store.dispose();

        expect(store.renderer).toBeUndefined();
        expect(store.textureFactory).toBeUndefined();

        expect(() => {
          store.renderer = {backend: {}} as never;
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
      // no image loader runs here, so `p` is still pending when the store goes away
      store.dispose();
      await expect(p).rejects.toThrow(/this store has been disposed/);
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
      ).toThrow();

      expect(a.imageUrl).toBe('a.png');
      expect(readyCount).toBe(0);
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

  describe('TextureResource.load() image race', () => {
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

  describe('an image is fetched once for every resource that names it', () => {
    const stubImage = () => ({width: 4, height: 4}) as unknown as HTMLImageElement;

    test('two resources that name the same image share one fetch and keep their own texture', async () => {
      const loadSpy = vi.spyOn(ImageLoader.prototype, 'loadAsync').mockImplementation(async () => stubImage());

      const store = new TextureStore(rendererStub);
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

      const store = new TextureStore(rendererStub);
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'shared.png'}, b: {imageUrl: 'shared.png'}}});

      const unsubscribeA = store.on('a', 'texture', () => {});
      const unsubscribeB = store.on('b', 'texture', () => {});
      await flushMicrotasks();

      expect(loadSpy).toHaveBeenCalledTimes(1);

      unsubscribeA();
      unsubscribeB();
      expect(store.clearUnused()).toBe(2);

      store.parse({defaultTextureClasses: [], items: {c: {imageUrl: 'shared.png'}}});
      store.on('c', 'texture', () => {});
      await flushMicrotasks();

      expect(loadSpy).toHaveBeenCalledTimes(2);

      store.dispose();
      loadSpy.mockRestore();
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
      expect(() => {
        resource.imageUrl = 'other.png';
      }).toThrow(TypeError);

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
      expect(new TextureFactory(rendererStub, []).getOptions(resource.textureClasses!).magFilter).toBe(LinearFilter);
    });

    test('the item flipY class wins over the store default', async () => {
      const store = new TextureStore();
      store.defaultTextureClasses = ['no-flipy'];
      store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png', texture: ['flipy']}}});

      const resource = await store.whenResource('a');

      expect(resource.textureClasses).toEqual(['no-flipy', 'flipy']);
      expect(new TextureFactory(rendererStub, []).getOptions(resource.textureClasses!).flipY).toBe(true);
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
