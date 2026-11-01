# Paket 17 — Drain: Lockfile-Advisories und Hygiene der Specs und Browser-Tests

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Nebenbefunde (aus »Offene Befunde«, Drain-Runde): `pnpm-lock.yaml` minimatch
  GHSA-g3hv-75wg-m249 (moderate), glob GHSA-3g3m-2fjr-6pw4 (moderate), deepmerge
  GHSA-gcqx-w48m-w2h4 (low) · `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  Ressourcen ohne `keep()` (low) · Biome-Warnungen `src/texture/TextureCoords.spec.ts:109`,
  `src/stage/fitIntoRectangle.spec.ts:331-408`, `src/stage/ProjectionPlane.spec.ts:16` (je info)
- Dazu (Zug 0, vorbestehend, gleiche Ursache): der Kommentar des Overrides `'nx>undici'`
  (`pnpm-workspace.yaml:35`) nennt »nx 23.3.x«, im Manifest steht nx 24.0.1 (an d9b648bf
  ebenso) — die Kommentare des `overrides`-Blocks sollen nach `docs/architecture.md` §5 sagen,
  was die verwundbare Version festhält und wann der Eintrag gehen kann; Schritt 1 schreibt den
  Block ohnehin neu
- Ziel: `pnpm audit` meldet für den Workspace keine bekannte Schwachstelle mehr (Override,
  wo eine Version sie behebt, eine dokumentierte Audit-Ausnahme, wo keine Version es kann), die
  Browser-Tests geben jede Ressource über `keep()` frei, und `biome ci` läuft ohne Warnung über
  die Specs.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `pnpm-workspace.yaml`, `pnpm-lock.yaml` (nur über `pnpm install`), `docs/architecture.md`
  (§5, ein Satz), `packages/twopoint5d-testing/test/stage-pipeline.test.js`,
  `packages/twopoint5d/src/texture/TextureCoords.spec.ts`,
  `packages/twopoint5d/src/stage/ProjectionPlane.spec.ts`,
  `packages/twopoint5d/src/stage/fitIntoRectangle.spec.ts`. Kein CHANGELOG-Eintrag (keine
  öffentliche Änderung: Tooling und Tests), kein Guide.

## Vorgehen

**0. Vorher-Läufe festhalten** (die roten Läufe dieses Pakets; Ausgabe in den Report):

```bash
pnpm audit; echo "audit exit=$?"                                  # erwartet exit=1, »4 vulnerabilities found · 1 low | 3 moderate«
pnpm exec biome ci --error-on-warnings .; echo "biome exit=$?"    # erwartet exit=1, »Found 19 warnings«
```

**1. `pnpm-workspace.yaml`** — den Block `overrides:` (`:34-38`) bis zum Dateiende ersetzen
durch genau diesen Text (in einer Probe außerhalb des Repos gegen pnpm 10.27.0 geprüft: parst,
Lockfile-Diff wie in Schritt 2, `pnpm audit` exit 0):

```yaml
overrides:
  # nx 23.3 to 24.0.2 pin undici 7.29.0, inside the range of ten advisories that 7.29.1 fixes,
  # GHSA-rfgv-xxqx-mfg5 and GHSA-w293-vg96-wgc3 among them. Drop this entry once the nx in
  # package.json depends on undici >=7.29.1 itself (24.0.3 does).
  'nx>undici': ^7.29.1
  # rimraf 6.1.3 asks for glob ^13.0.3, inside the range of GHSA-3g3m-2fjr-6pw4, which glob
  # 14.0.2 fixes; glob 14 brings minimatch 11, outside the range of GHSA-g3hv-75wg-m249. rimraf
  # calls glob() and globSync() alone, which glob 14 keeps as they were. Drop this entry once the
  # rimraf in the catalog depends on glob >=14.0.2 itself.
  'rimraf>glob': ^14.0.2

# Advisories that no update and no override can answer. pnpm audit leaves them out, and with it
# the audit step of CI and the audit filter of the deploy (docs/architecture.md §5). Each entry
# says why it cannot reach this workspace and when it can go.
auditConfig:
  ignoreGhsas:
    # minimatch: nx 24.0.0 to 24.0.3 pin minimatch 10.2.5 and call minimatch.makeRe(), which
    # minimatch 11 removes, so an override breaks nx. The advisory needs an optimizationLevel of
    # 2 or more, which nx never sets (the default is 1), and nx matches the patterns of this
    # workspace alone. Drop this entry once the nx in package.json depends on minimatch >=11.0.1.
    - GHSA-g3hv-75wg-m249
    # deepmerge: no release fixes it. Its one caller, the nodeResolvePlugin of @web/dev-server,
    # merges defaults of its own with the nodeResolve option of
    # packages/twopoint5d-testing/web-test-runner.config.js, which is `true`: nothing from outside
    # the repo reaches it. Drop this entry once deepmerge publishes a fix or @web/dev-server lets
    # go of it.
    - GHSA-gcqx-w48m-w2h4
