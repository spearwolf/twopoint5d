# Paket 7 — Restbefunde der Display-Domäne: Test-Hygiene display-resize, TSDoc, State-Feld

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (kein Audit-Finding) · die fünf Einträge unter »Offene Befunde«
  mit `→ Paket 7`, dazu die in Zug 0 aufgenommenen Stellen derselben Ursache
  (siehe »Abgleich«)
- Ziel: Die letzten Nebenbefunde der Display-Domäne sind behoben — die
  Resize-Browser-Tests nutzen ihre eigenen Helfer und räumen Listener und
  Größen-Referenzen deterministisch ab, `DisplayStateMachine#state` ist nur
  lesbar, und TSDoc und Kommentare in `FixedFrameLoop` und `Chronometer`
  stimmen mit dem Code.
- Folge von: Paket 6 — nur für den Kommentar an `#pausedAt` in
  `Chronometer.ts:26` (zweite Generation, siehe »Abgleich«). Alle übrigen Teile
  sind vorbestehend.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d-testing/test/display-resize.test.js`
  - `packages/twopoint5d/src/display/DisplayStateMachine.ts`
  - `packages/twopoint5d/src/display/DisplayStateMachine.spec.ts`
  - `packages/twopoint5d/src/display/FixedFrameLoop.ts`
  - `packages/twopoint5d/src/display/Chronometer.ts`
- Kein CHANGELOG-Eintrag: `DisplayStateMachine` steht nicht in
  `src/display/public-api.ts` (modulintern, `Display` hält sie im privaten
  `#stateMachine`), die übrigen Änderungen sind TSDoc, Kommentare und Tests
  ohne Verhaltensänderung.
- Kommentarzeilen höchstens 100 Zeichen breit (Konvention der Umgebung;
  Prettier bricht Kommentare nicht um). Die unten vorgegebenen Texte dürfen
  anders umbrochen werden, ihr Wortlaut bleibt.

## Vorgehen

1. **`DisplayStateMachine#state` nur lesbar** (`DisplayStateMachine.ts:18`) —
   zuerst der Regressionstest, rot sehen, dann umbauen.
   1. In `DisplayStateMachine.spec.ts` direkt nach dem Test `'create'`
      (Zeile 26–30) einfügen, im Idiom von
      `FrameLoop.spec.ts:295-309`:

      ```ts
      it('state is an accessor without a setter', () => {
        const stateMachine = new DisplayStateMachine();

        const descriptor = Object.getOwnPropertyDescriptor(DisplayStateMachine.prototype, 'state');
        expect(descriptor?.get, 'state has a getter').toBeTypeOf('function');
        expect(descriptor?.set, 'state has no setter').toBeUndefined();

        expect(() => {
          (stateMachine as unknown as Record<string, unknown>).state = DisplayStateMachine.RUNNING;
        }, 'a write to state').toThrow(TypeError);
        expect(stateMachine.state, 'state after the write').toBe(DisplayStateMachine.NEW);
      });
      ```

      Lauf vor dem Umbau: `pnpm nx test twopoint5d -- src/display/DisplayStateMachine.spec.ts`
      — der neue Test muss rot sein (der Deskriptor fehlt auf dem Prototyp),
      die Ausgabe gehört in den Report.
   2. In `DisplayStateMachine.ts` Zeile 18
      `state: DisplayStateName = DisplayStateMachine.NEW;` ersetzen durch das
      private Feld plus Getter:

      ```ts
      #state: DisplayStateName = DisplayStateMachine.NEW;

      get state(): DisplayStateName {
        return this.#state;
      }
      ```

   3. Jeder Zugriff innerhalb der Klasse geht über `this.#state`, lesend wie
      schreibend: heute `this.state` in den Zeilen 21, 25, 29, 74, 90, 103,
      116, 117, 143, 146, 164, 167. Der Getter ist nur für Aufrufer außerhalb
      (`Display` liest `isPaused`/`isRunning`, die Spec liest `state`).
   4. Die Statics (`NEW`, `RUNNING`, `PAUSED`, `Init`, `Start`, `Pause`,
      `Restart`) bleiben, wie sie sind — Entscheidung in Zug 0, Grund unten
      unter »Entscheidungen in Zug 0«.
