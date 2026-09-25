# Paket 4 — Datenprovider: ChunkQuadTree und RepeatingTilesProvider

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-027 (low), PERF-019 (info), IMPL-010 (info), READ-012 (low), DOC-036 (low), CONS-037 (info) · dazu die map2d-Stelle von IMPL-001 (`DataIdsChunk2D.ts:39`, laut »Entscheidungen« hier aufgeräumt; das Finding selbst bleibt offen)
- Ziel: Nachgeladene Chunks bleiben unterteilbar, `subdivide()` bewertet Kanten über Präfixsummen, der chunk-quad-tree trägt keinen toten Code mehr, und `RepeatingTilesProvider` schreibt Zeilen über einen einzigen Wrap-Pfad.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts`
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts`
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts`
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/IDataChunk2D.ts`
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`: Changed, Removed, Migration Guide)
- Testflächen: nur Vitest. Kein Rendering- und kein GPU-Buffer-Code wird angefasst, ein Browsertest ist nicht nötig. Die Browser-Fixture `packages/twopoint5d-testing/test/helpers/fixtures.js:156` und die Lookbook-Demos nutzen `RepeatingTilesProvider` ohne `target` und `ChunkQuadTreeNode` nur mit einem einmaligen `subdivide()` (`apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts:161-163`) — beide bleiben unberührt.
- Verify: `pnpm run ci`
- Commit: siehe Abschnitt »Commit«
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · PERF-027 unverändert, Teil »keine Specs für
    appendChunk/findChunksAt/clear« gegenstandslos (`ChunkQuadTreeNode.extended.spec.ts:218`,
    `:373`, `:426`) · PERF-019 unverändert · IMPL-010 unverändert · IMPL-001-Stelle
    `DataIdsChunk2D.ts:39` unverändert · READ-012 umgeformt (7 statt 6 Kopien, Zweige
    divergieren weiter) · DOC-036 unverändert · CONS-037 unverändert
    (`RepeatingTilesProvider.spec.ts:383-389`) · Folgen: keine offen · Offene Befunde:
    1 Eintrag, andere Ursache, bleibt in der Queue · Restplan unverändert · Algorithmus
    für PERF-019 und Writer für READ-012 im Scratchpad gegengeprüft (0 Abweichungen)
  - 2026-09-25 Zug 1: Implementierer beauftragt, Sonnet (mittlere Stufe), Effort medium · Brief `paket-4.impl-1.brief.md`, Report `paket-4.impl-1.json`
  - 2026-09-25 Zug 2: Report FERTIG_MIT_VORBEHALT (Seed in 2a auf 47514 gewählt, weil ein vorbestehender Rekursionsfehler bei Null-Chunks den ersten Seed crashte; Nebenbefund) · 8 Dateien geändert (CHANGELOG, RepeatingTilesProvider{,.spec}, ChunkQuadTreeNode{,.extended.spec}, DataIdsChunk2D{,.spec}, IDataChunk2D) · rote Läufe 3a (2), 4a (2), 5a (5) belegt · Messung subdivide(8): 1k 38,0→5,9 ms, 20k 26.402→109 ms · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-4.verify.log`)
  - 2026-09-25 Zug 3: Reviewer beauftragt, Sonnet, Effort medium · Diff `paket-4.diff`
  - 2026-09-25 Zug 3: Reviewer `paket-4.review-1.json` · alle 7 Stellen behoben · freigeben mit 1 wichtig (CHANGELOG-perf-Eintrag spricht über den Vorzustand) · 2 klein
  - 2026-09-25 Zug 4 Runde 1: offen 1 wichtig (CHANGELOG perf-Eintrag) · Resume des Implementierers (Sonnet, medium), Brief `paket-4.impl-2.brief.md`
    · zurück FERTIG, eine CHANGELOG-Zeile · Verify `pnpm run ci` exit=0 (`paket-4.verify-runde-1.log`) · Review `paket-4.review-2.json`: erledigt, keine neuen Befunde, freigeben
  - 2026-09-25 Zug 5: Commit 584a675d, 8 Dateien, Pre-Commit-Hooks grün · Plan auf `[x]`, Nebenbefund in »Offene Befunde«

## Vorgehen

Vor der ersten Zeile: `AGENTS.md` lesen, dann die Dateien oben ganz (`cat`), nicht
Symbol für Symbol. Die Reihenfolge der Schritte ist Absicht: jeder Korrektheitsfix
beginnt mit einem Test, der vor dem Fix rot ist; die beiden reinen Umbauten
(Schritt 2 und 5) beginnen mit einem Test, der vor *und* nach dem Umbau grün ist.
Zum Iterieren genügt
`pnpm nx test twopoint5d -- src/map2d/chunk-quad-tree src/map2d/RepeatingTilesProvider.spec.ts`;
das Gate am Ende ist `pnpm run ci`.

### 1. Einrückung in `RepeatingTilesProvider.spec.ts` richten

Im Test `'4x1 pattern in-outside'` des `describe('vertical')` steht der zweite
`expect`-Block, `RepeatingTilesProvider.spec.ts:382-389`, ab Zeile 383 zwei
Stellen zu weit links. Die Zeilen 383 bis 389 je um zwei Leerzeichen nach rechts
rücken, so dass der Block aussieht wie der erste in Zeile 373-380 und der dritte
in Zeile 391-398. Das `// prettier-ignore` bleibt stehen, die Werte bleiben gleich.

### 2. `ChunkQuadTreeNode`: Achsenwahl über sortierte Kanten (O(n log n) je Knoten)

**2a — Charakterisierungstest zuerst, grün gegen den jetzigen Code.** In
`ChunkQuadTreeNode.extended.spec.ts` ein neues `describe('axis choice')`:

