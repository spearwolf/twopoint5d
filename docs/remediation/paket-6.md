# Paket 6 — Nebenbefunde: Frustum im Koordinatensystem der Kamera, Rekursion in subdivide()

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — zwei vorbestehende Nebenbefunde (beide low, → Scope) und eine
  Folge von Paket 4 (siehe »Findings im Volltext«)
- Folge von: Paket 4 — gilt nur für die aufgenommene Folge in `findAxis`; die beiden Nebenbefunde
  sind vorbestehend und eröffnen keine Kette
- Ziel: Die Sichtbarkeitsprobe rechnet im Koordinatensystem und der Tiefenrichtung der Kamera, und
  `subdivide()` terminiert für jede Chunk-Menge, auch mit Chunks ohne Ausdehnung.
- Modell: mittlere Stufe (`claude-sonnet-5`)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md` (Abschnitt `## [Unreleased]`, Unterabschnitt `### Fixed`)
- Verify: `pnpm run ci`
- Commit: `fix(map2d): let CameraBasedVisibility take the near and far plane of its probe rays and its frustum from the coordinate system and the depth direction of the camera, and let subdivide() of ChunkQuadTreeNode come to an end for every set of chunks by putting a chunk without extent on the side of the axis it is counted on and by moving the axis search on past an edge that is NaN`
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · Frustum-Nebenbefund `CameraBasedVisibility.ts:80-81`
    unverändert, Probe-Strahlen `:406-407` → `:471-472` verschoben · Rekursions-Nebenbefund
    `ChunkQuadTreeNode.ts:207-221`/`:255-273` unverändert, vorbestehend seit `9a97f1bc` bestätigt ·
    neue Folge von Paket 4 (`findAxis` `:74-80`, `NaN`-Endlosschleife) in dieses Paket genommen ·
    Folgen der Pakete 1–5: keine offen · »Offene Befunde« leer (beide Einträge stehen in diesem
    Paket) · keine Browsertest-Datei (Grund in A3) · Restplan: nach Paket 6 kein offenes Paket, nichts umzusortieren
  - 2026-09-25 Zug 1: Implementierer beauftragt, Sonnet (mittlere Stufe, `claude-sonnet-5`), Effort medium · Brief `paket-6.impl-1.brief.md`, Report `paket-6.impl-1.json`
  - 2026-09-25 Zug 2: Report FERTIG (Session 0c0efd07-753f-4d92-99af-3ea9464d7071) · rote Läufe belegt für A1 (5 rot, 3 grün, wie erwartet), B1 Test 1 und 2 (Test 2 gegen den Zwischenstand), B2 (Seeds `[47514, 2, 3]`, Seed 2 wirft vor dem Fix, für negative Breite kein Seed in 1–200), B3 (Zählerwurf in 4 ms) · Dateien: `CameraBasedVisibility.ts` samt Spec, `ChunkQuadTreeNode.ts`, `ChunkQuadTreeNode.extended.spec.ts`, CHANGELOG · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-6.verify.log`)
  - 2026-09-25 Zug 3: Reviewer beauftragt, Sonnet, Effort medium · Diff `paket-6.diff`, Brief `paket-6.review-1.brief.md`, Report `paket-6.review-1.json`
  - 2026-09-25 Zug 3: Urteil freigeben · alle drei Befunde behoben · keine kritischen, keine wichtigen Befunde, vier kleine · Diff `paket-6.diff`
  - 2026-09-25 Zug 4: entfällt, keine Runde ausgelöst
  - 2026-09-25 Zug 5: Commit e830eec5 (5 Dateien) · Verify `paket-6.verify.log` exit=0, keine Codeänderung seither

## Vorgehen

Vor der ersten Änderung `AGENTS.md` im Repo-Root lesen und beide Quelldateien ganz
(`cat`), nicht Symbol für Symbol. Beide Teile sind Korrektheitsfehler: je zuerst den
Regressionstest, rot sehen, dann beheben. Die roten Läufe gehören in den Report.

**Keine Busy-Loops, auch nicht kurz.** Ein Test, der eine Endlosschleife im roten Zustand nur mit
einem Timeout beenden könnte, ist verboten — Vitest kann synchronen Code nicht unterbrechen, und auf
der Maschine laufen andere Sessions. Deshalb der Lesezähler in Schritt B3.

### Teil A — CameraBasedVisibility im Koordinatensystem der Kamera

Hintergrund (three 0.185, gegen `node_modules/.pnpm/three@0.185.1/node_modules/three/src` geprüft):
Der `Renderer` von `three/webgpu` setzt beim ersten `render()` `camera.coordinateSystem` auf das
seines Backends und bei `reversedDepthBuffer: true` `camera._reversedDepth = true`, und baut danach
die Projektion neu (`src/renderers/common/Renderer.js:3450-3490`). Die Projektion bildet Near und
Far dann so auf NDC-z ab (`Matrix4.makePerspective`/`makeOrthographic`, Zeilen 1147-1245):

| Kamera | NDC-z der Near-Plane | NDC-z der Far-Plane |
| --- | --- | --- |
| `WebGLCoordinateSystem`, `reversedDepth === false` | `-1` | `1` |
| `WebGPUCoordinateSystem`, `reversedDepth === false` | `0` | `1` |
| `reversedDepth === true` (beide Systeme gleich) | `1` | `0` |

`CameraBasedVisibility` nimmt heute immer die erste Zeile an: die Probe-Strahlen laufen von NDC-z
`-1` nach `1`, und `Frustum#setFromProjectionMatrix()` wird ohne Koordinatensystem und
Tiefenrichtung gerufen (Default WebGL, nicht reversed). Im WebGPU-System liegt der Start der
Strahlen und die Near-Plane des Frustums damit bei ≈ `near·far/(2·far−near)` statt bei `near`; mit
`reversedDepth` läuft ein perspektivischer Strahl von einem Punkt hinter der Kamera bis zur
Near-Plane, trifft eine Ebene jenseits davon nie, und das Frustum hat keine Far-Plane mehr.

