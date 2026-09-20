# Paket 3 — map2d: Pool-Slots und das Kachelgitter gegen stumme Ausfälle sichern

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: MEM-002 (low), MEM-003 (low), CONS-023 (low), CONS-035 (info), CONS-039 (info)
- Ziel: Ein fehlkonfiguriertes Tile-Setup wirft beim ersten Aufruf, statt
  Pool-Slots zu verlieren und danach stumm nichts mehr zu rendern.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - neu: `packages/twopoint5d/src/utils/assertPositiveFinite.ts`
  - neu: `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/Map2D.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit:

  ```
  fix(map2d): take a pool slot only for a tile that can be built, and refuse a tile grid of zero

  A tile grid whose width or height is not a finite number above 0 is refused
  where it is set, with a RangeError naming class, property and value; the
  default grid of Map2DTileStreamer and Map2DSpatialHashGrid is 1x1, the one
  Map2DTileCoordsUtil has always carried.

  TileSpritesFactory#createTile() resolves the tile set and the atlas frame
  before it takes a slot out of the instanced pool, and
  Map2DTileRenderer#addTile() updates the tile it already holds for a
  coordinate instead of replacing it and losing the slot behind it.
  ```

- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · MEM-002 unverändert, Fundstelle jetzt
    `TileSpritesFactory.ts:30-50` · MEM-003 unverändert an
    `Map2DTileRenderer.ts:50-63` · CONS-023 unverändert, Streamer-Default
    jetzt `Map2DTileStreamer.ts:97`, Util-Default `Map2DTileCoordsUtil.ts:88`,
    Setter `Map2DTileStreamer.ts:55,65` · CONS-035 unverändert an
    `RepeatingTilesProvider.ts:189` · CONS-039 unverändert an
    `Map2DTileStreamer.ts:131` (genau 130 Zeichen, `printWidth` ist 130) ·
    keine offenen `Folgen:` im Plan zu triagieren (Paket 1 und 2 melden beide
    keine) · von den neun Einträgen in »Offene Befunde« teilt keiner die
    Ursache dieses Pakets, alle bleiben liegen · Restplan unverändert
  - 2026-09-20 Zug 1: Implementierer beauftragt · opus, Effort medium ·
    `paket-3.impl-1.json`, session `02b0cb25-d2de-4833-b235-a11cfdf15dd0`
  - 2026-09-20 Zug 2: Report FERTIG · 12 Dateien geändert, 2 neu
    (`utils/assertPositiveFinite.ts`, `TileSprites/TileSpritesFactory.spec.ts`) ·
    Arbeitsbaum jetzt schmutzig · eigener `pnpm run ci`-Lauf exit=0,
    `paket-3.verify.log`
  - 2026-09-20 Zug 3: Diff `paket-3.diff` (692 Zeilen), Reviewer beauftragt (opus,
    Effort medium) · Urteil: alle fünf Findings behoben, 1 Befund `wichtig`,
    4 Befunde `klein` · `paket-3.review-1.json`

  - 2026-09-20 Zug 4, Runde 1: offen war der eine `wichtig`-Befund zum
    Kommentar über `streamer.clearTiles()` in `Map2D.ts:40-42` · er ging per
    `--resume 02b0cb25-d2de-4833-b235-a11cfdf15dd0` an denselben Implementierer
    (`paket-3.impl-2.json`) · zurück kam ein neu begründeter Kommentar in
    `Map2D.ts:40-44` ohne Semantikänderung · eigener `pnpm run ci`-Lauf exit=0
    (`paket-3.verify-2.log`) · neuer Diff `paket-3.diff-2` · gezielter Reviewer
    (sonnet, Effort medium, `paket-3.review-2.json`) erklärt den Befund für
    erledigt und meldet einen neuen der Stufe `klein` · offene Befunde 1 → 0,
    Kette endet
  - 2026-09-20 Zug 5: committet als `5c8ee91e`, 15 Dateien, +219/-14 ·
    Verify-Beleg ist der Lauf aus Runde 1, jünger als die letzte Codeänderung

## Vorgehen

Die Schritte 2 und 3 beheben Korrektheitsfehler: **erst der Regressionstest,
rot sehen, die Ausgabe des roten Laufs in den Report, dann der Fix.** Ein
einzelner Vitest-Lauf während der Arbeit geht über
`pnpm nx test twopoint5d -- src/map2d/<datei>.spec.ts`.

### Schritt 1 — CONS-023: ein Kachelgitter von 0 wird abgewiesen

Heute baut `new Map2D()` einen Streamer mit einem 0×0-Gitter.
`Map2DTileCoordsUtil` teilt durch diese Null und liefert ±Infinity- und
NaN-Kachelindizes; `RectangularVisibilityArea` landet bei
`new Uint8Array(NaN)`, `CameraBasedVisibility` bei NaN-Schlüsseln im Pool. Die
Map rendert nichts, und nichts sagt warum.

1. Neue Datei `packages/twopoint5d/src/utils/assertPositiveFinite.ts`:

   ```ts
   import {isPositiveFinite} from './isPositiveFinite.js';

   /**
    * Throws a `RangeError` naming subject, property and value unless `value` is a finite
    * number above 0 — for a size that something else is going to divide by.
    */
   export function assertPositiveFinite(value: unknown, subject: string, name: string): void {
     if (!isPositiveFinite(value)) {
       throw new RangeError(`[${subject}] ${name} must be a finite number above 0, got ${String(value)}`);
     }
   }
   ```

   **Nicht** in `utils/public-api.ts` eintragen: der Helfer bleibt intern, wie
   `isPositiveFinite` und `expectDefined`, die beide dort ebenfalls fehlen. Das
   Meldungsformat ist das von `TileSet` (`TileSet.ts:53-57`), damit eine
   Fehlkonfiguration der Bibliothek überall gleich klingt.

2. `Map2DTileCoordsUtil.ts`: `tileWidth` und `tileHeight` werden von
   öffentlichen Feldern (Zeilen 63-64) zu Accessoren über die privaten Felder
   `#tileWidth` und `#tileHeight`. Jeder Setter ruft als erstes
   `assertPositiveFinite(value, 'Map2DTileCoordsUtil', 'tileWidth')` bzw.
   `'tileHeight'` und schreibt erst danach. Der Konstruktor (Zeile 88) schreibt
   über die Setter — `this.tileWidth = tileWidth` statt direkt ins Feld —,
   damit `new Map2DTileCoordsUtil(0, 0)` ebenfalls wirft. Die Defaults `1, 1`
   bleiben, wie sie sind.

   `xOffset` und `yOffset` bleiben öffentliche Felder ohne Guard: durch einen
   Offset wird nicht geteilt, und 0 ist dort der Normalfall.

   `copy()` (Zeile 95) bleibt unverändert und läuft ab jetzt durch die Setter;
   die Quelle ist bereits geprüft, also wirft der Pfad nie.

   Je ein TSDoc-Satz an beiden Accessoren, der die Regel nennt (»a finite
   number above 0«) und den `RangeError` erwähnt. Kein Rückblick auf den
   Vorzustand.

