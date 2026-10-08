# Proposal: composable sprite features

Status: **implemented** — see [`docs/sprites.md`](../sprites.md). Deviations:

- the old classes — `TexturedSprites`, `AnimatedSprites`, their geometries, materials and
  descriptors, and `BaseSprite` — are removed rather than wrapped (§5.3);
- textures and uniforms live in `SpriteResources`, written through `setTexture()` and
  `setUniform()`, not through accessors of the material;
- a stage samples only the textures its own feature declares;
- a placement may not declare textures — it runs always and cannot wait for one;
- `ShadowPass` takes no `without: ['tint']` (§6.3): `ShadowMask` replaces the color anyway,
  the alpha of the tint fading the shadow along with the sprite is right, and a `without` that
  names a feature the kind does not hold is refused — it would shut out `AnimatedSpriteKind`;
- `ReflectionPass` is `MirrorAtPlane` and `Darken` without `FadeWithDistance` (§6.3), and
  `ctx.placedPosition` (§9, question 8) is not built: both wait for a scene that needs them.
- both presets draw with `side: DoubleSide` besides the parameters of §6.3: a mirror, and a
  projection whose shadow falls towards the camera, turn the winding of the triangles, and three
  culls by the side of the material alone. `ShadowPass` takes a polygon offset as well, so that it
  wins the depth test against a ground mesh in its plane.
- `lightDirection` of `PlanarShadow` became the homogeneous `shadowLight` — see
  [`sprite-uniform-bindings.md`](sprite-uniform-bindings.md) §4.
- a pass may bring one placement of its own (§6): `ShadowPass` turns every sprite to the light
  with `LightFacingPlacement` before it projects it, and `BillboardReflectionPass` places
  billboards so that their reflection faces the camera; a placement swap of the sprites leaves
  such a pass alone.

The pool groups of §8 are carried on in [`pool-groups.md`](pool-groups.md).

The sketch below was checked against the sources of `sprites/`, `vertex-objects/` and
`map2d/TileSprites/` on 2026-10-07 and describes the classes of that day as "today"; it is
kept as it was written. Open questions are collected in §9.

## 1. Goal

A sprite today is a closed package: `TexturedSprite` and `AnimatedSprite` each bring one
descriptor with every attribute they will ever have, and one material that reads exactly
those attributes. Adding shear, a flip or a fade means a new descriptor, a new material and
usually a copy of the old ones.

The goal is to assemble a sprite kind from **feature modules** instead:

```ts
const FancySprite = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Shear, Rotation, AtlasFrame, TextureColor, Tint],
});

const sprites = new FeatureSprites(FancySprite, {capacity: 1000, textures: {colorMap}});

const sprite = sprites.createSprite()!;
sprite.setPosition(10, 20);
sprite.setSize(32, 16);
sprite.rotation = Math.PI / 4;
sprite.setShear(0.2, 0);
sprite.setFrame(atlas.get('hero'));
sprite.setColor(new Color(1, 0.5, 0.5), 1);
```

A feature is written once and fits every sprite kind whose base satisfies its contract
(§4.1). `Rotation` means the same thing on a textured sprite, an animated sprite and a
billboard.

## 2. What exists today

The vertex object core:

- `InstancedVertexObjectGeometry` takes a base pool (the quad) and an instanced pool (one
  slot per sprite). `AnimatedSpritesGeometry` and `TexturedSpritesGeometry` are exactly that
  over `BaseSpriteDescriptor`.
- `InstancedVOBufferGeometry#attachInstancedPool()` attaches further instanced pools under
  a name, each with attribute names of its own. A geometry refuses a name for an attribute
  slot it has held before (`GeometryAttributeSlots#everHeld`).
- `VertexObjectDescriptor` already refuses a description in which two attributes,
  components or methods would give the vertex object the same property name (rule 8 of the
  constructor TSDoc), and one whose `basePrototype` carries such a name (rule 9).
- Attributes that agree on usage, type and `normalized` share one interleaved buffer by
  default (`VADescription#bufferName`, `` `${usage}_${type}${normalized ? 'N' : ''}` ``), so
  they cost one upload together.
- Pools built from the same description object share one descriptor and one prototype
  (`sharedVertexObjectDescriptor`). A loop over the vertex objects of more than four
  prototypes is megamorphic and runs about eighteen times slower per object
  (`docs/architecture.md`, the `vertex-objects/` section).
- `cloneVertexObjectDescription()` copies a description with another usage for some
  attributes; its `alias` lets a caller ask for an attribute by a word of its own. The sprite
  geometries take `attributeUsage` through it and set the aliases themselves:
  `size → quadSize`, `position → instancePosition`, and in `TexturedSpritesGeometry`
  `texCoords → texFlipDiagonal, texTrim`, because `setFrame()` writes the three together.

The sprites:

- A frame is three values, not one: `texCoords` (`s, t, u, v`), `texFlipDiagonal` (a
  TexturePacker frame turned by 90°, read with the two lookup components swapped) and
  `texTrim` (the margins a packer cut off, as fractions of the untrimmed sprite).
  `TexturedSprite#setFrame()` writes all three; `prepareSpriteFrame()` works them out once
  for `setPreparedFrame()`.
