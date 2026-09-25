# Paket 2 — CameraBasedVisibility: Frustum-Box, Kamera-Vertrag, Upload-Last

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-026 (medium, Optimierungspotenzial), API-051 (low), API-037 (low), BUG-103 (low), PERF-028 (info, Optimierungspotenzial), TYPE-011 (info), DOC-024 (info)
- Ziel: Die Sichtbarkeitsberechnung rechnet die Frustum-Box wie dokumentiert, fasst die Kamera des Aufrufers nicht an, allokiert pro Frame nichts Neues und löst bei bewegter Kamera keinen Voll-Upload der Instanzattribute mehr aus.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` + `CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts` + `RectangularVisibilityArea.spec.ts`
  - `packages/twopoint5d/src/map2d/types.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` + `Map2DTileStreamer.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts` + `Map2DSpatialHashGrid.spec.ts`
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts` + `TileSpritesFactory.spec.ts`
  - `packages/twopoint5d-testing/test/map2d-tile-upload.test.js`
  - `apps/lookbook/src/demos/map2d-cam-visi.ts`
  - `packages/twopoint5d/CHANGELOG.md` (Skill `updating-changelog` laden, bevor du ihn anfasst)
- Verify: `pnpm run ci`
- Commit: zwei `-m`-Argumente, Betreff und Footer:
  - `perf(map2d): tell the tile renderers that tiles changed only when the tile grid does, upload only the tile slots that were written, reuse the result and the lists of a visibilitor, let Map2DSpatialHashGrid fill a set it is handed, and have CameraBasedVisibility leave the camera projection to the caller, keep a tile grid of its own and scale the frustum box of a tile the way its documentation says`
  - `BREAKING CHANGE: CameraBasedVisibility no longer calls camera.updateProjectionMatrix(); whoever changes the projection parameters of the camera updates its projection before the next Map2D#update(). CameraBasedVisibility#map2dTileCoords is read-only. IMap2DVisibleTiles#changed is false for a view that moves while the tile grid stands, and a tile renderer gets tilesChanged false in beginUpdatingTiles() on such frames.`
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · PERF-026 unverändert (`CameraBasedVisibility.ts:548`, `RectangularVisibilityArea.ts:164`; der Early-Return steht jetzt in `Map2DTileRenderer.ts:105`, der Voll-Touch in `TileSpritesFactory.ts:89`) · API-051 unverändert (`CameraBasedVisibility.ts:311`, `:314-315`, `:155`; der Streamer-Aufruf nach `Map2DTileStreamer.ts:150` gewandert) · API-037 unverändert (`:114-119`) · BUG-103 unverändert (`:659-666`, `:22`) · PERF-028 unverändert (`:482-549`, `:568`, `:353`; das Streamer-Tupel nach `Map2DTileStreamer.ts:149` gewandert, `Map2DSpatialHashGrid.ts:83` unverändert) · TYPE-011 unverändert (`:430`) · DOC-024 nach `types.ts:131` und `:152-154` gewandert · Paket 1 hat keine Folgen hinterlassen, »Offene Befunde« war leer · ein Nebenbefund neu aufgenommen (Frustum-Koordinatensystem, siehe unten) → »Offene Befunde«, `→ Scope`
  - 2026-09-25 Zug 1: Implementierer beauftragt (opus, effort high), Session `remediate-twopoint5d-p2-impl-1`, Brief `paket-2.impl-1.brief.md`
  - 2026-09-25 Zug 2: Report FERTIG (session 9e7828c2-38e5-4094-83bd-f01dcf21cef2), 14 Dateien geändert (siehe `git status`), keine neu · Arbeitsbaum schmutzig · rote Läufe belegt für Schritte 1, 2a, 4b, 4c · Abweichungen: Center `[100, 0]` statt `[400, 0]` im `changed`-Test, `updateRanges.length > 0` zusätzlich, Identitätstest in beiden Specs · Nebenbefund `Map2DSpatialHashGrid.ts:59-77` = BUG-104 (Paket 3), kein neuer Eintrag · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`)
  - 2026-09-25 Zug 3: Reviewer beauftragt (opus, effort high), Session `remediate-twopoint5d-p2-review-1`, Diff `paket-2.diff`
  - 2026-09-25 Zug 3: Urteil nachbessern (session 3372f71d-455a-4756-9e57-4690a266df7e) · alle sieben Findings behoben · wichtig: `Map2DTileRenderer.ts:103-104` Kommentar zum Early-Return veraltet, `CHANGELOG.md:355` Achsen im Fixed-Eintrag vertauscht · klein: Titel `map2d-tile-upload.test.js:66`, Kommentar `TileSpritesFactory.ts:80`, Commit-Betreff ohne `out`-Set
  - 2026-09-25 Zug 4 Runde 2: beide wichtig + zwei kleine (Code) per Resume an denselben Implementierer (opus, high), Brief `paket-2.impl-2.brief.md` · `Map2DTileRenderer.ts` nur im Kommentar: den hat dieses Paket unwahr gemacht, die Ausnahme in »Nicht im Umfang« meinte das Verhalten · Commit-Betreff um das `out`-Set ergänzt
  - 2026-09-25 Zug 4 Runde 2: Report FERTIG, nur Text (`Map2DTileRenderer.ts` Kommentar, `CHANGELOG.md` Fixed-Eintrag, `map2d-tile-upload.test.js` Titel und Kommentar, `TileSpritesFactory.ts` Kommentar) · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`) · Re-Review per Resume beauftragt, Diff `paket-2.diff`, Delta `paket-2.diff-runde-2.delta`
  - 2026-09-25 Zug 4 Runde 2: Re-Review freigeben (session 3372f71d-455a-4756-9e57-4690a266df7e), alle fünf Punkte behoben, nichts Neues
  - 2026-09-25 Zug 5: Commit 8720c67a, 15 Dateien · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`) · Arbeitsbaum sauber

## Was du wissen musst, bevor du anfängst

Die Tile-Pipeline, soweit dieses Paket sie berührt:

1. `Map2DTileStreamer#update(node)` ruft `visibilitor.computeVisibleTiles(this.tiles, viewCenter, this.#tileCoords, node.matrixWorld)` und übernimmt danach `this.tiles = visible.tiles`. **Das Array, das der Visibilitor im letzten Ergebnis als `tiles` herausgegeben hat, kommt beim nächsten Aufruf als `previousTiles` zurück.** Das ist der zentrale Aliasing-Punkt für PERF-028.
2. Der Streamer reicht `visible.changed ?? true` als `tilesChanged` an `IMap2DTileRenderer#beginUpdatingTiles()`. `Map2DTileRenderer#reuseTile()` (`Map2DTileRenderer.ts:97-112`) lässt ein Tile, das es schon hält, bei `tilesChanged === false` unberührt; unbekannte Tiles nimmt es trotzdem auf, `addTile()`/`removeTile()` laufen immer. Jede Schreibaktion hebt dort `#dataSerial`, und nur dann ruft `endUpdatingTiles()` `factory.update()`. **`Map2DTileRenderer.ts` selbst ändert sich in diesem Paket nicht.**
3. Die `view` eines Tiles hängt allein am Raster: `CameraBasedVisibility` setzt sie aus `computeTilesWithinCoords(tile.x * tileWidth + xOffset, …, 1, 1)`, `RectangularVisibilityArea` aus `tileX * tileWidth, tileY * tileHeight`. Eine bewegte Kamera oder ein bewegtes View-Center verschiebt nur `offset` und damit die Renderer-Node, nie die `view` eines wiederverwendeten Tiles. Bei einem Rasterwechsel landen alle vorigen Tiles in `removeTiles` (so seit dem letzten Lauf), es gibt dann gar keine Wiederverwendung.
4. Upload-Mechanik der vertex-objects: Die drei Instanzattribute von `TileSpriteDescriptor` (`instancePosition`, `texCoords`, `quadSize`, alle `usage: 'dynamic'`, `autoTouch: false`) liegen **in einem gemeinsamen interleaved Buffer** (`bufferName` = `${usageType}_${dataType}`, also `dynamic_float32`). Der Pool führt je Buffer einen Dirty-Range: `createVO()` markiert seinen Slot (`VertexObjectPool.ts:137`), `freeVO()` markiert über `copyWithin()` den Zielslot (`VertexObjectBuffer.ts:482`). `geometry.update()` → `GeometryRoutes#syncUploads()` lädt nur diesen Range hoch — **außer** jemand hat über `geometry.touch(…)`/`touchAttributes()` einen Voll-Upload bestellt (`GeometryRoutes.ts:288-294`: `clearUpdateRanges()` + `#fullUploads`). Genau das tut `TileSpritesFactory#update()` heute bei jedem Aufruf.

