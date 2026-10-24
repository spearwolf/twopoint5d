# Paket 9 — CameraBasedVisibility

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-013 (low), CONS-002 (low), API-010 (low), CONS-003 (low), READ-003 (low)
- Dazu: der Rest des Map2D-Teils von BUG-021 (low) aus Paket 8 — die Setter
  `Map2DTileCoordsUtil#xOffset`/`yOffset` —, und als Nebenbefund gleicher Ursache
  die Prüfung des `centerPoint` in `computeVisibleTiles()` beider Visibilitors
  (Queue-Eintrag `RectangularVisibilityArea.ts:180–181` aus Paket 8 und sein
  Gegenstück `CameraBasedVisibility.ts:683`)
- Ziel: `CameraBasedVisibility` ist in Heap, Slot-Pool und Suche aufgeteilt, mit
  klar typisierter `TileBox` und korrekter Abbruchmarge auch für gekippte Map-Nodes.
- Modell: stärkste Stufe
- Effort: high — Umbau über drei Module auf dem Frame-Pfad, an dem jede neue
  Aufrufgrenze ein gebrochenes Double boxen kann, dazu ein Bruch der öffentlichen
  Typen (`TileBox`)
- Hängt ab von: —
- Dateien:
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`, `CameraBasedVisibility.spec.ts`
  - neu `packages/twopoint5d/src/map2d/tileDistanceHeaps.ts` samt `tileDistanceHeaps.spec.ts`
  - neu `packages/twopoint5d/src/map2d/TileSlotPool.ts` samt `TileSlotPool.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`, `CameraBasedVisibilityHelpers.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.ts`, `Map2DTileCoordsUtil.spec.ts`
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts`, `RectangularVisibilityArea.spec.ts`
  - `packages/twopoint5d/src/map2d/packedTileKey.ts`
  - nur `private` → `#`: `packages/twopoint5d/src/map2d/TileSlotTable.ts`,
    `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts`,
    `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`,
    `packages/twopoint5d/src/stage/Canvas2DStage.ts`,
    `packages/twopoint5d/src/vertex-objects/VertexAttributeDescriptor.ts`,
    `packages/twopoint5d/src/display/FrameLoop.ts`
  - `AGENTS.md` (neue Regel), `packages/twopoint5d/docs/architecture.md` (§2 `map2d/`),
    `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]`, Migration Guide)
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: keep the tiles nearest to the camera under maxVisibleTiles of a CameraBasedVisibility on a map node that is tilted or stands upright, name the packed key of a TileBox packedKey and type its fields as present, refuse an offset of Map2DTileCoordsUtil and a center point of computeVisibleTiles() that is no finite number, move the heaps and the slot pool of the camera based visibility into modules of their own and declare every private member of the library with #`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · BUG-013 unverändert (`CameraBasedVisibility.ts:1328–1331`), in Zug 0 gegen `dist` von HEAD d6b71005 rot belegt · CONS-002 unverändert (`CameraBasedVisibility.ts:20`, `types.ts:39`, `Map2DTileCoords.ts:13`, Schreiber `packedTileKey.ts:24`) · API-010 unverändert (`CameraBasedVisibility.ts:27–46`, Guards `CameraBasedVisibilityHelpers.ts:203/215/221`) · CONS-003 unverändert, in der Library 42 `private`-Methoden in 6 Dateien gegen 185 `#`-Methoden in 39, dazu 3 `private`-Felder · READ-003 unverändert (1513 Zeilen) · BUG-021-Rest unverändert (`Map2DTileCoordsUtil.ts:104/111`) · Nebenbefund `centerPoint` beider Visibilitors ins Paket · Nebenbefund Cache-Zweig von `CameraBasedVisibility` an den Queue-Eintrag zu `RectangularVisibilityArea.ts:204–210` gehängt · Folge aus Paket 8 (`RepeatingTilesProvider`) → neues Paket 17
  - 2026-10-24 Zug 1: Implementierer beauftragt · stärkste Stufe (opus), Effort high · Brief `paket-9.impl-0.brief.txt`, Report `paket-9.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG · 23 Dateien (19 geändert, neu `tileDistanceHeaps.ts`/`.spec.ts`, `TileSlotPool.ts`/`.spec.ts`), dazu ungeplant `hot-path-allocations.spec.ts` (Spy auf `createHelpers` → Getter `visibles`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-9.verify.log`) · Laufzeit +2,4 % / +4,2 %
  - 2026-10-24 Zug 3: Reviewer (opus, high) · alle sieben Punkte behoben · 1 wichtig (CHANGELOG `TileBox` »BREAKING for TypeScript«, bricht auch zur Laufzeit; Wortlaut stammte aus Schritt 7 dieser Datei — sachlich falsch, keine Entscheidung, deshalb Runde statt Rückfrage), 4 klein · Diff `paket-9.diff`, Report `paket-9.review-0.json`
  - 2026-10-24 Zug 4 Runde 1: offen das wichtige plus drei kleine (`TileSlotPool.ts:15` `{@link}`, `AGENTS.md:110–112` Wortlaut, `architecture.md:226` Umbruch) · an denselben Implementierer per Resume `96519b3d…`, opus/high
  - 2026-10-24 Zug 4 Runde 1 zurück: FERTIG · `CHANGELOG.md` (»(**BREAKING**)«, Migration Guide: `tile.id` liest auch in JavaScript `undefined`), `TileSlotPool.ts`, `AGENTS.md`, `architecture.md` · Verify `pnpm run ci` exit=0 (`paket-9.verify-1.log`) · Diff `paket-9.diff-1`, Reviewer gezielt (opus, high) → `paket-9.review-1.json`
  - 2026-10-24 Zug 4 Runde 1, Review: alle vier Befunde erledigt, keine neuen (`paket-9.review-1.json`)
  - 2026-10-24 Zug 5: committet b3bf6a53 · 23 Dateien · Verify `pnpm run ci` exit=0 (`paket-9.verify-1.log`) · 1 Runde · 5 Nebenbefunde → Queue

## Abgleich

Stand des Codes: HEAD d6b71005, Arbeitsbaum sauber.

- **BUG-013 — unverändert.** `#beginSearchStop()` heißt noch `beginSearchStop()`
  (`CameraBasedVisibility.ts:1319–1333`) und liest die Diagonale aus der Welt-AABB:
  `const {min, max} = this.#kept[0]!.frustumBox; const dx = max.x - min.x; const dz = max.z - min.z;`
  (Z. 1328–1331). In Zug 0 gegen das gebaute `dist` von HEAD gemessen, mit einem
  Wegwerf-Skript außerhalb des Repos: Eine aufrecht gestellte Karte schneidet bei
  kleinem Limit falsch. Sie ist eine Vierteldrehung um X auf einem Raster `2 × 32` oder
  um Z auf `32 × 2`, mit `depth = 0`, und die Kamera ist mitgedreht. Dieselbe Szene
  flach schneidet richtig. Bei quadratischen Tiles `16 × 16` fiel in 150 Zufallsszenen
  nichts auf: Dort ist die Welt-Kante `w · s` ≥ die halbe echte Diagonale und reicht
  zufällig. Bei gestreckten Tiles fehlt die lange Kante ganz. Messwerte stehen unter
  Schritt 3.
- **CONS-002 — unverändert.** `TileBox.id: number` (`CameraBasedVisibility.ts:20`,
  TSDoc nennt `packTileCoords(x, y)`), `IMap2DTileCoords.id: string` (`types.ts:39`),
  `Map2DTileCoords.id` (`Map2DTileCoords.ts:13`). Geschrieben wird der gepackte Schlüssel
  über `writePackedTileCoords(target: {id: number}, …)` (`packedTileKey.ts:24`).
  Entscheidung vom 2026-10-23: `TileBox.id` → `packedKey`.
