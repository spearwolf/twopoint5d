# Paket 3 — Display: Größe, Pixelbudget und Messung

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-012 (low), PERF-003 (low), API-003 (low), PERF-004 (low), PERF-015 (low), DX-001 (low)
- Ziel: `pixelZoom`, `maxPixels` und `resolutionScale` verhalten sich auf jedem Canvas wie dokumentiert, das Budget hält auch beim Supersampling, und die Codeblöcke in `docs/display.md` laufen durch die Typprüfung.
- Modell: stärkste Stufe — sechs Findings über Auflösungspolitik, Messung, Allokations-Spec und Doku; der Fix am selbstvermessenden Canvas ist eine Rückkopplung über das Layout des Browsers (das Display misst, was es selbst in den Inline-Style geschrieben hat), und die Allokations-Spec muss die Boxing-Regeln aus `AGENTS.md` einhalten
- Effort: medium — gewöhnliche Bugfixes mit Regressionstests in einem Modul; Namen und Werte stehen unten, die Formulierung von TSDoc und Doku nicht wörtlich
- Dateien:
  - `packages/twopoint5d/src/display/resolveDrawingBuffer.ts`, `resolveDrawingBuffer.spec.ts`
  - `packages/twopoint5d/src/display/Display.ts`, `Display.spec.ts`
  - `packages/twopoint5d/src/display/AdaptiveResolution.ts` (zwei Zoom-Abfragen, TSDoc), `AdaptiveResolution.spec.ts` (Stub-Display, ein Test)
  - `packages/twopoint5d/src/display/types.ts` (TSDoc von `DisplayParameters.adaptiveResolution`)
  - neu: `packages/twopoint5d/src/display/hot-path-allocations.spec.ts`
  - `packages/twopoint5d-testing/test/display-resize.test.js`
  - `packages/twopoint5d/docs/display.md`
  - `packages/twopoint5d/CHANGELOG.md` (nur `## [Unreleased]`)
- Vorgehen: siehe unten, Schritte 1–7. Vor der ersten Änderung `AGENTS.md` lesen und das Modul `src/display/` als Ganzes (`Display.ts`, `resolveDrawingBuffer.ts`, `AdaptiveResolution.ts`, `types.ts`), nicht per grep. Für den CHANGELOG den Skill `updating-changelog` laden.
- Verify: `pnpm run ci`
  - zum Iterieren: `pnpm nx test twopoint5d -- src/display/` · `pnpm test:allocations` · `pnpm build:twopoint5d && pnpm typecheck` (Specs, Browsertests und `ts check`-Blöcke laufen gegen die gebaute Bibliothek) · `pnpm test:browser`
- Commit: `fix(display): keep the size of a canvas that measures itself through changes of the zoom, count a zoom or a budget that is not a positive finite number as 0, hold maxPixels after a resolution scale above 1, measure without allocating a result, say that an adaptive display tracks timestamps for the life of its renderer, and type-check the examples of the display guide`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · BUG-012 unverändert, nach `resolveDrawingBuffer.ts:142-145` und `Display.ts:1826` gewandert (`328f7a8e` hat die Auflösungspolitik ausgelagert) · PERF-003 umgeformt: der NaN-Zoom ist abgefangen (`resolveDrawingBuffer.ts:112-114`, `Display.ts:1560`), offen bleiben `pixelZoom = Infinity` und `maxPixels = NaN` (`Display.ts:1560`, `:1570`, `:1578`, `resolveDrawingBuffer.ts:72`, `:114`) · API-003 unverändert, nach `resolveDrawingBuffer.ts:80-92` gewandert · PERF-004 unverändert (`Display.ts:1190`) · PERF-015 unverändert (`resolveDrawingBuffer.ts:160`, keine Allokations-Spec unter `src/display/`) · DX-001 unverändert (`docs/display.md:85`, `:163`) · keine Folgen offen (Paket 1 und 2: `Folgen: keine`) · Queue-Eintrag `OPENING_FENCE` hat eine andere Ursache, bleibt liegen · Restplan: Paket 4 hängt jetzt von Paket 3 ab
  - 2026-10-22 Zug 1: Implementierer beauftragt (Runde 0), Modell opus (stärkste Stufe), Effort medium, Brief `paket-3.impl-0.brief.md`
  - 2026-10-22 Zug 2: Report `FERTIG` (`paket-3.impl-0.json`, Session 7036705f) · 10 Dateien geändert, neu `src/display/hot-path-allocations.spec.ts` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-3.verify.log`)
  - 2026-10-22 Zug 3: Reviewer (opus, medium, `paket-3.review-0.json`) · alle sechs Findings behoben · 1 wichtig (»then« in der Timestamp-Doku `docs/display.md:277`, `types.ts:76-77` ohne klares Subjekt), 2 klein · Diff `paket-3.diff`
  - 2026-10-22 Zug 4 Runde 1: offen 1 wichtig (+1 klein, Zeilenlänge `types.ts:79`) · Resume Session 7036705f (opus, medium), Brief `paket-3.impl-1.brief.md`
    → Report `FERTIG` (`paket-3.impl-1.json`): Subjekt »A renderer the display built with `trackTimestamp: true`« in `docs/display.md`, `types.ts`, `AdaptiveResolution.ts` (gpu-time), CHANGELOG; Absätze umbrochen · Verify `pnpm run ci` exit=0 (`paket-3.verify-1.log`, Browsertests ohne Cache) · Diff `paket-3.r1.diff`
    → Review Runde 1 (`paket-3.review-1.json`): wichtig und klein erledigt, keine neuen Befunde
  - 2026-10-22 Zug 5: Commit fab33a53 (11 Dateien, +519 −58), Trailer `Remediation-Run: 2026-10-21`, getragen von `paket-3.verify-1.log` exit=0

## Reviewer-Urteil

Review 0 (`paket-3.review-0.json`) und Review 1 (`paket-3.review-1.json`), beide opus/medium:

- **BUG-012 — behoben.** `readsBackWrittenSize()` in `resolveDrawingBuffer.ts:20-29`; Felder `Display.ts:707-717`; Basis in `#applyMeasuredSize()` `Display.ts:1801-1810`, gezoomte Größe `:1853-1857`; beide `box-sizing`-Zweige nachgerechnet; Fit-Beispiel auf `resize-to="window"` (`docs/display.md:127-128`); Tests in `Display.spec.ts` und `display-resize.test.js:416-445`.
- **PERF-003 — behoben.** `isPositiveFinite` in `resolveDrawingBuffer.ts:84`, `:134`, `Display.ts:1605`, `:1692`, `AdaptiveResolution.ts` (`#onRenderFrame`, `#sampleGpuTime`); `maxPixels` einmal normalisiert in `#resize()`; kein `pixelZoom > 0` mehr gegen einen Rohwert.
- **API-003 — behoben.** `budgetRatio` und `Math.min(ratio * resolutionScale, budgetRatio)` in `resolveDrawingBuffer.ts:96-110`; TSDoc von `pixelRatioFor`, `Display.pixelRatio`, `maxPixelRatio`, `maxPixels`, `resolutionScale`, `AdaptiveResolutionOptions.maxScale`; Doku »A budget of pixels«, »Resolution scale«, Formel.
- **PERF-004 — behoben** (nur Doku, wie entschieden). `docs/display.md` »What to know about it«, `types.ts:76-79`, Klassen-TSDoc `AdaptiveResolution` (gpu-time); Subjekt nach Runde 1 eindeutig (»A renderer the display built with `trackTimestamp: true`«).
- **PERF-015 — behoben.** `out`-Parameter und `requestedWidth`/`requestedHeight` (`resolveDrawingBuffer.ts:127-157`), Feld `#drawingBuffer` (`Display.ts:893-903`), neue `src/display/hot-path-allocations.spec.ts` mit vier Runden (unverändert, Budget plus Skala, Zoom, über `MaxResolution`).
- **DX-001 — behoben.** Beide Blöcke als `ts check` (`docs/display.md:157-171`, `:247-255`).

