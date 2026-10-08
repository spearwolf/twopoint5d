# Proposal: binding sprite uniforms to the scene graph

Status: **proposed** — 2026-10-08, on top of the passes of
[`sprite-features.md`](sprite-features.md) §6, which are still unreleased.

## 1. Goal

The shadow and the reflection of a sprite need a plane and, for the shadow, a light. Today both
are numbers the caller works out and writes with `setUniform()`, in the local space of the sprites
mesh and in the form `[n.x, n.y, n.z, d]` of the plane `dot(n, p) = d`. Taking them from a
three.js scene means flipping the sign of `Plane#constant`, inverting `matrixWorld` of the sprites
and doing it again in every frame something moves.

The goal: hand the sprites a node of the scene graph — the ground mesh, a light — and have the
uniforms follow it, once per frame, without allocations. The lookbook demo `animated-billboards`
is the first user: its sprites throw their shadows exactly onto its ground mesh.

```ts
sprites.bindUniform('groundPlane', planeOf(ground));
sprites.bindUniform('shadowLight', lightOf(sun));
sprites.bindUniform('mirrorPlane', planeOf(ground));
```

A reflection needs the plane alone — the point of view is the camera's, which the renderer
handles anyway. A shadow needs the plane and the light.

Beyond the bindings, this proposal lets a pass skip its draw call in a frame its uniforms make
pointless (§5), turns the light of `PlanarShadow` into a homogeneous one that is either a
direction or a point, keeps a point light from stretching a shadow to infinity (§4), and lets a
pass rename the uniforms of its features, so that one set of sprites throws two shadows from two
lights without a copy of the shader code (§6).

## 2. Uniform sources

A source writes one uniform value per frame, in the local space of the sprites:

```ts
/**
 * `type` is the type of the uniform it writes; `bindUniform()` checks it against the uniform.
 * `write()` writes the value into `out` — the vector of the uniform node itself — with
 * `worldToSprites` the inverse of `matrixWorld` of the sprites, current for this frame. It
 * allocates nothing.
 */
export type SpriteUniformSource =
  | {readonly type: 'vec3'; write(out: Vector3, worldToSprites: Matrix4): void}
  | {readonly type: 'vec4'; write(out: Vector4, worldToSprites: Matrix4): void};
```

A source writes into the vector of the uniform node and hands no number across a call: V8 boxes
a fractional argument at every call it leaves un-inlined, and `update()` runs every frame.

Two factories ship with the library. Each source keeps scratch objects of its own, built once.

### 2.1 `planeOf()`

```ts
planeOf(node: Object3D, options?: {plane?: Plane}): SpriteUniformSource; // type 'vec4'
planeOf(plane: Plane): SpriteUniformSource;                               // type 'vec4'
```

- **A node.** The plane is `options.plane` in the local space of the node, by default the local
  XY plane with the normal +Z — the plane a `PlaneGeometry` lies in, its front face on the side
  the normal points to. Per frame: `node.updateWorldMatrix(true, false)`,
  `M = worldToSprites · node.matrixWorld`, `scratch.copy(localPlane).applyMatrix4(M)`.
  `Plane#applyMatrix4` transforms the normal by the normal matrix, so a non-uniform scale is
  handled.
- **A `Plane`.** A fixed plane in world space; per frame `scratch.copy(plane).applyMatrix4(worldToSprites)`.
- **Output** `[n.x, n.y, n.z, -constant]`: three's `Plane` is `dot(n, p) + constant = 0`, the
  uniform is `dot(n, p) = d`. The normal is not normalized; the features do not need it to be.

The orientation of the normal matters from this proposal on (§5): **the sprites stand on the side
the normal points to.** For the default plane of a node that is the front face of its
`PlaneGeometry`; the ground of `animated-billboards` (`rotation.x = -π/2`) has its normal at +Y.

### 2.2 `lightOf()`

```ts
lightOf(node: Object3D): SpriteUniformSource; // type 'vec4'
```