- **API-010 — unverändert, Zeilen verschoben.** `coords`, `box`, `frustumBox`,
  `centerWorld`, `distanceToCamera`, `map2dTile`, `primary` sind optional
  (`CameraBasedVisibility.ts:27–46`). Die Guards mit `undefinedValueError` stehen in
  `CameraBasedVisibilityHelpers.ts:203`, `:215`, `:221` (Audit: 201/216/221).
- **CONS-003 — unverändert und breiter als im Audit.** `private`-Methoden in map2d:
  `CameraBasedVisibility.ts` (25, ab Z. 601), `CameraBasedVisibilityHelpers.ts` (10),
  `TileSlotTable.ts` (`link` Z. 98, `grow` Z. 107), `RectangularVisibilityAreaHelpers.ts`
  (`releaseNode` Z. 61) und `chunk-quad-tree/ChunkQuadTreeNode.ts` (`static makeChild`
  Z. 289, `appendToNode` Z. 337; Audit Z. 241, durch Paket 8 verschoben).
  `Map2DSpatialHashGrid.ts:127` und `Map2DTileRenderer.ts:150` sind im Audit die
  Beispiele der `#`-Seite. Außerhalb von map2d gibt es `private` noch in
  `stage/Canvas2DStage.ts` (`updateTexture` Z. 166, `dispatchEvent` Z. 308) und als Feld
  in `vertex-objects/VertexAttributeDescriptor.ts:38` (`private readonly description`)
  sowie `display/FrameLoop.ts` (Z. 65 Konstruktor-Parameter `private readonly renderer`
  der internen Klasse `RAF`, Z. 282 `private readonly raf`). Library-weit: 185
  `#`-Methoden in 39 Dateien gegen 42 `private`-Methoden in 6. Kein Spec greift auf eine
  dieser Methoden oder Felder zu (geprüft per grep über `src/**/*.spec.ts` und
  `twopoint5d-testing/test`). `eventize()` bringt kein `dispatchEvent` mit; die
  Umbenennung in `Canvas2DStage` verdeckt also nichts.
- **READ-003 — unverändert.** 1513 Zeilen, Klasse ab Z. 247. Heaps: `pushFrontier`/
  `popFrontier` Z. 1236–1280, `heapifyKept`/`siftDownKept` Z. 1386–1420, `sortKept`
  Z. 1094–1125. Slot-Pool: `createTileSlot` Z. 93–109, `#slotTable`/`#slots`/`#freeSlots`
  Z. 554–561, `acquireTileBox` Z. 871–884, `writeTileCoords` Z. 892–907, `evictSlots`
  Z. 1137–1157, Neuschreiben aller Slots in `takeOverTileCoords` Z. 646–651.
- **BUG-021, Rest des Map2D-Teils — unverändert.** `Map2DTileCoordsUtil#xOffset`/
  `yOffset` sind öffentliche Felder (Z. 104, 111); seit Paket 8 prüft nur der
  Konstruktor (Z. 125–126). In Zug 0 gemessen: Ein direkt geschriebenes `xOffset = NaN`
  geht durch. Erst der erste `computeVisibleTiles()` danach wirft, und zwar innerhalb
  von `takeOverTileCoords()` → `clone()` mit der Meldung des Konstruktors, nicht beim
  Schreiben. Lesestellen auf dem Frame-Pfad: `CameraBasedVisibility.ts:804`, `:940–942`,
  `:1045–1046`, `RectangularVisibilityArea.ts:285`, `CameraBasedVisibilityHelpers.ts:301`;
  im Util selbst Z. 132–133 (`copy`), 138 (`clone`), 145–146 (`equals`), 213
  (`computeTilesWithinArea`). Die Allokations-Specs nutzen schon gebrochene Offsets
  (`0.25, -0.5` in `hot-path-allocations.spec.ts:41/71/241` und
  `hot-path-allocations.tilted-view.spec.ts:40/42`). Sie fangen jede Lesestelle, die
  über einen Getter boxt.

## Triage in Zug 0

- **Folge aus Paket 8** (`RepeatingTilesProvider#getTileIdsWithin()`, zwei Subjekte in
  den Meldungen eines Aufrufs) — **Symptom** von Paket 8. Die Meldung zum zu kurzen
  `target` (`RepeatingTilesProvider.ts:193–195`) stand am Laufbeginn schon so
  (`git show 7341059f:…`, Z. 166–167). Paket 8 hat daneben die Abweisungen desselben
  Aufrufs mit dem Aufruf als Subjekt geschrieben und die alte Meldung nicht
  angeglichen. Paket 8 ist committet, deshalb ein Nachtragspaket: **Paket 17**, im
  Plan nach Paket 9. Weitere Fundstellen derselben Ursache gibt es keine. Die übrigen
  Meldungen, die Paket 8 neu geschrieben hat (`Map2D`, `Map2DTileStreamer`,
  `Map2DTileCoordsUtil`, `Map2DSpatialHashGrid`, `RectangularVisibilityArea`), tragen
  das Klassen-Subjekt wie die übrigen ihres Aufrufs.
- **Queue-Eintrag `RectangularVisibilityArea.ts:180–181`** (`centerPoint` ungeprüft) —
  gleiche Ursache wie der Rest von BUG-021 (Zahlen an öffentlichen Map2D-Einstiegen
  ungeprüft), also in dieses Paket. Das Gegenstück in `CameraBasedVisibility.ts:683`
  stand am Laufbeginn genauso (`git show 7341059f:…`, Z. 683). In Zug 0 gemessen:
  `computeVisibleTiles([], [NaN, 0], …)` antwortet nach 1 ms mit einem leeren
  Ergebnis, ohne Meldung, und hängt nicht.
- **Nebenbefund, nicht in dieses Paket:** Der Cache-Zweig von
  `CameraBasedVisibility#computeVisibleTiles()` (`CameraBasedVisibility.ts:691–699`)
  ignoriert `previousTiles` wie der von `RectangularVisibilityArea`. Das stand am
  Laufbeginn schon so. Andere Ursache als die Findings dieses Pakets, deshalb an den
  bestehenden Queue-Eintrag `RectangularVisibilityArea.ts:204–210` angehängt
  (→ Scope).

## Entscheidungen in Zug 0

1. **CONS-003 wird eine Regel für die ganze Library, nicht nur für map2d.** Die
   Empfehlung verlangt eine Konvention in `AGENTS.md`. Eine Regel, der am Tag ihres
   Eintrags fünf Stellen widersprechen, stimmt nicht. Deshalb ziehen
   `Canvas2DStage.ts`, `VertexAttributeDescriptor.ts` und `FrameLoop.ts` mit. Die
   Ursache ist dieselbe, der Aufwand mechanisch. Die Lookbook-Datei
   `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts` bleibt
   außen vor: Die Regel gilt `packages/twopoint5d/src`.
2. **READ-003 schneidet zwei Module heraus, wie empfohlen: die Heaps und den
   Slot-Pool.** Die »Suche« bleibt Aufgabe der Klasse: Probe-Strahlen,
   Frustum-Höhenbereich, Hülle, Abbruchmarge, Platzierung. Dort leben die Doubles des
   Frames, und dort gilt die Notiz über Doubles oben in der Datei. Ein drittes Modul
   für die Abbruchmarge müsste `frustumBoxScale` über eine Aufrufgrenze reichen.
3. **`TileBox.map2dTile` bleibt `IMap2DTileCoords | undefined`, als Pflichtschlüssel.**
   Der Slot wird so herausgegeben, wie der Pool ihn hält. Ein strengerer Typ bräuchte
   einen Cast im Getter `visibles`, und dieser Lauf baut Casts ab. Jede `TileBox` in
   `visibles` trägt eine Hülle; die TSDoc sagt das.
