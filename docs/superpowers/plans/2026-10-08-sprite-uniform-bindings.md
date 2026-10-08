# Sprite Uniform Bindings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `FeatureSprites` take the planes and lights of its passes from nodes of the scene graph, once per frame, and add the passes' homogeneous light, per-frame visibility, uniform renaming and the lookbook demo `sprite-reflection`.

**Architecture:** Uniform sources (`planeOf()`, `lightOf()`) write straight into the vector of a uniform node, in the local space of the sprites; `FeatureSprites.update()` refreshes the world matrices, runs the sources, judges the `visible` hook of each pass and then uploads the geometry. A pass with `uniformNames` draws with renamed, cached copies of its features. `PlanarShadow` reads a homogeneous `shadowLight` (`w = 0` direction towards the light, `w = 1` point light) and clamps vertices near a point light so that the shadow stays finite and in the plane.

**Tech Stack:** TypeScript 7 (NodeNext, `.js` import suffixes), three.js `~0.186` with TSL (`three/tsl`, `three/webgpu`), `@spearwolf/signalize`, Vitest, web-test-runner + Playwright (WebGPU and WebGL 2), Astro lookbook.

**Spec:** `packages/twopoint5d/docs/proposals/sprite-uniform-bindings.md` — read it before the first task; section numbers below (§n) refer to it.

## Global Constraints

- Read `AGENTS.md` before the first edit. Code, comments and docs are written in English; commits follow Conventional Commits and end with the attribution lines of the session.
- `pnpm run ci` is the pre-commit gate: run it before every commit and commit only when it passes.
- Never run `pnpm publishNpmPkg` or `scripts/publishNpmPkg.mjs`.
- A new public symbol is published only through its module's `public-api.ts` (`packages/twopoint5d/src/sprites/public-api.ts`).
- Relative imports carry `.js`; types use `import type`.
- **Docs grow with the features:** every task that adds or changes a public symbol updates `packages/twopoint5d/docs/sprites.md` in the same commit — how to use it, and what does not work (§7). A block that stands on its own is marked `ts check` and must compile under `pnpm typecheck`.
- Every task that changes the public surface adds or amends its entry under `## [Unreleased]` in `packages/twopoint5d/CHANGELOG.md`; follow the `updating-changelog` skill. The passes are unreleased, so `lightDirection` → `shadowLight` amends the existing entry rather than adding a breaking change.
- Hot paths allocate nothing: `FeatureSprites.update()` with bindings and hooks, every `SpriteUniformSource.write()` and every `visible` hook. They hand no fractional number across a call they make — write into fields and vectors directly.
- Ownership follows `packages/twopoint5d/docs/resource-lifecycle.md`: nodes, `Plane`s and textures handed in stay the caller's.
- Rendering changes need both test surfaces: Vitest next to the source and a browser test in `packages/twopoint5d-testing/test/` (runs under WebGPU and WebGL 2).
- Constants: `shadowLight` start value `[-0.4, 1, -0.3, 0]`; clamp `k = 1 / 20` (`MAX_POINT_SHADOW_STRETCH = 20`); grazing cosine `ε = 1e-3`; demo `reflectionColor` `[0.35, 0.38, 0.45, 0.55]`, background `rgb(4 4 8)`.

## Review Focus

1. **A ground mesh with a non-uniform scale** (`scale.set(3, 1, 0.5)` on a turned plane) — the bound plane must still be exactly the plane the mesh lies in; pinned in Task 4 (`planeOf` with a scaled node).
2. **Sprites that were never added to a scene, or whose parent moved after the last render** — `update()` must read the current world matrices, not stale ones; pinned in Task 4 (moved parent of the sprites without `updateMatrixWorld()`).
3. **A pass switched off by the caller while its hook says yes** (`enabled = false`, then several `update()`s, then `enabled = true`) — must stay hidden until switched on, then follow the hook; pinned in Task 3.
4. **Two copies of `ShadowPass` with `uniformNames` next to `ReflectionPass` on `AnimatedSpriteKind`** — the copies must not collide with each other, with the kind (`time`) or with the reflection; pinned in Task 2.
5. **A point light exactly at the height of a sprite vertex** (`h_p = h_L`) — the shadow vertex must be finite and in the plane, not NaN; pinned in Task 1.

---

## File map

| File | Responsibility | Task |
| --- | --- | --- |
| `packages/twopoint5d/src/sprites/passes/PlanarShadow.ts` | homogeneous `shadowLight`, in-plane clamp | 1 |
| `packages/twopoint5d/src/testing/spriteGraph.ts` | `evaluateNode` learns `max` | 1 |
| `packages/twopoint5d/src/sprites/passes/passUniformNames.ts` (new) | renamed, cached copies of the features of a pass; the feature a copy came from | 2 |
| `packages/twopoint5d/src/sprites/spriteDeclarations.ts` | dedupe per feature of origin and name | 2 |
| `packages/twopoint5d/src/sprites/passes/definePass.ts`, `passFeatures.ts` | `uniformNames`, `visible` — typed, checked, frozen; the pass draws with the renamed copies | 2, 3 |
| `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts` | renamed copies in the shared resources; `FeatureSpritesPass#enabled`; `bindUniform()`, `unbindUniform()`, `update()` | 2, 3, 4 |
| `packages/twopoint5d/src/sprites/passes/passPresets.ts` | the hook of `ShadowPass` (`shadowFallsOnPlane`) | 3 |
| `packages/twopoint5d/src/sprites/bindings/SpriteUniformSource.ts`, `planeOf.ts`, `lightOf.ts` (new) | the sources | 4 |
| `packages/twopoint5d/src/sprites/public-api.ts` | exports | 3, 4 |
| `packages/twopoint5d/docs/sprites.md`, `packages/twopoint5d/CHANGELOG.md` | docs and changelog, every task | 1–4 |
| `packages/twopoint5d-testing/test/sprites-shadow-pass.test.js` | browser tests | 1, 5 |
| `apps/lookbook/src/pages/demos/animated-billboards.astro`, `_animated-billboards.json` | shadow on the ground through bindings | 6 |
| `apps/lookbook/src/pages/demos/sprite-reflection.astro`, `_sprite-reflection.json`, `apps/lookbook/src/data/tag-categories.json`, `apps/lookbook/public/images/demo-preview/*.webp` | the new demo | 6, 7 |
| `packages/twopoint5d/docs/proposals/sprite-uniform-bindings.md` | status block | 8 |

---

### Task 1: `PlanarShadow` with a homogeneous light

**Files:**
- Modify: `packages/twopoint5d/src/sprites/passes/PlanarShadow.ts`
- Modify: `packages/twopoint5d/src/testing/spriteGraph.ts` (the `isMathNode` switch in `evaluateNode`)
- Test: `packages/twopoint5d/src/sprites/passes/pass-features.spec.ts`
- Test: `packages/twopoint5d-testing/test/sprites-shadow-pass.test.js`
- Docs: `packages/twopoint5d/docs/sprites.md` (the passes section, ~lines 560–743), `packages/twopoint5d/CHANGELOG.md` (the pass features entry under `[Unreleased]` → `### Added`)

**Interfaces:**
- Consumes: nothing new.
- Produces: the uniform `shadowLight` (`vec4`, start `[-0.4, 1, -0.3, 0]`) replacing `lightDirection`; `groundPlane` unchanged. Later tasks read `shadowLight` and `groundPlane` by these names.

- [ ] **Step 1: Teach `evaluateNode` the `max` of two values**

In `packages/twopoint5d/src/testing/spriteGraph.ts`, inside `if (node.isMathNode) { … switch (node.method) {`, add a case next to `dot`, and extend the doc comment's list (`the arithmetic operators, swizzles, dot, length, normalize and max`):

```ts
      case 'max':
        return zip(a, evaluateNode(node.bNode!), Math.max);
```

- [ ] **Step 2: Write the failing feature tests**

In `pass-features.spec.ts`, change the declaration expectation and add the projection tests:

```ts
    expect(PlanarShadow.uniforms).toEqual({shadowLight: [-0.4, 1, -0.3, 0], groundPlane: [0, 1, 0, 0]});
```

```ts
  describe('PlanarShadow', () => {
    const shadow = (light: number[], plane: number[], p: [number, number, number]) => {
      const ctx = {
        ...stubShaderContext(),
        uniform: <T extends string>(name: string) =>
          (name === 'shadowLight' ? vec4(...(light as [number, number, number, number])) : vec4(...(plane as [number, number, number, number]))) as unknown as Node<T>,
      };
      return evaluateNode(PlanarShadow.mesh!.transform(vec3(...p) as unknown as Node<'vec3'>, ctx)) as number[];
    };
    const expectNear = (actual: number[], expected: number[]) =>
      expected.forEach((value, i) => expect(actual[i], `component ${i} of ${actual}`).toBeCloseTo(value, 5));

    test('projects along a direction towards the light (w = 0) as the light that travels the other way did', () => {
      // towards (-0.4, 1, -0.3): the light travels along (0.4, -1, 0.3); 2 units up land 0.8 and 0.6 off
      expectNear(shadow([-0.4, 1, -0.3, 0], [0, 1, 0, 0], [1, 2, 3]), [1.8, 0, 3.6]);
      // a normal of any length: 2y = 4 is the plane y = 2
      expectNear(shadow([-0.4, 1, -0.3, 0], [0, 2, 0, 4], [1, 4, 3]), [1.8, 2, 3.6]);
    });

    test('projects from a point light (w = 1) onto the plane', () => {
      // from (0, 10, 0) through (2, 5, 0) down to y = 0
      expectNear(shadow([0, 10, 0, 1], [0, 1, 0, 0], [2, 5, 0]), [4, 0, 0]);
    });

    test('keeps the shadow of a vertex at or above a point light finite, in the plane and on the far side', () => {
      // above the light: brought down to 0.95 of its height first, then projected — 19 times its offset away
      expectNear(shadow([0, 10, 0, 1], [0, 1, 0, 0], [1, 12, 0]), [20, 0, 0]);
      // exactly at the height of the light
      const atLight = shadow([0, 10, 0, 1], [0, 1, 0, 0], [1, 10, 0]);
      expect(atLight.every(Number.isFinite), `${atLight}`).toBe(true);
      expectNear(atLight, [20, 0, 0]);
    });
  });
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `pnpm nx test twopoint5d -- src/sprites/passes/pass-features.spec.ts`
Expected: FAIL — the uniforms still name `lightDirection`, and the projection tests read `shadowLight`, which the stage does not ask for.

- [ ] **Step 4: Implement the homogeneous projection**

Replace `PlanarShadow.ts`:

```ts
import {div, dot, max, mul, sub} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {defineFeature, MeshOrder} from '../SpriteFeature.js';

// a vertex near or above a point light comes down to this share of the height of the light before
// it is projected, so that its shadow lands at most 19 times its distance to the light away
const MAX_POINT_SHADOW_STRETCH = 20;
const CLAMPED_SHARE = 1 - 1 / MAX_POINT_SHADOW_STRETCH;

