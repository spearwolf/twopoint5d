# Paket 2 — Display & Frame-Loop: Resize per Observer, Delta-Entkopplung, Hot-Path

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-001 (medium), BUG-003 (medium), API-002 (low), CONS-002 (low), PERF-007 (low), ASYNC-001 (low), BUG-012 (low)
- Nebenbefund gleicher Ursache im Paket (zu CONS-002): `packages/twopoint5d/src/display/Display.ts:923` —
  `domElementOrRenderer instanceof HTMLElement` prüft gegen das `HTMLElement` des Realms, in dem der
  Code läuft; ein Canvas oder Host aus dem Dokument eines same-origin-iframes wird mit dem
  `TypeError` »expects a WebGPURenderer or an HTML element« abgewiesen (low). Vorbestehend
  (Stand des Audits). Ohne diesen Fix bliebe CONS-002 für die Wege »Canvas« und »Host« tot: das
  Szenario des Findings erreichte der Konstruktor dann nur über einen adoptierten Renderer.
- Ziel: `Display` misst seine Größe ereignisgetrieben im richtigen Realm, und die Frame-Loops liefern korrekte, allokationsarme Zeitdaten auch nach Pausen und bei niedriger Framerate.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/FrameLoop.ts`
  - `packages/twopoint5d/src/display/FixedFrameLoop.ts`
  - `packages/twopoint5d/src/display/Chronometer.ts`
  - `packages/twopoint5d/src/display/types.ts`
  - Specs: `src/display/Display.spec.ts`, `FrameLoop.spec.ts`, `FixedFrameLoop.spec.ts`, `Chronometer.spec.ts`
  - Browser: `packages/twopoint5d-testing/test/display-resize.test.js`,
    `display-constructor.test.js`, `stylesheets.test.js`, `helpers/fixtures.js`
  - `packages/twopoint5d/CHANGELOG.md`
  - mitziehen, was die Typprüfung dann meldet (u. a. Objekt-Literale vom Typ
    `DisplayEventProps`, z. B. `makeFrame()` in `FixedFrameLoop.spec.ts`)
- Verify: `pnpm run ci`
- Commit: Subject und Body (Body nachgetragen nach dem Review, Runde 1):
  - Subject: `fix(display)!: measure the size of a display when a ResizeObserver, a media query on the device pixel ratio or a resize of its window reports a change instead of in every frame, let a resize() of one's own always measure, take the document and the window of the canvas instead of the global ones and take a canvas or a host element from a same-origin iframe, hand the display event props the delta before maxDeltaTime cuts it and let FixedFrameLoop accumulate that delta, start the delta of a FrameLoop anew once it has lost its last subscriber, report a renderer that fails to run the animation loop of a FrameLoop, and keep the intermediate results of a measurement in fields`
  - Body: `BREAKING CHANGE: DisplayEventProps requires rawDeltaTime, the delta before Display.maxDeltaTime cuts it, so code that builds the props as a literal has to add it. FixedFrameLoop accumulates rawDeltaTime and runs more ticks per frame at a low frame rate, up to maxStepsPerFrame. A Display measures its size source only after a ResizeObserver, the media query on the device pixel ratio or a resize of its window reports a change, and in its first frame; a change reaches width and height in the frame after the report, and what no observer sees (padding, border or box-sizing of the canvas while another element is the source, a transform on the source) needs a resize() of one's own. Without a styleSheetRoot the rules go to the head of the document of the canvas.`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · alle sieben Findings unverändert an ihren Fundstellen
    (`src/display/` zuletzt geändert in `c983e745` vom 2026-09-24, Audit vom 2026-09-28; Zeilen
    der Findings im Code nachgesehen) · Nebenbefund gleicher Ursache ins Paket:
    `Display.ts:923` `instanceof HTMLElement` · Folgen aus Paket 1: keine · Queue: drei Einträge
    aus Paket 1 (`TileSet.ts:84/89`, `TileSet.ts:66–68`, `FrameBasedAnimations.ts:270/380`) ohne
    gemeinsame Ursache, bleiben liegen · Restplan unverändert (Paket 3 berührt weder
    `display/` noch `DisplayEventProps`)
  - 2026-09-29 Zug 1: Implementierer beauftragt · stärkste Stufe (`opus`), Effort high · Session `remediate-twopoint5d-p2-impl-0`, Report `paket-2.impl-0.json`
  - 2026-09-29 Zug 2: Report `FERTIG` · 14 Dateien geändert (5 Quellen und 4 Specs in `src/display/`, `display-resize.test.js`, `display-constructor.test.js`, `stylesheets.test.js`, `helpers/fixtures.js`, `CHANGELOG.md`), keine neuen · Arbeitsbaum schmutzig · rote Läufe für alle sieben Findings im Report · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`)
  - 2026-09-29 Zug 3: Reviewer beauftragt · stärkste Stufe (`opus`), Effort high · Diff `paket-2.diff`
  - 2026-09-29 Zug 3: Urteil — alle sieben Findings und der Nebenbefund behoben, 0 kritisch, 3 wichtig (Migration Guide ohne das eine Frame Verzögerung einer Observer-Meldung, `CHANGELOG.md:285/287` mit Rückblick, Commit-Message ohne `BREAKING CHANGE:`-Footer), 5 klein · Report `paket-2.review-0.json`
  - 2026-09-29 Zug 4 Runde 1: offen 3 wichtig + 5 klein · Commit-Message vom Runner in dieser Datei nachgetragen (Footer, iframe, »in fields«) · CHANGELOG-Befunde und die kleinen 4–8 per Resume an Session `50ba5e6c`, Report `paket-2.impl-1.json`
  - 2026-09-29 Zug 4 Runde 1 zurück: Report `FERTIG` · 1, 2, 4–8 behoben (u. a. `RESIZE_TO_WINDOW`, `NO_LOOP_ERROR`, Host-im-iframe-Test; roter Lauf für den Sentinel) · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`; erster Lauf in `paket-2.verify-0.log`) · Reviewer per Resume gezielt auf 1–8, Diff `paket-2.diff-1`, Report `paket-2.review-1.json`
  - 2026-09-29 Zug 4 Runde 1 Review: 1–8 erledigt, keine neuen Befunde, Commit-Message in Ordnung · Fortschritt: 3 wichtig + 5 klein → 0
  - 2026-09-29 Zug 5: committet `261bbd73` (14 Dateien, 1171+/174−) mit Trailer `Remediation-Run: 2026-09-29` · Verify `paket-2.verify.log` exit=0 · Plan auf `[x]`

## Entscheidungen, die für dieses Paket schon stehen

Aus »Entscheidungen« im Plan, bindend — nicht neu aufwerfen:

- **BUG-003:** `Display` reicht das ungekappte Frame-Delta zusätzlich in den Event-Props weiter;
  `FixedFrameLoop` akkumuliert dieses Roh-Delta und begrenzt nur über sein eigenes
  `maxStepsPerFrame`. Der Default `maxDeltaTime = 1/30` bleibt für `display.deltaTime`/`display.now`.
  JSDoc von `Display.maxDeltaTime` und `FixedFrameLoop` beschreiben das Verhalten bei dauerhaft
  niedriger Framerate.
- **PERF-001:** Größenmessung über `ResizeObserver` auf die aufgelöste Größenquelle (mit
  `devicePixelContentBoxSize`, wo verfügbar) plus `matchMedia` für `devicePixelRatio`-Wechsel; im
  Frame nur ein Dirty-Flag. Polling bleibt Fallback für `resizeToCallback`, Selektorwechsel und
  Umgebungen ohne `ResizeObserver`.
- **API-002:** Ein manueller `resize()`-Aufruf misst immer; der `resizePollIntervalMs`-Throttle gilt
  nur für den Aufruf aus dem Frame (privater Pfad), keine neue öffentliche Option.

