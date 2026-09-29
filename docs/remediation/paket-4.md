# Paket 4 — Drain: Nebenbefunde aus Texturen, Display und Vertex Objects

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — die acht Nebenbefunde N1–N8 aus »Offene Befunde« (5 × low, 3 × info), unten im Volltext
- Ziel: Die in den Paketen 1–3 aufgefallenen Nebenbefunde der Scope-Features sind behoben, sodass Texturen, Display und Vertex Objects ohne offenen Befund dastehen.
- Modell: mittlere Stufe (sonnet)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/TileSet.ts`, `TileSet.spec.ts` (N1, N2)
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, `FrameBasedAnimations.spec.ts` (N3)
  - `packages/twopoint5d/src/display/Chronometer.ts`, `Chronometer.spec.ts` (N4)
  - `packages/twopoint5d/src/display/FixedFrameLoop.ts`, `FixedFrameLoop.spec.ts` (N5)
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.spec.ts` (N6)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`, `VertexObjectDescriptor.spec.ts` (N7, N8)
  - `packages/twopoint5d/CHANGELOG.md` (N1, N3, N4, N5)
- Hängt ab von: — (Pakete 1–3 committet; ihre Folgen-Zeilen sind leer)

## Vorgehen

Reihenfolge je Punkt: bei einem Korrektheitsfehler (N1, N3-Fehlermeldung, N4,
N5, N7) zuerst den Test, rot laufen sehen, dann beheben. Einzelne Spec-Datei
laufen lassen mit `pnpm nx test twopoint5d -- src/<pfad>.spec.ts` aus dem
Repo-Root. Die Konventionen im Kopf von `./remediation-plan.md` gelten für jede
Zeile — keine Finding-Nummer und kein »N1« im Code, in Tests, Kommentaren,
CHANGELOG oder Commit; kein Satz über den Vorzustand in Code, Kommentaren oder
CHANGELOG.

### N1 — `TileSet#tileCount` und `#firstFrameId` werden read-only

1. `TileSet.ts:84` und `:89`: die öffentlichen Felder `tileCount = 0;` und
   `firstFrameId = -1;` werden private Felder `#tileCount = 0;` und
   `#firstFrameId = -1;` mit je einem öffentlichen Getter
   `get tileCount(): number` und `get firstFrameId(): number`, keine Setter.
   Die Getter stehen an der Stelle der Felder (vor dem Konstruktor).
2. TSDoc der Getter:
   - `tileCount`: wie viele Tiles das Layout hält — die Option `tileCount`,
     oder so viele, wie in die `baseCoords` passen, wenn keine genannt ist;
     der Konstruktor legt die Tiles einmal an, und die Zahl ändert sich danach
     nicht.
   - `firstFrameId`: der vorhandene Satz »The `frameId` of the _first_ tile«
     bleibt, ergänzt um: vom Konstruktor gesetzt, die Frames der Tiles folgen
     ohne Lücke bis `lastFrameId`.
3. `#createTextureCoords` (`TileSet.ts:240–241` und `:263`) schreibt die
   privaten Felder: `this.#firstFrameId === -1` / `this.#firstFrameId =
   frameId` / `this.#tileCount = tileCount`.
4. Test in `TileSet.spec.ts`, neuer Block `describe('tileCount and firstFrameId
   are read-only', …)`: an einem Tile-Set (z. B. `new TileSet(new
   TextureCoords(0, 0, 64, 64), {tileWidth: 16, tileHeight: 16})`) wirft ein
   Schreibzugriff auf `tileCount` und einer auf `firstFrameId` je einen
   `TypeError` (ES-Module laufen im Strict Mode); danach antworten
   `tileCount`, `firstFrameId`, `lastId`, `lastFrameId` und `frameId(1)` wie
   vorher. Die Zuweisung steht im `expect(() => { … })` mit einem
   `// @ts-expect-error` darüber, der sagt, warum (read-only) — vor dem Fix ist
   der Lauf rot, weil nichts wirft, und `pnpm typecheck` rot, weil die
   Direktive unbenutzt ist.
