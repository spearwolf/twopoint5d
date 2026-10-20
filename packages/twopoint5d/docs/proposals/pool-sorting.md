# Proposal: draw order — sorting a vertex object pool

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Draw order: sorting the sprites"
and "Performance", and [`src/vertex-objects/README.md`](../../src/vertex-objects/README.md), "Sorting
a pool". Deviations:

- the bench lives beside the sprites, `src/sprites/FeatureSprites/sorting.bench.ts`: it sorts
  `TexturedSpriteKind`, which the module `vertex-objects/` does not import (§4);
- the upload price of §2.4 is measured, not estimated: 76 B a sprite of `TexturedSpriteKind`, 60 B of
  them static;
- the allocation spec of a key function found that a key of `-0` is boxed as a fractional one is —
  `-0` is no small integer; the TSDoc of `VOSortKey` and the README say so (§2.2).

Phase F, part 1, of [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) (§4.15, and the
answer to its open question 5). A pool draws its objects in slot order, and that order is nobody's
choice: `createVO()` appends, `freeVO()` moves the last object into the freed slot. This proposal
gives the pool a way to put its slots into an order of the caller's choosing, and the sprites two
words for it.

## 1. Goal

| genre | what it needs | §  |
| --- | --- | --- |
| y-sorted top-down and isometric games | the lower sprite covers the upper one, with soft edges, so no alpha test | 3.1, 6 |
| vector balls, transparent billboard clouds | back to front in view space, every frame | 3.2, 6 |
| UI sprites | a stable order of one's own (a layer number) | 3.1 |

Sorting reaches the passes: a pass is a child mesh over the geometry of the sprites
(`FeatureSpritesPass`), so it draws the same pool in the same order (decision 6 of the master plan).

## 2. The core: `VertexObjectPool#sortBy()` and `#sortByKeys()`

### 2.1 API

```ts
/** The key of a vertex object for {@link VertexObjectPool#sortBy}: a number, the lower ones drawn first. */
export type VOSortKey<VOType> = (vo: VOType & VO) => number;

export interface VOSortOptions {
  /** The higher keys first. Default `false`: ascending. */
  descending?: boolean;
}

class VertexObjectPool<VOType> {
  /**
   * Puts the slots in use into the order of their keys. `key` is the name of a value property of
   * the vertex objects (`'y'`, `'x0'`, `'rotation'`) or a function of the vertex object.
   * @returns whether a slot moved
   */
  sortBy(key: string | VOSortKey<VOType>, options?: VOSortOptions): boolean;

  /**
   * Puts the slots in use into the order of `keys`: `keys[i]` is the key of the vertex object in
   * slot `i`, for every `i` below `usedCount`. The array is read, not written, and still names the
   * slots of before once the call returns.
   * @returns whether a slot moved
   */
  sortByKeys(keys: ArrayLike<number>, options?: VOSortOptions): boolean;
}
```

The two types go into `types.ts`, which the module exports as `export type *`.

### 2.2 The three forms of a key, and why three

- **A property name** is read straight from the typed array: the pool resolves the name once to the
  buffer, the stride and the offset its generated accessor reads, and reads the key of slot `i` at
  `i × stride + offset`. No vertex object is touched or materialized, and no value crosses a call —
  so no fractional value is ever boxed. The names it takes are the *value properties* the
  description generates, by the rules of `createVertexObjectPrototype()`: the name of an attribute
  of one value on one vertex (`rotation`), and every component property (`x`, `y`, `z` on one
  vertex; `x0` … `z3` on four). Anything else — a getter or a method of the `basePrototype` or of
  `methods`, a `set…`/`get…` method, an unknown name — is refused:

  > ``VertexObjectPool#sortBy(): "depth" is no value property of the vertex objects of this pool — name one of x, y, z, rotation, or hand in a key function (vo) => number``

  (the list is the value properties of the description, in its order, at most 12, then `…`).
- **A key function** is called once per slot in use, in slot order, before anything moves. A slot
  filled by `createFromAttributes()`, `fromBuffersData()` or buffers data handed to the constructor
  has no vertex object yet; it gets one, as `getVO()` gives it — once, on the first sort. The key
  function must not create or free vertex objects: `sortBy()` compares `usedCount` with the count it
  started from before each slot, so that it never materializes a vertex object in a slot the key
  function has freed, and once more after the last key, and throws — the sort has moved nothing,
  while what the key function did stands (a `freeVO()` has moved the last vertex object into the
  freed slot, as it always does):

  > `VertexObjectPool#sortBy(): the key function changed usedCount from 10 to 9 — create and free vertex objects before or after the sort, not inside the key function`

  A key function that returns a fractional value — or `-0`, which is no small integer either — may
  cost a heap number of 16 B per call where V8 does not inline it (the rule of `AGENTS.md`); the
  TSDoc says so and names the property form as the one that never does.
