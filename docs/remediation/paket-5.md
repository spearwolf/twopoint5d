# Paket 5 — DisplayFullscreen und Display

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: RES-002 (medium), BUG-002 (medium), ASYNC-001 (medium), ASYNC-002 (medium), BUG-003 (medium), TEST-001 (medium), BUG-008 (low), BUG-009 (low), API-001 (low), CONS-012 (info)
- Dazu (Zug 0, vorbestehend, gleiche Ursache — die Antwort eines Landscape-Requests wird nicht gegen den Zustand des Controllers gehalten): der Then-Handler in `#turned()` (`DisplayFullscreen.ts:566-568`) schaltet nach einem `dispose()` scharf, weil `#onLandscape` dabei stehen bleibt — eine Ablehnung, die nach dem `dispose()` eintrifft, hängt Tap-Listener an einen entsorgten Controller. `git show d9b648bf:packages/twopoint5d/src/display/DisplayFullscreen.ts` ist identisch mit dem heutigen Stand.
- Ziel: Fullscreen-Requests, Exits und Dispose überstehen werfende Listener und überlappende Aufrufe ohne hängenden Zustand, und ihr Verhalten nach `dispose()` ist dokumentiert.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/display/DisplayFullscreen.ts`
  - `packages/twopoint5d/src/display/DisplayFullscreen.spec.ts`
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d-testing/test/display-fullscreen.test.js`
  - `packages/twopoint5d/docs/display.md` (Abschnitt »Fullscreen« und Cheat Sheet »The fullscreen«)
  - `packages/twopoint5d/docs/proposals/display-fullscreen.md` (§3.2, §3.3, §6.2, §6.3, §9, §13.1)
  - `packages/twopoint5d/docs/resource-lifecycle.md` (nur der Auszug von `Display.dispose()` in §4)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`, Einträge unter »Added«)

## Entscheidungen dieses Zugs 0

Jede mit Grund; der Implementierer folgt ihnen, ohne sie neu abzuwägen.

1. **Listener-Fehler von `OnDisplayFullscreenChange` gehen über `emitSafe()`.** Der Host in
   `Display.ts` schickt das Event mit `emitSafe(this, OnDisplayFullscreenChange, props)` statt
   `emit(...)`. eventize 6.3 fängt dort den Wurf, meldet ihn über `console.warn`, lässt jeden
   weiteren Listener hören und schreibt den retained Wert. Grund: Das Event geht aus
   Promise-Fortsetzungen (`request()`, `exit()`), aus DOM-Handlern (`fullscreenchange`, Drehung,
   Tap, Escape) und aus `dispose()` hinaus — keiner davon hat einen Aufrufer, dem der Fehler
   zustünde, und ein Promise, das »never rejects« verspricht, kann ihn nicht tragen. Die Library
   hat dafür einen Präzedenzfall: `TextureStore` (`src/texture/TextureStore.ts:135-137`, `:790-793`,
   `:962`). Das ist die erste der beiden Optionen der Audit-Empfehlung zu BUG-002;
   `queueMicrotask(() => { throw error })` und `reportError` entfallen (Node hat kein
   `reportError`, und ein Microtask-Throw ließe die Vitest-Läufe als unhandled scheitern).
   `DisplayFullscreenHost#emit` bekommt in seiner TSDoc den Vertrag: wirft nicht; ein Listener,
   der wirft, wird gemeldet und ändert nichts.
2. **Zustand zuerst, Event zuletzt.** Unabhängig von 1 setzt `DisplayFullscreen` an jedem
   Einstiegspunkt erst seinen ganzen Zustand und emittiert dann genau einmal über
   `#emitIfChanged()`. Grund: Ein Listener, der während des Events zurück in den Controller ruft
   (`toggle()` beim Betreten), muss einen fertigen Zustand vorfinden — heute findet er das noch
   gesetzte `#pending` und bekommt das Promise des gerade beantworteten Requests zurück.
3. **`Display#dispose()` fasst `this.#fullscreen?.dispose()` trotzdem in try/catch** und sammelt
   den Fehler in `errors` wie Pause- und Dispose-Fehler (Empfehlung RES-002). Nach 1 kommt von dort
   kein Listener-Fehler mehr; der try/catch hält den Teardown gegen einen internen Wurf zusammen
   (resource-lifecycle.md §4). Weil `errors` damit drei Quellen hat, wird die Meldung des
   `AggregateError` allgemein (Schritt 8).
4. **Ein gestapelter Fullscreen über dem Ziel bleibt `isActive === false`** (Proposal §3.2, Klassen-
   TSDoc: das Ziel ist das oberste Fullscreen-Element seiner Wurzel), aber der Controller behält
   `#activeElement`, `#entered` und das Lock, solange das Ziel noch im Fullscreen-Stapel steht. Das
   ist die zweite Option der Empfehlung zu BUG-008; die erste (gestapelt = aktiv) widerspräche dem
   gebauten und dokumentierten `isActive`.
5. **Ein `exit()` trägt, wer es angestoßen hat** (`'call'` oder `'portrait'`). Grund: Proposal §6.3
   verlangt, dass jedes Verlassen im Querformat eines von `onLandscape` betretenen Fullscreens das
   Scharfschalten zurückhält — ausdrücklich auch ein Exit-Button der Seite, der `exit()` ruft. Nur
   der Exit, den die Drehung ins Hochformat selbst ausgelöst hat, zählt nicht als Ablehnung; sonst
   setzt schnelles Hin- und Zurückdrehen `#declined` und hält die Seite im Querformat unscharf.
6. **Nach `dispose()`** (API-001, resource-lifecycle.md §3, Entscheidung »never rejects« vom
   2026-10-31): `request()`/`exit()`/`toggle()` resolven `false`; ein beim `dispose()` offenes
   Promise ebenso. `isActive` und `mode` lesen weiter das Dokument (der Zustand der Seite ist keine
   Ressource des Controllers — ein Member über reine Werte arbeitet weiter, §3). `isAvailable`
   antwortet `false`: es sagt »ein Request kann gelingen«, und das stimmt nach `dispose()` nicht
   mehr; ein Button, der sich danach richtet, verschwindet. `isSupported` liest weiter den Browser.
   Neu: `get isDisposed(): boolean`, gleichnamig mit `Display#isDisposed` — der Lookbook-Navbar und
   jeder andere, der eine Referenz über `display.fullscreen` hält, verzweigt darauf.
7. **Dispose bei gestapeltem Fullscreen verlässt nichts.** `exitFullscreen()` nähme das oberste
   Element vom Stapel, also das fremde (`<video>`, Dialog der App). Steht im Proposal §9, nicht im
   Guide.
8. **CONS-012: beide Optionen der Empfehlung.** Die Warnung `warnUnavailable()` nennt die
   unpräfixierte API, und `display.md` nennt Safari vor 16.4 beim Pseudo-Fallback. Sie schließen
   sich nicht aus, und so sagen Konsole und Guide dasselbe. Keine `webkit`-Präfixe im Code
   (Proposal §15 bleibt).
9. **Kein Test für das `fullscreenerror`-Event** (Abweichung von der Empfehlung zu TEST-001). Der
   Controller liest die Antwort aus dem Promise von `requestFullscreen()`, das jeder Browser mit der
   unpräfixierten API liefert; das Event trägt nichts darüber hinaus, und ein Listener darauf hörte
   dieselbe Ablehnung zweimal. Die Ablehnung über das Promise ist getestet
   (`DisplayFullscreen.spec.ts:157`).
10. **CHANGELOG:** `DisplayFullscreen` steht vollständig unter `## [Unreleased]` → »Added« (seit
    0.24.0 unveröffentlicht). Es entsteht kein »Fixed«-Eintrag; die bestehenden Added-Einträge zu
    `display.fullscreen`, `onLandscape` und `OnDisplayFullscreenChange` werden ergänzt.

## Vorgehen

Regressionstest zuerst, rot sehen, dann beheben — für jeden Schritt, der einen Korrektheitsfehler
behebt (Schritte 2–8). Die roten Läufe gehören in den Report. Kommentare und Doku auf Englisch,
ohne Finding-IDs und ohne Rückblick auf den Vorzustand (»Konventionen« im Plan-Kopf).

### 1. `DisplayFullscreen`: Zustand und Event trennen

In `DisplayFullscreen.ts`:

- `#syncState()` (`:452-471`) wird geteilt: `#readState(): void` enthält alles bis vor
  `this.#emitIfChanged()` (inklusive der Rückkehr bei `#disposed`), `#syncState()` ruft
  `#readState()` und danach `#emitIfChanged()`. Der `fullscreenchange`-Listener `#onFullscreenChange`
  bleibt bei `#syncState()`.