## Was Zug 0 dazu entschieden hat, mit Grund

- **Ein Paket, kein Split.** Die Zeit-Findings (BUG-003, BUG-012, ASYNC-001) sind zusammen rund
  vierzig Zeilen mit exakten Vorgaben; ein eigenes Paket kostete einen vollen Kaltstart-Zyklus.
  `Display.ts` berühren beide Hälften (`getEventProps()` und das Resize-Modell).
- **Das Fenster als Größenquelle (`resize-to="window"`/`"fullscreen"`) wird über das
  `resize`-Event des Fensters beobachtet.** Ein `ResizeObserver` kann kein Fenster beobachten,
  `document.documentElement` folgt der Höhe des Viewports nicht, und `innerWidth`/`innerHeight`
  pro Frame zu lesen, kann ein Layout erzwingen. Das Event ist das ereignisgetriebene Gegenstück
  zum Observer für diese Quelle und läuft in denselben Dirty-Flag-Pfad; es ist kein anderer
  Lösungsweg als der freigegebene.
- **Der Observer ist nur Auslöser, die Messung bleibt die heutige** (`getBoundingClientRect()`
  minus Padding/Border der Quelle, danach Box-Sizing des Canvas, Clamp, `MaxResolution`,
  `setDrawingBufferSize()`). `contentRect` oder `devicePixelContentBoxSize` als Messwert zu nehmen,
  änderte die Größen-Pipeline (Transforms, Rundung auf Device-Pixel) — das gehört nicht in dieses
  Paket. `device-pixel-content-box` wird als beobachtete Box verwendet, damit der Observer auch bei
  Device-Pixel-Änderungen meldet.
- **Das erste gerenderte Frame misst immer.** Observer-Meldungen kommen im Rendering-Update erst
  *nach* den rAF-Callbacks; ohne diese Regel sähe das erste Frame eine Größenänderung zwischen
  Konstruktor und Start nicht (Browser-Test »does not double-emit OnDisplayResize on the first
  frame when the size differs from construction«).
- **Die Quelle wird weiter in jedem Frame aufgelöst** (Attribut `resize-to` lesen, gecachter
  Selektor mit `getRootNode()`/`matches()` wie heute, `resizeToElement` vergleichen). Das ist das
  Polling für Selektor- und Quellenwechsel aus der Entscheidung; es liest kein Layout.
- **Was kein Observer sieht, wird dokumentiert, nicht gepollt:** Padding, Border oder Box-Sizing des
  Canvas, solange ein anderes Element die Quelle ist, und ein CSS-Transform auf der Quelle. Beides
  erreicht den Canvas mit der nächsten Messung oder sofort mit einem eigenen `resize()`.
- **Name des Roh-Deltas: `rawDeltaTime`** — an `Chronometer` (Getter) und in `DisplayEventProps`
  (Pflichtfeld). Kein Getter an `Display`: die Entscheidung verlangt das Feld in den Props, und
  jede weitere öffentliche Oberfläche wäre ungefragt. Das neue Pflichtfeld bricht Code, der
  `DisplayEventProps` als Literal baut (Tests, ein `getEventProps()`-Override ohne Spread) — daher
  `!` im Commit und ein Eintrag im Migration Guide.
- **`FixedFrameLoop` fällt auf `deltaTime` zurück, wenn `rawDeltaTime` keine endliche Zahl ist.**
  `getEventProps()` ist laut JSDoc zum Überschreiben da; ein Override aus der Zeit vor diesem Feld
  lieferte sonst `undefined`, der Akkumulator würde `NaN`, und die Loop stünde still, ohne einen
  Fehler zu melden.
- **Event-Props werden weiter pro Event neu angelegt, bewusst** (Weg »die Allokation bleibt
  bewusst« aus der Empfehlung von PERF-007): `Display#getEventProps()`, das `OnFrame`-Objekt von
  `FrameLoop`, `OnTick` und `OnRender` von `FixedFrameLoop`. Listener dürfen die Props behalten
  (`nextFrame()` resolved mit ihnen); ein wiederverwendetes Objekt änderte sich unter ihnen, und ein
  Vertrag dafür wäre eine neue öffentliche Zusage. Jede dieser Stellen bekommt einen
  Warum-Kommentar. Ein `hot-path-allocations.spec.ts` für `display/` entsteht deshalb nicht: er
  mäße genau diese bewusst behaltenen Objekte.
- **ASYNC-001 meldet über `console.error`, nicht `console.warn`** (Abweichung von der Empfehlung):
  ein Init, der scheitert, ist ein Fehler, nach dem nichts gerendert wird, und das Projekt meldet
  Fehler ohne Aufrufer so (`Display.ts:1704`, »releasing the renderer failed after dispose()
  returned«). Dieselbe Fehlerinstanz wird pro Treiber nur einmal gemeldet: three antwortet nach
  einem gescheiterten Init jedem weiteren `setAnimationLoop()` — auch dem `null` aus `stop()` —
  mit demselben `_initPromise` (`three/src/renderers/common/Renderer.js:767–771`, `:1921–1923`).
  Das Interface `ISetAnimationLoop` behält `unknown` als Rückgabetyp: `unknown | Promise<unknown>`
  fällt in TypeScript auf `unknown` zusammen; ein Kommentar sagt, dass three ein Promise liefert.
- **Realm (CONS-002): was umgestellt wird und was nicht.** Umgestellt auf Dokument und Fenster
  des Canvas: `visibilitychange`/`hidden`, `devicePixelRatio`, `innerWidth`/`innerHeight`, der
  Default von `styleSheetRoot`, `createElement` für Container und Canvas, der
  `instanceof HTMLElement`-Test, und die neuen `ResizeObserver`/`matchMedia`/`resize`-Listener.
  **Nicht** umgestellt: `performance.now()` und der rAF-Treiber (der Zeitstempel von three und
  `requestAnimationFrame` stammen aus dem Realm des laufenden Codes; ein `performance` eines
  anderen Fensters hat einen anderen Zeitursprung), das globale `getComputedStyle()` (liest den
  Style eines Elements jedes same-origin-Dokuments korrekt) und `IntersectionObserver` (mit
  implizitem Root beobachtet er Ziele in verschachtelten Dokumenten korrekt). `Stylesheets`
  bleibt unberührt: `Display` übergibt seinen Root immer ausdrücklich.

## Vorgehen

Reihenfolge ist Empfehlung, nicht Pflicht. Alle Kommentare und Doku auf Englisch, im Ton der
Umgebung; keine Finding-IDs, kein Rückblick auf den Vorzustand (siehe »Konventionen« im Plan).

### Teil A — Zeit

1. **`FrameLoop#stop(target)` (`FrameLoop.ts:279–290`)** — im Zweig `subscriptionCount === 0`
   nach `this.raf.detach(this)`: `this.#lastNow = undefined;` und `this.#nextEmitAt = 0;`, mit
   Kommentar (das erste Frame nach dem Wiederanlauf misst sonst die ganze Pause, wie es der
   Treiber `RAF` für sein Fps-Fenster schon verhindert). `clear()` läuft über `stop()` und ist damit
   abgedeckt. `#frameNo` bleibt, es zählt alle ausgelieferten Frames. JSDoc des Getters `deltaTime`
   (`FrameLoop.ts:221–227`): `0` für das erste Frame und für das erste, nachdem die Loop ihren
   letzten Abonnenten verloren und wieder einen bekommen hat; `OnFrame` trägt dann `lastNow`
   gleich `now`.

