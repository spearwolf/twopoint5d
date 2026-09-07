# Monorepo architecture

How this workspace is wired: what Nx runs, how the published package is assembled, and
which knobs break things when turned. The library's own architecture is
[`packages/twopoint5d/docs/architecture.md`](../packages/twopoint5d/docs/architecture.md).

## 1. Projects and the dependency graph

pnpm workspaces (`pnpm-workspace.yaml`) define the packages, Nx (`nx.json` plus a
`project.json` per project) defines the task graph.

| Project | Path | Tags | Role |
| --- | --- | --- | --- |
| `twopoint5d` | `packages/twopoint5d` | `ci`, `twopoint5d` | the published library |
| `twopoint5d-testing` | `packages/twopoint5d-testing` | `browser`, `twopoint5d` | browser/WebGL integration tests |
| `lookbook` | `apps/lookbook` | `app` | Astro showcase |

`twopoint5d-testing` and `lookbook` both depend on the library through
`workspace:*`, so `dependsOn: ["^build"]` makes any test or dev-server run compile the
library first.

Tags are how the root scripts select projects (`--projects=tag:ci`). A project without
tags does not error — it silently drops out of every tagged run. Give every new project
at least one tag.

## 2. Nx targets

`targetDefaults` in `nx.json` sets the shared behaviour:

- `build` — depends on `^build`, caches `{projectRoot}/dist`.
- `test` — depends on `^build`, cached. `namedInputs.vitestDefaults` lists what
  invalidates a Vitest run (config, `package.json`, the shared tsconfigs, the vitest
  binaries themselves).
- `typecheck` — cached, runs the project's own `typecheck` script.
- `checkPkgTypes`, `checkNameableTypes`, `lintPkg`, `publishNpmPkg` — all depend on
  `build` and are deliberately uncached, since they inspect build output.

Per-project `inputs` narrow the cache key further. The library's `build` input list
excludes `*.spec.ts` — specs do not invalidate a build, which is also why
`pnpm build` alone never type-checks the tests and `pnpm typecheck` exists separately.

Named inputs worth knowing: `sharedTsconfigs` (root + project tsconfig),
`makePackageJson` (everything that feeds the publish manifest — change any of it and
the library rebuilds).

## 3. The CI gate

`pnpm run ci` (alias `pnpm cbt`) chains:

```
clean → lint → build → typecheck → checkPkgTypes → checkNameableTypes → lintPkg → test:ci → test:browser
```

- `lint` = `eslint .` plus `prettier --check .`; `no-console` is an error in `.ts`/`.js`.
- `typecheck` covers the library including its specs, and the lookbook — its `.ts`
  files and its `.astro` pages, via `astro check`.
- `checkPkgTypes` runs Are-The-Types-Wrong against the built `dist/`.
- `checkNameableTypes` (`scripts/checkNameableTypes.mjs`) walks `dist/lib/index.d.ts`
  and fails on published declarations that reference a type consumers cannot name.
  `attw` and `publint` resolve such a type structurally and stay quiet, which is
  exactly why this check exists.
- `lintPkg` runs publint against `dist/`.

## 4. Build and publish pipeline

`packages/twopoint5d`'s `build` is `tsc -p tsconfig.build.json` into `dist/lib/`,
followed by `scripts/makePackageJson.mjs`.

`makePackageJson.mjs` synthesizes the publish-time manifest from the source
`package.json` merged with `package.override.json`. The override file's `null` entries
strip development-only fields (`scripts`, `devDependencies`, tool configs) from what
ships, and `catalog:` versions are resolved to real ranges from
`pnpm-workspace.yaml`. `scripts/makeBanner.mjs` builds the version banner.

The publishable artifact is therefore `dist/`, not the source package directory.
`publishNpmPkg` runs `checkPkgTypes`, `lintPkg` and `checkNameableTypes` first and then
publishes `dist/`. Never publish from `packages/twopoint5d/` and never run these
scripts without being asked to.

Changes under `scripts/` are changes to the publish pipeline. Treat them accordingly.

## 5. Shared dependency versions

`three`, `@types/three`, `@spearwolf/eventize` and `@spearwolf/signalize` are pinned in
the `catalog:` block of `pnpm-workspace.yaml`. Individual `package.json` files reference
them as `"catalog:"`, so a version bump happens in exactly one place and stays
consistent across library, test harness and lookbook. In the library they are
`peerDependencies`.

Node and pnpm versions come from `engines` in the root `package.json`; `.nvmrc` and
`mise.toml` repeat the same numbers for version managers.

## 6. Test surfaces

Two runners, deliberately in separate packages:

- Vitest in `packages/twopoint5d` (tag `ci`) — unit and logic tests as `*.spec.ts` next
  to the source. No browser dependencies in the library package.
- `@web/test-runner` with Playwright Chromium and Firefox in
  `packages/twopoint5d-testing` (tag `browser`) — `*.test.js` under `test/`, for
  anything that needs a real GPU context. Its `postinstall` installs the browsers.

`pnpm test:affected` uses the Nx graph and `defaultBase: main`.

## 7. Lookbook

Astro app, and the de-facto live documentation. `astro.config.mjs` sets `base` to
`/lookbook`, so the dev server serves it at <http://localhost:4321/lookbook>, not at
the root. It builds against the compiled library, so a library change needs a rebuild
(`dependsOn: ["^build"]` on `dev`/`start` handles that for the Nx targets).
