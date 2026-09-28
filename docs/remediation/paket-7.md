# Paket 7 — Map2D-Streaming und Spatial Hash robust, Sprites-Materialtyp enger

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Nebenbefunde (aus »Offene Befunde«, alle low, alle vorbestehend): `Map2DSpatialHashGrid.ts:133`
  `out`-Set wird neu angelegt · `Map2DSpatialHashGrid.ts:66` `aabb` mit `Infinity`/`NaN` ·
  `ChunkQuadTreeNode.spec.ts:77` doppelte Testnamen · `Map2DTileStreamer.ts:200` Wurf bricht die
  `removeTiles`-Schleife ab · `Map2DTileRenderer.ts:196` `#updateDataSerial` vor `update()` ·
  `TexturedSprites.ts:57` Material-Parameter nimmt jedes three-`Material` an
- In Zug 0 dazu (gleiche Ursache, vorbestehend, in »Offene Befunde« mit »in Paket 7« eingetragen):
  `Map2DTileRenderer.ts:169`–`:187` `clearTiles()` gibt nach einem werfenden `destroyTile()` Tiles
  ein zweites Mal zurück · die Konstruktoren von `TexturedSpritesMaterial`,
  `AnimatedSpritesMaterial` und `TileSpritesMaterial` nehmen ein three-`Material` bzw. eine
  `Texture` als Parameterobjekt an
- Ziel: Spatial Hash, Streamer und Renderer bleiben bei ungültigen Eingaben und werfenden Factories
  in einem konsistenten Zustand und fragen im Frame-Takt allokationsfrei ab, und `TexturedSprites`
  wie die Sprite- und Tile-Materialien lehnen ein fremdes Material oder eine Textur als
  Parameterobjekt schon beim Typcheck ab.
- Modell: stärkste Stufe — sechs Teilaufträge in zwei Modulen, zwei davon an öffentlichen Signaturen
  und an der Fehlersemantik des Streamers, dazu CHANGELOG samt Migration Guide nach dem Ton dieses
  Repos; ein Abbruch in Runde 1 kostet hier mehr als die Stufe
- Effort: medium — jeder Schritt steht mit Namen, Werten und Testnamen unten
- Dateien:
  - `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts` samt `Map2DSpatialHashGrid.spec.ts`
  - `packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts` (nur der Block
    `Map2DSpatialHashGrid on the hot path`)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.spec.ts` (nur `:77`–`:80`)
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` samt `Map2DTileStreamer.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts` samt `Map2DTileRenderer.spec.ts`
  - `packages/twopoint5d/src/map2d/types.ts` (nur JSDoc von `IMap2DTileRenderer#hasPendingTiles`)
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesMaterial.ts` samt Spec
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts`,
    `TexturedSprites/TexturedSpritesMaterial.ts`, `AnimatedSprites/AnimatedSpritesMaterial.ts`
    samt Specs
  - `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]`)
- Verify (vom Repo-Root):
  `pnpm run ci && (cd packages/twopoint5d && for s in 1 2 3 4; do pnpm vitest --run src/map2d/Map2DSpatialHashGrid.spec.ts src/map2d/Map2DTileStreamer.spec.ts src/map2d/Map2DTileRenderer.spec.ts src/map2d/chunk-quad-tree/ChunkQuadTreeNode.spec.ts --sequence.shuffle --sequence.seed=$s || exit 1; done && for i in 1 2; do pnpm vitest --run --coverage || exit 1; done)`
  — die zwei zusätzlichen Coverage-Läufe, weil der neue Allokationstest unter Block-Coverage laufen
  muss (Lehre aus Paket 8); `pnpm run ci` prüft über `typecheck` auch die `@ts-expect-error`-Tests
- Commit (englisch, ohne Finding-IDs):

  ```
  fix!: let Map2DSpatialHashGrid refuse an aabb that is not finite and fill an out array without allocating, clear the tiles of Map2DTileStreamer after an update cycle that throws, let Map2DTileRenderer upload again after a factory update() that throws and hand every tile back once, and keep a three.js material or texture out of the options of TexturedSprites and of the sprite and tile materials

  BREAKING CHANGE: Map2DSpatialHashGrid#add() and #findWithin() throw a RangeError for an aabb whose left, top, width or height is not a finite number, and #getTiles() for a width or height that is not finite. The material argument of TexturedSprites and the options of TexturedSpritesMaterial, AnimatedSpritesMaterial and TileSpritesMaterial no longer type-check with a three.js Material, nor the options of the three materials with a Texture.
  ```

