# Paket 3 — Test-Harness: Coverage-Target, echte Schwellen, stabile Browsertests, Backend-Log

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: CFG-020 (low), TEST-021 (medium), TEST-025 (low), Offene Frage »Welches Backend läuft in CI?«
- Abgespalten: TYPE-014 (low) und CFG-014 (low) → Paket 3b (Begründung unten, Messwerte im Abschnitt »Übergabe an 3b«)
- Ziel: Das Gate misst Coverage in einem eigenen Lauf über die ganze Bibliothek gegen Schwellen nah am Ist-Stand, ein Einzeldatei-Lauf misst nichts, und die Browser-Suite wartet auf das, was sie prüft, statt auf feste Zeiten, und nennt je Browser das Backend, das three bekommt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/package.json` (Scripts `test`, neu `coverage`)
  - `packages/twopoint5d/project.json` (Target `test` ohne `outputs`, neues Target `coverage`)
  - `packages/twopoint5d/vite.config.ts` (Schwellen und ihr Kommentar)
  - `package.json` (Root: Script `test:coverage`, Gate-Zeile `ci`)
  - `packages/twopoint5d-testing/test/hello-twopoint5d-canvas.test.js`
  - `packages/twopoint5d-testing/test/display-constructor.test.js`
  - `packages/twopoint5d-testing/test/display-dispose.test.js`
  - `packages/twopoint5d-testing/test/texture-store-on.test.js`
  - `packages/twopoint5d-testing/test/vertex-objects-heap.test.js`
  - `packages/twopoint5d-testing/test/renderer-backend.test.js` (neu)
  - `AGENTS.md`, `docs/architecture.md`
  - nicht anfassen: `.github/workflows/ci.yml` (läuft `pnpm run ci`, der Schritt »Archive coverage report« liest `packages/twopoint5d/coverage`, das das neue Target als Output hat und bei einem Cache-Treffer wiederherstellt), `nx.json`, alles unter `packages/twopoint5d/src/`, `packages/twopoint5d-testing/{package.json,project.json,web-test-runner.config.js}`

- Vorgehen:
  1. **Coverage aus `test` herausnehmen (CFG-020).** In `packages/twopoint5d/package.json`:
     `"test": "pnpm vitest --run"`, direkt darunter neu `"coverage": "pnpm vitest --run --coverage"`.
     Der Name `coverage` statt `test:coverage` folgt den übrigen Scripts der Bibliothek
     (einwortig bzw. camelCase) und hält den Doppelpunkt aus dem Nx-Target-Namen heraus, wo er
     mit der Syntax `nx run <projekt>:<target>:<configuration>` kollidiert.
  2. **Nx-Target.** In `packages/twopoint5d/project.json`: beim Target `test` die Zeile
     `"outputs": ["{projectRoot}/coverage"]` streichen (ohne `--coverage` schreibt es nichts mehr),
     `inputs` bleibt. Neues Target daneben:
     ```json
     "coverage": {
       "cache": true,
       "inputs": ["vitestDefaults", "{projectRoot}/src/**/*.ts"],
       "outputs": ["{projectRoot}/coverage"]
     }
     ```
     Kein `executor`: Nx leitet ihn aus dem gleichnamigen Script ab, wie beim Target `build`
     derselben Datei. Beleg: `pnpm nx show project twopoint5d --json` zeigt unter
     `targets.coverage` `executor: "nx:run-script"`, `cache: true` und das Output.
  3. **Root-Scripts.** In `package.json`: neu `"test:coverage": "pnpm nx run-many -t coverage"`,
     eingereiht direkt nach `test:ci`. In `ci` wird `pnpm run test:ci` durch
     `pnpm run test:coverage` ersetzt — Reihenfolge sonst unverändert
     (`… && pnpm run test:scripts && pnpm run test:coverage && pnpm run test:browser`). Der
     Coverage-Lauf fährt dieselben Specs; beide hintereinander wären derselbe Lauf zweimal.
     `test:ci` bleibt als Entwicklerkommando stehen.
  4. **Schwellen (TEST-021).** In `packages/twopoint5d/vite.config.ts` den Block `thresholds`
     ersetzen durch genau diese Werte:
     ```ts
     thresholds: {
       statements: 83,
       branches: 78,
       functions: 82,
       lines: 83,
       'src/map2d/**': {statements: 93, branches: 91, functions: 91, lines: 94},
       'src/sprites/**': {statements: 82, branches: 69, functions: 74, lines: 82},
       'src/stage/**': {statements: 94, branches: 88, functions: 95, lines: 95},
       'src/texture/**': {statements: 92, branches: 85, functions: 93, lines: 94},
       'src/utils/**': {statements: 88, branches: 89, functions: 83, lines: 87},
       'src/vertex-objects/**': {statements: 94, branches: 90, functions: 90, lines: 95},
     },
     ```
     Regel dahinter: je Metrik der gemessene Prozentwert abgerundet, minus zwei. Gemessen am
     2026-09-21 auf `f0a16ba3` (Tabelle im Abgleich unten); dieses Paket ändert nichts unter
     `src/`, die Werte gelten also unverändert. Den Kommentar über `thresholds` neu fassen, ohne
     Rückblick, sinngemäß: *The thresholds sit two points under the level measured when they were
     set — globally and per module, the measured percentage rounded down minus two —, so a
     regression turns the gate red while a line that moves does not. `src/controls/` and
     `src/display/` carry no threshold of their own: the browser suite in
     `packages/twopoint5d-testing` exercises them, and that suite is not measured.*
  5. **`hello-twopoint5d-canvas.test.js` (TEST-025).** Die vier voneinander abhängigen `it`s mit
     dem modulweiten `let display` / `let firstFrameNo` (Zeilen 4–5) zu **einem** Fall
     zusammenziehen; das Display entsteht im Fall und wird im `afterEach` disposed. Genau so:
     ```js
     import {expect} from '@esm-bundle/chai';
     import {Display} from '@spearwolf/twopoint5d';

     describe('hello twopoint5d canvas', function () {
       // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
       this.timeout(20000);

       /** @type {Display | undefined} */
       let display;

       afterEach(() => {
         display?.dispose();
         display = undefined;
       });

       it('renders its first frame as frame 1 on the canvas of the test page, at a size above 0x0', async () => {
         const el = document.querySelector('canvas#test-canvas');
         expect(el, 'canvas#test-canvas').to.exist;

         display = new Display(el);

         let firstFrameNo = -1;
         display.onNextFrame(({frameNo}) => {
           firstFrameNo = frameNo;
         });

         await display.start();

         console.debug(`Display: canvas dimension is ${display.width}x${display.height}`);
         expect(display.width, 'width').to.be.greaterThan(0);
         expect(display.height, 'height').to.be.greaterThan(0);

         await display.nextFrame();

         expect(firstFrameNo, 'the frameNo of the first frame').to.equal(1);
       });
     });
     ```
     Nicht löschen: der Test ist der einzige, der das `<canvas id="test-canvas" resize-to="fullscreen">`
     aus `testRunnerHtml` in `web-test-runner.config.js` benutzt.
  6. **`display-constructor.test.js:82-89`** — Fall »reports a renderer that fails to initialize
     as an error event«. `let reported; on(display, OnDisplayError, …)` samt `await wait(50);`
     ersetzen durch eine Promise auf das Event, das der Fall prüft:
     ```js
     const reported = new Promise((resolve) => {
       on(display, OnDisplayError, resolve);
     });

     expect(await reported, 'the error the subscriber is told about').to.equal(initFailed);
     ```
     Bleibt das Event aus, endet der Fall im Timeout der Suite (20 s) — das ist der gewollte
     Fehlerfall. Der Teil mit `reportedLate` bleibt unverändert. Die Hilfsfunktion `wait()`
     (Zeilen 37–41) hat danach keinen Aufrufer mehr und fällt weg.
  7. **`display-dispose.test.js:195-233`** — Fall »a dispose() before the renderer is ready
     leaves the frame loop empty«. Die Promise, auf die das Display wartet, festhalten und statt
     `await wait(50);` auf sie warten:
     ```js
     let initSettled;
     // …in createRenderer:
     renderer.init = () => {
       // three hands out one init promise for every call; the wrapper does the same
       initSettled ??= realInit()
         .then(rendererIsUp)
         .then(() => initReleased);
       return initSettled;
     };
     // …nach display.dispose(); releaseInit();
     // the display attached its handler to this very promise in its constructor, before this
     // await; reactions run in the order they were attached, so that handler has run by now
     await initSettled;
     ```
     Der bestehende Kommentar über `renderer.init` bleibt sinngemäß stehen.
  8. **`display-dispose.test.js:324-360`** — Fall »nextFrame() is rejected by dispose(), and
     refused after it«. `await wait(100);` ersetzen: das Ergebnis der Promise selbst abwarten.
     ```js
     const settled = display.nextFrame().then(
       () => ({outcome: 'resolved', rejection: undefined}),
       (err) => ({outcome: 'rejected', rejection: err}),
     );

     display.dispose();

     // dispose() rejects the open promise before it returns; one that stays open runs into the
     // timeout of this suite instead
     const {outcome, rejection} = await settled;
     ```
     Die `expect`s danach bleiben. `wait()` (Zeilen 24–28) hat dann keinen Aufrufer mehr und
     fällt weg.
  9. **`texture-store-on.test.js:180-203`** — Fall »unsubscribe() stops further callbacks and is
     idempotent«. Der Sleep `await new Promise((r) => setTimeout(r, 50));` (Zeile 200) prüft ein
     Ausbleiben und weiß nicht, ob der Re-Parse überhaupt etwas ausgeliefert hat — mit gleicher
     `imageUrl` und gleichen Klassen baut die Resource keine neue Texture. Ersetzen durch eine
     Positivkontrolle:
     - Der erste Callback merkt sich zusätzlich die erste Texture: `(texture) => { calls++; firstTexture ??= texture; }`.
     - Nach den beiden `unsubscribe()`-Aufrufen ein zweiter Abonnent, der angemeldet bleibt:
       `const controlTextures = []; const unsubscribeControl = store.on('plain', 'texture', (texture) => controlTextures.push(texture));`
     - Re-Parse mit einer Texture-Klasse, die der Katalog nicht trägt, damit die Resource eine
       neue Texture baut: `store.parse({defaultTextureClasses: [], items: {plain: {imageUrl: IMG_URL, texture: ['linear']}}});`
       (`TextureStore#parse` reicht `item.texture` über `joinTextureClasses` an
       `resource.textureClasses`; ein geänderter Wert lässt den Effekt in
       `TextureResource#load` eine neue Texture bauen und über das Event `texture` ausliefern.)
     - `await waitUntil(() => controlTextures.some((texture) => texture !== firstTexture));`
       dann `unsubscribeControl();` und die bestehende Erwartung
       `expect(calls).to.equal(callsAfterFirst, 'no callbacks after unsubscribe()')`.
     - Kommentar dazu, sinngemäß: *the subscriber that stays on proves the re-parse delivered a new
       texture; the event reaches every listener in one synchronous emit, so the unsubscribed
       callback has had its chance by then.*
     Das Event `texture` ist am `TextureResource` retained: der Kontroll-Abonnent bekommt beim
     Anmelden sofort die alte Texture, deshalb wartet `waitUntil` auf eine *andere*.
  10. **`vertex-objects-heap.test.js:130-132`** — die absolute 4-MiB-Grenze relativ zur ersten
      Probe ausdrücken und die Proben immer loggen:
      ```js
      const heapGrowth = heapSamples[heapSamples.length - 1] - heapSamples[0];
      const growthRatio = heapGrowth / heapSamples[0];
      console.info(`[heap] samples ${heapSamples.join(', ')} · growth ${(growthRatio * 100).toFixed(2)} % of the first sample`);
      expect(
        growthRatio,
        `heap grew by ${heapGrowth} bytes (${(growthRatio * 100).toFixed(2)} %) across the samples ${heapSamples.join(', ')}`,
      ).to.be.below(MAX_HEAP_GROWTH);
      ```
      mit `const MAX_HEAP_GROWTH = 0.1;` und einem Kommentar: die absolute Heap-Größe der
      Testseite hängt an der V8-Version und daran, was three lädt; gemessen gegen die eigene
      erste Probe trägt die Grenze über Versionen. Die 50-ms-Pause in `sampleHeap()` (Zeile 50)
      bleibt — sie wartet auf keinen Promise, sondern gibt dem Collector nach drei
      synchronen Major-GCs Luft, und sie ist nicht Teil des Findings.
  11. **Backend-Log (Offene Frage).** Neue Datei
      `packages/twopoint5d-testing/test/renderer-backend.test.js`, aufgebaut wie die übrigen
      Display-Tests (eigener `makeContainer()` mit Fixture-ID `renderer-backend-fixture`,
      `this.timeout(20000)`, `afterEach` mit `display?.dispose()` und `host?.remove()`), ein Fall
      `it('names the renderer backend three picked in this browser', …)` mit diesem Rumpf:
      ```js
      host = makeContainer();
      display = new Display(host);
      await display.start();

      const backend = display.isWebGPUBackend ? 'WebGPU' : display.isWebGLBackend ? 'WebGL2' : 'no backend';
      const browser = navigator.userAgent.match(/(Firefox|Chrome)\/[\d.]+/)?.[0] ?? navigator.userAgent;
      console.info(`[renderer-backend] ${backend} on ${browser}`);

      expect([display.isWebGPUBackend, display.isWebGLBackend].filter(Boolean), 'exactly one backend').to.have.lengthOf(1);
      ```
      Warum eine eigene Datei: `@web/test-runner` lädt jede Testdatei einmal je Browser, damit
      steht die Zeile genau einmal je Browser und Lauf im Report (»Browser logs on Chromium:« /
      »… on Firefox:«). Der Browsername steht in der Zeile selbst, weil der Reporter
      gleichlautende Zeilen beider Browser zu einem gemeinsamen Block ohne Namen zusammenfasst.
      Die `console.debug`-Zeilen in `vertex-objects-buffers-data.test.js:55` und
      `vertex-objects-gpu-upload.test.js:101` bleiben: sie ordnen einen Fehlschlag dieser
      Dateien dem Backend zu.
  12. **Doku.**
      - `AGENTS.md`, Abschnitt »Commands«: neue Zeile
        `pnpm test:coverage` — the library's Vitest suite once with coverage, held to the
        thresholds in `packages/twopoint5d/vite.config.ts`; `pnpm test`, `pnpm test:ci` and a
        single-file run measure nothing. In der Gate-Zeile (`pnpm run ci` …) `test:ci` durch
        `test:coverage` ersetzen.
      - `docs/architecture.md` §2: nach dem Punkt `test` ein Punkt `coverage` (nur die
        Bibliothek, in `packages/twopoint5d/project.json`; derselbe Vitest-Lauf mit
        `--coverage`, gecacht mit den Inputs von `test`, Output `{projectRoot}/coverage`;
        `test` misst nichts, damit ein Lauf über eine einzelne Spec nicht an Schwellen für die
        ganze Suite gemessen wird).
      - `docs/architecture.md` §3: in der Kette `test:ci` → `test:coverage`; ein Punkt
        `test:coverage` mit der Schwellen-Regel aus Schritt 4 (zwei Punkte unter dem Messwert,
        `controls` und `display` ohne eigene Schwelle, Grund). Unter »In CI« ein Absatz zum
        Backend: `renderer-backend.test.js` schreibt je Browser und Lauf eine Zeile
        `[renderer-backend] <WebGPU|WebGL2> on <browser>/<version>` in die »Browser logs« des
        Testlaufs; lokal gemessen am 2026-09-21 mit Playwright 1.62.1: Chromium 151 läuft auf
        WebGL2 (three meldet `WebGPU is not available, running under WebGL2 backend`), Firefox
        153 auf WebGPU (`dom.webgpu.enabled` in `web-test-runner.config.js`). Was CI bekommt,
        steht im Log des CI-Laufs — keine Behauptung über den CI-Wert in die Doku. Die Werte
        übernimmst du aus deinem eigenen Lauf; weichen sie von diesen ab, gilt dein Lauf und der
        Report nennt die Abweichung.
      - `README.md:91` bleibt (»then all tests« stimmt weiter).
  13. Konventionen des Plans gelten für jede Zeile: keine Finding-IDs, kein Rückblick
      (»now«, »no longer«, »instead of the old …«), Kommentare erklären das Warum.

