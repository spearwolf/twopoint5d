# Paket 1a — map2d-Specs: Grenzfehler an ihrer Meldung prüfen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-049 (info)
- Ziel: Jede Grenzprüfung der map2d-Specs hält neben der Fehlerklasse die Meldung fest, die Klasse, Eigenschaft und Wert nennt.
- Modell: mittlere Stufe
- Effort: low
- Dateien (alle unter `packages/twopoint5d/src/map2d/`, nur Specs, kein Produktivcode):
  `RectangularVisibilityArea.spec.ts`, `Map2DTileCoordsUtil.spec.ts`, `Map2DSpatialHashGrid.spec.ts`,
  `Map2DTileStreamer.spec.ts`, `Map2D.spec.ts`, `RepeatingTilesProvider.spec.ts`,
  `chunk-quad-tree/DataIdsChunk2D.spec.ts`, `TileSprites/TileSpritesFactory.spec.ts`, `CameraBasedVisibility.spec.ts`
- Vorgehen:
  0. Muster, im Repo schon vorhanden (`RectangularVisibilityArea.spec.ts:182-187`,
     `texture/TextureResource.spec.ts:1574-1575`, `texture/TextureCoords.spec.ts:269-270`): der Aufruf
     wird eine Konstante (`create` für einen Konstruktor, `write` für einen Setter, `read` für einen
     Lesezugriff), darauf zuerst `toThrow(<Klasse>)`, dann `toThrow('<volle Meldung>')`. Die
     Klassenprüfung bleibt überall stehen. Vitest vergleicht einen String in `toThrow()` als
     Teilstring der Meldung; darum steht immer die **volle** Meldung da, nie ein Ausschnitt.
     In `test.each` wird der Wert per Template-Literal eingesetzt (`${v}`): für Zahlen schreibt
     `describeValue()` (`src/utils/describeValue.ts`) dasselbe wie `String()`, also `-1`, `NaN`,
     `Infinity`, `-Infinity`, `0`.
     Kein Produktivcode wird angefasst. Wird ein Test mit der unten genannten Meldung rot, ist
     das ein Befund für den Report — nicht die Meldung im Code angleichen.
  1. `RectangularVisibilityArea.spec.ts` — Meldung aus `RectangularVisibilityArea.ts:14`:
     `[RectangularVisibilityArea] <width|height> must be 0 or a finite number above 0, got <Wert>`.
     - Zeile 174-176 (`the constructor refuses a width of %s`), Rumpf:
       ```ts
       const create = () => new RectangularVisibilityArea(v, 240);

       expect(create).toThrow(RangeError);
       expect(create).toThrow(`[RectangularVisibilityArea] width must be 0 or a finite number above 0, got ${v}`);
       ```
     - Zeile 178-180 (`… a height of %s`): dasselbe mit `new RectangularVisibilityArea(320, v)` und `height`.
     - Zeile 191 (`a refused width leaves the width as it was`):
       ```ts
       const write = () => (area.width = -1);
       expect(write).toThrow(RangeError);
       expect(write).toThrow('[RectangularVisibilityArea] width must be 0 or a finite number above 0, got -1');
       ```
       `expect(area.width).toBe(320)` bleibt danach stehen.
     - Zeile 197: dasselbe für `area.height = -1` und `height`, danach bleibt `expect(area.height).toBe(240)`.
     - Zeile 185 bleibt, wie sie ist (Zeile 186 prüft die Meldung schon).
  2. `Map2DTileCoordsUtil.spec.ts:35-50` — Meldung aus `utils/assertPositiveFinite.ts:10`, Subjekt
     `Map2DTileCoordsUtil` (`Map2DTileCoordsUtil.ts:79,92`; der Konstruktor geht über die Setter, Zeile 118-121):
     - Zeile 36: `const create = () => new Map2DTileCoordsUtil(width, 16);` → `toThrow(RangeError)` und
       ``toThrow(`[Map2DTileCoordsUtil] tileWidth must be a finite number above 0, got ${width}`)``.
     - Zeile 39: `new Map2DTileCoordsUtil(16, height)` → ``… tileHeight must be a finite number above 0, got ${height}``.
     - Zeile 43: `const write = () => (view.tileWidth = width);` → Klasse und
       ``[Map2DTileCoordsUtil] tileWidth must be a finite number above 0, got ${width}``; Zeile 44 bleibt danach.
     - Zeile 48: `view.tileHeight = height` → ``… tileHeight …, got ${height}``; Zeile 49 bleibt danach.
  3. `Map2DSpatialHashGrid.spec.ts:32` — die Meldung nennt `Map2DSpatialHashGrid`, nicht den
     `Map2DTileCoordsUtil` darunter; genau dafür prüft der Konstruktor selbst (`Map2DSpatialHashGrid.ts:31-34`,
     Kommentar dort). Das hält der Test jetzt fest:
     ```ts
     const create = () => new Map2DSpatialHashGrid(0, 100);

     expect(create).toThrow(RangeError);
     expect(create).toThrow('[Map2DSpatialHashGrid] tileWidth must be a finite number above 0, got 0');
     ```
  4. `Map2DTileStreamer.spec.ts:101-107` — Subjekt `Map2DTileStreamer` (`Map2DTileStreamer.ts:58,107`):
     ```ts
     const create = () => new Map2DTileStreamer(0, 16);
     expect(create).toThrow(RangeError);
     expect(create).toThrow('[Map2DTileStreamer] tileWidth must be a finite number above 0, got 0');

     const layer = new Map2DTileStreamer(8, 16);
     const write = () => (layer.tileWidth = 0);
     expect(write).toThrow(RangeError);
     expect(write).toThrow('[Map2DTileStreamer] tileWidth must be a finite number above 0, got 0');
     expect(layer.tileWidth, 'tileWidth after a refused write').toBe(8);
     ```
  5. `Map2D.spec.ts:118-121` — `Map2D#tileWidth` reicht an `this.#tileStreamer.tileWidth` durch
     (`Map2D.ts:92-94`), die Meldung nennt deshalb den Streamer. Das ist gewollt (siehe Abgleich), der
     Kommentar sagt es dem Leser:
     ```ts
     const map = new Map2D();
     const write = () => (map.tileWidth = 0);

     expect(write).toThrow(RangeError);
     // the tile grid is the one of map.tileStreamer, whose setter refuses the value and names itself
     expect(write).toThrow('[Map2DTileStreamer] tileWidth must be a finite number above 0, got 0');
     ```
  6. `RepeatingTilesProvider.spec.ts:300-305` (`%s: refuses a target shorter than width × height`) —
     Meldung aus `RepeatingTilesProvider.ts:137-139`; alle drei `providers` (Zeile 248ff.) sind
     `RepeatingTilesProvider`:
     ```ts
     (name) => {
       const read = () => providers[name]().getTileIdsWithin(0, 0, 3, 2, new Uint32Array(5));

       expect(read).toThrow(RangeError);
       expect(read).toThrow('RepeatingTilesProvider: a target for 3x2 tile ids needs 6 cells, got 5');
     },
     ```
  7. `chunk-quad-tree/DataIdsChunk2D.spec.ts` — Meldung aus `DataIdsChunk2D.ts:43`:
     `DataIdsChunk2D: a chunk of <w>x<h> takes <w*h> ids, got <n>`.
     - Zeile 29-32:
       ```ts
       const tooShort = () => new DataIdsChunk2D({x: 0, y: 0, width: 2, height: 2, uint32Arr: new Uint32Array(3)});
       const tooLong = () => new DataIdsChunk2D({x: 0, y: 0, width: 2, height: 2, uint32Arr: new Uint32Array(5)});

       expect(tooShort).toThrow(RangeError);
       expect(tooShort).toThrow('DataIdsChunk2D: a chunk of 2x2 takes 4 ids, got 3');
       expect(tooLong).toThrow(RangeError);
       expect(tooLong).toThrow('DataIdsChunk2D: a chunk of 2x2 takes 4 ids, got 5');
       ```
     - Zeile 38-40 (`'AQAAAAIAAAADAAAA'` sind drei ids): `const read = () => chunk.readDataIdAt(0, 0);`,
       dann `toThrow(RangeError)` und `toThrow('DataIdsChunk2D: a chunk of 2x2 takes 4 ids, got 3')`,
       der Kommentar `// the refusal is not cached: the next read throws again`, danach dieselben
       zwei Prüfungen noch einmal.
  8. `TileSprites/TileSpritesFactory.spec.ts:49` — das nackte `toThrow()` wird
     `toThrow('expected the tile set of this factory to be defined')`. Der Provider liefert für `(0, 0)`
     die id 1, also wirft `TileSpritesFactory.ts:50` (`expectDefined`, `utils/expectDefined.ts:11`, Klasse
     `Error` — keine eigene Klassenprüfung nötig, `toThrow(Error)` sagt nichts). Zeile 50 bleibt.
  9. `CameraBasedVisibility.spec.ts:270-273` — der `TypeError` kommt von der Engine (Zuweisung an
     einen Getter ohne Setter), der Wortlaut ist V8s, nicht der Bibliothek; festgehalten wird nur
     der Name der Eigenschaft:
     ```ts
     const write = () => {
       // @ts-expect-error — a getter without a setter
       visibility.map2dTileCoords = new Map2DTileCoordsUtil();
     };
     expect(write).toThrow(TypeError);
     // the rest of the wording is the engine's, not the library's
     expect(write).toThrow(/map2dTileCoords/);
     ```
  10. `pnpm format`, dann die Specs des Moduls laufen lassen: `pnpm nx test twopoint5d -- src/map2d`.
  11. Kein CHANGELOG-Eintrag: das Paket ändert nur Specs, nichts Nutzerwirksames. Kein Bugfix-Paket,
      deshalb kein roter Lauf; jede neue Prüfung muss gegen den heutigen Code grün sein.