Kleine Befunde (keine Runde ausgelöst):

- `hot-path-allocations.spec.ts`: alle Runden laufen über den `resizeTo`-Callback, wo `measuresItself` immer `false` ist; der Zweig für ein selbstvermessendes Canvas (ResizeObserver-Pfad, nicht Poll-Pfad) ist auf Allokationsfreiheit unbelegt.
- (erledigt in Runde 1) `types.ts:79` Zeile mit 149 Zeichen.

Nebenbefunde aus dem Report: Rückblick im CHANGELOG-Eintrag `Display#pixelZoom` (`CHANGELOG.md:71`) → »Offene Befunde«, `→ Scope`, weil die Scope-Regel jede Kategorie umfasst und der Satz schon vor dem Lauf da stand (`git show 698715a3:packages/twopoint5d/CHANGELOG.md`). `median()` kopiert je GPU-Fenster (`AdaptiveResolution.ts:73-77`) ist PERF-014 aus Paket 4, kein neuer Eintrag. Template-Strings über 130 Zeichen in `Display.ts:48`, `:121`, `:324`: kein Mangel, Biome bricht Strings nicht um und `pnpm lint` ist grün — nicht in die Queue.

## Abgleich

Die Entscheidung vom 2026-10-21 verlangt, jedes Display-Finding zuerst gegen den
Code nach `328f7a8e` zu prüfen. Ergebnis: **keins ist überholt**, alle sechs werden
umgesetzt.

- **BUG-012** — unverändert. `resolveDrawingBuffer.ts:142-145` schreibt unter
  einem Zoom `cssWidth = cssWidth - wPx + width * cssPerPixel`, `Display.ts:1826`
  legt das als Inline-Breite auf das Canvas, und ein Canvas, das seine eigene
  Größenquelle ist, misst beim nächsten Mal genau diese Breite. Nachgerechnet bei
  DPR 1, 1000 px: Zoom 3 → 999 px, Zoom 2 → 998 px, Zoom 3 → 996 px, Zoom 0 → 996 px.
  `DEVICE_PIXEL_SIZE_TOLERANCE` (`resolveDrawingBuffer.ts:16`) fängt nur das
  1/64-Raster des Layouts ab, nicht den Verlust eines ganzen Art-Pixels; der
  bestehende Test `keeps its size where the canvas measures itself and reads back
  its size on the grid of the layout` (`Display.spec.ts:1149`) prüft nur einen
  gleichbleibenden Zoom. Das Fit-Beispiel `docs/display.md:56-73` baut das Display
  weiter auf einem selbstvermessenden Canvas und rechnet den Zoom aus
  `window.innerWidth`.
- **PERF-003** — umgeformt. Ein Zoom von `NaN` oder negativ zählt inzwischen als 0
  (`resolveDrawingBuffer.ts:112-114`, `Display.ts:1560`). Offen: `pixelZoom =
  Infinity` besteht `> 0`, ergibt `devicePixelZoom = Infinity`, `width = 0` und
  `cssWidth = Math.max(0, NaN) = NaN`; `#appliedCssWidth` vergleicht dann nie gleich,
  jede Messung ruft `setDrawingBufferSize()` und sendet `OnDisplayResize`, im
  Poll-Pfad in jedem Frame, und `canvas.style.width` bekommt `"NaNpx"`.
  `maxPixels = NaN` lässt `this.maxPixels === this.#appliedMaxPixels`
  (`Display.ts:1570`) in jedem Frame scheitern: jeder Frame misst mit
  `getBoundingClientRect()`. Die TSDoc von `maxPixels` (`Display.ts:801`) sagt,
  ein nicht positiver endlicher Wert zähle als 0.
