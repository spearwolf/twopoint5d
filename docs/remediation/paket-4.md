# Paket 4 — Map2D: Streamer, Tile-Factory, Spatial Hash, Quad-Tree, Helper-Neuaufbau, Spec-Isolation

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-010 (low), PERF-011 (low), PERF-012 (low), PERF-013 (low), TEST-049 (low) · dazu der
  Nebenbefund `CameraBasedVisibilityHelpers.ts:321`–`:329`, `:154`–`:157`, `:164` aus »Offene Befunde«
  (gleiche Ursache wie der Helper-Teil von PERF-011: der Neuaufbau der Helper alloziert im Frame-Takt)
- Ziel: Die Map2D-Hilfsstrukturen neben der Sichtbarkeit und die Debug-Helper der Kamerasichtbarkeit
  arbeiten ohne vermeidbare Durchläufe und Allokationen — ein stehender Blick kostet den Streamer keinen
  Durchlauf über die Tiles —, und ihre Specs laufen unabhängig von der Reihenfolge.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/map2d/types.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` samt `.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts` samt `.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` (nur die zwei Ergebnisblöcke und das JSDoc
    von `serial`) samt `.spec.ts`
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts` samt `.spec.ts`
  - `packages/twopoint5d/src/utils/expectDefined.ts`
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts` samt `.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts` samt `.spec.ts`, JSDoc in `tileKeys.ts`,
    `Map2DTileCoords.ts`, `TileSlotTable.ts`
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` samt `.spec.ts`, neu
    `packages/twopoint5d/src/map2d/chunk-quad-tree/hot-path-allocations.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`
  - `packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts` (nur neue `describe`-Blöcke anhängen;
    die bestehenden Tests dort bleiben unangetastet, siehe »Nicht in diesem Paket«)
  - `packages/twopoint5d/src/map2d/AABB2.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: siehe Abschnitte A bis G unten. Reihenfolge A → G; innerhalb jedes Abschnitts erst der
  rote Test, dann der Umbau. Jeder rote Lauf gehört mit Testname und Messwert in den Report.
- Verify (vom Repo-Root, eine Zeile):
  `pnpm run ci && (cd packages/twopoint5d && for s in 1 2 3 4 5 6 7 8; do pnpm vitest --run src/map2d/AABB2.spec.ts src/map2d/chunk-quad-tree src/map2d/Map2DTileStreamer.spec.ts src/map2d/Map2DTileRenderer.spec.ts src/map2d/Map2DSpatialHashGrid.spec.ts src/map2d/TileSprites src/map2d/CameraBasedVisibility.spec.ts src/map2d/CameraBasedVisibilityHelpers.spec.ts src/map2d/RectangularVisibilityArea.spec.ts --sequence.shuffle --sequence.seed=$s || exit 1; done && pnpm vitest --run src/map2d/hot-path-allocations.spec.ts -t "getTile\(\) allocates nothing" && pnpm vitest --run src/map2d/hot-path-allocations.spec.ts -t "finds nothing to rebuild" && pnpm vitest --run src/map2d/hot-path-allocations.spec.ts -t "a rebuild allocates nothing" && pnpm vitest --run src/map2d/chunk-quad-tree/hot-path-allocations.spec.ts -t "with an out array")`
  — der Shuffle-Teil lässt `src/map2d/hot-path-allocations.spec.ts` bewusst aus (dessen zwei
  Per-Tile-Tests sind reihenfolgeabhängig, das ist Paket 5); die vier neuen Allokationstests laufen
  dafür je einzeln.
- Commit: `perf(map2d): let Map2DTileStreamer leave a tile renderer out of the update cycle while the visibilitor hands back the result it laid out, ask the instanced pool before the tile set in TileSpritesFactory#createTile(), find the cells of Map2DSpatialHashGrid by coordinate, let ChunkQuadTreeNode#findChunksAt() append to an out array, rebuild CameraBasedVisibilityHelpers without allocations, and let the AABB2 and ChunkQuadTreeNode specs run in any order`
  — kein `!`, kein `BREAKING CHANGE:`: alle Änderungen an der Oberfläche sind additiv, dazu eine
  Deprecation.
- Verlauf:
  - 2026-09-28 Zug 0: Detailplan steht · PERF-010 umgeformt (Streamer-Schleife `Map2DTileStreamer.ts:164`–`:172`
    unverändert; Cache-Pfade durch 3/3b nach `CameraBasedVisibility.ts:550`–`:557` und
    `RectangularVisibilityArea.ts:154`–`:160` gewandert, beide geben seit 3b ein geteiltes `#result`
    zurück) · PERF-011 unverändert (`TileSpritesFactory.ts:59`–`:82`; Template-String im optimierten
    Code gemessen 0,01 B je Aufruf auf vollem Pool — die Kosten sind die Lookups) · PERF-012 unverändert
    (`Map2DSpatialHashGrid.ts:150`, `:55`, `:102`; gemessen `getTile()` 48 B je Aufruf,
    `findWithin(aabb, out)` 1 960 B) · PERF-013 unverändert (`ChunkQuadTreeNode.ts:335`–`:349`; 536 B je
    Aufruf bei Tiefe 4) · TEST-049 unverändert, zweite Fundstelle `ChunkQuadTreeNode.spec.ts:137`
    dazu · Nebenbefund Helper-Allokationen ins Paket genommen (gemessen 112 B je `update()` ohne
    Neuaufbau, 681 B je Neuaufbau bei 16 Tiles) · Folge aus 3b (Per-Tile-Tests in
    `src/map2d/hot-path-allocations.spec.ts:180`/`:191` reihenfolgeabhängig) → Paket 5 geschnitten ·
    zwei neue Nebenbefunde in die Queue (`Map2DSpatialHashGrid.ts:133` `Set.clear()`,
    `ChunkQuadTreeNode.spec.ts:77`–`:80` Testnamen)
  - 2026-09-28 Zug 1: Implementierer beauftragt, opus, Effort high, Brief `paket-4.impl-0.brief.txt`, Report `paket-4.impl-0.json`
  - 2026-09-28 Zug 2: Report FERTIG (Session `33fd14a7-17a3-4ca9-88f6-2807667854dc`), 23 Dateien geändert, neu `src/map2d/chunk-quad-tree/hot-path-allocations.spec.ts`, rote Läufe `paket-4.impl-red-{A-streamer,A-renderer,A-visibilitors,B,C,D,E,F}.txt` · Arbeitsbaum schmutzig · Verify exit=0 (`paket-4.verify.log`; CI weitgehend aus dem Nx-Cache), ungecacht `src/map2d src/utils` exit=0, 34 Dateien (`paket-4.verify-map2d-nocache.log`)
  - 2026-09-28 Zug 3: Reviewer beauftragt, opus, Effort high, Diff `paket-4.diff`, Brief `paket-4.review-0.brief.txt`, Report `paket-4.review-0.json` · Urteil: freigegeben — PERF-010, PERF-011, PERF-012, PERF-013, TEST-049, N1 behoben; fünf kleine Befunde: `#laidOutSerials` starke `Map` hält am `Set` vorbei entfernte Renderer (`Map2DTileStreamer.ts:51`), toter `{@link}` (`:146`), doppelte Leerzeilen im CHANGELOG (`:69`, `:273`, `:286`), `hasPendingTiles` übersieht `addTile()`/`removeTile()` außerhalb eines Zyklus (`Map2DTileRenderer.ts:52`), Neuaufbau-Test prüft nicht, dass neu aufgebaut wurde (`hot-path-allocations.spec.ts:345`)
  - 2026-09-28 Zug 4 Runde 1: Befunde 1 und 4 vom Runner als wichtig eingestuft (Folgen des eigenen Diffs: Leck bzw. ein Fall, den der Reuse-Durchlauf reparierte), 2, 3, 5 mitgegeben · per Resume an Session `33fd14a7-17a3-4ca9-88f6-2807667854dc`, opus, Effort high, Brief `paket-4.impl-1.brief.txt`, Report `paket-4.impl-1.json` · zurück: FERTIG, alle fünf bearbeitet — `#laidOutSerials` als `WeakMap` (Test über `WeakRef`/`gc()`), Typ-Import für den `{@link}`, CHANGELOG-Leerzeilen, eigene Marken `#changedOutsideCycle`/`#updating` in `Map2DTileRenderer` für `addTile()`/`reuseTile()`/`removeTile()` außerhalb eines Zyklus, Spy auf `createHelpers` nach der Messung; 6 Tests vor dem Fix rot (`paket-4.impl-red-r1.txt`) · Verify exit=0 (`paket-4.verify-1.log`), ungecacht `src/map2d src/utils` 702/702 (`paket-4.verify-1-map2d-nocache.log`) · Nach-Review opus, Effort high, Diff `paket-4.diff-1`, Report `paket-4.review-1.json` · Urteil: nicht freigegeben — Befunde 1–5 erledigt; neu wichtig: ein Zyklus, der mit einer Exception abbricht, lässt den Renderer bei stehendem Blick unvollständig (`Map2DTileRenderer.ts:78`–`:80`, `Map2DTileStreamer.ts:189`–`:203`; `#updating` bleibt `true`); klein: `docs/architecture.md:162`–`:172` nennt das Auslassen nicht
  - 2026-09-28 Zug 4 Runde 2: offen der Abbruch-Rand und `architecture.md` · frischer Implementierer, opus (stärkste Stufe schon erreicht), Effort high, Brief `paket-4.impl-2.brief.txt`, Report `paket-4.impl-2.json` · zurück: FERTIG (Session `8077a43c-8cfc-4a41-8275-f89dab501784`), Streamer löscht den Eintrag vor `beginUpdatingTiles()`, `#updating` im Getter, Test `is true after clearTiles() until the next beginUpdatingTiles()` → `… until the next update cycle has closed`, `docs/architecture.md` ergänzt; 3 Tests vor dem Fix rot (`paket-4.impl-red-r2.log`) · Verify exit=0 (`paket-4.verify-2.log`), ungecacht 705/705 (`paket-4.verify-2-map2d-nocache.log`) · Nach-Review opus, Effort high, Diff `paket-4.diff-2`, Report `paket-4.review-2.json` · Urteil: freigegeben — Abbruch-Rand und `architecture.md` erledigt; klein: `Map2DTileRenderer.ts:196`–`:197` `#updateDataSerial` vor `update()` (vorbestehend, → Queue), Report führte den mitgezogenen Test nicht unter Abweichungen
  - 2026-09-28 Zug 5: Commit 394fbf9d (25 Dateien), Verify `paket-4.verify-2.log` exit=0 vor dem Commit ohne spätere Änderung, Trailer `Remediation-Run: 2026-09-28` · drei Nebenbefunde in »Offene Befunde« · A7 oben beschreibt `hasPendingTiles` nach `clearTiles()` »bis zum nächsten `beginUpdatingTiles()`«; gebaut ist »bis zum `endUpdatingTiles()` des nächsten Zyklus« (Runde 2, gewollt, in JSDoc und CHANGELOG)