The output is a homogeneous light, as `shadowLight` (§4) expects:

- **`DirectionalLight`** — `[dir, 0]` with `dir = lightPosition − targetPosition` in world space,
  the direction *towards* the light, transformed by the linear part of `worldToSprites`
  (`Vector3#transformDirection`; its normalization does no harm). `updateWorldMatrix(true, false)`
  runs on the light and on `light.target`, so a target outside the scene works as well.
- **every other node** — `[position, 1]`, its world position transformed by `worldToSprites`: a
  point light. That covers `PointLight`, `SpotLight` (a point source; its cone is ignored) and any
  `Object3D` used as a lamp. An `AmbientLight` or a `HemisphereLight` has no position that means
  anything; `lightOf()` takes it like any node, and the docs say so.

## 3. Binding on `FeatureSprites`

```ts
class FeatureSprites {
  /** Binds the uniform `name` to `source`; replaces an earlier binding of that name. */
  bindUniform(name: string, source: SpriteUniformSource): void;
  /** Ends the binding of `name`; the uniform keeps the value written last. */
  unbindUniform(name: string): void;
}
```

- **Checks.** `bindUniform()` throws a `TypeError` for a name that is no uniform of the sprites or
  their passes, for a source whose `type` is not the type of that uniform, and for a source without
  `type` and `write`. Nothing is bound when it throws.
- **Order.** Bindings are evaluated in the order they were made; a rebinding keeps its place.
- **`setUniform()` on a bound name** writes the value, and the next `update()` overwrites it. It
  does not throw — a caller who sets a start value before binding is not wrong — and the docs say
  that the binding wins.
- **Lifecycle.** The nodes and the `Plane` stay the caller's. `dispose()` drops every binding, so
  the sprites hold no node after it. After `dispose()`, `bindUniform()` and `unbindUniform()` do
  nothing, as `setUniform()` does.
- **A material handed in.** Bindings write into the uniforms of the material, so they work with a
  material handed in as well — for the uniforms that material holds.

### 3.1 The order of `update()`

1. Without bindings and without a pass that has a `visible` hook (§5), `update()` is what it is
   today: `super.update()`, the upload of the geometry.
2. With bindings: `this.updateWorldMatrix(true, false)`, then `worldToSprites.copy(this.matrixWorld).invert()`
   into a `Matrix4` of the instance. For every binding `source.write(vector, worldToSprites)`, where
   `vector` is the `value` of the uniform node, looked up once in `bindUniform()` — the uniforms
   are shared, so every pass reads the value.
3. For every pass with a `visible` hook: its visibility for this frame (§5).
4. `super.update()`.

`update()` refreshes the world matrices it reads itself, because the renderer runs
`scene.updateMatrixWorld()` only inside `render()` — after `update()`. A node moved after
`update()` in the same frame shows up one frame late, which fits the contract `update()` already
has: after the changes, before rendering.

`onBeforeRender` is not the place: the passes draw before the sprites (`renderOrder: -1`) and
share their uniforms, so a hook on the sprites mesh comes too late for them, and a hook on a pass
mesh would run once per `render()` call and make the order of the passes part of the logic.

## 4. `PlanarShadow` with a homogeneous light

`lightDirection` (`vec3`) becomes **`shadowLight`** (`vec4`), a homogeneous light `[x, y, z, w]`:
`w = 0` is a direction towards the light, `w = 1` the position of a point light. The name carries
`shadow`, since uniform names are shared by every feature of a kind and `light` alone would
collide sooner or later. The start value is `[-0.4, 1, -0.3, 0]` — the light of today's start
value `[0.4, -1, 0.3]`, which was the direction the light travels in, now pointing towards it.

With the plane `(n, d)`, the placed vertex `p` and the light `(l, w)`:

```text
h_p  = dot(n, p) − d                         height of the vertex above the plane
h_L  = dot(n, l) − w · d                     height of the light (w = 1), or dot(n, l) (w = 0)
e    = w · max(h_p − (1 − k) · h_L, 0)        how far a vertex reaches above the clamp
p_c  = p − n · e / dot(n, n)                 the vertex, brought down by e along the normal
L    = l − w · p_c                           direction from the vertex towards the light
p'   = p_c − L · (h_p − e) / dot(n, L)
```

- For `w = 0`, `e = 0` and `dot(n, L) = h_L`: the result is the projection of today. It is
  defined while `h_L > 0`, which the `visible` hook of `ShadowPass` ensures.
- For `w = 1`, the vertex is projected from the light onto the plane. As a vertex approaches the
  height of the light, `dot(n, L)` goes to 0 and the shadow to infinity; above the light it would
  land on the wrong side. A vertex above `(1 − k) · h_L` therefore first comes down along the
  normal to that height, and is projected from there: `dot(n, L) ≥ k · h_L`, so the shadow grows
  very long but stays finite, on the far side of the light and **in the plane** — clamping the
  denominator instead would lift the vertex out of the plane. `k` is a constant of the feature,
  `1 / 20`: a vertex lands at most 19 times its distance to the light away. The shadow is
  continuous where the clamp sets in.
- Every term scales with `|n|`, so the normal still need not be a unit vector.
- The sign of `l` does not change `p'` for `w = 0`; it matters for §5, which is why the direction
  points towards the light.

## 5. A pass that skips its frame

Some light and plane make every shadow pointless: a directional light parallel to the plane, or
coming from below it, and a point light in the plane or below it. The uniforms alone decide that,
so `update()` can leave the pass out for the frame and save its draw call.

```ts
interface SpritePass {
  // … as today
  /**
   * Whether the pass is drawn in this frame, judged by the uniforms of the sprites after the
   * bindings are written. `uniform(name)` answers the uniform the features of this pass read under
   * `name` — through the renaming of the pass (§6), so a renamed copy of a pass judges its own
   * uniforms. Runs in every `update()`; allocates nothing.
   */
  readonly visible?: (uniform: (name: string) => SpriteUniformNode) => boolean;
}

class FeatureSpritesPass {
  /** The caller's switch; the pass is drawn while it is on and its `visible` hook agrees. */
  enabled: boolean; // true
}
```

- `update()` sets `mesh.visible = mesh.enabled && pass.visible(uniform)` for every pass with a
  hook; the lookup `uniform` is built once per pass mesh, not per frame. The `enabled` setter sets `mesh.visible = enabled && <the hook's last answer>`, which is
  `true` for a pass without a hook. So a caller who switches a pass off is not switched back on by
  the next `update()`. The docs tell the caller to use `enabled` rather than `visible` on a pass
  mesh.
- `definePass()` checks that `visible`, if given, is a function, and freezes it along with the
  rest.
- **`ShadowPass`** ships a hook. With `groundPlane = (n, d)` and `shadowLight = (l, w)`,
  `h_L = dot(n, l) − w · d`:
  - `w = 0`: drawn while `h_L > ε · |n| · |l|`, i.e. the cosine between the normal and the
    direction towards the light is above `ε = 1e-3`. Parallel or from below: not drawn.
  - `w = 1`: drawn while `h_L > 0`, i.e. the light is above the plane.
- `ReflectionPass` takes no hook: a mirror image is always defined.

## 6. Several passes of one kind: renaming uniforms

### 6.1 Shadow and reflection together

`passes: [ShadowPass, ReflectionPass]` works without anything of this proposal: their uniforms
have distinct names (`groundPlane`, `shadowLight`, `shadowColor` against `mirrorPlane`,
`reflectionColor`), so each binds to a node of its own —

```ts
sprites.bindUniform('groundPlane', planeOf(ground));
sprites.bindUniform('shadowLight', lightOf(sun));
sprites.bindUniform('mirrorPlane', planeOf(water));
```

