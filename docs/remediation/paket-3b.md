# Paket 3b — Map2D: Sichtbarkeit ohne kurzlebige Allokationen im Frame-Takt

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-032 (low), PERF-009 (low) · dazu drei Nebenbefunde aus »Offene
  Befunde«, gefunden in Zug 0 von Paket 3, gleiche Ursache: Schlüssel aus
  `packTileCoords()` in `Map`/`Set` (N1), `visibles.sort()` mit Comparator (N2),
  Listen per `length = 0` geleert (N3)
- Ziel: `computeVisibleTiles()` von `CameraBasedVisibility` und
  `RectangularVisibilityArea` alloziert im eingeschwungenen Frame-Takt nichts,
  weder je Neuberechnung noch je Tile, ein Tile, das die Sicht betritt, kostet
  höchstens seine `Map2DTileCoords`-Hülle, und ein Allokations-Spec
  (`hot-path-allocations.spec.ts` über `measureSettledBytes()`) hält beides fest;
  die Sortierung nach Kameradistanz bleibt (Entscheidung vom 2026-09-28).
- Modell: stärkste Stufe — Umbau der Kernschleife einer 1000-Zeilen-Klasse samt
  neuer Datenstruktur, Free-List und Sortierung; Fehler zeigen sich als falsche
  Tiles aus wiederverwendeten Slots, nicht als Absturz
- Effort: high — öffentliche API wird erweitert (optionale `target`-Parameter) und
  ein Vertrag präzisiert (`TileBox`-Wiederverwendung); die Restallokationen findet
  man nur durch geduldiges Nachmessen
- Dateien (alle unter `packages/twopoint5d/`):
  - `src/map2d/CameraBasedVisibility.ts`, `src/map2d/CameraBasedVisibility.spec.ts`
  - `src/map2d/RectangularVisibilityArea.ts`
  - `src/map2d/Map2DTileCoordsUtil.ts`, `src/map2d/Map2DTileCoordsUtil.spec.ts`
  - `src/map2d/convexTileHull.ts`, `src/map2d/convexTileHull.spec.ts`
  - neu `src/map2d/TileSlotTable.ts`, `src/map2d/TileSlotTable.spec.ts`
  - neu `src/utils/truncateArray.ts`, `src/utils/truncateArray.spec.ts`
  - neu `src/map2d/hot-path-allocations.spec.ts`
  - `docs/architecture.md` (Absatz `### map2d/`), `CHANGELOG.md`
- Vorgehen: siehe Abschnitt »Vorgehen« unten, Schritte 1–11 in dieser Reihenfolge
- Verify: `pnpm run ci` (im Repo-Root). Schnelle Schleife für den
  Implementierer: `pnpm nx test twopoint5d -- src/map2d` und
  `pnpm nx test twopoint5d -- src/utils/truncateArray.spec.ts`
- Commit: `perf(map2d): let CameraBasedVisibility and RectangularVisibilityArea allocate nothing once a frame loop has settled, hand the slot of a tile that leaves the view to a tile that enters it, sort the visible tiles without a comparator, and give getTileCoords() and computeTilesWithinCoords() of Map2DTileCoordsUtil an optional target`
- Verlauf:
  - 2026-09-28 Zug 0: Detailplan steht · PERF-032 umgeformt, alle Stellen
    vorhanden (`CameraBasedVisibility.ts:639`, `:789`, `:812`, `:369`,
    `convexTileHull.ts:21`–`:62`, `Map2DTileCoordsUtil.ts:163`/`:175`,
    `RectangularVisibilityArea.ts:122`) · PERF-009 umgeformt (Paket 3 hat
    `acceptTile()` aufgeteilt; Verdrängung jetzt `:708`–`:712`, Slot-Neubau
    `:586`, `:885`, `:893`, `:904`, `:983`, `:987`) · N1 jetzt `:302`, `:311`,
    `:325`, `:332`, `:583`, `:606`, `:1010` · N2 jetzt `:727` · N3 jetzt `:484`,
    `:493`, `:498`, `:562`, `:599`, `:611`, `:612`, `:737`, `:741`, `:785`,
    `RectangularVisibilityArea.ts:148`–`:150`, `:196` · dazu gemessen auf demselben
    Pfad: Parameter-Destrukturierung `[centerX, centerY]` und Double-Werte durch
    `Dependencies` · Folgen aus Paket 1–3: keine · Nebenbefunde der Queue:
    N1–N3 hier, die übrigen fünf andere Ursache, bleiben · neuer Nebenbefund
    `CameraBasedVisibilityHelpers.ts:154`–`:157`, `:164`, `:321`–`:329` →
    »Offene Befunde« (andere Klasse, Debug-Pfad, nicht dieses Paket) ·
    Reviewer-Notiz aus Paket 3 zu `prepareTile()` `:893` (`centerWorld` je Slot)
    erledigt sich mit Schritt 6 ·
    Restplan geprüft, keine Änderung · Messskripte
    `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad/paket-3b.zug0-messungen/`
  - 2026-09-28 Zug 1: Implementierer beauftragt, opus, Effort high, Brief `paket-3b.impl-0.brief.txt`, Report `paket-3b.impl-0.json`
  - 2026-09-28 Zug 2: Report FERTIG_MIT_VORBEHALT (Session `cb392d28-9dbc-4fa8-91e6-4abeae46a3b5`) · geändert `CameraBasedVisibility.ts`/`.spec.ts`, `RectangularVisibilityArea.ts`, `Map2DTileCoordsUtil.ts`/`.spec.ts`, `convexTileHull.ts`/`.spec.ts`, `tileKeys.ts`, `docs/architecture.md`, `CHANGELOG.md` · neu `TileSlotTable.ts`/`.spec.ts`, `truncateArray.ts`/`.spec.ts`, `hot-path-allocations.spec.ts`, `createTilesWithinCoords.ts`, `packedTileKey.ts` · Arbeitsbaum schmutzig · roter Lauf 9/9 Allokationstests belegt · Abweichungen: `computeTilesWithinArea()` `@internal`, `Float64Array` für gesehene Skalare, `packedTileKey.ts`, Free-List rückwärts, Hüllen-Freigabe in `removeTiles`, 40 statt 100 Neuberechnungen je Runde · Verify `pnpm run ci` exit=0 (`paket-3b.verify.log`), `pnpm nx test twopoint5d --skip-nx-cache -- src/map2d src/utils` exit=0, 33 Dateien, 669 Tests
  - 2026-09-28 Zug 3: Reviewer beauftragt, opus, Effort high, Diff `paket-3b.diff`, Report `paket-3b.review-0.json` · Urteil: nicht freigegeben — PERF-032, PERF-009, N1, N2, N3 behoben; wichtig: Ausgang `hitCount === 0` (`CameraBasedVisibility.ts:597`–`:603`) gibt die Hüllen der entfernten Tiles nicht frei, Rückblick »instead of in sets« in `CHANGELOG.md:263`; klein: CHANGELOG-Halbsatz zur neuen Hülle eines zurückkehrenden Tiles, doppelte Koordinate im selben Ausgang doppelt in `removeTiles`, `searchCanStop()` rechnet je Pop neu
  - 2026-09-28 Zug 4 Runde 1: offen die beiden wichtigen Befunde, dazu die zwei kleinen, die an derselben Stelle hängen (CHANGELOG-Halbsatz, Duplikate) · per Resume an Session `cb392d28-9dbc-4fa8-91e6-4abeae46a3b5`, opus, Effort high, Report `paket-3b.impl-1.json` · zurück: FERTIG_MIT_VORBEHALT, `removePreviousTiles()` für beide Wege, zwei neue Specs (vor dem Fix rot, `paket-3b.red-r1.log`), CHANGELOG `:263` umformuliert; Vorbehalt: fremde Tiles ohne Slot gehen im Ausgang `hitCount === 0` weiter doppelt hinaus · Verify `pnpm run ci` exit=0 (`paket-3b.verify-1.log`), ungecacht `src/map2d src/utils` 671/671 · Nach-Review opus, Effort high, Diff `paket-3b.diff-1`, Report `paket-3b.review-1.json` · Nach-Review: alle vier erledigt, Vorbehalt trägt (`types.ts` verspricht keine Deduplizierung, `### Fixed`-Eintrag sagt zu, dass der Ausgang die Tabelle stehen lässt), keine neuen Befunde, freigegeben
  - 2026-09-28 Zug 5: Commit `32c29b9c` mit Trailer `Remediation-Run: 2026-09-28`, getragen von `paket-3b.verify-1.log` (exit=0, nach der letzten Codeänderung) · 17 Pfade · Plan auf `[x]`, Nebenbefund `writeTileCoords()` in »Offene Befunde«

