# Paket 14 — Drain: Display, Stage2D, Allocation-Spec der adaptiven Auflösung und die Doku der Browser-Matrix

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen — sechs vorbestehende Nebenbefunde aus »Offene Befunde«
  (Allocation-Spec unter frame-pacing, `Display#stop()` nach `dispose()`, TSDoc an
  `Display#isFirstFrame`, `#emit` nicht `readonly`, TSDoc an `Stage2D` und an den
  Clear-Flags des `StageRenderer`, Messstand der Browser-Matrix); low und info. Die
  veralteten Exporte sind in Zug 0 nach Paket 14b abgeteilt.
- Ziel: `Display` hält die Zusage von `stop()` nach dem Dispose, Display, Stage2D und die
  Clear-Flags des StageRenderer sind dokumentiert, ein Frame der adaptiven Auflösung unter
  frame-pacing reicht keinen Bruch über einen Aufruf und bleibt allokationsfrei, wie V8 auch
  inlint, und die Doku der Browser-Matrix nennt, womit gemessen wurde.
- Modell: stärkste Stufe — die Allocation-Spec hängt an einer Inlining-Entscheidung von V8
  und braucht eine neue Mess-Technik, und `Display#stop()` hat eine Falle im Dispose-Pfad
  (Schritt B1); beides geht mit einem schwächeren Modell leicht in die falsche Richtung.
- Effort: medium — die Schritte stehen mit Namen und Zeilen fest, die öffentliche API
  ändert sich nicht.
