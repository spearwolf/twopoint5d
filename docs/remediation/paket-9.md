# Paket 9 — Map2D: letzte Ränder an CameraBasedVisibility, Spatial Hash, Streamer und TileRenderer

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (zweite Drain-Runde über »Offene Befunde«; die fünf Nebenbefunde im Volltext unten)
- Nebenbefunde: `CameraBasedVisibility.ts:297` `depth` ungeprüft (low) · `CameraBasedVisibility.spec.ts:913`/`:937` Testnamen zu »primary« (low) · `Map2DSpatialHashGrid.ts:159` `getTile()` gibt die veränderliche Zelle heraus (low; jetzt `:195`–`:197`) · `Map2DTileStreamer.ts:134` `removeTileRenderer()` löst den Renderer vor `clearTiles()` (low) · `Map2DTileRenderer.ts:165` `#dataSerial` erst nach `destroyTile()` (low) · in Zug 0 dazu, gleiche Ursache: `Map2DTileRenderer.ts:98`–`:101` und `:145`–`:146` (`#dataSerial` erst nach `updateTile()`), `Map2D.ts:138`–`:144` (`removeTileRenderer()` nimmt den Knoten vor dem Streamer ab) · dazu zwei kleine Reviewer-Befunde aus Paket 7 in den Abschnitten des Migration Guide, die dieses Paket ergänzt
- Ziel: Die Map2D-Bausteine lassen sich weder über ungültige Werte noch über herausgegebene interne Sammlungen oder werfende Factories in einen inkonsistenten Zustand bringen, und ihre Testnamen sagen, was geprüft wird.
- Modell: mittlere Stufe
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`):
  - `src/map2d/CameraBasedVisibility.ts`, `src/map2d/CameraBasedVisibility.spec.ts`
  - `src/map2d/Map2DSpatialHashGrid.ts`, `src/map2d/Map2DSpatialHashGrid.spec.ts`
  - `src/map2d/Map2DTileStreamer.ts`, `src/map2d/Map2DTileStreamer.spec.ts`
  - `src/map2d/Map2D.ts`, `src/map2d/Map2D.spec.ts`
  - `src/map2d/Map2DTileRenderer.ts`, `src/map2d/Map2DTileRenderer.spec.ts`
  - `CHANGELOG.md` (nur `[Unreleased]`)
  - **Nicht** anfassen: `src/map2d/hot-path-allocations.spec.ts` und `…tilted-view.spec.ts` (sie müssen grün bleiben, nicht geändert werden), `types.ts` (die JSDoc von `IMap2DTileRenderer#clearTiles()` stimmt weiter), `TileSpritesFactory.ts`, alles außerhalb von `packages/twopoint5d/`.
- Verify: `pnpm run ci` (Repo-Root). Die roten Läufe vor den Fixes einzeln: `pnpm nx test twopoint5d -- src/map2d/<datei>.spec.ts` bzw. `pnpm typecheck` für den Typtest in Schritt B.
- Commit:

  ```
  fix(map2d)!: refuse a CameraBasedVisibility depth that is negative or not finite, hand out the cell of Map2DSpatialHashGrid#getTile() as a read-only set, keep a tile renderer on Map2DTileStreamer and Map2D while its clearTiles() throws, count a write of Map2DTileRenderer before the factory call that makes it, and name the primary-mark tests of CameraBasedVisibility after what they check

  BREAKING CHANGE: CameraBasedVisibility#depth is an accessor that throws a RangeError for a value that is negative or not finite, and Map2DSpatialHashGrid#getTile() answers a ReadonlySet.
  ```

- Verlauf:
  - 2026-09-28 Zug 0: Detailplan steht · Abgleich gegen `75a1278f`: `depth` unverändert `:297` (Gate `:499`/`:503`, `setBox()` `:1299`–`:1300`) · Testnamen unverändert `:913`/`:937` · `getTile()` verschoben nach `Map2DSpatialHashGrid.ts:195`–`:197` (Paket 7 hat `findWithin()`/`getTiles()` erweitert) · `removeTileRenderer()` unverändert `Map2DTileStreamer.ts:134`–`:137` · `removeTile()` unverändert `Map2DTileRenderer.ts:164`–`:166` · alle fünf vorbestehend (`e7767c6d`) · dazu gleiche Ursache, vorbestehend (`e7767c6d`): `Map2DTileRenderer.ts:98`/`:101`, `:145`–`:146`, `Map2D.ts:138`–`:144` · zwei kleine Reviewer-Befunde aus Paket 7 (`CHANGELOG.md:1837`, `:1877`–`:1882`) übernommen · Folgen offen: keine (alle erledigten Pakete `Folgen: keine`) · »Offene Befunde« danach ohne offenen Eintrag außerhalb dieses Pakets
  - 2026-09-28 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-9.impl-0.json`
  - 2026-09-28 Zug 2: Report FERTIG · 11 Dateien (`CameraBasedVisibility`, `Map2DSpatialHashGrid`, `Map2DTileStreamer`, `Map2D`, `Map2DTileRenderer` je samt Spec, `CHANGELOG.md`) · rote Läufe A3, B2, C3, C4, D2 belegt · Arbeitsbaum schmutzig · Verify `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 (`paket-9.verify.log`; der erste Lauf kam ganz aus dem Nx-Cache des Implementierers, `paket-9.verify-cached.log`)
  - 2026-09-28 Zug 3: Reviewer beauftragt (sonnet, effort medium), Diff `paket-9.diff`, Report nach `paket-9.review-0.json`
  - 2026-09-28 Zug 3: Reviewer »freigeben« · A–F erfüllt · kritisch 0, wichtig 0, klein 4 (unten) · Diff `paket-9.diff`
  - 2026-09-28 Zug 4: keine Runde (nichts offen)
  - 2026-09-28 Zug 5: Commit 28d2cff0 · Verify `paket-9.verify.log` exit=0, jünger als die letzte Codeänderung · Nebenbefund `Map2D.ts:29`–`:31` in »Offene Befunde«

