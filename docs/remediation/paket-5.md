# Paket 5 — Map2D: die Neuberechnung des geneigten Blicks allokationsfrei, unabhängig von der Vorgeschichte

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Folge aus Paket 3b, triagiert in Zug 0 von Paket 4; Befund unten im Volltext)
- Folge von: Paket 3b
- Ziel: Die Per-Tile-Tests von `src/map2d/hot-path-allocations.spec.ts` (`a recomputation allocates
  nothing per tile, however many tiles the view holds`, `a recomputation the limit cuts allocates nothing
  per tile`) sind einzeln und in jeder Reihenfolge grün, und die Neuberechnung des geneigten Blicks ist in
  einem frischen Prozess nach einem Vorlauf, den eine Frame-Schleife in Sekunden erreicht, allokationsfrei —
  was sie bis dahin alloziert, ist gefunden und behoben oder als Einschwingen des JIT belegt und in der Spec
  begründet.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - neu `packages/twopoint5d/src/map2d/hot-path-allocations.tilted-view.spec.ts` (Abschnitt D)
  - `packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts` — `measurePerTile()` (`:165`–`:180`) und
    die beiden Tests (`:182`–`:191`, `:193`–`:209`) ziehen aus, `makeTiltedCamera()` (`:52`–`:59`) mit
    ihnen; die Kommentare der Konstanten (`:14`–`:18`, `:31`–`:32`) verlieren den geneigten Blick
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` — nur die Stellen, die Abschnitt C zuordnet
  - `packages/twopoint5d/src/map2d/convexTileHull.ts` — nur nach Abschnitt C
  - `packages/twopoint5d/src/utils/Dependencies.ts` — nur nach Abschnitt C
  - `packages/twopoint5d/src/testing/measureSettledBytes.ts`, `measureAllocatedBytes.ts` — JSDoc nach
    Abschnitt E, Code nur, falls D3 eine Option braucht
  - `packages/twopoint5d/CHANGELOG.md` — nur Zeile 266, nur nach E4
  - `AGENTS.md` — nur `:99`–`:104`, nur nach E5
  - temporär, nicht im Commit: `packages/twopoint5d/src/map2d/tilted-view.diagnostic.spec.ts` (Abschnitt B)
- Vorgehen: Abschnitte A bis E unten, in dieser Reihenfolge. A vor jeder Änderung. Jeder rote Lauf, jede
  Messung mit Zahl und Pfad der Ausgabedatei in den Report. Ausgaben nach
  `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad`
  (unten `$ARBEITSDIR`), nie ins Projekt.
- Verify (vom Repo-Root, eine Zeile):
  `pnpm run ci && (cd packages/twopoint5d && for i in 1 2 3; do pnpm vitest --run src/map2d/hot-path-allocations.tilted-view.spec.ts -t "however many tiles" || exit 1; pnpm vitest --run src/map2d/hot-path-allocations.tilted-view.spec.ts -t "the limit cuts" || exit 1; done && for s in 1 2 3 4 5 6 7 8 9 10 11 12; do pnpm vitest --run src/map2d/hot-path-allocations.tilted-view.spec.ts src/map2d/hot-path-allocations.spec.ts --sequence.shuffle --sequence.seed=$s || exit 1; done)`
  — fällt D1 (die Tests bleiben in `hot-path-allocations.spec.ts`), steht dort in allen Läufen
  `src/map2d/hot-path-allocations.spec.ts`, und der Shuffle-Lauf nennt die Datei einmal.
- Commit, je nachdem, was der Diff enthält:
  - ändert er `CameraBasedVisibility.ts`, `convexTileHull.ts` oder `Dependencies.ts`:
    `perf(map2d): let a CameraBasedVisibility recomputation read its probe points, hull corners and dependency pairs by index and write its offsets field by field, and measure the per-tile allocations of a tilted view in a spec file of their own, from a fresh process and in any order`
    — der erste Halbsatz nennt nur, was C tatsächlich umgeschrieben hat: nicht angefasste Teile fallen
    weg, eine weitere Stelle aus C7 kommt in derselben Machart dazu;
  - sonst: `test(map2d): measure the per-tile allocations of a tilted CameraBasedVisibility view in a spec file of their own, from a fresh process and in any order`
  - fällt D1, heißt es in beiden statt `in a spec file of their own, from a fresh process and in any
    order` nur `on their own and in any order`. Kein `!`, kein `BREAKING CHANGE:` — nichts an der
    öffentlichen Oberfläche bewegt sich.
- Verlauf:
  - 2026-09-28 Zug 0: Detailplan steht · Befund unverändert, Fundstelle verschoben: die Per-Tile-Tests
    stehen jetzt bei `hot-path-allocations.spec.ts:182`/`:193` (Paket 4: zwei Import-Zeilen oben, zwei
    `describe`-Blöcke hinten), `measurePerTile()` `:165`–`:180` unverändert, der Neuberechnungspfad von
    `CameraBasedVisibility.ts` seit dem Befund nur um `result.serial = this.#serial;` (`:622`, `:868`)
    gewachsen · kein Lauf in Zug 0 (Bash ohne Freigabe des Klassifikators), A1 misst · aus »Offene Befunde«
    nichts übernommen, keine offenen Folgen zu verteilen · Restplan unverändert, Paket 5 ist das letzte
  - 2026-09-28 Zug 1: Implementierer beauftragt (Runde 0), Modell opus (stärkste Stufe), Effort high · Brief
    `$ARBEITSDIR/paket-5.impl-0.brief.txt`, Report nach `paket-5.impl-0.json`
  - 2026-09-28 Zug 2: Report `paket-5.impl-0.json` BLOCKIERT — Prozess ohne `--permission-mode bypassPermissions`
    gestartet, kein Schreib- und kein Testrecht, Arbeitsbaum unverändert · Startfehler des Runners, keine
    Runde · derselbe Brief als zweiter Anlauf von Runde 0 mit Rechten und `--add-dir $ARBEITSDIR`, Report
    nach `paket-5.impl-0-versuch-2.json`
  - 2026-09-28 Zug 2: Report `paket-5.impl-0-versuch-2.json` FERTIG_MIT_VORBEHALT (Session
    `865e614d-b26b-4ea0-982c-2ff22de9ddf3`) · D4 trägt (D3 sprengt das Budget unter Coverage), C nur C5
    `Dependencies#equals()` 383 → 0 B je Neuberechnung · geändert `Dependencies.ts`, `hot-path-allocations.spec.ts`,
    `measureAllocatedBytes.ts`, `measureSettledBytes.ts`, `CHANGELOG.md`, neu `hot-path-allocations.tilted-view.spec.ts` ·
    Arbeitsbaum schmutzig · Verify exit=0 (`$ARBEITSDIR/paket-5.verify.log`, `ci` teils aus dem Nx-Cache),
    dazu `coverage --skip-nx-cache` exit=0, 101 Dateien, 2 327 Tests (`paket-5.verify-coverage-nocache.log`)
  - 2026-09-28 Zug 3: Reviewer beauftragt (Runde 0), opus, Effort high · Diff `$ARBEITSDIR/paket-5.diff`
  - 2026-09-28 Zug 3: Urteil nicht freigegeben (`paket-5.review-0.json`) · (a) einzeln grün und (b) jede
    Reihenfolge erfüllt, (c) erfüllt bis auf die Begründung in der Spec · wichtig: 1 Differenzmessung
    positionsabhängig (erste Ansicht je Versuch +60–65 B, getauscht Limit-Test rot, 2 B je Tile bleiben grün),
    2 JSDoc `measureSettledBytes.ts:10`/`measureAllocatedBytes.ts:12` kennen die direkte Messung nicht, 3 `AGENTS.md:99`
    ebenso · klein: 4 Spec-Kommentar `:75` schreibt eigenem Code Bytes zu, 11 000–14 000 im JSDoc unscharf; 5
    `Dependencies#update()` destrukturiert weiter neben der Begründung in `equals()`
  - 2026-09-28 Zug 4 Runde 1: Befunde 1–3 (dazu 4, 5) per `--resume 865e614d…` an denselben Implementierer,
    opus, Effort high, gleiche Rechte · Brief `paket-5.impl-1.brief.txt`, Report nach `paket-5.impl-1.json`
  - 2026-09-28 Zug 4 Runde 1: Report FERTIG · Positionseffekt = Drift des festen Betrags in `new_space`
    während der Messfolge; neu 400 Settle-Runden je Ansicht, 5 ABBA-Gruppen, Median der stillen Gruppen,
    `Math.abs(...)`, Limit-Test 150 gegen 50 · Mutante je 16 Tiles jetzt rot (2,00 B), getauscht grün (0,00) ·
    `AGENTS.md`, JSDoc beider Messhilfen, `Dependencies#update()`-Satz, CHANGELOG `:266` nachgezogen · Verify läuft
    · Verify exit=0 (`paket-5.verify-1.log`), `coverage --skip-nx-cache` exit=0, 101 Dateien, 2 327 Tests
    (`paket-5.verify-1-coverage-nocache.log`) · Reviewer per `--resume` gezielt auf Befunde 1–5, Diff `paket-5.diff-1`
  - 2026-09-28 Zug 4 Runde 1: Review (`paket-5.review-1.json`) freigegeben · Befunde 1–5 erledigt, Mutanten
    nachgefahren (je 16 Tiles rot, getauscht grün) · neu nur klein (2) · Fortschritt: 5 von 5 offen → erledigt
  - 2026-09-28 Zug 5: Commit `b4857658` auf dem Verify `paket-5.verify-1.log` (exit=0, danach keine Codeänderung) ·
    7 Dateien · Plan auf `[x]`, Nebenbefund in »Offene Befunde«