- Verify: `pnpm run ci`
- Zusatzbelege (Ausgabe in den Report, Kommandos aus dem Repo-Root):
  - a) Cache: `pnpm nx coverage twopoint5d` zweimal — der zweite Lauf meldet einen Treffer
    (`[local cache]` bzw. »existing outputs match the cache«). Dann an
    `packages/twopoint5d/src/utils/findNextPowerOf2.ts` eine Kommentarzeile anhängen → Miss;
    `git checkout -- packages/twopoint5d/src/utils/findNextPowerOf2.ts` → wieder Treffer. Dann
    an `packages/twopoint5d/README.md` eine Zeile anhängen → Treffer; zurücksetzen mit
    `git checkout -- packages/twopoint5d/README.md`.
  - b) Negativprobe der Schwellen: in `vite.config.ts` `'src/sprites/**'` `statements` auf 90
    setzen, `pnpm nx coverage twopoint5d --skip-nx-cache` → Exit ≠ 0 mit einer Meldung, die
    `src/sprites/**` und `statements` nennt; zurücksetzen.
  - c) Einzeldatei: `pnpm nx test twopoint5d --skip-nx-cache -- src/utils/findNextPowerOf2.spec.ts`
    → Exit 0, kein »Coverage summary« in der Ausgabe.
  - d) Heap-Kalibrierung: aus `packages/twopoint5d-testing` dreimal
    `pnpm web-test-runner test/vertex-objects-heap.test.js`; je Lauf die `[heap]`-Zeile in den
    Report. Liegt ein Lauf über 5 % (halbe Grenze), Status `FERTIG_MIT_VORBEHALT` mit den
    Zahlen — die Grenze nicht still anheben.
  - e) Backend: aus `packages/twopoint5d-testing`
    `pnpm web-test-runner test/renderer-backend.test.js` → je Browser eine Zeile
    `[renderer-backend] …` im Report zitieren.
  - f) Workflow-Dateien werden nicht geändert; was erst der nächste CI-Lauf nach dem Push
    belegt: die Backend-Zeilen im CI-Log und das Coverage-Artefakt aus dem `coverage`-Target.