## Vorgehen

Reihenfolge wie aufgeführt. Wo ein Schritt einen Regressionstest verlangt: Test zuerst schreiben, rot laufen lassen (`pnpm nx test twopoint5d -- src/map2d/<datei>.spec.ts`), die rote Ausgabe in den Report, dann fixen.

### 1. BUG-103 — Frustum-Box wie dokumentiert (`CameraBasedVisibility.ts:659-666`)

Entscheidung vom 2026-09-25 im Plan: jede Seite wächst um `(scale − 1) / 2 · size`, Default bleibt 1,1.

- Regressionstest zuerst, in `CameraBasedVisibility.spec.ts` im `describe('frustumBoxScale')`: `'the frustum box of a tile is frustumBoxScale times the tile, around the tile'`. Top-down-Kamera (`makeTopDownCamera()`), `new Map2DTileCoordsUtil(100, 100)`, `new Matrix4()` als `matrixWorld`, `visibility.frustumBoxScale = 2`, `visibility.depth` auf dem Default 100. Für jedes Tile in `visibility.visibles`: `frustumBox.getSize()` ist `(200, 200, 200)` (x = tileWidth·2, y = depth·2, z = tileHeight·2), und `frustumBox.getCenter()` liegt in x/z auf der Mitte von `tile.box` (Toleranz `1e-6`). Vor dem Fix ist x/z = 300 → rot.
- Fix in `setBox()`: `const sw = (width * scale - width) / 2;` und `const sh = (height * scale - height) / 2;`. `ground`/`ceiling` bleiben (die rechnen schon `depth * scale` insgesamt).
- TSDoc an `frustumBoxScale` (`:112`, hat heute keine), Sinn verbindlich: *How much larger than the tile the box is that the view frustum is tested against: the box is `frustumBoxScale` times the tile in width, height and depth, around the tile — each side moves out by `(frustumBoxScale - 1) / 2` of the tile size. `1` tests the tile itself; the default `1.1` gives a tile that only just leaves the view a margin before it is dropped.* Die TSDoc an `TileBox#frustumBox` (`:22`) bleibt, sie stimmt dann.

### 2. API-051 — die Projektion gehört dem Aufrufer, das Raster bleibt privat

Entscheidung vom 2026-09-25 im Plan.

**2a. `updateProjectionMatrix()` entfällt.**
- Regressionstest zuerst, `CameraBasedVisibility.spec.ts` im `describe('computeVisibleTiles()')`: `'leaves the projection matrix of the camera as the caller set it'`. Kamera aus `makeTopDownCamera()`, dann eine eigene Projektion setzen: `const custom = camera.projectionMatrix.clone().multiply(new Matrix4().makeScale(1.25, 1, 1)); camera.projectionMatrix.copy(custom); camera.projectionMatrixInverse.copy(custom).invert();` — `computeVisibleTiles(...)` — danach `camera.projectionMatrix.elements` gleich `custom.elements`. Vor dem Fix rechnet `updateProjectionMatrix()` aus `fov`/`aspect` neu → rot.
- `CameraBasedVisibility.ts:315` `this.camera.updateProjectionMatrix();` ersatzlos streichen.
- `this.camera.updateMatrixWorld();` (`:314`) **bleibt**. Grund: das Finding und die Entscheidung nennen die Projektion — die überschreibt, was der Aufrufer gesetzt hat. `updateMatrixWorld()` leitet Weltmatrix und `matrixWorldInverse` aus der Transformation ab, die der Aufrufer gesetzt hat, und überschreibt nichts davon; es zu streichen, legte dem Aufrufer eine zweite Pflicht auf, die niemand beschlossen hat.
- Klassen-TSDoc (`:95-108`) um die Pflicht ergänzen, Sinn verbindlich: *The camera is read as the caller keeps it. `computeVisibleTiles()` brings the world matrix of the camera up to date from its transform, but not its projection: whoever changes `fov`, `aspect`, `near`, `far` or `zoom` of a perspective camera, or the frustum of an orthographic one, calls `camera.updateProjectionMatrix()` before the next call. A projection matrix set by hand — jitter, an off-axis projection — is used as it stands, together with its `projectionMatrixInverse`.* Der Satz über `near`/`far` (`:106-107`) bleibt, er beschreibt dann die Projektion, die der Aufrufer pflegt.