/**
 * Projects the placed vertex from the light `shadowLight` onto the plane `dot(n, p) = d` of
 * `groundPlane` (`[n.x, n.y, n.z, d]`), both in the local space of the mesh. `shadowLight` is
 * homogeneous: `[x, y, z, 0]` is a direction towards the light, `[x, y, z, 1]` the position of a
 * point light. Works on the placed vertex, so the shadow of a billboard is the shadow of the
 * billboard the camera sees. A vertex near or above a point light is brought down along the
 * normal first; its shadow grows long but stays finite and in the plane.
 */
export const PlanarShadow = defineFeature({
  name: 'planarShadow',
  uniforms: {shadowLight: [-0.4, 1, -0.3, 0], groundPlane: [0, 1, 0, 0]},
  mesh: {
    order: MeshOrder.Project,
    transform: (p, {uniform}) => {
      const light = uniform<'vec4'>('shadowLight');
      const plane = uniform<'vec4'>('groundPlane');
      const n = plane.xyz;
      const height = sub(dot(n, p), plane.w);
      const lightHeight = sub(dot(n, light.xyz), mul(light.w, plane.w));
      // 0 for a direction (w = 0): only a point light clamps
      const excess = mul(light.w, max(sub(height, mul(lightHeight, CLAMPED_SHARE)), 0));
      const clamped = sub(p, mul(n, div(excess, dot(n, n))));
      const towardsLight = sub(light.xyz, mul(light.w, clamped));
      return sub(clamped, mul(towardsLight, div(sub(height, excess), dot(n, towardsLight)))) as unknown as Node<'vec3'>;
    },
  },
});
```

- [ ] **Step 5: Run the feature tests to see them pass**

Run: `pnpm nx test twopoint5d -- src/sprites/passes/pass-features.spec.ts`
Expected: PASS.

- [ ] **Step 6: Move the browser test to `shadowLight`**

In `packages/twopoint5d-testing/test/sprites-shadow-pass.test.js`:
- `aimTheShadow()`: `sprites.setUniform('shadowLight', -0.5, 0, 1, 0);` instead of `lightDirection` `(0.5, 0, -1)` — the same light, now pointing towards it.
- the constant `LIGHT` stays `[0.4, -1, 0.3]` with its comment changed to `// the direction the light of the start value of shadowLight travels in: -[-0.4, 1, -0.3]`.

Run: `pnpm build:twopoint5d && pnpm --dir packages/twopoint5d-testing exec web-test-runner --files test/sprites-shadow-pass.test.js`
Expected: PASS under both backends (the pixels are those of before).

- [ ] **Step 7: Docs and changelog**

In `packages/twopoint5d/docs/sprites.md`:
- the table of the two presets: `ShadowPass` row → uniforms `shadowLight` (`[-0.4, 1, -0.3, 0]`), `groundPlane` (`[0, 1, 0, 0]`), `shadowColor` (`[0, 0, 0, 0.5]`); "what it draws" → `the sprite projected from shadowLight onto groundPlane — along a direction towards the light (w = 0) or from a point light (w = 1) — in shadowColor, its alpha multiplied by the alpha of the sprite`.
- after the table, a paragraph **The light of the shadow.** with the formula of spec §4 as a `text` block and these facts: `w = 0` is a direction *towards* the light; `w = 1` a point light whose shadows spread; a vertex near or above a point light is brought down to `0.95` of its height first, so the shadow stays finite and in the plane; the normal need not be a unit vector.
- the `ts check` example of "Passes: shadows and reflections": `sprites.setUniform('shadowLight', -0.5, 1, -0.3, 0);` with the comment `// the light comes from above, a little from the right; it points towards the light`.
- the `MoonShadow` example stays for now (Task 2 replaces it).
- "The limits", bullet "One uniform name, one value": `lightDirection` → `shadowLight`.
- the "Both sides" paragraph: "the start value of `lightDirection` is one" → "the start value of `shadowLight` is one".

In `CHANGELOG.md`, amend the pass features entry: `PlanarShadow` (projects the placed vertex from the homogeneous light `shadowLight` — a direction towards the light, or a point light whose shadow is clamped to stay finite and in the plane — onto `groundPlane`).

Run: `pnpm typecheck`
Expected: PASS (the `ts check` blocks compile).

- [ ] **Step 8: Gate and commit**

Run: `pnpm run ci`
Expected: PASS.

```bash
git add packages/twopoint5d/src/sprites/passes/PlanarShadow.ts packages/twopoint5d/src/testing/spriteGraph.ts packages/twopoint5d/src/sprites/passes/pass-features.spec.ts packages/twopoint5d-testing/test/sprites-shadow-pass.test.js packages/twopoint5d/docs/sprites.md packages/twopoint5d/CHANGELOG.md
git commit -m "feat(sprites)!: light the planar shadow from a homogeneous shadowLight, a direction or a point"
```

---

### Task 2: `uniformNames` — renaming the uniforms of a pass

**Files:**
- Create: `packages/twopoint5d/src/sprites/passes/passUniformNames.ts`
- Modify: `packages/twopoint5d/src/sprites/passes/definePass.ts`
- Modify: `packages/twopoint5d/src/sprites/passes/passFeatures.ts`
- Modify: `packages/twopoint5d/src/sprites/spriteDeclarations.ts`
- Modify: `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts` (`resolveParts`)
- Test: `packages/twopoint5d/src/sprites/passes/definePass.spec.ts`, `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.spec.ts`
- Docs: `packages/twopoint5d/docs/sprites.md`, `packages/twopoint5d/CHANGELOG.md`

**Interfaces:**
- Consumes: `SpritePass`, `SpriteFeature`, `collectSpriteDeclarations`.
- Produces:
  - `SpritePass.uniformNames?: Readonly<Record<string, string>>` (public).
  - `stageFeaturesOf(pass: SpritePass): readonly SpriteFeature[]` — `@internal`, in `passUniformNames.ts`: the features of the pass, renamed copies when `uniformNames` is set, the same array object for one pass on every call.
  - `originOf(feature: SpriteFeature): SpriteFeature` — `@internal`: the feature a renamed copy came from, the feature itself otherwise.
  - `resolvedUniformName(pass: SpritePass, name: string): string` — `@internal`: `pass.uniformNames?.[name] ?? name`. Task 3 uses it for the hook lookup.

- [ ] **Step 1: Write the failing `definePass` tests**

Add to `definePass.spec.ts` (imports: `PlanarShadow`, `ShadowMask` from `./PlanarShadow.js`/`./ShadowMask.js`, `ShadowPass` from `./passPresets.js`):

```ts
  describe('uniformNames', () => {
    test('freezes a copy of the renaming', () => {
      const names = {groundPlane: 'moonGround'};
      const pass = definePass({...ShadowPass, name: 'moon', uniformNames: names});

      expect(pass.uniformNames).toEqual({groundPlane: 'moonGround'});
      expect(pass.uniformNames).not.toBe(names);
      expect(Object.isFrozen(pass.uniformNames)).toBe(true);
    });

    test('refuses a name no feature of the pass declares, an empty target and two names with one target', () => {
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {time: 'moonTime'}})).toThrow(
        'definePass: pass "moon" renames the uniform "time", which no feature of the pass declares',
      );
      expect(() => definePass({...ShadowPass, name: 'moon', uniformNames: {groundPlane: ''}})).toThrow(
        'definePass: pass "moon" renames the uniform "groundPlane" to an empty name',
      );
      expect(() =>
        definePass({...ShadowPass, name: 'moon', uniformNames: {groundPlane: 'moon', shadowLight: 'moon'}}),
      ).toThrow('definePass: pass "moon" renames the uniforms "groundPlane" and "shadowLight" both to "moon"');
    });
  });
```

- [ ] **Step 2: Write the failing `FeatureSprites` tests**

Add to the `describe('passes', …)` block of `FeatureSprites.spec.ts` (imports: `nodesOf` from `../../testing/spriteGraph.js`; `ReflectionPass`, `ShadowPass` are imported already):

```ts
    describe('uniformNames', () => {
      const moonShadow = definePass({
        ...ShadowPass,
        name: 'moonShadow',
        uniformNames: {groundPlane: 'moonGround', shadowLight: 'moonLight', shadowColor: 'moonShadowColor'},
      });

      test('declares the uniforms of a renamed copy next to those of the pass, at the start values of the feature', () => {
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, moonShadow]});
        const value = (name: string) => (sprites.uniforms![name]!.value as Vector4).toArray();

        expect(value('moonLight')).toEqual([-0.4, 1, -0.3, 0]);
        expect(value('moonGround')).toEqual([0, 1, 0, 0]);
        sprites.setUniform('moonLight', 0, 10, 0, 1);
        expect(value('shadowLight')).toEqual([-0.4, 1, -0.3, 0]);
        sprites.dispose();
      });

      test('builds the material of the copy from the renamed uniforms, not the originals', () => {
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, moonShadow]});
        const nodes = nodesOf(sprites.passes['moonShadow']!.material.positionNode!);
        const {uniforms} = sprites;

        expect(nodes.has(uniforms!['moonGround']!)).toBe(true);
        expect(nodes.has(uniforms!['moonLight']!)).toBe(true);
        expect(nodes.has(uniforms!['groundPlane']!)).toBe(false);
        expect(nodesOf(sprites.passes['shadow']!.material.positionNode!).has(uniforms!['groundPlane']!)).toBe(true);
        sprites.dispose();
      });

      test('starts a renamed uniform from the options under its new name', () => {
        const sprites = new FeatureSprites(kind, {passes: [moonShadow], uniforms: {moonShadowColor: [0, 0, 1, 0.3]}});

        expect((sprites.uniforms!['moonShadowColor']!.value as Vector4).toArray()).toEqual([0, 0, 1, 0.3]);
        sprites.dispose();
      });

      test('two renamed copies, the reflection and the time of an animated kind live side by side', () => {
        const sunset = definePass({...ShadowPass, name: 'sunset', uniformNames: {shadowLight: 'sunsetLight', groundPlane: 'sunsetGround', shadowColor: 'sunsetColor'}});
        const sprites = new FeatureSprites(AnimatedSpriteKind, {passes: [ShadowPass, moonShadow, sunset, ReflectionPass]});

        expect(Object.keys(sprites.passes)).toEqual(['shadow', 'moonShadow', 'sunset', 'reflection']);
        expect(sprites.uniforms!['time']).toBeDefined();
        expect(sprites.uniforms!['sunsetLight']).not.toBe(sprites.uniforms!['moonLight']);
        sprites.dispose();
      });

      test('refuses a target that collides with a uniform of the kind', () => {
        const clash = definePass({...ShadowPass, name: 'clash', uniformNames: {shadowLight: 'time'}});

        expect(() => new FeatureSprites(AnimatedSpriteKind, {passes: [clash]})).toThrow(/both declare the uniform "time"/);
      });

      test('a plain copy without uniformNames shares the uniforms of the pass it copies', () => {
        const twin = definePass({...ShadowPass, name: 'twin'});
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, twin]});
        const {uniforms} = sprites;

        expect(nodesOf(sprites.passes['twin']!.material.positionNode!).has(uniforms!['groundPlane']!)).toBe(true);
        sprites.dispose();
      });
    });
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm nx test twopoint5d -- src/sprites/passes/definePass.spec.ts src/sprites/FeatureSprites/FeatureSprites.spec.ts`
Expected: FAIL — `uniformNames` is unknown to the type (type error) and ignored at run time.