- **API-003** — unverändert, verschoben. `pixelRatioFor()`
  (`resolveDrawingBuffer.ts:80-92`) wendet das Budget **vor** der Skala an und
  multipliziert danach ungebremst: `resolutionScale = 2` auf einem 4K-Schirm mit
  `maxPixels: 3_000_000` ergibt 1.125 statt höchstens 0.6. Die TSDoc von
  `maxPixels` (`Display.ts:790-792`) verspricht das Gegenteil, die von
  `maxPixelRatio` (`:767-785`) und `resolutionScale` (`:808-818`) schweigen zu
  Werten über 1. Die Entscheidung vom 2026-10-21 legt den Weg fest: Supersampling
  bleibt erlaubt, `maxPixels` ist auch nach der Skala eine harte Obergrenze.
- **PERF-004** — unverändert. `Display.ts:1190` setzt `trackTimestamp: true` für die
  Lebensdauer des Renderers; `AdaptiveResolution` nimmt es weder bei `enabled =
  false` noch bei `dispose()` noch unter einem Zoom zurück, und `docs/display.md`
  sagt nichts dazu.
- **PERF-015** — unverändert. `resolveDrawingBuffer()` gibt bei jeder Messung ein
  neues Objekt zurück (`resolveDrawingBuffer.ts:160`), dazu ein Tupel
  `requestedSize`, wo der Puffer über `maxResolution` läge (`:137`, `:149`). Unter
  `src/display/` gibt es keine `hot-path-allocations*.spec.ts`.
- **DX-001** — unverändert. `docs/display.md:85` (Pointer-Handler, eingerückt im
  Listenpunkt) und `:163` (`new Display(canvas, {adaptiveResolution: {…}})`) tragen
  nur `ts` und nutzen ein undeklariertes `canvas`.

## Entscheidungen dieses Zugs

- **PERF-004 nur Doku, kein Zurücknehmen zur Laufzeit.** Die Empfehlung macht das
  Zurücknehmen davon abhängig, dass three es zulässt. three 0.186 lässt es nicht
  sauber zu: `WebGPUBackend.initTimestampQuery()` setzt `descriptor.timestampWrites`
  nur, nimmt es nie zurück, und `_getDefaultRenderPassDescriptor()` hält den
  Descriptor des Canvas in `canvasData.descriptor` zwischen den Frames. Ein
  `backend.trackTimestamp = false` stoppt Allokation und Auflösung der Queries,
  nicht aber die Timestamp-Writes jedes Passes — und es setzt ein Feld des
  Backends, das three bei `init()` aus dem Feature `timestamp-query` ableitet. Der
  dokumentierte Ausweg existiert schon: `rendererOptions` stehen im Konstruktor
  hinter `trackTimestamp: true` (`Display.ts:1190-1191`), ein
  `trackTimestamp: false` neben der Option gewinnt (Browsertest
  `display-constructor.test.js:64-77`), und der Controller liest dann das
  Frame-Pacing.
- **BUG-012: die ungezoomte Größe als Basis behalten**, nicht `object-fit`. Ein
  Canvas mit voller CSS-Größe und kleinerem Puffer würde die Pixel ungleich
  strecken oder, mit `object-fit: none`, ungezoomt zeichnen; beides bricht die
  Zusage ganzer Device-Pixel. Das Fit-Beispiel wird zusätzlich auf
  `resize-to="window"` umgestellt, weil es den Zoom aus dem Fenster rechnet — so
  wie der Sine-Scroller des Lookbooks (`apps/lookbook/src/layouts/VanillaDemo.astro:55`).
- **CHANGELOG: bestehende `[Unreleased]`-Einträge ergänzen**, keine
  `Fixed`-Einträge. `maxPixels`, `resolutionScale`, `maxPixelRatio`,
  `AdaptiveResolution` und das neue `pixelZoom`-Verhalten sind noch unveröffentlicht
  (`### Added` bzw. `### Changed` unter `[Unreleased]`); ein Fix an einem nie
  veröffentlichten Verhalten ist für Leser des Changelogs kein Ereignis. Kein
  Migrationshinweis.
- **Allokations-Spec misst `display.resize()`, nicht `renderFrame()`.**
  `renderFrame()` allokiert die Event-Props absichtlich neu (`Display.ts:2198-2200`,
  `getEventProps()`); `resize()` misst bei jedem Aufruf und läuft durch denselben
  Mess- und Auflösungspfad wie der Poll-Pfad eines Frames.

## Vorgehen

### 1. Zoom und Budget, die keine positive endliche Zahl sind, zählen als 0 (PERF-003)

Jede Stelle, die einen Zoom als »an« prüft, nimmt `isPositiveFinite()` aus
`../utils/isPositiveFinite.js` statt `> 0`; wo der Wert gebraucht wird,
`isPositiveFinite(x) ? x : 0`. Die Liste ist vollständig (grep über `src/`):

- `resolveDrawingBuffer.ts:72` `pixelRatioFor()`: `if (isPositiveFinite(params.pixelZoom))`.
- `resolveDrawingBuffer.ts:114`: `const pixelZoom = isPositiveFinite(params.pixelZoom) ? params.pixelZoom : 0;` — den Kommentar `:112-113` so fassen, dass er beide Fälle trägt: `NaN` vergliche nie gleich, `Infinity` ergäbe einen Puffer ohne Pixel auf einem Canvas von `NaN` CSS-Pixeln.
- `Display.ts:1560` in `#resize()`: `const zoom = isPositiveFinite(this.pixelZoom) ? this.pixelZoom : 0;`
- `Display.ts:1570` und `:1578`: vor `if (fromFrame)` einmal `const maxPixels = isPositiveFinite(this.maxPixels) ? this.maxPixels : 0;`, dann `maxPixels === this.#appliedMaxPixels` im Vergleich und `this.#appliedMaxPixels = maxPixels;`.
- `Display.ts:1647` `#applyImageRendering()`: `isPositiveFinite(this.pixelZoom) ? 'pixelated' : 'auto'`.
- `AdaptiveResolution.ts:321` (`#onRenderFrame`) und `:355` (`#sampleGpuTime`): `isPositiveFinite(this.display.pixelZoom)` statt `this.display.pixelZoom > 0` — der Controller hält genau dann still, wenn das Display zoomt.
- `AdaptiveResolution.spec.ts:99`, Stub-Display: `const pixelZoom = isPositiveFinite(display.pixelZoom) ? display.pixelZoom : 0;` — der Stub spiegelt die Messung des Displays.
- TSDoc `Display.pixelZoom` (`Display.ts:747-765`): Satz ergänzen »A value that is not a positive finite number counts as `0`.«, in der Form der Nachbarn `maxPixelRatio`/`maxPixels`.

