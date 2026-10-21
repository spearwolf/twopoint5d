# Paket 1 — Display: Auflösungspolitik als reine Funktion, AdaptiveResolution korrekt und getestet

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-001 (high), ARCH-001 (medium), BUG-003 (medium), ASYNC-001 (medium), TEST-001 (medium), TEST-003 (medium)
- Ziel: Pixel-Ratio und Buffer-Größe kommen aus einer reinen, ohne DOM testbaren Funktion, die `Display` und `AdaptiveResolution` teilen, und der Controller misst Frame-Pacing gegen die erreichbare Bildrate, sagt Step-ups aus der tatsächlichen Ratio vorher, verwirft Messungen nach dem Abschalten und ist samt Dispose gegen ein realistisches Double getestet.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - neu: `packages/twopoint5d/src/display/resolveDrawingBuffer.ts`, `packages/twopoint5d/src/display/resolveDrawingBuffer.spec.ts`
  - `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d/src/display/AdaptiveResolution.ts`, `packages/twopoint5d/src/display/AdaptiveResolution.spec.ts`
  - `packages/twopoint5d/src/display/FrameLoop.ts`, `packages/twopoint5d/src/display/FrameLoop.spec.ts`
  - `packages/twopoint5d-testing/test/display-adaptive-resolution.test.js`
  - `packages/twopoint5d/docs/display.md`, `packages/twopoint5d/docs/architecture.md`, `packages/twopoint5d/CHANGELOG.md`
  - nicht anfassen: `packages/twopoint5d/src/display/public-api.ts` und `public-api.spec.ts` — alles Neue in diesem Paket ist intern
- Verify: `pnpm run ci`
- Commit: siehe Abschnitt »Commit-Message« unten
- Verlauf:
  - 2026-10-21 Zug 0: Detailplan steht · BUG-001 unverändert (`AdaptiveResolution.ts:329`, `:141`, `Display.ts:1242`) · ARCH-001 unverändert (`Display.ts:1445–1470`, `:1744–1869`, 2306 Zeilen) · BUG-003 unverändert (`AdaptiveResolution.ts:314`, `:316`, `Display.ts:1469`) · ASYNC-001 unverändert (`AdaptiveResolution.ts:280`, `:196–205`) · TEST-001 unverändert (`AdaptiveResolution.spec.ts:15–39`) · TEST-003 unverändert (`display-adaptive-resolution.test.js:21–36`, `Display.spec.ts:1921–1940`) · keine Folgen (erstes Paket), »Offene Befunde« leer · Restplan unverändert
  - 2026-10-21 Zug 1: Implementierer beauftragt · Modell opus (stärkste Stufe), Effort high · Report nach `paket-1.impl-0.json` im Arbeitsverzeichnis
  - 2026-10-21 Zug 2: Report FERTIG · neu `resolveDrawingBuffer.ts`, `resolveDrawingBuffer.spec.ts`; geändert `Display.ts`, `Display.spec.ts`, `AdaptiveResolution.ts`, `AdaptiveResolution.spec.ts`, `FrameLoop.ts`, `FrameLoop.spec.ts`, `display-adaptive-resolution.test.js`, `docs/display.md`, `docs/architecture.md`, `CHANGELOG.md` · rote Läufe: 10 in `AdaptiveResolution.spec.ts`, 1 in `Display.spec.ts` (Dispose-Zeile dafür kurz auskommentiert) · Arbeitsbaum schmutzig · eigener Verify `pnpm run ci` exit=0 (`paket-1.verify.log`, Nx-Cache über identische Inputs)
  - 2026-10-21 Zug 3: Reviewer opus/high · alle sechs Findings behoben · 4 kleine Befunde, kein kritischer, kein wichtiger · Diff `paket-1.diff`, Report `paket-1.review-0.json`
  - 2026-10-21 Zug 4: keine Runde nötig (nur kleine Befunde)
  - 2026-10-21 Zug 5: Commit 328f7a8e · 12 Dateien · Verify `paket-1.verify.log` exit=0 (keine Änderung seit Zug 2) · Plan auf [x], drei Nebenbefunde in »Offene Befunde«

## Reviewer-Urteil

Reviewer opus/high, Report `paket-1.review-0.json` im Arbeitsverzeichnis, auf dem Stand vor Commit 328f7a8e (identisch mit dem Commit).

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| BUG-001 | behoben | `AdaptiveResolution.ts:414–422` (`#rafIntervalMs`), `:433`, `:479–488`, `:495`; `FrameLoop.ts:266` (`longestRafInterval`); Tests `AdaptiveResolution.spec.ts:418`, `:429` |
| ARCH-001 | behoben | `resolveDrawingBuffer.ts:71` (`pixelRatioFor`), `:104` (`resolveDrawingBuffer`); `Display.ts:1447–1474`, `:1788–1794`; keine bestehende Erwartung in `Display.spec.ts` geändert |
| BUG-003 | behoben | `AdaptiveResolution.ts:283–307` (`#ratioAt`/`#levelBelow`/`#levelAbove`), `:383–388`, `:400`; Tests `AdaptiveResolution.spec.ts:310`, `:320`, `:341` |
| ASYNC-001 | behoben | `AdaptiveResolution.ts:244` (`#settle()` vor der Rückgabe), `:355` (Guard mit `!#enabled` und `pixelZoom > 0`); Tests `AdaptiveResolution.spec.ts:539`, `:556` |
| TEST-001 | behoben | `AdaptiveResolution.spec.ts` ab `:39` (`makeDisplay`-Double über `pixelRatioFor()`, Resize nur bei Ratio-/Zoom-Änderung, manuell auflösbare Messungen); `#scaleBefore` je Übernahme `:573` |
| TEST-003 | behoben | `Display.spec.ts:2007` (`describe('adaptiveResolution')`), `display-adaptive-resolution.test.js:37–40`, `Display.ts:2067` |

Nebenbei mit erledigt: BUG-011 (low, `#scaleBefore` beim erneuten Einschalten neu festhalten) durch Schritt 6b; Test `gives back the scale the display had when it took over last`.

Kleine Befunde (keine Runde):

- `packages/twopoint5d/docs/display.md:205–206` — »A frame held up by JavaScript takes the scale down as well … `minScale` is how far that goes« stimmt nur für unregelmäßige CPU-Last; eine gleichmäßige JS-Last erkennt der Controller als Kadenz und kehrt zurück. Ebenso der Kommentar `AdaptiveResolution.ts:482` (»An unsteady pace, one the CPU sets«).
- `packages/twopoint5d/docs/display.md:189` — »a few seconds at a lower resolution«: bei 30 Hz sind es rund 270–300 Frames, etwa 9–10 s.
- `packages/twopoint5d/src/display/resolveDrawingBuffer.ts:160` — jede Messung allokiert ein Ergebnisobjekt; mit `resizeTo`-Callback und `resizePollIntervalMs = 0` (Default) eine Allokation je Frame. Vorschlag: Ausgabeobjekt übergeben, das `Display` einmal hält. Vom Detailplan so vorgegeben (Signatur mit Rückgabewert); die Allokations-Specs bleiben grün.
- `packages/twopoint5d/src/display/AdaptiveResolution.ts:419` — `#loopFrameNo` wird nur in Pacing-Frames nach dem Settle fortgeschrieben; ein eigener `renderFrame()` als erster Frame nach einem Settle liest einmal ein veraltetes `longestRafInterval`. Ein Sample, praktisch folgenlos.