```

Alles oberhalb von `overrides:` (`:1-33`) bleibt Zeichen für Zeichen stehen.

**2. Installieren und das Ergebnis prüfen.**

```bash
pnpm install
git diff --stat -- pnpm-lock.yaml pnpm-workspace.yaml
pnpm install --frozen-lockfile        # was CI tut, muss ohne Änderung durchlaufen
```

Erwarteter Lockfile-Diff, und nur dieser (31 geänderte Zeilen in der Probe): unter
`overrides:` neu `rimraf>glob: ^14.0.2`; `glob@13.0.6` → `glob@14.0.3`, `minimatch@10.2.6` →
`minimatch@11.0.3`, `path-scurry@2.0.2` → `path-scurry@3.0.0`, neu
`'@isaacs/nonrecursive-glob-match@1.0.3'`; `minimatch@10.2.5` (unter `nx@24.0.1`) bleibt.
Bringt `pnpm install` mehr in Bewegung (andere Pakete neu aufgelöst), nicht weiterarbeiten,
kein `pnpm update`, sondern `BLOCKIERT` mit dem Diff. `pnpm install` darf
`pnpm-workspace.yaml` nicht anfassen; `git diff pnpm-workspace.yaml` zeigt nur Schritt 1.
Alle neuen Versionen sind älter als `minimumReleaseAge` (1440 min; jüngste 2026-10-28).

```bash
pnpm audit; echo "audit exit=$?"     # erwartet exit=0, »2 vulnerabilities found · Severity: 1 low (1 ignored) | 1 moderate (1 ignored)«
pnpm audit --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Object.keys(JSON.parse(s).advisories)))'   # erwartet []
# glob 14 unter rimraf einmal wirklich laufen lassen:
d="/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-17-rimraf"; mkdir -p "$d" && touch "$d/a.tmp" "$d/b.keep" && pnpm exec rimraf --glob "$d/*.tmp" && ls "$d"   # erwartet nur b.keep
```

(Das Verzeichnis ist das Arbeitsverzeichnis des Laufs aus dem Plan-Kopf, außerhalb des Repos.)

**3. `docs/architecture.md` §5, `:490-491`** — hinter den Satz »Overrides live in
`pnpm-workspace.yaml`. Each one carries a comment that names the advisory it answers and says
when the entry can go.« diesen Satz anhängen (Absatz und Umbruch bei ~92 Zeichen wie die
Nachbarzeilen):

> An advisory that no update and no override can answer — no release fixes it, or the package
> that depends on it cannot take the release that does — goes into `auditConfig.ignoreGhsas` in
> the same file, with a comment that says why it cannot reach the workspace and when the entry
> can go; `pnpm audit` leaves it out, and with it the audit step of CI (§3) and the audit
> filter of the deploy (§4).

Die Abschnittsnummern stimmen: §3 »The CI gate« mit »In CI« (`:204`, der Audit-Schritt
`:227`), §4 »Build and publish pipeline« (Deploy-Filter `:434`). `scripts/ci/
auditInstalledDependencies/selectAdvisories.mjs` liest `report.advisories`; ausgenommene
Advisories fehlen dort (in der Probe nachgesehen), der Filter bleibt unverändert.

**4. `packages/twopoint5d-testing/test/stage-pipeline.test.js`** — jede Ressource, die ein Test
selbst baut, geht über `keep()`, Testsubjekte über `release()` (Konvention in
`test/helpers/fixtures.js:139-168`: ein Teil vor dem, was ihn hält, der Renderer zuletzt, damit
er zuerst loslässt). Vorbild ist `makeComposedSquare()` (`:97-126`): Stage, Geometrie,
Material, Target, Pipeline, zuletzt `keep(sr)` mit dem Kommentar
`// the renderer lets go first: it holds the stage and the pipeline`. `Stage2D#dispose()` gibt
den Inhalt seiner Szene nicht frei (`src/stage/Stage2D.ts:566-590`), Geometrie und Material
brauchen also ein eigenes `keep()`. `release` in den Import aus `./helpers/fixtures.js` (`:13`)
aufnehmen.