Regressionstests, vor dem Fix rot:

- `resolveDrawingBuffer.spec.ts:169` `takes a pixelZoom of %s as 0`: `Number.POSITIVE_INFINITY` in die Liste; die Erwartung prüft, dass `cssWidth` endlich ist und das Ergebnis dem ohne Zoom gleicht. Dazu ein `pixelRatioFor()`-Fall mit `pixelZoom: Infinity`, der den `devicePixelRatio` liefert, nicht `1`.
- `Display.spec.ts`, `describe('size watch')` (ab `:1265`): `measures nothing in the frames after the first while maxPixels is NaN` — `display.maxPixels = Number.NaN`, Start, zwei Frames, dann zählt `canvas.getBoundingClientRect.mock.calls.length` in den Frames danach nicht weiter.
- `Display.spec.ts`: `counts a pixelZoom of Infinity as no zoom` — ein pollendes Display (`resizeTo: () => SIZE` mit konstantem Tupel), `pixelZoom = Infinity`; nach dem ersten Frame kein weiterer `setDrawingBufferSize()`-Aufruf und kein `OnDisplayResize` über mehrere Frames, `canvas.style.width` endet auf eine endliche Zahl `px`, `devicePixelZoom` ist `0`, `canvas.style.imageRendering` ist `'auto'`.

### 2. Das Budget hält auch nach der Skala (API-003)

`pixelRatioFor()` in `resolveDrawingBuffer.ts`:

- `let budgetRatio = Number.POSITIVE_INFINITY;` vor dem Budget-Block; im Block `budgetRatio = Math.sqrt(maxPixels / area);` und wie bisher `if (budgetRatio < ratio) { ratio = budgetRatio; stepped = true; }`.
- Skala: `ratio = Math.min(ratio * resolutionScale, budgetRatio);` statt `ratio *= resolutionScale;`, mit Kommentar: über 1 zeichnet die Skala über `maxPixelRatio` hinaus — Supersampling —, das Budget hält auch danach.
- Die Rundung auf ein Achtel danach bleibt (`Math.floor(… + 1e-9)`, mindestens ein Achtel): abgerundet bleibt der Puffer im Budget.

TSDoc, Wortlaut frei, Inhalt fest (Entscheidung vom 2026-10-21):

- `pixelRatioFor()` (`resolveDrawingBuffer.ts:64-69`) und `Display.pixelRatio` (`Display.ts:1441-1446`): »… times `resolutionScale`, and bounded by `maxPixels` after the scale as well — rounded down …«.
- `Display.maxPixelRatio` (`Display.ts:767-785`): ein `resolutionScale` über 1 zeichnet über diese Schranke hinaus (Supersampling); `maxPixels` begrenzt auch das.
- `Display.maxPixels` (`Display.ts:787-806`): der Puffer hält höchstens so viele Pixel, gleich wie groß oder dicht der Schirm ist und gleich welcher `resolutionScale` — das Budget begrenzt die Ratio auch nach der Skala.
- `Display.resolutionScale` (`Display.ts:808-818`): über 1 zeichnet das Display mehr Pixel, als `maxPixelRatio` erlaubt — Supersampling, eine Skala von 1.5 schattiert 2.25-mal so viele —, nie aber mehr, als `maxPixels` erlaubt.
- `AdaptiveResolutionOptions.maxScale` (`AdaptiveResolution.ts:21-25`): über 1 geht der Controller über `maxPixelRatio` hinaus, innerhalb von `maxPixels`; ein Schritt, den das Budget auf dieselbe Ratio klemmt, wird übersprungen (das steht für Schritte schon in der Klassen-TSDoc).

Regressionstests:

- `resolveDrawingBuffer.spec.ts`, `describe('pixelRatioFor()')`: `holds the budget after a resolutionScale above 1` — `params({contentWidth: 3840, contentHeight: 2160, devicePixelRatio: 2, maxPixels: 3_000_000, resolutionScale: 2})` → `0.5` (vor dem Fix `1.125`, rot).
- ebenda: `draws beyond maxPixelRatio with a resolutionScale above 1` — `params({devicePixelRatio: 2, maxPixelRatio: 2, resolutionScale: 1.5})` → `3`. Vor und nach dem Fix grün; hält die Entscheidung fest, dass Supersampling erlaubt bleibt.
- `Display.spec.ts`, neben dem Test bei `:956`: `holds maxPixels after a resolutionScale above 1` — `resizeTo: () => [3840, 2160]`, DPR 2, `maxPixels = 3_000_000`, `resolutionScale = 2`, `resize()` → `setDrawingBufferSize` zuletzt mit `(3840, 2160, 0.5)` (rot vor dem Fix).
- `AdaptiveResolution.spec.ts`: `holds a maxScale above 1 to the budget of the display` — auf `BUDGET_4K` (`:127`) mit `{maxScale: 1.5}`: `display.pixelRatioAt(adaptive.scale)` ist `0.5`, und nach Fenstern mit viel Luft geht der Controller über keine Ratio jenseits des Budgets.