- Verify: `pnpm run ci`
- Commit: `test(map2d): hold every error the map2d specs expect to the message that names its class, property and value as well as to its error class, and to the name of the property when a write to the read-only map2dTileCoords is refused`
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · TEST-049 unverändert an allen 10 zu ändernden Fundstellen
    des Findings (`RectangularVisibilityArea.spec.ts:175,179,191`, `Map2DTileCoordsUtil.spec.ts:36,39,43,48`,
    `Map2DSpatialHashGrid.spec.ts:32`, `Map2DTileStreamer.spec.ts:102,105`), `RectangularVisibilityArea.spec.ts:185`
    gegenstandslos (Zeile 186 prüft die Meldung) · 9 weitere Stellen derselben Ursache aufgenommen
    (`RectangularVisibilityArea.spec.ts:197`, `Map2D.spec.ts:120`, `RepeatingTilesProvider.spec.ts:303`,
    `DataIdsChunk2D.spec.ts:30,31,38,40`, `TileSpritesFactory.spec.ts:49`, `CameraBasedVisibility.spec.ts:273`)
    · Folgen offen: keine (Paket 1: `Folgen: keine`) · Queue: keiner der vier Einträge teilt die Ursache ·
    neuer Nebenbefund `TileSprites/TileSpritesFactory.ts:45,50,52` → Offene Befunde
  - 2026-09-26 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach paket-1a.impl-0.json
  - 2026-09-26 Zug 2: Report FERTIG · 9 Specs unter src/map2d geändert · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (paket-1a.verify.log)
  - 2026-09-26 Zug 3: Reviewer (sonnet, low): TEST-049 behoben, 0 kritisch, 0 wichtig, 2 klein · Diff paket-1a.diff
  - 2026-09-26 Zug 4: keine Runde nötig
  - 2026-09-26 Zug 5: Commit `0b0b0877`, Verify aus Zug 2 (exit=0), keine Änderung seither

