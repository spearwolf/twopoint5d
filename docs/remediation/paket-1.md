# Paket 1 — Display-Abbau: Renderer erst nach Init und Drain freigeben

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ASYNC-004 (high), BUG-100 (medium)
- Ziel: `Display#dispose()` bleibt synchron und gibt den Renderer in jedem Zustand
  (Init läuft, Init gescheitert, Arbeit eingereicht) vollständig und ohne Unhandled
  Rejection frei — erst nach dem Init, dann nach dem Leerlaufen der GPU-Queue.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d-testing/test/display-dispose.test.js`
  - `packages/twopoint5d-testing/test/display-adopt-renderer.test.js`
  - `packages/twopoint5d-testing/test/support/stopAndDrain.js` (wird gelöscht)
  - die 14 weiteren Testdateien mit `stopAndDrain` (Liste in Schritt 5)
  - `packages/twopoint5d/docs/resource-lifecycle.md`,
    `packages/twopoint5d/src/stage/README.md`, `docs/architecture.md`,
    `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(display): release the renderer of a disposed display once its init is through and the GPU has run dry, let a failed init end without an unhandled rejection, and let the browser tests tear a display down with dispose() alone`
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · ASYNC-004 unverändert (`Display.ts:887`
    `this.renderer?.dispose()`, `:468` `this.#waitForRenderer = this.renderer!.init()`,
    `:527-539` then/catch-Kette; three 0.185.1 `Renderer.js:2535` und `:1923` wie im
    Audit) · BUG-100 unverändert (`Display.ts:887`, three `WebGPUBackend.js:2903-2905`
    `this.device.destroy()`, Umgehung in `test/support/stopAndDrain.js`, aufgerufen in
    15 Teardowns) · MEM-014 unverändert (`vertex-objects-heap.test.js:13-18`), in
    Paket 2 abgeteilt · keine Folgen offen (erstes Paket) · ein neuer Nebenbefund in
    »Offene Befunde« (Canvas-Wiederverwendung im WebGL-Backend, → Scope)
  - 2026-09-21 Zug 1: Implementierer beauftragt (opus, effort high), Session
    `remediate-twopoint5d-p1-impl-0`, Report nach `paket-1.impl-0.json`
  - 2026-09-21 Zug 2: Report FERTIG · geändert `Display.ts`, CHANGELOG, `resource-lifecycle.md`,
    `stage/README.md`, `docs/architecture.md`, 16 Testdateien · gelöscht
    `test/support/stopAndDrain.js` · roter Lauf T1/T2 beide Browser, T3 Firefox ·
    Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-1.verify.log`, Nx-Cache-Treffer),
    ungecacht wiederholt mit `NX_SKIP_NX_CACHE=true` exit=0 (`paket-1.verify-nocache.log`)
  - 2026-09-21 Zug 3: Reviewer (opus, effort high) · beide Findings behoben, 4 Befunde klein,
    abnahmefähig · Diff `paket-1.diff`, Report `paket-1.review-0.json`
  - 2026-09-21 Zug 4: keine Runde — nur kleine Befunde; Commit-Message in der Paketdatei nach
    Befund 4 auf »once its init is through« korrigiert
  - 2026-09-21 Zug 5: Commit 049ba431 auf main, Verify `paket-1.verify-nocache.log` exit=0

## Entscheidungen aus Zug 0

- **Paket geteilt.** MEM-014 (Heap-Zuwachs) ging als Paket 2 hinten an. Eigene
  Ursache: der Zuwachs entsteht in Runden mit einem lebenden Display, `dispose()` des
  Displays läuft darin nie. Die Untersuchung per Heap-Snapshot hat einen offenen
  Ausgang (Fix in der Bibliothek oder Kommentar über einen three-Cache); scheitert sie,
  soll sie den Fix von ASYNC-004 nicht mit in den Stash nehmen. Paket 2 hängt von
  Paket 1 ab, weil beide `vertex-objects-heap.test.js` anfassen.
- **Gescheitertes Init: `renderer.dispose()` wird nicht gerufen.** three baut die
  Ressourcen, die `dispose()` freigibt, erst am Ende eines erfolgreichen `init()`
  (`Renderer.js:810-826`); bei gescheitertem Init gibt es nichts, das der Display
  erreichen könnte. `renderer.dispose()` rief dort nur `setAnimationLoop(null)`, und
  das wartet erneut auf das verworfene `_initPromise` — ein Promise, das `dispose()`
  nicht zurückgibt und das deshalb niemand abfangen kann. Das deckt sich mit der
  Empfehlung des Audits (`() => {}` als Rejection-Zweig).
- **Container und Canvas verlassen das DOM weiter synchron** in `dispose()`, vor der
  Freigabe des Renderers. Grund: das TSDoc der Klasse und der Test »takes the container
  it built out of the host« versprechen es beim Rückkehren aus `dispose()`, und three
  braucht den Canvas für die Freigabe nicht im Dokument — `WebGLBackend.dispose()`
  (`WebGLBackend.js:2829-2838`) arbeitet am Kontextobjekt und an
  `renderer.domElement`, `WebGPUBackend.dispose()` gar nicht am Canvas.
- **`stopAndDrain` fliegt aus allen Teardowns, der Helfer wird gelöscht.** Die
  Bibliothek leert die Queue jetzt selbst. Mit dem Helfer im Teardown prüfte die
  Firefox-Suite nie den `dispose()`, den eine App aufruft; ohne ihn ist jeder Teardown
  auf Firefox 155/WebGPU ein Regressionstest für genau diesen Fehler.
- **Fehler in der späten Freigabe gehen an `console.error`.** Nach `off(this)` hört
  kein Listener mehr zu; ein verschluckter Fehler aus `renderer.dispose()` wäre
  unsichtbar. Muster wie die vorhandenen `console.warn` in `Display.ts` (mit
  `// eslint-disable-next-line no-console`).
