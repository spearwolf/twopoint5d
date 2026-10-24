# Paket 8 — Map2D: Streamer, räumliche Indizes, Tile-Provider

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-002 (medium), PERF-001 (medium), PERF-003 (low), BUG-014 (low), CONS-001 (low), API-002 (low), MEM-007 (low), BUG-021 (low, nur der Map2D-Teil — der Stage-Teil ist mit Paket 5 erledigt)
- Ziel: Streamer und räumliche Indizes skalieren mit dem Belegten, haben begrenzte Tile-Zahlen, eine gemeinsame `out`-Semantik und lassen keine Renderer mit veralteten Daten stehen.
- Modell: stärkste Stufe — acht Findings über zwölf Quelldateien eines Moduls, dazu zwei
  subtile Stellen: der Upload-Vertrag zwischen `Map2DTileRenderer`, Factory und Streamer
  (wann `IMapTileFactory#update()` läuft, ohne einen Zyklus doppelt hochzuladen) und die
  Accessoren auf dem Frame-Pfad, an denen die Allokations-Specs mit gebrochenen Offsets messen
  (V8 boxt Doubles an nicht inlinierten Aufrufen). Mehrere kleine API-Brüche mit Changelog
  und Migrationshinweisen.
- Effort: medium — Signaturen, Meldungen, Grenzwerte und Testfälle stehen unten; mehr Effort
  erhöht hier nur die Neigung, über den Plan hinaus zu verbessern.
- Dateien:
  - `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts` (+ `Map2DTileRenderer.spec.ts`)
  - `packages/twopoint5d/src/map2d/types.ts` (nur TSDoc von `IMap2DTileRenderer#clearTiles`)
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts` (Regressionstests BUG-002)
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` (+ `Map2DTileStreamer.spec.ts`)
  - `packages/twopoint5d/src/map2d/Map2D.ts` (+ `Map2D.spec.ts`)
  - `packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.ts` (+ `Map2DTileCoordsUtil.spec.ts`)
  - `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts` (+ `Map2DSpatialHashGrid.spec.ts`)
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts` (+ `RectangularVisibilityArea.spec.ts`)
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts` (+ `RepeatingTilesProvider.spec.ts`)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` (+ `ChunkQuadTreeNode.spec.ts`, `ChunkQuadTreeNode.extended.spec.ts`, `hot-path-allocations.spec.ts` im selben Ordner)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts` (+ `DataIdsChunk2D.spec.ts`)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/base64toUint32Arr.ts` (+ `base64toUint32Arr.spec.ts`)
  - `packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts`
  - `packages/twopoint5d-testing/test/map2d-tile-upload.test.js`
  - `packages/twopoint5d/docs/map2d.md`, `packages/twopoint5d/docs/architecture.md` (§2 `map2d/`, Z. 216–230)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`)
  - **Nicht anfassen:** `src/map2d/CameraBasedVisibility.ts` (Paket 9), `src/map2d/TileSlotTable.ts`
    (Paket 9 nutzt es; die Lösung unten kommt ohne Änderung aus), alle `public-api.ts` (Paket 13)
- Vorgehen: siehe Abschnitt »Vorgehen« unten, Schritte 0–9.
- Verify: `pnpm run ci` — zur Fehlersuche `pnpm nx test twopoint5d -- src/map2d`, `pnpm test:allocations`
  und die Browser-Suite direkt (`pnpm exec web-test-runner` in `packages/twopoint5d-testing`, nach `pnpm build:twopoint5d`)
- Commit: `fix(twopoint5d)!: let a tile renderer bring its factory up to date when it gives its tiles back outside an update cycle, so that no tile stays drawn after the visibilitor goes or has no answer, bound the tiles a rectangular visibility area covers and the cells a renderable of the spatial hash grid reaches into, let a query of the grid over more cells than it holds walk the cells it holds, empty the out array of the chunk queries as the grid does, refuse a tile coordinate of RepeatingTilesProvider that is no whole number and an offset or a view center of a map that is no finite number, make the tuning factors and the state of ChunkQuadTreeNode read-only, and let a data ids chunk keep neither its params nor its base64 string once it has decoded it`
- Verlauf:
  - 2026-10-23 Zug 0: Detailplan steht · BUG-002 unverändert (`Map2DTileStreamer.ts:228–241`, `:254`; `Map2DTileRenderer.ts:198–218` ohne Upload, Upload nur in `endUpdatingTiles()` Z. 220–232) · PERF-001 unverändert (`Map2DSpatialHashGrid.ts:100–110`, `#collect()` Z. 209–228, `#gather()` Z. 230–244) · PERF-003 unverändert (`RectangularVisibilityArea.ts:196–204`, `:224–237`, Setter Z. 97–103) · BUG-014 unverändert (`RepeatingTilesProvider.ts:162–169`, `getTileIdAt()` Z. 104–125) · CONS-001 unverändert (`ChunkQuadTreeNode.ts:305–317`, `:342–362`; Grid leert Z. 210) · API-002 unverändert (`ChunkQuadTreeNode.ts:107–108`, `:128–140`) · MEM-007 unverändert (`DataIdsChunk2D.ts:28`, `:34`, `:61–68`; `base64toUint32Arr.ts:7–13`) · BUG-021 Map2D-Teil unverändert (`Map2DTileCoordsUtil.ts:104/111`, Konstruktor Z. 118–124; `Map2DTileStreamer.ts:40/47`, `:125/142`; `Map2DSpatialHashGrid.ts:70–77`) · kein Commit dieses Laufs hat `src/map2d/` berührt · offene Folgen im Plan: keine · »Offene Befunde«: keiner mit gleicher Ursache, nichts übernommen · Restplan: keine Änderung
  - 2026-10-23 Zug 1: Implementierer beauftragt (opus, effort medium, `paket-8.impl-0`, Brief `paket-8.impl-0.brief.txt`)
  - 2026-10-23 Zug 2: Report `BLOCKIERT` (`paket-8.impl-0.json`, session 61d7a741-34b8-4dfd-9131-57a1ae469cb6) · Schritte 1 und 3–9 umgesetzt, 32 Quell-/Spec-/Doku-Dateien plus Lookbook `quadtree-playground.astro` und `_quadtree-playground.json` (Regler der Tuning-Faktoren entfallen, `static readonly`) · Arbeitsbaum schmutzig · eigener Lauf `pnpm test:allocations` exit=1 (`paket-8.verify-0.alloc.log`): `Map2D on the hot path > an update() over the same tiles under a moving camera allocates nothing` 32,31 B je `update()` (Grenze 8) — Offset-Getter von `Map2DTileCoordsUtil`, gelesen in `CameraBasedVisibility.ts` Z. 804, 939–942, 1045–1046; mit öffentlichen Feldern alle 15 Fälle grün (Implementierer) · direkt in die Fehlerkette, kein Zug 3
  - 2026-10-23 Zug 4 Entscheid: Paket verkleinert — `Map2DTileCoordsUtil#xOffset`/`yOffset` bleiben öffentliche Felder, der Konstruktor prüft sie über `assertFinite()`; die Accessoren samt Setter-Prüfung gehen an Paket 9 (`Dazu:` im Plan), das die Lesestellen in `CameraBasedVisibility.ts` ohnehin umbaut. Alle Schreibwege über `Map2DTileStreamer`/`Map2D` prüfen weiter
  - 2026-10-23 Zug 4 Runde 1: offen war die Allokations-Spec (Offset-Getter) · Resume derselben Session (opus, medium), Brief `paket-8.impl-1.brief.txt`: Felder zurück, Konstruktor prüft
  - 2026-10-23 Zug 4 Runde 1 zurück: `FERTIG` (`paket-8.impl-1.json`) · `Map2DTileCoordsUtil.ts`/`.spec.ts`, CHANGELOG nachgezogen · eigener Lauf `pnpm run ci` exit=0 (`paket-8.verify.log`) · Reviewer gestartet (opus, medium, `paket-8.review-0`), Diff `paket-8.diff`
  - 2026-10-23 Zug 3: Reviewer (`paket-8.review-0.json`): alle acht Findings erfüllt (BUG-021 in verkleinerter Fassung); 1 wichtig (`RectangularVisibilityArea.ts:217–225` — abgewiesener Gitterwechsel verliert `tileGridChanged`), 3 klein (Umbruch `docs/map2d.md:150`, Umbruch `docs/architecture.md:219–220/229`, `#cellsOf()` zweimal je Renderable in `Map2DSpatialHashGrid#add()`)
  - 2026-10-23 Zug 4 Runde 2: offen der wichtige Befund · frischer Implementierer (opus, medium — stärkste Stufe schon in Runde 0), Brief `paket-8.impl-2.brief.txt`: Merker `#gridChangeRefused`, Regressionstest, dazu die zwei Umbrüche
  - 2026-10-24 Zug 4 Runde 2 zurück: `FERTIG` (`paket-8.impl-2.json`) · `RectangularVisibilityArea.ts`/`.spec.ts`, `docs/map2d.md`, `docs/architecture.md` · Regressionstest `maxVisibleTiles > a grid change a refused call saw reaches the next call that computes` vor dem Fix rot (16 statt 0 wiederverwendet) · eigener Lauf `pnpm run ci` exit=0 (`paket-8.verify-2.log`) · Reviewer gezielt (opus, medium, `paket-8.review-1`), Diff `paket-8.diff-2`
  - 2026-10-24 Zug 4 Review Runde 2 (`paket-8.review-1.json`): wichtiger Befund und beide Umbrüche erledigt, 1 klein (Testlücke Merker-Pfade)
  - 2026-10-24 Zug 5: Commit d6b71005 (31 Dateien), Verify `paket-8.verify-2.log` exit=0, 2 Runden

