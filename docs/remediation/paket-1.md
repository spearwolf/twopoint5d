# Paket 1 — Workspace-Tooling, Abhängigkeiten und Repo-Doku

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: DEP-001 (low), DEP-002 (low), BUILD-001 (low), BUILD-002 (low), SEC-001 (low),
  CONS-010 (low), DX-001 (low), DX-002 (low), dazu offene Frage 4 (Prerelease-Tag)
- Ziel: Overrides, Advisory, Dependabot, Nx-Hash und Skripte sind auf Stand, `publishNpmPkg.mjs`
  taggt Prereleases als `next`, und README und AGENTS.md beschreiben das Repo, wie es ist.
- Modell: mittlere Stufe (sonnet)
- Effort: medium
- Dateien:
  - `pnpm-workspace.yaml`, `pnpm-lock.yaml` (nur über `pnpm install`)
  - `.github/dependabot.yml`, `.github/workflows/ci.yml` (nur ein Kommentar)
  - `nx.json`
  - `scripts/makePackageJson.mjs`, `scripts/makePackageJson/resolveDependencies.mjs`
  - `scripts/publishNpmPkg.mjs`, `scripts/publishNpmPkg/parseArguments.mjs`,
    `scripts/publishNpmPkg/parseArguments.test.mjs`, `scripts/publishNpmPkg/publishDecision.mjs`,
    `scripts/publishNpmPkg/publishDecision.test.mjs`
  - `scripts/checkPeerDependenciesOnly.mjs`
  - `scripts/lookbook/previewServer.mjs`, `scripts/lookbook/previewServer.test.mjs`
  - `README.md`, `AGENTS.md`, `docs/architecture.md`, `apps/lookbook/README.md`
- Verify: `pnpm run ci`
- Zusatzprüfungen (nicht Teil des Gates, Ergebnis gehört in den Report):
  `pnpm audit --audit-level=high; echo exit=$?` (Netz nötig) und
  `pnpm nx show target inputs twopoint5d:allocations --json` (zeigt den Runtime-Input)
- Commit (Subject + Body, Englisch, ohne Finding-IDs):

  ```text
  chore: retire spent overrides, publish prereleases under next, and describe the repo as it is

  - pnpm-workspace.yaml: drop the overrides for nx>undici and rimraf>glob, whose
    exit conditions are met, and ignore the picomatch advisory, which reaches
    the lookbook's tooling alone and has no fixed release
  - dependabot: wait three days before proposing an action update, and propose
    the actions of the publish job one by one
  - nx: hash the Node version into the inputs of the Vitest targets
  - scripts: start each error line with the name of its script, read the
    publish command line through node:util parseArgs, publish a prerelease
    under the dist-tag next, and refuse to start the lookbook preview server
    on Windows
  - README and AGENTS.md: list every project of the repo and size the modules
    of the library as they are
  ```

  Stimmt eine Zeile nach der Umsetzung nicht mehr (etwa weil der undici-Override nach der
  Entscheidungsregel in Schritt 1 bleiben musste), wird sie angepasst; der Rest bleibt.

## Vorgehen

Reihenfolge so einhalten: Schritt 1 und 2 brauchen das Netz und ändern das Lockfile, alles
danach ist lokal. Alles, was neu ins Repo geschrieben wird (Code, Kommentare, Doku), ist
Englisch und folgt `AGENTS.md`; die englischen Textvorlagen unten dürfen sprachlich geglättet
werden, ihre Fakten nicht. Kein Satz beschreibt einen Vorzustand (»no longer«, »now«,
»previously«).

### 1. Überholte Overrides entfernen (DEP-001)

1. In `pnpm-workspace.yaml` den ganzen Block `overrides:` löschen (Zeilen 34–43: der Schlüssel
   `overrides:`, die beiden Kommentarblöcke und die Einträge `'nx>undici': ^7.29.1` und
   `'rimraf>glob': ^14.0.2`). Die Leerzeile davor/danach so halten, dass genau eine Leerzeile
   zwischen `onlyBuiltDependencies` und `packageExtensions` steht.
2. Im Kommentar zu `GHSA-g3hv-75wg-m249` (Zeile 60) »nx 24.0.0 to 24.0.3 pin minimatch 10.2.5«
   ersetzen durch »nx 24.0.0 to 24.0.5 pin minimatch 10.2.5«. Geprüft am 2026-11-18:
   `node_modules/nx/package.json` (24.0.5) deklariert `"minimatch": "10.2.5"` und ruft
   `minimatch.makeRe()` u. a. in `dist/src/utils/find-matching-projects.js`. Der Rest des
   Kommentars, der deepmerge-Eintrag und `packageExtensions` (`@astrojs/astro2tsx@0.1.3` ist
   weiter installiert) bleiben unverändert.
3. `pnpm install` ausführen. Erwartete Änderung in `pnpm-lock.yaml`: der Block `overrides:`
   (Zeilen 34–36) verschwindet, und nx bekommt sein exakt gepinntes `undici: 7.30.1` statt der
   heute per Override gezogenen 7.30.2 (`pnpm-lock.yaml:7041`); ein Paketeintrag
   `undici@7.30.1` kommt hinzu, `undici@7.30.2` fällt weg, falls nichts anderes es braucht.
   `glob` bleibt 14.0.3. Jede weitere Änderung im Lockfile ist ein Befund für den Report.