## Reviewer-Urteil

Drei Reviews (`paket-4.review-0.json`, `-1`, `-2`), das letzte freigegeben. Fundstellen im Stand 394fbf9d.

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| PERF-010 | behoben | `Map2DTileStreamer.ts` Renderer-Schleife in `update()` (Auslassen bei gleichem `serial` und `hasPendingTiles === false`, Buchung in `#laidOutSerials` nach `endUpdatingTiles()`); `serial` in `CameraBasedVisibility.ts` (beide Ergebnisblöcke) und `RectangularVisibilityArea.ts`; `Map2DTileRenderer.ts:64` `hasPendingTiles`; `types.ts:84`, `:210` |
| PERF-011 | behoben | `TileSpritesFactory.ts` `createTile()`: Pool-Prüfung vor `frameId()`/`atlas.get()`, Meldung über `undefinedValueError()` erst im Wurf; Helper-Stellen in `CameraBasedVisibilityHelpers.ts` `updateTileHelpers()` |
| PERF-012 | behoben | `Map2DSpatialHashGrid.ts` `add()`/`getTile()` über `TileSlotTable`, `#cellsOf()` schreibt in ein Scratch-Objekt; `getKey()`/`Map2DSpatialHashGridKeyType` `@deprecated`; JSDoc in `tileKeys.ts`, `Map2DTileCoords.ts`, `TileSlotTable.ts` nachgezogen |
| PERF-013 | behoben | `chunk-quad-tree/ChunkQuadTreeNode.ts` `findChunksAt(x, y, out = [])`, iterativ, Eltern vor Kindern |
| TEST-049 | behoben | `AABB2.spec.ts` `describe('extend')` mit `beforeEach` je Block; `ChunkQuadTreeNode.spec.ts` `before subdivide()`/`after subdivide()` mit `beforeEach`; Reviewer zusätzlich Seeds 11, 23, 42, 97, 1234 grün |
| Nebenbefund Helper-Neuaufbau | behoben | `CameraBasedVisibilityHelpers.ts` `#knobValues`/`#seenKnobs`, `makePointOnPlane(x, y, target)`, Schleifen statt `filter()`/`forEach()`; 112 B → 0,01 B je `update()`, 680 B → 0,30 B je Neuaufbau |

Abweichungen vom Detailplan, von den Reviews akzeptiert: E3 über den Plan hinaus (`…HelperExpand`-Parameter der privaten `place…Helper()` entfallen, Faktor aus dem Feld — unter Coverage boxte V8 den gebrochenen Double, 256 B je Neuaufbau) · A4 `#laidOutSerials` als `WeakMap` statt `Map` (Runde 1) · `hasPendingTiles` über A3 hinaus mit `#changedOutsideCycle` und `#updating` (Runden 1 und 2) · A7 Test 3 prüft zusätzlich das Auslassen des ersten Renderers · D2 Baum mit Kreuzer `T` am Südost-Knoten.

Einstufung in Zug 4: Review 0 hat alle Befunde `klein` genannt und freigegeben; der Runner hat zwei davon als `wichtig` eingestuft (Rubrik aus Zug 3: Stellen, die der Umbau selbst verursacht) und Runde 1 ausgelöst — `#laidOutSerials` hielt am `Set` vorbei entfernte Renderer dauerhaft, und `addTile()`/`removeTile()` außerhalb eines Zyklus wurden bei stehendem Blick nicht mehr nachgeholt, was der Reuse-Durchlauf vorher tat.

Kleine Befunde, offen gelassen: der Implementierer-Report der Runde 2 führt den mitgezogenen Test `is true after clearTiles() until the next update cycle has closed` nicht unter Abweichungen (nur Protokoll).

Urteile an den Nebenbefunden (Queue): `Map2DSpatialHashGrid.ts:66` `aabb` mit `Infinity`/`NaN`, `Map2DTileStreamer.ts:200` Wurf in `removeTiles`, `Map2DTileRenderer.ts:196` `#updateDataSerial` vor `update()` — alle drei in `src/map2d/`, also unter der Scope-Regel `→ Scope`; alle drei bestanden in `e7767c6d` in derselben Form (der Reuse-Durchlauf holte weder liegengebliebene Tiles ab noch einen gescheiterten Upload nach), deshalb Nebenbefund und keine Folge.

## Nicht in diesem Paket