## Abgleich (Zug 0, 2026-09-28, gegen `75a1278f`)

1. **`depth` ungeprüft** — besteht, `CameraBasedVisibility.ts:297` `depth = 100;`, ein öffentliches Feld. Gelesen im Dependency-Gate (`:499` Vergleich, `:503` Schreiben in `#seenScalars`) und in `setBox()` (`:1299`–`:1300`, `ground = this.depth * -0.5 * scale`, `ceiling = this.depth * 0.5 * scale`). Nachgesehen, was ein falscher Wert anrichtet:
   - negativ: `min.y > max.y`, three.js hält die Box für leer (`Box3#isEmpty()`: `max.y < min.y`), und `Box3#applyMatrix4()` gibt eine leere Box unverändert zurück — `updateFrustumBox()` (`:1150`–`:1154`) bringt die Frustum-Box dann nicht in den Weltraum, der Frustum-Test prüft die Box im Tile-Raum.
   - `NaN` oder `±Infinity`: nach `applyMatrix4()` stehen `NaN` (`0 · ∞`) bzw. unendliche Ecken in der Box; `Frustum#intersectsBox()` fragt `distanceToPoint(p) < 0` und lässt damit jedes Tile durch — die Suche läuft bis `maxVisibleTiles`. `NaN` hält dazu das Gate offen (`NaN !== NaN`): jede Neuberechnung zählt als Änderung.
   - `0`: `min.y === max.y`, `isEmpty()` ist `false`, die Box wird transformiert, der Frustum-Test prüft das flache Tile-Rechteck exakt. Der Beweis in der JSDoc von `searchCanStop()` braucht nur, dass die Boxen eine Schicht füllen, und gilt für eine Schicht der Dicke 0 ebenso. **Entscheidung:** `0` bleibt erlaubt — eine flache Karte ohne aufrechte Sprites ist ein legitimer Fall, und nichts teilt durch `depth`.
   - Lookbook, Browsertests, Doku: kein Schreiber von `depth` außerhalb der Spec (`grep` über `apps/lookbook/src`, `packages/twopoint5d-testing/test`, `packages/twopoint5d/docs`).
2. **Testnamen zu »primary«** — bestehen, `CameraBasedVisibility.spec.ts:913` `takes the primary mark off a pooled tile that no ray of the next recomputation met`, `:937` `leaves no tile marked as primary that no ray met`. Beide prüfen über `isNextToAProbe()` (`:177`–`:182`): ein Tile ist »neben einem Probe-Tile«, wenn es in x und y höchstens ein Tile von einem Tile entfernt liegt, das ein Strahl getroffen hat. Die Namen behaupten »von keinem Strahl getroffen«; geprüft wird »mehr als ein Tile von jedem getroffenen Tile entfernt«.
3. **`getTile()` gibt die veränderliche Zelle heraus** — besteht, verschoben: `Map2DSpatialHashGrid.ts:195`–`:197` `getTile(tileX, tileY): Set<Renderable> | undefined { return this.#cells.get(tileX, tileY)?.renderables; }`, ohne JSDoc. Das `Set` ist `GridCell#renderables` (`:20`–`:22`); `#takeOut()` (`:127`–`:138`) räumt die Zellen über `Placement#cells` und entfernt eine leere Zelle aus der Tabelle — ein `add()`/`delete()`/`clear()` des Aufrufers geht daran vorbei. Eine Kopie scheidet aus: `CHANGELOG.md:271` sagt zu, dass `getTile()` nichts alloziert, und `hot-path-allocations.spec.ts:240` hält es fest. `getTile()` steht seit 2025 in der öffentlichen API (`public-api.ts:7`), also Typänderung mit Migrationshinweis. Aufrufer im Repo: nur die Specs (`Map2DSpatialHashGrid.spec.ts` liest `?.has()`, `hot-path-allocations.spec.ts:252` vergleicht mit `undefined`) — beide kompilieren gegen `ReadonlySet`.
4. **`removeTileRenderer()` löst vor `clearTiles()`** — besteht, `Map2DTileStreamer.ts:134`–`:137`: `if (this.renderers.delete(renderer)) { this.#laidOutSerials.delete(renderer); renderer.clearTiles(); }`. Seit Paket 7 verlässt jedes Tile `#tiles` vor seinem `destroyTile()` (`Map2DTileRenderer.ts:186`–`:189`), ein zweiter `clearTiles()` gibt also genau die übrigen zurück — nur erreicht der Streamer den Renderer dann nicht mehr.
5. **`removeTile()` zählt den Serial nach `destroyTile()`** — besteht, `Map2DTileRenderer.ts:164`–`:166`. `clearTiles()` zählt seit Paket 7 vor der Schleife (`:177`–`:182`, mit Begründung im Kommentar); `removeTile()` nicht.

