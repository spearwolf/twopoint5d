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
| `twopoint5d-testing` | `packages/twopoint5d-testing` | `browser`, `twopoint5d` | browser integration tests, under WebGPU and WebGL 2 |
| `lookbook` | `apps/lookbook` | `app` | Astro showcase |
| `scripts` | `scripts` | `scripts` | the Node scripts; as a project only their type check |

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
- `typecheck` — cached, runs the project's own `typecheck` script. `scripts` has no
  manifest: its `project.json` calls `tsc` through `nx:run-commands` and names its
  inputs itself.
- `checkPkgTypes`, `checkNameableTypes`, `lintPkg`, `publishNpmPkg` — all depend on
  `build` and are deliberately uncached, since they inspect build output.

The library's Vitest config splits its specs into two projects: `allocations`, the
allocation specs (`src/**/hot-path-allocations*.spec.ts`) with 30 seconds per test, and
`specs`, everything else. `test` runs both. The allocation specs measure heap bytes over
tens of thousands of hot-path calls; under V8 coverage those calls run some five times
slower, and on a shared CI runner a single test took anywhere from 3.5 to 6 seconds, so
the default timeout of 5 seconds decided the verdict instead of the bytes.

The library's `project.json` adds the target `coverage`, which no other project has:
the project `specs` with `--coverage`, cached with the inputs of `test`. Its output is
`{projectRoot}/coverage`, which the CI workflow archives. Without the allocation specs
the coverage still stays above every threshold.

It adds the target `allocations`, the project `allocations` without coverage, cached with
the same inputs.

It also adds the target `bench`: `vitest bench` over `src/**/*.bench.ts`, uncached, since
a timing is never a cache hit. Its output is `{projectRoot}/bench-results/results.json`,
which the nightly workflow `bench.yml` archives.

Per-project `inputs` narrow the cache key further. The library's `build` input list
excludes `*.spec.ts`, `*.bench.ts` and `src/testing/` — tests, benches and their helpers
do not invalidate a build, which is also why `pnpm build` alone never type-checks the
tests and `pnpm typecheck` exists separately.

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
`package.json`, the modules of the check, the tsconfig reader it shares with
`checkNameableTypes` and every Markdown file git tracks: a marked block can sit in any
tracked Markdown file, and one that stops compiling has to turn the target red.
`project.json` names those files by the directories that hold tracked docs, and the three
at the root by name, so an untracked note — which the check never reads — does not
invalidate the cache. `scripts/checkDocSnippets/typecheckInputs.test.mjs` asks Nx for the
inputs it resolves and fails on a tracked `*.md` outside them; a doc in a new place gets
its glob there.

Named inputs worth knowing: `sharedTsconfigs` (root + project tsconfig),
`makePackageJson` (everything that feeds the publish manifest, the root `package.json`
included — change any of it and the library rebuilds).

## 3. The CI gate

`pnpm run ci` (alias `pnpm cbt`) chains:

```
clean → ci:checks → test:coverage → test:allocations → test:browser
ci:checks = lint → build → typecheck → checkPkgTypes → checkNameableTypes → lintPkg → test:scripts
```

- `lint` = `biome ci .`: Biome checks the formatting of every `.ts`, `.js`, `.mjs`,
  `.astro`, `.json`, `.jsonc` and `.css` file outside the ignores in `biome.jsonc`,
  lints all of them but the stylesheets, and writes nothing; `pnpm format` writes.
  Markdown, YAML and the SVG assets are neither formatted nor linted. `noConsole` is an
  error everywhere except in the `.mjs` scripts and the browser tests. The `.ts` rules
  (`useImportType`, the ban on a `.ts` suffix in a relative import through
  `noRestrictedImports`) apply to `.astro` files as well: to the frontmatter and to
  every `<script>` block; the markup and the `<style>` blocks are formatted, not linted.
  Biome's support for `.astro` files is still experimental, and its formatting of them
  is not always stable in one go: when `biome ci` still finds a difference right after
  `pnpm format`, a second `pnpm format` settles it. `noFloatingPromises` and
  `noMisusedPromises` hold `packages/*/src`, specs included. Both are still in Biome's
  nursery and read the types Biome infers itself, not those of the TypeScript checker,
  so they see less than a type-aware ESLint rule did; and Biome runs that inference only
  for a rule switched on at the top of the config, which is why they are on globally and
  an override takes them off outside `packages/*/src`. `noExplicitAny` holds the
  published library code, not the specs, benches and `src/testing/`.
  `noNonNullAssertion` stays off: `arr[i]!` is the idiom under
  `noUncheckedIndexedAccess`, see the comment beside the rule in `biome.jsonc`. The
  rules of Biome's recommended preset that the code breaks on purpose are off, each with
  its reason beside it — `useLiteralKeys`, for one, contradicts
  `noPropertyAccessFromIndexSignature`. `@biomejs/biome` is pinned to an exact version:
  a release that formats differently turns `lint` red, so a bump comes with its
  reformatting in the same commit.
