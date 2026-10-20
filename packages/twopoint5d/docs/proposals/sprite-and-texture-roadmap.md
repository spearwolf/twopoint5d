# Proposal: what comes after the feature sprites — a review of the board lists "sprites" and "texture-mapping"

Status: **phases A, B and C implemented** — phase A: `Fade`, `Flash`,
`axisBillboardPlacement()`, the warning of a full pool, the free-tex-packer fixture and the glow
recipe, see [`fade-flash-axis-billboards.md`](fade-flash-axis-billboards.md); phase B: playback
modes, per-frame durations and `AsepriteJson`, see
[`animation-playback-and-aseprite.md`](animation-playback-and-aseprite.md); phase C: frame stages,
uv stages, `gridBase()` and shared uniforms, see
[`pipeline-stages-and-grid-base.md`](pipeline-stages-and-grid-base.md). **Phase F, part 1
implemented** — sorting a pool, `sortBy()` and `sortByViewDepth()` of the sprites (§4.15, and the
answer to §7 question 5); see [`pool-sorting.md`](pool-sorting.md). **Phase F, part 2
implemented** — growing capacity, `grow: true` of the sprites and `VertexObjectPool#adoptVOs()`
(§4.16); see [`growing-capacity.md`](growing-capacity.md). **Phase F, part 3 implemented** —
GPU picking, `SpritePicker` (§4.10); see [`gpu-picking.md`](gpu-picking.md). The rest is an idea, nothing
scheduled. A review, not a build plan: it checks the open cards of the
lists `sprites` and `texture-mapping` (and, since the sprites stand on them, `vertex-objects`)
of the Trello board `twopoint5d` against the library as of v0.23.0, and proposes what to build
next, what to close and what to leave out. Every proposal in §4 is a sketch; the one that gets
built first gets a proposal of its own, as [`sprite-features.md`](sprite-features.md) and its
successors did.

The board was read on 2026-10-20. The code blocks are excerpts of APIs that do not exist yet and
are not checked.

## 1. The yardstick

Every idea below was weighed from four sides. A proposal that fails one of them is cut or
reshaped in §5.

1. **Is it an extension of the model, or a second model?** The sprites are a base, features and
   passes ([`docs/sprites.md`](../sprites.md)). An idea that fits as a feature, a pass, a base or
   a texture helper is cheap to learn and composes with everything else. An idea that needs its
   own mesh class, its own pool or its own update loop has to earn that.
2. **Does a 2D or 2.5D game, or an old-school demo, actually need it?** Not "could someone use
   it", but: which genre, which effect, how often. A platformer needs a sprite that faces left;
   an Amiga-style demo needs a sine scroller, vector balls and color cycling; a top-down RPG
   needs draw order by y.
3. **Is it general without being a framework?** One knob too many and the API becomes a
   configuration language; one too few and the feature only serves the demo it was built for.
4. **Would a coding agent use it, or write its own?** The library exists so that a developer —
   human or agent — reaches for it instead of hand-rolling a shader. That holds only when the
   use is a few lines a guide can show in one `ts check` block, the feature is discoverable by
   the name of the problem (`Flip`, not `UvMirrorStage`), and the error of a misuse names the
   fix. An API that needs the reader to understand the TSL graph to use it loses to a 40-line
   `ShaderMaterial` the agent writes itself, every time.

The fourth point is the sharpest. It cuts both ways: a feature too small to bother — `Fade` is
eight lines in the guide — still belongs in the library when every game needs it, because an
agent copies the example into every project and the copies drift. A feature too large to read —
octahedral impostors — does not belong, however impressive.

## 2. Where the library stands

v0.23.0 shipped the feature model and three proposals on top of it. What a sprite can do today:

| area | what exists |
| --- | --- |
| model | `defineFeature()`, `defineSprite()`, `SpriteOf<>`, `QuadBase` and the `SpriteBase` contract, the slots frame / local / placement / mesh / colorSource / color with the order bands `LocalOrder`, `MeshOrder`, `ColorOrder` |
| data | `InstancePosition`, `QuadSize`, `Shear`, `Rotation`, `Yaw`, `Orientation`, `Tint`, `AtlasFrame` (trim, diagonal flip, `prepareSpriteFrame()`), `AnimatedFrames` (animsMap, `time` uniform) |
| placement | `flatPlacement()` in `'xy'` / `'xz'` with no turn, a yaw or a quaternion; `BillboardPlacement` (spherical, faces the camera); the swap on a live material |
| passes | `definePass()`, `ShadowPass` (light-facing, homogeneous light, `shadowFallsOnPlane`), `ReflectionPass`, `BillboardReflectionPass`, `uniformNames`, `visible` hooks, `enabled` |
| scene graph | `bindUniform()`, `planeOf()`, `lightOf()`, `SpriteUniformSource` |
| textures | `TextureAtlas`, `TexturePackerJson` (hash and array, trimmed, rotated), `TileSet`, `FrameBasedAnimations` (by frames, tile ids, tile range, atlas query; `bakeDataTexture()`), `TextureStore` catalogs, `TextureFactory` classes, `AtlasFrameTable` + `sampleAtlasFrame()` for meshes of one's own |
| core | `VertexObjectPool` with `usage` and `autoTouch` per attribute, `attributeUsage` on the geometry, upload ranges, allocation-free setters |
| stage | `createBloomOutputNodeBuilder()` over the composition of a `StageRenderer` |