## Urteil des Reviewers (Runde 1, abschließend)

- **(a) einzeln grün: behoben** — `src/map2d/hot-path-allocations.tilted-view.spec.ts:141` und `:152`, einzeln im
  frischen Prozess 0,00 B je Tile.
- **(b) jede Reihenfolge: behoben** — eigene Datei (`:140`), eigener Prozess je Spec-Datei (`paket-5.diagnostic/pid.txt`),
  Reihenfolge innerhalb einer Gruppe ohne Einfluss, zwölf Shuffle-Seeds und drei volle Coverage-Läufe grün.
- **(c) zugeordnet, eigener Anteil behoben, Rest begründet: behoben** — `src/utils/Dependencies.ts:143`–`:151`
  (383 → 0 B je Neuberechnung); Begründung für three.js in Maglev in der Spec `:85`–`:99`, `measureAllocatedBytes.ts:22`–`:25`.
- Befunde der Runde 0: 1 (Differenz positionsabhängig) erledigt `:115`–`:133`, `:149`, `:158`–`:165` · 2 JSDoc der
  Messhilfen erledigt · 3 `AGENTS.md:103`–`:105` erledigt · 4 Spec-Kommentar und 11 000–14 000 erledigt · 5
  `Dependencies#update()` begründet erledigt.
