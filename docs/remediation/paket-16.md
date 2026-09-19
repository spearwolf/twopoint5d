# Paket 16 — display und controls: erstes panView-Update und FixedFrameLoop-Defaults

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (zwei Nebenbefunde aus der Befund-Queue, Drain-Runde 1; kein Audit-Finding)
- Ziel: PanControl2D liefert sein erstes `update`-Event auch nach erneuter Zuweisung desselben State, und `FixedFrameLoop` weist ungültige Default-Statics genauso ab wie ungültige Optionen.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/display/FixedFrameLoop.ts` (zwei Modulkonstanten, TSDoc der Statics, von `maxStepsPerFrame` und `fps`, Konstruktor)
  - `packages/twopoint5d/src/display/FixedFrameLoop.spec.ts` (neuer `describe`-Block)
  - `packages/twopoint5d/src/controls/PanControl2D.ts` (Setter `panView`, TSDoc von `panView` und `update()`)
  - `packages/twopoint5d-testing/test/pan-control-input.test.js` (drei neue Fälle)
  - `packages/twopoint5d/CHANGELOG.md` (zwei bestehende Einträge in `[Unreleased]` erweitern, kein neuer Eintrag)
- Vorgehen:
  1. **Regressionstests FixedFrameLoop zuerst, rot sehen.** In `packages/twopoint5d/src/display/FixedFrameLoop.spec.ts` `afterEach` in den `vitest`-Import aufnehmen und innerhalb von `describe('FixedFrameLoop', …)` direkt **vor** `describe('dispose()', …)` einen Block `describe('default statics the loop cannot run with', …)` anlegen:
     - Am Anfang des Blocks die ausgelieferten Werte festhalten und nach jedem Test zurückschreiben — die Statics sind global, ein liegen gebliebener Wert verdirbt jeden folgenden Test der Datei:
       ```ts
       const shippedFps = FixedFrameLoop.DefaultFps;
       const shippedMaxStepsPerFrame = FixedFrameLoop.DefaultMaxStepsPerFrame;

       afterEach(() => {
         FixedFrameLoop.DefaultFps = shippedFps;
         FixedFrameLoop.DefaultMaxStepsPerFrame = shippedMaxStepsPerFrame;
       });
       ```
     - `it.each([0, -60, NaN, Infinity])('ignores a DefaultFps of %s and runs at 60', (fps) => …)`: `FixedFrameLoop.DefaultFps = fps;` dann `const loop = new FixedFrameLoop(makeFakeDisplay());`, eigene Tick-Liste per `loop.onTick(…)`; `expect(loop.fps).toBe(60)`, `expect(loop.fixedDelta).toBeCloseTo(1 / 60)`; `emit(loop.display, OnDisplayRenderFrame, makeFrame(1 / 60))` → genau ein Tick.
     - `it.each([0, -60, NaN, Infinity])('falls back past a DefaultFps of %s to 60 for an fps option it refuses', (fps) => …)`: `FixedFrameLoop.DefaultFps = fps;` dann `new FixedFrameLoop(makeFakeDisplay(), {fps: 0})` → `fps` ist `60`, `fixedDelta` ≈ `1 / 60`.
     - `it.each([0, -1, 0.5, NaN, Infinity])('ignores a DefaultMaxStepsPerFrame of %s and takes 5', (value) => …)`: `FixedFrameLoop.DefaultMaxStepsPerFrame = value;` dann `const loop = new FixedFrameLoop(makeFakeDisplay());` mit eigener Tick-Liste; `expect(loop.maxStepsPerFrame).toBe(5)`; `emit(loop.display, OnDisplayRenderFrame, makeFrame(1.0))` → genau 5 Ticks (der Spiral-of-Death-Guard greift bei 5).
     - `it('falls back past a DefaultMaxStepsPerFrame of 0 to 5 for a maxStepsPerFrame option it refuses', …)`: `DefaultMaxStepsPerFrame = 0`, `new FixedFrameLoop(makeFakeDisplay(), {maxStepsPerFrame: 0})` → `maxStepsPerFrame` ist `5`.
     - Wächter `it('starts from a DefaultFps and DefaultMaxStepsPerFrame it can run with', …)`: `DefaultFps = 30`, `DefaultMaxStepsPerFrame = 2`; `new FixedFrameLoop(makeFakeDisplay())` → `fps` 30, `fixedDelta` ≈ `1 / 30`, `maxStepsPerFrame` 2; `new FixedFrameLoop(makeFakeDisplay(), {fps: 120, maxStepsPerFrame: 0})` → `fps` 120, `maxStepsPerFrame` 2 (die Option gewinnt, eine abgewiesene Option lässt den Default stehen).
     - Lauf: `pnpm --dir packages/twopoint5d exec vitest --run src/display/FixedFrameLoop.spec.ts` (ohne `--coverage`: die Schwellen gelten der ganzen Suite). Erwartet vor dem Fix: 14 rot (4 + 4 + 5 + 1), der Wächter und alle bestehenden Fälle grün. Ausgabe des roten Laufs in den Report.
  2. **Regressionstests PanControl2D zuerst, rot sehen.** In `packages/twopoint5d-testing/test/pan-control-input.test.js` im bestehenden `describe('PanControl2D — what it measures and what it reports', …)` direkt hinter `it('reports an update when only the speed fields moved the view', …)` drei Fälle; jeder baut `control = new PanControl2D({state, disablePointer: true, disableKeyboard: true})` mit `const state = makeState();` und zählt per `on(control, 'update', (props) => …)` die Events samt letztem Payload (das `afterEach` der Datei räumt `control` ab):
     - `it('reports the first update() after a state that is assigned again before it', …)`: `control.panView = state;` dann `control.update(1 / 60)` → genau **1** Event mit `{x: 0, y: 0}`; ein zweites `control.update(1 / 60)` → weiter 1 (nichts bewegt, kein Event).
     - `it('reports the first update() after a new state that is assigned twice before it', …)`: `control.update(1 / 60)` → 1 Event; dann `const next = {x: 5, y: 7, pixelRatio: 1}; control.panView = next; control.panView = next;` und `control.update(1 / 60)` → **2** Events, das letzte mit `{x: 5, y: 7}`.
     - Wächter `it('reports nothing for the state it holds assigned again after its first update()', …)`: `control.update(1 / 60)` → 1 Event; `control.panView = state;` und `control.update(1 / 60)` → weiter 1.
     - Browsertests laufen gegen `dist`: zuerst `pnpm build:twopoint5d`, dann `pnpm --dir packages/twopoint5d-testing exec web-test-runner test/pan-control-input.test.js`. Erwartet vor dem Fix: die beiden ersten Fälle rot in Chromium und Firefox (0 statt 1 bzw. 1 statt 2 Events), der Wächter grün. Ausgabe des roten Laufs in den Report.
  3. **`FixedFrameLoop.ts` — Konstanten und Statics.** Über der Klasse (bei `OnTick`/`OnRender`) zwei Modulkonstanten, nicht exportiert:
     ```ts
     // what a loop starts with when neither its options nor the writable statics give a value it
     // can run with
     const BUILT_IN_FPS = 60;
     const BUILT_IN_MAX_STEPS_PER_FRAME = 5;
     ```
     Die Statics bleiben einfache, beschreibbare Felder (keine Accessoren), bekommen die Konstanten als Wert und je eine TSDoc:
     ```ts
     /**
      * The rate a loop starts at when its options name none, or one it refuses. Read each time a
      * loop is built; a value that is not finite or not greater than 0 is ignored there, and the
      * loop starts at 60.
      */
     static DefaultFps = BUILT_IN_FPS;

     /**
      * The `maxStepsPerFrame` a loop starts with when its options name none, or one it refuses.
      * Read each time a loop is built; a value that is not finite or smaller than 1 is ignored
      * there, and the loop starts with 5.
      */
     static DefaultMaxStepsPerFrame = BUILT_IN_MAX_STEPS_PER_FRAME;
     ```
  4. **`FixedFrameLoop.ts` — Konstruktor** (`:168-174`). Den Kommentar und die drei Direktzuweisungen ersetzen; die beiden `options`-Zeilen bleiben:
     ```ts
     // the built-in values first, then the writable defaults and the options through the setters,
     // which refuse a rate the loop cannot run at — a default gets the same check as an option
     this.#fps = BUILT_IN_FPS;
     this.#fixedDelta = 1 / BUILT_IN_FPS;
     this.#maxStepsPerFrame = BUILT_IN_MAX_STEPS_PER_FRAME;
     this.fps = FixedFrameLoop.DefaultFps;
     this.maxStepsPerFrame = FixedFrameLoop.DefaultMaxStepsPerFrame;
     if (options?.fps != null) this.fps = options.fps;
     if (options?.maxStepsPerFrame != null) this.maxStepsPerFrame = options.maxStepsPerFrame;
     ```
     Die Setter (`:116-121`, `:133-137`) bleiben unverändert.
  5. **`FixedFrameLoop.ts` — TSDoc der Accessoren.**
     - `maxStepsPerFrame` (`:109-110`): `A value that is not finite or smaller than 1 is ignored, in the constructor as well as here.` → `A value that is not finite or smaller than 1 is ignored, in the constructor as well as here; the constructor then keeps \`DefaultMaxStepsPerFrame\`, or 5 when that is such a value too.`
     - `fps` (`:126-127`): `… in the constructor as well, where the loop then keeps \`DefaultFps\`.` → `… in the constructor as well, where the loop then keeps \`DefaultFps\`, or 60 when that is such a value too.`
  6. **`PanControl2D.ts` — Setter `panView`** (`:291-295`). Die letzte Zeile `this.#isFirstPanViewUpdate = prevPanView !== this.#panView;` ersetzen durch:
     ```ts
     // a new state makes the next update() announce it; the state already held changes nothing —
     // assigned again before that update(), it still has to be announced, and only update()
     // takes the announcement back
     if (prevPanView !== this.#panView) {
       this.#isFirstPanViewUpdate = true;
     }
     ```
     Der Feld-Initialisierer `#isFirstPanViewUpdate = true` (`:285`) und `update()` (`:386-392`) bleiben unverändert.
  7. **`PanControl2D.ts` — TSDoc.**
     - Über `get panView()` (`:287`, bisher ohne TSDoc):
       ```ts
       /**
        * The view state this control moves: {@link update} shifts its `x` and `y` by the speed
        * fields, the keys and the pointer, and writes them into this very object. Assigning
        * `undefined` puts a fresh state at `0, 0` in its place.
        *
        * The first `update()` after a state is assigned — in the constructor through
        * `options.state`, or here — emits `update` even when nothing moved, so a listener learns
        * where the view starts. Assigning the state this control already holds changes nothing:
        * before that first `update()` the announcement stays due, after it none is added.
        */
       ```
     - `update()` (`:359-361`): vor `@param t …` einen Absatz:
       ```ts
       /**
        * Move {@link panView} by what the speed fields, the keys and the pointer collected since
        * the last call, and emit `update` with the new `x` and `y` when that moved the view — and
        * on the first call after a state was assigned to {@link panView}, whether it moved or not.
        *
        * @param t delta time since last `update()` call in seconds
        */
       ```
  8. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`, Skill `updating-changelog`):
     - `### Changed`, Zeile 140 (`- \`FixedFrameLoop\` ignores an \`fps\` or \`maxStepsPerFrame\` the loop cannot run with, …, a \`maxStepsPerFrame\` that is not finite or smaller than \`1\` keeps its value. \`maxStepsPerFrame\` is an accessor pair on the prototype`): zwischen `keeps its value.` und `` `maxStepsPerFrame` is an accessor pair`` den Satz einfügen: `The constructor holds the writable statics \`DefaultFps\` and \`DefaultMaxStepsPerFrame\` to the same rule: a default the loop cannot run with is ignored, and the loop starts at 60 fps and 5 steps per frame.`
     - `### Fixed`, Zeile 200 (`- fix the \`update\` event of \`PanControl2D\`: it goes out whenever \`update()\` moved the \`panView\`, including a control with both input sources switched off whose \`speed…\` fields were set by hand`) am Ende erweitern um: `, and on the first \`update()\` after a new state was assigned to \`panView\`, even when that same state is assigned once more before it`.
     - Kein neuer Eintrag, kein Migration-Guide-Abschnitt.
  9. Schritte 1 und 2 erneut laufen lassen (für Schritt 2 vorher erneut `pnpm build:twopoint5d`), alle grün; dann das Verify-Kommando.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): announce a pan state on the first update even when it is assigned twice and let the fixed loop ignore default statics it cannot run with`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · `PanControl2D.ts:286` → jetzt `:291-295` (Setter), unverändert seit `041c420`, vorbestehend seit `e352b56` (`:214-218`), in Node gegen `dist` mit `document`-Stub nachgestellt · `FixedFrameLoop.ts:84-85` unverändert, Konstruktor `:168-174`, vorbestehend seit `e352b56` (`:149-151`), in Node gegen `dist` nachgestellt — schwerer als notiert (Abschnitt »Abgleich«) · keine offenen Folgen im Plan, kein Queue-Eintrag mit derselben Ursache · Restplan unverändert
  - 2026-09-19 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort low · Report nach `paket-16.impl-1.json`
  - 2026-09-19 Zug 2: Report FERTIG · 5 Dateien geändert (`FixedFrameLoop.ts`, `FixedFrameLoop.spec.ts`, `PanControl2D.ts`, `pan-control-input.test.js`, `CHANGELOG.md`) · rot vorher: Vitest 14 failed, Browser 2 failed · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer (sonnet, low): beide Nebenbefunde behoben, 0 kritisch/wichtig/klein · Diff `paket-16.diff`
  - 2026-09-19 Zug 4: keine Runde nötig
  - 2026-09-19 Zug 5: `pnpm run ci` Exit 0 (`paket-16.verify.log`) · Commit `ed1b11e4` · 2 Nebenbefunde (DOC) in die Queue, `→ Audit`

## Reviewer-Urteil

- `PanControl2D.ts:286` (Setter `panView`): behoben — Flag nur bei neuem State gesetzt (`PanControl2D.ts:305-309`), gelöscht allein von `update()` (`:409-410`); TSDoc `:289-296`, `:397-400`.
- `FixedFrameLoop.ts:84-85` (Default-Statics): behoben — Konstruktor startet bei `BUILT_IN_FPS`/`BUILT_IN_MAX_STEPS_PER_FRAME` und schickt die Statics durch die Setter (`FixedFrameLoop.ts:186-194`).
- Qualität: 0 kritisch, 0 wichtig, 0 klein.
- Nebenbefunde (Implementierer): TSDoc von `FixedFrameLoop#dispose()` (`:253-254`) und `PanControl2D#dispose()` (`:604`, Satz ohne Verb) — beide DOC, außerhalb der Scope-Regel, daher `→ Audit`; der Umbruch in `PanControl2D#dispose()` stand schon aus Paket 10 in der Queue.