## Abgleich

Kein Commit dieses Laufs hat `packages/twopoint5d/src/map2d/` berührt
(`git log 9b72e4bd^..HEAD -- packages/twopoint5d/src/map2d` ist leer); Paket 2 hat in
`packages/twopoint5d-testing/test/map2d-tile-upload.test.js` nur den Harness-Rahmen
angepasst. Jede Fundstelle steht wie im Audit.

- **BUG-002** unverändert. `Map2DTileStreamer#update()` leert im Clear-Zweig
  (Z. 228–237) jeden Renderer über `clearTiles()` und kehrt ohne Visibilitor in Z. 241
  zurück; ohne Ergebnis des Visibilitors (`visible === undefined`, Z. 254) läuft ebenfalls
  kein Zyklus. `Map2DTileRenderer#clearTiles()` (Z. 198–218) gibt die Slots per
  `destroyTile()` zurück und zählt `#dataSerial` hoch, ruft aber nie `tileFactory.update()` —
  das tut nur `endUpdatingTiles()` (Z. 220–232). Dieselbe Lücke hat `Map2DTileStreamer#removeTileRenderer()` (Z. 190–203) für einen
  Renderer, dessen Node der Aufrufer selbst in die Szene gehängt hat; `Map2DTileRenderer#dispose()`
  (Z. 246–264) nicht, es nimmt den Inhalt der Factory aus dem Node. Der Spec `Map2DTileStreamer.spec.ts:420–439`
  prüft nur `held` eines Fake-Renderers.
- **PERF-001** unverändert. `add()` legt in Z. 100–110 für jede Zelle des Rechtecks eine
  Zelle samt `Set` an, `#collect()` (Z. 209–228) und `#gather()` (Z. 230–244) laufen über
  jede Zelle des Abfragerechtecks; `assertFiniteAABB()` (Z. 33–39) hält nur NaN und
  Infinity fern.
- **PERF-003** unverändert. `computeVisibleTiles()` legt `Uint8Array(rows * columns)` an
  (Z. 196–204) und baut je fehlendem Tile ein `Map2DTileCoords` samt `AABB2`
  (Z. 224–237); die Setter (Z. 97–103) kennen das Gitter nicht.
- **BUG-014** unverändert. `getTileIdsWithin()` (Z. 162–169) prüft keine der vier Zahlen,
  `new Uint32Array(width * height)` wirft für ein negatives `width` den rohen
  `RangeError` des Typed Arrays; `getTileIdAt()` (Z. 104–125) indiziert mit Bruchteilen.
- **CONS-001** unverändert. `ChunkQuadTreeNode#findChunks()` (Z. 305–317) und
  `#findChunksAt()` (Z. 342–362) hängen an `out` an, `Map2DSpatialHashGrid#findWithin()`/
  `getTiles()` leeren es (`truncateArray()` in `#collect()`, Z. 210). Zwei Specs pinnen das
  Anhängen: `ChunkQuadTreeNode.extended.spec.ts:593–601` (»preserves pre-existing entries«)
  und `:707–716` (Sentinel bei `findChunksAt()`).
- **API-002** unverändert. `IntersectDistanceFactor`/`BeforeAfterDeltaFactor` sind
  beschreibbare Statics ohne TSDoc (Z. 107–108, gelesen in `scoreAxis()` Z. 37/42);
  `originX`, `originY`, `chunks`, `isLeaf` sind öffentliche Felder, `nodes` ist eine
  `readonly`-Referenz auf ein beschreibbares Objekt (Z. 128–140). Einziger Leser außerhalb
  von Bibliothek und Specs: `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts:80–110`,
  nur lesend.
- **MEM-007** unverändert. `protected readonly data` (Z. 28, gesetzt Z. 34) hält das
  Params-Objekt samt base64-String für die ganze Lebenszeit, neben dem dekodierten
  `#uint32Data` (Z. 61–68); `base64toUint32Arr()` kopiert Wort für Wort über `DataView`
  (Z. 7–13). Keine Unterklasse von `DataIdsChunk2D` im Repo.
- **BUG-021, Map2D-Teil** unverändert. `Map2DTileCoordsUtil#xOffset`/`#yOffset` sind
  öffentliche Felder (Z. 104/111), der Konstruktor schreibt sie ungeprüft (Z. 122–123);
  `Map2DTileStreamer#centerX`/`#centerY` sind öffentliche Felder (Z. 40/47), die Setter
  `xOffset`/`yOffset` (Z. 125/142) prüfen nichts, der Konstruktor (Z. 167–174) nur die
  Kachelgröße; `Map2DSpatialHashGrid` prüft im Konstruktor (Z. 70–77) nur die Kachelgröße.
  `Map2D` reicht alle sechs Grid- und Center-Setter (Z. 113–174) ungeprüft an den Streamer
  weiter.

## Triage

- Offene `Folgen:` im Plan: keine (Paket 2 → 14, 5 → 15, 6 → 16 sind erledigt; 1, 3, 4, 7,
  14, 15, 16 haben keine).
- »Offene Befunde«: zehn Einträge, keiner in `src/map2d/` und keiner mit einer Ursache dieses
  Pakets — nichts übernommen.
- Zug 0 hat einen eigenen Kandidaten geprüft und verworfen: `map2d-tile-upload.test.js`
  gibt die Geometrie und das Material aus `makeMap()` nicht frei. Das ist kein Symptom von
  Paket 2: dessen Zug 0 hat ausdrücklich entschieden, dass Tests, die heute nichts freigeben,
  kein `keep()` bekommen (`docs/remediation/paket-2.md`, Abschnitt »TEST-001, Umfang«). Der
  neue Browser-Test unten folgt dem Muster seiner Datei.

## Entscheidungen dieses Pakets

- **BUG-002: zweite Variante der Empfehlung.** `Map2DTileRenderer#clearTiles()` bringt die
  Factory selbst auf Stand. Grund: `IMap2DTileRenderer#clearTiles` ist laut Interface ein
  Aufruf außerhalb des Zyklus, also muss er für sich vollständig sein; die erste Variante
  (leerer Zyklus im Streamer) deckte nur die zwei Rückkehrpfade von `update()` ab, nicht
  `removeTileRenderer()` eines Renderers, dessen Node der Aufrufer selbst in die Szene gehängt
  hat, und nicht den direkten Aufruf — und sie bräuchte eine Position für
  `beginUpdatingTiles()`, die es ohne Visibilitor nicht gibt. Preis: Folgt im selben
  `update()` auf den Clear ein Zyklus, lädt die Factory zweimal hoch. Ein Clear kommt nur bei
  Gitter-, Visibilitor- oder Streamerwechsel, nach einem Wurf und bei `Map2D#clearTiles()` —
  nicht im Frame-Pfad. Zwei Wege geben Tiles zurück, ohne selbst hochzuladen: der Clear, den
  `beginUpdatingTiles()` für eine neue `contentSerial` auslöst — das `endUpdatingTiles()`
  desselben Zyklus lädt hoch —, und `dispose()`, das den Inhalt der Factory gleich danach aus
  dem Node nimmt und sich von einem werfenden `update()` nicht aufhalten lassen darf.
- **PERF-001: eine dichte Liste der belegten Zellen in `Map2DSpatialHashGrid`**, keine
  Iteration über `TileSlotTable`. Grund: die Bucket-Liste von `TileSlotTable` schrumpft nie;
  ein Gang über die Buckets kostete nach vielen `remove()` so viel wie die größte Belegung,
  die Liste kostet genau die belegten Zellen. `TileSlotTable.ts` bleibt unverändert.
  Obergrenze für `add()`: Accessor `maxCellsPerRenderable`, Vorgabe 65 536 (256 × 256), nach
  dem Muster von `CameraBasedVisibility#maxVisibleTiles` (ganze Zahl ≥ 1 oder `Infinity`).
  Kein `static readonly`: ein fester Wert ließe dem Nutzer mit einem legitim großen Renderable
  keinen Ausweg. Im Repo kommt kein Aufrufer in die Nähe (größte Specs: wenige Zellen).
- **PERF-003: Grenze mit `RangeError`** (erste Variante der Empfehlung), keine Warnung mit
  Kappung. Grund: Größe und Gitter sind Konfiguration, und ein Rechteck hat keine Ordnung,
  nach der es sich sinnvoll kappen ließe (`CameraBasedVisibility` kappt nach der Entfernung
  zur Kamera). Name und Vorgabe wie dort: `maxVisibleTiles`, 10 000 — eine Begrifflichkeit
  für beide Visibilitors. Größter Fall im Repo: Browser-Test 1024 × 1024 auf dem 256er-Gitter
  (≈ 25 Tiles), Lookbook 640 × 480 auf 256 (≈ 12). Die Vorgabe 320 × 240 auf dem
  Vorgabe-Gitter 1 × 1 deckt 76 800 Tiles und wirft damit — 76 800 `Map2DTileCoords` je Neuberechnung, weit über
  der Vorgabe-Kapazität 100 einer `TileSpritesGeometry`; die Defaults-Tabelle des Guides sagt es.
- **BUG-014:** `RangeError` mit dem Aufruf als Subjekt, Ganzzahligkeit über
  `Number.isInteger()` (nimmt NaN und ±Infinity mit), `width`/`height` ≥ 0. Lokaler Helfer in
  `RepeatingTilesProvider.ts` wie `assertAreaSize()` in `RectangularVisibilityArea.ts`, kein
  neues Modul in `src/utils/`: nur diese Datei prüft ganze Tile-Koordinaten. Wortlaut nach
  dem Muster von `DynamicAtlas` (»must be a whole number of 0 or more, got …«). Die Meldung
  zum zu kurzen `target` bleibt wörtlich (Spec `RepeatingTilesProvider.spec.ts:346–353`).