4. **Entscheidungsregel undici:** nach Schritt 2 (DEP-002) `pnpm audit --json` laufen lassen.
   Meldet es ein Advisory gegen `undici` 7.30.1, wird der Override `'nx>undici'` wieder
   eingesetzt — mit einem neuen Kommentar, der dieses Advisory nennt und als Ausstiegsbedingung
   »once the nx in package.json depends on undici >=<gefixte Version> itself« —, und das steht
   unter »Abweichungen« im Report. Meldet es nichts gegen undici, bleibt er weg.

### 2. picomatch-Advisory einordnen (DEP-002)

In `pnpm-workspace.yaml` unter `auditConfig.ignoreGhsas` als dritten Eintrag (nach
`GHSA-gcqx-w48m-w2h4`) ergänzen, im Stil der beiden vorhandenen:

```yaml
    # picomatch: no release fixes it — pnpm audit lists no patched version for the ReDoS
    # through repeated extglobs. Both paths run in the lookbook's tooling alone: tinyglobby
    # under @astrojs/language-server (astro check) and anymatch under unstorage (astro). They
    # match the globs of this repo's own configs, never a pattern from outside, and the
    # lookbook builds to a static site, so no request reaches unstorage. Drop this entry once
    # picomatch publishes a fix and an update or an override lifts both paths to it.
    - GHSA-fc5q-39xc-vjpf
```

Grundlage (geprüft am 2026-11-18 mit `pnpm audit --json`): einziges offenes Advisory ist
`GHSA-fc5q-39xc-vjpf` (high), picomatch 4.0.7 über
`apps__lookbook>@astrojs/check>@astrojs/language-server>tinyglobby>picomatch` und picomatch
2.3.2 über `apps__lookbook>astro>unstorage>anymatch>picomatch`; `apps/lookbook/astro.config.mjs`
setzt kein `output`, baut also statisch. Danach muss `pnpm audit --audit-level=high` mit
Exit 0 enden (sofern die Registry antwortet).

### 3. Node-Version in den Nx-Hash (BUILD-002)

1. `nx.json`, `namedInputs.vitestDefaults`: nach dem Objekt mit `externalDependencies` ein
   weiteres Element `{"runtime": "node --version"}` anhängen. Damit hängen `test`, `coverage`
   und `allocations` von `twopoint5d` (alle über `vitestDefaults`,
   `packages/twopoint5d/project.json:25-36`) an der Node-Version.
2. `AGENTS.md:51-54` (Eintrag `pnpm test:allocations`): den Satz ab »After an upgrade of Node
   — the one on your machine, or the line CI installs — run them once as …« bis »… taken under
   the old V8« ersetzen durch: »The Nx hash of the Vitest targets includes `node --version`, so
   the cache replays no measurement taken under another Node.«
3. `docs/architecture.md:31-37` (Eintrag `test`): die Klammer, die aufzählt, was einen
   Vitest-Lauf invalidiert, um die Node-Version ergänzen, etwa: »…, `sinon`), and the Node
   version (`{"runtime": "node --version"}`): the allocation specs measure what V8 allocates,
   and another V8 inlines differently.« Der Satz »A spec that imports a package outside that
   list adds it there …« bleibt.
4. `.github/workflows/ci.yml:166-168`, Kommentar am Cache-Key: »The Node line is part of the
   key because the Nx hash of a task leaves it out« stimmt danach nur noch für die Nicht-Vitest-
   Targets. Umformulieren zu: »The Node line is part of the key because the Nx hash of the
   build, the type checks and the package checks leaves it out (the Vitest targets hash
   `node --version`): the Node 26 job would otherwise replay what the Node 24 job computed and
   check nothing«. Am Key selbst nichts ändern.
5. Prüfen: `pnpm nx show target inputs twopoint5d:allocations --json` nennt den Runtime-Input;
   `scripts/nxInputs/libraryVitestInputs.test.mjs` liest nur `files` und bleibt grün.

### 4. Cooldown und Einzel-PRs für Actions (SEC-001)

`.github/dependabot.yml`, Eintrag `package-ecosystem: github-actions` (Zeilen 45–52) wird zu:

```yaml
  # keeps the commit SHAs the workflows pin, and the version comment next to each, current
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    # three days give a compromised release of an action time to be found and pulled
    # before it is proposed
    cooldown:
      default-days: 3
    groups:
      # the publish job of deploy.yml runs checkout, setup-node and download-artifact with
      # its OIDC token (npm Trusted Publishing): each of their updates comes as a pull
      # request of its own, read on its own. The tag job, which may write, runs no action
      actions:
        patterns: ['*']
        exclude-patterns:
          - actions/checkout
          - actions/setup-node
          - actions/download-artifact
```

Grundlage: `deploy.yml:147-149` (`id-token: write` im Job `publish`), dessen Actions
`deploy.yml:151`, `:158`, `:165`; der Job `tag` (`deploy.yml:185-188`, `contents: write`)
ruft nur `gh api`. Keine `semver-*-days`-Schlüssel, nur `default-days`.

### 5. Preview-Server auf Linux und macOS beschränken (BUILD-001)

Freigegebener Weg (»Entscheidungen«, 2026-11-17): Kommentar plus Fehlermeldung unter `win32`.

1. **Test zuerst** in `scripts/lookbook/previewServer.test.mjs`, im `describe`-Block, mit
   eigener PID-Datei `path.join(dir, 'refused-server.pid')`:
   `it('refuses to start a server on Windows, and spawns nothing', …)` —
   `await assert.rejects(startPreviewServer({platform: 'win32', command: process.execPath, args: () => ['-e', STAND_IN, refusedPidFile], startupTimeoutMs: 500}), /Linux and macOS only/)`,
   dann `assert.ok(!fs.existsSync(refusedPidFile))`. Ohne den Guard läuft der Stand-in an,
   antwortet nie und der Aufruf scheitert nach 500 ms mit »did not answer« — das ist der rote
   Lauf (`node --test scripts/lookbook/previewServer.test.mjs`). Im `after()` die neue
   PID-Datei mit aufräumen wie `hangingPidFile`, falls ein roter Lauf sie hinterlässt.
