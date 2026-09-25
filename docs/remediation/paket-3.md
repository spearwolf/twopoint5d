# Paket 3 — Spatial-Hash-Grid, Tile-Koordinaten und RectangularVisibilityArea

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-104 (low), CONS-053 (low), TEST-028 (low), DOC-029 (low), TYPE-017 (info), CONS-049 (info), API-057 (info), DOC-051 (info), TYPE-018 (info)
- Nebenbefund aufgenommen: `CameraBasedVisibilityHelpers.ts:100-101` — die TSDoc an `show` verschweigt dieselbe Bedingung wie DOC-051 (gleiche Ursache, siehe Abgleich)
- Ziel: Das Grid verliert keine Punkt-Renderables und keine mutierten AABBs, Maße werden überall gleich validiert, und TSDoc und Typen von Koordinaten-Util und Visibility-Helfern sagen, was der Code tut.
- Modell: mittlere Stufe
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`):
  - `src/map2d/Map2DSpatialHashGrid.ts`, `src/map2d/Map2DSpatialHashGrid.spec.ts`
  - `src/map2d/RectangularVisibilityArea.ts`, `src/map2d/RectangularVisibilityArea.spec.ts`
  - `src/map2d/Map2DTileCoordsUtil.ts`, `src/map2d/Map2DTileCoordsUtil.spec.ts`
  - `src/map2d/types.ts` (nur die TSDoc von `IMap2DVisibilitorHelpers#dispose`)
  - `src/map2d/RectangularVisibilityAreaHelpers.ts` (nur TSDoc), `src/map2d/RectangularVisibilityAreaHelpers.spec.ts`
  - `src/map2d/CameraBasedVisibilityHelpers.ts` (nur TSDoc von `show`)
  - `CHANGELOG.md` (`## [Unreleased]`: `### Changed`, `### Fixed`, `### Migration Guide`)
