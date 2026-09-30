# Paket 5 — PanControl2D: Lebenszyklus, Hot Path und Tests

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-018 (low), PERF-031 (low), TEST-004 (low), TEST-046 (low),
  API-065 (info), DOC-032 (info), DOC-078 (info), TEST-051 (info), DOC-069 (info),
  READ-021 (info)
- Ziel: `PanControl2D` ist nach `dispose()` still, alloziert im Pointer- und
  Update-Pfad nichts, und seine Unit- und Browser-Tests decken Touch, mehrere
  Pointer, Shadow-Root und Stylesheet-Root trennscharf ab.
- Modell: mittlere Stufe (ein Modul samt seinen Tests; die Verhaltensänderung nach
  `dispose()` ist freigegeben und unten ausformuliert, die Allokationsfrage ist in
  Zug 0 geprobt)
- Effort: medium (die API-Änderung ist entschieden und exakt vorgegeben; Urteil
  braucht es bei den Tests, nicht beim Weg)
- Verify: `pnpm run ci` plus die Strukturproben unter »Verify«
- Commit: siehe »Commit«
- Dateien:
  - `packages/twopoint5d/src/controls/PanControl2D.ts`
  - `packages/twopoint5d/src/controls/PanControl2D.spec.ts`
  - neu `packages/twopoint5d/src/controls/hot-path-allocations.spec.ts`
  - `packages/twopoint5d/src/events.ts` (TSDoc von `OnPanControl2DUpdate`, `:190–193`)
  - `packages/twopoint5d-testing/test/helpers/fixtures.js` (`pointer()`, `key()`)
  - `packages/twopoint5d-testing/test/pan-control-input.test.js`
  - `packages/twopoint5d-testing/test/pan-control-keys.test.js`
  - `packages/twopoint5d-testing/test/pan-control-dispose.test.js`
  - `packages/twopoint5d-testing/test/pan-control-stylesheet-root.test.js`
  - `packages/twopoint5d-testing/test/pan-control-switch-off.test.js`
  - `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]`)
- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · PERF-018, PERF-031, DOC-078 unverändert,
    verschoben (`PanControl2D.ts:36`/`:458`/`:562`, `:616–631`, `:434`) · TEST-046,
    API-065, TEST-051, DOC-069, READ-021 unverändert · TEST-004 und DOC-032 umgeformt
    (Touch und `pointercancel` seit 68c3bffb getestet; Verb im `dispose()`-Satz schon da)
    · Folgen aus Paket 4 (`docs/architecture.md:69`, `:376–377`) → Paket 8 · neuer
    Nebenbefund `coordsTarget` ohne Wirkung → Queue (→ Rückfrage) · Probe
    Map-Iteration unter Node 24.21: `Array.from` 176–280 B/Aufruf, `for…of` 0,01–0,02 B,
    `forEach` 0,01 B, mit und ohne V8-Coverage
  - 2026-09-30 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach
    `paket-5.impl-0.json`
  - 2026-09-30 Zug 2: Report FERTIG · 10 Dateien geändert, neu `hot-path-allocations.spec.ts`
    · rote Läufe vorher belegt (1a 3–5, 1b 1 und 3 mit 224/128 B, 1c 2.1 und 6), Proben
    Shadow Root und Stylesheet-Root rot · Arbeitsbaum schmutzig · eigenes Verify
    `paket-5.verify.log` exit=0, alle sechs Strukturproben wie verlangt
  - 2026-09-30 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-5.diff`
  - 2026-09-30 Zug 3: Urteil: alle zehn Findings behoben · kritisch keine · wichtig 2
    (Satzschluss im Fixed-Bullet `CHANGELOG.md:413`; `pan-control-dispose.test.js:154–164`,
    `:179–183` können nach dem frühen `return` in `update()` nicht mehr rot werden) · klein 1
    (TSDoc `unsubscribe()` `PanControl2D.ts:420–421`, `CHANGELOG.md:425`) · Report
    `paket-5.review-0.json`
  - 2026-09-30 Zug 4 Runde 1: offen wichtig 2 + klein 1 → derselbe Implementierer per
    Resume (sonnet, medium), Report nach `paket-5.impl-1.json`
    · zurück FERTIG: Satzschluss gesetzt, `delivers no pan collected before dispose()`
    gestrichen (Gegenstand in `pan-control-switch-off.test.js`), `cannot be brought back …`
    auf Cursor-Klasse umgebaut, zwei Mutationsproben rot · TSDoc und `CHANGELOG.md:425`
    eingeschränkt · Verify `paket-5.verify-1.log` exit=0 · Reviewer gezielt (opus, medium),
    Diff `paket-5.r1.diff`
    · Urteil: wichtig 1, wichtig 2, klein behoben, kein Finding wieder offen · neu wichtig:
    Pointer-Hälfte von `ignores keyboard and pointer after dispose()`
    (`pan-control-dispose.test.js:88–92`) belegt über `update()`, kann nicht rot werden
    (Stelle, die Runde 0 hätte mitnehmen müssen) · Report `paket-5.review-1.json`
  - 2026-09-30 Zug 4 Runde 2: offen wichtig 1 → frischer Implementierer (opus, medium),
    Report nach `paket-5.impl-2.json`
    · zurück FERTIG: `ignores keyboard and pointer after dispose()` und der Zwei-Controls-Test
    in `pan-control-input.test.js` (dieselbe Ursache) auf Cursor-Klasse umgebaut,
    Mutationsprobe `InputControlBase#unsubscribe()` → drei Tests rot · Nebenbefund
    `pan-control-dispose.test.js:93` (vorbestehend, c82f42f7 `:91`) → Queue · Verify
    `paket-5.verify-2.log` exit=0 · Reviewer gezielt (opus, medium), Diff `paket-5.r2.diff`
    · Urteil: behoben, kein Finding wieder offen, Befunde keine · Report
    `paket-5.review-2.json`
  - 2026-09-30 Zug 5: committet c5037879 (11 Dateien, Trailer `Remediation-Run:
    2026-09-30`) auf Verify `paket-5.verify-2.log` exit=0 · Nebenbefund
    `pan-control-dispose.test.js:93` in »Offene Befunde« (vorbestehend, info → Scope:
    die Scope-Regel nimmt jede Severity)

## Vor der ersten Zeile

- `AGENTS.md` lesen, den Abschnitt »Konventionen« im Kopf von `./remediation-plan.md`
  und den Skill `updating-changelog` (`.claude/skills/updating-changelog/SKILL.md`).
- **Breite.** Jede Kommentarzeile und jede Markdown-Prosazeile, die dieses Paket
  schreibt oder umschreibt, hat höchstens 90 Zeichen samt Einrückung, gezählt mit
  `perl -CSD` (macOS-`awk` zählt Bytes). Ein Kommentarblock, den das Paket anfasst,
  wird als Ganzes neu umbrochen; unberührte Blöcke bleiben, wie sie sind — die
  Kommentare der Library laufen sonst bis rund 100 Zeichen, das ist nicht Sache
  dieses Pakets. Im CHANGELOG bleibt jeder Bullet eine einzige Zeile wie alle
  Bullets der Datei; die Prosa des neuen H4 bricht bei 90 um.
