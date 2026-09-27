# Paket 4 — Nachtrag zu Paket 1: Allokationsmessung ohne volle Sammlung direkt vor der Messung

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-001 (medium, Nachtrag — der Messhelfer aus Paket 1) · dazu
  Symptom derselben Ursache: `touchVO() and the update() after it allocate
  nothing per call` (Spec aus Paket 2) ist in gemischter Reihenfolge rot
- Folge von: Paket 1
- Ziel: Kein Allokationsspec des Hot Paths misst nach einer vollen Sammlung
  direkt vor seinen Runden: `measureAllocatedBytes()` leert davor nur die junge
  Generation, alle Allokationsspecs messen über `measureSettledBytes()`, und die
  drei Specs bleiben unter parallelen Workern, mit Coverage, neben ausgelasteten
  Kernen und in gemischter Reihenfolge unter ihren Grenzen.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/testing/measureAllocatedBytes.ts`
  - `packages/twopoint5d/src/testing/measureSettledBytes.ts` (nur JSDoc)
  - neu `packages/twopoint5d/src/testing/measureAllocatedBytes.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/hot-path-allocations.spec.ts`
  - `packages/twopoint5d/src/sprites/hot-path-allocations.spec.ts`
  - `packages/twopoint5d/src/map2d/TileSprites/hot-path-allocations.spec.ts`
  - `AGENTS.md` (Z. 99–102)
- Kein CHANGELOG-Eintrag: `src/testing/` und die Specs erreichen `dist/` nie,
  am veröffentlichten Paket ändert sich nichts.

## Warum so (Entscheidung in Zug 0, mit Messwerten)

Der Plan ließ offen: die Paket-1-Specs auf `measureSettledBytes()` umstellen
oder `measureAllocatedBytes()` erweitern. Es wird beides, weil die Messung
zeigt, dass die Ursache im `gc()` von `measureAllocatedBytes()` selbst sitzt und
`measureSettledBytes()` sie nur zum Teil umgeht:

- Eine volle Sammlung (`gc()`, im GCProfiler `MarkSweepCompact`) direkt vor den
  Runden wirft optimierten Code der Runde weg; die Runden messen dann dessen
  Neuübersetzung. `measureSettledBytes()` ruft `measureAllocatedBytes()` dreimal
  auf, jedes Mal mit dieser vollen Sammlung davor — in ungünstiger Reihenfolge
  trägt dann jede der drei Messungen dieselben ~18 KB, und das Minimum aus drei
  hilft nicht: `touchVO()` 1,97 / 2,02 / 1,99 B/Aufruf (Seed 7919). Mit
  `gc({type: 'minor'})` trägt sie nur die erste Messung, die zweite und dritte
  liegen bei 0,27 / 0,26.
- Die Settle-Runde von `measureSettledBytes()` (200 Runden, dann volle
  Sammlung, dann Warm-up) räumt die toten Objekte aus Aufbau und Vortests weg,
  bevor der Code der Runde optimiert wird; das Minimum aus drei Messungen mit
  Pause davor schneidet die Installation des übersetzten Codes ab, die in die
  erste Messung fällt. Beides brauchen auch die Paket-1-Specs.
- Das Minimum aus drei bleibt (nicht Median): mit Minor-GC unterschätzt selten
  eine Messung (einmal −6,51 B/Aufruf bei `touchVO()`, einmal 54,3 statt 56,1 B
  je Objekt); ein echter Allokationsfehler kostet ≥ 16 B je Aufruf und bliebe
  damit sichtbar. Der Median hätte `touchVO()` bis 0,65 B/Aufruf an die Grenze
  1 herangetragen.
- `{warmUpRounds: 1000}` der drei Erzeugungstests fällt weg: über
  `measureSettledBytes()` mit Standard-Warm-up 56,12–59,64 B je Objekt in 72
  Messungen (Grenze 128), bei einem Drittel der Laufzeit.
- Der Weg ändert keine Zeile unter »Entscheidungen« und keinen freigegebenen
  Lösungsweg; `measureSettledBytes()` bleibt in Signatur und Mechanik, wie
  Paket 2 es angelegt hat.

## Vorgehen

1. **Regressionstest zuerst**, neue Datei
   `packages/twopoint5d/src/testing/measureAllocatedBytes.spec.ts`, genau so:

   ```ts
   import {GCProfiler} from 'node:v8';
   import {describe, expect, test} from 'vitest';

   import {measureAllocatedBytes} from './measureAllocatedBytes.js';

   describe('measureAllocatedBytes()', () => {
     test('collects only the young generation right before its rounds', () => {
       const profiler = new GCProfiler();
       profiler.start();
       measureAllocatedBytes(() => {}, {warmUpRounds: 0, rounds: 1});
       const gcTypes = profiler.stop().statistics.map(({gcType}) => gcType);

       // a full collection right before the rounds throws optimized code of the round away, and
       // the rounds would time its recompilation instead of the steady state of a frame loop
       expect(gcTypes.length).toBeGreaterThan(0);
       expect(gcTypes).not.toContain('MarkSweepCompact');
     });
   });
   ```

   Rot sehen: `cd packages/twopoint5d && pnpm vitest --run src/testing/measureAllocatedBytes.spec.ts`
   — vor dem Fix meldet der Profiler `['MarkSweepCompact']` (in Zug 0 mit Node
   24.21 nachgestellt). Zusätzlich die beiden reihenfolgeabhängigen Ausfälle an
   den echten, noch unveränderten Specs festhalten (in Zug 0 je dreimal
   reproduziert):
   - `pnpm vitest --run --sequence.shuffle --sequence.seed=7919 src/vertex-objects/hot-path-allocations.spec.ts`
     → `touchVO() and the update() after it …` 1,81 B/Aufruf
   - `pnpm vitest --run --sequence.shuffle --sequence.seed=79190 src/map2d/TileSprites/hot-path-allocations.spec.ts`
     → `updateTile() allocates nothing per tile` 1,10 B/Aufruf

   Alle drei roten Läufe gehören mit Ausgabe in den Report.

2. **`packages/twopoint5d/src/testing/measureAllocatedBytes.ts`**
   - Z. 28: `const {gc} = globalThis as {gc?: () => void};` →
     `const {gc} = globalThis;` (`@types/node` 26.6.2 deklariert das globale
     `gc` als `NodeJS.GCFunction | undefined`; dessen Überladung nimmt
     `{type: 'minor'}`). Guard und Fehlermeldung Z. 29–33 bleiben.
   - Z. 37–38 werden:

     ```ts
     // an empty young generation, so that what a scavenge frees during the rounds was allocated
     // during them — a minor collection, because a full one right here throws optimized code of the
     // round away, and the rounds would time its recompilation
     gc({type: 'minor'});
     ```

   - JSDoc Z. 10–24: der erste Absatz wird zu

     ```
      * The bytes one call of `round` puts on the V8 heap, averaged over `rounds` calls — a single
      * measurement. The allocation specs measure through `measureSettledBytes()` next to it, which
      * first collects what the setup of a test and the tests before it left behind and answers the
      * lowest of three of these measurements.
     ```

     Der Absatz »What a garbage collection takes back …« bis »… do not count.«
     bleibt wörtlich. Der Absatz »On Node 24.21 the method gave the same values
     within ±1 B per round …« (Z. 19–20) entfällt ersatzlos — die Messreihe in
     Zug 0 widerlegt ihn (`createTile()` 88–95 B je Tile über denselben Weg).
     `@throws` bleibt.
   - Signatur, `MeasureAllocatedBytesOptions` und die Rechnung ab Z. 40 bleiben.

3. **`packages/twopoint5d/src/testing/measureSettledBytes.ts`** — nur die
   JSDoc Z. 9–21, Code und Signatur bleiben. Der erste Satz (Z. 10–12) wird zu

   ```
    * The heap bytes one call of `round` puts on the V8 heap once a frame loop has settled — the
    * measurement every `hot-path-allocations.spec.ts` goes through, on top of
    * {@link measureAllocatedBytes}.
   ```

   Der Absatz »What the setup of a test and the tests before it left behind is
   collected first, …« bis »… shows up in every one of them.« bleibt wörtlich.
   Daran anschließend als neuer letzter Absatz:

   ```
    *
    * On Node 24.21, over 50 runs of the suite in parallel workers — with V8 coverage, beside eight
    * busy cores and in shuffled order — the allocation-free rounds of the specs measured 0.22 B per
    * call at most and a vertex object 56.2 B at most.
   ```

   (`{@link measureAllocatedBytes}` löst über den vorhandenen Import auf.)

4. **Die acht direkten Aufrufe** von `measureAllocatedBytes()` werden zu
   `await measureSettledBytes(…)` mit derselben Runde; jeder dieser Tests wird
   `async () => {`:
   - `src/vertex-objects/hot-path-allocations.spec.ts` Z. 86, 113, 137
     (Tests Z. 79, 105, 130)
   - `src/sprites/hot-path-allocations.spec.ts` Z. 36, 56, 79
     (Tests Z. 30, 51, 71)
   - `src/map2d/TileSprites/hot-path-allocations.spec.ts` Z. 48, 81
     (Tests Z. 47, 72)

   In den drei Erzeugungstests (vertex-objects Z. 137–145, sprites Z. 79–87,
   TileSprites Z. 81–89) entfällt das zweite Argument `{warmUpRounds: 1000}`,
   die Runde wird das einzige Argument, und die beiden Kommentarzeilen darüber
   entfallen (vertex-objects Z. 135–136, sprites Z. 77–78, TileSprites Z.
   79–80: »after the default warm-up an occasional run measured three times the
   bytes of the others; / after 1000 rounds the value holds from run to run«).
   Die Kommentarzeilen davor (»created at the end and freed as the last slot,
   …«, in sprites dazu »the voInitialize hook of the sprite runs inside the
   measurement«) bleiben.

   Der Import `measureAllocatedBytes` entfällt in allen drei Specs
   (vertex-objects Z. 4, sprites Z. 3, TileSprites Z. 3).

   Unverändert bleiben die Kommentare zu den Grenzen (vertex-objects Z. 12–19,
   sprites Z. 10–17, TileSprites Z. 16–23) — sie datieren ihre Zahlen auf das
   Setzen der Grenzen und begründen den Abstand, die Messwerte liegen jetzt
   darunter — sowie `BYTES_PER_CALL_LIMIT = 1` und
   `BYTES_PER_VERTEX_OBJECT_LIMIT = 128`, die Kommentare zu `setPosition()`
   (vertex-objects Z. 111–112) und `setColor()` (sprites Z. 34–35).

5. **`AGENTS.md` Z. 99–102** (ab »A `hot-path-allocations.spec.ts` measures …«
   bis »… never reaches `dist/`.«) werden zu:

   ```
     A `hot-path-allocations.spec.ts` measures the heap bytes of a hot-path call through
     `measureSettledBytes()` in `src/testing/`: it collects what earlier tests left behind
     before the round warms up and answers the lowest of three measurements of
     `measureAllocatedBytes()`, which empties only the young generation before its rounds.
     The Vitest config starts its workers with `--expose-gc` for it, and `src/testing/`
     never reaches `dist/`.
   ```

   Der Kommentar in `packages/twopoint5d/vite.config.ts` Z. 10–11 (»the
   allocation specs call gc() before every measurement …«) stimmt weiter und
   bleibt.

6. Formatieren: `pnpm prettier --write` auf genau die geänderten und neuen
   Dateien (nicht `pnpm format`, das den ganzen Baum anfasst) — `pnpm lint`
   prüft `prettier --check .`.
7. Grün sehen: der Regressionstest aus Schritt 1, die beiden Seeds aus Schritt 1
   und das Verify-Kommando unten.

- Verify:
  `pnpm run ci && (cd packages/twopoint5d && pnpm vitest --run --sequence.shuffle --sequence.seed=7919 src/vertex-objects/hot-path-allocations.spec.ts && pnpm vitest --run --sequence.shuffle --sequence.seed=79190 src/map2d/TileSprites/hot-path-allocations.spec.ts && pnpm vitest --run --sequence.shuffle --sequence.seed=63352 src/vertex-objects/hot-path-allocations.spec.ts src/map2d/TileSprites/hot-path-allocations.spec.ts src/sprites/hot-path-allocations.spec.ts && for i in 1 2 3 4 5 6 7 8 9 10; do pnpm vitest --run --coverage || exit 1; done)`
  — die drei Seed-Läufe sind vor dem Fix rot (Zug 0), die Schleife zehnmal der
  volle Paketlauf mit Coverage.
- Commit (Betreff und Rumpf, so übernehmen):

  ```
  test: measure hot-path allocations after a minor collection

  measureAllocatedBytes() emptied the young generation with a full collection
  right before its rounds. A full collection there can throw the optimized code
  of the round away, and the rounds then timed its recompilation: in a shuffled
  test order updateTile() measured up to 1.35 B per call and touchVO() up to
  1.97 B per call against a limit of 1, and createTile() 88-95 B instead of
  56 B per tile.

  It now empties the young generation with a minor collection, and every
  allocation spec measures through measureSettledBytes(), which collects what
  earlier tests left behind before the round warms up and answers the lowest of
  three measurements. The creation specs no longer need a warm-up of their own.
  ```

- Verlauf:
  - 2026-09-27 Zug 0: Detailplan steht · TEST-001-Nachtrag unverändert
    (`measureAllocatedBytes.ts:38` `gc()`, acht direkte Aufrufe an den
    Plan-Stellen) · Symptom `touchVO()`-Spec aus Paket 2 aufgenommen · Queue:
    `setColor()`-Boxing und Rest-Parameter-Setter nachgemessen, kein Artefakt
    des Helfers, bleiben liegen; neu → Audit: reihenfolgeabhängige Specs
    `AABB2.spec.ts`/`ChunkQuadTreeNode.spec.ts` · Messprotokolle
    `paket-4.zug0-messung.txt`, `paket-4.zug0-reihe1.jsonl`,
    `paket-4.zug0-reihe4.jsonl` im Arbeitsverzeichnis
  - 2026-09-27 Zug 1: Implementierer beauftragt (sonnet, effort low), Report `paket-4.impl-0.json`
  - 2026-09-27 Zug 2: erster Anlauf endete ohne Report (Verify im Hintergrund), per Resume `paket-4.impl-0-versuch-2.json` · FERTIG · 6 Dateien geändert, 1 neu (`measureAllocatedBytes.spec.ts`) · rot vor dem Fix: Regressionstest `['MarkSweepCompact']`, Seed 7919 1,97 B/Aufruf, Seed 79190 1,40 B/Aufruf · Arbeitsbaum schmutzig · Verify selbst: exit=0 (`paket-4.verify.log`)
  - 2026-09-27 Zug 3: Reviewer (sonnet, low) `paket-4.review-0.json`, Diff `paket-4.diff` · beide Findings erfüllt, keine kritischen/wichtigen Befunde
  - 2026-09-27 Zug 4: keine Runde nötig
  - 2026-09-27 Zug 5: committet a68c7068

## Reviewer-Urteil (Zug 3)

- **TEST-001, Nachtrag** — behoben: `measureAllocatedBytes.ts:39` (`const {gc} = globalThis;`), `:44–46` `gc({type: 'minor'})`; acht Aufrufe auf `measureSettledBytes()` (vertex-objects `:85`, `:111`, `:133`; sprites `:35`, `:54`, `:74`; TileSprites `:36`, `:61`), Import und `{warmUpRounds: 1000}` samt Kommentaren entfernt; `AGENTS.md:97–102` neu.
- **Symptom `touchVO()`-Spec aus Paket 2** — behoben ohne Spec-Änderung (Fix im Helfer); Seeds 7919, 79190, 63352 grün, 10× `--coverage` grün.
- Klein: keine.

## Abgleich (Zug 0, 2026-09-27, gegen 785c4305)

- **TEST-001, Nachtrag** — unverändert. `measureAllocatedBytes.ts:38` ruft
  `gc()` (voll) direkt vor den Runden; acht direkte Aufrufe:
  vertex-objects `:86`, `:113`, `:137`; sprites `:36`, `:56`, `:79`;
  TileSprites `:48`, `:81`. `measureSettledBytes.ts:22–32` (aus Paket 2) ruft
  `measureAllocatedBytes()` dreimal, jedes Mal mit diesem `gc()`. `AGENTS.md:99–102`
  beschreibt die Zweiteilung. Belegt rot: `updateTile()` 1,07–1,35 B/Aufruf in
  7 von 20 Läufen unter Stress und gemischter Reihenfolge, Accessoren eines
  Mehr-Vertex-Objekts einmal 2,62 B/Aufruf; `createTile()` 88–95 B statt 56 B.
- **Symptom aus Paket 2** — `vertex-objects/hot-path-allocations.spec.ts:243`
  (`touchVO() and the update() after it …`, Divisor 201) misst über
  `measureSettledBytes()` und ist mit Seed 7919 und 63352 rot (1,81–1,97
  B/Aufruf), weil jede der drei Messungen die volle Sammlung davor trägt.
  Dieselbe Ursache wie das Paket (der Helfer aus Paket 1), deshalb hier; der
  Fix in `measureAllocatedBytes()` behebt es ohne Änderung an der Spec.

## Triage (Zug 0)

- Folgen unter Paket 1: beide (modullokale Schlüssel, `bench(...).run()`)
  gehören Paket 3 und stehen dort als Hinweis — unverändert. Folge unter
  Paket 2 (`gc()` vor der Messung): dieses Paket. Unter Paket 2b keine.
- Queue, `setColor()`-Boxing (`TexturedSprite.ts:108`): mit allen Messvarianten
  nachgemessen (Probe mit `Color(0.3, 0.6, 0.9)` neben abwechselnd getrimmtem
  Frame): 48 B je Sprite auch nach Settle-Messung, je nach Reihenfolge 0–128 B —
  kein Artefakt des Messhelfers, andere Ursache (JIT-Zustand des geteilten
  Fixed-Setters). Bleibt in der Queue, Kandidat Paket 3.
- Queue, Rest-Parameter-Setter (`createVertexObjectPrototype.ts:90`):
  nachgemessen 144,04 B mit zwölf Einzelwerten, 56,02 B mit Array-Argument, in
  jeder Variante — echt, andere Ursache. Bleibt in der Queue.
- Queue, übrige Einträge (`toAttributeArrays()`, Vertex-Formate, geteilte
  Buffer, `copyAttributes()`): andere Ursache, bleiben liegen.
- Neu aufgefallen (Messläufe mit `--sequence.shuffle`):
  `packages/twopoint5d/src/map2d/AABB2.spec.ts:58–135` (`describe('extend')`,
  z. B. `:81` `it('should return self')` ruft `extend()`, `:84–95` prüfen das
  Ergebnis) und `src/map2d/chunk-quad-tree/ChunkQuadTreeNode.spec.ts:83`
  (`it('subdivide()')` baut den Baum um, die `it()` danach prüfen ihn) hängen
  von der Reihenfolge ihrer Tests ab — in gemischter Reihenfolge 8 Tests rot.
  Vorbestehend (beide Dateien seit vor 05d723d7 unverändert, zuletzt
  e4567528), keine Performance- und keine Hot-Path-Testlücke → Audit, low.

## Messreihen Zug 0 (2026-09-27, Node 24.21, Vitest 5.0.1, 8 Kerne)

Kopien der drei `hot-path-allocations.spec.ts` im Scratchpad, je Variante des
Helfers, im vollen Paketlauf (93 Dateien, parallele Worker) an Stelle der echten
drei Specs. Bedingungen: `plain` (`vitest --run`), `cov` (`--coverage`),
`stress` (`--coverage` neben acht Busy-Loops), `shuffle` (`--coverage
--sequence.shuffle`), `shufflenocov`. Volle Tabellen:
`paket-4.zug0-messung.txt` im Arbeitsverzeichnis.

- Reihe 1 (7 Varianten × 4 Bedingungen × 10): heutiger Weg
  (`measureAllocatedBytes()` direkt) reißt die Grenze in 8 von 40 Läufen;
  `measureSettledBytes()` mit durchgereichtem Warm-up 0 von 40; eine einzige
  Messung nach Settle (ohne Minimum) einmal; synchrone Varianten ohne Pause
  0, aber ~360 B Rauschen je Messung; synchrone Variante mit Pause liefert
  negative Werte bis −40 B je Sprite.
- Reihe 2 (Standard-Warm-up der Erzeugungstests, 3 × 8): über
  `measureSettledBytes()` 56,12–59,64 B je Objekt, 107–590 ms je Messung.
- Reihe 3 (volle gegen Minor-Sammlung vor jeder der drei Messungen, fünf
  Seeds): siehe »Warum so«.
- Reihe 4 (Zielentwurf gegen heutiges `measureSettledBytes()` für alle 16
  Messungen der drei Specs, 5 × 10): Zielentwurf 0 Grenzverletzungen,
  allokationsfreie Runden 0,00–0,22 B/Aufruf, Objekte 54,3–56,2 B; heutiges
  `measureSettledBytes()` 2 Verletzungen (`touchVO()`, `shufflenocov`).

## Findings im Volltext

**TEST-001 · medium · packages/twopoint5d-testing/test/map2d-tile-upload.test.js:1**
(weitere Fundstellen: `packages/twopoint5d-testing/web-test-runner.config.js:17`,
`packages/twopoint5d/package.json:50`, `package.json:13`, `nx.json:7`) —
Performance-Regressionstests für den rAF-Hot-Path (vertex-objects, sprites,
map2d) ergänzen

Für den performancekritischen rAF-Hot-Path (vertex-objects, sprites, map2d) gibt
es in der Harness keine automatisierte Absicherung gegen Allokations- oder
Timing-Regressionen. Weder das Root-package.json (Scripts
build/test/test:ci/test:coverage/test:browser/test:scripts/test:affected) noch
packages/twopoint5d/package.json (compile/typecheck/build/test/coverage/watch/...)
noch nx.json (targetDefaults:
build/test/typecheck/checkPkgTypes/checkNameableTypes/lintPkg/publishNpmPkg)
kennen ein bench- oder perf-Target; Vitest wird nirgends im `bench()`-Modus
verwendet. Die Vitest-Stichprobe (VertexObjectPool.spec.ts, FrameLoop.spec.ts,
Map2DTileStreamer.spec.ts, TexturedSprites.spec.ts) prüft ausschließlich
Korrektheit und Dispose-Lifecycle, nie Allokationszahl oder Zeitbudget pro
Frame. Bemerkenswert: web-test-runner.config.js:17-20 startet Chromium bereits
mit `--enable-precise-memory-info` und `--js-flags=--expose-gc` — die
Infrastruktur für heap-basierte Messungen existiert also —, aber die beiden
gesampelten Browsertests (map2d-tile-upload.test.js,
sprites-textured-material.test.js) nutzen `performance.memory` oder `gc()` an
keiner Stelle; sie prüfen nur, ob ein Buffer-Upload (Versionszähler) passiert
oder nicht, nie wie viel dabei alloziert wird. Der CHANGELOG dokumentiert
mehrfach handverlesene Allokationsoptimierungen in genau diesem Hot-Path (z. B.
"the generated multi-component setters ... allocate nothing per vertex", "an
upload ... carries only the objects that were written") — die Einhaltung dieser
Eigenschaft hängt aktuell allein von Code-Review ab, nicht von einem Test, der
bei einer Regression fehlschlägt.

Empfehlung: Für vertex-objects/sprites/map2d gezielte Vitest-`bench()`-Suiten
oder einfache Allokations-Assertions (z. B. Objektzahl vor/nach einem
simulierten Frame-Update über `--expose-gc` und `performance.memory` im
Browser-Testrunner, der das bereits aktiviert) ergänzen, die bei einer
Regression im Hot-Path (neue Allokation pro Frame, O(n)-Verschlechterung)
sichtbar fehlschlagen oder zumindest einen Kennwert für den Menschen sichtbar
machen. Mindestens einen CI-Schritt vorsehen, der ein solches Bench-Ergebnis
archiviert (wie schon für Coverage in ci.yml geschehen), damit Regressionen über
die Zeit auffallen.

Nachtrag (dieses Paket): Paket 1 hat TEST-001 mit den Allokationsspecs und
`measureAllocatedBytes()` behoben (92facd32); Paket 2 fand, dass das `gc()`
direkt vor der Messung optimierten Code verwerfen kann (`Folgen:` unter Paket 2
im Plan). Dieses Paket bringt den Messhelfer zu Ende.
