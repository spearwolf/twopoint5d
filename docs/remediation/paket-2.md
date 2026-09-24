# Paket 2 — Display-Dispose: Aufräumen trotz werfender Listener, TSDoc von start() nach dispose()

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings. Das Paket trägt die beiden Nebenbefunde, die die
  Drain-Runde aus der Queue »Offene Befunde« hierher gelegt hat: **Dispose-Abbruch**
  (low) und **TSDoc start() nach dispose()** (info). Beide stehen nicht in
  `./audit.html`; sie sind in Paket 1 aufgefallen und vorbestehend.
- Ziel: `dispose()` räumt vollständig auf und meldet die Fehler werfender Listener erst
  danach, und die TSDoc beschreibt die Rejection von `start()` nach `dispose()` richtig.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d-testing/test/display-dispose.test.js`
  - `packages/twopoint5d/docs/resource-lifecycle.md`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(display): let dispose() take a display down completely when a listener of OnDisplayPause or OnDisplayDispose throws and throw the error, or an AggregateError, once the display is down, let every listener of OnDisplayDispose hear the event when one throws, keep the error of a failing constructor beside that of a dispose listener in its teardown, and say that start() rejects after dispose()`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · Dispose-Abbruch unverändert (`Display.ts:1561-1584`, `stop()` in `:1565`, `emit(OnDisplayDispose)` in `:1569`, Rückkehr in `:1562`), dazu am selben Ursprung: `emit` statt `emitStrict` in `:1569` und der Abbau im Konstruktor-`catch` `:1078-1081` · TSDoc start() nach dispose() unverändert (`Display.ts:1478`, Klassen-TSDoc Punkt 4 `:462-466`), dazu dieselbe Aussage in `CHANGELOG.md:126` und `:843` und im Testnamen `display-dispose.test.js:218` · Folgen aus Paket 1: keine · Queue »Offene Befunde« leer · Restplan unverändert
  - 2026-09-24 Zug 1: Implementierer beauftragt (sonnet, effort medium), Brief `paket-2.impl-1.brief.txt`, Report nach `paket-2.impl-1.json`
  - 2026-09-24 Zug 2: Report FERTIG, D1–D5 vor dem Fix rot (5 failed / 48 passed); geändert Display.ts, Display.spec.ts, display-dispose.test.js, resource-lifecycle.md, CHANGELOG.md; Arbeitsbaum schmutzig; Verify `pnpm run ci` exit=0 (ohne Nx-Cache, `paket-2.verify.log`)
  - 2026-09-24 Zug 3: Reviewer (opus, effort medium) `paket-2.review-1.json` · beide Befunde behoben, 0 kritisch, 0 wichtig, 1 klein · Diff `paket-2.diff`
  - 2026-09-24 Zug 4: keine Runde nötig
  - 2026-09-24 Zug 5: committet e796aac3 (5 Dateien, 239+/24−), Verify `paket-2.verify.log` exit=0 ohne Nx-Cache, keine Codeänderung seither

## Abgleich

**Dispose-Abbruch — unverändert.** `Display.ts:1561-1584`:

```ts
dispose(): void {
  if (this.#disposed) return;          // :1562
  this.#disposed = true;               // :1563
  this.stop();                         // :1565 — läuft das Display, geht es in die Pause;
                                       //   der Pause-Handler (:1026-1043) stellt OnDisplayPause
                                       //   mit emitStrict zu und wirft danach
  this.frameLoop.stop(this);
  emit(this, OnDisplayDispose, this);  // :1569 — emit, nicht emitStrict
  off(this);
  this.#giveBackCallersCanvas();
  … #releaseRenderer(renderer), #ownContainer.remove()
}
```

Wirft ein Pause-Listener (`:1565`) oder ein Dispose-Listener (`:1569`), bleiben
`off(this)`, die Rückgabe der Canvas, die Freigabe des Renderers und das Entfernen des
Containers aus; `#disposed` steht schon, ein zweites `dispose()` kehrt in `:1562` zurück.
Beim Abgleich zusätzlich gesehen, dieselbe Ursache:

- `:1569` benutzt `emit()`. Laut eventize bricht `emit()` die Zustellung beim ersten
  werfenden Listener ab: Listener dahinter hören `OnDisplayDispose` nie. Das trifft auch
  die internen `once`-Listener, die nach einem werfenden Nutzer-Listener angemeldet
  wurden — ein `nextFrame()`, das danach aufgerufen wurde, rejected nie.
- Der Konstruktor ruft in `:1078-1081` `this.dispose(); throw error;`. Ein
  `resizeTo`-Callback bekommt das Display (`types.ts:22`, Aufruf `Display.ts:1283`), kann
  also einen Dispose-Listener anmelden, der beim Abbau wirft; dann verliert der
  Konstruktor seinen eigenen Fehler. Nach dem Umbau wirft `dispose()` nach dem Abbau —
  dieser Aufrufer muss deshalb mitgezogen werden (Schritt 2).

Der Pause-Handler (`:1026-1043`) hat vor seinem `emitStrict` schon alles erledigt:
Chronometer gestoppt, `frameLoop.stop(this)`, three-Schleife angehalten, `retainClear`.
Die Zustandsmaschine setzt `PAUSED`, bevor sie zustellt (`DisplayStateMachine.ts:121-127`).
Ein werfender Pause-Listener hinterlässt also einen konsistenten, pausierten Zustand; nur
`dispose()` selbst bricht ab.

**TSDoc start() nach dispose() — unverändert.** `Display.ts:1478`: »Throws after
{@link Display.dispose}.« Klassen-TSDoc Punkt 4, `:464-466`: »{@link Display.canvas},
{@link Display.start}, {@link Display.getEventProps}, … throw.« `start()` ist `async`
(`:1482`); `:1483`, `:1491`, `:1499` werfen innerhalb der async-Funktion, der Aufrufer
sieht eine Rejection. Beim Abgleich zusätzlich gefunden, dieselbe Aussage:

- `packages/twopoint5d/CHANGELOG.md:126` (Unreleased, `### Changed`): »`canvas`,
  `start()` and `getEventProps()` throw an error that names the class and the state«
- `packages/twopoint5d/CHANGELOG.md:843` (Unreleased, Migration Guide, Abschnitt »A
  disposed display refuses to be used«): »`Display#canvas`, `#start()` and
  `#getEventProps()` throw once `dispose()` has run«
- `packages/twopoint5d-testing/test/display-dispose.test.js:218`: Testname
  `'start() throws after dispose()'`; der Test selbst prüft schon die Rejection.

Die Unreleased-Sektion reicht bis `CHANGELOG.md:2344` (`## [0.21.2]` in `:2345`); beide
Stellen sind unveröffentlicht und dürfen geändert werden.

## Entscheidungen dieses Pakets

- **`dispose()` wirft weiter, aber erst nach dem Abbau.** Paket 1 hat die Pause-Zustellung
  strikt gemacht (Schnittstellen-Zeile im Plan: `stop()` in `dispose()` wirft den Fehler
  eines Pause-Listeners), und die Entscheidung zum Rollback eines gescheiterten Starts
  bündelt Fehler, statt einen zu verlieren. Ein `console.error` statt eines Wurfs würde
  diese Linie verlassen. Also: alle Fehler sammeln, vollständig abbauen, dann werfen.
- **Fehlerform wie in `DisplayStateMachine.ts:163-167`.** Ein Fehler kommt unverändert
  (auch ein `AggregateError`, den `emitStrict` aus mehreren Listenern eines Events
  gebildet hat). Werfen Listener beider Events, ein `AggregateError([pauseError,
  disposeError], …, {cause: disposeError})` — Zustellreihenfolge, `cause` ist der spätere
  Fehler wie dort.
- **`OnDisplayDispose` mit `emitStrict`.** Das ist die Variante, die die eventize-Doku für
  ein `dispose()` nennt, dessen Aufrufer berichten können muss: jeder Listener hört das
  Event, danach kommen die Fehler. `emitStrict` ist in `Display.ts` schon importiert und
  in Benutzung, es entstehen keine neuen Kosten.
- **Konstruktor: `AggregateError([error, disposeError], …, {cause: disposeError})`.**
  Sonst ersetzt der Fehler eines Dispose-Listeners den des Konstruktors. Ein Fehler geht
  nicht verloren — dieselbe Regel wie beim Rollback des Starts.