2. **`RAF#start()` / `RAF#stop()` (`FrameLoop.ts:96–121`)** — das Ergebnis von
   `this.renderer.setAnimationLoop(…)` (beide Aufrufe) an eine private Methode
   `#handleLoopResult(result: unknown): void` geben: ist `result` nicht `null`/`undefined` und hat
   eine Funktion `then`, dann `(result as PromiseLike<unknown>).then(undefined, (error) => …)`.
   Im Handler: ist `error === this.#reportedLoopError`, nichts tun; sonst
   `this.#reportedLoopError = error` und
   `console.error('FrameLoop: the renderer could not run its animation loop', error)` (mit
   `// eslint-disable-next-line no-console` wie in `Display.ts`). Neues Feld
   `#reportedLoopError: unknown = undefined`. Kommentar an `ISetAnimationLoop` (`FrameLoop.ts:3–6`):
   three's `setAnimationLoop()` ist `async`, wartet auf `renderer.init()` und rejected mit dessen
   Fehler; der Rückgabetyp bleibt `unknown`, weil `unknown | Promise<unknown>` auf `unknown`
   zusammenfällt. `Display` ist nicht betroffen (es startet die Loop erst nach `#waitForRenderer`),
   also keine doppelte Meldung neben `OnDisplayError`.

3. **Roh-Delta (BUG-003):**
   - `Chronometer.ts`: Feld `#rawDeltaTime: number`, Getter `get rawDeltaTime(): number`.
     Semantik = `deltaTime` ohne den Schnitt von `maxDeltaTime`: im Konstruktor `0`; in `update()`
     im laufenden Zustand die lokale `deltaTime` vor dem Clamp (`Chronometer.ts:115–123`, in beiden
     Zweigen); im pausierten Zustand unverändert wie `#deltaTime`; in `start()` und `reset()` `0`.
     JSDoc: die Zeit zwischen vorheriger und aktueller Zeit wie `deltaTime`, Pausen abgezogen, aber
     bevor `maxDeltaTime` sie schneidet — gleich `deltaTime`, solange `maxDeltaTime` `0` ist oder
     nicht überschritten wird. JSDoc von `maxDeltaTime` (`Chronometer.ts:43–54`) verweist darauf.
   - `types.ts`, `DisplayEventProps`: neues Pflichtfeld `rawDeltaTime: number` direkt nach
     `deltaTime`. JSDoc für beide Felder: `deltaTime` = Sekunden seit dem vorigen Frame, Pausen des
     Displays nicht gezählt, höchstens `Display.maxDeltaTime`; `rawDeltaTime` = dasselbe, bevor
     `maxDeltaTime` es schneidet — die Wanduhrzeit zwischen den Frames ohne die Pausen des Displays;
     `FixedFrameLoop` läuft darauf.
   - `Display#getEventProps()` (`Display.ts:1757–1774`): `rawDeltaTime: this.#chronometer.rawDeltaTime`
     nach `deltaTime`.
   - `FixedFrameLoop[OnDisplayRenderFrame]` (`FixedFrameLoop.ts:213–216`):
     `const delta = Number.isFinite(props.rawDeltaTime) ? props.rawDeltaTime : props.deltaTime;`
     und `this.#accumulator += delta;`, mit Kommentar zum Fallback (Override von `getEventProps()`,
     das das Feld nicht kennt).
   - JSDoc `FixedFrameLoop` (Klasse, `FixedFrameLoop.ts:41–84`): die Loop akkumuliert
     `rawDeltaTime` jedes Render-Frames — die Wanduhrzeit zwischen den Frames, die Pausen des
     Displays nicht gezählt, bevor `Display.maxDeltaTime` sie schneidet. Unter der Sim-Rate laufen
     mehrere Ticks pro Frame, bis `maxStepsPerFrame`; braucht ein Frame mehr (unter `fps /
     maxStepsPerFrame` Render-fps, bei den Defaults 12), verwirft der Guard den Rest, und die
     Simulation fällt hinter die Wanduhr zurück. `tickTime` kann `display.now` vorauslaufen,
     solange `maxDeltaTime` Frames schneidet. Props ohne endliches `rawDeltaTime` → `deltaTime`.
     Der Satz »accumulating real wall-clock deltas« (`:43`) bleibt nur, wenn er danach stimmt.
   - JSDoc `Display.maxDeltaTime` (`Display.ts:1126–1135`) und der Kommentar am Feld
     `#chronometer` (`Display.ts:575–582`): bleibt die Framerate unter `1 / maxDeltaTime` (beim
     Default 30 fps), schneidet der Deckel jedes Frame, und `now` und `deltaTime` laufen langsamer
     als die Wanduhr — bei 20 fps mit zwei Dritteln, bei 15 fps mit der Hälfte. Die Event-Props
     tragen `rawDeltaTime`, das Delta vor dem Schnitt; `FixedFrameLoop` läuft darauf.

4. **Bewusst behaltene Event-Props (PERF-007)** — je ein Warum-Kommentar an
   `Display#getEventProps()` bzw. `#emit` (`Display.ts:1757–1780`), am `emit(this,
   FrameLoop.OnFrame, {…})` (`FrameLoop.ts:317–324`), an `emit(this, OnTick, {…})` und
   `emit(this, OnRender, {...props, …})` (`FixedFrameLoop.ts:220–243`): ein neues Objekt pro Event
   mit Absicht, weil ein Listener die Props behalten darf und ein wiederverwendetes Objekt sich
   unter ihm änderte. Sonst keine Änderung an diesen Stellen.

### Teil B — Realm, Größe, `resize()`

5. **Dokument und Fenster des Canvas (CONS-002)** in `Display.ts`:
   - Neue private Felder `readonly #doc: Document` und
     `readonly #view: Window & typeof globalThis`, gesetzt ganz vorn im Konstruktor (vor
     `this.#styleSheetRoot = …`, `Display.ts:909`): das `ownerDocument` des ersten Arguments — bei
     einem `WebGPURenderer` das seines `domElement`, sonst das des Elements —, mit
     `?? document`; das Fenster `doc.defaultView ?? window`. Lesen mit `?.`, damit ein falsches
     erstes Argument (`null`, eine Zahl) erst im `else`-Zweig mit dem bestehenden `TypeError`
     scheitert. Kommentar: das Dokument und Fenster, in dem der Canvas liegt — ein iframe hat eigene.
     Ein `createRenderer`, der den übergebenen Canvas ignoriert, ändert daran nichts (Randfall,
     nicht behandeln). Der Canvas-Stub in `Display.spec.ts` (`makeCanvas()`) hat kein
     `ownerDocument` und der `document`-Stub kein `defaultView`: über die beiden Fallbacks landen
     die bestehenden Specs genau auf den gestubbten Globals `document` und `window`, wie heute.
   - Default von `styleSheetRoot`: `styleSheetRoot ?? this.#doc.head`.
   - Modul-Funktion `isHTMLElement(value: unknown): value is HTMLElement` ersetzt
     `domElementOrRenderer instanceof HTMLElement` (`Display.ts:923`):
     `(typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) || (view != null && value instanceof view.HTMLElement)`
     mit `view = (value as Node | null | undefined)?.ownerDocument?.defaultView`. Kommentar: ein
     Element eines anderen Realms besteht `instanceof` gegen das `HTMLElement` dieses Realms nicht.
     (Der `typeof`-Guard, weil die Vitest-Specs unter Node ohne `HTMLElement` laufen.)
   - Host-Pfad (`Display.ts:932`, `:936`): `this.#doc.createElement('div')` und
     `this.#doc.createElement('canvas')`.
   - Sichtbarkeit (`Display.ts:1051–1061`): `this.#doc.hidden`, `this.#doc.addEventListener(…)`,
     Abbau über `this.#doc.removeEventListener(…)` im bestehenden `once(this, OnDisplayDispose, …)`.
   - `get devicePixelRatio()` (`Display.ts:1198–1200`): `this.#view.devicePixelRatio ?? 1`.
   - Fensterquelle in der Messung: `this.#view.innerWidth` / `this.#view.innerHeight`.
   - Bleibt global (siehe Entscheidung oben): `performance`, `renderFrame(now = window.performance.now())`,
     `requestAnimationFrame` im Treiber, `getComputedStyle`, `IntersectionObserver`.

