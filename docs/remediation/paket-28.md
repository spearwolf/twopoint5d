# Paket 28 — Drain 3: Gate, Lockfile, Workflows, Preview-Generator und Lookbook-Reste

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings · 12 überführte Reviewer-Befunde (»klein«) und
  Abweichungen aus den Paketen 2, 12, 13, 13b, 17 und 20 (Befunde 1–12 unten), dazu
  Befund 3a aus dem Zug 0 (vorbestehend, gleiche Ursache wie Befund 3)
- Ziel: `pnpm lint` bricht bei einer Warnung ab; die Audit-Ausnahmen für minimatch und
  deepmerge bleiben, weil weder ein Override noch ein Patch sie beantworten kann (im
  Zug 0 belegt), und ihr Kommentar nennt den Grund vollständig; die Audit-Schritte von
  CI und Deploy und der Preview-Generator melden, warum sie aufgeben; die genannten
  Lookbook-Stellen sind typ- und doc-sauber; die Layout-JSONs der Masken-Szenen werden
  beim Laden gegen das geprüft, was die Szene liest; die Vorschaubilder der Demos, deren
  Bild sich geändert hat, sind neu erzeugt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `package.json`, `AGENTS.md`, `docs/architecture.md`, `pnpm-workspace.yaml`
  - `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`
  - `scripts/lookbook/generateDemoPreviews.mjs`
  - `apps/lookbook/src/demos/utils/fetchAsset.ts`, neu `apps/lookbook/src/demos/utils/checkJson.ts`
  - `apps/lookbook/src/demos/stage-masks/`: `Trench.ts`, `PaintedMoor.ts`, `helpers.ts`,
    `heatHaze.ts`, `TransitionCycler.ts`, `PaintingHallway.ts`, `DrownedHouse.ts`,
    `SeancePhotographs.ts`, `MothChapel.ts`, `CrawlRig.ts`, `Crawlspace.ts`,
    `CrematoriumWindow.ts`, `MirrorBathroom.ts`, `WatchingWallpaper.ts`
  - `apps/lookbook/README.md` (»Adding a demo«, `:71-75`)
  - `apps/lookbook/public/images/demo-preview/*.webp` — nur die Bilder, deren Bild sich
    nach Schritt 10 geändert hat
  - nicht: `pnpm-lock.yaml`, `biome.jsonc`, Library-Code, `packages/twopoint5d/CHANGELOG.md`
    (keine Änderung am veröffentlichten Paket), kein Guide unter `packages/twopoint5d/docs/`