- Die bestehenden Tests in `src/map2d/hot-path-allocations.spec.ts` (Zeilen 1–291 vor diesem Paket)
  werden nicht angefasst, auch nicht ihre Konstanten — ihre Reihenfolgeabhängigkeit ist Paket 5. Neue
  `describe`-Blöcke kommen ans Dateiende und dürfen die vorhandenen Konstanten
  (`BYTES_PER_CALL_LIMIT`, `BYTES_PER_RECOMPUTATION_LIMIT`, `CALLS_PER_ROUND`,
  `RECOMPUTATIONS_PER_ROUND`) mitbenutzen.
- `Map2DSpatialHashGrid#getTiles(…, out)` leert `out` weiter mit `Set.clear()`; das alloziert je
  Aufruf (siehe Queue) und bleibt hier liegen.
- Kein CI-Job mit `--sequence.shuffle`: die Empfehlung von TEST-049 nennt ihn optional. Geprüft sind
  zwölf Seeds über `src/map2d`, `src/sprites` und `src/vertex-objects`; die übrigen Module hat niemand
  gemischt laufen lassen, und ein Gate, das über Module außerhalb des Scopes wacht, gehört nicht in
  diesen Lauf. Der Verify dieses Pakets mischt die angefassten Specs.

## A — PERF-010: der Streamer lässt einen Renderer aus, der nichts zu tun hat

Warum so und nicht mit einem Vergleich von `offset`: das Audit schlägt vor, Seriennummer *und*
`offset` zu vergleichen. Beide Visibilitoren verlassen den Cache-Pfad bei jeder Änderung von
Zentrum, Grid und `matrixWorld`; gleiche Seriennummer heißt deshalb gleiches Ergebnis samt `offset`.
Das wird als Vertrag von `serial` festgeschrieben (A1), und der Streamer vergleicht nur die Nummer.
Buchgeführt wird je Renderer statt mit einer Marke für den ganzen Streamer, weil `renderers` ein
öffentliches, beschreibbares `Set` ist: ein Renderer, der daran vorbei hineinkommt, findet sich nicht
in der Buchführung und läuft deshalb durch den Zyklus.

A1. `types.ts`, `IMap2DVisibleTiles`: neues optionales Feld hinter `changed`:

```ts
  /**
   * Names the recomputation this result comes from. A visibilitor that hands back the result of
   * its last recomputation as it stands — the same tiles, the same `offset`, nothing to create or
   * to remove — answers the `serial` it answered then, and every recomputation answers one it has
   * not answered before. `Map2DTileStreamer` leaves a tile renderer out of the update cycle while
   * the result carries the `serial` that renderer last laid out and the renderer reports no
   * {@link IMap2DTileRenderer.hasPendingTiles}. Left out, every result counts as a new one.
   */
  serial?: number;
```

A2. `types.ts`, `IMap2DTileRenderer`: neues optionales Mitglied direkt hinter `node`:

```ts
  /**
   * Whether the renderer still lacks tiles of the tile set it was last handed and wants the next
   * update cycle even if that tile set has not changed: tiles its factory had no room for, or
   * every tile after {@link clearTiles}. `Map2DTileStreamer` skips the update cycle of a renderer
   * that answers `false` while the visibilitor hands back the result the renderer has already
   * laid out — see `IMap2DVisibleTiles#serial`. Left out, the renderer goes through every update
   * cycle.
   */
  readonly hasPendingTiles?: boolean;
```

A3. `Map2DTileRenderer`:
- zwei private Felder neben `#warnedNoTileCapacity`, beide mit Kommentar:
  `#tilesPending = false` — die Factory hat im laufenden Zyklus mindestens einmal `noTileCapacity`
  geantwortet; `#cleared = false` — `clearTiles()` lief seit dem letzten `beginUpdatingTiles()`.
- `beginUpdatingTiles()`: hinter dem `null`-Guard `this.#tilesPending = false; this.#cleared = false;`.
- `addTile()`: im `noTileCapacity`-Zweig vor `#warnNoTileCapacity()` `this.#tilesPending = true;`.
  Ein `undefined` der Factory (Koordinate ohne Tile) setzt nichts.
- `clearTiles()`: hinter dem `null`-Guard `this.#cleared = true;`.
- `dispose()`: beide Felder zurück auf `false`, neben den übrigen Resets.
- öffentlicher Getter, zwischen `tileFactory` und `constructor`:

```ts
  /**
   * `true` while the renderer lacks tiles of its last update cycle — tiles the factory answered
   * {@link noTileCapacity} for — or has been emptied by {@link clearTiles} since that cycle. See
   * {@link IMap2DTileRenderer.hasPendingTiles}. `false` once {@link dispose} has run.
   */
  get hasPendingTiles(): boolean {
    return this.tileFactory !== null && (this.#cleared || this.#tilesPending);
  }
```

  (`noTileCapacity` ist in `Map2DTileRenderer.ts` schon als Wert importiert, der Link löst auf.)

A4. `Map2DTileStreamer`:
- neues Feld neben `#clearTilesOnNextUpdate`:

```ts
  // The `serial` of the visibilitor result each renderer last went through a whole update cycle
  // with. A renderer missing here has laid out nothing since it came on or since the tiles were
  // cleared, and goes through the next cycle whatever the result says.
  readonly #laidOutSerials = new Map<IMap2DTileRenderer, number>();
```

- `removeTileRenderer()`: im `if` zusätzlich `this.#laidOutSerials.delete(renderer);` vor
  `renderer.clearTiles()`.
- `update()`, Clear-Block (`:140`–`:148`): nach der Renderer-Schleife `this.#laidOutSerials.clear();`.
  Damit sind `clearTiles()`, ein Grid-Wechsel und ein Visibilitor-Wechsel abgedeckt — alle drei laufen
  über `#clearTilesOnNextUpdate`.
- `update()`, Renderer-Schleife (`:164`–`:172`):

```ts
      const serial = visible.serial;
      for (const tileRenderer of this.renderers) {
        // nothing to lay out: the renderer holds this very result and misses none of its tiles
        if (
          serial !== undefined &&
          tileRenderer.hasPendingTiles === false &&
          this.#laidOutSerials.get(tileRenderer) === serial
        ) {
          continue;
        }

        tileRenderer.beginUpdatingTiles(position, visible.changed ?? true);
        // … removeTiles, createTiles, reuseTiles wie bisher …
        tileRenderer.endUpdatingTiles();

        if (serial !== undefined) {
          this.#laidOutSerials.set(tileRenderer, serial);
        } else {
          this.#laidOutSerials.delete(tileRenderer);
        }
      }
```

  `this.tiles = visible.tiles` und die Position bleiben vor der Schleife wie bisher.
- JSDoc von `update()` um einen Absatz ergänzen:
  „A tile renderer sits an update out when there is nothing to lay out: the visibilitor hands back
  the result the renderer went through its last update cycle with — the same
  {@link IMap2DVisibleTiles.serial} — and the renderer reports no
  {@link IMap2DTileRenderer.hasPendingTiles}. Its node then stays where that cycle placed it. A
  renderer that has just come on, every renderer after the tiles were cleared, and every renderer of
  a visibilitor whose results carry no `serial` go through the cycle.“

A5. `CameraBasedVisibility`:
- `result.serial = this.#serial;` in beiden Ergebnisblöcken: im Pfad ohne Treffer der Sondenstrahlen
  (`computeVisibleTiles()`, `:610`–`:619`, neben `result.changed = changed;`) und in
  `findVisibleTiles()` (`:857`–`:864`, neben `result.changed = changed;`). Der Cache-Pfad
  (`:550`–`:557`) lässt `serial` stehen.
- JSDoc des Getters `serial` (`:370`–`:379`) um einen Satz: „It is also the
  {@link IMap2DVisibleTiles.serial} of the result `computeVisibleTiles()` hands out.“

A6. `RectangularVisibilityArea`:
- privates Feld `#serial = 0` mit Kommentar („counts the recomputations; the result carries it as
  `serial`“), neben `#visibleTiles`.