- Abweichungen bewertet: 400 statt 200 Settle-Runden angemessen (Messpunkt ~3 200, Messung endet bei ~4 400
  Neuberechnungen, bei 60 fps ~75 s); Median der stillen Gruppen statt niedrigste von drei angemessen.
- Grenzen der Messung (Reviewer): eine Allokation, die nur alle paar hunderttausend Aufrufe fällt, sieht der Test
  nicht (die alte Messung auch nicht); im ruhigen Prozess ist oft nur 1 von 5 Gruppen still, ihr Fehler ist auf
  ≤ 0,04 B je Tile begrenzt; Budgetrand ohne Limit ~10 %.

## Kleine Befunde

- `packages/twopoint5d/src/map2d/hot-path-allocations.tilted-view.spec.ts:13`–`:14` — »a tile that allocates anything
  costs 16 B at least; one allocation in 16 tiles reads 2 B per tile« gilt nur für ein Objekt von 32 B; eine
  HeapNumber (16 B) in 16 Tiles ergibt 1,00 B je Tile, genau auf der Grenze. Richtig etwa: »one object of 32 B in 16
  tiles reads 2 B per tile; 16 B in fewer than 16 tiles shows«.
- `packages/twopoint5d/src/testing/measureAllocatedBytes.ts:26` — JSDoc-Zeile mit 121 Zeichen, der Block bricht
  sonst bei 100 um.

## Nebenbefunde (Begründung des Urteils)

- `packages/twopoint5d/src/vertex-objects/hot-path-allocations.spec.ts:155`–`:170` — vorbestehend (in `e7767c6d`
  an derselben Stelle), liegt in der Domäne Vertex Objects, also unter der Scope-Regel → Scope; nicht dieselbe
  Ursache im Code dieses Pakets (andere Datei, eigene Messfolge), deshalb nicht mitgenommen.

## Warum dieser Schnitt

Zug 0 von Paket 4 hat gemessen: einzeln 3,48 B je Tile von 208 und 7,23 B je Tile von 100 — beides
rund **723 B je Neuberechnung**. Derselbe Betrag bei doppelt so vielen Tiles heißt: die Tests scheitern
nicht an Kosten je Tile, sondern an einem festen Betrag je Neuberechnung, und der kommt aus Code, der
einmal je Neuberechnung läuft. Solcher Code erreicht den optimierenden Compiler zuletzt; `--trace-deopt`
zeigte keine Deopts, und `computeVisibleTiles`, `collectTilesWithinProbeHull`, `dependenciesChanged`,
`updateWorldMatrix` waren bei der ersten Messung noch nicht in TurboFan. In der Dateireihenfolge laufen
vorher rund 38 000 Neuberechnungen der Draufsicht und 200 000 Aufrufe des Cache-Pfads durch denselben
Code — deshalb grün dort und nur dort.

Das Paket hat deshalb zwei Hälften: zuordnen, welche Stelle am Messpunkt was alloziert und in welcher
Compiler-Stufe ihre Funktion dann steht (B), beheben, was der Quelltext selbst alloziert (C) — und die
Tests so stellen, dass sie diesen Zustand aus eigener Kraft messen, statt vom Vorlauf anderer Tests zu
leben (D).

**Der Messpunkt.** »Ein Vorlauf, den eine Frame-Schleife in Sekunden erreicht« heißt in diesem Paket:
der Vorlauf, den `measureSettledBytes()` der Runde von `measurePerTile()` heute gibt — 200 Runden, `gc()`,
dann 200 Aufwärmrunden je Messung: 1 600 Neuberechnungen bis zur ersten, 3 600 bis zur dritten der drei
Messungen (vier je Runde). Eine Frame-Schleife mit 60 fps, deren Kamera sich jeden Frame bewegt, ist dort
nach einer halben bis einer Minute. An diesem Punkt wird zugeordnet, und an ihm misst sich
»allokationsfrei«.

## A — Rot festhalten, vor jeder Änderung

Aus `packages/twopoint5d`:

A1. Jeder Test allein, je dreimal, Ausgabe nach `$ARBEITSDIR/paket-5.impl-red-A1.txt`:

```bash
pnpm vitest --run src/map2d/hot-path-allocations.spec.ts -t "however many tiles"
pnpm vitest --run src/map2d/hot-path-allocations.spec.ts -t "the limit cuts"
```

Erwartet nach Zug 0 von Paket 4: rot, rund 3,48 B je Tile von 208 und 7,23 B je Tile von 100.

A2. Die ganze Datei gemischt, Seeds 1–12, Ausgabe nach `$ARBEITSDIR/paket-5.impl-red-A2.txt`:
`pnpm vitest --run src/map2d/hot-path-allocations.spec.ts --sequence.shuffle --sequence.seed=$s`. Zu
berichten: welche Seeds rot, welche Tests rot, mit Wert. Erwartet 5 von 12 rot, nur die beiden Tests;
wird ein anderer Test der Datei rot, gilt D5.