- Die Texte unten sind Wortlaut, nicht Anregung. Sie stehen als Fließtext; der
  Umbruch auf 90 ist mechanisch und deine Sache.
- Reihenfolge: erst die Tests aus Schritt 1 schreiben und gegen den unveränderten
  Code laufen lassen (die mit »rot vorher« markierten müssen rot sein, die Ausgabe
  gehört in den Report), dann Schritt 2 bis 4.

## Vorgehen

### 1. Tests zuerst

**1a. `packages/twopoint5d/src/controls/PanControl2D.spec.ts`**

1. Imports: `emit` zusätzlich aus `@spearwolf/eventize`; aus `../events.js` zusätzlich
   `OnPanControl2DHideCursor` und `OnPanControl2DRestoreCursor`.
2. Den Test `'does not pan by a key typed into an input in an open shadow root'`
   (`:185–197`) **löschen**. Er baut dasselbe Ereignis wie der `input`-Fall des
   `it.each` darüber; der echte Fall zieht in die Browser-Suite (1c, Punkt 3).
3. Den Test `'a listener added through onUpdate() after dispose() still hears
   update(), which keeps moving the view'` (`:344–354`) ersetzen durch — **rot
   vorher** (die View wandert auf `x: 11`, der Spy hört einmal):

   ```ts
   it('update() on a disposed control leaves the view where it is and emits nothing', () => {
     const control = makeControl();
     const spy = vi.fn();
     control.dispose();
     on(control, OnPanControl2DUpdate, spy);

     control.panView = {x: 1, y: 1};
     control.speedEast = 10;
     control.update(1);

     expect(control.panView).toEqual({x: 1, y: 1});
     expect(spy).not.toHaveBeenCalled();
   });
   ```

4. Daneben neu — **rot vorher** (der Spy hört dreimal):

   ```ts
   it('onUpdate(), onHideCursor() and onRestoreCursor() subscribe nothing on a disposed control', () => {
     const control = makeControl();
     control.dispose();
     const spy = vi.fn();
     const offs = [control.onUpdate(spy), control.onHideCursor(spy), control.onRestoreCursor(spy)];

     // straight through eventize, past update() and the pointer: whoever is subscribed hears these
     emit(control, OnPanControl2DUpdate, {x: 0, y: 0});
     emit(control, OnPanControl2DHideCursor, control);
     emit(control, OnPanControl2DRestoreCursor, control);

     expect(spy).not.toHaveBeenCalled();
     for (const off of offs) expect(off).not.toThrow();
   });
   ```

   Den Test `'a listener added through onRestoreCursor() after dispose() hears
   nothing'` (`:356–366`) stehen lassen.
5. Ein neuer `describe('pointer positions', …)` nach `describe('options')` mit einem
   Test — **rot vorher** (fünf Aufrufe statt einem):

   ```ts
   it('measures the rectangle of its coordsTarget once per drag, when the pointer goes down', () => {
     const getBoundingClientRect = vi.fn(() => ({left: 5, top: 7}));
     const control = makeControl({coordsTarget: {getBoundingClientRect} as unknown as HTMLElement});

     pointer('pointerdown', {buttons: 1, clientX: 0});
     for (const clientX of [10, 20, 30]) pointer('pointermove', {buttons: 1, clientX});
     pointer('pointerup', {buttons: 0, clientX: 30});
     control.update(0);

     expect(getBoundingClientRect).toHaveBeenCalledOnce();
     expect(control.panView.x).toBe(-30);
   });
   ```

**1b. neu `packages/twopoint5d/src/controls/hot-path-allocations.spec.ts`**

Nach dem Muster von `src/sprites/hot-path-allocations.spec.ts` und dem Absatz zu den
Allokations-Specs in `AGENTS.md` (ganze Zahlen, Konstanten, Objekte in die Runde; nichts
Gebrochenes selbst ausrechnen). Die Listener sind privat; der Spec fängt sie über einen
Spy auf `addEventListener` des Dokument-Stubs ab und ruft sie direkt mit vorgebauten
Ereignis-Objekten — `dispatchEvent()` von Node allokiert selbst und verdeckte die
Messung. Gerüst (Namen und Grenzwert verbindlich, Typ-Details deine Sache):

```ts
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {PanControl2D} from './PanControl2D.js';

// Stylesheets writes into a real CSSStyleSheet, and there is no document here to hold one
vi.mock('../display/Stylesheets.js', () => ({
  Stylesheets: {retainRule: () => 'pan-cursor', releaseRule: () => {}},
}));

// a call that allocates anything costs 16 B at least; the allocation-free paths below
// measure a small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

// the fields PanControl2D reads off a pointer event, on a plain object built once: a round
// hands the listener the same few objects again and again
const pointerEvent = (type: string, init: Record<string, unknown> = {}) =>
  ({type, pointerId: 1, isPrimary: true, pointerType: 'mouse', buttons: 1, clientX: 0, clientY: 0, ...init}) as unknown as PointerEvent;

describe('PanControl2D on the hot path', () => {
  let control: PanControl2D;
  let onPointerDown: (event: PointerEvent) => void;
  let onPointerMove: (event: PointerEvent) => void;

  beforeEach(() => {
    // the DOM stubs of PanControl2D.spec.ts, without spies on the paths a round runs through
    const doc = Object.assign(new EventTarget(), {
      head: {},
      body: {classList: {add() {}, remove() {}}, getBoundingClientRect: () => ({left: 0, top: 0})},
    });
    Object.assign(doc.head, {getRootNode: () => doc, ownerDocument: {head: doc.head}});
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('CSS', {supports: () => true});

    const add = vi.spyOn(doc, 'addEventListener');
    control = new PanControl2D({state: {x: 0, y: 0, pixelRatio: 1}});
    const listenerFor = (type: string) => add.mock.calls.find(([t]) => t === type)![1] as (event: PointerEvent) => void;
    onPointerDown = listenerFor('pointerdown');
    onPointerMove = listenerFor('pointermove');
  });

  afterEach(() => {
    control.dispose();
    // the config restores spies, not globals
    vi.unstubAllGlobals();
  });

  // three tests, see below
});
```

Die drei Tests, je `bytesPerRound / CALLS` gegen `BYTES_PER_CALL_LIMIT` mit der Zahl in
der Meldung wie im Sprites-Spec (`` `${bytesPerCall.toFixed(2)} bytes per call` ``):