6. **Größe beobachten statt pollen (PERF-001)** — neue private Glieder in `Display`:
   - Felder: `#sizeObserver?: ResizeObserver`, `#observedElement?: Element`,
     `#observedWindow = false`, `#pixelRatioQuery?: MediaQueryList`, `#sizeDirty = true`,
     `#pollingSize = false` (ob der letzte Frame-Aufruf gepollt hat).
   - `readonly #onSizeChange = (): void => { this.#sizeDirty = true; };`
   - `readonly #onPixelRatioChange = (): void => { this.#sizeDirty = true; this.#watchPixelRatio(); };`
   - `#startSizeWatch(): void` — im Konstruktor im `try` direkt vor dem ersten `this.resize()`
     (`Display.ts:1005`). Hat `this.#view` keine Funktion `ResizeObserver` oder keine Funktion
     `matchMedia`, nichts tun (dann pollt das Display). Sonst:
     `this.#sizeObserver = new this.#view.ResizeObserver(this.#onSizeChange);`,
     `this.#view.addEventListener('resize', this.#onSizeChange);`, `this.#watchPixelRatio();`.
   - `#watchPixelRatio(): void` — den `change`-Listener von der bisherigen
     `#pixelRatioQuery` nehmen, dann
     `this.#pixelRatioQuery = this.#view.matchMedia(`(resolution: ${this.devicePixelRatio}dppx)`)`
     und `addEventListener('change', this.#onPixelRatioChange)`. Kommentar: die Query auf das
     aktuelle Verhältnis hört auf zu passen, sobald es sich ändert; danach wird die auf das neue
     gestellt.
   - `#observeSizeSource(): void` — nach dem Auflösen der Quelle. Ziel ist
     `this.#sizeSourceIsWindow ? undefined : this.#sizeSourceElement`. Sind Ziel und Fensterflag
     dieselben wie `#observedElement`/`#observedWindow`, nichts tun. Sonst: mit Observer das alte
     Element `unobserve()`, das neue in einem `try` mit `observe(el, {box: 'device-pixel-content-box'})`
     beobachten, im `catch` mit `observe(el)` (Safari kennt die Box nicht und wirft einen
     `TypeError`); dann beide Felder setzen und `#sizeDirty = true` — auch ohne Observer, das
     Flag stört dort nicht.
   - `#stopSizeWatch(): void` — in `dispose()` direkt aufgerufen (nicht über
     `OnDisplayDispose`, damit ein Konstruktor, der nach `#startSizeWatch()` wirft, alles abbaut):
     `disconnect()`, `removeEventListener('resize', …)` am Fenster (nur, wenn `#startSizeWatch()`
     ihn gesetzt hat — erkennbar an `#sizeObserver`), `change`-Listener von `#pixelRatioQuery`,
     alle Felder leeren.

7. **`resize()` und der Frame-Pfad (API-002 + PERF-001):**
   - `resize(): void` (öffentlich) → `if (this.#disposed) return; this.#resize(false);`
   - `renderFrame()` (`Display.ts:1460`) ruft `this.#resize(true)` statt `this.resize()`.
   - `#resize(fromFrame: boolean): void`:
     1. `#didEmitResize = false`, `const canvas = this.canvas;`, `#applyImageRendering(canvas)` —
        wie heute bei jedem Aufruf.
     2. `#resolveSizeSource(canvas)` (siehe Schritt 8), `#applyFullscreenClass(canvas,
        this.#sizeSourceIsWindow)`, `#observeSizeSource()`.
     3. Nur bei `fromFrame` (ein eigenes `resize()` überspringt den ganzen Schritt und misst):
        - `const polls = this.resizeToCallback != null || this.#sizeObserver == null;`
          Weicht `polls` von `#pollingSize` ab: `#pollingSize = polls`, `#sizeDirty = true`
          (wer vom Pollen auf den Observer wechselt, misst einmal).
        - pollt es: der bestehende Throttle über `resizePollIntervalMs` und `#lastResizePollMs`
          (`Display.ts:1240–1246`), unverändert — nur hier, nirgends sonst.
        - pollt es nicht: `const zoom = this.pixelZoom > 0 ? this.pixelZoom : 0;` und
          `return`, wenn `!this.#isFirstFrame && !this.#sizeDirty && zoom === this.#appliedPixelZoom`
          — das erste Frame misst immer (`#isFirstFrame` setzt `renderFrame()` vor dem Aufruf).
     4. `#sizeDirty = false`, dann `#measureSizeSource(canvas)` und `#applyMeasuredSize(canvas)`.
   - Das erste Frame auf dem Poll-Pfad passiert den Throttle ohnehin: `#lastResizePollMs` steht
     bei `-Infinity`, weil ein eigenes `resize()` — auch das im Konstruktor — es nie anfasst.
   - `resizePollIntervalMs` bleibt öffentlich, Default `0`.

8. **Zwischenergebnisse ohne Heap (PERF-007, intern):**
   - `#resolveSizeSource(canvas): void` schreibt `#sizeSourceIsWindow: boolean` und
     `#sizeSourceElement: Element | undefined` statt ein Objekt zurückzugeben (`Display.ts:1264–1277`);
     die Auflösungslogik bleibt exakt die heutige. Der Kommentar »reads the DOM and writes nothing«
     wird entsprechend ehrlich.
   - `#measureSizeSource(canvas): void` schreibt `#measuredWidth`/`#measuredHeight` (Felder, `0`
     initial). Reihenfolge wie heute: `resizeToCallback` (Ergebnis nur bei zwei endlichen Zahlen,
     sonst Fallback); sonst ein Element: `rect = element.getBoundingClientRect()`, Style der Quelle,
     Breite/Höhe = `rect.width - getHorizontalInnerMargin(style)` bzw.
     `rect.height - getVerticalInnerMargin(style)`; sonst Fallback — Fenster:
     `this.#view.innerWidth`/`innerHeight`, sonst `300`/`150`. Kein Fallback-Tupel, kein
     `[w, h]`-Tupel, kein Aufruf von `getContentAreaSize()` mehr aus `Display` (die Funktion bleibt
     unverändert öffentlich in `styleUtils.ts`; nur der Import in `Display.ts` fällt weg).
   - Die live `CSSStyleDeclaration` wird gecacht: `#canvasStyle` (einmal
     `getComputedStyle(canvas)`, der Canvas eines Displays wechselt nie) und für die Quelle
     `#sourceStyle` mit `#sourceStyleOf: Element | undefined` (neu holen, wenn das Element wechselt).
     Ist die Quelle der Canvas, wird `#canvasStyle` für beides genommen. Kommentar: eine
     berechnete Style-Deklaration ist live und folgt dem Element.
   - `#applyMeasuredSize(canvas): void` liest `#measuredWidth`/`#measuredHeight`,
     `#sizeSourceElement` und `#canvasStyle`; die Rechnung bis zum Clamp bleibt Zeile für Zeile die
     heutige (`Display.ts:1327–1368`).
   - Der Hash (`Display.ts:1370–1373`, Feld `#lastResizeHash`) entfällt. Stattdessen sechs Felder
     `#appliedWidthPx`, `#appliedHeightPx`, `#appliedCssWidth`, `#appliedCssHeight`,
     `#appliedPixelRatio`, `#appliedPixelZoom`, alle `NaN` initial (Kommentar: vor der ersten
     Messung unterscheidet sich damit jeder Vergleich). Angewendet wird, wenn einer der sechs
     Werte `!==` abweicht; dann alle sechs schreiben. Als Zoom zählt der normalisierte
     `this.pixelZoom > 0 ? this.pixelZoom : 0` (ein `NaN` oder negativer Zoom wirkt wie `0` und
     löst so keine Messung pro Frame aus).