A3. Die Datei in ihrer Reihenfolge, einmal: grün; beide Werte je Tile notieren.

## B — Zuordnen: wer alloziert, und in welcher Compiler-Stufe

B1. Eine temporäre Spec `src/map2d/tilted-view.diagnostic.spec.ts`, nur einzeln gestartet, vor dem Report
gelöscht; eine Kopie samt Ausgaben nach `$ARBEITSDIR/paket-5.diagnostic/`. Sie baut die Ansicht genau wie
`measurePerTile()`: `new Map2DTileCoordsUtil(400, 400, 0.25, -0.5)`, die Kamera von `makeTiltedCamera()`
(`PerspectiveCamera(75, 1.6, 0.1, 4000)` bei `(0, 350, 500)`, Blick auf den Ursprung), `makeCenter()`,
`makeMatrixWorld()` und `makeOtherMatrixWorld()` im Wechsel, vier Neuberechnungen je Runde — einmal ohne
Limit, einmal mit `maxVisibleTiles = 100`, jede Variante in einem eigenen Lauf (`-t`), damit jede in einem
frischen Prozess beginnt. Sie gibt `process.version`, `process.versions.v8` und `process.pid` aus.

B2. Am Messpunkt — `measureSettledBytes(round)` einmal durchlaufen lassen, danach — 50 Runden unter dem
Sampling-Heap-Profiler des Inspectors:

```ts
import {Session} from 'node:inspector/promises';

const session = new Session();
session.connect();
await session.post('HeapProfiler.enable');
await session.post('HeapProfiler.startSampling', {
  samplingInterval: 16,
  includeObjectsCollectedByMajorGC: true,
  includeObjectsCollectedByMinorGC: true,
});
for (let i = 0; i < 50; i++) round();
const {profile} = await session.post('HeapProfiler.stopSampling');
```

Über den Baum `selfSize` je Knoten summieren, geschlüsselt nach `functionName`, `url`, `lineNumber + 1`,
`columnNumber + 1`, geteilt durch 200 Neuberechnungen; die 30 größten mit dem aufrufenden Knoten
ausgeben. Die Summe soll in der Größenordnung dessen liegen, was `measureAllocatedBytes()` für dieselben
Runden misst — sonst stimmt die Zuordnung nicht, und das steht im Report.

B3. Am selben Punkt die Stufe jeder Funktion auf dem Pfad. Am Kopf der Diagnose-Datei
`v8.setFlagsFromString('--allow-natives-syntax')`, danach über `new Function`:
`%ActiveTierIsTurbofan(f)`, `%ActiveTierIsMaglev(f)`, `%ActiveTierIsSparkplug(f)`,
`%ActiveTierIsIgnition(f)`. Kennt die V8 der Node-Version diese Aufrufe nicht, `%GetOptimizationStatus(f)`,
dekodiert nach dem `OptimizationStatus`-Enum in `src/runtime/runtime-test.cc` genau dieser V8-Version.
Gefragt werden mindestens: die Methoden von `CameraBasedVisibility.prototype` auf dem Pfad
(`computeVisibleTiles`, `dependenciesChanged`, `takeOverTileCoords`,
`findPointsOnPlaneThatAreInViewFrustum`, `findVisibleTiles`, `collectTilesWithinProbeHull`,
`removePreviousTiles`, `sortKept`, `evictSlots`, `heapifyKept`, `siftDownKept`, `searchCanStop`, `enqueue`,
`prepareTile`, `updateFrustumBox`, `pushNeighbors`, `acquireTileBox`, `placeTile`, `setBox`,
`convertToPlaneCoords2D`), `Dependencies.prototype.changed`/`equals`/`update`, `convexTileHull`,
`forEachTileWithinConvexHull`, `truncateArray`, `Map2DTileCoordsUtil.prototype.computeTilesWithinArea`/
`copy`/`equals`, `TileSlotTable.prototype.get`, und jede three.js-Funktion, die B2 nennt.

B4. Die Einschwingkurve, in einem weiteren Lauf je Variante: Bytes je Neuberechnung
(`measureAllocatedBytes(round, {warmUpRounds: 0, rounds: 50})`) und die Stufen der Funktionen, die B2
nennt, nach 1 600, 3 600, 8 000, 20 000 und 80 000 Neuberechnungen. Dazu einmal nach einem Vorlauf auf der
billigen Ansicht aus D3, um zu sehen, ob sie dieselben Funktionen aufwärmt.

B5. Die Tabelle in den Report: Stelle (Datei:Zeile, Funktion, Aufrufer) · B je Neuberechnung am
Messpunkt · was dort entsteht (HeapNumber, Array-Iterator und Ergebnisobjekte, Backing Store, Closure,
Objekt) · Stufe der Funktion am Messpunkt · ab welcher Neuberechnung die Bytes weg sind.

## C — Im Quelltext beheben, was der Quelltext alloziert

**Regel.** Eine Stelle im eigenen Code (`src/map2d/`, `src/utils/`), der B2 am Messpunkt Bytes zuordnet,
wird umgeschrieben, wenn sie über eine Form alloziert, die eine allokationsfreie Entsprechung in jeder
Compiler-Stufe hat:

- Array-Destrukturierung (`const [a, b] = list[i]!`, `for (const [a, b] of list)`): bis TurboFan die
  Funktion übernimmt, läuft das Iterator-Protokoll — ein Array-Iterator und ein Ergebnisobjekt je Schritt;
- ein Double, das in einen Aufruf hineingeht oder aus ihm herauskommt (`vector.set(x - y, …)`): geboxt,
  wo der Aufruf nicht inlined wird — die Regel, die `CameraBasedVisibility.ts:68`–`:73` für das Modul
  aufschreibt und der der Code an anderen Stellen schon folgt;
- Closure, Objekt- oder Array-Literal je Aufruf.

Umgeschrieben wird auch dann, wenn TurboFan die Allokation später entfernt: die Regel des Moduls rechnet
nicht mit Inlining, und die Neuberechnung läuft einmal je Frame — ihre Funktionen kommen als letzte in
TurboFan an.

**Nicht umgeschrieben** wird Double-Arithmetik in einer Funktion, die am Messpunkt noch in Ignition oder
Sparkplug steht (dort ist jedes Zwischenergebnis eine HeapNumber, keine Quelltextform vermeidet das), und
nichts in three.js. Beides ist Einschwingen des JIT und steht mit Stufe und Einschwingpunkt aus B4 in der
Tabelle. three.js wird auch nicht in Modulcode nachgebaut: eine eigene Funktion wäre genauso kalt.

Kandidaten aus dem Lesen in Zug 0 — **jeder nur, wenn B2 ihm Bytes zuordnet**:

C1. `CameraBasedVisibility.ts:677`, `findPointsOnPlaneThatAreInViewFrustum()`:
`const [ndcX, ndcY] = FRUSTUM_PROBES_NDC[i]!;` →
`const probe = FRUSTUM_PROBES_NDC[i]!;` `const ndcX = probe[0];` `const ndcY = probe[1];`

C2. `CameraBasedVisibility.ts:1018`, `collectTilesWithinProbeHull()`: `const [x, y] = hull[i]!;` → über
`const corner = hull[i]!;` und `corner[0]`/`corner[1]`.

C3. `CameraBasedVisibility.ts:1233`, `pushNeighbors()`: `const [dx, dy] = NEIGHBOR_DX_DY[i]!;` → über
`const step = NEIGHBOR_DX_DY[i]!;`. Läuft je Tile und wird früh heiß; nur mit Befund aus B2.

C4. `convexTileHull.ts:102`, `:123`, `:124` in `forEachTileWithinConvexHull()`: dieselbe Umformung.

C5. `Dependencies.ts`: `update()` `:105` `for (const [name, callbacks] of this.#props)` → Indexschleife wie
in `equals()`, mit dem Kommentar zur Schleifengrenze, den das Modul dort trägt; `equals()` `:141`
`const [name, callbacks] = this.#props[i]!;` → `const prop = this.#props[i]!;` `const name = prop[0];`
`const callbacks = prop[1];`. Beide laufen bei jeder Neuberechnung: `#deps.changed()` fragt `equals()` und
schreibt über `update()`.

C6. Doubles durch `set()` auf dem Pfad, jeweils als Feldzuweisungen:
- `CameraBasedVisibility.ts:544` `this.#centerPoint2D.set(centerPoint[0], centerPoint[1])` → `.x`/`.y`;
  der Kommentar `:543` bleibt sinngemäß;
- `:665` `this.#planeOffset.set(xOffset, 0, yOffset)` → `.x`/`.y`/`.z`, dann `_m.makeTranslation(this.#planeOffset)`;
- `:756`–`:760` `this.#tileBoxOffset.set(xOffset - centerX, 0, yOffset - centerY)` → `.x`/`.y`/`.z`;
- `:855`–`:858` `this.#scratchOffset.set(…)` → `.x`/`.y`;
- `:1252` in `convertToPlaneCoords2D()` `target.set(_v.x, _v.z)` → `target.x = _v.x;` `target.y = _v.z;`.
Wo ein Kommentar den Grund braucht, verweist er wie die übrigen Stellen des Moduls auf die Notiz zu
Doubles am Modulkopf.

C7. Jede weitere Stelle im eigenen Code, die B2 nennt: dieselbe Regel, im Report mit Form und Bytes.

C8. Hinweis, zu prüfen, bevor eine `push()`-Stelle umgebaut wird: `truncateArray()` leert die
Arbeitslisten per `pop()`. Nach dem V8-Quelltext (`ArrayPrototypePop` in `builtins-array-gen.cc`,
`SetLengthImpl` in `elements.cc`) lässt TurboFan beim `pop()` den Backing Store stehen; der Builtin-Pfad
der unteren Stufen schickt ein `pop()`, nach dem weniger als die Hälfte belegt wäre, in die Runtime, die
den Store kürzt und ihn bei Länge 0 ganz freigibt — sobald er mehr als 16 Plätze hat. Ordnet B2
Backing Stores den `push()`-Stellen zu (`pushFrontier()`, `kept.push()`, `visibles.push()`,
`#tiles.push()`), ist die erste Frage die Stufe von `truncateArray` am Messpunkt, nicht die
`push()`-Stelle.

Nach jeder Umformung B2 erneut am selben Messpunkt; Bytes der Stelle vorher → nachher in den Report — das
ist der rote Beleg dieser Änderungen. `CameraBasedVisibility.spec.ts`, `convexTileHull.spec.ts` und die
Specs von `Dependencies` laufen unverändert grün; das Verhalten ändert sich nicht.

