# Resource lifecycle: `dispose()` and ownership

Binding rules for every class in this package that has a `dispose()`, and for every new
one that gets one — geometries, materials, meshes, pools, renderers, stores, display.
A `dispose()` that breaks them is a bug, not a variation. Section 7 is the checklist,
section 8 the tests to ship with it.

## 1. Ownership

**`dispose()` releases what the instance created itself, and nothing else.**

A resource handed in — through the constructor, a setter or an attach method — belongs
to the caller: not disposed, not cleared, not modified. Handing a resource out does not
transfer it either; returning a pool from a getter keeps you the owner.

**A take-over counts only where the receiving side promises it in its own TSDoc** — at
the constructor parameter, at the field, at the method that accepts the resource. Two
exist today: [`Display`](../src/display/Display.ts) takes over the `WebGPURenderer` its
constructor receives, and [`Canvas2DStage`](../src/stage/Canvas2DStage.ts) takes over
every texture that lands in its `texture` field, assigned from outside or built
in-house. An undocumented take-over is a bug.

Reference implementation —
[`VOBufferGeometry`](../src/vertex-objects/VOBufferGeometry.ts) marks what it built and
asks the bookkeeping instead of guessing:

```ts
this.pool = source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity);
if (!(source instanceof VOBufferPool)) {
  this.declareOwnedPool(this.pool);
}
```

```ts
if (this.#ownedPools.has(this.pool)) {
  this.pool.dispose();
}
```

Do not add a take-over flag to a new API — the rule already answers the question. The
one that exists,
[`InstancedVOBufferGeometry#attachInstancedPool(name, pool, {autoDispose})`](../src/vertex-objects/InstancedVOBufferGeometry.ts),
defaults to exactly what the rule asks and lets a pool shared between several geometries
be attached without any of them claiming it. A sharing declaration, not a template.

**What was borrowed is given back, even though it was never owned.**

Slots taken from a pool and tiles taken from a factory are held, not owned, and nobody
else can reach them. Every acquiring call has a releasing counterpart, and `dispose()`
is the last place to honour the pairing: `createVO()` ↔ `freeVO()`,
[`IMapTileFactory.createTile()`](../src/map2d/types.ts) ↔ `destroyTile()`. Giving back
is not releasing — the pool or the factory stays the owner.
[`Map2DTileRenderer.dispose()`](../src/map2d/Map2DTileRenderer.ts) hands every tile back
before it lets the factory go, so a factory serving a second renderer gets the slots of
the first one back. Assertion (f) in section 8 tests it.

An instance that passes what it took straight out to its caller has nothing to give
back: `TexturedSprites#createSprite()` hands the sprite over, and whoever asked for it
calls `freeSprite()`.

## 2. Idempotence

**`dispose()` may be called any number of times** — the second call releases nothing
again and does not throw. Default shape, as in
[`VOBufferPool.dispose()`](../src/vertex-objects/VOBufferPool.ts):

```ts
dispose(): void {
  if (this.#disposed) return;
  this.#disposed = true;
  // …
}
```

Two other shapes are legitimate. Idempotent by construction, when every step runs empty
the second time anyway — a reference already given up, `removeFromParent()` with no
parent, `SignalGroup.delete()`, a repeated `set(undefined)`, `Material.dispose()` whose
own dispose event already unsubscribed the renderer. And guarded on the state the
method itself gives up, the way
[`Map2DTileRenderer.dispose()`](../src/map2d/Map2DTileRenderer.ts) returns early on
`tileFactory === null`. Neither is claimed, both are shown by assertion (d).

Where callers have to branch on the state, expose a read-only getter —
[`VOBufferPool`](../src/vertex-objects/VOBufferPool.ts) and
[`FixedFrameLoop`](../src/display/FixedFrameLoop.ts) do. Not boilerplate on every class.

```ts
get isDisposed(): boolean {
  return this.#disposed;
}
```

## 3. After `dispose()`

Every public member of a disposed instance behaves in one of exactly three ways, picked
by its declared type. Its TSDoc says which.

1. **Type admits absence → answer `undefined`.** `T | undefined` is a value the caller
   handles anyway. [`TexturedSprites#texture`](../src/sprites/TexturedSprites/TexturedSprites.ts).
