# Paket 1 — Tile-Lebenszyklus zwischen Map2D, Streamer, Renderer und TileSpritesFactory

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-102 (medium), BUG-123 (low), CONS-052 (low), API-055 (low), TEST-015 (low), DOC-048 (info)
- Ziel: Kein Tile, kein Pool-Slot und kein Visibilitor geht beim Ab- und Anhängen von Renderern, beim Streamer-Wechsel oder durch ein falsy Tile-Handle verloren, und `TileSpritesFactory` ist mit echten Pools per Spec abgesichert.
- Modell: mittlere Stufe (`sonnet`)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts` + `Map2DTileRenderer.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` + `Map2DTileStreamer.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2D.ts` + `Map2D.spec.ts`
  - `packages/twopoint5d/src/map2d/types.ts` (nur TSDoc)
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts` (nur Specs, kein Produktivcode)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/base64toUint32Arr.spec.ts` (neu)
  - `packages/twopoint5d/CHANGELOG.md` (`Unreleased`)
- Verify: `pnpm run ci` (Gate). Schneller Zwischenlauf während der Arbeit: `pnpm nx test twopoint5d -- src/map2d`
- Commit: `fix(map2d): give the tiles back when a tile renderer comes off its streamer, move the visibilitor to the streamer taking over instead of sharing it, check held tiles by presence so a falsy tile keeps its slot, and cover TileSpritesFactory and base64toUint32Arr with specs`

## Vorab: was du wissen musst

- Lies vor der ersten Änderung `AGENTS.md` im Repo-Root und die Quellen ganz:
  `Map2D.ts`, `Map2DTileStreamer.ts`, `Map2DTileRenderer.ts`, `types.ts`,
  `TileSprites/*.ts` und die vier zugehörigen Specs. Die Zeilennummern unten
  gelten für den Stand von `HEAD` beim Start (Commit `9a97f1bc`).
- Konventionen aus `./remediation-plan.md` gelten für jede Zeile: Code,
  Kommentare, TSDoc und CHANGELOG auf Englisch; keine Finding-IDs, auch nicht
  in Testnamen oder Kommentaren; kein Satz über den Vorzustand (»no longer«,
  »now«, »used to« in Code und TSDoc vermeiden — im CHANGELOG ist »fix …«
  mit der Beschreibung des Fehlers der übliche Stil, siehe dort).
- Die englischen Wortlaute unten sind Vorlagen: glätten erlaubt, Inhalt bleibt.
- Kein Browsertest nötig: das Paket ändert Lebenszyklus-Buchhaltung in Map2D,
  Streamer und Renderer, aber keinen Rendering- oder GPU-Buffer-Code;
  `TileSpritesFactory` bekommt nur Specs. Kein Browsertest in
  `packages/twopoint5d-testing/test/` entfernt oder hängt Renderer ab.
- Bugfix-Schritte (1, 2, 3): zuerst der Regressionstest, roten Lauf mit
  `pnpm nx test twopoint5d -- src/map2d/<Datei>.spec.ts` sehen und die
  Ausgabe in den Report, dann der Fix.

## Vorgehen

### 1. Gehaltene Tiles auf Anwesenheit prüfen (BUG-123, CONS-052)

Beide Findings beschreiben denselben Defekt: `Map2DTileRenderer` fragt das
gehaltene Tile in `reuseTile()` (`Map2DTileRenderer.ts:102`, `if (tile)`) und
`removeTile()` (`:123`, `if (tile)`) auf Truthiness ab. Ein Tile `0` einer
`IMapTileFactory<number>` gilt dort als nicht gehalten: `removeTile()` ruft
`destroyTile()` nicht und lässt den Map-Eintrag stehen, `reuseTile()` fällt in
den `addTile()`-Pfad und schreibt trotz `tilesChanged === false`.

Regressionstests zuerst, in `Map2DTileRenderer.spec.ts` ein neuer Block
`describe('a factory whose tile is falsy', …)` mit einer Factory, die ihre
Tiles in Aufrufreihenfolge durchzählt und mit `0` beginnt:

```ts
function makeCountingFactory(): IMapTileFactory<number> {
  let next = 0;
  return {
    addToNode(_node: Object3D) {},
    removeFromNode(_node: Object3D) {},
    createTile(_tileCoords: IMap2DTileCoords): number {
      return next++;
    },
    updateTile(_tile: number, _tileCoords: IMap2DTileCoords) {},
    destroyTile(_tile: number) {},
    update() {},
  };
}
```

- Test `'removeTile() gives a tile 0 back to the factory'`: `addTile(c)` mit
  `c = new Map2DTileCoords(0, 0)` (liefert Tile `0`), dann
  `destroyTile`-Spy, `removeTile(c)` → `destroyTile.calledOnceWithExactly(0)`
  ist `true`. Danach `createTile`-Spy, `reuseTile(c)` → `createTile` genau
  einmal aufgerufen (die Koordinate ist abgegeben und wird neu gebaut).
  Vor dem Fix rot: `destroyTile` wird nie gerufen.
- Test `'reuseTile() leaves a tile 0 alone while the signal says nothing changed'`:
  `beginUpdatingTiles(new Vector3(), true)`, `addTile(c)`, `endUpdatingTiles()`;
  dann Spies auf `updateTile` und `update`; `beginUpdatingTiles(new Vector3(), false)`,
  `reuseTile(c)`, `endUpdatingTiles()` → `updateTile.called` und `update.called`
  sind `false`. Vor dem Fix rot: der `addTile()`-Pfad ruft `updateTile()`.

Fix in `Map2DTileRenderer.ts`:

- `:102` `if (tile) {` → `if (tile !== undefined) {`
- `:123` `if (tile) {` → `if (tile !== undefined) {`

Dieselbe Form wie `addTile()` an `:62` (`existing !== undefined`); ein
`#tiles.has()` davor wäre ein zweiter Lookup für nichts, weil `undefined` nie
als Tile gespeichert wird. **Nicht** ändern: `if (tile == null)` an `:78`. Dort
wird die Antwort der Factory geprüft, nicht ein gehaltenes Tile, und `null`
wie `undefined` heißen »kein Tile an dieser Koordinate« — das ist keine
Truthiness-Prüfung und nicht Gegenstand der Findings.

### 2. Ein Renderer verlässt seinen Streamer leer (BUG-102)

Defekt: `Map2D#removeTileRenderer()` (`Map2D.ts:121-127`) und
`Map2DTileStreamer#removeTileRenderer()` (`Map2DTileStreamer.ts:114-116`)
nehmen den Renderer heraus und lassen seine Tiles darin. Solange er
abgehängt ist, erreicht ihn weder ein `removeTiles` noch der Clear-Block in
`update()` (`Map2DTileStreamer.ts:128-136`). Wird er wieder angehängt, behält
er Tiles, die inzwischen aus dem Blick gefallen sind (Pool-Slots belegt), und
Tiles aus einem inzwischen geänderten Grid kommen als `reuse` mit alter
`quadSize` und alten `texCoords` zurück.

Entscheidung: geräumt wird beim **Abhängen im Streamer**, nicht beim erneuten
Anhängen und nicht nur in `Map2D`. Grund: `Map2DTileStreamer` ist öffentliche
API und hat denselben Defekt für jeden, der ihn direkt treibt; der Streamer
hat die Tiles hineingelegt, also gibt er sie zurück, wenn er den Renderer
loslässt. `Map2D#removeTileRenderer()` delegiert bereits an ihn und braucht
keine Codeänderung. Ein Upload wird dabei nicht erzwungen: der gehobene
Data-Serial des Renderers wird im nächsten Update-Zyklus hochgeladen, an dem er
teilnimmt; `Map2D` nimmt den Renderer-Node ohnehin aus dem Szenengraphen.

Regressionstests zuerst:

- `Map2D.spec.ts`, neuer Block `describe('removeTileRenderer()', …)`, Test
  `'a renderer taken off and added again holds only the tiles of the view it comes back to'`:
  `map.tileWidth = 100; map.tileHeight = 100;` zwei
  `makeHoldingTileRenderer()`-Instanzen `staying` und `returning`, beide
  anhängen, `map.visibilitor = new RectangularVisibilityArea(100, 100)`,
  `map.update()`; `map.removeTileRenderer(returning)`; `map.centerX = 1000;`
  `map.update()`; `map.addTileRenderer(returning)`; `map.update()` →
  `expect([...returning.held].sort()).toEqual([...staying.held].sort())`.
  Zwei Renderer sind nötig: ohne einen verbleibenden kehrt `update()` früh
  zurück und die Tiles bleiben in der Liste des Streamers. Vor dem Fix rot:
  `returning` hält zusätzlich die vier Tiles um den Ursprung.
- `Map2DTileStreamer.spec.ts`, neuer Block `describe('removeTileRenderer()', …)`:
  - `'gives the tiles back that the streamer laid out in the renderer it lets go'`:
    `makeRecordingRenderer()`, `makeCachingVisibilitor([tileA, tileB])`,
    `update(new Object3D())`, dann `removeTileRenderer(renderer)` →
    `renderer.cleared` ist `1`, `renderer.held.size` ist `0`. Vor dem Fix rot.
    (`tileA`/`tileB` stehen bisher im `describe('update()')`-Block; für den
    neuen Block entweder dort hineinsetzen oder die beiden Konstanten auf
    Dateiebene heben.)
  - `'leaves a renderer alone that it does not hold'`:
    `removeTileRenderer(makeRecordingRenderer())` für einen nie angehängten
    Renderer → `cleared` ist `0`. Schon vor dem Fix grün; hält fest, dass nur
    ein gehaltener Renderer geräumt wird.
- `Map2D.spec.ts`, `describe('dispose()')`: der Kommentar `(f) has no subject
  here …` (`Map2D.spec.ts:272-274`) wird durch einen Test ersetzt, weil die Map
  jetzt Tiles zurückgeben lässt: `// (f) every tile laid out in a renderer goes
  back` und Test `'has every tile renderer give back the tiles laid out in it'`:
  `makeTileRenderer()`, Spy auf `clearTiles`, `addTileRenderer`, `map.dispose()`
  → `clearTiles.calledOnce` ist `true`. Vor dem Fix rot.

Fix in `Map2DTileStreamer.ts:114-116`:

```ts
  /**
   * Takes a tile renderer off this streamer and has it give back the tiles this streamer laid out
   * in it, through {@link IMap2DTileRenderer.clearTiles}. A renderer added again — here or to
   * another streamer — therefore starts empty and gets its tiles built in the grid then in place.
   * A renderer this streamer does not hold is left alone.
   */
  removeTileRenderer(renderer: IMap2DTileRenderer): void {
    // only update() takes a tile out of a renderer again: one let go with its tiles would keep
    // those that leave the view while it is away, and bring back as a reuse the tiles of a grid
    // that has changed since, with that grid's size and texture coordinates
    if (this.renderers.delete(renderer)) renderer.clearTiles();
  }