## D — Die Tests messen aus eigener Kraft

D1. **Eigene Datei.** Neu `src/map2d/hot-path-allocations.tilted-view.spec.ts` (Punkt im Namen wie
`ChunkQuadTreeNode.extended.spec.ts`), `describe('CameraBasedVisibility on the hot path of a tilted view')`.
Hinein ziehen `measurePerTile()` und beide Tests, Namen unverändert. Die Helfer, die sie brauchen —
`makeCenter()`, `makeMatrixWorld()`, `makeOtherMatrixWorld()`, `makeTiltedCamera()` — und
`BYTES_PER_CALL_LIMIT` werden kopiert, nicht aus der anderen Spec importiert; `makeTiltedCamera()`
verlässt `hot-path-allocations.spec.ts`, dort nutzt sie niemand sonst. Kopfkommentar der neuen Datei, im
Sinn von:

```ts
// Vitest runs every spec file in a process of its own, so the recomputations measured here start
// from a compiler that has seen nothing of their path — as they do in an application that starts
// with a tilted view. What the path allocates before the compiler has taken it over is accounted
// for in `measurePerTile()`, not left to the tests that happen to run before.
```

Grund: nur so prüft die CI bei jedem Lauf den Zustand, den die Dateireihenfolge verdeckt hat. **Vorher
prüfen**, worauf der Kommentar steht: B1 gibt `process.pid` aus; zwei Spec-Dateien in einem
`pnpm vitest --run`-Lauf müssen verschiedene Prozesse zeigen. Tun sie es nicht (Vitest 5, Pool-Vorgabe,
`isolate`), fällt D1: die Tests bleiben in `hot-path-allocations.spec.ts`, D2–D4 gelten dort, der Report
sagt es, und Verify und Commit folgen der Ausweichzeile oben.

D2. **Stufe 1.** Sind nach C beide Tests in der neuen Datei mit dem unveränderten `measurePerTile()`
grün — jeder allein dreimal, beide Reihenfolgen über die Seeds 1–12 —, bleibt es dabei. Der Kommentar an
`measurePerTile()` nennt die gemessenen Werte je Tile.

D3. **Stufe 2.** Sonst wärmt `measurePerTile()` den Pfad vor `measureSettledBytes()` selbst auf, bemessen
nach B4: so viele Neuberechnungen, wie die Funktionen aus B2 brauchen, bis sie in ihrer letzten Stufe
laufen und die Bytes unter der Grenze liegen, dazu ein Viertel Rand. Billiger ist erlaubt, wenn B4 zeigt,
dass es dieselben Funktionen aufwärmt: eine zweite `CameraBasedVisibility` mit derselben geneigten Kamera
auf einem groben Raster (`new Map2DTileCoordsUtil(4000, 4000, 0.25, -0.5)`, eine Handvoll Tiles), dieselben
zwei Matrizen im Wechsel, für den Limit-Test mit einem `maxVisibleTiles` unter ihrer Tile-Zahl, damit der
gekappte Pfad mitläuft. Budget: jeder der beiden Tests unter drei Sekunden in `pnpm test:coverage` — die
Grenze, die `hot-path-allocations.spec.ts:31`–`:32` für diese Tests setzt; gemessen an der Dauer, die
Vitest für die Datei ausgibt. Der Kommentar am Vorlauf nennt die Funktionen, ihre Stufe am Messpunkt, nach
wie vielen Neuberechnungen sie ankommen und die Bytes je Neuberechnung davor — Zahlen aus B4, zeitlos
formuliert. Braucht der Vorlauf eine Option an `measureSettledBytes()` (etwa `settleRounds`), ist das die
Stelle, an der sie entsteht, samt JSDoc und E5.

D4. **Stufe 3.** Bringt kein Vorlauf im Budget beide unter die Grenze, messen die Tests die Bytes je Tile
als Unterschied zweier Ansichten derselben Kamera nach demselben Vorlauf — der feste Betrag je
Neuberechnung fällt dabei heraus, und genau den hat B4 als Einschwingen belegt:
- ohne Limit: zwei Instanzen auf `Map2DTileCoordsUtil(400, 400, 0.25, -0.5)` (208 Tiles) und einem
  Raster, das etwa halb so viele Tiles ergibt (Kantenlänge aus einer Probe, im Kommentar mit Tile-Zahl);
- mit Limit: `maxVisibleTiles` 100 und 50 auf dem 400er-Raster, beide gekappt.
Je Ansicht die niedrigste von drei Messungen, abwechselnd gemessen (klein, groß, klein, groß, klein,
groß), damit das Weiterlaufen des Compilers keine Seite bevorzugt. Geprüft wird
`(bytesGroß − bytesKlein) / (tilesGroß − tilesKlein) < BYTES_PER_CALL_LIMIT`; die Meldung nennt beide
Werte und den festen Betrag je Neuberechnung, der Kommentar dessen Beleg aus B4. Die Testnamen bleiben.

D5. Wird in A2 oder im Verify ein anderer Test von `hot-path-allocations.spec.ts` gemischt rot, hat er
dieselbe Ursache — seine Messung lebt vom Vorlauf der Tests davor — und wird hier nach derselben Leiter
D2 → D3 → D4 behoben, in seiner Datei. Der Report nennt ihn.