- **Kein neuer Browser-Test für werfende Listener.** Die Änderung ist Lifecycle-Logik,
  kein Rendering- oder GPU-Code; der Renderer-Stub in `Display.spec.ts` zeigt alles
  Beobachtbare (Listener, Frame-Loop, `renderer.dispose()`, `removeEventListener`). Der
  Freigabepfad selbst ändert sich nicht und ist in `display-dispose.test.js` abgedeckt.
- **Keine Migrationsnotiz.** Ein einzelner werfender Listener lässt `dispose()` weiter mit
  genau seinem Fehler werfen; neu ist nur, dass der Abbau vorher vollständig läuft und
  mehrere Fehler gebündelt werden. Das ist ein Fix, Eintrag unter `### Fixed`.
- **Keine Änderung an der Checkliste in `resource-lifecycle.md` §6.** Eine Regel »Dispose-
  Event strikt zustellen« gälte für jede Klasse des Pakets und machte `Stage2D`,
  `Canvas2DStage` usw. regelwidrig — das liegt außerhalb der Domäne dieses Laufs. Nur der
  Code-Auszug in §4 wird nachgezogen, weil er `Display.dispose()` wörtlich zeigt.

## Vorgehen

Zuerst die Regressionstests (Schritt 1), rot sehen, dann der Fix. Der rote Lauf gehört in
den Report: `pnpm nx test twopoint5d -- src/display/Display.spec.ts`.

1. **Regressionstests in `packages/twopoint5d/src/display/Display.spec.ts`.**
   Imports ergänzen: `OnDisplayDispose` aus `'../events.js'` (in die bestehende
   Import-Liste, alphabetisch vor `OnDisplayError`) und `getSubscriptionCount` aus
   `'@spearwolf/eventize'` (neben `on`, `once`). Jeder Test ruft `display.dispose()` selbst
   auf, damit das `dispose()` im `afterEach` (`:113-119`) sofort zurückkehrt und nicht
   wirft. Die Kürzel D1–D5 gehören nur in diese Datei — nicht in Testnamen, Kommentare
   oder die Commit-Message. Neuer Block `describe('dispose()', () => { … })` direkt vor
   `describe('constructor', …)` (`:1041`), mit diesen Tests:

   - **D1** `'a pause listener that throws does not stop dispose(): the display is torn down, then dispose() throws its error'`
     — `makeDisplay()`, `await display.start()`; `on(display, OnDisplayPause, () => { throw pauseError; })`;
     ein Dispose-Listener, der in ein Array schreibt; `const pending = display.nextFrame();`.
     `expect(() => display.dispose()).toThrow(pauseError)`. Danach: `display.isDisposed === true`,
     `display.renderer === undefined`, der Dispose-Listener wurde einmal gerufen,
     `display.frameLoop.subscriptionCount === 0`, `getSubscriptionCount(display) === 0`,
     `doc.removeEventListener` mit `'visibilitychange'` gerufen,
     `await expect(pending).rejects.toThrow(/disposed/)`; nach `await settle()`
     `renderer.dispose` genau einmal gerufen; ein zweites `display.dispose()` wirft nicht.
     Vor dem Fix rot: Dispose-Listener nie gerufen, Renderer nie freigegeben.
   - **D2** `'a dispose listener that throws: every dispose listener hears dispose, the display is torn down, then dispose() throws its error'`
     — `makeDisplay()` (gestartet oder nicht, beides geht; nimm gestartet).
     Reihenfolge wichtig: **zuerst** `on(display, OnDisplayDispose, () => { throw disposeError; })`,
     **dann** ein zweiter Dispose-Listener, der in ein Array schreibt, **dann**
     `const pending = display.nextFrame();` — so liegen beide hinter dem werfenden.
     `expect(() => display.dispose()).toThrow(disposeError)`; der zweite Listener hat das
     Event gehört; `pending` rejected mit `/disposed/`; `getSubscriptionCount(display) === 0`;
     nach `await settle()` `renderer.dispose` genau einmal. Vor dem Fix rot.
   - **D3** `'two dispose listeners that throw make dispose() throw an AggregateError of both errors, after the teardown'`
     — zwei werfende Dispose-Listener `first`, `second`; Fehler per `try/catch` fangen wie in
     `:468-476`; `toBeInstanceOf(AggregateError)`, `.errors` gleich `[first, second]`;
     danach `renderer.dispose` nach `await settle()` einmal gerufen. Vor dem Fix rot.
   - **D4** `'a pause listener and a dispose listener that throw make dispose() throw an AggregateError of both errors, after the teardown'`
     — gestartetes Display, werfender Pause-Listener `pauseError`, werfender Dispose-Listener
     `disposeError`; gefangener Fehler ist `AggregateError`, `.errors` gleich
     `[pauseError, disposeError]`, `.cause` ist `disposeError`, `.message` enthält
     `'Display#dispose()'`; `renderer.dispose` nach `await settle()` einmal. Vor dem Fix rot.

   Im bestehenden `describe('constructor', …)` (`:1041`) dazu:

   - **D5** `'a constructor that fails, and a dispose listener that throws as it takes the display down, throw an AggregateError of both errors and release the renderer'`
     — `const {renderer} = makeRenderer();`; `new Display(renderer as unknown as WebGPURenderer, {resizeTo: (display) => { on(display, OnDisplayDispose, () => { throw disposeError; }); throw failure; }})`
     im `try/catch`; gefangener Fehler ist `AggregateError`, `.errors` gleich
     `[failure, disposeError]`, `.cause` ist `disposeError`; nach `await settle()`
     `renderer.dispose` genau einmal. Vor dem Fix rot (wirft `disposeError` allein, Renderer
     bleibt unfreigegeben).