In Zug 0 dazu, **gleiche Ursache** (vorbestehend, nachgesehen mit `git show e7767c6d:…`):

6. `Map2DTileRenderer.ts:98`/`:101` (`addTile()` auf eine gehaltene Koordinate) und `:145`–`:146` (`reuseTile()`): `++this.#dataSerial` erst nach `updateTile()`. `TileSpritesFactory#updateTile()` schreibt die Position und markiert den Slot (`TileSpritesFactory.ts:110`–`:122`); wirft eine Factory nach dem Schreiben, geht der Upload verloren wie bei `removeTile()`. Ursache in allen drei Methoden: der Renderer zählt einen Schreibvorgang erst, wenn der Factory-Aufruf zurückgekommen ist. `createTile()` bleibt, wie es ist: vor seiner Antwort weiß der Renderer nicht, ob geschrieben wurde (`noTileCapacity` und `undefined` schreiben nichts, `:109` und `:114`).
7. `Map2D.ts:138`–`:144` `removeTileRenderer()`: `this.remove(renderer.node)` vor `this.#tileStreamer.removeTileRenderer(renderer)`. Nach dem Fix von Punkt 4 bliebe ein Renderer, dessen `clearTiles()` wirft, am Streamer und in `#renderers` der Karte, aber ohne Knoten in der Szene — er bekäme Tiles, die niemand sieht. Dieselbe Reihenfolge-Ursache wie Punkt 4. `Map2D#tileStreamer` (Setter, `:24`–`:57`) und `Map2D#dispose()` (`:169`–`:176`) brauchen keine eigene Änderung: `Map2DTileStreamer#removeTileRenderer()` ist für einen schon gelösten Renderer ein No-op, ein zweiter Aufruf setzt nach dem Fix dort fort, wo der erste geworfen hat.

**Kleine Reviewer-Befunde aus Paket 7**, übernommen, weil dieses Paket dieselben Abschnitte des Migration Guide ergänzt (Vorbild: Paket 6 mit den kleinen Befunden aus Paket 5):

8. `CHANGELOG.md:1837` — »A material handed in as options never had an effect« stimmt nicht: das fremde Material wurde als Parameterobjekt gelesen (`name`, `transparent`, `blending` …); der Changed-Eintrag `:60` sagt es richtig.
9. `CHANGELOG.md:1877`–`:1882` — der »After«-Block des Abschnitts »`Map2DSpatialHashGrid` refuses an aabb that is not finite« zeigt nach dem abgesicherten `add()` ein zweites `grid.add(renderable); // → RangeError …` und liest sich wie die Empfehlung, beides zu tun. Der neue `getTile()`-Abschnitt kommt direkt dahinter.

Nicht übernommen (andere Dateien, keine Textüberschneidung; sie stehen in den `Ergebnis:`-Zeilen von Paket 7 und 8 für den Abschluss): `AnimatedSpritesMaterial.spec.ts:106`, `:110` »a AnimatedSpritesMaterial«, `AGENTS.md:114` Bezug »for it«, Kommentar `src/sprites/hot-path-allocations.spec.ts:45` mit Positionsverweis.

## Vorgehen

Pro Schritt: erst den Regressionstest schreiben und rot sehen (Ausgabe in den Report), dann beheben. Testnamen englisch, im Stil der Datei. Kommentare erklären das *Warum*, ohne Rückblick auf den Vorzustand, ohne Befund- oder Paketnummern.

### A. `CameraBasedVisibility#depth` wird ein geprüfter Accessor

A1. In `CameraBasedVisibility.ts` das Feld `depth = 100;` (`:297`) ersetzen durch ein privates Feld `#depth = 100;` mit Getter und Setter nach dem Muster von `frustumBoxScale` (`:227`–`:251`), platziert an der Stelle des alten Felds:

```ts
#depth = 100;

/**
 * How high the box of a tile is along the y axis of the map node's local space — the normal of the
 * map plane: the box reaches `depth / 2` above and below the plane, and the box the view frustum is
 * tested against `frustumBoxScale` times as far. Sprites that stand up from the map need a depth
 * that holds them, or the tiles they stand on leave the view while the sprites are still in it. `0`
 * tests the flat tile.
 *
 * Takes a finite number of at least 0 and throws a `RangeError` for anything else, keeping the
 * value it had: a negative depth turns the box inside out, which three.js takes for an empty box
 * and leaves where it is when it transforms it, and a depth that is not finite lets every tile
 * through the frustum test. A new value recomputes on the next call.
 */
get depth(): number {
  return this.#depth;
}

set depth(value: number) {
  if (!(Number.isFinite(value) && value >= 0)) {
    throw new RangeError(`[CameraBasedVisibility] depth must be a finite number of at least 0, got ${describeValue(value)}`);
  }
  this.#depth = value;
}
```

Die JSDoc darf sprachlich nachgeschärft werden; jede Aussage darin muss stimmen (die Befunde aus dem Abgleich, Punkt 1, sind die Grundlage).

A2. Im Gate `dependenciesChanged()` (`:499`, `:503`) und in `setBox()` (`:1299`–`:1300`) `this.#depth` statt `this.depth` lesen — dieselbe Lesart wie `this.#frustumBoxScale` daneben. Die Kommentare `:352` und `:372` (»The scalars — `depth`, …«) stimmen weiter.

A3. Tests in `CameraBasedVisibility.spec.ts`, neuer Block `describe('depth', …)` direkt nach `describe('frustumBoxScale', …)` (vor `describe('maxVisibleTiles', …)`, heute `:1186`):
- `defaults to 100` — `expect(new CameraBasedVisibility().depth).toBe(100)`.
- `refuses anything but a finite number of at least 0` — erst `visibility.depth = 42`, dann für `[-0.5, -1, -100, NaN, Infinity, -Infinity]` je `toThrow(RangeError)` und `expect(visibility.depth, …).toBe(42)`; die Meldung einmal wörtlich: `visibility.depth = -1` wirft `'[CameraBasedVisibility] depth must be a finite number of at least 0, got -1'`; danach `visibility.depth = 0` → `0`. **Rot vor dem Fix** (das Feld nimmt alles an).
- `a depth of 0 tests the flat tile` — `makeTopDownCamera()`, `depth = 0`, `computeVisibleTiles([], [0, 0], new Map2DTileCoordsUtil(100, 100), new Matrix4())`; erwartet `visibles.length > 0` und für jedes Tile `box.max.y - box.min.y === 0` und `frustumBox.max.y - frustumBox.min.y === 0` (Differenz prüfen, nicht `toBe(0)` auf den Ecken — `0 * -0.5` ist `-0`). Vor dem Fix grün (Charakterisierung, dass `0` trägt).
- Der bestehende Test `a changed depth invalidates the cached tile set` (`:735`) bleibt unverändert und muss grün bleiben.

### B. `Map2DSpatialHashGrid#getTile()` gibt die Zelle nur lesend heraus

B1. `Map2DSpatialHashGrid.ts:195`: Rückgabetyp `ReadonlySet<Renderable> | undefined`, Rumpf unverändert (keine Kopie — `getTile()` alloziert nichts, `hot-path-allocations.spec.ts:240` hält es fest). JSDoc neu:

```ts
/**
 * The renderables in the cell at `(tileX, tileY)`, or `undefined` when nothing lies there.
 *
 * The set is the one the grid keeps for the cell, handed out read-only and without a copy, so the
 * lookup allocates nothing. Only {@link add} and {@link remove} change it, and a cell that loses
 * its last renderable leaves the grid with its set emptied: a caller that keeps the answer past
 * the next `add()` or `remove()` takes a copy.
 */
```

`GridCell#renderables` (`:21`) bleibt `Set<Renderable>` — der Grid schreibt hinein.

B2. Typtest in `Map2DSpatialHashGrid.spec.ts` nach dem Muster von `TexturedSprites.spec.ts:164`–`:174`: `test('getTile() hands out the set of a cell read-only (a type-level check)', …)` mit einer nie aufgerufenen Funktion, darin `// @ts-expect-error the grid alone writes the set of a cell` vor `grid.getTile(0, 0)?.add(renderable)`, dazu `void …`. **Rot vor dem Fix:** `pnpm typecheck` meldet TS2578 (unbenutztes `@ts-expect-error`). Ein Laufzeittest dazu entfällt: am Verhalten ändert sich nichts.

### C. Ein Renderer, dessen `clearTiles()` wirft, bleibt am Streamer und an der Karte

C1. `Map2DTileStreamer.ts` `removeTileRenderer()` (`:130`–`:138`) umstellen:

