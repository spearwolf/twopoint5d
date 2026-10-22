# Paket 14 — Eingaben prüfen und Ablehnungen einheitlich zeigen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — acht Nebenbefunde aus »Offene Befunde« (Drain 2026-10-22),
  dazu die Stellen gleicher Ursache aus dem Abgleich (unten)
- Ziel: Jede öffentliche Eingabe dieser Stellen wird auf gültige Werte geprüft und laut abgelehnt,
  und jede Ablehnung zeigt den abgelehnten Wert so, wie es `describeValue()` im Rest der Bibliothek
  tut (wo `describeValue()` für Objekte nicht taugt, mit einem Helfer, der auch BigInt und NaN
  richtig zeigt).
- Modell: stärkste Stufe
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`, sofern nicht anders genannt):
  - `src/utils/describeValue.ts`, neu `src/utils/describeValue.spec.ts`
  - `src/sprites/spriteDeclarations.ts`, `src/sprites/SpriteFeature.ts`,
    `src/sprites/features/NineSlice.ts`, `src/sprites/passes/MirrorAtPlane.ts`,
    `src/sprites/passes/PlanarShadow.ts` samt Specs (`spriteDeclarations.spec.ts`,
    `defineSprite.spec.ts`, `SpriteFeature.spec.ts`, `features/NineSlice.spec.ts`,
    `passes/pass-features.spec.ts`, `passes/facing.spec.ts`)
  - `src/controls/PanControl2D.ts` samt `PanControl2D.spec.ts`
  - `src/map2d/RepeatingTilesProvider.ts`, `src/map2d/Map2DTileStreamer.ts`,
    `src/map2d/chunk-quad-tree/DataIdsChunk2D.ts` samt Specs
  - `src/texture/sampleAtlasFrame.ts`, `src/texture/TexturePackerJson.ts`,
    `src/texture/TextureStore.ts`, `src/texture/AsepriteJson.ts`,
    `src/texture/checkTextureStoreData.ts` (nur Kommentar) samt Specs
    (`sampleAtlasFrame.spec.ts`, `TexturePackerJson.spec.ts`, `TextureStore.spec.ts`,
    `AsepriteJson.spec.ts`, `FrameBasedAnimations.spec.ts`)
  - `src/vertex-objects/VertexObjectBuffer.ts`, `VOBufferPool.ts`, `VertexObjectPool.ts`,
    `createTypedArray.ts`, `VertexObjectDescriptor.ts` samt Specs
  - `src/text/BitmapFont.ts` (eine Meldung)
  - `packages/twopoint5d-testing/test/sprites-reflection-pass.test.js`,
    `packages/twopoint5d-testing/test/sprites-shadow-pass.test.js`
  - `packages/twopoint5d/docs/sprites.md`, `packages/twopoint5d/docs/map2d.md`,
    `packages/twopoint5d/CHANGELOG.md`, `AGENTS.md` (Repo-Root)
- Vorgehen:
  1. **`describeValue()` zeigt jeden Wert lesbar** (`src/utils/describeValue.ts`). Die Signatur
     bleibt `describeValue(value: unknown): string`, die Funktion bleibt intern (nicht in
     `src/utils/public-api.ts`). Regeln, genau so:
     - String: `"${value}"` in doppelten Anführungszeichen, ohne Escaping (wie bisher).
     - BigInt: `${value}n` — `1n` zeigt `1n`, nicht `1`.
     - Funktion: `[Function: <name>]`, bei leerem `name` `[Function]` — nie der Quelltext.
     - Array (`Array.isArray`): `[` + Einträge, getrennt durch `, ` + `]`, jeder Eintrag nach
       denselben Regeln. `[1.5, NaN, -1]`, `["a", 2]`, `[]`.
     - Plain Object (Prototyp `Object.prototype` oder `null`): `{` + `key: value`, getrennt durch
       `, ` + `}`, über `Object.keys()` (nur eigene aufzählbare String-Schlüssel). Ein Schlüssel,
       der `/^[A-Za-z_$][\w$]*$/` erfüllt, steht bar, jeder andere in doppelten Anführungszeichen:
       `{value: 1n}`, `{value: NaN, shared: "yes"}`, `{"a b": 1}`, `{}` (auch für
       `Object.create(null)`).
     - Höchstens 8 Einträge je Array oder Objekt, danach als neunter Eintrag `…` (U+2026):
       `[1, 2, 3, 4, 5, 6, 7, 8, …]`, `{a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, …}`.
     - Drei Ebenen tief: der äußerste Container ist Ebene 1; ein Array oder Objekt auf Ebene 4
       erscheint als `[…]` bzw. `{…}`, gleich ob leer. `[[[[1]]]]` → `[[[[…]]]]`,
       `{a: {b: {c: {d: 1}}}}` → `{a: {b: {c: {…}}}}`. Das beendet auch einen Zyklus
       (`const a: unknown[] = []; a.push(a)` → `[[[[…]]]]`), eine eigene Zyklenerkennung entfällt.
     - Alles andere wie `String(value)`: Zahl (`NaN`, `-Infinity`), Boolean, `null`, `undefined`,
       Symbol (`Symbol(a)`), RegExp (`/a/g`), Map (`[object Map]`), Klasseninstanz
       (`[object Object]`).
     Die Konstanten `MAX_ENTRIES = 8` und `MAX_DEPTH = 3` modulweit, die Rekursion als nicht
     exportierte Funktion mit Tiefenparameter. TSDoc neu: was die Funktion zeigt und warum (eine
     Meldung soll den abgelehnten Wert so zeigen, dass `"16"` von `16`, `1n` von `1` und ein
     Objekt von einem anderen unterscheidbar bleibt, und eine BigInt die Meldung nie verliert —
     `JSON.stringify()` wirft für sie). Neues `src/utils/describeValue.spec.ts` mit je einem Fall
     für jede Regel oben, die Beispiele dieser Liste als Erwartungen.
  2. **Jede Ablehnung zeigt ihren Wert über `describeValue()`.** Ersetzen, Wortlaut sonst
     unverändert (Import jeweils relativ mit `.js`):
     - `src/sprites/spriteDeclarations.ts:35` — `shownDeclared` entfällt; Meldung `:102` zeigt
       `${describeValue(declared)}`. `shown` (`:34`) bleibt: es zeigt nur gültige, endliche
       Startwerte als Code-Vorschlag (`{value: [0,1], shared: true}`).
     - `src/texture/sampleAtlasFrame.ts:88` → `` `sampleAtlasFrame: the origin ${describeValue(origin)} is none of ${ORIGINS.join(', ')}` ``;
       `:92` → `` `sampleAtlasFrame: the wrap ${describeValue(wrap)} is neither one of ${WRAPS.join(', ')} nor a pair of them` ``;
       `:98` → `` `sampleAtlasFrame: the wrap ${describeValue(axis)} is none of ${WRAPS.join(', ')}` ``;
       `:102` → `` `sampleAtlasFrame: the trim ${describeValue(trim)} is none of ${TRIMS.join(', ')}` ``;
       `:105` → `` `sampleAtlasFrame: the inset ${describeValue(inset)} is no finite number of 0 or more` ``.
       Fehlertypen bleiben (`Error`, `RangeError` für `inset`).
     - `src/texture/TextureStore.ts:441` (`registerAtlasAdapter()`) → `got a name of ${describeValue(name)}`.
     - `src/texture/AsepriteJson.ts:260` → `has the direction ${describeValue(tag.direction)}`.
     - `src/sprites/features/NineSlice.ts:87` — `shownInsets` entfällt; Meldung `:173` zeigt
       `${describeValue(slice)}` (Arrays erscheinen wie bisher als `[1, 2, 3, NaN]`, ein String-Eintrag
       jetzt in Anführungszeichen).
     - `src/sprites/SpriteFeature.ts:208` → `got ${describeValue(stage.order)}`.
     - `src/vertex-objects/VertexObjectBuffer.ts:197`, `:411`, `:517`, `:585` — `String(x)` →
       `describeValue(x)`; `:556` → `got ${describeValue(targetIndex)}, ${describeValue(startIndex)} and ${describeValue(endIndex)}`;
       `:646` → `got ${describeValue(startIndex)} and ${describeValue(endIndex)}`.
     - `src/vertex-objects/VOBufferPool.ts:107`, `:307` — `String(x)` → `describeValue(x)`;
       `:141` → `got ${describeValue(value)}`.
     - `src/vertex-objects/VertexObjectPool.ts:147` — `String(capacity)` → `describeValue(capacity)`.
     - `src/vertex-objects/createTypedArray.ts:34` → `` `typedArrayOf: unknown data type ${describeValue(dataType)}` ``
       (die einfachen Anführungszeichen entfallen, der String bekommt die doppelten von
       `describeValue()`).
     - `src/vertex-objects/VertexObjectDescriptor.ts:154` → `got ${describeValue(vertexCount)}`;
       `:166` → `got ${describeValue(attr.size)}`.
     - `src/map2d/chunk-quad-tree/DataIdsChunk2D.ts:54` → `` `DataIdsChunk2D: the compression ${describeValue(compression)} is not supported` ``.
     - `src/text/BitmapFont.ts:229` → `of ${describeValue(value)} — 0 or more` (gleiche Ausgabe, eine
       Regel ohne Ausnahme).
     Nicht anfassen: `src/stage/StageRenderer.ts` und `StageRenderOrder.ts` (Namen, keine
     abgelehnten Werte; `StageRenderer.ts` gehört Paket 15), `TextureStore.ts:134`, `:599`, `:675`,
     `:1106`, `:1266` (Kontext eines Aufrufs, kein abgelehnter Wert), `OrthographicProjection.ts:138`,
     `ParallaxProjection.ts:142` (zeigen den `type` der Kamera), Längen und Zähler
     (`TextureCoords.ts:192`, `DataIdsChunk2D.ts:43`, `RepeatingTilesProvider.ts:149`,
     `FrameBasedAnimations.ts:205`/`:210`), `checkBufferArray.ts` (Typnamen), `src/testing/`.
  3. **`checkTextureStoreData.ts:10`** — `describeCatalogValue()` bleibt (»an array«/»an object«),
     nur der Kommentar bekommt seinen jetzt gültigen Grund: ein Katalog ist groß, und was die
     Meldung nennen muss, ist seine Art — Array oder Objekt —, nicht sein Inhalt.
  4. **`AGENTS.md`**, Abschnitt »Error and warning messages«: nach dem Satz zu `assertFinite()` /
     `assertPositiveFinite()` einfügen: »A refused value is quoted through `describeValue()` in
     `src/utils/`, never through `String()`, `JSON.stringify()` or a bare interpolation: it writes a
     string in double quotes, a BigInt as `1n`, and an array or a plain object by its content.«
     (umbrochen wie der Absatz, ≤ 88 Zeichen je Zeile wie dort).
  5. **Ebene ohne Normale** (`src/sprites/passes/MirrorAtPlane.ts`, `PlanarShadow.ts`). Eine
     `mirrorPlane` oder `groundPlane` der Form `[0, 0, 0, d]` ist keine Ebene: der Pass zeichnet
     nichts. Umsetzung im `mesh.transform` beider Features mit `select()` aus `three/tsl`:
     - `MirrorAtPlane`: `return select(float(0).lessThan(size), sub(p, mul(n, mul(2, sub(dot(n, p), d)))), vec3(0));`
       — `size`, `n`, `d` wie bisher (`length(plane.xyz)` und die beiden `div()`).
     - `PlanarShadow`: `return select(float(0).lessThan(dot(n, n)), sub(clamped, mul(towardsLight, div(sub(height, excess), dot(n, towardsLight)))), vec3(0));`
       — `n`, `height`, `excess`, `clamped`, `towardsLight` wie bisher.
     Importe `select`, `float`, `vec3` aus `three/tsl`.
     Bedingung als `float(0).lessThan(…)`, weil `evaluateNode()` (`src/testing/spriteGraph.ts`) nur
     den Operator `<` kennt; jede Ecke geht auf den Ursprung des Meshes, die Dreiecke haben keine
     Fläche. Das `NaN` im nicht gewählten Zweig erreicht die Ausgabe nicht (WGSL `select()` und
     GLSL-Ternary wählen komponentenweise); so deckt die Wache in der Mesh-Transformation auch
     `MirroredBillboardPlacement` (`facing.ts` `mirroredBillboardVertex()`, teilt durch
     `length(plane.xyz)`) und `LightFacingPlacement` (`lightFacingVertex()`, `normalize(plane.xyz)`)
     ab: beide verlangen per `requires` das Feature mit der Wache, und dessen Transformation läuft
     nach der Placement. Keine Ablehnung auf der JS-Seite: der Wert kommt über `setUniform()`,
     `bindUniform()` (je Frame) und `planeOf()`, ohne Prüfhaken je Uniform; ein Wurf im Frame
     wäre schlimmer als ein leerer Pass. Kein `as unknown as` (`typed-stages.spec.ts` verbietet es
     unter `passes/`); reicht die Inferenz von `select()` nicht, `asVec3()` aus
     `src/sprites/typedNodes.ts`. Kommentar an der Bedingung: `// a normal of (0, 0, 0) is no
     plane: every vertex goes to the origin, and the pass draws nothing`. TSDoc beider Features
     um einen Satz ergänzen: »A plane whose normal is `(0, 0, 0)` is no plane: the pass draws
     nothing for it.« (bei `PlanarShadow` sinngemäß für `groundPlane`).
     `docs/sprites.md:2484` (Absatz zu `planeOf()`) um einen Satz ergänzen: eine `mirrorPlane` oder
     `groundPlane` mit der Normale `(0, 0, 0)` ist keine Ebene, `ReflectionPass`,
     `BillboardReflectionPass`, `ShadowPass` und `SegmentShadowPass` zeichnen dann nichts. Prosa
     ≤ 100 Zeichen je Zeile.
  6. **`PanControl2D`** (`src/controls/PanControl2D.ts`): `pixelsPerSecond`, `speedNorth`,
     `speedEast`, `speedSouth`, `speedWest` werden Accessoren über private Felder
     (`#pixelsPerSecond = 0` usw.); jeder Setter schreibt
     `assertFinite(value, 'PanControl2D', name)` mit `name` = `'pixelsPerSecond'`, `'speedNorth'`,
     `'speedEast'`, `'speedSouth'` bzw. `'speedWest'` (aus `src/utils/assertFinite.ts`;
     negative Werte bleiben erlaubt, sie fahren in die Gegenrichtung) — ein abgelehnter Wert wirft
     `RangeError` `PanControl2D: speedEast must be a finite number, got NaN` und lässt den
     gehaltenen Wert stehen. Der Konstruktor prüft die Option unter ihrem eigenen Namen:
     `this.pixelsPerSecond = assertFinite(readOption(options, 'speed', 100), 'PanControl2D', 'speed')`.
     Die Setter nehmen auch auf einem disposed Control Werte (TSDoc von `dispose()` sagt das,
     bleibt). TSDoc an `pixelsPerSecond` (die Geschwindigkeit, auf die eine gedrückte Taste ihr
     Feld setzt, Pixel je Sekunde; die Option `speed`) und an den vier Feldern (Pixel je Sekunde
     in diese Richtung; eine Taste setzt es auf `pixelsPerSecond` und beim Loslassen auf 0; von
     Hand gesetzt bewegt es die Ansicht in jedem `update()`); jeweils: ein Wert, der keine endliche
     Zahl ist, wirft einen `RangeError` und lässt den gehaltenen stehen. TSDoc der Option `speed`
     (`:115`) um denselben Satz ergänzen. `src/controls/hot-path-allocations.spec.ts` muss grün
     bleiben (Accessoren über private Felder allozieren nichts).
  7. **`RepeatingTilesProvider#tileIds`** (`src/map2d/RepeatingTilesProvider.ts`): nach der
     Formprüfung im Setter, vor dem ersten Schreiben, jede Zelle prüfen: eine Tile-Id ist
     `Number.isInteger(id) && id >= 0 && id <= MAX_TILE_ID`, modulweit
     `const MAX_TILE_ID = 0xffffffff` mit Kommentar (der größte Wert, den eine Zelle des
     `Uint32Array` von `getTileIdsWithin()` hält). Sonst
     `RangeError` `` `RepeatingTilesProvider: a tile id is a whole number from 0 to ${MAX_TILE_ID}, but row ${row}, column ${col} holds ${describeValue(id)}` ``
     (Zahl ausgeschrieben, also `4294967295`); der Provider behält sein Muster. Der Konstruktor
     läuft schon über den Setter (`new RepeatingTilesProvider(NaN)` wirft damit). TSDoc des
     Setters (`:45–50`) um die Regel ergänzen. `docs/map2d.md:22–23` nach »the id `0` is a hole —
     no sprite.« einen Satz: `RepeatingTilesProvider` nimmt Ids, die ganze Zahlen von 0 bis
     4294967295 sind — den Bereich des `Uint32Array`, das `getTileIdsWithin()` schreibt —, und lehnt
     ein Muster mit jedem anderen Wert ab. Prosa ≤ 100 Zeichen.
  8. **`Map2DTileStreamer#tiles`** (`src/map2d/Map2DTileStreamer.ts:147`): das öffentliche Feld
     wird `#tiles: IMap2DTileCoords[] = []` mit Getter `get tiles(): readonly IMap2DTileCoords[]`,
     ohne Setter; `update()` schreibt `this.#tiles` (`:223`, `:237`, `:244`, Kommentar `:276`
     mitziehen). TSDoc des Getters: die Tiles, die das letzte `update()` ausgelegt hat — die Liste,
     die der Visibilitor zurückgab und die er im nächsten `update()` als `previousTiles` bekommt;
     leer nach dem Clear eines Updates; nur lesbar, `clearTiles()` lässt das nächste `update()`
     den ganzen Satz neu auslegen. `IMap2DVisibilitor.computeVisibleTiles(previousTiles:
     IMap2DTileCoords[], …)` bleibt unverändert (intern wird das private, veränderliche Array
     übergeben). Breaking: Schreiben wirft in JS (`TypeError` im Strict Mode), in TS ein Fehler.
  9. **`TexturePackerJson.parse()`** (`src/texture/TexturePackerJson.ts:73–82`): in der
     Namensschleife vor dem ersten `add()` zuerst prüfen, dass der Name ein String ist (über
     `entries.entries()` für den Index); sonst
     `TypeError` `` `TexturePackerJson: the frame ${index} of the "JSON Array" frames has a filename of ${describeValue(name)} — a frame of that format is named by its filename, a string` ``.
     Nur die »JSON Array«-Form kann hier fehlen (Hash-Schlüssel sind immer Strings); ein leerer
     String bleibt ein Name, wie ein leerer Hash-Schlüssel. Der `target` bleibt unverändert.
     TSDoc: `@throws {TypeError} if a frame of the "JSON Array" format has a filename that is no
     string; the target stays as it was.`
  10. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, `[Unreleased]`, Skill `updating-changelog`):
      - `### Fixed`: die Zeile, die mit »- the refusals of `flatPlacement()`, `axisBillboardPlacement()`«
        beginnt (`:119`), ersetzen durch: »every refusal of the library quotes the value it refuses
        the same way: a string in double quotes, `NaN`, an infinity and a BigInt as themselves
        (`1n`), an array or a plain object by its content — `[1.5, NaN, -1]`, `{value: 1n}` — up to
        eight entries and three levels deep, and a function by its name. A uniform declared as
        `{value: 1n}` and a `wrap` of `sampleAtlasFrame()` given as a BigInt are refused with such a
        message«. Keine Factories aufzählen, `describeValue()` (intern) nicht nennen.
      - `### Fixed`, neu: `MirrorAtPlane` und `PlanarShadow` zeichnen für eine Ebene mit der
        Normale `(0, 0, 0)` nichts — jede Ecke von `ReflectionPass`, `BillboardReflectionPass`,
        `ShadowPass` und `SegmentShadowPass` geht auf den Ursprung des Meshes, keine wird `NaN`.
      - `### Fixed`, neu: `PanControl2D` lehnt eine Option `speed`, ein `pixelsPerSecond` und einen
        Wert von `speedNorth`, `speedEast`, `speedSouth`, `speedWest`, der keine endliche Zahl ist,
        mit einem `RangeError` ab, der ihn nennt, und behält den gehaltenen Wert — ein `NaN` dort
        machte `panView` sonst für immer `NaN`.
      - `### Fixed`, neu: `RepeatingTilesProvider` lehnt über den Konstruktor und `tileIds` ein
        Muster mit einer Tile-Id ab, die keine ganze Zahl von 0 bis 4294967295 ist, mit einem
        `RangeError`, der Zeile, Spalte und Wert nennt, und behält sein Muster: `getTileIdAt()` und
        `getTileIdsWithin()` antworten für jede Zelle dieselbe Id.
      - `### Fixed`, neu: `TexturePackerJson.parse()` lehnt ein Frame der »JSON Array«-Form ab,
        dessen `filename` kein String ist, mit seinem Index, bevor das erste Frame in den Atlas geht.
      - `### Changed`, neu, nahe der Zeile zu `RepeatingTilesProvider#tileIds` (`:95`):
        »`Map2DTileStreamer#tiles` is read-only, typed `readonly IMap2DTileCoords[]`: the streamer
        alone writes the list it hands its visibilitor as `previousTiles` (**BREAKING**). See the
        Migration Guide« — `(**BREAKING**)`, nicht »for TypeScript«: auch in JS wirft die Zuweisung.
      - `### Migration Guide`, neu nach »#### The tile pattern of RepeatingTilesProvider«:
        `#### The tiles of Map2DTileStreamer` — ein Satz, warum (eine von außen zugewiesene Liste
        ginge als ausgelegte Tiles an den Visibilitor, die keine Renderer halten), dann
        **Before** `streamer.tiles = [];` / **After** `streamer.clearTiles();` in einfachen
        `ts`-Blöcken (wie der Abschnitt davor).
      Englisch, ohne Rückblick (»früher«, »bisher«, »where … before« fallen weg), Gedankenstriche
      wie im Rest der Datei, kein Gedankenstrich vor einem Doppelpunkt.
  11. **Abschlussprobe**: `grep -rnE "String\(|JSON\.stringify\(" packages/twopoint5d/src --include=*.ts`
      ohne `*.spec.ts` und `src/testing/` — jeder Treffer, der in einer Meldung einen abgelehnten
      Wert zeigt und nicht unter »Nicht anfassen« in Schritt 2 steht, wird im Report gemeldet
      (nicht behoben).