```

TSDoc an `Map2D#removeTileRenderer()` (`Map2D.ts:121`), Code unverändert:

```ts
  /**
   * Takes a tile renderer off this map: its node leaves the map, and the tile streamer has it give
   * back the tiles laid out in it. The renderer comes off empty and is not disposed — it belongs
   * to the caller, and it can be added again.
   */
```

`Map2D#dispose()` (TSDoc an `Map2D.ts:143-150`): nach dem Satz »Takes every
tile renderer off this map and leaves the scene graph.« ergänzen, dass jeder
Renderer so abgeht, wie `removeTileRenderer()` ihn hinterlässt — leer, seine
Tiles an seine Factory zurückgegeben, nicht disposed. »Releases nothing« bleibt
wahr: Zurückgeben ist kein Freigeben (`docs/resource-lifecycle.md` §1, »What
was borrowed is given back, even though it was never owned«).

Setter `Map2D#tileStreamer`: Der Aufruf `streamer.clearTiles()` am Ende
(`Map2D.ts:45`) **bleibt**, sein Kommentar (`:40-44`) stimmt aber nicht mehr —
die Renderer kommen jetzt leer vom alten Streamer. Neuer Kommentar, Vorlage:

```ts
    // the renderers came off the streamer that left empty. The visibilitor handed on last answered
    // for the tile list of that streamer, and the list of the streamer taking over is no ground for
    // its answer: clearing has the next update() hand it an empty one and lay out the whole set in
    // the grid of the streamer taking over
```

