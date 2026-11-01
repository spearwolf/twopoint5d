# Paket 11 — map2d: Quad-Tree, Spatial Hash Grid, Sichtbarkeit, Grenzwertprüfung und Guide

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-001 (low), IMPL-001 (low), PERF-002 (low), CONS-004 (low), CONS-013 (low), API-006 (info), BUG-028 (info) · READ-005 ist im Zug 0 nach Paket 11b geteilt
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie CONS-004 — für »endlich mit Untergrenze« und »ganze Zahl« gibt es keinen Helfer, also prüft und formuliert jede Stelle von Hand, und die Meldungen sind auseinandergelaufen: »of at least 1«, »of 0 or above«, »above 0 or Infinity«, »a non-negative integer« neben »of 0 or more«): die Grundform-Prüfungen außerhalb von `map2d/` in `stage/`, `texture/`, `text/`, `display/` und `vertex-objects/`, Liste in Schritt 4
- Ziel: map2d teilt seine Bäume effizient, nullt nur den nötigen Bereich, prüft Grenzwerte zentral, hat `clear()` am Hash Grid, und der Guide beschreibt alle Bausteine.
- Modell: stärkste Stufe — öffentliche API (`clear()`, `size`, `readonly visibilityArea`), ein Teilungsalgorithmus mit Terminierungsbedingung und ein mechanischer, aber modulübergreifender Umzug von rund 25 Prüfstellen samt ihrer Specs; der Guide braucht Szenarien in `ts check`-Blöcken.
- Effort: high — öffentliche API und Meldungen in sechs Modulen; ein Teil der mitzuziehenden Specs zeigt erst der Testlauf.
- Dateien:
  - neu `packages/twopoint5d/src/utils/assertFiniteAtLeast.ts`, `assertWholeNumber.ts`, `assertWholeNumberOrInfinity.ts` (+ je eine `.spec.ts`)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` (+ `ChunkQuadTreeNode.extended.spec.ts`)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts` (+ `DataIdsChunk2D.spec.ts`)
  - `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts` (+ `.spec.ts`), `RectangularVisibilityAreaHelpers.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` (nur die drei Setter), `CameraBasedVisibilityHelpers.ts` (nur `maxDebugHelpers`), `RepeatingTilesProvider.ts` (+ die Specs, die deren Meldungen prüfen)
  - Prüfstellen aus Schritt 4 in `src/stage/`, `src/texture/`, `src/text/BitmapFont.ts`, `src/display/FrameLoop.ts`, `src/vertex-objects/` (+ die Specs, die deren Meldungen prüfen)
  - `packages/twopoint5d/docs/map2d.md`, `AGENTS.md` (Regel »Error and warning messages«), `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci` (zwischendurch genügt `pnpm nx test twopoint5d -- src/map2d` bzw. `-- src/utils` usw.; für den Guide `pnpm typecheck`; nie zwei Läufe parallel im selben Checkout)
- Commit: `fix(twopoint5d)!: split a quad tree node along the one axis that separates its chunks, read a data id at a fractional point, clear a spatial hash grid, check bounded numbers through shared helpers and describe the spatial indexes in the map guide`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · `src/map2d/` seit d9b648bf nur in `TileSprites/TileSpritesMaterial.spec.ts` berührt, `docs/map2d.md` unberührt · PERF-001 unverändert (`ChunkQuadTreeNode.ts:245`, TSDoc `:223-234`) · IMPL-001 unverändert (Teile-Tabelle `docs/map2d.md:8-18` ohne Quad-Tree, Daten-Chunks, Hash Grid, `AABB2`) · PERF-002 unverändert (`RectangularVisibilityArea.ts:259-265`) · CONS-004 unverändert an allen sechs Fundstellen (`CameraBasedVisibility.ts:232`, `:266`, `:318`, `RectangularVisibilityArea.ts:146`, `Map2DSpatialHashGrid.ts:104`, `CameraBasedVisibilityHelpers.ts:74`), dazu weitere Stellen derselben Ursache in map2d und fünf Modulen (Schritt 4) · CONS-013 unverändert (`RectangularVisibilityAreaHelpers.ts:9`) · API-006 unverändert (`Map2DSpatialHashGrid.ts:60-73`, kein `clear()`/`size`) · BUG-028 unverändert (`DataIdsChunk2D.ts:91-99`/`:107-109`) · READ-005 unverändert (`CameraBasedVisibility.ts`, 1310 Zeilen), geteilt nach Paket 11b · keine offene Folge im Plan; kein Eintrag in »Offene Befunde« teilt eine Ursache dieses Pakets
  - 2026-11-01 Zug 1: Implementierer beauftragt (Runde 0), `opus`, Effort high · Brief `paket-11.impl-0.brief.txt`, Report `paket-11.impl-0.json` im Arbeitsverzeichnis
  - 2026-11-01 Zug 2: Report FERTIG (Session 60412b6f-6326-4661-8268-0f6b135485d7, 99 Züge) · 45 Pfade geändert/neu (Liste `paket-11.files-r0.txt`), Arbeitsbaum schmutzig · rote Läufe für Schritte 1, 2, 3, 6, 7 im Report · eigener Verify läuft (`paket-11.verify.log`)
  - 2026-11-01 Zug 2: eigener Verify `pnpm run ci` exit=0 (`paket-11.verify.log`)
  - 2026-11-01 Zug 3: Reviewer beauftragt (`opus`, high), Diff `paket-11.diff` (3362 Zeilen, 45 Dateien), Report `paket-11.review-0.json`
  - 2026-11-01 Zug 3: Reviewer »freigegeben« — alle sieben Findings und Schritt 4 erfüllt, 6 × klein, nichts kritisch/wichtig; 257 Tests in 11 Spec-Dateien selbst grün gelaufen · Diff `paket-11.diff`
  - 2026-11-01 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-01 Zug 5: committet b91ab441 (45 Pfade, Trailer `Remediation-Run: 2026-10-31`), getragen vom Verify aus Zug 2 (`paket-11.verify.log`, exit=0; seither keine Codeänderung) · Plan auf `[x]`, vier Nebenbefunde in »Offene Befunde«, eine Folge (TileSet/DynamicAtlas) für den Zug 0 von 11b

## Entscheidungen des Zug 0 (mit Grund)

