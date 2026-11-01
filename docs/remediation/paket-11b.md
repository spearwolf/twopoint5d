# Paket 11b — map2d: die Suche von CameraBasedVisibility in eine eigene Klasse

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: READ-005 (low) — im Zug 0 von Paket 11 abgeteilt
- Ziel: Die Nearest-first-Suche von `CameraBasedVisibility` — Frontier, Kept und Stop-Margin samt `#beginSearchStop()`, `#updateSearchStop()`, `#searchCanStop()` — steht in einer eigenen internen Klasse mit Feld-Objekt-Schnittstelle, ohne Verhaltensänderung und ohne neue Allokation auf dem Hot Path.
- Modell: stärkste Stufe (`opus`)
- Effort: medium
- Art: reiner Refactor. Kein Bugfix, daher kein roter Regressionstest. Der Beweis ist, dass **keine** Spec- oder Testdatei sich ändert und das Gate grün bleibt — die Allokationsspecs eingeschlossen.
- Dateien:
  - neu `packages/twopoint5d/src/map2d/NearestFirstTileSearch.ts` (intern, **nicht** in `src/map2d/public-api.ts`)
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`
  - `packages/twopoint5d/docs/architecture.md` (ein Satz in »`map2d/`«, `:235-237`)
  - unverändert, aber Beweisstücke: `src/map2d/CameraBasedVisibility.spec.ts`, `src/map2d/hot-path-allocations.spec.ts`, `src/map2d/hot-path-allocations.tilted-view.spec.ts`, `src/map2d/TileSlotPool.spec.ts`, `src/map2d/tileDistanceHeaps.spec.ts`
- Verify: `pnpm run ci`
- Commit: `refactor(twopoint5d): move the nearest-first search of CameraBasedVisibility into a class of its own`

## Abgleich (Zug 0, 2026-11-01, Stand b91ab441)

READ-005 ist **unverändert**, die Fundstelle um zwei Zeilen gewandert: das Audit
nennt `CameraBasedVisibility.ts:204`, die Klasse beginnt jetzt bei `:206`
(Paket 11 hat die Setter auf `assertFiniteAtLeast()`/`assertWholeNumberOrInfinity()`
umgestellt; die Datei hat 1299 statt 1310 Zeilen). Alle fünf Aufgaben, die die
Beschreibung aufzählt, stehen noch in der Klasse; Pool und Heaps sind ausgelagert
(`TileSlotPool.ts`, `tileDistanceHeaps.ts`). Die Suche heute:

| Teil | Stelle in `CameraBasedVisibility.ts` |
| --- | --- |
| Modulnotiz »Doubles on the path a frame loop runs« | `:61-66` |
| `NEIGHBOR_DX_DY` (nur `#pushNeighbors()` liest es) | `:75-84` |
| `SEARCH_STOP_…`, `FRUSTUM_HEIGHT_…` | `:149-158` |
| Felder `#frontier`, `#kept`, `#searchStop`, `#frustumHeight` | `:467-482` |
| `#enqueueHullTile` | `:526-527` |
| Höhenbereich des Frustums: Init / `#widenFrustumHeight()` | `:764-766` / `:795-813` |
| `#findVisibleTiles()`: `#frontier.clear()` · `makeCameraFrustum` · Seeds · Schleife · Restprüfung · `#warnCapped()` · Sortierung · Platzierung · `#kept.clear()` | `:821` · `:839` · `:856-876` · `:878-907` · `:909-920` · `:921` · `:923` · `:932-938` · `:939` |
| `#enqueue()` · `#prepareTile()` · `#updateFrustumBox()` | `:1057-1069` · `:1071-1090` · `:1092-1100` |
| `#beginSearchStop()` · `#updateSearchStop()` · `#searchCanStop()` | `:1102-1142` · `:1144-1152` · `:1154-1206` |
| `#placeTile()` (ruft `#setBox(…, false)` an `:1215`) | `:1208-1233` |
| `#pushNeighbors()` · `#warnCapped()` · `#setBox()` | `:1235-1246` · `:1248-1256` · `:1265-1298` |