- `typecheck` covers the library including its specs, the lookbook — its `.ts` files and
  its `.astro` pages, via `astro check` — the browser tests of `twopoint5d-testing`, and
  every code block marked `ts check` in the tracked Markdown files. The tests and the
  blocks are checked against the built library. The scripts under `scripts/` are checked
  as JavaScript (`checkJs`, `noImplicitAny` off, `strictNullChecks` on) by the Nx project
  `scripts`.
- `checkPkgTypes` runs Are-The-Types-Wrong against the built `dist/` with the profile
  `esm-only`: the package is ESM only, so `node10` and a `require` from CommonJS lie
  outside, and every other resolution has to succeed.
- `checkNameableTypes` (`scripts/checkNameableTypes.mjs`) walks `dist/lib/index.d.ts` and
  fails on published declarations that reference a type consumers cannot name. It reads
  its compiler options from the root `tsconfig.json`, as the code block check does, and
  follows a reference in every form the declarations carry — a type reference, a
  `typeof` query, an `import("…")` type — judging it by its leftmost name. Its logic
  lives in `scripts/checkNameableTypes/`. `attw` and `publint` resolve such a type
  structurally and stay quiet, which is exactly why this check exists.
- `lintPkg` runs publint against `dist/` and then `scripts/checkPeerDependenciesOnly.mjs`,
  which fails as soon as `dist/package.json` declares `dependencies` or
  `optionalDependencies`, and also when a `.js`, `.mjs` or `.d.ts` file in `dist/`
  imports a package that is not a peer; apart from its peers the package may import
  relative paths and its own `#` subpath imports only. The library reaches its
  consumers with peer dependencies only, and the non-blocking audit step in CI relies on
  that (see below).
- `test:scripts` runs `node --test` over `scripts/**/*.test.mjs`, the specs of the
  publish pipeline's helpers and of `makePackageJson.mjs`,
  `checkPeerDependenciesOnly.mjs` and `checkNameableTypes.mjs` themselves (§4, §6), of
  the CI cache server and its entry script, of the helpers of the code block check and
  of the Nameable-Types check, of the tsconfig reader both share (`scripts/shared/`),
  the check that the publish script and its helpers import nothing but Node's built-ins,
  the check that every tracked Markdown file is an input of
  `twopoint5d-testing:typecheck`, the check that every capitalised tag of the lookbook
  demos names an export of the library, and the check that the lookbook serves the
  script `RainbowLine` loads at runtime.
- `test:coverage` runs the library's Vitest project `specs` once, with coverage, against
  the thresholds in `packages/twopoint5d/vite.config.ts`. `test:ci` is not part of the
  gate: it runs every spec without coverage. The thresholds sit two points under the level
  measured when they were set, globally and per module: the measured percentage rounded
  down, minus two. A regression turns the gate red, a line that moves does not.
  `controls` and `display` carry no threshold of their own; the browser suite exercises
  them and is not measured.
- `test:allocations` runs the Vitest project `allocations` (§2) without coverage: the
  heap bytes a hot-path call puts on the V8 heap, each against its limit in the spec.

### In CI

`.github/workflows/ci.yml` runs the gate on every push, in four jobs side by side — one
matrix job per part: `ci:checks`, `test:coverage`, `test:allocations` and, under
`xvfb-run`, `test:browser`. `fail-fast` is off, so a red job does not hide the verdict of
the others, and "Re-run failed jobs" repeats only the part that failed. Every job and
every long step carries a `timeout-minutes`; a hosted job otherwise runs for six hours.
The workflow has no path filter:
Markdown is an input of `twopoint5d-testing:typecheck` (§2), so
a push that changes nothing but docs runs the gate as well, and the Nx cache answers every
target whose inputs the push leaves alone. Every action is pinned to a full commit SHA
with a `# vX.Y.Z` comment naming the release, so a moved tag cannot swap the code that
runs. The workflow reads `contents` only. Every checkout, here and in `deploy.yml`, sets
`persist-credentials: false`: no job pushes from a checkout — the `tag` job of
`deploy.yml` writes its ref through the REST API (§4) — so no token lies in
`.git/config` for an install script to find. The concurrency group of the workflow is the
branch, so a newer push cancels the running or waiting run of the same branch — except
on `main`, where the group is the commit: every commit there gets its own run, which
nothing cancels, because `deploy.yml` follows each successful one.

