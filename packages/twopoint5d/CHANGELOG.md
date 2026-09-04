# CHANGELOG

All notable changes to [@spearwolf/twopoint5d](https://github.com/spearwolf/twopoint5d/tree/main/packages/twopoint5d) will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- add the `VOBufferPool#isAttachedToGeometry` getter: it is `true` while at least one geometry has built `THREE.BufferAttribute`s on top of the pool's buffers, and answers up front whether a `resize()` will go through
- add `AnimatedSpritesMaterial#touchAnimsMap()`: re-reads the `animsMap` texture and rebuilds the animation lookup from its current image
- export the `AnimatedSpritesMaterialParameters` interface: a consumer can name the option type of the `AnimatedSpritesMaterial` constructor, as with every sibling material

### Changed

- upgrade the `@spearwolf/eventize` peer dependency to `^6.2.0` (was `^5.0.0`) and `@spearwolf/signalize` to `^1.0.0` (was `^0.30.0`) — both are major releases, and `signalize@1.0.0` requires `eventize@^6.0.0`, so the two only move together
- `TexturedSpritesMaterial` and `TileSpritesMaterial` now pass the TSL node type to `attribute()` explicitly (`attribute<'vec3'>(…)` instead of `attribute(…)`); the stricter `createSignal()` overloads no longer accept the untyped `AttributeNode<unknown>` these calls returned. No runtime change — the shader attributes were already used at these types
- `TexturedSpritesMaterial#dispose()` and `TileSpritesMaterial#dispose()` call `SignalGroup.delete()` instead of the deprecated `SignalGroup.destroy()`, which now prints a deprecation notice once per process
- change the return type of `VertexObjectPool#createVO()` to `(VOType & VO) | undefined` — the method returns `undefined` once `usedCount` has reached `capacity`
- `VertexObjectPool#resize()` throws for every change of capacity while the pool backs a geometry — resizing to the capacity the pool already has stays a no-op and is allowed. The `THREE.BufferAttribute`s and their GPU buffers take their size from the pool capacity exactly once, so a live geometry cannot follow a capacity change
- `VOBufferGeometry#dispose()` and `InstancedVOBufferGeometry#dispose()` release exactly the pools the geometry created itself, and leave every pool that was handed to the constructor untouched. Both also take the attributes built on the pool buffers off the geometry and drop the index, so nothing keeps the typed arrays alive through the geometry; attributes copied from a `BufferGeometry` passed to `InstancedVOBufferGeometry` stay where they are, because they belong to the caller. A further `update()` on a disposed geometry finds no attributes left to write to — it still sets the draw range and, on `InstancedVOBufferGeometry`, `instanceCount`
- `InstancedVOBufferGeometry#detachInstancedPool()` takes the attributes that route built off the geometry, and disposes a pool that belongs to the geometry as its last route from that geometry goes away. The pool is still returned, and one that a second route of the same geometry still reads stays alive. Attaching over a name that is already taken runs the same path — the attributes of the route it replaces come off with it — while a pool that takes its own name over again keeps everything it has. A material whose shader still reads an attribute of the detached route cannot render the geometry any more; disposing the geometry goes through.
- the `autoDispose` option of `InstancedVOBufferGeometry#attachInstancedPool()` defaults to whether the geometry built the pool itself: a descriptor or description handed in becomes a pool the geometry releases with itself, an existing `VertexObjectPool` stays the caller's. An explicit `autoDispose` still decides
- `TexturedSprites#createSprite()` and `#freeSprite()` are methods on the mesh and operate on its geometry's sprite pool; `createSprite()` returns `TexturedSprite | undefined` and answers `undefined` once the pool has reached its capacity
- `float16` attributes are backed by a `Float16Array`; a value written through the generated accessors is stored and read back as a half float. The `TypedArray` union lists `Float16Array` and every other type exactly once. A runtime without `Float16Array` throws on the first `float16` attribute; every other data type is unaffected
- the generated multi-component setters and `VertexObjectBuffer#copyAttributes()` copy element by element and allocate nothing per vertex
- `InstancedVOBufferGeometry#attachInstancedPool()` is generic over the vertex object type and returns `VertexObjectPool<VOType>`; without a type argument the returned pool is typed `VertexObjectPool<unknown>`
- a descriptor or description passed to `InstancedVOBufferGeometry#attachInstancedPool()` is wrapped in a pool that has the capacity of the geometry's `instancedPool`
- `TexturedSprites#spritePool` is typed `TexturedSpritePool | undefined` and `#texture` is typed `Texture | undefined`: after `dispose()` the mesh holds neither geometry nor material, `spritePool` and `texture` answer `undefined`, `createSprite()` answers `undefined`, and `freeSprite()` and a write to `texture` do nothing
- `VO[voBuffer]` is typed `VertexObjectBuffer | undefined`: a vertex object whose pool has let it go, through `freeVO()` or `dispose()`, reaches no buffer any more — the type `VOUtils.getBuffer()` answers with
- change the return type of `getDescriptorOf()` to `VertexObjectDescriptor | undefined`: a vertex object without a buffer has no descriptor to answer with
- `VertexObjects#geometry` is typed `GeoType | undefined` and `#material` `Material | Material[] | undefined`: the constructor takes both as optional, and `AnimatedSprites#dispose()` and `TexturedSprites#dispose()` give both up
- `VertexObjects` extends `THREE.Mesh<any, any>`: neither type parameter of `THREE.Mesh` can carry the `undefined` that the `geometry` and `material` declarations of this class need. Both slots are re-declared in the class itself, and those declarations are the types it shows
- change the return types of `TextureAtlas#randomFrame()` and `#randomFrameName()` to `TextureAtlasFrame | undefined` and `TextureAtlasFrameName | undefined`, and those of `#randomFrames()` and `#randomFrameNames()` to arrays of the same: an atlas without frames, or without named frames, has nothing to draw
- a lookup whose result an invariant guarantees — an attribute descriptor, the claim on an attribute slot, the buffers of a pool attached under a name — throws an error naming what was missing when that invariant is broken, at the place that relies on it
- `OrthographicProjection#viewSpecs` is typed `Partial<OrthographicProjectionSpecs>`, the same type `ParallaxProjection#viewSpecs` carries, and `projectionPlane` on both classes and on the `IProjection` interface is typed `ProjectionPlane | undefined`. Both constructor arguments are optional, and a projection built without them holds exactly what these types name
- the `Map2D#visibilitor` getter is typed `IMap2DVisibilitor | undefined`: a map that has not been given a visibilitor answers with nothing. The setter still takes an `IMap2DVisibilitor`
- `Map2DTileRenderer#tileFactory` is typed `IMapTileFactory | null` and holds `null` once `dispose()` has run. `endUpdatingTiles()` and `dispose()` answer a call on a disposed renderer with an error that names what is gone; `addTile()` and `reuseTile()` fail with a `TypeError` there, `removeTile()` and `clearTiles()` find no tiles left and stay silent — none of the four guards the field: for the three per-tile methods such a check would run on a path the tile streamer walks on every update, and `clearTiles()` only reaches the factory inside a loop over tiles that `dispose()` has already emptied
- `CameraBasedVisibility#pointOnPlane` is typed `Vector3 | null | undefined`: `null` marks a plane the camera looks past, `undefined` a point that was never computed
- change the return type of `DataIdsChunk2D#readDataIdAt()` and `#readDataIdAtLocal()` to `number | undefined` — coordinates outside the chunk have no data id
- `TextureResource.fromTileSet()` takes `imageUrl` as `string | undefined`, the type the resource stores it at. `TextureStore#parse()` hands the value of an item straight through, and that value is optional
- `FrameBasedAnimations#add()` throws when its third argument is neither a `TextureAtlas`, a `TileSet` nor an array of frames; the message names what that argument has to be, and no animation is registered
- the `typedArray` of a buffer in `VertexObjectBuffer#buffers` is typed `TypedArray | undefined`: `VOBufferPool#dispose()` takes every buffer its array and clears the same map in the same breath, so the field is empty only in a reference that was grabbed before that call
- change the return type of `VertexObjectBuffer#toAttributeArrays()` to `Record<string, TypedArray | undefined>` — an attribute name the descriptor does not know gets an entry without an array
- change the return type of `FrameLoop#start()` to `(() => void) | undefined`: a missing `target`, or one already running on the loop, gets no second unsubscribe function

### Removed

- remove `VertexObjectPool#onDestroyVO`: `freeVO()` and `dispose()` release a vertex object without firing a callback. `onCreateVO` is unchanged

### Fixed

- fix `VertexObjectPool#freeVO()`: the vacated slot is cleared on both the last-index and the swap path, so a freed index holds no vertex object — `getVO()` on it returns `undefined` and the internal index keeps nothing alive
- fix `VertexObjectPool#freeVO()`: the swap path tolerates an index slot that `createFromAttributes()` raised `usedCount` past without materializing a vertex object
- fix `VertexObjectPool#resize()`: shrinking unlinks every vertex object from the new capacity onwards, so a later read or write on one of them fails loudly
- fix the `VOBufferPool#usedCount` setter: the value is clamped to `[0, capacity]`, which keeps `availableCount` within `[0, capacity]` and every index handed out by `createVO()` inside the buffer. Every writing path — `clear()`, `dispose()`, `createFromAttributes()` and `fromBuffersData()` — goes through the setter, so the clamp is an invariant of the class
- fix the upload range of every geometry attribute: it spans `itemSize * vertexCount * usedCount` elements, so a pool with a `vertexCount` above `1` — quads built through `VertexObjectGeometry`, for instance — uploads every vertex of every object it has in use
- fix `VOBufferGeometry#update()` and `InstancedVOBufferGeometry#update()` for a pool that was disposed while the geometry still reads it: the buffers of such a pool are gone, and the geometry leaves the attributes built on them alone
- fix `InstancedVOBufferGeometry#update()` for the `[pool, capacity, BufferGeometry]` constructor variant: an attribute that none of the geometry's pools declares stays as it is. That is what the attributes copied from the given `BufferGeometry` need — they belong to the caller, and this constructor path has no base pool to resolve them against
- fix `InstancedVOBufferGeometry#detachInstancedPool()` and both `dispose()` methods: giving up a route removes exactly the attributes that route put on the geometry, even when two pools share their typed arrays or declare the same attribute name. A pool is therefore safe to `resize()` once its last route to any geometry is gone
- fix the attribute slot a route took over: giving up that route hands the slot back to the route it took it from — an earlier pool route, or an attribute copied from a `BufferGeometry` passed to the `InstancedVOBufferGeometry` constructor
- fix the pool an attribute name resolves to in `InstancedVOBufferGeometry#update()`: it is the pool that feeds the attribute currently sitting in that slot. Attribute names of extra pools may therefore collide with those of the instanced and base pool
- fix `TexturedSprites#createSprite()` and `TexturedSprites#freeSprite()` losing their bind to the sprite pool when called as `sprites.createSprite()` and `sprites.freeSprite(sprite)`; both run on the sprite pool of the mesh they are called on
- fix `AnimatedSpritesMaterial` crashing when constructed with, or assigned, an `animsMap` texture whose image has not loaded yet; it falls back to the neutral texture coordinates until an `AnimatedSpritesMaterial#touchAnimsMap()` call picks up the loaded image
- fix a generated setter to accept a typed array like it accepts a plain array: `b.setPos(a.getPos())` writes the values `a` carries
- fix a generated setter and `VertexObjectBuffer#copyAttributes()`: when the caller passes fewer values than `vertexCount * size`, unwritten components keep their previous value; single- and multi-component attributes behave the same way
- fix `OrthographicProjection#updateViewRect()` for a projection built without specs: `viewSpecs` holds an empty object from construction on, the shape `ParallaxProjection` starts from as well
- fix `InstancedVertexObjectGeometry`: a base capacity of `0` passed to the constructor reaches the base pool instead of becoming `1` — the same value `InstancedVOBufferGeometry` takes at that place

### Migration Guide

#### `@spearwolf/eventize` and `@spearwolf/signalize` peer dependency ranges

Both peer dependencies moved to a new major. Consumers have to bump them together:

**Before**

```json
{
  "dependencies": {
    "@spearwolf/eventize": "^5.0.0",
    "@spearwolf/signalize": "^0.30.0"
  }
}
```

**After**

```json
{
  "dependencies": {
    "@spearwolf/eventize": "^6.2.0",
    "@spearwolf/signalize": "^1.0.0"
  }
}
```

Two things are worth checking after the bump, because neither is visible to the type checker:

- **Deduplicate `@spearwolf/eventize`.** Its marker is keyed by `Symbol.for('eventize')` and therefore realm-wide, so a `^5` and a `^6` resolved side by side share one slot per object. Where v5 dispatched across the boundary for a while and then failed obscurely, v6 versions the marker payload and throws a `TypeError` naming both protocols. Check with `npm ls @spearwolf/eventize` and pin `^6` via `overrides` / `resolutions` if a transitive dependent still asks for the old range. The same applies to `@spearwolf/signalize`, whose internal `Symbol.for` keys moved into a `@spearwolf/signalize/` namespace: a pre-`1.0` and a `1.0` copy share nothing at all.
- **Bulk `off()` now clears retained state.** `off(ε)`, `off(ε, '*')` and any name array containing `'*'` or a nullish element wipe the retained values and retain policies along with the listeners. Targeted forms — `off(ε, eventName)`, `off(ε, [names])` — are unchanged.

Code that only consumes this library's public API needs no further changes. Code that calls `eventize` or `signalize` directly should read the upstream migration notes; the breaking changes that bite without a compile error are the `off()` semantics above and, on the signalize side, `batch()` / `beQuiet()` / `hibernate()` refusing an `async` callback.

#### `VertexObjectPool#onDestroyVO` is gone

Per-object cleanup belongs at the call site that releases the vertex object.

**Before**

```ts
pool.onDestroyVO = (vo) => {
  scene.remove(meshOf(vo));
};

pool.freeVO(vo);
pool.dispose();
```

**After**

```ts
scene.remove(meshOf(vo));
pool.freeVO(vo);

for (const vo of myLiveVOs) {
  scene.remove(meshOf(vo));
}
pool.dispose();
```

Note that `dispose()` does not walk the pool on your behalf: keep your own list of the vertex objects whose resources you have to release.

#### `VertexObjectPool#createVO()` can return `undefined`

Under `strictNullChecks` the honest return type turns an unguarded call into a compile error.

**Before**

```ts
const vo = pool.createVO();
vo.setFoo(1, 2);
```

**After**

```ts
const vo = pool.createVO();
if (vo == null) return; // the pool is full
vo.setFoo(1, 2);
```

Where the capacity is known to suffice, `pool.createVO()!` is the shorter way out.

#### `TexturedSprites#createSprite()` can return `undefined`

`createSprite` and `freeSprite` are methods now, called as `sprites.createSprite()` and
`sprites.freeSprite(sprite)`. Under `strictNullChecks`, the honest return type of `createSprite()`
turns an unguarded call into a compile error.

**Before**

```ts
const sprite: TexturedSprite = sprites.createSprite();
sprite.setPosition(1, 2, 3);
```

**After**

```ts
const sprite = sprites.createSprite();
if (sprite == null) return; // the sprite pool is full
sprite.setPosition(1, 2, 3);
```

#### A geometry releases only the pools it built itself

`VOBufferGeometry#dispose()`, `InstancedVOBufferGeometry#dispose()` and the `autoDispose` default of
`attachInstancedPool()` all follow one rule now: a pool the geometry created belongs to the geometry
and is disposed with it, a pool handed in belongs to the caller and is left alone. Three call
patterns change because of it.

**Before**

```ts
const shared = new VertexObjectPool(descriptor, 1000);

const geometry = new InstancedVertexObjectGeometry(shared, 1000, baseDescriptor, 1);
geometry.attachInstancedPool('extra', otherSharedPool);

geometry.dispose();
// shared.usedCount === 0     — the geometry cleared a pool it did not own
// otherSharedPool.usedCount === 0
// geometry.basePool was only cleared, its typed arrays stayed referenced
```

**After**

```ts
const shared = new VertexObjectPool(descriptor, 1000);

const geometry = new InstancedVertexObjectGeometry(shared, 1000, baseDescriptor, 1);
geometry.attachInstancedPool('extra', otherSharedPool);

geometry.dispose();
// shared and otherSharedPool are untouched — both were handed in
// basePool, built from baseDescriptor, is disposed with the geometry

shared.clear(); // opt back into the old behaviour, per pool
```

To have a pool that was handed in released with the geometry, say so:

```ts
geometry.attachInstancedPool('extra', otherSharedPool, {autoDispose: true});
```

`detachInstancedPool()` follows the same rule and therefore also changed: it releases a pool that
belongs to the geometry instead of only unhooking it. The pool it returns is dead in that case.

```ts
const pool = geometry.attachInstancedPool('extra', descriptor); // built here, so owned here
geometry.detachInstancedPool('extra');
// pool.isDisposed === true

const mine = geometry.attachInstancedPool('extra', new VertexObjectPool(descriptor, 100));
geometry.detachInstancedPool('extra');
// mine.isDisposed === false — it was handed in
```

Note that `dispose()` is more than `clear()`: it drops the typed arrays of the pool, and any
vertex object still held by the caller is unlinked from its buffer. Keep pools you want to reuse out
of a geometry's constructor, or hand them in as pools rather than as descriptors.

Sharing a pool between geometries is the caller's job for the same reason: the geometry that built a
pool releases it on `dispose()`, whoever else reads it by then. Passing on a pool a geometry built
for itself is therefore the one pattern to drop.

**Don't**

```ts
const one = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const two = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);

const shared = one.attachInstancedPool('extra', descriptor); // one built it, so one owns it
two.attachInstancedPool('borrowed', shared);

one.dispose();
// shared.isDisposed === true, and its typed arrays are gone
// two keeps the attributes it built on them: they read nothing, and two.update() leaves them be
```

**Do**

```ts
const shared = new VertexObjectPool(descriptor, 1000); // built by the caller, owned by the caller

const one = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const two = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);

one.attachInstancedPool('extra', shared);
two.attachInstancedPool('borrowed', shared);

one.dispose();  // shared is untouched — neither geometry built it
shared.dispose(); // when both geometries are gone
```

#### `float16` attributes are half floats

A `float16` attribute's buffer is a `Float16Array`. Values written through the generated accessors
round to half-float precision instead of being truncated to an integer.

**Before**

```ts
vo.v = 0.1;
vo.v; // 0
```

**After**

```ts
vo.v = 0.1;
vo.v; // 0.0999755859375
```

Two things follow from the switch:

- The runtime needs `Float16Array`. It shipped in Node 24 and has been available in every major
  browser engine since 2025; a runtime without it throws on the first `float16` attribute. The
  published package carries no `engines` field, so npm does not warn — this note is the only
  place the requirement is stated.
- A consumer that names the `TypedArray` type from this package directly needs a `tsconfig.json`
  `lib` that includes `ESNext.Float16` (TypeScript 5.9.3: the declaration lives in
  `lib.esnext.float16.d.ts`, in no year-numbered `lib`).

#### `InstancedVOBufferGeometry#attachInstancedPool()` returns a typed pool

The return type carries the vertex object type of the attached pool instead of `any`.

**Before**

```ts
const pool = geometry.attachInstancedPool('extra', descriptor);
pool.createVO().setFoo(1); // any, no compile-time check
```

**After**

```ts
const pool = geometry.attachInstancedPool<MyExtraVO>('extra', descriptor);
pool.createVO()?.setFoo(1); // typed as MyExtraVO
```

Without a type argument, `pool` is typed `VertexObjectPool<unknown>`.

#### A descriptor handed to `attachInstancedPool()` gets the instanced pool's capacity

`attachInstancedPool()` wraps a descriptor or description in a pool sized like the geometry's
`instancedPool`, so the extra pool holds one vertex object per instance.

**Before**

```ts
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const extra = geometry.attachInstancedPool('extra', descriptor);
extra.capacity; // 1
```

**After**

```ts
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const extra = geometry.attachInstancedPool('extra', descriptor);
extra.capacity; // 1000
```

Hand in a pool rather than a descriptor to pick the capacity yourself:

```ts
geometry.attachInstancedPool('extra', new VertexObjectPool(descriptor, 100));
```

A pool handed in that way belongs to the caller, and the geometry leaves it alone on `dispose()`.

#### Projection fields name the values their constructors write

`OrthographicProjection#projectionPlane`, `ParallaxProjection#projectionPlane` and the
`IProjection#projectionPlane` getter are typed `ProjectionPlane | undefined`, and
`OrthographicProjection#viewSpecs` is typed `Partial<OrthographicProjectionSpecs>`: both fields
hold exactly what a projection was built with, and a projection built without a plane or without
specs is not exempt. Under `strictNullChecks`, code that reads either field without a guard turns
into a compile error. A projection built with both a plane and specs — the normal case — needs no
change.

**Before**

```ts
const projection = new OrthographicProjection();
projection.projectionPlane.getPointByDistance(100);

const specs: OrthographicProjectionSpecs = projection.viewSpecs;
```

**After**

```ts
const projection = new OrthographicProjection();
projection.projectionPlane?.getPointByDistance(100);

const specs: Partial<OrthographicProjectionSpecs> = projection.viewSpecs;
```

#### `TextureAtlas#randomFrame()` and its siblings can answer `undefined`

An atlas without frames has none to draw, and one without named frames has no name to hand back.
Under `strictNullChecks` an unguarded call is a compile error.

**Before**

```ts
const frame: TextureAtlasFrame = atlas.randomFrame();
const names: TextureAtlasFrameName[] = atlas.randomFrameNames(4);
```

**After**

```ts
const frame = atlas.randomFrame();
if (frame == null) return; // the atlas carries no frames

const names = atlas.randomFrameNames(4).filter((name) => name != null);
```

For an atlas that is known to be loaded, `atlas.randomFrame()!` is the shorter way out.

#### `getDescriptorOf()` and `VO[voBuffer]` follow the lifetime of the vertex object

A vertex object that `freeVO()` or `dispose()` has released holds no buffer, so it has no
descriptor either. Both now say so.

**Before**

```ts
const {vertexCount} = getDescriptorOf(vo);
```

**After**

```ts
const descriptor = getDescriptorOf(vo);
if (descriptor == null) return; // the pool has released this vertex object
const {vertexCount} = descriptor;
```

Where the vertex object is known to be live — inside a getter it defines, for instance —
`getDescriptorOf(vo)!` says that in one character.

#### `VertexObjects#geometry` and `#material` can be `undefined`

`VertexObjects` takes both as optional constructor arguments, and the sprite meshes built on it
release both in `dispose()`. Reading through either needs a guard.

**Before**

```ts
sprites.geometry.instancedPool.createVO();
sprites.material.colorMap = texture;
```

**After**

```ts
sprites.geometry?.instancedPool.createVO();
if (sprites.material != null) {
  sprites.material.colorMap = texture;
}
```

#### `TexturedSprites#spritePool` and `#texture` can be `undefined`

`TexturedSprites#dispose()` releases the geometry and the material and leaves the mesh
holding neither. `spritePool` and `texture` name that: both are typed `| undefined`,
`createSprite()` answers `undefined`, and `freeSprite()` and a write to `texture` do nothing
once the sprites are disposed. Under `strictNullChecks`, code that reads either field
without a guard turns into a compile error. Sprites that have not been disposed — the normal
case — need no change.

**Before**

```ts
const sprites = new TexturedSprites(1000);
const pool: TexturedSpritePool = sprites.spritePool;
```

**After**

```ts
const sprites = new TexturedSprites(1000);
const pool = sprites.spritePool;
if (pool == null) return; // the sprites were disposed
```

#### `Map2D#visibilitor` can be `undefined`

A `Map2D` carries a visibilitor only once one has been assigned. The getter names that;
the setter is unchanged and still takes an `IMap2DVisibilitor`. Under `strictNullChecks`,
reading the getter into a non-optional binding turns into a compile error.

**Before**

```ts
const visibilitor: IMap2DVisibilitor = map2d.visibilitor;
```

**After**

```ts
const visibilitor = map2d.visibilitor;
if (visibilitor == null) return; // none assigned yet
```

#### `Map2DTileRenderer#tileFactory` is `null` after `dispose()`

`dispose()` drops the factory, and the field names that with `| null`. `endUpdatingTiles()` and
`dispose()` answer a call on a disposed renderer with an error that says the renderer is spent;
`addTile()` and `reuseTile()` reach the field directly and fail with a `TypeError`, while
`removeTile()` and `clearTiles()` find the tile map already empty and return without touching the
factory. None of the four guards the field: for the three per-tile methods such a check would run
on a path the tile streamer walks on every update, and `clearTiles()` only reaches the factory
inside a loop over tiles that `dispose()` has already emptied. A renderer in use needs no guard — only code that reads
`tileFactory` itself does.

**Before**

```ts
const factory: IMapTileFactory = renderer.tileFactory;
```

**After**

```ts
const factory = renderer.tileFactory;
if (factory == null) return; // the renderer has been disposed
```

#### `CameraBasedVisibility#pointOnPlane` can be `null`

The field holds `null` while the camera looks past the map plane, and `undefined` before the
first frame has computed anything. Both states are reachable at runtime, and the type names
them. A `== null` check covers both.

**Before**

```ts
const point: Vector3 = visibility.pointOnPlane;
```

**After**

```ts
const point = visibility.pointOnPlane;
if (point == null) return; // the camera does not look at the plane
```

#### `DataIdsChunk2D#readDataIdAt()` can answer `undefined`

Coordinates outside the chunk read past its data array. The return type names that; use
`containsDataAt()` to ask first, or take the `undefined`.

**Before**

```ts
const id: number = chunk.readDataIdAt(x, y);
```

**After**

```ts
const id = chunk.readDataIdAt(x, y);
if (id === undefined) return; // (x, y) is outside this chunk
```

#### `VertexObjectBuffer` buffers can hold no typed array

`VOBufferPool#dispose()` drops the typed arrays so the underlying `ArrayBuffer`s can be
reclaimed. A buffer reached through a living pool always holds its array; a reference kept
across the `dispose()` does not.

**Before**

```ts
const buf = pool.buffer.buffers.get('static_float32');
const values = Array.from(buf.typedArray);
```

**After**

```ts
const buf = pool.buffer.buffers.get('static_float32');
if (buf?.typedArray === undefined) return; // the pool has been disposed
const values = Array.from(buf.typedArray);
```

#### `VertexObjectBuffer#toAttributeArrays()` can answer without an array

The method returns one entry per requested name. A name the descriptor does not know gets
an entry whose value is `undefined`, and the return type says so.

**Before**

```ts
const arrays = vob.toAttributeArrays(['foo', 'bar']);
const foo: TypedArray = arrays['foo'];
```

**After**

```ts
const arrays = vob.toAttributeArrays(['foo', 'bar']);
const foo = arrays['foo'];
if (foo === undefined) return; // 'foo' is not an attribute of this descriptor
```

#### `FrameLoop#start()` can answer `undefined`

The method hands back a function that unsubscribes the `target` again. There is nothing to
hand back for a missing `target` or for one that is already running on the loop.

**Before**

```ts
const unsubscribe = frameLoop.start(target);
unsubscribe();
```

**After**

```ts
const unsubscribe = frameLoop.start(target);
unsubscribe?.(); // or use frameLoop.stop(target)
```

## [0.21.2] - 2026-06-19

- upgrade `@spearwolf/signalize` dependencies to latest versions

## [0.21.1] - 2026-05-13

- upgrade `@spearwolf/eventize` and `@spearwolf/signalize` dependencies to latest versions

## [0.21.0] - 2026-05-13

### Added

- add `TextureStore#whenResource(id)` — resolves once the resource is present (typically after `parse()`), rejects with a descriptive error after the first `OnReady` if the id is still missing. Replaces the previous "promise hangs forever on typo" failure mode of `get()` for missing ids
- add `options.signal` (`AbortSignal`) to `TextureStore#get(id, type, options?)` — allows callers to abort a pending `get()` (rejects with a `DOMException` named `AbortError`)
- add `TextureStore#clearUnused()` — disposes and removes every resource with `refCount === 0`; returns the number of resources cleared. Pairs with the existing refCount bookkeeping that subscriptions maintain via `store.on(id, type, ...)` / `store.get(...)`
- add `TextureStore#textureFactory` getter — exposes the single shared `TextureFactory` the store uses for all of its resources. Re-created automatically whenever `renderer` changes; the store now injects this factory into every managed resource so every `TextureStore` has exactly one factory per renderer (previously each resource spun up its own)
- add `TextureStoreEvents` constants — public string constants for the events emitted by `TextureStore` (`Ready`, `RendererChanged`, `Resource`, `Dispose`, `Error`). `Error` is new and carries `{source: 'fetch' | 'parse', url, error}`
- add `TextureResourceEvents` constants — public string constants for the events emitted by `TextureResource` (per-subtype events, plus `Dispose` and a new `Error` event carrying `{source: 'image' | 'atlas', url, error}`)
- add `TextureResourceSubtypes` constants — typed string constants for the five resource subtypes (`ImageCoords`, `Atlas`, `TileSet`, `Texture`, `FrameBasedAnimations`); fully interchangeable with the raw string literals (`'imageCoords'`, `'atlas'`, …) in `TextureStore#on(id, type, …)` and `TextureStore#get(id, type, …)` — both forms type-check identically. Pick whichever reads more clearly at the call site (the literals stay the recommended default in tests/demos for brevity; the constants are useful inside larger config objects or when grep-finding usage)
- add optional `frameBasedAnimations` argument to `TextureResource.fromAtlas(id, atlasUrl, overrideImageUrl?, textureClasses?, frameBasedAnimations?)` — parity with `fromTileSet`; atlas resources can now be constructed with their animation map up front. The `frameBasedAnimationsData` setter is now also honored for atlas resources (previously a silent no-op because the signal only existed on tile-set resources)

- add `FixedFrameLoop` — opt-in helper that wraps a `Display` and emits `OnTick` events at a fixed rate (default 60 fps) plus an `OnRender` event per render frame carrying an `alpha` interpolation factor in `[0, 1)`. Decouples simulation cadence from render cadence so per-frame JS-cost variance (physics, animation curves, IK) no longer produces visible micro-stutter even on high-refresh-rate displays. Spiral-of-death guard via `maxStepsPerFrame` (default 5). Auto-disposes when `Display` disposes
- add `Display#maxDeltaTime` getter/setter — proxy for the internal `Chronometer#maxDeltaTime`; default is `1 / 30` (~33ms) so individual frame outliers are capped instead of producing spikes. Set to `0` to disable
- add `Display#resizePollIntervalMs` — optional throttle (in milliseconds) for the per-frame DOM measurements inside `Display#resize()`. Default `0` keeps the legacy "measure every frame" behavior; on high-refresh-rate displays setting it to e.g. `1000 / 60` caps `getComputedStyle()` / `getBoundingClientRect()` calls and reclaims a significant slice of the frame budget
- add `Chronometer#reset(time?)` — return the chronometer to its initial state without allocating a new instance; `maxDeltaTime` is preserved
- add `Chronometer#maxDeltaTime` (also exposed as the second constructor argument) — optional upper bound for the per-`update()` delta; overflow is folded into `lostTime` so `time` stays continuous (covers rAF throttling in background tabs, long GC pauses, breakpoints). Default `0` means "disabled"
- add optional `time?` argument to `Chronometer#stop()` and `Chronometer#start()` — lets callers pin pause/resume to an explicit wall-clock so `lostTime` is tracked correctly even when no `update()` runs during the pause
- add `FixedFrameLoop.spec.ts` — 13 vitest cases covering tick cadence, accumulator drain, alpha monotonicity, multi-tick frames, spiral-of-death guard, prop forwarding, runtime `fps` updates, `reset()`, `dispose()` and `OnDisplayDispose` auto-cleanup
- add `FrameLoop.spec.ts` — vitest coverage for the first-frame `deltaTime`, `lastNow` emission, `measuredFps` warm-up, `maxFps` throttling (including grid-stability over many frames, jitter tolerance, long-pause snap-forward and `setFps()` reset), and `subscriptionCount` idempotency
- add `Chronometer.spec.ts` cases for: pause-without-update jump regression, hybrid pause (updates + idle wall-clock), `stop()`/`start()` idempotency, `maxDeltaTime` clamping, `reset()`
- add `IRenderable` interface (`renderTo(renderer: WebGPURenderer): void`) — implemented by `Stage2D` and `StageRenderer`
- add `IPassProvider` interface (`asPassNode(renderer): Node`) — TSL contribution of a stage; implemented by `Stage2D` (returns `pass(scene, camera)`) and `StageRenderer` (returns `texture(internalRT.texture)`)
- add `IStageRendererHost` interface (`onResize`, `onRenderFrame`) — the parent type a `StageRenderer` needs from a frame-loop host; `Display` satisfies it structurally
- add `ClearStage` — marker stage that emits `renderer.clear(...)` between siblings; depth-only by default, configurable via `{color, depth, stencil}` (use case: drop the depth buffer before drawing UI on top of the world)
- add `RootRenderPipeline` — `RenderPipeline` subclass with a built-in additive `buildOutputNode` (`p0.add(p1).add(p2)…`); assign as `StageRenderer.pipeline` to skip the `buildOutputNode` boilerplate for the common "compose every stage" case. User-set `buildOutputNode` still overrides the default
- add `StageRenderer#clear: boolean` flag — explicit opt-in for clearing the render target before drawing the stages (default `false`)
- add `StageRenderer#pipeline?: RenderPipeline` — optional `three.RenderPipeline` integration; without `buildOutputNode` (Mode C / §6.4) the stages render into an internal `RenderTarget` whose texture is sampled as `pipeline.outputNode`; with `buildOutputNode` (Mode D / §6.2) the user composes a TSL graph from per-stage pass nodes
- add `StageRenderer#outputRenderTarget?: RenderTarget` — redirect the renderer's final output into a `RenderTarget` instead of the canvas; useful for picking, screenshots or downstream passes; combines with `pipeline`
- add `StageRenderer#buildOutputNode?: (passes: Node[]) => Node` — TSL-composition hook used together with `pipeline`; called when the stage list changes; returns the node used as `pipeline.outputNode`
- add `StageRenderer#invalidateOutputNode()` — explicit "rebuild on next render" for the pipeline's `outputNode`
- add `StageRenderer#dispose()` — releases internal `RenderTarget`s and `this.pipeline`
- add `StageRenderer#asPassNode(renderer)` — returns a `texture()` node sampling this renderer's pass-target, for use inside a parent's `buildOutputNode`; the parent automatically pre-renders nested `StageRenderer` children into their pass-target before its own pipeline runs (§6.3)
- add `Stage2D#asPassNode(renderer)` — returns `pass(scene, camera)`; throws when camera is not ready (assign `projection` or call `resize()` first)
- add `OnAddToParent` event on `StageRenderer` (symmetric to `OnRemoveFromParent`)
- add `Stage2D#renderTo(renderer)` — renders `scene` with `camera`; no-op until both exist
- add fluent return (`this`) on `StageRenderer#add()`, `#remove()`, `#setClearColor()`, `#attach()`, `#detach()` — enables the three-line "Display + Stage2D + StageRenderer" idiom
- add JSDoc on `StageRenderer` covering the two frame-loop modes (auto via `parent`, manual via direct `updateFrame()` + `renderTo()`), the clear policy, and the `name` / `renderOrder` uniqueness requirement
- add `packages/twopoint5d/src/stage/README.md` cheat-sheet documenting roles, hello-world, manual vs. auto-driven mode, layering, `ClearStage`, nesting, clear policy table, custom stages, events, custom hosts and common pitfalls
- add `StageRenderer.spec.ts` (21 cases) covering clear policy, rendering order, fluent API, name-collision warning, host wiring, parent/child nesting and `OnAddToParent`/`OnRemoveFromParent` symmetry
- add `ClearStage.spec.ts` (5 cases) covering default flags, explicit options, naming, no-op lifecycle methods and runtime flag changes
- add Stage2D `renderTo()` unit tests and an assertion that the removed clear-properties are no longer exposed
- add browser test `stage-renderer.test.js` in `@spearwolf/twopoint5d-testing` covering Display-driven rendering, additive multi-stage rendering, nested renderers, and `detach()`-unhook
- add browser test `stage-pipeline.test.js` in `@spearwolf/twopoint5d-testing` covering Mode C internal-RT sampling, Mode D `buildOutputNode` invocation, and `dispose()` lifecycle
- add `RootRenderPipeline.spec.ts` (9 cases) covering the static additive composer (single / multi / empty), user-`buildOutputNode` precedence, `renderOrder` integration and outputNode rebuild on stage-list change — explicit verification that the composer receives ALL pass nodes
- add lookbook demo `stage-postprocessing.astro` — `Stage2D` with `bloom()` via `buildOutputNode`
- add lookbook demo `stage-nested-pipelines.astro` — outer `RootRenderPipeline` automatically composes a bloom-post-processed world layer (nested `StageRenderer` with its own pipeline) and a plain UI pass without an explicit `buildOutputNode`
- document the "one canvas writer per frame" constraint in `packages/twopoint5d/src/stage/README.md` (Mode E section + Common pitfalls): a `RenderPipeline.render()` and a plain `renderer.render(scene, camera)` cannot share the canvas within one frame — compose mixed stages via an outer pipeline instead

### Changed

- change `TextureStore#dispose()` no longer double-disposes its resources. The implicit `on(this, resource)` forwarding that ran `resource.dispose()` from the store's own `OnDispose` was removed; the explicit `for (resource of #resources) resource.dispose()` loop is now the single source of truth
- change `TextureStore#dispose()` and `TextureResource#dispose()` use `SignalGroup.delete(this)` instead of the deprecated `SignalGroup.get(this).destroy()` (also avoids the `TypeError` that happened if the group had already been removed)
- change `TextureResource#dispose()` is now idempotent (guards via an internal `#disposed` flag) — repeated `dispose()` calls are silent no-ops instead of throwing on the already-removed `SignalGroup`
- change `TextureStore#on(id, type, callback)` unsubscribe handler now removes its own `OnDispose` and `OnReady` listeners from the store. Previously each `on()` left a `once(OnDispose, …)` listener and a `once(OnReady, …)` listener that survived unsubscription as inert no-ops, leaking listener slots on stores with many short-lived subscriptions
- change `TextureStore` `defaultTextureClasses` is now backed by a signal with structural compare — mutating the field still works (setter assigns a new array), and identical re-assignments are deduplicated. Public reads/writes have the same shape as before, but the field is now observable internally and stays consistent with the rest of the reactive pipeline
- change `TextureStore#parse()` body is now wrapped in `batch()` so every signal write across all `items[*]` settles before `OnReady` and the per-resource `resource:<id>` events fire — subscribers see a consistent snapshot instead of partial updates
- change `TextureStore#parse()` propagates `item.frameBasedAnimations` into existing tile-set AND atlas resources (previously the existing-resource update path ignored animations; only the first `parse()` honored them via the constructor). Re-parsing with different `frameBasedAnimations` now actually rebuilds the animations
- change `TextureStore#load()` (instance) no longer mutates `data.defaultTextureClasses` (was `splice(0)`, now `slice()`). Re-passing the same `TextureStoreData` to a second `parse()` call now preserves the original defaults
- change `TextureResource.fromImage()` / `fromTileSet()` / `fromAtlas()` no longer mutate the supplied `textureClasses` array (was `splice(0)`, now `slice()`)
- change static `TextureStore.load(url)` now actually awaits `whenReady()` before resolving — previously it returned an already-resolved promise wrapping the un-parsed store, so `const store = await TextureStore.load(url)` did not actually have data when control returned
- change `TextureResource.load()` image-load effect is now an auto-tracking effect (no static deps) so it runs on registration and on every dep change. Previously it had static deps `[#textureFactory, #imageUrl]` which required the factory/URL to change *after* `load()` to ever fire — combined with the new "shared factory injected at parse() time" behavior, the static-dep variant would have left store-managed resources permanently un-loaded
- change `TextureResource.load()` image-load effect protects against stale results: if `imageUrl` (or `textureFactory`) changes while a previous `loadAsync` is still pending, the stale result is discarded and the texture is never assigned. Eliminates a race that would otherwise let an old image overwrite a fresh one and silently leak the new texture
- change `TextureResource.load()` atlas-fetch effect uses `AbortController` — cancelling the effect (dispose or `atlasUrl` change) aborts the in-flight `fetch()` instead of letting it land after teardown
- change `TextureResource.load()` passes `textureClasses` directly to `factory.create(image, ...classes)` so changes to `textureClasses` trigger a texture rebuild via the shared factory. Previously each resource owned its own factory whose constructor baked in the classes; now the store's factory is class-agnostic and resources hand their classes in at create-time
- change `TextureResource` central signal layout: `#frameBasedAnimationsData` and `#frameBasedAnimations` are now created in the field initializer instead of being conditionally instantiated inside `fromTileSet()` / `fromAtlas()`. The `frameBasedAnimationsData` setter is therefore active on every resource type (was a silent no-op for image / atlas resources)
- perf `TextureStore` creates one shared `TextureFactory` per renderer instead of one factory per resource — for `N` resources and a renderer swap, allocations drop from `N` factories to `1`. The store's factory is constructed without `defaultClassNames` (the per-resource `textureClasses` carry the merge already, via `joinTextureClasses(item.texture, store.defaultTextureClasses)`)
- change `TileSet#createTextureCoords()` drops the redundant `tileCountLimit === Infinity` branches in the while-loop guard — `tileCount < Infinity` is always true and the explicit early-out was unreachable when the limit was `Infinity`
- refactor `Display` `on*` event-helper properties (`onResize`, `onRenderFrame`, `onNextFrame`, `onInit`, `onStart`, `onRestart`, `onPause`, `onDispose`): replace the `bind`-with-`unknown`-cast pattern with typed arrow functions. Listener parameter is now `DisplayEventListener` (= `(props: DisplayEventProps) => unknown`), return type is the official `UnsubscribeFunc` from `@spearwolf/eventize`. No runtime change; purely a type-surface cleanup
- change `Display` `EventHandler` type alias removed in favor of a parameterized `DisplayEventListener<T = DisplayEventProps>` so `onDispose` can correctly type its argument as `Display`
- change `Chronometer#stop()` now captures the wall-clock timestamp; `Chronometer#start()` closes the pause-gap in `lostTime` and resets `#currentTime` + `deltaTime` to `0`, so the next `update()` produces a normal small delta even when no `update()` ran during the pause
- change `Chronometer#getCurrentTime` uses `Number.isNaN` instead of the global `isNaN`
- change `Display` constructs its internal `Chronometer` without the `0` seed (`new Chronometer()`), so `timeStart` is anchored to the wall-clock and the new `stop()`/`start()` gap-tracking takes effect
- change `DisplayStateMachine` Start/Pause handlers now pass an explicit `performance.now() / 1000` timestamp to `Chronometer#start()` / `stop()` / `update()` — guarantees a single coherent timestamp per transition
- change `Display[FrameLoop.OnFrame]` forwards the rAF timestamp from `FrameLoop` to `renderFrame()` instead of reading `performance.now()` again
- change `FrameLoop` `maxFps` throttle uses a rastered emit-schedule instead of the previous `now - lastNow >= 0.98 * interval` check — emissions stay on a fixed grid, vsync jitter is tolerated within 2% of the target interval, and long pauses (tab hidden, GC) snap the schedule forward instead of producing a catch-up burst on resume. Fixes the perceptible stutter on 120Hz/240Hz displays when a non-zero `maxFps` is configured
- change `StageRenderer.renderTo()` in pipeline mode always clears the internal pass-target each frame (transparent black, or the user's `clear`-color/alpha when `clear=true`) to avoid frame-content accumulation
- change `StageRenderer#renderFrame(renderer)` → `StageRenderer#renderTo(renderer)` (renamed for `IRenderable` consistency)
- change `StageRenderer#add(stage)` parameter type from `IStage` to `IStage & IRenderable`
- change `StageRenderer.parent` type from `Display | StageRenderer` to `IStageRendererHost | StageRenderer` — any frame-loop host is now accepted
- change `StageRenderer#setClearColor(color, alpha?)` signature: `color: Color | null` (was `Color | null | undefined`); now sets `clear = true` and returns `this`
- change `StageRenderer.renderTo()` clear-state restore: `setClearAlpha` is only called when a clear actually happened — previously the renderer's alpha was overwritten on every frame
- change `StageRenderer` warns via `console.warn` when a stage is added whose `name` is already in use **and** `renderOrder` is non-default (otherwise the sort is ambiguous)
- change `IStage`: drop optional `scene?` / `camera?` (they were unused by the renderer pipeline); `Stage2D` still exposes them as its own properties

### Removed

- remove `Stage2D#clearColor`, `Stage2D#clearAlpha`, `Stage2D#autoClear` — never honored by `StageRenderer`. Use `Scene#background` for per-scene backgrounds or `StageRenderer#setClearColor()` for the renderer-level clear

### Fixed

- fix `TextureStore#parse()` — passing the same `TextureStoreData` object to multiple `parse()` calls now keeps `data.defaultTextureClasses` and every `item.texture` array intact. The previous `.splice(0)` calls consumed the source arrays and the second `parse()` would behave as if `defaultTextureClasses` were empty
- fix `TextureStore.load()` (static) — the promise now resolves after the store has parsed the data, matching what `await TextureStore.load(url)` consumers expect
- fix `TextureStore#dispose()` race + double-dispose — resources are disposed exactly once, signal groups are cleared exactly once, and `dispose()` no longer throws `TypeError: Cannot read properties of undefined (reading 'destroy')` when called more than once on the store or its resources
- fix `TextureResource.load()` no longer leaves store-managed resources stuck without an image. The image-load effect is now an auto-tracking effect that runs on registration; under the previous static-dep + shared-factory combination, the effect's deps were already set at `load()` time so the effect would register but never fire. Symptom in user code: `await store.get(id, 'texture')` hung forever
- fix `TextureResource.load()` image race — a `loadAsync` resolve that lands after the resource was disposed or `imageUrl` changed no longer creates an orphan `Texture`. The created texture is disposed on cleanup; stale resolves are discarded before any signal write
- fix `TextureResource.fromAtlas()` — atlas resources can finally consume `frameBasedAnimations` data. Previously the `#frameBasedAnimationsData` signal was only created for tile-set resources, so the relevant effect in `load()` never had data to consume even though the code path existed
- fix `TextureStore#parse()` — the existing-resource update path for both `tileSet` and `atlasUrl` items now writes `item.frameBasedAnimations` into the resource (was ignored: a second `parse()` could not replace or add animations to an existing resource)
- replace silent `console.error` calls in `TextureStore#load()` and `TextureResource.load()` with structured `'error'` event emissions. Library users can now observe load failures programmatically (`on(store, 'error', listener)` / `on(resource, 'error', listener)`) instead of having a hardcoded `console.error` write into their app's log
- fix `Display#nextFrame` type signature: was incorrectly declared as `Promise<DisplayEventProps>` while the runtime value is a function returning the promise. All call sites already used `await display.nextFrame()` — the new type `() => Promise<DisplayEventProps>` matches that. TS code that wrote `await display.nextFrame` (without parens) was a latent runtime bug and is now flagged at compile time
- fix `Display#onDispose` listener type: was `(props: DisplayEventProps) => any`, but the `OnDisplayDispose` event is emitted with the `Display` instance (per `IOnDisplayDispose`). Handler is now typed as `(display: Display) => unknown`
- fix `Chronometer`: a `stop()` → (no `update()`s during the pause) → `start()` cycle no longer attributes the pause duration to the next `update()` as a giant frame delta — the wall-clock gap is folded into `lostTime` instead, so `time` and `deltaTime` stay continuous across pauses. This was the root cause of "subjective jumps" after `Display.pause = false` and after every `document.visibilitychange` resume
- fix `Display.now` starts at `0` and remains continuous after `start()` — previously it jumped to `performance.now() / 1000` (≈ seconds since page load) on the first `OnDisplayStart` because the internal `Chronometer` was seeded with `0` and the wall-clock gap between construction and start was not tracked
- fix `Display#deltaTime` on `OnDisplayStart` after a `visibilitychange` resume is now `0` (was: the entire hidden-tab duration as a single frame delta)
- fix `FrameLoop`: first emitted `OnFrame` has `deltaTime: 0` instead of `NaN` (the previous conditional `this.#lastNow != null && this.frameNo === 1` was inverted and always fell through to `now - undefined` on the first tick)
- fix `FrameLoop`: `lastNow` in the emitted `OnFrame` props now reflects the previous frame's timestamp instead of being identical to `now` (the `#lastNow = now` assignment used to happen before the `emit()`)
- fix `FrameLoop#measureFps`: the first measurement window is now anchored to the first rAF timestamp instead of using `0` as `measureTimeBegin`, eliminating the bogus ~6 FPS phantom sample that polluted `measuredFps` until the first real 30-frame window completed

### Migration Guide

#### `TextureStore` and `TextureResource` load failures no longer write to `console.error`

If you relied on `console.error` to surface `TextureStore` / `TextureResource` load failures (e.g. by watching the dev-tools console), subscribe to the new `'error'` event instead:

**Before**

```ts
const store = new TextureStore();
store.load('missing.json'); // failures appeared via console.error
```

**After**

```ts
import {on} from '@spearwolf/eventize';
import {TextureStore, TextureStoreEvents} from '@spearwolf/twopoint5d';

const store = new TextureStore();

on(store, 'error', ({source, url, error}) => {
  // source: 'fetch' | 'parse'
  myLogger.warn(`[TextureStore] ${source} failed for ${url}`, error);
});

store.load('missing.json');
```

`TextureResource` emits a similar `'error'` event with `source: 'image' | 'atlas'`.

#### `TextureStore.load(url)` (static) now waits for the data

The static factory used to return a synchronously-wrapped instance — `await TextureStore.load(url)` resolved before the JSON had been fetched and parsed. Now it returns only after the first `OnReady`:

**Before (latent bug)**

```ts
const store = await TextureStore.load('store.json');
// resources were NOT yet present here; you had to also `await store.whenReady()`
```

**After**

```ts
const store = await TextureStore.load('store.json');
// resources are present — equivalent to:
// const store = new TextureStore(); store.load('store.json'); await store.whenReady();
```

If your code did `await store.whenReady()` immediately after `await TextureStore.load(url)`, the second await is now a no-op (still safe, just redundant).

#### `TextureStore#get(id, type)` for unknown ids — opt into `AbortSignal` or `whenResource`

Previously `store.get('does-not-exist', 'texture')` returned a promise that never resolved or rejected. There are now two recommended options to avoid hanging promises:

```ts
// 1) Reject when ready but the id is missing:
const resource = await store.whenResource('hero'); // throws if 'hero' was not declared

// 2) Bound the wait with an AbortController:
const ac = new AbortController();
setTimeout(() => ac.abort(), 5000);
const tex = await store.get('hero', 'texture', {signal: ac.signal});
```

#### `TextureStore` shared `TextureFactory` (and the hard-coded `'nearest'` default is gone)

Each `TextureResource` no longer owns its own `TextureFactory`. The store now creates one `TextureFactory` per renderer and injects it into every managed resource. There is one knock-on behavior change: the per-resource factory used to be constructed as `new TextureFactory(renderer, resourceTextureClasses)` — when `resourceTextureClasses` was `undefined`, the `TextureFactory` constructor's hard-coded `defaultClassNames = ['nearest']` kicked in. The store's shared factory is now built as `new TextureFactory(renderer, [])` (no defaults), and per-resource classes are passed at `factory.create(image, ...classes)` time. Consequence: if a `TextureStore` `item` has no `texture: [...]` AND the store has no `defaultTextureClasses`, the texture is no longer implicitly `nearest`-filtered.

If you relied on the implicit `'nearest'` default, opt back in:

**Option A — set it at the store level once:**

```ts
const store = new TextureStore(renderer);
store.defaultTextureClasses = ['nearest'];
store.load('store.json');
```

**Option B — declare it in the JSON either per-store or per-item:**

```json
{
  "defaultTextureClasses": ["nearest"],
  "items": { "tex": { "imageUrl": "tex.png" } }
}
```

Demos that already specified `"texture": ["srgb"]` (etc.) on the item are unaffected — the explicit per-resource classes are honored exactly as before.

#### `TextureResource.load()` image-load effect now autoruns on registration

Internal change — no API surface affected. The image-load effect inside `TextureResource.load()` is now an auto-tracking effect (no static dep array) so it runs once on registration and re-runs on `textureFactory` / `imageUrl` / `textureClasses` changes. This is necessary because the `TextureStore` now injects the factory at `parse()` time (before `load()` is called), and a static-dep effect would never have fired in that flow. Standalone `TextureResource` usage (`resource.renderer = X`) keeps working because the renderer→factory fallback effect also runs on registration.

#### `Display#nextFrame` is a method, not a promise property

Pure type fix — runtime was always a function. If your code was relying on the (incorrect) `Promise<DisplayEventProps>` declaration and `await`ing the property without calling it, you had a latent runtime bug.

**Before (broken at runtime, allowed by TS)**

```ts
const props = await display.nextFrame; // resolves to the function itself, not a frame!
```

**After**

```ts
const props = await display.nextFrame(); // resolves on the next OnDisplayRenderFrame
```

#### `Display#onDispose` callback receives the `Display`, not `DisplayEventProps`

The `OnDisplayDispose` event has always been emitted with the `Display` instance as its payload (see `IOnDisplayDispose`), but the `onDispose` helper was mistyped to claim it would call your listener with `DisplayEventProps`. If TS let you destructure `{renderer, frameNo, …}` from the argument, that code was relying on runtime-`undefined`s.

**Before**

```ts
display.onDispose(({display, renderer}) => {
  // renderer is undefined at runtime — the emitter passes the Display itself.
});
```

**After**

```ts
display.onDispose((display) => {
  // do cleanup against `display` directly; renderer is on display.renderer
});
```

#### `Chronometer#stop()` / `start()` now track the wall-clock pause-gap

If you were calling `chronometer.stop()` and `chronometer.start()` without `update()` calls during the pause, your `time` and `deltaTime` used to jump on the next `update()` after `start()` (the entire pause was attributed to a single frame). After the fix, the pause-gap is folded into `lostTime` and the next `update()` produces a normal small delta.

For most callers this is purely a bugfix and no code change is needed. If you relied on the old jumping behavior (e.g. for an "elapsed-real-time" counter), use `performance.now()` directly instead.

If you want pause/resume to be anchored to a specific timestamp (for tests, replay, or to stay in lockstep with another clock), pass an explicit `time` argument:

**Before**

```ts
chronometer.stop();  // pausedAt was untracked
chronometer.start(); // pause duration was silently lost
```

**After**

```ts
chronometer.stop(t);   // pausedAt = t
chronometer.start(t2); // lostTime += (t2 - t)
```

#### `Chronometer#start()` resets `deltaTime` to `0`

Previously `start()` left `deltaTime` at its pre-pause value. Now it is `0` until the next `update()` — semantically there has been no active phase since the resume. If you query `chronometer.deltaTime` between `start()` and the next `update()`, you'll now see `0` (was: the last pre-pause delta).

#### `Display.now` no longer jumps on the first frame

`Display.now` (and the `now` field in `OnDisplayRenderFrame` / `OnDisplayStart` event props) now starts at `0` and stays small. Previously it jumped to `performance.now() / 1000` (≈ seconds since page load) on the first frame after `display.start()`. Code that was working around this — e.g. by subtracting the first `now` value to "rebase" the clock — can drop that workaround.

**Before (workaround)**

```ts
let t0: number | null = null;
display.onRenderFrame(({now}) => {
  if (t0 == null) t0 = now;
  const elapsed = now - t0; // rebase against first-frame jump
  // ...
});
```

**After**

```ts
display.onRenderFrame(({now}) => {
  const elapsed = now; // already starts at 0
  // ...
});
```

#### Optional `maxDeltaTime` to clamp frame-spike outliers

New in `Chronometer`. The bare class still defaults to `0` (disabled) so existing direct uses of `Chronometer` are preserved. Set it (in the same unit as your time source — seconds by default) to cap individual `deltaTime` values and fold the overflow into `lostTime`. Useful as a defensive guard against rAF throttling, GC pauses, or debugger breakpoints.

```ts
const c = new Chronometer(undefined, 1 / 30); // cap frame-delta at ~33ms
// or later:
c.maxDeltaTime = 1 / 30;
```

#### `Display` now caps `deltaTime` at `1 / 30` by default

`Display` seeds its internal `Chronometer` with `maxDeltaTime = 1 / 30` (~33ms). Subscribers will no longer see `deltaTime` values larger than that on a single frame — anything beyond is treated as lost time so `display.now` stays continuous. This is the right default for games / animations / physics and matches what most engines do, but it changes observable behavior for callers that consumed the raw "real wall-clock since last frame" value.

**Before**

```ts
display.onRenderFrame(({deltaTime}) => {
  // After a hidden-tab resume or a long GC pause, deltaTime could be
  // several seconds — and your integrator had to deal with it.
});
```

**After (default)**

```ts
display.onRenderFrame(({deltaTime}) => {
  // deltaTime ≤ 1/30; outliers are absorbed by the lost-time accumulator.
});
```

**Opt out (preserve old behavior)**

```ts
display.maxDeltaTime = 0;
```

#### `Display#resizePollIntervalMs` for high-refresh displays

`Display#resize()` runs every frame and forces a layout via `getComputedStyle()` + `getBoundingClientRect()`. On 240Hz monitors that is 240 forced reflows per second and can dominate the frame budget. Default remains `0` (legacy "every frame" behavior); opt in to throttle:

```ts
const display = new Display(canvas);
display.resizePollIntervalMs = 1000 / 60; // measure layout at most ~60Hz
```

The cheap hash-based no-op short-circuit inside `resize()` still applies on every poll, so this only affects the cost of the DOM reads — the renderer is still re-evaluated whenever the size actually changes.

#### Adopting `FixedFrameLoop` for smooth motion on high-refresh displays

Purely additive — existing `display.onRenderFrame(...)` code keeps working unchanged. The opt-in pattern decouples the simulation step (position/physics/animation update) from the render step (interpolation + draw), so the on-screen motion stays smooth even when frame timing varies.

**Before (delta-driven, susceptible to per-frame JS jitter)**

```ts
let x = 0;
display.onRenderFrame(({deltaTime, renderer}) => {
  x += velocity * deltaTime;            // integrated against variable dt
  mesh.position.x = x;
  renderer.render(scene, camera);
});
```

**After (fixed step + interpolation)**

```ts
import {FixedFrameLoop} from '@spearwolf/twopoint5d';

const sim = new FixedFrameLoop(display, {fps: 60});

let prevX = 0;
let currX = 0;

sim.onTick(({fixedDelta}) => {
  prevX = currX;
  currX += velocity * fixedDelta;       // deterministic, fixed step
});

sim.onRender(({alpha, renderer}) => {
  mesh.position.x = prevX + (currX - prevX) * alpha;
  renderer.render(scene, camera);
});
```

The loop subscribes to `Display`'s `OnDisplayRenderFrame` automatically and disposes itself when `Display` disposes. To tear it down earlier (e.g. switching scenes), call `sim.dispose()`.

#### `FrameLoop` `maxFps` cadence is now grid-stable

If you were using `new Display(canvas, {maxFps: N})` with `N` set (e.g. for power-saving on a 60Hz monitor) the emit cadence used to drift slightly with vsync jitter and could miss frames on 120Hz/240Hz monitors. The new rastered schedule keeps emissions on a fixed grid with a 2% jitter tolerance. No code change is required — but if you'd previously dialed `maxFps` to a non-divisor of your refresh rate to dodge the drift, you can now use the natural divisor (e.g. `maxFps: 60` on a 240Hz monitor).

#### `StageRenderer#renderFrame()` renamed to `renderTo()`

`StageRenderer` now implements `IRenderable` along with `IStage`. The render method follows the `IRenderable` contract.

**Before**

```ts
stageRenderer.renderFrame(renderer);
```

**After**

```ts
stageRenderer.renderTo(renderer);
```

#### `StageRenderer` no longer clears when only `clearAlpha = 0` is set

Previously, assigning `clearAlpha = 0` without a `clearColor` implicitly enabled clearing (with the renderer's current color, transparent). With the new explicit `clear` flag this no longer happens — you must opt in.

**Before**

```ts
stageRenderer.clearAlpha = 0; // implicitly cleared with alpha=0
```

**After**

```ts
stageRenderer.setClearColor(null, 0); // explicit transparent clear
// or:
stageRenderer.clear = true;
stageRenderer.clearAlpha = 0;
```

#### `Stage2D` clear properties removed

`Stage2D#clearColor`, `Stage2D#clearAlpha`, and `Stage2D#autoClear` were never read by the renderer pipeline.

**Before**

```ts
const stage = new Stage2D(projection);
stage.clearColor = new Color('#222');
stage.clearAlpha = 1;
stage.autoClear = true;
```

**After (per-stage background)**

```ts
import {Color} from 'three/webgpu';
const stage = new Stage2D(projection);
stage.scene.background = new Color('#222');
```

**After (renderer-level clear, e.g. for the root renderer of a stack)**

```ts
new StageRenderer(display).setClearColor(new Color('#222'), 1).add(stage);
```

#### `StageRenderer#add()` requires `IRenderable`

Any custom stage must now also implement `renderTo(renderer)`. Stages that previously relied on the implicit `scene && camera` path inside `renderStage()` need to expose a `renderTo()` instead:

**Before**

```ts
class MyStage implements IStage {
  name = 'my';
  scene = new Scene();
  camera = new PerspectiveCamera();
  resize() {/* … */}
  updateFrame() {/* … */}
}
```

**After**

```ts
class MyStage implements IStage, IRenderable {
  name = 'my';
  scene = new Scene();
  camera = new PerspectiveCamera();
  resize() {/* … */}
  updateFrame() {/* … */}
  renderTo(renderer: WebGPURenderer) {
    renderer.render(this.scene, this.camera);
  }
}
```

`Stage2D` users do not need to change anything — `Stage2D` ships with `renderTo()`.

#### Driving a `StageRenderer` from `Display`

If you constructed `StageRenderer(display)` **and** subscribed to `OnDisplayRenderFrame` yourself to call `stageRenderer.renderFrame(...)`, you were rendering every frame twice. Pick **one** of the two modes:

**Before (double-driving)**

```ts
const sr = new StageRenderer(display);
on(display, OnDisplayRenderFrame, ({renderer, now, deltaTime, frameNo}) => {
  sr.updateFrame(now, deltaTime, frameNo);
  sr.renderFrame(renderer);
});
```

**After (auto-driven — recommended)**

```ts
const sr = new StageRenderer(display); // updateFrame + renderTo run automatically
```

**After (manual — no `parent`)**

```ts
const sr = new StageRenderer();
on(display, OnDisplayRenderFrame, ({renderer, now, deltaTime, frameNo}) => {
  sr.updateFrame(now, deltaTime, frameNo);
  sr.renderTo(renderer);
});
```

#### Recommended idiom: fluent setup

Not a breaking change (the property-write style still works), but the fluent API documents intent more clearly and reads as one statement.

**Before**

```ts
const sr = new StageRenderer(display);
sr.clearColor = new Color('#90b0d0');
sr.add(stage);
```

**After**

```ts
new StageRenderer(display).setClearColor(new Color('#90b0d0')).add(stage);
```

#### Adopting the new `pipeline` integration

The new `pipeline` integration is purely additive; existing code paths continue to work unchanged. If you were running your own post-pass against the renderer manually, you can fold it into the `StageRenderer`:

**Before (manual pass + render)**

```ts
const sr = new StageRenderer(display).add(stage);
const renderTarget = new RenderTarget(width, height);
const scenePass = pass(stage.scene, stage.camera!);
const pipeline = new RenderPipeline(display.renderer);
pipeline.outputNode = bloom(scenePass);

on(display, OnDisplayRenderFrame, ({renderer}) => {
  renderer.setRenderTarget(renderTarget);
  sr.renderTo(renderer);
  renderer.setRenderTarget(null);
  pipeline.render();
});
```

**After (Mode D via `buildOutputNode`)**

```ts
const sr = new StageRenderer(display).add(stage);
sr.pipeline = new RenderPipeline(display.renderer);
sr.buildOutputNode = ([scenePass]) => bloom(scenePass); // pass is pulled from stage.asPassNode()
```

The renderer manages its own internal `RenderTarget`, sizes it on `resize()` and disposes it with `dispose()`.

#### Intermediate clears between layered stages

If you previously inserted custom rendering steps to clear the depth buffer between world and UI, use `ClearStage` instead.

**Before**

```ts
class _ClearDepth { name = 'cd'; resize(){} updateFrame(){} renderTo(r){ r.clear(false, true, false); } }
root.add(world).add(new _ClearDepth()).add(ui);
```

**After**

```ts
import {ClearStage} from '@spearwolf/twopoint5d';
root.add(world).add(new ClearStage({depth: true})).add(ui); // depth-only is the default
```

See `packages/twopoint5d/src/stage/README.md` for the full layering cheat-sheet.

#### `RootRenderPipeline` shortcut for additive composition

For the most common case — "compose every stage's pass additively as the pipeline output" — use `RootRenderPipeline` instead of `RenderPipeline` and skip `buildOutputNode` entirely.

**Before**

```ts
import {RenderPipeline} from 'three/webgpu';
root.pipeline = new RenderPipeline(display.renderer);
root.buildOutputNode = ([a, b, c]) => a.add(b).add(c); // boilerplate
```

**After**

```ts
import {RootRenderPipeline} from '@spearwolf/twopoint5d';
root.pipeline = new RootRenderPipeline(display.renderer); // additive composition built-in
```

Setting `stageRenderer.buildOutputNode` still overrides the default — use the explicit form when you need a non-additive composition (e.g. `bloom(scenePass)` wrapping a single pass).

#### Composing nested renderers with their own pipeline

Each `StageRenderer` can carry its own pipeline. The outer composition picks them up automatically.

**Before (separate, manually composed)**

```ts
const worldRT = new RenderTarget(w, h);
const worldPipeline = new RenderPipeline(renderer);
worldPipeline.outputNode = bloom(pass(worldScene, worldCamera));
on(display, OnDisplayRenderFrame, ({renderer}) => {
  renderer.setRenderTarget(worldRT);
  worldPipeline.render();
  renderer.setRenderTarget(null);
  // … now blit worldRT.texture as a quad, then render UI on top …
});
```

**After (nested renderers)**

```ts
const root = new StageRenderer(display).setClearColor(new Color('#000'));

const worldRenderer = new StageRenderer(root).add(worldStage);
worldRenderer.pipeline = new RenderPipeline(display.renderer);
worldRenderer.buildOutputNode = ([scene]) => bloom(scene);

root.add(uiStage); // plain on top
```

## [0.20.0] - 2026-05-10

### Added

- add `ChunkQuadTreeNode#clear()`: reset a node back to a fresh empty leaf, dropping every child reference so the subtree becomes GC-eligible — useful for re-builds in tile-streaming scenarios
- add `isDisposed` getter on `VOBufferPool`
- add `dispose()` method to `VOBufferPool` (and the `VertexObjectPool` subclass)
  - releases the underlying typed-array memory eagerly by dropping every reference held in `pool.buffer.buffers` so the `ArrayBuffer`s can be reclaimed by the garbage collector even if downstream `THREE.BufferAttribute`s still hold a transient copy of the array reference — useful for long-running sessions with dynamic pool creation/teardown (e.g. tile streaming)
  - `usedCount` is reset to `0` and `isDisposed` flips to `true`; subsequent `dispose()` calls are no-ops (idempotent)
  - the `VertexObjectPool` override additionally invokes `onDestroyVO` for every still-alive vertex object, unlinks the buffer reference from each tracked VO and drops the internal VO index — VOs that survived earlier `freeVO()` swaps are unlinked too
- add `options.autoDispose` parameter to `InstancedVOBufferGeometry#attachInstancedPool(name, pool, options?)`
  - defaults to `true` — the attached pool is cleared together with the geometry on `dispose()`
  - set to `false` for pools that are shared with other geometries or otherwise managed by the caller
- add JSDoc for the `Display` resize model and the resize-related public API
- add `Display` resize browser tests in `@spearwolf/twopoint5d-testing`
- add ~40 unit tests for `ChunkQuadTreeNode` covering `clear()`, `findChunksAt()` happy paths + missing-quadrant tolerance, the `findChunks(aabb, out)` signature, axis-straddler routing, idempotency of `subdivide()`, the no-axis-splittable bail-out, and a 1k-chunk subdivide stress smoke
- add `AABB2#isInsideAABB` regression tests for asymmetric containers (x/y-swap reproducer)
- add unit-test suite `CameraBasedVisibility.spec.ts` covering visibility classification (create / reuse / remove), dependency-based caching, parallel-camera edge cases, distance-sorted `visibles`, helper contract (`frustumBox` / `box` / `centerWorld` / `map2dTile`), `offset` / `translate` outputs, and a low-GC regression check that the pooled `TileBox` instances are reused across non-cached calls
- add unit tests covering `dispose()` for both `VOBufferPool` and `VertexObjectPool`: idempotency, typed-array release, used-count reset, `onDestroyVO` fan-out (incl. interaction with `freeVO()`), buffer-reference unlinking, and the no-VOs-alive case
- add unit tests for `AnimatedSpritesMaterial` covering construction and the full `dispose()` contract (texture release, no-op on missing `animsMap`, ordering vs. `NodeMaterial#dispose`, signal/effect leak check, idempotent double-dispose)

### Changed

- simplify `AABB2#isNorthWest()` / `isNorthEast()` / `isSouthEast()` / `isSouthWest()` — drop redundant OR clauses, semantics unchanged (all 52 existing quadrant assertions still pass)
- perf `ChunkQuadTreeNode#subdivide()`: O(n²) → O(n × unique-origins) per level — single-pass min instead of `map`/`filter`/`sort`, dedup adjacent origin candidates, eliminate the per-call `Function.prototype.bind`, partition straight into four bucket arrays + straddler list (one pass over chunks, no transient `appendChunk()` round-trip), child nodes take ownership of their bucket arrays without a copy
- perf `ChunkQuadTreeNode#findChunks(aabb, out?)`: optional caller-supplied output array — avoids the per-recursion `Array#concat` allocation chain in hot paths (per-frame visibility queries); chunks are pushed in place
- typecheck `ChunkQuadTreeNode`: `originX`/`originY` and `nodes.{north,south}{East,West}` now correctly typed as `number | null` / `ChunkQuadTreeNode | null` (previously `@ts-ignore`'d to `number` / non-null) — V8 hidden-class stays stable from construction
- perf `CameraBasedVisibility#computeVisibleTiles()`: reduce per-frame GC pressure
  - pool `TileBox` slots (and their `Box3` / `Vector3` / `Map2DTileCoords` shells) by tile id, mutate them in place across frames
  - replace the per-frame `previousTiles.slice(0)` + linear `findIndex` / `splice` (O(n²)) with an id-keyed `Map` lookup (O(n))
  - reuse the `visitedIds` `Set`, the BFS stack, and the `Vector3` / `Vector2` / `Line3` scratch instances instead of reallocating each frame
  - hoist the 8-neighbour offsets to a module constant and walk them with a `for` loop (no per-tile `forEach` callbacks)
  - sort `visibles` once with `Array.sort` instead of a quadratic sorted-insert loop
- upgrade dependencies
  - `@spearwolf/eventize@4.3.1`
  - `@spearwolf/signalize@0.28.0`

### Removed

- remove dummy `number-or-the-beast.test.js` from `@spearwolf/twopoint5d-testing`

### Fixed

- fix `AABB2#isInsideAABB()`: corner-coordinate test no longer swaps x/y — previously an inner aabb whose `top` exceeded the container's width (or whose `left` exceeded the container's height) was reported as outside even when fully contained
- fix `ChunkQuadTreeNode#findChunksAt()`: leaf-guard added — previously every call against a subdivided tree (or a non-subdivided leaf) crashed with a null deref as soon as the recursion descended into a child leaf
- fix `ChunkQuadTreeNode` axis heuristic (`scoreAxis`/`findAxis`): drop the bogus per-call `beforeChunks`/`intersectChunks`/`afterChunks` arrays (chunks were pushed but the entries were the outer chunk argument, not the iterated chunk — the lists were never read but were a latent bug); replace with three integer counters
- fix `Display`: `OnDisplayResize` now fires exactly once per frame (previously double-emitted on the first frame when the constructor measurement and the first-frame measurement differed)
- fix `InstancedVOBufferGeometry#dispose()`: extra instanced pools attached via `attachInstancedPool()` are now actually cleared, and the `extraInstancedBuffers` / `extraInstancedBufferSerials` bookkeeping maps are emptied
- fix `AnimatedSpritesMaterial#dispose()` order: the `animsMap` texture is now released, reset and its signal handle destroyed _before_ `super.dispose()` tears down the `SignalGroup` attached to the material — previously the cleanup relied on signalize's "destroyed signal still returns last value" lenience

### Migration Guide

#### `InstancedVOBufferGeometry#attachInstancedPool()` now disposes attached pools by default

Pools attached via `attachInstancedPool()` are now cleared together with the geometry when `dispose()` is called (previously they leaked — see the `### Fixed` entry above). If a pool is shared with other geometries or otherwise managed by the caller, opt out via `autoDispose: false`.

**Before**

```ts
geom.attachInstancedPool('foo', sharedPool);
geom.dispose(); // sharedPool was leaked
```

**After**

```ts
// shared pool — keep it alive past geom.dispose()
geom.attachInstancedPool('foo', sharedPool, {autoDispose: false});

// owned pool — dispose() will clear it (new default)
geom.attachInstancedPool('bar', ownedPool);
```

## [0.19.0] - 2026-02-27

- upgrade dependencies to `three@0.183.1`

## [0.18.5] - 2026-01-12

- delegate renderer to texture ressources in `TextureStore` on change

## [0.18.4] - 2026-01-08

- refactor TextureStore#dispose() to use SignalGroup#clear() and clear renderer reference

## [0.18.3] - 2026-01-08

- revert back to `three@0.181.2` due to _undefined_ `GPUShaderStage` issues with `three/webgpu` in `0.182.0`
  - see https://github.com/mrdoob/three.js/issues/32529

## [0.18.2] - 2026-01-06

- fix `TextureStore` type mappings for tuple destructuring in `.on()` and `.get()` methods
  - tuple types are now properly preserved instead of being flattened to union types
  - callbacks with destructured parameters now receive correctly typed values
  - added `MapTuple` helper type for recursive tuple mapping
  - applied `const` type parameter modifier to prevent array literal widening

## [0.18.1] - 2026-01-05

- fix import `Camera` as _type_ issue in `Stage2D`

## [0.18.0] - 2026-01-05

- improve type safety in `TextureStore`
  - replace `any` type with mapped types in `.on()` and `.get()` methods
  - add `TextureResourceSubTypeMap` type mapping each `TextureResourceSubType` to its corresponding TypeScript type
  - callbacks now receive properly typed values based on the requested resource type
- fix initial geometry update issue (`instanceCount` is _Infinity_ error) for `TileSprites` managed by a `TileSpritesFactory`
- upgrade dependencies
  - three@0.182.0
  - @spearwolf/signalize@0.25.0

## [0.17.0] - 2025-11-25

- add `frameRate` (fps) option as alternative to `duration` in `FrameBasedAnimations`
  - the `add()` method now accepts either a `duration` number or an `AnimationTimingOptions` object with `frameRate` or `duration`
  - when using `frameRate`, the duration is automatically calculated as `frameCount / frameRate`
  - added validation to ensure `frameRate` is greater than 0
  - updated `TextureResource` to support `frameRate` in declarative animation configuration
- add `anchorPosition` support to `fitIntoRectangle`
  - new types: `AnchorPosition`, `AnchorPositionX`, `AnchorPositionY`
  - new function: `parseAnchorPosition()` - parses anchor position strings into [y, x] components
  - new function: `calculateAnchorOffset()` - computes view offset based on container/view size difference and anchor position
  - updated `FitIntoRectangleSpecs` type to include optional `anchorPosition` property

## [0.16.0] - 2025-11-24

- add `resize(capacity: number): void` method to `VertexObjectPool`
  - enables dynamic capacity adjustment while preserving existing vertex objects
  - validates input: rejects negative or non-integer capacities
  - updates internal buffer references in existing vertex objects
  - adjusts `usedCount` to not exceed the new capacity
- improve `TextureSprites`and `AnimatedSprites`
  - enhance typscript definitions for better type safety and developer experience
  - add `.dispose()` method to free up resources when no longer needed
- enhance `TextureStore` error handling
  - improve error messages for better debugging and user feedback

## [0.15.0] - 2025-11-21

- improve `TextureStore`
  - load and create _frameBasedAnimations_ from _json_
  - The _textureStore_ now also supports the _atlas_ type when creating a _tileSet_.
  - The `textureStore.get()` method has been renamed to `.on()` and a new implementation of `.get()` (which replaces the old one) has been added. The new `.get()` method behaves exactly like `.on()` but returns a promise once.
  - add `.dispose()` method
  - fix an issue that prevented the _textureFactory_ from being created when the _renderer_ property was set very early on
- clean up _events.js_
  - remove obsolete `StageRenderFrameProps` interface

## [0.14.0] - 2025-11-19

- refactor all 'three' imports: use only 'three/webgpu'
- remove obsolete classes:
  - `CustomChunksShaderMaterial`
  - `ShaderLib`
  - `ShaderTool`

## [0.13.0] - 2025-11-18

> [!CAUTION]
> This version breaks with many things and clearly moves towards the use of WebGL2 and WebGPU!
>
> This follows the three.js library, which currently comes in two variants:
> `import THREE from 'three'` _vs._ `import THREE from 'three/webgpu'`
>
> Starting with version `0.13`, `twopoint5d` is freeing itself from legacy issues and moving completely to the `three/webgpu` side!
>
> The new _node materials_ and the _three shader language_ are exactly what was envisioned when `@spearwolf/twopoint5d` was created.
> Instead of getting lost in custom workarounds that use the old materials and shaders, we have now switched exclusively and consistently to _tsl_.

- only use the `three/webgpu` package as import
- upgrade to three.js r181
- refactor `Display` &rarr; `resize`, `renderFrame` events
  - add types, constants and interfaces for `OnDisplayResize` and `OnDisplayRenderFrame`
  - _MIGRATION NOTE:_ the `frame` event has been renamed to `renderFrame`
  - add new helpers:
    - `display.onResize(callback)`
    - `display.onRenderFrame(callback)`
    - `display.onInit(callback)`
    - `display.onStart(callback)`
    - `display.onPause(callback)`
    - `display.onRestart(callback)`
    - `display.onDispose(callback)`
- the types and constants from `/events.js` are now included in the main module
  - _MIGRATION NOTE:_ the import of `@spearwolf/twopoint5d/events.js` is no longer supported. just use `@spearwolf/twopoint5d` instead.
- _MIGRATION NOTE:_ renamed `DisplayEventArgs` to `DisplayEventProps`
- _MIGRATION NOTE:_ dropped `OnResizeProps` and `OnRenderFrameProps`. the only truth is `DisplayEventProps`
- add new constants and types: `OnDisplayInit`, `OnDisplayStart`, `OntDisplayRestart`, `OnDisplayPause` and `OnDisplayDispose`
- The `VertexObjects` mesh is calling `.update()` in the constructor now
  - To avoid disappointment if the vertex object geometry was not manually updated initially.


## [0.12.0] - 2025-05-10

- refactor `IStage`, `PostProcessingRenderer`, add `Stage2DRenderPass`

&mldr;

## [0.11.0] - 2025-04-26

- remove auto creation of `WebGPURenderer` in `Display` when using `webgpu: true`
  - to avoid confusion with `three`and `three/webgpu` imports when using resolve aliases
  - you can still pass `renderer: new WebGPURenderer()` to the `Display` constructor (no need to pass `webgpu: true` in this case)
- convert last `three/examples/jsm` import to `three/addons`
- deactivate some hook tests in twopoint5d-r3f
  - time to ditch react-three-fiber support
    - the maintainance cost is too high

## [0.9.3] - 2025-03-26

- upgrade to `@spearwolf/signalize@0.20.1`

## [0.9.2] - 2025-03-26

- fix `PostProcessingRenderer` resize issues

## [0.9.1] - 2025-03-25

- fix _renderOrder_ '*' behavior

## [0.9.0] - 2025-03-25

- add _renderOrder_ feature to `StageRenderer` and `PostProcessingRenderer`
- the `IStage` interface have a _name_ property now

## [0.7.0] - 2024-01-09

### Added

- The `Display` class now supports the _optional_ `webgpu: true` parameter
  - If enabled, the new `WebGPURenderer` from `three/gpu` is used
  - The default is still the good old `THREE.WebGLRenderer`


## [0.6.0] - 2024-01-08

### Changed

- Use default dependencies instead of peer dependencies


## [0.5.0] - 2024-01-08

### Changed

- Upgrade dependencies
  - three@0.172.0
  - @spearwolf/eventize@4.0.1
  - @spearwolf/signalize@0.18.1
