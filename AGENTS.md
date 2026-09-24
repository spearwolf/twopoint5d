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
| `packages/twopoint5d-testing` | browser/WebGL integration tests, kept out of the library so it stays Vitest-only, and the type check of the docs' marked code blocks |
| `apps/lookbook` | Astro showcase and de-facto live documentation |

Nx tags select projects in the root scripts: `twopoint5d` (library + browser harness),
`ci` (Vitest suite), `browser` (Playwright suite), `app` (lookbook). A project without
tags silently drops out of every `--projects=tag:…` run.

The repo root also carries large generated files — `audit.html`, `remediation-plan.md`.
Do not read them unless the task is about them.

## Commands

All from the repo root. Node `^24.16.0 || >=26.3.0` (no 25.x), pnpm `>=10.22.0` — `engines` in `package.json`.

- `pnpm install`
- `pnpm exec playwright install chromium firefox` — the browsers for `pnpm test:browser`; once
  after the first install and after every Playwright bump
- `pnpm lint` — ESLint + `prettier --check`; `pnpm format` writes the Prettier changes
- `pnpm build` — everything; `pnpm build:twopoint5d` — the library only
- `pnpm test` — everything; `pnpm test:ci` — Vitest only, no browser;
  `pnpm test:browser` — Playwright only; `pnpm test:affected` — Nx affected graph
- `pnpm test:coverage` — the library's Vitest suite once with coverage, held to the
  thresholds in `packages/twopoint5d/vite.config.ts`; `pnpm test`, `pnpm test:ci` and a
  single-file run measure nothing
- `pnpm test:scripts` — `node --test` over the helpers of the publish pipeline, the CI
  cache server and the docs' code block check (`scripts/**/*.test.mjs`), plus specs that
  start `makePackageJson.mjs` and `checkPeerDependenciesOnly.mjs` as child processes, one
  that checks the lookbook's vendored `rainbow-line` script, and one that asks Nx whether
  every tracked Markdown file is an input of the docs' type check; no Nx project owns
  them, so `pnpm test` does not run them
- one Vitest file: `pnpm nx test twopoint5d -- src/path/to/file.spec.ts`
- `pnpm typecheck` — the library *including* its specs, which `pnpm build` skips, plus
  the lookbook's `.ts` and `.astro` files, the browser tests, and every code block marked
  `ts check` in the Markdown files; the tests and the blocks are checked against the built
  library
- `pnpm lookbook` — Astro dev server at <http://localhost:4321/lookbook>
- `pnpm run ci` (alias `pnpm cbt`) — the full gate: clean, lint, build, typecheck,
  checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser. Run
  it before committing.

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
- **`@emnapi/core` and `@emnapi/runtime`** in the root `devDependencies` are imported by
  nothing and stay: they hold `pnpm-lock.yaml` to one resolution
  ([monorepo architecture §5](docs/architecture.md#5-shared-dependency-versions)).
- **`apps/lookbook/public/js/rainbow-line-v0.4.0.js`** is the web component behind every
  `RainbowLine` from `@spearwolf/astro-rainbow-line`. That component emits
  `<script src="${BASE_URL}/js/rainbow-line-v0.4.0.js">` at runtime and expects the file
  in `public/` — it ships a copy but does not serve it. The only reference lives inside
  `node_modules`, so a grep of the repo finds nothing; the file is not dead weight and
  stays. Keep it byte-for-byte identical to the package's copy, and replace it when a
  package bump changes the version in that path —
  `scripts/lookbook/rainbowLineScript.test.mjs` (`pnpm test:scripts`) fails otherwise.
  The `.prettierignore` entry and the `**/lookbook/public` ignore in `eslint.config.mjs`
  exist for it and stay too.
- **Publishing** happens from the generated `dist/`, never from
  `packages/twopoint5d/`. `scripts/` is the publish pipeline — changes there can break
  the published package. `scripts/ci/` and `scripts/checkDocSnippets*` are the exceptions:
  the Nx cache server of the CI workflow, and the check of the docs' code blocks, which
  publishes nothing.
- **`dispose()` and ownership** follow
  [the resource lifecycle rules](packages/twopoint5d/docs/resource-lifecycle.md). They
  are binding, not advisory.
- **Two test surfaces.** `*.spec.ts` next to the source (Vitest, logic) and
  `*.test.js` in `packages/twopoint5d-testing/test/` (real browsers, visual/WebGL). A
  change to rendering or GPU-buffer code needs both.
  The browser tests share their fixtures through
  `packages/twopoint5d-testing/test/helpers/fixtures.js`; a helper that a second
  test file needs goes there, not into both.
- **Code blocks in Markdown.** A plain `ts` code block is an excerpt and nothing checks it.
  A block that stands on its own — imports everything it uses, declares everything it
  names — carries `ts check` as its info string, and `pnpm typecheck` compiles it as a
  module of its own against the built library under the root tsconfig (unused locals and
  parameters allowed). Released CHANGELOG sections are not marked after the fact; their
  blocks show the API of their release.
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
