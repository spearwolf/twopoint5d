# Paket 6 — Map2D-Sichtbarkeit und Allokations-Specs: Grenzen, Tile-Rechteck, Doku, Messfolge

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des Laufs, hier die
Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — fünf Nebenbefunde aus »Offene Befunde« (alle low, alle vorbestehend,
  alle `→ Scope · in Paket 6`), unten N1–N5; dazu die zwei kleinen Reviewer-Befunde aus dem Ergebnis von
  Paket 5, unten K1–K2 (Grund der Aufnahme bei K1/K2 im Volltext)
- Ziel: `CameraBasedVisibility` weist unsinnige `frustumBoxScale`-Werte ab, fragt jedes Tile in seiner echten
  Größe ab und beschreibt sich korrekt, und die Allokations-Spec der Vertex Objects misst unabhängig von der
  Reihenfolge.
- Modell: stärkste Stufe — N1–N4 sind mit Werten und Texten vorgegeben, aber N5 entscheidet sich an
  Heap-Messungen unter JIT- und GC-Rauschen (Paket 5 brauchte dafür die stärkste Stufe); eine gescheiterte
  Runde kostet mehr als der Unterschied der Stufen
- Effort: medium — Signaturen, Werte, Testnamen und Texte stehen unten; mehr Effort lädt zu Verbesserungen
  ein, die hier niemand bestellt hat
- Dateien (Pfade ab Repo-Root):
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` — Abschnitte A, B, C
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts` — Abschnitte A, B, D
  - `packages/twopoint5d/src/vertex-objects/hot-path-allocations.spec.ts` — Abschnitt E
  - `packages/twopoint5d/src/map2d/hot-path-allocations.tilted-view.spec.ts` — nur der Kommentar `:13`–`:15`
    (Abschnitt F, K1)
  - `packages/twopoint5d/src/testing/measureAllocatedBytes.ts`, `measureSettledBytes.ts` — nur JSDoc
    (Abschnitt F)
  - `AGENTS.md` — nur `:103`–`:105` (Abschnitt F)
  - `packages/twopoint5d/CHANGELOG.md` — Abschnitt G
  - temporär, nicht im Commit: `packages/twopoint5d/src/vertex-objects/toAttributeArrays.diagnostic.spec.ts`
    (E1) und die Mutante in `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts` (E3)
- Kein Browser-Test: geändert wird die Sichtbarkeitslogik, die `view` und die Boxen ausrechnet; Renderer,
  Shader und GPU-Buffer bleiben unberührt, und der Vitest-Spec prüft genau diese Werte.
- Vorgehen: Abschnitte A bis G unten, in dieser Reihenfolge. Bei A, B und D zuerst der Test, rot sehen, dann
  der Fix; jeder rote Lauf mit Kommando und Ausgabe in den Report. Ausgaben nach
  `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad`
  (unten `$ARBEITSDIR`), nie ins Projekt. Die Konventionen im Kopf von `./remediation-plan.md` gelten für
  jede Zeile: keine Nebenbefund-Kürzel (N1, K1 …) im Code, in Kommentaren, Testnamen, CHANGELOG oder
  Commit-Message; kein Rückblick auf den Vorzustand in Code, Kommentaren und CHANGELOG.
- Verify (vom Repo-Root, eine Zeile; läuft länger als zehn Minuten, also abgekoppelt starten):
  `pnpm run ci && (cd packages/twopoint5d && pnpm vitest --run src/map2d/CameraBasedVisibility.spec.ts src/map2d/hot-path-allocations.spec.ts src/map2d/hot-path-allocations.tilted-view.spec.ts src/vertex-objects/hot-path-allocations.spec.ts && for i in 1 2 3 4 5; do pnpm vitest --run src/vertex-objects/hot-path-allocations.spec.ts -t "toAttributeArrays" || exit 1; done && for s in 1 2 3 4 5 6; do pnpm vitest --run src/vertex-objects/hot-path-allocations.spec.ts --sequence.shuffle --sequence.seed=$s || exit 1; done) && for i in $(seq 1 20); do pnpm nx run twopoint5d:coverage --skip-nx-cache || exit 1; done`
  — die zwanzig vollen Coverage-Läufe sind der Beleg für N5: vor diesem Paket fiel der Test in einem von
  neun solcher Läufe; zwanzig grüne ließen einen unveränderten Fehler dieser Rate mit rund 90 % auffallen.
  Ein voller Coverage-Lauf dauert ohne Cache rund 13 s (`$ARBEITSDIR/paket-5.verify-1-coverage-nocache.log`).
- Commit:
  `fix(map2d)!: give every tile of CameraBasedVisibility the coordinates of its own tile on grids of tiles below 1 and with fractional offsets, refuse a frustumBoxScale below 1, and measure the per-object bytes of toAttributeArrays() with both sizes in turns`
  mit Leerzeile und diesem Body:
  `TileBox#primary names the tiles the search starts from, and the create/reuse/remove test moves the view by one tile, so that some of its tiles are reused.`
  und dem Footer:
  `BREAKING CHANGE: CameraBasedVisibility#frustumBoxScale throws a RangeError for anything but a finite number of at least 1 and keeps the value it had.`