- Ein Referenz-Helfer im Spec, `bruteForceAxis(chunks, beforeKey, afterKey): number | undefined`,
  der die Regel ausschreibt, wie der Code sie heute rechnet: Kandidaten sind die
  verschiedenen Werte von `c[beforeKey]` in aufsteigender Reihenfolge; je Kandidat
  `origin` zählt ein Chunk als *before*, wenn `c[beforeKey] <= origin`, sonst als
  *after*, wenn `c[afterKey] >= origin`, sonst als *intersect*. Ein Kandidat fällt
  aus, wenn zwei der drei Zahlen 0 sind. Sonst
  `distance = |0.5 − before/n| + (intersect/n) · ChunkQuadTreeNode.IntersectDistanceFactor + |0.5 − after/n| + ||0.5 − after/n| − |0.5 − before/n|| · ChunkQuadTreeNode.BeforeAfterDeltaFactor`,
  in genau dieser Summenreihenfolge (Gleitkomma). Es gewinnt der erste Kandidat mit
  echt kleinerer `distance`. Ein Kommentar über dem Helfer sagt, dass er die Regel
  bewusst naiv ausschreibt, weil er die Achsenwahl des Baums spezifiziert.
- Ein deterministischer Generator (ein LCG wie der im Stress-Test, Zeile 479-480)
  baut mindestens vier Layouts zu je 40 bis 200 Chunks (`StringDataChunk2D`, Name
  `c<i>`): (a) freie Gleitkomma-Positionen und -Größen; (b) Positionen und Größen
  auf einem 5er-Raster, so dass viele Kanten zusammenfallen; (c) wie (b), aber die
  Chunks mit `i % 10 === 3` mit `width: 0` und die mit `i % 10 === 7` mit `height: 0`;
  (d) wie (b), aber die Chunks mit `i % 8 === 5` mit negativer Breite (`width: -3`) — `AABB2` prüft das nicht, `right` liegt dann
  links von `left`.
- Für jedes Layout: Wurzel bauen, `subdivide(2)`, dann jeden Knoten des Baums
  besuchen. Die Chunk-Menge eines Knotens ist die seines Teilbaums (eigene `chunks`
  plus alle Nachfahren) — genau die Menge, die er beim Teilen hatte. Für jeden
  Knoten mit `isLeaf === false`:
  `expect(node.originX).toBe(bruteForceAxis(subtree, 'right', 'left'))` und
  `expect(node.originY).toBe(bruteForceAxis(subtree, 'bottom', 'top'))`. Für jedes
  Blatt mit mehr als zwei Chunks: mindestens einer der beiden Aufrufe liefert
  `undefined`. Die Zahl der geprüften inneren Knoten je Layout mit `toBeGreaterThan(0)`
  festhalten, damit der Test nicht leer grün wird.
- Diesen Test gegen den **unveränderten** Code laufen lassen: grün. Das gehört in
  den Report.

**2b — Umbau.** In `ChunkQuadTreeNode.ts`:

- `scoreAxis` bekommt die Zählung statt der Chunks:
  `scoreAxis(beforeCount: number, intersectCount: number, afterCount: number, chunksCount: number, origin: number): IChunkAxis | null`.
  Der Rumpf ab `const noSubdivide` (Zeile 40-55) bleibt Wort für Wort, damit die
  Gleitkommawerte und damit die Wahl bei Gleichstand identisch bleiben.
- `findAxis(chunks, beforeKey, afterKey)` rechnet so:
  1. `chunks.sort((a, b) => a[beforeKey] - b[beforeKey])` bleibt, **in place** wie
     jetzt — `subdivide()` verteilt die Chunks danach in genau dieser Reihenfolge auf
     die Quadranten, und die Reihenfolge in den Kindern soll sich nicht ändern.
  2. `n = chunks.length`. Die `afterKey`-Kanten der Chunks mit Ausdehnung auf dieser
     Achse (`c[afterKey] < c[beforeKey]`) in ein `Float64Array` schreiben, `m` Stück,
     und `subarray(0, m).sort()` (numerisch).
  3. Drei Zähler, alle ab 0: `before` (Index in `chunks`), `beforeWithExtent`,
     `afterBelow` (Index in den sortierten Kanten). Schleife
     `for (let i = 0; i < n; i = before)`: `origin = chunks[i][beforeKey]`;
     `before` vorrücken, solange `before < n && chunks[before][beforeKey] <= origin`,
     und dabei `beforeWithExtent` erhöhen, wenn der überschrittene Chunk Ausdehnung
     hat; `afterBelow` vorrücken, solange `afterBelow < m && edges[afterBelow] < origin`.
     Dann `intersect = afterBelow − beforeWithExtent`, `after = n − before − intersect`,
     `scoreAxis(before, intersect, after, n, origin)`, bester wie bisher mit `<`.
     Das `i = before` überspringt gleiche Kandidaten; `lastOrigin` entfällt.
  4. Ein Kommentar erklärt, warum die Zählung stimmt: ein Chunk mit Ausdehnung
     schneidet `origin`, wenn seine `afterKey`-Kante unter `origin` liegt und seine
     `beforeKey`-Kante darüber; ein Chunk ohne Ausdehnung (Breite bzw. Höhe 0 oder
     negativ) ist nie *intersect*, sondern *before* ab seiner `beforeKey`-Kante und
     davor *after* — deshalb zählen nur Chunks mit Ausdehnung in die Kanten.
  Diese Rechnung ist im Scratchpad dieses Zug 0 gegen die jetzige O(n²)-Bewertung
  gelaufen: 8000 Achsen auf Zufalls- und Rasterlayouts mit Null- und Negativbreiten,
  keine Abweichung.