5. CHANGELOG `## [Unreleased]` → `### Changed`: neuer Eintrag direkt nach dem
   zu `TileSet#options` (`CHANGELOG.md:281`): `TileSet#tileCount` und
   `TileSet#firstFrameId` sind Getter; der Konstruktor legt die Tiles einmal
   an, ein Schreibzugriff kompiliert nicht und wirft in Strict-Mode-Code einen
   `TypeError`. Mit »See the Migration Guide«.
6. Migration Guide (`### Migration Guide` im `[Unreleased]`-Abschnitt): neuer
   Unterabschnitt `#### `TileSet#tileCount` and `#firstFrameId` are read-only`
   direkt nach `#### The options of a `TileSet` are a frozen copy`
   (`CHANGELOG.md:3232`), im selben Aufbau: ein Absatz, dann **Before** /
   **After** mit je einem `ts`-Block. Before: `tileSet.tileCount = 8;`,
   After: `const tileSet = new TileSet(coords, {tileCount: 8});`. Blöcke ohne
   `check`, wie der Nachbarabschnitt.

### N2 — `[[…]]`-Links in der Klassen-TSDoc von `TileSet`

`TileSet.ts:66–68`: die veraltete TypeDoc-Syntax fällt weg. Die beiden
Selbstverweise `[[TileSet]]` (Z. 66 und 68) werden zu `` `TileSet` `` (ein Link
auf die Seite, auf der man steht, hilft niemandem), `[[TextureAtlas]]` (Z. 67)
wird zu `{@link TextureAtlas}`. Sonst bleibt der Text, wie er ist. Andere
`[[…]]`-Links gibt es in `packages/twopoint5d/src` nicht (geprüft per grep).

### N3 — der leere Name in `FrameBasedAnimations#add()`

Entscheidung: der leere String bleibt »kein Name« und wird dokumentiert, nicht
abgewiesen und nicht als Name registriert. Grund: der Code prüft absichtlich
auf Falsy (`FrameBasedAnimations.ts:270` und `:380`), der Befund bemängelt das
Schweigen der TSDoc, und eine Abweisung würde ändern, welche Einträge einer
Animations-Map aus einem Katalog `TextureResource` registriert (`''` ist ein
gültiger JSON-Schlüssel). Dieselbe Regel gilt dann auch für die
Fehlermeldungen:

1. `animNameInError` (`FrameBasedAnimations.ts:64`) behandelt `''` wie
   `undefined`: `(name) => (name ? name.toString() : '(no name)')` — ein
   Symbol ist truthy, `toString()` liefert `Symbol(desc)` wie bisher. Damit
   nennt jede Fehlermeldung von `add()` für `add('', …)` die Animation
   `` `(no name)` `` statt ``` `` ```.
2. TSDoc von `add()`, Absatz ab `FrameBasedAnimations.ts:245` (»An animation
   added without a name is given one …«): ergänzen, dass eine Animation mit
   dem leeren String als Namen als namenlos gilt und einen Namen des Zählers
   bekommt; `hasAnimation('')` antwortet `false`, `animId('')` wirft wie für
   jeden nie registrierten Namen.
3. Inline-Kommentar an `if (!name)` (`:380`) um den Halbsatz ergänzen, dass
   der leere String als kein Name zählt; an `if (name && …)` (`:270`) genügt
   derselbe Hinweis in einem Halbsatz, warum die Eindeutigkeitsprüfung ihn
   überspringt.
4. Tests in `FrameBasedAnimations.spec.ts`, im Block `describe('add with
   TextureCoords array', …)` neben `an animation added without a name gets one
   it can be found under` (Z. 31):
   - `an animation added with the empty string as its name gets a name of the
     counter`: `add('', 1, frames)` → `hasAnimation('anim_0')` ist `true`,
     `animId('anim_0')` ist die zurückgegebene id, `hasAnimation('')` ist
     `false` (hält eine Zusage fest, vorher schon grün).
   - `a refusal of an animation with the empty string as its name calls it
     (no name)`: `add('', 1, [])` wirft mit einer Meldung, die
     `` `(no name)` `` enthält (vor dem Fix rot).