- hinter `this.needsUpdate = false;` (`:162`) `this.#serial += 1;`, im Ergebnisblock (`:229`–`:238`)
  `result.serial = this.#serial;`. Der Cache-Pfad (`:154`–`:160`) lässt es stehen. Kein öffentlicher
  Getter.

A7. Tests, rot vor A3–A6 (Ausnahmen genannt):
- `Map2DTileStreamer.spec.ts`, neuer Block `describe('update() with a visibilitor that names its results')`,
  mit einem Test-Visibilitor, der wie `makeCachingVisibilitor()` arbeitet und dazu `serial` setzt, das
  nur ein expliziter `recompute()` des Helpers weiterzählt, und einem Recording-Renderer mit
  `hasPendingTiles`:
  1. `a renderer that laid out the result the visibilitor hands back again sits the update out` —
     zweites `update()`: kein `beginUpdatingTiles()`, kein `reuseTile()`. Rot.
  2. `a Map2DTileRenderer is asked about none of its tiles while the view stands` — echter
     `Map2DTileRenderer` mit Spy-Factory, `RectangularVisibilityArea(300, 300)`, Spy auf
     `reuseTile`; zweites `update()` ohne Änderung: 0 Aufrufe. Rot.
  3. `a renderer added after the result was laid out gets its tiles from the unchanged result`.
  4. `a renderer that reports pending tiles goes through every update`.
  5. `a renderer without hasPendingTiles goes through every update`.
  6. `clearTiles() lays the unchanged result out again`.
  7. `a renderer put into renderers directly gets its tiles`.
  8. `a renderer taken off and added again gets its tiles`.
  9. `a visibilitor that takes over with the serial of the one before gets the tiles built again`.
  10. `a tile the full factory could not place is built on a standing view` — Factory-Mock, der beim
      ersten `createTile()` `noTileCapacity`, danach ein Tile antwortet; zweites `update()` mit
      `RectangularVisibilityArea` aus dem Cache baut es. Grün vorher und nachher (hält die Semantik).
  Die bestehenden Tests der Datei bleiben unverändert grün; `makeCachingVisibilitor()` setzt kein
  `serial` und deckt damit »ohne serial läuft jeder Zyklus« ab.
- `Map2DTileRenderer.spec.ts`, neuer Block `describe('hasPendingTiles')`: `false` nach einem Zyklus,
  der jedes Tile gesetzt hat · `true` nach einem Zyklus mit `noTileCapacity`, `false` wieder nach einem
  Zyklus, der es gesetzt hat · `true` nach `clearTiles()` bis zum nächsten `beginUpdatingTiles()` ·
  eine Koordinate, die die Factory mit `undefined` ablehnt, ist nicht offen · `false` nach `dispose()`.
- `CameraBasedVisibility.spec.ts`: `the result carries the serial of the recomputation it comes from`
  — nach einer Neuberechnung `result.serial === visibility.serial`; der Cache-Pfad lässt beides stehen;
  die nächste Neuberechnung bewegt beides; der Pfad ohne Treffer (Kamera blickt an der Ebene vorbei,
  `previousTiles` nicht leer) trägt ebenfalls seine Nummer.
- `RectangularVisibilityArea.spec.ts`: `the serial of the result moves with every recomputation and
  stands while the result is handed back` — Zentrum bewegt, `needsUpdate`, anderes Grid: neue Nummer;
  unveränderter Aufruf: dieselbe.

## B — PERF-011: `TileSpritesFactory#createTile()` fragt den Pool vor dem Tile-Set

Abweichung von der Empfehlung, mit Grund: das Audit will die Kapazität vor *allen* Lookups prüfen.
`TileSpritesFactory.spec.ts:137` (`a coordinate without a tile answers undefined even when the pool
is full`, seit `2503bd68`) hält aber fest, dass eine Koordinate mit Tile-Id `0` auch bei vollem Pool
`undefined` bekommt. Das ist der Grund, warum der Renderer Löcher in `#declined` ablegt; mit
`noTileCapacity` blieben sie offen, hielten `hasPendingTiles` (A3) bei vollem Pool dauerhaft auf
`true` und nähmen dem Streamer das Auslassen aus A4. Die Prüfung sitzt deshalb hinter
`getTileIdAt()` und dem `tileSet`-Guard, vor `frameId()`, `atlas.get()` und der Meldung.
Zum String: gemessen alloziert der Aufruf auf vollem Pool heute 0,01 B (TurboFan versenkt den
Template-String in den Wurfzweig); die Meldung wird trotzdem erst im Fehlerfall gebaut, damit der
Pfad nicht vom Optimierer abhängt.

B1. `src/utils/expectDefined.ts`: neue Funktion, `expectDefined()` wirft über sie:

```ts
/**
 * The error {@link expectDefined} throws for a missing `what`. For a hot path that tests the value
 * itself, so that the description is put together only when the value is missing.
 */
export function undefinedValueError(what: string): Error {
  return new Error(`expected ${what} to be defined`);
}
```

B2. `createTile()` in dieser Reihenfolge; die beiden Guards behalten ihre Meldungen wörtlich, der
Rest ab `const {view} = tileCoords;` bleibt unverändert:

```ts
    const {tileDataProvider} = this;
    if (tileDataProvider == null) {
      throw new Error(/* unverändert */);
    }
    const tileDataId = tileDataProvider.getTileIdAt(tileCoords.x, tileCoords.y);

    if (tileDataId === 0) return;

    const {tileSet} = this;
    if (tileSet == null) {
      throw new Error(/* unverändert */);
    }

    // asked before the tile set: a full pool answers the same whatever the tile set holds, and the
    // renderer asks again for every tile it could not place, in every cycle until a slot is free —
    // a TileSprites without a geometry has no pool and so no slot either
    const pool = this.#tileSpritesGeometry()?.instancedPool;
    if (pool === undefined || pool.usedCount >= pool.capacity) return noTileCapacity;

    const frameId = tileSet.frameId(tileDataId);
    // frameId() answers a frame id inside the range of the tile set, and its atlas holds a frame for
    // each of them: a missing frame is a broken invariant, not a field the caller left empty
    const frame = tileSet.atlas.get(frameId);
    if (frame == null) throw undefinedValueError(`the atlas frame of tile ${tileDataId}`);
    const texCoords = frame.coords;

    // everything that can throw has thrown by now: the slot below comes out of the instanced
    // pool, and the `freeVO()` that would book it back is out of reach on this path — whoever
    // gives a tile back is the renderer, and it never sees one this call threw over
    const sprite = pool.createVO();

    // a disposed pool hands out no slot even below its capacity
    if (sprite == null) return noTileCapacity;
```

Die private Methode `createTileSprite()` entfällt, ihr einziger Aufrufer nimmt `pool` von oben.

B3. JSDoc von `createTile()`: den `@throws`-Absatz so fassen, dass er die neue Reihenfolge sagt: „… the
`RangeError` of `TileSet#frameId()` when the provider answers a tile id that is no whole number. The
tile set is asked only while the instanced pool has a free slot: a full pool answers
{@link noTileCapacity} for every coordinate whose tile id is not `0`, a tile id that is no whole
number included. Nothing is taken out of the pool then.“

B4. Tests in `TileSpritesFactory.spec.ts`:
- `a full instanced pool answers noTileCapacity without looking the tile up in the tile set` — Spies
  auf `tileSet.frameId` und `tileSet.atlas.get`: nicht aufgerufen; `getTileIdAt` einmal. Rot.
- `a full instanced pool answers noTileCapacity for a tile id that is no whole number, and throws the
  RangeError once a slot is free` — hält die Reihenfolge aus B3 fest.
- Alle bestehenden Tests bleiben grün, `:137` ausdrücklich.
- Kein Allokationstest: der Vorzustand misst 0,01 B, ein roter Lauf ist nicht zu haben.