Abweichungen des Implementierers vom Detailplan (vom Reviewer nicht beanstandet): `#takeOverScale()` setzt zusätzlich `#gpuStepUpPending = false`; privater Helfer `Display#pixelRatioParams(scale)` füllt `#drawingBufferParams` für alle drei Aufrufer; die Probe hinauf in `#samplePacing()` prüft `#levelAbove(level) !== level` statt `level > 0`; der `[Unreleased]`-Eintrag im CHANGELOG wurde wie angeordnet umgeschrieben.

Urteile der Nebenbefunde: `get method()`-TSDoc, NaN in `#takeOverScale()` und `median()`-Allokation sind low, die Scope-Regel (ab medium) greift nicht → Audit. Der Konstruktor, der eine disposte Display annimmt, ist RES-004 (low) und steht schon im Audit; kein neuer Eintrag.

## Vorgehen

Vorab, für jede Zeile dieses Pakets: die Konventionen aus dem Kopf von
`./remediation-plan.md` gelten — Code, Kommentare, TSDoc, Docs und
Commit-Message auf Englisch, keine Finding-IDs (auch nicht in Testnamen), kein
Rückblick auf den Vorzustand in Code, Kommentaren und Docs, relative Imports mit
`.js`, Typen per `import type`. Kommentare im Stil des Moduls: sie sagen, warum.

### Schritt 0 — Lesen

1. `AGENTS.md` im Repo-Root (Pflicht), dort v. a. »Rules you cannot read off the
   code« und »Working on the library«.
2. `packages/twopoint5d/docs/resource-lifecycle.md` §2, §3 und §6.
3. Das Modul ganz: `packages/twopoint5d/src/display/*.ts` (Display.ts in
   Abschnitten; es sind 2306 Zeilen), dazu `AdaptiveResolution.spec.ts`,
   `FrameLoop.spec.ts` und in `Display.spec.ts` die Helfer (Zeilen 1–135), den
   Block `describe('resize()')` (908–1245) und `describe('constructor')` (ab 1921).
4. `packages/twopoint5d/docs/display.md` ganz.
5. Für Schritt 9 den Skill `updating-changelog`, für die Listener-Semantik bei
   Bedarf `using-eventize`.

### Schritt 1 — Reine Funktion `resolveDrawingBuffer` (Verhalten 1:1)

Neue Datei `packages/twopoint5d/src/display/resolveDrawingBuffer.ts`. Jedes
Export bekommt `@internal` im TSDoc (wie `src/sprites/frameUv.ts`); nichts davon
geht in `public-api.ts`. Die Funktion bildet das heutige Verhalten **unverändert**
ab — das ist eine Entscheidung des Nutzers vom 2026-10-21 (»die reine Funktion aus
der Display-Auflösung bildet das heutige Verhalten unverändert ab«): gleiche
Zahlen, gleiche Reihenfolge der Operationen, gleiche Epsilons, kein Fix nebenbei.

```ts
/** What the drawing buffer of a display is resolved from. Sizes in CSS pixels, none below 0. @internal */
export interface DrawingBufferParams {
  /** the size of the size source, its padding and border off: the area a budget of pixels is spread over */
  contentWidth: number;
  contentHeight: number;
  /** the CSS size of the canvas as its box-sizing leaves it, before a pixel zoom fits it to whole pixels */
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  maxPixelRatio: number;
  maxPixels: number;
  resolutionScale: number;
  pixelZoom: number;
  maxResolution: number;
}

/** @internal */
export type PixelRatioParams = Pick<
  DrawingBufferParams,
  'contentWidth' | 'contentHeight' | 'devicePixelRatio' | 'maxPixelRatio' | 'maxPixels' | 'resolutionScale' | 'pixelZoom'
>;

/** What a measurement of a display applies to the renderer and the canvas. @internal */
export interface DrawingBuffer {
  /** Display#width / #height: CSS pixels, or pixels of the buffer under a pixel zoom */
  width: number;
  height: number;
  /** the inline width and height of the canvas */
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
  /** the zoom, 0 where it is not above 0 */
  pixelZoom: number;
  devicePixelZoom: number;
  /** the size of the buffer the params asked for where it lies beyond maxResolution on an axis — the size the warning of the display names; undefined otherwise */
  requestedSize: [width: number, height: number] | undefined;
}

/** @internal */
export function pixelRatioFor(params: PixelRatioParams): number;
/** @internal */
export function resolveDrawingBuffer(params: DrawingBufferParams): DrawingBuffer;
```

- `pixelRatioFor()` ist der Körper von `get pixelRatio()` (`Display.ts:1446–1469`),
  mit `params.contentWidth/contentHeight` an Stelle von `this.#contentWidth/#contentHeight`
  und allen übrigen Werten aus `params`.
- `resolveDrawingBuffer()` ist `Display.ts:1784–1830`: `pixelRatio` aus
  `pixelRatioFor(params)`, `wPx/hPx` als lokale Kopien von `contentWidth/contentHeight`
  (der Pfad ohne Zoom klemmt sie), `params.maxResolution` an Stelle von
  `Display.MaxResolution`, die Normalisierung `pixelZoom > 0 ? pixelZoom : 0` samt
  ihrem Kommentar. Statt `showCanvasMaxResolutionWarning()` zu rufen, liefert die
  Funktion `requestedSize` mit genau den Werten, die die Warnung heute nennt: unter
  einem Zoom `[width, height]` vor dem Klemmen, sonst
  `[Math.round(contentWidth * pixelRatio), Math.round(contentHeight * pixelRatio)]`.
- Die Konstanten `DEVICE_PIXEL_ZOOM_EPSILON`, `PIXEL_RATIO_STEP`,
  `DEVICE_PIXEL_SIZE_TOLERANCE` ziehen samt Kommentaren (`Display.ts:48–61`) in das
  neue Modul; `Display.ts` braucht sie danach nicht mehr (`grep` bestätigt das —
  heute nur Zeilen 1469, 1799, 1802, 1805, 1806).

### Schritt 2 — `Display` auf die Funktion umstellen

- Ein Feld `readonly #drawingBufferParams: DrawingBufferParams` (ein Objekt,
  mit Nullen und `resolutionScale: 1` angelegt). Jede Aufrufstelle schreibt vor
  dem Aufruf jedes Feld, das der Aufruf liest. So allokiert weder der Vergleich,
  den `#resize()` in jedem Frame macht (`this.pixelRatio === this.#appliedPixelRatio`),
  noch `getEventProps()` etwas dafür — das Modul hält Frames allokationsfrei
  (»fields, so a frame allocates nothing for them«).
- `get pixelRatio()`: schreibt `#contentWidth`, `#contentHeight`,
  `devicePixelRatio`, `maxPixelRatio`, `maxPixels`, `resolutionScale`,
  `pixelZoom` ins Feld und gibt `pixelRatioFor(...)` zurück. TSDoc bleibt.
- Direkt darunter ein neues internes Mitglied (Vorbild: `FeatureSprites#judgeVisibility`,
  `@internal`, `stripInternal` steht in der Root-tsconfig):

  ```ts
  /**
   * The pixel ratio the display would draw at with `resolutionScale` in place of its own, at the
   * size of its last measurement and with its bounds as they are now — what
   * {@link Display.pixelRatio} answers once that scale is set. {@link AdaptiveResolution}
   * predicts the cost of a step with it.
   *
   * @internal
   */
  pixelRatioAt(resolutionScale: number): number
  ```

