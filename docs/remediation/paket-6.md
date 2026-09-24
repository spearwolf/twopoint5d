# Paket 6 — Offene Befunde der Display-Domäne: Chronometer, Pause-Zustand, FrameLoop-Felder, TSDoc

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (kein Audit-Finding) · die zehn Einträge der Befund-Queue mit `→ Paket 6`, dazu
  in Zug 0 aufgenommen: dieselbe Ursache an weiteren Stellen (siehe »Abgleich«)
- Ziel: Chronometer, Pause-Zustand und State-Machine verhalten sich in den Randfällen so, wie
  ihre TSDoc es sagt, `FrameLoop` exponiert seinen Zustand nur lesbar, und TSDoc,
  Spec-Kommentare und CHANGELOG der Display-Domäne stimmen mit dem Code überein.
- Modell: stärkste Stufe — öffentliche API (Breaking Change an `FrameLoop`), Wiedereintritt in
  der State-Machine und rund zwanzig TSDoc-Stellen, deren Wortlaut das Verhalten genau treffen
  muss; die Pakete 2 und 4 brauchten für TSDoc- und CHANGELOG-Wortlaut Nachrunden
- Effort: medium — Werte, Namen und Texte stehen hier; mehr Effort verleitet zu Verbesserungen
  außerhalb des Plans
- Dateien:
  - `packages/twopoint5d/src/display/Chronometer.ts`, `Chronometer.spec.ts`
  - `packages/twopoint5d/src/display/DisplayStateMachine.ts`, `DisplayStateMachine.spec.ts`
  - `packages/twopoint5d/src/display/Display.ts`, `Display.spec.ts`
  - `packages/twopoint5d/src/display/FrameLoop.ts`, `FrameLoop.spec.ts`
  - `packages/twopoint5d/src/display/FixedFrameLoop.ts` (nur eine Kommentarzeile)
  - `packages/twopoint5d/src/display/types.ts` (nur TSDoc)
  - `packages/twopoint5d/CHANGELOG.md` (nur unter `[Unreleased]`)
  - keine Browser-Tests: nichts davon ist Rendering- oder GPU-Code, und kein Browser-Test liest
    `display.pause` vor dem ersten Start, einen `FrameLoop`-Wert oder eine Restart-Verschachtelung
    (geprüft: `display-lifecycle.test.js:133`, `:171` lesen `pause` nur in einer echten Pause)
  - keine Lookbook- oder Testaufrufer der `FrameLoop`-Felder: `grep` über `packages/` und `apps/`
    findet keinen Lese- oder Schreibzugriff auf `frameNo`, `now`, `deltaTime`, `measuredFps` eines
    `FrameLoop` oder auf ein Feld von `RAF`; die Specs lesen nur die Props von `FrameLoop.OnFrame`
- Folge von: Paket 4 — nur für `FixedFrameLoop.ts:285` (Schritt 7; zweite Generation). Alle
  übrigen Teile sind Nebenbefunde, die vor dem ersten Commit dieses Laufs schon bestanden.
- Verify: `pnpm run ci`
- Commit: `fix(display): keep the chronometer from running backwards when start() or stop() gets a time before the latest one, let Display#pause answer true for a display stopped before its first start and for every disposed one, let a start() from an init or restart listener of the state machine add no nested restart, make FrameLoop#frameNo, #now, #deltaTime and #measuredFps read-only and keep the fields of the rAF driver private, and bring the lifecycle, resize and size TSDoc, two overlong comment lines and the heading of the FrameLoop event key migration note in line with the code`

## Vorgehen

Regressionstests zuerst, rot sehen, dann beheben — für die Schritte 1, 2, 3 und 4. Einzelne
Spec-Datei: `pnpm nx test twopoint5d -- src/display/<Datei>.spec.ts`. Der rote Lauf je Schritt
gehört in den Report. Kommentare und TSDoc in Englisch, Zeilen höchstens 100 Zeichen (auch
einzeilige `/** … */`), keine Wendung über einen Vorzustand, keine Finding-IDs.

### 1. `Chronometer`: `start(time)` und `stop(time)` lassen die Zeit nicht zurücklaufen

Ursache: `start()` setzt `#currentTime = now` (`Chronometer.ts:155`), `stop()` setzt
`#pausedAt = getCurrentTime(time)` (`:129`), beide ohne Klemme gegen `#currentTime`. `update()`
klemmt schon (`:98-102`).

Regressionstests in `Chronometer.spec.ts`, ans Ende des äußeren `describe`, neben die beiden
`update()`-Fälle ab `:277` — vor dem Fix rot:

1. `a start() with a time before the stop lets no time run backwards` —
   `new Chronometer(0)`, `update(1000)`, `stop(1000)`, `const time = chronus.time` (1000),
   `start(990)` → `time` bleibt `1000` (vor dem Fix `990`); danach `update(1010)` →
   `deltaTime === 10`, `time === 1010`.