## Urteil des Reviewers

- TEST-049: behoben — `RectangularVisibilityArea.spec.ts:177f.,184f.,199f.,208f.`, `Map2DTileCoordsUtil.spec.ts:38f.,44f.,51f.,59f.`, `Map2DSpatialHashGrid.spec.ts:34f.`, `Map2DTileStreamer.spec.ts:103f.,108f.`, `Map2D.spec.ts:123f.`, `RepeatingTilesProvider.spec.ts:306`, `DataIdsChunk2D.spec.ts:33-36,45-49`, `TileSpritesFactory.spec.ts:49`, `CameraBasedVisibility.spec.ts:276`; `:185` gegenstandslos (Zeile 192 prüft die Meldung)
- klein: `Map2DTileStreamer.spec.ts:102-109` ohne Leerzeile zwischen Konstante und `expect` (plankonform)
- klein: `TileSpritesFactory.spec.ts:49` ohne `create`-Konstante (plankonform)

## Abgleich

- Gesucht mit `grep -rn toThrow` über `packages/twopoint5d/src/map2d/**/*.spec.ts`; `toThrowError`,
  `rejects` und `try/catch`-Prüfungen gibt es dort nicht (der `catch` in
  `RepeatingTilesProvider.spec.ts:226` sammelt Abweichungen, er prüft keinen Fehler).