- `#applyMeasuredSize()`: Box-Sizing-Block und Klemmen (`1745–1782`) bleiben,
  `#contentWidth/#contentHeight` werden gesetzt wie heute; dann alle Felder füllen
  (`maxResolution: Display.MaxResolution`), `const buffer = resolveDrawingBuffer(this.#drawingBufferParams)`,
  `if (buffer.requestedSize != null) showCanvasMaxResolutionWarning(buffer.requestedSize[0], buffer.requestedSize[1])`,
  danach liest der Vergleichs- und Anwendungsblock (`1832–1868`) aus `buffer`.
- `isPositiveFinite` bleibt in Display importiert (`:1242`).
- **Alle bestehenden Tests in `Display.spec.ts` bleiben unverändert und grün**, die
  unter `resize()` und `size watch` zuerst: sie sind der Beleg der 1:1-Extraktion.
  Ihre Erwartungen werden nicht angefasst.
- Neuer Test in `Display.spec.ts`, im Block `maxPixels and resolutionScale`:
  `'answers with pixelRatioAt() the ratio a resolutionScale would give, at the size of the last measurement'`
  — dpr 2, `resizeTo: () => [3840, 2160]`, `maxPixels: 3_000_000`: `pixelRatioAt(1)` 0.5,
  `pixelRatioAt(0.875)` 0.5, `pixelRatioAt(0.75)` 0.375, `pixelRatioAt(0.5)` 0.25; unter
  `pixelZoom = 2` (nach `resize()`) 1 für jede Skala; `display.resolutionScale` bleibt dabei 1.

### Schritt 3 — `resolveDrawingBuffer.spec.ts`

Ohne DOM, ohne Stubs, reine Ein- und Ausgaben. Die Werte spiegeln die
Display-Tests, damit beide Ebenen dasselbe festhalten:

- `pixelRatioFor`: dpr unter der Schranke bleibt (1.25 bei `maxPixelRatio` 2);
  `maxPixelRatio` 1.5 bei dpr 3 → 1.5; `maxPixelRatio` 0, −1, NaN, ∞ → keine
  Schranke; Budget 3840 × 2160, dpr 2, 3 Mio. → 0.5; 1920 × 1080, dpr 1, 1 Mio. →
  0.625; nicht bindendes Budget (320 × 200, dpr 2.625, `maxPixelRatio` 0, 3 Mio.)
  → exakt 2.625; Fläche 0 → kein Budget; `maxPixels` 0, −1, NaN, ∞ → kein Budget;
  Skala 0.75 bei dpr 2 → 1.5, 0.8 → 1.5, 0.01 → 0.125; Skala 0, −1, NaN, ∞ wie 1;
  Skala auf der Budget-Ratio (0.601 × 0.5 → 0.25); `pixelZoom > 0` → 1 bei
  jeder Schranke.
- `resolveDrawingBuffer` ohne Zoom: `width/height` abgerundet, CSS-Größe
  durchgereicht, `pixelZoom` 0, `devicePixelZoom` 0, `requestedSize` undefined;
  `maxResolution` 8192 bei dpr 2 und 5000 × 100 → `width` 4096, `requestedSize`
  `[10000, 200]`; dpr 3, `maxPixelRatio` 0, 5000 × 50 → `width` 2730.
- mit Zoom: 412 × 915, dpr 2.625, Zoom 2 → `devicePixelZoom` 5, 216 × 480, CSS-Größe
  `216 * 5 / 2.625` × `480 * 5 / 2.625` (`toBeCloseTo`); Zoom 2 bei dpr 1.25 → 2;
  Zoom `4 / 2.625` bei 2.625 → 4; Zoom 0.25 bei dpr 2 → 1; Budget 100 000 bei
  1000 × 500, dpr 2, Zoom 1 → `devicePixelZoom` 5, 400 × 200; dasselbe Budget bei
  Zoom 4 → 8; 20000 × 100, dpr 1, Zoom 2 → 8192 × 50, `cssWidth` 16384,
  `requestedSize` `[10000, 50]`; Zoom NaN und −1 wie 0; Padding bleibt am Rand:
  `cssWidth` 330 bei `contentWidth` 320 → `10 + width * devicePixelZoom / devicePixelRatio`.

### Schritt 4 — `FrameLoop#longestRafInterval` (intern)

Der Controller muss einen späten Frame der Seite von einem unterscheiden, den
`maxFps` zurückgehalten hat (Schritt 6d). Das kann nur der `FrameLoop`: er sieht
jeden Tick des rAF-Treibers, auch die, die er nicht emittiert.

- Felder `#lastRafNow?: number`, `#longestRafGap = 0`, `#longestRafInterval = 0`.
- In `#onRAF`, **vor** dem Throttle-`return`: liegt `#lastRafNow` vor, die Lücke
  `now - #lastRafNow` in `#longestRafGap` maximieren; dann `#lastRafNow = now`.
- Beim Emittieren: `#longestRafInterval = #longestRafGap; #longestRafGap = 0`.
- In `stop()`, wo der letzte Subscriber geht (neben `#lastNow = undefined`):
  `#lastRafNow = undefined; #longestRafGap = 0`.
- Getter, direkt unter `deltaTime`:

  ```ts
  /**
   * The longest interval between two animation frames of the rAF driver since the frame this loop
   * emitted before, in milliseconds — equal to {@link FrameLoop.deltaTime} where `maxFps` holds no
   * frame back. `0` for the first frame, and for the first after the loop has lost its last
   * subscriber and got one again. {@link AdaptiveResolution} tells a late frame of the page by it
   * from one that `maxFps` held back.
   *
   * @internal
   */
  get longestRafInterval(): number
  ```

- `FrameLoop.spec.ts`, mit dem vorhandenen `makeFakeRenderer()`: (1) ohne `maxFps`
  gleich `deltaTime`; (2) mit `maxFps` 50 und Ticks alle 16,667 ms die längste
  Tick-Lücke seit dem vorigen emittierten Frame (16,667 ms, auch über einen
  zurückgehaltenen Tick hinweg), und eine ausgelassene Tick-Folge (ein Tick erst
  nach 33,3 ms) zeigt sich als 33,3; (3) 0 für den ersten Frame und für den ersten,
  nachdem der Loop seinen letzten Subscriber verloren und wieder einen bekommen hat.

### Schritt 5 — Realistisches Double und die neuen Controller-Tests (zuerst rot)

`AdaptiveResolution.spec.ts`: `makeDisplay()` wird zu einem Double, das den
Display-Vertrag abbildet. Die bestehenden Tests behalten ihre Erwartungen (mit
dpr 1 und ohne Budget ist jede Ratio gleich ihrer Skala, jede Stufe ändert die
Ratio, alles bleibt wie bisher); passe nur ihre Aufrufe an die neue Signatur an.

- Optionen: `timestamps`, `resolutionScale`, `devicePixelRatio = 1`,
  `maxPixelRatio = 0`, `maxPixels = 0`, `width = 320`, `height = 200`.
- Das Double trägt `renderer` (wie bisher), `resolutionScale`, `pixelZoom`,
  `devicePixelRatio`, `maxPixelRatio`, `maxPixels`,
  `frameLoop: {frameNo: 0, longestRafInterval: 0}` und
  `pixelRatioAt(scale)`, das `pixelRatioFor()` aus Schritt 1 mit den Werten des
  Doubles und `scale` ruft — so kann das Double nicht von `Display` abdriften.
