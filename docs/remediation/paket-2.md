# Paket 2 — Map2D und PanControl2D: Tile-Reuse, Sichtbarkeitsbox, Hot Path, Pointer-Ziel, Coverage-Schwellen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-002 (high), PERF-001 (medium), PERF-002 (medium), TEST-004 (medium), BUG-006 (medium), TEST-002 (medium)
- Ziel: `RectangularVisibilityArea` reused Tiles über Indizes, `CameraBasedVisibility` testet eine ans Frustum geklemmte Box und allokiert im Hull-Pfad nichts — abgesichert durch Allokations-Specs mit geneigter Kamera und für `Map2D#update()` —, `PanControl2D` lässt sich auf ein Element begrenzen und ignoriert interaktive Ziele, und `src/display` sowie `src/controls` bekommen Coverage-Schwellen.
- Modell: stärkste Stufe — sechs Findings über zwei Module und die Vitest-Konfiguration; die Klemmung der Frustum-Box greift in den Beweis von `searchCanStop()` ein, und die Allokations-Specs verlangen ein sicheres Gefühl für V8-Boxing (siehe »Rules you cannot read off the code« in `AGENTS.md`)
- Effort: high — öffentliche API (neue Option `pointerTarget`, geändertes Default-Verhalten von `PanControl2D`, kleinere Sichtmenge von `CameraBasedVisibility`), und ob der neue `Map2D#update()`-Spec weitere Allokationen im Frame-Pfad aufdeckt, steht vorher nicht fest
- Dateien:
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts`, `RectangularVisibilityArea.spec.ts`
  - `packages/twopoint5d/src/map2d/convexTileHull.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`, `CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts`
  - `packages/twopoint5d/src/controls/PanControl2D.ts`, `PanControl2D.spec.ts`, `hot-path-allocations.spec.ts`
  - `packages/twopoint5d-testing/test/pan-control-pointer-target.test.js` (neu), `packages/twopoint5d-testing/test/helpers/fixtures.js`
  - `packages/twopoint5d/vite.config.ts`
  - `packages/twopoint5d/CHANGELOG.md`
  - nur falls Schritt 2.4 eine Allokation dort findet: `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts`, `Map2DTileRenderer.ts`
- Verify: `pnpm run ci` (aus dem Repo-Root; Baseline grün)
- Commit: siehe Abschnitt »Commit-Message« unten
- Verlauf:
  - 2026-10-21 Zug 0: Detailplan steht · BUG-002 unverändert (`RectangularVisibilityArea.ts:200–204`, Tile-Bau 213–219) · PERF-001 unverändert (`CameraBasedVisibility.ts:310`, Test 876, TSDoc »rare cases« 1254–1258) · PERF-002 unverändert (`convexTileHull.ts:102, 123–124`; Nebenstellen `CameraBasedVisibility.ts:743, 1101`, die dritte jetzt 1346 statt 1345) · TEST-004 unverändert (`hot-path-allocations.spec.ts:43–50` nur Top-down-Kamera; kein Allokations-Spec für `Map2D`, `Map2DTileStreamer`, `Map2DTileRenderer`) · BUG-006 unverändert (`PanControl2D.ts:367, 461–469, 471`) · TEST-002 unverändert (`vite.config.ts:49–68`, keine Schwelle für `src/display/**`, `src/controls/**`) · Paket 1 hat keine `Folgen:` · die drei offenen Befunde (alle `src/display/AdaptiveResolution.ts`, low → Audit) teilen keine Ursache mit diesem Paket und bleiben in der Queue · Messungen siehe »Vorab gemessen«
  - 2026-10-21 Zug 0, Restplan: Pakete 3 und 4 unverändert in Schnitt und Reihenfolge — kein Finding dieses Pakets ist weggefallen oder gewandert, und keine Datei hier liegt in deren Bereich (`src/texture/`, `src/sprites/`, `src/stage/`, `src/vertex-objects/`) · im Plan nur der `Bereich:` dieses Pakets an die Dateiliste gehalten (`docs/` → `packages/twopoint5d/CHANGELOG.md`, dazu `packages/twopoint5d-testing/test/` für den Browser-Test von `pointerTarget`)
  - 2026-10-21 Zug 1: Implementierer beauftragt · opus, Effort high · Brief `paket-2.impl-0.brief.md`, Report `paket-2.impl-0.json` im Arbeitsverzeichnis
  - 2026-10-21 Zug 2: Report FERTIG · 12 Dateien geändert, neu `packages/twopoint5d-testing/test/pan-control-pointer-target.test.js` · Arbeitsbaum schmutzig · Abweichungen: Tilted-Grid 300 statt 400 (bei 400 nur zwei Hull-Zeilen, schon vor dem Fix grün), `widenFrustumHeight()` ohne `applyMatrix4()` (32 B je Neuberechnung), 3.2-Kamera per `rotation.x` · Controls-Schwelle 90/74/89/92, Display 82/73/81/84 · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`)
  - 2026-10-21 Zug 3: Reviewer beauftragt · opus, Effort high · Diff `paket-2.diff` (13 Dateien, +669/−53)
  - 2026-10-21 Zug 3: Urteil — alle sechs Findings behoben · 1 wichtig (`docs/architecture.md:163` nennt noch keine Schwelle für controls/display), 3 klein (Kommentar in Vergangenheitsform `CameraBasedVisibility.ts:801`, Commit-Message 0,5 statt 0,3 ms, Commit-Header zu lang) · Report `paket-2.review-0.json`, Diff `paket-2.diff`
  - 2026-10-21 Zug 4, Runde 1: offen `docs/architecture.md:163` (wichtig) und der Kommentar `CameraBasedVisibility.ts:801` (klein, mitgegeben) · derselbe Implementierer per `--resume`, opus/high · Commit-Message (Header gekürzt, Zahlen) zieht der Runner in dieser Datei nach
  - 2026-10-21 Zug 4, Runde 1 zurück: FERTIG · `docs/architecture.md:163–165` Satz gestrichen, Ausnahme `Stylesheets.ts` ergänzt · Kommentar `CameraBasedVisibility.ts:802` im Präsens · Verify `pnpm run ci` exit=0 (`paket-2.verify-r1.log`) · gezielter Review `paket-2.review-1.json` (sonnet/medium, mechanischer Nachdiff), Diff `paket-2.r1.diff`
  - 2026-10-21 Zug 4, Runde 1 Review: beide Befunde behoben, keine neuen · Kette endet nach 1 Runde
  - 2026-10-21 Zug 5: Commit 4bf14f2e (14 Dateien, +672/−55) · Verify `paket-2.verify-r1.log` exit=0 · Commit-Message in `paket-2.commitmsg` (Header gekürzt, 0,3 ms, 750 B / 48 B nach den Messwerten des Implementierers) · Trailer `Remediation-Run: 2026-10-21`

## Vorab gemessen (Zug 0)

Damit Schwellen und Schranken Zahlen statt Platzhalter tragen. Gemessen auf
HEAD 328f7a8e; `src/map2d` und `src/controls` sind seit dem Audit-Commit unberührt.

**Coverage** (`pnpm vitest --run --coverage --project specs`, json-summary, je Modul summiert):

| Modul | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| `src/display/` mit `Stylesheets.ts` | 80,91 | 71,49 | 82,28 | 82,53 |
| `src/display/` ohne `Stylesheets.ts` | 84,38 | 75,42 | 83,26 | 86,02 |
| `src/controls/` (vor diesem Paket) | 91,78 | 74,30 | 90,74 | 94,40 |

`Stylesheets.ts` steht bei 4 von 56 Zeilen: die Specs laufen unter Node ohne
DOM, die Controls-Specs mocken die Klasse (`PanControl2D.spec.ts:12–15`), und
`packages/twopoint5d-testing/test/stylesheets.test.js` übt sie im Browser aus.

**Tile-Zahlen von `CameraBasedVisibility`** (Kamera `PerspectiveCamera(60, 1, 0.1, 20)` bei
`(0, 5, 5)`, `lookAt(0, 0, 0)`, Grid `new Map2DTileCoordsUtil(1, 1)`, Zentrum `[0, 0]`,
`new Matrix4()`, `maxVisibleTiles = Infinity`, gemessen gegen `dist/` mit einem zur Laufzeit
überschriebenen `setBox()`):

| Box | sichtbare Tiles | ms je Neuberechnung |
| --- | --- | --- |
| `depth` 100 (Default), ungeklemmt | 7 168 | 3,3 |
| `depth` 100, y auf den Höhenbereich des Frustums geklemmt (`[-17,31, 4,97]`) | 936 | 0,5 |
| exakt: Säule `±55` gegen das Frustum (Separating-Axis-Test) | 498 | — |
| `depth` 2 | 366 | 0,2 |
| `depth` 0 | 248 | 0,2 |

Die Klemmung wirft 93 % der falschen Treffer hinaus. Was bleibt, sind Säulen,
die die Seitenebenen einzeln bestehen — das ist die Grenze des freigegebenen
Weges, kein Fehler der Umsetzung. Bei `far` 50 und Aspekt 1,6 fällt die Zahl von
20 264 auf 8 670 (exakt 4 620): je tiefer das Frustum unter die Ebene reicht,
desto weniger nimmt die Klemmung weg. Deshalb nennt der TSDoc `depth` als den
Hebel, nicht die Klemmung.

## Entscheidungen dieses Zugs (mit Grund)

- **Klemmung global je Neuberechnung, nicht je Tile.** Der Höhenbereich kommt aus
  den acht Ecken des Frustums im lokalen Raum des Map-Knotens; alle Frustum-Boxen
  einer Neuberechnung bleiben damit gleich groß. Darauf baut `beginSearchStop()`
  (`CameraBasedVisibility.ts:1217–1222`: »the frustum boxes of all tiles have the
  same size«, liest die Grundfläche von `kept[0]`). Eine Klemmung je Tile bräche
  diese Annahme und wäre ein anderer Weg als der freigegebene.
- **Die Ecken kommen aus der vorhandenen Probe-Schleife.** `FRUSTUM_PROBES_NDC`
  enthält die vier Ecken `(±1, ±1)`, und `findPointsOnPlaneThatAreInViewFrustum()`
  unprojiziert für jede Probe den Punkt auf `near` und auf `far` — das sind die
  acht Ecken. Kein zusätzliches `unproject()`.
- **Nur die Frustum-Box wird geklemmt**, `tile.box` behält die volle `depth`: sie
  ist die Box, in der die Renderer die Tile zeichnen, und die Helfer zeigen sie.
- **Spec-Schranke `Math.PI * far²`** (≈ 1 257 bei `far` 20): die Größenordnung des
  Bodens um die Kamera, die das Audit nennt; 936 liegt darunter, 7 168 weit darüber.
  Die gemessenen Zahlen stehen im Kommentar der Konstante, wie es die Allokations-Specs
  mit ihren Limits tun.
- **`Stylesheets.ts` geht aus dem Coverage-Zähler**, statt eines Specs mit DOM-Attrappen:
  die Klasse schreibt in ein echtes `CSSStyleSheet`, und ein Browser-Test deckt sie ab.
  Die Empfehlung des Audits lässt beides offen.
- **Interaktive Ziele über den Pfad bis `pointerTarget`.** Geprüft werden alle Einträge
  von `composedPath()` vom Ziel des Drucks bis ausschließlich `pointerTarget`, nicht nur
  `composedPath()[0]`: ein Druck auf das `<span>` in einem `<button>` oder auf eine
  `<option>` in einem `<select>` ist ein Druck auf den Button bzw. das Select. Für
  `contenteditable` reicht der erste Eintrag ohnehin (`isContentEditable` erbt sich), die
  Tastatur (`isEditableTarget`, Zeile 78) bleibt deshalb, wie sie ist.
- **Browser-Test für `pointerTarget`**: der Node-Spec fälscht `composedPath()`; ob der
  Pfad durch eine offene Shadow-Root und aus einem `<button>`-Kind heraus wirklich so
  aussieht, sagt nur ein echter Browser.
- **Die Lookbook-Demo `map2d-cam-visi` bleibt**, wie sie ist: ihr `pointerDisabled`
  schaltet zwischen Orbit- und Pan-Steuerung um (`apps/lookbook/src/pages/demos/map2d-cam-visi.astro:55`),
  das ist kein Workaround für fehlende Pointer-Ziele.
- **Keine neue Seite unter `docs/`**: `PanControl2D` und `CameraBasedVisibility` haben
  dort keinen Abschnitt; die Fähigkeit steht im TSDoc und im CHANGELOG.
  `packages/twopoint5d/docs/architecture.md` (Abschnitt `map2d/`) bleibt richtig.
- **Ein Paket, kein Teilen**: sechs Findings wie im Grobplan; der Controls-Teil der
  Coverage-Schwelle misst den Stand nach BUG-006, beide gehören zusammen.

## Vorgehen

Lies vor der ersten Änderung `AGENTS.md` ganz und die Quellen eines Moduls ganz, bevor
du darin änderst (`cat src/map2d/*.ts` ist ein Aufruf). Für den CHANGELOG lädst du den
Skill `updating-changelog`. Code, Kommentare, TSDoc, CHANGELOG und Commit-Message auf
Englisch; keine Finding-IDs, nirgends; kein Satz über den Vorzustand außer in der
Commit-Message. Relative Imports mit `.js`, Typen per `import type`.

Einzelläufe während der Arbeit (aus dem Repo-Root):
`pnpm nx test twopoint5d -- src/map2d/RectangularVisibilityArea.spec.ts` (eine Datei),
`pnpm test:allocations`, `pnpm test:coverage`, `pnpm lint`, `pnpm typecheck`.
Browser-Tests einzeln: siehe `packages/twopoint5d-testing/package.json`; am Ende läuft
ohnehin `pnpm run ci`.

Jeder Schritt mit »rot« heißt: erst den Test schreiben, laufen lassen, den roten Lauf
(Testname, Kommando, Ausgabe) in den Report, dann beheben.

### 1. Tile-Reuse in `RectangularVisibilityArea` über Indizes

1.1 Regressionstest in `RectangularVisibilityArea.spec.ts`, im `describe('computeVisibleTiles()')`:
    `test('a grid of 0.1 scrolled tile by tile keeps the tile set a fresh area computes', …)`.
    Grid `new Map2DTileCoordsUtil(0.1, 0.1)`, `new RectangularVisibilityArea(0.7, 0.3)`,
    `matrixWorld` aus dem `beforeEach`. Zwei Durchläufe zu je 40 Schritten — einmal
    `center[0] -= 0.1`, einmal `center[1] -= 0.1`, vom Zentrum `[0, 0]` aus, aufsummiert, also
    mit Rundungsfehlern, darum geht es. Je Schritt:
    - `result = area.computeVisibleTiles(previous, [cx, cy], grid, matrixWorld)!`, danach
      `previous = result.tiles`
    - `fresh = new RectangularVisibilityArea(0.7, 0.3).computeVisibleTiles([], [cx, cy], grid, matrixWorld)!`
    - `expect(ids(result.tiles), \`step ${i}\`).toEqual(ids(fresh.tiles))`
    - `ids(result.reuseTiles ∪ result.removeTiles)` gleich den ids von `previous` vor dem Aufruf
      (die Liste vor dem Aufruf kopieren: `previous` kann das `tiles` des letzten Ergebnisses sein)
    - `new Set(ids(result.tiles)).size === result.tiles.length` (keine Tile doppelt)
    Rot vor dem Fix (das Audit maß 13 von 40 abweichenden Schritten für den horizontalen Scroll).

1.2 Fix in `computeVisibleTiles()`, Schleife `RectangularVisibilityArea.ts:197–208`: die
    Zugehörigkeit über die ganzzahligen Indizes entscheiden, nicht über `fullViewArea.isIntersecting(tile.view)`:

    ```ts
    const tx = tile.x - tileCoords.tileLeft;
    const ty = tile.y - tileCoords.tileTop;
    if (!tileGridChanged && tx >= 0 && tx < tileCoords.columns && ty >= 0 && ty < tileCoords.rows) {
      reuseTiles.push(tile);
      tileCreated[ty * tileCoords.columns + tx] = 1;
    } else {
      removeTiles.push(tile);
    }
    ```

    Ein Kommentar über dem `if` sagt, warum Indizes: eine Kante aus `tileX * tileWidth` und eine aus
    `left + columns * tileWidth` runden bei Kachelgrößen wie 0.1 verschieden, und ein Index außerhalb
    der Spalten markierte die Zelle einer Nachbarzeile als belegt. (Präsens, kein »früher«.)

1.3 `#fullViewArea` (Zeile 68) und `AABB2.from(tileCoords, this.#fullViewArea)` (Zeile 176) fallen
    damit weg; der Kommentar in Zeile 67 gilt dann nur noch `#offset` und `#translate` und bleibt
    für die beiden stehen. `AABB2` bleibt importiert (`#queryArea`, Tile-Bau).

1.4 Die Allokations-Specs von `RectangularVisibilityArea` in `src/map2d/hot-path-allocations.spec.ts`
    (Zeilen 168–220) bleiben grün; nichts daran ändern.

### 2. Hot Path der Hull: Allokations-Specs zuerst, dann Indexzugriff

2.1 In `src/map2d/hot-path-allocations.spec.ts` eine Kamera-Fabrik neben `makeTopDownCamera()`
    (Zeile 43) — dieselbe wie in `hot-path-allocations.tilted-view.spec.ts:44–51`:

    ```ts
    function makeTiltedCamera(): PerspectiveCamera {
      const camera = new PerspectiveCamera(75, 1.6, 0.1, 4000);
      camera.position.set(0, 350, 500);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      return camera;
    }
    ```

    und ein Grid `const makeTiltedViewGrid = () => new Map2DTileCoordsUtil(400, 400, 0.25, -0.5);`
    mit Kommentar »208 tiles under the tilted camera« (so misst es die Tilted-View-Spec; die Zahl
    im Test nachprüfen und den Kommentar an das Gemessene halten).

2.2 Neuer Test im `describe('CameraBasedVisibility on the hot path')`, nach Zeile 154:
    `test('a recomputation over the same tiles under a tilted camera allocates nothing', …)` —
    gebaut wie der Test in Zeile 129–154 (zwei `matrixWorld` aus `makeMatrixWorld()` und
    `makeOtherMatrixWorld()`, `flip`, `measureSettledBytes`, `RECOMPUTATIONS_PER_ROUND`,
    Limit `BYTES_PER_RECOMPUTATION_LIMIT`), aber mit `makeTiltedCamera()` und `makeTiltedViewGrid()`.
    Zusätzlich vor der Messung:
    - `expect(sortedIds(previous), 'both positions see the same tiles').toEqual(idsAtFirst)`
    - `expect(visibility.visibles.length, 'a view of some hundred tiles').toBeGreaterThan(150)`
    - dass die Hull gefüllt wird: `expect(visibility.pointsOnPlane.length).toBeGreaterThanOrEqual(3)`.
      Nachgerechnet in Zug 0: bei dieser Kamera treffen sechs Proben die Ebene — Mitte, Mitte unten,
      Mitte links und rechts, die beiden unteren Ecken —, die drei oberen zielen über den Horizont.
      Die Punkte links und rechts der Mitte liegen weiter weg und weiter auseinander als die unteren
      Ecken, die Hull ist also ein Trapez mit schrägen Kanten; das sagt ein Kommentar am Test. Der
      eigentliche Beleg ist die rote Messung vor 2.5.
    Rot vor 2.5: das Audit maß 586 von 608 B je Neuberechnung in `forEachTileWithinConvexHull()`.

2.3 Den Kommentar von `BYTES_PER_RECOMPUTATION_LIMIT` (Zeilen 19–23) um den Messwert des neuen
    Tests nach dem Fix ergänzen, im selben Ton (»… and X B under a tilted camera«).

2.4 Neues `describe('Map2D on the hot path')` in derselben Datei, Frame-Pfad
    `Map2D#update()` → `Map2DTileStreamer#update()` → `Map2DTileRenderer` Begin/Add/Reuse/End:
    - Aufbau: `const map2d = new Map2D(new Map2DTileStreamer(400, 400, 0.25, -0.5));`
      `map2d.visibilitor = new CameraBasedVisibility(camera);` mit `camera = makeTiltedCamera()`,
      `map2d.addTileRenderer(new Map2DTileRenderer(makeTileFactory()))`, wobei
      `makeTileFactory()` eine Fake-Factory nach dem Muster von `Map2DTileRenderer.spec.ts:16–27`
      ist, die nichts allokiert: `createTile: () => next++` (ein Smi), alle anderen Methoden leer.
      Einmal `map2d.update()` vor der Messung (legt die Tiles an).
    - `test('an update() under a standing camera allocates nothing', …)`: `CALLS_PER_ROUND`
      Aufrufe `map2d.update()` je Runde, Limit `BYTES_PER_CALL_LIMIT`. Dazu prüfen, dass die
      Runde wirklich den Cache-Pfad nimmt: `visibility.serial` steht nach der Messung, wo es vor
      ihr stand.
    - `test('an update() over the same tiles under a moving camera allocates nothing', …)`: zwei
      Kamerapositionen als vorab gebaute `Vector3`-Konstanten, `(0, 350, 500)` und `(0, 350, 501)`
      (in Zug 0 nachgerechnet: beide sehen dieselben 208 Tiles auf diesem Grid);
      je Neuberechnung `flip ^= 1; camera.position.copy(positions[flip]!); map2d.update();` —
      ganze Zahlen und Objekte in der Runde, nichts Gebrochenes ausgerechnet (AGENTS.md).
      `RECOMPUTATIONS_PER_ROUND` je Runde, Limit `BYTES_PER_RECOMPUTATION_LIMIT`. Vorher
      `expect`, dass beide Positionen dieselben Tiles sehen (ids von `map2d.tileStreamer.tiles`);
      tun sie es nicht, eine andere ganzzahlige Verschiebung wählen. Nach der Messung: `serial` ist
      um mehr als `RECOMPUTATIONS_PER_ROUND` gewachsen (jede Runde rechnete neu), und die Factory
      wurde in der Runde nicht gerufen (ein Zähler auf `createTile`/`updateTile`/`update`,
      außerhalb der Messung abgefragt — `vi.spyOn` erst nach der Messung, wie in Zeile 335–339).
    - Beide Tests sind vor 2.5 vermutlich rot (Hull). Bleibt einer **nach** 2.5 und nach
      Schritt 3 rot, die Quelle messen, nicht raten (z. B. die Teilaufrufe einzeln messen:
      `computeVisibleTiles()` allein gegen `map2d.update()`). Liegt sie in
      `Map2DTileStreamer#update()` oder `Map2DTileRenderer` — Kandidaten sind die `for … of`
      über `this.renderers` (ein `Set`, `Map2DTileStreamer.ts:247`) und über die Ergebnislisten
      (Zeilen 259–261) —, dort beheben, im Stil der Datei (Indexschleifen, eine Kommentarzeile
      warum) und mit Messwert im Report. Liegt sie außerhalb von `src/map2d/`, nicht dort
      beheben: Status `FERTIG_MIT_VORBEHALT`, als Folge melden mit Datei, Zeile und Bytes.

2.5 Indexzugriff statt Tupel-Destrukturierung, an genau diesen Stellen:
    - `convexTileHull.ts:102` `const [x, y] = hull[0]!;`
    - `convexTileHull.ts:123–124` `const [ax, ay] = hull[i]!; const [bx, by] = hull[(i + 1) % hull.length]!;`
      → `const a = hull[i]!; const b = hull[(i + 1) % hull.length]!; const ax = a[0]; …`
    - `CameraBasedVisibility.ts:743` (`FRUSTUM_PROBES_NDC`), `:1101` (`hull[i]`), `:1346` (`NEIGHBOR_DX_DY`)
    Je Funktion eine Kommentarzeile, warum per Index — im Ton der vorhandenen Notiz in
    `CameraBasedVisibility.ts:609` (»read by index: a tuple of doubles destructured … costs an
    allocation per call«); in `convexTileHull.ts` sinngemäß: destrukturiert, allokiert die Schleife
    auch nach dem Warm-up, sobald die Hull schräge Kanten hat. `Map2DTileRenderer.ts:190`
    (`clearTiles()`, kein Frame-Pfad) bleibt.

2.6 `pnpm test:allocations`: 2.2 und 2.4 grün, alles andere bleibt grün.

### 3. Frustum-Box auf den Höhenbereich des Frustums klemmen

3.1 Regressionstest in `CameraBasedVisibility.spec.ts`, im `describe('depth')` (ab Zeile 1186):
    `test('with the default depth, a tilted view of tiles of 1 takes no more tiles than the ground around the camera holds', …)`.
    `const camera = new PerspectiveCamera(60, 1, 0.1, 20); camera.position.set(0, 5, 5); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();`
    `new CameraBasedVisibility(camera)` mit Default-`depth` und Default-`maxVisibleTiles`,
    `computeVisibleTiles([], [0, 0], new Map2DTileCoordsUtil(1, 1), new Matrix4())`.
    `expect(visibility.visibles.length, …).toBeLessThan(Math.PI * camera.far ** 2)` mit einem
    Kommentar an der Schranke: when this bound was set, the view held 936 tiles, 498 of them with a
    box the frustum meets (a separating-axis test tells), and boxes of the full default depth let
    7 168 tiles through. Rot vor 3.3 (7 168).

3.2 Zwei weitere Specs im selben `describe`:
    - `test('the frustum box reaches no higher and no lower than the view frustum, the tile box keeps the depth', …)`:
      Top-down-Kamera wie `makeTopDownCamera()` (Zeile 23), aber `far = 150` — Höhenbereich des
      Frustums `[-50, 99.9]`; `visibility.depth = 400`; Grid `new Map2DTileCoordsUtil(100, 100)`,
      `new Matrix4()`. Für jede sichtbare Tile: `frustumBox.min.y` ≈ `-50`, `frustumBox.max.y` ≈ `99.9`
      (`toBeCloseTo(…, 6)`), `box.min.y === -200`, `box.max.y === 200`.
    - `test('on a tilted map node the cut keeps every tile a flat box finds', …)`: `makeTiltedCamera()`
      der Spec-Datei, Grid `new Map2DTileCoordsUtil(256, 256)`, Map-Knoten
      `new Matrix4().compose(new Vector3(0, 0, 0), new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.3), new Vector3(1, 1, 1))`;
      eine Instanz mit `depth = 0`, eine mit Default-`depth`; beide sehen Tiles (`visibles.length > 0`),
      und jede id der ersten steht auch in der zweiten. (Die geklemmte Säule enthält die flache Tile, also besteht sie den Ebenentest, wo
      die flache ihn besteht — die Klemmung darf nichts verlieren.)

3.3 Umsetzung in `CameraBasedVisibility.ts`:
    - Neben den `SEARCH_STOP_…`-Konstanten (Zeilen 180–184):

      ```ts
      // where `CameraBasedVisibility` keeps the height range of the view frustum along the normal of
      // the map plane, in the local space of the map node, for the recomputation that runs
      const FRUSTUM_HEIGHT_MIN = 0;
      const FRUSTUM_HEIGHT_MAX = 1;
      ```

    - Neues Feld neben `#searchStop` (Zeile 461), ein `Float64Array(2)` aus demselben Grund wie
      `#seenScalars` (der Kommentar sagt das, wie bei `#searchStop`): `readonly #frustumHeight = new Float64Array(2);`
    - In `findPointsOnPlaneThatAreInViewFrustum()` (Zeilen 723–757): vor der Schleife
      `frustumHeight[FRUSTUM_HEIGHT_MIN] = Infinity; frustumHeight[FRUSTUM_HEIGHT_MAX] = -Infinity;`.
      In der Schleife, **nach** den beiden `unproject()` und **vor** `intersectLine()` und dem
      `continue` — jede Probe zählt, auch eine, die die Ebene verfehlt —, `start` und `end` in den
      lokalen Raum des Map-Knotens nehmen (`_v.copy(point).applyMatrix4(this.#matrixWorldInverse)`,
      `#matrixWorldInverse` ist ab Zeile 638 aktuell) und den Bereich mit `_v.y` aufweiten. Eine
      private Methode `widenFrustumHeight(point: Vector3): void` ist recht — sie nimmt ein Objekt,
      keinen Double. Kommentar: die Eckproben laufen durch die acht Ecken des Frustums, auf `near` und
      auf `far`, also spannen diese Punkte den Höhenbereich auf. Die Translation von `#tileBoxMatrix`
      verschiebt nur in x und z, deshalb gilt der Bereich auch im Raum, in dem `setBox()` baut.
    - `setBox()` (Zeilen 1373–1387): für `forFrustum` `ground` und `ceiling` auf den Bereich klemmen,
      mit Vergleichen ausgeschrieben, nicht über `Math.max`/`Math.min` (Notiz zu Doubles, Zeilen 74–79):

      ```ts
      let ground = this.#depth * -0.5 * scale;
      let ceiling = this.#depth * 0.5 * scale;
      if (forFrustum) {
        // no point of the frustum lies beyond this height, so the part of the box beyond it meets
        // none — and a box higher than that passes the side planes of a tilted view far outside it
        const frustumHeight = this.#frustumHeight;
        const lowest = frustumHeight[FRUSTUM_HEIGHT_MIN]!;
        const highest = frustumHeight[FRUSTUM_HEIGHT_MAX]!;
        if (ground < lowest) ground = lowest;
        if (ceiling > highest) ceiling = highest;
      }
      ```

      `ground > ceiling` kann nicht entstehen: `setBox()` läuft nur in `findVisibleTiles()`, also bei
      `hitCount > 0`, und ein Treffer der Ebene liegt auf einer Probenstrecke, also
      `lowest ≤ 0 ≤ highest`. Das gehört als ein Satz in den Kommentar. `tile.box` (`forFrustum` false)
      bleibt ungeklemmt.

3.4 TSDoc nachziehen (Wortlaut darf geglättet werden, der Inhalt nicht):
    - `TileBox.frustumBox` (Zeile 30): »The box the view frustum is tested against, in world space:
      scaled by `frustumBoxScale`, and reaching no further above and below the map plane than the view
      frustum does.«
    - `frustumBoxScale` (Zeilen 235–245): nach dem ersten Satz: »Along the normal of the map plane the
      box reaches no further than the view frustum — see {@link depth}.«
    - `depth` (Zeilen 312–323): neuer Absatz nach dem ersten: »The box the view frustum is tested
      against reaches no further above and below the plane than the frustum itself, measured in the
      local space of the map node: no point of the frustum lies beyond that. Within it, a box much
      higher than the tile is wide still passes the side planes of a tilted view beyond the edge of the
      view — `Frustum#intersectsBox()` tests the planes one by one —, and its tile is taken as visible
      without being in view. On tiles much smaller than the depth such tiles can make up about half of
      the visible set; a depth no higher than what stands on the map keeps them few.«
    - `searchCanStop()` (Zeilen 1254–1258), den Satz mit »in rare cases« ersetzen: »… such a tile,
      taken as visible and nearer than the furthest kept one, can be left out for a tile further away.
      How many boxes pass that way grows with their height against the tile size — see {@link depth} —;
      the boxes reach no higher and no lower than the frustum.«
    - `setBox()` (Zeilen 1368–1372): »… with the margin of `frustumBoxScale` for the box the frustum is
      tested against, that box cut to the height range of the view frustum.«
    - Klassen-TSDoc (Zeilen 195–229) unverändert.

3.5 Bestehende Specs, die die Höhe der Frustum-Box auf `depth × frustumBoxScale` festnageln, gegen
    das neue Verhalten ziehen — sicher betroffen:
    `CameraBasedVisibility.spec.ts:1164–1183` (`the frustum box of a tile is frustumBoxScale times the tile, around the tile`):
    Top-down-Kamera auf Höhe 100 mit `near` 0.1, `depth` 100 × Skala 2 = ±100 → oben auf 99.9
    geklemmt, `[200, 200, 200]` hält nicht mehr. `visibility.depth = 50` setzen (±50 liegt im
    Bereich `[-400, 99.9]`), `[200, 100, 200]` erwarten, den Kommentar in Zeile 1176 anpassen
    (»depth (50) times two, within the height the view frustum covers«). Danach die ganze Datei und
    `CameraBasedVisibilityHelpers.spec.ts` laufen lassen; jeder weitere rote Test, der nur die alte
    Höhe festhielt, wird ebenso gezogen und im Report genannt. `the frustum box and the center of a
    tile are the ones two transforms in a row give` (Zeilen 486–529) bleibt nach Rechnung grün
    (±55 im Bereich `[-400, 99.9]`, Drehung nur um Y).

3.6 `pnpm test:allocations` erneut: die Klemmung läuft je Neuberechnung und je Tile und darf nichts
    allokieren; die Specs aus 2.2 und 2.4 halten das fest.

### 4. `PanControl2D`: `pointerTarget` und interaktive Ziele

4.1 Node-Specs in `PanControl2D.spec.ts` zuerst (rot vor 4.3). Der Helfer `pointer()` (Zeile 67)
    bekommt zwei optionale Felder: `target` (das `EventTarget`, auf dem dispatcht wird, Default `doc`)
    und `path` (was `composedPath()` antwortet, Default `[]`). Neue Tests in einem eigenen
    `describe('pointerTarget')` bzw. `describe('a press on an interactive element')`:
    - mit `pointerTarget: canvas` (`const canvas = new EventTarget()`): ein `pointerdown` auf `doc`
      startet keinen Pan (danach `pointermove` auf `doc`, `update()`, `panView` steht); ein
      `pointerdown` auf `canvas` startet einen, und die `pointermove` auf `doc` bewegen die Ansicht.
    - ohne Option: ein `pointerdown` auf `doc` startet einen Pan (Default `document`).
    - `pointerDisabled = true` nimmt den Listener von `canvas`, `false` hängt ihn wieder an;
      `dispose()` nimmt ihn ab (ein `pointerdown` auf `canvas` danach bewegt nichts).
    - `test.each(['input', 'textarea', 'select', 'button'])`: ein `pointerdown`, dessen
      `composedPath()` mit `{localName: …}` beginnt, startet keinen Pan; dasselbe für
      `{localName: 'div', isContentEditable: true}`.
    - ein `pointerdown` aus einem Kind eines Buttons: `path: [{localName: 'span'}, {localName: 'button'}, canvas]`
      mit `pointerTarget: canvas` → kein Pan; `path: [{localName: 'canvas'}, canvas]` → Pan.
    - ein interaktives Element **oberhalb** von `pointerTarget` im Pfad zählt nicht:
      `path: [canvas, {localName: 'button'}]` mit `pointerTarget: canvas` → Pan.
    - ein Element einer anderen Realm geht über die Properties durch wie bei `isEditableTarget`
      (plain objects, kein `instanceof`) — die Tests oben tun das schon.

4.2 `src/controls/hot-path-allocations.spec.ts`: `pointerEvent()` (Zeilen 18–28) baut Objekte ohne
    `composedPath`; der neue `#onPointerDown` ruft es. Ein `composedPath: () => NO_PATH` mit einer
    einmal gebauten Konstante `const NO_PATH: EventTarget[] = [];` ergänzen.

4.3 Umsetzung in `PanControl2D.ts`:
    - `PanControl2DOptions` (Zeilen 86–162) bekommt `pointerTarget?: EventTarget` mit TSDoc: »The
      target the `pointerdown` that starts a pan is listened for on. Default is `document`: a press
      anywhere on the page starts a pan. Name the canvas, or an element around it, and a press
      elsewhere starts none. The `pointermove`, `pointerup` and `pointercancel` of a drag are listened
      for on `document` whatever this names, so a drag that leaves the element goes on until it is let
      go. A press on an `input`, `textarea`, `select`, `button` or an element with `contenteditable` —
      or on an element within one of them, up to this target — starts no pan; the path is read through
      `composedPath()`, so in an open shadow root as well.«
    - Feld `readonly #pointerTarget: EventTarget;`, im Konstruktor per
      `readOption(options, 'pointerTarget', document)` gesetzt, **vor** `this.pointerDisabled = …`
      (Zeile 236), mit einer Kommentarzeile, warum davor (der Setter hängt den Listener an).
    - Setter `pointerDisabled` (Zeilen 364–384): `POINTERDOWN` auf `this.#pointerTarget` an- und
      abmelden; `POINTERUP`, `POINTERMOVE`, `POINTERCANCEL` bleiben auf `document`.
    - Neben `isEditableTarget` (Zeile 78) eine Funktion `isInteractiveTarget(target)`:
      `isEditableTarget(target)` oder `localName === 'button'`, über Properties wie dort.
    - `#onPointerDown` (Zeile 471): zuerst `if (this.#startsOnInteractiveTarget(event)) return;`.
      Die Methode liest `const path = event.composedPath();` — leer (ein nicht dispatchtes Event)
      → `isInteractiveTarget(event.target)`; sonst die Einträge ab Index 0 bis ausschließlich
      `this.#pointerTarget` (Abbruch, sobald er erreicht ist), `true` beim ersten interaktiven.
      Kommentar wie in `#onKeyDown` (Zeilen 624–627), warum `composedPath()` und nicht
      `event.target` (Retargeting auf den Shadow Host), und warum der Pfad und nicht nur sein
      erster Eintrag (das Kind eines Buttons).
    - `isEditableTarget` und der Tastaturpfad bleiben unverändert; der TSDoc von `keys` auch.
    - Kein öffentlicher Getter für `pointerTarget` (die Option genügt, wie bei `cursorStylesTarget`).

4.4 Browser-Test `packages/twopoint5d-testing/test/pan-control-pointer-target.test.js`, Aufbau wie
    `pan-control-input.test.js` (Boxen anlegen, `afterEach` räumt auf, `control.dispose()`):
    - ein `<canvas>` als `pointerTarget`, ein Nachbar-`<div>`: Druck auf das `div` + Bewegung →
      `panView` steht; Druck auf den Canvas + Bewegung über das `div` hinaus → die Ansicht folgt.
    - ein `<button>` mit einem `<span>` darin, beide über dem Default `document`: Druck auf das
      `span` → kein Pan; Druck auf ein `<input>` in einer offenen Shadow-Root → kein Pan.
    Der Fixture `pointer()` (`test/helpers/fixtures.js:140–155`) dispatcht `bubbles: true` ohne
    `composed`: aus einer Shadow-Root erreicht so ein Event `document` nicht. `composed: true`
    ergänzen (echte Pointer-Events sind composed) und den TSDoc des Fixtures um diesen Halbsatz
    ergänzen. Die übrigen Browser-Tests dispatchen im Light DOM und sollten unverändert laufen;
    fällt einer, weil er sich darauf stützte, dass ein Event aus einer Shadow-Root `document` nicht
    erreicht, im Report nennen und den Test ziehen, nicht das Fixture zurückdrehen.

### 5. Coverage-Schwellen für `src/display` und `src/controls`

5.1 `packages/twopoint5d/vite.config.ts`:
    - `coverage.exclude` (Zeile 47) um `'src/display/Stylesheets.ts'` ergänzen, mit einem Kommentar:
      the class writes into a real `CSSStyleSheet`, which the specs — run under node, without a DOM —
      do not have; `packages/twopoint5d-testing/test/stylesheets.test.js` covers it in the browser.
    - Im Kommentar Zeilen 49–55 den Satz »`src/controls/` and `src/display/` carry no threshold of
      their own: the browser suite … is not measured.« streichen, ersatzlos — die Regel davor
      (»rounded down minus two«) gilt für die neuen Einträge wie für die alten. Kein Satz über den
      Vorzustand.
    - Unter `thresholds`, alphabetisch vor `'src/map2d/**'`:
      `'src/controls/**': {statements: S, branches: B, functions: F, lines: L},` und
      `'src/display/**': {statements: 82, branches: 73, functions: 81, lines: 84},`
      (Display: gemessen 84,38 / 75,42 / 83,26 / 86,02 ohne `Stylesheets.ts`, siehe oben).
5.2 Die Controls-Werte misst du **nach** Schritt 4, mit deinen neuen Specs:

    ```bash
    cd packages/twopoint5d
    pnpm vitest --run --coverage --project specs --coverage.reporter=json-summary \
      --coverage.reportsDirectory=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/2700fbd8-0496-4bd7-9248-d90b950d4db7/scratchpad/paket-2.cov
    python3 -I /tmp/claude-1000/-home-spw-spaceland-twopoint5d/2700fbd8-0496-4bd7-9248-d90b950d4db7/scratchpad/paket-2.coverage-by-module.py \
      /tmp/claude-1000/-home-spw-spaceland-twopoint5d/2700fbd8-0496-4bd7-9248-d90b950d4db7/scratchpad/paket-2.cov/coverage-summary.json src/controls/ src/display/
    ```

    Das Skript gibt je Modul Messwert und Schwelle (abgerundet minus zwei) aus; die Schwelle trägst du
    ein. Liegt ein Controls-Messwert unter dem Stand vor dem Paket (91,78 / 74,30 / 90,74 / 94,40), fehlt
    den neuen Zweigen aus 4.3 ein Spec: ergänzen, nicht die Schwelle senken. Die Display-Werte sollten
    die oben genannten bestätigen; weichen sie ab, gilt das Gemessene, und der Report nennt beide.
    Das Verzeichnis `--coverage.reportsDirectory` liegt außerhalb des Repos, damit
    `packages/twopoint5d/coverage` nicht überschrieben wird.

### 6. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`)

Skill `updating-changelog` laden. Veröffentlichte API, also neue Einträge (keine Umschrift
vorhandener). `### Fixed` gibt es unter `[Unreleased]` noch nicht — anlegen, in der Reihenfolge
von Keep a Changelog (nach `### Changed`, vor `### Migration Guide`). Präsens, kein »where it …
before«; die Vorher-Zahlen gehören in die Commit-Message. Kein Migrationseintrag: alles ist
additiv oder ein Verhalten, auf das sich niemand stützen kann (ein Pan, der auf einem Button beginnt).
Entwürfe:

- **Added:** add the option `pointerTarget` of `PanControl2D`, the `EventTarget` the `pointerdown` that starts a pan is listened for on — `document` by default. Name the canvas, or an element around it, and a press elsewhere on the page starts no pan; `pointermove`, `pointerup` and `pointercancel` stay on `document`, so a drag that leaves the element goes on until it is let go
- **Changed:** `PanControl2D` starts no pan with a press on an `input`, `textarea`, `select`, `button` or an element with `contenteditable`, nor on an element within one of them up to the `pointerTarget` — read through `composedPath()`, in an open shadow root as well: a range slider, a text selection or a button of an HTML interface over the canvas works as it does without the control
- **Changed:** perf `CameraBasedVisibility` tests a tile with a box that reaches no further above and below the map plane than the view frustum: under a camera at a height of 5, tilted by 45° with a `far` of 20, the default `depth` of 100 on tiles of 1 takes some 940 tiles as visible — about 500 of them meet the frustum — and a recomputation of that view takes some 0.5 ms. `TileBox#frustumBox`, and the boxes `CameraBasedVisibilityHelpers` draws for it, are cut the same way; `TileBox#box` keeps the full `depth`
- **Changed:** perf `CameraBasedVisibility` allocates nothing in a recomputation under a tilted camera once a frame loop has settled, however many rows its view spans, and neither does `Map2D#update()` under a standing or a moving camera; `src/map2d/hot-path-allocations.spec.ts` holds both to it
- **Fixed:** `RectangularVisibilityArea` keeps a tile of the last view for reuse only while its tile coordinate lies among the columns and rows of the new view: on a grid of tiles of 0.1, the tile set after every step of a scroll is the one a fresh area computes for the same center

Die Zahlen im dritten Eintrag sind die aus »Vorab gemessen«; misst die Umsetzung andere, gilt das
Gemessene (der Spec aus 3.1 gibt die Tile-Zahl aus).

### 7. Verify

`pnpm run ci` aus dem Repo-Root, grün. Dazu im Report: die roten Läufe aus 1.1, 2.2, 2.4 (sofern
rot), 3.1 und 4.1, die Messwerte aus 2.3 und 2.4, die Controls-Schwellen aus 5.2 samt Messwerten,
die Tile-Zahl aus 3.1 nach dem Fix.

## Commit-Message

```
fix(twopoint5d): reuse map tiles by their indices, cut the frustum boxes of tiles to the view frustum, keep the hull scan free of allocations, and let PanControl2D start a pan only on its pointer target and off interactive elements

- RectangularVisibilityArea decides the reuse of a tile by its tile
  coordinate against the columns and rows of the new view; on a grid of
  0.1 the edges of the view and of a tile rounded apart, so a tile beside
  the view stayed and one at the leading edge was never built
- CameraBasedVisibility cuts the box a tile is tested with to the height
  range of the view frustum in the local space of the map node: a camera
  at (0, 5, 5) with a far of 20 over tiles of 1 takes 936 tiles as visible
  with the default depth of 100 instead of 7 168, at 0.5 ms a
  recomputation instead of 3.3 ms
- forEachTileWithinConvexHull() and the search of CameraBasedVisibility
  read hull points, probes and neighbour offsets by index; destructured,
  the hull scan allocated some 600 B per recomputation under a tilted
  camera
- the allocation specs cover a tilted camera and Map2D#update() under a
  standing and a moving camera
- PanControl2D takes the option pointerTarget for the pointerdown that
  starts a pan, and a press on an input, textarea, select, button or
  contenteditable element, or within one, starts none
- src/display and src/controls carry coverage thresholds of their own;
  Stylesheets.ts, which needs a real CSSStyleSheet, is counted by the
  browser suite only
```

Zahlen im Body an das anpassen, was die Umsetzung misst. Den Trailer `Remediation-Run` setzt Zug 5.

## Findings im Volltext

**BUG-002 · high · packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:200** (auch :204, :218) — Reuse-Entscheidung in `RectangularVisibilityArea` über Tile-Indizes statt über `AABB2#isIntersecting()` treffen
Ob ein Tile aus `previousTiles` wiederverwendet wird, entscheidet ein Float-Vergleich von `fullViewArea` (Kanten aus `computeTilesWithinArea()`: `left + columns * tileWidth`) mit `tile.view` (Kanten aus `tileX * tileWidth`). Beide Rechenwege runden bei Kachelgrößen wie 0.1 oder 0.3 verschieden, sodass ein Tile direkt neben dem Sichtrechteck als »schneidend« gilt. Dann wird `tx = tile.x - tileLeft` zu `-1` oder `columns`; ohne Bounds-Check markiert `tileCreated[ty * columns + tx]` die Zelle der Nachbarzeile als belegt. Folge: das Tile außerhalb bleibt als Reuse stehen, und an der Vorderkante fehlt pro Zeile ein Tile, das nie angelegt wird. Repro (esbuild-Bundle der Quelle, Grid 0.1×0.1, Fläche 0.7×0.3, Scroll um je 0.1 nach links): in 13 von 40 Schritten fehlen 3 Tiles der neuen Spalte und 4 Tiles der verlassenen Spalte bleiben stehen, verglichen mit einer frischen Instanz. Die Specs nutzen nur Grids von 50 und 100, wo die Rechnung exakt ist; `CameraBasedVisibility` hat genau diese Klasse Fehler für Grids unter 1 bereits behoben.
Evidenz: `if (!tileGridChanged && fullViewArea.isIntersecting(tile.view)) { reuseTiles.push(tile); const tx = tile.x - tileCoords.tileLeft; … tileCreated[ty * tileCoords.columns + tx] = 1;`
Empfehlung: Die Zugehörigkeit über ganzzahlige Indizes prüfen: `tile.x >= tileLeft && tile.x < tileLeft + columns && tile.y >= tileTop && tile.y < tileTop + rows`; nur dann reuse und markieren, sonst remove. Einen Spec mit Grid 0.1 und fortlaufendem Scroll ergänzen, der jede Runde gegen eine frische Instanz vergleicht.

**PERF-001 · medium · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:310** (auch :876, :1254) — Default-`depth` von `CameraBasedVisibility` an die Kachelgröße binden oder den Box-Test verschärfen
`depth` steht fest auf 100 Welteinheiten, die Kachelgröße von `Map2D`/`Map2DTileStreamer` auf 1. Die Frustum-Boxen werden damit 110 hohe, 1.1 breite Säulen, und `Frustum#intersectsBox()` prüft nur Ebene für Ebene: solche Säulen bestehen jede Seitenebene einzeln, auch weit außerhalb des Sichtkegels. Gemessen (Kamera bei (0,5,5) auf den Ursprung, fov 60, far 20, Grid 1×1): 10 700 sichtbare Tiles bei `depth = 100`, 538 bei `depth = 2`, 362 bei `depth = 0`. Mit far 20 kann die Grundfläche unter dem Frustum höchstens ~1 260 Tiles fassen, also sind mindestens 8 700 Tiles False Positives. Eine Neuberechnung kostet dann 5,4 ms statt 0,2 ms, das Limit `maxVisibleTiles` greift mit Warnung, und der Renderer verteilt seine Pool-Slots auf Tiles außerhalb der Sicht. Der TSDoc von `searchCanStop()` nennt diese False Positives »rare cases«; mit den Defaults sind sie die Mehrheit.
Evidenz: `#depth = 100;` gegen `constructor(tileWidth = 1, tileHeight = 1, …)` in `Map2DTileStreamer`; `if (!tile.insideProbeHull && !this.#cameraFrustum.intersectsBox(tile.frustumBox)) continue;`
Empfehlung: Entweder `depth` relativ zur Kachelgröße interpretieren bzw. den Default auf einen kleinen Wert setzen (Breaking, mit CHANGELOG-Eintrag), oder die Box-Höhe vor dem Test auf den y-Bereich klemmen, den das Frustum tatsächlich überdeckt, oder einen exakteren Test verwenden (Separating Axis mit den Frustum-Kanten). Den TSDoc von `depth` und `searchCanStop()` um die Wirkung hoher Boxen bei kleinen Kacheln ergänzen und einen Spec anlegen, der die Tile-Zahl mit Default-`depth` und Grid 1 begrenzt.
Freigegebener Weg (»Entscheidungen« im Plan): Default-`depth` bleibt 100, die Box wird vor dem Frustum-Test auf den y-Bereich geklemmt, den das Frustum tatsächlich überdeckt.

**PERF-002 · medium · packages/twopoint5d/src/map2d/convexTileHull.ts:123** (auch :124, `CameraBasedVisibility.ts:1109`) — Tupel-Destrukturierung in `forEachTileWithinConvexHull()` durch Indexzugriff ersetzen
Die Scanline-Schleife destrukturiert pro Zeile und Kante zwei Hull-Punkte (`const [ax, ay] = hull[i]!; const [bx, by] = …`). Sobald die Hull schräge Kanten hat — also bei jeder geneigten Kamera —, allokiert die Funktion auch nach 30 000 Warm-up-Runden: gemessen mit `measureAllocatedBytes()` 1 360 B pro Aufruf für eine Sechseck-Hull über 33 Zeilen und 720 B für ein Trapez über 31 Zeilen, 3,8 B für ein achsenparalleles Quadrat. Ein Heap-Sampling von `CameraBasedVisibility#computeVisibleTiles()` (Kamera bei (0,5,5), Grid 1, `depth = 2`, 537 Tiles, gleiche Tiles bei jeder Neuberechnung) ordnet 586 von 608 B pro Neuberechnung genau dieser Funktion zu. Ersetzt man die Destrukturierung durch `const a = hull[i]!; const ax = a[0], ay = a[1]; …`, fällt sie auf 0,1 B. Das widerspricht der Zusage aus dem Modulkommentar von `CameraBasedVisibility` (»allocate nothing once a frame loop has settled«) für den häufigsten Kamerafall.
Evidenz: `const [ax, ay] = hull[i]!;\n      const [bx, by] = hull[(i + 1) % hull.length]!;`
Empfehlung: Die Punkte per Index lesen (`a[0]`, `a[1]`), auch in `forEachTileWithinConvexHull()` Zeile 102 und vorsorglich in den übrigen Hot-Path-Destrukturierungen (`CameraBasedVisibility.ts` Zeilen 743, 1101, 1345), und den Fall mit einem Allokations-Spec für eine geneigte Kamera absichern.

**TEST-004 · medium · packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts:42** (auch `Map2DTileStreamer.ts:211`, `Map2DTileRenderer.ts:75`) — Allokations-Specs um eine geneigte Kamera und den Frame-Pfad von `Map2D#update()` erweitern
Die Tests »a recomputation over the same tiles allocates nothing« für `CameraBasedVisibility` laufen nur mit `makeTopDownCamera()` (fov 90, senkrecht von oben, Kacheln 100): die Probe-Hull ist dann ein achsenparalleles Rechteck, und die Allokation von gut 600 B pro Neuberechnung in `forEachTileWithinConvexHull()` bei geneigter Kamera bleibt unsichtbar. Der Tilted-View-Spec misst nur die Differenz pro Tile zwischen zwei Größen, ein Anteil, der mit Zeilen statt mit Tiles wächst, fällt dort heraus. Für den eigentlichen Frame-Pfad — `Map2D#update()` → `Map2DTileStreamer#update()` → `Map2DTileRenderer` Begin/Add/Reuse/End — gibt es überhaupt keinen Allokations-Spec (kein `hot-path-allocations*.spec.ts` nennt `Map2DTileStreamer`, `Map2DTileRenderer` oder `Map2D`).
Evidenz: `function makeTopDownCamera(): PerspectiveCamera { const camera = new PerspectiveCamera(90, 1, 0.1, 500); camera.position.set(0, 100, 0); camera.lookAt(0, 0, 0); …`
Empfehlung: Einen Test »a recomputation over the same tiles allocates nothing« mit einer geneigten Kamera (schräge Hull-Kanten, ein paar hundert Tiles) ergänzen und einen Spec für `Map2D#update()` mit stehender und mit bewegter Kamera anlegen, nach den Regeln aus AGENTS.md (ganze Zahlen und Konstanten in der Runde, `measureSettledBytes()`).

**BUG-006 · medium · packages/twopoint5d/src/controls/PanControl2D.ts:367** (auch :471, :461) — Pointer-Panning auf ein Element begrenzen und interaktive Ziele auslassen
PanControl2D hängt pointerdown/move/up/cancel an `document` und prüft in `#isPanPointer()` nur `isPrimary` und die Maustaste — kein Ziel-Element, kein Filter. Jeder Drag irgendwo auf der Seite startet einen Pan und versteckt den Cursor: ein Range-Slider oder Scrollbalken einer HTML-UI, eine Textauswahl in einem `input`, ein Button, der beim Klick minimal bewegt wird. Für die Tastatur gibt es genau diesen Schutz (`isEditableTarget`, Zeile 78), für den Pointer nicht. Die Lookbook-Demo map2d-cam-visi schaltet den Pointer deshalb von außen per `pointerDisabled` um.
Evidenz: `this.addEventListener(document, POINTERDOWN, this.#onPointerDown);` — `#isPanPointer` liest nur `event.isPrimary` und `event.buttons & this.mouseButton`
Empfehlung: Option `pointerTarget?: EventTarget` (Default `document` für Kompatibilität) für pointerdown einführen; move/up/cancel dürfen auf `document` bleiben, damit ein Drag über den Rand hinaus weiterläuft. Zusätzlich ein pointerdown verwerfen, dessen `composedPath()[0]` editierbar oder interaktiv ist (input, textarea, select, button, contenteditable) — analog zu `isEditableTarget`.
Freigegebener Weg (»Entscheidungen« im Plan): `pointerTarget?: EventTarget`, Default `document`; pointerdown auf editierbaren oder interaktiven Zielen (input, textarea, select, button, contenteditable) startet kein Panning. Abweichung von der Empfehlung: der Pfad bis `pointerTarget` statt nur `composedPath()[0]`, Grund unter »Entscheidungen dieses Zugs«.

**TEST-002 · medium · packages/twopoint5d/vite.config.ts:49** (auch :50) — Coverage-Schwelle für src/display und src/controls einführen
Alle anderen Module haben eine Per-Modul-Schwelle (sprites 100 %, text 98 %), src/display/** und src/controls/** haben keine, mit der Begründung, die Browser-Suite decke sie ab — die wird aber nicht gemessen. Display.ts (2306 Zeilen, Heimat der neuen Pixel-Ratio-, pixelZoom-, maxPixels- und AdaptiveResolution-Logik) steht im vorliegenden lcov bei 454 von 618 Zeilen (rund 73 %), Stylesheets.ts bei 4 von 56. Nur die globale Schwelle (83 %) hält dagegen; ein Rückgang im Display-Modul fällt dort nicht auf.
Evidenz: `'src/stage/**': {...}` ohne Eintrag für `src/display/**`; lcov: `src/display/Display.ts LF:618 LH:454`
Empfehlung: Per-Modul-Schwelle für src/display/** (und src/controls/**) auf Ist-Stand minus 2 Punkte setzen, wie bei den anderen Modulen; Stylesheets.ts ggf. aus dem Zähler nehmen oder per Spec abdecken.
Stand nach Paket 1: `Display.ts` 432 von 596 Zeilen (72,48 %).

## Urteil des Reviewers

Review 0 (`paket-2.review-0.json`, opus/high) auf `paket-2.diff`, Review 1 (`paket-2.review-1.json`, sonnet/medium) gezielt auf die Nachbesserung, Diff `paket-2.r1.diff`. Fundstellen nach dem Stand vor dem Commit 4bf14f2e.

- BUG-002: behoben — `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:203` — Reuse über ganzzahlige Indizes mit Bounds-Check, `#fullViewArea` entfernt; Scroll-Regressionstest bei Kachelgröße 0.1 über beide Achsen gegen eine frische Instanz (`RectangularVisibilityArea.spec.ts:195`).
- PERF-001: behoben — `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:1439` (Klemmung in `setBox()`), `:800` (`widenFrustumHeight()`) — Frustum-Box je Neuberechnung global auf den lokalen Höhenbereich der acht Frustum-Ecken geklemmt, `tile.box` behält die volle `depth`; Schranke in `CameraBasedVisibility.spec.ts:1225`; TSDoc von `depth`, `frustumBoxScale`, `frustumBox`, `searchCanStop()`, `setBox()` nachgezogen. Der Beweis von `searchCanStop()` hält: gleiche Grundfläche aller Boxen, `frustumHeight` wird vor `updateFrustumBox()` neu geschrieben.
- PERF-002: behoben — `packages/twopoint5d/src/map2d/convexTileHull.ts:104, 125`, `CameraBasedVisibility.ts:769, 1156, 1405` — alle fünf Destrukturierungen per Index, je mit Begründungszeile.
- TEST-004: behoben — `packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts:180` (geneigte Kamera), `:222` (`describe('Map2D on the hot path')`, stehende und bewegte Kamera) — nach den Regeln aus AGENTS.md.
- BUG-006: behoben — `packages/twopoint5d/src/controls/PanControl2D.ts:257, 390, 500, 515` — Option `pointerTarget` (Default `document`), interaktive Ziele über `composedPath()` bis ausschließlich `pointerTarget` gefiltert; Node-Specs und Browser-Test `packages/twopoint5d-testing/test/pan-control-pointer-target.test.js` (Shadow-Root, Button-Kind).
- TEST-002: behoben — `packages/twopoint5d/vite.config.ts:49, 61–62` — Schwellen `src/controls/**` 90/74/89/92 und `src/display/**` 82/73/81/84, `Stylesheets.ts` mit Begründung aus dem Zähler.

Befunde aus Review 0 und ihr Verbleib:
- wichtig `docs/architecture.md:163` — Satz »`controls` and `display` carry no threshold of their own …« stimmte nicht mehr → Runde 1, gestrichen, Ausnahme `Stylesheets.ts` ergänzt.
- klein `CameraBasedVisibility.ts:801–803` — Kommentar in Vergangenheitsform → in Runde 1 mitgegeben, jetzt Präsens.
- klein Commit-Message nannte 0,5 ms, der CHANGELOG 0,3 ms → vom Runner angeglichen.
- klein Commit-Header rund 230 Zeichen → vom Runner gekürzt.
- Nicht nachgemessen hat der Reviewer die Angabe »304 tiles« im Kommentar von `hot-path-allocations.spec.ts:67`; der Spec prüft `> 150`.

## Nebenbefunde (Begründung des Urteils)

- `makeTopDownCamera()` (`CameraBasedVisibility.spec.ts:23`, `hot-path-allocations.spec.ts:47`): steht so auf 7fee62de, schadet heute keinem Test, Schwere low — unter der Scope-Regel (ab medium) → Audit.
- `docs/architecture.md:160–162`, Ausnahme `src/sprites/**` fehlt: der Absatz und die 100-%-Schwelle stehen so auf 7fee62de, reine Doku-Ungenauigkeit, low → Audit.