3. `Map2DTileStreamer.ts`:
   - Konstruktor (Zeile 97): Defaults `tileWidth = 0, tileHeight = 0` werden
     `tileWidth = 1, tileHeight = 1`. Davor die beiden
     `assertPositiveFinite(tileWidth, 'Map2DTileStreamer', 'tileWidth')`-Aufrufe,
     damit `new Map2DTileStreamer(0, 0)` die Klasse nennt, die der Aufrufer in
     der Hand hält, und nicht die Util darunter.
   - Setter `tileWidth` (Zeile 55) und `tileHeight` (Zeile 65): der
     `assertPositiveFinite`-Aufruf wird die erste Zeile, **vor** der
     Gleichheitsprüfung. Ein ungültiger Wert ist ungültig, auch wenn er dem
     aktuellen gleicht; so hängt die Regel nicht am Zustand.
   - Der Kommentar über den vier Settern (Zeilen 51-54) bleibt, wie er ist.

4. `Map2DSpatialHashGrid.ts` (Zeile 23): dieselbe 0-Falle, dieselbe Util
   darunter — der Konstruktor bekommt die Defaults `1, 1` und dieselben zwei
   `assertPositiveFinite`-Aufrufe mit `'Map2DSpatialHashGrid'`. Ohne diese
   Angleichung wirft `new Map2DSpatialHashGrid()` ab Schritt 2 im Konstruktor.
   Die Klasse steht in der `public-api.ts` von `map2d`; im Repo ruft sie
   niemand ohne Argumente.

