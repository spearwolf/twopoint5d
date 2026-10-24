# Proposal: composable sprite features

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Kinds, features and the base",
"The pipeline", "Defining a kind", "The material: textures, uniforms and rebuilds", "Flat sprites
and billboards", "FeatureSprites", "Presets", "Writing a feature", "Passes: shadows and
reflections" and "Migrating from TexturedSprites and AnimatedSprites". Deviations of the build from
the first draft of this spec, which the sections below now state as built:

- the old classes — `TexturedSprites`, `AnimatedSprites`, their geometries, materials and
  descriptors, and `BaseSprite` — are removed rather than wrapped (§5.3);
- textures and uniforms live in `SpriteResources`, written through `setTexture()` and
  `setUniform()`, not through accessors of the material (§5.2);
- a stage samples only the textures its own feature declares; it reads the size and the colour
  space of the texture of any feature (§4.1);
- a placement may not declare textures — it runs always and cannot wait for one (§5.1);
- `defineSprite()` checks the names of attributes and sprite-handle properties itself, naming both
  features, and hands the descriptor only the layout (§5.1); the kind carries its sorted
  `pipeline`;
- `ShadowPass` takes no `without: ['tint']` (§6.3): `ShadowMask` replaces the color anyway,
  the alpha of the tint fading the shadow along with the sprite is right, and a `without` that
  names a feature the kind does not hold is refused — it would shut out `AnimatedSpriteKind`;
- `ReflectionPass` is `MirrorAtPlane` and `Darken` without `FadeWithDistance` (§6.3), and
  `ctx.placedPosition` (§9, question 8) is not built: both wait for a scene that needs them;
- both presets draw with `side: DoubleSide` besides the parameters of §6.3: a mirror, and a
  projection whose shadow falls towards the camera, turn the winding of the triangles, and three
  culls by the side of the material alone. `ShadowPass` takes a polygon offset as well, so that it
  wins the depth test against a ground mesh in its plane;
- `lightDirection` of `PlanarShadow` became the homogeneous `shadowLight` — see
  [`sprite-uniform-bindings.md`](sprite-uniform-bindings.md) §4;
- a pass may bring one placement of its own (§6.2): `ShadowPass` turns every sprite to the light
  with `LightFacingPlacement` before it projects it, and `BillboardReflectionPass` places
  billboards so that their reflection faces the camera; a placement swap of the sprites leaves
  such a pass alone;
- a pass that needs another base than the sprites (§6.1) is not built: every pass mesh draws the
  geometry of the sprites.

Later proposals built on this model, and the sections below name them where they touch it: frame
stages, uv stages, shared uniforms, `checkKind()` and a grid base —
[`pipeline-stages-and-grid-base.md`](pipeline-stages-and-grid-base.md); uniform bindings, renamed
and hidden passes — [`sprite-uniform-bindings.md`](sprite-uniform-bindings.md); planes and turns
of the flat placement — [`flat-placement-orientation.md`](flat-placement-orientation.md); the band
`ColorOrder.Pass` and axis billboards — [`fade-flash-axis-billboards.md`](fade-flash-axis-billboards.md);
growth, sorting and picking of the mesh — [`growing-capacity.md`](growing-capacity.md),
[`pool-sorting.md`](pool-sorting.md), [`gpu-picking.md`](gpu-picking.md). The pool groups of §8 are
carried on in [`pool-groups.md`](pool-groups.md). Open questions are collected in §9.

## 1. Goal

A sprite that comes as a closed package — one descriptor with every attribute it will ever have,
one material that reads exactly those attributes — takes a new descriptor, a new material and
usually a copy of both for every shear, flip or fade added to it.

A sprite kind is therefore assembled from **feature modules**:

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
sprite.setFrame(atlas.frame('hero')!);
sprite.setColor(new Color(1, 0.5, 0.5), 1);
```

A feature is written once and fits every sprite kind whose base satisfies its contract
(§4.1). `Rotation` means the same thing on a textured sprite, an animated sprite and a
billboard.

## 2. What the model builds on

The vertex object core carries the model without a change of its own:

- `InstancedVertexObjectGeometry` takes a base pool (the quad) and an instanced pool (one slot per
  sprite). `FeatureSpritesGeometry` is exactly that, over the base and the merged description of a
  kind (§5.2).
- `InstancedVOBufferGeometry#attachInstancedPool()` attaches further instanced pools under a name,
  each with attribute names of its own. A geometry refuses a name for an attribute slot it has held
  before (`GeometryAttributeSlots#everHeld`).
- `VertexObjectDescriptor` refuses a description in which two attributes, components or methods
  would give the vertex object the same property name (rule 8 of the constructor TSDoc), and one
  whose `basePrototype` carries such a name (rule 9).
- Attributes that agree on usage, type and `normalized` share one interleaved buffer by default
  (`VertexAttributeDescriptor#bufferName`, `` `${usage}_${type}${normalized ? 'N' : ''}` ``), so
  they cost one upload together.
- Pools built from the same description object share one descriptor and one prototype
  (`sharedVertexObjectDescriptor`). A loop over the vertex objects of more than four prototypes is
  megamorphic and runs about eighteen times slower per object (`docs/architecture.md`, the
  `vertex-objects/` section).
- `cloneVertexObjectDescription()` copies a description with another usage for some attributes;
  its `alias` lets a caller ask for an attribute by a word of its own. `FeatureSpritesGeometry`
  takes `attributeUsage` through it, with the usage words of the features (§4.1).
- A frame is three values, not one: `texCoords` (`s, t, u, v`), `texFlipDiagonal` (a TexturePacker
  frame turned by 90°, read with the two lookup components swapped) and `texTrim` (the margins a
  packer cut off, as fractions of the untrimmed sprite).
- The sprite setters are allocation-free: a method that hands values of its caller on passes them
  in a module-level scratch tuple to the generated setter, never as arguments of its own
  (`src/sprites/hot-path-allocations.spec.ts`).

Three things a closed sprite package gets wrong easily, and the model settles once:

- **The order of the local transforms.** The corners move by the trim margins first, the quad is
  scaled by its size second and rotated third. The trim shift is measured in the unit quad and has
  to turn with the sprite; scale after rotate turns a rotated sprite with `width !== height` into a
  parallelogram. Nothing but a rendered picture tells that an order is wrong
  (`sprites-rotation.test.js`, `sprites-trimmed-frames.test.js`), which is why the order is part of
  the model (§4.2) instead of a line in each material.
- **The tint in one place.** An attribute `color`, its start value white, its setters and the
  multiplication in the color graph belong together; spread over a descriptor and a material they
  agree on nothing but the name. `Tint` holds all of it.
