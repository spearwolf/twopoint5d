# Proposal: GPU picking — which sprite is under the pointer

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Picking: which sprite is under
the pointer" and "Performance", and the browser proofs in
`packages/twopoint5d-testing/test/sprites-picking.test.js`. Deviations:

- the list is typed `readonly FeatureSprites<any>[]`, not `FeatureSprites<object>[]`: `FeatureSprites`
  is invariant in its handle type — the `onCreateVO` hook of its pool takes one —, so a mesh of a
  kind is no `FeatureSprites<object>` (§2);
- the picker's camera takes the coordinate system of the renderer before every pick; the reversed
  depth it leaves to the renderer, which marks it and calls its `updateProjectionMatrix()` — a no-op
  there, the projection is the one handed in (§3.3);
- a drawing buffer of no pixels counts as one pixel, so the matrix of §3.3 stays finite (§3.3).

Phase F, part 3, of [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) (§4.10, the
card "sprite picking ?"), and the answer to the open point of [`pool-sorting.md`](pool-sorting.md)
and [`growing-capacity.md`](growing-capacity.md) for picking: a picked id names a slot, and slots
move. `FeatureSprites` places its vertices in the shader, so three's raycaster sees four vertices at
the origin; a hit test on the CPU would have to replay every stage of every feature, the features of
a user included. The GPU knows where every sprite lands, and with its alpha which of its texels are
there at all.

## 1. Goal

| who | what they get | § |
| --- | --- | --- |
| a game — a click that hits an enemy, hover over an item, a drag | `await picker.pick(camera, pointer, [enemies, items])` → the mesh, the handle and its slot, or `undefined` | 2 |
| every kind, the user's own features included | picking by the sprite's own graph: rotated, sheared, trimmed, billboarded, animated, faded — whatever the stages do | 3 |
| sorted and growing meshes | the handle as it was drawn, resolved before a sort, a `freeSprite()` or a growth can move its slot | 4 |

## 2. API

```ts
/** What {@link SpritePicker#pick} found under the pointer. */
export interface SpritePick<Api extends object = object> {
  /** The mesh the sprite belongs to — one of those handed to `pick()`. */
  readonly sprites: FeatureSprites<Api>;
  /** The handle of the sprite. */
  readonly sprite: Api & VO;
  /** The slot the sprite was drawn from; a sort, a `freeSprite()` may have moved it since — the handle stays right. */
  readonly index: number;
}

/** The pick of one of the meshes `S` — a union over a list of meshes of several kinds. */
export type SpritePickOf<S> = S extends FeatureSprites<infer Api> ? SpritePick<Api> : never;

/** A point of the view in normalized device coordinates: x and y from -1 to 1, y up. */
export interface PickPointer {
  readonly x: number;
  readonly y: number;
}

export class SpritePicker {
  /** The renderer it draws with; it stays the caller's. */
  readonly renderer: Renderer;

  constructor(renderer: Renderer);

  /**
   * Draws `sprites` as `camera` sees them into one pixel under `pointer` and answers the sprite
   * nearest to the camera there, or `undefined`.
   */
  pick<const S extends readonly FeatureSprites<any>[]>(
    camera: Camera,
    pointer: PickPointer,
    sprites: S,
  ): Promise<SpritePickOf<S[number]> | undefined>;

  /** `true` once {@link dispose} has run. */
  get isDisposed(): boolean;

  /** Releases the render target and every pick material; rejects every pick still in flight. */
  dispose(): void;
}
```

`Renderer` is three's common renderer, which `WebGPURenderer` is under either backend. The roadmap
sketch named the result `{sprites, sprite, index}`; that holds. It also suggested a frame number to
check the result for staleness; §4 makes the check unnecessary.

Usage:

```ts
const picker = new SpritePicker(renderer);

canvas.addEventListener('pointerdown', async (event) => {
  const rect = canvas.getBoundingClientRect();
  const pointer = {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
  };
  const hit = await picker.pick(camera, pointer, [enemies, items]);
  if (hit?.sprites === enemies) hit.sprite.setFlash(1, 1, 1, 1);
});
```

## 3. How it draws

### 3.1 The pick material

One per listed mesh, built at its first pick and kept until the mesh or the picker is disposed:

- a `FeatureSpritesMaterial` of the kind of the mesh, **on the `SpriteResources` of the mesh's
  material** — the same uniforms and textures, so a `setUniform()`, `setTexture()` or bound uniform
  reaches the pick as it reaches the sprites —, with the mesh's current placement. The position graph,
  the frame, the uv stages, the color source and every color stage are the sprite's own: the alpha
  that reaches the alpha test is the sprite's alpha, `Fade`, `Tint` and all.
- **Then the id.** three's `outputNode` takes the place of the fragment's output after the color
  node, the opacity and the alpha test have run (`NodeMaterial#setup()`, three 0.186.1): a fragment
  the alpha test drops is dropped here too, and what survives writes
  `vec4(instanceIndex + 1, meshNumber, 0, 1)`. Nothing after it — no color stage, no `ColorOrder.Pass`
  stage, no fog, no premultiplied alpha — can change the id. `instanceIndex` reaches the fragment
  stage through a flat varying (three makes an integer varying flat under both backends);
  `meshNumber` is a float uniform of the pick material, written before each pick: the place of the
  mesh in the list, from 1.
- `blending: NoBlending`, `transparent: false`, `depthTest: true`, `depthWrite: true`: the nearest
  fragment wins, whatever the sprite's material blends or writes.
- Copied from the sprite's material before every pick, since they decide which fragments a sprite
  draws: `side`, `alphaTest`, `alphaTestNode`, `opacity`, `opacityNode`, `maskNode`, `alphaHash`,
  `alphaToCoverage`. A change sets `needsUpdate`.
- **Rebuilt on placement swap**: a mesh whose `placement` differs from the one of its pick material
  sets it there (`FeatureSpritesMaterial#placement`, which rebuilds the position graph alone). A mesh
  whose material reads other resources than the pick material — a `material` swapped on the mesh —
  gets a new pick material.

The roadmap sketch says "cached per kind". The resources — textures, uniforms — belong to a mesh,
not to a kind: two meshes of one kind draw from different atlases. So the cache is per mesh.

Only the sprites themselves are drawn, not their passes: a shadow or a reflection is no sprite to
hit.

### 3.2 The pick mesh and the scene

Per listed mesh a `Mesh` over the geometry of the sprites with the pick material, held with it, in
a `Scene` of the picker's own. Before every pick it takes from the sprites: the geometry (a growth
replaces it — three follows a geometry of another id, as it does for the sprites), the world matrix
(after `updateWorldMatrix(true, false)` of the sprites), `layers` and `renderOrder`.
`matrixAutoUpdate` and `matrixWorldAutoUpdate` are off on the mesh and the scene, so three does not
compute the matrix a second time.

A listed mesh is **left out** when it is disposed, when it or one of its ancestors is not `visible`,
and when its pool holds no sprite. A mesh listed twice is drawn once, at its first place. Nothing
left to draw answers `undefined` without a draw.

### 3.3 The pixel under the pointer

A camera of the picker's own (a three `Camera`) draws one pixel:

- **world and view**: `matrixWorld` and `matrixWorldInverse` of `camera`, refreshed first with
  `camera.updateWorldMatrix(true, false)` (which refreshes the inverse of a camera), and its
  `layers`. A billboard turns to the picker's camera as it turns to `camera`: the position and the
  axes of the camera are the same.
- **projection**: the projection of `camera` times a matrix that blows the pixel under the pointer
  up to the whole of the one-pixel target. With the drawing buffer of the renderer `W × H` pixels
  (`getDrawingBufferSize()`), the pointer lies in the pixel `i = ⌊(x + 1)/2 · W⌋`, `j = ⌊(y + 1)/2 ·
  H⌋` (clamped to `W − 1`, `H − 1`; a buffer of no pixels counts as one), whose centre is
  `cx = (i + ½)/W · 2 − 1`, `cy = (j + ½)/H · 2 − 1`. Then

  ```
  P' = | W  0  0  −W·cx |
       | 0  H  0  −H·cy | · P
       | 0  0  1   0    |
       | 0  0  0   1    |
  ```

  maps the pixel `(i, j)` onto the clip space of the target, its centre onto the centre of the one
  pixel: the fragment is evaluated where the screen evaluates the fragment of that pixel, and a
  derivative across it — the mip level of a texture — is the derivative across a screen pixel.
  Perspective and orthographic cameras alike; the depth rows stay as they are.
