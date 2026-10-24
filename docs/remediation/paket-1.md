# Paket 1 — Abhängigkeiten, Nx-Inputs und CI-Matrix

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: DEP-001 (high), BUILD-001 (medium), DEP-002 (low), DX-003 (low), BUILD-002 (low)
- Ziel: Die Lookbook-Abhängigkeiten sind ohne bekannte Advisories, Nx invalidiert Tests bei Fixture-Änderungen, und CI prüft beide zulässigen Node-Versionen.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `package.json` (Root)
  - `apps/lookbook/package.json`
  - `pnpm-workspace.yaml`
  - `pnpm-lock.yaml` (nur über `pnpm install`, nie von Hand)
  - `packages/twopoint5d/project.json`
  - `scripts/nxInputs/libraryVitestInputs.test.mjs` (neu)
  - `.github/workflows/ci.yml`
  - `.github/dependabot.yml`
  - `AGENTS.md`
  - `docs/architecture.md` (§2, §3 »In CI«, §5, §6)
  - kein Eintrag in `packages/twopoint5d/CHANGELOG.md`: nichts davon ist für Nutzer der Library sichtbar
- Arbeitsverzeichnis für Logs und Wegwerfdateien: `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad` (im Folgenden `$ARBEITSDIR`), nie das Repo

## Vorgehen

Code, Kommentare und Doku auf Englisch (AGENTS.md). Die Kommentartexte unten sind
Vorlagen; Wortlaut darf sich dem Umfeld anpassen, der Inhalt nicht. Keine Finding-IDs,
kein »previously«/»now«/»no longer« in Kommentaren und Doku.

### Schritt 1 — Regressionstest für die Nx-Inputs (BUILD-001), erst rot, dann grün

1. Neue Datei `scripts/nxInputs/libraryVitestInputs.test.mjs`, gebaut nach dem Muster
   von `scripts/checkDocSnippets/typecheckInputs.test.mjs` (dieselbe Auflösung von
   `nxBin` über `createRequire(...).resolve('nx/bin/nx.js')`, `process.execPath` als
   Interpreter, `NX_DAEMON: 'false'` im `env`, `node:test` + `node:assert/strict`).
   Kein gemeinsamer Helfer mit der Schwesterdatei: zwei Aufrufer tragen die Auslagerung
   nach `scripts/shared/` nicht, und jede Datei dort ist Input von
   `twopoint5d-testing:typecheck`.
   - Kopfkommentar (Vorlage): »The library's specs read fixtures at runtime — bitmap
     fonts, atlas JSON, images, the graphs of `presetGraphs.spec.ts` — from
     `src/**/fixtures/`, and Nx replays a cached result of `test`, `coverage` and
     `allocations` as long as their inputs hash the same. This spec holds those inputs
     to every file git tracks under `packages/twopoint5d/src/`, so a changed fixture runs
     its specs again.«
   - `tracked` = `git ls-files -z -- packages/twopoint5d/src` (cwd `repoRoot`), gesplittet
     an `\0`, leere Einträge raus.
   - Je Target aus `['test', 'coverage', 'allocations']` ein `it(...)` mit dem Titel
     `` `every tracked file under packages/twopoint5d/src is an input of twopoint5d:${target}` ``:
     `nx show target inputs twopoint5d:<target> --json` ausführen, `{files}` lesen,
     `assert.deepEqual(tracked.filter((file) => !inputs.has(file)), [], <message>)`.
   - Message (Vorlage): »these tracked files under packages/twopoint5d/src are no input
     of twopoint5d:<target>, so a change to them leaves an old result in the Nx cache;
     widen the inputs of the target in packages/twopoint5d/project.json«.
2. `node --test scripts/nxInputs/libraryVitestInputs.test.mjs` laufen lassen, **rot**
   sehen: alle drei Tests listen die 17 Fixture-Dateien unter `src/**/fixtures/` und die
   beiden `src/stage/README.md`, `src/vertex-objects/README.md`. Ausgabe in den Report.
3. `packages/twopoint5d/project.json`: in `test`, `coverage` und `allocations` den Eintrag
   `"{projectRoot}/src/**/*.ts"` durch `"{projectRoot}/src/**/*"` ersetzen. Sonst nichts
   an der Datei. `build` und `typecheck` bleiben: `tsc` liest keine Fixtures, und in
   `src/` importiert keine `.ts`-Datei JSON (nachgesehen: nur `readFileSync` zur Laufzeit
   in `AsepriteJson.spec.ts`, `TexturePackerJson.freeTexPacker.spec.ts`,
   `BitmapFont.spec.ts`, `layoutText.spec.ts`, `presetGraphs.spec.ts`,
   `typed-stages.spec.ts`).
4. Denselben Test erneut: **grün**.

### Schritt 2 — Advisories räumen (DEP-001)

Ziel: `pnpm audit` **und** `pnpm audit --prod` enden mit »No known vulnerabilities
found«, und zwar ohne `auditConfig`. Der Weg ist in einer Wegwerfkopie der Manifeste
durchgespielt (Lockfile-only, pnpm 10.27.0) und endet genau so.

Warum dieser Weg und nicht `pnpm update -r vite sharp source-map-js smol-toml` aus der
Empfehlung: `pnpm update` hebt in pnpm 10.27 nur direkte Abhängigkeiten; vite,
source-map-js, smol-toml und follow-redirects sind transitiv und blieben im Test stehen.
Stattdessen werden die direkten Abhängigkeiten angehoben, deren neue Ranges die
gepatchten Versionen erzwingen, und nx auf die Version, die ihre alten Pins selbst
mitbringt — die Kommentare der nx-Overrides nennen genau das als Ausstiegsbedingung.

