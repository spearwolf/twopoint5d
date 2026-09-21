# Proposal: composable sprite features

Status: **design sketch** — nothing here is implemented. Open questions are collected in §8.

## 1. Goal

A sprite today is a closed package: `TexturedSprite` and `AnimatedSprite` each bring one
descriptor with every attribute they will ever have, and one material that reads exactly
those attributes. Adding shear, a tint or a flip means a new descriptor, a new material and
usually a copy of the old ones.

The goal is to assemble a sprite kind from **feature modules** instead:

```ts
const FancySprite = defineSprite({
  base: QuadBase,
  features: [FlatPlacement, QuadSize, Shear, Rotation, AtlasFrame, TextureColor, Tint],
});

const sprites = new FeatureSprites(FancySprite, {capacity: 1000, colorMap});

const sprite = sprites.createSprite()!;
sprite.setPosition(10, 20);
sprite.setSize(32, 16);
sprite.rotation = Math.PI / 4;
sprite.setShear(0.2, 0);
sprite.setTint(1, 0.5, 0.5, 1);
```

A feature is written once and fits every sprite kind whose base satisfies its contract
(§4.1). `Rotation` means the same thing on a textured sprite, an animated sprite and a tile.

## 2. What exists today

- `InstancedVertexObjectGeometry` takes a base pool (the quad) and an instanced pool (one
  slot per sprite). `AnimatedSpritesGeometry` and `TexturedSpritesGeometry` are exactly that
  over `BaseSpriteDescriptor`.
- `InstancedVOBufferGeometry#attachInstancedPool()` attaches further instanced pools under
  a name, each with attribute names of its own.
- `VertexObjectDescriptor` already refuses a description in which two attributes,
  components or methods would give the vertex object the same property name
  (`VertexObjectDescriptor.ts`, rule 5 of the constructor TSDoc).
- Attributes that agree on usage, type and `normalized` share one interleaved buffer by
  default (`VADescription#bufferName`), so they cost one upload together.
- `TexturedSpritesMaterial` builds `positionNode` and `colorNode` in two `createEffect`s from
  fixed node signals (`rotationNode`, `quadSizeNode`, `instancePositionNode`,
  `texCoordsNode`). There is no place to hook in a transform that has no signal of its own.

Two observations from reading the current sprites:

- **The order of the local transforms is easy to get wrong.** `TexturedSpritesMaterial`
  used to rotate the unit quad and multiply the result by `vec3(quadSize, 1)` afterwards,
  so a rotated sprite with `width !== height` came out as a parallelogram. It now scales
  first and rotates second, and `packages/twopoint5d-testing/test/sprites-rotation.test.js`
  holds it there. The order was a line in one effect, and nothing but a rendered picture
  could tell it was wrong — which is why this proposal makes it part of the model (§4.2)
  instead of leaving it to each material.
- **`TexturedSprite` writes a `color` attribute that no shader reads.** The descriptor
  declares it and `[voInitialize]` fills it with white, but `TexturedSpritesMaterial` only
  samples the color map. It is a tint feature with the shader half missing.

## 3. The decisive choice: compose descriptors, not pools

`attachInstancedPool()` looks like the natural home for features — one pool per feature,
attached by name. It is the wrong place for them, for one reason: **the pools do not move
in lockstep.**

- Every pool has its own `usedCount`, `createVO()` and `freeVO()`.
- `instanceCount` is taken from the instanced pool alone (`InstancedVOBufferGeometry#update`).
- `VertexObjectPool#freeVO()` frees by swap-with-last: the last object is copied into the
  freed slot. In a feature pool that nobody freed, the data stays where it was, and from then
  on sprite *i* reads the rotation of sprite *j*.

Keeping N pools in lockstep means re-implementing `createVO`, `freeVO`, `clear`, the
`usedCount` setter, `createFromAttributes` and `fromBuffersData` across all of them, and
handing out a composite handle instead of a vertex object.

**Recommendation: merge the features into one instanced descriptor when the sprite kind is
defined.** One pool, one `VO` per sprite that carries every feature's accessors, one
`freeVO()` that moves every attribute at once. Nothing in `vertex-objects/` changes:

| concern | separate pools | merged descriptor |
| --- | --- | --- |
| free / swap-with-last | has to be mirrored by hand | one `copyWithin` over every buffer |
| name collisions | slot guard at attach time, as an exception at runtime | `VertexObjectDescriptor` refuses them at definition time |
| gpu buffers | at least one per feature | interleaved by usage: typically 2–3 buffers in total |
| sprite handle | composite object over N vertex objects | the plain `VO` |
| add a feature to a live geometry | possible | not possible — build a new sprite kind |
| share one feature's data between geometries | possible | not possible |