- Verlauf:
  - 2026-09-28 Zug 0: Detailplan steht · Abgleich: `Map2DSpatialHashGrid.ts:133` verschoben nach
    `:143` (sonst unverändert, gemessen 285,76 B je Abfrage) · `:66`–`:69`, `:113`–`:114`
    unverändert (Hang und OOM nachgestellt) · `ChunkQuadTreeNode.spec.ts:77`–`:80` unverändert ·
    `Map2DTileStreamer.ts:200` unverändert, reicht weiter als eingetragen (auch die Renderer hinter
    dem werfenden verlieren ihre Removes) · `Map2DTileRenderer.ts:196`–`:197` und `types.ts:79`–`:81`
    unverändert · `TexturedSprites.ts:57`/`:65` unverändert · Folgen: keine offen (alle erledigten
    Pakete `Folgen: keine`) · Queue: zwei neue Einträge mit gleicher Ursache ins Paket
    (`Map2DTileRenderer.ts:177` `clearTiles()`, drei Material-Konstruktoren), ein neuer ohne
    gleiche Ursache in die Queue (`Map2DSpatialHashGrid.ts:159` `getTile()`), `CameraBasedVisibility.ts:297`
    und `CameraBasedVisibility.spec.ts:913`/`:937` bleiben für die Drain-Runde · Messskripte:
    `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad/paket-7.zug0-messungen/`
  - 2026-09-28 Zug 1: Implementierer beauftragt (`claude -p`, opus, effort medium, Session
    `remediate-twopoint5d-p7-impl-0`), Brief `paket-7.impl-0.brief.txt`, Report nach `paket-7.impl-0.json`
  - 2026-09-28 Zug 2: Report FERTIG (Session `209e781a-e25b-4c16-91cb-287741dfc960`), 18 Dateien geändert (map2d: SpatialHashGrid, TileStreamer, TileRenderer samt Specs, types.ts, hot-path-allocations.spec.ts, ChunkQuadTreeNode.spec.ts, TileSpritesMaterial samt Spec; sprites: TexturedSprites, TexturedSpritesMaterial, AnimatedSpritesMaterial samt Specs; CHANGELOG.md), rote Läufe A1 (285,76 B), B3, D1, E1, F1 (7× TS2578) belegt · Arbeitsbaum schmutzig · Verify `paket-7.verify.sh` exit=0 (`paket-7.verify.log`: CI, Shuffle 4×106/106, Coverage 2×2348/2348)
  - 2026-09-28 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-7.diff` (1542 Zeilen), Report nach `paket-7.review-0.json`
  - 2026-09-28 Zug 3: Reviewer (Session `eb41713b-3e47-4917-9ad0-7dbd2c286c72`) freigeben · alle acht Befunde behoben · 4× klein, keine Runde · Diff `paket-7.diff`
  - 2026-09-28 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-28 Zug 5: Commit `75a1278f` (18 Dateien, Trailer `Remediation-Run: 2026-09-28`), getragen vom Verify aus Zug 2 (`paket-7.verify.log`, exit=0; seither keine Codeänderung) · Plan auf `[x]`, zwei Nebenbefunde in »Offene Befunde«

## Abgleich (Zug 0, gegen `8f79373a`)

| Befund | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| `out`-Set wird neu angelegt | verschoben | `Map2DSpatialHashGrid.ts:143` `out?.clear()` in `getTiles()`, `findWithin()` `:128`–`:131` reicht `out` durch. Gemessen gegen den Build von HEAD (`grid-out.mjs`, Node 24.21): `findWithin(aabb, out)` mit Set 285,76 B je Abfrage bei ~5 Treffern, gleich unter Block-Coverage (`NODE_V8_COVERAGE`) und ohne Inlining. Ein Prototyp mit Array-`out`, Abfrage-Stempel, `getTile()` und `Map.get()` je Treffer: 0,02 B, 0,01 B, 0,02 B in denselben drei Zuständen — die Iteration über das `Set` einer Zelle alloziert nichts. Das `out` als `Set` ist nie veröffentlicht: es steht nur in `[Unreleased]` (`CHANGELOG.md:46`), 0.21.2 kennt es nicht; im Repo nutzt es außer der Spec niemand. |
| `aabb` mit `Infinity`/`NaN` | unverändert | `Map2DSpatialHashGrid.ts:66`–`:69` (Schleife in `add()`), `:111`–`:116` `#cellsOf()`. Nachgestellt (`grid-aabb.mjs`): `add()` mit `width: Infinity` bricht mit OOM ab (Exit 134), `findWithin()` mit `width: Infinity` und `getTiles(0, 0, Infinity, 1)` laufen endlos (nach 3 s abgebrochen); `NaN` in `left` oder `width` legt das Renderable in keine Zelle, `findWithin()` über die ganze Fläche findet es nicht, `findWithin()` mit `NaN` antwortet still `undefined`. |
| doppelte Testnamen | unverändert | `ChunkQuadTreeNode.spec.ts:77`–`:80`; `B` liegt bei `x: -5, y: -10, width: 5, height: 5`, die vier Assertions prüfen `(-5, -10)` wahr, `(0, -10)` falsch, `(-2, -6)` wahr, `(-6, -6)` falsch. |
| Wurf in der `removeTiles`-Schleife | unverändert, reicht weiter | `Map2DTileStreamer.ts:200`. Der Cache-Pfad von `RectangularVisibilityArea` setzt `removeTiles = undefined` (`RectangularVisibilityArea.ts:160`), der von `CameraBasedVisibility` ebenso — die Removes des abgebrochenen Ergebnisses trägt kein späteres. Dazu: der Wurf verlässt die Schleife über `this.renderers`; jeder Renderer **hinter** dem werfenden sieht das Ergebnis nie, bucht noch das alte `serial` und bekommt beim nächsten `update()` das Cache-Ergebnis mit gleichem neuen `serial` und ohne Removes — er behält alle Tiles, die das Ergebnis entfernt hätte. Dasselbe gilt für einen Wurf in `addTile()`, `reuseTile()`, `beginUpdatingTiles()` oder `endUpdatingTiles()`. |
| `#updateDataSerial` vor `update()` | unverändert | `Map2DTileRenderer.ts:195`–`:197`; dazu setzt `:193` `#updating = false` vor `update()`, sodass `hasPendingTiles` nach einem Wurf in `update()` `false` antwortet. Satz in `types.ts:79`–`:81` unverändert. |
| Material-Parameter von `TexturedSprites` | unverändert | `TexturedSprites.ts:57` (Typ), `:65` (`new TexturedSpritesMaterial(material)`). Mit `tsc` gegen die `.d.ts` von HEAD geprüft (`material-types.ts`): es kompilieren `new TexturedSprites(4, material)`, `new TexturedSpritesMaterial(material)`, `new AnimatedSpritesMaterial(material)`, `new TileSpritesMaterial(material)`, `new TileSpritesMaterial(texture)`, `new TexturedSpritesMaterial(texture)`; nur `new AnimatedSprites(4, material)` wird abgewiesen (Paket 2). |
| neu: `clearTiles()` gibt Tiles doppelt zurück | vorbestehend (so schon in `e7767c6d` `:130`–`:146`) | `Map2DTileRenderer.ts:177`–`:180`: die Schleife ruft `destroyTile()` für jedes Tile und leert `#tiles` erst danach. Wirft ein `destroyTile()`, bleiben alle Tiles in `#tiles`, auch die schon zurückgegebenen; der nächste `clearTiles()` (oder `dispose()`) gibt sie ein zweites Mal zurück — bei `TileSpritesFactory` ein zweites `freeVO()` auf einem Slot, den inzwischen ein anderes Tile belegen kann. Gleiche Ursache wie die zwei Streamer-/Renderer-Befunde, und Schritt D macht `clearTiles()` zum Weg zurück nach einem Wurf. |
| neu: Material-Konstruktoren | vorbestehend (Konstruktoren so schon in `e7767c6d`) | `TexturedSpritesMaterial.ts:188`, `AnimatedSpritesMaterial.ts:99`, `TileSpritesMaterial.ts:88`; gleiche Ursache wie `TexturedSprites.ts:57` (Parametertyp aus lauter optionalen Feldern, die sich mit denen eines three-`Material` bzw. einer `Texture` überschneiden, `name` genügt). |