- [ ] **Step 4: Type and check `uniformNames`**

In `definePass.ts`, add to `SpritePass` after `renderOrder`:

```ts
  /**
   * The uniforms of the features of this pass under other names: declared name → name in this
   * pass. A renamed copy of a pass — `definePass({...ShadowPass, name, uniformNames})` — reads
   * uniforms of its own; a copy without it shares the uniforms of the pass it copies.
   */
  readonly uniformNames?: Readonly<Record<string, string>>;
```

and freeze a copy in `definePass()`:

```ts
  const {without, material, uniformNames} = pass;
  return Object.freeze({
    ...pass,
    features: Object.freeze([...pass.features]),
    ...(without != null && {without: Object.freeze([...without])}),
    ...(material != null && {material: Object.freeze({...material})}),
    ...(uniformNames != null && {uniformNames: Object.freeze({...uniformNames})}),
  });
```

In `passFeatures.ts`, at the end of `checkPass()`:

```ts
  const targets = new Map<string, string>();
  for (const [name, target] of Object.entries(pass.uniformNames ?? {})) {
    if (!pass.features.some((feature) => feature.uniforms?.[name] != null)) {
      throw new TypeError(`${where}: pass "${pass.name}" renames the uniform "${name}", which no feature of the pass declares`);
    }
    if (typeof target !== 'string' || target === '') {
      throw new TypeError(`${where}: pass "${pass.name}" renames the uniform "${name}" to an empty name`);
    }
    const first = targets.get(target);
    if (first != null) {
      throw new TypeError(`${where}: pass "${pass.name}" renames the uniforms "${first}" and "${name}" both to "${target}"`);
    }
    targets.set(target, name);
  }
```

Run: `pnpm nx test twopoint5d -- src/sprites/passes/definePass.spec.ts`
Expected: PASS.

- [ ] **Step 5: The renamed copies**

Create `packages/twopoint5d/src/sprites/passes/passUniformNames.ts`:

```ts
import type {SpriteFeature, SpriteFrameContext} from '../SpriteFeature.js';
import type {SpritePass} from './definePass.js';

// one array of copies per pass, so that every material and the shared resources of one pass see
// the same feature objects; and the feature each copy came from, for the declarations
const copiesOfPass = new WeakMap<SpritePass, readonly SpriteFeature[]>();
const originOfCopy = new WeakMap<SpriteFeature, SpriteFeature>();

/** The name the features of `pass` read the uniform `name` under. @internal */
export const resolvedUniformName = (pass: SpritePass, name: string): string => pass.uniformNames?.[name] ?? name;

/** The feature a renamed copy came from; the feature itself for any other. @internal */
export const originOf = (feature: SpriteFeature): SpriteFeature => originOfCopy.get(feature) ?? feature;

function renamedCopy(feature: SpriteFeature, names: Readonly<Record<string, string>>): SpriteFeature {
  const rename = <C extends SpriteFrameContext>(ctx: C): C => ({...ctx, uniform: (name: string) => ctx.uniform(names[name] ?? name)});
  const {frame, local, mesh, color, colorSource, uniforms} = feature;
  const copy: SpriteFeature = Object.freeze({
    ...feature,
    ...(uniforms != null && {
      uniforms: Object.freeze(Object.fromEntries(Object.entries(uniforms).map(([name, value]) => [names[name] ?? name, value]))),
    }),
    ...(frame != null && {frame: (ctx: SpriteFrameContext) => frame(rename(ctx))}),
    ...(local != null && {local: {order: local.order, transform: (input, ctx) => local.transform(input, rename(ctx))}}),
    ...(mesh != null && {mesh: {order: mesh.order, transform: (input, ctx) => mesh.transform(input, rename(ctx))}}),
    ...(color != null && {color: {order: color.order, transform: (input, ctx) => color.transform(input, rename(ctx))}}),
    ...(colorSource != null && {colorSource: (frame, ctx) => colorSource(frame, rename(ctx))}),
  } as SpriteFeature);
  originOfCopy.set(copy, feature);
  return copy;
}

/**
 * The features `pass` draws with: its own, or — with `uniformNames` — copies of them that declare
 * and read the renamed uniforms. The copies are built once per pass. @internal
 */
export function stageFeaturesOf(pass: SpritePass): readonly SpriteFeature[] {
  const names = pass.uniformNames;
  if (names == null || Object.keys(names).length === 0) return pass.features;
  let copies = copiesOfPass.get(pass);
  if (copies == null) {
    copies = Object.freeze(pass.features.map((feature) => renamedCopy(feature, names)));
    copiesOfPass.set(pass, copies);
  }
  return copies;
}
```

(The `as SpriteFeature` is needed because the spread of conditional objects widens the stage types; keep it to that one cast.)

- [ ] **Step 6: Draw with the copies and declare per origin**

`passFeatures.ts`, last line of `passFeatures()`:

```ts
  return Object.freeze([...kind.features.filter(({name}) => !without.has(name)), ...stageFeaturesOf(pass)]);
```

`FeatureSprites.ts`, in `resolveParts()`:

```ts
        [...kind.features, ...passes.flatMap((pass) => stageFeaturesOf(pass))],
```

`spriteDeclarations.ts`: the declarations dedupe per feature of origin and name instead of per feature object. Replace the loop body's two "known" checks:

```ts
  for (const feature of new Set(features)) {
    const origin = originOf(feature);
    for (const [name, value] of Object.entries(feature.uniforms ?? {})) {
      const known = uniforms.get(name);
      // the same feature — or a copy of it — under the same name declares it once
      if (known != null && originOf(known.feature) === origin) continue;
      if (known != null) {
        throw new Error(`${where}: features "${known.feature.name}" and "${feature.name}" both declare the uniform "${name}"`);
      }
      …
    }
    for (const [name, declaration] of Object.entries(feature.textures ?? {})) {
      const known = textures.get(name);
      if (known != null && originOf(known.feature) === origin) continue;
      …
    }
  }
```

and update its doc comment: `One feature that comes along more than once — in a kind and again in a pass, or as the renamed copy of a pass — declares each name once; two features that declare the same name are refused, naming both.`

Run: `pnpm nx test twopoint5d -- src/sprites`
Expected: PASS, all sprite specs.

- [ ] **Step 7: Docs and changelog**

`docs/sprites.md`, passes section:
- in "The rules", after "Shared uniforms and textures": a bullet **Renamed uniforms.** — `uniformNames` maps names the features of the pass declare to names of the pass; the copy reads and declares those; only the features of the pass are renamed, never those of the kind (`time` stays one); textures are not renamed; `definePass()` refuses an undeclared name, an empty target and two names with one target, and a target that collides is refused as "both declare the uniform".
- right after it, a bullet **A copy shares.** — `definePass({...ShadowPass, name: 'twin'})` without `uniformNames` reads the uniforms of `ShadowPass` and draws the same shadow a second time; this is not refused, since two passes may share a uniform on purpose.
- replace the `MoonShadow` `ts check` block and its lead-in with a renamed `ShadowPass` (it must compile on its own):

````md
A second light throws a second shadow through a renamed copy of `ShadowPass`: the same features,
uniforms of other names.

```ts check
import {definePass, FeatureSprites, ShadowPass, TexturedSpriteKind} from '@spearwolf/twopoint5d';

export const MoonShadowPass = definePass({
  ...ShadowPass,
  name: 'moonShadow',
  uniformNames: {shadowLight: 'moonLight', groundPlane: 'moonGround', shadowColor: 'moonShadowColor'},
});

const sprites = new FeatureSprites(TexturedSpriteKind, {
  capacity: 100,
  passes: [ShadowPass, MoonShadowPass],
  uniforms: {moonShadowColor: [0, 0, 0.1, 0.3]},
});
// a point light: its shadows spread
sprites.setUniform('moonLight', -30, 80, 20, 1);
sprites.dispose();
```

A pass of one's own is a `definePass()` over features of one's own, written as `PlanarShadow`
and `ShadowMask` are — see "Writing a feature".
````

- under "The scene around them", a bullet **Shadow and reflection together.** — the order reflection < ground < shadow < sprites (spec §6.1), set through `sprites.passes['shadow']!.renderOrder` or `definePass({...ShadowPass, renderOrder})`, with the reason for each side.
- "The limits", bullet "One uniform name, one value": rewrite to point at `uniformNames`; add "A light per sprite" from spec §7.

`CHANGELOG.md` `### Added`: `- add SpritePass#uniformNames: a pass reads and declares the uniforms of its features under other names, so that a renamed copy of ShadowPass throws a second shadow from a second light; …` (describe the checks and that a copy without it shares).

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Gate and commit**

Run: `pnpm run ci`
Expected: PASS.

```bash
git add packages/twopoint5d/src/sprites packages/twopoint5d/docs/sprites.md packages/twopoint5d/CHANGELOG.md
git commit -m "feat(sprites): rename the uniforms of a pass with uniformNames"
```

---

### Task 3: The `visible` hook and `FeatureSpritesPass#enabled`

**Files:**
- Modify: `packages/twopoint5d/src/sprites/passes/definePass.ts`, `passFeatures.ts` (`checkPass`)
- Modify: `packages/twopoint5d/src/sprites/passes/passPresets.ts`
- Modify: `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts`
- Test: `packages/twopoint5d/src/sprites/passes/definePass.spec.ts`, `pass-features.spec.ts`, `FeatureSprites/FeatureSprites.spec.ts`, `src/sprites/hot-path-allocations.spec.ts`
- Docs: `docs/sprites.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `resolvedUniformName(pass, name)` from Task 2; `SpriteUniformNode` from `FeatureSprites/SpriteResources.ts`.
- Produces:
  - `SpritePass.visible?: (uniform: (name: string) => SpriteUniformNode) => boolean` (public).
  - `shadowFallsOnPlane(uniform: (name: string) => SpriteUniformNode): boolean` (public, `passPresets.ts`) — the hook of `ShadowPass`.
  - `FeatureSpritesPass#enabled: boolean` (public), `FeatureSpritesPass#judgeVisibility(): void` (`@internal`, called by `FeatureSprites.update()`).
  - `FeatureSprites.update()` override — Task 4 inserts the bindings in front of the hook loop.

- [ ] **Step 1: Write the failing tests**

`definePass.spec.ts`:

```ts
  test('refuses a visible that is no function, and keeps one that is', () => {
    const visible = () => true;

    expect(definePass({name: 'p', features: [], visible}).visible).toBe(visible);
    expect(() => definePass({name: 'p', features: [], visible: true as never})).toThrow(
      'definePass: the visible of pass "p" is no function',
    );
  });
```

`pass-features.spec.ts` (imports `Vector4` from `three/webgpu`, `uniform` from `three/tsl`, `shadowFallsOnPlane` from `./passPresets.js`):