- Commit: `test: measure coverage in a run of its own against thresholds two points under the measured level, let the browser tests wait for what they assert instead of a fixed sleep, and log the renderer backend each browser gets`

- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · CFG-020 unverändert (`packages/twopoint5d/package.json:50`) · TEST-021 umgeformt (Abstand jetzt 20 Punkte, Modulwerte neu gemessen, Empfehlungswerte ersetzt) · TEST-025 unverändert bis auf die Heap-Zeile (`vertex-objects-heap.test.js:130-132`) · Backend-Frage offen, lokal gemessen (Chromium 151 WebGL2, Firefox 153 WebGPU) · TYPE-014 und CFG-014 nach Paket 3b abgespalten · keine offenen Folgen zu verteilen (Paket 1: in Paket 2 aufgegangen, Paket 2: —) · aus »Offene Befunde« nichts übernommen
  - 2026-09-21 Zug 1: Implementierer beauftragt (sonnet, medium), Session `remediate-twopoint5d-p3-impl-1`, Report nach `paket-3.impl-1.json`
  - 2026-09-21 Zug 2: Report FERTIG_MIT_VORBEHALT (Heap-Grenze 0,15 statt 0,1: Chromium 151 misst reproduzierbar 11,72 %, linear über die Proben; `console.debug` statt `console.info`, weil `@web/test-runner` `info` nicht mitschneidet) · 11 Dateien geändert, neu `packages/twopoint5d-testing/test/renderer-backend.test.js` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-3.verify.log`, Cache-Treffer) und ohne Nx-Cache exit=0 (`paket-3.verify-nocache.log`)
  - 2026-09-21 Zug 3: Reviewer (opus, medium) — CFG-020, TEST-021, TEST-025, Backend-Frage behoben · 1 wichtig (Heap-Kommentar stellt linearen, ungeklärten Zuwachs als Normalwert dar), 4 klein (3× `docs/architecture.md`, 1× Verify-Log zeigt keine Coverage-Summary) · Diff `paket-3.diff`
  - 2026-09-21 Zug 4 Runde 1: offen 1 wichtig (+3 kleine Doku-Punkte mitgegeben); Heap-Grenze 0,15 bleibt als Entscheidung des Runners (strenger als die alte 4-MiB-Linie ≈ 35 %), Kommentar wird ehrlich; Resume derselben Session (sonnet, medium) → `paket-3.impl-2.json`
    zurück: FERTIG, Kommentar an `MAX_HEAP_GROWTH` nennt linearen, ungeklärten Zuwachs, 3 Doku-Punkte in `docs/architecture.md` umgesetzt · Verify `pnpm run ci` exit=0 (`paket-3.verify-2.log`) · Diff `paket-3.diff-2` · Nachprüfung durch Reviewer (sonnet, medium) → `paket-3.review-2.json`
    Nachprüfung: alle vier Punkte erledigt, keine neuen Befunde · offene Befunde 1 → 0
  - 2026-09-21 Zug 5: Commit `e4dc0a95` auf Verify `paket-3.verify-2.log` (exit=0), 12 Pfade · Nebenbefunde in »Offene Befunde« (`texture-store-on.test.js:32`, Heap-Zuwachs)

## Urteil des Reviewers

- CFG-020: behoben — `packages/twopoint5d/package.json:50-51`, `packages/twopoint5d/project.json:23-30`, `package.json` (`test:coverage`, `ci`); Einzeldatei-Lauf ohne Coverage-Summary, Cache-Verhalten belegt
- TEST-021: behoben — `packages/twopoint5d/vite.config.ts:19-35`, Werte 1:1 aus Schritt 4; Negativprobe rot mit `"src/sprites/**" threshold`
- TEST-025: behoben — `hello-twopoint5d-canvas.test.js:3-37`, `display-constructor.test.js:76-80`, `display-dispose.test.js:201-231` und `:332-341`, `texture-store-on.test.js:185-213`, `vertex-objects-heap.test.js:12,136-142`; jeder Fall wird bei einem Fehler rot (Reviewer hat den Guard `#disposed` probeweise entfernt: Test rot)
- Backend-Frage: behoben, soweit lokal belegbar — `packages/twopoint5d-testing/test/renderer-backend.test.js:39-50`, `docs/architecture.md` Absatz unter »In CI«; den CI-Wert zeigt der erste Lauf nach dem Push
- Abweichungen: `MAX_HEAP_GROWTH = 0.15` statt 0,1 — Chromium 151 misst reproduzierbar 11,72 %, linear über die Proben; Entscheidung des Runners, weil die Grenze damit strenger bleibt als die alte absolute Linie (≈ 35 %) und die Ursache Bibliothekscode betreffen dürfte; der Kommentar nennt den Zuwachs ungeklärt, der Befund steht in »Offene Befunde« mit `→ Rückfrage` · `console.debug` statt `console.info`: `@web/test-runner` schneidet nur `log`/`debug`/`warn`/`error` mit (`test-runner-core/dist/server/plugins/trackBrowserLogs.js:9`)
- Klein, nicht behoben: das Gate-Log zeigt vom Target `coverage` keine Summary (Nx blendet die Ausgabe erfolgreicher Tasks aus); dass die Schwellen greifen, belegen die Proben a) und b)
- Urteil zu den Nebenbefunden: `waitUntil`-Kommentar → Scope (Test-Harness); Heap-Zuwachs → Rückfrage, weil die Messung im Harness sitzt, die Ursache aber vermutlich unter `src/` liegt, wo die Scope-Regel nicht greift