## Vorgehen

Reihenfolge A bis F; jeder Schritt ist für sich grün. Bei jedem Bugfix zuerst der Regressionstest,
roter Lauf in den Report, dann der Fix. Kommentare und Doku englisch, ohne Rückblick auf den
Vorzustand, ohne Finding-Nummern.

### A — `Map2DSpatialHashGrid`: Abfrage in ein Array, ohne Allokation

A1. **Roter Lauf zuerst.** In `src/map2d/hot-path-allocations.spec.ts`, Block
`describe('Map2DSpatialHashGrid on the hot path')`, neuer Test `findWithin() with an out array
allocates nothing` nach dem Muster von `getTile() allocates nothing` darüber: dieselben 200 Boxen
(`new AABB2((i * 97.25) % 492, (i * 53.5) % 492, 20, 20)`) auf `new Map2DSpatialHashGrid(16, 16)`,
eine Abfrage-`AABB2` außerhalb der Runde, in der Runde je Aufruf
`query.set((i & 7) * 48, ((i >> 3) & 7) * 48, 64, 64)` und `grid.findWithin(query, out)` —
ausschließlich ganze Zahlen und Konstanten als Argumente (Konvention aus `AGENTS.md`), Treffer als
Smi zählen (`hits += out.length`), `expect(hits).toBeGreaterThan(0)`, Grenze
`BYTES_PER_CALL_LIMIT`, gemessen über `measureSettledBytes()`. Für den roten Lauf `out` zuerst als
`new Set<{aabb: AABB2}>()` gegen den unveränderten Code — Zug 0 maß so 285,76 B je Aufruf —, die
Zahl in den Report; danach auf `const out: {aabb: AABB2}[] = []` umstellen.

A2. Signaturen — das `Set`-`out` entfällt, es ist unveröffentlicht:

```ts
findWithin(aabb: AABB2): Set<Renderable> | undefined;
findWithin(aabb: AABB2, out: Renderable[]): Renderable[];
getTiles(tileX: number, tileY: number, width?: number, height?: number): Set<Renderable> | undefined;
getTiles(tileX: number, tileY: number, width: number, height: number, out: Renderable[]): Renderable[];
```

Ohne `out` antworten beide wie jetzt (neues `Set` oder `undefined`). Mit `out`: `out` wird per
`truncateArray(out)` (`src/utils/truncateArray.ts`) geleert, mit jedem gefundenen Renderable genau
einmal gefüllt und zurückgegeben — leer, wenn nichts darin liegt. Reihenfolge nicht zugesagt.

A3. Buchführung: `#cellsOfRenderable: Map<Renderable, GridCell<Renderable>[]>` wird zu
`#placements: Map<Renderable, Placement<Renderable>>` mit einem nicht exportierten

```ts
// Where `add()` put a renderable, and the last query that handed it out — so that a query hands a
// renderable of several cells out once, without a set to fill
interface Placement<Renderable> {
  readonly cells: GridCell<Renderable>[];
  queryStamp: number;
}
```

`add()` legt `{cells, queryStamp: 0}` an, `#takeOut()` liest `placement.cells`. Dazu ein Feld
`#queryStamp = 0`, das jede Abfrage mit `out` um 1 erhöht (kein Überlauf-Handling, wie `#serial` in
`CameraBasedVisibility`: 2^53 Abfragen). Die Zellen behalten ihr `Set<Renderable>` — `getTile()`
gibt es heraus.

A4. Zwei private Methoden, die ihre Grenzen **aus einem Objekt** lesen, nicht als vier Argumente
(ein Double, das als Argument in einen nicht inlinten Aufruf geht, wird geboxt; siehe die
`Schnittstellen:`-Zeile von Paket 3b im Plan):