Two things in that table are promises the library has not kept yet: the bands `LocalOrder.Anchor`,
`LocalOrder.Flip`, `ColorOrder.Fade` and `ColorOrder.Flash` exist, and no built-in feature sits
in any of them. The guide's own example of a feature is `Fade` — which every project will now
copy.

## 3. The cards against the code

### 3.1 List `sprites`

| card | state on the board | reality | proposal |
| --- | --- | --- | --- |
| common-sprite-api interfaces | done | `SpriteFeature`, `SpriteOf<>`, presets | — |
| textured sprites | done | `TexturedSpriteKind` | — |
| animated sprites | done | `AnimatedSpriteKind` | playback modes and per-frame durations: §4.4 |
| billboard sprites | done | `BillboardPlacement` | — |
| billboard shadow sprites | done | `ShadowPass` | — |
| billboard/sprite reflections | done | `ReflectionPass`, `BillboardReflectionPass` | — |
| 2.5d billboard shadows | done | `LightFacingPlacement` | — |
| **directed billboards** | open | only spherical billboards | **§4.2 axis billboards** — high value |
| **nine-patch sprites** | open | not possible: a quad of four vertices cannot keep corners | **§4.7 grid base, uv stage, `NineSlice`** |
| **ropes?!** | open | not possible without a mesh of one's own | **§4.3 segment sprites**; rope physics stays out (§5) |
| **imposters (grass, trees, ..)** | open | a billboard can stand in for a tree; no sway, no view-dependent frame | **§4.6 directional frames**, **§4.8 wave/sway**; octahedral impostors out (§5) |
| **sprite picking ?** | open | `FeatureSprites` is not raycastable — the vertices are placed in the shader | **§4.10 GPU picking** |
| **2d sprites with emissive glow** | open | bloom exists for a whole stage | **§4.13** — a recipe first, a feature only if the recipe falls short |

### 3.2 List `texture-mapping`

| card | reality | proposal |
| --- | --- | --- |
| **texture atlas builder / frame factory** (dynamic atlases, text labels) | none; every label is a texture of its own, a draw call of its own | **§4.11 `DynamicAtlas`**, then bitmap text (§4.12) |
| **create tilesets from list of images** (texture arrays) | `TileSet` cuts one image | **§4.14 texture arrays** — later, but it also cures the mipmap bleeding `sprites.md` warns about |
| **support KTX2 textures pipeline** | none | **§4.15**, a loader hook in `TextureStore`, no bundled transcoder |
| **support free-tex-packer** | its JSON (hash/array) export follows the TexturePacker layout, so `TexturePackerJson` should already read it | verify with a fixture in a spec, add one line to the guide, close the card |
| **rTexPacker (itch.io)** | its own JSON layout | an adapter (§4.5); no dedicated parser until someone asks |
| **aseprite sprite-sheets, atlas..** | the frames of an Aseprite JSON follow the TexturePacker layout; frame tags, per-frame durations, `pingpong` and slices stay in `frame.data` and `meta`, but nothing turns them into animations, playback or pivots | **§4.5 `AsepriteJson`** — high value |

### 3.3 List `vertex-objects`

| card | reality | proposal |
| --- | --- | --- |
| rethink static+dynamic+stream | `usage` per attribute, `autoTouch`, `attributeUsage` of the geometry, upload ranges | done — close |
| `new VertexObjectDescriptor(json, {override})` | `cloneVertexObjectDescription()`, `attributeUsage` | done for the case that mattered — close |
| support the new `UniformsGroup` | a WebGL-renderer concept; under `three/webgpu` uniforms are nodes and three groups them itself | obsolete — close |
| resize: ArrayBuffers + recreate geometry? | `resize()` only before the first attach; `createSprite()` answers `undefined` once full | **§4.16 growing capacity** |
| cli: create types from descriptor json | `defineSprite()` + `SpriteOf<>` type the handle from the features | obsolete — close |

Seven of the 13 sprite cards are done and can be archived. Of the open ones, none is obsolete:
each names something a 2.5D game wants and the library cannot do yet.

## 4. Proposals

Ordered by the dependencies between them, not by priority — §6 has the order of the build.
Every proposal carries a verdict against the yardstick of §1.

### 4.1 Two small built-ins: `Fade` and `Flash`

The bands are there, the guide shows `Fade` as its example, and every game needs both: a fade
for spawning, dying and fog of war, a flash for a hit.