- `frame({deltaMs = FRAME_MS, rafMs = deltaMs, fromLoop = true})`: (1) misst wie
  die Display zu Beginn des Frames — **`OnDisplayResize` nur, wenn sich
  `pixelRatioAt(resolutionScale)` oder `pixelZoom` seit der letzten Messung
  geändert hat**; (2) bei `fromLoop` `frameLoop.frameNo += 1` und
  `frameLoop.longestRafInterval = rafMs`; (3) `OnDisplayRenderFrame` mit
  `rawDeltaTime: deltaMs / 1000`; (4) zwei Microtasks warten. Dazu `frames(count, opts)`
  und ein Resize-Zähler.
- GPU: `gpu.ms` als Zahl, alternativ `gpu.msAt(ratio)` als Kostenmodell über die
  aktuelle Ratio; `gpu.manual`: dann gibt `resolveTimestampsAsync` ein offenes
  Promise zurück, das der Test über `gpu.resolveNext(ms)` auflöst — auch Frames
  später (Messungen über Frames hinweg).

Neue Tests, englische Titel ohne IDs. Die mit »rot« markierten laufen vor Schritt 6
rot; der rote Lauf gehört in den Report (Testname, Kommando, Ausgabe):

1. gpu-time, rot: `'predicts a step up from the pixel ratio the display would draw at'` —
   dpr 2, 3840 × 2160, `maxPixels` 3 000 000, Start 0.75 (Ratio 0.375), 8 ms: nach
   `SETTLE + 12 * 6` Frames steht die Skala noch auf 0.75 (die nächste Stufe, 0.875,
   zeichnet mit 0.5: 8 × (0.5 / 0.375)² = 14,2 ms > 12 ms).
2. gpu-time, rot: `'skips a step down that leaves the pixel ratio as it is'` — dasselbe
   Double bei Skala 1 (Ratio 0.5), 15 ms: nach `SETTLE + 12` steht die Skala auf 0.75
   (Ratio 0.375), nicht auf 0.875.
3. gpu-time, rot: `'goes up to the highest scale of the next pixel ratio'` — dasselbe
   Double bei 0.5 (Ratio 0.25), 1 ms: der erste Schritt nach oben landet auf 0.75
   (0.625 und 0.75 zeichnen beide mit 0.375), der nächste auf 1.
4. gpu-time, rot: `'waits twice as many windows for the next step up after one that did not hold'` —
   dpr 1, `gpu.msAt = (ratio) => (ratio <= 0.875 ? 6 : 14)`, Start 0.875: nach drei
   Fenstern geht es auf 1 (Vorhersage 7,8 ms), das nächste Fenster misst 14 ms und
   geht zurück auf 0.875; danach reichen drei gute Fenster nicht mehr, erst das
   sechste hebt wieder an.
5. frame-pacing, rot: `'tells the frames maxFps holds back from late ones by the animation frames of the page'` —
   `targetFps` 50, Frames im Raster von `maxFps` 50 auf 60 Hz (`deltaMs` 33,333 dann
   viermal 16,667, wiederholt), `rafMs` immer 16,667: nach `SETTLE + 300` Frames
   Skala 1.
6. frame-pacing, rot: `'measures against the pace the page reaches where fewer pixels bring the frames no sooner'` —
   Defaults, jeder Frame 33,333 ms: der Controller geht bis 0.5 hinab (Minimum der
   beobachteten Skalen ist 0.5), kehrt danach auf 1 zurück und bleibt dort — nach
   weiteren 600 Frames Skala 1 und kein Resize seit der Rückkehr.
7. frame-pacing: `'keeps going down where fewer pixels bring the frames sooner'` —
   `rafMs`/`deltaMs` aus der Ratio (`ratio >= 0.75 ? 33.333 : 16.667`): der Controller
   kommt bei 0.625 an und geht nie mehr auf 1 zurück (Proben nach oben dürfen
   0.75 kurz besuchen).
8. frame-pacing, rot: `'measures against the target again once the frames come sooner'` —
   nach dem Ablauf aus Test 6 vier Fenster mit 16,667 ms, dann wieder 33,333 ms: das
   erste späte Fenster nimmt die Skala eine Stufe hinunter.
9. frame-pacing: `'reads the pace of a frame the frame loop did not run from its rawDeltaTime'` —
   `fromLoop: false`, 27 Frames à 16,667 und 3 à 40 ms: eine Stufe hinunter.
10. ASYNC, rot: `'drops a measurement in flight when it is disabled'` — gpu-time, nach
    `SETTLE` elf aufgelöste Messungen à 15 ms, die zwölfte offen (`gpu.manual`),
    `adaptive.enabled = false`, dann mit 15 auflösen: `display.resolutionScale` ist
    die Skala von vor der Übernahme, `adaptive.gpuTime` undefined.
11. ASYNC, rot: `'drops a measurement in flight when the display goes over to a pixelZoom'` —
    wie 10, aber `display.pixelZoom = 2` statt Abschalten: kein Fenster wird
    beurteilt (`gpuTime` undefined), `display.resolutionScale` unverändert 1.
12. rot: `'gives back the scale the display had when it took over last'` — Start 1,
    abschalten, `display.resolutionScale = 0.6` von Hand, einschalten (übernimmt
    auf 0.5), abschalten: `display.resolutionScale` ist 0.6. Dazu ohne Handänderung
    aus/ein/aus: zurück auf die ursprüngliche Skala.

### Schritt 6 — Controller korrigieren (`AdaptiveResolution.ts`)

**6a — Messung nach dem Abschalten verwerfen.**
- `set enabled(false)`: zuerst `this.#settle()` (Epoche hoch, Samples leer), dann
  die Skala zurückgeben.
- Im `.then` von `resolveTimestampsAsync`:
  `if (this.#disposed || !this.#enabled || this.display.pixelZoom > 0 || epoch !== this.#epoch || !isPositiveFinite(ms)) return;`
  — dieselben Bedingungen, unter denen `#onRenderFrame` stillhält. `#gpuResolving = false`
  bleibt die erste Zeile.

**6b — Rückgabe der Skala an die letzte Übernahme binden.**
- `#scaleBefore` verliert `readonly`; `#takeOverScale()` setzt als Erstes
  `this.#scaleBefore = this.display.resolutionScale` (die separate Zuweisung im
  Konstruktor entfällt) und setzt `#pacingDescentFrom = -1` (Schritt 6d).
- TSDoc von `enabled` und `dispose()` sowie `docs/display.md`: »the
  `resolutionScale` it had when the controller took over last«. TSDoc von
  `enabled` zusätzlich: »After {@link AdaptiveResolution.dispose}, and once the
  display is disposed, a write does nothing.« (Lifecycle-Regel §3.3: der TSDoc
  sagt, was nach dem Dispose passiert.)

**6c — Stufen nach der Ratio, die das Display wirklich zeichnet.**
- `#ratioAt(level: number): number` → `this.display.pixelRatioAt(this.#levels[level]!)`.
- `#levelBelow(level)`: die erste Stufe unter `level`, deren Ratio sich von
  `#ratioAt(level)` unterscheidet; `level` selbst, wo keine es tut.