- **Kein Migration-Guide-Eintrag.** Signatur und Rückgabetyp bleiben, kein Aufrufer muss
  etwas ändern (Entscheidung vom 2026-09-21 im Plan). Der CHANGELOG-Eintrag sagt, dass
  der Renderer nach der Rückkehr aus `dispose()` freigegeben wird.

## Vorgehen

Code, Kommentare, Testnamen und Doku auf Englisch. Die Konventionen im Kopf von
`./remediation-plan.md` gelten für jede Zeile: keine Finding-IDs, kein Satz über den
Vorzustand (»no longer«, »used to«, »now« als Gegensatz zu früher), auch nicht im
CHANGELOG. Kommentare erklären, *warum*.

### 1. Regressionstests zuerst, rot sehen

Drei neue Fälle in `packages/twopoint5d-testing/test/display-dispose.test.js`,
innerhalb des bestehenden `describe`, hinter dem Fall »a dispose() before the renderer
is ready leaves the frame loop empty«. Die Tests importieren die gebaute Bibliothek aus
`dist/`, also vor jedem Lauf bauen. Roter Lauf, eine Datei, beide Browser:

```bash
pnpm build:twopoint5d && (cd packages/twopoint5d-testing && pnpm exec web-test-runner test/display-dispose.test.js)
```

Erwartet vor dem Fix: T1 rot auf Chromium und Firefox (`renderer.dispose()` läuft
während des Init, die erste Assertion fällt), T2 rot auf beiden (eine entwischte
Rejection), T3 rot auf Firefox (Reihenfolge ist nur `['renderer.dispose()']`) und auf
Chromium übersprungen — lokal zeichnet Chromium über WebGL2, Firefox über WebGPU. Die
Ausgabe des roten Laufs gehört in den Report.

**T1 — `'releases the renderer once an init that dispose() landed in is through'`**

- `host = makeContainer(); display = new Display(host);` — ohne `createRenderer`, ein
  echtes Init.
- `const renderer = display.renderer;` und direkt danach
  `expect(renderer.hasInitialized(), 'the init is still running').to.equal(false)` —
  deterministisch, three initialisiert immer asynchron (`Renderer.js:775`).
- `renderer.dispose` durch einen Spy ersetzen, der `renderer.hasInitialized()` zum
  Zeitpunkt des Aufrufs festhält, das Original ruft und ein Promise `released` auflöst.
- `display.dispose(); await released;` — bleibt `released` offen, schlägt der
  Suite-Timeout zu, das ist der gewünschte rote Ausgang.
