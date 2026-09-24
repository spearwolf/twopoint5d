# Paket 5 — Die Freigabe eines WebGPU-Renderers lässt den rAF der Seite laufen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (kein Audit-Finding) · Hauptbefund: der Firefox-Stillstand nach
  `render()` und `dispose()` auf einem Canvas, der im Dokument bleibt (high,
  geschätzt — jede Animation der Seite steht), Volltext unten · dazu sechs
  Nebenbefunde aus der Queue, die »Entscheidungen« (Drain, 2026-09-24) diesem
  Paket zuweist
- Einordnung: **vorbestehend** — die Basis-Sonde gegen aa6dcc4e ist in Firefox
  155 rot (Abgleich). Keine `Folge von:`-Zeile, keine Generation; der
  Nutzer hat den Befund am 2026-09-24 in den Scope genommen, »so oder so«.
- Ziel: Nach `render()` und `dispose()` eines Displays mit `WebGPURenderer`
  läuft der `requestAnimationFrame` der Seite unter Firefox/WebGPU weiter — in
  allen drei Konstruktionspfaden (Host-Container, übergebener Canvas,
  übernommener Renderer) —, belegt durch Browser-Tests, die vor dem Fix rot
  sind; die dazugehörigen Kommentare und Testbegründungen nennen die
  tatsächliche Ursache, und die Test-Hygiene der Dispose- und
  Resize-Browser-Tests aus der Befund-Queue ist behoben.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d-testing/test/helpers/fixtures.js`
  - `packages/twopoint5d-testing/test/display-dispose.test.js`
  - `packages/twopoint5d-testing/test/display-adopt-renderer.test.js`
  - `packages/twopoint5d-testing/test/display-resize.test.js`
  - `packages/twopoint5d/src/stage/README.md` (ein Satz zu `Display.dispose()`)
  - `docs/architecture.md` (Repo-Root, ein Absatz zu den Browser-Tests)
  - `packages/twopoint5d/CHANGELOG.md` (nur der bestehende `[Unreleased]`-Eintrag in Zeile 255)
  - **nicht**: `packages/twopoint5d/docs/resource-lifecycle.md` — `dispose()`
    bleibt zeichengleich, das Zitat in §4 stimmt weiter, und §1 sagt nichts
    über den Zeitpunkt der Freigabe
- Verify: `pnpm run ci`
- Commit: `fix(display): release a WebGPU renderer only once the page has drawn two animation frames after its queue has run dry, or after two seconds while it draws none, so Firefox keeps the requestAnimationFrame of the page when a display whose canvas stays in the document is disposed right after a render, cover a host element, a canvas handed in and an adopted renderer with browser tests, and give the resize and dispose browser tests their cleanup in finally, one helper for the backend cast and the name of the resizeTo option`

## Der Weg in zwei Sätzen

`#releaseRenderer()` wartet nach `drainSubmittedWork()` unter dem
WebGPU-Backend auf zwei Animation Frames der Seite, in der der Canvas sitzt —
verschachtelt angefordert, begrenzt auf 2000 ms —, bevor `renderer.dispose()`
das Device zerstört; das gilt vor der Verzweigung nach `handBack` und damit für
alle drei Konstruktionspfade. `dispose()` selbst, die synchrone Rückgabe eines
übergebenen Canvas und der WebGL-Pfad bleiben, wie sie sind.

## Abgleich (Zug 0, 2026-09-24, gegen 78ee4952)

**Basis-Sonde gegen aa6dcc4e — der Stillstand bestand vor dem Lauf.** Eine
Kopie des Basis-Commits (`git archive aa6dcc4e`, Library mit
`tsc -p tsconfig.build.json` gebaut, dieselben `node_modules`, denn
`pnpm-lock.yaml` und die Test-Harness sind seit aa6dcc4e unverändert) lief mit
drei Sonden, je eine Datei und ein eigener `web-test-runner`-Aufruf: Display
bauen, `start()`, `nextFrame()`, `renderer.render(new Scene(), new
PerspectiveCamera())`, `dispose()`, auf `renderer.dispose()` warten, dann zwei
verschachtelte `requestAnimationFrame` gegen ein `setTimeout` von 1000 ms.
Die Library der Kopie war per Marke als Basis bestätigt (kein
`Stylesheets.getSheet`).

| Pfad | Chromium 153 (WebGL2) | Firefox 155 (WebGPU) |
| --- | --- | --- |
| Host-Container | frames | frames |
| übergebener Canvas | frames | **no frame**, `GPUInternalError: Buffer with '' label has been destroyed` |
| übernommener Renderer, Canvas im Dokument | frames | **no frame**, derselbe Fehler |

Logs im Arbeitsverzeichnis: `paket-5.basisprobe-host.log`,
`paket-5.basisprobe-canvas.log`, `paket-5.basisprobe-adopt.log`. Im Code:
`git show aa6dcc4e:packages/twopoint5d/src/display/Display.ts` — `dispose()`
fasst den übergebenen Canvas nicht an, `#releaseRenderer()` ruft nach
`drainSubmittedWork()` (damals unbegrenzt) `renderer.dispose()` bzw.
`disposeKeepingContextRestorable()`; der Canvas bleibt im Dokument. In 0.21.2
(62174770) rief `dispose()` `renderer.dispose()` sogar synchron. Die Folge,
als die Paket 3 den Befund gemeldet hat, war damit keine: Paket 2 hat ihn nicht
verursacht, er stand schon vor dem ersten Commit dieses Laufs.

