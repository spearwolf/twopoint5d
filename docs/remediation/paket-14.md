# Paket 14 — Browser-Tests: Kontroll-Rejection ohne Fehlertext

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 2
- Findings: — (Folge, kein Audit-Finding; low)
- Ziel: Ein grüner Lauf der Browser-Suite zeigt unter keinem der vier Launcher
  einen Fehlertext: die Kontroll-Rejection, mit der `display-dispose.test.js`
  auf die gemeldeten Rejections wartet, erscheint weder als Browser-Log noch
  als »An error was thrown in a Promise outside a test«.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d-testing/web-test-runner.config.js` (neues Init-Script)
  - `packages/twopoint5d-testing/test/helpers/fixtures.js` (`whenRejectionsReported()` zieht hierher)
  - `packages/twopoint5d-testing/test/display-dispose.test.js` (lokale Definition entfällt, Import)
  - `packages/twopoint5d-testing/test/harness-rejections.test.js` (neu, Regressionstest)
  - `docs/architecture.md` (§3 »In CI«, ein Absatz)
- Vorgehen: siehe unten, »Vorgehen im Einzelnen«
- Verify: `pnpm run ci` (Exit 0), danach zwei Proben auf dessen Log:
  1. `grep -c "\[renderer-backend\]" "$ARBEITSDIR/paket-14.verify.log"` → `4`
     oder mehr — Beleg, dass die Browser-Logs der Suite überhaupt im Log
     stehen (Nx leitet die Ausgabe von `test:browser` durch; fehlt sie, beweist
     die zweite Probe nichts).
  2. `grep -cE "control rejection of whenRejectionsReported|An error was thrown in a Promise outside a test" "$ARBEITSDIR/paket-14.verify.log"`
     → `0` (grep-Exit 1).
  Alle drei zusammen sind das Gate; ein grüner `ci`-Lauf mit Treffer in Probe 2
  oder ohne Treffer in Probe 1 ist rot.
- Commit: `test(browser): take the control rejection of whenRejectionsReported() off the page before the runner's logger sees it, so that a green run of the browser suite writes no error text`
- Verlauf:
  - 2026-10-23 Zug 0: Detailplan steht · Folge unverändert, nachgemessen (Lauf
    von `test/display-dispose.test.js` unter allen vier Launchern, Exit 0,
    Log `paket-14.zug0-baseline.log` im Arbeitsverzeichnis): Stack
    `Error: the control rejection of whenRejectionsReported()` unter jedem der
    vier Launcher, »An error was thrown in a Promise outside a test« im
    namenlosen Block, also ebenfalls unter allen vier — nicht nur unter
    Chromium, wie die Folge-Zeile im Plan sagt · ganze Suite (61 Dateien, vier
    Launcher, Exit 0, Log `paket-14.zug0-suite.log`): kein weiterer Fehlertext
    · offene Folgen: nur diese (Pakete 1 und 3: —) · »Offene Befunde«: der
    Eintrag aus Paket 1 hat eine andere Ursache und bleibt in der Queue ·
    Restplan unverändert (Paket 14 fasst die Library nicht an, Reihenfolge vor
    Paket 4 bleibt)
  - 2026-10-23 Zug 1: Implementierer beauftragt, sonnet (mittlere Stufe), effort low, Report `paket-14.impl-0.json`
  - 2026-10-23 Zug 2: Report FERTIG_MIT_VORBEHALT (roter Lauf für Firefox nicht einzeln gesehen) · geändert `web-test-runner.config.js`, `test/helpers/fixtures.js`, `test/display-dispose.test.js`, `docs/architecture.md`, neu `test/harness-rejections.test.js` · Baum schmutzig · `pnpm run ci` exit=0 (`paket-14.verify.log`), dort Probe 1 = 0, weil Nx die Ausgabe von `twopoint5d-testing:test` nicht durchreicht · Ersatz: Suite direkt (`pnpm exec web-test-runner` im Paket) exit=0, `paket-14.verify-suite.log`, Probe 1 = 4, Probe 2 = 0
  - 2026-10-23 Zug 3: Reviewer sonnet/low, Ziel erfüllt, kritisch 0, wichtig 0, klein 3 · Diff `paket-14.diff`, Report `paket-14.review-0.json`
  - 2026-10-23 Zug 4: keine Runde
  - 2026-10-23 Zug 5: Commit c23f8a57, Verify `paket-14.verify.log` exit=0 plus `paket-14.verify-suite.log`