```ts
const Enemy = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Tint, Fade, Flash],
});

enemy.fade = 0.5;                  // alpha × 0.5, ColorOrder.Fade
enemy.setFlash(1, 1, 1, 0.8);      // rgb mixed towards white by 0.8, alpha kept, ColorOrder.Flash
```

- `Fade`: `fade` (float, dynamic, start 1) multiplies the alpha. Exactly the guide's example,
  which then imports it instead of defining it.
- `Flash`: `flash` (vec4, dynamic, start `[1, 1, 1, 0]`), `mix(color.rgb, flash.rgb, flash.a)`.
  A hit flash, a freeze tint, a damage blink — one feature, no `Tint` hack (a tint can only
  darken).

Verdict: trivially in the model, needed by every genre, and the agent test is the reason —
without them every project carries its own copy of the guide's example. Ship both in one release.

### 4.2 Axis billboards — the card "directed billboards"

`BillboardPlacement` is spherical: it maps the quad onto the camera's right and up. Under a 2.5D
camera that looks down at 30–60°, a spherical billboard leans back with the camera, and a
character standing on the ground seems to float or sink at its feet. The look of Doom, of Paper
Mario, of every "sprites in a 3D world" game is the **cylindrical** billboard: it turns about an
up axis to face the camera and stays upright.

```ts
const Character = defineSprite({
  base: QuadBase,
  features: [InstancePosition, axisBillboardPlacement(), QuadSize, AnimatedFrames, TextureColor],
});

axisBillboardPlacement();               // about +Y of the mesh
axisBillboardPlacement({axis: 'z'});    // about +Z — for a mesh in the XY plane
```

- One factory, frozen features per option set, as `flatPlacement()` is; brings nothing but its
  placement stage, so it swaps with `FlatPlacement` and `BillboardPlacement` on a live material.
- The quad's x goes onto `normalize(cross(axis, toCamera))`, its y onto the axis. Undefined when
  the camera looks straight down the axis: fall back to the camera's right, as
  `LightFacingPlacement` falls back within a sine of 0.1.
- `ShadowPass` needs nothing new — `LightFacingPlacement` already turns every placement to the
  light.
- `BillboardReflectionPass` was built for the spherical case; the reflection of an axis billboard
  in a ground mirror is the mirror image of an upright quad, which `ReflectionPass` already draws
  correctly. The guide's table gets one row saying so.

Verdict: the most-wanted placement of a 2.5D library, one stage, no new data. An agent that does
not find it writes `sprite.lookAt()` on CPU-side meshes. High priority.

### 4.3 Segment sprites — the card "ropes?!"

A rope, a chain, a laser, a lightning bolt, a tracer, the edge of a graph: a quad stretched from
one point to another. With the model today it needs a position, a size and a rotation worked out
per segment on the CPU, and in 3D a turn about the segment towards the camera that no placement
offers.

```ts
const Rope = defineSprite({
  base: QuadBase,
  features: [InstancePosition, SegmentEnd, segmentPlacement(), QuadSize, AtlasFrame, TextureColor],
});

link.setPosition(a.x, a.y, a.z);      // the start
link.setSegmentEnd(b.x, b.y, b.z);    // the end
link.setSize(0, 0.2);                 // height = the thickness; width = extra length at both ends (caps)
```