1. **READ-005 wird nach Paket 11b geteilt.** Es ist ein reiner Refactor des größten Hot-Path-Moduls ohne Verhaltensänderung; als eigener `refactor:`-Commit lässt er sich an unveränderten Specs und Allokationsspecs nachprüfen. Zusammen mit den Verhaltensänderungen hier wäre der Diff nicht mehr daraufhin lesbar. Paket 11 behält seine Nummer (die Schleife führt das laufende Paket unter ihr), der abgeteilte Teil heißt 11b.
2. **PERF-001: die fehlende Achse liegt auf der Außenkante der Chunks, nicht bei `Infinity`.** Erste Option der Empfehlung (»die andere allein verwenden«), nicht das TSDoc einschränken. Eine endliche Kante hält `originX`/`originY` zeichenbar — die Lookbook-Demo `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts:98-110` zieht Linien über beide Origins —, und ein später per `appendChunk()` jenseits des Streifens angefügter Chunk bekommt einen eigenen Quadranten.
3. **PERF-002: nur `fill(0, 0, tilesLength)`, kein Verkleinern.** Ein Schrumpfen ab dem Vierfachen würde bei einer Fläche, die zwischen zwei Größen pendelt, bei jedem Wechsel neu allozieren; gehalten bleibt höchstens die größte je gedeckte Fläche in Bytes — unter dem Default `maxVisibleTiles` 10 000 also 10 KB, unbegrenzt nur, wer mit `Infinity` die Grenze selbst abgeschaltet hat. Ein Kommentar an der Stelle sagt das.
4. **CONS-004: drei Helfer, Wortlaut »of N or more«, bibliotheksweit für jede Grundform-Meldung.** Die Grundform ist `Subject: name must be a finite number …` bzw. `… a whole number …, got <Wert>` und sonst nichts. Der Wortlaut der Mehrheit der Library (`FrameLoop`, `TexturePackerJson`, `Canvas2DStage`, `AsepriteJson`, `TileSet`, `BitmapFont`, `StageRenderTargetPool`, `DynamicAtlas`, `TextureAtlas`, `RepeatingTilesProvider`, `Map2DTileCoordsUtil`) ist »of N or more«; die Abweichler (»of at least N«, »of 0 or above«, »above 0 or Infinity«, »a non-negative integer«, »0 or a finite number above 0«) gleichen sich an. Die Regel in `AGENTS.md` nennt danach alle fünf Helfer und gilt ohne Ausnahme für die Grundform. Ausgenommen bleiben Prüfungen auf dem Hot Path, die ein Kommentar begründet, und Meldungen, die mehr sagen als die Grundform (Liste in Schritt 4). Der Umzug außerhalb von `map2d/` ist dieselbe Ursache; ohne ihn widerspräche die erweiterte Regel dem Code daneben.
5. **CONS-013: `readonly`**, nicht »Austausch zusichern« — die Kamera-Variante schließt den Wechsel aus, und beide erfüllen `IMap2DVisibilitorHelpers`. Typänderung: CHANGELOG `Changed` mit Migration Guide, Commit mit `!`.
6. **API-006: `clear()` und `size`, kein `has()`** — so die Entscheidung vom 2026-10-31 im Plan.
7. **BUG-028: `Math.floor()` im lokalen Index, nicht in `readDataIdAt()`** — so beantworten `readDataIdAt()` und eine Unterklasse, die `readDataIdAtLocal()` direkt ruft, dieselbe Zelle, und ein Chunk mit gebrochenem `left`/`top` zählt seine Zellen von der eigenen Ecke aus, wie `containsDataAt()` es tut (Entscheidung vom 2026-10-31: floor, im TSDoc gesagt).
8. **Kein Browser-Test**: nichts davon rendert. Keine neue Testdatei unter `packages/twopoint5d-testing/`.

## Rahmen für den Implementierer

- Coverage-Schwellen in `packages/twopoint5d/vite.config.ts`: `src/map2d/**` 93/91/91/94, `src/utils/**` 88/89/83/87, `src/text/**` 98/98/98/98, `src/stage/**` 94/88/95/95, `src/texture/**` 92/85/93/94, `src/vertex-objects/**` 94/90/90/95, `src/display/**` 82/73/81/84 (statements/branches/functions/lines). Jeder neue Zweig braucht einen Test.
- Meldungen nach `AGENTS.md`, »Error and warning messages«: Subjekt vorn, ohne Klammern; ein abgelehnter Wert über `describeValue()`.
- Konventionen des Plans: keine Finding-IDs, kein Satz über den Vorzustand (»no longer«, »now«, »instead of«, »used to«) — in Code, Kommentaren, TSDoc, Guide, `AGENTS.md`, CHANGELOG, Migration Guide und Commit-Message.
- Für jede Verhaltensänderung zuerst der Regressionstest, rot sehen, dann beheben; der rote Lauf gehört in den Report (`pnpm nx test twopoint5d -- src/path/to/file.spec.ts`). Wo Schritt 1–7 »rot vor dem Fix« sagt, ist er Pflicht.
- CHANGELOG über den Skill `updating-changelog`, alle Einträge unter `## [Unreleased]`; die veröffentlichten Abschnitte (ab `## [0.24.0]`) bleiben unberührt, auch wo sie eine alte Meldung zitieren.
- Hot-Path-Regel aus `AGENTS.md`: kein Double über eine Aufrufgrenze auf einem Pfad, den ein Frame läuft; `pnpm test:allocations` muss grün bleiben. Keine der Änderungen hier darf eine Allokation auf einen solchen Pfad legen; die Setter, Konstruktoren und Parser in Schritt 4 sind keine Hot Paths, `TileSet#frameId()` und `RepeatingTilesProvider#getTileIdAt()`/`getTileIdsWithin()` bekommen dort ganze Zahlen (Smis) und konstante Strings.
- `CameraBasedVisibility.ts` außerhalb der drei Setter nicht anfassen: die Suche zieht Paket 11b um.

## Vorgehen

### Schritt 1 — Helfer in `src/utils/` (CONS-004, Grundlage für Schritt 4)

Drei Dateien nach dem Muster von `src/utils/assertFinite.ts` (je eine Funktion, TSDoc, `describeValue()` für den Wert), nicht in `src/utils/public-api.ts` (intern wie `assertFinite`):

```ts
/** Answers `value` if it is a finite number of `min` or more, and throws a `RangeError` naming subject, property and value otherwise. */
export function assertFiniteAtLeast(value: unknown, subject: string, name: string, min: number): number
// message: `${subject}: ${name} must be a finite number of ${min} or more, got ${describeValue(value)}`

/** Answers `value` if it is a whole number — of `min` or more, when `min` is given —, and throws a `RangeError` otherwise. */
export function assertWholeNumber(value: unknown, subject: string, name: string, min?: number): number
// without min: `${subject}: ${name} must be a whole number, got ${describeValue(value)}`
// with min:    `${subject}: ${name} must be a whole number of ${min} or more, got ${describeValue(value)}`

/** Answers `value` if it is a whole number of `min` or more or `Infinity` — a limit that `Infinity` turns off —, and throws a `RangeError` otherwise. */
export function assertWholeNumberOrInfinity(value: unknown, subject: string, name: string, min: number): number
// message: `${subject}: ${name} must be a whole number of ${min} or more, or Infinity, got ${describeValue(value)}`
```

