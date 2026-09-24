# Paket 1 — Lifecycle und Frame-Loop: start/stop/pause, Event-Reihenfolge, rAF-Anbindung

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ASYNC-005 (medium), ASYNC-002 (medium), PERF-022 (low), IMPL-009 (info), BUG-118 (low), TEST-004 (low, Display-Anteil), TEST-042 (medium, Display-Anteil ohne dpr-Clamp)
- Ziel: Das Display startet, pausiert, stoppt und meldet seine Events in der dokumentierten Reihenfolge — auch bei überlappenden Aufrufen —, hängt nur am rAF-Treiber, solange es läuft, pausiert auf Wunsch außerhalb des Viewports, und diese Pfade sind durch eine Display-Spec und Browser-Tests abgesichert.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/Chronometer.ts`
  - `packages/twopoint5d/src/display/types.ts`
  - `packages/twopoint5d/src/display/Chronometer.spec.ts`
  - `packages/twopoint5d/src/display/Display.spec.ts` (neu)
  - `packages/twopoint5d/src/display/DisplayStateMachine.ts` und `DisplayStateMachine.spec.ts` (aus Runde 1 der Fehlerkette: Pause aus Init-/Restart-Listenern)
  - `packages/twopoint5d-testing/test/display-lifecycle.test.js` (neu)
  - `packages/twopoint5d-testing/test/display-dispose.test.js` (nur der Kommentar in Zeile 265–266)
  - `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: siehe Abschnitt »Vorgehen« unten — die Schritte sind nummeriert und in dieser Reihenfolge auszuführen.
- Verify: `pnpm run ci`
- Commit: `fix(display): emit init before start, let a stop() or pause that lands while start() waits keep the display from starting, let a pause that an init or restart listener asks for hold the display, take a paused display off its frame loop, keep the chronometer from running backwards, add the opt-in pauseOutsideViewport option, and cover the lifecycle with a Display spec and browser tests`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · ASYNC-005 unverändert, jetzt `Display.ts:1043-1044` · ASYNC-002 unverändert, jetzt `Display.ts:658-668` · PERF-022 unverändert, jetzt `Display.ts:703-715` und `:672-686` · IMPL-009 unverändert · BUG-118 unverändert, jetzt `Display.ts:672-675` und `Chronometer.ts:545-559` · TEST-004 Display-Anteil offen · TEST-042 Display-Anteil: Dispose während echtem Init gegenstandslos (abgedeckt), dpr-Clamp an Paket 2, Rest offen · TEST-024 und READ-017 nach Paket 1b geteilt · keine offenen Folgen, Queue »Offene Befunde« leer
  - 2026-09-24 Zug 1: Implementierer beauftragt, Modell opus (stärkste Stufe), Effort high, Session `remediate-twopoint5d-p1-impl-1`, Report nach `paket-1.impl-1.json`
  - 2026-09-24 Zug 2: Report FERTIG · geändert Display.ts, Chronometer.ts, types.ts, Chronometer.spec.ts, display-dispose.test.js (Kommentar), CHANGELOG.md · neu Display.spec.ts (14 Fälle), display-lifecycle.test.js (8 Fälle) · roter Lauf 11 failed / 28 passed · Arbeitsbaum schmutzig · Verify `pnpm run ci` mit NX_SKIP_NX_CACHE=true exit=0 (`paket-1.verify.log`; der gecachte Lauf davor in `paket-1.verify-cached.log`, ebenfalls exit=0)
  - 2026-09-24 Zug 3: Reviewer opus/high (`paket-1.review-1.json`, Diff `paket-1.diff`) · alle sieben Finding-Anteile behoben · 1 kritisch (stop()/pause im OnDisplayInit-Listener verpufft, State-Machine noch in NEW — Folge des synchronen Init-Handlers), 1 wichtig (start()-TSDoc zu pauseOutsideViewport beim Start), 5 klein (3× CHANGELOG-Wortlaut, werfender Init-Listener, Titel eines Dispose-Tests)
  - 2026-09-24 Zug 4 Runde 1: offen kritisch A + wichtig B, dazu klein C–E und die eigene Folge CHANGELOG.md:139 · per `--resume e0f61393-46cd-4ab4-b0f3-c0b82affbe1a` an denselben Implementierer (opus/high), Report nach `paket-1.impl-2.json`
  - 2026-09-24 Zug 4 Runde 1 zurück: FERTIG · A–E behoben (neu geändert DisplayStateMachine.ts + .spec.ts, Zähler `#transitions` statt Zustandsvergleich, zusätzlicher Fixed-Eintrag) · roter Lauf 5 failed / 22 passed · Verify ohne Cache exit=0 (`paket-1.verify-2.log`) · Diff `paket-1.diff-2`, gezielter Review `paket-1.review-2.json` (opus/high)
  - 2026-09-24 Zug 4 Review 2: A, C, D, E erledigt, B teils offen · neu wichtig: `pauseOutsideViewport`-TSDoc in types.ts:43-45 (auch Display.ts:1059-1062, CHANGELOG.md:12) verschweigt den Bericht während `start()` wartet; Commit-Message ohne die Pause aus Init-/Restart-Listenern (vom Runner in der Paketdatei nachgetragen, Dateiliste ergänzt) · klein: CHANGELOG.md:206 breiter als die Sache, Restart-Pfad nur in DisplayStateMachine.spec.ts
  - 2026-09-24 Zug 4 Runde 2: offen der Rest von B (TSDoc/CHANGELOG zu pauseOutsideViewport) plus klein CHANGELOG.md:206 · frischer Implementierer opus/medium (stärkste Stufe schon erreicht), ohne Resume, Report nach `paket-1.impl-3.json`
  - 2026-09-24 Zug 4 Runde 2 zurück: FERTIG · nur TSDoc (types.ts, Display.ts `start()`), CHANGELOG.md:12 und :206, ein Restart-Fall in Display.spec.ts · Verify ohne Cache exit=0 (`paket-1.verify-3.log`) · Diff `paket-1.diff-3`, gezielter Review `paket-1.review-3.json` (opus/medium)
  - 2026-09-24 Zug 4 Review 3: alle offenen Befunde erledigt, sieben Finding-Anteile weiter behoben · 1 klein (Komma nach Gedankenstrich, Display.ts:1062) · Kette beendet nach 3 Runden (impl-1 bis impl-3)
  - 2026-09-24 Zug 5: Commit 6a4bcacf auf main, 10 Dateien, Trailer `Remediation-Run: 2026-09-24` · Verify `paket-1.verify-3.log` exit=0 (ohne Nx-Cache, jünger als die letzte Änderung) · 6 Nebenbefunde in »Offene Befunde«