- `#leavePseudo()` (`:598-616`) und `#disarm()` (`:628-635`) ändern nur noch Zustand; der Aufruf von
  `#emitIfChanged()` am Ende beider entfällt. Jeder Aufrufer emittiert nach seiner ganzen
  Zustandsänderung genau einmal:
  - `#onPseudoKey` (Escape): `#leavePseudo(); #emitIfChanged();`
  - `exit()` im Pseudo-Modus: siehe Schritt 5
  - `set onLandscape(false)`: nach `#unwatchOrientation(); #disarm(); #declined = false;` ein
    `#emitIfChanged()`, vor `#warnConflicts()`
  - `#onArmedTap`: siehe Schritt 6
  - `#turned()` im Hochformat: siehe Schritt 5
  - `dispose()`: siehe Schritt 3
- `#arm()` und `#enterPseudo()` emittieren weiter selbst; sie stehen in jedem Aufrufer am Ende.

### 2. Listener-Fehler (BUG-002, RES-002) — Host in `Display.ts`

- Im Host, den der Konstruktor an `new DisplayFullscreen(...)` gibt (`Display.ts:1150-1156`):
  `emit(this, OnDisplayFullscreenChange, props)` → `emitSafe(this, OnDisplayFullscreenChange, props)`;
  `emitSafe` kommt in den Import aus `@spearwolf/eventize` am Dateianfang von `Display.ts`. Der Kommentar dort
  sagt, warum: kein Aufrufer, dem der Fehler zustünde; ein Listener, der wirft, wird über
  `console.warn` gemeldet, und jeder weitere hört das Event.
- `DisplayFullscreenHost#emit` (`DisplayFullscreen.ts:107-108`), TSDoc: »Puts
  `OnDisplayFullscreenChange` on the display. Never throws: a listener that throws is reported and
  changes nothing.«
- TSDoc von `Display#onFullscreenChange` (`Display.ts:2197-2204`): ein Satz, dass jeder Listener das
  Event hört, auch hinter einem, der wirft, und dass ein werfender Listener auf der Konsole gemeldet
  wird und weder den Fullscreen noch ein Promise von `request()`/`exit()`/`toggle()` ändert.
- Regressionstests in `Display.spec.ts`, `describe('fullscreen')` (Stubs wie im Test
  `dispose() leaves a fullscreen the controller entered before it releases the renderer`,
  `:2855-2880`; `console.warn` mit `vi.spyOn(...).mockImplementation(() => {})` stumm schalten und
  auf den gemeldeten Fehler prüfen):
  - `a fullscreen listener that throws: request() resolves true, toggle() leaves, and the next request() asks the browser again`
    — zwei Listener über `display.onFullscreenChange()`, der erste wirft bei jedem Event; erwartet:
    `request()` resolved `true`, `toggle()` resolved `false` und ruft `doc.exitFullscreen` einmal,
    ein weiteres `request()` resolved `true`, `parent.requestFullscreen` zweimal gerufen, der zweite
    Listener hat jedes Event gehört. Vor dem Fix rot (das Request-Promise lehnt mit dem Fehler ab).
  - `exit() in the pseudo mode resolves false behind a fullscreen listener that throws` —
    `doc.fullscreenEnabled = false`, `fullscreen: {fallback: 'pseudo'}`; vor dem Fix wirft `exit()`
    synchron.
  - `dispose() runs to its end behind a fullscreen listener that throws while the pseudo mode holds`
    — Pseudo-Modus betreten, dann einen werfenden Listener anhängen, einen `OnDisplayDispose`-Listener
    dazu; erwartet: `dispose()` wirft nicht, `OnDisplayDispose` gehört, `display.isDisposed`,
    `getSubscriptionCount(display) === 0`, nach `settle()` `renderer.dispose` einmal gerufen. Vor dem
    Fix rot (`dispose()` wirft vor `OnDisplayDispose`).

### 3. `DisplayFullscreen#dispose()` (RES-002, ASYNC-001, API-001)

Neue Reihenfolge in `dispose()` (`DisplayFullscreen.ts:370-396`):

1. `if (this.#disposed) return;` dann sofort `this.#disposed = true;` — ein Listener des Events
   am Ende, der zurück in den Controller ruft, und jede späte Promise-Fortsetzung finden ihn
   entsorgt.
2. `this.#element ??= this.element;` (wie heute, mit Kommentar).
3. `this.#pending = undefined; this.#pendingExit = undefined;` — der offene Request ist damit nicht
   vergessen: sein Fulfilment-Handler hält ihn in seiner Closure (`request` in `#request()`) und
   verlässt nach der Gewährung, was er betreten hat (Schritt 4).
4. `#leavePseudo()` (ohne Event, Schritt 1).
5. Native Exit wie heute (`#entered != null && #nativeElement() != null`, `exitFullscreen()` mit
   gefangenem Promise und try/catch). Bei gestapeltem Fullscreen (Schritt 7) liefert
   `#nativeElement()` `undefined`, und es wird nichts verlassen (Entscheidung 7).
6. `#unlock(); #unwatchOrientation(); #disarm();` Listener `fullscreenchange` vom Dokument nehmen,
   `#activeElement = undefined; #entered = undefined;`.
7. Zuletzt `this.#emitIfChanged();` — ein Event für alles zusammen (Pseudo verlassen, entschärft).
   Wirft der Host doch (nur ein Spec-Stub kann das), kommt der Wurf erst nach dem vollständigen
   Teardown heraus.

Regressionstests in `DisplayFullscreen.spec.ts`, `describe('dispose()')`:

- `dispose() takes everything down before its one event: a host whose emit throws finds the pseudo mode left and no listener left`
  — `doc.fullscreenEnabled = false`, `fallback: 'pseudo'`, `onLandscape` aus; `request()`; dann
  `host.emit` durch einen werfenden ersetzen; `expect(() => fs.dispose()).toThrow(error)`; danach:
  `doc.listenerCount('keydown') === 0`, `doc.listenerCount('fullscreenchange') === 0`,
  `fs.isDisposed === true`, ein zweites `dispose()` wirft nicht. Vor dem Fix rot (der Wurf kommt aus
  `#leavePseudo()`, bevor die Listener abgebaut sind).
- dasselbe für den scharfen Zustand: in `describe('onLandscape')`
  `dispose() of an armed controller takes the orientation and tap listeners down before its one event`
  — Seite lädt im Querformat (`orientation.type = 'landscape-primary'`), also `isArmed`; werfender
  `host.emit`; nach dem Wurf aus `dispose()`: `orientation.listenerCount('change') === 0`,
  `defaultTarget.listenerCount('pointerup') === 0`, `defaultTarget.listenerCount('click') === 0`.

### 4. Offener Request beim `dispose()` und Fulfilment-Handler (ASYNC-001, BUG-002)

Der Fulfilment-Handler in `#request()` (`DisplayFullscreen.ts:436-442`) wird:

```ts
() => {
  if (this.#disposed) {
    // granted after the dispose: this controller asked for it, and nothing follows it any more
    if (fullscreenElementOfRoot(request.element) === request.element) leaveQuietly(this.#host.doc);
    return false;
  }
  this.#readState();
  this.#pending = undefined;
  if (request.exitAfter != null) {
    // a call or a turn asked to leave while the browser was still answering: leave what it granted
    this.#emitIfChanged();
    return this.#exit(request.exitAfter);
  }
  if (this.#nativeElement() != null) this.#lock();
  this.#emitIfChanged();
  return this.isActive;
}
```

- `leaveQuietly(doc: Document): void` ist eine Modulfunktion mit dem heutigen Muster aus
  `dispose()`: `try { doc.exitFullscreen().catch(() => {}); } catch { /* … */ }`. `dispose()`
  (Schritt 3.5) ruft dieselbe Funktion.
- `#readState()` liest `#pending?.by` für `#entered`, solange `#pending` noch gesetzt ist — darum
  steht `this.#pending = undefined` danach und vor dem Event.
- Der Rejection-Handler (`:443-447`): `this.#pending = undefined;` und, nur wenn nicht `#disposed`,
  `warnRefused()`; Rückgabe `false`.
- `request.exitAfter`: Schritt 5. Der Typ `PendingRequest` (`:82-86`) bekommt
  `exitAfter?: ExitBy`.

Regressionstests (`describe('dispose()')`, Muster des manuellen `grant()` aus
`DisplayFullscreen.spec.ts:278-296`):

- `dispose() while a request is pending: the controller leaves the fullscreen the browser grants afterwards, and the request resolves false`
  — mit `orientationLock: 'landscape'` und einem Orientation-Stub in `view.screen`; erwartet nach
  `grant()`: `doc.exitFullscreen` einmal, Promise `false`, `orientation.lock` nie gerufen. Vor dem Fix
  rot (`exitFullscreen` nie, Promise `true`, `lock` gerufen).