- `expect(initializedAtRelease, 'renderer.dispose() ran after the init').to.equal(true)`.
- Danach die Freigabe am Backend belegen; `renderer.backend` erst **nach**
  `await released` lesen, weil three im Init auf das WebGL-Backend zurückfallen kann
  und dann `backend` austauscht:
  - WebGPU (`backend.isWebGPUBackend`): `const info = await backend.device.lost;`
    `expect(info.reason).to.equal('destroyed')`.
  - WebGL2 (`backend.isWebGLBackend`): `expect(backend.gl.isContextLost()).to.equal(true)`
    — `WebGLBackend.dispose()` ruft `WEBGL_lose_context.loseContext()`.
- Typen: die Tests laufen durch `pnpm typecheck` (`checkJs`). Die three-Typings lassen
  `device` und `gl` am Backend weg; per JSDoc-Cast lösen, so wie `stopAndDrain.js` es
  heute für `device` tut, strukturell, ohne `GPUDevice`.

**T2 — `'lets no rejection escape when the init that dispose() landed in fails'`**

- `createRenderer: (params) => { const renderer = new WebGPURenderer({...params}); renderer.init = () => (initPromise ??= new Promise((_, reject) => { failInit = reject; })); return renderer; }`
  — three gibt für jeden `init()`-Aufruf dasselbe Promise heraus, und
  `renderer.dispose()` fragt über `setAnimationLoop(null)` erneut danach; der Wrapper
  muss das genauso tun, sonst beweist der Fall etwas anderes.
- Vor `display.dispose()` einen `unhandledrejection`-Listener an `window` hängen, der
  Ereignisse mit `event.reason === initFailure` zählt und für genau diese
  `event.preventDefault()` ruft, damit der rote Lauf nicht die Suite mitreißt.
- `display.dispose(); failInit(initFailure); await initPromise.catch(() => {});`, dann
  `await new Promise((resolve) => setTimeout(resolve, 100));` — der Browser meldet eine
  unbehandelte Rejection in einem eigenen Task nach den Microtasks, mit Kommentar dazu.
- Listener in `finally` wieder entfernen.
- `expect(escaped, 'rejections of the failed init that nobody handled').to.have.length(0)`.
- `initFailure` ist ein `new Error('the init of this renderer fails on purpose')`.

**T3 — `'releases the renderer only after the GPU has run the work submitted to it'`**

- `display = new Display(host); await display.start(); await display.nextFrame();`
- `if (!display.isWebGPUBackend) this.skip();` mit Kommentar: das WebGL2-Backend hat
  keine Queue, auf die zu warten wäre. `function ()`-Form, nicht Arrow, wegen `this`.
- Einmal echte Arbeit einreichen: `display.renderer.render(new Scene(), new PerspectiveCamera())`
  (`Scene`, `PerspectiveCamera` aus `three/webgpu`).
- `const {queue} = backend.device;` — `queue.onSubmittedWorkDone` durch einen Wrapper
  ersetzen, der `'queue asked'` in ein Array `steps` schreibt, das Original ruft und
  bei dessen Auflösung `'queue drained'` anhängt. three selbst ruft
  `onSubmittedWorkDone` nirgends (geprüft in three 0.185.1), fremde Einträge gibt es
  also nicht.
- `renderer.dispose` durch einen Spy ersetzen, der `'renderer.dispose()'` anhängt, das
  Original ruft und `released` auflöst.
- `display.dispose(); await released;`
- `expect(steps).to.deep.equal(['queue asked', 'queue drained', 'renderer.dispose()'])`.

### 2. Der Fix in `packages/twopoint5d/src/display/Display.ts`

`dispose()` bleibt `dispose(): void`, synchron, idempotent über `#disposed`. Neue
Reihenfolge:

```ts
dispose(): void {
  if (this.#disposed) return;
  this.#disposed = true;

  this.stop();
  this.frameLoop.stop(this);
  emit(this, OnDisplayDispose, this);   // Kommentar darüber bleibt wie er ist
  off(this);

  const renderer = this.renderer;
  delete this.renderer;
  if (renderer != null) this.#releaseRenderer(renderer);

  // neuer Kommentar: Container samt Canvas verlassen das Dokument sofort; der Renderer
  // hält seinen Canvas selbst und braucht ihn für die Freigabe nicht im Dokument
  this.#ownContainer?.remove();
  this.#ownContainer = undefined;
}
```