5. CHANGELOG `[Unreleased]` → `### Changed`, Eintrag `CHANGELOG.md:222`
   (»`FrameBasedAnimations#add()` gives an animation added without a name one
   of its own …«) im ersten Satz ergänzen: ohne Namen oder mit dem leeren
   String als Namen. Der Abschnitt ist unveröffentlicht, der Eintrag darf
   geändert werden; kein neuer Eintrag.

### N4 — `Chronometer` nimmt `±Infinity` an

1. `Chronometer.ts:1`: `getCurrentTime = (time?: number) => (typeof time ===
   'number' && Number.isFinite(time) ? time : performance.now() / 1000)`. Das
   `typeof` bleibt, weil `Number.isFinite` in TypeScript nicht einengt.
2. Klassen-TSDoc (`Chronometer.ts:3–11`): ein Absatz dazu — ein `time`, das
   keine endliche Zahl ist (`NaN`, `Infinity`, `-Infinity`), gilt als nicht
   angegeben, und der Chronometer liest an seiner Stelle
   `performance.now() / 1000`. Das gilt für Konstruktor, `update()`,
   `start()`, `stop()` und `reset()`.
3. Tests in `Chronometer.spec.ts`, neuer Block `describe('a time that is not
   finite', …)` mit `vi.spyOn(performance, 'now').mockReturnValue(5000)` in
   `beforeEach` und `vi.restoreAllMocks()` in `afterEach`; je
   `it.each([Infinity, -Infinity, NaN])`:
   - Konstruktor: `new Chronometer(value)` → `timeStart` ist `5`.
   - `update()`: `const c = new Chronometer(1); c.update(value);` → `time` ist
     `4`, `deltaTime` ist `4`; ein folgendes `c.update(6)` ergibt `time` `5`.
   - `stop()`/`start()`: `const c = new Chronometer(1); c.stop(value);
     c.start(7);` → `time` ist `4` (die Pause von 5 bis 7 zählt als verloren)
     und endlich.
   - `reset()`: `c.reset(value)` → `timeStart` ist `5`, `time` ist `0`.
   Für `Infinity` und `-Infinity` sind diese Tests vor dem Fix rot, für `NaN`
   grün — das ist gewollt, `NaN` war schon abgedeckt.
   Die erwarteten Zahlen gegen die Implementierung nachrechnen; stimmt eine
   nicht, gilt die Implementierung von `update()`/`start()`/`stop()` und der
   Test wird angepasst, nicht der Code.
4. CHANGELOG `[Unreleased]` → `### Fixed`: `fix `Chronometer` with a `time`
   of `Infinity` or `-Infinity`` — gilt wie `NaN` als nicht angegeben, der
   Chronometer liest `performance.now() / 1000`, `time` bleibt endlich. In der
   Gruppe der übrigen `Chronometer`-Fixes (`CHANGELOG.md:335`) einsortieren.

### N5 — `FixedFrameLoop#maxStepsPerFrame` nimmt nur ganze Zahlen

Entscheidung: ein nicht-ganzzahliger Wert wird ignoriert wie jeder andere, mit
dem die Loop nicht laufen kann — nicht abgerundet. Grund: der Setter hat eine
Regel für alles, was er nicht nimmt (Wert bleibt), und die Statics
`DefaultMaxStepsPerFrame` laufen durch denselben Setter.

1. `FixedFrameLoop.ts:147`: `if (!Number.isInteger(value) || value < 1)
   return;` (`Number.isInteger` ist für `NaN` und `±Infinity` `false`). Den
   Kommentar darüber um den Grund ergänzen: ein Bruch lässt die Prüfung
   `steps < maxStepsPerFrame` einen Tick mehr laufen als die Obergrenze sagt.
2. JSDoc des Getters (`:136–138`) und des Statics `DefaultMaxStepsPerFrame`
   (`:108–111`): »not finite or smaller than 1« wird zu »not a whole number of
   1 or more«.