- `dispose() while a lock is pending: the lock is undone once the browser grants it` — Request
  gewährt, `orientation.lock` liefert ein manuell aufgelöstes Promise, `dispose()`, dann die Lock
  auflösen; erwartet `orientation.unlock` einmal und `fs.exitOnPortrait === true` (nicht gesperrt).
  Deckt den Zweig `DisplayFullscreen.ts:486` ab; darf vor dem Fix grün sein (Abdeckung, kein Bug).
- `two request() calls while the browser has not answered share one request` — `requestFullscreen`
  einmal, beide Aufrufe geben dasselbe Promise-Objekt zurück, beide resolven `true`. Abdeckung.
- `a listener of the change a granted request causes finds the request settled: its toggle() leaves`
  — `host.emit` ruft beim ersten Event mit `isActive: true` einmal `fs.toggle()`; erwartet
  `doc.exitFullscreen` einmal und das Request-Promise resolved `false`. Vor dem Fix rot (`toggle()`
  bekommt das noch gesetzte `#pending.promise`, nichts wird verlassen).

### 5. Laufender Exit als Zustand (ASYNC-002)

Neue Typen und Felder in `DisplayFullscreen.ts`:

```ts
/** Who asked to leave: a call of exit() or toggle(), or the turn to portrait of onLandscape. */
type ExitBy = 'call' | 'portrait';

// a native exit until its promise settles: who asked, the answer
interface PendingExit {
  by: ExitBy;
  promise?: Promise<boolean>;
}

#pendingExit?: PendingExit;
```

- `exit(): Promise<boolean>` wird `return this.#exit('call');`. Die Logik zieht nach
  `#exit(by: ExitBy): Promise<boolean>`:
  1. `#disposed` → `Promise.resolve(false)`.
  2. Pseudo-Modus → `#leavePseudo(); #emitIfChanged(); return Promise.resolve(this.isActive);`
  3. `#pendingExit != null` → dessen Antwort: ein Exit, den der Browser noch nicht beendet hat,
     beantwortet einen zweiten.
  4. `#pending != null` (ein Request ist offen) → `request.exitAfter = by` am offenen Request
     vermerken und `Promise.resolve().then(() => request.promise ?? this.isActive)` zurückgeben. Der
     Fulfilment-Handler (Schritt 4) verlässt nach der Gewährung und resolved mit dem Ergebnis dieses
     Exits; das Request-Promise und das Exit-Promise enden beide mit `isActive` danach. Das
     `Promise.resolve().then(...)` deckt den Fall, dass ein synchron gefeuertes `fullscreenchange`
     während `requestFullscreen()` diesen Aufruf auslöst, bevor `request.promise` gesetzt ist.
  5. `#nativeElement() == null` → `Promise.resolve(this.isActive)` (der gestapelte Fall, wie heute).
  6. Sonst `const exit: PendingExit = {by}; this.#pendingExit = exit;` vor dem Aufruf, dann
     `exitFullscreen().then(settle, settle)` bzw. im catch `Promise.resolve(settle())`;
     `exit.promise = …`. `settle`:
     ```ts
     const settle = (): boolean => {
       if (this.#disposed) return false;
       this.#readState();
       this.#pendingExit = undefined;
       this.#emitIfChanged();
       // a turn back to landscape while the exit of the turn to portrait was under way
       if (exit.by === 'portrait') this.#turned();
       return this.isActive;
     };
     ```
- `#readState()`: beim Verlassen setzt es `#declined` nur noch, wenn nicht
  `this.#pendingExit?.by === 'portrait'` (Entscheidung 5). Der Browser setzt das Fullscreen-Element
  zurück, bevor er das Promise von `exitFullscreen()` auflöst, und feuert `fullscreenchange` erst
  danach (Kommentar am Host in `Display.ts:1151-1153`); `settle` liest den Zustand also, solange
  `#pendingExit` noch gesetzt ist.
- `#request(by, warn)` (`:409-450`): nach der `#disposed`-Prüfung und vor
  `if (this.isActive) return Promise.resolve(true)` neu:
  `if (this.#pendingExit != null) { const exit = this.#pendingExit; return Promise.resolve().then(() => exit.promise).then(() => this.#request(by, warn)); }`
  — ein Request während eines Exits entscheidet nach dessen Ende neu. Die Aktivierung des Nutzers
  ist dann noch transient gültig; lehnt ein Browser trotzdem ab, resolved der Request `false`, und
  `onLandscape` schaltet über Schritt 6 scharf (Entscheidung vom 2026-10-31 zur User-Aktivierung:
  beide Antworten des Browsers werden korrekt behandelt).
- `toggle()` (`:352-357`): nach dem bestehenden `#pending`-Zweig
  `if (this.#pendingExit != null) return this.exit();` (teilt die Antwort über 5.3).
- `#enteredBy()` (`:571-573`) wird `this.#pseudo?.by ?? this.#entered ?? this.#pending?.by` — eine
  Drehung ins Hochformat bei offenem Landscape-Request (Armed-Tap, Versuch der Drehung) verlässt nach
  der Gewährung.
- `#turned()` im Hochformat (`:550-555`): `this.#declined = false; this.#disarm();` dann
  `if (this.#enteredBy() === 'landscape' && this.exitOnPortrait) void this.#exit('portrait');` und
  danach `this.#emitIfChanged();`.
- `#turned()` im Querformat: vor `if (this.isActive || …)` neu
  `if (this.#pendingExit != null) return;` — `settle` ruft `#turned()` nach dem Exit der Drehung
  erneut auf (5.6).

Regressionstests (`describe('exit()')` bzw. `describe('onLandscape')`; ein `exitFullscreen`, das
ein manuell aufgelöstes Promise liefert und `fireFullscreenChange(null)` erst beim Auflösen ruft):

- `request() while an exit is under way asks the browser again once the exit is through` — vor
  dem Fix rot (resolved sofort `true`, `requestFullscreen` nicht erneut gerufen).
- `exit() while a request is pending leaves once the browser has granted it` — erwartet
  `doc.exitFullscreen` einmal nach `grant()`, Exit- und Request-Promise resolven `false`. Vor dem
  Fix rot.
- `toggle() and exit() while an exit is under way answer with that exit` — `doc.exitFullscreen`
  einmal.
- `a turn to portrait while the request of a turn is pending leaves once the browser grants it` —
  vor dem Fix rot (Fullscreen bleibt im Hochformat).
- `a turn back to landscape while the exit of the turn to portrait is under way enters again once the exit is through`
  — `requestFullscreen` ein zweites Mal gerufen; mit einer Ablehnung beim zweiten Mal stattdessen
  `isArmed === true`. Vor dem Fix rot.
- `an exit() of the page in landscape still holds off the arming` — `onLandscape`, betreten durch
  die Drehung, `fs.exit()` im Querformat, danach `turn('landscape-secondary')`: kein neuer Request,
  `isArmed === false` (Proposal §6.3 hält).

### 6. Armed-Tap und Antwort eines Landscape-Requests (BUG-009, Nebenbefund aus Zug 0, BUG-002)

- Neue Methode `#rearm(active: boolean): void`:
  `if (!active && !this.#disposed && this.#onLandscape && this.#isLandscape() && !this.isActive && !this.#declined) this.#arm();`
- `#turned()` (`:566-568`): `void this.#request('landscape', false).then((active) => this.#rearm(active));`
- `#onArmedTap` (`:189-195`):
  ```ts
  this.#disarm();
  // synchronously in the handler of the tap: the gesture reaches the browser
  const answer = this.#request('landscape');
  this.#emitIfChanged();
  void answer.then((active) => this.#rearm(active));
  ```
  Die Anfrage geht vor dem Event hinaus.

Regressionstests (`describe('onLandscape')`):

- `an armed tap the browser refuses arms again` — beide Requests abgelehnt; nach `tap()` und
  `flush()` `isArmed === true`, `emitted.at(-1)` mit `isArmed: true`. Vor dem Fix rot.
- `a refusal that arrives after dispose() arms nothing` — Drehung ins Querformat mit einem
  manuell abgelehnten Request, `dispose()`, dann ablehnen, `flush()`;
  `defaultTarget.listenerCount('pointerup') === 0`. Vor dem Fix rot.
- `the armed tap asks the browser before it emits` — `host.emit` wirft ab dem Tap; `tap()` in
  try/catch; `requestFullscreen` zweimal gerufen (Drehung, Tap). Vor dem Fix rot (`#disarm()` warf
  vor dem Request).

### 7. Gestapelter Fullscreen (BUG-008)