1. `'update() with a mouse and a touch down allocates nothing per call'` — **rot
   vorher**. Aufbau: `onPointerDown(pointerEvent('pointerdown'))`,
   `onPointerDown(pointerEvent('pointerdown', {pointerId: 2, pointerType: 'touch',
   clientX: 100}))`, je ein `onPointerMove` für beide (`clientX: 20` bzw. `130`, Id und
   Typ wie beim Down), dann einmal `control.update(0)` — das liefert den Pan und die
   Ankündigung des ersten Aufrufs aus. Runde: `for (let i = 0; i < CALLS; i++)
   control.update(0);` — beide Pointer unten, nichts Neues zu liefern, kein Event.
2. `'a pointermove of a drag allocates nothing per call'`. Aufbau:
   `onPointerDown(pointerEvent('pointerdown'))`, zwei Konstanten `there =
   pointerEvent('pointermove', {clientX: 10})` und `back = pointerEvent('pointermove',
   {clientX: 0})`. Runde: `onPointerMove(i & 1 ? back : there)` × `CALLS`. Der erste
   Move blendet den Cursor aus und emittiert — das fällt in die Aufwärmrunden. Vorher
   nicht zwingend rot: der Stub des Rechtecks ist ein Literal, das V8 wegoptimieren
   kann; im Browser baut `getBoundingClientRect()` bei jedem Aufruf ein `DOMRect`. Den
   Zählbeleg dafür führt der Test aus 1a Punkt 5. Den gemessenen Wert vorher in den
   Report.
3. `'a pointermove of a mouse with no button down allocates nothing per call'` —
   **rot vorher** (`Array.from` in `#restoreCursorUnlessMouseDown()`). Aufbau: kein
   Down; `hover = pointerEvent('pointermove', {buttons: 0, clientX: 10})`. Runde:
   `onPointerMove(hover)` × `CALLS`.

**1c. Browser-Suite `packages/twopoint5d-testing/test/`**

1. `helpers/fixtures.js`:
   - `pointer()` bekommt `isPrimary = true` in die Optionen und gibt es an den
     `PointerEvent` weiter statt des festen `true`. In seine TSDoc als letzter Satz:
     »`isPrimary` is `true` unless named otherwise: the first pointer of its type,
     which a second finger on a touch screen is not.«
   - `key()` bekommt einen dritten Parameter `target`, Vorgabe `document`, und
     dispatcht dort mit `{bubbles: true, composed: true, ...init}`. Der Check läuft mit
     `checkJs`: die Vorgabe `document` legte den Typ sonst auf `Document` fest, und ein
     `input` als Argument wäre ein Typfehler — also `@param {EventTarget} [target]` in
     die JSDoc (`type` und `init` bleiben ohne Typangabe wie bisher). TSDoc: »A key event on `target` — `document`
     unless another is named —, bubbling and composed, so that it reaches the listener
     of PanControl2D on `document` from inside a shadow root as well; `init` names the
     key, usually by `code`.«
2. `pan-control-input.test.js` (`makeBox`, `pointer`, `makeState` wie gehabt; jede
   Box in `boxes`, damit das `afterEach` sie abräumt). Fünf neue Tests:
   1. `'a drag keeps the rectangle of its pointerdown when the coordsTarget moves under
      it'` — **rot vorher** (`+30` statt `-20`): Box bei `left: 0`, Control mit
      `coordsTarget: box`; `pointerdown` bei `(10, 10)`, dann `box.style.left =
      '50px'`, dann `pointermove` bei `(30, 10)`, `update(1 / 60)`; erwartet
      `panView.x === -20`, Meldung `'panView.x after a 20px drag over a box that moved
      by 50px'`.
   2. `'a touch drag delivers its pan up to its pointerup'`: `{pointerId: 7,
      pointerType: 'touch'}`, Down bei 10, Move bei 30, Up bei 40 mit `buttons: 0`,
      `update(1 / 60)` → `-30` (der Weg des Up zählt mit).
   3. `'a mouse and a touch that drag at once move the view by the sum of both'`: Maus
      (Vorgabe, Id 1) Down bei 10, Touch `{pointerId: 2, pointerType: 'touch'}` Down
      bei 100; Maus Move auf 30, Touch Move auf 130; `update(1 / 60)` → `-50`. Danach
      beide Up (`buttons: 0`), damit kein Pointer liegen bleibt.
   4. `'a second finger on a touch screen does not pan'`: Touch Id 2 Down bei 10;
      Touch Id 3 mit `isPrimary: false` Down bei 200; Id 2 Move auf 30, Id 3 Move auf
      260; `update(1 / 60)` → `-20`. Danach beide Up.
   5. `'two controls on one document both follow a drag, and the one left after the
      other one's dispose() keeps panning under its cursor'`: `box` (Vorgabe) und
      `otherBox = makeBox({left: 300})`, beide in `boxes`. `const other = new
      PanControl2D({state: makeState(), cursorStylesTarget: otherBox, cursorPanStyle:
      'grabbing'})`; `control = new PanControl2D({state: makeState(), coordsTarget: box,
      cursorStylesTarget: box, cursorPanStyle: 'grabbing'})`. Alles Weitere in `try {…}
      finally { other.dispose(); }`. Erster Drag über `box` (Down 10, Move 30),
      `control.update(1 / 60)`, `other.update(1 / 60)` → beide `panView.x === -20`; Up.
      `other.dispose()`. Zweiter Drag (Down 10, Move 40); **vor** dem Up
      `getComputedStyle(box).cursor === 'grabbing'` (die Regel, die beide zeigten, bleibt
      für den übrigen); `control.update(1 / 60)` → `-50`, `other.update(1 / 60)` →
      `other.panView.x` bleibt `-20`; Up.
3. `pan-control-keys.test.js`:
   - READ-021: `import {key, makeState} from './helpers/fixtures.js';` und in
     `makeControl()` `state: makeState()` statt des Literals (`:32`).
   - `press(init, target)` und `release(init, target)` reichen `target` an `key()`
     weiter.
   - Neuer Test `'does not pan by a key typed into an input in an open shadow root'`:
     ein `host`-`div` in `document.body`, `attachShadow({mode: 'open'})`, darin ein
     `input` und ein `canvas`; alles nach dem Anhängen in `try {…} finally {
     host.remove(); }`. `makeControl()`; `{code: 'KeyW'}` mit `press`/`release` auf das
     `input`, dazwischen `speeds(control)` festhalten; dasselbe auf das `canvas`.
     Erwartet: beim `input` `STILL` (Meldung `'a key typed into the input'`), beim
     `canvas` `{...STILL, speedNorth: control.pixelsPerSecond}` (Meldung `'a key that
     goes into the canvas beside it'`) — das Gegenstück belegt, dass das Ereignis den
     Listener auf `document` durch die Schattengrenze erreicht. **Mutationsprobe**:
     in `PanControl2D.ts` `#onKeyDown` `event.composedPath()[0] ?? event.target`
     vorübergehend durch `event.target` ersetzen → der Test wird rot (am `document`
     ist das Ziel der Host, kein `input`); zurücksetzen; beides in den Report.