- **The frame feeds both graphs.** Its tex coords and diagonal flip go into the texture lookup,
  its trim margins into the vertex position. Whatever produces the frame — an attribute or a lookup
  texture — reaches both graphs with one set of nodes (§5.2).

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

**The features are merged into one instanced description when the sprite kind is defined.** One
pool, one `VO` per sprite that carries every feature's accessors, one `freeVO()` that moves every
attribute at once. The merge needs nothing new from `vertex-objects/`:

| concern | separate pools | merged descriptor |
| --- | --- | --- |
| free / swap-with-last | has to be mirrored by hand | one `copyWithin` over every buffer |
| name collisions | refused at attach time, as an exception at runtime | `defineSprite()` refuses them at definition time |
| gpu buffers | at least one per feature | interleaved by usage: typically 2–3 buffers in total |
| sprite handle | composite object over N vertex objects | the plain `VO` |
| prototypes per sprite kind | one per feature pool | one, shared by every geometry of the kind |
| add a feature to a live geometry | possible | not possible — build a new sprite kind |
| share data between draws of one kind (shadow, reflection) | possible | possible — several meshes over one geometry (§6) |
| share one feature's data between different kinds | possible | not possible |

The two rows where separate pools win are real, but neither is what "compose a sprite from
features" asks for. §8 and [`pool-groups.md`](pool-groups.md) keep pool groups for exactly those
cases.

## 4. Feature model

### 4.1 Contracts

A **base** is a vertex object description with `vertexCount` and `indices`, whose `basePrototype`
carries a `make(...args)` that fills the one base vertex object:

```ts
interface SpriteBase<Args extends readonly unknown[] = readonly unknown[]> {
  /** Names the base in the errors of `defineSprite()`. */
  readonly name: string;
  readonly description: VertexObjectDescription;
  /** What `make()` is called with when a geometry is built without `baseArgs`. */
  readonly defaultArgs: Args;
}
```

Every base provides two attributes:

- `position` (3 values) — the vertex in the local quad space on the XY plane, centred on the
  pivot, unscaled
- `uv` (2 values) — where the vertex lies on the untrimmed sprite, `(0, 0)` top left, x to the
  right and y downwards; the trim shift (§4.2) reads it

`QuadBase` is the quad every built-in kind uses: four vertices, two triangles, the unit quad
`[-0.5, 0.5]²` for its `defaultArgs` `[0.5, 0.5]`, and a `make(halfWidth, halfHeight, xOffset,
yOffset)` that lays it out (`QuadBaseArgs`). `gridBase({columns, rows})` cuts that quad into cells
for stages that move grid lines or bend the sprite
([`pipeline-stages-and-grid-base.md`](pipeline-stages-and-grid-base.md)); every feature works on it
unchanged. The tile base of `map2d` is not one: it lies on the XZ plane with its origin in a
corner, and the tiles are a strand of their own (§9, question 4).

A **feature** contributes instance attributes, accessor methods, uniforms, textures and at most
one shader stage per pipeline slot:

```ts
/** What the frame slot answers; the material fills in the defaults where no feature does. */
interface SpriteFrameNodes {
  /** `vec4(s, t, u, v)`: the lookup reads `(s + uv.x · u, t + uv.y · v)`; default `vec4(0, 0, 1, 1)`. */
  readonly texCoords: Node<'vec4'>;
  /** Above 0.5 swaps the two components of the lookup; default: no swap. */
  readonly flipDiagonal?: Node<'float'>;
  /** `[left, top, right, bottom]` as fractions of the untrimmed sprite; default: no shift. */
  readonly trim?: Node<'vec4'>;
  /** 1 along an axis a frame stage mirrored the image on — `Flip` writes it; default: no mirror. */
  readonly mirror?: Node<'vec2'>;
}

/** What the frame slot and a frame stage read through. */
interface SpriteFrameContext {
  /** An instance or base attribute of the kind; the material throws, naming the feature, for another name. */
  attribute<T extends string>(name: string): Node<T>;
  /** A uniform some feature of the material declares. */
  uniform<T extends string>(name: string): Node<T>;
  /** Samples, at `uv`, a texture the calling feature declares itself. */
  sample(name: string, uv: Node<'vec2'>): Node<'vec4'>;
  /** The measures, in texels, of a texture any feature of the material declares. */
  textureSize(name: string): Node<'vec2'>;
  /** The `colorSpace` of a texture any feature declares, `undefined` while it is unset — a tracked read. */
  colorSpace(name: string): string | undefined;
}

/** What every stage after the frame slot reads through. */
interface SpriteShaderContext extends SpriteFrameContext {
  /** The frame after every frame stage, built once per graph and read by both pipelines. */
  readonly frame: SpriteFrameNodes;
  /** The base uv after every uv stage, built the first time a stage reads it. */
  readonly uv: Node<'vec2'>;
}

interface SpriteStage<T extends string> {
  /** Where in its slot this stage runs; lower runs first, a tie keeps the order of the feature list. */
  readonly order: number;
  transform(input: Node<T>, ctx: SpriteShaderContext): Node<T>;
}

interface SpriteTextureDeclaration {
  /** The texture counts as set only once its image has measures; `touchTexture(name)` re-reads it. */
  readonly needsImage?: boolean;
}

interface SpriteFeature<Api extends object = object> {
  /** Unique within a sprite kind; every error about the feature names it. */
  readonly name: string;

  /** Instance attributes, merged into the instanced description of the kind. */
  readonly attributes?: VertexAttributesType;
  /** Words a caller of `attributeUsage` may use for attributes of this feature: `{size: ['quadSize']}`. */
  readonly usageAliases?: Readonly<Record<string, readonly string[]>>;
  /** Methods of the sprite handle. */
  readonly methods?: Readonly<Record<string, SpriteMethod<Api>>>;
  /** Writes the neutral values into a slot `createVO()` hands out — slots come back with old data in them. */
  initialize?(this: Api): void;

  /** Uniforms the material holds for this feature: a start value, or `{value, shared: true}`. */
  readonly uniforms?: Readonly<Record<string, SpriteUniformValue | SpriteUniformDeclaration>>;
  /** Textures the material holds for this feature. They stay the caller's. */
  readonly textures?: Readonly<Record<string, SpriteTextureDeclaration>>;
  /** Textures the feature reads texel for texel; the sprites warn once about any other filter. */
  readonly nearestTextures?: readonly string[];

  // --- pipeline slots (§4.2) ---
  readonly frame?: (ctx: SpriteFrameContext) => SpriteFrameNodes;
  readonly frameStage?: SpriteFrameStage;
  readonly local?: SpriteStage<'vec3'>;
  readonly placement?: (local: Node<'vec3'>, ctx: SpriteShaderContext) => Node<'vec3'>;
  /** After the placement, in the local space of the mesh — the slot of shadows and mirrors (§6). */
  readonly mesh?: SpriteStage<'vec3'>;
  readonly uv?: SpriteStage<'vec2'>;
  readonly colorSource?: (frame: SpriteFrameNodes, ctx: SpriteShaderContext) => Node<'vec4'>;
  readonly color?: SpriteStage<'vec4'>;

  /** Other features by name that have to be part of the same sprite kind. */
  readonly requires?: readonly string[];
  /** Checks the kind the feature is part of and throws for one it cannot work in. */
  readonly checkKind?: (kind: SpriteKindShape) => void;

  /** Carries `Api` for the type of the sprite handle; never set at runtime. */
  readonly __api?: Api;
}

declare function defineFeature<Api extends object = object>(feature: SpriteFeature<Api>): SpriteFeature<Api>;
```

