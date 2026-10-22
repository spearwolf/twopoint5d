# Paket 9 — Map2D und Controls: Sichtbarkeit, Tile-Fabrik, Eingaben, Leitfaden

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-026 (low), BUG-013 (low), API-005 (low), API-006 (low), BUG-014 (low), API-007 (low), TEST-014 (low), DX-002 (low), BUG-025 (low), BUG-026 (low)
- Aufgenommen, gleiche Ursache:
  - zu API-026: `CameraBasedVisibility#pointOnPlane` und `#pointsOnPlane` — ebenfalls reine Ausgaben, die jede Neuberechnung schreibt (`CameraBasedVisibility.ts:361`, `:372`), heute von außen zuweisbar bzw. als schreibbares Array herausgegeben
  - zu API-005 und API-006: `Map2DTileStreamer#update()` räumt nach `visibilitor = undefined` die Tiles nie ab — `update()` kehrt bei fehlendem Visibilitor zurück (`Map2DTileStreamer.ts:213`), bevor es den gesetzten Clear-Merker abarbeitet (`:215–224`), obwohl der TSDoc des Setters (`:50–59`) das Abräumen verspricht. Vorbestehend, nachgesehen mit `git show 6500527f:packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` (dort `:213`). Dieselbe Ursache wie API-005: »Sichtbarkeit abschalten« lässt den letzten Ausschnitt gezeichnet stehen; und ohne diesen Fix wäre `map.visibilitor = undefined` aus API-006 ein dokumentierter Weg, der nichts abräumt
  - zu TEST-014: vier weitere senkrechte `lookAt()`-Kameras in `CameraBasedVisibility.spec.ts` mit demselben Kipp um ~1e-4 rad: `makeOrthoCameraLookingDown()` (`:102`), `makeCameraCloserToThePlaneThanItsNearPlane()` (`:124`), `makeRig()` (`:791`) und die Kamera im Test `a grid of tiles smaller than 1 gives every tile its own tile` (`:1094`). Die Browsertests `sprites-segments.test.js:125` und `map2d-rotated-tiles.test.js:111`/`:159` setzen `camera.up` und sind nicht betroffen
- Ziel: Map2D-Bausteine reagieren auf Abschalten, Wechsel und Szenenwechsel wie dokumentiert, halten ihren Zustand gekapselt, `PanControl2D`/`InputControlBase` rechnen und lauschen korrekt, und `docs/map2d.md` erklärt den Aufbau einer Tile-Map.
- Modell: stärkste Stufe — zehn Findings über zwei Module und einen neuen Leitfaden mit `ts check`-Blöcken, vier Breaking Changes an der öffentlichen Oberfläche (`CameraBasedVisibility`, `RepeatingTilesProvider`, `InputControlBase`, neues optionales Interface-Member), und drei Änderungen auf Pfaden, die eine Allokations-Spec hält (`CameraBasedVisibility`, `CameraBasedVisibilityHelpers#update()`, `PanControl2D#update()`)
- Effort: medium — jede Signatur, jeder Name und jeder Wert steht unten; die Formulierung von TSDoc, Leitfaden und CHANGELOG nicht wörtlich
- Dateien:
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`, `CameraBasedVisibility.spec.ts`, `hot-path-allocations.spec.ts`
  - `packages/twopoint5d/src/map2d/HelpersManager.ts`, `HelpersManager.spec.ts`, `CameraBasedVisibilityHelpers.ts`, `CameraBasedVisibilityHelpers.spec.ts`
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts`, `RectangularVisibilityArea.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2D.ts`, `Map2D.spec.ts`, `Map2DTileStreamer.ts`, `Map2DTileStreamer.spec.ts`
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`, `RepeatingTilesProvider.spec.ts`
  - `packages/twopoint5d/src/map2d/types.ts` (`IMapTileFactory`), `TileSprites/TileSpritesFactory.ts`, `TileSprites/TileSpritesFactory.spec.ts`, `Map2DTileRenderer.ts`, `Map2DTileRenderer.spec.ts`
  - `packages/twopoint5d/src/controls/PanControl2D.ts`, `PanControl2D.spec.ts`, `InputControlBase.ts`, `InputControlBase.spec.ts`
  - neu `packages/twopoint5d/docs/map2d.md`; `packages/twopoint5d/README.md`, `packages/twopoint5d/docs/architecture.md`, `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: siehe unten, Schritte 1–11 in dieser Reihenfolge
- Verify: `git add -N packages/twopoint5d/docs/map2d.md && pnpm run ci` — der Doc-Snippet-Check liest nur getrackte Markdown-Dateien (`git ls-files`, `scripts/checkDocSnippets.mjs:43`); ohne `add -N` compiliert der Gate die `ts check`-Blöcke des neuen Leitfadens nicht
- Commit: `fix(twopoint5d)!: hand out what CameraBasedVisibility computes read-only, move the world-space helper nodes of a visibility into the root its map has at each update, clear the tiles of a rectangular area switched off and of a map whose visibilitor is taken away, let Map2D take an undefined visibilitor, keep a frozen copy of the tile pattern of RepeatingTilesProvider, build the tiles again when a TileSpritesFactory gets another tile set or tile data provider, take a delta time of PanControl2D that is no finite number above 0 as 0, tell the listeners of InputControlBase apart as the DOM does, point the top-down cameras of the map specs straight down, and write a guide to tile maps`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · API-026 umgeformt an denselben Feldern: `TileBox` `CameraBasedVisibility.ts:15–22`, `Plane` `:239`, `planeWorld`/`planeOrigin` `:356`/`:357`, `planeCoords2D` `:374`, `matrixWorld` `:377`, `visibles` `:444` · BUG-013 unverändert (`HelpersManager.ts:26–31`, `CameraBasedVisibilityHelpers.ts:137–147`) · API-005 unverändert (`RectangularVisibilityArea.ts:127–129`, `Map2DTileStreamer.ts:237`) · API-006 unverändert (`Map2D.ts:88`) · BUG-014 unverändert (`RepeatingTilesProvider.ts:36`, `:55`, `:112–116`) · API-007 unverändert (`TileSpritesFactory.ts:22–24`, `:110–123`; `Map2DTileRenderer.ts:15`) · TEST-014 unverändert (`CameraBasedVisibility.spec.ts:24`, `hot-path-allocations.spec.ts:47`) · DX-002 unverändert (`README.md:78`, `:130`, `docs/architecture.md:210`; kein `docs/map2d.md`) · BUG-025 nach `PanControl2D.ts:446` gewandert · BUG-026 unverändert (`InputControlBase.ts:7–11`, `:48–55`) · aufgenommen: `pointOnPlane`/`pointsOnPlane` zu API-026, Streamer-Clear ohne Visibilitor zu API-005/API-006 (vorbestehend), vier weitere Spec-Kameras zu TEST-014 · Folgen der Pakete 1–8: keine offen · aus »Offene Befunde«: nichts übernommen, kein Eintrag teilt eine Ursache mit diesem Paket
  - 2026-10-22 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-9.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG · 28 Dateien geändert/neu (src/map2d/, src/controls/, README.md, docs/architecture.md, CHANGELOG.md, neu docs/map2d.md per `add -N`) · Arbeitsbaum schmutzig · Verify exit=0 (`paket-9.verify.log`)
  - 2026-10-22 Zug 3: Reviewer (opus, medium) — alle zehn Findings und die drei aufgenommenen Stellen behoben, 0 kritisch, 0 wichtig, 2 klein · Diff `paket-9.diff`, Report `paket-9.review-0.json`
  - 2026-10-22 Zug 4: keine Runde — nur kleine Befunde
  - 2026-10-22 Zug 5: committet `2fc5ddd2` (28 Dateien), Verify aus Zug 2 (exit=0) trägt, keine Änderung seither · 3 Nebenbefunde in »Offene Befunde« (alle vorbestehend, `6500527f`, Urteil → Scope: die Scope-Regel nimmt jede Severity und jeden Befund im Lauf)

## Was für das ganze Paket gilt