- Prüfung: `typeof value === 'number'` und dann `Number.isFinite(value) && value >= min` bzw. `Number.isInteger(value) && value >= min` bzw. zusätzlich `value === Infinity`. `-0` besteht `min` 0.
- Specs `assertFiniteAtLeast.spec.ts`, `assertWholeNumber.spec.ts`, `assertWholeNumberOrInfinity.spec.ts`: der Wert kommt zurück (an der Grenze `min`, darüber, `-0` bei `min` 0, `Infinity` nur beim dritten); `RangeError` mit der exakten Meldung für einen Wert unter `min`, einen Bruch (nur Ganzzahl-Helfer), `NaN`, `-Infinity`, `Infinity` (erste zwei), `'1'`, `null`, `undefined`; `assertWholeNumber` ohne `min` nimmt `-3` und lehnt `1.5` ab.

### Schritt 2 — PERF-001: `ChunkQuadTreeNode#subdivide()` teilt auch entlang einer einzigen Achse

`packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`

1. Regressionstest zuerst, in `ChunkQuadTreeNode.extended.spec.ts` im `describe('subdivide()')`, rot vor dem Fix:
   - **Zeile:** fünf `StringDataChunk2D` 64 × 64 bei `y = 0`, `x = i * 64` (i = 0…4). Nach `subdivide()`: `isLeaf` `false`, `originX` `128` (die Wertung von `findAxis()` nimmt bei Gleichstand den ersten Schnitt), `originY` `64`, `nodes.southWest` und `nodes.southEast` `null`; `findChunksAt(cx, 32)` findet für die Mitte `cx` jedes Chunks genau diesen; `findChunks(new AABB2(64, 0, 128, 64))` liefert genau die Chunks bei `x = 64` und `x = 128`; die Menge aller Chunks im Baum (über `chunks` und `nodes` gesammelt, wie der Helfer `collect` der Datei) ist wieder alle fünf.
   - **Spalte:** dasselbe gedreht (`x = 0`, `y = i * 64`): `originX` `64`, `nodes.northEast` und `nodes.southEast` `null`, Abfragen wie oben.
   - **Anfügen jenseits des Streifens:** nach der Zeile legt `appendChunk()` eines Chunks bei `(0, 128)` 64 × 64 ihn in `nodes.southWest` (`right` 64 ≤ `originX` 128, `top` 128 ≥ `originY` 64); `findChunksAt(32, 160)` findet ihn.
   - Der bestehende Fall `does nothing when no axis is splittable` (`:144`, vier identische Chunks) bleibt unverändert grün.
2. Fix in `subdivide()` (`:242-251`): fehlt genau eine der beiden Achsen, nimmt die fehlende als Origin die Außenkante der Chunks — für die x-Achse den größten `right`, für die y-Achse den größten `bottom` aller `chunks` des Knotens. Damit liegt jeder Chunk vor ihr (`right <= originX` → West, `bottom <= originY` → Nord), die Verteilung in `:265-279` und `appendChunk()` bleiben wie sie sind, und es entstehen zwei Quadranten statt vier. Fehlen beide Achsen, bleibt es beim `return`.
   - Die Kante als modul-lokale Funktion neben `findAxis()`: `const farEdge = (chunks: IDataChunk2D[], key: 'right' | 'bottom'): number`, über eine Schleife mit `>` ab `-Infinity` (überspringt `NaN`). Findet sie keinen vergleichbaren Wert (`-Infinity`), bleibt der Knoten ein Blatt.
   - Terminierung: eine Achse, die `scoreAxis()` nicht verwirft, hat mindestens zwei nichtleere Gruppen unter `before`/`intersect`/`after`; die Verteilung stimmt mit der Zählung überein (Kommentar `:261-264`), also bekommt jedes Kind weniger Chunks als der Knoten. Ein Satz dazu als Kommentar an der neuen Stelle.
3. TSDoc nachziehen: `subdivide()` (`:223-234`) — teilt, solange ein Knoten mehr als `maxChunkNodes` Chunks hält und eine Achse sie trennt; trennt nur eine (die Chunks einer Zeile oder einer Spalte), liegt die andere Origin auf der Außenkante der Chunks — dem `right` bzw. `bottom`, das am weitesten draußen liegt —, jeder Chunk liegt vor ihr, und der Knoten zerfällt in zwei Quadranten: West und Ost, oder Nord und Süd. Getter `originX`/`originY` (`:153-167`) und der Feldkommentar `:136-138` sagen dasselbe in einem Halbsatz.
4. CHANGELOG `Fixed`: `ChunkQuadTreeNode#subdivide()` teilt einen Knoten, dessen Chunks nur eine Achse trennt — eine Zeile oder Spalte von Chunks —, in zwei Quadranten, und `findChunks()`/`findChunksAt()` steigen in diese ab. (Den Satz im Präsens schreiben, ohne »no longer«.)

### Schritt 3 — BUG-028: `DataIdsChunk2D#readDataIdAt()` für gebrochene Koordinaten

`packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts`

1. Regressionstest zuerst, in `DataIdsChunk2D.spec.ts`, rot vor dem Fix: ein Chunk 2 × 2 bei `(0, 0)` mit `uint32Arr` `[1, 2, 3, 4]` — `readDataIdAt(0.5, 0.5)` → `1`, `readDataIdAt(1.999, 0)` → `2`, `readDataIdAt(0, 1.5)` → `3`; ein Chunk 2 × 2 bei `(10, 20)`: `readDataIdAt(10.5, 21.25)` → `3`; ein Chunk 2 × 2 bei `(-2, -2)`: `readDataIdAt(-0.5, -0.5)` → `4`; ein Chunk bei `(0.5, 0.5)`: `readDataIdAt(1.2, 0.5)` → `1` (Zelle von der Ecke des Chunks aus gezählt); für jeden Punkt, für den `containsDataAt()` `true` sagt, ist die Antwort definiert. `readDataIdAt(-0.5, 0)`, `readDataIdAt(2, 0)` und `readDataIdAt(NaN, 0)` → `undefined`.
2. Fix in `readDataIdAtLocal()` (`:91-99`): `const col = Math.floor(x); const row = Math.floor(y);`, die Bereichsprüfung und der Index über `col`/`row`. Der Kommentar `:94-96` bleibt sinngemäß.
3. TSDoc von `readDataIdAt()` (`:101-106`): `x` und `y` sind Kartenkoordinaten; ein gebrochener Wert zählt zur Zelle, in der er liegt — `Math.floor()` von der Ecke des Chunks aus, wie `containsDataAt()` ihn zählt —, und `undefined` heißt: außerhalb des Chunks (oder keine Zahl).
4. CHANGELOG `Fixed`: `DataIdsChunk2D#readDataIdAt()` antwortet für einen gebrochenen Punkt im Chunk die Id der Zelle, in der er liegt.

### Schritt 4 — CONS-004: Grenzwertprüfungen über die Helfer

Jede Stelle ruft den Helfer und übernimmt seinen Rückgabewert; eine modul-lokale Hilfsfunktion, die danach nichts mehr tut, entfällt samt ungenutzter Imports. Ein Kommentar, der sagt, *warum* die Grenze so liegt, bleibt an der Aufrufstelle stehen. Das TSDoc der Setter bleibt, wo es weiterhin wahr ist (»a whole number above 0 or `Infinity`« ist dasselbe wie »of 1 or more«); wo ein TSDoc oder Kommentar die Meldung wörtlich zitiert (`StageDirector.ts:425`), zieht es mit.

