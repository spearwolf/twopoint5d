# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` is the canonical agent context for this repo (also consumed by Gemini via `.gemini/settings.json`). Read it for the full picture; this file captures Claude-specific notes and the day-to-day commands.

## Commands

All commands run from the repo root. Node ≥22.13 and pnpm ≥10.22 are required (`engines` in `package.json`).

- Install: `pnpm install`
- Lint: `pnpm lint` (flat-config ESLint + Prettier; `no-console` is an error in `.ts`/`.js`)
- Build everything: `pnpm build` (nx orchestrates `^build` deps and caches outputs)
- Build core lib only: `pnpm build:twopoint5d` (uses Nx tag `twopoint5d`)
- Test everything: `pnpm test`
- CI-tagged tests only (skips browser tests that need Playwright): `pnpm test:ci`
- Affected only: `pnpm test:affected`
- Single Vitest file: `pnpm nx test twopoint5d -- src/path/to/file.spec.ts` (or `cd packages/twopoint5d && pnpm vitest --run src/path/to/file.spec.ts`)
- Watch one package: `cd packages/twopoint5d && pnpm watch`
- Lookbook dev server: `pnpm lookbook` (Astro at `http://localhost:4321`)
- Full pre-commit gate: `pnpm cbt` (clean → lint → build → checkPkgTypes → test:ci) — same as `pnpm ci`
- Type-check published `.d.ts` shape: `pnpm checkPkgTypes` (Are The Types Wrong, runs against built `dist/`)

Do **not** run `pnpm publishNpmPkg` or anything in `scripts/publishNpmPkg.mjs` without explicit instruction.

## Repo layout

Monorepo via Nx + pnpm workspaces (`pnpm-workspace.yaml`):

- `packages/twopoint5d` — the published library `@spearwolf/twopoint5d`. ESM-only, `sideEffects: false`. Build = `tsc` → `dist/lib/` + `scripts/makePackageJson.mjs` synthesizes the publish-time `package.json` from `package.json` + `package.override.json`. **Never publish from `packages/twopoint5d/` directly — publish from `dist/`.**
- `packages/twopoint5d-testing` — `@web/test-runner` browser integration tests (Playwright Chromium + Firefox). Lives outside the core lib so `packages/twopoint5d` keeps Vitest-only tests with no browser deps.
- `apps/lookbook` — Astro app, the de-facto live documentation/showcase. `apps/handbook/` only contains leftover image assets (the VitePress app was removed in `bc361c9`); ignore any AGENTS.md mention of "VitePress (Handbook)".

The library has **two test surfaces**: unit/logic tests (`*.spec.ts` next to source, run by Vitest in `packages/twopoint5d`) and visual/WebGL integration tests (`*.test.js` in `packages/twopoint5d-testing/test/`, run by `web-test-runner`). When changing rendering or GPU-buffer code in the core lib, also add a browser test in `twopoint5d-testing/`.

## Architecture essentials

`packages/twopoint5d/src/index.ts` re-exports each module's `public-api.ts` — that file is the single source of truth for the package's public surface. **Anything not re-exported via a `public-api.ts` is internal**; do not add deep imports from consumers, and when adding a new public symbol you must add it to the relevant `public-api.ts`.

The performance core is `vertex-objects/`. A *vertex object description* declaratively defines per-instance attributes; `VertexObjectPool` + `VOBufferGeometry` (and the `Instanced*` variants) generate JS getter/setter wrappers backed by typed arrays that map directly into a single three.js `BufferGeometry`. Higher layers (`sprites/`, `map2d/`) are built on top of this — when touching them, understand that thousands of "objects" are actually slices of one shared buffer drawn in one call.

Other layers, all consumed via `public-api.ts`:
- `display/` — `Display` wraps the three.js renderer + frame loop, `Chronometer` is the time source.
- `stage/` — `Stage2D`, `StageRenderer`, projection strategies (Orthographic, Parallax).
- `texture/` — `TextureAtlas`, `TileSet`, `TextureStore` (resource cache).
- `map2d/` — Tiled-map integration including `Map2DLayer` and `CameraBasedVisibility` (frustum culling for tiles).
- `controls/`, `utils/` — input + helpers.

## Conventions worth knowing

- **Catalog deps**: `three`, `@types/three`, `@spearwolf/eventize`, `@spearwolf/signalize` are pinned via the `catalog:` field in `pnpm-workspace.yaml`. Bump them there, not in individual `package.json` files. They are `peerDependencies` of the core package.
- **TS imports**: `@typescript-eslint/consistent-type-imports` is enforced — use `import type { ... }` for types.
- **Source imports use `.js` suffix** (NodeNext ESM resolution), even though sources are `.ts`. Match the existing style in `index.ts` / `public-api.ts`.
- **Conventional Commits** for commit messages (see recent `git log`).
- The library uses `@spearwolf/eventize` and `@spearwolf/signalize` heavily; if you touch event-emitter or signal/effect code, the corresponding `using-eventize` / `using-signalize` skills apply.
- Scripts in `scripts/` (`makePackageJson.mjs`, `makeBanner.mjs`, `publishNpmPkg.mjs`) are part of the build pipeline — changes there can break publish output.
