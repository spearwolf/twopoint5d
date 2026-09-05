# Resource lifecycle: `dispose()` and ownership

These are the rules for releasing resources in `@spearwolf/twopoint5d`. They are
binding: a `dispose()` that does not follow them is a bug, not a variation.

## 1. Scope

These rules apply to every class in this package that has a `dispose()` method, and to
every new module that gets one. That covers geometries, materials,
meshes, pools, renderers, stores and the display layer alike. Where a layer needs
more detail than the general rule gives, it documents it next to its own code — the
[stage layer cheat-sheet](../src/stage/README.md) does that for the renderer and its
render targets.

## 2. Ownership

**`dispose()` releases what the instance created itself, and nothing else.**

A resource that was handed in — through the constructor, a setter or an attach
method — belongs to the caller. It is not disposed, not cleared, not modified. Who
hands a resource in, disposes it. Who hands a resource out while still owning it,
stays its owner: returning a pool from a getter does not transfer it.

The reference implementation is
[`VOBufferGeometry`](../src/vertex-objects/VOBufferGeometry.ts). Its constructor
builds a pool only when it was given a descriptor, and marks exactly that pool:

```ts
this.pool = source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity);
if (!(source instanceof VOBufferPool)) {
  this.declareOwnedPool(this.pool);
}
```

`dispose()` then asks the bookkeeping instead of guessing:

```ts
if (this.#ownedPools.has(this.pool)) {
  this.pool.dispose();
}
```

Do not introduce a new take-over flag. The rule already answers the question, and a
flag turns an invariant into an option that every caller has to reason about.

[`InstancedVOBufferGeometry#attachInstancedPool(name, pool, {autoDispose})`](../src/vertex-objects/InstancedVOBufferGeometry.ts)
is the one flag that exists, and it is not an exception to the rule: its default
value asks precisely what the rule asks — did this geometry build the pool itself? A
descriptor handed in becomes a pool owned here, a `VertexObjectPool` handed in
belongs to the caller. The flag exists so that a pool shared between several
geometries can be attached explicitly without any of them claiming it. Read it as a
sharing declaration, not as a template for new APIs.

## 3. Idempotence

**`dispose()` may be called any number of times.**

The second call releases nothing a second time and it does not throw. Guard with a
private flag and return early, the way
[`VOBufferPool.dispose()`](../src/vertex-objects/VOBufferPool.ts) does:

```ts
dispose(): void {
  if (this.#disposed) return;
  this.#disposed = true;
  // …
}
```

The flag is the default shape and the safe answer whenever a step would do real work
twice. A `dispose()` in which every single step runs empty on the second call needs
none: a reference that has been given up makes the optional call behind it fall
through, `removeFromParent()` checks for a missing parent, `SignalGroup.delete()` and
a repeated `set(undefined)` change nothing, and `Material.dispose()` reaches nobody the
second time because its `dispose` event is what makes the renderer's listeners unsubscribe
themselves. Such a method satisfies this rule by
construction — but only if that is shown rather than claimed, which is what assertion
(d) of section 8 is for: a second call throws nothing and releases nothing again.

Where a caller needs to know the state, expose it as a read-only `isDisposed`
getter. [`VOBufferPool`](../src/vertex-objects/VOBufferPool.ts) and
[`FixedFrameLoop`](../src/display/FixedFrameLoop.ts) both do:

```ts
get isDisposed(): boolean {
  return this.#disposed;
}
```

Add the getter where callers actually have to branch on it, not as boilerplate on
every class.

## 4. After `dispose()`

Every public member of a disposed instance behaves in one of exactly three ways, and
which one is decided by its type:

1. **A member whose type already admits absence answers `undefined`.** If the
   declared type is `T | undefined`, `undefined` is a value the caller is required to
   handle anyway. [`TexturedSprites#texture`](../src/sprites/TexturedSprites/TexturedSprites.ts)
   is typed `Texture | undefined` and reads through an optional chain, so it answers
   `undefined` once the material is gone.
2. **A member whose type claims presence throws.** If the declared type is `T`, do
   not hand back `undefined` and lie about the type. Throw an `Error` that names the
   class and the state, so the stack points at the real mistake — using an instance
   after it was released. [`Display#canvas`](../src/display/Display.ts) is typed
   `HTMLCanvasElement`, and a read after `dispose()` raises
   `Display#canvas is not available: this display has been disposed`.
3. **A mutating method with nothing left to act on is a silent no-op.**
   [`TexturedSprites#freeSprite()`](../src/sprites/TexturedSprites/TexturedSprites.ts)
   returns a sprite to a pool that no longer exists, and simply does nothing.

What this section rules out has a name: a `TypeError` raised deep inside the class
because a field quietly became `undefined`. That is none of the three reactions. The
caller learns nothing from it, and the stack points at the wrong line.