2. **Ereignisname in der Klassen-TSDoc von `FixedFrameLoop`**
   (`FixedFrameLoop.ts:82`): `` `OnRenderFrame` `` → `` `OnDisplayRenderFrame` ``.
   Der Satz lautet danach:
   ``The loop pauses automatically when `Display` pauses (no `OnDisplayRenderFrame`
   events fire) and disposes when `Display` disposes (via `OnDisplayDispose`).``
3. **Kommentare an den Zeitfeldern des `Chronometer`** (`Chronometer.ts`),
   Wortlaut vorgegeben:
   1. Zeile 15, an `#currentTime` — ersetzen durch:

      ```ts
      /**
       * The latest time the chronometer has seen. The constructor and `reset()` set it; `update()`
       * and `start()` only ever move it forward
       */
      ```

   2. Zeile 20, an `#lostTime` — ersetzen durch:

      ```ts
      /**
       * Time lost to the pauses `start()` has closed, and the part of an `update()` delta that
       * `maxDeltaTime` cut off
       */
      ```

   3. Zeile 23, an `#recentlyLostTime` — ersetzen durch:

      ```ts
      /**
       * Time that `update()` has counted as lost since the most recent `stop()`; `start()` moves it
       * into `#lostTime`
       */
      ```

   4. Zeile 26, an `#pausedAt` — ersetzen durch:

      ```ts
      /**
       * The time of the most recent `stop()`, never earlier than the latest time the chronometer had
       * seen by then
       */
      ```

   5. Zeile 63, TSDoc des öffentlichen Getters `lostTime` — `/** Time lost due to pause */`
      ersetzen durch:

      ```ts
      /**
       * Time lost due to pause, and the part of an `update()` delta that {@link maxDeltaTime} cut off
       */
      ```

   Kein Code in `Chronometer.ts` ändert sich.
4. **`display-resize.test.js`: Größen-Referenz über `makeSizeRef()`, Aufräumen
   in `finally`.** Kein Test ändert, was er prüft; Titel bleiben.
   1. Test `'resize-to=CSS-selector resolves the target element'`
      (Zeile 215–243): die handgebaute Referenz (Zeile 218–225) wird
      `const sizeRef = makeSizeRef(document.body, {id: 'display-resize-selector-ref', width: 128, height: 64});`
      (`makeSizeRef()` setzt dieselben fünf Styles). Das `try` beginnt direkt
      danach und umfasst den Canvas-Aufbau und `new Display(canvas)`; der
      `finally`-Zweig wird `sizeRef.remove();`.
   2. Test `'a resize-to selector follows its element when it is replaced'`
      (Zeile 413–444): `let second;` wandert direkt unter `const first = …`
      (Zeile 417), und das `try` beginnt dort — Canvas-Aufbau und
      `new Display(canvas)` (Zeile 419–424) liegen danach innerhalb des `try`.
      Der `finally`-Zweig bleibt (`first.remove(); second?.remove();`).
   3. Test `'resize() is called from the constructor and sets initial width/height (no event yet)'`
      (Zeile 61–86): alles nach `on(display, OnDisplayResize, onResize);`
      (Zeile 70) bis vor `off(…)` in ein `try`, `off(display, OnDisplayResize, onResize);`
      (Zeile 85) in dessen `finally`. Die Kommentare wandern mit.
   4. Test `'emits OnDisplayResize when the size actually changes'`
      (Zeile 165–196): alles nach dem `on(…)` in Zeile 176 in ein `try`, das
      `off(…)` aus Zeile 195 in dessen `finally`.
   5. Test `'emits OnDisplayResize exactly once on the first frame'`
      (Zeile 469–489): alles nach dem `on(…)` in Zeile 477 in ein `try`, das
      `off(…)` aus Zeile 488 in dessen `finally`.
   6. Test `'does not double-emit OnDisplayResize on the first frame when the size differs from construction'`
      (Zeile 491–512): der anonyme Listener in Zeile 501–503 wird zur
      Konstante `const onResize = (props) => { emits.push({frameNo: props.frameNo, width: props.width, height: props.height}); };`,
      angemeldet mit `on(display, OnDisplayResize, onResize);`; alles danach
      in ein `try`, `off(display, OnDisplayResize, onResize);` in dessen
      `finally`.
   7. Die Importe bleiben (`on`, `off` aus `@spearwolf/eventize`,
      `makeContainer`, `disposeDisplay` aus `./helpers/fixtures.js`).
      `makeSizeRef()` bleibt eine Funktion dieser Datei: keine zweite
      Testdatei braucht sie (AGENTS.md: nach `helpers/fixtures.js` geht erst,
      was eine zweite Datei braucht).