2. `a stop() with a time before the current one lets no time run backwards at the next start()` —
   `new Chronometer(0)`, `update(1000)`, `stop(990)`, `start(1000)` → `time === 1000` (vor dem
   Fix `990`, weil `lostTime` die zehn Einheiten zwischen 990 und 1000 bucht).
3. `a start() with a time before the last update() of the pause lets no time run backwards` —
   `new Chronometer(0)`, `update(1000)`, `stop(1000)`, `update(1010)`, `const time =
   chronus.time` (1000), `start(1005)` → `time` bleibt `1000` (vor dem Fix `995`).

Fix in `Chronometer.ts`:

- `stop()`: `this.#pausedAt = Math.max(getCurrentTime(time), this.#currentTime);`
- `start()`: `const now = Math.max(getCurrentTime(time), this.#currentTime);`
- Je ein kurzer Inline-Kommentar über der Zeile, sinngemäß: a time before the latest one the
  chronometer has seen counts as that one, as in `update()` — time does not run backwards.
- TSDoc von `stop()` und `start()` je um einen Satz ergänzen: »A `time` before the latest one the
  chronometer has seen counts as that one: time does not run backwards.« In `start()` wird
  »the internal "current time" is advanced to `time`« dabei nicht falsch: es wird vorgerückt,
  nie zurückgesetzt — so formulieren, dass beides stimmt.

Gegenprobe, die grün bleiben muss (von Hand nachgerechnet): `stop()/start() with the same
timestamp is a zero-length pause` (`:167`), `hybrid pause …` (`:178`), `idempotency` (`:194-216`),
`reset()` (`:250-275`).

CHANGELOG: den Eintrag `CHANGELOG.md:217` in place erweitern — »fix `Chronometer#update()`,
`#start()` and `#stop()` with a time before the latest one the chronometer has seen: `deltaTime`
is `0` and `time` stays where it is, across a pause as well, so `FixedFrameLoop#alpha` …« (Rest
des Satzes bleibt).

### 2. `Display#pause` meldet auch vor dem ersten Start, was geschrieben wurde

Ursache: `get pause()` (`Display.ts:1035-1037`) liest nur `state === PAUSED`. Ein Display im
Zustand `NEW` mit `pausedByUser` — nach `stop()` oder `pause = true` vor dem ersten Start, nach
einem gewonnenen `start(); stop()` (der Start endet in `Display.ts:1381-1383` ohne Übergang), nach
`dispose()` eines nie gestarteten Displays — meldet `false`.

Regressionstests in `Display.spec.ts`, im `describe('start()')` nach
`a stop() before start() does not keep start() from starting the display` (`:207-215`) — vor dem
Fix rot:

1. `a display stopped before its first start answers pause = true, and false after pause = false`
   — `makeDisplay()`, `display.stop()` → `display.pause === true`; `display.pause = false` →
   `display.pause === false`; `display.pause = true` → `true`.
2. `a stop() while start() waits keeps pause at true` — `const started = display.start();
   display.stop(); await started;` → `display.pause === true`, `display.isRunning === false`.

3. `a disposed display that never ran answers pause = true` — direkt nach Test 2:
   `makeDisplay()`, `display.dispose()` → `display.pause === true` (vor dem Fix `false`).
   `afterEach` ruft ein zweites `dispose()`, das nichts tut.

Fix: `get pause()` gibt `this.#stateMachine.isPaused || this.#stateMachine.pausedByUser` zurück.
Begründung, warum das genügt: im Zustand `RUNNING` ist `pausedByUser` nie gesetzt (der Setter
führt sofort in die Pause), im Zustand `PAUSED` ist das Ergebnis ohnehin `true`; nur `NEW` ändert
sich. Ein verstecktes Tab vor dem ersten Start bleibt `false` — das Display ist dann nicht
pausiert, sondern noch nicht gestartet.

TSDoc von `pause` (`Display.ts:1028-1034`) neu, sinngemäß:

> Whether the display is paused: `true` while it holds in the pause — through `pause = true`,
> {@link Display.stop}, a hidden tab or, with {@link DisplayParameters.pauseOutsideViewport}, a
> canvas outside the viewport —, and before the first start once `stop()` or `pause = true` has
> been called and no `pause = false` since. A write sets the pause the caller asks for; see
> {@link Display.start} for how it meets a pending start.
>
> After {@link Display.dispose} a write does nothing, and the getter answers `true`.

Klassen-TSDoc, Punkt 4 (`Display.ts:402-417`): in die Aufzählung dessen, was ein entsorgtes
Display meldet, »{@link Display.pause} answers `true`« aufnehmen (neben »{@link Display.isRunning}
is `false`«).

CHANGELOG:
- `CHANGELOG.md:125` in place: »and the `pause` getter keeps reading the state the display was
  left in« → »and the `pause` getter answers `true`«.