B5. Die drei `expectDefined()`-Aufrufe mit Template-Meldung in
`CameraBasedVisibilityHelpers.ts` (`:168`, `:185`, `:192`) sind Teil von E3.

## C — PERF-012: `Map2DSpatialHashGrid` findet seine Zellen über die Koordinate

Abweichung von der Empfehlung, mit Grund: das Audit schlägt `Map<number, …>` mit `packTileCoords()`
vor. Der gepackte Schlüssel ist nie ein Smi und wird bei jedem `Map`-Zugriff geboxt (16 B, gemessen in
Zug 0 von Paket 3). Paket 3b hat dafür `TileSlotTable` gebaut (`src/map2d/TileSlotTable.ts`,
intern): Buckets über einen Int32-Hash, Vergleich exakt auf `x`/`y`, keine Allokation je Zugriff. Die
nimmt der Grid.

C1. In `Map2DSpatialHashGrid.ts`, nicht exportiert:

```ts
// A cell of the grid: its tile coordinate and the renderables in it; `nextInBucket` belongs to the
// table that finds the cell
interface GridCell<Renderable> extends TileSlotTableEntry<GridCell<Renderable>> {
  readonly renderables: Set<Renderable>;
}
```

C2. Felder: `#tiles` weicht `readonly #cells = new TileSlotTable<GridCell<Renderable>>();`; `#cellKeys`
weicht `readonly #cellsOfRenderable = new Map<Renderable, GridCell<Renderable>[]>();` (Kommentar wie
bisher: die Zellen, in die `add()` ihn gelegt hat); neu `readonly #within: TilesWithinCoords =
createTilesWithinCoords();`. `#tiles` im Konstruktor entfällt.

C3. `#cellsOf(aabb: AABB2): TilesWithinCoords` schreibt über
`this.#tileCoordsUtil.computeTilesWithinArea(aabb, this.#within)` (das `AABB2` geht als Objekt hinein,
kein Double als Argument) und hebt `columns` und `rows` darin auf mindestens 1; der Kommentar über der
Methode bleibt. Keine Tupel mehr.

C4. `add()`: je Zelle `let cell = this.#cells.get(x, y); if (cell === undefined) { cell = {x, y,
nextInBucket: undefined, renderables: new Set()}; this.#cells.add(cell); }`, dann
`cell.renderables.add(renderable)` und die Zelle in die Liste des Renderables.
`#takeOut()`: je Zelle `renderables.delete()`, eine leere Zelle `this.#cells.remove(cell)`.

C5. `getTile(tileX, tileY)`: `return this.#cells.get(tileX, tileY)?.renderables;`
`findWithin()`: liest `tileLeft`, `tileTop`, `columns`, `rows` aus `#cellsOf(aabb)`, sonst wie bisher.
`getTiles()` unverändert.

C6. `static getKey()` und `Map2DSpatialHashGridKeyType` bleiben und werden `@deprecated` — der Grid
nimmt nirgends einen Schlüssel an, `getKey()` beschreibt einen Bucket-Schlüssel, den es nicht mehr
gibt, und `tileKey()` liefert denselben String:
- `getKey()`: „The textual key of the tile at these coordinates, the string `tileKey()` builds and the
  `id` of a `Map2DTileCoords` carries. The grid finds its cells by coordinate and takes no key.
  @deprecated Use `tileKey()`.“
- `Map2DSpatialHashGridKeyType`: „@deprecated The return type of the deprecated
  {@link Map2DSpatialHashGrid.getKey}; `tileKey()` answers a `string`.“
- JSDoc, das jetzt lügt, mitziehen: `tileKeys.ts:1`–`:6` (»the bucket keys of
  `Map2DSpatialHashGrid`« streichen), `Map2DTileCoords.ts:6`–`:9` (`createID()`: der Satz über den
  Bucket-Schlüssel entfällt), `TileSlotTable.ts:26`–`:35` (Klassen-JSDoc nennt neben den Slots der
  Sichtbarkeit die Zellen des Grids).

C7. Tests: `Map2DSpatialHashGrid.spec.ts` bleibt grün (Verhalten unverändert). Neu am Ende von
`src/map2d/hot-path-allocations.spec.ts`: `describe('Map2DSpatialHashGrid on the hot path')` mit
`test('getTile() allocates nothing')` — Grid 16×16, 200 Renderables mit `aabb` 20×20 verteilt über
512×512, eine Runde sind `CALLS_PER_ROUND` Aufrufe `getTile()` über wechselnde Zellen, Grenze
`BYTES_PER_CALL_LIMIT`. Rot (48 B je Aufruf in Zug 0).

## D — PERF-013: `ChunkQuadTreeNode#findChunksAt()` hängt an ein `out` an

D1. Signatur `findChunksAt(x: number, y: number, out: ChunkType[] = []): ChunkType[]`, iterativ:

```ts
    let node: ChunkQuadTreeNode<ChunkType> | null = this;
    while (node !== null) {
      const local = node.chunks;
      for (let i = 0, n = local.length; i < n; i++) {
        // The loop bound is `n`, taken from `local.length`.
        const chunk = local[i]!;
        if (chunk.containsDataAt(x, y)) out.push(chunk);
      }
      if (node.isLeaf) break;
      node = x < node.originX! ? (y < node.originY! ? node.nodes.northWest : node.nodes.southWest)
                               : (y < node.originY! ? node.nodes.northEast : node.nodes.southEast);
    }
    return out;
```

Reihenfolge wie bisher: die Chunks eines Knotens vor denen seiner Kinder. JSDoc nach dem Vorbild von
`findChunks()`: „Collects every chunk that holds data at `(x, y)`, from this node down to the leaf the
point lies in. Pass an `out` array to reuse storage in hot paths — entries are appended without
resetting `out`. The same array is returned.“

D2. Tests: in `ChunkQuadTreeNode.extended.spec.ts` (dort stehen die `findChunks(aabb, out)`-Tests):
`findChunksAt(x, y, out) appends to out and returns it` · `findChunksAt() answers the chunks from the
root down` · gleiche Treffer mit und ohne `out`. Neue Datei
`src/map2d/chunk-quad-tree/hot-path-allocations.spec.ts` mit `describe('ChunkQuadTreeNode on the hot
path')`, `test('findChunksAt() with an out array allocates nothing')`: 16×16 `StringDataChunk2D` à 8×8
(`data: 'A'.repeat(64)`), `subdivide()`, eine Runde sind 1000 Aufrufe an wechselnden Punkten, `out`
je Aufruf mit `truncateArray(out)` aus `src/utils/truncateArray.ts` geleert (nicht `length = 0`, das
gibt den Backing Store frei), Grenze 1 B je Aufruf — Konstanten und Kommentar im Stil der
map2d-Allokations-Spec. Rot (536 B je Aufruf in Zug 0).

## E — Nebenbefund: `CameraBasedVisibilityHelpers` baut ohne Allokationen neu auf

E1. `update()` (`:321`–`:329`): kein Objektliteral je Aufruf. Nach dem Muster von
`CameraBasedVisibility#dependenciesChanged()` (`:460`–`:483`):
- `#knobs` deklariert nur noch die vier Farben (`Dependencies.cloneable<Color>(…)`), gefragt mit einem
  Werteobjekt in einem Feld (`readonly #knobValues: DependencyValues<…>`), das jeder Aufruf neu
  beschreibt.
- `maxDebugHelpers`, `tileBoxHelperExpand`, `frustumBoxHelperExpand` gegen `readonly #seenKnobs = new
  Float64Array([NaN, NaN, NaN])` mit drei Index-Konstanten auf Modulebene; `NaN` lässt den ersten Aufruf
  als Änderung zählen.
- beide Hälften bei jedem Aufruf fragen, vor dem Gate und nicht hinter `&&` — der bestehende Kommentar
  bleibt sinngemäß.