- Browsertests: keine. Nichts in diesem Paket ist Rendering- oder GPU-Buffer-Code; Grid, Koordinaten-Util und `RectangularVisibilityArea` sind reine Logik, die Helper-Änderungen reine TSDoc.
- Vorgehen:
  1. **Zuerst lesen:** `AGENTS.md` im Repo-Root, dann die betroffenen Module ganz
     (`cat packages/twopoint5d/src/map2d/{Map2DSpatialHashGrid,Map2DTileCoordsUtil,RectangularVisibilityArea,RectangularVisibilityAreaHelpers,types}.ts`),
     und für CHANGELOG-Einträge den Skill `updating-changelog`.
  2. **BUG-104 — Regressionstests zuerst, rot sehen.** In `Map2DSpatialHashGrid.spec.ts`
     vier Tests ergänzen und mit `pnpm nx test twopoint5d -- src/map2d/Map2DSpatialHashGrid.spec.ts`
     rot laufen lassen (die Ausgabe des roten Laufs gehört in den Report). Werte auf einem
     Grid `new Map2DSpatialHashGrid(100, 100)`:
     - `a renderable of zero size on a cell border lies in the cell of its corner`:
       `p = {aabb: new AABB2(100, 100, 0, 0)}` → nach `add(p)` hält `getTile(1, 1)` `p`, und
       `findWithin(new AABB2(50, 50, 100, 100))` enthält `p`. Dazu eine Linie
       `l = {aabb: new AABB2(100, 0, 0, 50)}` → `getTile(1, 0)` hält `l`.
       (Heute ergibt `getTileCoords(100, 100, 0, 0)` `columns = 0`, also kein Eintrag.)
     - `remove() takes a renderable out of the cells it was added to after its aabb changed`:
       `a = {aabb: new AABB2(10, 20, 150, 150)}` → `add(a)` (Zellen 0..1 × 0..1), dann
       `a.aabb.set(310, 310, 10, 10)`, dann `remove(a)` → `getTiles(-1, -1, 6, 6)` ist `undefined`.
     - `adding a renderable again moves it to the cells of its aabb now`:
       `a = {aabb: new AABB2(10, 10, 10, 10)}` → `add(a)`, `a.aabb.set(210, 210, 10, 10)`,
       `add(a)` → `getTile(0, 0)` ist `undefined`, `getTile(2, 2)` hält `a`.
     - `findWithin() with an aabb of zero size looks into the cell its corner lies in`:
       `p = {aabb: new AABB2(100, 100, 0, 0)}` → `add(p)`;
       `findWithin(new AABB2(100, 100, 0, 0))` enthält `p`.
  3. **BUG-104 — Fix in `Map2DSpatialHashGrid.ts`** (Weg nach Entscheidung vom 2026-09-25:
     mindestens eine Zelle je Renderable und die gehashten Keys je Renderable merken, keine
     `update()`-Methode):
     - Neues privates Feld `readonly #cellKeys = new Map<Renderable, Map2DSpatialHashGridKeyType[]>();`
       mit einem kurzen Warum-Kommentar (die Zellen, in die `add()` ein Renderable gelegt hat,
       damit `remove()` sie findet, gleich was dessen `aabb` bis dahin sagt).
     - Neue private Methode `#cellsOf(aabb: AABB2): [tileLeft: number, tileTop: number, columns: number, rows: number]`:
       ruft `this.#tileCoordsUtil.getTileCoords(left, top, width, height)` und gibt
       `columns` und `rows` als `Math.max(1, …)` zurück. Kommentar: eine `aabb` reicht
       mindestens in die Zelle, in der ihre linke obere Ecke liegt — auch mit Breite oder
       Höhe 0 auf einer Zellgrenze, wo die Rechnung sonst 0 Spalten ergibt.
       `Map2DTileCoordsUtil#getTileCoords()` selbst bleibt unverändert (öffentliche Util,
       `RectangularVisibilityArea` und `CameraBasedVisibility` rechnen damit).
     - `add()`: je Renderable zuerst, falls `#cellKeys` es schon kennt, es aus diesen Zellen
       nehmen (dieselbe Routine wie `remove()`, als private Methode `#takeOut(renderable)`
       herausziehen), dann über `#cellsOf(renderable.aabb)` einsortieren, dabei die Keys in
       ein neues Array sammeln und in `#cellKeys` ablegen.
     - `remove()`: je Renderable `#takeOut(renderable)`: Keys aus `#cellKeys` holen (keine →
       nichts tun), aus jedem Zell-Set löschen, leere Sets aus `#tiles` entfernen,
       `#cellKeys.delete(renderable)`. Die aktuelle `aabb` wird in `remove()` nicht mehr gelesen.
     - `findWithin()`: statt `getTileCoords` ebenfalls `#cellsOf(aabb)` — dieselbe Zellregel
       für Einsortieren und Abfragen, sonst findet eine Punktabfrage das Punkt-Renderable an
       derselben Stelle nicht. Überladungen und `out`-Verhalten bleiben exakt wie sie sind.
     - TSDoc: eine Klassen-TSDoc über `Map2DSpatialHashGrid` (ein räumlicher Index über ein
       Kachelraster; jedes Renderable liegt in den Zellen, in die seine `aabb` beim `add()`
       reicht, mindestens einer); an `add()`: das Grid merkt sich die Zellen, ein später
       verändertes `aabb` lässt das Renderable, wo es liegt, bis es erneut `add()`iert
       (dann wandert es in die Zellen seiner aktuellen `aabb`) oder `remove()`t wird;
       an `remove()`: nimmt es aus den Zellen, in die `add()` es gelegt hat, gleich was seine
       `aabb` jetzt sagt; ein Renderable, das das Grid nicht hält, wird übergangen.
       In `findWithin()` den ersten Satz um die Zellregel ergänzen (mindestens die Zelle
       der linken oberen Ecke).
     Begründung für »erneutes `add()` verschiebt«: mit gemerkten Keys muss ein zweites
     `add()` desselben Renderables eine Semantik haben. Vereinigen hielte veraltete Zellen
     bis zum `remove()` in jedem `findWithin()`; Verschieben lässt das Grid immer genau die
     Zellen der zuletzt eingereichten `aabb` halten und gibt dem Aufrufer ohne neue Methode
     einen Weg, eine mutierte `aabb` nachzuziehen.
  4. **TEST-028** — den Test `without arguments it is a 1x1 grid` in
     `Map2DSpatialHashGrid.spec.ts` ersetzen: `grid = new Map2DSpatialHashGrid()`,
     `r = {aabb: new AABB2(0, 0, 2, 2)}`, `grid.add(r)`; erwarten, dass `getTile(0, 0)`,
     `getTile(1, 0)`, `getTile(0, 1)` und `getTile(1, 1)` je `r` halten und `getTile(2, 0)`,
     `getTile(0, 2)` und `getTile(2, 2)` `undefined` sind — das belegt Kantenlänge 1
     (rechte und untere Kante der AABB gehören nicht dazu).
  5. **CONS-053 — Regressionstest zuerst, rot sehen.** In `RectangularVisibilityArea.spec.ts`
     einen `describe('width and height')` mit:
     - `test.each([-1, NaN, Infinity, -Infinity])` je für den Konstruktor als `width`
       (`new RectangularVisibilityArea(v, 240)`) und als `height` (`new RectangularVisibilityArea(320, v)`):
       `toThrow(RangeError)`.
     - Setter: `area = new RectangularVisibilityArea(320, 240)`; `area.width = -1` wirft
       `RangeError`, danach `area.width === 320`; dasselbe für `height` mit `240`.
     - `0` bleibt erlaubt: `area.width = 0` wirft nicht, `computeVisibleTiles(...)` gibt
       `undefined`; `area.width = 320` danach liefert wieder ein Ergebnis.
     Rot vor dem Fix sind die `toThrow`-Erwartungen.
  6. **CONS-053 — Fix in `RectangularVisibilityArea.ts`**: eine nicht exportierte
     Modulfunktion
     `function assertAreaSize(value: number, name: 'width' | 'height'): void`, die bei
     `value !== 0 && !isPositiveFinite(value)` wirft:
     `` new RangeError(`[RectangularVisibilityArea] ${name} must be 0 or a finite number above 0, got ${String(value)}`) ``
     (`isPositiveFinite` aus `../utils/isPositiveFinite.js`). Beide Setter rufen sie als
     erste Zeile, vor dem Vergleich mit dem alten Wert; der Konstruktor läuft bereits über
     die Setter. TSDoc an beiden Gettern: Breite bzw. Höhe der sichtbaren Fläche in
     Weltkoordinaten, um den Mittelpunkt, den der Streamer übergibt; `0` schaltet die
     Fläche aus — `computeVisibleTiles()` antwortet `undefined`, solange eine Seite 0 ist;
     jeder andere Wert muss eine endliche Zahl über 0 sein, sonst `RangeError`, und der
     Wert bleibt, was er war.
     **Abweichung von der Empfehlung** (»`assertPositiveFinite` nutzen«): die Funktion
     weist 0 ab, und 0 ist hier der dokumentierte Aus-Schalter; ihre Meldung (»must be a
     finite number above 0«) nennte einen gültigen Wert ungültig. Das Meldungsformat
     `[Klasse] name must be …, got …` bleibt das von `assertPositiveFinite`.
  7. **DOC-029 — `TilesWithinCoords` in `Map2DTileCoordsUtil.ts:3-56`**, TSDoc je Feld:
     - `top`: die obere Kante der Fläche relativ zum Ursprung des Kachelrasters,
       `tileTop * tileHeight`, ohne den `yOffset` des Rasters.
     - `left`: dasselbe mit `tileLeft * tileWidth` und `xOffset`.
     - `height`: die Höhe der Fläche in Weltkoordinaten, `rows * tileHeight`.
     - `width`: `columns * tileWidth`.
     - `rows`: die Zahl der Zeilen, die die Fläche überspannt — Kacheln entlang der y-Achse.
     - `columns`: die Zahl der Spalten — Kacheln entlang der x-Achse.
     `tileTop`, `tileLeft`, `tileHeight`, `tileWidth` bleiben. In
     `Map2DTileCoordsUtil.spec.ts` unter `describe('computeTilesWithinCoords()')` einen Test
     `rows counts along y, columns along x, and top and left leave the offset out`:
     `new Map2DTileCoordsUtil(16, 16, 20, 20).computeTilesWithinCoords(52, 36, 48, 16)`
     `toMatchObject({tileLeft: 2, tileTop: 1, left: 32, top: 16, width: 48, height: 16, columns: 3, rows: 1})`.
  8. **TYPE-017 — `Map2DTileCoordsUtil.ts:65-66`**: `#tileWidth!: number;` und
     `#tileHeight!: number;` werden zu `#tileWidth = 1;` und `#tileHeight = 1;` (die
     Voreinstellung des Konstruktors). Der Konstruktor schreibt weiter über die Setter, sein
     Kommentar bleibt.
  9. **CONS-049 und API-057 — TSDoc von `IMap2DVisibilitorHelpers#dispose` in
     `types.ts:235-246`.** Den Absatz »It may be called any number of times. Afterwards the
     set stays down: …« so fassen, dass er beide Lesarten deckt, und einen Absatz zur
     Zustandsfrage anhängen. Zielwortlaut (Zeilenumbruch frei):
     > It may be called any number of times. Afterwards the set stays down: a write to
     > `show`, {@link add}, {@link remove} and {@link update} build nothing and put nothing
     > into a scene. What `show` answers from then on is up to the implementation: one that
     > builds no nodes has nothing to keep down, fulfils all of this with an empty body, and
     > may let `show` answer what the caller writes.
     >
     > The interface does not say whether a set has been disposed. After `dispose()` every
     > member is a silent no-op, so a caller that holds a set has nothing to branch on; the
     > implementations in this package carry an `isDisposed` of their own.
     Der Absatz »Whatever was handed in …« bleibt. Kein `isDisposed` im Interface
     (Entscheidung vom 2026-09-25). Den Migration-Guide-Abschnitt »`IMap2DVisibilitorHelpers`
     requires a `dispose()`« im CHANGELOG gegenlesen: er sagt schon »an implementation that
     owns nothing writes an empty body … and `show` stays what the caller writes« und deckt
     sich dann mit der TSDoc; nur ändern, falls er ihr widerspricht.
  10. **DOC-051 — `RectangularVisibilityAreaHelpers.ts:33-38`**, TSDoc von `show`:
      »Whether the helper node is built at all. Switching it off takes the current node down
      and releases it. Switching it on builds the node right away when {@link add} has named
      a scene; without one, the first {@link update} after `add()` builds it.« Der Satz zum
      entsorgten Helper bleibt.
      **Nebenbefund gleicher Ursache — `CameraBasedVisibilityHelpers.ts:99-104`**, TSDoc von
      `show`: »switching it on builds the set again« ebenso fassen: »Switching it on builds
      the set right away when {@link add} has named a scene; without one, the first
      {@link update} after `add()` builds it.« (Setter ruft `update()`, das ohne Szene sofort
      zurückkehrt, `CameraBasedVisibilityHelpers.ts:109-119` und `:311-315`.)
  11. **TYPE-018 — `RectangularVisibilityAreaHelpers.spec.ts:79` und `:87`**:
      `Box3Helper` zum Typ-Import aus `three/webgpu` nehmen (`import type {Box3Helper, BufferGeometry, Material}`),
      `:79` wird `const node = scene.children[0] as Box3Helper;`, `:87`
      `expect((scene.children[0] as Box3Helper).geometry, 'and it keeps its geometry').toBe(geometry);`.
      `spyOnReleases()` (`:13-22`) bleibt: es liest Knoten beliebiger Bauart.
  12. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, Skill
      `updating-changelog`), Englisch, keine Finding-IDs:
      - `### Fixed`, am Ende: `Map2DSpatialHashGrid` legt ein Renderable mit Breite oder
        Höhe 0 auf einer Zellgrenze in die Zelle seiner linken oberen Ecke, wo `findWithin()`
        es findet; `remove()` nimmt ein Renderable aus jeder Zelle, in die `add()` es gelegt
        hat, auch wenn seine `aabb` sich seither geändert hat; `add()` eines Renderables,
        das das Grid schon hält, verschiebt es in die Zellen seiner aktuellen `aabb`;
        `findWithin()` mit einer `aabb` der Breite oder Höhe 0 schaut in die Zelle ihrer Ecke.
      - `### Changed`, direkt nach dem Eintrag »change a `tileWidth` or `tileHeight` that is
        not a finite number above 0 into a `RangeError` …«: `width` und `height` von
        `RectangularVisibilityArea`, die weder 0 noch eine endliche Zahl über 0 sind, werden
        zu einem `RangeError` mit Klasse, Property und Wert, geworfen von Konstruktor und
        Settern; 0 bleibt der Aus-Schalter.
      - `### Migration Guide`, neuer Abschnitt direkt nach »#### A tile grid of 0 is
        refused«, im selben Aufbau (ein Absatz, **Before**, **After**, plain `ts`-Blöcke):
        »#### The size of a `RectangularVisibilityArea` is checked« — Before: eine aus
        Viewport minus Rand berechnete Breite, die negativ werden kann; After: dieselbe mit
        `Math.max(0, …)`, Kommentar `// 0 switches the area off`, und eine Zeile mit der
        Meldung `// → RangeError: [RectangularVisibilityArea] width must be 0 or a finite number above 0, got -1`.
  13. `pnpm format` für Prettier, dann das Verify-Kommando.