- Der Kommentar im Stress-Test `ChunkQuadTreeNode.extended.spec.ts:487`
  (`current O(n²) implementation …`) beschreibt danach nichts mehr, was stimmt:
  ersetzen durch einen Satz über das Budget, ohne Vorzustand
  (`// Loose budget — 1k chunks subdivide in a few milliseconds`). Den Wert
  `toBeLessThan(1000)` nicht verschärfen: Zeitbudgets flackern auf langsamen Runnern.
- Einmal messen, nicht einchecken: `subdivide(8)` auf 1.000 und auf 20.000 Chunks
  des Stress-Layouts vor und nach dem Umbau; die vier Zahlen in den Report.
- 2a läuft nach dem Umbau grün, die übrigen Specs des Moduls ebenso.

### 3. `ChunkQuadTreeNode`: `subdivide()` erreicht die nachgeladenen Blätter

**3a — Regressionstests, vor dem Fix rot.** In `ChunkQuadTreeNode.extended.spec.ts`
unter `describe('subdivide()')`:

- `'splits the leaves appendChunk() has filled since the node was split'`: einen
  Baum wie im Test `'lazily creates a child node when the target quadrant is empty'`
  (Zeile 256-269) bauen, so dass `nodes.northEast` nach `subdivide()` `null` ist.
  Vier Chunks per `appendChunk()` in den Nordosten legen (5×5, auf verschiedenen
  Zeilen und Spalten, klar im Nordosten des Ursprungs). Die Vorbedingung im Test
  prüfen: `nodes.northEast` ist ein Blatt mit genau diesen vier Chunks. Dann
  `subdivide()` auf der Wurzel: `nodes.northEast.isLeaf` ist `false`, jedes Blatt des
  Teilbaums hält höchstens zwei Chunks, und `findChunks()` über den Nordosten findet
  alle vier.
- `'passes maxChunkNodes on to the leaves it splits'`: ein Blatt, das per
  `appendChunk()` auf drei Chunks gewachsen ist; `subdivide(4)` auf der Wurzel lässt
  es ein Blatt, `subdivide(2)` teilt es.
- Beide gegen den jetzigen Code: rot. Den roten Lauf in den Report.

**3b — Fix.** `subdivide(maxChunkNodes = 2)` beginnt mit: ist der Knoten kein Blatt,
`subdivide(maxChunkNodes)` an jedem Kind, das nicht `null` ist, und `return`. Der
Rest bleibt. Die Straddler eines geteilten Knotens bleiben, wo sie sind: sie kreuzen
seine Achsen. `appendChunk()` teilt weiterhin nichts selbst.

Warum dieser Weg und nicht »das Kind nach `appendToNode` teilen«, die zweite
Empfehlung des Audits: `appendChunk()` kennt kein `maxChunkNodes`, jede Teilung dort
liefe mit dem Default 2 statt mit dem Wert des Aufrufers, und jedes Anhängen zahlte
für eine Teilung. Das Weiterreichen hält `appendChunk()` bei O(Tiefe) und die
Teilung in der Hand des Aufrufers, wie es die TSDoc von `clear()` schon beschreibt
(»call `appendChunk()` / `subdivide()` again«).

**3c — TSDoc.** Auf Englisch, im Ton der Datei:

- `subdivide()`: teilt ein Blatt rekursiv in vier Quadranten, solange ein Knoten
  mehr als `maxChunkNodes` Chunks hält und eine Achse sie trennt; Chunks, die eine
  Achse kreuzen, bleiben am Knoten dieser Achse; auf einem schon geteilten Knoten
  reicht der Aufruf an die Kinder weiter, so dass auch die Blätter geteilt werden,
  die `appendChunk()` seither gefüllt hat.
- `appendChunk()`: legt den Chunk in das Blatt des Quadranten, in dem er liegt
  (und legt dieses Blatt an, wenn der Quadrant leer ist), oder behält ihn am ersten
  Knoten, dessen Achse er kreuzt; teilt keinen Knoten — nach dem Anhängen
  `subdivide()` auf der Wurzel rufen.
- `canSubdivide()`: ob `subdivide()` diesen Knoten selbst teilen kann — ein Blatt mit
  mehr als einem Chunk.
- Klassen-TSDoc Zeile 83-85: der Satz zu `subdivide()` nennt, dass er nach
  `appendChunk()` erneut gerufen wird.

### 4. `IDataChunk2D` und `DataIdsChunk2D`: toter Code, `compression`, Länge der Ids

**4a — Regressionstests, vor dem Fix rot.** In `DataIdsChunk2D.spec.ts`:

- `'refuses a uint32Arr that does not hold width × height ids'`:
  `new DataIdsChunk2D({x: 0, y: 0, width: 2, height: 2, uint32Arr: new Uint32Array(3)})`
  und dasselbe mit `new Uint32Array(5)` werfen je `RangeError`.
- `'refuses base64 data that does not hold width × height ids on the first read'`:
  `new DataIdsChunk2D({x: 0, y: 0, width: 2, height: 2, data: 'AQAAAAIAAAADAAAA'})`
  (drei Ids 1, 2, 3, little-endian) baut ohne Fehler; `readDataIdAt(0, 0)` wirft
  `RangeError`.
- Beide gegen den jetzigen Code: rot. Den roten Lauf in den Report.
- Dazu, grün: `'reads the ids of base64 data row by row'` mit
  `data: 'AQAAAAIAAAADAAAABAAAAA=='` (Ids 1, 2, 3, 4) auf einem 2×2-Chunk bei
  `(10, 20)`: `readDataIdAt(11, 21)` ist `4`, `readDataIdAt(10, 21)` ist `3`.

**4b — Umbau.**

- `IDataChunk2D.ts:15`: die auskommentierte Signatur `// readDataIdAt(x: number, y: number): number;`
  samt der Leerzeile danach löschen. Nicht ins Interface aufnehmen: `DataChunk2D`,
  `NumberDataChunk2D` und `StringDataChunk2D` implementieren es und tragen keine Ids;
  `readDataIdAt()` gehört allein `DataIdsChunk2D`.