**a) `src/map2d/` — die sechs Fundstellen und die übrigen Grundform-Prüfungen des Moduls**

| Stelle | wird | Meldung danach |
| --- | --- | --- |
| `CameraBasedVisibility.ts:231-238` `frustumBoxScale` | `assertFiniteAtLeast(value, 'CameraBasedVisibility', 'frustumBoxScale', 1)` | `… must be a finite number of 1 or more, got …` |
| `CameraBasedVisibility.ts:265-272` `maxVisibleTiles` | `assertWholeNumberOrInfinity(value, 'CameraBasedVisibility', 'maxVisibleTiles', 1)` | `… must be a whole number of 1 or more, or Infinity, got …` |
| `CameraBasedVisibility.ts:317-322` `depth` | `assertFiniteAtLeast(value, 'CameraBasedVisibility', 'depth', 0)` | `… finite number of 0 or more …` |
| `RectangularVisibilityArea.ts:145-155` `maxVisibleTiles` | `assertWholeNumberOrInfinity(value, 'RectangularVisibilityArea', 'maxVisibleTiles', 1)` | wie oben |
| `RectangularVisibilityArea.ts:13-18` `assertAreaSize()` (Aufrufe `:104`, `:124`) | `assertFiniteAtLeast(width, 'RectangularVisibilityArea', 'width', 0)` bzw. `'height'`; Kommentar »0 is the off switch of an area …« an die Setter | `… must be a finite number of 0 or more, got …` |
| `RectangularVisibilityAreaHelpers.ts:40-47` `viewRectHelperHeight` | `assertFiniteAtLeast(value, 'RectangularVisibilityAreaHelpers', 'viewRectHelperHeight', 0)` | unverändert |
| `CameraBasedVisibilityHelpers.ts:73-80` `maxDebugHelpers` | `assertWholeNumberOrInfinity(value, 'CameraBasedVisibilityHelpers', 'maxDebugHelpers', 0)` | unverändert |
| `Map2DSpatialHashGrid.ts:103-110` `maxCellsPerRenderable` | `assertWholeNumberOrInfinity(value, 'Map2DSpatialHashGrid', 'maxCellsPerRenderable', 1)` | `… whole number of 1 or more, or Infinity …` |
| `RepeatingTilesProvider.ts:15-25` lokales `assertWholeNumber()` (Aufrufe `:123-124`, `:185-188`) | der zentrale `assertWholeNumber()` mit denselben Argumenten | unverändert |

Bleiben in map2d: `CameraBasedVisibility.ts:623-629` und `RectangularVisibilityArea.ts:184-190` (Mittelpunkt, Hot Path, begründet), `Map2DTileCoordsUtil.ts:229-243`/`:273ff.` samt `#refuseSelection()` `:331-342` (Hot Path, die kalte Meldung hat schon die Grundform), `Map2DSpatialHashGrid.ts:37-43` `assertFiniteAABB()` und `:240-244` (`getTiles()`; vier bzw. zwei Werte in einer Meldung), `RepeatingTilesProvider.ts:89-92` (Obergrenze und Position im Muster), `DataIdsChunk2D.ts:61-63` (Längenprüfung).

**b) außerhalb von `map2d/`, Meldung bleibt wörtlich gleich (modul-lokale Kopien)**

- `src/stage/StageRenderTargetPool.ts:4-12` `assertWholeNumber()` → zentral `assertWholeNumber(width, 'StageRenderTargetPool#acquire()', 'width', 1)` usw. an `:78-80`; der Kommentar `:4-5` an die Aufrufe.
- `src/texture/TextureAtlas.ts:7-12` `assertCount()` → `assertWholeNumber(count, 'TextureAtlas#randomFrameIds()', 'count', 0)` usw. an `:186`, `:201`, `:216`.
- `src/texture/DynamicAtlas.ts:102-109` `isWhole()`/`assertWhole()` → `assertWholeNumber(value, WHERE, \`the ${what}\`, min)` an `:199-209`.
- `src/stage/Canvas2DStage.ts:40-46` `assertCanvasSide()` → `assertFiniteAtLeast(value, subject, name, 1)` an seinen Aufrufen.
- `src/display/FrameLoop.ts:21-26` `checkMaxFps()` → `assertFiniteAtLeast(maxFps, subject, 'maxFps', 0)` an seinen Aufrufen.

**c) außerhalb von `map2d/`, Meldung gleicht sich an**

- `src/stage/StageDirector.ts:425-430` `atOption()` → `if (at !== undefined) assertWholeNumber(at, subject, 'at', 0);` — »of 0 or above« wird »of 0 or more« (auch im TSDoc `:425`).
- `src/stage/StageDirector.ts:439-444` `nonNegative()` → `return assertFiniteAtLeast(value, subject, name, 0);` nach dem `undefined`-Zweig — »or above« wird »or more«, und `NaN` meldet »must be a finite number of 0 or more« statt der Meldung von `assertFinite()`.
- `src/stage/transitionEffects.ts:131-137` `softnessOf()` → `assertFiniteAtLeast(softness, subject, 'softness', 0)` nach dem `undefined`-Zweig (gilt für `wipe`, `matte` und jeden Effekt, der `softnessOf()` ruft).
- `src/vertex-objects/VertexObjectPool.ts:146-148` (`resize()`), `VertexObjectBuffer.ts:196-199` (Konstruktor, `name` bleibt `'capacity'` bzw. `'buffersData.capacity'`), `:413-416` (`copy()`), `:519-522` (`copyArray()`), `:587-590` (`copyAttributes()`), `VOBufferPool.ts:104-109` (Konstruktor, `capacityName`) → `assertWholeNumber(…, 0)` — »must be a non-negative integer« wird »must be a whole number of 0 or more«. Die zusammengesetzten Meldungen `copyWithin()` `:548ff.`, `toAttributeArrays()` `:642ff.`, `VOBufferPool#usedCount` `:142` und `VertexObjectDescriptor.ts:186` bleiben (Beziehung zwischen Werten bzw. `Infinity` erlaubt). Ein TSDoc dieser Methoden, das »non-negative integer« als Bedingung nennt, zieht mit.
- Zweischritt-Prüfungen (erst `assertFinite()`, dann die Untergrenze von Hand) → ein Aufruf `assertFiniteAtLeast(…, 0)`; für `NaN` meldet die Stelle damit die Grenze mit: `src/texture/TexturePackerJson.ts:153-159`, `src/texture/AsepriteJson.ts:208-215` (nur `w`/`h`; `x`/`y` bleiben bei `assertFinite()`), `src/text/BitmapFont.ts:249-255` (nur die Felder in `AT_LEAST_ZERO`, die übrigen bleiben bei `assertFinite()`).
- `src/texture/AsepriteJson.ts:250-255` (der `frame` eines Slice-Keys) → `assertWholeNumber(frame, 'AsepriteJson', \`the frame of the key ${k} of the slice "${name}"\`, 0)`, Meldung unverändert.
- `src/texture/TileSet.ts:294-296` (`margin`, `padding`, `spacing` über `assertOption`) → `assertFiniteAtLeast(…, 'TileSet', 'margin', 0)` usw.; `:305` (`firstId`) und `:227` (`tileId` in `frameId()`) → `assertWholeNumber(…, 'TileSet', 'firstId')` bzw. `'tileId'`, Meldungen unverändert. `assertOption()` bleibt für die Bereichsprüfung `:299-301`.