## Reviewer-Urteil

Review `paket-3b.review-0.json` auf `paket-3b.diff`, Nach-Review `paket-3b.review-1.json` auf `paket-3b.diff-1`; Zeilen gegen den Arbeitsbaum vor dem Commit.

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| PERF-032 | behoben | Gate über `#dependencyValues`, Skalare in `#seenScalars`/`#seenLookAtCenter` (`CameraBasedVisibility.ts:339`–`:354`, `:460`–`:483`); Probe-Saat und Hülle über `computeTilesWithinArea()` mit `#queryArea`/`#queryTiles` (`:761`–`:778`, `:975`–`:988`), Hülle in `#hull` (`:990`), Besucher gebunden (`:454`), `poolAt()`-Fabriken als Modul-Konstanten (`:165`–`:167`); `target` in `Map2DTileCoordsUtil.ts:146`–`:232`; Gate von `RectangularVisibilityArea.ts:395`–`:447` |
| PERF-009 | behoben | Free-List `#freeSlots` (`:416`–`:420`), `acquireTileBox()` (`:691`–`:704`), `evictSlots()` mit Grenze (`:928`–`:948`); Differenztest des Reviewers über 900 Schritte (Draufsicht, geneigt, Rasterwechsel, Duplikate, Limits 25/60) ohne Abweichung gegen frische Instanzen |
| N1 | behoben | `TileSlotTable.ts` ersetzt alle `Map`s/`Set`s; Stempel `visitedStamp`/`probeStamp`/`previousStamp` (`CameraBasedVisibility.ts:55`–`:63`); 50 000 zufällige `add`/`remove` gegen eine `Map` ohne Abweichung |
| N2 | behoben | `sortKept()` (`:885`–`:916`): Insertion Sort unter dem Limit, Heapsort am Limit über `siftDownKept(…, length)` |
| N3 | behoben | `truncateArray()` an allen Stellen beider Klassen und in `convexTileHull.ts`; kein `length = 0` mehr in den vier Dateien |

Runde 1 (aus Review 0, wichtig): Ausgang `hitCount === 0` gab die Hüllen entfernter Tiles nicht frei — jetzt `removePreviousTiles()` für beide Wege (`:597`–`:608`, `:878`–`:894`); Rückblick »instead of in sets« in `CHANGELOG.md:263` gestrichen. Beide im Nach-Review erledigt.

Kleine Befunde:
- `CameraBasedVisibility.ts:1143` `searchCanStop()` rechnet Höhe, Footprint-Diagonale und drei `sqrt` bei jedem Frontier-Pop am Limit neu, obwohl sich das nur mit `kept[0]` ändert; die Stoppdistanz im Quadrat ließe sich in einem `Float64Array`-Scratch halten.
- Ausgang `hitCount === 0`: ein Tile ohne Slot dieser Sichtbarkeit (nur bei fremder, doppelter Eingabe, die `Map2DTileStreamer` nie liefert) geht weiter so oft hinaus, wie es in `previousTiles` steht; steht im JSDoc von `removePreviousTiles()`.
- Gemeldet vom Implementierer, nicht zum Paket: `prettier --check` zeigt Abweichungen in Codeblöcken älterer, veröffentlichter CHANGELOG-Abschnitte (um `:802`, `:826`, `:1003`); das Gate ist grün, veröffentlichte Abschnitte bleiben unverändert.

Nebenbefund (→ »Offene Befunde«, → Scope): `writeTileCoords()` (`CameraBasedVisibility.ts:712`–`:721`) fragt ein Tile als 1×1-Rechteck in Weltkoordinaten ab — bei Tile-Größen unter 1 werden alle Boxen 2×2 Tiles groß. Vorbestehend (so in `f9d0c6a2` `prepareTile()`), liegt in `src/map2d/`, also Scope-Regel erfüllt; eigene Ursache, deshalb nicht in diesem Paket.

## Abgleich

Zeilennummern gegen `f9d0c6a2` (Paket 3), gemessen mit Node 24.21 gegen das
gebaute `dist/` desselben Stands, Methode wie `measureSettledBytes()` (200 Runden
Einschwingen, `gc()`, Minimum aus drei Messungen à 200 + 50 Runden). Werte unter
etwa 500 B je Runde sind Rauschen, wenn eine Runde nur einen Aufruf enthält — die
Einzelwerte »B/Aufruf« unten stammen aus Runden mit 1000 Aufrufen.