- `DataIdsChunk2D.ts`, `StringDataIdsChunk2DParams`: das Feld `compression?: string`
  entfällt (Entscheidung im Plan).
- `prepareData()`: den `TODO`-Block (Zeile 39-42) löschen — das ist die map2d-Stelle
  von IMPL-001. Die Prüfung selbst bleibt, gelesen über einen Cast
  (`(this.data as {compression?: unknown}).compression`), mit der Meldung wie jetzt
  (`DataIdsChunk2D: the compression "${String(compression)}" is not supported`, als `Error`) und mit
  einem Kommentar, warum: Daten aus einer Map-Datei können das Feld tragen — die
  Layer einer Tiled-Map tun es —, und Ids aus komprimierten Bytes sähen gültig aus.
  Die Prüfung steht vor der Dekodierung und vor der Längenprüfung. Ein leerer String
  gilt wie jetzt als »keine Kompression«, so schreibt Tiled unkomprimierte Layer.
  Warum die Prüfung bleibt, obwohl das Feld aus dem Typ geht: Die Entscheidung nimmt
  das Feld aus dem **Typ**; wer untypisierte Daten reicht, soll weiter einen lauten
  Fehler statt stiller Fehl-Ids bekommen, und der bestehende `Unreleased`-Eintrag
  `CHANGELOG.md:159` bleibt damit wahr.
- Längenprüfung: eine private Methode `#checkIds(ids: Uint32Array): Uint32Array`,
  die `ids` zurückgibt oder
  `new RangeError(\`DataIdsChunk2D: a chunk of ${width}x${height} takes ${width * height} ids, got ${ids.length}\`)`
  wirft; `width` und `height` aus `this.data` wie in `readDataIdAtLocal()`. Streng auf
  `!==`, nicht nur zu kurz: ein längeres Array heißt, dass Breite und Daten nicht
  zusammenpassen, und die Zeilen würden mit falschem Schritt gelesen.
  - Konstruktor: liegt `uint32Arr` vor, geht es durch `#checkIds()`, bevor es in
    `#uint32Data` landet — der Fehler kommt aus dem Konstruktor.
  - Getter `uint32Arr`: `this.#uint32Data = this.#checkIds(this.prepareData())` —
    geprüft **vor** dem Cachen, damit ein fehlerhafter String bei jedem Lesen wirft
    und nicht beim zweiten ein halbes Array liefert. Die Prüfung sitzt im Getter,
    nicht in `prepareData()`, damit sie auch eine überschriebene `prepareData()`
    einer Unterklasse trifft.
- TSDoc: die Klassen-TSDoc nennt die beiden Wege — ein `Uint32Array` oder ein
  base64-String aus little-endian uint32-Werten, der beim ersten Lesen dekodiert
  wird —, dass es genau `width × height` Ids sind, Zeile für Zeile, und streicht
  »(optionally with compression)«. `readDataIdAt()` nennt den `RangeError` beim ersten
  Lesen eines Strings mit falscher Länge und den `Error` für eine genannte Kompression.
- Den bestehenden Test `'names the compression it cannot handle and reports it by throwing alone'`
  auf das neue Typbild bringen: die Parameter als Variable bauen
  (`const fromMapFile = {x: 0, y: 0, width: 2, height: 2, data: 'AAAAAA==', compression: 'gzip'};`)
  und `new DataIdsChunk2D(fromMapFile)` — ein nicht frisches Objekt passiert ohne
  Excess-Property-Check, genau wie geparstes JSON. Testname:
  `'refuses data that names a compression, as a layer read from a map file can'`.
  Die Konsolen-Asserts bleiben. `'AAAAAA=='` sind vier Bytes, also eine Id für einen
  2×2-Chunk — der Test belegt damit auch, dass die Kompression vor der Länge geprüft
  wird.
- Dazu, grün: `compression: ''` mit `'AQAAAAIAAAADAAAABAAAAA=='` liest `1` bei
  `(0, 0)`, ebenfalls über eine Variable gebaut.
- Den Typ festhalten, Test `'does not take a compression in its params'`: ein
  mehrzeiliges Objektliteral direkt an `new DataIdsChunk2D({ … })` mit
  `x: 0, y: 0, width: 2, height: 2, data: 'AAAAAA=='`, jede Eigenschaft auf eigener
  Zeile, und unmittelbar über der Zeile `compression: 'gzip',` der Kommentar
  `// @ts-expect-error compression is not part of the params` — der Excess-Property-Fehler
  steht an dieser Eigenschaft, nicht am Aufruf. Danach
  `expect(() => chunk.readDataIdAt(0, 0)).toThrow(/gzip/)`: der Konstruktor wirft
  nicht, die Prüfung kommt beim ersten Lesen. `pnpm typecheck` prüft die Specs mit;
  kehrt das Feld je in den Typ zurück, schlägt der unbenutzte `@ts-expect-error` an.

### 5. `RepeatingTilesProvider`: ein Wrap, ein Zeilen-Writer, `target` dokumentiert

**5a — Tests zuerst.**

- Sicherungsnetz, grün vor und nach dem Umbau: die bestehenden Blöcke mit festen
  Werten und `describe('agrees with getTileIdAt()')` (Zeile 201-246). Vor dem Umbau
  einmal laufen lassen, Ergebnis in den Report.