Bleiben außerhalb von `map2d/` (mehr als die Grundform, oder eine eigene Satzform, die ihre Nachbarmeldungen teilen): `StageDirector.ts:1748-1749` (Obergrenze), `AsepriteJson.ts:151-153` und `FrameBasedAnimations.ts:266`, `:533-556`, `FrameTable.ts:111`, `FrameBasedAnimations.ts:735` (Satzform »— a … is …«), `sampleAtlasFrame.ts:103-105` (Satzform »the inset … is …«, wie die `trim`-Meldung davor), `GridBase.ts`, `TableFrame.ts`, `PaletteSwap.ts`, `codePoints.ts`, `BitmapFont.ts:243`/`:279` (Bereiche), `FixedFrameLoop.ts:172` (still), Prädikate (`isTextureSize`, `isPowerOf2`, `AsepriteJson.ts:124`/`:433`). Nicht suchen gehen: die Liste oben ist abschließend.

**d) Specs und Doku mitziehen.** Jede Spec, die eine geänderte Meldung prüft, bekommt den neuen Wortlaut; bekannt sind `src/map2d/CameraBasedVisibility.spec.ts`, `RectangularVisibilityArea.spec.ts`, `Map2DSpatialHashGrid.spec.ts`, `src/stage/StageDirector.spec.ts` (`:122`, `:977`, `:1255`, `:1261`), `matte.spec.ts:99`, `transitionEffects.spec.ts:64`, `src/vertex-objects/VertexObjectBuffer.spec.ts`, `VertexObjectPool.spec.ts`, dazu `NaN`-Fälle in den Specs von `StageDirector`, `TexturePackerJson`, `AsepriteJson`, `BitmapFont` — der Testlauf zeigt den Rest.

**e) `AGENTS.md`**, Regel »Error and warning messages« (`:123-125`): ein Zahlencheck geht über die Helfer in `src/utils/` — `assertFinite()`, `assertPositiveFinite()`, `assertFiniteAtLeast()`, `assertWholeNumber()`, `assertWholeNumberOrInfinity()` —, die `Subject: name must be a finite number …` bzw. `… a whole number …, got …` schreiben, eine Untergrenze als `of 1 or more`, eine abschaltbare Grenze mit `, or Infinity`. Eine Prüfung, deren Meldung mehr sagt — eine Obergrenze, die Stelle des Werts in einer Liste, einen Hinweis hinter ihm —, schreibt ihre eigene in denselben Worten; eine auf dem Hot Path bleibt inline, mit einem Kommentar, der sagt warum. Wortlaut englisch, im Ton der Datei, ohne Rückblick.

**f) CHANGELOG `Changed`**, ein Eintrag: die `RangeError`-Meldungen für eine abgelehnte Zahl lauten in der ganzen Library gleich — `… must be a finite number of 0 or more`, `… a whole number of 1 or more`, `… a whole number of 1 or more, or Infinity`, je `, got …` —, mit den Klassen und Funktionen, deren Wortlaut sich ändert (`CameraBasedVisibility`, `RectangularVisibilityArea`, `Map2DSpatialHashGrid`, `StageDirector`, die Effekte mit `softness`, `VertexObjectPool`, `VertexObjectBuffer`, `VOBufferPool`, sowie die `NaN`-Meldung von `TexturePackerJson`, `AsepriteJson`, `BitmapFont`). Fehlerart und Bedingung bleiben; kein **BREAKING**.

### Schritt 5 — PERF-002: nur den gebrauchten Bereich nullen

`packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:259-265`

1. Test in `RectangularVisibilityArea.spec.ts` (Absicherung, kein Korrektheitsfehler, darf vor dem Fix grün sein): Raster 1 × 1, Fläche 10 × 10 um denselben Mittelpunkt (100 Kacheln), dann 2 × 2 (4 wiederverwendet, 96 entfernt), dann 6 × 6 (36 Kacheln: die 4 wiederverwendet, 32 erzeugt, keine doppelt) — prüft, dass nach dem Schrumpfen keine alte Belegung eine Erzeugung unterdrückt.
2. Fix: `tileCreated.fill(0, 0, tilesLength)`; das Feld wächst weiter nur, wenn es zu klein ist. Kommentar an der Stelle: die Kosten folgen der Fläche dieses Aufrufs; behalten wird das Feld der größten gedeckten Fläche, höchstens `maxVisibleTiles` Bytes, weil ein Verkleinern bei einer pendelnden Fläche jeden Wechsel neu allozierte.
3. CHANGELOG `Fixed`: eine Neuberechnung von `RectangularVisibilityArea` kostet die Kacheln ihrer Fläche, gleich welche Fläche sie vorher gedeckt hat.

### Schritt 6 — CONS-013: `RectangularVisibilityAreaHelpers#visibilityArea` ist `readonly`

`packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:9`, `:26-28`

