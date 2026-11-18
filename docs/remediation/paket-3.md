# Paket 3 — Display: Canvas-Release, adaptive Auflösung, Frame-Takt und Eingabeprüfung

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-003 (medium), BUG-004 (medium), BUG-009 (low), BUG-010 (low), CONS-003 (low),
  CONS-001 (low), dazu offene Frage 1 (entschieden: die Canvas eines übernommenen Renderers ist
  wiederverwendbar, BUG-003 ist ein Fehler) und vier vorbestehende Nebenbefunde gleicher Ursache
  wie CONS-001 (unten, Vorgehen 6c, 6d, 7b, 7c)
- Ziel: Das Display gibt jede übernommene Canvas wiederverwendbar zurück, die adaptive Auflösung
  kann von frame-pacing zurück auf gpu-time, FramePacer und Chronometer zählen Frames und Zeit
  konsistent, Fehler gehen über `emitSafe()`, und öffentliche Eingaben werden nach der
  Projektregel geprüft.
- Modell: stärkste Stufe
- Effort: high
- Dateien (Quelle; Specs, Browser-Tests und Doku dazu, siehe Vorgehen):
  - `packages/twopoint5d/src/display/Display.ts`, `canvasHandover.ts`, `AdaptiveResolution.ts`,
    `FramePacer.ts`, `Chronometer.ts`, `FixedFrameLoop.ts`, `types.ts` (TSDoc von `maxFps`)
  - `packages/twopoint5d/src/controls/PanControl2D.ts`
  - `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts`, `RepeatingTilesProvider.ts`
  - `packages/twopoint5d/src/stage/fitIntoRectangle.ts`
  - `packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts`
  - `packages/twopoint5d/src/texture/TextureAtlas.ts`, `FrameBasedAnimations.ts`,
    `TextureResource.ts` (nur TSDoc), `types.ts` (nur TSDoc)
  - `packages/twopoint5d-testing/test/display-dispose.test.js`
  - `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d/docs/display.md`,
    `packages/twopoint5d/docs/resource-lifecycle.md`,
    `packages/twopoint5d/docs/proposals/drawing-on-demand.md`, weitere Guides, wo sie eine
    geänderte Regel beschreiben (Schritt 9)
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: hand the canvas of an adopted renderer on to the next display, let adaptive resolution go back to gpu-time, run the steps of a frame before shouldDraw() answers, count the time before a stop as lost, let every listener hear a display error, and refuse rates and inputs that were dropped without a word`

## Vorgehen

Allgemein, für jeden Schritt:

- Jede Korrektur beginnt mit ihrem Regressionstest, der vor der Änderung rot läuft; der rote Lauf
  (Kommando, Testname, Fehlermeldung) gehört in den Report. Das gilt auch für die
  Eingabeprüfungen aus Schritt 6 und 7: heute gehen die Werte still durch, der Test, der den
  Fehler erwartet, ist also rot.
- Specs, die das alte Verhalten festschreiben (ein still ignorierter Wert, eine Frame Latenz, ein
  Sprung von `time`), werden mitgezogen, nicht gelöscht: sie prüfen danach das neue Verhalten.
- Fehlermeldungen nach AGENTS.md, »Error and warning messages«: Subjekt vorn, Zahlen über die
  Helfer aus `src/utils/` (`assertFinite`, `assertPositiveFinite`, `assertFiniteAtLeast`,
  `assertWholeNumber`), ein abgelehnter Wert über `describeValue()`. Auf heißen Pfaden inline
  mit Kommentar, warum.
- Code, Kommentare und Doku auf Englisch, ohne Finding-IDs und ohne Rückblick auf den Vorzustand
  (Abschnitt »Konventionen« im Plan).
- Einzelne Vitest-Dateien laufen mit `pnpm nx test twopoint5d -- src/path/to/file.spec.ts`, die
  Browser-Tests mit `pnpm test:browser`; nie zwei Gates oder Builds parallel im Arbeitsbaum.

### 1. Canvas eines übernommenen Renderers zurückgeben (BUG-003, offene Frage 1)

Ursache: `Display#releaseRenderer()` (`Display.ts:2078-2091`) gibt die Canvas nur dann mit
`handBack = true` zurück, wenn sie als erstes Argument kam (`#callersCanvas`, gesetzt nur im
CANVAS-Zweig des Konstruktors, `Display.ts:990-994`). Die `domElement`-Canvas eines übernommenen
`WebGPURenderer` geht deshalb durch `disposeLosingContext()` (`canvasHandover.ts:180-184`,
`loseContext()` ohne `preventDefault()`, also nicht wiederherstellbar), und `releaseRenderer()`
trägt keinen Eintrag in `canvasReleases` ein (`canvasHandover.ts:412-419`) — ein neuer Display auf
derselben Canvas wartet nicht und verliert unter WebGL den geteilten Kontext an die nachlaufende
Release. three 0.187.0 gibt den Kontext in `WebGLBackend.dispose()` nur für eine selbst gebaute
Canvas ab (`node_modules/three/src/renderers/webgl-fallback/WebGLBackend.js:2865-2868`,
`parameters.canvas === undefined`).

1. Regressionstests zuerst, in `packages/twopoint5d-testing/test/display-dispose.test.js`, als
   neues `describe('the canvas of an adopted renderer, for the display after it', …)` neben
   `describe('the canvas that was handed in, for the display after it', …)` (Zeile 288), mit
   denselben Helfern (`makeContainer()`, `whenReleased()`, `expectLiveBackend()` aus der Datei,
   `host`/`previous`/`display` aus deren `beforeEach`/`afterEach`):
   - `it('the canvas of an adopted renderer carries a second display built while the first one is being released', …)`:
     Canvas in `host`, `previous = new Display(new WebGPURenderer({canvas}))`, `start()`,
     `nextFrame()`, `const released = whenReleased(previous.renderer)`, `previous.dispose()`, sofort
     `display = new Display(new WebGPURenderer({canvas}))`, `await display.start()`,
     `await released`, `await display.nextFrame()`, `await expectLiveBackend(display)`.
   - `it('the canvas of an adopted renderer carries a second display built after the first one has been released', …)`:
     wie oben, aber `await released` und ein `setTimeout(…, 0)` vor dem zweiten Display (wie im
     Schwesterfall Zeile 312-341), dann `expectLiveBackend(display)`.
   Der Renderer wird ohne weitere Parameter gebaut: das Backend setzt die Harness
   (`pinBackend()` in `web-test-runner.config.js`), wie in `display-adopt-renderer.test.js:13`.
   Beide Fälle laufen ohne `this.skip()` unter beiden Engines; rot vor dem Fix mindestens unter
   dem WebGL-Launcher (verlorener Kontext). Kein neuer Eintrag in `EXPECTED_SKIPS`.
2. In `Display.ts`, Konstruktor, Zweig `isWebGPURenderer(domElementOrRenderer)` (Zeile 984-986):
   `this.#callersCanvas = domElementOrRenderer.domElement;` setzen. `#callersCanvasBefore` bleibt
   auf diesem Weg ungesetzt — `#giveBackCallersCanvas()` stellt also wie bisher nur eine als
   erstes Argument übergebene Canvas in ihren alten Zustand zurück; das Wiederherstellen von
   Klassen und Attributen ist nicht Teil dieses Pakets.