1. Root `package.json`: `"nx": "23.2.1"` → `"nx": "23.3.0"` (exakter Pin bleibt exakt).
   nx 23.3.0 pinnt `smol-toml` 1.9.0 und `brace-expansion` 5.0.12 und hängt nicht mehr an
   `axios`/`follow-redirects`. Kein `nx migrate` nötig: `migrations.json` von nx 23.3.0
   enthält keine Migration jünger als 23.2.0-beta.8.
2. `apps/lookbook/package.json`: `"astro": "^7.3.5"` → `"astro": "^7.4.2"` (astro 7.4.x
   verlangt `vite ^8.3.4` und `smol-toml ^1.9.1`, und zieht `http-cache-semantics` 4.3.0);
   `"sharp": "^0.35.4"` → `"sharp": "^0.35.5"`.
3. `pnpm-workspace.yaml`, Block `overrides`: die drei nx-Einträge samt Kommentaren
   (`'nx>smol-toml'`, `'nx>axios'`, `'nx>brace-expansion'`) entfernen. nx 23.3.0 pinnt
   dafür `undici` 7.29.0, das in zehn Advisories liegt (behoben ab 7.29.1); neuer Eintrag
   mit Kommentar nach dem Muster der alten:
   ```yaml
   overrides:
     # nx 23.3.x pins undici 7.29.0, inside the range of ten advisories that 7.29.1 fixes,
     # GHSA-rfgv-xxqx-mfg5 and GHSA-w293-vg96-wgc3 among them. Drop this entry once the
     # nx in package.json depends on undici >=7.29.1 itself.
     'nx>undici': ^7.29.1
   ```
   Zusätzlich **vorübergehend** `source-map-js: ^1.2.2` in denselben Block (ohne
   Kommentar), dann `pnpm install`.
4. Den vorübergehenden `source-map-js`-Eintrag wieder entfernen, `pnpm install` erneut.
   Grund: alle Ranges, die auf `source-map-js` zeigen (postcss, magicast, css-tree),
   erlauben 1.2.2; nur der Lockfile-Eintrag 1.2.1 bewegt sich nicht von selbst. Nach dem
   zweiten Install bleibt 1.2.2 stehen, ein dauerhafter Override wäre ohne Grund.
   Prüfen: `grep -nE "^  (source-map-js|vite|sharp|smol-toml|undici|follow-redirects|axios)@" pnpm-lock.yaml`
   zeigt `source-map-js@1.2.2` allein, `vite@8.3.5`, `sharp@0.35.5`, `smol-toml` nur
   ≥ 1.9.0, `undici@7.30.1` (neben `undici@8.10.2`), kein `follow-redirects`, kein `axios`.
5. `pnpm-workspace.yaml`: den ganzen Block `auditConfig` samt Kommentar entfernen.
   Beide Ignores laufen danach ins Leere: GHSA-vfj7-8cjw-p6xm (braces) trifft schon
   heute nichts (`braces@3.0.3` wird nicht gemeldet), GHSA-ch52-4w7c-c8xp
   (`http-cache-semantics` ≤ 4.2.0) nicht mehr, sobald astro 7.4.2 4.3.0 zieht. Danach
   `pnpm audit` und `pnpm audit --prod`: beide »No known vulnerabilities found«, Exit 0.
   Meldet eines davon wieder eine der beiden GHSAs, bleibt nur dieser Eintrag mit seinem
   Kommentar stehen.
6. Erwarteter Lockfile-Diff (aus der Simulation, zur Plausibilisierung): nx und
   `@nx/nx-*` 23.2.1 → 23.3.0; astro 7.3.5 → 7.4.2 samt `@astrojs/*`, shiki 4.5.0,
   rolldown 1.2.15, unifont 1.0.3, devalue 6.0.3; sharp und `@img/sharp-*` 0.35.5,
   `@img/sharp-libvips-*` 1.3.4; vite 8.3.5, postcss 8.5.31; entfallen: axios,
   follow-redirects, form-data, https-proxy-agent, agent-base, proxy-from-env, flat,
   js-yaml, ohash u. a. Weicht er grob ab (neue Major-Sprünge außer devalue/unifont,
   die astro selbst verlangt), im Report melden.
7. Bricht die Gate an astro 7.4 (`astro check`, `lookbook:build`): die Lookbook-Stelle
   mitziehen, das ist Teil dieses Pakets. Bricht sie an nx 23.3.0 so, dass eine kleine
   Konfig-Anpassung nicht reicht (auch: Smoke-Test in Schritt 7 scheitert), Ausweichweg:
   nx bleibt 23.2.1; Overrides dann `'nx>smol-toml': ^1.9.0` (Kommentar auf
   GHSA-r4xh-jqrq-34v2 und »>=1.9.0« umstellen), `'nx>axios'` und `'nx>brace-expansion'`
   bleiben, neu `follow-redirects: ^1.16.1` mit Kommentar (nx 23.2.x pinnt 1.16.0, axios
   1.20.0 verlangt ^1.16.0; GHSA-q3jh-wrc6-jgq8 und GHSA-8r9p-f939-6h3c, behoben in
   1.16.1; Eintrag geht, sobald nx 23.3 oder später im Root steht). Der Ausweichweg und
   sein Grund gehören in den Report, die Commit-Message nennt dann nicht »nx 23.3.0«.