## Abgleich

Gegen `aa6dcc4e` (HEAD beim Zug 0). Die Zeilennummern des Audits stammen aus einem
älteren Stand von `Display.ts`; die Datei ist seither durch die Dispose-Arbeit auf
1225 Zeilen gewachsen. Sachverhalte nach Inhalt abgeglichen, nicht nach Zeile.

- **ASYNC-005 — unverändert, verschoben.** `start()` steht jetzt in
  `Display.ts:1025-1047`. Nach `await this.#waitForRenderer` (`:1028`) und nach
  `await beforeStartCallback(…)` (`:1035`) setzt es ohne Prüfung
  `this.#stateMachine.pausedByUser = false` (`:1043`) und ruft
  `this.#stateMachine.start()` (`:1044`). Ein `stop()` (`:1049-1051`) oder
  `pause = true` (`:763-769`) während eines der beiden `await` wird damit
  überschrieben.
- **ASYNC-002 — unverändert, verschoben.** Der Init-Handler steht jetzt in
  `Display.ts:658-668`: `async`, `await this.#waitForRenderer` im `try`, danach
  `this.#emit(OnDisplayInit)` — also einen Microtask nach dem synchron laufenden
  Start-Handler (`:672-678`). Das `try/catch` ist tot:
  `DisplayStateMachine.Init` geht nur aus `DisplayStateMachine.start()` hervor
  (`DisplayStateMachine.ts:124-131`, `:133-157`), und das ruft `Display` nur in
  `start()` (`Display.ts:1044`), hinter dem `await` in `:1028`, das eine
  fehlgeschlagene Init schon geworfen hätte.
- **PERF-022 — unverändert, verschoben.** Der Konstruktor meldet das Display
  nach der Init an seinem `FrameLoop` an (`Display.ts:703-715`), die Handler für
  `Start` und `Pause` (`:672-686`) melden es weder an noch ab;
  `[FrameLoop.OnFrame]` (`:979-984`) prüft nur `isRunning`. Seit dem Audit neu und
  für den Fix nötig: der rAF-Treiber hängt sich ab, sobald der letzte `FrameLoop`
  ihn verlässt (`FrameLoop.ts:218-235`, `stop()` ruft dann
  `renderer.setAnimationLoop(null)`), und `FrameLoop.stop(target)` gibt ihn frei,
  sobald der letzte Abonnent geht (`FrameLoop.ts:400-411`). **Grenze:** three
  0.185.1 startet in `renderer.init()` einen eigenen rAF-Kreislauf, der bis
  `renderer.dispose()` läuft (`three/src/renderers/common/Animation.js:69-91`);
  `setAnimationLoop(null)` nimmt nur den Callback heraus. Nach dem Fix läuft pro
  Frame kein Code von twopoint5d mehr für ein pausiertes Display, der rAF-Tick
  von three selbst bleibt.
- **IMPL-009 — unverändert.** `DisplayStateMachine.ts:34`, `:62-71`, `:102-113`;
  kein Schreiber von `elementIsInsideViewport` in `packages/twopoint5d/src` oder
  `apps/lookbook/src`, kein `IntersectionObserver` im Repo.
- **BUG-118 — unverändert, verschoben.** Der Start-Handler setzt den Chronometer
  auf `performance.now() / 1000` (`Display.ts:672-675`), die Frames kommen mit dem
  rAF-Zeitstempel (`:979-983` → `renderFrame(now)` → `:1004`
  `this.#chronometer.update(now / 1000)`). `Chronometer.update()`
  (`Chronometer.ts:545-559`) klemmt nicht: ein früherer Zeitstempel ergibt ein
  negatives `deltaTime` und läuft über `FixedFrameLoop.ts:216`
  (`#accumulator += props.deltaTime`) in `alpha` (`:236`) unter 0.
- **TEST-004, Display-Anteil — offen.** Keine Spec und kein Browser-Test prüft an
  einem lebenden Display `pause = true/false`, `stop()`, den
  `visibilitychange`-Listener und sein Entfernen, `OnDisplayPause` und
  `OnDisplayRestart`, `maxFps`, `resizePollIntervalMs`, die Init/Start-Reihenfolge
  oder ein `start()`, das bei fehlgeschlagener Init rejected
  (`display-constructor.test.js:75` prüft nur das `error`-Event;
  `display-dispose.test.js:604-630` nur `pause` nach `dispose()`). Außerhalb dieses
  Laufs und nur für den Abschluss notiert: den `styleUtils`-Anteil deckt
  inzwischen `src/display/styleUtils.spec.ts` (55 Zeilen); die PanControl-Anteile
  bleiben laut »Entscheidungen« im Audit.
- **TEST-042, Display-Anteil — teils offen, teils gegenstandslos, teils
  abgegeben.** Offen: der start/stop-Race, der Chronometer und die fehlende
  `src/display/Display.spec.ts`. Gegenstandslos: »ein Dispose während eines
  echten Init« — `display-dispose.test.js:236` (Frame-Loop bleibt leer),
  `:272` (Release nach der Init, gegen echten Renderer), `:316` (keine Rejection bei
  fehlgeschlagener Init) und `:453` (Canvas trägt das nächste Display) decken genau
  das. Abgegeben an Paket 2: der Device-Pixel-Clamp bei dpr > 1 — es ist derselbe
  Browser-Test, den die Entscheidung zu BUG-117 dort verlangt; hier geschrieben,
  prüfte er das Verhalten, das Paket 2 erst richtigstellt.
- **Offene Befunde / Folgen:** keine. Kein erledigtes Paket, die Queue ist leer.

## Entscheidungen in Zug 0