`defineFeature()` checks a feature on its own — every field for its type, with a `TypeError` naming
the feature and the field: a name, a record of attribute descriptions for `attributes`, of lists of
names for `usageAliases`, of functions for `methods` and of `{}` or `{needsImage: true}` for
`textures`, a record for `uniforms`, functions for `initialize`, `frame`, `placement`,
`colorSource` and `checkKind`, a finite `order` and a `transform` for every ordered stage, lists of
names for `nearestTextures` and `requires`, and no `requires` of its own name — and freezes it, the
records and lists inside included. `defineSprite()`, `definePass()` and the placement swap check a
feature that never passed through `defineFeature()` the same way. What can only be checked against
the other features of a kind, `defineSprite()` checks (§5.1). `frameStage`, `uv`, `checkKind` and
the shared uniform declaration came with
[`pipeline-stages-and-grid-base.md`](pipeline-stages-and-grid-base.md), `mirror` with
[`flip-anchor-nine-slice.md`](flip-anchor-nine-slice.md), `nearestTextures` with
[`table-frames-and-palette-swap.md`](table-frames-and-palette-swap.md).

A feature takes part in the graph only while every texture it declares is set — and, with
`needsImage`, has an image with measures. Until then the material builds the graph as if the
feature were not there: the frame falls back to its defaults, the color source to flat grey.

A stage reads through its context. `attribute(name)` answers an attribute of the kind or of the
base, `uniform(name)` a uniform any feature of the material declares, `sample(name, uv)` a lookup
into a texture the feature declares itself; the material throws, naming the feature, for any other
name. `textureSize(name)` and `colorSpace(name)` answer for a texture of any feature: the size of a
set texture is read on the gpu, of one declared with `needsImage` it is a uniform, and of an unset
texture of another feature it is `(0, 0)` — the stage does not wait for that texture.

### 4.2 The pipeline

Transformations do not commute — shear-then-rotate is a different sprite than
rotate-then-shear, and scale-then-rotate is the only order that keeps a rectangle a
rectangle. The order therefore belongs to the model, not to the order of the feature list.

```
frame:    frame slot (or defaults) ─▶ frame stages (by order) ─▶ SpriteFrameNodes, read by both pipelines
uv:       base.uv ─▶ uv stages (by order) ─▶ ctx.uv, built where a stage reads it
vertex:   base.position ─▶ trim shift (frame.trim) ─▶ local stages (by order) ─▶ placement ─▶ mesh stages (by order) ─▶ positionNode
fragment: colorSource(frame) ─▶ color stages (by order) ─▶ colorNode
```

| slot | cardinality | input → output | features of this proposal |
| --- | --- | --- | --- |
| `frame` | 0…1 | → `SpriteFrameNodes`; defaults as in §4.1 | `AtlasFrame`, `AnimatedFrames` |
| `frameStage` | 0…n, ordered | `SpriteFrameNodes` → `SpriteFrameNodes` | — |
| trim shift | built in, runs when `frame.trim` is set | `vec3` → `vec3` in the unit quad | — |
| `local` | 0…n, ordered | `vec3` → `vec3` in quad space | `QuadSize`, `Shear`, `Rotation` |
| `placement` | exactly 1, swappable at runtime (§5.2) | local `vec3` → mesh-local `vec3` | `FlatPlacement`, `BillboardPlacement` |
| `mesh` | 0…n, ordered | mesh-local `vec3` → `vec3` | `PlanarShadow`, `MirrorAtPlane` (§6) |
| `uv` | 0…n, ordered | `vec2` → `vec2` | — |
| `colorSource` | 0…1 | frame → `vec4`; default flat grey | `TextureColor` |
| `color` | 0…n, ordered | `vec4` → `vec4` | `Tint`, `ShadowMask`, `Darken` (§6) |

The guide's table under "The pipeline" lists the features of every later proposal in their slots.
`buildSpritePipeline()` sorts each ordered slot once per kind — and once per pass over a kind
(§6.2) — and refuses a second feature in a slot of at most one, naming both.

The **trim shift** is no stage of a feature. A frame with trim margins drawn without the
shift is always wrong, and the shift has to come before every other local step: it is
measured in the unit quad, so it has to be scaled with the sprite, and it has to flip and
turn with it. It moves each corner to its corner of the part the trimmed frame covers,
reading `uv` from the base:

```ts
const trimmedUv = add(trim.xy, mul(uv, sub(float(1), add(trim.xy, trim.zw))));
const shift = sub(trimmedUv, uv);
const shifted = add(position, vec3(shift.x, shift.y.negate(), 0)); // uv counts y downwards
```

Fixed order bands for the ordered slots, with room in between for features of your own:

```ts
export const FrameOrder = {Flip: 100} as const;
export const LocalOrder = {Anchor: 100, Flip: 150, Slice: 175, Scale: 200, Shear: 300, Rotate: 400} as const;
export const MeshOrder = {Offset: 100, Project: 200, Mirror: 300} as const;
export const UvOrder = {Slice: 100} as const;
export const ColorOrder = {Palette: 50, Tint: 100, Mask: 150, Fade: 200, Flash: 300, Pass: 1000} as const;
```

`ColorOrder.Pass` is the band of the color stages a pass brings to recolor the sprite as a whole,
after every color stage of the kind ([`fade-flash-axis-billboards.md`](fade-flash-axis-billboards.md)
§2.3). Two stages with the same `order` run in feature-list order — the sort is stable;
`defineSprite()` documents that rather than refusing it.

### 4.3 The features of the core

