# AGENTS.md

`twopoint5d` is a TypeScript toolkit for 2.5D rendering with three.js — lots of 2D
sprites and billboards in a 3D scene. It is not a three.js wrapper; it adds features to
existing three.js projects. Nx + pnpm workspaces monorepo, ESM only.

This file is the agent context for the whole repo. It holds what you would otherwise
have to dig for. Everything else is in the linked docs, read them when the task needs
them.

## Projects

| Path | Role |
| --- | --- |
| `packages/twopoint5d` | the published library `@spearwolf/twopoint5d` — almost all work happens here |
| `packages/twopoint5d-testing` | browser/WebGL integration tests, kept out of the library so it stays Vitest-only |
| `apps/lookbook` | Astro showcase and de-facto live documentation |

Nx tags select projects in the root scripts: `twopoint5d` (library + browser harness),
`ci` (Vitest suite), `browser` (Playwright suite), `app` (lookbook). A project without
tags silently drops out of every `--projects=tag:…` run.

The repo root also carries large generated files — `audit.html`, `remediation-plan.md`.
Do not read them unless the task is about them.

## Commands

All from the repo root. Node ≥24, pnpm ≥10.22 (`engines` in `package.json`).

- `pnpm install`
- `pnpm lint` — ESLint + `prettier --check`; `pnpm format` writes the Prettier changes
- `pnpm build` — everything; `pnpm build:twopoint5d` — the library only
- `pnpm test` — everything; `pnpm test:ci` — Vitest only, no browser;
  `pnpm test:browser` — Playwright only; `pnpm test:affected` — Nx affected graph
- one Vitest file: `pnpm nx test twopoint5d -- src/path/to/file.spec.ts`
- `pnpm typecheck` — the library *including* its specs, which `pnpm build` skips, plus
  the lookbook's `.ts` and `.astro` files
- `pnpm lookbook` — Astro dev server at <http://localhost:4321/lookbook>
- `pnpm run ci` (alias `pnpm cbt`) — the full gate: clean, lint, build, typecheck,
  checkPkgTypes, checkNameableTypes, lintPkg, test:ci, test:browser. Run it before
  committing.

Never run `pnpm publishNpmPkg` or anything in `scripts/publishNpmPkg.mjs` without an
explicit instruction.

## Rules you cannot read off the code

- **Public surface.** `packages/twopoint5d/src/index.ts` re-exports each module's
  `public-api.ts`. Anything not re-exported there is internal, and a new public symbol
  is not published until you add it to its module's `public-api.ts`.
- **Imports.** Relative imports carry the `.js` suffix (NodeNext) even though the
  sources are `.ts`. Types use `import type` — lint enforces it.
- **Shared dependency versions.** `three`, `@types/three`, `@spearwolf/eventize`,
  `@spearwolf/signalize` are pinned in the `catalog:` block of `pnpm-workspace.yaml`.
  Bump them there, never in an individual `package.json`. They are peer dependencies of
  the library.
- **Publishing** happens from the generated `dist/`, never from
  `packages/twopoint5d/`. `scripts/` is the publish pipeline — changes there can break
  the published package.
- **`dispose()` and ownership** follow
  [the resource lifecycle rules](packages/twopoint5d/docs/resource-lifecycle.md). They
  are binding, not advisory.
- **Two test surfaces.** `*.spec.ts` next to the source (Vitest, logic) and
  `*.test.js` in `packages/twopoint5d-testing/test/` (real browsers, visual/WebGL). A
  change to rendering or GPU-buffer code needs both.
- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
  Code, comments and docs are written in English.

## Working on the library

Read a module's sources whole instead of grepping symbol by symbol. The modules are
small enough for it — `map2d` is the largest at roughly 3.4k lines, most stay under 2k,
and `cat src/<module>/*.ts` is one cheap call. The pooled-buffer, signal and ownership
plumbing only makes sense in one piece; assembling it from grep hits is how wrong
assumptions get in.

`@spearwolf/eventize` and `@spearwolf/signalize` are used heavily. The `using-eventize`
and `using-signalize` skills carry the semantics that differ from other event and
signal libraries.

## Deeper docs

- [Library architecture](packages/twopoint5d/docs/architecture.md) — layers, the
  vertex-object core, what each module owns
- [Resource lifecycle](packages/twopoint5d/docs/resource-lifecycle.md) — `dispose()` and ownership
- [Stage layer cheat-sheet](packages/twopoint5d/src/stage/README.md) — `Display` + `Stage2D` + `StageRenderer` idioms
- [Monorepo architecture](docs/architecture.md) — Nx targets and caching, the build and
  publish pipeline, the CI gate