- **Paket geteilt: TEST-024 und READ-017 gehen nach Paket 1b.** Die Extraktion der
  Test-Helfer ist Transkription über rund zwanzig Testdateien, dieses Paket
  Nebenläufigkeit und öffentliche API — zwei Modell- und Effort-Profile. Ein
  Implementierer für beides hätte seinen Kontext mit Testdateien gefüllt, bevor er
  an die Race-Logik kommt, und der Reviewer läse die Race-Logik zwischen
  zwanzig mechanischen Diffs. 1b läuft direkt nach diesem Paket und vor Paket 2,
  damit die neuen Display-Tests der Pakete 2–4 die gemeinsamen Helfer schon
  vorfinden. Paket 1 behält die Nummer, weil die Schleife nach Zug 0 die Marke
  von Paket »1« liest.
- **Race-Semantik von `start()`: der letzte Aufruf gewinnt.** Die Empfehlung des
  Audits (Generation festhalten, nach dem `await` nur zurücksetzen, wenn kein
  `stop()`/`pause` kam) wird um einen Fall ergänzt: ein `pause = false` nach dem
  `pause = true` hebt die Pause wieder auf, und der Start geht durch. Sonst bliebe
  ein Display, dessen Nutzer zuletzt »läuft« gesagt hat, stehen, und `pause = false`
  auf einem nie gestarteten Display tut nichts, was ihn retten könnte.
  `beforeStartCallback` läuft auch dann, wenn während der Renderer-Init ein
  `stop()` kam: entschieden wird einmal, nach allen `await`. Der Callback baut,
  was der Aufrufer danach erwartet (Szene, Assets).
- **BUG-118 wird in `Chronometer.update()` geklemmt, nicht im Start-Handler.** Der
  Start-Handler hat keinen rAF-Zeitstempel zur Hand — er läuft aus dem Code des
  Aufrufers. Die Klemme schützt jeden Nutzer des `Chronometer`, und die Zeit bleibt
  monoton: ein früherer Zeitstempel verschiebt `#currentTime` nicht zurück.
- **IMPL-009 als Konstruktor-Option `pauseOutsideViewport`, kein Attribut.** Die
  Entscheidung verlangt »opt-in über Option/Attribut, Default aus«. Eine Option
  reicht und passt zum Rest: auch der `visibilitychange`-Listener wird einmal im
  Konstruktor verdrahtet, während Attribute nur `resize()` pro Frame liest
  (`resize-to`) — ein Observer, der pro Frame auf- und abgebaut wird, wäre
  Unsinn. Der Name folgt `elementIsInsideViewport` der State-Machine;
  »offscreen« kollidiert mit `OffscreenCanvas`.
- **Zwei Testoberflächen, nach `AGENTS.md`.** Logik (Race, Reihenfolge, Abo am
  Frame-Loop, Chronometer, Optionen) in `Display.spec.ts` — Vitest, Node ohne DOM,
  mit Stubs, deterministisch und in der Coverage gezählt; das Zusammenspiel mit
  echtem Renderer, echtem `visibilitychange` und echtem `IntersectionObserver` in
  `display-lifecycle.test.js`. Kein `happy-dom`/`jsdom`: eine neue
  devDependency samt Lockfile-Änderung für eine Spec, die mit einer Handvoll Stubs
  auskommt, lohnt nicht; `styleUtils.spec.ts` und `PowerOf2ImageLoader.spec.ts`
  arbeiten schon so.
- **Ein `start()` bei verstecktem Tab bleibt, wie es ist, und wird dokumentiert.**
  Die State-Machine geht aus `NEW` direkt nach `PAUSED` und emittiert
  `OnDisplayPause`; `OnDisplayInit` und `OnDisplayStart` folgen, sobald der Tab
  sichtbar wird. Init vor Start bleibt dabei gewahrt. Das steht nirgends und
  kommt in die TSDoc von `start()`, ein Verhaltenswechsel ist es nicht.

## Vorgehen

Regressionstests zuerst (Schritt 1), rot sehen, dann die Fixes (Schritte 2–6), dann
der Browser-Test (Schritt 7) und die Doku (Schritt 8). Der rote Lauf gehört in den
Report.

### Schritt 1 — Regressionstests schreiben und rot sehen

a) **`packages/twopoint5d/src/display/Chronometer.spec.ts`** — zwei neue Fälle am
   Ende der bestehenden `describe`, in der Einheit der vorhandenen Fälle (ms):
   - laufend: `update(4000)`, `update(3990)` → `deltaTime` ist `0`, `time` ist
     derselbe Wert wie nach `update(4000)`; danach `update(4010)` → `deltaTime`
     ist `10` (gemessen ab 4000, nicht ab 3990).
   - pausiert: nach `update(4000)` ein `stop(4000)`, dann `update(3990)` →
     `lostTime` bleibt unverändert (wird nicht kleiner).

