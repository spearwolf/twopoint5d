# Paket 8 — Letzte Reviewer-Befunde der Display-Domäne: Init-Listener, der wirft, Testtitel, CHANGELOG, Kommentare

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (kein Audit-Finding) · die neun Einträge unter »Offene Befunde« mit `→ Paket 8`
  (kleine Reviewer-Befunde der Pakete 1, 2, 4 und 5), dazu die in Zug 0 aufgenommenen Stellen
  derselben Ursachen (siehe »Abgleich«)
- Ziel: Ein `OnDisplayInit`-Listener, der wirft, lässt `start()` mit seinem Fehler rejecten und
  das Display ungestartet, und das nächste `start()` emittiert wieder `OnDisplayInit` an alle
  Listener (Test zuerst); Testtitel, CHANGELOG-Einträge, Kommentare, TSDoc-Umbruch und
  Interpunktion der Display-Domäne sagen genau, was der Code tut.
- Folge von: Pakete 1, 2, 4, 5 und 6 — je nur für die Stellen, die deren eigener Diff geschrieben
  oder stehen gelassen hat (siehe »Abgleich«); zweite Generation. Der Ursprung des
  Init-Befunds ist vorbestehend (aa6dcc4e setzt `#initMustBeCalled` schon vor dem `emit`).
- Modell: mittlere Stufe (`sonnet`)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/DisplayStateMachine.ts` (`#initOrRestart`)
  - `packages/twopoint5d/src/display/DisplayStateMachine.spec.ts` (ein Test neu)
  - `packages/twopoint5d/src/display/Display.ts` (Kommentar über `waitForTwoAnimationFrames()`,
    Klassen-TSDoc »Lifecycle« und »Resize model«, TSDoc von `start()`, sieben Kommastellen)
  - `packages/twopoint5d/src/display/Display.spec.ts` (zwei Tests neu)
  - `packages/twopoint5d/src/display/Stylesheets.ts` (eine Kommastelle)
  - `packages/twopoint5d/docs/architecture.md` (eine Kommastelle)
  - `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]`: Added, Changed, Fixed, Migration Guide)
  - `packages/twopoint5d-testing/test/display-dispose.test.js` (ein Test, ein Kommentar)
  - `packages/twopoint5d-testing/test/display-adopt-renderer.test.js` (ein Kommentar)
- Vorgehen: siehe Abschnitt »Vorgehen« unten — Schritte 1 bis 9, in dieser Reihenfolge.
- Verify: der Codeblock »Verify« direkt unter dieser Liste, vom Repo-Root, eine Zeile. Gegen
  e1b9f2ff geprüft: `grep` findet heute die zehn Kommastellen, `awk` die sieben überlangen
  Zeilen und endet mit 1 — nach dem Paket beide leer, Exit 0.
- Commit: `fix(display): let a start() whose init listener throws reject and leave the display unstarted, so the next start() emits OnDisplayInit again to every listener, let the dispose browser test start the display it disposes while the renderer initializes, say in the changelog that a write to a read-only accessor throws in strict-mode code, and bring the release comments, the class TSDoc wrapping and the dash punctuation of the display module in line`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · Init-Listener, der wirft: unverändert (`Display.ts:943`,
    Ursache `DisplayStateMachine.ts:157-164`) · `display-dispose.test.js:257-269` nach `:302-336`
    verschoben, Titelverweis in `:62` · `CHANGELOG.md:140`/`:896-897` jetzt `:140`/`:898-899`,
    dieselbe Wendung `:141`/`:921-922` (Paket 6) aufgenommen · `CHANGELOG.md:244` jetzt `:256` ·
    `CHANGELOG.md:12` unverändert · Komma in `start()`-TSDoc jetzt `Display.ts:1373`, neun weitere
    Stellen aufgenommen · Lifecycle Punkt 3 an der Fundstelle gegenstandslos (d38cc402 hat neu
    umbrochen), Punkt 2, Punkt 4 und »Resize model« mit Zeilen über 80 aufgenommen ·
    `display-adopt-renderer.test.js:73-74` unverändert · `Display.ts:110-119` unverändert ·
    neu in »Offene Befunde«: werfender `OnDisplayStart`-Listener (→ Scope), `—,` in
    `stage/fitIntoRectangle.ts:189` und `utils/isPowerOf2.ts:3` (→ Audit) · keine offenen
    `Folgen:`-Zeilen unter erledigten Paketen
  - 2026-09-24 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report `paket-8.impl-1.json`
  - 2026-09-24 Zug 2: FERTIG · 9 Dateien laut Plan geändert, keine neu · Arbeitsbaum schmutzig · roter Lauf 2 failed / 48 passed (1a, 1b), 1c vorher grün · Probe Schritt 4: Wächter auskommentiert rot, zurück grün · Abweichung: Kommentar `display-dispose.test.js:59-72` neu umbrochen (Titel 112 Zeichen)
  - 2026-09-24 Zug 2: Verify selbst `pnpm run ci` + grep + awk exit=0 (`paket-8.verify.log`) · Zug 3: Reviewer beauftragt (sonnet, effort medium), Diff `paket-8.diff`
  - 2026-09-24 Zug 3: Reviewer (`paket-8.review-1.json`): alle neun Befunde und die aufgenommenen Stellen erfüllt, kritisch 0, wichtig 0, klein 3 · Diff `paket-8.diff`
  - 2026-09-24 Zug 4: keine Runde nötig
  - 2026-09-24 Zug 5: committet bd80d232, Verify `paket-8.verify.log` exit=0 (jünger als die letzte Codeänderung)