### Schritt 3 — Script `update` entfernen (DX-003)

1. Root `package.json`: Zeile `"update": "pnpm dlx npm-check --update",` entfernen.
2. `apps/lookbook/package.json`: dieselbe Zeile entfernen (dieselbe Ursache: ungepinntes
   `dlx`, das am Catalog vorbei Manifeste umschreibt).
3. Der Verweis auf `pnpm outdated -r` und Dependabot kommt in Schritt 6 in `AGENTS.md`
   und `docs/architecture.md` §5.

### Schritt 4 — Mindestalter für neue Versionen (DEP-002)

Erst nach Schritt 2 eintragen.

1. `pnpm-workspace.yaml`, zwischen `catalog` und `onlyBuiltDependencies`:
   ```yaml
   # pnpm resolves no version published less than a day ago: a compromised release is
   # usually found and pulled within hours. The own packages are exempt, so a release of
   # eventize or signalize can be taken the day it ships. Dependabot waits as long
   # (cooldown in .github/dependabot.yml).
   minimumReleaseAge: 1440
   minimumReleaseAgeExclude:
     - '@spearwolf/*'
   ```
   Danach `pnpm install`: das Lockfile bleibt unverändert (in der Simulation geprüft;
   alle in Schritt 2 gewählten Versionen sind älter als ein Tag).
2. `.github/dependabot.yml`, im Eintrag `package-ecosystem: npm` nach `schedule`:
   ```yaml
       # pnpm-workspace.yaml has pnpm refuse a version younger than a day
       # (minimumReleaseAge); Dependabot waits as long, or the install of its update fails
       cooldown:
         default-days: 1
         exclude:
           - '@spearwolf/*'
   ```
   Grund: ohne Cooldown schlägt jeder Dependabot-Lauf fehl, der eine weniger als einen
   Tag alte Version vorschlägt — in der Gruppe `toolchain` reißt das den ganzen PR mit.
   Nicht beim Eintrag `github-actions`; pnpm betrifft ihn nicht.
3. Im selben File den Kommentar über `@types/node` nachziehen: »the one the workflows
   run« → »the one every workflow runs« (Node 24 läuft weiter in jedem Workflow, Node 26
   nur zusätzlich im Checks-Job).

### Schritt 5 — CI: Checks auf Node 24 und 26, Audit sichtbar (BUILD-002, DEP-001)

Alles in `.github/workflows/ci.yml`. `deploy.yml` und `bench.yml` bleiben auf `24`.

1. Matrix: jeder Eintrag bekommt `node:`; `checks` steht zweimal. Kommentar über
   `include` (Vorlage):
   ```yaml
       matrix:
         # ci:checks runs on both Node lines engines allows: it is the part in which Node
         # runs the tooling itself — the build, the type checks, the package checks and
         # the node --test specs of the scripts. The other parts run on 24 alone
         include:
           - task: checks
             name: Lint, build and check (Node 24)
             run: pnpm run ci:checks
             node: 24
           - task: checks
             name: Lint, build and check (Node 26)
             run: pnpm run ci:checks
             node: 26
           - task: coverage
             name: Unit tests with coverage
             run: pnpm run test:coverage
             node: 24
           - task: allocations
             name: Hot-path allocations
             run: pnpm run test:allocations
             node: 24
           - task: browser
             name: Browser tests
             run: xvfb-run pnpm run test:browser
             browsers: true
             node: 24
   ```
   Den Checks-Job symmetrisch »(Node 24)« zu benennen ist unbedenklich: `main` hat keine
   Required Status Checks (`gh api …/branches/main/protection` → `contexts: []`), und
   `deploy.yml` folgt per `workflow_run` dem Ergebnis des ganzen Laufs, nicht Jobnamen.
2. `actions/setup-node`: `node-version: 24` → `node-version: ${{ matrix.node }}`.
3. Nx-Cache: Node-Linie in Key und beide Restore-Keys, für alle Jobs gleich:
   `nx-${{ runner.os }}-${{ matrix.task }}-node${{ matrix.node }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}`,
   Restore-Keys `nx-${{ runner.os }}-${{ matrix.task }}-node${{ matrix.node }}-${{ hashFiles('pnpm-lock.yaml') }}-`
   und `nx-${{ runner.os }}-${{ matrix.task }}-node${{ matrix.node }}-`. Den bestehenden
   Kommentar ergänzen (Vorlage): »The Node line is part of the key because the Nx hash
   of a task leaves it out: the Node 26 job would otherwise replay what the Node 24 job
   computed and check nothing.« Das ist der Kern von BUILD-002 — ohne ihn bestünde der
   Node-26-Job aus Cache-Treffern des 24er-Jobs.