## Abgleich

HEAD `59d47e54`, `dist` gebaut zum selben Stand. Beide Dateien zuletzt angefasst von `041c420` (nur `PanControl2D.ts`, Cursor-Regeln) bzw. `68c3bff`.

**`PanControl2D#panView`** — nachgestellt in Node gegen `dist/lib/controls/PanControl2D.js` mit einem `document`-Stub, Control mit `state = {x: 0, y: 0, pixelRatio: 1}`, danach zwei `update(1 / 60)`:

| Vor dem ersten `update()` | `update`-Events nach 1. / 2. `update()` |
| --- | --- |
| nichts zugewiesen | 1 / 1 |
| `panView = state` (derselbe State) | **0 / 0** |
| `panView = {x: 5, y: 5}` | 1 / 1 |
| `panView = next; panView = next` (neuer State, zweimal) | **0 / 0** |
| `panView = undefined` (frischer Default) | 1 / 1 |
| nach dem 1. `update()`: `panView = state`, dann `update()` | 1 (kein weiteres) |
| nach dem 1. `update()`: `panView = {x: 1, y: 1}`, dann `update()` | 2 |

Der Queue-Eintrag nannte nur die erneute Zuweisung des Konstruktor-States; derselbe Defekt trifft jeden neuen State, der vor seinem ersten `update()` ein zweites Mal zugewiesen wird. Beides ist dieselbe Zeile (`:294`) und im Paket.