- Neu, vor dem Umbau rot: `'leaves the cells past width × height of a longer target as they are'`,
  `test.each` über `'vertical'`, `'horizontal'`, `'none'` und ein Muster ohne Zellen
  (`new RepeatingTilesProvider()`), je mit einem Rechteck, das das Muster schneidet,
  und einem ganz außerhalb (für `'vertical'` z. B. `left = 10`, für `'horizontal'`
  `top = 10` bei einem 2×2-Muster). Ein `target` der Länge `width * height + 3`,
  gefüllt mit `666`: die ersten `width * height` Zellen tragen, was `getTileIdAt()`
  sagt, die letzten drei bleiben `666`. Rot heute durch `target.fill(0)` ohne Ende
  (Zeile 130, 141, 163) und `target.fill(0, targetRowOffset)` (Zeile 178).
- Neu, vor dem Umbau rot: `'refuses a target shorter than width × height'` — für alle
  drei Achsen und das leere Muster wirft `getTileIdsWithin(0, 0, 3, 2, new Uint32Array(5))`
  einen `RangeError`. Rot heute, weil `fill` still kürzt und nur manche Pfade über
  `target.set` werfen.
- Den roten Lauf beider in den Report.

**5b — Umbau** in `RepeatingTilesProvider.ts`:

- Modulweit, nicht exportiert:
  `const wrap = (i: number, n: number): number => ((i % n) + n) % n;` mit einem
  Kommentar: hebt jeden ganzzahligen Index, auch einen negativen, nach `[0, n)` —
  das Muster wiederholt sich von `(0, 0)` aus in beide Richtungen.
- `getTileIdAt()`: alle vier Stellen des Ausdrucks
  `i < 0 ? i + Math.ceil(-i / n) * n : i` samt folgendem `% n` durch `wrap(i, n)`:
  `'vertical'` → `this.#tileIds[wrap(row, this.#rows)]![col]!`, `'horizontal'` →
  `this.#tileIds[row]![wrap(col, this.#cols)]!`, `'none'`/`default` →
  `this.#tileIds[wrap(row, this.#rows)]![wrap(col, this.#cols)]!`. Die Guards
  (Muster ohne Zellen, Bereichsprüfung) bleiben.
- `#writePatternRow()` entfällt. An seine Stelle
  `#writeRow(target: Uint32Array, rowOffset: number, patternRow: number, left: number, width: number, from: number, to: number): void`:
  Zellen `from` bis `to − 1` der Zeile, die bei `rowOffset` beginnt, bekommen die
  Musterzeile `patternRow`, die Zelle `x` die Musterspalte `wrap(left + x, #cols)`;
  jede andere Zelle der Zeile `0`. Zelle für Zelle, ohne `slice()`:
  `target.fill(0, rowOffset, rowOffset + from)`, dann `col = wrap(left + from, this.#cols)`
  und eine Schleife `target[rowOffset + x] = row[col]!; if (++col === this.#cols) col = 0;`,
  dann `target.fill(0, rowOffset + to, rowOffset + width)`. TSDoc wie beim Vorgänger,
  auf den Spaltenbereich angepasst.
- `getTileIdsWithin()`:
  1. Ohne `target`: `new Uint32Array(width * height)`. Mit `target` kürzer als
     `width * height`:
     `throw new RangeError(\`RepeatingTilesProvider: a target for ${width}x${height} tile ids needs ${width * height} cells, got ${target.length}\`)`.
  2. Muster ohne Zellen: `target.fill(0, 0, width * height)`.
  3. `'vertical'` — ein Pfad für innen und außen:
     `from = Math.min(Math.max(-left, 0), width)`,
     `to = Math.max(Math.min(this.#cols - left, width), from)`, dann für jedes `y`
     `this.#writeRow(target, y * width, wrap(top + y, this.#rows), left, width, from, to)`.
     Liegt das Rechteck ganz neben dem Muster, ist `from === to`, und die Zeile wird 0.
  4. `'horizontal'`: für jedes `y` mit `patternRow = top + y` im Bereich `[0, #rows)`
     `this.#writeRow(target, y * width, patternRow, left, width, 0, width)`, sonst
     `target.fill(0, y * width, (y + 1) * width)`.
  5. `'none'`/`default`: für jedes `y`
     `this.#writeRow(target, y * width, wrap(top + y, this.#rows), left, width, 0, width)`.
     Der 1×1-Sonderweg entfällt; der Kommentar zum `default` (Zeile 185) bleibt.
  `right` und `bottom` werden damit nicht mehr gebraucht.
  Die Formeln sind im Scratchpad dieses Zug 0 gegen `getTileIdAt()` gelaufen:
  6 Muster × 3 Achsen × 307.800 Rechtecke inklusive Breite und Höhe 0, mit einem
  um drei Zellen längeren `target` — keine Abweichung, der Rest unberührt.
- Der Kommentar über `#rows`/`#cols` (Zeile 25-28) sagt danach: jeder Index in
  `#tileIds` läuft durch `wrap()` oder zuerst durch eine Bereichsprüfung gegen sie.
- TSDoc von `getTileIdsWithin()` (Zeile 122-125) ersetzen: die Ids des Rechtecks von
  `width` × `height` Tiles mit der linken oberen Ecke `(left, top)`, Zeile für Zeile —
  die Id von Tile `(left + i, top + j)` steht an Index `j * width + i`, der Wert, den
  `getTileIdAt()` für dieses Tile liefert; alle vier Zahlen in _tile space_ und ganz.
  `@param target` — nimmt die Ids auf; die ersten `width * height` Zellen werden
  überschrieben, Zellen dahinter bleiben, wie sie sind; kürzer wirft einen
  `RangeError`. `@returns` — `target`, oder ohne `target` ein neues `Uint32Array`
  von `width * height` Ids. `{@link getTileIdAt}` darf verlinkt werden.

### 6. CHANGELOG

Skill `updating-changelog` laden. Alles unter `## [Unreleased]` in
`packages/twopoint5d/CHANGELOG.md`, im Ton der Nachbarn: die neue Wirklichkeit
beschreiben, keine Finding-IDs.