5. **Testzahlen:** die Browser-Suite hat danach dieselbe Anzahl Tests wie vor
   dem Paket, die Vitest-Suite einen mehr (Schritt 1.1).

- Verify: `pnpm run ci`
- Commit: `refactor(display): make the state of DisplayStateMachine read-only, name OnDisplayRenderFrame in the FixedFrameLoop docs, say what the time fields of Chronometer hold and that lostTime also carries what maxDeltaTime cuts off, and let the resize browser tests build their selector target with makeSizeRef() and take their listeners and size references off in finally`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · `display-resize.test.js:218-225`
    unverändert · `display-resize.test.js:85`, `:195`, `:488` unverändert,
    dazu `:501` (anonymer Listener) · `FixedFrameLoop.ts:82` unverändert ·
    `DisplayStateMachine.ts:18` unverändert, keine Schreiber außerhalb der
    Klasse (`grep`) · `Chronometer.ts:15` unverändert · aufgenommen:
    `display-resize.test.js:232` und `:424` (`new Display` vor dem `try`,
    vorbestehend aus 7de63c45 bzw. 68c3bffb), `Chronometer.ts:20`, `:23`,
    `:63` (vorbestehend, gegen aa6dcc4e), `Chronometer.ts:26` (Folge von
    Paket 6, a96d0ca3) · keine offenen `Folgen:`-Zeilen anderer Pakete
  - 2026-09-24 Zug 1: Implementierer beauftragt (sonnet, effort low), Report `paket-7.impl-1.json`
  - 2026-09-24 Zug 2: FERTIG_MIT_VORBEHALT (drei Dateien nicht ganz gelesen) · 5 Dateien laut Plan geändert · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-7.verify.log`) · Abweichung: Regressionstest schreibt `['state']` wegen TS4111 · roter Lauf 1 failed / 11 passed
  - 2026-09-24 Zug 3: Reviewer (sonnet, low): alle Einträge behoben, kein kritischer, kein wichtiger Befund · Diff `paket-7.diff`, Report `paket-7.review-1.json`
  - 2026-09-24 Zug 4: keine Runde nötig
  - 2026-09-24 Zug 5: committet e1b9f2ff, Verify `paket-7.verify.log` exit=0

## Urteil des Reviewers (Zug 3)

- `display-resize.test.js:218-225` behoben — `makeSizeRef(document.body, {id: 'display-resize-selector-ref', …})`, `try` direkt danach, `finally` `sizeRef.remove()`
- `:85`, `:195`, `:488`, `:501` behoben — `off()` in `finally`, anonymer Listener ist Konstante `onResize`
- `:232`, `:424` behoben — Canvas-Aufbau und `new Display(canvas)` im `try`
- `FixedFrameLoop.ts:82` behoben — `OnDisplayRenderFrame`, kein `OnRenderFrame` mehr in `src`
- `DisplayStateMachine.ts:18` behoben — `#state` plus Getter, kein `this.state` mehr in der Klasse, Regressionstest in der Spec
- `Chronometer.ts:15`, `:20`, `:23`, `:26`, `:63` behoben — Wortlaut laut Plan, kein Code geändert
- Klein: `DisplayStateMachine.spec.ts:39` `['state']` statt `.state` (begründet, TS4111); Code-Zeile mit `makeSizeRef(...)` ~110 Zeichen (Grenze gilt nur für Kommentare, Prettier ok) — beide ohne Handlungsbedarf
- Vorbehalt des Implementierers: `Chronometer.ts`, `FixedFrameLoop.ts`, `display-resize.test.js` nur an den betroffenen Stellen gelesen, keine Nebenbefunde gemeldet

