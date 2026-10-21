# Proposal: growing capacity — sprites that never run out of slots

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "FeatureSprites" (growing
capacity) and "Performance", and [`src/vertex-objects/README.md`](../../src/vertex-objects/README.md),
"Growing a pool". Deviations:

- a growth that throws throws from `FeatureSpritesGeometry#grown()` before any geometry exists — the
  constructor allocates the buffers or fails —, so there is no half-built geometry to dispose (§2.6);
- `VertexObjectPool#adoptVOs()` hands the `onCreateVO` hook of the source to a pool without one
  itself, so `FeatureSpritesGeometry#grown()` copies nothing by hand (§2, step 2; §3).

Phase F, part 2, of [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) (§4.16, the
second and third bullet — the first, the one-time warning of a full pool, came with phase A,
[`fade-flash-axis-billboards.md`](fade-flash-axis-billboards.md) §4). `createSprite()` answers
`undefined` once the pool is full, and an agent's first guess of the capacity is wrong more often
than not: the sprites that do not appear are the bug report. Phase A made the full pool loud; this
proposal lets a mesh that asks for it grow instead.

## 1. Goal

| who | what they get | § |
| --- | --- | --- |
| a game that spawns as many sprites as it likes (bullets, particles, vector balls) | `new FeatureSprites(kind, {capacity, grow: true})`: a full pool doubles instead of refusing | 2 |
| the core | `VertexObjectPool#adoptVOs(source)`: a pool takes the vertex objects of another one over, handles and all | 3 |
| a developer | one note on the console per mesh that names the price — a frame hitch — and the capacity to start with | 2.4 |

Nothing changes for a mesh without `grow`: it fills up, warns once and answers `undefined`, as
phase A built it. `TileSprites`, `Map2DTileRenderer` and every other user of the pool are untouched
— the pool gains a method and nothing else.

## 2. On the sprites

### 2.1 API

```ts
export interface FeatureSpritesOptions<Api extends object = object> {
  // … as before
  /**
   * A full pool grows instead of refusing: the `createSprite()` that finds every slot in use builds
   * a geometry of twice the capacity, moves every sprite over — handles, values and order — and
   * answers a sprite of the new pool. Default `false`. Excludes `geometry`, which the sprites do not
   * own and cannot replace.
   */
  grow?: boolean;
}
```

No growth factor and no limit: twice the capacity, `max(2 · capacity, 1)` — the number phase A's
warning already names, and the doubling that keeps the cost of n sprites at O(n) copies in all. A
limit would catch a leak, but a leak under `grow` still shows: the console note names every first
growth, and the capacity can be read at any time (`spritePool.capacity`). A factor or a limit is
added the day a game asks for one; neither is in the roadmap sketch.

### 2.2 What a growth does

In `FeatureSprites#createSprite()`, when `pool.createVO()` answers `undefined` and the mesh was
built with `grow: true`:

1. **A new geometry** of `max(2 · capacity, 1)` sprites, built by the geometry itself
   (`FeatureSpritesGeometry#grown(capacity)`, internal): the same kind, **the same descriptor** as
   the pool it replaces — so a geometry built with `attributeUsage`, whose description is a copy of
   the kind's, keeps the usage of every attribute and the prototype of its handles —, and the base
   pool's buffers copied over from the old base, so `baseArgs` come along without being kept. The
   new geometry takes the `name` of the old one.
2. **Every sprite moves over** with `newPool.adoptVOs(oldPool)` (§3): the used slots of every buffer,
   in their order — a sorted pool stays sorted —, and every handle, which now reads and writes the
   new buffer and keeps its slot. The new pool takes the `onCreateVO` hook of the old one.
3. **The meshes follow**: `this.geometry` and the geometry of every pass mesh become the new one.
   The materials, their uniforms, textures and bindings are untouched — they never held the
   geometry. three's render objects see a geometry of another id on the next frame and collect its
   attributes anew (`RenderObject#needsGeometryUpdate`, three 0.186.1), so nothing in the scene
   graph has to be told.
4. **The old geometry is disposed** — it was built by the mesh, so it is the mesh's to release
   (`docs/resource-lifecycle.md` §1). Its pool goes with it, empty: `adoptVOs()` took every handle,
   so the dispose of the old pool unlinks none of them. three's dispose event frees the gpu buffers
   of the old attributes.
5. `createVO()` on the new pool hands out the sprite the caller asked for.

`FeatureSprites#sortByViewDepth()` grows its key array with the capacity already; the new pool
builds its sort scratch on its first sort, as every pool does. A sort, a `freeSprite()` and an
`update()` after a growth work on the new pool as on any.