A pending promise is not allowed to survive either. Anything a caller is still
awaiting when `dispose()` runs — a texture request, a load — is rejected as part of
`dispose()`, not left hanging.

Whichever of the three a member picks, its TSDoc says so.

## 5. Signals, effects and events

Every signal and every effect an instance creates is attached to that instance, so a
single call tears them all down. See
[`TexturedSpritesMaterial`](../src/sprites/TexturedSprites/TexturedSpritesMaterial.ts):

```ts
#colorMap = createSignal<Texture | undefined>(undefined, {attach: this});

createEffect(
  () => {
    // …
  },
  {attach: this},
);
```

and its `dispose()`:

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

`SignalGroup.delete(this)` is the entire teardown of the signal side. Do not use
`SignalGroup.destroy()` — it is deprecated in `@spearwolf/signalize`.

On the eventize side, `off(this)` removes every listener. A class others subscribe to
emits its dispose event **before** it removes its own listeners, otherwise the event
reaches nobody. [`Display.dispose()`](../src/display/Display.ts):

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

**Order rule:** release your own resources **before** the call that tears down the
signal group. A resource reachable only through a signal is unreachable once that
signal is destroyed, and releasing it afterwards works only as long as a destroyed
signal still hands out its last value. Do not depend on that leniency.

## 6. three.js interop

A class extending `Material`, `BufferGeometry` or `Mesh` overrides `dispose()` and
calls `super.dispose()`. Where in the method that call goes depends on what the base
class does.

**`super.dispose()` first — when it only announces.** `THREE.BufferGeometry.dispose()`
emits its dispose event, and the renderer reads the attributes one last time while
handling it. So the call goes out while every slot is still filled.
[`VOBufferGeometry.dispose()`](../src/vertex-objects/VOBufferGeometry.ts) carries the
reason at the line itself:

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

**`super.dispose()` last — when it already tears down.** A material base class that
calls `SignalGroup.delete(this)` destroys the signals an owned resource hangs from, so
that resource has to be released first:

```ts
override dispose(): void {
  // the signal this resource hangs from is gone once super.dispose() has run, so it is
  // released here, while the value is still reachable
  this.#ownedThing?.dispose();
  super.dispose();
}
```

[`AnimatedSpritesMaterial.dispose()`](../src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts)
is ordered this way for the same reason: it clears its `animsMap` reference — a texture that
belongs to the caller and is therefore not released — while the signal holding it is still
live, and only then calls `super.dispose()`.

The single rule behind both, and the only one worth memorising: **release nothing
whose access path the `super` call has already cut, and take away nothing the `super`
call is still going to read.**

A `Mesh` that gives up its geometry or its material in `dispose()` takes itself out of the
scene graph first, via `removeFromParent()`, rather than demanding the right order from the
caller. That holds whether or not it owned them: a mesh with an empty geometry slot cannot be
rendered, and the next frame would fail deep inside the renderer.

## 7. Checklist for a new `dispose()`

1. Release every resource this instance created itself, and touch none that was
   handed in.
2. Make `dispose()` idempotent — by a flag, or by construction as in section 3.
3. Emit the dispose event, then remove the listeners with `off(this)`.
4. Call `SignalGroup.delete(this)` for the signal side — after your own release, and
   never `SignalGroup.destroy()`.
5. Place `super.dispose()` first or last by the rule in section 6, and write the
   reason as a comment at the call.
6. Decide the behaviour of every public member after `dispose()` by the type rule in
   section 4, and state it in that member's TSDoc.
7. Reject every promise still pending.
8. Expose `isDisposed` where callers have to branch on the state.
9. Ship the tests from section 8.

## 8. The dispose test pattern

A unit test lives next to its source as `*.spec.ts` and runs under Vitest. Use
`createSandbox()` from `sinon` with `afterEach(() => sandbox.restore())` for spies on
methods of the object under test; `vi.spyOn` is for globals such as `fetch` or
`console`.

`Thing` is the class under test. Every other name in the skeleton is a placeholder:
`descriptor` for whatever the constructor takes, `makeResource()` for a resource handed
in from outside, `item` for the argument of a mutating method, and `resource` /
`requiredMember` / `release()` for the three kinds of member from section 4. Fill them
in for your module.

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
  });
});
```

Assertion (e) measures the counters **before** the instance is constructed and
expects the same values after `dispose()`; the two `toBeGreaterThan` checks in
between prove the test would notice if the class stopped creating signals at all.

Where `dispose()` decides what happens to GPU buffers, the unit test cannot see the
result. Add a browser test in `packages/twopoint5d-testing/` as well, and run it with
`pnpm test:browser`.