5. `Map2D.ts` bleibt unverändert. Seine Setter `tileWidth`/`tileHeight`
   (Zeilen 78, 86) reichen an den Streamer durch, dessen Guard wirft. Ein
   dritter Guard verdoppelte die Meldung, ohne einen Aufrufweg zu nennen, den
   der Streamer nicht schon nennt.

6. Specs:
   - `Map2DTileCoordsUtil.spec.ts`: der Konstruktor wirft `RangeError` für
     `0`, `-1`, `NaN` und `Infinity` als `tileWidth` und als `tileHeight`; die
     Setter ebenso; `new Map2DTileCoordsUtil()` gibt 1/1; `xOffset = 0` und
     `yOffset = 0` gehen durch.
   - `Map2DTileStreamer.spec.ts`: `new Map2DTileStreamer()` antwortet mit
     `tileWidth === 1` und `tileHeight === 1`; `new Map2DTileStreamer(0, 16)`
     wirft; ein `streamer.tileWidth = 0` wirft und lässt den vorigen Wert
     stehen.
   - `Map2DSpatialHashGrid.spec.ts`: `new Map2DSpatialHashGrid()` baut ein
     1×1-Gitter statt zu werfen; `new Map2DSpatialHashGrid(0, 100)` wirft.
   - `Map2D.spec.ts`: `map.tileWidth = 0` wirft ein `RangeError`.

### Schritt 2 — MEM-002: der Slot wird erst genommen, wenn das Tile gebaut werden kann

`VertexObjectPool#createVO()` (`VertexObjectPool.ts:121-131`) erhöht
`usedCount` in Zeile 124, bevor in `TileSpritesFactory#createTile()` die beiden
`expectDefined()`-Aufrufe für `tileSet` (Zeile 43) und den Atlas-Frame
(Zeile 45) kommen. Mit undefiniertem `tileSet` — ein erreichbarer Zustand, das
Feld ist optional und öffentlich — wirft jedes `Map2D.update()`, nachdem es
einen Slot genommen hat; der Slot wird nie zurückgegeben, weil
`Map2DTileRenderer#addTile()` ihn nie zu sehen bekommt. Nach `capacity` Frames
gibt `createVO()` `undefined` zurück, der Wurf hört auf, und die Map rendert
stumm nichts.

1. **Zuerst der Regressionstest**, neue Datei
   `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts`:

   ```ts
   const tileSprites = new TileSprites(new TileSpritesGeometry(4));
   const factory = new TileSpritesFactory(tileSprites, undefined, new RepeatingTilesProvider(1));
   const pool = tileSprites.geometry!.instancedPool;

   expect(() => factory.createTile(new Map2DTileCoords(0, 0))).toThrow();
   expect(pool.usedCount, 'usedCount after a throw').toBe(0);
   ```

   Kein Material und kein Renderer nötig: `TileSpritesGeometry` ist eine
   `InstancedVertexObjectGeometry` über Typed Arrays, und die Factory rührt das
   Material nicht an. `new Map2DTileCoords(0, 0)` bringt ein leeres `AABB2` als
   `view` mit, also laufen die beiden `setQuadSize`/`setInstancePosition`-Writes
   des Vorzustands ohne eigenen Fehler durch. Vor dem Fix steht `usedCount` auf
   1 — dieser rote Lauf gehört in den Report.

   Ein zweiter Test im selben `describe` zeigt den grünen Pfad: mit einem
   `TileSet` über `new TextureCoords(0, 0, 256, 256)` und
   `{tileWidth: 128, tileHeight: 128}` — so baut ihn
   `packages/twopoint5d-testing/test/map2d-tile-upload.test.js:48` — gibt
   `createTile()` ein Sprite zurück und `usedCount` ist 1.