E2. `updatePlaneHelpers()` (`:154`–`:160`) und `makePointOnPlane()` (`:263`–`:269`):
`makePointOnPlane(x: number, y: number, target: Vector3): Vector3` schreibt in `target`; vier
Scratch-Felder `readonly #planeAxisOrigin`, `#planeAxisShift`, `#planeAxisX`, `#planeAxisY` (je `new
Vector3()`) statt der drei `new Vector2()`, des `clone()` und der drei `new Vector3()`.
`placePointHelper()` kopiert den Punkt, die Wiederverwendung ist sicher.

E3. `updateTileHelpers()` (`:163`–`:198`): kein `filter()`, kein `forEach()`-Closure. Erst eine
Schleife über `visibles`, die für jedes `primary`-Tile die Frustum-Box setzt, dann die bestehende
Schleife — die Reihenfolge der gesetzten Helper bleibt genau die heutige. Die drei `expectDefined()`
werden zu Null-Checks, deren Meldung erst im Fehlerfall entsteht (entsprechend für `tile.box` mit
`the box of tile …`):

```ts
      const frustumBox = tile.frustumBox;
      if (frustumBox == null) throw undefinedValueError(`the frustum box of tile ${tile.x},${tile.y}`);
```

Der Import von `expectDefined` entfällt, falls unbenutzt; `undefinedValueError` kommt aus
`../utils/expectDefined.js`.

E4. Tests, neu am Ende von `src/map2d/hot-path-allocations.spec.ts`,
`describe('CameraBasedVisibilityHelpers on the hot path')`. Aufbau: Draufsicht-Kamera wie
`makeTopDownCamera()`, eine Neuberechnung über `makeGrid()`, `makeCenter()`, `makeMatrixWorld()`;
`const scene = new Scene(); const node = new Object3D(); scene.add(node); helpers.add(node);
helpers.show = true; helpers.update();`
- `test('an update() that finds nothing to rebuild allocates nothing')` — eine Runde sind
  `CALLS_PER_ROUND` Aufrufe `update()`, Grenze `BYTES_PER_CALL_LIMIT`. Rot (112 B je Aufruf in Zug 0).
- `test('a rebuild allocates nothing once its nodes are built')` — eine Runde sind
  `RECOMPUTATIONS_PER_ROUND` Aufrufe `update()`, vor jedem `maxDebugHelpers` im Wechsel 8/9 (erzwingt
  den Neuaufbau ohne Neuberechnung der Sichtbarkeit), Grenze `BYTES_PER_RECOMPUTATION_LIMIT` je
  Neuaufbau. Rot (681 B je Neuaufbau bei 16 Tiles in Zug 0).
- Die bestehenden `CameraBasedVisibilityHelpers.spec.ts`-Tests bleiben grün (Anzahl, Farben und
  Reihenfolge der Helper).

## F — TEST-049: die Specs laufen in jeder Reihenfolge

F1. `AABB2.spec.ts:58`–`:135`, `describe('extend')`: jeder der vier Blöcke (`not overlapping`,
`intersecting`, `overlaps (inside)`, `overlaps`) baut `aabb` und `other` in `beforeEach` neu und ruft
dort `extend()`; der Rückgabewert landet in einer `let returned`, `should return self` prüft
`expect(returned).toBe(aabb)`. Die Kantentests lesen das frische `aabb`. Testnamen bleiben.

F2. `ChunkQuadTreeNode.spec.ts`, Blöcke `create with irregular chunks` (`:20`–`:100`) und `create with
grid aligned chunks` (`:101`–`:174`): das `chunks`-Objekt bleibt auf Block-Ebene (nur gelesen; der
Konstruktor kopiert die Liste, `subdivide()` sortiert eine Kopie). Der Knoten entsteht je Test:
- verschachtelter Block `describe('before subdivide()')` mit `beforeEach(() => { node = new
  ChunkQuadTreeNode(Object.values(chunks)); })` für `is instance of…`, `is a leaf`, `has chunk nodes`
  und die vier `containsDataAt`-Tests (Namen und Assertions unverändert; ihre schiefen Namen sind ein
  eigener Befund in der Queue);
- `describe('after subdivide()')` mit `beforeEach`, das baut und `node.subdivide()` ruft, für alle
  Tests hinter dem heutigen `it('subdivide()')`;
- das assertionslose `it('subdivide()', …)` entfällt — sein Aufruf steht im `beforeEach`.

F3. Der Verify mischt die Specs mit acht Seeds (siehe oben). Zug 0 hat mit zwölf Seeds über
`src/map2d`, `src/sprites`, `src/vertex-objects` außer diesen beiden Dateien nur
`src/map2d/hot-path-allocations.spec.ts:180`/`:191` rot gesehen (Paket 5).

## G — CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`)

Skill `updating-changelog` laden und befolgen, Migration-Guide-Prüfung eingeschlossen. Einträge, im
Ton der vorhandenen:
- Added: `IMap2DVisibleTiles#serial` (was er zusagt, dass `CameraBasedVisibility` und
  `RectangularVisibilityArea` ihn setzen) · `IMap2DTileRenderer#hasPendingTiles` und
  `Map2DTileRenderer#hasPendingTiles` · optionales `out` von `ChunkQuadTreeNode#findChunksAt()`.
- Changed: perf `Map2DTileStreamer` lässt einen Renderer aus, der das zurückgegebene Ergebnis schon
  ausgelegt hat und nichts offen hat — ein stehender Blick kostet keinen Durchlauf über die Tiles; ein
  ausgelassener Renderer behält die Knotenposition des letzten Zyklus · perf
  `TileSpritesFactory#createTile()` fragt den Pool vor dem Tile-Set; bei vollem Pool antwortet eine
  Tile-Id, die keine ganze Zahl ist, mit `noTileCapacity`, der `RangeError` kommt, sobald ein Slot frei
  ist · perf `Map2DSpatialHashGrid` findet seine Zellen ohne Schlüssel-String und ohne Tupel · perf
  `CameraBasedVisibilityHelpers#update()` alloziert nichts, auch nicht beim Neuaufbau.
- Deprecated: `Map2DSpatialHashGrid.getKey()` und `Map2DSpatialHashGridKeyType` — `tileKey()` liefert
  denselben String.
- Kein Eintrag für die Spec-Umbauten aus F.

## Abgleich in Zug 0

| Finding | Stand | Fundstelle jetzt |
| --- | --- | --- |
| PERF-010 | umgeformt | Streamer-Schleife unverändert `Map2DTileStreamer.ts:164`–`:172` (Audit `:169`); `Map2DTileRenderer.ts:101` unverändert; Cache-Pfade durch Paket 3/3b gewandert: `CameraBasedVisibility.ts:550`–`:557` (Audit `:366`), `RectangularVisibilityArea.ts:154`–`:160` (Audit `:126`). Beide geben seit 3b ein geteiltes `#result` zurück, dessen Listen die Neuberechnung neu füllt — ein `serial` im Ergebnis muss deshalb in beiden Ergebnisblöcken von `CameraBasedVisibility` geschrieben werden (`:610`–`:619`, `:857`–`:864`). `CameraBasedVisibility#serial` gibt es (`:380`), `RectangularVisibilityArea` zählt nichts. |
| PERF-011 | unverändert | `TileSpritesFactory.ts:59`–`:82`: Lookups `:59`, `:70`, `:73`, Slot erst `:78`. Gemessen (Node 24, `measureSettledBytes`, voller Pool mit 10 Slots, 1000 Aufrufe je Runde): 0,01 B je Aufruf — der Template-String wird im optimierten Code nicht gebaut. Die Kosten sind `getTileIdAt()`, `frameId()`, `atlas.get()` je offenem Tile und Frame. Helper-Stellen `CameraBasedVisibilityHelpers.ts:168`, `:185`, `:192` unverändert. |
| PERF-012 | unverändert | `Map2DSpatialHashGrid.ts:150` (`getTile()` mit `getKey()`), `:55` (`add()`), `:100`–`:104` (`#cellsOf()` mit zwei Tupeln). Gemessen: `getTile()` 48 B je Aufruf; `findWithin(aabb, out)` 1 960 B je Aufruf (200 Renderables, Grid 16, Abfrage 64×64, 9 Treffer). |
| PERF-013 | unverändert | `chunk-quad-tree/ChunkQuadTreeNode.ts:335`–`:349`. Gemessen: 536 B je Aufruf bei Tiefe 4 (256 Chunks). Aufrufer im Repo: keiner außer der eigenen Rekursion. |
| TEST-049 | unverändert, erweitert | `AABB2.spec.ts:58`–`:135` (Audit `:58`), `chunk-quad-tree/ChunkQuadTreeNode.spec.ts:83` und dazu `:137` — der zweite Block (`create with grid aligned chunks`) hat dasselbe Muster, das Audit nannte nur den ersten. Zwölf Seeds `--sequence.shuffle` über `src/map2d`, `src/sprites`, `src/vertex-objects`: rot nur diese beiden Dateien und `src/map2d/hot-path-allocations.spec.ts:180`/`:191` (siehe Folge). |