- Regressionstests (vor dem Fix rot laufen lassen, der rote Lauf gehört in den Report):
  - `src/utils/describeValue.spec.ts`: `shows a BigInt with its n`, `shows an array by its
    entries`, `shows a plain object by its keys and values`, `shows at most eight entries`,
    `shows three levels and no deeper, a cycle included`, `shows a function by its name` (rot
    gegen den heutigen Helfer).
  - `spriteDeclarations.spec.ts`: `refuses a uniform declared as {value: 1n}, showing it` (heute
    `TypeError: Do not know how to serialize a BigInt`) und `… {value: NaN}, showing NaN` (heute
    `{"value":null}`).
  - `sampleAtlasFrame.spec.ts` (hat bisher keine Ablehnungstests): `test.each` über origin `5`,
    wrap `1n`, wrap `{}`, wrap `["clamp", "x"]`, trim `null`, inset `-1` und inset `1n`, jeweils mit
    der vollen Meldung aus Schritt 2 (rot: wrap `1n` wirft den BigInt-Fehler, origin `5` zeigt
    `"5"`).
  - `TextureStore.spec.ts:3645`: Erwartung auf `got a name of ""` umstellen, dazu der Fall `{}` →
    `got a name of {}`.
  - `AsepriteJson.spec.ts`: eine Richtung `1n` wird mit `has the direction 1n` abgelehnt.
  - `FrameBasedAnimations.spec.ts:211`: `[{}, '[object Object]']` → `[{}, '{}']`.
  - Je ein Test mit einem String-Wert, der in der Meldung in doppelten Anführungszeichen erscheint,
    in `VertexObjectBuffer.spec.ts`, `VertexObjectPool.spec.ts` (`resize('4' as never)` →
    `got "4"`), `VertexObjectDescriptor.spec.ts`, `createTypedArray.spec.ts`,
    `SpriteFeature.spec.ts` (`order: '1'`), `NineSlice.spec.ts` (ein Inset `"4"`); in
    `DataIdsChunk2D.spec.ts` die Kompression `1` → `the compression 1 is not supported`.
  - `passes/pass-features.spec.ts`: `MirrorAtPlane sends every vertex to the origin for a normal
    of (0, 0, 0)` (`mirror([0, 0, 0, 1], [1, 3, 5])` → `[0, 0, 0]`, heute `NaN`), dasselbe für
    `PlanarShadow` mit `groundPlane` `[0, 0, 0, 0]`.
  - `passes/facing.spec.ts`: die Kette `mirroredBillboardVertex()` → `MirrorAtPlane` und
    `lightFacingVertex()` → `PlanarShadow` antwortet für eine Ebene `[0, 0, 0, 1]` `[0, 0, 0]`.
  - `PanControl2D.spec.ts`: `refuses a speed option that is no finite number` (`NaN`, `Infinity`),
    `refuses a speed field set to NaN and keeps the one it holds` (alle vier Felder und
    `pixelsPerSecond`), `takes a negative speed`.
  - `RepeatingTilesProvider.spec.ts`: `refuses a tile id that is no whole number from 0 to
    4294967295, naming row, column and value, and keeps its pattern` (`[[1.5, NaN, -1]]`,
    `[[4294967296]]`, `[["1"]]`), `takes 0 and 4294967295`, `new RepeatingTilesProvider(NaN)
    throws`.
  - `Map2DTileStreamer.spec.ts`: `tiles is read-only` — Typtest mit `// @ts-expect-error` auf
    `streamer.tiles = []` (rot in `pnpm nx typecheck twopoint5d`) und Laufzeit
    `expect(() => { (streamer as unknown as {tiles: unknown}).tiles = []; }).toThrow(TypeError)`.
  - `TexturePackerJson.spec.ts`: `refuses a "JSON Array" frame without a filename, naming its
    index, and leaves the target as it was`.
  - Browsertests (Rot ist hier nicht zu erwarten — eine GPU verwirft Dreiecke mit `NaN`-Ecken
    meist selbst; sie pinnen das Verhalten auf beiden Backends): in
    `sprites-reflection-pass.test.js` `draws no reflection for a mirrorPlane whose normal is
    (0, 0, 0), and the sprite as before` für `ReflectionPass` und `BillboardReflectionPass`
    (`sprites.setUniform('mirrorPlane', 0, 0, 0, 0)`: keine grünen Pixel, die weißen wie im
    ersten Test), in `sprites-shadow-pass.test.js` `draws no shadow for a groundPlane whose
    normal is (0, 0, 0)`.
  - Mitziehen ohne neuen Test: jede bestehende Spec, die eine der geänderten Meldungen mit einem
    String, einem Objekt oder einem Array als Wert festnagelt (u. a. `spriteDeclarations.spec.ts`,
    `defineSprite.spec.ts` »starts the uniform«, `NineSlice.spec.ts:453`, `AsepriteJson.spec.ts:246`
    bleibt für `"sideways"` gleich).
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: quote a refused value the same way in every error message — a string in double quotes, NaN, an infinity and a BigInt as themselves, an array or a plain object by its content —, refuse a speed of PanControl2D that is no finite number, a tile id of RepeatingTilesProvider that is no whole number from 0 to 2^32 - 1 and a frame of a TexturePacker "JSON Array" without a filename, draw no reflection and no shadow for a plane whose normal is (0, 0, 0), and hand out the tiles of Map2DTileStreamer read-only`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · alle acht Queue-Einträge bestehen (`spriteDeclarations.ts:35`,
    `MirrorAtPlane.ts:16`, `PanControl2D.ts:241`, `RepeatingTilesProvider.ts:51`,
    `Map2DTileStreamer.ts:147`, `sampleAtlasFrame.ts:86–105`, `TexturePackerJson.ts:69` unverändert;
    `TextureStore.ts` von `:446` nach `:441` gewandert) · gleiche Ursache aufgenommen: 18 weitere
    Ablehnungen mit `String()`/`JSON.stringify()`/roher Interpolation (Schritt 2) und die zweite
    Ebene ohne Normale (`PlanarShadow` `groundPlane`, deckt `LightFacingPlacement` mit) · von
    Paket 17 übernommen: Reviewer-Befund aus Paket 7 zum `describeValue`-Eintrag im CHANGELOG
    (Schritt 10 schreibt die Zeile neu) · offene Folgen: keine im Plan
  - 2026-10-22 Zug 1: Implementierer beauftragt (opus, effort medium), Brief `paket-14.impl-0.brief.txt`, Report nach `paket-14.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG (Session 818833b3-55cb-414d-af29-0d0f913bdcc0) · 21 Quelldateien, 22 Specs, Fixture `preset-graphs.json`, 2 Browsertests, `docs/sprites.md`, `docs/map2d.md`, `CHANGELOG.md`, `AGENTS.md` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-14.verify.log`)
  - 2026-10-22 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-14.diff` (2690 Zeilen, 50 Dateien)
  - 2026-10-22 Zug 3: Urteil (`paket-14.review-0.json`) — alle 8 Einträge und Schritte 1–11 umgesetzt · 1 wichtig (Proposal `pipeline-stages-and-grid-base.md:269` zitiert alte Form), 5 klein
  - 2026-10-22 Zug 4 Runde 1: offen 1 wichtig + 4 klein (Shadow-Browsertest erreicht Wache nicht, `AGENTS.md:112` 89 Zeichen, Importreihenfolge `PanControl2D.ts:10`, Leerzeile `Map2DTileStreamer.ts:156`) → derselbe Implementierer per Resume (opus, medium), Report nach `paket-14.impl-1.json`
  - 2026-10-22 Zug 4 Runde 1: zurück FERTIG — Proposal `:270` umgestellt, Shadow-Browsertest mit Punktlicht `[0, 10, 0, 1]` und Ebene `[0, 0, 0, -1]`, neuer Hook-Pin in `pass-features.spec.ts`, AGENTS.md, Import, Leerzeile · Verify `pnpm run ci` exit=0 (`paket-14.verify-1.log`) · Diff `paket-14.diff-1` · gezielter Review (sonnet, medium) nach `paket-14.review-1.json`
  - 2026-10-22 Zug 4 Runde 1: Review — Befunde 1, 2, 4, 5 behoben, 3 behoben für die eigene Zeile (`AGENTS.md:112`); die gemeldete `:107` mit 89 Zeichen steht unverändert seit HEAD `2ea485d8` (die Datei hat dort 15 Zeilen über 88), kein Befund dieses Pakets · keine neuen Befunde · Fortschritt: alle offenen erledigt, Kette endet
  - 2026-10-22 Zug 5: Commit `f9a6029e` mit Trailer `Remediation-Run: 2026-10-21`, 51 Pfade · Verify `paket-14.verify-1.log` exit=0 · Plan: `[x]`, Queue-Einträge abgehakt, 3 Nebenbefunde in »Offene Befunde«, 3 Folgen unter dem Paket