A method that hands values of its caller on writes them into a module-level scratch tuple
and calls the generated setter with it: V8 boxes a fractional value handed on as an argument to a
call it leaves un-inlined, and a property write through a generated accessor is such a call. `Api`
names everything the sprite handle carries for the feature, the generated accessors included,
because the methods and `initialize` call them through `this`.

```ts
const quadSizeScratch: [width: number, height: number] = [0, 0];

export const QuadSize = defineFeature<QuadSizeApi>({
  name: 'quadSize',
  attributes: {quadSize: {components: ['width', 'height']}},
  usageAliases: {size: ['quadSize']},
  methods: {
    setSize(width: number, height: number) {
      quadSizeScratch[0] = width;
      quadSizeScratch[1] = height;
      this.setQuadSize(quadSizeScratch);
    },
  },
  initialize() {
    this.setQuadSize(0, 0);
  },
  local: {order: LocalOrder.Scale, transform: (position, {attribute}) => mul(position, vec3(attribute<'vec2'>('quadSize'), 1))},
});

export const Rotation = defineFeature<RotationApi>({
  name: 'rotation',
  attributes: {rotation: {size: 1, usage: 'dynamic'}},
  initialize() {
    this.rotation = 0;
  },
  local: {order: LocalOrder.Rotate, transform: (position, {attribute}) => rotate(position, vec3(0, 0, attribute<'float'>('rotation')))},
});

export const Shear = defineFeature<ShearApi>({
  name: 'shear',
  // the generated setter of `shear` is setShear()
  attributes: {shear: {components: ['shearX', 'shearY'], usage: 'dynamic'}},
  initialize() {
    this.setShear(0, 0);
  },
  local: {
    order: LocalOrder.Shear,
    transform: (position, {attribute}) => {
      const shear = attribute<'vec2'>('shear');
      return vec3(add(position.x, mul(position.y, shear.x)), add(position.y, mul(position.x, shear.y)), position.z);
    },
  },
});

// the attribute is named `color`, with setColorValues() as its setter and no generated getter
export const Tint = defineFeature<TintApi>({
  name: 'tint',
  attributes: {color: {components: ['r', 'g', 'b', 'a'], setter: 'setColorValues', getter: false}},
  methods: {
    setColor(color: Color, a?: number) {
      /* r, g, b — and a, when given — through a scratch tuple each; without an a the sprite keeps its alpha */
    },
    getColor(target: Color = new Color()) {
      return target.set(this.r, this.g, this.b);
    },
  },
  initialize() {
    this.setColorValues(1, 1, 1, 1);
  },
  color: {order: ColorOrder.Tint, transform: (color, {attribute}) => mul(color, attribute<'vec4'>('color'))},
});

// the data of a placement, kept apart from the placements so that they can stand in for each other
export const InstancePosition = defineFeature<InstancePositionApi>({
  name: 'instancePosition',
  attributes: {instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'}},
  usageAliases: {position: ['instancePosition']},
  methods: {
    setPosition(x: number, y: number, z?: number) {
      /* through a scratch tuple of three, or of two without a z: the sprite keeps the z it has */
    },
  },
  initialize() {
    this.setInstancePosition(0, 0, 0);
  },
});

// flatPlacement() builds it, one frozen feature per set of options
export const FlatPlacement = defineFeature({
  name: 'flatPlacement',
  requires: ['instancePosition'],
  placement: (local, {attribute}) =>
    vertexByInstancePosition({vertexPosition: local, instancePosition: attribute<'vec3'>('instancePosition')}),
});

export const AtlasFrame = defineFeature<AtlasFrameApi>({
  name: 'atlasFrame',
  attributes: {
    texCoords: {components: ['s', 't', 'u', 'v']},
    texFlipDiagonal: {size: 1},
    texTrim: {components: ['trimLeft', 'trimTop', 'trimRight', 'trimBottom']},
  },
  // setFrame() writes the three together, so they upload together
  usageAliases: {texCoords: ['texFlipDiagonal', 'texTrim']},
  methods: {
    setFrame(frame: TextureAtlasFrame<unknown>) {
      this.setTexCoords(frame.coords.getTexCoords(texCoordsScratch));
      this.texFlipDiagonal = frame.coords.flipD ? 1 : 0;
      this.setTexTrim(frameTrimMargins(frame.data, trimScratch));
    },
    setPreparedFrame(prepared: PreparedSpriteFrame) {
      this.setTexCoords(prepared.texCoords);
      this.texFlipDiagonal = prepared.texFlipDiagonal;
      this.setTexTrim(prepared.texTrim);
    },
  },
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
  // st = texCoords.xy + uv · texCoords.zw, swapped by the flip, passed through a varying
  colorSource: (frame, {uv, sample}) => sample('colorMap', frameUv(frame.texCoords, uv, frame.flipDiagonal)),
});

export const AnimatedFrames = defineFeature<AnimatedFramesApi>({
  name: 'animatedFrames',
  attributes: {anim: {components: ['animId', 'animOffset']}},
  // shared: a wave, a bob or a particle of another feature reads the same time
  uniforms: {time: {value: 0, shared: true}},
  textures: {animsMap: {needsImage: true}},
  initialize() {
    this.animId = 0;
    this.animOffset = 0;
  },
  // the header texels, the frame and its texels for tex coords, flip and trim, all through
  // ctx.sample('animsMap', ...), at ctx.uniform('time') + animOffset
  frame: (ctx) => ...,
});
```

`prepareSpriteFrame(frame)` works out once what `setFrame()` writes, for `setPreparedFrame()`;
`frameTrimMargins()` reads the margins out of TexturePacker data and answers zeros for every
other. The playback of `AnimatedFrames` — loop, once, ping-pong, per-frame durations — is
[`animation-playback-and-aseprite.md`](animation-playback-and-aseprite.md).

`initialize` writes the values of a slot no sprite has stood in — 0 everywhere — except
where 0 is not neutral: the tint starts white.

`BillboardPlacement` maps the local vertex through `billboardVertexByInstancePosition()`. It
receives the already trimmed, scaled, sheared and rotated vertex and lays its x and y onto the
camera's right and up vectors in the local space of the mesh. It hands the helper a scale of
`vec3(1, 1, 1)` for that reason; the helper's fallback to the `quadSize` attribute is for a caller
of the public helper that hands it none.