4. **BUG-013: die Marge aus den beiden Kanten der Kachel in der Kartenebene, nicht
   `max(alt, neu)`.** Für einen flachen Map-Node ohne Drehung um Y ist der neue Wert
   gleich dem alten. Bei einer anderen Drehung als einer Vierteldrehung war die alte
   Welt-AABB-Diagonale größer. Sie hat damit Tiles erfasst, die nur über die Welt-AABB
   als sichtbar gelten, und zwar durch Zufall, nicht durch das Argument. Solche Tiles
   fallen unter denselben Vorbehalt wie die, die `Frustum#intersectsBox()` an einer
   Kante vorbei durchlässt; die TSDoc nennt beide. Scherung (ein Elternknoten, der
   unter einer Drehung ungleich skaliert) bleibt ebenfalls genannt und ungedeckt: Die
   sichtbare Menge eines gescherten Nodes kommt ohnehin aus Welt-AABBs, die das
   Argument nicht deckt, und ein Verhaltenstest dafür wäre nicht stabil.
5. **Offsets von `Map2DTileCoordsUtil` in einem `Float64Array(2)`, gelesen über eine
   interne Methode `readOffset(target)`.** Das ist das Muster von
   `Map2DTileStreamer#center` aus Paket 8. Ein `#`-Feld würde jeden geschriebenen
   gebrochenen Wert boxen (`copy()` läuft in jedem `computeVisibleTiles()`), und ein
   Getter boxt an jeder Lesestelle, die der Compiler nicht inliniert. Paket 8 hat das
   mit 32,31 B je `update()` gemessen.
6. **Die `centerPoint`-Prüfung steht inline über `Number.isFinite()`, ganz oben in
   `computeVisibleTiles()`, mit dem Klassen-Subjekt.** `assertFinite()` nähme ein
   gebrochenes Double als Argument und boxte es. Das Klassen-Subjekt deshalb, weil
   beide Klassen ihre übrigen Meldungen so beginnen, die von `computeVisibleTiles()`
   eingeschlossen (`RectangularVisibilityArea: the area covers …`).
7. **Reihenfolge: erst die Verhaltensänderungen mit rotem Test, dann der Umbau unter
   der grünen Suite.** Die neuen Tests sichern den Umbau mit ab.
8. **Laufzeitvergleich vorher/nachher als Report-Posten, kein Gate.** Die
   Allokations-Specs fangen Boxing, aber keine Verlangsamung durch neue
   Aufrufgrenzen und `#`-Methoden.

## Vorgehen

`$ARBEITSDIR` ist `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad`.
Dort liegen Skripte und Ausgaben dieses Pakets, nie im Repo.

### Schritt 0 — Laufzeit vorher

1. `pnpm build:twopoint5d` auf dem unveränderten HEAD.
2. `$ARBEITSDIR/paket-9.timing.mjs` schreiben: ein Node-Skript (ESM) mit zwei
   Argumenten. Das erste ist der Pfad zu `packages/twopoint5d/dist/lib`, importiert
   wird `<pfad>/index.js`. Das zweite ist der Pfad des three-Builds, den
   `node -e "console.log(require.resolve('three/webgpu', {paths: ['packages/twopoint5d']}))"`
   im Repo-Root ausgibt.

   Die Szene ist die aus `src/map2d/hot-path-allocations.tilted-view.spec.ts`:
   - Kamera `PerspectiveCamera(75, 1.6, 0.1, 4000)` auf `(0, 350, 500)`, `lookAt(0, 0, 0)`
   - Raster `new Map2DTileCoordsUtil(400, 400, 0.25, -0.5)`, `centerPoint` `[3.25, -1.5]`
   - `matrixWorld` abwechselnd `makeTranslation(0.25, 0, 0.75)` und
     `makeTranslation(0.25, 0, 0.7501)`
   - `previousTiles` sind die `tiles` des letzten Ergebnisses

   Zwei Varianten: Vorgabe-Limit und `maxVisibleTiles = 100`. Die Szene hält 208
   Tiles, die zweite Variante schneidet also; `console.warn` stumm schalten. Je
   Variante 3 000 Neuberechnungen Aufwärmen, dann 7 Läufe zu je 5 000 mit
   `process.hrtime.bigint()`. Ausgabe: der Median in µs je Neuberechnung und die
   Tile-Zahl.
3. Ausgabe nach `$ARBEITSDIR/paket-9.timing-before.txt`.

### Schritt 1 — Offsets von `Map2DTileCoordsUtil` (Rest von BUG-021)

1. **Test zuerst** in `Map2DTileCoordsUtil.spec.ts`:
   `test.each([NaN, Infinity, -Infinity])('the xOffset setter refuses %p with a RangeError and keeps the offset it had', …)`
   und dasselbe für `yOffset`. Ausgang: Raster `(16, 16, 4, 8)`, Schreiben wirft
   `Map2DTileCoordsUtil: xOffset must be a finite number, got NaN` (bzw. `Infinity`,
   `-Infinity`), danach steht `xOffset` weiter auf `4`. Roten Lauf festhalten:
   `pnpm nx test twopoint5d -- src/map2d/Map2DTileCoordsUtil.spec.ts`.
2. `Map2DTileCoordsUtil.ts`:
   - Modulkonstanten `const X_OFFSET = 0;` und `const Y_OFFSET = 1;` mit einer Zeile:
     wo das Typed Array die beiden Offsets hält.
   - Feld `readonly #offsets = new Float64Array(2);`. Der Kommentar sagt, warum ein
     Typed Array: Es hält ein Double, wie es ist. Ein `#`-Feld boxte jeden
     geschriebenen Wert; die Klasse deklariert das Feld vor dem Konstruktor, das lässt
     V8 ein getaggtes Feld. Wortlaut sinngemäß wie bei `Map2DTileStreamer#center`.
   - `get xOffset(): number { return this.#offsets[X_OFFSET]!; }`,
     `set xOffset(offset: number) { assertFinite(offset, 'Map2DTileCoordsUtil', 'xOffset'); this.#offsets[X_OFFSET] = offset; }`,
     ebenso `yOffset`. Die TSDoc behält die Beschreibung des Rasters. Statt »The
     constructor refuses …« steht dort: »Takes a finite number; anything else throws a
     `RangeError` and leaves the offset as it was — in the constructor as well.«
   - Konstruktor: `this.xOffset = xOffset; this.yOffset = yOffset;` über die Setter.
     Den Kommentar »through the setters, so a grid of 0 is refused here as much as it
     is later on« auf die Offsets erweitern.
   - `copy(source)` und `equals(other)` lesen und schreiben alle vier Werte über die
     privaten Felder: `this.#tileWidth = source.#tileWidth`, …,
     `this.#offsets[X_OFFSET] = source.#offsets[X_OFFSET]!`. Kommentar: `source` ist
     eine geprüfte Instanz, und `CameraBasedVisibility` kopiert das Raster in jedem
     Aufruf, also kein Getter auf diesem Weg. `clone()` darf über den Konstruktor
     gehen, aber mit den privaten Feldern als Argumenten.
   - `computeTilesWithinArea()`: `const {xOffset, yOffset} = this;` ersetzen durch
     `const offsets = this.#offsets; const xOffset = offsets[X_OFFSET]!; const yOffset = offsets[Y_OFFSET]!;`.
   - Neue Methode, `@internal` wie `computeTilesWithinArea()`:
     `readOffset(target: Vector2): Vector2`. Sie schreibt `xOffset` nach `target.x`,
     `yOffset` nach `target.y` und gibt `target` zurück. TSDoc: für die
     Visibilities, die bei jedem Frame fragen. Ein Double, das ein nicht inlinierter
     Aufruf herausgibt, wird geboxt; eines im Feld eines Objekts nicht.
     `import type {Vector2} from 'three/webgpu';`.