```ts
  describe('the hook of ShadowPass', () => {
    const judge = (light: [number, number, number, number], plane: [number, number, number, number] = [0, 1, 0, 0]) => {
      const nodes: Record<string, unknown> = {shadowLight: uniform(new Vector4(...light)), groundPlane: uniform(new Vector4(...plane))};
      return shadowFallsOnPlane((name) => nodes[name] as never);
    };

    test('draws a shadow for a light above the plane, a direction or a point', () => {
      expect(judge([-0.4, 1, -0.3, 0])).toBe(true);
      expect(judge([0, 10, 0, 1])).toBe(true);
      expect(judge([0, 5, 0, 1], [0, 2, 0, 4])).toBe(true); // 5 above y = 2
    });

    test('leaves it out for a direction parallel to the plane or from below, and a point in or below it', () => {
      expect(judge([1, 0, 0, 0])).toBe(false);
      expect(judge([1, 0.0005, 0, 0])).toBe(false); // grazing: below the cosine 1e-3
      expect(judge([0.4, -1, 0.3, 0])).toBe(false);
      expect(judge([3, 0, 0, 1])).toBe(false);
      expect(judge([0, -1, 0, 1])).toBe(false);
      expect(judge([0, 1, 0, 1], [0, 2, 0, 4])).toBe(false); // y = 1 lies below y = 2
    });
  });
```

and extend the presets test: `expect(ShadowPass.visible).toBe(shadowFallsOnPlane); expect(ReflectionPass.visible).toBeUndefined();`.

`FeatureSprites.spec.ts`, inside `describe('passes', …)`:

```ts
    describe('visible and enabled', () => {
      test('update() shows a pass while its hook agrees and hides it otherwise', () => {
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, ReflectionPass]});
        const shadowMesh = sprites.passes['shadow']!;

        sprites.update();
        expect(shadowMesh.visible).toBe(true);
        sprites.setUniform('shadowLight', 0.4, -1, 0.3, 0); // from below
        sprites.update();
        expect(shadowMesh.visible).toBe(false);
        expect(sprites.passes['reflection']!.visible).toBe(true);
        sprites.dispose();
      });

      test('a pass switched off stays hidden through update() while the hook agrees, and follows it once switched on', () => {
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
        const shadowMesh = sprites.passes['shadow']!;

        shadowMesh.enabled = false;
        sprites.update();
        sprites.update();
        expect(shadowMesh.visible).toBe(false);
        shadowMesh.enabled = true;
        expect(shadowMesh.visible).toBe(true);
        sprites.setUniform('shadowLight', 0.4, -1, 0.3, 0);
        sprites.update();
        shadowMesh.enabled = true;
        expect(shadowMesh.visible).toBe(false);
        sprites.dispose();
      });

      test('the hook of a renamed copy judges the renamed uniforms', () => {
        const moon = definePass({...ShadowPass, name: 'moon', uniformNames: {shadowLight: 'moonLight', groundPlane: 'moonGround', shadowColor: 'moonColor'}});
        const sprites = new FeatureSprites(kind, {passes: [ShadowPass, moon]});

        sprites.setUniform('moonLight', 0, -1, 0, 1);
        sprites.update();
        expect([sprites.passes['shadow']!.visible, sprites.passes['moon']!.visible]).toEqual([true, false]);
        sprites.dispose();
      });

      test('a pass without a hook follows enabled alone', () => {
        const sprites = new FeatureSprites(kind, {passes: [ReflectionPass]});
        const mesh = sprites.passes['reflection']!;

        mesh.enabled = false;
        sprites.update();
        expect(mesh.visible).toBe(false);
        mesh.enabled = true;
        expect(mesh.visible).toBe(true);
        sprites.dispose();
      });
    });
```

`hot-path-allocations.spec.ts`, a new test (imports `ShadowPass`, `ReflectionPass` from `./passes/passPresets.js`):

```ts
  test('update() of sprites with a shadow and a reflection pass allocates nothing per call', async () => {
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1000, passes: [ShadowPass, ReflectionPass]});
    for (let i = 0; i < 1000; i++) sprites.createSprite();
    sprites.update();

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) sprites.update();
    });

    expect(bytesPerRound / 1000).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm nx test twopoint5d -- src/sprites/passes src/sprites/FeatureSprites/FeatureSprites.spec.ts`
Expected: FAIL — `visible`, `enabled` and `shadowFallsOnPlane` do not exist.

- [ ] **Step 3: Type and check the hook**

`definePass.ts`, in `SpritePass` (import `type SpriteUniformNode` from `../FeatureSprites/SpriteResources.js`):

```ts
  /**
   * Whether the pass is drawn in this frame, judged by `FeatureSprites#update()` after the bindings
   * are written. `uniform(name)` answers the uniform the features of this pass read under `name` —
   * through `uniformNames`, so a renamed copy judges its own uniforms. Must allocate nothing.
   */
  readonly visible?: (uniform: (name: string) => SpriteUniformNode) => boolean;
```

`checkPass()` (first lines after the name check):

```ts
  if (pass.visible != null && typeof pass.visible !== 'function') {
    throw new TypeError(`${where}: the visible of pass "${pass.name}" is no function`);
  }
```

- [ ] **Step 4: The hook of `ShadowPass`**

`passPresets.ts`:

```ts
import {DoubleSide, type Vector4} from 'three/webgpu';
import type {SpriteUniformNode} from '../FeatureSprites/SpriteResources.js';
…
// below this cosine between the normal and the direction towards the light, a directional light
// grazes the plane and its shadow runs off to infinity
const GRAZING_COSINE = 1e-3;

/**
 * The hook of {@link ShadowPass}: whether `shadowLight` lights the side of `groundPlane` its normal
 * points to — the side the sprites stand on. A direction (`w = 0`) has to meet the normal at a
 * cosine above 0.001; a point light (`w = 1`) has to lie above the plane.
 */
export function shadowFallsOnPlane(uniform: (name: string) => SpriteUniformNode): boolean {
  const plane = uniform('groundPlane').value as Vector4;
  const light = uniform('shadowLight').value as Vector4;
  const lightHeight = plane.x * light.x + plane.y * light.y + plane.z * light.z - light.w * plane.w;
  if (light.w !== 0) return lightHeight > 0;
  const normalLength = Math.sqrt(plane.x * plane.x + plane.y * plane.y + plane.z * plane.z);
  const lightLength = Math.sqrt(light.x * light.x + light.y * light.y + light.z * light.z);
  return lightHeight > GRAZING_COSINE * normalLength * lightLength;
}
```

and `visible: shadowFallsOnPlane,` in `ShadowPass`. Extend its doc comment: `It is left out for a frame whose light does not fall onto the side of the plane its normal points to.`

- [ ] **Step 5: `enabled`, `judgeVisibility()` and `update()`**

`FeatureSprites.ts` — `FeatureSpritesPass` (import `type SpriteUniformNode` is there already; import `resolvedUniformName` from `../passes/passUniformNames.js`):

```ts
export class FeatureSpritesPass<Api extends object = object> extends Mesh {
  declare material: FeatureSpritesMaterial<Api>;
  readonly pass: SpritePass;

  #enabled = true;
  #hookAgrees = true;
  // built once: the hook runs every frame and must not allocate
  readonly #uniform: (name: string) => SpriteUniformNode;

  constructor(geometry: FeatureSpritesGeometry<Api>, material: FeatureSpritesMaterial<Api>, pass: SpritePass) {
    super(geometry, material);
    this.pass = pass;
    this.name = `twopoint5d.FeatureSprites.${pass.name}`;
    this.frustumCulled = false;
    this.renderOrder = pass.renderOrder ?? 0;
    const where = `FeatureSprites: the visible of pass "${pass.name}"`;
    this.#uniform = (name) => material.resources.uniform(resolvedUniformName(pass, name), where);
  }

  /**
   * The caller's switch: the pass is drawn while it is on and its `visible` hook agrees. Use it
   * instead of `visible`, which `FeatureSprites#update()` writes for a pass with a hook.
   */
  get enabled(): boolean {
    return this.#enabled;
  }

  set enabled(enabled: boolean) {
    this.#enabled = enabled;
    this.visible = enabled && this.#hookAgrees;
  }

  /** Asks the `visible` hook of the pass for this frame. @internal */
  judgeVisibility(): void {
    const hook = this.pass.visible;
    if (hook == null) return;
    this.#hookAgrees = hook(this.#uniform);
    this.visible = this.#enabled && this.#hookAgrees;
  }
}
```

`FeatureSprites`: a field `#judgedPasses: readonly FeatureSpritesPass<Api>[] = [];`, set in the constructor right after `Object.freeze(passes);`:

```ts
      this.#judgedPasses = Object.values(passes).filter((mesh) => mesh.pass.visible != null);
```

cleared in `dispose()` next to `#passes` (`this.#judgedPasses = [];`), and the override (place it after `touchTexture()`; mention it in the class comment):

```ts
  /**
   * Judges the `visible` hook of every pass that has one, then uploads what the pools have marked
   * — see {@link VertexObjects.update}. Call it once per frame, after the changes and before
   * rendering. Allocates nothing.
   */
  override update(): void {
    const judged = this.#judgedPasses;
    for (let i = 0; i < judged.length; i++) judged[i]!.judgeVisibility();
    super.update();
  }
```

Run: `pnpm nx test twopoint5d -- src/sprites`
Expected: PASS, the allocation test included (`pnpm test:allocations` runs it in its own project; run that too).

- [ ] **Step 6: Exports, docs and changelog**

`public-api.ts` exports `passPresets.js` already, so `shadowFallsOnPlane` is public.

`docs/sprites.md`, passes section:
- the two presets paragraph: `ShadowPass` carries the hook `shadowFallsOnPlane`.
- a new subsection paragraph **Leaving a pass out for a frame.** — the `visible` hook (signature, when it runs, that it reads through `uniformNames`, must allocate nothing), what `ShadowPass` checks (spec §5, both cases with the cosine), the new convention "the sprites stand on the side the normal of `groundPlane` points to", and `FeatureSpritesPass#enabled` (`sprites.passes['shadow']!.enabled = false`) instead of `visible`. A `ts check` block:

```ts check
import {definePass, FeatureSprites, ReflectionPass, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import type {Vector4} from 'three/webgpu';

// a reflection drawn only while the mirror faces up
export const UpwardReflectionPass = definePass({
  ...ReflectionPass,
  name: 'upwardReflection',
  visible: (uniform) => (uniform('mirrorPlane').value as Vector4).y > 0,
});

const sprites = new FeatureSprites(TexturedSpriteKind, {passes: [UpwardReflectionPass]});
sprites.update();
sprites.passes['upwardReflection']!.enabled = false;
sprites.dispose();
```

- "The rules": the bullet **`update()` once** gains "it also judges the hooks".

`CHANGELOG.md` `### Added`: `- add SpritePass#visible, a hook that FeatureSprites#update() asks every frame whether to draw the pass, FeatureSpritesPass#enabled, the caller's switch next to it, and shadowFallsOnPlane, the hook of ShadowPass, which leaves the shadow out while its light does not fall onto the side of groundPlane the normal points to`.

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Gate and commit**

