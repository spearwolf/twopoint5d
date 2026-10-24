# Paket 2 — Browser-Test-Harness

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-001 (low), TEST-002 (low), TEST-003 (low), TEST-005 (low), TEST-006 (low), TEST-007 (low), TYPE-004 (info)
- Ziel: Die Browser-Tests räumen verlässlich auf, warten auf Signale statt auf Zeit, laufen zusätzlich unter WebKit und stehen unter denselben Lint- und Typregeln wie der Rest.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d-testing/web-test-runner.config.js` (Schritt 1, 6)
  - `packages/twopoint5d-testing/test/helpers/fixtures.js` (Schritt 2)
  - `packages/twopoint5d-testing/test/*.test.js`: alle 49 Dateien mit `this.timeout(` (Schritt 1);
    alle Dateien mit Freigaben am Testende (Schritt 2, Liste dort)
  - `packages/twopoint5d-testing/test/display-dispose.test.js` (Schritt 3, 4)
  - `packages/twopoint5d-testing/test/pan-control-dispose.test.js` (Schritt 4, nur Kommentar)
  - `packages/twopoint5d-testing/tsconfig.json` (Schritt 7, nur Kopfkommentar)
  - `biome.jsonc` (Schritt 5)
  - `.github/workflows/ci.yml` (Schritt 6)
  - `AGENTS.md`, `README.md`, `docs/architecture.md` (§3 »In CI«, §5, §6),
    `packages/twopoint5d/docs/architecture.md` (§5) (Schritt 6, 7)
  - kein Eintrag in `packages/twopoint5d/CHANGELOG.md`: nichts davon ist für Nutzer der
    Library sichtbar
  - nicht anfassen: `packages/twopoint5d/src/**` (die Sabotage in Schritt 3 ist
    vorübergehend und wird vor dem Report zurückgenommen)
- Arbeitsverzeichnis für Logs und Wegwerfdateien:
  `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad`
  (im Folgenden `$ARBEITSDIR`), nie das Repo
- Nebenbefunde im Paket (vorbestehend, gleiche Ursache, in Zug 0 aufgenommen):
  - `packages/twopoint5d-testing/test/pan-control-dispose.test.js:26` — verweist auf »the
    dispose test pattern« ohne Quelle; Ursache wie TEST-007 (Schritt 4)
  - `sprites-picking.test.js:54-68`, `sprites-palette-swap.test.js:97-117`,
    `sprites-table-frame.test.js:63-86` — je ein eigenes `disposables`-Array samt `keep()`,
    obwohl AGENTS.md einen Helfer, den eine zweite Datei braucht, nach
    `test/helpers/fixtures.js` verlangt; Ursache wie TEST-001 (Schritt 2)
  - Freigaben am Ende des Testkörpers in rund 30 weiteren Testdateien (Liste in Schritt 2);
    dieselbe Ursache wie TEST-001 an anderer Stelle (Schritt 2)
- Verify:
  `node --input-type=module -e "import {parse} from 'yaml'; import {readFileSync} from 'node:fs'; parse(readFileSync('.github/workflows/ci.yml', 'utf8'), {strict: true, uniqueKeys: true}); console.log('yaml ok');" && pnpm run ci`
  — `pnpm run ci` schließt `pnpm lint`, `pnpm typecheck` und `pnpm test:browser` mit dem
  neuen WebKit-Launcher ein. WebKit ist lokal installiert (`webkit-2359` im
  Playwright-Cache, in Zug 0 geholt); fehlt es, einmal `pnpm exec playwright install webkit`.
- Commit: `test(browser): release what a test builds after it, wait for signals instead of fixed delays, give every file the runner's 20 s timeout, run the suite in WebKit under WebGL 2 as well, hold the tests to the floating-promise rules and record why they stay without strictNullChecks` (um den letzten Teil ergänzt, Hinweis des Reviewers)

## Abgleich (Zug 0, 2026-10-23, gegen `9b72e4bd`)

- **TEST-001** unverändert. `stage-pipeline.test.js` gibt am Testende frei in den Tests
  ab Zeile 154, 232, 268, 332, 377, im Helfer `grayThroughNestedPipeline()` (≈ 530–585)
  und in den Tests ab 602, 689, 729, 770 (Audit-Zeilen 193/299/368/406/574/676/721/762/803
  um 0–1 verschoben). `withSquare()` (427–470) räumt per `try/finally` auf,
  `sprites-picking.test.js` per `disposables`-Array; dazu kommen zwei weitere Kopien
  desselben Arrays (`sprites-palette-swap`, `sprites-table-frame`) und Freigaben am
  Testende in rund 30 weiteren Dateien — dieselbe Ursache, siehe Nebenbefunde.
- **TEST-002** umgeformt und gewachsen. `web-test-runner.config.js:102` setzt weiter
  `timeout: '10000'`. Lokale Anhebungen stehen inzwischen 50-mal in 49 Dateien: 45 ×
  `this.timeout(20000)`, 4 × `this.timeout(30000)` (`sprites-animation-playback:29`,
  `sprites-palette-swap:93`, `texture-aseprite-sheet:36`, `vertex-objects-heap:68`),
  1 × `this.timeout(15000)` (`texture-store-on:81`). Ohne Anhebung, aber mit Display:
  `stage-pipeline`, `display-resize`, `stage-renderer`, `stage-canvas2d`, `stylesheets`,
  die `pan-control-*`.
- **TEST-003** unverändert, Zeilen 436, 592, 731 von `display-dispose.test.js`. Zeile 592
  ist dabei keine negative Assertion: sie stellt die Vorbedingung des Falls her (Release
  durch, Canvas wartet), die Assertion danach ist positiv. Der Fix dort ist deshalb ein
  anderer (Schritt 3).
- **TEST-005** unverändert, Override jetzt `biome.jsonc:152`, Kommentar 114–118. In Zug 0
  gemessen (Konfiguration kurz geändert und sofort zurückgesetzt): Biome 2.5.15 löst in
  den JS-Tests die Typen aus `@spearwolf/twopoint5d` auf — eine Probe mit
  `display.start();` und `display.nextFrame();` ohne `await` meldet beide als
  `noFloatingPromises`. Auf dem heutigen Stand der Tests: **0 Treffer**. `void <promise>`
  akzeptiert die Regel, ein nacktes `Promise.reject(x);` nicht.
- **TEST-006** unverändert (`web-test-runner.config.js:54-98`, drei Launcher). In Zug 0
  gemessen: Playwright 1.63.0 bringt WebKit 26.6 (`webkit-2359`); dessen Seiten haben auf
  macOS **kein `navigator.gpu`**, aber WebGL 2 (`RENDERER` = »WebKit WebGL«). Die ganze
  Suite unter einem WebKit-WebGL2-Launcher mit 20-s-Timeout: 61 Dateien, Exit 0, kein
  Fehlschlag (`$ARBEITSDIR/paket-2.zug0.webkit-macos.log`, Konfiguration
  `$ARBEITSDIR/paket-2.zug0.webkit.config.mjs`, Probe
  `$ARBEITSDIR/paket-2.zug0.webkit-gpu-probe.cjs`). Die Entscheidung »bei mehr als einer
  Handvoll WebKit-Fehlern eigene Pakete« greift damit nicht. Linux-WebKit ist lokal nicht
  prüfbar (kein Docker-Daemon); erster Beleg ist der CI-Lauf nach dem Push des Nutzers.
- **TEST-007** unverändert, `display-dispose.test.js:59-96` (»the first two cases below«,
  »the six cases after …« zweimal, »the four cases after …«). Die Quelle des Musters ist
  `packages/twopoint5d/docs/resource-lifecycle.md`, §7 »The dispose test pattern«;
  `vertex-objects-dispose.test.js:66-67` nennt sie schon, `pan-control-dispose.test.js:26`
  nicht.
- **TYPE-004** unverändert (`packages/twopoint5d-testing/tsconfig.json`). Gemessen mit
  `pnpm exec tsc -p tsconfig.json --strictNullChecks` (TypeScript 7.0.2) im Testpaket:
  **828 Fehler in 56 Dateien** (`$ARBEITSDIR/paket-2.zug0.strictnullchecks.log`) — 617 ×
  TS18048 (»'display' is possibly 'undefined'« 144, `sprite` 133, `display.renderer` 60,
  `store` 45, …), 101 × TS2345, 61 × TS2532. Nach der Entscheidung vom 2026-10-23 (bis
  etwa 50 aufrüsten, sonst festhalten) wird **festgehalten**, nicht aufgerüstet.
- Offene Befunde: der eine Eintrag (`docs/architecture.md:477-479`, Zählung der
  `test:scripts`-Specs) hat eine andere Ursache als dieses Paket und bleibt in der Queue,
  obwohl Schritt 6/7 dieselbe Datei in §6 ändern. Nicht mitnehmen.
- Folgen aus Paket 1: keine.

## Entscheidungen in Zug 0

- **Nicht geteilt.** Das Paket ist breit, aber fast durchweg mechanisch, und die Hälften
  träfen dieselben Testdateien (Timeouts und Aufräumen) in zwei Commits. Eine Teilung in
  `2a`/`2b` hielte außerdem die Schleife an: sie sucht nach Zug 0 die Marke von »2.«.
- **TEST-002: alle lokalen Timeouts fallen**, auch 15 s und 30 s. Ihre Kommentare nennen
  durchweg denselben Grund wie die 20-s-Stellen (»a cold webgpu start … in the hook«) oder
  keinen; der 15-s-Wert läge unter dem neuen zentralen. Ein lokaler Wert kommt nur zurück,
  wenn `pnpm run ci` die Datei mit dem zentralen Wert rot zeigt — dann mit einem
  Kommentar, der sagt, was in dieser Datei länger braucht als der kalte Start.
- **TEST-001: ein Helfer in `fixtures.js`** (`keep()` / `disposeKept()`), nicht ein
  weiteres lokales Array: AGENTS.md verlangt das für jeden Helfer, den eine zweite Datei
  braucht, und es gibt schon drei Kopien. Freigabe in umgekehrter Reihenfolge (zuletzt
  behalten, zuerst frei): wer ein Teil hält, wird in diesen Tests nach dem Teil angelegt
  und lässt damit zuerst los. `disposeKept()` ruft jede Datei **ausdrücklich** in ihrem
  `afterEach` vor `disposeDisplay()` — kein automatischer Hook im Root-Suite von
  `fixtures.js`: der liefe nach dem `afterEach` der Datei, also nach `display.dispose()`,
  während die Freigabe des Renderers schon läuft. `withSquare()` bleibt wie es ist: es
  baut einen eigenen Display, den es zuletzt freigibt, und das kann eine testweite Liste
  nicht ordnen.
- **TEST-001, Umfang:** ersetzt werden Freigaben, die nur aufräumen. Freigaben, die
  Gegenstand des Tests sind, bleiben im Testkörper (Kriterium in Schritt 2). Tests, die
  heute gar nichts freigeben, bekommen kein `keep()` — ihr Display wird pro Test gebaut
  und freigegeben, und »freigeben, was bisher niemand freigab« ist nicht der Befund.
- **TEST-003:** Stelle 436 wartet auf eine Kontroll-Rejection (deterministisch, weil der
  Browser unbehandelte Rejections in der Reihenfolge ihres Auftretens meldet); Stelle 731
  bekommt zwei Sonden (Aufrufe von `restoreContext()`, Ereignis `webglcontextrestored`),
  ein Fenster aus Signalen und eine Positivkontrolle im selben Test; Stelle 592 ersetzt
  die 100 ms durch einen Task-Wechsel und macht die Vorbedingung zur Assertion. Für 436
  und 731 belegt je ein Sabotage-Lauf, dass der Test rot wird, wenn das Ereignis eintritt.
- **TEST-007: `describe()`-Gruppen je Assertion** statt Testnamen im Kommentar. Gruppen
  prüft der Code selbst; eine Namensliste im Kommentar veraltet beim nächsten Umbenennen
  genauso still wie eine Zählung. Die Gruppierung verschiebt Tests und rückt ein — reine
  Verschiebung, prüfbar mit `git diff -w --color-moved`.
- **TEST-006: WebKit nur unter WebGL 2** (Entscheidung vom 2026-10-23, und Playwrights
  WebKit bietet kein `navigator.gpu`). Der Cache-Key der Playwright-Browser bekommt die
  Browserliste: ein alter Cache-Eintrag ohne WebKit würde sonst als Treffer
  wiederhergestellt, und der Launcher fände keinen Browser.
- **TYPE-004:** festhalten in `docs/architecture.md` §6 mit der Messung; `tsconfig.json`
  bleibt bei `strictNullChecks: false`.

## Vorgehen

Code, Kommentare und Doku auf Englisch (AGENTS.md). Die Kommentar- und Doku-Texte unten
sind Vorlagen; der Wortlaut darf sich dem Umfeld anpassen, der Inhalt nicht. Keine
Finding-IDs, kein »previously«/»now«/»no longer« in Kommentaren und Doku. Die Schritte
sind unabhängig; die Reihenfolge unten ist eine Empfehlung.

### Schritt 1 — Mocha-Timeout zentral (TEST-002)

1. `packages/twopoint5d-testing/web-test-runner.config.js`, `testFramework.config`:
   `timeout: '10000'` → `timeout: '20000'` (String bleibt String). Darüber ein Kommentar
   (Vorlage): »a cold start of the renderer — adapter and device under WebGPU, on CI on
   SwiftShader — falls into the first hook or the first test of a case, and hooks run on
   this budget as well. A file that needs more says why beside its own this.timeout()«
2. In jeder Datei aus `grep -n "this.timeout(" packages/twopoint5d-testing/test/*.test.js`
   (50 Treffer in 49 Dateien, alle auf `describe`-Ebene, `texture-factory-anisotropy.test.js`
   zweimal) die Zeile `this.timeout(…);` **und** den einzeiligen Kommentar direkt darüber
   löschen. Vorkommende Kommentare: »a cold webgpu start — adapter plus device — …« (drei
   Varianten), »a cold start of a context is slow on a software rasterizer«, »the display
   comes up in the hook — renderer init included — …«, »image+atlas loading over HTTP can
   take a moment in Firefox«. `texture-aseprite-sheet.test.js:36` und
   `sprites-shadow-pass.test.js:106` haben keinen Kommentar.
   Eine entstehende Leerzeile am Anfang des `describe`-Körpers entfernen. `function ()`
   der `describe`-Callbacks bleibt stehen (kein Umbau auf Pfeilfunktionen).
3. Zeigt der Verify-Lauf einen Timeout, kommt für **diese** Datei ein lokaler Wert zurück,
   mit Kommentar, was in ihr länger braucht als der kalte Start; der Report nennt Datei,
   Wert und die gemessene Dauer.

### Schritt 2 — Aufräumen über `keep()` und `disposeKept()` (TEST-001 und Nebenbefunde)

1. `packages/twopoint5d-testing/test/helpers/fixtures.js`, direkt unter dem Root-`afterEach`
   (nach Zeile ≈ 117) ein Abschnitt `// --- what a test builds itself ---` mit (Vorlage):

   ```js
   /** @type {{dispose(): unknown}[]} */
   const kept = [];

   /**
    * Hands `item` back and keeps it for {@link disposeKept}, which the `afterEach` of the suite
    * calls: what a test builds itself — a render target, a pipeline, a geometry, a material,
    * sprites — is released after the test, also when an assertion fails half way through it.
    * Keep a part before what holds it, so that the holder lets go first.
    *
    * @template {{dispose(): unknown}} T
    * @param {T} item
    * @returns {T}
    */
   export function keep(item) {
     kept.push(item);
     return item;
   }

   /**
    * Releases what {@link keep} kept, the last one kept first. Call it in `afterEach` before
    * `disposeDisplay()`: the items were drawn with the renderer of that display. An error a
    * `dispose()` throws is held for the hook above, like one of {@link disposeDisplay}, and the
    * items after it are released all the same.
    */
   export function disposeKept() {
     while (kept.length > 0) {
       const item = kept.pop();
       try {
         item.dispose();
       } catch (error) {
         teardownErrors.push(error);
       }
     }
   }
   ```

   Im Root-`afterEach` (Zeilen ≈ 104–117) die beiden Meldungstexte von
   `display.dispose() threw in the teardown of …` auf `dispose() threw in the teardown of …`
   verallgemeinern, ebenso den Kommentar über `disposeDisplay()`, soweit er nur vom
   Display spricht. Sonst nichts an der Datei.
2. **Kriterium für jede Testdatei.** Ein `dispose()`-Aufruf im Körper eines `it()` — oder
   eines Helfers, den ein `it()` aufruft und der den Display der Suite benutzt — wird
   ersetzt, wenn er nur aufräumt: das Objekt wird dort, wo es angelegt wird, mit
   `keep(…)` umschlossen (`const target = keep(new RenderTarget(64, 64));`), die
   Freigabezeile fällt weg, ebenso ein Kommentar, der nur diese Freigaben ankündigt.
   **Bleiben** im Testkörper:
   - Freigaben, die Gegenstand des Tests sind: auf sie folgt eine Assertion über ihre
     Wirkung — z. B. `second.dispose()` in »Mode D: a stage disposed while the renderer
     holds it …«, `sr.dispose()` und `stage.dispose()` in »stage.dispose() releases the
     render target of its pass node …«, `sr.dispose()` und `pipeline.dispose()` in
     »dispose() drops the pipeline reference …«. Ein so freigegebenes Objekt wird nicht
     zusätzlich mit `keep()` umschlossen.
   - Freigaben in Helfern mit eigenem Display (`withSquare()` in `stage-pipeline.test.js`).
   - Freigaben mitten im Test, nach denen weitergerendert wird (ein Austausch).
   - alles in `beforeEach`/`afterEach`/`before`/`after` (z. B. `target?.dispose()` eines in
     `beforeEach` gebauten Targets).
   - `scene.remove(…)` und Ähnliches, das keine Freigabe ist, bleibt, wo es gebraucht
     wird; was nur vor der Freigabe stand, darf mit ihr gehen.
   Reihenfolge: `keep()` für ein Teil vor `keep()` für das, was es hält. Wo ein Test
   seine Objekte in einer anderen Reihenfolge anlegt, als sie loslassen müssen (Beispiel
   `stage-pipeline`, »a nested StageRenderer without a pipeline …«: `root` und `child`
   müssen vor `pipeline` loslassen, `pipeline` wird nach ihnen angelegt), wird
   `keep(root)` bzw. `keep(child)` als eigene Zeile **nach** `keep(pipeline)` gestellt,
   so dass die umgekehrte Reihenfolge die Renderer zuerst freigibt — wie es der
   Kommentar am alten Testende verlangt (»the renderers let go first«).
3. In jeder Datei, die `keep` benutzt: `keep, disposeKept` aus `./helpers/fixtures.js`
   importieren und `disposeKept();` als **erste** Zeile ihres `afterEach` — einzige
   Ausnahme `sprites-picking.test.js`: dort direkt nach `picker?.dispose(); picker =
   undefined;`, weil der Picker hält, was er gepickt hat.
4. Die drei lokalen Arrays ersetzen: `sprites-picking.test.js` (`let disposables`,
   `disposables = []` im `beforeEach`, die Schleife im `afterEach`,
   `disposables.push(sprites, colorMap)` → `keep(colorMap); keep(sprites);` usw. an
   Zeilen ≈ 92, 377, 409), `sprites-palette-swap.test.js` (Array, Schleife, lokales
   `const keep = …`), `sprites-table-frame.test.js` (dasselbe). Der Aufruf `keep(x)`
   bleibt dort, wo er ist; nur die Herkunft wechselt.
5. Dateien mit Freigaben am Testende nach dem Stand von `9b72e4bd` (Zählung der
   eingerückten `….dispose();`-Zeilen, `afterEach` eingeschlossen — das Kriterium oben
   entscheidet, nicht die Zahl): `stage-pipeline` (Hauptfund), `sprites-pipeline-stages`,
   `sprites-shadow-pass`, `sprites-flip`, `sprites-animated-material`, `sprites-nine-slice`,
   `sprites-wave`, `sprites-trimmed-frames`, `sprites-rotated-frames`, `map2d-rotated-tiles`,
   `sprites-reflection-pass`, `sprites-glow`, `sprites-textured-material`, `sprites-grow`,
   `sprites-animation-playback`, `sprites-grid-base`, `sprites-fade-flash`, `sprites-anchor`,
   `vertex-objects-gpu-upload`, `texture-aseprite-sheet`, `texture-dynamic-atlas`,
   `texture-atlas-frame-sampling`, `text-bitmap-font`, `sprites-segments`,
   `sprites-placement-planes`, `sprites-free-tex-packer`, `sprites-draw-order`,
   `sprites-composition`, `sprites-axis-billboard`, `display-adopt-renderer`,
   `vertex-objects-heap`, `stage-canvas2d`, `sprites-rotation`, `sprites-billboard`,
   `texture-store-on`, `stage-renderer`, `map2d-visibility-helpers`, `display-stylesheets`,
   `display-adaptive-resolution`, die `pan-control-*`. **Nicht** umbauen:
   `display-dispose`, `pan-control-dispose`, `vertex-objects-dispose` — dort ist die
   Freigabe der Gegenstand (Assertions (a)–(f) des Dispose-Musters). Jede Datei der Liste
   ganz lesen und nach dem Kriterium entscheiden; eine Datei, in der nichts übrig bleibt,
   bleibt unverändert und wird im Report genannt.
6. In `stage-pipeline.test.js` außerdem `grayThroughNestedPipeline()`: alle neun
   Freigaben am Funktionsende über `keep()`; das übergebene `pool` mit
   `if (pool) keep(pool);` am Funktionsanfang vor den anderen.

### Schritt 3 — Signale statt fester Wartezeiten (TEST-003)

Alle drei Stellen in `packages/twopoint5d-testing/test/display-dispose.test.js`.

**Stelle 1 — »lets no rejection escape when the init that dispose() landed in fails«
(≈ 396–442).** Eine lokale Funktion über dem `describe` (nur diese Datei braucht sie;
AGENTS.md lässt sie deshalb hier):

```js
/**
 * Settles once the browser has reported every rejection that went unhandled before the call. It
 * leaves a rejection of its own unhandled one task later and waits for its `unhandledrejection`
 * event: the browser reports unhandled rejections in the order they occurred, so the control
 * comes after all of them. A browser that reported none would hold the test up until its
 * timeout — red, not green.
 *
 * @returns {Promise<void>}
 */