## Urteil des Reviewers

- Folge aus Paket 2: behoben — `web-test-runner.config.js` `takeExpectedRejections()` im `createPage` jedes Launchers, `fixtures.js` `whenRejectionsReported()` über `twopoint5dExpectRejection`, Regressionstest `test/harness-rejections.test.js`.
- Abweichung beim Gate akzeptiert: die grep-Proben auf dem Log von `pnpm run ci` greifen nicht, weil Nx die Ausgabe von `test:browser` nicht durchreicht (Probe 1 = 0); sie stehen auf einem direkten Lauf der Suite.
- klein: `harness-rejections.test.js:6` — »… takes the control off the page to each other« grammatisch schief.
- klein: `docs/architecture.md` §3, neuer Absatz — »waits for the browser to report every rejection before it«, Bezug von »it« holprig.
- klein: `harness-rejections.test.js` — bei einem Timeout im Test laufen Logs bis zum `finally` ins Leere; tolerierbar.

## Abgleich

Die Folge stammt aus Paket 2 (`d0b1ad33`), kein Audit-Finding.

- **Fundstelle:** `packages/twopoint5d-testing/test/display-dispose.test.js:34-60`,
  `whenRejectionsReported()`; einziger Aufrufer Z. 191 im Test »lets no rejection
  escape when the init that dispose() landed in fails«.
- **Ursache, nachgelesen im Runner:** `@web/test-runner-core` 1.0.0 setzt in
  jede Testseite ein `<script type="module">` (`trackBrowserLogs`, über
  `injectRuntime()` in `serveTestRunnerHtmlPlugin.js`, direkt hinter `<body>`,
  weil `testRunnerHtml` kein `<head>` hat). Darin steckt
  `@web/browser-logs/dist/logUncaughtErrors.js`:

  ```js
  window.addEventListener('unhandledrejection', e => {
      e.promise.catch(error => {
          console.error('An error was thrown in a Promise outside a test. Did you forget to await a function or assertion?');
          console.error(error);
      });
  });
  ```

  Der Listener prüft `defaultPrevented` nicht; das `event.preventDefault()` im
  heutigen Helfer hält nur die eigene Konsolenmeldung des Browsers fern, nicht
  diesen Logger. Der Logger hängt am `window` und wird vor jedem Listener
  registriert, den ein Test anlegt — `stopImmediatePropagation()` aus dem Test
  kommt zu spät. Ein Capture-Listener aus dem Test half laut Paket 2 unter
  Firefox und WebKit, unter Chromium nicht.
- **Was trägt:** ein Init-Script des Playwright-Kontexts läuft vor jedem Skript
  der Seite (wie `pinBackend()` heute) und registriert seinen Listener damit
  vor dem des Loggers; in Registrierungsreihenfolge kommt er zuerst dran, in
  jeder Engine, und `stopImmediatePropagation()` hält den Logger fern. Jede
  Testseite bekommt einen frischen Kontext (`PlaywrightLauncher#createNewPage()`
  ruft je Seite `createBrowserContextFn` und dann `createPageFn`), ein zweites
  `addInitScript()` in `createPage` läuft also genau einmal je Dokument.
- **Rest der Suite:** ein voller Lauf der Browser-Suite vor dem Paket zeigt
  außer der Kontrolle keinen Fehlertext. Was sonst in den Browser-Logs steht,
  ist gewollt und bleibt: `[renderer-backend] …`, `Display: backend is …`,
  `Display: canvas dimension is …`, `[heap] samples …` und zwei Warnungen von
  three über den Fallback des gepinnten Backends (»WebGPU is not available,
  running under WebGL2 backend«, »Unable to use reversed depth buffer due to
  missing EXT_clip_control extension«). »Kein Fehlertext« im Ziel heißt: weder
  der Stack der Kontrolle noch »An error was thrown in a Promise outside a
  test« — das prüft das grep im Verify.
- **Verworfen:** `filterBrowserLogs` in der Runner-Konfiguration — die Zeile
  »An error was thrown in a Promise outside a test« ist ein eigener
  `console.error` ohne Bezug zur Kontrolle; sie zu filtern verschluckt auch jede
  echte entkommene Rejection. Eine Promise-Unterklasse mit stummem `catch` hinge
  an der Implementierung des Loggers (`e.promise.catch`). Die Kontrolle ganz
  abschaffen geht nicht: der Browser meldet `unhandledrejection` in einer
  eigenen Task, deren Reihenfolge zu `setTimeout` keine Spezifikation festlegt —
  die Kontrolle ist das Signal, auf das Paket 2 die Wartezeit umgestellt hat.