The step `Audit dependencies` follows the install in the job `ci:checks` and runs `pnpm
audit --audit-level=high`. It reports high and critical advisories without failing the run:
the published package declares peer dependencies only (`lintPkg` holds that), so
whatever the audit finds sits in tooling, and Dependabot proposes the update that fixes
it (§5). Dependabot also keeps the commit SHAs of the actions, and the version comment
next to each, current.

The benchmarks run in a workflow of their own, `.github/workflows/bench.yml`: nightly on
`main` and by hand (`workflow_dispatch`) on any branch. It installs the workspace root and
the library only and runs `bench` through pnpm. The artifact `bench-<commit sha>` keeps
`packages/twopoint5d/bench-results` for 90 days, the coverage report of the CI workflow
is kept for 3. The timings are archived, not held to a limit: a shared runner's timings
vary too much for a gate, and a regression shows only in the series over weeks. What can
be counted — the heap bytes of a hot-path call — the allocation specs hold in the gate.

The browser suite runs every test file in three browsers, each pinned to one backend of
three's `WebGPURenderer`: `Chromium WebGPU`, `Chromium WebGL2` and `Firefox WebGL2`
(`packages/twopoint5d-testing/web-test-runner.config.js`). Left to themselves the
browsers would pick by machine — headless Chromium offers WebGPU only behind
`--enable-unsafe-webgpu`, headless Firefox 155 finds no adapter — and measured with
Playwright 1.63.0 both ended up on WebGL2, so WebGPU went untested. Now an init script
of each launcher sets the backend before the page loads: for WebGL2 it takes
`navigator.gpu` away, and three falls back as it does for a user without WebGPU. Chromium
WebGPU runs on SwiftShader, the software adapter Chromium ships, with its compositor on
SwiftShader as well (`--use-angle=swiftshader`, and on Linux through Vulkan:
`--enable-features=Vulkan --use-vulkan=swiftshader`). A compositor on anything else cannot
take the canvas texture of a SwiftShader device, and Dawn drops the instance with every
device of the page ("A valid external Instance reference no longer exists"). Measured
with Playwright 1.63.0 on macOS and in its `v1.63.0-noble` image on arm64 and amd64:
macOS needs the first flag, Linux all three.

three falls back to WebGL2 without a word when WebGPU fails its init, and every other
test would then pass on the wrong backend. `test/renderer-backend.test.js` is the one
that fails then: it holds the backend three picked to the pinned one, read through
`expectedBackend()` from `test/helpers/fixtures.js`, and writes
`[renderer-backend] <WebGPU|WebGL2> on <browser>/<version>` into the "Browser logs" of
each launcher.

Only the job of the browser tests installs Playwright. The browsers are cached under the
key `playwright-<os>-<version>`, the version being what `pnpm exec playwright --version`
reports from the root package. A hit still runs `playwright install-deps`, since the
cache holds the browsers and not the system libraries they link against. That is an
`apt-get update` and `install`, which once fell back from the Azure mirror to
`archive.ubuntu.com` and waited on a silent connection for over twenty minutes: apt has
no overall timeout. The job therefore gives apt a 30-second network timeout and three
retries (`/etc/apt/apt.conf.d/99ci-network-timeouts`), cuts each attempt of
`install-deps` off after three minutes and tries three times. The key follows the root `playwright`, so the root
`playwright` and the one `@web/test-runner-playwright` resolves have to be the same
version.