| Finding | Fundstelle jetzt (`src/map2d/…`) | Einordnung | gemessen |
| --- | --- | --- | --- |
| PERF-032 | `CameraBasedVisibility.ts:639` `computeTilesWithinCoords()` je Probe-Strahl (Audit `:553`) · `:789` `getTileCoords()` mit Tupel (Audit `:657`) · `:812` Closure an `forEachTileWithinConvexHull` (Audit `:664`) · `:369`–`:379` Objektliteral für `#deps.changed()` (Audit `:296`) · `convexTileHull.ts:22`, `:24`, `:36`, `:46`, `:61` fünf Arrays · `Map2DTileCoordsUtil.ts:163` Tupel, `:175` Ergebnisobjekt · `RectangularVisibilityArea.ts:122` Objektliteral, `:142` `computeTilesWithinCoords()` | umgeformt, alle vorhanden | gecachter Aufruf `CameraBasedVisibility` 128 B, mit gebrochenem Mittelpunkt und Raster 160 B · `RectangularVisibilityArea` 56 B bzw. 152 B · `convexTileHull()` mit 9 Punkten 1,7 KB · `getTileCoords()` 48 B |
| PERF-009 | Verdrängung `CameraBasedVisibility.ts:708`–`:712` (Audit `:595`) · neuer Slot `:586` · je neuem Slot `:885` (`coords`: Objekt + Tupel), `:893` (`centerWorld`), `:904` (`frustumBox`), `:983` (`box`), `:987` (`Map2DTileCoords` + `AABB2`) | umgeformt: Paket 3 hat `acceptTile()` in `prepareTile()`/`updateFrustumBox()`/`placeTile()` geteilt und nimmt Nachbarn auch unsichtbarer Tiles in die Frontier — der Ring getesteter, unsichtbarer Tiles wechselt seine Slots ebenfalls | Schwenk um ein Tile je Neuberechnung, Draufsicht: 41 KB je Neuberechnung bei 4 neuen Tiles; geneigte Kamera: 1,55 MB bei 47 neuen Tiles · Hülle `new Map2DTileCoords(x, y, new AABB2())` allein: 281 B |
| N1 | `CameraBasedVisibility.ts:302` `#visitedIds`, `:311` `#previousTilesById`, `:325` `#probeTileIds`, `:332` `#tileBoxPool`; Schlüssel aus `packTileCoords()` `:583`, `:606`, `:1010`; `clear()` `:594`, `:598`, `:602` | unverändert, nur verschoben | `Map.get()` mit `packTileCoords()`-Schlüssel 16 B je Zugriff · `Map` mit Smi-Schlüsseln bei 20 Wechseln je Runde auf 400 Einträge: 58 B je neuem Schlüssel (die Hash-Tabelle wird beim Füllen mit Löchern neu angelegt) · verkettete Tabelle in den Slot-Objekten: ≈ 0 |
| N2 | `CameraBasedVisibility.ts:727` `visibles.sort(sortByDistance)`, `:101` | unverändert, nur verschoben | 1,1 KB für 9 Einträge, 10–53 KB für 400 |
| N3 | `CameraBasedVisibility.ts:484`, `:493`, `:498`, `:562`, `:599`, `:611`, `:612`, `:737`, `:741`, `:785`; `RectangularVisibilityArea.ts:148`–`:150`, `:196` | umgeformt: `#frontier` hat Paket 3 schon auf `pop()` umgestellt (`:597`) | 400 Einträge nach `length = 0` neu füllen: 11,6 KB; nach `pop()` bis 0: ≈ 0 |

Dazu auf demselben Pfad gemessen, gleiche Ursache, gehört zum Ziel dieses
Pakets:

- Parameter `[centerX, centerY]` in `computeVisibleTiles()` beider Klassen
  (`CameraBasedVisibility.ts:427`, `RectangularVisibilityArea.ts:103`): ein
  destrukturiertes Tupel gebrochener Zahlen kostet 32 B je Aufruf, Lesen per
  Index 0.
- Zahlen in `Dependencies`: der generische Lesezugriff `nextProps[name]` boxt
  jeden Double bei jedem Aufruf, 16 B je Schlüssel — `frustumBoxScale` (1.1),
  `maxVisibleTiles` (10 000 ist ein Smi, `Infinity` nicht), ein gebrochenes
  `depth`, und in `RectangularVisibilityArea` `centerX`/`centerY`. Ein Smi und
  ein Objekt kosten nichts; `Dependencies#update()` alloziert nichts (gemessen).
- `camera.updateWorldMatrix(true, false)` und `Map2DTileCoordsUtil#copy()` mit
  gebrochenen Werten: 0 — bleiben, wie sie sind.

Stand vor dem Paket, als Referenz für den roten Lauf:

| Szenario | `CameraBasedVisibility` | `RectangularVisibilityArea` |
| --- | --- | --- |
| Aufruf ohne Änderung (Cache-Pfad) | 128–160 B | 56–152 B |
| Neuberechnung, gleiche Tiles, Draufsicht (16 sichtbar) | 35,7 KB | 2,7 KB (80 Tiles) |
| Neuberechnung, gleiche Tiles, geneigt, 100er-Raster (2616 sichtbar) | 1,50 MB ≈ 575 B je Tile | — |
| Schwenk, je neuem Tile | 10,3 KB (Draufsicht) · 33 KB (geneigt) | 637 B |
| Dauer einer Neuberechnung | 33 µs Draufsicht · 173 µs geneigt/400er-Raster (208 sichtbar) · 2 ms geneigt/100er-Raster | — |

## Entscheidungen dieses Pakets

- **Eigene Slot-Tabelle statt `Map`.** Smi-Schlüssel allein genügen nicht: eine
  `Map` legt ihre Hash-Tabelle neu an, wenn Löschen und Einfügen sie gefüllt
  haben, beim Schwenken 58 B je neuem Tile. Eine verkettete Tabelle, deren Glied
  im Slot selbst liegt, verändert beim Einfügen und Entfernen nur Zeiger. Der
  Hash ist ein Bucket-Index, kein Schlüssel: verglichen wird exakt auf `x`/`y`,
  `tileKeys` bleibt das eine Schlüsselschema (`docs/architecture.md`, Absatz
  `map2d/`).
- **Stempel statt `Set`s.** »In dieser Neuberechnung besucht«, »von einem
  Probe-Strahl getroffen« und »ein Tile aus `previousTiles`« werden als Nummer
  der Neuberechnung (`#serial`) am Slot vermerkt. Kein `clear()`, kein
  Wiederauffüllen.
- **`previousTiles` über die Slot-Tabelle.** Jedes Tile aus `previousTiles`
  bekommt zu Beginn seinen Slot und den Stempel; im eingeschwungenen Takt sind
  das die Slots des letzten Laufs, also Treffer ohne Neubau. Nicht besuchte
  werden am Ende verdrängt wie jeder andere Slot.
- **Free-List begrenzt auf die Poolgröße nach der Verdrängung**, nicht auf die
  sichtbare Menge, wie PERF-009 empfiehlt: der Pool umfasst seit Paket 3 auch den
  Ring getesteter, unsichtbarer Tiles, und genau so viele Slots braucht die
  nächste Neuberechnung einer ähnlichen Sicht. Schrumpft die Sicht, geht der
  Überschuss an den GC.
- **`Map2DTileCoords` wird nicht recycelt.** Der Aufrufer hält die Hülle eines
  Tiles, das die Sicht verlassen hat (in `removeTiles`, im Renderer); sie
  umzuschreiben hieße, ihm Daten unter den Füßen zu ändern. Die Hülle ist die
  zugelassene Allokation des Ziels. Die Empfehlung von PERF-009 lässt beides zu.
- **Skalare außerhalb von `Dependencies`.** `depth`, `frustumBoxScale`,
  `maxVisibleTiles`, `lookAtCenter` (bzw. `centerX`/`centerY`) werden gegen
  private Felder der letzten Neuberechnung verglichen; `Dependencies` behält die
  Objekte über ein Scratch-Objekt. `Dependencies` selbst bleibt unverändert: der
  Boxing-Effekt steckt im generischen Lesezugriff und ist dort nicht zu beheben,
  ohne die Klasse umzubauen.