2. `scripts/lookbook/previewServer.mjs`: `startPreviewServer` bekommt den Parameter
   `platform = process.platform` im Options-Objekt (neben `command`, `args`,
   `startupTimeoutMs`), im JSDoc als `platform?: string` mit »a value of `process.platform`,
   which a spec hands in«. Als erste Anweisung der Funktion, vor `findFreePort()`:

   ```js
   // stop() ends the server through its process group, a negative pid to process.kill(),
   // and Windows has no process groups: there the server would outlive the run. A lookbook
   // started by hand and handed to the generator through --url works on every platform
   if (platform === 'win32') {
     throw new Error(
       'astro preview is started on Linux and macOS only, where stop() ends it with its process group; on Windows start the lookbook yourself and pass its URL with --url',
     );
   }
   ```

   `generateDemoPreviews.mjs:187` druckt das als `generateDemoPreviews: …` mit Exit 2 — dort
   nichts ändern.
3. `scripts/lookbook/demoPreviewConfig.mjs:17-30` (`chromiumGpuArgs`) und sein Test bleiben
   unverändert: mit `--url` startet der Generator keinen Server, Windows bleibt dort eine
   Plattform, für die die Chromium-Flags stimmen müssen.
4. `apps/lookbook/README.md`, Abschnitt »Preview images«: an den ersten Absatz (Zeilen
   115–120) einen Satz anhängen: »Starting `astro preview` itself needs Linux or macOS: the run
   ends it through its process group, which Windows lacks. On Windows start the lookbook
   yourself and pass its URL with `--url`.«

### 6. Skriptmeldungen angleichen (CONS-010)

Regel, die danach für jedes Skript unter `scripts/` gilt: **eine Fehler- oder Warnzeile, die
ein Skript selbst ausgibt, beginnt mit seinem Namen und einem Doppelpunkt** (`makePackageJson:
…`), als ein String, kein `console.warn`-Argumentfetzen. Eine abgelehnte Kommandozeile druckt
weiter die Ablehnung und danach die Zeile `usage: node scripts/…` — so halten es
`nxCacheServer.mjs`, `runExclusive.mjs` und `auditInstalledDependencies.mjs`, und
`nxCacheServer.test.mjs:24` prüft genau dieses Muster; diese drei Skripte bleiben unberührt.
Hilfsmodule, die werfen (`previewServer.mjs`, `readCompilerOptions.mjs`, `checkManifest.mjs`,
`releaseFiles.mjs` …), bleiben ohne Subjekt: ihr Aufrufer setzt es davor.

1. `scripts/makePackageJson.mjs`: Präfix `makePackageJson: ` an den Meldungen in Zeile 21
   (`cannot read …`), 65 (`cannot publish …`), 76 und 83 (`cannot write …`). Die
   `console.log`-Infozeilen (`workspaceRoot:`, `projectRoot:`, `Write to`) bleiben.
2. `scripts/makePackageJson/resolveDependencies.mjs`: jede `console.warn('oops.. …', …)`
   wird ein Template-String mit Präfix `makePackageJson: ` und ganzem Satz. Vorlagen (Namen
   bleiben unquotiert wie heute, ein Nicht-String-Wert geht durch `JSON.stringify`):
   - Zeile 16: `` `makePackageJson: ${context.referencedFrom} gives ${depName} the specifier ${JSON.stringify(specifier)}, which is no string` ``
   - Zeile 54: `` `makePackageJson: the workspace catalog ${catalogName} has no entry for ${pkgName}, which ${referencedFrom} takes from it` ``
   - Zeile 66: `` `makePackageJson: ${referencedFrom} names ${pkgName} as ${specifier}, an aliased workspace package, which this script does not map` ``
   - Zeile 84: `` `makePackageJson: ${referencedFrom} names ${pkgName} as ${specifier}, which holds no version range` ``
   - Zeile 111: `` `makePackageJson: cannot read ${pkgJsonPath}, the workspace package ${pkgName} that ${referencedFrom} names: ${error instanceof Error ? error.message : String(error)}` ``
   - Zeile 124: `` `makePackageJson: ${pkgJsonPath}, the workspace package ${pkgName} that ${referencedFrom} names, has no version semver can read` ``
   - Zeile 146: `` `makePackageJson: ${referencedFrom} names ${pkgName} as ${specifier}, and neither packages/${pkgNameWithoutScope} nor the root package.json provides it` ``

   Die `console.log`-Zeilen (`resolve package version …`) bleiben. `resolveDependencies.test.mjs`
   prüft keine Warntexte (geprüft); `makePackageJson.test.mjs:79` matcht unverankert und bleibt grün.
3. `scripts/publishNpmPkg.mjs`: Präfix `publishNpmPkg: ` an Zeile 34 und 56 (`cannot publish
   …`), 113 (`cannot copy …`), 81 (`console.warn(\`publishNpmPkg: ${decision.message}\`)`),
   87 (`console.error(…)` ebenso) und 102 (`publishNpmPkg: ${describePublishFailure(failure)}`).
   Zeile 46 wird `` console.warn(`publishNpmPkg: skip publishing, version ${pkgJson.version} is marked as a development version`) ``.
   Zeile 17–18 (Ablehnung der Kommandozeile + USAGE) bleibt im Muster oben, ohne Präfix.
   Zeile 84 (`console.log`, Info) bleibt ohne Präfix.