- Verify: `pnpm run ci`
- Commit: `fix(map2d): let Map2DSpatialHashGrid put a renderable of zero width or height into the cell its corner lies in and take a renderable out of the cells it was added to whatever its aabb says by then, refuse a size of RectangularVisibilityArea that is neither 0 nor a finite number above 0, and let the docs of TilesWithinCoords, the visibility helpers and their interface say what the code does`
- Oberfläche, die sich bewegt (für `Schnittstellen:` nach dem Commit): `Map2DSpatialHashGrid#add()` eines gehaltenen Renderables verschiebt es in die Zellen seiner aktuellen `aabb` · `#remove()` liest die `aabb` nicht mehr · `#findWithin()` schaut bei Breite oder Höhe 0 in eine Zelle · `RectangularVisibilityArea` wirft `RangeError` für `width`/`height` außer 0 und endlich > 0 · Signaturen unverändert
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · BUG-104 unverändert (`Map2DSpatialHashGrid.ts:32-49`, `:51-69`) · CONS-053 verschoben (`RectangularVisibilityArea.ts:56-76`, `:84-86`, `:129-133`) · TEST-028 unverändert (`Map2DSpatialHashGrid.spec.ts:12-15`) · DOC-029 unverändert (`Map2DTileCoordsUtil.ts:7-15`, `:47-55`) · TYPE-017 unverändert (`Map2DTileCoordsUtil.ts:65-66`) · CONS-049 verschoben (`types.ts:240-241`) · API-057 verschoben (`types.ts:217-250`) · DOC-051 unverändert (`RectangularVisibilityAreaHelpers.ts:34-35`) · TYPE-018 unverändert (`RectangularVisibilityAreaHelpers.spec.ts:79`, dazu `:87`) · Folgen aus Paket 1 und 2: keine · Queue-Eintrag `CameraBasedVisibility.ts:80-81/:406-407` andere Ursache, bleibt liegen · Nebenbefund `CameraBasedVisibilityHelpers.ts:100-101` aufgenommen
  - 2026-09-25 Zug 1: Implementierer beauftragt (sonnet, effort medium), Session `remediate-twopoint5d-p3-impl-1`, Brief `paket-3.impl-1.brief.md`
  - 2026-09-25 Zug 2: Report FERTIG (session 3dd2e103-8f79-4c0b-9e26-4778d88b9f75), 11 Dateien geändert, keine neu · Arbeitsbaum schmutzig · rote Läufe belegt für Schritte 2 (4 rot) und 5 (10 rot) · Abweichungen: TSDoc/Kommentare knapper, Migration Guide zu `dispose()` unverändert · Nebenbefunde/Folgen: keine · Verify `pnpm run ci` exit=0 (`paket-3.verify.log`)
  - 2026-09-25 Zug 3: Reviewer beauftragt (sonnet, effort medium), Session `remediate-twopoint5d-p3-review-1`, Diff `paket-3.diff`
  - 2026-09-25 Zug 3: Urteil freigeben (session 4225168c-21c2-4d83-8b1e-a383bcfb1ae3), keine Befunde, alle neun Findings und der Nebenbefund behoben
  - 2026-09-25 Zug 4: entfällt, keine Runde
  - 2026-09-25 Zug 5: Commit 18b31272, Verify `paket-3.verify.log` exit=0 (keine Codeänderung seit Zug 2)

