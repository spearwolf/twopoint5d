# Paket 4 — Display-Pause vor dem ersten Start: three-Schleife auch dort anhalten

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-032 (low) — nur der Rest: die Pause vor dem ersten Start, die
  Paket 1 (412f4a66) offen gelassen und Paket 3 (3995236e) als Grenze
  dokumentiert hat. Eingang war der Nebenbefund aus Zug 0 von Paket 3 (Wortlaut
  unten).
- Ziel: `pause` meldet `true` genau dann, wenn auch die rAF-Schleife von three
  ruht, auch vor dem ersten `start()` und wenn ein `stop()` den ersten `start()`
  aufhält.
- Modell: mittlere Stufe (sonnet)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d-testing/test/display-lifecycle.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
  - nicht anfassen: `DisplayStateMachine.ts` (keine neuen Events, keine
    Zustandsänderung), `FrameLoop.ts`
- Vorgehen: siehe Abschnitt »Vorgehen im Einzelnen« unten — Tests zuerst (rot),
  dann der Fix, dann TSDoc, Feldkommentar und CHANGELOG.
- Verify: `pnpm run ci`
  (schneller Zwischenlauf für den Implementierer:
  `pnpm nx test twopoint5d -- src/display/Display.spec.ts`)
- Commit: `fix(display): let the animation loop of three stand still while a display that has not started yet is paused, also when a stop() keeps its first start() from starting it, and let pause = false or the next start() run it again`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · PERF-032 (Rest) unverändert, Fundstellen
    verschoben: frühes Return in `start()` jetzt `Display.ts:1519-1523`,
    Pause-Handler jetzt `:1030-1047` mit `#stopAnimationOfThree()` in `:1040`,
    Grenze in TSDoc `pause` `:1149-1151` und `CHANGELOG.md:47` · Folgen aus
    Paket 1–3: keine offen · »Offene Befunde« leer, nichts zu verteilen ·
    Restplan unverändert (Paket 4 ist das einzige offene Paket, danach Abschluss)
  - 2026-09-24 Zug 1: Implementierer beauftragt, sonnet, effort medium (paket-4.impl-1.json)
  - 2026-09-24 Zug 2: Report FERTIG · Display.ts, Display.spec.ts, display-lifecycle.test.js, CHANGELOG.md geändert · roter Lauf 5/5 vor dem Fix · Arbeitsbaum schmutzig · Verify `pnpm run ci` ohne Nx-Cache exit=0 (paket-4.verify.log)
  - 2026-09-24 Zug 3: Reviewer opus/medium · PERF-032 (Rest) behoben · 1 × klein · Diff paket-4.diff, Report paket-4.review-1.json
  - 2026-09-24 Zug 4: keine Runde nötig (nur kleine Befunde)
  - 2026-09-24 Zug 5: Commit 81ca08de, Verify paket-4.verify.log exit=0 (jünger als die letzte Codeänderung)

## Abgleich gegen den Code (Stand 3995236e)

**Der Sachverhalt besteht unverändert.** `DisplayStateMachine` steht bis zum
ersten Start im Zustand `NEW`. In `NEW` tut `#pausedByUserChanged`
(`DisplayStateMachine.ts:77-91`) nichts: ein `stop()` oder `pause = true`
setzt nur `pausedByUser`, es geht kein `Pause`-Event hinaus. Den einzigen Aufruf
von `#stopAnimationOfThree()` trägt der Pause-Handler (`Display.ts:1040`), und
der läuft nur beim Übergang nach `PAUSED`. Der Getter `pause`
(`Display.ts:1155-1159`) antwortet in `NEW` aus `pausedByUser` und meldet
damit `true`, während three seine Schleife seit dem Ende von `renderer.init()`
weiterlaufen lässt.

Zwei Wege führen dahin:

1. `stop()`/`pause = true` vor dem ersten `start()`, ohne folgenden Start.
2. `stop()`/`pause = true`, während der erste `start()` wartet: `start()` kehrt
   in `Display.ts:1521-1523` früh zurück, die State Machine bleibt in `NEW`.