A1. **Regressionstests zuerst**, in `CameraBasedVisibility.spec.ts`, neuer
`describe('the coordinate system and the depth direction of the camera', …)` innerhalb von
`describe('CameraBasedVisibility', …)`:

- Hilfsfunktion auf Dateiebene, neben den anderen `make…Camera()`-Fixtures:

  ```ts
  /**
   * Puts the camera into a coordinate system and a depth direction the way the renderer does on its
   * first frame: both fields set, the projection built again from them. three exposes
   * `reversedDepth` as a getter only; the renderer writes `_reversedDepth`, and so does this helper.
   */
  function inCoordinateSystem<C extends PerspectiveCamera | OrthographicCamera>(
    camera: C,
    coordinateSystem: CoordinateSystem,
    reversedDepth: boolean,
  ): C
  ```

  `CoordinateSystem` als Typ, `WebGLCoordinateSystem` und `WebGPUCoordinateSystem` als Werte aus
  `three/webgpu` importieren. Setzt `camera.coordinateSystem`, schreibt `_reversedDepth` über
  `(camera as unknown as {_reversedDepth: boolean})` und ruft `camera.updateProjectionMatrix()`.
- Die vier Kombinationen als Tabelle für `test.each`:
  `[['WebGL', WebGLCoordinateSystem, false], ['WebGPU', WebGPUCoordinateSystem, false],
  ['WebGL with reversed depth', WebGLCoordinateSystem, true], ['WebGPU with reversed depth',
  WebGPUCoordinateSystem, true]]`.
- Neue Fixture `makeCameraWithTheFarPlaneOnTheGround()`: `new PerspectiveCamera(60, 1, 0.1, 200)`,
  `position.set(0, 100, 100)`, `lookAt(0, 0, 0)`, `updateMatrixWorld()`,
  `updateProjectionMatrix()`. Kommentar dazu: looks down at 45°; the upper edge of the view stays
  below the horizon, so the ground it covers is bounded even without a far plane, and the far plane
  at 200 cuts it short of where the upper edge meets the ground (≈ 386).