Die Hinweise aus dem Plan sind am Code bestätigt: `#tileWorldMatrix` (`:379`),
`#cameraWorldPosition` (`:315`), `planeWorld` (`:322`), `#cameraFrustum` (`:374`)
und `#frustumHeight` (`:482`) werden nur in place beschrieben, nie neu zugewiesen;
`#setBox()` dient der Suche (`:1099`) und der Platzierung (`:1215`); `#warnCapped()`
nennt `CameraBasedVisibility`. Kein Spec, kein Doc und kein anderes Modul nennt eines
der verschobenen privaten Member (Suche über das Repo); die Specs greifen nur über die
öffentliche API und über Spies auf `Frustum.prototype.intersectsBox` und
`Box3.prototype.applyMatrix4` zu (`CameraBasedVisibility.spec.ts:535-536`, `:1056`,
`:1501`, `:1522`) — die Zahl und Reihenfolge dieser Aufrufe bleibt deshalb exakt.

## Entscheidungen dieses Zugs (mit Grund)

1. **Schnitt.** Die neue Klasse besitzt Frontier, Kept und Stop-Margin und führt die
   Schleife; das Säen — die Tiles der Sondenstrahlen (`:856-876`) und die Hülle
   (`#collectTilesWithinProbeHull()`) — bleibt in `CameraBasedVisibility`. Grund: das
   Säen liest die Ausgaben der Sondenstrahlen (`#probePlaneCoords`, `#probeTiles`,
   `#queryArea`, `#queryTiles`, `#hullPoints`, `#hull`, das Grid); die Suche beginnt mit
   einer gefüllten Frontier, und ihre Schnittstelle bleibt bei sechs Referenzen.
2. **Feld-Objekt-Schnittstelle.** Die Objekte, die die Suche liest, gehören weiter
   `CameraBasedVisibility` (Sondenstrahlen und Platzierung schreiben bzw. lesen sie
   auch) und gehen der Suche **einmal** im Konstruktor zu, als `TileSearchView`. Die
   Suche hält jede Referenz in einem eigenen `readonly #`-Feld.
3. **Skalare.** Ein `Float64Array(5)` ersetzt `#frustumHeight` und trägt `depth`,
   `frustumBoxScale`, `maxVisibleTiles` und den Höhenbereich des Frustums.
   `#findVisibleTiles()` schreibt die drei Konfigurationswerte einmal je Neuberechnung
   vor der Suche, nicht die Setter. Grund: ein Synchronisationspunkt, keine doppelten
   Defaults; drei Stores je Neuberechnung kosten nichts. `#seenScalars` bleibt der
   Schnappschuss des Gates und wird nicht mitbenutzt (andere Rolle).
4. **`#setBox()` wird die exportierte Modulfunktion `writeTileBox()`** im neuen Modul,
   aufgerufen von der Suche (`forFrustum = true`) und von `#placeTile()`
   (`forFrustum = false`). Grund: eine Kopie verdoppelte die Box-Rechnung; über die
   Funktion kreuzt kein Double einen Aufruf (Box3, Objekt, Float64Array, boolean).
5. **Namen bleiben.** `#beginSearchStop()`, `#updateSearchStop()`, `#searchCanStop()`,
   `#searchStop`, `#frontier`, `#prepareTile()`, `#updateFrustumBox()`,
   `#pushNeighbors()` behalten ihre Namen, damit `git diff --color-moved` die
   Verschiebung als solche zeigt. Nur `#enqueue()` wird öffentlich: `enqueue()`.
6. **`#warnCapped()` bleibt** in `CameraBasedVisibility`; `run()` antwortet `capped`.
   Sortieren, Platzieren und Leeren von `kept` bleiben dort in der heutigen Reihenfolge
   (Warnung vor dem Sortieren, wie `:921`/`:923`).
7. **Kein eigener Spec für die neue Klasse.** Der Refactor beweist sich an unveränderten
   Specs; die Limit-Tests in `CameraBasedVisibility.spec.ts` (ab `:1490`) sind die Tests
   der Suche, und ein eigener Spec müsste die Sicht nachbauen, die die Visibility
   berechnet. Die Coverage-Schwelle `src/map2d/**` bleibt gedeckt, weil derselbe Code
   dieselben Pfade läuft.
8. **Kein CHANGELOG-Eintrag.** Keine öffentliche Änderung; `#search` erscheint in der
   `.d.ts` als `#private`, `checkNameableTypes` erreicht das Modul nicht.
9. **Kein Zeit-Benchmark.** Das Projekt hält Hot Paths an Allokationen fest
   (`pnpm test:allocations`), `src/map2d/` hat keinen Bench, und der Schnitt legt keinen
   Aufruf je Tile dazu: `#enqueue()` war schon ein Methodenaufruf.