**2b. `map2dTileCoords` nur lesend, als eigene Kopie.**
- Heute: öffentliches Feld `map2dTileCoords = new Map2DTileCoordsUtil()` (`:155`), und `computeVisibleTiles()` legt dort die private `#tileCoords`-Instanz des Streamers ab (`:311`). Wer darauf schreibt, schreibt im Raster des Streamers an dessen Settern vorbei.
- Neu: `readonly #map2dTileCoords = new Map2DTileCoordsUtil();` plus Getter `get map2dTileCoords(): Map2DTileCoordsUtil { return this.#map2dTileCoords; }`, **kein** Setter. In `computeVisibleTiles()` statt der Zuweisung `this.#map2dTileCoords.copy(map2dTileCoords);`. Jede interne Verwendung (`dependenciesChanged()`, `takeOverTileCoords()`, `findPointsOnPlaneThatAreInViewFrustum()`, `findVisibleTiles()`, `collectTilesWithinProbeHull()`, `prepareTile()`) liest `this.#map2dTileCoords`.
- Rückgabetyp bewusst `Map2DTileCoordsUtil`, nicht `Readonly<Map2DTileCoordsUtil>`: ein `Readonly<>` über eine Klasse mit `#`-Feldern ist der Klasse nicht mehr zuweisbar, und `equals()`/`copy()` anderer Instanzen würden es ablehnen. Die Kopie hält Schreibzugriffe ohnehin vom Streamer fern; der nächste Aufruf schreibt darüber.
- TSDoc am Getter, Sinn verbindlich: *The tile grid of the last `computeVisibleTiles()`, as a copy this visibility keeps for itself — the visibility helpers read it. A value written on it reaches neither the tile streamer nor the tiles, and the next call writes over it; the grid is set on `Map2D` or `Map2DTileStreamer`.*
- `CameraBasedVisibilityHelpers.ts:264-266` liest nur `xOffset`/`yOffset` — bleibt unverändert.
- Spec: `'map2dTileCoords is a copy of the grid of the last call, and read-only'` — nach einem Aufruf `visibility.map2dTileCoords` ist nicht `toBe(tileCoords)`, `equals(tileCoords)` ist `true`; `tileCoords.tileWidth = 50` danach ändert `visibility.map2dTileCoords.tileWidth` nicht; eine Zuweisung `visibility.map2dTileCoords = new Map2DTileCoordsUtil()` steht mit `// @ts-expect-error` in einem `expect(() => …).toThrow(TypeError)` (Getter ohne Setter im strict-mode-Modul). `pnpm typecheck` prüft die Specs mit, damit ist das Nur-Lesen auch zur Compile-Zeit belegt.

**2c. Eigene Aufrufer mitziehen.**
- `apps/lookbook/src/demos/map2d-cam-visi.ts:24`: nach `camera.far = 4000;` die Zeile `camera.updateProjectionMatrix();`. Das ist die einzige Stelle im Repo, die sich darauf verlassen hat (gesucht: alle Aufrufer von `CameraBasedVisibility` in `apps/`, `packages/twopoint5d-testing/`, Specs). `map2d-rect-visi.ts` und `map2d-tile-sprites.ts` setzen `far` ebenfalls ohne Update, benutzen aber keine `CameraBasedVisibility` — nicht anfassen.
- Browsertests (`map2d-placement.test.js`, `map2d-tile-upload.test.js`, `map2d-visibility-helpers.test.js`) bauen ihre Kamera mit `far` im Konstruktor, der die Projektion rechnet; sie brauchen keine Änderung. Die Spec-Kameras rufen `updateProjectionMatrix()` selbst.

### 3. API-037 — `lookAtCenter`-TSDoc (`CameraBasedVisibility.ts:114-119`)

Der Code bleibt. Die TSDoc nennt heute `true` als Default und »cumulated« als Verhalten; beides stimmt nicht. Was `computeVisibleTiles()` tut (`:365-372`): mit `true` wird der erste Probe-Punkt, der die Ebene trifft (`#probePlaneCoords[0]`, solange die Kamera die Ebene sieht der Strahl durch die Bildmitte), vom View-Center abgezogen, bevor das View-Center auf alle Probe-Punkte addiert wird — der erste Probe-Punkt landet also genau auf `(centerX, centerY)`. Mit `false` wird das View-Center auf die Probe-Punkte addiert.

Neue TSDoc, Sinn verbindlich: *Whether the view center of the map is where the camera looks. With `true`, the point where the first probe ray meets the map plane — the ray through the middle of the view, as long as it meets the plane — is taken as `(centerX, centerY)`: the tiles are laid out around the view center wherever the camera points. With `false` (the default), the view center shifts the map under the camera instead: the camera sees the map point that lies `(centerX, centerY)` away from where it looks on the plane.* Dazu `@defaultValue false`, falls die Datei das Tag anderswo benutzt; sonst reicht »(the default)«.

Spec, eine Zeile als Wache: `expect(new CameraBasedVisibility().lookAtCenter).toBe(false)` im `describe` der Defaults, falls es einen gibt, sonst neben `'defaults to 1.1'` ein eigener `describe('lookAtCenter')`.

### 4. PERF-026 — `changed` meldet nur einen Rasterwechsel, der Upload nur geschriebene Slots

Entscheidung vom 2026-09-25 im Plan: `IMap2DVisibleTiles#changed` meldet nur noch einen Grid-Wechsel (neue `view` der Tiles), nicht jeden Frame bei bewegter Kamera; TSDoc des Felds sagt das, CHANGELOG nennt die Änderung für eigene Tile-Renderer.

**4a. `changed` in beiden Visibilitors.** Neue Regel für eine *Neuberechnung* (der Cache-Pfad antwortet weiterhin `false`):

`changed = (dies ist die erste Neuberechnung dieser Instanz) || (das Raster unterscheidet sich von dem der vorigen Neuberechnung)`

Die erste Neuberechnung zählt als Wechsel, weil es kein Raster gibt, gegen das die `view` der mitgegebenen `previousTiles` gehalten werden könnte — ein Aufrufer darf einer frischen Instanz fremde Tiles reichen, und die werden wiederverwendet (`IMap2DVisibilitor`-Vertrag, `types.ts:178-182`).