**`FixedFrameLoop`-Statics** — nachgestellt in Node gegen `dist/lib/display/FixedFrameLoop.js`, je ein Loop ohne Optionen, drei Frames à 0,05 s:

| Static | `fps` / `fixedDelta` / `maxStepsPerFrame` | Ticks | `tickTime` | letztes `alpha` |
| --- | --- | --- | --- | --- |
| ausgeliefert (60 / 5) | 60 / 1/60 / 5 | 9 | 0,15 | ≈ 0 |
| `DefaultFps = 0` | 0 / `Infinity` / 5 | 0 | 0 | 0 |
| `DefaultFps = -60` | −60 / −1/60 / 5 | 15 | **−0,25** | −0 |
| `DefaultFps = NaN` | `NaN` / `NaN` / 5 | 0 | 0 | `NaN` |
| `DefaultFps = Infinity` | `Infinity` / 0 / 5 | 15 | 0 | `NaN` |
| `DefaultFps = 0` + `{fps: 0}` | 0 / `Infinity` / 5 | 0 | 0 | 0 |
| `DefaultMaxStepsPerFrame = 0` / `-1` | 60 / 1/60 / 0 bzw. −1 | 0 | 0 | 0 |
| `DefaultMaxStepsPerFrame = NaN` | 60 / 1/60 / `NaN` | 0 | 0 | **9** |
| `DefaultMaxStepsPerFrame = 0.5` | 60 / 1/60 / 0,5 | 3 | 0,05 | 0 |
| `DefaultMaxStepsPerFrame = Infinity` | 60 / 1/60 / `Infinity` | 9 | 0,15 | ≈ 0 (kein Guard mehr) |