3. Lesestellen auf dem Frame-Pfad, alle ohne Getter-Aufruf:
   - `CameraBasedVisibility`: neues Feld `readonly #gridOffset = new Vector2();`
     (Kommentar: der Offset des Rasters dieses Aufrufs, als Objekt — siehe die Notiz
     über Doubles). Direkt nach `this.#map2dTileCoords.copy(map2dTileCoords);`
     (heute Z. 681) folgt `this.#map2dTileCoords.readOffset(this.#gridOffset);`.
     Die drei Stellen schreiben Feld für Feld:
     - Z. 804: `#planeOffset.x = gridOffset.x; #planeOffset.y = 0; #planeOffset.z = gridOffset.y;`
       vor `makeTranslation(this.#planeOffset)`
     - Z. 939–943: `#tileBoxOffset.x = gridOffset.x - centerPoint2D.x`, `.y = 0`,
       `.z = gridOffset.y - centerPoint2D.y`
     - Z. 1044–1047: `#scratchOffset.x = gridOffset.x - centerPoint2D.x`,
       `.y = gridOffset.y - centerPoint2D.y`
   - `RectangularVisibilityArea.ts:285`:
     `const offset = map2dTileCoords.readOffset(this.#offset); offset.x -= centerX; offset.y -= centerY;`
   - `CameraBasedVisibilityHelpers`: neues Feld
     `readonly #planeGridOffset = new Vector2();`. Gefüllt am Anfang von
     `updatePlaneHelpers()` mit
     `this.cameraBasedVisibility.map2dTileCoords.readOffset(this.#planeGridOffset)`.
     `makePointOnPlane()` liest `this.#planeGridOffset.x/.y` statt der Getter.
   - `Map2DTileStreamer` und `Map2D` lesen die Offsets nur in ihren Accessoren. Die
     bleiben, wie sie sind.
4. `pnpm nx test twopoint5d -- src/map2d` und `pnpm test:allocations` grün. Die
   Allokations-Specs laufen schon mit gebrochenen Offsets; eine Lesestelle über einen
   Getter fällt dort auf.

### Schritt 2 — `centerPoint` in `computeVisibleTiles()` beider Visibilitors

1. **Tests zuerst**, je einer in `CameraBasedVisibility.spec.ts` (unter
   `describe('computeVisibleTiles()')`) und `RectangularVisibilityArea.spec.ts`:
   `'refuses a center point that is no pair of finite numbers before anything changes'`.
   - Ein gültiger Aufruf vorweg, dann für `[NaN, 0]`, `[0, Infinity]` und
     `[-Infinity, 0]` je ein `RangeError` mit
     `CameraBasedVisibility: the center point of computeVisibleTiles() must be two finite numbers, got [NaN, 0]`
     bzw.
     `RectangularVisibilityArea: the center point of computeVisibleTiles() must be two finite numbers, got [NaN, 0]`.
     Der Wert ist mit `describeValue()` zitiert; ein Array schreibt es als `[NaN, 0]`.
   - Danach antwortet ein Aufruf mit dem Center von vorher, als hätte es die
     Abweisungen nicht gegeben:
     - `CameraBasedVisibility`: `serial` unverändert, `changed === false`,
       `reuseTiles` sind die `tiles`
     - `RectangularVisibilityArea`: `reuseTiles` sind die `tiles`, `createTiles` ist
       `undefined`
   - Roter Lauf vor dem Fix (heute kommt ein leeres Ergebnis zurück, nichts wirft).
2. Prüfung als **erste** Anweisung beider `computeVisibleTiles()`, vor
   `if (!this.camera)` und vor dem Abschalt-Zweig von `RectangularVisibilityArea`:
   ```ts
   const centerX = centerPoint[0];
   const centerY = centerPoint[1];
   if (!(Number.isFinite(centerX) && Number.isFinite(centerY))) {
     throw new RangeError(
       `CameraBasedVisibility: the center point of computeVisibleTiles() must be two finite numbers, got ${describeValue(centerPoint)}`,
     );
   }
   ```
   In `RectangularVisibilityArea` dasselbe mit dem Subjekt `RectangularVisibilityArea:`
   (`describeValue` dort importieren, falls noch nicht).
   In `RectangularVisibilityArea` gibt es `centerX`/`centerY` schon (Z. 180–181); die
   Zeilen wandern nach oben, nicht doppelt lesen. In `CameraBasedVisibility` nimmt
   `#centerPoint2D.set(…)` (Z. 683) die beiden Locals. Kommentar: inline und nicht über
   `assertFinite()`, weil ein gebrochenes Double, das einem nicht inlinierten Aufruf
   übergeben wird, geboxt wird.
3. TSDoc beider `computeVisibleTiles()`: ein Satz, dass ein `centerPoint`, der nicht
   aus zwei endlichen Zahlen besteht, einen `RangeError` wirft, bevor sich etwas
   ändert. `Map2DTileStreamer` reicht nur geprüfte Werte weiter.

### Schritt 3 — Abbruchmarge in der Kartenebene (BUG-013)

1. **Test zuerst** in `CameraBasedVisibility.spec.ts`, `describe('maxVisibleTiles')`:
   `'keeps the nearest tiles under a small limit on a map node that stands upright'`.
   - Hilfen im Block erweitern:
     - `makeCamera(scene, turn?: Matrix4)`: nach `lookAt()` und `updateMatrixWorld()`
       folgen `camera.applyMatrix4(turn)` und `camera.updateMatrixWorld()`, dann erst
       `updateProjectionMatrix()`.
     - `unlimitedVisibles(camera, tileCoords, center, matrixWorld = new Matrix4(), depth?: number)`
       setzt `depth`, wenn angegeben.
   - Fälle, jeweils mit `depth = 0` für die Referenz und für die begrenzte Visibility,
     `matrixWorld` = die Drehung:
     - Drehung `new Matrix4().makeRotationX(-Math.PI / 2)` (die Zeilen der Karte
       zeigen nach oben) mit dem Raster `new Map2DTileCoordsUtil(2, 32)`
     - Drehung `new Matrix4().makeRotationZ(Math.PI / 2)` (die Spalten zeigen nach
       oben) mit `new Map2DTileCoordsUtil(32, 2)`
   - Szenen, beide mit `center: [0, 0]`:
     - `{fov: 40, far: 700, position: [0, 130, 0], target: [170, 0, 190]}`
     - `{fov: 45, far: 800, position: [0, 120, 0], target: [200, 0, 200]}`
   - Limits 1 bis 15, `expectTheNearest(…)`.
   - Ein Kommentar erklärt die Wahl: Die Karte und die Kamera drehen sich gemeinsam,
     die Ansicht bleibt dieselbe. Ein Tile, viel länger als breit, und `depth = 0`
     zeigen, ob die Marge die lange Kante der Kachel enthält. Bei einer Vierteldrehung
     ist die Welt-Box gleich der gedrehten Box.
   - In Zug 0 gegen `dist` von HEAD gemessen (gleiche Szenen, Wegwerf-Skript): Drehung
     um X falsch bei Limit 8–15 (Szene 1) und 6–15 (Szene 2), Drehung um Z bei 4–12
     und 15 (Szene 1) und 6–15 (Szene 2). Die Referenzen halten 5 184 und 7 492 (X)
     bzw. 5 188 und 7 492 (Z) Tiles; dieselben Szenen flach sind bei keinem Limit
     falsch. Roten Lauf festhalten:
     `pnpm nx test twopoint5d -- src/map2d/CameraBasedVisibility.spec.ts`.
2. Fix in `beginSearchStop()`: die Zeilen 1326–1331 ersetzen. Die Fläche einer
   Frustum-Box auf der Kartenebene, in Weltkoordinaten: die x- und die z-Kante der
   Kachel durch den linearen Teil von `#tileWorldMatrix` (derselbe wie der von
   `matrixWorld`), skaliert mit `frustumBoxScale`. Alles in einer Methode, keine
   Hilfsfunktion mit Double-Argumenten:
   ```ts
   const e = this.#tileWorldMatrix.elements;
   // every tile of one recomputation has the same size; the search calls this once it holds
   // maxVisibleTiles tiles, at least one
   const coords = this.#kept[0]!.coords; // nach Schritt 5: this.#kept.furthest.coords
   const scale = this.#frustumBoxScale;
   const width = coords.width * scale;
   const height = coords.height * scale;
   const ax = e[0]! * width, ay = e[1]! * width, az = e[2]! * width;
   const bx = e[8]! * height, by = e[9]! * height, bz = e[10]! * height;
   // the footprint is a parallelogram; its longer diagonal is the one to hold against
   const sumSq = (ax + bx) ** 2 + (ay + by) ** 2 + (az + bz) ** 2;
   const differenceSq = (ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2;
   stop[SEARCH_STOP_FOOTPRINT_DIAGONAL] = Math.sqrt(sumSq > differenceSq ? sumSq : differenceSq);
   ```
   (Gegen die Notiz über Doubles gelesen: keine Aufrufgrenze, ein Vergleich statt
   `Math.max()`. `**` darf der Implementierer ausschreiben, wenn die Allokations-Specs
   es verlangen.) Für einen flachen Node ohne Drehung um Y ergibt das den alten Wert.
