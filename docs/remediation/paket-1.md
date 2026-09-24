# Paket 1 — Display-Pause: three-Schleife anhalten und Rollback-Fehler bündeln

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-032 (low), BUG-125 (info)
- Ziel: Ein pausiertes Display lässt auch die rAF-Schleife von three ruhen, und ein gescheiterter Start verliert beim Rollback keinen Fehler.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/DisplayStateMachine.ts`
  - `packages/twopoint5d/src/display/FrameLoop.ts`
  - `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d/src/display/DisplayStateMachine.spec.ts`
  - `packages/twopoint5d/src/display/FrameLoop.spec.ts`
  - `packages/twopoint5d-testing/test/display-lifecycle.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(display): let the animation loop of three stand still while a display is paused, let every listener of OnDisplayPause hear it when one throws, let a start() whose start and pause listeners both throw reject with an AggregateError of both errors, and let the rAF driver skip a tick of three that carries no timestamp`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · PERF-032 unverändert (`Display.ts:997-1008` hält nur die eigene Frame-Loop an, `FrameLoop.ts:106-107` nur `setAnimationLoop(null)`; three 0.185.1 `Animation.js:69-102`, `Renderer.js:825`) · BUG-125 unverändert (`DisplayStateMachine.ts:154-160`, Pause über `emit()` in `DisplayStateMachine.ts:124` und `Display.ts:1007`/`:1620-1624`) · Nebenbefund »werfender Pause-Listener beendet die Pause-Zustellung« gleiche Ursache wie BUG-125 → in dieses Paket · Nebenbefund »synchroner erster Tick ohne Zeitstempel« (three `Animation.js:89`, `XRManager.js:1739-1742`) gleicher Mechanismus wie das Fortsetzen → in dieses Paket · Nebenbefund »`dispose()` bricht bei werfendem Pause-/Dispose-Listener ab« (`Display.ts:1511`, `:1515`) eigene Ursache → »Offene Befunde«, low, → Scope · keine Folgen aus früheren Paketen (keins committet) · Restplan unverändert (einziges Paket)
  - 2026-09-24 Zug 1: Implementierer beauftragt · opus, Effort medium · Session `0816cb6e-4ba4-4ccc-a542-5f198874d89d-p1-impl-1` · Report nach `paket-1.impl-1.json`
  - 2026-09-24 Zug 2: Report FERTIG · 8 Dateien geändert (Display.ts, DisplayStateMachine.ts, FrameLoop.ts, drei Specs, display-lifecycle.test.js, CHANGELOG.md) · roter Lauf T1, T3–T9 belegt (8 failed | 83 passed) · Arbeitsbaum schmutzig · Verify `pnpm run ci` ohne Nx-Cache exit=0 (`paket-1.verify.log`)
  - 2026-09-24 Zug 3: Reviewer opus/medium, Session `0816cb6e-4ba4-4ccc-a542-5f198874d89d-p1-review-1` · freigegeben, 0 kritisch, 0 wichtig, 4 klein · Diff `paket-1.diff`, Report `paket-1.review-1.json`
  - 2026-09-24 Zug 4: keine Runde nötig (nur kleine Befunde)
  - 2026-09-24 Zug 5: Commit `412f4a66` mit Trailer `Remediation-Run: 2026-09-24` · Verify davor ohne Nx-Cache exit=0, danach keine Codeänderung

## Worum es geht

**PERF-032.** three startet in `renderer.init()` eine eigene rAF-Schleife
(`Renderer.js:825` → `Animation.start()`), die bis `renderer.dispose()` läuft.
Jeder Tick ruft `nodes.nodeFrame.update()`, setzt `renderer.info.frame` und
ruft den Callback aus `setAnimationLoop()` — `setAnimationLoop(null)` nimmt
nur den Callback heraus (`Animation.js:120-124`), die Schleife läuft weiter.
Ein pausiertes Display nimmt sich heute von seiner `FrameLoop`, deren
rAF-Treiber ruft `renderer.setAnimationLoop(null)` (`FrameLoop.ts:106-107`),
und three tickt weiter bei jeder Bildwiederholrate.

Entscheidung des Nutzers (Plan, »Entscheidungen«, 2026-09-24): three wirklich
anhalten über `renderer._animation.stop()` / `.start()`, per Duck-Typing
abgesichert, bisheriges Verhalten wenn die Form fehlt, Browser-Test gegen
einen three-Tick während der Pause, TSDoc von `pause` nennt Verhalten und
Grenze.

Zwei Eigenschaften von three 0.185.1, die den Weg bestimmen:

- `Animation.start()` prüft nicht, ob die Schleife schon läuft
  (`Animation.js:69-91`). Ein zweiter Aufruf startet eine zweite rAF-Kette,
  three tickt dann doppelt. **Also nur fortsetzen, was das Display selbst
  angehalten hat.**
- `Animation.start()` führt den ersten Tick sofort und synchron aus, ohne
  Argumente (`update()` in `Animation.js:89`). Ist in diesem Moment ein
  Callback gesetzt, bekommt er `time === undefined`. Im rAF-Treiber von
  `FrameLoop.ts` wird daraus `NaN` in der fps-Messung und ein Frame mit
  `now: NaN`. **Also fortsetzen, bevor das Display wieder auf seiner
  Frame-Loop steht, und den Treiber zusätzlich gegen Ticks ohne Zeitstempel
  absichern.** three selbst ruft `_animation.start()` mit gesetztem Callback am
  Ende einer XR-Session (`XRManager.js:1739-1742`); die Absicherung deckt das
  mit ab.

**BUG-125.** Wirft ein `OnDisplayStart`-Listener, fängt
`#initOrRestartThenStart()` den Fehler (`DisplayStateMachine.ts:154`), setzt
die User-Pause und ruft `#pause()` (`:158`). Das emittiert `Pause` mit
`emit()` (`:124`); der Pause-Handler des Displays emittiert `OnDisplayPause`
ebenfalls mit `emit()` (`Display.ts:1007` über `#emit`, `:1620-1624`). Wirft
dort ein Pause-Listener, verlässt dessen Fehler den `catch`-Block, `throw
error` (`:159`) wird nie erreicht, und `start()` rejected mit dem
Pause-Fehler — der Start-Fehler ist weg. Zugleich beendet `emit()` die
Zustellung beim ersten werfenden Listener: die Pause-Listener dahinter hören
die Pause nie, obwohl der Kommentar in `:155` zusagt »the listeners that heard
start hear pause next«.

