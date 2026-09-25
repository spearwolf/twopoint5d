# Remediation-Plan — twopoint5d (Feature map2d)

Quelle: ./audit.html vom 2026-09-25 · Branch: main · erstellt: 2026-09-25
Baseline: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser — alles grün)
Verify-Gate je Paket: `pnpm run ci`
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/387fd4e2-8d90-4d45-ac3c-b786b7534925/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 34 von 145 Findings — alle des Features map2d (2 medium, 16 low, 16 info), davon 2 aus dem Optimierungspotenzial (PERF-026, PERF-028) · ausgenommen: alle Findings anderer Features und projektweite Findings, acknowledged
Scope-Regel: alles aus dem Feature map2d — Komponente `map2d` oder Location unter `packages/twopoint5d/src/map2d/`, den map2d-Browsertests oder den map2d-Demos der Lookbook —, jede Severity einschließlich info und Optimierungspotenzial. Nebenbefunde in map2d, vertex-objects oder sprites → Scope; Nebenbefunde anderswo → Audit. Folgen dieses Laufs werden immer hier behoben, gleich in welchem Modul.
Kaltstarts: 5 Pakete × mindestens 3 Agenten ≈ 15, je Nachrunde zwei mehr · 6,8 Findings je Paket
Stand (2026-09-25): Lauf abgeschlossen — 7 Pakete committet (c152bab6 … 480b8fc3), nichts blockiert, »Offene Befunde« leer; audit.html nachgeführt, Report in docs/remediation/20260925-map2d-remediation-report.md

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` blockiert.

## Entscheidungen
- API-051: `CameraBasedVisibility` ruft `camera.updateProjectionMatrix()` nicht mehr selbst; die Projektion verantwortet der Aufrufer (TSDoc, CHANGELOG, Migrationshinweis). `map2dTileCoords` wird nur lesend exponiert. Eigene Aufrufer (Lookbook, Browsertests, Specs) zieht der Lauf mit. (2026-09-25)
- BUG-103: Die Rechnung wird korrigiert — jede Seite wächst um `(scale − 1) / 2 · size`, wie die TSDoc es verspricht; der Default bleibt 1,1. Die sichtbare Tile-Menge am Rand wird dadurch etwas kleiner; CHANGELOG nennt das. (2026-09-25)
- API-057: `IMap2DVisibilitorHelpers` bekommt kein `isDisposed`. Die Interface-TSDoc hält fest, dass nach `dispose()` alle Member stille No-Ops sind und das Interface den Zustand deshalb bewusst nicht exponiert. (2026-09-25)
- PERF-019: Die Präfixsummen werden umgesetzt, `scoreAxis` wird O(1) je Kandidat — kein »so lassen«, Ziel ist ein map2d ohne offene Findings. (2026-09-25)
- PERF-026: `IMap2DVisibleTiles#changed` meldet nur noch einen Grid-Wechsel (neue `view` der Tiles), nicht jeden Frame bei bewegter Kamera; die TSDoc des Felds sagt das, CHANGELOG nennt die Änderung für eigene Tile-Renderer. (Ansage, 2026-09-25)
- IMPL-010: Der Parameter `compression`, der immer wirft, verschwindet aus dem öffentlichen Typ; CHANGELOG nennt es. (Ansage, 2026-09-25)
- BUG-104: Mindestens eine Zelle je Renderable und die gehashten Keys je Renderable merken, damit `remove()` nicht von einer seither mutierten AABB abhängt — keine neue `update()`-Methode. (Ansage, 2026-09-25)
- IMPL-001 (projektweit, außerhalb des Scopes) hat eine Stelle in map2d (`chunk-quad-tree/DataIdsChunk2D.ts:39`). Sie wird mit IMPL-010 in Paket 4 aufgeräumt; das Finding bleibt offen, weil seine übrigen Stellen außerhalb liegen, und wird im Audit um diese Stelle gekürzt. (Ansage, 2026-09-25)