Run: `pnpm run ci`
Expected: PASS.

```bash
git add packages/twopoint5d/src/sprites packages/twopoint5d/docs/sprites.md packages/twopoint5d/CHANGELOG.md
git commit -m "feat(sprites): leave a pass out for a frame through its visible hook"
```

---

### Task 4: Uniform sources and `bindUniform()`

**Files:**
- Create: `packages/twopoint5d/src/sprites/bindings/SpriteUniformSource.ts`, `planeOf.ts`, `lightOf.ts`, `bindings.spec.ts`
- Modify: `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts`, `packages/twopoint5d/src/sprites/public-api.ts`
- Test: `packages/twopoint5d/src/sprites/bindings/bindings.spec.ts`, `FeatureSprites/FeatureSprites.spec.ts`, `src/sprites/hot-path-allocations.spec.ts`
- Docs: `docs/sprites.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `FeatureSprites.update()` and `#judgedPasses` from Task 3.
- Produces (public):
  - `type SpriteUniformSource = {readonly type: 'vec3'; write(out: Vector3, worldToSprites: Matrix4): void} | {readonly type: 'vec4'; write(out: Vector4, worldToSprites: Matrix4): void}`
  - `planeOf(node: Object3D, options?: {plane?: Plane}): SpriteUniformSource` and `planeOf(plane: Plane): SpriteUniformSource` — type `'vec4'`
  - `lightOf(node: Object3D): SpriteUniformSource` — type `'vec4'`
  - `FeatureSprites#bindUniform(name: string, source: SpriteUniformSource): void`, `FeatureSprites#unbindUniform(name: string): void`

- [ ] **Step 1: Write the failing source tests**

Create `bindings/bindings.spec.ts`:

```ts
import {DirectionalLight, Matrix4, Mesh, Object3D, Plane, PlaneGeometry, PointLight, Vector3, Vector4} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {lightOf} from './lightOf.js';
import {planeOf} from './planeOf.js';
import type {SpriteUniformSource} from './SpriteUniformSource.js';

const IDENTITY = new Matrix4();

const written = (source: SpriteUniformSource, worldToSprites = IDENTITY): number[] => {
  const out = new Vector4();
  (source as Extract<SpriteUniformSource, {type: 'vec4'}>).write(out, worldToSprites);
  return out.toArray();
};

// a plane [n, d] up to the length of n, which the features do not need to be 1
const normalized = ([x, y, z, d]: number[]): number[] => {
  const size = Math.hypot(x!, y!, z!);
  return [x! / size, y! / size, z! / size, d! / size];
};

const expectNear = (actual: number[], expected: number[]) =>
  expected.forEach((value, i) => expect(actual[i], `component ${i} of ${actual}`).toBeCloseTo(value, 5));

describe('planeOf()', () => {
  test('takes the local XY plane of a node, turned and moved: a ground at y = 2', () => {
    const ground = new Mesh(new PlaneGeometry(4, 4));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 2;

    expect(planeOf(ground).type).toBe('vec4');
    expectNear(normalized(written(planeOf(ground))), [0, 1, 0, 2]);
  });

  test('keeps the plane of a node scaled unevenly', () => {
    const ground = new Object3D();
    ground.rotation.x = -Math.PI / 2;
    ground.rotation.z = 0.3;
    ground.scale.set(3, 1, 0.5);
    ground.position.y = 1;

    expectNear(normalized(written(planeOf(ground))), [0, 1, 0, 1]);
  });

  test('takes a plane of its own in the local space of the node', () => {
    const node = new Object3D();
    node.position.x = 5;

    // x = 1 in the node is x = 6 in the world
    expectNear(normalized(written(planeOf(node, {plane: new Plane(new Vector3(1, 0, 0), -1)}))), [1, 0, 0, 6]);
  });

  test('takes a fixed plane in world space, the sign of its constant turned: y = 2 is constant -2', () => {
    expectNear(normalized(written(planeOf(new Plane(new Vector3(0, 1, 0), -2)))), [0, 1, 0, 2]);
  });

  test('writes the plane in the local space of the sprites', () => {
    const sprites = new Object3D();
    sprites.position.y = 5;
    sprites.updateMatrixWorld();
    const worldToSprites = sprites.matrixWorld.clone().invert();

    // the world plane y = 0 lies at y = -5 for the sprites
    expectNear(normalized(written(planeOf(new Plane(new Vector3(0, 1, 0), 0)), worldToSprites)), [0, 1, 0, -5]);
  });

  test('reads a node moved since its last world matrix at its new place', () => {
    const parent = new Object3D();
    const ground = new Object3D();
    parent.add(ground);
    ground.rotation.x = -Math.PI / 2;
    parent.updateMatrixWorld();
    parent.position.y = 3;

    expectNear(normalized(written(planeOf(ground))), [0, 1, 0, 3]);
  });

  test('copies the plane of its options: a later change of it does not reach the source', () => {
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const source = planeOf(new Object3D(), {plane});
    plane.constant = -4;

    expectNear(normalized(written(source)), [0, 0, 1, 0]);
  });
});

describe('lightOf()', () => {
  test('writes the direction towards a directional light, from its target to it, with w = 0', () => {
    const sun = new DirectionalLight();
    sun.position.set(0, 10, 0);
    sun.target.position.set(0, 0, 5);

    const [x, y, z, w] = written(lightOf(sun));
    expect(w).toBe(0);
    expectNear(normalized([x!, y!, z!, 0]).slice(0, 3), normalized([0, 10, -5, 0]).slice(0, 3));
  });

  test('writes the position of any other node with w = 1, a point light', () => {
    const lamp = new PointLight();
    lamp.position.set(1, 8, -2);
    const marker = new Object3D();
    marker.position.set(-3, 4, 0);

    expectNear(written(lightOf(lamp)), [1, 8, -2, 1]);
    expectNear(written(lightOf(marker)), [-3, 4, 0, 1]);
  });

  test('writes the light in the local space of the sprites', () => {
    const sprites = new Object3D();
    sprites.position.set(0, 5, 0);
    sprites.rotation.y = Math.PI / 2;
    sprites.updateMatrixWorld();
    const worldToSprites = sprites.matrixWorld.clone().invert();
    const lamp = new Object3D();
    lamp.position.set(2, 5, 0);

    // 2 along world x is 2 along the sprites' z, after a quarter turn about y
    expectNear(written(lightOf(lamp), worldToSprites), [0, 0, 2, 1]);
  });
});
```

Run: `pnpm nx test twopoint5d -- src/sprites/bindings/bindings.spec.ts`
Expected: FAIL — the modules do not exist.

- [ ] **Step 2: Implement the sources**

`bindings/SpriteUniformSource.ts`:

```ts
import type {Matrix4, Vector3, Vector4} from 'three/webgpu';

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

`bindings/planeOf.ts`:

```ts
import {Matrix4, type Object3D, Plane, Vector3, type Vector4} from 'three/webgpu';
import type {SpriteUniformSource} from './SpriteUniformSource.js';

const isPlane = (value: Object3D | Plane): value is Plane => (value as Plane).isPlane === true;

// c · m for the row vector c = [n, -d] of the plane dot(n, p) = d: the plane, carried through the
// map whose inverse is m, written into out as [n, d] again
function writeTransformedPlane(out: Vector4, c: Vector4, m: Matrix4): void {
  const e = m.elements;
  const x = c.x * e[0]! + c.y * e[1]! + c.z * e[2]! + c.w * e[3]!;
  const y = c.x * e[4]! + c.y * e[5]! + c.z * e[6]! + c.w * e[7]!;
  const z = c.x * e[8]! + c.y * e[9]! + c.z * e[10]! + c.w * e[11]!;
  const w = c.x * e[12]! + c.y * e[13]! + c.z * e[14]! + c.w * e[15]!;
  out.x = x;
  out.y = y;
  out.z = z;
  out.w = -w;
}

/**
 * A source for a plane uniform `[n.x, n.y, n.z, d]` (`dot(n, p) = d`) — `groundPlane`,
 * `mirrorPlane` — in the local space of the sprites.
 *
 * - With a node: its local XY plane, the normal +Z — the plane a `PlaneGeometry` lies in, its
 *   front face on the side the normal points to — or `options.plane` in the local space of the
 *   node, copied here. The node is read where it is in each frame; its world matrix is refreshed.
 * - With a `Plane`: that plane in world space, copied here. three's `Plane` is
 *   `dot(n, p) + constant = 0`, so `d` is `-constant`.
 *
 * The normal is not normalized. The sprites stand on the side the normal points to.
 */
export function planeOf(node: Object3D, options?: {plane?: Plane}): SpriteUniformSource;
export function planeOf(plane: Plane): SpriteUniformSource;
export function planeOf(target: Object3D | Plane, options?: {plane?: Plane}): SpriteUniformSource {
  const local = isPlane(target) ? target : (options?.plane ?? new Plane(new Vector3(0, 0, 1), 0));
  // the row vector [n, -d] = [n, constant]
  const c = new Vector4(local.normal.x, local.normal.y, local.normal.z, local.constant);
  const m = new Matrix4();

  if (isPlane(target)) {
    return {
      type: 'vec4',
      write(out, worldToSprites) {
        // world → sprites; the plane goes through the inverse of that map
        writeTransformedPlane(out, c, m.copy(worldToSprites).invert());
      },
    };
  }
  const node = target;
  return {
    type: 'vec4',
    write(out, worldToSprites) {
      node.updateWorldMatrix(true, false);
      // node → sprites is worldToSprites · matrixWorld; the plane goes through its inverse
      writeTransformedPlane(out, c, m.multiplyMatrices(worldToSprites, node.matrixWorld).invert());
    },
  };
}
```

`bindings/lightOf.ts`:

```ts
import type {DirectionalLight, Object3D, Vector4} from 'three/webgpu';
import type {SpriteUniformSource} from './SpriteUniformSource.js';

const isDirectionalLight = (node: Object3D): node is DirectionalLight => (node as DirectionalLight).isDirectionalLight === true;

/**
 * A source for a homogeneous light uniform `[x, y, z, w]` — `shadowLight` — in the local space of
 * the sprites:
 *
 * - a `DirectionalLight`: `w = 0` and the direction towards the light, from its `target` to it.
 *   Light and target are read where they are in each frame, the target outside the scene as well.
 * - any other node — `PointLight`, `SpotLight` (its cone is ignored), an `Object3D` as a lamp:
 *   `w = 1` and its position, a point light.
 *
 * An `AmbientLight` or a `HemisphereLight` is taken as any node; its position means nothing.
 */
