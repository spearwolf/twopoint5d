# Proposal: binding sprite uniforms to the scene graph

Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Binding uniforms to the
scene graph" and "Passes: shadows and reflections", and the lookbook demos `animated-billboards`
and `sprite-reflection`. Deviations of the build from the first draft of this spec, which the
sections below now state as built:

- `planeOf()` carries the plane as a covector `[n, −d]` through the inverse of the node→sprites
  map instead of `Plane#applyMatrix4` (§2.1): that is exact for a normal of any length (three's
  `applyMatrix4` and `coplanarPoint` assume a unit normal), and it makes no call with fractional
  arguments on the per-frame path;
- `lightOf()` carries the direction of a `DirectionalLight` through the linear part of
  `worldToSprites` by hand and leaves it unnormalized, instead of `Vector3#transformDirection`
  (§2.2): neither the projection nor the hook of `ShadowPass` depends on its length;
- `definePass()` additionally refuses a `uniformNames` target that a feature of the pass already
  declares under its own name (the identity mapping stays allowed), not only two keys with one
  target (§6.2): such a target would collapse two uniforms of the pass into one without an error;
- `bindUniform()` looks names up as own keys of the uniforms record, so a name like
  `constructor` is refused as unknown (§3);
- the browser test of a bound plane uses a node moved along and turned about its normal, and adds
  it to the scene; that `planeOf()` refreshes a stale world matrix itself is pinned by the Vitest
  spec instead (§9);
- `planeOf()`, `lightOf()` and `SpriteUniformSource` are exported straight from
  `src/sprites/public-api.ts`; there is no `src/sprites/bindings/public-api.ts` (§8);
- the declarations take a uniform once per feature of origin and the name that feature declares
  it under before the renaming — its *source* name — not per feature of origin and resolved name
  alone (§6.2): two renamed copies of one pass that give one target to two different uniforms
  (`{shadowLight: 'x'}` and `{groundPlane: 'x'}`) are refused as "both declare the uniform"
  instead of merging them into one; `definePass()` and the lookups through `uniformNames` take
  own keys only, so a member of `Object.prototype` such as `toString` is never a declared or
  renamed name;
- the demo `sprite-reflection` counts the size of a sprite into the upper half of the window (§10):
  a sprite at the top of the container reaches half its size above it, and one at the bottom
  touches the mirror with its lower edge.

## 1. Goal

The shadow and the reflection of a sprite need a plane and, for the shadow, a light. Written by
hand, both are numbers the caller works out with `setUniform()`, in the local space of the sprites
mesh and in the form `[n.x, n.y, n.z, d]` of the plane `dot(n, p) = d`. Taking them from a
three.js scene means flipping the sign of `Plane#constant`, inverting `matrixWorld` of the sprites
and doing it again in every frame something moves.

A binding hands the sprites a node of the scene graph — the ground mesh, a light — and the
uniforms follow it, once per frame, without allocations. The lookbook demo `animated-billboards` is
built on it: its sprites throw their shadows exactly onto its ground mesh, under a sun that circles
the scene.

```ts
sprites.bindUniform('groundPlane', planeOf(ground));
sprites.bindUniform('shadowLight', lightOf(sun));
sprites.bindUniform('mirrorPlane', planeOf(ground));
```

A reflection needs the plane alone — the point of view is the camera's, which the renderer
handles anyway. A shadow needs the plane and the light.

Beyond the bindings, a pass skips its draw call in a frame its uniforms make pointless (§5), the
light of `PlanarShadow` is a homogeneous one that is either a direction or a point, a point light
does not stretch a shadow to infinity (§4), and a pass renames the uniforms of its features, so
that one set of sprites throws two shadows from two lights without a copy of the shader code (§6).

## 2. Uniform sources

A source writes one uniform value per frame, in the local space of the sprites
(`src/sprites/bindings/SpriteUniformSource.ts`):

```ts
/**
 * Writes one uniform of a {@link FeatureSprites} every frame, bound through `bindUniform()`. `type`
 * is the type of that uniform. `write()` writes the value into `out`, the vector of the uniform
 * node itself, in the local space of the sprites: `worldToSprites` is the inverse of their
 * `matrixWorld`, current for this frame. It runs every frame and allocates nothing — it writes
 * fields, and hands no fractional number across a call it makes.
 */
export type SpriteUniformSource =
  | {readonly type: 'vec3'; write(out: Vector3, worldToSprites: Matrix4): void}
  | {readonly type: 'vec4'; write(out: Vector4, worldToSprites: Matrix4): void};
```