- `camera` is prepared as the renderer prepares it before it draws: a camera of another coordinate
  system than the renderer, or without reversed depth under a renderer with a reversed depth buffer,
  is switched and its `updateProjectionMatrix()` called — what the next `render()` would do anyway.
  The picker's camera takes the `coordinateSystem` of the renderer; under a reversed depth buffer the
  renderer marks it reversed and calls its `updateProjectionMatrix()`, which does nothing — the
  projection is the one handed in, reversed already.
- A pointer outside `[-1, 1]²` answers `undefined` without a draw. The pointer is a point of the view
  of `camera`; the snapping uses the drawing buffer of the renderer — for a camera that draws a part
  of the canvas (a viewport of its own) the snapping is off by less than a pixel.

### 3.4 The target

A `RenderTarget` of 1 × 1, `FloatType`, RGBA, with a depth buffer, built at the first pick. **Float,
not integer**: three 0.186.1 renders into an integer target under WebGPU (`getOutputType()` answers
`uvec4` for `UnsignedIntType`), but its WebGL 2 backend reads none back —
`WebGLTextureUtils#_getBytesPerTexel()` knows `RGBA`, `RGB` and `ALPHA` and answers `undefined` for
`RGBA_INTEGER`, so `readRenderTargetPixelsAsync()` sizes its buffer `NaN`. A float holds every whole
number up to 2²⁴ exactly — sixteen million sprites per mesh and as many meshes in a list; a mesh of
more sprites is refused before the draw (§5), since two of its slots would read back as one — and is
read back as `Float32Array` under both backends (`EXT_color_buffer_float`, which three's WebGL 2
backend enables). No blending, and a target is no output target: three applies neither tone mapping
nor the output color space to it (`Renderer#currentToneMapping`, `#currentColorSpace`).

### 3.5 One pick

1. Check the arguments (§5). A disposed picker answers `undefined`. A renderer not initialized is
   awaited (`renderer.init()`); everything else runs in one go.
2. Gather the meshes to draw (§3.2); sync each pick material and pick mesh; take the **snapshot**
   of each mesh (§4).
3. Save the state of the renderer the picker changes — the render target with its active cube face
   and mipmap level, the MRT, the clear color and alpha, `autoClear`, `autoClearColor`,
   `autoClearDepth`, `autoClearStencil` — then: the target, no MRT (a global MRT would take the place
   of the `outputNode` for a render target), clear to `(0, 0, 0, 0)`, every clear on, `render()`.
   The state is restored in a `finally`, a throwing render included.
4. `readRenderTargetPixelsAsync(target, 0, 0, 1, 1)` — called right after the render, before any
   `await`: the copy is queued behind the draw, so two picks in flight share one target safely.
5. On the read back: `r = round(pixel[0])`, `g = round(pixel[1])`. `r = 0` is nothing. Otherwise the
   mesh `g − 1` of the list, the slot `r − 1`, resolved by the snapshot (§4).

One frame of latency: the read back resolves once the GPU is done (`mapAsync` under WebGPU, a fence
under WebGL 2). Fine for clicks, and for hover every frame too. The cost of a pick is a draw of the
listed meshes into one pixel — every vertex of every sprite, a fragment only under the pointer — and
the snapshot.

## 4. The slot and the handle — the open point of sorting and growth

The GPU writes the slot a sprite was drawn from. By the time the read back resolves, a sort
(`sortBy()`, `sortByViewDepth()`), a `freeSprite()` — which moves the last sprite into the freed slot —
or a growth may have moved it; `spritePool.getVO(index)` after the read back would answer whatever
stands there now. A mesh sorted every frame — the vector balls, a y-sorted top-down scene — moves
slots every frame, so a check for staleness would refuse almost every pick there.

So the picker resolves in the frame it draws: **at the draw it takes a snapshot of the handles of
every drawn mesh** — `spritePool.getVO(i)` for every slot in use, into an array the picker keeps and
reuses — and the read back looks the slot up there. The answer is the handle that was drawn under the
pointer; a sort or a growth since then changes nothing about it. A sprite freed since answers
`undefined`: the handle is no longer in the pool of its mesh (`containsVO()` — a handle is never
handed out twice, `createVO()` builds a new one). `index` is the slot it was drawn from.