3. Den Kommentar an `#callersCanvas` (Zeile 904-906) auf beide Wege umschreiben: die Canvas, die
   nach `dispose()` beim Aufrufer bleibt — als erstes Argument übergeben oder `domElement` eines
   übernommenen Renderers — und die die Release für den nächsten Display übergibt. Der Kommentar
   in `#releaseRenderer()` zum Vergleich mit `createRenderer` bleibt richtig und bleibt stehen.
4. TSDoc nachziehen: Konstruktor (Zeile 915-935: »A renderer handed in here is adopted, not
   borrowed: the display takes it and its `domElement` as its own« — der Renderer gehört dem
   Display und wird von ihm freigegeben, seine Canvas bleibt, wo der Aufrufer sie hingestellt hat,
   und trägt nach der Release einen neuen Display wie eine übergebene Canvas; der Absatz über das
   Warten auf eine laufende Release gilt für beide), `dispose()` (Zeile 1964-2010, Absatz »That
   canvas is able to carry a new display« auf beide Canvas-Arten), `releaseRenderer()` in
   `canvasHandover.ts:371-383` (»A canvas handed to the constructor goes back …«).
5. `packages/twopoint5d/docs/resource-lifecycle.md` (Absatz um Zeile 50-56, die Canvas, die einen
   neuen Display trägt) und die Stellen in `packages/twopoint5d/docs/display.md`, die das Übernehmen
   eines Renderers oder `dispose()` beschreiben: der Fall steht dort ausdrücklich, ein `Display`
   auf der Canvas eines übernommenen Renderers — mit einem neuen `WebGPURenderer({canvas})` —
   wartet auf die Release und holt den WebGL-Kontext zurück (Entscheidung zu offener Frage 1).
6. CHANGELOG, `### Fixed` unter `## [Unreleased]` (Abschnitt neu anlegen, Reihenfolge nach Keep a
   Changelog): die Canvas eines übernommenen `WebGPURenderer` trägt nach `display.dispose()` einen
   neuen `Display`, der auf die Release wartet und den WebGL-Kontext zurückholt.

### 2. Adaptive Auflösung kehrt zu gpu-time zurück (BUG-004)

Ursache: `#sampleGpuTime()` (`AdaptiveResolution.ts:451-456`) setzt nach 60 stillen Frames
`#method = 'frame-pacing'`, und `#method ??=` (Zeile 410) stellt es nie zurück; danach fragt
niemand mehr nach GPU-Zeit.

Gewählter Weg — abweichend von beiden Vorschlägen des Audits, die Begründung unten: Unter
`frame-pacing` fragt der Controller weiter nach GPU-Zeit, solange `#tracksGpuTime()` wahr ist,
und die erste gültige Messung bringt ihn zurück auf `gpu-time`.

1. Regressionstest zuerst, in `AdaptiveResolution.spec.ts`:
   `it('goes back to gpu-time once a renderer that measured nothing for its first 120 frames measures', …)`
   — ein Renderer mit `trackTimestamp: true` und `hasTimestamp: true`, dessen
   `resolveTimestampsAsync('render')` für die ersten 120 Frames `undefined` liefert und danach eine
   feste Zeit; am Ende `adaptive.method === 'gpu-time'` und `adaptive.gpuTime` definiert, nachdem
   ein Fenster durch ist. Dazu
   `it('asks a renderer without timestamps for no GPU time', …)` — ohne `hasTimestamp` bleibt es bei
   `frame-pacing`, `resolveTimestampsAsync` wird nie gerufen.
2. In `#onRenderFrame` (Zeile 407-432): unter `frame-pacing` ruft der Controller zusätzlich zu
   `#readRafInterval()`/`#samplePacing()` eine neue Methode `#probeGpuTime()`, wenn
   `#tracksGpuTime()` wahr ist. Sie startet höchstens eine Messung zugleich, wie
   `#sampleGpuTime()` (`#gpuResolving`, `#gpuResolvingEpoch`), über dieselben vorgebauten Handler —
   kein neues Closure je Frame. Die Probe läuft auch in den Settle-Frames nicht (sie steht hinter
   dem `#settleFrames`-Return).
3. `#onGpuTime` (Zeile 460-476): kommt eine gültige Messung (`isPositiveFinite(ms)`, Epoche
   passt, Controller hält das Display) an, während `#method === 'frame-pacing'`, dann
   `#method = 'gpu-time'`, die Versuchsstände zurücksetzen und `#settle()` — die Messung selbst
   zählt nicht in ein Fenster. Die Versuchsstände sind dieselben, die `#takeOverScale()`
   (Zeile 350-360) zurücksetzt: `#pacingDescentFrom = -1`, `#gpuStepUpPending = false`,
   `#gpuGoodWindows = 0`, `#pacingCleanFrames = 0`, `#pacingProbeWindows = 0`; was die Versuche
   gelernt haben (`#pacingCadenceMs`, `#pacingProbeFrames`, `#gpuStepUpWindows`), bleibt. Beide
   Stellen rufen dafür eine gemeinsame neue Methode `#resetTries()`; der Wechsel nach
   `frame-pacing` in `#sampleGpuTime()` ruft sie ebenfalls.
4. Hot Path: der Frame unter `frame-pacing` mit Probe alloziert nichts —
   `hot-path-allocations.adaptive-resolution.spec.ts` bekommt einen Fall
   `test('a frame under frame-pacing that still asks for GPU time allocates nothing', …)` mit dem
   Thenable-Stand-in der Datei (Zeile 34-47), der `undefined` liefert.
5. TSDoc: `get method()` (Zeile 274-282: »set in the first frame it runs in« — gesetzt im ersten
   Frame, geht nach 60 Frames ohne Messung auf `frame-pacing` und mit der nächsten gültigen Messung
   zurück auf `gpu-time`, beide Wechsel lassen 30 Frames settlen), die Klassen-TSDoc (Zeile
   108-133) einen Satz dazu. `docs/display.md`, »Adaptive resolution in detail« (Zeile ~1141-1142:
   »So does a renderer that resolves no GPU time for 60 frames in a row: the controller goes over
   to `frame-pacing` then«) um die Rückkehr ergänzen, und Zeile ~351 (`adaptive.method`) prüfen.
6. CHANGELOG `### Fixed`: ein Controller, der wegen ausbleibender GPU-Zeit auf `frame-pacing`
   gewechselt ist — ein Ladebildschirm, der in den ersten Frames nichts zeichnet —, kehrt mit der
   ersten Messung zu `gpu-time` zurück.

Begründung der Abweichung: »Stille Frames erst ab der ersten gültigen Messung zählen« nimmt dem
Controller den Rückfall für einen Renderer, der Timestamps meldet, aber nie misst — er hielte dann
für immer still. »Bei `#settle()` erneut `gpu-time` versuchen« erfüllt den Spec des Audits nicht:
ohne Resize oder Restart nach Frame 90 bleibt es bei `frame-pacing`. Die Probe deckt beide Fälle
und kostet unter `frame-pacing` dasselbe wie eine Messung unter `gpu-time`.

### 3. Die Steps eines Frames laufen vor dessen `shouldDraw()` (BUG-009)

Ursache: Die Steps laufen im eigenen `onRenderFrame`-Abo des Pacers (`FramePacer.ts:154`),
`shouldDraw()` (Zeile 273) im Frame-Handler; wer zuerst abonniert hat, läuft zuerst. Ein Pacer,
der nach dem Frame-Handler gebaut wurde, zeichnet den Zustand des Vorframes. Das Proposal
`docs/proposals/drawing-on-demand.md` erklärt diesen Versatz in §3.3 und §4.2 zum Vertrag;
die Entscheidung im Plan (Code-Fix statt Doku-Vermerk) gilt hier.