10. **`readonly`** für `#cameraWorldPosition`, `#cameraFrustum`, `#tileWorldMatrix` in
    `CameraBasedVisibility`: die Suche hält diese Objekte, ein neu zugewiesenes Feld
    ließe sie auf dem alten. Reine Typänderung.
11. **Modell stärkste Stufe, Effort medium.** Größtes Hot-Path-Modul, das
    Allokations-Gate hängt am Inlining von V8, Audit-Aufwand »L«; der Schnitt steht
    hier fest, daher nicht `high` (hoher Effort lädt zum »Verbessern« ein).

## Vorgehen

Grundregel für jeden verschobenen Methodenrumpf: **wörtlich**, nur mit den unten
genannten Ersetzungen. Arithmetische Ausdrücke bleiben zeichengleich (Reihenfolge der
Operanden, `* -0.5 * scale`, `Math.sqrt(Math.max(…))` usw.), Kommentare wandern mit.
Kein Kommentar und keine Doku sagt, dass Code verschoben wurde oder wo er vorher stand
(Konvention »kein Rückblick«).

### 1. Neues Modul `src/map2d/NearestFirstTileSearch.ts`

Imports, genau diese:

```ts
import type {Box3, Frustum, Matrix4, Plane, Vector3} from 'three/webgpu';
import type {TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import {KeptTiles, NearestFirstHeap} from './tileDistanceHeaps.js';
import type {PooledTileBox, TileSlotPool} from './TileSlotPool.js';
```

Modulkopf im Stil von `TileSlotPool.ts:10-12`:

```ts
// The nearest-first search of `CameraBasedVisibility`, on the path a frame loop runs. No double
// crosses a call here: what the search reads of a recomputation lies in the fields of objects the
// visibility writes in place, and its scalars in a typed array — see the note on doubles at the
// top of `CameraBasedVisibility.ts`.
```

Konstanten:

```ts
// where the view of a search keeps its scalars, see `TileSearchView.scalars`
export const VIEW_DEPTH = 0;
export const VIEW_FRUSTUM_BOX_SCALE = 1;
export const VIEW_MAX_VISIBLE_TILES = 2;
export const VIEW_FRUSTUM_HEIGHT_MIN = 3;
export const VIEW_FRUSTUM_HEIGHT_MAX = 4;
/** The length of {@link TileSearchView.scalars}. */
export const VIEW_SCALARS = 5;
```

Darunter, nicht exportiert: `SEARCH_STOP_HEIGHT_SQ`, `SEARCH_STOP_FOOTPRINT_DIAGONAL`,
`SEARCH_STOP_DISTANCE_SQ` mit ihrem Kommentar aus `CameraBasedVisibility.ts:149-150`
(»where the search keeps what it compares against at the limit, see `#searchCanStop()`«),
und `NEIGHBOR_DX_DY` aus `:75-84` unverändert.

Schnittstelle:

```ts
/**
 * What a search reads of the recomputation it runs in: objects `CameraBasedVisibility` builds
 * once, hands over once and writes in place before each search.
 */
export interface TileSearchView {
  /** The slots of the tiles; the search asks it for the neighbours of a tile. */
  readonly pool: TileSlotPool;
  /**
   * `matrixWorld` of the map node after the translation of the grid: takes a tile from where its
   * box is built into world space.
   */
  readonly tileWorldMatrix: Matrix4;
  /** The position of the camera in world space. */
  readonly cameraWorldPosition: Vector3;
  /** The map plane in world space. */
  readonly planeWorld: Plane;
  /** The view frustum of the camera in world space. */
  readonly cameraFrustum: Frustum;
  /**
   * `depth`, `frustumBoxScale` and `maxVisibleTiles` of the visibility, and the lowest and the
   * highest point of the view frustum along the normal of the map plane, in the local space of
   * the map node — what the frustum boxes are cut to —, at the `VIEW_…` indices. A typed array
   * holds a double as it is; a field would box every double written to it.
   */
  readonly scalars: Float64Array;
}
```

`writeTileBox()` — der Rumpf von `#setBox()` (`:1265-1298`) samt TSDoc, als
exportierte Modulfunktion vor der Klasse:

```ts
export const writeTileBox = (
  target: Box3,
  {top, left, width, height}: TilesWithinCoords,
  scalars: Float64Array,
  forFrustum: boolean,
): Box3 => { … };
```