Verify:

```bash
pnpm run ci && ! grep -n -- '—,' packages/twopoint5d/src/display/*.ts packages/twopoint5d/docs/architecture.md packages/twopoint5d/CHANGELOG.md packages/twopoint5d-testing/test/display-*.js && awk '/^ \* The .Display. is the entry point/ {on=1} on && length($0) > 80 {print FILENAME ":" FNR ": " length($0); bad=1} on && /^ \*\/$/ {on=0} END {exit bad}' packages/twopoint5d/src/display/Display.ts
```

## Vorgehen

Vor der ersten Änderung `AGENTS.md` im Repo-Root lesen, für die CHANGELOG-Schritte den Skill
`updating-changelog` laden. Zeilennummern gelten für e1b9f2ff; nach eigenen Einfügungen
verschieben sie sich, deshalb nennt jeder Schritt auch den Text, an dem die Stelle zu finden ist.

### 1. Regressionstests zuerst, rot sehen

Beide Spec-Dateien laufen mit
`pnpm nx test twopoint5d -- src/display/DisplayStateMachine.spec.ts src/display/Display.spec.ts`
(vom Repo-Root). Test 1a und 1b müssen vor Schritt 2 rot sein — die Ausgabe des roten Laufs
gehört in den Report. Test 1c ist vor und nach Schritt 2 grün; er sichert die TSDoc-Aussage aus
Schritt 3 für `OnDisplayRestart` ab.

**1a.** `DisplayStateMachine.spec.ts`, neuer Test hinter
`it('a restart listener that pauses, un-pauses and pauses again holds the state machine in the pause', …)`:

```ts
it('an init listener that throws leaves the state machine new, and the next start() emits init again', () => {
  const stateMachine = new DisplayStateMachine();

  // a listener ahead of the one that throws hears init on both attempts
  const early: string[] = [];
  on(stateMachine, DisplayStateMachine.Init, () => {
    early.push(DisplayStateMachine.Init);
  });

  let fail = true;
  on(stateMachine, DisplayStateMachine.Init, () => {
    if (fail) throw new Error('init listener');
  });

  const events = recordEvents(stateMachine);

  expect(() => stateMachine.start()).toThrow('init listener');
  expect(stateMachine.state).toBe(DisplayStateMachine.NEW);
  expect(events).toEqual([]);

  fail = false;
  stateMachine.start();

  expect(events).toEqual([DisplayStateMachine.Init, DisplayStateMachine.Start]);
  expect(early).toEqual([DisplayStateMachine.Init, DisplayStateMachine.Init]);
  expect(stateMachine.state).toBe(DisplayStateMachine.RUNNING);
});
```

Vor Schritt 2 rot: das zweite `start()` liefert `[restart, start]`.

**1b.** `Display.spec.ts`, im `describe('start()')` neuer Test hinter
`it('a pause = true and a pause = false inside a restart listener restart the display once', …)`.
`makeDisplay()` hängt seinen Rekorder `events` als ersten Listener an, der werfende Listener kommt
danach, ein zweiter Rekorder `after` hinter ihn:

```ts
it('an init listener that throws rejects start(), and the next start() emits init to every listener', async () => {
  const {display, events} = makeDisplay();

  const error = new Error('init listener');
  let fail = true;
  on(display, OnDisplayInit, () => {
    if (fail) throw error;
  });

  const after: string[] = [];
  on(display, OnDisplayInit, () => {
    after.push(OnDisplayInit);
  });

  await expect(display.start()).rejects.toBe(error);

  expect(events).toEqual([OnDisplayInit]);
  expect(after).toEqual([]);
  expect(display.isRunning).toBe(false);
  expect(display.frameLoop.subscriptionCount).toBe(0);

  fail = false;
  await display.start();

  expect(events).toEqual([OnDisplayInit, OnDisplayInit, OnDisplayStart]);
  expect(after).toEqual([OnDisplayInit]);
  expect(display.isRunning).toBe(true);

  // a start that went through leaves init retained for a listener attached afterwards
  const late: string[] = [];
  on(display, OnDisplayInit, () => {
    late.push(OnDisplayInit);
  });

  expect(late).toEqual([OnDisplayInit]);
});
```

Vor Schritt 2 rot: `events` endet auf `OnDisplayRestart, OnDisplayStart`, `after` bleibt leer.

**1c.** `Display.spec.ts`, direkt hinter 1b:

```ts
it('a restart listener that throws rejects start(), and the next start() emits restart again', async () => {
  const {display, events} = makeDisplay();
  await display.start();
  display.pause = true;

  const error = new Error('restart listener');
  let fail = true;
  on(display, OnDisplayRestart, () => {
    if (fail) throw error;
  });
  events.length = 0;

  await expect(display.start()).rejects.toBe(error);

  expect(events).toEqual([OnDisplayRestart]);
  expect(display.isRunning).toBe(false);

  fail = false;
  await display.start();

  expect(events).toEqual([OnDisplayRestart, OnDisplayRestart, OnDisplayStart]);
  expect(display.isRunning).toBe(true);
});
```

### 2. Fix in `DisplayStateMachine.ts`

`#initOrRestart` (Zeilen 157-164) wird zu:

```ts
  #initOrRestart = (): void => {
    if (this.#initMustBeCalled) {
      emit(this, DisplayStateMachine.Init);
      // cleared once every listener is through: a listener that throws leaves the init to the next
      // start(). None of them gets back in here, since start() does nothing while they run
      this.#initMustBeCalled = false;
    } else {
      emit(this, DisplayStateMachine.Restart);
    }
  };
```

Sonst nichts an der State-Machine. Kein `emitSafe()`/`emitStrict()`: die Bibliothek dispatcht
überall mit `emit()`, und eine geschützte Variante verteuert jedes `emit()` im Prozess des
Konsumenten (Skill `using-eventize`, »What each one costs«). Danach 1a und 1b grün, 1c weiter
grün.

### 3. Doku zum werfenden Listener

**3a.** `Display.ts`, TSDoc von `start()` (ab `:1354`): hinter dem ersten Absatz, der mit
»with one `OnDisplayRestart` and no second one.« endet, ein neuer Absatz:

```
   * A listener of `OnDisplayInit` or `OnDisplayRestart` that throws makes this call reject with
   * its error, and the display does not start. The next `start()` emits that event again, to
   * every listener, those that received it before the throw included.
```

**3b.** `Display.ts`, Klassen-TSDoc »Lifecycle« Punkt 2 (`:380-393`): hinter »A renderer that
fails to initialize fires `OnDisplayError` instead, and `start()` rejects with the same error.«
den Satz »A listener of `OnDisplayInit` that throws makes `start()` reject with its error; the
display does not start, and the next `start()` emits `OnDisplayInit` again.« anfügen. Den
Umbruch von Punkt 2 macht Schritt 8.

**3c.** `CHANGELOG.md`, `[Unreleased]` → `### Fixed`: neuer Eintrag direkt hinter dem Eintrag
»fix a `stop()` or a `pause = true` inside a listener of `OnDisplayRestart`, …« (`:216`):

