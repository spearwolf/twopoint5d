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
  binaries themselves, and the packages that specs and tested code load at runtime: `three`,
  `@spearwolf/eventize`, `@spearwolf/signalize`, `sinon`). A spec that imports a package
  outside that list adds it there; otherwise a bump of that package leaves an old result
  standing in the cache.
- `typecheck` — cached, runs the project's own `typecheck` script.
- `checkPkgTypes`, `checkNameableTypes`, `lintPkg`, `publishNpmPkg` — all depend on
  `build` and are deliberately uncached, since they inspect build output.

Per-project `inputs` narrow the cache key further. The library's `build` input list
excludes `*.spec.ts` — specs do not invalidate a build, which is also why
`pnpm build` alone never type-checks the tests and `pnpm typecheck` exists separately.

The consumers of the library — `twopoint5d-testing:test`, `lookbook:build` and
`lookbook:typecheck` — take its build output as input
(`{"dependentTasksOutputFiles": "**/*", "transitive": true}`), not its sources. They
import it only as `@spearwolf/twopoint5d`, that is from `dist/`, so a change to the
library's specs, docs or CHANGELOG leaves them in the cache, and a changed `dist/` does
not.

Named inputs worth knowing: `sharedTsconfigs` (root + project tsconfig),
`makePackageJson` (everything that feeds the publish manifest, the root `package.json`
included — change any of it and the library rebuilds).

## 3. The CI gate

`pnpm run ci` (alias `pnpm cbt`) chains:

```
clean → lint → build → typecheck → checkPkgTypes → checkNameableTypes → lintPkg → test:scripts → test:ci → test:browser
```

- `lint` = `eslint .` plus `prettier --check .`; `no-console` is an error in `.ts`/`.js`
  and in the `<script>` blocks of `.astro` files (`eslint-plugin-astro` hands each block to
  ESLint as a virtual `.ts` file, so the `.ts` rules apply there too).
- `typecheck` covers the library including its specs, and the lookbook — its `.ts`
  files and its `.astro` pages, via `astro check`.
- `checkPkgTypes` runs Are-The-Types-Wrong against the built `dist/`.
- `checkNameableTypes` (`scripts/checkNameableTypes.mjs`) walks `dist/lib/index.d.ts`
  and fails on published declarations that reference a type consumers cannot name.
  `attw` and `publint` resolve such a type structurally and stay quiet, which is
  exactly why this check exists.
- `lintPkg` runs publint against `dist/`.
- `test:scripts` runs `node --test` over `scripts/**/*.test.mjs`, the specs of the publish
  pipeline's helpers (§4) and of the CI cache server.

### In CI

`.github/workflows/ci.yml` runs the gate on every push. Every action is pinned to a full
commit SHA with a `# vX.Y.Z` comment naming the release, so a moved tag cannot swap the
code that runs. The workflow reads `contents` only. Its concurrency group is the branch,
so a newer push cancels the running or waiting run of the same branch — except on
`main`, where the group is the commit: every commit there gets its own run, which
nothing cancels, because `deploy.yml` follows each successful one.

The Playwright browsers are cached under the key `playwright-<os>-<version>`, the
version being what `pnpm exec playwright --version` reports from the root package. A
hit still runs `playwright install-deps`, since the cache holds the browsers and not the
system libraries they link against. The key follows the root `playwright`, so the root
`playwright` and the one `@web/test-runner-playwright` resolves have to be the same
version.

Nx indexes its local cache in a database named after the machine id, and every runner
comes with a new one, so a restored Nx cache directory would never hit. Nx does take
results from a self-hosted remote cache, so the job starts
`scripts/ci/nxCacheServer.mjs` on `127.0.0.1:47873`, serving `$RUNNER_TEMP/nx-cache`
with a random per-run token, and hands `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` and
`NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` to every later step. `actions/cache` restores
that directory under `nx-<os>-<hash of pnpm-lock.yaml>-<commit sha>`, falling back to
the newest entry of the same lockfile and then to the newest entry at all. The server
touches every entry it serves. After a green gate the job deletes each entry older than
the server start — what this run neither used nor wrote — and saves the directory under
the commit's key, so each saved state holds exactly the results of one green commit and
does not grow from run to run. A red run saves nothing, and the next run restores the
last green state.

The cache is only as trustworthy as what writes to it: its entries come solely from CI
runs on pushes to this repository. `deploy.yml` does not use it and builds the published
package from source.