— but the two presets share `renderOrder: -1`, and the pair needs an order with the ground
between them. The reflection lies behind a transparent ground and has to be drawn before it, to
show through; the shadow lies on the ground, writes no depth and has to be drawn after it, or the
ground covers it. So: reflection < ground < shadow < sprites, set through
`sprites.passes['shadow']!.renderOrder` or a `definePass({...ShadowPass, renderOrder})`.
`docs/sprites.md` states the order under "The scene around them".

### 6.2 Two shadows: `uniformNames`

Uniform names are shared by the kind and every pass, so a second shadow needs uniforms of other
names. Today that means a feature of one's own with the shader code of `PlanarShadow` copied
(`MoonShadow` in `docs/sprites.md`). And a copy of the pass alone is a trap:
`definePass({...ShadowPass, name: 'moonShadow'})` is not refused — `collectSpriteDeclarations`
takes one feature object once, on purpose, since a feature may come along in the kind and again
in a pass — and both passes read the same uniforms and draw the same shadow twice.

A pass gets a renaming of the uniforms its features read:

```ts
interface SpritePass {
  // … as today
  /** Uniforms of the features of this pass under other names: declared name → name of the pass. */
  readonly uniformNames?: Readonly<Record<string, string>>;
}

const MoonShadowPass = definePass({
  ...ShadowPass,
  name: 'moonShadow',
  uniformNames: {groundPlane: 'moonGround', shadowLight: 'moonLight', shadowColor: 'moonShadowColor'},
});

const sprites = new FeatureSprites(TexturedSpriteKind, {passes: [ShadowPass, MoonShadowPass]});
sprites.bindUniform('shadowLight', lightOf(sun));
sprites.bindUniform('groundPlane', planeOf(ground));
sprites.bindUniform('moonLight', lightOf(moon));
sprites.bindUniform('moonGround', planeOf(ground));
```

- **In the shader.** The material of the pass answers `ctx.uniform(name)` with the uniform
  `uniformNames[name] ?? name`. The features stay as they are; no shader code is copied.
- **Declared.** A pass with `uniformNames` draws with renamed copies of its features, built once
  per pass and cached: each copy declares its uniforms under the new names, with the start values
  of the feature, and hands its stages a shader context whose `uniform()` resolves through the
  renaming. The declarations take a uniform once per feature *of origin* and resolved name, so
  `PlanarShadow` in `ShadowPass` and its copy in `MoonShadowPass` declare `groundPlane` and
  `moonGround`, while a feature in the kind and its unrenamed copy in a pass still declare a name
  once.
- **Checked.** `definePass()` refuses a key that no feature of the pass declares as a uniform, a
  target name that is not a non-empty string, and two keys with one target. A target that
  collides with a uniform of the kind or of another pass is refused by the check that exists:
  "both declare the uniform".
- **Only the features of the pass** are renamed. The features of the kind a pass draws with read
  their uniforms under their own names in every pass — `time` stays one uniform.
- **Textures are not renamed.** Every pass reads the `colorMap` of the sprites; a texture of a
  pass's own under a second name waits for a pass that needs one.
- **The `visible` hook** reads through the renaming (§5), so the hook of `ShadowPass` judges
  `moonGround` and `moonLight` in `MoonShadowPass`.
- **The trap stays legal.** Two passes that share a feature and its uniforms on purpose — one
  `reflectionColor` for two reflections — are not wrong. `docs/sprites.md` names the trap next to
  `uniformNames`.

Two lights throw two shadows, and where they overlap the ground darkens twice — which, for two
lights, is close to right.

## 7. Left out, documented

- **Sprites below the plane.** A shadow of a sprite on the far side of the plane should not
  exist; the projection draws one anyway. Only a vertex knows its side, and a sprite crossing the
  plane cannot be cut in the vertex shader. Documented.
- **A finite ground.** The plane is infinite; the ground mesh is not. A shadow beyond its edge
  hangs in the air. Clipping it to the mesh needs a stencil or a clip in the fragment stage in
  the local space of the ground — a proposal of its own.
- **Overlapping shadows darken twice**, as today (`docs/sprites.md`, "The limits").
- **A light per sprite.** Uniforms hold for every sprite of a `FeatureSprites`, and a pass brings
  no data; sprites under different lights are sprites in different meshes.