- **Sortierung ohne Comparator, zwei Wege.** Unter dem Limit liegt `#kept` in der
  Reihenfolge, in der die Suche die Tiles nahm — nach Distanz, bis auf Tiles, die
  ein näherer Nachbar erst spät erreichte, jedes höchstens eine Tile-Diagonale
  näher als das Tile, von dem aus es gefunden wurde. Darauf ist Insertion Sort
  fast linear und stabil. Am Limit ist `#kept` ein Max-Heap; Heapsort an Ort und
  Stelle über das vorhandene `siftDownKept()`. Vertrag bleibt »aufsteigend nach
  `distanceToCamera`«; die Reihenfolge gleich weit entfernter Tiles ist nicht
  Teil davon (die Specs prüfen nur die Distanzen).
- **Hilfsfunktion `truncateArray()` in `src/utils/`**, nicht exportiert, wie
  `expectDefined` und `describeValue`: dieselbe Regel gilt an 15 Stellen in zwei
  Klassen und in `convexTileHull.ts`.
- **Test `drops the pooled TileBox of a tile that is no longer visited`
  (`CameraBasedVisibility.spec.ts:525`) wird ersetzt**, nicht angepasst: er hält
  genau das Verhalten fest, das PERF-009 ändert (ein verdrängter Slot geht an den
  GC).
- **Außerhalb des eingeschwungenen Takts und bleibt:** `pointOnPlane = new
  Vector3()` nach einer Neuberechnung, in der die Kamera an der Ebene
  vorbeisah; der wachsende `Uint8Array` von `RectangularVisibilityArea`; der
  Neubau von Slots, solange die Free-List leer ist (erste Neuberechnungen,
  wachsende Sicht); `warnCapped()`; das Wachsen der Slot-Tabelle.
- **Keine Migration-Guide-Sektion.** Signaturen ändern sich nur additiv; die
  Wiederverwendung der `TileBox`-Objekte steht als Vertrag im JSDoc von
  `visibles` und als Satz im CHANGELOG. Commit-Typ `perf`, kein `!`.

## Vorgehen

Alle Pfade relativ zu `packages/twopoint5d/`. Code, Kommentare und Doku
englisch. Tupel im heißen Pfad per Index lesen, nicht destrukturieren, sobald
sie gebrochene Zahlen tragen können. Keine Finding-IDs und kein Satz über den
Vorzustand in Code, Kommentaren, Tests, Doku oder CHANGELOG.

### Schritt 1 — Allokations-Spec zuerst, rot sehen

Neu `src/map2d/hot-path-allocations.spec.ts`, aufgebaut wie
`src/map2d/TileSprites/hot-path-allocations.spec.ts`: Grenzwerte als Konstanten
mit einem Kommentar, was beim Setzen gemessen wurde. Messung ausschließlich
über `measureSettledBytes()` aus `../testing/measureSettledBytes.js`.

Konstanten:

- `BYTES_PER_CALL_LIMIT = 1` — für Runden aus 1000 Aufrufen, wie in den anderen
  Specs.
- `BYTES_PER_RECOMPUTATION_LIMIT = 8` — die Hälfte des kleinsten Heap-Objekts
  (16 B): eine einzige Allokation je Neuberechnung fällt auf, das Rauschen von
  einigen hundert Byte je Runde verteilt sich auf 100 Neuberechnungen.
- `BYTES_PER_TILE_MARGIN = 8` — was ein Tile, das die Sicht betritt, über seine
  Hülle hinaus kosten darf.

Gemeinsame Werte, gebrochen, damit Doubles durch jede Signatur laufen: Raster
`new Map2DTileCoordsUtil(100, 100, 0.25, -0.5)`, Mittelpunkt als eine
wiederverwendete Instanz `const center: [number, number] = [3.25, -1.5]`,
`matrixWorld = new Matrix4().makeTranslation(0.25, 0, 0.75)` und als zweite
Stellung `new Matrix4().makeTranslation(0.25, 0, 0.7501)`. `previousTiles` ist
immer `result.tiles` des vorigen Aufrufs, wie `Map2DTileStreamer` es übergibt.
Kameras wie in `CameraBasedVisibility.spec.ts`: Draufsicht
(`PerspectiveCamera(90, 1, 0.1, 500)`, Position `(0, 100, 0)`, `lookAt(0, 0,
0)`) und geneigt (`PerspectiveCamera(75, 1.6, 0.1, 4000)`, Position `(0, 350,
500)`, `lookAt(0, 0, 0)`), je mit `updateMatrixWorld()` und
`updateProjectionMatrix()`.

Tests (Namen englisch, sinngemäß so):

1. `CameraBasedVisibility`: `a call that finds nothing changed allocates
   nothing` — Draufsicht, 1000 Aufrufe je Runde, `< BYTES_PER_CALL_LIMIT` je
   Aufruf.
2. `a recomputation over the same tiles allocates nothing` — Draufsicht, jeder
   Aufruf wechselt zwischen den beiden `matrixWorld`-Instanzen; vorab prüfen,
   dass beide Stellungen dieselben Tile-Ids ergeben. 100 Neuberechnungen je
   Runde, `< BYTES_PER_RECOMPUTATION_LIMIT` je Neuberechnung.
3. `a recomputation allocates nothing per tile, however many tiles the view
   holds` — geneigte Kamera auf `new Map2DTileCoordsUtil(400, 400, 0.25, -0.5)`
   (≈ 208 sichtbar), 10 Neuberechnungen je Runde mit wechselndem `matrixWorld`,
   Bytes je Neuberechnung geteilt durch `visibles.length` `<
   BYTES_PER_CALL_LIMIT`.
4. `a recomputation the limit cuts allocates nothing per tile` — wie 3 mit
   `maxVisibleTiles = 100`; `console.warn` per `vi.spyOn(console,
   'warn').mockImplementation(() => {})` stumm und danach wiederhergestellt;
   prüfen, dass `visibles.length === 100`.
5. `a tile that enters the view costs its Map2DTileCoords and nothing else` —
   Draufsicht, jede Neuberechnung schiebt `center[0]` um genau eine Tile-Breite
   (100) weiter; 100 Neuberechnungen je Runde. In der Runde die Längen von
   `createTiles` sammeln und danach prüfen, dass sie alle gleich und > 0 sind.
   Im selben Test die Hülle messen: eine Runde, die genauso viele `new
   Map2DTileCoords(x, y, new AABB2())` baut, je Schritt eine neue Spalte `x` mit
   denselben Zeilen `y`, `x` in derselben Größenordnung, die der Schwenk
   erreicht (die Id-Strings sollen gleich lang sein). Behauptung: Bytes je neuem
   Tile minus Bytes je Hülle `< BYTES_PER_TILE_MARGIN`.