2. **Fix in `packages/twopoint5d/src/display/Display.ts`.**

   a) `dispose()` (`:1561-1584`) sammelt die Fehler und wirft nach dem Abbau. Zielform:

   ```ts
   dispose(): void {
     if (this.#disposed) return;
     this.#disposed = true;

     // a listener that throws does not hold up the teardown: its error waits until the display
     // is down, so a caller that catches it holds a disposed display, not half of one
     const errors: unknown[] = [];

     try {
       // a running display pauses here, and every listener of OnDisplayPause hears it
       this.stop();
     } catch (error) {
       errors.push(error);
     }
     this.frameLoop.stop(this);
     try {
       // the listeners are still attached here: this event is what tells them to let go,
       // and off(this) below is what makes it the last event this display ever emits. Every
       // listener hears it, even behind one that throws
       emitStrict(this, OnDisplayDispose, this);
     } catch (error) {
       errors.push(error);
     }
     off(this);

     // … unverändert: #giveBackCallersCanvas(), #releaseRenderer(renderer), #ownContainer.remove()
     //   samt ihrer Kommentare

     if (errors.length === 1) throw errors[0];
     if (errors.length > 1) {
       // neither goes missing: the error of the pause, and the one of the dispose event after it
       throw new AggregateError(errors, 'Display#dispose(): a listener of pause threw, and a listener of dispose threw', {
         cause: errors[1],
       });
     }
   }
   ```

   Mehr als zwei Einträge kann `errors` nicht bekommen (je Event höchstens einer, mehrere
   Listener eines Events bündelt schon `emitStrict`). Kommentarwortlaut darf angepasst
   werden, der Sinn bleibt; keine Rückblicke (»früher«, »now«).

   b) Konstruktor-`catch` (`:1078-1081`):

   ```ts
   } catch (error) {
     try {
       this.dispose();
     } catch (disposeError) {
       // neither goes missing: the error the constructor failed with, and the one a listener
       // of dispose threw as the display was taken down again
       throw new AggregateError(
         [error, disposeError],
         'new Display(): the constructor failed, and a listener of dispose threw as the display was taken down',
         {cause: disposeError},
       );
     }
     throw error;
   }
   ```

   Den Kommentar über dem `try` (`:989-991`) nicht ändern.