4. `pan-control-stylesheet-root.test.js` (TEST-046): `findCursorRule(root)` weicht
   `cursorRules(root, cursor)` — die `.PanControl2D-`-Regeln im Sheet von `root`, deren
   `style.cursor` gleich `cursor` ist (`filter`, nicht `find`). Kommentar darüber: »the
   rules of the cursor style `cursor` in the stylesheet of `root`: the class name carries
   a postfix, so a rule is known by its prefix and by the cursor it carries — a rule of
   another cursor that an earlier test left behind is not one of them«.
   - Erster Test: `cursorRules(shadowRoot, 'grabbing').length` ist `1`, die
     Cursor-Assertion entfällt damit (Meldung `'grabbing rules inside the shadow
     root'`).
   - Zweiter Test: **vor** `new PanControl2D` `cursorRules(undefined,
     'crosshair').length === 0` (Meldung `'crosshair rules in the stylesheet of the
     document before the control'`), danach `=== 1` (Meldung `'crosshair rules in the
     stylesheet of the document after the control'`) und `cursorRules(shadowRoot,
     'crosshair').length === 0` (`'crosshair rules inside the untouched shadow root'`).
   - **Probe**: im zweiten Test `cursorPanStyle: 'crosshair'` vorübergehend auf
     `'grab'` setzen, die Erwartungen bleiben bei `'crosshair'` → rot; zurücksetzen;
     in den Report.
5. `pan-control-switch-off.test.js` (DOC-069): den Kommentar `:6–7` ersetzen durch
   »the key PanControl2D moves north by default, as the init of a key event: the
   KeyboardEvent.code of the key at the W position«.
6. `pan-control-dispose.test.js`:
   - Den Test `'a listener subscribed before dispose() is never called again'`
     (`:109–129`) umschreiben: bis `control.dispose()` wie gehabt; danach statt
     Speed und `update()` ein direktes `emit(control, 'update', {x: 0, y: 0})` (Import
     `emit` aus `@spearwolf/eventize`), Kommentar davor: »update() of a disposed control
     emits nothing, so a direct emit is what shows whether the listener is still
     there«; erwartet `updates === 1`. Die Assertion `'panView.y still moves'` entfällt.
   - Neuer Test direkt danach — **rot vorher**: `'update() moves the view no further,
     not even by a speed set by hand'`: `dispose()`, `speedNorth = 100`,
     `update(1 / 60)`, erwartet `panView.y === 0`.
   - Im Kopfkommentar zu Assertion (c) (`:34–37`) die Aufzählung ergänzen: »… delivers
     no pan collected before dispose(), moves the view no further through update(),
     takes no listener through its on…() helpers and cannot be brought back through its
     public setters.« (Block neu umbrechen.)

### 2. `packages/twopoint5d/src/controls/PanControl2D.ts`

1. **`PanInternalState`** (`:26–34`) bekommt `left: number; top: number;` zwischen
   `pointerType` und `panX`, mit dem Kommentar »the rectangle of coordsTarget at the
   pointerdown of this pointer: every position of it is measured against this one, to
   the end of its drag«. **`mergePan`** (`:36–51`) entfällt.
2. **`#onPointerDown`** (`:492–512`): das Rechteck wird hier gemessen, einmal je
   Pointer:

   ```ts
   const rect = this.coordsTarget?.getBoundingClientRect();
   const left = rect?.left ?? 0;
   const top = rect?.top ?? 0;
   ```

   und der Zustand bekommt `left`, `top`, `lastX: event.clientX - left`, `lastY:
   event.clientY - top`, `panX: 0`, `panY: 0`. Kommentar über den drei Zeilen: »the
   rectangle is measured once per pointer, here: a read on every pointermove would force
   a layout on a DOM with pending changes each time. The pan is a difference of two
   positions, so an offset that stays the same for the whole drag cancels out, and
   without a target the client coordinates are the reference«. Der vorhandene Kommentar
   »an id that is still down missed its end …« bleibt über dem `set()` (neu umbrochen).
3. **`#updatePanState`** (`:606–614`): `const x = event.clientX - state.left; const y =
   event.clientY - state.top;`, der Rest wie gehabt. **`#toRelativeCoords`**
   (`:616–631`) entfällt; sein Kommentar zum fehlenden Target steckt jetzt in Punkt 2.
4. **`update()`** (`:449–480`):
   - erste Zeile `if (this.isDisposed) return;`
   - der Pointer-Zweig summiert an Ort und Stelle — die Empfehlung des Audits trägt,
     die Probe aus Zug 0 misst `for…of` über `Map#values()` wie `forEach` bei 0,01 B
     je Aufruf, auch unter V8-Coverage:

     ```ts
     if (!this.#pointerDisabled) {
       let panX = this.#releasedPanX;
       let panY = this.#releasedPanY;
       this.#releasedPanX = 0;
       this.#releasedPanY = 0;

       // summed in place: update() runs every frame, and a frame loop that has settled
       // allocates nothing here
       if (this.#pointersDown.size > 0) {
         for (const state of this.#pointersDown.values()) {
           panX += state.panX;
           panY += state.panY;
           state.panX = 0;
           state.panY = 0;
         }
       }

       const pixelRatio = this.panView.pixelRatio || 1;

       this.panView.x -= panX / pixelRatio;
       this.panView.y -= panY / pixelRatio;
     }
     ```

   - TSDoc: der vorhandene erste Absatz bleibt im Wortlaut (neu umbrochen), dazu ein
     zweiter vor `@param`: »On a disposed control this does nothing: the view stays
     where it is, whatever the speed fields hold, and no event goes out.«
5. **`#restoreCursorUnlessMouseDown()`** (`:562–566`):

   ```ts
   #restoreCursorUnlessMouseDown(): void {
     // a mouse that moves over the page with no button down passes here on every move:
     // with no cursor hidden and none about to be, there is nothing to restore and no
     // pointer to look at
     if (this.#hideCursorState === HideCursorState.NO) return;
     for (const state of this.#pointersDown.values()) {
       if (state.pointerType === MOUSE) return;
     }
     this.#restoreCursorStyle();
   }
   ```

   Das ist gleichwertig: `#restoreCursorStyle()` tut aus `NO` nichts (`:573–577`). Die
   Schleife läuft nur noch am Ende eines Drags, nicht pro Hover-Bewegung.
6. **DOC-078**, `unsubscribe()` `:434`: »first: with the listeners off document and
   window, no event can refill what the lines below give up« (zwei Zeilen).