- Dateien:
  - `packages/twopoint5d/src/display/AdaptiveResolution.ts`
  - `packages/twopoint5d/src/display/hot-path-allocations.adaptive-resolution.spec.ts`
  - neu `packages/twopoint5d/src/display/hot-path-allocations.adaptive-resolution-uninlined.spec.ts`
  - neu `packages/twopoint5d/src/testing/adaptiveResolutionRound.ts`
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `docs/architecture.md`
  - `packages/twopoint5d/CHANGELOG.md` (ein Eintrag unter `### Fixed`)
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): keep a frame of AdaptiveResolution under frame-pacing free of allocations wherever V8 inlines its calls or not, let Display#stop() do nothing after dispose(), document the public members of Display, Stage2D and StageRenderer that went without a word, and name the browsers the browser matrix was measured with`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · Allocation-Spec: Test jetzt
    `hot-path-allocations.adaptive-resolution.spec.ts:86–96` (Paket 3 hat `noMeasurement` und
    einen dritten Test ergänzt), Ursache vorbestehend und deterministisch belegt (Sonde
    `…/25b68af0-…/scratchpad/paket-14.zug0-probe/RESULTS.txt`: ohne Inlining 16,02 B je Aufruf in
    Basis und HEAD, mit dem Fix 0,02) · `Display#stop()` unverändert `Display.ts:1327`,
    `isFirstFrame` `:508`, `#emit` `:1507` · Stage2D unverändert, verschoben: `name` `:137–143`,
    `containerWidth` `:149`, `containerHeight` `:153`, `projection` `:190–222`, `isFirstFrame`
    `:492`; Clear-Flags jetzt `StageRenderer.ts:204–206` (Paket 11b hat die Datei geteilt) ·
    Browser-Matrix unverändert, verschoben nach `docs/architecture.md:265, 274, 276` · veraltete
    Exporte nach Paket 14b abgeteilt · keine offenen Folgen erledigter Pakete
  - 2026-11-18 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-14.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG · geändert `AdaptiveResolution.ts`, `hot-path-allocations.adaptive-resolution.spec.ts`, `Display.ts`, `Stage2D.ts`, `StageRenderer.ts`, `CHANGELOG.md`, `docs/architecture.md`; neu `testing/adaptiveResolutionRound.ts`, `hot-path-allocations.adaptive-resolution-uninlined.spec.ts` · roter Lauf 16,01/16,02 B je Aufruf · Arbeitsbaum schmutzig · eigener Verify `pnpm run ci` exit=0 (`paket-14.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (opus, effort medium) FREIGABE, alle sechs Findings behoben, drei kleine Befunde · Diff `paket-14.diff`, Report `paket-14.review-0.json`
  - 2026-11-18 Zug 4: keine Runde (nichts offen außer kleinen Befunden)
  - 2026-11-18 Zug 5: committet `ea6b44f9` auf dem Verify-Lauf aus Zug 2 (`paket-14.verify.log`, exit=0; seither keine Codeänderung)

## Vorgehen

Vier Teile, in dieser Reihenfolge. Teil A ist ein Bugfix: Regressionstest zuerst, roter
Lauf in den Report, dann der Fix.

### Teil A — AdaptiveResolution: kein Bruch über eine Aufrufgrenze

**Befund.** `#onRenderFrame` (`AdaptiveResolution.ts:430–461`) reicht im frame-pacing-Zweig
das `rawDeltaTime` des Frames — einen Bruch, im Spec `1 / 60` — an die private Methode
`#readRafInterval(rawDeltaTime, fromLoop)` (`:458`, Methode `:562–568`) weiter. Lässt V8
diesen Aufruf un-inlined, boxt es den Bruch in eine HeapNumber: 16 B je Frame. Ob V8 inlint,
hängt am Inlining-Budget und an der Last der Maschine; darum war Test 2 der Spec (`:86–96`)
unter `pnpm nx run-many -t allocations --skip-nx-cache` in 2 von 4 Läufen rot (16,02 B je
Aufruf) und allein grün. Belegt in Zug 0 mit einer Sonde gegen `dist` (Ergebnisse und
Skripte unter
`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/25b68af0-a25d-4ede-b583-3d06a691b428/scratchpad/paket-14.zug0-probe/`):
mit abgeschaltetem Inlining misst die Runde in HEAD und in der Basis `2e3f585b` 16,02 B je
Aufruf, mit `rawDeltaTime = 0` (Smi) 0,01; mit der Zuweisung direkt in `#onRenderFrame` 0,02.
Der Aufruf stand schon in der Basis (`git show 2e3f585b:…/AdaptiveResolution.ts:429`) —
vorbestehend, kein Fehler von Paket 3. Es ist eine echte Allokation im Hot Path einer
Anwendung (ihr `rawDeltaTime` ist in jedem Frame ein Bruch), kein Messartefakt: der Fix gehört
in die Library, nicht in den Spec.

**A1. Gemeinsame Runde als Helfer.** Neu `packages/twopoint5d/src/testing/adaptiveResolutionRound.ts`
(`src/testing/` erreicht `dist/` nie und ist aus der Coverage ausgenommen). Aus
`hot-path-allocations.adaptive-resolution.spec.ts` ziehen dorthin um, unverändert im Verhalten
und mit ihren Kommentaren: `CALLS`, `GPU_MS`, `measurement`, `noMeasurement` und `makeRound`.
`makeRound` wird als `makeAdaptiveResolutionRound(frameListeners, timestamps, answer = measurement)`
exportiert; der erste Parameter ist das Array, in das der `vi.mock` des Specs die Listener legt
(`readonly ((props: DisplayEventProps) => void)[]`), sonst bleibt der Körper gleich, die
Prüfung des Listeners bleibt ein `expect(…)` aus `vitest`. TSDoc an der Funktion: was sie baut
(Controller auf einem Display-Double, eine Runde von `CALLS` Frames im Takt von 60 Bildern je
Sekunde) und dass der Spec den Listener über seinen eigenen `vi.mock` von `@spearwolf/eventize`
fängt. `BYTES_PER_CALL_LIMIT` und der `vi.mock` bleiben in jedem Spec. Die bestehende Spec
importiert den Helfer; ihre drei Tests bleiben wortgleich.

**A2. Regressionstest.** Neu
`packages/twopoint5d/src/display/hot-path-allocations.adaptive-resolution-uninlined.spec.ts`
(der Name passt auf `src/**/hot-path-allocations*.spec.ts`, läuft also im Vitest-Projekt
`allocations`):

- derselbe `vi.hoisted`/`vi.mock('@spearwolf/eventize', …)`-Fang wie in der bestehenden Spec
  (`:12–24`);
- `beforeAll`: `setFlagsFromString('--no-turbo-inlining')` und
  `setFlagsFromString('--no-maglev-inlining')` aus `node:v8`; `afterAll` setzt
  `--turbo-inlining` und `--maglev-inlining` zurück. Zur Laufzeit gesetzt wirken die Flags
  (Sonde: 16,01 B je Aufruf); `--execArgv` der Vitest-CLI erreicht die Worker dagegen nicht
  (in Zug 0 selbst `--jitless` wirkungslos), die Vitest-Config bleibt unberührt;
- zwei Tests mit den Runden der bestehenden Tests 2 und 3, je mit `measureSettledBytes()` und
  `toBeLessThan(BYTES_PER_CALL_LIMIT)`:
  - `a frame under frame-pacing allocates nothing where V8 inlines no call` —
    `makeAdaptiveResolutionRound(frameListeners, false)`;
  - `a frame under frame-pacing that still asks for GPU time allocates nothing where V8 inlines no call` —
    `makeAdaptiveResolutionRound(frameListeners, true, noMeasurement)` mit der Vorrunde und
    dem `expect(adaptive.method, 'before the round').toBe('frame-pacing')` wie Test 3;
- ein Kopfkommentar, *warum* die Datei existiert, ohne Rückblick: V8 boxt einen Bruch, den es
  an einen Aufruf reicht, den es un-inlined lässt; welche Aufrufe es inlint, verschiebt sich
  mit dem Inlining-Budget und der Last der Maschine, sodass die Spec daneben einen solchen
  Bruch nur in manchen Läufen sieht; ohne Inlining zeigt ihn jeder Lauf. Eine Datei für sich,
  weil Flags zur Laufzeit für den ganzen Worker-Prozess gelten und Code, den V8 vorher
  optimiert hat, nicht neu übersetzt wird.

Rot vor dem Fix, aus `packages/twopoint5d`:
`pnpm exec vitest --run --project allocations src/display/hot-path-allocations.adaptive-resolution-uninlined.spec.ts`
(so in Zug 0 für die bestehende Spec gelaufen) — erwartet rund 16 B je Aufruf in beiden Tests. Diese Ausgabe gehört in den Report. Stellt
sich heraus, dass die Flags nach `afterAll` in einer anderen Allocation-Spec nachwirken (Vitest
5.1 startet je Datei einen eigenen Fork, das ist die Annahme), ist das ein Befund für den
Report und kein Grund, die Config zu ändern.

**A3. Fix.** In `#onRenderFrame` ersetzt die Zuweisung den Aufruf `this.#readRafInterval(rawDeltaTime, fromLoop);`
(`:458`); `loop` ist dort schon gelesen (`:437`). Der Kommentar von `#readRafInterval()`
(`:563–565`) zieht mit, dazu ein Satz, warum die Zeile hier steht:

```ts
      // The interval between the animation frames of the page before this frame: a frame maxFps
      // held back is no late frame. A frame the frame loop of the display did not run — a
      // renderFrame() of one's own — has nothing but its own delta. Read here and handed to no
      // method: rawDeltaTime is a fraction, and V8 boxes it at every call it leaves un-inlined
      this.#pacingRafMs = fromLoop && loop.longestRafInterval > 0 ? loop.longestRafInterval : rawDeltaTime * 1000;
```

`#readRafInterval()` (`:562–568`) entfällt samt Abschnittskommentar-Zeile, falls eine nur ihr
gilt (`// --- frame-pacing ---` bleibt, er gilt `#samplePacing()`).

**A4. Grün.** Die neue Spec allein grün, dann
`pnpm nx run-many -t allocations --skip-nx-cache` **einmal** (kein Wiederholen, keine Last
daneben — die Spec mit abgeschaltetem Inlining ist der deterministische Beleg).

**A5. CHANGELOG**, `## [Unreleased]` → `### Fixed`, am Ende der Liste:

> - a frame of `AdaptiveResolution` under `frame-pacing` allocates nothing wherever V8 inlines
>   its calls or not: the delta of the frame, a fraction, is handed to no call that V8 would
>   box it for, 16 bytes a frame

### Teil B — `Display#stop()` nach `dispose()`

**Falle.** `dispose()` setzt `#disposed = true` (`Display.ts:1382`) und ruft *danach*
`this.stop()` (`:1390`), damit ein laufendes Display pausiert und jeder Listener von
`OnDisplayPause` die Pause hört. Ein nacktes `if (this.#disposed) return;` am Anfang von
`stop()` schluckte diese Pause; die Specs `Display.spec.ts:2141`, `:2216` und `:2240` (ein
Pause-Listener, der im Dispose wirft) gingen dann rot.

**B1.** Neue private Methode `#pauseByCaller(): void` mit den drei Zeilen von `stop()`
(`:1328–1330`: `#pauseRequests += 1`, `#stateMachine.pausedByUser = true`,
`#followPauseBeforeStart()`). `stop()` wird zu `if (this.#disposed) return;` plus
`this.#pauseByCaller();`. `dispose()` ruft an `:1390` `this.#pauseByCaller()` statt
`this.stop()`; der Kommentar dort (»a running display pauses here, and every listener of
OnDisplayPause hears it«) bleibt. Der `pause`-Setter (`:1086–1094`) bleibt, wie er ist. Das
TSDoc von `stop()` (»Does nothing after {@link Display.dispose}.«) stimmt danach und bleibt.

**B2. Kein Regressionstest — und das ist kein Versäumnis.** Was `stop()` nach dem Dispose
schreibt, ist privat (`#pauseRequests`, `pausedByUser` der Zustandsmaschine); keine öffentliche
Lesart ändert sich: `pause` antwortet nach dem Dispose ohnehin `true` (`:1080–1084`), `start()`
wirft (`:1286`), `#followPauseBeforeStart()` findet keinen Renderer mehr. Ein Test könnte vor
dem Fix nicht rot sein. Belegt wird die Änderung durch die drei Specs oben, die grün bleiben
müssen. Kein CHANGELOG-Eintrag (kein beobachtbares Verhalten ändert sich).

### Teil C — TSDoc und `readonly`

Ohne Verhaltensänderung, ohne CHANGELOG (wie Paket 13 für TSDoc ohne Verhaltensänderung).
Jeder Text beschreibt, was der Code tut, nichts darüber hinaus; Wortlaut englisch, im Ton der
umgebenden TSDoc.

- **C1. `Display#isFirstFrame`** (`Display.ts:508`): `true` vor dem ersten Frame und während
  des ersten (`frameNo` 1), `false` ab dem zweiten — `renderFrame()` setzt es zu Beginn jedes
  Frames aus `frameNo` (`:1224`, vor dem Hochzählen); ein `renderFrame()` nach dem Dispose tut
  nichts und lässt es stehen.
- **C2. `#emit`** (`Display.ts:1507`) wird `readonly #emit`, wie die übrigen Arrow-Felder.
- **C3. `Stage2D`:**
  - `name` (Getter und Setter `Stage2D.ts:137–143`): der Name der Szene, `scene.name`; der
    Setter schreibt ihn dorthin.
  - `containerWidth`, `containerHeight` (`:149`, `:153`): Breite und Höhe, die das letzte
    `resize()` übergab, `0` bis zum ersten `resize()`. Ob ein `resize()` mit einer Größe, die
    keine endliche Zahl über 0 ist, den Container nimmt oder behält, aus `#updateProjection()`
    ablesen (in Zug 0 nicht geprüft) und genau das schreiben. Wirft die
    Projektion in einem `resize()`, behält die Stage den Container, den sie hatte
    (`resize()` `:336–343`); wirft nur ein Listener, ist der neue Container genommen
    (Kommentar `:346`). Nach `dispose()` tut `resize()` nichts (`:317`), die Werte bleiben.
  - `projection` (Getter `:190`, Setter `:194–222`): eine Zuweisung nach `dispose()` tut
    nichts; eine andere Projektion lässt Größe (`width`/`height` auf 0) und Kamera der
    vorigen fallen, die Kamera angekündigt als die, die sie war, und gibt dann Sicht und
    Kamera der neuen, wenn der Container eine Fläche hat und ihre Specs eine Sicht geben;
    jeder Listener hört seine Ereignisse, auch hinter einem, der wirft, und die Fehler
    erreichen den Aufrufer danach — einer unverändert, mehrere als `AggregateError` mit der
    Meldung von `:217–220`; ein Listener, der die Stage entsorgt oder die Projektion
    wegnimmt, hält die neue Projektion auf (`:207–209`). Dieselbe Zuweisung zweimal tut nichts.
  - `isFirstFrame` (öffentliches Feld `:492`): `true`, bis das erste `updateFrame()`
    `OnStageFirstFrame` gesendet hat, dann `false`, auch wenn dessen Listener warfen
    (`:555–563`); auf `true` zurückgesetzt, sendet das nächste `updateFrame()` das Ereignis
    erneut (so steht es im Code — als Beschreibung, nicht als neue Zusage darüber hinaus).
- **C4. `StageRenderer`-Clear-Flags** (`StageRenderer.ts:204–206`, `clearColorBuffer`,
  `clearDepthBuffer`, `clearStencilBuffer`): je ein Satz, welchen Puffer das eigene Clear des
  Renderers räumt, solange `clear` `true` ist, Voreinstellung `true`; aus dem Code, der sie
  liest (`#clearsWholeTarget()` `StageRenderer.ts:877–884`, `StageRendererDraw.ts:208–210` und
  `:238`, der Kommentar `StageRendererComposition.ts:136`), ablesen,
  was ein `false` bewirkt — etwa, dass ein Clear ohne Farbe oder Tiefe nicht als Clear des
  ganzen Ziels zählt — und das schreiben, wo es den Leser betrifft.

### Teil D — Messstand der Browser-Matrix in `docs/architecture.md`

Installiert: Playwright 1.65.0 mit Chromium 158.0.8127.18, Firefox 159.0, WebKit 27.2
(`node_modules/.pnpm/playwright-core@1.65.0/node_modules/playwright-core/browsers.json`), der
Host ist Linux x86_64. Die Doku nennt an `:265` Firefox 155 und Playwright 1.63.0, an `:274`
Playwright 1.63.0 auf macOS und im Image `v1.63.0-noble` auf arm64 und amd64, an `:276`
Playwright 1.63.0 und WebKit 26.6 auf macOS.

**D1. Nachmessen, was dieser Host nachmessen kann**, mit einem Node-Skript unter
`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/25b68af0-a25d-4ede-b583-3d06a691b428/scratchpad/paket-14-browsers/`
(nichts im Projekt ändert sich dafür), `playwright` aus dem Repo-Root importiert, eine Seite
von einem lokalen HTTP-Server auf `127.0.0.1` (sicherer Kontext für `navigator.gpu`), alle
Browser headless und **nacheinander**, nie parallel:

1. Chromium ohne jedes Flag: gibt es `navigator.gpu`, antwortet `requestAdapter()` einen
   Adapter?
2. Firefox: dasselbe.
3. Chromium mit den WebGPU-Flags aus `packages/twopoint5d-testing/web-test-runner.config.js:130–134`
   in drei Stufen — `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader` allein, dazu
   `--use-angle=swiftshader`, dazu `--enable-features=Vulkan --use-vulkan=swiftshader`: je
   Adapter und Device holen, einen Canvas mit `getContext('webgpu')` konfigurieren, einen
   Clear-Pass auf `getCurrentTexture()` abschicken, zwei `requestAnimationFrame` warten, dann
   prüfen, ob `device.lost` noch offen ist und ob die Konsole »A valid external Instance
   reference no longer exists« meldet.
4. WebKit: gibt es `navigator.gpu`?

**D2. Doku umschreiben** (`docs/architecture.md:259–276`):

- `:264–266`: die Begründung, warum jeder Launcher sein Backend festlegt, nennt die
  Ergebnisse von 1 und 2 mit dem, womit gemessen wurde (»measured with Playwright 1.65.0 —
  Chromium 158, Firefox 159 — on Linux«).
- `:273–275`: der Linux-Teil nach Messung 3, mit Playwright 1.65.0 auf Linux x86_64; der
  macOS- und arm64-Teil lässt sich hier nicht nachmessen und bleibt stehen, ausdrücklich als
  mit Playwright 1.63.0 gemessen (auf macOS und im Image `v1.63.0-noble` auf arm64).
- `:276`: die Klammer »(measured with Playwright 1.63.0, WebKit 26.6, on macOS)« fällt — der
  Absatz danach (`:283–284`) sagt schon, dass `test/renderer-backend.test.js` (»finds no
  WebGPU in WebKit …«) das bei jedem Lauf hält.
- Widerspricht eine Messung einer Aussage (Firefox 159 findet einen Adapter, Linux braucht
  weniger als alle drei Flags), schreibt die Doku das Gemessene; die Config und ihr Kommentar
  (`web-test-runner.config.js:114–127`) bleiben unverändert, und der Widerspruch geht unter
  »Abweichungen« in den Report.
- Nicht angefasst: `docs/architecture.md:622` (»Firefox 155 under WebGPU needs the frames to
  keep drawing …«) nennt die Version, unter der das Verhalten gefunden wurde, keinen Messstand
  der Matrix, und headless lässt es sich ohne WebGPU-Adapter in Firefox nicht nachmessen; die
  datierten Pläne unter `docs/superpowers/` halten ihren Stand fest und bleiben.

## Findings im Volltext

**Allocation-Spec unter frame-pacing · low ·
`packages/twopoint5d/src/display/hot-path-allocations.adaptive-resolution.spec.ts:86–96`**
(Queue: `:83-93`) — »a frame under frame-pacing allocates nothing, the frames that judge a
window included«: unter `pnpm nx run-many -t allocations --skip-nx-cache` in 2 von 4 Läufen
rot (16.02 B je Aufruf), allein und im Gate grün; Herkunft offen — der Spec gab es vor dem
Lauf, den Frame-Pacing-Pfad von `AdaptiveResolution` hat Paket 3 geändert (aus Paket 4,
gemeldet vom Implementierer). Einordnung in Zug 0: vorbestehend, siehe Teil A.

**`Display#stop()` nach `dispose()` · low · `packages/twopoint5d/src/display/Display.ts:1327`**
— das TSDoc sagt »Does nothing after `dispose()`«, die Methode prüft `#disposed` aber nicht und
zählt `#pauseRequests` hoch und setzt `pausedByUser` auch auf einem entsorgten Display (aus
Paket 10, vorbestehend laut `git show 2e3f585b:…Display.ts:1958`).

**`Display#isFirstFrame` · info · `packages/twopoint5d/src/display/Display.ts:508`** — der
öffentliche Getter hat kein TSDoc (aus Paket 10, vorbestehend laut `git show 2e3f585b:…:737`).

**`#emit` · info · `packages/twopoint5d/src/display/Display.ts:1507`** — das Arrow-Feld ist
anders als die übrigen nicht `readonly` (aus Paket 10, vorbestehend laut
`git show 2e3f585b:…:2170`).

**TSDoc an `Stage2D` und `StageRenderer` · info · `packages/twopoint5d/src/stage/Stage2D.ts:137, 149, 153, 190, 492`,
`StageRenderer.ts:204–206`** (Queue: `Stage2D.ts:152, 164, 168, 205, 664`,
`StageRenderer.ts:236–238`) — die öffentlichen Member `name`, `containerWidth`,
`containerHeight`, `projection` (Getter und Setter, dessen Verhalten — Größe und Kamera
fallen, Ereignisse, gesammelte Fehler — nirgends steht) und `isFirstFrame` haben kein TSDoc,
ebenso `clearColorBuffer`, `clearDepthBuffer`, `clearStencilBuffer`; API-001 nannte diese
Stellen nicht (aus Paket 11b, Zug 0, vorbestehend laut
`git show 2e3f585b:…Stage2D.ts:144, 156, 197, 641` und `…StageRenderer.ts:216`).

**Messstand der Browser-Matrix · info · `docs/architecture.md:265, 274, 276`** (Queue:
`:258, 267, 269`) — nennt Playwright 1.63.0 / WebKit 26.6 als Messstand der Browser-Matrix,
installiert ist 1.65.0 / WebKit 27.2 (aus Paket 2, vorbestehend). In Zug 0 dazu: `:265` nennt
Firefox 155, installiert ist 159.

## Urteil des Reviewers

- Allocation-Spec unter frame-pacing — behoben: `AdaptiveResolution.ts:462` weist das Intervall direkt in `#onRenderFrame` zu, `#readRafInterval()` entfernt; Helfer `src/testing/adaptiveResolutionRound.ts` (aus Build und Coverage ausgenommen); neue Spec `hot-path-allocations.adaptive-resolution-uninlined.spec.ts` (Inlining per `v8.setFlagsFromString()` aus, vor dem Fix rot mit 16,01 und 16,02 B je Aufruf); CHANGELOG `### Fixed` `CHANGELOG.md:96`
- `Display#stop()` nach `dispose()` — behoben: `Display.ts:1332–1340` (`#disposed`-Guard, Rumpf in `#pauseByCaller()`), `dispose()` ruft `#pauseByCaller()` (`:1405`)
- TSDoc `Display#isFirstFrame` — behoben: `Display.ts:507–511`
- `#emit` readonly — behoben: `Display.ts:1518`
- TSDoc Stage2D und Clear-Flags des StageRenderer — behoben: `Stage2D.ts:137, 150–161, 199–216, 518–523`, `StageRenderer.ts:204–225`, jeder Satz gegen den Code geprüft
- Messstand der Browser-Matrix — behoben: `docs/architecture.md:264–278` (Playwright 1.65.0, Linux x86_64: Chromium 158 ohne Adapter, Firefox 159 ohne `navigator.gpu`, Linux braucht alle drei Compositor-Flags — mit nur den ersten beiden Stufen verwirft die Queue zwei Frames nach dem Submit mit »A valid external Instance reference no longer exists«, WebKit 27.2 ohne `navigator.gpu`); macOS/arm64 ausdrücklich als mit 1.63.0 gemessen

## Kleine Befunde

- `AdaptiveResolution.ts:455–461`: zwei Kommentarblöcke ohne Trenner übereinander
- `docs/architecture.md:266`: Interpunktion »— on Linux) —, so both« stolpert
- `Stage2D.ts:153–154`: der Satz »A `resize()` whose projection throws leaves the container …« gilt ebenso, wenn der `CameraRig` (`driver.placeBase`) wirft (Rollback `#updateProjection` `:449–455`, `resize()` `:364–371`)
- Vom Implementierer gemeldet, kein Befund: TSDoc-Zeilen in `Stage2D.ts:743, 774` über der Umbruchbreite — die Datei trägt 19 solcher Zeilen, alle schon in der Basis, keine Lint-Regel greift
- Nebenbefund `Stage2D.ts:412` (`#updateProjection` nicht `readonly`) → »Offene Befunde«; vorbestehend laut `git show 2e3f585b:…Stage2D.ts:493`, Urteil → Scope (die Scope-Regel nimmt info ein)