- Vorgehen:
  1. **Gate (Befund 1).** `package.json:26`: `"lint": "biome ci ."` wird
     `"lint": "biome ci --error-on-warnings ."`. Der Wert gehört ins Script, nicht in
     `biome.jsonc` (Biome kennt dafür keinen Konfigschlüssel). `ci:checks` und damit der Job
     `checks` von `ci.yml` rufen `pnpm run lint`, sie ändern sich nicht.
     - `AGENTS.md:39-42`: der Eintrag `pnpm lint` nennt `biome ci --error-on-warnings` und sagt
       »a warning fails it as an error does«; Rest des Eintrags unverändert, Absatz auf
       höchstens 90 Spalten neu umbrochen.
     - `docs/architecture.md:121-123`: `` `lint` = `biome ci --error-on-warnings .` `` und
       derselbe Halbsatz nach »and writes nothing«; neu umbrochen auf höchstens 90 Spalten.
     - Beleg (kein Bugfix, daher Verfälschung statt Regressionstest): vor der Änderung in einer
       Spec einen `describe`-Titel auf derselben Ebene verdoppeln (Biome meldet
       `noIdenticalTestTitle` als Warnung) → `pnpm lint` exit 0 mit »Found 1 warning«; nach der
       Änderung derselbe Stand → exit 1. Verfälschung zurücknehmen, beide Läufe mit Exit-Code
       in den Report. Auf `ef8d23ab` läuft `biome ci --error-on-warnings .` grün (1048
       Dateien, Zug 0).
  2. **Audit-Ausnahmen (Befund 2).** Kein Override, kein Patch, keine Lockfile-Änderung — der
     Zug 0 hat beides als unmöglich belegt (Abschnitt »Entscheidungen von Zug 0«). Geändert
     wird nur die Begründung:
     - `pnpm-workspace.yaml:55-59`, der Kommentar über `- GHSA-gcqx-w48m-w2h4`, wird genau
       dieser Text (Einrückung wie heute, vier Leerzeichen vor `#`):

       ```yaml
           # deepmerge: no release fixes it, and a patch cannot answer it: pnpm audit judges a
           # package by its version, and a patched 4.3.1 is still 4.3.1. Its two callers merge
           # nothing from outside the repo: the nodeResolvePlugin of @web/dev-server merges defaults
           # of its own with the nodeResolve option of
           # packages/twopoint5d-testing/web-test-runner.config.js, which is `true`, and
           # @rollup/plugin-node-resolve copies its own defaults. Drop this entry once deepmerge
           # publishes a fix or both let go of it.
       ```

     - Der Kommentar zu GHSA-g3hv-75wg-m249 (`:50-53`) bleibt; er ist richtig (nx 24.0.3, der
       neueste Release, pinnt minimatch 10.2.5).
     - `docs/architecture.md` §5, im Absatz `:493-500` direkt nach dem Satz, der mit »and when
       the entry can go;« weitergeht und mit »changes nothing there.« endet, ein Satz: »A
       `pnpm patch` answers none of them: `pnpm audit` judges a package by its version, and a
       patched release keeps it.« Absatz neu umbrochen auf höchstens 90 Spalten.
     - Beleg: `pnpm audit` exit 0 (die beiden Einträge ignoriert) in den Report.
  3. **Audit im Deploy (Befund 3).** `.github/workflows/deploy.yml:102-114`, der Schritt
     `Audit the installed dependencies`: `pnpm audit` bekommt eine eigene Frist innerhalb der
     zwei Minuten des Schritts, damit `pnpm-audit.err` im Log steht, bevor der Runner den
     Schritt beendet. Der `run`-Block wird:

     ```yaml
             run: |
               status=0
               timeout -k 10 90 pnpm audit --json > "$RUNNER_TEMP/pnpm-audit.json" 2> "$RUNNER_TEMP/pnpm-audit.err" || status=$?
               if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
                 echo "pnpm audit gave no answer within 90 seconds" >> "$RUNNER_TEMP/pnpm-audit.err"
               fi
               if ! node scripts/ci/auditInstalledDependencies.mjs --report "$RUNNER_TEMP/pnpm-audit.json" --importer . --importer packages/twopoint5d; then
                 cat "$RUNNER_TEMP/pnpm-audit.err"
                 exit 1
               fi
             timeout-minutes: 2
     ```

     `|| status=$?` ersetzt `|| true`: `pnpm audit` endet mit 1, sobald es etwas findet, das
     bleibt erlaubt; 124 ist die Frist von `timeout`, 137 ihr `-k`. Ein abgeschnittener Report
     ist leer oder kein JSON, also endet `auditInstalledDependencies.mjs` mit 2 und der Schritt
     druckt den Grund. Der Kommentar über dem Schritt bekommt am Ende den Satz »pnpm audit gets
     90 seconds, inside the two minutes of the step, so what it printed reaches the log.«
     (Kommentarzeilen wie die Nachbarn umbrochen).
  4. **Audit in CI (Befund 3a).** `.github/workflows/ci.yml:96-111`, Schritt
     `Audit dependencies`, dieselbe Ursache: die Zeile `pnpm audit --audit-level=high > … 2>&1
     || status=$?` wird `timeout -k 10 90 pnpm audit --audit-level=high > … 2>&1 || status=$?`,
     und direkt danach, vor `cat`, steht

     ```bash
     if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
       echo "pnpm audit gave no answer within 90 seconds" >> "$RUNNER_TEMP/pnpm-audit.txt"
     fi
     ```

     Warnung, Summary, `continue-on-error` und `timeout-minutes: 2` bleiben. Der Kommentar über
     dem Schritt bekommt am Ende genau den Satz »pnpm audit gets 90 seconds, inside the two
     minutes of the step, so its output reaches the log and the summary.« Dazu
     `docs/architecture.md`: §3 `:232-234` — der Halbsatz »an audit that times out leaves the
     job green« wird genau »`pnpm audit` gets 90 seconds, so an audit that runs out of them puts
     up the same warning, and it leaves the job green«; §4 `:437-439` — hinter »and on an audit
     without an answer« kommt genau »within 90 seconds, whose output then stands in the log«.
     Beide Absätze neu umbrochen auf höchstens 90 Spalten.
     - Beleg für 3 und 4 (Workflows haben keinen Test): beide `run`-Blöcke in je eine Datei im
       Arbeitsverzeichnis kopieren, `90` durch `2` ersetzen, ein Stub `pnpm` vorn in `PATH`, der
       `sleep 30` ausführt, `RUNNER_TEMP` und `GITHUB_STEP_SUMMARY` auf Dateien im
       Arbeitsverzeichnis, mit `bash --noprofile --norc -eo pipefail` laufen lassen (so ruft
       GitHub `run` auf). Erwartet: Deploy-Block exit 1 und »gave no answer within 2 seconds«
       in der Ausgabe; CI-Block exit 0, die Zeile in der Ausgabe und im Summary. Ausgaben samt
       Exit-Codes in den Report.
  5. **Preview-Generator (Befund 4).** `scripts/lookbook/generateDemoPreviews.mjs:155-162`: die
     Prüfung `refuseAdapter()` samt `return 2` rückt direkt hinter `describeWebGpuAdapter()`,
     vor die beiden Logzeilen `lookbook at …` und `WebGPU adapter: …`. Ohne Adapter und ohne
     `--allow-webgl2` steht dann nur die Ablehnung im Log; mit `--allow-webgl2` oder mit Adapter
     ändert sich nichts. Kein Test (der Hauptablauf braucht Build und Browser,
     `demoPreviewConfig.test.mjs` hält `refuseAdapter()` schon).
  6. **Imports (Befund 5).** Die Szenen sortieren: Pakete, `three/*`, `~demos/*`, dann die
     relativen Imports alphabetisch ohne Groß-/Kleinschreibung (so stehen sie in den anderen
     Szenen, z. B. `CrematoriumWindow.ts:14-15`, `DrownedHouse.ts:30-32`).
     - `Trench.ts:29-31` (`./Sonar`, `./helpers`, `./SoftBlobs`) wird `./helpers`,
       `./SoftBlobs`, `./Sonar`.
     - `PaintedMoor.ts:31` (`import {hash21, SeededRandom} from './helpers';`, heute zwischen
       `three/tsl` und `three/webgpu`) rückt hinter den Import aus `three/webgpu` (`:32`), vor
       den aus `./PaintingHallway` (`:33-45`).
  7. **`helpers.ts` (Befunde 6 und 8).**
     - `:13-18`: der Modulkommentar steht als zweiter Doc-Block vor `STEP`. Er wird ein
       `//`-Zeilenkommentar an derselben Stelle, Wortlaut unverändert, höchstens 100 Spalten
       (so stehen modulweite Notizen in der Library, z. B. `CameraBasedVisibility.ts:70-75`).
       Danach trägt `STEP` nur sein eigenes Doc.
     - `:45`: `range()` bekommt `/** A value in [min, max), drawn with the next value of the
       generator. */` (eine Zeile, Einrückung wie `next()`).
  8. **`heatHaze.ts` (Befund 7).** Der Spiegelstrich `:49-55` (»It bends both pictures«) wird
     genau dieser Text (höchstens 98 Spalten, kein »—,«):

     ```ts
      * - **It bends both pictures.** The slope of the coverage is the gradient of the hot air's
      *   density, and the uv is pushed along it: refraction, strongest at the edges of the plumes,
      *   where the coverage changes fastest. The slope is sampled 8 px away on the card of the
      *   lookbook, a fixed share of the picture's height and so the same at any pixel ratio. The four
      *   points stay inside the picture: the coverage of a mask is 0 outside `[0, 1]`, and a point
      *   beyond the edge would read a rim the heat does not have. So at the edge the slope is taken on
      *   the one side; whoever takes the slope of a coverage in an effect of their own needs the same.
      *   A ripple whose phase is the coverage itself adds the fine shimmer; it crawls as the plumes
      *   rise, with no clock of its own.
     ```

     Die Einzeiler `:41` (101) und `helpers.ts:31`/`:110` (112/109) bleiben — einzeilige
     Kommentare fasst dieser Lauf nicht an (Regel aus Paket 26).
  9. **`TransitionCycler.ts` (Befund 9).** `:39` wird
     `onBegin?: (from: StageDirectorLayer, to: StageDirectorLayer) => void;` — `#begin()` reicht
     zwei Einträge von `stages` weiter, die genau diesen Typ haben. Die drei Seiten mit
     `onBegin` (`stage-masks-matte-threshold.astro:137`, `-matte-ink.astro:98`,
     `-matte-3d.astro:100`) vergleichen nur Identität und brauchen keine Änderung.
     `#shownFrom`/`#shownTo` (`:62-63`) bleiben `IStage | undefined`: sie halten
     `StageTransition#from`/`#to`, die die Library als `IStage | undefined` typisiert; enger
     ginge es nur mit einem Cast. `IStage` bleibt im Import (`#nameOf()`).
  10. **Layout-JSONs prüfen (Befund 10).** Neu `apps/lookbook/src/demos/utils/checkJson.ts`,
      ohne Imports, nur löschbare TS-Syntax:
      - `export type JsonCheck<T> = (value: unknown, path: string) => T;` — gibt den Wert als
        `T` zurück oder wirft einen `TypeError` mit `<wo> must be <was>, got <wert>`.
      - `export const jsonNumber: JsonCheck<number>` (`typeof value === 'number'`, »a number«),
        `export const jsonString: JsonCheck<string>` (»a string«),
        `export function jsonOneOf<const V extends readonly string[]>(...values: V): JsonCheck<V[number]>`
        (»one of "eye", "petal", "lancet"«, jeder Wert über `JSON.stringify`, mit `, ` verbunden),
        `export function jsonList<T>(item: JsonCheck<T>): JsonCheck<T[]>` (`Array.isArray`,
        »a list«, Elemente unter `<pfad>[<i>]`),
        `export function jsonTuple<T extends unknown[]>(...items: {[K in keyof T]: JsonCheck<T[K]>}): JsonCheck<T>`
        (Liste genau dieser Länge, »a list of <n>«),
        `export function jsonRecord<T>(item: JsonCheck<T>): JsonCheck<Record<string, T>>`
        (Objekt, kein Array, kein `null`, »an object«; jeder eigene Schlüssel unter
        `<pfad>.<key>`),
        `export function jsonObject<T>(fields: {[K in keyof T]-?: JsonCheck<T[K]>}): JsonCheck<T>`
        (»an object«; jedes Feld aus `fields` unter `<pfad>.<key>`, weitere Felder der JSON
        werden durchgelassen). Der Typ von `fields` hält die Prüfung am Interface: ein
        fehlendes oder falsch geprüftes Feld ist ein Compile-Fehler. Der einzige Cast der Datei
        ist die Rückgabe nach der Prüfung (`value as T`), mit einem Kommentar, warum.
      - Pfad: Wurzel `''`, Objektfeld `path === '' ? key : `${path}.${key}``, Listenelement
        `` `${path}[${i}]` ``; `<wo>` ist der Pfad, für `''` »the root«. `<wert>`: `undefined`
        → `nothing`, sonst `JSON.stringify(value)`, länger als 40 Zeichen → die ersten 39 und
        `…`. Ein Modul-TSDoc oder TSDoc je Export sagt, wofür das Modul da ist (die Layout-Dateien
        schreiben die Generatoren unter `assets-src/`; die Prüfung hält eine geänderte Datei
        gegen das, was die Szene liest, und nennt das Feld, das nicht passt).
      - `fetchAsset.ts`: `fetchJson<T>(subject: string, url: string, check: JsonCheck<T>): Promise<T>`
        (dritter Parameter Pflicht, Import `type JsonCheck` aus `./checkJson`). Nach
        `JSON.parse` ruft sie `check(value, '')`; wirft der, lehnt sie ab mit
        `new Error(`${subject}: ${url} is not what ${subject} reads: ${message}`, {cause})`
        (`message` die Meldung des `TypeError`). Das TSDoc `:22-31`: der Absatz »The shape of
        the value is not checked …« entfällt; an seine Stelle tritt, dass `check` den Wert hält
        und wie die Ablehnung lautet, samt `cause`.
      - Je Layout-Typ eine Prüfung `check<Typname>` neben seinem Interface, gebaut aus
        `jsonObject<Typname>({…})` (verschachtelte Typen wie `Point`, `Box`, `Arch`, `Eye`,
        `EyeSpec`, `PaneInfo`, `HeadJson` als eigene Konstante, wo sie mehrfach vorkommen),
        und der Aufruf übergibt sie:
        `Trench.ts:86` `checkTrenchLayout` · `PaintingHallway.ts:148` `checkLayoutJson` ·
        `DrownedHouse.ts:101` `checkLayout` · `SeancePhotographs.ts:72` `checkSeanceLayout` ·
        `MothChapel.ts:184` `checkRoseWindowJson`, `:185` `checkRoomJson` · `CrawlRig.ts:5`
        `checkCrawlLayout` (exportiert, `Crawlspace.ts:102` importiert ihn) ·
        `CrematoriumWindow.ts:79` `checkCrematoriumLayout` · `MirrorBathroom.ts:54`
        `checkMirrorLayout` · `WatchingWallpaper.ts:96` `checkEyesJson`. String-Literal-Unions
        (`PaneInfo.ring`, `EyeSpec.kind`) über `jsonOneOf`, Tupel (`MirrorLayout.sconces`/
        `figureEyes`, `RoomJson.board.marks`, `EyesJson.eyeParts.sclera`/`iris`) über
        `jsonTuple`, `Record<string, …>` über `jsonRecord`, `CrawlLayout.layers` (feste Schlüssel
        `back`/`mid`/`play`) über `jsonObject`. Die Typargumente der `fetchJson`-Aufrufe
        entfallen, wo sie aus `check` folgen. Die Interfaces und ihre TSDocs bleiben.
      - `apps/lookbook/README.md:71-75`: der Satz zu `fetchJson()`/`fetchText()` sagt dazu, dass
        `fetchJson()` den Wert mit einer Prüfung aus `src/demos/utils/checkJson.ts` gegen das
        hält, was die Demo liest, und das Feld nennt, das nicht passt. Absatz wie die Nachbarn
        umbrochen.
      - Belege (das Lookbook hat keine Testoberfläche; Proben außerhalb des Repos wie in Paket
        13b, Aufbau aus `<Arbeitsverzeichnis>/paket-13b-probe/README.md` und
        `vitest.config.mjs` übernehmen, nichts dort ändern), neu in
        `<Arbeitsverzeichnis>/paket-28-probe/`:
        `checkJson.probe.ts` — jede Prüfung nimmt einen passenden Wert an und lehnt einen
        falschen mit der exakten Meldung ab (Pfad durch Objekt, Liste und Tupel, »the root«,
        `nothing`, Kürzung über 40 Zeichen); `fetchJson.probe.ts` — mit gestubbtem `fetch` lehnt
        ein JSON, das die Prüfung nicht besteht, mit
        `Scene: /a/layout.json is not what Scene reads: eyes[1].x must be a number, got "4"` ab,
        `cause` ist der `TypeError`, ein passendes löst mit dem Wert auf; `layouts.probe.ts` —
        jede der zehn eingecheckten Dateien unter `apps/lookbook/public/assets/<DIR>/` geht
        durch ihre Prüfung, und eine Kopie mit einem Feld als String lehnt mit dessen Pfad ab
        (lassen sich die Szenen in der Probe nicht importieren, deckt der Lauf `--strict` aus
        Schritt 11 die zehn Dateien ab; der Report sagt das). Vor der Änderung rot (Modul fehlt,
        `fetchJson` prüft nicht), danach grün; beide Läufe in Logdateien im Arbeitsverzeichnis.
  11. **Vorschaubilder (Befunde 11 und 12).** Erst nach allen Code-Änderungen und nie
      gleichzeitig mit `pnpm run ci` (der Generator baut das Lookbook im selben Arbeitsbaum).
      Abkürzung `<A>` = Arbeitsverzeichnis aus dem Brief, `<P>` =
      `apps/lookbook/public/images/demo-preview`.
      1. `cp -r <P> <A>/paket-28-previews/committed`.
      2. `pnpm lookbook:generate-previews --strict > <A>/paket-28.previews-1.log 2>&1; echo
         "exit=$?" >> <A>/paket-28.previews-1.log`, dann `cp -r <P> <A>/paket-28-previews/run-1`
         und `git checkout -- <P>`.
      3. `node scripts/lookbook/generateDemoPreviews.mjs --strict > <A>/paket-28.previews-2.log
         2>&1` (Build steht schon), Exit-Code dazu, `cp -r <P> <A>/paket-28-previews/run-2`,
         `git checkout -- <P>`.
      - Beide Läufe müssen mit Exit 0 enden. Ohne WebGPU-Adapter: `BLOCKIERT`, nie
        `--allow-webgl2`. Scheitert eine Demo unter `--strict`, ist das ein Befund: liegt es an
        diesem Paket (etwa an einer Prüfung aus Schritt 10, die eine eingecheckte Datei
        ablehnt), beheben; sonst als Nebenbefund melden.
      4. Vergleich mit einem Node-Skript `<A>/paket-28-previews/compare.mjs`, `sharp` aufgelöst
         über `require.resolve('sharp', {paths: ['apps/lookbook']})`: je Demo der Anteil der
         Pixel, deren größte Kanaldifferenz über 24 (von 255) liegt, für `run-1` gegen
         `committed` und `run-1` gegen `run-2`; Tabelle nach `<A>/paket-28.previews-compare.txt`.
      5. Als geändert gilt eine Demo, deren Anteil `run-1`/`committed` über 0,5 % liegt und über
         dem Vierfachen ihres Anteils `run-1`/`run-2`; für jede solche Demo ein Bildpaar
         nebeneinander nach `<A>/paket-28-previews/pairs/<id>.png`, ansehen, und nur wenn sich
         der Inhalt geändert hat (Anordnung, Muster, Farbe — kein Rauschen), ihr Bild aus
         `run-1` nach `<P>` kopieren. Erwartet: `stage-masks-shared`, `-rift`, `-frozen`,
         `-portal` (andere Zufallsanordnung seit Paket 12) und, falls ihre Karte `dissolve()`
         zeigt, `stage-transitions-gallery` und `-game-menu` (Zellmuster seit Paket 20). Weitere
         geänderte Demos (etwa durch three 0.187) werden ebenso übernommen. Jede Demo der
         erwarteten sechs, die nicht als geändert gilt, steht mit ihren beiden Anteilen im
         Report, ebenso jede übernommene.
      - Alle übrigen Vorschaubilder bleiben Byte für Byte, wie sie sind (`git status` zeigt
        unter `<P>` nur die übernommenen).