### 3. Ein selbstvermessendes Canvas behält seine Größe über Zoomwechsel (BUG-012)

Neue Hilfsfunktion in `resolveDrawingBuffer.ts`, neben `DEVICE_PIXEL_SIZE_TOLERANCE`
(die Konstante bleibt unexportiert):

```ts
/**
 * Whether `measured`, a size in CSS pixels that a canvas which is its own size source reads back,
 * is the size `written` that a pixel zoom left in its inline style: the layout holds a size to
 * its grid and reads it back up to DEVICE_PIXEL_SIZE_TOLERANCE device pixels short. `false` where
 * `written` is NaN.
 *
 * @internal
 */
export function readsBackWrittenSize(measured: number, written: number, devicePixelRatio: number): boolean {
  return Math.abs(measured - written) * devicePixelRatio <= DEVICE_PIXEL_SIZE_TOLERANCE;
}
```

In `Display.ts` vier Felder neben `#measuredWidth`/`#measuredHeight` (`:698-699`),
mit einem Kommentar, der das Warum trägt: ein Canvas, das seine eigene Größenquelle
ist, misst, was das Display in seinen Inline-Style geschrieben hat; unter einem
Zoom ist das die Größe der ganzen Pixel, bis zu einem Pixel kürzer als das Canvas
war, und als Basis des nächsten Zooms gemessen schrumpfte es mit jedem Zoomwechsel.

```ts
#selfSizeBaseWidth = 0;
#selfSizeBaseHeight = 0;
// NaN while the last measurement wrote no zoomed size into a canvas that measures itself
#selfSizeZoomedWidth = Number.NaN;
#selfSizeZoomedHeight = Number.NaN;
```

`#applyMeasuredSize(canvas)` (`Display.ts:1748`), ganz am Anfang, nach
`let wPx = this.#measuredWidth; let hPx = this.#measuredHeight;` und **vor**
`let cssWidth = wPx;` — so trägt die Ersetzung beide `box-sizing`-Zweige:

```ts
const sizeRefElement = this.#sizeSourceElement;
// a callback answers the size itself, and the window has no inline style to read back
const measuresItself = this.resizeToCallback == null && !this.#sizeSourceIsWindow && sizeRefElement === canvas;
const devicePixelRatio = this.devicePixelRatio;
if (measuresItself) {
  if (readsBackWrittenSize(wPx, this.#selfSizeZoomedWidth, devicePixelRatio)) wPx = this.#selfSizeBaseWidth;
  else this.#selfSizeBaseWidth = wPx;
  if (readsBackWrittenSize(hPx, this.#selfSizeZoomedHeight, devicePixelRatio)) hPx = this.#selfSizeBaseHeight;
  else this.#selfSizeBaseHeight = hPx;
}
```

(die bestehende Zeile `const sizeRefElement = this.#sizeSourceElement;` bei `:1754`
wandert damit nach oben, nicht doppelt.) Direkt nach `resolveDrawingBuffer(…)` und
**vor** dem Vergleich mit den `#applied*`-Feldern:

```ts
const zoomedItself = measuresItself && buffer.pixelZoom > 0;
this.#selfSizeZoomedWidth = zoomedItself ? (buffer.width * buffer.devicePixelZoom) / devicePixelRatio : Number.NaN;
this.#selfSizeZoomedHeight = zoomedItself ? (buffer.height * buffer.devicePixelZoom) / devicePixelRatio : Number.NaN;
```

`width * devicePixelZoom / devicePixelRatio` ist der Inhaltsanteil dessen, was
`resolveDrawingBuffer()` in `cssWidth` schreibt (`cssWidth - wPx + width *
cssPerPixel`), in beiden `box-sizing`-Fällen; die Messung liest genau ihn zurück.
Ändert der Nutzer die Inline-Größe selbst, liest das Canvas etwas anderes zurück
und die neue Größe wird zur Basis. Der Grenzfall, dass er genau die gezoomte Größe
schreibt, ist nicht unterscheidbar und bleibt bei der Basis — gehört als Halbsatz
in den Kommentar.

TSDoc `Display.pixelZoom` (`:760-763`): ein Canvas, das seine eigene Größenquelle
ist, behält die Größe, die es ohne den Zoom hatte, als Größenquelle; ein Wechsel des
Zooms lässt es nicht Pixel um Pixel schrumpfen.

Regressionstests, vor dem Fix rot:

- `Display.spec.ts`, `describe('pixelZoom in whole device pixels')` (ab `:1074`): `keeps the size it had without a zoom where the canvas measures itself, through changes of the zoom` — `stubDevicePixelRatio(1)`, `makeDisplay()`, `canvas.getBoundingClientRect` liest die Inline-Größe zurück wie im Test bei `:1149`, Start-Style `1000px × 600px`. Je Zoom zwei `resize()` (der zweite misst den eigenen Schreibvorgang, wie es der ResizeObserver auslöst): Zoom 3 → `width` 333, Style `999px`; Zoom 2 → `width` 500 (rot: 499), Style `1000px`; Zoom 3 → 333, `999px` (rot: 332, `996px`); Zoom 0 → `width` 1000, Style `1000px` (rot: 996).
- ebenda: `takes a size of the canvas that the display did not write as the new base` — unter Zoom 2 `canvas.style.width = '800px'`, `resize()` → `width` 400; dann Zoom 0 → `800px`.
- `display-resize.test.js`, neben `pixelZoom keeps the size of a canvas that measures itself, frame after frame` (`:387`): `pixelZoom 3, 2, 3 and 0 give a canvas that measures itself its size back` — `emulateDevicePixelRatio(1)`, Host 1000 × 600, Canvas mit Inline `1000px × 600px` als erstes Argument, je Zoom zwei `nextFrame()`, am Ende `canvas.getBoundingClientRect().width` 1000 und `display.width` 1000; unter Zoom 2 `display.width` 500. Läuft wie jede Datei unter WebGPU und WebGL 2.