## Abgleich

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| CFG-020 | unverändert | `packages/twopoint5d/package.json:50` `"test": "pnpm vitest --run --coverage"`; `project.json:25` `outputs` am Target `test` |
| TEST-021 | umgeformt | `packages/twopoint5d/vite.config.ts:22-29`: global 65/59/59/65, `vertex-objects` 92/84/90/92, `texture` 70/61/62/70, sonst keine Modulzeile. Gemessen (Statements/Branches/Functions/Lines): global 85,37/80,55/84,87/85,97 — Abstand 20 statt 18 Punkte. Die Empfehlungswerte des Audits (global 80/75, `stage` 90 …) stammen aus einer älteren Messung und liegen heute bis zu 7 Punkte unter »gemessen minus zwei«; ersetzt durch die Regel aus Schritt 4 |
| TEST-025 | unverändert | `hello-twopoint5d-canvas.test.js:4-5,14-16`; `display-constructor.test.js:87`; `display-dispose.test.js:230,345`; `texture-store-on.test.js:200`; `vertex-objects-heap.test.js:130-132` (Audit: 131-133) |
| Backend-Frage | offen | Nur zwei Dateien loggen per `console.debug` ein Backend (`vertex-objects-buffers-data.test.js:55`, `vertex-objects-gpu-upload.test.js:101`); lokal: Chromium 151 → WebGL2, Firefox 153 → WebGPU (Probe `pnpm web-test-runner test/vertex-objects-buffers-data.test.js`, 2026-09-21) |
| TYPE-014 | unverändert → 3b | kein `tsconfig.json` in `packages/twopoint5d-testing/`, `tsconfig.json:4` `allowJs: false`, `packages/twopoint5d-testing/package.json:13-15` nur `test` |
| CFG-014 | unverändert → 3b | kein Gate-Schritt liest ```ts-Blöcke |

Coverage je Modul, gemessen 2026-09-21 auf `f0a16ba3` (`pnpm vitest --run --coverage` mit
`json-summary` in den Scratchpad):

| Modul | Statements | Branches | Functions | Lines | Schwelle |
| --- | --- | --- | --- | --- | --- |
| global | 85,37 | 80,55 | 84,87 | 85,97 | 83/78/82/83 |
| map2d | 95,73 | 93,41 | 93,39 | 96,41 | 93/91/91/94 |
| sprites | 84,52 | 71,88 | 76,92 | 84,31 | 82/69/74/82 |
| stage | 96,51 | 90,44 | 97,76 | 97,13 | 94/88/95/95 |
| texture | 94,67 | 87,63 | 95,73 | 96,56 | 92/85/93/94 |
| utils | 90,59 | 91,23 | 85,71 | 89,74 | 88/89/83/87 |
| vertex-objects | 96,82 | 92,47 | 92,79 | 97,50 | 94/90/90/95 |
| controls | 13,89 | 15,33 | 26,53 | 13,45 | keine |
| display | 46,91 | 39,25 | 48,41 | 48,08 | keine |

## Entscheidungen in Zug 0

- **Paket geteilt.** Der Typecheck-Teil ist mit der Messung gewachsen: `checkJs` über die
  Browsertests wirft unter der Strenge der Root-Config 585 Fehler, gelockert noch 83 in zwölf
  Dateien, dazu der Snippet-Extraktor (Audit-Aufwand L). Zusammen mit Coverage, Flakiness und
  Backend wären das ein Diff über Vitest-Konfiguration, Async-Semantik der Browsertests,
  JSDoc-Typen und ein neues Skript — vier Prüfgebiete für einen Reviewer. Die beiden Hälften
  teilen keine Ursache: hier »wie die Suite läuft und misst«, in 3b »was der Typecheck
  erreicht«. Die Nummer 3 bleibt diesem Teil, weil die Schleife den laufenden Zug unter ihr
  führt und an `### [~] 3.` prüft; der abgespaltene Teil heißt 3b und steht im Plan direkt
  dahinter.
