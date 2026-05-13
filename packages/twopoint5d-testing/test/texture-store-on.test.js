import {expect} from '@esm-bundle/chai';
import {
  FrameBasedAnimations,
  TextureAtlas,
  TextureCoords,
  TextureResourceSubtypes,
  TextureStore,
  TileSet,
} from '@spearwolf/twopoint5d';
import {Texture} from 'three/webgpu';

// Real assets shipped with the lookbook app — reachable because
// web-test-runner is configured with rootDir at the monorepo root.
const ASSET_BASE = '/apps/lookbook/public/assets';
const IMG_URL = `${ASSET_BASE}/skinball-256.png`;
const TILES_URL = `${ASSET_BASE}/nobinger-anim-sheet.png`;
const BALL_ATLAS_URL = `${ASSET_BASE}/ball-patterns.json`;
const BALL_ATLAS_IMG = `${ASSET_BASE}/ball-patterns.png`;
const FIRE_ATLAS_URL = `${ASSET_BASE}/fire-particles.json`;
const FIRE_ATLAS_IMG = `${ASSET_BASE}/fire-particles.png`;

// Black-box stub renderer — TextureFactory only consults `getMaxAnisotropy()`.
// No GPU upload is required because `on()` resolves before any rendering.
const stubRenderer = /** @type {any} */ ({getMaxAnisotropy: () => 16});

/** Serve a TextureStoreData object via a transient Blob URL. */
function makeCatalogUrl(data) {
  const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
  return URL.createObjectURL(blob);
}