b) **`packages/twopoint5d/src/display/Display.spec.ts`** (neu), Vitest in der
   Node-Umgebung der Library (kein DOM). Gerüst:
   - `vi.mock('./Stylesheets.js', () => ({Stylesheets: {addRule: vi.fn(() => 'twopoint5d-canvas'), installRule: vi.fn(() => 'twopoint5d-canvas--fullscreen')}}))` —
     `Stylesheets` braucht ein echtes `document`.
   - Globale Stubs je Test mit `vi.stubGlobal`, abgeräumt mit
     `vi.unstubAllGlobals()` in `afterEach` (die Konfiguration setzt nur
     `restoreMocks`):
     - `window`: `{devicePixelRatio: 1, performance}` — das globale `performance`,
       damit ein `vi.spyOn(performance, 'now')` auch `renderFrame()` erreicht;
     - `getComputedStyle`: `() => ({getPropertyValue: (name) => (name === 'box-sizing' ? 'border-box' : '')})`;
     - `document`: `{hidden: false, head: {}, addEventListener: vi.fn(), removeEventListener: vi.fn()}` —
       der Test holt sich den `visibilitychange`-Listener aus den Aufrufen von
       `addEventListener`;
     - `IntersectionObserver` nur in den Fällen zu `pauseOutsideViewport`: eine
       Klasse, die ihren Callback, `observe(el)` und `disconnect()` aufzeichnet.
   - Canvas-Stub: `{classList: {add: vi.fn(), remove: vi.fn()}, style: {}, setAttribute: vi.fn(), hasAttribute: () => false, getAttribute: () => null, getBoundingClientRect: () => ({width: 320, height: 200})}`.
   - Renderer-Stub: `{isWebGPURenderer: true, domElement: canvas, init: () => initPromise, setPixelRatio: vi.fn(), setSize: vi.fn(), setAnimationLoop: vi.fn((cb) => { loop = cb; }), dispose: vi.fn()}`;
     das Display entsteht über den Adoptionspfad:
     `new Display(renderer as unknown as WebGPURenderer, options)`. Ein Frame ist
     der Aufruf des zuletzt übergebenen Animation-Loop-Callbacks mit einem
     Zeitstempel in ms. Jeder Test baut einen eigenen Renderer-Stub — der
     rAF-Treiber hängt per `WeakMap` am Renderer, also bekommt jeder Test einen
     frischen.
   - Wie `DisplayStateMachine.spec.ts` und `FixedFrameLoop.spec.ts`: Events mit
     `on(display, OnDisplay…, …)` aus `@spearwolf/eventize` in eine Liste von
     Namen mitschreiben.

   Fälle (Titel englisch, beschreiben das Verhalten):
   1. `start()` emittiert `init` vor `start`, beide bevor sein Promise auflöst; ein
      Listener, der sich danach mit `on(display, OnDisplayInit, …)` und
      `on(display, OnDisplayStart, …)` anmeldet, bekommt beide in dieser
      Reihenfolge nachgereicht. **Rot vor Schritt 2.**
   2. `pause = true`, dann `pause = false` an einem laufenden Display: `pause`,
      dann `restart`, `start` — kein zweites `init`.
   3. `stop()` direkt nach `start()` (während das Display auf den Renderer wartet):
      das Promise löst mit dem Display auf, kein `init`, kein `start`,
      `isRunning` ist `false`, `frameLoop.subscriptionCount` ist `0`. **Rot vor
      Schritt 4.**
   4. dasselbe mit `pause = true` statt `stop()`. **Rot vor Schritt 4.**
   5. `pause = true` und gleich danach `pause = false` während `start()` wartet:
      das Display startet (`init`, `start`, `isRunning`).
   6. `stop()` innerhalb von `beforeStartCallback`: das Display startet nicht.
      **Rot vor Schritt 4.**
   7. `stop()` vor `start()`: `start()` startet das Display.
   8. Abo am Frame-Loop: `frameLoop.subscriptionCount` ist `0` nach dem
      Konstruktor und nach aufgelöster Init (vor `start()`), `1` im Lauf, `0` nach
      `pause = true` — und `renderer.setAnimationLoop` wurde zuletzt mit `null`
      gerufen —, `1` nach `pause = false`, `0` nach `dispose()`. **Rot vor
      Schritt 3.**
   9. Chronometer: `vi.spyOn(performance, 'now').mockReturnValue(1000)` **vor** dem
      Konstruktor (der Chronometer liest seine Startzeit schon im Feld-Initializer
      und in `stop()` im Konstruktor), `start()`,
      dann ein Frame mit Zeitstempel `990` → `display.deltaTime` ist `0`,
      `display.now` ist `0`; ein Frame mit `1010` → `deltaTime` ist `0.01`
      (`toBeCloseTo`). **Rot vor Schritt 5.**
   10. Eine Init, die rejected: `start()` rejected mit genau diesem Fehler, und
       `OnDisplayError` trägt denselben.
   11. `visibilitychange`: `document.hidden = true` und den aufgezeichneten Listener
       rufen → `pause`, `display.pause` ist `true`; `hidden = false` und rufen →
       `restart`, `start`. Nach `dispose()` wurde `removeEventListener` mit
       `'visibilitychange'` und demselben Listener gerufen.
   12. `pauseOutsideViewport`: ohne die Option entsteht kein `IntersectionObserver`;
       mit ihr genau einer, der den Canvas beobachtet. Callback mit
       `[{isIntersecting: false}]` → `pause`; mit `[{isIntersecting: true}]` →
       `restart`, `start`; `dispose()` ruft `disconnect()`. Ohne globales
       `IntersectionObserver` wirft der Konstruktor mit der Option nicht.
   13. `maxFps: 30` bei Frames im Abstand von `1000 / 60` ms: nur jeder zweite
       Frame erreicht `OnDisplayRenderFrame` (ohne Option: jeder). Die genaue Zahl
       aus der Raster-Logik in `FrameLoop.ts:413-436` ableiten, nicht raten.
   14. `resizePollIntervalMs = 100` mit festgehaltenem `performance.now()`: ein
       zweiter `resize()` im selben Intervall misst nicht (der
       `getComputedStyle`-Stub wird nicht erneut gerufen), nach 100 ms misst er
       wieder.

   Lauf: `pnpm nx test twopoint5d -- src/display/Display.spec.ts src/display/Chronometer.spec.ts`.
   Rot erwartet für die Fälle 1, 3, 4, 6, 8, 9 und die zwei neuen
   Chronometer-Fälle; die übrigen dürfen schon grün sein. Ausgabe in den Report.

### Schritt 2 — `OnDisplayInit` synchron vor `OnDisplayStart`

In `Display.ts:658-668` den Init-Handler ersetzen durch

```ts
[DisplayStateMachine.Init]: () => this.#emit(OnDisplayInit),
```

`try/catch` und Kommentar entfallen: `Init` entsteht nur in `start()` hinter einem
erfolgreich abgewarteten `#waitForRenderer`; eine gescheiterte Init erreicht den
Aufrufer über das Reject von `start()` und über `OnDisplayError` aus dem Konstruktor.
Folge, bewusst ohne eigene Behandlung: ein Init-Listener, der synchron wirft, lässt
`start()` mit seinem Fehler rejecten (`emit()` von eventize bricht am ersten
werfenden Listener ab) — genau wie heute schon ein werfender Start-Listener.

### Schritt 3 — Das Display hängt nur im Lauf am Frame-Loop

a) Konstruktor, `Display.ts:703-715`: die Kette `.then(…).catch(…)` ersetzen durch

   ```ts
   this.#waitForRenderer.catch((error) => {
     // a renderer that never comes up is what the caller has to hear about; left here it
     // would be an unhandled rejection and the display would simply stay dark
     emit(this, OnDisplayError, error, this);
   });
   ```

   Das `frameLoop.start(this)` samt Dispose-Guard und seinem Kommentar entfällt
   hier; das Display meldet sich erst beim Start an (b).