- Neuer `### Fixed`-Eintrag direkt nach `:216`: »fix `Display#pause` before the first start: once
  `stop()` or `pause = true` has been called it answers `true` — also when that call keeps a
  pending `start()` from starting the display — until a `pause = false` or the next `start()` lets
  the display run«.

### 3. `DisplayStateMachine`: ein `start()` aus einem Listener von `Init` oder `Restart` tut nichts

Ursache: `#initOrRestartThenStart()` (`DisplayStateMachine.ts:131-151`) emittiert `Init` bzw.
`Restart`, während der Zustand noch `NEW` bzw. `PAUSED` ist. Ein `start()` aus einem dieser
Listener läuft verschachtelt durch denselben Pfad: aus einem Init-Listener kommt `Init`, `Restart`,
`Start` — ein `Restart` ohne vorherigen `Start` oder `Pause` (der Queue-Eintrag); aus einem
Restart-Listener, der pausiert und wieder freigibt, kommt `Restart`, `Restart`, `Start`. Über
`Display` ist nur der zweite Fall erreichbar (`pause = true; pause = false` in einem
`OnDisplayRestart`-Listener), der erste nicht, weil `Display#start()` erst nach einem `await` die
State-Machine startet. Beide Fälle haben eine Ursache und bekommen eine Regel.

Entscheidung in Zug 0: die Regel gilt für `Init` **und** `Restart`. Nur `Init` abzudecken ließe
den über `Display` erreichbaren Fall mit doppeltem `OnDisplayRestart` stehen. Die Regel: solange
die Listener von `Init` oder `Restart` laufen, tut `start()` nichts; der Aufruf, der das Ereignis
emittiert hat, liest danach die Eingänge und emittiert genau ein `Start` oder `Pause`. Damit kann
innerhalb dieser Listener kein Übergang mehr stattfinden (Eingangsänderungen bewegen in `NEW`
nichts, `#pause()` ist in `PAUSED` wirkungslos, `start()` ist gesperrt), und der Zähler
`#transitions` wird gegenstandslos.

Regressionstests — vor dem Fix rot:

1. `DisplayStateMachine.spec.ts`, neu nach `:168`: `an init listener that calls start() gets no
   restart: init, then start` — `once(stateMachine, Init, () => stateMachine.start())`,
   `stateMachine.start()` → `events` `[Init, Start]` (vor dem Fix `[Init, Restart, Start]`),
   `state === RUNNING`.
2. `Display.spec.ts`, im `describe('start()')` nach `a stop() inside a restart listener holds the
   display in the pause` (`:236-257`): `a pause = true and a pause = false inside a restart
   listener restart the display once` — `await display.start(); display.pause = true;
   events.length = 0; once(display, OnDisplayRestart, () => { display.pause = true;
   display.pause = false; }); display.pause = false;` → `events` `[OnDisplayRestart,
   OnDisplayStart]` (vor dem Fix `[OnDisplayRestart, OnDisplayRestart, OnDisplayStart]`),
   `display.isRunning === true`.

Fix in `DisplayStateMachine.ts`:

- `#transitions` samt Kommentar (`:123-125`) und beiden Inkrementen (`:117`, `:143`) sowie die
  Zeilen `const transitions = …` (`:132`) und `if (this.#transitions !== transitions) return;`
  (`:141`) entfernen.
- Neues privates Feld `#emittingInitOrRestart = false`, mit Kommentar sinngemäß: set while the
  listeners of Init or Restart run; a `start()` from one of them does nothing, because the call
  that emitted the event reads the inputs once they are through and emits the one Start or Pause
  that follows — a nested start would emit a Restart before either.
- `#initOrRestartThenStart()`: Flag setzen, `this.#initOrRestart()` in `try`, Flag im `finally`
  zurück; danach wie bisher `#isPaused()` lesen und `PAUSED` + `Pause` oder `RUNNING` + `Start`.
  Den Kommentar über dem Lesen (`:135-140`) neu fassen: die Listener laufen in `NEW` oder
  `PAUSED`, wo eine Eingangsänderung nichts bewegt und `start()` nichts tut; deshalb werden die
  Eingänge hier gelesen — eine Pause, die ein Listener verlangt hat, hält, und wer Init oder
  Restart gehört hat, hört als Nächstes Pause. Der Satz über verschachtelte Neustarts entfällt.
- `start()`: als erste Zeile `if (this.#emittingInitOrRestart) return;`.

Tests gegen das alte Verhalten, die mitgezogen werden:

- `DisplayStateMachine.spec.ts:185-203` `a restart listener that pauses and un-pauses restarts the
  state machine once, with one start`: Erwartung `[Restart, Start]`, `state === RUNNING`. Die
  Variable `toggled` und ihr Kommentar (»the toggle below restarts from inside this listener,
  which the restart reaches again«) entfallen; `once` statt `on` genügt.
