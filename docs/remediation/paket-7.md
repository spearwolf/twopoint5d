# Paket 7 — Folgen aus den Reviews: TSDoc, Spec-Abdeckung und Formatpflege

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — sieben Folgen, kleine Reviewer-Befunde auf den eigenen Diffs der
  Pakete 1, 4, 5 und 6 (siehe »Folgen im Volltext«)
- Folge von: Pakete 1, 4, 5, 6 — Generationsprüfung unter »Abgleich«: höchstens zweite Generation
- Ziel: Was die Reviews dieses Laufs als klein notiert haben, ist erledigt, sodass map2d und seine
  Doku ohne offene Folge aus dem Lauf gehen.
- Modell: mittlere Stufe (`claude-sonnet-5`)
- Effort: low — Texte, Testcode und Werte stehen unten wörtlich; nachgerechnet in Zug 0
- Dateien:
  - `packages/twopoint5d/src/map2d/types.ts`
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` (nur TSDoc)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesGeometry.spec.ts` (nur Kommentar)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`, `### Fixed`)
  - `apps/lookbook/README.md`, `docs/architecture.md`, `AGENTS.md` (nur Zeilenumbrüche)
- Nicht anfassen: `CameraBasedVisibility.ts`, `RepeatingTilesProvider.ts` und jede andere
  Quelldatei außer den oben genannten — kein Verhalten ändert sich. Keine Browsertest-Datei: keine
  Zeile Rendering- oder GPU-Buffer-Code ändert sich, die Konvention der zwei Testflächen greift
  nicht.
- Verify: `pnpm run ci`
- Commit: `docs(map2d,lookbook): state on IMap2DTileDataProvider what getTileIdsWithin() writes and when it throws, say by which edges subdivide() places a chunk, cover in the specs the north-first order of appendChunk() and a camera whose near plane cuts the ground, keep the map2d entries of the changelog in one list without closing periods and say what a renderer added again does, and wrap the long lines of the lookbook readme, the architecture doc and AGENTS.md`
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · types.ts:19 unverändert · ChunkQuadTreeNode.ts TSDoc
    `subdivide()` :175-183 unverändert · extended.spec `describe('chunks without extent')`
    :388-417 unverändert · CameraBasedVisibility.spec »finds the tiles …« von :157-170 nach
    :745-758 verschoben, Befund per Nachrechnung bestätigt (alte Logik = Referenz, 12 = 12 Tiles) ·
    TileSpritesGeometry.spec :8-9 unverändert · CHANGELOG :359 Leerzeile, :360 ohne Halbsatz,
    :364-365 mit Schlusspunkt, alle offen · lange Zeilen README :42, architecture :284, AGENTS :43
    unverändert, dazu README :19 und :48 aus demselben Commit a45cac19 aufgenommen (dieselbe
    Ursache) · Folgen der Pakete 1–6: sonst keine offen (Paket 2 alle klein in Runde 2 behoben,
    Paket 3 keine, Seed-Kommentar aus Paket 4 von Paket 6 entfernt) · »Offene Befunde« leer ·
    Restplan: Paket 7 ist das letzte, danach der Abschluss, nichts umzusortieren
  - 2026-09-25 Zug 1: Implementierer beauftragt, claude-sonnet-5, effort low, Report `paket-7.impl-1.json`
  - 2026-09-25 Zug 2: FERTIG_MIT_VORBEHALT (Dateien nur abschnittsweise gelesen; Restzeilen `whether` in AGENTS.md und `lookbook and` in README) · 9 Dateien geändert, Arbeitsbaum schmutzig · Gegenprobe wie erwartet rot · Verify `pnpm run ci` exit=0, `paket-7.verify.log`
  - 2026-09-25 Zug 3: Reviewer (claude-sonnet-5, low) gibt frei, alle Folgen behoben, ein kleiner Befund · Diff `paket-7.diff`, Report `paket-7.review-1.json`
  - 2026-09-25 Zug 4: keine Runde nötig
  - 2026-09-25 Zug 5: Commit 480b8fc3, Verify `paket-7.verify.log` exit=0

## Vorab: was du wissen musst

- `AGENTS.md` im Repo-Root zuerst lesen. Relative Imports tragen `.js`, Typen `import type`.
- Code, Kommentare und Doku auf Englisch. Keine Finding-IDs, nirgends. Kein Satz über einen
  Vorzustand in Code, Kommentaren oder Doku (»used to«, »no longer«, »now«) — Ausnahme sind
  die bestehenden `fix`-Einträge im CHANGELOG, die du bis auf die unten genannten Änderungen
  unberührt lässt.