three 0.185.1 (`node_modules/.pnpm/three@0.185.1/.../src/renderers/common/Renderer.js:767-835`):
`init()` legt `this._animation = new Animation(...)` erst nach
`await backend.init()` an und ruft `this._animation.start()` **vor** dem
`resolve(this)`. Vorher ist `renderer._animation` `null`. Folge für den Fix:
ein `stop()` vor dem Ende der Init findet noch keine Schleife; das Display muss
sie anhalten, sobald `#waitForRenderer` erfüllt ist. `Renderer.dispose()`
ruft `this._animation.dispose()`, das `stop()` aufruft — ein zweites Anhalten
einer schon stehenden Schleife ist harmlos (`cancelAnimationFrame(null)`).

## Triage

- **Einordnung:** Rest von PERF-032. Die Beschreibung des Findings (»Die
  rAF-Schleife von three läuft während einer Pause weiter«) umfasst jede Pause.
  Paket 1 hat die Pausen der State Machine abgedeckt, die Pause des Aufrufers
  vor dem ersten Start nicht; Paket 3 hat diese Grenze nur beschrieben. Der
  Sachverhalt bestand vor dem ersten Commit des Laufs (vor 412f4a66 hielt das
  Display die Schleife nie an), er ist also keine Folge einer Änderung dieses
  Laufs. Deshalb **kein** `Folge von:` im Plan: das Paket ist kein Glied einer
  Folgenkette, und die Generationsregel greift nicht.
- **Buchung für den Abschluss:** PERF-032 gilt erst mit dem Hash dieses Pakets
  als ganz behoben; der Abschluss bucht es mit beiden Hashes (412f4a66 und dem
  dieses Pakets). Deshalb steht PERF-032 in der Zeile `Findings:` dieses Pakets.
  Das verschiebt den Scope nicht: PERF-032 gehört ohnehin zum Lauf.
- **Folgen aus Paket 1–3:** alle drei `Folgen: keine`. Nichts zu verteilen.
- **»Offene Befunde«:** leer. Der einzige Eintrag ist mit diesem Paket aus der
  Queue gewandert.
- **Rückfrage:** keine. Der Weg ist derselbe wie in der Entscheidung zu PERF-032
  (Anhalten über `renderer._animation`, Duck-Typing, Browser-Test als Wächter
  gegen three-Interna); er wird nur auf den Zustand `NEW` ausgedehnt.

## Entscheidungen dieses Pakets (mit Grund)

- **Nur `Display.ts`, keine neuen Events.** Die State Machine bleibt, wie sie
  ist: `OnDisplayPause` vor dem ersten Start wäre eine Verhaltensänderung, und
  mehrere Tests halten fest, dass ein aufgehaltener erster Start keine Events
  sendet (`Display.spec.ts:162-196`, Browser-Test `display-lifecycle.test.js:165`).
  Das Display liest den Zustand selbst: eine private Methode, die in `NEW` die
  Schleife von three dem Wert von `pausedByUser` folgen lässt.
- **Aufgerufen nach jedem Schreiben von `pausedByUser` im Display** (Setter
  `pause`, `stop()`, `start()`) **und einmal, sobald `#waitForRenderer`
  erfüllt ist.** Die Regel ist einfach zu prüfen und deckt auch den Fall ab,
  dass ein Init-Listener wirft: `start()` hat `pausedByUser` dann schon auf
  `false` gesetzt, die State Machine bleibt in `NEW`, `pause` meldet `false` —
  die Schleife muss dann laufen.
- **Kein `#disposed`-Check in der Methode.** `dispose()` ruft `stop()`, solange
  `this.renderer` noch steht. Ein laufendes Display hält die Schleife dabei über
  den Pause-Handler an; ein nie gestartetes tut es jetzt über die neue Methode —
  dasselbe Verhalten für beide, und `pause` meldet nach `dispose()` `true`. Nach
  `dispose()` ist `this.renderer` `undefined`, `#stopAnimationOfThree()` kehrt
  dann sofort zurück; der Weg zu `#startAnimationOfThree()` ist nach `dispose()`
  verschlossen (Setter kehrt bei `#disposed` zurück, `start()` rejected, `stop()`
  setzt nur `true`).
- **Rejection-Zweig am neuen `.then` auf `#waitForRenderer`.** Ohne zweiten
  Handler wäre eine gescheiterte Init hier eine unbehandelte Rejection; berichtet
  wird sie schon über `OnDisplayError` (`.catch` in `:1077-1081`) und `start()`.