## Abgleich

Basis des Laufs ist `9a97f1bc` (Elter von `c152bab6`, dem ersten Paket-Commit).

- **BUG-104** — unverändert. `add()` `Map2DSpatialHashGrid.ts:32-49` und `remove()`
  `:51-69` rechnen die Zellen wie im Audit aus der aktuellen `aabb` über
  `Map2DTileCoordsUtil#getTileCoords()`. Nachgerechnet: `getTileCoords(100, 100, 0, 0)`
  auf einem 100er-Raster ergibt `tileLeft = 1`, `w = 0`, `columns = ceil(1 + 0) - 1 = 0`.
  Paket 2 hat nur `findWithin()`/`getTiles()` um `out` erweitert (`:71-112`).
- **CONS-053** — verschoben, Sachverhalt unverändert. Konstruktor und Setter
  `RectangularVisibilityArea.ts:51-76` prüfen nichts, `computeVisibleTiles()` prüft nur
  `=== 0` (`:84-86`), `new Uint8Array(tilesLength)` steht jetzt in `:129-133` (Paket 2 hat
  das Belegungs-Array wiederverwendbar gemacht). Bei einer negativen Seite wirft der erste
  Aufruf mit negativer Länge; hat die Fläche vorher schon mit gültigen Maßen gerechnet,
  greift der Längenvergleich nicht mehr (`length < tilesLength` ist bei negativer Länge
  falsch), und sie liefert stumm keine neuen Kacheln — ebenso bei zwei negativen Seiten,
  deren Produkt positiv wird, während die Schleifen über `rows`/`columns` nicht laufen.