- `DisplayStateMachine.spec.ts:205-230` `a restart listener whose nested restart ends in a new
  pause leaves that pause as the only one`: Erwartung `[Restart, Pause]`, `state === PAUSED`. `toggled` und der Kommentar über `expect` (`:221-222`) entfallen.
  Neuer Titel: `a restart listener that pauses, un-pauses and pauses again holds the state
  machine in the pause`.

TSDoc von `Display#start()` (`Display.ts:1336-1340`): nach »…holds the display in the pause:
`OnDisplayPause` follows instead of `OnDisplayStart`.« einen Satz anhängen: »A `pause = false`
after it in the same listener lets the display start, with one `OnDisplayRestart`.« — oder
gleichwertig; es muss dastehen, dass kein zweites `OnDisplayRestart` kommt.

CHANGELOG `:215` in place ergänzen: »…and a later `pause = false` starts the display again; a
`pause = false` after it inside the same listener lets the display start with a single
`OnDisplayRestart`«.

### 4. `FrameLoop`: `frameNo`, `now`, `deltaTime`, `measuredFps` nur lesbar; `RAF` privat

Entscheidung des Nutzers (Plan, »Entscheidungen«, 2026-09-24): Getter wie bei `Display`, Breaking
Change unter `[Unreleased]` mit CHANGELOG- und Migration-Guide-Eintrag.

Regressionstest in `FrameLoop.spec.ts`, als eigener Fall im äußeren `describe` nach
`carries its event keys under a namespaced symbol` (`:289`) — vor dem Fix rot (die Felder liegen
auf der Instanz, der Prototyp hat keinen Deskriptor): `frameNo, now, deltaTime and measuredFps are
accessors without a setter` — nach dem Muster von `Display.spec.ts:617-632`:
`Object.getOwnPropertyDescriptor(FrameLoop.prototype, name)` hat `get`, kein `set`; ein Schreiben
über `(loop as unknown as Record<string, unknown>)[name] = 1` wirft `TypeError`; der Wert danach
ist der vorherige.

Fix in `FrameLoop.ts`:

- `FrameLoop` (`:197-200`): die vier Felder werden `#frameNo = 0`, `#now = 0`, `#deltaTime = 0`,
  `#measuredFps = 0`; `#onRAF` (`:257-290`) schreibt und liest die privaten Felder. Dazu vier
  Getter mit Rückgabetyp `number` und TSDoc:
  - `frameNo`: the number of frames this loop has emitted — `0` before the first, one more with
    every frame it emits; a frame `maxFps` holds back does not count.
  - `now`: the rAF timestamp of the frame this loop emitted last, in milliseconds; `0` before the
    first. `FrameLoop.OnFrame` carries it in seconds.
  - `deltaTime`: the milliseconds between the last two frames this loop emitted; `0` for the
    first. `FrameLoop.OnFrame` carries it in seconds.
  - `measuredFps`: the frame rate the rAF driver has measured, as of the frame this loop emitted
    last; `0` until the driver has measured its first window.
- `RAF` (`:47-54`, modulintern, nicht exportiert): `frameNo`, `measureOnFrame`,
  `measureTimeBegin`, `measuredFps`, `measuredFpsCollection` werden `#`-Felder; `measureTimeEnd`
  entfällt und wird in `measureFps()` durch `now` ersetzt (es wird nur in der Zeile nach seiner
  Zuweisung gelesen, `:130-131`); `measureFps()` wird `#measureFps()`. `start()`, `stop()`,
  `attach()`, `detach()` und `static get()` bleiben öffentlich (FrameLoop und `resetRAF()` rufen
  sie). Kein CHANGELOG-Eintrag für `RAF`: die Klasse ist nicht exportiert.

CHANGELOG:
- `### Changed`, neuer Eintrag direkt nach `:140` (dem zu `Display#renderer`, `#frameLoop`,
  `#frameNo`): »`FrameLoop#frameNo`, `#now`, `#deltaTime` and `#measuredFps` are read-only
  accessors on the prototype: a write is a type error and throws a `TypeError` at runtime. The
  loop counts and measures them itself; `now` and `deltaTime` are in milliseconds, the props of
  `FrameLoop.OnFrame` carry both in seconds — see the migration guide«.
- `### Migration Guide`, neuer Abschnitt direkt nach »`Display#renderer`, `#frameLoop` and
  `#frameNo` are read-only« (`:894-916`), vor »`postFixID` and `globalStylesID` are gone«:
  `#### \`FrameLoop#frameNo\`, \`#now\`, \`#deltaTime\` and \`#measuredFps\` are read-only`, ein
  Absatz im Stil des Abschnitts darüber (die Schleife zählt und misst selbst; wer von einem
  eigenen Punkt an zählt, merkt sich den Stand dort), dann **Before**
  (`display.frameLoop.frameNo = 0;`) und **After** (`const firstFrame =
  display.frameLoop.frameNo;` und später `const frames = display.frameLoop.frameNo - firstFrame;`).
  Code-Blöcke als schlichtes `ts`, wie im Abschnitt darüber.