## E — Doku, die an den Messungen hängt

E1. `hot-path-allocations.spec.ts`: die Kommentare an `BYTES_PER_CALL_LIMIT` (`:14`–`:18`, »a
recomputation of the tilted view 0.01 to 0.33 B per tile of 208 and 0.03 B per tile of 100 under the
limit«) und an den Rundenkonstanten (`:31`–`:32`, »and four of the tilted view with its 208 tiles«)
verlieren den geneigten Blick; die neue Datei trägt ihre eigenen, in diesem Paket gemessenen Werte.

E2. `measureSettledBytes.ts:22`–`:24`: der Satz »over 50 runs of the suite … in shuffled order — the
allocation-free rounds of the specs measured 0.22 B per call at most« stimmte zu Beginn dieses Pakets
nicht (5 von 12 Seeds rot). Er nennt danach, was gemessen ist: die Läufe und Seeds dieses Pakets und ihr
Maximum — oder er verliert »in shuffled order«.

E3. `measureAllocatedBytes.ts:17`–`:20` (»The warm-up rounds let the optimizing compiler settle … what is
measured is the code an application executes after a few seconds, not the interpreter«): gegen B4 halten.
Zeigt B4 eine Funktion, die einmal je Runde läuft und nach 200 Runden noch unter TurboFan steht, sagt der
Satz, dass die Aufwärmrunden die Funktionen einschwingen, die eine Runde oft ruft, und dass eine Funktion,
die sie einmal ruft, die Zahl an Runden braucht, die B4 fand. Sonst bleibt er.

E4. `CHANGELOG.md:266` (»perf `computeVisibleTiles()` … allocates nothing once a frame loop has settled,
neither per call nor per tile«): steht in `[Unreleased]` und darf sich ändern. Liegt der Einschwingpunkt
aus B4 für den geneigten Blick jenseits des Messpunkts, nennt die Zeile ihn — nach wie vielen
Neuberechnungen einer bewegten Kamera sie nichts mehr alloziert. Die Umformungen aus C bekommen keinen
eigenen Eintrag, sie gehören zu dieser Zeile; der Umzug der Tests keinen. Skill `updating-changelog` laden,
bevor die Zeile angefasst wird.

E5. `AGENTS.md:99`–`:104` beschreibt `measureSettledBytes()`: nachziehen nur, wenn D3 dessen Signatur
oder Verhalten ändert.

## Nicht in diesem Paket

- Die Allokations-Specs außerhalb von `src/map2d/hot-path-allocations.spec.ts` (`vertex-objects`,
  `sprites`, `map2d/TileSprites`, `map2d/chunk-quad-tree`): nach Zug 0 von Paket 4 einzeln grün, nicht
  Teil dieses Befunds.
- Kein CI-Job mit `--sequence.shuffle` — Grund wie in Paket 4 (Gate über Module außerhalb des Scopes).
  Die eigene Datei aus D1 bringt den Zustand, auf den es ankommt, ohne Shuffle in jeden CI-Lauf.
- Keine Änderung am Verhalten von `CameraBasedVisibility` und keine an seiner Oberfläche.
- three.js bleibt, wie es ist (Regel in C).

## Abgleich in Zug 0

| Befund | Stand | Fundstelle jetzt |
| --- | --- | --- |
| Per-Tile-Tests reihenfolgeabhängig, geneigter Blick in einem frischen Prozess nicht allokationsfrei | unverändert, verschoben | `src/map2d/hot-path-allocations.spec.ts:182` (`… however many tiles the view holds`, im Befund `:180`) und `:193` (`… the limit cuts …`, im Befund `:191`): Paket 4 hat die Imports um `Object3D`, `Scene`, `CameraBasedVisibilityHelpers`, `Map2DSpatialHashGrid` erweitert und zwei `describe`-Blöcke angehängt (`:295`–`:316`, `:318`–`:372`). `measurePerTile()` `:165`–`:180` wie in 3b. Im Neuberechnungspfad von `CameraBasedVisibility.ts` seit dem Befund nur `result.serial = this.#serial;` an `:622` und `:868` — ein Smi-Store, keine Allokation. Nicht nachgemessen: Bash blieb in Zug 0 ohne Urteil des Klassifikators; A1 misst vor jeder Änderung. |

## Triage in Zug 0

- **Folgen unter erledigten Paketen:** Pakete 1, 2, 3, 3b und 4 tragen `Folgen: keine`. Paket 5 ist selbst
  die Folge aus 3b, erste Generation (3b ist von 3 abgespalten, keine Folge). Nichts zu verteilen.