## Vorgehen im Einzelnen

Reihenfolge einhalten: erst der Umzug ohne Verhaltensänderung, dann der rote
Test, dann der Fix.

1. **Umzug.** `whenRejectionsReported()` samt JSDoc aus
   `test/display-dispose.test.js` (Z. 34-60) unverändert nach
   `test/helpers/fixtures.js` verschieben, dort `export function`, in einen
   neuen Abschnitt `// --- unhandled rejections ---` direkt nach
   `withSilencedInfo()` und vor `// --- input for PanControl2D ---`. In
   `display-dispose.test.js` die Definition löschen und den Import auf
   `import {disposeDisplay, makeContainer, whenPageAnimates, whenRejectionsReported, whenReleased} from './helpers/fixtures.js';`
   erweitern. Grund für den Umzug: der Helfer bekommt mit Schritt 2 einen
   zweiten Nutzer (AGENTS.md: ein Helfer, den eine zweite Testdatei braucht,
   gehört nach `fixtures.js`), und er liest ab Schritt 3 einen Vertrag mit der
   Runner-Konfiguration wie `expectedBackend()`.

2. **Regressionstest, rot sehen.** Neue Datei
   `packages/twopoint5d-testing/test/harness-rejections.test.js`:

   ```js
   import {expect} from '@esm-bundle/chai';
   import {whenRejectionsReported} from './helpers/fixtures.js';

   // The runner writes every unhandled rejection of a page into the browser logs of the run, as
   // "An error was thrown in a Promise outside a test" with its stack. The control rejection of
   // whenRejectionsReported() is left unhandled on purpose and must not show there: a green run that
   // prints an error text teaches its readers to look past one. This file holds the helper and the
   // init script of web-test-runner.config.js that takes the control off the page to each other.

   describe('whenRejectionsReported()', function () {
     it('writes nothing to the console', async () => {
       /** @type {Array<[string, unknown[]]>} */
       const written = [];
       // the four kinds the runner collects into its browser logs
       const kinds = /** @type {const} */ (['log', 'debug', 'warn', 'error']);
       const originals = kinds.map((kind) => console[kind]);
       for (const kind of kinds) {
         console[kind] = (...args) => {
           written.push([kind, args]);
         };
       }
       try {
         await whenRejectionsReported();
         // a logger that heard of the control writes from a promise reaction of the same event, and
         // all of those have run before the next task
         await new Promise((resolve) => setTimeout(resolve, 0));
       } finally {
         kinds.forEach((kind, i) => {
           console[kind] = originals[i];
         });
       }

       expect(written, 'what went to the console while whenRejectionsReported() ran').to.deep.equal([]);
     });
   });
   ```

   `noConsole` ist für `**/*.test.js` aus (`biome.jsonc`), keine Suppression
   nötig. Lauf (braucht die gebaute Library; fehlt `packages/twopoint5d/dist`,
   vorher `pnpm build:twopoint5d`):

   ```bash
   cd packages/twopoint5d-testing && pnpm exec web-test-runner --files "test/{display-dispose,harness-rejections}.test.js"
   ```

   Erwartet: `writes nothing to the console` rot unter allen vier Launchern
   (der Logger schreibt zwei `console.error`), `display-dispose.test.js` grün.
   Den roten Lauf mit Ausgabe in den Report.

