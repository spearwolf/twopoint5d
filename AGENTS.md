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
| `packages/twopoint5d-testing` | browser integration tests, each file under WebGPU and under WebGL 2, kept out of the library so it stays Vitest-only, and the type check of the docs' marked code blocks |
| `apps/lookbook` | Astro showcase and de-facto live documentation |
| `scripts` | the Node scripts — publish pipeline, CI cache server, the checks of the repo; as an Nx project only their type check |

Nx tags select projects in the root scripts: `twopoint5d` (library + browser harness),
`ci` (Vitest suite), `browser` (Playwright suite), `app` (lookbook), `scripts` (the type
check of `scripts/`). A project without tags silently drops out of every
`--projects=tag:…` run.

The repo root also carries large generated files — `audit.html`, `remediation-plan.md`.
Do not read them unless the task is about them.

## Commands

All from the repo root. Node `^24.16.0 || >=26.3.0` (no 25.x), pnpm `>=10.22.0` —
`engines` in `package.json`.

- `pnpm install`
- `pnpm exec playwright install chromium firefox` — the browsers for
  `pnpm test:browser`; once after the first install and after every Playwright bump
- `pnpm lint` — `biome ci`: Biome's linter and formatter check, nothing written;
  `pnpm format` writes the formatting and the safe lint fixes (`biome check --write`).
  Config in `biome.jsonc`; a suppression is `// biome-ignore <rule>: <reason>`, and the
  reason is required
- `pnpm build` — everything; `pnpm build:twopoint5d` — the library only
- `pnpm test` — everything; `pnpm test:ci` — Vitest only, no browser;
  `pnpm test:browser` — Playwright only; `pnpm test:affected` — Nx affected graph
- `pnpm test:coverage` — the library's Vitest suite once with coverage, held to the
  thresholds in `packages/twopoint5d/vite.config.ts`, without the allocation specs;
  `pnpm test`, `pnpm test:ci` and a single-file run measure nothing
- `pnpm test:allocations` — the allocation specs (`src/**/hot-path-allocations*.spec.ts`)
  alone, without coverage: the Vitest project `allocations` in
  `packages/twopoint5d/vite.config.ts`, 30 s per test. `pnpm test` runs them along with
  the rest
- `pnpm bench` — the library's hot-path benchmarks (`src/**/*.bench.ts`) through
  `vitest bench`; the timings land in `packages/twopoint5d/bench-results/results.json`,
  which the nightly workflow `bench.yml` archives. Not part of `pnpm run ci` nor of the
  CI workflow: timings are archived, not held to a limit
- `pnpm test:scripts` — `node --test` over the helpers of the publish pipeline, the CI
  cache server, the docs' code block check and the Nameable-Types check
  (`scripts/**/*.test.mjs`), plus specs that start `makePackageJson.mjs`,
  `checkPeerDependenciesOnly.mjs`, `checkNameableTypes.mjs` and `nxCacheServer.mjs` as
  child processes, one that checks the lookbook's vendored `rainbow-line` script, one
  that holds the tags and routes of the lookbook's demo metadata to the library's
  exports, one that holds the preview images of the lookbook to its demos, ids and card
  size, one that holds the view-transition names of the lookbook's navbar to its two
  pages and the stylesheets to those names, one that asks Nx whether every tracked
  Markdown file is an input of the docs' type check, and one that holds the publish
  script to Node's built-ins; the Nx project `scripts` has no `test` target, so
  `pnpm test` leaves them out
- one Vitest file: `pnpm nx test twopoint5d -- src/path/to/file.spec.ts`
- `pnpm typecheck` — the library *including* its specs, which `pnpm build` skips, plus
  the lookbook's `.ts` and `.astro` files, the browser tests, the scripts under
  `scripts/` as JavaScript (`checkJs`), and every code block marked `ts check` in the
  Markdown files; the tests and the blocks are checked against the built library
- `pnpm lookbook` — Astro dev server at <http://localhost:4321/lookbook>
- `pnpm lookbook:generate-previews` — the preview image of every lookbook demo, through
  Playwright's Chromium against `astro preview`; `--only=<name>,…` for some. Not part of
  `pnpm run ci`: it needs a browser and writes binary files. The protocol is in
  `apps/lookbook/README.md`, "Preview images"
- `pnpm run ci` (alias `pnpm cbt`) — the full gate: clean, then `ci:checks` (lint,
  build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts), then
  test:coverage, test:allocations, test:browser. Run it before committing. CI runs the
  four parts as parallel jobs.

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
  the library; `@types/three` is an optional one (only a TypeScript consumer needs it).
  The catalog range lands verbatim in the published manifest, and a 0.x minor of `three`
  breaks, so `three` stays on the tilde — and every `three` bump is a release: until the
  library publishes, a consumer on the newer `three` meets a peer conflict.