- **TEST-028** — unverändert, `Map2DSpatialHashGrid.spec.ts:12-15`.
- **DOC-029** — unverändert. `rows`/`columns` vertauscht in `Map2DTileCoordsUtil.ts:47-55`;
  `top`/`left` »world space« in `:7-15`, während `computeTilesWithinCoords()` (`:176-177`)
  `tileTop * tileHeight` bzw. `tileLeft * tileWidth` ohne Offset liefert.
- **TYPE-017** — unverändert, `Map2DTileCoordsUtil.ts:65-66`.
- **CONS-049** — verschoben von `types.ts:200` nach `:240-241` (Paket 1 und 2 haben
  `types.ts` um TSDoc wachsen lassen). Die strenge Fassung »`show`, add, remove and update
  do nothing« steht; der Migration Guide im CHANGELOG (»`IMap2DVisibilitorHelpers` requires
  a `dispose()`«) trägt die lockere mit leerem Rumpf und `show` als Feld.
- **API-057** — verschoben, `IMap2DVisibilitorHelpers` jetzt `types.ts:217-250`, ohne
  `isDisposed`. Entscheidung vom 2026-09-25: bleibt so, die TSDoc hält es fest.
- **DOC-051** — unverändert, `RectangularVisibilityAreaHelpers.ts:34-35`. Der Setter
  (`:43-53`) ruft `update()`, das ohne Szene zurückkehrt (`:107`); `add()` (`:70-75`)
  baut nichts.