- Vor der Arbeit am CHANGELOG den Skill `updating-changelog` laden. Nur `## [Unreleased]` wird
  angefasst; jeder Eintrag steht dort auf **einer** Zeile — CHANGELOG-Einträge nicht umbrechen.
- Reihenfolge ist Pflicht: zuerst die beiden Specs (Schritte 1 und 2) samt ihrer Gegenprobe,
  **dann** erst die TSDoc in `ChunkQuadTreeNode.ts` (Schritt 3). Die Gegenprobe tauscht
  `ChunkQuadTreeNode.ts` vorübergehend gegen den Stand vor `e830eec5` und stellt ihn per
  `git checkout` wieder her; das geht nur verlustfrei, solange die Datei unverändert ist.
- `$ARBEITSDIR` ist `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/387fd4e2-8d90-4d45-ac3c-b786b7534925/scratchpad`.

## Vorgehen

### 1. `appendChunk()` — die Nord-vor-Süd-Reihenfolge belegen

Datei `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts`.

Warum ein anderer Baum als im Fixture daneben: `withoutExtentOnTheAxes()` ist genau die
Chunk-Menge, an der `subdivide()` vor `e830eec5` ohne Ende rekursierte. Ein Test darauf fällt
gegen den alten Code schon in `subdivide(1)` und belegt nichts über `appendChunk()`. `grid4x4()`
besteht nur aus Chunks mit Ausdehnung; `subdivide()` teilt ihn vor und nach `e830eec5` gleich, bei
`(0, 0)`, mit allen vier Kindern (nachgerechnet gegen den Build von HEAD).

a) Import in Zeile 5 erweitern:

```ts
import {ChunkQuadTreeNode, Quadrant} from './ChunkQuadTreeNode.js';
```

b) Im `describe('chunks without extent', …)` direkt hinter dem Test
`'appendChunk() puts a chunk without extent on an axis where subdivide() puts it'` (endet mit
`});` in Zeile 416) einfügen:

```ts
    it.each([
      ['west', {x: -5, y: 0, width: 3, height: 0}, Quadrant.NorthWest, Quadrant.SouthWest],
      ['east', {x: 5, y: 0, width: 3, height: 0}, Quadrant.NorthEast, Quadrant.SouthEast],
    ] as const)(
      'appendChunk() puts a chunk of height 0 on the horizontal axis north of it: %s of the vertical axis',
      (_side, rect, north, south) => {
        // a tree built from chunks with an extent only, so that the test rests on appendChunk()
        // alone and not on where subdivide() puts a chunk without extent
        const root = new ChunkQuadTreeNode<StringDataChunk2D>(Object.values(grid4x4()));
        root.subdivide();
        expect([root.originX, root.originY]).toEqual([0, 0]);

        root.appendChunk(new StringDataChunk2D({...rect, data: 'Y'}));

        expect(sortedNames(subtreeOf(root.nodes[north]!))).toContain('Y');
        expect(sortedNames(subtreeOf(root.nodes[south]!))).not.toContain('Y');
      },
    );
```

Erwartet mit HEAD: beide Zeilen grün. Nachgerechnet: `west` landet in `northWest`, `east` in
`northEast`; mit der Reihenfolge vor `e830eec5` (Ost vor West, Süd vor Nord) landen sie in
`southWest` bzw. `southEast`.

Den bestehenden X-Test `'appendChunk() puts a chunk without extent on an axis where subdivide()
puts it'` lässt du, wie er ist — er belegt, dass `appendChunk()` und `subdivide()` denselben Chunk
auf dieselbe Seite legen, und das ist eine andere Aussage.

### 2. `CameraBasedVisibility` — eine Kamera, deren Near-Plane den Boden schneidet

Datei `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts`.

Der Befund: im `describe('the coordinate system and the depth direction of the camera')` prüft
`'finds the tiles the camera sees in the WebGL coordinate system: %s'` (`:745-758`) mit Kameras,
deren Near-Plane weit vor dem Boden liegt. Die alte Logik legte die Near-Plane einer
WebGPU-Kamera auf ≈ `n·f/(2f−n)`, knapp die Hälfte von `near`; solange der Boden erst jenseits
beider Werte beginnt, sieht sie dieselben Tiles. In Zug 0 nachgerechnet (Build von HEAD, alte
Logik nachgestellt über eine WebGPU-Projektion, deren `coordinateSystem` danach auf WebGL
zurückgesetzt wird): mit `makeCameraWithTheFarPlaneOnTheGround()` 12 = 12 Tiles.