**Fundstellen jetzt:**

- `Display.ts:1442-1461` — `released` in `#releaseRenderer()`: Erfolgszweig
  `await drainSubmittedWork(renderer)` (`:1445`), dann `!handBack` →
  `renderer.dispose()` (`:1446-1448`, trifft Host-Pfad und übernommenen
  Renderer), sonst `disposeKeepingContextRestorable()` (`:1450`, übergebener
  Canvas; unter WebGPU ruft sie sofort `renderer.dispose()`, `:166-167`).
  Zweig der gescheiterten Init (`:1454-1460`) zeichnet nie und bleibt.
- `Display.ts:58-105` — `SUBMITTED_WORK_TIMEOUT_MS` und `drainSubmittedWork()`;
  der Kommentar `:63-68` nennt Arbeit in der Queue als Auslöser des Stillstands.
- `Display.ts:1402-1404` — `dispose()` gibt den übergebenen Canvas synchron
  zurück. Die Sonde P5 aus Zug 2 (`renderer.dispose()` zwei Frames nach dem
  Drain, Rückgabe synchron wie jetzt) war grün: die Rückgabe bleibt, wo sie ist.
- TSDoc mit dem Freigabezeitpunkt: Klassen-TSDoc »Lifecycle« Punkt 3
  (`Display.ts:357-360`), Konstruktor (`:752-756`), `dispose()` (`:1367-1369`).
- Außerhalb von `Display.ts`: `docs/architecture.md:272-275`,
  `packages/twopoint5d/src/stage/README.md:475-478`,
  `display-adopt-renderer.test.js:73`, `CHANGELOG.md:255`.

**Nebenbefunde aus der Queue, je an der Fundstelle:**

- `Display.ts:63-68` (Kommentar über `drainSubmittedWork()`) — unverändert.
- `Display.ts:1445-1447` (`renderer.dispose()` im Zweig `!handBack` trifft
  einen übernommenen Renderer im Dokument) — unverändert; von der Basis-Sonde
  bestätigt (Zeile »übernommener Renderer«). Er ist der dritte
  Konstruktionspfad des Hauptbefunds und fällt mit ihm.
- `display-dispose.test.js:180-183` (Begründung für `getContext()` statt
  `render()`) — unverändert an derselben Stelle.
- `display-resize.test.js:100` und `:413` (`sizeRef`/`altRef` ohne `finally`)
  — verschoben nach `:101-111` (`uses resizeToElement option as the size
  source`) und `:446-462` (`runtime swap of resizeToElement is picked up on the
  next frame`), sonst unverändert.
- `display-resize.test.js:103` (Testtitel `resizeToCallback`) — verschoben nach
  `:114`, unverändert.
- `display-dispose.test.js:28` und ab `:248` (Backend-Cast doppelt) —
  verschoben nach `:24-30` (`expectLiveBackend()`) und `:370-375` (`releases
  the renderer once an init that dispose() landed in is through`), unverändert:
  zweimal derselbe Kommentar »read only now …« und derselbe JSDoc-Cast.

## Triage

- **Folgen der erledigten Pakete:** alle bereits verteilt. Die eine, die dieses
  Paket einst hervorgebracht hat (Paket 3, `Folgen:`, erster Punkt), ist jetzt
  als vorbestehend eingeordnet und im Plan dort vermerkt. Nichts Neues.
- **Offene Befunde:** die sechs Einträge mit `→ Paket 5` gehören hierher (siehe
  Abgleich); drei davon (`Display.ts:63-68`, `:1445-1447`,
  `display-dispose.test.js:180-183`) sind Teil des Hauptbefunds, drei
  (`display-resize.test.js` zweimal, `display-dispose.test.js` Cast) teilen nur
  die Dateien und sind vom Nutzer per Drain-Entscheidung hier eingeordnet. Die
  `→ Paket 6`-Einträge haben andere Ursachen und bleiben dort, auch
  `Display.ts:218` (Punkt 2 der Lifecycle-TSDoc, direkt über dem Punkt 3, den
  dieses Paket ändert) und `:376`/`:557-567`. Die `→ Audit`-Einträge bleiben.
- **Vorbestehend high, nicht aus dem Audit:** die Liste »Wo du anhältst« nennt
  genau diesen Fall; die Rückfrage ist beantwortet — die Entscheidung vom
  2026-09-24 nimmt den Stillstand in den Scope, »so oder so«. Kein neuer Halt.

## Grenze: was dieses Paket nicht tut

- Kein Umbau der Canvas-Rückgabe: `dispose()` bleibt zeichengleich,
  `restoreCanvasState()` und `#giveBackCallersCanvas()` bleiben unberührt.
- Kein Warten unter dem WebGL-Backend: `waitForTwoAnimationFrames()` kehrt ohne
  Device sofort zurück. Die WebGL-Freigabe mit wiederherstellbarem Kontext hat
  ihr eigenes Timing und ihre eigenen Tests.
- Kein Warten auf `visibilitychange` in einer verborgenen Seite: die Schranke
  von 2000 ms gilt, ohne Warnung.
- Bleiben 6b oder 7a in Firefox mit dem Warten rot: **keine** anderen Mittel
  probieren (mehr Frames, längere Schranke, `context.unconfigure()`,
  Sichtbarkeit), sondern `BLOCKIERT` mit beiden Läufen — dann trägt der
  freigegebene Weg nicht.