- **TYPE-018** — unverändert, `RectangularVisibilityAreaHelpers.spec.ts:79`; derselbe
  Knoten wird in `:87` noch einmal über eine anonyme Struktur geöffnet und gehört dazu.

## Triage

- `Folgen:` unter Paket 1 und Paket 2: keine.
- »Offene Befunde«: ein Eintrag, `CameraBasedVisibility.ts:80-81` und `:406-407`
  (Frustum ohne `coordinateSystem`/`reversedDepth`). Andere Ursache — Projektionsrechnung
  von `CameraBasedVisibility`, die dieses Paket nicht anfasst —, bleibt in der Queue.
- Nebenbefund aus diesem Zug 0, **vorbestehend** (`git show 9a97f1bc:packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`,
  Zeile 101, gleicher Wortlaut): `CameraBasedVisibilityHelpers.ts:100-101` sagt
  »switching it on builds the set again«, obwohl ohne Szene erst das `update()` nach
  `add()` baut. Gleiche Ursache wie DOC-051 (die `show`-TSDoc eines Helper-Sets
  verschweigt die Szenen-Bedingung), map2d, info → Scope; ins Paket aufgenommen, damit
  beide Helper-Klassen denselben Satz tragen.

## Restplan

Unverändert. Paket 4 (`chunk-quad-tree/`, `RepeatingTilesProvider.ts`) und Paket 5
(`TileSprites/`, map2d-Browsertests, Lookbook) teilen mit Paket 3 keine Datei außer dem
CHANGELOG, das sequenziell fortgeschrieben wird; keine Fundstelle ist gewandert, kein
Finding weggefallen, keine Folge zu verteilen.