## Abgleich (Zug 0, 2026-09-24, gegen a96d0ca3)

| Eintrag | Fundstelle jetzt | Urteil |
| --- | --- | --- |
| `display-resize.test.js:218-225` — Referenz von Hand statt `makeSizeRef()` | `:218-225`, `makeSizeRef()` in `:34-44` | unverändert → Schritt 4.1 |
| `display-resize.test.js:85`, `:195`, `:488` — `off()` nicht in `finally` | `:85`, `:195`, `:488` | unverändert → Schritte 4.3–4.5 |
| `FixedFrameLoop.ts:82` — `OnRenderFrame` statt `OnDisplayRenderFrame` | `:82`; einzige Stelle im Paket, in `src`, `docs`, Lookbook und Browser-Tests (`grep`); `CHANGELOG.md:3157` ist ein veröffentlichter Abschnitt und meint den damaligen Typ `OnRenderFrameProps` | unverändert → Schritt 2 |
| `DisplayStateMachine.ts:18` — `state` öffentlich schreibbar | `:18`; geschrieben nur in der Klasse (`:117`, `:143`, `:146`), gelesen von der Spec; nicht in `public-api.ts` | unverändert → Schritt 1 |
| `Chronometer.ts:15` — Kommentar an `#currentTime` nennt nur `update()` | `:15`; gesetzt von Konstruktor (`:77`), `update()` (`:102`), `start()` (`:165`), `reset()` (`:180`) | unverändert → Schritt 3.1 |

### In Zug 0 aufgenommen, je dieselbe Ursache wie ein Eintrag des Pakets

- `display-resize.test.js:232` und `:424` — `new Display(canvas)` steht vor
  dem `try`, dessen `finally` die in `document.body` gehängte Referenz wieder
  abnimmt; wirft der Konstruktor, bleibt sie im Dokument. Dieselbe Ursache wie
  die `off()`-Einträge: das Aufräumen der Datei hängt nicht vollständig an
  `finally`. Vorbestehend (7de63c45, 68c3bffb, beide vor aa6dcc4e). → Schritte
  4.1 und 4.2.
- `display-resize.test.js:501` — anonymer `OnDisplayResize`-Listener ohne
  `off()`; dieselbe Ursache wie `:85`/`:195`/`:488`. Vorbestehend (7de63c45).
  → Schritt 4.6.
- `Chronometer.ts:20` (`#lostTime`: »Time lost due to pause before the
  previous time«), `:23` (`#recentlyLostTime`: »… after the previous time«)
  und `:63` (öffentlicher Getter `lostTime`: »Time lost due to pause«) —
  `#lostTime` trägt auch den Überschuss, den `maxDeltaTime` in `update()`
  abschneidet (`:104-106`), und die TSDoc von `maxDeltaTime` (`:31-41`) sagt
  das auch; die beiden Feldkommentare beschreiben ihre Rollen nicht. Dieselbe
  Ursache wie `:15`: die Kommentare der Zeitfelder sagen nicht, was
  hineinfließt. Vorbestehend (gegen aa6dcc4e: `:20`, `:23`, `:63` und der
  Überschuss in `:98` wortgleich). → Schritte 3.2, 3.3, 3.5.