Begründung fürs Behalten: der Visibilitor hält die Tile-Liste, die er bekommt,
gegen den Stand seines eigenen letzten Aufrufs (TSDoc von
`Map2DTileStreamer#visibilitor`); der Clear kostet auf leeren Renderern einen
Durchlauf ohne Serial und ohne Upload.

Test mitziehen: `Map2D.spec.ts:86-99` `'builds the tiles again when another
streamer takes over'` zählt `clearTiles`-Aufrufe (`calledOnce`) und wird mit
dem Fix rot, weil jetzt schon das Abhängen räumt. Auf das Ergebnis umstellen,
Name bleibt: `makeHoldingTileRenderer()`, `map.tileWidth = 100;
map.tileHeight = 100;` `map.visibilitor = new RectangularVisibilityArea(100, 100)`,
`map.update()` → `held.size` größer `0`; `map.tileStreamer = new
Map2DTileStreamer(50, 50)` → `held.size` ist `0` (Meldung »right after the
switch«); `map.update()` → `held.size` größer `0`.

`IMap2DTileRenderer#clearTiles()` (TSDoc in `types.ts:107-110`): nach »It will
be called independently of the update cycle.« ergänzen:
»`Map2DTileStreamer` calls it when it takes the renderer off, and before it
lays out a whole new tile set.«

### 3. Den Visibilitor beim Streamer-Wechsel nicht teilen (API-055)

Defekt: der Setter `Map2D#tileStreamer` (`Map2D.ts:29-34`) reicht den
Visibilitor des alten Streamers weiter, nimmt ihn dem alten aber nicht ab.
Danach halten beide Streamer dieselbe Instanz, gegen die Regel in
`IMap2DVisibilitor` (»serves exactly one `Map2DTileStreamer`«, `types.ts:157-161`).

Regressionstest zuerst, `Map2D.spec.ts`, Block `describe('visibilitor')`, Test
`'the streamer that leaves gives up the visibilitor the map hands on'`:
`map.visibilitor = a` (`a = new RectangularVisibilityArea(100, 100)`);
`const leaving = map.tileStreamer;` `const taking = new Map2DTileStreamer();
taking.visibilitor = b;` (`b = new RectangularVisibilityArea(300, 300)`);
`map.tileStreamer = taking;` → `leaving.visibilitor` ist `undefined`
(Meldung »the streamer that left«), `taking.visibilitor` ist `a`,
`map.visibilitor` ist `a`. Vor dem Fix rot: `leaving.visibilitor` ist `a`.