a) Direkt hinter `makeCameraWithTheFarPlaneOnTheGround()` (endet in Zeile 83) einfügen:

```ts
function makeCameraWithTheNearPlaneOnTheGround(): PerspectiveCamera {
  // Looks down at 45° like the camera above, from further away and with its near plane at 480:
  // the lower edge of the view meets the ground at a depth of ≈ 359, so the near plane cuts off
  // the ground in front of the camera, and the tiles it sees depend on where that plane lies.
  const camera = new PerspectiveCamera(60, 1, 480, 1000);
  camera.position.set(0, 400, 400);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}
```

b) Die Liste `cameras` im `describe('the coordinate system and the depth direction of the
camera')` um eine dritte Zeile erweitern:

```ts
    const cameras = [
      ['perspective', makeCameraWithTheFarPlaneOnTheGround],
      ['perspective, near plane on the ground', makeCameraWithTheNearPlaneOnTheGround],
      ['orthographic', makeOrthoCameraLookingDown],
    ] as const;
```

Nachgerechnet in Zug 0 mit genau diesen Werten: Referenz (WebGL) 96 Tiles, 3 Probe-Treffer; die
Zeilen `WebGPU`, `WebGL with reversed depth` und `WebGPU with reversed depth` liefern mit HEAD
dieselben 96; die alte Logik für `WebGPU` liefert 108. Kleinere Kameras (Höhe 200, Near 240)
trennen bei Tiles von 100 nicht mehr — die Werte nicht verkleinern.

### Gegenprobe zu 1 und 2 (Pflicht, vor Schritt 3)

Beide Specs schützen einen Fix, der schon committet ist; rot sehen heißt hier: gegen den Stand
vor `e830eec5`. Die zwei Quelldateien sind zu diesem Zeitpunkt unverändert, `git checkout` stellt
sie verlustfrei wieder her. Vom Repo-Root aus:

```bash
ARBEITSDIR=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/387fd4e2-8d90-4d45-ac3c-b786b7534925/scratchpad
Q=packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts
git show e830eec5^:$Q > $Q
pnpm -C packages/twopoint5d exec vitest --run src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts -t "puts a chunk of height 0 on the horizontal axis" > "$ARBEITSDIR/paket-7.gegenprobe-append.log" 2>&1; echo "exit=$?" >> "$ARBEITSDIR/paket-7.gegenprobe-append.log"
git checkout -- $Q
C=packages/twopoint5d/src/map2d/CameraBasedVisibility.ts
git show e830eec5^:$C > $C
pnpm -C packages/twopoint5d exec vitest --run src/map2d/CameraBasedVisibility.spec.ts -t "finds the tiles the camera sees" > "$ARBEITSDIR/paket-7.gegenprobe-camera.log" 2>&1; echo "exit=$?" >> "$ARBEITSDIR/paket-7.gegenprobe-camera.log"
git checkout -- $C
git status --short -- $Q $C   # muss leer sein
```

Erwartet:
- `paket-7.gegenprobe-append.log`: beide Zeilen (`west`, `east`) rot, `exit=1`.
- `paket-7.gegenprobe-camera.log`: die Zeile `WebGPU` rot, und ihre Meldung nennt
  `perspective, near plane on the ground`; `WebGL` grün; die beiden Zeilen `with reversed depth`
  rot (das waren sie schon in Paket 6). `exit=1`.

Weicht eine Erwartung ab, nichts an den Werten drehen: Status `FERTIG_MIT_VORBEHALT` und die
Ausgabe in den Report. Die Logs gehören in den Report (Pfad und die Zeilen der roten Tests).

### 3. TSDoc von `subdivide()` nennt die Regel an den Kanten

Datei `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`, erst nach der
Gegenprobe. Den TSDoc-Block über `subdivide(maxChunkNodes = 2)` (Zeilen 175-183) ersetzen durch:

```ts
  /**
   * Splits a leaf into four quadrants, recursively, as long as a node holds more than
   * `maxChunkNodes` chunks and an axis separates them. A chunk with `right <= originX` goes west,
   * otherwise one with `left >= originX` goes east, and any other chunk crosses the axis and stays
   * at the node of that axis; north (`bottom <= originY`) and south (`top >= originY`) are chosen
   * the same way. West and north come first, so a chunk of width or height 0 whose edges lie on an
   * axis goes west or north, and so does a chunk of negative width or height whose right or bottom
   * edge lies on the axis or before it.
   *
   * On a node that is already split, the call is passed on to its children, so the leaves that
   * `appendChunk()` has filled since are split too.
   */
```

Gegen den Code geprüft (`:214-228`): West bei `chunk.right <= originX`, Ost bei
`chunk.left >= originX`, sonst Straddler; darin Nord bei `bottom <= originY`, Süd bei
`top >= originY`, sonst Straddler. Die TSDoc von `appendChunk()` (`:247-253`) bleibt: sie verweist
auf die Seite, die `subdivide()` wählt. Sonst keine Änderung in der Datei.

### 4. TSDoc von `IMap2DTileDataProvider#getTileIdsWithin`

Datei `packages/twopoint5d/src/map2d/types.ts`. Über Zeile 19 (`getTileIdsWithin(...)`) im
Interface `IMap2DTileDataProvider` einfügen, mit einer Leerzeile nach `getTileIdAt(...)`:

```ts
export interface IMap2DTileDataProvider {
  getTileIdAt(col: number, row: number): number;

  /**
   * The tile ids of the rectangle of `width` × `height` tiles whose upper left corner is
   * `(left, top)`, row by row: the id of the tile `(left + i, top + j)` is at index
   * `j * width + i`, the value that {@link getTileIdAt} gives for that tile.
   *
   * @param target - takes the ids; its first `width * height` cells are overwritten, the cells
   *   behind them stay as they are. A shorter one throws a `RangeError`.
   * @returns `target`, or a new `Uint32Array` of `width * height` ids without one.
   */
  getTileIdsWithin(left: number, top: number, width: number, height: number, target?: Uint32Array): Uint32Array;
}
```

Der Text ist der von `RepeatingTilesProvider#getTileIdsWithin()` (`RepeatingTilesProvider.ts:122-132`)
ohne den Satz zu _tile space_, den die TSDoc des Interfaces schon trägt. Die TSDoc an
`RepeatingTilesProvider` bleibt, wie sie ist. `getTileIdAt` bekommt keine TSDoc: die Folge nennt
nur `getTileIdsWithin`, und Name und Interface-TSDoc (_tile space_, ganze Zahlen) tragen ihn.
Kein CHANGELOG-Eintrag: es ändert sich kein Verhalten, die Bibliothek ruft `getTileIdsWithin`
über das Interface nirgends (nur `getTileIdAt` in `TileSpritesFactory.ts:43`), und das Werfen von
`RepeatingTilesProvider` steht schon unter `### Changed` (`CHANGELOG.md:211`).

### 5. Kommentar im Typtest von `TileSpritesGeometry`

Datei `packages/twopoint5d/src/map2d/TileSprites/TileSpritesGeometry.spec.ts`, Zeilen 8-9 ersetzen
durch:

```ts
  // basePool is read without `!` or `?.` on purpose: the line compiles only while the field is
  // typed without `undefined`, which the geometry promises by building the pool itself. That is
  // checked by `pnpm typecheck`; Vitest strips the types and runs the line either way.
```

### 6. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, `### Fixed`)

a) Die Leerzeile `:359` zwischen dem Eintrag `fix the release of a renderer whose WebGL init
failed…` und `- fix \`Map2DTileStreamer#removeTileRenderer()\`…` löschen — die map2d-Einträge
gehören in dieselbe Liste. Die Leerzeile vor `### Migration Guide` (`:366`) bleibt.

b) Im Eintrag `- fix \`Map2DTileStreamer#removeTileRenderer()\`, and with it
\`Map2D#removeTileRenderer()\`: …` (`:360`) den ersten Satz

`the renderer goes off empty, through \`clearTiles()\`.`

ersetzen durch

`the renderer goes off empty, through \`clearTiles()\`, and builds the tiles of the view anew once it is added again.`

Der Rest des Eintrags bleibt unverändert.