`#releaseRenderer(renderer: WebGPURenderer): void` — privat, gibt nichts zurück,
hängt an `this.#waitForRenderer`:

- Erfüllt: erst `await drainSubmittedWork(renderer)`, dann `renderer.dispose()`.
- Verworfen: nichts tun. Kommentar mit dem Grund: ein gescheitertes Init hat nichts
  gebaut, das `renderer.dispose()` freigäbe, und dessen `setAnimationLoop(null)` würde
  erneut auf das verworfene Init warten — eine Rejection, die niemand abfangen kann.
- Die ganze Kette endet mit `.catch((error: unknown) => { console.error(...) })`,
  Meldung benennt `Display#dispose()` und dass die Freigabe des Renderers danach
  gescheitert ist, der Fehler als zweites Argument. Das Promise selbst wird verworfen
  (`void` davor, falls Lint `no-floating-promises` verlangt).
- Kommentar an der Kette, warum sie wartet: `dispose()` kann mitten im Init fallen
  (Mount/Unmount unter React StrictMode); three gibt einen nicht fertig
  initialisierten Renderer nicht frei, das Init liefe zu Ende und hielte Device,
  Kontext und die Animationsschleife von three für immer.

Modulfunktion `async function drainSubmittedWork(renderer: WebGPURenderer): Promise<void>`
neben `disposedError()`, nicht exportiert:

- `device` strukturell lesen, wie `isWebGPUBackend` es heute tut:
  `(renderer.backend as {device?: {queue: {onSubmittedWorkDone(): Promise<unknown>}} | null}).device`.
  Kein `device` (WebGL-Backend) → sofort zurück.
- `await device.queue.onSubmittedWorkDone()` in `try`/`catch`; der `catch` ist leer
  mit Kommentar: ein Device, das schon verloren ist, hat keine Arbeit mehr, auf die zu
  warten wäre — die Freigabe geht trotzdem weiter.
- Kommentar über der Funktion, warum es sie gibt: three zerstört in
  `renderer.dispose()` das Device (`WebGPUBackend.dispose()`); Firefox 155 unter WebGPU
  meldet dann bei noch laufender Arbeit einen `GPUInternalError` auf dem zerstörten
  Device, und die Seite bekommt danach keinen `requestAnimationFrame`-Callback mehr —
  jede Animation der Seite steht. Deshalb läuft die Queue vorher leer. Den Satz aus
  `stopAndDrain.js` darf der Kommentar übernehmen.

Nicht anfassen: die then/catch-Kette im Konstruktor (`:527-539`), `start()`,
`nextFrame()`, die Reihenfolge `stop()` → `frameLoop.stop()` → `emit` → `off`.

### 3. TSDoc in `Display.ts`

- Klassen-TSDoc, Punkt 3 der Lifecycle-Liste (`:69-72`): `dispose()` hält die Schleife
  an, feuert `OnDisplayDispose`, nimmt einen selbst gebauten Container aus dem DOM und
  gibt `renderer` sofort auf; den Renderer selbst gibt es frei, sobald dessen Init
  durch ist und die GPU die eingereichte Arbeit abgearbeitet hat — nach der Rückkehr
  aus `dispose()`.
- Konstruktor-TSDoc (`:376-378`): »{@link Display.dispose} calls `renderer.dispose()`
  on the way out« entsprechend: der Display gibt den übernommenen Renderer mit
  `renderer.dispose()` frei, sobald dessen Init durch ist und die Queue leer ist.
- `dispose()` bekommt ein eigenes TSDoc (hat heute keins): was synchron passiert, was
  danach; ein `dispose()` während des Init wartet das Init ab statt es abzubrechen; ein
  gescheitertes Init lässt nichts freizugeben, und keine Rejection entweicht; ein
  zweiter Aufruf tut nichts.

### 4. Bestehende Tests, die die Änderung umwirft

- `display-adopt-renderer.test.js`, Fall »releases the renderer it was handed«
  (`:53-70`): prüft `disposeCalls === 1` synchron nach `display.dispose()` und wird mit
  dem Fix rot. Der Spy löst ein Promise auf; der Fall wartet darauf und prüft dann
  `disposeCalls === 1`. Der Kommentar über `await display.start()` bleibt.