Fix, `Map2D.ts:29-34`:

```ts
    // the visibilitor goes with the map as the view center does, and it serves one streamer at a
    // time: the streamer that leaves gives it up. A streamer taking over from one that had none
    // keeps the visibilitor it brings along
    const visibilitor = previous.visibilitor;
    if (visibilitor) {
      previous.visibilitor = undefined;
      streamer.visibilitor = visibilitor;
    }
```

`previous.visibilitor = undefined` merkt beim alten Streamer einen Clear vor;
das ist gewollt und harmlos — er hält keinen Renderer der Map mehr, und wer
ihn später wieder einsetzt, bekommt die Tiles neu gebaut.

TSDoc für das Accessor-Paar an `get tileStreamer()` (`Map2D.ts:9`) — in dieser
Datei steht die TSDoc eines Accessor-Paars am Getter, siehe `visibilitor` an
`:48-52`; die Empfehlung des Audits sagt »TSDoc des Setters«, gemeint ist
dieses Paar. Vorlage:

```ts
  /**
   * The tile streamer that lays out the tiles of this map.
   *
   * Assigning another one moves the map onto it. Every tile renderer of the map comes off the
   * streamer that leaves — empty, its tiles given back — and goes to the one taking over, and so
   * does the view center. The visibilitor goes with the map as well and serves one streamer at a
   * time: when the map has one, the streamer that leaves gives it up and the one taking over holds
   * it, in place of any visibilitor it brought along; when the map has none, the streamer taking
   * over keeps its own. The tile grid stays with the streamer that carries it, and the next
   * {@link update} lays out the whole tile set in that grid.
   */
```

### 4. TSDoc von `IMap2DTileRenderer#addTile()` (DOC-048)

`types.ts:77-80` (Audit nannte `:65`, der Block ist durch spätere TSDoc
gewandert, Inhalt unverändert). Vorlage:

```ts
  /**
   * Add a tile to the renderer.
   *
   * A coordinate the renderer already holds a tile for gets no second one: the tile it holds is
   * written on with the new coordinates, whatever `tilesChanged` said in
   * {@link beginUpdatingTiles}.
   *
   * Is called during the update cycle.
   */
```

Stimmt mit `Map2DTileRenderer#addTile()` (`:59-68`) überein: gehaltenes Tile →
`updateTile()` und Serial, ohne `tilesChanged`-Gate.

### 5. Testlücken schließen (TEST-015)

Stand gegen das Finding: `TileSprites/TileSpritesFactory.spec.ts` existiert
(150 Zeilen) und deckt ab: Wurf ohne Tile-Set ohne Slot, Slot für ein
baubares Tile, `noTileCapacity` bei vollem Pool und ohne Geometrie, Tile-id 0
→ `undefined` (nur bei vollem Pool), Größe/Position/texCoords, zwei
Zyklen mit `Map2DTileRenderer`. Von den vier (tatsächlich fünf) Einzelfällen
sind abgedeckt: vertikaler Provider mit `0 < left < cols`
(`RepeatingTilesProvider.spec.ts:453-476`), `Map2D.visibilitor`-Wechsel
(`Map2D.spec.ts:110-130`), `addTile()` für eine gehaltene id
(`Map2DTileRenderer.spec.ts:249-266`), `CameraBasedVisibility` mit
translatierter und rotierter `matrixWorld`
(`CameraBasedVisibility.spec.ts:603-645`). Offen sind nur die Punkte unten.
Das sind Tests für bestehendes Verhalten, kein Bugfix: sie dürfen sofort grün
laufen, ein roter Lauf ist hier nicht verlangt.

**5a. `TileSprites/TileSpritesFactory.spec.ts` ergänzen.** Gemeinsame
Einrichtung wie in den bestehenden Tests: `new TileSprites(new TileSpritesGeometry(n))`,
`new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128})`
(vier Frames), `RepeatingTilesProvider`.

- In `describe('createTile()')`: `'a coordinate without a tile takes no slot'` —
  Geometrie mit Kapazität 4, Provider `[[1, 0]]`, `createTile(new Map2DTileCoords(1, 0))`
  → `undefined`, `pool.usedCount` ist `0`. (Der bestehende Test prüft den Fall
  nur bei vollem Pool und ohne `usedCount`.)
- Neuer Block `describe('destroyTile()')`, Test
  `'gives the slot of a tile back to the instanced pool'`: Kapazität 4, zwei
  Tiles bauen → `usedCount` 2; `destroyTile(first)` → `usedCount` 1,
  `pool.containsVO(first)` `false`, `pool.containsVO(second)` `true`;
  `destroyTile(second)` → `usedCount` 0.