- `#levelAbove(level)`: die erste Stufe über `level` mit anderer Ratio, und von
  dort weiter hinauf, solange die nächste dieselbe Ratio hat; `level` selbst, wo
  keine es tut. Regel, so auch in den Kommentar: für jede Ratio setzt der
  Controller die höchste Skala, die sie zeichnet.
- Jede Bewegung geht über diese beiden: gpu-time hinunter
  `#setLevel(this.#levelBelow(this.#level))`, steil
  `this.#levelBelow(this.#levelBelow(this.#level))`, hinauf `#levelAbove`;
  frame-pacing hinunter, Probe hinauf und der Rückweg einer gescheiterten Probe
  ebenso. `#setLevel()` behält sein Klemmen.
- Vorhersage:
  `const up = this.#levelAbove(this.#level); if (up !== this.#level && time * (this.#ratioAt(up) / this.#ratioAt(this.#level)) ** 2 < budget * GPU_STEP_UP_SHARE)`.
  Der Kommentar darüber: die Kosten eines Frames wachsen mit seinen Pixeln, dem
  Quadrat der Ratio, die das Display zeichnet.
- Backoff für gpu-time: Felder `#gpuStepUpWindows = GPU_STEP_UP_WINDOWS` und
  `#gpuStepUpPending = false`; der Schritt hinauf setzt `#gpuStepUpPending = true`.
  `#judgeGpuWindow()` prüft zu Beginn: war ein Schritt hinauf offen, ist er vorbei
  (`false`), und liegt `time > budget`, verdoppelt sich die Wartezeit:
  `Math.min(this.#gpuStepUpWindows * 2, GPU_MAX_STEP_UP_WINDOWS)`. Der Vergleich
  lautet `this.#gpuGoodWindows >= this.#gpuStepUpWindows`. Neue Konstante
  `GPU_MAX_STEP_UP_WINDOWS = 300`, Kommentar: about as many measured frames as
  frame-pacing waits at most. Wie bei frame-pacing verkürzt ein Schritt, der hält,
  die Wartezeit nicht wieder.

**6d — Frame-Pacing gegen die Kadenz, die die Seite erreicht.**

Konstante und Felder:
- `PACING_GAIN_SHARE = 0.9` — a descent has gained where the mean interval of the
  animation frames of a window falls below this share of the one that began it.
- `#pacingCadenceMs = 1000 / targetFps` (im Konstruktor nach `targetFps`) — das
  Intervall der Animation-Frames, das die Seite erreicht.
- `readonly #pacingIntervals = new Float64Array(PACING_WINDOW)` und
  `#pacingIntervalSum = 0` — die Intervalle des laufenden Fensters, allokationsfrei.
- `#pacingDescentFrom = -1`, `#pacingDescentMs = 0`, `#pacingDescentSteady = false`,
  `#pacingDescentGained = false`.
- `#loopFrameNo = -1`.
- `#settle()` setzt zusätzlich `#pacingIntervalSum = 0`. Den Abstieg setzt es
  **nicht** zurück: jede Stufe ist ein Resize, und der Abstieg läuft über viele.

Das Intervall eines Frames, `#rafIntervalMs(rawDeltaTime: number): number`:

```ts
// The interval between the animation frames of the page before this frame: a frame maxFps held
// back is no late frame. A frame the frame loop of the display did not run — a renderFrame() of
// one's own — has nothing but its own delta
const loop = this.display.frameLoop;
const fromLoop = loop.frameNo !== this.#loopFrameNo;
this.#loopFrameNo = loop.frameNo;
return fromLoop && loop.longestRafInterval > 0 ? loop.longestRafInterval : rawDeltaTime * 1000;
```

`#onRenderFrame` ruft im frame-pacing-Zweig `this.#samplePacing(this.#rafIntervalMs(rawDeltaTime))`.

`#samplePacing(rafMs)`:
1. `targetMs = 1000 / this.targetFps`; Intervall ins Fenster schreiben, Summe
   fortschreiben; spät, wo
   `rafMs > this.#pacingCadenceMs + (PACING_LATE_FACTOR - 1) * targetMs` — ohne
   gefundene Kadenz ist das die heutige Schwelle von 1,5 Ziel-Intervallen.
2. Am Fensterende: `late` wie heute (`>= PACING_LATE_FRAMES`),
   `meanMs = sum / PACING_WINDOW`, und `steady`: weniger als `PACING_LATE_FRAMES`
   Intervalle des Fensters liegen über `meanMs + (PACING_LATE_FACTOR - 1) * targetMs`
   — die Frames kamen in gleichem Takt, ein oder zwei Ausreißer (GC) zählen nicht.
   Zähler und Summe zurücksetzen.
3. Laufende Probe hinauf: wie heute, Rückweg über `#levelBelow`.
4. Spät: `#pacingCleanFrames = 0`, dann der Abstieg:
   - läuft keiner (`#pacingDescentFrom === -1`): beginnen mit
     `from = #level`, `ms = meanMs`, `steady`, `gained = false`;
   - läuft einer: `if (meanMs < this.#pacingDescentMs * PACING_GAIN_SHARE) gained = true`;
   - gibt es eine Stufe darunter (`#levelBelow(#level) !== #level`): hinunter, fertig;
   - am Boden: wo der Abstieg über mindestens eine Stufe ging (`from !== #level`),
     nichts gewonnen hat und in gleichem Takt begann (`steady`), halten die Pixel die
     Bildrate nicht — ein auf 30 Hz gehaltener `requestAnimationFrame`, ein
     30-Hz-Panel. Dann
     `#pacingCadenceMs = Math.max(targetMs, #pacingDescentMs)`, Abstieg beenden
     (`from = -1`), `#setLevel(from)` — zurück, wo er begann. Sonst bleibt der
     Controller am Boden wie heute (ein unregelmäßiger, CPU-gebundener Takt: »minScale
     is how far that goes« in `docs/display.md`).
5. Sauber: Abstieg beenden (`#pacingDescentFrom = -1`); kommen die Frames schneller
   als die gefundene Kadenz, folgt sie:
   `if (meanMs < this.#pacingCadenceMs) this.#pacingCadenceMs = Math.max(targetMs, meanMs)`;
   dann Clean-Frames und Probe hinauf wie heute, über `#levelAbove`.

Kommentare an diesen Stellen sagen, warum (Takt der Seite vs. Pixel); der
Klassen-TSDoc (`AdaptiveResolution.ts:84–104`) beschreibt beide Methoden neu, siehe
Schritt 9.

### Schritt 7 — Display lässt den Controller los, Integrationstests

- `Display#dispose()`: nach `emitStrict(this, OnDisplayDispose, this)` (dort lässt
  der Controller über sein `once` los) `this.#adaptiveResolution = undefined`.
  Lifecycle-Regel §3.1: ein Typ `T | undefined` antwortet nach dem Dispose `undefined`.
- TSDoc von `get adaptiveResolution()`: »`undefined` without it, and once the display
  is disposed — the controller lets go of the display with it.« Klassen-TSDoc
  Punkt 4 (`Display.ts:505–507`): »{@link Display.renderer} and
  {@link Display.adaptiveResolution} answer `undefined`«.