- Verify: `pnpm run ci` (nach Schritt 11; dazu `pnpm audit`, die Proben aus Schritt 10, die
  Probeläufe aus den Schritten 1 und 4 und die Logs aus Schritt 11 mit Exit-Codes im Report)
- Commit: `fix: fail lint on a warning, show why a dependency audit or the preview generator
  gives up, check the layout files of the stage mask scenes as they load and draw anew the demo
  previews whose picture changed` (eine Zeile, ohne Umbruch)
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · Befund 1 unverändert (`package.json:26`; `biome ci
    --error-on-warnings .` grün auf ef8d23ab, Log `paket-28.zug0-biome.log`) · Befund 2
    unverändert, Override und Patch als unmöglich belegt (Probe `paket-28-probe/deepmerge-patch/`,
    `paket-28-probe/deepmerge-old/`), Kommentar zu deepmerge nennt einen von zwei Aufrufern ·
    Befund 3 unverändert (`deploy.yml:102-114`) · Befund 3a neu, vorbestehend an d9b648bf
    (`ci.yml:87-111`) · Befund 4 unverändert (`generateDemoPreviews.mjs:157-161`) · Befund 5:
    Trench nach `:29-31` gewandert (Paket 13b), PaintedMoor `:31` unverändert · Befunde 6 und 8
    unverändert (`helpers.ts:13-18`, `:45`) · Befund 7 unverändert (`heatHaze.ts:49-55`) ·
    Befund 9 nach `TransitionCycler.ts:39`/`:62-63` gewandert · Befund 10: zehn Dateien in neun
    Szenen, nicht zwölf · Befunde 11 und 12 unverändert (Vorschaubilder seit vor dem Lauf nicht
    neu erzeugt) · keine offene Folge im Plan; »Offene Befunde« hat einen offenen Eintrag
    (Prosazeilen, → Audit), andere Ursache, bleibt
  - 2026-11-01 Zug 1: Implementierer beauftragt (sonnet, effort medium), Brief `paket-28.impl-0.brief.txt`, Report `paket-28.impl-0.json` (leer: Brief per relativem Pfad nicht gefunden, CLI exit 1); zweiter Anlauf `paket-28.impl-0-versuch-2.json` (Session 414a91b1)
  - 2026-11-01 Zug 2: FERTIG_MIT_VORBEHALT (Ermessen Vorschaubilder) · 26 Dateien geändert, neu `apps/lookbook/src/demos/utils/checkJson.ts`, drei Vorschaubilder (`stage-masks-frozen`, `-rift`, `-shared`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit 0 (`paket-28.verify.log`)
  - 2026-11-01 Zug 3: Reviewer beauftragt (sonnet, effort medium), Diff `paket-28.diff`, Report `paket-28.review-0.json`
  - 2026-11-01 Zug 3 Urteil: alle Befunde 1–12 und 3a behoben bis auf das Ermessen bei 11/12 (fünf Demos über der Messregel nicht übernommen: heat-haze, matte-threshold, nested-pipelines, postprocessing, projections), klein: Importsortierung `MirrorBathroom.ts`/`Crawlspace.ts`, toter `String(cause)`-Zweig in `fetchAsset.ts`
  - 2026-11-01 Zug 4 Runde 1: offen 11/12 (fünf Bilder, von mir als wichtig gewertet: Abstand reproduzierbar, Rauschen ≈ 0) und die Importsortierung → derselbe Implementierer per Resume (Session 414a91b1, sonnet/medium), Report `paket-28.impl-1.json`: FERTIG, fünf Bilder übernommen (jetzt acht), Importe `MirrorBathroom.ts`/`Crawlspace.ts` sortiert · Verify `pnpm run ci` exit 0 (`paket-28.verify-2.log`) · Reviewer gezielt (sonnet/medium), Diff `paket-28.diff-1`, Report `paket-28.review-1.json`
  - 2026-11-01 Zug 4 Runde 1 Urteil: beide offenen Befunde erledigt (acht Bilder Byte-gleich mit `run-1`, Importe sortiert), kein neuer kritischer oder wichtiger Befund
  - 2026-11-01 Zug 5: Commit 87825336 (32 Dateien), Verify `paket-28.verify-2.log` exit 0

## Urteil des Reviewers (Runde 0 und 1)

- Befund 1 behoben: `package.json:26`, `AGENTS.md`, `docs/architecture.md` §1
- Befund 2 behoben: Kommentar `pnpm-workspace.yaml` (zwei Aufrufer, Grund gegen Patch), Satz in `docs/architecture.md` §5; `pnpm audit` exit 0
- Befund 3 behoben: `.github/workflows/deploy.yml` (`timeout -k 10 90`, `|| status=$?`, 124/137-Zeile)
- Befund 3a behoben: `.github/workflows/ci.yml`, `docs/architecture.md` §3/§4
- Befund 4 behoben: `scripts/lookbook/generateDemoPreviews.mjs:155-157`
- Befund 5 behoben: `Trench.ts`, `PaintedMoor.ts`
- Befunde 6 und 8 behoben: `helpers.ts` (Modulkommentar als `//`, TSDoc an `range()`)
- Befund 7 behoben: `heatHaze.ts`
- Befund 9 behoben: `TransitionCycler.ts:39`
- Befund 10 behoben: `apps/lookbook/src/demos/utils/checkJson.ts`, `fetchAsset.ts`, zehn Aufrufe in neun Szenen, `apps/lookbook/README.md`
- Befunde 11 und 12 behoben (nach Runde 1): acht Vorschaubilder nach Messregel übernommen
- Kleine Befunde: toter `String(cause)`-Zweig in `fetchJson()` (`fetchAsset.ts`), die Prüfungen werfen nur `TypeError`; Hinweis, dass der Modulkommentar von `helpers.ts` als `//` hinter den Imports steht (so im Detailplan verlangt)
- Nebenbefunde des Implementierers: `docs/architecture.md:15`/`:17`/`:105`/`:641` Zeilen über 90 Spalten → Queue (→ Audit, vorbestehend, nicht in den Absätzen dieses Pakets); `helpers.ts:55`/`:109` Einzeiler über 100 Spalten bleiben (Regel aus Paket 26, kein Eintrag); die Probe `paket-13b-probe/fetchAsset.probe.ts` liegt außerhalb des Repos und ruft `fetchJson` mit zwei Argumenten (keine Folge im Repo)

## Abgleich (Zug 0, 2026-11-01, gegen ef8d23ab)

1. Gate — besteht: `package.json:26` `"lint": "biome ci ."`; `ci:checks` (`:36`) ruft
   `pnpm run lint`, `ci.yml:49`/`:53` rufen `ci:checks`. `pnpm exec biome ci
   --error-on-warnings .` endet heute mit 0 (Biome 2.6.3, 1048 Dateien).
2. Audit-Ausnahmen — besteht (`pnpm-workspace.yaml:48-60`), ist aber die einzige mögliche Form;
   Belege unter »Entscheidungen von Zug 0«. Der Kommentar zu deepmerge (`:55-59`) sagt »Its one
   caller«; im Lockfile hängen zwei Pakete an `deepmerge@4.3.1`: `@web/dev-server@1.0.0`
   (`nodeResolvePlugin.js:11`, mischt die Option aus `web-test-runner.config.js:203`,
   `nodeResolve: true`) und `@rollup/plugin-node-resolve@15.3.1` (`dist/cjs/index.js:1063`,
   `deepMerge({}, defaults)`, nur eigene Konstanten).
3. Deploy-Audit — besteht: `deploy.yml:108-114`, `pnpm audit … || true` ohne eigene Frist, der
   Schritt hat `timeout-minutes: 2`; hängt `pnpm audit`, beendet der Runner den Schritt vor
   `cat "$RUNNER_TEMP/pnpm-audit.err"`.
3a. CI-Audit — dieselbe Ursache: `ci.yml:96-112`, `cat "$RUNNER_TEMP/pnpm-audit.txt"` und das
   Summary laufen erst nach `pnpm audit`, der Schritt hat `timeout-minutes: 2`; an d9b648bf
   `:96-111` gleich (vorbestehend). Aufgenommen, weil die Ursache dieselbe ist (ein Schritt-Timeout
   ohne Frist des Kommandos verschluckt dessen Ausgabe).
4. Preview-Generator — besteht: `generateDemoPreviews.mjs:156-161`, `lookbook at …` und
   `WebGPU adapter: none, three.js renders with WebGL 2` stehen vor `refuseAdapter()`.
5. Imports — `Trench.ts:29-31` (an 0beb1f44 `:36-38`; Paket 13b hat zwei Importzeilen
   dazugebracht), `PaintedMoor.ts:31` unverändert.
6. `helpers.ts:13-18` — Modul-TSDoc als zweiter `/** */`-Block vor `STEP` (`:20-21`), unverändert.
7. `heatHaze.ts:49-55` — `:50` mit 173 Zeichen, `:53` »… does not have —, so …«, `:54` mit 104;
   unverändert.
8. `helpers.ts:45` — `range()` ohne TSDoc, unverändert.
9. `TransitionCycler.ts:39` `onBegin?: (from: IStage, to: IStage) => void`, `#begin()` (`:166-170`)
   reicht `StageDirectorLayer` weiter; `#shownFrom`/`#shownTo` `:62-63`. Die Zeile `:78` des
   Reviewers ist heute der Getter `running`.
10. `fetchAsset.ts:27-32` — »The shape of the value is not checked«; zehn Aufrufe in neun
    Szenen (`Trench.ts:86`, `PaintingHallway.ts:148`, `DrownedHouse.ts:101`,
    `SeancePhotographs.ts:72`, `MothChapel.ts:184`/`:185`, `Crawlspace.ts:102`,
    `CrematoriumWindow.ts:79`, `MirrorBathroom.ts:54`, `WatchingWallpaper.ts:96`). Die übrigen
    Szenen laden nur Bilder und Atlanten über ihren `TextureStore`, der sie selbst prüft; kein
    roher `fetch(` mehr im Lookbook.
11. und 12. Vorschaubilder — `apps/lookbook/public/images/demo-preview/` (42 Dateien) zuletzt
    geändert in 8754c80f (2026-10-31, vor dem Lauf); kein Paket des Laufs hat eins neu erzeugt.
    `dissolve()` nutzen nur `stage-transitions-gallery` und `-game-menu` (über
    `demos/stage-transitions/effects.ts:97-98`).

## Entscheidungen von Zug 0 (mit Grund)

- **Audit-Ausnahmen bleiben (Befund 2).** Das Ziel im Plan erlaubt das nur, wenn Override und
  Patch nachweislich scheitern; beides ist belegt:
  - minimatch (GHSA-g3hv-75wg-m249, behoben ab 11.0.1, keine 10.x mit Fix — neueste 10.2.6):
    nx 24.0.3, laut Registry `latest` (2026-10-30), hängt weiter an `minimatch@10.2.5`. nx ruft
    `minimatch.makeRe()` in `dist/src/utils/find-matching-projects.js:207`,
    `dist/src/generators/utils/glob.js:36` und
    `dist/src/command-line/release/utils/repository-git-tags.js:113`; `minimatch@11.0.3`
    exportiert kein `makeRe` mehr (`dist/esm/index.d.ts`, weder als Export noch am
    `minimatch`-Objekt noch an `Minimatch`). Ein Override bricht nx. Ein Patch von nx müsste drei
    Module seiner Distribution umschreiben und an jede nx-Version neu angepasst werden, die
    Dependabot bringt — das Ziel nennt den Patch nur für deepmerge.
  - deepmerge (GHSA-gcqx-w48m-w2h4, betroffen `>= 4.2.0, <= 4.3.1`, kein Fix; neueste 4.3.1):
    eine Version unter 4.2.0 läge außerhalb der Range, hat aber gar keinen Schutz —
    `propertyIsUnsafe()` kam mit 4.2.0, 4.1.1 hat keinen (Probe
    `paket-28-probe/deepmerge-old/`). Ein `pnpm patch` (Probe `paket-28-probe/deepmerge-patch/`,
    pnpm 10.27.0: Patch mit `__proto__`-Wächter in `mergeObject()`) lässt `pnpm audit`
    unverändert: »1 vulnerabilities found · 1 low«, der Eintrag im Lockfile heißt
    `deepmerge@4.3.1(patch_hash=…)`, geprüft wird die Version. Ein Patch hielte also die
    Ausnahme nicht weg, sondern legte nur eine Patchdatei daneben — für eine Stelle, die keine
    Eingabe von außen erreicht.
  - Geändert wird deshalb nur, was an der Begründung fehlt oder falsch ist: der zweite Aufrufer
    und der Grund gegen den Patch im Kommentar, der Satz zu Patches in §5.
- **Befund 3a gehört ins Paket**: dieselbe Ursache wie Befund 3, in derselben Fläche
  (Workflow-Audit), vorbestehend; »Was du allein entscheidest«, Nebenbefund gleicher Ursache.
- **Frist 90 s mit `-k 10`** innerhalb von `timeout-minutes: 2`: höchstens 100 s für
  `pnpm audit`, Rest für das Filterskript (unter einer Sekunde) und `cat`. Die Schritt-Frist
  bleibt als äußerer Zaun.
- **`--error-on-warnings` im Script `lint`**, nicht in `biome.jsonc`: Biome hat keinen
  Konfigschlüssel dafür; `pnpm format` bleibt unberührt.
- **Modulkommentar in `helpers.ts` als `//`**, nicht als `@module`-Block: das Repo nutzt keine
  `@module`-Tags, modulweite Notizen stehen als Zeilenkommentar
  (`packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:70-75`,
  `src/display/public-api.ts:1`).
- **`#shownFrom`/`#shownTo` bleiben `IStage`** (Teilabweichung von Befund 9): sie halten
  `StageTransition#from`/`#to` (`packages/twopoint5d/src/stage/StageTransition.ts:82`/`:84`,
  `IStage | undefined`); `StageDirectorLayer` ginge nur über einen Cast, und der Lauf baut Casts
  ab. `onBegin` bekommt den engeren Typ, weil `#begin()` ihn tatsächlich hat.
- **Prüfung der Layout-JSONs über typisierte Prüf-Kombinatoren**, nicht über ein Schema-Paket
  oder handgeschriebene Wächter je Szene: kein neues Paket im Lookbook, ein Modul ohne Imports;
  `jsonObject<T>` bindet die Prüfung an das bestehende Interface, sodass Interface und Prüfung
  nicht auseinanderlaufen können, und die Meldung nennt den Pfad des Feldes. Zusätzliche
  Felder der Dateien bleiben erlaubt (die Generatoren schreiben mehr, als manche Szene liest).
  Keine eigene Darstellung über `describeValue()`: die Library exportiert es nicht.
- **Vorschaubilder nach Messung statt nach Liste**: seit vor dem Lauf ist keins neu erzeugt,
  und neben den sechs genannten kann three 0.187 (Paket 1) weitere verändert haben; das Ziel
  verlangt »die Demos, deren Bild sich geändert hat«. Zwei Läufe trennen Rauschen der GPU von
  einer echten Änderung, der Blick auf das Bildpaar entscheidet. Kein `--allow-webgl2` (die
  Bilder sähen anders aus als mit WebGPU, `refuseAdapter()`).
- **Modell mittlere Stufe, Effort medium**: Konfig- und Workflow-Zeilen mit exaktem Wortlaut,
  ein neues Lookbook-Modul mit gewöhnlichen generischen Typen, zehn Prüfkonstanten, die der
  Compiler gegen ihre Interfaces hält, dazu ein Bildvergleich mit Schwellen aus diesem Plan.
- **Kein CHANGELOG-Eintrag**: nichts am veröffentlichten Paket `@spearwolf/twopoint5d` ändert
  sich (Tooling, Workflows, Lookbook).

## Befunde im Volltext

Überführt aus dem Plan (Paket 28, »Nebenbefund«), Reihenfolge und Wortlaut von dort:

1. `ohne Zeile` — Gate unverändert: lint bleibt biome ci . ohne --error-on-warnings; die
   Warnfreiheit prüfte nur das Verify, das Gate erzwingt sie nicht. (aus paket-17.md)
2. `pnpm-workspace.yaml (auditConfig.ignoreGhsas, keine Zeile)` — minimatch 10.2.5 unter nx
   (GHSA-g3hv-75wg-m249) und deepmerge 4.3.1 (GHSA-gcqx-w48m-w2h4) bleiben im Lockfile, per
   Audit-Ausnahme stummgeschaltet statt Bump/Override (Abweichung vom Ziel-Wortlaut). (aus
   paket-17.md)
3. `.github/workflows/deploy.yml:115` — Step-Timeout »timeout-minutes: 2« beendet einen
   hängenden pnpm audit, bevor pnpm-audit.err im Log steht; fail closed hält, nur der Grund
   fehlt. (aus paket-2.md)
4. `scripts/lookbook/generateDemoPreviews.mjs:157` — Logzeile »WebGPU adapter: none, three.js
   renders with WebGL 2« steht ohne --allow-webgl2 direkt vor dem Abbruch, obwohl nichts
   gerendert wird. (aus paket-2.md)
5. `apps/lookbook/src/demos/stage-masks/Trench.ts:36-38; PaintedMoor.ts:31` — Relative Imports
   nicht hinter three/* und ~demos/* einsortiert. (aus paket-12.md)
6. `apps/lookbook/src/demos/stage-masks/helpers.ts (keine Zeile)` — Modul-TSDoc steht als
   zweiter Doc-Block vor STEP. (aus paket-12.md)
7. `apps/lookbook/src/demos/stage-masks/heatHaze.ts (keine Zeile)` — TSDoc »It bends both
   pictures«: Gedankenstrich vor Komma, sehr lange Zeile. (aus paket-12.md)
8. `apps/lookbook/src/demos/stage-masks/helpers.ts (keine Zeile)` — SeededRandom.range() ohne
   TSDoc. (aus paket-12.md)
9. `apps/lookbook/src/demos/stage-masks/TransitionCycler.ts:78` — onBegin als (from: IStage, to:
   IStage) typisiert, bekommt StageDirectorLayer; ebenso #shownFrom/#shownTo. (aus paket-13.md)
10. `apps/lookbook/src/demos/utils/fetchAsset.ts (keine Zeile)` — Die Layout-JSONs der zwölf
    Szenen werden nicht zur Laufzeit validiert (CONS-002 nannte den ungeprüften Cast);
    fetchJson() prüft nur Status und JSON-Syntax. (aus paket-13b.md)
11. `ohne Zeile` — stage-masks-shared/-rift/-frozen/-portal zeigen nach dem Umbau eine andere
    Zufallsanordnung als ihr Vorschaubild; die Vorschaubilder wurden nicht neu erzeugt. (aus
    remediation-plan.md (Paket 12, Ergebnis))
12. `ohne Zeile` — Die Vorschaubilder des Lookbooks (Galerie, Game-Menu mit dissolve()) bleiben
    nach der Änderung des Zellmusters unverändert, nicht neu erzeugt. (aus paket-20.md)

Dazu aus dem Zug 0:

3a. `.github/workflows/ci.yml:96-112` (Schritt `Audit dependencies`) — `pnpm audit
    --audit-level=high` läuft ohne eigene Frist in einem Schritt mit `timeout-minutes: 2`;
    hängt es, beendet der Runner den Schritt, bevor `pnpm-audit.txt` im Log und im Summary
    steht. Vorbestehend (an d9b648bf `:96-111` gleich), gleiche Ursache wie Befund 3.

Empfehlung aus dem Audit, auf die Befund 10 verweist (CONS-002, low,
`apps/lookbook/src/demos/stage-masks/Crawlspace.ts:82` an d9b648bf): »Das JSON wird ungeprüft
auf den Typ gecastet.« — Paket 13b hat Laden, Status und Freigabe gelöst, die Prüfung des
Inhalts bewusst nicht; die holt Schritt 10 nach.