## Abgleich und Entscheidungen

**Abgleich je Queue-Eintrag** (Stand `2ea485d8`, Arbeitsbaum sauber):

- `src/sprites/spriteDeclarations.ts:35` — unverändert: `shownDeclared()` zeigt Objekte per
  `JSON.stringify()` (BigInt wirft, `NaN` erscheint als `null`), Primitive per `String()`.
- `src/sprites/passes/MirrorAtPlane.ts:16–18` — unverändert: `div(plane.xyz, length(plane.xyz))`.
  Gleiche Ursache gefunden: `facing.ts` `mirroredBillboardVertex()` (`div(plane.xyz, size)`),
  `lightFacingVertex()` (`normalize(plane.xyz)`), `PlanarShadow.ts` (`div(excess, dot(n, n))`).
- `src/controls/PanControl2D.ts:241` — unverändert: `readOption(options, 'speed', 100)` ohne
  Prüfung; `pixelsPerSecond` und die vier `speed…` sind öffentliche Felder (`:185–190`), `update()`
  liest sie ungeprüft (`:451–454`).
- `src/map2d/RepeatingTilesProvider.ts:51–69` — unverändert: der Setter prüft nur die Form.
- `src/map2d/Map2DTileStreamer.ts:147` — unverändert: `tiles: IMap2DTileCoords[] = []` öffentlich
  zuweisbar. Aufrufer außerhalb von `src/map2d/` gibt es nicht (Lookbook, `twopoint5d-testing`,
  Docs: kein Treffer); die Specs lesen nur.