```ts
removeTileRenderer(renderer: IMap2DTileRenderer): void {
  if (!this.renderers.has(renderer)) return;
  // <bestehender Kommentar »only update() takes a tile out of a renderer again …« bleibt>
  // forgotten before the clear: a renderer whose clearTiles() throws stays here, and without a
  // laid-out serial it goes through the next update, which lays out the whole tile set in it again
  this.#laidOutSerials.delete(renderer);
  renderer.clearTiles();
  // off only once clearTiles() has come back: a renderer let go with tiles it had yet to give back
  // would keep them, and nothing but a clearTiles() of the caller would reach them again
  this.renderers.delete(renderer);
}
```

Die Reihenfolge `#laidOutSerials.delete()` **vor** `clearTiles()` ist tragend: ein fremder `IMap2DTileRenderer` mit `hasPendingTiles === false` würde sonst im nächsten `update()` übersprungen.

JSDoc von `removeTileRenderer()` (`:124`–`:129`) um einen Absatz ergänzen: wirft `clearTiles()`, bleibt der Renderer an diesem Streamer und der Fehler geht unverändert weiter; ein zweiter Aufruf gibt die übrigen Tiles zurück und nimmt ihn ab, und ein {@link update} dazwischen legt die ganze Tile-Menge wieder in ihm aus.

C2. `Map2D.ts` `removeTileRenderer()` (`:138`–`:144`): erst `this.#tileStreamer.removeTileRenderer(renderer)`, danach `this.remove(renderer.node)` und `this.#renderers.delete(renderer)` — ein Wurf lässt die Karte dann so, wie sie war. Kurzer Kommentar mit dem Warum. JSDoc (`:133`–`:137`) um einen Satz: wirft das `clearTiles()` des Renderers, bleibt er an der Karte — Knoten, Streamer und alles — und der Fehler geht weiter; ein zweiter Aufruf nimmt ihn ab.

C3. Tests in `Map2DTileStreamer.spec.ts`, Block `describe('removeTileRenderer()', …)` (`:202`):
- `keeps a renderer whose clearTiles() throws, and takes it off on the next call` — ein `makeRecordingRenderer()`, dessen `clearTiles()` beim ersten Aufruf nur `'0,0'` aus `held` nimmt und dann `throw new Error('the tile set is gone')` wirft, ab dem zweiten Aufruf wie das Original leert, mit `makeCachingVisibilitor([tileA, tileB])` und einem `update()` davor. Erwartet: erster `removeTileRenderer()` wirft genau diesen Fehler, `streamer.renderers.has(renderer)` ist `true`; zweiter Aufruf wirft nicht, `renderer.held.size === 0`, `renderers.has(renderer)` ist `false`. **Rot vor dem Fix** (`renderers.has` ist nach dem Wurf `false`).
- `a renderer whose clearTiles() threw gets the whole tile set in the next update` — `makeReportingRenderer(false)` (meldet nie `hasPendingTiles`), `makeNamingVisibilitor([tileA, tileB])`, ein `update()`, dann `clearTiles()` des Renderers so präparieren, dass er alle Tiles aus `held` entfernt und danach einmal wirft; `removeTileRenderer()` wirft; ein weiteres `streamer.update(node)` (der Visibilitor gibt dasselbe Ergebnis mit demselben `serial` zurück); erwartet `[...renderer.held].sort()` gleich `['0,0', '1,0']`. **Rot vor dem Fix** (der Renderer ist gelöst, `held` bleibt leer). Fängt auch die falsche Reihenfolge von `#laidOutSerials.delete()` nach `clearTiles()`.

C4. Test in `Map2D.spec.ts`, Block `describe('removeTileRenderer()', …)` (`:95`):
- `keeps a renderer whose clearTiles() throws on the map, and takes it off on the next call` — `makeHoldingTileRenderer()` mit einem `clearTiles()`, das beim ersten Aufruf wirft; `map.addTileRenderer(renderer)`; erster `map.removeTileRenderer(renderer)` wirft, danach `renderer.node.parent === map` und `map.tileStreamer.renderers.has(renderer)`; zweiter Aufruf wirft nicht, danach `renderer.node.parent === null` und `map.tileStreamer.renderers.has(renderer) === false`. **Rot vor dem Fix** (`node.parent` ist nach dem Wurf `null`).

### D. `Map2DTileRenderer` zählt einen Schreibvorgang vor dem Factory-Aufruf, der ihn macht