- **CONS-001:** nach der Entscheidung vom 2026-10-23 (»`out`-Parameter der räumlichen
  Abfragen wird in beiden Indizes geleert«) folgt `ChunkQuadTreeNode` dem Grid; das Grid
  bleibt, wie es ist.
- **API-002:** nach derselben Entscheidung `static readonly`; der Zustand als Getter über
  private Felder.
- **MEM-007:** `protected readonly data` entfällt, `prepareData()` bekommt den String als
  Parameter (`protected prepareData(base64: string): Uint32Array`). Grund: solange die
  Instanz die Params hält, hält sie den String; eine Unterklasse, die `prepareData()`
  überschreibt, sieht ihn weiter als Argument. Das bricht Unterklassen, die `this.data`
  lesen — keine im Repo —, daher Changelog mit Migrationshinweis. Der Schnellweg in
  `base64toUint32Arr()` gilt, wenn die verlangte Byte-Reihenfolge die des Hosts ist.
- **BUG-021:** Accessoren mit `assertFinite()`. `Map2D` prüft in seinen sechs Settern selbst,
  mit Subjekt `Map2D` — `tileWidth`/`tileHeight` über `assertPositiveFinite()`,
  `xOffset`/`yOffset`/`centerX`/`centerY` über `assertFinite()`. Grund: die
  Fehlermeldungsregel in AGENTS.md nennt das Subjekt, das der Nutzer in der Hand hält, und
  Paket 15 hat genau diese Lage an `Canvas2DStage#setContainerSize()` behoben; die
  Größen-Setter von `Map2D` meldeten bisher `Map2DTileStreamer: …` — dieselbe Ursache in
  derselben Datei, deshalb mit. Der Konstruktor von `Map2DTileStreamer` prüft die Offsets
  selbst, wie er es für die Kachelgröße schon tut. Das Center des Streamers liegt in einem
  `Float64Array(2)` (Präzedenz `#seenCenter` in `RectangularVisibilityArea.ts:50–54`).

## Vorgehen

### Schritt 0 — Lesen

`AGENTS.md` im Repo-Root und den Abschnitt »Konventionen« in `./remediation-plan.md`. Dann
die Quellen von `src/map2d/` ganz (`cat packages/twopoint5d/src/map2d/*.ts
packages/twopoint5d/src/map2d/chunk-quad-tree/*.ts packages/twopoint5d/src/map2d/TileSprites/*.ts`),
wie AGENTS.md es für die Bibliothek verlangt. Für Schritt 9 den Skill `updating-changelog`.

Bei jedem Korrektheitsfehler zuerst der Regressionstest, rot sehen, dann der Fix. Der rote
Lauf gehört in den Report — je Test Name, Kommando, Ausschnitt der Ausgabe. Für den
Browser-Test aus Schritt 1 genügt der rote Lauf gegen das `dist` vor dem Fix (bauen, Test
schreiben, Suite laufen lassen, dann fixen) — so hat Paket 5 es belegt.

### Schritt 1 — BUG-002: `Map2DTileRenderer#clearTiles()` lädt selbst hoch

In `Map2DTileRenderer.ts`:

1. Neue private Methode `#giveBackTiles(tileFactory: IMapTileFactory): void` — der heutige
   Rumpf von `clearTiles()` nach der Null-Prüfung (Z. 202–217: `#cleared = true`,
   `#declined.clear()`, `++#dataSerial` bei `#tiles.size > 0`, die Schleife über `#tiles`),
   samt seinen Kommentaren.
2. Neue private Methode `#uploadWrites(tileFactory: IMapTileFactory): void` — der heutige
   Serial-Gate aus `endUpdatingTiles()` (Z. 224–229):
   `if (this.#updateDataSerial < this.#dataSerial) { tileFactory.update(); this.#updateDataSerial = this.#dataSerial; }`
   mit dem Kommentar »only once update() has come back …«. Den Wert von `#dataSerial` vor dem
   Aufruf in eine Konstante nehmen wie heute.
3. `clearTiles()`: Null-Prüfung, `this.#giveBackTiles(tileFactory)`,
   `this.#uploadWrites(tileFactory)`. Kommentar am Upload, sinngemäß: outside an update cycle
   no `endUpdatingTiles()` follows that would upload the slots given back — without the
   upload the tiles go on being drawn.
4. `beginUpdatingTiles()`: der `contentSerial`-Zweig (Z. 98–102) ruft
   `this.#giveBackTiles(tileFactory)` statt `this.clearTiles()`; der Kommentar dort bekommt
   den Halbsatz, dass das `endUpdatingTiles()` dieses Zyklus hochlädt.
5. `endUpdatingTiles()`: `this.#uploadWrites(tileFactory)`, danach wie heute
   `this.#updating = false` mit seinem Kommentar.
6. `dispose()` ruft statt `this.clearTiles()` nur `this.#giveBackTiles(tileFactory)`, ohne
   Upload. Grund: `removeFromNode()` nimmt den Inhalt der Factory gleich danach aus `node`,
   von diesem Renderer wird nichts mehr gezeichnet; und ein werfendes `update()` darf den
   Abbau nicht aufhalten — mit Upload bliebe ein Renderer, dessen Factory beim Hochladen
   wirft, bei jedem weiteren `dispose()` halb abgebaut stehen. Wer die Factory danach
   bedient, lädt mit seinem ersten Zyklus hoch. Der Kommentar Z. 250–251 nennt dann
   `#giveBackTiles()` als die eine Stelle, die Tiles zurückgibt, und bekommt den Halbsatz
   »… without the upload: the content of the factory leaves `node` right after, and whoever
   serves the factory next uploads with its first cycle«. Die TSDoc von `dispose()` bleibt.
7. TSDoc an `clearTiles()` (die Methode hat heute keine), sinngemäß: »Gives every tile this
   renderer holds back to the factory through `destroyTile()`, forgets the coordinates the
   factory answered `undefined` for, and brings the factory up to date through
   `IMapTileFactory#update()` when it gave a tile back or a write still waits for its upload:
   outside an update cycle no `endUpdatingTiles()` follows that would, and the tiles given
   back would go on being drawn. `hasPendingTiles` stays `true` up to the end of the next
   update cycle. When `destroyTile()` or `update()` throws, the error goes on; a second call
   gives back the tiles that remain and uploads.«
8. `types.ts`, TSDoc von `IMap2DTileRenderer#clearTiles` (Z. 147–153): einen Satz anhängen,
   sinngemäß »The renderer takes its tiles down within the call, out of what it draws as
   well: no `endUpdatingTiles()` follows a clear when the streamer has no visibilitor or the
   visibilitor has no answer.«

`Map2DTileStreamer.ts` bekommt für BUG-002 keine Codeänderung.

Tests:

- `Map2DTileRenderer.spec.ts`, `describe('clearTiles()')`:
  - neu `test('outside an update cycle hands the emptied factory to update() itself')`:
    Zyklus mit einem Tile, `endUpdatingTiles()`, Spy auf `update`, `clearTiles()` →
    `update` genau einmal (vor dem Fix 0 — rot).
  - neu `test('the clear a new contentSerial brings on leaves the upload to endUpdatingTiles()')`:
    Factory mit `contentSerial: 0`, Zyklus mit einem Tile, `contentSerial = 1`, Spy auf
    `update`; nach `beginUpdatingTiles()` nicht aufgerufen, nach `endUpdatingTiles()` genau
    einmal (Charakterisierung, vor und nach dem Fix grün — sie hält den Doppel-Upload fern).
  - `test('a renderer holding a tile uploads')` (Z. 341–354) bleibt unverändert grün
    (`clearTiles()` lädt, `endUpdatingTiles()` findet nichts mehr).
- `TileSprites/TileSpritesFactory.spec.ts`, `describe('with a Map2DTileRenderer')` (Z. 425),
  mit echter `TileSpritesGeometry(64)`, `makeTileSet()`, `new RepeatingTilesProvider(1)`,
  `new Map2D(new Map2DTileStreamer(100, 100))` und `new RectangularVisibilityArea(300, 300)`
  (Import von `Map2DTileStreamer` ergänzen). Je erst `map.update()` und
  `geometry.instanceCount > 0` als Vorbedingung, dann:
  - `test('taking the visibilitor away leaves no tile in the instance count after the next update')`:
    `map.visibilitor = undefined; map.update()` → `geometry.instanceCount === 0`,
    `geometry.instancedPool.usedCount === 0` (vor dem Fix bleibt `instanceCount` — rot).
  - `test('a clear under a visibilitor without an answer leaves no tile in the instance count')`:
    `area.width = 0; map.clearTiles(); map.update()` → `instanceCount === 0` (der Clear
    leert die Tile-Liste, der ausgeschaltete Bereich antwortet auf eine leere mit
    `undefined`; vor dem Fix rot).
  - `test('a renderer taken off the streamer leaves no tile in the instance count')`:
    `map.tileStreamer.removeTileRenderer(renderer)` → `instanceCount === 0` (vor dem Fix rot).
- `packages/twopoint5d-testing/test/map2d-tile-upload.test.js`, neu
  `it('taking the visibilitor away draws no tile from the next frame on', …)` nach dem Muster
  des dritten Tests der Datei: `makeMap(new RectangularVisibilityArea(1024, 1024))`,
  `scene.add(map2d)`, `update` + `render` + `await display.nextFrame()`, Vorbedingung
  `tileSprites.geometry.instanceCount > 0`; dann `map2d.visibilitor = undefined`, `update` +
  `render` + `nextFrame` → `instanceCount` 0 und `instancedPool.usedCount` 0, und der Frame mit
  null Instanzen rendert unter allen vier Launchern ohne Fehler. Kein `keep()` (Muster der
  Datei, siehe Triage).