Billboards are a common case, not an exotic one, so `BillboardPlacement` is a first-class
placement next to `FlatPlacement`. Neither declares data of its own: both require the
`InstancePosition` feature and contribute nothing but their `placement` stage, and so stand
in for each other on a live material (§5.2). A kind lists one of them, and a mesh switches
between flat sprites and billboards without a kind of its own for each. `GroundPlacement` and the
turned forms of `flatPlacement()` ([`flat-placement-orientation.md`](flat-placement-orientation.md)),
`axisBillboardPlacement()` ([`fade-flash-axis-billboards.md`](fade-flash-axis-billboards.md)) and
`segmentPlacement()` ([`wave-and-segment-sprites.md`](wave-and-segment-sprites.md)) follow the same
rule.

## 5. Assembly

### 5.1 `defineSprite`

```ts
interface SpriteKind<Api extends object = object> {
  readonly base: SpriteBase;
  readonly features: readonly SpriteFeature[];
  /**
   * The merged instanced description. One object per kind, so every geometry of the kind built
   * without `attributeUsage` shares one descriptor and one prototype.
   */
  readonly description: VertexObjectDescription;
  /** The `usageAliases` of every feature, for `attributeUsage`. */
  readonly usageAliases: Readonly<Record<string, readonly string[]>>;
  /** The features by slot, every ordered slot sorted. */
  readonly pipeline: SpritePipeline;
  /** Carries the type of the sprite handle; never set at runtime. */
  readonly __api?: Api;
}

/** The sprite handle a pool of kind `K` hands out. */
type SpriteOf<K> = K extends SpriteKind<infer Api> ? Api & VO : never;
/** The sprite handle without its `VO`: the type argument of FeatureSprites, its geometry and its material. */
type SpriteKindApiOf<K> = K extends SpriteKind<infer Api> ? Api : never;

declare function defineSprite<const F extends readonly SpriteFeature[]>(options: {
  readonly base: SpriteBase;
  readonly features: F;
}): SpriteKind<SpriteApiOf<F>>;
```

`SpriteApiOf<F>` is the intersection of the `__api` of the features. What `defineSprite()`
checks, in this order, each refusal naming the features involved:

1. The options — an object with a base and an iterable of features —, and every feature on its
   own as `defineFeature()` checks it, since a plain object passes for a feature.
2. The base contract: a `position` of 3 values, a `uv` of 2, a `make()` on the `basePrototype`.
3. Unique feature names — where two features share one, the `checkKind` of the first is asked
   first, so that the forms of one factory can say why a kind takes only one of them — and every
   `requires`.
4. The pipeline: exactly one placement, at most one frame and one color source, and a placement
   that declares no textures, since the placement runs always and cannot wait for one.
5. Uniforms and textures: a name is declared by one feature — unless every feature that declares
   it declares it shared, with the same type and start value — and a start value is a number or 2
   to 4 numbers (`collectSpriteDeclarations()`).
6. Attributes and sprite-handle properties: an attribute name is unique across the features and
   none of the base, and every property the attributes generate or a method names is given by one
   feature, once. Then the usage aliases: a word names attributes of its own feature, is unique
   across the kind — but for a word named after an attribute whose feature declares it, which the
   other features may add attributes of their own to — and is never named after an attribute of a
   feature that does not declare it.
7. The layout: the attributes of each feature on their own, then the merged description through
   `sharedVertexObjectDescriptor()` — the descriptor every pool of the kind takes over, built once
   from the very object the kind hands out. A failure names the attributes of the message with
   their features.
8. Last, the `checkKind` of every feature, in the order of the list, shown `{base, features}`.

The merged description carries the attributes, the methods of every feature and one
`basePrototype` whose `[voInitialize]` calls every feature's `initialize` in feature-list order,
in an index loop that allocates nothing. `methods` cannot carry the hook:
`createVertexObjectPrototype` copies `Object.entries(methods)`, which skips symbol keys. The
prototype carries nothing else, so rule 9 of the descriptor has nothing to refuse.

A sprite kind is frozen all the way down: its feature list, its pipeline and its description — a
copy of its own, every attribute description in it, so that nothing written to the attributes of a
feature reaches the kind. The base and the features stay as their authors left them; every feature
out of `defineFeature()` is frozen as deep, and so are `QuadBase` and every base of `gridBase()`,
the prototype of their base vertex included. Adding a feature means defining a new kind, which is
cheap: it is a description and a sorted pipeline, not a GPU resource. Every kind brings a prototype
of its own, so one loop over the sprites of more than four kinds is megamorphic — as is one over
sprites of geometries built with `attributeUsage`, each of which shares its prototype with no
other.

### 5.2 Geometry, material and mesh

- **`FeatureSpritesGeometry`** — `InstancedVertexObjectGeometry<Api & VO, SpriteBaseVO>`, built
  from `kind.description` and `kind.base`, `new FeatureSpritesGeometry(kind, capacity)` or
  `new FeatureSpritesGeometry(kind, {capacity = 100, attributeUsage, baseArgs})`. It calls `make()`
  of the one base vertex object with `baseArgs`, the `defaultArgs` of the base without them. With
  `attributeUsage` it copies the description through `cloneVertexObjectDescription()`, the usage
  words of the kind as its aliases, and refuses a name that is neither an attribute nor a usage
  word of the kind, listing those it knows; such a geometry shares its prototype with no other.
  Before anything is built it refuses with a `TypeError` a kind that did not come from
  `defineSprite()` — a kind is told by where it came from, not by its shape, since a copy of a
  kind ran none of the checks of `defineSprite()` —, parameters that are neither a number nor an
  object, `baseArgs` that are no list and an `attributeUsage`
  that is no object of name lists; a `baseArgs` or `attributeUsage` of `null` counts as not handed
  in.
- **`SpriteResources`** — the uniforms and textures a set of features declares, held once: one
  uniform node per declared uniform, at its start value or the one handed in, written by
  `setUniform(name, x, y?, z?, w?)`, which allocates nothing and keeps working after `dispose()`;
  per declared texture a signal, a memo of its shape over `textureShapeKey()` — `undefined` for a
  texture declared with `needsImage` until its image has measures — and a size uniform kept
  current. `setTexture()`, `getTexture()` and `touchTexture()` take the declared names; a texture
  stays the caller's. `dispose()` destroys the size effects first, clears the textures while their
  signals live and then deletes its signal group. Before any signal exists it refuses, in the words
  of the `where` it is handed, `features` that are no iterable, a feature as `defineFeature()`
  refuses it, options that are no object and `textures` or `uniforms` that are no object by name.