- `AGENTS.md` im Repo-Root zuerst lesen, dazu »Konventionen« im Kopf von `./remediation-plan.md`: Code, Kommentare, Doku, CHANGELOG und Commit auf Englisch, keine Finding-IDs, kein Rückblick auf den Vorzustand (»no longer«, »now«, »instead of before« fallen weg — ein Satz beschreibt, was gilt). `AGENTS.md` sagt auch: die Quellen von `src/map2d/` und `src/controls/` ganz lesen, nicht Symbol für Symbol greppen.
- Coverage-Schwellen in `packages/twopoint5d/vite.config.ts`: `src/map2d/**` 93/91/91/94, `src/controls/**` 90/74/89/92 (Statements/Branches/Functions/Lines). Jeder neue Zweig bekommt einen Test.
- Allokations-Specs, die dieses Paket berührt: `src/map2d/hot-path-allocations.spec.ts` (misst `CameraBasedVisibility#computeVisibleTiles()`, `RectangularVisibilityArea#computeVisibleTiles()` und `CameraBasedVisibilityHelpers#update()`), `src/map2d/TileSprites/hot-path-allocations.spec.ts`, `src/controls/hot-path-allocations.spec.ts` (misst `PanControl2D#update(0)`). Neue Prüfungen auf diesen Pfaden allozieren nichts: keine Closures, keine Literale, keine Destrukturierung von Tupeln; ein Getter liefert ein vorhandenes Feld.
- Schnittstellen aus erledigten Paketen, gegen die hier gebaut wird:
  - `src/testing/threeInternals.ts` (Paket 6): `setReversedDepth(camera, reversedDepth)` — `CameraBasedVisibility.spec.ts` schreibt `_reversedDepth` nur darüber; Schritt 7 lässt diese Aufrufe stehen.
  - Kommentare im Repo ≤ 130 Zeichen und im Umbruch der umgebenden Kommentare (Paket 8). Prosa im neuen `docs/map2d.md` ≤ 100 Zeichen je Zeile, wie `docs/display.md` und `docs/sprites.md`; Tabellenzeilen und Codeblöcke ausgenommen.
- Bei jedem Korrektheitsfehler zuerst der Regressionstest, rot sehen, dann der Fix; der rote Lauf gehört in den Report. Ein Typtest ist rot, wenn `pnpm nx typecheck twopoint5d` an ihm scheitert — etwa ein `// @ts-expect-error`, das vor dem Fix keinen Fehler findet (»Unused '@ts-expect-error' directive«).
- Breaking Changes nach »Entscheidungen« Zeile 3 des Plans: durchziehen, je Änderung ein CHANGELOG-Eintrag unter `[Unreleased]` mit Abschnitt im `### Migration Guide`, eigene Aufrufer (Lookbook, Tests, Docs, `packages/twopoint5d-testing`) im selben Paket mitziehen. Skill `updating-changelog` für Form und Ort der Einträge.
- »Entscheidungen« Zeile 4 des Plans gilt für API-005 und API-007: das Verhalten wird gefixt **und** dokumentiert, nicht nur dokumentiert.

## Schritt 1 — `CameraBasedVisibility` gibt seine Ausgaben nur lesend heraus (API-026, breaking)

Datei `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`.

1. `TileBox` (`:15–47`): jedes Feld `readonly` — `id`, `x`, `y`, `coords?`, `box?`, `frustumBox?`, `centerWorld?`, `distanceToCamera?`, `map2dTile?`, `primary?`. Die TSDoc-Kommentare bleiben.
2. `PooledTileBox` (`:53–75`) deklariert jedes Feld, das die Klasse schreibt, ohne `readonly` neu: zusätzlich zu den schon neu deklarierten (`coords`, `box`, `frustumBox`, `centerWorld`, `distanceToCamera`) auch `id: number`, `x: number`, `y: number`, `map2dTile: IMap2DTileCoords | undefined`, `primary: boolean`. Ein Interface darf ein `readonly`-Feld der Basis schreibbar neu deklarieren; der Typecheck zeigt, ob eine Schreibstelle fehlt.
3. `static readonly Plane = new Plane(new Vector3(0, 1, 0), 0);` (`:239`) wird ersetzt:
   - modulweit, nicht exportiert: `const MAP_PLANE = new Plane(new Vector3(0, 1, 0), 0);` mit einem Kommentar, dass er nie herausgegeben wird;
   - `static get Plane(): Plane { return MAP_PLANE.clone(); }` mit TSDoc: die Ebene der Karte im lokalen Raum des Map-Knotens, die XZ-Ebene durch seinen Ursprung mit der Normale +Y; jeder Zugriff liefert eine neue Kopie, eine Änderung an ihr erreicht keine Instanz;
   - die Klasse selbst liest nur `MAP_PLANE`: Feldinitialisierung `planeWorld` (`:356`) als `MAP_PLANE.clone()`, und in `findPointsOnPlaneThatAreInViewFrustum()` `.copy(MAP_PLANE)` statt `.copy(CameraBasedVisibility.Plane)` (`:751`) — der Getter alloziert, der Pfad pro Neuberechnung nicht.
4. `planeWorld`, `planeOrigin`, `planeCoords2D`, `matrixWorld` (`:356`, `:357`, `:374`, `:377`) werden `readonly`. Je ein TSDoc-Satz: eine Ausgabe der letzten Neuberechnung, die die nächste an Ort und Stelle überschreibt; wer den Wert behalten will, nimmt eine Kopie. Bei `planeWorld` dazu: `CameraBasedVisibilityHelpers` hält genau dieses Objekt.
5. `pointOnPlane?: Vector3 | null` (`:361`) wird ein privates Feld `#pointOnPlane: Vector3 | null | undefined = undefined` mit `get pointOnPlane(): Vector3 | null | undefined`. Der Kommentar `:359–360` (`null` = bewusst geleert, weil die Kamera an der Ebene vorbeischaut; `undefined` = nie gesetzt) wandert in den TSDoc des Getters. Interne Schreibstellen (`:664–670`) schreiben `#pointOnPlane`.
6. `readonly pointsOnPlane: Vector3[] = []` (`:372`) wird `readonly #pointsOnPlane: Vector3[] = []` mit `get pointsOnPlane(): readonly Vector3[]`; der bestehende TSDoc wandert an den Getter. Interne Lese- und Schreibstellen (`:668`, `:717`, `:760`, `:785–790`) nutzen `#pointsOnPlane`.
7. `readonly visibles: TileBox[] = []` (`:444`) wird `readonly #visibles: PooledTileBox[] = []` mit `get visibles(): readonly TileBox[]`; der bestehende TSDoc (`:433–443`) wandert an den Getter. Interne Stellen (`:679`, `:864`, `:978`, `:987–988` und jede weitere, die der Typecheck meldet) nutzen `#visibles`.
8. Mitziehen: `CameraBasedVisibilityHelpers.ts:190` `updateTileHelpers(visibles: TileBox[])` → `readonly TileBox[]`; `CameraBasedVisibilityHelpers.spec.ts` (`makeVisibility()` `:24–35` baut ein Objekt-Literal mit `as unknown as` und bleibt gültig); jede weitere Stelle, die `pnpm typecheck` meldet — auch im Lookbook und in `packages/twopoint5d-testing`.
9. Tests, vor dem Fix rot (in `CameraBasedVisibility.spec.ts`, neuer `describe('what it hands out')`):
   - Typtests mit `// @ts-expect-error`: `visibility.visibles.push(tile)`, `visibility.visibles[0]!.x = 1`, `visibility.pointsOnPlane.push(new Vector3())`, `visibility.planeWorld = new Plane()`, `visibility.matrixWorld = new Matrix4()`, `visibility.pointOnPlane = null` — rot in `pnpm nx typecheck twopoint5d`.
   - Laufzeit: `CameraBasedVisibility.Plane` zweimal gelesen liefert zwei verschiedene Objekte; `CameraBasedVisibility.Plane.normal.set(1, 0, 0)` lässt den nächsten Zugriff und das `planeWorld` einer danach gebauten Instanz bei Normale `(0, 1, 0)` — rot vor dem Fix, weil der Zugriff dasselbe Objekt liefert.
10. `hot-path-allocations.spec.ts` bleibt unverändert grün (der Getter `visibles` liefert das Feld; gelesen wird er dort nur außerhalb der Runden).
11. CHANGELOG `[Unreleased]`, `### Changed`, als breaking markiert wie die übrigen Breaking-Einträge des Abschnitts: `CameraBasedVisibility` gibt seine Ausgaben nur lesend heraus — `TileBox` mit `readonly`-Feldern, `visibles` und `pointsOnPlane` als `readonly`-Arrays, `planeWorld`, `planeOrigin`, `planeCoords2D`, `matrixWorld` als `readonly`, `pointOnPlane` als Getter, `CameraBasedVisibility.Plane` eine Kopie je Zugriff. Grund in einem Satz: ein umgeschriebenes `x`/`y` eines Slots lässt ihn als Leiche in der Slot-Tabelle, und ein zugewiesenes `planeWorld` trennt die Helfer von der Ebene, die die Klasse schreibt. Migration-Guide-Abschnitt `#### What CameraBasedVisibility hands out`: wer sortiert oder filtert, kopiert erst (`[...visibility.visibles].sort(…)`); wer einen `TileBox` über die nächste Neuberechnung hinaus braucht, kopiert die Felder, die er braucht.