- **A key array** (`sortByKeys`) is the form for keys computed in bulk — the view depth of
  `FeatureSprites#sortByViewDepth()` (§3.2) is one. An array shorter than `usedCount` is refused
  with a `RangeError` that names both numbers, before anything moves.

### 2.3 The order

- **Stable.** Two slots of the same key keep the order they had before the call. A frame-to-frame
  sort of sprites standing on one row (the same `y`) therefore never swaps them back and forth —
  an unstable sort would flicker wherever two transparent sprites overlap at the same key.
- **Ascending** by default, `descending: true` the other way round. Descending is not the reverse
  of ascending: ties keep their slot order in both directions.
- **NaN last** in either direction: a key that is `NaN` sorts behind every number, the infinities
  included, and the slots of `NaN` keys keep their slot order among each other. The slots of a `NaN`
  stay out of the sort and are put behind the sorted ones — a `NaN` made into `+Infinity` would tie
  with a real infinity, and the stable order could keep it in front. `-0` and `0` are the same key.
- The keys are held as doubles, in a `Float64Array` the pool owns. The roadmap sketch named a
  `Float32Array`; a key function answers doubles, and rounding two different keys to one float
  would turn a real order into a tie, decided by the slot order of the moment.

The sort itself is a bottom-up merge sort over an index array (`Uint32Array`), runs of 32 slots
sorted by insertion first, and a merge skipped where the two runs are in order already — so a pool
that is sorted or nearly sorted, the common case of a sort every frame, costs one pass of
comparisons and the copies of the merge levels.

### 2.4 What moves

The slots `first` … `last`, the hull of the slots whose object changed, and nothing outside it:

1. **Every buffer of the pool** — each record of `buffer.bufferList`, whatever its usage, its data
   type or the attributes it interleaves — is permuted as whole objects: `vertexCount × itemSize`
   elements per slot, the padding included. The slots `first` … `last` are copied into one scratch
   copy, an `ArrayBuffer` the pool owns, through a view of the buffer's own data type, and gathered
   back in the new order. Every type is copied as it is, bit for bit within its type.
2. **Every handle**: the vertex object of the new slot `i` gets the index `i`
   (`VOUtils.setIndex()`, as `freeVO()` does) and takes the place `i` in the index of the pool.
   A handle stays the same object and goes on reading and writing its own values; `getVO(i)`
   answers the vertex object now in slot `i`.
3. **The upload**: `buffer.touch(first, last)` — every buffer is marked for the hull of the moved
   slots, and the next `update()` of every geometry on the pool uploads that range, `'static'`
   buffers without `autoTouch` included. A sort that moves nothing answers `false` and marks
   nothing. The roadmap sketch marked the whole used range; the hull is never wider and costs one
   comparison per slot to find.

**The price.** A pool sorted every frame whose order changes uploads (about) every buffer in full
every frame — the static ones included, which otherwise upload only when they are touched. For
10 000 sprites of `TexturedSpriteKind` — 76 B each, 60 B of them static — that is 760 KB a frame against
the 160 KB its dynamic attributes upload anyway. The guide says so (§5).

**Index buffers** stay as they are: the index of a non-instanced geometry repeats `indices` per
slot, shifted by `vertexCount × slot` (`createIndicesArray()`), and depends on the slot, not on what
stands in it. Permuting whole objects keeps it right.

**Instanced geometries.** The sort works on one pool. A pool attached with `attachInstancedPool()`
pairs its slots with the slots of the instanced pool by index; sorting one of them alone breaks that
pairing, and the pool cannot know of the other. The TSDoc and the README say: sort a pool whose
instances carry everything in that one pool, or sort the paired pools by the same keys
(`sortByKeys()` with one array for both — the second call sees the keys in the old order, so
compute them once and hand the same array to both before either moves; see §2.6). Sorting the base
pool of an instanced geometry is allowed and pointless.

**`VOBufferPool`** gets no sort: it has no handles, and nothing in the library sorts one.

**`TileSprites`** (map2d) uses the pool through `createVO()`, `freeVO()` and handles whose index it
reads afresh (`VOUtils.getIndex()` in `TileSpritesFactory#updateTile()`), so a sort of its pool
keeps it working; nothing in map2d sorts, and a map needs no order beyond the depth test.

### 2.5 Edge cases