- **`FeatureSpritesMaterial`** — a `NodeMaterial` built from the kind,
  `new FeatureSpritesMaterial(kind, {name, textures, uniforms, placement, resources, pass, …})`,
  every other option a three.js material parameter for `setValues()`, without `positionNode` and
  `colorNode`, behind the `isMaterial?: never; isTexture?: never` guard. It refuses with a
  `TypeError`, before `super()`, a kind that did not come from `defineSprite()` and options that
  are no object (`null` included), and `resources` that are no `SpriteResources`. It builds:
  - its `SpriteResources` from `textures` and `uniforms`, or takes `resources` handed in — which
    stay the caller's, are refused next to `textures` or `uniforms`, refused once disposed and
    refused when they lack what a feature declares
  - one memo for the frame — the frame slot and every frame stage — rebuilt when the shape of a
    texture they declare changes; the position and the color effect both read it, so a change
    rebuilds each graph once
  - `positionNode` and `colorNode` in one effect each, folding the sorted stages over the input
  - an effect that hands a new texture of the same kind to every node `ctx.sample()` built,
    without a rebuild
  - a `placement` signal that starts with the placement of the kind, or the `placement` option.
    Another feature takes its place only when it contributes a `placement` stage and nothing else
    but a `name`, `requires` and `checkKind` — no attributes, methods, uniforms or textures, which
    the sprite handle and the material were built without —, the kind holds every feature it
    `requires`, and its `checkKind` takes the kind with it in place of the kind's placement;
    otherwise it throws, naming both features. The placement of the kind always comes back. A
    change rebuilds the position graph, and three serves a source it has built before from its
    caches
  - `uniforms` and `setUniform()`, `setTexture()`, `getTexture()` and `touchTexture()`, which pass
    through to its resources
  - the default `alphaTestNode` of `float(0.001)`, unless an `alphaTest` or `alphaTestNode` is
    given

  `dispose()` follows `docs/resource-lifecycle.md`: the effects and the frame memo go first, then
  the resources the material built, then its signal group, then three's `dispose()`. A constructor
  that throws deletes the group and the resources it built before it rethrows. Textures stay the
  caller's.
- **`FeatureSprites`** — the `VertexObjects` mesh of a kind, `new FeatureSprites(kind, options)`,
  its options those of the geometry and of the material side by side, plus `geometry`, `material`
  and `passes` (§6). It builds the geometry and the material it is not handed and owns exactly
  those; a kind that did not come from `defineSprite()`, options that are no object, `passes` that
  are no list, a `grow` that is no boolean, a `geometry` or `material` that is no
  `FeatureSpritesGeometry` or `FeatureSpritesMaterial`, one of another kind, and parameters that
  would build one next to one handed in, are refused with a `TypeError`. What the geometry and the
  material refuse of the options they refuse in their own name; what the uniforms and textures
  refuse, in the name of the class that builds them — `FeatureSpritesMaterial` without passes,
  `FeatureSprites` with them, which builds the resources every material shares. A refused
  constructor leaves nothing behind.
  `createSprite()` answers a sprite at the values of an unused slot, or `undefined` once the pool
  is full — and says so once on the console —; `freeSprite()` gives one back, the last sprite
  moving into its slot; `spritePool` is the pool. `placement`, `uniforms`, `setUniform()` and the
  textures pass through to the material of the sprites. `dispose()` takes the mesh out of the scene
  graph, fires three's `dispose` event, and releases the pass meshes, the geometry and the material
  it built and the shared resources. `grow`, `sortBy()`, `sortByViewDepth()`, `bindUniform()` and
  the slots that follow a geometry put into them are the later proposals named in the status.

The graphs depend on the kind and on the kinds of the textures, not on the material: two meshes
of one kind with textures of the same kind produce the same shader source, and the second comes
out of the renderer's program and pipeline caches.

### 5.3 The presets

```ts
export const TexturedSpriteKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint],
});

export const AnimatedSpriteKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AnimatedFrames, TextureColor],
});

export type TexturedSprite = SpriteOf<typeof TexturedSpriteKind>;
export type AnimatedSprite = SpriteOf<typeof AnimatedSpriteKind>;
```

The presets take the place of `TexturedSprites` and `AnimatedSprites`, which are removed with
their geometries, materials, descriptors and `BaseSprite`; the guide's "Migrating from
TexturedSprites and AnimatedSprites" maps every old name to the new one. What the presets keep of
the sprites of earlier versions:

- the attribute names (`instancePosition`, `quadSize`, `rotation`, `texCoords`,
  `texFlipDiagonal`, `texTrim`, `color`, `anim`), in their buffers and their order, so
  `touch()` / `touchVO()` calls keep working (`src/sprites/presets.spec.ts`)
- the methods of the sprite handles, `setColor()`, `getColor()` and `setPreparedFrame()` among
  them, and the start values of `createSprite()`: 0 everywhere, white as the tint
- the `attributeUsage` words `size`, `position` and `texCoords`

`AnimatedSpriteKind` has no `Tint`: the animated sprites never had a color of their own, and a kind
with one more feature is a `defineSprite()` away. The `renderAsBillboards` switch is the placement:
`sprites.placement = BillboardPlacement`, or `placement: BillboardPlacement` among the options.

## 6. Several passes over one sprite: shadows and reflections

A sprite that throws a shadow onto the ground or shows a reflection on it is drawn twice:
once as itself, once as its shadow or mirror image. The second draw reads the same sprites
— the same positions, sizes, rotations and frames — and differs in its shader alone: the
vertex lands somewhere else (projected onto the ground, mirrored at it), and the color is
something else (the color map turned into a dark mask, or darkened and faded). More than two
draws are the same thing again: a shadow and a reflection at once, or one shadow per light.

### 6.1 One pool, one geometry, one mesh per pass

The second draw needs no data of its own, so it gets no pool of its own, and no geometry of its
own either:

- **Several meshes over one geometry.** Every pass is a mesh over the geometry of the
  sprites, with a material of its own. The sprite data lives in one pool and goes up to the
  gpu once per frame, whatever the number of passes; each pass costs one draw call.
- **`update()` once per geometry.** `VertexObjects#update()` asks for every buffer with
  `autoTouch` on each call, so two meshes that both call it would upload the dynamic buffers twice
  per frame. The pass meshes are therefore `FeatureSpritesPass` meshes without an `update()` of
  their own, and `FeatureSprites#update()` updates the shared geometry once for all of them.