c) In den Einträgen `- fix \`CameraBasedVisibility\`: the probe rays and the frustum test take …`
(`:364`) und `- fix \`ChunkQuadTreeNode#subdivide()\` and \`#appendChunk()\`: …` (`:365`) je den
Punkt am Zeilenende streichen. Sonst nichts an beiden: dass `:364` zwei Sätze trägt, entspricht der
Datei (`:337`, `:341`, `:345`, `:360`, `:362` tun es auch); 342 von 345 Einträgen in
`## [Unreleased]` enden ohne Punkt.

### 7. Lange Zeilen in drei Doku-Dateien umbrechen

Nur Zeilenumbrüche, kein Wort ändert sich. Jede der folgenden Zeilen stammt aus `a45cac19` und
wird an Wortgrenzen in Zeilen von höchstens 90 Zeichen (samt Einrückung) zerlegt; die
Folgezeilen tragen die Einrückung ihres Listenpunkts. Die Nachbarzeilen bleiben, wie sie sind.

| Stelle | Länge | Einrückung der Folgezeilen |
| --- | --- | --- |
| `apps/lookbook/README.md:19` (`- \`demos/\` — the demo code itself, …`) | 100 | 2 Leerzeichen |
| `apps/lookbook/README.md:42` (Schritt 3 von »Adding a demo«, ab `` `_stage-nested-pipelines.json` ``) | 561 | 3 Leerzeichen |
| `apps/lookbook/README.md:48` (`` `pnpm nx typecheck lookbook` runs … ``) | 101 | keine |
| `docs/architecture.md:284` (`cleaned up. So does \`scripts/lookbook/demoMetadata.test.mjs\` …`) | 358 | keine |
| `AGENTS.md:43` (`that checks the lookbook's vendored \`rainbow-line\` script, …`) | 182 | 2 Leerzeichen |

Keine Folgezeile darf mit einem Zeichen beginnen, das Markdown als Block liest: `-`, `+`, `*`,
`#`, `>`, oder eine Zahl mit `.` oder `)` dahinter — dann eine Wortgrenze früher oder später
umbrechen. Inline-Code in Backticks nicht zerteilen. Andere lange Zeilen dieser Dateien
(`AGENTS.md:28`, `docs/architecture.md:77`) sind älter und bleiben.

### 8. Gate

`pnpm run ci` vom Repo-Root. Grün heißt: `exit=0`; die Baseline ist vollständig grün.

## Rückgabe an den Runner (Report)

Status, geänderte Dateien, die beiden Gegenprobe-Logs mit den Namen der roten Tests, Verify-Ergebnis,
Abweichungen mit Grund, Nebenbefunde (was in den geänderten Dateien auch ohne dieses Paket falsch
ist), Folgen mit Datei und Zeile.

## Abgleich (Zug 0, 2026-09-25, gegen `e830eec5`)

- `types.ts:19` — **unverändert**: `getTileIdsWithin(left, top, width, height, target?)` ohne
  TSDoc; der Vertrag steht nur an `RepeatingTilesProvider.ts:122-132`. Öffentlich über
  `export type * from './types.js'` in `map2d/public-api.ts`. Einzige Implementierung im Repo:
  `RepeatingTilesProvider`.
- `ChunkQuadTreeNode.ts` TSDoc `subdivide()` — **unverändert** an `:175-183` (Plan: `:176-179`,
  derselbe Block). Die Verteilung `:214-228` legt jeden Chunk mit `right <= originX` nach Westen,
  auch einen mit negativer Breite (`AABB2(x, y, width, height)` nimmt jede Zahl).
- `ChunkQuadTreeNode.extended.spec.ts:388-417` — **unverändert**. Der einzige
  `appendChunk()`-Test ohne Ausdehnung prüft X (`W` mit Breite 0 auf `originX`). Die Reihenfolge
  vor `e830eec5` war Ost vor West, Süd vor Nord (`git show e830eec5^:…ChunkQuadTreeNode.ts`);
  die neuen Fälle trennen, nachgerechnet gegen den Build von HEAD mit der alten Reihenfolge von
  Hand daneben.
- `CameraBasedVisibility.spec.ts` »finds the tiles the camera sees …« — **verschoben** von `:157-170`
  nach `:745-758` (Paket 6 hat den Block am Ende eingefügt; die Zeilennummern des Reviewers zählten
  im Diff). Sachverhalt bestätigt: alte Logik (WebGPU-Projektion, `coordinateSystem` zurück auf
  WebGL, also Near-Z `-1` und Frustum nach WebGL) liefert mit beiden bestehenden Kameras dieselben
  Tiles wie die Referenz.