7. **TSDoc der Option `coordsTarget`** (`:116–125`), ganzer Block:

   »The element pointer coordinates are measured against. When a pointer goes down,
   the control takes the `getBoundingClientRect()` of this element and subtracts it
   from every position of that pointer until the pointer ends. Default is the
   `cursorStylesTarget`, and with that `document.body`.

   A drag keeps the rectangle of its `pointerdown` to its end: the pan is a difference
   of two positions, and an offset that stays the same cancels out. An element that
   moves or scrolls under a running drag does not move the view.«

   Der Satz »Name the canvas here when it sits in a shadow root …« entfällt: der
   Control liest bei einem Pointer nie `event.target`, und mit dem Rechteck des
   `pointerdown` ändert die Wahl des Elements keinen Pan (Nebenbefund in der Queue).
8. **TSDoc des Felds `coordsTarget`** (`:242–247`): »The element pointer coordinates
   are measured against. Can be swapped at runtime: a pointer that goes down afterwards
   is measured against the new one, a drag under way keeps the rectangle it started
   with.« `@see` bleibt.
9. **TSDoc von `panView`** (`:351–360`): an den zweiten Absatz anhängen: »A disposed
   control announces nothing: its {@link update} does nothing.«
10. **TSDoc von `dispose()`** (`:680–700`) — API-065 und DOC-032. Der erste und der
    zweite Absatz bleiben im Wortlaut (neu umbrochen). Der dritte Absatz (`:690–699`)
    wird zu drei Absätzen:

    »Afterwards `isDisposed` is `true`, `isActive` is `false`, and neither a pointer
    nor a key reaches this control any more. A key that was still held down when
    `dispose()` ran has given its field back, and the pan of a drag that was still
    running is dropped. {@link update} does nothing on a disposed control: it moves
    {@link panView} no further, not even by a speed field a caller sets by hand, and
    emits no `OnPanControl2DUpdate`. {@link onUpdate}, {@link onHideCursor} and
    {@link onRestoreCursor} subscribe nothing. A write to {@link cursorPanStyle} is
    refused: a disposed control retains no more rules from a stylesheet that is not its
    own.

    `pixelsPerSecond`, `mouseButton`, `keys`, `keyCodes`, `keyboardDisabled`,
    `pointerDisabled`, `panView` and the four `speed…` fields still take values; they
    drive nothing.

    A control that was hiding the cursor emits one last `OnPanControl2DRestoreCursor`
    while its subscribers can still hear it; after that every listener on this control
    goes with it, and a further `dispose()` does nothing.«
11. **Die `on…()`-Helfer** (`:722–744`) — Entscheidung vom 2026-09-30, Lesart unter
    »Entscheidungen in Zug 0«:

    ```ts
    readonly onUpdate = (listener: (props: PanControl2DUpdateProps) => unknown): UnsubscribeFunc =>
      this.isDisposed ? () => {} : on(this, OnPanControl2DUpdate, listener);
    ```

    ebenso `onHideCursor` und `onRestoreCursor` (Vorbild: `TextureStore#onResource()`,
    `packages/twopoint5d/src/texture/TextureStore.ts:377–378`). TSDoc, je ganzer Block:
    - `onUpdate`: »Subscribes `listener` to `OnPanControl2DUpdate`: the position
      {@link update} moved the view to. Returns the function that takes the listener
      off again.« Neuer Absatz: »On a disposed control this does nothing: {@link update}
      moves no view there, the listener is never called, and the returned function has
      nothing to take back.«
    - `onHideCursor`: der vorhandene Text (neu umbrochen), neuer Absatz: »On a disposed
      control this does nothing: the listener is never called, and the returned
      function has nothing to take back.«
    - `onRestoreCursor`: »Subscribes `listener` to `OnPanControl2DRestoreCursor`: a
      cursor this control hid came back. Returns the function that takes the listener
      off again. {@link dispose} of a control that is hiding the cursor emits it one
      last time.« Neuer Absatz wie bei `onHideCursor`.

### 3. `packages/twopoint5d/src/events.ts`

TSDoc von `OnPanControl2DUpdate` (`:190–193`), anhängen: »A disposed control emits it no
more.« (Block neu umbrochen.)

### 4. `packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`

1. `### Added`, Bullet zu `coordsTarget` (`:29`) — ganz ersetzen durch: »- add the
   `coordsTarget` option and the `PanControl2D#coordsTarget` field: the element pointer
   positions are measured against. The control takes its `getBoundingClientRect()` when
   a pointer goes down, and that pointer keeps the rectangle to the end of its drag. It
   defaults to the `cursorStylesTarget`, and with that to `document.body`« (eine Zeile;
   der Shadow-Root-Satz entfällt wie in der TSDoc).
2. `### Added`, Bullet zu den Event-Konstanten (`:76`), letzter Satz ersetzen durch:
   »Add `PanControl2D#onUpdate()`, `#onHideCursor()` and `#onRestoreCursor()`: each
   subscribes a listener to its event and returns the function that takes it off
   again; on a disposed control they subscribe nothing«.
3. `### Changed`, neuer Bullet als letzter vor `### Deprecated` (`:317`): »- perf
   `PanControl2D` allocates nothing on a `pointermove` and in `update()` once a frame
   loop has settled: the pan of the pointers is summed in place, a mouse that moves over
   the page with no button down looks at no pointer, and the rectangle of `coordsTarget`
   is read once per pointer, at its `pointerdown` — a read on every move forces a layout
   on a DOM with pending changes«.
4. `### Fixed`, Bullet `fix PanControl2D#dispose()` (`:412`), anhängen: » `update()` of
   a disposed control does nothing: the view stays where it is, whatever the `speed…`
   fields hold, and no `update` event goes out«.
5. `### Migration Guide`: neuer H4 direkt nach »#### `PanControl2D` keys by
   `KeyboardEvent.code`« (`:2410–2425`), vor »#### `Dependencies#update()` writes every
   declared key«. Grund: 0.21.2 ließ `update()` nach `dispose()` die View bewegen und
   emittieren (`dispose()` war dort nur `destroyAllListeners()` und `off(this)`), die
   Semantik einer öffentlichen Methode ändert sich (Skill, »Migration Guide«, erster
   Punkt). Wortlaut, Prosa bei 90 umbrochen, Blöcke als schlichtes `ts` wie die
   Nachbarn:

   ````markdown
   #### A disposed `PanControl2D` moves its view no further

   `update()` does nothing once `dispose()` has run: a `speed…` field written by hand
   moves `panView` no more, and no `update` event goes out. `onUpdate()`,
   `onHideCursor()` and `onRestoreCursor()` subscribe nothing on a disposed control.
   Code that keeps moving a view after its control is gone moves the state itself.

   **Before**

   ```ts
   control.dispose();
   control.speedEast = 100;
   control.update(deltaTime); // moves panView.x by 100 * deltaTime
   ```

   **After**

   ```ts
   control.dispose();
   state.x += 100 * deltaTime; // the object handed in as options.state
   ```
   ````

### 5. Formatieren und prüfen

`pnpm format`, dann die Verify-Schritte unten. Die Browser-Suite läuft in Chromium und
Firefox; beide müssen grün sein.

## Verify