9. **Doku im Code** — alles, was das alte Modell beschreibt, stimmt danach nicht mehr:
   - Klassen-JSDoc `Display` (`Display.ts:410–552`): Lifecycle 1 (`visibilitychange` des
     Dokuments des Canvas; Observer, Media-Query und `resize`-Listener), 3 (`dispose()` baut sie
     ab), 4 (`pixelRatio` liest weiter das Fenster des Canvas); Abschnitt »Resize model« neu:
     gemessen wird, wenn ein `ResizeObserver` auf der Quelle (`device-pixel-content-box`, wo der
     Browser sie kennt), die Media-Query auf das Pixelverhältnis oder das `resize`-Event des
     Fensters eine Änderung meldet, sowie im ersten Frame, nach einer Änderung von `pixelZoom` und
     nach einem Wechsel der Quelle; das Attribut `resize-to` und `resizeToElement` werden jedes
     Frame gelesen, der Selektor wie beschrieben gehalten. Gepollt — gemessen in jedem Frame, mit
     `resizePollIntervalMs` gestreckt — wird mit `resizeToCallback` und dort, wo das Fenster des
     Canvas keinen `ResizeObserver` oder kein `matchMedia` hat. Was kein Observer sieht (Padding,
     Border, Box-Sizing des Canvas bei fremder Quelle; ein Transform auf der Quelle), erreicht den
     Canvas mit der nächsten Messung oder sofort mit einem eigenen `resize()`. Ein eigenes
     `resize()` misst immer und lässt den Takt der Frames in Ruhe. Die Pipeline ab der Größe der
     Quelle bleibt beschrieben wie heute. »There is no `window.resize` listener« und die
     Begründung »without registering DOM listeners« fallen weg; `window.innerWidth ×
     window.innerHeight` heißt das Fenster des Canvas.
   - `resizePollIntervalMs` (`:599–613`): gilt für die Frames, in denen das Display pollt; ein
     eigenes `resize()` misst trotzdem sofort und verschiebt den Takt nicht. Der Satz über den
     »hash-based no-op short-circuit« wird zum Vergleich der gemessenen Werte.
   - `width`/`height` (`:669–689`: »at the start of every frame« → nach einer gemeldeten
     Änderung), `resizeToElement` (`:717–735`), `resizeToCallback` (`:737–755`, bleibt im Kern
     richtig: mit Callback wird jedes Frame gemessen), `resizeToAttributeEl` (`:757–765`: das
     Attribut wird jedes Frame und bei jedem `resize()` gelesen), `resize()` (`:1202–1228`:
     misst bei jedem eigenen Aufruf, unabhängig von `resizePollIntervalMs`), `renderFrame()`
     (`:1440–1451`: prüft, ob gemessen werden muss). `styleImageRendering` (`:653–655`) bleibt
     richtig und bleibt stehen.
   - `types.ts`: `DisplayParameters.resizeTo` (bleibt im Kern), `resizeToElement` und
     `resizeToAttributeEl` (»with every measurement … every frame« → wie oben), `styleSheetRoot`
     (Default: der `head` des Dokuments des Canvas). `ResizeDisplayToFn` bleibt, wie er ist.
   - `packages/twopoint5d/docs/architecture.md` und `src/stage/README.md` beschreiben kein
     Polling — dort nichts zu tun.

### Tests

Regressionstest zuerst, rot sehen, dann beheben; die roten Läufe gehören in den Report. Wo ein
bestehender Test altes Verhalten festschreibt, wird er umgeschrieben, nicht gelöscht.

**`src/display/Display.spec.ts`** (Node, gestubbte Globals; ohne `ResizeObserver` im
`window`-Stub pollt das Display — die bestehenden Tests bleiben so auf dem Poll-Pfad):

- `makeCanvas()`: `getBoundingClientRect` als `vi.fn(…)`, damit Messungen zählbar sind (mit dem
  Cache ruft `getComputedStyle` nur noch einmal pro Element).
- Umschreiben: »resizePollIntervalMs skips the measurement of a resize() within the interval«
  (`:815`) → misst über Frames (`frame(t)` bzw. `renderFrame`), zählt
  `getBoundingClientRect`-Aufrufe; »applies styleImageRendering without a size change, also within
  resizePollIntervalMs« (`:873`) → das Intervall über ein Frame verbrauchen, nicht über `resize()`.
- API-002, rot vor dem Fix: Poll-Pfad, `resizePollIntervalMs = 1000`, ein Frame misst, die
  Quelle ändert ihre Größe, ein eigenes `resize()` im Intervall liefert sofort die neue Breite.
  Dazu: ein eigenes `resize()` verschiebt die nächste Messung der Frames nicht.
- Neuer Block »size watch« mit Stubs am `window`-Stub: eine `ResizeObserver`-Klasse (hält
  Callback, `observe`-Aufrufe samt Optionen, `unobserve`, `disconnect`), `matchMedia` (hält die
  Query-Strings, gibt je einen MQL-Stub mit `addEventListener`/`removeEventListener` zurück),
  `addEventListener`/`removeEventListener` für `resize`, `innerWidth`/`innerHeight`.
  - PERF-001, rot vor dem Fix: nach Start und erstem Frame messen drei Frames ohne Meldung nichts
    (`getBoundingClientRect` und `getComputedStyle` unberührt).
  - eine Observer-Meldung lässt das nächste Frame genau einmal messen, das übernächste nicht.
  - ein Wechsel des Pixelverhältnisses (`devicePixelRatio` am Stub ändern, `change` feuern) →
    das nächste Frame misst mit dem neuen Verhältnis (`setDrawingBufferSize` zuletzt mit ihm),
    `matchMedia` wurde mit `(resolution: 2dppx)` erneut gefragt, der Listener der alten Query ist ab.
  - unter `resize-to="window"` (Canvas-Stub antwortet `getAttribute('resize-to')` mit `'window'`)
    lässt ein `resize`-Event des Fensters das nächste Frame mit neuem `innerWidth`/`innerHeight`
    messen.
  - ein Tausch von `resizeToElement` → `unobserve` des alten, `observe` des neuen mit
    `{box: 'device-pixel-content-box'}`, das nächste Frame misst das neue.
  - wirft `observe` für diese Box, wird ohne Optionen beobachtet.
  - eine Änderung von `pixelZoom` lässt das nächste Frame messen.
  - mit `resizeTo`-Callback wird jedes Frame gefragt, auch mit Observer.
  - das erste Frame misst ohne Meldung.
  - `dispose()` trennt den Observer, nimmt den `change`-Listener und den `resize`-Listener ab.
- CONS-002, rot vor dem Fix: Renderer-Stub, dessen Canvas ein `ownerDocument` trägt (eigenes
  `hidden`, `head`, `addEventListener`/`removeEventListener`, `defaultView` mit
  `devicePixelRatio: 3`, `innerWidth`/`innerHeight`, `performance`): der
  `visibilitychange`-Listener sitzt an diesem Dokument und nicht am globalen, dessen `hidden`
  pausiert das Display; `display.devicePixelRatio` ist `3`; `resize-to="window"` misst
  `innerWidth`/`innerHeight` dieses Fensters; `styleSheetRoot` ist dessen `head`.
- BUG-003: Frames im Abstand von 50 ms → die Props von `OnDisplayRenderFrame` tragen `deltaTime`
  `1/30` und `rawDeltaTime` `0.05`. Regressionstest, rot vor dem Fix: ein `FixedFrameLoop` auf
  einem Display mit 20 fps hält mit der Wanduhr Schritt — nach 20 Frames zu 50 ms liegt
  `tickTime` höchstens ein `fixedDelta` neben `1.0` (vor dem Fix ≈ 0,67).

**`src/display/FrameLoop.spec.ts`:**

- BUG-012, rot vor dem Fix: alle Abonnenten weg, einer wieder da → das erste Frame trägt
  `deltaTime` `0` und `lastNow` gleich `now`; der Getter `deltaTime` ist `0`. Mit `maxFps`: das
  Raster beginnt beim ersten Frame nach dem Wiederanlauf neu.
