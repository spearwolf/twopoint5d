# Paket 3 — Map2D: CameraBasedVisibility — Kamera samt Eltern, Tile-Limit nach Kameranähe, eine Matrix je Tile

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-004 (medium), PERF-002 (medium), PERF-030 (info)
- Ziel: Die Sichtbarkeitsberechnung arbeitet mit der Kamera des aktuellen Frames samt ihrer Elternkette, nimmt bei gekippter Kamera höchstens `maxVisibleTiles` Tiles auf — die der Kamera nächsten — und bringt jedes Tile mit einer Matrix in den Weltraum.
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`, `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts`, `packages/twopoint5d/docs/architecture.md`, `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: die Schritte 1–4 im Abschnitt »Vorgehen« unten, in dieser Reihenfolge; Schritt 5 ist die Abgrenzung zu Paket 3b
- Verify: `pnpm run ci` (Zwischenläufe während der Arbeit: `pnpm nx test twopoint5d -- src/map2d`)
- Commit: siehe Abschnitt »Commit-Message« unten (Subject plus `BREAKING CHANGE:`-Footer)
- Verlauf:
  - 2026-09-28 Zug 0: Detailplan steht · BUG-004 unverändert `CameraBasedVisibility.ts:361` · PERF-002 unverändert `:578`, `:664`, `:505`, `convexTileHull.ts:90` · PERF-030 unverändert `:685`–`:687`, `:695`–`:698`, `:705`, `:610` · PERF-032 und PERF-009 unverändert, mit drei gleichursächlichen Nebenbefunden nach Paket 3b abgespalten · Folgen aus Paket 1 und 2: keine · Queue-Eintrag `TexturedSprites.ts:57`/`:65` bleibt liegen (andere Ursache) · Messskripte in `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad/paket-3.zug0-messungen/`
  - 2026-09-28 Zug 1: Implementierer beauftragt, opus, Effort high · Brief `paket-3.impl-0.brief.txt`, Report nach `paket-3.impl-0.json`
  - 2026-09-28 Zug 2: Report FERTIG · geändert `CameraBasedVisibility.ts`, `CameraBasedVisibility.spec.ts`, `docs/architecture.md`, `CHANGELOG.md` · Arbeitsbaum schmutzig · rote Läufe belegt (1.1: 2 rot, 2.1: 1 rot, 3.1: 6 rot) · Abweichungen: Horizont-Szene `far` 1000 statt 1500 (1500 ergab 11 402 Tiles), `enqueue(tile, insideProbeHull)`, `PooledTileBox.distanceToCamera` nicht optional · Verify `pnpm run ci` exit=0 (`paket-3.verify.log`, Nx-Cache-Treffer), dazu `src/map2d` ohne Cache exit=0, 600 Tests (`paket-3.verify-map2d-nocache.log`)
  - 2026-09-28 Zug 3: Review opus/high, nicht freigegeben · BUG-004 behoben (`:433`), PERF-030 behoben (`:614`–`:620`, `:839`, `:852`, `:862`), PERF-002 behoben bis auf 1 wichtig: »die nächsten Tiles« gilt bei Limits 1–14 nicht (nächstes sichtbares Tile liegt außerhalb der Seeds, kommt erst über fernere herein) · 1 klein (`:838`) · Diff `paket-3.diff`, Report `paket-3.review-0.json`
  - 2026-09-28 Zug 4 Runde 1: offen der wichtige Befund zu PERF-002 (Limit 1–14 nicht die nächsten) · Resume desselben Implementierers (Session `e8aae279-…`, opus/high), Auftrag: Zusage bleibt, Suche nach dem Kappen exakt machen (weiter entnehmen und verdrängen, solange die Frontier Näheres hat), Regressionstest Limits 1–15 über mehrere Kamerastellungen · Brief `paket-3.impl-1.brief.txt`
    · zurück: FERTIG, Haltedistanz `√(h² + (ρ_fernstes + Diagonale)²)` in `stopDistance()` statt der Runner-Regel (die ohne Zuschlag 10 von ~3 600 Fällen verfehlte), `#kept` als Max-Heap, `placeTile()` ordnet nach der Suche, Test Limits 1–15 × 9 Stellungen vor dem Fix rot · Verify `pnpm run ci` exit=0 (`paket-3.verify-1.log`), `src/map2d` ohne Cache exit=0, 601 Tests · Diff `paket-3.diff-1`
  - 2026-09-28 Zug 4 Runde 1 Review: Resume des Reviewers (Session `9ceb1c03-…`, opus/high), freigegeben · PERF-002-Befund erledigt (eigene Probe gegen `dist`: 1 624 perspektivische Fälle, je 560 ortho/unter der Ebene/gedrehte Matrix/gekippte Karte, 0 verfehlt) · 2 klein, keine neue Runde · Report `paket-3.review-1.json`
  - 2026-09-28 Zug 5: Commit f9d0c6a2 mit Trailer `Remediation-Run: 2026-09-28`, 4 Dateien · Verify `paket-3.verify-1.log` exit=0 (nach der letzten Codeänderung) · Plan auf `[x]`, drei Nebenbefunde in »Offene Befunde«

## Reviewer-Urteil