- **Reihenfolge nach der Init ist gesichert:** das `.then` wird im Konstruktor
  auf demselben Promise registriert, auf das `start()` später `await`et; die
  Reaktionen laufen in Registrierungsreihenfolge. Die Schleife steht also schon,
  wenn `start()` nach einem `stop()` während des Wartens früh zurückkehrt.
- **CHANGELOG: den bestehenden Eintrag in `[Unreleased]` → `Changed`
  (`CHANGELOG.md:47`) umschreiben, keinen neuen anlegen.** Das Verhalten ist
  unveröffentlicht und stammt aus diesem Lauf; ein zweiter Eintrag würde einen
  »Fix« an etwas melden, das kein Release je hatte.
- **Klassen-TSDoc Punkt 2 (`Display.ts:433-435`) bleibt.** »the animation loop
  of three rests while it pauses as well, see {@link Display.pause}« stimmt
  weiter, die Einzelheiten stehen in `pause`.

## Vorgehen im Einzelnen

Reihenfolge: Schritt 1 (Tests) → roter Lauf → Schritte 2–4 → grüner Lauf →
Schritte 5–7 → `pnpm run ci`.

### 1. Regressionstests zuerst — `Display.spec.ts`

Im `describe('frame loop', …)` direkt hinter dem Test
`'stops the animation loop of three for a display that goes into the pause as it starts'`
(endet bei `:660`) diese fünf Tests einfügen. Helfer (`makeDisplay`,
`settle`, `once`/`on`, `OnDisplayInit`) sind im File vorhanden. Der
Renderer-Stub hat von sich aus kein `_animation`; die Tests setzen es wie die
Nachbartests per `Object.assign`. Wo der Test die Reihenfolge von three
nachbildet, erscheint `_animation` erst am Ende der Init — so wie in three.

```ts
    it('a stop() before the first start() stops the animation loop of three once the renderer is up, and pause = false starts it again once', async () => {
      const animation = {start: vi.fn(), stop: vi.fn()};
      let finishInit!: () => void;
      const {display, renderer} = makeDisplay(
        undefined,
        () =>
          new Promise<void>((resolve) => {
            finishInit = resolve;
          }),
      );

      display.stop();

      // three builds its animation loop at the end of init() and starts it there
      Object.assign(renderer, {_animation: animation});
      finishInit();
      await settle();

      expect(display.pause).toBe(true);
      expect(animation.stop, 'once the renderer is up').toHaveBeenCalledTimes(1);

      display.pause = false;

      expect(animation.start, 'pause = false').toHaveBeenCalledTimes(1);

      display.pause = false;

      expect(animation.start, 'a second pause = false').toHaveBeenCalledTimes(1);
      expect(animation.stop, 'a second pause = false').toHaveBeenCalledTimes(1);
    });

    it('a pause = true before the first start() stops the animation loop of three right away, and start() starts it again once', async () => {
      const {display, renderer} = makeDisplay();
      const animation = {start: vi.fn(), stop: vi.fn()};
      Object.assign(renderer, {_animation: animation});
      await settle();

      display.pause = true;

      expect(animation.stop, 'pause = true').toHaveBeenCalledTimes(1);

      display.pause = true;

      expect(animation.stop, 'a second pause = true').toHaveBeenCalledTimes(1);

      await display.start();

      expect(display.isRunning).toBe(true);
      expect(animation.start).toHaveBeenCalledTimes(1);
      expect(animation.stop).toHaveBeenCalledTimes(1);
    });

    it('a stop() while the first start() waits stops the animation loop of three, and the next start() starts it again once', async () => {
      const animation = {start: vi.fn(), stop: vi.fn()};
      let finishInit!: () => void;
      const {display, renderer} = makeDisplay(
        undefined,
        () =>
          new Promise<void>((resolve) => {
            finishInit = resolve;
          }),
      );

      const started = display.start();
      display.stop();
      Object.assign(renderer, {_animation: animation});
      finishInit();
      await started;

      expect(display.isRunning).toBe(false);
      expect(display.pause).toBe(true);
      expect(animation.stop).toHaveBeenCalledTimes(1);
      expect(animation.start).not.toHaveBeenCalled();

      await display.start();

      expect(display.isRunning).toBe(true);
      expect(animation.start).toHaveBeenCalledTimes(1);
      expect(animation.stop).toHaveBeenCalledTimes(1);
    });

    it('an init listener that throws after a stop() before the first start() leaves the animation loop of three running, as pause answers false', async () => {
      const {display, renderer} = makeDisplay();
      const animation = {start: vi.fn(), stop: vi.fn()};
      Object.assign(renderer, {_animation: animation});
      const error = new Error('init listener');
      on(display, OnDisplayInit, () => {
        throw error;
      });

      display.stop();
      await settle();

      expect(animation.stop).toHaveBeenCalledTimes(1);

      await expect(display.start()).rejects.toBe(error);

      expect(display.isRunning).toBe(false);
      expect(display.pause).toBe(false);
      expect(animation.start).toHaveBeenCalledTimes(1);
    });

    it('dispose() of a display that has not started stops the animation loop of three, as it does for a running display', async () => {
      const {display, renderer} = makeDisplay();
      const animation = {start: vi.fn(), stop: vi.fn()};
      Object.assign(renderer, {_animation: animation});
      await settle();

      display.dispose();

      expect(display.pause).toBe(true);
      expect(animation.stop).toHaveBeenCalledTimes(1);
      expect(animation.start).not.toHaveBeenCalled();
    });
```