Ersetzungen im Rumpf: `this.#frustumBoxScale` → `scalars[VIEW_FRUSTUM_BOX_SCALE]!`,
`this.#depth` → `scalars[VIEW_DEPTH]!` (an beiden Stellen; `ground` und `ceiling` lesen
`depth * -0.5 * scale` bzw. `depth * 0.5 * scale` wie heute),
`const frustumHeight = this.#frustumHeight;` samt `frustumHeight[FRUSTUM_HEIGHT_MIN]!`/
`[FRUSTUM_HEIGHT_MAX]!` → `scalars[VIEW_FRUSTUM_HEIGHT_MIN]!`/`scalars[VIEW_FRUSTUM_HEIGHT_MAX]!`.
Im TSDoc »see the note on doubles at the top of the module« → »… at the top of
`CameraBasedVisibility.ts`« (gilt für **jede** dieser Wendungen im neuen Modul).

Die Klasse:

```ts
/**
 * The nearest-first search of `CameraBasedVisibility`. From the tiles it is handed it takes the
 * nearest one of its frontier, tests the frustum box of that tile against the view frustum
 * unless the tile lies within the hull of the probe rays, keeps it when it is visible and puts
 * its eight neighbours into the frontier — until the frontier is empty or, once it keeps
 * `maxVisibleTiles` tiles, until no tile in the frontier can lead to a visible tile nearer than
 * the furthest kept one, see `#searchCanStop()`. One instance serves every recomputation of its
 * visibility and keeps the backing stores of its lists.
 */
export class NearestFirstTileSearch {
  readonly #pool: TileSlotPool;
  readonly #tileWorldMatrix: Matrix4;
  readonly #cameraWorldPosition: Vector3;
  readonly #planeWorld: Plane;
  readonly #cameraFrustum: Frustum;
  readonly #scalars: Float64Array;

  // The tiles found and not yet taken, nearest first, so the search runs from the camera outwards
  // and a cut at the limit leaves out the furthest — see `NearestFirstHeap`.
  readonly #frontier = new NearestFirstHeap<PooledTileBox>();

  /**
   * The visible tiles the search keeps, a heap with the furthest on top from `maxVisibleTiles` of
   * them on — see `KeptTiles`. After {@link run} the visibility sorts them, places them and
   * empties the list.
   */
  readonly kept = new KeptTiles<PooledTileBox>();

  // <Kommentar von `CameraBasedVisibility.ts:473-477` wörtlich, nur der letzte Satz »A typed
  // array for the reason `#seenScalars` is one.« wird »A typed array, for the reason
  // `TileSearchView.scalars` is one.« — `#seenScalars` gibt es in diesem Modul nicht>
  readonly #searchStop = new Float64Array(3);

  // the `serial` of the running recomputation, which marks a tile that entered the frontier in
  // it; a whole number, as `serial` is
  #stamp = 0;

  constructor(view: TileSearchView) {
    this.#pool = view.pool;
    this.#tileWorldMatrix = view.tileWorldMatrix;
    this.#cameraWorldPosition = view.cameraWorldPosition;
    this.#planeWorld = view.planeWorld;
    this.#cameraFrustum = view.cameraFrustum;
    this.#scalars = view.scalars;
  }

  /**
   * Starts the search of a recomputation whose `serial` is `stamp`, and empties the frontier —
   * what is left in it is what a cut at the limit did not take.
   */
  begin(stamp: number): void {
    this.#stamp = stamp;
    this.#frontier.clear();
  }

  /** <TSDoc von `#enqueue()` `:1057-1060` wörtlich> */
  enqueue(tile: PooledTileBox, insideProbeHull: boolean): void { … }

  /**
   * Runs the search over what {@link enqueue} put into the frontier and leaves the visible tiles
   * in {@link kept}. Answers whether the limit cut a visible tile: one that went for a nearer one,
   * or one left in the frontier where the search stopped at the distance.
   */
  run(): boolean { … }

  // danach privat und in dieser Reihenfolge: #prepareTile, #updateFrustumBox,
  // #beginSearchStop, #updateSearchStop, #searchCanStop, #pushNeighbors
}
```

Rümpfe und ihre Ersetzungen:

- `enqueue()` = `#enqueue()` `:1061-1069`; `const stamp = this.#serial;` →
  `const stamp = this.#stamp;`.