## 8. Files

`docs/sprites.md` grows with the features, not after them: every step that adds or changes a
public symbol — a source, `bindUniform()`, `shadowLight`, the hook, `enabled`, `uniformNames` —
brings its section of `docs/sprites.md` in the same commit, with a `ts check` block where the
usage stands on its own, and states what works and what does not (§7). A user or an agent who
reads `docs/sprites.md` alone knows how to use each feature and where it stops.

| File | Change |
| --- | --- |
| `src/sprites/bindings/SpriteUniformSource.ts` | the interface |
| `src/sprites/bindings/planeOf.ts`, `lightOf.ts` | the factories |
| `src/sprites/bindings/public-api.ts` | re-exported from `src/sprites/public-api.ts` |
| `src/sprites/FeatureSprites/FeatureSprites.ts` | `bindUniform()`, `unbindUniform()`, the order of `update()`, `dispose()` drops the bindings; `FeatureSpritesPass#enabled` |
| `src/sprites/passes/definePass.ts`, `passFeatures.ts` | the `visible` hook and `uniformNames`, checked and frozen |
| `src/sprites/passes/passUniformNames.ts` | the renamed copies of the features of a pass, cached per pass, and the feature each copy came from |
| `src/sprites/spriteDeclarations.ts` | declarations per feature of origin and resolved name |
| `src/sprites/passes/PlanarShadow.ts` | `shadowLight`, the homogeneous projection with the clamp |
| `src/sprites/passes/passPresets.ts` | the hook of `ShadowPass` |
| `docs/sprites.md` | a section "Binding uniforms to the scene graph" with a `ts check` block; the table of the presets and its formula move to `shadowLight`; `enabled`, the hook and `uniformNames` in the rules of the passes, the trap of a copied pass next to it; the render order of shadow and reflection together (§6.1) under "The scene around them"; `MoonShadow` becomes a renamed `ShadowPass`; §7 as limits |
| `CHANGELOG.md` | `[Unreleased]`: the bindings and the hook as additions; `lightDirection` → `shadowLight` amends the still unreleased entry of the pass features instead of a breaking change |
| `src/sprites/passes/pass-features.spec.ts`, `packages/twopoint5d-testing/test/sprites-shadow-pass.test.js` | move from `lightDirection` to `shadowLight`; the new cases of §9 |
| `docs/proposals/sprite-features.md` | unchanged — it is kept as it was written; its status block points here for `shadowLight` |
| `apps/lookbook/src/pages/demos/animated-billboards.astro` | options form instead of a material handed in (passes refuse one), `passes: [ShadowPass]`, `bindUniform('groundPlane', planeOf(plane))`, the light from `lightOf()` |
| `apps/lookbook/src/pages/demos/sprite-reflection.astro`, `_sprite-reflection.json`, its preview image | the new demo of §10 |

## 9. Tests

- **Vitest, sources** (`bindings/*.spec.ts`):
  - `planeOf()` of a mesh rotated by `-π/2` around X and moved to `y = 2` writes `[0, 1, 0, 2]`;
    with the sprites moved and turned, the plane in their local space.
  - `planeOf(new Plane(new Vector3(0, 1, 0), -2))` writes `d = 2` — the sign of `constant`.
  - an explicit `options.plane` in the local space of the node.
  - `lightOf()` of a `DirectionalLight` writes `w = 0` and the direction towards the light, of a
    `PointLight` and of a bare `Object3D` `w = 1` and the position, each in the local space of
    the sprites.
  - a node moved without `updateMatrixWorld()` is read at its new place.
- **Vitest, `FeatureSprites`**: `update()` writes the bound uniform for the sprites and every
  pass; a rebinding replaces and keeps its place; `unbindUniform()` keeps the last value; the
  three `TypeError`s of §3, with nothing bound afterwards; `setUniform()` on a bound name is
  overwritten by `update()`; `dispose()` drops the bindings, and binding afterwards does nothing.
