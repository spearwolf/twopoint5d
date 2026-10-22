# Proposal: animation playback, per-frame durations and Aseprite sheets

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Animated frames" and "Aseprite
sheets", and the fixtures in [`src/texture/fixtures/aseprite/`](../../src/texture/fixtures/aseprite/README.md). Phase B of
[`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md), §4.4 and §4.5, with decision 1
of its §7 taken: a **second header texel** per animation. Deviations of the build from the first
draft of this spec, which the sections below now state as built:

- the frame of an animation with durations is found by a search that builds the count bit by bit
  (§4.2), not by a search over `[low, high)`: a step of the latter reads its two bounds three times
  each, and `Node#traverse()`, which follows every path of a graph, did not come back from 13 such
  steps — the bitwise step reads the count before it twice;
- the way back of a ping-pong with durations counts with the same `≤` as the way there; only the
  exact instant of a boundary on the way back shows the neighbouring frame (§4.2);
- the test helper `nodesOf()` (`src/testing/spriteGraph.ts`) visits every node once instead of
  following `Node#traverse()`.

## 1. Goal

A platformer imports the sheet of a kung-fu fighter from Aseprite: `idle` breathes back and
forth, `walk` loops, `kick` plays once and holds its last frame, and the key frame of the kick
lasts three times as long as the others. Today none of that reaches the shader: `AnimatedFrames`
loops every animation at one duration, and the frame tags, durations and slices of an Aseprite
json are kept as data nobody reads.

```ts
import {AsepriteJson, FrameBasedAnimations} from '@spearwolf/twopoint5d';

declare const json: Parameters<typeof AsepriteJson.parse>[0];

// one animation per frame tag: direction → playback, the duration of every frame
const [atlas, meta, animations] = AsepriteJson.parse(json);
const kick = animations.animId('kick');

// by hand: once, ping-pong, per-frame durations
const anims = new FrameBasedAnimations();
anims.add('explode', {frameRate: 24, playback: 'once'}, atlas, /^explode/);
anims.add('idle', {duration: 1.2, playback: 'pingpong'}, atlas, /^idle/);
anims.add('attack', {durations: [0.05, 0.05, 0.3, 0.1]}, atlas, ['kick 0', 'kick 1', 'kick 2', 'kick 3']);

// sprite.animId = kick; sprite.animOffset = -now;   // starts now
```

And in a `TextureStore` catalog an item with an `atlasUrl` whose json says `"app":
"https://www.aseprite.org/"` publishes the tags as its `frameBasedAnimations` without a word of
configuration.

## 2. What there is today

- `FrameBasedAnimations#add(name, timing, frames…)` takes `timing` as a number (the duration),
  `{duration}` or `{frameRate}` — `frameRate` exists already (`duration = frameCount /
  frameRate`), the roadmap's sketch lists it as new. The frames come from an array of
  `TextureCoords`, a `TileSet` (ids or a range) or a `TextureAtlas` (all string names, or a
  `frameNameQuery` string/`RegExp`, numerically collated).
- `bakeDataTexture()` writes one row of RGBA float texels: headers `[frameCount, duration,
  firstFrameTexel, texelsPerFrame]` at `0 … n−1`, then the frames from `n`, `texelsPerFrame` texels
  each — `[s, t, u, v]`, then `[width, height, flipDiagonal, 0]`, then the trim margins.
- `AnimatedFrames` (frame slot) reads the header at `animId`, picks
  `floor(((time + animOffset) / duration · frameCount) mod frameCount)` (frame 0 for a duration of
  0) and reads the frame texels. It samples through `ctx.sample()`, which registers every lookup
  node so that a new `animsMap` of the same kind takes its place without a rebuild
  (`FeatureSpritesMaterial`, `#samples`). An animsMap built by hand with a `0` as
  `texelsPerFrame` reads as one texel per frame, and the browser suite holds a hand-built map of
  that old layout (`sprites-animated-material.test.js`, "reads a frame out of the second row").
- The other readers of the layout: none in the library — `map2d` reads no animsMap, the lookbook
  demos hand the bake to the material, and `AtlasFrameTable` copies the layout of the frame texels
  into a uniform array of its own (its fourth component of the second `vec4` stays `0`).
- `TexturePackerJson.parse(json, parentCoords?, target?)` reads both "JSON Hash" and "JSON Array";
  every frame keeps its json entry as `data`. `TextureResource` (atlas shape) parses its
  `atlasJson` with it in one effect and builds `frameBasedAnimations` from the catalog entries
  (`frameNameQuery`) in another.

## 3. Playback and per-frame durations — the API

### 3.1 Timing options

```ts
export type AnimationPlayback = 'loop' | 'once' | 'pingpong';

export type AnimationTimingOptions = (
  | {duration: number; frameRate?: never; durations?: never}
  | {duration?: never; frameRate: number; durations?: never}
  | {duration?: never; frameRate?: never; durations: readonly number[]}
) & {playback?: AnimationPlayback};
```

- `playback` defaults to `'loop'`. A number as `timing` stays a duration with `'loop'`.
- `durations` — seconds, one per frame, in the order of the frames. The duration of the animation
  is their sum. Each is a finite number above zero; the array has exactly as many entries as the
  animation has frames.
- `duration` is the time of the frames once through, each frame `duration / frameCount`; with
  `frameRate` each frame lasts `1 / frameRate`. A ping-pong shows `2·frameCount − 2` frames per
  cycle (§4.2) at that same time per frame.
- The catalog types `FrameBasedAnimationsData…` are `AnimationTimingOptions & {…}` and take
  `playback` and `durations` without a change of their own.

### 3.2 `add()` — the new form and the refusals

`add(name, timing, atlas, frameNames: readonly string[])` is a fourth form beside the
`frameNameQuery`: the frames of the atlas named in the list, **in the order of the list**, a name
may repeat. The frames bring their trim margins, as every frame out of an atlas does. This is the
form `AsepriteJson` uses: a tag is a range of frame indices, not a pattern of names, and a
`reverse` tag runs the list backwards.

New refusals of `add()`, each an `Error` that names the animation:

| case | message (after `FrameBasedAnimations: add() got`) |
| --- | --- |
| `playback` not one of the three | `` a playback of X for the animation `a` — a playback is 'loop', 'once' or 'pingpong' `` |
| `durations` beside `duration` or `frameRate` | `` durations and a duration (or frameRate) for the animation `a` — give one of duration, frameRate and durations `` |
| `durations` no array | `` durations of X for the animation `a` — durations is an array of seconds, one per frame `` |
| wrong count | `` 3 durations for the 4 frames of the animation `a` — give one duration per frame `` |
| a value not finite or not above 0 | `` a duration of X at index 2 for the animation `a` — a frame duration is a finite number of seconds above zero `` |
| more than 8191 frames with durations | `` 9000 frames with durations for the animation `a` — an animation with per-frame durations holds at most 8191 frames; split it `` |
| a frame name of the list not in the atlas | `` the frame name "x" at index 1 for the animation `a`, which the atlas does not carry `` |
| a list entry no string | `` a frame name of X at index 1 for the animation `a` — a frame name is a string `` |

The old precedence of `frameRate` over `duration` when both are given (the types forbid it, a
json catalog may not) stays as it is — changing it would break such a catalog.

### 3.3 Reading an animation back

```ts
export interface FrameBasedAnimationInfo {
  readonly id: number;
  readonly name: AnimName;
  readonly frameCount: number;
  /** Seconds, the frames once through; the sum of `durations` where there are some. */
  readonly duration: number;
  readonly playback: AnimationPlayback;
  /** Seconds per frame, or `undefined` for an animation of one duration. */
  readonly durations: readonly number[] | undefined;
  /** Seconds of one cycle: `duration` for 'loop' and 'once' — from then on a 'once' holds its last frame — and the way there and back for 'pingpong'. */
  readonly cycleDuration: number;
}

animation(nameOrId: AnimName | number): FrameBasedAnimationInfo;   // throws for an unknown one, as animId() does
clone(): FrameBasedAnimations;
```

`animation()` is what a game asks to know when its one-shot ends:
`if (now - kickStart >= anims.animation('kick').cycleDuration) …`. The answer is a frozen object
built per call (not a hot path). `clone()` answers a copy with the same animations under the same
names and ids and the same counter of anonymous names; adding to one leaves the other alone. The
`TextureResource` uses it to add catalog entries to the animations of an adapter (§6.4).
`FrameBasedAnimDef`, the exported shape of a registered animation, gains `playback` and
`durations`.

### 3.4 Start now: `animOffset = -now`

`(time + animOffset)` is the time into the animation. A sprite whose `animOffset` is set to
`-time` at the moment it should start shows the first frame then, and a `'once'` animation plays
through and holds its last frame — that is the whole one-shot API. `anim` is static: the write
needs `spritePool.touchVO(sprite, 'anim')` (or a geometry with `attributeUsage: {dynamic:
['anim']}`). Before its start (`time + animOffset < 0`) a `'once'` shows its first frame; a
`'loop'` and a `'pingpong'` run on backwards in their cycle, as they do today.

## 4. The animsMap

### 4.1 The layout

Decision 1 of the master plan: the documented first header texel keeps its layout, a second header
texel joins it. It sits **right after the frames of its animation**, so a reader finds it from
the first header alone, and the frames of the first animation still begin at texel `n`:

- texels `0 … n−1`: `[frameCount, duration, firstFrameTexel, texelsPerFrame]`, as before;
- from texel `n` on, for each animation in the order of the ids: its frames, `texelsPerFrame`
  texels each, then its **second header texel** `[playback, hasDurations, cycleDuration, −2]` at
  `firstFrameTexel + frameCount · texelsPerFrame`;
- `playback` is `0` loop, `1` once, `2` pingpong; `hasDurations` is `1` for an animation with
  `durations`, `0` otherwise; `cycleDuration` as in §3.3;
- the fourth component `−2` marks the texel as a second header; `AnimatedFrames` takes a texel
  whose fourth component lies below `−1.5` for one. No texel of the old layout goes below `−1`: a
  header has `texelsPerFrame ≥ 0`, a size texel `0`, trim margins `0 … 1`, and the `v` of tex
  coords is a fraction of the image — negative for a frame with `FLIP_VERTICAL` (every frame
  TexturePacker turned carries `FLIP_DIAGONAL | FLIP_VERTICAL`), `−1` exactly for such a frame as
  high as its image. A first draft marked with `−1` and read anything negative as a mark, which a
  turned first frame of the next animation passed for; with `−2` an animsMap of the old layout,
  one built by hand among them, plays as it did — every animation loops at one duration — as long
  as its frames lie within their image.
- the second frame texel becomes `[width, height, flipDiagonal, endTime]`: `endTime` is the end
  of the frame within the animation in seconds (the running sum of `durations`) for an animation
  with durations, `0` for any other.
- `texelsPerFrame` is `3` when a frame is trimmed, else `2` when `includeTextureSize` is set, a
  frame carries `FLIP_DIAGONAL` **or an animation has durations**, else `1` — still one value for
  the whole texture.
- The texture holds `n + Σ (frameCount · texelsPerFrame + 1)` texels, padded to a power of 2 as
  before; the error of a bake over the limit stays as it is.

This changes where the frames of the second and later animations start (one texel later per
animation before them). A reader that follows `firstFrameTexel`, as the guide tells it to, reads
them right; the CHANGELOG says it under "Changed".

### 4.2 The frame index — shader math

`T = time + animOffset`, `N = frameCount`, `D = duration`, `C = cycleDuration`. The second header
is read at `firstFrameTexel + N · max(texelsPerFrame, 1)`; when its fourth component is not below
`−1.5`, `playback = 0` and `hasDurations = 0` (the old layout). `D = 0` shows frame 0 in every
mode, as today.

**One duration** (`hasDurations = 0`), `s = T / D · N` the frames elapsed:

| playback | frame |
| --- | --- |
| loop | `clamp(floor(mod(s, N)), 0, N − 1)` |
| once | `clamp(floor(s), 0, N − 1)` |
| pingpong | `k = floor(mod(s, max(2N − 2, 1)))`, frame `clamp((N − 1) − abs(k − (N − 1)), 0, N − 1)` |

The clamps of loop and pingpong hold the frame within the animation: the f32 division in `mod` may
lie several ULP off, `floor` then lands on `−1` or `N`, and the shader would read a header texel as
tex coords. At that edge a `−1` shows the first frame rather than the last — a frame of the
animation rather than header data.

The ping-pong is a triangle wave that shows the end frames once per turn: with 4 frames
`0 1 2 3 2 1 0 1 2 3 …`, with 2 frames `0 1 0 1 …`, with 1 frame `0`. `mod` is floored in both
backends (WGSL through three's `tsl_mod_float`, GLSL natively), so a negative `T` runs backwards
in the cycle.

**Per-frame durations** (`hasDurations = 1`), `e_k` the `endTime` of frame `k`, `e_{N−1} = D`:

| playback | time `x` searched for |
| --- | --- |
| loop | `x = mod(T, D)` |
| once | `x = T` |
| pingpong | `u = mod(T, C)`; way there `u < D`: `x = u`; way back: `x = C + e_0 − u` |

The frame is `min(count of e_k ≤ x, N − 1)`. For the ping-pong, `C = 2D − d_0 − d_{N−1}` (`d_k`
the duration of frame `k`): the way back shows the frames `N−2 … 1`, and mirroring the time into
the way there — `x = D + e_{N−2} − u = C + e_0 − u` — finds them by the same count. At the very
instant of a boundary on the way back the mirror lands on the end of the frame it leaves, so that
instant shows the neighbour; a time that falls exactly on a float end time is the only case. For
`N = 1` and `N = 2` `C = D` and the way back is empty. A `'once'` before its start counts no frame
(`0`), after its end all of them (`N − 1`, held).

**The search.** The count is built bit by bit, from `4096` down to `1` — **13 steps** of one lookup
each (`2^13 > 8191`, the frame limit of §3.2): a step adds its bit when the frame before the
candidate count ends at or before `x` (`step(e, x)`). A candidate past the last frame reads the
last frame, which ends at `D`: it is taken only once every frame has ended, and the final clamp to
`N − 1` makes that right. The roadmap sketched a walk that only animations with durations take; a
TSL `Loop`/`If` needs a function stack whose callback three runs at build time, where
`ctx.sample()` could no longer register its nodes for the swap without a rebuild — so the steps
are built eagerly. Each step reads the count before it twice and nothing else of it: three's
builder visits a node once, but a walk that follows every path of the graph (`Node#traverse()`)
meets `2^13` of them, which is why the test helper `nodesOf()` walks a node once. An animation
without durations searches one frame: its 13 lookups all read one texel, a cache hit. Per vertex
the slot then reads 19 texels (header, second header, `e_0`, 13 steps, tex coords, size, trim)
instead of 4.

## 5. `AsepriteJson`

### 5.1 The format read

Aseprite's "Export Sprite Sheet" json, both layouts — "Hash" (`frames` an object, the key the
name) and "Array" (`frames` an array, the name in `filename`) — with every frame entry a
TexturePacker entry (`frame`, `rotated`, `trimmed`, `spriteSourceSize`, `sourceSize`) plus
`duration` in milliseconds, and `meta`:

| `meta` field | read as |
| --- | --- |
| `app`, `version`, `image`, `format`, `size`, `scale` | kept; `size` gives the parent coords as in `TexturePackerJson` |
| `frameTags[]`: `name`, `from`, `to`, `direction`, `repeat?`, `color?`, `data?` | one animation per tag (§5.2) |
| `slices[]`: `name`, `color?`, `data?`, `keys[]` of `{frame, bounds, center?, pivot?}` | per frame in the atlas data (§5.3) |
| `layers[]` | kept, not read |

The frame index `i` of a tag (`from`, `to`, a slice key's `frame`) is the `i`-th entry of
`frames` in json order — Aseprite's default export, one entry per frame of the sprite. A sheet
exported with "Split Layers" or "Split Tags" lists more entries than frames and is read entry by
entry; the guide says to export without them.

### 5.2 Tags → animations

| `direction` | frames | playback |
| --- | --- | --- |
| `forward` | `from … to` | `'loop'` |
| `reverse` | `to … from` | `'loop'` |
| `pingpong` | `from … to` | `'pingpong'` |
| `pingpong_reverse` | `to … from` | `'pingpong'` |

- The durations of the frames, ms → s. When all frames of a tag have the same duration the
  animation gets `duration` (their sum) instead of `durations`, so a sheet of even timing bakes
  without the second texel per frame.
- `repeat` (Aseprite writes it as a string, `"repeat": "3"`; a number is read the same):
  absent or `0` plays forever as the table says. A whole number `r ≥ 1` becomes a `'once'`
  animation over the frames played `r` times — for `forward` and `reverse` the list `r` times over;
  for the ping-pongs `r` passes, each after the first the one before it backwards without its
  first frame (`0 1 2 3`, `2 1 0`, `1 2 3`, …), as Aseprite's player counts each direction as one
  pass. `"repeat": "1"` on a `forward` tag is a one-shot.
- `options.playback`, `{[tagName]: AnimationPlayback}`, names the playback of a tag outright: the
  frames follow `direction`, `repeat` is not applied. It is read by its own keys only — an inherited
  one such as `constructor` names no tag. A name that is no tag of the sheet is refused
  (`AsepriteJson: parse() got a playback for the tag "x", which the sheet does not carry — its
  tags are: idle, walk, kick`), and so is a value that is none of `'loop'`, `'once'` and
  `'pingpong'`, naming the tag, before the first frame is added (`AsepriteJson: parse() got a
  playback of "bounce" for the tag "walk" — a playback is 'loop', 'once' or 'pingpong'`).
- Refused, each with the tag named: a `from`/`to` that is no whole number or lies outside
  `0 … frames − 1`, `from > to` (`… — export the sheet again from Aseprite`), an unknown
  `direction` (naming the four), a `repeat` that is no whole number `≥ 0`, two tags of one name
  (`… — rename one of them in Aseprite`), a frame of a tag without a `duration` above 0
  (`AsepriteJson: the frame "x" carries a duration of 0 — Aseprite writes one in ms above zero for every frame`),
  and a tag whose `repeat` plays more than `FrameBasedAnimations.MaxFramesWithDurations` (8191)
  frames of differing durations (`AsepriteJson: the tag "x" plays 9000 frames with their own
  durations — … at most 8191 frames; lower its repeat`). A tag of even durations has no such
  limit of its own: a bake refuses what does not fit.
- A frame name twice in the layout "Array" — Aseprite writes it when the filename format holds no
  `{frame}` — is refused (`AsepriteJson: the frame name "x" appears twice — export with a filename
  format that contains {frame}`); in "Hash" a second key is gone by the time `JSON.parse()` is done.
- Every check runs before the first frame is added, the animations are planned there as well:
  a refused sheet leaves `options.target` as it was, and no `add()` that follows throws.

### 5.3 Frames and slices

The atlas is a `TextureAtlas<AsepriteFrameData>`; every frame's `data` is a copy of its json entry
with two fields added (the json is not mutated):

```ts
export interface AsepriteRect { x: number; y: number; w: number; h: number }

/** The key of a slice in force at one frame. All in pixels of the untrimmed frame (`sourceSize`), from its top left. */
export interface AsepriteFrameSlice {
  /** Where the slice lies in the frame. */
  readonly bounds: AsepriteRect;
  /** The center of a nine-slice, relative to `bounds` as Aseprite writes it. */
  readonly center?: AsepriteRect;
  /** The pivot, relative to `bounds` as Aseprite writes it. */
  readonly pivot?: {x: number; y: number};
}

export interface AsepriteFrameData extends TexturePackerFrameData {
  /** Milliseconds, as Aseprite writes it. */
  duration: number;
  /** The index of the frame in the sprite: its position in `frames`. */
  index: number;
  /** The slices in force at this frame, by name. */
  slices: Readonly<Record<string, AsepriteFrameSlice>>;
}
```

A slice key holds from its `frame` up to the frame before the next key; frames before the first
key carry no entry for that slice. `NineSlice` (phase D) reads `center` and `bounds`, `Anchor`
(phase D) `pivot`; both convert to fractions of the frame themselves. `meta.slices` stays in
`meta` unchanged.

### 5.4 The signature

```ts
export interface AsepriteParseOptions {
  parentCoords?: TextureCoords;
  target?: TextureAtlas<AsepriteFrameData>;
  playback?: Readonly<Record<string, AnimationPlayback>>;
}

AsepriteJson.parse(data: AsepriteJsonData, options?: AsepriteParseOptions):
  [atlas: TextureAtlas<AsepriteFrameData>, meta: AsepriteMetaData, animations: FrameBasedAnimations];
```

The frames go through `TexturePackerJson.parse()` (rotation, a name taken in `target` — refused
before anything is written), the tags through `FrameBasedAnimations#add(name,
timing, atlas, frameNames)`. A sheet without tags answers an empty `FrameBasedAnimations`. Each
call builds a new `FrameBasedAnimations`; a bake of it belongs to the caller as before.

## 6. Atlas adapters in `TextureStore`

### 6.1 The adapter

```ts
export interface AtlasAdapterResult {
  readonly atlas: TextureAtlas;
  readonly animations?: FrameBasedAnimations;
}

/** Reads an atlas json of the TexturePacker envelope — `frames`, `meta.size`, `meta.image` — against the coords of its image. */
export type AtlasAdapter = (json: TexturePackerJsonData, parentCoords: TextureCoords) => AtlasAdapterResult;

export const texturePackerAtlasAdapter: AtlasAdapter;   // TexturePackerJson.parse, no animations
export const asepriteAtlasAdapter: AtlasAdapter;        // AsepriteJson.parse, the tags as animations
```

Two corrections of the roadmap's sketch `(json) => {atlas, meta, animations?}`:

- the adapter takes the image's coords too — the resource lays the frames out on the image it
  loaded, which is how `TexturePackerJson.parse()` is called today;
- it answers no `meta`: the resource keeps none — its `atlasJson` is the json as read.

An adapter reads the envelope TexturePacker, free-tex-packer and Aseprite share, because the
resource has to know the image (`meta.image`) and check the json (`isAtlasJsonResponse`) before
any adapter runs; a packer with another envelope is converted to it first.

### 6.2 Picking one

- `TextureStore#registerAtlasAdapter(name: string, adapter: AtlasAdapter, options?: {app?:
  RegExp}): void` — registers or replaces an adapter under `name`. The store starts with
  `'texturepacker'` (`app: /texturepacker|free-tex-packer/i`) and `'aseprite'` (`app: /aseprite/i`).
  A name that is no non-empty string, an adapter that is no function, an `app` that is no `RegExp`
  are refused with a `TypeError` naming the fix.
- A catalog item names one with `atlasAdapter: 'aseprite'`. A name the store does not know
  makes the item build no resource, reported as an `error` with `source: 'parse'` and the id
  (`TextureStore: item "fighter" names the atlasAdapter "asprite", which this store does not
  know — known: texturepacker, aseprite; register it with registerAtlasAdapter() before parse()`);
  `atlasAdapter` that is no string is a field of the wrong type; on an item without `atlasUrl` it
  is reported and ignored (`… atlasAdapter only reads an atlas — left out`).
- An item that names none is read by the adapter whose `app` matches `meta.app` of its json —
  the latest registered first — and by `'texturepacker'` when none does or `meta.app` is no string.
- A `TextureResource` on its own (no store) picks among the two built-ins the same way.
- A registration reaches the next json a resource reads; resources already parsed are not
  parsed again.

### 6.3 `TextureResource`

- New input on atlas resources: `atlasAdapter: AtlasAdapter | undefined` (the store writes the
  adapter an item names, `undefined` otherwise); on another shape the setter throws the
  `TypeError` of `wrongShapeError()`. A change parses the json again.
- The parse effect calls the adapter where it called `TexturePackerJson.parse()`. A throw, or an
  answer without a `TextureAtlas` as `atlas` (`TextureResource: the atlas adapter of resource
  "x" answered no atlas — an adapter answers {atlas, animations?}`), takes atlas and animations
  back and is reported as today (`source: 'texture'`, step `atlasParse`). An `animations` that is
  no `FrameBasedAnimations` is refused the same way.

### 6.4 The animations of an item

The atlas effect publishes the adapter's `animations` beside the atlas (one batch). The
animations effect then publishes:

- neither adapter animations nor catalog entries: none, as today;
- otherwise a `clone()` of the adapter's animations (or a new, empty one) with every catalog entry
  of the item added — an entry named like a tag is refused by `add()` as a duplicate name and
  reported (`source: 'frameBasedAnimations'`), the tag stays.

So an Aseprite item without `frameBasedAnimations` publishes its tags, an empty set for a sheet
without tags; a catalog entry adds a `frameNameQuery` animation of its own beside them.

A one-shot from code goes through an adapter of one's own:

```ts
store.registerAtlasAdapter('fighter', (json, parentCoords) => {
  const [atlas, , animations] = AsepriteJson.parse(json as AsepriteJsonData, {parentCoords, playback: {kick: 'once'}});
  return {atlas, animations};
});
// catalog: {"fighter": {"atlasUrl": "fighter.json", "atlasAdapter": "fighter"}}
```

## 7. Ownership and lifecycle

Nothing new owns a GPU resource. `AsepriteJson.parse()` and the adapters build plain objects; a
bake stays the caller's. The resource publishes a new `FrameBasedAnimations` per run of its
effect, as today; `clone()` copies only JS objects. `registerAtlasAdapter()` keeps functions,
released with the store.

## 8. Fixtures

`packages/twopoint5d/src/texture/fixtures/aseprite/`: `fighter-hash.json` and `fighter-array.json`, written by
`generate.mjs` in the same folder to Aseprite's documented export format and in its own formatting
(Aseprite is not installed here; the README says so and how to write them again): 16 frames of 16 × 16 on a 64 × 64 sheet, the tags `idle` (pingpong),
`walk` (forward), `kick` (forward, `"repeat": "1"`, 80/80/240 ms), `block` (reverse), `spin`
(pingpong_reverse), the slices `hitbox` (two keys, `pivot`) and `panel` (`center`); the array
sheet trimmed. `biome.jsonc` leaves the folder out: the files keep Aseprite's own formatting.

## 9. Tests

- `FrameBasedAnimations.spec.ts`: the timing forms and every refusal of §3.2; `frameNames`
  lists (order, repeats); the layout of §4.1 (second header position and content, `endTime`,
  `texelsPerFrame` 2 for durations, the size); `animation()`, `clone()`.
- `AnimatedFrames.spec.ts`: the lookup count (19 between the graphs), the swap without rebuild
  still reaching every lookup.
- `AsepriteJson.spec.ts`: both fixtures; every direction; even/uneven durations; `repeat`
  unrolled; `options.playback`; slices per frame; the json not mutated; every refusal of §5.2.
- `TextureResource.spec.ts` / `TextureStore.spec.ts`: `atlasAdapter` input and shape guard;
  picking by `meta.app`, by name, the fallback; unknown name skipped and reported; adapter throw
  and malformed answer reported; tags published without catalog entries, merged with them, a
  colliding entry reported.
- Browser, `sprites-animation-playback.test.js` (WebGPU and WebGL 2): `'once'` holds the last frame
  and shows the first before its start; `'pingpong'` over 4 frames at the 6 positions of a cycle;
  per-frame durations land on the right frame at each side of a boundary; ping-pong with durations
  on the way back; durations before `time + animOffset` reaches 0, in a loop and a ping-pong;
  ping-pong with durations over 1 and over 2 frames; the old-layout map of
  `sprites-animated-material.test.js` still passes, and so does one whose next animation starts
  with a turned frame as high as its image (`v = −1`).
- Browser, `texture-aseprite-sheet.test.js`: the hash fixture through `TextureStore` (`atlasUrl`
  on the dev server, the image a canvas data url as `overrideImageUrl`), the `kick` tag drawn
  before, during and after its run.

## 10. Docs

`docs/sprites.md`, "Animated frames": the new layout table, the playback modes and their math in
a sentence each, `animOffset = -now`, `animation().cycleDuration`; a new subsection "Aseprite
sheets" with a `ts check` block (parse, bake, draw a one-shot) and the store item, the export
settings (no split layers/tags), `repeat`, and the adapter of one's own. `AtlasFrameTable` TSDoc
and "Atlas frames on meshes of one's own": the table keeps `0` where the animsMap keeps the end
time. CHANGELOG `[Unreleased]`: Added (playback, durations, `frameNames`, `animation()`,
`clone()`, `AsepriteJson`, adapters), Changed (the frames of later animations move one texel per
animation before them).