Schwerer als notiert: nicht nur `fixedDelta = Infinity` — ein negativer Default lässt die Zeit rückwärts laufen, `NaN` und `Infinity` machen `alpha` zu `NaN` bzw. treiben es über `[0, 1)` hinaus, und eine Option, die der Setter abweist, fällt auf den kaputten Default zurück statt auf einen lauffähigen Wert. Beide Statics zugleich auf `Infinity` (`fixedDelta` 0, kein Guard) ergäben eine Endlosschleife im `while` von `[OnDisplayRenderFrame]` — nicht ausgeführt, folgt aus `:186`.

Kein Repo-Code schreibt die Statics oder weist `panView` nach dem Bau erneut zu (`grep` über `apps/` und `packages/` ohne `dist`); die Werte erreichen die Klassen nur über Aufrufer der Bibliothek.

**Audit.** Kein Finding führt eine der beiden Stellen. BUG-086 (Paket 5, `68c3bff`) nannte die `fps`-Option und das Feld `maxStepsPerFrame`, seine Empfehlung initialisiert ausdrücklich aus `DefaultFps` — es bleibt zu Recht geschlossen; dieses Paket schließt den Eingang daneben. TEST-004 (medium, außerhalb der BUG-Serie) beklagt die Testlücken von `PanControl2D` allgemein; die neuen Fälle schließen es nicht und es wird nicht gebucht.