3. TSDoc:
   - Klassen-TSDoc, erster Absatz: Die Karte liegt auf der XZ-Ebene im lokalen Raum
     ihres Nodes (der Ebene, die `CameraBasedVisibility.Plane` beschreibt). Die
     `matrixWorld` von `computeVisibleTiles()` darf sie beliebig drehen: gekippt,
     aufrecht, kopfüber. Die Kamera muss auf diese Ebene sehen, damit ein Tile
     sichtbar ist.
   - `searchCanStop()`: Der Absatz »The argument needs a map on the XZ plane …« wird
     ersetzt. Die Fläche ist das Parallelogramm, das die x- und die z-Kante einer
     Frustum-Box durch die Weltmatrix aufspannen; seine längere Diagonale ist die
     Marge, gleich wie der Node gedreht ist. `frustumBoxScale` ≥ 1 bleibt Bedingung.
     Außerhalb des Arguments liegen, neben den Boxen, die `intersectsBox()` an einer
     Kante vorbei durchlässt, zwei Fälle:
     - Auf einem Node, der um etwas anderes als eine Vierteldrehung um eine Weltachse
       gedreht ist, reicht die Welt-Box (die achsparallele Box um die gedrehte
       Frustum-Box, die der Frustum-Test liest) über die gedrehte Box hinaus. Ein
       Tile, das nur dadurch sichtbar ist, kann für ein weiter entferntes wegfallen.
     - Eine Weltmatrix mit Scherung (ein Elternknoten, der unter einer Drehung ungleich
       skaliert) kippt die lokale y-Achse aus der Normalen, und die Marge lässt diesen
       Anteil der Boxhöhe aus.
   - Der Kommentar am Feld `#searchStop` bleibt sinngemäß, »the diagonal of the
     footprint of a frustum box« stimmt weiter.

### Schritt 4 — `TileBox` (CONS-002, API-010)

1. **Typtest zuerst** in `CameraBasedVisibility.spec.ts`,
   `describe('what it hands out')`:
   `'types every field of a TileBox as present and names its packed key packedKey'`.
   Nach einer Neuberechnung mit sichtbaren Tiles:
   ```ts
   const tile: TileBox = visibility.visibles[0]!;
   const distance: number = tile.distanceToCamera;
   const box: Box3 = tile.frustumBox;
   // @ts-expect-error the packed key is packedKey; an id is the string key of a Map2DTileCoords
   void tile.id;
   expect(tile.packedKey).toBe(packTileCoords(tile.x, tile.y));
   ```
   Dazu ein `expect` auf `distance` und `box`, damit nichts unbenutzt bleibt. Roter
   Lauf: `pnpm typecheck` (TS2322/TS2339/TS2578 vor dem Umbau).
2. `CameraBasedVisibility.ts`, `interface TileBox`:
   - `readonly id: number` → `readonly packedKey: number`. TSDoc: der gepackte
     Schlüssel der Tile-Koordinate, wie `packTileCoords(x, y)` ihn liefert, für eine
     Tabelle auf dem Frame-Pfad. Er ist nicht die `id` eines `Map2DTileCoords`, deren
     Schlüssel der String `tileKey(x, y)` ist; wer eine lesbare Bezeichnung braucht,
     nimmt `x` und `y`.
   - Pflichtfelder: `readonly coords: TilesWithinCoords;`, `readonly box: Box3;`,
     `readonly frustumBox: Box3;`, `readonly centerWorld: Vector3;`,
     `readonly distanceToCamera: number;`, `readonly map2dTile: IMap2DTileCoords | undefined;`,
     `readonly primary: boolean;`. Die bestehenden TSDocs bleiben. Neu:
     - `distanceToCamera`: der Abstand der Kachelmitte zur Kamera in Welteinheiten,
       wonach `visibles` geordnet ist
     - `map2dTile`: die Hülle, die das Ergebnis in `tiles` herausgibt. Jede `TileBox`
       in `visibles` trägt eine. `undefined` ist der Zustand eines Slots, dessen Tile
       die Ansicht verlassen hat: Dasselbe Objekt dient als Slot des Pools.
   - `PooledTileBox` (wandert in Schritt 5 nach `TileSlotPool.ts`): `id` → `packedKey`;
     in `createTileSlot()` steht `packedKey: 0` an erster Stelle, wie heute `id`.
3. `packedTileKey.ts`: `writePackedTileCoords(target: {packedKey: number}, x: number, y: number)`,
   TSDoc »into `target.packedKey`«.
4. `CameraBasedVisibilityHelpers.updateTileHelpers()`: die drei `if (… == null) throw undefinedValueError(…)`
   (Z. 203, 215, 221) streichen, `tile.frustumBox` und `tile.box` direkt nehmen, den
   Import von `undefinedValueError` entfernen.
5. Specs:
   - `CameraBasedVisibility.spec.ts`: Jedes `.id` auf einer `TileBox` wird
     `.packedKey`: `visibles`, `reference` und `kept` in `expectTheNearest()`, die
     Fälle um Z. 576–621, 691–711 und 1284–1287. `.id` auf `Map2DTileCoords`
     (`result.tiles`, `createTiles`, `removeTiles`, `ids()`) bleibt. Z. 621 wird
     `expect(v.packedKey, where).toBe(packTileCoords(v.x, v.y))`.
   - Das `!` hinter den jetzt pflichtigen Feldern einer `TileBox` entfällt
     (`.frustumBox!`, `.box!`, `.centerWorld!`, `.distanceToCamera!`, `.coords!`,
     `.primary!`), nicht hinter `.map2dTile`.
   - `CameraBasedVisibilityHelpers.spec.ts` `makeTileBox()` baut eine vollständige
     `TileBox`: `packedKey: packTileCoords(x, y)`, `coords: createTilesWithinCoords()`
     (aus `./createTilesWithinCoords.js`), `centerWorld: new Vector3(x + 0.5, 0, y + 0.5)`,
     `distanceToCamera: 0`, `map2dTile: undefined`, dazu die bisherigen Felder.

### Schritt 5 — Heaps und Slot-Pool in eigene Module (READ-003)

Ein Refactoring ohne Verhaltensänderung: Die Specs der Klasse bleiben unverändert grün.
Jede neue Methode nimmt und gibt Objekte, Smis oder Booleans, nie ein gebrochenes
Double. Die Entfernung lesen die Heaps am Eintrag selbst. Beide neuen Module kommen
nicht in `public-api.ts`, und jedes verweist mit einem Satz auf die Notiz über
Doubles oben in `CameraBasedVisibility.ts`. Private Member von Anfang an mit `#`.