2. **Type claims presence → throw.** For a declared `T`, do not hand back `undefined`
   and lie about the type. Throw an `Error` naming class and state, so the stack points
   at the real mistake. [`Display#canvas`](../src/display/Display.ts) raises
   `Display#canvas is not available: this display has been disposed`.
3. **Mutating method with nothing left to act on → silent no-op.**
   [`TexturedSprites#freeSprite()`](../src/sprites/TexturedSprites/TexturedSprites.ts)
   returns a sprite to a pool that is gone and does nothing. Invalid input is still
   turned away: [`VOBufferPool#fromBuffersData()`](../src/vertex-objects/VOBufferPool.ts)
   keeps rejecting a mismatched capacity.

This rules out the fourth reaction — a `TypeError` from deep inside the class because a
field quietly became `undefined`, where the caller learns nothing and the stack points at
the wrong line.

A pending promise does not survive either — anything a caller is still awaiting when
`dispose()` runs is rejected as part of it.

The rule points outwards too: a constructor or method handed an already-disposed instance
refuses it, with an error naming the call and the state. Otherwise it builds something
that looks alive and does nothing — a
[`VOBufferGeometry`](../src/vertex-objects/VOBufferGeometry.ts) over a disposed pool is a
geometry without attributes, and no frame says so until one comes out empty.

## 4. Signals, effects and events

Attach every signal and effect to the instance, so one call tears them all down — see
[`TexturedSpritesMaterial`](../src/sprites/TexturedSprites/TexturedSpritesMaterial.ts):

```ts
#colorMap = createSignal<Texture | undefined>(undefined, {attach: this});

createEffect(() => {
  // …
}, {attach: this});
```

```ts
override dispose() {
  // both references are given up while their signals are still live — a write after
  // SignalGroup.delete() would land in a destroyed signal and notify nobody
  this.#colorMap.set(undefined);
  this.#texCoordsNode.set(undefined);

  SignalGroup.delete(this);
  super.dispose();
}
```

`SignalGroup.delete(this)` is the entire teardown of the signal side. Never
`SignalGroup.destroy()` — deprecated in `@spearwolf/signalize`.

On the eventize side `off(this)` removes every listener, and a class others subscribe
to **emits its dispose event before** that call, or the event reaches nobody. See
[`Display.dispose()`](../src/display/Display.ts):

```ts
dispose(): void {
  if (this.#disposed) return;
  this.#disposed = true;

  this.stop();
  this.frameLoop.stop(this);
  // the listeners are still attached here: this event is what tells them to let go,
  // and off(this) below is what makes it the last event this display ever emits
  emit(this, OnDisplayDispose, this);
  off(this);
  this.renderer?.dispose();
  delete this.renderer;
}
```

**Order rule:** release your own resources **before** tearing down the signal group. A
resource reachable only through a signal is unreachable once that signal is destroyed,
and releasing it afterwards works only as long as a destroyed signal still hands out its
last value. Do not depend on that.

## 5. three.js interop

A class extending `Material`, `BufferGeometry` or `Mesh` overrides `dispose()` and calls
`super.dispose()`. Where in the method depends on what the base class does.

**First — when `super` only announces.** `THREE.BufferGeometry.dispose()` emits its
dispose event and the renderer reads the attributes one last time while handling it, so
the call goes out while every slot is still filled.
[`VOBufferGeometry.dispose()`](../src/vertex-objects/VOBufferGeometry.ts):

```ts
override dispose(): void {
  // the renderer reads the attributes of this geometry once more while it handles the
  // dispose event, and reaches for the id of a slot before it checks that the slot is
  // filled — so the event goes out while every slot is still there
  super.dispose();

  this.#attachments.detachAll();
  // … release the attribute slots, the index and the owned pools
}
```

**Last — when `super` already tears down.** A material base class that calls
`SignalGroup.delete(this)` destroys the signals an owned resource hangs from:

```ts
override dispose(): void {
  // the signal this resource hangs from is gone once super.dispose() has run, so it is
  // released here, while the value is still reachable
  this.#ownedThing?.dispose();
  super.dispose();
}
```

[`AnimatedSpritesMaterial.dispose()`](../src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts)
is ordered this way to clear its `animsMap` reference — a caller-owned texture, so not
released — while the signal holding it is still live.

The one rule behind both: **release nothing whose access path the `super` call has
already cut, and take away nothing the `super` call is still going to read.**