- `Display.spec.ts`, neuer Block `describe('adaptiveResolution')`; Renderer-Stub
  über `makeDisplay(options, undefined, backend)` mit
  `backend = {trackTimestamp: true, hasTimestamp: true}` und einem
  `resolveTimestampsAsync`-Mock am Renderer (am Stub ergänzen oder per
  `Object.assign` im Test); Frames über `frame(now)` nach `await display.start()`.
  Die echte Display sendet mit `start()` `OnDisplayStart` und mit ihrem ersten
  Frame `OnDisplayResize`; beides startet den Settle des Controllers neu. Die Zahl
  der Frames bis zur ersten Messung daher nicht aus `SETTLE` ableiten, sondern
  treiben, bis `resolveTimestampsAsync` das erste Mal gerufen wurde:
  1. rot: `'lets go of the controller it built with dispose(): a measurement in flight writes nothing, and adaptiveResolution answers undefined'` —
     nach `SETTLE` elf Messungen à 15 ms, die zwölfte offen, `display.dispose()`,
     dann auflösen: `display.resolutionScale` unverändert 1,
     `display.adaptiveResolution` undefined, und ein `enabled = false` am zuvor
     gehaltenen Controller lässt `enabled` auf `true` (losgelassen).
  2. `'a controller disposed on its own takes its listeners off the display and gives the scale back'` —
     Display ohne die Option, `const before = getSubscriptionCount(display)`,
     `new AdaptiveResolution(display)`, Frames bis die Skala bei 15 ms auf 0.875
     steht, `adaptive.dispose()`: `getSubscriptionCount(display)` gleich `before`,
     `display.resolutionScale` 1, weitere Frames rufen `resolveTimestampsAsync`
     nicht mehr.
  3. `'lets the frames after a restart of the display pass'` — `display.stop()`,
     `await display.start()`, dann 30 Frames ohne Aufruf von `resolveTimestampsAsync`,
     der 31. ruft.

### Schritt 8 — Browsertest

`packages/twopoint5d-testing/test/display-adaptive-resolution.test.js`: nach den
bestehenden Assertions `display.dispose()`, dann
`expect(display.adaptiveResolution, 'after dispose').to.be.undefined`, und
`adaptive.enabled = false; expect(adaptive.enabled, 'a controller that has let go stays as it is').to.equal(true)`.
Der Titel bleibt — er stimmt dann. `afterEach` ruft `disposeDisplay()` danach
gefahrlos noch einmal (`dispose()` ist idempotent).

### Schritt 9 — TSDoc, Docs, CHANGELOG

- Klassen-TSDoc `AdaptiveResolution` (`:84–104`) und `docs/display.md`, Abschnitt
  »Adaptive resolution«:
  - gpu-time: der Schritt hinauf rechnet mit den Pixeln, die das Display auf
    dieser Stufe zeichnen würde; eine Stufe, deren Ratio `maxPixels` oder die
    Rundung auf Achtel gleich lässt, wird übersprungen — für jede Ratio setzt der
    Controller die höchste Skala, die sie zeichnet; ein Schritt hinauf, den das
    nächste Fenster zurücknimmt, lässt den nächsten doppelt so viele Fenster warten,
    bis 300.
  - frame-pacing: gemessen an den Intervallen zwischen den Animation-Frames der
    Seite, ein von `maxFps` zurückgehaltener Frame ist kein später; wo der Abstieg
    bis `minScale` die Frames in gleichem Takt nicht früher kommen ließ — ein
    `requestAnimationFrame`, den ein Stromsparmodus oder ein 30-Hz-Bildschirm auf
    30 Bilder hält —, geht der Controller dorthin zurück, wo er begann, und misst
    von da an gegen diesen Takt: ein Frame ist spät, wenn er ein halbes
    Ziel-Intervall nach ihm kommt. Kommen die Frames wieder früher, gilt wieder das
    Ziel. Den einmaligen Abstieg samt Rückkehr ehrlich nennen.
  - Messungen: eine Messung, die beim Abschalten oder beim Wechsel auf einen
    `pixelZoom` unterwegs ist, wird verworfen.
  - »What to know about it«: `enabled = false` gibt »the `resolutionScale` it had
    when the controller took over last« zurück; eine disposte Display lässt ihren
    Controller los, und `display.adaptiveResolution` antwortet dann `undefined`.
  - Die Zeile zu `frame-pacing` und der CPU (»minScale is how far that goes«) bleibt.
  - »Measured« bleibt: die Wiese ist GPU-gebunden, ihr Abstieg gewinnt.
- `packages/twopoint5d/docs/architecture.md`, Absatz zu `display/` (`:144–147`), ein
  Satz: die Politik — Ratio-Schranken, Budget, Skala, Achtel-Rundung, Zoom in ganzen
  Device-Pixeln — ist eine reine Funktion in `src/display/resolveDrawingBuffer.ts`,
  mit der die Display misst und `AdaptiveResolution` ihre Schritte vorhersagt.
- `packages/twopoint5d/CHANGELOG.md`: `AdaptiveResolution` steht unter
  `## [Unreleased]` → `### Added` (Zeile 45) und war nie veröffentlicht. Deshalb
  **diesen Eintrag umschreiben**, keine `Fixed`-Einträge: Pacing an den
  Animation-Frames der Seite und an der Kadenz, die sie erreicht; Schritt hinauf aus
  der Ratio, die das Display zeichnen würde, Stufen ohne Ratio-Änderung
  übersprungen, Backoff nach einem gescheiterten Schritt; eine Messung, die beim
  Abschalten unterwegs ist, wird verworfen; `enabled = false`/`dispose()` geben die
  Skala der letzten Übernahme zurück; `Display#adaptiveResolution` antwortet nach
  dem Dispose `undefined`. Die interne Extraktion bekommt keinen Eintrag.

### Schritt 10 — Verify

`pnpm run ci` aus dem Repo-Root, Ausgabe und Exit-Code in den Report.

## Commit-Message

```text
fix(display): adaptive resolution paces by the frames the page reaches and steps by the pixels it draws

The pixel ratio and the drawing buffer of a display come from one pure
function, resolveDrawingBuffer(), which Display measures with and
AdaptiveResolution predicts its steps with.

- frame-pacing reads the intervals between the animation frames of the
  page, so a frame maxFps holds back is not late, and where a descent to
  minScale brings the frames no sooner at a steady pace it goes back and
  measures against that pace: a requestAnimationFrame held to 30 Hz no
  longer halves the resolution for nothing
- gpu-time predicts a step up from the pixel ratio the display would draw
  at, skips steps that leave the ratio as it is, and waits twice as long
  after a step up that did not hold
- enabled = false drops a GPU measurement still in flight; it and
  dispose() give back the scale the display had at the last takeover
- Display#adaptiveResolution answers undefined once the display is disposed
```

## Begründungen

- **Frame-Pacing: Gegenprobe statt gemessener Bildrate.** Die Empfehlung des Audits
  (`min(targetFps, FrameLoop.measuredFps)` oder der Median der Intervalle) misst
  unter Dauerlast mit: bei 42 ms GPU-Zeit pro Frame (die 4K-Wiese in »Measured«)
  liefert der rAF ~20 fps, das Ziel fiele auf 20, kein Frame wäre spät, und
  `frame-pacing` stiege nie ab. Aus Zeitstempeln allein ist ein auf 30 Hz gehaltener
  rAF von einer GPU, die 33 ms braucht, nicht zu unterscheiden; unterscheidbar wird
  es erst, wenn weniger Pixel probiert werden. Deshalb: der bestehende Abstieg
  bleibt, und erst ein Abstieg bis zum Boden ohne Gewinn bei gleichmäßigem Takt
  stellt zurück und übernimmt den Takt. Ein unregelmäßiger, CPU-gebundener Takt
  stellt nicht zurück — sonst pumpte die Auflösung alle paar Sekunden; dort bleibt
  es beim dokumentierten »minScale is how far that goes«. Das liegt im
  freigegebenen Ziel (»misst Frame-Pacing gegen die erreichbare Bildrate«); der
  Weg dorthin weicht nur in der Ermittlung der Kadenz vom Audit ab.