1. Neues Modul `packages/twopoint5d/src/map2d/tileDistanceHeaps.ts`:
   - `export interface DistanceToCameraEntry { readonly distanceToCamera: number; }`
   - `export class NearestFirstHeap<T extends DistanceToCameraEntry>`: Binärer
     Min-Heap über `distanceToCamera`, das nächste Element oben, die Frontier der
     Suche. `readonly #heap: T[] = []`. Mitglieder:
     - `get length(): number`
     - `peek(): T`: das nächste Element; der Aufrufer hat geprüft, dass der Heap nicht
       leer ist
     - `push(entry: T): void`: Sift-up aus `pushFrontier()`
     - `pop(): T`: aus `popFrontier()`, gleiche Vorbedingung
     - `clear(): void`: `truncateArray()`, damit der Speicher bleibt
   - `export class KeptTiles<T extends DistanceToCameraEntry>`: die Einträge, die die
     Suche behält. Bis `heapify()` in Ankunftsreihenfolge, danach ein binärer Max-Heap
     über `distanceToCamera`, das fernste Element oben. Felder
     `readonly #entries: T[] = []` und `#isHeap = false`. Mitglieder:
     - `get length(): number`
     - `at(index: number): T`: Vorbedingung `index < length`
     - `get furthest(): T`: die Spitze des Heaps, nur nach `heapify()`
     - `add(entry: T): void`: nur vor `heapify()`
     - `heapify(): void`: Bottom-up aus `heapifyKept()`, setzt `#isHeap`
     - `replaceFurthest(entry: T): void`: `#siftDown(0, entry, length)` aus
       `siftDownKept()`
     - `sortNearestFirst(): void`: aus `sortKept()`. Ohne Heap das Insertion Sort samt
       Kommentar (fast sortiert, gleiche Abstände in Ankunftsreihenfolge), mit Heap das
       Heapsort. Danach ist die Liste aufsteigend und `#isHeap` falsch.
     - `clear(): void`: `truncateArray()`, `#isHeap = false`
     - privat `#siftDown(start: number, entry: T, length: number): void`

     Der Entscheid »Heap oder nicht« hängt damit an `#isHeap` und nicht mehr an
     `kept.length < maxVisibleTiles`.
2. Neues Modul `packages/twopoint5d/src/map2d/TileSlotPool.ts`:
   - `export interface PooledTileBox extends TileBox, TileSlotTableEntry<PooledTileBox>`.
     Wortgleich aus `CameraBasedVisibility.ts` übernommen, samt TSDoc der Stempel.
     `TileBox` kommt per `import type {TileBox} from './CameraBasedVisibility.js'`; der
     Zyklus ist nur einer der Typen und verschwindet im Build.
   - `createTileSlot()` wandert mit (modulprivat), samt Kommentar zur gemeinsamen
     Hidden Class.
   - `export class TileSlotPool`, TSDoc aus den Kommentaren an `#slotTable`, `#slots`
     und `#freeSlots`. Felder `readonly #grid: Map2DTileCoordsUtil`,
     `readonly #table = new TileSlotTable<PooledTileBox>()`,
     `readonly #slots: PooledTileBox[] = []`, `readonly #freeSlots: PooledTileBox[] = []`.
     Mitglieder:
     - `constructor(grid: Map2DTileCoordsUtil)`: das Raster, für das die Slots
       geschrieben werden, gelesen bei jedem geschriebenen Slot; der Pool folgt einem
       Raster, das an Ort und Stelle beschrieben wird
     - `get(x: number, y: number): PooledTileBox | undefined`
     - `acquire(x: number, y: number): PooledTileBox`: aus `acquireTileBox()`
     - `rewriteForGrid(): void`: die Schleife aus `takeOverTileCoords()` (Z. 646–651),
       schreibt `coords` jedes Slots für das Raster neu und lässt seine Hülle los
     - `evict(stamp: number): void`: aus `evictSlots()`, samt Kommentar zur
       Reihenfolge
     - privat `#writeTileCoords(slot: PooledTileBox): void`: aus `writeTileCoords()`
3. `CameraBasedVisibility.ts`:
   - Felder `readonly #frontier = new NearestFirstHeap<PooledTileBox>()`,
     `readonly #kept = new KeptTiles<PooledTileBox>()` und
     `readonly #pool = new TileSlotPool(this.#map2dTileCoords)`. `#pool` steht **nach**
     `#map2dTileCoords`, sonst liest der Initialisierer `undefined`.
   - Alle Stellen auf die neuen Mitglieder umstellen. Die Kommentare an `#frontier`
     und `#kept` (Z. 515–524) kürzen und auf die Klassen verweisen.
   - `searchCanStop(this.#frontier.peek())`, `#kept.furthest.distanceToCamera` in
     `updateSearchStop()`, `#kept.furthest.coords` in `beginSearchStop()`.
   - Die Platzierungsschleife (Z. 1025–1032) über `#kept.at(i)`, danach
     `#kept.clear()`.
   - Die übrigen privaten Methoden werden zu `#`-Methoden (Schritt 6).
4. Charakterisierungs-Specs, grün vor und nach dem Herausziehen.
   `tileDistanceHeaps.spec.ts`:
   - `NearestFirstHeap` gibt eine gemischte Menge samt gleicher Abstände aufsteigend
     heraus; `length` folgt; `clear()` leert
   - `KeptTiles` vor `heapify()`: `at(i)` in Ankunftsreihenfolge, und
     `sortNearestFirst()` hält gleiche Abstände in Ankunftsreihenfolge
   - nach `heapify()`: `furthest` ist das Maximum; nach `replaceFurthest()` mit einem
     näheren Eintrag ist `furthest` das Maximum des Rests; `sortNearestFirst()` ordnet
     aufsteigend
   - nach `clear()` sortiert ein neuer Durchgang wieder als Liste

   `TileSlotPool.spec.ts`:
   - `acquire()` zweimal für dieselbe Koordinate gibt denselben Slot; `get()` findet
     ihn; `packedKey === packTileCoords(x, y)`; `coords` für das Raster geschrieben
     (`tileLeft === x`, `left === x * tileWidth`, `columns === 1`)
   - `evict(stamp)` behält Slots mit `visitedStamp === stamp`. Der nächste
     `acquire()` einer neuen Koordinate bekommt einen geräumten Slot, den zuerst
     genommenen zuerst, mit `map2dTile === undefined` und neuen `coords`.
   - `rewriteForGrid()` nach geändertem `tileWidth` schreibt `coords` aller Slots neu
     und lässt jede Hülle los
   - die Freiliste hält höchstens so viele Slots, wie bleiben

### Schritt 6 — `#` statt `private` (CONS-003)

1. Jede `private`-Methode wird eine `#`-Methode, samt aller Aufrufe:
   - in `CameraBasedVisibility.ts` (die verbliebenen), `CameraBasedVisibilityHelpers.ts`
   - `TileSlotTable.ts` (`#link`, `#grow`), `RectangularVisibilityAreaHelpers.ts`
     (`#releaseNode`)
   - `chunk-quad-tree/ChunkQuadTreeNode.ts`: `static #makeChild`, aufgerufen als
     `ChunkQuadTreeNode.#makeChild(…)`, und `#appendToNode`
   - `stage/Canvas2DStage.ts` (`#updateTexture`, `#dispatchEvent`)
2. Felder:
   - `VertexAttributeDescriptor.ts:38` `private readonly description` →
     `readonly #description`
   - `FrameLoop.ts` Klasse `RAF`: Konstruktor-Parameter `private readonly renderer?`
     → Feld `readonly #renderer?: ISetAnimationLoop;` plus Zuweisung im Konstruktor
   - `FrameLoop.ts:282` `private readonly raf: RAF` → `readonly #raf: RAF`
3. Danach findet `grep -rnE "\bprivate\b" packages/twopoint5d/src --include=*.ts` nur
   noch Kommentare (`canvasHandover.ts:117`, `Display.ts:86`, `FeatureSprites.ts:279`).
4. `AGENTS.md`, in »Rules you cannot read off the code« direkt nach dem Punkt
   **Imports.** ein neuer Punkt, englisch, sinngemäß: »**Private members.** In
   `packages/twopoint5d/src` a member private to its class is an ECMAScript private
   member — `#field`, `#method()`, `static #helper()` —, never TypeScript's `private`,
   whose member stays reachable at run time; that holds for constructor parameters
   too. `protected` stays for what a subclass reads. A private method costs a hot path
   nothing over a public one; `pnpm test:allocations` holds the hot paths to it.«