- Neue Fixture `makeCameraCloserToThePlaneThanItsNearPlane()`: `new PerspectiveCamera(90, 1, 10,
  500)`, `position.set(0, 7, 0)`, `lookAt(0, 0, 0)`, `updateMatrixWorld()`,
  `updateProjectionMatrix()`.
- Test `test.each(…)('finds the tiles the camera sees in the WebGL coordinate system: %s', …)`:
  für jede Kombination und für jede der beiden Kameras `makeCameraWithTheFarPlaneOnTheGround()` und
  eine orthografische Draufsicht (`new OrthographicCamera(-100, 100, 100, -100, 0.1, 500)`,
  `position.set(0, 100, 0)`, `lookAt(0, 0, 0)`, `updateMatrixWorld()`, `updateProjectionMatrix()`
  — `makeOrthoCameraLookingHorizontally()` taugt nicht, sie sieht die Ebene nicht):
  Referenz ist eine eigene `CameraBasedVisibility` mit derselben Kamera im Default-Zustand (WebGL,
  nicht reversed); Prüfling eine zweite mit einer frisch gebauten Kamera nach
  `inCoordinateSystem(…)`. Beide `computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)`,
  `tileCoords = new Map2DTileCoordsUtil(100, 100)`, `matrixWorld = new Matrix4()`. Erwartung:
  `ids(result?.tiles)` gleich, und die Referenz nicht leer (`toBeGreaterThan(0)`), sonst hielte der
  Vergleich für zwei leere Ergebnisse.
- Test `test.each(…)('sees nothing of a plane that lies before its near plane: %s', …)`:
  `makeCameraCloserToThePlaneThanItsNearPlane()` nach `inCoordinateSystem(…)`, frische
  `CameraBasedVisibility`, `computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)` ist
  `undefined`, `visibility.pointsOnPlane` ist leer.
- Rot vor dem Fix erwartet: der erste Test für beide Kombinationen mit reversed depth an der
  perspektivischen Kamera (Ergebnis `undefined` gegen eine nicht leere Referenz); der zweite für
  `WebGPU`, `WebGL with reversed depth` und `WebGPU with reversed depth`. Die WebGL-Zeilen sind vor
  und nach dem Fix grün. Liefert ein anderer Fall ein anderes Bild, anhalten und im Report
  erklären, nicht die Erwartung anpassen.
- Die Hilfsfunktion `makeFrustum()` (heute Zeile 64-67) spiegelt laut ihrem TSDoc das Frustum der
  Visibility: sie bekommt dieselben beiden Argumente wie die Klasse (siehe A2).

A2. **Fix** in `CameraBasedVisibility.ts` — beide Stellen in **einem** Schritt ändern, bevor ein
Test läuft (mit nur den Strahlen repariert und dem Frustum ohne Far-Plane kann eine Kamera, die
über den Horizont sieht, die Suche ohne Ende laufen lassen):

- `WebGPUCoordinateSystem` als Wert aus `three/webgpu` importieren (Import in Zeile 2 ergänzen).
- `makeCameraFrustum` (Zeile 80-81): `target.setFromProjectionMatrix(_m.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse), camera.coordinateSystem, camera.reversedDepth)`.
- `findPointsOnPlaneThatAreInViewFrustum()` (Zeile 471-472): vor der Schleife einmal je Aufruf,
  ohne Allokation:

  ```ts
  // the depth the projection of the camera maps its near and far plane to — see the table in the
  // docs of this class
  const nearZ = camera.reversedDepth ? 1 : camera.coordinateSystem === WebGPUCoordinateSystem ? 0 : -1;
  const farZ = camera.reversedDepth ? 0 : 1;
  ```

  und `start.set(ndcX, ndcY, nearZ)`, `end.set(ndcX, ndcY, farZ)`. Der TSDoc der Methode (»A ray
  runs from the near plane to the far plane …«) bleibt wahr und bleibt stehen.