- Keine Verzögerung durch Last simulieren (keine Busy-Loops, kein
  CPU-Fresser): die Spec treibt Timer und Animation Frames von Hand, die
  Browser-Tests warten auf echte Frames.
- `paket-5.regressiontests.patch` im Arbeitsverzeichnis **nicht** anwenden: er
  prüft den verworfenen Weg. Was davon trägt, steht unten ausgeschrieben.

## Vorgehen

1. **Roter Lauf zuerst.** Die Tests aus Schritt 5 bis 8 schreiben (samt der
   Helfer in `fixtures.js`), noch ohne Schritt 2 bis 4, dann:
   - `pnpm nx test twopoint5d -- src/display/Display.spec.ts` — erwartet rot:
     5a und 5b; 5c ist ein Wächter und schon grün.
   - `pnpm build:twopoint5d`, dann 6b in `display-dispose.test.js` und 7a in
     `display-adopt-renderer.test.js` je **einzeln** mit vorübergehendem
     `it.only` laufen lassen:
     `pnpm --dir packages/twopoint5d-testing exec web-test-runner --files test/display-dispose.test.js`
     bzw. `--files test/display-adopt-renderer.test.js` (ohne `--browsers`:
     das verwürfe die `firefoxUserPrefs` aus `web-test-runner.config.js`).
     Erwartet: Firefox rot mit `'no frame'` und `GPUInternalError: Buffer with
     '' label has been destroyed` im Log, Chromium grün (WebGL2). Der Grund für
     `.only`: nach dem Stillstand bekommt die Seite keinen Frame mehr, und jeder
     spätere Fall derselben Datei läuft in den 120-s-Timeout.
   - Im Report: Firefox-Version, `display.isWebGPUBackend` in Firefox, beide
     roten Läufe. Danach **jedes** `.only` wieder entfernen.
2. **`Display.ts`, Modulebene**, direkt hinter `drainSubmittedWork()` (nach
   `:105`), vor `dropContextLostListener()`:
   - `const ANIMATION_FRAMES_TIMEOUT_MS = 2000;` mit Kommentar: eine Seite, die
     nach so langer Zeit keine zwei Frames gezeichnet hat, ist verborgen, und
     eine verborgene Seite präsentiert auch keinen Canvas; die Freigabe geht
     weiter. Dieselbe Zeit wie `SUBMITTED_WORK_TIMEOUT_MS`.
   - `async function waitForTwoAnimationFrames(renderer: WebGPURenderer): Promise<void>`:
     ```ts
     // the three.js typings leave the device off the backend, and the WebGL backend has none
     const device = (renderer.backend as {device?: object | null} | undefined)?.device;
     const view = renderer.domElement.ownerDocument?.defaultView;
     if (device == null || view == null) return;

     await new Promise<void>((resolve) => {
       let request = 0;
       const timer = setTimeout(() => {
         view.cancelAnimationFrame(request);
         resolve();
       }, ANIMATION_FRAMES_TIMEOUT_MS);
       request = view.requestAnimationFrame(() => {
         request = view.requestAnimationFrame(() => {
           clearTimeout(timer);
           resolve();
         });
       });
     });
     ```
     Der zweite Frame wird **im** Callback des ersten angefordert — zwei
     Anforderungen im selben Tick kämen im selben Frame. Das Fenster ist das des
     Dokuments, in dem der Canvas sitzt (wie bei `Stylesheets`), nicht das
     globale; das `?.` hinter `ownerDocument` fängt einen Canvas ohne Dokument
     (ein `OffscreenCanvas` hinter einem übernommenen Renderer) und den
     Canvas-Stub der Spec ab.
   - Kommentar über der Funktion, sinngemäß und ohne Rückblick: Unter Firefox
     155 mit WebGPU meldet `renderer.dispose()` auf einem Canvas, der noch im
     Dokument hängt, bevor die Seite präsentiert hat, was zuletzt in ihn
     gezeichnet wurde, einen `GPUInternalError` (`Buffer with '' label has
     been destroyed`), und die Seite bekommt danach keinen
     `requestAnimationFrame` mehr — jede Animation steht; ob die Queue leer ist,
     ändert daran nichts, ein Canvas außerhalb des Dokuments ist nicht
     betroffen. Ein übergebener Canvas und der Canvas eines übernommenen
     Renderers bleiben, wo der Aufrufer sie hingestellt hat; deshalb wartet die
     Freigabe auf zwei Animation Frames der Seite: die Callbacks des ersten
     laufen, bevor die Seite den Frame präsentiert, in dem der Canvas zuletzt
     gezeichnet wurde (HTML »update the rendering« ruft die Callbacks vor dem
     Zeichnen), die des zweiten danach. Unter WebGL und für einen Canvas ohne
     Fenster gibt es nichts abzuwarten.
3. **Kommentar über `drainSubmittedWork()` (`:63-68`)** neu, ohne die
   Firefox-Behauptung: `renderer.dispose()` zerstört das Device
   (`WebGPUBackend.dispose()`), und WebGPU erlaubt einer Implementierung, die
   Arbeit abzubrechen, die auf einem zerstörten Device noch aussteht
   (`GPUDevice.destroy()`). Deshalb läuft die Queue zuerst leer, oder das Device
   meldet sich verloren, dann gibt es keine Arbeit mehr; die Schranke
   `SUBMITTED_WORK_TIMEOUT_MS` und ihr Satz bleiben. Der Kommentar über
   `SUBMITTED_WORK_TIMEOUT_MS` (`:58-60`) bleibt.