- Neuer Block `describe('update()')`. Hintergrund, damit die Tests das
  Richtige festhalten: die drei Instanzattribute `instancePosition`,
  `texCoords`, `quadSize` liegen alle im interleaved Buffer `dynamic_float32`
  (Stride 9, `vertexCount` des Instanz-Deskriptors ist 1, ein Slot belegt also
  die Elemente `[slot * 9, slot * 9 + 9)`). `geometry.getAttribute(name)` ist
  ein `InterleavedBufferAttribute`; `.data` ist der Buffer, dessen `version`
  mit jedem `needsUpdate` steigt und dessen `updateRanges` sagen, welcher Teil
  hochgeht (keine Range = ganzes Array). `freeVO()` kopiert den letzten Slot in
  den frei gewordenen (`VertexObjectPool.ts:192-216`). Die Tests halten fest,
  **was** nach jedem Schreibpfad auf die GPU muss — nicht, wie breit der Upload
  ist, wenn nichts geschrieben wurde. Helfer im Spec, nach dem Muster von
  `vertex-objects/vertex-buffers-geometry-updates.spec.ts:13-33`:
  - `bufferOf(geometry, attrName)` → `(geometry.getAttribute(attrName) as InterleavedBufferAttribute).data`
  - `uploaded(buffer)` → `buffer.clearUpdateRanges()` (stellt den Zustand nach
    einem zugestellten Upload her; ohne Renderer bleiben Ranges sonst stehen
    und `setUploadRange()` verbreitert sie)
  - `uploadsSlot(buffer, slot)` → `buffer.updateRanges.length === 0 ||
    buffer.updateRanges.some(({start, count}) => start <= slot * buffer.stride
    && start + count >= (slot + 1) * buffer.stride)`

  Tests:
  1. `'sets the instance count of the geometry to the tiles in use'`: zwei
     Tiles bauen, `factory.update()` → `geometry.instanceCount` 2;
     `destroyTile(eins)`, `factory.update()` → 1.
  2. `'a tile it builds reaches the buffer that goes to the gpu'`: `version`
     merken, `createTile(new Map2DTileCoords(0, 0, new AABB2(64, 32, 128, 96)))`,
     `factory.update()` → `version` gestiegen; über
     `geometry.getAttribute('instancePosition')` `getX(0)` 64, `getY(0)` 0,
     `getZ(0)` 32; `quadSize` `getX(0)` 128, `getY(0)` 96; `texCoords`
     `getX/getY/getZ/getW(0)` gleich `s, t, u, v` des Atlas-Frames von Tile-id 1
     (Float32-Vergleich wie im bestehenden Test `:82-85`).
  3. `'a tile it moves reaches the buffer that goes to the gpu'`: ein Tile
     bauen, `factory.update()`, `uploaded(buffer)`, `version` merken;
     `updateTile(tile, new Map2DTileCoords(0, 0, new AABB2(8, 16, 128, 96)))`,
     `factory.update()` → `version` gestiegen, `uploadsSlot(buffer, 0)`,
     `instancePosition` `getX(0)` 8, `getZ(0)` 16.
  4. `'the tile that moves into a freed slot reaches the buffer that goes to the gpu with all of its attributes'`:
     Provider `[[1, 2]]`; Tile A bei `(0, 0)` (Slot 0), Tile B bei `(1, 0)` mit
     `new AABB2(300, 400, 64, 48)` (Slot 1); `factory.update()`,
     `uploaded(buffer)`, `version` merken; `destroyTile(A)`, `factory.update()`
     → `version` gestiegen, `geometry.instanceCount` 1, `uploadsSlot(buffer, 0)`,
     und Slot 0 trägt B vollständig: `instancePosition` (300, 0, 400),
     `quadSize` (64, 48), `texCoords` des Frames von Tile-id 2.
  5. `'leaves a TileSprites without a TileSpritesGeometry alone'`: Factory über
     `new TileSprites()` → `expect(() => factory.update()).not.toThrow()`.

**5b. Neu: `chunk-quad-tree/base64toUint32Arr.spec.ts`** (die Funktion ist
über `chunk-quad-tree/public-api.ts` öffentlich und hat bisher keinen Test).
`describe('base64toUint32Arr', …)`, Werte nachgerechnet:

| Test | Aufruf | Erwartet (`Array.from(…)`) |
| --- | --- | --- |
| `'reads little-endian words by default'` | `base64toUint32Arr('AQAAAAABAAA=')` (Bytes `01 00 00 00 00 01 00 00`) | `[1, 256]` |
| `'reads big-endian words when asked to'` | `base64toUint32Arr('AQAAAAABAAA=', false)` | `[16777216, 65536]` |
| `'leaves out a trailing byte group shorter than a word'` | `base64toUint32Arr('AQAAAAkJ')` (6 Bytes) | `[1]` |
| `'reads the whole unsigned range'` | `base64toUint32Arr('/////w==')` | `[4294967295]` |
| `'answers an empty array for an empty string'` | `base64toUint32Arr('')` | `[]` |