| Test (Zeile) | Was heute nicht über `keep()` geht | Änderung |
| --- | --- | --- |
| `whole-picture mode: pipeline samples internal RT; …` (`:33`) | Stage, Geometrie, Material, Pipeline, Renderer | `const stage = keep(…)`, `const geometry = keep(new PlaneGeometry(50, 50))`, `const material = keep(new MeshBasicMaterial(…))`, `stage.scene.add(new Mesh(geometry, material))`; `const pipeline = keep(new RenderPipeline(display.renderer))`, nach dem Bau von `sr` `keep(sr)` mit Kommentar, dann `sr.pipeline = pipeline`. Der Wrapper um `sr.pipeline.render` bleibt |
| `composed mode: buildOutputNode is invoked, …` (`:65`) | dieselben | wie `:33` |
| `composed mode: a stage disposed while the renderer holds it …` (`:189`) | Geometrie und Material von `first` und von `second`; `second` selbst (das Subjekt, `second.dispose()` `:221`) | beide Geometrien und Materialien über `keep()` wie oben; `keep(second)` direkt hinter `keep(first)` (`:204`); `second.dispose()` → `release(second)` |
| `composed mode: a rebuild without a camera change …` (`:232`) | Stage, Geometrie, Material, Pipeline, Renderer | wie `:33` |
| `stage.dispose() releases the render target …` (`:266`) | Geometrie, Material; Stage und Renderer (Subjekte, `sr.dispose()` `:292`, `stage.dispose()` `:294`) | `const stage = keep(…)`, Geometrie und Material über `keep()`; nach `sr.pipeline = pipeline` `keep(sr)` mit `// the renderer lets go first`; `sr.dispose()` → `release(sr)`, `stage.dispose()` → `release(stage)`. Die Zählung `disposeCalls` (1, dann 2) ändert sich nicht: `release()` ruft `item.dispose()`, also den Wrapper |
| `whole-picture mode: a replaced pipeline takes over the output` (`:300`) | Stage, Geometrie, Material | `const stage = keep(…)`, Geometrie und Material über `keep()`; `first`, `next`, `keep(sr)` bleiben wie sie sind |
| `dispose() drops the pipeline reference …` (`:334`) | die anonyme Stage aus `sr.add(new Stage2D(…))` (`:340`, wird nie freigegeben); Pipeline und Renderer (Subjekte, `sr.dispose()` `:351`, `pipeline.dispose()` `:357`) | `const pipeline = keep(new RenderPipeline(display.renderer))`; `const stage = keep(new Stage2D(…))`, `sr.add(stage)`; danach `keep(sr)` mit `// the renderer lets go first`; `sr.dispose()` → `release(sr)`, `pipeline.dispose()` → `release(pipeline)`. Die Zählung (0, dann 1) bleibt, der Kommentar »the owner disposes it, …« bleibt |

Nicht anfassen: `withSquare()` (`:444-487`) gibt in seinem eigenen `finally` frei, mit
Begründung im Kommentar (eigenes Display je Aufruf); die übrigen Tests halten die Konvention
schon. Kein Test ändert, was er prüft; kein neuer Test.

**5. `packages/twopoint5d/src/texture/TextureCoords.spec.ts`** — den zweiten `describe('root')`
(`:227-233`, ein Test `root is a TextureCoords, never undefined` mit `expectTypeOf`) auflösen:
den Test unverändert als letzten in den ersten `describe('root')` (`:109-130`, hinter
`root is root`) verschieben, den leeren zweiten Block samt Leerzeile löschen.

**6. `packages/twopoint5d/src/stage/ProjectionPlane.spec.ts`** — ebenso: den zweiten
`describe('constructor')` (`:190-196`, ein Test `refuses a custom plane without up`)
unverändert als letzten Test in den ersten `describe('constructor')` (`:16-39`, hinter
`takes a THREE.Plane with an up vector`) verschieben, den leeren Block löschen.

**7. `packages/twopoint5d/src/stage/fitIntoRectangle.spec.ts`** — im `describe('pixelSnap')`
(`:315-410`) den lokalen Helfer `fit` in `viewOf` umbenennen: die Definition `:318` und alle
17 Aufrufe `:331-408` (der Kommentar `:316-317` »the view as [width, height] …« beschreibt ihn
schon so). Nicht umbenennen: die Objektschlüssel `fit:` und den Parameter `(fit) =>` von
`it.each` in `:288` (außerhalb des Blocks, Biome meldet ihn nicht).