### 5. Klassen-TSDoc »Lifecycle«, Punkt 2

`Display.ts:380-381` beschreibt nur den Start bei sichtbarem Tab und Canvas. Nach dem ersten Satz
(»…and begins emitting `OnDisplayRenderFrame`.«) einfügen, sinngemäß:

> While the tab is hidden — or, with {@link DisplayParameters.pauseOutsideViewport}, while the
> canvas is out of view — the display goes into the pause instead and fires `OnDisplayPause`;
> `OnDisplayInit` and `OnDisplayStart` follow once it can run. A {@link Display.stop} or a
> `pause = true` that comes in while `start()` waits keeps the display from starting.

Die Aussagen müssen mit `Display#start()`-TSDoc (`:1342-1353`) übereinstimmen; dort stehen sie
ausführlich.

### 6. Resize- und Größen-TSDoc: »exactly once per frame« und »each frame«

Zwei Aussagen stimmen nicht: `OnDisplayResize` gehe »exactly once« je Frame hinaus — ein eigener
`resize()` zwischen zwei Frames emittiert zusätzlich, ein Frame ohne Änderung gar nicht —, und die
Größe werde »each frame« neu gemessen — mit `resizePollIntervalMs > 0` misst `resize()` höchstens
einmal je Intervall (`Display.ts:1101-1107`); Quelle, Attribut und Callback werden dann nicht
gelesen. `resize()` selbst läuft weiter in jedem Frame; das bleibt so stehen (`:421`, `:558`,
`:1068`).

Begriff für alle Stellen: eine **measurement** von `resize()` — at the start of every frame,
unless `resizePollIntervalMs` is above `0` and less than that has passed since the last one.

a) Klassen-TSDoc »Resize model«, `Display.ts:420-424`: »…so the canvas size, the `THREE` renderer
   size and the `pixelRatio` are always re-evaluated against the current DOM/window state on the
   next frame.« → sagt, dass `resize()` am Anfang jedes Frames läuft und dort misst, außer
   {@link Display.resizePollIntervalMs} hält die Messung zurück, und dass Größe, Renderergröße
   und `pixelRatio` mit jeder Messung neu gegen DOM/Fenster ausgewertet werden.
b) `:432` »The size source is resolved in this priority order, on every `resize()`:« → »…, with
   every measurement:«.
c) `:455` »…it is called every frame and…« → »…it is called with every measurement and…«.
d) `:477-484` ersetzen, sinngemäß:

   > `OnDisplayResize` goes out from a {@link Display.resize} whose measurement changes the size,
   > the pixel ratio or the pixel zoom, once the first frame has begun (`frameNo > 0`) — the call
   > at the start of a frame, or one of your own in between, which emits on its own. The first
   > rendered frame emits it in any case, exactly once: where its `resize()` has not,
   > {@link Display.renderFrame} does, so listeners attached before `start()` receive the initial
   > size. The constructor's initial `resize()` does **not** emit, because `frameNo` is still `0`
   > — `OnDisplayResize` is also `retain`ed, so subscribers attaching after the first frame still
   > receive the latest size on subscription.

e) `#didEmitResize` (`:544-550`): der Satz »guarantees that `OnDisplayResize` fires exactly once
   on the first frame and exactly once per subsequent frame in which the resize hash actually
   changed« → nur noch: read by `renderFrame()` to decide whether the first frame still needs its
   fallback emit, so the first frame emits `OnDisplayResize` exactly once.
f) `width` / `height` (`:597-609`), je sinngemäß:

   > The width of the display in CSS pixels — divided by {@link Display.pixelZoom} while that is
   > above `0`, and rounded down —, as the last measurement of {@link Display.resize} left it. The
   > events of the display carry it as `width`. It follows the size source with every
   > measurement: at the start of every frame, or less often with
   > {@link Display.resizePollIntervalMs}.

   (Für `height` entsprechend.) Nachgeprüft an `#applyMeasuredSize()` `:1236-1247`: `#width` ist
   `wPx` bzw. `wPx / pixelZoom`, danach `Math.floor`; `wPx` ist die CSS-Breite nach Innenabständen
   und MaxResolution-Klemme, nicht die Breite des Drawing Buffers.
g) `resizeToElement` (`:638-639`) »…drives the canvas size each frame…« → »…with every
   measurement of {@link Display.resize}…«.
h) `resizeToCallback` (`:658-659`) »…it is invoked at the start of each frame…« → »…it is invoked
   with every measurement of {@link Display.resize} — at the start of each frame, unless
   {@link Display.resizePollIntervalMs} spaces the measurements out —…«.
i) `resizeToAttributeEl` (`:676`) »…consults each frame…« → »…consults with every
   measurement…«.