A source writes into the vector of the uniform node and hands no number across a call: V8 boxes
a fractional argument at every call it leaves un-inlined, and `update()` runs every frame. A
`float` or a `vec2` uniform takes no source.

Two factories ship with the library. Each source keeps scratch objects of its own, built once.

### 2.1 `planeOf()`

```ts
planeOf(node: Object3D, options?: {plane?: Plane}): SpriteUniformSource; // type 'vec4'
planeOf(plane: Plane): SpriteUniformSource;                               // type 'vec4'
```

The plane is held as the row vector `c = [n, constant]` — three's `Plane` is
`dot(n, p) + constant = 0`, so this is `[n, −d]` of the uniform's `dot(n, p) = d` — and is carried
into the local space of the sprites through the inverse of the map from its own space:

- **A node.** The plane is `options.plane` in the local space of the node, copied when the source
  is made, by default the local XY plane with the normal +Z — the plane a `PlaneGeometry` lies in,
  its front face on the side the normal points to. Per frame: `node.updateWorldMatrix(true,
  false)`, `M = worldToSprites · node.matrixWorld`, and `c · M⁻¹`. The covector is exact for a
  normal of any length and for any affine map — a node scaled unevenly, or turned inside a parent
  scaled unevenly, which shears it.
- **A `Plane`.** A fixed plane in world space, copied when the source is made; per frame
  `c · worldToSprites⁻¹`.
- **Output** `[n.x, n.y, n.z, d]`: the first three components of the product, and its fourth with
  the sign turned. The normal is not normalized; the features do not need it to be.

The source holds `c` and one `Matrix4` of its own. The orientation of the normal matters (§5):
**the sprites stand on the side the normal points to.** For the default plane of a node that is
the front face of its `PlaneGeometry`; the ground of `animated-billboards` (`rotation.x = -π/2`)
has its normal at +Y.

- **Checks** at the call: a target that is neither an `Object3D` (`isObject3D`) nor a `Plane`
  (`isPlane`), options that are no object and an `options.plane` that is no `Plane` are refused
  with a `TypeError` (`planeOf: the target must be an Object3D or a Plane, got …`); a normal or a
  constant that is no finite number with a `RangeError` through `assertFinite()` (`planeOf:
  plane.normal.x must be a finite number, got NaN`). A normal of (0, 0, 0) passes; the passes draw
  nothing for it.

### 2.2 `lightOf()`

```ts
lightOf(node: Object3D): SpriteUniformSource; // type 'vec4'
```

The output is a homogeneous light, as `shadowLight` (§4) expects:

- **`DirectionalLight`** — `[dir, 0]` with `dir = lightPosition − targetPosition` in world space,
  the direction *towards* the light, multiplied by the linear part of `worldToSprites`, not
  normalized. `updateWorldMatrix(true, false)` runs on the light and on `light.target`, so a target
  outside the scene works as well.
- **every other node** — `[position, 1]`, its world position transformed by `worldToSprites`: a
  point light. That covers `PointLight`, `SpotLight` (a point source; its cone is ignored) and any
  `Object3D` used as a lamp. An `AmbientLight` or a `HemisphereLight` has no position that means
  anything; `lightOf()` takes it like any node, and the docs say so.
- **Checks** at the call: a node that is no `Object3D` is refused with a `TypeError` (`lightOf: the
  node must be an Object3D — a light or a node that marks one —, got …`).

## 3. Binding on `FeatureSprites`

```ts
class FeatureSprites {
  /** Binds the uniform `name` to `source`; replaces an earlier binding of that name. */
  bindUniform(name: string, source: SpriteUniformSource): void;
  /** Ends the binding of `name`; the uniform keeps the value written last. */
  unbindUniform(name: string): void;
}
```

- **Checks.** `bindUniform()` throws a `TypeError`, and binds nothing then:
  - for something that is no source — `FeatureSprites: bindUniform("…") takes a source with a type
    of vec3 or vec4 and a write()`;
  - for a name no feature of the sprites or their passes declares, looked up as an own key of the
    uniforms — `FeatureSprites: no feature of these sprites or their passes declares the uniform
    "…"`;
  - for a source whose `type` is not the type of the uniform — `FeatureSprites: the uniform "…" is
    a vec3, and the source bound to it writes a vec4`, the uniform's type read off its value
    (`float`, `vec2`, `vec3` or `vec4`).