- Verlauf:
  - 2026-09-28 Zug 0: Detailplan steht · N1 verschoben nach `CameraBasedVisibility.ts:221`–`:227`, unverändert
    (Probe: `frustumBoxScale = -1` angenommen, 10 statt 16 Tiles) · N2 verschoben nach `:32`–`:36`, dazu
    CHANGELOG `:1052`, `:1054`, `:1070` · N3 verschoben nach `CameraBasedVisibility.spec.ts:417`–`:418`,
    gemessen: Verschiebung 400 ergibt reuse 0/create 16/remove 16, Verschiebung 100 ergibt 12/4/4 · N4
    verschoben nach `writeTileCoords()` `:714`–`:724`, erweitert: auch Tiles ≥ 1 auf Rastern mit gebrochenem
    Offset (`(16, 16, 0.1, 0.3)`: 39 von 400 sichtbaren Tiles falsch; `(0.5, 0.5)`: 169 von 169) · N5
    unverändert `vertex-objects/hot-path-allocations.spec.ts:155`–`:170` · K1, K2 aus dem Ergebnis von Paket 5
    aufgenommen, unverändert · Folgen: keine offen (Pakete 1–5 je `Folgen: keine`) · Queue: die sechs
    Einträge für Paket 7 teilen keine Ursache mit diesem Paket · Restplan unverändert (Paket 7 teilt nur
    `CHANGELOG.md`, keine Abhängigkeit) · Messskripte `$ARBEITSDIR/paket-6.zug0-messungen/probe.mjs` bis
    `probe5.mjs`, gegen `packages/twopoint5d/dist/` vom 2026-09-28 15:57 (Stand der gemessenen Pfade seit 3b)
  - 2026-09-28 Zug 1: Implementierer beauftragt, `claude-opus-5-5` (stärkste Stufe), Effort medium · Brief `$ARBEITSDIR/paket-6.impl-0.brief.txt`, Report `paket-6.impl-0.json`
  - 2026-09-28 Zug 2: Report FERTIG_MIT_VORBEHALT (Verify des Implementierers: Lauf 1 rot an `src/sprites/hot-path-allocations.spec.ts` 8,01 B je Aufruf, Lauf 2 grün) · geändert: `CameraBasedVisibility.ts`, `CameraBasedVisibility.spec.ts`, `vertex-objects/hot-path-allocations.spec.ts`, `hot-path-allocations.tilted-view.spec.ts`, `measureAllocatedBytes.ts`, `measureSettledBytes.ts`, `AGENTS.md`, `CHANGELOG.md` · Arbeitsbaum schmutzig · rote Läufe `paket-6.impl-red-{A,B,D}.log`, E1 `paket-6.impl-e1-values.txt` (a 0,000 / b 0,016 B je Objekt), E3 Mutante 3,98 rot, umgedreht 0,000 grün, 343 ms · eigener Verify gestartet
  - 2026-09-28 Zug 2, eigener Verify 1: exit=1 (`$ARBEITSDIR/paket-6.verify-1.log`), in der Coverage-Stufe von `pnpm run ci` `src/sprites/hot-path-allocations.spec.ts` › `moving, turning, re-framing and tinting a textured sprite allocates nothing per call` mit 4,00 B je Aufruf · Gegenprobe auf `b4857658` ohne das Paket (Worktree, 20 volle Coverage-Läufe, `$ARBEITSDIR/p6-head-cov-<n>.log`): derselbe Test 1 von 20 rot, identisch 4,00308 B → vorbestehend, nicht Paket 6, Nebenbefund · Verify 2 gestartet, `$ARBEITSDIR/paket-6.verify.log`
  - 2026-09-28 Zug 2, eigener Verify 2: exit=1, wieder nur derselbe Sprites-Test mit 4,00308 B (in einem der zwanzig Coverage-Läufe) · Herkunftsprobe auf `93628b3c~1` (vor dem ersten Paket-Commit, Worktree, 20 volle Coverage-Läufe, `$ARBEITSDIR/p6-base-cov-<n>.log`): 0 von 20 rot → eingeordnet als Folge von Paket 2 (dort `TexturedSprite.ts` +112 Zeilen; im Zweifel Folge), Nachtragspaket 8 · Review trotz rotem Gate gestartet, weil der rote Test nachweislich nicht aus Paket 6 stammt
  - 2026-09-28 Zug 3: Reviewer `claude-opus-5-5`, Effort medium · N1–N5, K1, K2 behoben · wichtig: `CameraBasedVisibilityHelpers.ts:52`, `CameraBasedVisibilityHelpers.spec.ts:48`, `CHANGELOG.md:189` beschreiben `primary` als »probe ray met directly« · klein: TS2610-Hinweis im Migration Guide zu `frustumBoxScale`, Umbruch `CameraBasedVisibility.spec.ts:1079`–`:1080` · Diff `$ARBEITSDIR/paket-6.diff`, Report `paket-6.review-0.json` · Reviewer-Coverage unter Fremdlast (Load 6,7–9,7): zusätzlich Timeouts in `map2d/hot-path-allocations.spec.ts` und `sprites` › `moving an animated sprite by x and y alone`, die Messung von `toAttributeArrays()` in allen drei Läufen grün
  - 2026-09-28 Zug 4 Runde 1: Resume des Implementierers (`paket-6.impl-0.json` session_id), gleiches Profil, mit dem wichtigen und beiden kleinen Befunden · Brief `paket-6.impl-1.brief.txt`
  - 2026-09-28 Zug 4 Runde 1 zurück: FERTIG · `CameraBasedVisibilityHelpers.ts` (JSDoc `maxDebugHelpers`), `CameraBasedVisibilityHelpers.spec.ts` (JSDoc `debugFrustumBoxes()`), `CHANGELOG.md` (Eintrag `maxDebugHelpers`, TS2610-Satz), Umbruch `CameraBasedVisibility.spec.ts` · eigener Verify 3 exit=0 (`$ARBEITSDIR/paket-6.verify.log`; Verify 1 und 2 in `paket-6.verify-1.log`, `-2.log`) · gezielter Review `paket-6.review-1.json` auf `paket-6.diff-1`
  - 2026-09-28 Zug 4 Runde 1 Review: alle drei Befunde behoben · klein: Testnamen `CameraBasedVisibility.spec.ts:913`, `:937` (→ Queue) · keine weitere Runde
  - 2026-09-28 Zug 5: Commit ed67fc58, Verify `$ARBEITSDIR/paket-6.verify.log` exit=0 (jünger als die letzte Codeänderung), 10 Dateien, Trailer `Remediation-Run: 2026-09-28` · Plan: `[x]`, Paket 8 als Folge von Paket 2 vor Paket 7 geschnitten, `depth` und die Testnamen in »Offene Befunde«