Entscheidung des Nutzers (2026-09-24): `start()` rejected dann mit einem
`AggregateError` aus Start- und Pause-Fehler, dieselbe Form wie bei mehreren
werfenden Start-Listenern. Test zuerst.

## Entscheidungen dieses Detailplans

1. **Anhalten und Fortsetzen sitzen im Display, nicht im rAF-Treiber.** Nur
   das Display kennt jede Pause, auch die, in die es geht, bevor es je lief:
   mit `pauseOutsideViewport` und einer Canvas außerhalb des Sichtbereichs vor
   dem Start (`start()` → `NEW` → `#pause()`), oder wenn ein Init-Listener die
   Pause setzt. In diesen Fällen stand das Display nie auf seiner Frame-Loop,
   der Treiber lief nie und würde nichts anhalten — gerade der Fall mit vielen
   Displays auf einer langen Seite, für den `pauseOutsideViewport` existiert.
2. **Nur fortsetzen, was das Display angehalten hat** (Feld
   `#stoppedAnimationOfThree`). Der erste Start nach `init()` findet die
   Schleife laufend vor und ruft nichts.
3. **Nicht anhalten, solange eine andere `FrameLoop` auf dem Renderer
   läuft.** Nachdem das Display seine Frame-Loop verlassen hat, trägt die
   three-Schleife nur dann noch einen Callback (`renderer.getAnimationLoop()
   != null`, öffentliche API, typisiert in `@types/three` 0.185.4), wenn eine
   weitere `FrameLoop` auf demselben Renderer den Treiber hält. Die Pause
   eines Displays soll deren Frames nicht abschneiden. Grenze, die bewusst
   bleibt: Eine `FrameLoop`, die erst *während* der Pause auf dem Renderer
   startet, bekommt ihre Frames, sobald das Display wieder läuft. Im Code als
   Kommentar festhalten, nicht in der TSDoc.
4. **Vor dem ersten Start bleibt die Schleife unangetastet.** Ein nie
   gestartetes Display (auch eines mit `stop()` vor dem ersten `start()`,
   dessen `pause` `true` antwortet) emittiert kein `Pause`. Die Schleife nach
   `init()` von sich aus anzuhalten, nähme einem Aufrufer, der den Renderer
   eines nie gestarteten Displays mit eigenem `setAnimationLoop()` betreibt,
   seine Frames. Die TSDoc nennt das als Grenze.
5. **Reihenfolge in den Handlern**, gespiegelt zur vorhandenen Logik in
   `Display.ts:987-989` und `:1000-1002`:
   - Pause: Chronometer stoppen → `this.frameLoop.stop(this)` → three
     anhalten → `retainClear` → Pause emittieren. Anhalten *nach* dem
     Verlassen der Frame-Loop, weil erst dann der Treiber seinen Callback vom
     Renderer genommen hat und `getAnimationLoop()` die Frage aus Punkt 3
     beantwortet. Anhalten *vor* dem Emit, weil ein Pause-Listener, der
     `pause = false` setzt, das Display sofort wieder startet — ein Anhalten
     danach ließe ein laufendes Display mit stehender three-Schleife zurück.
   - Start: Chronometer → three fortsetzen → `this.frameLoop.start(this)` →
     Start emittieren. Fortsetzen *vor* der Frame-Loop, damit der synchrone
     erste Tick von `Animation.start()` keinen Callback des eigenen Treibers
     vorfindet.
6. **Der rAF-Treiber überspringt Ticks ohne endlichen Zeitstempel**
   (`!Number.isFinite(now)`). Das macht das Fortsetzen unabhängig davon, ob
   irgendein Callback gesetzt ist (Punkt 3, Grenze), und deckt den
   XR-Session-Ende-Pfad von three ab.