### 4. `resolveDrawingBuffer()` füllt ein Ausgabeobjekt (PERF-015)

- `DrawingBuffer` (`resolveDrawingBuffer.ts:49-62`): `requestedSize` entfällt, an seiner Stelle `requestedWidth: number; requestedHeight: number;` — die Größe des Puffers, den die Parameter verlangten, wo sie auf einer Achse über `maxResolution` liegt; beide `0`, wo sie darin liegt. So allokiert auch ein Canvas, das dauerhaft über der Grenze liegt, je Messung nichts.
- Signatur: `resolveDrawingBuffer(params: DrawingBufferParams, out: DrawingBuffer): DrawingBuffer` — schreibt **jedes** Feld von `out` und gibt `out` zurück. TSDoc: der Aufrufer hält ein Objekt und reicht es bei jeder Messung wieder hinein.
- `Display.ts`: Feld `readonly #drawingBuffer: DrawingBuffer = {width: 0, height: 0, cssWidth: 0, cssHeight: 0, pixelRatio: 0, pixelZoom: 0, devicePixelZoom: 0, requestedWidth: 0, requestedHeight: 0};` neben `#drawingBufferParams` (`:851`), Kommentar wie dort (eine Messung je Frame im Poll-Pfad, keine Allokation dafür); `type DrawingBuffer` mit importieren. `#applyMeasuredSize()`: `const buffer = resolveDrawingBuffer(params, this.#drawingBuffer);` und `if (buffer.requestedWidth > 0 || buffer.requestedHeight > 0) showCanvasMaxResolutionWarning(buffer.requestedWidth, buffer.requestedHeight);`.
- `resolveDrawingBuffer.spec.ts`: alle Aufrufe mit einem frischen Ausgabeobjekt (Hilfsfunktion im Spec), `requestedSize`-Erwartungen auf `requestedWidth`/`requestedHeight` umstellen (`:94`, `:104`, `:128`, `:166`), dazu ein Test `fills and returns the object it is handed, every field of it` (ein mit Fremdwerten vorbelegtes Objekt kommt identisch zurück, jedes Feld überschrieben, auch `requestedWidth`/`requestedHeight` zurück auf 0).
- Neu `src/display/hot-path-allocations.spec.ts` (läuft über das Vitest-Projekt `allocations`, `pnpm test:allocations`). Muster: `src/controls/hot-path-allocations.spec.ts` — `measureSettledBytes()` aus `../testing/measureSettledBytes.js`, `BYTES_PER_CALL_LIMIT = 1`, `CALLS = 1000`, `vi.mock('./Stylesheets.js', …)`. DOM- und Renderer-Stubs wie in `Display.spec.ts` (`makeCanvas()`, `makeRenderer()`, Document-Stub, `getComputedStyle`-Stub), aber ohne `vi.fn()`-Spies auf dem gemessenen Pfad (ein Spy zeichnet jeden Aufruf auf und allokiert). Eine Runde ruft `display.resize()`; der `resizeTo`-Callback gibt ein einmal gebautes konstantes Tupel ganzer Zahlen zurück, `devicePixelRatio` ist eine Konstante, `resizePollIntervalMs` bleibt `0`. Mindestens drei Runden: Größe unverändert ohne Budget; mit `maxPixels = 3_000_000` und `resolutionScale = 0.75` (gestufte Ratio); mit `pixelZoom = 2`. Ein Kommentar sagt, warum `resize()` und nicht `renderFrame()` gemessen wird (Event-Props je Event neu, `getEventProps()`). Vor dem Fix rot (Ergebnisobjekt je Messung).

### 5. `trackTimestamp` bleibt für die Lebensdauer des Renderers an — dokumentieren (PERF-004)

Kein Code. Inhalt, an drei Stellen:

- `docs/display.md`, »What to know about it«, erster Punkt (`:202-204`): der Renderer misst für sein ganzes Leben Timestamps — auch während der Controller unter einem `pixelZoom` stillhält, nach `adaptive.enabled = false` und nach `adaptive.dispose()`; three 0.186 bietet keinen Weg, das zurückzunehmen (die Timestamp-Writes stehen auf dem Render-Pass-Descriptor, den three für das Canvas behält). Der Aufwand ist klein. Ein Display, das ohne sie zeichnen soll, gibt `trackTimestamp: false` neben `adaptiveResolution` mit; der Controller liest dann das Frame-Pacing. Ein `ts check`-Block ist hier nicht nötig, ein Satz mit dem Optionsnamen reicht.
- TSDoc `DisplayParameters.adaptiveResolution` (`types.ts:62-72`): ein Satz zur Lebensdauer und zu `trackTimestamp: false`.
- TSDoc der Klasse `AdaptiveResolution`, Punkt `gpu-time` (`AdaptiveResolution.ts:89-95`): ein Satz zur Lebensdauer.

### 6. Die beiden ungeprüften Blöcke in `docs/display.md` (DX-001)

- `:85-90`, Pointer-Handler: bleibt mit zwei Leerzeichen im Listenpunkt eingerückt (der Doc-Snippet-Check entfernt die Einrückung der Fence, `scripts/checkDocSnippets/extractSnippets.mjs`), Info-String `ts check`, eigenständig:
  ```ts
  import {Display} from '@spearwolf/twopoint5d';

  const canvas = document.querySelector('canvas')!;
  const display = new Display(canvas);
  display.pixelZoom = 2;

  canvas.addEventListener('pointermove', (event) => {
    const x = (event.offsetX * display.devicePixelRatio) / display.devicePixelZoom;
    const y = (event.offsetY * display.devicePixelRatio) / display.devicePixelZoom;
  });

  export {display};
  ```