6. `RectangularVisibilityArea` (`new RectangularVisibilityArea(1000.5,
   800.25)`): Aufruf ohne Änderung (1000 je Runde, `< BYTES_PER_CALL_LIMIT`);
   Neuberechnung derselben Tiles über `needsUpdate = true` vor jedem Aufruf (100
   je Runde, `< BYTES_PER_RECOMPUTATION_LIMIT`); Schwenk um eine Tile-Breite je
   Aufruf mit Hüllen-Vergleich wie in 5.
7. `Map2DTileCoordsUtil`: `getTileCoords() and computeTilesWithinCoords() with a
   target allocate nothing` — 1000 Aufrufe je Runde mit gebrochenen Argumenten,
   `< BYTES_PER_CALL_LIMIT`.

Dann rot laufen lassen und die Zahlen in den Report:
`pnpm nx test twopoint5d -- src/map2d/hot-path-allocations.spec.ts`. Erwartet
etwa die Werte der Tabelle »Stand vor dem Paket«; Test 7 ruft den
`target`-Parameter, den es noch nicht gibt, und alloziert deshalb.

Laufzeit: `measureSettledBytes()` fährt je Messung rund 950 Runden; mit den
Rundengrößen oben bleibt jeder Test unter etwa 3 s. Ist ein Test deutlich
langsamer, die Zahl der Neuberechnungen je Runde senken und den Grenzwert je
Runde entsprechend begründen, nicht die Grenzwerte lockern.

### Schritt 2 — `truncateArray()`

Neu `src/utils/truncateArray.ts`, nicht in `src/utils/public-api.ts`:

```ts
export function truncateArray(list: unknown[], length = 0): void {
  while (list.length > length) list.pop();
}
```

JSDoc: kürzt `list` auf `length` Einträge per `pop()`. Warum nicht
`list.length = n`: V8 gibt dabei den Backing Store frei (für 0 immer, sonst wenn
weniger als die Hälfte bleibt), und die nächste Füllung einer Liste, die jeder
Frame leert, legt ihn neu an; `pop()` behält ihn. Spec
`src/utils/truncateArray.spec.ts`: leert ohne `length`, kürzt auf `length` und
lässt die ersten Einträge stehen, lässt eine kürzere Liste unverändert.

Einsetzen an jeder Stelle, die eine Liste leert, die später wieder gefüllt wird:
`CameraBasedVisibility.ts:484`, `:493`, `:498`, `:562` (`pointsOnPlane`),
`:599`, `:611`, `:612`, `:737`, `:741`, `:785`, dazu die Schleife `:597`
(`#frontier`; ihr Kommentar `:595`–`:596` wandert sinngemäß ins JSDoc der
Hilfsfunktion) und `RectangularVisibilityArea.ts:148`–`:150`, `:196`.
`CameraBasedVisibilityHelpers.ts:254`–`:256` (in `dispose()`) bleibt.

### Schritt 3 — `Map2DTileCoordsUtil` mit `target`

```ts
getTileCoords(
  left: number,
  top: number,
  width: number,
  height: number,
  target?: [tileLeft: number, tileTop: number, columns: number, rows: number],
): [tileLeft: number, tileTop: number, columns: number, rows: number]

computeTilesWithinCoords(left: number, top: number, width: number, height: number, target?: TilesWithinCoords): TilesWithinCoords
```

- Mit `target` werden alle vier bzw. alle zehn Felder geschrieben und `target`
  zurückgegeben; ohne entsteht ein neues Tupel bzw. Objekt wie bisher. JSDoc
  `@param target` an beiden, im Stil von `AABB2.from()`.
- `computeTilesWithinCoords()` ruft `getTileCoords()` immer mit einem privaten
  Scratch-Tupel (`readonly #tileCoords: [number, number, number, number] = [0,
  0, 0, 0]`) und liest es per Index — so alloziert es mit `target` nichts, ohne
  nur das Ergebnisobjekt.
- `src/map2d/Map2DTileCoordsUtil.spec.ts`: je Methode »answers the target it
  is handed«, »writes the values it answers without a target« (Vergleich mit
  dem Aufruf ohne), »overwrites every field of a target that held other values«.

### Schritt 4 — `convexTileHull(points, target)`

`convexTileHull.ts` ist intern (nicht in `public-api.ts`), die Signatur darf
sich ändern:

```ts
export function convexTileHull(points: readonly TilePoint[], target: TilePoint[] = []): TilePoint[]
```

- `target` wird geleert und mit der Hülle gefüllt und zurückgegeben; es darf
  nicht `points` sein (JSDoc).
- Arbeitsliste als Modul-Konstante (`const sorted: TilePoint[] = []`): Punkte
  hineinkopieren, per Insertion Sort nach `x`, dann `y` ordnen —
  `Array#sort()` legt ein Arbeitsarray an und ruft den Comparator (1,1 KB für 9
  Punkte gemessen) —, Duplikate an Ort und Stelle entfernen. JSDoc: gedacht für
  eine Handvoll Punkte, die Sortierung ist ein Insertion Sort.
- Andrew's Monotone Chain direkt in `target` schreiben, mit einem Index wie in
  der Ein-Array-Form des Algorithmus (untere Kette, dann obere Kette ab Länge
  der unteren + 1, am Ende auf die Hülle kürzen). Ergebnis: dieselben Punkte in
  derselben Reihenfolge wie heute (`lower` ohne letzten, dann `upper` ohne
  letzten), auch für die drei entarteten Fälle.
- Am Ende `truncateArray(sorted)`, damit das Modul keine Punkte eines Aufrufers
  festhält.
- `src/map2d/convexTileHull.spec.ts`: bestehende Tests bleiben unverändert grün;
  neu »writes the hull into the target and answers it«, »a target that held
  more points holds the hull alone afterwards«.

### Schritt 5 — `TileSlotTable`

Neu `src/map2d/TileSlotTable.ts`, intern (nicht in `public-api.ts`):

```ts
export interface TileSlotTableEntry<T> {
  x: number;
  y: number;
  nextInBucket: T | undefined;
}

export class TileSlotTable<T extends TileSlotTableEntry<T>> {
  constructor(capacity = 64);            // Zahl der Buckets, eine Zweierpotenz
  get size(): number;
  get(x: number, y: number): T | undefined;
  add(entry: T): void;                   // der Aufrufer stellt sicher, dass kein Eintrag derselben (x, y) darin steht
  remove(entry: T): void;                // hängt genau diesen Eintrag aus; einer, der nicht darin steht, bleibt unberührt
}
```

- Buckets: `(T | undefined)[]` der Länge `capacity`, angelegt mit `new
  Array<T | undefined>(capacity).fill(undefined)`; die Kette läuft über
  `nextInBucket`, `add()` hängt vorn ein, `remove()` sucht den Vorgänger in der
  Kette.
- Bucket-Index: `hashTileCoords(x, y) & (buckets.length - 1)`, ausschließlich
  Int32-Arithmetik (`Math.imul`, `^`, `>>>`), damit kein Zwischenwert als Double
  geboxt wird: `h = Math.imul(x, 0x9e3779b1) ^ y`, dann fmix32 aus MurmurHash3
  (`h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h =
  Math.imul(h, 0xc2b2ae35); h ^= h >>> 16`).