- **Two TypeScripts.** `tsc` is TypeScript 7 — it builds the library and runs every type
  check outside the lookbook. TypeScript 7 exports no compiler API under `typescript`, so
  a script that needs one imports the classic API from `@typescript/typescript6`, never
  from `typescript`. The lookbook keeps its own `typescript` 6 for `astro check`, whose
  peer range ends at 6 ([monorepo architecture §5](docs/architecture.md#5-shared-dependency-versions)).
- **`apps/lookbook/public/js/rainbow-line-v0.6.0.js`** is the web component behind every
  `RainbowLine` from `@spearwolf/astro-rainbow-line`. That component emits
  `<script src="${BASE_URL}/js/rainbow-line-v0.6.0.js">` at runtime and expects the file
  in `public/` — it ships a copy but does not serve it. The only reference lives inside
  `node_modules`, so a grep of the repo finds nothing; the file is not dead weight and
  stays. Keep it byte-for-byte identical to the package's copy, and replace it when a
  package bump changes the version in that path —
  `scripts/lookbook/rainbowLineScript.test.mjs` (`pnpm test:scripts`) fails otherwise.
  The `!apps/lookbook/public/js` entry in `biome.jsonc` exists for it and stays too.
- **Publishing** happens from the generated `dist/`, never from `packages/twopoint5d/`.
  `scripts/` is the publish pipeline — changes there can break the published package.
  `scripts/ci/` and `scripts/checkDocSnippets*` are the exceptions: the Nx cache server
  of the CI workflow, and the check of the docs' code blocks, which publishes nothing.
  `scripts/publishNpmPkg.mjs` and `scripts/publishNpmPkg/` import nothing but Node's
  built-ins (`node:`) and each other, because the publish job of the deploy installs
  nothing; `builtinImportsOnly.test.mjs` fails on anything else.
- **`dispose()` and ownership** follow [the resource lifecycle
  rules](packages/twopoint5d/docs/resource-lifecycle.md). They are binding, not
  advisory.
- **Two test surfaces.** `*.spec.ts` next to the source (Vitest, logic) and `*.test.js`
  in `packages/twopoint5d-testing/test/` (real browsers, visual, every file under WebGPU
  and under WebGL 2). A change to rendering or GPU-buffer code needs both.
  A `hot-path-allocations.spec.ts` measures the heap bytes of a hot-path call through
  `measureSettledBytes()` in `src/testing/`: it collects what earlier tests left behind
  before the round warms up and answers the lowest of three measurements of
  `measureAllocatedBytes()`, which empties only the young generation before its rounds.
  The Vitest config starts its workers with `--expose-gc` for these two helpers, and
  `src/testing/` never reaches `dist/`.
  A spec that measures bytes per tile or per vertex object as the difference of two
  sizes — two views of a camera, two ranges of a pool — calls `measureAllocatedBytes()`
  directly, so that the two sizes take turns within one sequence of measurements and a
  cost that is still settling falls on both alike; `measurePerTile()` in
  `src/map2d/hot-path-allocations.tilted-view.spec.ts` shows the sequence.
  A round hands the calls it measures whole numbers, constants and objects, never a
  fractional value it works out itself: V8 boxes such a value at each call it leaves
  un-inlined, and which calls it inlines shifts with the inlining budget, which block
  coverage uses up sooner — the round would measure heap numbers of its own. Whether a
  method hands the values of its caller on without boxing them is checked by what it
  calls, as `src/sprites/hot-path-allocations.spec.ts` does for the sprite setters.
  The browser tests share their fixtures through
  `packages/twopoint5d-testing/test/helpers/fixtures.js`; a helper that a second test
  file needs goes there, not into both.
- **Code blocks in Markdown.** A plain `ts` code block is an excerpt and nothing checks
  it. A block that stands on its own — imports everything it uses, declares everything
  it names — carries `ts check` as its info string, and `pnpm typecheck` compiles it as
  a module of its own against the built library under the root tsconfig (unused locals
  and parameters allowed). Released CHANGELOG sections are not marked after the fact;
  their blocks show the API of their release.
- **Commits** follow [Conventional
  Commits](https://www.conventionalcommits.org/en/v1.0.0/). Code, comments and docs are
  written in English.

## Working on the library

Read a module's sources whole instead of grepping symbol by symbol. The modules are
small enough for it — `map2d` is the largest at roughly 3.4k lines, most stay under 2k,
and `cat src/<module>/*.ts` is one cheap call. The pooled-buffer, signal and ownership
plumbing only makes sense in one piece; assembling it from grep hits is how wrong
assumptions get in.

`@spearwolf/eventize` and `@spearwolf/signalize` are used heavily. The `using-eventize`
and `using-signalize` skills carry the semantics that differ from other event and signal
libraries.

## Deeper docs

- [Library architecture](packages/twopoint5d/docs/architecture.md) — layers, the
  vertex-object core, what each module owns
- [Resource lifecycle](packages/twopoint5d/docs/resource-lifecycle.md) — `dispose()` and
  ownership
- [Stage layer cheat-sheet](packages/twopoint5d/src/stage/README.md) — `Display` +
  `Stage2D` + `StageRenderer` idioms
- [Vertex objects](packages/twopoint5d/src/vertex-objects/README.md) — what a
  description declares and which accessors it generates
- [Monorepo architecture](docs/architecture.md) — Nx targets and caching, the build and
  publish pipeline, the CI gate