b) Start-Handler (`Display.ts:672-678`): nach `chronometer.start(t)` /
   `chronometer.update(t)` und **vor** `this.#emit(OnDisplayStart)` die Zeile
   `this.frameLoop.start(this);`. Davor, weil ein Listener von `OnDisplayStart`
   synchron `pause = true` setzen kann: der Pause-Handler nimmt das Display dann
   vom Loop, und eine Anmeldung nach dem Emit hängte ein pausiertes Display wieder
   an. Ein Kommentar dazu, der das Warum nennt.
c) Pause-Handler (`Display.ts:680-686`): `this.frameLoop.stop(this);` **vor**
   `this.#emit(OnDisplayPause)` — gespiegelt: ein Pause-Listener, der
   `pause = false` setzt, startet das Display synchron neu, und eine Abmeldung nach
   dem Emit nähme ein laufendes Display vom Loop.
d) `[FrameLoop.OnFrame]` (`:979-984`) behält seine `isRunning`-Prüfung.
   `dispose()` bleibt **zeichengleich**: sein `this.frameLoop.stop(this)` deckt ein
   nie gestartetes Display, und `packages/twopoint5d/docs/resource-lifecycle.md:161-180`
   zitiert den Körper wörtlich.
e) Keine TSDoc und kein CHANGELOG-Eintrag behauptet, ein pausiertes Display halte
   `requestAnimationFrame` an: three hält seinen eigenen rAF bis
   `renderer.dispose()` am Laufen (siehe Abgleich). Richtig ist: ein pausiertes
   Display steht nicht an seinem Frame-Loop, und für es läuft pro Frame kein Code von
   twopoint5d. Nichts an three's privatem `renderer._animation` anfassen.
f) `packages/twopoint5d-testing/test/display-dispose.test.js:265-266`: die
   Zusicherungen des Falls »a dispose() before the renderer is ready leaves the frame
   loop empty« bleiben (`0` vorher und nachher). Der Kommentar spricht vom Handler,
   den das Display im Konstruktor an das Init-Promise hängt und der jetzt nur noch
   den Fehler meldet — neu formulieren: das Display meldet sich erst an seinem Loop
   an, wenn es startet, und das `await initSettled` lässt jede Reaktion auf das
   Init-Promise vorher laufen.

### Schritt 4 — `stop()` und `pause = true` während eines wartenden `start()` gewinnen

a) Neues privates Feld neben `#stateMachine` (`Display.ts:326`):

   ```ts
   // counts stop() and every pause = true. start() reads it before its first await: a pause
   // that came in while it waited for the renderer or for beforeStartCallback keeps the display
   // from starting, unless a pause = false has lifted it again since
   #pauseRequests = 0;
   ```

b) `stop()` (`:1049-1051`): `this.#pauseRequests += 1;` vor
   `this.#stateMachine.pausedByUser = true;`.
c) `set pause(pause)` (`:763-769`): nach dem Disposed-Guard
   `if (pause) this.#pauseRequests += 1;`, dann wie bisher
   `this.#stateMachine.pausedByUser = pause;`.
d) `start()` (`:1025-1047`): direkt nach dem ersten Disposed-Check
   `const pauseRequests = this.#pauseRequests;`. Alle `await` und Disposed-Checks
   bleiben. Unmittelbar vor `this.#stateMachine.pausedByUser = false;`:

   ```ts
   // a stop() or a pause = true that came in while this call waited wins over it, unless a
   // pause = false has lifted it since — the last word the caller spoke is the one that counts
   if (this.#pauseRequests !== pauseRequests && this.#stateMachine.pausedByUser) {
     return this;
   }
   ```

   Ergebnis: `start(); stop()` startet nicht; `start(); pause = true` startet
   nicht; `start(); pause = true; pause = false` startet; `stop(); start()` startet.
   Das Promise löst in allen Fällen mit dem Display auf — ein `stop()` ist kein
   Fehler.
e) TSDoc von `start()` neu (die Absätze zu `dispose()` bleiben): wartet auf die
   Renderer-Init, führt `beforeStartCallback` aus, startet dann. Der erste Start
   emittiert `OnDisplayInit`, dann `OnDisplayStart`, beide innerhalb dieses Aufrufs
   und in dieser Reihenfolge; ein Start nach einer Pause `OnDisplayRestart`, dann
   `OnDisplayStart`. Ein `stop()` oder `pause = true`, das eintrifft, während
   `start()` wartet, gewinnt: das Promise löst mit dem Display auf, das nicht läuft;
   ein `pause = false` danach lässt den Start durch. Ist der Tab beim Start versteckt
   — oder mit `pauseOutsideViewport` der Canvas außerhalb des Viewports —, geht das
   Display in die Pause und emittiert `OnDisplayPause`; `OnDisplayInit` und
   `OnDisplayStart` folgen, sobald es sichtbar wird.
f) TSDoc für `stop()` (hat keine): pausiert das Display wie `pause = true`;
   `start()` oder `pause = false` lassen es wieder laufen; nach `dispose()`
   wirkungslos.
g) Klassen-TSDoc, Abschnitt »Lifecycle« (`:209-229`): Punkt 1 nennt neben
   `document.visibilitychange` das optionale `IntersectionObserver` auf dem Canvas
   (`pauseOutsideViewport`); Punkt 2 sagt »fires `OnDisplayInit` (once), then
   `OnDisplayStart`« und dass das Display nur im Lauf an seinem Frame-Loop hängt.

### Schritt 5 — Chronometer läuft nicht rückwärts

`Chronometer.ts:545-559`, `update()`:

```ts
update(time?: number): void {
  const previousTime = this.#currentTime;
  // a time before the current one counts as no time passing: a rAF timestamp is taken at the
  // vsync and can lie before a performance.now() read later in the same frame, and time does
  // not run backwards
  const deltaTime = Math.max(0, getCurrentTime(time) - previousTime);
  this.#currentTime = previousTime + deltaTime;
  // … der Rest wie bisher, mit diesem deltaTime
}
```

TSDoc von `update()` um einen Satz ergänzen: ein `time` vor dem aktuellen zählt
als keine vergangene Zeit — `deltaTime` ist `0`, `time` bleibt stehen.
`FixedFrameLoop` und der Start-Handler von `Display` bleiben unverändert; mit
`deltaTime >= 0` bleibt `alpha` im dokumentierten Intervall `[0, 1)`.