```
- fix a listener of `OnDisplayInit` that throws: `Display#start()` rejects with its error and the display does not start, and the next `start()` emits `OnDisplayInit` again, to every listener, those that received it before the throw included; once a start goes through, a listener attached afterwards receives it as well
```

Kein Migration-Guide-Eintrag: keine Signatur ändert sich, nur ein Fehlerpfad.

### 4. `display-dispose.test.js`: der Test prüft, was sein Titel verspricht

Der Test `it('a dispose() before the renderer is ready leaves the frame loop empty', …)`
(`:302-336`) kann auf dem Dispose-Pfad nicht scheitern: das Display meldet sich erst in
`start()` an seinem Frame-Loop an, und der Test ruft `start()` nie. Er bekommt ein `start()`,
das vor dem `dispose()` losläuft und auf den Renderer wartet:

- Titel neu: `'a start() that dispose() lands in while it waits for the renderer rejects and leaves the frame loop empty'`.
- Den Aufbau mit `releaseInit`, `initSettled` und dem `createRenderer`-Wrapper unverändert
  lassen, ebenso die erste Erwartung `'before the display is up'`.
- Direkt vor `display.dispose();` den Aufruf `const started = display.start();`.
- Hinter `releaseInit();` den Kommentar »a display goes on its frame loop only once it starts,
  and this await lets every reaction …« und das `await initSettled;` ersetzen durch das Muster
  aus `it('start() throws after dispose()', …)` (`:217-234`): `/** @type {Error | undefined} */
  let error;`, `try { await started; } catch (err) { error = /** @type {Error} */ (err); }`,
  davor ein Kommentar in einer Zeile: `// start() comes back once the renderer is ready, after the display has given it up`.
- Erwartungen danach: `expect(error, 'start() with a dispose() while it waits').to.be.an.instanceOf(Error);`,
  `expect(error.message).to.contain('Display#start()');`, `expect(error.message).to.contain('disposed');`,
  `expect(display.frameLoop.subscriptionCount, 'after start() has come back').to.equal(0);`,
  `expect(display.isRunning, 'isRunning').to.equal(false);`.