- **Order.** Bindings are evaluated in the order they were made; a rebinding replaces the source
  and keeps its place. `unbindUniform()` of a name without a binding does nothing.
- **`setUniform()` on a bound name** writes the value, and the next `update()` overwrites it. It
  does not throw — a caller who sets a start value before binding is not wrong — and the docs say
  that the binding wins.
- **Lifecycle.** The nodes and the `Plane` stay the caller's. `dispose()` drops every binding, so
  the sprites hold no node after it. After `dispose()`, `bindUniform()` binds nothing and still
  throws a `TypeError` for something that is no source, and `unbindUniform()` does nothing, as
  `setUniform()` does.
- **A material handed in.** Bindings write into the uniforms of the material of the sprites — the
  one they were built with —, so they work with a material handed in as well, for the uniforms that
  material holds, and never reach a material put into the `material` slot later. A material shared
  by several `FeatureSprites` at different transforms shares its uniforms, so their bindings
  overwrite each other and the last `update()` wins.

### 3.1 The order of `update()`

1. With bindings: `this.updateWorldMatrix(true, false)`, then
   `worldToSprites.copy(this.matrixWorld).invert()` into a `Matrix4` of the instance. For every
   binding `source.write(vector, worldToSprites)`, where `vector` is the `value` of the uniform
   node, looked up once in `bindUniform()` — the uniforms are shared, so every pass reads the value.
   Each binding is one entry that pairs the source with the vector of its uniform, by type; the
   list is walked by index.
2. For every pass with a `visible` hook: its visibility for this frame (§5).
3. `super.update()`, the upload of the geometry.

A source or a hook that throws stops neither the others nor the upload: once the upload is done,
`update()` throws what it threw, naming the uniform of the source or the pass of the hook —
`FeatureSprites: the visible of pass "shadow" threw: …` —, several as an `AggregateError`. A pass
whose hook threw keeps the visibility of its last judgement.

Without bindings and without a pass that has a hook, `update()` is the upload alone.

`update()` refreshes the world matrices it reads itself, because the renderer runs
`scene.updateMatrixWorld()` only inside `render()` — after `update()`. A node moved after
`update()` in the same frame shows up one frame late, which fits the contract `update()` has:
after the changes, before rendering.

`onBeforeRender` is not the place: the passes draw before the sprites (`renderOrder: -1`) and
share their uniforms, so a hook on the sprites mesh comes too late for them, and a hook on a pass
mesh would run once per `render()` call and make the order of the passes part of the logic.

## 4. `PlanarShadow` with a homogeneous light

The light of `PlanarShadow` is **`shadowLight`** (`vec4`), a homogeneous light `[x, y, z, w]`:
`w = 0` is a direction towards the light, `w = 1` the position of a point light. The name carries
`shadow`, since uniform names are shared by every feature of a kind and `light` alone would
collide sooner or later. The start value is `[-0.4, 1, -0.3, 0]`, a light that travels along
`[0.4, -1, 0.3]`; `groundPlane` starts at `[0, 1, 0, 0]`.

With the plane `(n, d)`, the placed vertex `p` and the light `(l, w)`:

```text
h_p  = dot(n, p) − d                         height of the vertex above the plane
h_L  = dot(n, l) − w · d                     height of the light (w = 1), or dot(n, l) (w = 0)
e    = w · max(h_p − (1 − k) · h_L, 0)        how far a vertex reaches above the clamp
p_c  = p − n · e / dot(n, n)                 the vertex, brought down by e along the normal
L    = l − w · p_c                           direction from the vertex towards the light
p'   = p_c − L · (h_p − e) / dot(n, L)
```

- For `w = 0`, `e = 0` and `dot(n, L) = h_L`: the plain projection along the light. It is defined
  while `h_L > 0`, which the `visible` hook of `ShadowPass` ensures.