- `pnpm run ci`, Baseline vollständig grün.
- Strukturproben, jede muss das Genannte liefern:
  - `grep -nE "Array\.from|mergePan|toRelativeCoords" packages/twopoint5d/src/controls/PanControl2D.ts`
    → leer
  - `grep -n "\.getBoundingClientRect()" packages/twopoint5d/src/controls/PanControl2D.ts`
    → genau eine Zeile, in `#onPointerDown`
  - `grep -n "open shadow root" packages/twopoint5d/src/controls/PanControl2D.spec.ts`
    → leer; `grep -c "open shadow root" packages/twopoint5d-testing/test/pan-control-keys.test.js`
    → `1`
  - Breite der neuen und geänderten Kommentarzeilen:
    `git add -N -- packages/twopoint5d/src/controls/hot-path-allocations.spec.ts && git diff -U0 -- packages/twopoint5d/src packages/twopoint5d-testing/test | perl -CSD -ne 'next unless /^\+(?!\+\+)/; s/^\+//; chomp; print "$_\n" if m{^\s*(//|\*|/\*\*)} && length($_) > 90'`
    → leer
  - Breite der neuen CHANGELOG-Prosa (Bullets ausgenommen):
    `git diff -U0 -- packages/twopoint5d/CHANGELOG.md | perl -CSD -ne 'next unless /^\+(?!\+\+)/; s/^\+//; chomp; print "$_\n" if length($_) > 90 && !/^- /'`
    → leer
  - Keine Finding-ID im Diff:
    `git diff -- . ':(exclude)remediation-plan.md' ':(exclude)docs/remediation' | grep -nE "\b(PERF|TEST|API|DOC|READ)-[0-9]{3}\b"`
    → leer
- In den Report: die roten Läufe vorher (1a Punkte 3–5, 1b Tests 1 und 3, 1c Punkt 2.1,
  1c Punkt 6 der neue Test) mit Ausgabe, der gemessene Wert von 1b Test 2 vorher, beide
  Proben aus 1c (Mutationsprobe Shadow Root, Probe Stylesheet-Root). Die Tests aus 1c
  Punkt 2.2–2.5 sind Abdeckung und vorher wie nachher grün — so vermerken.

## Commit

```
fix(twopoint5d): let a disposed PanControl2D move its view no further through update() and let its on…() helpers subscribe nothing, measure the rectangle of coordsTarget once per pointer at its pointerdown and let a drag keep it to its end, sum the pan of the pointers in place and let a mouse that moves over the page with no button down pass without looking at a pointer, cover a touch drag, a mouse and a touch at once, a second finger, two controls on one document and a key typed into an input in an open shadow root, let the stylesheet-root test count the rules of its own cursor, and split the TSDoc of dispose() into paragraphs
```

Trailer nach runner.md Zug 5.

## Urteil des Reviewers

Reviews `paket-5.review-0.json` (Gesamtdiff), `-1` und `-2` (gezielt auf die Nachbesserung).
Stand c5037879:

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| PERF-018 | behoben | `update()` summiert über `values()` in place `PanControl2D.ts:463`; `#restoreCursorUnlessMouseDown()` früher Ausstieg `:582`, `for…of` `:583`; `hot-path-allocations.spec.ts:60`, `:90` |
| PERF-031 | behoben | einziges `getBoundingClientRect()` in `#onPointerDown` `:505`; `left`/`top` im Pointer-Zustand `:31`, gelesen in `#updatePanState` `:629`; `PanControl2D.spec.ts:305`, `pan-control-input.test.js:55` |
| TEST-004 | behoben (umgeformter Umfang) | `pan-control-input.test.js:69`, `:84`, `:103`, `:123`; `isPrimary` in `helpers/fixtures.js:122` |
| TEST-046 | behoben | `cursorRules(root, cursor)` `pan-control-stylesheet-root.test.js:7`, zweiter Test zählt 0 → 1 |
| API-065 | behoben | `update()` früher `return` `PanControl2D.ts:446`; `on…()` No-op `:744`, `:755`, `:766`; `PanControl2D.spec.ts:350`, `:364`; `pan-control-dispose.test.js:130`; TSDoc, `events.ts:191–193`, CHANGELOG samt H4 |
| DOC-032 | behoben | `dispose()`-TSDoc in Absätzen `PanControl2D.ts:697–713` |
| DOC-078 | behoben | `PanControl2D.ts:424–425` »off document and window« |
| TEST-051 | behoben | Duplikat im Node-Spec gelöscht; echter Shadow-Root-Fall `pan-control-keys.test.js:122`, `key()` mit `target` `helpers/fixtures.js:144` |
| DOC-069 | behoben | `pan-control-switch-off.test.js:6–7` |
| READ-021 | behoben | `pan-control-keys.test.js:32` `makeState()` |

Befunde im Verlauf der Kette, alle behoben: Satzschluss im Fixed-Bullet von
`dispose()` (`CHANGELOG.md:413`); drei Dispose-Tests, die über `update()` belegten und nach
dessen frühem `return` nicht mehr rot werden konnten — `delivers no pan collected before
dispose()` gestrichen (Gegenstand hält `pan-control-switch-off.test.js:60`), `cannot be
brought back through its public setters`, `ignores keyboard and pointer after dispose()`
und der Zwei-Controls-Test in `pan-control-input.test.js` auf die Cursor-Klasse umgebaut;
klein: TSDoc von `unsubscribe()` und `CHANGELOG.md:425` auf »a control that is not
disposed« eingeschränkt. Offene kleine Befunde: keine.

## Entscheidungen in Zug 0

- **`on…()` nach `dispose()`**: die Entscheidung vom 2026-09-30 sagt »No-ops wie
  `onRestoreCursor()`«. `onRestoreCursor()` hängt heute einen Listener an, der nie
  feuert; wörtlich genommen hieße »wie« also: anhängen und schweigen. Gewählt ist das
  echte No-op — nichts anhängen, eine leere Funktion zurück —, weil `dispose()` am Ende
  mit `off(this)` jeden Listener wegnimmt und ein danach angehängter sonst so lange
  erreichbar bliebe wie der Control. Vorbild in derselben Library: `TextureStore#onResource()`
  und `#followResource()` nach `dispose()`. Beobachtbar für den Aufrufer ist beides
  gleich: der Listener hört nichts.
- **Rechteck je Pointer statt je Move** (PERF-031): gemessen beim `pointerdown`, im
  Zustand des Pointers gehalten. Folge für den Außenrand des Vertrags: ein Element, das
  sich während eines Drags bewegt oder scrollt, bewegt die View nicht mehr mit. Die
  TSDoc verlangte schon, dass das Rechteck im Drag steht; jetzt steht es per
  Konstruktion. Ein `coordsTarget`, das während eines Drags getauscht wird, gilt ab dem
  nächsten `pointerdown`. Browser-Test 1c Punkt 2.1 hält das fest.