3. Tests in `FixedFrameLoop.spec.ts`: in `it.each([0, -1, 0.5, NaN,
   Infinity])('maxStepsPerFrame refuses %s', …)` (Z. 211) und in
   `it.each([0, -1, 0.5, NaN, Infinity])('ignores a DefaultMaxStepsPerFrame of
   %s and takes 5', …)` (Z. 273) je `2.5` ergänzen (vor dem Fix rot). Dazu ein
   Test, der die Obergrenze im Frame zeigt: `sim.maxStepsPerFrame = 2;
   sim.maxStepsPerFrame = 2.5;` → `maxStepsPerFrame` ist `2`, und ein
   Render-Frame mit einem Delta von zehn `fixedDelta` löst genau zwei Ticks
   aus. Aufbau der Frames wie in den Nachbartests der Datei.
4. CHANGELOG `[Unreleased]` → `### Changed`, Eintrag `CHANGELOG.md:218`: »a
   `maxStepsPerFrame` that is not finite or smaller than `1` keeps its value«
   wird zu »a `maxStepsPerFrame` that is not a whole number of `1` or more
   keeps its value«. Kein neuer Eintrag.

### N6 — Positionsverweis in `TextureAtlasLoader.spec.ts:164`

Entscheidung: statt den Verweis umzuformulieren, bekommt die gemeinsame
Maßnahme einen Namen, und die Erklärung steht einmal an ihm.

1. Neben `imageLoaderAnswering` (Z. 23–31) ein Helfer
   `imageLoaderAnsweringLater(texture: Texture)`: `vi.fn` mit derselben
   Signatur, ruft `onLoad({texture, imgEl: {} as TextureSource, texCoords: new
   TextureCoords(0, 0, 16, 16)})` in `queueMicrotask(…)` auf. Der Kommentar
   darüber trägt den ersten Teil der Erklärung aus Z. 134–136: der echte
   `TextureImageLoader` ruft aus dem `load`-Event eines `Image` zurück, einer
   Task außerhalb des synchronen Aufrufstapels, und `queueMicrotask` stellt
   diese Grenze nach.
2. Test `a parse that throws rejects instead of leaving the promise open`
   (Z. 133): nimmt `imageLoaderAnsweringLater({dispose() {}} as unknown as
   Texture)`; sein Kommentar schrumpft auf den testeigenen Teil aus
   Z. 136–139 — ohne die Grenze liefe ein Throw aus dem gemockten `parse()`
   synchron in den Executor von `new Promise(…)` unter `loadAsync()`, den die
   Engine selbst in eine Rejection verwandelt, und verdeckte den Fehler, um
   den es geht.
3. Test `a parse that throws releases the texture the image loader handed
   out` (Z. 163): nimmt `imageLoaderAnsweringLater(texture)`; der Kommentar
   Z. 164–165 entfällt ersatzlos.
4. Kein Verhalten ändert sich; beide Tests bleiben grün, vorher und nachher.

### N7 — `VertexObjectDescriptor#voPrototype` wird nur einmal geschrieben

1. Setter `VertexObjectDescriptor.ts:97–99`: wirft, wenn schon ein Prototyp
   gesetzt ist, und lässt den ersten stehen:
   `if (this.#voPrototype !== undefined) throw new Error('VertexObjectDescriptor:
   voPrototype is written once, by the first VertexObjectBuffer built on this
   descriptor, and this descriptor has one already');` — Wortlaut der Meldung
   darf abweichen, Präfix `VertexObjectDescriptor: ` bleibt.
2. JSDoc des Setters (`:92–96`): »Written once, by the first
   `VertexObjectBuffer` built on this descriptor; a second write throws and
   leaves the first prototype in place.« `@internal` bleibt.
3. Der einzige Schreiber `VertexObjectBuffer.ts:301–302` prüft vorher
   `if (!this.descriptor.voPrototype)` und bleibt unverändert.
4. Test in `VertexObjectDescriptor.spec.ts`: einen `VertexObjectBuffer` auf
   einem Descriptor bauen (setzt den Prototyp, vgl. `VertexObjectBuffer.spec.ts:258`
   `first vertex-object-buffer initializes the descriptor.voPrototype`), dann
   `descriptor.voPrototype = {}` → wirft mit `/written once/`, und
   `descriptor.voPrototype` ist derselbe Prototyp wie vorher; ein zweiter
   `VertexObjectBuffer` auf demselben Descriptor wirft nicht und lässt den
   Prototyp ebenfalls stehen. Vor dem Fix rot.