- **A pass that needs another base** — a blob shadow on a quad of its own, a subdivided quad for a
  long shadow — is not built. `InstancedVertexObjectGeometry` takes a `VertexObjectPool` for its
  instances, and a pool counts the geometries attached to it, so such a pass could draw a geometry
  of its own over the *same instanced pool*: the data still written once, uploaded once per
  geometry.

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
  /** Features of the kind whose stages this pass leaves out, by name. */
  readonly without?: readonly string[];
  /** three.js material parameters of this pass: `transparent`, `depthWrite`, `polygonOffset`, … */
  readonly material?: Omit<NodeMaterialParameters, 'positionNode' | 'colorNode'>;
  /** Drawn before the sprites with a lower value; a shadow takes a negative one. */
  readonly renderOrder?: number;
  /** The uniforms of the features of this pass under other names — see sprite-uniform-bindings.md. */
  readonly uniformNames?: Readonly<Record<string, string>>;
  /** Whether the pass is drawn in this frame, judged by `FeatureSprites#update()`. */
  readonly visible?: (uniform: (name: string) => SpriteUniformNode) => boolean;
}

declare function definePass(pass: SpritePass): SpritePass;
```

`definePass()` checks what a pass can be checked for on its own and freezes it, with frozen copies
of `features`, `without`, `material` and `uniformNames`: an object with a name, a `visible` that is a
function, `features` as a list of features of distinct names, each checked as `defineFeature()`
checks one, **no data** — a feature of a pass brings no attributes, methods, `initialize` or usage
aliases, since the pool and the sprite handle are those of the kind —, at most one placement among
the features, a `without` as a list of names that names none twice, `uniformNames` and `material` as
objects, and a `renderOrder` that is a finite number (`TypeError`, a `RangeError` for the
`renderOrder`). The sprites run the same check for a pass that never went through `definePass()`. The `visible` hook and the renames of `uniformNames` are
[`sprite-uniform-bindings.md`](sprite-uniform-bindings.md) §5 and §6.

What only a kind can tell is checked where a material of the pass is built — by
`FeatureSprites` before it builds anything: `without` names features the kind holds and never its
placement, every `requires` of a pass feature is met by the kind or the pass, and last the
`checkKind` of every pass feature runs against the features the pass draws with. Those are the
features of the kind without the ones `without` names, plus the features of the pass; a pass that
brings a placement draws with it, and the placement feature of the kind stays with its data and
without its placement stage for that pass alone.

All data a pass reads comes from a feature of the kind, and `requires` makes the kind hold it. A
feature that holds nothing but data is nothing new: `InstancePosition` is one. A `ShadowCaster`
with a per-sprite shadow strength or height above the ground would be another, and the sprites
themselves would never read it — it would cost every sprite of the kind its bytes, also without a
shadow pass.

Projections and mirrors work on the placed vertex, after `placement`, so that the shadow of
a billboard is the shadow of the billboard the camera sees. That takes a slot of its own,
the `mesh` stages of §4.2, ordered by `MeshOrder`. The sprites themselves normally have no mesh
stage; a kind may still carry one — `wave()` sways sprites in the wind.

### 6.3 The passes

```ts
// projects the placed vertex from the homogeneous light shadowLight onto the plane dot(n, p) = d
export const PlanarShadow = defineFeature({
  name: 'planarShadow',
  uniforms: {shadowLight: [-0.4, 1, -0.3, 0], groundPlane: [0, 1, 0, 0]},
  mesh: {order: MeshOrder.Project, transform: (p, {uniform}) => /* see sprite-uniform-bindings.md §4 */ ...},
});

// keeps the coverage of the color, takes the color of the shadow — after every color stage of the kind
export const ShadowMask = defineFeature({
  name: 'shadowMask',
  uniforms: {shadowColor: [0, 0, 0, 0.5]},
  color: {
    order: ColorOrder.Pass,
    transform: (c, {uniform}) => vec4(uniform<'vec4'>('shadowColor').rgb, mul(c.a, uniform<'vec4'>('shadowColor').a)),
  },
});

export const ShadowPass = definePass({
  name: 'shadow',
  features: [LightFacingPlacement, PlanarShadow, ShadowMask],
  material: {transparent: true, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1},
  renderOrder: -1,
  visible: shadowFallsOnPlane,
});

export const ReflectionPass = definePass({
  name: 'reflection',
  features: [MirrorAtPlane, Darken],
  material: {transparent: true, depthWrite: false, side: DoubleSide},
  renderOrder: -1,
});

export const BillboardReflectionPass = definePass({...ReflectionPass, features: [MirroredBillboardPlacement, MirrorAtPlane, Darken]});

const sprites = new FeatureSprites(HeroKind, {capacity: 1000, textures: {colorMap}, passes: [ShadowPass]});
sprites.setUniform('shadowLight', -0.5, 1, -0.3, 0);
```

- **`ShadowPass`** turns every sprite about its instance position to face the light
  (`LightFacingPlacement`, which reads the uniforms of `PlanarShadow` and requires it) and
  projects it onto `groundPlane` in `shadowColor`, its alpha multiplied by the alpha of the
  sprite. It keeps the tint of the kind, so it draws `AnimatedSpriteKind`, which holds none, as
  well. Its hook `shadowFallsOnPlane` leaves it out for a frame whose light does not fall onto the
  side of the plane its normal points to.
- **`ReflectionPass`** mirrors the placed vertex at `mirrorPlane` (`MirrorAtPlane`) and multiplies
  the color by `reflectionColor`, alpha included (`Darken`, in `ColorOrder.Pass`). A reflection
  needs no flip of its own: mirroring the placed vertex at the ground turns the sprite upside down
  and keeps the frame where it is.
- **`BillboardReflectionPass`** places every billboard so that its reflection faces the camera
  (`MirroredBillboardPlacement`) and keeps its placement through a placement swap of the sprites;
  it is named `reflection`, as `ReflectionPass` is, and takes its place.
- **`SegmentShadowPass`** is `ShadowPass` without the turn to the light, for segment sprites and
  decals ([`wave-and-segment-sprites.md`](wave-and-segment-sprites.md)).

A plane is `[n.x, n.y, n.z, d]` in the local space of the mesh, and `n` need not be a unit vector;
a plane whose normal is `(0, 0, 0)` sends every vertex to the origin, and the pass draws nothing.
Every shipped pass draws both sides of a triangle: a mirror turns the winding of every triangle,
a projection turns it whenever the shadow falls towards the camera, and three culls by the side of
the material alone. `ShadowPass` lies exactly in `groundPlane`, and its polygon offset pulls it in
front of a ground mesh in that plane.

### 6.4 What the passes share

- **Uniforms and textures.** The shadow of an animated sprite has to show the frame the
  sprite shows, so `time` is one uniform for all passes, and `colorMap` and `animsMap` are
  one texture each. `FeatureSprites` builds one `SpriteResources` from the features of its kind
  and the stage features of every pass and hands it to the material of the sprites and to each
  pass material; `setUniform()` and `setTexture()` of the sprites reach every pass. Two features
  that declare the same name — in the kind or in a pass — are refused when the sprites are built,
  unless both declare it shared; so are two passes of one name, and passes next to a `material`
  handed in, since they share the resources of a material the sprites build.
- **The placement.** A pass that brings no placement draws with the placement of the sprites, and
  starts with the one they start with. `FeatureSprites#placement` checks a new placement against
  every pass first, then writes it into the material of the sprites, then into every pass material
  that draws with the placement of the sprites; a pass that brings its own keeps it, and a
  placement the material of the sprites refuses reaches no pass.