- **Shadow-Root-Satz zu `coordsTarget`** fällt in TSDoc und CHANGELOG: der Control
  wertet bei Pointern nie `event.target` aus, und mit festem Rechteck ändert die Wahl
  des Elements keinen Pan. Ob die Option selbst bleiben soll, ist eine API-Frage und
  steht als Nebenbefund in der Queue (→ Rückfrage).
- **`for…of` bleibt** (Empfehlung des Audits): die Probe
  `paket-5.zug0-probe-map-iter.mjs` im Arbeitsverzeichnis des Laufs (`node --expose-gc`)
  maß unter Node 24.21 für `update()`
  mit einem und zwei Pointern `Array.from` + `reduce` 176–280 B je Aufruf, `for…of`
  über `values()` 0,012–0,020 B, `forEach` mit gebundenem Callback 0,012 B — ohne und
  mit `NODE_V8_COVERAGE`. Kein Grund für das umständlichere `forEach`.
- **Hot-Path-Spec statt Ad-hoc-Messung**: `AGENTS.md` beschreibt für Hot Paths je Modul
  einen `hot-path-allocations.spec.ts`; `src/controls/` bekommt seinen. Die Listener
  werden direkt gerufen, weil `EventTarget#dispatchEvent()` von Node selbst allokiert.
  Der Stub-Aufbau steht doppelt (auch in `PanControl2D.spec.ts`); zwanzig Zeilen
  Doppelung sind billiger als ein Test-Helfer unter `src/testing/` für zwei Dateien.
- **TEST-051** zieht in die Browser-Suite: nur dort gibt es einen echten Shadow Root
  und ein Ereignis, dessen `target` am `document` der Host ist. Der Node-Test ist ein
  Duplikat des `input`-Falls und wird gelöscht (die Empfehlung lässt »oder ihn
  streichen« zu; hier beides: echter Test dort, Duplikat weg).
- **TEST-004** nur für das, was fehlt: Touch mit `pointercancel` deckt
  `pan-control-input.test.js:194–210` seit 68c3bffb, zwei Controls in einer Root
  `pan-control-cursor.test.js:38–60` und `:163–191` (Cursor). Neu sind Touch bis zum
  `pointerup`, Maus und Touch zugleich (beide `isPrimary`, je ihr Typ), ein zweiter
  Finger (`isPrimary: false`) und der Pan zweier Controls über ein `dispose()` hinweg.
- **CHANGELOG**: `coordsTarget` und die `on…()`-Helfer sind erst im `[Unreleased]`-Block
  hinzugekommen — ihre Added-Einträge werden angepasst statt neuer Einträge. `update()`
  gab es in 0.21.2, daher Fixed-Ergänzung plus Migration-H4. Paket 9 glättet den Block
  danach.
- **Keine Folge, kein Nebenbefund** aus der Queue gehört hierher: keiner teilt die
  Ursache.
- **Restplan**: keine Umsortierung. Paket 8 bekommt die beiden Folgen aus Paket 4 (siehe
  »Abgleich«), Paket 9 im Plan den Hinweis, welche CHANGELOG-Stellen dieses Paket
  anfasst; sonst berührt kein offenes Paket `src/controls/` oder die
  `pan-control-*`-Tests.

## Abgleich

Stand: HEAD c301a1e5; `PanControl2D.ts` und die Browser-Tests sind seit c82f42f7 (vor
dem ersten Commit dieses Laufs) unverändert.

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| PERF-018 | unverändert, verschoben | `mergePan` `PanControl2D.ts:36–51`, Aufruf `update()` `:458`; `#restoreCursorUnlessMouseDown()` `:562–566` mit `Array.from(…).some(…)`, gerufen aus `#onPointerUp` `:531`, `#onPointerCancel` `:540`, `#onPointerMove` `:602` (jede Hover-Bewegung einer Maus) |
| PERF-031 | unverändert, verschoben | `#toRelativeCoords()` `:616–631` ruft `getBoundingClientRect()` bei jedem Aufruf; gerufen aus `#onPointerDown` `:496` und `#updatePanState()` `:607` (Move `:589`, Up `:526`) |
| TEST-004 | umgeformt | Touch und `pointercancel`: `pan-control-input.test.js:194–210`; zwei Controls in einer Root, nur Cursor: `pan-control-cursor.test.js:38–60`, `:163–191`. Offen: Touch bis `pointerup`, Maus + Touch zugleich, zweiter Finger, Pan zweier Controls mit `dispose()` des einen |
| TEST-046 | unverändert | `pan-control-stylesheet-root.test.js:42–49`, Helfer `findCursorRule()` `:6–10` findet irgendeine `.PanControl2D-`-Regel |
| API-065 | unverändert | Spec `PanControl2D.spec.ts:344–354`; TSDoc `PanControl2D.ts:690–699` (`dispose()`), `:722–728` (`onUpdate`), `:737–744` (`onRestoreCursor`); Browser `pan-control-dispose.test.js:120–128` hält es ebenfalls fest (»panView.y still moves«). Entscheidung 2026-09-30 im Plan |
| DOC-032 | umgeformt | `PanControl2D.ts:691–693` hat sein Verb (»has given its field back«), aber »and what it no longer delivers is a pan from a drag before the call« lässt »it« offen, und die Aufzählung `:695–696` bricht mitten in der Liste um. Der Absatz wird für API-065 ohnehin neu geschrieben (Schritt 2.10) |
| DOC-078 | unverändert, verschoben | `PanControl2D.ts:434` »with the listeners off document« |
| TEST-051 | unverändert | `PanControl2D.spec.ts:185–197` |
| DOC-069 | unverändert | `pan-control-switch-off.test.js:6–7`, die Datei nutzt nur `KEY_NORTH` (`:8`) |
| READ-021 | unverändert | `pan-control-keys.test.js:32` `state: {x: 0, y: 0, pixelRatio: 1}`; `makeState()` in `helpers/fixtures.js:138–140` |

Offene Folgen im Plan: nur die aus Paket 4 (`docs/architecture.md:69` und `:376–377`,
beide noch an genau diesen Stellen). Symptome des committeten Pakets 4 — sein Umbau in
§2 und §6 hat sie hinterlassen. Statt eines Nachtragspakets von zwei Zeilen gehen sie an
Paket 8, dessen Ziel (»Architektur-Doku … sauber umbrochen und eindeutig«) genau diese
Ursache trägt und dessen Bereich `docs/architecture.md` einschließt.

## Findings im Volltext