4. **`#releaseRenderer()`**: im Erfolgszweig direkt nach
   `await drainSubmittedWork(renderer);` (`:1445`) die Zeile
   `await waitForTwoAnimationFrames(renderer);` — vor `if (!handBack)`, damit
   alle drei Pfade sie durchlaufen. Der Zweig der gescheiterten Init bleibt.
   Im Kommentar über `released` (`:1436-1441`) wird aus »So the release waits
   for the init, and then for the GPU.« sinngemäß »… waits for the init, then
   for the GPU, and under WebGPU for two animation frames of the page — see
   waitForTwoAnimationFrames().« `dispose()` bleibt zeichengleich.
5. **`Display.spec.ts`**, im `describe('release', …)` (`:435`):
   - Helfer im Block, neben `backendWith`:
     ```ts
     // the window of the page a canvas stub sits in, with animation frames driven by hand: frame()
     // runs the callbacks requested before it, as a browser runs those of one frame
     const pageWithFrames = () => {
       let requests = new Map<number, () => void>();
       let nextId = 1;
       const view = {
         requestAnimationFrame: vi.fn((callback: () => void) => {
           const id = nextId++;
           requests.set(id, callback);
           return id;
         }),
         cancelAnimationFrame: vi.fn((id: number) => {
           requests.delete(id);
         }),
       };
       const frame = () => {
         const due = requests;
         requests = new Map();
         for (const callback of due.values()) callback();
       };
       return {view, frame};
     };
     ```
     Der Canvas-Stub bekommt das Fenster nach `makeDisplay()`:
     `Object.assign(canvas, {ownerDocument: {defaultView: view}})`.
     `makeCanvas()` selbst bleibt ohne `ownerDocument`, damit die bestehenden
     Fälle unverändert laufen.
   - a) `releases a WebGPU renderer once the page has drawn two animation frames after the queue has run dry`
     — unter `vi.useFakeTimers()` (mit `try`/`finally` → `vi.useRealTimers()`
     wie die Nachbarn): `makeDisplay(undefined, undefined, backendWith(() => Promise.resolve()))`,
     Fenster anhängen, `display.dispose()`, `await vi.advanceTimersByTimeAsync(0)`
     → `renderer.dispose` nicht gerufen; `frame()`, `advanceTimersByTimeAsync(0)`
     → noch nicht gerufen (fängt zwei Anforderungen im selben Frame);
     `frame()`, `advanceTimersByTimeAsync(0)` → einmal gerufen;
     `vi.getTimerCount()` ist `0`.
   - b) `releases the renderer after a bounded wait when the page draws no frame, without a warning, and takes its frame request back`
     — Fake Timers, `console.warn` gespiet und stummgeschaltet, Queue löst
     sofort auf, Fenster angehängt, nie `frame()`: `dispose()`,
     `advanceTimersByTimeAsync(1999)` → nicht gerufen; `+1` → einmal gerufen;
     `view.cancelAnimationFrame` mit der Id der offenen Anforderung gerufen
     (`view.requestAnimationFrame.mock.results[0].value`); `warn` nicht
     gerufen; `vi.getTimerCount()` ist `0`.
   - c) `waits for no animation frame under the WebGL backend` — echte Timer,
     `makeDisplay()` ohne Backend, Fenster angehängt, `dispose()`,
     `await settle()` → `renderer.dispose` einmal gerufen,
     `view.requestAnimationFrame` nie.
6. **`display-dispose.test.js`:**
   - `whenReleased()` (`:7-16`) wandert nach `fixtures.js` (Schritt 8), der
     Import kommt dazu; `Scene` und `PerspectiveCamera` sind schon importiert.
   - a) Neuer Fall direkt hinter `releases the renderer only after the GPU has run the work submitted to it` (`:468-511`):
     `the page keeps its animation frames when a display built in a host element is disposed right after a render()`
     — `host = makeContainer()`, `display = new Display(host)`,
     `await display.start()`, `await display.nextFrame()`, ein Kommentar
     (»one piece of work outside the frame loop, right before dispose(): the
     page has not presented it yet«), `display.renderer.render(new Scene(), new PerspectiveCamera())`,
     `const released = whenReleased(display.renderer)`, `display.dispose()`,
     `await released`,
     `expect(await whenPageAnimates(), 'the animation frames of the page after the release').to.equal('frames')`.
     Kein `this.skip()` unter WebGL. Vor dem Fix grün (der Container geht
     synchron aus dem DOM) — er hält den Pfad fest.
   - b) Direkt dahinter
     `the page keeps its animation frames when a display on a canvas that was handed in is disposed right after a render()`
     — wie a), nur `const canvas = document.createElement('canvas')`,
     `host.appendChild(canvas)`, `display = new Display(canvas)`. Vor dem Fix in
     Firefox rot.
   - c) `leaves no data-engine on a canvas that was handed in once the release is through` (`:172`):
     `display.renderer.getContext()` wird
     `display.renderer.render(new Scene(), new PerspectiveCamera())`; vom
     Kommentar darüber bleibt nur, dass unter WebGPU der Getter des
     Backend-Kontexts `data-engine` schreibt und ein Render ihn liest — die
     Sätze zu `getContext()` und Firefox gehen.
   - d) Kopfkommentar, Absatz zu Assertion (a), GPU-Seite (`:65-70`): »the four
     cases after …« wird »the six cases after …«, und die Aufzählung, *wann*
     `renderer.dispose()` läuft, bekommt als letztes Glied: spät genug, dass
     die Seite ihre Animation Frames behält — für ein Display in einem
     Host-Element und eines auf einem übergebenen Canvas; der Fall des
     übernommenen Renderers steht in `display-adopt-renderer.test.js`. »The six
     cases after those follow a canvas that was handed in« bleibt (es sind
     weiter sechs).
   - e) Modulweiter Helfer über `expectLiveBackend()`:
     ```js
     /**
      * The backend of a renderer, read only now: three can fall back to the WebGL backend during
      * the init and swap the backend then. The three.js typings leave device and gl off the backend.
      *
      * @param {WebGPURenderer} renderer
      */
     function backendOf(renderer) {
       return /** @type {{isWebGPUBackend?: boolean, isWebGLBackend?: boolean, device?: {lost: Promise<{reason: string}>}, gl?: WebGL2RenderingContext}} */ (
         renderer.backend
       );
     }
     ```
     `expectLiveBackend()` (`:24-30`) und `releases the renderer once an init that dispose() landed in is through`
     (`:370-375`) holen ihr `backend` über `backendOf(…)`; beide
     Kommentar-plus-Cast-Blöcke fallen weg. Die Verzweigungen bleiben, wo sie
     sind — sie prüfen Verschiedenes (lebt / ist zerstört).