function whenRejectionsReported() {
  const control = new Error('the control rejection of whenRejectionsReported()');
  return new Promise((resolve) => {
    /** @param {PromiseRejectionEvent} event */
    const onUnhandledRejection = (event) => {
      if (event.reason !== control) return;
      event.preventDefault();
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      resolve();
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    setTimeout(() => {
      // left unhandled on purpose: it is the control the listener waits for
      void Promise.reject(control);
    }, 0);
  });
}
```

Im Test die Zeilen `// the browser reports an unhandled rejection in a task of its own …`
und `await new Promise((resolve) => setTimeout(resolve, 100));` ersetzen durch
`await whenRejectionsReported();` mit einem Kommentar (Vorlage): »the failure settles in
microtasks — the release of a failed init awaits nothing else — so a rejection it left
unhandled is reported before the control«. Der Listener des Tests und sein `finally`
bleiben.

**Sabotage-Lauf (nicht committen):** direkt nach `failInit(initFailure);` vorübergehend
`void Promise.reject(initFailure);` einfügen, die Datei laufen lassen
(`cd packages/twopoint5d-testing && pnpm exec web-test-runner test/display-dispose.test.js`
gegen die gebaute Library), **rot** sehen (`rejections of the failed init that nobody
handled` erwartet Länge 0, bekommt 1), Ausgabe in den Report, Zeile wieder entfernen.

**Stelle 2 — »a canvas that was handed in carries a second display built after the first
one has been released« (≈ 577–599).** Keine negative Assertion; die 100 ms sollten den Fall
von »… built while the first one is being released« trennen. Ersetzen:
1. Vor `previous.dispose()` (nach `await previous.nextFrame()`) den Kontext lesen, solange
   der Display lebt (`isWebGLBackend` wirft nach `dispose()`):
   `const gl = previous.isWebGLBackend ? /** @type {{gl?: WebGL2RenderingContext}} */ (previous.renderer.backend).gl : undefined;`
   mit dem Kommentar der Datei »the three.js typings leave gl off the backend«.
2. Nach `await released;` statt der 100 ms:
   `await new Promise((resolve) => setTimeout(resolve, 0));` mit Kommentar (Vorlage):
   »the release settles a few microtasks after renderer.dispose(); a task later it is
   through, and the canvas waits for a display of its own«, dann
   `if (gl) expect(gl.isContextLost(), 'the context the second display has to bring back').to.equal(true);`
   Den alten Kommentar (»… has sat without a display for 100 ms …«) ersetzen; sein Satz
   über WebGPU (»under WebGPU there is nothing to restore, and the case checks that the
   second display draws«) darf bleiben.

**Stelle 3 — »a canvas that was handed in keeps its WebGL context lost while no display
follows« (≈ 713–735).** Umbau so (Vorlage, Namen und Kommentare dürfen sich anpassen):

```js
  it('a canvas that was handed in keeps its WebGL context lost while no display follows', async function () {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    previous = new Display(canvas);
    await previous.start();

    // only a WebGL context is lost on release
    if (!previous.isWebGLBackend) this.skip();

    // the three.js typings leave gl off the backend
    const {gl} = /** @type {{gl?: WebGL2RenderingContext}} */ (previous.renderer.backend);
    // the same object for as long as the context lives, and the one the release keeps to restore it
    const extension = gl.getExtension('WEBGL_lose_context');
    // two probes: who asks for the context back, and whether it comes
    let restoreCalls = 0;
    const realRestore = extension.restoreContext.bind(extension);
    extension.restoreContext = () => {
      restoreCalls += 1;
      realRestore();
    };
    let restoredEvents = 0;
    const onRestored = () => {
      restoredEvents += 1;
    };
    canvas.addEventListener('webglcontextrestored', onRestored);
    const lost = new Promise((resolve) => {
      canvas.addEventListener('webglcontextlost', resolve, {once: true});
    });

    try {
      const released = whenReleased(previous.renderer);
      previous.dispose();
      await released;
      await lost;
      // a display built on the canvas asks for the context a task after the loss has been
      // dispatched (restoreContext() in Display.ts); two animation frames of the page are many
      // tasks more
      expect(await whenPageAnimates(), 'the animation frames of the page').to.equal('frames');

      expect(restoreCalls, 'restores asked for while no display follows').to.equal(0);
      expect(restoredEvents, 'restores heard while no display follows').to.equal(0);
      // a live context on a canvas nobody draws to counts against the few the browser keeps alive
      expect(gl.isContextLost(), 'the context of a canvas with no display on it').to.equal(true);

      // the control: the display that follows asks for the context, and both probes hear it
      display = new Display(canvas);
      await display.start();
      expect(restoreCalls, 'restores asked for by the display that followed').to.be.at.least(1);
      expect(restoredEvents, 'restores heard once a display followed').to.be.at.least(1);
    } finally {
      canvas.removeEventListener('webglcontextrestored', onRestored);
    }
  });
```

`whenPageAnimates` aus `./helpers/fixtures.js` importieren, falls die Datei es noch nicht
tut. `previous` und `display` räumt das `afterEach` der Suite.

**Sabotage-Lauf (nicht committen):** in `packages/twopoint5d/src/display/Display.ts`,
`#releaseRenderer()`, direkt nach `if (lost != null) lostContexts.set(canvas, lost);`
vorübergehend
`if (lost != null) void lost.prevented.then(() => setTimeout(() => lost.extension.restoreContext(), 0));`
einfügen, `pnpm build:twopoint5d`, die Datei laufen lassen, **rot** sehen
(`restores asked for while no display follows`), Ausgabe in den Report. Danach die Zeile
entfernen, `git diff --exit-code -- packages/twopoint5d/src` muss leer sein, und
`pnpm build:twopoint5d` erneut.

### Schritt 4 — `display-dispose.test.js` nach Assertionen gruppieren (TEST-007)

1. Den Kommentarblock 59–96 auflösen. An seine Stelle, direkt nach dem `afterEach` der
   Suite, ein kurzer Kopf (Vorlage): »The cases follow the dispose test pattern of
   packages/twopoint5d/docs/resource-lifecycle.md (§7), one describe() for each of its
   assertions (a) to (d). Assertion (e) — "leaks no signals and no effects" — has no
   subject: Display creates neither, and its events run through eventize, whose teardown
   the case of (d) covers. Assertion (f) — "gives every slot it took back" — has no
   subject either: a Display takes no slot from a pool and no tile from a factory.«
2. Vier `describe()`-Gruppen innerhalb der Suite; Hooks und `let`-Variablen bleiben auf
   der Ebene der Suite. Jede Gruppe beginnt mit einem Kommentar, der sagt, was sie prüft,
   **ohne Zählungen und ohne Verweise auf Positionen** (»below«, »after …«). Testtitel
   bleiben wortgleich. Zuordnung:
   - `describe('(a) releases what it built itself', …)` mit drei Untergruppen:
     - `describe('the container', …)`: »takes the container it built out of the host«
     - `describe('the renderer', …)` — Kommentar: wann `renderer.dispose()` läuft (nach
       einem Init, in den `dispose()` fiel; gar nicht nach einem gescheiterten, dessen
       `webglcontextlost`-Listener trotzdem vom Canvas geht; erst wenn die Queue leer ist;
       spät genug, dass die Seite ihre Animation Frames behält, für einen Display in einem
       Host-Element und einen auf einem übergebenen Canvas — der Fall des übernommenen
       Renderers steht in `display-adopt-renderer.test.js`): »releases the renderer once an
       init that dispose() landed in is through«, »lets no rejection escape when the init
       that dispose() landed in fails«, »takes the webglcontextlost listener of a failed
       WebGL init off the canvas«, »releases the renderer only after the GPU has run the
       work submitted to it«, »the page keeps its animation frames when a display built in
       a host element is disposed right after a render()«, »the page keeps its animation
       frames when a display on a canvas that was handed in is disposed right after a
       render()«
     - `describe('the canvas that was handed in, for the display after it', …)` —
       Kommentar: der Canvas gehört dem Aufrufer und trägt nach der Freigabe den nächsten
       Display, und was das Backend danach meldet (ein zerstörtes Device oder ein
       verlorener WebGL-Kontext): »a canvas that was handed in carries a second display
       built while the first one is being released«, »… built after the first one has been
       released«, »… when dispose() lands in the init of the first one«, »a WebGL context
       that does not come back holds the next display on its canvas up for a bounded
       time«, »a WebGL context that did not come back in time gets another restore from
       the next display on its canvas«, »a canvas that was handed in keeps its WebGL
       context lost while no display follows«
   - `describe('(b) does not touch what was handed in', …)` — Kommentar: gilt wörtlich
     für einen Canvas, der dem Konstruktor übergeben wurde; für einen übergebenen
     `WebGPURenderer` kehrt es sich um (er wird übernommen und mit dem Display
     freigegeben, Fall in `display-adopt-renderer.test.js`): »leaves a canvas that was
     handed in where it stands«, »gives a canvas that was handed in back as it found it«,
     »gives a canvas that was handed in its own classes, styles and attributes back, the
     fullscreen class included«, »leaves no data-engine on a canvas that was handed in once
     the release is through«, »leaves no data-engine on a canvas that was handed in once the
     release is through, also when dispose() lands in the init«
   - `describe('(c) every public member behaves after dispose() as its TSDoc says', …)` —
     Kommentar: `canvas`, `start()`, `getEventProps()`, `isWebGPUBackend` und
     `isWebGLBackend` werfen, `resize()`, `renderFrame()` und `stop()` schweigen, der
     Disposed-Zustand mit seinen letzten Werten bleibt lesbar: »canvas throws after
     dispose()«, »start() rejects after dispose()«, »getEventProps() throws after
     dispose()«, »resize(), renderFrame() and stop() are silent no-ops after dispose()«,
     »reports the disposed state and keeps its last values«, »isWebGPUBackend and
     isWebGLBackend throw after dispose()«, »a start() that dispose() lands in while it
     waits for the renderer rejects and leaves the frame loop empty«, »stays stopped after
     dispose(), whatever a caller does to it«, »start() is refused when dispose() lands
     inside beforeStartCallback«, »nextFrame() is rejected by dispose(), and refused after
     it«
   - `describe('(d) the second call throws nothing and releases nothing a second time', …)`:
     »a second dispose() throws nothing and emits nothing«
3. Jeder der 29 Tests steht danach in genau einer Gruppe; Zählprobe im Report
   (`grep -c "^\s*it(" display-dispose.test.js` vorher und nachher gleich). Der Test-Inhalt
   ändert sich in diesem Schritt nicht (Schritt 3 ist der einzige inhaltliche Eingriff).
4. `packages/twopoint5d-testing/test/pan-control-dispose.test.js:26`: »Assertion (a) of
   the dispose test pattern« → »Assertion (a) of the dispose test pattern in
   packages/twopoint5d/docs/resource-lifecycle.md (§7)«, Zeilenumbruch wie im Umfeld.
   Sonst nichts an der Datei außer dem, was Schritt 1 und 2 verlangen.

### Schritt 5 — Floating-Promise-Regeln für die Browser-Tests (TEST-005)

1. `biome.jsonc:152`: `"includes": ["**", "!packages/*/src/**"]` →
   `"includes": ["**", "!packages/*/src/**", "!packages/twopoint5d-testing/test/**"]`.
2. Kommentar 114–118 anpassen (Vorlage): »a promise nobody awaits or catches loses its
   rejection, in a spec, a browser test or the library alike; both rules read the types
   Biome infers for the expressions — in the browser tests from the declarations of the
   built library they import. They hold packages/*/src and
   packages/twopoint5d-testing/test; an override below takes them off everywhere else.
   Biome runs its type inference only for a rule switched on up here, not for one an
   override switches on.«
3. `pnpm lint`. Erwartet: keine Treffer im heutigen Code (in Zug 0 gemessen). Treffer im
   neuen Code dieses Pakets werden behoben (`await`, oder `void` mit Kommentar, wo das
   Liegenlassen gewollt ist); keine `biome-ignore` ohne Grund.

### Schritt 6 — WebKit unter WebGL 2 (TEST-006)

1. `web-test-runner.config.js`:
   - JSDoc von `backendLauncher`: `@param {'chromium' | 'firefox' | 'webkit'} product`.
   - Kommentar über `browsers:` (50–53) ergänzen (Vorlage): »… headless Firefox has no
     adapter at all, and Playwright's WebKit offers no navigator.gpu — so WebKit runs under
     WebGL 2 alone …«.
   - Vierter Eintrag hinter Firefox:
     `backendLauncher('webkit', 'WebGL2', {})` mit Kommentar (Vorlage): »WebKit, the engine
     of Safari. Playwright 1.63.0 ships WebKit 26.6, whose pages have no navigator.gpu
     (measured on macOS), so it renders under WebGL 2; it needs no flags«. Keine
     Launch-Optionen ohne Messung.
2. `.github/workflows/ci.yml` (Matrix-Form aus Paket 1 bleibt):
   - Zeile 137: `pnpm exec playwright install --with-deps chromium firefox webkit`
   - Zeile 146: `timeout 180 pnpm exec playwright install-deps chromium firefox webkit && exit 0`
   - Zeile 124: Key `playwright-${{ runner.os }}-${{ steps.playwright.outputs.version }}-chromium-firefox-webkit`,
     mit Kommentar am Cache-Schritt (Vorlage): »the key names the browsers the two install
     steps below fetch: a cache saved before a browser joined them would restore without
     it, and its launcher would find no browser«.
   - Zeitgrenzen (`timeout-minutes` 8/10/12, die 180 s je `install-deps`-Versuch) bleiben;
     lokal brauchte WebKit allein ≈ 70 s für die Suite, die drei anderen zusammen 2 min 26 s.
3. Doku nachziehen (geänderte Verträge, Konvention):
   - `AGENTS.md:37`: `pnpm exec playwright install chromium firefox webkit` — the browsers for …
   - `README.md:199-204`: »need Chromium, Firefox and WebKit from Playwright« und das
     Kommando mit `webkit`.
   - `docs/architecture.md` §3 »In CI« (≈ 222–236): vier Browser, `Webkit WebGL2` als
     vierter Launchername (so heißt er im Reporter: `capitalize(product)` + Backend), ein
     Satz zu WebKit (Vorlage): »WebKit runs under WebGL 2 alone: Playwright's WebKit offers
     no navigator.gpu (measured with Playwright 1.63.0, WebKit 26.6, on macOS)«. Der Absatz
     zum Cache (≈ 244–254): Key `playwright-<os>-<version>-<browsers>` mit dem Grund aus
     dem Kommentar oben.
   - `docs/architecture.md` §5 (≈ 404): »… brings the Chromium, Firefox and WebKit the
     browser suite runs on …«.
   - `docs/architecture.md` §6 (≈ 460–464): »Playwright Chromium, Firefox and WebKit«,
     »every file under WebGPU in Chromium and under WebGL 2 in Chromium, Firefox and
     WebKit«, Install-Kommando mit `webkit`.
   - `packages/twopoint5d/docs/architecture.md:257`: »in real Chromium, Firefox and WebKit«.
   - Danach `grep -rn "chromium firefox\|Chromium and Firefox\|three browsers" --include=*.md --include=*.yml --include=*.js .`
     ohne `node_modules`, `audit.html`, `docs/remediation/`: übrig bleiben darf nur
     `stage-pipeline.test.js:504` (eine Messung, die sagt, worunter gemessen wurde).

### Schritt 7 — `strictNullChecks` der Browser-Tests festhalten (TYPE-004)

1. `docs/architecture.md` §6, im ersten Aufzählungspunkt zu `@web/test-runner` nach dem
   Satz über `checkJs`/JSDoc ein Absatz oder Satzpaar (Vorlage): »`strictNullChecks` stays
   off for the browser tests. Switched on, TypeScript 7.0.2 reports 828 errors in 56 files
   of the suite (measured in October 2026): three in four are `'display' is possibly
   'undefined'` and its kin — a fixture variable that a `beforeEach` assigns and an
   `afterEach` clears, an order the checker cannot see —, and most of the rest hand the
   same variables on as arguments. A cast at each of them would find nothing; a
   nullability error against the public API shows in the library's own specs, which the
   root config checks strictly.«
2. `packages/twopoint5d-testing/tsconfig.json`, Kopfkommentar: einen Satz anhängen
   (Vorlage): »docs/architecture.md (§6) holds what strictNullChecks reports when it is
   switched on.« Optionen unverändert.

### Schritt 8 — Prüfen und Report

1. Verify-Kommando aus dem Kopf; volle Ausgabe nach `$ARBEITSDIR`.
2. Zusätzlich in den Report:
   - `grep -n "this.timeout(" packages/twopoint5d-testing/test/*.test.js` — leer, oder je
     Treffer Datei, Wert, Grund aus Schritt 1.3.
   - `grep -n "setTimeout(resolve, 100)" packages/twopoint5d-testing/test/display-dispose.test.js` — leer.
   - beide roten Sabotage-Läufe aus Schritt 3 mit Ausgabe, und
     `git diff --exit-code -- packages/twopoint5d/src` leer.
   - die Zählprobe aus Schritt 4.3.
   - die Dateien aus Schritt 2.5, die unverändert blieben, mit einem Satz warum.
   - die Zeilen von `pnpm test:browser`, die `Webkit WebGL2` nennen (Launcher läuft mit).

## Hinweise für B

- Reviewer-Brief: Die Gruppierung in `display-dispose.test.js` ist eine Verschiebung mit
  Einrückung; `git diff -w --color-moved` trennt sie von den drei inhaltlichen Stellen.
- `Ergebnis:` nennt: Linux-WebKit in diesem Lauf nicht belegt, erster Beleg ist der
  CI-Lauf nach dem Push des Nutzers (kein Push in diesem Lauf).
- `Schnittstellen:` muss nach dem Commit mindestens tragen: `keep(item)` /
  `disposeKept()` in `test/helpers/fixtures.js` (jede Testdatei, die `keep` benutzt,
  ruft `disposeKept()` im `afterEach` vor `disposeDisplay()`); zentraler Mocha-Timeout
  20 s, keine dateilokalen `this.timeout()` ohne Grund; `noFloatingPromises` und
  `noMisusedPromises` gelten für `packages/twopoint5d-testing/test/**`; vierter Launcher
  `Webkit WebGL2`, jede Testdatei läuft auch dort; Playwright-Cache-Key mit
  Browserliste. Spätere Pakete, die Browser-Tests schreiben (4, 5, 7, 8, 10, 11, 12),
  bauen darauf.

## Findings im Volltext

**TEST-001 · low · packages/twopoint5d-testing/test/stage-pipeline.test.js:193** —
Aufräumen der Browser-Tests in finally oder afterEach statt am Testende
(weitere Stellen: :299, :368, :406, :574, :676, :721, :762, :803)
Etwa zehn Tests in stage-pipeline.test.js geben Pipeline, Render-Target, Geometrie und
Material in den letzten Zeilen des Testkörpers frei. Schlägt eine Assertion davor fehl,
läuft die Freigabe nie; das afterEach der Suite kennt nur display und host. Die Reste
(Render-Targets, Pipelines) bleiben dann im selben Renderer-Kontext und können
Folgefehler in den nächsten Tests auslösen, die den eigentlichen Fehler überdecken.
Dieselbe Datei zeigt mit withSquare() (try/finally) und sprites-picking.test.js mit einem
disposables-Array im afterEach die robustere Form; die Suite hat also drei Aufräumstile.
Beleg: `root.dispose(); child.dispose(); stage.dispose(); pipeline.dispose(); target.dispose(); geometry.dispose(); material.dispose();`
direkt nach den expect()-Aufrufen
Empfehlung: Ein disposables-Array wie in sprites-picking.test.js (oder ein Helper in
helpers/fixtures.js) einführen, im afterEach in umgekehrter Anlegereihenfolge freigeben,
und die Handfreigaben am Testende streichen.

**TEST-002 · low · packages/twopoint5d-testing/web-test-runner.config.js:94** —
Mocha-Timeout der Browser-Tests zentral für den kalten WebGPU-Start anheben
(weitere Stellen: stage-pipeline.test.js:17, display-dispose.test.js:35, sprites-picking.test.js:47)
Die Runner-Konfiguration setzt den Mocha-Timeout auf 10 s. display-dispose.test.js und
sprites-picking.test.js heben ihn per this.timeout(20000) auf 20 s an, weil der kalte
WebGPU-Start (Adapter plus Device, auf CI über SwiftShader) langsam ist.
stage-pipeline.test.js startet ebenfalls in jedem Test ein Display und tut das nicht; der
erste Test jeder Datei trägt den kalten Start. Auf einem belasteten Runner ist das ein
Flakiness-Risiko, das von der Datei abhängt, nicht von der Sache.
Beleg: `timeout: '10000'` in web-test-runner.config.js; `this.timeout(20000)` mit
Kommentar zum kalten Start in zwei der drei Dateien
Empfehlung: Den Timeout in der Runner-Konfiguration auf 20 s setzen und die dateilokalen
this.timeout()-Aufrufe streichen.

**TEST-003 · low · packages/twopoint5d-testing/test/display-dispose.test.js:436** —
Negative Assertions nicht mit festen setTimeout-Wartezeiten absichern
(weitere Stellen: :592, :731)
Drei Tests warten 100 ms per setTimeout und prüfen dann, dass etwas nicht geschehen ist
(keine unhandled rejection, kein Context-Restore, Context bleibt verloren). Auf einem
langsamen Runner kann das gesuchte Ereignis nach dem Fenster eintreten; der Test wird
dann grün, obwohl der Fehler da ist (falsch-negativ), statt rot zu werden. Die
Positivfälle der Datei sind dagegen an Promises gebunden.
Beleg: `await new Promise((resolve) => setTimeout(resolve, 100));` gefolgt von
`expect(escaped ...).to.have.length(0)`
Empfehlung: Wo möglich auf ein beobachtbares Signal warten (Event des Backends,
nextFrame()) oder die Wartezeit mit einem Positivkontroll-Fall koppeln, der zeigt, dass
das Ereignis innerhalb des Fensters eintreten würde.

**TEST-005 · low · biome.jsonc:151** — Floating-Promise-Regeln von Biome auch für die
Browser-Tests einschalten (weitere Stelle: :114)
noFloatingPromises und noMisusedPromises gelten nur für packages/*/src; der Override in
Zeile 151 schaltet sie überall sonst ab, also auch für
packages/twopoint5d-testing/test/*.test.js. Gerade dort stehen die meisten asynchronen
Aufrufe (display.start(), nextFrame(), pick(), readRenderTargetPixelsAsync()); ein
vergessenes await fiele nur als Flakiness oder als vakuös grüner Test auf. Der Kommentar
in Zeile 114 begründet die Regeln mit Specs; die Browser-Tests sind dieselbe Gattung. Ob
Biomes Typinferenz die JSDoc-getypten Importe aus @spearwolf/twopoint5d in JS-Dateien
auflöst, ist ungeprüft.
Beleg: `"includes": ["**", "!packages/*/src/**"], ... "noFloatingPromises": "off"`
Empfehlung: Den Ausschluss auf packages/twopoint5d-testing/test erweitern, Treffer prüfen
und beheben; liefert die Inferenz dort nichts, bleibt es bei der Ausnahme, aber mit
Kommentar.

**TEST-006 · low · packages/twopoint5d-testing/web-test-runner.config.js:54** — WebKit in
die Browser-Test-Matrix aufnehmen
Die Browser-Tests laufen auf Chromium (WebGPU und WebGL 2) und Firefox (WebGL 2). WebKit
fehlt, obwohl die Bibliothek WebGPU bevorzugt und Safari die dritte große Engine mit
WebGPU ist; Safari-spezifische Unterschiede (Texturformate, Reihenfolge des Read-back,
Context-Verlust) fielen erst in manueller Prüfung auf. Das ist eine Lücke der Strategie,
kein Defekt.
Beleg: `browsers: [backendLauncher('chromium', 'WebGPU', …), backendLauncher('chromium', 'WebGL2', …), backendLauncher('firefox', 'WebGL2', …)]`
Empfehlung: Einen webkit-Launcher für WebGL 2 mit Playwright ergänzen (Linux-WebKit
genügt als Anfang) oder die Abdeckungslücke in docs/architecture.md festhalten.

**TEST-007 · low · packages/twopoint5d-testing/test/display-dispose.test.js:59** —
Positionsangaben in Kommentaren der Dispose-Tests durch Namen ersetzen
(weitere Stellen: :62, :77)
Der Kommentarblock vor dem ersten Test beschreibt die Abdeckung der Assertions (a) bis
(f) mit Zählangaben wie »the six cases after …«, »the four cases after …«, »the first two
cases below«. Sobald ein Fall dazukommt oder umsortiert wird, stimmt der Block nicht
mehr, und nichts prüft ihn. Auf die Assertion-Buchstaben verweist er als »dispose test
pattern«, ohne die Quelle zu nennen (vermutlich
packages/twopoint5d/docs/resource-lifecycle.md).
Beleg: `The six cases after those follow a canvas that was handed in`
Empfehlung: Statt Zählung die Testnamen oder describe-Blöcke nennen (die Fälle in eigene
describe()-Gruppen je Assertion legen) und die Quelle des Musters verlinken.

**TYPE-004 · info · packages/twopoint5d-testing/tsconfig.json:1** — Strictness der
Browser-Tests schrittweise wieder anheben
Das Testpaket schaltet noImplicitAny und strictNullChecks ab (begründet im Kopfkommentar
der Datei). Das hält die Tests lesbar, lässt aber Nullability-Fehler gegen die
öffentliche API durch: etwa liest display-dispose.test.js:239 `error.message` auf einem
`Error | undefined`, ohne dass der Check anschlägt. Typfehler der Bibliothek in
Rückgabetypen (optional vs. definiert) bleiben dort unsichtbar.
Beleg: `"noImplicitAny": false, "strictNullChecks": false`
Empfehlung: strictNullChecks versuchsweise einschalten und die Treffer zählen; bleibt die
Zahl klein, die Dateien einzeln per // @ts-check-Annotation und Cast aufrüsten, sonst die
Entscheidung in docs/architecture.md festhalten.

## Verlauf

- 2026-10-23 Zug 0: Detailplan steht · TEST-001 unverändert (Zeilen ±1), Ursache in
  ≈ 30 weiteren Dateien und drei lokalen `disposables`-Arrays → ins Paket · TEST-002
  umgeformt: 50 lokale Timeouts in 49 Dateien (45 × 20 s, 4 × 30 s, 1 × 15 s), zentral
  weiter 10 s ·
  TEST-003 unverändert (436/592/731; 592 ist Vorbedingung, keine Negativ-Assertion) ·
  TEST-005 unverändert (`biome.jsonc:152`), Probe: Inferenz greift in JS-Tests, 0 Treffer
  heute · TEST-006 unverändert; WebKit 26.6 lokal installiert, Suite unter WebKit/WebGL 2
  grün (61 Dateien), kein `navigator.gpu` → `$ARBEITSDIR/paket-2.zug0.webkit-macos.log` ·
  TEST-007 unverändert, dazu `pan-control-dispose.test.js:26` ohne Quelle → ins Paket ·
  TYPE-004: 828 Fehler mit `strictNullChecks` → festhalten,
  `$ARBEITSDIR/paket-2.zug0.strictnullchecks.log` · keine Folgen zu verteilen (Paket 1:
  `Folgen: —`) · Queue-Eintrag `docs/architecture.md:477-479` bleibt (andere Ursache) ·
  Restplan unverändert · Projektdateien unverändert (`biome.jsonc` für zwei Messungen
  kurz geändert und zurückgesetzt, `git diff --quiet` geprüft)
- 2026-10-23 Zug 1: Implementierer beauftragt, Modell sonnet (mittlere Stufe), Effort
  medium, Brief `$ARBEITSDIR/paket-2.impl-0.brief.txt`, Report nach
  `$ARBEITSDIR/paket-2.impl-0.json`
- 2026-10-23 Zug 2: Report FERTIG (Vorbehalt Linux-WebKit unbelegt) · 61 Dateien geändert
  (9 Konfig/Doku, `display-dispose`, `pan-control-dispose`, 49 × Timeout, 30 × `keep()`)
  · Arbeitsbaum schmutzig · Sabotage-Läufe rot (`$ARBEITSDIR/sabotage1.log`,
  `sabotage2.log`) · Verify läuft
- 2026-10-23 Zug 2 (Verify): `pnpm run ci` exit=0 (`$ARBEITSDIR/paket-2.verify.log`,
  Browser-Task dort Cache-Treffer) · Browser-Suite ungecacht nachgefahren exit=0, 2 m 34 s,
  `Webkit WebGL2` 51 × (`$ARBEITSDIR/paket-2.verify-browser.log`)
- 2026-10-23 Zug 3: Reviewer opus/medium, alle 7 Findings und 3 Nebenbefunde erfüllt ·
  1 wichtig (`stage-pipeline.test.js:376` `keep(root)` vor `keep(stage)`, falsche
  Freigabereihenfolge) · 5 klein · Urteil nachbessern · Diff `$ARBEITSDIR/paket-2.diff`,
  Report `$ARBEITSDIR/paket-2.review-0.json`
- 2026-10-23 Zug 4 Runde 1: offen 1 wichtig (`stage-pipeline.test.js:376`) plus 3 klein
  (`sprites-grow:69`, `tsconfig.json:6-7`, `docs/architecture.md:477`) → derselbe
  Implementierer per `--resume`, sonnet/medium, Brief `$ARBEITSDIR/paket-2.impl-1.brief.txt`
- 2026-10-23 Zug 4 Runde 1 zurück: FERTIG, alle 4 Stellen geändert · `pnpm run ci` exit=0,
  Browser-Suite frisch (`$ARBEITSDIR/paket-2.verify.log`) · Reviewer gezielt beauftragt
  (opus/medium, Diff `$ARBEITSDIR/paket-2.r1.diff`)
- 2026-10-23 Zug 4 Runde 1 Review: alle 4 Befunde erledigt, 1 neuer klein (überlange
  Zeilen), Urteil freigeben (`$ARBEITSDIR/paket-2.review-1.json`)
- 2026-10-23 Zug 5: committet `d0b1ad33`, 61 Dateien, Verify `$ARBEITSDIR/paket-2.verify.log`
  exit=0 (nach Runde 1, Browser-Suite frisch), 1 Runde

## Urteil des Reviewers

- TEST-001 behoben — `test/helpers/fixtures.js:119-154` (`keep()`/`disposeKept()`), 33 Dateien
  rufen `disposeKept()` im `afterEach` vor `disposeDisplay()`; `stage-pipeline.test.js`
  vollständig, Ordnung in »Mode D …« in Runde 1 korrigiert (`:384-389`)
- TEST-002 behoben — `web-test-runner.config.js:106-109` `timeout: '20000'`, kein
  `this.timeout(` mehr in `test/*.test.js`
- TEST-003 behoben — `display-dispose.test.js:44-60` (`whenRejectionsReported()`, genutzt
  `:191`), `:346-359` (Vorbedingung als Assertion), `:480-534` (Sonden, Signalfenster,
  Positivkontrolle); beide Sabotage-Läufe rot
- TEST-005 behoben — `biome.jsonc:153` nimmt `packages/twopoint5d-testing/test/**` aus dem
  Override, Kommentar `:114-119`
- TEST-006 behoben — `web-test-runner.config.js:99-101` Launcher `webkit`/WebGL2,
  `ci.yml:122-126` Cache-Key mit Browserliste, `:139`, `:148` installieren `webkit`; Linux
  unbelegt
- TEST-007 behoben — `display-dispose.test.js:83-87` Kopf mit Verweis auf
  `resource-lifecycle.md` §7, Gruppen (a)–(d) an `:89`, `:538`, `:640`, `:908`, 29 `it(`
  vorher wie nachher, Titel identisch
- TYPE-004 festgehalten — `docs/architecture.md:470-478` (§6), Verweis
  `packages/twopoint5d-testing/tsconfig.json:6`
- Nebenbefund `pan-control-dispose.test.js:26` behoben (Verweis auf §7)
- Nebenbefund lokale `disposables`-Arrays behoben (`sprites-picking`, `sprites-palette-swap`,
  `sprites-table-frame`, dazu `disposals` in `texture-atlas-frame-sampling`,
  `sprites-segments`)
- Nebenbefund Freigaben am Testende behoben; zwölf Dateien bewusst unverändert (nur Hook
  oder Freigabe ist Gegenstand des Tests)

Kleine Befunde (ohne Runde):
- `docs/architecture.md:224, 251, 408, 464, 468` — fünf Zeilen aus den WebKit-Ergänzungen mit
  92–98 Zeichen, die Datei bricht sonst bei etwa 90 um
- `packages/twopoint5d-testing/test/sprites-picking.test.js:84-85` — `makeSprites()` hält
  `colorMap` und `sprites` per `keep()`, der Test »builds nothing more over 50 picks …«
  (`:469`, `:482`) gibt beide als Gegenstand frei, `disposeKept()` ruft sie ein zweites Mal;
  so schon mit dem lokalen Array, `keep()` blieb laut Plan an Ort und Stelle
- Nebenbefund des Implementierers, nicht in die Queue: Stellen ohne jede Freigabe
  (`stage-pipeline.test.js:300-326` u. a., `vertex-objects-gpu-upload.test.js` ab `:173`)
  — nach der Entscheidung in Zug 0 bewusst ohne `keep()`