Gewählter Weg: `shouldDraw(frame)` führt die Steps dieses Frames selbst aus, wenn sie für ihn noch
nicht gelaufen sind, und das Abo überspringt sie dann. Kein Prioritätsparameter in
`FramePacerSource`: der Weg hängt an keiner Quelle, ändert keine öffentliche Signatur und hält die
Aussage des Proposals, dass der Pacer keine Reihenfolge der Listener voraussetzt.

1. Regressionstests zuerst, in `FramePacer.spec.ts`:
   - `it('runs the steps of a frame before shouldDraw() answers, also for a pacer built after the frame handler subscribed', …)`
     — eine Quelle, deren Frame-Handler vor dem Pacer abonniert; ein Step, der in Frame N `true`
     meldet, lässt `shouldDraw()` in Frame N `true` antworten.
   - `it('runs the steps of a frame once, whichever asks first', …)` — Zähler im Step, beide
     Reihenfolgen.
   - `it('runs the steps in every frame for a source that hands one props object with a new frameNo', …)`
   - `it('a step that throws in a run shouldDraw() started makes shouldDraw() throw, and the next frame draws', …)`
2. In `FramePacer`: zwei Marken, ohne Allokation (Felder, keine Objekte je Frame):
   - `#ranFrame: DisplayEventProps | undefined` und `#ranFrameNo` — gesetzt, wenn das Abo
     (`#runSteps`) die Steps eines Frames ausgeführt hat;
   - `#aheadFrame: DisplayEventProps | undefined` und `#aheadFrameNo` — gesetzt, wenn
     `shouldDraw()` sie vorgezogen hat.
   Ein Frame gilt als derselbe, wenn Objekt **und** `frameNo` übereinstimmen (eine Quelle, die ein
   Props-Objekt wiederverwendet und `frameNo` zählt, bleibt richtig).
   - Abo, je Aufruf: stimmt `#aheadFrame` mit dem Frame überein, `#aheadFrame = undefined` und
     nichts ausführen; sonst `#aheadFrame = undefined`, Steps ausführen, `#ranFrame` setzen.
     Das Abo löscht `#aheadFrame` in jedem Fall: es ist der Takt, der einmal je Frame kommt.
   - `shouldDraw(frame, busy)`: stimmt weder `#ranFrame` noch `#aheadFrame` mit dem Frame überein,
     die Steps ausführen und `#aheadFrame` setzen; dann wie bisher entscheiden. Zweimal
     `shouldDraw()` im selben Frame führt die Steps nicht zweimal aus.
   - Die Ausführung bleibt eine Methode (der bisherige Körper von `#runSteps`, Zeile 352-392), die
     beide Wege rufen; Fehler wie bisher: `invalidate()`, dann `throwCollected()` — aus
     `shouldDraw()` heraus, wenn es die Steps vorgezogen hat.
   - Nach `dispose()` bleibt `shouldDraw()` bei `true` und führt nichts aus.
3. `CameraRig.spec.ts:2455-2494` (`describe('as the frame step of a FramePacer', …)`): der Fall
   `askFirst: true` erwartet heute `extraDraws: 1`, also die Latenz; danach `extraDraws: 0` für
   beide Reihenfolgen, Kommentar Zeile 2456-2458 entsprechend.
4. `hot-path-allocations.frame-pacer.spec.ts`: `FRAME` ohne `frameNo` bleibt gültig (`undefined`
   gleich `undefined`); die vorhandenen Fälle bleiben grün, dazu
   `test('shouldDraw() that runs the steps of its frame itself allocates nothing', …)`.
5. TSDoc: Klasse (Zeile 75-92), `onFrame()` (Zeile 194-210: »the errors come out of the frame
   afterwards« — aus dem Frame oder aus `shouldDraw()`, wenn es die Steps vorgezogen hat),
   `shouldDraw()` (Zeile 257-272), `FramePacerSource.onRenderFrame` (Zeile 29).
6. Proposal `docs/proposals/drawing-on-demand.md`: §3.3 (Zeile 103-113, der Versatz ist nicht mehr
   der häufige Fall: was ein Step in Frame N bewegt, zeichnet Frame N; nur ein `report()` oder
   `invalidate()` nach der Frage zeichnet den nächsten), §4.2 letzter Absatz (Zeile 209-211), §4.6
   Zeile `steps run "after the draw" …` (Zeile 267), §5.2 `shouldDraw()` und §11.1 Testliste.
   `docs/display.md`, »Drawing on demand« und »Pitfalls of drawing on demand« (ab Zeile ~649 und
   ~886): die Regel steht dort — die Steps eines Frames laufen, bevor `shouldDraw()` für ihn
   antwortet, gleich in welcher Reihenfolge Pacer und Frame-Handler abonniert haben.
   `docs/stages.md` um Zeile 431 auf eine Aussage zur Reihenfolge prüfen.
7. CHANGELOG: `FramePacer` steht unveröffentlicht unter `### Added` (Zeile 13). Kein
   `Fixed`-Eintrag; den bestehenden Eintrag um die Regel ergänzen (die Steps eines Frames laufen,
   bevor `shouldDraw()` für ihn antwortet).

### 4. Die Zeit vor `stop()` zählt als verloren (BUG-010)

Ursache: `stop()` merkt sich nur `#pausedAt` (`Chronometer.ts:167-175`); `start()` schließt den
Spalt ab `#pausedAt` (Zeile 201), ein `update()` in der Pause aber ab `#currentTime` (Zeile 145).
Nachgerechnet: `update(10), stop(12), start(15)` ergibt `time` 12, `update(10), stop(12),
update(15), start(15)` ergibt 10.

Gewählte Regel: die Spanne vom letzten gesehenen Zeitpunkt bis `stop()` zählt als verloren, wie
die Pause danach. Damit gilt: `time` ändert sich ausschließlich um die `deltaTime` der
`update()`-Aufrufe, und weder `stop()` noch `start()` bewegt es.

1. Regressionstests zuerst, in `Chronometer.spec.ts`:
   - `it('ends at the same time and lostTime whether or not update() ran in the pause', …)` —
     `update(10), stop(12), start(15)` gegen `update(10), stop(12), update(15), start(15)`:
     beide `time` 10 (Start bei 0), gleiche `lostTime`, `deltaTime` 0.
   - `it('stop() and start() leave time where the last update() put it', …)`
2. `stop(time)`: `const at = Math.max(getCurrentTime(time), this.#currentTime)`;
   `this.#recentlyLostTime = at - this.#currentTime`; `this.#currentTime = at`.
3. `update()` in der Pause bleibt wie es ist (zählt ab `#currentTime`, das jetzt auf dem Stopp
   steht). `start(time)`: `const now = Math.max(getCurrentTime(time), this.#currentTime)`;
   `this.#lostTime += this.#recentlyLostTime + (now - this.#currentTime)`; dann wie bisher.
4. `#pausedAt` entfällt samt TSDoc (Zeile 41-45, 113, 225); `constructor` und `reset()` setzen
   es nicht mehr.
5. TSDoc von `stop()` (Zeile 152-166: die Spanne seit dem letzten gesehenen Zeitpunkt zählt ab
   `stop()` in `lostTime`) und `start()` (Zeile 177-192). `Display` ruft `stop()`/`start()`
   unverändert (`Display.ts:1129-1131`, `1157`).