## 4. Build and publish pipeline

`packages/twopoint5d`'s `build` is `tsc -p tsconfig.build.json` into `dist/lib/`,
followed by `scripts/makePackageJson.mjs`.

`makePackageJson.mjs` synthesizes the publish-time manifest from the source
`package.json` merged with `package.override.json`. The override file's `null` entries
strip development-only fields (`scripts`, `devDependencies`) from what
ships. Specifiers are resolved to real ranges: `catalog:` and `catalog:<name>` from the
default or the named catalog in `pnpm-workspace.yaml`; `workspace:` from the
`package.json` of the package it names (`workspace:^` and `workspace:~` keep their
operator, `workspace:*` becomes a caret range, a spelled-out range ships as it is — but
only if it is a version range, and anything else leaves the specifier standing). If a
`catalog:` or `workspace:` specifier is left in the manifest afterwards, the build
fails — npm installs neither protocol. Since `dist/` is what gets
published, `main`, `module`, `types` and every target in `exports` lose a leading
`dist/` or `./dist/`; a `dist/` further inside a path is part of the name and
stays.

The logic of both scripts lives in `scripts/makePackageJson/` and
`scripts/publishNpmPkg/`, next to its `node --test` specs; the scripts themselves only
wire it up.

The publishable artifact is therefore `dist/`, not the source package directory.
`publishNpmPkg` runs `checkPkgTypes`, `lintPkg` and `checkNameableTypes` first and then
publishes `dist/`. It skips a version npm already lists and takes npm's `E404` for a
first publish. Never publish from `packages/twopoint5d/` and never run these
scripts without being asked to.

`.github/workflows/deploy.yml` runs after every successful CI run on `main`. Its first
job asks npm whether the manifest version is published already, or whether it ends in
`-dev`; only if neither holds does the second job install, build and run
`publishNpmPkg`. It authenticates through npm Trusted Publishing (OIDC, with
`id-token: write` granted to the publish job only), so there is no npm token. Releases
carry SLSA provenance and name `GitHub Actions <npm-oidc-no-reply@github.com>` as their
publisher, the first being 0.21.2.

Changes under `scripts/` are changes to the publish pipeline. Treat them accordingly.
The exception is `scripts/ci/`, which only the CI workflow runs.

## 5. Shared dependency versions

`three`, `@types/three`, `@spearwolf/eventize` and `@spearwolf/signalize` are pinned in
the `catalog:` block of `pnpm-workspace.yaml`. Individual `package.json` files reference
them as `"catalog:"`, so a version bump happens in exactly one place and stays
consistent across library, test harness and lookbook. In the library they are
`peerDependencies`.

Node and pnpm versions come from `engines` in the root `package.json`: Node
`^24.16.0 || >=26.3.0` — the 25.x line is out — and pnpm `>=10.22.0`. `.nvmrc`,
`mise.toml` and the `node-version` of the CI workflows name a plain `24`. They answer
which version to install, not which ones are allowed, and none of them understands an
alternative like `||`; a `24` picks the newest 24.x the tool can get and lands inside
the range, while a narrower `24.16` would pin the minor line and cut the repo off from
later 24.x releases.

## 6. Test surfaces

Two runners, deliberately in separate packages:

- Vitest in `packages/twopoint5d` (tag `ci`) — unit and logic tests as `*.spec.ts` next
  to the source. No browser dependencies in the library package.
- `@web/test-runner` with Playwright Chromium and Firefox in
  `packages/twopoint5d-testing` (tag `browser`) — `*.test.js` under `test/`, for
  anything that needs a real GPU context. `pnpm install` downloads no browsers; they come
  from `pnpm exec playwright install chromium firefox`.

The helpers of the publish pipeline and the CI cache server run under `node --test`
(`pnpm test:scripts`); no Nx project owns them. Their specs import only the helper modules, never
`publishNpmPkg.mjs`, which queries the registry as soon as it loads.

`pnpm test:affected` uses the Nx graph and `defaultBase: main`.

## 7. Lookbook

Astro app, and the de-facto live documentation. `astro.config.mjs` sets `base` to
`/lookbook`, so the dev server serves it at <http://localhost:4321/lookbook>, not at
the root. It builds against the compiled library, so a library change needs a rebuild
(`dependsOn: ["^build"]` on `dev`/`start` handles that for the Nx targets).