### Schritt 2 — BUG-021, Map2D-Teil: Offsets und Center prüfen

1. `Map2DTileCoordsUtil.ts`: `xOffset`/`yOffset` werden Accessoren über `#xOffset = 0` und
   `#yOffset = 0` (neben `#tileWidth`/`#tileHeight` deklariert). Setter:
   `assertFinite(offset, 'Map2DTileCoordsUtil', 'xOffset')` bzw. `'yOffset'` (aus
   `../utils/assertFinite.js`). Die TSDoc der Felder (Z. 98–111) wandert an die Getter und
   bekommt den Satz »A finite number; writing anything else throws a `RangeError` and leaves
   the offset as it was.« `computeTilesWithinArea()` liest `this.#xOffset`/`this.#yOffset`
   direkt (Z. 210), wie es `#tileWidth` liest — der Kommentar dort (»nothing here calls out«)
   gilt dann wörtlich. `copy()`, `clone()`, `equals()` und der Konstruktor gehen weiter über
   die Accessoren.
2. `Map2DTileStreamer.ts`:
   - `centerX`/`centerY` werden Accessoren über `readonly #center = new Float64Array(2)`,
     mit Kommentar nach dem Vorbild von `RectangularVisibilityArea.ts:50–54` (ein Double in
     einem `#`-Feld wird bei jedem Schreiben geboxt, ein Typed Array hält ihn, wie er ist).
     Setter: `assertFinite(x, 'Map2DTileStreamer', 'centerX')`, dann schreiben. Die TSDoc der
     Felder (Z. 24–47) wandert an die Getter, plus »Takes a finite number; anything else
     throws a `RangeError` and leaves the view center as it was.«
   - `update()` liest das Center aus `this.#center` (Z. 245–246), nicht über die Getter.
   - Setter `xOffset`/`yOffset` (Z. 125/142): `assertFinite(offset, 'Map2DTileStreamer', 'xOffset')`
     bzw. `'yOffset'` **vor** der Gleichheitsprüfung (wie bei `tileWidth`, Kommentar Z. 92);
     ein abgewiesener Wert löscht keine Tiles. TSDoc beider Getter um den
     `RangeError`-Satz ergänzen.
   - Konstruktor (Z. 167–174): `assertFinite(xOffset, 'Map2DTileStreamer', 'xOffset')` und
     `assertFinite(yOffset, …, 'yOffset')` neben den beiden Größenprüfungen; der Kommentar
     Z. 168–169 deckt sie mit.
3. `Map2DSpatialHashGrid.ts`, Konstruktor (Z. 70–77): `assertFinite(xOffset, 'Map2DSpatialHashGrid', 'xOffset')`
   und `'yOffset'` neben den Größenprüfungen.
4. `Map2D.ts`: jeder der sechs Setter prüft vor dem Weiterreichen —
   `assertPositiveFinite(width, 'Map2D', 'tileWidth')`, `assertPositiveFinite(height, 'Map2D', 'tileHeight')`,
   `assertFinite(offset, 'Map2D', 'xOffset')`, `'yOffset'`, `assertFinite(x, 'Map2D', 'centerX')`,
   `'centerY'`. Ein Kommentar einmal, sinngemäß: checked here as well as in the streamer, so the
   message names the class the caller holds in its hands. Die TSDoc von `centerX`, `xOffset`,
   `yOffset` bekommt den `RangeError`-Satz; `tileWidth`/`tileHeight` bekommen eine kurze
   TSDoc (»The width of a cell of the grid, in the units of the map: a finite number above 0,
   or a `RangeError` is thrown and the grid stays as it was. Another value has the tiles built
   again.«, entsprechend für die Höhe).

Meldungen, die die Tests wörtlich prüfen: `Map2DTileCoordsUtil: xOffset must be a finite number, got NaN`,
`Map2DTileStreamer: centerX must be a finite number, got NaN`,
`Map2DSpatialHashGrid: yOffset must be a finite number, got Infinity`,
`Map2D: tileWidth must be a finite number above 0, got 0`, `Map2D: centerY must be a finite number, got NaN`.

Tests:

- `Map2DTileCoordsUtil.spec.ts`: `test.each([NaN, Infinity, -Infinity])` für den Konstruktor
  (drittes und viertes Argument) und beide Setter; `RangeError`, Meldung, der Wert bleibt
  (vor dem Fix kein Wurf — rot).
- `Map2DTileStreamer.spec.ts`, `describe('new')` und ein neues `describe('the view center and the offsets')`:
  Konstruktor-Offsets NaN; `centerX`/`centerY`-Setter weisen NaN/Infinity ab und behalten den
  Wert; `xOffset`/`yOffset`-Setter weisen ab und lösen keinen Clear aus (ein
  `makeRecordingRenderer()` nach `update()` → abgewiesener Wert → `update()` → `cleared` bleibt 0).
- `Map2DSpatialHashGrid.spec.ts`: `new Map2DSpatialHashGrid(10, 10, NaN)` und
  `(10, 10, 0, Infinity)` werfen mit Subjekt `Map2DSpatialHashGrid`.
- `Map2D.spec.ts`: jeder der sechs Setter weist mit Subjekt `Map2D` ab und lässt den Wert des
  Streamers stehen (`tileWidth = 0` vor dem Fix mit Subjekt `Map2DTileStreamer` — rot;
  `centerX = NaN` vor dem Fix ohne Wurf — rot).
- `src/map2d/hot-path-allocations.spec.ts`, `describe('Map2D on the hot path')`, neu
  `test('writing the view center of a map allocates nothing')`: `makeMap()` der Datei, Runde
  `for (let i = 0; i < CALLS_PER_ROUND; i++) { map2d.centerX = i & 1023; map2d.centerY = i & 511; }`,
  Bytes je Aufruf (`/ (2 * CALLS_PER_ROUND)`) unter `BYTES_PER_CALL_LIMIT`. Ganze Zahlen aus
  dem Zähler, Kommentar mit Verweis auf die Regel in AGENTS.md (die Runde reicht keine selbst
  berechneten Bruchzahlen weiter).
- Die bestehenden Allokations-Specs lesen die Offsets jetzt über Getter — mit gebrochenen
  Werten (`0.25`, `-0.5`), auch aus `CameraBasedVisibility`. Sie müssen unter ihren Grenzen
  bleiben. Steigt einer durch die neuen Getter: **nicht** `CameraBasedVisibility.ts`
  anfassen (Paket 9), sondern mit den Messwerten `BLOCKIERT` melden.

### Schritt 3 — BUG-014: ganze Tile-Koordinaten in `RepeatingTilesProvider`

1. Lokaler Helfer oben in `RepeatingTilesProvider.ts`:
   `function assertWholeNumber(value: number, call: string, name: string, min?: number): void`
   (`min` nur für die Anzahlen, dort `0`),
   mit Kommentar (a tile coordinate and a count of tiles are whole numbers;
   `Number.isInteger()` takes NaN and the infinities out as well). Meldungen über
   `describeValue()`:
   - Koordinate: `${call}: ${name} must be a whole number, got ${describeValue(value)}`
   - Anzahl: `${call}: ${name} must be a whole number of 0 or more, got ${describeValue(value)}`
2. `getTileIdsWithin()`: zuerst `left`, `top` (Koordinaten), dann `width`, `height`
   (min 0), Subjekt `RepeatingTilesProvider#getTileIdsWithin()` — vor der Längenprüfung von
   `target` und vor jedem Schreiben. Die TSDoc-Zeile »All four numbers are given in _tile
   space_ and are integers.« (Z. 156) wird zu: »All four numbers are whole numbers in _tile
   space_, `width` and `height` 0 or more; anything else throws a `RangeError` before a cell
   is written.«
3. `getTileIdAt()`: `col`, `row` mit Subjekt `RepeatingTilesProvider#getTileIdAt()` als erste
   Zeilen, vor dem Guard für das leere Muster (eine ungültige Koordinate ist ungültig,
   welches Muster auch dasteht). Neue TSDoc: »The tile id at `(col, row)` of the repeated
   pattern, `0` outside the axis it repeats along and for a pattern without cells. `col` and
   `row` are whole numbers in _tile space_; anything else throws a `RangeError`.«
   `TileSpritesFactory#createTile()` ruft das je gebautem Tile: zwei `Number.isInteger()`
   allokieren nichts, `TileSprites/hot-path-allocations.spec.ts` bleibt grün.

Meldungen, die die Tests wörtlich prüfen:
`RepeatingTilesProvider#getTileIdsWithin(): left must be a whole number, got 0.5`,
`RepeatingTilesProvider#getTileIdsWithin(): width must be a whole number of 0 or more, got -1`,
`RepeatingTilesProvider#getTileIdAt(): col must be a whole number, got NaN`.

Tests in `RepeatingTilesProvider.spec.ts`, über die `providers`-Tabelle der Datei
(`test.each(Object.keys(providers) …)` wie Z. 346): `left`/`top` mit `0.5`, `NaN`,
`Infinity`; `width`/`height` mit `-1`, `1.5`, `NaN`; je `RangeError`, eine Meldung wörtlich,
ein mit `666` gefülltes `target` bleibt unberührt. `getTileIdAt()` mit `0.5` und `NaN` in
`col` und `row`. Vor dem Fix: kein Wurf bzw. der rohe `RangeError` des Typed Arrays ohne
Subjekt — rot.