3. **TSDoc in `Display.ts`.**

   a) `dispose()` (`:1526-1560`): einen Absatz vor »A `dispose()` while the renderer is still
   initializing …« einfügen, sinngemäß: *Every listener of `OnDisplayPause` — a running display
   pauses first — and of `OnDisplayDispose` hears its event, even behind one that throws, and a
   listener that throws does not stop the teardown: `dispose()` runs to its end and then throws
   the error, or an `AggregateError` when more than one listener of the same event throws. When
   listeners of both events throw, the `AggregateError` carries the error of the pause and that
   of the dispose event, in this order. The display is disposed either way, and a second call
   does nothing.* Den letzten Satz des bestehenden Absatzes (»A second call does nothing.«)
   dann nicht doppeln.

   b) Klassen-TSDoc Punkt 3 (`:447-461`): nach »stops the loop, fires `OnDisplayDispose` and
   gives up {@link Display.renderer} right away.« einen Satz: *A listener that throws does not
   stop it; its error follows once the display is down — see {@link Display.dispose}.*

   c) Klassen-TSDoc Punkt 4 (`:462-477`): `{@link Display.start}` aus der Liste der Werfenden
   nehmen. Zielwortlaut ab `:464`: »{@link Display.canvas}, {@link Display.getEventProps},
   {@link Display.isWebGPUBackend} and {@link Display.isWebGLBackend} throw, and
   {@link Display.start} rejects.« Der Rest des Punktes bleibt.

   d) `start()` (`:1478-1480`) ersetzen durch sinngemäß: *Rejects after {@link Display.dispose},
   and so does a call still waiting for the renderer or for `beforeStartCallback` when
   `dispose()` runs, once that wait is over. The rejection arrives through the promise: an
   `await` or a `.catch()` sees it, a `try` around a call that is not awaited does not. A promise
   that resolved without a frame ever following would be a dead end the caller cannot see, and
   the caller is waiting on the effect, not on the value.*

   e) `onDispose` (`:1743-1748`): einen Satz anhängen: *Every listener hears the event, even
   behind one that throws; {@link Display.dispose} throws that error once the display is down.*

   Die Kommentare im Pause-Handler (`:1040-1041`) bleiben: »the call that paused the display«
   ist in `dispose()` das `stop()`, und `dispose()` fängt dessen Fehler.

4. **`packages/twopoint5d-testing/test/display-dispose.test.js:218`.** Test umbenennen in
   `'start() rejects after dispose()'` und die synchrone Seite mitprüfen: den Aufruf
   `display.start()` in einem `expect(() => { pending = display.start(); }, 'start() throws nothing synchronously').to.not.throw();`
   holen (`/** @type {Promise<Display> | undefined} */ let pending;`), dann wie bisher
   `await pending` im `try/catch` und die drei bestehenden Erwartungen an `error`.

5. **`packages/twopoint5d/docs/resource-lifecycle.md` §4 (`:164-193`).** Der `ts`-Block zeigt
   `Display.dispose()` wörtlich; ihn durch den neuen Code aus Schritt 2a ersetzen, Zeile für
   Zeile wie in `Display.ts`, Kommentare eingeschlossen. Den Satz davor (»a class others
   subscribe to **emits its dispose event before** that call«) nicht ändern. §6 bleibt.

6. **`packages/twopoint5d/CHANGELOG.md`** (Skill `updating-changelog` laden, nur Unreleased).

   a) `### Fixed`: ein neuer Eintrag, direkt unter dem Eintrag »fix a tick of the animation loop
   of three without a timestamp …« (`:221`). Zielwortlaut hinter dem `- `:
   »fix `Display#dispose()` with a listener that throws: a listener of `OnDisplayPause` — a
   running display pauses first — or of `OnDisplayDispose` that throws does not stop the
   teardown. Every listener of `OnDisplayDispose` hears the event, the display comes off its frame
   loop and drops every listener, a canvas handed in goes back as the display found it, the
   renderer is released and a container the display built leaves the DOM; only then does
   `dispose()` throw the error — an `AggregateError` when more than one listener of the event
   throws, and an `AggregateError` of the pause error and the dispose error when listeners of both
   events throw. A `Display` constructor that fails and meets such a listener as it takes itself
   down again throws an `AggregateError` of its own error and that of the listener« — eine Zeile,
   wie die Einträge daneben.

   b) `:126` (`### Changed`): »`canvas`, `start()` and `getEventProps()` throw an error that names
   the class and the state;« → »`canvas` and `getEventProps()` throw an error that names the class
   and the state, and `start()` rejects with one;«. Rest der Zeile unverändert.

   c) `:843-845` (Migration Guide, »A disposed display refuses to be used«): den ersten Satz
   ersetzen durch: »`Display#canvas` and `#getEventProps()` throw once `dispose()` has run, and
   `#nextFrame()` is rejected — both a call made afterwards and a promise that was still open when
   `dispose()` ran. `#start()` rejects as well: a call made afterwards at once, and one still
   waiting for the renderer or its `beforeStartCallback` once that wait is over. It is `async`, so
   the rejection reaches an `await` or a `.catch()`, not a `try` around a call that is not
   awaited.« Zeilenumbruch wie der umgebende Absatz (umgebrochen bei ~100 Zeichen). Der Rest des
   Abschnitts bleibt.