- `src/texture/sampleAtlasFrame.ts:88–105` — unverändert: `"${String(origin)}"`,
  `JSON.stringify(wrap)`, `"${String(axis)}"`, `"${String(trim)}"`, `${inset}`.
- `src/texture/TexturePackerJson.ts:69` — unverändert: `frameData.filename` ungeprüft,
  `target.add(undefined, …)` landet im unbenannten Zweig von `TextureAtlas#add()`.
- `src/texture/TextureStore.ts:441` — gewandert (Queue nennt `:446`), Sachverhalt unverändert:
  `String(name)`.

**Gleiche Ursache aufgenommen** (Nebenbefunde, vorbestehend — nachgesehen mit
`git show 6500527f:<pfad>`: jede Stelle stand vor dem Lauf schon so, `createTypedArray.ts` als rohe
Interpolation `'${dataType}'`, die Paket 5 und 10 nur umformuliert haben): die
Ablehnungen in Schritt 2, die einen abgelehnten Wert über `String()`, `JSON.stringify()` oder eine
rohe Interpolation zeigen. Grund: das Ziel des Pakets ist »jede Ablehnung zeigt den Wert wie
`describeValue()`«, und eine halbe Umstellung ließe dieselbe Ursache an 18 Stellen stehen.
Ebenso `PlanarShadow` zur Null-Normale: dieselbe Ursache (eine Ebenen-Uniform ohne Normale),
dieselbe Wache.