- `TexturedSpritesMaterial` builds `positionNode` and `colorNode` in two `createEffect`s
  from node signals (`vertexPositionNode`, `rotationNode`, `quadSizeNode`,
  `instancePositionNode`, `texCoordsNode`, `texFlipDiagonalNode`, `texTrimNode`) and the
  `renderAsBillboards` signal, which the lookbook toggles at runtime. A third effect hands a
  new `colorMap` of the same kind to the texture node without a rebuild: the color graph
  follows `textureShapeKey()` through a memo, not the texture itself.
- `AnimatedSpritesMaterial extends TexturedSpritesMaterial` and does nothing but feed
  `texCoordsNode`, `texFlipDiagonalNode` and `texTrimNode` from four lookups into its
  `animsMap`, in one `batch()`. It is the one place where sprite behaviour is composed
  today, and it composes by subclassing over node signals. Its graph waits for the image of
  the `animsMap` (`touchAnimsMap()`, since `TextureLoader` fills it in without an event) and
  keeps the image measures in a uniform.
- `TexturedSprites` and `AnimatedSprites` both build what they are not handed and own
  exactly that (`docs/resource-lifecycle.md`).
- The sprite setters are allocation-free: a method that hands values of its caller on
  passes them in a module-level scratch tuple to the generated setter, never as arguments
  of its own (`src/sprites/hot-path-allocations.spec.ts`).

Three observations from reading the current sprites:

- **The order of the local transforms is easy to get wrong.** `TexturedSpritesMaterial`
  moves the corners by the trim margins first, scales the quad by `vec3(quadSize, 1)`
  second and rotates it third. The trim shift is measured in the unit quad and has to turn
  with the sprite; scale after rotate turns a rotated sprite with `width !== height` into a
  parallelogram. `sprites-rotation.test.js` and `sprites-trimmed-frames.test.js` hold the
  order in place. Each step is a line in one effect, and nothing but a rendered picture can
  tell it is wrong — which is why this proposal makes the order part of the model (§4.2)
  instead of leaving it to each material.
- **The tint is spread over two files.** `TexturedSprite` declares the `color` attribute,
  `[voInitialize]` fills it with white and `setColor()` / `getColor()` read and write it;
  `TexturedSpritesMaterial` multiplies by `vertexColor()` in its color effect, which answers
  white for a geometry without that attribute — so `AnimatedSprites`, which has none, draws
  untinted through the same code. Descriptor and material agree on nothing but the name
  `color`, and a `Tint` feature would hold both halves in one place.
- **The frame feeds both graphs.** Its tex coords and diagonal flip go into the texture
  lookup, its trim margins into the vertex position. Whatever produces the frame — an
  attribute or a lookup texture — has to reach both effects with one set of nodes.

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
| name collisions | refused at attach time, as an exception at runtime | `VertexObjectDescriptor` refuses them at definition time |
| gpu buffers | at least one per feature | interleaved by usage: typically 2–3 buffers in total |
| sprite handle | composite object over N vertex objects | the plain `VO` |
| prototypes per sprite kind | one per feature pool | one, shared by every geometry of the kind |
| add a feature to a live geometry | possible | not possible — build a new sprite kind |
| share data between draws of one kind (shadow, reflection) | possible | possible — several meshes over one geometry (§6) |
| share one feature's data between different kinds | possible | not possible |

The two rows where separate pools win are real, but neither is what "compose a sprite from
features" asks for. §8 sketches how pool groups could be added later for exactly those
cases.

## 4. Feature model

### 4.1 Contracts

A **base** is a vertex object description with `vertexCount` and `indices`, plus a
`make(...)` that fills its single object. Every base provides two attributes:

- `position: vec3` — the vertex in the local quad space on the XY plane, centered on the
  pivot, unscaled (the unit quad of `BaseSprite` is `[-0.5, 0.5]²` for `make(0.5, 0.5)`)
- `uv: vec2` — where the vertex lies on the untrimmed sprite, `(0,0)` top left, x to the
  right and y downwards; the trim shift (§4.2) reads it

`QuadBase` is today's `BaseSpriteDescriptor`. A subdivided quad (for vertex wobble) or an
offset quad would be other bases; every feature works on them unchanged. The tile base of
`map2d` is not one: it lies on the XZ plane with its origin in a corner, and the tiles are a
strand of their own (§9, question 4).

A **feature** contributes instance attributes, accessor methods and at most one shader
stage per pipeline slot:

```ts
import type {Node, Texture} from 'three/webgpu';
import type {VertexAttributesType} from '../vertex-objects/types.js';

/** What the frame slot answers; the material fills in the defaults where no feature does. */
interface SpriteFrameNodes {
  /** `vec4(s, t, u, v)`; default `vec4(0, 0, 1, 1)`. */
  texCoords: Node<'vec4'>;
  /** Above 0.5 swaps the two components of the lookup; default: no swap. */
  flipDiagonal?: Node<'float'>;
  /** `[left, top, right, bottom]` as fractions of the untrimmed sprite; default: no shift. */
  trim?: Node<'vec4'>;
}

interface SpriteShaderContext {
  /** An instance or base attribute of this sprite kind, by the name it has on the geometry. */
  attribute<T extends string>(name: string): Node<T>;
  /** A uniform a feature declared, owned by the material (§5.2). */
  uniform<T extends string>(name: string): Node<T>;
  /**
   * Samples a texture a feature declared at `uv`. The material keeps every node it hands out
   * here and gives each a new texture of the same kind as its value, without a rebuild.
   */
  sample(name: string, uv: Node<'vec2'>): Node<'vec4'>;
  /** The measures of the image of a declared texture, in texels — a uniform the material keeps current. */
  textureSize(name: string): Node<'vec2'>;
  /** The frame of this sprite kind, built once per graph and read by both pipelines. */
  readonly frame: SpriteFrameNodes;
}

type Stage<T extends string> = {
  /** Where in its slot this stage runs; lower runs first. See `LocalOrder` and `ColorOrder`. */
  order: number;
  transform(input: Node<T>, ctx: SpriteShaderContext): Node<T>;
};

interface SpriteTextureDeclaration {
  /**
   * The texture counts as set only once its image has measures, and the graph waits for it —
   * what `AnimatedSpritesMaterial` does for its `animsMap`. `material.touchTexture(name)`
   * re-reads it once it has loaded.
   */
  readonly needsImage?: boolean;
}

interface SpriteFeature<Api extends object = object> {
  /** Unique within a sprite kind; used in every error message about this feature. */
  readonly name: string;

  /** Instance attributes, merged into the instanced descriptor of the sprite kind. */
  readonly attributes?: VertexAttributesType;
  /**
   * Words a caller of `attributeUsage` may use for attributes of this feature, as
   * `cloneVertexObjectDescription()` takes them — `{size: ['quadSize']}`, or
   * `{texCoords: ['texFlipDiagonal', 'texTrim']}` for attributes written together.
   */
  readonly usageAliases?: Readonly<Record<string, readonly string[]>>;
  /** Methods for the sprite handle, merged into `methods` of the descriptor. */
  readonly methods?: Record<string, (this: Api, ...args: never[]) => unknown>;
  /** Writes the neutral values into a freshly taken slot — slots come back with old data in them. */
  initialize?(this: Api): void;

  /** Uniforms the material holds for this feature, with their start values. */
  readonly uniforms?: Readonly<Record<string, number | readonly number[]>>;
  /** Textures the material holds for this feature. They stay the caller's. */
  readonly textures?: Readonly<Record<string, SpriteTextureDeclaration>>;

  // --- pipeline slots (§4.2) ---
  readonly frame?: (ctx: Omit<SpriteShaderContext, 'frame'>) => SpriteFrameNodes;
  readonly local?: Stage<'vec3'>;
  readonly placement?: (local: Node<'vec3'>, ctx: SpriteShaderContext) => Node<'vec3'>;
  /** After the placement, in the local space of the mesh — the slot of shadows and mirrors (§6). */
  readonly mesh?: Stage<'vec3'>;
  readonly colorSource?: (frame: SpriteFrameNodes, ctx: SpriteShaderContext) => Node<'vec4'>;
  readonly color?: Stage<'vec4'>;

  /** Other features by name that have to be part of the same sprite kind. */
  readonly requires?: readonly string[];

  /** Carries `Api` for the type of the sprite handle; never set at runtime. */
  readonly __api?: Api;
}

declare function defineFeature<Api extends object>(feature: SpriteFeature<Api>): SpriteFeature<Api>;
```

A feature whose stage reads a declared texture takes part in the graph only while that
texture is set — and, with `needsImage`, has an image. Until then the material builds the
graph as if the feature were not there: the frame falls back to its defaults, the color
source to flat grey. That is today's behaviour of both sprite materials without a color map
or an `animsMap`, stated once for every feature.

### 4.2 The pipeline

Transformations do not commute — shear-then-rotate is a different sprite than
rotate-then-shear, and scale-then-rotate is the only order that keeps a rectangle a
rectangle. The order therefore belongs to the model, not to the order of the feature list.

```
frame:    frame slot (or defaults) ─▶ SpriteFrameNodes, read by both pipelines
vertex:   base.position ─▶ trim shift (frame.trim) ─▶ local stages (by order) ─▶ placement ─▶ mesh stages (by order) ─▶ positionNode
fragment: colorSource(frame) ─▶ color stages (by order) ─▶ colorNode
```

| slot | cardinality | input → output | examples |
| --- | --- | --- | --- |
| `frame` | 0…1 | → `SpriteFrameNodes`; defaults as in §4.1 | AtlasFrame, AnimatedFrames |
| trim shift | built in, runs when `frame.trim` is set | `vec3` → `vec3` in the unit quad | — |
| `local` | 0…n, ordered | `vec3` → `vec3` in quad space | Anchor, Flip, QuadSize, Shear, Rotation |
| `placement` | exactly 1, swappable at runtime (§5.2) | local `vec3` → mesh-local `vec3` | FlatPlacement, BillboardPlacement |
| `mesh` | 0…n, ordered | mesh-local `vec3` → `vec3` | DropOffset, PlanarShadow, MirrorAtPlane (§6) |
| `colorSource` | 0…1 | frame → `vec4`; default flat grey, as today | TextureColor |
| `color` | 0…n, ordered | `vec4` → `vec4` | Tint, Fade, Flash |