Zweiter Review (`paket-3.review-1.json`, freigegeben) auf dem committeten Stand f9d0c6a2:

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| BUG-004 | behoben | `CameraBasedVisibility.ts:433` `this.camera.updateWorldMatrix(true, false)`, Klassendoku `:140`–`:142`, Rig-Tests in der Spec |
| PERF-002 | behoben | Limit `:158`–`:186`, Gate `:253`/`:263`/`:363`, Frontier-Heap, `#kept` als Max-Heap `:669`–`:685`/`:941`–`:974`, Halt über `stopDistance()` `:663`/`:933`–`:938`, Einordnung nach der Suche `:729`–`:735`, Warnung `:680`/`:690`–`:702` |
| PERF-030 | behoben | `#tileWorldMatrix` einmal je Neuberechnung `:614`–`:620`, `centerWorld` `:894`, Frustum-Box `:907`, `tile.box` per `translate` `:984` |

Kleine Befunde (keine Runde):

- `CameraBasedVisibility.ts:917`–`:918`, JSDoc von `stopDistance()`: der Beweis setzt einen Punkt der Box im Frustum voraus, `Frustum#intersectsBox()` ist konservativ; ein nur konservativ angenommenes Tile kann in seltenen Fällen einem ferneren weichen (in ~4 700 Fällen nicht beobachtet). Ein einschränkender Satz reicht.
- `CameraBasedVisibility.ts:151`–`:168`: die Voraussetzung `frustumBoxScale ≥ 1` steht nur im privaten JSDoc; bei 0.5 verfehlt die Zusage in 1 von 420 Fällen. Aufgegangen im Queue-Eintrag zu `:157` (eine Prüfung auf ≥ 1 erledigt beides).
- `CameraBasedVisibility.ts:893`: `prepareTile()` legt `centerWorld` für jedes Tile an, das die Frontier betritt, einmal je Pool-Slot — vom Plan (3.6) so verlangt, für 3b beim Umbau der Pool-Verdrängung relevant.

Aus Runde 0 (`paket-3.review-0.json`, nicht freigegeben): der wichtige Befund, dass die Best-First-Suche bei Limits 1–14 nicht die nächsten Tiles hält, weil das nächste sichtbare Tile außerhalb der Seeds liegen kann; behoben in Runde 1 mit der Haltedistanz aus `stopDistance()`.

Urteile der Nebenbefunde: alle drei vorbestehend (`git show e7767c6d:…` trägt `frustumBoxScale = 1.1` ohne Prüfung, den `primary`-JSDoc und den Spec-Kommentar), alle in `src/map2d/` und damit `→ Scope`. Keiner teilt die Ursache von Paket 3b (Allokationen), deshalb Queue statt Paket.

## Abgleich

`CameraBasedVisibility.ts`, `convexTileHull.ts`, `Map2DTileCoordsUtil.ts` und
`RectangularVisibilityArea.ts` sind seit Laufbeginn unverändert
(`git diff --stat e7767c6d HEAD` über die vier Pfade ist leer); die Zeilennummern
des Audits treffen.

| Finding | Fundstelle jetzt | Urteil |
| --- | --- | --- |
| BUG-004 | `CameraBasedVisibility.ts:361` — `this.camera.updateMatrixWorld();`; der Streamer bringt den Map-Knoten mit `node.updateWorldMatrix(true, false)` (`Map2DTileStreamer.ts:150`) auf Stand | unverändert |
| PERF-002 | `:578` Flood-Fill per Stack ohne Grenze, `:664` Hull-Füllung ohne Grenze, `:505` Pool-Slot je Tile, `convexTileHull.ts:90` Scanline über die ganze Hülle | unverändert |
| PERF-030 | `:685`–`:687` Frustum-Box mit zwei `applyMatrix4`, `:695`–`:698` `centerWorld` mit zwei, `:705` `tile.box` mit einem, `:610` `visibles.sort()` | unverändert |
| PERF-032 | `:553`, `:657`, `:664`, `:296`, `convexTileHull.ts:22`, `Map2DTileCoordsUtil.ts:163`/`:175`, `RectangularVisibilityArea.ts:122` | unverändert → Paket 3b |
| PERF-009 | `:595`–`:599` Slot-Löschung ohne Free-List | unverändert → Paket 3b |

three.js steht auf 0.185.1. `Camera#updateWorldMatrix(updateParents, updateChildren, force)`
überschreibt die Methode von `Object3D` und hält `matrixWorldInverse` mit
(`node_modules/.pnpm/three@0.185.1/node_modules/three/src/cameras/Camera.js:132`);
`Object3D#updateWorldMatrix(true, false)` bringt die Elternkette über
`parent.updateWorldMatrix(true, false)` auf Stand, die Kinder nicht.

## Triage