### Schritt 4 — PERF-003: `RectangularVisibilityArea#maxVisibleTiles`

1. Feld `#maxVisibleTiles = 10_000;` neben `#width`/`#height`.
2. Accessor `maxVisibleTiles` nach `height`, Setter wie `CameraBasedVisibility#maxVisibleTiles`
   (`CameraBasedVisibility.ts:308–315`, dort nur lesen):
   `if (!(Number.isInteger(value) && value >= 1) && value !== Infinity) throw new RangeError(\`RectangularVisibilityArea: maxVisibleTiles must be a whole number above 0 or Infinity, got ${describeValue(value)}\`)`;
   ein neuer Wert setzt `needsUpdate = true` wie die Größen-Setter. TSDoc, sinngemäß: »The
   most tiles the rectangle may cover on the grid of a call. A call whose rectangle covers
   more throws a `RangeError` before it builds a tile, and the next call computes again: the
   limit catches an area too wide for its tiles before one frame builds tens of thousands of
   them. Defaults to 10 000, as `CameraBasedVisibility#maxVisibleTiles`; `Infinity` turns it
   off. Takes a whole number above 0 or `Infinity` and throws a `RangeError` for anything
   else, keeping the value it had. A new value recomputes on the next call.«
3. `computeVisibleTiles()`, neue Reihenfolge nach dem Gate (Z. 169–175): `width`/`height`
   lesen, `area` schreiben, `computeTilesWithinArea()` (heute Z. 180–187), dann
   `const tilesLength = tileCoords.rows * tileCoords.columns;` (heute Z. 196), dann die
   Prüfung:
   `if (tilesLength > this.#maxVisibleTiles) { this.needsUpdate = true; throw new RangeError(\`RectangularVisibilityArea: the area covers ${tilesLength} tiles of the grid, more than maxVisibleTiles (${this.#maxVisibleTiles}) — make the area smaller or the tiles larger, or raise maxVisibleTiles\`); }`
   Erst danach `this.needsUpdate = false; this.#serial += 1;` (heute Z. 177–178) und der Rest
   wie heute. Kommentar an `needsUpdate = true`: the gate has taken the new center and
   objects in already, and a refused call must not leave the next one the cached result of an
   earlier call. Die TSDoc von `computeVisibleTiles()` bekommt: »Throws a `RangeError` when the
   rectangle covers more than `maxVisibleTiles` tiles of the grid, before anything of the
   result is written; the next call computes again.«

Tests in `RectangularVisibilityArea.spec.ts`, neues `describe('maxVisibleTiles')`:

- Vorgabe `10_000`.
- `new RectangularVisibilityArea()` auf `new Map2DTileCoordsUtil(1, 1)`, Center `[0, 0]` →
  `RangeError`, Meldung wörtlich mit `76800 tiles` und `maxVisibleTiles (10000)` (320 × 240
  Tiles; vor dem Fix kein Wurf — rot).
- `maxVisibleTiles = 4` mit `(320, 240)` auf dem 100er-Gitter der Datei → wirft; derselbe
  Aufruf noch einmal → wirft wieder (kein Cache-Treffer); `maxVisibleTiles = 100` → der
  nächste Aufruf antwortet die Tiles, die ein frisches Area mit denselben Argumenten antwortet.
- Abweisung bei einem verschobenen Center: `(320, 240)` auf dem 100er-Gitter mit
  `maxVisibleTiles = 16` — Center `[0, 0]` deckt 4 × 4 Tiles und antwortet, Center `[50, 0]`
  deckt 5 × 4 und wirft (Zahlen im Kommentar des Tests nennen); ein zweiter Aufruf mit
  `[50, 0]` wirft wieder, statt das Ergebnis von `[0, 0]` als unverändert zu liefern.
- Setter weist `0`, `-1`, `1.5`, `NaN`, `'5'` ab, behält den Wert; `Infinity` nimmt er.

### Schritt 5 — PERF-001: das Hash-Grid läuft über das Belegte

In `Map2DSpatialHashGrid.ts`:

1. `GridCell` bekommt `index: number` — die Stelle der Zelle in `#occupied`, mit Kommentar.
2. `readonly #occupied: GridCell<Renderable>[] = [];` mit Kommentar: the cells that hold a
   renderable, in no order, so that a query over more cells than these walks them instead of
   its own rectangle.
3. `add()`: eine neue Zelle bekommt `index: this.#occupied.length` (im Objektliteral nach
   `renderables`) und wird nach `this.#cells.add(cell)` angehängt.
4. `#takeOut()`: eine leer gewordene Zelle geht nach `this.#cells.remove(cell)` per
   Swap-Remove aus `#occupied` — `const last = occupied.pop()`; ist `last` nicht die Zelle,
   rückt sie an `cell.index` und bekommt deren `index`. `pop()` auf leerer Liste ist ein
   gebrochener Invariant: `undefinedValueError('the occupied cells of the grid')` wie in
   `#collect()`.
5. `#collect(range, out)` und `#gather(range)`: ist `range.rows * range.columns` größer als
   `this.#occupied.length`, läuft die Abfrage per Index über `#occupied` und nimmt eine Zelle
   mit `cell.x >= tileLeft && cell.x < tileLeft + columns && cell.y >= tileTop && cell.y < tileTop + rows`
   — exakt die Grenzen der Rechteckschleife, damit Bruchteile und negative Breiten aus
   `getTiles()` dasselbe ergeben; sonst wie heute über das Rechteck. Was mit einer gefundenen
   Zelle geschieht (Stempel bzw. `Set`), bleibt gleich; dafür je eine private Methode für die
   Zelle, `#collectCell(cell: GridCell<Renderable>, stamp: number, out: Renderable[]): void` und
   `#gatherCell(cell: GridCell<Renderable>, renderables: Set<Renderable>): void`, ohne Closure;
   `#gather()` legt das `Set` wie heute erst beim ersten Treffer an.
   `truncateArray(out)` und der Stempel bleiben vorn in `#collect()`.
6. `#maxCellsPerRenderable = 65_536;` und Accessor `maxCellsPerRenderable`, Setter wie
   `CameraBasedVisibility#maxVisibleTiles`:
   `Map2DSpatialHashGrid: maxCellsPerRenderable must be a whole number above 0 or Infinity, got ${describeValue(value)}`.
   TSDoc: the most cells one renderable may reach into; `add()` refuses an `aabb` that reaches
   into more, before the first renderable moves; 65 536 (256 × 256) by default; `Infinity`
   turns it off; a new value applies to the next `add()` and moves nothing that lies in the
   grid; the `RangeError` and the kept value as in the other setters.
7. `add()`: in der ersten Schleife nach `assertFiniteAABB()`:
   `const {columns, rows} = this.#cellsOf(renderable.aabb);` und bei
   `columns * rows > this.#maxCellsPerRenderable`
   `throw new RangeError(\`Map2DSpatialHashGrid: the aabb of a renderable reaches into ${columns * rows} cells, more than maxCellsPerRenderable (${this.#maxCellsPerRenderable}) — give the grid larger cells or raise maxCellsPerRenderable\`)`.
   Die TSDoc von `add()` nennt den zweiten Wurf (»… and for one that reaches into more than
   `maxCellsPerRenderable` cells, and then adds none of the renderables.«).
8. TSDoc von `findWithin()` und `getTiles()`: »A query costs the cells of its rectangle or the
   cells the grid holds, whichever are fewer.«

Tests in `Map2DSpatialHashGrid.spec.ts`:

- `test('findWithin() and getTiles() over far more cells than the grid holds answer from the cells it holds', {timeout: 2000}, …)`:
  Gitter `(1, 1)`, `a` = `AABB2(0, 0, 2, 2)` (vier Zellen), `b` = `AABB2(10, 10, 1, 1)`,
  `c` = `AABB2(-5, 3, 1, 1)`. `findWithin(new AABB2(-1e6, -1e6, 2e6, 2e6))` → `{a, b, c}`,
  mit `out` dieselben drei, `a` einmal; `getTiles(-1e6, -1e6, 2e6, 2e6, out)` ebenso;
  `findWithin(new AABB2(-1e6, -1e6, 1e6 + 0.5, 1e6 + 0.5))` → nur `a`. Vor dem Fix läuft die
  Abfrage über 4·10¹² Zellen in die Frist — rot.
- `test('the cells a renderable leaves come out of the query over the grid')`: `a`, `b`, `c`
  hinzufügen, `b` entfernen → große Abfrage `{a, c}`; `b` wieder hinzufügen → `{a, b, c}`;
  `a` mit neuem `aabb` erneut hinzufügen → die große Abfrage findet es einmal.
- `test('add() refuses an aabb that reaches into more than maxCellsPerRenderable cells and adds none of the renderables')`:
  Gitter `(1, 1)`, `grid.add(small, {aabb: new AABB2(0, 0, 300, 300)})` → `RangeError` mit
  `reaches into 90000 cells, more than maxCellsPerRenderable (65536)` (Meldung wörtlich),
  `grid.getTile(0, 0)` bleibt `undefined` (vor dem Fix legt `add()` 90 000 Zellen an — rot).
  Dazu `maxCellsPerRenderable = 4` und ein 3 × 3-`aabb` → wirft; `= 9` → nimmt es.
- Setter weist `0`, `-1`, `1.5`, `NaN` ab, behält den Wert; Vorgabe `65_536`.
- `src/map2d/hot-path-allocations.spec.ts`, `describe('Map2DSpatialHashGrid on the hot path')`,
  neu `test('findWithin() with an out array over more cells than the grid holds allocates nothing')`
  nach dem Muster von `findWithin() with an out array allocates nothing` (Z. 396): dasselbe
  Gitter mit 200 Boxen, Abfrage `query.set(-4096, -4096, 8192, 8192)` (512 × 512 Zellen, mehr
  als belegt), Treffer > 0, Bytes je Aufruf unter `BYTES_PER_CALL_LIMIT`.