- ASYNC-001, rot vor dem Fix: ein Renderer-Stub, dessen `setAnimationLoop()` ein rejectetes
  Promise liefert (derselbe Fehler bei Start und Stop) → nach `start`, `stop` und einem
  `setTimeout(0)` hat `console.error` genau einmal mit diesem Fehler gemeldet; es bleibt keine
  unbehandelte Rejection (Vitest ließe den Lauf sonst scheitern).

**`src/display/FixedFrameLoop.spec.ts`:**

- `makeFrame(deltaTime, extra)` setzt `rawDeltaTime: deltaTime` als Default.
- akkumuliert `rawDeltaTime`, nicht `deltaTime`: eigene Loop mit `fps: 20`, zehn Frames
  `makeFrame(1/30, {rawDeltaTime: 1/20})` → zehn Ticks (vor dem Fix sechs).
- Props ohne endliches `rawDeltaTime` → es zählt `deltaTime`.
- der Spiral-of-Death-Guard greift auf dem Roh-Delta: neuer Test mit `fps: 60`,
  `maxStepsPerFrame: 5` und einem Frame `makeFrame(1/30, {rawDeltaTime: 0.2})` → fünf Ticks,
  danach `alpha` `0` (der Rest ist verworfen). Der bestehende Test `:112` bleibt, wie er ist.

**`src/display/Chronometer.spec.ts`:** `rawDeltaTime` trägt, was `maxDeltaTime` abschneidet
(`maxDeltaTime` 0.1, Sprung 0.5 → `deltaTime` 0.1, `rawDeltaTime` 0.5); `0` nach `start()` und
`reset()`; unverändert bei `update()` im Stillstand.

**Browser (`packages/twopoint5d-testing/test/`):**

- `display-resize.test.js`, PERF-001, rot vor dem Fix: nach Start und zwei Frames zählt ein Spy
  auf `Element.prototype.getBoundingClientRect` (nur Aufrufe mit `this === host`) über drei
  weitere Frames null Messungen; Spy im `finally` zurück.
- `display-resize.test.js`: der Test »reacts to host element resizes on the next frame (no DOM
  listener required)« trägt einen Namen, der danach lügt → umbenennen (z. B. »… within two
  frames, through its ResizeObserver«). Die übrigen Tests warten nach einer Änderung schon zwei
  Frames oder wechseln die Quelle; sie sollten ohne Änderung grün bleiben.
- `display-constructor.test.js`, CONS-002, rot vor dem Fix (`TypeError` aus `instanceof`): ein
  Canvas im Dokument eines same-origin-iframes (iframe-Style 200 × 100 px, Canvas mit
  `resize-to="window"`), gebaut mit `createRenderer: ({canvas}) => makeRendererStub(canvas,
  Promise.resolve())` — kein GPU-Init. Erwartet: kein Wurf, `display.width`/`height` =
  `innerWidth`/`innerHeight` des iframe-Fensters, und die Regel der Canvas-Klasse liegt in den
  `adoptedStyleSheets` des iframe-Dokuments, nicht in denen des Hauptdokuments.
- `makeIframeDocument()` steht heute lokal in `stylesheets.test.js:31–37`; ein zweiter Nutzer →
  nach `helpers/fixtures.js` verschieben (AGENTS.md), beide Dateien importieren sie dort. Das
  Aufräumen der iframes (`hosts` in `stylesheets.test.js`) muss mitwandern oder beim Aufrufer
  bleiben — so, dass jeder Test sein iframe wieder entfernt.

### CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `[Unreleased]`, nach dem Skill `updating-changelog`:

- Added: `Chronometer#rawDeltaTime`; das Feld `rawDeltaTime` von `DisplayEventProps`.
- Changed: `Display` misst ereignisgetrieben (Observer, Media-Query, `resize`-Event), pollt nur
  mit `resizeToCallback` oder ohne `ResizeObserver`/`matchMedia`; ein eigenes `resize()` misst
  immer; Dokument und Fenster des Canvas (Sichtbarkeit, Pixelverhältnis, Fenstergröße, Default
  von `styleSheetRoot`, Container), Canvas und Host aus einem iframe werden angenommen;
  `FixedFrameLoop` akkumuliert `rawDeltaTime`.
- Fixed: das erste Frame einer `FrameLoop` nach dem Wiederanlauf trägt `deltaTime` 0; ein
  Renderer, dessen `setAnimationLoop()` rejected, wird gemeldet statt als unbehandelte Rejection.
- Migration Guide: Code, der `DisplayEventProps` als Literal baut (Tests, `getEventProps()` ohne
  Spread), braucht `rawDeltaTime`; `FixedFrameLoop` läuft bei niedriger Framerate mehr Ticks pro
  Frame (bis `maxStepsPerFrame`); was kein Observer sieht, braucht ein eigenes `resize()`;
  `styleSheetRoot` folgt ohne Angabe dem Dokument des Canvas.

## Findings im Volltext

**PERF-001 · medium · packages/twopoint5d/src/display/Display.ts:1250** — DOM-Messung in `resize()` nicht mehr pro Frame per Polling ausführen
Weitere Fundstellen: `Display.ts:1331`, `Display.ts:1460`, `Display.ts:613`, `styleUtils.ts:35`, `styleUtils.ts:37`.
Jeder rAF-Tick läuft three-Animation-Loop → `RAF#onAnimationFrame` (FrameLoop.ts:79) → `FrameLoop#onRAF` (FrameLoop.ts:318) → `Display[FrameLoop.OnFrame]` (Display.ts:1436) → `renderFrame()` → `resize()` (Display.ts:1460). Mit dem Default `resizePollIntervalMs = 0` misst `resize()` in jedem Frame: `getContentAreaSize()` ruft `getComputedStyle(element)` und `getBoundingClientRect()` samt 8× `getPropertyValue`+`parseFloat` auf (styleUtils.ts:35-40), danach holt `#applyMeasuredSize()` ein zweites `getComputedStyle(canvas)` und parst Box-Sizing, Padding und Border erneut (Display.ts:1331-1334). Im Standardfall `new Display(canvas)` ist `resizeToElement` der Canvas selbst, das zweite `getComputedStyle` betrifft also dasselbe Element, und das `style`, das `getContentAreaSize()` zurückgibt, wird bei Display.ts:1321 verworfen. Hat vorher im selben Frame irgendetwas das DOM verändert (andere rAF-Callbacks, Input-Handler, Timer), erzwingt `getBoundingClientRect()` ein synchrones Layout, zusätzlich zum Layout des Rendering-Schritts. Bei 120 bis 240 Hz summiert sich das. Das JSDoc bei Display.ts:605-612 räumt die Kosten selbst ein, lässt den Default aber auf 0. Die Begründung »ohne DOM-Listener, die aufgeräumt werden müssten« (Display.ts:492) trägt nicht weit, denn der Konstruktor räumt `visibilitychange` und `IntersectionObserver` bereits über `once(this, OnDisplayDispose, …)` ab.
Beleg: `const canvasStyle = getComputedStyle(canvas, null);` (Display.ts:1331) nach `const area = getContentAreaSize(source.element);` (Display.ts:1320), beide in jedem Frame
Empfehlung: Die Größe über einen `ResizeObserver` auf die aufgelöste Größenquelle beobachten (mit `devicePixelContentBoxSize`, wo verfügbar) und `devicePixelRatio`-Wechsel per `matchMedia('(resolution: …dppx)')` abfangen; im Frame dann nur ein Dirty-Flag prüfen. Das Polling bleibt als Fallback für `resizeToCallback` und Selektorwechsel. Kurzfristig: die live `CSSStyleDeclaration` pro Element cachen statt `getComputedStyle()` pro Frame neu aufzurufen, das `style` aus `getContentAreaSize()` weiterreichen, wenn Quelle und Canvas identisch sind, und einen Default > 0 für `resizePollIntervalMs` erwägen.