6. CHANGELOG `### Fixed`: `Chronometer#time` springt bei `start()` nicht mehr um die Spanne
   zwischen letztem `update()` und `stop()`; sie zählt als verlorene Zeit.

### 5. `OnDisplayError` über `emitSafe()` (CONS-003)

1. Regressionstest zuerst, in `Display.spec.ts`:
   `it('lets every listener of OnDisplayError hear the error, also behind one that throws', …)` —
   ein `createRenderer`, dessen `init()` ablehnt; zwei Listener, der erste wirft; der zweite hört
   den Fehler, und keine Unhandled Rejection entsteht (vor dem Fix rot).
2. `Display.ts:1198-1202`: `emit(this, OnDisplayError, error, this)` →
   `emitSafe(this, OnDisplayError, error, this)`; Kommentar wie an `OnDisplayFullscreenChange`
   (Zeile 1095-1097): keiner der Wege hat einen Aufrufer, dem der Fehler gehörte. `emitSafe` ist in
   `Display.ts:3` schon importiert; das Event bleibt retained (Zeile 942) — mit dem Skill
   `using-eventize` prüfen, dass `emitSafe` den Retain genauso bedient.
3. TSDoc von `onError` (Zeile 2204-2211): jeder Listener hört den Fehler, auch hinter einem, der
   wirft; ein Listener, der wirft, wird von eventize auf der Konsole gemeldet.
4. CHANGELOG `### Changed`.

### 6. Raten im Display-Modul werfen (CONS-001, Display-Teil)

Regel: eine Rate, die nicht passt, wirft einen `RangeError` über die Helfer; `undefined` (und
`null`, wie `FramePacer` mit `??`) ist der Default. `FrameLoop` (`FrameLoop.ts:313-334`,
`assertFiniteAtLeast(…, 0)`) und `FramePacer` (`FramePacer.ts:144`, `assertPositiveFinite`)
werfen schon und bleiben, wie sie sind.

a) `new Display()`: `maxFps` direkt nach dem Destrukturieren der Optionen (`Display.ts:946-959`),
   vor dem Bau des Renderers, mit `assertFiniteAtLeast(maxFps, 'new Display()', 'maxFps', 0)`
   prüfen, wenn es nicht `undefined`/`null` ist — `0` bleibt »keine Grenze«. Dann
   `new FrameLoop(maxFps ?? 0, …)` (Zeile 1058-1060, Kommentar weg) und
   `targetFps: maxFps != null && maxFps > 0 && maxFps < 60 ? maxFps : undefined` (Zeile 1117).
   Spec: `new Display(canvas, {maxFps: NaN})`, `-1`, `Infinity` werfen den `RangeError`, und
   `createRenderer` wird nicht gerufen. TSDoc `DisplayParameters.maxFps` (`types.ts:102-111`:
   »or with anything but a positive finite number« entfällt; nennt den `RangeError`).
b) `new AdaptiveResolution()`: `targetFps` (Zeile 241) mit
   `assertPositiveFinite(options?.targetFps ?? 60, 'new AdaptiveResolution()', 'targetFps')`,
   nach den beiden Zustandsprüfungen (Zeile 226-238) und bevor etwas geschrieben wird. TSDoc
   `AdaptiveResolutionOptions.targetFps` (Zeile 8-13) und `@throws` des Konstruktors.
c) Nebenbefund gleicher Ursache, im selben Optionsobjekt: `minScale` und `maxScale`
   (`AdaptiveResolution.ts:244-247`) fallen heute für jeden Wert, der keine positive endliche Zahl
   ist, still auf den Default. Dieselbe Prüfung mit `assertPositiveFinite(…, 'new AdaptiveResolution()', 'minScale' | 'maxScale')`;
   das Runden auf Achtel bleibt. TSDoc Zeile 15-28.
d) `FixedFrameLoop` (`FixedFrameLoop.ts`):
   - `set fps(value)` (Zeile 184-188): `assertPositiveFinite(value, 'FixedFrameLoop', 'fps')`; die
     Schleife behält ihre Rate. Nebenbefund gleicher Ursache: `set maxStepsPerFrame(value)` (Zeile
     169-175) mit `assertWholeNumber(value, 'FixedFrameLoop', 'maxStepsPerFrame', 1)`.
   - Konstruktor (Zeile 238-246): vor `eventize(this)` prüfen — `options.fps` (wenn `!= null`) mit
     `assertPositiveFinite(…, 'new FixedFrameLoop()', 'fps')`, sonst `FixedFrameLoop.DefaultFps`
     mit Name `'FixedFrameLoop.DefaultFps'`; ebenso `maxStepsPerFrame` mit
     `assertWholeNumber(…, 1)` und `'FixedFrameLoop.DefaultMaxStepsPerFrame'`. Die Felder dann aus
     den geprüften Werten setzen. `BUILT_IN_FPS` und `BUILT_IN_MAX_STEPS_PER_FRAME` (Zeile 12-13)
     entfallen, die Statics bekommen ihre Werte direkt (`60`, `5`).
   - TSDoc von `fps`, `maxStepsPerFrame`, `DefaultFps`, `DefaultMaxStepsPerFrame` (Zeile 120-132,
     157-183) und `@throws` des Konstruktors.
e) Specs in `Display.spec.ts`, `AdaptiveResolution.spec.ts`, `FixedFrameLoop.spec.ts`; Fälle, die
   heute das stille Ignorieren prüfen, werden auf den `RangeError` umgestellt.

### 7. Eingaben außerhalb von `display/` (CONS-001, Rest)

a) `PanControl2D.mouseButton` (`PanControl2D.ts:224`, gesetzt Zeile 325): öffentliches Feld →
   Accessor-Paar mit `#mouseButton`. Setter: eine ganze Zahl von 1 bis 31 (die Bits von
   `MouseEvent.buttons`; mehrere Bits pannen mit jeder ihrer Tasten), sonst
   `RangeError('PanControl2D: mouseButton must be a whole number from 1 to 31, got ' + describeValue(value))`
   als Template; der Wert bleibt. Der Konstruktor setzt über den Setter. TSDoc an Option
   (Zeile 120-133) und Accessor. Spec: `0`, `32`, `1.5`, `'1'` werfen, `3` geht.