Seit `e7767c6d` (Basis des Laufs) unverändert: `Map2DTileStreamer.ts`, `Map2DTileRenderer.ts`,
`Map2DSpatialHashGrid.ts`, `chunk-quad-tree/`, `TileSpritesFactory.ts`, `CameraBasedVisibilityHelpers.ts`,
`AABB2.spec.ts`, `types.ts` (`git diff e7767c6d --stat`, leer).

## Triage in Zug 0

- **Nebenbefund `CameraBasedVisibilityHelpers.ts:321`–`:329`, `:154`–`:157`, `:164`** (aus Zug 0 von
  3b) → in dieses Paket, Abschnitt E. Grund: PERF-011 benennt ausdrücklich die Meldungen je Tile und
  Neuaufbau in `updateTileHelpers()`; dieselbe Funktion legt daneben `filter()`-Array und Closure an,
  `updatePlaneHelpers()` sieben Vektoren und `update()` ein Objektliteral. Nur die Strings zu beheben
  hieße, dieselbe Ursache — der Neuaufbau im Frame-Takt ist nicht allokationsfrei geschrieben — halb
  zu beheben. Gemessen 112 B je `update()` ohne Neuaufbau, 681 B je Neuaufbau.
- **Folge aus Paket 3b** → Paket 5 geschnitten (`Folge von: Paket 3b`). Befund:
  `src/map2d/hot-path-allocations.spec.ts:180` (`a recomputation allocates nothing per tile, however
  many tiles the view holds`) und `:191` (`… the limit cuts …`) sind einzeln rot — deterministisch
  3,48 B je Tile von 208 bzw. 7,23 B je Tile von 100, beides rund 723 B je Neuberechnung — und unter
  `--sequence.shuffle` in 5 von 12 Seeds. Grün sind sie nur hinter den Tests davor, die rund 38 000
  Neuberechnungen der Draufsicht laufen lassen. Frischer Prozess, geneigter Blick, Messung im Stil der
  Spec: 7 380 B je Neuberechnung nach 200 Vorlauf-Runden, 1 300–1 430 B nach 2 000, 91 B nach 20 000;
  40 000 Draufsicht- oder 8 000 geneigte Vorlauf-Neuberechnungen vor `measureSettledBytes` lassen
  immer noch 2,01 B je Tile (418 B je Neuberechnung). `--trace-deopt` zeigt keine Deopts; die einmal je
  Neuberechnung laufenden Funktionen (`computeVisibleTiles`, `collectTilesWithinProbeHull`,
  `dependenciesChanged`, `updateWorldMatrix` …) erreichen TurboFan erst nach der ersten Messung.
  Einordnung: Symptom — 3b sollte die Allokationsfreiheit im eingeschwungenen Frame-Takt herstellen und
  per Spec festhalten; die Spec hält sie nur in einer Testreihenfolge fest, und ob der geneigte Blick
  in einer Anwendung, die mit ihm startet, in Sekunden allokationsfrei wird, ist offen. 3b ist
  committet, also ein Nachtragspaket. Nicht in dieses Paket: eigene Ursache (JIT-Einschwingen des
  geneigten Pfads), anderes Paket als Verursacher; die Verify-Zeile hier lässt die Datei beim Mischen aus.
  Die übrigen 29 Allokationstests (`vertex-objects`, `sprites`, `map2d/TileSprites`, übrige `map2d`)
  sind einzeln grün.
- **Neu, vorbestehend** (beide `→ Scope`, in die Queue, nicht in dieses Paket — andere Ursache):
  - `Map2DSpatialHashGrid.ts:133` — `getTiles(…, out)` leert `out` mit `Set.clear()` und füllt es neu;
    V8 legt die Hash-Tabelle dabei neu an: gemessen 120 B (bis 4 Einträge), 681 B (9), 1 361 B (32) je
    Aufruf. `findWithin(aabb, out)` im Frame-Takt alloziert damit auch nach PERF-012. Der Fix braucht
    eine Ausgabe, die sich ohne Neuanlage leeren lässt (etwa ein Array-`out` mit Deduplizierung über
    einen Abfrage-Stempel) — eine Erweiterung der öffentlichen Signatur, die PERF-012 nicht verlangt.
    So schon in `e7767c6d`. Severity low.
  - `chunk-quad-tree/ChunkQuadTreeNode.spec.ts:77`–`:80` — vier Tests mit zwei doppelten Namen
    (`chunk->B->containsDataAt(5, 6)`, `chunk->B->containsDataAt(5, 9)`), deren Koordinaten zu keiner
    der Assertions passen (geprüft werden `(-5, -10)`, `(0, -10)`, `(-2, -6)`, `(-6, -6)`). Severity low
    (Test-Lesbarkeit). So schon in `e7767c6d`.

## Entscheidungen in Zug 0 (ohne Rückfrage, mit Grund)

- Kapazitätsprüfung hinter `getTileIdAt()` und `tileSet`-Guard statt vor allen Lookups — Grund in B.
- `TileSlotTable` statt `packTileCoords()`-Schlüssel — Grund in C.
- `getKey()` deprecaten statt stehen lassen — es beschreibt einen Bucket-Schlüssel, den es nicht mehr
  gibt; die Empfehlung lässt beides offen.
- Kein Vergleich von `offset` im Streamer, `serial` trägt es per Vertrag — Grund in A.
- Kein Shuffle-Job in der CI — Grund in »Nicht in diesem Paket«.
- Modell stärkste Stufe, Effort `high`: die öffentliche Oberfläche bewegt sich an vier Stellen
  (`IMap2DVisibleTiles`, `IMap2DTileRenderer`, `Map2DTileRenderer`, `findChunksAt()`, dazu eine
  Deprecation), und die Auslassbedingung in A4 hat Ränder (Renderer neu, geleert, am `Set` vorbei
  eingefügt, Visibilitor-Wechsel, volle Factory), an denen ein Fehler Tiles vom Bildschirm nimmt; der
  Reviewer erbt den Wert.

## Findings im Volltext