- Neue Modulfunktion in `DisplayFullscreen.ts`:
  ```ts
  // The element is in the fullscreen stack of its root, under another element on top: `:fullscreen`
  // matches every element of the stack, and the fullscreen element of the root lies inside it when
  // a video or a dialog of the app goes fullscreen within it. Read with optional calls, and a browser
  // that does not know the pseudo-class throws a SyntaxError
  function isInFullscreenStack(element: HTMLElement): boolean
  ```
  Implementierung: `let matches = false; try { matches = element.matches?.(':fullscreen') === true; } catch { matches = false; }`;
  `if (matches) return true;` dann
  `const top = fullscreenElementOfRoot(element); return top != null && top !== element && element.contains?.(top) === true;`
- `#readState()`, Zweig `else if (this.#activeElement != null)` (`:461-468`): steht
  `isInFullscreenStack(this.#activeElement)`, bleiben `#activeElement`, `#entered`, `#declined` und
  das Lock unberührt; `#emitIfChanged()` meldet trotzdem `isActive: false` (ein anderes Element
  liegt oben). Sonst wie heute.
- Klassen-TSDoc (`:114-127`): ein Satz zum gestapelten Fall — `isActive` ist `false`, solange ein
  anderes Element oben liegt; danach gehört der Fullscreen dem Controller wieder wie vorher.

Regressionstests (`describe('state')`; der Target-Stub bekommt dafür `matches` und `contains` als
`vi.fn`):

- `a fullscreen stacked on the target: isActive is false while it holds, and the target is the controller's own again once it is left`
  — `orientationLock: 'landscape'` mit Orientation-Stub; `request()`; Kind gestapelt
  (`fireFullscreenChange(child)`, `defaultTarget.matches(':fullscreen') === true`); erwartet
  `fs.isActive === false`, Event mit `isActive: false`, `orientation.unlock` nicht gerufen; Kind
  verlässt (`fireFullscreenChange(defaultTarget)`); `fs.isActive === true`; `fs.dispose()` ruft
  `doc.exitFullscreen`. Vor dem Fix rot (`unlock` gerufen, `dispose()` verlässt nichts).
- `onLandscape`: `a fullscreen stacked on one onLandscape entered: the turn to portrait leaves it once the stack is down`.
- Browser, `packages/twopoint5d-testing/test/display-fullscreen.test.js`, `describe('native')`:
  `a fullscreen an element inside the target stacks on it: isActive is false while it holds, and dispose() leaves the target once it is on top again`
  — `host = makeContainer()`, darin ein `inner`-div; `display = new Display(host)`;
  `await requestWithClick(display)`; zweiter vertrauter Klick über `sendMouse`, dessen
  `click`-Handler (`{once: true}` am `document`) `inner.requestFullscreen()` ruft, und dessen
  Promise abwarten; erwartet `document.fullscreenElement === inner`,
  `display.fullscreen.isActive === false`; `await document.exitFullscreen()`; erwartet
  `document.fullscreenElement === host`, `display.fullscreen.isActive === true`; dann
  `display.dispose(); display = undefined;` und auf das nächste `fullscreenchange` am `document`
  warten; erwartet `document.fullscreenElement === null`. Der Test läuft unter allen drei Engines
  der Gruppe `renderer-free` und belegt die Annahme von `isInFullscreenStack()` am echten Browser.
  Scheitert eine Engine an der Annahme (der Stapel entsteht nicht, oder `:fullscreen` und
  `contains` erkennen das Ziel nicht), ist das `BLOCKIERT` mit der Ausgabe — kein Skip.

### 8. `Display`: Konstruktor-Reihenfolge und `dispose()` (BUG-003, RES-002)

- Im Konstruktor (`Display.ts:1060-1165`) wandern
  `doc.addEventListener('fullscreenchange', this.#onFullscreenChange);`,
  `this.#updateContainingFullscreen();` und der ganze Block `this.#fullscreen = new DisplayFullscreen(...)`
  vor `this.#startSizeWatch(); this.resize();` (`:1071-1072`), hinter die Zuweisung von
  `resizeToAttributeEl` (`:1069`). Statt des späteren `const doc = this.#doc;` liest der vorgezogene
  Block `this.#doc`. Ein Kommentar sagt, warum: ein `resizeTo`-Callback bekommt die Display schon
  bei der ersten Messung und darf `display.fullscreen` lesen, und die erste Messung kennt einen
  Fullscreen, der das Canvas schon enthält. Beides braucht nur Renderer, Dokument und Fenster, die
  hier stehen. Der Getter `fullscreen` (`:830-835`) bleibt; sein `#fullscreen == null`-Zweig ist
  danach nur noch Typverengung.
- In `dispose()` (`:2018`): `try { this.#fullscreen?.dispose(); } catch (error) { errors.push(error); }`
  mit Kommentar (Teardown-Schritt, der wirft, hält den Rest nicht auf). Die Reihenfolge in `errors`:
  Pause, Fullscreen, Dispose-Event.
- `AggregateError` am Ende (`:2045-2050`): Meldung
  `'Display#dispose(): more than one step of the teardown threw'`, `cause: errors.at(-1)`; der
  Kommentar darüber nennt die drei Quellen in ihrer Reihenfolge. TSDoc von `dispose()`
  (`:1956-1998`): der Satz zur Reihenfolge im `AggregateError` nennt den Fullscreen-Schritt zwischen
  Pause und Dispose-Event, und die Aufzählung, was `dispose()` vor der Rückkehr tut, nennt das
  Verlassen eines Fullscreens, den die Display betreten hat oder um den sie gebeten hat.
- `resource-lifecycle.md` §4, Auszug von `Display.dispose()`: der Fullscreen-Schritt mit seinem
  try/catch zwischen `this.#stopVisibilityWatch();` und dem `try { emitStrict(...) }`, und die
  neue Meldung des `AggregateError` — der Auszug zeigt genau die Regel des Abschnitts. §3 fasst
  dieses Paket nicht an (die »never rejects«-Ausnahme schreibt Paket 6).

Regressionstests in `Display.spec.ts`:

- `describe('constructor')`: `a resizeTo callback that reads display.fullscreen lets the constructor run through`
  — `makeDisplay({resizeTo: (d) => (d.fullscreen.isActive ? [1, 1] : [320, 200])})` o. ä.; vor dem
  Fix rot (`Display#fullscreen is not available: this display has been disposed`).
- `describe('dispose()')`: der bestehende Test zur Meldung (`:2170-2192`) prüft weiter
  `toContain('Display#dispose()')`, `errors` und `cause` — `cause` bleibt dort `disposeError`
  (`errors.at(-1)`).

### 9. TSDoc nach `dispose()` und `isDisposed` (API-001)

In `DisplayFullscreen.ts`, je Member ein Satz in der TSDoc (Entscheidung 6):

| Member | Satz nach `dispose()` |
| --- | --- |
| `get isDisposed()` (neu, nach `isArmed`) | `true` once the display that built this controller is disposed, and from then on |
| `request()` | resolves `false` and asks nothing; a request still open when `dispose()` runs resolves `false` as well, and a fullscreen the browser grants after the dispose is left again |
| `exit()` | resolves `false` and leaves nothing; an exit still open when `dispose()` runs resolves `false` |
| `toggle()` | resolves `false` and calls nothing |
| `isActive`, `mode` | keep answering from the document: `true` / `'native'` while anyone holds the target in fullscreen (the pseudo mode is left by `dispose()`) |
| `isArmed` | `false` |
| `isSupported` | keeps answering |
| `isAvailable` | `false` — Getter: `return !this.#disposed && (this.isSupported \|\| this.fallback === 'pseudo');` |
| `element` | answers the element it had at `dispose()`; a write is kept and changes nothing |
| `navigationUI`, `fallback` | a write changes nothing |
| `orientationLock`, `exitOnPortrait` | take a value and warn nothing; nothing locks or leaves — `#warnConflicts()` kehrt bei `#disposed` sofort zurück |
| `onLandscape` | a write changes nothing; the getter answers the last value |

- Klassen-TSDoc: ein Absatz zum Verhalten nach `Display#dispose()` — der Controller bleibt als
  gehaltene Referenz benutzbar, die Promises resolven `false`, `isDisposed` sagt es; und der Satz
  »never reject« nennt die Listener (Entscheidung 1).
- Specs: `isDisposed is false until dispose() and true after`; `isAvailable answers false after dispose()`;
  `after dispose() orientationLock and exitOnPortrait take values and warn nothing` (mit
  `onLandscape: true`, `exitOnPortrait = true` neben `orientationLock = 'landscape'` nach dem
  Dispose: keine Warnung).

### 10. Warnung und Guide zur unpräfixierten API (CONS-012)

- `warnUnavailable()` (`DisplayFullscreen.ts:32-34`), Text:
  `Display#fullscreen: native fullscreen is not available here (an iframe without allow="fullscreen", an iPhone, or a browser without the unprefixed Fullscreen API, such as Safari before 16.4). Set fullscreen.fallback = 'pseudo' for a fullscreen of CSS.`