export function lightOf(node: Object3D): SpriteUniformSource {
  if (isDirectionalLight(node)) {
    return {
      type: 'vec4',
      write(out: Vector4, worldToSprites) {
        node.updateWorldMatrix(true, false);
        node.target.updateWorldMatrix(true, false);
        const l = node.matrixWorld.elements;
        const t = node.target.matrixWorld.elements;
        const x = l[12]! - t[12]!;
        const y = l[13]! - t[13]!;
        const z = l[14]! - t[14]!;
        const e = worldToSprites.elements;
        // a direction: the linear part of the map alone
        out.x = e[0]! * x + e[4]! * y + e[8]! * z;
        out.y = e[1]! * x + e[5]! * y + e[9]! * z;
        out.z = e[2]! * x + e[6]! * y + e[10]! * z;
        out.w = 0;
      },
    };
  }
  return {
    type: 'vec4',
    write(out: Vector4, worldToSprites) {
      node.updateWorldMatrix(true, false);
      const p = node.matrixWorld.elements;
      const e = worldToSprites.elements;
      out.x = e[0]! * p[12]! + e[4]! * p[13]! + e[8]! * p[14]! + e[12]!;
      out.y = e[1]! * p[12]! + e[5]! * p[13]! + e[9]! * p[14]! + e[13]!;
      out.z = e[2]! * p[12]! + e[6]! * p[13]! + e[10]! * p[14]! + e[14]!;
      out.w = 1;
    },
  };
}
```

Run: `pnpm nx test twopoint5d -- src/sprites/bindings/bindings.spec.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing binding tests**

In `FeatureSprites.spec.ts`, a new `describe('bindUniform()', …)` (imports: `Mesh`, `Object3D`, `PlaneGeometry`, `PointLight` from `three/webgpu`; `planeOf`, `lightOf` from `../bindings/…js`):

```ts
  describe('bindUniform()', () => {
    const vec = (sprites: FeatureSprites, name: string) => (sprites.uniforms![name]!.value as Vector4).toArray();
    const ground = () => {
      const mesh = new Mesh(new PlaneGeometry(4, 4));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 2;
      return mesh;
    };

    test('update() writes the bound uniform in the local space of the sprites, for the sprites and every pass', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      sprites.position.y = 5;
      sprites.bindUniform('groundPlane', planeOf(ground()));

      sprites.update();

      // the ground at y = 2 lies at y = -3 for the sprites at y = 5
      const [x, y, z, d] = vec(sprites, 'groundPlane');
      expect(x).toBeCloseTo(0, 5);
      expect(z).toBeCloseTo(0, 5);
      expect(d! / y!).toBeCloseTo(-3, 5);
      expect(sprites.passes['shadow']!.material.uniforms['groundPlane']!.value).toBe(sprites.uniforms!['groundPlane']!.value);
      sprites.dispose();
    });

    test('reads the sprites where they are: a parent moved without updateMatrixWorld()', () => {
      const parent = new Object3D();
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      parent.add(sprites);
      parent.updateMatrixWorld();
      parent.position.y = 2;
      sprites.bindUniform('groundPlane', planeOf(ground()));

      sprites.update();

      const [, y, , d] = vec(sprites, 'groundPlane');
      expect(d! / y!).toBeCloseTo(0, 5);
      sprites.dispose();
    });

    test('binds a light and overwrites a setUniform() on a bound name in the next update()', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      const lamp = new PointLight();
      lamp.position.set(1, 8, -2);
      sprites.bindUniform('shadowLight', lightOf(lamp));

      sprites.setUniform('shadowLight', 0, 1, 0, 0);
      sprites.update();

      expect(vec(sprites, 'shadowLight')).toEqual([1, 8, -2, 1]);
      sprites.dispose();
    });

    test('a rebinding replaces the source, unbindUniform() keeps the last value', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      const a = new Object3D();
      const b = new Object3D();
      b.position.set(0, 3, 0);
      sprites.bindUniform('shadowLight', lightOf(a));
      sprites.bindUniform('shadowLight', lightOf(b));
      sprites.update();
      expect(vec(sprites, 'shadowLight')).toEqual([0, 3, 0, 1]);

      sprites.unbindUniform('shadowLight');
      b.position.set(0, 9, 0);
      sprites.update();
      expect(vec(sprites, 'shadowLight')).toEqual([0, 3, 0, 1]);
      sprites.dispose();
    });

    test('refuses an unknown name, a source of another type and no source, and binds nothing then', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      const vec3Source = {type: 'vec3' as const, write: () => {}};

      expect(() => sprites.bindUniform('nothing', planeOf(ground()))).toThrow(
        'FeatureSprites: no feature of these sprites or their passes declares the uniform "nothing"',
      );
      expect(() => sprites.bindUniform('groundPlane', vec3Source)).toThrow(
        'FeatureSprites: the uniform "groundPlane" is a vec4, and the source bound to it writes a vec3',
      );
      expect(() => sprites.bindUniform('groundPlane', {} as never)).toThrow(
        'FeatureSprites: bindUniform("groundPlane") takes a source with a type of vec3 or vec4 and a write()',
      );
      sprites.setUniform('groundPlane', 0, 0, 1, 7);
      sprites.update();
      expect(vec(sprites, 'groundPlane')).toEqual([0, 0, 1, 7]);
      sprites.dispose();
    });

    test('evaluates the bindings before the hooks: a light bound below the ground hides the shadow in the same update()', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      const lamp = new Object3D();
      lamp.position.set(0, -4, 0);
      sprites.bindUniform('shadowLight', lightOf(lamp));

      sprites.update();

      expect(sprites.passes['shadow']!.visible).toBe(false);
      sprites.dispose();
    });

    test('dispose() drops the bindings; binding afterwards does nothing', () => {
      const sprites = new FeatureSprites(kind, {passes: [ShadowPass]});
      sprites.bindUniform('groundPlane', planeOf(ground()));
      sprites.dispose();

      expect(() => sprites.bindUniform('groundPlane', planeOf(ground()))).not.toThrow();
      expect(() => sprites.unbindUniform('groundPlane')).not.toThrow();
      expect(() => sprites.update()).not.toThrow();
    });
  });
```

and in `hot-path-allocations.spec.ts`:

```ts
  test('update() with a plane and a light binding and a pass with a hook allocates nothing per call', async () => {
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1000, passes: [ShadowPass]});
    for (let i = 0; i < 1000; i++) sprites.createSprite();
    const ground = new Object3D();
    ground.rotation.x = -Math.PI / 2;
    const sun = new DirectionalLight();
    sun.position.set(3, 10, 2);
    const lamp = new Object3D();
    lamp.position.set(0, 20, 0);
    sprites.bindUniform('groundPlane', planeOf(ground));
    sprites.bindUniform('shadowLight', lightOf(sun));
    sprites.update();

    const sunBytes = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) sprites.update();
    });
    sprites.bindUniform('shadowLight', lightOf(lamp));
    sprites.update();
    const lampBytes = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) sprites.update();
    });

    expect(sunBytes / 1000).toBeLessThan(BYTES_PER_CALL_LIMIT);
    expect(lampBytes / 1000).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });
```

(imports: `DirectionalLight`, `Object3D` from `three/webgpu`; `planeOf`, `lightOf` from `./bindings/…js`; `ShadowPass` from `./passes/passPresets.js`.)

Run: `pnpm nx test twopoint5d -- src/sprites/FeatureSprites/FeatureSprites.spec.ts`
Expected: FAIL — `bindUniform` does not exist.

- [ ] **Step 4: Implement the bindings**

`FeatureSprites.ts` (imports: `Matrix4`, `Vector2`, `Vector3`, `Vector4` from `three/webgpu`; `type SpriteUniformSource` from `../bindings/SpriteUniformSource.js`):

```ts
const typeOfUniform = (node: SpriteUniformNode): string =>
  node.value instanceof Vector4 ? 'vec4' : node.value instanceof Vector3 ? 'vec3' : node.value instanceof Vector2 ? 'vec2' : 'float';
```

Fields of `FeatureSprites` — parallel arrays, so that `update()` walks them by index without an iterator:

```ts
  readonly #boundNames: string[] = [];
  readonly #boundSources: SpriteUniformSource[] = [];
  readonly #boundVectors: (Vector3 | Vector4)[] = [];
  readonly #worldToSprites = new Matrix4();
```

Methods (after `setUniform()`):

```ts
  /**
   * Binds the uniform `name` to `source`: every {@link update} writes it, in the local space of the
   * sprites, for the sprites and every pass. A binding of the same name is replaced and keeps its
   * place; bindings run in the order they were made. A `setUniform()` on a bound name holds until
   * the next `update()`. The nodes a source reads stay the caller's. Does nothing once disposed.
   *
   * @throws a `TypeError` for a name no feature of the sprites or their passes declares, for a
   *   source of another type than the uniform, and for something that is no source; nothing is
   *   bound then
   */
  bindUniform(name: string, source: SpriteUniformSource): void {
    const material = this.material;
    if (material == null) return;
    if (source == null || typeof source.write !== 'function' || (source.type !== 'vec3' && source.type !== 'vec4')) {
      throw new TypeError(`${WHERE}: bindUniform("${name}") takes a source with a type of vec3 or vec4 and a write()`);
    }
    const node = material.uniforms[name];
    if (node == null) {
      throw new TypeError(`${WHERE}: no feature of these sprites or their passes declares the uniform "${name}"`);
    }
    const type = typeOfUniform(node);
    if (type !== source.type) {
      throw new TypeError(`${WHERE}: the uniform "${name}" is a ${type}, and the source bound to it writes a ${source.type}`);
    }
    const at = this.#boundNames.indexOf(name);
    const index = at === -1 ? this.#boundNames.length : at;
    this.#boundNames[index] = name;
    this.#boundSources[index] = source;
    this.#boundVectors[index] = node.value as Vector3 | Vector4;
  }

  /** Ends the binding of `name`; the uniform keeps the value written last. Does nothing without one. */
  unbindUniform(name: string): void {
    const at = this.#boundNames.indexOf(name);
    if (at === -1) return;
    this.#boundNames.splice(at, 1);
    this.#boundSources.splice(at, 1);
    this.#boundVectors.splice(at, 1);
  }
```

`update()` becomes:

```ts
  override update(): void {
    const sources = this.#boundSources;
    if (sources.length > 0 && this.material != null) {
      // the renderer refreshes the world matrices only inside render(), after this call
      this.updateWorldMatrix(true, false);
      const worldToSprites = this.#worldToSprites.copy(this.matrixWorld).invert();
      const vectors = this.#boundVectors;
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i]!;
        // the type was checked against the uniform when it was bound
        source.write(vectors[i] as Vector3 & Vector4, worldToSprites);
      }
    }
    const judged = this.#judgedPasses;
    for (let i = 0; i < judged.length; i++) judged[i]!.judgeVisibility();
    super.update();
  }
```

Update its doc comment: `Writes the bound uniforms (see bindUniform), judges the visible hook of every pass that has one, then uploads …`.

In `dispose()`, after the passes are cleared: `this.#boundNames.length = 0; this.#boundSources.length = 0; this.#boundVectors.length = 0;` — the sprites hold no node after it. Mention bindings in the dispose doc comment and add `bindUniform()` and `unbindUniform()` to "do nothing".

`public-api.ts`:

```ts
export * from './bindings/lightOf.js';
export * from './bindings/planeOf.js';
export type {SpriteUniformSource} from './bindings/SpriteUniformSource.js';
```