Nx indexes its local cache in a database named after the machine id, and every runner
comes with a new one, so a restored Nx cache directory would never hit. Nx does take
results from a self-hosted remote cache, so the job starts `scripts/ci/nxCacheServer.mjs`
on `127.0.0.1:47873`, serving `$RUNNER_TEMP/nx-cache` with a random per-run token, and
hands `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` and `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`
to every later step. Each job keeps a cache of its own — `actions/cache` restores that
directory under `nx-<os>-<job>-<hash of pnpm-lock.yaml>-<commit sha>`, falling back to the
newest entry of the same job and lockfile and then to the newest entry of the job at all.
Four jobs of one commit would otherwise race for one key, and only the first save would
count. The server touches every entry it
serves. After a green run the job deletes each entry older than the server start — what
this run neither used nor wrote — and saves the directory under the commit's key, so
each saved state holds exactly the results of one green job of one commit and does not
grow from run to run. A red job saves nothing, and its next run restores the last green
state.

The cache is only as trustworthy as what writes to it: its entries come solely from CI
runs on pushes to this repository. `deploy.yml` does not use it and builds the published
package from source.

## 4. Build and publish pipeline

`packages/twopoint5d`'s `build` is `tsc -p tsconfig.build.json` into `dist/lib/`,
followed by `scripts/makePackageJson.mjs`. The build writes neither declaration maps nor
source maps, because both would point at `src/`, which the package does not contain. In
the workspace, "Go to definition" from the lookbook or the testing package into the
library lands in `dist/lib/*.d.ts`, and the browser shows its `.js`.

`makePackageJson.mjs` synthesizes the publish-time manifest from the source `package.json`
merged with `package.override.json`. The override file's `null` entries strip
development-only fields (`scripts`, `devDependencies`) from what ships. Specifiers are
resolved to real ranges: `catalog:` and `catalog:<name>` from the default or the named
catalog in `pnpm-workspace.yaml`; `workspace:` from the `package.json` of the package it
names (`workspace:^` and `workspace:~` keep their operator, `workspace:*` becomes a caret
range, a spelled-out range ships as it is written, only without the whitespace around it
and not in the form semver normalizes it to — but only if it is a version range;
anything else, a range of nothing but whitespace included, leaves the specifier standing).
A `package.json` there that cannot be read, or whose version semver cannot read, leaves
the specifier standing as well. If a `catalog:` or `workspace:` specifier is left in the
manifest afterwards, the build fails — npm installs neither protocol. A value that is no
string, a `null` or a number, stays standing with a warning, and the build fails on it the
same way, with a message that names the section, the name and the value. The script writes
`dist/package.json` only into an existing `dist/` and stops without the compiled library,
with the hint to compile first; an input file it cannot read stops it with the path and
the reason. Since `dist/` is what gets published, `main`, `module`, `types` and every
target in `exports` lose a leading `dist/` or `./dist/`; a `dist/` further inside a path
is part of the name and stays.

The logic of both scripts lives in `scripts/makePackageJson/` and
`scripts/publishNpmPkg/`, next to its `node --test` specs; the scripts themselves only
wire it up.

The publishable artifact is therefore `dist/`, not the source package directory.
`publishNpmPkg` runs `checkPkgTypes`, `lintPkg` and `checkNameableTypes` first and then
publishes `dist/`. It skips a version npm already lists and takes npm's `E404` for a first
publish. Before `npm publish` it copies `LICENSE` from the workspace root, and
`CHANGELOG.md` and the README from the directory it is started in, into the package
directory; the README is `README-pkg.md`, or `README.md` if there is none, and ships as
`README.md`. A workspace `.npmrc` goes along if there is one.
`publishNpmPkg.mjs <package-dir> [--dry-run]` stops with a usage line and exit code 1 on a
missing directory, on a second one and on any other option — a misspelled `--dry-run`
included — before it asks npm. npm is asked with `npm show .` in the package directory,
so the name comes from the manifest that `npm publish` reads there and no value from it
stands on a command line. npm runs without a shell; on Windows, where `npm` is an
`npm.cmd` that Node starts only through `cmd.exe`, it runs as a single string of literals,
and an argument with any character besides letters, digits and `_ @ . / -` is refused on
every platform. Every failure — a manifest that is unreadable or has no `name` or
`version`, one of those three files that is missing, an npm that is missing or fails —
ends with one line and exit code 1, and what `npm publish` itself prints goes straight to
the console. Never publish from `packages/twopoint5d/` and never run these scripts without
being asked to.