b) `Map2DSpatialHashGrid#getTiles()` (Zeile 258-271): `tileX` und `tileY` müssen endlich sein,
   und die Zellen der Abfrage — `tileX`, `tileY`, `tileX + width`, `tileY + height` — liegen
   zwischen `-Number.MAX_SAFE_INTEGER` und `Number.MAX_SAFE_INTEGER`; jenseits davon zählt
   `x++` nicht weiter, und die Zellschleife (Zeile 305-306, 340-341) endet nie. Meldung im Stil
   der vorhandenen (Zeile 262-264):
   `Map2DSpatialHashGrid: the tileX and tileY of getTiles() must be finite numbers, and the cells of the query within ±Number.MAX_SAFE_INTEGER, got tileX ${describeValue(tileX)}, tileY ${describeValue(tileY)}, width ${describeValue(width)}, height ${describeValue(height)}`;
   die bestehende Prüfung von `width`/`height` bleibt davor.
   Nebenbefund gleicher Ursache, dieselbe Schleife: `add()` (Zeile 125-147) und `findWithin()`
   (Zeile 242-244) prüfen ihre AABB nur auf Endlichkeit; eine AABB, deren Zellen aus `#cellsOf()`
   jenseits von `±Number.MAX_SAFE_INTEGER` liegen, hängt dort genauso. Eine gemeinsame Prüfung
   der Zellen (`tileLeft`, `tileTop`, `tileLeft + columns`, `tileTop + rows`) nach `#cellsOf()`,
   als
   `RangeError(`Map2DSpatialHashGrid: ${what} reaches into cells beyond ±Number.MAX_SAFE_INTEGER, got left ${describeValue(left)}, top ${describeValue(top)}, width ${describeValue(width)}, height ${describeValue(height)}`)`
   mit `what` wie in `assertFiniteAABB()` (Zeile 38-44: `'the aabb of a renderable'`,
   `'the aabb of findWithin()'`). `add()` prüft vor dem ersten
   Umzug, wie bisher. Nur Arithmetik auf dem Pfad, Allokation nur im Fehlerfall; die
   map2d-Allocation-Specs bleiben grün. Specs: `getTiles(NaN, 0)`, `getTiles(2 ** 53, 0, 2, 1)`,
   `findWithin()` und `add()` mit `left: 2 ** 60` werfen (vor dem Fix: der Test hängt — ihn mit
   kurzem Timeout schreiben, damit der rote Lauf endet).
c) `RepeatingTilesProvider`-Konstruktor (`RepeatingTilesProvider.ts:90-102`): heute wird
   `[[], [1, 2]]` still zur leeren Karte, die der Setter `tileIds` ablehnt. Neue Zuordnung:
   `undefined`/`null` und `[]` → Muster ohne Zellen (`[[]]`, wie dokumentiert); eine Zahl →
   `[[n]]` über den Setter; ein Array, dessen Elemente alle Arrays sind → über den Setter (der
   prüft Zeilenlängen und Ids); jedes andere Array → als eine Zeile über den Setter (der lehnt
   eine Nicht-Id mit Zeile und Spalte ab); alles andere →
   `TypeError('RepeatingTilesProvider: a tile id pattern is a tile id, a row of tile ids or an array of such rows, got …')`.
   Kommentar Zeile 98-99 entsprechend. Specs: `[[], [1, 2]]` wirft die Zeilenlängen-Meldung,
   `'abc'` den `TypeError`, `['x']` den `RangeError` des Setters, `[]` und `undefined` geben 0.
d) `parseAnchorPosition()` und `calculateAnchorOffset()` (`fitIntoRectangle.ts:128-185`): eine
   Konstante mit den zehn Werten von `AnchorPosition` (Zeile 30-40), typgeprüft gegen den Typ,
   und ein interner Helfer `checkAnchorPosition(value, subject)`: `undefined` geht durch, alles
   andere außerhalb der Liste →
   `TypeError(`${subject}: anchorPosition must be 'top left', 'top center', 'top right', 'center left', 'center', 'center center', 'center right', 'bottom left', 'bottom center' or 'bottom right', got ${describeValue(value)}`)`
   — die Werte als Text in einfachen Anführungszeichen, wie `transitionEffects.ts:235`, aus der
   Konstante gebaut. Subjekt
   `parseAnchorPosition` bzw. `calculateAnchorOffset` (Funktion beim bloßen Namen); die zweite
   prüft vor dem Parsen. Specs in `fitIntoRectangle.spec.ts`: `'middle'` wirft in beiden.
e) `SpriteResources#setUniform()` (`SpriteResources.ts:299-309`): nach der Formprüfung jede der
   `size` Komponenten inline mit `Number.isFinite` prüfen (Kommentar: heißer Pfad, ohne Helfer
   und ohne Allokation); sonst `TypeError` im Wortlaut der Startwertprüfung (Zeile 172-174):
   `${this.#where}: the uniform "v3" is a vec3 and takes 3 finite numbers, got …` — das
   Komponenten-Array für `describeValue()` wird erst im Fehlerfall gebaut. Der Uniform behält
   seinen Wert. Specs: `setUniform('v3', 1, undefined, 3)` und `setUniform('f', NaN)` werfen;
   `src/sprites/hot-path-allocations.spec.ts` bleibt grün.
f) `frameNameQuery` als ungültiger regulärer Ausdruck:
   - `TextureAtlas#frameNames(match)` (`TextureAtlas.ts:139-151`): `new RegExp(match)` für einen
     String in `try`/`catch`, sonst
     `SyntaxError(`TextureAtlas#frameNames(): the pattern ${describeValue(match)} is no valid regular expression: ${message}`, {cause})`.
   - `FrameBasedAnimations#add()`, Atlas-Zweig (`FrameBasedAnimations.ts:497-519`): einen
     String-Query vor `atlas.frameNames()` prüfen, sonst
     `SyntaxError(`FrameBasedAnimations: add() got a frameNameQuery of ${describeValue(query)} for the animation ${animNameInError(name)} — it is no valid regular expression: ${message}`, {cause})`
     — im Stil der Meldung Zeile 503-505.
   - Der Katalogweg geht über `add()` (`TextureResource.ts:1757`) und meldet den Fehler als
     `error`-Event `{source: 'frameBasedAnimations', …}`, die übrigen Einträge werden registriert.
     TSDoc-Liste in `TextureResource.ts:111-120` und `FrameBasedAnimationsDataByAtlas.frameNameQuery`
     (`texture/types.ts:28-35`) um den Fall ergänzen.
   - Specs: `FrameBasedAnimations.spec.ts` (`'walk['` → `SyntaxError` mit Animationsnamen und
     `cause`), `TextureAtlas.spec.ts`, und ein Katalogfall in `TextureResource.spec.ts`.

### 8. CHANGELOG

Skill `updating-changelog` laden. Unter `## [Unreleased]`: `### Fixed` für Schritt 1, 2 und 4;
`### Changed` für Schritt 5, 6 und 7 (je Klasse ein Eintrag, der sagt, was jetzt abgelehnt wird
und womit); der `FramePacer`-Eintrag unter `### Added` für Schritt 3. Die Migrations-Prüfung des
Skills für die Verhaltensänderungen aus 6 und 7 (Breaking, Entscheidung 1 im Plan).

### 9. Doku, die jetzt lügt

Nach den Schritten jeden geänderten Namen in `packages/twopoint5d/docs/`, `apps/lookbook/` und
den TSDoc-Blöcken suchen (`grep -rn`): `maxFps`, `targetFps`, `minScale`, `maxScale`,
`maxStepsPerFrame`, `DefaultFps`, `mouseButton`, `getTiles`, `RepeatingTilesProvider`,
`anchorPosition`, `setUniform`, `frameNameQuery`, `onError`, `shouldDraw`, `Chronometer`. Jede
Aussage, die jetzt nicht mehr stimmt (»counts as …«, »is ignored«, »anything but …«), wird
angepasst; Code-Blöcke mit `ts check` bleiben kompilierbar. Lookbook-Aufrufer mit einem jetzt
abgelehnten Wert werden mitgezogen.

## Abgleich (Zug 0, 2026-11-18, gegen d3ac1326)

- **BUG-003** unverändert: `Display.ts:2085-2086` (`handBack` nur für `#callersCanvas`),
  `canvasHandover.ts:390-393` (`disposeLosingContext()`), `:412-419` (`canvasReleases` nur bei
  `handBack`); three 0.187.0 bestätigt (`WebGLBackend.js:2865-2868`). Offene Frage 1 ist
  entschieden (Plan, »Entscheidungen«).