- `run()` = `#findVisibleTiles()` `:878-920` (Kommentar `:878-880` als erster Kommentar im
  Rumpf, Schluss »— see `#searchCanStop()`.« bleibt; Kommentar `:909-910` vor der
  Restprüfung), dann `return capped;`. Ersetzungen: `const limit = this.#maxVisibleTiles;`
  → `const limit = this.#scalars[VIEW_MAX_VISIBLE_TILES]!;`, `const kept = this.#kept;` →
  `const kept = this.kept;`. `this.#frontier`, `this.#updateFrustumBox`,
  `this.#cameraFrustum`, `this.#searchCanStop`, `this.#beginSearchStop`,
  `this.#updateSearchStop`, `this.#pushNeighbors` bleiben so geschrieben. `#warnCapped()`
  wird **nicht** gerufen.
- `#prepareTile()` = `:1071-1090` unverändert (die Felder heißen gleich); Notiz-Verweis
  auf `CameraBasedVisibility.ts`.
- `#updateFrustumBox()` = `:1092-1100`; `this.#setBox(tile.frustumBox, tile.coords, true)` →
  `writeTileBox(tile.frustumBox, tile.coords, this.#scalars, true)`. Der Kommentar
  »`#tileBoxMatrix` only translates« wird zu »the grid only translates the tile before
  `matrixWorld` does, and a box that is moved stays exact«.
- `#beginSearchStop()` = `:1102-1142`; `this.planeWorld` → `this.#planeWorld`,
  `this.#kept.furthest` → `this.kept.furthest`, `const scale = this.#frustumBoxScale;` →
  `const scale = this.#scalars[VIEW_FRUSTUM_BOX_SCALE]!;`.
- `#updateSearchStop()` = `:1144-1152`; `this.#kept.furthest` → `this.kept.furthest`.
- `#searchCanStop()` = `:1154-1206`; im TSDoc `{@link depth}` → »`depth` of
  `CameraBasedVisibility`« (in Backticks, kein `{@link}` — das Symbol ist hier nicht im
  Scope), »its setter refuses less« bleibt, letzter Absatz »see the note on doubles at the
  top of the module« → »… at the top of `CameraBasedVisibility.ts`«.
- `#pushNeighbors(tile: PooledTileBox)` = `:1235-1246` (Parametertyp `PooledTileBox` statt
  `TileBox`, damit kein Import aus `CameraBasedVisibility.ts` nötig wird);
  `this.#enqueue(` → `this.enqueue(`, im TSDoc »`#enqueue()` passes it by« → »{@link
  enqueue} passes it by«.

### 2. `CameraBasedVisibility.ts` umstellen

- Imports: `import {KeptTiles, NearestFirstHeap} from './tileDistanceHeaps.js';` entfällt;
  neu `import {NearestFirstTileSearch, VIEW_DEPTH, VIEW_FRUSTUM_BOX_SCALE,
  VIEW_FRUSTUM_HEIGHT_MAX, VIEW_FRUSTUM_HEIGHT_MIN, VIEW_MAX_VISIBLE_TILES, VIEW_SCALARS,
  writeTileBox} from './NearestFirstTileSearch.js';` (Biome sortiert die Reihenfolge; `pnpm
  format` darf sie setzen). Die übrigen Imports bleiben, auch `type Box3` (für `TileBox`).
- Modulnotiz `:61-66`: der letzte Satz »`hot-path-allocations.spec.ts` holds the class to
  it.« → »`hot-path-allocations.spec.ts` holds the class and its search,
  `NearestFirstTileSearch.ts`, to it.«
- Entfernen: `NEIGHBOR_DX_DY` (`:75-84`), `SEARCH_STOP_…` samt Kommentar (`:149-153`),
  `FRUSTUM_HEIGHT_…` samt Kommentar (`:155-158`).
- `#cameraWorldPosition` (`:315`), `#cameraFrustum` (`:374`), `#tileWorldMatrix` (`:379`)
  bekommen `readonly`.