- `:163-165`: Info-String `ts check`, `import {Display} from '@spearwolf/twopoint5d';`, `const display = new Display(document.querySelector('canvas')!, {adaptiveResolution: {targetFps: 30, minScale: 0.25, maxScale: 1}});`, `export {display};` — wie die übrigen Blöcke der Datei.

### 7. Doku und CHANGELOG

`packages/twopoint5d/docs/display.md` (Docs wachsen mit dem Feature):

- »Pixel art at its own resolution«, Fit-Beispiel `:56-73`: das Canvas ist `<canvas resize-to="window">` — die Größenquelle ist das Fenster, aus dem auch der Zoom gerechnet wird; im Block `document.querySelector<HTMLCanvasElement>('canvas[resize-to="window"]')!` und ein Kommentar dazu. In der Liste darunter (`:77-79`) ein Satz: ein Canvas, das seine eigene Größenquelle ist, behält die Größe, die es ohne den Zoom hatte, auch über Zoomwechsel.
- Ein Satz, dass ein `pixelZoom`, der keine positive endliche Zahl ist, als `0` zählt (wo die Tabelle `:14` oder die Liste ab `:77` es natürlich aufnimmt).
- »A budget of pixels« (`:101-116`): das Budget gilt auch nach einem `resolutionScale` über 1.
- »Resolution scale« (`:118-122`): über 1 ist Supersampling — über `maxPixelRatio` hinaus, innerhalb von `maxPixels`; `maxScale` über 1 lässt den Controller dorthin.
- »The pixel ratio, put together«, Formel `:128-130` und Text: `min(min(devicePixelRatio, maxPixelRatio, sqrt(maxPixels / cssArea)) × resolutionScale, sqrt(maxPixels / cssArea))` oder gleichwertig in Prosa — für eine Skala bis 1 bleibt das Ergebnis dasselbe wie vorher.
- »Adaptive resolution«: Schritt 5 und Schritt 6.

`packages/twopoint5d/CHANGELOG.md`, nur `## [Unreleased]`, bestehende Einträge
ergänzen (Skill `updating-changelog`):

- `### Added`, `Display#maxPixelRatio` (`:41`): ein `resolutionScale` über 1 zeichnet darüber hinaus, `maxPixels` begrenzt auch das.
- `### Added`, `Display#maxPixels` (`:43`): das Budget hält auch nach `resolutionScale`.
- `### Added`, `Display#resolutionScale` (`:44`): über 1 Supersampling, innerhalb von `maxPixels`.
- `### Added`, `AdaptiveResolution` (`:45`): `maxScale` über 1 innerhalb von `maxPixels`; der Renderer behält `trackTimestamp` für sein Leben, `trackTimestamp: false` neben der Option lässt dem Controller das Frame-Pacing.
- `### Changed`, `Display#pixelZoom` (`:64`): ein Canvas, das seine eigene Größenquelle ist, behält über Zoomwechsel die Größe, die es ohne den Zoom hatte; ein Zoom, der keine positive endliche Zahl ist, zählt als 0.

Keine Migrationshinweise: nichts davon ist veröffentlicht. `resolveDrawingBuffer()`
ist `@internal` und nicht in `src/display/public-api.ts`, braucht also keinen
Eintrag. Kein Satz über den Vorzustand in Code, TSDoc, Doku oder CHANGELOG
(Konvention »Kein Rückblick«): beschrieben wird, was gilt.

## Restplan

- **Paket 4** bekommt `Hängt ab von: Paket 3`. Grund: Paket 3 ändert
  `AdaptiveResolution.ts` (Zoom-Abfragen, TSDoc von `maxScale` und `gpu-time`),
  `AdaptiveResolution.spec.ts` und `docs/display.md`, die Paket 4 ebenfalls
  bearbeitet; dessen PERF-014 verlangt eine Allokations-Spec für das GPU-Fenster
  und kann `src/display/hot-path-allocations.spec.ts` aus Schritt 4 erweitern.
  Die Reihenfolge bleibt, die Abhängigkeit macht sie belastbar.
- Sonst keine Änderung: keins der sechs Findings ist weggefallen, keine Folge zu
  verteilen, und keine andere Paketdatei berührt `src/display/`.

## Findings im Volltext

**BUG-012 · low · packages/twopoint5d/src/display/Display.ts:1816** (auch `:1805`) — `pixelZoom` auf einem Canvas, das seine eigene Größenquelle ist, nicht schrumpfen lassen
Unter `pixelZoom` schreibt das Display als CSS-Breite nur die ganzen Art-Pixel (`width * cssPerPixel`), bis zu einem Art-Pixel weniger als die Quelle. Ist das Canvas selbst die Größenquelle — der Default bei einem übergebenen Canvas, und so steht es auch im Fit-Beispiel in docs/display.md —, misst der nächste Lauf diese geschrumpfte Inline-Breite. Jeder Zoomwechsel rundet erneut ab: DPR 1, 1000 px, Zoom 3 → 999 px, Zoom 2 → 998 px, Zoom 3 → 996 px, zurück auf Zoom 0 bleibt 996 px. Die verlorenen Pixel kommen nicht zurück.
Beleg: `cssWidth = Math.max(0, cssWidth - wPx + width * cssPerPixel);` → `canvas.style.width = `${cssWidth}px`` bei `resizeToElement === canvas`
Empfehlung: Bei `canvas === sizeSourceElement` die zuletzt ungezoomt gemessene Größe als Basis behalten (oder die gezoomte Breite nicht als Inline-Style schreiben, sondern z. B. per `object-fit`/Zentrierung lösen), und das Fit-Beispiel in docs/display.md auf einen Container mit `resize-to` umstellen. Test: Zoom 3 → 2 → 3 → 0 auf selbstvermessendem Canvas.