### Schritt 6 — Option `pauseOutsideViewport`

a) `types.ts`, `DisplayParameters`, direkt nach `maxFps`:

   ```ts
   /**
    * Pause the display while its canvas is outside the viewport, and let it run again once
    * the canvas is back in view — watched through an `IntersectionObserver` on the canvas.
    * Leaving and coming back emit `OnDisplayPause`, then `OnDisplayRestart` and
    * `OnDisplayStart`, as a hidden tab does.
    *
    * Off by default. Read once, by the constructor. Where `IntersectionObserver` does not
    * exist, the option does nothing.
    */
   pauseOutsideViewport?: boolean;
   ```

b) Konstruktor: `pauseOutsideViewport` in das Destructuring in `Display.ts:558`
   aufnehmen, damit es nicht in den Optionen des `WebGPURenderer` landet.
c) Nach dem `visibilitychange`-Block (`:689-701`):

   ```ts
   if (pauseOutsideViewport && typeof IntersectionObserver !== 'undefined') {
     const observer = new IntersectionObserver((entries) => {
       // the entries of one callback arrive in time order, and the last one is where the
       // canvas is now
       const entry = entries[entries.length - 1];
       if (entry != null) {
         this.#stateMachine.elementIsInsideViewport = entry.isIntersecting;
       }
     });
     observer.observe(canvas);
     once(this, OnDisplayDispose, () => {
       observer.disconnect();
     });
   }
   ```

   `canvas` ist das `const {domElement: canvas}` aus `:648`. Root ist der
   Viewport, kein `threshold` (jedes sichtbare Pixel zählt als drin). Kein
   öffentlicher Getter; `DisplayStateMachine` bleibt unverändert. Getrennt wird über
   `once(…OnDisplayDispose…)` wie beim `visibilitychange`-Listener, damit
   `dispose()` zeichengleich bleibt (Schritt 3 d).

Danach `pnpm nx test twopoint5d -- src/display` — alles grün.

### Schritt 7 — Browser-Test `display-lifecycle.test.js`

Neue Datei `packages/twopoint5d-testing/test/display-lifecycle.test.js`, echter
`WebGPURenderer` (three wählt WebGPU oder WebGL), `this.timeout(20000)` wie in
`display-dispose.test.js:58`. `makeContainer` und `disposeDisplay` als lokale Kopien
von `display-resize.test.js:7-33`, mit `FIXTURE_ID = 'display-lifecycle-fixture'` —
Paket 1b führt alle Kopien zusammen, hier entsteht kein Helfer-Modul. Warten auf
Animation-Frames mit `await new Promise((resolve) => requestAnimationFrame(resolve))`.
`OnDisplayInit` und `OnDisplayStart` sind retained; der Pause-Handler leert
`OnDisplayStart` (`retainClear`), ein `once(display, OnDisplayStart, …)` nach dem
`pause` wartet also wirklich auf den nächsten Start. Wer vor dem `pause` auf `start`
wartet, bekommt den alten Wert sofort nachgereicht — ein Test, der so grün wird,
beweist nichts.

Fälle:
1. Ein frisches Display: `init`, `start`, dann `renderFrame`, in dieser
   Reihenfolge; `frameLoop.subscriptionCount` ist `1`.
2. `pause = true`: `pause`, `subscriptionCount` `0`, über drei Animation-Frames
   kein `renderFrame`; `pause = false`: `restart`, `start`, dann wieder
   `renderFrame` — kein zweites `init`.
3. `stop()`, dann `await start()`: wie 2.
4. Versteckter Tab: `Object.defineProperty(document, 'hidden', {configurable: true, get: () => true})`
   und `document.dispatchEvent(new Event('visibilitychange'))` → `pause`;
   `delete document.hidden` (die eigene Property fällt weg, der Getter des
   Prototyps gilt wieder) und erneut dispatchen → `restart`, `start`,
   `renderFrame`. Die Property in `finally` bzw. `afterEach` wieder entfernen.
5. start/stop-Race gegen eine echte Init: `const started = display.start(); display.stop();`
   → `await started` ist das Display, `isRunning` `false`, weder `init` noch
   `start`, `subscriptionCount` `0`; ein folgendes `await display.start()` läuft
   (`init`, `start`).
6. `pauseOutsideViewport: true`: nach Start und erstem Frame den Host aus dem
   Viewport schieben (`host.style.top = '-10000px'`) → auf `pause` warten (ein
   Promise über `once(display, OnDisplayPause, …)`; der Timeout der Suite
   begrenzt es); zurück (`top = '0'`) → auf `start` warten. Ohne die Option:
   hinausschieben, drei Animation-Frames warten — das Display läuft weiter, und
   Frames kommen an.
7. Die Option erreicht den Renderer nicht: mit
   `createRenderer: (params) => { seen = params; return new WebGPURenderer(params); }`
   gilt `expect(seen).to.not.have.property('pauseOutsideViewport')`.

Lauf: `pnpm test:browser` (Chromium und Firefox).

### Schritt 8 — CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, nur unter `[Unreleased]`, nach dem Skill
`updating-changelog`. Beschrieben wird das Verhalten, wie es jetzt ist:

- **Added:** die Option `pauseOutsideViewport` von `Display` — was sie tut, dass sie
  aus ist, dass sie nur im Konstruktor gelesen wird und ohne `IntersectionObserver`
  nichts tut.
- **Changed:** ein `Display` steht nur an seinem `FrameLoop`, solange es läuft: es
  meldet sich beim Start an und bei Pause, `stop()`, verstecktem Tab und
  `dispose()` ab; `display.frameLoop.subscriptionCount` ist vor dem ersten Start
  und in der Pause `0`, und hat der Loop keinen Abonnenten mehr, nimmt er seinen
  Callback aus `renderer.setAnimationLoop()`.
- **Fixed:** `OnDisplayInit` geht vor `OnDisplayStart` hinaus, für Listener wie für
  spät angemeldete; ein `stop()` oder `pause = true` während eines wartenden
  `start()` hält das Display an, ein `pause = false` danach lässt es laufen;
  `Chronometer#update()` mit einer früheren Zeit ergibt `deltaTime` `0` und lässt
  `time` stehen, `FixedFrameLoop#alpha` bleibt damit in `[0, 1)`.