- `get()` vergleicht exakt `entry.x === x && entry.y === y`.
- `add()`: übersteigt `size` die Zahl der Buckets, verdoppeln und alle Einträge
  neu einhängen. Das ist die einzige Allokation der Klasse.
- Klassen-JSDoc: wozu (Slots nach Tile-Koordinate finden, ohne dass ein
  Schlüssel geboxt oder eine Hash-Tabelle neu angelegt wird), dass der Hash nur
  ein Bucket-Index ist.
- `src/map2d/TileSlotTable.spec.ts`: `get()` nach `add()`; `undefined` für eine
  fehlende Koordinate; ein Rechteck aus 64 × 64 Einträgen (erzwingt Ketten und
  mehrfaches Wachsen), jeden dritten entfernen, danach findet `get()` jeden
  übrigen und keinen entfernten, `size` stimmt; negative Koordinaten, `(3, 7)`
  und `(7, 3)` getrennt, Koordinaten an den Rändern von `packTileCoords()`
  (`±33554431`); `remove()` eines Eintrags, der nicht darin steht, ändert nichts.

### Schritt 6 — Slot-Pool von `CameraBasedVisibility` (PERF-009, N1)

- `PooledTileBox` (`:41`–`:48`) macht `coords: TilesWithinCoords`, `box: Box3`,
  `frustumBox: Box3`, `centerWorld: Vector3` zur Pflicht und bekommt
  `visitedStamp: number`, `probeStamp: number`, `previousStamp: number`,
  `nextInBucket: PooledTileBox | undefined`, je mit einem JSDoc-Satz.
  `PooledTileBox` erfüllt `TileSlotTableEntry<PooledTileBox>`. Die `!` an diesen
  Feldern entfallen.
- Modul-Funktion `createTileSlot(): PooledTileBox` baut jeden Slot mit allen
  Feldern in derselben Reihenfolge (eine Hidden Class): `id: 0, x: 0, y: 0`,
  `coords` mit allen zehn Feldern von `TilesWithinCoords` auf 0, `box` und
  `frustumBox` je `new Box3()`, `centerWorld: new Vector3()`, `distanceToCamera:
  0`, `map2dTile: undefined`, `primary: false`, `insideProbeHull: false`, die
  drei Stempel 0, `nextInBucket: undefined`.
- Felder ersetzen `#tileBoxPool`, `#visitedIds`, `#probeTileIds`,
  `#previousTilesById`: `readonly #slotTable = new
  TileSlotTable<PooledTileBox>()`, `readonly #slots: PooledTileBox[] = []`
  (jeder Slot der Tabelle, für die Verdrängung ohne Map-Iterator), `readonly
  #freeSlots: PooledTileBox[] = []`.
- Der Stempel einer Neuberechnung ist `this.#serial` (die erste Neuberechnung
  trägt 1, ein neuer Slot 0).
- `acquireTileBox(x, y)`: Treffer in `#slotTable.get(x, y)` → zurück. Sonst
  `this.#freeSlots.pop() ?? createTileSlot()`, dann `id = packTileCoords(x, y)`,
  `x`, `y`, `coords` über `computeTilesWithinCoords(x * tileWidth + xOffset, y *
  tileHeight + yOffset, 1, 1, slot.coords)` (der Kommentar »the query reads world
  coordinates…« von `:884` zieht mit), `map2dTile = undefined`,
  `#slotTable.add(slot)`, `#slots.push(slot)`. Die Stempel bleiben, wie sie
  sind — sie werden gegen die laufende Nummer verglichen.
- `prepareTile()`: kein `coords ??=`, kein `new Vector3()` mehr.
  `updateFrustumBox()`: kein `new Box3()`. `placeTile()`: kein `new Box3()`; `new
  Map2DTileCoords(tile.x, tile.y, new AABB2())` für einen Slot ohne Hülle bleibt
  — die eine Allokation eines Tiles, das die Sicht betritt.
- `enqueue()`: `if (tile.visitedStamp === stamp) return; tile.visitedStamp =
  stamp;` statt `#visitedIds`.
- `pushNeighbors()`: `this.enqueue(this.acquireTileBox(tx, ty), false)` — die
  Tabelle beantwortet ein besuchtes Tile ohne Neubau, der Vorab-Check mit
  `packTileCoords()` entfällt.
- Probe-Saat (`:647`–`:649`): `tile.probeStamp = stamp` statt
  `#probeTileIds.add()`; `primary` (`:721`–`:725`): `tile.primary =
  tile.probeStamp === stamp`.
- `previousTiles`: wo heute `#previousTilesById` gefüllt wird (`:601`–`:607`),
  für jedes Tile `this.acquireTileBox(previous.x, previous.y).previousStamp =
  stamp`. `placeTile()`: Wiederverwendung, wenn `!this.#tileGridChanged &&
  tile.previousStamp === stamp`, dann `tile.previousStamp = 0` und
  `reuseTiles.push(tile.map2dTile)`; sonst `createTiles.push(...)`.
- `removeTiles`: nach der Platzierungsschleife und **bevor** `#tiles` neu
  geschrieben wird (`previousTiles` kann `#tiles` sein): `#removeTiles` leeren,
  dann für jedes Tile aus `previousTiles` `const slot =
  this.#slotTable.get(previous.x, previous.y)!` (seit der Markierung in der
  Tabelle); trägt es `previousStamp === stamp`, das Tile anhängen und
  `slot.previousStamp = 0` — eine Koordinate, die zweimal in `previousTiles`
  steht, geht einmal hinaus, an ihrer ersten Stelle.
- Verdrängung (ersetzt `:704`–`:712`), nach `#tiles` und `#removeTiles`:
  `#slots` an Ort und Stelle verdichten — ein Slot mit `visitedStamp === stamp`
  bleibt, jeder andere: `#slotTable.remove(slot)`, `slot.map2dTile = undefined`
  (die Hülle gehört jetzt dem Aufrufer und wird nie wieder beschrieben),
  `#freeSlots.push(slot)`. Danach `truncateArray(this.#slots, write)` und
  `truncateArray(this.#freeSlots, this.#slots.length)`.
- `takeOverTileCoords()` (`:402`–`:405`): über `#slots` statt
  `#tileBoxPool.values()`; je Slot `coords` gegen das neue Raster neu schreiben
  (`computeTilesWithinCoords()` mit `slot.coords` als `target`) und `map2dTile =
  undefined`.
- Der Ausgang `hitCount === 0` lässt Tabelle, `#slots` und `#freeSlots`
  stehen, wie heute den Pool.
- Kommentare an den Feldern (`:300`–`:332`, `:704`–`:707`) auf die neue
  Struktur umschreiben: wofür die Tabelle, die Stempel, die Free-List und ihre
  Grenze da sind.

### Schritt 7 — Rest der Neuberechnung (PERF-032)

- `computeVisibleTiles(previousTiles, centerPoint, map2dTileCoords,
  matrixWorld)` in beiden Klassen: `centerPoint[0]`/`centerPoint[1]` per Index
  statt `[centerX, centerY]` in der Signatur. Ein Kommentar, warum.