5. CHANGELOG: kein Eintrag. Der Setter ist `@internal` und fehlt wegen
   `stripInternal` (`tsconfig.json:44`) in den ausgelieferten Typen; der
   Migration Guide (`CHANGELOG.md:2652`) sagt schon »assigns it once«.

### N8 — verdrehte JSDoc von `checkBasePrototype()`

`VertexObjectDescriptor.ts:251–252`: »appears on the `basePrototype`, neither
as an own property nor inherited from a prototype below `Object.prototype`«
wird zu »appears on the `basePrototype`, as an own property or inherited from
a prototype below `Object.prototype`«. Regel 9 in der Konstruktor-TSDoc
(`:119–120`, »no property name … appears …, neither as an own property nor
inherited«) ist mit dem vorangestellten »no« richtig und bleibt.

## Verify

`pnpm run ci` aus dem Repo-Root (Gate laut Konventionen und `AGENTS.md`;
Baseline grün).

## Commit

```
fix!: make TileSet#tileCount and #firstFrameId read-only, let a Chronometer read the clock for a time that is not finite, let FixedFrameLoop#maxStepsPerFrame take only a whole number, let the internal setter of VertexObjectDescriptor#voPrototype refuse a second write, and let the docs of TileSet, FrameBasedAnimations#add() and VertexObjectDescriptor#checkBasePrototype() say what the code does

BREAKING CHANGE: TileSet#tileCount and TileSet#firstFrameId are getters; a write does not compile and throws a TypeError in strict-mode code.
```

## Verlauf

- 2026-09-29 Zug 0: Detailplan steht · Abgleich gegen `fc40b690`: N1 unverändert (`TileSet.ts:84`, `:89`; nur lesende Aufrufer in `src/`, `twopoint5d-testing`, `apps/lookbook`) · N2 unverändert (`TileSet.ts:66–68`, einzige `[[…]]`-Stelle in `src`) · N3 unverändert (`FrameBasedAnimations.ts:270`, `:380`, dazu `animNameInError` `:64` gleicher Ursache) · N4 unverändert (`Chronometer.ts:1`) · N5 unverändert (`FixedFrameLoop.ts:147`, `:233`) · N6 unverändert (`TextureAtlasLoader.spec.ts:164`) · N7 unverändert (`VertexObjectDescriptor.ts:92–99`, einziger Schreiber `VertexObjectBuffer.ts:302`) · N8 unverändert (`VertexObjectDescriptor.ts:251–252`) · Folgen aus Paket 1–3: keine · Offene Befunde: alle acht in diesem Paket, keiner liegen gelassen
- 2026-09-29 Zug 1: Implementierer beauftragt, sonnet, Effort medium, Report nach `paket-4.impl-0.json`
- 2026-09-29 Zug 2: Report FERTIG, rote Läufe für N1, N3, N4, N5, N7 belegt · 12 Dateien geändert (11 unter `src/texture`, `src/display`, `src/vertex-objects`, dazu `CHANGELOG.md`) · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-4.verify.log`)
- 2026-09-29 Zug 3: Reviewer sonnet/medium, Urteil: N1–N8 behoben, kein kritischer, kein wichtiger Befund, drei kleine · Diff `paket-4.diff`, Report `paket-4.review-0.json`
- 2026-09-29 Zug 4: keine Runde nötig, kleine Befunde unten
- 2026-09-29 Zug 5: Commit `98f2f561` mit Trailer `Remediation-Run: 2026-09-29`, Verify aus Zug 2 (keine Änderung seither), Plan auf `[x]`

## Urteil des Reviewers

- N1 behoben — `TileSet.ts` private Felder `#tileCount`/`#firstFrameId` mit Gettern; Test `TileSet.spec.ts:270–288`; CHANGELOG `### Changed` nach `TileSet#options`, Migration Guide `CHANGELOG.md:3250`
- N2 behoben — `TileSet.ts:66–68`: `` `TileSet` `` und `{@link TextureAtlas}`
- N3 behoben — `animNameInError` `FrameBasedAnimations.ts:63–64`, TSDoc `:248–250`, Kommentare `:273` und `:384`, Tests `FrameBasedAnimations.spec.ts:43–56`, CHANGELOG-Eintrag ergänzt
- N4 behoben — `Chronometer.ts:1` mit `Number.isFinite`, Klassen-TSDoc, Block `a time that is not finite` in `Chronometer.spec.ts`, `### Fixed`-Eintrag
- N5 behoben — Setter `FixedFrameLoop.ts:147` mit `Number.isInteger`, JSDoc von Getter und Static, Tests mit `2.5` und Frame-Test `FixedFrameLoop.spec.ts:260–268`, CHANGELOG-Satz
- N6 behoben — Helfer `imageLoaderAnsweringLater` `TextureAtlasLoader.spec.ts:24–35`, beide Tests nutzen ihn, kein Positionsverweis mehr
- N7 behoben — Setter `VertexObjectDescriptor.ts:98–105` wirft mit Präfix `VertexObjectDescriptor:`, Test `VertexObjectDescriptor.spec.ts:221–232`
- N8 behoben — JSDoc von `checkBasePrototype()` `VertexObjectDescriptor.ts:262` sagt »as an own property or inherited«