- `display-dispose.test.js`, Fall »a dispose() before the renderer is ready leaves the
  frame loop empty« (`:193-238`): der Kommentar bei `await rendererUp` (`:225-226`)
  begründet das Warten damit, dass `renderer.dispose()` sonst einen halb gebauten
  Renderer träfe — nach dem Fix falsch. `rendererIsUp`, `rendererUp`, das `.then(rendererIsUp)`
  im Wrapper und dieses `await` samt Kommentar entfallen; der Rest des Falls bleibt.
- `display-dispose.test.js`, Kopfkommentar zu Assertion (a) (`:48-53`): sagt, die
  GPU-Seite habe hier kein Subjekt und ein Spy auf `renderer.dispose()` beobachte nur
  three. T1 und T3 beobachten jetzt genau das und das Backend danach. Den Absatz so
  umschreiben, dass er auf T1 bis T3 zeigt: wann `renderer.dispose()` läuft und was
  das Backend danach meldet.

### 5. `stopAndDrain` aus allen Teardowns

`packages/twopoint5d-testing/test/support/stopAndDrain.js` löschen, danach das leere
Verzeichnis `support/`. In jeder dieser Dateien Import und Aufruf entfernen, der
Teardown ruft `dispose()` direkt:

`display-dispose.test.js:38`, `display-resize.test.js:32`,
`display-constructor.test.js:55`, `display-adopt-renderer.test.js:25`,
`map2d-visibility-helpers.test.js:38`, `map2d-tile-upload.test.js:40`,
`renderer-backend.test.js:33`, `map2d-placement.test.js:35`,
`sprites-rotation.test.js:27`, `stage-renderer.test.js:33`,
`hello-twopoint5d-canvas.test.js:13`, `vertex-objects-heap.test.js:35`,
`vertex-objects-gpu-upload.test.js:34`, `vertex-objects-buffers-data.test.js:26`,
`vertex-objects-dispose.test.js:29`, `stage-pipeline.test.js:29`.

- Wo danach kein `await` mehr übrig ist, fällt das `async` des Hooks bzw. der
  Hilfsfunktion weg; der `try`/`catch` um `dispose()` in Hilfsfunktionen bleibt.
- Kommentare in diesen Teardowns, die den Helfer oder den Drain erklären, gehen mit.
- In `vertex-objects-heap.test.js` nur Import und Aufruf in `disposeDisplay()` —
  `MAX_HEAP_GROWTH` und der Kommentar darüber gehören Paket 2.
- Bleibt die Firefox-Suite nach der Entfernung hängen (Timeouts, `GPUInternalError`
  im Log), während T3 grün ist: Status `BLOCKIERT` mit dem Log-Auszug. Den Helfer
  nicht zurückholen und keinen Drain pro Test einbauen — das verdeckte genau den
  Fehler, den dieses Paket behebt.

### 6. Doku mitziehen

- `packages/twopoint5d/docs/resource-lifecycle.md` §4 (`:152-173`): der Codeblock
  zitiert den Rumpf von `Display.dispose()`; durch den neuen Rumpf ersetzen, wörtlich
  wie in `Display.ts`, samt Kommentaren. Der Satz davor (Dispose-Event vor `off(this)`)
  bleibt gültig.
- `packages/twopoint5d/src/stage/README.md:474-475`: an den Punkt zu `Display.dispose()`
  anhängen, dass das Feld sofort weg ist und der Renderer freigegeben wird, sobald
  dessen Init durch ist und die GPU die eingereichte Arbeit abgearbeitet hat.
- `docs/architecture.md` §6 (`:264-272`): der Absatz über `stopAndDrain()` fällt. An
  seine Stelle ein Satz: ein Browser-Test baut einen Display im Teardown mit
  `dispose()` allein ab — `Display#dispose()` hält die Schleife sofort an und gibt den
  Renderer erst frei, wenn die GPU die eingereichte Arbeit abgearbeitet hat; das
  braucht Firefox 155 unter WebGPU, um für die folgenden Tests weiter Frames zu
  zeichnen. Umbruch bei 88 Spalten wie der Rest der Datei.