**Entscheidungen dieses Zugs** (alle im Rahmen von »Was du allein entscheidest«):

- *`describeValue()` erweitern statt einen zweiten Helfer bauen.* Der Grobplan lässt offen, ob
  der Helfer für Objekte neben `describeValue()` steht. Ein zweiter Helfer hieße zwei Regeln für
  dieselbe Frage, und `describeValue()` zeigte weiter `1n` als `1` und jedes Objekt als
  `[object Object]` — in rund 40 Meldungen, die das Objekt- und das BigInt-Problem ebenso haben
  (`FrameBasedAnimations.ts:200`, `:496` u. a.). Erweitert, profitieren alle; die einzige
  festgenagelte Erwartung, die sich dadurch ändert, ist `FrameBasedAnimations.spec.ts:211`.
  Grenzen (8 Einträge, 3 Ebenen) halten eine Meldung lesbar, auch für ein großes Array, und
  beenden Zyklen ohne eigene Erkennung.
- *`describeCatalogValue()` bleibt.* Ein Katalog ist groß, und »got an array instead of texture
  store data« sagt das Richtige; nur der Kommentar bekommt den Grund, der jetzt trägt.
- *Ebene ohne Normale: Rückfall im Shader, keine Ablehnung.* Die Uniform kommt über
  `setUniform()`, `bindUniform()` (je Frame) und `planeOf()`; eine Prüfung je Uniform gibt es im
  Feature-System nicht, und ein Wurf im Frame-Loop wäre schlimmer als ein leerer Pass. Rückfall
  »nichts zeichnen« statt »Ecke stehen lassen«: ungespiegelt läge die abgedunkelte Reflexion
  bzw. der Schatten deckungsgleich über dem Sprite — ein sichtbarer Fehler; eine Ebene ohne
  Normale hat weder Spiegelbild noch Schatten.