Kleine Befunde (lösen keine Runde aus, offen):
- `FrameBasedAnimations.ts:251` — TSDoc-Zeile an `add()` mit rund 115 Zeichen, nicht neu umbrochen
- `FrameBasedAnimations.ts:383–385` — der Halbsatz zum leeren String hängt als dritte Zeile am Kommentar über `if (!name)` statt im Satz
- Commit-Message nennt nicht, dass Fehlermeldungen von `add()` für `''` jetzt `(no name)` sagen — Geschmackssache

## Findings im Volltext

**N1 · low · `packages/twopoint5d/src/texture/TileSet.ts:84` und `:89`** — `tileCount` und `firstFrameId` sind öffentliche, schreibbare Felder; ein Schreibzugriff von außen verschiebt `frameId()`, `lastId` und `randomFrame()` ohne neues Layout. Aufgefallen in Paket 1.

**N2 · info · `packages/twopoint5d/src/texture/TileSet.ts:66–68`** — die Klassen-TSDoc verlinkt mit der veralteten TypeDoc-Syntax `[[TileSet]]` / `[[TextureAtlas]]` statt `{@link}`. Aufgefallen in Paket 1.

**N3 · low · `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:270` und `:380`** — der leere String `''` als Name gilt als »kein Name«: `add('', …)` registriert still `anim_N`, die TSDoc sagt es nicht. Aufgefallen in Paket 1.

**N4 · low · `packages/twopoint5d/src/display/Chronometer.ts:1`** — `getCurrentTime()` weist nur `NaN` ab und nimmt `±Infinity` an; ein `update(Infinity)` macht `time` und die interne aktuelle Zeit dauerhaft `Infinity`. Aufgefallen in Paket 2.

**N5 · low · `packages/twopoint5d/src/display/FixedFrameLoop.ts:144–148` und `:233`** — der Setter `maxStepsPerFrame` nimmt einen nicht-ganzzahligen Wert wie `2.5` an, und `steps < 2.5` lässt dann drei Ticks pro Frame laufen statt der dokumentierten Obergrenze. Aufgefallen in Paket 2.

**N6 · info · `packages/twopoint5d/src/texture/TextureAtlasLoader.spec.ts:164`** — der Kommentar »the same microtask boundary as the test above« verweist per Position auf den Nachbartest; eine Umordnung der Spec macht ihn falsch, ohne dass es auffällt. Aufgefallen in Paket 3.

**N7 · low · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:92–99`** — die JSDoc des internen Setters `voPrototype` sagt »Written once«, nichts erzwingt das; ein zweiter Schreibzugriff überschreibt still. Aufgefallen in Paket 3.

**N8 · info · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:250–251`** — die JSDoc von `checkBasePrototype()` sagt »neither as an own property nor inherited«, gemeint ist »as an own property or inherited«; der Satz sagt das Gegenteil dessen, was geprüft wird. Aufgefallen in Paket 3.