## Entscheidungen in Zug 0

- **Statics werden beim Bau geprüft, nicht beim Schreiben.** Der Konstruktor schickt `DefaultFps` und `DefaultMaxStepsPerFrame` durch dieselben Setter wie die Optionen, über festen Ausgangswerten 60 und 5. Damit gilt genau »wie ungültige Optionen«: eine Option wird auch nicht beim Schreiben abgewiesen, sondern beim Bau ignoriert (CHANGELOG Zeile 140, Paket 5). Die Statics bleiben einfache Felder — keine neue Accessor-Oberfläche in der `d.ts`, keine Regel »Unterklassen dürfen es nicht als Feld deklarieren«, und die Prüfung sitzt an der einzigen Stelle, an der der Wert wirkt, gleich wie er dorthin kam. Die Kehrseite — `FixedFrameLoop.DefaultFps = 0` liest sich danach als `0` zurück — steht in der TSDoc der Statics.
- **Rückfallwerte als Modulkonstanten.** `BUILT_IN_FPS` und `BUILT_IN_MAX_STEPS_PER_FRAME` tragen die ausgelieferten 60 und 5 an genau einer Stelle; die Statics werden damit initialisiert. Schreibweise wie `DEFAULT_KEYS` in `PanControl2D.ts`.
- **Ein neuer State kündigt sich an, derselbe State ändert nichts.** Der Setter setzt das Flag nur noch, er löscht es nie; gelöscht wird es allein von `update()`. Die Alternative — jede Zuweisung, auch desselben Objekts, kündigt erneut an — würde nach dem ersten `update()` ein Event hinzufügen, das heute nicht kommt. Das wäre neues Verhalten statt eines behobenen Defekts; ein Aufrufer, der den State von außen verschiebt, bekommt heute ebenfalls kein Event, und das zu ändern ist nicht Ziel dieses Pakets. Der Wächter im Browsertest hält diese Grenze fest.
- **Der Vertrag kommt in die TSDoc.** Das erste `update`-Event steht bisher nur im Code (`:386`) und in einem Testkommentar; `panView` hat keine TSDoc, `update()` nur `@param`. Ohne Text wäre der Fix eine Behauptung ohne Versprechen — `panView` bekommt den ganzen Vertrag, `update()` einen Satz, wann das Event geht.
- **Browsertest statt Vitest für `PanControl2D`.** Der Konstruktor greift auf `document.head` und `document.body` zu (`readOption` wertet den Default eager aus), die Vitest-Umgebung ist Node ohne jsdom, und alle `PanControl2D`-Tests liegen in `packages/twopoint5d-testing`. `pan-control-input.test.js` trägt schon den Fall zum `update`-Event der Speed-Felder, die neuen gehören daneben. `FixedFrameLoop` braucht kein `document` und bekommt Vitest wie seine übrigen Fälle.
- **CHANGELOG: bestehende Sätze erweitern, kein neuer Eintrag.** Die Regel für `fps`/`maxStepsPerFrame` im Konstruktor steht in `[Unreleased]` unter `### Changed` (Zeile 140); ein zweiter Eintrag unter `### Fixed` beschriebe dieselbe Regel zweimal (Vorgehen wie Paket 15). Wann `update` geht, steht in `### Fixed` Zeile 200; der erste Aufruf nach einem neuen State ist dieselbe Frage und kommt in denselben Satz.
- **Kein Browsertest für `FixedFrameLoop`, kein Migration Guide.** Die Loop rendert nichts und berührt keinen GPU-Buffer; keine Signatur ändert sich, ein gültiger Default und jede gültige Option verhalten sich wie bisher.
- **Modell mittlere Stufe, Effort low.** Werte, Texte, Stellen und Testnamen stehen hier; es bleibt Transkription samt zwei roten Läufen (einer davon mit Build davor), und `low` hält den Implementierer davon ab, `CONS-027` (disposetes `Display` im Konstruktor) oder die TSDoc-Umbrüche von `dispose()` (Queue, `→ Audit`) gleich mitzunehmen.

