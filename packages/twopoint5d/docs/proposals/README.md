# Proposals

A proposal is the design of one feature of the library, written before it is built: what it is
for, the API it adds, how it works in the shader and the buffers, what it leaves out, and the
tests that hold it.

## Proposals and guides

The guides of the library are [`sprites.md`](../sprites.md), [`text.md`](../text.md),
[`map2d.md`](../map2d.md), [`display.md`](../display.md) and [`textures.md`](../textures.md) in
`packages/twopoint5d/docs/`.
([`architecture.md`](../architecture.md), [`resource-lifecycle.md`](../resource-lifecycle.md) and
the READMEs under `src/*/` are not guides in this sense.)

The two are written for different readers, and neither takes on the other's:

- **A guide is for the users of the library.** It says what a user can do with a module and how:
  the API, its options and defaults, what it refuses, what it costs, a recipe. It is the state of
  the code as it is, without exception — a guide that disagrees with the code is wrong, and it is
  fixed along with the code. It names no internal module, no test, no proposal, no reason a
  maintainer weighed, and no history: it says what is, never what was or what changed.
- **A proposal is for the developers who maintain and extend the library.** It describes the
  idea of a feature and, where it is not built yet, its future: why it is built the way it is,
  how it works inside, which files and tests hold it, what it leaves out. It is the basis of the
  development: a plan for a build is derived from it. It is no tutorial; for how a user uses the
  feature, it points to the guide section instead of repeating it. While a feature is in
  development, the code may move ahead of its proposal; at the end of that development at the
  latest, the proposal is caught up.
- **Where a proposal and a guide disagree about what is built, the guide holds** — the proposal
  lags behind and is caught up.
- **Neither describes code that no longer exists.** git keeps what was; a proposal keeps only the
  list of where the build left its first draft (see below).

## Before you build a feature

Look here for a proposal that covers it. A change that adds or changes what a user of the library
can do gets a proposal before the code; a bug fix or a refactor that changes no behaviour does
not. The library's API and its guides are written from the proposal, so a plan for the build cites
its sections (`gpu-picking.md` §3.2).

## The status line

Every proposal opens with one line `Status: **…**` under its title. It is the only place the status
is kept — nothing else repeats it, so nothing else can drift from it.

| status | meaning |
| --- | --- |
| `idea, not scheduled` | an idea kept so that it is not lost; nothing is built and nothing is planned |
| `design sketch` | a design in progress; nothing is built |
| `proposed` | the design is complete and waits to be agreed on |
| `specified` | agreed on; the build follows it |
| `phase … implemented` | some phases of a proposal that is built in phases are done; the line names which |
| `implemented` | built; the line names the guide sections, fixtures and browser tests that carry it |

## Reading an implemented proposal

The sections of an implemented proposal state what is built: they were caught up at the end of its
development. The list of deviations under the status line names every place the build left the
first draft, each with the section that now states it — the one place a proposal keeps where the
design moved, and why.

A proposal can still lag behind: a later change of the feature may reach the guide first. Where the
guide says something else than an implemented proposal, the guide holds, and the proposal is
caught up.

## Building a proposal

- The guide grows in the same commit as the feature: a new feature gets its section in
  [`docs/sprites.md`](../sprites.md) (or the guide of its module) before the work counts as done,
  and a change to a built feature changes its guide section with it.
- At the end of the development at the latest, the proposal is caught up: its status moves from
  `specified` to `implemented` (or `phase … implemented`), its deviations name every place the
  build left the design, and its status line links the guide sections that now document the
  feature.
- The code blocks of a proposal are excerpts of an API that did not exist yet when it was
  written; they are plain `ts` blocks and are not type-checked (see "Code blocks in Markdown" in
  [`AGENTS.md`](../../../../AGENTS.md)).

## What is still open

There is no roadmap file. What is open lives in the proposals themselves:

- a proposal whose status is `idea, not scheduled`, `design sketch`, `proposed` or `specified`;
- the sections of a proposal that collect open questions or what it leaves for later — for
  example "Open questions" in [`pool-groups.md`](pool-groups.md), or "Open after the build" in
  [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md).

[`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) is a proposal like the others,
not an index of them and not a roadmap of the project: a review of the Trello board lists `sprites`
and `texture-mapping` against v0.23.0, which split its proposals into the phases A to F, each built
from a proposal of its own. Its §8 lists what the build of those phases left open. None of it is
scheduled, and each item would get a proposal of its own before it is built.

## The proposals

| proposal | what it covers |
| --- | --- |
| [`sprite-features.md`](sprite-features.md) | composable sprite features — kinds, features, bases and passes |
| [`sprite-uniform-bindings.md`](sprite-uniform-bindings.md) | binding sprite uniforms to the scene graph |
| [`flat-placement-orientation.md`](flat-placement-orientation.md) | a plane for flat sprites, a yaw or a quaternion per sprite |
| [`atlas-frame-sampling.md`](atlas-frame-sampling.md) | sampling atlas frames on meshes of one's own |
| [`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md) | review of the board lists `sprites` and `texture-mapping`, phases A to F |
| [`fade-flash-axis-billboards.md`](fade-flash-axis-billboards.md) | `Fade`, `Flash`, axis billboards, the warning of a full pool, free-tex-packer, the glow recipe |
| [`animation-playback-and-aseprite.md`](animation-playback-and-aseprite.md) | playback modes, per-frame durations, Aseprite sheets |
| [`pipeline-stages-and-grid-base.md`](pipeline-stages-and-grid-base.md) | frame stages, uv stages, a grid base, shared uniforms |
| [`flip-anchor-nine-slice.md`](flip-anchor-nine-slice.md) | `Flip`, `Anchor`, `NineSlice` |
| [`wave-and-segment-sprites.md`](wave-and-segment-sprites.md) | `wave()`, segment sprites, `RepeatingTextureColor` |
| [`dynamic-atlas-and-bitmap-text.md`](dynamic-atlas-and-bitmap-text.md) | `DynamicAtlas`, bitmap fonts, `writeText()` |
| [`table-frames-and-palette-swap.md`](table-frames-and-palette-swap.md) | `tableFrame()`, directional frames, `PaletteSwap` |
| [`pool-sorting.md`](pool-sorting.md) | draw order — sorting a vertex object pool |
| [`growing-capacity.md`](growing-capacity.md) | pools that grow instead of running out of slots |
| [`gpu-picking.md`](gpu-picking.md) | GPU picking — which sprite is under the pointer |
| [`pool-groups.md`](pool-groups.md) | instanced pools that move in lockstep |
| [`texture-dx-gaps.md`](texture-dx-gaps.md) | wrap classes, the frames of an animation, `isAsepriteFrameData()`, a second filter of a `DynamicAtlas`, `playback` per tag in a catalog |
| [`pixel-exact-projection-fit.md`](pixel-exact-projection-fit.md) | `pixelSnap` — a projection fit at a whole number of buffer pixels per unit, and a frustum aligned to whole units |
| [`sprite-visibility.md`](sprite-visibility.md) | `Visible` — a flag per sprite that collapses its vertices in the last mesh stage |

A new proposal is a file of its own here, named after its subject, with a row in this table.