- `#collect(range: TilesWithinCoords, out: Renderable[]): Renderable[]` — `truncateArray(out)`,
  `const stamp = ++this.#queryStamp`, Schleife über `range.tileTop … + range.rows` und
  `range.tileLeft … + range.columns`, je Zelle `this.#cells.get(x, y)`, je Renderable darin
  `this.#placements.get(renderable)`; fehlt die Placement, `throw undefinedValueError('the placement
  of a renderable in the grid')` (`src/utils/expectDefined.ts`), sonst bei
  `placement.queryStamp !== stamp` den Stempel setzen und `out.push(renderable)`.
- `#gather(range: TilesWithinCoords): Set<Renderable> | undefined` — der jetzige Pfad ohne `out`.

`findWithin()` reicht `this.#cellsOf(aabb)`; `getTiles()` schreibt `tileX`, `tileY`, `width`,
`height` in `this.#within` (`tileLeft`, `tileTop`, `columns`, `rows`) und reicht es. JSDoc beider
öffentlichen Methoden auf das Array umschreiben: geleert, jedes Renderable einmal, zurückgegeben,
leer statt `undefined`, »so a caller that asks every frame keeps one array and the query allocates
nothing«.

A5. Specs in `Map2DSpatialHashGrid.spec.ts`: die zwei Set-Tests `findWithin fills the set it is
handed and hands it back` und `findWithin hands back the empty set it is handed when nothing lies
within` ersetzen durch

- `findWithin fills the array it is handed with every renderable within once and hands it back` —
  Aufbau wie der bisherige Test (`a`, `b`, `c`, Abfrage `new AABB2(-50, -50, 100, 90)`), `out`
  vorbelegt mit einem Fremden; `a` und `b` liegen je in mehreren Zellen der Abfrage;
  `toBe(out)`, `toHaveLength(2)`, beide enthalten, der Fremde nicht
- `findWithin hands back the empty array it is handed when nothing lies within`
- `an out array handed to the next query holds what that query finds and nothing of the one before`
- `getTiles with an out array hands a renderable of several cells out once`

### B — `Map2DSpatialHashGrid`: eine `aabb`, die nicht endlich ist, wird abgewiesen

B1. Modulfunktion in `Map2DSpatialHashGrid.ts`:

```ts
// An aabb that is not finite has no cells to lie in: an infinite extent runs the loop over its
// cells without end, and NaN computes no cell at all.
function assertFiniteAABB(aabb: AABB2, what: string): void
```

prüft `left`, `top`, `width`, `height` mit `Number.isFinite()` und wirft sonst
`RangeError` mit genau diesem Text (Werte über `describeValue()` aus `src/utils/describeValue.ts`):
`` `[Map2DSpatialHashGrid] ${what} must have a finite left, top, width and height, got left ${…}, top ${…}, width ${…}, height ${…}` ``.
`what` ist ein konstantes Literal, der Text entsteht nur im Fehlerfall.

B2. Aufrufer:

- `add()`: **zuerst** eine Schleife über alle `renderables` mit
  `assertFiniteAABB(renderable.aabb, 'the aabb of a renderable')`, erst danach die bestehende
  Schleife — ein `add()`, das wirft, lässt den Grid, wie er war (auch ein schon gehaltenes
  Renderable bleibt in seinen Zellen). Kommentar mit diesem Grund.
- `findWithin()`: `assertFiniteAABB(aabb, 'the aabb of findWithin()')` vor `#cellsOf()`.
- `getTiles()`: `width` oder `height` nicht `Number.isFinite()` →
  `RangeError` `` `[Map2DSpatialHashGrid] the width and height of getTiles() must be finite numbers, got width ${…}, height ${…}` ``.

Negative Breiten/Höhen bleiben erlaubt; sie landen wie jetzt in der Eckzelle (`Math.max(1, …)` in
`#cellsOf()`). JSDoc von `add()`, `findWithin()`, `getTiles()` je um einen Satz zum `RangeError`
ergänzen; die Klassendoku »in one cell at the very least« stimmt danach.

B3. Tests in `Map2DSpatialHashGrid.spec.ts`, neuer Block `describe('an aabb that is not finite')`:

- `add() refuses an aabb with NaN in any of its four values` (über `left`, `top`, `width`,
  `height`; `toThrow(RangeError)` und der Text für einen Fall ganz)
- `add() refuses an aabb with an infinite width or height`
- `add() leaves the grid as it was when one of the renderables it is handed is refused` — ein
  gehaltenes Renderable mit geänderter `aabb` und ein ungültiges in einem Aufruf: wirft, das erste
  liegt noch in seinen alten Zellen, das zweite nirgends
- `findWithin() refuses an aabb that is not finite` (`NaN` und `Infinity`, mit und ohne `out`)
- `getTiles() refuses a width or height that is not finite`

Roter Lauf nur mit den `NaN`-Tests und dem `leaves the grid as it was`-Test: die `Infinity`-Fälle
hängen vor dem Fix den Worker auf (synchrone Endlosschleife bzw. OOM, in Zug 0 nachgestellt:
`grid-aabb.mjs`, Exit 134 und 142) — sie kommen mit dem Fix dazu, und der Report sagt das.

### C — `ChunkQuadTreeNode.spec.ts:77`–`:80`: Testnamen nach den geprüften Koordinaten

Die vier `it()`-Namen werden, in dieser Reihenfolge:
`chunk->B->containsDataAt(-5, -10)`, `chunk->B->containsDataAt(0, -10)`,
`chunk->B->containsDataAt(-2, -6)`, `chunk->B->containsDataAt(-6, -6)`. Assertions bleiben. Kein
roter Lauf (Testnamen).

### D — `Map2DTileStreamer#update()`: ein Zyklus, der wirft, räumt die Tiles