- *`PanControl2D`: `assertFinite()`, nicht `assertPositiveFinite()`.* `0` ist eine gültige
  Geschwindigkeit (Tasten bewegen nichts), eine negative fährt in die Gegenrichtung und war nie
  verboten; das Problem sind `NaN` und die Unendlichkeiten. Accessoren statt einer Prüfung in
  `update()`, weil das Ziel »laut abgelehnt« verlangt.
- *Tile-Id-Bereich 0 bis 4294967295.* Genau der Wertebereich einer Zelle des `Uint32Array`, das
  `getTileIdsWithin()` schreibt; nur so antworten `getTileIdAt()` und `getTileIdsWithin()` für
  jede Zelle dieselbe Id. `RangeError` auch für einen String, wie `assertFinite()` es für
  Nicht-Zahlen tut. Als `Fixed` ohne **BREAKING**: ein solcher Wert lieferte schon zwei
  verschiedene Antworten für dieselbe Zelle.
- *`Map2DTileStreamer#tiles` als Getter, **BREAKING** mit Migration Guide* nach »Entscheidungen«
  Zeile 3; `(**BREAKING**)` ohne »for TypeScript«, weil auch eine Zuweisung in JS wirft.
- *Ein Paket, kein Split.* Die Schleife fährt Paket 14 unter dieser Nummer; die Umstellung der
  Meldungen ist mechanisch und hängt an Schritt 1, die fünf Eingabeprüfungen sind je eine Datei.