**The price** — what the roadmap calls a frame hitch: the copy of every used slot of every buffer
(76 B a sprite of `TexturedSpriteKind`), new gpu buffers for every attribute, and the upload of
the used slots of all of them on the next frame — the static ones included, which otherwise go up
only when touched — and three collects the attributes of every render object of the mesh and its
passes anew on the next frame. A mesh that grows from
16 to 10 000 sprites grows ten times, each costing about as much as the sprites it held.

### 2.3 Handles and references

- A **handle** stays the same object through a growth, keeps its values and its slot, and goes on
  writing into the pool of the mesh. `freeSprite(handle)` after a growth frees it from the new pool.
- **`geometry` and `spritePool` are new objects after a growth.** A reference kept from before
  points at a disposed geometry and a disposed pool (`isDisposed`); read them from the mesh afresh.
  The TSDoc of both getters says so.
- **A `createSprite()` from an `onCreateVO` hook** of the sprite pool — a sprite that brings a
  companion along — may grow the pool while the outer `createSprite()` hands out the last free slot.
  Both sprites live on in the grown pool: the pool registers a handle before its hooks run (§3), so
  the growth takes the outer one along. The rule holds for any hook that makes the pool adopted.
- **Only `createSprite()` grows.** `spritePool.createVO()` and `createFromAttributes()` are the
  pool's own API, which knows nothing of the mesh, and answer what a full pool answers.
- A geometry with **pools attached** under a name (`attachInstancedPool()`) cannot grow — the new
  geometry would leave them behind. The `createSprite()` that would grow it throws, before anything
  is built:

  > `FeatureSprites#createSprite(): the pool is full and cannot grow — the geometry of the sprites has pools attached (attachInstancedPool()), which a grown geometry would leave behind. Detach them, or build the sprites without grow and with the capacity they need`

### 2.4 The note on the console

The first growth of a mesh says so, once, through `console.info` — not `console.warn`: the mesh was
asked to grow, and it did; the note is there to name the price, not a mistake:

> `FeatureSprites "<name>": the pool was full at <capacity> sprites and grew to <2 · capacity> — a frame hitch: a new geometry, every sprite copied over and every attribute uploaded anew. Where this many sprites are the rule, start with new FeatureSprites(kind, {capacity: <2 · capacity>, grow: true}). This note is shown once per FeatureSprites.`

**Once per mesh, not "in development".** The library has no notion of a build mode, and the
convention a bundler offers (`process.env.NODE_ENV`) is no binding in a plain ES module in a browser;
a check that guards against its absence still logs in every page built without a bundler. Once per
mesh is quiet enough for production and loud enough for the developer, and it is the rule phase A
set for the full pool.

Under `grow: true` the warning of a full pool (phase A) is not shown: the pool is never full.

### 2.5 Refusals

At construction, a `TypeError` before anything is built:

- `grow` next to a `geometry` handed in — the mesh does not own that geometry and cannot replace
  it:

  > `FeatureSprites: grow builds a larger geometry once the pool is full, and a geometry was handed in, which the sprites do not own — leave out grow, or leave out the geometry and give the sprites the capacity (attributeUsage, baseArgs) to build their own`
- `grow` that is not a boolean: `FeatureSprites: grow is true or false, got <value>`.

`grow` is no material parameter: it stays out of `setValues()`, as `passes` does.

### 2.6 Edge cases

- `capacity: 0` with `grow: true`: the first `createSprite()` grows to 1, the next ones to 2, 4, ….
- A disposed mesh answers `undefined` and does not grow.
- A growth that throws — a typed array of more than the engine allows — throws out of
  `createSprite()` before the meshes switch: the sprites go on drawing the old geometry, every
  handle still in it. The constructor of the new geometry allocates its buffers or throws, so
  nothing half-built is left.

## 3. The core: `VertexObjectPool#adoptVOs(source)`

```ts
class VertexObjectPool<VOType> {
  /**
   * Takes the vertex objects of `source` over: the slots it uses, the values of every buffer in
   * them, and every vertex object, which reads and writes the buffer of this pool from then on and
   * keeps its slot. `source` is left empty, its data where it was.
   */
  adoptVOs(source: VertexObjectPool<VOType>): void;
}
```

- **Requirements** — each refused with an `Error` that names the fix, before anything moves:
  - this pool and `source` are alive (`VertexObjectPool#adoptVOs(): this pool has been disposed`,
    `… the source pool has been disposed`);
  - `source` is another pool (`… a pool cannot adopt its own vertex objects`);
  - both are built on **the same descriptor** — the prototype of the vertex objects is the
    descriptor's, and a vertex object of another descriptor would read this buffer through another
    layout (`… the source pool is built on another descriptor — build this pool on
    source.descriptor`);
  - this pool is **empty** (`usedCount` 0 — `… this pool has 3 vertex objects in use — adopt into
    an empty pool`);
  - this pool holds **at least `source.capacity`** slots (`… the source pool holds 16 slots, this
    pool 8 — adopt into a pool of at least the capacity of the source`). The copy takes the buffers
    whole (`VertexObjectBuffer#copy()`), which is what a growth needs.