7. **`display-adopt-renderer.test.js`:**
   - a) Neuer Fall hinter `releases the renderer it was handed`:
     `the page keeps its animation frames when the display is disposed right after a render() while the canvas of the renderer stays in the document`
     — `display = new Display(renderer)`, `await display.start()`,
     `await display.nextFrame()`,
     `renderer.render(new Scene(), new PerspectiveCamera())`,
     `const released = whenReleased(renderer)`, `display.dispose()`,
     `await released`, `expect(await whenPageAnimates(), …).to.equal('frames')`.
     `Scene` und `PerspectiveCamera` aus `three/webgpu` importieren,
     `whenReleased` und `whenPageAnimates` aus `./helpers/fixtures.js`. Der
     Canvas hängt seit dem `beforeEach` im Dokument und bleibt dort bis zum
     `afterEach`. Vor dem Fix in Firefox rot.
   - b) Kommentar `:73`: »once the GPU has run dry« wird »once the GPU has run
     dry and the page has drawn two more frames«.
8. **`helpers/fixtures.js`**, unter »containers and displays« hinter
   `disposeDisplay()`:
   - `whenReleased(renderer)` aus `display-dispose.test.js`, mit seinem
     JSDoc-Satz und `@param {{dispose(): void}} renderer`.
   - `whenPageAnimates()`:
     ```js
     /**
      * Settles with `'frames'` once the page has drawn two animation frames, or with `'no frame'`
      * when they have not come within a second — a page whose requestAnimationFrame has stopped.
      *
      * @returns {Promise<'frames' | 'no frame'>}
      */
     export function whenPageAnimates() {
       return new Promise((resolve) => {
         const timer = setTimeout(() => resolve('no frame'), 1000);
         requestAnimationFrame(() => {
           requestAnimationFrame(() => {
             clearTimeout(timer);
             resolve('frames');
           });
         });
       });
     }
     ```
   Beide Dateien, die sie brauchen, importieren von hier (Regel in `AGENTS.md`).
9. **`display-resize.test.js`:**
   - `uses resizeToElement option as the size source` (`:99-112`): alles nach
     `const sizeRef = makeContainer(…)` in `try { … } finally { sizeRef.remove(); }`;
     die Zeile `sizeRef.parentNode.removeChild(sizeRef)` geht.
   - `runtime swap of resizeToElement is picked up on the next frame`
     (`:444-463`): ebenso mit `altRef`.
   - Titel `:114`: `'a resizeTo callback overrides element-based measurement'`.
10. **Doku des Freigabezeitpunkts**, überall derselbe Inhalt: der Renderer geht
    nach der Rückkehr von `dispose()`, sobald die Init durch ist und die GPU die
    eingereichte Arbeit erledigt hat — höchstens zwei Sekunden, danach mit
    Warnung — und unter WebGPU, sobald die Seite danach zwei weitere Animation
    Frames gezeichnet hat oder zwei weitere Sekunden ohne einen vergangen sind:
    - Klassen-TSDoc »Lifecycle« Punkt 3 (`Display.ts:357-360`); Punkt 2 nicht
      anfassen (eigener Queue-Eintrag für Paket 6).
    - Konstruktor-TSDoc (`:752-756`), der Satz zum übernommenen Renderer.
    - `dispose()`-TSDoc (`:1367-1369`), dazu ein Satz, warum: unter Firefox mit
      WebGPU hält die Seite sonst ihren `requestAnimationFrame` an, wenn der
      Canvas im Dokument bleibt — ein übergebener Canvas oder der eines
      übernommenen Renderers.
    - `packages/twopoint5d/src/stage/README.md:475-478`, der Satz »the renderer
      itself is released once its init is through and the GPU has run the work
      submitted to it«.
    - `docs/architecture.md:272-275`: `Display#dispose()` gibt den Renderer erst
      frei, wenn die GPU durch ist und unter WebGPU die Seite zwei weitere Frames
      gezeichnet hat, je höchstens zwei Sekunden; Firefox 155 unter WebGPU
      braucht die Frames, um für die folgenden Tests weiter zu zeichnen.
    - `CHANGELOG.md:255`, der unveröffentlichte Eintrag `fix Display#dispose()
      for a renderer that is still initializing or still has work on the GPU: …`:
      **in place** ergänzen, kein neuer Eintrag — er beschreibt denselben
      Freigabezeitpunkt, und `[Unreleased]` ist offen. Dazu: die zwei Frames
      unter WebGPU samt Schranke, und dass unter Firefox mit WebGPU die Seite
      ihren `requestAnimationFrame` behält, wenn der Canvas im Dokument bleibt
      (übergebener Canvas, übernommener Renderer). Skill `updating-changelog`
      laden. Kein Rückblick (»no longer«, »now«).
    - `docs/resource-lifecycle.md` bleibt unberührt (siehe Dateien).