- *Modell stärkste Stufe, Effort medium.* Fünf Module (sprites, controls, map2d, texture,
  vertex-objects), eine öffentliche API bricht, ein Shader ändert sich samt Browsertest; die
  Schritte sind exakt, die Spec-Nacharbeit nicht.

## Findings im Volltext

Paket 14 trägt keine Audit-Findings. Die Einträge aus »Offene Befunde« im Wortlaut:

**`packages/twopoint5d/src/sprites/spriteDeclarations.ts:35`** — `shownDeclared()` zeigt eine
abgelehnte Uniform-Deklaration per `JSON.stringify()`: bei `{value: 1n}` fliegt statt der
Ablehnung »Do not know how to serialize a BigInt«, `{value: NaN}` erscheint als
`{"value":null}`; `describeValue()` hilft hier nicht (zeigt Objekte als `[object Object]`),
deshalb nicht in CONS-001; stand so schon in `6500527f` (Paket 7, Zug 0) → Scope

**`packages/twopoint5d/src/sprites/passes/MirrorAtPlane.ts:16`** — eine `mirrorPlane` mit
Normale `(0, 0, 0)` teilt durch `length(plane.xyz) = 0`, der Shader liefert NaN; weder Ablehnung
noch Fallback; stand so schon in `6500527f` (Paket 7) → Scope