The cost is one `getVO()` per sprite of the listed meshes per pick, and no allocation once the arrays
are as long as the pools (one per mesh drawn by a pick in flight, returned when it resolves).

## 5. Refusals, ownership, disposal

- `pick()` refuses, rejecting with a `TypeError` that names the fix: a `camera` that is no three
  camera (`SpritePicker#pick(): the camera is no three.js Camera`); a `pointer` whose `x` or `y` is no
  finite number (`… the pointer is {x, y} in normalized device coordinates, -1 to 1 — got {x: NaN, y:
  0}`); `sprites` that is no array (`… takes a list of FeatureSprites — pick(camera, pointer,
  [sprites])`); an entry that is no `FeatureSprites` (`… the entry 1 of the list is no FeatureSprites
  — the picker draws FeatureSprites alone`). A listed mesh of more than 2²⁴ sprites rejects the pick
  with a `RangeError` before anything is drawn (`… the entry 0 of the list holds 16777217 sprites,
  and the float target names a slot exactly up to 16777216 — split the sprites into meshes of at
  most 16777216`).
- **Ownership**: the renderer, the camera and every mesh stay the caller's. The picker owns its
  target, its scene, its camera, its pick meshes and pick materials. A pick material borrows the
  resources of its mesh and does not release them.
- **A mesh disposed**: the picker listens to three's `dispose` event of every mesh it has drawn and
  releases its pick mesh and pick material then — the event comes before the sprites release their
  resources, so the pick material goes before what it reads.
- **`dispose()`**: releases the target, every pick mesh (three's `dispose` event, so the renderer
  drops its render objects) and every pick material, stops listening to the meshes, and rejects every
  pick still in flight with `SpritePicker#pick(): the picker was disposed before the pick was read
  back` (`docs/resource-lifecycle.md` §3). A second call does nothing. After it, `pick()` answers
  `undefined` — the type admits absence (§3 of the rules).

## 6. Specs

- `src/sprites/SpritePicker.spec.ts`, against a fake renderer that records what it is asked and
  answers the pixel a test sets: the refusals of §5; a pointer outside the view and an empty list
  answer `undefined` without a draw; disposed, invisible (and under an invisible parent) and empty
  meshes are left out; a mesh listed twice is drawn once; the projection of §3.3 for a pointer, the
  pixel centre snapped, the view and the layers of the camera; the coordinate system and the reversed
  depth prepared; the renderer state restored, also when `render()` throws; the read back resolved to
  mesh and handle; a sort, a `freeSprite()` and a growth between the draw and the read back; the
  mesh number written per pick; the pick material — kind, the resources of the mesh, the placement,
  `outputNode` built from `instanceIndex` and the mesh number, blending and depth, the copied
  parameters — cached, given a swapped placement, rebuilt for other resources; the geometry, world
  matrix, layers and render order of the pick mesh follow the sprites; a mesh disposed releases its
  pick material; `dispose()` releases the target and every material, rejects a pick in flight, and a
  later `pick()` answers `undefined`; an uninitialized renderer is awaited; the type of the result over
  a list of two kinds (`expectTypeOf`).
- Browser test `packages/twopoint5d-testing/test/sprites-picking.test.js`, under WebGPU and WebGL 2,
  through a `Display`: two overlapping sprites — the front one wins in the overlap, the back one where
  it shows alone; the transparent corner of the front sprite's frame picks the sprite behind it; after
  `sortBy()` the same handles answer; a `BillboardPlacement` and an `AxisBillboardPlacement` mesh under
  a camera that looks down at a slant; two meshes in one list — the right mesh; a mesh with
  `grow: true` picked at a sprite created past its first capacity; a sprite faded to 0 is not hit;
  nothing under the pointer answers `undefined`; and the canvas renders as before after a pick (the
  clear color and the render target restored).

## 7. The guide

- `docs/sprites.md`, a section **"Picking: which sprite is under the pointer"** after "Draw order:
  sorting the sprites": the use in one `ts check` block; pixel-perfect for free (the alpha test);
  nearest wins, sprites without a depth test in their own pick (UI layers: pick the top layer first);
  one frame of latency; the snapshot — sorted and growing meshes work, a freed sprite answers
  `undefined`; passes are not hit; what it costs; ownership and `dispose()`.
- CHANGELOG `[Unreleased]`, Added: one bullet.