**PERF-010 · low · packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:169** — Unveränderte Tile-Sets im
Streamer ohne Durchlauf über alle Tiles abschließen
Weitere Fundstellen: `CameraBasedVisibility.ts:366`, `RectangularVisibilityArea.ts:126`,
`Map2DTileRenderer.ts:101`.
Die Sichtbarkeiten brechen bei stehender Kamera früh ab, legen dann aber die komplette Tile-Liste als
`reuseTiles` in das Ergebnis (`this.#visibleTiles.reuseTiles = this.#visibleTiles.tiles`).
`Map2DTileStreamer.update()` läuft diese Liste in jedem Frame für jeden Renderer ab, und
`Map2DTileRenderer.reuseTile()` macht pro Tile einen `Map.get` mit String-Key, bevor es an
`#tilesChanged` abbricht. Ein statisches Bild kostet damit O(Tiles × Renderer) pro Frame, obwohl nichts
zu tun ist. Der Durchlauf ist heute das Sicherheitsnetz für zwei Fälle: einen Renderer, der nach der
letzten Neuberechnung hinzukam, und Tiles, die auf `noTileCapacity` warten.
Beleg: `if (visible.reuseTiles) for (const tile of visible.reuseTiles) tileRenderer.reuseTile(tile);`
Empfehlung: Den Leerlauf explizit machen: Die Visibilitor-Ergebnisse tragen eine Seriennummer (bei
`CameraBasedVisibility` gibt es `serial` schon), und der Streamer überspringt die Renderer-Schleife,
wenn sich Seriennummer und `offset` nicht bewegt haben, seit `addTileRenderer()`/`clearTiles()` nichts
markiert hat und kein Renderer offene Kapazitätsanfragen meldet (etwa über ein `hasPendingTiles` am
Renderer).

**PERF-011 · low · packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts:68** — In
`TileSpritesFactory#createTile()` die Kapazität vor den Lookups prüfen und die Fehlermeldung nicht eager
bauen
Weitere Fundstellen: `Map2DTileRenderer.ts:109`, `CameraBasedVisibilityHelpers.ts:168`.
`createTile()` baut bei jedem Aufruf den Template-String `` `the atlas frame of tile ${tileDataId}` ``
als Argument von `expectDefined()`, auch wenn der Frame da ist — also bei jedem neuen Tile. Die Freiheit
im Pool wird erst danach über `createVO()` erfragt. Ist die Geometrie voll, fragt
`Map2DTileRenderer.reuseTile()` jedes überzählige Tile in jedem Frame erneut an (gewollt, damit frei
werdende Slots genutzt werden), und jede dieser Anfragen macht `getTileIdAt()`, `tileSet.frameId()`,
`atlas.get()` und den String, nur um mit `noTileCapacity` zu enden. Aufrufpfad:
`Map2DTileStreamer.update()` (Z. 169) → `Map2DTileRenderer.reuseTile()` → `addTile()` → `createTile()`.
Dasselbe Muster eager gebauter Meldungen steckt in `CameraBasedVisibilityHelpers.updateTileHelpers()`
(drei Strings pro sichtbarem Tile und Neubau, Debug-Pfad).
Beleg: `` const texCoords = expectDefined(tileSet.atlas.get(frameId), `the atlas frame of tile ${tileDataId}`).coords; ``
Empfehlung: Vor den Lookups prüfen, ob `instancedPool.usedCount < instancedPool.capacity`, und sonst
sofort `noTileCapacity` zurückgeben (die Reihenfolge »erst alles, was werfen kann, dann den Slot
nehmen« bleibt erhalten, weil die Prüfung keinen Slot nimmt). Für `expectDefined` eine Variante mit
lazy Meldung (`() => string`) anbieten oder den Null-Check inline schreiben.

**PERF-012 · low · packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:150** — Bucket-Keys von
`Map2DSpatialHashGrid` numerisch statt als String bilden
Weitere Fundstellen: `Map2DSpatialHashGrid.ts:55`, `:102`.
Jede Abfrage über `findWithin()`/`getTiles()` baut pro Zelle einen String (`tileKey(x, y)` →
`` `${x},${y}` ``) nur für den `Map.get`, dazu zwei Tupel in `#cellsOf()`. Die Klasse ist ausdrücklich
für Abfragen in jedem Frame gedacht (»so a caller that asks every frame keeps one set«, Z. 112) — dort
fallen dann pro Frame so viele Strings an, wie die Abfrage Zellen überdeckt. Das Modul hat mit
`packTileCoords()` genau für diesen Zweck einen kollisionsfreien numerischen Key (tileKeys.ts:17-19), den
`CameraBasedVisibility` bereits nutzt; der Grid bleibt beim String, damit er dieselbe Id wie
`Map2DTileCoords.id` trägt — die aber bei `getTile(x, y)` gar nicht hereingereicht wird.
Beleg: `const key = Map2DSpatialHashGrid.getKey(tileX, tileY); return this.#tiles.get(key);`
Empfehlung: Intern `Map<number, Set<Renderable>>` mit `packTileCoords()` führen; `getKey()` für die
öffentliche String-Sicht behalten oder deprecaten. `#cellsOf()` in vier Scratch-Felder schreiben lassen
statt Tupel zurückzugeben.

**PERF-013 · low · packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:336** —
`ChunkQuadTreeNode#findChunksAt()` mit Ausgabe-Array statt `filter`/`concat` pro Ebene
Weitere Fundstelle: `ChunkQuadTreeNode.ts:348`.
Die Punktabfrage legt auf jeder Ebene des Baums ein neues Array per `filter` mit Closure an und
verkettet die Ergebnisse per `concat` nach oben — bei Tiefe d sind das 2·d Arrays pro Abfrage. Ein
Tile-Data-Provider, der pro Tile `findChunksAt(x, y)` fragt, zahlt das für jedes Tile, das in die Sicht
kommt (über `TileSpritesFactory#createTile()` → `getTileIdAt()`), und beim Kapazitätsengpass in jedem
Frame. `findChunks()` daneben bietet für denselben Zweck schon ein `out`-Array an (Z. 305).
Beleg: `const chunks: ChunkType[] = this.chunks.filter((chunk: ChunkType) => chunk.containsDataAt(x, y));`
… `chunks.concat(child.findChunksAt(x, y))`
Empfehlung: `findChunksAt(x, y, out: ChunkType[] = [])` analog zu `findChunks()`: iterativ absteigen und
Treffer an `out` anhängen.

**TEST-049 · low · packages/twopoint5d/src/map2d/AABB2.spec.ts:58** — Reihenfolgeabhängige Specs in
AABB2 und ChunkQuadTreeNode entkoppeln
Weitere Fundstelle: `chunk-quad-tree/ChunkQuadTreeNode.spec.ts:83`.
Die Tests in `describe('extend')` von AABB2.spec.ts (z. B. :81 `should return self` ruft `extend()`,
:84–95 prüfen das Ergebnis) und `it('subdivide()')` in ChunkQuadTreeNode.spec.ts:83 (baut den Baum um,
die folgenden `it()` prüfen ihn) hängen von ihrer Reihenfolge ab: unter `vitest --sequence.shuffle`
sind 8 davon rot. Aufgefallen im Remediation-Lauf vom 2026-09-27.
Empfehlung: Den geteilten Zustand je Test in `beforeEach` aufbauen, sodass jeder Test für sich läuft;
optional einen CI-Lauf mit `--sequence.shuffle` ergänzen.

**Nebenbefund · low · packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:321**–`:329`,
`:154`–`:157`, `:164` (gefunden in Zug 0 von Paket 3b) — `update()` ruft `#knobs.changed()` bei jedem
Aufruf mit einem neuen Objektliteral (ein gebrochener `…HelperExpand` wird dazu von `Dependencies`
geboxt), und jeder Neuaufbau — bei bewegter Kamera jeder Frame, weil er an `serial` hängt — baut drei
`Vector2`, einen Klon von `planeOrigin`, drei `Vector3` über `makePointOnPlane()` sowie
`visibles.filter()` samt `forEach`-Closure; bei eingeschalteten Helpers ein stetiger Allokationszufluss
im Frame-Takt (Debug-Pfad, vorbestehend — so schon in `e7767c6d`).