- Klassen-TSDoc, Absatz »The _far_ value of the camera limits …« (Zeile 106-107) ergänzen: near
  and far are read in the coordinate system and the depth direction of the camera —
  `camera.coordinateSystem` and `camera.reversedDepth`, which the renderer sets on a camera the
  first time it renders with it, together with a new projection. Dazu die drei Zeilen der Tabelle
  oben als kurze Liste (WebGL `-1`…`1`, WebGPU `0`…`1`, reversed depth `1`…`0` in either).
- Keine neuen Einträge in `#deps`: jeder Wechsel eines der beiden Felder geht mit einer anderen
  Projektionsmatrix einher (der Renderer baut sie neu, und wer die Felder selbst setzt, ruft laut
  Klassen-TSDoc `updateProjectionMatrix()`), und `cameraProjectionMatrix` steht schon darin.
- Nicht anfassen: `CameraBasedVisibility.spec.ts:512` (`new Vector3(0, 0, -1).unproject(camera)`)
  arbeitet an einer WebGL-Kamera und ist dort richtig.

A3. **Keine neue Browsertest-Datei.** Die Änderung berührt weder Rendering- noch GPU-Buffer-Code,
sondern liest zwei Felder der Kamera. Was der Renderer beiträgt — die beiden Felder setzen und die
Projektion neu bauen —, stellt `inCoordinateSystem()` im Spec nach; die drei vorhandenen
map2d-Browsertests (`map2d-placement`, `map2d-tile-upload`, `map2d-visibility-helpers`) fahren
`CameraBasedVisibility` bereits hinter dem echten Renderer und laufen in `pnpm run ci` mit
(`test:browser`) — in Chromium mit dem WebGPU-Backend also genau durch den reparierten Pfad.

### Teil B — ChunkQuadTreeNode#subdivide() terminiert

Ursache der Rekursion: `findAxis` legt eine Achse immer auf die `right`- (bzw. `bottom`-)Kante
eines Chunks und zählt jeden Chunk mit `right <= origin` als *before*, also nach Westen (Norden).
Die Verteilung in `subdivide()` (Zeile 207-221) und `appendChunk()` (Zeile 255-273) prüft aber
zuerst `left >= originX` (Osten) und `top >= originY` (Süden). Für einen Chunk mit Ausdehnung
schließen sich beide Bedingungen aus; für einen Chunk der Breite 0 (oder negativer Breite) auf der
Achse gelten beide, und er landet im Osten, während die Bewertung ihn im Westen zählt. Wählt
`findAxis` genau seine Kante, können alle Chunks im selben Quadranten landen — das Kind bekommt
dieselbe Menge und rekursiert ohne Ende.

Warum die Reihenfolge der Prüfung der richtige Hebel ist und nicht `findAxis`: der Chunk, dessen
Kante die Achse bildet, gehört per Konstruktion auf deren Westseite; die Verteilung ist die Stelle,
die davon abweicht. Mit gleicher Einordnung in Bewertung und Verteilung ist jedes Kind eine echte
Teilmenge (von *before*, *intersect*, *after* sind mindestens zwei nicht leer, sonst gibt
`scoreAxis` `null`), die Tiefe also durch die Chunk-Zahl begrenzt. Für Chunks mit Ausdehnung
ändert sich nichts. `findChunks()` findet einen Chunk der Breite 0 auf der Achse weiter: eine
Abfrage, die ihn schneidet, hat `aabb.left < originX` und steigt damit in die Westquadranten.

Die Folge aus Paket 4: die Schleife in `findAxis` (Zeile 74-80) rückt `before` nur über
`chunks[before][beforeKey] <= origin` vor. Ist die Kante des Chunks an Position `i` `NaN`, gilt der
Vergleich nicht einmal für ihn selbst, `before` bleibt stehen, `i = before` auch — eine
Endlosschleife ohne Stack-Überlauf. Der Code vor Paket 4 (`git show 9a97f1bc:…/ChunkQuadTreeNode.ts`)
lief mit `i++` und endete.