j) `types.ts`: `resizeTo` (`:63`) »…it is called for each frame…«, `resizeToElement` (`:73`)
   »…at the beginning of each frame…«, `resizeToAttributeEl` (`:79`) »At the beginning of each
   frame…« — je auf »with every measurement of {@link Display.resize} (every frame, unless
   {@link Display.resizePollIntervalMs} spaces them out)« umstellen. `Display` ist dort als Typ
   importiert (`types.ts:2`), der Link löst auf.

Nicht anfassen: `renderFrame()`-TSDoc (`:1301-1306`) und der Kommentar `:1323-1326` stimmen;
`CHANGELOG.md:2993` steht in `[0.20.0]` und ist veröffentlicht.

### 7. Zwei einzeilige TSDoc-Zeilen über 100 Zeichen

- `FrameLoop.spec.ts:371` (109 Zeichen) — auf einen mehrzeiligen `/** … */`-Block umbrechen,
  Wortlaut bleibt.
- `FixedFrameLoop.ts:285` (101 Zeichen, aus Paket 4) — ebenso, im Stil des Blocks über
  `onRender` (`:288-291`).

Prüfkommando, das danach nichts mehr findet (es kennt `/**` am Zeilenanfang):
`awk 'length($0) > 100 && ($0 ~ /^[[:space:]]*(\/\/|\*|\/\*\*)/) {print FILENAME":"FNR}' packages/twopoint5d/src/display/*.ts`

### 8. CHANGELOG-Überschrift im Migration Guide

`CHANGELOG.md:1799` »#### The event keys of `FrameLoop` carry the library namespace« → »#### The
event key of `FrameLoop` carries the library namespace«. Veröffentlicht ist nur
`FrameLoop.OnFrame`; der Absatz darunter (`:1801`) spricht schon von einem Schlüssel. Der Abschnitt
steht unter `[Unreleased]` (erste Release-Überschrift `[0.21.2]` bei `:2314`).

### Abschluss des Implementierers

- `pnpm run ci` grün.
- Keine Datei außerhalb der Liste oben, außer was eine Änderung hier umwirft (dann im Report).

## Abgleich (Zug 0, 2026-09-24, gegen d38cc402)

| Queue-Eintrag | Befund jetzt | Schritt |
| --- | --- | --- |
| `Chronometer.ts:145-160` | unverändert, `start()` jetzt `:146-158`; dieselbe Ursache in `stop()` `:125-131` (nachgerechnet: `update(1000); stop(990); start(1000)` → `time` 990), aufgenommen | 1 |
| `Display.ts:785` (`get pause()`) | verschoben, jetzt `:1035-1037`, Inhalt unverändert | 2 |
| `Display.ts:218` (Lifecycle-TSDoc) | verschoben, jetzt `:380-381`, unverändert | 5 |
| `DisplayStateMachine.ts:131-162` | unverändert; dieselbe Ursache beim Restart-Listener, von `DisplayStateMachine.spec.ts:185-230` als Verhalten festgehalten und über `Display` erreichbar, aufgenommen | 3 |
| `Display.ts:376`/`:447` (»exactly once«) | verschoben, jetzt `:477-484` und `:544-550`, unverändert | 6d, 6e |
| `Display.ts:557-567` (`width`/`height`) | verschoben, jetzt `:597-609`; dieselbe Ursache (»each frame« trotz `resizePollIntervalMs`) in `Display.ts:420-424`, `:432`, `:455`, `:638-639`, `:658-659`, `:676` und `types.ts:63`, `:73`, `:79`, aufgenommen | 6 |
| `FrameLoop.ts:197-200` | unverändert; Nutzerentscheidung vom 2026-09-24 | 4 |
| `FrameLoop.ts:47` (`RAF`-Felder) | unverändert, `:47-54` | 4 |
| `FrameLoop.spec.ts:371` | unverändert, 109 Zeichen; dieselbe Ursache in `FixedFrameLoop.ts:285` (101 Zeichen, aus 78ee4952 — Folge von Paket 4, Symptom derselben Ursache, mit diesem Paket zusammengelegt statt eines Nachtragspakets für eine Zeile) | 7 |
| `CHANGELOG.md:1799` | unverändert, unter `[Unreleased]` | 8 |

Vorbestehend (gegen aa6dcc4e nachgesehen): die Restart-Verschachtelung gab es schon, dort sogar
mit doppeltem `Start` (`start()` ohne Zähler); `Chronometer#start()`/`#stop()` stammen aus
Commits vor dem Lauf.

Nicht aufgenommen: die beiden Queue-Einträge aus Paket 5 zu `display-resize.test.js`
(`:218-225`, `:85`/`:195`/`:488`) — Test-Hygiene einer Browser-Testdatei, die dieses Paket nicht
ändert, eine andere Ursache; sie bleiben für die Drain-Runde des Abschlusses.

## Findings im Volltext