- For `w = 1`, the vertex is projected from the light onto the plane. As a vertex approaches the
  height of the light, `dot(n, L)` goes to 0 and the shadow to infinity; above the light it would
  land on the wrong side. A vertex above `(1 − k) · h_L` therefore first comes down along the
  normal to that height, and is projected from there: `dot(n, L) ≥ k · h_L`, so the shadow grows
  very long but stays finite, on the far side of the light and **in the plane** — clamping the
  denominator instead would lift the vertex out of the plane. `k` is a constant of the feature,
  `1 / 20` (`MAX_POINT_SHADOW_STRETCH` in `PlanarShadow.ts`): measured across the normal, a vertex
  lands at most 19 times its offset from the light beyond it. The shadow is continuous where the
  clamp sets in.
- Every term scales with `|n|`, so the normal need not be a unit vector.
- A `groundPlane` whose normal is `(0, 0, 0)` is no plane: every vertex goes to the origin, and
  the pass draws nothing.
- The sign of `l` does not change `p'` for `w = 0`; it matters for §5, which is why the direction
  points towards the light.

`ShadowPass` draws `PlanarShadow` behind `LightFacingPlacement`, which turns every sprite to face
`shadowLight` before the projection and reads `shadowLight` and `groundPlane` without declaring
them; `SegmentShadowPass` projects the sprites as they lie.

## 5. A pass that skips its frame

Some light and plane make every shadow pointless: a directional light parallel to the plane, or
coming from below it, and a point light in the plane or below it. The uniforms alone decide that,
so `update()` leaves the pass out for the frame and saves its draw call.

```ts
interface SpritePass {
  // …
  /**
   * Whether the pass is drawn in this frame, judged by `FeatureSprites#update()` after the bindings
   * are written. `uniform(name)` answers the uniform the features of this pass read under `name` —
   * through `uniformNames`, so a renamed copy judges its own uniforms. Must allocate nothing.
   */
  readonly visible?: (uniform: (name: string) => SpriteUniformNode) => boolean;
}

class FeatureSpritesPass {
  /** The caller's switch; the pass is drawn while it is on and its `visible` hook agrees. */
  enabled: boolean; // true
}
```

- `update()` sets `mesh.visible = mesh.enabled && pass.visible(uniform)` for every pass with a hook;
  the lookup `uniform` is built once per pass mesh, not per frame. The `enabled` setter sets
  `mesh.visible = enabled && <the hook's last answer>`, which is `true` for a pass without a hook.
  So a caller who switches a pass off is not switched back on by the next `update()`. The docs tell
  the caller to use `enabled` rather than `visible` on a pass mesh.
- The lookup reaches every uniform of the sprites, not only those of the pass — the `time` of an
  animated kind resolves — and throws an `Error` from `update()` for a name that is no uniform of
  the sprites at all: `FeatureSprites: the visible of pass "…" reads the uniform "…", which no
  feature of these sprites declares`.
- `definePass()` refuses a `visible` that is no function (`definePass: the visible of pass "…" is
  no function`), and freezes the pass along with it.
- **`ShadowPass`** ships the hook `shadowFallsOnPlane` (`passPresets.ts`, exported), and
  `SegmentShadowPass`, a copy of it, carries it as well. With `groundPlane = (n, d)` and
  `shadowLight = (l, w)`, `h_L = dot(n, l) − w · d`:
  - `w = 0`: drawn while `h_L > ε · |n| · |l|`, i.e. the cosine between the normal and the
    direction towards the light is above `ε = 1e-3`. Parallel or from below: not drawn.
  - `w ≠ 0`: drawn while `h_L > 0`, i.e. the point light is above the plane. For a plane whose
    normal is `(0, 0, 0)` and whose `d` is below 0 that holds, and the shader draws nothing (§4).
- `ReflectionPass` and `BillboardReflectionPass` take no hook: a mirror image is always defined.

## 6. Several passes of one kind: renaming uniforms

### 6.1 Shadow and reflection together

`passes: [ShadowPass, ReflectionPass]` works without a renaming: their uniforms have distinct names
(`groundPlane`, `shadowLight`, `shadowColor` against `mirrorPlane`, `reflectionColor`), so each
binds to a node of its own —

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
`docs/sprites.md` states the order under "Shadow and reflection together", and its first example
of "Binding uniforms to the scene graph" sets it.

### 6.2 Two shadows: `uniformNames`