- `CameraBasedVisibility#dependenciesChanged()`: `depth`, `frustumBoxScale`,
  `maxVisibleTiles`, `lookAtCenter` verlassen `#deps` und werden gegen private
  Felder der letzten Neuberechnung verglichen (`#seenDepth = NaN`,
  `#seenFrustumBoxScale = NaN`, `#seenMaxVisibleTiles = NaN`,
  `#seenLookAtCenter: boolean | undefined = undefined` — `NaN`/`undefined`,
  damit der erste Aufruf als Änderung zählt), danach übernommen. `#deps` behält
  `centerPoint2D`, `map2dTileCoords`, `matrixWorld`, `cameraMatrixWorld`,
  `cameraProjectionMatrix` und wird über ein Scratch-Objekt
  `#dependencyValues` gerufen, dessen Felder jeder Aufruf neu beschreibt. Beide
  Hälften laufen immer, damit der Schnappschuss aktuell bleibt: `const
  objectsChanged = this.#deps.changed(values); const scalarsChanged = …; return
  objectsChanged || scalarsChanged;`. Kommentar: ein Double durch den
  generischen Lesezugriff von `Dependencies` wird bei jedem Aufruf geboxt.
- `RectangularVisibilityArea`: `centerX`/`centerY` ebenso gegen `#seenCenterX
  = NaN`/`#seenCenterY = NaN`; `#deps` behält `map2dTileCoords` und
  `matrixWorld` über ein Scratch-Objekt; `storedTileCoords` und der Kommentar
  »always ask…« (`:120`–`:121`) gelten sinngemäß für beide Hälften.
  `computeTilesWithinCoords(left, top, width, height, this.#tileCoords)` mit
  einem Scratch-Feld `readonly #tileCoords: TilesWithinCoords`.
- Probe-Saat (`:639`): `computeTilesWithinCoords(…, this.#probeArea)` mit
  `readonly #probeArea: TilesWithinCoords`.
- `collectTilesWithinProbeHull()`: `getTileCoords(coords2D.x, coords2D.y, 0, 0,
  this.#probeTileCoords)` mit Scratch-Tupel, per Index gelesen;
  `convexTileHull(points, this.#hull)` mit `readonly #hull: TilePoint[] = []`;
  der Besucher einmal als Feld gebunden: `readonly #enqueueHullTile = (x:
  number, y: number): void => this.enqueue(this.acquireTileBox(x, y), true);`.
- `poolAt()`-Fabriken als Modul-Konstanten statt Pfeil-Literalen je Aufruf
  (`:518`, `:574`, `:790`), z. B. `const newVector2 = (): Vector2 => new
  Vector2();`.
- Was danach im Spec noch auftaucht, gehört zu diesem Paket: per Halbierung
  eingrenzen, beheben, im Report nennen.

### Schritt 8 — Sortierung ohne Comparator (N2)

Ersetzt `:714`–`:716` und `:727`; `sortByDistance` (`:101`) entfällt.

- `kept.length < limit` (nie zum Heap gemacht): `#kept` vorwärts nach
  `visibles` kopieren, dann Insertion Sort auf `distanceToCamera`, stabil
  (verschieben, solange der Vorgänger `>` ist). Kommentar: die Suche nimmt die
  Tiles nach Distanz, bis auf Tiles, die ein Nachbar spät erreicht, jedes
  höchstens eine Tile-Diagonale näher — fast sortiert, fast linear.
- `kept.length >= limit` (Max-Heap seit `heapifyKept()`): Heapsort an Ort und
  Stelle. `siftDownKept(start, tile, length = this.#kept.length)` bekommt die
  Heap-Länge als dritten Parameter; für `end` von `kept.length - 1` bis 1:
  `const last = kept[end]; kept[end] = kept[0]; this.siftDownKept(0, last,
  end);`. Danach ist `#kept` aufsteigend → vorwärts nach `visibles`.
- Danach `truncateArray(kept)`. Die `primary`-Schleife folgt wie heute.

### Schritt 9 — `CameraBasedVisibility.spec.ts`

- `drops the pooled TileBox of a tile that is no longer visited` (`:525`)
  ersetzen durch `hands the TileBox of a tile that is no longer visited to a
  tile that enters the view`: Aufwärmen bei `[0, 0]`, dann `[4000, 0]` und
  `[8000, 0]` wie heute; mindestens ein sichtbares `TileBox` des fernen Frames
  ist ein Objekt aus den Aufwärm-`visibles` (Identität), trägt die fernen `x`/`y`,
  `id === packTileCoords(x, y)`, und eine `map2dTile`, die keine der
  Aufwärm-Hüllen ist und dieselben `x`/`y` trägt.
- Neu `a TileBox handed on to another tile carries what a fresh visibility
  computes for that tile`: nach einem Schwenk über mehrere Neuberechnungen
  (Draufsicht und geneigte Kamera) jedes sichtbare Tile gegen eine frische
  `CameraBasedVisibility` mit derselben Kamera, demselben Raster, Mittelpunkt
  und `matrixWorld` halten, gepaart über `id`: gleiche `coords`, `box`,
  `frustumBox`, `centerWorld`, `distanceToCamera`, `primary`, `map2dTile.view`
  und dieselbe Reihenfolge der Distanzen.
- Alle übrigen Tests bleiben unverändert grün — insbesondere `low-GC:
  subsequent non-cached calls reuse the same TileBox objects…` (`:495`), die
  Klassifizierung create/reuse/remove (`:343`), die `primary`-Tests (`:740`,
  `:756`, `:780`) und der Block `maxVisibleTiles`.

### Schritt 10 — Doku

- JSDoc von `visibles` (`:277`–`:282`): die `TileBox`-Objekte gehören der
  Sichtbarkeit; die nächste Neuberechnung beschreibt sie neu, und eines, dessen
  Tile die Sicht verlassen hat, steht später für ein Tile, das sie betritt — wer
  eines über den nächsten Aufruf hinaus braucht, kopiert, was er davon braucht.
  Eine ausgegebene `Map2DTileCoords` behält ihr Tile; ein Tile, das die Sicht
  betritt, bekommt eine neue.
- JSDoc der neuen `target`-Parameter (Schritt 3) und von `convexTileHull()`
  (Schritt 4), Klassen-JSDoc von `TileSlotTable` (Schritt 5).
- `docs/architecture.md`, Absatz `### map2d/`: ein Satz — beide
  Sichtbarkeiten allozieren im eingeschwungenen Frame-Takt nichts,
  `src/map2d/hot-path-allocations.spec.ts` hält sie daran, und ein Tile, das die
  Sicht betritt, kostet seine `Map2DTileCoords`.