- **BUG-004** unverändert: `AdaptiveResolution.ts:410`, `:451-456`.
- **BUG-009** unverändert: `FramePacer.ts:154`, `:273`. Das Proposal nennt den Versatz Vertrag
  (`drawing-on-demand.md` §3.3, §4.2, §4.6), und `CameraRig.spec.ts:2455-2494` prüft ihn — beide
  werden mitgezogen.
- **BUG-010** unverändert: `Chronometer.ts:167-175`, `:193-208`; das Beispiel des Audits
  nachgerechnet (12 gegen 10).
- **CONS-003** unverändert: `Display.ts:1198-1202`; Vorbild `:1095-1098`.
- **CONS-001** an allen Fundstellen unverändert, Zeilen leicht verschoben: Display
  `Display.ts:1058-1060` und `:1117`; `AdaptiveResolution.ts:241`; `FixedFrameLoop.ts:157-189`
  (Setter) und `:238-246` (Konstruktor); `FrameLoop.ts:313-334` und `FramePacer.ts:144` werfen
  bereits (Vorbilder der Regel); `PanControl2D.ts:224`, `:325`; `Map2DSpatialHashGrid.ts:258-271`;
  `RepeatingTilesProvider.ts:90-102`; `fitIntoRectangle.ts:128-136`, `:148-185`;
  `SpriteResources.ts:299-309`; `FrameBasedAnimations.ts:497-519`; `TextureAtlas.ts:139-151`;
  `texture/types.ts:28-35` (nur Doku).

## Triage und Entscheidungen in Zug 0

- `Folgen:` der erledigten Pakete 1 und 2: keine. Der einzige Eintrag in »Offene Befunde«
  (Playwright-Versionen in `docs/architecture.md`) hat eine andere Ursache und bleibt liegen.
- Nebenbefunde gleicher Ursache wie CONS-001, ins Paket genommen (alle vorbestehend, in
  d3ac1326 so vorhanden): `minScale`/`maxScale` von `AdaptiveResolution` (6c), `maxStepsPerFrame`
  und die Statics `DefaultFps`/`DefaultMaxStepsPerFrame` von `FixedFrameLoop` (6d), die
  2^53-Grenze in `add()`/`findWithin()` von `Map2DSpatialHashGrid` (7b), Nicht-Array-Formen im
  Konstruktor von `RepeatingTilesProvider` (7c). Grund: dieselbe Klasse, dieselbe Regel; eine
  halb durchgezogene Regel in einem Optionsobjekt ist der Befund des nächsten Audits.
- Nicht ins Paket, nach »Offene Befunde« mit `→ Rückfrage`: die Laufzeitfelder `pixelZoom`,
  `maxPixelRatio`, `maxPixels`, `resolutionScale` von `Display` (`Display.ts:567`, `588`, `611`,
  `626`), die Optionen `maxPixelRatio`/`maxPixels` (`types.ts:113-126`) und `maxDeltaTime` von
  `Display`/`Chronometer` zählen einen ungültigen Wert dokumentiert als `0` bzw. `1`. Das ist eine
  bewusste Semantik für Werte, die eine App je Frame aus dem Layout rechnet (etwa im
  `resizeTo`-Callback); Werfen kehrt sie um. Nach diesem Paket werfen die Raten, die Maße nicht —
  das entscheidet der Nutzer im Abschluss.
- Paket nicht geteilt: die Schleife findet das Paket über die Nummer 3, und die Teile teilen sich
  CHANGELOG, Guide und Testlauf; ein Implementierer auf der stärksten Stufe trägt beides.
- Modell stärkste Stufe, Effort `high`: WebGL-Kontext und Release-Timing (BUG-003), öffentliche
  API in sechs Modulen mit Breaking Changes, Hot Paths unter Allocation-Specs.
- Restplan geprüft: keine Änderung an Reihenfolge oder Schnitt. Paket 4 baut auf dem
  `mouseButton`-Accessor auf (CONS-002, BUG-005 betreffen die Tastatur), Paket 6 zerlegt
  `FrameBasedAnimations#add()` (READ-006) nach der Query-Prüfung, Paket 7 bekommt die
  Zellprüfung in `add()` (API-007), Paket 10 hängt weiter von 3 ab.

## Schnittstellen aus erledigten Paketen, die dieses Paket braucht

- `readTargetPixels(renderer, target)` in `packages/twopoint5d-testing/test/helpers/fixtures.js`
  für jedes Zurücklesen eines Ziels; ein neuer Helfer dort braucht JSDoc-Typen
  (`tsconfig.helpers.json`, `noImplicitAny`).
- `EXPECTED_SKIPS` in `web-test-runner.config.js`: ein neuer `this.skip()` braucht dort seinen
  Eintrag, sonst ist `pnpm test:browser` rot. Die Tests aus Schritt 1 skippen nicht.

## Verlauf

- 2026-11-18 Zug 0: Detailplan steht · BUG-003, BUG-004, BUG-009, BUG-010, CONS-003 unverändert ·
  CONS-001 an allen 17 Fundstellen unverändert (Zeilen verschoben, s. Abgleich) · vier
  Nebenbefunde gleicher Ursache ins Paket (6c, 6d, 7b, 7c) · ein Nebenbefund `→ Rückfrage` nach
  »Offene Befunde« (Laufzeitfelder von `Display`/`Chronometer`) · keine Folgen zu verteilen ·
  Restplan unverändert