4. Schritt `Audit dependencies` ersetzen:
   ```yaml
         - name: Audit dependencies
           # reports high and critical advisories without failing the run: the published
           # package declares peer dependencies only (lintPkg holds that), so whatever this
           # finds sits in tooling, and Dependabot proposes the update that fixes it. A hit
           # puts a warning on the summary page of the run and the report into the job
           # summary, where it does not sit unread in the log of a green step;
           # continue-on-error keeps an audit that times out from failing the job. The
           # dependencies are the same under both Node lines, so one job audits them
           if: matrix.task == 'checks' && matrix.node == 24
           run: |
             status=0
             pnpm audit --audit-level=high > "$RUNNER_TEMP/pnpm-audit.txt" 2>&1 || status=$?
             cat "$RUNNER_TEMP/pnpm-audit.txt"
             if [ "$status" -ne 0 ]; then
               echo "::warning title=pnpm audit::pnpm audit --audit-level=high exited with $status: high or critical advisories, or no answer from the registry. The job summary holds the report."
               {
                 echo '### pnpm audit --audit-level=high'
                 echo
                 echo '```'
                 cat "$RUNNER_TEMP/pnpm-audit.txt"
                 echo '```'
               } >> "$GITHUB_STEP_SUMMARY"
             fi
           continue-on-error: true
           timeout-minutes: 2
   ```
5. Nichts sonst an der Datei; die Playwright-Schritte bleiben `chromium firefox`
   (WebKit ist Paket 2).

### Schritt 6 — Doku nachziehen

`AGENTS.md`:
1. In der Liste von `pnpm test:scripts` nach »one that asks Nx whether every tracked
   Markdown file is an input of the docs' type check,« einfügen: »one that asks Nx
   whether every tracked file under the library's `src/` is an input of its Vitest
   targets,«.
2. Zeile 91: »CI runs the four parts as parallel jobs.« → »CI runs the four parts as
   parallel jobs, `ci:checks` once on Node 24 and once on Node 26.«
3. Unter `## Commands` direkt nach `- \`pnpm install\`` ein Punkt: »`pnpm outdated -r` —
   what is behind in every project of the workspace, the catalog included; updates come
   through Dependabot (`.github/dependabot.yml`), and pnpm installs no release younger
   than a day (`minimumReleaseAge` in `pnpm-workspace.yaml`)«.

`docs/architecture.md`:
1. §2, nach dem Absatz über das Target `allocations` (»It adds the target `allocations`
   … cached with the same inputs.«) ein Absatz (Vorlage): »The inputs of `test`,
   `coverage` and `allocations` are `vitestDefaults` and every file under `src/`, not
   only its `.ts` files: specs read fixtures at runtime — bitmap fonts, atlas JSON,
   images and the graphs of `presetGraphs.spec.ts` under `src/**/fixtures/` —, and a
   changed fixture has to run them again. `scripts/nxInputs/libraryVitestInputs.test.mjs`
   asks Nx for the inputs it resolves for the three targets and fails on a tracked file
   under `src/` outside them.«
2. §3 »In CI«, erster Absatz: aus »in four jobs side by side — one matrix job per part«
   wird fünf Jobs; `ci:checks` läuft unter Node 24 und Node 26, den beiden Linien, die
   `engines` erlaubt, die anderen drei Teile unter 24 allein. Der Satz über `fail-fast`
   und »Re-run failed jobs« bleibt.
3. §3, Absatz »The step `Audit dependencies` …«: der Schritt läuft im Node-24-Job von
   `ci:checks`; ein Treffer — oder ein Audit, das keine Antwort bekommt — setzt eine
   Warnung auf die Übersichtsseite des Laufs und den Report in die Job Summary; ein
   Timeout lässt den Job grün.
4. §3, Absatz zum Nx-Cache (»Each job keeps a cache of its own — …«): Key-Schema
   `nx-<os>-<job>-node<line>-<hash of pnpm-lock.yaml>-<commit sha>`, Fallbacks
   entsprechend; »Four jobs of one commit« → »Five jobs of one commit«; ein Satz, dass
   die Node-Linie im Key steht, weil der Nx-Hash eines Tasks sie nicht enthält und der
   Node-26-Job sonst die Ergebnisse des 24er-Jobs abspielte.
5. §5, nach dem Dependabot-Absatz (endet mit »… says when the entry can go.«) ein
   Absatz (Vorlage): »pnpm resolves no version younger than a day (`minimumReleaseAge:
   1440` in `pnpm-workspace.yaml`): a compromised release is usually found and pulled
   within hours, and the day keeps it out of every fresh resolution. The packages under
   `@spearwolf/` are exempt (`minimumReleaseAgeExclude`), so a release of eventize or
   signalize can be taken the day it is published. Dependabot waits the same day
   (`cooldown`), or the install of an update to a younger version would fail.
   `pnpm outdated -r` lists what is behind in every project of the workspace, the
   catalog entries included; an update comes through Dependabot or by hand, a catalog
   entry in `pnpm-workspace.yaml`.«
6. §5, Node-Absatz: »`.nvmrc`, `mise.toml` and the `node-version` of the CI workflows
   name a plain `24`.« so fassen, dass Node 24 in jedem Workflow läuft und der Job
   `ci:checks` von `ci.yml` zusätzlich auf einem plain `26` (§3), damit auch der zweite
   Zweig der Range von einem Lauf gedeckt ist; »the one the workflows run on« → »the one
   every workflow runs on«. Der Rest des Absatzes bleibt.
7. §6: »and four more specs share that run« → »five«, »The four are:« → »The five
   are:«, neuer Punkt nach dem über `typecheckInputs.test.mjs`:
   »`scripts/nxInputs/libraryVitestInputs.test.mjs` runs git and Nx as well: it holds the
   inputs of the library's `test`, `coverage` and `allocations` to every file git tracks
   under `packages/twopoint5d/src/`, fixtures included (§2).«

Danach in beiden Dateien nach weiteren Stellen suchen, die die Änderungen falsch
machen (`grep -n "four jobs\|node-version\|update\b\|overrides\|ignoreGhsas\|auditConfig" AGENTS.md docs/architecture.md README.md`)
und mitziehen.

### Schritt 7 — Smoke-Test des Nx-Cache-Servers mit nx 23.3.0