11. Verify selbst laufen lassen (`pnpm run ci`), Ausgabe und Exit-Code in den
    Report, dazu die grünen Läufe von 6b und 7a in Firefox aus dem vollen Lauf.

## Findings im Volltext

Kein Audit-Finding. Der Hauptbefund, wie ihn Paket 3 gemeldet und Zug 2 von B
richtiggestellt hat:

**Hauptbefund · high (geschätzt) · `packages/twopoint5d/src/display/Display.ts:1442-1461`**
— Nach einem `render()` außerhalb der Frame-Loop und `dispose()` zerstört die
Freigabe (`renderer.dispose()`, direkt nach `drainSubmittedWork()`) das Device
eines WebGPU-Canvas, der noch im Dokument hängt. Unter Firefox 155 folgt
`GPUInternalError: Buffer with '' label has been destroyed`, und die Seite
bekommt keinen `requestAnimationFrame` mehr — auch bei leerer Queue, beim
übergebenen Canvas wie beim übernommenen Renderer; der Host-Pfad ist nur
verschont, weil sein Container synchron aus dem DOM geht. Vorbestehend seit
mindestens aa6dcc4e (Basis-Sonde), in 0.21.2 mit synchronem
`renderer.dispose()`.

**Nebenbefunde aus der Queue:**

- `Display.ts:63-68` · info — Kommentar über `drainSubmittedWork()` nennt
  »submitted work still in flight« als Auslöser des Firefox-Stillstands; die
  Sonden zeigen ihn auch bei leerer Queue. → Schritt 3.
- `Display.ts:1445-1447` · high (geschätzt) — `renderer.dispose()` im Zweig
  `!handBack` trifft auch einen übernommenen `WebGPURenderer`, dessen Canvas im
  Dokument bleibt. → Schritt 4, Test 7a.
- `display-dispose.test.js:180-183` · info — Begründung für `getContext()`
  statt `render()` nennt »work still in flight«. → Schritt 6c.
- `display-resize.test.js:100` und `:413` (jetzt `:101-111`, `:446-462`) · low
  — `sizeRef`/`altRef` gehen ohne `finally` aus dem DOM; wirft eine Assertion
  vorher, bleibt der Container hängen. → Schritt 9.
- `display-resize.test.js:103` (jetzt `:114`) · info — Testtitel nennt
  `resizeToCallback`, die Option heißt `resizeTo`. → Schritt 9.
- `display-dispose.test.js:28` und ab `:248` (jetzt `:24-30`, `:370-375`) ·
  info — Backend-Typannotation und WebGPU/WebGL-Unterscheidung doppelt
  (`expectLiveBackend` und Sonde). → Schritt 6e.

## Entscheidungen in Zug 0 (Begründungen)

- **Vorbestehend, nicht Folge.** Die Basis-Sonde ist in Firefox rot, in
  denselben zwei Pfaden wie an 78ee4952. `Folge von:` bleibt weg; der Eintrag
  unter Paket 3 ist im Plan umetikettiert.
- **Nur unter WebGPU warten.** Der Stillstand hängt am Zerstören eines
  `GPUDevice`; `drainSubmittedWork()` prüft schon auf das Device, der neue
  Schritt prüft dasselbe. Die WebGL-Freigabe mit wiederherstellbarem Kontext
  und ihre zeitkritischen Tests (`a WebGL context that does not come back …`)
  bleiben unberührt. Das Ziel nennt Firefox/WebGPU; der freigegebene Weg
  (»nach dem Drain«) ist an dieselbe Bedingung gebunden.
- **Vor der Verzweigung nach `handBack`, auch für den Host-Pfad.** Eine Stelle
  für alle drei Pfade, wie die Entscheidung es verlangt. Ein Test auf
  `canvas.isConnected`, der dem Host-Pfad zwei Frames sparte, fügte eine
  Verzweigung für eine Freigabe hinzu, auf die niemand wartet (der Host-Pfad
  trägt keinen Eintrag in `canvasReleases`); Sonde P4 zeigt, dass auch ein
  Host-Canvas wieder ins Dokument gelangen kann.
- **Zwei Frames, verschachtelt, keine Sonde für einen.** Die Callbacks eines
  Frames laufen vor dem Zeichnen dieses Frames (HTML »update the rendering«);
  ein `render()` außerhalb der Callbacks wird im nächsten Zeichnen präsentiert.
  Erst der Callback des zweiten Frames liegt sicher danach. Ein Frame reichte
  nur, wenn Firefox anders präsentierte als die Spezifikation es ordnet; der
  eine Frame Unterschied kostet rund 16 ms in einer Freigabe, auf die höchstens
  ein Nachfolger auf demselben Canvas wartet. Die Entscheidung vom 2026-09-24
  nennt zwei.