**BUG-003 · medium · packages/twopoint5d/src/display/FixedFrameLoop.ts:216** — `FixedFrameLoop` gegen die `maxDeltaTime`-Kappung des Displays entkoppeln
Weitere Fundstellen: `Display.ts:582`, `FixedFrameLoop.ts:43`, `Chronometer.ts:118`.
`FixedFrameLoop` addiert `props.deltaTime` aus `OnDisplayRenderFrame` (FixedFrameLoop.ts:216), also `Chronometer#deltaTime`, das `Display` per Default auf `1/30` s kappt (Display.ts:582, Chronometer.ts:118-120). Die Kappung unterscheidet einen einzelnen Ausreißer nicht von einer dauerhaft niedrigen Framerate. Rendert ein schwaches Gerät konstant mit 20 fps (50 ms pro Frame), kommen nur 33 ms pro Frame an: Simulation und `display.now` laufen dann mit rund 67 % der Wanduhr, bei 15 fps mit 50 %. Das JSDoc der Klasse verspricht dagegen »accumulating real wall-clock deltas« (FixedFrameLoop.ts:43-44). Gleichzeitig kann der eigene Spiral-of-Death-Guard `maxStepsPerFrame = 5` bei 60 Hz nie greifen, weil die gekappte Zeit höchstens 2 Ticks pro Frame nachliefert.
Beleg: `this.#accumulator += props.deltaTime;` (FixedFrameLoop.ts:216) mit `#chronometer = new Chronometer(undefined, 1 / 30)` (Display.ts:582)
Empfehlung: Den `FixedFrameLoop` mit einem ungekappten Delta füttern (z. B. das Roh-Delta des Chronometers oder `FrameLoop`-`deltaTime` zusätzlich in den Props) und das Begrenzen seinem eigenen `maxStepsPerFrame` überlassen, oder den Default von `maxDeltaTime` so weit anheben (etwa 0,1 bis 0,25 s), dass er nur echte Ausreißer trifft. In beiden Fällen das JSDoc von `Display.maxDeltaTime` und `FixedFrameLoop` um das Verhalten bei dauerhaft niedriger Framerate ergänzen.

**API-002 · low · packages/twopoint5d/src/display/Display.ts:1240** — Manuellen `resize()`-Aufruf vom `resizePollIntervalMs`-Throttle ausnehmen
Weitere Fundstelle: `Display.ts:1209`.
Das JSDoc von `resize()` empfiehlt den manuellen Aufruf »immediately after a layout-affecting DOM mutation if you cannot wait for the next frame« (Display.ts:1209-1211). Der Throttle bei Display.ts:1240-1246 greift aber bei jedem Aufruf. Ist `resizePollIntervalMs > 0` und hat der Frame kurz vorher gemessen, kehrt der manuelle Aufruf still ohne Messung zurück. Genau der dokumentierte Anwendungsfall liefert dann die alte Größe. Umgekehrt verschiebt ein manueller Aufruf, der misst, die nächste Messung im Frame.
Beleg: `if (nowMs - this.#lastResizePollMs < this.resizePollIntervalMs) { return; }` (Display.ts:1242-1244)
Empfehlung: Den Throttle nur auf den Aufruf aus `renderFrame()` anwenden, etwa über einen privaten `#resize(fromFrame: boolean)`, oder `resize({force: true})` anbieten und das JSDoc von `resize()` um die Wechselwirkung ergänzen.

**CONS-002 · low · packages/twopoint5d/src/display/Display.ts:1052** — Dokument und Fenster des Canvas statt der globalen `document`/`window` verwenden
Weitere Fundstellen: `Display.ts:1055`, `Display.ts:1199`, `Display.ts:1311`, `Display.ts:909`, `Display.ts:932`.
Die Release-Logik und `Stylesheets` arbeiten bewusst Realm-genau: `waitForTwoAnimationFrames()` nimmt `renderer.domElement.ownerDocument.defaultView` (Display.ts:128), und `newSheetFor()` baut das Sheet mit dem `CSSStyleSheet` des eigenen Fensters (Stylesheets.ts:25-35). Der Rest von `Display` greift dagegen auf die globalen Objekte zu: `visibilitychange` und `document.hidden` des globalen Dokuments (Display.ts:1052/1055), `window.devicePixelRatio` (Display.ts:1199), `window.innerWidth/innerHeight` für `resize-to="window"` (Display.ts:1311), `document.head` als Default-Root (Display.ts:909) und `document.createElement` für den Container (Display.ts:932). Liegt der Canvas in einem same-origin-iframe, während der Code im Parent läuft, dann misst `resize-to="window"` das falsche Fenster, und die Stylesheet-Regeln landen im Parent-Dokument.
Beleg: `document.addEventListener('visibilitychange', onDocVisibilityChange, false);` (Display.ts:1055) neben `const view = renderer.domElement.ownerDocument?.defaultView;` (Display.ts:128)
Empfehlung: Im Konstruktor einmal `const doc = canvas.ownerDocument; const view = doc.defaultView ?? window;` ermitteln und für Visibility, Pixel Ratio, Fenstergröße und den Default von `styleSheetRoot` (`doc.head`) nutzen.

**PERF-007 · low · packages/twopoint5d/src/display/FrameLoop.ts:318** — Kurzlebige Objekte im Frame-Hot-Path wiederverwenden
Weitere Fundstellen: `Display.ts:1268`, `Display.ts:1311`, `Display.ts:1321`, `styleUtils.ts:42`, `Display.ts:1370`, `Display.ts:1761`, `FixedFrameLoop.ts:220`, `FixedFrameLoop.ts:238`.
Pro rAF-Tick entstehen mehrere Wegwerfobjekte: das `OnFrame`-Props-Objekt mit 5 Feldern (FrameLoop.ts:318), von dem `Display` nur `now` liest (Display.ts:1436); das Quellobjekt `{window, element}` aus `#resolveSizeSource()` (Display.ts:1268); das Fallback-Tupel, das `#measureSizeSource()` anlegt, bevor klar ist, ob es gebraucht wird (Display.ts:1311); das Messergebnis-Objekt aus `getContentAreaSize()` samt `DOMRect` (styleUtils.ts:37/42) und ein weiteres `[w, h]`-Tupel (Display.ts:1321); der Resize-Hash als Template-String mit sechs Number-zu-String-Konvertierungen, nur für einen Gleichheitsvergleich (Display.ts:1370); das `DisplayEventProps`-Objekt je `#emit` (Display.ts:1761). Mit `FixedFrameLoop` kommen ein Objekt je Tick (FixedFrameLoop.ts:220) und eine Spread-Kopie der Display-Props je Frame dazu (FixedFrameLoop.ts:238). Einzeln sind die Objekte billig, in Summe erzeugen sie aber konstanten Young-Gen-GC-Druck genau in dem Pfad, in dem jede Millisekunde zählt.
Beleg: `const resizeHash = `${wPx}|${cssWidth}x${hPx}|${cssHeight}x${pixelRatio},${pixelZoom}`;` (Display.ts:1370)
Empfehlung: Rein interne Zwischenergebnisse (Quelle, Fallback, Messung) in Instanzfeldern halten oder als Skalare zurückgeben, und den Hash durch einen Vergleich der sechs Zahlen gegen gespeicherte Felder ersetzen. Für die Event-Props wird nichts stillschweigend wiederverwendet, weil Listener sie behalten dürfen (`nextFrame()` resolved mit ihnen, Display.ts:1806). Ein wiederverwendetes Props-Objekt braucht einen dokumentierten Vertrag, oder die Allokation bleibt bewusst.