- `CameraBasedVisibility`: in `computeVisibleTiles()` vor `this.#tileGridChanged = this.takeOverTileCoords();` festhalten `const firstRecomputation = this.#cachedTileCoords === undefined;`, dann `const changed = firstRecomputation || this.#tileGridChanged;`. `changed` geht in das Ergebnis des Normalpfads (`findVisibleTiles()` bekommt es als Parameter oder liest ein privates Feld — deine Wahl) **und** in das Ergebnis des `hitCount === 0`-Pfads (`:353`, heute `changed: true`). Dort gibt es keine wiederverwendeten Tiles, der Wert ist für Renderer gleichgültig; eine Regel für beide Pfade ist einfacher zu lesen als eine Ausnahme.
- `RectangularVisibilityArea`: `storedTileCoords` (`:81`) ist `undefined` genau beim ersten Aufruf mit `width`/`height` ≠ 0. `changed: storedTileCoords == null || tileGridChanged` statt `changed: true` (`:164`).
- TSDoc `IMap2DVisibleTiles#changed` (`types.ts:156-161`) neu, Sinn verbindlich: *Whether a tile in `reuseTiles` can carry other view coordinates than it carried in the previous result. `true` after a change of the tile grid, and on the first result a visibilitor computes, which has no grid before it to hold the tiles of `previousTiles` against. A view that moves while the grid stands leaves the view coordinates of every tile as they were — the move goes into `offset` — and the result says `false`; the tiles that come and go are in `createTiles` and `removeTiles` either way. A consumer may leave the data of a tile it already holds alone while this is `false`. Left out, it counts as `true`.*
- TSDoc `IMap2DTileRenderer#beginUpdatingTiles` (`types.ts:63-75`), den Satz zu `tilesChanged` angleichen, Sinn verbindlich: *`tilesChanged` says whether a tile the renderer already holds can come with other view coordinates than it was last written with — after a change of the tile grid. While the grid stands, a moving view keeps the view coordinates of every tile and moves only `position`.* Der Rest des Absatzes (»On `false` a renderer may leave … Left out, it counts as `true`.«) bleibt.

**4b. `TileSpritesFactory` lädt nur hoch, was geschrieben wurde.**

Abweichung von der Empfehlung des Audits, mit Grund: die Empfehlung sagt »nur die Attribute touchen, die seit dem letzten Frame geschrieben wurden«. Alle drei Attribute liegen aber in einem interleaved Buffer (siehe oben, Punkt 4 der Mechanik); ein Touch auf `instancePosition` allein bestellt denselben Voll-Upload desselben Buffers. Der Hebel ist der Dirty-Range des Pools, den `createVO()` und `freeVO()` schon pflegen — es fehlt nur `updateTile()`.

- Regressionstests zuerst, `TileSpritesFactory.spec.ts` im `describe('update()')`, mit den vorhandenen Helfern `bufferOf`, `uploaded`, `uploadsSlot`:
  - `'a frame that moves one tile uploads the slot of that tile and no other'`: drei Tiles bauen (`RepeatingTilesProvider(1)`, `TileSpritesGeometry(4)`), `update()`, `uploaded(buffer)`; das dritte Tile per `updateTile()` verschieben, `update()`. Erwartung: `uploadsSlot(buffer, 2)` ist `true`, und kein Range in `buffer.updateRanges` beginnt vor `2 * buffer.stride`. Vor dem Fix bestellt `touch()` den Range über alle drei Slots → rot.
  - `'update() with nothing written sends nothing to the gpu'`: ein Tile bauen, `update()`, `uploaded(buffer)`, `version` merken, `update()` ohne jede Schreibaktion → `buffer.version` unverändert. Vor dem Fix hebt `touch()` die Version → rot.
- `updateTile()` markiert nach `tile.setInstancePosition(…)` genau den Slot des Tiles im Pool: `const pool = this.#tileSpritesGeometry()?.instancedPool; if (pool?.containsVO(tile)) { const idx = VOUtils.getIndex(tile); pool.buffer.touch(idx, idx); }` (`VOUtils` aus `../../vertex-objects/VOUtils.js`). Kommentar mit dem Warum: die Attribute tragen kein `autoTouch`, also sagt die Factory selbst, welcher Slot geschrieben wurde; `createVO()` und `freeVO()` markieren ihre Slots schon.
- `update()`: `geometry.touch('quadSize', 'texCoords', 'instancePosition');` streichen, `this.tileSprites.update()` bleibt (setzt `instanceCount`, Draw-Range und lädt die Ranges des Pools hoch). Die Guard `if (geometry)` bleibt.
- Die vorhandenen `update()`-Specs aus Paket 1 (`'a tile it builds reaches…'`, `'a tile it moves reaches…'`, `'the tile that moves into a freed slot…'`) müssen unverändert grün bleiben — sie sind das Sicherungsnetz für genau diesen Umbau.

**4c. Tests für das neue `changed`.**
- `CameraBasedVisibility.spec.ts`, Test `'marks a freshly computed result as changed and a cached one as unchanged'` (`:343-354`) umschreiben: erster Aufruf `changed === true`, zweiter (nichts bewegt) `false`, dritter (Center `[400, 0]`) **`false`**, und jedes Tile in `third.reuseTiles` hat dieselbe `view` (left/top/width/height) wie im Snapshot des ersten Ergebnisses. Neuer Titel etwa `'says changed on the first result and on a new grid, not for a moved view'`. Dazu ein vierter Aufruf mit anderem Raster (`new Map2DTileCoordsUtil(50, 50)`) → `changed === true`.
- `'a changed depth invalidates the cached tile set'` (`:356-365`), `'a changed lookAtCenter invalidates…'` (`:367-376`) und `'a new value recomputes without the camera having moved'` (`:587-600`): die Neuberechnung belegt `visibility.serial` (um 1 gestiegen), nicht `changed` und nicht die Objektidentität (siehe 5d); `changed` ist dort `false`.
- `RectangularVisibilityArea.spec.ts`: `'a moved center recomputes'` (`:52-61`) und `'a changed width recomputes'` (`:63-72`) — `changed` ist dort `false`. Die Neuberechnung belegen `createTiles` und `removeTiles`: der Cache-Pfad setzt beide auf `undefined` (`RectangularVisibilityArea.ts:93-95`), eine Neuberechnung liefert Arrays. `'classifies every tile as created on the first call and says so'` (`:25-35`) bleibt bei `changed === true`.
- Neuer Test mit echten Teilen, `Map2DTileStreamer.spec.ts`: `'a view center that moves within the tiles it shows has the renderer write no tile'`. `new Map2DTileStreamer(100, 100)`, `visibilitor = new RectangularVisibilityArea(300, 300)`, ein `Map2DTileRenderer` über einer zählenden Factory (`IMapTileFactory` mit `vi.fn()` für `createTile` — gibt ein Objekt zurück —, `updateTile`, `destroyTile`, `update`, `addToNode`, `removeFromNode`; gibt es in den map2d-Specs schon eine solche Fake-Factory, nimm sie). `streamer.update(new Object3D())`, Zähler zurücksetzen, `streamer.centerX = 10`, `streamer.update(node)`. Erwartung: `createTile`, `updateTile`, `destroyTile`, `update` je 0 Aufrufe, und `renderer.node.position.x` ist `-10` (offset = `xOffset - centerX`). Die Kachelmenge bleibt bei Center 0 und 10 dieselbe (Spalten -2 … 1, rechne es nach). Vor dem Fix ruft jede Wiederverwendung `updateTile()` und am Ende `update()` → rot.
- Browsertest, weil der Umbau GPU-Buffer-Code betrifft — `map2d-tile-upload.test.js`, neuer Fall `'a frame that moves the view within the tiles it shows touches no tile attribute buffer'`: `makeMap(new RectangularVisibilityArea(1024, 1024))` (Import aus `@spearwolf/twopoint5d`; Raster aus `makeMap`: 256, Offsets -128), zwei Frames wie in den vorhandenen Fällen, dann `version` von `bufferOf(instancePosition)` und `tileRenderer.node.position.x` merken, `map2d.centerX = 10`, ein Frame. Erwartung: Version unverändert, `usedCount` unverändert, Node-Position um `-10` verschoben. Bei Center 0 und 10 liegen dieselben fünf Spalten im Rechteck (nachrechnen). Die Kamera des Tests bleibt die dateilokale — die geteilte Kamera-Fixture baut Paket 5, nicht dieses.