4. `scripts/publishNpmPkg/publishDecision.mjs:49`: der Info-Text »oh it looks like this is the
   first time to publish the package« wird »npm knows no version of this package yet, this is
   its first publish«; `publishDecision.test.mjs:5` (`FIRST_PUBLISH`) zieht mit.
5. `scripts/publishNpmPkg/parseArguments.mjs` auf `parseArgs` aus `node:util` umstellen
   (Built-in, `builtinImportsOnly.test.mjs` bleibt grün). `USAGE` wird
   `'usage: node scripts/publishNpmPkg.mjs <package-dir> [--dry-run]'` (klein wie bei den
   anderen Skripten). Gerüst:

   ```js
   import {parseArgs} from 'node:util';

   export function parseArguments(args) {
     const {tokens} = parseArgs({
       // `pnpm run <script> -- --dry-run` hands the `--` on to the script, and parseArgs
       // would take every argument after it for a positional
       args: args.filter((arg) => arg !== '--'),
       options: {'dry-run': {type: 'boolean'}},
       allowPositionals: true,
       // the refusal names an argument as it was written, `--dry-run=true` included, in the
       // same words under every Node line; strict mode would append a hint to put it behind a
       // `--`, which this script drops
       strict: false,
       tokens: true,
     });
     const positionals = [];
     let dryRun = false;
     for (const token of tokens) {
       if (token.kind === 'positional') {
         positionals.push(token.value);
       } else if (token.kind === 'option') {
         if (token.name !== 'dry-run' || token.inlineValue) {
           throw new Error(`unknown option: ${token.inlineValue ? `${token.rawName}=${token.value}` : token.rawName}`);
         }
         dryRun = true;
       }
     }
     // … die beiden Prüfungen auf 0 und >1 positionals mit unveränderten Meldungen …
     return {packageDir: positionals[0], dryRun};
   }
   ```

   Der JSDoc-Kopf bleibt sinngemäß. Alle sechs Tests in `parseArguments.test.mjs` müssen
   unverändert grün bleiben (`--dryrun`, `--dry-run=true`, `-n` → `unknown option: <arg>`);
   dazu ein Test, dass `-n` in einer Kurzoptionsgruppe (`['dist', '-nx']`) ebenfalls wirft
   (`/unknown option: -n/`).
6. `scripts/checkPeerDependenciesOnly.mjs`: Präfix `checkPeerDependenciesOnly: ` an Zeile 31
   und 49 (`cannot read …`), 37 (`… declares …`) und 56 (`… imports …`). Zeile 22 (usage)
   bleibt. `checkPeerDependenciesOnly.test.mjs:86` matcht unverankert und bleibt grün; jede
   andere stderr-Erwartung dort vorher lesen und mitziehen.

### 7. Prereleases unter `next` veröffentlichen (offene Frage 4)

Freigegeben (»Entscheidungen«, offene Frage 4): `x.y.z-<tag>.n` außer `-dev` geht mit
`--tag next` hinaus; getestet über `test:scripts`. **Nie `publishNpmPkg.mjs` oder `pnpm
publishNpmPkg` ausführen, auch nicht mit `--dry-run`.**

1. **Test zuerst** in `scripts/publishNpmPkg/publishDecision.test.mjs`, neuer
   `describe('publishArguments', …)`:
   - `publishArguments('0.25.0', {dryRun: false})` → `['publish', '--access', 'public']`
   - `publishArguments('1.0.0-beta.1', {dryRun: false})` → `['publish', '--access', 'public', '--tag', 'next']`
   - `publishArguments('1.0.0-rc.0', {dryRun: true})` → `['publish', '--access', 'public', '--tag', 'next', '--dry-run']`
   - `publishArguments('1.0.0+build.7', {dryRun: false})` → ohne `--tag` (Build-Metadaten sind keine Prerelease)
   - `npmCommand(publishArguments('1.0.0-beta.1', {dryRun: true}))` wirft nicht (jedes Argument
     passt durch die Zeichenprüfung von `npmCommand.mjs:19`)

   Roter Lauf: `node --test scripts/publishNpmPkg/publishDecision.test.mjs` (Export fehlt).
2. `scripts/publishNpmPkg/publishDecision.mjs`: neuer Export

   ```js
   /**
    * The arguments of `npm publish` for a version. A prerelease — a version with a `-` after
    * its patch number, such as `1.0.0-beta.1` — goes out under the dist-tag `next`, so that an
    * install without a version keeps resolving the latest stable release; npm gives every
    * other version `latest`. A `-dev` version never gets here: `isDevelopmentVersion()` skips
    * it first.
    *
    * @param {string} version the version in the manifest
    * @param {{dryRun: boolean}} options
    * @returns {string[]}
    */
   export function publishArguments(version, {dryRun}) {
     const prerelease = /^\d+\.\d+\.\d+-/.test(version);
     return ['publish', '--access', 'public', ...(prerelease ? ['--tag', 'next'] : []), ...(dryRun ? ['--dry-run'] : [])];
   }
   ```
3. `scripts/publishNpmPkg.mjs:92-93`: `publishPackage` baut sein Kommando mit
   `npmCommand(publishArguments(pkgJson.version, {dryRun}))`; Import ergänzen.