Zusätzlich im ersten Test `toBeInstanceOf(Uint32Array)`.

### 6. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`)

Skill `updating-changelog` laden. Nichts davon steht in einem released
Abschnitt; die betroffenen `Unreleased`-Einträge werden fortgeschrieben statt
doppelt angelegt.

- `### Changed`, Eintrag `Map2D#tileStreamer` (heute Zeile 156): »the renderers
  of the map are cleared on the next `update()`« ersetzen durch: die Renderer
  kommen leer vom Streamer, der geht, und der Streamer, der übernimmt, legt die
  ganze Menge in seinem Grid aus. Ergänzen: der Visibilitor geht mit der Map —
  hat sie einen, gibt der gehende Streamer ihn ab (sein `visibilitor` antwortet
  danach `undefined`) und der übernehmende hält ihn anstelle eines eigenen; hat
  sie keinen, behält der übernehmende seinen eigenen. Eine Visibilitor-Instanz
  dient genau einem Streamer.
- `### Changed`, Eintrag `Map2D#dispose()` (heute Zeile 114): nach »The map
  takes every renderer off itself and leaves the scene graph« ergänzen, dass
  jeder Renderer leer abgeht — die in ihm ausgelegten Tiles gehen an seine
  Factory zurück — und nicht disposed wird.
- `### Fixed`, neuer Eintrag: `Map2DTileStreamer#removeTileRenderer()` und
  damit `Map2D#removeTileRenderer()` lassen den Renderer leer gehen, über
  `clearTiles()`. Beschreibung des Fehlers: ein abgehängter und wieder
  angehängter Renderer hielt Tiles, die in der Zwischenzeit aus dem Blick
  gefallen waren, und belegte damit Pool-Slots; Tiles eines inzwischen
  geänderten Grids zeichnete er mit alter Größe und alten Texturkoordinaten
  weiter.
- `### Fixed`, neuer Eintrag: `Map2DTileRenderer#removeTile()` und
  `#reuseTile()` bei einer Factory, deren Tiles falsy sein können (numerisches
  Handle `0`): `removeTile()` gibt das Tile über `destroyTile()` zurück, statt
  den Slot zu verlieren, und `reuseTile()` hält sich an die
  `tilesChanged`-Regel.
- `### Migration Guide`, neuer Unterabschnitt
  `#### Map2D#tileStreamer takes the visibilitor off the streamer that leaves`:
  zwei, drei Sätze — wer den abgelösten Streamer danach allein weitertreibt,
  weist ihm seinen Visibilitor neu zu, denn eine Instanz dient einem Streamer.
  Before/After als schlichte `ts`-Blöcke wie die übrigen Einträge dort
  (z. B. der Abschnitt zur Tile-Größe, CHANGELOG-Zeilen ~590-606). Grund für den
  Hinweis: im Release 0.21.2 behielt der abgelöste Streamer den Visibilitor
  (`git show 62174770:packages/twopoint5d/src/map2d/Map2D.ts`, Setter ab Zeile 14).

## Abgleich (Zug 0, 2026-09-25, gegen `9a97f1bc`)

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| BUG-102 | unverändert | `Map2D.ts:121-127` (`removeTileRenderer` ohne Clear), `Map2DTileStreamer.ts:114-116` (`renderers.delete` allein), `:128-136` (Clear-Block erreicht nur angehängte Renderer) |
| BUG-123 | unverändert | `Map2DTileRenderer.ts:102` und `:123`, beide `if (tile)` |
| CONS-052 | unverändert, Dublette von BUG-123 | `:102` wie oben; der Bezugspunkt `:81` (`== null` in `addTile`) steht jetzt an `:78` und bleibt, siehe Schritt 1 |
| API-055 | unverändert | `Map2D.ts:29-34`, Kommentar benennt das Verhalten |
| TEST-015 | umgeformt, größtenteils erledigt | `TileSpritesFactory.spec.ts` existiert; offen: `destroyTile`-Rundweg, id 0 ohne Slot bei nicht vollem Pool, `update()`; `base64toUint32Arr` ohne Spec. Die übrigen vier Einzelfälle sind abgedeckt (Fundstellen in Schritt 5) |
| DOC-048 | verschoben | `types.ts:77-80` statt `:65`, Text unverändert |

Triage: keine `Folgen:`-Zeilen (erstes Paket des Laufs), »Offene Befunde« leer.

Restplan geprüft, keine Änderung: kein Finding eines späteren Pakets ist
gegenstandslos geworden oder gewandert. Paket 2 hängt weiter an Paket 1 — die
`update()`-Specs aus Schritt 5a sind das Sicherungsnetz für dessen Umbau von
`TileSpritesFactory#update()`. Der Teilfall `CameraBasedVisibility` mit
bewegter `matrixWorld` ist schon abgedeckt und nimmt Paket 2 nichts ab und
nichts weg.

## Verlauf