## Findings im Volltext

Kein Audit-Finding. Die Nebenbefunde aus »Offene Befunde« im Wortlaut:

**`packages/twopoint5d/src/controls/PanControl2D.ts:286`** · aus Paket 5 · low · → Scope → Paket 16 — der Setter `panView` setzt `#isFirstPanViewUpdate = prevPanView !== this.#panView`; wer vor dem ersten `update()` dasselbe State-Objekt noch einmal zuweist, löscht das Flag, und das garantierte erste `update`-Event fällt aus, solange sich nichts bewegt.

Stand Zug 0 (HEAD `59d47e54`): Fundstelle an `:291-295` (Zeile `:294`), unverändert; trifft zusätzlich jeden neuen State, der vor seinem ersten `update()` zweimal zugewiesen wird.

**`packages/twopoint5d/src/display/FixedFrameLoop.ts:84-85`** · aus Paket 5 · low · → Scope → Paket 16 — `DefaultFps` und `DefaultMaxStepsPerFrame` sind beschreibbare Statics, die der Konstruktor ungeprüft als Ausgangswert übernimmt; `FixedFrameLoop.DefaultFps = 0` ergibt weiter `fixedDelta = Infinity`.

Stand Zug 0 (HEAD `59d47e54`): Fundstelle unverändert, Übernahme im Konstruktor `:168-174`; Wirkung laut Abschnitt »Abgleich« breiter als beschrieben (rückwärts laufende Zeit, `alpha` `NaN` oder > 1, abgewiesene Option fällt auf den kaputten Default).