4. `docs/architecture.md`:
   - §4, nach »A `-dev` version is skipped before any of this.« (Zeile ~400): »A prerelease —
     a version with a `-` after its patch number, such as `1.0.0-beta.1` — is published under
     the dist-tag `next`, so `npm install @spearwolf/twopoint5d` without a version keeps
     installing the latest stable release; every other version goes out under npm's
     `latest`.«
   - Zeile 385–388: neben `decidePublish()` nennen, dass die Argumente von `npm publish`,
     der Dist-Tag eingeschlossen, `publishArguments()` in derselben Datei sind und dessen
     Spec sie abdeckt.
   - Zeile 640–641 (»No spec runs `publishNpmPkg.mjs` …; `decidePublish()` carries its decision
     and its spec covers it«): `publishArguments()` ebenso nennen.

### 8. Repo-Übersicht im README (DX-002)

`README.md:78-84`, Abschnitt »What's in this repository 👀«, wird zu:

```markdown
## What's in this repository 👀

_twopoint5d_ is a pnpm + Nx monorepo:

- [@spearwolf/twopoint5d](packages/twopoint5d) — the library, the one package that is
  published; it relies on [three.js](https://threejs.org/) as its rendering framework
- [packages/twopoint5d-testing](packages/twopoint5d-testing) — the browser integration
  tests, which render under WebGPU and under WebGL 2 in real browsers (`pnpm test:browser`)
- [apps/lookbook](apps/lookbook) — an Astro showcase of the library and its live
  documentation (`pnpm lookbook`)
- [scripts](scripts) — the Node scripts of the publish pipeline, of CI and of the checks of
  the repo (`pnpm test:scripts`)

[AGENTS.md](AGENTS.md) lists the commands and the rules of the repo; `pnpm run ci` runs the
whole gate.
```

### 9. Modulgrößen in AGENTS.md (DX-001)

`AGENTS.md:254-258`, der erste Absatz unter »Working on the library«, wird zu (Absatz über
eventize/signalize danach bleibt):