- Felder `:467-482` (`#frontier`, `#kept`, `#searchStop`, `#frustumHeight` samt
  Kommentaren) werden an derselben Stelle ersetzt durch:

  ```ts
  // `depth`, `frustumBoxScale` and `maxVisibleTiles` as the running recomputation reads them,
  // and the height range of the view frustum along the normal of the map plane, in the local
  // space of the map node — what the frustum boxes are cut to —, at the `VIEW_…` indices of
  // `NearestFirstTileSearch.ts`. `#findVisibleTiles()` writes the first three before the search,
  // `#findPointsOnPlaneThatAreInViewFrustum()` the height range. A typed array for the reason
  // `#seenScalars` is one.
  readonly #viewScalars = new Float64Array(VIEW_SCALARS);

  // The nearest-first search, over objects this class writes in place for every recomputation —
  // declared after them, so that the initializer reads them and not `undefined`.
  readonly #search = new NearestFirstTileSearch({
    pool: this.#pool,
    tileWorldMatrix: this.#tileWorldMatrix,
    cameraWorldPosition: this.#cameraWorldPosition,
    planeWorld: this.planeWorld,
    cameraFrustum: this.#cameraFrustum,
    scalars: this.#viewScalars,
  });
  ```

  (Alle sechs Felder stehen heute oberhalb von `:467`; die Position ist deshalb richtig.)
- `#enqueueHullTile` (`:527`): `this.#enqueue(this.#pool.acquire(x, y), true)` →
  `this.#search.enqueue(this.#pool.acquire(x, y), true)`.
- `#findPointsOnPlaneThatAreInViewFrustum()` `:764-766`:
  `const frustumHeight = this.#frustumHeight; frustumHeight[FRUSTUM_HEIGHT_MIN] = Infinity;
  frustumHeight[FRUSTUM_HEIGHT_MAX] = -Infinity;` → dieselben drei Zeilen über
  `const scalars = this.#viewScalars;` mit `VIEW_FRUSTUM_HEIGHT_MIN`/`MAX`.
- `#widenFrustumHeight()` `:802-813`: dieselbe Ersetzung (`const frustumHeight =
  this.#frustumHeight;` → `const scalars = this.#viewScalars;`, Indizes `VIEW_…`); im TSDoc
  `:799` »`#setBox()` builds the boxes in« → »`writeTileBox()` builds the boxes in«.
- `#findVisibleTiles()`:
  - nach `const stamp = this.#serial;` neu `const search = this.#search;`;
  - `:819-821`: der Kommentar bleibt, `this.#frontier.clear();` → `search.begin(stamp);`;
  - direkt nach `makeCameraFrustum(this.camera!, this.#cameraFrustum);` (`:839`):

    ```ts
    // the scalars the search and `writeTileBox()` read, as they stand for this recomputation
    const scalars = this.#viewScalars;
    scalars[VIEW_DEPTH] = this.#depth;
    scalars[VIEW_FRUSTUM_BOX_SCALE] = this.#frustumBoxScale;
    scalars[VIEW_MAX_VISIBLE_TILES] = this.#maxVisibleTiles;
    ```

  - Seeds `:873`: `this.#enqueue(tile, false);` → `search.enqueue(tile, false);`;
  - `:878-923` (Kommentar, `const limit`, `const kept`, `let capped`, Schleife, Restprüfung,
    `if (capped) this.#warnCapped();`, `kept.sortNearestFirst();`) → genau:

    ```ts
    // Nearest first, and at most `maxVisibleTiles` tiles kept — see `NearestFirstTileSearch`.
    if (search.run()) this.#warnCapped();

    const kept = search.kept;
    kept.sortNearestFirst();
    ```

    Der Rest ab dem Kommentar `:925` (Platzierung, `kept.clear()`, `#removePreviousTiles`,
    `#tiles`, `evict`, Ergebnis) bleibt Zeile für Zeile.
- Entfernen: `#enqueue()`, `#prepareTile()`, `#updateFrustumBox()`, `#beginSearchStop()`,
  `#updateSearchStop()`, `#searchCanStop()`, `#pushNeighbors()`, `#setBox()`.
- `#placeTile()`: TSDoc »Expects `#prepareTile()` to have run on it.« → »Expects the search
  to have kept it.«; `:1215` `this.#setBox(tile.box, coords, false)` →
  `writeTileBox(tile.box, coords, this.#viewScalars, false)`.
- `#warnCapped()`, `#collectTilesWithinProbeHull()` (liest weiter `this.#maxVisibleTiles`),
  `#convertToPlaneCoords2D()` und alles Öffentliche bleiben unverändert, die öffentliche
  TSDoc eingeschlossen.
- Danach darf in der Datei kein `#frustumHeight`, `#frontier`, `#kept`, `#searchStop`,
  `#setBox`, `#enqueue(`, `FRUSTUM_HEIGHT_`, `SEARCH_STOP_` mehr stehen
  (`grep -nE "#frustumHeight|#frontier|#kept|#searchStop|#setBox|#enqueue\(|FRUSTUM_HEIGHT_|SEARCH_STOP_"`
  über die Datei muss leer ausgehen).