- TSDoc von `isSupported` (`:293`): »reads the unprefixed Fullscreen API alone«.
- Spec: im bestehenden Test `a request without native support and without fallback resolves false and warns once`
  (`DisplayFullscreen.spec.ts:179`) zusätzlich
  `expect(warn).toHaveBeenCalledWith(expect.stringContaining('unprefixed Fullscreen API'))`.

### 11. Guide, Proposal, CHANGELOG

- `docs/display.md`:
  - »A fullscreen button« (Absatz nach dem Block, `:466-470`): ergänzen, dass die drei Calls nach
    `display.dispose()` `false` resolven, auch ein beim Dispose noch offener, und dass ein Listener
    von `onFullscreenChange`, der wirft, auf der Konsole gemeldet wird und weder den Fullscreen noch
    die Promises ändert.
  - »Fullscreen when the phone turns sideways« (`:493-502`): ein Satz — lehnt der Browser auch den
    Tap ab, bleibt die Display scharf für den nächsten; eine Drehung zurück ins Querformat, während
    der Fullscreen noch verlassen wird, betritt ihn danach wieder bzw. schaltet scharf.
  - »Without native fullscreen: the pseudo fallback« (`:526-529`): `isSupported` ist auch dort
    `false`, wo ein Browser nur die präfixierte API kennt — Safari vor 16.4.
  - »Which element goes fullscreen« (`:561-576`): ein Absatz zum gestapelten Fullscreen — ein Video
    oder Dialog im Ziel, der selbst in Fullscreen geht, liegt oben: `isActive` ist `false`, solange er
    hält; danach gehört der Fullscreen wieder der Display, mit Lock, `exitOnPortrait` und `dispose()`.
  - Cheat Sheet »The fullscreen« (`:627-633`): Zeile `request(), exit(), toggle()` um »`false` after
    `dispose()`« ergänzen; neue Zeile `isDisposed` — »the display is disposed; the calls resolve
    `false`«; `isAvailable` um »`false` after `dispose()`«.
- `docs/proposals/display-fullscreen.md` (Entwicklerdoku, beschreibt den Bau, kein Rückblick):
  §3.2 (laufender Exit: beantwortet ein zweites `exit()`/`toggle()`, ein `request()` entscheidet nach
  seinem Ende neu; ein `exit()` bei offenem Request verlässt nach der Gewährung; der gestapelte Fall
  behält Eintritt und Lock); §3.3 (`emitSafe()`, Listener-Fehler gemeldet, ändern nichts); §6.2
  (abgelehnter Armed-Tap schaltet wieder scharf); §6.3 (Exit der Drehung ins Hochformat zählt nicht
  als Ablehnung; nach seinem Ende wird die Drehung neu ausgewertet); §9 (Dispose: Zustand zuerst,
  ein Event zuletzt; offener Request wird nach der Gewährung verlassen; Promises resolven `false`;
  `isDisposed`; die Member nach Dispose wie in Schritt 9; gestapelter Fullscreen bleibt beim
  Dispose unangetastet, Entscheidung 7); §13.1 (die neuen Testfälle als Stichpunkte).
- `CHANGELOG.md`, `## [Unreleased]` → »Added« (Skill `updating-changelog` laden): im Eintrag
  `add display.fullscreen, a DisplayFullscreen …` `isDisposed` nennen und dass ein beim `dispose()`
  offener Call und jeder danach `false` resolven, ein danach gewährter Fullscreen wieder verlassen
  wird; im Eintrag `add onLandscape …` den wieder scharf schaltenden abgelehnten Tap; im Eintrag
  `add the event OnDisplayFullscreenChange …`, dass jeder Listener es hört und ein werfender auf der
  Konsole gemeldet wird. Kein neuer Abschnitt, kein »Fixed«.

## Verify

- Während der Arbeit: `pnpm nx test twopoint5d -- src/display/DisplayFullscreen.spec.ts src/display/Display.spec.ts`
  und für den Browser-Test `pnpm test:browser` (nach `pnpm build:twopoint5d`).
- Abschluss: `pnpm run ci` — nie neben einem zweiten Gate oder Build im selben Arbeitsbaum.

## Commit

`fix(twopoint5d): hold the fullscreen of a display together through throwing listeners, overlapping calls and dispose()`

## Verlauf

- 2026-11-01 Zug 0: Detailplan steht · RES-002 unverändert in `DisplayFullscreen.ts:378/:391`,
  in `Display.ts` gewandert (`#fullscreen?.dispose()` :2018 statt :2009, Host-`emit` :1150-1156
  statt :1148 — Paket 1 hat `Display.ts` bewegt) · BUG-002 unverändert (`:436-448`, `:355`,
  `:332-335`, `:192-194`) · ASYNC-001 unverändert (`:381`, `:437-441`) · ASYNC-002 unverändert
  (`:412`, `:338`, `:553`, `:557`) · BUG-003 gewandert (Getter :830, `resize()` :1072,
  `new DisplayFullscreen` :1142, `#updateContainingFullscreen()` :1140) · TEST-001 unverändert
  (Spec `:335-369`, `:486`; `:566` prüft `#disposed` entgegen dem Audit nicht → Nebenbefund oben,
  Schritt 6) · BUG-008 unverändert (`:404`, `:456-468`) · BUG-009 unverändert (`:189-195`) ·
  API-001 unverändert (`:128`, `:245`, `:285`, `:324`) · CONS-012 unverändert (`:33`, `:295`;
  `Display.ts` `containingFullscreenOf()` :104-110, Listener :1139) · offene Folgen: keine für
  dieses Paket (die Folge aus Paket 4 gehört Paket 6) · »Offene Befunde«: keiner teilt die Ursache,
  alle bleiben liegen · Restplan: Reihenfolge und Schnitt unverändert; Paket 6 bekommt im Plan die
  Zeile »Aus Paket 5 (Zug 0)« mit dem, was seine §3-Ausnahme über `DisplayFullscreen` sagen muss
- 2026-11-01 Zug 1: Implementierer Runde 0 beauftragt · opus, Effort high · Brief
  `paket-5.impl-0.brief.txt`, Report nach `paket-5.impl-0.json`
- 2026-11-01 Zug 2: Report FERTIG (Session 680ce707-92b0-490d-a079-68628f8a026c) · geändert:
  `DisplayFullscreen.ts`, `DisplayFullscreen.spec.ts`, `Display.ts`, `Display.spec.ts`,
  `display-fullscreen.test.js`, `docs/display.md`, `docs/proposals/display-fullscreen.md`,
  `docs/resource-lifecycle.md`, `CHANGELOG.md` · 24 Specs vorher rot belegt, 5 »vorher grün,
  Abdeckung« · Arbeitsbaum schmutzig · eigener Verify `paket-5.verify.log` exit=0
- 2026-11-01 Zug 3: Reviewer Runde 0 beauftragt · opus, Effort high · Diff `paket-5.diff` (2448 Zeilen,
  9 Dateien) · Report nach `paket-5.review-0.json`
- 2026-11-01 Zug 3: Urteil Runde 0 (Session 153df086-d494-4f2c-8b20-2b0f87ae0b1a) — alle zehn Findings
  und der `#turned()`-Nebenbefund behoben · wichtig: (1) gestapelter Fullscreen in `#turned()`/
  `#rearm()`/`set onLandscape(true)` als »nicht im Fullscreen« gelesen, (2) Browser-Test wartet die
  `fullscreenchange`-Events nicht ab · klein: (3) `exitAfter='portrait'` bleibt nach Rückdrehung,
  (4) `#rearm()` ohne Prüfung auf offenen Request/Exit, (5) `settle` → `#turned()` rekursiv bei
  werfendem `exitFullscreen()`, (6) `dispose()` während laufendem Exit ruft zweites
  `exitFullscreen()`, (7) `display.md:590-592` verspricht Lock/`exitOnPortrait` im Stapel,
  (8) Changed-Eintrag zur neuen `AggregateError`-Meldung von `Display#dispose()` fehlt
- 2026-11-01 Zug 4 Runde 1: offen 1–8 (alle mitgegeben) · Resume derselben Session 680ce707, opus,
  Effort high · Brief `paket-5.impl-1.brief.txt`, Report nach `paket-5.impl-1.json`
  → zurück: FERTIG, 1–8 behoben (7 rote Specs vor dem Fix, Browser-Gegenprobe rot unter allen drei
  Engines), Changed-Eintrag im CHANGELOG, Proposal §6.2/§6.3/§13 nachgezogen · Verify
  `paket-5.verify-1.log` exit=0 · Reviewer Runde 1 per Resume (Session 153df086) auf Diff
  `paket-5.diff-1`, Report nach `paket-5.review-1.json`