Kein Migration-Guide-Eintrag: die Option ist additiv, die übrigen Änderungen stellen
dokumentiertes Verhalten her. Kein Codeblock nötig; wer doch einen setzt, markiert
einen eigenständigen mit `ts check`.

## Findings im Volltext

Aus der JSON-Insel `<script id="audit-data">` in `./audit.html`, Zeilennummern im Stand des Audits (siehe Abgleich).

**ASYNC-005 · medium · packages/twopoint5d/src/display/Display.ts:867-868** — stop() und pause während eines wartenden start() respektieren
Weitere Fundstellen: packages/twopoint5d/src/display/Display.ts:852-875

`start()` setzt nach dem `await` auf den Renderer ohne weitere Prüfung `pausedByUser = false`. Ruft eine UI `start()` und direkt danach, während die Assets noch laden, `stop()` oder `pause = true` auf, läuft das Display trotzdem los.

Empfehlung: Beim Aufruf von `start()` eine Generation festhalten und `pausedByUser` nach dem `await` nur zurücksetzen, wenn seitdem kein `stop()` bzw. `pause` kam.

**ASYNC-002 · medium · packages/twopoint5d/src/display/Display.ts:482** — OnDisplayInit vor OnDisplayStart emittieren, wie das Klassen-TSDoc verspricht

`DisplayStateMachine.start()` emittiert `Init` und setzt dann synchron `RUNNING` und emittiert `Start`. Der Init-Handler ist `async` und `await`et eine bereits gesettelte Promise, `OnDisplayInit` wird also auf einen Microtask verschoben, während der Start-Handler `#emit(OnDisplayStart)` synchron ausführt — Listener sehen Start, dann Init, und da beide in Vollendungsreihenfolge retained werden, bekommen späte Subscriber dieselbe verkehrte Reihenfolge. Das `try/catch` ist tot: `Init` ist nur über `this.#stateMachine.start()` in Zeile 833 erreichbar, hinter `await this.#waitForRenderer`, das bereits geworfen hätte. Die Lookbook-Demos bauen ihre Szenen in `onInit`; alles, was ein Konsument an `onStart` hängt und eine existierende Szene erwartet, läuft einen Microtask zu früh.

Empfehlung: Den Handler synchron machen: `[DisplayStateMachine.Init]: () => this.#emit(OnDisplayInit)`. Browsertest auf die Reihenfolge `init, start, renderFrame` bei einem frischen Display und `start` (ohne `init`) nach Un-Pause.

**PERF-022 · low · packages/twopoint5d/src/display/Display.ts:527-534** — Das Display vom rAF-Treiber lösen, solange es pausiert oder noch nicht gestartet ist
Weitere Fundstellen: packages/twopoint5d/src/display/Display.ts:803-808, packages/twopoint5d/src/display/FrameLoop.ts:60-67

`frameLoop.start(this)` läuft schon im Konstruktor, und `stop()`/`pause` melden das Display nicht ab. Ein gestopptes Display lässt rAF mit voller Refresh-Rate weiterlaufen, die Ticks prüfen nur `isRunning`. Auf Mobilgeräten kostet das Akku.

Empfehlung: In den Pause- und Start-Handlern der State-Machine `frameLoop.stop(this)` bzw. `start(this)` aufrufen.

**IMPL-009 · info · packages/twopoint5d/src/display/DisplayStateMachine.ts:34** — Den elementIsInsideViewport-Eingang verdrahten oder entfernen
Weitere Fundstellen: packages/twopoint5d/src/display/DisplayStateMachine.ts:62-71, packages/twopoint5d/src/display/DisplayStateMachine.ts:102-113

Offscreen-Pausing ist in der State-Machine vorbereitet, aber niemand setzt den Eingang. Ein IntersectionObserver fehlt, der Zustand ist toter Code.

Empfehlung: Über einen IntersectionObserver auf den Canvas verdrahten und beim Dispose trennen, oder den Eingang entfernen.

**BUG-118 · low · packages/twopoint5d/src/display/Display.ts:497-499** — Negative Deltas im Chronometer abfangen
Weitere Fundstellen: packages/twopoint5d/src/display/Chronometer.ts:95-101, packages/twopoint5d/src/display/FixedFrameLoop.ts:216

Beim Start setzt das Display den Chronometer auf `performance.now()`, die Frames kommen aber mit dem rAF-Timestamp. Der kann vor einem `performance.now()` liegen, das zwischen VSync und Frame-Callbacks gelesen wurde. Das erste Delta wird dann negativ, und `FixedFrameLoop.alpha` verlässt das dokumentierte Intervall `[0, 1)`.

Empfehlung: In `Chronometer.update` mit `Math.max(0, …)` klemmen oder beim Start denselben Zeitgeber wie die Frames nutzen.

**TEST-004 · low · packages/twopoint5d-testing/test/display-dispose.test.js:273** — Die Testlücken um Pause/Restart, styleUtils und Touch-Eingabe schließen; controls steht bei 15 % Vitest-Coverage

Die Browsertests decken Konstruktor, Dispose-Vertrag, Resize-Quellen und Renderer-Übernahme gut ab, aber nichts prüft an einem laufenden Display `pause = true/false`, `stop()`, den `visibilitychange`-Listener (und sein Entfernen), `OnDisplayPause`/`OnDisplayRestart`, `maxFps`, `resizePollIntervalMs`, die Init/Start-Reihenfolge (ASYNC-002) oder ein `start()`, das bei fehlgeschlagenem Init rejected. `styleUtils` hat keine Spec (BUG-083 ist die Folge). `PanControl2D`-Tests nutzen nur Maus mit `pointerId: 1`: kein Touch, kein zweiter Pointer, kein `pointercancel` (BUG-085), keine `mouseButton`/`keyCodes`-Optionen, keine zwei Controls in einer Root. `Display.ts` und `PanControl2D.ts` stehen bei 0 % Vitest-Coverage; die Zahl ist unvollständig, weil die Browser-Suite keine Coverage meldet — und genau dort liegen die Lücken.