## Verify

```bash
pnpm install --frozen-lockfile && pnpm audit && pnpm exec biome ci --error-on-warnings . && pnpm run ci
```

`pnpm audit` braucht das Registry; antwortet es nicht, den Lauf wiederholen, nicht
überspringen. `biome ci --error-on-warnings .` muss mit »No fixes applied« ohne »Found …
warnings« enden. `pnpm run ci` hält eine Sperre je Checkout, nie parallel zu einem zweiten Gate;
es fährt `clean` (rimraf unter glob 14) und die Browser-Suite auf allen vier Launchern.

## Commit

`build(deps): put rimraf on glob 14, ignore the two advisories no update can answer with the reason each cannot reach the workspace, and let the specs release what they build and lint without a warning`

## Abgleich (Zug 0, 2026-11-01, gegen e68e11b7)

- minimatch GHSA-g3hv-75wg-m249 — unverändert, verschoben: `pnpm-lock.yaml:3023`
  (`minimatch@10.2.5`, über `.>nx>minimatch`) und `:3027` (`minimatch@10.2.6`, über
  `.>rimraf>glob>minimatch`); `pnpm audit` an e68e11b7: exit 1, »4 vulnerabilities found ·
  1 low | 3 moderate«
- glob GHSA-3g3m-2fjr-6pw4 — unverändert, verschoben: `pnpm-lock.yaml:2503` (`glob@13.0.6`,
  über `.>rimraf>glob`)
- deepmerge GHSA-gcqx-w48m-w2h4 — unverändert, verschoben: `pnpm-lock.yaml:2183`
  (`deepmerge@4.3.1`, über `packages__twopoint5d-testing>@web/test-runner>@web/dev-server`)
- `stage-pipeline.test.js` — unverändert an `:33`, `:65`, `:232`, dazu `second` in `:189`; beim
  Lesen der ganzen Datei dieselbe Lücke in `:266`, `:300`, `:334` (gleiche Ursache, gleiche
  Datei, aufgenommen)
- `TextureCoords.spec.ts:109` — unverändert, Gegenstück `:227`
- `fitIntoRectangle.spec.ts:331-408` — unverändert, 17 Meldungen `noFocusedTests`, Helfer `:318`
- `ProjectionPlane.spec.ts:16` — unverändert, Gegenstück `:190`
- `pnpm exec biome ci --error-on-warnings .` an e68e11b7: exit 1, »Found 19 warnings« — genau die
  drei Specs (1 + 17 + 1), sonst keine

## Wahl und Abweichungen mit Grund

- **glob über Override statt Bump.** rimraf 6.1.3 ist der neueste Release und verlangt glob
  `^13.0.3`; kein rimraf-Release verlangt glob 14. glob 14 ist ein Major, rimraf ruft aber nur
  `glob()`/`globSync()` (`rimraf/dist/esm/index.js:14`/`:26`) mit `absolute`/`withFileTypes`/
  `signal` (`opt-arg.js:24-40`) — alles in glob 14 unverändert; die Breaking Changes von 14
  (`Pattern#isRegExp`, `GlobWalker#walk()` als Array, `debug`) betreffen rimraf nicht. Das
  Repo ruft rimraf nirgends mit `--glob` (`git grep rimraf`), der Override behebt glob und die
  rimraf-Kette von minimatch zugleich.
- **minimatch unter nx: Audit-Ausnahme statt Override (Abweichung vom Ziel-Wortlaut »Bump oder
  `pnpm.overrides`«).** nx pinnt `minimatch` exakt auf 10.2.5, auch im neuesten 24.0.3, und
  ruft `minimatch.makeRe()` (`nx/dist/src/utils/find-matching-projects.js:207` für
  Glob-Muster in `--projects`, `generators/utils/glob.js:36`,
  `command-line/release/utils/repository-git-tags.js:113`), das minimatch 11 entfernt
  (Changelog 11.0). Ein Override `nx>minimatch` ließe diese Pfade mit einem TypeError fallen,
  den kein Gate sieht, weil die Scripts nur `tag:` ohne Glob nutzen. Eine behobene 10.x gibt es
  nicht. Erreichbar ist die Lücke nicht: sie sitzt in `firstPhasePreProcess()`, das nur bei
  `optimizationLevel >= 2` läuft (`minimatch@10.2.5 dist/commonjs/index.js:341-344`), nx setzt
  keinen `optimizationLevel` (kein Treffer in `nx/dist`), der Default ist 1. Daher
  `auditConfig.ignoreGhsas` mit Grund und Entfernbedingung, dem Muster des bestehenden
  `nx>undici`-Kommentars folgend, und der Regel dafür in `docs/architecture.md` §5. Die
  Ausnahme gilt je GHSA für den ganzen Workspace (pnpm kennt keine Ausnahme je Pfad); nach dem
  glob-Override hält nur noch nx eine verwundbare minimatch.