- 2026-09-25 Zug 0: Detailplan steht · BUG-102, BUG-123, API-055 unverändert ·
  CONS-052 unverändert, Dublette von BUG-123 · DOC-048 nach `types.ts:77-80`
  gewandert · TEST-015 umgeformt: offen nur `TileSpritesFactory` (`destroyTile`,
  id 0 ohne Slot, `update()`) und `base64toUint32Arr` · keine Folgen zu
  verteilen, Queue leer · Restplan unverändert
- 2026-09-25 Zug 1: Implementierer beauftragt · sonnet/medium · Session `remediate-twopoint5d-p1-impl-1` · Report nach `paket-1.impl-1.json`
- 2026-09-25 Zug 2: Report FERTIG_MIT_VORBEHALT (Implementierer hatte den CI-Exit nicht geprüft) · 9 Dateien geändert, neu `chunk-quad-tree/base64toUint32Arr.spec.ts` · rote Läufe für Schritt 1–3 belegt · Arbeitsbaum schmutzig · eigener Verify `pnpm run ci` exit=0 (`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/387fd4e2-8d90-4d45-ac3c-b786b7534925/scratchpad/paket-1.verify.log`)
- 2026-09-25 Zug 3: Reviewer sonnet/medium, Urteil »freigeben« · alle sechs Findings behoben · 0 kritisch, 0 wichtig, 2 klein · Diff `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/387fd4e2-8d90-4d45-ac3c-b786b7534925/scratchpad/paket-1.diff` · Report `paket-1.review-1.json`
- 2026-09-25 Zug 4: keine Runde nötig (nur kleine Befunde)
- 2026-09-25 Zug 5: Commit c152bab6 auf main, Verify aus Zug 2 (exit=0) trägt, keine Änderung seither

## Urteil des Reviewers (Zug 3)

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| BUG-102 | behoben | `Map2DTileStreamer.ts:120-124` (`if (this.renderers.delete(renderer)) renderer.clearTiles()`); Specs `Map2D.spec.ts:95-115`, `:304-313`, `Map2DTileStreamer.spec.ts:141-161`; Kommentar am `streamer.clearTiles()` im Setter `Map2D#tileStreamer` angepasst |
| BUG-123 | behoben | `Map2DTileRenderer.ts:101` (`reuseTile`) und `:123` (`removeTile`) prüfen `tile !== undefined`; Specs `Map2DTileRenderer.spec.ts:442-496` |
| CONS-052 | behoben | dieselben Stellen wie BUG-123 |
| API-055 | behoben | `Map2D.ts:44-48` (`previous.visibilitor = undefined`), TSDoc am Accessor-Paar `Map2D.ts:12-22`, Spec `Map2D.spec.ts:180-193`, Migrationshinweis im CHANGELOG |
| TEST-015 | behoben | `TileSpritesFactory.spec.ts` (Koordinate ohne Tile ohne Slot, `destroyTile`-Rundweg, fünf `update()`-Specs), neu `chunk-quad-tree/base64toUint32Arr.spec.ts` (fünf Fälle); übrige Einzelfälle laut Abgleich schon abgedeckt |
| DOC-048 | behoben | `types.ts:78-84` |

Kleine Befunde (ohne Runde, stehen im Commit c152bab6):
- `packages/twopoint5d/CHANGELOG.md:346-348`: die beiden neuen `fix`-Einträge unter `### Fixed` stehen hinter einer Leerzeile und bilden eine eigene Liste; die Leerzeile bei `:346` gehört weg.
- `packages/twopoint5d/CHANGELOG.md:347`: der Eintrag zu `removeTileRenderer()` sagt nicht, was ein Aufrufer spürt — ein nur vorübergehend abgehängter Renderer baut seine Tiles nach dem Wiederanhängen neu auf; ein Halbsatz würde reichen.

Abweichungen des Implementierers: `makeVisibilitor()` und der Import `IMap2DVisibilitor` in `Map2D.spec.ts` entfernt (letzter Nutzer war der umgestellte Streamer-Wechsel-Test, Lint); Kommentare (a)–(e) im `dispose()`-Block unverändert.

## Findings im Volltext

**BUG-102 · medium · packages/twopoint5d/src/map2d/Map2D.ts:121-127** (weitere
Stellen: `Map2DTileStreamer.ts:114-116`, `Map2DTileStreamer.ts:128-136`) —
Tiles eines abgehängten Tile-Renderers beim Entfernen räumen

`removeTileRenderer()` nimmt Node und Renderer heraus, lässt aber die Tiles im
Renderer liegen. Solange er abgehängt ist, erreicht ihn kein `removeTiles` und
kein Clear nach einem Grid-Wechsel. Nach `addTileRenderer()` kommen Tiles, die
zwischendurch aus dem Blick gefallen sind, nie als `remove` an. Sie belegen
Pool-Slots und verschärfen so die Pool-Erschöpfung. Nach einem Grid-Wechsel
werden sie als `reuse` mit alter `quadSize` und alten `texCoords`
weitergezeichnet.