2. Dann der Fix in `createTile()` (`TileSpritesFactory.ts:30-50`): `tileSet`,
   `frameId` und `texCoords` werden aufgelöst, **bevor** `createTileSprite()`
   den Slot nimmt. Die Reihenfolge danach:

   ```ts
   createTile(tileCoords: IMap2DTileCoords): TileSprite | undefined {
     const tileDataProvider = expectDefined(this.tileDataProvider, 'the tile data provider of this factory');
     const tileDataId = tileDataProvider.getTileIdAt(tileCoords.x, tileCoords.y);

     if (tileDataId === 0) return;

     const tileSet = expectDefined(this.tileSet, 'the tile set of this factory');
     const frameId = tileSet.frameId(tileDataId);
     const texCoords = expectDefined(tileSet.atlas.get(frameId), `the atlas frame of tile ${tileDataId}`).coords;

     const sprite = this.createTileSprite();

     if (sprite == null) return;

     sprite.setQuadSize([tileCoords.view.width, tileCoords.view.height]);
     sprite.setInstancePosition([tileCoords.view.left, 0, tileCoords.view.top]);
     sprite.setTexCoords([texCoords.s, texCoords.t, texCoords.u, texCoords.v]);

     return sprite;
   }
   ```

   Ein Inline-Kommentar über `createTileSprite()`, der sagt, *warum* die
   Auflösung vorne steht: was werfen kann, wirft, bevor ein Slot aus dem Pool
   geht — die Gegenbuchung zu `createVO()` ist `freeVO()`, und die liegt auf
   diesem Pfad nicht in Reichweite.

   **Abweichung von der Empfehlung:** Das Audit schlägt daneben vor, `tileSet`
   und `tileDataProvider` im Konstruktor zu verlangen. Das bricht die
   öffentliche Signatur und hilft nicht: beide sind schreibbare Eigenschaften,
   die auch nach dem Konstruktor `undefined` werden können, die Prüfung in
   `createTile()` bliebe also stehen. Die hier gewählte Umstellung bewegt keine
   Signatur.

### Schritt 3 — MEM-003: ein zweites `addTile()` ersetzt kein gehaltenes Tile

Ein zweites `addTile()` für eine id, die die Map bereits hält, ersetzt heute
den Eintrag in `#tiles`, und das vorige Tile erreicht nie `destroyTile()` — ein
geleakter Pool-Slot, der weiter zeichnet. Der Kommentar am
`Map2D#tileStreamer`-Setter (`Map2D.ts:40-42`) benennt genau diese Folge und
umgeht sie mit `clearTiles()`; der Renderer selbst hat keine Abwehr, und jeder
andere Pfad — ein eigener Visibilitor, der ein Tile zweimal in `createTiles`
listet — leakt stumm.

1. **Zuerst der Regressionstest** in `Map2DTileRenderer.spec.ts`. Die Datei
   bringt `makeTileFactory()` und eine sinon-Sandbox mit; der neue Test in
   ihrem Stil:

   ```ts
   const tileFactory = makeTileFactory();
   const renderer = new Map2DTileRenderer(tileFactory);
   const tileCoords = new Map2DTileCoords(0, 0);
   const createTile = sandbox.spy(tileFactory, 'createTile');
   const updateTile = sandbox.spy(tileFactory, 'updateTile');
   const destroyTile = sandbox.spy(tileFactory, 'destroyTile');

   renderer.beginUpdatingTiles(new Vector3(), true);
   renderer.addTile(tileCoords);
   renderer.addTile(new Map2DTileCoords(0, 0));
   renderer.endUpdatingTiles();

   expect(createTile.calledOnce, 'createTile()').toBe(true);
   expect(updateTile.calledOnce, 'updateTile()').toBe(true);
   expect(destroyTile.called, 'destroyTile()').toBe(false);
   ```

   Vor dem Fix ruft der zweite `addTile()` ein zweites `createTile()` — dieser
   rote Lauf gehört in den Report.