7. **`OnDisplayPause` erreicht jeden Listener, auch hinter einem, der
   wirft** — `emitStrict` statt `emit`, im Display und in der State-Machine.
   Das ist dieselbe Ursache wie BUG-125 (die Pause wird mit `emit()`
   zugestellt) und macht die Zusage in `DisplayStateMachine.ts:155` wahr. Es
   gilt für jeden Pause-Pfad, nicht nur den Rollback: `pause = true` und
   `stop()` werfen danach den Fehler, bei mehreren werfenden Listenern ein
   `AggregateError` — wie `OnDisplayStart` es schon tut. Nur im Rollback
   strikt zuzustellen, bräuchte ein Signal von der State-Machine an den
   Handler und ließe die übrigen Pfade mit derselben Lücke zurück.
8. **Der `AggregateError` des Rollbacks verschachtelt, statt zu glätten:**
   `errors` ist `[startError, pauseError]`, jeweils genau der Wert, den das
   jeweilige `emitStrict` geworfen hat. Bei einem werfenden Start-Listener und
   einem werfenden Pause-Listener — dem gewöhnlichen Fall — ist das flach:
   `[s, p]`. Werfen mehrere Start-Listener, ist `startError` schon der
   `AggregateError` von eventize (`errors: [s1, s2]`) und steht als ein
   Element darin. Glätten hieße, jeden `AggregateError` auf der Startseite
   aufzuspreizen, auch einen, den ein Listener selbst wirft — dessen Meldung
   ginge verloren, und von welchem Ursprung ein `AggregateError` stammt, lässt
   sich nur an eventizes Meldungstext raten. So geht kein Fehler und keine
   Meldung verloren.
9. **`cause` des Rollback-`AggregateError` ist der Pause-Fehler.** Die
   ESLint-Regel `preserve-caught-error` (in `@eslint/js` 10 recommended,
   aktiv) verlangt beim Werfen eines neuen Fehlers im `catch` die gefangene
   Variable als `cause`. Inhaltlich passt es: der Pause-Fehler ist der Grund,
   warum der Aufruf einen `AggregateError` wirft statt des Start-Fehlers.
10. **Kein Migrations-Hinweis.** Keine Signatur ändert sich; anders verhält
    sich nur Code mit werfenden `OnDisplayPause`-Listenern. Die
    CHANGELOG-Einträge beschreiben es.

## Vorgehen

Alle Namen, Meldungen und Kommentare englisch; keine Finding-IDs, kein
Rückblick auf den Vorzustand (siehe »Konventionen« im Plan).

### 1. Regressionstests zuerst — rot sehen

Die Vitest-Tests unten schreiben und vor jeder Änderung am Code einmal laufen
lassen, rot: `pnpm nx test twopoint5d -- src/display/Display.spec.ts
src/display/DisplayStateMachine.spec.ts src/display/FrameLoop.spec.ts`. Die
Ausgabe des roten Laufs gehört in den Report. Rot sein müssen T1 und T3 bis T9;
T2 ist ein Schutztest und darf vorher grün sein.

**Stub in `Display.spec.ts`:** `makeRenderer()` bekommt die öffentliche
Methode, die das Display künftig fragt — `getAnimationLoop: vi.fn(() =>
loop)` neben `setAnimationLoop` —, und die JSDoc des Helfers nennt sie. Die
three-Schleife selbst hängen die neuen Tests nach `makeDisplay()` an:
`const animation = {start: vi.fn(), stop: vi.fn()}; Object.assign(renderer,
{_animation: animation});`. Die übrigen Tests laufen ohne `_animation` und
belegen damit, dass ein Renderer ohne diese Form pausiert wie gehabt. In
Tests, die `FrameLoop` brauchen, `import {FrameLoop} from './FrameLoop.js';`.

In `describe('frame loop')` von `Display.spec.ts`:

- **T1** `'stops the animation loop of three as the display goes into the
  pause, and starts it again once as it runs'` — `await display.start()`;
  `animation.start` nicht aufgerufen (three hat die Schleife in `init()`
  gestartet), `animation.stop` nicht aufgerufen. `display.pause = true` →
  `animation.stop` genau einmal. `display.pause = false` → `animation.start`
  genau einmal, und vor dem letzten `renderer.setAnimationLoop`-Aufruf:
  `expect(animation.start.mock.invocationCallOrder[0]).toBeLessThan(renderer.setAnimationLoop.mock.invocationCallOrder.at(-1)!)`.
  Ein weiteres `display.pause = false` ändert an beiden Zählern nichts.
- **T2** `'leaves the animation loop of three running while another frame
  loop runs on the renderer'` — nach `await display.start()` eine zweite
  Schleife auf demselben Stub: `const other = new FrameLoop(0, renderer);
  const target = {[FrameLoop.OnFrame]() {}}; other.start(target);`.
  `display.pause = true` → `animation.stop` nicht aufgerufen;
  `display.pause = false` → `animation.start` nicht aufgerufen. Am Ende
  `other.stop(target)`.