nx 23.3.0 spricht den selbstgehosteten Remote-Cache ohne axios an; die lokale Gate
berührt diesen Weg nicht, CI schon. Einmal lokal durchspielen, Ausgabe nach
`$ARBEITSDIR/paket-1.nxcache-smoke.log`:

```bash
dir="$ARBEITSDIR/nx-cache-smoke"; rm -rf "$dir"; mkdir -p "$dir"
token="smoke-$RANDOM"
NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="$token" node scripts/ci/nxCacheServer.mjs --dir "$dir" --port 47873 > "$ARBEITSDIR/paket-1.nxcache-server.log" 2>&1 &
srv=$!
curl --silent --output /dev/null --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:47873/v1/cache/0
export NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:47873 NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="$token" NX_DAEMON=false
pnpm nx reset && pnpm nx run scripts:typecheck     # läuft, schreibt ins Remote
ls -la "$dir"                                       # mindestens ein Eintrag
pnpm nx reset && pnpm nx run scripts:typecheck     # muss aus dem Remote-Cache kommen
kill "$srv"
```

Erwartet: der zweite Lauf meldet den Treffer aus dem Remote-Cache, das Server-Log zeigt
ein PUT und ein GET mit 200. Scheitert das an nx 23.3.0: Ausweichweg aus Schritt 2.7.

## Verify

In dieser Reihenfolge, jeweils Ausgabe und Exit-Code ins Log:

1. `pnpm audit` und `pnpm audit --prod` → je »No known vulnerabilities found«, Exit 0
2. `node --test scripts/nxInputs/libraryVitestInputs.test.mjs` → grün (rot vor Schritt 1.3)
3. `node --input-type=module -e "import {parse} from 'yaml'; import {readFileSync} from 'node:fs'; for (const f of ['.github/workflows/ci.yml', '.github/dependabot.yml', 'pnpm-workspace.yaml']) parse(readFileSync(f, 'utf8'), {strict: true, uniqueKeys: true}); console.log('yaml ok');"` (aus dem Repo-Root)
4. Smoke-Test aus Schritt 7
5. `NX_SKIP_NX_CACHE=true NX_DAEMON=false mise exec node@26 -- pnpm run ci:checks` → Exit 0
   (Node 26.12.1 ist über mise installiert; ohne `NX_SKIP_NX_CACHE` spielte Nx die
   Ergebnisse des 24er-Laufs ab)
6. `pnpm run ci` → Exit 0 (die Gate aus dem Plan-Kopf, Baseline grün)

## Commit

`build(deps): clear every advisory with nx 23.3.0, astro 7.4 and sharp 0.35.5, hold back releases younger than a day, drop the update script, let the spec fixtures invalidate the test cache and run the checks on Node 26 as well`

Beim Ausweichweg aus Schritt 2.7 statt »with nx 23.3.0, astro 7.4 and sharp 0.35.5«:
»with astro 7.4, sharp 0.35.5 and overrides for the pins of nx«.

## Für Zug 5: Schnittstellen

Paket 2 ändert dieselbe `ci.yml`. Nach dem Commit gehört unter das Paket im Plan:
`Schnittstellen: ci.yml — jeder Matrix-Eintrag trägt node:, checks steht zweimal
(24 und 26); Nx-Cache-Key nx-<os>-<task>-node<line>-…; Audit-Schritt nur bei
task == 'checks' && node == 24 · pnpm-workspace.yaml — minimumReleaseAge 1440,
kein auditConfig, Override nx>undici · Root-Script update entfernt`.

## Abgleich (Zug 0, 2026-10-23)

- **DEP-001** — unverändert. `pnpm-lock.yaml:7786` `vite@8.3.2`, `:7399` `sharp@0.35.4`,
  `apps/lookbook/package.json:33` `"sharp": "^0.35.4"`, `apps/lookbook/astro.config.mjs:10`
  `host: true`, `.github/workflows/ci.yml:81-82` `pnpm audit --audit-level=high` mit
  `continue-on-error: true`. `pnpm audit --prod` heute: 10 Advisories (1 low, 5 moderate,
  4 high, 1 ignoriert) — wie im Audit. Breiter als beschrieben: dieselbe vite-Instanz
  hängt auch an `vitest` im Root, `source-map-js` 1.2.1 auch an
  `@vitest/coverage-v8>magicast`, `smol-toml` 1.8.0 auch an `nx`.
- **BUILD-001** — unverändert. `packages/twopoint5d/project.json:26,30,35` je
  `["vitestDefaults", "{projectRoot}/src/**/*.ts"]`; 17 Fixture-Dateien unter
  `src/{text,texture/aseprite,texture/free-tex-packer,sprites/FeatureSprites}/fixtures/`.
  `typecheck` braucht keine Erweiterung (keine JSON-Imports).
- **DEP-002** — unverändert. `pnpm-workspace.yaml` ohne `minimumReleaseAge`;
  `packageManager` `pnpm@10.27.0`.
- **DX-003** — unverändert, `package.json:34`. Dieselbe Zeile zusätzlich in
  `apps/lookbook/package.json:11` — gleiche Ursache, mitgenommen.
- **BUILD-002** — unverändert. `.github/workflows/ci.yml:69` `node-version: 24` gegen
  `package.json:9` `"node": "^24.16.0 || >=26.3.0"`; `deploy.yml:94,141`, `bench.yml:38`
  ebenfalls 24 und bleiben es (Entscheidung: nur der Checks-Job wird Matrix).