- **Vitest, passes**: `definePass()` refuses a `visible` that is no function and freezes it;
  `update()` sets `visible` from the hook; `enabled = false` survives `update()`; `enabled = true`
  restores the hook's answer. The hook of `ShadowPass` for a light from above, parallel, from
  below, and for a point light above, in and below the plane.
- **Vitest, `uniformNames`**: `definePass()` refuses an unknown key, an empty target and two keys
  with one target; `ShadowPass` and a renamed copy on one `FeatureSprites` declare both sets of
  uniforms, start them with the values of the feature, and `setUniform()` on one leaves the other
  alone; the material of the copy reads the renamed uniforms (its node graph holds them, not the
  originals); a target that collides with a uniform of the kind is refused; the hook of the copy
  judges the renamed uniforms; a plain copy without `uniformNames` shares the uniforms, as
  documented.
- **Vitest, `PlanarShadow`** through `evaluateNode`: `w = 0` gives the values of today's
  projection for the start value; `w = 1` the projection from a point; a vertex above a point
  light lands on the side of the shadow, at a finite place.
- **Allocations**: `hot-path-allocations.spec.ts` measures `update()` with a plane and a light
  binding and a pass with a hook — 0 bytes.
- **Browser** (`sprites-shadow-pass.test.js`, WebGPU and WebGL 2): a ground mesh moved and
  turned, bound through `planeOf()`, and a point light bound through `lightOf()` — the shadow lies
  where the projection puts it; a light below the ground draws no shadow.

## 10. Lookbook demo: `sprite-reflection`

A demo of `ReflectionPass` and `planeOf()`: bouncing sprites seen head-on in the upper half of the
window, their mirror image in the lower half, darker — a waterline.

- **Scene.** The mirror is the world plane `y = 0`. The camera stands at `y = 0` and looks along
  −Z, so the horizon runs through the middle of the window and the mirror is seen edge-on.
- **Sprites.** The 2D `BouncingSprites` of `animated-sprites` (`~demos/animated-sprites/BouncingSprites`),
  in an `AnimatedSpriteKind` built in the options form with `passes: [ReflectionPass]`. Their
  container is centred on 0, so the sprites mesh moves to `position.y = H / 2`: the edge they
  bounce off lies on the mirror, and each sprite touches its image there.
- **Upper half.** The camera distance satisfies `tan(fov / 2) · dist = H`, so the container
  height fills the upper half exactly. On every resize `containerWidth = 2 · aspect · H`, so the
  sprites fly to the edge of the window at any aspect.
- **The mirror** is bound, not computed: `waterline` is an `Object3D` at `y = 0` with
  `rotation.x = -π/2`, and `sprites.bindUniform('mirrorPlane', planeOf(waterline))`. Since the
  sprites mesh is moved, the plane lies at `y = -H / 2` in its local space — which `planeOf()`
  works out, and which is the offset a hand-written `setUniform()` gets wrong.
- **Look.** A background close to black (`rgb(4 4 8)`); `reflectionColor` around
  `[0.35, 0.38, 0.45, 0.55]` — darker, a little cool, half transparent; a faint horizon line, a
  `Line` along X at `y = 0` in world space — a strip in the plane of `waterline` would be seen
  edge-on and vanish.
- **Interaction** as in `animated-sprites`: *more* and *less* create and free sprites. The orbit
  controls stay on — tilting the camera shows that the mirror image is geometry and stays right
  from any angle.
- **Lookbook duties.** `_sprite-reflection.json` with title, descriptions, url and tags
  (`FeatureSprites`, `ReflectionPass`, `planeOf`, `AnimatedSpriteKind`, `FrameBasedAnimations`,
  `TextureStore`, `vanilla`, …), which `pnpm test:scripts` holds to the exports of the library;
  a preview image through `pnpm lookbook:generate-previews --only=sprite-reflection`, which
  `pnpm test:scripts` holds to the demo as well.