- 2026-11-01 Zug 4 Runde 1, Review: 1–8 behoben, Findings weiter erfüllt · neu, von Runde 1 verursacht:
  [klein] `#exit()` überschreibt `request.exitAfter = 'call'` mit `'portrait'`, die Rückdrehung nimmt
  es zurück, ein `exit()` der Seite geht verloren (`DisplayFullscreen.ts:610` mit `:759`)
- 2026-11-01 Zug 4 Runde 2: offen der `exitAfter`-Befund · frischer Implementierer, opus (schon
  stärkste Stufe), Effort high · Brief `paket-5.impl-2.brief.txt`, Report nach `paket-5.impl-2.json`
  → zurück: FERTIG (Session 4eef59ab), Fix `if (request.exitAfter !== 'call')` in `#exit()`, Spec
  `an exit() while a request is pending survives a turn to portrait and back` vorher rot, Proposal §6.3
  ergänzt · meldet A (`exit()` hinter laufendem Exit der Drehung erbt `by='portrait'`) und B (`exit()`
  während offenem Request, Ablehnung schaltet scharf) · Verify `paket-5.verify-2.log` exit=0 ·
  Reviewer Runde 2 per Resume (Session 153df086) auf `paket-5.diff-2`, Report nach `paket-5.review-2.json`
- 2026-11-01 Zug 4 Runde 2, Review: `exitAfter`-Befund behoben, 1–8 und Findings weiter erfüllt · A trifft
  zu (klein, Schaden dieses Pakets) · B trifft zu (klein, in HEAD vorhanden: `HEAD:338`/`:566`) ·
  §13.1-Zeile fehlt (klein, Schaden dieses Pakets)
- 2026-11-01 Zug 4 Runde 3: offen A, B, §13.1 · B wird mitgenommen, gleiche Ursache wie der Nebenbefund
  aus Zug 0 (Antwort eines Landscape-Requests nicht gegen den Zustand gehalten) · frischer
  Implementierer, opus, Effort high · Brief `paket-5.impl-3.brief.txt`, Report nach `paket-5.impl-3.json`
  → zurück: FERTIG (Session d9553bfd), A `running.by = 'call'`, B `#declined` im Rejection-Handler
  von `#request()` für `by === 'landscape'`, C §13.1/§6.3/`display.md:513-514`; drei Specs vorher rot ·
  meldet D (zurückgestellter `request()` hinter laufendem Exit überlebt späteres `exit()`, erst im
  Arbeitsbaum entstanden) und E (`'call'` im Hochformat hält nach Rückdrehung unscharf, gewollt) ·
  Verify `paket-5.verify-3.log` exit=0 · Reviewer Runde 3 per Resume auf `paket-5.diff-3`, Report
  nach `paket-5.review-3.json`
- 2026-11-01 Zug 4 Runde 3, Review: A, B, C behoben, alles Vorige weiter erfüllt · D trifft zu (klein,
  Schaden dieses Pakets) · E trifft zu (klein, von Runde 3 verursacht: Ablehnung nach Lage bei der
  Antwort statt beim Aufruf) · neu F (`request()`→`exit()`→`request()`/`toggle()` verlässt nach
  Gewährung) und G (`request()` während Exit der Drehung wird `#entered='landscape'`), beide klein,
  Schaden dieses Pakets, seit Runde 0 · Befunde in `paket-5.review-3.befunde.md`
- 2026-11-01 Zug 4 Runde 4: offen D, E, F, G · anderer Zuschnitt: eine Regel (letzter Aufruf der Seite
  gewinnt; Ablehnung nach Lage beim Aufruf; `#entered` nach Anforderer) mit tabellengetriebener Spec
  über alle Reihenfolgen · frischer Implementierer, opus, Effort high · Brief
  `paket-5.impl-4.brief.txt`, Report nach `paket-5.impl-4.json`
  → zurück: FERTIG (Session 8015e015), Umbau mit `#run`/`#joinRun()`/`#endRun()`, `#leaveNative()`,
  `requestAfter`/`turnAfter`; Promise = Endzustand der Überlappung; 17 Specs vorher rot (Tabelle
  `overlapping calls: the last call of the page wins`, 52 Zeilen), drei bestehende Spec-Erwartungen
  begründet geändert · meldet zwei Nebenbefunde in HEAD und eine Folge · Verify `paket-5.verify-4.log`
  exit=0 · Reviewer Runde 4 per Resume auf `paket-5.diff-4` (volle Nachprüfung), Report nach
  `paket-5.review-4.json`
- 2026-11-01 Zug 4 Runde 4, Review: D, E, F, G behoben, alles Vorige weiter erfüllt, drei geänderte
  Spec-Erwartungen tragen · neu [klein, von Runde 4 verursacht]: `request()` nimmt das beim `exit()`
  gesetzte `#declined` nicht zurück (`DisplayFullscreen.ts:573-589` mit `:671`/`:684`) · Folge des
  Implementierers bestätigt: `request()` auf gewährten `onLandscape`-Fullscreen lässt
  `#entered='landscape'` (`:594`, in HEAD, aber §6.3 verspricht es jetzt) · zwei Nebenbefunde in HEAD
  bestätigt (→ »Offene Befunde«)
- 2026-11-01 Zug 4 Runde 5 (letzte): offen `#declined`-Rücknahme und `#entered` bei gewährtem
  Fullscreen · Resume der Session aus Runde 4 (8015e015), opus, Effort high — der Fehler sitzt in
  ihrer eigenen Struktur · Brief `paket-5.impl-5.brief.txt`, Report nach `paket-5.impl-5.json`
  → zurück: FERTIG, `declines` am Vorgang (`PendingRequest`/`PendingExit`), Rücknahme durch `request()`,
  `#entered`/`#pseudo.by` → 'request' bei gewährtem Fullscreen; 6 Specs vorher rot · Verify
  `paket-5.verify-5.log` exit=0 · Reviewer Runde 5 per Resume auf `paket-5.diff-5`, Report nach
  `paket-5.review-5.json`
- 2026-11-01 Zug 4 Runde 5, Review: beide Punkte behoben, alles Vorige weiter erfüllt, Folge `:657`
  trägt · neu [klein]: `DisplayFullscreen.ts:613` hebt `#entered` nur bei `#nativeElement() != null`
  an (→ Folge im Plan) · keine Runde mehr (klein, Obergrenze erreicht)
- 2026-11-01 Zug 5: Commit 4308cc70 (9 Dateien, +1928/−159), Trailer `Remediation-Run: 2026-10-31`,
  Verify `paket-5.verify-5.log` exit=0 (jünger als die letzte Codeänderung) · Plan auf `[x]`, fünf
  Nebenbefunde in »Offene Befunde«, eine Folge unter dem Paket

## Urteil des Reviewers

Reviewer opus (Session 153df086), sechs Durchgänge; Endstand nach Runde 5, Fundstellen in 4308cc70:

- RES-002: behoben — `DisplayFullscreen.ts` `dispose()` setzt `#disposed`, baut alle Listener, Lock
  und offenen Request ab und emittiert zuletzt einmal; `Display.ts` try/catch um
  `#fullscreen?.dispose()` (Sammlung in `errors`), `emitSafe` `Display.ts:1097`
- BUG-002: behoben — `emitSafe` im Host; `#pending` vor dem Event geräumt; Armed-Tap fragt vor dem
  Event; Specs in `Display.spec.ts` (`a fullscreen listener that throws: …`)
- ASYNC-001: behoben — Gewährung nach `dispose()` wird verlassen, der Lauf resolved `false`
- ASYNC-002: behoben — `#pendingExit` mit `requestAfter`/`turnAfter`, `exitAfter` am Request, ein Lauf
  (`#run`/`#endRun()`) für alle überlappenden Aufrufe; Regel »der letzte Aufruf der Seite gewinnt«
- BUG-003: behoben — `new DisplayFullscreen` vor `#startSizeWatch()`/`resize()` im Konstruktor-try
  (`Display.ts:1072-1108`)
- TEST-001: behoben — Specs zu Dispose bei offenem Request/Lock, Exit bei offenem Request, zwei
  parallelen Requests, Tabellen zu überlappenden Aufrufen; `fullscreenerror` bewusst ohne Test
  (Entscheidung 9)
- BUG-008: behoben — gestapelter Fullscreen: `isActive` `false`, Controller behält `#activeElement`,
  `#entered`, Lock; `#holdsTarget()` in `#turned()`/`#rearm()`/`set onLandscape`; `dispose()` verlässt
  nichts; Browser-Test wartet die Events ab (Gegenprobe ohne `isInFullscreenStack()` rot)