The **trim shift** is no stage of a feature. A frame with trim margins drawn without the
shift is always wrong, and the shift has to come before every other local step: it is
measured in the unit quad, so it has to be scaled with the sprite, and it has to flip and
turn with it. It moves each corner to its corner of the part the trimmed frame covers,
reading `uv` from the base:

```ts
const trimmedUv = trim.xy.add(uv.mul(float(1).sub(trim.xy.add(trim.zw))));
const shift = trimmedUv.sub(uv);
const shifted = position.add(vec3(shift.x, shift.y.negate(), 0)); // uv counts y downwards
```

Fixed order bands for the local, mesh and color stages, with room in between for features
of your own:

```ts
export const LocalOrder = {Anchor: 100, Flip: 150, Scale: 200, Shear: 300, Rotate: 400} as const;
export const MeshOrder = {Offset: 100, Project: 200, Mirror: 300} as const;
export const ColorOrder = {Tint: 100, Mask: 150, Fade: 200, Flash: 300} as const;
```

Two stages with the same `order` run in feature-list order; `defineSprite` documents that
rather than refusing it.

### 4.3 Example features

A method that hands values of its caller on writes them into a module-level scratch tuple
and calls the generated setter with it, as the sprite setters do today: V8 boxes a
fractional value handed on as an argument to a call it leaves un-inlined, and a property
write through a generated accessor is such a call. `Api` names everything the sprite handle
carries for the feature, the generated accessors included, because the methods and
`initialize` call them through `this`.

```ts
const sizeScratch: [width: number, height: number] = [0, 0];

export const QuadSize = defineFeature<{
  width: number;
  height: number;
  setQuadSize(w: number, h: number): void;
  setQuadSize(size: [w: number, h: number]): void;
  setSize(w: number, h: number): void;
}>({
  name: 'quadSize',
  attributes: {quadSize: {components: ['width', 'height']}},
  usageAliases: {size: ['quadSize']},
  methods: {
    setSize(w: number, h: number) {
      sizeScratch[0] = w;
      sizeScratch[1] = h;
      this.setQuadSize(sizeScratch);
    },
  },
  initialize() {
    this.setQuadSize(0, 0);
  },
  local: {order: LocalOrder.Scale, transform: (p, {attribute}) => p.mul(vec3(attribute<'vec2'>('quadSize'), 1))},
});

export const Rotation = defineFeature<{rotation: number}>({
  name: 'rotation',
  attributes: {rotation: {size: 1, usage: 'dynamic'}},
  initialize() {
    this.rotation = 0;
  },
  local: {order: LocalOrder.Rotate, transform: (p, {attribute}) => rotate(p, vec3(0, 0, attribute<'float'>('rotation')))},
});

export const Shear = defineFeature<{shearX: number; shearY: number; setShear(x: number, y: number): void}>({
  name: 'shear',
  attributes: {shear: {components: ['shearX', 'shearY'], setter: 'setShear', usage: 'dynamic'}},
  initialize() {
    this.setShear(0, 0);
  },
  local: {
    order: LocalOrder.Shear,
    transform: (p, {attribute}) => {
      const s = attribute<'vec2'>('shear');
      return vec3(p.x.add(p.y.mul(s.x)), p.y.add(p.x.mul(s.y)), p.z);
    },
  },
});

// the attribute keeps the name `color` and today's api: the textured preset reads and writes it as is
export const Tint = defineFeature<{
  r: number;
  g: number;
  b: number;
  a: number;
  setColorValues(r: number, g: number, b: number, a: number): void;
  setColor(color: Color, a?: number): void;
  getColor(target?: Color): Color;
}>({
  name: 'tint',
  attributes: {color: {components: ['r', 'g', 'b', 'a'], setter: 'setColorValues', getter: false}},
  methods: {setColor, getColor /* today's TexturedSprite methods, scratch tuples included */},
  initialize() {
    this.setColorValues(1, 1, 1, 1);
  },
  color: {order: ColorOrder.Tint, transform: (c, {attribute}) => c.mul(attribute<'vec4'>('color'))},
});

// the data of a placement, kept apart from the placements so that they can stand in for each other
export const InstancePosition = defineFeature<{
  x: number;
  y: number;
  z: number;
  setInstancePosition(x: number, y: number, z: number): void;
  setPosition(x: number, y: number, z?: number): void;
}>({
  name: 'instancePosition',
  attributes: {instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'}},
  usageAliases: {position: ['instancePosition']},
  methods: {setPosition /* today's TexturedSprite#setPosition: without z the sprite keeps its own */},
  initialize() {
    this.setInstancePosition(0, 0, 0);
  },
});

export const FlatPlacement = defineFeature({
  name: 'flatPlacement',
  requires: ['instancePosition'],
  placement: (local, {attribute}) => local.add(attribute<'vec3'>('instancePosition')),
});

export const AtlasFrame = defineFeature<{
  texFlipDiagonal: number;
  setTexCoords(s: number, t: number, u: number, v: number): void;
  setTexTrim(left: number, top: number, right: number, bottom: number): void;
  setFrame(frame: TextureAtlasFrame<unknown>): void;
  setPreparedFrame(prepared: PreparedSpriteFrame): void;
}>({
  name: 'atlasFrame',
  attributes: {
    texCoords: {components: ['s', 't', 'u', 'v']},
    texFlipDiagonal: {size: 1},
    texTrim: {components: ['trimLeft', 'trimTop', 'trimRight', 'trimBottom']},
  },
  // setFrame() writes the three together, so they upload together
  usageAliases: {texCoords: ['texFlipDiagonal', 'texTrim']},
  methods: {setFrame, setPreparedFrame /* today's TexturedSprite methods */},
  initialize() {
    this.setTexCoords(0, 0, 0, 0);
    this.texFlipDiagonal = 0;
    this.setTexTrim(0, 0, 0, 0);
  },
  frame: ({attribute}) => ({
    texCoords: attribute<'vec4'>('texCoords'),
    flipDiagonal: attribute<'float'>('texFlipDiagonal'),
    trim: attribute<'vec4'>('texTrim'),
  }),
});

export const TextureColor = defineFeature({
  name: 'textureColor',
  textures: {colorMap: {}},
  // colorFromTextureByTexCoords() today: st = texCoords.xy + uv · texCoords.zw, swapped by the
  // flip, passed through a varying, sampled through ctx.sample('colorMap', ...)
  colorSource: (frame, ctx) => ...,
});

export const AnimatedFrames = defineFeature<{animId: number; animOffset: number}>({
  name: 'animatedFrames',
  attributes: {anim: {components: ['animId', 'animOffset']}},
  uniforms: {time: 0},
  textures: {animsMap: {needsImage: true}},
  initialize() {
    this.animId = 0;
    this.animOffset = 0;
  },
  // today's four lookups of AnimatedSpritesMaterial — header, tex coords, flip, trim — through
  // ctx.sample('animsMap', ...), ctx.textureSize('animsMap') and ctx.uniform('time')
  frame: (ctx) => ...,
});
```

