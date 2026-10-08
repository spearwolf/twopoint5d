# Proposal: pool groups — instanced pools that move in lockstep

Status: **idea, not scheduled.** Carried on from §8 of
[`sprite-features.md`](sprite-features.md), so that the idea outlives the plan it was parked
in. Nothing here is built; the sketch names what a build would have to settle first.

## 1. What it is for — and what it is not for

A sprite kind merges the data of its features into one instanced descriptor
([`sprite-features.md`](sprite-features.md) §3): one pool, one vertex object per sprite, one
`freeVO()` that moves every attribute at once. That leaves three cases a pool group would
serve:

- **A feature added to a live geometry.** A kind is fixed once it is defined; turning on
  `Rotation` for sprites that run without it means a new kind, a new geometry and moving every
  sprite over. A group would attach a second pool for the new data and keep it in step.
- **A second draw that needs data the first does not hold**, one instance per instance of the
  first: a health bar over every unit, with a value of its own. A pass (§6 of the sprite
  features) draws the data of the kind and brings none, so the value has to live in the kind
  of the units today, even though only the bars read it.
- **One feature's data shared between kinds of different descriptors**: two kinds of units
  that read the positions of one formation, written once instead of once per kind.

Not for:

- **Another way to draw one kind** — a shadow, a reflection, a tinted copy. That is a pass:
  one pool, one geometry, a material of its own.
- **Another base over the same instances** — a blob shadow on a quad of its own, a subdivided
  quad. `InstancedVertexObjectGeometry` takes an existing `VertexObjectPool` for its instances,
  so a second geometry over the *same* pool does it; the data is written once.

## 2. Why two pools do not do it today

Every pool keeps its own books (`VertexObjectPool`):

- `usedCount`, `createVO()` and `freeVO()` are per pool, and `InstancedVOBufferGeometry#update()`
  takes `instanceCount` from the instanced pool alone.
- `freeVO()` frees by swap-with-last: the last slot is copied into the freed one. A pool that
  nobody freed keeps its data where it was, and from then on instance *i* of one pool reads
  instance *j* of the other.
- `createFromAttributes()`, `fromBuffersData()` and buffers data handed to the constructor raise
  `usedCount` without making a vertex object, so a follower cannot listen for `createVO()`
  alone.

Two pools stay in step only if every one of these paths is mirrored across both.

## 3. Sketch: `VertexObjectPoolGroup`

```ts
const group = new VertexObjectPoolGroup(unitPool); // the primary decides usedCount
group.join(healthPool); // same capacity, same usedCount, or refused

const unit = group.createVO(); // a slot in every member, voInitialize run in each
group.freeVO(unit); // the same swap-with-last in every member
```

- **The primary decides.** Every `createVO`, `freeVO`, `clear`, write of `usedCount`,
  `createFromAttributes` and `fromBuffersData` goes through the group and reaches every member;
  a member written to directly falls out of step, so a joined pool refuses those calls on its
  own (or the group wraps them).
- **Joining.** Capacities must match, and so must `usedCount` — or the member joins empty and
  the group fills the used slots through `voInitialize`. A pool attached to a geometry cannot
  `resize()` any more, so the capacity is settled before the first attach.
- **The handle.** Either a composite over the member vertex objects, or one generated
  prototype whose accessors route to the member buffers — one handle, name collisions refused
  at `join()`. The second keeps the sprite handle a plain object and the hot-path setters
  allocation-free; the first is easier to build.
- **Ownership.** The group owns no pool. Disposing a member leaves the group; the group refuses
  further work until it is joined again or dropped.

## 4. Costs and limits

- **It touches the pool core.** `freeVO()` becomes one `copyWithin` per member instead of one;
  the allocation specs and benches of `vertex-objects/` have to hold for the group too.
- **More gpu buffers.** Every member brings at least one buffer, where a merged descriptor
  interleaves by usage into two or three. WebGPU allows 8 vertex buffers per pipeline by
  default, and a geometry with a base, a primary and a few members gets there quickly.
- **Slots are for life.** `attachInstancedPool()` gives an attribute slot to one route for the
  life of the geometry: a member detached and replaced has to bring attribute names of its own.
- **One for one.** Every member holds exactly as many instances as the primary. "Not every unit
  has a health bar" does not fit; that stays a pool of its own whose data is written twice.

## 5. When to build it

When a scene needs it and a pass cannot express it: a measurable frame cost from writing the
same data into two kinds, or a feature that has to come and go on live sprites without
rebuilding the geometry. Until then, two kinds that each write a position are less code than a
group that keeps them in step.

## 6. Open questions

- Composite handle or generated prototype (§3)?
- How would `defineSprite()` and `FeatureSprites` take a feature whose data lives in a member
  pool — a kind that declares it as "external", with the material reading the attribute from
  the member route?
- Would a storage buffer read by instance index — TSL's `instancedArray()` or `storage()` under
  WebGPU — share data between kinds without a group, and what does the WebGL 2 fallback make of
  it?