- **T3** `'stops the animation loop of three for a display that goes into
  the pause as it starts'` — `doc.hidden = true` vor `makeDisplay()` (der
  Konstruktor liest die Sichtbarkeit), dann `await display.start()` →
  Ereignisse `[OnDisplayPause]`, `animation.stop` genau einmal. Dann
  `doc.hidden = false` und den `visibilitychange`-Listener aus
  `doc.addEventListener.mock.calls` aufrufen (wie im Test in
  `describe('visibility')`) → `animation.start` genau einmal, Display läuft.

In `describe('start()')` von `Display.spec.ts`, hinter `'two start listeners
that throw reject start() with an AggregateError of both errors'`:

- **T4** `'a pause listener that throws: every pause listener hears pause,
  and pause = true throws its error'` — `await display.start()`; ein
  `OnDisplayPause`-Listener wirft `error`, ein zweiter dahinter schreibt in
  `after`. `expect(() => { display.pause = true; }).toThrow(error)`; `after`
  ist `[OnDisplayPause]`; `display.isRunning` `false`,
  `display.frameLoop.subscriptionCount` `0`.
- **T5** `'two pause listeners that throw make pause = true throw an
  AggregateError of both errors'` — zwei werfende Pause-Listener;
  `display.pause = true` in `try/catch` fangen, der Fehler ist
  `AggregateError` mit `errors` `[first, second]`.
- **T6** `'a start listener and a pause listener that throw reject start()
  with an AggregateError of both errors, and every pause listener hears
  pause'` — ein `OnDisplayStart`-Listener wirft `startError`, ein
  `OnDisplayPause`-Listener wirft `pauseError`, ein Pause-Listener dahinter
  schreibt in `after`. Die Ablehnung von `display.start()` ist ein
  `AggregateError`, `errors` `[startError, pauseError]`, `cause`
  `pauseError`; `after` ist `[OnDisplayPause]`; `display.isRunning`
  `false`, `display.pause` `true`, `display.frameLoop.subscriptionCount`
  `0`. Danach die Listener entschärfen (Flag wie im Test `'a start listener
  that throws rejects start(), …'`) und `await display.start()` → läuft, die
  Ereignisse sind `[OnDisplayRestart, OnDisplayStart]`.
- **T7** `'two start listeners and a pause listener that throw reject
  start() with an AggregateError of the start errors and the pause error'` —
  zwei werfende Start-Listener `first`, `second`, ein werfender
  Pause-Listener `pauseError`. Die Ablehnung ist ein `AggregateError` mit
  zwei `errors`: `errors[0]` ist ein `AggregateError` mit `errors` `[first,
  second]`, `errors[1]` ist `pauseError`.

In `DisplayStateMachine.spec.ts`, hinter `'a start listener that throws holds
the state machine in a user pause, after every start listener has run'`:

- **T8** `'a start listener and a pause listener that throw make start()
  throw an AggregateError of both, after every pause listener has run'` —
  auf der State-Machine: ein `DisplayStateMachine.Start`-Listener wirft
  `startError`, ein `DisplayStateMachine.Pause`-Listener wirft `pauseError`,
  ein Pause-Listener dahinter zählt mit. `stateMachine.start()` in
  `try/catch`: `AggregateError`, `errors` `[startError, pauseError]`; der
  Zähler steht auf 1; `state` ist `PAUSED`, `pausedByUser` `true`.

In `FrameLoop.spec.ts`, `describe('the shared rAF driver')`:

- **T9** `'skips a tick of the renderer without a timestamp'` — `const
  renderer = makeFakeRenderer(); const loop = new FrameLoop(0, renderer);
  const {events} = subscribe(loop);` dann
  `renderer.callback!(undefined as unknown as number)` → `events` leer,
  `loop.frameNo` `0`. Danach `renderer.tick(1000)` und
  `renderer.tick(1016)` → zwei Frames, der erste mit `deltaTime` `0`, der
  zweite mit `frameNo` `2` und endlichem `now`; `loop.measuredFps` ist `0`
  (kein Messfenster abgeschlossen, kein `NaN`).

Im Browser, `packages/twopoint5d-testing/test/display-lifecycle.test.js`,
hinter `'stop() takes the display off its frame loop, start() puts it back
without a second init'`:

- **T10** `'a paused display lets the animation loop of three stand still,
  and one that runs again starts it once'`:

  ```js
  host = makeContainer();
  display = new Display(host);
  await display.start();
  await display.nextFrame();
  // three counts the ticks of its own animation loop in info.frame, and nothing else writes it
  const {info} = display.renderer;

  display.pause = true;
  const pausedAt = info.frame;
  await animationFrames(5);
  expect(info.frame, 'no tick of three while paused').to.equal(pausedAt);

  display.pause = false;
  await display.nextFrame();
  const runningAt = info.frame;
  await animationFrames(10);
  const ticks = info.frame - runningAt;
  expect(ticks, 'three ticks again').to.be.greaterThan(0);
  // one loop ticks once per frame of the page; a second one started on top would tick twice
  expect(ticks, 'one loop of three, not two').to.be.below(15);
  ```

  Das ist der Test aus der Entscheidung des Nutzers: ändert ein three-Update
  die Interna so, dass `_animation` fehlt, tickt three in der Pause weiter,
  und T10 wird rot. `info.frame` setzt in three 0.185.1 allein der Tick von
  `Animation` (`Animation.js:79`, `Info.js:42`). Ein roter Lauf von T10 vor
  dem Fix ist willkommen, aber nicht Pflicht — T1 und T3 belegen den Fehler
  schon; T10 läuft im Verify.

### 2. `DisplayStateMachine.ts`

1. Import bleibt `{emit, emitStrict, …}` — `emit` braucht `#initOrRestart`
   weiter für `Init` und `Restart`.
2. `#pause` (`:121-126`): `emit(this, DisplayStateMachine.Pause)` →
   `emitStrict(this, DisplayStateMachine.Pause)`, mit einem kurzen
   Kommentar: every listener hears pause, even behind one that throws.
3. `#initOrRestartThenStart()`, Zweig `if (this.#isPaused())` (`:146-148`):
   ebenso `emitStrict(this, DisplayStateMachine.Pause)`. Nicht durch
   `this.#pause()` ersetzen: dort ist der Zustand womöglich schon `PAUSED`
   (Restart aus der Pause), und `#pause()` emittierte dann nichts — die
   Listener, die `Restart` gehört haben, müssen `Pause` hören.
4. Rollback (`:154-160`) wird zu:

   ```ts
   } catch (startError) {
     // the listeners that heard start hear pause next, and the pause is the user's: a tab
     // that comes back does not start again what failed to start — the next start() does
     this.#pausedByUser = true;
     try {
       this.#pause();
     } catch (pauseError) {
       // neither error goes missing: the one of the start, and the one of the pause after it
       throw new AggregateError(
         [startError, pauseError],
         'start(): a listener of start threw, and a listener of pause threw in the pause that followed',
         {cause: pauseError},
       );
     }
     throw startError;
   }
   ```

   Der bestehende Kommentar über dem `this.#pausedByUser = true` bleibt
   inhaltlich; er stimmt jetzt, weil `#pause()` strikt zustellt.

### 3. `Display.ts`

1. **Modul-Helfer** nach `dropContextLostListener()` (`:174-180`), im Stil
   der Nachbarn (Kommentar erklärt das Warum, Cast mit Kommentar wie in
   `:175`):

   ```ts
   // The animation loop three runs on a renderer of its own: renderer.init() starts it, it ticks on
   // every animation frame of the page until renderer.dispose(), and setAnimationLoop(null) only
   // takes the callback out of it. three stops and starts it only through renderer._animation,
   // private by convention; a renderer without that shape keeps its loop running
   interface AnimationOfThree {
     start(): void;
     stop(): void;
   }

   function getAnimationOfThree(renderer: WebGPURenderer): AnimationOfThree | undefined {
     // the three.js typings leave the field off the renderer, and it is null until init() has run
     const animation = (renderer as unknown as {_animation?: Partial<AnimationOfThree> | null})._animation;
     return typeof animation?.start === 'function' && typeof animation.stop === 'function'
       ? (animation as AnimationOfThree)
       : undefined;
   }
   ```

2. **Feld** in der Klasse, bei `#pauseRequests` (`:562-565`):

   ```ts
   // the animation loop of three this display has stopped as it went into the pause, and the only
   // one it starts again: three's Animation.start() does not ask whether its loop runs already,
   // and a second call would run a second rAF chain beside the first
   #stoppedAnimationOfThree?: AnimationOfThree;
   ```

3. **Zwei private Methoden**, z. B. hinter `#releaseRenderer()`:

   ```ts
   #stopAnimationOfThree(): void {
     const renderer = this.renderer;
     if (renderer == null || this.#stoppedAnimationOfThree != null) return;
     const animation = getAnimationOfThree(renderer);
     if (animation == null) return;
     // the display is off its frame loop here, and the driver has taken its callback off the
     // renderer if no other FrameLoop holds it. A callback still on the loop belongs to such a
     // FrameLoop, and its frames go on. One that starts on the renderer while the loop stands
     // still gets its frames once the display runs again
     if (renderer.getAnimationLoop() != null) return;
     animation.stop();
     this.#stoppedAnimationOfThree = animation;
   }

   #startAnimationOfThree(): void {
     const animation = this.#stoppedAnimationOfThree;
     if (animation == null) return;
     this.#stoppedAnimationOfThree = undefined;
     animation.start();
   }
   ```

   Wortlaut der Kommentare darf der Implementierer glätten; Inhalt und
   Reihenfolge der Prüfungen bleiben. `getAnimationOfThree()` vor
   `getAnimationLoop()`: vor `init()` ist `_animation` `null`, und
   `getAnimationLoop()` griffe ins Leere (auch wenn heute kein Pfad vor
   `init()` pausiert).