`initialize` writes the values of a slot no sprite has stood in — 0 everywhere — except
where 0 is not neutral: the tint starts white. That is what the `[voInitialize]` of both
sprites does today, and the presets keep it.

`BillboardPlacement` moves `billboardVertexByInstancePosition` over. It receives the already
trimmed, scaled, sheared and rotated local vertex and maps its x and y onto the camera's
right and up vectors in the local space of the mesh. `TexturedSpritesMaterial` already hands
it a scale of `vec3(1, 1, 1)` for that reason; the helper's fallback to the `quadSize`
attribute becomes dead code once no material relies on it.

Billboards are a common case, not an exotic one, so `BillboardPlacement` is a first-class
placement next to `FlatPlacement`. Neither declares data of its own: both require the
`InstancePosition` feature and contribute nothing but their `placement` stage, and so stand
in for each other on a live material (§5.2). A kind lists one of them, and a mesh switches
between flat sprites and billboards without a kind of its own for each.

## 5. Assembly

### 5.1 `defineSprite`

```ts
interface SpriteKind<Api> {
  readonly base: SpriteBase;
  readonly features: readonly SpriteFeature[];
  /**
   * The merged instanced description; handed to `InstancedVertexObjectGeometry` as is. One
   * object per kind, so every geometry of the kind shares one descriptor and one prototype.
   */
  readonly description: VertexObjectDescription;
  /** The `usageAliases` of every feature, for `cloneVertexObjectDescription()`. */
  readonly usageAliases: Readonly<Record<string, readonly string[]>>;
}

type SpriteOf<K> = K extends SpriteKind<infer Api> ? Api & VO : never;

declare function defineSprite<const F extends readonly SpriteFeature[]>(options: {
  base: SpriteBase;
  features: F;
}): SpriteKind<UnionToIntersection<NonNullable<F[number]['__api']>>>;
```

What `defineSprite` does, in this order, and each step throws with the feature names in the
message:

1. Checks `requires`, the cardinality of `frame`, `placement` and `colorSource`, and that
   no two features declare the same uniform, texture or usage alias.
2. Merges `attributes` and `methods` into one description. Collisions between attribute
   names, component names and method names are left to `VertexObjectDescriptor`, which
   already refuses them; `defineSprite` builds the descriptor once, catches that error and
   names the two features involved.
3. Builds one `basePrototype` whose `[voInitialize]` calls every feature's `initialize` in
   feature-list order. `methods` cannot carry it: `createVertexObjectPrototype` copies
   `Object.entries(methods)`, which skips symbol keys (`constants.ts` says so at
   `voInitialize`). The prototype carries nothing else, so rule 9 of the descriptor has
   nothing to refuse.
4. Sorts the `local` and `color` stages by `order` and freezes the result.

A sprite kind is immutable. Adding a feature means defining a new kind, which is cheap:
it is a description and a sorted list, not a GPU resource. Every kind brings a prototype
of its own, so one loop over the sprites of more than four kinds is megamorphic — the same
cost a `TexturedSpritesGeometry` built with `attributeUsage` pays today.

### 5.2 Geometry, material and mesh

- **`FeatureSpritesGeometry`** — `InstancedVertexObjectGeometry<SpriteOf<K>, BaseVO>` built
  from `kind.description` and `kind.base`, plus the `make(...)` call the existing sprite
  geometries do today. It takes `attributeUsage` as they do, through
  `cloneVertexObjectDescription()` with `kind.usageAliases`; such a geometry shares its
  prototype with no other. No new machinery.