**PERF-018 · low · packages/twopoint5d/src/controls/PanControl2D.ts:431** —
Array-Allokationen über `#pointersDown` in `update()` und im Pointermove-Pfad vermeiden
(weitere Stellen laut Audit: `:30`, `:536`, `:573`)
`update()` läuft pro Frame und ruft `mergePan(Array.from(this.#pointersDown.values()))`:
ein neues Array plus über `reduce` ein Akkumulator-Objekt pro gedrücktem Pointer und das
Startobjekt — auch wenn gar kein Pointer unten ist. `#restoreCursorUnlessMouseDown()`
kopiert die Map-Werte ebenfalls per `Array.from(...).some(...)`; es läuft über Zeile
573–575 bei jedem `pointermove` einer Maus ohne gedrückten Pan-Button, also bei jeder
Hover-Bewegung über die gesamte Seite. Wirkung: dauernder kleiner GC-Druck im rAF- und
Input-Pfad.
Beleg: `let {panX, panY} = mergePan(Array.from(this.#pointersDown.values()));`
Empfehlung: Mit `for (const state of this.#pointersDown.values())` direkt in zwei lokale
Zahlen summieren und die States dabei nullen; für den Maus-Check eine Schleife mit
frühem `return` verwenden bzw. einen Zähler gedrückter Maus-Pointer führen. Bei leerer
Map `update()` den Pointer-Zweig ganz überspringen.

**PERF-031 · low · packages/twopoint5d/src/controls/PanControl2D.ts:548-563** — Das
Rechteck des Koordinatenziels bei pointerdown cachen
Jedes `pointermove` ruft `getBoundingClientRect()` auf, standardmäßig auf
`document.body`. Ist das DOM dirty, erzwingt das pro Move ein Layout, obwohl das
Rechteck laut TSDoc während eines Drags konstant sein muss.
Empfehlung: Das Rechteck bei `pointerdown` pro Pointer cachen.

**TEST-004 · low · packages/twopoint5d-testing/test/pan-control-input.test.js** — Die
Testlücken um Touch-Eingabe und mehrere Pointer in PanControl2D schließen
Der Display-Anteil ist mit `Display.spec.ts` und `display-lifecycle.test.js` abgedeckt
(Remediation-Lauf vom 2026-09-24, `6a4bcacf`), `styleUtils` hat eine Spec, und seit dem
Lauf vom 2026-09-29 (`e2026856`) deckt `PanControl2D.spec.ts` Fokusverlust, Tastenfilter
und die Optionen `speed`, `keys`, `keyCodes`, `disableKeyboard`, `mouseButton`,
`disablePointer` und `state` ab. Offen bleibt die Pointer-Seite: die Browser-Tests
nutzen nur Maus mit `pointerId: 1` — kein Touch, kein zweiter Pointer, kein
`pointercancel`, keine zwei Controls in einer Root.
Empfehlung: `pan-control-input.test.js` um einen Touch-Pointer, einen
Zwei-Pointer-Merge und einen `pointercancel`-Fall erweitern; zwei Controls in einer Root
in `PanControl2D.spec.ts` oder der Browser-Suite prüfen.

**TEST-046 · low · packages/twopoint5d-testing/test/pan-control-stylesheet-root.test.js:42**
— Der Stylesheet-Root-Test von PanControl2D findet Regeln früherer Tests
`puts the rule in the stylesheet of the document when no root is named` sucht irgendeine
`.PanControl2D-`-Regel im Sheet des Dokuments. Regeln früherer Tests bleiben dort
stehen, der Test ist also grün, auch wenn der Control selbst keine Regel anlegt.
Aufgefallen im Remediation-Lauf vom 2026-09-24.
Empfehlung: Nach der Regel mit dem Klassennamen genau dieses Controls suchen oder die
Regelzahl vor und nach dem Anlegen vergleichen.

**API-065 · info · packages/twopoint5d/src/controls/PanControl2D.spec.ts:344** —
PanControl2D: Listener, die nach dispose() über onUpdate() hinzukommen, hören update()
weiter
Aufgefallen im Remediation-Lauf vom 2026-09-29. `dispose()` leert nur die vorhandenen
Listener; `update()` emittiert und bewegt die View auch danach, und über die
typisierten `on*()`-Helfer lassen sich neue Listener anhängen. TSDoc und Test halten
das Verhalten fest, statt es zu unterbinden — offen ist, ob es gewollt ist.
Empfehlung: Entscheiden, ob update() und die on*()-Helfer nach dispose() zu No-ops
werden sollen wie onRestoreCursor(), und TSDoc und Test danach ausrichten.
Entschieden am 2026-09-30 (Plan, »Entscheidungen«): ja, No-ops; TSDoc, Test und
CHANGELOG ziehen nach.

**DOC-032 · info · packages/twopoint5d/src/controls/PanControl2D.ts:607** — Den Satzbau
und Umbruch im TSDoc von PanControl2D#dispose() reparieren
Der Satz »{@link update} still moves … and by a key that was still held down when
`dispose()` ran gives its field back« hat kein Verb für den zweiten Teil, und die
Aufzählung `keyboardDisabled`, `pointerDisabled`, `panView` bricht mitten in der Zeile
um. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Den Satz teilen (»A key that was still held down … gives its field back«)
und den Absatz neu umbrechen.

**DOC-078 · info · packages/twopoint5d/src/controls/PanControl2D.ts:429** —
Inline-Kommentar in PanControl2D#unsubscribe() nennt nur document
Der Kommentar sagt »with the listeners off document«; die Listener für Fokusverlust
hängen inzwischen auch an `window`, wie die TSDoc darüber schon sagt. Aufgefallen im
Remediation-Lauf vom 2026-09-29.
Empfehlung: »off document and window« schreiben.

**TEST-051 · info · packages/twopoint5d/src/controls/PanControl2D.spec.ts:184-196** —
Der Shadow-Root-Test des Tastenfilters prüft dasselbe wie der input-Fall
Der Test baut dasselbe Ereignis wie der `input`-Fall des `it.each` darüber und fängt
keine zusätzliche Regression; nur die Assertion `target === doc` macht die
Retargeting-Annahme sichtbar. Aufgefallen im Remediation-Lauf vom 2026-09-29.
Empfehlung: Das Ereignis wirklich aus einem Element im Shadow Root abfeuern (mit
`composed: true`), sodass der Test ohne die `composedPath()`-Auswertung rot würde, oder
ihn streichen.

**DOC-069 · info · packages/twopoint5d-testing/test/pan-control-switch-off.test.js:6** —
Ein Kommentar in pan-control-switch-off nennt vier Tasten, die Datei hat eine
Der Kommentar spricht von W, S, A und D; die Datei nutzt nur `KEY_NORTH`. Aufgefallen im
Remediation-Lauf vom 2026-09-24.
Empfehlung: Den Kommentar auf die eine Taste zurücknehmen.

**READ-021 · info · packages/twopoint5d-testing/test/pan-control-keys.test.js:32** —
pan-control-keys baut den Zustand inline statt über makeState()
Das Literal `{x: 0, y: 0, pixelRatio: 1}` steht inline, obwohl die gemeinsamen
Test-Helfer `makeState()` dafür haben. Aufgefallen im Remediation-Lauf vom 2026-09-24.
Empfehlung: `makeState()` verwenden.