## Konventionen
Gelten für jede Zeile, die in diesem Lauf entsteht — Code, Kommentare,
Dokumentation, CHANGELOG, Migrations-Hinweise, Commit-Messages:
- Inline-Kommentare sind erwünscht, wo sie erklären, *warum* etwas so ist.
- Keine Finding-IDs, auch nicht in der Commit-Message. Sie gehören diesem einen
  Audit, sind danach tot, und die Commit-Message überdauert den Lauf. Sie leben
  in diesem Plan und sonst nirgends; die Verbindung zwischen Finding und Commit
  trägt das Feld `Hash:` unter dem Paket — in genau der Richtung, in der jemand
  sie später sucht. Eine Commit-Message sagt in eigenen Worten, was sie ändert.
- Kein Rückblick auf den Vorzustand: kein »früher«, kein »statt bisher«, kein
  »im Zuge des Audits umgestellt«. Der Test: Ergibt der Satz für jemanden Sinn,
  der den Vorzustand nie gesehen hat? Dann bleibt er. Braucht er ihn, gehört er
  in die Commit-Message — die Historie ist bereits konserviert.
- Code, Kommentare und Doku auf Englisch; Commits nach Conventional Commits im Stil von `git log` (`fix(map2d): …`).
- `AGENTS.md` im Repo-Root vor der ersten Änderung lesen. Module ganz lesen (`cat src/map2d/*.ts`), nicht Symbol für Symbol greppen.
- Änderungen an Rendering- oder GPU-Buffer-Code brauchen beide Testflächen: `*.spec.ts` (Vitest) und `packages/twopoint5d-testing/test/*.test.js` (Browser). Geteilte Browser-Fixtures gehören nach `test/helpers/fixtures.js`.
- Öffentliche API-Änderungen landen unter `Unreleased` in `packages/twopoint5d/CHANGELOG.md` (Skill `updating-changelog`), mit Migrationshinweis, wo ein Aufrufer Code anfassen muss.
- `dispose()` und Ownership folgen `packages/twopoint5d/docs/resource-lifecycle.md`.

## Vorbestehende Fehler
- keine — die Baseline ist vollständig grün

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

## Pakete

### [x] 1. Tile-Lebenszyklus zwischen Map2D, Streamer, Renderer und TileSpritesFactory
- Findings: BUG-102 (medium), BUG-123 (low), CONS-052 (low), API-055 (low), TEST-015 (low), DOC-048 (info)
- Ziel: Kein Tile, kein Pool-Slot und kein Visibilitor geht beim Ab- und Anhängen von Renderern, beim Streamer-Wechsel oder durch ein falsy Tile-Handle verloren, und `TileSpritesFactory` ist mit echten Pools per Spec abgesichert.
- Bereich: `packages/twopoint5d/src/map2d/` — `Map2D.ts`, `Map2DTileStreamer.ts`, `Map2DTileRenderer.ts`, `types.ts`, `TileSprites/TileSpritesFactory.spec.ts`, `chunk-quad-tree/base64toUint32Arr.spec.ts` (neu), zugehörige Specs, CHANGELOG
- Detail: docs/remediation/paket-1.md
- Hängt ab von: —
- Hash: c152bab6
- Ergebnis: 1 Runde · BUG-102, BUG-123, CONS-052, API-055, TEST-015, DOC-048 behoben (Reviewer: freigeben) · Regressionstests, vor dem Fix rot: `removeTile() gives a tile 0 back to the factory`, `reuseTile() leaves a tile 0 alone while the signal says nothing changed` (Map2DTileRenderer.spec), `gives the tiles back that the streamer laid out in the renderer it lets go` (Map2DTileStreamer.spec), `a renderer taken off and added again holds only the tiles of the view it comes back to`, `has every tile renderer give back the tiles laid out in it`, `the streamer that leaves gives up the visibilitor the map hands on` (Map2D.spec) · klein: zwei Befunde im CHANGELOG, siehe Paketdatei
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `Map2DTileStreamer#removeTileRenderer()` (und damit `Map2D#removeTileRenderer()`, `Map2D#dispose()`) ruft `clearTiles()` am abgehängten Renderer, wenn der Streamer ihn hielt — ein abgehängter Renderer ist leer · Setter `Map2D#tileStreamer` nimmt dem gehenden Streamer den Visibilitor ab (`previous.visibilitor = undefined`), falls die Map einen hat; sonst behält der übernehmende seinen eigenen · Signaturen unverändert