## Triage und Nebenbefunde (Zug 0)

Keine Folgen aus erledigten Paketen (Paket 1 ist das erste), »Offene Befunde« leer.
Drei Nebenbefunde, alle mit derselben Ursache wie DEP-001/DX-003 und deshalb in diesem
Paket, keiner in die Queue:

- `follow-redirects` 1.16.0 über `nx` (direkt und über `axios`), GHSA-q3jh-wrc6-jgq8 und
  GHSA-8r9p-f939-6h3c, Advisory-Severity high, angelegt 2026-10-20 — vorbestehend, im
  Audit nicht erfasst, weil es nur `pnpm audit --prod` las. Severity als Befund geschätzt
  **low**: nx spricht HTTP nur mit dem eigenen Cache-Server auf `127.0.0.1` in CI, Nx Cloud
  ist nicht konfiguriert, ein Redirect zu fremdem Origin ist nicht erreichbar. Ursache
  wie bei `nx>smol-toml` (veraltete Pins von nx 23.2.1); verschwindet mit nx 23.3.0 aus
  dem Baum. → Scope, in diesem Paket.
- `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml:29-35` hält zwei Ignores, die nach
  Schritt 2 nichts mehr treffen (Begründung in Schritt 2.5). Ein Ignore ohne Ziel
  verbirgt eine spätere Rückkehr desselben Advisories. → Scope, in diesem Paket.
- `"update": "pnpm dlx npm-check --update"` in `apps/lookbook/package.json:11` — siehe
  DX-003. → Scope, in diesem Paket.

Eigene Folgen der gewählten Wege, im Paket gelöst: nx 23.3.0 bringt `undici` 7.29.0
(Override in Schritt 2.3); `minimumReleaseAge` bräche Dependabot-Updates jünger als ein
Tag (Cooldown in Schritt 4.2); der Node-26-Job würde ohne eigenen Cache-Key nur Treffer
des 24er-Jobs abspielen (Schritt 5.3).

## Abweichungen von den Empfehlungen des Audits

- DEP-001: statt `pnpm update -r <transitive Pakete>` (wirkt in pnpm 10.27 nur auf direkte
  Abhängigkeiten, im Test nachgewiesen) Anheben von nx, astro und sharp plus ein
  vorübergehender Override für `source-map-js`; ein dauerhafter Override nur für undici,
  dessen Range nx exakt pinnt. Zusätzlich wird nicht nur `--prod`, sondern der ganze Baum
  sauber, weil der CI-Schritt den ganzen Baum prüft und die neue Warnung sonst bei jedem
  Lauf feuerte.
- DEP-002: ergänzt um Dependabots `cooldown`, sonst bricht die eigene Änderung den
  Update-Weg, auf den DX-003 verweist.

## Findings im Volltext

**DEP-001 · high · pnpm-lock.yaml:7786** — Vite, sharp und source-map-js im Lookbook auf die gepatchten Versionen heben
Weitere Fundstellen: `apps/lookbook/astro.config.mjs:10`, `pnpm-lock.yaml:7399`, `apps/lookbook/package.json:33`, `.github/workflows/ci.yml:81`
`pnpm audit --prod` meldet 10 Advisories (4 high, 5 moderate, 1 low), alle im Werkzeug des Lookbooks: `vite@8.3.2` über `@tailwindcss/vite` (sechs Advisories, darunter Dateien außerhalb von `server.fs.allow` und die ersten Bytes beliebiger Dateien über `?vite-wasm-instance`), `sharp@0.35.4` (librsvg, CVE-2026-96889), `source-map-js` < 1.2.2 (Event-Loop-DoS) und `smol-toml` über astro. Die Library selbst ist nicht betroffen, sie hat nur Peer-Dependencies. Gewicht bekommen die Vite-Lücken, weil `pnpm lookbook` den Dev-Server laut `astro.config` mit `server.host: true` auf jedem Netzwerk-Interface öffnet: wer im selben WLAN sitzt, erreicht genau die Endpunkte, die die Advisories beschreiben. Für alle betroffenen Pakete gibt es gepatchte Versionen; anders als die zwei Einträge in `auditConfig.ignoreGhsas` ist hier nichts ohne Fix. Der Schritt »Audit dependencies« in `ci.yml` sieht sie, läuft aber bewusst mit `continue-on-error: true` und bleibt grün — die Meldung steht nur im Log eines erfolgreichen Jobs.
Beleg: `vite@8.3.2` (gepatcht ≥ 8.3.3), `sharp@0.35.4` (≥ 0.35.5), `source-map-js` (≥ 1.2.2), `smol-toml` ≤ 1.8.0 (≥ 1.9.0); `host: true` in `apps/lookbook/astro.config.mjs:10`
Empfehlung: `pnpm update -r vite sharp source-map-js smol-toml` bzw. die Lookbook-Abhängigkeiten (`astro`, `@tailwindcss/vite`, `sharp`) anheben, bis `pnpm audit --prod` ohne diese Advisories endet; reicht die Range eines Zwischenpakets nicht, ein `overrides`-Eintrag mit Begründung nach dem Muster der nx-Einträge in `pnpm-workspace.yaml`. Damit ein Treffer des CI-Schritts nicht im grünen Log verschwindet, ihn als Annotation (`::warning::`) oder als Job-Summary ausgeben.