4. **Start-Handler** (`:982-995`): vor `this.frameLoop.start(this)` die Zeile
   `this.#startAnimationOfThree();` mit Kommentar: three runs the first tick
   of a loop it starts right away and without a timestamp, and the display
   is not on its frame loop yet, so that tick finds no callback of it.
5. **Pause-Handler** (`:997-1008`) wird zu:

   ```ts
   [DisplayStateMachine.Pause]: () => {
     this.#chronometer.stop(performance.now() / 1000);

     // off the loop before the event goes out, … (bestehender Kommentar bleibt)
     this.frameLoop.stop(this);

     // after the frame loop, whose driver takes its callback off the renderer there, and before
     // the event goes out: a pause listener that sets pause = false starts the loop again
     this.#stopAnimationOfThree();

     retainClear(this, OnDisplayStart);

     // every listener hears pause, even behind one that throws; the call that paused the display
     // then throws the error, or an AggregateError when more than one listener throws
     if (this.renderer != null) emitStrict(this, OnDisplayPause, this.getEventProps());
   },
   ```

   `#emit` bleibt für `Init`, `Restart`, `Resize`, `RenderFrame`.

6. **TSDoc**, knapp und im Ton der Datei:
   - Klassen-TSDoc, Punkt 2 (`:414-426`): nach »taken off again when it
     pauses.« ergänzen, dass während der Pause auch die Animationsschleife
     von three ruht (Verweis `see {@link Display.pause}`). Am Ende des
     Absatzes über den werfenden `OnDisplayStart`-Listener: wirft dabei auch
     ein Listener von `OnDisplayPause`, rejected `start()` mit einem
     `AggregateError` aus beiden Fehlern.
   - `pause` (`:1083-1091`), zwei neue Absätze vor »After dispose …«:

     > Every listener of `OnDisplayPause` hears the event, even behind one
     > that throws; a write that pauses the display then throws the error, or
     > an `AggregateError` when more than one listener throws.
     >
     > While the display holds in the pause, the animation loop of its
     > renderer stands still as well. three runs that loop from
     > `renderer.init()` on, on every animation frame of the page, and
     > `setAnimationLoop(null)` only takes the callback out of it; so the
     > display stops the loop as it goes into the pause and starts it again
     > as it runs. three 0.185 offers no public way to do so, and the display
     > reaches the loop through `renderer._animation`: a renderer without it
     > keeps its loop running through the pause. So does a renderer another
     > {@link FrameLoop} still runs on as the display goes into the pause,
     > and before the first start the loop runs as three started it.

   - `stop()` (`:1461-1466`): ein Satz, dass für die Listener von
     `OnDisplayPause` und die Schleife von three dasselbe gilt wie bei
     `pause = true` (`see {@link Display.pause}`).
   - `start()` (`:1406-1410`): nach dem Absatz über werfende
     `OnDisplayStart`-Listener:

     > If a listener of `OnDisplayPause` throws as well in that pause, the call
     > rejects with an `AggregateError` whose `errors` are the error it would
     > have rejected with and the error of the pause — that of the one pause
     > listener, or an `AggregateError` when more than one throws. Every
     > listener of `OnDisplayPause` hears the event all the same.

### 4. `FrameLoop.ts`

In `RAF#onAnimationFrame` (`:79-89`), nach dem Neu-Anfordern des
Browser-rAF (der rendererlose Zweig muss seine Kette weiterführen), vor
`#measureFps(now)`:

```ts
// three runs the first tick of its animation loop right away as the loop starts, without a
// timestamp — after a Display has started the loop again, and at the end of an XR session. A
// tick without one measures nothing and reaches no FrameLoop
if (!Number.isFinite(now)) return;
```

Sonst nichts an `FrameLoop.ts`; `FrameLoop.resetRAF()` und seine TSDoc
bleiben.

### 5. `CHANGELOG.md`

Nach dem Skill `updating-changelog`, in `## [Unreleased]`, je ein neuer
Eintrag, ohne »before«/»previously«:

- `### Changed`: ein pausiertes `Display` lässt die Animationsschleife seines
  Renderers ruhen — three betreibt sie ab `renderer.init()` auf jedem
  Animation Frame der Seite, `setAnimationLoop(null)` nimmt nur den Callback
  heraus; das Display hält sie über `renderer._animation` an, wenn es in die
  Pause geht, und setzt sie fort, wenn es läuft. Ein Renderer ohne dieses
  Feld und einer, auf dem beim Pausieren noch eine andere `FrameLoop` läuft,
  behalten ihre Schleife; vor dem ersten Start läuft sie, wie three sie
  gestartet hat.
- `### Fixed`: ein werfender `OnDisplayPause`-Listener — jeder Listener hört
  das Ereignis trotzdem, und `pause = true` bzw. `stop()` werfen danach den
  Fehler, bei mehreren einen `AggregateError`. Folgt die Pause auf einen
  werfenden `OnDisplayStart`-Listener, rejected `Display#start()` mit einem
  `AggregateError`, dessen `errors` den Start-Fehler und den Pause-Fehler
  tragen.