## Urteil des Reviewers

Review 0 (`paket-6.review-0.json`) und Nachprüfung nach Runde 1 (`paket-6.review-1.json`):

- N1 behoben — `CameraBasedVisibility.ts:227` `#frustumBoxScale`, Getter/Setter mit `RangeError` ab `:244`, Halbsatz in `searchCanStop()` `:1177`; Test `CameraBasedVisibility.spec.ts:1131`
- N2 behoben — JSDoc `TileBox#primary` `CameraBasedVisibility.ts:36`–`:42`, Migration Guide `CHANGELOG.md:1054`, `:1056`, `:1072`; in Runde 1 nachgezogen: `CameraBasedVisibilityHelpers.ts:52`–`:55`, `CameraBasedVisibilityHelpers.spec.ts:48`–`:50`, `CHANGELOG.md:189`
- N3 behoben — `CameraBasedVisibility.spec.ts:417`–`:419` `[100, 0]`, Reuse-Assertion `:445`
- N4 behoben — `writeTileCoords()` `CameraBasedVisibility.ts:744`, JSDoc `coords` `:23`–`:27`, Block `the coordinates of a tile` `CameraBasedVisibility.spec.ts:1056`
- N5 behoben — `measureDifference()` `vertex-objects/hot-path-allocations.spec.ts:56`, Konstanten `:22`–`:29` (Startwerte), `Math.abs` `:236`
- K1 behoben — `hot-path-allocations.tilted-view.spec.ts:13`–`:16`
- K2 behoben — `measureAllocatedBytes.ts:24`–`:27`

Kleine Befunde:

- `CameraBasedVisibility.spec.ts:913`, `:937` — Testnamen lesen `primary` als »no ray met«, die Tests prüfen die weitere Lesart; vorbestehend, außerhalb des Diffs → »Offene Befunde«
- Migration-Guide-Hinweis TS2610 und Umbruch `CameraBasedVisibility.spec.ts:1079`–`:1080`: in Runde 1 behoben

Nebenbefunde (Begründung der Urteile):

- `CameraBasedVisibility.ts:297` `depth` ungeprüft — so schon in `93628b3c~1` `:148`, vorbestehend; Map2D, also → Scope
- Sprites-Allokations-Specs unter Coverage-Last — auf `b4857658` 1 von 20 rot, auf `93628b3c~1` 0 von 20; Paket 2 hat die gemessenen Setter umgebaut; im Zweifel Folge → Paket 8, `Folge von: Paket 2`

## A — `frustumBoxScale` prüfen (N1)

A1. **Test zuerst**, in `CameraBasedVisibility.spec.ts` im Block `describe('frustumBoxScale', …)` (`:1054`)
direkt nach `test('defaults to 1.1', …)`:

```ts
test('refuses anything but a finite number of at least 1', () => {
  const visibility = new CameraBasedVisibility();
  visibility.frustumBoxScale = 1.5;

  for (const value of [0.99, 0.5, 0, -1, NaN, Infinity, -Infinity]) {
    expect(() => {
      visibility.frustumBoxScale = value;
    }, String(value)).toThrow(RangeError);
    expect(visibility.frustumBoxScale, `the value stands after ${value}`).toBe(1.5);
  }
  expect(() => {
    visibility.frustumBoxScale = 0.5;
  }).toThrow('[CameraBasedVisibility] frustumBoxScale must be a finite number of at least 1, got 0.5');

  visibility.frustumBoxScale = 1;
  expect(visibility.frustumBoxScale).toBe(1);
});
```

Rot sehen: `pnpm vitest --run src/map2d/CameraBasedVisibility.spec.ts -t "refuses anything but a finite number"`
(aus `packages/twopoint5d`).

A2. **Fix** in `CameraBasedVisibility.ts`. Das öffentliche Feld `frustumBoxScale = 1.1;` (`:227`) wird ein
privates Feld mit Getter und Setter, nach dem Muster von `maxVisibleTiles` direkt darunter (`:229`–`:260`):

- `#frustumBoxScale = 1.1;` an die Stelle des Feldes, der bestehende JSDoc (`:221`–`:226`) wandert an den
  Getter und bekommt einen zweiten Absatz, wörtlich:

  ```
   * Takes a finite number of at least 1 and throws a `RangeError` for anything else, keeping the
   * value it had: below 1 the boxes of neighbouring tiles leave gaps between them, and the search,
   * which goes from a visible tile to its neighbours, would miss the visible tiles behind such a
   * gap. A new value recomputes on the next call.
  ```

- `get frustumBoxScale(): number { return this.#frustumBoxScale; }`
- `set frustumBoxScale(value: number)`: wirft, wenn `!(Number.isFinite(value) && value >= 1)`,
  `new RangeError(\`[CameraBasedVisibility] frustumBoxScale must be a finite number of at least 1, got ${describeValue(value)}\`)`
  (`describeValue` ist schon importiert), sonst `this.#frustumBoxScale = value;`.