- `Chronometer.ts:26` (`#pausedAt`: »Wall-clock timestamp captured by the most
  recent `stop()`«) — **Folge von Paket 6**: a96d0ca3 hat `stop()` gegen die
  zuletzt gesehene Zeit geklemmt (`:134`,
  `Math.max(getCurrentTime(time), this.#currentTime)`), in d38cc402 stand
  dort `getCurrentTime(time)`; der Feldkommentar ist nicht mitgezogen.
  Symptom — wäre nicht entstanden, hätte Paket 6 seine Änderung bis zum
  Feldkommentar zu Ende geführt. Paket 6 ist committet; das Nachtragspaket für
  eine Kommentarzeile ist mit diesem zusammengelegt (dieselbe Datei, dieselbe
  Ursache wie `:15`). Zweite Generation: der `stop()`-Teil von Paket 6 kam aus
  einem vorbestehenden Queue-Eintrag. → Schritt 3.4.

## Entscheidungen in Zug 0

- **`state` als Getter über `#state`, nicht nur `readonly` im Typ.** So hat
  es Paket 6 an `FrameLoop` und Paket 4 an `Display` gemacht; nur der Getter
  schützt auch zur Laufzeit, und nur er lässt sich wie in
  `FrameLoop.spec.ts:295` als Regressionstest vor dem Umbau rot zeigen.
- **Die Statics der State-Machine bleiben schreibbar.** Sie sind Konstanten,
  kein Zustand einer Instanz; `static readonly` wirkte nur im Typ und ließe
  sich zur Laufzeit nicht belegen, und die Klasse ist modulintern — außerhalb
  von `src/display/` erreicht sie niemand. Der Eintrag in der Queue und die
  Linie von Paket 4 und 6 gelten dem Zustand.
- **`off()` in `finally` statt die `off()`-Aufrufe zu streichen.** Streichen
  ginge auch (`dispose()` im `afterEach` löst alle Listener), aber Paket 5 hat
  in derselben Datei das Aufräumen in `finally` gezogen (d38cc402); so liest
  sich die Datei einheitlich, und ein Test räumt ab, was er selbst angelegt
  hat.
- **`makeSizeRef()` bleibt in der Datei**, siehe Schritt 4.7.

## Findings im Volltext

Kein Audit-Finding. Die Einträge aus »Offene Befunde« im Wortlaut des Plans:

**`packages/twopoint5d-testing/test/display-resize.test.js:218-225`** (Paket 5,
info) — baut das Größen-Referenzelement von Hand, obwohl dieselbe Datei in
`:34-44` `makeSizeRef()` dafür hat.

**`packages/twopoint5d-testing/test/display-resize.test.js:85`, `:195`,
`:488`** (Paket 5, info) — `off(display, OnDisplayResize, …)` steht nicht in
einem `finally`; harmlos, weil `dispose()` im `afterEach` alle Listener löst.

**`packages/twopoint5d/src/display/FixedFrameLoop.ts:82`** (Paket 6, info) —
Klassen-TSDoc nennt das Ereignis `OnRenderFrame`, es heißt
`OnDisplayRenderFrame`.

**`packages/twopoint5d/src/display/DisplayStateMachine.ts:18`** (Paket 6,
info) — `state` ist ein öffentlich schreibbares Feld, dieselbe Art wie die
`FrameLoop`-Felder; die Klasse ist nicht über `public-api.ts` exportiert, also
nur intern erreichbar.

**`packages/twopoint5d/src/display/Chronometer.ts:15`** (Paket 6, info) —
Kommentar an `#currentTime` »set by calling the `update()` method« ist
unvollständig: `start()`, `reset()` und der Konstruktor setzen es ebenfalls.