/** Resolve when `cb` returns a truthy value or the deadline elapses. */
function waitUntil(cb, {timeout = 4000, interval = 10} = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const tick = () => {
      let val;
      try {
        val = cb();
      } catch (err) {
        reject(err);
        return;
      }
      if (val) return resolve(val);
      if (performance.now() - start >= timeout) {
        return reject(new Error(`waitUntil: timed out after ${timeout}ms`));
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

const CATALOG = {
  defaultTextureClasses: ['nearest', 'no-flipy'],
  items: {
    plain: {
      imageUrl: IMG_URL,
    },
    sheet: {
      imageUrl: TILES_URL,
      tileSet: {tileWidth: 64, tileHeight: 64, margin: 1},
      frameBasedAnimations: {
        anim0: {frameRate: 12, tileIds: [1, 2, 3, 4, 5, 4, 3, 2]},
      },
    },
    balls: {
      atlasUrl: BALL_ATLAS_URL,
      overrideImageUrl: BALL_ATLAS_IMG,
    },
    fire: {
      atlasUrl: FIRE_ATLAS_URL,
      overrideImageUrl: FIRE_ATLAS_IMG,
      frameBasedAnimations: {
        flames: {duration: 0.5, frameNameQuery: '^fire\\d+$'},
      },
    },
  },
};

describe('TextureStore.on() — black-box workflow', function () {
  // image+atlas loading over HTTP can take a moment in Firefox
  this.timeout(15000);

  /** @type {TextureStore | undefined} */
  let store;
  /** @type {string | undefined} */
  let catalogUrl;

  beforeEach(() => {
    store = new TextureStore(stubRenderer);
    catalogUrl = makeCatalogUrl(CATALOG);
  });

  afterEach(() => {
    try {
      store?.dispose();
    } catch {
      // ignore
    }
    if (catalogUrl) URL.revokeObjectURL(catalogUrl);
    catalogUrl = undefined;
    store = undefined;
  });

  describe('plain image resource', () => {
    it('on(id, "imageCoords") delivers TextureCoords after load', async () => {
      let received;
      const unsubscribe = store.on('plain', 'imageCoords', (coords) => {
        received = coords;
      });
      expect(unsubscribe).to.be.a('function');

      store.load(catalogUrl);

      const coords = await waitUntil(() => received);
      expect(coords).to.be.instanceOf(TextureCoords);
      expect(coords.width).to.be.greaterThan(0);
      expect(coords.height).to.be.greaterThan(0);
      expect(coords.x).to.equal(0);
      expect(coords.y).to.equal(0);

      unsubscribe();
    });

    it('on(id, "texture") delivers a Texture after load', async () => {
      let received;
      const unsubscribe = store.on('plain', 'texture', (texture) => {
        received = texture;
      });
      store.load(catalogUrl);

      const texture = await waitUntil(() => received);
      expect(texture).to.be.instanceOf(Texture);
      expect(texture.name).to.equal('plain');
      expect(texture.image).to.exist;
      unsubscribe();
    });

    it('on(id, ["texture", "imageCoords"]) delivers a tuple in the requested order, once', async () => {
      let calls = 0;
      let tuple;
      const unsubscribe = store.on('plain', ['texture', 'imageCoords'], (values) => {
        calls++;
        tuple = values;
      });

      store.load(catalogUrl);

      await waitUntil(() => tuple);
      expect(tuple).to.be.an('array').with.length(2);
      const [texture, coords] = tuple;
      expect(texture).to.be.instanceOf(Texture);
      expect(coords).to.be.instanceOf(TextureCoords);
      expect(calls).to.equal(1, 'tuple callback should fire only after all values arrive');

      unsubscribe();
    });

    it('late subscriber (after load+ready) is still notified thanks to retained events', async () => {
      store.load(catalogUrl);

      // wait until the underlying resource has finished loading via a primary subscription
      let primaryTexture;
      const unsubPrimary = store.on('plain', 'texture', (t) => {
        primaryTexture = t;
      });
      await waitUntil(() => primaryTexture);

      let lateTexture;
      const unsubLate = store.on('plain', 'texture', (t) => {
        lateTexture = t;
      });
      await waitUntil(() => lateTexture);
      expect(lateTexture).to.equal(primaryTexture);

      unsubPrimary();
      unsubLate();
    });

    it('unsubscribe() stops further callbacks and is idempotent', async () => {
      let calls = 0;
      const unsubscribe = store.on('plain', 'texture', () => {
        calls++;
      });
      store.load(catalogUrl);

      await waitUntil(() => calls > 0);
      const callsAfterFirst = calls;

      unsubscribe();
      unsubscribe(); // idempotent — no throw

      // Trigger more emissions by re-parsing the resource (same type)
      store.parse({
        defaultTextureClasses: [],
        items: {plain: {imageUrl: IMG_URL}},
      });
      // give the system a tick to settle
      await new Promise((r) => setTimeout(r, 50));

      expect(calls).to.equal(callsAfterFirst, 'no callbacks after unsubscribe()');
    });

    it('multiple independent subscribers each receive the same value', async () => {
      const received = [];
      const u1 = store.on('plain', 'texture', (t) => received.push(['a', t]));
      const u2 = store.on('plain', 'texture', (t) => received.push(['b', t]));

      store.load(catalogUrl);
      await waitUntil(() => received.length >= 2);

      const byTag = new Map(received);
      expect(byTag.has('a')).to.equal(true);
      expect(byTag.has('b')).to.equal(true);
      expect(byTag.get('a')).to.equal(byTag.get('b'));

      u1();
      u2();
    });
  });

  describe('tileset resource', () => {
    it('on(id, "tileSet") delivers a TileSet derived from imageCoords + options', async () => {
      let tileSet;
      const unsub = store.on('sheet', 'tileSet', (ts) => {
        tileSet = ts;
      });

      store.load(catalogUrl);

      const ts = await waitUntil(() => tileSet);
      expect(ts).to.be.instanceOf(TileSet);
      expect(ts.tileWidth).to.equal(64);
      expect(ts.tileHeight).to.equal(64);
      expect(ts.tileCount).to.be.greaterThan(0);

      unsub();
    });

    it('on(id, "atlas") on a tileset resource yields the tileset\'s atlas', async () => {
      let atlas;
      const unsub = store.on('sheet', 'atlas', (a) => {
        atlas = a;
      });

      store.load(catalogUrl);

      const a = await waitUntil(() => atlas);
      expect(a).to.be.instanceOf(TextureAtlas);
      expect(a.size).to.be.greaterThan(0);
      unsub();
    });

    it('on(id, "frameBasedAnimations") delivers a FrameBasedAnimations with the catalog animations', async () => {
      let fba;
      const unsub = store.on('sheet', 'frameBasedAnimations', (anims) => {
        fba = anims;
      });

      store.load(catalogUrl);

      const anims = await waitUntil(() => fba);
      expect(anims).to.be.instanceOf(FrameBasedAnimations);
      const id = anims.animId('anim0');
      expect(id).to.be.a('number').and.greaterThanOrEqual(0);
      unsub();
    });

    it('tuple ["texture", "tileSet", "frameBasedAnimations"] fires once with all three values', async () => {
      let calls = 0;
      let payload;
      const unsub = store.on('sheet', ['texture', 'tileSet', 'frameBasedAnimations'], (values) => {
        calls++;
        payload = values;
      });

      store.load(catalogUrl);

      await waitUntil(() => payload);
      const [texture, tileSet, fba] = payload;
      expect(texture).to.be.instanceOf(Texture);
      expect(tileSet).to.be.instanceOf(TileSet);
      expect(fba).to.be.instanceOf(FrameBasedAnimations);
      expect(calls).to.equal(1, 'tuple callback fires once when all subtypes have arrived');

      unsub();
    });
  });

  describe('atlas resource (atlasUrl)', () => {
    it('on(id, "atlas") delivers a TextureAtlas with the expected frame names', async () => {
      let atlas;
      const unsub = store.on('balls', 'atlas', (a) => {
        atlas = a;
      });

      store.load(catalogUrl);

      const a = await waitUntil(() => atlas);
      expect(a).to.be.instanceOf(TextureAtlas);
      const names = a.frameNames();
      expect(names).to.include.members([
        'ball-pattern-blau',
        'ball-pattern-dunkelrot',
        'ball-pattern-pink',
        'ball-pattern-rot',
      ]);

      unsub();
    });

    it('on(id, "texture") on an atlas resource delivers a Texture once the override image is loaded', async () => {
      let texture;
      const unsub = store.on('balls', 'texture', (t) => {
        texture = t;
      });

      store.load(catalogUrl);

      const tex = await waitUntil(() => texture);
      expect(tex).to.be.instanceOf(Texture);
      expect(tex.name).to.equal('balls');
      unsub();
    });

    it('on(id, "frameBasedAnimations") (frameNameQuery) delivers atlas-based animations', async () => {
      let fba;
      const unsub = store.on('fire', 'frameBasedAnimations', (anims) => {
        fba = anims;
      });

      store.load(catalogUrl);

      const anims = await waitUntil(() => fba);
      expect(anims).to.be.instanceOf(FrameBasedAnimations);
      const id = anims.animId('flames');
      expect(id).to.be.a('number').and.greaterThanOrEqual(0);

      unsub();
    });

    it('tuple ["texture", "atlas"] fires once with both values', async () => {
      let calls = 0;
      let payload;
      const unsub = store.on('balls', ['texture', 'atlas'], (values) => {
        calls++;
        payload = values;
      });

      store.load(catalogUrl);

      await waitUntil(() => payload);
      const [texture, atlas] = payload;
      expect(texture).to.be.instanceOf(Texture);
      expect(atlas).to.be.instanceOf(TextureAtlas);
      expect(calls).to.equal(1);

      unsub();
    });
  });

  describe('subscription bookkeeping', () => {
    it('on() bumps refCount; unsubscribe() decrements it; clearUnused() removes idle resources', async () => {
      // subscribe to 'plain' only — leave the other items idle
      const unsub = store.on('plain', 'texture', () => {});
      store.load(catalogUrl);

      // wait until all four resources are present
      const resourceById = {};
      const collect = (id) => {
        store.onResource(id, (r) => {
          resourceById[id] = r;
        });
      };
      ['plain', 'sheet', 'balls', 'fire'].forEach(collect);

      await waitUntil(() => Object.keys(resourceById).length === 4);

      expect(resourceById.plain.refCount).to.equal(1, 'plain bumped by on() subscription');
      expect(resourceById.sheet.refCount).to.equal(0);
      expect(resourceById.balls.refCount).to.equal(0);
      expect(resourceById.fire.refCount).to.equal(0);

      const removed = store.clearUnused();
      expect(removed).to.equal(3, 'sheet/balls/fire are unused and should be cleared');

      unsub();
      // After unsubscribe, the previously-pinned resource is also idle and can be cleared.
      const removedAfterUnsub = store.clearUnused();
      expect(removedAfterUnsub).to.equal(1);
    });

    it('accepts the TextureResourceSubtypes constants interchangeably with string literals', async () => {
      let viaLiteral;
      let viaConst;
      const u1 = store.on('plain', 'texture', (t) => {
        viaLiteral = t;
      });
      const u2 = store.on('plain', TextureResourceSubtypes.Texture, (t) => {
        viaConst = t;
      });

      store.load(catalogUrl);
      await waitUntil(() => viaLiteral && viaConst);
      expect(viaConst).to.equal(viaLiteral);

      u1();
      u2();
    });
  });

  describe('order independence: subscribe before vs. after parse()', () => {
    it('subscriber attached before parse() receives the value', async () => {
      let received;
      const unsub = store.on('plain', 'texture', (t) => {
        received = t;
      });
      // synchronous parse — no fetch involved
      store.parse({
        defaultTextureClasses: [],
        items: {plain: {imageUrl: IMG_URL}},
      });
      const tex = await waitUntil(() => received);
      expect(tex).to.be.instanceOf(Texture);
      unsub();
    });

    it('subscriber attached after parse() also receives the value', async () => {
      store.parse({
        defaultTextureClasses: [],
        items: {plain: {imageUrl: IMG_URL}},
      });
      let received;
      const unsub = store.on('plain', 'texture', (t) => {
        received = t;
      });
      const tex = await waitUntil(() => received);
      expect(tex).to.be.instanceOf(Texture);
      unsub();
    });
  });
});