```markdown
Read a module's sources whole instead of grepping symbol by symbol: the pooled-buffer,
signal and ownership plumbing only makes sense in one piece, and assembling it from grep
hits is how wrong assumptions get in. Whole does not mean the whole directory, though.
`controls`, `text` and `utils` hold about 1k lines each or less, and `cat src/<module>/*.ts`
is one cheap call. The others are far larger — `stage` about 13k lines, `texture` about 9k,
`display`, `map2d` and `sprites` about 7k each with their subdirectories, `vertex-objects`
about 6k — and a `cat` over one of them buries the part you need. Read those one area at a
time: a class together with the files beside it that it imports — in `stage` the camera rig,
the director, the renderer, or `Stage2D` with its projections; in `texture` the store, a
resource, the atlas loaders, or the frame-based animations.
```

Die Zahlen sind gemessen am 2026-11-18, ohne `*.spec.ts` und `*.bench.ts`:
`stage/` 13 161, `texture/` 9 069, `display/` 6 768, `map2d/` 6 801 (5 568 ohne
Unterverzeichnisse), `sprites/` 6 970 (2 163 ohne), `vertex-objects/` 5 830, `controls/` 1 083,
`text/` 1 041, `utils/` 701. Kein CI-Check der Zahlen (Begründung unten).

### Was nicht in dieses Paket gehört

- Kein CHANGELOG-Eintrag: nichts hier ändert Code oder API der Library; der Dist-Tag betrifft
  den Release-Weg und steht in `docs/architecture.md` §4.
- Keine Änderung an `nxCacheServer.mjs`, `runExclusive.mjs`, `auditInstalledDependencies.mjs`,
  `demoPreviewConfig.mjs`, `generateDemoPreviews.mjs`, `deploy.yml`.

## Entscheidungen dieses Detailplans

- **Undici-Override mit Entscheidungsregel statt blind entfernen.** Das Audit erwartete ein
  unverändertes Lockfile; tatsächlich zieht der Override heute undici 7.30.2, ohne ihn kommt
  nx' exakter Pin 7.30.1 (`pnpm-lock.yaml:7041`). Ob 7.30.1 ein Advisory trägt, sagt erst
  `pnpm audit` nach dem Install — die Regel in Schritt 1.4 entscheidet das ohne Rückfrage.
- **`parseArgs` mit `tokens` und `strict: false` statt `strict: true`** (Abweichung von der
  Empfehlung). Das Skript muss das `--` verwerfen, das `pnpm run … -- --dry-run` durchreicht;
  `strict: true` hängt an jede Ablehnung den Hinweis, das Argument hinter ein `--` zu stellen —
  hier falsch, weil das Skript genau dieses `--` verwirft —, und sein Wortlaut ist nicht über
  Node 24 und 26 zugesichert. Mit den Tokens bleiben die getesteten Meldungen
  `unknown option: <arg>` wörtlich, und das Parsen übernimmt das Built-in.
- **`checkPeerDependenciesOnly.mjs` mit im Paket.** Dieselbe Ursache wie bei `makePackageJson.mjs`
  (`cannot read …` ohne Skriptnamen, Zeilen 31/37/49/56), vom Audit nicht gelistet; vier
  Präfixe, kein eigenes Paket.
- **Die Usage-Konvention der drei parseArgs-Skripte bleibt.** Ablehnung + `usage:`-Zeile ist
  dort einheitlich und getestet (`nxCacheServer.test.mjs:24`); `publishNpmPkg` folgt ihr.
- **`chromiumGpuArgs` bleibt unverändert**, obwohl das Audit `demoPreviewConfig.mjs:26` als
  Fundstelle nennt: mit `--url` startet der Generator keinen Server und läuft unter Windows
  weiter. Der Guard sitzt deshalb in `startPreviewServer`, nicht im Generator.
- **Runtime-Input in `vitestDefaults`, nicht nur an `allocations`**: jeder Vitest-Lauf läuft
  unter der Node-Version, die ihn ausführt; ein Input an einer Stelle hält alle drei Targets
  ehrlich.
- **Kein `wc -l`-Check der Modulgrößen im CI.** Die Pakete 6, 10 und 11 zerlegen Dateien in
  `texture/`, `display/` und `stage/`; ein exakter Check bräche bei jedem davon. Die Zahlen
  stehen gerundet da, die Regel hängt an Bereichen (Klassen), nicht an Dateinamen, und
  übersteht die Zerlegung.
- **Kein CHANGELOG-Eintrag** (siehe oben).

## Abgleich (2026-11-18, gegen 2e3f585b)

- DEP-001 — unverändert. `pnpm-workspace.yaml:38` (`'nx>undici': ^7.29.1`) und `:43`
  (`'rimraf>glob': ^14.0.2`). nx 24.0.5 deklariert `undici: 7.30.1` exakt; rimraf 6.1.4
  (`node_modules/.pnpm/rimraf@6.1.4`) hängt an `glob: ^14.0.3`; im Lockfile nur noch
  `rimraf@6.1.4` (`pnpm why rimraf -r`). Abweichend vom Audit: Lockfile ändert sich bei
  undici (siehe Entscheidungen). Kommentar zum minimatch-Ignore (`:60`) nennt einen zu
  engen nx-Bereich.
- DEP-002 — unverändert. `pnpm audit --json` am 2026-11-18: nur `GHSA-fc5q-39xc-vjpf`
  (picomatch 4.0.7 und 2.3.2, beide über `apps__lookbook`); `auditConfig.ignoreGhsas`
  (`pnpm-workspace.yaml:58-72`) hat es nicht.
- BUILD-001 — unverändert. `scripts/lookbook/previewServer.mjs:45-49` (`spawn` detached),
  `:69` (`process.kill(-child.pid, 'SIGTERM')`); `demoPreviewConfig.mjs:26` unverändert,
  bleibt über `--url` gültig.
- BUILD-002 — unverändert. `nx.json:69-78` ohne Runtime-Input; Merkregel `AGENTS.md:52-54`;
  Kommentar `ci.yml:166-168` begründet den Node-Teil des Cache-Keys damit.
- SEC-001 — unverändert. `.github/dependabot.yml:46-52`, kein `cooldown`, alle Actions in einer
  Gruppe.
- CONS-010 — unverändert. `makePackageJson.mjs:21/65/76/83`, `resolveDependencies.mjs:16/54/66/84/111/124/146`
  (`oops..`), `publishNpmPkg.mjs:34/46/56/81/87/102/113`, `parseArguments.mjs:8-31`
  (Handschleife). Zusätzlich gleiche Ursache in `checkPeerDependenciesOnly.mjs:31/37/49/56`.
- DX-001 — unverändert. `AGENTS.md:254-256`; Zahlen nachgemessen (oben), `vertex-objects/`
  inzwischen 5 830 statt 6 049.
- DX-002 — unverändert. `README.md:78-84` nennt ein Paket.
- Offene Frage 4 — entschieden 2026-11-17; `publishNpmPkg.mjs:93` übergibt kein `--tag`,
  `isDevelopmentVersion()` in `publishDecision.mjs:19-21`.

## Verlauf

- 2026-11-18 Zug 0: Detailplan steht · alle acht Findings unverändert, DEP-001 mit
  Lockfile-Änderung bei undici (7.30.2 → 7.30.1), CONS-010 um
  `checkPeerDependenciesOnly.mjs` erweitert · keine Folgen aus Vorpaketen, »Offene Befunde«
  leer · Restplan geprüft, unverändert
- 2026-11-18 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-1.impl-0.json`
- 2026-11-18 Zug 2: Report FERTIG · 19 Dateien geändert (Lockfile: overrides-Block weg, undici 7.30.2 → 7.30.1, sonst nichts) · undici-Regel: kein Advisory, Override bleibt weg · rote Läufe für Preview-Guard und `publishArguments` belegt · Arbeitsbaum schmutzig · eigener Verify `pnpm run ci` exit=0 (`paket-1.verify.log`)
- 2026-11-18 Zug 3: Reviewer (sonnet, medium) — alle neun Punkte behoben, nichts kritisch/wichtig, zwei klein · Diff `paket-1.diff`, Report `paket-1.review-0.json`
- 2026-11-18 Zug 4: keine Runde nötig
- 2026-11-18 Zug 5: committet als a964bd90 mit Trailer `Remediation-Run: 2026-11-17`, Verify aus Zug 2 trägt (keine Änderung seither)

## Urteil des Reviewers

- DEP-001 behoben — `pnpm-workspace.yaml` ohne `overrides:`, minimatch-Kommentar nennt 24.0.5; Lockfile nur overrides-Block und undici 7.30.1
- DEP-002 behoben — `GHSA-fc5q-39xc-vjpf` mit Begründung und Ausstiegsbedingung in `auditConfig.ignoreGhsas`
- BUILD-001 behoben — Guard `platform === 'win32'` in `scripts/lookbook/previewServer.mjs` vor `findFreePort()`, Test in `previewServer.test.mjs`, Hinweis in `apps/lookbook/README.md`
- BUILD-002 behoben — `nx.json` `vitestDefaults` mit Runtime-Input; `AGENTS.md`, `docs/architecture.md`, `ci.yml`-Kommentar nachgezogen
- SEC-001 behoben — `.github/dependabot.yml` mit `cooldown.default-days: 3` und `exclude-patterns` für checkout, setup-node, download-artifact
- CONS-010 behoben — Präfixe in `makePackageJson.mjs`, `resolveDependencies.mjs` (alle sieben), `publishNpmPkg.mjs`, `checkPeerDependenciesOnly.mjs`; `parseArguments.mjs` auf `parseArgs` (tokens, strict: false), Test für `-nx`
- DX-001 behoben — neuer Absatz unter »Working on the library« in `AGENTS.md` mit den gemessenen Größen
- DX-002 behoben — `README.md` »What's in this repository« listet vier Projekte
- Offene Frage 4 behoben — `publishArguments()` in `scripts/publishNpmPkg/publishDecision.mjs`, genutzt in `publishNpmPkg.mjs`, fünf Tests, `docs/architecture.md` an drei Stellen

Kleine Befunde (keine Runde):
- `docs/architecture.md`: die eingefügten Sätze sind nicht auf die übliche Zeilenbreite umbrochen (überlange Zeilen, eine Zeile nur »spec covers both. No«); kosmetisch
- `scripts/publishNpmPkg.mjs:5`: Importzeile über 120 Zeichen; Biome im Gate hat nichts beanstandet

## Findings im Volltext

**DEP-001 · low · pnpm-workspace.yaml:38** (auch `:43`) — Überholte pnpm-Overrides für nx>undici und rimraf>glob entfernen
Beide Overrides tragen im Kommentar ihre eigene Ausstiegsbedingung. Sie ist erreicht: das installierte nx 24.0.5 deklariert undici 7.30.1 (Bedingung: >=7.29.1; der Kommentar nennt 24.0.3 als Fix), und rimraf 6.1.4 aus dem Catalog hängt direkt an glob ^14.0.3 (Bedingung: >=14.0.2). Die Overrides sind damit totes Gerüst, das künftige Resolver-Entscheidungen still verbiegt und bei einem nx-Major unerwartet weiter greift.
Beleg: node_modules/nx/package.json: dependencies.undici = 7.30.1; node_modules/rimraf/package.json 6.1.4: dependencies.glob = ^14.0.3; pnpm-lock.yaml:7300 `glob: 14.0.3`
Empfehlung: Beide Einträge aus overrides streichen, `pnpm install` laufen lassen und prüfen, dass pnpm-lock.yaml unverändert bleibt (außer dem overrides-Block); dabei die Kommentare der übrigen Einträge (minimatch-Ignore, packageExtensions) gegen die aktuelle Lage prüfen.

**DEP-002 · low · pnpm-workspace.yaml:59** — Offenes picomatch-Advisory (GHSA-fc5q-39xc-vjpf) bewerten und in auditConfig dokumentieren
`pnpm audit --audit-level=high` meldet picomatch <=4.0.7 (ReDoS durch Extglobs) als high, ohne gepatchte Version. Pfade: apps/lookbook > @astrojs/check > @astrojs/language-server > tinyglobby und apps/lookbook > astro > unstorage > anymatch — beide nur Lookbook-Tooling. Die ignoreGhsas-Liste enthält zwei Advisories mit Begründung, dieses fehlt; der CI-Schritt 'Audit dependencies' wirft damit bei jedem Push eine Warnung, die man bald nicht mehr liest. Der Deploy-Filter prüft nur die Importer Root und Library und bleibt unberührt.
Beleg: `pnpm audit --audit-level=high`: `picomatch vulnerable to ReDoS through single-branch repeated extglobs … Patched versions <0.0.0`; Pfade über apps__lookbook
Empfehlung: Erreichbarkeit prüfen (Muster kommen aus dem Repo, nicht von außen) und die GHSA mit Begründung und Ausstiegsbedingung in auditConfig.ignoreGhsas eintragen, bis ein Fix erscheint; alternativ per Override auf eine gepatchte Version heben, sobald es sie gibt.

**BUILD-001 · low · scripts/lookbook/previewServer.mjs:45** (auch `:69`, `scripts/lookbook/demoPreviewConfig.mjs:26`) — Preview-Server unter Windows ohne Prozessgruppe beenden oder die Plattform ausschließen
chromiumGpuArgs() behandelt macOS und Windows ausdrücklich als Zielplattformen des Preview-Generators. previewServer.mjs startet aber pnpm detached und beendet die Gruppe mit process.kill(-pid, 'SIGTERM'); negative PIDs und Prozessgruppen gibt es unter Windows nicht, der catch schluckt den Fehler und der astro-Prozess bleibt nach dem Lauf stehen. Auch spawn('pnpm') ohne shell findet unter Windows nur eine pnpm.exe, keine pnpm.cmd. Ungeprüft, da kein Windows-Rechner in dieser Sitzung.
Beleg: `process.kill(-child.pid, 'SIGTERM')` mit `catch { // the group is gone already }`
Empfehlung: Entweder die Unterstützung auf POSIX beschränken (Kommentar und Fehlermeldung bei process.platform === 'win32') oder unter Windows taskkill /T /PID benutzen.

**BUILD-002 · low · nx.json:69** (auch `packages/twopoint5d/project.json:33`) — Node-Version in den Nx-Hash der Vitest- und Allocation-Targets aufnehmen
Der Nx-Hash von `test`, `coverage` und `allocations` enthält die Node-Version nicht; AGENTS.md verlangt deshalb nach jedem Node-Upgrade einen manuellen Lauf mit --skip-nx-cache, sonst spielt der Cache eine unter altem V8 gemessene Allokationsmessung ab. Die CI umgeht das über den Cache-Key (ci.yml:169), lokal bleibt es eine Merkregel. Die Allokationsspecs hängen laut Kommentaren an V8-Inlining und Feedback.
Beleg: vitestDefaults: nur externalDependencies, kein `{"runtime": "node --version"}`
Empfehlung: Dem Input `vitestDefaults` (oder allein den allocations-Targets) `{"runtime": "node --version"}` hinzufügen; die Merkregel in AGENTS.md entfällt dann.

**SEC-001 · low · .github/dependabot.yml:46** — Cooldown für Dependabot-Updates der GitHub Actions setzen
Für das npm-Ökosystem wartet Dependabot einen Tag (cooldown), passend zu minimumReleaseAge; das github-actions-Ökosystem hat keinen. Die Workflows pinnen Actions auf Commit-SHAs, und die Publish-Pipeline nutzt OIDC; ein kompromittierter Action-Release würde sofort als PR vorgeschlagen und in der Gruppe 'actions' zusammen mit unkritischen Updates gemerged werden können.
Beleg: `package-ecosystem: github-actions` ohne `cooldown`
Empfehlung: `cooldown: {default-days: 3}` (oder mehr) für github-actions ergänzen; Updates der Actions, die im deploy.yml Schreib- oder OIDC-Rechte haben, einzeln statt in der Sammelgruppe vorschlagen lassen.

**CONS-010 · low · scripts/makePackageJson.mjs:21** (auch `scripts/makePackageJson/resolveDependencies.mjs:16`, `scripts/publishNpmPkg.mjs:34`, `scripts/publishNpmPkg/parseArguments.mjs:8`) — Fehlermeldungen und Argument-Parsing der Skripte angleichen
Die meisten Skripte schreiben Fehler mit Subjekt vorn (checkDocSnippets:, runExclusive:, nx cache server:, generateDemoPreviews:). makePackageJson.mjs und publishNpmPkg.mjs schreiben cannot read / cannot publish ohne Skriptnamen, resolveDependencies.mjs warnt mit oops.. und Satzfetzen als console.warn-Argumentliste. Argumente parsen nxCacheServer, runExclusive, auditInstalledDependencies und demoPreviewConfig mit node:util parseArgs, publishNpmPkg mit einer handgeschriebenen Schleife, obwohl node:util ein Built-in ist und das Builtin-Gebot dort nicht verletzt.
Beleg: `console.warn('oops.. package not found in workspace catalog:', catalogName, pkgName, 'referenced from:', referencedFrom)`
Empfehlung: Meldungen im Muster `<skript>: <was ist falsch>` ausgeben und parseArguments auf parseArgs mit strict: true umstellen; builtinImportsOnly.test.mjs bleibt grün.

**DX-001 · low · AGENTS.md:255** — Größenangaben der Module in AGENTS.md an den Stand anpassen
`AGENTS.md` empfiehlt Agenten, ein Modul per `cat src/<module>/*.ts` am Stück zu lesen, weil `map2d` mit rund 3,4k Zeilen das größte sei und die meisten unter 2k blieben. Gemessen (ohne Specs, nur die oberste Ebene) liegt `stage/` bei 13 161 Zeilen, `texture/` bei 9 069, `display/` bei 6 768 und `vertex-objects/` bei 6 049; `map2d/` hat 5 568. Ein Agent, der der Regel folgt, lädt mit `stage/` rund eine halbe Million Zeichen in einen Aufruf und verliert dabei Kontext statt ihn zu gewinnen.
Beleg: `map2d` is the largest at roughly 3.4k lines, most stay under 2k — gemessen: stage 13 161, texture 9 069, display 6 768
Empfehlung: Die Zahlen nachführen und die Regel für die großen Module einschränken: `stage/` und `texture/` nach Teilbereichen lesen (etwa Camera-Rig, Director, Renderer), statt das ganze Verzeichnis zu laden; die Zahlen lassen sich im CI-Check der Doku mit `wc -l` gegenprüfen.

**DX-002 · low · README.md:78** — Repository-Übersicht im README um Testpaket, Lookbook und scripts ergänzen
Der Abschnitt 'What's in this repository' sagt, das Monorepo enthalte 'the following libraries' und nennt nur @spearwolf/twopoint5d. Das Browser-Testpaket, die Lookbook-App und scripts/ stehen nur in AGENTS.md. Ein Neuling erfährt aus dem README nicht, wo die Browser-Tests liegen, obwohl 'pnpm cbt' sie startet.
Beleg: README.md:80-84 listet ein Paket
Empfehlung: Drei Zeilen ergänzen (apps/lookbook, packages/twopoint5d-testing, scripts/) oder auf die Projekttabelle in AGENTS.md verweisen.

**Offene Frage 4 des Audits** — `publishNpmPkg.mjs` überspringt nur `-dev`-Versionen und übergibt kein `--tag`: eine Prerelease wie `1.0.0-beta.1` würde unter `latest` veröffentlicht. Gibt es eine Versionspolitik für Prereleases?
Antwort (»Entscheidungen«, 2026-11-17): `scripts/publishNpmPkg.mjs` übergibt bei einer Prerelease-Version (`x.y.z-<tag>.n`, außer `-dev`) `--tag next`. Getestet wird das über `test:scripts`; publiziert wird in diesem Lauf nichts.