A `Mesh` that gives up its geometry or material calls `removeFromParent()` first, owned
or not, rather than demanding the right order from the caller — a mesh with an empty
geometry slot cannot be rendered, and the next frame would fail inside the renderer.

## 6. Checklist for a new `dispose()`

1. Release every resource this instance created itself, give back every slot it took
   from a pool or a factory, and touch nothing handed in — unless the place that accepts
   it promises the take-over in its own TSDoc (section 1).
2. Make it idempotent — by flag, or by construction (section 2).
3. Emit the dispose event, then `off(this)`.
4. `SignalGroup.delete(this)` after your own release; never `SignalGroup.destroy()`.
5. Place `super.dispose()` first or last by the rule in section 5, with the reason as a
   comment at the call.
6. Decide every public member's post-dispose behaviour by the type rule in section 3 and
   state it in that member's TSDoc.
7. Reject every pending promise.
8. Expose `isDisposed` where callers have to branch on it.
9. Ship the tests from section 7.

## 7. The dispose test pattern

Unit tests live next to the source as `*.spec.ts` under Vitest. Spies on the object
under test use `createSandbox()` from `sinon` with `afterEach(() => sandbox.restore())`;
`vi.spyOn` is for globals such as `fetch` or `console`.

`Thing` is the class under test; every other name is a placeholder to fill in —
`descriptor` for what the constructor takes, `makeResource()` for a resource handed in,
`item` for a mutating method's argument, `makePool()` plus `freeItem()` for the pool or
factory a slot comes from, and `resource` / `requiredMember` / `release()` for the three
member kinds of section 3.

```ts
import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {afterEach, describe, expect, test} from 'vitest';

import {Thing} from './Thing.js';

describe('Thing', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  describe('dispose()', () => {
    // (a) a resource the instance built itself is released exactly once
    test('disposes the resource it created itself', () => {
      const thing = new Thing(descriptor);
      const resourceDispose = sandbox.spy(thing.resource, 'dispose');

      thing.dispose();

      expect(resourceDispose.calledOnce).toBe(true);
    });

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose a resource that was handed in', () => {
      const resource = makeResource();
      const resourceDispose = sandbox.spy(resource, 'dispose');

      const thing = new Thing(resource);
      thing.dispose();

      expect(resourceDispose.called).toBe(false);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('behaves as documented after dispose()', () => {
      const thing = new Thing(descriptor);

      thing.dispose();

      expect(thing.resource).toBeUndefined();
      expect(() => thing.requiredMember).toThrow();
      expect(() => thing.release(item)).not.toThrow();
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', () => {
      const thing = new Thing(descriptor);
      const resourceDispose = sandbox.spy(thing.resource, 'dispose');

      expect(() => {
        thing.dispose();
        thing.dispose();
      }).not.toThrow();

      expect(resourceDispose.calledOnce).toBe(true);
    });

    // (e) no signal or effect outlives the instance
    test('does not leak signals or effects', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      const thing = new Thing(descriptor);

      expect(getSignalsCount()).toBeGreaterThan(baselineSignals);
      expect(getEffectsCount()).toBeGreaterThan(baselineEffects);

      thing.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    // (f) every slot taken from a pool or a factory goes back, and each one once
    test('gives every slot it took back', () => {
      const pool = makePool();
      const thing = new Thing(pool);
      const freeItem = sandbox.spy(pool, 'freeItem');

      thing.take(item);

      thing.dispose();

      expect(freeItem.calledOnceWithExactly(item)).toBe(true);
    });
  });
});
```

Notes on the assertions:

- **(b) inverts** for a class that promises a take-over under section 1: it asserts the
  handed-in resource is released exactly once, and the test name says so. `Display` with
  a `WebGPURenderer` is that case, and its test sits in
  `packages/twopoint5d-testing/test/display-adopt-renderer.test.js` because a
  `WebGPURenderer` needs a real browser.
- **(e)** takes the baseline before construction; the two `toBeGreaterThan` checks prove
  the test would notice if the class stopped creating signals altogether.
- **(f)** is the one spy on something the instance does not own. Take the instance
  through the calls that hand slots out, then dispose it, and assert on the releasing
  call — not on a `dispose()` of the pool. A class that passes every slot straight to its
  caller has no subject here.

Where `dispose()` decides what happens to GPU buffers, a unit test cannot see the
result. Add a browser test in `packages/twopoint5d-testing/` and run `pnpm test:browser`.