**BUILD-001 · medium · packages/twopoint5d/project.json:25** — Nx-Inputs von test, coverage und allocations um die Nicht-TS-Fixtures der Specs erweitern
Weitere Fundstellen: `packages/twopoint5d/project.json:29`, `packages/twopoint5d/project.json:35`, `nx.json:167`
Die gecachten Targets test, coverage und allocations hashen als Quelleingabe nur {projectRoot}/src/**/*.ts plus Konfig und Lockfile-Abhängigkeiten. Mehrere Specs lesen aber Fixtures, die keine .ts-Dateien sind (src/**/fixtures/ enthält .fnt, .json, .png, .xml, .txt), etwa layoutText.spec.ts per readFileSync('./fixtures/pixel-8.fnt'), AsepriteJson.spec.ts und presetGraphs.spec.ts (preset-graphs.json). Ändert sich nur eine solche Fixture, bleibt der Task-Hash gleich, Nx spielt das alte grüne Ergebnis aus dem Cache ab (lokal und über den Cache-Server in ci.yml) und die Spec läuft nie gegen die neue Fixture.
Beleg: `"inputs": ["vitestDefaults", "{projectRoot}/src/**/*.ts"]` (test, coverage, allocations); layoutText.spec.ts:335 `readFileSync(new URL('./fixtures/pixel-8.fnt', import.meta.url), 'utf8')`
Empfehlung: Die Eingabe auf {projectRoot}/src/** erweitern (Specs und Fixtures zählen dann mit) oder die Fixture-Verzeichnisse ausdrücklich aufnehmen; das gilt auch für typecheck, falls Typ-Imports von JSON darauf zeigen.

**DEP-002 · low · pnpm-workspace.yaml:1** — Mindestalter für neue Paketversionen in pnpm-workspace.yaml setzen
Die Workflows pinnen Actions auf Commit-SHAs, persist-credentials ist aus, überschriebene Advisories sind begründet; die Installation selbst nimmt aber jede frisch veröffentlichte Version in Caret-Bereichen sofort. pnpm 10.16+ (packageManager ist 10.27.0) kennt minimumReleaseAge, das frisch veröffentlichte Versionen eine Zeit lang meidet und das Zeitfenster für kompromittierte Releases schließt.
Beleg: pnpm-workspace.yaml enthält catalog, onlyBuiltDependencies, overrides, auditConfig, aber kein minimumReleaseAge
Empfehlung: `minimumReleaseAge` (etwa 1440 Minuten) setzen, mit minimumReleaseAgeExclude für die eigenen @spearwolf-Pakete.

**DX-003 · low · package.json:34** — Script update ohne ungepinntes dlx und am Catalog vorbei führen
`pnpm dlx npm-check --update` lädt bei jedem Aufruf die jeweils neueste Version eines Fremdpakets und lässt sie Manifeste umschreiben. Die Versionen von three, @types/three, eventize und signalize stehen laut AGENTS.md ausschließlich im Catalog von pnpm-workspace.yaml; ein npm-check, der package.json-Einträge hebt, erfasst sie nicht (oder schreibt `catalog:`-Verweise falsch). Dependabot ist vorhanden (.github/dependabot.yml), das Script ist damit ein zweiter, ungeprüfter Weg.
Beleg: `"update": "pnpm dlx npm-check --update"`
Empfehlung: Das Script entfernen und auf Dependabot sowie `pnpm outdated -r` verweisen, oder auf ein gepinntes Werkzeug mit Catalog-Unterstützung umstellen.

**BUILD-002 · low · .github/workflows/ci.yml:69** — CI auch unter Node 26 laufen lassen, den engines zulässt
Weitere Fundstellen: `package.json:9`, `packages/twopoint5d/package.json:1`
engines im Root-Manifest erlaubt Node ^24.16.0 || >=26.3.0, ci.yml, deploy.yml und bench.yml verwenden ausschließlich node-version 24. Ob Build, Typecheck und die Skripte-Tests unter 26 laufen, wird nirgends geprüft; die Zusage des engines-Feldes ist für den 26er-Zweig unbelegt. Die Bibliothek selbst läuft im Browser, betroffen ist also das Tooling (Vitest, node --test, die Publish-Skripte).
Beleg: `node-version: 24` in allen drei Workflows gegen `"node": "^24.16.0 || >=26.3.0"`
Empfehlung: Den Job checks (nicht den Browser-Job) als Matrix über 24 und 26 fahren, oder engines auf 24 verengen.

## Verlauf

- 2026-10-23 Zug 0: Detailplan steht · DEP-001 unverändert, Pfade breiter (vitest, nx) ·
  BUILD-001 unverändert (`project.json:26,30,35`) · DEP-002 unverändert · DX-003
  unverändert, zweite Stelle `apps/lookbook/package.json:11` · BUILD-002 unverändert
  (`ci.yml:69`) · Nebenbefunde follow-redirects über nx, verwaiste `ignoreGhsas`,
  Lookbook-`update` ins Paket · keine Folgen zu verteilen · Lockfile-Weg in
  Wegwerfkopie geprüft: `pnpm audit` ohne Treffer · Restplan unverändert: Paket 2
  teilt `ci.yml` und `docs/architecture.md`, folgt aber ohnehin auf Paket 1 und baut
  auf der Matrixform auf (Schnittstellen-Zeile nach dem Commit); Paket 3 teilt nur das
  Verzeichnis `scripts/`, nicht die Dateien
- 2026-10-23 Zug 1: Implementierer beauftragt (sonnet, effort medium), Session
  `remediate-twopoint5d-p1-impl-0`, Report nach `$ARBEITSDIR/paket-1.impl-0.json`
- 2026-10-23 Zug 2: Report FERTIG_MIT_VORBEHALT (Server-Log des Smoke-Tests ohne
  PUT/GET; architecture.md nur in §2/3/5/6 gelesen) · Dateien: package.json,
  apps/lookbook/package.json, pnpm-workspace.yaml, pnpm-lock.yaml,
  packages/twopoint5d/project.json, .github/workflows/ci.yml, .github/dependabot.yml,
  AGENTS.md, docs/architecture.md, neu scripts/nxInputs/libraryVitestInputs.test.mjs ·
  roter Lauf belegt (19 Dateien je Target) · Arbeitsbaum schmutzig · eigener Verify
  läuft nach `$ARBEITSDIR/paket-1.verify.log`
- 2026-10-23 Zug 2 (Verify): `$ARBEITSDIR/paket-1.verify.log` exit=0 — audit beide
  sauber, nxInputs-Spec grün, YAML ok, Cache-Smoke 1/1 hit, ci:checks auf Node 26
  grün, `pnpm run ci` grün
- 2026-10-23 Zug 3: Reviewer beauftragt (sonnet, effort medium), Diff
  `$ARBEITSDIR/paket-1.diff`, Report nach `$ARBEITSDIR/paket-1.review-0.json`
- 2026-10-23 Zug 3: Reviewer (`$ARBEITSDIR/paket-1.review-0.json`): alle fünf Findings
  behoben, kritisch 0, wichtig 0, klein 4 · Diff `$ARBEITSDIR/paket-1.diff`
- 2026-10-23 Zug 4: keine Runde (nur kleine Befunde)
- 2026-10-23 Zug 5: Commit 9b72e4bd, 10 Dateien, Trailer `Remediation-Run: 2026-10-23`;
  Verify aus Zug 2 trägt den Commit (keine Codeänderung seither)

## Urteil des Reviewers (Zug 3)

- **DEP-001 — behoben.** `package.json:50` nx 23.3.0, `apps/lookbook/package.json:20`
  astro ^7.4.2, `:27` sharp ^0.35.5; `pnpm-workspace.yaml:27-31` Override `nx>undici`,
  nx-Overrides und `auditConfig` entfernt; Lockfile `vite@8.3.5`, `sharp@0.35.5`,
  `source-map-js@1.2.2` allein, `smol-toml` 1.9.0/1.9.1, `undici@7.30.1` neben 8.10.2,
  kein axios/follow-redirects; Audit-Schritt mit `::warning::` und Job Summary
  `.github/workflows/ci.yml:96-110`.
- **BUILD-001 — behoben.** `packages/twopoint5d/project.json` test/coverage/allocations
  auf `{projectRoot}/src/**/*`; Regressionstest
  `scripts/nxInputs/libraryVitestInputs.test.mjs:21-41`, vor dem Fix rot.
- **DEP-002 — behoben.** `pnpm-workspace.yaml:13-19` `minimumReleaseAge: 1440` mit
  Ausnahme `@spearwolf/*`; `.github/dependabot.yml:15-20` Cooldown; `:39`
  `@types/node`-Kommentar nachgezogen.
- **DX-003 — behoben.** Script `update` aus Root- und Lookbook-`package.json` entfernt;
  Verweis auf `pnpm outdated -r` in `AGENTS.md` (Commands) und `docs/architecture.md` §5.
- **BUILD-002 — behoben.** `.github/workflows/ci.yml:41-67` Matrix mit `node:`, `checks`
  auf 24 und 26; `:80` `${{ matrix.node }}`; Cache-Keys mit Node-Linie `:161-164`;
  Audit nur im 24er-Checks-Job `:95`.
- Commit-Message: ohne ID, ohne Rückblick, Conventional-Commits-Stil.

Kleine Befunde (keine Runde):
- `docs/architecture.md:184-186` (§3 »In CI«) — Zeile deutlich länger als der ~90-Zeichen-
  Umbruch der Datei, Absatz gehört neu umbrochen.
- `docs/architecture.md:210-211` (§3, Absatz zum Audit-Schritt) — dasselbe.
- `docs/architecture.md:440-442` (§5) — kurz geratener Umbruch, unkritisch.
- `docs/architecture.md:210` / `ci.yml:101` — die Warnung greift nur bei einem
  Registry-Fehler mit Exit ≠ 0; ein Timeout bricht den Schritt vor der `if`-Verzweigung
  ab und meldet nichts. Die Doku sagt das (»an audit that times out leaves the job
  green«), Text und Verhalten stimmen also.

Anmerkungen aus dem Implementierer-Report:
- Zusätzlich mitgezogen: Kopfkommentar des Jobs `gate` in `ci.yml` »four jobs« → »five«.
- Smoke-Test: Eintrag im Remote-Verzeichnis und `Cache: 1/1 hit (100%)` im zweiten Lauf
  belegen den Remote-Weg; `scripts/ci/nxCacheServer.mjs` loggt keine Requests, das im
  Detailplan erwartete PUT/GET im Server-Log gibt es daher nicht (keine Abweichung im
  Code, nur in der Erwartung des Plans).
- Nebenbefund (vorbestehend, `git show 7341059f:docs/architecture.md` zählt »four«,
  AGENTS.md führt mehr): Zählung der Specs in §6 zu klein → »Offene Befunde«, low,
  → Scope — die Scope-Regel nimmt jede Severity, keine gemeinsame Ursache mit einem
  offenen Paket außer dem Doku-Bereich von Paket 2/3.