- Innerhalb der Klasse liest jede Stelle das Feld, nicht den Getter — die Regel über Doubles am Kopf des
  Moduls (`:67`–`:72`): ein Getter, der ein Double beantwortet, boxt es, sobald der Compiler ihn nicht
  inlinet. Das betrifft `dependenciesChanged()` (`:476` und `:480`) und `setBox()` (`:1261`,
  `const scale = forFrustum ? this.#frustumBoxScale : 1;`).
- Im JSDoc von `searchCanStop()` (`:1141`–`:1142`) wird aus »and a `frustumBoxScale` of at least 1, so that
  the boxes of neighbouring tiles leave no gap« der Halbsatz »and a `frustumBoxScale` of at least 1 — its
  setter refuses less —, so that the boxes of neighbouring tiles leave no gap«.
- Der Kommentar über `#seenScalars` (`:348`–`:352`) bleibt: er begründet das Typed Array für die Werte der
  letzten Neuberechnung, die in jedem Aufruf geschrieben werden; `#frustumBoxScale` schreibt nur der Setter.

Die bestehenden Tests, die `frustumBoxScale` auf 2 und 3 setzen (`:1067`, `:1076`), bleiben unverändert grün.

## B — Jedes Tile bekommt sein eigenes Tile (N4)

B1. **Tests zuerst**, in `CameraBasedVisibility.spec.ts` ein neuer Block
`describe('the coordinates of a tile', …)` direkt vor `describe('frustumBoxScale', …)` (`:1054`), mit einem
Helfer und zwei Tests:

```ts
describe('the coordinates of a tile', () => {
  /** Every visible tile carries its own tile: one column and one row, `tileWidth` × `tileHeight`. */
  function expectTilesOfTheirOwn(visibility: CameraBasedVisibility, grid: Map2DTileCoordsUtil): void {
    expect(visibility.visibles.length, 'visible tiles').toBeGreaterThan(0);
    const size = new Vector3();
    for (const tile of visibility.visibles) {
      const at = `tile ${tile.x},${tile.y}`;
      expect(tile.coords, `${at}: coords`).toEqual({
        tileTop: tile.y,
        tileLeft: tile.x,
        top: tile.y * grid.tileHeight,
        left: tile.x * grid.tileWidth,
        height: grid.tileHeight,
        width: grid.tileWidth,
        tileHeight: grid.tileHeight,
        tileWidth: grid.tileWidth,
        rows: 1,
        columns: 1,
      });
      const {view} = tile.map2dTile!;
      expect([view.left, view.top, view.width, view.height], `${at}: map2dTile.view`).toEqual([
        tile.x * grid.tileWidth,
        tile.y * grid.tileHeight,
        grid.tileWidth,
        grid.tileHeight,
      ]);
      tile.box!.getSize(size);
      expect(size.x, `${at}: box width`).toBeCloseTo(grid.tileWidth, 9);
      expect(size.z, `${at}: box depth`).toBeCloseTo(grid.tileHeight, 9);
    }
  }

  test('a grid of tiles smaller than 1 gives every tile its own tile', () => {
    const camera = new PerspectiveCamera(90, 1, 0.01, 10);
    camera.position.set(0, 2, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const visibility = new CameraBasedVisibility(camera);
    // boxes as high as a few tiles, so that the view stays at some hundred tiles
    visibility.depth = 1;
    const grid = new Map2DTileCoordsUtil(0.5, 0.5);

    visibility.computeVisibleTiles([], [0, 0], grid, new Matrix4());

    expectTilesOfTheirOwn(visibility, grid);
  });

  test('a grid whose tile edges come out a rounding step off its offset gives every tile its own tile', () => {
    const visibility = new CameraBasedVisibility(makeTopDownCamera());
    // (4 * 16 + 0.1) - 0.1 is 63.99999999999999, and 2 * 16 + 0.3 less 0.3 falls short of 32 as well
    const grid = new Map2DTileCoordsUtil(16, 16, 0.1, 0.3);

    visibility.computeVisibleTiles([], [0, 0], grid, new Matrix4());

    expect(visibility.visibles.some((tile) => tile.x === 4), 'column 4 is in view').toBe(true);
    expect(visibility.visibles.some((tile) => tile.y === 2), 'row 2 is in view').toBe(true);
    expectTilesOfTheirOwn(visibility, grid);
  });
});
```

`PerspectiveCamera`, `Vector3` und `Matrix4` sind im Spec schon importiert (`:2`–`:14`). Rot sehen: in Zug 0 gegen den aktuellen Stand gemessen 169 von 169 Tiles falsch
(ein 0,5er-Tile trägt `columns: 2, rows: 2, width: 1`) bzw. 39 von 400 (Zeile 2 trägt `tileTop` 1 und
`rows: 2`, Spalte 4 `tileLeft` 3 und `columns: 2`) — `$ARBEITSDIR/paket-6.zug0-messungen/probe4.mjs`.

B2. **Fix**: `writeTileCoords()` (`CameraBasedVisibility.ts:714`–`:724`) fragt das Raster nicht mehr, sondern
schreibt das Tile aus seiner Koordinate. Ein Abfragerechteck gleich welcher Größe trifft den Nachbarn: eines
von 1 × 1 überspannt bei Tiles unter 1 mehrere Tiles, und auch eines von `tileWidth` × `tileHeight` rundet an
gebrochenen Offsets über die Kante (Zug 0, `probe2.mjs`: 18 von 5 409 Tiles auf `(16, 16, 0.1, 0.3)` und
`(3, 7, 0.1, -0.7)`). Das weicht von der Empfehlung im Nebenbefund (»ein Rechteck von `tileWidth` ×
`tileHeight`«) ab; ihre zweite Hälfte (»bzw. die Koordinaten direkt«) ist der Weg. Neuer Rumpf samt JSDoc:

```ts
/**
 * Writes `coords` of a slot for its tile on the current grid: the tile itself, one column and one
 * row, taken from the tile coordinate. A query rectangle would meet a neighbouring tile wherever
 * the grid is finer than the rectangle or an edge comes out a rounding step off in floating point.
 */
private writeTileCoords(slot: PooledTileBox): void {
  const grid = this.#map2dTileCoords;
  const tileWidth = grid.tileWidth;
  const tileHeight = grid.tileHeight;
  const coords = slot.coords;
  coords.tileTop = slot.y;
  coords.tileLeft = slot.x;
  coords.top = slot.y * tileHeight;
  coords.left = slot.x * tileWidth;
  coords.height = tileHeight;
  coords.width = tileWidth;
  coords.tileHeight = tileHeight;
  coords.tileWidth = tileWidth;
  coords.rows = 1;
  coords.columns = 1;
}
```

`left`/`top` sind damit genau das, was `TilesWithinCoords` dokumentiert (»`tileLeft * tileWidth`, without the
`xOffset` of the grid«) und was `RectangularVisibilityArea` einem Tile als `view` gibt
(`RectangularVisibilityArea.ts:218`). `#queryArea` bleibt für die Seeds und die Hülle in Gebrauch. Die
Getter-Lesungen von `tileWidth`/`tileHeight` hatte die alte Fassung auch; die Allokations-Specs laufen mit
ganzzahligen Tile-Größen.

B3. JSDoc am Feld `coords` von `TileBox` (`:24`, bisher ohne), wörtlich:
`/** The tile on the grid: its tile coordinate, one column and one row, and its edges relative to the origin of the grid, without the offset of the grid. */`
(über mehrere Zeilen umbrochen, höchstens 100 Zeichen je Zeile).

B4. Kein bestehender Spec ist betroffen: keines der Raster in den Specs trifft den Rundungsfehler (Zug 0,
`probe5.mjs`: alle 17 Raster mit festen Werten aus `src/**/*.spec.ts` ohne Treffer; die zwei mit Variablen
stehen in `Map2DTileCoordsUtil.spec.ts`, das nicht über `CameraBasedVisibility` läuft; u. a. `(400, 400, 0.25, -0.5)` und
`(566, 566, 0.25, -0.5)` der Tilted-View-Spec, `(100, 100, 0.25, -0.5)` und `(256, 256, -128, -128)` des
Charakterisierungstests) — die Tile-Zahlen der Allokations-Specs bleiben also 208/108. Wird trotzdem einer
rot, ist das ein Befund für den Report, keine Anpassung der Erwartung ohne Grund.

## C — `TileBox#primary` richtig beschreiben (N2)

C1. JSDoc von `primary` (`CameraBasedVisibility.ts:32`–`:36`) ersetzen, wörtlich:

```ts
  /**
   * `true` for a tile the search started from in the last recomputation: the tile a probe ray of
   * the view frustum met the map plane in — see {@link CameraBasedVisibility.pointsOnPlane} —, and
   * each tile a rectangle of one tile size around that point reaches into, up to four per ray. The
   * tiles within the hull those points span come in without a frustum test, and every other visible
   * tile was reached from one of these, neighbour by neighbour.
   */
```

Belegt durch den Code (`findVisibleTiles()`: `probeStamp` für jedes Tile des Rechtecks um den Probe-Punkt,
`collectTilesWithinProbeHull()` mit `insideProbeHull`, `pushNeighbors()` nur für sichtbare Tiles) und durch
die Spec (`leaves no tile marked as primary that no ray met` prüft über `isNextToAProbe`).

C2. Der Migration-Guide-Abschnitt in `CHANGELOG.md` (`[Unreleased]`, nicht veröffentlicht, also änderbar)
trägt dieselbe Ungenauigkeit — »the tiles the view frustum meets the plane in — all of them« sind alle
sichtbaren Tiles, nicht die markierten:

- `:1052` Überschrift wird `#### \`TileBox#primary\` marks the tiles of every probe ray that met the plane`
  (kein Link im Repo zeigt auf den alten Anker; in Zug 0 gesucht)
- `:1054` wird: ``CameraBasedVisibility` tests nine rays through the view frustum against the map plane, and `primary` marks the tiles around each point where a ray met it — the tile the point lies in and those a rectangle of one tile size around it reaches into —, at up to nine places on the map rather than the one under the center of the view.``
- `:1070` wird: `Whoever wants the tiles around the points of all probe rays keeps reading \`primary\`; every tile of the view is in \`visibles\`.`
- Die Codeblöcke `:1056`–`:1068` und der `Changed`-Eintrag `:121` bleiben (`:121` beschreibt es schon richtig).

## D — Der Verschiebetest verschiebt um ein Tile (N3)

`CameraBasedVisibility.spec.ts`, Test `classifies tiles into create / reuse / remove across frames with
different center points` (`:411`–`:444`). Der Kommentar sagt »one whole tile«, verschoben wird um 400 auf
einem 100er-Raster; in Zug 0 gemessen: bei 400 ist `reuseTiles` leer (reuse 0, create 16, remove 16), der
Test prüft die Wiederverwendung also nie, bei 100 sind es reuse 12, create 4, remove 4. Die Absicht des
Tests gewinnt, nicht der Wert:

D1. **Test zuerst**: nach `expect(createIds.size).toBeGreaterThan(0);` (`:443`) die Zeile
`expect(reuseIds.size, 'the tiles that stay in view').toBeGreaterThan(0);` — mit `[400, 0]` rot sehen.