2. Dann der Fix in `addTile()` (`Map2DTileRenderer.ts:50`), direkt nach der
   `tileFactory === null`-Prüfung:

   ```ts
   const existing = this.#tiles.get(tileCoords.id);
   if (existing !== undefined) {
     tileFactory.updateTile(existing, tileCoords);
     ++this.#dataSerial;
     return;
   }
   ```

   Ein Inline-Kommentar dazu: ein Tile, das der Renderer für diese id schon
   hält, ist ein Slot, den er der Factory schuldet — überschreiben hieße, ihn
   zu verlieren.

   **Abweichung von der Empfehlung:** Das Audit nennt nur
   `updateTile(existing, tileCoords); return;`. Die Erhöhung von
   `#dataSerial` gehört dazu, denn `updateTile()` schreibt die Position in den
   Attributpuffer, und ohne sie lädt `endUpdatingTiles()` (Zeile 120) sie nicht
   hoch — genau so steht es im Nachbarpfad `reuseTile()` (Zeilen 75-76).

   Der `#declined`-Pfad bleibt unberührt: eine abgelehnte id steht nicht in
   `#tiles`, der neue Guard greift dort also nicht.

### Schritt 4 — CONS-035: das private Feld statt des Getters

`RepeatingTilesProvider.ts:189` liest `this.tileIds[0]![0]!` über den
öffentlichen Getter, während die Klasse an allen anderen Stellen (Zeilen 80,
86, 93, 103, 152) `this.#tileIds` liest. Eine Zeile: `this.#tileIds[0]![0]!`.

### Schritt 5 — CONS-039: der `computeVisibleTiles()`-Aufruf bricht um

`Map2DTileStreamer.ts:131` steht auf genau 130 Zeichen — der `printWidth` aus
`.prettierrc`, also bricht Prettier nicht um. Die Argumente in eine lokale
Konstante ziehen:

```ts
const viewCenter: [number, number] = [this.centerX, this.centerY];
const visible = visibilitor.computeVisibleTiles(this.tiles, viewCenter, this.#tileCoords, node.matrixWorld);
```

Der Typ `[number, number]` ist der zweite Parameter aus
`IMap2DVisibilitor#computeVisibleTiles()` (`types.ts:165-170`). Das
Array-Literal pro Frame allokiert genauso viel wie vorher; ein
wiederverwendetes Scratch-Feld wäre eine andere Änderung und gehört nicht in
dieses Paket.

### Schritt 6 — CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, nur der Abschnitt `## [Unreleased]`.
Veröffentlichte Versionsabschnitte sind unantastbar; Format ist Keep a
Changelog 1.1.0 (der Skill `updating-changelog` trägt die Regeln).

- `### Changed`: ein Eintrag über das Kachelgitter — ein `tileWidth` oder
  `tileHeight`, das kein finiter Wert über 0 ist, wird abgewiesen, wo es
  gesetzt wird (`Map2DTileCoordsUtil`, `Map2DTileStreamer`,
  `Map2DSpatialHashGrid`, und über den Streamer auch `Map2D`), mit einem
  `RangeError`, der Klasse, Eigenschaft und Wert nennt; der Default von
  `Map2DTileStreamer` und `Map2DSpatialHashGrid` ist ein 1×1-Gitter.
- `### Changed`: ein Eintrag zu `Map2DTileRenderer#addTile()` — für eine
  Koordinate, die der Renderer schon hält, schreibt es das gehaltene Tile fort,
  statt es durch ein neues zu ersetzen.
- `### Fixed`: `TileSpritesFactory#createTile()` löst Tile-Set und Atlas-Frame
  auf, bevor es einen Slot aus dem Instanced-Pool nimmt.
- `### Migration Guide`: ein Abschnitt `#### A tile grid of 0 is refused` im
  Stil der Nachbarn (Prosa, dann **Before** und **After** mit je einem
  `ts`-Block). Before: `const map = new Map2D();` — ein Gitter von 0×0, in dem
  nichts erscheint. After: die Kachelgröße setzen, oder den Default von 1×1
  nehmen; wer 0 setzt, bekommt einen `RangeError`.

## Testflächen

Alle Nachweise dieses Pakets liegen in Vitest (`*.spec.ts`). Die zweite
Testfläche (`packages/twopoint5d-testing/test/*.test.js`, echte Browser) kommt
nicht dazu: kein Shader, kein Attribut-Layout und keine Upload-Semantik ändert
sich. Was dieses Paket bewegt, ist die Slot-Buchhaltung der Pools, und die
zählt Vitest über `VertexObjectPool#usedCount` genauer ab, als ein Bild es
zeigen könnte. Die drei bestehenden Browser-Tests unter `map2d-*.test.js`
setzen `tileWidth`/`tileHeight` explizit auf 256 und laufen unverändert weiter.

