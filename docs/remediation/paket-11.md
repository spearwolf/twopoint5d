# Paket 11 — Sprite-Hilfen und Bitmap-Fonts

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: SEC-001 (low), BUG-023 (low), BUG-024 (low), BUG-018 (low), API-004 (low), MEM-009 (low)
- Ziel: Das Font-Parsing ist gegen Prototyp-Schlüssel und große Zeichenlisten robust, und die Sprite-Hilfen prüfen Argumente, normalisieren Achsen und halten keine Meshes fest.
- Modell: mittlere Stufe — sechs lokale Fixes in zwei Modulen, jeder mit Stelle, Wortlaut
  und Testfall unten; kein Umbau über Modulgrenzen, keine Nebenläufigkeit, kein Frame-Pfad
  auf der CPU. Der heikelste Teil (BUG-018) ist ein `normalize()` je Achse samt einem
  Browser-Test, dessen Zahlen unten stehen.
- Effort: medium — Regressionstests in drei Specs und ein Browser-Test mit rotem Lauf gegen
  das alte `dist`, dazu Doku in sieben Dateien und fünf CHANGELOG-Einträge, deren Wortlaut
  unten steht.
- Hängt ab von: —
- Dateien:
  - `packages/twopoint5d/src/text/readBitmapFontSource.ts`
  - `packages/twopoint5d/src/text/BitmapFont.ts` (nur die Seitenzählung, Z. 203–207)
  - `packages/twopoint5d/src/text/BitmapFont.spec.ts`
  - `packages/twopoint5d/src/sprites/cameraNodes.ts`
  - `packages/twopoint5d/src/sprites/features/segmentVertex.ts` (nur TSDoc des Parameters `camera`)
  - `packages/twopoint5d/src/sprites/FeatureSprites/fixtures/preset-graphs.json` (neu geschrieben, siehe Schritt 4)
  - `packages/twopoint5d/src/sprites/bindings/lightOf.ts`, `planeOf.ts`, `bindings.spec.ts`
  - `packages/twopoint5d/src/sprites/SpritePicker.ts` (nur TSDoc)
  - `packages/twopoint5d-testing/test/sprites-segments.test.js` (ein neuer Test)
  - `packages/twopoint5d/docs/sprites.md` (`lightOf()`/`planeOf()`, »Ownership« unter »Picking«)
  - `packages/twopoint5d/docs/resource-lifecycle.md` (§1, Absatz zu `SpritePicker`)
  - Proposals: `packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md` (§4.4,
    letzter Absatz), `sprite-uniform-bindings.md` (§2.1, §2.2), `fade-flash-axis-billboards.md`
    (§3.2), `wave-and-segment-sprites.md` (Tabelle der Fallbacks), `gpu-picking.md` (§3.1)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]` → `### Fixed`)
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): keep an attribute named __proto__ of a text or XML font as a field of its block, leave a named entity outside the five of XML as it is written, count the pages of a font of any number of chars, take the axes of the camera as unit vectors on a mesh scaled evenly, refuse a node or a plane that lightOf() and planeOf() cannot read, and say that a SpritePicker holds every mesh it has drawn until that mesh or the picker is disposed`
- Vorgehen:
  1. **SEC-001 — Attribute als eigene Felder definieren** (`readBitmapFontSource.ts`).
     Ein lokaler Helfer über `readValue()`:

     ```ts
     // defined, not assigned: an attribute "__proto__" would run into the __proto__ setter of
     // Object.prototype and set the prototype of the entry — JSON.parse() makes such a key a field,
     // and so do the readers of the other two spellings
     const setField = (entry: Entry, key: string, value: unknown): void => {
       Object.defineProperty(entry, key, {value, writable: true, enumerable: true, configurable: true});
     };
     ```

     `readText()` Z. 66 und `readXml()` Z. 96 schreiben über `setField(entry, key!, …)` statt
     `entry[key!] = …`; der Wert bleibt derselbe Ausdruck. Die Entries bleiben gewöhnliche
     Objekte (kein `Object.create(null)`): das Loch ist die Zuweisung, nicht der Prototyp, und
     `defineProperty` ist das Muster, das `src/utils/unpick.ts:9–11` schon hat. Grund für
     Definieren statt Überspringen: alle drei Schreibweisen geben dann dasselbe `info`, wie es
     `BitmapFontInfo` verspricht (»Kept as it is read«).
     Regressionstest in `BitmapFont.spec.ts`, `describe('the edges of the readers')`:
     `test('keeps an attribute named __proto__ as a field of its block in all three spellings, and sets no prototype', …)`
     — dieselbe Schrift dreimal mit `info … __proto__=1,2` (Text), `<info … __proto__="1,2"/>`
     (XML) und `{"info": {…, "__proto__": [1, 2]}, …}` als JSON-String; je Schreibweise
     `Object.getPrototypeOf(font.info)` ist `Object.prototype` und
     `Object.getOwnPropertyDescriptor(font.info, '__proto__')?.value` ist `[1, 2]`; dazu ein
     Char mit `__proto__=1,2` (Text), dessen Glyph `glyph('A')` die übrigen Felder unverändert
     trägt. Vor dem Fix rot für Text und XML (kein eigenes Feld, der Wert steckt im Prototyp
     des Entry, den der Spread nicht mitnimmt).
  2. **BUG-023 — benannte Entities nur aus der eigenen Tabelle** (`readBitmapFontSource.ts:73`
     und `:84`). `ENTITIES` wird eine `ReadonlyMap<string, string>`:
     `new Map([['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"]])`, die
     Auflösung `ENTITIES.get(name) ?? match`. Den Kommentar über `decodeEntities()` um einen
     Halbsatz ergänzen: ein Name außerhalb der fünf — `&constructor;` ebenso — bleibt stehen,
     wie er geschrieben ist. Regressionstest in `describe('the XML format')`:
     `test('leaves a named entity outside the five of XML as it is written, a name of Object.prototype as well', …)`
     mit `<info face="A&constructor;B&toString;C&__proto__;D&amp;E" …/>` → `font.face` ist
     `'A&constructor;B&toString;C&__proto__;D&E'`. Vor dem Fix rot (Quelltext von `Object`
     bzw. `[object Object]` im `face`).
  3. **BUG-024 — Seitenzahl in einer Schleife** (`BitmapFont.ts:203–207`). Statt des Spreads:

     ```ts
     // a loop, no spread into Math.max(): a pan-Unicode font holds more chars than a call takes arguments
     let pageCount = Math.max(pages.length, isFiniteNumber(common.pages) ? common.pages : 0);
     for (const char of data.chars) {
       if (isFiniteNumber(char?.page) && char.page + 1 > pageCount) pageCount = char.page + 1;
     }
     ```

     Die Prüfung bleibt an ihrer Stelle vor der Zeichenschleife Z. 217: die Reihenfolge der
     Abweisungen ändert sich nicht (Abweichung von der Empfehlung, die Zählung in die Schleife
     ab Z. 217 zu legen — dort käme ein ungültiger Char vor der Seitenmeldung, und
     `refusals` prüft die Reihenfolge nicht mit). Regressionstest in
     `describe('refusals')`: `test('a font of several hundred thousand chars, the last on page 1, is refused for its pages', …)`
     — `chars` aus 500 000 Einträgen `{page: 0}` und einem letzten `{page: 1}`, sonst
     `tinyFont()`; erwartet `toThrow('BitmapFont: the font "tiny" has 2 pages')`. Vor dem Fix
     rot mit `RangeError: Maximum call stack size exceeded` (lokal unter Node 24.21 ab etwa
     125 000 Argumenten). Kein Test, der eine Schrift dieser Größe vollständig baut.
  4. **BUG-018 — Kameraachsen als Einheitsvektoren** (`cameraNodes.ts`). Ursache an der Wurzel:
     `cameraAxisLocal()` gibt `normalize(vec3(…))` zurück (`normalize` aus `three/tsl`). Das
     erfasst alle Leser, die die Länge heute mittragen: `segmentVertex()` (`dir` im Fallback
     Z. 51, `level` Z. 57), `axisBillboardVertex()` (`level` aus `cameraRight`, Z. 30, gewichtet
     gegen `across`) und `lightFacingVertex()` (`cameraUp − cameraBack`, `facing.ts:51`,
     gewichtet gegen die Normale) — die beiden letzten verzerren auf einem skalierten Mesh die
     Überblendung innerhalb des Sinus 0,1. `BillboardPlacement` und `mirroredBillboardVertex()`
     normalisieren ohnehin; ihr Ergebnis bleibt gleich. Kein Fallback in `segmentVertex()`
     über `unitOf()` stattdessen: das ließe die beiden anderen Leser stehen.
     - Kommentar über `cameraAxisLocal()` in diesem Wortlaut:

       ```ts
       // row `row` of the model-view rotation, normalized: an axis of the camera, expressed in the
       // local space of the mesh. A mesh scaled evenly by s scales the rows by s; the direction is
       // exact as long as the mesh is scaled evenly on all axes
       ```

     - TSDoc der drei Exporte: »… in the local space of the mesh, a unit vector. @internal«.
     - `segmentVertex.ts` Z. 40: TSDoc von `camera` nennt `right` und `up` als Einheitsvektoren.
     - **Mitzuziehen:** `src/sprites/FeatureSprites/presetGraphs.spec.ts` pinnt die Graphen der
       Presets samt `ShadowPass` (`LightFacingPlacement`) und `BillboardReflectionPass`
       (`MirroredBillboardPlacement`) in `fixtures/preset-graphs.json`. Neu schreiben mit
       `UPDATE_SPRITE_GRAPHS=1 pnpm nx test twopoint5d -- src/sprites/FeatureSprites/presetGraphs.spec.ts`,
       dann `git diff` der Fixture lesen: erwartet sind nur zusätzliche `normalize`-Knoten um
       die Kameraachsen in den Positionsgraphen von `ShadowPass` und `BillboardReflectionPass`;
       jede andere Änderung ist ein Befund für den Report.
     - Regressionstest (Browser, vor dem Fix rot gegen das alte `dist`) in
       `packages/twopoint5d-testing/test/sprites-segments.test.js`, `describe('facing the camera')`:
       `it('draws a segment of no length on a mesh scaled by 2 as its caps quad scaled by 2, the right of the camera along it', …)`
       — `makeSegments(FACING, [RED, GREEN], [{start: [0, 0, 0], end: [0, 0, 0], size: [3, 2]}])`,
       `sprites.scale.setScalar(2)` vor `render(sprites, 'front')`, erwartet
       `expectModel(…, segmentModel([0, 0], [0, 0], 6, 4, RED, GREEN))`. Vor dem Fix ist der
       Caps-Quad 12 breit (die Achse der Länge 2 skaliert `local.x` ein zweites Mal), danach 6.
       Ablauf: Test schreiben, `pnpm build:twopoint5d`, im Paket `packages/twopoint5d-testing`
       `pnpm exec web-test-runner test/sprites-segments.test.js` → rot (in den Report), dann
       Fix, neu bauen, derselbe Lauf grün.
  5. **API-004 — Argumente von `lightOf()` und `planeOf()` beim Aufruf prüfen.** Subjekt ist der
     nackte Funktionsname (`lightOf: …`, `planeOf: …`) nach der Regel für Funktionen in
     `AGENTS.md` — Abweichung von der Empfehlung (`lightOf(): …`), die dieser Regel widerspricht.
     Geprüft wird per Flag wie in three üblich, lokal in jeder Datei:
     `const isObject3D = (value: unknown): value is Object3D => (value as {isObject3D?: unknown} | null | undefined)?.isObject3D === true;`
     und `isPlane` auf `unknown` umgestellt (`(value as {isPlane?: unknown} | null | undefined)?.isPlane === true`).
     Werte über `describeValue()` (`src/utils/describeValue.js`), Zahlen über `assertFinite()`
     (`src/utils/assertFinite.js`).
     - `lightOf(node)`, erste Zeile: kein `isObject3D` → `throw new TypeError(`lightOf: the node must be an Object3D — a light or a node that marks one —, got ${describeValue(node)}`)`.
     - `planeOf(target, options)`, vor allem anderen: weder `isPlane` noch `isObject3D` →
       `TypeError` `planeOf: the target must be an Object3D or a Plane, got ${describeValue(target)}`.
       Nur auf dem Arm des Nodes (der Plane-Arm hat keine Optionen, ein zweites Argument dort
       bleibt unbeachtet): `options !== undefined && !isObject(options)` (`src/utils/isObject.js`)
       → `TypeError` `planeOf: the options must be an object, {plane?}, got ${describeValue(options)}`;
       `options.plane !== undefined && !isPlane(options.plane)` → `TypeError`
       `planeOf: options.plane must be a Plane, got ${describeValue(options.plane)}`.
     - Danach, für eine übergebene Ebene (Plane-Arm oder `options.plane`, nicht für die
       Vorgabe-Ebene): `assertFinite()` auf `normal.x`, `normal.y`, `normal.z`, `constant` mit
       Subjekt `planeOf` und dem Namen `plane.normal.x` … `plane.constant` (Plane-Arm) bzw.
       `options.plane.normal.x` … `options.plane.constant` (Node-Arm) — `RangeError`
       `planeOf: options.plane.normal.x must be a finite number, got NaN`. Eine Normale
       `(0, 0, 0)` bleibt zulässig: die Passes zeichnen für sie nichts (CHANGELOG
       `[Unreleased]` → `### Fixed`, Eintrag zu `MirrorAtPlane`/`PlanarShadow`).
     - TSDoc beider Funktionen um `@throws` ergänzen: `lightOf` — `{TypeError}` für einen Node,
       der kein `Object3D` ist; `planeOf` — `{TypeError}` für ein Ziel, das weder `Object3D`
       noch `Plane` ist, Optionen ohne Objekt und ein `options.plane` ohne `Plane`;
       `{RangeError}` für eine Ebene, deren Normale oder Konstante keine endliche Zahl ist.
     - Die `write()`-Funktionen bleiben unberührt (Allokations-Spec `src/sprites/hot-path-allocations.spec.ts`).
     - Tests in `bindings.spec.ts`, je `describe` ein `test.each`:
       `lightOf()` › `refuses a node that is no Object3D with a TypeError that names lightOf and quotes it`
       (`undefined`, `null`, `{}`, `{isDirectionalLight: true}`, `new Vector3()`; Meldung
       vollständig für die Primitive und `{}`, für `new Vector3()` mit
       `toThrow(/^lightOf: the node must be an Object3D/)`), `planeOf()` › `refuses a target that is neither an Object3D nor a Plane`
       (`undefined`, `null`, `{}`, `5`), `› refuses options that are no object and an options.plane that is no Plane`
       (`planeOf(new Object3D(), 5 as never)`, `… {plane: {} as never}`,
       `… {plane: new Vector3() as never}`), `› refuses a plane whose normal or constant is no finite number, in either form`
       (`new Plane(new Vector3(NaN, 0, 1), 0)`, `new Plane(new Vector3(0, 0, 1), Infinity)` je
       als Ziel und als `options.plane`, Meldung mit dem Feldnamen), `› takes a plane whose normal is (0, 0, 0)`
       (kein Wurf). Vor dem Fix rot: `lightOf({})`, `planeOf({})`, die Optionen und die Ebenen
       werfen nicht, `lightOf(undefined)` wirft eine Meldung ohne Subjekt.
  6. **MEM-009 — der Picker hält, was er gezeichnet hat** (Doku-Weg der Empfehlung, kein
     Umbau). Nicht umgesetzt wird der optionale Teil, Einträge nach N Picks zu verwerfen, und
     keine `WeakMap`: der Schlüssel der Map ist nicht der einzige starke Pfad — die
     `dispose`-Listener-Closure am `geometry` (`SpritePicker.ts:350`) hält `sprites`, und die
     Render-Objekte des Renderers halten das Pick-Mesh samt Geometrie bis zu dessen
     `dispose()`; ein schwacher Schlüssel allein gäbe nichts frei, eine Pick-Zahl als Grenze
     wäre eine willkürliche Konstante mit Neuaufbau des Pick-Materials. Der Vertrag
     (`resource-lifecycle.md`: der Besitzer entsorgt sein Mesh) bleibt und wird ausgesprochen:
     - Klassen-TSDoc, nach »… the next pick of the mesh builds them anew.«:
       `Until then the picker holds the mesh, and with it its geometry, its pool and its textures, whether a later pick lists it or not: a mesh taken out of the scene and never disposed lives as long as the picker. Dispose a mesh that is done with, or the picker.`
     - TSDoc von `pick()`, an den Absatz über die ausgelassenen Meshes angehängt:
       `A mesh drawn once is held until it or the picker is disposed, also when no later pick lists it.`
     - `docs/sprites.md`, Bullet »Ownership« unter »Picking«, nach »… releases them when the
       mesh is disposed, and builds them anew after a growth or a geometry put into the slot.«:
       `Until then the picker holds the mesh, listed again or not: a mesh taken out of the scene and never disposed lives as long as the picker — dispose it, or the picker.`
     - `docs/resource-lifecycle.md` §1, Absatz zu `SpritePicker`, vor »Its `dispose()` releases …«:
       `Up to one of those events it holds each mesh it has drawn, whether a later pick lists it or not: a mesh its owner drops without dispose() lives as long as the picker.`
       (`dispose()` in Backticks)
     - `docs/proposals/gpu-picking.md` §3.1, erster Satz »One per listed mesh, built at its first
       pick and kept until the mesh or the picker is disposed:« → »… kept until the mesh or the
       picker is disposed — and the mesh with it, whether a later pick lists it or not:«
     - Kein CHANGELOG-Eintrag: das Verhalten ändert sich nicht.
  7. **Doku der übrigen Findings:**
     - `docs/sprites.md`, neuer Absatz nach »An `AmbientLight` or a `HemisphereLight` is taken
       as any node; its position means nothing, and neither does the shadow it throws.«:
       `Both check what they are handed when they are called: lightOf() refuses a node that is no Object3D, planeOf() a target that is neither an Object3D nor a Plane, options that are no object and an options.plane that is no Plane, each with a TypeError, and a plane whose normal or constant is no finite number with a RangeError.`
       (Code-Namen in Backticks)
     - `docs/proposals/sprite-uniform-bindings.md` §2.1, neuer letzter Bullet:
       `**Checks** at the call: a target that is neither an Object3D (isObject3D) nor a Plane (isPlane), options that are no object and an options.plane that is no Plane are refused with a TypeError (planeOf: the target must be an Object3D or a Plane, got …); a normal or a constant that is no finite number with a RangeError through assertFinite() (planeOf: plane.normal.x must be a finite number, got NaN). A normal of (0, 0, 0) passes; the passes draw nothing for it.`
       §2.2, neuer letzter Bullet:
       `**Checks** at the call: a node that is no Object3D is refused with a TypeError (lightOf: the node must be an Object3D — a light or a node that marks one —, got …).`
       (Code-Namen und Meldungen in Backticks)
     - `docs/proposals/fade-flash-axis-billboards.md` §3.2: im Codeblock Z. 180 `(row x of the
       model-view rotation, levelled)` → `(row x of the model-view rotation, normalized, then
       levelled)`; Bullet Z. 203 ergänzt: `` `cameraRightLocal()` joins `cameraUpLocal()` and
       `cameraBackLocal()` in `cameraNodes.ts` (internal); all three normalize their row of the
       model-view rotation, which a mesh scaled evenly by s scales by s. ``
     - `docs/proposals/wave-and-segment-sprites.md`, Tabelle der Fallbacks, Zeile `'camera'`,
       letzte Spalte: `` `dir` = the right of the camera, a unit vector ``.
     - `docs/proposals/dynamic-atlas-and-bitmap-text.md` §4.4, letzter Absatz (heute
       »A numeric entity in the XML that is no Unicode scalar value … refused by its name.«)
       ersetzt durch:
       `A numeric entity in the XML that is no Unicode scalar value — beyond U+10FFFF, a surrogate — stays as it is written, as does every named entity outside the five, &constructor; among them: entities stand only in text attributes (face, charset, file), and a number field holding one is refused by its name. The text and the XML reader define every attribute as a field of its block, as JSON.parse() makes a key a field, so an attribute named __proto__ is a field like any other and sets no prototype.`
       (Code-Namen in Backticks). Nicht in §4.1: dort verschöbe ein neuer Absatz den
       Queue-Eintrag zu §4.4 Z. 421–422.
     - `docs/text.md` bleibt: Z. 61–62 (»… like an entity the reader does not know«) stimmt nach
       BUG-023 weiter.
  8. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` → `### Fixed`, am Ende
     der Liste, Skill `updating-changelog`), fünf Einträge in diesem Wortlaut — je einer für
     SEC-001, BUG-023, BUG-024, BUG-018 und API-004:
     - ``- `BitmapFont.parse()` keeps an attribute named `__proto__` of the text and the XML format as a field of its block, as `JSON.parse()` keeps such a key of the JSON format: no attribute sets the prototype of a block``
     - ``- `BitmapFont.parse()` leaves a named entity of the XML that is none of the five of XML — `&constructor;`, `&toString;`, `&__proto__;` — as it is written, as it leaves every entity it does not know``
     - ``- `new BitmapFont()` and `BitmapFont.parse()` read a font of any number of chars, a pan-Unicode font of several hundred thousand among them, and refuse one of several pages with the message of its pages``
     - ``- on a mesh scaled evenly, `segmentPlacement({facing: 'camera'})` draws the caps quad of a segment of no length at the scale of the mesh, and it, `axisBillboardPlacement()` and the placement of `ShadowPass` weigh the camera within their turnover at a sine of 0.1 as on a mesh of scale 1: the right, the up and the back of the camera they read are unit vectors in the local space of the mesh``
     - ``- `lightOf()` refuses a node that is no `Object3D`, and `planeOf()` a target that is neither an `Object3D` nor a `Plane`, options that are no object and an `options.plane` that is no `Plane`, each with a `TypeError` that names the function and quotes the value; `planeOf()` refuses a plane whose normal or constant is no finite number with a `RangeError` that names the field. Both refuse at the call, before the source reaches `bindUniform()` ``
     Kein Eintrag sagt, wie es vorher war.
  9. Nicht anfassen: `docs/text.md` (Queue-Eintrag zu Z. 174–183), §4.4 Z. 421–422 des
     Bitmap-Text-Proposals (Queue-Eintrag), `FeatureSprites.ts`, `TableFrame.ts`,
     `passFeatures.ts` (Queue-Einträge aus Paket 10) — andere Ursache, die Drain-Runde des
     Abschlusses nimmt sie.
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · SEC-001 unverändert (`readBitmapFontSource.ts:64–66`, `:93–96`) · BUG-023 unverändert (`readBitmapFontSource.ts:73`, `:84`) · BUG-024 verschoben (`BitmapFont.ts:203–207`, Audit Z. 199; Paket 6 hat die Zahlenprüfungen davor umgestellt, Sachverhalt gleich) · BUG-018 unverändert, Pfad `src/sprites/features/segmentVertex.ts:51` (Audit ohne `features/`), `cameraNodes.ts:12–15`; dieselbe Ursache an `axisBillboardVertex.ts:30` und `passes/facing.ts:51`, vom Fix an der Wurzel erfasst · API-004 unverändert (`lightOf.ts:4/17`, `planeOf.ts:4/34–35`) · MEM-009 unverändert (`SpritePicker.ts:143`, `:344–351`) · `src/sprites/` (Dateien dieses Pakets) und `src/text/readBitmapFontSource.ts` seit 7341059f unverändert · Folgen aus erledigten Paketen: keine offen · Queue: kein Eintrag mit gleicher Ursache · Restplan geprüft: unverändert
  - 2026-10-24 Zug 1: Implementierer beauftragt (Runde 0), Modell sonnet (mittlere Stufe), Effort medium, Brief `paket-11.impl-0.brief.txt`, Report nach `paket-11.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG (Text aus dem Session-Transkript nach `paket-11.impl-0.report.md`, die JSON-Datei trägt nur den Nachsatz) · 19 Dateien geändert, keine neu · Arbeitsbaum schmutzig · rote Läufe belegt (Specs Text, Bindings; Browser gegen `dist` ohne `normalize`) · Verify läuft nach `paket-11.verify.log`
  - 2026-10-24 Zug 2 Verify: `pnpm run ci` exit=0, Log `paket-11.verify.log`
  - 2026-10-24 Zug 3: Reviewer beauftragt (Runde 0), Modell opus, Effort medium, Diff `paket-11.diff`, Report nach `paket-11.review-0.json`
  - 2026-10-24 Zug 3: Urteil des Reviewers »freigegeben«, alle sechs Findings behoben, keine kritischen oder wichtigen Befunde, vier kleine · Diff `paket-11.diff` (975 Zeilen, 19 Dateien)
  - 2026-10-24 Zug 4: keine Runde nötig
  - 2026-10-24 Zug 5: Commit 0ae02d67 auf Verify `paket-11.verify.log` (exit=0, keine Änderung seither), Trailer `Remediation-Run: 2026-10-23`

## Urteil des Reviewers (Runde 0)

- SEC-001 behoben — `readBitmapFontSource.ts:25–30` (`setField()`), genutzt `:73` (`readText()`) und `:110` (`readXml()`); Test `BitmapFont.spec.ts:234–264`
- BUG-023 behoben — `ENTITIES` als `ReadonlyMap` `readBitmapFontSource.ts:80–86`, Auflösung `:98`; Test `BitmapFont.spec.ts:204–209`
- BUG-024 behoben — Schleife `BitmapFont.ts:203–207`, Reihenfolge der Abweisungen gleich; Test `BitmapFont.spec.ts:325–331`
- BUG-018 behoben — `cameraNodes.ts:15–18` (`normalize(vec3(…))`), TSDoc `segmentVertex.ts:40`; Fixture Knoten für Knoten geprüft (nur `normalize` samt `VarNode`); Browser-Test `sprites-segments.test.js:279–284`
- API-004 behoben — `lightOf.ts:23–26`, `planeOf.ts:52–71` (`assertFinitePlane()`), `@throws` ergänzt; Tests `bindings.spec.ts:107–145`, `:181–197`
- MEM-009 behoben (Doku-Weg) — `SpritePicker.ts:137–139`, `:186–187`, `docs/sprites.md:1834–1836`, `docs/resource-lifecycle.md:110–112`, `docs/proposals/gpu-picking.md:106`; kein CHANGELOG-Eintrag

Kleine Befunde (lösen keine Runde aus):
1. `readBitmapFontSource.ts:89–91` — der ergänzte Kommentar über `decodeEntities()` sagt zweimal »stays as it is written«.
2. `planeOf.ts:20–25` — ein Objekt mit `isPlane: true` ohne `normal` scheitert in `assertFinitePlane()` mit einem rohen `Cannot read properties of undefined` statt einer Meldung mit Subjekt `planeOf` (konstruierter Randfall, wirft weiter beim Aufruf).
3. `bindings.spec.ts:263–268` — die Regex-Fälle von `lightOf()` (`{isDirectionalLight: true}`, `new Vector3()`) stehen in einem zweiten `test.each` mit eigenem Titel statt im einen aus dem Plan; Abdeckung gleich.
4. `lightOf.ts:5` / `planeOf.ts:9` — `isObject3D` wortgleich in beiden Dateien, wie der Plan es vorsah.

Abweichungen laut Implementierer: lokaler Helfer `assertFinitePlane()` in `planeOf.ts`; Kommentar über `decodeEntities()` umformuliert; `biome check --write` auf den eigenen Specs. Die Zeilenverschiebung in `docs/resource-lifecycle.md` beträgt zwei Zeilen (Z. 162–163 → 164–165), im Queue-Eintrag nachgezogen.

## Findings im Volltext

**SEC-001 · low · packages/twopoint5d/src/text/readBitmapFontSource.ts:66** (auch `:96`) — Schlüssel `__proto__` beim Lesen von Text- und XML-Fonts nicht zuweisen
readText und readXml schreiben Attributnamen aus der Datei per `entry[key] = …` in ein normales Objekt. Heißt ein Attribut `__proto__` und ist der Wert eine Zahlenliste (`__proto__=1,2` wird zu einem Array), setzt die Zuweisung den Prototyp des Entry auf dieses Array. Der Rest des Projekts schützt sich an dieser Stelle ausdrücklich (unpick() verwendet defineProperty mit demselben Argument). Die Wirkung hier ist klein, weil BitmapFont nur eigene Felder liest, aber das Muster ist ungeschützt.
Beleg: `entry[key!] = quoted !== undefined ? readValue(...) : readValue(...)`
Empfehlung: Entry mit Object.create(null) anlegen oder per Object.defineProperty schreiben, wie unpick() es tut; `__proto__` als Schlüssel überspringen.

**BUG-023 · low · packages/twopoint5d/src/text/readBitmapFontSource.ts:84** — Benannte XML-Entities nur aus eigenen Schlüsseln der Tabelle auflösen
ENTITIES ist ein Objektliteral mit Object.prototype. Der Entity-Regex `\w+` trifft auch Namen wie `constructor`, `toString` oder `hasOwnProperty`; `ENTITIES[name] ?? match` liefert dann die geerbte Funktion, und String.replace schreibt deren Quelltext (`function Object() { [native code] }`) in den Attributwert, etwa in `face`. Ein unbekanntes Entity soll laut Kommentar unverändert stehen bleiben.
Beleg: `return ENTITIES[name] ?? match;` mit `<info face="A&constructor;B" …>`
Empfehlung: ENTITIES als Map führen oder mit Object.hasOwn(ENTITIES, name) prüfen (Prototype null reicht ebenfalls).

**BUG-024 · low · packages/twopoint5d/src/text/BitmapFont.ts:199** (heute Z. 203–207) — Seitenzahl in BitmapFont ohne Spread-Argumente aus der Zeichenliste bilden
`Math.max(..., ...data.chars.map(...))` übergibt jedes Zeichen als eigenes Funktionsargument. Bei einigen Hunderttausend Chars überschreitet das das Argumentlimit von V8 und wirft ein RangeError 'Maximum call stack size exceeded', ohne Hinweis auf die Schrift. Die Prüfung läuft zudem noch vor allen Validierungen, die eine verständliche Meldung liefern würden. Praktisch nur bei sehr großen Pan-Unicode-Fonts relevant.
Beleg: `...data.chars.map((char) => (isFiniteNumber(char?.page) ? char.page + 1 : 0)),`
Empfehlung: Das Maximum in einer Schleife über data.chars bilden (die Schleife ab Zeile 213 liest ohnehin jedes Zeichen).

**BUG-018 · low · packages/twopoint5d/src/sprites/cameraNodes.ts:14** (auch `src/sprites/features/segmentVertex.ts:51`) — Kameraachsen in `cameraNodes` normalisieren, bevor `segmentVertex` sie als Richtung nutzt
`cameraAxisLocal` liest die Zeilen der Rotation von `modelViewMatrix`. Bei einem gleichmäßig skalierten Mesh (laut Doku erlaubt) haben diese Zeilen die Länge des Skalierungsfaktors s, nicht 1; der Kommentar spricht trotzdem von »exakt«. `BillboardPlacement` und `axisBillboardVertex` normalisieren danach, `segmentVertex` nicht: bei `facing: 'camera'` und einem Segment der Länge 0 ist `camera.right` die Fallback-Richtung `dir`. Die Caps-Quad wird dann um s zusätzlich skaliert (insgesamt s² in Weltmaßen), und der Sinus in `weight` (`length(facingAcross)`) ist um s verzerrt.
Beleg: `dir = orFallback(camera!.right, unitOf(segment), size)` mit `camera.right = cameraRightLocal()` ungeteilt
Empfehlung: `cameraRightLocal/UpLocal/BackLocal` mit `normalize()` zurückgeben (oder `dir` im Fallback durch `unitOf` schicken) und mit einem Test für ein Mesh mit scale 2 absichern.

**API-004 · low · packages/twopoint5d/src/sprites/bindings/lightOf.ts:17** (auch `planeOf.ts:34`) — Argument von `lightOf()` und `planeOf()` beim Aufruf prüfen
Beide Factories greifen ungeprüft auf ihr Argument zu. `lightOf(undefined)` wirft ein generisches `Cannot read properties of undefined (reading 'isDirectionalLight')`, `lightOf({})` oder `planeOf({})` gehen durch und scheitern erst im ersten `FeatureSprites#update()` mit `node.updateWorldMatrix is not a function` — weit von der Fehlerstelle und ohne Subjekt. Das Projekt verlangt für Verweigerungen Meldungen der Form `Subject: …`; bei `options.plane` fehlt ebenso jede Prüfung auf eine endliche Ebene.
Beleg: `const isDirectionalLight = (node: Object3D): node is DirectionalLight => (node as DirectionalLight).isDirectionalLight === true;`
Empfehlung: Am Anfang beider Funktionen prüfen, dass `isObject3D` (bzw. `isPlane`) gilt, und mit `lightOf(): …` / `planeOf(): …` und `describeValue()` einen TypeError werfen; Tests in `bindings.spec.ts` ergänzen.

**MEM-009 · low · packages/twopoint5d/src/sprites/SpritePicker.ts:143** (improvement) — Pick-Einträge des `SpritePicker` ohne starke Referenz auf das Mesh halten
`#entries` ist eine `Map<FeatureSprites, PickEntry>`; Schlüssel und der `onDispose`-Listener halten das Mesh stark, bis dessen `dispose`-Event kommt oder `dispose()` des Pickers. Ein Mesh, das der Aufrufer aus der Szene nimmt und nie entsorgt, bleibt samt Geometrie, Pool, Pick-Mesh und Pick-Material so lange am Leben wie der Picker. Das entspricht dem Vertrag in resource-lifecycle.md (der Besitzer entsorgt sein Mesh), macht ein vergessenes `dispose()` aber teurer, weil der Picker die Leckage verlängert.
Beleg: `readonly #entries = new Map<FeatureSprites, PickEntry>();`
Empfehlung: Im TSDoc von `pick()` ausdrücklich sagen, dass der Picker Meshes bis zu deren `dispose()` hält; optional Einträge von Meshes, die für den Picker nicht mehr in der Liste stehen, nach N Picks verwerfen.

## Für Zug 5

- Keine Oberfläche bewegt sich in den Typen; neu sind nur Abweisungen. Die
  `Schnittstellen:`-Zeile im Plan nennt: `lightOf()` wirft `TypeError` für einen Node ohne
  `isObject3D`; `planeOf()` wirft `TypeError` für ein Ziel ohne `isObject3D`/`isPlane`, Optionen
  ohne Objekt und `options.plane` ohne `Plane`, `RangeError` (`assertFinite`, Subjekt `planeOf`)
  für eine Normale oder Konstante, die keine endliche Zahl ist · `cameraRightLocal()`,
  `cameraUpLocal()`, `cameraBackLocal()` (intern) liefern Einheitsvektoren ·
  `preset-graphs.json` neu geschrieben.
- Der Absatz in `docs/resource-lifecycle.md` §1 verschiebt den Queue-Eintrag
  »`docs/resource-lifecycle.md:162–163` (§3, Regel 3)« (Paket 10, `FeatureSprites.ts:541/577`)
  um die eingefügten Zeilen; die Zeilenangabe dort beim Fortschreiben nachziehen.
