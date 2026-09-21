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

`twopoint5d-testing` and `lookbook` both depend on the library through `workspace:*`, so
`dependsOn: ["^build"]` makes any test or dev-server run compile the library first.

Tags are how the root scripts select projects (`--projects=tag:ci`). A project without
tags does not error — it silently drops out of every tagged run. Give every new project
at least one tag.

## 2. Nx targets

`targetDefaults` in `nx.json` sets the shared behaviour:

- `build` — depends on `^build`, caches `{projectRoot}/dist`.
- `test` — depends on `^build`, cached. `namedInputs.vitestDefaults` lists what
  invalidates a Vitest run (config, `package.json`, the shared tsconfigs, the vitest
  binaries themselves, and the packages that specs and tested code load at runtime:
  `three`, `@spearwolf/eventize`, `@spearwolf/signalize`, `sinon`). A spec that imports
  a package outside that list adds it there; otherwise a bump of that package leaves an
  old result standing in the cache. `test` measures no coverage, so a run over a single
  spec is not held to thresholds meant for the whole suite.
- `typecheck` — cached, runs the project's own `typecheck` script.
- `checkPkgTypes`, `checkNameableTypes`, `lintPkg`, `publishNpmPkg` — all depend on
  `build` and are deliberately uncached, since they inspect build output.

The library's `project.json` adds the target `coverage`, which no other project has: the
same Vitest run as `test` with `--coverage`, cached with the inputs of `test`. Its
output is `{projectRoot}/coverage`, which the CI workflow archives.

Per-project `inputs` narrow the cache key further. The library's `build` input list
excludes `*.spec.ts` — specs do not invalidate a build, which is also why `pnpm build`
alone never type-checks the tests and `pnpm typecheck` exists separately.

The consumers of the library — `twopoint5d-testing:test`, `lookbook:build` and
`lookbook:typecheck` — take its build output as input (`{"dependentTasksOutputFiles":
"**/*", "transitive": true}`), not its sources. They import it only as
`@spearwolf/twopoint5d`, that is from `dist/`, so a change to the library's specs, docs
or CHANGELOG leaves them in the cache, and a changed `dist/` does not.

`twopoint5d-testing:typecheck` is the one consumer that also reads Markdown, so for it a
Markdown file is an input. It checks the browser tests through the package's own
`tsconfig.json` (`checkJs`, with `noImplicitAny` and `strictNullChecks` off) and every
code block marked `ts check` through `scripts/checkDocSnippets.mjs`, both against the
library's build output. Its inputs are that build output, the tests, the tsconfig,
`package.json`, the modules of the check and every `*.md` of the repository: a marked
block can sit in any of them, and one that stops compiling has to turn the target red.

Named inputs worth knowing: `sharedTsconfigs` (root + project tsconfig),
`makePackageJson` (everything that feeds the publish manifest, the root `package.json`
included — change any of it and the library rebuilds).

## 3. The CI gate

`pnpm run ci` (alias `pnpm cbt`) chains:

```
clean → lint → build → typecheck → checkPkgTypes → checkNameableTypes → lintPkg → test:scripts → test:coverage → test:browser
```

- `lint` = `eslint .` plus `prettier --check .`; `no-console` is an error in `.ts`,
  `.js` and `.astro` files. The `.ts` rules (`consistent-type-imports`, the ban on a
  `.ts` suffix in a relative import) apply to `.astro` files as well: to the frontmatter
  directly, and to every `<script>` block, because `eslint-plugin-astro` hands each
  block to ESLint as a virtual `.ts` file.
- `typecheck` covers the library including its specs, the lookbook — its `.ts` files and
  its `.astro` pages, via `astro check` — the browser tests of `twopoint5d-testing`, and
  every code block marked `ts check` in the tracked Markdown files. The tests and the
  blocks are checked against the built library.
- `checkPkgTypes` runs Are-The-Types-Wrong against the built `dist/`.
- `checkNameableTypes` (`scripts/checkNameableTypes.mjs`) walks `dist/lib/index.d.ts`
  and fails on published declarations that reference a type consumers cannot name.
  `attw` and `publint` resolve such a type structurally and stay quiet, which is exactly
  why this check exists.
- `lintPkg` runs publint against `dist/` and fails as soon as `dist/package.json`
  declares `dependencies` or `optionalDependencies`. The library reaches its consumers
  with peer dependencies only, and the non-blocking audit step in CI relies on that (see
  below).
- `test:scripts` runs `node --test` over `scripts/**/*.test.mjs`, the specs of the
  publish pipeline's helpers and of `makePackageJson.mjs` itself (§4, §6), of the CI
  cache server and of the helpers of the code block check.
- `test:coverage` runs the library's Vitest suite once, with coverage, against the
  thresholds in `packages/twopoint5d/vite.config.ts`. `test:ci` is not part of the gate:
  it runs the same specs without coverage. The thresholds sit two points under the level
  measured when they were set, globally and per module: the measured percentage rounded
  down, minus two. A regression turns the gate red, a line that moves does not.
  `controls` and `display` carry no threshold of their own; the browser suite exercises
  them and is not measured.