### Schritt 6 — CONS-001: die Chunk-Abfragen leeren `out`

In `ChunkQuadTreeNode.ts`:

1. `findChunks(aabb, out = [])`: `truncateArray(out)` (aus `../../utils/truncateArray.js`),
   dann eine private rekursive Methode `#collectChunks(aabb, out)` mit dem heutigen Rumpf
   (die Kinder rufen `#collectChunks`, nicht `findChunks` — sonst leerte jede Ebene `out`),
   `return out`.
2. `findChunksAt(x, y, out = [])`: `truncateArray(out)` als erste Zeile.
3. TSDoc beider Methoden: »With `out`, that array is emptied, filled and handed back — as
   `Map2DSpatialHashGrid#findWithin()` does —, so a caller that asks every frame keeps one
   array and the query allocates nothing.«

Specs:

- `ChunkQuadTreeNode.extended.spec.ts:593–601` wird zu
  `it('empties a caller-supplied output array before it fills it, as the spatial hash grid does')`
  — Sentinel ist weg, Ergebnis `['K', 'L', 'O', 'P']` (vor dem Fix rot, Sentinel bleibt).
- `:707–716` wird zu `test('findChunksAt(x, y, out) empties out, fills it and returns it')`
  — `ret === out`, Sentinel weg, `['S', 'T']` (vor dem Fix rot). Der Testname Z. 582
  (»appends into a caller-supplied output array«) sagt dann »fills«.
- `chunk-quad-tree/hot-path-allocations.spec.ts`: das `truncateArray(out)` in der Runde
  (Z. 33) und sein Kommentar (Z. 26–27) entfallen — die Abfrage leert selbst; den
  `truncateArray`-Import entfernen, wenn er unbenutzt ist.

### Schritt 7 — API-002: Faktoren und Zustand von `ChunkQuadTreeNode` nur lesbar

1. `static readonly IntersectDistanceFactor = Math.PI;` und
   `static readonly BeforeAfterDeltaFactor = Math.PI;`, je mit TSDoc, sinngemäß:
   - `IntersectDistanceFactor`: the weight of the chunks an axis cuts through in the score
     `subdivide()` picks the axis of a node by — the higher, the more an axis that cuts
     through chunks loses against one that passes between them. π.
   - `BeforeAfterDeltaFactor`: the weight of the difference between the share of the chunks
     before an axis and the share after it in that score — the higher, the more an axis that
     splits the chunks unevenly loses. π.
2. Zustand als private Felder `#originX: number | null = null`, `#originY …`,
   `#chunks: ChunkType[]` (im Konstruktor gesetzt wie heute), `#isLeaf = true`,
   `readonly #nodes: IChunkQuadTreeChildNodes<ChunkType> = {…}` — der Kommentar Z. 125–127
   bleibt bei den Origins. Getter mit TSDoc:
   - `originX`/`originY: number | null` — where the axis of this node lies, `null` on a leaf;
     `subdivide()` sets both, `clear()` takes both back.
   - `chunks: readonly ChunkType[]` — the chunks this node holds itself: every chunk on a
     leaf, the chunks that cross an axis on a node that is split; the array of the node,
     handed out read-only and without a copy — `appendChunk()`, `subdivide()` and `clear()`
     change it.
   - `isLeaf: boolean`.
   - `nodes: Readonly<IChunkQuadTreeChildNodes<ChunkType>>` — the four children, `null` where
     a quadrant holds no chunk, all four `null` on a leaf.
3. Jeder Zugriff innerhalb der Klasse geht über die privaten Felder: `subdivide()`,
   `makeChild()` (`child.#chunks = bucket` — erlaubt im Klassenrumpf), `appendChunk()`,
   `appendToNode()` (`this.#nodes[quadrant] = …`), `#collectChunks()`, `isNorthWest()` bis
   `isSouthWest()`, `findChunksAt()` (`node.#chunks`, `node.#isLeaf`, `node.#originX!`,
   `node.#nodes.northWest`). `chunk-quad-tree/hot-path-allocations.spec.ts` bleibt grün.
4. Der Lookbook (`QuadTreeVisualization.ts:80–110`) liest nur und compiliert unverändert
   (`pnpm typecheck` schließt `astro check` ein).

Tests in `ChunkQuadTreeNode.spec.ts`: ein Typfall mit `// @ts-expect-error` je Schreibzugriff
(`node.isLeaf = false`, `node.chunks = []`, `node.originX = 1`, `node.nodes.northEast = null`,
`ChunkQuadTreeNode.IntersectDistanceFactor = 1`) — vor dem Fix TS2578 im Typecheck, rot wie in
Paket 5 und 7. Dazu zur Laufzeit: das Schreiben eines Getter-Felds wirft im Strict Mode der
ES-Module — `expect(() => { (node as {isLeaf: boolean}).isLeaf = false; }).toThrow(TypeError)`
für `isLeaf`, `chunks`, `originX` (vor dem Fix kein Wurf — rot). `static readonly` ist nur
eine Typgrenze; dafür kein Laufzeittest.

### Schritt 8 — MEM-007: `DataIdsChunk2D` hält nur, was es braucht

1. `DataIdsChunk2D.ts`: `protected readonly data` entfällt. Neu:
   `readonly #width: number`, `readonly #height: number`, `#base64: string | undefined`
   (Kommentar: the base64 string up to the first read that decodes it, let go once the ids it
   holds are checked), `readonly #compression: unknown` (Kommentar: read off the params once,
   see `prepareData()`). Konstruktor: `super(data)`, Breite und Höhe übernehmen; mit
   `uint32Arr` wie heute `#uint32Data = this.#checkIds(uint32Arr)`, sonst
   `#base64 = data.data` und `#compression = (data as {compression?: unknown}).compression`.
   Kein Verweis auf `data` bleibt.
2. `#checkIds()` und `readDataIdAtLocal()` lesen `#width`/`#height`.
3. `protected prepareData(base64: string): Uint32Array` — Prüfung von `#compression` wie
   heute (Z. 50–56, Kommentar mitnehmen), dann `base64toUint32Arr(base64)`.
4. `protected get uint32Arr()`: ohne Cache `this.#uint32Data = this.#checkIds(this.prepareData(this.#base64 ?? ''))`,
   **danach** `this.#base64 = undefined` (Kommentar: the ids are checked and cached, the string
   they came from has served its purpose). Ein String, dessen Prüfung wirft, bleibt — der
   nächste Lesezugriff wirft wieder, wie der Spec Z. 39–51 verlangt. `?? ''`: ein Params-Objekt
   ohne `uint32Arr` und ohne `data` kommt nur aus JavaScript; die Längenprüfung weist es dann
   als `takes 4 ids, got 0` ab — kein `undefinedValueError`, das wäre ein gebrochener
   Invariant der Bibliothek für einen Fehler des Aufrufers.
5. Klassen-TSDoc: ein Satz, dass der Chunk weder das Params-Objekt noch, nach dem ersten
   erfolgreichen Lesen, den String hält.
6. `base64toUint32Arr.ts`: Modulkonstante
   `const HOST_IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;` mit
   Kommentar. Nach dem Byte-Puffer: `const len = bytes.byteLength >> 2;` und bei
   `isLittleEndian === HOST_IS_LITTLE_ENDIAN` `return new Uint32Array(bytes.buffer, 0, len)`
   (Kommentar: the bytes are in the order of the host already, so the array is laid over them
   without a copy; a trailing byte group shorter than 4 stays in the buffer and out of the
   array); sonst der heutige `DataView`-Weg. Der Kommentar zur kurzen Byte-Gruppe bleibt.
   Kein `@deprecated` hier — das macht Paket 13.

Tests:

- `DataIdsChunk2D.spec.ts`, neu
  `test('holds on to neither its params nor its base64 string once the first read has decoded it', async () => …)`
  nach dem Muster von `Map2DTileStreamer.spec.ts:784–809` (`globalThis.gc`, WeakRef in eigenem
  Scope, `await new Promise((resolve) => setTimeout(resolve, 0))`, `gc()`): Params
  `{x: 0, y: 0, width: 2, height: 2, data: 'AQAAAAIAAAADAAAABAAAAA=='}`, ein Lesen →
  `ref.deref()` ist `undefined`, der Chunk liest weiter `1` bei `(0, 0)`. Derselbe Fall mit
  `uint32Arr`-Params. Vor dem Fix hält `data` die Params — rot.
- `DataIdsChunk2D.spec.ts`, neu: eine Unterklasse, die `prepareData(base64)` überschreibt,
  bekommt den String der Params als Argument (Charakterisierung des geschützten Vertrags).
- `base64toUint32Arr.spec.ts`, neu
  `test('lays the array over the decoded bytes when their order is the host\'s')`:
  `base64toUint32Arr('AQAAAAkJ').buffer.byteLength` ist `6` (die dekodierten Bytes; vor dem
  Fix `4` — rot), mit `false` ist er `4` (Kopie). Die bestehenden Fälle bleiben grün.

### Schritt 9 — Guide, Architektur, CHANGELOG

`packages/twopoint5d/docs/map2d.md` (der Guide beschreibt den Code, wie er ist — kein
Rückblick):

- Z. 23–25 (Satz zu `RepeatingTilesProvider`): anhängen, dass `getTileIdAt()` und
  `getTileIdsWithin()` Koordinaten und Anzahlen als ganze Zahlen nehmen — Breite und Höhe 0
  oder mehr — und für alles andere einen `RangeError` werfen.