- 2026-11-18 Zug 1: Implementierer beauftragt (Runde 0, opus, effort high), Brief `paket-3.impl-0.brief.md`, Report nach `paket-3.impl-0.json`
- 2026-11-18 Zug 2: Report FERTIG · 40 Dateien geändert (Quelle, Specs, Browser-Test, CHANGELOG, 6 Guides), keine neuen · rote Läufe für Schritte 1–7 belegt · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-3.verify.log`)
- 2026-11-18 Zug 3: Reviewer (opus, high) · alle Findings behoben (BUG-003, BUG-004, BUG-009, BUG-010, CONS-003, CONS-001 6a–7f) · nachbessern: 2 × wichtig (fehlendes `!` in der Commit-Message — vom Runner in der Paketdatei korrigiert; Rückblick »no longer« in `CHANGELOG.md:57`), 4 × klein · Diff `paket-3.diff`, Report `paket-3.review-0.json`
- 2026-11-18 Zug 4 Runde 1: offen 1 × wichtig (CHANGELOG-Rückblick) + 3 × klein mitgegeben · Resume des Implementierers (Session f91d1bf4, opus/high), Brief `paket-3.impl-1.brief.md`, Report nach `paket-3.impl-1.json`
  - Runde 1 zurück: FERTIG · `CHANGELOG.md`, `FixedFrameLoop.ts`, `resource-lifecycle.md`, `Display.ts` (TSDoc Konstruktor/`dispose()`) · Verify `pnpm run ci` exit=0 (`paket-3.verify-1.log`) · Diff `paket-3.diff-1`, gezielter Reviewer (sonnet, medium) nach `paket-3.review-1.json`
  - Review Runde 1: freigeben · Befunde 1–5 erledigt, 6 (Lage des Abschnitts in `display.md`) darf bleiben · neu 2 × klein (Umbruch `resource-lifecycle.md:55-57`; Absatz »A `dispose()` while the renderer is still initializing« nur verschoben — vom Runner gegen d3ac1326 geprüft, wortgleich) · Fortschritt: alle offenen Befunde erledigt, keiner zurück
- 2026-11-18 Zug 5: committet als 7e8d5b14 (40 Dateien, `Remediation-Run: 2026-11-17`) auf Verify-Lauf `paket-3.verify-1.log` (exit=0, keine Änderung seither) · 1 Runde

## Urteil des Reviewers (Review 0, `paket-3.review-0.json`; Nachprüfung `paket-3.review-1.json`)

- **BUG-003** behoben: `Display.ts:998` setzt `#callersCanvas` auch auf dem Renderer-Pfad; Browser-Tests `display-dispose.test.js:517-563` unter allen vier Launchern ohne Skip; TSDoc, `resource-lifecycle.md:54-59`, `display.md:1226ff`, CHANGELOG.
- **BUG-004** behoben: Probe `AdaptiveResolution.ts:453` nach dem Settle-Return, Wechsel samt `#resetTries()`/`#settle()` `:507-512`, Epoche verwirft alte Messungen; Hot-Path-Spec, TSDoc, Guide.
- **BUG-009** behoben: `FramePacer.ts:299ff`, `:396ff`, Frame-Identität über Objekt und `frameNo`, Marke vor dem Lauf gesetzt; `CameraRig.spec` auf `extraDraws: 0`; Proposal §3.1/§3.3/§4.2/§4.6/§5.2/§11 und Guide.
- **BUG-010** behoben: `Chronometer.ts:160-170`, `#pausedAt` entfällt, beide Pfade im Spec.
- **CONS-003** behoben: `Display.ts:1216` mit Kommentar; Retain und werfender Listener in `Display.spec`.
- **CONS-001** behoben an allen Stellen: 6a `Display.ts:972`, 6b `AdaptiveResolution.ts:250`, 6c `:251-252`, 6d `FixedFrameLoop.ts:169`, `:184`, `:236-250`, 6e Specs umgestellt, 7a `PanControl2D.ts:320`, 7b `Map2DSpatialHashGrid.ts:49`, `:153`, `:273`, `:307`, 7c `RepeatingTilesProvider.ts:89-110`, 7d `fitIntoRectangle.ts:150`, 7e `SpriteResources.ts:317`, 7f `TextureAtlas.ts:152`, `FrameBasedAnimations.ts:516`, Katalogfall in `TextureResource.spec`.
- **Offene Frage 1** umgesetzt wie entschieden (mit BUG-003).

Kleine Befunde (stehen gelassen):
- `docs/display.md:1226`: »The canvas after `dispose()`« steht unter »## Reference« zwischen Takt- und Auflösungsthemen; eigener Abschnitt, vom CHANGELOG verlinkt, darf bleiben.
- `docs/resource-lifecycle.md:55-57`: unregelmäßiger Umbruch nach »a new«.
- Erledigt in Runde 1: Rückblick »no longer« im CHANGELOG (wichtig), »throws as before« in `FixedFrameLoop.ts`, missverständliches »is not taken over either« in `resource-lifecycle.md` (auch im TSDoc von Konstruktor und `dispose()` klargestellt), überlange TSDoc-Zeile in `Display.ts`; fehlendes `!` in der Commit-Message (wichtig) hat der Runner in dieser Datei korrigiert.

Abweichungen des Implementierers vom Detailplan (vom Reviewer ohne Befund geprüft): `#ranFrame` wird auch beim Überspringen eines vorgezogenen Frames gesetzt (sonst liefen die Steps bei zweitem `shouldDraw()` doppelt); Specs mit geteiltem Props-Objekt ohne `frameNo` bekommen eigene Objekte bzw. zählen `frameNo`; 7b-Regressionstest endete rot mit »did not throw« statt zu hängen (Grids mit einer Zelle); `''` und `null` als Anker werfen.

Nebenbefunde aus Zug 2, Urteilsbegründung: alle fünf in d3ac1326 so vorhanden (geprüft per `git show`). Die Nachsicht von `fitIntoRectangle()` bei `pixelZoom`/`minPixelZoom`/`maxPixelZoom` ist dieselbe bewusst dokumentierte Semantik wie bei den Display-Maßen → Rückfrage. `firstTileId` (2^53-Schleife), Zeilenprüfung des `tileIds`-Setters, `keys`/`keyCodes` von `PanControl2D` und `#shapeError()` ohne `got …` fallen unter die Scope-Regel (alles), haben aber keine gemeinsame Ursache mit einem offenen Paket, das sie zwingend mitnehmen müsste → Scope (Drain-Runde; Paket 4 berührt `PanControl2D`, Paket 6 `FrameBasedAnimations`, Paket 7 `RepeatingTilesProvider` und `SpriteResources`).

## Findings im Volltext

**BUG-003 · medium · packages/twopoint5d/src/display/Display.ts:2086** (auch
`canvasHandover.ts:390`, `:412`) — Release eines übernommenen Renderers für die Canvas registrieren

`handBack` ist nur für eine Canvas wahr, die als erstes Argument kam (`#callersCanvas`, gesetzt nur
im CANVAS-Zweig des Konstruktors). Die `domElement`-Canvas eines übernommenen `WebGPURenderer`
bleibt aber ebenso beim Aufrufer. Für sie steht kein Eintrag in `canvasReleases`, also wartet ein
neuer Display auf derselben Canvas nicht (`waitForCanvas()` liefert `undefined`) und startet sein
`init()` sofort. Unter dem WebGL-Backend teilen sich beide Renderer den einen WebGL-Kontext der
Canvas; die nachlaufende Release des alten Renderers ruft `disposeLosingContext()` →
`extension.loseContext()` auf genau diesem Kontext auf (three 0.187 gibt ihn bei übergebener
Canvas nicht selbst ab, `WebGLBackend.dispose()` prüft `parameters.canvas === undefined`).
Ergebnis: der neue Display verliert seinen Kontext direkt nach dem Init. Realistischer Pfad: React
StrictMode mit selbst gebautem Renderer auf einem Canvas-Ref (mount → dispose → mount), auf
Geräten ohne WebGPU.

Beleg: `const handBack = canvas != null && renderer.domElement === canvas;` — `canvas` ist
`this.#callersCanvas`, für einen übernommenen Renderer `undefined`;
`if (!handBack) { await disposeLosingContext(renderer); return; }`

Empfehlung: Jede Canvas, die nach dem Dispose beim Aufrufer bleibt — auch die eines übernommenen
Renderers, dessen Backend sie nicht selbst gebaut hat —, in `canvasReleases` eintragen und mit
`disposeKeepingContextRestorable()` übergeben. Einen Spec ergänzen: `new Display(rendererA)`,
`dispose()`, sofort `new Display(rendererB)` auf derselben Canvas unter WebGL — B behält seinen
Kontext.

**BUG-004 · medium · packages/twopoint5d/src/display/AdaptiveResolution.ts:452** (auch `:410`) —
Wechsel von gpu-time auf frame-pacing nicht endgültig machen

Nach 60 Frames ohne gültige GPU-Zeit setzt `#sampleGpuTime()` `#method = 'frame-pacing'`, und
`#method ??=` stellt es nie zurück — auch nicht nach Restart oder Resize. three 0.187 legt den
Timestamp-Query-Pool erst beim ersten Render-Pass an (`Backend.resolveTimestampsAsync()` gibt ohne
Pool `undefined` zurück). Ein Display, dessen Frame-Handler in den ersten ~90 Frames nach dem Start
(30 Settle + 60) nichts zeichnet — Ladebildschirm, Assets per `getAsync()` im Frame-Handler —,
verliert die GPU-Zeitmessung damit für immer und läuft auf dem laut Guide schwächeren
`frame-pacing`, das CPU und GPU nicht unterscheiden kann.