Prettier bricht die Aufrufe womöglich anders um — `pnpm format` entscheidet,
der Inhalt bleibt. Roter Lauf vor dem Fix:
`pnpm nx test twopoint5d -- src/display/Display.spec.ts` — alle fünf müssen
rot sein (vor dem Fix ruft nichts `animation.stop` in `NEW`). Die Ausgabe des
roten Laufs gehört in den Report.

### 2. Neue private Methode — `Display.ts`

Direkt **vor** `#stopAnimationOfThree()` (`:1696`) einfügen:

```ts
  // Before its first start the display stands in NEW, where the state machine emits neither start
  // nor pause, so the handlers that stop and start the animation loop of three do not run there.
  // `pause` answers from the pause of the caller alone then, and the loop follows that answer here
  #followPauseBeforeStart(): void {
    if (!this.#stateMachine.isNew) return;
    if (this.#stateMachine.pausedByUser) {
      this.#stopAnimationOfThree();
    } else {
      this.#startAnimationOfThree();
    }
  }
```

`#stopAnimationOfThree()` und `#startAnimationOfThree()` bleiben unverändert:
ihre Wächter (Renderer fehlt, `_animation` fehlt oder ist `null`, ein anderer
Callback steht auf der Schleife, Schleife schon angehalten, nichts zum
Neustarten) tragen auch hier.

### 3. Aufrufe nach jedem Schreiben von `pausedByUser`

- Setter `pause` (`:1161-1168`): nach `this.#stateMachine.pausedByUser = pause;`
  die Zeile `this.#followPauseBeforeStart();`.
- `stop()` (`:1538-1541`): nach `this.#stateMachine.pausedByUser = true;`
  die Zeile `this.#followPauseBeforeStart();`.
- `start()` (`:1525-1526`): zwischen `this.#stateMachine.pausedByUser = false;`
  und `this.#stateMachine.start();`:

  ```ts
      this.#stateMachine.pausedByUser = false;
      // a display its caller paused before this start gets the loop of three back here, also when
      // a listener of init throws below and leaves the display in NEW with pause answering false
      this.#followPauseBeforeStart();
      this.#stateMachine.start();
  ```

Kein Aufruf in `DisplayStateMachine` und keiner in den Handlern `Start`/`Pause`
— dort sorgen `#startAnimationOfThree()`/`#stopAnimationOfThree()` schon.

### 4. Nach der Init — Konstruktor

Im `try`-Block des Konstruktors direkt **vor**
`this.#waitForRenderer.catch((error) => { … })` (`:1077`) einfügen:

```ts
      // three starts its animation loop at the end of renderer.init(), and a stop() or a
      // pause = true that came before found no loop to stop. Registered before any start() awaits
      // the same promise, so the loop already stands still when a start() that such a pause holds
      // up returns
      this.#waitForRenderer.then(
        () => this.#followPauseBeforeStart(),
        () => {
          // a failed init reaches the caller through the error event below and through start()
        },
      );
```

Der bestehende `.catch` darunter bleibt, wie er ist.

### 5. Feldkommentar `#stoppedAnimationOfThree` (`Display.ts:591-593`)