- `### Changed`:
  - `ChunkQuadTreeNode#subdivide()` auf einem schon geteilten Knoten reicht an seine
    Kinder weiter: auch die Blätter, die `appendChunk()` seither gefüllt hat, werden
    geteilt, mit dem `maxChunkNodes` des Aufrufs. Nach `appendChunk()` `subdivide()`
    auf der Wurzel rufen.
  - `perf ChunkQuadTreeNode#subdivide()` wählt die Achsen eines Knotens mit n Chunks
    in O(n log n) aus den einmal je Achse sortierten Kanten; es sind dieselben Achsen.
    Im Stil der `perf`-Einträge ab Zeile 160.
  - `DataIdsChunk2D` nimmt genau `width × height` Ids: ein `uint32Arr` anderer Länge
    wirft aus dem Konstruktor einen `RangeError`, ein base64-String anderer Länge beim
    ersten Lesen.
  - `RepeatingTilesProvider#getTileIdsWithin()` schreibt die ersten `width × height`
    Zellen eines `target` und lässt Zellen dahinter stehen; ein kürzeres `target` wirft
    einen `RangeError`.
  - Den Eintrag `CHANGELOG.md:159` (`DataIdsChunk2D#prepareData()` names the
    compression …) so fassen, dass er zum Typ passt: Daten, die eine Kompression
    nennen — ein Feld, das der Typ nicht deklariert, das Daten aus einer Map-Datei
    aber tragen können —, werden beim ersten Lesen mit einem Fehler abgewiesen, der
    die Kompression nennt, und nichts geht an die Konsole.
- `### Removed`: `compression` aus `StringDataIdsChunk2DParams` — der Chunk dekodiert
  nur unkomprimiertes base64; Verweis auf den Migration Guide.