- `### Fixed`: ein Tick der three-Schleife ohne Zeitstempel — den three beim
  Start seiner Schleife sofort ausführt, etwa am Ende einer XR-Session —
  erreicht keine `FrameLoop` mehr und geht nicht in die fps-Messung ein.

Formulierung auf Englisch, im Stil der Nachbareinträge (`- fix …`,
`- a paused …`). Die bestehenden Einträge in `:46` und `:218` bleiben stehen.

### 6. Verify

`pnpm run ci` aus dem Repo-Root. Grün heißt: Lint (inklusive
`preserve-caught-error`), Typecheck der Specs, Coverage-Schwellen und die
Browser-Suite in Chromium und Firefox, T10 eingeschlossen.

## Nicht in diesem Paket

- `Display#dispose()` bricht ab, wenn ein `OnDisplayPause`-Listener (über
  das `stop()` in `Display.ts:1511`) oder ein `OnDisplayDispose`-Listener
  (`:1515`) wirft. Das ist bekannt und steht in »Offene Befunde« des Plans;
  nicht anfassen, auch wenn die strikte Pause-Zustellung es beim Lesen
  sichtbar macht.
- Die three-Schleife vor dem ersten Start (Entscheidung 4) und das
  Zusammenspiel mit einer XR-Session, die während einer Pause beginnt oder
  endet — three startet die Schleife dann selbst (`XRManager.js:1233-1235`,
  `:1739-1742`). twopoint5d bietet keinen XR-Pfad an; kein Code, keine Doku
  dazu.

## Abgleich und Triage (Zug 0, 2026-09-24)

- **PERF-032 — unverändert.** `Display.ts:997-1008`: der Pause-Handler
  stoppt Chronometer und Frame-Loop, nichts an three. `FrameLoop.ts:101-116`:
  der Treiber ruft `renderer.setAnimationLoop(null)`. three 0.185.1:
  `Renderer.js:825` startet die Schleife in `init()`, `Renderer.js:1921-1927`
  setzt nur den Callback, `Animation.js:69-102` sind `start()`/`stop()`,
  `Renderer.js:2540` hält sie erst in `dispose()` an.
- **BUG-125 — unverändert.** `DisplayStateMachine.ts:154-160` (Fundstelle
  `:158` ist `this.#pause();`), Pause über `emit()` in `:124`; im Display
  `Display.ts:1007` über `#emit` (`:1620-1624`). eventize 6.2.0: `emit()`
  lässt den ersten werfenden Listener durch und stellt nicht weiter zu,
  `emitStrict()` stellt allen zu und wirft den einen Fehler oder
  `AggregateError(failures, 'emitStrict: one or more listeners failed')`.
- **Nebenbefund, gleiche Ursache wie BUG-125, ins Paket:** ein werfender
  `OnDisplayPause`-Listener beendet die Zustellung, die Listener dahinter
  hören die Pause nie — in jedem Pause-Pfad (`DisplayStateMachine.ts:124`,
  `:148`, `Display.ts:1007`). Vorbestehend (HEAD `ff427a76`). Ursache ist
  dieselbe: die Pause wird mit `emit()` zugestellt. Entscheidung 7.
- **Nebenbefund, gleicher Mechanismus wie das Fortsetzen, ins Paket:**
  three führt beim Start seiner Schleife den ersten Tick synchron und ohne
  Zeitstempel aus (`Animation.js:89`); am Ende einer XR-Session mit dem
  Callback des Treibers (`XRManager.js:1739-1742`) → `NaN` in
  `FrameLoop.ts:84-88`. Vorbestehend für XR; das Paket ruft
  `Animation.start()` selbst und braucht die Absicherung ohnehin.
  Entscheidung 6.
- **Nebenbefund, eigene Ursache, → »Offene Befunde«:** `Display#dispose()`
  setzt `#disposed` (`:1509`) und ruft dann `this.stop()` (`:1511`) und
  `emit(this, OnDisplayDispose, this)` (`:1515`). Wirft ein Pause-Listener
  (laufendes Display) oder ein Dispose-Listener, verlässt der Fehler
  `dispose()`: Frame-Loop-Abmeldung, `off(this)`, Rückgabe der Canvas,
  Freigabe des Renderers und Entfernen des Containers bleiben aus, und ein
  zweites `dispose()` kehrt in `:1508` sofort zurück — Renderer und
  GPU-Device bleiben für immer liegen. Vorbestehend (HEAD `ff427a76`, kein
  Commit dieses Laufs davor). Severity geschätzt `low`: tritt nur mit einem
  werfenden Listener auf, dann aber mit einem dauerhaften Leck. Urteil
  `→ Scope`: liegt in `packages/twopoint5d/src/display/`, die Scope-Regel
  deckt jede Severity. Nicht in dieses Paket: die Ursache ist die
  ungeschützte Teardown-Folge in `dispose()`, nicht die Art der
  Pause-Zustellung — die strikte Zustellung aus Entscheidung 7 ändert daran
  nichts, der Fix (Teardown zu Ende führen, dann den Fehler melden) ist ein
  eigener.