Uniform names are shared by the kind and every pass, so a second shadow needs uniforms of other
names. Without a renaming, that would take a feature of one's own with the shader code of
`PlanarShadow` copied. And a copy of the pass alone is a trap:
`definePass({...ShadowPass, name: 'moonShadow'})` is not refused — the declarations take the
uniform of one feature once, on purpose, since a feature may come along in the kind and again in
a pass — and both passes read the same uniforms and draw the same shadow twice.

A pass gets a renaming of the uniforms its features read:

```ts
interface SpritePass {
  // …
  /**
   * The uniforms of the features of this pass under other names: declared name → name in this
   * pass. A renamed copy of a pass — `definePass({...ShadowPass, name, uniformNames})` — reads
   * uniforms of its own; a copy without it shares the uniforms of the pass it copies.
   */
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
  `uniformNames[name] ?? name`, looked up as an own key. The features stay as they are; no shader
  code is copied. A placement of the pass that reads the uniforms of another feature of the pass
  without declaring them — `LightFacingPlacement` — reads through the renaming as well.
- **Declared.** A pass with `uniformNames` draws with renamed copies of its features
  (`stageFeaturesOf()` in `passUniformNames.ts`), built once per pass and cached: each copy
  declares its uniforms under the new names, with the start values of the feature, and hands its
  stages a shader context whose `uniform()` resolves through the renaming. The declarations take a
  uniform once per feature *of origin* and the name that feature declares it under before the
  renaming, so `PlanarShadow` in `ShadowPass` and its copy in `MoonShadowPass` declare
  `groundPlane` and `moonGround`, a feature in the kind and its unrenamed copy in a pass still
  declare a name once, and two renamed copies that give one target to two different uniforms of
  one feature are refused.
- **Checked.** `definePass()` refuses a key that no feature of the pass declares as a uniform
  (looked up as an own key, so `toString` is no such key), a target that is not a string, the empty
  string, a target that a feature of the pass declares under its own name — the identity
  `{a: 'a'}` is fine — and two keys with one target. A target that collides with a uniform of the
  kind or of another pass is refused by the declarations: "both declare the uniform".
- **Only the features of the pass** are renamed. The features of the kind a pass draws with read
  their uniforms under their own names in every pass — `time` stays one uniform.
- **Textures are not renamed.** Every pass reads the `colorMap` of the sprites; a texture of a
  pass's own under a second name waits for a pass that needs one.
- **The `visible` hook** reads through the renaming (§5), so the hook of `ShadowPass` judges
  `moonGround` and `moonLight` in `MoonShadowPass`.
- **The trap stays legal.** Two passes that share a feature and its uniforms on purpose — one
  `reflectionColor` for two reflections — are not wrong. `docs/sprites.md` names the trap next to
  `uniformNames` ("A copy shares").

Two lights throw two shadows, and where they overlap the ground darkens twice — which, for two
lights, is close to right.

## 7. Left out, documented

- **Sprites below the plane.** A shadow of a sprite on the far side of the plane should not
  exist; the projection draws one anyway. Only a vertex knows its side, and a sprite crossing the
  plane cannot be cut in the vertex shader. Documented.
- **A finite ground.** The plane is infinite; the ground mesh is not. A shadow beyond its edge
  hangs in the air. Clipping it to the mesh needs a stencil or a clip in the fragment stage in
  the local space of the ground — a proposal of its own.
- **Overlapping shadows darken twice** (`docs/sprites.md`, the limits of "Passes: shadows and
  reflections").
- **A light per sprite.** Uniforms hold for every sprite of a `FeatureSprites`, and a pass brings
  no data; sprites under different lights are sprites in different meshes.

## 8. Files

| File | What it holds |
| --- | --- |
| `src/sprites/bindings/SpriteUniformSource.ts` | the type `SpriteUniformSource` |
| `src/sprites/bindings/planeOf.ts`, `lightOf.ts` | the factories; all three exported from `src/sprites/public-api.ts` |
| `src/sprites/FeatureSprites/FeatureSprites.ts` | `bindUniform()`, `unbindUniform()`, the order of `update()`, `dispose()` dropping the bindings; `FeatureSpritesPass#enabled` and the judgement of the hook |
| `src/sprites/passes/definePass.ts` | `visible` and `uniformNames` on `SpritePass`, frozen with the pass |
| `src/sprites/passes/passFeatures.ts` | `checkPass()`: the checks of `visible` and `uniformNames` |
| `src/sprites/passes/passUniformNames.ts` | the renamed copies of the features of a pass, cached per pass; `resolvedUniformName()`, and the feature of origin and source name of each copy |
| `src/sprites/spriteDeclarations.ts` | the declarations per feature of origin and source name |
| `src/sprites/passes/PlanarShadow.ts` | `shadowLight`, the homogeneous projection with the clamp |
| `src/sprites/passes/passPresets.ts` | `shadowFallsOnPlane`, the hook of `ShadowPass` and `SegmentShadowPass` |