The two rows where separate pools win are real, but neither is what "compose a sprite from
features" asks for. §7 sketches how pool groups could be added later for exactly those
cases.

## 4. Feature model

### 4.1 Contracts

A **base** is a vertex object description with `vertexCount` and `indices`, plus a
`make(...)` that fills its single object. Every base provides two attributes:

- `position: vec3` — the vertex in the local quad space, centered on the pivot, unscaled
  (the unit quad of `BaseSprite` is `[-0.5, 0.5]²` for `make(0.5, 0.5)`)
- `uv: vec2` — the texture coordinate across the quad, `(0,0)` top left

`QuadBase` is today's `BaseSpriteDescriptor`. A subdivided quad (for vertex wobble) or an
offset quad would be other bases; every feature works on them unchanged.

A **feature** contributes instance attributes, accessor methods and at most one shader
stage per pipeline slot:

```ts
import type {Node} from 'three/webgpu';
import type {VertexAttributesType} from '../vertex-objects/types.js';

interface SpriteShaderContext {
  /** An instance or base attribute of this sprite kind, by the name it has on the geometry. */
  attribute<T extends string>(name: string): Node<T>;
  /** A uniform or texture a feature declared, owned by the material (§5.2). */
  uniform<T extends string>(name: string): Node<T>;
  texture(name: string): Node<'vec4'> | undefined;
}

type Stage<T extends string> = {
  /** Where in its slot this stage runs; lower runs first. See `LocalOrder` and `ColorOrder`. */
  order: number;
  transform(input: Node<T>, ctx: SpriteShaderContext): Node<T>;
};

interface SpriteFeature<Api extends object = object> {
  /** Unique within a sprite kind; used in every error message about this feature. */
  readonly name: string;

  /** Instance attributes, merged into the instanced descriptor of the sprite kind. */
  readonly attributes?: VertexAttributesType;
  /** Methods for the sprite handle, merged into `methods` of the descriptor. */
  readonly methods?: Record<string, (this: Api, ...args: never[]) => unknown>;
  /** Writes the defaults into a freshly taken slot — slots come back with old data in them. */
  initialize?(this: Api): void;

  /** Uniforms and textures the material holds for this feature. */
  readonly uniforms?: Record<string, number | number[]>;
  readonly textures?: readonly string[];

  // --- pipeline slots (§4.2) ---
  readonly local?: Stage<'vec3'>;
  readonly placement?: (local: Node<'vec3'>, ctx: SpriteShaderContext) => Node<'vec3'>;
  readonly texCoords?: (ctx: SpriteShaderContext) => Node<'vec4'>;
  readonly colorSource?: (texCoords: Node<'vec4'>, ctx: SpriteShaderContext) => Node<'vec4'>;
  readonly color?: Stage<'vec4'>;

  /** Other features by name that have to be part of the same sprite kind. */
  readonly requires?: readonly string[];

  /** Carries `Api` for the type of the sprite handle; never set at runtime. */
  readonly __api?: Api;
}

declare function defineFeature<Api extends object>(feature: SpriteFeature<Api>): SpriteFeature<Api>;
```

### 4.2 The pipeline

Transformations do not commute — shear-then-rotate is a different sprite than
rotate-then-shear, and scale-then-rotate is the only order that keeps a rectangle a
rectangle. The order therefore belongs to the model, not to the order of the feature list.

```
vertex:   base.position ─▶ local stages (by order) ─▶ placement ─▶ positionNode
fragment: texCoords ─▶ colorSource ─▶ color stages (by order) ─▶ colorNode
```

| slot | cardinality | input → output | examples |
| --- | --- | --- | --- |
| `local` | 0…n, ordered | `vec3` → `vec3` in quad space | Anchor, Flip, QuadSize, Shear, Rotation |
| `placement` | exactly 1 | local `vec3` → model-space `vec3` | FlatPlacement, BillboardPlacement |
| `texCoords` | 0…1 | → `vec4(s, t, u, v)`; default `vec4(0, 0, 1, 1)` | AtlasFrame, AnimatedFrames |
| `colorSource` | 0…1 | texCoords → `vec4`; default flat grey, as today | TextureColor |
| `color` | 0…n, ordered | `vec4` → `vec4` | Tint, Fade, Flash |