- A **disposed** pool: `sortBy()` and `sortByKeys()` do nothing and answer `false`, as `freeVO()`
  and `touchVO()` do nothing there — the check comes before every other.
- **Fewer than two slots in use**: nothing to order, `false`, and the key function is not called.
- After a **`resize()`** (before a geometry is attached) the scratch grows with the capacity on the
  next sort; nothing else changes.
- **`freeVO()` after a sort** swaps the last slot into the freed one as always — the order is gone
  for those two slots until the next sort. **A sort after `freeVO()`** sees the pool as it is.
- **`toBuffersData()`** after a sort hands out the arrays in the new order.
- A key function that **throws**: the throw goes through, nothing has moved, nothing is marked.

### 2.6 Memory and allocations

On the first sort the pool allocates its scratch: the keys (`Float64Array`, capacity), the order and
the merge scratch (two `Uint32Array`, capacity), a slot array for the handles (capacity), and one
`ArrayBuffer` of the byte length of its largest buffer with a view per data type it holds. They grow
only when the capacity has grown since; `dispose()` lets go of them. Every later call allocates
nothing — held by an allocation spec in `src/vertex-objects/hot-path-allocations.spec.ts` (whole
numbers and constants in the round; the fractional keys are written in the setup and read from the
typed array).

## 3. On the sprites

### 3.1 `FeatureSprites#sortBy()`

```ts
/** The names of the number properties of a sprite handle — what {@link FeatureSprites#sortBy} takes by name. */
export type SpriteSortKeyName<Api> = {[K in keyof Api]-?: Api[K] extends number ? K : never}[keyof Api] & string;

class FeatureSprites<Api> {
  /** Sorts the sprites by a number property of their handle or by a function of it; see VertexObjectPool#sortBy. */
  sortBy(key: SpriteSortKeyName<Api> | ((sprite: Api & VO) => number), options?: VOSortOptions): boolean;
}
```

A thin layer over `spritePool.sortBy()`: `'y'`, `'z'`, `'rotation'`, `'width'`, `'fade'` … — every
number property a feature declares that is a value property of the description. The type admits a
number property that is a getter of a feature of one's own; the pool refuses it at run time with the
message of §2.2. Once disposed it does nothing and answers `false`.

### 3.2 `FeatureSprites#sortByViewDepth(camera)`

```ts
class FeatureSprites<Api> {
  /**
   * Sorts the sprites back to front as `camera` sees them: by the depth of their `instancePosition`
   * in view space, the farthest first. For billboards and transparent sprite clouds.
   */
  sortByViewDepth(camera: Camera): boolean;
}
```

- The depth of a sprite is the `z` of its position in view space,
  `(camera.matrixWorldInverse × matrixWorld × position).z`; three looks along −z, so the farthest
  sprite has the lowest value and an ascending sort draws it first. The roadmap named the mesh's
  `modelViewMatrix`; the renderer writes that only inside `render()`, after `update()`, so the
  method builds the same product itself, in a `Matrix4` it holds, after
  `this.updateWorldMatrix(true, false)` and `camera.updateWorldMatrix(true, false)` (which refreshes
  `matrixWorldInverse` of a camera) — the `update()` of the sprites refreshes its own matrix for
  the bindings the same way.
- Only the third row of the product is needed: `depth = m[2]·x + m[6]·y + m[10]·z + m[14]`, read
  from the `instancePosition` attribute of the pool straight out of its typed array into a
  `Float64Array` of keys the sprites hold, then `spritePool.sortByKeys(keys)`. The position is the
  centre of the sprite; a placement that moves the quad away from it (an anchor, a shear) does not
  enter the depth.
- Perspective and orthographic cameras alike: view-space `z` orders both.
- A kind **without `instancePosition`** has no position to measure. Every built-in placement
  requires `InstancePosition`, so only a kind with a placement of its own meets this:

  > `FeatureSprites#sortByViewDepth(): the sprites of this kind have no instancePosition to measure the view depth at — add InstancePosition to the features of the kind, or sort by a key of your own with sortBy()`

  An `Error`, thrown before anything is read; a disposed mesh answers `false` first, without it.
- Allocation-free per frame once the key array is there (it grows with the capacity) — held by
  `src/sprites/hot-path-allocations.spec.ts`. The vector-balls demo of the next wave calls it every
  frame on some 500 billboards.

### 3.3 Order of a frame

Write the sprites, sort, `update()`, render. A sort after `update()` reaches the gpu with the next
`update()`, a frame late.

### 3.4 Passes — the answer to open question 5

The passes draw the geometry of the sprites, so they draw in the sorted order. That is right for
the passes the library ships:

- `ReflectionPass` and `BillboardReflectionPass` draw transparent images with `depthWrite: false`;
  back to front in the view of the sprites is back to front for their mirror images as long as the
  mirror plane does not lie between the camera and the sprites — the scene a reflection on the
  ground is made for.
- `ShadowPass` draws one colour with `depthWrite: false`; two overlapping shadows of the same
  colour and alpha blend to the same pixel in either order. A shadow is never wrong for the order.

A pass that wants an order of its own needs a pool of its own; that is not offered.

## 4. Specs

- `src/vertex-objects/VertexObjectPool.sortBy.spec.ts`: by a property name, ascending and
  descending, on one vertex and on four (`x0`); by a key function; by keys; every buffer permuted —
  a pool with a float32 buffer, an interleaved uint8 normalized buffer with padding, an int16 and a
  float16 attribute, `'static'`, `'dynamic'` and `autoTouch: false` — compared slot by slot with
  the values each handle wrote; the handles keep their identity, their values and `getVO()` agrees;
  stable on ties in both directions; NaN last, behind ±Infinity, by every form of key; `false` and
  no mark for a pool in order, for fewer than two slots, on a disposed pool; the hull of the moved slots marked in every buffer, and an
  `update()` of a `VertexObjectGeometry` and of an `InstancedVertexObjectGeometry` uploads exactly
  that range (`updateRanges`); index buffer untouched; `freeVO()` after a sort and a sort after
  `freeVO()`; slots from `createFromAttributes()` sorted by a key function; the refusals of §2.2
  with their messages; a key function that frees the last vertex object leaves no vertex object in a
  slot out of use; a throwing key function leaves the pool as it was; a sort after `resize()`.
- `src/sprites/FeatureSprites/FeatureSprites.sortBy.spec.ts`: `sortBy('y')`, a key function,
  `descending`; `sortByViewDepth()` for a camera on +z and on −z (orders reverse), a turned and a
  moved mesh, a perspective and an orthographic camera; the refusal of a kind without
  `instancePosition`; `false` once disposed; the type of the name (`expectTypeOf`).
- Allocation specs: `sortBy(name)` both directions and `sortByKeys()` with an `update()` in the
  round; `sortBy(keyFunction)` with whole-number keys; `sortByViewDepth()` between two cameras set
  up once.
- `src/sprites/FeatureSprites/sorting.bench.ts`: 10 000 sprites of `TexturedSpriteKind`, a mesh of
  its own per bench — `sortBy('y')` of a random order (one of 16 orders built beforehand, written
  into the pool in the `beforeEach` hook, outside the measured call), with and without the
  `update()` after it, of a nearly sorted pool (ten sprites out of line per call), of a sorted one;
  `sortByViewDepth()` under a camera circling the cloud. Measured on Node 24: about 0.1 ms in order,
  0.5 ms with ten out of line, 1.1 ms by the view depth, 1.3 ms from a random order; the `update()`
  after a sort costs next to nothing beside it — the upload is the gpu's.
- Browser test `packages/twopoint5d-testing/test/sprites-draw-order.test.js`, under WebGPU and
  WebGL 2: two overlapping half-transparent sprites, red in front, blue behind, on black.
  Back to front (`sortByViewDepth(camera)`) the overlap shows red over blue; front to back
  (`sortBy('z', {descending: true})` with the camera on +z) the front sprite writes its depth first
  and the back one is dropped in the overlap — red over black. A `ReflectionPass` with
  `depthWrite: false` mirrors both: its overlap shows red over blue back to front and blue over red
  front to back — the pass follows the order.

## 5. The guide

- `docs/sprites.md`, a section **"Draw order: sorting the sprites"** after "FeatureSprites": when the
  slot order is not enough (alpha test and depth test do it for opaque and cut-out sprites); y-sort
  for top-down and isometric (`sortBy('y', {descending: true})` with y up the screen, `sortBy('z')`
  for sprites standing on the xz ground with the camera looking along −z from +z); back to front for
  billboards and clouds (`sortByViewDepth(camera)`); a `ts check` block; stable, NaN last; the
  order of a frame; the passes follow; the upload price; the line under "FeatureSprites" about
  `dispose()` and the "Performance" bullets.
- `src/vertex-objects/README.md`, a section **"Sorting a pool"**: the three forms of a key, what
  moves, the upload, the attached pools.
- `constants.ts`: the TSDoc of `voIndex` names `sortBy()` beside `freeVO()` as what changes an index.
- CHANGELOG `[Unreleased]`, Added: one bullet for the core, one for the sprites.