3. **Fix: Init-Script in `web-test-runner.config.js`.** Neue Funktion direkt
   nach `pinBackend()`:

   ```js
   /**
    * Runs in the page before any of its scripts, like pinBackend(). It leaves
    * `globalThis.twopoint5dExpectRejection(reason)` behind, which `whenRejectionsReported()` in
    * test/helpers/fixtures.js calls: the promise it returns settles once the browser reports `reason`
    * as an unhandled rejection, and that report goes no further. The runner puts a logger of
    * @web/browser-logs into every page, which writes each unhandled rejection into the browser logs
    * as "An error was thrown in a Promise outside a test", whether a listener prevented its default
    * or not. Only a listener added before the logger's keeps a rejection that a test leaves
    * unhandled on purpose out of them, and an init script runs before every script of the page.
    */
   function takeExpectedRejections() {
     /** @type {Map<unknown, () => void>} */
     const expected = new Map();
     Object.defineProperty(globalThis, 'twopoint5dExpectRejection', {
       /** @param {unknown} reason */
       value: (reason) =>
         new Promise((resolve) => {
           expected.set(reason, resolve);
         }),
     });
     window.addEventListener('unhandledrejection', (event) => {
       const settle = expected.get(event.reason);
       if (settle === undefined) return;
       expected.delete(event.reason);
       // off the console of the browser
       event.preventDefault();
       // and away from the logger and from every listener a test adds
       event.stopImmediatePropagation();
       settle();
     });
   }
   ```

   In `backendLauncher()` bekommt `createPage` die zweite Zeile:

   ```js
       async createPage({context}) {
         await context.addInitScript(pinBackend, backend);
         await context.addInitScript(takeExpectedRejections);
         return context.newPage();
       },
   ```

   Kein `capture: true`: es zählt die Registrierungsreihenfolge, und das
   Init-Script kommt vor jedem Skript der Seite.

4. **Fix: `whenRejectionsReported()` in `fixtures.js` auf den Hook umstellen.**
   Ersetzt die umgezogene Fassung vollständig:

   ```js
   /**
    * Settles once the browser has reported every rejection that went unhandled before the call. It
    * leaves a rejection of its own unhandled one task later and waits for the browser to report it:
    * the browser reports unhandled rejections in the order they occurred, so the control comes after
    * all of them. The control goes through `twopoint5dExpectRejection()`, which an init script of
    * web-test-runner.config.js puts into the page, and its report reaches neither the console nor the
    * browser logs of the run nor a listener of the test. A browser that reported none would hold the
    * test up until its timeout — red, not green.
    *
    * @returns {Promise<void>}
    */
   export function whenRejectionsReported() {
     const expectRejection = Reflect.get(globalThis, 'twopoint5dExpectRejection');
     if (typeof expectRejection !== 'function') {
       throw new Error('no twopoint5dExpectRejection() in this page — see web-test-runner.config.js');
     }
     const control = new Error('the control rejection of whenRejectionsReported()');
     const reported = expectRejection(control);
     setTimeout(() => {
       // left unhandled on purpose: it is the control the hook waits for
       void Promise.reject(control);
     }, 0);
     return reported;
   }
   ```

   Der Test »lets no rejection escape …« in `display-dispose.test.js` bleibt
   unverändert: sein eigener Listener filtert auf `initFailure` und soll eine
   entkommene Rejection der Library weiter sehen — ein Log neben einem roten
   Test ist dort richtig.

5. **Doku.** In `docs/architecture.md`, §3 »In CI«, direkt nach dem Absatz,
   der mit `three falls back to WebGL2 without a word …` beginnt und mit
   `… into the "Browser logs" of each launcher.` endet, ein neuer Absatz,
   umbrochen auf die Breite der Nachbarabsätze (höchstens 90 Spalten):

   > The runner puts a logger into every page that writes each unhandled
   > rejection into the "Browser logs" as "An error was thrown in a Promise
   > outside a test", with its stack, whether a listener prevented its default
   > or not. A test that leaves a rejection unhandled on purpose — the control
   > of `whenRejectionsReported()` in `test/helpers/fixtures.js`, which waits
   > for the browser to report every rejection before it — hands it to
   > `twopoint5dExpectRejection()`, which a second init script of each launcher
   > puts into the page. Its listener comes before the logger's and takes the
   > report off the page, so a green run writes no error text;
   > `test/harness-rejections.test.js` fails when the logger hears of the
   > control.

   Kein CHANGELOG-Eintrag: nichts davon ist für Nutzer der Library sichtbar.

6. **Gegenprobe.** Derselbe Lauf wie in Schritt 2 grün unter allen vier
   Launchern, und seine Ausgabe enthält weder `control rejection of
   whenRejectionsReported` noch `An error was thrown in a Promise outside a
   test`. Dann das Verify-Gate oben.

Abweichungen von diesem Vorgehen nur mit Grund im Report — insbesondere, falls
eine Engine den Listener des Init-Scripts nicht vor den des Loggers setzt
(dann rot in Schritt 6, nicht still auf `filterBrowserLogs` ausweichen).