### In CI

`.github/workflows/ci.yml` runs the gate on every push. Every action is pinned to a full
commit SHA with a `# vX.Y.Z` comment naming the release, so a moved tag cannot swap the
code that runs. The workflow reads `contents` only. Its concurrency group is the branch,
so a newer push cancels the running or waiting run of the same branch — except on
`main`, where the group is the commit: every commit there gets its own run, which
nothing cancels, because `deploy.yml` follows each successful one.

The step `Audit dependencies` follows the install and runs `pnpm audit
--audit-level=high`. It reports high and critical advisories without failing the run:
the published package declares peer dependencies only (`lintPkg` holds that), so
whatever the audit finds sits in tooling, and Dependabot proposes the update that fixes
it (§5). Dependabot also keeps the commit SHAs of the actions, and the version comment
next to each, current.

The browser suite writes one line per browser and run into the "Browser logs" of the
test output: `[renderer-backend] <WebGPU|WebGL2> on <browser>/<version>`, from
`packages/twopoint5d-testing/test/renderer-backend.test.js`. Measured locally with
Playwright 1.63.0, Chromium 153 runs on WebGL2 (three reports `WebGPU is not available,
running under WebGL2 backend`) and Firefox 155 on WebGPU (`dom.webgpu.enabled` in
`web-test-runner.config.js`). What CI gets is in the log of the CI run.

The Playwright browsers are cached under the key `playwright-<os>-<version>`, the
version being what `pnpm exec playwright --version` reports from the root package. A hit
still runs `playwright install-deps`, since the cache holds the browsers and not the
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
followed by `scripts/makePackageJson.mjs`. The build writes neither declaration maps nor
source maps, because both would point at `src/`, which the package does not contain. In
the workspace, "Go to definition" from the lookbook or the testing package into the
library lands in `dist/lib/*.d.ts`, and the browser shows its `.js`.

`makePackageJson.mjs` synthesizes the publish-time manifest from the source
`package.json` merged with `package.override.json`. The override file's `null` entries
strip development-only fields (`scripts`, `devDependencies`) from what ships. Specifiers
are resolved to real ranges: `catalog:` and `catalog:<name>` from the default or the
named catalog in `pnpm-workspace.yaml`; `workspace:` from the `package.json` of the
package it names (`workspace:^` and `workspace:~` keep their operator, `workspace:*`
becomes a caret range, a spelled-out range ships as it is written, only without the
whitespace around it and not in the form semver normalizes it to — but only if it is a
version range; anything else, a range of nothing but whitespace included, leaves the
specifier standing). A `package.json` there that cannot be read, or whose version semver
cannot read, leaves the specifier standing as well. If a `catalog:` or `workspace:`
specifier is left in the manifest afterwards, the build fails — npm installs neither
protocol. The script writes `dist/package.json` only into an existing `dist/` and stops
without the compiled library, with the hint to compile first; an input file it cannot
read stops it with the path and the reason. Since `dist/` is what gets published,
`main`, `module`, `types` and every target in `exports` lose a leading `dist/` or
`./dist/`; a `dist/` further inside a path is part of the name and stays.

The logic of both scripts lives in `scripts/makePackageJson/` and
`scripts/publishNpmPkg/`, next to its `node --test` specs; the scripts themselves only
wire it up.

The publishable artifact is therefore `dist/`, not the source package directory.
`publishNpmPkg` runs `checkPkgTypes`, `lintPkg` and `checkNameableTypes` first and then
publishes `dist/`. It skips a version npm already lists and takes npm's `E404` for a
first publish. Before `npm publish` it copies `LICENSE` from the workspace root, and
`CHANGELOG.md` and the README from the directory it is started in, into the package
directory; the README is `README-pkg.md`, or `README.md` if there is none, and ships as
`README.md`. A workspace `.npmrc` goes along if there is one. `publishNpmPkg.mjs
<package-dir> [--dry-run]` stops with a usage line and exit code 1 on a missing
directory and on any other option — a misspelled `--dry-run` included — before it asks
npm. npm is asked with `npm show .` in the package directory, so the name comes from the
manifest that `npm publish` reads there and no value from it stands on a command line.
npm runs without a shell; on Windows, where `npm` is an `npm.cmd` that Node starts only
through `cmd.exe`, it runs as a single string of literals, and an argument with any
character besides letters, digits and `_ @ . / -` is refused on every platform. Every
failure — a manifest that is unreadable or has no `name` or `version`, one of those
three files that is missing, an npm that is missing or fails — ends with one line and
exit code 1, and what `npm publish` itself prints goes straight to the console. Never
publish from `packages/twopoint5d/` and never run these scripts without being asked to.