## Schritt 2 — `HelpersManager` folgt der Wurzel der Szene (BUG-013)

`HelpersManager` ist intern (nicht in `src/map2d/public-api.ts`); seine Oberfläche darf sich frei ändern. Datei `packages/twopoint5d/src/map2d/HelpersManager.ts`.

Abweichung von der Empfehlung: weder »beim Bauen umhängen« allein noch »Wurzel pro Knoten merken« allein, sondern beides in einer Form — der Manager führt seine Knoten selbst und hängt die Wurzel-Knoten bei jedem Pass des Besitzers um, wenn die Wurzel gewechselt hat. Grund: das Bauen läuft in `CameraBasedVisibilityHelpers#update()` hinter einem Gate (`:370`), das bei stehender Sicht nichts baut; eine Map, die nach `show = true` in den Szenengraphen kommt, bekäme ihre Weltraum-Knoten sonst nie in die richtige Wurzel.

1. Felder: `#scene?: Object3D` bleibt; neu `readonly #sceneNodes: Object3D[] = []` (Knoten, die in die Szene gingen), `readonly #rootNodes: Object3D[] = []` (Knoten, die in die Wurzel gingen) und `#root: Object3D | undefined` (die Wurzel, in der die `#rootNodes` gerade hängen).
2. `get root()` ermittelt die Wurzel bei jedem Zugriff frisch: `this.#scene != null ? findRootNode(this.#scene) : undefined` — kein Cache.
3. Neu `followRoot(): void` mit TSDoc: hängt die Knoten, die in die Wurzel gingen, in die Wurzel, die die Szene jetzt hat, wenn das eine andere ist als die, in der sie hängen; der Besitzer ruft es bei jedem Pass, bevor er Knoten schreibt. Ablauf: ohne Szene oder ohne `#rootNodes` zurück; `const root = findRootNode(this.#scene)`; bei `root === this.#root` zurück; sonst jeden Knoten aus `#rootNodes` mit `root.add(node)` umhängen (three nimmt ihn dabei aus seinem alten Elternknoten) und `this.#root = root`. Alloziert nichts: `findRootNode()` läuft rekursiv die Elternkette hoch, die Schleife läuft per Index.
4. `add(node, addToRoot = false)`: Ablehnung ohne Szene und Markierung (`userData.isHelper`, `userData.createdBy`) wie bisher — `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js` liest die Marken. Mit `addToRoot`: erst `this.followRoot()`, dann `const root = findRootNode(this.#scene)`, `this.#root = root`, `root.add(node)`, `this.#rootNodes.push(node)`. Ohne: `this.#scene.add(node)`, `this.#sceneNodes.push(node)`.
5. `remove()`: nimmt jeden eigenen Knoten heraus, wo immer er hängt — erst `#sceneNodes`, dann `#rootNodes`, je per `pop()` (ein Knoten verlässt die Liste vor seinem `dispose()`, sodass ein werfendes `dispose()` nur die noch nicht erreichten Knoten für den nächsten Aufruf zurücklässt), je `node.removeFromParent()` und `dispose?.()` wie in `:81–84`; danach `this.#root = undefined`.
6. `removeFromScene(scene)` entfällt, mit seinem Test `a scene this manager was never given keeps the nodes in the root` (`HelpersManager.spec.ts:44–60`): mit geführten Listen gibt es keinen Fall mehr, in dem Knoten dieses Managers in einer fremden Szene hängen. Der TSDoc von `add()` verweist auf `remove()` statt auf `removeFromScene`.
7. `set scene(scene)`: bei Wechsel `this.remove()`, dann `this.#scene = scene` (der Wurzel-Cache entfällt mit Schritt 2.2).
8. `CameraBasedVisibilityHelpers#update()` (`CameraBasedVisibilityHelpers.ts:343–374`): direkt nach `if (this.#helpers.scene == null) return;` und **vor** dem Knob-Gate `this.#helpers.followRoot();`. TSDoc von `add(scene)` (`:302–308`): die Ebene, die Punkte und die Frustum-Boxen gehen in die Wurzel über der Szene, wie sie bei jedem `update()` ist — eine Map, die nach `add()` in den Szenengraphen kommt oder umgehängt wird, nimmt sie beim nächsten `update()` mit. TSDoc von `show` (`:126–132`) sagt dasselbe für den Bau beim Einschalten.
9. `RectangularVisibilityAreaHelpers` legt seinen Knoten nur in die Szene (`RectangularVisibilityAreaHelpers.ts:121`) und braucht keinen Aufruf von `followRoot()`; nur prüfen, dass er mit dem umgebauten Manager grün bleibt.
10. Tests, vor dem Fix rot:
    - `CameraBasedVisibilityHelpers.spec.ts`: `a map added to the scene graph after show = true gets the plane, the points and the frustum boxes in the root on the next update` — `helpers.add(map); helpers.show = true;` (baut mit `map` als Wurzel), dann `scene.add(map); helpers.update();` ohne Neuberechnung der Sicht → der `PlaneHelper` und jeder `PointHelper` hängen in `scene`, die Tile-Boxen in `map`.
    - `CameraBasedVisibilityHelpers.spec.ts`: `a map moved to another scene graph takes those nodes along, and remove() finds them there` — Map aus `sceneA` in `sceneB` umhängen, `update()`, Weltraum-Knoten hängen in `sceneB`; `helpers.remove(map)` lässt in `sceneA` und `sceneB` keinen Knoten mit der Marke dieses Managers zurück.
    - `HelpersManager.spec.ts`: `followRoot() moves the root nodes into the root the scene has now` und `remove() takes a root node out of the root it was moved to`.
11. `hot-path-allocations.spec.ts`, `describe('CameraBasedVisibilityHelpers on the hot path')` (`:420`), bleibt grün — `followRoot()` läuft dort in jedem Pass.
12. CHANGELOG `### Fixed`: `CameraBasedVisibilityHelpers` legt Ebene, Punkte und Frustum-Boxen in die Wurzel, die die Map bei jedem `update()` hat, auch wenn die Map erst nach `show = true` in den Szenengraphen kommt oder umgehängt wird.

## Schritt 3 — Abschalten räumt die Tiles ab (API-005, Streamer-Clear ohne Visibilitor)

### 3a. `RectangularVisibilityArea` mit Breite oder Höhe 0

Datei `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts`. Nach »Entscheidungen« Zeile 4: gefixt, nicht nur dokumentiert. Vorbild ist der Ausgang ohne Treffer in `CameraBasedVisibility#computeVisibleTiles()` (`CameraBasedVisibility.ts:675–713`).

1. Der frühe Ausgang `if (this.width === 0 || this.height === 0) return undefined;` (`:127–129`) wird:
   - `previousTiles.length === 0` → `this.#visibleTiles = undefined; return undefined;` (nichts abzuräumen, nichts zu legen);
   - sonst: `this.#serial += 1`; `#removeTiles` leeren (`truncateArray`) und **jeden** Eintrag von `previousTiles` hineinlegen, bevor `#tiles` geleert wird — `previousTiles` kann die `tiles`-Liste des letzten Ergebnisses sein (Kommentar `:193–194`); dann `truncateArray(this.#tiles)`, `truncateArray(this.#createTiles)`, `truncateArray(this.#reuseTiles)`; `#result` mit `tiles = #tiles` (leer), `removeTiles = #removeTiles`, `createTiles = undefined`, `reuseTiles = undefined`, `offset = undefined`, `translate = undefined`, `changed = false` (kein Tile wird wiederverwendet, also keine Ansicht neu zu schreiben), `serial = this.#serial`; `this.#visibleTiles = result; return result`.
   - Die Abhängigkeits-Snapshots (`#deps`, `#seenCenter`) werden auf diesem Ausgang nicht gefragt: das Wiedereinschalten setzt über die Setter `needsUpdate` (`:97–100`, `:115–118`) und rechnet ohnehin neu.