## Findings im Volltext

**MEM-002 · low · `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts:30-49`** —
In TileSpritesFactory.createTile() TileSet und Atlas-Frame auflösen, bevor ein Slot aus dem Pool genommen wird

`createVO()` (VertexObjectPool.ts:121-130) erhöht `usedCount`, bevor die zwei
`expectDefined()`-Aufrufe kommen, die werfen können. Mit undefiniertem
`tileSet` (ein erreichbarer Zustand: das Feld ist optional und öffentlich)
wirft jedes `Map2D.update()`, nachdem es einen Slot genommen hat; der Slot wird
nie zurückgegeben (`Map2DTileRenderer.addTile` sieht ihn nie). Nach `capacity`
Frames liefert `createVO()` `undefined`, der Wurf hört auf, und die Map rendert
stumm nichts — eine Fehlkonfiguration, die erst schreit und dann verstummt.
Verstößt gegen »every acquiring call has a releasing counterpart« aus
resource-lifecycle.md §1.

Empfehlung: Beide `expectDefined()`-Aufrufe (tileSet, Atlas-Frame) über
`createTileSprite()` ziehen, oder die Writes in try/catch hüllen und bei Fehler
`freeVO()`. Besser noch: `tileSet` und `tileDataProvider` im Konstruktor
verlangen oder einmal in `update()` prüfen.

**MEM-003 · low · `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:50-63` (Gefahr benannt in `Map2D.ts:38-41`)** —
Map2DTileRenderer.addTile() gegen das Überschreiben eines bereits gehaltenen Tiles absichern

Ein zweites `addTile()` für eine id, die die Map bereits hält, ersetzt den
Eintrag, und das vorige Tile erreicht nie `destroyTile()` — ein geleakter
Pool-Slot, der weiter zeichnet. Der Kommentar am `Map2D.tileStreamer`-Setter
nennt genau diese Konsequenz und umgeht sie mit `clearTiles()`; der Renderer
selbst hat keine Abwehr, jeder andere Pfad (der Visibilitor-Wechsel aus
BUG-072, ein eigener Visibilitor, der ein Tile zweimal in `createTiles`
listet) leakt stumm.

Empfehlung: Am Anfang von `addTile()`:
`const existing = this.#tiles.get(tileCoords.id); if (existing !== undefined) { tileFactory.updateTile(existing, tileCoords); return; }`
(oder destroy-then-create). Eine Spec: zweimal `addTile` mit denselben
Koordinaten → `createTile` einmal, `destroyTile` nie.

**CONS-023 · low · `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:76-78`; `Map2DTileCoordsUtil.ts:72-74, 88`; `Map2D.ts:102`** —
Die Default-Kachelgröße des Map2DTileStreamers auf 1 setzen oder ein Null-Grid abweisen

`new Map2D()` baut einen Streamer mit 0×0-Grid; `Map2DTileCoordsUtil` teilt
dadurch und liefert ±Infinity/NaN-Kachelindizes. `RectangularVisibilityArea`
endet bei `new Uint8Array(NaN)` und Null-Schleifen, `CameraBasedVisibility` bei
NaN-Schlüsseln im Pool — in beiden Fällen rendert die Map nichts, und nichts
sagt warum. Die beiden Klassen widersprechen sich im Default (0 gegen 1), und
die Setter nehmen 0 ohne Widerspruch.

Empfehlung: Den Streamer wie `Map2DTileCoordsUtil` auf 1/1 defaulten und die
Setter für `tileWidth`/`tileHeight` (und die Util) bei `<= 0` oder
nicht-endlich werfen lassen. Je eine Spec.

**CONS-035 · info · `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:189`** —
In getTileIdsWithin() das private Feld statt des Getters lesen

`getTileIdsWithin()` liest an dieser einen Stelle `this.tileIds[0]![0]!` über
den öffentlichen Getter, überall sonst `#tileIds`.