- **Folgen:** Paket 1 und Paket 2 tragen `Folgen: keine`. Nichts zu verteilen.
- **Offene Befunde:** `TexturedSprites.ts:57`/`:65` (Material-Parametertyp der Sprites) hat eine andere Ursache und bleibt in der Queue.
- **Neu, vorbestehend, gleiche Ursache wie PERF-032:** Zug 0 hat die Allokationen des Hot Paths nachgemessen (Node 24.21, dieselben Muster isoliert, optimierter Code nach 2 000 Runden; Skripte `setclear.mjs`, `keys.mjs`, `sort.mjs`, `arr.mjs` im Messordner aus dem Verlauf, Aufruf `node --expose-gc <datei>`). PERF-032 zählt rund 30 Objekte je Frame; tatsächlich alloziert jede Neuberechnung pro Tile:
  1. `Map`/`Set` mit `packTileCoords()`-Schlüsseln (`:237`, `:239`, `:254`, `:261`): der Schlüssel ist ≥ 2^51 und nie ein Smi, jeder `get`/`has` boxt ihn — 16 B je Zugriff; `clear()` mit Wiederauffüllen baut die Hash-Tabellen neu auf (400 Einträge: 27 KB je `Set`, 35 KB je `Map`).
  2. `visibles.sort(sortByDistance)` (`:610`): jedes Comparator-Ergebnis wird geboxt, dazu ein Arbeitsarray — 10 KB (vorsortiert) bis 53 KB (gemischt) je Sortierung von 400 Tiles.
  3. Listen, die per `length = 0` geleert und neu gefüllt werden (`:403`, `:412`, `:417`, `:481`, `:514`–`:517`, `:529`–`:530`, `:612`, `:616`, `:653`, `RectangularVisibilityArea.ts:148`–`:150`, `:196`): V8 gibt den Backing Store frei, das Wiederauffüllen legt ihn neu an — 29 B je Eintrag; `pop()` bis zur Länge 0 kostet nichts.

  Alle drei gab es vor dem ersten Commit des Laufs (die Datei ist seit `e7767c6d` unverändert). Urteil `→ Scope`: sie liegen in `src/map2d/`, die Scope-Regel nimmt jede Severity. Geschätzt wird (1) medium — pro Tile und Nachbar statt pro Frame —, (2) und (3) low. Sie teilen die Ursache von PERF-032 (kurzlebige Allokationen je Neuberechnung in der Klasse, die sie vermeiden will) und gehen deshalb mit PERF-032 und PERF-009 in Paket 3b.

**Warum geteilt.** Mit den drei Nebenbefunden trüge Paket 3 fünf Findings und
drei weitere Allokationsquellen in derselben Funktion `findVisibleTiles()`. Der
Verhaltensumbau (Kamera, Limit, Suchreihenfolge, Matrix) und der
Allokationsumbau (Schlüssel, Sortierung, Listen, Free-List, Ziel-Parameter)
haben verschiedene Prüffragen: hier »stimmt das Ergebnis?«, dort »ist es
allokationsfrei und verhaltensgleich?«. Getrennt bekommt jede Frage einen
Implementierer und einen Review, und 3b plant in seinem Zug 0 gegen den
committeten Stand dieses Pakets statt gegen den heutigen. Das neue Paket heißt
`3b` und nicht dieses `3a`: die Schleife liest nach Zug 0 die Marke von Paket
`3`; ein umbenanntes Paket hätte keine, und sie hielte mit »Zug 0 ist nicht
durchgelaufen« an.

## Vorgehen

Jede Stelle unten meint `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`
bzw. dessen Spec, wo nichts anderes steht. Zeilennummern sind die von heute.

### Schritt 1 — Kamera samt Elternkette (BUG-004)

1. **Regressionstests zuerst, rot sehen.** In `CameraBasedVisibility.spec.ts`
   innerhalb von `describe('CameraBasedVisibility')` ein neuer Block
   `describe('a camera under a parent', …)`:
   - `test('takes the transforms of its parents into account', …)`: `const rig = new Group(); rig.position.set(300, 0, -200);`, eine Kamera wie `makeTopDownCamera()` (Position `(0, 100, 0)`, Blick auf den Ursprung), danach `rig.add(camera)`. Weder `rig` noch eine Szene bekommen `updateMatrixWorld()`. Nach `computeVisibleTiles([], [0, 0], new Map2DTileCoordsUtil(100, 100), new Matrix4())` liegt `visibility.pointOnPlane` bei `(300, 0, -200)` (`toBeCloseTo`).
   - `test('follows a parent that moved after the last recomputation', …)`: `rig.updateMatrixWorld(true)` wie ein Render, erste Neuberechnung, dann `rig.position.x += 500` ohne weiteres Update und eine zweite Neuberechnung mit denselben Argumenten: `pointOnPlane.x` ist um 500 gewandert, `serial` um 1 gestiegen.

   Mit `this.camera.updateMatrixWorld()` sind beide rot: die Kamera multipliziert
   mit dem veralteten `rig.matrixWorld`, im zweiten Test hält das Dependency-Gate
   den alten Stand sogar für unverändert und gibt den Cache zurück. `Group` kommt
   aus `three/webgpu`.
2. **Fix, `:361`:** `this.camera.updateMatrixWorld();` wird
   `this.camera.updateWorldMatrix(true, false);`. Ein Kommentar sagt, warum: die
   Elternkette der Kamera — ein Rig, ein Spielerobjekt — wird im selben Frame
   bewegt, und der Streamer bringt den Map-Knoten auf dieselbe Weise auf Stand
   (`Map2DTileStreamer.ts:150`), sodass Kamera und Karte aus demselben Frame
   verglichen werden. Die Kinder der Kamera werden nicht mehr mitgezogen; diese
   Klasse liest keine.