2. TSDoc von `width` und `height` (`:85–90`, `:103–108`): `0` schaltet die Fläche ab — das nächste `computeVisibleTiles()` gibt jedes Tile, das es bekommt, in `removeTiles` zurück und legt keines; solange eine Seite 0 bleibt und kein Tile mehr übrig ist, antwortet es `undefined`. Eine neue Größe legt beim nächsten Aufruf den ganzen Satz neu. Dazu ein TSDoc an `computeVisibleTiles()` mit denselben beiden Fällen.
3. Tests in `RectangularVisibilityArea.spec.ts`, vor dem Fix rot:
   - `width 0 hands every tile back in removeTiles and lays out none` — erst mit Größe rechnen, dann `width = 0`, mit den `tiles` des Ergebnisses aufrufen → `tiles` leer, `removeTiles` enthält genau die vorherigen Tiles, `createTiles`/`reuseTiles` `undefined`, `serial` gestiegen; der nächste Aufruf mit `[]` antwortet `undefined`.
   - dasselbe für `height = 0`.
   - `a size after 0 lays out the whole set again` — nach dem Abschalten `width = 100` → alle Tiles in `createTiles`.
   - über `Map2D` (in `Map2D.spec.ts` oder `RectangularVisibilityArea.spec.ts`): ein `Map2DTileRenderer` mit Fake-Factory hält nach `area.width = 0; map.update()` kein Tile mehr.

### 3b. `Map2DTileStreamer#update()` ohne Visibilitor

Datei `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts`.

1. `update()` (`:211–276`): die Reihenfolge der Ausgänge wird `if (this.renderers.size === 0) return;` → Clear-Block (`:215–224`) unverändert → `const visibilitor = this.#visibilitor; if (visibilitor == null) return;` → Rest. Ein Update ohne Visibilitor führt damit nur einen ausstehenden Clear aus und fasst keine Matrix an.
2. TSDoc von `update()` (`:194–210`): ein Satz, dass ein Update ohne Visibilitor nur ein ausstehendes Abräumen ausführt. TSDoc des `visibilitor`-Setters (`:50–59`) stimmt danach; »the visibilitor then in place lays out the whole set« um »if there is one« ergänzen. Kommentar in `Map2D#update()` (`Map2D.ts:205–210`) prüfen: »An update that is missing either of the two touches no matrix at all« bleibt wahr.
3. Test in `Map2DTileStreamer.spec.ts`, vor dem Fix rot: `taking the visibilitor away empties every renderer on the next update` — Tiles legen, `streamer.visibilitor = undefined; streamer.update(node)` → jeder Renderer hat `clearTiles()` erhalten und `streamer.tiles` ist leer.
4. CHANGELOG `### Fixed` für 3a und 3b: eine `RectangularVisibilityArea` mit Breite oder Höhe 0 räumt ihre Tiles beim nächsten Update ab; ein Streamer, dem der Visibilitor genommen wird, leert beim nächsten Update jeden Renderer.

## Schritt 4 — `Map2D#visibilitor` nimmt `undefined` (API-006)

1. `Map2D.ts:88`: `set visibilitor(v: IMap2DVisibilitor | undefined)`. TSDoc (`:80–83`): `undefined` nimmt den Visibilitor ab, und das nächste `update()` leert jeden Renderer (Schritt 3b).
2. Test in `Map2D.spec.ts`, `describe('visibilitor')` (`:210`), vor dem Fix rot: `takes undefined, and the next update empties every renderer` — ohne Cast `map.visibilitor = undefined` (vor dem Fix ein Typfehler in `pnpm nx typecheck twopoint5d`), danach `map.visibilitor` `undefined`, `map.tileStreamer.visibilitor` `undefined`, und nach `map.update()` hält der Renderer kein Tile.
3. CHANGELOG `### Changed` (nicht breaking): der Setter `Map2D#visibilitor` nimmt `undefined`.

## Schritt 5 — `RepeatingTilesProvider` hält eine eingefrorene Kopie des Musters (BUG-014, breaking)

Datei `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`.

Abweichung von der Empfehlung: Kopie **und** `Object.freeze()`, und der Getter gibt diese Kopie heraus statt bei jedem Zugriff zu kopieren. Grund: ein `readonly`-Typ allein hält einen JavaScript-Aufrufer oder einen Cast nicht davon ab, die Invariante aus dem Kommentar `:29–32` zu brechen; eingefroren hält sie zur Laufzeit, und ein Zugriff kostet nichts. Präzedenz im Repo: `GridBase.ts:119`, `SpriteBase.ts:98`, die eingefrorene Description eines Deskriptors.

1. Feld `#tileIds!: readonly (readonly number[])[]`.
2. `get tileIds(): readonly (readonly number[])[]` — liefert die eingefrorene Kopie. TSDoc: das Muster, das der Provider hält, eingefroren; ein neues Muster wird zugewiesen, nicht hineingeschrieben.
3. `set tileIds(tileIds: readonly (readonly number[])[])` — Prüfung wie bisher (`:41–54`), dann `this.#tileIds = Object.freeze(tileIds.map((row) => Object.freeze(row.slice())))`. TSDoc: nimmt eine Kopie jeder Zeile; was der Aufrufer danach an seinem Array ändert, erreicht den Provider nicht.
4. Der Konstruktor (`:60–73`) bleibt; seine drei Pfade laufen durch den Setter und kopieren damit auch `[tileIds as number[]]` (`:64`).
5. Tests in `RepeatingTilesProvider.spec.ts`, vor dem Fix rot:
   - `a row the caller shortens after the assignment leaves the pattern as it was` — Muster `[[1, 2], [3, 4]]` zuweisen, dann am Array des Aufrufers `rows[1].length = 1` und `rows.push([9, 9])` → `getTileIdAt(1, 1)` antwortet `4`, `getTileIdsWithin(0, 0, 2, 2)` liefert `[1, 2, 3, 4]`.
   - `the pattern it hands out is frozen` — `Object.isFrozen(provider.tileIds)` und `Object.isFrozen(provider.tileIds[0])` sind `true`; ein Schreibversuch wirft im Strict Mode einen `TypeError`.
   - Typtest `// @ts-expect-error` auf `provider.tileIds[0]![0] = 5`.
6. `src/map2d/TileSprites/hot-path-allocations.spec.ts` bleibt grün (liest ein eingefrorenes Muster).
7. CHANGELOG `### Changed`, breaking: `RepeatingTilesProvider#tileIds` hält und liefert eine eingefrorene Kopie, typisiert `readonly (readonly number[])[]`. Migration-Guide-Abschnitt `#### The tile pattern of RepeatingTilesProvider`: ein geändertes Muster wird `tileIds` neu zugewiesen; danach `Map2D#clearTiles()`, damit die gelegten Tiles es übernehmen (der Provider meldet Änderungen nicht, siehe Schritt 6).

## Schritt 6 — Ein Wechsel von `tileSet` oder `tileDataProvider` baut die Tiles neu (API-007)

Nach »Entscheidungen« Zeile 4: gefixt und dokumentiert. Weg der Empfehlung (»Accessoren, die beim Wechsel ein Neuaufbauen auslösen, etwa über ein Flag, das `Map2DTileRenderer#hasPendingTiles` und ein Clearen anstößt«), ausgeführt über einen Zähler am Factory-Interface, weil `TileSpritesFactory` seine Renderer nicht kennt.

1. `IMapTileFactory` (`types.ts:44–68`): neues optionales Member `readonly contentSerial?: number` mit TSDoc: eine Zahl, die sich bewegt, sobald sich ändert, was `createTile()` für eine Koordinate baut — `TileSpritesFactory` bewegt sie, wenn `tileSet` oder `tileDataProvider` einen anderen Wert bekommt; `Map2DTileRenderer` gibt bei einem abweichenden Wert jedes Tile zurück, das es hält, vergisst die Koordinaten ohne Tile und baut alles im nächsten Update-Zyklus neu; eine Factory ohne das Member wird so nie neu gebaut.
2. `TileSpritesFactory` (`TileSprites/TileSpritesFactory.ts:22–24`): `tileSet` und `tileDataProvider` werden Accessoren über `#tileSet` / `#tileDataProvider`; der Setter zählt `#contentSerial` nur hoch, wenn der Wert sich wirklich ändert (`!==`). `get contentSerial(): number`. TSDoc beider Accessoren: ein anderer Wert lässt jeden `Map2DTileRenderer` dieser Factory im nächsten Update-Zyklus alle Tiles neu bauen, Löcher eingeschlossen; eine Änderung **innerhalb** des Tile-Sets oder des Providers sieht die Factory nicht — danach `Map2D#clearTiles()`. Der Konstruktor (`:26–31`) setzt beide über die Setter.
3. `Map2DTileRenderer` (`Map2DTileRenderer.ts`):
   - neues Feld `#builtContentSerial: number | undefined`, im Konstruktor auf `tileFactory.contentSerial` gesetzt;
   - `hasPendingTiles` (`:65–67`) ist zusätzlich `true`, solange `this.tileFactory.contentSerial !== this.#builtContentSerial` — der Streamer lässt den Renderer sonst bei stehender Sicht aus (`Map2DTileStreamer.ts:249–255`); TSDoc des Getters (`:56–64`) um diesen Fall ergänzen;
   - `beginUpdatingTiles()` (`:75–86`): nach der Prüfung auf `null` und **vor** dem Zurücksetzen der Merker: weicht `tileFactory.contentSerial` von `#builtContentSerial` ab, `this.clearTiles()` (gibt jedes Tile per `destroyTile()` zurück, leert `#declined`, zählt `#dataSerial` hoch) und erst danach `this.#builtContentSerial = tileFactory.contentSerial` — wirft `clearTiles()`, bleibt der Wert alt und der nächste Zyklus versucht es wieder;
   - der Rest des Zyklus braucht nichts Neues: der Streamer reicht auf dem Cache-Pfad alle Tiles als `reuseTiles` (`Map2DTileStreamer.ts:261`), und `reuseTile()` baut ein Tile, das nicht in `#tiles` und nicht in `#declined` steht, über `addTile()` neu (`:150–152`);
   - `dispose()` (`:222–239`) setzt `#builtContentSerial = undefined`.