Empfehlung: `this.#tileIds` wie im Rest der Klasse.

**CONS-039 · info · `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:131`** —
Den computeVisibleTiles()-Aufruf im Map2DTileStreamer lesbar umbrechen

Der Formatter hat den Aufruf von `computeVisibleTiles(...)` auf eine Zeile von
130 Zeichen gezogen (genau die `printWidth`).

Empfehlung: Argumente in lokale Konstanten ziehen, damit Prettier umbricht.

## Abgleich (Zug 0, 2026-09-20)

Keine Datei dieses Pakets wurde von Paket 1 oder 2 angefasst
(`git diff --stat 3b673f63..HEAD` nennt keine unter `src/map2d/`). Alle fünf
Sachverhalte bestehen unverändert; verschoben haben sich nur zwei
Zeilenangaben.

| Finding | Urteil | Fundstelle heute |
| --- | --- | --- |
| MEM-002 | unverändert | `TileSpritesFactory.ts:30-50`, Wurfstellen 43 und 45 hinter `createTileSprite()` in 36 |
| MEM-003 | unverändert | `Map2DTileRenderer.ts:50-63`, Zeilen unverschoben |
| CONS-023 | unverändert, verschoben | Streamer-Default jetzt `Map2DTileStreamer.ts:97` (Audit nannte 76-78, dort stehen heute die `xOffset`-Accessoren); Setter 55 und 65; Util-Default `Map2DTileCoordsUtil.ts:88`, Teilungen 73 und 81; `Map2D.ts:106` statt 102 |
| CONS-035 | unverändert | `RepeatingTilesProvider.ts:189` |
| CONS-039 | unverändert | `Map2DTileStreamer.ts:131`, nachgemessen 130 Zeichen bei `printWidth: 130` |

Zwei Stellen kommen dazu, die das Audit nicht nennt und die dieselbe Ursache
teilen:

- `Map2DSpatialHashGrid.ts:23` trägt denselben 0-Default und reicht ihn an
  dieselbe Util durch. Ohne Angleichung wirft `new Map2DSpatialHashGrid()` ab
  Schritt 1 im Konstruktor — die Änderung wirft es um, also gehört es dazu.
- `packages/twopoint5d/CHANGELOG.md` — die Verschärfung bewegt die öffentliche
  Oberfläche und braucht `Changed`, `Fixed` und einen Migrationsabschnitt.

Triage der offenen Arbeit: Paket 1 und Paket 2 melden im Plan beide keine
offenen `Folgen:` — es gibt nichts zu verteilen. Von den neun Einträgen in
»Offene Befunde« liegen acht im Lookbook (CSS, ein Klassenname, ein
Import-Stil, eine Engine-Range) und einer in `stage/Canvas2DStage.ts`; keiner
teilt die Ursache dieses Pakets, alle bleiben für die Drain-Runde liegen.

Restplan: unverändert. Paket 4 arbeitet im selben Verzeichnis, fasst aber mit
`types.ts`, `CameraBasedVisibilityHelpers.ts`,
`RectangularVisibilityAreaHelpers.ts` und `HelpersManager.ts` keine der Dateien
dieses Pakets an; seine Spec baut `new Map2DTileCoordsUtil()` ohne Argumente
und bekommt weiterhin das 1×1-Gitter. Die Reihenfolge der offenen Pakete bleibt.

## Urteil des Reviewers (Zug 3 und Zug 4, 2026-09-20)

Alle fünf Findings behoben, je mit Fundstelle im committeten Stand:

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| MEM-002 | behoben | `TileSpritesFactory.ts:36-38` löst `tileSet`, `frameId` und `texCoords` auf, erst `:43` nimmt `createTileSprite()` den Slot; Nachweis in `TileSprites/TileSpritesFactory.spec.ts:13-21` und `:23-31` |
| MEM-003 | behoben | `Map2DTileRenderer.ts:54-63` schreibt das gehaltene Tile über `updateTile()` fort und erhöht `#dataSerial`; Spec `Map2DTileRenderer.spec.ts:146-159` |
| CONS-023 | behoben | `utils/assertPositiveFinite.ts` (nicht in der `public-api.ts`), Guards in `Map2DTileCoordsUtil.ts:77,90,117-120`, `Map2DTileStreamer.ts:58,69,104-105`, `Map2DSpatialHashGrid.ts:25-26`; Specs in `Map2DTileCoordsUtil.spec.ts:33-52` und `Map2D.spec.ts:102-106` |
| CONS-035 | behoben | `RepeatingTilesProvider.ts:189` liest `this.#tileIds[0]![0]!` |
| CONS-039 | behoben | `Map2DTileStreamer.ts:140-141`, `viewCenter` als lokale Konstante mit `[number, number]` |