D2. **Dann** `:417`–`:418`:

```ts
      // Shift the center point by one whole tile: a column of tiles leaves the view, one enters it,
      // and the others stay.
      const second = visibility.computeVisibleTiles(first.tiles, [100, 0], tileCoords, matrixWorld)!;
```

Der zweite Test mit `[400, 0]` (`:246`) prüft etwas anderes (`changed`) und bleibt.

## E — `toAttributeArrays()` in abwechselnder Messfolge (N5)

Der Test `toAttributeArrays() allocates its result and nothing per vertex`
(`src/vertex-objects/hot-path-allocations.spec.ts:155`–`:170`) misst `many` (1000 Objekte) vollständig über
`measureSettledBytes()` und danach `few` (10 Objekte); ein fester Betrag je Aufruf, der während der Messfolge
noch sinkt, fällt ganz auf `many`. Im vollen Coverage-Lauf rot in einem von neun Läufen mit 4,92 B je
Vertex-Objekt (`$ARBEITSDIR/paket-5.impl-r1-coverage-2.log:2349`–`:2357`) — das ist der rote Lauf für den
Report. Unter Coverage dauert der Test heute 343–391 ms.

E1. **Beleg vorher, temporär**: `src/vertex-objects/toAttributeArrays.diagnostic.spec.ts` mit dem Ablauf des
bestehenden Tests in beiden Reihenfolgen (a: `many` dann `few`, b: `few` dann `many`), je mit
`console.log` von `many`, `few` und `(many - few) / 990`. Fünfmal
`pnpm nx run twopoint5d:coverage --skip-nx-cache` vom Repo-Root (volle Last wie im Fehlerfall), Ausgaben
nach `$ARBEITSDIR/paket-6.impl-e1-<n>.log`. In den Report: die zehn Wertepaare. Eine Differenz, deren
Vorzeichen oder Größe mit der Reihenfolge wandert, ist der Beleg der Positionsabhängigkeit; zeigen fünf Läufe
keine, sagt der Report das, und E2 folgt trotzdem. Die Datei danach löschen.

E2. **Umbau**, nach dem Muster von `measurePerTile()` in `src/map2d/hot-path-allocations.tilted-view.spec.ts`
(`:101`–`:138`), lokal in `src/vertex-objects/hot-path-allocations.spec.ts` — keine gemeinsame Hilfe in
`src/testing/`: Paket 5 hat das Muster als Spec-lokal in `AGENTS.md` festgeschrieben, die Tilted-View-Spec
läuft unter Coverage mit 10 % Rand an ihrem 3-s-Budget und bleibt unangetastet, und Rundenform und Konstanten
beider Specs unterscheiden sich:

- Import `measureAllocatedBytes` aus `../testing/measureAllocatedBytes.js` neben `measureSettledBytes`.
- Konstanten am Dateikopf unter den bestehenden, Startwerte:
  `DIFFERENCE_SETTLE_ROUNDS = 200` (je Größe, abwechselnd), `DIFFERENCE_WARM_UP_ROUNDS = 20`,
  `DIFFERENCE_MEASURED_ROUNDS = 50`, `DIFFERENCE_GROUPS = 5`, `STILL_BYTES = 8` (je Aufruf: zwei Messungen
  derselben Größe, die weiter auseinanderliegen, zählen nicht als ruhige Gruppe). Weicht E3 oder das Budget
  davon ab, ändert der Implementierer die Werte und nennt im Report und im Kommentar die gemessenen Zahlen.
- Dazu `compilerPause` (20 ms, wie in `measureSettledBytes()`) und `median` wie in der Tilted-View-Spec
  (`:31`, `:75`–`:79`).
- `async function measureDifference(small: () => void, big: () => void): Promise<{difference: number; message: string}>`:
  beide Runden abwechselnd `DIFFERENCE_SETTLE_ROUNDS`-mal, `gc()` über `globalThis` wie in
  `measurePerTile()`, dann `DIFFERENCE_GROUPS` Gruppen — je `await compilerPause()`, dann klein, groß, groß,
  klein über `measureAllocatedBytes(round, {warmUpRounds: DIFFERENCE_WARM_UP_ROUNDS, rounds: DIFFERENCE_MEASURED_ROUNDS})`;
  Differenz der Gruppe `(big1 + big2 - small1 - small2) / 2`; ruhig, wenn beide Paare unter `STILL_BYTES`
  auseinanderliegen; Ergebnis der Median der ruhigen Gruppen, ohne ruhige der Median aller;
  `message` nennt Zahl der gezählten Gruppen und je Gruppe die vier Werte (Format wie `measurePerTile()`).
- Ein JSDoc an `measureDifference()`, zeitlos: der feste Betrag eines Aufrufs — Ergebnisobjekt, Tupel, die
  Hülle des Typed Array — steht bei beiden Größen gleich an und sinkt, bis der Compiler die Funktion
  übernommen hat; deshalb Gruppen klein, groß, groß, klein, in denen eine Stufe beide Seiten gleich trifft,
  und der Median der ruhigen Gruppen, in die keine volle Sammlung und kein Compile-Job fiel; für die ganze
  Begründung Verweis auf `measurePerTile()` in `src/map2d/hot-path-allocations.tilted-view.spec.ts`.