### [x] 2. CameraBasedVisibility: Frustum-Box, Kamera-Vertrag, Upload-Last
- Findings: PERF-026 (medium, Optimierungspotenzial), API-051 (low), API-037 (low), BUG-103 (low), PERF-028 (info, Optimierungspotenzial), TYPE-011 (info), DOC-024 (info)
- Ziel: Die Sichtbarkeitsberechnung rechnet die Frustum-Box wie dokumentiert, fasst die Kamera des Aufrufers nicht an, allokiert pro Frame nichts Neues und löst bei bewegter Kamera keinen Voll-Upload der Instanzattribute mehr aus.
- Bereich: `packages/twopoint5d/src/map2d/` — `CameraBasedVisibility.ts`, `RectangularVisibilityArea.ts`, `types.ts` (`IMap2DVisibleTiles`, `IMap2DTileRenderer`, `IMap2DVisibilitor`), `Map2DTileStreamer.ts`, `Map2DSpatialHashGrid.ts` (`findWithin` mit `out`), `TileSprites/TileSpritesFactory.ts` (`updateTile()`, `update()`), zugehörige Specs, `map2d-tile-upload.test.js`, Lookbook-Demo `map2d-cam-visi.ts`, CHANGELOG
- Detail: docs/remediation/paket-2.md
- Hängt ab von: 1 (TileSpritesFactory-Spec als Sicherungsnetz für den Umbau von `update()`)
- Hash: 8720c67a
- Ergebnis: 2 Runden · PERF-026, API-051, API-037, BUG-103, PERF-028, TYPE-011, DOC-024 behoben (Reviewer: freigeben) · Regressionstests, vor dem Fix rot: `the frustum box of a tile is frustumBoxScale times the tile, around the tile`, `leaves the projection matrix of the camera as the caller set it`, `says changed on the first result and on a new grid, not for a moved view` (CameraBasedVisibility.spec), `a frame that moves one tile uploads the slot of that tile and no other`, `update() with nothing written sends nothing to the gpu` (TileSpritesFactory.spec), `a view center that moves within the tiles it shows has the renderer write no tile` (Map2DTileStreamer.spec), Browsertest `a frame that moves the view within the tiles it shows touches no tile attribute buffer` (map2d-tile-upload) · Runde 2 nur Text: Kommentar `Map2DTileRenderer.ts:103-104`, Achsen im CHANGELOG-Fixed-Eintrag, zwei kleine
- Nebenbefunde: keine neuen (gemeldet `Map2DSpatialHashGrid.ts` `remove()` mit mutierter AABB = BUG-104, liegt in Paket 3)
- Folgen: keine
- Schnittstellen: `Map2DSpatialHashGrid#findWithin(aabb, out?)` und `#getTiles(tileX, tileY, width?, height?, out?)` als Überladungen — mit `out` wird das Set geleert, gefüllt und zurückgegeben (nie `undefined`), ohne `out` wie bisher neues `Set` oder `undefined` · `CameraBasedVisibility#map2dTileCoords` nur noch Getter auf eine eigene Kopie des Rasters des letzten Aufrufs · `CameraBasedVisibility` ruft `camera.updateProjectionMatrix()` nicht mehr, `updateMatrixWorld()` weiter · `IMap2DVisibleTiles#changed` ist `true` nur beim ersten Ergebnis einer Instanz und bei Rasterwechsel · beide Visibilitors geben bei jeder Neuberechnung dasselbe Ergebnisobjekt und dieselben Listen zurück, `previousTiles` darf das eigene letzte `tiles` sein · `Map2DTileStreamer` reicht ein wiederverwendetes `centerPoint`-Tupel · `TileSpritesFactory#updateTile()` markiert den Slot des Tiles im Pool, `update()` bestellt keinen Voll-Upload mehr