Entscheidung: nach einem Wurf **alle** Renderer beim nächsten `update()` leeren und den ganzen
Tile-Satz neu legen, über den vorhandenen Weg `clearTiles()` → `#clearTilesOnNextUpdate`. Grund: nach
dem Wurf fehlt die Information über die Removes nicht nur dem werfenden Renderer, sondern jedem
dahinter, und kein späteres Ergebnis trägt sie; einzelne Renderer nachzuführen bräuchte eine Kopie
der Removes je Renderer. Ein Wurf ist die Ausnahme, ein Neuaufbau in demselben `update()` vor dem
Rendern kostet kein Flackern, und der Weg ist über Rastertausch und Visibilitor-Wechsel erprobt.

D1. **Roter Lauf zuerst.** In `Map2DTileStreamer.spec.ts`, Block `describe('update()')`, Test
`an update cycle that throws leaves no tile it had yet to remove in any renderer`:
`new Map2DTileStreamer(100, 100)`, `visibilitor = new RectangularVisibilityArea(300, 300)`, zwei
`makeRecordingRenderer()`; beim ersten ein `removeTile`, das beim ersten Aufruf wirft, **bevor** es
das Tile aus `held` nimmt (danach das Original). `update(node)` bei Mitte `(0, 0)`, dann
`streamer.centerX = 250` (verlässt mehrere Spalten), `expect(() => streamer.update(node)).toThrow(…)`,
dann `streamer.update(node)` bei stehender Mitte. Erwartung für **beide** Renderer:
`[...renderer.held].sort()` gleich `streamer.tiles.map((tile) => tile.id).sort()`. Vor dem Fix
rot: der erste hält alle Tiles der verlassenen Spalten, der zweite ebenso.

D2. In `update()` die Schleife über `this.renderers` (`:189`–`:207`) in `try { … } catch (error) {
this.clearTiles(); throw error; }` fassen, mit einem Kommentar: die Removes, die der Zyklus noch
vor sich hatte, und das ganze Ergebnis für die Renderer dahinter trägt kein späteres Ergebnis —
der Visibilitor rechnet gegen `this.tiles`, das schon den neuen Satz hält —, also legt das nächste
`update()` alles neu.

D3. `this.#laidOutSerials.delete(tileRenderer)` vor `beginUpdatingTiles()` (`:195`–`:197`) samt
Kommentar entfällt: nach einem Wurf ersetzt der Clear-Pfad die `WeakMap` ohnehin (`:165`).
`removeTileRenderer()` behält sein `delete`.

D4. Texte nachziehen:

- Kommentar über `#laidOutSerials` (`:48`–`:52`): »…since it came on or since the tiles were
  cleared — an update cycle that throws clears them —…«; den Umbruch »Weak, because `renderers` /
  is a public set« dabei auf eine Zeile ziehen.
- JSDoc von `update()` (`:146`–`:152`): »a renderer whose last cycle threw« raus; neuer Satz: ein
  Update-Zyklus, der wirft — in einem Renderer oder in dessen Factory, `endUpdatingTiles()`
  eingeschlossen —, räumt die Tiles wie {@link clearTiles}: das nächste `update()` leert jeden
  Renderer und legt den ganzen Satz neu; der Fehler geht unverändert weiter.
- `types.ts:79`–`:81`, JSDoc `IMap2DTileRenderer#hasPendingTiles`: den Satz »A cycle that throws
  before its {@link endUpdatingTiles} counts as laid out by nobody: …« ersetzen durch die Regel aus
  D4 zweiter Punkt, bezogen auf `Map2DTileStreamer` (»…whatever the renderer answers here«).
- Die bestehenden Tests `a Map2DTileRenderer whose update cycle a throwing factory broke off gets
  its tiles on a standing view` und `a renderer whose update cycle broke off goes through the next
  update` bleiben grün (in Zug 0 nachvollzogen: beide rechnen über den Cache-Pfad mit
  `reuseTile()` → `addTile()`); schlägt einer fehl, am Test die neue Regel nachziehen, nicht die
  Regel am Test.
- `packages/twopoint5d/docs/architecture.md:170`–`:172` stimmt weiter (»in a closed cycle«) und
  bleibt.

### E — `Map2DTileRenderer`: Upload nach einem werfenden `update()`, jedes Tile einmal zurück

E1. **Rote Läufe zuerst**, in `Map2DTileRenderer.spec.ts`:

- neuer Block `describe('endUpdatingTiles()')`, Test `asks the factory to update again in the next
  cycle after its update() threw` — Factory, deren `update` beim ersten Aufruf wirft; Zyklus 1:
  `beginUpdatingTiles(pos)`, `addTile(a)`, `endUpdatingTiles()` wirft; Zyklus 2:
  `beginUpdatingTiles(pos, false)`, `reuseTile(a)`, `endUpdatingTiles()` → `update` insgesamt 2×
  aufgerufen (vor dem Fix 1×).
- im Block `describe('hasPendingTiles')`: `is true after an endUpdatingTiles() whose factory
  update() threw, and false again after the next cycle` (vor dem Fix `false` direkt nach dem Wurf).
- im Block `describe('clearTiles()')`: `hands every tile to destroyTile() once, also when a
  destroyTile() threw and the clear is repeated` — drei Tiles, `destroyTile` zeichnet jedes Tile auf
  und wirft beim zweiten Tile einmal; `clearTiles()` wirft, zweites `clearTiles()` läuft durch;
  jedes der drei Tiles genau einmal in den Aufzeichnungen (vor dem Fix das erste zweimal).

E2. `endUpdatingTiles()`:

```ts
const dataSerial = this.#dataSerial;
if (this.#updateDataSerial < dataSerial) {
  tileFactory.update();
  // only once update() has come back: one that throws leaves the upload to the next cycle
  this.#updateDataSerial = dataSerial;
}
// closed only now: a throw in update() leaves the cycle open, and hasPendingTiles says so
this.#updating = false;
```

E3. `clearTiles()`: den Serial **vor** der Schleife erhöhen (`if (this.#tiles.size > 0)
++this.#dataSerial;` — ein `destroyTile()`, das wirft, hat die Slots davor schon freigegeben, und
deren Upload darf nicht verloren gehen), dann jedes Tile **vor** seinem `destroyTile()` aus
`#tiles` nehmen (Löschen des laufenden Eintrags während der Iteration einer `Map` ist erlaubt;
`clearTiles()` ist kein Frame-Pfad), `#declined.clear()` bleibt. Kommentar: ein Tile geht genau
einmal zurück; wirft `destroyTile()`, bleiben nur die noch nicht zurückgegebenen für den nächsten
Aufruf. `dispose()` erbt das über `clearTiles()`.

E4. Texte: Kommentar über `#updating` (`:26`–`:28`) — »also one a throw broke off, before or
within endUpdatingTiles()«; JSDoc `hasPendingTiles` (`:56`–`:63`) — »…and so after a cycle a throw
broke off, in {@link endUpdatingTiles} as well: a factory whose `update()` throws is asked again in
the next one«.

### F — Material-Parameter ohne fremdes `Material` und ohne `Texture`

F1. **Roter Lauf zuerst** (`pnpm typecheck`, vor dem Fix TS2578 »Unused '@ts-expect-error'
directive« je Zeile). Tests nach dem Muster von `AnimatedSprites.spec.ts:121`–`:134` (Funktionen,
die nie laufen, `void`):

- `TexturedSprites.spec.ts`: `takes a TexturedSpritesMaterial, its parameters or a texture, no
  other three.js material (a type-level check)` — `@ts-expect-error` auf
  `new TexturedSprites(4, material)` mit `material: MeshBasicMaterial`; `new TexturedSprites(4,
  texture)` ohne Direktive (kompiliert weiter).
- `TexturedSpritesMaterial.spec.ts`, `AnimatedSpritesMaterial.spec.ts`, `TileSpritesMaterial.spec.ts`:
  je `takes its parameters, no three.js material and no texture (a type-level check)` —
  `@ts-expect-error` auf `new X(material)` und auf `new X(texture)`.

F2. Parametertypen, inline wie bei `AnimatedSprites` (kein neuer benannter Typ — `checkNameableTypes`):

- `TexturedSprites` `:57`: `material?: Texture | TexturedSpritesMaterial | (TexturedSpritesMaterialParameters & {isMaterial?: never; isTexture?: never})`
- `TexturedSpritesMaterial` `:188`: `options?: TexturedSpritesMaterialParameters & {isMaterial?: never; isTexture?: never}`
- `AnimatedSpritesMaterial` `:99`: `options?: AnimatedSpritesMaterialParameters & {isMaterial?: never; isTexture?: never}`
  (der Rest aus der Destrukturierung geht so an `super()`)
- `TileSpritesMaterial` `:88`: `options: TileSpritesMaterialParameters & {isMaterial?: never; isTexture?: never} = {}`

Je ein `@param` im JSDoc nach dem Wortlaut von `AnimatedSprites.ts:35`–`:38` (bei `TexturedSprites`:
ein `TexturedSpritesMaterial`, eine `Texture`, um die die Mesh eines baut, oder die Parameter; nur
`isMaterial` hält das fremde Material fern, die `Texture` hat ihren eigenen Zweig). Kein
Laufzeit-Check — wie bei `AnimatedSprites`.

### G — CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`, nach Skill `updating-changelog`)

- `Added` `:46` umschreiben: das optionale `out` von `Map2DSpatialHashGrid#findWithin()` und
  `#getTiles()` ist ein Array — geleert, mit jedem Renderable darin einmal gefüllt, zurückgegeben,
  leer, wenn nichts darin liegt, und die Abfrage alloziert nichts; ohne es antworten beide wie
  bisher mit einem neuen `Set` oder `undefined`. Kein Migrationshinweis: das `Set`-`out` war nie
  veröffentlicht.
- `Added` `:66` (`hasPendingTiles`): »also one a throw broke off« um den Wurf in
  `endUpdatingTiles()` ergänzen.
- `Changed` `:268` (`perf Map2DTileStreamer#update()`): »a renderer whose last cycle threw« ersetzen
  durch »every renderer after the tiles were cleared — an update cycle that throws clears them«.
- `Changed`, neu: das Material-Argument von `TexturedSprites` und die Optionen von
  `TexturedSpritesMaterial`, `AnimatedSpritesMaterial`, `TileSpritesMaterial` nehmen kein
  three-`Material` und (bei den drei Materialien) keine `Texture` an — alle Felder dieser Optionen
  sind optional, beides ging als Optionen durch und wurde als solche gelesen. `TexturedSprites`
  nimmt eine `Texture` weiter selbst an. Mit Verweis auf den Migration Guide.