### 5. PERF-028 — keine Allokationen im Frame-Loop

Vertrag, auf den sich alles stützt (`types.ts:123-129`): ein Ergebnis gilt bis zum nächsten `computeVisibleTiles()` derselben Instanz, danach darf jedes Feld andere Werte tragen und das Objekt dasselbe sein. Der Umbau nutzt das aus; er erfindet keinen neuen Vertrag.

**Die eine Invariante:** `previousTiles` kann das `tiles`-Array des eigenen letzten Ergebnisses sein (der Streamer reicht es zurück). Deshalb wird `previousTiles` **vollständig gelesen, bevor irgendeine der Scratch-Listen geleert oder beschrieben wird**. Ein Kommentar an der Stelle sagt das.

**5a. `CameraBasedVisibility`.**
- Neue Felder: `readonly #tiles: IMap2DTileCoords[] = []`, `readonly #reuseTiles: IMap2DTileCoords[] = []`, `readonly #createTiles: IMap2DTileCoords[] = []`, `readonly #removeTiles: IMap2DTileCoords[] = []`, `readonly #hullPoints: TilePoint[] = []` und ein Ergebnisobjekt `readonly #result: IMap2DVisibleTiles`, das einmal angelegt wird. `#visibleTiles` bleibt als »letztes Ergebnis oder `undefined`« und zeigt nach einer Neuberechnung auf `#result`.
- `findVisibleTiles()` (TYPE-011: Rückgabetyp `IMap2DVisibleTiles`, ohne `| undefined`): `#previousTilesById` wird wie heute zuerst aus `previousTiles` gefüllt (`:439-444`); **danach** `#reuseTiles.length = 0` und `#createTiles.length = 0` (statt `:482-483`). `acceptTile()` bekommt weiter die beiden Listen. Am Ende `#tiles.length = 0` und die `map2dTile` der sortierten `visibles` hineinschieben (statt `new Array`, `:529-531`); `#removeTiles.length = 0` und die Werte von `#previousTilesById` hinein (statt `:533-534`). Dann die Felder von `#result` setzen — `tiles`, `createTiles`, `reuseTiles`, `removeTiles` auf die vier Scratch-Listen, `offset: this.#scratchOffset`, `translate`, `changed` — und `#result` zurückgeben.
- `collectTilesWithinProbeHull()`: `#hullPoints.length = 0` statt `const points: TilePoint[] = []` (`:568`). `convexTileHull()` bleibt, wie es ist (siehe »Nicht im Umfang«).
- `hitCount === 0`-Pfad (`:348-355`), wenn `previousTiles.length > 0`: **zuerst** `#removeTiles.length = 0` und alle Einträge von `previousTiles` hinein, **dann** `#tiles.length = 0`. Ergebnis ist `#result` mit genau den Feldern, die der Pfad heute hat: `tiles` = `#tiles` (leer), `removeTiles` = `#removeTiles`, `changed` wie in 4a; `createTiles`, `reuseTiles`, `offset`, `translate` werden auf `undefined` gesetzt, damit nichts vom vorigen Frame stehen bleibt. Bei leerem `previousTiles` bleibt die Antwort `undefined`.
- Der Cache-Pfad (`:317-325`) bleibt, wie er ist: er setzt `reuseTiles = tiles`, `createTiles`/`removeTiles` = `undefined`, `changed = false` auf dem gespeicherten Objekt. Die nächste Neuberechnung setzt `reuseTiles` wieder auf `#reuseTiles` — deshalb schreibt sie in die privaten Felder, nie in `this.#result.reuseTiles`.

**5b. `RectangularVisibilityArea`.** Dasselbe Muster: Scratch-Felder `#tiles`, `#reuseTiles`, `#createTiles`, `#removeTiles`, ein `#result`. Reihenfolge in der Neuberechnung: `#reuseTiles`, `#removeTiles`, `#createTiles` leeren; `previousTiles` mit einer indizierten Schleife statt `forEach` (`:126`, spart die Closure) in `#reuseTiles`/`#removeTiles` verteilen; die Erzeugungsschleife schiebt in `#createTiles` — die `new Map2DTileCoords(…)` für neu eintretende Tiles bleiben, der Aufrufer behält sie als Tile-Menge; **erst dann** `#tiles.length = 0` und `#reuseTiles`, danach `#createTiles` hineinschieben (statt `reuseTiles.concat(createTiles)`, `:158`). Felder von `#result` setzen (`tiles`, `offset`, `translate`, `removeTiles`, `createTiles`, `reuseTiles`, `changed`), `#visibleTiles = this.#result`.

**5c. `Map2DTileStreamer`.** `readonly #viewCenter: [number, number] = [0, 0];` neben `#position`, in `update()` `this.#viewCenter[0] = this.centerX; this.#viewCenter[1] = this.centerY;` und dieses Tupel übergeben (statt `:149`). Der Kommentar an `#position` (»Per-frame scratch — handed to beginUpdatingTiles(), which reads it during the call.«) bekommt ein Gegenstück. TSDoc von `IMap2DVisibilitor#computeVisibleTiles` (`types.ts:171-183`) ergänzen, nach dem Vorbild von `beginUpdatingTiles`: *`centerPoint` is read during the call: `Map2DTileStreamer` hands over a tuple it reuses, so a visibilitor that wants the values afterwards copies them.* Beide Visibilitors destrukturieren das Tupel schon in der Parameterliste.