### Schritt 7 — Doku und CHANGELOG

Skill `updating-changelog` laden. Alles unter `## [Unreleased]` in
`packages/twopoint5d/CHANGELOG.md`, beschrieben als der Stand, der jetzt gilt.

1. `### Changed`, neuer Punkt: `TileBox` nennt den gepackten Schlüssel seiner
   Tile-Koordinate `packedKey` und typisiert jedes Feld als vorhanden. `coords`,
   `box`, `frustumBox`, `centerWorld`, `distanceToCamera` und `primary` tragen auf
   jedem Tile von `visibles` einen Wert, `map2dTile` ist `IMap2DTileCoords | undefined`
   (**BREAKING** for TypeScript). See the Migration Guide.
2. `### Changed`, bestehender Punkt Z. 124 (»`Map2D` and `Map2DTileStreamer` throw a
   `RangeError` for an `xOffset` …«): Der letzte Satz sagt auch, dass die Setter
   `xOffset`/`yOffset` von `Map2DTileCoordsUtil` abweisen und den Wert davor stehen
   lassen.
3. `### Changed`, neuer Punkt: `computeVisibleTiles()` von `CameraBasedVisibility` und
   `RectangularVisibilityArea` wirft einen `RangeError` für einen Center, der nicht
   aus zwei endlichen Zahlen besteht, bevor sich etwas ändert; `Map2DTileStreamer`
   prüft seinen Center, bevor er ihn weiterreicht.
4. `### Fixed`, neuer Punkt: `CameraBasedVisibility` behält unter `maxVisibleTiles`
   die nächsten Tiles auch auf einem gekippten oder aufrecht stehenden Map-Node. Die
   Marge, um die die Suche hinter dem fernsten behaltenen Tile weitergeht, misst die
   Diagonale einer Kachel in der Kartenebene.
5. Migration Guide, Abschnitt »#### What CameraBasedVisibility hands out« (Z. 409ff.):
   - ein Satz zu `packedKey` und den Pflichtfeldern
   - **Before** um eine Zeile mit `tile.id` als gepacktem Schlüssel erweitern
   - **After** mit `tile.packedKey`, und das `!` hinter `distanceToCamera` entfällt
   - die Blöcke bleiben einfaches `ts`, kein `ts check`
6. `packages/twopoint5d/docs/architecture.md` §2 `map2d/`, nach dem Satz zu
   `CameraBasedVisibility`/`RectangularVisibilityArea`: ein Satz, englisch, sinngemäß:
   `CameraBasedVisibility` sucht von der Kamera nach außen über zwei Heaps aus
   `tileDistanceHeaps.ts` und hält den Slot jedes Tiles in einem `TileSlotPool`, der
   den Slot eines Tiles, das die Ansicht verlässt, einem eintretenden gibt. Der
   Absatz behält seine Umbruchbreite.
7. `docs/map2d.md` braucht nichts: Er beschreibt die Karte schon auf der XZ-Ebene
   ihres Nodes und keine direkten Aufrufe von `computeVisibleTiles()`.

### Schritt 8 — Laufzeit nachher, Gate

1. `pnpm build:twopoint5d`, `paket-9.timing.mjs` erneut, Ausgabe nach
   `$ARBEITSDIR/paket-9.timing-after.txt`. Beide Mediane je Variante in den Report.
   Mehr als 10 % langsamer in einer Variante: Status `FERTIG_MIT_VORBEHALT` mit den
   Zahlen.
2. `pnpm run ci` grün.

## Findings im Volltext

**BUG-013 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:1328** — Footprint-Diagonale der Suchabbruch-Marge aus lokalen Tile-Maßen statt aus der Welt-AABB berechnen
`beginSearchStop()` leitet `SEARCH_STOP_FOOTPRINT_DIAGONAL` aus `dx`/`dz` der bereits in den Weltraum transformierten `frustumBox` ab. Bei einem Map-Node, der nicht parallel zur Welt-XZ-Ebene liegt (um X oder Z gekippt), und kleiner `depth` fehlt dort die in der Kartenebene liegende Ausdehnung (Beispiel: Karte senkrecht gestellt, `depth = 0`: `dx` = Tile-Breite, `dz` nur Tile-Höhe, Diagonale zu klein). Die Marge, auf der der Beweis in `searchCanStop()` ruht, kann dann zu knapp sein; die Suche bricht beim `maxVisibleTiles`-Limit zu früh ab und lässt ein näheres sichtbares Tile weg. Nur im Cap-Fall wirksam. Die Klassen-TSDoc nennt zwar die XZ-Ebene, meint aber die lokale XZ-Ebene des Map-Nodes, den `computeVisibleTiles()` mit beliebiger `matrixWorld` bedient.
Beleg: `const {min, max} = this.#kept[0]!.frustumBox; const dx = max.x - min.x; const dz = max.z - min.z;`
Empfehlung: Die Diagonale aus `coords.width`/`coords.height` mal `frustumBoxScale` (lokal, skaliert um die Weltskalierung der Matrix) berechnen, nicht aus der Welt-AABB; Spec mit gekipptem Map-Node und kleinem Limit ergänzen.

**CONS-002 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:21** (auch `types.ts:39`, `Map2DTileCoords.ts:13`) — `TileBox.id` (number) und `IMap2DTileCoords.id` (string) zusammenbringen oder umbenennen
Im Modul heißt dasselbe Konzept (Schlüssel einer Tile-Koordinate) einmal `id: string` (`tileKey()`, `Map2DTileCoords`, `IMap2DTileCoords`) und einmal `id: number` (gepackter Schlüssel in `TileBox`, `writePackedTileCoords()`). Die Tabelle `TileSlotTable` findet nach `x`/`y`, der gepackte `id` wird nur herausgegeben; ein Konsument, der `tile.id` zwischen den beiden Typen vergleicht oder in eine `Map<string, …>` steckt, bekommt stillschweigend falsche Treffer.
Empfehlung: `TileBox.id` in `packedKey` umbenennen oder entfernen, falls kein Konsument ihn braucht.

**API-010 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:27** (auch `CameraBasedVisibilityHelpers.ts:201`, `:216`, `:221`) — Felder von `TileBox` als Pflichtfelder typisieren
`TileBox` deklariert `coords`, `box`, `frustumBox`, `centerWorld`, `distanceToCamera`, `map2dTile` und `primary` optional, obwohl jeder Slot (`PooledTileBox`, `createTileSlot()`) sie von Anfang an trägt und `visibles` nur solche liefert. Die Folge sind Laufzeitprüfungen mit `undefinedValueError` im Konsumenten (`CameraBasedVisibilityHelpers`) für Fälle, die der Typ selbst ausschließen könnte.
Empfehlung: Die öffentlichen Felder von `TileBox` nicht optional deklarieren (`map2dTile` bleibt wegen des Eviction-Zustands `| undefined`, oder wird für `visibles` zugesichert) und die Guards in den Helpers streichen.

**CONS-003 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:601** (auch `chunk-quad-tree/ChunkQuadTreeNode.ts:241`, `TileSlotTable.ts:98`, `TileSlotTable.ts:107`, `Map2DSpatialHashGrid.ts:127`, `Map2DTileRenderer.ts:150`) — Private Methoden einheitlich mit `#` statt `private` deklarieren
Felder sind im Slice durchweg `#`-privat, Methoden aber gemischt: `CameraBasedVisibility`, `CameraBasedVisibilityHelpers`, `RectangularVisibilityAreaHelpers`, `TileSlotTable` und `ChunkQuadTreeNode` nutzen `private`, `Map2DSpatialHashGrid`, `Map2DTileRenderer`, `HelpersManager` und `RepeatingTilesProvider` nutzen `#`-Methoden. Zwei Mechanismen für dieselbe Absicht, ohne erkennbaren Grund (der Hot-Path-Kommentar nennt nur Felder).
Empfehlung: Eine Konvention in AGENTS.md festlegen und den Slice darauf ziehen; `#`-Methoden sind in der Hot-Path-Messung nachzuprüfen.