- **deepmerge: Audit-Ausnahme ohne Patch.** Kein Release behebt die Lücke (`patched_versions:
  <0.0.0`, deepmerge 4.3.1 ist latest), `@web/dev-server` 1.0.0 und `@web/test-runner` 1.0.0
  sind latest und verlangen `deepmerge ^4.2.2`. Einziger Aufrufer ist
  `@web/dev-server/dist/plugins/nodeResolvePlugin.js:11`: er mischt eigene Konstanten mit dem
  `nodeResolve`-Objekt der Konfiguration; unsere Konfiguration setzt `nodeResolve: true`
  (`packages/twopoint5d-testing/web-test-runner.config.js:203`), also mischt er mit `{}`. Ein
  `pnpm patch` ließe `pnpm audit` unverändert melden (es prüft Versionen, nicht Inhalte) und
  brächte eine Patch-Datei, die jemand mittragen muss, für einen Pfad ohne fremde Eingabe —
  die Ausnahme allein erfüllt das Ziel, der Patch nicht.
- **Keine Änderung am Gate.** `lint` bleibt `biome ci .` ohne `--error-on-warnings`; ob eine
  Warnung das Gate brechen soll, ist eine Regel für das ganze Repo und nicht Teil dieser
  Nebenbefunde. Das Paket prüft die Warnfreiheit im Verify.
- **Dazu: der `nx>undici`-Kommentar.** Gleiche Ursache wie die neuen Einträge — die
  Kommentare des Blocks nennen, welche Version die verwundbare Abhängigkeit festhält; nach
  `pnpm view` pinnen nx 23.3.1 bis 24.0.2 undici 7.29.0, 24.0.3 löst 7.30.1 auf. Der Override
  bleibt (package.json: nx 24.0.1), der Kommentar sagt das jetzt.
- **Kein Regressionstest.** Kein Korrektheitsfehler im Produktcode; die roten Läufe sind
  `pnpm audit` (exit 1) und `biome ci --error-on-warnings .` (exit 1) aus Schritt 0, die grünen
  die aus Schritt 2 und dem Verify. Die Browser-Tests ändern nur ihre Freigabe, nicht ihre
  Aussage.

## Nebenbefunde im Volltext

**`pnpm-lock.yaml:2995`/`:2999` (heute `:3023`/`:3027`) · moderate** — `minimatch@10.2.5`,
`10.2.6` — GHSA-g3hv-75wg-m249 (»minimatch has potential denial of service via globparts
amplification«), über `.>nx>minimatch` und `.>rimraf>glob>minimatch`, behoben ab 11.0.1;
vorbestehend (schon in d9b648bf) · aus Paket 2 (Zug 0, lokales `pnpm audit`).

**`pnpm-lock.yaml:2475` (heute `:2503`) · moderate** — `glob@13.0.6` — GHSA-3g3m-2fjr-6pw4
(»AbortSignal cancellation bypass allows post-timeout filesystem traversal«), über
`.>rimraf>glob`, behoben ab 14.0.2; vorbestehend · aus Paket 2 (Zug 0).

**`pnpm-lock.yaml:2155` (heute `:2183`) · low** — `deepmerge@4.3.1` — GHSA-gcqx-w48m-w2h4
(»mergeObject() allows prototype poisoning of returned objects«), über
`packages__twopoint5d-testing>@web/test-runner>@web/dev-server>deepmerge`, kein behobener
Release (Patch oder Override nötig); vorbestehend · aus Paket 2 (Zug 0).

**`packages/twopoint5d-testing/test/stage-pipeline.test.js:40`/`:72`/`:239` (Tests ab `:33`,
`:65`, `:232`) · low** — `RenderPipeline`, `Stage2D`, Geometrie und Material gehen nicht über
`keep()` und werden nach dem Test nicht freigegeben, gegen die Konvention in
`helpers/fixtures.js`; dazu Geometrie und Material von `second` im Test ab `:189`; vorbestehend
(an d9b648bf `:40`, `:72`, `:205`) · aus Paket 7 (Runde 0).