`docs/sprites.md` carries the bindings under "Binding uniforms to the scene graph" — `planeOf()`,
`lightOf()`, the rules of `bindUniform()`, the order of `update()`, a source of one's own and what
does not work (§7), each usage in a `ts check` block — and, under "Passes: shadows and
reflections", the table of the presets with `shadowLight`, the formula of §4, "Leaving a pass out
for a frame" (the hook and `enabled`), the rule of renamed uniforms, the trap of a copied pass,
`MoonShadowPass` and "Shadow and reflection together". The `CHANGELOG.md` of v0.23.0 lists the
bindings, the hook and `uniformNames` under Added.

The lookbook demo `animated-billboards` draws its `AnimatedSpriteKind` in the options form, with
its geometry handed in, `passes: [ShadowPass]`, `bindUniform('groundPlane', planeOf(plane))` and
`bindUniform('shadowLight', lightOf(sun))` for a `DirectionalLight` that circles the scene;
`sprite-reflection` is the demo of §10.

## 9. Tests

- **Vitest, sources** (`src/sprites/bindings/bindings.spec.ts`):
  - `planeOf()` of a node turned by `-π/2` around X and moved to `y = 2` writes the ground at
    `y = 2`; a node scaled unevenly along its own axes keeps its plane; a turned node inside a
    parent scaled unevenly carries the plane through the shear.
  - an explicit `options.plane` in the local space of the node, copied: a later change of it does
    not reach the source.
  - `planeOf(new Plane(new Vector3(0, 1, 0), -2))` writes `d = 2` — the sign of `constant`.
  - the plane in the local space of moved and turned sprites.
  - a node moved since its last world matrix is read at its new place.
  - `lightOf()` of a `DirectionalLight` writes `w = 0` and the direction from its target to it, of
    any other node `w = 1` and the position, each in the local space of the sprites.
- **Vitest, `FeatureSprites`** (`FeatureSprites.spec.ts`, "bindUniform()"): `update()` writes the
  bound uniform in the local space of the sprites, for the sprites and every pass; a parent moved
  without `updateMatrixWorld()` is read where it is; `setUniform()` on a bound name is overwritten
  by the next `update()`; a rebinding replaces the source, `unbindUniform()` keeps the last value; a
  renamed uniform of a copy of a pass binds under its new name; the three `TypeError`s of §3, with
  nothing bound afterwards, naming the type of a `float`, a `vec2` and a `vec3` uniform, and a
  `vec3` source of one's own bound; the bindings run before the hooks — a light bound below the
  ground hides the shadow in the same `update()`; `dispose()` drops the bindings, and binding
  afterwards does nothing.
- **Vitest, passes**: `definePass()` refuses a `visible` that is no function and keeps one that is
  (`definePass.spec.ts`); in `FeatureSprites.spec.ts`, "visible and enabled", `update()` shows a
  pass while its hook agrees, a pass switched off stays hidden and follows the hook once switched
  on, a pass without a hook follows `enabled` alone, the hook of a renamed copy judges the renamed
  uniforms, and the lookup throws from `update()` for a name that is no uniform of the sprites and
  resolves one of the kind. The hook of `ShadowPass` for a light above the plane, a direction or a
  point, for a direction parallel or from below and a point in or below the plane, and a point
  light let through for a plane whose normal is `(0, 0, 0)` (`pass-features.spec.ts`).
- **Vitest, `uniformNames`**: `definePass()` freezes a copy of the renaming and refuses an unknown
  key, a member of `Object.prototype`, an empty target, one that is no string, two keys with one
  target and a target a feature of the pass declares, allowing the identity (`definePass.spec.ts`);
  the copies are built once per pass, declare the renamed uniforms, read through the renaming in
  every stage — a placement reading an undeclared uniform included — and build no uv for a stage
  that does not read it; a prototype key is never renamed (`passUniformNames.spec.ts`); on one
  `FeatureSprites`, a renamed copy declares its uniforms next to those of the pass at the start
  values of the feature, its material reads the renamed uniforms and not the originals, a renamed
  uniform starts from the options under its new name, two renamed copies, a reflection and the
  `time` of an animated kind live side by side, two copies that rename two different uniforms of
  one feature to one name are refused, and a plain copy without `uniformNames` shares the uniforms
  (`FeatureSprites.spec.ts`, "uniformNames").