- **Schranke 2000 ms ohne Warnung.** Eine verborgene Seite zeichnet keine Frames;
  das ist gewöhnlich, keine Störung. Dieselbe Zeit wie die beiden anderen
  Schranken des Moduls. Restrisiko, nicht im Headless-Browser prüfbar: eine
  Seite, die länger verborgen bleibt, präsentiert den Canvas erst beim
  Wiedererscheinen — dann ist das Device schon zerstört.
- **Fenster des Canvas-Dokuments statt des globalen `requestAnimationFrame`.**
  Ein Canvas in einem iframe wird von dessen Seite präsentiert; `Stylesheets`
  wählt aus demselben Grund das Fenster des Dokuments. Nebenbei treffen die
  Fake Timers der Spec so kein globales `requestAnimationFrame`.
- **Rückgabe des übergebenen Canvas bleibt synchron.** Sonde P5 (zwei Frames,
  Rückgabe synchron) war grün; die Entscheidung erlaubt das Verschieben nur,
  wenn der Weg es verlangt, und er verlangt es nicht. So bleibt auch der Fall
  »Nachfolger im selben Tick« unberührt.
- **Helfer nach `fixtures.js`.** `whenReleased` und `whenPageAnimates` braucht
  jetzt eine zweite Datei (`display-adopt-renderer.test.js`); `AGENTS.md`
  verlangt dann das gemeinsame Modul. `backendOf` braucht nur
  `display-dispose.test.js` und bleibt dort.
- **CHANGELOG in place.** Zeile 255 beschreibt unter `[Unreleased]` genau den
  Freigabezeitpunkt, den dieses Paket verlängert; ein zweiter Eintrag daneben
  widerspräche ihr. Dass 0.21.2 den Stillstand schon hatte (synchrones
  `renderer.dispose()`), macht die Erwähnung des behaltenen
  `requestAnimationFrame` für Nutzer relevant.
- **Modell stärkste Stufe, Effort medium.** Asynchrone Freigabe mit Schranke und
  Abbruch, Firefox-Reproduktion mit hängender Testdatei, sechs Dateien Doku —
  im Zweifel die stärkere Stufe. Der Weg ist hier bis auf Signaturen und Werte
  entschieden; `high` erhöhte nur die Neigung, darüber hinaus zu bauen.

## Restplan

Paket 6 hängt weiter von 5 ab (beide ändern `Display.ts`); seine
`Display.ts`-Zeilen verschieben sich um die neue Modulfunktion, das gleicht
sein Zug 0 ab. Nichts weggefallen, keine Folge verteilt, keine Umsortierung.
Nach Paket 6 folgt der Abschluss mit der Drain-Runde über die `→ Audit`-Einträge.

## Verlauf

- 2026-09-24 Zug 0 (erster Schnitt): Detailplan steht · Folge unverändert, von
  `Display.ts:1386` nach `:1404` gewandert (Paket 4) · keine offenen Folgen zu
  verteilen · keine Nebenbefunde aufgenommen · Queue-Eintrag `Display.ts:344`
  als mit a33a6961 geschlossen abgehakt · Modell stärkste, Effort high
- 2026-09-24 Zug 1: Implementierer beauftragt (opus, Effort high), Report nach `paket-5.impl-1.json`
- 2026-09-24 Zug 2: Report `BLOCKIERT` (`paket-5.impl-1.json`, Session `32c0d45a-8fbb-453a-82f5-f5c626f003b4`) · keine Datei geändert, Arbeitsbaum sauber auf 78ee4952 · kein Verify (nichts zu prüfen) · Regressionstests als Patch gesichert: `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/a354229b-228b-496c-9c2e-82b9e47afc5f/scratchpad/paket-5.regressiontests.patch` (382 Zeilen, `git apply --check` gegen 78ee4952 ok) · Ursachenprobe widerlegt den Weg des Detailplans → Rückfrage, Status `question`
- 2026-09-24 Neuschnitt durch den Nutzer (»Entscheidungen«)
- 2026-09-24 Zug 0 (Neuschnitt): Detailplan neu, gegen 78ee4952 · Basis-Sonde
  gegen aa6dcc4e: Firefox 155/WebGPU rot für übergebenen Canvas und
  übernommenen Renderer, Host grün, Chromium/WebGL2 grün
  (`paket-5.basisprobe-{host,canvas,adopt}.log`) → vorbestehend, `Folge von:`
  entfällt · Hauptbefund unverändert an `Display.ts:1442-1461` · sechs
  Queue-Einträge aufgenommen, drei davon verschoben (`display-resize.test.js`
  `:101-111`/`:446-462`, `:114`; `display-dispose.test.js` `:24-30`/`:370-375`)
  · keine offenen Folgen zu verteilen · Eintrag unter Paket 3, `Folgen:`, als
  vorbestehend umetikettiert · Modell stärkste, Effort medium