Commit-Message: vom Reviewer als unverändert übernehmbar beurteilt.

### Kleine Befunde, bewusst stehengelassen

Sie lösen keine Runde aus und stehen hier, damit sie nicht verloren gehen.
Alle fünf liegen in Code, den dieses Paket angefasst hat.

1. `packages/twopoint5d/src/map2d/types.ts:65-69` — die TSDoc von
   `IMap2DTileRenderer#addTile()` bleibt bei »Add a tile to the renderer«,
   während der Nachbar `reuseTile()` (`:71-82`) seine Regel ausschreibt. Ein
   Satz dort, dass eine schon gehaltene Koordinate das gehaltene Tile
   fortschreibt, hielte die Schnittstelle mit ihrer einzigen Implementierung im
   Gleichschritt.
2. `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.spec.ts:13-16` — der
   Test »without arguments it is a 1x1 grid« prüft nur
   `getTile(0, 0) === undefined`; das gilt für jede Gittergröße. Er belegt
   allein, dass der Konstruktor nicht wirft. Ein `add()` einer 2×2-AABB und ein
   `getTiles(0, 0, 2, 2)` mit vier belegten Zellen zeigte die Kantenlänge 1.
3. `packages/twopoint5d/src/utils/assertPositiveFinite.ts:9` — die Meldung
   folgt dem Format von `TileSet`, aber nicht dessen `describeValue()`: ein
   String steht dort in Anführungszeichen, hier nackt (`got abc` statt
   `got "abc"`). Da `value` als `unknown` typisiert ist, ist der Fall
   erreichbar.
4. `packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.ts:58-59` —
   `#tileWidth!: number` und `#tileHeight!: number` schalten die
   Definite-Assignment-Prüfung ab, obwohl der Konstruktor beide über die Setter
   schreibt. Ein Initialisierer (`#tileWidth = 1`) trüge dasselbe ohne `!`.
5. `packages/twopoint5d/src/map2d/Map2D.ts:40-44` — der neu begründete
   Kommentar führt das Räumen allein auf das Gitter zurück. Ein zweiter Grund
   bleibt ungenannt: der übernehmende Streamer beginnt mit einer leeren
   Tile-Liste und schickte für ein Tile außerhalb seines ersten Blickfelds nie
   ein `removeTile()` — der Renderer hielte es für immer. Außerdem leiten sich
   bei `TileSpritesFactory` die Texturkoordinaten aus Tile-Id, Provider und
   TileSet ab, nicht aus dem Gitter; veralten kann dort nur die Quad-Größe.

### Nebenbefunde, an `git show 3b673f63:<pfad>` als vorbestehend geprüft

- `packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts:253` — der
  Fake-Visibilitor liefert neben `offset` auch `translate: new Vector3(7, 3, 11)`.
  `Map2DTileStreamer#update()` liest `translate` nirgends; der Wert suggeriert
  eine Wirkung, die es nicht gibt. Stand im Basis-Commit bereits so, nur an
  anderer Zeile.
- `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:65` —
  `if (!this.tileIds)` liest einen Getter vom Typ `number[][]`; zur Laufzeit
  ist das Feld dort noch `undefined`, der Typ sagt also das Gegenteil dessen,
  was der Ausdruck prüft. Die Zeile steht im Basis-Commit unverändert.

Urteil an der Scope-Regel für beide: `→ Scope (info)`. Die Regel des Laufs
nimmt jede Severity, und beide sind Einzeiler in Dateien, die die Drain-Runde
ohnehin öffnet. Eine eigene Ursache mit diesem Paket teilen sie nicht.