### [x] 3. Spatial-Hash-Grid, Tile-Koordinaten und RectangularVisibilityArea
- Findings: BUG-104 (low), CONS-053 (low), TEST-028 (low), DOC-029 (low), TYPE-017 (info), CONS-049 (info), API-057 (info), DOC-051 (info), TYPE-018 (info)
- Nebenbefund aufgenommen: `CameraBasedVisibilityHelpers.ts:100-101` — TSDoc an `show` verschweigt die Szenen-Bedingung wie DOC-051 (vorbestehend seit 9a97f1bc, gleiche Ursache)
- Ziel: Das Grid verliert keine Punkt-Renderables und keine mutierten AABBs, Maße werden überall gleich validiert, und TSDoc und Typen von Koordinaten-Util und Visibility-Helfern sagen, was der Code tut.
- Bereich: `packages/twopoint5d/src/map2d/` — `Map2DSpatialHashGrid.ts`, `Map2DTileCoordsUtil.ts`, `RectangularVisibilityArea.ts`, `RectangularVisibilityAreaHelpers.ts`, `CameraBasedVisibilityHelpers.ts` (TSDoc von `show`), `types.ts`, zugehörige Specs, `CHANGELOG.md` (Fixed, Changed, Migration Guide)
- Detail: docs/remediation/paket-3.md
- Hängt ab von: 2 (`Map2DSpatialHashGrid.findWithin` bekommt dort seinen `out`-Parameter)
- Hash: 18b31272
- Ergebnis: 1 Runde · BUG-104, CONS-053, TEST-028, DOC-029, TYPE-017, CONS-049, API-057, DOC-051, TYPE-018 und der aufgenommene Nebenbefund an `CameraBasedVisibilityHelpers.ts` `show` behoben (Reviewer: freigeben, keine Befunde) · Regressionstests, vor dem Fix rot: `a renderable of zero size on a cell border lies in the cell of its corner`, `remove() takes a renderable out of the cells it was added to after its aabb changed`, `adding a renderable again moves it to the cells of its aabb now`, `findWithin() with an aabb of zero size looks into the cell its corner lies in` (Map2DSpatialHashGrid.spec), `describe('width and height')` mit Konstruktor- und Setter-Fällen für `-1`, `NaN`, `Infinity`, `-Infinity` (RectangularVisibilityArea.spec, 10 rot)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `Map2DSpatialHashGrid#add()` eines gehaltenen Renderables verschiebt es in die Zellen seiner aktuellen `aabb` · `#remove()` liest die `aabb` nicht mehr, nimmt aus den beim `add()` gemerkten Zellen · jedes Renderable und jede `findWithin()`-Abfrage belegt mindestens die Zelle der linken oberen Ecke (auch bei Breite oder Höhe 0) · `RectangularVisibilityArea` wirft `RangeError` für `width`/`height` außer 0 und endlich > 0, aus Konstruktor und Settern, der alte Wert bleibt · `Map2DTileCoordsUtil#getTileCoords()` unverändert · Signaturen unverändert