3. **Klassendoku, `:120`–`:121`:** aus »`computeVisibleTiles()` brings the world
   matrix of the camera up to date from its transform, but not its projection«
   wird sinngemäß »… from its own transform and those of its parents — the way
   `Map2DTileStreamer` brings the map node up to date —, but not its projection«.
4. **CHANGELOG `### Fixed`:** `CameraBasedVisibility#computeVisibleTiles()`
   bringt die Weltmatrix der Kamera samt ihrer Eltern auf Stand; eine Kamera an
   einem Rig, das im Frame vor dem Rendern bewegt wird, sieht die Tiles dieses
   Frames statt die des vorigen.

### Schritt 2 — eine Matrix je Tile (PERF-030)

1. **Test zuerst, rot sehen.** Im Block `describe('computeVisibleTiles()')`
   `test('takes the box of a tile into world space with one transform', …)`:
   Szene `makeTiltedCamera()` mit `new Map2DTileCoordsUtil(256, 256, -128, -128)`
   und `new Matrix4()`; direkt vor der einen Neuberechnung
   `vi.spyOn(Box3.prototype, 'applyMatrix4')` und
   `vi.spyOn(Frustum.prototype, 'intersectsBox')`. Erwartet: Aufrufe von
   `applyMatrix4` ≤ Aufrufe von `intersectsBox` + `visibility.visibles.length`.
   Heute rot (zwei Transformationen je Frustum-Box, eine je `tile.box`).
2. **Charakterisierungstest** (vor und nach dem Umbau grün):
   `test('the frustum box and the center of a tile are the ones two transforms in a row give', …)`
   mit `makeTopDownCamera()`, Raster `new Map2DTileCoordsUtil(100, 100, -50, -50)`,
   Mittelpunkt `[30, -20]` und einer Map-Matrix aus Verschiebung, Drehung um Y und
   ungleichmäßiger Skalierung (etwa `new Matrix4().compose(new Vector3(40, 0, -30), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.3), new Vector3(1.5, 1, 0.75))`).
   Für jedes sichtbare Tile wird die Referenz im Test gebaut — Box aus
   `tile.coords`, `frustumBoxScale` und `depth` wie `setBox()`, dann
   `.applyMatrix4(new Matrix4().makeTranslation(xOffset - 30, 0, yOffset + 20)).applyMatrix4(matrix)`,
   Mittelpunkt ebenso — und mit `toBeCloseTo(…, 6)` je Komponente gegen
   `frustumBox` und `centerWorld` gehalten. Die Szene muss sichtbare Tiles haben;
   der Test prüft das mit `expect(visibles.length).toBeGreaterThan(0)`.
3. **Umbau.** Zwei neue private Felder `#tileWorldMatrix = new Matrix4()` und
   `#tileBoxOffset = new Vector3()`. In `findVisibleTiles()` nach
   `#tileBoxMatrix.makeTranslation(…)` (`:541`):
   `#tileBoxOffset.set(xOffset - centerPoint2D.x, 0, yOffset - centerPoint2D.y)` und
   `#tileWorldMatrix.multiplyMatrices(this.matrixWorld, this.#tileBoxMatrix)` —
   eine Matrixmultiplikation je Neuberechnung.
   - Frustum-Box: `this.setBox(tile.frustumBox, coords, this.frustumBoxScale).applyMatrix4(this.#tileWorldMatrix)`. Das ist exakt dieselbe Box: `#tileBoxMatrix` ist eine reine Translation, eine verschobene AABB bleibt exakt, und die AABB der acht Ecken unter `M·T` ist die unter `M` nach `T`.
   - `centerWorld`: `.set(…).applyMatrix4(this.#tileWorldMatrix)`.
   - `tile.box`: `this.setBox(tile.box, coords).translate(this.#tileBoxOffset)` — keine Matrix.
4. **Abweichung von der Empfehlung.** Das Audit schlägt vor, `tile.box` lazy oder
   nur bei angemeldeten Helfern zu rechnen. `tile.box` bleibt eager: nach dem
   Umbau kostet es sechs Additionen je sichtbarem Tile, während »lazy« das
   öffentliche Feld `TileBox#box` bräche, das die Helfer, der Spec-Test
   `every visible TileBox carries a frustum/tile box and a Map2DTileCoords (helpers contract)`
   und der CHANGELOG (Zeile 373) als gefüllt beschreiben.
5. **Distanz und Sortierung bleiben** — Entscheidung vom 2026-09-28: die
   Sortierung nach Kameradistanz ist öffentlicher Vertrag. Dokumentiert wird sie
   an zwei Stellen: das JSDoc von `visibles` (`:214`–`:218`) sagt »nearest to the
   camera first« und dass das eine Zusage ist; das JSDoc von
   `computeVisibleTiles()` (`:336`–`:347`) sagt, dass `tiles` des Ergebnisses in
   der Reihenfolge von `visibles` steht. `visibles.sort(sortByDistance)` bleibt
   in diesem Paket, wie es ist; allokationsfrei macht es 3b.