**5d. `Map2DSpatialHashGrid#findWithin()` mit `out`.** Paket 3 baut auf dieser Signatur auf (BUG-104 im selben File); sie gehört nach dem Commit in `Schnittstellen:`.
- Überladungen, damit der Aufruf ohne `out` seinen Typ behält:
  - `findWithin(aabb: AABB2): Set<Renderable> | undefined;`
  - `findWithin(aabb: AABB2, out: Set<Renderable>): Set<Renderable>;`
  - `getTiles(tileX: number, tileY: number, width?: number, height?: number): Set<Renderable> | undefined;`
  - `getTiles(tileX: number, tileY: number, width: number, height: number, out: Set<Renderable>): Set<Renderable>;`
- Semantik mit `out`: `out` wird geleert, gefüllt und zurückgegeben — auch leer, nie `undefined`. Ohne `out` wie heute: ein neues `Set` oder `undefined`, wenn nichts in den Zellen liegt. `findWithin` reicht `out` an `getTiles` durch. TSDoc an beiden sagt das in je zwei Sätzen.
- Specs in `Map2DSpatialHashGrid.spec.ts`: `'findWithin fills the set it is handed and hands it back'` (ein `out` mit einem Fremdeintrag vorbelegt → danach nur die Treffer, Rückgabe `toBe(out)`), `'findWithin hands back the empty set it is handed when nothing lies within'`. Die vorhandenen Tests ohne `out` bleiben unverändert grün.

**5e. Specs, die ein Ergebnis über einen späteren Aufruf hinweg lesen.** Mit dem wiederverwendeten Ergebnis ist `second === first` und `first.tiles` nach dem zweiten Aufruf das neue Array. Das war vom Vertrag nie gedeckt; angepasst werden die Specs, nicht die Wiederverwendung:
- Was ein Test aus einem früheren Ergebnis nach einem späteren Aufruf vergleicht, nimmt er vor diesem Aufruf als Kopie (`[...first.tiles]`, `ids(first.tiles)`, `first.tiles.length`).
- `expect(second).not.toBe(first)` als Beleg einer Neuberechnung ersetzen: in `CameraBasedVisibility.spec.ts` durch `visibility.serial`, in `RectangularVisibilityArea.spec.ts` durch `createTiles`/`removeTiles` definiert (siehe 4c).
- `'returns tiles=[] and removeTiles=previousTiles when…'` (`CameraBasedVisibility.spec.ts:147-159`): `removeTiles` ist jetzt eine Kopie → `toEqual(previous)` statt `toBe(previous)`, Titel entsprechend.
- Betroffen nach Sichtung mindestens: `CameraBasedVisibility.spec.ts:147-159`, `:161-171`, `:173-186` (bleibt gültig, prüfen), `:188-221`, `:282-310`, `:312-341`, `:343-376`, `:378-397`, `:483-505`, `:587-600`; `RectangularVisibilityArea.spec.ts:37-140`. Lauf die Specs, jede rote Stelle ist eine dieser Arten.
- Neue Aliasing-Wachen, je Visibilitor eine:
  - `'a recomputation handed the tiles of its own last result classifies against what they were'`: `first` berechnen, `const before = ids(first.tiles)`, `second = compute(first.tiles, [400, 0], …)` → `ids([...(second.reuseTiles ?? []), ...(second.removeTiles ?? [])])` gleich `before`, und `second.tiles` enthält kein Tile zweimal.
  - nur `CameraBasedVisibility`: `'a camera that turns away from the plane hands every tile of its own last result back for removal'`: `first` berechnen, `before = ids(first.tiles)`, `visibility.camera = makeOrthoCameraLookingHorizontally()`, `second = compute(first.tiles, …)` → `second.tiles` leer, `ids(second.removeTiles)` gleich `before`. Das ist genau der Fall, in dem `previousTiles` und das neue `tiles` dasselbe Array sind.
  - `'hands back the same result object and lists on every recomputation'`: zwei Neuberechnungen mit bewegtem Center → `second` `toBe(first)`, `second.tiles` `toBe` dem Array aus dem ersten Aufruf.

### 6. DOC-024 — TSDoc an vier Feldern von `IMap2DVisibleTiles` (`types.ts:131`, `:152-154`)

Je ein Satz, Sinn verbindlich:
- `tiles`: *Every tile visible now — the tile set of this result, and the list a caller hands back as `previousTiles` in its next call.*
- `removeTiles`: *The tiles of `previousTiles` that are not visible any more, or all of them on a new tile grid.*
- `reuseTiles`: *The tiles of `previousTiles` that stay visible; the caller holds them already.*
- `createTiles`: *The visible tiles that `previousTiles` did not hold.*
- Ergänzend an `reuseTiles` oder `createTiles`: *Together they hold the same tiles as `tiles`, not necessarily in its order.* Der Cache-Pfad (`reuseTiles` = `tiles`, `createTiles`/`removeTiles` = `undefined`) ist davon gedeckt.

### 7. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`)

Skill `updating-changelog` laden. Einträge im Stil der vorhandenen map2d-Zeilen:

- **Changed:**
  - `CameraBasedVisibility` no longer calls `camera.updateProjectionMatrix()`: the projection belongs to the caller, and a projection matrix set by hand is used as it stands. Verweis auf den Abschnitt im Migration Guide.
  - `CameraBasedVisibility#map2dTileCoords` is a read-only getter answering a copy of the tile grid of the last `computeVisibleTiles()`; the grid is set on `Map2D` or `Map2DTileStreamer`. Verweis auf den Migration Guide.
  - `IMap2DVisibleTiles#changed`: `CameraBasedVisibility` and `RectangularVisibilityArea` answer `false` for a view that moves while the tile grid stands, `true` on their first result and on a new grid. A custom `IMap2DTileRenderer` gets `tilesChanged: false` in `beginUpdatingTiles()` on such frames and may leave the tiles it holds alone; tiles that come and go still arrive through `addTile()` and `removeTile()`.
  - perf `TileSpritesFactory` uploads the instance slots that were written and no others: `updateTile()` marks the slot of its tile, and `update()` no longer asks for a full upload of the instance attributes. Together with the line above, a view that scrolls without a tile coming or going sends no tile data to the gpu.
  - perf `CameraBasedVisibility` and `RectangularVisibilityArea` hand back the same result object and the same lists on every call, as `IMap2DVisibleTiles` allows; a caller that keeps a list beyond the next call copies it. `Map2DTileStreamer` hands the visibilitor a view-center tuple it reuses.