- `SegmentEnd`: `segmentEnd` (vec3, dynamic) — a rope moves every frame.
- `segmentPlacement({facing: 'camera' | 'plane'})`: the quad's x runs from start to end, its y
  across — turned about the segment towards the camera (`'camera'`, the 3D case) or lying in the
  plane of the mesh (`'plane'`, the 2D case, a factory option like `flatPlacement`'s `plane`).
  The placement reads the unscaled base `position` for where along the segment a vertex lies,
  and the scaled local y for the thickness, so `QuadSize` keeps its meaning.
- A kind of segments holds no `Rotation` or `Shear`; `defineSprite()` refuses them next to the
  placement with a message that says why.
- **The texture along the segment.** A rope repeats its texture by length. `sampleAtlasFrame()`
  already repeats a frame inside its area; a color source `RepeatingTextureColor` built on the
  same math (`wrap: ['repeat', 'clamp']`, repeat count = (length / thickness) / aspect, with
  aspect = width / height of the frame — a 64 × 16 frame on a segment 8 long and 1 thick repeats
  twice) makes ropes and chains look right. It is the same function the mesh helper uses, not a
  second implementation.
- **Joins.** Two segments meet in a gap or an overlap on the outside of a bend. Round caps in the
  frame hide it for ropes; a mitered ribbon is a mesh of its own and out of scope (§5).

The physics of the card's links (Verlet) stays out: thirty lines of game code, and every game
wants its own constraints. The library draws whatever the simulation writes — one draw call for
every rope of a scene.

Verdict: one feature, one placement, reusing the frame-sampling math. Serves ropes, lasers,
lightning, trails of segments, graph edges and the "lines" every debug view needs. High priority.

### 4.4 Animation playback: once, ping-pong, per-frame durations

`AnimatedFrames` loops every animation: `floor(((time + animOffset) / duration · frameCount) mod
frameCount)`. Three things a game needs it cannot express:

- **Play once and hold the last frame** — explosions, attacks, death animations, a door that
  opens. Today the caller frees the sprite exactly on time, or swaps the animation for a still
  frame on the CPU.
- **Ping-pong** — Aseprite's `pingpong`, idle breathing, a pulsing light.
- **Per-frame durations** — the hold on the key frame of an attack. Aseprite stores a duration
  per frame; `FrameBasedAnimations` has one duration for the whole animation.

```ts
anims.add('explode', {frameRate: 24, playback: 'once'}, frames);
anims.add('idle', {duration: 1.2, playback: 'pingpong'}, frames);
anims.add('attack', {durations: [0.05, 0.05, 0.3, 0.1]}, frames);

sprite.animId = explode;
sprite.animOffset = -now;   // starts now: (time + animOffset) runs from 0
```

- `playback` costs nothing per frame: `clamp` instead of `mod` for `'once'`, a triangle wave for
  `'pingpong'`. It has to reach the shader per animation. The header texel is full
  (`[frameCount, duration, firstFrameTexel, texelsPerFrame]`), but `texelsPerFrame` is the same
  for the whole texture and could move into a uniform, freeing the fourth component for the
  playback. That changes the documented layout of the animsMap — a breaking change of a format
  someone may read by hand; a second header texel is the non-breaking alternative (§7).
- Per-frame durations: the second frame texel is `[width, height, flipDiagonal, 0]` — its fourth
  component is free. It takes the end time of the frame within the animation, and the shader
  walks the frames of the animation until it passes `t`. The walk runs in the frame slot, per
  vertex, over a dozen frames — cheap, and only animations with durations take it: the bake marks
  them, and the uniform path stays as it is.
- `animOffset = -now` as "start now" works today and only needs a sentence in the guide; with
  `'once'` it becomes the whole one-shot API.

Verdict: small changes to an existing feature, and the prerequisite of an Aseprite import worth
having. High priority, together with §4.5.

### 4.5 Aseprite sheets, and an adapter for the other packers

Aseprite is the pixel-art tool of the genre this library serves. Its JSON export carries the
TexturePacker frame layout — `frame`, `rotated`, `trimmed`, `spriteSourceSize`, `sourceSize` —
so `TexturePackerJson.parse()` already reads the frames. The rest is not lost — every frame keeps
its JSON entry as `frame.data`, and `meta` comes back as it was — but nothing interprets it:

| Aseprite | what it is | where it goes |
| --- | --- | --- |
| `frames[].duration` (ms) | per-frame duration | `durations` of §4.4 |
| `meta.frameTags[]` (`name`, `from`, `to`, `direction`) | the animations: walk, idle, attack | one `FrameBasedAnimations#add()` per tag, `direction` → `playback` (`reverse` reverses the frames) |
| `meta.slices[]` (`bounds`, `center`, `pivot`) | nine-slice centers and pivots | frame data, read by `NineSlice` (§4.7) and an anchor (§4.9) |

```ts
const [atlas, meta, animations] = AsepriteJson.parse(json);
const walk = animations.animId('walk');        // a FrameBasedAnimations with one animation per tag
```

And in a `TextureStore` catalog: an item with an `atlasUrl` whose JSON names Aseprite in
`meta.app` is read as one, its tags become the `frameBasedAnimations` of the item without a word
of configuration.

**The other packers.** Rather than one parser per tool, `TextureStore` takes an atlas adapter:
`(json) => {atlas, meta, animations?}`, picked by `meta.app` or named in the item. TexturePacker,
free-tex-packer (verify, §3.2) and Aseprite ship; rTexPacker and the rest are an adapter away,
written by whoever needs them — a small, typed function an agent can write from the
`TexturePackerJson` source.

Verdict: the import is where a game's assets enter the library. If walking animations out of
Aseprite take one line, an agent uses the library from the first asset on; if they take a
parser, it writes its own sprite system around its own parser. High priority.

### 4.6 Frames by index, and directional frames — the card "imposters"

Two related gaps:

- **A frame by index.** `AtlasFrame` stores nine floats per sprite; `AnimatedFrames` stores an
  animation. A sprite that shows "frame 17 of this set" — a tile, a card, a digit, a direction —
  has nothing in between. The `AtlasFrameTable` of the mesh helper is that set: a uniform array of
  up to 341 frames, turned and trimmed frames included.
- **A frame by view angle.** The 8-direction sprites of Doom, Ultima Underworld and every
  "boomer shooter" since: the sprite has a facing, the camera sees it from some angle, and the
  frame shows the matching view. The same is the cheap impostor of a tree or a statue: eight
  pre-rendered views on a billboard.

```ts
const Monster = defineSprite({
  base: QuadBase,
  features: [InstancePosition, axisBillboardPlacement(), QuadSize, Yaw, tableFrame({views: 8}), TextureColor],
});

const sprites = new FeatureSprites(Monster, {frameTables: {frames: atlasFrameTable(atlas, /^imp_walk_/)}});
monster.frameIndex = 0;          // the first frame of the 8 views
monster.yaw = heading;           // where it faces; the camera picks the view
```

- `tableFrame()`: a frame feature (the frame slot) with `frameIndex` (float, static) and a frame
  table, a new kind of resource next to textures and uniforms (`frameTables`). 4 bytes per
  sprite instead of 36.
- Directional frames are an option of the same feature, `tableFrame({views: n})`
  (`requires: ['yaw']`): it adds `round((angleOf(toCamera) − yaw) / (2π / n)) mod n` to the index
  before the lookup. The index has to change before the table is read, and a frame stage (§4.7)
  runs after the frame slot has answered resolved tex coords — so the choice of the view belongs
  in the frame feature itself, as `flatPlacement()` folds its options into one placement. One
  frozen feature per option set; `tableFrame()` without `views` is the plain lookup.
- Animated directional sprites: the animation writes `frameIndex` per frame on the CPU (a dynamic
  attribute), or `AnimatedFrames` learns a frame table as an alternative to the animsMap. The
  first is enough to start; the second waits for a demo that needs it.

Verdict: `tableFrame()` is the missing middle between "nine floats" and "an animation", and
directional frames are the 2.5D feature the board never named and every boomer shooter needs.
Medium priority; independent of the pipeline extension of §4.7.

### 4.7 The pipeline: frame stages, uv stages and a grid base — the card "nine-patch sprites"

Two proposals of this document cannot be built as features today, and both for the same reason:
the pipeline has no stage between the frame slot and its readers.

| wants | needs |
| --- | --- |
| `Flip` (§4.9) — mirror the image without turning the triangles over | a change of the frame: swap `s` and `s + u`, swap the trim margins left and right |
| `NineSlice` | a uv per vertex that is not the base's `uv` |

**Frame stages.** A slot `frameStages` — `{order, transform(frame, ctx): SpriteFrameNodes}` —
after the frame slot and before both pipelines read the frame. The trim shift reads the result,
so a flipped trimmed frame stays where the untrimmed sprite has it.

**Uv stages.** A slot `uv` — `{order, transform(uv, ctx): Node<'vec2'>}` — on the uv a color
source samples at. `TextureColor` reads `ctx.uv` instead of `attribute('uv')`. Today's kinds
build the same graph as before.

**A grid base.** `gridBase({columns, rows})`: `(columns + 1) × (rows + 1)` vertices, `uv` and
`position` laid out as `QuadBase` lays out four. A quad cannot keep its corners when it is
stretched, and it cannot bend; a grid can:

- `NineSlice` on `gridBase({columns: 3, rows: 3})`: `sliceInsets` (left, top, right, bottom, in
  pixels of the frame, static) keep the border at its size and stretch the middle. It takes the
  `Scale` band in place of `QuadSize`'s stage and moves the inner grid lines of both the position
  and the uv. Insets out of Aseprite's `slices[].center` (§4.5). Trimmed frames are refused —
  a nine-slice frame is packed untrimmed — and the error says so.
- `wave()` on a grid (§4.8) bends a flag, a banner, a water surface; on a quad it can only shear.

```ts
const Panel = defineSprite({
  base: gridBase({columns: 3, rows: 3}),
  features: [InstancePosition, FlatPlacement, QuadSize, NineSlice, AtlasFrame, TextureColor],
});

panel.setSize(320, 96);
panel.setSliceInsets(8, 8, 8, 8);
```

Verdict: the stages are the one change to the model this document asks for; everything else is a
feature. Nine-slice panels are what every game UI, dialog box and health bar needs — today an
agent builds nine sprites per panel, or a canvas. Medium priority, but it unblocks `Flip`, so it
moves up in §6.

### 4.8 `wave()` — swaying grass, sine scrollers

One stage, two looks:

- **Sway**: grass, trees, flags, seaweed — the top of the sprite moves, the foot stays. Weighted
  by the uv's y; the phase from the instance position, so a field does not sway in lockstep. On a
  quad it is a shear by time; on `gridBase()` a bend.
- **The scroller**: a sine wave through a row of glyphs — the Amiga demo staple. The whole sprite
  moves, the phase from the instance x.

```ts
wave({weight: 'top'});            // sway: amplitude × (1 − uv.y)
wave({weight: 'uniform'});        // scroller: the whole sprite
// uniforms waveAmplitude, waveFrequency, waveSpeed; a mesh stage at MeshOrder.Offset
```

**The `time` problem.** A wave needs `time`. `AnimatedFrames` declares `time`, and a second
feature that declares it is refused ("both declare the uniform"); the guide's `Bob` example works
around it with `requires: ['animatedFrames']`, which ties a bob to animations. The model needs a
uniform that several features may declare: either `uniforms: {time: {value: 0, shared: true}}` —
identical shared declarations merge, a conflicting one is still refused — or a `Time` feature
that `AnimatedFrames`, `wave()` and the guide's `Bob` require. The first is non-breaking (§7).

Verdict: small, visible, and two genres at once. Medium priority, after shared uniforms.

### 4.9 `Flip` and `Anchor`

**`Flip`** — a platformer's character faces left. Today: a negative width mirrors the quad and
turns its triangles over, so `FrontSide` culls it; or `setTexCoords()` with a negative `u`, which
breaks trimmed frames and is impossible for `AnimatedFrames`. A frame stage (§4.7) does it right
for every frame feature:

```ts
hero.flipX = velocity.x < 0;     // 0 or 1, static; LocalOrder.Flip's band is finally used
```

It reverses `s` and `u` in every case, a turned atlas frame included: the lookup works out
`(s + uv.x · u, t + uv.y · v)` before the diagonal swap (`frameUv`), so the drawn x is always the
`s` axis. It mirrors the trim margins as well, so a trimmed frame stays on its foot.

**`Anchor`** — where the sprite's position sits on its image: centre, foot, top left. `baseArgs`
sets one anchor for the whole kind; a per-sprite anchor (`anchorX`, `anchorY`, static, in the
`Anchor` band) serves frames with different pivots — an Aseprite slice's `pivot` per frame, a
weapon in a hand. Lower priority than `Flip`: most games live with one anchor per kind.

Verdict: `Flip` is the single most-asked-for property of a 2D sprite, and the library cannot do
it today. High priority — the reason the frame stages of §4.7 come early.

### 4.10 GPU picking — the card "sprite picking ?"

`FeatureSprites` places its vertices in the shader, so three's raycaster sees four vertices at the
origin. A CPU picker would have to replicate every stage of every feature — impossible for the
features of a user. The GPU already knows where every sprite lands, including its alpha.

```ts
const picker = new SpritePicker(renderer);
const hit = await picker.pick(camera, pointerNdc, [enemies, items]);
// → {sprites: enemies, sprite: <handle>, index: 17} or undefined
```

- The picker draws the listed meshes into a 1 × 1 render target under the pointer, each with a
  pick material derived from its kind: the same position graph, the color source and color
  stages of the kind run unchanged so that the alpha — and with it the alpha test — is the
  sprite's own, and a last step *after* the color stages replaces the result with the id:
  `instanceIndex + 1` and an id of the mesh. Written there, no `Tint` or `Flash` can change it.
  Built like a pass, cached per kind.
- The target holds the id exactly: an integer (or float) render target, no blending, no tone
  mapping, no output color space transform — any of them would turn an id into another id.
- **Pixel-perfect for free**: the texels the alpha test drops are dropped here too, so a click
  into the transparent corner of a frame picks what lies behind it.
- **Asynchronous**: `readRenderTargetPixelsAsync()`, one frame of latency. Fine for clicks;
  for hover every frame, too.
- The handle is resolved through `spritePool.getVO(index)`; a sprite freed between the draw and
  the read resolves to whatever moved into its slot — the result carries a frame number to check.

Verdict: the only picking that is right for every kind, and a few lines to use. An agent without
it writes a CPU hit test against positions and sizes that is wrong for rotated, sheared,
billboarded or trimmed sprites. Medium priority.

### 4.11 `DynamicAtlas` — the card "texture atlas builder / frame factory"

Labels, damage numbers, player names, minimap icons, avatars from a URL: images that exist only
at run time. Today each is a `CanvasTexture` and a `FeatureSprites` of its own, or the caller
packs a canvas by hand.

```ts
const labels = new DynamicAtlas({width: 1024, height: 1024, padding: 2});
const frame = labels.add('score', (ctx, w, h) => { /* draw */ }, {width: 128, height: 32});
const icon = labels.add('avatar', imageBitmap);

sprite.setFrame(frame);  // a TextureAtlasFrame like any other
sprites.setTexture('colorMap', labels.texture);
```

- A shelf packer on a canvas, a `CanvasTexture`, an ordinary `TextureAtlas` — so every feature,
  `AtlasFrameTable` and `sampleAtlasFrame()` read its frames unchanged.
- `add()` marks the texture for upload; `remove()` frees nothing (shelves fragment) and
  `clear()` starts over. A full atlas throws, naming its size — no silent growth that would move
  every frame.
- `padding` and `extrude` against bleeding, the same reasons `inset` exists in the mesh helper.

Verdict: small, independent of the pipeline work, and it turns "one draw call per label" into
one draw call for all of them. Medium priority; the base of §4.12.

### 4.12 Bitmap text

Score counters, dialog boxes, the demo scroller: text out of a bitmap font is the most common
sprite of all, and the library has no word for it.

```ts
const [font, fontAtlas] = BitmapFont.parse(bmfontJson);
const glyphs = writeText(sprites, font, 'GREETINGS TO ALL SCENERS', {x: 0, y: 0, align: 'left'});
// glyphs: the sprite handles, one per visible glyph, in reading order
```

- `BitmapFont.parse()` reads the AngelCode BMFont format (text, XML or JSON — the JSON of the
  common converters), builds a `TextureAtlas` of the glyphs and keeps advance, offsets and
  kerning.
- `writeText()` lays a string out and writes position, size and frame into sprites of any kind
  that holds `InstancePosition`, `QuadSize` and `AtlasFrame` — it creates them in the given
  `FeatureSprites`, it is no mesh of its own.
- With `wave()` (§4.8) and `Tint`, a sine scroller is ten lines. With `DynamicAtlas`, a font
  rendered from a web font at run time fills the same `BitmapFont` — an adapter, later.

Verdict: a high-value helper outside the feature model — a function over sprites, not a new mesh.
Medium priority; the lookbook demo "sine scroller" makes it, `wave()` and the Amiga angle
visible at once.

### 4.13 Glow — the card "2d sprites with emissive glow"

Before a feature: the library may already do it. `Tint` writes float colors, and the stage's
bloom (`createBloomOutputNodeBuilder({threshold})`) reads an HDR composition. A sprite tinted
above 1 — `setColorValues([4, 3, 1, 1])` — and a bloom threshold of 1 glows, and nothing else
does. To do:

1. Verify it in a lookbook demo (neon signs, lasers of §4.3, sparks).
2. Write it into the guide as a recipe — the agent test passes if the recipe is findable.
3. Only if that falls short — glow from a separate emission map, glow that does not brighten the
   sprite itself — an `Emissive` feature writing an `emissive` output through three's MRT, and a
   selective bloom builder in `stage/`. That crosses two modules and waits for a scene that
   needs it.

Verdict: a recipe now, a feature on demand.

### 4.14 Palette swap and color cycling

Team colors, enemy variants (the red goblin and the blue goblin from one sheet), and the color
cycling of Deluxe Paint waterfalls — the retro look the library aims at.

```ts
const Goblin = defineSprite({base: QuadBase, features: [..., TextureColor, PaletteSwap]});
const goblins = new FeatureSprites(Goblin, {textures: {colorMap, palette}});
goblin.paletteRow = 2;                    // the third variant
goblins.setUniform('paletteShift', t);    // cycling, if the palette asks for it
```

- `palette`: a small texture, row 0 the source colors, every further row a replacement set.
- The color stage compares the sampled color against the source row (up to 16 or 32 colors, one
  loop) and replaces it with the color of the sprite's row; `paletteShift` rotates a range of
  entries for cycling.
- Works with ordinary RGBA images — no indexed-PNG pipeline, which browsers decode to RGB
  anyway. Needs exact colors: `nearest` filtering, no premultiplied edges. The feature's docs say
  so, and the material warns once for a linear-filtered `colorMap`.

Verdict: a color stage, nothing more; for the pixel-art and demo audience a signature feature.
Lower-medium priority.

### 4.15 Draw order: sorting the pool

A pool draws in slot order, and `freeVO()` swaps the last slot into the freed one — the order is
not even the order of creation. With depth test and an alpha test that is fine. It is not fine
for:

- **y-sorted top-down and isometric games**, where the lower sprite covers the upper and soft
  edges rule out the alpha test;
- **vector balls** and every transparent billboard cloud, drawn back to front;
- a stable order of UI sprites.

```ts
sprites.sortBy('y');                    // by a property of the handle, ascending
sprites.sortByViewDepth(camera);        // back to front, for billboards
```

- In the core: `VertexObjectPool#sortBy(key)` computes keys into a pool-owned `Float32Array`,
  sorts an index array, permutes every buffer through one scratch copy and rewrites the index of
  every handle (`VOUtils.setIndex`, which `freeVO()` already uses). Handles stay valid.
- It marks the whole used range for upload; a sorted pool uploads everything every frame. That is
  the price, and the docs say it.
- Allocation-free after the first call, held by the allocation specs like every hot path.

Verdict: a core change with a clear need in two genres and in the demo scene. Medium priority.

### 4.16 Growing capacity — the card "resize"

`createSprite()` answers `undefined` once the pool is full, and an agent's first guess of the
capacity is wrong more often than not — the sprites that do not appear are the bug report.

- `new FeatureSprites(kind, {capacity: 256, grow: true})`: a full pool builds a geometry of twice
  the capacity, copies the buffers, points every handle at the new buffer (`VOUtils.setBuffer`)
  and disposes the old geometry; passes follow, bindings are untouched.
- A frame hitch and a rebuild of three's render objects per growth — logged once in development.
- Refused next to a `geometry` handed in, which the mesh does not own.

Verdict: a convenience with real risk in the ownership rules, but the failure it removes is
silent. Lower-medium priority; first make the full pool loud (a one-time warning naming
`capacity`), which costs nothing.

### 4.17 Later

- **Texture arrays** (the card "tilesets from a list of images"): a `DataArrayTexture` built from
  images of one size, an `ArrayFrame` feature with a `layer` attribute. Every frame gets its own
  mip chain — the bleeding of smaller mip levels that `sprites.md` warns about is gone — and
  `TileSprites` of `map2d` would profit most. Waits for a scene with mipmapped tiles.
- **KTX2**: a `ktx2Loader` property on `TextureStore` that items ending in `.ktx2` load through;
  the caller configures three's `KTX2Loader` and its transcoder path. No bundled transcoder, no
  pipeline. Compressed textures are a kind of their own for `textureShapeKey()` and rebuild once.
  Useless for pixel art, worth it for large painted atlases.
- **`Ballistic`**: `velocity` and `birthTime` per sprite, `gravity` uniform; the position follows
  `p + v·t + ½·g·t²` in the shader, so a thousand sparks cost one upload at birth. With `Fade`
  and a one-shot animation it is a particle system without a particle system. Needs shared
  `time` (§4.8).

## 5. Not recommended

| idea | why not |
| --- | --- |
| octahedral impostors | an offline baking pipeline and a shader nobody reads; directional frames (§4.6) are the 2.5D answer |
| rope physics in the library | game logic; every game wants its own constraints. The library draws segments (§4.3) |
| CPU picking | cannot follow the stages of a feature it does not know; GPU picking (§4.10) can |
| a mitered ribbon/trail mesh | a mesh class of its own; segment sprites with round caps cover ropes and tracers |
| a build-time atlas packer | TexturePacker, free-tex-packer and Aseprite do it better; the library reads their output |
| a dedicated rTexPacker parser | an adapter (§4.5) unless someone asks |
| `UniformsGroup`, a type CLI, descriptor overrides | obsolete, see §3.3 |

## 6. Order of the build

| phase | what | why first |
| --- | --- | --- |
| **A** — small, no model change | `Fade`, `Flash` (§4.1); `axisBillboardPlacement()` (§4.2); a loud full pool (§4.16); free-tex-packer fixture; the glow recipe (§4.13) | each is a day or less, each removes a reason to hand-roll |
| **B** — assets | playback modes and per-frame durations (§4.4); `AsepriteJson` and the atlas adapter (§4.5) | assets decide whether a project starts on the library |
| **C** — the model | frame stages, uv stages, `gridBase()`, shared uniforms (§4.7, §4.8) | unblocks `Flip`, `NineSlice`, `wave()` |
| **D** — features on C | `Flip`, `Anchor` (§4.9); `NineSlice` (§4.7); `wave()` (§4.8); segment sprites (§4.3) | segment sprites could go in A, but their texture along the length wants the uv stage |
| **E** — beside the model | `DynamicAtlas` (§4.11), bitmap text (§4.12), `tableFrame()` with directional frames (§4.6), palette swap (§4.14) | helpers and features with a lookbook demo each |
| **F** — core | sorting (§4.15), GPU picking (§4.10), growing capacity (§4.16) | touch the pool or the renderer; each its own proposal |
| later | texture arrays, KTX2, `Ballistic`, `Emissive` (§4.17, §4.13) | wait for a scene |

Lookbook demos that would carry the phases, one per phase: **"platformer"** (Aseprite import,
`Flip`, `Fade`, `Flash`, one-shot animations), **"boomer shooter corridor"** (axis billboards,
directional frames, `ShadowPass`), **"sine scroller"** (bitmap text, `wave()`, `Tint` above 1 and
bloom, palette cycling), **"rope bridge"** (segment sprites, Verlet in the demo, not the library).

The board can lose the seven done cards of `sprites`, the four closed cards of `vertex-objects`
and the free-tex-packer card once its fixture exists.

## 7. Open questions

1. **The playback in the animsMap** (§4.4): move `texelsPerFrame` into a uniform and use the free
   header component — a breaking change of a documented layout — or a second header texel?
2. **Shared uniforms** (§4.8): `shared: true` on a declaration, or a `Time` feature that
   `AnimatedFrames` requires? The first keeps every kind of today valid; the second is the cleaner
   model.
3. **Frame tables as a resource** (§4.6): a third kind of resource next to textures and uniforms,
   or a texture after all — a data texture has no 341-frame limit, a uniform array needs no
   texture slot?
4. **Segment facing** (§4.3): a factory option, or two placements (`segmentPlacement`,
   `flatSegmentPlacement`) that swap like `FlatPlacement` and `BillboardPlacement`?
5. **Sorting and passes** (§4.15): the passes draw the same pool, so a sort reaches them — is a
   shadow drawn back to front ever wrong?
6. **Where `writeText()` lives** (§4.12): `sprites/` beside the presets, or a module `text/` of its
   own that may grow a layout engine one day?