- **`FeatureSpritesMaterial`** — a `NodeMaterial` that takes the kind and builds:
  - one memo for the frame, rebuilt when the shape of a texture the frame feature declared
    changes; the position and the color effect both read it — the job the `batch()` in
    `AnimatedSpritesMaterial` does today
  - `positionNode` and `colorNode` in one `createEffect` each, folding the sorted stages
    over the input
  - a `placement` signal that starts with the placement of the kind. It takes another
    feature only when that feature contributes a `placement` stage and nothing else — no
    attributes, methods, uniforms or textures, which the sprite handle and the material were
    built without — and the kind holds every feature it `requires`; otherwise it throws
    with both feature names. A change rebuilds the position graph,
    as a write to `renderAsBillboards` does today, and three serves a source it has built
    before from its caches
  - one `uniform()` per declared uniform (exposed as `material.uniforms.time`), readable and
    writable after `dispose()` like `AnimatedSpritesMaterial#time` today
  - per declared texture a signal, a memo over `textureShapeKey()` (and the image measures
    for `needsImage`), and an effect that hands a new texture of the same kind to every node
    `ctx.sample()` built and its measures to the `ctx.textureSize()` uniform — the
    `colorMap` pattern of `TexturedSpritesMaterial`, for every texture.
    `material.setTexture(name, tex)`, `getTexture(name)`, `touchTexture(name)`
  - the three.js material parameters through `setValues()`, without `positionNode` and
    `colorNode`, with the `isMaterial?: never; isTexture?: never` guard and the default
    `alphaTestNode` of `float(0.001)` that both sprite materials have today

  `dispose()` follows `docs/resource-lifecycle.md` and the order of the sprite materials:
  the effects go first, then the texture references are cleared while their signals live,
  then `SignalGroup.delete()`. Textures stay the caller's.
- **`FeatureSprites`** — the `VertexObjects` mesh, with `createSprite()` / `freeSprite()`
  and `spritePool` like `TexturedSprites`. It builds the geometry and the material it is
  not handed, owns exactly those and releases them in `dispose()`, after it has left the
  scene graph and fired three's `dispose` event.

Two meshes built from the same kind produce the same shader source, so the renderer's
program and pipeline caches serve the second one — the same effect the TSDoc of
`TexturedSpritesMaterial#colorMap` describes for a color map of another kind: a source the
renderer has built before comes out of its caches, and only a new one is compiled.

### 5.3 The existing sprites as presets

```ts
export const TexturedSpriteKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint],
});

export const AnimatedSpriteKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AnimatedFrames, TextureColor],
});
```

`AnimatedSpriteKind` has no `Tint` and needs none to render the same pixels: today's
`AnimatedSpritesMaterial` multiplies by `vertexColor()`, which answers white for its
geometry.

`TexturedSprites` and `AnimatedSprites` stay as they are until the presets render the same
pixels; after that they can become thin wrappers over them. What the wrappers have to keep:

- the attribute names (`instancePosition`, `quadSize`, `rotation`, `texCoords`,
  `texFlipDiagonal`, `texTrim`, `color`, `anim`), so `touch()` / `touchVO()` calls and
  custom materials keep working
- the methods of the sprite handles, `setColor()`, `getColor()` and `setPreparedFrame()`
  among them, and the start values of `createSprite()`
- the `attributeUsage` words `size`, `position` and `texCoords`
- the material accessors `colorMap`, `animsMap`, `time`, `touchAnimsMap()` and the node
  setters (`rotationNode`, `texCoordsNode`, …), at least as deprecated mappings
- `renderAsBillboards`, as a mapping onto `material.placement`: `true` sets
  `BillboardPlacement`, `false` sets `FlatPlacement`

## 6. Several passes over one sprite: shadows and reflections

A sprite that throws a shadow onto the ground or shows a reflection on it is drawn twice:
once as itself, once as its shadow or mirror image. The second draw reads the same sprites
— the same positions, sizes, rotations and frames — and differs in its shader alone: the
vertex lands somewhere else (projected onto the ground, mirrored at it, shifted by a drop
offset), and the color is something else (the color map turned into a dark mask, or
darkened and faded). More than two draws are the same thing again: a shadow and a
reflection at once, or one shadow per light.

### 6.1 One pool, one geometry, one mesh per pass

The second draw needs no data of its own, so it gets no pool of its own, and as a rule no
geometry of its own either:

- **Several meshes over one geometry.** Every pass is a mesh over the geometry of the
  sprites, with a material of its own. The sprite data lives in one pool and goes up to the
  gpu once per frame, whatever the number of passes; each pass costs one draw call.
- **`update()` once per geometry.** `VertexObjects#update()` asks for every buffer with
  `autoTouch` on each call, so two meshes that both call it upload the dynamic buffers twice
  per frame. The pass meshes are therefore plain meshes without an `update()` of their own,
  and `FeatureSprites#update()` updates the shared geometry once for all of them.