Empfehlung: `styleUtils.spec.ts` (Vitest, Style-Stub). `display-lifecycle.test.js`: start → pause → restart samt Event-Reihenfolge und `frameLoop.subscriptionCount`, Hidden-Tab-Simulation via `Object.defineProperty(document, 'hidden')` + `visibilitychange`, die Rejection bei fehlgeschlagenem Init. `pan-control-input.test.js` um einen Touch-Pointer, einen Zwei-Pointer-Merge und einen `pointercancel`-Fall erweitern.

**TEST-042 · medium · packages/twopoint5d-testing/test/stage-pipeline.test.js** — Die riskantesten GPU- und Lifecycle-Pfade mit Browser-Tests absichern
Weitere Fundstellen: packages/twopoint5d-testing/test/display-dispose.test.js:225, packages/twopoint5d-testing/test/display-resize.test.js:307-327, packages/twopoint5d-testing/test/pan-control-keys.test.js, packages/twopoint5d/src/sprites/node-utils.ts:75-83, packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:74-81

Die Defekte dieses Laufs mit der höchsten Wirkung sitzen dort, wo Vitest-Mocks nichts sehen, und kein Test deckt sie ab. Es gibt keinen Pixel-Readback für Mode E und für ein verschachteltes Plain-Kind über zwei Frames. Nicht getestet sind außerdem Billboards an einem verschobenen Mesh, `texCoordsFromIndex` und die Frame-Index-Formel, ein Dispose während eines echten Init, der Device-Pixel-Clamp bei dpr > 1, der start/stop-Race und ein verlorenes `keyup`. `Display` und `PanControl2D` haben keine `*.spec.ts`.

Empfehlung: Je Pfad einen Browser-Test mit Pixel-Readback bzw. echtem Renderer ergänzen. Für den start/stop-Race und den Chronometer genügen Vitest-Specs mit Renderer-Stub.

## Urteil des Reviewers

Aus `paket-1.review-1.json` und `paket-1.review-3.json` (Stand des Commits 6a4bcacf):

- ASYNC-005 — behoben — `Display.ts:1073-1095` (`#pauseRequests` vor dem ersten `await` gelesen, eine Pause während des Wartens gewinnt, `pause = false` danach lässt den Start durch), `Display.ts:792`, `:1107`; Specs `Display.spec.ts:150-206`, Browser-Test `display-lifecycle.test.js:170`
- ASYNC-002 — behoben — `Display.ts:677` (synchroner Init-Handler), `DisplayStateMachine.ts:131-162`; Spec `Display.spec.ts:110-132`, Browser-Test `display-lifecycle.test.js:87-95`
- PERF-022 — behoben — `Display.ts:681-705` (`frameLoop.start` im Start-, `frameLoop.stop` im Pause-Handler, jeweils vor dem Emit), `:737-741` (keine Anmeldung im Konstruktor); Spec `Display.spec.ts:244-269` inkl. `setAnimationLoop(null)`, Browser-Test `display-lifecycle.test.js:99-146`
- IMPL-009 — behoben — `Display.ts:722-735` (`IntersectionObserver` → `elementIsInsideViewport`, `disconnect()` über `once(…OnDisplayDispose…)`), `types.ts:36-51`; Specs `Display.spec.ts:351-419`, Browser-Test `display-lifecycle.test.js:189-237`
- BUG-118 — behoben — `Chronometer.ts:95-112` (`Math.max(0, …)`, `#currentTime` läuft nicht zurück); zwei neue Fälle in `Chronometer.spec.ts`, `Display.spec.ts:271-285`
- TEST-004 (Display-Anteil) — behoben — `Display.spec.ts` (Pause/Restart, `stop()`, `visibilitychange` samt Entfernen, `maxFps`, `resizePollIntervalMs`, Init/Start-Reihenfolge, Rejection bei gescheiterter Init) und `display-lifecycle.test.js:87-237`
- TEST-042 (Display-Anteil ohne dpr-Clamp) — behoben — `src/display/Display.spec.ts` neu, start/stop-Race `Display.spec.ts:150-206` und gegen echte Init `display-lifecycle.test.js:170`, Chronometer `Display.spec.ts:271-285`

## Kleine Befunde (ohne Runde)

- `Display.ts:1062` — in der TSDoc von `start()` steht nach dem schließenden Gedankenstrich ein überzähliges Komma (»waits for the renderer —, the display goes«).
- `CHANGELOG.md:12` — der Added-Eintrag zu `pauseOutsideViewport` sagt zweimal »as a hidden tab does«; richtig, aber schwerfällig.
- `Display.ts:677` — ein synchron werfender `OnDisplayInit`-Listener lässt `start()` rejecten, `#initMustBeCalled` steht dann schon auf `false` und der Zustand auf `NEW`: ein erneutes `start()` emittiert `OnDisplayRestart` statt `OnDisplayInit`, und Listener hinter dem werfenden sowie spät angemeldete bekommen `OnDisplayInit` nie (eventize schreibt den Retain-Wert erst nach allen Listenern). Die Paketdatei hatte den werfenden Listener bewusst ohne eigene Behandlung gelassen.
- `display-dispose.test.js:257-269` — der Fall »a dispose() before the renderer is ready leaves the frame loop empty« kann am Dispose-Pfad nicht mehr scheitern, seit das Display sich erst in `start()` anmeldet; sein Titel verspricht mehr, als er prüft.
- `CHANGELOG.md:244` — der bestehende `[Unreleased]`-Eintrag »fix a `Display` that is disposed before its renderer is ready: it does not put itself into its frame loop once the renderer initialization resolves …« nennt einen Mechanismus, den es nicht mehr gibt; die Aussage stimmt im Ergebnis weiter und blieb deshalb stehen.

## Urteile zu den Nebenbefunden

Alle sechs Einträge in »Offene Befunde« aus diesem Paket sind vorbestehend (nachgesehen mit `git show aa6dcc4e:…`: `Chronometer.ts:139` `start()` ohne Klemme, `Display.ts:759` `get pause()`, `:333` »legacy behavior«, `:606` TODO, `:216` Lifecycle Punkt 2; der verschachtelte `start()` aus einem Init-Listener emittierte dort sogar zweimal `Start`) und liegen unter `packages/twopoint5d/src/display/**` — die Scope-Regel greift, daher `→ Scope`. Keiner teilt die Ursache eines Findings dieses Pakets so, dass er hätte mitgenommen werden müssen.