`.github/workflows/deploy.yml` runs after every successful CI run on `main`. Both jobs
check out `github.event.workflow_run.head_sha`, the commit that CI run tested: `main`
may have moved on while CI ran, and a newer commit gets a CI run and a deploy of its
own. They run only for a CI run triggered by a push to this repository, the one kind of
run that may name the commit to publish. The first job asks npm whether the manifest
version is published already, or whether it ends in `-dev`; only if neither holds does
the second job install, build and run `publishNpmPkg`. It authenticates through npm
Trusted Publishing (OIDC, with `id-token: write` granted to the publish job only), so
there is no npm token. Releases carry SLSA provenance and name `GitHub Actions
<npm-oidc-no-reply@github.com>` as their publisher, the first being 0.21.2.

Changes under `scripts/` are changes to the publish pipeline. Treat them accordingly.
The exception is `scripts/ci/`, which only the CI workflow runs.

## 5. Shared dependency versions

`three`, `@types/three`, `@spearwolf/eventize` and `@spearwolf/signalize` are pinned in
the `catalog:` block of `pnpm-workspace.yaml`. Individual `package.json` files reference
them as `"catalog:"`, so a version bump happens in exactly one place and stays
consistent across library, test harness and lookbook. In the library they are
`peerDependencies`.

`.github/dependabot.yml` has Dependabot look at `npm` and `github-actions` once a week.
The minor and patch updates of the toolchain arrive as one pull request, the group
`toolchain`. The four catalog entries stay out of it: a jump of `three` moves the peer
range of the library and needs a review of its own, so each of them, and every major
update, comes as a pull request by itself. `playwright` stays out of the group as well:
each of its updates brings the Chromium and Firefox the browser suite runs on, so it
comes as a pull request of its own. Overrides live in `pnpm-workspace.yaml`. Each one
carries a comment that names the advisory it answers and says when the entry can go.

`@emnapi/core` and `@emnapi/runtime` are root devDependencies that nothing imports. They
are peers of `@napi-rs/wasm-runtime`, which `eslint-plugin-astro` pulls in through the
WebAssembly build of the Astro compiler. Left undeclared, pnpm resolves that peer one
way or the other from run to run: an install that re-resolves on top of the lockfile —
after any manifest change, in every Dependabot update — rewrites about 40 lines of
`pnpm-lock.yaml` and warns about a missing peer, and a resolution from scratch lands on
either form. Declared, every resolution writes the same lockfile. They can go once `pnpm
install --lockfile-only --resolution-only` leaves the lockfile untouched and warns about
nothing without them.

Node and pnpm versions come from `engines` in the root `package.json`: Node
`^24.16.0 || >=26.3.0` — the 25.x line is out — and pnpm `>=10.22.0`. The exact pnpm is
`packageManager` in the root `package.json`; `pnpm/action-setup` in both workflows reads
it from there and names no version of its own. `.nvmrc`, `mise.toml` and the
`node-version` of the CI workflows name a plain `24`. They answer which version to
install, not which ones are allowed, and none of them understands an alternative like
`||`; a `24` picks the newest 24.x the tool can get and lands inside the range, while a
narrower `24.16` would pin the minor line and cut the repo off from later 24.x releases.

## 6. Test surfaces

Two runners, deliberately in separate packages:

- Vitest in `packages/twopoint5d` (tag `ci`) — unit and logic tests as `*.spec.ts` next
  to the source. No browser dependencies in the library package.
- `@web/test-runner` with Playwright Chromium and Firefox in
  `packages/twopoint5d-testing` (tag `browser`) — `*.test.js` under `test/`, for
  anything that needs a real GPU context. `pnpm install` downloads no browsers; they
  come from `pnpm exec playwright install chromium firefox`. The `*.test.js` files are
  type-checked with `checkJs` (`pnpm typecheck`); a fixture that needs a type gets it
  from JSDoc — vertex object interfaces, descriptions.

A browser test that disposes a display in its teardown calls `stopAndDrain()` from
`packages/twopoint5d-testing/test/support/stopAndDrain.js` right before `dispose()`: it
stops the display and waits until the GPU has run everything submitted to it. On Firefox
155 under WebGPU, destroying a device while submitted work is still in flight reports a
`GPUInternalError` on that device and ends `requestAnimationFrame` for the whole page,
and every later test in the file waits for a frame until it times out. A test whose
subject is `dispose()` itself calls it without the helper. Once Firefox takes such a
device down without stalling, the calls can go; `pnpm test:browser` without them shows
when.

The helpers of the publish pipeline, the CI cache server and the code block check run
under `node --test` (`pnpm test:scripts`); no Nx project owns them. One spec starts
`makePackageJson.mjs` itself, as a child process in a throwaway project directory,
because its exit codes, its messages and the manifest it does not write are wiring that
no helper test sees. No spec runs `publishNpmPkg.mjs`, which queries the registry as
soon as its arguments fit, nor `checkDocSnippets.mjs`, which reads git and the file
system.

`pnpm test:affected` uses the Nx graph and `defaultBase: main`.

## 7. Lookbook

Astro app, and the de-facto live documentation. `astro.config.mjs` sets `base` to
`/lookbook`, so the dev server serves it at <http://localhost:4321/lookbook>, not at the
root. It builds against the compiled library, so a library change needs a rebuild
(`dependsOn: ["^build"]` on `dev`/`start` handles that for the Nx targets).
