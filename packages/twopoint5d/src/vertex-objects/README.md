# Vertex objects

What a vertex object description declares, which accessors it generates, and how two of
them make an instanced mesh such as `FeatureSprites`. The layers of the module and the
rules for its classes are in [the library
architecture](../../docs/architecture.md#vertex-objects--the-performance-core).

---

## What a vertex object is

A vertex object is a plain JavaScript object — a quad, a cross, a sprite — whose
properties read and write a slice of a typed array that it shares with every other object
of its pool. `sprite.width = 32` is no field on the object: the setter writes the value
into the buffer the geometry hands to the GPU. A pool of ten thousand sprites is one set
of buffers and one draw call.

The shape of those objects comes from a _vertex object description_: how many vertices
one object has, in which order they are drawn, and which attributes each vertex carries.
A `VertexObjectDescriptor` checks the description once, and every pool and geometry built
from it hands out objects with the accessors it generates.

## The keys of a description

```ts
interface VertexObjectDescription {
  vertexCount?: number;
  indices?: number[];
  attributes: Record<string, VertexAttributeDescription>;
  basePrototype?: object | null;
  methods?: object | null;
}
```

- **`vertexCount`** — how many vertices one object is made of. Defaults to `1`.
- **`indices`** — the draw order of the vertices of one object, as indices into its own
  vertices, `0` … `vertexCount - 1`. Every object of a pool is drawn by this one list; the
  geometry repeats it per object with the offsets applied.
- **`attributes`** — the attributes of each vertex, keyed by the name the geometry and
  the shaders give them. Each attribute states its size in one of two ways:
  - `components: ['x', 'y', 'z']` — one name per value, and each name becomes a property;
  - `size: 4` — a number of values that need no names of their own.

  The options an attribute takes besides its size:
  - `type` — the element type of the buffer, named as its typed array: `'float32'` (the
    default), `'float16'`, `'uint8'`, `'int16'` and the rest of `VertexAttributeDataType`
    that WebGPU has a vertex format for.
  - `usage` — how often the values change: `'static'` (the default), `'dynamic'` or
    `'stream'`. It becomes the draw usage of the buffer.
  - `autoTouch` — whether every `update()` uploads the buffer of the attribute, changed
    or not. `false` for a `'static'` attribute, `true` for the other two, unless the
    description says otherwise.
  - `setter` and `getter` — the names of the two methods that write and read every value
    of the attribute at once. Without the key they are `set` and `get` plus the name of
    the attribute in PascalCase; a string names them, `false` leaves the method out.
  - `normalized` and `bufferName` — for 8- and 16-bit integers the GPU maps onto
    `0` … `1` (`-1` … `1` when signed), and for grouping attributes into one interleaved
    buffer. The TSDoc of `VADescription` has the rules.
- **`basePrototype`** — the prototype the generated accessors are placed on. Methods of
  your own go on it, as `make()` on `QuadBase`. A name on it that an accessor would take
  is refused: the descriptor throws rather than let the accessor shadow it. A method
  under the exported symbol `voInitialize` fills every slot `createVO()` hands out.
- **`methods`** — functions that become properties of every vertex object, keyed by
  their name there. Anything that is not a function is ignored.

## The accessors a description generates

| The attribute | Properties | Methods |
| --- | --- | --- |
| `position: {components: ['x', 'y', 'z']}` with `vertexCount: 4` | `x0` … `x3`, `y0` … `y3`, `z0` … `z3` — one per component and vertex | `setPosition()`, `getPosition()` |
| `instancePosition: {components: ['x', 'y', 'z']}` with `vertexCount: 1` | `x`, `y`, `z` — no index on a single vertex | `setInstancePosition()`, `getInstancePosition()` |
| `uv: {size: 2}` with `vertexCount: 4` | none — `size` names no values | `setUv()`, `getUv()` |
| `rotation: {size: 1}` with `vertexCount: 1` | `rotation` — the name of the attribute | none |

An attribute of a single value on a single vertex becomes a property under its own name,
and gets no setter and no getter. Every other attribute gets both, under the names of
`setter` and `getter`, and a property per component when it names components.
The `Tint` sprite feature names the setter of `color` `setColorValues` and turns its
getter off.

The setter takes every value of the attribute, vertex by vertex, as separate arguments or
as one array: `setPosition(x0, y0, z0, x1, y1, z1, …)` or `setPosition([x0, y0, z0, …])`.
Fewer values leave the rest as it was. The getter answers a new typed array, or fills the
array it is handed and answers that one — the form for a loop that runs every frame.

A generated setter marks nothing for upload. What is written before the first `update()`
after `createVO()` reaches the GPU with it; a later change to a `'static'` attribute needs
`pool.touchVO(vo, 'attr')` for that object or `geometry.touch('attr')` for all of them.
An attribute with `autoTouch` uploads on every `update()`.

## A quad, step by step

A quad is four vertices and two triangles. The vertices go around the square:

```
             ^(y)
             |
        B''''|''''C
        .    |    .
        .    #--------->(x)
        .   /     .
        A../......D
          /
      (z)v
```

`indices: [0, 2, 1, 0, 3, 2]` draws A-C-B and A-D-C, both counter-clockwise, as three.js
expects a front face:

```
  (1)<---(2)
        ^
       /
      /
  (0)

         (2)
          ^
          |
          |
  (0)--->(3)
```

With one `position` attribute of three components, each quad gets `x0` … `z3` and
`setPosition()`. The interface lists what the description generates, so TypeScript knows
it too:

```ts check
import {VertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
import type {VertexObjectDescription, VO, VOAttrSetter} from '@spearwolf/twopoint5d';
import {MeshBasicNodeMaterial} from 'three/webgpu';

interface Quad extends VO {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  x3: number;
  y3: number;
  z3: number;
  setPosition: VOAttrSetter;
}

const QuadDescription: VertexObjectDescription = {
  vertexCount: 4,
  indices: [0, 2, 1, 0, 3, 2],
  attributes: {
    position: {components: ['x', 'y', 'z']},
  },
};

// a pool with room for 100 quads, and a geometry that hands it to three.js
const geometry = new VertexObjectGeometry<Quad>(QuadDescription, 100);

// createVO() answers undefined once the pool is full
const quad = geometry.pool.createVO();
if (quad) {
  // A, B, C and D, three values each
  quad.setPosition([-1, -1, 0, -1, 1, 0, 1, 1, 0, 1, -1, 0]);
  // one component of one vertex: C moves up
  quad.y2 = 2;
}

const mesh = new VertexObjects(geometry, new MeshBasicNodeMaterial());
mesh.update();
```

## Instanced: one quad, many objects

A thousand sprites do not need a thousand copies of the same four corners. An instanced
geometry takes two descriptions:

- a **base** description, per vertex — the quad, drawn once;
- an **instance** description, per object — with `vertexCount` 1, so its components have
  no index: `width`, `height`, `x`, `y`, `z`, `rotation`.

```ts
const geometry = new InstancedVertexObjectGeometry<Sprite, BaseQuad>(
  SpriteDescription, // instanced
  1000, // capacity: how many objects
  BaseQuadDescription, // base
);

geometry.basePool!.createVO()!.make(); // the one quad
const sprite = geometry.instancedPool.createVO(); // one of the thousand
```

`basePool` holds the base objects — one, unless a base capacity follows the base
description — and `instancedPool` the objects the scene is made of. The GPU draws the
base quad once per object in use, with the values of that object.

`FeatureSprites` is exactly this pair. Its geometry puts the description of `QuadBase` — four
vertices with `position` and `uv` — under the merged description of its kind, which gives each
sprite `quadSize` (`width`, `height`), `texCoords`, `texFlipDiagonal`, `texTrim`,
`instancePosition` (`x`, `y`, `z`), `rotation` and `color`. Both descriptions are
exported, `QuadBase.description` and `TexturedSpriteKind.description` for the textured
sprites. The sprite of the `first-sprite` demo is one instance of it: `setSize()` writes
`width` and `height`, `setFrame()` the `texCoords`, `texFlipDiagonal` and `texTrim` of a
frame.

## Sorting a pool

A pool draws its objects in the order of their slots, and nobody chose that order: `createVO()`
appends, `freeVO()` moves the last object into the slot it frees. Where the order matters —
transparent objects drawn back to front, sprites sorted by `y` — `sortBy()` puts the slots in use
into the order of a key:

```ts check
import {VertexObjectPool} from '@spearwolf/twopoint5d';
import type {VertexObjectDescription, VO} from '@spearwolf/twopoint5d';

interface Ball extends VO {
  x: number;
  y: number;
  z: number;
  layer: number;
}

const BallDescription: VertexObjectDescription = {
  attributes: {
    position: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    layer: {size: 1},
  },
};

const pool = new VertexObjectPool<Ball>(BallDescription, 500);
for (let i = 0; i < 500; i++) {
  const ball = pool.createVO();
  if (ball) ball.y = Math.random();
}

pool.sortBy('y'); // by a value property, the lowest first
pool.sortBy('y', {descending: true}); // the highest first
pool.sortBy((ball) => ball.layer * 1000 + ball.z); // by a key function

const keys = new Float64Array(pool.capacity);
for (let i = 0; i < pool.usedCount; i++) keys[i] = pool.getVO(i)!.x;
pool.sortByKeys(keys); // keys[i] is the key of slot i
```

- **The key.** The name of a value property — an attribute of one value under its own name, or a
  component property (`y`, `x0`) — is read straight from the buffer, and no value crosses a call.
  The name is typed by the number properties of the vertex object type (`VOSortKeyName`), so a
  misspelt one does not compile; on a pool without a vertex object type any string compiles, and
  the sort refuses an unknown one with the names there are.
  A key function is called once per slot in use before anything moves, and must not create or free
  objects of the pool; a fractional key it answers, or a `-0`, may cost a heap number of 16 B per
  call where V8 does not inline it. `sortByKeys()` takes keys worked out in bulk, `keys[i]` for slot
  `i`.
- **The order** is stable — equal keys keep their slot order, so a sort every frame never swaps two
  objects of the same key back and forth — and ascending unless `descending`; a `NaN` key goes last
  either way, behind the infinities too.
- **What moves.** Every buffer, as whole objects; every object keeps its values and stays the same
  object, its index following its slot. `getVO(i)` answers the object now in slot `i`, and an index
  read before the sort is stale — read it afresh. The index buffer of a geometry depends on the
  slots alone and stays as it is.
- **The upload.** The slots from the first to the last that changed are marked in every buffer,
  static ones included. A pool sorted every frame whose order changes uploads about everything every
  frame; one whose order holds uploads nothing for the sort. `sortBy()` answers whether a slot
  moved.
- **One pool.** A pool attached to an instanced geometry with `attachInstancedPool()` pairs its
  slots with those of the instanced pool by index. Sorting one alone breaks the pairing: work the
  keys out once and hand the same array to `sortByKeys()` of both.
- The first sort allocates the scratch of the pool (keys, order, one copy of the largest buffer);
  every later one allocates nothing, and the scratch grows only with the capacity.

## Growing a pool

`resize()` refuses a pool behind a geometry: three sizes the gpu buffers of an attribute once. A
pool that has to grow there goes into a new geometry instead — a pool of the larger capacity on
**the same descriptor**, which adopts the vertex objects of the old one:

```ts check
import {VertexObjectGeometry, VertexObjectPool, VertexObjects} from '@spearwolf/twopoint5d';
import type {VertexObjectDescription, VO} from '@spearwolf/twopoint5d';
import {PointsNodeMaterial} from 'three/webgpu';

interface Dot extends VO {
  x: number;
  y: number;
  z: number;
}

const DotDescription: VertexObjectDescription = {vertexCount: 1, attributes: {position: {components: ['x', 'y', 'z']}}};

let pool = new VertexObjectPool<Dot>(DotDescription, 16);
const dots = new VertexObjects(new VertexObjectGeometry(pool, 16), new PointsNodeMaterial());

function createDot(): Dot | undefined {
  const dot = pool.createVO();
  if (dot !== undefined) return dot;
  const old = {pool, geometry: dots.geometry};
  pool = new VertexObjectPool<Dot>(old.pool.descriptor, 2 * old.pool.capacity);
  pool.adoptVOs(old.pool); // every slot, every value, every handle, and the onCreateVO hook
  dots.geometry = new VertexObjectGeometry(pool, pool.capacity);
  old.geometry?.dispose();
  old.pool.dispose(); // handed to the geometry, so it is ours to release; it holds no handle any more
  return pool.createVO();
}

createDot();
```

- **What moves.** Every buffer, copied whole and marked for upload; `usedCount`; every vertex
  object, which keeps its identity, its values and its slot and reads and writes the new buffer;
  the `onCreateVO` hook, when the new pool has none of its own — the old pool keeps its hook.
  A slot without a vertex object yet stays without one, and `getVO()` materializes it in the new
  pool.
- **The old pool** is left empty, its data where it was: no vertex object is linked to it, so its
  `dispose()` unlinks none. It stays usable: a later `createVO()` hands out its own slots, and it
  can adopt again — the vertex objects of the new pool included, back and forth.
- **Refused**, before anything moves: a disposed pool on either side, the pool itself, a source on
  another descriptor (`new VertexObjectPool(source.descriptor, …)` is the fix), a pool with
  objects in use and one of a smaller capacity than the source.
- `FeatureSprites` does all of it for `grow: true`, see `docs/sprites.md`, "FeatureSprites".

## Further

- The lookbook demos, from the smallest up:
  - `first-sprite` — one sprite of `FeatureSprites` with `TexturedSpriteKind`:
    [`first-sprite.astro`](../../../../apps/lookbook/src/pages/demos/first-sprite.astro)
  - `crosses` — a description of its own, a cross of twelve vertices:
    [`Crosses.ts`](../../../../apps/lookbook/src/demos/crosses/Crosses.ts)
  - `instanced-quads` — the base and instance pair of this page, twenty thousand times:
    [`InstancedQuadsGeometry.ts`](../../../../apps/lookbook/src/demos/instanced-quads/InstancedQuadsGeometry.ts)
    and
    [`instanced-quads.astro`](../../../../apps/lookbook/src/pages/demos/instanced-quads.astro)
  - `textured-quads` — the same geometry with texture coordinates:
    [`textured-quads.astro`](../../../../apps/lookbook/src/pages/demos/textured-quads.astro)
- [Resource lifecycle](../../docs/resource-lifecycle.md) — what `dispose()` of a pool, a
  geometry and a mesh releases, and what stays yours.