- **Vitest, `PlanarShadow`** through `evaluateNode` (`pass-features.spec.ts`): `w = 0` projects
  along the direction towards the light as a light travelling the other way would; `w = 1`
  projects from a point onto the plane; a vertex at or above a point light lands finite, in the
  plane and on the far side; a `groundPlane` whose normal is `(0, 0, 0)` sends every vertex to the
  origin.
- **Allocations**: `hot-path-allocations.spec.ts` measures `update()` of 1000 sprites with
  `ShadowPass`, a plane and a light binding — a `DirectionalLight`, then a point light — below a
  byte per call.
- **Browser** (`sprites-shadow-pass.test.js`, WebGPU and WebGL 2): a plane bound from a node moved
  along and turned about its normal, for sprites moved in the world — the shadow lies where the
  projection puts it; a point light bound through `lightOf()` spreads the shadow, and a light
  behind the plane draws none.

## 10. Lookbook demo: `sprite-reflection`

A demo of `ReflectionPass` and `planeOf()`: bouncing sprites seen head-on in the upper half of the
window, their mirror image in the lower half, darker — a waterline.

- **Scene.** The mirror is the world plane `y = 0`. The camera stands at `y = 0` and looks along
  −Z, so the horizon runs through the middle of the window and the mirror is seen edge-on.
- **Sprites.** The 2D `BouncingSprites` of `animated-sprites`
  (`~demos/animated-sprites/BouncingSprites`) in a `FeatureSpritesGeometry` of
  `AnimatedSpriteKind`, handed to a `FeatureSprites` in the options form with
  `passes: [ReflectionPass]`, without depth test and depth write. The container, `HEIGHT` high, is
  centred on 0, and a sprite is `SPRITE_SIZE` large, so the upper half holds
  `UPPER_HALF = HEIGHT + SPRITE_SIZE`; the sprites mesh moves to
  `position.y = HEIGHT / 2 + SPRITE_SIZE / 2`: a sprite at the bottom of the container touches the
  mirror with its lower edge and meets its image there.
- **Upper half.** The camera distance satisfies `tan(fov / 2) · dist = UPPER_HALF`, so the upper
  half of the window shows exactly the container with its sprites. On every resize
  `containerWidth = 2 · aspect · UPPER_HALF`, so the sprites fly to the edge of the window at any
  aspect.
- **The mirror** is bound, not computed: `waterline` is an `Object3D` at `y = 0` with
  `rotation.x = -π/2`, and `sprites.bindUniform('mirrorPlane', planeOf(waterline))`. Since the
  sprites mesh is moved, the plane lies at `y = -(HEIGHT + SPRITE_SIZE) / 2` in its local space —
  which `planeOf()` works out, and which is the offset a hand-written `setUniform()` gets wrong.
- **Look.** A background close to black (`rgb(4 4 8)`); `reflectionColor`
  `[0.35, 0.38, 0.45, 0.55]` — darker, a little cool, half transparent; a faint horizon line, a
  `Line` along X at `y = 0` in world space — a strip in the plane of `waterline` would be seen
  edge-on and vanish.
- **Interaction** as in `animated-sprites`: *more* and *less* create and free 20 sprites each. The
  orbit controls stay on — tilting the camera shows that the mirror image is geometry and stays
  right from any angle.
- **Lookbook duties.** `_sprite-reflection.json` with title, descriptions, url and the tags
  `FeatureSprites`, `FeatureSpritesGeometry`, `AnimatedSpriteKind`, `ReflectionPass`, `planeOf`,
  `FrameBasedAnimations`, `TextureStore` and `vanilla`, which `pnpm test:scripts` holds to the
  exports of the library; the preview image `public/images/demo-preview/sprite-reflection.webp`
  through `pnpm lookbook:generate-previews --only=sprite-reflection`, which `pnpm test:scripts`
  holds to the demo as well.