6. **CHANGELOG `### Changed`:** eine `perf`-Zeile im Stil der Zeilen 115 und 234 —
   `CameraBasedVisibility` bringt die Box und den Mittelpunkt eines Tiles mit
   einer Matrix in den Weltraum; das Ergebnis ist dasselbe.

### Schritt 3 — Tile-Limit, nächste zuerst (PERF-002)

Entscheidung vom 2026-09-28: Obergrenze mit endlichem, großzügigem Default in
der Größenordnung 10 000, Flood-Fill nach Kameranähe, einmalige Warnung beim
Kappen, im CHANGELOG benannt.

1. **Regressionstests zuerst, rot sehen.** Neuer Block
   `describe('maxVisibleTiles', …)`:
   - `test('defaults to 10000', …)`.
   - `test('refuses anything but a whole number above 0 or Infinity', …)`: `0`, `-1`, `1.5`, `NaN`, `-Infinity` werfen `RangeError`, der Wert bleibt der alte; `1` und `Infinity` werden angenommen.
   - `test('a new value recomputes without the camera having moved', …)` nach dem Muster des gleichnamigen Tests unter `frustumBoxScale` (`:783`): `serial` steigt.
   - **Horizont-Szene:** eine Kamera knapp über der Ebene mit Blick zum Horizont, etwa `new PerspectiveCamera(75, 1.6, 0.1, 1500)` auf `(0, 40, 0)` mit Blick auf `(0, 0, -300)`, Raster `new Map2DTileCoordsUtil(16, 16)`. Der Test stellt sicher, dass die Referenz — eine frische Instanz mit `maxVisibleTiles = Infinity` — zwischen 2 000 und 8 000 Tiles hält (Kamera oder Raster so justieren), damit die Szene nicht still schrumpft und die Suite schnell bleibt.
   - `test('keeps the maxVisibleTiles tiles nearest to the camera', …)`: Horizont-Szene mit Limit 500 auf einer frischen Instanz: `visibles.length`, `result.tiles.length` und `result.createTiles.length` sind 500; jedes behaltene Tile ist in der Referenz; die größte `distanceToCamera` der behaltenen ist ≤ der kleinsten der weggelassenen Referenz-Tiles + `1e-6`. `visibles` ist aufsteigend nach Distanz sortiert. Mit dem `Frustum#intersectsBox`-Spy aus dem Block `the tiles between three or more probe rays` belegt der Test, dass hier kein sichtbares Tile ungetestet ist (die Hülle ist zu groß, siehe 3.5).
   - `test('keeps the nearest tiles when the hull fits under the limit', …)`: orthografische Draufsicht (`makeOrthoCameraLookingDown()`) auf `new Map2DTileCoordsUtil(20, 20)`, Limit so, dass die Bounding Box der Probe-Tiles darunter passt, das Ergebnis ohne Limit aber darüber liegt (Referenz mit `Infinity` wie oben, Werte im Test herleiten und mit einem Kommentar begründen; nachgerechnet in Zug 0: die Probe-Punkte bei ±100 fallen in die Tiles −5 bis 5, Bounding Box 11 × 11 = 121, und mit `frustumBoxScale` 1.1 reicht die Sicht über die Tiles −6 bis 5, ohne Limit 12 × 12 = 144 — jedes Limit von 121 bis 143 trifft den Pfad). Dieselben Zusagen wie im Test davor; der Spy belegt, dass hier ungetestete Tiles dabei sind (die Hülle wurde aufgezählt).
   - `test('warns once, the first time the limit cuts the view', …)`: `vi.spyOn(console, 'warn').mockImplementation(() => {})`; die Horizont-Szene mit Limit 500 warnt einmal, eine zweite gekappte Neuberechnung (Kamera leicht verschoben) nicht noch einmal; die Meldung nennt das Limit und `maxVisibleTiles`. Eine frische Instanz mit Default auf derselben Szene warnt nicht.

   Heute rot: das Feld fehlt, und die Suche nimmt alle Tiles.
2. **Öffentlicher Accessor `maxVisibleTiles`** (Getter/Setter über
   `#maxVisibleTiles = 10_000`). Angenommen wird eine ganze Zahl ≥ 1 oder
   `Infinity`; alles andere wirft
   ``RangeError(`[CameraBasedVisibility] maxVisibleTiles must be a whole number above 0 or Infinity, got ${describeValue(value)}`)``
   und lässt den Wert stehen — Muster `RectangularVisibilityArea.ts:11`–`:16`,
   `describeValue` aus `../utils/describeValue.js`. JSDoc: was er begrenzt (die
   Tiles einer Neuberechnung), welche bleiben (die der Kamera nächsten), wie er
   mit `far` zusammenhängt, dass die erste gekappte Neuberechnung einmal warnt,
   dass `Infinity` die Grenze abschaltet, und warum 10 000: mehr, als eine
   `TileSpritesGeometry` gewöhnlich fasst — die Grenze steht einer Sicht, die in
   ihre Geometrie passt, nicht im Weg und fängt eine zum Horizont gekippte Kamera.