`.github/workflows/deploy.yml` runs after every successful CI run on `main`, in four
jobs. Each works on `github.event.workflow_run.head_sha`, the commit that CI run tested:
`main` may have moved on while CI ran, and a newer commit gets a CI run and a deploy of
its own. They run only for a CI run triggered by a push to this repository, the one kind
of run that may name the commit to publish. The runs share the concurrency group
`deploy` with `queue: max`: one deploy runs at a time and the others wait their turn, up
to 100 of them, where the default would keep one waiting run and let a newer one cancel
it — a version bump whose deploy waits behind another would never be published.

- `version` asks npm whether the manifest version is published already, or whether it
  ends in `-dev`; only if neither holds do the other three run.
- `build` holds no right but reading the repository, and it is the job in which the
  dependencies and their install scripts run. It installs the workspace root and the
  library alone, `pnpm install --frozen-lockfile --filter twopoint5d-workspace --filter
  @spearwolf/twopoint5d`, so the lookbook, the browser tests and their dependencies stay
  out; it builds the library, runs `checkPkgTypes`, `lintPkg` and `checkNameableTypes`
  and hands `dist/` on as the artifact `package`.
- `publish` is the only job with `id-token: write`. It installs nothing: it checks out
  the commit, takes `dist/` from the artifact and runs `node
  ../../scripts/publishNpmPkg.mjs dist` in `packages/twopoint5d`, so with the publish
  rights only that script, its helpers and npm run. That is why `publishNpmPkg.mjs` and
  `scripts/publishNpmPkg/` import nothing but Node's built-ins and each other, which
  `scripts/publishNpmPkg/builtinImportsOnly.test.mjs` holds. The step sets
  `npm_config_ignore_scripts`: `dist/package.json` comes from the `build` job, so npm
  runs none of its lifecycle scripts with the publish rights. The job authenticates
  through npm Trusted Publishing (OIDC), so there is no npm token. Releases carry SLSA
  provenance and name `GitHub Actions <npm-oidc-no-reply@github.com>` as their
  publisher, the first being 0.21.2.
- `tag` follows a successful publish and creates the tag `v<version>` on the published
  commit through the REST API, with `contents: write` as its only right, without a
  checkout and without an install. A version gets its tag once: a tag that exists
  already stays, with a warning if it points at another commit. A tag that the
  `GITHUB_TOKEN` of the workflow creates starts no CI run. Versions up to 0.21.2 carry
  no tag.

Changes under `scripts/` are changes to the publish pipeline. Treat them accordingly.
The exception is `scripts/ci/`, which only the CI workflow runs.

## 5. Shared dependency versions

`three`, `@types/three`, `@spearwolf/eventize` and `@spearwolf/signalize` are pinned in
the `catalog:` block of `pnpm-workspace.yaml`. Individual `package.json` files reference
them as `"catalog:"`, so a version bump happens in exactly one place and stays
consistent across library, test harness and lookbook. In the library they are
`peerDependencies`; `@types/three` is an optional peer (`peerDependenciesMeta`), because
only a TypeScript consumer needs it.

`.github/dependabot.yml` has Dependabot look at `npm` and `github-actions` once a week.
The minor and patch updates of the toolchain arrive as one pull request, the group
`toolchain`. The four catalog entries stay out of it: a jump of `three` moves the peer
range of the library and is a release of its own, because the catalog range lands
verbatim in the published manifest. So each of them, and every major update, comes as a
pull request by itself, to be reviewed on its own. `playwright` stays out of the group as
well: each of its updates brings the Chromium and Firefox the browser suite runs on, so
it comes as a pull request of its own. Overrides live in `pnpm-workspace.yaml`. Each one
carries a comment that names the advisory it answers and says when the entry can go.

The repo runs two TypeScripts. `typescript` in the root is 7.x, the native compiler: its
`tsc` builds the library and runs every type check but the lookbook's. TypeScript 7
exports no compiler API under `typescript` (only `typescript/unstable/*`, whose shape
may still change), so the scripts that need one —
`scripts/checkNameableTypes/findUnnameableTypes.mjs`,
`scripts/shared/readCompilerOptions.mjs`,
`scripts/checkDocSnippets/compileSnippets.mjs`,
`scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs` and three specs — import
the classic API from `@typescript/typescript6`, the package Microsoft publishes for
exactly that. The code block check therefore compiles the marked blocks with 6.x,
against declarations 7.x emitted. The lookbook keeps a `typescript` 6.x of its own:
`@astrojs/check` declares `typescript ^5.0.0 || ^6.0.0` as its peer, and `astro check`
type-checks the `.ts` files and `.astro` pages of the lookbook through it. A Dependabot
pull request that moves the lookbook's `typescript` to 7 breaks `pnpm typecheck` until
`@astrojs/check` accepts 7.