- Den Titelverweis im Kommentar `:62` (»the six cases after "a dispose() before the renderer is
  ready leaves the frame loop empty" watch«) auf den neuen Titel ziehen und den Absatz
  `:59-72` so umbrechen, dass keine Zeile 100 Zeichen überschreitet.

Kein Bugfix, deshalb kein roter Lauf im Sinne der Regressionstests. Beleg, dass der Test jetzt
scheitern kann: einmal lokal die Zeile `if (this.#disposed) throw disposedError('start()');`
hinter `await this.#waitForRenderer;` in `Display.ts` (`:1391`) auskommentieren, die Bibliothek
bauen (`pnpm build:twopoint5d`) und die Datei laufen lassen
(`pnpm --dir packages/twopoint5d-testing exec web-test-runner test/display-dispose.test.js`):
der Test muss rot sein (`start()` resolvt, weil `dispose()` über `stop()` den Start verhindert).
Danach die Zeile zurück, Ausgabe beider Läufe in den Report.

### 5. CHANGELOG: `TypeError` nur in Strict-Mode-Code

Eine Zuweisung an einen Accessor ohne Setter wirft nur in Strict-Mode-Code; außerhalb wird sie
still ignoriert. Vier Stellen, alle unter `[Unreleased]`:

- `:140` (`Display#renderer`, `#frameLoop` and `#frameNo` …) und `:141` (`FrameLoop#frameNo`,
  …): »a write is a type error and throws a `TypeError` at runtime« ersetzen durch »a write is a
  type error, and at runtime it throws a `TypeError` in strict-mode code — every ES module and
  class body — and is ignored elsewhere«.
- Migration Guide `#### \`Display#renderer\`, \`#frameLoop\` and \`#frameNo\` are read-only`
  (`:898-899`) und `#### \`FrameLoop#frameNo\`, … are read-only` (`:921-922`): »a write is a type
  error and throws a `TypeError` at runtime« ersetzen durch »a write is a type error, and at
  runtime it throws a `TypeError` in strict-mode code — every ES module and class body — and is
  ignored elsewhere«. Absatz danach neu umbrechen, keine Zeile über 100 Zeichen (die Nachbarn
  brechen bei knapp 100).

### 6. CHANGELOG: zwei Einträge ohne überholte Mechanik und ohne Doppelung

- `:256` (`### Fixed`) — der Eintrag nennt einen Mechanismus, den es nicht mehr gibt (das Display
  meldet sich erst beim Start am Frame-Loop an). Ganze Zeile ersetzen durch:

  ```
  - fix a `Display` that is disposed before its renderer is ready: a `start()` that waits for the renderer rejects once the renderer is ready, and the display never subscribes to its frame loop, which is left with no subscriber to carry
  ```

- `:12` (`### Added`, `pauseOutsideViewport`) — »as a hidden tab does« steht zweimal. Das
  zweite Vorkommen fällt: »sends it straight into the pause with `OnDisplayPause`, as a hidden
  tab does, and `OnDisplayInit` and `OnDisplayStart` follow« wird zu »sends it straight into the
  pause with `OnDisplayPause`, and `OnDisplayInit` and `OnDisplayStart` follow«. Das erste
  (»Leaving and coming back emit …, as a hidden tab does.«) bleibt.

### 7. Kommentare zur Freigabe unter WebGPU

- `display-adopt-renderer.test.js:73-74` wird zu:

  ```js
      // the display releases its renderer after dispose() has returned, once the GPU has run dry
      // and, under WebGPU, the page has drawn two more frames
  ```

- `Display.ts:110-119`, Kommentar über `waitForTwoAnimationFrames()`: die Begründung nennt nur
  den übergebenen Canvas und den übernommenen Renderer, die Funktion wartet aber in jedem Pfad,
  auch für den Canvas eines selbst gebauten Containers, der mit dem Container das Dokument
  verlässt und wieder in eines gelangen kann. Den Kommentar ersetzen durch (keine Zeile über
  100 Zeichen):

  ```ts
  // On Firefox 155 under WebGPU, a renderer.dispose() on a canvas that is still in the document,
  // before the page has presented what was drawn into it last, reports a GPUInternalError (`Buffer
  // with '' label has been destroyed`), and the page gets no requestAnimationFrame callback after
  // that — every animation on the page stands still. Whether the queue has run dry makes no
  // difference; a canvas outside the document is not affected. A canvas handed to the constructor
  // and the canvas of an adopted renderer stay where their caller put them, and the canvas of a
  // container the display built leaves the document with that container but can be put into one
  // again while the release runs. So the release waits for two animation frames of the page,
  // whatever the canvas: the callbacks of the first run before the page presents the frame the
  // canvas was drawn into last (the "update the rendering" steps of HTML run them before
  // painting), those of the second after it. Under WebGL, and for a canvas without a window,
  // there is nothing to wait for
  ```

  Der Code der Funktion bleibt unverändert. Die TSDoc von `dispose()` (`:1433-1436`) und der
  CHANGELOG-Eintrag `:257` bleiben: sie sagen, wann der Stillstand auftritt, nicht wofür
  gewartet wird.

### 8. Umbruch der Klassen-TSDoc von `Display`

Die Klassen-TSDoc (`:366-494`) bricht bei 66–78 Zeichen um; einzelne Zeilen reichen bis 89:
Punkt 2 (`:382`, 88), Punkt 4 (`:408` 87, `:410` 83, `:418` 81, `:422` 81, dazu die kurzen
`:414`, `:416`, `:420`, `:423` mitten im Absatz), »Resize model« (`:429` 81, `:463` 89). Neu
umbrechen: Punkt 2 samt dem Satz aus Schritt 3b, Punkt 4, den Absatz `:427-438` und Punkt 2 der
Größenquellen (`:463-469`) — so, dass jede Zeile der Klassen-TSDoc höchstens 80 Zeichen lang ist
und die Zeilen eines Absatzes gleichmäßig gefüllt sind (nur die letzte Zeile eines Punkts darf
kürzer sein). In diesen Absätzen ändern sich nur Zeilenumbrüche, kein Wort — ausgenommen der Satz
aus Schritt 3b. Die Listeneinrückung (`*    ` bei Punkten, `*      ` bei Unterpunkten) bleibt.
Das `awk` im Verify prüft die 80 Zeichen.

### 9. `—,` → `—`

Ein Komma hinter dem schließenden Gedankenstrich ist im Englischen überzählig; der Strich trägt
die Pause schon. An allen zehn Stellen das Komma streichen, den Rest der Zeile nicht anfassen:

| Datei | Zeile (e1b9f2ff) | Text |
| --- | --- | --- |
| `packages/twopoint5d/src/display/Display.ts` | `:451` | `container —, just as without the attribute` |
| ebd. | `:590` | `a call of your own —, whether or not the size changes` |
| ebd. | `:607` | `and rounded down —, as the last measurement` (width) |
| ebd. | `:618` | `and rounded down —, as the last measurement` (height) |
| ebd. | `:1049` | `canvas outside the viewport —, and before the first start` |
| ebd. | `:1056` | `a write of it pauses right away —, and in PAUSED` |
| ebd. | `:1373` | `still waits for the renderer —, the display goes` |
| `packages/twopoint5d/src/display/Stylesheets.ts` | `:105` | `` `<template>` —, since such a document`` |
| `packages/twopoint5d/docs/architecture.md` | `:26` | `` `display/` does —, matching`` |
| `packages/twopoint5d/CHANGELOG.md` | `:325` | `while \`pixelZoom\` is above 0 —, so the drawing buffer` |

`:1373` liegt im Absatz, den Schritt 3a nicht berührt; `:325` ist der Eintrag »fix
`Display.MaxResolution`« unter `### Fixed`. Das `grep` im Verify prüft, dass keine Stelle bleibt.
`src/stage/fitIntoRectangle.ts:189` und `src/utils/isPowerOf2.ts:3` tragen dasselbe Komma,
liegen außerhalb der Display-Domäne und bleiben unangetastet (Queue, → Audit).

## Abgleich (Zug 0, 2026-09-24, gegen e1b9f2ff)

| Queue-Eintrag | Befund jetzt | Herkunft |
| --- | --- | --- |
| Init-Handler, werfender `OnDisplayInit`-Listener | unverändert: `Display.ts:943` emittiert `OnDisplayInit` mit `emit()`, das beim Werfen abbricht und nichts retained; `DisplayStateMachine.ts:157-164` setzt `#initMustBeCalled = false` vor dem `emit`. Nach dem Wurf: Zustand `NEW`, Flag verbraucht, `start()` rejected, das nächste `start()` emittiert `Restart` | Flag-Reihenfolge vorbestehend (aa6dcc4e identisch); über `start()` sichtbar, seit Paket 1 den Init-Handler synchron gemacht hat |
| `display-dispose.test.js:257-269` | verschoben nach `:302-336`, in der Sache unverändert: kein `start()`, `subscriptionCount` ist vor und nach dem Init 0, egal was `dispose()` tut. Titel zitiert im Kommentar `:62` | Test aus 1813d635 (vor dem Lauf); gegenstandslos gemacht durch Paket 1 (Anmeldung erst beim Start) |
| `CHANGELOG.md:140`, `:896-897` | jetzt `:140` und `:898-899`, unverändert | Paket 4 (78ee4952) |
| — aufgenommen | dieselbe Wendung in `:141` und `:921-922` (`FrameLoop`) | Paket 6 (a96d0ca3) hat sie von Paket 4 übernommen — Symptom derselben Ursache |
| `CHANGELOG.md:244` | jetzt `:256`, unverändert | Eintrag aus 1813d635; überholt durch Paket 1 |
| `CHANGELOG.md:12` | unverändert | Paket 1 (6a4bcacf) |
| `Display.ts` TSDoc `start()`, Komma (6a4bcacf `:1062`) | jetzt `:1373`, unverändert | Paket 1 |
| — aufgenommen | dasselbe `—,` in `Display.ts:451`, `:590` (Paket 2), `:607`, `:618`, `:1049`, `:1056` (Paket 6), `Stylesheets.ts:105`, `docs/architecture.md:26` (Paket 4), `CHANGELOG.md:325` (Paket 2) | alle aus diesem Lauf, per `git blame`; eine Interpunktionsgewohnheit, eine Ursache |
| Lifecycle Punkt 3 (a33a6961 `:299`, 93 Zeichen) | an der Fundstelle gegenstandslos: d38cc402 hat Punkt 3 neu umbrochen, jetzt `:394-407` mit 70–77 Zeichen | — |
| — aufgenommen | dieselbe Ursache (Klassen-TSDoc ungleichmäßig umbrochen): Punkt 2 `:382` (88, Paket 6), Punkt 4 `:408`, `:410`, `:418`, `:422` (vorbestehend: d11e2795, 1813d635, bc38818b) und `:419-420` (Paket 6), »Resize model« `:429`, `:463` (vorbestehend) | gemischt; eine Ursache, ein Absatzumbruch |
| `display-adopt-renderer.test.js:73-74` | unverändert | Paket 5 (d38cc402) |
| `Display.ts:110-119` | unverändert | Paket 5 |

Triage der Queue über Paket 8 hinaus: die sieben Einträge `→ Audit` haben andere Ursachen und
bleiben für den Abschluss. Unter den erledigten Paketen steht keine offene `Folgen:`-Zeile.

## Entscheidungen in Zug 0

- **Weg für den werfenden Init-Listener: das Flag erst nach der Zustellung löschen.** Zwei Wege
  waren gangbar. (a) `#initMustBeCalled` erst nach dem `emit` löschen: ein Wurf lässt das Display
  in `NEW`, und das nächste `start()` emittiert `Init` erneut — an alle Listener, die vor dem
  Wurf gehörten eingeschlossen. (b) `emitStrict()` für die Lebenszyklus-Ereignisse: jeder Listener
  bekommt `Init` genau einmal, der Wert wird retained, der Fehler geht danach hinaus. (a) gewinnt:
  es erfüllt das Ziel wörtlich (»ein erneutes `start()` emittiert wieder `OnDisplayInit`«), bleibt
  bei `emit()` wie die ganze Bibliothek, und (b) verteuerte als veröffentlichte Bibliothek jedes
  `emit()` im Prozess ihrer Konsumenten (Skill `using-eventize`). Außerdem ließe (b) den Zustand
  `NEW` mit verbrauchtem Init zurück — genau die Lage des Befunds, nur mit anderem Symptom. Dass
  frühe Listener `Init` beim zweiten Versuch noch einmal hören, sagen TSDoc und CHANGELOG
  ausdrücklich.
- **`OnDisplayRestart` in der TSDoc mitnennen.** Ein werfender Restart-Listener lässt das Display
  schon jetzt in `PAUSED`, und das nächste `start()` emittiert `Restart` erneut — dieselbe
  Semantik wie nach dem Fix für `Init`. Test 1c hält das fest, damit der Satz in der TSDoc belegt
  ist.
- **Der werfende `OnDisplayStart`-Listener bleibt draußen.** Das Display läuft dann (`RUNNING`,
  am Frame-Loop), `start()` rejected, und spätere wie späte Listener hören `OnDisplayStart` nie.
  Die Ursache ist eine andere: `RUNNING` wird vor `Start` gesetzt, weil Listener den Zustand dort
  lesen, und ein Rückbau müsste Frame-Loop und Chronometer des Displays zurücknehmen oder eine
  Pause emittieren. Das ist eine Designfrage mit eigenem Detailplan. Neu in »Offene Befunde«
  (vorbestehend, gegen aa6dcc4e nachgesehen: `state = RUNNING` vor `emit(Start)`), → Scope.
- **Den Dispose-Test aufwerten statt löschen.** Kein anderer Test prüft ein `start()`, in dessen
  Warten auf den Renderer ein `dispose()` fällt (Browser: nur `start()` nach `dispose()` und
  `dispose()` im `beforeStartCallback`; Spec: nur `stop()`/`pause` während des Wartens). Mit
  `start()` vor `dispose()` prüft der Test den Wächter `Display.ts:1391`; die Probe mit
  auskommentiertem Wächter belegt es.
- **Kommastellen und Umbruch aufgenommen.** Beide Einträge sind je ein Symptom einer Ursache, die
  an weiteren Stellen derselben Dateien steht; eine Stelle zu beheben und neun stehen zu lassen
  verfehlte das Ziel. Die Kommastelle `Stylesheets.ts:105` stammt aus dem Teil von Paket 4, der
  selbst Folge von Paket 3 war. Gezählt wird die Generation hier nach der Ursache — einer
  Interpunktionsgewohnheit, erstmals in Paket 1 —, nicht nach der Zeile; der Weg von Paket 3 ist
  nicht beteiligt, eine dritte Generation liegt nicht vor.
- **Modell mittlere Stufe, Effort medium.** Ein lokaler Fix samt Regressionstests, der Rest
  Text mit exakten Vorgaben.

## Befunde im Volltext

Aus »Offene Befunde« in `./remediation-plan.md`, wörtlich:

1. `packages/twopoint5d/src/display/Display.ts` (`#emit(OnDisplayInit)` im Init-Handler, Stand
   6a4bcacf `:677`) — ein `OnDisplayInit`-Listener, der synchron wirft, lässt `start()`
   rejecten, während `#initMustBeCalled` schon `false` und der Zustand `NEW` ist; ein zweites
   `start()` emittiert dann `OnDisplayRestart` statt `OnDisplayInit`, und spätere Listener sowie
   späte Subscriber bekommen `OnDisplayInit` nie (Reviewer Paket 1, low) → Scope
2. `packages/twopoint5d-testing/test/display-dispose.test.js:257-269` — der Test »a dispose()
   before the renderer is ready leaves the frame loop empty« kann auf dem Dispose-Pfad nicht mehr
   scheitern, weil das Display erst in `start()` abonniert; der Titel verspricht mehr, als er
   prüft (Reviewer Paket 1, low) → Scope
3. `packages/twopoint5d/CHANGELOG.md:140`, `:896-897` — »throws a TypeError at runtime« gilt nur
   für Strict-Mode-Code (Reviewer Paket 4, low) → Scope
4. `packages/twopoint5d/CHANGELOG.md:244` — `[Unreleased]`-Eintrag »fix a Display that is
   disposed before its renderer is ready …« nennt einen Mechanismus, den es nicht mehr gibt
   (Reviewer Paket 1, info) → Scope
5. `packages/twopoint5d/CHANGELOG.md:12` — Added-Eintrag zu `pauseOutsideViewport` sagt zweimal
   »as a hidden tab does« (Reviewer Paket 1, info) → Scope
6. `packages/twopoint5d/src/display/Display.ts` (TSDoc von `start()`, Stand 6a4bcacf `:1062`) —
   überzähliges Komma nach dem Gedankenstrich »waits for the renderer —, the display goes«
   (Reviewer Paket 1, info) → Scope
7. `packages/twopoint5d/src/display/Display.ts` (Klassen-TSDoc »Lifecycle« Punkt 3, Stand
   a33a6961 `:299`) — eine Zeile (~93 Zeichen) bricht anders um als ihre Nachbarn (~75)
   (Reviewer Paket 2, info) → Scope
8. `packages/twopoint5d-testing/test/display-adopt-renderer.test.js:73-74` — Kommentar »once the
   GPU has run dry and the page has drawn two more frames« ohne »under WebGPU«; unter WebGL wird
   nicht gewartet (Reviewer Paket 5, info) → Scope
9. `packages/twopoint5d/src/display/Display.ts:110-119` — Kommentar über
   `waitForTwoAnimationFrames()` begründet das Warten nur mit übergebenem Canvas und übernommenem
   Renderer; die Funktion wartet auch im Host-Pfad, dessen Canvas wieder in ein Dokument gelangen
   kann (Sonde P4) (Reviewer Paket 5, info) → Scope

Eintrag 3 nennt zwei Stellen derselben Datei.

## Urteil des Reviewers (Zug 3, gegen bd80d232)

1. Werfender `OnDisplayInit`-Listener — behoben: `DisplayStateMachine.ts:158-162` (`emit(Init)` vor
   `#initMustBeCalled = false`); Tests `DisplayStateMachine.spec.ts:756`, `Display.spec.ts:363` (1b),
   `:400` (1c); Doku `Display.ts:1370-1372` (`start()`), `:396-398` (Lifecycle Punkt 2), CHANGELOG Fixed
2. Dispose-Test — behoben: `display-dispose.test.js:303` (neuer Titel, `start()` vor `dispose()`,
   Erwartungen auf Rejection, `subscriptionCount`, `isRunning`), Titelverweis `:62` nachgezogen
3. Strict-Mode-Wendung — behoben: `CHANGELOG.md:140`, `:141` und beide Migration-Guide-Absätze
4. Überholter Mechanismus — behoben: `CHANGELOG.md:256`
5. Doppeltes »as a hidden tab does« — behoben: `CHANGELOG.md:12`
6. Komma in der `start()`-TSDoc — behoben: `Display.ts` TSDoc von `start()`
7. Lifecycle Punkt 3 — an der Fundstelle gegenstandslos; Punkt 2, Punkt 4 und »Resize model«
   auf höchstens 80 Zeichen umbrochen (awk im Verify leer)
8. Kommentar »under WebGPU« — behoben: `display-adopt-renderer.test.js:73-74`
9. Kommentar über `waitForTwoAnimationFrames()` — behoben: `Display.ts:110-123`
- Aufgenommene Stellen: alle zehn `—,` bereinigt (grep im Verify leer), zweite Strict-Mode-Stelle
  (`FrameLoop`) mitgezogen, Klassen-TSDoc umbrochen.

Kleine Befunde (keine Runde ausgelöst):
- `Display.ts:382` — Lifecycle Punkt 2 sagt weiter »fires `OnDisplayInit` (once)«; der neue
  Folgesatz erklärt die Wiederholung nach einem Wurf, das »(once)« steht daneben in Spannung.
- `CHANGELOG.md:208` — der Fixed-Eintrag nennt nur `OnDisplayInit`; für `OnDisplayRestart` ändert
  sich kein Verhalten, der Plan hat es so vorgegeben.
- `display-dispose.test.js:303` — Testtitel mit 112 Zeichen, vom Plan wörtlich vorgegeben, Prettier
  meldet nichts.