- **Added:** `Map2DSpatialHashGrid#findWithin()` and `#getTiles()` take an optional `out` set: emptied, filled and handed back, empty rather than `undefined` when nothing lies within.
- **Fixed:** `CameraBasedVisibility#frustumBoxScale` scales the box a tile is tested with by the value in width and depth as it already did in height: each side moves out by `(scale - 1) / 2` of the tile size. A side used to move out by `(scale - 1)` of it, so the default 1.1 tested a box 1.2 times the tile; the tiles at the edge of the view are dropped a little earlier.
- **Bestehende Unreleased-Zeile anpassen:** der Eintrag »`CameraBasedVisibility#frustumBoxScale` is part of the state a recomputation is held against: … which reports `changed: true` and raises `serial` …« (heute Zeile 152) sagt nach diesem Paket etwas Falsches — `changed: true` streichen, die Aussage bleibt »recomputes and raises `serial`«. Unreleased ist noch nicht veröffentlicht und darf korrigiert werden; freigegebene Abschnitte nicht.
- **Migration Guide**, zwei `####`-Abschnitte:
  - *CameraBasedVisibility leaves the projection to the caller* — wer `fov`, `aspect`, `near`, `far`, `zoom` oder das Frustum einer Orthografischen ändert, ruft `camera.updateProjectionMatrix()` vor dem nächsten `Map2D#update()`; ein Beispiel wie in der Lookbook-Demo (`camera.far = 4000; camera.updateProjectionMatrix();`).
  - *CameraBasedVisibility#map2dTileCoords is read-only* — das Raster über `Map2D#tileWidth`/`tileHeight`/`xOffset`/`yOffset` oder den Streamer setzen.
  - Code-Blöcke: ein eigenständiger Block (importiert, was er benutzt) trägt `ts check`, ein Auszug bleibt schlichtes `ts` (Regel in `AGENTS.md`).
- Kein Eintrag für die reinen TSDoc-Korrekturen (`lookAtCenter`, die vier Felder von `IMap2DVisibleTiles`).

## Nicht im Umfang

- `convexTileHull()` allokiert intern (`convexTileHull.ts:21-53`), `Map2DTileCoordsUtil#computeTilesWithinCoords()` und `#getTileCoords()` geben je Aufruf ein neues Objekt bzw. Tupel zurück (in `findVisibleTiles()` bis zu neun Mal je Neuberechnung, in `findWithin()` einmal). Das Finding nennt Ergebnisobjekt, Listen und das `Set` von `findWithin`; eine Target-API für diese Utilities wäre ein Umbau eines weiteren öffentlichen Typs ohne Auftrag. Nicht anfassen, nicht melden.
- **Bekannter Nebenbefund, nicht beheben, nicht erneut melden:** `makeCameraFrustum()` (`CameraBasedVisibility.ts:80-81`) ruft `Frustum#setFromProjectionMatrix()` ohne `camera.coordinateSystem` und `camera.reversedDepth`, und die Probe-Strahlen starten bei NDC-z `-1` (`:406-407`). Steht in »Offene Befunde« im Plan.
- `Map2DTileRenderer.ts` bleibt unverändert; `map2d-rect-visi.ts` und `map2d-tile-sprites.ts` bleiben unverändert.
- Die geteilte Kamera-Fixture der map2d-Browsertests ist Paket 5.

## Triage in Zug 0

- Folgen aus Paket 1: keine (`Folgen: keine` im Plan).
- »Offene Befunde«: war leer.
- Neu gefunden beim Abgleich: das Frustum-Koordinatensystem oben. Vorbestehend, belegt mit `git show 9a97f1bc:packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` (Zeilen 80-81 und 406-407 gleichlautend). Schwere `low`: mit dem WebGPU-Koordinatensystem, das der Renderer der Kamera beim ersten Render gibt, liegt die Near-Plane des Frustum-Tests bei ≈ near/2 statt bei near — praktisch folgenlos; mit `reversedDepth` kippen Near- und Far-Plane, das nutzt im Repo niemand (`git grep reversedDepth` leer), in three ist es opt-in. Nicht dieselbe Ursache wie API-051 — dort schreibt die Klasse die Projektion, hier liest sie sie in der falschen Konvention; darum nicht in dieses Paket. Scope-Regel greift (map2d) → `→ Scope`, die Drain-Runde schneidet das Paket.

## Restplan

Geprüft, keine Änderung. Paket 3 hängt weiter an diesem Paket (`findWithin` mit `out`, Schritt 5d) und berührt dieselbe Datei danach. Paket 5 baut die geteilte Kamera-Fixture der map2d-Browsertests; der neue Browsertest aus Schritt 4c benutzt die dateilokale Kamera und wird dort mitgenommen. Paket 4 ist unabhängig. Keine Fundstelle anderer Pakete ist durch den Abgleich weggefallen.

## Findings im Volltext

**PERF-026 · medium · Optimierungspotenzial · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:548** (weitere: `RectangularVisibilityArea.ts:164`, `TileSprites/TileSpritesFactory.ts:66-70`, `Map2DTileRenderer.ts:84`) — Voll-Upload aller Instanzattribute bei bewegter Kamera vermeiden
`computeVisibleTiles()` gibt fest `changed: true` zurück. Der Early-Return in `reuseTile()` greift deshalb bei bewegter Kamera nie. Jedes wiederverwendete Tile geht durch `updateTile()`, und `update()` touched `quadSize`, `texCoords` und `instancePosition` vollständig. Im Hauptanwendungsfall, dem kontinuierlichen Scrollen, bedeutet das pro Frame einen Upload aller Instanzdaten, obwohl sich die `view` eines Tiles nur bei einem Grid-Wechsel ändert.
Empfehlung: `changed` nur bei einem Grid-Wechsel setzen und in `TileSpritesFactory.update()` nur die Attribute touchen, die seit dem letzten Frame geschrieben wurden.