**`packages/twopoint5d/src/controls/PanControl2D.ts:241`** — `readOption(options, 'speed', 100)`
prüft den Wert nicht; `speed: NaN` oder ein von Hand gesetztes `speedEast = NaN` macht `panView`
dauerhaft `NaN`, trotz der Delta-Prüfung in `update()`; stand so schon in `6500527f` (Paket 9)
→ Scope

**`packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:51`** — der Setter `tileIds` prüft nur
die Form, nicht die Werte: `[[1.5, NaN, -1]]` wird angenommen, `getTileIdAt()` gibt sie
unverändert heraus, `#writeRow()` schreibt sie gekürzt bzw. als 0 in den `Uint32Array`; Setter
stand so schon in `6500527f` (Paket 9) → Scope

**`packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:147`** — `tiles` ist ein öffentlich
zuweisbares Feld; ein von außen zugewiesenes Array geht als `previousTiles` an den Visibilitor,
ohne Bezug zu dem, was die Renderer halten; stand so schon in `6500527f` (Paket 9) → Scope

**`packages/twopoint5d/src/texture/sampleAtlasFrame.ts:105`** — die Ablehnung von `inset`
interpoliert den Wert roh (`${inset}`) statt über `describeValue()`; die Meldungen zu `origin`,
`wrap` und `trim` (`:86–100`) zeigen Werte mit `String()` bzw. `JSON.stringify()`; stand so schon
in `72127b52` (Paket 11) → Scope

**`packages/twopoint5d/src/texture/TexturePackerJson.ts:69`** — ein Eintrag der »JSON
Array«-Form ohne `filename` wird nicht abgelehnt: `target.add(undefined, coords, data)` fällt in
den unbenannten Zweig von `TextureAtlas#add()`; stand so schon in `72127b52` (Paket 11) → Scope

**`packages/twopoint5d/src/texture/TextureStore.ts:446`** (jetzt `:441`) —
`registerAtlasAdapter()` zeigt einen abgelehnten Namen mit `String(name)` statt über
`describeValue()` (`{}` erscheint als `[object Object]`, `''` als leere Stelle); gleiche Art wie
der Eintrag zu `sampleAtlasFrame.ts:105`; stand so schon in `6500527f` (Paket 13, Zug 0) → Scope

**Von Paket 17 übernommen** — `packages/twopoint5d/CHANGELOG.md:97–98` (jetzt `:119`) nennt
unveröffentlichte Factories im `describeValue`-Eintrag (kleiner Reviewer-Befund aus Paket 7):
Schritt 10 schreibt diese Zeile ohnehin neu und nennt keine Factories mehr.

## Urteil des Reviewers

Review 0 (`paket-14.review-0.json`, opus) und gezielter Review 1 (`paket-14.review-1.json`, sonnet):

- `spriteDeclarations.ts` (`shownDeclared`) — behoben, `src/sprites/spriteDeclarations.ts:102`
- `MirrorAtPlane.ts` (Null-Normale) — behoben, `src/sprites/passes/MirrorAtPlane.ts:21`; dazu `PlanarShadow.ts:35–39`
- `PanControl2D.ts` (`speed`) — behoben, `src/controls/PanControl2D.ts:247` ff., Konstruktor `:309`
- `RepeatingTilesProvider.ts` (`tileIds`-Werte) — behoben, `src/map2d/RepeatingTilesProvider.ts:13`, `:77–79`
- `Map2DTileStreamer.ts` (`tiles`) — behoben, `src/map2d/Map2DTileStreamer.ts:147–156`
- `sampleAtlasFrame.ts` (Meldungen) — behoben, `src/texture/sampleAtlasFrame.ts:89/92/97/101/104`
- `TexturePackerJson.ts` (`filename`) — behoben, `src/texture/TexturePackerJson.ts:81`
- `TextureStore.ts` (`registerAtlasAdapter`) — behoben, `src/texture/TextureStore.ts:442`
- Schritte 1–11 umgesetzt; CHANGELOG-Zeile `:120` neu ohne Factories (übernommener Reviewer-Befund aus Paket 7 erledigt)
- Runde 1: Proposal `docs/proposals/pipeline-stages-and-grid-base.md:270` zitiert `{value: 0, share: true}`;
  Shadow-Browsertest mit Punktlicht `[0, 10, 0, 1]` und Ebene `[0, 0, 0, -1]` erreicht die Shader-Wache,
  Hook-Pin in `pass-features.spec.ts`

**Kleine Befunde, offen gelassen:**

- `src/utils/describeValue.ts:31` — `record[key]` ruft Getter eines Plain Objects auf; ein werfender Getter
  verschluckt die eigentliche Meldung (als Folge im Plan)

**Abweichungen des Implementierers** (aus dem Report): zusätzliche Tests (`describeValue` String und
`String()`-Rest, leerer TexturePacker-Name, Tile-Id in Zeile/Spalte ≠ 0); mitgezogen
`features/placement.spec.ts:193–196`, `TileSprites/TileSpritesFactory.spec.ts` (Stub-Provider `rowProvider()`
statt ungültiger Ids), `fixtures/preset-graphs.json` (9 Positionsgraphen, oberster Knoten `ConditionalNode`);
kein `asVec3()` nötig; Pins ohne roten Lauf: wrap `{}` und `["clamp", "x"]` in `sampleAtlasFrame.spec.ts`,
`PanControl2D` `takes a negative speed`, die Browsertests.

**Begründung der Nebenbefund-Urteile:** `runCheckKind.ts:12`, `SpriteResources.ts:60` und die
`toString()`-Namen in `TextureAtlas.ts`/`selectAtlasFrames.ts`/`FrameBasedAnimations.ts` standen so in
`6500527f` (per `git show` geprüft); Schritt 11 verlangt Melden statt Beheben, die Scope-Regel greift
(jede Severity) → Scope.