- Der Test behält seinen Namen; Rumpf:

  ```ts
  const pool = new VertexObjectPool(quadDescription, 1000);
  for (let i = 0; i < 1000; i++) pool.createVO();

  const {difference, message} = await measureDifference(
    () => {
      pool.buffer.toAttributeArrays(['position'], 0, 10);
    },
    () => {
      pool.buffer.toAttributeArrays(['position'], 0, 1000);
    },
  );
  const bytesPerObject = difference / 990;

  expect(Math.abs(bytesPerObject), `${bytesPerObject.toFixed(2)} bytes per further vertex object, ${message}`).toBeLessThan(
    BYTES_PER_CALL_LIMIT,
  );

  pool.dispose();
  ```

  `Math.abs`, weil eine negative Differenz ebenso heißt, dass die Reihenfolge noch durchschlägt.
- Ein Kommentar über dem Test zur Grenze, wörtlich: `// a vertex object that allocates anything costs 16 B at least: one such allocation in every 16 objects reads 1 B per object, the limit`
  (umbrochen auf höchstens 100 Zeichen).

E3. **Beleg nachher, temporär**, beide Eingriffe danach zurückgenommen:
- Mutante in `VertexObjectBuffer#toAttributeArrays()` (`src/vertex-objects/VertexObjectBuffer.ts:713`–`:720`):
  in der Objektschleife bei jedem achten Objekt eine Allokation, die nicht wegoptimiert wird — etwa
  `if ((objIdx & 7) === 0) mutantSink = {objIdx};` mit `let mutantSink: unknown;` auf Modulebene und einem
  exportierten Leser, damit der Compiler sie nicht streicht. Erwartet ≥ 2 B je Objekt; der Test muss rot
  sein. Wert in den Report.
- Die Gruppenfolge umgedreht (groß, klein, klein, groß): der Test bleibt grün, Wert vergleichbar. Wert in den
  Report.
- Dauer des Tests in einem vollen `pnpm nx run twopoint5d:coverage --skip-nx-cache`: unter 1 s (Vitest-Zeile
  der Datei mit `--reporter=verbose` oder die Zeile des Tests). Wert in den Report.

E4. Stabilität belegt das Verify-Kommando (zwanzig volle Coverage-Läufe, dazu fünf Einzelläufe und sechs
Shuffle-Seeds der Datei).

## F — Doku der Messhilfen (N5, K1, K2)

F1. `AGENTS.md:103`–`:105` ersetzen, wörtlich:

```
  A spec that measures bytes per tile or per vertex object as the difference of two sizes —
  two views of a camera, two ranges of a pool — calls `measureAllocatedBytes()` directly, so
  that the two sizes take turns within one sequence of measurements and a cost that is still
  settling falls on both alike; `measurePerTile()` in
  `src/map2d/hot-path-allocations.tilted-view.spec.ts` shows the sequence.
```

F2. `src/testing/measureSettledBytes.ts:12`–`:14`, ab »A spec that«, wörtlich:
`A spec that measures the bytes per tile or per vertex object of a path as the difference of two sizes calls \`measureAllocatedBytes()\` directly instead, so that the two sizes take turns within one sequence of measurements.`
(umbrochen wie der Absatz, höchstens 100 Zeichen je Zeile).

F3. `src/testing/measureAllocatedBytes.ts`:
- `:13`–`:15`, ab »— but for the specs«: `— but for the specs that measure the bytes per tile or per vertex object of a path as the difference of two sizes: they call this directly, because the two sizes have to take turns within one sequence of measurements.`
- `:24`–`:26` neu umbrechen, Wortlaut unverändert: `:26` hat 121 Zeichen, der Absatz bricht sonst bei
  höchstens 100 um (K2).

F4. `src/map2d/hot-path-allocations.tilted-view.spec.ts:13`–`:15` (K1), wörtlich:

```ts
// a tile that allocates anything costs 16 B at least: one such allocation in every 16 tiles reads
// 1 B per tile, the limit, and one of 32 B — a small object — in every 16 tiles reads 2 B. When this
// limit was set, both tests measured 0.00 B per tile — alone, in either order, with the order of a
// group turned around and with V8 coverage
```

Sonst nichts an dieser Datei.

## G — CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`)

Nach dem Skill `updating-changelog`; Einträge positiv formuliert, ohne »früher«/»used to« (Konventionen).

G1. `### Changed`, neuer Eintrag nach dem zu `frustumBoxScale` im Dependency-Gate (`:186`):
``- `CameraBasedVisibility#frustumBoxScale` takes a finite number of at least 1 and throws a `RangeError` for anything else, keeping the value it had: below 1 the frustum boxes of neighbouring tiles leave gaps, and the search, which goes from a visible tile to its neighbours, can miss the visible tiles behind such a gap. See the Migration Guide``

G2. `### Fixed`, neuer Eintrag nach dem zur Kamera unter einem Elternteil (`:460`), wörtlich:
``- fix `CameraBasedVisibility` on a grid of tiles smaller than 1, and on a grid whose tile edges come out a rounding step off its offset in floating point — `new Map2DTileCoordsUtil(16, 16, 0.1, 0.3)` for one: `coords` of every visible tile is its own tile, one column and one row of `tileWidth` × `tileHeight`, and its `box`, `frustumBox`, `centerWorld` and the `view` of its `map2dTile` follow from it``

G3. `### Migration Guide`, neuer Abschnitt nach `#### \`CameraBasedVisibility\` keeps at most 10 000 tiles`
(endet `:3041`, vor `## [0.21.2]` in `:3043`):

````markdown
#### `CameraBasedVisibility#frustumBoxScale` takes nothing below 1

`frustumBoxScale` takes a finite number of at least 1 and throws a `RangeError` for anything else,
keeping the value it had. Below 1 the frustum boxes of neighbouring tiles leave gaps, and the search,
which goes from a visible tile to its neighbours, misses the visible tiles behind them.

**Before**

```ts
visibility.frustumBoxScale = 0.9;
```