Fixed order bands, with room in between for features of your own:

```ts
export const LocalOrder = {Anchor: 100, Flip: 150, Scale: 200, Shear: 300, Rotate: 400} as const;
export const ColorOrder = {Tint: 100, Fade: 200, Flash: 300} as const;
```

Two stages with the same `order` run in feature-list order; `defineSprite` documents that
rather than refusing it.

### 4.3 Example features

```ts
export const QuadSize = defineFeature<{width: number; height: number; setSize(w: number, h: number): void}>({
  name: 'quadSize',
  attributes: {quadSize: {components: ['width', 'height']}},
  methods: {
    setSize(w: number, h: number) {
      this.width = w;
      this.height = h;
    },
  },
  initialize() {
    this.setSize(1, 1);
  },
  local: {order: LocalOrder.Scale, transform: (p, {attribute}) => p.mul(vec3(attribute<'vec2'>('quadSize'), 1))},
});

export const Rotation = defineFeature<{rotation: number}>({
  name: 'rotation',
  attributes: {rotation: {size: 1, usage: 'dynamic'}},
  local: {order: LocalOrder.Rotate, transform: (p, {attribute}) => rotate(p, vec3(0, 0, attribute<'float'>('rotation')))},
});

export const Shear = defineFeature<{shearX: number; shearY: number; setShear(x: number, y: number): void}>({
  name: 'shear',
  attributes: {shear: {components: ['shearX', 'shearY'], setter: 'setShear', usage: 'dynamic'}},
  local: {
    order: LocalOrder.Shear,
    transform: (p, {attribute}) => {
      const s = attribute<'vec2'>('shear');
      return vec3(p.x.add(p.y.mul(s.x)), p.y.add(p.x.mul(s.y)), p.z);
    },
  },
});

export const Tint = defineFeature<{setTint(r: number, g: number, b: number, a: number): void}>({
  name: 'tint',
  attributes: {tint: {components: ['tr', 'tg', 'tb', 'ta'], setter: 'setTint', getter: false}},
  initialize() {
    this.setTint(1, 1, 1, 1);
  },
  color: {order: ColorOrder.Tint, transform: (c, {attribute}) => c.mul(attribute<'vec4'>('tint'))},
});

export const FlatPlacement = defineFeature<{setPosition(x: number, y: number, z?: number): void}>({
  name: 'flatPlacement',
  attributes: {instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'}},
  methods: {
    setPosition(x: number, y: number, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    },
  },
  placement: (local, {attribute}) => local.add(attribute<'vec3'>('instancePosition')),
});

export const AnimatedFrames = defineFeature<{animId: number; animOffset: number}>({
  name: 'animatedFrames',
  attributes: {anim: {components: ['animId', 'animOffset']}},
  uniforms: {time: 0},
  textures: ['animsMap'],
  texCoords: (ctx) => /* today's lookup from AnimatedSpritesMaterial, reading ctx.uniform('time') */ ...,
});
```

`BillboardPlacement` moves `billboardVertexByInstancePosition` over. Because `QuadSize` now
runs as a local stage, billboarding no longer takes a scale of its own: it receives the
already scaled, sheared and rotated local vertex and maps its x and y onto the camera's
right and up vectors.

## 5. Assembly

### 5.1 `defineSprite`

```ts
interface SpriteKind<Api> {
  readonly base: SpriteBase;
  readonly features: readonly SpriteFeature[];
  /** The merged instanced description; handed to `InstancedVertexObjectGeometry` as is. */
  readonly description: VertexObjectDescription;
}

type SpriteOf<K> = K extends SpriteKind<infer Api> ? Api & VO : never;

declare function defineSprite<const F extends readonly SpriteFeature[]>(options: {
  base: SpriteBase;
  features: F;
}): SpriteKind<UnionToIntersection<NonNullable<F[number]['__api']>>>;
```

What `defineSprite` does, in this order, and each step throws with the feature names in the
message:

1. Checks `requires` and the cardinality of `placement`, `texCoords` and `colorSource`.
2. Merges `attributes` and `methods` into one description. Collisions between attribute
   names, component names and method names are left to `VertexObjectDescriptor`, which
   already refuses them; `defineSprite` catches that error and names the two features
   involved.
3. Builds one `basePrototype` whose `[voInitialize]` calls every feature's `initialize` in
   feature-list order. `methods` cannot carry it: `createVertexObjectPrototype` copies
   `Object.entries(methods)`, which skips symbol keys.