D1. `Map2DTileRenderer.ts`:
- `removeTile()` (`:162`–`:167`): `++this.#dataSerial` vor `tileFactory.destroyTile(tile)`; `this.#tiles.delete(tileCoords.id)` bleibt davor (das Tile geht genau einmal zurück).
- `addTile()`, Zweig für eine gehaltene Koordinate (`:96`–`:103`): `++this.#dataSerial` vor `tileFactory.updateTile(existing, tileCoords)`; den Kommentar `:99`–`:100` entsprechend anpassen.
- `reuseTile()` (`:145`–`:146`): `++this.#dataSerial` vor `tileFactory.updateTile(tile, tileCoords)`.
- Ein Kommentar an einer der drei Stellen (die übrigen verweisen darauf oder bleiben knapp), im Ton von `:177`–`:181`: gezählt vor dem Aufruf, weil eine Factory, die wirft, schon geschrieben oder einen Slot freigegeben haben kann, und dieser Upload nicht verloren gehen darf; ein Aufruf, der nichts geschrieben hat, kostet höchstens einen Upload.
- `createTile()` in `addTile()` bleibt unverändert (Abgleich Punkt 6).

D2. Tests in `Map2DTileRenderer.spec.ts`, neuer Block `describe('a factory that throws after it wrote', …)` nach `describe('endUpdatingTiles()', …)` (`:393`), je mit `sandbox.spy(tileFactory, 'update')` und dem Muster aus `:356`–`:391`:
- `removeTile() uploads the slot a destroyTile() that threw gave back` — Zyklus 1: `addTile(a)`, `endUpdatingTiles()`; Zyklus 2: `beginUpdatingTiles(new Vector3(), false)`, `removeTile(a)` wirft (Factory-`destroyTile()` wirft einmal), `endUpdatingTiles()`; erwartet `update.callCount === 2`. **Rot vor dem Fix** (1).
- `addTile() on a coordinate it holds uploads what an updateTile() that threw wrote` — dasselbe mit `addTile(a)` im zweiten Zyklus und einem `updateTile()`, das einmal wirft. **Rot vor dem Fix.**
- `reuseTile() uploads what an updateTile() that threw wrote` — zweiter Zyklus mit `beginUpdatingTiles(new Vector3(), true)` und `reuseTile(a)`. **Rot vor dem Fix.**

### E. Testnamen zu »primary«

In `CameraBasedVisibility.spec.ts` nur die Namen, Assertions und `isNextToAProbe()` unverändert:
- `:913` → `takes the primary mark off a pooled tile more than one tile away from every tile a ray of the next recomputation met`
- `:937` → `leaves no tile marked as primary more than one tile away from every tile a ray met`

Kein roter Lauf (reine Umbenennung). Kommentare und Assertion-Meldungen der beiden Tests stimmen weiter und bleiben.

### F. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`, Skill `updating-changelog`)

F1. `### Changed`, direkt nach dem Eintrag zu `frustumBoxScale` (`:187`), zwei neue Einträge:
- `` - `CameraBasedVisibility#depth` takes a finite number of at least 0 and throws a `RangeError` for anything else, keeping the value it had: a negative depth turns the box of a tile inside out, which three.js takes for an empty box and leaves where it is when it transforms it, and a depth that is not finite lets every tile through the frustum test. `0` tests the flat tile. See the Migration Guide ``
- `` - `Map2DSpatialHashGrid#getTile()` answers `ReadonlySet<Renderable> | undefined`: the set the grid keeps for the cell, which only `add()` and `remove()` change — a write into it goes past the placements the grid takes a renderable out of the cells by, and past the removal of an empty cell. See the Migration Guide ``

F2. `### Fixed`, zwei bestehende Einträge ergänzen (nicht neu anlegen):
- `:440` (`fix Map2DTileStreamer#removeTileRenderer(), and with it Map2D#removeTileRenderer(): …`) am Ende: `` When `clearTiles()` throws, the renderer stays on the streamer and on the map, and the error goes on: a second call gives back the tiles that remain and takes it off, and an `update()` in between lays out the whole tile set in it again ``
- `:465` (`fix Map2DTileRenderer when the update() of its factory throws: …`) am Ende: `` `removeTile()` counts the slot a `destroyTile()` gave back before it threw, and `addTile()` and `reuseTile()` what an `updateTile()` wrote before it threw, so the next `endUpdatingTiles()` uploads it ``

F3. `### Migration Guide`, zwei neue Abschnitte:
- direkt nach »`CameraBasedVisibility#frustumBoxScale` takes nothing below 1« (`:3101`–`:3120`, also unmittelbar vor `## [0.21.2]`): `#### \`CameraBasedVisibility#depth\` takes nothing below 0` — Absatz wie beim `frustumBoxScale`-Abschnitt (Regel, was ein negativer bzw. nicht endlicher Wert anrichtet), Absatz »`depth` is an accessor: a subclass sets the value in its constructor rather than declaring the property, which TypeScript refuses with TS2610.«, dann **Before** `visibility.depth = -100;` und **After** `visibility.depth = 100; // 50 below the map plane and 50 above it` (Blöcke als schlichtes `ts`, wie im `frustumBoxScale`-Abschnitt).
- direkt nach »`Map2DSpatialHashGrid` refuses an aabb that is not finite« (`:1861`–`:1882`): `#### \`Map2DSpatialHashGrid#getTile()\` hands out a read-only set` — Absatz: der Rückgabetyp; Lesen bleibt gleich (`has()`, `size`, Iteration); was nicht mehr kompiliert, ist ein Schreibzugriff und die Übergabe an eine Signatur, die ein `Set` verlangt; wer die Antwort über das nächste `add()`/`remove()` hinaus hält oder beschreiben will, kopiert sie (Sprachvorbild: »The containers a geometry and a descriptor hand out are read-only«, `:476`–`:480`). **Before** `grid.getTile(0, 0)?.delete(renderable);` **After** `grid.remove(renderable);`.

