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
direction or a point, and keeps a point light from stretching a shadow to infinity (§4).

## 2. Uniform sources

A source writes one uniform value per frame, in the local space of the sprites:

```ts
export interface SpriteUniformSource {
  /** The type of the uniform it writes; `bindUniform()` checks it against the uniform. */
  readonly type: 'vec3' | 'vec4';
  /**
   * Writes the value into `out` (`w` is ignored for a `vec3`). `worldToSprites` is the inverse of
   * `matrixWorld` of the sprites, current for this frame. Allocates nothing.
   */
  write(out: Vector4, worldToSprites: Matrix4): void;
}
```

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
- **A material handed in.** Bindings write through the material, so they work with a material
  handed in as well — for the uniforms that material holds.

### 3.1 The order of `update()`

1. Without bindings and without a pass that has a `visible` hook (§5), `update()` is what it is
   today: `super.update()`, the upload of the geometry.
2. With bindings: `this.updateWorldMatrix(true, false)`, then `worldToSprites.copy(this.matrixWorld).invert()`
   into a `Matrix4` of the instance. For every binding `source.write(scratch, worldToSprites)` and
   `material.setUniform(name, scratch.x, scratch.y, scratch.z, scratch.w)` — the uniforms are
   shared, so every pass reads the value.
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
L    = l − w · p              direction from the vertex towards the light
h_p  = dot(n, p) − d          height of the vertex above the plane
h_L  = dot(n, l) − w · d      height of the light above the plane (w = 1), or dot(n, l) (w = 0)
dot(n, L) = h_L − w · h_p

p'   = p − L · h_p / max(dot(n, L), k · h_L)
```

- For `w = 0`, `dot(n, L) = h_L`, and the `max` changes nothing while `h_L > 0` — which the
  `visible` hook of `ShadowPass` ensures. The result is the projection of today.
- For `w = 1`, the vertex is projected from the light onto the plane. As the vertex approaches the
  height of the light, `dot(n, L)` goes to 0 and the shadow to infinity; above the light it lands
  on the wrong side. The `max` with `k · h_L` caps the stretch at `h_p / (k · h_L)`: the shadow
  grows very long but stays finite and on the right side, and it is continuous where the clamp
  sets in. `k` is a constant of the feature, `0.05` — a stretch of at most 20 for a vertex at the
  height of the light.
- Every term scales with `|n|`, so the normal still need not be a unit vector.
- The sign of `L` does not change `p'`; it matters for the clamp and for §5 alone, which is why
  the direction points towards the light.

## 5. A pass that skips its frame

Some light and plane make every shadow pointless: a directional light parallel to the plane, or
coming from below it, and a point light in the plane or below it. The uniforms alone decide that,
so `update()` can leave the pass out for the frame and save its draw call.

```ts
interface SpritePass {
  // … as today
  /**
   * Whether the pass is drawn in this frame, judged by the uniforms of the sprites after the
   * bindings are written. Runs in every `update()`; allocates nothing.
   */
  readonly visible?: (uniforms: Readonly<Record<string, SpriteUniformNode>>) => boolean;
}

class FeatureSpritesPass {
  /** The caller's switch; the pass is drawn while it is on and its `visible` hook agrees. */
  enabled: boolean; // true
}
```

- `update()` sets `mesh.visible = mesh.enabled && pass.visible(uniforms)` for every pass with a
  hook. The `enabled` setter sets `mesh.visible = enabled && <the hook's last answer>`, which is
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

## 6. Left out, documented

- **Sprites below the plane.** A shadow of a sprite on the far side of the plane should not
  exist; the projection draws one anyway. Only a vertex knows its side, and a sprite crossing the
  plane cannot be cut in the vertex shader. Documented.
- **A finite ground.** The plane is infinite; the ground mesh is not. A shadow beyond its edge
  hangs in the air. Clipping it to the mesh needs a stencil or a clip in the fragment stage in
  the local space of the ground — a proposal of its own.
- **Overlapping shadows darken twice**, as today (`docs/sprites.md`, "The limits").
- **Several lights.** One uniform name has one value; a second light needs a feature with names
  of its own, as `MoonShadow` in `docs/sprites.md` shows. A binding works for those names alike.

## 7. Files

| File | Change |
| --- | --- |
| `src/sprites/bindings/SpriteUniformSource.ts` | the interface |
| `src/sprites/bindings/planeOf.ts`, `lightOf.ts` | the factories |
| `src/sprites/bindings/public-api.ts` | re-exported from `src/sprites/public-api.ts` |
| `src/sprites/FeatureSprites/FeatureSprites.ts` | `bindUniform()`, `unbindUniform()`, the order of `update()`, `dispose()` drops the bindings; `FeatureSpritesPass#enabled` |
| `src/sprites/passes/definePass.ts`, `passFeatures.ts` | the `visible` hook, checked and frozen |
| `src/sprites/passes/PlanarShadow.ts` | `shadowLight`, the homogeneous projection with the clamp |
| `src/sprites/passes/passPresets.ts` | the hook of `ShadowPass` |
| `docs/sprites.md` | a section "Binding uniforms to the scene graph" with a `ts check` block; the table of the presets and its formula move to `shadowLight`; `enabled` and the hook in the rules of the passes; §6 as limits |
| `CHANGELOG.md` | `[Unreleased]`: the bindings and the hook as additions; `lightDirection` → `shadowLight` amends the still unreleased entry of the pass features instead of a breaking change |
| `src/sprites/passes/pass-features.spec.ts`, `packages/twopoint5d-testing/test/sprites-shadow-pass.test.js` | move from `lightDirection` to `shadowLight`; the new cases of §8 |
| `docs/proposals/sprite-features.md` | unchanged — it is kept as it was written; its status block points here for `shadowLight` |
| `apps/lookbook/src/pages/demos/animated-billboards.astro` | options form instead of a material handed in (passes refuse one), `passes: [ShadowPass]`, `bindUniform('groundPlane', planeOf(plane))`, the light from `lightOf()` |

## 8. Tests

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
- **Vitest, `PlanarShadow`** through `evaluateNode`: `w = 0` gives the values of today's
  projection for the start value; `w = 1` the projection from a point; a vertex above a point
  light lands on the side of the shadow, at a finite place.
- **Allocations**: `hot-path-allocations.spec.ts` measures `update()` with a plane and a light
  binding and a pass with a hook — 0 bytes.
- **Browser** (`sprites-shadow-pass.test.js`, WebGPU and WebGL 2): a ground mesh moved and
  turned, bound through `planeOf()`, and a point light bound through `lightOf()` — the shadow lies
  where the projection puts it; a light below the ground draws no shadow.