- **A pass that needs another base** — a blob shadow on a quad of its own, a subdivided quad
  for a long shadow — gets a geometry of its own over the *same instanced pool*:
  `InstancedVertexObjectGeometry` takes a `VertexObjectPool` for its instances, and a pool
  counts the geometries attached to it. The data is still written once; it goes up to the
  gpu once per geometry, since every geometry keeps attributes and upload ranges of its own.

That is why the table in §3 counts sharing between the draws of one kind for the merged
descriptor: it needs neither separate pools nor pool groups. §8 keeps pool groups for data
shared between *different* kinds.

### 6.2 A pass in the feature model

A kind describes the data of a sprite; a **pass** describes another way to draw that data.
It is built from the kind's features with some stages added and some left out:

```ts
interface SpritePass {
  readonly name: string;
  /** Features whose stages this pass adds; they bring stages, uniforms and textures, never data. */
  readonly features: readonly SpriteFeature[];
  /** Features of the kind whose stages this pass leaves out, by name — `tint` for a shadow. */
  readonly without?: readonly string[];
  /** three.js material parameters of this pass: `transparent`, `depthWrite`, `polygonOffset`, … */
  readonly material?: Omit<NodeMaterialParameters, 'positionNode' | 'colorNode'>;
  /** Drawn before the sprites with a lower value; a shadow takes a negative one. */
  readonly renderOrder?: number;
}

declare function definePass(pass: SpritePass): SpritePass;
```

The rule is the one of the placement swap (§5.2), loosened by what a pass may bring: the
material of a pass is built with its features, so they may declare uniforms and textures,
but **never attributes or methods** — the pool and the sprite handle are those of the kind.
All data a pass reads comes from a feature of the kind, and `requires` makes the kind hold
it. A feature that holds nothing but data is nothing new: `InstancePosition` is one. A
`ShadowCaster` with a per-sprite shadow strength or height above the ground is another, and
the sprites themselves never read it — it costs every sprite of the kind its bytes, also
without a shadow pass.

Projections and mirrors work on the placed vertex, after `placement`, so that the shadow of
a billboard is the shadow of the billboard the camera sees. That takes a slot of its own,
the `mesh` stages of §4.2, ordered by `MeshOrder`:

```
vertex:   base.position ─▶ trim shift ─▶ local stages ─▶ placement ─▶ mesh stages (by order) ─▶ positionNode
```

The sprites themselves normally have no mesh stage; a kind may still carry one, a sway in
the wind for instance.

### 6.3 Example passes

```ts
// projects the placed vertex along the light onto the plane dot(n, p) = d
export const PlanarShadow = defineFeature({
  name: 'planarShadow',
  uniforms: {lightDirection: [0.4, -1, 0.3], groundPlane: [0, 1, 0, 0]},
  mesh: {order: MeshOrder.Project, transform: (p, {uniform}) => /* p − L · (dot(n, p) − d) / dot(n, L) */ ...},
});

// keeps the coverage of the color map, takes the color of the shadow
export const ShadowMask = defineFeature({
  name: 'shadowMask',
  uniforms: {shadowColor: [0, 0, 0, 0.5]},
  color: {order: ColorOrder.Mask, transform: (c, {uniform}) => vec4(uniform<'vec4'>('shadowColor').rgb, c.a.mul(uniform<'vec4'>('shadowColor').a))},
});

export const ShadowPass = definePass({
  name: 'shadow',
  features: [PlanarShadow, ShadowMask],
  without: ['tint'],
  material: {transparent: true, depthWrite: false},
  renderOrder: -1,
});

export const ReflectionPass = definePass({
  name: 'reflection',
  features: [MirrorAtPlane, Darken, FadeWithDistance],
  material: {transparent: true, depthWrite: false},
  renderOrder: -1,
});

const sprites = new FeatureSprites(HeroKind, {capacity: 1000, textures: {colorMap}, passes: [ShadowPass]});
sprites.passes.shadow.material.uniforms.lightDirection.value.set(0.2, -1, 0.5);
```

A reflection needs no flip of its own: mirroring the placed vertex at the ground turns the
sprite upside down and keeps the frame where it is.

### 6.4 What the passes share

- **Uniforms and textures.** The shadow of an animated sprite has to show the frame the
  sprite shows, so `time` is one uniform for all passes, and `colorMap` and `animsMap` are
  one texture each. `FeatureSprites` keeps every uniform and every texture its kind and its
  passes declare, once, and hands them to each pass material; a material built on its own
  makes its own, as in §5.2. Two features that declare the same name — in the kind or in a
  pass — are refused when the sprites are built.
- **The placement.** A pass inherits the placement of the sprites, and a placement swap on
  the sprites (`renderAsBillboards`) has to reach every pass: `FeatureSprites#placement`
  writes the `placement` signal (§5.2) of every pass material along with its own.
- **Transform and lifetime.** The pass meshes are children of the sprite mesh, so they move
  with it and leave the scene graph with it. They are handed the geometry and own none of it;
  `FeatureSprites#dispose()` releases the pass materials it built along with its own.

Two passes of one kind produce two shader sources; a second `FeatureSprites` with the same
kind and the same passes comes out of the renderer's caches as in §5.2.

## 7. Tests