B1. **Regressionstest Rekursion**, in `ChunkQuadTreeNode.extended.spec.ts`, neuer
`describe('chunks without extent', …)` unter `describe('ChunkQuadTreeNode (extended)', …)`. Die
Hilfsfunktion `subtreeOf` (heute lokal in `describe('axis choice')`) auf Dateiebene heben und von
beiden Stellen nutzen.

- `it('splits a node whose axes run along a chunk of width and height 0', …)`: Chunks
  `Z = {x: 0, y: 0, width: 0, height: 0}`, `B = {x: 10, y: 10, width: 5, height: 5}`,
  `C = {x: 20, y: 20, width: 5, height: 5}` als `StringDataChunk2D` (`data` = Name), Wurzel
  `new ChunkQuadTreeNode([Z, B, C])`, `subdivide(1)`. Erwartung: `originX` und `originY` sind `0`,
  `sortedNames(root.nodes.northWest!.chunks)` ist `['Z']`, `sortedNames(subtreeOf(root.nodes.southEast!))`
  ist `['B', 'C']`, `root.chunks` ist leer. Rot vor dem Fix: `RangeError: Maximum call stack size
  exceeded`.
- `it('appendChunk() puts a chunk without extent on an axis where subdivide() puts it', …)`: dieselbe
  Wurzel nach `subdivide(1)`, dann `appendChunk()` mit
  `{x: 0, y: -5, width: 0, height: 3, data: 'W'}` (rechte Kante auf `originX`, unten `-2`). Erwartung:
  `W` liegt in `subtreeOf(root.nodes.northWest!)`, `root.nodes.northEast` bleibt `null`. Rot vor dem
  Fix: der Chunk landet in `northEast` — den Test deshalb erst laufen lassen, wenn der erste grün
  ist, sonst kommt er nie bis zum `appendChunk()`; seinen roten Lauf gegen einen Stand zeigen, in
  dem nur `subdivide()` repariert ist (Reihenfolge: B1-Test 1 rot → Fix in `subdivide()` → Test 2
  rot → Fix in `appendChunk()` → beide grün).

B2. **Seed-Umgehung zurücknehmen**, `ChunkQuadTreeNode.extended.spec.ts:304-311`:

- `makeRandom` nimmt den Seed als Parameter: `const makeRandom = (seed: number) => { … }`.
- Der Kommentar über `makeRandom` (»a seed that keeps the layout … clear of the runaway recursion …«)
  entfällt; stattdessen ein Satz ohne Rückblick, etwa: fixed seeds, so that every run builds the
  same layouts.
- Der `test.each` in `describe('axis choice')` läuft je Layout über eine Liste von Seeds, etwa
  `for (const seed of SEEDS) for (const count of [40, 97, 200])`. Die Liste enthält `47514` und
  mindestens einen Seed, mit dem `a raster with chunks of width or height 0` **vor** dem Fix mit
  `RangeError: Maximum call stack size exceeded` scheitert, und, falls es einen gibt, einen für
  `a raster with chunks of negative width`. Solche Seeds gegen den unveränderten Code suchen
  (Seeds 1 bis 200 durchprobieren, in einem Wegwerf-Skript oder einem temporären Test, der nicht im
  Diff bleibt) und den roten Lauf mit dem gefundenen Seed in den Report schreiben.
- Die Assertion bleibt, wie sie ist; sie misst jede innere Achse am Teilbaum, den der Knoten
  tatsächlich hält, und gilt damit auch nach der geänderten Verteilung.

B3. **Regressionstest NaN**, im selben `describe('chunks without extent')` oder einem eigenen
`describe('an edge that is NaN')`:

- `it('subdivide() comes to an end for a chunk whose right edge is NaN', …)`. Der Chunk ist ein
  Objekt, das `IDataChunk2D` erfüllt (`import type {IDataChunk2D} from './IDataChunk2D.js'`), mit
  Gettern `left` → `0`, `top` → `0`, `right` → `NaN`, `bottom` → `5`, `containsDataAt: () => false`,
  `isIntersecting: () => false`. Jeder Getter zählt einen gemeinsamen Zähler hoch und wirft ab dem
  10 001. Lesen `new Error('subdivide() does not come to an end')`. Kommentar dazu: `subdivide()`
  runs synchronously, so a sweep that stands still would hang the test run instead of failing it;
  the chunk counts the reads of its edges and throws once they pass any number a finished run
  needs.