**READ-003 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:247** — `CameraBasedVisibility` in Heap, Slot-Pool und Suche aufteilen
Die Klasse hat 1513 Zeilen, rund 40 private Felder und vermischt Probe-Rays, Frustum-Höhenbereich, eine Best-First-Suche mit zwei binären Heaps (`pushFrontier`/`popFrontier`, `siftDownKept`/`heapifyKept`/`sortKept`), den Slot-Pool samt Eviction, die Abbruchbedingung `searchCanStop()` und den Result-Aufbau. Die Heaps sind generisch (Schlüssel `distanceToCamera`) und die Slot-Verwaltung steht in sich. Das Inlining ist als Hot-Path-Maßnahme begründet (Boxing von Doubles), die Begründung gilt aber nicht für die Heap- und Pool-Logik als Ganzes.
Empfehlung: Heap über `distanceToCamera` und Slot-Pool mit Eviction in eigene Module ziehen (Zustand im Objekt, keine Doubles über Aufrufgrenzen), `hot-path-allocations.spec.ts` als Absicherung nutzen.

**BUG-021 · low · packages/twopoint5d/src/stage/StageRendererTargets.ts:136** (Map2D-Rest: `Map2DTileCoordsUtil.ts:104`, `:121`) — Zahlen an öffentlichen Stage- und Map2D-Einstiegen mit `assertFinite()` prüfen
`#deviceSize()` soll mit `Math.max(1, …)` eine Mindestgröße sichern, aber `Math.max(1, NaN)` ist `NaN`: ein `StageRenderer#resize(NaN, …)` (öffentlich) führt zu `rt.setSize(NaN, NaN)` bzw. `new RenderTarget(NaN, …)` und erst die GPU meldet den Fehler. `Canvas2DStage` übernimmt Breite und Höhe in Konstruktor und `setCanvasSize()` ungeprüft: `0`, negative Werte oder `NaN` landen im Canvas (als 0), im Sprite-Scale (`NaN`) und in den View-Specs, und der erste Upload versucht eine Textur ohne Fläche. `Stage2D` und die Projektionen behandeln solche Werte dagegen ausdrücklich.
Empfehlung: In `Canvas2DStage` (Konstruktor, `setCanvasSize()`) Breite und Höhe über `assertPositiveFinite()` aus `src/utils/` prüfen; in `#deviceSize()` nicht-endliche Werte wie 0 behandeln (`isPositiveFinite(size) ? … : 1`) oder `StageRenderer#resize()` dieselbe Regel wie `Stage2D` geben.
Hier offen nur der Rest des Map2D-Teils (Stage-Teil in Paket 5, übriger Map2D-Teil in Paket 8): die Setter `xOffset`/`yOffset` von `Map2DTileCoordsUtil`, siehe Schritt 1.

**Nebenbefund (Queue, aus Paket 8) · low · packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:180–181** — `computeVisibleTiles()` prüft `centerPoint` nicht: ein direkter Aufruf mit NaN oder Infinity ergibt ein leeres Ergebnis und entfernt alle `previousTiles` ohne Meldung (über `Map2DTileStreamer` nicht erreichbar, dessen Setter prüfen). Gegenstück: `CameraBasedVisibility.ts:683`, siehe Schritt 2.

## Ergebnis (Zug 5)

Urteil des Reviewers je Finding (`paket-9.review-0.json`, Fundstellen im Stand von b3bf6a53):

- **BUG-013 — behoben.** `#beginSearchStop()` rechnet die Marge aus den beiden Kachelkanten durch den linearen Teil von `#tileWorldMatrix` und hält die längere Diagonale des Parallelogramms dagegen (`CameraBasedVisibility.ts:1115–1140`); Klassen-TSDoc `:167–171`, TSDoc von `#searchCanStop()` mit den beiden ungedeckten Fällen `:1179–1196`; Test `CameraBasedVisibility.spec.ts:1512`, vor dem Fix rot.
- **CONS-002 — behoben.** `TileBox.packedKey` (`CameraBasedVisibility.ts:21`), `writePackedTileCoords(target: {packedKey})` (`packedTileKey.ts:24–26`), Slot `TileSlotPool.ts:19/52`; Specs umgestellt.
- **API-010 — behoben.** Pflichtfelder `CameraBasedVisibility.ts:28–56`, `map2dTile: IMap2DTileCoords | undefined` mit TSDoc `:43–48`; Guards mit `undefinedValueError` in `CameraBasedVisibilityHelpers.ts` entfernt; Typtest `CameraBasedVisibility.spec.ts:1678`.
- **CONS-003 — behoben.** `private` in `packages/twopoint5d/src` nur noch in Kommentaren; Regel `AGENTS.md:107–112`; `static #makeChild` (`ChunkQuadTreeNode.ts:288`), Konstruktor-Parameter von `RAF` (`FrameLoop.ts:65–69`).
- **READ-003 — behoben.** `tileDistanceHeaps.ts` (`NearestFirstHeap`, `KeptTiles`) und `TileSlotPool.ts` mit Charakterisierungs-Specs, nicht in `public-api.ts`; Klasse 1513 → 1299 Zeilen; Laufzeit +2,4 % / +4,2 %.
- **BUG-021, Rest des Map2D-Teils — behoben.** `Map2DTileCoordsUtil.ts:107–143` (`Float64Array(2)`, prüfender Setter), `readOffset()` `@internal` `:191`; Lesestellen `CameraBasedVisibility.ts:630/750–755/845–852/951–953`, `RectangularVisibilityArea.ts:295`, `CameraBasedVisibilityHelpers.ts:166`; Tests `Map2DTileCoordsUtil.spec.ts:82/93`, vor dem Fix rot.
- **`centerPoint`-Prüfung (Nebenbefund) — behoben.** `CameraBasedVisibility.ts:614–623`, `RectangularVisibilityArea.ts:176–186`; Tests `CameraBasedVisibility.spec.ts:786`, `RectangularVisibilityArea.spec.ts:228`, vor dem Fix rot.

Runde 1 (`paket-9.review-1.json`): der wichtige Befund (CHANGELOG `TileBox` nur »for TypeScript«) und drei kleine (`TileSlotPool.ts` `{@link}`, `AGENTS.md`-Wortlaut zu Hot Paths, Umbruch `architecture.md` §2) erledigt.

Kleine Befunde, offen gelassen:

- `Map2DTileCoordsUtil.ts:118–143, 161–181` — `xOffset`/`yOffset` sind Accessoren auf dem Prototyp: Spread, `Object.keys()` oder `toEqual()` beim Konsumenten sehen die Offsets nicht mehr; `copy()`/`equals()` werfen für eine Instanz aus einer anderen Kopie der Library einen `TypeError`. Beides folgt aus Entscheidung 5 und dem Vorgehen (»`copy()`/`equals()` über die privaten Felder«); CHANGELOG und TSDoc nennen es nicht.
- `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts:72` — `private renderChunkFrame(` bleibt; die Regel gilt nach Entscheidung 1 nur `packages/twopoint5d/src`.

Nebenbefunde (in »Offene Befunde« des Plans, je `→ Scope`, weil die Scope-Regel jede Severity und Kategorie umfasst): `FrameLoop.ts:185` (`static OnFrame` beschreibbar), `FrameLoop.ts:294` `setFps()` (nicht endliche und negative Werte still umgedeutet), `CameraBasedVisibilityHelpers.ts:58–61` (Zahlenfelder ungeprüft), `Map2DTileCoordsUtil.ts:209/237` (Abfrageargumente ungeprüft), `Canvas2DStage.ts:126–127/225–226` (Größen zwischen 0 und 1). Alle standen am Laufbeginn so; dieses Paket hat in diesen Dateien nur umbenannt bzw. andere Stellen geändert. Keiner teilt die Ursache eines offenen Pakets so, dass er dort hingehört — die Drain-Runde entscheidet.