(at the top of the file, keeping its alphabetical order.)

Run: `pnpm nx test twopoint5d -- src/sprites` and `pnpm test:allocations`
Expected: PASS. If an allocation test fails, a source or `update()` hands a fractional number across a call or builds an object: read the hot path line by line — every write must be a field assignment, every loop an index loop — and fix it there; do not raise `BYTES_PER_CALL_LIMIT`.

- [ ] **Step 5: Docs and changelog**

`docs/sprites.md`: a new section **"Binding uniforms to the scene graph"** after "Passes: shadows and reflections" (before "Performance"), with:
- why: the uniforms live in the local space of the sprites and in the form `dot(n, p) = d`; a binding works it out every frame from a node.
- `planeOf()` (both forms; the default plane is the local XY plane, normal +Z — `PlaneGeometry`; `options.plane` is copied; `d = -constant` for a three `Plane`; the sprites stand on the side the normal points to), `lightOf()` (`DirectionalLight` → direction towards it, `w = 0`, target read each frame even outside the scene; any other node → point, `w = 1`; ambient and hemisphere lights mean nothing), `bindUniform()` / `unbindUniform()` with every rule of spec §3 (checks, order, `setUniform()` on a bound name, lifecycle, material handed in).
- the order of `update()` (spec §3.1), and why a node moved after `update()` shows a frame late.
- `SpriteUniformSource` for a source of one's own, with the rule "write fields, allocate nothing, hand no fractional number across a call".
- What does not work (spec §7): sprites below the plane, a finite ground, a light per sprite.
- One `ts check` block:

```ts check
import {FeatureSprites, lightOf, planeOf, ReflectionPass, ShadowPass, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import {DirectionalLight, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Scene} from 'three/webgpu';

const scene = new Scene();
const ground = new Mesh(new PlaneGeometry(400, 400), new MeshBasicNodeMaterial({transparent: true}));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const sun = new DirectionalLight();
sun.position.set(-80, 160, 120);

const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 100, passes: [ReflectionPass, ShadowPass]});
scene.add(sprites);

// the shadow and the reflection follow the ground and the sun, wherever they and the sprites move
sprites.bindUniform('groundPlane', planeOf(ground));
sprites.bindUniform('mirrorPlane', planeOf(ground));
sprites.bindUniform('shadowLight', lightOf(sun));

// reflection < ground < shadow < sprites
sprites.passes['reflection']!.renderOrder = -3;
ground.renderOrder = -2;
sprites.passes['shadow']!.renderOrder = -1;

// once per frame, after the changes, before rendering
sprites.update();

sprites.dispose();
ground.geometry.dispose();
ground.material.dispose();
```

- in "Passes": replace the sentence about computing planes by hand with a pointer to the new section; in "Performance" add `update()` with bindings allocates nothing either.

`CHANGELOG.md` `### Added`: `- add uniform bindings: FeatureSprites#bindUniform() and #unbindUniform() bind a uniform to a SpriteUniformSource that update() runs every frame, in the local space of the sprites; planeOf() takes a plane from a node — its local XY plane or a plane of its own — or from a Plane in world space, lightOf() a light from a DirectionalLight (a direction towards it) or any other node (a point light); …` (the checks, the order, setUniform on a bound name, dispose).

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Gate and commit**

Run: `pnpm run ci`
Expected: PASS.

```bash
git add packages/twopoint5d/src/sprites packages/twopoint5d/docs/sprites.md packages/twopoint5d/CHANGELOG.md
git commit -m "feat(sprites): bind the uniforms of sprites to planes and lights of the scene graph"
```

---

### Task 5: Browser tests for bound planes, point lights and the hook

**Files:**
- Modify: `packages/twopoint5d-testing/test/sprites-shadow-pass.test.js`
- Modify (if a helper is needed by a second file): `packages/twopoint5d-testing/test/helpers/fixtures.js`

**Interfaces:**
- Consumes: `planeOf`, `lightOf`, `bindUniform` (Task 4), `shadowLight` (Task 1), the hook (Task 3), the existing helpers `makeColorTexture`, `renderToPixels`, `columnsOf` of this file.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the tests**

Add to `describe('sprites — a shadow pass', …)` (import `lightOf`, `planeOf` from `@spearwolf/twopoint5d`; `Object3D`, `Plane`, `Vector3` from `three/webgpu`). They use the frontal orthographic camera of `makeCamera()` — camera at x = -1, 8 pixels per unit, so world x lands in column `(x + 5) · 8` and `CENTER` (32) is x = -1 — and the plane z = 0:

```js
  it('draws the shadow on a plane bound from a node, for sprites moved in the world', async function () {
    const colorMap = makeColorTexture([RED, RED, RED, RED], 2, 2);
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap}, passes: [ShadowPass]});
    sprites.setUniform('shadowColor', 0, 0, 1, 1);
    sprites.setUniform('shadowLight', -0.5, 0, 1, 0);
    // the sprites move 1 to the left and the sprite 1 to the right: it stands where aimTheShadow() expects it
    sprites.position.x = -1;
    const wall = new Object3D(); // its local XY plane is the plane z = 0, the normal towards the camera
    sprites.bindUniform('groundPlane', planeOf(wall));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(0, 0, 4);
    sprite.setTexCoords(0, 0, 1, 1);
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, makeCamera(), target);

    sprites.dispose();
    colorMap.dispose();

    expect(columnsOf(pixels, [255, 0, 0]), 'the sprite at x ∈ [-2, 0]').to.deep.equal({from: CENTER - 8, to: CENTER + 7});
    expect(columnsOf(pixels, BLUE), 'its shadow at x ∈ [0, 2]').to.deep.equal({from: CENTER + 8, to: CENTER + 23});
  });

  it('spreads the shadow of a point light and draws none for a light behind the plane', async function () {
    const colorMap = makeColorTexture([RED, RED, RED, RED], 2, 2);
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap}, passes: [ShadowPass]});
    sprites.setUniform('shadowColor', 0, 0, 1, 1);
    sprites.bindUniform('groundPlane', planeOf(new Plane(new Vector3(0, 0, 1), 0)));
    // a point 8 in front of the plane, at the left edge of the sprite: the sprite 4 in front of the
    // plane casts a shadow twice its size, from x = -2 to x = 2 (ortho camera: 32 columns)
    const lamp = new Object3D();
    lamp.position.set(-2, 0, 8);
    sprites.bindUniform('shadowLight', lightOf(lamp));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(-1, 0, 4);
    sprite.setTexCoords(0, 0, 1, 1);
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const spread = await renderToPixels(display.renderer, scene, makeCamera(), target);

    lamp.position.set(-2, 0, -3);
    sprites.update();
    const behind = await renderToPixels(display.renderer, scene, makeCamera(), target);

    sprites.dispose();
    colorMap.dispose();

    // from (-2, 0, 8) through the sprite at z = 4 down to z = 0 doubles it: x ∈ [-2, 2], y ∈ [-2, 2].
    // The sprite (x ∈ [-2, 0], y ∈ [-1, 1]) covers part of it; above and below the sprite the left
    // half shows as well, so blue spans every column from x = -2 to x = 2
    expect(columnsOf(spread, BLUE), 'the spread shadow, x ∈ [-2, 2]').to.deep.equal({from: CENTER - 8, to: CENTER + 23});
    expect(columnsOf(behind, BLUE).from, 'no shadow from behind the plane').to.equal(-1);
  });
```


- [ ] **Step 2: Run the browser tests**

Run: `pnpm build:twopoint5d && pnpm --dir packages/twopoint5d-testing exec web-test-runner --files test/sprites-shadow-pass.test.js`
Expected: PASS under WebGPU and WebGL 2. If a column range is off by one, check the rasterization rule against the existing first test of the file, which uses the same camera, before touching the expectation.

- [ ] **Step 3: Gate and commit**

Run: `pnpm run ci`
Expected: PASS.

```bash
git add packages/twopoint5d-testing/test
git commit -m "test(sprites): draw shadows from bound planes and point lights in the browser"
```

---

### Task 6: `animated-billboards` throws its shadows onto its ground

**Files:**
- Modify: `apps/lookbook/src/pages/demos/animated-billboards.astro`
- Modify: `apps/lookbook/src/pages/demos/_animated-billboards.json` (description, tags)
- Modify: `apps/lookbook/public/images/demo-preview/animated-billboards.webp` (regenerated)

**Interfaces:**
- Consumes: `ShadowPass`, `planeOf`, `lightOf`, `bindUniform` (Tasks 1–4).

- [ ] **Step 1: Switch to the options form with a shadow pass**

In the `<script>` of `animated-billboards.astro`: drop `FeatureSpritesMaterial` (a material handed in refuses passes) and build the sprites from options; add the sun and the bindings. Imports gain `lightOf`, `planeOf`, `ShadowPass` from `@spearwolf/twopoint5d` and `DirectionalLight` from `three/webgpu`:

```ts
    const mesh = new FeatureSprites(AnimatedSpriteKind, {
      geometry,
      textures: {colorMap: texture, animsMap: anims.bakeDataTexture({renderer})},
      placement: BillboardPlacement,
      depthTest: true,
      depthWrite: true,
      passes: [ShadowPass],
      uniforms: {shadowColor: [0, 0, 0, 0.45]},
    });

    demo.scene.add(mesh);

    // the sun circles the scene; lightOf() reads it and its target every frame, neither needs to
    // be part of the scene: the ground material is unlit
    const sun = new DirectionalLight();
    const SUN_RADIUS = 140;
    const SUN_HEIGHT = 160;

    on(demo, OnDisplayRenderFrame, ({deltaTime, now}) => {
      bouncingSprites.animate(deltaTime);
      sun.position.set(Math.cos(now * 0.2) * SUN_RADIUS, SUN_HEIGHT, Math.sin(now * 0.2) * SUN_RADIUS);
      mesh.setUniform('time', now);
      mesh.update();
    });
```

After the ground `plane` is built: `plane.renderOrder = -2;` with the comment `// the transparent ground is drawn before the shadow (-1), which writes no depth and lies on it` and `mesh.bindUniform('groundPlane', planeOf(plane));` with `// the front face of the ground looks up: rotation.x = -π/2 turns its normal +Z to +Y`.

- [ ] **Step 2: Metadata**

`_animated-billboards.json`: extend `description` with one sentence — `` A `ShadowPass` throws the shadow of every billboard onto the ground: `bindUniform()` binds `groundPlane` to the ground mesh through `planeOf()` and `shadowLight` to a circling `DirectionalLight` through `lightOf()`. `` — and add the tags `ShadowPass`, `planeOf`, `lightOf`. Drop `FeatureSpritesMaterial` from the tags if the page no longer uses it.

`apps/lookbook/src/data/tag-categories.json`: add `ShadowPass`, `ReflectionPass` to the `includeTags` of "Sprites" (both are exports; `planeOf`/`lightOf` are lowercase and need no entry — add them to "Sprites" too, for the filter).