**PERF-003 · low · packages/twopoint5d/src/display/Display.ts:1566** (auch `:1574`, `:1799`, `:1835`) — Nicht-endliche `maxPixels`/`pixelZoom` wie 0 vergleichen
Die TSDoc sagt, ein `maxPixels`, das keine positive endliche Zahl ist, zähle als 0. Der Frame-Vergleich nimmt aber den Rohwert: `maxPixels = NaN` (etwa aus `Number(urlParam)`; die Option fängt mit `?? 0` nur `undefined`) macht `this.maxPixels === this.#appliedMaxPixels` in jedem Frame falsch — jeder Frame misst mit `getBoundingClientRect()` und erzwingt Layout, genau das, was der Kommentar für `pixelZoom = NaN` ausdrücklich verhindert. `pixelZoom = Infinity` ergibt `devicePixelZoom = Infinity`, `width = 0` und `cssWidth = NaN` (0 × Infinity); `NaN !== NaN` lässt dann jede Messung `setDrawingBufferSize()` aufrufen und `OnDisplayResize` senden, im Poll-Pfad in jedem Frame.
Beleg: `this.maxPixels === this.#appliedMaxPixels` / `this.#appliedMaxPixels = this.maxPixels;` / `devicePixelZoom = Math.max(1, Math.floor(pixelZoom * ratio + DEVICE_PIXEL_ZOOM_EPSILON));`
Empfehlung: Beide Knöpfe einmal normalisieren (`const maxPixels = isPositiveFinite(this.maxPixels) ? this.maxPixels : 0`, `pixelZoom` analog mit `isPositiveFinite`) und nur den normalisierten Wert vergleichen und speichern.

**API-003 · low · packages/twopoint5d/src/display/Display.ts:1463** (auch `AdaptiveResolution.ts:144`, `Display.ts:805`) — `resolutionScale > 1` gegen das Budget-Versprechen von `maxPixels` abgrenzen
Die TSDoc von `maxPixels` verspricht, der Drawing Buffer halte »höchstens so viele Pixel, egal wie groß oder dicht der Bildschirm«. `resolutionScale` multipliziert aber nach allen Schranken und ist nach oben offen, ebenso `AdaptiveResolutionOptions.maxScale` (nur auf Achtel abgerundet, keine Obergrenze 1). Mit `maxScale: 1.5` oder `resolutionScale = 2` überschreitet das Display sowohl `maxPixelRatio` als auch das Budget, ohne dass die Doku das erwähnt.
Beleg: `if (isPositiveFinite(resolutionScale) && resolutionScale !== 1) { ratio *= resolutionScale; stepped = true; }`
Empfehlung: Entweder `resolutionScale` (und `maxScale`) auf ≤ 1 klemmen, oder Supersampling bewusst erlauben und die Doku von `maxPixels`, `maxPixelRatio` und `resolutionScale` entsprechend formulieren (Budget gilt vor der Skala).
Entschieden (Plan, »Entscheidungen«, 2026-10-21): Supersampling bleibt erlaubt, `maxPixels` ist auch nach der Skala eine harte Obergrenze — die zweite Variante, mit dem Budget **nach** der Skala.

**PERF-004 · low · packages/twopoint5d/src/display/Display.ts:1188** (auch `AdaptiveResolution.ts:247`) — `trackTimestamp` nicht dauerhaft anschalten, wenn der Controller ruht
Ein Display mit `adaptiveResolution` baut seinen Renderer mit `trackTimestamp: true`. Damit schreibt three.js in jeden Render-Pass Timestamp-Queries (WebGPU) bzw. startet Disjoint-Timer-Queries (WebGL 2) — auch während der Controller unter `pixelZoom` stillhält, nach `enabled = false` und nach `adaptive.dispose()`. Ohne Abnehmer läuft der Query-Pool voll, und three löst ihn dann selbst per `mapAsync` auf. Der Overhead ist klein, aber dauerhaft und für den Nutzer unsichtbar; die Doku erwähnt ihn nicht.
Beleg: `...(adaptiveResolution ? {trackTimestamp: true} : null),`
Empfehlung: In docs/display.md festhalten, dass `trackTimestamp` für die Lebensdauer des Renderers an bleibt, und — falls three es zulässt — `backend.trackTimestamp` beim Abschalten bzw. Dispose des Controllers zurücknehmen.

**PERF-015 · low · packages/twopoint5d/src/display/resolveDrawingBuffer.ts:160** — `resolveDrawingBuffer()` ohne Ergebnisobjekt je Messung
Jede Messung allokiert ein Ergebnisobjekt; mit `resizeTo`-Callback und `resizePollIntervalMs = 0` (Default) ist das eine Allokation je Frame. Die Allokations-Specs decken diesen Pfad nicht ab. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Ein Ausgabeobjekt übergeben lassen (`out`-Parameter) oder je Display wiederverwenden; Allokations-Spec mit `resizeTo` und Poll-Intervall 0.

**DX-001 · low · packages/twopoint5d/docs/display.md:85** (auch `:163`) — Ungeprüfte Codeblöcke in docs/display.md in die Typprüfung aufnehmen
Die meisten Beispiele sind mit `ts check` markiert und laufen über checkDocSnippets. Zwei Blöcke (pointermove-Handler mit display.devicePixelZoom, und `new Display(canvas, {adaptiveResolution: {targetFps: 30, minScale: 0.25, maxScale: 1}})`) tragen nur `ts`, nutzen undeklariertes `canvas` und werden nicht übersetzt. Genau die Optionsnamen und Getter der neuen Features (adaptiveResolution-Objekt, devicePixelZoom) würden so bei einer Umbenennung unbemerkt veralten.
Beleg: ```` ```ts ```` / `new Display(canvas, {adaptiveResolution: {targetFps: 30, minScale: 0.25, maxScale: 1}});`
Empfehlung: Beide Blöcke als `ts check` ausbauen (mit `document.querySelector('canvas')!` und `export {}`), wie in den übrigen Blöcken der Datei.