Kein Audit-Finding. Die Einträge aus »Offene Befunde« im Plan, wörtlich, mit der Fundstelle von
heute:

**`packages/twopoint5d/src/display/Chronometer.ts:146-158` · low (Paket 1)** — `start(time)` setzt
`#currentTime` ohne Klemme: nach `stop(1000)` schiebt `start(990)` die Zeit zurück, `time` wird
kleiner; das `Display` füttert beide mit `performance.now()` und trifft es nicht, andere Nutzer
des öffentlichen `Chronometer` schon.

**`packages/twopoint5d/src/display/Display.ts:1035` · low (Paket 1)** — `get pause()` prüft nur
`state === PAUSED`: ein gestopptes, nie gestartetes Display (Zustand `NEW`, `pausedByUser`
gesetzt) meldet `pause === false`, auch nach einem gewonnenen `start(); stop()`.

**`packages/twopoint5d/src/display/Display.ts:380` · info (Paket 1)** — Klassen-TSDoc
»Lifecycle«, Punkt 2: »`await display.start()` — awaits renderer init, fires `OnDisplayInit`
(once), then `OnDisplayStart`« beschreibt nur den Start bei sichtbarem Tab und Canvas; die TSDoc
von `start()` nennt die Pause-Fälle richtig.

**`packages/twopoint5d/src/display/DisplayStateMachine.ts:131-162` · info (Paket 1)** — ein
Init-Listener, der synchron `stateMachine.start()` ruft, bekommt `Restart` direkt nach `Init`,
ohne vorherigen Start; `Display` löst das nicht aus (`start()` läuft erst nach einem `await`
weiter).

**`packages/twopoint5d/src/display/Display.ts:477` (und `:548`) · low (Paket 2)** — Klassen-TSDoc
»Resize model«: »`OnDisplayResize` is emitted **exactly once** per frame«; ein manueller
`resize()` zwischen zwei Frames emittiert zusätzlich.

**`packages/twopoint5d/src/display/Display.ts:597-609` · info (Paket 4)** — TSDoc von
`width`/`height` sagt »recalculated for each frame«; bei gesetztem `resizePollIntervalMs` stimmt
das nicht (gleiche Ursache wie der Eintrag zu »exactly once«).

**`packages/twopoint5d/src/display/FrameLoop.ts:197-200` · low (Paket 4)** — `frameNo`, `now`,
`deltaTime` und `measuredFps` von `FrameLoop` sind öffentlich schreibbare Instanzfelder, dieselbe
Art wie die drei, die Paket 4 an `Display` nur lesbar gemacht hat. Nutzer 2026-09-24: nur lesbar
machen.

**`packages/twopoint5d/src/display/FrameLoop.ts:47` · info (Paket 4)** — `RAF#frameNo` und die
`measure*`-Felder des modulinternen `RAF` sind schreibbar.

**`packages/twopoint5d/src/display/FrameLoop.spec.ts:371` · info (Paket 4)** — einzeilige TSDoc
mit 109 Zeichen, über der Breite der Umgebung; der awk-Check aus Paket 4 kennt `/**` am
Zeilenanfang nicht.

**`packages/twopoint5d/CHANGELOG.md:1799` · info (Paket 4)** — Überschrift im Migration Guide
»The event keys of `FrameLoop` carry the library namespace« spricht von mehreren Schlüsseln,
veröffentlicht ist nur `FrameLoop.OnFrame`.

## Verlauf

- 2026-09-24 Zug 0: Detailplan steht (8 Schritte) · alle zehn Queue-Einträge bestehen noch,
  sieben an verschobenen Zeilen (Tabelle »Abgleich«) · aufgenommen wegen derselben Ursache:
  `Chronometer#stop()`, Restart-Verschachtelung der State-Machine, »each frame« an neun weiteren
  TSDoc-Stellen in `Display.ts`/`types.ts`, `FixedFrameLoop.ts:285` (Folge von Paket 4) · keine
  offenen `Folgen:` aus erledigten Paketen · die zwei Test-Hygiene-Einträge aus Paket 5 bleiben
  in der Queue · Modell stärkste Stufe, Effort medium