- **What moves**: `buffer.copy(source.buffer)` — every buffer, whole, marked for upload;
  `usedCount = source.usedCount`; every vertex object of `source`'s slots below its `usedCount`
  into the same slot here, linked to this buffer (`VOUtils.setBuffer()`). Slots without a vertex
  object (filled by `createFromAttributes()`) stay without one; `getVO()` materializes it here.
- **`source` afterwards**: its index holds no vertex object, then its `usedCount` goes to 0 — so the
  release of those slots unlinks nothing, and neither does a later `dispose()` of `source`. Its
  buffers keep their data, and it remembers the pool that adopted it (below).
- **Adopted from inside an `onCreateVO` hook.** `createVO()` registers the vertex object of the slot
  it hands out in the index of the pool — and marks the slot for upload — *before* the
  `voInitialize` and `onCreateVO` hooks run, so a hook that makes the pool adopted takes it along:
  the vertex object `createVO()` answers lives in the adopting pool. A replacement the hook answers
  takes the slot in the pool that holds the vertex object then, found through the pools that
  adopted one another; a vertex object the hook freed gives its replacement no slot. `getVO()`
  materializes a vertex object the same way.
- Not a hot path: it allocates nothing beyond what `copy()` does, and nobody calls it per frame.
- `src/vertex-objects/README.md` names it in a short section "Growing a pool", after "Sorting a
  pool": `resize()` refuses a pool behind a geometry, so a grown geometry is a new
  geometry on a new pool that adopts the vertex objects of the old one — the recipe for a
  `VertexObjects` of one's own.

The roadmap sketch says the growth "points every handle at the new buffer (`VOUtils.setBuffer`)".
That alone is not enough: the pool keeps its own index of the handles (`getVO()`, `freeVO()` and
`sortBy()` read it), private to the class, so the move belongs in the pool.

## 4. Specs

- `src/vertex-objects/VertexObjectPool.adoptVOs.spec.ts`: the values of every buffer kind arrive
  (float32, an interleaved uint8 buffer, a static and a dynamic buffer); the handles keep identity,
  values and slot, `getVO()` and `containsVO()` agree, a write through a handle lands in the new
  buffer; `freeVO()` and `sortBy()` after an adoption; slots from `createFromAttributes()`; the
  source is empty, its later `dispose()` unlinks nothing; every refusal of §3 with its message,
  nothing moved.
- `src/sprites/FeatureSprites/FeatureSprites.grow.spec.ts`: a mesh of capacity 2 with `grow`
  creates a third sprite — capacity 4, the old geometry and pool disposed, the new geometry on the
  mesh and on every pass mesh, the handles valid with their values (every attribute of
  `TexturedSpriteKind`), `freeSprite()` of an old handle; `sortBy()` and `sortByViewDepth()` after a
  growth; a growth of a sorted pool keeps the order; `attributeUsage` and `baseArgs` survive (the
  descriptor and the base vertices); `capacity: 0`; the `onCreateVO` hook moves; the note once, its
  text, and no warning of a full pool; the refusals of §2.5 and §2.3; a disposed mesh does not grow;
  a growth that throws leaves the mesh as it was; the materials and the bound uniforms untouched;
  `update()` after a growth uploads the new geometry.
- Allocation spec in `src/sprites/hot-path-allocations.spec.ts`: `createSprite()` of a mesh with
  `grow` that does not grow allocates the sprite and nothing else, and `update()` after a growth
  allocates nothing.
- Browser test `packages/twopoint5d-testing/test/sprites-grow.test.js`, under WebGPU and WebGL 2: a
  mesh of capacity 2 with `grow` and a `ReflectionPass`, rendered once with two sprites, then five
  sprites in all (two growths) of five colours in a row, rendered again: every sprite and every
  mirror image is drawn — the render objects built for the first geometry follow to the third.

## 5. The guide

- `docs/sprites.md`, "FeatureSprites": the paragraph about the full pool gains `grow: true` — what
  it does, the price, the note, the references that go stale — in place of "A pool that grows on
  its own does not exist yet"; a `ts check` block; the refusal next to a `geometry`; "Performance"
  gets a bullet on the hitch.
- `src/vertex-objects/README.md`, "Growing a pool".
- CHANGELOG `[Unreleased]`, Added: one bullet for `adoptVOs()`, one for `grow`.