4. Tests, vor dem Fix rot:
   - `Map2D.spec.ts` oder `TileSpritesFactory.spec.ts`, mit echtem `TileSpritesFactory`, `RepeatingTilesProvider` und einem Test-`TileSet` wie in `TileSprites/hot-path-allocations.spec.ts` (`makeTileSet()`): `another tileDataProvider builds every tile again on the next update, the holes of the one before included` — Provider A mit einem Loch (`0`), legen, auf Provider B ohne Loch wechseln, `map.update()` bei stehender Sicht → jede Koordinate trägt die Tile-ID von B, das frühere Loch ist belegt.
   - `another tileSet writes its texture coordinates into every tile on the next update`.
   - `the tile set or the provider assigned again costs nothing` — derselbe Wert erneut: kein `createTile()`-Aufruf im nächsten Update (Spy).
   - `Map2DTileRenderer.spec.ts`: `a factory whose contentSerial moves has the renderer give back every tile and report pending tiles`; `a factory without contentSerial is never built again that way`.
5. `src/map2d/TileSprites/hot-path-allocations.spec.ts` und die Streamer-Specs `a Map2DTileRenderer is asked about none of its tiles while the view stands` (`Map2DTileStreamer.spec.ts:511`) bleiben grün.
6. CHANGELOG: `### Added` `IMapTileFactory#contentSerial` (optional) und `TileSpritesFactory#contentSerial`; `### Fixed`: ein anderes `tileSet` oder ein anderer `tileDataProvider` an einer `TileSpritesFactory` baut die gelegten Tiles im nächsten Update neu.

## Schritt 7 — Senkrechte Spec-Kameras ohne `lookAt()` (TEST-014)

`lookAt()` entlang des up-Vektors ist entartet; three schiebt die Blickrichtung um 0.0001 und kippt die Kamera um ~1e-4 rad. `rotation.set(-Math.PI / 2, 0, 0)` ergibt dieselbe Ausrichtung — Blick entlang −Y, Bildschirm-rechts +X, Bildschirm-oben −Z — exakt.

1. In `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts` `camera.lookAt(0, 0, 0)` durch `camera.rotation.set(-Math.PI / 2, 0, 0)` ersetzen in: `makeTopDownCamera()` (`:24–31`), `makeOrthoCameraLookingDown()` (`:102–109`), `makeCameraCloserToThePlaneThanItsNearPlane()` (`:124–131`), `makeRig()` (`:787–797`) und der Kamera im Test `a grid of tiles smaller than 1 gives every tile its own tile` (`:1093–1097`). `camera.updateMatrixWorld()` bleibt, wo es steht.
2. Dasselbe in `packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts`, `makeTopDownCamera()` (`:47–54`).
3. Der Test bei `:1250`, der die Rotation schon setzt, bleibt; ein Kommentar dort, der den Umweg mit dem Kipp von `lookAt()` begründet, entfällt oder wird auf die gemeinsame Regel verkürzt.
4. Alle Specs, die diese Helfer nutzen, laufen dagegen. Verschiebt sich eine Erwartung, hing sie am Kipp: anpassen und im Report je Test sagen, was sich bewegt hat und warum. Kein roter Lauf nötig — das ist ein Testhelfer, kein Produktfehler.
5. Ein Kommentar über einer der Funktionen (höchstens einer je Datei) nennt die Regel: eine senkrechte Kamera über `rotation`, weil `lookAt()` entlang des up-Vektors kippt.

## Schritt 8 — `PanControl2D#update(t)` rechnet nur mit endlichem `t` (BUG-025)

Datei `packages/twopoint5d/src/controls/PanControl2D.ts`, `update(t)` (`:441–484`).

Entscheidung: ein `t`, das keine endliche Zahl über 0 ist (`NaN`, `undefined`, `±Infinity`, `≤ 0`), zählt als `0`; keine Ablehnung. Grund: `update()` läuft im Frame-Loop mit einem `deltaTime`, das im ersten Frame fehlen kann, und ein Wurf pro Frame wäre schlimmer als ein Frame ohne Bewegung; dasselbe Muster wie Paket 3/4 (`pixelZoom`/`maxPixels` zählen als 0, `resolutionScale` als 1). `0` bleibt gültig und ändert nichts.

1. Am Anfang von `update()` nach dem Disposed-Guard: `const dt = Number.isFinite(t) && t > 0 ? t : 0;` und die vier Speed-Zeilen (`:446–449`) rechnen mit `dt`. Den Zweig ohne neue Hilfsfunktion schreiben (Hot Path, `src/controls/hot-path-allocations.spec.ts`).
2. Der Pointer-Pan (`:451–471`) hängt nicht an `t` und wird auch bei `dt = 0` ausgeliefert.
3. TSDoc von `@param t` (`:439`): Sekunden seit dem letzten Aufruf; was keine endliche Zahl über 0 ist, zählt als 0 — die Speed-Felder bewegen die Sicht dann nicht, ein gesammelter Pointer-Pan wird trotzdem ausgeliefert.
4. Tests in `PanControl2D.spec.ts`, vor dem Fix rot: `update() with a delta time of NaN, undefined, Infinity, -Infinity or -1 moves the view by no speed field` (parametrisiert, `speedEast = 10`, `speedNorth = 10`) → `panView.x`/`panView.y` bleiben endlich und unverändert; `a delta time of NaN with every speed at 0 emits no update after the first` (vor dem Fix geht jedes Frame ein `OnPanControl2DUpdate` mit `NaN` hinaus).
5. CHANGELOG `### Fixed`: `PanControl2D#update()` nimmt ein Delta, das keine endliche Zahl über 0 ist, als 0.

## Schritt 9 — `InputControlBase` unterscheidet Listener wie das DOM (BUG-026, breaking)

Datei `packages/twopoint5d/src/controls/InputControlBase.ts`.

Entscheidung zur offenen Wahl der Empfehlung: bei abweichendem `passive` wird der bestehende Eintrag **ersetzt** (abmelden, mit dem neuen `passive` anmelden), nicht abgelehnt. Grund: eine Unterklasse, die einen nicht passiven Listener verlangt, will `preventDefault()` rufen; behielte die Liste den passiven, wäre das still wirkungslos, und eine Ablehnung als Wurf träfe die öffentlichen Setter von `PanControl2D`, die `addEventListener()` aufrufen.