4. Sorts the `local` and `color` stages by `order` and freezes the result.

A sprite kind is immutable. Adding a feature means defining a new kind, which is cheap:
it is a description and a sorted list, not a GPU resource.

### 5.2 Geometry, material and mesh

- **`FeatureSpritesGeometry`** — `InstancedVertexObjectGeometry<SpriteOf<K>, BaseVO>` built
  from `kind.description` and `kind.base`, plus the `make(...)` call the existing sprite
  geometries do today. No new machinery.
- **`FeatureSpritesMaterial`** — a `NodeMaterial` that takes the kind and builds
  `positionNode` and `colorNode` in one `createEffect` each, folding the sorted stages over
  the input. It owns one `uniform()` per declared uniform (exposed as
  `material.uniforms.time`) and one texture signal per declared texture
  (`material.setTexture('animsMap', tex)`), following the `colorMap` signal pattern and the
  ownership rules of `docs/resource-lifecycle.md`: textures stay the caller's.
- **`FeatureSprites`** — the `VertexObjects` mesh, with `createSprite()` / `freeSprite()`
  like `TexturedSprites`.

Two meshes built from the same kind produce the same shader source, so the renderer's
program and pipeline caches serve the second one — the same effect the TSDoc of
`AnimatedSpritesMaterial#touchAnimsMap()` describes.

### 5.3 The existing sprites as presets

```ts
export const TexturedSpriteKind = defineSprite({
  base: QuadBase,
  features: [FlatPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint],
});

export const AnimatedSpriteKind = defineSprite({
  base: QuadBase,
  features: [FlatPlacement, QuadSize, Rotation, AnimatedFrames, TextureColor],
});
```

`TexturedSprites` and `AnimatedSprites` stay as they are until the presets render the same
pixels; after that they can become thin wrappers over them. Attribute names stay as they
are today (`instancePosition`, `quadSize`, `rotation`, `texCoords`, `anim`), so `touch()`
calls and custom materials keep working. One exception is open: `TexturedSprite` calls
its tint attribute `color`, the `Tint` feature calls it `tint` (§8, question 5).

## 6. Tests

- Vitest, next to the sources: merging, the `requires` and cardinality errors, collision
  errors that name both features, stage order including ties, `initialize` running for a
  reused slot, `freeSprite()` moving every feature's attributes together.
- Browser (`packages/twopoint5d-testing`): the presets of §5.3 against the pixel boxes
  `sprites-rotation.test.js` measures for `TexturedSprites` today, flat and as billboards;
  then a non-square sprite through QuadSize + Shear + Rotation. Measuring the covered box
  in a render target needs no reference images and survives the WebGL2 fallback.

## 7. Later: pool groups for shared or runtime features

For the two cases a merged descriptor cannot serve — a feature added to a live geometry,
and one feature's data shared between geometries (a sprite layer and its shadow pass
reading the same positions) — a `VertexObjectPoolGroup` could sit on top of
`attachInstancedPool()`:

- one primary pool decides `usedCount`; every member pool follows each `createVO`,
  `freeVO` (same swap-with-last), `clear`, `usedCount` write and `createFromAttributes`
- capacities must match; the group refuses a member that does not
- the handle is a composite of the member vertex objects, or the group generates one
  prototype that forwards to them

This is deliberately out of scope here: it touches the pool core, and nothing in §1 needs it.

## 8. Open questions

1. **Attribute names.** Plain names (`rotation`) read well and keep compatibility; a
   namespace per feature (`rotation_angle`) rules out collisions between third-party
   features. Proposal: plain names, collisions refused at definition time.
2. **Per-kind order overrides.** Is a fixed `order` per feature enough, or does a kind need
   to reorder (e.g. shear after rotation for an italic effect)? Proposal: allow
   `defineSprite({..., order: {shear: 450}})` only if a use case shows up.
3. **Stages in the fragment shader that need varyings** (a feature that reads an instance
   attribute in `color`): TSL routes `attribute()` into the fragment stage by itself; to be
   confirmed for WebGPU and the WebGL2 fallback in the browser test.
4. **`map2d` tiles.** `TileSpritesGeometry` has its own base and descriptor; whether it
   becomes a sprite kind is a separate decision.
5. **`color` vs. `tint`.** The textured preset either keeps `color` through a `Tint` variant
   with that attribute name, or renames it. No shader reads `color` today, so a rename only
   breaks callers that `touch('color')` by hand.