Den dreizeiligen Kommentar über dem Feld ganz durch diesen vierzeiligen
ersetzen (neu ist der Einschub »or while `pause` answered true before its first
start«, der Rest ist nur neu umbrochen):

```ts
  // the animation loop of three this display has stopped as it went into the pause, or while
  // `pause` answered true before its first start, and the only one it starts again: three's
  // Animation.start() does not ask whether its loop runs already, and a second call would run a
  // second rAF chain beside the first
```

### 6. TSDoc `pause` (`Display.ts:1149-1151`)

Den Satz ab »Until the display goes into the pause for the first time, …« bis
»… keeps that call from starting the display.« ersetzen. Neuer Wortlaut, auf
höchstens 100 Spalten umbrochen wie die Nachbarzeilen:

> Before the first start the loop follows `pause` too: a `stop()` or
> `pause = true` stops it — one that comes while `renderer.init()` still runs
> stops it once the init has started it — also when that call keeps the first
> `start()` from starting the display, and a `pause = false` or the next
> `start()` runs it again.

Der Satz davor (»So does a renderer another {@link FrameLoop} still runs on as
the display goes into the pause.«) und alles davor bleiben.

### 7. CHANGELOG (`packages/twopoint5d/CHANGELOG.md:47`, `[Unreleased]` → `Changed`)

Im bestehenden Eintrag »a paused `Display` lets the animation loop of its
renderer rest. …« den Schluss ab »keep their loop running; until the display
goes into the pause for the first time, …« bis zum Zeilenende ersetzen durch:

> keep their loop running. Before the first start the loop follows `pause` as
> well: a `stop()` or `pause = true` stops it — one that comes while
> `renderer.init()` still runs stops it once the init has started it — also
> when that call keeps the first `start()` from starting the display, and
> `pause = false` or the next `start()` runs it again

Derselbe Wortlaut wie in der TSDoc aus Schritt 6, mit Absicht: zwei Fassungen
derselben Grenze laden zu einem Widerspruch ein.

Eine Zeile wie die Nachbareinträge (die Bullets in diesem Abschnitt sind nicht
umbrochen), kein Punkt am Ende (wie der bestehende Eintrag). Skill
`updating-changelog` laden und seine Regeln einhalten; keine Migrationsnotiz —
die öffentliche Signatur ändert sich nicht.

### 8. Browser-Test — `packages/twopoint5d-testing/test/display-lifecycle.test.js`

Direkt hinter dem Test
`'a stop() while start() waits for a real init keeps the display from starting, and the next start() runs'`
(`:165-182`) einfügen. `host`, `display`, `makeContainer`, `animationFrames`
sind im File vorhanden, `afterEach` räumt auf.

```js
  it('a stop() while start() waits for a real init lets the animation loop of three stand still, and the next start() runs it once', async () => {
    host = makeContainer();
    display = new Display(host);

    const started = display.start();
    display.stop();
    await started;

    // three counts the ticks of its own animation loop in info.frame, and nothing else writes it
    const {info} = display.renderer;
    const stoppedAt = info.frame;
    await animationFrames(5);
    expect(info.frame, 'no tick of three before the first start').to.equal(stoppedAt);

    await display.start();
    await display.nextFrame();
    const runningAt = info.frame;
    await animationFrames(10);
    const ticks = info.frame - runningAt;
    expect(ticks, 'three ticks again').to.be.greaterThan(0);
    // one loop ticks once per frame of the page; a second one started on top would tick twice
    expect(ticks, 'one loop of three, not two').to.be.below(15);
  });
```

Ein roter Lauf dieses Browser-Tests vor dem Fix ist **nicht** Pflicht: den
Regressionsbeweis tragen die Vitest-Tests aus Schritt 1, und dass `info.frame`
in dieser Umgebung tickt, zeigt die zweite Hälfte des Tests selbst (wie beim
Test in `:121`). Der Test ist der Wächter gegen ein three-Update, das
`_animation` ändert.

### Was bestehende Tests dazu sagen

Die übrigen Tests in `Display.spec.ts` bleiben grün ohne Änderung: ihre
Renderer-Stubs tragen kein `_animation`, `getAnimationOfThree()` liefert dann
`undefined`, und die neue Methode tut nichts. Die drei bestehenden
`_animation`-Tests (`:591`, `:621`, `:642`) pausieren nicht vor dem ersten
Start; für sie ist `#followPauseBeforeStart()` ein No-op. Muss dort doch etwas
angepasst werden, ist das ein Signal, dass der Fix vom Plan abweicht — im
Report begründen.