### 3. `docs/architecture.md` `:235-237`

»`CameraBasedVisibility` searches from the camera outwards over the two heaps of
`tileDistanceHeaps.ts` and keeps …« → »`CameraBasedVisibility` searches from the camera
outwards through a `NearestFirstTileSearch`, over the two heaps of `tileDistanceHeaps.ts`,
and keeps …«; den Absatz auf die Zeilenbreite seiner Nachbarn (~90 Zeichen) neu umbrechen.

### 4. Prüfen, in dieser Reihenfolge

1. `pnpm nx test twopoint5d -- src/map2d` — grün.
2. `pnpm test:allocations` — grün, insbesondere beide `CameraBasedVisibility`-Blöcke in
   `hot-path-allocations.spec.ts` und `hot-path-allocations.tilted-view.spec.ts`.
3. `git diff --stat HEAD -- '*.spec.ts' 'packages/twopoint5d-testing'` — **leer**. Ändert sich
   eine Spec, ist der Refactor nicht verhaltensneutral: zurück zum Code, nicht zur Spec.
4. `pnpm run ci` (nie parallel zu einem anderen Gate oder Build im selben Baum).

Schlägt eine Allokationsspec fehl, ist die Ursache ein Double, das jetzt einen Aufruf
kreuzt, oder ein Aufruf, den V8 nicht mehr inlinet: suchen, wo ein `number`, der kein
ganzzahliger Index ist, als Argument oder Rückgabewert über eine der neuen Grenzen geht
(`begin`, `enqueue`, `run`, `writeTileBox`, die privaten Methoden), und ihn in ein Feld des
View-Objekts oder in `#viewScalars` legen. Die Grenzen dieses Plans übergeben nur Objekte,
booleans und den ganzzahligen `stamp`. Die Schranken der Specs (`BYTES_PER_…`) werden nicht
angefasst.

## Findings im Volltext

**READ-005 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:204** — Suche von CameraBasedVisibility in eine eigene Klasse auslagern
Die Klasse umfasst 1310 Zeilen, rund 40 private Felder und fünf Aufgaben: Konfiguration mit Validierung, Cache-Gate, Probe-Strahlen auf der Ebene, die Nearest-first-Suche samt Abbruchrandberechnung (`#beginSearchStop`, `#updateSearchStop`, `#searchCanStop`) sowie Ergebnisaufbau mit Reuse/Create/Remove. Pool und Heaps sind bereits ausgelagert (`TileSlotPool`, `tileDistanceHeaps`); die Suche ist der nächste natürliche Schnitt. Die Hot-Path-Regeln (keine Doubles über Aufrufgrenzen) erschweren das, weshalb es nur eine Verbesserung ist.
Empfehlung: Die Suche (Frontier, Kept, Stop-Margin) als eigene Klasse mit Feld-Objekt-Schnittstelle extrahieren und die Allokationsspecs mitführen.

»Die Allokationsspecs mitführen« heißt hier: sie laufen unverändert über den neuen Schnitt
und belegen ihn — sie messen durch `computeVisibleTiles()` und damit durch die Suche.

## Triage im Zug 0

- `Folgen:` von Paket 11 — `TileSet.ts:287-294` (vier `assertOption()`-Aufrufe für
  `baseCoords.width`/`height` und `tileWidth`/`tileHeight`; der Plan nannte `:287-290`) und
  `DynamicAtlas.ts:568-575` (`check` in `#sizeOf()`), beide an b91ab441 nachgesehen, an der
  Basis d9b648bf schon gleich (`TileSet.ts:285-291`, `DynamicAtlas.ts:580`). Einordnung:
  **Symptom** von Paket 11 — CONS-004 dort ist »bibliotheksweit für jede Grundform-Meldung«
  behoben, die Regel in `AGENTS.md` verlangt seither die Helfer für die Grundform, und genau
  diese zwei Stellen fehlen; mit einer zu Ende geführten Ursache gäbe es den Eintrag nicht.
  Paket 11 ist committet → **Nachtragspaket 16** im Plan, `Folge von: Paket 11`. Nicht in 11b:
  dessen Commit ist ein `refactor:` in `src/map2d/`, an unveränderten Specs nachprüfbar, und
  teilt mit `src/texture/` keine Datei.