- Dazu `B` und `C` wie in B1, Wurzel `new ChunkQuadTreeNode<IDataChunk2D>([nan, B, C])`,
  `expect(() => root.subdivide(1)).not.toThrow()`, danach sind alle drei Chunks im Baum (über
  `subtreeOf` oder einen eigenen Walk — `subtreeOf` ist auf `StringDataChunk2D` typisiert; ggf.
  generisch machen). Die Form des Baums nicht prüfen — ein `NaN` ist Unsinn in der Eingabe, verlangt
  ist nur, dass `subdivide()` endet und nichts verliert.
- Rot vor dem Fix: der Zähler wirft (`subdivide() does not come to an end`), in Millisekunden.

B4. **Fix** in `ChunkQuadTreeNode.ts`:

- Verteilung in `subdivide()` (Zeile 207-221): zuerst `chunk.right <= originX` (Westen), dann
  `chunk.left >= originX` (Osten), sonst Straddler; innerhalb jeder Seite zuerst
  `chunk.bottom <= originY` (Norden), dann `chunk.top >= originY` (Süden), sonst Straddler. Ein
  Kommentar über der Schleife, der das Warum sagt, etwa: an axis lies on the right (bottom) edge of
  a chunk, and `findAxis` counts every chunk whose right (bottom) edge is on or before it as
  *before*; west and north are tested first so that a chunk of width or height 0 on the axis lands
  on the side it was counted on — a split that disagrees with the count can hand every chunk to one
  quadrant and split it again without end.
- `appendChunk()` (Zeile 255-273) in derselben Reihenfolge, damit ein angehängter Chunk dort landet,
  wo `subdivide()` ihn hinlegt; ein kurzer Kommentar verweist auf die Verteilung in `subdivide()`.
- TSDoc von `subdivide()` um einen Satz ergänzen: a chunk that touches an axis without crossing it
  — one of width or height 0 whose edges lie on it — belongs to the west or north side. TSDoc von
  `appendChunk()` entsprechend: it places a chunk on the side `subdivide()` places it.
- `findAxis`, Schleife Zeile 74-80: der Chunk an Position `i` wird immer verbraucht, dann erst per
  Vergleich weiter — als `do { … } while (before < n && chunks[before]![beforeKey] <= origin);`
  oder gleichwertig. Kommentar: the chunk at `i` lies on `origin` by construction and is taken
  whatever the comparison says — an edge that is `NaN` fails every comparison and would hold the
  sweep in place. Für endliche Kanten ändert sich kein Ergebnis (der Chunk an `i` erfüllt
  `<= origin` ohnehin); der Charakterisierungstest `axis choice` belegt das.
- `findChunksAt()`, `findChunks()`, `isNorthWest()` … bleiben unverändert.

### Teil C — CHANGELOG

Unter `## [Unreleased]` → `### Fixed` (Zeile 231 ff.) zwei Einträge im Stil der Nachbarn
(Kleinbuchstabe, beginnt mit `fix …`, ein Absatz). Sie sagen, was der Code tut und wen es betrifft,
nicht, was er vorher tat — das steht in der Commit-Message. Keine `ts check`-Codeblöcke nötig.

- `CameraBasedVisibility`: the probe rays and the frustum test take the near and far plane from
  `camera.coordinateSystem` and `camera.reversedDepth` — matters for a camera a WebGPU renderer has
  rendered with, and for a renderer with `reversedDepthBuffer`; a perspective camera with reversed
  depth finds the map plane.
- `ChunkQuadTreeNode`: a chunk of width or height 0 whose edge lies on an axis goes to the west or
  north side of it in `subdivide()` and `appendChunk()`, and `subdivide()` comes to an end for such
  chunks.
- Die `NaN`-Endlosschleife bekommt **keinen** Eintrag: sie entstand in diesem noch unveröffentlichten
  Abschnitt, die letzte Version endete auch mit `NaN`-Kanten.