### [x] 4. Datenprovider: ChunkQuadTree und RepeatingTilesProvider
- Findings: PERF-027 (low), PERF-019 (info), IMPL-010 (info), READ-012 (low), DOC-036 (low), CONS-037 (info)
- Ziel: Nachgeladene Chunks bleiben unterteilbar, `subdivide()` bewertet Kanten über Präfixsummen, der chunk-quad-tree trägt keinen toten Code mehr, und `RepeatingTilesProvider` schreibt Zeilen über einen einzigen Wrap-Pfad.
- Bereich: `packages/twopoint5d/src/map2d/chunk-quad-tree/` (`ChunkQuadTreeNode.ts`, `DataIdsChunk2D.ts`, `IDataChunk2D.ts` samt Specs), `RepeatingTilesProvider.ts` samt Spec, `CHANGELOG.md` (Changed, Removed, Migration Guide)
- Detail: docs/remediation/paket-4.md
- Hängt ab von: —
- Hash: 584a675d
- Ergebnis: 2 Runden (Runde 1 nur eine CHANGELOG-Zeile ohne Vorzustand) · PERF-027, PERF-019, IMPL-010, map2d-Stelle von IMPL-001, READ-012, DOC-036, CONS-037 behoben (Reviewer: freigeben) · Regressionstests, vor dem Fix rot: `splits the leaves appendChunk() has filled since the node was split`, `passes maxChunkNodes on to the leaves it splits` (ChunkQuadTreeNode.extended.spec), `refuses a uint32Arr that does not hold width × height ids`, `refuses base64 data that does not hold width × height ids on the first read` (DataIdsChunk2D.spec), `leaves the cells past width × height of a longer target as they are`, `refuses a target shorter than width × height` (RepeatingTilesProvider.spec, 5 Fälle rot) · Charakterisierungstest `axis choice` vor und nach dem Umbau grün · `subdivide(8)` auf 20k Chunks 26,4 s → 0,11 s · klein: zwei Befunde, siehe Paketdatei
- Nebenbefunde: → Queue (Endlosrekursion in `subdivide()` bei Chunks ohne Ausdehnung)
- Folgen: keine
- Schnittstellen: `ChunkQuadTreeNode#subdivide(maxChunkNodes)` auf einem inneren Knoten reicht an die Kinder weiter, `appendChunk()` teilt weiter nichts selbst · `StringDataIdsChunk2DParams` ohne `compression` (Laufzeitprüfung für untypisierte Daten bleibt, wirft `Error` beim ersten Lesen) · `DataIdsChunk2D` wirft `RangeError` bei `ids.length !== width * height` (Konstruktor für `uint32Arr`, erstes Lesen für `data`) · `RepeatingTilesProvider#getTileIdsWithin()` wirft `RangeError` für `target.length < width * height` und schreibt nur die ersten `width * height` Zellen · `#writePatternRow` ersetzt durch privaten `#writeRow`, modulinternes `wrap()` · sonst Signaturen unverändert

### [x] 5. TileSprites-Material und -Geometrie, map2d-Browsertests und Lookbook
- Findings: PERF-032 (low), TYPE-024 (low), DOC-068 (info), READ-022 (info), DOC-026 (low), DOC-008 (info)
- Ziel: TileSprites-Material und -Geometrie folgen dem Muster der übrigen Sprite-Klassen, die map2d-Browsertests teilen ihre Kamera-Fixture, und die map2d-Demos der Lookbook liegen geordnet und mit geprüften Metadaten.
- Bereich: `packages/twopoint5d/src/map2d/TileSprites/` (Material, Geometrie samt neuer Spec, `TileSprites.ts`), `CHANGELOG.md` (Changed), `packages/twopoint5d-testing/test/` (drei map2d-Tests, `helpers/fixtures.js`), `apps/lookbook/src/demos/map2d/` (neu, die drei map2d-Demos), `components/DemoNavBar.astro`, `layouts/VanillaDemo.astro`, alle 17 Demoseiten und ihre JSON-Dateien, `tag-categories.json`, Lookbook-README, `scripts/lookbook/demoMetadata.test.mjs` (neu), `AGENTS.md`, `docs/architecture.md` — `loadMetadataForDemos.ts` bleibt unberührt (Grund in der Paketdatei)
- Detail: docs/remediation/paket-5.md
- Hängt ab von: —
- Hash: a45cac19
- Ergebnis: 1 Runde · PERF-032, TYPE-024, DOC-068, READ-022, DOC-026, DOC-008 behoben (Reviewer: freigeben) · Regressionstests, vor dem Fix rot: `builds no node on the way out` (TileSpritesMaterial.spec, `expected 4 to be 3` an `version`), Typtest `declares its pools read-only (a type-level check)` (TileSpritesGeometry.spec, zweimal TS2578 in `twopoint5d:typecheck`), `scripts/lookbook/demoMetadata.test.mjs` (Tag- und Kategorie-Prüfung rot mit `Map2DTileSpritesRenderer`, `Stage` und den doppelten `TileSpritesGeometry`/`TileSpritesMaterial`) · 17 Quelllinks im gebauten `apps/lookbook/dist` zeigen je auf `src/pages/demos/<id>.astro` ihres Verzeichnisses · klein: zwei Befunde, siehe Paketdatei
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `TileSpritesGeometry#basePool` und `#instancedPool` `readonly` (Interface-Merge entfernt) · Lookbook: `showSource` fällt aus den Props von `VanillaDemo.astro` und `DemoNavBar.astro` und aus allen `_*.json`; der Quelllink kommt aus der Route · map2d-Demos unter `apps/lookbook/src/demos/map2d/`, Import `~demos/map2d/<name>` · Browser-Fixture `makeCamera(x = 0)` in `packages/twopoint5d-testing/test/helpers/fixtures.js` · neuer `test:scripts`-Check `scripts/lookbook/demoMetadata.test.mjs` mit Ausnahmeliste `FROM_THREE` für großgeschriebene Tags aus three.js