- BUG-009: behoben — `#onArmedTap` mit `#rearm()`
- API-001: behoben — TSDoc je Member, Klassen-TSDoc, `isDisposed`, `isAvailable` nach `dispose()`
- CONS-012: behoben — Warnung nennt die unprefixed Fullscreen API, `docs/display.md` Safari vor 16.4
- Nebenbefund `#turned()` aus Zug 0: behoben — `#rearm()` prüft `#disposed`

Kleine Befunde: `DisplayFullscreen.ts:613` (Folge im Plan). Alle weiteren Reviewer-Befunde der
Runden 0–4 (1–8, `exitAfter`, A–G, `#declined`-Rücknahme, `#entered` bei gewährtem Fullscreen) sind
im Commit behoben. Konventionen: keine Finding-ID, kein Rückblick in Code, Doku, CHANGELOG oder
Commit-Message.

## Findings im Volltext

**RES-002 · medium · packages/twopoint5d/src/display/Display.ts:2009** (heute :2018; weitere:
`Display.ts:1148` → :1150-1156, `DisplayFullscreen.ts:378`, `DisplayFullscreen.ts:391`) —
`#fullscreen.dispose()` in `Display#dispose()` gegen werfende Listener absichern

`Display#dispose()` ruft `this.#fullscreen?.dispose()` ohne try auf. `DisplayFullscreen#dispose()`
emittiert über `#leavePseudo()` und `#disarm()` → `#emitIfChanged()` → `host.emit` ein
`OnDisplayFullscreenChange`, und der Host der Display schickt es mit `emit()` (nicht
`emitStrict()`/gesammelt) hinaus. Wirft ein Listener — etwa ein UI-Listener, dessen Ref beim
Unmount schon `null` ist —, während der Pseudo-Modus aktiv oder `onLandscape` scharf ist
(Smartphone im Querformat, der Normalfall von `onLandscape`), bricht `Display#dispose()` nach
`#stopVisibilityWatch()` ab: kein `OnDisplayDispose`, kein `off(this)`, der Canvas des Aufrufers
wird nicht zurückgegeben, der Renderer (GPU-Device/WebGL-Kontext) wird nie freigegeben.
`#disposed` steht schon auf `true`, ein zweiter `dispose()` tut nichts mehr. In
`DisplayFullscreen#dispose()` selbst bleiben Orientation-Listener, Tap-Listener, der
`fullscreenchange`-Listener am Document und ein nativer Fullscreen stehen — alles hält die Display
am Leben. Das widerspricht resource-lifecycle.md §4 (ein werfender Listener hält den Teardown nicht
auf).

Beleg: `this.#fullscreen?.dispose();` steht zwischen `#stopVisibilityWatch()` und dem
`try { emitStrict(this, OnDisplayDispose, this) }`; Host: `emit: (props) => {
this.#updateContainingFullscreen(); emit(this, OnDisplayFullscreenChange, props); }`

Empfehlung: Den Aufruf in `Display#dispose()` in try/catch fassen und den Fehler in `errors`
sammeln wie Pause- und Dispose-Fehler. In `DisplayFullscreen#dispose()` erst den gesamten eigenen
Zustand abbauen (Listener, Exit, Unlock, `#disposed = true`) und das Event zuletzt bzw. in
`finally` schicken. Spec: ein werfender `onFullscreenChange`-Listener bei aktivem Pseudo-Modus und
bei `isArmed` lässt `dispose()` vollständig durchlaufen und wirft danach.

**BUG-002 · medium · packages/twopoint5d/src/display/DisplayFullscreen.ts:437** (weitere: `:346`,
`:333`, `:192`) — `#pending` vor dem Event räumen, damit ein werfender Listener
`request()`/`toggle()` nicht dauerhaft blockiert

Im Fulfilment-Handler von `request()` läuft erst `this.#syncState()` und danach
`this.#pending = undefined`. `#syncState()` emittiert `OnDisplayFullscreenChange` über `emit()`;
wirft ein Listener, lehnt das Request-Promise mit dessen Fehler ab — entgegen der TSDoc »never
rejects« — und `#pending` bleibt samt `promise` gesetzt. Von da an geben `request()` und `toggle()`
dasselbe abgelehnte Promise zurück (`if (this.#pending?.promise != null) return
this.#pending.promise`), die Seite kann den Fullscreen bis zum Reload weder per Toggle betreten noch
verlassen, und `#lock()` läuft nie. Das Doku-Beispiel `void display.fullscreen.toggle()` macht
daraus eine Unhandled Rejection. Dasselbe Muster: `exit()` lehnt über `settle` ab, `exit()` im
Pseudo-Modus wirft sogar synchron aus `#leavePseudo()`, und im Armed-Tap wirft `#disarm()`, bevor
`#request()` überhaupt aufgerufen wird.

Beleg: `() => { this.#syncState(); this.#pending = undefined; if (this.#nativeElement() != null)
this.#lock(); return this.isActive; }`

Empfehlung: Zustand vor dem Emit setzen (`#pending = undefined` zuerst) und das Emit des Hosts so
kapseln, dass die Promise-Verträge von `request()`/`exit()`/`toggle()` halten: Listener-Fehler mit
`emitSafe()` oder gesammelt außerhalb des Promise-Pfads melden (z. B. `queueMicrotask(() => { throw
error })` oder `reportError`). Spec mit werfendem `onFullscreenChange`-Listener: Promise resolved,
zweiter `request()` ruft `requestFullscreen` erneut auf.

**ASYNC-001 · medium · packages/twopoint5d/src/display/DisplayFullscreen.ts:381** (weitere:
`:437`) — Einen beim `dispose()` noch laufenden Fullscreen-Request nach seiner Antwort wieder
verlassen

`DisplayFullscreen#dispose()` verlässt nur einen Fullscreen mit `#entered != null &&
#nativeElement() != null`. Solange `requestFullscreen()` noch nicht beantwortet ist, ist
`document.fullscreenElement` laut Fullscreen-Spec noch `null` und `#entered` noch nicht gesetzt —
`dispose()` schickt kein `exitFullscreen()`. Kurz danach gewährt der Browser den Request: der
Zielknoten (per Default der Host um den Canvas, der im Dokument bleibt) steht im nativen
Fullscreen, ohne dass irgendein Listener ihn noch verfolgt. Realistischer Pfad: Klick auf einen
Fullscreen-Button, der zugleich eine Route wechselt oder eine Komponente unmountet. Zudem resolved
das Request-Promise nach dem `dispose()` mit `this.isActive`, also womöglich `true` —
resource-lifecycle.md §3 verlangt, dass ein beim `dispose()` offenes Promise nicht in einen Erfolg
überlebt.

Beleg: `if (this.#entered != null && this.#nativeElement() != null) { … exitFullscreen() … }`; im
Fulfilment-Handler kehrt `#syncState()` bei `#disposed` sofort zurück, `#lock()` wird trotzdem
versucht

Empfehlung: In `dispose()` einen offenen `#pending` berücksichtigen: an dessen Promise anhängen und
nach Gewährung `exitFullscreen()` rufen, falls `fullscreenElementOfRoot(pending.element) ===
pending.element`. Den Fulfilment-Handler bei `#disposed` `false` liefern lassen. Spec: `request()`,
dann `dispose()`, dann Gewährung → `exitFullscreen` wird aufgerufen, das Promise resolved `false`.

**ASYNC-002 · medium · packages/twopoint5d/src/display/DisplayFullscreen.ts:412** (weitere: `:557`,
`:338`, `:553`) — Laufendes `exit()` als Zustand führen, damit Requests und Drehungen in der
Gegenrichtung nicht verschluckt werden

Nur Requests haben einen Pending-Zustand, Exits nicht. Während `exitFullscreen()` läuft, bleibt
`fullscreenElement` laut Spec gesetzt, bis der Browser fertig ist: ein `request()` in dieser Zeit
liefert über `if (this.isActive) return Promise.resolve(true)` sofort `true`, obwohl der Fullscreen
gleich darauf endet. Mit `onLandscape` betrifft das ein schnelles Hin- und Zurückdrehen: Drehung ins
Hochformat startet `exit()`, die Drehung zurück ins Querformat trifft in `#turned()` auf `isActive
=== true` und tut nichts — danach ist die Seite im Querformat weder im Fullscreen noch scharf, bis
erneut Hochformat und zurück gedreht wird. Umgekehrt sieht `exit()` während eines offenen Requests
`#nativeElement() == null` und resolved `false`, ohne etwas zu tun; eine Drehung ins Hochformat bei
offenem Request (Armed-Tap) findet `#enteredBy()` noch `undefined` und verlässt nichts — der
Fullscreen landet im Hochformat, obwohl `exitOnPortrait` gilt.

Beleg: `if (this.isActive) return Promise.resolve(true);` in `#request()`; `if
(this.#nativeElement() == null) return Promise.resolve(this.isActive);` in `exit()`