- »A map in a rectangle«, nach Z. 116: ein Satz — a rectangle that covers more than
  `maxVisibleTiles` tiles of the grid, 10 000 unless set, throws a `RangeError` on the next
  `update()` before it builds a tile: make the area smaller or the tiles larger, or raise the
  limit.
- Defaults-Tabelle (Z. 120–132): neue Zeile nach `RectangularVisibilityArea` —
  `RectangularVisibilityArea#maxVisibleTiles` | `10 000` | the most tiles the rectangle may
  cover on the grid; a larger one throws a `RangeError` on the next `update()`. 320 × 240 on
  the default grid of 1 covers 76 800 — set the tile size or the area. In der Zeile
  `Map2D#xOffset, #yOffset` »a finite number« ergänzen.
- »Changing a map while it runs«, Punkt »The visibilitor« (Z. 143–145): »… the next `update()`
  empties every tile renderer — its tiles leave the screen with that update — and, …«.

`packages/twopoint5d/docs/architecture.md` §2 `map2d/`: Z. 219 »`RectangularVisibilityArea`
uses a plain rectangle of at most `maxVisibleTiles` tiles«; Z. 229–230 nach »the spatial
indexes tile providers query«: »; both empty an `out` array before they fill it«.

`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` (Skill `updating-changelog`), jeder
Bruch mit **BREAKING**-Marke und Eintrag im Migration Guide; Codeblöcke, die für sich
stehen, als `ts check`:

- `### Added`: `RectangularVisibilityArea#maxVisibleTiles` (Vorgabe 10 000) und
  `Map2DSpatialHashGrid#maxCellsPerRenderable` (Vorgabe 65 536) — je mit dem, was über der
  Grenze geschieht (**BREAKING**: ein Bereich über 10 000 Tiles bzw. ein Renderable über
  65 536 Zellen, die bisher liefen, werfen). Migration Guide: »A RectangularVisibilityArea
  over more than 10 000 tiles« und »A renderable of the spatial hash grid over more than
  65 536 cells« — je Before/After mit dem Anheben der Grenze oder größeren Kacheln.
- `### Changed`:
  - `ChunkQuadTreeNode#findChunks()` und `#findChunksAt()` leeren `out`, bevor sie es füllen,
    wie `Map2DSpatialHashGrid#findWithin()`/`#getTiles()` (**BREAKING**). Migration: »The
    out array of the chunk queries« — wer über mehrere Abfragen sammelt, hängt das Ergebnis
    an eine eigene Liste an.
  - `ChunkQuadTreeNode.IntersectDistanceFactor`/`BeforeAfterDeltaFactor` sind `static
    readonly`; `originX`, `originY`, `isLeaf`, `chunks` (`readonly ChunkType[]`) und `nodes`
    (`Readonly<IChunkQuadTreeChildNodes>`) nur lesbar (**BREAKING**). Migration: »The state
    of a ChunkQuadTreeNode« — den Baum über Konstruktor, `appendChunk()`, `subdivide()` und
    `clear()` bauen.
  - `RepeatingTilesProvider#getTileIdAt()` und `#getTileIdsWithin()` werfen `RangeError` für
    eine Koordinate, die keine ganze Zahl ist, und eine Breite oder Höhe, die keine ganze Zahl
    von 0 oder mehr ist.
  - `Map2D`, `Map2DTileStreamer`, `Map2DTileCoordsUtil` und `Map2DSpatialHashGrid` werfen
    `RangeError` für ein `xOffset`/`yOffset` und `Map2D`/`Map2DTileStreamer` für ein
    `centerX`/`centerY`, das keine endliche Zahl ist — in Setter und Konstruktor; die Setter
    von `Map2D` nennen `Map2D` als Subjekt, auch für `tileWidth`/`tileHeight`.
  - `DataIdsChunk2D` hält weder sein Params-Objekt noch, nach dem ersten erfolgreichen
    Lesen, den base64-String; `protected data` entfällt, `prepareData()` bekommt den String
    als Argument (**BREAKING** für Unterklassen). Migration: »A subclass of DataIdsChunk2D«
    — Before `protected override prepareData() { … this.data … }`, After
    `protected override prepareData(base64: string) { … }`.
  - perf `Map2DSpatialHashGrid#findWithin()`/`#getTiles()` über mehr Zellen, als das Gitter
    belegt, laufen über die belegten Zellen.
  - perf `base64toUint32Arr()` legt das Array ohne Kopie über die dekodierten Bytes, wenn die
    verlangte Byte-Reihenfolge die des Hosts ist.
- `### Fixed`: `Map2DTileRenderer#clearTiles()` bringt die Factory selbst auf Stand —
  `Map2D#visibilitor = undefined`, `Map2D#clearTiles()` unter einem Visibilitor ohne
  Antwort und `Map2DTileStreamer#removeTileRenderer()` lassen kein Tile mehr gezeichnet
  stehen bis zum nächsten Zyklus.

## Rückgabe des Implementierers

Wie im Brief: Status, Dateien, je Regressionstest der rote Lauf, Verify, Abweichungen,
Nebenbefunde (in den geänderten Dateien gelesen), Folgen mit Datei und Zeile. Ausdrücklich zu
melden: ob ein Allokations-Spec in `src/map2d/` durch die neuen Getter gestiegen ist, mit den
gemessenen Bytes.

## Findings im Volltext

**BUG-002 · medium · packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:228** (auch `Map2DTileStreamer.ts:241`, `:254`, `Map2DTileRenderer.ts:198`) — Geleerte Tile-Renderer im Streamer ohne Upload lassen nicht mehr stehen
`Map2DTileStreamer#update()` ruft bei einem anstehenden Clear `tileRenderer.clearTiles()` und kehrt danach ohne Visibilitor (Zeile 241) oder bei `computeVisibleTiles() === undefined` (Zeile 254) zurück. `Map2DTileRenderer#clearTiles()` gibt die Slots nur CPU-seitig per `destroyTile()` zurück; `instanceCount`, Draw-Range und Buffer-Upload gleicht erst `TileSpritesFactory#update()` ab, und die läuft nur aus `endUpdatingTiles()`, das in diesem Zweig nie kommt. Folge: `map.visibilitor = undefined` (laut TSDoc »the next update empties every tile renderer«) und `Map2D#clearTiles()` ohne Visibilitor lassen die alten Tiles weiter zeichnen, solange niemand `tileSprites.update()` selbst aufruft. Die Spec prüft nur `renderer.held.size` an einem Fake-Renderer, nicht den Upload.
Beleg: `VertexObjects#update()` TSDoc: »syncs the draw range and the instance count«; `InstancedVOBufferGeometry.ts:550` setzt `instanceCount = usedCount` nur in `update()`.
Empfehlung: Nach dem Clear-Zweig jeden geleerten Renderer einen leeren Zyklus (`beginUpdatingTiles()` + `endUpdatingTiles()`) laufen lassen oder `Map2DTileRenderer#clearTiles()` außerhalb eines Zyklus die Factory per `update()` abgleichen lassen; Test mit echter `TileSpritesFactory` ergänzen, der `instanceCount === 0` nach `visibilitor = undefined` prüft.

**PERF-001 · medium · packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:100** (auch `:213`, `:233`) — Kosten von Map2DSpatialHashGrid an die belegten Zellen statt an die Abfragefläche binden
`add()`, `#collect()` und `#gather()` laufen über jede Zelle des Rechtecks (`rows * columns` Hash-Lookups bzw. Zell-Allokationen), egal wie viele Zellen belegt sind. `assertFiniteAABB()` fängt nur Infinity/NaN ab: ein endliches, aber sehr großes `aabb` (Weltrechteck bei kleiner Tile-Größe, etwa 1e6 × 1e6 Zellen) lässt `add()` Millionen `Set`s anlegen und `findWithin()`/`getTiles()` auf einem fast leeren Gitter praktisch hängen. Es gibt kein Limit und keine Warnung.
Empfehlung: In den Abfragen die Zellzahl gegen `#cells.size` halten und bei größerem Bereich über die belegten Zellen bzw. `#placements` iterieren; für `add()` eine dokumentierte Obergrenze der Zellzahl pro Renderable mit `RangeError` einführen.

**PERF-003 · low · packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:196** (auch `:224`, `:97`) — Obergrenze für die Tile-Zahl in `RectangularVisibilityArea` einführen
Die Setter für `width`/`height` akzeptieren jede endliche Zahl über 0. `computeVisibleTiles()` legt `Uint8Array(rows * columns)` an und erzeugt pro Tile ein `Map2DTileCoords` samt `AABB2`. Bei breitem Bereich und kleiner Tile-Größe (etwa 1e5 × 1e5 Tiles) wirft das mitten im Frame einen `RangeError` des Typed-Array-Konstruktors oder erschöpft den Speicher; `CameraBasedVisibility` hat dagegen `maxVisibleTiles` samt Warnung.
Empfehlung: Ein `maxTiles`-Limit (mit Subjekt-Präfix-Fehler) oder zumindest eine einmalige Warnung einführen, die die Zahl der Tiles prüft, bevor die Allokation passiert.