### [x] 6. Nebenbefunde: Frustum im Koordinatensystem der Kamera, Rekursion in subdivide()
- Nebenbefund: `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:80-81` und `:406-407` — `makeCameraFrustum()` zieht den Frustum ohne `camera.coordinateSystem` und `camera.reversedDepth` aus der Projektion, und die Probe-Strahlen starten bei NDC-z `-1`: mit dem WebGPU-Koordinatensystem liegt die Near-Plane des Tests bei ≈ near/2, mit `reversedDepth` kippen Near- und Far-Plane (low, vorbestehend, aus Zug 0 von Paket 2)
- Nebenbefund: `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:200-231` — ein Chunk ohne Ausdehnung zählt in `findAxis` als *before*, die Verteilung schickt ihn nach Südost; landen alle Chunks eines Knotens im selben Quadranten, rekursiert `makeChild()` ohne Ende (`RangeError: Maximum call stack size exceeded`), reproduziert mit `[{0,0,0,0}, {10,10,5,5}, {20,20,5,5}]` und `subdivide(1)`; `ChunkQuadTreeNode.extended.spec.ts:304-307` umgeht es per Seed 47514 (low, vorbestehend, aus Paket 4)
- Ziel: Die Sichtbarkeitsprobe rechnet im Koordinatensystem und der Tiefenrichtung der Kamera, und `subdivide()` terminiert für jede Chunk-Menge, auch mit Chunks ohne Ausdehnung.
- Folge aufgenommen: `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:74-80` — der Sweep in `findAxis` rückt nur über `<= origin` vor; eine `NaN`-Kante hält ihn an Ort und Stelle, `subdivide()` hängt in einer Endlosschleife (low, entstanden mit 584a675d, davor endete die Schleife mit `i++`; gefunden in Zug 0 von Paket 6)
- Folge von: Paket 4 — nur für die aufgenommene Folge in `findAxis`; die beiden Nebenbefunde sind vorbestehend
- Bereich: `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` samt Spec, `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` samt `ChunkQuadTreeNode.extended.spec.ts` (Seed-Umgehung zurücknehmen), CHANGELOG (Fixed)
- Detail: docs/remediation/paket-6.md
- Hängt ab von: —
- Hash: e830eec5
- Ergebnis: 1 Runde · Frustum/Probe-Strahlen im Koordinatensystem der Kamera, Rekursion in `subdivide()` bei Chunks ohne Ausdehnung samt Rücknahme der Seed-Umgehung und die `NaN`-Endlosschleife in `findAxis` behoben (Reviewer: freigeben) · Regressionstests, vor dem Fix rot: `finds the tiles the camera sees in the WebGL coordinate system: WebGL with reversed depth` / `…: WebGPU with reversed depth`, `sees nothing of a plane that lies before its near plane: WebGPU` / `…: WebGL with reversed depth` / `…: WebGPU with reversed depth` (CameraBasedVisibility.spec), `splits a node whose axes run along a chunk of width and height 0`, `appendChunk() puts a chunk without extent on an axis where subdivide() puts it`, `axis choice` mit Seed 2 (`a raster with chunks of width or height 0`), `subdivide() comes to an end for a chunk whose right edge is NaN` (ChunkQuadTreeNode.extended.spec) · klein: vier Befunde, siehe Paketdatei
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `CameraBasedVisibility` liest `camera.coordinateSystem` und `camera.reversedDepth` für Frustum und Probe-Strahlen · `ChunkQuadTreeNode#subdivide()` und `#appendChunk()` legen einen Chunk mit `right <= originX` nach Westen, mit `bottom <= originY` nach Norden, auch bei Breite oder Höhe 0 auf der Achse · Signaturen unverändert