3. **Teil des Dependency-Gates:** `maxVisibleTiles: number` in die Shape von
   `#deps` (`:194`–`:212`), `'maxVisibleTiles'` in die Liste und in das Objekt
   von `dependenciesChanged()` (`:296`–`:305`). Ein neuer Wert rechnet neu, wie
   bei `frustumBoxScale` (CHANGELOG Zeile 181).
4. **Frontier als Min-Heap nach Kameradistanz.** `#nextStack` (`:238`) wird zu
   `#frontier: PooledTileBox[]`, einem binären Min-Heap über `distanceToCamera` mit
   den privaten Methoden `pushFrontier(tile: PooledTileBox): void` und
   `popFrontier(): PooledTileBox` (Sift-up/-down). Verglichen wird
   inline an `distanceToCamera` — keine Comparator-Funktion, keine Objekte je
   Eintrag. Geleert wird die Frontier zu Beginn jeder Neuberechnung per `pop()`
   bis zur Länge 0, nicht per `length = 0`: V8 gibt bei `length = 0` den Backing
   Store frei, und das Wiederauffüllen legt ihn neu an (Messung in der Triage).
   - Ein Tile betritt die Frontier genau einmal je Neuberechnung. Die Markierung in `#visitedIds` wandert deshalb vom Entnehmen (`:580`–`:581`) zum Einfügen: die private Methode `enqueue(tile: PooledTileBox): void` prüft und setzt die Markierung, bereitet das Tile auf (3.6) und legt es in den Heap. `pushNeighbors()` (`:725`–`:735`) prüft wie heute vor `acquireTileBox()`, ob die Koordinate schon markiert ist, und reicht an diese Methode weiter.
   - Für Tiles der Hülle trägt der gepoolte Slot das interne Feld `insideProbeHull: boolean`, das **jede** Aufnahme in die Frontier neu schreibt: `true` aus der Hüllenaufzählung, `false` sonst. Deklariert wird es auf dem nicht exportierten Typ `interface PooledTileBox extends TileBox`, den `#tileBoxPool`, `acquireTileBox()` und die Frontier benutzen; das exportierte Interface `TileBox` bleibt unverändert. Kein weiteres `Set`.
5. **Hülle: nur Ordnung, kein Vorab-Annehmen.** `collectTilesWithinProbeHull()`
   (`:649`–`:670`) berechnet nach `convexTileHull(points)` die Bounding Box der
   Hüllpunkte. Ist `(maxX - minX + 1) * (maxY - minY + 1)` größer als
   `maxVisibleTiles`, kehrt sie ohne Aufzählung zurück: die Box ist eine obere
   Schranke der Hüll-Tiles, und ohne Hülle testet die Suche jedes Tile gegen das
   Frustum — das kostet Tests, nie Korrektheit, und `convexTileHull.ts` bleibt in
   diesem Paket unverändert. Sonst zählt sie auf wie heute; jedes Tile wird
   geholt, markiert, mit `insideProbeHull = true` aufbereitet und in die Frontier
   gelegt, statt in `#withinHull` gesammelt und sofort angenommen zu werden.
   `#withinHull` (`:240`) und die Schleife `:570`–`:576` entfallen. Das JSDoc der
   Methode sagt danach: die Tiles der Hülle sparen den Frustum-Test, nicht ihren
   Platz in der Reihenfolge — erst so bleiben unter dem Limit die nächsten Tiles
   und nicht die der Hülle.
6. **Aufbereitung beim Einfügen, Frustum-Box beim Entnehmen.** `prepareTile()`
   (`:673`–`:688`) rechnet `coords` (gecacht wie heute), `centerWorld` (mit
   `#tileWorldMatrix`, aus `acceptTile()` hierher verlegt) und
   `distanceToCamera` — alles, was der Heap zum Ordnen braucht. Die Frustum-Box
   rechnet die neue private Methode `updateFrustumBox(tile: PooledTileBox): void`, gerufen für
   jedes entnommene Tile, auch für die der Hülle: die Helfer lesen `frustumBox`
   jedes sichtbaren Tiles. `acceptTile()` rechnet danach nur noch `tile.box`,
   nimmt das Tile in `visibles` auf und sortiert es in reuse/create wie heute.
7. **Die Seeds** (`:550`–`:566`) kommen nach der Hülle: je Tile
   `acquireTileBox()`, `#probeTileIds.add()`, dann `enqueue()`
   (ein Seed, den die Hülle schon markiert hat, bleibt, wie er ist).
8. **Die Schleife** ersetzt `:570`–`:589`:

   ```ts
   let capped = false;
   while (this.#frontier.length > 0) {
     const tile = this.popFrontier();
     this.updateFrustumBox(tile);
     if (!tile.insideProbeHull && !this.#cameraFrustum.intersectsBox(tile.frustumBox!)) continue;
     if (this.visibles.length >= this.#maxVisibleTiles) {
       capped = true;
       break;
     }
     this.acceptTile(tile, this.#reuseTiles, this.#createTiles);
     this.pushNeighbors(tile);
   }
   if (capped) this.warnCapped();
   ```

   Gekappt ist eine Neuberechnung also erst, wenn ein weiteres Tile sichtbar
   wäre — ein Heap-Rest, der den Test nicht bestünde, warnt nicht. Die
   Verdrängung aus dem Pool (`:591`–`:599`), `primary`, die Sortierung und die
   Ergebnislisten bleiben, wie sie sind; ein Slot bleibt im Pool, wenn sein Tile
   in dieser Neuberechnung die Frontier betreten hat.