- Kein Migrationshinweis: keine Signatur ändert sich, kein Aufrufer muss Code anfassen.

## Urteil des Reviewers (Zug 3, 2026-09-25)

- Frustum und Probe-Strahlen: **behoben** — `CameraBasedVisibility.ts:81-85` (`setFromProjectionMatrix` mit `camera.coordinateSystem`, `camera.reversedDepth`), `:478-479` und `:487-488` (`nearZ`/`farZ`); gegen `Matrix4.makePerspective`/`makeOrthographic` in three 0.185.1 nachgerechnet.
- Rekursion in `subdivide()`: **behoben** — Verteilung `ChunkQuadTreeNode.ts:214-228` (West vor Ost, Nord vor Süd), `appendChunk()` `:265-283` in derselben Reihenfolge; Seed-Umgehung zurückgenommen, `ChunkQuadTreeNode.extended.spec.ts:311` (`SEEDS = [47514, 2, 3]`) und `:361`.
- `NaN`-Endlosschleife in `findAxis`: **behoben** — `ChunkQuadTreeNode.ts:76-82` (`do … while`), Test mit Lesezähler `ChunkQuadTreeNode.extended.spec.ts:419` ff.

Kleine Befunde (keine Runde ausgelöst):
- `packages/twopoint5d/CHANGELOG.md:364-365` — beide Einträge enden mit Punkt, der erste hat zwei Sätze; die Nachbarn (`:362-363`) stehen ohne Schlusspunkt in einem Satz.
- `ChunkQuadTreeNode.extended.spec.ts:388-417` — die Tests belegen die geänderte Prüfreihenfolge nur in X; die Y-Reihenfolge in West- und Ostzweig von `appendChunk()` ist einzeln nicht abgedeckt (etwa `{x: -5, y: 0, width: 3, height: 0}`), die Seed-Läufe decken nur `subdivide()`.
- `ChunkQuadTreeNode.ts:178-179` — die TSDoc nennt nur Chunks der Breite oder Höhe 0 auf der Achse; ein Chunk mit negativer Breite und `right <= originX` geht ebenfalls nach Westen, ungesagt.
- `CameraBasedVisibility.spec.ts:157-170` — »finds the tiles the camera sees …« unterscheidet die Zeile `WebGPU` (nicht reversed) nicht von der Logik vor dem Fix; diese Kombination belegt nur »sees nothing of a plane …«, wie in A1 erwartet.

## Abgleich (Zug 0, 2026-09-25)

- Frustum ohne Koordinatensystem: **unverändert** an `CameraBasedVisibility.ts:80-81`
  (`makeCameraFrustum`, `setFromProjectionMatrix` mit einem Argument). Die Probe-Strahlen sind von
  `:406-407` nach `:471-472` **verschoben** (Paket 2 hat die Klasse umgebaut), der Sachverhalt ist
  derselbe: `start.set(ndcX, ndcY, -1)`, `end.set(ndcX, ndcY, 1)`. Rechnung gegen
  `Matrix4.makePerspective` nachgeprüft: WebGPU-Near der Probe bei `n·f/(2f−n)`, reversed depth
  Start hinter der Kamera bei `n·f/(f−2n)`.
- Rekursion in `subdivide()`: **unverändert**. Verteilung jetzt `ChunkQuadTreeNode.ts:207-221`
  (Plan nannte `:200-231`, gleicher Block samt `makeChild`), `appendChunk()` `:255-273` mit
  derselben Reihenfolge. Die Verteilung ist identisch mit `9a97f1bc` — vorbestehend bestätigt. Der
  Repro `[{0,0,0,0}, {10,10,5,5}, {20,20,5,5}]`, `subdivide(1)` von Hand nachgerechnet: `findAxis`
  wählt `originX = originY = 0` (Gleichstand 0,333 mit Achse 15, der erste gewinnt), alle drei
  Chunks gehen nach Südost. Seed-Umgehung an `ChunkQuadTreeNode.extended.spec.ts:304-307`
  unverändert (Kommentar 304-305, `seed = 47514` in 307).