**API-051 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:314-315** (weitere: `CameraBasedVisibility.ts:155`, `Map2DTileStreamer.ts:141`) — Festlegen, ob CameraBasedVisibility die Kamera des Aufrufers nachführen darf
`camera.updateProjectionMatrix()` überschreibt pro Frame eine von außen gesetzte `projectionMatrix`, etwa bei Jitter oder einer eigenen Projektion. Außerdem legt `computeVisibleTiles` die private `#tileCoords`-Instanz des Streamers im öffentlichen, beschreibbaren Feld `map2dTileCoords` ab. Wer darüber schreibt, umgeht die Setter des Streamers, die bei einem Grid-Wechsel clearen.
Empfehlung: Projektion nicht selbst aktualisieren und die Verantwortung in der TSDoc beim Aufrufer festhalten. `map2dTileCoords` nur lesend exponieren.

**API-037 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:114-119** — Das lookAtCenter-TSDoc korrigieren, das den gegenteiligen Default nennt
Laut TSDoc ist `true` der Default, der Code setzt `false`. Die Beschreibung »cumulated« erklärt das Verhalten auch nicht: tatsächlich wird der erste Probe-Punkt subtrahiert. Wer der Doku folgt, bekommt das andere Verhalten.
Empfehlung: Default auf `false` korrigieren und die Semantik (Verschiebung um den Mittelpunkt-Probe-Punkt) ausformulieren.

**BUG-103 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:659-666** (weitere: `CameraBasedVisibility.ts:22`) — frustumBoxScale in beiden Achsen gleich skalieren
`sw = width*scale - width` wird auf beiden Seiten abgezogen bzw. addiert. Die Box wird dadurch `width·(2·scale−1)` breit, beim Default 1,1 also 1,2-fach. Die Tiefe skaliert dagegen korrekt mit `scale`. Das widerspricht der TSDoc und macht den Parameter uneinheitlich.
Empfehlung: `sw = (width*scale - width) / 2` (analog `sh`) oder die TSDoc auf »expands each side by (scale−1)·size« ändern.

**PERF-028 · info · Optimierungspotenzial · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:482-549** (weitere: `Map2DTileStreamer.ts:140`, `RectangularVisibilityArea.ts:113-158`, `Map2DSpatialHashGrid.ts:83`) — Allokationen pro Sichtbarkeitsberechnung in Scratch-Felder verlegen
Bei bewegter Kamera läuft die Berechnung jeden Frame und erzeugt dabei vier bis fünf Arrays und ein Result-Objekt, `findWithin` zusätzlich ein Set. Andere Scratch-Strukturen im Modul werden bewusst gepoolt. Das ist kein Defekt, aber GC-Druck im Frame-Loop.
Empfehlung: Result-Objekt und Listen wiederverwenden, was der Vertrag in `types.ts:104-110` ausdrücklich erlaubt. `findWithin` mit `out`-Parameter anbieten.

**TYPE-011 · info · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:430** — findVisibleTiles() deklariert ein undefined, das es nie zurückgibt
Die private Methode ist als `IMap2DVisibleTiles | undefined` deklariert, hat aber genau ein `return` mit einem Objektliteral. Die tote Breite zwingt den Aufrufer zu einer Prüfung, die nie greift.
Empfehlung: Den Rückgabetyp auf `IMap2DVisibleTiles` verengen.

**DOC-024 · info · packages/twopoint5d/src/map2d/types.ts:112** — Vier Felder von IMap2DVisibleTiles ohne TSDoc zwischen dokumentierten Nachbarn
`tiles`, `removeTiles`, `reuseTiles` und `createTiles` stehen ohne TSDoc, während `offset`, `translate` und `changed` direkt daneben dokumentiert sind.
Empfehlung: Je einen Satz an die vier Felder: was die Liste enthält und gegen welchen Vorzustand sie gebildet wurde.

## Urteil des Reviewers

Freigegeben in Runde 2 (Reviewer-Session 3372f71d-455a-4756-9e57-4690a266df7e, Reports `paket-2.review-1.json`, `paket-2.review-2.json`). Fundstellen am Stand von 8720c67a:

- PERF-026 behoben — `changed` nur bei erster Neuberechnung und Rasterwechsel: `CameraBasedVisibility.ts:367-369`, `:416`, `:615`, `RectangularVisibilityArea.ts:186`; Slot-Touch in `TileSprites/TileSpritesFactory.ts:70-76`, kein Voll-Touch in `update()` (`:95-99`); TSDoc `types.ts:70-76`, `:171-179`; Spec `Map2DTileStreamer.spec.ts:308`, Browsertest `map2d-tile-upload.test.js:92`
- API-051 behoben — kein `updateProjectionMatrix()`, `updateMatrixWorld()` bleibt (`CameraBasedVisibility.ts:350`); Pflicht in der Klassen-TSDoc (`:109-114`); Getter auf eigene Kopie (`:171-181`, `.copy()` in `:347`); Lookbook `map2d-cam-visi.ts:25`; Migration Guide `CHANGELOG.md:2437-2470`
- API-037 behoben — TSDoc `CameraBasedVisibility.ts:127-134`, Wache `CameraBasedVisibility.spec.ts:701-705`
- BUG-103 behoben — `/ 2` in `CameraBasedVisibility.ts:729-730`, TSDoc `:119-124`, Regressionstest `CameraBasedVisibility.spec.ts:679`
- PERF-028 behoben — Scratch-Listen und `#result` `CameraBasedVisibility.ts:230-239`, `RectangularVisibilityArea.ts:42-49`; `#hullPoints` `CameraBasedVisibility.ts:636`; View-Center-Tupel `Map2DTileStreamer.ts:102`, `:152-154`; `out`-Set `Map2DSpatialHashGrid.ts:71-111`; `previousTiles` vor dem Leeren gelesen `CameraBasedVisibility.ts:399-406`, `:504-514`, `RectangularVisibilityArea.ts:122-152`
- TYPE-011 behoben — `findVisibleTiles(): IMap2DVisibleTiles` (`CameraBasedVisibility.ts:495`)
- DOC-024 behoben — `types.ts:133-137`, `:158-167`

Kleine Befunde: alle in Runde 2 mitbehoben (Titel `map2d-tile-upload.test.js:66`, Kommentar `TileSpritesFactory.ts:80-81`, Commit-Betreff um das `out`-Set ergänzt). Offen bleibt keiner.

Abweichungen des Implementierers vom Detailplan, vom Reviewer mitgetragen: im `changed`-Test Center `[100, 0]` statt `[400, 0]` (bei `[400, 0]` bleibt mit `makeTopDownCamera()` kein Tile im Bild, `reuseTiles` wäre leer), zusätzlich `updateRanges.length > 0` im Slot-Test, die Identitätswache in beiden Visibilitor-Specs, TSDoc an `findWithin` ohne »allocates nothing« (`getTileCoords()` gibt weiter ein Tupel zurück).