1. Typtest zuerst, in `RectangularVisibilityAreaHelpers.spec.ts` neben `:150`: `// @ts-expect-error — the area is fixed with the helper` vor `helpers.visibilityArea = new RectangularVisibilityArea();` in einem Zweig, der nicht läuft (oder mit dem Laufzeitwert danach zurückgesetzt) — rot vor dem Fix als TS2578 im `pnpm typecheck`.
2. Fix: `readonly visibilityArea: RectangularVisibilityArea;` mit TSDoc: die Fläche, die dieser Helper zeichnet, im Konstruktor übergeben und für sein ganzes Leben fest; `update()` liest ihre `width` und `height` bei jedem Durchgang.
3. CHANGELOG `Changed` (wie der `StageItem`-Eintrag): `RectangularVisibilityAreaHelpers#visibilityArea` ist `readonly`, ein Schreiben kompiliert nicht; Migration Guide `#### \`RectangularVisibilityAreaHelpers#visibilityArea\` is read-only` mit **Before**/**After**: ein neuer Helper für eine andere Fläche (den alten mit `dispose()` abbauen).

### Schritt 7 — API-006: `Map2DSpatialHashGrid#clear()` und `size`

`packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts`

1. Specs zuerst, in `Map2DSpatialHashGrid.spec.ts` (neues `describe('clear() and size')`): `size` ist 0 für ein neues Grid; zählt ein Renderable einmal, auch über mehrere Zellen und nach einem zweiten `add()` desselben; sinkt mit `remove()`, bleibt bei `remove()` eines unbekannten. `clear()`: `size` 0; `getTile()` jeder vorher belegten Zelle `undefined`; `findWithin(aabb)` `undefined` und `findWithin(aabb, out)` ein leeres `out`; `getTiles()` ebenso; ein vorher von `getTile()` ausgegebenes Set ist leer; `remove()` eines Renderables von vorher wird übergangen; ein `add()` danach legt es neu in seine Zellen, und Abfragen finden es; `clear()` auf einem leeren Grid tut nichts; `maxCellsPerRenderable` bleibt.
2. `get size(): number` — `this.#placements.size`. TSDoc: wie viele Renderables das Grid hält, jedes einmal gezählt, in wie vielen Zellen es auch liegt.
3. `clear(): void` — für jede Zelle in `#occupied`: `cell.renderables.clear()` und `this.#cells.remove(cell)`; dann `truncateArray(this.#occupied)` und `this.#placements.clear()`. `#queryStamp` und `#maxCellsPerRenderable` bleiben. TSDoc: nimmt jedes Renderable aus jeder Zelle und lässt das Grid leer, wie ein neues mit derselben Rasterung und demselben `maxCellsPerRenderable` — für einen Kartenwechsel oder ein Level-Reset; das Grid hält seine Renderables bis dahin fest. Eine Zelle verlässt das Grid mit geleertem Set, wie bei `remove()`.
4. TSDoc von `getTile()` (`:253-260`): »Only {@link add}, {@link remove} and {@link clear} change it«, und eine Kopie hält, wer die Antwort über das nächste `add()`, `remove()` oder `clear()` hinaus behält.
5. CHANGELOG `Added`: `Map2DSpatialHashGrid#clear()` und `Map2DSpatialHashGrid#size`.

### Schritt 8 — IMPL-001: der Guide `docs/map2d.md` beschreibt die räumlichen Indizes

Nach der Guide-Konvention des Repos: Szenario zuerst, dann Cheat Sheet, dann Referenz (das TSDoc); Code als `ts check`-Blöcke, die für sich stehen (alles importieren, alles deklarieren). Für Nutzer geschrieben, ohne Interna und ohne Historie (`AGENTS.md`, »Deeper docs«). Der Guide beschreibt den Stand nach Schritt 2, 3 und 7.

1. Einleitung `:3-6`: ein Satz, dass das Modul neben dem Streaming zwei räumliche Indizes für Daten einer Karte hält — einen Quad-Tree über Chunks und ein Hash Grid über Renderables.
2. Teile-Tabelle `:8-18`, vier Zeilen dazu: `ChunkQuadTreeNode` (ein Quad-Tree über Chunks einer Karte: einmal `subdivide()` nach dem Füllen, `findChunks()`/`findChunksAt()` je Abfrage); `DataIdsChunk2D`, `NumberDataChunk2D`, `StringDataChunk2D`, `DataChunk2D` (ein Rechteck der Karte mit seinen Daten: Tile-Ids aus einem `Uint32Array` oder base64, eine Zahl, ein String, nichts); `Map2DSpatialHashGrid` (ein räumlicher Index von Renderables über ein Zellraster: `add()`, `findWithin()`, `remove()`, `clear()`); `AABB2` (das Rechteck, das alle nehmen: `left`, `top`, `width`, `height`).
3. Neuer Abschnitt nach »A map in a rectangle«, `## Chunks of a map, found by a quad tree`: Szenario — die Chunks einer unendlichen Tiled-Ebene (`{x, y, width, height, data}`, base64, unkomprimiert) werden zu `DataIdsChunk2D`, in einen `ChunkQuadTreeNode`, einmal `subdivide()`; je Frame `findChunks(view, out)` mit einem gehaltenen `AABB2` und Array; die Id an einem Punkt über `findChunksAt(x, y, out)` und `readDataIdAt(x, y)`. Danach in Prosa: base64 wird beim ersten Lesen dekodiert; ein String, der nicht `width × height` Ids hält, wirft dann einen `RangeError`, Daten mit `compression` einen `Error`; `readDataIdAt()` antwortet `undefined` außerhalb des Chunks und für einen gebrochenen Punkt die Id der Zelle, in der er liegt; ein später kommender Chunk über `appendChunk()` und danach `subdivide()` an der Wurzel; `subdivide(maxChunkNodes)` (Default 2) lässt bis zu so viele Chunks in einem Blatt und teilt auch eine Zeile oder Spalte von Chunks; `clear()` leert den Baum.
4. Neuer Abschnitt danach, `## Renderables in a spatial hash grid`: Szenario — Objekte mit `aabb` (`IMap2DRenderableArea`) in ein `new Map2DSpatialHashGrid(tileWidth, tileHeight, xOffset, yOffset)`, je Frame `findWithin(view, out)`; ein bewegtes Objekt kommt mit einem zweiten `add()` in seine neuen Zellen; `remove()`; beim Level-Wechsel `clear()`, `size` zählt. Prosa: das Grid merkt sich die Zellen beim `add()`, ein geändertes `aabb` lässt das Objekt liegen, bis es wieder hinzugefügt wird; `maxCellsPerRenderable` (65 536, `Infinity` schaltet ab) — ein `aabb` über mehr Zellen wirft beim `add()` einen `RangeError`, dann größere Zellen oder die Grenze heben; eine Abfrage kostet die Zellen ihres Rechtecks oder die belegten Zellen, was weniger ist; die Reihenfolge ist nicht festgelegt; `getTile()` gibt das Set der Zelle selbst heraus, eine Kopie hält, wer es über das nächste `add()`, `remove()` oder `clear()` hinaus braucht.
5. Tabelle »Defaults and how they play together« (`:127-138`): Zeilen für `ChunkQuadTreeNode#subdivide()` `maxChunkNodes` (`2`), `Map2DSpatialHashGrid` Zellgröße und Offset (`1 × 1`, `(0, 0)`) und `Map2DSpatialHashGrid#maxCellsPerRenderable` (`65 536`), je mit dem Zusammenspiel in einem Satz.
6. »Who disposes what« (`:210-233`): ein Satz — Quad-Tree und Hash Grid halten, was sie bekommen, und geben nichts frei; ihr `clear()` lässt alles los.
7. Neue Blöcke vor dem Gate einzeln prüfen: `node ../../scripts/checkDocSnippets.mjs ../twopoint5d/docs/map2d.md` aus `packages/twopoint5d-testing` (die Datei ist getrackt, `pnpm typecheck` prüft sie ohnehin).

## Findings im Volltext

**PERF-001 · low · packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:245** (auch `:224`) — Chunk-Quad-Tree auch mit nur einer trennenden Achse aufteilen
`subdivide()` bricht mit `if (!xAxis || !yAxis) return;` ab, sobald eine der beiden Achsen keinen Schnitt findet. Liegen alle Chunks einer Ebene in einer Zeile (z. B. fünf Chunks 64x64 bei y=0, x = i*64) oder in einer Spalte, liefert `scoreAxis()` für die andere Achse `null` (alle Chunks sind `before`, `intersect` und `after` sind 0). Der Knoten bleibt dann ein Blatt mit allen Chunks, und `findChunks()`/`findChunksAt()` prüfen linear jeden Chunk. Das TSDoc von `subdivide()` verspricht aber, es werde geteilt, solange »an axis separates them«. Die Specs decken nur den Fall ab, dass gar keine Achse taugt (`ChunkQuadTreeNode.extended.spec.ts:144`), nicht den Streifen. Betroffen sind horizontale Side-Scroller-Karten oder tiefe Teilbäume mit nur einer Ausdehnungsrichtung.
Beleg: `const xAxis = findAxis(chunks, 'right', 'left'); const yAxis = findAxis(chunks, 'bottom', 'top'); if (!xAxis || !yAxis) return;`
Empfehlung: Fehlt eine Achse, die andere allein verwenden (die fehlende Achse als Ursprung außerhalb aller Chunks setzen, sodass zwei statt vier Quadranten entstehen), oder das TSDoc ehrlich auf »beide Achsen müssen trennen« ändern. Einen Spec für einen Chunk-Streifen ergänzen.

**IMPL-001 · low · packages/twopoint5d/docs/map2d.md:7** — Spatial Hash Grid, Chunk-Quad-Tree und Daten-Chunks im Map-Guide beschreiben
Der Guide `map2d.md` führt in seiner Teile-Tabelle nur Streamer, Visibilitoren, Renderer, Factory und Provider auf. `Map2DSpatialHashGrid`, `ChunkQuadTreeNode`, `DataChunk2D`/`DataIdsChunk2D` (inklusive base64-Daten) und `AABB2` sind öffentlich exportiert und ausführlich im TSDoc beschrieben, kommen aber in keinem Guide-Abschnitt vor; ein Treffer außerhalb des Changelogs findet sich nur in `docs/architecture.md`. Nach der Projektregel, Doku mit jedem Feature mitwachsen zu lassen, fehlt hier ein Szenario (z. B. »Chunks einer Tiled-Karte laden und per Quad-Tree abfragen«).
Empfehlung: Abschnitt im Guide ergänzen: Szenario zuerst (Chunks erzeugen, Baum bauen, `findChunks()` pro Frame mit `out`-Array), dann Cheat Sheet, dann Referenz; den Spatial Hash Grid mit Hinweis auf `maxCellsPerRenderable` aufnehmen.

**PERF-002 · low · packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:259** — Belegungsfeld der Rechteck-Sichtbarkeit nur im benötigten Bereich nullen
`#tileCreated` wird nur vergrößert, nie verkleinert, und bei jeder Neuberechnung mit `tileCreated.fill(0)` vollständig genullt. Schrumpft die Fläche nach einer großen (bis `maxVisibleTiles`, bei `Infinity` unbegrenzt), kostet jede Neuberechnung weiter O(größte jemals gesehene Fläche) statt O(aktuelle Kachelzahl), und der Speicher bleibt belegt.
Beleg: `if (tileCreated == null || tileCreated.length < tilesLength) { ... } else { tileCreated.fill(0); }`
Empfehlung: `tileCreated.fill(0, 0, tilesLength)` verwenden; optional das Feld neu anlegen, wenn es mehr als etwa das Vierfache des Bedarfs groß ist.

**CONS-004 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:266** (auch `RectangularVisibilityArea.ts:146`, `Map2DSpatialHashGrid.ts:104`, `CameraBasedVisibilityHelpers.ts:74`, `CameraBasedVisibility.ts:232`, `CameraBasedVisibility.ts:318`) — Wiederkehrende Grenzwert-Prüfung »ganze Zahl über 0 oder Infinity« zentralisieren
Dieselbe Bedingung `!(Number.isInteger(value) && value >= 1) && value !== Infinity` mit nahezu gleichlautender Meldung steht in drei Klassen (`maxVisibleTiles`, `maxCellsPerRenderable`) plus Varianten für `>= 0` und `>= 1` mit Mindestwert. Die Projektregel schreibt für Zahlenprüfungen `assertFinite()`/`assertPositiveFinite()` aus `src/utils/` vor; für Ganzzahl-oder-Infinity und »endlich mit Untergrenze« gibt es keinen Helfer, also wird jeweils von Hand geprüft und formuliert. Eine Meldung kann so auseinanderlaufen.
Empfehlung: Helfer in `src/utils/` (z. B. `assertWholeNumberOrInfinity(value, subject, name)` und `assertFiniteAtLeast()`) anlegen und die Setter darauf umstellen; Inline-Prüfungen nur dort belassen, wo der Hot-Path-Kommentar sie begründet.

**CONS-013 · low · packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:9** (auch `CameraBasedVisibilityHelpers.ts:173`) — Sichtbarkeits-Bezug der Helper-Klassen einheitlich als readonly führen
`CameraBasedVisibilityHelpers` hält die Sichtbarkeit als `public readonly cameraBasedVisibility`, `RectangularVisibilityAreaHelpers` als beschreibbares `visibilityArea: RectangularVisibilityArea`. Wird dort die Fläche ausgetauscht, liest `update()` ab dann eine andere Fläche, ohne dass der Helper sie bemerkt oder dokumentiert; in der Kamera-Variante ist derselbe Wechsel ausgeschlossen. Die beiden Klassen erfüllen dasselbe Interface `IMap2DVisibilitorHelpers` und sollten sich gleich verhalten.
Empfehlung: `visibilityArea` ebenfalls `readonly` machen (Konstruktor-Parameter-Property oder `readonly`-Feld) und das im Changelog als Typänderung vermerken, oder das Austauschen in TSDoc und Spec ausdrücklich zusichern.

**API-006 · info · packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:70** — Map2DSpatialHashGrid um clear() ergänzen
Der Grid hält jedes eingefügte Renderable über `#placements` stark und bietet nur `add()`/`remove(...renderables)`. Um ihn zu leeren (Kartenwechsel, Level-Reset), muss der Aufrufer jedes Renderable selbst kennen und entfernen; ohne Aufräumen bleiben alle Renderables samt Zellen-Sets erreichbar, solange das Grid lebt. Es gibt auch kein `has()`/`size`.
Empfehlung: `clear()` (Zellen, `#occupied`, `#placements` leeren) und `size` ergänzen, TSDoc und Spec dazu.

**BUG-028 · info · packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts:97** (auch `:108`) — readDataIdAt für gebrochene Koordinaten festlegen
`containsDataAt(0.5, 0.5)` (halboffenes Inneres der AABB2) ist `true`, aber `readDataIdAt(0.5, 0.5)` indexiert `uint32Arr[0.5]` und antwortet `undefined`, weil `readDataIdAtLocal` nur Bereichsgrenzen, nicht die Ganzzahligkeit prüft. Das TSDoc sagt nur, `undefined` bedeute »außerhalb dieses Chunks«; ein Punkt innerhalb bekommt dieselbe Antwort.
Empfehlung: Entweder mit `Math.floor()` auf die Zelle abbilden oder im TSDoc festhalten, dass `x`/`y` ganze Tile-Koordinaten sind und alles andere `undefined` ergibt.

**READ-005 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:204** — nicht in diesem Paket, nach Paket 11b geteilt (siehe Entscheidung 1); der Volltext gehört in `paket-11b.md`, die dessen Zug 0 anlegt.

## Urteil des Reviewers (Zug 3, `paket-11.review-0.json`)

- **PERF-001** — behoben: `ChunkQuadTreeNode.ts:263` bricht nur ab, wenn beide Achsen fehlen; `:269-270` legt die fehlende über `farEdge()` (`:97`) auf die Außenkante; ohne vergleichbare Kante bleibt der Knoten ein Blatt (`:271`). TSDoc von `subdivide()`, `originX`/`originY` und Feldkommentar nachgezogen. Specs `ChunkQuadTreeNode.extended.spec.ts:277ff.`. Terminierung geprüft: jedes Kind hält echt weniger Chunks (Chunks mit `NaN`-Kante bleiben als Straddler am Knoten).
- **IMPL-001** — behoben: `docs/map2d.md:3-6` Einleitung, Teile-Tabelle +4 Zeilen, `:129` »Chunks of a map, found by a quad tree«, `:181` »Renderables in a spatial hash grid« (je `ts check`), Defaults `:255-257`, »Who disposes what« `:351-352`.
- **PERF-002** — behoben: `RectangularVisibilityArea.ts:259` `fill(0, 0, tilesLength)`, Kommentar `:250-252`, Absicherung `RectangularVisibilityArea.spec.ts:271`.
- **CONS-004** — behoben samt aller »Dazu«-Stellen aus Schritt 4: Helfer `src/utils/assertFiniteAtLeast.ts`, `assertWholeNumber.ts`, `assertWholeNumberOrInfinity.ts` (+ Specs); map2d `CameraBasedVisibility.ts:234/263/310`, `RectangularVisibilityArea.ts:99/120/142`, `RectangularVisibilityAreaHelpers.ts:45`, `CameraBasedVisibilityHelpers.ts:74`, `Map2DSpatialHashGrid.ts:105`, `RepeatingTilesProvider.ts:113-114/176-179`; b) `StageRenderTargetPool.ts:70-72`, `TextureAtlas.ts:180/195/210`, `DynamicAtlas.ts:190-200`, `Canvas2DStage.ts:190-191/307-308`, `FrameLoop.ts:314/328`; c) `StageDirector.ts:428/440` (TSDoc mit), `transitionEffects.ts:133`, `VertexObjectPool.ts:146`, `VertexObjectBuffer.ts:197/414/516/580`, `VOBufferPool.ts:107`, `TexturePackerJson.ts:154`, `AsepriteJson.ts:211/247`, `BitmapFont.ts:251`, `TileSet.ts:229/296-298/307`; `AGENTS.md:123ff.`; CHANGELOG `Changed` `:60`. Keine verwaiste alte Meldung in `src/` und `docs/`.
- **CONS-013** — behoben: `RectangularVisibilityAreaHelpers.ts:13` `readonly` mit TSDoc; Typtest `RectangularVisibilityAreaHelpers.spec.ts:155` (im Typecheck, `tsconfig.typecheck.json` nimmt Specs mit); CHANGELOG `:61` **BREAKING**, Migration Guide `:224`.
- **API-006** — behoben: `Map2DSpatialHashGrid.ts:174` `size`, `:184` `clear()`, TSDoc `getTile()` nachgezogen; Specs `Map2DSpatialHashGrid.spec.ts:300ff.`; CHANGELOG `Added` `:38`.
- **BUG-028** — behoben: `DataIdsChunk2D.ts:95-101` `Math.floor` im lokalen Index, `NaN` fällt durch die negierte Bereichsprüfung heraus; TSDoc nachgezogen; Specs `DataIdsChunk2D.spec.ts:147ff.` samt Kreuzprobe gegen `containsDataAt()`.
- Ohne Befund geprüft: Konventionen (keine IDs, kein Rückblick), Hot Paths (keine neue Allokation, `test:allocations` grün), Aufrufer und Meldungen.

### Kleine Befunde (keine Runde)

1. `packages/twopoint5d/CHANGELOG.md:60` — »for `NaN` or a value that is no number« unterschlägt `±Infinity`; bei `TexturePackerJson`, `AsepriteJson`, `BitmapFont` ändert sich die Meldung auch für `Infinity` (`AsepriteJson.spec.ts:628`, `TexturePackerJson.spec.ts:222`).
2. `packages/twopoint5d/docs/map2d.md:255` (»the most chunks a leaf keeps«) und `:177` (»leaves up to that many chunks in a leaf«) sagen zu viel zu: trennt keine Achse (deckungsgleiche oder überlappende Chunks), behält ein Blatt beliebig viele; das TSDoc von `subdivide()` sagt es richtig.
3. `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:252` — »at most `maxVisibleTiles` bytes« stimmt nicht mehr, wenn `maxVisibleTiles` nach einer großen Fläche gesenkt wird; genau wäre »die größte je gedeckte Fläche«.
4. `packages/twopoint5d/docs/map2d.md:352` — Prosazeile mit 115 Zeichen, nicht umbrochen (Datei sonst ~100).
5. `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts:147` — Leerzeile vor dem neuen `describe` fehlt.
6. Commit-Message — das `!` nennt nicht, was bricht (`readonly` an `RectangularVisibilityAreaHelpers#visibilityArea`); kein `BREAKING CHANGE:`-Footer. Die Message der Paketdatei blieb wörtlich, wie in den Vorgängerpaketen.
7. (vom Implementierer) TSDocs nennen die Bedingung »integer of 0 or more« statt »whole number«: `src/vertex-objects/VertexObjectPool.ts:139`, `VertexObjectBuffer.ts:168`, `:183`, `:401`, `:500`, `:575` — inhaltlich richtig, zitiert keine Meldung.

### Nebenbefunde — Begründung des Urteils

Alle vier an der Basis d9b648bf nachgesehen (`git show`), also vorbestehend; die Scope-Regel nimmt jede Severity, daher `→ Scope`. Keiner teilt die Ursache dieses Pakets (Helfer für Grundform-Meldungen): `ChunkQuadTreeNode.ts:108` ist ein TSDoc-Fehler über die Kinder; `VOBufferPool#usedCount` ist eine zusammengesetzte Prüfung, die Schritt 4c ausdrücklich ausnimmt, ihr Loch für Nicht-Zahlen ist ein eigener Fehler; `copy()` nennt den falschen Buffer; `AsepriteJson` ist ein Prototyp-Schreibfehler.

### Folge — Einordnung

`TileSet.ts:287-290` und `DynamicAtlas.ts:568-575` verstießen schon gegen die alte Regel (`assertFinite()`/`assertPositiveFinite()` für Zahlenchecks); die erweiterte Regel in `AGENTS.md` macht den Widerspruch aber erst wörtlich (»ohne Ausnahme für die Grundform«). Im Zweifel Folge — der Zug 0 von 11b entscheidet, ob er sie aufnimmt oder ein Nachtragspaket schneidet.