### [x] 7. Folgen aus den Reviews: TSDoc, Spec-Abdeckung und Formatpflege
- Folge von: Pakete 1, 4, 5, 6 — kleine Reviewer-Befunde auf den eigenen Diffs, die keine Runde ausgelöst haben (Einzelheiten in `docs/remediation/paket-<N>.md`, »Urteil des Reviewers«)
- Folge: `packages/twopoint5d/src/map2d/types.ts:19` — `IMap2DTileDataProvider#getTileIdsWithin` ohne TSDoc; der Vertrag (`RangeError` bei zu kurzem `target`, nur die ersten `width * height` Zellen) steht nur an `RepeatingTilesProvider` (aus Paket 4)
- Folge: `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:176-179` — TSDoc von `subdivide()` nennt nur Chunks der Breite oder Höhe 0 auf der Achse; ein Chunk mit negativer Breite und `right <= originX` geht ebenfalls nach Westen (aus Paket 6)
- Folge: `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts:388-417` — die geänderte Prüfreihenfolge ist nur in X belegt; Y-Reihenfolge in West- und Ostzweig von `appendChunk()` fehlt (etwa `{x: -5, y: 0, width: 3, height: 0}`) (aus Paket 6)
- Folge: `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts:745-758` — »finds the tiles the camera sees …« unterscheidet die Zeile `WebGPU` (nicht reversed) nicht von der Logik vor dem Fix (aus Paket 6)
- Folge: `packages/twopoint5d/src/map2d/TileSprites/TileSpritesGeometry.spec.ts:8-9` — Kommentar zum Lesen ohne `!` sagt nicht, dass nur `pnpm typecheck` das prüft, nicht Vitest (aus Paket 5)
- Folge: `packages/twopoint5d/CHANGELOG.md` `## [Unreleased]` `### Fixed` — Leerzeile vor dem ersten map2d-`fix`-Eintrag trennt die Liste (aus Paket 1); der Eintrag zu `removeTileRenderer()` sagt nicht, was ein Aufrufer spürt: ein vorübergehend abgehängter Renderer baut seine Tiles nach dem Wiederanhängen neu auf (aus Paket 1, prüfen, ob noch offen); die beiden Einträge aus Paket 6 enden mit Punkt und der erste hat zwei Sätze, die Nachbarn stehen ohne Schlusspunkt in einem Satz (aus Paket 6)
- Folge: `apps/lookbook/README.md:19`, `:42`, `:48`, `docs/architecture.md:284`, `AGENTS.md:43` — eingefügte Passagen stehen auf je einer sehr langen Zeile, der Text drumherum bricht bei rund 90 Zeichen um (aus Paket 5; `README.md:19` und `:48` in Zug 0 von Paket 7 dazugenommen, gleiche Ursache, derselbe Commit)
- Ziel: Was die Reviews dieses Laufs als klein notiert haben, ist erledigt, sodass map2d und seine Doku ohne offene Folge aus dem Lauf gehen.
- Bereich: die genannten Stellen; kein Verhalten ändert sich
- Detail: docs/remediation/paket-7.md
- Hängt ab von: —
- Hash: 480b8fc3
- Ergebnis: 1 Runde · alle sieben Folgen behoben (Reviewer: freigeben) · Specs, vor dem Fix `e830eec5` rot (Gegenprobe gegen `e830eec5^`): `appendChunk() puts a chunk of height 0 on the horizontal axis north of it: west of the vertical axis` / `…: east of the vertical axis` (ChunkQuadTreeNode.extended.spec), `finds the tiles the camera sees in the WebGL coordinate system: WebGPU` mit der Kamera `perspective, near plane on the ground` (CameraBasedVisibility.spec) · klein: Restzeilen `whether` in `AGENTS.md` und `lookbook and` in `apps/lookbook/README.md` nach dem Umbruch
- Nebenbefunde: keine
- Folgen: keine