- **Transform and lifetime.** The pass meshes are children of the sprite mesh, so they move
  with it and leave the scene graph with it. `passes` answers them by pass name, in a frozen record
  without a prototype. They are handed the geometry and own none of it; `FeatureSprites#dispose()`
  takes each out of the mesh, fires its `dispose` event and releases its material, then the shared
  resources after every material that read them.

Two passes of one kind produce two shader sources; a second `FeatureSprites` with the same
kind and the same passes comes out of the renderer's caches as in §5.2.

## 7. Tests

- Vitest, next to the sources. `src/sprites/SpriteFeature.spec.ts`: what `defineFeature()`
  refuses. `src/sprites/defineSprite.spec.ts`: the merge into one description, `initialize`
  running in feature-list order for a reused slot, `freeVO()` moving every feature's attributes
  together, one descriptor and one prototype for every pool of a kind, the stage order including
  ties, and every refusal of §5.1, naming both features. `src/sprites/spriteDeclarations.spec.ts`:
  the uniforms and textures across features and passes. `src/sprites/presets.spec.ts`: the
  attributes of the presets, in their buffers and order.
- `src/sprites/FeatureSprites/`: `FeatureSpritesGeometry.spec.ts`, `SpriteResources.spec.ts`;
  `FeatureSpritesMaterial.spec.ts` — the position and the color graph, a feature whose texture is
  not set dropping out, a texture of the same kind building nothing, `material.placement` refusing
  a feature that brings more than a placement stage or whose `requires` the kind does not meet,
  `dispose()`; `FeatureSprites.spec.ts` — ownership, refusals, a constructor that throws leaving
  nothing behind, and the passes: one child mesh each, shared uniforms and textures, the placement
  swap, a dynamic buffer uploaded once per frame with two passes; `presetGraphs.spec.ts` — the
  graphs of the presets against a fixture.
- `src/sprites/features/local-transforms.spec.ts`, `frame-and-color.spec.ts` and
  `placement.spec.ts` hold the features of §4.3; `src/sprites/passes/definePass.spec.ts` and
  `pass-features.spec.ts` the passes of §6.
- Allocations: `src/sprites/hot-path-allocations.spec.ts` measures the setters of both presets per
  call — moving, turning, re-framing, tinting, animating.
- Browser (`packages/twopoint5d-testing`, every file under WebGPU and WebGL 2): the presets in
  `sprites-rotation.test.js`, `sprites-billboard.test.js`, `sprites-rotated-frames.test.js`,
  `sprites-trimmed-frames.test.js`, `sprites-textured-material.test.js` and
  `sprites-animated-material.test.js`; a non-square sprite through `QuadSize`, `Shear` and
  `Rotation` on a trimmed frame, flat and as a billboard on one live material, in
  `sprites-composition.test.js`; the shadow and the reflection in `sprites-shadow-pass.test.js` and
  `sprites-reflection-pass.test.js` — the shadow covers the projected box in the shadow color,
  follows a placement swap, and shows the frame of the sprite at the same `time`. Reading back
  boxes and cell colors from a render target needs no reference images and survives the WebGL 2
  fallback.

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
[`pool-groups.md`](pool-groups.md) carries the idea on.

## 9. Open questions

1. ~~**Attribute names.**~~ Decided: plain names (`rotation`), which read well and keep the names
   of the sprites of earlier versions; `defineSprite()` refuses a collision at definition time,
   naming both features. A namespace per feature (`rotation_angle`) would rule out collisions
   between third-party features and is not built.
2. **Per-kind order overrides.** Is a fixed `order` per feature enough, or does a kind need
   to reorder (e.g. shear after rotation for an italic effect)? Proposal: allow
   `defineSprite({..., order: {shear: 450}})` only if a use case shows up. The trim shift
   stays first either way. Not built.
3. ~~**Stages in the fragment shader that read instance attributes.**~~ Answered by the browser
   tests: `Tint` reads its `color` through `attribute()` of the shader context in a color stage,
   and `sprites-textured-material.test.js` reads the tinted pixels back under WebGPU and WebGL 2;
   `Fade` and `Flash` read attributes of their own the same way (`sprites-fade-flash.test.js`).
4. ~~**`map2d` tiles.**~~ Out of scope: the tiles are a strand of their own. For that strand:
   `TileSpritesGeometry` has a base that breaks the contract of §4.1 — it lies on the XZ
   plane with its origin in a corner, and `TileSpritesMaterial` scales by
   `vec3(width, 0, height)`. Its frame has tex coords and a diagonal flip but no trim, and
   every attribute is `dynamic` with `autoTouch: false`.
5. ~~**`color` vs. `tint`.**~~ Decided: the feature is called `Tint`, its attribute keeps the
   name `color` and the api of the textured sprites — `setColorValues`, `setColor()`,
   `getColor()` — so `TexturedSpriteKind` and every `touch('color')` keep working (§4.3).
6. ~~**Placement at runtime.**~~ Decided: `FeatureSpritesMaterial#placement` swaps the
   placement on a live material among features that contribute nothing but a placement
   stage and whose `requires` the kind meets (§4.3, §5.2); `FeatureSprites#placement` takes the
   passes along (§6.4). Answered by the browser tests: `sprites-composition.test.js` draws one live
   material flat and as a billboard, and `sprites-shadow-pass.test.js` draws the shadow of a
   billboard after a swap on the sprites, under WebGPU and WebGL 2.
7. **Overlapping shadows.** Two transparent shadows that overlap darken each other twice,
   which a real shadow does not. A stencil test per pass, or the shadow pass drawn into a
   render target of its own and laid over the ground once, would avoid it; both lie outside
   the feature model and wait for the first scene that needs them.
8. **The placed position in the fragment stage.** A reflection that fades with its distance
   from the ground needs the placed vertex in the color stages. Proposal: `ctx.placedPosition`,
   passed through a varying, built only when a stage reads it. Not built; `ReflectionPass` fades
   evenly, by the alpha of `reflectionColor`.