F4. Die beiden kleinen Texte aus Paket 7:
- `:1836`–`:1837`: den Satz »A material handed in as options never had an effect and goes away.« ersetzen durch einen Satz, der stimmt — das fremde Material wurde als Parameterobjekt gelesen (sein `name`, `transparent`, `blending` und dergleichen), nie als Material; wer eines übergibt, lässt es weg bzw. übergibt die Parameter selbst. Der Changed-Eintrag `:60` ist die Referenz für den Sachverhalt.
- `:1877`–`:1882`: aus dem **After**-Block die Leerzeile und die Zeile `grid.add(renderable); // → RangeError: …` entfernen; der Block zeigt nur noch das abgesicherte `add()`. Der Absatz darüber nennt den `RangeError` schon.

Nach allen Schritten: `pnpm format` für die geänderten Dateien, dann `pnpm run ci`.

## Findings im Volltext

**Nebenbefund · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:297`** — das öffentliche Feld `depth = 100` nimmt jeden Wert an, auch 0, negative Zahlen und `NaN`; `setBox()` (`:1299`–`:1300`) baut daraus Boxen ohne Höhe oder mit vertauschtem Boden und Decke, anders als `frustumBoxScale` und `maxVisibleTiles` ohne Prüfung (vorbestehend — so schon in `93628b3c~1` `:148` —, gefunden in Paket 6 Zug 2) · → Scope
Empfehlung (aus dem Befund): Prüfung wie bei `frustumBoxScale`. Abweichung in Zug 0: `0` bleibt erlaubt (Abgleich Punkt 1).

**Nebenbefund · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts:913` und `:937`** — die Testnamen `takes the primary mark off a pooled tile that no ray of the next recomputation met` und `leaves no tile marked as primary that no ray met` lesen »primary« als »von einem Strahl direkt getroffen«, die Tests prüfen über `isNextToAProbe()` die weitere Lesart des JSDoc von `TileBox#primary` (je Strahl bis zu vier Tiles eines Rechtecks von Tile-Größe) (Testnamen, vorbestehend — stehen unverändert vor Paket 6 —, gefunden im Review von Paket 6 Runde 1) · → Scope

**Nebenbefund · low · `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:159`–`:161`** (jetzt `:195`–`:197`) — `getTile()` gibt das `Set` der Zelle selbst heraus, typisiert als veränderliches `Set<Renderable>`; ein `add()`, `delete()` oder `clear()` des Aufrufers ändert den Grid an seiner Buchführung vorbei (die Zellen-Liste je Renderable, das Entfernen leerer Zellen); `ReadonlySet<Renderable>` als Rückgabetyp schlösse es beim Typcheck (vorbestehend — so schon in `e7767c6d` `:149`–`:152` —, gefunden in Paket 7 Zug 0) · → Scope

**Nebenbefund · low · `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:134`–`:136`** — `removeTileRenderer()` nimmt den Renderer aus `renderers`, bevor es dessen `clearTiles()` ruft; wirft ein `destroyTile()` darin, ist der Renderer schon gelöst und behält die noch nicht zurückgegebenen Tiles, aufräumen kann nur ein weiterer direkter `renderer.clearTiles()` des Aufrufers (vorbestehend — so schon in `e7767c6d` `:127` —, gefunden in Paket 7 Zug 2) · → Scope

**Nebenbefund · low · `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:165`–`:166`** — `removeTile()` erhöht `#dataSerial` erst nach `destroyTile()`; wirft `destroyTile()`, nachdem es den Slot freigegeben hat, geht dessen Upload verloren, solange der Renderer ohne Streamer benutzt wird (unter dem Streamer räumt das `clearTiles()` nach dem Wurf) (vorbestehend — so schon in `e7767c6d` `:125`–`:126` —, gefunden im Review von Paket 7) · → Scope

**In Zug 0 dazu (gleiche Ursache, vorbestehend in `e7767c6d`):** `Map2DTileRenderer.ts:98`/`:101` und `:145`–`:146` — `#dataSerial` erst nach `updateTile()`; `Map2D.ts:138`–`:144` — `removeTileRenderer()` nimmt den Knoten ab, bevor der Streamer den Renderer leert. Einzelheiten im Abgleich, Punkte 6 und 7.