- `CHANGELOG.md`, `[Unreleased]`, nach dem Skill `updating-changelog`:
  - `### Added`: der optionale `target` von `Map2DTileCoordsUtil#getTileCoords()`
    und `#computeTilesWithinCoords()` — beschrieben und zurückgegeben, ohne zu
    allozieren; ohne ihn ein neues Tupel bzw. Objekt.
  - `### Changed`: ein `perf`-Eintrag — `computeVisibleTiles()` beider
    Sichtbarkeiten alloziert im eingeschwungenen Frame-Takt nichts, weder je
    Aufruf noch je Tile; ein Tile, das die Sicht betritt, kostet seine
    `Map2DTileCoords`; `visibles` wird ohne Comparator sortiert; ein `TileBox`
    aus `CameraBasedVisibility#visibles`, dessen Tile die Sicht verlässt, wird
    für ein eintretendes Tile neu beschrieben — wer eines über die nächste
    Neuberechnung hinaus hält, kopiert, was er braucht.
  - Den `### Fixed`-Eintrag zum `TileBox`-Pool (Zeile 344, »fix the `TileBox`
    pool of `CameraBasedVisibility`…«) gegen das neue Verhalten lesen: er bleibt
    wahr, weil die Free-List an die Poolgröße gebunden ist. Nur ändern, wenn
    ein Satz darin nicht mehr stimmt.

### Schritt 11 — Verify

`pnpm run ci` im Repo-Root, grün. Report: roter Lauf aus Schritt 1 mit Zahlen,
grüner Lauf des Allokations-Specs mit den gemessenen Werten je Test, die in die
Kommentare der Grenzwert-Konstanten gehören.

## Findings im Volltext

**PERF-032 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:553** —
Kurzlebige Allokationen pro Neuberechnung aus `CameraBasedVisibility` herausnehmen
(weitere Fundstellen im Audit: `CameraBasedVisibility.ts:657`, `:664`, `:296`,
`convexTileHull.ts:22`, `Map2DTileCoordsUtil.ts:163`, `:175`,
`RectangularVisibilityArea.ts:122`)

Die Klasse hält ihre Arbeitspuffer ausdrücklich über Frames hinweg (»Per-frame
scratch buffers — reused across calls to keep GC pressure low«, Z. 236), trotzdem
entstehen in jedem Frame mit bewegter Kamera rund 30 kurzlebige Objekte,
unabhängig von der Zahl der Tiles: pro Probe-Strahl `computeTilesWithinCoords()`
mit Tupel und Ergebnisobjekt (Z. 553, bis zu 9×) und `getTileCoords()` mit Tupel
(Z. 657), dazu die Closure an `forEachTileWithinConvexHull` (Z. 664) und in
`convexTileHull()` fünf Arrays (`[...points]`, `unique`, `lower`, `upper`,
`concat`). Das Objektliteral für `this.#deps.changed({...})` (Z. 296) entsteht in
jedem Frame, auch wenn die Kamera still steht; dasselbe gilt für
`RectangularVisibilityArea` (Z. 122). Aufrufpfad: `Map2D.update()` →
`Map2DTileStreamer.update()` → `computeVisibleTiles()`. Einzeln ist das billig;
im rAF-Takt bleibt es aber ein stetiger Minor-GC-Zufluss in genau der Klasse, die
ihn vermeiden will.

Evidenz: `const around = this.#map2dTileCoords.computeTilesWithinCoords(...)`;
`const sorted = [...points].sort(byXThenY);` … `return lower.concat(upper);`

Empfehlung: `computeTilesWithinCoords()` und `getTileCoords()` einen optionalen
`target`-Parameter geben (wie `AABB2.from`), `convexTileHull()` mit
wiederverwendeten Arbeits-Arrays und einem Ziel-Array aufrufbar machen, die
Hull-Closure einmal als Feld binden und das Deps-Objekt als Scratch-Feld halten,
das pro Frame nur beschrieben wird.

**PERF-009 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:595** —
Verdrängte TileBox-Slots über eine Free-List wiederverwenden (weitere
Fundstellen im Audit: `:505`, `:684`, `:704`, `:708`)

Ein Pool-Slot, den eine Neuberechnung nicht besucht, wird aus `#tileBoxPool`
gelöscht und dem GC überlassen. Beim Schwenken verlassen also in jedem Frame
Reihen von Tiles die Sicht, während am anderen Rand gleich viele neu hinzukommen
— und für jedes neue Tile entstehen der Slot `{id, x, y}`, ein
`TilesWithinCoords` samt Tupel, zwei `Box3` (je drei Objekte), ein `Vector3` und
ein `Map2DTileCoords` mit `AABB2` und String-Id (`tileKey`): etwa ein Dutzend
Allokationen pro Tile, genau in den Frames, in denen die Kamera sich bewegt.
Aufrufpfad: `Map2D.update()` → `Map2DTileStreamer.update()` →
`findVisibleTiles()` → `acquireTileBox()`/`prepareTile()`/`acceptTile()`.

Evidenz: `for (const id of this.#tileBoxPool.keys()) { if
(!this.#visitedIds.has(id)) { this.#tileBoxPool.delete(id); } }`

Empfehlung: Verdrängte Slots in eine Free-List legen, deren Länge auf die Größe
der letzten sichtbaren Menge begrenzt ist, und `acquireTileBox()` daraus bedienen
(`x`, `y`, `id` neu setzen, `coords` neu berechnen). Der `map2dTile`-Shell bekommt
bei Wiederverwendung eine neue Id — entweder `Map2DTileCoords` mutierbar machen
oder nur Box3/Vector3 recyceln. Das hält den Speicher weiter an die Sicht
gebunden und nimmt den GC aus dem Schwenk.

**N1 · medium · Nebenbefund aus Zug 0 von Paket 3** —
`CameraBasedVisibility.ts` (damals `:237`, `:239`, `:254`, `:261`; jetzt siehe
Abgleich): die `Set`s und `Map`s der Neuberechnung sind mit `packTileCoords()`
geschlüsselt, einem Wert ≥ 2^51 und damit nie ein Smi: jeder `get`/`has` boxt den
Schlüssel (gemessen 16 B je Zugriff, Node 24.21), und `clear()` mit
Wiederauffüllen baut die Hash-Tabellen jedes Mal neu auf (400 Einträge: 27 KB je
`Set`, 35 KB je `Map`) — pro Tile und Nachbar statt der rund 30 Objekte je
Frame, die PERF-032 zählt.

**N2 · low · Nebenbefund aus Zug 0 von Paket 3** — `CameraBasedVisibility.ts`
(damals `:610`, jetzt `:727`): `visibles.sort(sortByDistance)`: V8 boxt jedes
Comparator-Ergebnis und legt ein Arbeitsarray an, gemessen 10 KB (vorsortiert)
bis 53 KB (gemischt) je Sortierung von 400 Tiles; die Reihenfolge ist Vertrag
(Entscheidung vom 2026-09-28), gebraucht wird eine Sortierung ohne
Comparator-Aufrufe.

**N3 · low · Nebenbefund aus Zug 0 von Paket 3** — `CameraBasedVisibility.ts`
und `RectangularVisibilityArea.ts` (Stellen jetzt siehe Abgleich): Listen, die
jede Neuberechnung füllt, werden per `length = 0` geleert; V8 gibt dabei den
Backing Store frei, das Wiederauffüllen legt ihn neu an (gemessen 29 B je
Eintrag; `pop()` bis zur Länge 0 kostet nichts).