1. `#findListenerIndex(host, eventName, callback)` (`:7–11`) vergleicht nur noch `host`, `eventName`, `callback` — das DOM unterscheidet nach `(type, callback, capture)`, und diese Klasse meldet nie mit `capture` an.
2. `addEventListener(host, eventName, callback, passive = true)` (`:15–36`): Index suchen; kein Eintrag → wie bisher anhängen und, wenn aktiv, anmelden; Eintrag mit gleichem `passive` → nichts; Eintrag mit anderem `passive` → wenn aktiv `host.removeEventListener(eventName, listener)` und `host.addEventListener(eventName, listener, {passive})`, dann `entry[3] = passive`. TSDoc: derselbe Callback für denselben Host und dasselbe Ereignis ist ein Listener; ein zweiter Aufruf mit anderem `passive` ersetzt ihn.
3. `removeEventListener(host, eventName, callback)` (`:38–56`): der Parameter `passive` entfällt (er spielt beim Finden keine Rolle mehr). TSDoc: entfernt den Listener, wie auch immer `passive` beim Anmelden stand.
4. Mitziehen: `PanControl2D.ts:373–376`, `:395–398` rufen mit drei Argumenten und bleiben; `InputControlBase.spec.ts` (`TestControl`, `:8–16`) bekommt eine Variante mit `passive`-Argument für die neuen Tests; jede weitere Stelle, die `pnpm typecheck` meldet.
5. Tests in `InputControlBase.spec.ts` mit Nodes echtem `EventTarget`, vor dem Fix rot:
   - `the same callback added once passive and once not is one listener, and one remove takes it off` — `add(cb, true)`, `add(cb, false)`, `remove(cb)` → ein `dispatchEvent` ruft `cb` nicht, `control.isActive` ist `false` (vor dem Fix bleibt ein Eintrag, `isActive` `true`, während der Host keinen Listener mehr hat).
   - `a second add with another passive replaces the listener` — `add(cb, true)`, `add(cb, false)`, ein abbrechbares Ereignis, dessen `cb` `preventDefault()` ruft → `event.defaultPrevented` ist `true`. Falls Nodes `EventTarget` `passive` nicht beachtet, stattdessen ein Host-Stub, der die Optionen jedes `addEventListener()` protokolliert: der zuletzt angemeldete Listener trägt `{passive: false}`.
6. CHANGELOG `### Changed`, breaking: `InputControlBase#removeEventListener()` nimmt kein `passive` mehr; ein zweites `addEventListener()` mit anderem `passive` ersetzt den Listener. Migration-Guide-Abschnitt `#### A control of one's own that removes its listeners`: das vierte Argument von `removeEventListener()` fällt weg.

## Schritt 10 — Leitfaden `docs/map2d.md` (DX-002)

Neue Datei `packages/twopoint5d/docs/map2d.md`, englisch, Prosa ≤ 100 Zeichen je Zeile, Aufbau wie `docs/text.md` und `docs/display.md`. Direkt nach dem Anlegen `git add -N packages/twopoint5d/docs/map2d.md` (siehe Verify). Jeder Block, der für sich steht — importiert alles, was er nutzt, deklariert alles, was er nennt (`declare const tileSet: TileSet<unknown>;` wie in `docs/text.md:72`) —, trägt `ts check`. Vorlage für die Beispiele: `apps/lookbook/src/demos/map2d/map2d-cam-visi.ts` und `map2d-rect-visi.ts`.

Gliederung, jeder Punkt ein Abschnitt; das Verhalten ist das nach den Schritten 1–9:

1. `# Tile maps` — ein Absatz: eine endlose 2D-Karte auf der XZ-Ebene eines `Map2D`-Knotens, um die Sicht herum gestreamt, ein Tile je Gitterzelle als Sprite. Danach eine Tabelle der Bausteine und ihrer Rolle: `Map2D` (Knoten in der Szene, hält Streamer und Renderer, `update()` einmal je Frame), `Map2DTileStreamer` (Gitter `tileWidth`/`tileHeight`/`xOffset`/`yOffset`, Sichtzentrum, fragt den Visibilitor, verteilt an die Renderer), `CameraBasedVisibility` und `RectangularVisibilityArea` (welche Tiles sichtbar sind), `Map2DTileRenderer` (hält die Tiles einer Factory, fragt fehlende nach), `TileSpritesFactory` (baut je Koordinate ein Sprite aus `IMap2DTileDataProvider` und `TileSet`), `TileSprites` mit `TileSpritesGeometry` und `TileSpritesMaterial` (das instanzierte Mesh), `RepeatingTilesProvider` (ein `IMap2DTileDataProvider`), `CameraBasedVisibilityHelpers` / `RectangularVisibilityAreaHelpers` (Debug-Ansicht).
2. `## A map under a camera` — `ts check`-Block: `Map2D`, `tileWidth`/`tileHeight` 256, `xOffset`/`yOffset` −128, `CameraBasedVisibility(camera)`, `RepeatingTilesProvider` mit kleinem Muster samt Loch, `TileSprites(new TileSpritesGeometry(capacity), new TileSpritesMaterial({colorMap: texture}))`, `Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData))`, `map2d.addTileRenderer()`, `scene.add(map2d)`, und eine Frame-Funktion, die `map2d.update()` ruft. Prosa dazu: `Map2D#update()` einmal je Frame; nach einer Änderung an `fov`, `aspect`, `near`, `far` oder `zoom` ruft der Aufrufer `camera.updateProjectionMatrix()` vor dem nächsten `update()`; die Welt-Matrix der Kamera holt die Sicht selbst.
3. `## A map in a rectangle` — `ts check`-Block mit `RectangularVisibilityArea(width, height)`; `centerX`/`centerY` sind der Kartenpunkt, der am Ursprung des Map-Knotens erscheint; Breite oder Höhe `0` schaltet die Fläche ab und räumt beim nächsten `update()` ab (Schritt 3a).
4. `## Defaults and how they play together` — Tabelle Wert · Default · Wechselwirkung, Werte aus dem Code: `TileSpritesGeometry` `capacity` `100` gegen `CameraBasedVisibility#maxVisibleTiles` `10 000` (ein voller Pool lässt Löcher, der Renderer warnt einmal; die Geometrie für die meisten Tiles bauen, die die Sicht auf einmal zeigt); `depth` `100` relativ zur Tile-Größe (Höhe der Box; viel höher als die Tiles breit sind → Tiles außerhalb der Sicht gelten als sichtbar; so hoch wie das, was auf der Karte steht); `frustumBoxScale` `1.1`; `lookAtCenter` `false` und was `centerX`/`centerY` je Visibilitor bedeuten (aus dem TSDoc von `Map2D#centerX`); `xOffset`/`yOffset` `0`, Gitter an der Ecke verankert, `-tileWidth / 2` zentriert; `far` begrenzt die Suche, gekippt wächst der Boden mit `far²`; `RectangularVisibilityArea` `320 × 240`.
5. `## Changing a map while it runs` — Gitterwerte und ein anderer Visibilitor (auch `undefined`) räumen ab und legen beim nächsten `update()` neu; ein anderes `tileSet` oder ein anderer `tileDataProvider` an der Factory baut beim nächsten `update()` neu (Schritt 6); eine Änderung **innerhalb** eines Providers oder Tile-Sets, etwa ein neues Muster an `RepeatingTilesProvider#tileIds`, braucht `map2d.clearTiles()`.
6. `## Seeing what the visibility decided` — `CameraBasedVisibilityHelpers`: `helpers.add(map2d)` (die Tile-Boxen im lokalen Raum der Map, Ebene, Punkte und Frustum-Boxen in der Wurzel darüber, auch wenn die Map erst später in den Szenengraphen kommt — Schritt 2), `helpers.show = true`, `helpers.update()` je Frame nach `map2d.update()`, `helpers.dispose()`.
7. `## Who disposes what` — die Reihenfolge aus `map2d-cam-visi.ts:111–121`: `tileRenderer.dispose()` (gibt die Slots an die Factory zurück), `map2d.dispose()` (verlässt den Szenengraphen, lässt die Renderer gehen, gibt nichts frei), Geometrie und Material der `TileSprites` gibt der Aufrufer frei, die Textur ihr Besitzer (etwa der `TextureStore`), die Helfer ihr eigenes `dispose()`. Verweis auf `docs/resource-lifecycle.md`.

Verlinken:
- `packages/twopoint5d/README.md`: im Abschnitt `### 🧱 Tile maps` (`:78–83`) ein Verweis auf den Leitfaden, und in der Liste der Guides (`:130–133`) `[tile maps](docs/map2d.md)` neben `[text](docs/text.md)`.
- `packages/twopoint5d/docs/architecture.md`, Abschnitt `### map2d/` (ab `:210`): ein Satz »The guide is [`docs/map2d.md`](./map2d.md).« wie am Ende von `### text/` (`:207–208`).
- CHANGELOG `### Added`: der Leitfaden `docs/map2d.md`.

## Schritt 11 — Gate

`git add -N packages/twopoint5d/docs/map2d.md && pnpm run ci`. Rot wird nicht übergangen; ein Allokations-Spec, der nach Schritt 1, 2, 6 oder 8 Bytes misst, ist ein Befund dieses Pakets.

## Findings im Volltext