- `TileSpritesGeometry.spec.ts:8-9` — **unverändert**; der zweite Test (`:22-23`) sagt den
  Typecheck ausdrücklich.
- `CHANGELOG.md` — **unverändert offen**: Leerzeile `:359`; `:360` sagt nicht, dass ein wieder
  angehängter Renderer seine Tiles neu aufbaut (der Plan fragte, ob das noch offen ist — ja);
  `:364` und `:365` enden mit Punkt.
- Lange Zeilen — **unverändert**: `apps/lookbook/README.md:42` (561 Zeichen),
  `docs/architecture.md:284` (358), `AGENTS.md:43` (182; der Plan nannte `:40-44`, den
  Listenpunkt). **Dazu aufgenommen**, weil `git blame` sie demselben Commit `a45cac19` zuschreibt
  und die Ursache dieselbe ist (eingefügter Text ohne Neuumbruch): `apps/lookbook/README.md:19`
  (100) und `:48` (101). Die Nachbarabsätze brechen bei 81–94 Zeichen um; `.prettierrc` setzt kein
  `proseWrap`, Prettier lässt Umbrüche in Markdown stehen.
- Generationsprüfung: Paket 6 ist `Folge von: Paket 4` nur für die `NaN`-Schleife in `findAxis`.
  Keine der Folgen aus Paket 6 in diesem Paket berührt `findAxis`; sie betreffen die beiden
  vorbestehenden Nebenbefunde, die Paket 6 behoben hat und die keine Kette eröffnen. Die Folge aus
  Paket 4 (`types.ts`) ist zweite Generation. Keine dritte Generation — kein Halt.

## Triage (Zug 0)

- `Folgen:`-Zeilen unter den Paketen 1–6: alle »keine«. Die kleinen Reviewer-Befunde, aus denen
  dieses Paket geschnitten ist, sind vollständig: Paket 1 zwei (CHANGELOG), Paket 2 keiner offen
  (in Runde 2 mitbehoben), Paket 3 keiner, Paket 4 zwei (Seed-Kommentar `:304` von Paket 6 mit der
  Seed-Umgehung entfernt, jetzt `:310-311` ohne Hinweis; `types.ts:19` hier), Paket 5 zwei (beide
  hier), Paket 6 vier (alle hier).
- »Offene Befunde«: leer, nichts zu verteilen.
- Gesehen, kein Befund: `CHANGELOG.md:96`, `:189`, `:337` enden ebenfalls mit Punkt. Sie stammen
  aus Commits vor diesem Lauf (`a097c8d1`, `d7cea23c`, `51eb9b85`) und betreffen vertex-objects und
  stage. Ein Schlusspunkt ist keine Regel des Repos — weder der Skill `updating-changelog` noch
  Keep a Changelog schreiben ihn vor; dieses Paket streicht ihn an `:364-365` nur, weil der
  Reviewer die beiden Einträge an ihren direkten map2d-Nachbarn gemessen hat. Kein Eintrag in
  »Offene Befunde«.

## Entscheidungen dieses Zugs 0 (ohne Rückfrage, je mit Grund)

- Neuer Baum für die Y-Fälle von `appendChunk()` (`grid4x4()` statt `withoutExtentOnTheAxes()`):
  nur so ist die Gegenprobe gegen den Stand vor `e830eec5` aussagekräftig.
- Dritte Kamera statt geänderter bestehender: die beiden Kameras belegen andere Fälle (Far-Plane
  auf dem Boden, orthografisch) und bleiben; die neue macht die Zeile `WebGPU` trennscharf, ohne
  die übrigen Zeilen zu schwächen.
- Gegenprobe über `git show e830eec5^:<datei> > <datei>` und `git checkout --`: die Specs schützen
  einen committeten Fix, ein roter Lauf ist nur gegen den alten Stand zu haben. Beide Quelldateien
  sind im Moment der Probe unverändert; daher die Pflichtreihenfolge.
- Keine TSDoc für `getTileIdAt`, kein CHANGELOG-Eintrag für die Interface-TSDoc (Gründe in
  Schritt 4).
- `:364` behält seine zwei Sätze (Grund in Schritt 6c).
- `README.md:19` und `:48` aufgenommen: Symptom derselben Ursache aus demselben Commit, die Folge
  aus Paket 5 wäre sonst halb behoben.

## Restplan (Zug 0)