- 2026-09-24 Zug 1 (B): Implementierer beauftragt, opus/medium, Brief `paket-6.impl-1.brief.txt`, Report `paket-6.impl-1.json`
- 2026-09-24 Zug 2 (B): Report FERTIG, 11 Dateien in `src/display/` und `CHANGELOG.md` geändert, Arbeitsbaum schmutzig · rote Läufe: Chronometer 3/23, DisplayStateMachine 1/10, Display 4/31 (Restart-Test mit `RangeError: Maximum call stack size exceeded` statt doppeltem Restart), FrameLoop 1/25 · eigener Verify `paket-6.verify.log` exit=0 · Nebenbefunde `Display.ts:665` und `types.ts:16` dieselbe Ursache wie Schritt 6 → in dieses Paket (Runde nach dem Review)
- 2026-09-24 Zug 3 (B): Reviewer beauftragt, opus/medium, Diff `paket-6.diff` (1284 Zeilen), Report `paket-6.review-1.json`
- 2026-09-24 Zug 3 (B): Review 1 — alle Befunde der Schritte 1–8 behoben mit Fundstelle · wichtig: `Display.ts:665`, `types.ts:16` (»each frame«/»once per resize()« trotz Poll-Intervall) · klein: Lifecycle-Punkt 2 Viewport-Fall ohne Observer-Vorbehalt, `FrameLoop.spec.ts:295` prüft die Getter-Werte nicht · Diff `paket-6.diff`
- 2026-09-24 Zug 4 Runde 1 (B): die zwei wichtigen und die zwei kleinen Befunde an denselben Implementierer (Resume 978884a7, opus/medium), Brief `paket-6.impl-2.brief.txt`, Report `paket-6.impl-2.json`
- 2026-09-24 Zug 4 Runde 1 (B): zurück FERTIG, geändert `Display.ts` (TSDoc `resizeToElement`, Lifecycle Punkt 2), `types.ts` (`ResizeDisplayToFn`), `FrameLoop.spec.ts` (neuer Fall `lets frameNo, now, deltaTime and measuredFps read what the last frame carried`, bei vertauschten Gettern rot 1/26) · Verify `paket-6.verify-2.log` exit=0 · Reviewer gezielt (Resume 4e559522), Diff `paket-6.diff-2`, Report `paket-6.review-2.json`
- 2026-09-24 Zug 4 Runde 1 (B): Review 2 (gezielt) — alle vier offenen Befunde behoben, keine neuen · Fortschritt: 4 von 4 erledigt
- 2026-09-24 Zug 5 (B): Commit a96d0ca3 auf main, getragen von `paket-6.verify-2.log` (exit=0, nach der letzten Codeänderung) · Plan: `[x]`, Queue-Einträge `→ Paket 6` geschlossen, drei Nebenbefunde in »Offene Befunde«

## Urteil des Reviewers (Review 1 und 2, gegen `paket-6.diff-2`)

| Befund | Urteil | Fundstelle im Commit |
| --- | --- | --- |
| `Chronometer.ts` `start()`/`stop()` ohne Klemme | behoben | `Chronometer.ts:134`, `:159`; Tests `Chronometer.spec.ts` ab `:302` |
| `Display#pause` vor dem ersten Start und nach `dispose()` | behoben | `Display.ts:1057`; Tests `Display.spec.ts` ab `:218`; CHANGELOG `:125`, `:218`, Migration Guide »A disposed display refuses to be used« |
| Lifecycle-TSDoc Punkt 2 | behoben | `Display.ts:382-386` (Runde 1: Observer-Vorbehalt, Verweis auf `start()`) |
| `DisplayStateMachine` Init-/Restart-Verschachtelung | behoben | `DisplayStateMachine.ts:125`, `:132-136`, `:163`; Tests `DisplayStateMachine.spec.ts:170`, `Display.spec.ts:293` |
| »exactly once per frame« | behoben | `Display.ts:484-492`, `#didEmitResize` `:553-557` |
| `width`/`height` und »each frame« an den Zug-0-Stellen | behoben | `Display.ts:604-620`, `:427-431`, `:435`, `:460`, `:655`, `:673-676`, `:691`, `types.ts:63-86`; Runde 1: `Display.ts:665-667`, `types.ts:16-17` |
| `FrameLoop`-Felder nur lesbar | behoben | `FrameLoop.ts:195-230`; Tests `FrameLoop.spec.ts:295`, `:530`; CHANGELOG `:141`, Migration Guide `:919` |
| `RAF`-Felder | behoben | `FrameLoop.ts:47-54`, `#measureFps` `:118` |
| Überlange Kommentarzeilen | behoben | `FrameLoop.spec.ts:387-390`, `FixedFrameLoop.ts:285-287`; awk-Prüfung leer |
| CHANGELOG-Überschrift Migration Guide | behoben | `CHANGELOG.md:1822` |

Kleine Befunde: keine offen (beide aus Review 1 in Runde 1 mitgenommen). Konventionen: keine Finding-ID, kein Rückblick, Commit-Message geprüft.

## Nebenbefunde (Urteil: → Scope, alle unter `src/display/`)

- `FixedFrameLoop.ts:82` — `OnRenderFrame` statt `OnDisplayRenderFrame` in der Klassen-TSDoc: andere Ursache als dieses Paket (Name eines Events, kein Randfall) → Drain-Runde.
- `DisplayStateMachine.ts:18` — `state` schreibbar: nicht exportiert, keine Nutzerentscheidung deckt es wie bei `FrameLoop` → Drain-Runde.
- `Chronometer.ts:15` — unvollständiger Kommentar zu `#currentTime`: Doku-Präzision, nicht die Klemme → Drain-Runde.