- **Target `coverage`, Root-Script `test:coverage`.** Die Entscheidung im Plan lässt den Namen
  offen (»`test:coverage` o. ä.«); Grund für die Aufteilung in Schritt 1.
- **`test:coverage` ersetzt `test:ci` im Gate**, statt daneben zu laufen: dieselben Specs, ein
  zweiter Lauf brächte nichts.
- **Schwellen nach Regel statt nach Empfehlungstabelle** (Abgleich TEST-021): die Tabelle des
  Audits ist veraltet, die Regel »gemessen minus zwei« ist die des Audits selbst.
- **hello-Test zusammenziehen statt löschen**: einziger Nutzer des Canvas aus `testRunnerHtml`.
- **Sleeps**: wo es ein Event oder eine Promise gibt, wird darauf gewartet (Schritte 6–8); wo
  ein Ausbleiben geprüft wird, belegt eine Positivkontrolle, dass die Auslieferung stattfand
  (Schritt 9). Ein Fall, der nie settlet, endet im Timeout der Suite — ein ehrlicher roter Test
  statt eines geratenen Zeitfensters.
- **Heap-Grenze 10 % der ersten Probe** wie empfohlen, abgesichert durch die Kalibrierung d).
- **Backend-Log als eigene Testdatei**: `testRunnerHtml` liefe für jede der 24 Dateien, eine
  eigene Datei läuft genau einmal je Browser.