Run: `pnpm test:scripts`
Expected: PASS (`demoMetadata.test.mjs` checks the tags).

- [ ] **Step 3: Look at it and regenerate the preview**

Run: `pnpm lookbook` and open <http://localhost:4321/lookbook/demos/animated-billboards>. Check: every billboard has a shadow on the ground, the shadows turn with the sun, no shadow floats above the ground plane inside its square, the ground does not cover the shadows. Stop the server.

Run: `pnpm lookbook:generate-previews --only=animated-billboards`
Expected: `apps/lookbook/public/images/demo-preview/animated-billboards.webp` rewritten, exit 0.

- [ ] **Step 4: Gate and commit**

Run: `pnpm run ci`
Expected: PASS.

```bash
git add apps/lookbook/src/pages/demos/animated-billboards.astro apps/lookbook/src/pages/demos/_animated-billboards.json apps/lookbook/src/data/tag-categories.json apps/lookbook/public/images/demo-preview/animated-billboards.webp
git commit -m "feat(lookbook): throw the shadows of the animated billboards onto their ground"
```

---

### Task 7: The lookbook demo `sprite-reflection`

**Files:**
- Create: `apps/lookbook/src/pages/demos/sprite-reflection.astro`
- Create: `apps/lookbook/src/pages/demos/_sprite-reflection.json`
- Create: `apps/lookbook/public/images/demo-preview/sprite-reflection.webp` (generated)

**Interfaces:**
- Consumes: `ReflectionPass`, `planeOf`, `bindUniform`; `BouncingSprites` from `~demos/animated-sprites/BouncingSprites` (2D, container centred on 0, bounces at `y = -height / 2`, wraps at `±containerWidth / 2`); `PerspectiveOrbitDemo` (fov 75, orbit target at the origin).

- [ ] **Step 1: The page**

`sprite-reflection.astro` — markup and style as in `animated-sprites.astro` (the *less* / count / *more* buttons), with `body { background: rgb(4 4 8); color: #eee; }`. The script:

```ts
<script>
  import {on} from '@spearwolf/eventize';
  import {
    AnimatedSpriteKind,
    FeatureSprites,
    FeatureSpritesGeometry,
    OnDisplayInit,
    OnDisplayRenderFrame,
    OnDisplayResize,
    planeOf,
    ReflectionPass,
    TextureStore,
  } from '@spearwolf/twopoint5d';
  import {BufferGeometry, Line, LineBasicMaterial, Object3D, Vector3} from 'three/webgpu';
  import {BouncingSprites} from '~demos/animated-sprites/BouncingSprites';
  import {PerspectiveOrbitDemo} from '~demos/utils/PerspectiveOrbitDemo';
  import assetsUrl from '~demos/utils/assetsUrl';
  import {getFullscreenCanvas} from '~demos/utils/fullscreenCanvas';

  const demo = new PerspectiveOrbitDemo(getFullscreenCanvas(), {antialias: false});

  const CAPACITY = 3000;
  const INITIAL_SPRITE_COUNT = 500;
  const SPRITE_SIZE = 7;
  // the height the sprites bounce in; with the sprite on top it fills the upper half of the window
  const HEIGHT = 75;
  const UPPER_HALF = HEIGHT + SPRITE_SIZE;

  // the .spriteCount readout is written by the markup of this very page
  const renderSpriteCount = (count: number) => {
    document.querySelector('.spriteCount')!.textContent = count.toString();
  };

  on(demo, OnDisplayInit, async ({scene, camera, renderer}) => {
    // on the mirror, looking straight at the sprites: the horizon runs through the middle of the
    // window, and the upper half shows UPPER_HALF units at the plane of the sprites
    const halfFov = (camera.fov * Math.PI) / 360;
    camera.position.set(0, 0, UPPER_HALF / Math.tan(halfFov));

    const store = new TextureStore(renderer);
    on(store, 'error', ({source, url, id, error}) => {
      // biome-ignore lint/suspicious/noConsole: the demo logs to the devtools on purpose
      console.error(`[sprite-reflection] TextureStore ${source} failed for ${url ?? id}`, error);
    });
    await store.loadAsync(assetsUrl('nobingers.json'));
    const [texture, frameBasedAnimations] = await store.getAsync('nobingers', ['texture', 'frameBasedAnimations']);

    const geometry = new FeatureSpritesGeometry(AnimatedSpriteKind, CAPACITY);
    const bouncingSprites = new BouncingSprites(geometry.instancedPool, 500, HEIGHT, SPRITE_SIZE);
    // the sprites fly to the edges of the window at any aspect; set before the first sprites are made
    const fitWidth = (width: number, height: number) => {
      bouncingSprites.containerWidth = 2 * (width / height) * UPPER_HALF;
    };
    fitWidth(demo.width, demo.height);
    on(demo, OnDisplayResize, ({width, height}) => fitWidth(width, height));
    bouncingSprites.startSpeedBaseX = 10;
    bouncingSprites.startSpeedX = 50;
    const animId = frameBasedAnimations.animId('anim0');
    bouncingSprites.createSprites(INITIAL_SPRITE_COUNT, animId);
    renderSpriteCount(INITIAL_SPRITE_COUNT);

    const sprites = new FeatureSprites(AnimatedSpriteKind, {
      geometry,
      textures: {colorMap: texture, animsMap: frameBasedAnimations.bakeDataTexture({renderer})},
      depthTest: false,
      depthWrite: false,
      passes: [ReflectionPass],
      // darker, a little cool, half transparent
      uniforms: {reflectionColor: [0.35, 0.38, 0.45, 0.55]},
    });
    // the container is centred on 0 and bounces at -HEIGHT / 2: lifted, the sprites touch the mirror
    sprites.position.y = HEIGHT / 2 + SPRITE_SIZE / 2;
    scene.add(sprites);

    // the mirror: the world plane y = 0, the local XY plane of this node. The sprites are lifted, so
    // for them the plane lies at y = -(HEIGHT + SPRITE_SIZE) / 2 — planeOf() works that out
    const waterline = new Object3D();
    waterline.rotation.x = -Math.PI / 2;
    scene.add(waterline);
    sprites.bindUniform('mirrorPlane', planeOf(waterline));

    // a faint horizon: a strip in the plane of the mirror would be seen edge-on, a line is not
    const horizon = new Line(
      new BufferGeometry().setFromPoints([new Vector3(-5000, 0, 0), new Vector3(5000, 0, 0)]),
      new LineBasicMaterial({color: 0x1a1f2e}),
    );
    scene.add(horizon);

    on(demo, OnDisplayRenderFrame, ({deltaTime, now}) => {
      bouncingSprites.animate(deltaTime);
      sprites.setUniform('time', now);
      sprites.update();
    });

    // biome-ignore lint/suspicious/noConsole: the demo logs to the devtools on purpose
    console.log('FeatureSprites', sprites);

    // the .moreSprites and .lessSprites buttons are written by the markup of this very page
    document.querySelector('.moreSprites')!.addEventListener('click', () => {
      bouncingSprites.createSprites(20, animId);
      renderSpriteCount(bouncingSprites.sprites.length);
    });
    document.querySelector('.lessSprites')!.addEventListener('click', () => {
      bouncingSprites.destroySprites(20);
      renderSpriteCount(bouncingSprites.sprites.length);
    });
  });

  demo.start();
</script>
```

Notes for the implementer: check that `PerspectiveOrbitDemo` exposes `width`/`height` (it extends `Display`) and that `OnDisplayResize` hands `width`/`height` (`DisplayEventProps`); if `containerWidth` is consulted only in `createSprites()` and `animate()`, setting it is enough. Sprites created at `x0` beyond the new width wrap on their next step.

- [ ] **Step 2: Metadata**

`_sprite-reflection.json`:

```json
{
  "title": "sprite reflection",
  "shortDescription": "Bouncing sprites over a dark mirror: a ReflectionPass whose plane is bound to a node of the scene",
  "description": "Bouncing sprites of the `AnimatedSpriteKind` in the upper half of the window, their mirror image in the lower half — a waterline. A `ReflectionPass` draws the image from the same pool and geometry, multiplied by a dark, cool `reflectionColor`. The mirror is a node at `y = 0`, bound with `bindUniform('mirrorPlane', planeOf(waterline))`: the sprites mesh is lifted so that the sprites touch the mirror, and `planeOf()` carries the plane into its local space every frame. Tilt the camera — the image is geometry and stays right from any angle. The *more* and *less* buttons create and free sprites.",
  "url": "/demos/sprite-reflection",
  "tags": [
    "FeatureSprites",
    "FeatureSpritesGeometry",
    "AnimatedSpriteKind",
    "ReflectionPass",
    "planeOf",
    "FrameBasedAnimations",
    "TextureStore",
    "vanilla"
  ]
}
```

Run: `pnpm test:scripts`
Expected: FAIL in `demoPreviews.test.mjs` only — the demo has no image yet.

- [ ] **Step 3: Look at it**

Run: `pnpm lookbook` and open <http://localhost:4321/lookbook/demos/sprite-reflection>. Check against spec §10: sprites only in the upper half, touching the horizon when they bounce; the lower half shows their mirror image, darker and cooler; the background close to black; the faint line at the horizon; resizing to a narrow and a wide window keeps the sprites to the edges; tilting the camera keeps the image under the sprites. Adjust `reflectionColor` and the line color only within the spirit of the spec. Stop the server.

- [ ] **Step 4: Preview image**

Run: `pnpm lookbook:generate-previews --only=sprite-reflection`
Expected: `apps/lookbook/public/images/demo-preview/sprite-reflection.webp`, exit 0.

Run: `pnpm test:scripts`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

Run: `pnpm run ci`
Expected: PASS.

```bash
git add apps/lookbook/src/pages/demos/sprite-reflection.astro apps/lookbook/src/pages/demos/_sprite-reflection.json apps/lookbook/public/images/demo-preview/sprite-reflection.webp
git commit -m "feat(lookbook): add the sprite-reflection demo, a waterline mirror bound through planeOf()"
```

---

### Task 8: Close the proposal

**Files:**
- Modify: `packages/twopoint5d/docs/proposals/sprite-uniform-bindings.md` (the status line)
- Modify: `packages/twopoint5d/docs/proposals/sprite-features.md` (its status block)

- [ ] **Step 1: Status blocks**

`sprite-uniform-bindings.md`: replace the `Status:` line with `Status: **implemented** — see [`docs/sprites.md`](../sprites.md), "Binding uniforms to the scene graph" and "Passes: shadows and reflections".` followed by a list of the deviations from the spec that the implementation took (none is expected; list any a task had to make, each with its reason), and `The sketch below is kept as it was written.`

`sprite-features.md`: add one bullet to its deviations list: `` `lightDirection` of `PlanarShadow` became the homogeneous `shadowLight` — see [`sprite-uniform-bindings.md`](sprite-uniform-bindings.md) §4. ``

- [ ] **Step 2: Gate and commit**

Run: `pnpm run ci`
Expected: PASS.

```bash
git add packages/twopoint5d/docs/proposals
git commit -m "docs(sprites): mark the uniform bindings proposal implemented"
```