**API-026 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:20** — Hot-Path-Zustand von `CameraBasedVisibility` nur lesend herausgeben
Weitere Fundstellen: `CameraBasedVisibility.ts:231`, `:339`, `:357`, `:360` (Audit-Stand; heute `:239`, `:356`, `:357`, `:374`, `:377`, `:444`).
`visibles` reicht die gepoolten Slots als `TileBox` mit schreibbaren `id`, `x`, `y` heraus. Ein Slot steckt mit genau diesen `x`/`y` in der `TileSlotTable`; schreibt ein Aufrufer sie um, findet `remove()` den Bucket nicht mehr, der Slot bleibt als Leiche in der Tabelle und `get()` liefert für die neue Koordinate einen falschen Slot. Dazu kommen `static readonly Plane` (die Referenz ist readonly, das `Plane`-Objekt nicht — eine Mutation verschiebt die Ebene aller Instanzen) und die öffentlich schreibbaren Felder `planeWorld`, `planeOrigin`, `planeCoords2D`, `matrixWorld`, die jede Neuberechnung überschreibt.
Beleg: `export interface TileBox { id: number; x: number; y: number; … }` und `static readonly Plane = new Plane(new Vector3(0, 1, 0), 0);`
Empfehlung: `TileBox` mit `readonly`-Feldern typisieren und `visibles` als `readonly TileBox[]` herausgeben; `Plane` einfrieren oder als Getter liefern, der eine Kopie zurückgibt; die übrigen Felder als `readonly` deklarieren, da sie nur Ausgaben sind.

**BUG-013 · low · packages/twopoint5d/src/map2d/HelpersManager.ts:27** — Wurzelknoten in `HelpersManager` nicht über die Lebensdauer der Szene cachen
Weitere Fundstelle: `CameraBasedVisibilityHelpers.ts:141`.
`root` wird beim ersten `add(node, true)` per `findRootNode(scene)` ermittelt und bis zum nächsten Szenenwechsel behalten. `CameraBasedVisibilityHelpers#show = true` baut das Set sofort, sobald `add(map)` eine Szene genannt hat; steht die Map zu diesem Zeitpunkt noch nicht im Szenengraphen (`helpers.add(map); helpers.show = true; scene.add(map)`), ist `root` die Map selbst. Ebene, Punkte und Frustum-Boxen, die in Weltkoordinaten berechnet sind, landen dann im lokalen Raum der Map und erscheinen bei jeder Map-Transformation verschoben, dauerhaft, weil der Cache nie verfällt. Dasselbe gilt, wenn die Map später umgehängt wird.
Beleg: `if (this.#root == null && this.#scene != null) { this.#root = findRootNode(this.#scene); }`
Empfehlung: Beim Bauen die Wurzel neu ermitteln und die Knoten, die in einer alten Wurzel hängen, umhängen, oder sich die Wurzel pro Knoten merken (für `remove()`) statt einmal pro Manager; alternativ im TSDoc von `add()` verlangen, dass die Szene bereits eingehängt ist.

**API-005 · low · packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:128** — »Abschalten« einer `RectangularVisibilityArea` die Tiles auch abräumen lassen oder es klar dokumentieren
Weitere Fundstelle: `Map2DTileStreamer.ts:237`.
Der TSDoc von `width`/`height` sagt »`0` switches the area off«. Tatsächlich antwortet `computeVisibleTiles()` dann `undefined`, und `Map2DTileStreamer#update()` lässt bei `undefined` alles stehen: die zuletzt gelegten Tiles bleiben gezeichnet und belegen ihre Pool-Slots, bis die Fläche wieder eine Größe bekommt. Wer »off« als »leer« liest, bekommt einen eingefrorenen Ausschnitt.
Beleg: `if (this.width === 0 || this.height === 0) { return undefined; }`
Empfehlung: Entweder bei Breite oder Höhe 0 ein Ergebnis mit leerem `tiles` und allen `previousTiles` in `removeTiles` liefern, wie es `CameraBasedVisibility` macht, wenn die Kamera an der Ebene vorbeischaut, oder den TSDoc auf »friert den letzten Ausschnitt ein« ändern.

**API-006 · low · packages/twopoint5d/src/map2d/Map2D.ts:88** — `Map2D#visibilitor` auch `undefined` annehmen lassen
Der Getter liefert `IMap2DVisibilitor | undefined`, der Setter nimmt nur `IMap2DVisibilitor`. `Map2DTileStreamer#visibilitor` nimmt `undefined` und räumt dabei die Tiles ab; über `Map2D` lässt sich ein Visibilitor ohne Cast nicht mehr entfernen, obwohl `Map2D` sonst jedes Feld des Streamers spiegelt.
Beleg: `get visibilitor(): IMap2DVisibilitor | undefined` / `set visibilitor(v: IMap2DVisibilitor)`
Empfehlung: Den Setter auf `IMap2DVisibilitor | undefined` erweitern.

**BUG-014 · low · packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:55** — Tile-Muster in `RepeatingTilesProvider` kopieren statt per Referenz halten
Weitere Fundstellen: `RepeatingTilesProvider.ts:36`, `:116`.
Der `tileIds`-Setter prüft, dass alle Zeilen gleich lang sind, und merkt sich `#rows`/`#cols` — speichert aber das Array des Aufrufers selbst, und der Getter reicht es wieder heraus. Kürzt der Aufrufer danach eine Zeile oder hängt Zeilen an, stimmt die geprüfte Invariante nicht mehr: `getTileIdAt()` liefert `undefined` als `number` (die `!` verdecken das), `#writeRow()` schreibt `undefined` in den `Uint32Array` und damit stillschweigend 0. Der Kommentar Zeile 29–32 verspricht, dass kein Index über das Muster hinauszeigen kann.
Beleg: `this.#tileIds = tileIds;` nach der Prüfung, `get tileIds(): number[][] { return this.#tileIds; }`
Empfehlung: Im Setter eine flache Kopie je Zeile ablegen (`tileIds.map((row) => row.slice())`) und den Getter als `readonly (readonly number[])[]` typisieren oder ebenfalls kopieren.

**API-007 · low · packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts:22** — Wechsel von `tileSet` oder `tileDataProvider` an `TileSpritesFactory` wirksam machen
Weitere Fundstellen: `TileSpritesFactory.ts:110`, `Map2DTileRenderer.ts:15`.
`tileSet` und `tileDataProvider` sind öffentlich schreibbare Felder, wirken aber nur auf neu angelegte Tiles: `updateTile()` schreibt nur die Position, und `Map2DTileRenderer` merkt sich in `#declined` jede Koordinate, für die der alte Provider 0 lieferte. Wer etwa ein neues Level lädt, indem er den Provider tauscht, bekommt alte Texturen auf den bestehenden Tiles und Löcher an allen Stellen, die vorher leer waren — bis sie den Sichtbereich verlassen. Nichts im TSDoc der Felder weist auf ein nötiges `clearTiles()` hin.
Beleg: `tileSet?: TileSet<unknown>;` / `tileDataProvider?: IMap2DTileDataProvider;`
Empfehlung: Die beiden Felder als Accessoren führen, die beim Wechsel ein Neuaufbauen auslösen (etwa über ein Flag, das `Map2DTileRenderer#hasPendingTiles` und ein Clearen anstößt), oder zumindest im TSDoc festhalten, dass danach `Map2D#clearTiles()` nötig ist.
Herkunft: im Lauf vom 2026-09-29 verursacht.

**TEST-014 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts:23** — `makeTopDownCamera()` exakt senkrecht ausrichten
Weitere Fundstelle: `hot-path-allocations.spec.ts:47`.
`makeTopDownCamera()` schaut nicht exakt senkrecht: `lookAt()` entlang des up-Vektors kippt die Kamera um etwa 1e-4 rad; ein Spec mit exakten Höhen fällt darüber (der Höhen-Spec nimmt deshalb `rotation.x = -π/2`). Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Die Hilfsfunktion über `rotation.x = -Math.PI / 2` statt `lookAt()` bauen und die Specs, die sie nutzen, dagegen laufen lassen.