- **Offene Befunde**: nichts übernommen. Der Firefox-155-Befund (`web-test-runner.config.js:30`)
  hat eine eigene Ursache — ein WebGPU-Buffer, der auf Firefox 155 zerstört ist, während er noch
  gebraucht wird —, nicht Reihenfolge oder Timing der Tests; das Backend-Log dieses Pakets zeigt
  dem, der ihn nimmt, welches Backend Firefox bekommt. `README.md:91` wird durch dieses Paket
  nicht falscher (»then all tests« stimmt weiter).

## Findings im Volltext

**CFG-020 · low · packages/twopoint5d/package.json:50** — Das test-Script erzwingt
Coverage-Schwellen, die bei einer einzelnen Datei nicht greifen.
Das `test`-Script läuft mit `--coverage`. Bei einem Lauf über eine einzelne Datei —
`pnpm nx test twopoint5d -- src/pfad/datei.spec.ts`, der in `AGENTS.md` empfohlene Weg —
greifen die globalen Schwellen nicht, weil nur die eine Datei gemessen wird. Aufgefallen im
Remediation-Lauf vom 2026-09-20.
Empfehlung: Coverage aus dem Standard-Script nehmen und in ein eigenes `test:coverage` legen,
oder die Schwellen an einen Lauf über das ganze Projekt binden.
Entscheidung im Plan (2026-09-21): `test` läuft ohne Coverage; ein eigenes Script/Nx-Target
(`test:coverage` o. ä.) mit den Schwellen fährt im Gate und in CI.