Beleg: `if (this.#gpuSilentFrames > GPU_SILENT_FRAMES) { this.#method = 'frame-pacing'; … }` und
`this.#method ??= this.#tracksGpuTime() ? 'gpu-time' : 'frame-pacing';`

Empfehlung: Stille Frames erst ab der ersten gültigen Messung zählen, oder nach dem Rückfall bei
`#settle()` (Start, Restart, Resize) erneut `gpu-time` versuchen, solange `#tracksGpuTime()` wahr
ist. Spec: Renderer mit Timestamps, der erst nach 120 Frames misst, endet bei
`method === 'gpu-time'`.

**BUG-009 · low · packages/twopoint5d/src/display/FramePacer.ts:154** (auch `:273`) — Reihenfolge
von Frame-Steps und shouldDraw() absichern

Die Steps laufen in einem eigenen `onRenderFrame`-Abonnement des Pacers, `shouldDraw()` im
Frame-Handler der App. Ob die Steps eines Frames vor dessen `shouldDraw()` laufen, hängt allein
davon ab, ob der Pacer vor dem Frame-Handler gebaut wurde. Abonniert die App zuerst
`display.onRenderFrame(draw)` und baut den Pacer danach, fragt `shouldDraw()` vor den Steps: jeder
Report zählt erst im nächsten Frame, und gezeichnet wird stets der Zustand des Vorframes — eine
Frame Latenz, ohne Fehlermeldung. Guide und TSDoc nennen die Reihenfolge nicht; die Beispiele bauen
den Pacer nur zufällig zuerst.

Beleg: `this.#unsubscribes.push(source.onRenderFrame(this.#runSteps));` — Abonnement mit
Standardpriorität in Konstruktionsreihenfolge

Empfehlung: Entweder die Steps mit hoher Priorität abonnieren (z. B. optionaler Prioritätsparameter
in `FramePacerSource.onRenderFrame`, für `Display` `Priority.High`) oder `shouldDraw()` noch nicht
gelaufene Steps des Frames zuerst ausführen lassen; mindestens die Regel in TSDoc und
`docs/display.md` festhalten und per Spec prüfen.

**BUG-010 · low · packages/twopoint5d/src/display/Chronometer.ts:201** — Zeit zwischen letztem
update() und stop() einheitlich verbuchen

Die Spanne zwischen dem letzten `update()` und `stop()` zählt je nach Verlauf der Pause verschieden:
Ohne `update()` in der Pause schließt `start()` nur `now - #pausedAt` als verlorene Zeit, die Spanne
davor wird nachträglich aktive Zeit — `time` springt beim Start, während `deltaTime` 0 meldet. Mit
einem `update()` in der Pause verbucht dieses die Spanne ab `#currentTime` als verloren, und
`start()` klemmt den `gap` auf 0. Beispiel: update(10), stop(12), start(15) ergibt 2 s mehr `time`
als update(10), stop(12), update(15), start(15). Im Display ist die Spanne kleiner als ein Frame,
für Nutzer der exportierten Klasse mit eigenen Zeiten beliebig groß.

Beleg: `const gap = Math.max(0, now - this.#pausedAt - this.#recentlyLostTime);` —
`#recentlyLostTime` zählt ab `#currentTime`, `#pausedAt` liegt dahinter

Empfehlung: In `stop()` die Spanne bis `#pausedAt` entscheiden (als aktiv in `#currentTime`
übernehmen oder als verloren buchen) und `update()` in der Pause erst ab `#pausedAt` zählen lassen;
Spec für beide Pfade mit gleichem Ergebnis.

**CONS-003 · low · packages/twopoint5d/src/display/Display.ts:1201** (auch `:1098`) —
OnDisplayError über emitSafe() senden

`OnDisplayError` geht aus einer Promise-Fortsetzung ohne Aufrufer mit `emit()` hinaus. Ein
Listener, der wirft, nimmt allen Listenern hinter ihm den Fehler und erzeugt eine Unhandled
Rejection der `.catch()`-Kette. Für `OnDisplayFullscreenChange` begründet der Code genau diese Lage
mit `emitSafe()` (»none of them has a caller the error would belong to«) — derselbe Fall wird
zweimal verschieden behandelt.

Beleg: `this.#waitForRenderer.catch((error) => { emit(this, OnDisplayError, error, this); });`

Empfehlung: `emitSafe(this, OnDisplayError, error, this)` verwenden und im TSDoc von `onError`
festhalten, dass jeder Listener den Fehler hört.

**CONS-001 · low · packages/twopoint5d/src/display/FrameLoop.ts:314** (auch
`FramePacer.ts:144`, `FixedFrameLoop.ts:187`, `Display.ts:1060`, `AdaptiveResolution.ts:241`,
`controls/PanControl2D.ts:325`, `:224`, `map2d/Map2DSpatialHashGrid.ts:260`,
`stage/fitIntoRectangle.ts:134`, `:160`, `:173`, `sprites/FeatureSprites/SpriteResources.ts:301`,
`:307`, `map2d/RepeatingTilesProvider.ts:90`, `texture/FrameBasedAnimations.ts:517`,
`texture/TextureAtlas.ts:143`, `texture/types.ts:35`) — Eingaben öffentlicher APIs durchgehend
nach der Projektregel prüfen statt still zu übergehen

Die Library verweigert ungültige Eingaben fast überall mit benannten Fehlern aus den
`assert*`-Helfern. An sieben Stellen fehlt das, und ein Tippfehler bleibt stumm:

- **display**: eine fps-Rate wird nach drei Regeln geprüft — `FrameLoop`/`FramePacer` werfen,
  `FixedFrameLoop` ignoriert still, `Display` macht aus `maxFps` still `0`, `AdaptiveResolution`
  aus `targetFps` still `60`.
- **controls**: `PanControl2D#mouseButton` ist ungeprüft; `0` oder `'1'` aus einer Config schaltet
  das Maus-Panning stumm ab.
- **map2d**: `Map2DSpatialHashGrid#getTiles()` prüft `tileX`/`tileY` nicht (NaN gibt still nichts,
  ab 2^53 hängt die Zellschleife); `RepeatingTilesProvider` macht aus `[[], [1, 2]]` still eine
  leere Karte, die der Setter `tileIds` ablehnen würde.
- **stage**: `calculateAnchorOffset()` castet `split(' ')` ungeprüft; ein unbekannter Anker lässt
  `target` stillschweigend unverändert.
- **sprites**: `setUniform('v3', 1, undefined, 3)` schreibt `undefined` in den Vektor, NaN geht
  durch.
- **texture**: ein ungültiges `frameNameQuery` im Katalog kommt als roher `SyntaxError` ohne
  Animationsnamen an.

Empfehlung: Je Stelle die passenden Helfer aus `src/utils/` (`assertFinite`, `assertWholeNumber`,
`assertFiniteAtLeast`) bzw. ein `TypeError` mit `describeValue()` einsetzen; auf heißen Pfaden
(`setUniform`) inline mit `Number.isFinite` prüfen, wie AGENTS.md es vorsieht. Für die Raten im
Display-Modul eine Regel festlegen (bevorzugt: werfen) und die Änderung im CHANGELOG als
Verhaltensänderung führen.