- **Folgen aus früheren Paketen:** keine — kein Paket committet.
- **Restplan:** unverändert; Paket 1 ist das einzige Paket.

## Findings im Volltext

**PERF-032 · low · packages/twopoint5d/src/display/Display.ts** (weitere
Fundstelle: `node_modules/three/src/renderers/common/Animation.js:69-91`) —
Die rAF-Schleife von three läuft während einer Pause weiter

Ein pausiertes Display führt keinen twopoint5d-Code pro Frame mehr aus. three
0.185.1 startet aber in `renderer.init()` eine eigene rAF-Schleife, die bis
`renderer.dispose()` läuft; `setAnimationLoop(null)` nimmt nur den Callback
heraus. Der Tick von three bleibt also bei jeder Refresh-Rate. Grenze des
Fixes aus dem Remediation-Lauf vom 2026-09-24.

Empfehlung: Beobachten, ob three die Schleife stoppbar macht
(`Animation.stop()`), und dann beim Pausieren anhalten; bis dahin in der
TSDoc von `pause` nennen.

(Abweichung von der Empfehlung per Entscheidung des Nutzers vom 2026-09-24:
jetzt anhalten, über `renderer._animation`.)

**BUG-125 · info · packages/twopoint5d/src/display/DisplayStateMachine.ts:158**
— Ein OnDisplayPause-Listener, der beim Zurückrollen eines gescheiterten
Starts wirft, verdrängt den Fehler des Start-Listeners

Wirft ein `OnDisplayStart`-Listener, setzt `#initOrRestartThenStart()` die
User-Pause und ruft `#pause()`, das `Pause` mit `emit()` statt `emitStrict()`
emittiert. Wirft dabei auch ein `OnDisplayPause`-Listener, rejected `start()`
mit dessen Fehler; der ursprüngliche Fehler des Start-Listeners geht verloren,
ohne `cause`. Der Zustand bleibt konsistent, weil `PAUSED` vor dem Emit
gesetzt wird. Restgrenze des Fixes für werfende Start-Listener (Commit
`3d8bb8b1`), vom Reviewer als kleiner Befund gemeldet.

Empfehlung: Den Fehler des Pause-Emits im Rollback fangen und beide als
`AggregateError` weiterreichen, oder den Start-Fehler als `cause` anhängen.
Test zuerst.

## Review (Zug 3, 2026-09-24)

Urteil je Finding:

- **PERF-032 — behoben.** `Display.ts:182-197` (`getAnimationOfThree()`), Feld `#stoppedAnimationOfThree`, `#stopAnimationOfThree()`/`#startAnimationOfThree()`; Fortsetzen vor `frameLoop.start` (`Display.ts:1012-1014`), Anhalten nach `frameLoop.stop` und vor dem Emit (`Display.ts:1032-1036`). Tests T1–T3 (`Display.spec.ts`), T10 (`display-lifecycle.test.js:121-142`).
- **BUG-125 — behoben.** Rollback in `DisplayStateMachine.ts:~155-170` wirft `AggregateError([startError, pauseError], …, {cause: pauseError})`. Tests T6, T7 (`Display.spec.ts`), T8 (`DisplayStateMachine.spec.ts:~298-321`).
- **Nebenbefund werfender Pause-Listener beendet die Zustellung — behoben.** `emitStrict` in `DisplayStateMachine.ts:123-124`, `:~149`, `Display.ts:1040-1042`. Tests T4, T5.
- **Nebenbefund Tick ohne Zeitstempel — behoben.** `FrameLoop.ts:84-87`. Test T9.

Kleine Befunde (lösen keine Runde aus):

- `Display.ts:1130-1137` (TSDoc `pause`) und `CHANGELOG.md:65`: »before the first start the loop runs as three started it« ist zweideutig — ein Display, das beim ersten `start()` direkt in die Pause geht, hält die Schleife an (T3); klarer wäre »before the first call of `start()`«.
- `Display.ts:454-455` (Klassen-TSDoc): »an `AggregateError` of both errors« vereinfacht den Fall mehrerer werfender Start-Listener, in dem `errors[0]` selbst ein `AggregateError` ist; die TSDoc von `start()` beschreibt es genau.
- `FrameLoop.ts:84-86`: der Kommentar nennt »after a Display has started the loop again« — `FrameLoop` bekommt damit Wissen über einen Aufrufer; »after something has started the loop again« genügte.
- `DisplayStateMachine.ts:~163`: Meldung des `AggregateError` beginnt mit `start():` — passt für beide Ebenen, nur ein Hinweis.

Nebenbefund des Implementierers → »Offene Befunde« (info, → Scope): TSDoc von `start()` und Punkt 4 der Klassen-TSDoc sagen »throws« nach `dispose()`, `start()` rejected aber. Vorbestehend, liegt in `packages/twopoint5d/src/display/`, die Scope-Regel deckt jede Severity; keine gemeinsame Ursache mit diesem Paket.