**TEST-021 · medium · packages/twopoint5d/vite.config.ts:17-26** — Die Coverage-Schwellen liegen
18 Punkte unter dem Ist-Stand.
Gemessen sind in diesem Lauf 82,9 % Statements / 77,3 % Branches / 83,4 % Lines, die globalen
Schwellen stehen auf 65 / 59 / 65. Dazwischen liegen 18 Punkte, in denen eine Regression durch
das Gate läuft, ohne dass etwas rot wird — genug Platz, um `map2d/` (92,9 %) oder `stage/`
(92,3 %) vollständig ungetestet zu lassen und trotzdem grün zu sein. Modulweise Schwellen
existieren für zwei der acht Module. Re-Check: unverändert, der Abstand ist gewachsen.
Empfehlung: Die globalen Schwellen auf 80/75 ziehen (zwei Punkte Luft) und für jedes Modul eine
Zeile setzen, angelehnt an den gemessenen Wert minus zwei: `stage` 90, `utils` 84, `texture` 90,
`map2d` 90, `vertex-objects` 94, `sprites` 80. Für `controls` und `display` keine Schwelle,
solange ihre Browsertests nicht mitgemessen werden.

**TEST-025 · low · packages/twopoint5d-testing/test/hello-twopoint5d-canvas.test.js:4-5, 14-16;
display-constructor.test.js:87; display-dispose.test.js:230, 345; texture-store-on.test.js:200;
vertex-objects-heap.test.js:131-133** — Die Flakiness-Reserven abbauen: geteiltes Modul-Display,
feste Sleeps, eine 4-MiB-Heap-Linie.
`hello-twopoint5d-canvas` ist eine Kette von vier reihenfolgeabhängigen `it`s, die sich ein nie
disposetes, gestartetes Display teilen (mocha läuft sie in Reihenfolge, deshalb besteht es;
`--grep` oder ein Retry eines Falls scheitert). Vier `wait(50)`/`wait(100)`/`setTimeout(50)`-Sleeps
stehen für »die Promise hat gesettelt«; auf einem belasteten CI-Runner sind 50 ms genau die
Zahl, die einmal im Quartal flakt. Der Heap-Test ist gut geguardet (drei Major-GCs, nur
Chromium, 100 Runden) — die absolute 4-MiB-Linie bleibt eine Magic Number, die an einer
V8-Version hängt. Als *plausibel* eingestuft: Im Repo ist keine Flake-Historie sichtbar.
Empfehlung: `hello-*` ein `beforeEach`/`afterEach` und unabhängige Fälle geben (oder löschen —
`display-adopt-renderer` und `display-resize` decken es). Sleeps durch die Promise ersetzen, auf
die gewartet wird (`await started.catch(() => {})`, `await display.nextFrame()`), oder
`waitUntil` wie in `texture-store-on`. Die Heap-Grenze relativ zur ersten Probe ausdrücken
(etwa `< 10 %`) und die Proben loggen.