**`packages/twopoint5d/src/texture/TextureCoords.spec.ts:109` · info** — ein zweites
`describe('root')` neben dem ersten, Biome meldet `noIdenticalTestTitle`; vorbestehend (Datei
seit d9b648bf unverändert) · aus Paket 8 (Runde 0).

**`packages/twopoint5d/src/stage/fitIntoRectangle.spec.ts:331-408` (`describe('pixelSnap')`) ·
info** — der lokale Helfer `fit(…)` heißt wie Jasmines fokussiertes `fit`, Biome meldet 17×
`noFocusedTests` (Warnung, `biome ci` bleibt grün); Umbenennen beendet das Rauschen;
vorbestehend (an d9b648bf `:315ff.`) · aus Paket 12 (Runde 0).

**`packages/twopoint5d/src/stage/ProjectionPlane.spec.ts:16` · info** — `describe('constructor')`
meldet Biome als `noIdenticalTestTitle` (Warnung); vorbestehend · aus Paket 12 (Runde 0).

## Verlauf

- 2026-11-01 Zug 0: Detailplan steht · alle sieben Nebenbefunde unverändert (Lockfile-Zeilen
  verschoben auf `:3023`/`:3027`/`:2503`/`:2183`; `stage-pipeline.test.js` um `:266`/`:300`/`:334`
  erweitert) · dazu `nx>undici`-Kommentar `pnpm-workspace.yaml:35` · Wahl: Override
  `rimraf>glob: ^14.0.2`, `auditConfig.ignoreGhsas` für GHSA-g3hv-75wg-m249 (nx) und
  GHSA-gcqx-w48m-w2h4, in einer Probe außerhalb des Repos geprüft (31 Lockfile-Zeilen, `pnpm
  audit` exit 0) · keine offene Folge; kein anderer Eintrag in »Offene Befunde« teilt die
  Ursache · Restplan unverändert
- 2026-11-01 Zug 1: Implementierer beauftragt (sonnet, effort low), Report `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-17.impl-0.json`
- 2026-11-01 Zug 2: Report FERTIG · 7 Dateien (pnpm-workspace.yaml, pnpm-lock.yaml, docs/architecture.md, stage-pipeline.test.js, drei Specs) · Baum schmutzig · Verify exit=0 (`paket-17.verify.log`)
- 2026-11-01 Zug 3: Reviewer (sonnet, medium) — alle sieben Nebenbefunde und der nx>undici-Kommentar erfüllt, kein kritischer/wichtiger Befund, 3 klein · Diff `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-17.diff`, Report `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-17.review-0.json`
- 2026-11-01 Zug 4: keine Runde nötig
- 2026-11-01 Zug 5: committet a63429c8 (Verify `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-17.verify.log`, exit=0)

## Urteil des Reviewers

- minimatch GHSA-g3hv-75wg-m249 — behoben: rimraf-Kette auf `minimatch@11.0.3` (`pnpm-lock.yaml`), nx-Instanz 10.2.5 in `auditConfig.ignoreGhsas` (`pnpm-workspace.yaml`) mit Grund und Entfernbedingung
- glob GHSA-3g3m-2fjr-6pw4 — behoben: `'rimraf>glob': ^14.0.2`, Lockfile `glob@14.0.3`
- deepmerge GHSA-gcqx-w48m-w2h4 — behoben per Audit-Ausnahme (`pnpm-workspace.yaml`, `auditConfig`)
- `stage-pipeline.test.js` — behoben in allen sieben Tests (`:33`, `:65`, `:189`, `:232`, `:266`, `:300`, `:334`), `release` importiert, Zählungen unverändert
- `TextureCoords.spec.ts` — behoben, ein `describe('root')`
- `fitIntoRectangle.spec.ts` — behoben, Helfer `viewOf` (Definition + 17 Aufrufe)
- `ProjectionPlane.spec.ts` — behoben, ein `describe('constructor')`
- `nx>undici`-Kommentar — behoben, Wortlaut nach Vorgabe

Kleine Befunde:
1. `docs/architecture.md` §5, neuer Satz: »and with it the audit step of CI (§3)« — der CI-Schritt läuft mit `--audit-level=high` nur meldend, eine moderate/low-Ausnahme ändert dort praktisch nichts; formal richtig.
2. Commit-Scope `deps` deckt die Spec-Änderungen nicht ab; der Text nennt sie.
3. GHSA-IDs in Kommentaren von `pnpm-workspace.yaml` — IDs eines dauerhaften Trackers, zulässig.