**After**

```ts
visibility.frustumBoxScale = 1; // the tile itself, the least it takes
```
````

G4. C2 (Migration-Guide-Abschnitt zu `primary`) gehört ebenfalls hierher.

## Findings im Volltext

**N1 · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:157` (jetzt `:221`–`:227`)** —
`frustumBoxScale` nimmt jeden Wert an, auch 0, negative Zahlen und `NaN`; unter 1 lassen die Boxen
benachbarter Tiles Lücken, die Flutfüllung kann sichtbare Tiles auch ohne Limit verfehlen, und die Zusage
»nearest to the camera« von `maxVisibleTiles` gilt dann nicht mehr exakt (Reviewer: `frustumBoxScale` 0.5,
1 von 420 Fällen) — eine Prüfung auf ≥ 1 mit `RangeError` wie bei `maxVisibleTiles` erledigt beides, sonst ein
Halbsatz im JSDoc von `frustumBoxScale`/`maxVisibleTiles` (vorbestehend, gefunden in Paket 3 Zug 4).
Entscheidung Zug 0: `RangeError` für alles außer einer endlichen Zahl ≥ 1 — dasselbe Muster wie
`maxVisibleTiles`, und der Beweis in `searchCanStop()` setzt ≥ 1 voraus. `Infinity` fällt mit: jede Box wäre
unendlich groß, jedes Tile sichtbar.

**N2 · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:31`–`:32` (jetzt `:32`–`:36`)** — JSDoc
von `TileBox#primary`: »Every other visible tile was found from such a tile outwards« stimmt nicht für die
Tiles der Hülle, die aufgezählt und nicht von einem Probe-Tile aus gefunden werden (Doku, vorbestehend,
gefunden in Paket 3 Zug 2). Zug 0: auch »met directly« ist zu eng — markiert werden je Strahl bis zu vier
Tiles, die ein Rechteck von Tile-Größe um den Punkt erreicht; der Migration Guide `CHANGELOG.md:1052`–`:1070`
beschreibt `primary` als »every tile the view frustum meets the plane in«.

**N3 · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts:349` (jetzt `:417`)** — Kommentar
»Shift the center point by one whole tile« bei `[400, 0]` auf einem Raster mit 100er-Tiles, das sind vier
Tiles (Test-Kommentar, vorbestehend seit `f1c40008`, gefunden in Paket 3 Zug 2). Zug 0: bei 400 bleibt
`reuseTiles` leer, der Test über »create / reuse / remove« prüft die Wiederverwendung nie.

**N4 · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:712`–`:721` (jetzt `writeTileCoords()`
`:714`–`:724`)** — fragt ein Tile als 1×1-Rechteck in Weltkoordinaten ab; bei `tileWidth`/`tileHeight` unter 1
überspannt das mehrere Tiles (`new Map2DTileCoordsUtil(0.5, 0.5)` ergibt `columns: 2, rows: 2`), und
`coords`, `box`, `frustumBox`, `centerWorld` sowie `map2dTile.view` jedes Tiles sind 2×2 Tiles groß; richtig
wäre ein Rechteck von `tileWidth` × `tileHeight` bzw. die Koordinaten direkt (vorbestehend — so schon in
`e7767c6d:CameraBasedVisibility.ts:676`–`:681` —, gefunden in Paket 3b Zug 2). Zug 0: dieselbe Abfrage
verfehlt auch Tiles ≥ 1, wenn `(x * tileWidth + xOffset) - xOffset` in Gleitkomma unter `x * tileWidth`
fällt — auf `(16, 16, 0.1, 0.3)` Spalte 4 und Zeile 2 (39 von 400 Tiles im Draufsicht-Test); ein Rechteck von
Tile-Größe hat denselben Fehler, deshalb die Koordinaten direkt.

**N5 · low · `packages/twopoint5d/src/vertex-objects/hot-path-allocations.spec.ts:155`–`:170`** —
`toAttributeArrays() allocates its result and nothing per vertex` misst zwei Ansichten nacheinander (erst
`many`, dann `few`) und bildet die Differenz über die niedrigste von drei Messungen; ein fester Betrag, der
während der Messfolge noch sinkt, fällt dabei zulasten der zuerst gemessenen Seite aus — in einem von neun
vollen Coverage-Läufen rot mit 4,92 B je Vertex-Objekt (`$ARBEITSDIR/paket-5.impl-r1-coverage-2.log`);
richtig wäre eine Messfolge wie in `src/map2d/hot-path-allocations.tilted-view.spec.ts` (abwechselnd klein,
groß, groß, klein, Median der stillen Gruppen) (flaky Test, vorbestehend — so schon in `e7767c6d` —,
gefunden in Paket 5 Zug 4).

**K1 · klein (Reviewer Paket 5) · `packages/twopoint5d/src/map2d/hot-path-allocations.tilted-view.spec.ts:13`–`:14`**
— der Kommentar rechnet »one allocation in 16 tiles reads 2 B per tile« mit 32 B statt der kleinsten 16 B.
Aufgenommen, weil E2 für die Vertex Objects denselben Grenzkommentar schreibt und das Muster dieser Datei
übernimmt: stünde die falsche Rechnung daneben, wanderte sie mit. In Scope (Map2D).

**K2 · klein (Reviewer Paket 5) · `packages/twopoint5d/src/testing/measureAllocatedBytes.ts:26`** — der
JSDoc-Absatz bricht bei 121 statt höchstens 100 Zeichen um. Aufgenommen, weil F3 genau diesen JSDoc für die
Differenzmessung der Vertex Objects erweitert; der Absatz gehört zum Umbau von Paket 5.