9. **Warnung:** die private Methode `warnCapped(): void` mit dem Flag `#warnedCapped`, einmal je Instanz,
   `console.warn` mit `// eslint-disable-next-line no-console` wie
   `#warnNoTileCapacity()` in `Map2DTileRenderer.ts:88`–`:95`. Wortlaut sinngemäß: »CameraBasedVisibility:
   the view reaches more than ${limit} tiles, so only the ${limit} nearest to the
   camera are kept. Raise maxVisibleTiles, or lower camera.far, if the tiles
   further out should be drawn. This warning is shown once per visibility.«
10. **Klassendoku** (`:99`–`:126`): ein Absatz nach dem über `far` und `near`:
    `far` begrenzt, wie weit die Ebene gesucht wird, und die Fläche einer zum
    Horizont gekippten Kamera wächst etwa mit `far²`; `maxVisibleTiles` begrenzt
    die Tiles einer Neuberechnung, die Suche läuft von der Kamera nach außen und
    hält an der Grenze, weggelassen werden die fernsten, und die erste gekappte
    Neuberechnung warnt einmal.
11. **Kein bestehender Test darf durch den Default kappen.** Die Szenen der Spec,
    der Browsertests (`packages/twopoint5d-testing/test/map2d-*.test.js`) und der
    Lookbook-Demo `apps/lookbook/src/demos/map2d/map2d-cam-visi.ts` (far 4000,
    Tiles 256) bleiben weit unter 10 000; eine Warnung in einem Lauf, der sie
    nicht erwartet, ist ein Befund.

### Schritt 4 — Doku und CHANGELOG

1. `packages/twopoint5d/docs/architecture.md:163`: »`CameraBasedVisibility`
   culls tiles against the camera frustum« wird sinngemäß »… culls tiles against
   the camera frustum, nearest to the camera first and up to `maxVisibleTiles`
   of them«.
2. `packages/twopoint5d/CHANGELOG.md`, nur `## [Unreleased]`, nach dem Skill
   `updating-changelog`:
   - `### Added`: `CameraBasedVisibility#maxVisibleTiles` — was er begrenzt, Default 10 000, `Infinity` schaltet ab, `RangeError` für alles andere, ein neuer Wert rechnet neu.
   - `### Changed`: `CameraBasedVisibility` nimmt höchstens `maxVisibleTiles` Tiles auf, die der Kamera nächsten, und warnt einmal, wenn die Grenze eine Sicht kappt; die Suche läuft nach Kameradistanz; die Tiles der Hülle sparen weiter den Frustum-Test. Dazu die `perf`-Zeile aus Schritt 2.6.
   - `### Fixed`: der Eintrag aus Schritt 1.4.
   - `### Migration Guide`: ein Abschnitt `#### CameraBasedVisibility keeps at most 10 000 tiles` mit Vorher/Nachher-Block (`map2d.visibilitor = new CameraBasedVisibility(camera);` gegen dasselbe mit `visibility.maxVisibleTiles = Infinity;` für eine Sicht, die alle Tiles behalten soll). Blöcke, die als `ts check` markiert werden, prüft `pnpm typecheck` gegen die gebaute Bibliothek.

### Schritt 5 — Abgrenzung zu Paket 3b

PERF-032, PERF-009 und die drei Nebenbefunde der Triage (Schlüssel aus
`packTileCoords()` in `Map`/`Set`, `visibles.sort()` mit Comparator, Listen per
`length = 0`) gehören zu Paket 3b. Die bestehenden Stellen bleiben hier, wie sie
sind — auch `#visitedIds`, `#probeTileIds`, `#previousTilesById`, die Sortierung
und die Pool-Verdrängung. Neuer Code dieses Pakets — die Frontier, die
Einfügemethode, `updateFrustumBox()`, die Warnung — entsteht aber gleich ohne
diese Muster: kein neuer `Map`/`Set`-Schlüssel, keine Comparator-Sortierung,
kein `length = 0` auf der Frontier, kein Objekt je Tile.

## Commit-Message

```
feat(map2d)!: bring the parents of the camera up to date before CameraBasedVisibility tests the frustum, keep at most maxVisibleTiles tiles and the nearest to the camera with a warning the first time the limit cuts the view, and take the box of a tile into world space with one matrix

BREAKING CHANGE: CameraBasedVisibility keeps at most maxVisibleTiles tiles, 10000 unless set otherwise, and those nearest to the camera. A view that reaches further keeps its nearest 10000 tiles and warns once; maxVisibleTiles = Infinity keeps every tile the view frustum reaches.
```

## Findings im Volltext

**BUG-004 · medium · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:361** — Kamera-Weltmatrix in `computeVisibleTiles()` samt Elternkette aktualisieren