## Findings im Volltext

**BUG-104 · low · packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:32-49** (auch `:51-69`) — Punkt-Renderables und mutierte AABBs im Spatial-Hash-Grid nicht verlieren
Ein Renderable mit Fläche 0 genau auf einer Tile-Grenze bekommt `columns = 0` und wird nie indiziert, `findWithin()` findet es nie. `remove()` rechnet die Buckets aus der *aktuellen* `aabb`. Wurde sie seit `add` verändert, bleiben Einträge in den alten Buckets zurück. Beides ist nicht dokumentiert.
Empfehlung: Mindestens eine Zelle erzwingen (`max(1, …)`), die gehashten Keys pro Renderable merken oder eine `update(renderable)`-Methode anbieten.

**CONS-053 · low · packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:51-67** (auch `:116-121`) — width und height von RectangularVisibilityArea validieren
Negative Werte laufen durch, geprüft wird nur `=== 0`. `rows * columns` wird negativ, und `new Uint8Array(tilesLength)` wirft einen `RangeError` tief in `update()`. Streamer, Util und Grid prüfen ihre Maße dagegen mit `assertPositiveFinite`.
Empfehlung: In den Settern `assertPositiveFinite` nutzen und 0 ausdrücklich als »aus« dokumentieren.

**TEST-028 · low · packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.spec.ts:12** — Der Gitter-Test belegt nur, dass der Konstruktor nicht wirft
Der Test »without arguments it is a 1x1 grid« prüft allein `getTile(0, 0) === undefined`; das gilt für jede Gittergröße. Die behauptete Kantenlänge prüft er nicht.
Empfehlung: Eine 2×2-AABB über `add()` einhängen und mit `getTiles(0, 0, 2, 2)` vier belegte Zellen erwarten — das zeigt die Kantenlänge 1.

**DOC-029 · low · packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.ts:47-55** — Die vertauschten Bedeutungen von rows und columns in TilesWithinCoords richtigstellen
`rows` ist als »number of tiles in a row« beschrieben, `columns` als »in a column«, also genau vertauscht. `top` und `left` heißen »world space«, sind aber grid-lokal ohne Offset. `TilesWithinCoords` ist öffentlich exportiert.
Empfehlung: TSDoc korrigieren: rows = Anzahl Zeilen, top/left relativ zum Grid-Ursprung ohne Offset.

**TYPE-017 · info · packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.ts:65** — Zwei Definite-Assignment-Assertions verdecken, dass der Konstruktor die Felder über Setter füllt
`#tileWidth!: number` und `#tileHeight!: number` schalten die Prüfung ab, obwohl der Konstruktor beide über die Setter belegt. Das `!` nimmt dem Typsystem genau die Kontrolle, die hier etwas zu sagen hätte.
Empfehlung: Die Felder im Konstruktor direkt belegen oder mit einem Default initialisieren, dann fällt das `!` weg.

**CONS-049 · info · packages/twopoint5d/src/map2d/types.ts:200** — Interface-TSDoc und Migration Guide beschreiben dasselbe dispose() streng und locker zugleich
Die TSDoc verlangt »Afterwards the set stays down: `show`, add, remove and update do nothing«, das Beispiel im Migration Guide zeigt `show = false` als schlichtes Feld und einen leeren `dispose()`-Rumpf. Beide Lesarten stehen jetzt nebeneinander, statt dass eine gewinnt.
Empfehlung: Die Interface-TSDoc um »an implementation that holds nothing has nothing to keep down« erweitern — dann deckt die strenge Fassung den leeren Rumpf mit ab.