- Schon mit Meldung und deshalb außen vor: `HelpersManager.spec.ts:38`, `RepeatingTilesProvider.spec.ts:46,54`,
  `DataIdsChunk2D.spec.ts:59,81`, `RectangularVisibilityArea.spec.ts:186`. Die `not.toThrow()`-Stellen
  prüfen keinen Fehler.
- `Map2D.spec.ts:120`: die Meldung nennt `Map2DTileStreamer`, nicht `Map2D`. Kein Nebenbefund:
  `Map2D` ist hier Fassade, der Streamer ist über `map.tileStreamer` öffentlich, und dessen TSDoc
  sagt, dass das Raster beim Streamer liegt (`Map2D.ts:9-19`). Die Meldung nennt die Klasse, die
  das Raster trägt; der Test hält das fest und erklärt es im Kommentar.
- `CameraBasedVisibility.spec.ts:273`: in Node 24 lautet die Meldung
  `Cannot set property map2dTileCoords of #<CameraBasedVisibility> which has only a getter`
  (geprüft mit `node -e` am Muster einer Klasse mit Getter). Vitest läuft nur unter Node
  (`packages/twopoint5d/vite.config.ts`, `include: ['src/**/*.spec.ts']`), die Regex hängt
  trotzdem nur am Namen der Eigenschaft — der Rest gehört der Engine.
- Nebenbefund (vorbestehend, geprüft mit `git show ead22dd1:packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`):
  `createTile()` meldet einen fehlenden Provider, ein fehlendes Tile-Set und einen fehlenden
  Atlas-Frame über `expectDefined()`; die Meldung nennt weder `TileSpritesFactory` noch
  `createTile()`, und `expectDefined()` ist laut seinem TSDoc für Invarianten gedacht, die das
  Typsystem nicht sieht — `tileSet` und `tileDataProvider` sind optionale öffentliche Felder, die
  der Aufrufer setzt. Nicht in dieses Paket: andere Ursache (die Meldung im Code, nicht ihre
  Prüfung im Test), und es blockiert nichts. Urteil `→ Scope` (liegt in `src/map2d/`, info). Der
  Test aus Schritt 8 hält die heutige Meldung fest; ändert die Drain-Runde sie, wird er rot und
  zieht mit — genau das ist der Zweck dieses Pakets.

## Findings im Volltext

**TEST-049 · info · packages/twopoint5d/src/map2d/RectangularVisibilityArea.spec.ts:175** — Die Grenzprüfungen der map2d-Specs prüfen nur die Fehlerklasse, nicht die Meldung
Weitere Fundstellen: `RectangularVisibilityArea.spec.ts:179,185,191`, `Map2DTileCoordsUtil.spec.ts:36,39,43,48`,
`Map2DSpatialHashGrid.spec.ts:32`, `Map2DTileStreamer.spec.ts:102,105`.
Aufgefallen im Remediation-Lauf vom 2026-09-26. `toThrow(RangeError)` prüft nur die Klasse. Die Meldung, die Klasse, Eigenschaft und Wert nennt, kann sich ändern oder aus einer anderen Prüfung kommen, ohne dass ein Test rot wird.
Empfehlung: Auf die Meldung prüfen (`toThrow(/…/)` oder den vollen Text), wie es die texture-Specs tun.