**ASYNC-001 · low · packages/twopoint5d/src/display/FrameLoop.ts:99** — Promise von `renderer.setAnimationLoop()` im rAF-Treiber behandeln
Weitere Fundstellen: `FrameLoop.ts:112`, `FrameLoop.ts:5`.
`Renderer#setAnimationLoop()` von three ist `async` und ruft auf einem noch nicht initialisierten Renderer erst `await this.init()` auf (three/src/renderers/common/Renderer.js:1921-1925). `RAF#start()` und `RAF#stop()` verwerfen das zurückgegebene Promise, und das Interface `ISetAnimationLoop` typisiert es als `unknown`. Wer die öffentliche `FrameLoop` direkt mit einem Renderer baut (`new FrameLoop(0, renderer).start(obj)`) und `start()` vor dem Abschluss des Inits aufruft, bekommt bei einem fehlgeschlagenen Init eine unbehandelte Rejection ohne Bezug zur `FrameLoop`. `Display` selbst ist nicht betroffen: Es startet seine Loop erst nach `#waitForRenderer`. Den gleichen Effekt beschreibt Display.ts:1695-1698 für `renderer.dispose()` und umgeht ihn dort bewusst.
Beleg: `this.renderer.setAnimationLoop(this.#onAnimationFrame);` (FrameLoop.ts:99)
Empfehlung: Das Ergebnis als `unknown` annehmen und, wenn es thenable ist, mit einem `.catch()` versehen, das den Fehler als Warnung meldet (oder über ein Event der `FrameLoop` weiterreicht). Das Interface auf `unknown | Promise<unknown>` präzisieren.

**BUG-012 · low · packages/twopoint5d/src/display/FrameLoop.ts:306** — `FrameLoop#lastNow` beim Wiederanlaufen nach einer Pause zurücksetzen
Weitere Fundstellen: `FrameLoop.ts:192`, `FrameLoop.ts:287`.
Nimmt `stop(target)` den letzten Abonnenten von der Loop, hängt sich die `FrameLoop` vom Treiber ab (FrameLoop.ts:287), behält aber `#lastNow`. Das erste `OnFrame` nach dem nächsten `start()` meldet deshalb als `deltaTime` die ganze Pausendauer und als `lastNow` den Zeitstempel von vor der Pause (FrameLoop.ts:306/320). Der Treiber `RAF` setzt bei seinem Stop genau aus diesem Grund den Messanker neu (FrameLoop.ts:117-120, »a window anchored … across the span in which nobody asked for a frame reports an fps the renderer never ran at«); für das Delta der `FrameLoop` fehlt dieselbe Behandlung. `Display` ist nicht betroffen, weil es seine Zeit aus dem `Chronometer` nimmt. Direkte Nutzer der öffentlichen `FrameLoop` bekommen dagegen eine Delta-Spitze. `FrameLoop.spec.ts` prüft nur das erste Frame überhaupt, nicht das erste nach einem Wiederanlauf.
Beleg: `this.#deltaTime = prevNow == null ? 0 : now - prevNow;` (FrameLoop.ts:306)
Empfehlung: `#lastNow = undefined` und `#nextEmitAt = 0` setzen, sobald `subscriptionCount` in `stop()` auf 0 fällt, damit das erste Frame nach dem Wiederanlauf `deltaTime === 0` trägt; dazu ein Test »stop all, start again«.

## Reviewer-Urteil je Finding (Stand `261bbd73`)

Aus `paket-2.review-0.json`, bestätigt nach Runde 1 in `paket-2.review-1.json`. Zeilen im Arbeitsbaum vor Runde 1; Runde 1 hat in `Display.ts` oben die Konstante `RESIZE_TO_WINDOW` (`:70`) und JSDoc-Sätze eingefügt, die Zeilen dahinter liegen um rund ein Dutzend tiefer.

- **PERF-001 — behoben.** `Display.ts:1389` `#startSizeWatch()` (`ResizeObserver`, `resize` am Fenster, Media Query), `#watchPixelRatio()` `:1402`, Observer-Wechsel `:1410`; `#resize(fromFrame)` `:1342` prüft im Frame nur das Dirty-Flag, erstes Frame misst immer; gepollt nur mit `resizeToCallback` oder ohne Observer (`:1358`); Style-Caches `:1540` ff. Browser-Beleg `display-resize.test.js:126`.
- **BUG-003 — behoben.** `Chronometer.ts:78`, `:131` (`rawDeltaTime`), `types.ts:21` Pflichtfeld, `Display.ts:2021` füllt es, `FixedFrameLoop.ts:229` akkumuliert mit Fallback; JSDoc `FixedFrameLoop.ts:48` und `Display.maxDeltaTime`. Test `Display.spec.ts:826`.
- **API-002 — behoben.** `Display.ts:1336` öffentliches `resize()` misst immer, Throttle nur im Frame-Pfad (`:1358` ff.). Test `Display.spec.ts:882`.
- **CONS-002 — behoben.** `#doc`/`#view` `Display.ts:998–999`, Default `styleSheetRoot` `:1002`, `createElement` `:1025`/`:1029`, `visibilitychange` `:1150`, `devicePixelRatio` `:1301`, `innerWidth`/`innerHeight` `:1532`. Tests `Display.spec.ts:1203`, `display-constructor.test.js:47` und (Runde 1) `:79` für den Host im iframe.
- **PERF-007 — behoben** auf dem Weg »die Allokation bleibt bewusst«: Warum-Kommentare `Display.ts:2009`, `FrameLoop.ts:341`, `FixedFrameLoop.ts:234`; Zwischenergebnisse in Feldern; Hash durch Vergleich der sechs Werte ersetzt (`Display.ts:1604`); Regex als Modul-Konstante `RESIZE_TO_WINDOW` (Runde 1).
- **ASYNC-001 — behoben.** `FrameLoop.ts:131` Rejection-Handler an `setAnimationLoop()`, `console.error`, je Fehler einmal; Sentinel `NO_LOOP_ERROR` (`FrameLoop.ts:17`, Runde 1), damit auch eine Rejection mit `undefined` gemeldet wird. Tests `FrameLoop.spec.ts:337` und »reports a renderer whose animation loop rejects with undefined«.
- **BUG-012 — behoben.** `FrameLoop.ts:310` setzt `#lastNow`/`#nextEmitAt` beim letzten Abonnenten zurück. Test `FrameLoop.spec.ts:295` samt `maxFps`-Raster.
- **Nebenbefund `instanceof HTMLElement` — behoben.** `isHTMLElement()` `Display.ts:49`, benutzt `:1016`.

## Kleine Befunde des Reviewers

Alle fünf aus Runde 0 in Runde 1 mitgenommen und vom Reviewer als erledigt bestätigt: Regex pro Frame (`RESIZE_TO_WINDOW`), `undefined` als Startwert von `#reportedLoopError` (`NO_LOOP_ERROR`), »at most `Display.maxDeltaTime`« ohne den Fall `0` (`types.ts:13`), fehlender Browser-Test für den Host im iframe, doppelte Leerzeile vor `## [0.21.2]` im CHANGELOG. Offen: keine. Vermerkt ohne Befund: `Display.ts:512` ist im JSDoc länger umbrochen als sein Absatz (in der Datei üblich).

## Nebenbefunde (→ »Offene Befunde« im Plan)

- `Chronometer.ts:1` `getCurrentTime()` nimmt `±Infinity` an — vorbestehend (gleiche Zeile in `801906f3`), Ort in `src/display/` → Scope-Regel greift, → Scope. Keine gemeinsame Ursache mit einem Finding dieses Pakets, daher nicht mitgenommen.
- `FixedFrameLoop.ts:144–148`/`:233` nicht-ganzzahliges `maxStepsPerFrame` — vorbestehend (Setter in `801906f3` bei `:133` mit derselben Prüfung), Ort in `src/display/` → Scope. Eigene Ursache (Validierung des Setters), nicht mitgenommen.