**DX-002 · low · packages/twopoint5d/README.md:78** — Einen Leitfaden `docs/map2d.md` für den Aufbau einer Tile-Map schreiben
Weitere Fundstellen: `README.md:130`, `docs/architecture.md:206`.
Sprites, Text, Stages und Display haben je einen Guide, Map2D keinen: das README nennt drei Spiegelstriche, `architecture.md` einen Absatz. Wer eine Karte aufbaut, muss sechs Klassen zusammenstecken (`Map2D`, `Map2DTileStreamer`, `Map2DTileRenderer`, `TileSpritesFactory`, `TileSpritesGeometry`, ein Visibilitor, ein `IMap2DTileDataProvider`) und die Fallstricke aus dem TSDoc zusammensuchen: die feste `capacity` der Geometrie (Default 100) gegen `maxVisibleTiles` (Default 10 000), die Bedeutung von `centerX`/`centerY` je Visibilitor, `depth` relativ zur Kachelgröße, `camera.updateProjectionMatrix()` vor dem Frame, dass ein Wechsel von `tileSet`/`tileDataProvider` erst nach `clearTiles()` greift und dass `Map2D#update()` pro Frame gerufen werden muss.
Empfehlung: `packages/twopoint5d/docs/map2d.md` mit einem lauffähigen `ts check`-Beispiel (Kamera-Sicht und Rechteck), einer Tabelle der Default-Werte und ihrer Wechselwirkungen und einem Abschnitt Lebenszyklus (wer was disposed) anlegen und im README verlinken.

**BUG-025 · low · packages/twopoint5d/src/controls/PanControl2D.ts:417** — `PanControl2D.update(t)` nur mit endlichem `t` rechnen lassen
`update(t)` multipliziert `t` ungeprüft mit allen vier Speed-Feldern. Ein `NaN` (z. B. ein `deltaTime`, das im ersten Frame `undefined` ist) macht `panView.x/y` dauerhaft zu `NaN` — auch wenn alle Speeds 0 sind, denn `0 * NaN` ist `NaN` — und weil `NaN !== NaN`, geht ab dann in jedem Frame ein `OnPanControl2DUpdate` mit `NaN` raus. Der Rest der Bibliothek prüft Zahlen sonst konsequent (`assertPositiveFinite`).
Beleg: `this.panView.y -= this.speedNorth * t;`
Empfehlung: Ein nicht endliches oder negatives `t` als 0 behandeln oder mit `RangeError` ablehnen; Verhalten im TSDoc nennen.

**BUG-026 · low · packages/twopoint5d/src/controls/InputControlBase.ts:9** — Listener-Identität in `InputControlBase` an der des DOM ausrichten
Weitere Fundstelle: `InputControlBase.ts:52`.
Die Liste unterscheidet Einträge nach `(host, eventName, callback, passive)`, das DOM nach `(type, callback, capture)`. Fügt eine Unterklasse denselben Callback einmal passiv und einmal nicht passiv hinzu, ignoriert der Browser das zweite `addEventListener`, die Liste führt aber zwei Einträge. Entfernt sie danach einen davon, nimmt `host.removeEventListener` den einzigen DOM-Listener weg, während der andere Eintrag als angehängt gilt — der Listener ist still verloren, bis `unsubscribe()`/`subscribe()`. Heute ruft nur PanControl2D die API auf, immer mit dem Default `passive = true`; die Methoden sind aber `protected` und für Unterklassen gedacht.
Beleg: `listener[0] === host && listener[1] === eventName && listener[2] === callback && listener[3] === passive`
Empfehlung: `passive` aus dem Vergleich in `#findListenerIndex` nehmen (wie das DOM) und bei abweichendem `passive` entweder ablehnen oder den bestehenden Eintrag ersetzen (abmelden, neu anmelden).

## Reviewer-Urteil (Zug 3, `paket-9.review-0.json`)

- API-026 behoben — `TileBox` nur `readonly` (`CameraBasedVisibility.ts:46–88`), `static get Plane()` aus `MAP_PLANE` (`:252`), `readonly planeWorld`/`planeOrigin`/`planeCoords2D`/`matrixWorld` (`:376–425`), `get visibles(): readonly TileBox[]` (`:494`); Typ- und Laufzeittests in `describe('what it hands out')`
- aufgenommen zu API-026 behoben — `#pointOnPlane` mit Getter (`:394`), `#pointsOnPlane` mit Getter `readonly Vector3[]` (`:409`); `CameraBasedVisibilityHelpers#updateTileHelpers(visibles: readonly TileBox[])`
- BUG-013 behoben — `HelpersManager` mit `#sceneNodes`/`#rootNodes`, `followRoot()` (`HelpersManager.ts:42`), `add(…, true)` ruft `followRoot()` (`:78`), `removeFromScene()` entfernt; Aufruf vor dem Knob-Gate `CameraBasedVisibilityHelpers.ts:356`
- API-005 behoben — `#switchedOff()` (`RectangularVisibilityArea.ts:141`, `:265–296`) gibt alle `previousTiles` in `removeTiles` zurück; TSDoc an `width`, `height`, `computeVisibleTiles()`; Tests inkl. `Map2D` mit echtem `Map2DTileRenderer`
- aufgenommen zu API-005/006 behoben — Clear-Block vor `if (visibilitor == null) return;` (`Map2DTileStreamer.ts:230`)
- API-006 behoben — `set visibilitor(v: IMap2DVisibilitor | undefined)` (`Map2D.ts:89`)
- BUG-014 behoben — `Object.freeze(tileIds.map((row) => Object.freeze(row.slice())))` (`RepeatingTilesProvider.ts:66`), Typ `readonly (readonly number[])[]`
- API-007 behoben — `IMapTileFactory#contentSerial?` (`types.ts:76`), Accessoren `TileSpritesFactory.ts:24–64`, `Map2DTileRenderer` `:78`/`:99`, `dispose()` setzt zurück
- TEST-014 behoben — `makeTopDownCamera()` in beiden Specs mit `rotation.set(-Math.PI / 2, 0, 0)`; die vier aufgenommenen Kameras ebenfalls umgestellt
- DX-002 behoben — `packages/twopoint5d/docs/map2d.md` mit allen sieben Abschnitten und `ts check`-Blöcken, verlinkt `README.md:83`, `:131`, `docs/architecture.md:226`
- BUG-025 behoben — `const dt = Number.isFinite(t) && t > 0 ? t : 0;` (`PanControl2D.ts:447`)
- BUG-026 behoben — `#findListenerIndex` ohne `passive` (`InputControlBase.ts:9`), anderes `passive` ersetzt (`:44–54`), `removeEventListener()` ohne viertes Argument

Kleine Befunde (lösen keine Runde aus):
- `packages/twopoint5d/docs/map2d.md:199` — »`RectangularVisibilityAreaHelpers` does the same for the rectangle« liest sich, als folge auch das Rechteck der Wurzel; es liegt nur im Map-Knoten (`RectangularVisibilityAreaHelpers.ts:121`) und ruft `followRoot()` nicht auf
- `packages/twopoint5d/CHANGELOG.md:91` — Markierung »(**BREAKING** for TypeScript)« zu schwach: Zuweisung an den Getter `pointOnPlane` wirft im Strict Mode, und eine Mutation an `CameraBasedVisibility.Plane` erreicht keine Instanz mehr — beides Laufzeit; schlicht »(**BREAKING**)« wäre zutreffend

Regressionstests vor dem Fix rot (aus dem Implementierer-Report `paket-9.impl-0.json`): Typtests in `hands out what it computes for reading only` (6 × TS2578), `CameraBasedVisibility.Plane is a new copy on every access`, `followRoot() moves the root nodes into the root the scene has now`, `remove() takes a root node out of the root it was moved to`, `a map added to the scene graph after show = true gets the plane, the points and the frustum boxes in the root on the next update`, `a map moved to another scene graph takes those nodes along, and remove() finds them there`, `width 0 hands every tile back in removeTiles and lays out none` (+ `height`), `a size after 0 lays out the whole set again`, `an area switched off to a width of 0 leaves no tile in a Map2DTileRenderer`, `taking the visibilitor away empties every renderer on the next update`, `takes undefined, and the next update empties every renderer`, `a row the caller shortens after the assignment leaves the pattern as it was`, `the pattern it hands out is frozen`, `another tileDataProvider builds every tile again on the next update, the holes of the one before included`, `another tileSet writes its texture coordinates into every tile on the next update`, `a factory whose contentSerial moves has the renderer give back every tile and report pending tiles`, `update() with a delta time of NaN|undefined|Infinity|-Infinity|-1 moves the view by no speed field`, `a delta time of NaN with every speed at 0 emits no update after the first`, `a delta time of NaN still delivers the pan a pointer collected`, `the same callback added once passive and once not is one listener, and one remove takes it off`, `a second add with another passive replaces the listener`. Ohne Rot (pinnen Bestand/neue Zweige): `a factory without contentSerial is never built again that way`, `a second add with the same passive keeps the one listener, and one while unsubscribed waits for subscribe()`.