Empfehlung: In `removeTileRenderer()` `renderer.clearTiles()` aufrufen oder
beim erneuten Anhängen clearen. Dazu ein Spec für Abhängen und Wiederanhängen.

**BUG-123 · low · packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:102**
(weitere Stelle: `:123`) — Map2DTileRenderer prüft gehaltene Tiles auf
Truthiness statt auf Anwesenheit

Aufgefallen im Remediation-Lauf vom 2026-09-23. `reuseTile()` und
`removeTile()` fragen das gehaltene Tile mit einer Truthiness-Prüfung ab. Eine
Factory, deren Tiles falsy sein können (etwa eine numerische ID `0`), verliert
in `removeTile()` den Slot, ohne dass `destroyTile()` aufgerufen wird.

Empfehlung: Auf Anwesenheit prüfen (`tiles.has(id)` bzw. `!== undefined`)
statt auf Truthiness, dazu ein Spec mit einer Factory, die `0` als Tile
liefert.

**CONS-052 · low · packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:81**
(weitere Stelle: `:102`) — Tile-Handles auf `!== undefined` statt auf
Truthiness prüfen

`IMapTileFactory<T>` ist generisch. Eine Factory mit numerischen Handles, bei
der `0` gültig ist, wird von `addTile` angenommen (`== null`). `removeTile()`
und `reuseTile()` überspringen `0` aber: der Map-Eintrag bleibt, `destroyTile`
läuft nicht, und der Slot leakt bis zum nächsten `clearTiles()`.

Empfehlung: Überall `tile !== undefined` bzw. `this.#tiles.has(id)` verwenden.

**API-055 · low · packages/twopoint5d/src/map2d/Map2D.ts:29** — Beim
Streamer-Wechsel von Map2D keinen Visibilitor an zwei Streamer zugleich hängen

Der Setter `tileStreamer` reicht den Visibilitor des alten Streamers weiter.
Bringt der neue Streamer einen eigenen Visibilitor B mit und hielt der alte A,
überschreibt A still B, und alter wie neuer Streamer halten danach dieselbe
A-Instanz — gegen die Regel, dass eine Visibilitor-Instanz genau einem
Streamer dient. Verhalten wie vor dem Lauf, im Kommentar benannt. Aufgefallen
im Remediation-Lauf vom 2026-09-19.

Empfehlung: Dem alten Streamer den Visibilitor beim Weiterreichen abnehmen
(`previous.visibilitor = undefined`) und im TSDoc des Setters festhalten,
welcher Visibilitor gewinnt, wenn beide einen mitbringen.

**TEST-015 · low (vorher medium, Status improved) ·
packages/twopoint5d/src/map2d/TileSprites/TileSpritesGeometry.ts:1** — Die
Testlücken um TileSpritesFactory, den Visibilitor-Wechsel und den
Datenprovider schließen

Der Vorlauf führte die gesamte map2d-Orchestrierung als ungetestet;
`Map2D.spec.ts`, `Map2DTileStreamer.spec.ts`, `Map2DTileRenderer.spec.ts` und
`RectangularVisibilityArea.spec.ts` existieren inzwischen. Übrig ist
`TileSpritesFactory` — die eine Klasse, die map2d an die Vertex-Object-Pools
bindet (`createVO`/`freeVO`-Paarung, Tile-id 0 → declined, texCoords-Lookup,
`update()`) — ohne Unit-Spec; `Map2DTileRenderer.spec.ts` übt das Protokoll
nur gegen ein handgebautes Fake. Ungetestete öffentliche Verhalten beim Lesen
gefunden: vertical Provider mit `0 < left < cols` (BUG-070);
`Map2D.visibilitor`-Wechsel (BUG-072); `addTile()` für eine gehaltene id
(MEM-003); `base64toUint32Arr` Endianness/Restbytes; `CameraBasedVisibility`
mit translatierter oder rotierter `matrixWorld` (BUG-071).

Empfehlung: `TileSpritesFactory.spec.ts` mit einer echten
`TileSpritesGeometry` (keine GPU nötig): createTile/destroyTile-Rundweg
assertiert `usedCount`, id 0 gibt `undefined` ohne Slot, fehlendes tileSet
wirft ohne Slot; die vier genannten Fälle in ihre bestehenden Dateien.

**DOC-048 · info · packages/twopoint5d/src/map2d/types.ts:65** — Die TSDoc
von IMap2DTileRenderer#addTile() bleibt hinter der ihres Nachbarn zurück

Der Eintrag bleibt bei »Add a tile to the renderer«, während `reuseTile()`
(`:71-82`) seine Regel ausschreibt. Dass eine schon gehaltene Koordinate das
gehaltene Tile fortschreibt, steht nirgends — die Schnittstelle sagt weniger
als ihre einzige Implementierung tut.

Empfehlung: Einen Satz ergänzen, der den Fall der schon gehaltenen Koordinate
benennt.