### Nicht Teil dieses Pakets

- Ein Display in `NEW`, dessen Tab verborgen ist oder dessen Canvas mit
  `pauseOutsideViewport` außerhalb liegt, meldet `pause === false` (der Getter
  antwortet in `NEW` nur aus der Pause des Aufrufers); die Schleife läuft dort
  weiter, und das deckt sich mit `pause`. Nicht anfassen.
- Keine Änderung an `DisplayStateMachine`, `FrameLoop`, den Events oder der
  TSDoc von `start()`/`stop()`.

## Findings im Volltext

**PERF-032 · low · packages/twopoint5d/src/display/Display.ts** — Die
rAF-Schleife von three läuft während einer Pause weiter
(weitere Fundstelle: `node_modules/three/src/renderers/common/Animation.js:69-91`)

Ein pausiertes Display führt keinen twopoint5d-Code pro Frame mehr aus. three
0.185.1 startet aber in `renderer.init()` eine eigene rAF-Schleife, die bis
`renderer.dispose()` läuft; `setAnimationLoop(null)` nimmt nur den Callback
heraus. Der Tick von three bleibt also bei jeder Refresh-Rate. Grenze des Fixes
aus dem Remediation-Lauf vom 2026-09-24.

Empfehlung: Beobachten, ob three die Schleife stoppbar macht
(`Animation.stop()`), und dann beim Pausieren anhalten; bis dahin in der TSDoc
von `pause` nennen.

(Die Entscheidung im Plan vom 2026-09-24 geht über die Empfehlung hinaus: three
wird über `renderer._animation` wirklich angehalten. Paket 1 hat das für die
Pausen der State Machine umgesetzt; dieses Paket schließt die Pause vor dem
ersten Start.)

**Nebenbefund aus Zug 0 von Paket 3 · info · packages/twopoint5d/src/display/Display.ts:1518-1520**
(jetzt `:1519-1523`) — ein Display, das noch nie in die Pause gegangen ist,
lässt die rAF-Schleife von three laufen, auch wenn `pause` `true` meldet: nach
`stop()`/`pause = true` vor dem ersten `start()` ohne folgenden Start, oder
wenn ein `stop()` während des Wartens den ersten `start()` aufhält (früher
Return, die State Machine bleibt in `NEW`, der Pause-Handler `:1028` (jetzt
`:1030`) mit `#stopAnimationOfThree()` läuft nie) · vorbestehend · ein Fix
zieht TSDoc `pause` und `CHANGELOG.md:47` mit, die nach Paket 3 genau diese
Grenze nennen.

## Urteil des Reviewers (Zug 3)

- **PERF-032 (Rest): behoben.** `#followPauseBeforeStart()` in
  `packages/twopoint5d/src/display/Display.ts:1714-1724`, Aufrufe im Setter
  `pause` (`:1181`), in `stop()` (`:1558`) und in `start()` (`:1541`), `.then`
  auf `#waitForRenderer` im Konstruktor (`:1082-1087`); Feldkommentar
  `:591-594`, TSDoc `pause` `:1161-1164` wortgleich mit `CHANGELOG.md:47`;
  Vitest-Tests `Display.spec.ts:662`, `:693`, `:714`, `:743`, `:764`,
  Browser-Test `display-lifecycle.test.js:184`. `DisplayStateMachine.ts` und
  `FrameLoop.ts` unberührt. Konventionen eingehalten, Commit-Message geprüft.

Kleine Befunde:

- `packages/twopoint5d/src/display/Display.ts:1720` (TSDoc `pause`
  `:1159-1161`) — ein nie gestartetes Display hält jetzt auch die Schleife eines
  vom Aufrufer übergebenen Renderers an; setzt der Aufrufer danach selbst
  `renderer.setAnimationLoop(cb)`, bekommt er bis zum Lauf des Displays keine
  Ticks. Der Kommentar in `:1733-1735` nennt diese Grenze für `PAUSED` schon,
  die TSDoc von `pause` nennt nur einen Renderer, auf dem bereits ein anderer
  `FrameLoop` läuft, nicht einen Callback, der erst nach dem Anhalten gesetzt
  wird.