7. `pnpm format`, falls `pnpm lint` Prettier-Abweichungen meldet; dann das Verify-Kommando.

## Findings im Volltext

**Dispose-Abbruch · low · `packages/twopoint5d/src/display/Display.ts:1565`** — aufgefallen in
Zug 0 von Paket 1, vorbestehend. Wortlaut der Queue:
`dispose()` bricht ab, wenn ein `OnDisplayPause`-Listener (über das `stop()` in `:1565`,
laufendes Display; seit 412f4a66 auch als `AggregateError`) oder ein `OnDisplayDispose`-Listener
(`:1569`) wirft: `#disposed` steht schon, Frame-Loop-Abmeldung, `off(this)`, Rückgabe der Canvas,
Freigabe des Renderers und Entfernen des Containers bleiben aus, ein zweites `dispose()` kehrt in
`:1562` sofort zurück.
Empfehlung (aus dem Ziel des Plans): `dispose()` räumt vollständig auf und meldet die Fehler
werfender Listener erst danach.

**TSDoc start() nach dispose() · info · `packages/twopoint5d/src/display/Display.ts`** —
aufgefallen in Zug 2 von Paket 1, vorbestehend. Wortlaut der Queue:
TSDoc von `start()` (Absatz »Throws after {@link Display.dispose}«) und Punkt 4 der Klassen-TSDoc
sagen, `start()` »throws« nach `dispose()`; `start()` ist `async` und rejected, ein `try` ohne
`await` fängt nichts.
Empfehlung (aus dem Ziel des Plans): die TSDoc beschreibt die Rejection von `start()` nach
`dispose()` richtig.

## Urteil des Reviewers

- **Dispose-Abbruch — behoben.** `Display.ts:1589` sammelt die Fehler; `stop()` und
  `emitStrict(this, OnDisplayDispose, this)` stehen je in eigenem `try/catch`, `off(this)`,
  Canvas-Rückgabe, `#releaseRenderer()` und `#ownContainer.remove()` laufen durch; geworfen wird ab
  `Display.ts:1621`. Konstruktor-`catch` `Display.ts:1082` bündelt zu `AggregateError`. Tests
  `Display.spec.ts:1052`, `:1081`, `:1105`, `:1127`, `:1171`. Doku `Display.ts:448`, `:1570`, `:1791`,
  `resource-lifecycle.md` §4 ab `:166`, `CHANGELOG.md:222`.
- **TSDoc start() nach dispose() — behoben.** `Display.ts:1490` (»Rejects after …«), Klassen-TSDoc
  Punkt 4 `Display.ts:468`, `CHANGELOG.md:126`, Migration Guide `CHANGELOG.md:843-848`, Testname
  `display-dispose.test.js:218` samt Prüfung, dass der Aufruf synchron nichts wirft.

## Kleine Befunde

- `packages/twopoint5d/CHANGELOG.md:848` — der neu umgebrochene Absatz im Migration Guide »A disposed
  display refuses to be used« hat eine Zeile mit rund 150 Zeichen (»… not a `try` around a call that
  is not awaited. `#resize()`, `#renderFrame()`, …«); der alte Rest dahinter wurde nicht neu umbrochen.
  Rein kosmetisch, Markdown rendert gleich.