Empfehlung: Neben `#pending` ein `#pendingExit` führen: `request()` während eines Exits an dessen
Ende anhängen (bzw. erst nach dem Exit neu entscheiden), und `exit()` bzw. die Drehung ins
Hochformat während eines Requests als Absicht merken und nach der Gewährung ausführen. `#turned()`
nach Abschluss eines Exits erneut auswerten lassen. Specs für beide Reihenfolgen.

**BUG-003 · medium · packages/twopoint5d/src/display/Display.ts:825** (heute :830; weitere: `:1065`
→ :1072, `:1135` → :1142) — `DisplayFullscreen` vor der ersten Messung des Konstruktors bauen

Der Getter `fullscreen` wirft, solange `#fullscreen == null`, mit `Display#fullscreen is not
available: this display has been disposed`. Der Konstruktor ruft `this.resize()` (Zeile 1065) — und
damit einen `resizeTo`-Callback, der die Display als Argument bekommt — gut 70 Zeilen bevor er
`#fullscreen` baut (Zeile 1135). Ein Callback, der seine Größe nach dem Fullscreen richtet (`d =>
d.fullscreen.isActive ? … : …`), lässt `new Display()` scheitern, mit einer Meldung, die eine nie
entsorgte Display für entsorgt erklärt. Auch der Fullscreen-Zustand selbst
(`#updateContainingFullscreen()`, Zeile 1133) steht erst nach dieser ersten Messung fest.

Beleg: `if (this.#disposed || this.#fullscreen == null) { throw disposedError('fullscreen'); }`

Empfehlung: `DisplayFullscreen` und den `fullscreenchange`-Listener vor
`#startSizeWatch()`/`resize()` aufbauen (beides braucht nur Renderer, `#doc` und `#view`), oder den
Getter für den Bauzustand eine eigene Meldung werfen lassen. Spec: ein `resizeTo`-Callback, der
`display.fullscreen.isActive` liest, lässt den Konstruktor durchlaufen.

**TEST-001 · medium · packages/twopoint5d/src/display/DisplayFullscreen.spec.ts:336** (weitere:
`DisplayFullscreen.ts:486`, `:566`) — DisplayFullscreen: Dispose und Exit während eines offenen
Requests testen

Die Spec deckt dispose() nur im Ruhezustand ab (Zeilen 336-370), und die Wettläufe sind
ungetestet. Der Quelltext prüft `#disposed` extra in der Fortsetzung eines laufenden
Orientation-Locks (DisplayFullscreen.ts:486) und in der Antwort eines onLandscape-Requests (:566).
Kein Test lässt einen Request oder ein `orientation.lock()` erst nach `dispose()` auflösen; ebenso
fehlen exit() bei offenem Request, zwei gleichzeitige request()-Aufrufe und das
`fullscreenerror`-Event. Genau diese Schutzzweige können still brechen, ohne dass ein Test rot wird
(Lock bleibt nach dispose gesetzt, Pseudo-Regeln bleiben im Stylesheet).

Beleg: Die Spec enthält kein Szenario, in dem ein `new Promise` aus `requestFullscreen` oder
`orientation.lock` nach `fs.dispose()` aufgelöst wird; der einzige Pending-Request-Test (:278,
:624) ruft nie dispose().

Empfehlung: Je einen Test für: dispose() bei hängendem requestFullscreen und danach grant();
dispose() bei hängendem orientation.lock; exit() bei hängendem Request; zwei request()
hintereinander (teilen sich den Promise?); document 'fullscreenerror' führt zu false und Warnung.

**BUG-008 · low · packages/twopoint5d/src/display/DisplayFullscreen.ts:456** (weitere: `:404`) —
Einen über das Ziel gestapelten Fullscreen nicht als Verlassen werten

`#nativeElement()` zählt nur, ob `fullscreenElement` genau das Ziel ist. Geht ein Element im Ziel
in Fullscreen (ein `<video>`, ein Dialog der App), meldet `#syncState()` »verlassen«:
`#activeElement` und `#entered` werden gelöscht, das Orientation-Lock gelöst, ggf. `#declined`
gesetzt, `isActive: false` emittiert. Endet der innere Fullscreen, steht das Ziel wieder oben;
`#syncState()` übernimmt es nun mit `#entered = this.#pending?.by`, also `undefined` — als
Fullscreen eines Fremden. Danach verlässt `dispose()` ihn nicht mehr, `exitOnPortrait` greift nicht
(`#enteredBy()` ist `undefined`), und das Lock kommt nicht zurück. Die Klassen-TSDoc nennt den
gestapelten Fall ausdrücklich (`exit()`), behandelt ihn im Zustand aber nicht.

Beleg: `return fullscreenElementOfRoot(candidate) === candidate ? candidate : undefined;`

Empfehlung: Ein Ziel, das noch im Fullscreen-Stack steht (`fullscreenElement` liegt in ihm bzw.
`:fullscreen` matcht weiterhin), als aktiv werten, oder `#entered` über einen gestapelten
Fullscreen hinweg behalten. Spec mit einem Kind-Element, das Fullscreen betritt und verlässt.

**BUG-009 · low · packages/twopoint5d/src/display/DisplayFullscreen.ts:192** — Nach einem
abgelehnten Armed-Tap wieder scharf schalten

`#onArmedTap` ruft `#disarm()` und dann `void this.#request('landscape')`, ohne auf dessen Antwort
zu reagieren. Lehnt der Browser den Request ab (Tap ohne anerkannte Aktivierung, `pointerup` eines
Pointer-Typs, den der Browser nicht als Aktivierung zählt), bleibt die Seite im Querformat
unscharf: kein `isArmed`, kein Hinweis, kein zweiter Versuch, bis der Nutzer ins Hochformat und
zurück dreht. Der Pfad über `#turned()` schaltet nach einer Ablehnung dagegen scharf.

Beleg: `this.#disarm(); void this.#request('landscape');`

Empfehlung: Wie in `#turned()` an die Antwort anhängen: `.then(active => { if (!active &&
this.#onLandscape && this.#isLandscape() && !this.isActive && !this.#declined) this.#arm(); })`.

**API-001 · low · packages/twopoint5d/src/display/DisplayFullscreen.ts:128** (weitere: `:324`,
`:245`, `:285`) — Das Verhalten der `DisplayFullscreen`-Member nach `dispose()` in deren TSDoc
festhalten

resource-lifecycle.md §3 ist verbindlich: jedes öffentliche Member einer entsorgten Instanz sagt in
seiner TSDoc, wie es sich danach verhält. `DisplayFullscreen` überlebt `Display#dispose()` als
gehaltene Referenz (der Kommentar in `dispose()` setzt `#element` eigens dafür), dokumentiert aber
nichts davon: `request()`/`exit()`/`toggle()` resolven `false`, der Setter `onLandscape` ist ein
No-op, `orientationLock`, `exitOnPortrait`, `fallback`, `navigationUI` und `element` nehmen weiter
Werte an, `isActive` antwortet weiter aus dem Dokument (also `true`, wenn jemand anderes das alte
Ziel in Fullscreen setzt). Ein `isDisposed` fehlt ebenfalls.

Beleg: `set onLandscape(on: boolean) { if (on === this.#onLandscape || this.#disposed) return; …`

Empfehlung: Die Post-Dispose-Regel je Member nach §3 entscheiden und in der TSDoc nennen;
`isDisposed` ergänzen, wenn Aufrufer darauf verzweigen sollen.

**CONS-012 · info · packages/twopoint5d/src/display/DisplayFullscreen.ts:295** (weitere:
`DisplayFullscreen.ts:33`, `:215`, `Display.ts:107` → :104-110, `Display.ts:1132` → :1139) —
Fehlende webkit-Präfixe der Fullscreen API dokumentieren oder die Warnung präzisieren

Display und `DisplayFullscreen` lesen nur die unpräfixierte API (`fullscreenEnabled`,
`requestFullscreen`, `fullscreenElement`, `fullscreenchange`). Safari auf macOS und iPadOS vor 16.4
kennt nur `webkitRequestFullscreen`/`webkitfullscreenchange`: dort gilt `isSupported` als `false`,
es kommt der Pseudo-Modus oder die Warnung, die als Ursachen nur »an iframe without
allow="fullscreen", or an iPhone« nennt; ein Fullscreen, den die App selbst per webkit-API betritt,
verfolgt die Size-Source nicht. Seit Safari 16.4 (2023) ohne praktische Wirkung; display.md
behauptet keine webkit-Unterstützung. Konsistent über alle Stellen, deshalb nur ein Hinweis.

Empfehlung: Bewusst so lassen und in display.md beim Pseudo-Fallback einen Satz zu Safari < 16.4
ergänzen, oder die Warnung um »a browser without the unprefixed Fullscreen API« erweitern.