- `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` → `### Fixed`: Skill
  `updating-changelog` laden und befolgen. Ein Eintrag im Stil der Nachbarn
  (»fix `Display#dispose()` …: …«): der Renderer wird freigegeben, sobald sein Init
  durch ist und die GPU die eingereichte Arbeit abgearbeitet hat, so dass ein
  `dispose()` während des Init Device, Kontext und die Animationsschleife von three
  mitnimmt und ein gescheitertes Init ohne Unhandled Rejection endet; `dispose()`
  selbst bleibt synchron, der Renderer geht nach der Rückkehr. Den benachbarten
  Eintrag (`:230`, Display vor fertigem Renderer, Frame-Loop) nicht umschreiben. Kein
  Migration-Guide-Eintrag.

### 7. Verify

`pnpm run ci` vom Repo-Root, vollständig grün, beide Browser. Die Baseline ist grün;
alles Rote ist neu.

## Nebenbefund aus Zug 0 — Begründung des Urteils

In »Offene Befunde« steht: Canvas-Wiederverwendung im WebGL-Backend, `→ Scope`.

- Befund: `WebGLBackend.dispose()` ruft `WEBGL_lose_context.loseContext()` (three
  0.185.1 `WebGLBackend.js:2833-2834`), und `getContext('webgl2')` gibt für denselben
  Canvas immer dasselbe Kontextobjekt zurück, auch ein verlorenes. Ein Canvas, der
  einem `Display` übergeben wurde, trägt nach dessen `dispose()` im WebGL-Backend
  keinen zweiten Display mehr. Gelesen im Code, nicht im Browser gesehen.
- Vorbestehend: für ein `dispose()` nach fertigem Init gilt das an der Basis dieses
  Laufs (`Display.ts:887` ruft `renderer.dispose()` synchron). Für ein `dispose()`
  *während* des Init verdeckte das nie freigegebene Init den Fehler bisher — Paket 1
  dehnt ihn auf diesen Fall aus (Mount/Unmount/Mount unter React StrictMode auf
  demselben `<canvas>`). Deshalb `→ Scope` statt `→ Audit`: was dieser Lauf mit
  auslöst, schließt dieser Lauf.
- Nicht in Paket 1: andere Ursache (three verliert einen geteilten Kontext), nicht die
  Reihenfolge von Init und Freigabe. Die Drain-Runde entscheidet zwischen Doku-Regel
  (»ein übergebener Canvas trägt einen Display«) und Fix.
- Severity geschätzt medium: nur WebGL-Backend (Fallback ohne WebGPU) und nur bei
  wiederverwendetem Canvas; Chrome und Edge zeichnen über WebGPU.

## Findings im Volltext

**ASYNC-004 · high · packages/twopoint5d/src/display/Display.ts:887** (auch `:468`,
`:527-539`) — Den Renderer bei Display.dispose() während eines laufenden init() erst
nach dem Init freigeben

`Renderer.dispose()` räumt in three 0.185 nur bei `_initialized === true` auf und ruft
danach `setAnimationLoop(null)`, das bei `_initialized === false` erst
`await this.init()` macht. Ein Dispose vor Init-Ende, etwa bei Mount/Unmount unter
React StrictMode oder schnellen Routenwechseln, lässt das Init zu Ende laufen.
GPU-Device und Context werden dann nie freigegeben, und die Animation fordert für
immer rAF an. Scheitert das Init, wartet `setAnimationLoop(null)` auf das verworfene
`_initPromise`, und das endet als Unhandled Rejection. Der Browser-Test umgeht genau
diesen Fall.

Beleg: three `Renderer.js:2535` `if ( this._initialized === true ) {…}` · `:1923`
`if ( this._initialized === false ) await this.init();`

Empfehlung: Ist `#waitForRenderer` noch offen, `renderer.dispose()` an
`#waitForRenderer.then(() => r.dispose(), () => {})` hängen und die Kette abfangen.
Dazu ein Browser-Test, der während eines echten Init disposed.

**BUG-100 · medium · packages/twopoint5d/src/display/Display.ts:887** —
Display.dispose() zerstört das WebGPU-Device, während eingereichte Arbeit noch läuft