**API-057 · info · packages/twopoint5d/src/map2d/types.ts:177** — isDisposed steht nicht im Interface der Visibility-Helfer
Wer eine `IMap2DVisibilitorHelpers` übernimmt, ohne die konkrete Klasse zu kennen, kann »ausgeschaltet« und »tot« nicht auseinanderhalten. Entschärft dadurch, dass nach `dispose()` alle Member stille No-Ops sind und `dispose()` idempotent ist — eine Verzweigung ist nirgends nötig, sie wäre nur informativ.
Empfehlung: Entscheiden, ob das Interface die Zustandsfrage überhaupt beantworten soll; wenn ja, `isDisposed` aufnehmen.
Entschieden (2026-09-25): kein `isDisposed`; die Interface-TSDoc hält fest, dass nach `dispose()` alle Member stille No-Ops sind und das Interface den Zustand deshalb bewusst nicht exponiert.

**DOC-051 · info · packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:35** — Die TSDoc an show verspricht einen Knoten, den erst das nächste update() baut
»switching it on builds it again, as soon as a scene is there to hold it« klingt, als käme der Knoten von allein hoch, sobald `add()` eine Szene nachreicht; gebaut wird er erst im nächsten `update()`.
Empfehlung: So formulieren wie in `add()` (`:64-66`) — dort steht die Bedingung genau.

**TYPE-018 · info · packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.spec.ts:79** — Der Spec macht einen Knoten über eine anonyme Struktur statt über seinen Typ auf
Der Zugriff läuft über `as unknown as {box: {max: {x: number}}; geometry: unknown}`, obwohl die Datei Typen aus `three/webgpu` importiert. Ein `as Box3Helper` trüge dieselbe Aussage und ließe einen Knoten anderer Bauart überhaupt erst auffallen.
Empfehlung: Auf `as Box3Helper` umstellen.

## Urteil des Reviewers (Zug 3, freigeben)

- BUG-104 — behoben: `Map2DSpatialHashGrid.ts` `#cellKeys`, `#cellsOf` mit `Math.max(1, …)`, `#takeOut`; `add()` verschiebt, `remove()` liest die `aabb` nicht, `findWithin()` über `#cellsOf`; vier Regressionstests in `Map2DSpatialHashGrid.spec.ts`.
- CONS-053 — behoben: `assertAreaSize` in `RectangularVisibilityArea.ts` als erste Zeile beider Setter, Getter-TSDoc, Tests in `RectangularVisibilityArea.spec.ts` `describe('width and height')`; Abweichung von `assertPositiveFinite` im Detailplan begründet.
- TEST-028 — behoben: `Map2DSpatialHashGrid.spec.ts:12-27`, vier belegte und drei leere Zellen.
- DOC-029 — behoben: Feld-TSDoc `TilesWithinCoords` in `Map2DTileCoordsUtil.ts`, Test `rows counts along y, columns along x, and top and left leave the offset out`.
- TYPE-017 — behoben: `#tileWidth = 1;`, `#tileHeight = 1;` in `Map2DTileCoordsUtil.ts`.
- CONS-049 — behoben: TSDoc `IMap2DVisibilitorHelpers#dispose` in `types.ts` deckt beide Lesarten; Migration Guide zu `dispose()` im CHANGELOG widerspricht nicht, unverändert.
- API-057 — behoben: dieselbe TSDoc hält fest, dass das Interface den Zustand nicht exponiert; kein `isDisposed`.
- DOC-051 — behoben: TSDoc `show` in `RectangularVisibilityAreaHelpers.ts`.
- Nebenbefund `CameraBasedVisibilityHelpers.ts` `show` — behoben, gleicher Wortlaut.
- TYPE-018 — behoben: `import type {Box3Helper, …}`, beide Stellen `as Box3Helper` in `RectangularVisibilityAreaHelpers.spec.ts`.
- Kleine Befunde: keine.