**Kleine Reviewer-Befunde aus Paket 7:** `CHANGELOG.md:1837` Migration Guide »never had an effect« (sachlich falsch); `CHANGELOG.md:1877`–`:1882` »After«-Block mit zweitem, werfendem `add()`. Einzelheiten im Abgleich, Punkte 8 und 9.

## Anmerkungen

- Urteile: alle fünf Nebenbefunde → Scope (`src/map2d/`), vorbestehend, in dieses Paket laut Plan (zweite Drain-Runde). Die zwei Stellen aus Punkt 6 und 7 teilen die Ursache mit `Map2DTileRenderer.ts:165` bzw. `Map2DTileStreamer.ts:134` und gehören deshalb hierher, nicht in die Queue.
- Commit mit `!` und `BREAKING CHANGE:`-Footer wie Paket 6 und 7: `depth` wirft für Werte, die vorher still angenommen wurden, und der Rückgabetyp von `getTile()` wird enger.
- Modell mittlere Stufe, Effort medium: lokale Bugfixes samt Regressionstests über fünf Dateien, Schritte und Texte stehen hier; die öffentliche Oberfläche bewegt sich nur an zwei genau benannten Stellen.

## Review (Zug 3, 2026-09-28, `paket-9.review-0.json`)

Urteil je Nebenbefund:
- `CameraBasedVisibility.ts:297` `depth` — behoben: `#depth` mit Getter/Setter, `RangeError` für negativ/nicht endlich, `0` erlaubt; Gate `dependenciesChanged()` und `setBox()` lesen `#depth`; Tests in `describe('depth')` nach `frustumBoxScale`.
- `CameraBasedVisibility.spec.ts:913`/`:937` Testnamen — behoben, Namen wie vorgegeben, Assertions und `isNextToAProbe()` unverändert.
- `Map2DSpatialHashGrid.ts:195` `getTile()` — behoben: `ReadonlySet<Renderable> | undefined` (`:195`–`:205`), ohne Kopie; Typtest mit `@ts-expect-error` in der Spec.
- `Map2DTileStreamer.ts:134` `removeTileRenderer()` — behoben (`:133`–`:147`): `#laidOutSerials.delete()`, `clearTiles()`, dann `renderers.delete()`; der Test mit `hasPendingTiles === false` hängt an dieser Reihenfolge.
- `Map2DTileRenderer.ts:165` `removeTile()` — behoben, dazu `addTile()` auf gehaltener Koordinate und `reuseTile()`; `createTile()` unverändert.
- `Map2D.ts:138` `removeTileRenderer()` — behoben (`:138`–`:146`), Streamer zuerst.
- CHANGELOG — Changed-, Fixed- und Migration-Guide-Einträge wie vorgegeben; die zwei Texte aus Paket 7 korrigiert.

Kleine Befunde (keine Runde):
- `CHANGELOG.md:86`–`:87`: ein eingefügter Satz macht eine Zeile sehr lang, der Umbruch des Absatzes ist unregelmäßig.
- `Map2D.ts:170` JSDoc von `dispose()`: »A second call does nothing« gilt nicht, wenn das `clearTiles()` eines Renderers geworfen hat — der zweite Aufruf setzt dann fort. Galt schon vor dem Paket nicht (damals blieb der Renderer in `#renderers`), deshalb klein.
- CHANGELOG, Changed-Eintrag `depth`: dass `NaN` das Gate offen hält, steht nur im Detailplan; alle Aussagen dort stimmen.
- `prettier --check` meldet `CHANGELOG.md` an vorbestehenden Codeblöcken (um `:818`, `:842`, `:1019`), die in `HEAD~1` gleich stehen; nicht aus diesem Diff.

Abweichungen des Implementierers (vom Reviewer mitgetragen): D2 erwartet `update.callCount === 1`, weil der Spy erst nach Zyklus 1 sitzt (vor dem Fix `0`); eigener Helper `makeThrowingFactory()`; F4 an dem Changed-Eintrag `CHANGELOG.md:263` ausgerichtet, weil der Verweis `:60` verschoben war.

Nebenbefund des Implementierers, Urteil: `Map2D.ts:29`–`:31` Setter `tileStreamer` lässt nach einem werfenden `clearTiles()` die zuvor abgenommenen Renderer ohne Streamer zurück — vorbestehend (`e7767c6d` `:29`–`:31`), Map2D und damit in der Scope-Regel → Scope; nicht mitgenommen, weil Zug 0 den Setter ausdrücklich ausgenommen hat. Ebenfalls gemeldet und bewusst stehen gelassen: der Kommentar »only update() takes a tile out …« in `Map2DTileStreamer.ts` steht über der Guard-Zeile, erklärt aber das `clearTiles()` darunter — die Paketdatei schreibt seinen Verbleib vor.