- **Animation-Frames statt Frame-Intervallen.** Ein `maxFps`, das kein Teiler der
  Bildwiederholrate ist (50 auf 60 Hz), liefert im Raster des `FrameLoop` jeden
  fünften Frame nach 33,3 ms — über 1,5 × 20 ms, also »spät«, obwohl kein vsync
  verpasst wurde. Nur der `FrameLoop` sieht die Ticks dazwischen; daher der interne
  Getter statt einer Schätzung des vsync aus den Frame-Intervallen, die bei Firefox'
  Zeitstempel-Jitter falsch gerundet würde.
- **Intern statt öffentlich.** `pixelRatioAt()`, `longestRafInterval` und das Modul
  `resolveDrawingBuffer` sind `@internal`: einziger Abnehmer ist der Controller im
  selben Modul, und die Entscheidung »neue öffentliche Symbole in `public-api.ts`«
  greift damit nicht. Vorbild im Repo: `FeatureSprites#judgeVisibility`,
  `TextureResource[changeRefCount]`, `frameUv`.
- **`#scaleBefore` je Übernahme.** Der TSDoc von `enabled` verspricht »the scale it
  had when the controller took over; `true` takes over again«. Eine Übernahme, die
  ihre Ausgangsskala nicht festhält, überschriebe beim nächsten Abschalten eine von
  Hand gesetzte Skala mit einer veralteten. Der Test, den das Finding zur
  Wiederherstellung nach Aus/Ein verlangt, braucht eine Erwartung; diese folgt dem
  TSDoc.
- **`Display#adaptiveResolution` nach dem Dispose `undefined`.** Folgt aus der
  verbindlichen Lifecycle-Regel §3.1 und ist die Prüfung, die das Finding mit
  »aufgeräumt« verlangt. Unveröffentlicht, also kein Bruch für Verbraucher.
- **CHANGELOG umschreiben statt `Fixed`.** Kein Release hatte das falsche Verhalten.
- **Ein Paket, nicht zwei.** Der Schnitt aus dem Grobplan hält: die Double-Tests
  brauchen `pixelRatioFor`, die Step-Logik braucht `pixelRatioAt`, und alle Tests
  teilen ein Double. Geteilt hieße zweimal derselbe Kontextaufbau.
- **Modell und Effort.** Stärkste Stufe und `high`: die Extraktion verändert den
  Messpfad jeder Display, die Pacing-Logik ist ein Zustandsautomat mit
  Randfällen, und eine Messung über Frames hinweg ist eine Nebenläufigkeitsfrage.

## Abgleich

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| BUG-001 | unverändert | `AdaptiveResolution.ts:329` `if (frameMs > (PACING_LATE_FACTOR * 1000) / this.targetFps)`; `:141` Default 60; `Display.ts:1242` `targetFps` aus `maxFps < 60` |
| ARCH-001 | unverändert | `Display.ts:1445–1470` `get pixelRatio()`, `:1744–1869` `#applyMeasuredSize()` mit Zoom-/Budget-Block `:1784–1830`; Datei 2306 Zeilen |
| BUG-003 | unverändert | `AdaptiveResolution.ts:314` `time * (up / this.scale) ** 2`, `:316–322` ohne Gedächtnis; `Display.ts:1469` Achtel-Rundung |
| ASYNC-001 | unverändert | `AdaptiveResolution.ts:280` Guard ohne `#enabled`; `:196–205` `set enabled(false)` ohne `#settle()` |
| TEST-001 | unverändert | `AdaptiveResolution.spec.ts:15–39` Stub löst im selben Frame auf, sendet Resize bei jeder Skalenänderung |
| TEST-003 | unverändert | `display-adaptive-resolution.test.js:21–36` keine Assertion nach dem Dispose; `Display.spec.ts:1921–1940` nur Konstruktion |

## Findings im Volltext

**BUG-001 · high · packages/twopoint5d/src/display/AdaptiveResolution.ts:329** — Frame-Pacing gegen die erreichbare Bildrate statt gegen 60 fps messen
(weitere Fundstellen: `AdaptiveResolution.ts:141`, `Display.ts:1242`)
Unter `frame-pacing` gilt ein Frame als spät, sobald `rawDeltaTime` über 1,5 × 1000/targetFps liegt — mit dem Default 60 fps also über 25 ms. Läuft der rAF der Seite mit 30 Hz (iOS-Low-Power-Mode, Chrome Energy Saver, 30-Hz-Panels, ein `maxFps`, das kein Teiler der Bildwiederholrate ist), ist jeder Frame »spät«, obwohl die GPU leer läuft. Der Controller geht alle 30+30 Frames eine Stufe hinunter bis `minScale`, jeder Probe-Schritt nach oben scheitert, und der Backoff wächst bis 3600 Frames. Ergebnis: halbe Auflösung ohne jeden Gewinn — genau auf den Geräten (Safari, Android/WebGL ohne Timer-Extension), auf denen `frame-pacing` überhaupt greift.
Beleg: `if (frameMs > (PACING_LATE_FACTOR * 1000) / this.targetFps) this.#pacingLateFrames += 1;` — targetFps ist 60, sofern weder Option noch `maxFps < 60` etwas anderes sagen
Empfehlung: Das Ziel-Intervall an der tatsächlich erreichbaren Kadenz festmachen: z. B. min(targetFps, gemessene Bildrate) aus `FrameLoop.measuredFps` oder dem Median der sauberen `rawDeltaTime`-Werte; einen Frame nur dann als spät zählen, wenn er gegenüber diesem Grundtakt einen vsync verpasst. Unit-Test mit 33-ms-Frames und Default-Optionen ergänzen; docs/display.md um den Fall ergänzen.

**ARCH-001 · medium · packages/twopoint5d/src/display/Display.ts:1445** — Pixel-Ratio- und Zoom-Politik aus `Display` in eine reine Funktion herausziehen
(weitere Fundstellen: `Display.ts:1744`, `AdaptiveResolution.ts:314`)
`Display.ts` hat 2306 Zeilen und trägt Canvas-Übernahme und -Rückgabe, WebGL-Kontext-Wiederherstellung, GPU-Release-Choreografie, Zustandsmaschine, Resize-Modell samt Observern und jetzt zusätzlich die Auflösungspolitik (Ratio-Schranken, Budget, Skala, Achtel-Rundung, ganzzahliger Device-Pixel-Zoom). Die Politik ist über den `pixelRatio`-Getter und `#applyMeasuredSize()` verteilt, liest private Felder (`#contentWidth`) und lässt sich nur über ein komplettes Display mit DOM testen. `AdaptiveResolution` muss deshalb die Kosten einer Stufe mit `(up/scale)²` raten, statt die Ratio zu erfragen, die das Display für diese Stufe wählen würde.
Beleg: `get pixelRatio()` (Display.ts:1445–1470) und der Zoom-/Budget-Block in `#applyMeasuredSize()` (Display.ts:1784–1830)
Empfehlung: Eine reine Funktion `resolveDrawingBuffer({cssWidth, cssHeight, devicePixelRatio, maxPixelRatio, maxPixels, resolutionScale, pixelZoom, maxResolution})` in ein eigenes Modul legen, die Ratio, Buffer-Größe, CSS-Größe und `devicePixelZoom` liefert; `Display` und `AdaptiveResolution` nutzen sie beide, und die Grenzfälle werden ohne DOM unit-testbar.