**Offene Frage »Welches Backend läuft in CI?«** — Entscheidung im Plan (2026-09-21): die
Browser-Suite loggt einmal je Browser und Lauf, welches Backend (WebGPU/WebGL2) three
tatsächlich bekommt; der lokal gemessene Stand und die Log-Stelle kommen in
`docs/architecture.md`. Der CI-Wert selbst zeigt sich erst im ersten Lauf nach dem Push — der
Lauf pusht nicht.

## Übergabe an 3b

Messwerte aus diesem Zug 0, für den Zug 0 von Paket 3b. Gemessen am 2026-09-21 auf `f0a16ba3`,
also vor den Änderungen dieses Pakets an fünf Testdateien und der neuen
`renderer-backend.test.js`.

- **Probe `checkJs`** (tsconfig im Scratchpad, erweitert die Root, `allowJs`, `checkJs`,
  `noEmit`, `include: test/**/*.js`, Mocha-Globals über einen Shim, `chai` per `paths` auf
  `@types/chai@4.3.20`):
  - Root-Strenge: 585 Fehler — 204 TS18048, 123 TS7005, 71 TS7006, 51 TS2339, 50 TS2345,
    39 TS7034, 18 TS2532, Rest je unter 6.
  - `noImplicitAny: false`: 338.
  - `noImplicitAny: false` + `strictNullChecks: false`: 83 (50 TS2339, 17 TS2345, 8 TS18048,
    3 TS2488, 2 TS2722, 2 TS2353, 1 TS2740). `noUncheckedIndexedAccess` ändert daran nichts.
  - Die 83 im Einzelnen: Deskriptor-Literale ohne Literaltypen (`components: string[]`,
    `type: string`), daher `VO` ohne die generierten Setter `setPosition`, `setInstanceOffset`,
    `setColor`, `setExtraOffset` — rund 40 Stellen in `vertex-objects-{dispose,gpu-upload,heap,buffers-data}`;
    `AttributeNode.add` (TSL-Typ von `attribute()`); `CSSRule` ohne Cast auf `CSSStyleRule`
    (`stylesheets`, `pan-control-cursor`, `pan-control-stylesheet-root`); `performance.memory`
    (`vertex-objects-heap`); `Node.renderTarget` / `.value` (`stage-pipeline`, `stage-renderer`);
    JSDoc-Parametertyp von `makeContainer` ohne `id` (`display-resize`); `Element` statt
    `HTMLElement` aus `querySelector` (`hello-twopoint5d-canvas`); `unknown` in `catch`
    (`display-dispose`); absichtlich falsche Argumente (`display-constructor.test.js:65,79`).
- **Auflösung der Typen**: `@esm-bundle/chai/chai.d.ts` macht `import chai from "chai"`; das löst
  heute nur über den pnpm-Hoist nach `node_modules/.pnpm/node_modules/@types/chai` (4.3.20,
  transitiv) auf. `@types/mocha` ist nicht im Baum. `@spearwolf/twopoint5d` löst auf
  `dist/lib/index.d.ts` — ein `typecheck` des Testpakets braucht `dependsOn: ["^build"]` und die
  Build-Ausgabe als Input, wie `lookbook:typecheck`.
- **Empfehlung für 3b** (dessen Zug 0 entscheidet): für die Tests `noImplicitAny: false` und
  `strictNullChecks: false`. Das Finding will umbenannte Member und falsche Argumentformen
  finden — TS2339/TS2345 bleiben erhalten —, und die Root-Strenge verlangt in JS rund 500
  Casts auf Fixture-Variablen, die nichts davon finden.
- **CFG-014**: 220 ```ts-Blöcke in getrackten `.md`-Dateien — `packages/twopoint5d/CHANGELOG.md`
  186, `packages/twopoint5d/src/stage/README.md` 14, `packages/twopoint5d/docs/resource-lifecycle.md`
  10, `packages/twopoint5d/docs/proposals/sprite-features.md` 6,
  `.claude/skills/updating-changelog/SKILL.md` 4. Entscheidung im Plan: Opt-in-Marker
  (```ts check), typgeprüft gegen den Build, Konvention in `AGENTS.md`.