Node and pnpm versions come from `engines` in the root `package.json`: Node
`^24.16.0 || >=26.3.0` — the 25.x line is out — and pnpm `>=10.22.0`. The exact pnpm
is `packageManager` in the root `package.json`; `pnpm/action-setup` in both workflows
reads it from there and names no version of its own. `.nvmrc`, `mise.toml` and the
`node-version` of the CI workflows name a plain `24`. They answer which version to
install, not which ones are allowed, and none of them understands an alternative like
`||`; a `24` picks the newest 24.x the tool can get and lands inside the range, while a
narrower `24.16` would pin the minor line and cut the repo off from later 24.x releases.

## 6. Test surfaces

Two runners, deliberately in separate packages:

- Vitest in `packages/twopoint5d` (tag `ci`) — unit and logic tests as `*.spec.ts` next
  to the source. No browser dependencies in the library package.
- `@web/test-runner` with Playwright Chromium and Firefox in `packages/twopoint5d-testing`
  (tag `browser`) — `*.test.js` under `test/`, for anything that needs a real GPU context,
  every file under WebGPU in Chromium and under WebGL 2 in Chromium and Firefox.
  `pnpm install` downloads no browsers; they come from
  `pnpm exec playwright install chromium firefox`. The `*.test.js` files are type-checked
  with `checkJs` (`pnpm typecheck`); a fixture that needs a type gets it from JSDoc —
  vertex object interfaces, descriptions. The package is `"private": true`: it is a test
  harness, never a release, so npm refuses to publish it and `pnpm publish -r` passes it
  by.

A browser test takes its display down with `dispose()` alone: `Display#dispose()`
stops the loop right away and releases the renderer only once the GPU has run the work
submitted to it and, under WebGPU, the page has drawn two more animation frames — each
wait two seconds at most, the first one with a warning on the console when it runs out.
Firefox 155 under WebGPU needs the frames to keep drawing for the tests that follow.

The helpers of the publish pipeline, the CI cache server, the code block check and the
Nameable-Types check run under `node --test` (`pnpm test:scripts`), and four more specs
share that run. The Nx project `scripts` has no `test` target, so `pnpm test` leaves all
of them out. The four are:

- `scripts/lookbook/rainbowLineScript.test.mjs` holds `apps/lookbook/public/js/` to the
  script `@spearwolf/astro-rainbow-line` loads at runtime. Nothing in the repo
  references that file, so only a spec keeps it from being cleaned up.
- `scripts/lookbook/demoMetadata.test.mjs` holds the demo metadata of the lookbook to
  the library: every tag that starts with a capital letter names an export of
  `packages/twopoint5d/src/index.ts`, read through the TypeScript compiler from the
  sources, so the spec needs no build.
- `scripts/checkDocSnippets/typecheckInputs.test.mjs` runs git and Nx itself: it holds
  the Markdown inputs of `twopoint5d-testing:typecheck` to the files git tracks.
- `scripts/publishNpmPkg/builtinImportsOnly.test.mjs` holds `publishNpmPkg.mjs` and its
  helpers to imports of Node's built-ins and of each other, because the publish job of
  the deploy installs nothing (§4).

Four specs start a script itself, as a child process: `makePackageJson.mjs` in a throwaway
project directory, `checkPeerDependenciesOnly.mjs` against a throwaway manifest,
`checkNameableTypes.mjs` against throwaway declaration files and
`scripts/ci/nxCacheServer.mjs` with a command line it refuses, because their exit codes,
their messages and the manifest the first one does not write are wiring that no helper
test sees. No spec runs `publishNpmPkg.mjs`, which queries the registry as soon as its
arguments fit, nor `checkDocSnippets.mjs`, which reads git and the file system.

`pnpm test:affected` uses the Nx graph and `defaultBase: main`.

## 7. Lookbook

Astro app, and the de-facto live documentation. `astro.config.mjs` sets `base` to
`/lookbook`, so the dev server serves it at <http://localhost:4321/lookbook>, not at the
root. It builds against the compiled library, so a library change needs a rebuild
(`dependsOn: ["^build"]` on `dev`/`start` handles that for the Nx targets).