- **Offene Befunde:** keiner teilt die Ursache dieses Pakets (Allokationen von Code, der einmal je
  Neuberechnung läuft, und Specs, die vom Vorlauf anderer Tests leben). Alle bleiben mit ihrem Urteil
  `→ Scope` in der Queue für die Drain-Runde:
  - `TexturedSprites.ts:57`/`:65` — Typ des Material-Parameters, andere Komponente.
  - `CameraBasedVisibility.ts:157` (jetzt `:227`) `frustumBoxScale` ohne Prüfung — Eingabeprüfung.
  - `CameraBasedVisibility.ts:31`–`:32` (jetzt `:33`–`:36`) JSDoc von `TileBox#primary` — Doku.
  - `CameraBasedVisibility.spec.ts:349` — Test-Kommentar.
  - `writeTileCoords()` (jetzt `CameraBasedVisibility.ts:715`–`:724`) mit 1×1-Rechteck bei Tile-Größen
    unter 1 — liegt auf dem Pfad (`acquireTileBox()`), ist aber Geometrie, keine Allokation; C fasst die
    Funktion nicht an.
  - `Map2DSpatialHashGrid.ts:133` `Set.clear()` — alloziert, aber eigene Ursache (Ausgabeform der
    Abfrage), andere Klasse, nicht auf dem Pfad.
  - `ChunkQuadTreeNode.spec.ts:77`–`:80` Testnamen · `Map2DSpatialHashGrid.ts:66` `aabb` mit
    `Infinity`/`NaN` · `Map2DTileStreamer.ts:200` Wurf in `removeTiles` · `Map2DTileRenderer.ts:196`
    `#updateDataSerial` vor `update()` — andere Ursachen.
- **Restplan:** Paket 5 ist das letzte offene Paket; danach der Abschluss mit der Drain-Runde über die
  zehn offenen Einträge. Reihenfolge und Schnitt unverändert.

## Entscheidungen in Zug 0 (ohne Rückfrage, mit Grund)

- **Messpunkt = der Vorlauf, den `measureSettledBytes()` heute gibt** (1 600 bis 3 600 Neuberechnungen):
  die einzige Zahl, die die Spec schon anwendet, und eine, die eine Frame-Schleife mit bewegter Kamera in
  einer halben bis einer Minute erreicht. Ein kleinerer Wert machte jede Double-Rechnung einer noch nicht
  optimierten Funktion zum Befund, ein größerer verfehlte »in Sekunden«.
- **Die Tests ziehen in eine eigene Datei** (D1): der Plan verlangt »einzeln grün«; ohne eigene Datei prüft
  das nur dieser Verify, danach nie wieder, weil die CI die Datei in ihrer Reihenfolge fährt. Rückweg bei
  gemeinsamem Prozess steht in D1.
- **Umgeschrieben wird nur, was B2 nennt** (C): die Kandidaten C1–C6 stammen aus dem Lesen, nicht aus einer
  Messung; ohne Bytes am Messpunkt wäre jede Umformung Stilpflege auf einem Pfad, den drei Pakete schon
  gebaut haben.
- **three.js bleibt unangetastet** und wird nicht nachgebaut: eine eigene Funktion wäre am Messpunkt
  genauso kalt, und in einer Anwendung hält der Renderer `compose()`, `multiplyMatrices()`, `invert()` und
  `setFromProjectionMatrix()` ohnehin in jedem Frame warm.
- **Leiter D2 → D3 → D4** statt einer festen Lösung: welche Stufe trägt, hängt an B4. D4 ist die letzte, weil
  sie den festen Betrag je Neuberechnung nicht mehr prüft; sie ist zulässig, weil der Plan den Beleg als
  Einschwingen in der Spec ausdrücklich vorsieht.
- **Budget drei Sekunden je Test unter Coverage:** steht schon als Kommentar an den Rundenkonstanten und
  hält die Suite in ihrem Rahmen.
- **Modell stärkste Stufe, Effort high:** eine Untersuchung mit V8-Werkzeug (Sampling-Heap-Profiler,
  Stufenabfrage), deren Ergebnis den Umfang erst festlegt — unklarer Blast Radius auf dem heißesten Pfad
  von `map2d`; der Reviewer erbt den Wert.

## Befund im Volltext

**Folge aus Paket 3b · `packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts:180`/`:191`** (jetzt
`:182`/`:193`), triagiert in Zug 0 von Paket 4 — Die Per-Tile-Tests (`a recomputation allocates nothing
per tile, however many tiles the view holds`, `a recomputation the limit cuts allocates nothing per tile`)
sind einzeln rot — deterministisch 3,48 B je Tile von 208 bzw. 7,23 B je Tile von 100, beides rund 723 B je
Neuberechnung — und unter `--sequence.shuffle` in 5 von 12 Seeds. Grün sind sie nur hinter den Tests davor,
die rund 38 000 Neuberechnungen der Draufsicht laufen lassen. Frischer Prozess, geneigter Blick, Messung im
Stil der Spec: 7 380 B je Neuberechnung nach 200 Vorlauf-Runden, 1 300–1 430 B nach 2 000, 91 B nach
20 000; 40 000 Draufsicht- oder 8 000 geneigte Vorlauf-Neuberechnungen vor `measureSettledBytes` lassen
immer noch 2,01 B je Tile (418 B je Neuberechnung). `--trace-deopt` zeigt keine Deopts; die einmal je
Neuberechnung laufenden Funktionen (`computeVisibleTiles`, `collectTilesWithinProbeHull`,
`dependenciesChanged`, `updateWorldMatrix` …) erreichen TurboFan erst nach der ersten Messung.
Einordnung: Symptom — 3b sollte die Allokationsfreiheit im eingeschwungenen Frame-Takt herstellen und per
Spec festhalten; die Spec hält sie nur in einer Testreihenfolge fest, und ob der geneigte Blick in einer
Anwendung, die mit ihm startet, in Sekunden allokationsfrei wird, ist offen. 3b ist committet, also ein
Nachtragspaket. Messskripte von Zug 0 in Paket 4:
`/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad/paket-4.zug0-messungen/`.