**BUG-014 · low · packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:162** (auch `:104`) — Ganzzahligkeit der Argumente von `getTileIdsWithin()` und `getTileIdAt()` prüfen
Das Interface verlangt Ganzzahlen in Tile-Space, `getTileIdsWithin()` prüft aber weder `left`/`top` noch `width`/`height`. NaN als Breite liefert ein leeres `Uint32Array` ohne Fehler; Bruchteile in `left` lassen `row[col]` mit `undefined` indizieren und schreiben stillschweigend 0; ein negatives `width` wirft einen Typed-Array-`RangeError` ohne Subjekt-Präfix. `getTileIdAt()` liefert bei einem gebrochenen `col` `undefined` trotz Rückgabetyp `number`.
Empfehlung: Die vier Argumente mit `assertFinite()` plus Ganzzahl-Prüfung (Subjekt `RepeatingTilesProvider#getTileIdsWithin()`) abfangen, `getTileIdAt()` analog.

**CONS-001 · low · packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:305** (auch `:342`, `Map2DSpatialHashGrid.ts:209`) — Semantik des `out`-Parameters der räumlichen Abfragen vereinheitlichen
`ChunkQuadTreeNode#findChunks()`/`findChunksAt()` hängen an ein übergebenes `out` an, ohne es zu leeren; `Map2DSpatialHashGrid#findWithin()`/`getTiles()` leeren `out` zuerst (`truncateArray`). Beide sind Spatial-Index-Abfragen derselben Modul-Familie mit identischem Zweck (Array pro Frame wiederverwenden); wer von einem zum anderen wechselt, bekommt entweder Altlasten oder verlorene Einträge.
Empfehlung: Eine Semantik wählen (empfohlen: leeren, wie das Hash-Grid) und im anderen Index anpassen oder in beiden TSDocs prominent gegenüberstellen; Breaking-Change im Changelog vermerken.

**API-002 · low · packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:107** (auch `:128`, `:131`) — Statische Tuning-Faktoren und offenen Zustand von `ChunkQuadTreeNode` kapseln
`IntersectDistanceFactor` und `BeforeAfterDeltaFactor` sind öffentliche, beschreibbare Statics ohne TSDoc und ohne Validierung: eine Zuweisung ändert den Aufbau jedes Baums im Prozess und kann `distance` zu NaN machen, womit `subdivide()` nichts mehr teilt. `originX`, `originY`, `isLeaf`, `chunks` und `nodes` sind ebenfalls öffentlich schreibbar, obwohl `findChunks()`/`appendChunk()` ihre Invariante (nicht-Leaf trägt beide Origins) mit `!` voraussetzen.
Empfehlung: Die Faktoren als `static readonly` oder als Option von `subdivide()` führen und dokumentieren; Zustand als `readonly` bzw. über Getter freigeben.

**MEM-007 · low · packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts:65** (auch `DataIdsChunk2D.ts:34`, `base64toUint32Arr.ts:11`) — Dekodierte Chunk-Daten ohne den base64-String vorhalten
Nach dem ersten Lesen hält `DataIdsChunk2D` den base64-String (`this.data.data`, rund 5,3 Byte pro Tile) und das decodierte `Uint32Array` (4 Byte pro Tile) gleichzeitig; bei Karten mit vielen Chunks kostet das etwa das 2,3-fache des nötigen Speichers. `base64toUint32Arr()` kopiert zudem elementweise per `DataView`, wo auf Little-Endian-Plattformen ein `Uint32Array` direkt über dem Byte-Puffer genügt.
Empfehlung: Den Params-Verweis auf den String nach dem Decodieren freigeben (Konstruktor kopiert nur, was nötig ist) und für `isLittleEndian` auf Little-Endian-Hosts das Array über den Puffer legen.

**BUG-021 · low · packages/twopoint5d/src/stage/StageRendererTargets.ts:136** (Map2D-Teil: `Map2DTileCoordsUtil.ts:104`, `:121`, `Map2DTileStreamer.ts:125`, `:142`, `:40`, `Map2DSpatialHashGrid.ts:70`; der Stage-Teil `StageRendererTargets.ts:136`, `Canvas2DStage.ts:114`, `:183` ist mit Paket 5 erledigt) — Zahlen an öffentlichen Stage- und Map2D-Einstiegen mit `assertFinite()` prüfen
`#deviceSize()` soll mit `Math.max(1, …)` eine Mindestgröße sichern, aber `Math.max(1, NaN)` ist `NaN`: ein `StageRenderer#resize(NaN, …)` (öffentlich) führt zu `rt.setSize(NaN, NaN)` bzw. `new RenderTarget(NaN, …)` und erst die GPU meldet den Fehler. `Canvas2DStage` übernimmt Breite und Höhe in Konstruktor und `setCanvasSize()` ungeprüft: `0`, negative Werte oder `NaN` landen im Canvas (als 0), im Sprite-Scale (`NaN`) und in den View-Specs, und der erste Upload versucht eine Textur ohne Fläche. `Stage2D` und die Projektionen behandeln solche Werte dagegen ausdrücklich.
Beleg: `return Math.max(1, Math.floor(size * this.#pixelRatio));`
Empfehlung: In `Canvas2DStage` (Konstruktor, `setCanvasSize()`) Breite und Höhe über `assertPositiveFinite()` aus `src/utils/` prüfen; in `#deviceSize()` nicht-endliche Werte wie 0 behandeln (`isPositiveFinite(size) ? … : 1`) oder `StageRenderer#resize()` dieselbe Regel wie `Stage2D` geben.
Für dieses Paket gilt der Map2D-Teil aus dem Plan: `xOffset`/`yOffset` von `Map2DTileCoordsUtil` (öffentliche Felder, Z. 104/111), die Setter `xOffset`/`yOffset` von `Map2DTileStreamer` (Z. 125/142), die Konstruktor-Offsets von `Map2DSpatialHashGrid` (Z. 70) sowie `centerX`/`centerY` von `Map2DTileStreamer` (öffentliche Felder, Z. 40/47) über `assertFinite()` prüfen — dieselbe Art Prüfung wie BUG-014.

## Urteil des Reviewers

Aus `paket-8.review-0.json` (Gesamtdiff) und `paket-8.review-1.json` (Nachbesserung Runde 2), Commit d6b71005:

- BUG-002 — erfüllt: `Map2DTileRenderer.ts` `#giveBackTiles()`/`#uploadWrites()` (Z. 215–257), `clearTiles()` lädt selbst (Z. 211–217), `beginUpdatingTiles()` (Z. 99–103) und `dispose()` (Z. 276–279) ohne Upload; TSDoc `types.ts:150–153`; Tests in `Map2DTileRenderer.spec.ts`, `TileSpritesFactory.spec.ts`, `map2d-tile-upload.test.js:117–135`
- PERF-001 — erfüllt: `Map2DSpatialHashGrid.ts` `#occupied` mit Swap-Remove, `#collect()`/`#gather()` über die belegten Zellen, `maxCellsPerRenderable`
- PERF-003 — erfüllt: `RectangularVisibilityArea.ts:217–235` `maxVisibleTiles`, Prüfung vor dem ersten Schreiben; Gitterwechsel einer Abweisung über `#gridChangeRefused` (Runde 2)
- BUG-014 — erfüllt: `RepeatingTilesProvider.ts:17–25` `assertWholeNumber()`, Guide `map2d.md:21–22`
- CONS-001 — erfüllt: `ChunkQuadTreeNode.ts:353–418` leert `out`, `#collectChunks()`; Specs umgestellt, `architecture.md` §2
- API-002 — erfüllt: `ChunkQuadTreeNode.ts:113–179` `static readonly`, Zustand hinter Gettern; Lookbook-Regler entfernt
- MEM-007 — erfüllt: `DataIdsChunk2D.ts:31–87`, `base64toUint32Arr.ts:2–17`
- BUG-021 (Map2D-Teil, verkleinert) — erfüllt: Konstruktor `Map2DTileCoordsUtil` (Z. 131–132), `Map2DTileStreamer` Center/Offsets (Z. 26–78, 199–200), `Map2DSpatialHashGrid`-Konstruktor, `Map2D` sechs Setter; Setter von `Map2DTileCoordsUtil#xOffset`/`yOffset` → Paket 9

Kleine Befunde (keine Runde):

- `Map2DSpatialHashGrid#add()` — `#cellsOf()` läuft je Renderable zweimal (Prüfschleife und Einsortieren); harmlos, doppelte Rechnung
- `RectangularVisibilityArea.spec.ts` (`describe('maxVisibleTiles')`) — zwei Pfade des Merkers `#gridChangeRefused` ohne Test: Rückkehr zu Gitter A nach Abweisung auf B, Ab- und Wiedereinschalten (`width = 0`) zwischen Abweisung und nächstem Rechnen
- `RepeatingTilesProvider.ts` `getTileIdsWithin()` — Subjekt der `target`-Meldung (`RepeatingTilesProvider:`) weicht von den neuen Meldungen desselben Aufrufs ab; als Folge im Plan

Abweichungen vom Detailplan (Implementierer, akzeptiert): Lookbook `quadtree-playground.astro`/`_quadtree-playground.json` verlieren die Regler der Tuning-Faktoren (Demo schrieb sie, `static readonly` bricht das mit TS2540) · der rote Lauf der großen Grid-Abfrage hing statt in die 2-s-Frist zu laufen (synchrone Schleife), nach 300 s abgebrochen · die `prepareData(base64)`-Unterklasse war vor dem Fix rot, keine Charakterisierung · `maxVisibleTiles`-Setter hebt `needsUpdate` nur bei neuem Wert · der Vergleich im Regressionstest von Runde 2 nimmt ein frisches Area mit `[]` statt `T`.

Nebenbefunde (Urteile im Plan unter »Offene Befunde«): `RectangularVisibilityArea.ts:180–181` ungeprüftes `centerPoint` und `:204–210` Cache-Pfad ignoriert `previousTiles` — beide am Laufbeginn schon so, Scope-Regel »alles« → `→ Scope`.