- »Offene Befunde«: kein Eintrag teilt die Ursache dieses Pakets (keiner liegt in
  `CameraBasedVisibility.ts` oder betrifft die Suche). `ChunkQuadTreeNode.ts:108` liegt in
  `src/map2d/`, aber im Quad Tree; `VOBufferPool.ts:139-142` teilt das Thema
  Zahlenprüfung mit Paket 16, nicht die Ursache (fehlende Typprüfung, `undefined` → `NaN`;
  ein Setter, der ±Infinity annimmt und klemmt, passt auf keinen Helfer) — beide bleiben.
- Restplan: 11b bleibt im Schnitt; 16 neu direkt hinter 11b (klein, unabhängig, Bibliothek
  vor Lookbook); 12 und 13 (Lookbook) berührt weder 11b (interne Klasse) noch 16
  (Meldungen mit gleichem Wortlaut).

## Verlauf

- 2026-11-01 Zug 0: Detailplan steht · READ-005 unverändert, um zwei Zeilen verschoben (Klasse `:204` → `:206`, Suche `:878-921`, `#beginSearchStop()` `:1102`, `#updateSearchStop()` `:1144`, `#searchCanStop()` `:1154`; 1299 statt 1310 Zeilen nach Paket 11) · Folge aus Paket 11 (`TileSet.ts:287-294`, `DynamicAtlas.ts:568-575`) als Symptom → Nachtragspaket 16 · kein Eintrag in »Offene Befunde« teilt die Ursache · Restplan: 16 hinter 11b, sonst unverändert
- 2026-11-01 Zug 1: Implementierer beauftragt (opus, effort medium) · Brief `paket-11b.impl-0.brief.txt`, Report `paket-11b.impl-0.json`
- 2026-11-01 Zug 2: Report FERTIG_MIT_VORBEHALT (Vorbehalt: grep aus Schritt 2 trifft die vorgeschriebenen `VIEW_FRUSTUM_HEIGHT_…`; mit Wortgrenze leer) · geändert `src/map2d/CameraBasedVisibility.ts` (1299 → 1055 Zeilen), `docs/architecture.md`, neu `src/map2d/NearestFirstTileSearch.ts` · Spec-Diff leer · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-11b.verify.log`)
- 2026-11-01 Zug 3: Reviewer opus/medium — READ-005 behoben, keine Befunde, freigegeben · Diff `paket-11b.diff`, Report `paket-11b.review-0.json`
- 2026-11-01 Zug 4: entfällt (keine offenen Befunde, 0 Runden)
- 2026-11-01 Zug 5: Commit e176d089 (3 Dateien, +446/−315) · Verify `paket-11b.verify.log` exit=0, kein Code danach geändert

## Urteil des Reviewers

- READ-005 — behoben: `NearestFirstTileSearch.ts:111-375` (Frontier `:121`, `kept` `:128`, Stop-Margin `:135`, `#beginSearchStop()` `:262`, `#updateSearchStop()` `:300`, `#searchCanStop()` `:356`), Feld-Objekt `TileSearchView` `:40-61`, einmal im Konstruktor `:141-148`; `CameraBasedVisibility.ts` baut die Suche `:464-471` und ruft `begin`/`enqueue`/`run` (`:813`, `:869`, `:516`, `:875`). Aufrufzahl und -reihenfolge von `intersectsBox`/`applyMatrix4` gleich, Arithmetik zeichengleich, nur Objekte, booleans und der ganzzahlige `stamp` über die Grenzen, Feldreihenfolge korrekt.

## Kleine Befunde

- Der grep aus Schritt 2 trifft in seiner wörtlichen Fassung die vorgeschriebenen `VIEW_FRUSTUM_HEIGHT_…` (`CameraBasedVisibility.ts:17-18`, `:754-755`, `:800-801`); mit Wortgrenze (`(^|[^_A-Z])FRUSTUM_HEIGHT_`) geht er leer aus — Planfehler, kein Code.
- TSDoc von `#placeTile()` in `CameraBasedVisibility.ts`: »Places a tile the search kept … Expects the search to have kept it.« wiederholt sich; der zweite Satz könnte entfallen (aus dem Report des Implementierers).

## Nebenbefunde

- `CameraBasedVisibility.ts:352` `#centerPoint2D` nicht `readonly`, obwohl `#dependencyValues` (`:405`) es festhält — vorbestehend, info, → Scope: die Scope-Regel nimmt jede Severity; Ursache ist eine fehlende Typgarantie im Cache-Gate, nicht die Suche, daher nicht in diesem Paket.