- Neu gefunden beim Lesen von `findAxis` (`:74-80`): Endlosschleife bei einer `NaN`-Kante, entstanden
  mit `584a675d` (Paket 4); der Code davor (`9a97f1bc`) zählte `i++` und endete. Als **echte Folge**
  von Paket 4 eingeordnet (eigene Ursache, durch dessen Umbau neu) und in dieses Paket genommen
  statt in ein eigenes: dieselbe Funktion, dasselbe Ziel (»`subdivide()` terminiert für jede
  Chunk-Menge«), dieselbe Spec-Datei, derselbe Verify — ein eigenes Paket kostete einen ganzen
  Runner für eine Schleifenbedingung. Die Kette bleibt über `Folge von: Paket 4` sichtbar.
- Nicht reproduziert per Lauf, sondern gerechnet: ein roter Lauf für die `NaN`-Schleife wäre eine
  Busy-Loop; B3 macht ihn mit einem Lesezähler endlich.

## Anmerkungen

- Die Rekursion lässt sich nicht allein über `findAxis` beheben, ohne dessen Präfixsummen-Sweep aus
  Paket 4 umzubauen; die Umstellung der Prüfreihenfolge in der Verteilung ist kleiner, ändert für
  Chunks mit Ausdehnung nichts und hält den Charakterisierungstest `axis choice` unverändert.
- Ein Nachtest der Terminierung mit `NaN`: ist `origin` `NaN`, fallen alle Chunks in der Verteilung
  durch beide Vergleiche und bleiben als Straddler am Knoten, Kinder entstehen keine; ist `origin`
  endlich, liegt der Chunk, der ihn liefert, im Westen, ein Chunk mit `NaN`-`right` nie — also
  landen nie alle Chunks im selben Quadranten.

## Findings im Volltext

**Nebenbefund · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:80-81` und `:471-472`**
(im Plan `:406-407`, vorbestehend, aus Zug 0 von Paket 2) — `makeCameraFrustum()` zieht den Frustum
ohne `camera.coordinateSystem` und `camera.reversedDepth` aus der Projektion, und die Probe-Strahlen
starten bei NDC-z `-1`: mit dem WebGPU-Koordinatensystem liegt die Near-Plane des Tests bei
≈ near/2, mit `reversedDepth` kippen Near- und Far-Plane.
Empfehlung (aus dem Plan-Ziel): Die Sichtbarkeitsprobe rechnet im Koordinatensystem und der
Tiefenrichtung der Kamera.

**Nebenbefund · low · `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:207-221`
und `:255-273`** (im Plan `:200-231`, vorbestehend, aus Paket 4) — ein Chunk ohne Ausdehnung zählt
in `findAxis` als *before*, die Verteilung schickt ihn nach Südost; landen alle Chunks eines Knotens
im selben Quadranten, rekursiert `makeChild()` ohne Ende (`RangeError: Maximum call stack size
exceeded`), reproduziert mit `[{0,0,0,0}, {10,10,5,5}, {20,20,5,5}]` und `subdivide(1)`;
`ChunkQuadTreeNode.extended.spec.ts:304-307` umgeht es per Seed 47514.
Empfehlung (aus dem Plan-Ziel): `subdivide()` terminiert für jede Chunk-Menge, auch mit Chunks ohne
Ausdehnung; die Seed-Umgehung wird zurückgenommen.

**Folge von Paket 4 · low · `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:74-80`**
(gefunden in Zug 0 von Paket 6, entstanden mit `584a675d`) — der Sweep in `findAxis` rückt `before`
nur über `chunks[before][beforeKey] <= origin` vor; ist die Kante des Chunks an Position `i` `NaN`,
bleibt `before` und damit `i` stehen, und `subdivide()` hängt in einer Endlosschleife. Vor
`584a675d` lief die Schleife mit `i++` und endete.
Empfehlung: den Chunk an Position `i` unbedingt verbrauchen (siehe B4), Regressionstest mit
Lesezähler (B3).