- `Fixed`, neu je ein Eintrag: `Map2DTileStreamer#update()` (Wurf räumt die Tiles, Grund: die Removes
  des abgebrochenen Zyklus und das Ergebnis für die Renderer dahinter trägt kein späteres
  Ergebnis) · `Map2DTileRenderer` (`update()` der Factory, das wirft, wird im nächsten
  `endUpdatingTiles()` wiederholt, `hasPendingTiles` bis dahin `true`; `clearTiles()` und damit
  `dispose()` geben jedes Tile einmal zurück, auch wenn ein `destroyTile()` wirft und der Aufruf
  wiederholt wird) · `Map2DSpatialHashGrid` (`RangeError` für eine nicht endliche `aabb` in `add()`
  und `findWithin()`, für `width`/`height` in `getTiles()`; unendlich lief die Schleife endlos, `NaN`
  legte das Renderable in keine Zelle; `add()` prüft alle vorher). Der bestehende Eintrag
  `fix Map2DSpatialHashGrid:` (`:442`) darf stattdessen ergänzt werden.
- `Migration Guide`, neuer Abschnitt zur Typverengung aus F: wer eine `Texture` an einen der drei
  Material-Konstruktoren gab, gibt `{colorMap: texture}`; ein fremdes Material als Argument hat
  nie gewirkt und fällt weg. Ein Codeblock, der für sich steht, trägt `ts check` (`AGENTS.md`,
  »Code blocks in Markdown«).

## Findings im Volltext

**Nebenbefund · low · `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:133`** (jetzt `:143`) —
`getTiles(…, out)` und damit `findWithin(aabb, out)` leeren `out` mit `Set.clear()` und füllen es
neu; V8 legt die Hash-Tabelle des `Set` dabei jedes Mal neu an (gemessen, Node 24: 120 B je Aufruf
bis 4 Einträge, 681 B bei 9, 1 361 B bei 32), sodass die Abfrage im Frame-Takt, für die das JSDoc
`out` anbietet, auch nach dem Umbau der Zell-Schlüssel alloziert; ein Fix braucht eine Ausgabe, die
sich ohne Neuanlage leeren lässt (etwa ein Array-`out` mit Deduplizierung über einen
Abfrage-Stempel), also eine Erweiterung der öffentlichen Signatur (vorbestehend — so schon in
`e7767c6d` —, gefunden in Paket 4 Zug 0).

**Nebenbefund · low · `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:66`–`:69`, `:113`–`:114`** —
eine `aabb` mit `Infinity` in Breite oder Höhe ergibt `columns = Infinity`, `add()`/`findWithin()`
laufen endlos; mit `NaN` bleibt `Math.max(1, NaN)` `NaN`, und das Renderable landet in keiner Zelle
— gegen die Klassendoku »in one cell at the very least«; richtig wäre eine Prüfung der `aabb` in
`add()` (vorbestehend — so schon in `e7767c6d` —, gefunden in Paket 4 Zug 2).

**Nebenbefund · low · `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.spec.ts:77`–`:80`** —
vier Tests mit zwei doppelten Namen (`chunk->B->containsDataAt(5, 6)`,
`chunk->B->containsDataAt(5, 9)`), deren Koordinaten zu keiner Assertion passen (geprüft werden
`(-5, -10)`, `(0, -10)`, `(-2, -6)`, `(-6, -6)`) (Test-Lesbarkeit, vorbestehend — so schon in
`e7767c6d` —, gefunden in Paket 4 Zug 0).

**Nebenbefund · low · `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:200`** — wirft
`removeTile()` (also `destroyTile()` der Factory) mitten in der `removeTiles`-Schleife, laufen die
restlichen `removeTiles` dieses Ergebnisses nie; der Cache-Pfad beider Visibilitoren liefert danach
`removeTiles` leer, die Tiles bleiben im Renderer, belegen ihre Slots und werden außerhalb des Blicks
gezeichnet, bis ein `clearTiles()` kommt (vorbestehend — der Reuse-Durchlauf räumte sie auch vorher
nicht ab —, gefunden in Paket 4 Zug 4). Zug 0 von Paket 7: die Renderer hinter dem werfenden
verlieren die Removes ebenso, und jeder Wurf im Zyklus hat diese Wirkung.

**Nebenbefund · low · `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:196`–`:197`** —
`endUpdatingTiles()` setzt `#updateDataSerial` vor `tileFactory.update()`; wirft `update()`,
schreibt kein späterer Zyklus bei stehendem Grid die Daten erneut (`reuseTile()` schreibt bei
`tilesChanged === false` nichts, das Serial-Gate hält den Upload zurück); richtig wäre,
`#updateDataSerial` erst nach erfolgreichem `update()` zu setzen. Dazu ist der Satz in
`types.ts:79` zu `hasPendingTiles` (»before its endUpdatingTiles«) enger als das Verhalten des
Streamers, der auch einen Wurf in `endUpdatingTiles()` als nicht ausgelegt behandelt (vorbestehend —
so schon in `e7767c6d` —, gefunden in Paket 4 Zug 4).

**Nebenbefund · low · `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:57` und `:65`** —
der Material-Parameter nimmt jedes three-`Material` an, weil alle Felder von
`TexturedSpritesMaterialParameters` optional sind; `new TexturedSprites(4, new MeshBasicMaterial())`
kompiliert, und `new TexturedSpritesMaterial(material)` liest das fremde Material als
Parameterobjekt (vorbestehend, gefunden in Paket 2 Zug 2; `AnimatedSprites` schließt es mit
`& {isMaterial?: never; isTexture?: never}` aus).

**Nebenbefund · low · `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:177`–`:180`** (Zug 0
von Paket 7) — `clearTiles()` ruft `destroyTile()` für jedes Tile und leert `#tiles` erst danach;
wirft ein `destroyTile()`, bleiben alle Tiles in `#tiles`, und der nächste `clearTiles()` oder
`dispose()` gibt die schon zurückgegebenen ein zweites Mal zurück (vorbestehend, so in `e7767c6d`
`:130`–`:146`).