Paket 7 ist das letzte Paket. Keine verschobene Fundstelle und keine verteilte Folge berührt
Reihenfolge oder Schnitt — danach folgt der Abschluss.

## Folgen im Volltext

**Aus Paket 4** · `packages/twopoint5d/src/map2d/types.ts:19` — `IMap2DTileDataProvider#getTileIdsWithin`
trägt keine TSDoc; der Vertrag (`RangeError`, nur die ersten `width * height` Zellen) steht nur an
`RepeatingTilesProvider`.

**Aus Paket 6** · `ChunkQuadTreeNode.ts:178-179` — die TSDoc nennt nur Chunks der Breite oder Höhe 0
auf der Achse; ein Chunk mit negativer Breite und `right <= originX` geht ebenfalls nach Westen,
ungesagt.

**Aus Paket 6** · `ChunkQuadTreeNode.extended.spec.ts:388-417` — die Tests belegen die geänderte
Prüfreihenfolge nur in X; die Y-Reihenfolge in West- und Ostzweig von `appendChunk()` ist einzeln
nicht abgedeckt (etwa `{x: -5, y: 0, width: 3, height: 0}`), die Seed-Läufe decken nur
`subdivide()`.

**Aus Paket 6** · `CameraBasedVisibility.spec.ts:157-170` (jetzt `:745-758`) — »finds the tiles the
camera sees …« unterscheidet die Zeile `WebGPU` (nicht reversed) nicht von der Logik vor dem Fix;
diese Kombination belegt nur »sees nothing of a plane …«.

**Aus Paket 5** · `TileSpritesGeometry.spec.ts:10-11` (jetzt `:8-9`) — der Kommentar zum Lesen ohne
`!` sagt nicht, dass nur `pnpm typecheck` das prüft und nicht Vitest; der zweite Test sagt es
ausdrücklich.

**Aus Paket 1** · `packages/twopoint5d/CHANGELOG.md:346-348` (jetzt `:359-360`) — die neuen
`fix`-Einträge unter `### Fixed` stehen hinter einer Leerzeile und bilden eine eigene Liste; der
Eintrag zu `removeTileRenderer()` sagt nicht, was ein Aufrufer spürt — ein nur vorübergehend
abgehängter Renderer baut seine Tiles nach dem Wiederanhängen neu auf; ein Halbsatz würde reichen.

**Aus Paket 6** · `packages/twopoint5d/CHANGELOG.md:364-365` — beide Einträge enden mit Punkt, der
erste hat zwei Sätze; die Nachbarn (`:362-363`) stehen ohne Schlusspunkt.

**Aus Paket 5** · `apps/lookbook/README.md` (»Adding a demo«, Schritt 3), `AGENTS.md:40-44`,
`docs/architecture.md` (Absatz zu `demoMetadata.test.mjs`) — die eingefügten Passagen stehen je auf
einer sehr langen Zeile, der Text drumherum bricht bei rund 90 Zeichen um; Lint grün, nur
Formatpflege.

## Urteil des Reviewers (Zug 3)

- Paket 4 · `types.ts:19-28` TSDoc `getTileIdsWithin` — behoben
- Paket 6 · `ChunkQuadTreeNode.ts:175-184` TSDoc `subdivide()` samt negativer Breite/Höhe — behoben
- Paket 6 · `ChunkQuadTreeNode.extended.spec.ts` Y-Reihenfolge `appendChunk()` (`west`, `east`) — behoben, Gegenprobe rot
- Paket 6 · `CameraBasedVisibility.spec.ts` Zeile `WebGPU` trennscharf über `makeCameraWithTheNearPlaneOnTheGround()` — behoben, Gegenprobe rot
- Paket 5 · `TileSpritesGeometry.spec.ts:8-10` Kommentar — behoben
- Paket 1 · CHANGELOG Leerzeile und Halbsatz zu `removeTileRenderer()` — behoben
- Paket 6 · CHANGELOG Schlusspunkte — behoben
- Paket 5 · lange Zeilen `apps/lookbook/README.md:19/42/48`, `docs/architecture.md:284`, `AGENTS.md:43` — behoben
- Qualität: kritisch keiner, wichtig keiner
- klein: nach dem Umbruch stehen `whether` (`AGENTS.md`) und `lookbook and` (`apps/lookbook/README.md`) allein auf einer Zeile vor der unveränderten Nachbarzeile — reine Optik