- 2026-09-24 Zug 1 (Neuschnitt): Implementierer beauftragt (opus, Effort medium), Report nach `paket-5.impl-1-versuch-2.json` (Runde 1, zweiter Anlauf — der erste Report gehört zum verworfenen Schnitt)
- 2026-09-24 Zug 2: Report `FERTIG` (`paket-5.impl-1-versuch-2.json`, Session `c252913e-c25d-4c87-933a-34bc8516e94a`) · 9 Dateien geändert (Display.ts, Display.spec.ts, fixtures.js, display-dispose/-adopt-renderer/-resize.test.js, stage/README.md, docs/architecture.md, CHANGELOG.md), Arbeitsbaum schmutzig · rot vor dem Fix: Spec 2 failed/29 passed (5a, 5b), Browser 6b und 7a in Firefox 155 (WebGPU) `'no frame'` + `GPUInternalError` · eigener Verify `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 (`paket-5.verify.log`)
- 2026-09-24 Zug 3: Reviewer beauftragt (opus, Effort medium), Diff `paket-5.diff` (860 Zeilen), Report nach `paket-5.review-1.json`
- 2026-09-24 Zug 3: Urteil — alle sieben Befunde behoben, keine kritischen oder wichtigen Befunde, zwei kleine (Kommentare) · Diff `paket-5.diff`
- 2026-09-24 Zug 4: keine Runde nötig (nur kleine Befunde)
- 2026-09-24 Zug 5: committet als d38cc402 auf dem Verify aus Zug 2 (`paket-5.verify.log`, exit=0, seither keine Codeänderung)

## Urteil des Reviewers (`paket-5.review-1.json`)

- Hauptbefund (Firefox-Stillstand, alle drei Pfade) — behoben — `Display.ts:120-146` (`waitForTwoAnimationFrames()`) und `:1491` (Aufruf vor `if (!handBack)`); Tests `display-dispose.test.js:504`, `:520`, `display-adopt-renderer.test.js:80`, Spec `Display.spec.ts:525-601`
- `Display.ts:63-68` (Kommentar `drainSubmittedWork()`) — behoben — `Display.ts:63-67`, begründet mit `GPUDevice.destroy()`
- `Display.ts:1445-1447` (übernommener Renderer) — behoben — `Display.ts:1491`, Test `display-adopt-renderer.test.js:80-93`
- `display-dispose.test.js:180-183` (Begründung `getContext()`) — behoben — `display-dispose.test.js:178-179`, Test ruft `render()`
- `display-resize.test.js` `sizeRef`/`altRef` ohne `finally` — behoben — `display-resize.test.js:103-113`, `:450-466`
- `display-resize.test.js` Testtitel `resizeToCallback` — behoben — `display-resize.test.js:116`
- `display-dispose.test.js` doppelter Backend-Cast — behoben — `backendOf()` in `display-dispose.test.js:7-17`, benutzt in `:26` und `:366`

Kleine Befunde (offen, lösen keine Runde aus):

- `display-adopt-renderer.test.js:73-74` — Kommentar »once the GPU has run dry and the page has drawn two more frames« ohne »under WebGPU«; unter WebGL wartet keins von beiden.
- `Display.ts:110-119` — Kommentar über `waitForTwoAnimationFrames()` begründet das Warten nur mit übergebenem Canvas und übernommenem Renderer und sagt »a canvas outside the document is not affected«, die Funktion wartet aber auch im Host-Pfad; ein Halbsatz, dass auch der Canvas eines selbst gebauten Displays wieder in ein Dokument gelangen kann (Sonde P4), fehlt.

Nebenbefunde des Implementierers (in »Offene Befunde«, Urteil → Scope, weil `display-resize.test.js` ein Test der Display-Domäne ist): `display-resize.test.js:218-225` (`makeSizeRef()` nicht benutzt), `:85`/`:195`/`:488` (`off(…)` ohne `finally`).

## Vorgeschichte: der erste Schnitt

Der erste Detailplan (Zug 0, 2026-09-24) hielt die Folge für eine aus Paket 2:
die synchrone Rückgabe von `width`/`height` eines übergebenen Canvas während
laufender GPU-Arbeit. Sein Weg verschob diese beiden Attribute in die Freigabe,
zwischen `drainSubmittedWork()` und `renderer.dispose()`, mit einer Übernahme
der ausstehenden Größe durch einen Nachfolger auf demselben Canvas. Der
Implementierer hat den Stillstand reproduziert (Firefox 155.0, Playwright
`firefox-1543`, WebGPU aktiv; Chromium 153 mit WebGL2) und die Ursachenprobe
laufen lassen, je Test 6a isoliert in Firefox:

| Sonde | Firefox |
| --- | --- |
| `restoreCanvasState()` überspringt `width`/`height` | rot |
| `restoreCanvasState()` schreibt gar nichts zurück | rot |
| Host-Container statt übergebenem Canvas | grün |
| P1: übergebener Canvas, vor `dispose()` aus dem Dokument genommen | grün |
| P2: übergebener Canvas, kein `render()` vor `dispose()` | grün |
| P3: `backend.context.unconfigure()` direkt vor `renderer.dispose()` | rot |
| P4: Host-Pfad, eigener Canvas nach `dispose()` wieder ins Dokument gehängt | rot |
| P5: `renderer.dispose()` zwei Animation Frames nach dem Drain | grün |

Damit war der Weg widerlegt; Rückfrage in Zug 2 von B, Neuschnitt durch den
Nutzer am 2026-09-24. Der gesicherte Testpatch prüft den verworfenen Weg und
wird nicht angewendet; sein rAF-Helfer und die Umstellung auf `render()` sind
oben in Schritt 6 und 8 ausgeschrieben.