**Nebenbefund · low · `TexturedSpritesMaterial.ts:188`, `AnimatedSpritesMaterial.ts:99`,
`map2d/TileSprites/TileSpritesMaterial.ts:88`** (Zug 0 von Paket 7) — die Konstruktoren nehmen
ein three-`Material` und eine `Texture` als Parameterobjekt an (`tsc` gegen die `.d.ts` von HEAD:
alle sechs Kombinationen kompilieren); gleiche Ursache wie `TexturedSprites.ts:57` (vorbestehend,
Konstruktoren so in `e7767c6d`).

## Review (Zug 3, `paket-7.review-0.json`)

Urteil je Befund, Fundstellen im Stand `75a1278f`:

| Befund | Urteil | Fundstelle |
| --- | --- | --- |
| `out`-Set wird neu angelegt | behoben | `Map2DSpatialHashGrid.ts:179`–`:192` (Array-Overloads), `:201`–`:220` `#collect()`, `:25`–`:29` `Placement`; `hot-path-allocations.spec.ts` `findWithin() with an out array allocates nothing` |
| `aabb` mit `Infinity`/`NaN` | behoben | `Map2DSpatialHashGrid.ts:33`–`:39` `assertFiniteAABB`, `add()` `:90`–`:94` vor jeder Mutation, `findWithin()` `:164`, `getTiles()` `:182`–`:186` |
| doppelte Testnamen | behoben | `ChunkQuadTreeNode.spec.ts:83`–`:86` |
| Wurf in der `removeTiles`-Schleife | behoben | `Map2DTileStreamer.ts:192`–`:220` `try`/`catch` mit `clearTiles()`; Test `Map2DTileStreamer.spec.ts:417` prüft beide Renderer |
| `#updateDataSerial` vor `update()` | behoben | `Map2DTileRenderer.ts:196`–`:203`, JSDoc `types.ts`; Tests `Map2DTileRenderer.spec.ts:394`, `:705` |
| Material-Parameter von `TexturedSprites` | behoben | `TexturedSprites.ts:63`, `@ts-expect-error` in `TexturedSprites.spec.ts` |
| `clearTiles()` gibt Tiles doppelt zurück | behoben | `Map2DTileRenderer.ts:182`, `:186`–`:189`; Test `Map2DTileRenderer.spec.ts:356` |
| Material-Konstruktoren | behoben | `TexturedSpritesMaterial.ts:193`, `AnimatedSpritesMaterial.ts:104`, `TileSpritesMaterial.ts:93`, je zwei `@ts-expect-error` |

Kleine Befunde (keine Runde):

- `CHANGELOG.md:1837` — Migration Guide »A material handed in as options never had an effect« stimmt nicht: das fremde Material wurde als Parameter gelesen (`name`, `transparent`, `blending` …); der Changed-Eintrag `:60` sagt es richtig. Vorschlag: »was read as a set of parameters, never as the material, and goes away«.
- `CHANGELOG.md:1877`–`:1882` — der »After«-Block des Spatial-Hash-Abschnitts zeigt nach dem abgesicherten Aufruf noch einmal `grid.add(renderable)` mit dem `RangeError`; liest sich wie eine Empfehlung, beides zu tun.
- `AnimatedSpritesMaterial.spec.ts:106`, `:110` — »a AnimatedSpritesMaterial« statt »an AnimatedSpritesMaterial«.
- vorbestehend: `Map2DTileRenderer.ts:165`–`:166` `removeTile()` erhöht den Serial nach `destroyTile()` → »Offene Befunde« (→ Scope, Map2D).

Abweichungen des Implementierers (vom Reviewer mitgetragen): `#declined.clear()` vor der Schleife von `clearTiles()`; zweiter Migrationsabschnitt »`Map2DSpatialHashGrid` refuses an aabb that is not finite« (Skill `updating-changelog` verlangt ihn für einen Aufruf, der jetzt wirft); neuer `Fixed`-Eintrag statt Ergänzung von `fix Map2DSpatialHashGrid:`; der `clearTiles`-Test zeichnet über ein eigenes `createTile` auf.

Urteile an den neuen Queue-Einträgen: `Map2DTileStreamer.ts:134` (vom Implementierer) und `Map2DTileRenderer.ts:165` (vom Reviewer) liegen in `src/map2d/` → Scope; beide vorbestehend (`e7767c6d` `:127` bzw. `:125`–`:126`), eigene Stellen derselben Art Fehler (Zustand unter einer werfenden Factory), aber außerhalb dessen, was dieses Paket geändert hat — für die Drain-Runde.

## Anmerkungen

- Urteile an den Queue-Einträgen aus Zug 0: `Map2DTileRenderer.ts:177` und die drei
  Material-Konstruktoren → Scope (`src/map2d/`, `src/sprites/`), in dieses Paket, weil die Ursache
  dieselbe ist und Schritt D `clearTiles()` zum Rückweg nach einem Wurf macht.
  `Map2DSpatialHashGrid.ts:159` `getTile()` gibt das `Set` der Zelle selbst als veränderliches
  `Set<Renderable>` heraus → Scope, aber eigene Ursache (Kapselung, nicht Ausgabeform oder
  Eingabeprüfung) — bleibt für die Drain-Runde; der Typ `ReadonlySet<Renderable>` wäre der Fix.
- Restplan: nach Paket 7 ist kein Paket mehr offen. Für die Drain-Runde bleiben drei Einträge ohne
  Paket (`CameraBasedVisibility.ts:297`, `CameraBasedVisibility.spec.ts:913`/`:937`,
  `Map2DSpatialHashGrid.ts:159`); die ersten beiden teilen sich eine Datei.