- Vitest, next to the sources: merging, the `requires`, cardinality and duplicate-declaration
  errors, collision errors that name both features, stage order including ties, `initialize`
  running for a reused slot, `freeSprite()` moving every feature's attributes together, two
  geometries of one kind sharing one prototype, a feature whose texture is not set dropping
  out of the graph, `material.placement` refusing a feature that brings more than a
  placement stage or whose `requires` the kind does not meet.
- Allocations: every method of the example features in a `hot-path-allocations.spec.ts`,
  measured the way `src/sprites/hot-path-allocations.spec.ts` measures the sprite setters.
- Browser (`packages/twopoint5d-testing`, every file under WebGPU and WebGL 2): the presets of
  §5.3 against what the sprite tests measure for the existing sprites today — the covered box
  of `sprites-rotation.test.js` and `sprites-billboard.test.js`, the frame cells of
  `sprites-rotated-frames.test.js` and `sprites-trimmed-frames.test.js`, the tint of
  `sprites-textured-material.test.js`, the frames over time of
  `sprites-animated-material.test.js`. Then a non-square sprite through QuadSize + Shear +
  Rotation on a trimmed frame, flat and as a billboard on one live material. Then a sprite
  with a shadow pass: the shadow covers the projected box in the shadow color, follows a
  placement swap, and shows the frame of the sprite at the same `time`. Reading back boxes
  and cell colors from a render target needs no reference images and survives the WebGL2
  fallback.
- Passes, in Vitest: a pass with attributes or methods is refused, as is one whose
  `requires` the kind does not meet; `FeatureSprites#update()` uploads a dynamic buffer once
  per frame with two passes; a uniform declared twice is refused; `dispose()` leaves a
  geometry and pass materials handed in alone.

## 8. Later: pool groups for runtime features and data shared across kinds

For the two cases neither a merged descriptor nor the passes of §6 serve — a feature added
to a live geometry, and one feature's data shared between sprite kinds of different
descriptors (two kinds of units reading the positions of one formation) — a
`VertexObjectPoolGroup` could sit on top of `attachInstancedPool()`:

- one primary pool decides `usedCount`; every member pool follows each `createVO`,
  `freeVO` (same swap-with-last), `clear`, `usedCount` write and `createFromAttributes`
- capacities must match; the group refuses a member that does not
- the handle is a composite of the member vertex objects, or the group generates one
  prototype that forwards to them

This is deliberately out of scope here: it touches the pool core, and nothing in §1 needs it.

## 9. Open questions

1. **Attribute names.** Plain names (`rotation`) read well and keep compatibility; a
   namespace per feature (`rotation_angle`) rules out collisions between third-party
   features. Proposal: plain names, collisions refused at definition time.
2. **Per-kind order overrides.** Is a fixed `order` per feature enough, or does a kind need
   to reorder (e.g. shear after rotation for an italic effect)? Proposal: allow
   `defineSprite({..., order: {shear: 450}})` only if a use case shows up. The trim shift
   stays first either way.
3. **Stages in the fragment shader that read instance attributes.** Answered by today's
   code: the color effect of `TexturedSpritesMaterial` multiplies by the instance attribute
   `color` through `vertexColor()`, and `sprites-textured-material.test.js` reads the tinted
   pixels back under WebGPU and WebGL 2. Still to confirm for `attribute()` of a name of its
   own, which is what a `Fade` or `Flash` would read. Answered by the browser tests: `Tint`
   reads its `color` through `attribute()` of the shader context in a color stage, and
   `sprites-textured-material.test.js` reads the tinted pixels back under WebGPU and WebGL 2.
4. ~~**`map2d` tiles.**~~ Out of scope: the tiles are a strand of their own. For that strand:
   `TileSpritesGeometry` has a base that breaks the contract of §4.1 — it lies on the XZ
   plane with its origin in a corner, and `TileSpritesMaterial` scales by
   `vec3(width, 0, height)`. Its frame has tex coords and a diagonal flip but no trim, and
   every attribute is `dynamic` with `autoTouch: false`.
5. ~~**`color` vs. `tint`.**~~ Decided: the feature is called `Tint`, its attribute keeps the
   name `color` and today's api — `setColorValues`, `setColor()`, `getColor()` — so the
   textured preset and every `touch('color')` keep working (§4.3).
6. ~~**Placement at runtime.**~~ Decided: `FeatureSpritesMaterial#placement` swaps the
   placement on a live material among features that contribute nothing but a placement
   stage and whose `requires` the kind meets (§4.3, §5.2); `renderAsBillboards` of the
   presets maps onto it (§5.3). Answered by the browser tests: `sprites-composition.test.js`
   draws one live material flat and as a billboard, and `sprites-shadow-pass.test.js` draws the
   shadow of a billboard after a swap on the sprites, under WebGPU and WebGL 2.
7. **Overlapping shadows.** Two transparent shadows that overlap darken each other twice,
   which a real shadow does not. A stencil test per pass, or the shadow pass drawn into a
   render target of its own and laid over the ground once, would avoid it; both lie outside
   the feature model and wait for the first scene that needs them.
8. **The placed position in the fragment stage.** A reflection that fades with its distance
   from the ground needs the placed vertex in the color stages. Proposal: `ctx.placedPosition`,
   passed through a varying, built only when a stage reads it.