`computeVisibleTiles()` ruft `this.camera.updateMatrixWorld()` auf. Das rechnet die Weltmatrix der Kamera aus ihrer lokalen Matrix und dem `matrixWorld` des Elternknotens so, wie er gerade steht — der Elternknoten selbst wird nicht aktualisiert. Hängt die Kamera an einem Rig oder Spielerobjekt, das im Frame vor dem Rendern bewegt wird, liest die Sichtbarkeit die Elternmatrix des Vorframes: Die Tiles laufen der Kamera einen Frame hinterher, bei schneller Bewegung reißt am Rand der Sicht ein Streifen ohne Tiles auf (die 1.1-Marge von `frustumBoxScale` deckt nur langsame Bewegung ab). Aufrufpfad pro Frame: `Map2D.update()` (Map2D.ts:153) → `Map2DTileStreamer.update()` (Map2DTileStreamer.ts:154) → `computeVisibleTiles()`. Der Streamer macht es für den Map-Knoten richtig (`node.updateWorldMatrix(true, false)`, Map2DTileStreamer.ts:150) — Kamera und Karte werden also mit unterschiedlich frischem Stand verglichen.

Beleg: `this.camera.updateMatrixWorld();` gegenüber `node.updateWorldMatrix(true, false);` in Map2DTileStreamer.ts:150

Empfehlung: `this.camera.updateWorldMatrix(true, false)` verwenden (Camera überschreibt diese Methode und hält `matrixWorldInverse` mit), damit die Elternkette der Kamera vor dem Frustum-Test auf den aktuellen Frame gebracht wird; einen Test mit Kamera in einer bewegten Gruppe ergänzen.

**PERF-002 · medium · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:578** (weitere Stellen: `CameraBasedVisibility.ts:664`, `convexTileHull.ts:90`, `CameraBasedVisibility.ts:505`) — Zahl der Tiles begrenzen, die `CameraBasedVisibility` pro Neuberechnung ablaufen kann

Die sichtbare Fläche ist nur durch `camera.far` begrenzt. Neigt sich eine perspektivische Kamera Richtung Horizont, wächst die Schnittfläche von Frustum und Kartenebene grob mit far² / (tileWidth·tileHeight): bei far = 10000 und Tiles von 16×16 sind das Hunderttausende Tiles. Hull-Füllung (`forEachTileWithinConvexHull`) und Flood-Fill (`while (this.#nextStack.length > 0)`) laufen diese Fläche vollständig ab — pro Tile ein Pool-Slot mit zwei `Box3`, einem `Vector3`, einem `Map2DTileCoords` samt String-Id und rund 26 Matrix-Vektor-Transformationen. Das passiert in jedem Frame, in dem sich die Kamera bewegt (Aufrufpfad `Map2D.update()` → `Map2DTileStreamer.update()` → `computeVisibleTiles()` → `findVisibleTiles()`), und der Pool behält all diese Slots. Hinter der Sichtbarkeit fragt `Map2DTileRenderer.reuseTile()` jedes Tile, das über die Kapazität der Geometrie hinausgeht, in jedem Frame erneut an (siehe Map2DTileRenderer.ts:109). Ein Kippen der Kamera kann so einen Frame-Drop bis zum Einfrieren auslösen, ohne dass eine Warnung kommt.

Beleg: kein Limit in `findVisibleTiles()`/`collectTilesWithinProbeHull()`; der Test in CameraBasedVisibility.spec.ts:74 hält die Fläche nur über `far = 200` klein

Empfehlung: Eine Obergrenze einführen (etwa `maxVisibleTiles` oder `maxDistance` in Tile-Einheiten, Default passend zur üblichen Geometrie-Kapazität): Die Flood-Fill bricht ab, sobald sie erreicht ist, und nimmt Tiles vorzugsweise nach Nähe zur Kamera auf (Priority Queue statt Stack); beim Kappen einmal warnen. Die Grenze in der Klassendoku zusammen mit `far` erklären.

**PERF-030 · info · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:685** (weitere Stellen: `:695`, `:705`, `:610`) — Tile-Boxen in `CameraBasedVisibility` mit einer kombinierten Matrix transformieren und Debug-Daten nur bei Bedarf rechnen

Pro geprüftem Tile wird die Frustum-Box zweimal mit `Box3.applyMatrix4` transformiert (erst `#tileBoxMatrix`, dann `matrixWorld`, je 8 Ecken), pro akzeptiertem Tile zusätzlich `centerWorld` zweimal und `tile.box` einmal — etwa 26 Matrix-Vektor-Produkte je Tile und Frame mit bewegter Kamera. `#tileBoxMatrix` ist eine reine Translation, das Produkt `matrixWorld · tileBoxMatrix` ergibt dieselbe AABB mit halber Arbeit. `tile.box` liest nur `CameraBasedVisibilityHelpers`, trotzdem wird es in jedem Frame für jedes Tile gerechnet; ebenso Distanz und `visibles.sort()`, deren Reihenfolge der Streamer nicht nutzt.

Empfehlung: Einmal pro Neuberechnung `#tileWorldMatrix = matrixWorld × tileBoxMatrix` bilden und damit Frustum-Box und Mittelpunkt transformieren; `tile.box` lazy berechnen oder nur, wenn Helfer angemeldet sind; prüfen, ob die Distanzsortierung Teil des Vertrags bleiben muss.