- `### Migration Guide`: ein Abschnitt mit der Überschrift
  `#### A \`DataIdsChunk2D\` takes plain base64 ids of its own size`, am Ende der
  map2d-Abschnitte (nach `#### \`Map2DTileStreamer#update()\` places the renderer nodes …`,
  Zeile 638), im Aufbau wie
  `#### The size of a \`RectangularVisibilityArea\` is checked` (Zeile 620-636):
  zwei Sätze — das Feld `compression` ist aus dem Typ, der Chunk dekodiert nur
  unkomprimiertes base64; es sind genau `width × height` Ids —, dann **Before**/**After**
  als schlichte ` ```ts `-Blöcke (Auszüge, kein `ts check`).
  Before: `new DataIdsChunk2D({x: layer.x, y: layer.y, width: layer.width, height: layer.height, data: layer.data, compression: layer.compression});`.
  After: `if (layer.compression) throw new Error(\`cannot read a ${layer.compression} layer\`);`
  und derselbe Aufruf ohne `compression`, darunter eine Zeile mit einem zu kurzen
  `uint32Arr` und der Meldung des `RangeError` als Kommentar
  (`// → RangeError: DataIdsChunk2D: a chunk of 2x2 takes 4 ids, got 3`).

### 7. Gate

`pnpm run ci` grün. Der Umbau berührt keine Rendering- und keine GPU-Buffer-Pfade,
die Browser-Suite läuft im Gate trotzdem mit.

## Verify

`pnpm run ci`

## Commit

`fix(map2d): let subdivide() on a split ChunkQuadTreeNode split the leaves appendChunk() has filled since and pick the axes of a node from its edges sorted once, refuse a DataIdsChunk2D whose ids do not fill its width times height and take the compression it never decoded out of its params, and have RepeatingTilesProvider wrap every index and write every row one way, refuse a target too short for the rectangle and say in the docs of getTileIdsWithin() what it writes and returns`

## Für `Schnittstellen:` nach dem Commit

- `ChunkQuadTreeNode#subdivide(maxChunkNodes)` auf einem inneren Knoten reicht an die Kinder weiter · `appendChunk()` teilt weiter nichts selbst · Signaturen unverändert
- `StringDataIdsChunk2DParams` ohne `compression` · `DataIdsChunk2D` wirft `RangeError` bei `ids.length !== width * height` (Konstruktor für `uint32Arr`, erstes Lesen für `data`)
- `RepeatingTilesProvider#getTileIdsWithin()` wirft `RangeError` für `target.length < width * height`, schreibt nur die ersten `width * height` Zellen

## Abgleich

Gegen `HEAD` 18b31272, alle Fundstellen gelesen:

- **PERF-027** — unverändert, zum Teil gegenstandslos. `appendToNode()` legt in einem
  leeren Quadranten ein Blatt mit einem Chunk an (`ChunkQuadTreeNode.ts:238-245`),
  `appendChunk()` auf einem Blatt schiebt nur an (`:208-212`), `subdivide()` bricht auf
  einem inneren Knoten über `canSubdivide()` ab (`:133-135`, `:154`). Gegenstandslos ist
  der letzte Satz »`appendChunk`, `findChunksAt` und `clear` haben keine Specs«:
  `ChunkQuadTreeNode.extended.spec.ts` deckt sie ab — `describe('appendChunk()')` ab
  `:218` (4 Tests), `describe('findChunksAt()')` ab `:373` (5), `describe('clear()')`
  ab `:426` (4), die Datei liegt seit bf868e40 (2026-09-04) so da, vor dem Audit.
  Neue Specs braucht nur das Nachteilen (Schritt 3a).
- **PERF-019** — unverändert. `findAxis` `ChunkQuadTreeNode.ts:58-74` ruft je Kandidat
  `scoreAxis` `:22-56` über alle Chunks. Umsetzung nach der Entscheidung im Plan.
- **IMPL-010** — unverändert. `IDataChunk2D.ts:15` auskommentierte Signatur;
  `DataIdsChunk2D.ts:6` `compression?: string`, `:36-44` wirft immer bei gesetzter
  Kompression; keine Längenprüfung im Konstruktor `:29-33` noch im Getter `:50-55`.
- **IMPL-001 (map2d-Stelle)** — unverändert, `DataIdsChunk2D.ts:39` `// TODO support compression`.
- **READ-012** — umgeformt, Sachverhalt steht. Der Wrap-Ausdruck steht jetzt
  **siebenmal** statt sechsmal: `RepeatingTilesProvider.ts:79`, `:85`, `:91`, `:92`
  (`getTileIdAt`), `:110` (`#writePatternRow`), `:150` (`'vertical'`-Zweig), `:191`
  (`'none'`-Zweig). `'horizontal'` und `'none'` schreiben über `#writePatternRow`,
  `'vertical'` inline (`:143-157`). Die im Audit genannte Fehlerstelle ist seit einem
  früheren Lauf behoben (CHANGELOG `Unreleased`/Fixed, `'vertical'` mit linker Kante im
  Muster), die Divergenz der drei Zweige besteht fort.
- **DOC-036** — unverändert, `RepeatingTilesProvider.ts:122-125`: die TSDoc nennt
  weder Rückgabe noch `target`.
- **CONS-037** — unverändert, `RepeatingTilesProvider.spec.ts:381-389` (Audit: `:381`,
  der `// prettier-ignore` davor); Zeilen 383-389 stehen zwei Stellen zu weit links.

## Entscheidungen dieses Zug 0 (ohne Rückfrage, je mit Grund)

- PERF-027: `subdivide()` reicht weiter, statt das Kind in `appendToNode` zu teilen —
  Grund unter 3b.
- IMPL-010: `readDataIdAt` wird aus dem Interface-Kommentar gelöscht, nicht
  aufgenommen — drei der vier Implementierungen tragen keine Ids.
- IMPL-010: die Laufzeitprüfung auf `compression` bleibt für untypisierte Daten, nur
  der Typ verliert das Feld — Grund unter 4b; kehrt die Entscheidung im Plan nicht um.
- IMPL-010: Länge streng auf `width × height`, nicht nur Mindestlänge — Grund unter 4b.
- DOC-036: über die Empfehlung (nur TSDoc) hinaus prüft `getTileIdsWithin()` die Länge
  eines `target` und schreibt nie über `width × height` hinaus. Grund: der
  vereinheitlichte Writer schreibt Zelle für Zelle, und ohne Prüfung würde ein zu
  kurzes `target` still gekürzt; heute wirft es auf einem Teil der Pfade (`target.set`)
  und kürzt auf den anderen (`fill`), und der Rest eines längeren `target` wird je nach
  Pfad genullt oder nicht. Mit Prüfung sagt die TSDoc einen Satz, der auf allen Pfaden
  stimmt.
- READ-012: der Writer schreibt Zelle für Zelle statt über `slice()`/`set()` — ohne
  Allokation je Zeile und ohne die Stückarithmetik, an der schon einmal ein Fehler
  hing (CHANGELOG `Unreleased`/Fixed, »the pattern is carried on by the length of the
  piece just written«).

## Offene Befunde und Folgen (Triage)

- Folgen aus Paket 1, 2 und 3: keine eingetragen.
- »Offene Befunde«, einziger Eintrag (`CameraBasedVisibility.ts:80-81`/`:406-407`,
  Frustum ohne `coordinateSystem`/`reversedDepth`): andere Ursache als dieses Paket,
  bleibt in der Queue für die Drain-Runde, Urteil `→ Scope` unverändert.

## Restplan

Paket 5 bleibt, wie es ist: es berührt keine Datei dieses Pakets, nutzt
`RepeatingTilesProvider` nur ohne `target` (`fixtures.js:156`, drei Lookbook-Demos)
und `ChunkQuadTreeNode` nur mit einmaligem `subdivide()` (quadtree-playground) — beides
verhält sich nach Paket 4 gleich. Keine Umsortierung, kein neuer Schnitt.

## Findings im Volltext

**PERF-027 · low · packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:208-245** (auch `:133-141`) — Nachgeladene Chunks im ChunkQuadTree wieder unterteilbar machen
`appendChunk()` auf einem inneren Knoten legt Leaf-Kinder mit je einem Chunk an. `subdivide()` auf der Wurzel ist danach ein No-op, weil sie kein Leaf mehr ist, obwohl die TSDoc empfiehlt, `subdivide()` erneut aufzurufen. Bei inkrementell nachgeladenen Chunks degradiert `findChunks` in diesen Leaves zu O(n). `appendChunk`, `findChunksAt` und `clear` haben keine Specs.
Empfehlung: `subdivide()` rekursiv an die Kinder weiterreichen oder das Kind nach `appendToNode` unterteilen. Specs ergänzen.

**PERF-019 · info · packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:58** — ChunkQuadTreeNode.subdivide() bewertet jede Kante in O(n) — O(n²) pro Ebene
`findAxis` sortiert und ruft für jeden Kandidaten `scoreAxis` über alle Chunks. Für die Load-once-Nutzung unproblematisch (die Extended-Spec budgetiert 1000 Chunks unter 1 s), aber der einzige superlineare Pfad im Modul — gut zu wissen, bevor jemand den Baum pro Frame neu baut.
Empfehlung: So lassen. Sollte es je zählen, macht ein Präfixsummen-Lauf über die sortierten Kanten `scoreAxis` zu O(1) pro Kandidat. (Laut »Entscheidungen« im Plan wird umgesetzt, nicht gelassen.)

**IMPL-010 · info · packages/twopoint5d/src/map2d/chunk-quad-tree/IDataChunk2D.ts:15** (auch `DataIdsChunk2D.ts:32-44`) — Toten und unfertigen Code im chunk-quad-tree aufräumen
Die Signatur `readDataIdAt` ist auskommentiert. Der öffentliche Parameter `compression` wirft immer. Die Länge von `uint32Arr` wird nicht gegen `width*height` geprüft, sodass `readDataIdAt` innerhalb der Bounds `undefined` liefern kann.
Empfehlung: Kommentar entfernen oder ins Interface aufnehmen, `compression` aus dem Typ nehmen und die Array-Länge im Konstruktor prüfen.

**IMPL-001 · low · packages/twopoint5d/src/texture/TexturePackerJson.ts:19** (map2d-Stelle `DataIdsChunk2D.ts:39`, nur diese gehört hierher) — Die verstreuten TODO-Marker in ausgelieferten Code-Pfaden auflösen
In ausgelieferten Typen und Code-Pfaden stehen offene TODOs ohne Verweis auf einen Tracker, etwa `// TODO add textureOptions: TextureClasses[]` im öffentlichen `TexturePackerMetaData`.
Empfehlung: Umsetzen oder als Issue erfassen und aus dem Code entfernen.

**READ-012 · low · packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:79** — Die sechs Kopien des Wrap-Around-Modulos in RepeatingTilesProvider zusammenziehen
Der Ausdruck »einen negativen Index in den Musterbereich heben« (`i < 0 ? i + Math.ceil(-i / n) * n : i`) steht sechsmal, und die drei `getTileIdsWithin`-Zweige schreiben Zeilen jeweils anders (`'horizontal'` und `'none'` über `#writePatternRow`, `'vertical'` inline) — die Divergenz ist genau die Stelle, an der BUG-070 lebt.
Empfehlung: `const wrap = (i: number, n: number) => ((i % n) + n) % n;` und alle drei Zweige durch einen Zeilen-Writer führen, der einen Spaltenbereich nimmt.

**DOC-036 · low · packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:122** — Rückgabewert und target im TSDoc von getTileIdsWithin() beschreiben
Das TSDoc von `getTileIdsWithin()` nennt weder den Rückgabewert noch `target`: jede Zelle wird überschrieben, die Länge von `target` wird nicht geprüft. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: `@param target` (wird vollständig überschrieben, muss mindestens `width × height` fassen) und `@returns` ergänzen.

**CONS-037 · info · packages/twopoint5d/src/map2d/RepeatingTilesProvider.spec.ts:381** — Den falsch eingerückten Block im vertical-Test »4x1 pattern in-outside« richten
Der zweite `expect`-Block steht zwei Stellen zu weit links; `// prettier-ignore` verdeckt es vor dem Formatter. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Einrücken wie die Nachbarblöcke.

## Urteil des Reviewers (Zug 3, `paket-4.review-1.json`; Runde 1 `paket-4.review-2.json`)

- PERF-027 — behoben: `ChunkQuadTreeNode.ts` `subdivide()` (~:152) reicht auf einem inneren Knoten an die Kinder weiter; TSDoc von `subdivide()`, `appendChunk()`, `canSubdivide()` und Klasse ergänzt; Specs in `ChunkQuadTreeNode.extended.spec.ts`.
- PERF-019 — behoben: `findAxis`/`scoreAxis(before, intersect, after, n, origin)` über einmal sortierte Kanten (`Float64Array`, Zähler); `describe('axis choice')` gegen `bruteForceAxis` auf vier Layouts.
- IMPL-010 — behoben: `IDataChunk2D.ts` Kommentarzeile weg; `DataIdsChunk2D.ts:6` ohne `compression`; `#checkIds` (`:35`, `:64`) streng auf `!==` im Konstruktor und im Getter vor dem Cachen.
- IMPL-001 (map2d-Stelle) — behoben: `TODO`-Block in `DataIdsChunk2D.ts` `prepareData()` entfernt, Prüfung mit Warum-Kommentar. Das Finding selbst bleibt offen (übrige Stellen außerhalb des Scopes).
- READ-012 — behoben: `RepeatingTilesProvider.ts:8` `wrap()`, `getTileIdAt()` an allen vier Stellen, `#writeRow` (`:103`) einziger Zeilen-Writer (`:155`, `:164`, `:175`).
- DOC-036 — behoben: TSDoc `getTileIdsWithin()` (~:122-132) mit `@param target` und `@returns`, `RangeError` bei zu kurzem `target` (`:133`).
- CONS-037 — behoben: `RepeatingTilesProvider.spec.ts` (~:433-445) eingerückt.
- Befund `wichtig` (CHANGELOG-perf-Eintrag sprach über den Vorzustand) — in Runde 1 behoben, `CHANGELOG.md:208`.

### Kleine Befunde

- `ChunkQuadTreeNode.extended.spec.ts:304` — der Kommentar zum Seed 47514 verweist auf die Endlosrekursion von `subdivide()` bei Chunks ohne Ausdehnung; der Defekt steht als Nebenbefund in »Offene Befunde« (→ Scope). Wird er behoben, kann Layout (c) auf einen beliebigen Seed zurück und der Kommentar fällt weg.
- `packages/twopoint5d/src/map2d/types.ts:19` — `IMap2DTileDataProvider#getTileIdsWithin` trägt keine TSDoc; der Vertrag (`RangeError`, nur die ersten `width * height` Zellen) steht nur an `RepeatingTilesProvider`.

### Nebenbefund: Urteil

Endlosrekursion in `subdivide()` bei Chunks ohne Ausdehnung — vorbestehend (der Charakterisierungstest crashte damit gegen den unveränderten Code, vor dem Umbau), Location unter `src/map2d/` → Scope-Regel greift, `→ Scope`. Severity low: nur degenerierte Chunks (Breite und Höhe 0), dann aber ein Absturz statt einer schlechten Teilung.