**BUG-003 · medium · packages/twopoint5d/src/display/AdaptiveResolution.ts:314** — Step-up unter gpu-time aus der tatsächlichen Pixel-Ratio vorhersagen und mit Backoff absichern
(weitere Fundstellen: `Display.ts:1469`, `AdaptiveResolution.ts:316`)
Der Schritt nach oben schätzt die Kosten der nächsten Stufe mit `(up / scale)²`. Das Display rundet die Ratio aber auf Achtel ab, sobald Budget oder Skala sie bestimmen. Mit `maxPixels` weicht das massiv ab: Budget-Ratio 0,6 → Skala 1 ergibt 0,5, Skala 0,875 ebenfalls 0,5 (Schritt ohne Wirkung, ohne Resize, ohne Settle), Skala 0,75 ergibt 0,375. Der Schritt 0,75 → 0,875 wird mit Faktor 1,36 geschätzt, kostet real 1,78. Bei 8 ms GPU-Zeit prognostiziert der Controller 10,9 ms < 12 ms und steigt, misst real ~14,2 ms > 13,3 ms und fällt wieder — alle drei Fenster plus 30 Settle-Frames, also eine sichtbare Auflösungs-Pumpe im Sekundentakt mit Neuaufbau aller Render-Targets. Anders als `frame-pacing` hat `gpu-time` kein Gedächtnis für einen gescheiterten Aufstieg.
Beleg: `if (up != null && time * (up / this.scale) ** 2 < budget * GPU_STEP_UP_SHARE)` gegen `return stepped ? Math.max(PIXEL_RATIO_STEP, Math.floor(ratio / PIXEL_RATIO_STEP + 1e-9) * PIXEL_RATIO_STEP) : ratio;`
Empfehlung: Die Vorhersage auf die Pixelzahl stützen, die das Display für die nächste Stufe tatsächlich wählen würde (Ratio-Berechnung als Funktion `pixelRatioFor(scale)` herausziehen und wiederverwenden), Stufen ohne Ratio-Änderung überspringen, und einen gescheiterten Aufstieg wie bei frame-pacing mit wachsender Wartezeit belegen.

**ASYNC-001 · medium · packages/twopoint5d/src/display/AdaptiveResolution.ts:280** — Laufende GPU-Messung beim Abschalten des Controllers verwerfen
(weitere Fundstelle: `AdaptiveResolution.ts:196`)
`enabled = false` setzt `display.resolutionScale` auf den alten Wert zurück, erhöht aber weder `#epoch` noch leert es `#gpuSamples`. Eine `resolveTimestampsAsync()`-Messung, die zu diesem Zeitpunkt unterwegs ist, landet danach trotzdem: der Callback prüft nur `#disposed` und die Epoche, nicht `#enabled`. Steht das Fenster bei 11 von 12 Samples, ruft der Callback `#judgeGpuWindow()` → `#setLevel()` und überschreibt die gerade zurückgegebene Skala des Displays — ein abgeschalteter Controller ändert die Auflösung. Dasselbe Loch besteht beim Wechsel auf `pixelZoom > 0`, wo es nur folgenlos bleibt, weil der Zoom die Skala ignoriert.
Beleg: `if (this.#disposed || epoch !== this.#epoch || !isPositiveFinite(ms)) return;` — `set enabled(false)` ruft weder `#settle()` noch erhöht es `#epoch`
Empfehlung: Im Promise-Callback zusätzlich `!this.#enabled` prüfen, und `set enabled(false)` sollte `#settle()` aufrufen (Epoche hoch, Samples leeren). Test: Messung künstlich verzögern, währenddessen `enabled = false`, dann auflösen.

**TEST-001 · medium · packages/twopoint5d/src/display/AdaptiveResolution.ts:277** — `AdaptiveResolution` gegen ein realistisches Display-Double und gegen Rundung/Budget testen
(weitere Fundstellen: `AdaptiveResolution.ts:314`, `:329`, `AdaptiveResolution.spec.ts:15`)
Die Unit-Tests (`AdaptiveResolution.spec.ts`) laufen gegen einen Stub, der jede Messung im selben Frame per Microtask auflöst und bei jeder Skalenänderung einen Resize sendet. Damit bleiben genau die Grenzfälle ungeprüft, an denen der Controller kippt: eine Messung, die über `enabled = false`/`pixelZoom` hinweg unterwegs ist; Skalenstufen, die wegen der Achtel-Rundung oder `maxPixels` die Ratio nicht ändern und deshalb keinen Resize auslösen; Frame-Pacing bei 30-Hz-rAF; die Wiederherstellung von `#scaleBefore` nach Aus/Ein. Der Browser-Test in `twopoint5d-testing` prüft nur, dass überhaupt eine Methode gewählt wurde. Dieselbe Lücke meldet der Blick aufs Harness: der Stub der Spec bildet den echten Display-Vertrag (Resize nur bei tatsächlicher Ratio-Änderung, Messungen über Frames hinweg) nicht ab.
Beleg: Stub: `resolveTimestampsAsync: vi.fn(() => Promise.resolve(gpu.ms))`, `if (display.resolutionScale !== measuredScale) emit(display, OnDisplayResize, {})`
Empfehlung: Ein Double bauen, das die Ratio wie `Display#pixelRatio` rechnet (oder den Controller gegen ein echtes `Display` mit gemocktem Renderer testen), Messungen manuell auflösbar machen, und Tests für die vier genannten Fälle ergänzen.

**TEST-003 · medium · packages/twopoint5d-testing/test/display-adaptive-resolution.test.js:20** — Display-Dispose gegenüber AdaptiveResolution tatsächlich prüfen
(weitere Fundstellen: `Display.spec.ts:1922`, `AdaptiveResolution.spec.ts:330`)
Der Browsertest verspricht im Titel »and lets go of the display with it«, behauptet aber nach dem Dispose nichts; der Dispose läuft nur im afterEach. Display.spec.ts testet vier Fälle des adaptiveResolution-Options (gebaut/nicht gebaut/Optionen durchgereicht), aber nicht, dass display.dispose() den Controller loslässt, dass dispose() des Controllers seine Listener vom echten Display entfernt (resolutionScale zurück, kein Weiterlaufen von resolveTimestampsAsync) oder dass ein Neustart (restart) den Controller berührt. Das Loslassen wird nur gegen einen eventize-Stub emuliert (OnDisplayDispose per emit), nicht gegen den echten Display. Ein Listener-Leak zwischen Display und Controller bliebe unbemerkt.
Beleg: `it('reads the cost of its frames in one of its two ways, and lets go of the display with it'` — letzte Assertion: `expect(display.resolutionScale, ...).to.equal(adaptive.scale)`
Empfehlung: In Display.spec.ts einen Test ergänzen: Display mit adaptiveResolution erzeugen, dispose(), danach Frame-Event/Resize emittieren und prüfen, dass der Controller nichts mehr schreibt und display.adaptiveResolution aufgeräumt ist; im Browsertest nach display.dispose() den Controller-Zustand (isDisposed o. ä.) prüfen oder den Titel kürzen.