Aufgefallen im Remediation-Lauf vom 2026-09-21 (vorbestehend, `dispose()` ist an
`42a88429^` identisch). `dispose()` ruft `renderer.dispose()`, und three
(`WebGPUBackend.dispose()`) zerstört das Device, während eingereichte Arbeit noch
läuft. Auf Firefox 155 mit WebGPU meldet das zerstörte Device
`GPUInternalError: Buffer with '' label has been destroyed`, danach bekommt die ganze
Seite keinen `requestAnimationFrame`-Callback mehr — eine App, die ein Display abbaut,
verliert jede Animation der Seite. Ursache ist ein Firefox-Fehler, belegt nur headless
mit Software-Rendering (Playwright-Firefox); auf echter Hardware ungeprüft, trifft es
dort zu, ist die Severity auf *high* zu prüfen. Die Browser-Suite umgeht den Fehler im
Teardown (`stopAndDrain()`: `stop()` und `queue.onSubmittedWorkDone()` vor
`dispose()`), die Bibliothek selbst nicht.

Empfehlung: Das Verhalten auf echter Hardware mit Firefox 155+ prüfen. Hält es, das
Drain in die Bibliothek ziehen — etwa ein `Display#disposeAsync()` oder ein
`dispose()`, das `stop()` sofort ausführt und `renderer.dispose()` erst nach
`device.queue.onSubmittedWorkDone()` — und den Fehler bei Mozilla melden; der Helfer
`packages/twopoint5d-testing/test/support/stopAndDrain.js` zeigt die Reihenfolge.

Abweichung von der Empfehlung, durch die Entscheidung vom 2026-09-21 im Plan gedeckt:
kein `disposeAsync()`, sondern der synchrone `dispose()` mit Kette; die Prüfung auf
echter Hardware und der Bug-Report an Mozilla sind Aufgaben des Nutzers und nicht Teil
dieses Pakets.

## Urteil des Reviewers (Zug 3)

- **ASYNC-004 — behoben.** `packages/twopoint5d/src/display/Display.ts:929-950`
  (`#releaseRenderer`): `renderer.dispose()` hängt an `#waitForRenderer`, der
  Rejection-Zweig ruft nichts, die Kette endet in `console.error`. `FrameLoop.stop(this)`
  während des Init erreicht `setAnimationLoop` nicht (`FrameLoop.ts:242-253`, `:101-107`).
  Belegt durch T1 und T2 in `display-dispose.test.js`.
- **BUG-100 — behoben.** `Display.ts:55-66` (`drainSubmittedWork`) und `:936-938`: erst
  `device.queue.onSubmittedWorkDone()`, dann `renderer.dispose()`; ohne Device sofort
  weiter, ein Fehler im Drain hält die Freigabe nicht auf. Helfer gelöscht, alle 16
  Teardowns rufen nur `dispose()`. Reihenfolge belegt durch T3.

## Kleine Befunde (nicht behoben, keine Runde)

- `docs/architecture.md:265` — 89 Zeichen, über der 88-Spalten-Grenze.
- `docs/architecture.md:264` — »tears a display down in its teardown« doppelt sich;
  Vorschlag »A browser test tears its display down with `dispose()` alone:«.
- `packages/twopoint5d/src/display/Display.ts:395-396` — Konstruktor-TSDoc, zweiter
  Satzteil ohne Subjekt, liest sich, als gäbe `dispose()` selbst frei; Vorschlag »…as its
  own, and releases it with `renderer.dispose()` after {@link Display.dispose}, once its
  init is through and the GPU has run the work submitted to it.«
- `packages/twopoint5d/src/stage/README.md:474-477` — »releases its WebGPURenderer« ohne
  die Ausnahme des gescheiterten Init; Vorschlag Halbsatz »an init that fails leaves
  nothing to release«. (Der zweite Teil dieses Befunds, die Commit-Message, ist vor dem
  Commit korrigiert.)

## Nebenbefunde des Implementierers — Begründung der Urteile

- `resource-lifecycle.md:5-6`, `:55` falsche Abschnittsverweise → Scope: die Datei ist
  die verbindliche Dispose-Doku, die Scope-Regel nennt Dispose ausdrücklich.
- `Display.ts:270` (`frameNo`), `:194`/`:582` (Rückblick im TSDoc), `:457` (TODO am
  Renderer-Bau) → Audit: vorbestehend, betreffen Frame-Zählung, Resize-Drossel,
  `deltaTime`-Obergrenze und Renderer-Erzeugung, nicht den Abbau.
