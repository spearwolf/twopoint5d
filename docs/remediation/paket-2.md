# Paket 2 — Resize-Pipeline und Canvas-Ownership

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-117 (medium), BUG-119 (low), BUG-120 (low), MEM-018 (low), READ-001 (low, nur Display.ts), DOC-030 (low), DOC-041 (info), DOC-063 (low), DOC-064 (low), DOC-065 (low, aus Paket 4 übernommen), TEST-042 (medium, Display-Anteil: nur der dpr-Clamp)
- Ziel: `resize()` liest sich als Pipeline, klemmt in Device-Pixeln, validiert Callback-Ergebnisse, wendet `styleImageRendering` beim nächsten `resize()` an, auch ohne Größenänderung, und `dispose()` gibt einen übergebenen Canvas so zurück, wie das Display ihn vorgefunden hat — mit TSDoc, die dem Verhalten entspricht.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/types.ts`
  - `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d/docs/resource-lifecycle.md`
  - `packages/twopoint5d/CHANGELOG.md`
  - `packages/twopoint5d-testing/test/display-resize.test.js`
  - `packages/twopoint5d-testing/test/display-dispose.test.js`
  - `packages/twopoint5d-testing/test/display-constructor.test.js` (nur der Renderer-Stub)
- Verify: `pnpm run ci`
- Commit: `fix(display): clamp Display.MaxResolution in device pixels, apply styleImageRendering without waiting for a size change, treat a resizeTo result without two finite numbers as no size, give a canvas handed to the constructor back on dispose() as the display found it, split resize() into named steps, and bring the resize and frame TSDoc in line with the behavior`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · Abgleich gegen cf1304c7: BUG-117 unverändert, jetzt `Display.ts:938-943` (Klemme), `:309-317` (TSDoc), `:962-963` (setPixelRatio/setSize) · BUG-119 unverändert, `:946`/`:967` · BUG-120 unverändert, `:894-899`, `types.ts:15` · MEM-018 unverändert, `:1137-1156`, `:668-669`, `:965-967`, `:877`, dazu die Drawing-Buffer-Attribute über `:963` · READ-001 gewachsen: `Display.ts` 1286 Zeilen, `resize()` `:836-975`, toter Guard jetzt `:708` · DOC-030 `types.ts:74-76` · DOC-041 `:265`/`:275-280` · DOC-063 `:419-422` · DOC-064 `:343-344`/`:765` · TEST-042 (dpr) unverändert, `display-resize.test.js:277-300` prüft nur `display.width` bei dpr 1 · DOC-065 aus Paket 4 übernommen, `:391` · Nebenbefund `Display.ts:344` = DOC-064 → hier · Nebenbefund `Display.ts:625` = READ-019 → Paket 4 · Randbemerkung `styleSheetRoot` aus READ-001 → Paket 3 · Folgen aus Paket 1 und 1b: keine offen
  - 2026-09-24 Zug 1: Implementierer beauftragt, opus (stärkste Stufe), effort medium, Session `remediate-twopoint5d-p2-impl-1`, Report nach `paket-2.impl-1.json`
  - 2026-09-24 Zug 2: impl-1 endete ohne Report (CI lief im Hintergrund), per Resume fortgesetzt → `paket-2.impl-1-versuch-2.json` · FERTIG_MIT_VORBEHALT · 8 Dateien geändert (Display.ts, types.ts, Display.spec.ts, resource-lifecycle.md, CHANGELOG.md, display-resize/-dispose/-constructor.test.js) · Arbeitsbaum schmutzig · rote Läufe: Spec 5 failed/18 passed, Browser 4 failed · Abweichung: `data-engine` wird mit zurückgesetzt
  - 2026-09-24 Zug 2 (Runner): `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0, Log `paket-2.verify.log`
  - 2026-09-24 Zug 3: Reviewer (opus, medium): alle 11 Findings behoben · kritisch 0 · wichtig 2 (resize()-TSDoc falsch zur Emission; CHANGELOG-Fixed-Einträge mit Rückblick) · klein 6 · Diff `paket-2.diff`, Report `paket-2.review-1.json`
  - 2026-09-24 Zug 4 Runde 1: offen wichtig 2 + klein 1,2,3,4,6 + renderFrame-TSDoc (pixelZoom) → Resume impl-1-Session, Report nach `paket-2.impl-2.json`
  - 2026-09-24 Zug 4 Runde 1: erster Resume von außen abgebrochen (Exit 143, Teiländerungen), zweiter Versuch `paket-2.impl-2-versuch-2.json` · FERTIG · alle 7 Punkte umgesetzt, dazu »as before« im CHANGELOG-dispose-Eintrag gestrichen · Nebenbefund `Display.ts:468` (pixelZoom-TSDoc > 100 Zeichen)
  - 2026-09-24 Zug 4 Runde 1 (Runner): `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0, Log `paket-2.verify-2.log` · Reviewer Runde 2 (opus, medium) gezielt: beide wichtigen und die kleinen 1–4, 6 behoben, nichts Neues außer klein 1 · Diff `paket-2.diff-2`, Report `paket-2.review-2.json`
  - 2026-09-24 Zug 5: committet a33a6961 (8 Dateien) · Verify `paket-2.verify-2.log` exit=0 · 2 Runden

## Vorgehen

Code, Kommentare und Doku auf Englisch (`AGENTS.md`). Relative Imports mit
`.js`-Suffix, Typen per `import type`. Keine Finding-IDs, kein Satz über den
Vorzustand (»Konventionen« im Plan-Kopf). Vor der ersten Änderung `AGENTS.md`
lesen, dazu `Display.ts` ganz — nicht per grep zusammensetzen.

Reihenfolge: je Bugfix zuerst der Regressionstest, rot sehen, dann der Fix.
Die roten Läufe gehören in den Report. Einzelne Spec:
`pnpm nx test twopoint5d -- src/display/Display.spec.ts`. Die Browser-Tests
laufen gegen die gebaute Bibliothek: `pnpm build:twopoint5d`, dann
`pnpm test:browser` (beide Browser, Chromium und Firefox).

### 1. Regressionstests zuerst (rot)

**`Display.spec.ts`** — der Renderer-Stub in `makeDisplay()` bekommt
`setDrawingBufferSize: vi.fn()` und verliert `setPixelRatio` und `setSize`
(Schritt 3 ruft nur noch `setDrawingBufferSize()`; der Stub trägt, was
`Display` aufruft, und sonst nichts). Für den roten Lauf vor Schritt 3 die
beiden alten Einträge vorübergehend stehen lassen — sonst scheitert jeder
Test schon im Konstruktor und der rote Lauf beweist nichts. Neuer Block
`describe('resize()', …)` mit diesen Fällen; `console.warn` per
`vi.spyOn(console, 'warn').mockImplementation(() => {})` still, die Warnung
geht einmal je Modulinstanz hinaus und ist hier kein Prüfgegenstand;
`window` per `vi.stubGlobal('window', {devicePixelRatio: <n>, performance})`
**vor** `makeDisplay()` neu stubben (der Konstruktor ruft `resize()`):

- `clamps the drawing buffer to MaxResolution in device pixels` — dpr 2,
  `resizeTo: () => [5000, 100]`: letzter Aufruf von
  `renderer.setDrawingBufferSize` mit `(4096, 100, 2)`, `display.width === 4096`,
  `display.height === 100`.
- `rounds a clamped size down, so the drawing buffer stays within MaxResolution at a fractional pixel ratio` —
  dpr 3, `resizeTo: () => [5000, 50]`: letzter Aufruf `(2730, 50, 3)`;
  `Math.floor(2730 * 3)` ist 8190.
- `holds the CSS size to MaxResolution while pixelZoom is above 0` — dpr 2,
  `resizeTo: () => [10000, 100]`, dann `display.pixelZoom = 2;
  display.resize();`: letzter Aufruf `(4096, 50, 1)`.
- `applies styleImageRendering without a size change, also within resizePollIntervalMs` —
  nach dem Konstruktor ist `canvas.style.imageRendering === 'auto'`;
  `performance.now` per `vi.spyOn(performance, 'now').mockReturnValue(5000)`
  festhalten, `display.resizePollIntervalMs = 1000; display.resize();`
  (verbraucht das Intervall), dann `display.styleImageRendering =
  'pixelated'; display.resize();` → `canvas.style.imageRendering ===
  'pixelated'`, und `setDrawingBufferSize` hat seit dem Konstruktor keinen
  weiteren Aufruf bekommen.
- `treats a resizeTo result without two finite numbers as no size` — je ein
  Display mit `resizeTo: () => [NaN, 100]`, `() => [100, Infinity]` und
  `() => undefined`: `display.width === 300`, `display.height === 150`, und
  kein Aufruf von `setDrawingBufferSize` trägt einen nicht endlichen Wert.

**`display-resize.test.js`** — zwei neue Fälle, **nach** dem vorhandenen
`clamps oversized dimensions to Display.MaxResolution` (dessen Test zählt
genau eine Warnung, und die geht je Seite nur einmal hinaus):

- `clamps the drawing buffer to Display.MaxResolution in device pixels at a device pixel ratio of 2`
  (schließt den dpr-Anteil von TEST-042). Lokaler Helfer in dieser Datei — nur
  sie braucht ihn:

  ```js
  // devicePixelRatio is an own accessor of window, and a property defined over it shadows the
  // browser's value until the original descriptor goes back
  function emulateDevicePixelRatio(value) {
    const own = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', {configurable: true, get: () => value});
    return () => {
      if (own) Object.defineProperty(window, 'devicePixelRatio', own);
      else delete window.devicePixelRatio;
    };
  }
  ```

  Ablauf: `Display.MaxResolution` merken und auf `256` setzen,
  `emulateDevicePixelRatio(2)`, Warnungen mit `collectWarnings(String(256))`
  schlucken; `host = makeContainer({width: 200, height: 100})`,
  `display = new Display(host)`, `await display.start()`,
  `await nextFrame(display)`. Erwartet: `display.canvas.width === 256`,
  `display.canvas.height === 200`, `display.width === 128`,
  `display.height === 100`. Im `finally` dpr, `MaxResolution` und
  `console.warn` zurück. Die kleine Grenze hält den Drawing Buffer klein; bei
  8192 und dpr 2 legte der Test einen Puffer von 16384² an.
- `applies styleImageRendering on the next frame without a size change` —
  `host = makeContainer({width: 320, height: 200})`, Display starten, ein
  Frame, `display.canvas.style.imageRendering === 'auto'`; dann
  `display.styleImageRendering = 'pixelated'`, `await nextFrame(display)`,
  erwartet `'pixelated'`.

**`display-dispose.test.js`** — zwei neue Fälle hinter `leaves a canvas that
was handed in where it stands`:

- `gives a canvas that was handed in back as it found it` —
  `const canvas = document.createElement('canvas')` in `host`, `const before
  = canvas.outerHTML`, Display bauen, starten, ein Frame; zuerst
  `expect(canvas.outerHTML).not.to.equal(before)` (beweist, dass das Display
  geschrieben hat), dann `display.dispose()` und
  `expect(canvas.outerHTML).to.equal(before)`.
- `gives a canvas that was handed in its own classes, styles and attributes back, the fullscreen class included` —
  Canvas mit `class="caller"`, `style="display: block; width: 50%"`,
  `width="64"`, `height="32"`, `touch-action="pan-y"`,
  `resize-to="window"`; Display bauen, starten, ein Frame; zuerst prüfen,
  dass eine Klasse mit `Display.CssRulesPrefixFullscreen` am Canvas hängt.
  Nach `dispose()`: `[...canvas.classList]` gleich `['caller']`,
  `style.getPropertyValue('display') === 'block'`,
  `style.getPropertyValue('width') === '50%'`,
  `style.getPropertyValue('height') === ''`,
  `style.getPropertyValue('image-rendering') === ''`,
  `getAttribute('width') === '64'`, `getAttribute('height') === '32'`,
  `getAttribute('touch-action') === 'pan-y'`,
  `getAttribute('resize-to') === 'window'`.

Der Kommentarblock am Kopf der `describe` (Assertion (a) bis (f)) bleibt
wahr: bei (b) steht künftig, dass die Regel für einen übergebenen Canvas
wörtlich gilt und welche zwei Fälle sie prüfen, während der übergebene
`WebGPURenderer` der umgedrehte Fall bleibt; die Zählung »the first two
cases«, »the three cases after«, »the six cases after those« stimmt danach
noch.

### 2. `types.ts`

- `ResizeDisplayToFn` wird
  `(display: Display) => [width: number, height: number] | undefined` und
  bekommt TSDoc:

  ```ts
  /**
   * Supplies the size of a display in CSS pixels, once per {@link Display.resize}. Return
   * `undefined` while there is no size to report — an element that has not been laid out
   * yet, for example. A pair in which either value is not a finite number counts as no size
   * as well. Without a size the display takes the window under `resize-to="window"` or
   * `"fullscreen"`, and 300 × 150 otherwise.
   */
  ```
- TSDoc von `DisplayParameters.resizeTo`: die Funktion gibt die Größe (Breite
  und Höhe in CSS-Pixeln) zurück; mit ihr misst das Display kein Element; was
  ohne Größe geschieht, steht bei `ResizeDisplayToFn` (`{@link}` dorthin).
- TSDoc von `DisplayParameters.resizeToAttributeEl`, der Satz zu `"self"`:
  »With `"self"`, the display measures its `resizeToElement` — by default the
  canvas, or the host element when the display built its own container — just
  as it does without the attribute; with `resizeToElement` cleared, it
  measures the canvas.« Der Klammersatz »(this corresponds to the standard
  behavior if nothing is specified)« geht darin auf.

### 3. `Display.resize()` als Pipeline

`resize()` wird eine Folge benannter Schritte. Außer den unten genannten
Änderungen bleibt das Verhalten gleich: dieselbe Quellenreihenfolge,
dieselbe `box-sizing`-Rechnung, derselbe Hash, dieselbe Emit-Regel
(`frameNo === 0` emittiert nicht, `#didEmitResize` für `renderFrame()`).

```ts
resize(): void {
  if (this.#disposed) return;
  this.#didEmitResize = false;

  const canvas = this.canvas;
  this.#applyImageRendering(canvas);

  if (this.resizePollIntervalMs > 0) { /* unverändert: Intervall prüfen, sonst return */ }

  const source = this.#resolveSizeSource(canvas);
  this.#applyFullscreenClass(canvas, source.window);
  this.#applyMeasuredSize(canvas, this.#measureSizeSource(source), source.element);
}
```

- Felder: `#fullscreenCssRules` heißt `#fullscreenClassName` (der Klassenname
  der Fullscreen-Regel), `#fullscreenCssRulesMustBeRemoved` heißt
  `#fullscreenClassApplied` (die Klasse liegt gerade auf dem Canvas). Die
  lokale Kopie mit wechselnder Bedeutung entfällt.
- `#applyImageRendering(canvas: HTMLCanvasElement): void` — steht **vor** der
  Intervall-Prüfung und außerhalb des Hashs: `image-rendering` ist keine
  Größe, ein Wechsel darf kein `OnDisplayResize` und kein
  `setDrawingBufferSize()` auslösen. Wert
  `this.styleImageRendering ?? (this.pixelZoom > 0 ? 'pixelated' : 'auto')`,
  geschrieben nur, wenn `canvas.style.imageRendering` davon abweicht (ein
  Lesen des Inline-Styles, kein Layout). Der Hash-Zweig schreibt
  `imageRendering` nicht mehr. Warum nicht in den Hash: dann liefe jeder
  Wechsel durch `setDrawingBufferSize()` und emittierte ein
  `OnDisplayResize` ohne Größenänderung. Warum kein Setter: das Resize-Modell
  des Displays wertet alles im nächsten Frame aus, und ein Setter bräuchte
  eine zweite Stelle, die den Default aus `pixelZoom` kennt.
- `#resolveSizeSource(canvas: HTMLCanvasElement): {window: boolean; element: Element | undefined}` —
  liest nur das `resize-to`-Attribut von `resizeToAttributeEl`, schreibt
  nichts ins DOM. `fullscreen`/`window` (optional mit führendem Doppelpunkt)
  → `{window: true, element: undefined}`; `self` →
  `{window: false, element: this.resizeToElement ?? canvas}`; jeder andere
  nicht leere Wert → `{window: false, element:
  this.#resolveResizeToSelector(value) ?? this.resizeToElement ?? canvas}`;
  kein Attribut oder leerer Wert → `{window: false, element:
  this.resizeToElement}`.
- `#applyFullscreenClass(canvas: HTMLCanvasElement, wantsFullscreen: boolean): void` —
  `if (wantsFullscreen === this.#fullscreenClassApplied) return;` bei `true`
  `this.#fullscreenClassName ??= Stylesheets.installRule(Display.CssRulesPrefixFullscreen, 'position:fixed;top:0;left:0;', this.styleSheetRoot)`
  und die Klasse hinzufügen, bei `false` sie entfernen; dann
  `this.#fullscreenClassApplied = wantsFullscreen`.
- `#measureSizeSource(source): [width: number, height: number]` — CSS-Pixel
  der Quelle. Start: `source.window ? [window.innerWidth, window.innerHeight]
  : [300, 150]`. Ist `this.resizeToCallback` gesetzt, gewinnt sein Ergebnis,
  **wenn** es ein Paar zweier endlicher Zahlen ist (`result != null &&
  Number.isFinite(result[0]) && Number.isFinite(result[1])`); sonst bleibt
  der Startwert — ohne Element-Messung, wie die TSDoc von `resizeTo`
  verspricht. Ohne Callback und mit `source.element`:
  `getContentAreaSize(source.element)`.
- `#applyMeasuredSize(canvas: HTMLCanvasElement, [wPx, hPx]: [number, number], sizeRefElement: Element | undefined): void` —
  der Rest der heutigen `resize()`, in dieser Reihenfolge:
  1. `box-sizing`-Rechnung und die Klemme auf `>= 0` für Drawing- und
     CSS-Größe, unverändert.
  2. Device-Pixel-Klemme (BUG-117, Entscheidung vom 2026-09-24):
     `const {pixelRatio, pixelZoom} = this;` **vor** der Klemme lesen.
     `if (wPx * pixelRatio > Display.MaxResolution || hPx * pixelRatio > Display.MaxResolution)`
     → Warnung mit `Math.round(wPx * pixelRatio)` × `Math.round(hPx *
     pixelRatio)`, dann `wPx = Math.min(wPx, Display.MaxResolution /
     pixelRatio)`, `hPx` ebenso. `pixelRatio` ist bei `pixelZoom > 0` schon
     `1` — damit gilt »bei `pixelZoom > 0` gegen `w`« ohne eigenen Zweig. Die
     CSS-Größe bleibt ungeklemmt, wie heute.
  3. Hash unverändert
     (`${wPx}|${cssWidth}x${hPx}|${cssHeight}x${pixelRatio},${pixelZoom}`).
  4. Im Changed-Zweig `#width`/`#height` wie heute (durch `pixelZoom` geteilt,
     `Math.floor`), dann **ein** Aufruf
     `this.renderer!.setDrawingBufferSize(this.#width, this.#height, pixelRatio)`
     an Stelle von `setPixelRatio()` + `setSize(…, false)`. Grund, als
     Kommentar an den Aufruf: `setPixelRatio()` allein zieht den Drawing
     Buffer auf die alte logische Größe mal neue Ratio — bei einem Wechsel
     von dpr 1 auf 2 an der Grenze liegt der Puffer für einen Aufruf bei
     16384. Endzustand identisch (three setzt dieselben `_width`, `_height`,
     `_pixelRatio`, `canvas.width = Math.floor(width * pixelRatio)`).
     Danach `canvas.style.width`/`height` und der Emit wie heute.
  Die Rundung hält die Grenze: `#width <= wPx <= MaxResolution / pixelRatio`,
  also `Math.floor(#width * pixelRatio) <= MaxResolution`.
- `showCanvasMaxResolutionWarning()` sagt »device pixels«:
  `` `Oops, the canvas width or height should not be bigger than ${Display.MaxResolution} device pixels (${w}x${h} was requested).` ``
  — die Klammer bleibt wörtlich, der vorhandene Browser-Test prüft sie.
- `#resolveResizeToSelector()` bleibt unverändert.
- Der Guard `if (typeof document !== 'undefined')` um die
  `visibilitychange`-Verdrahtung im Konstruktor (heute `Display.ts:708`)
  fällt, der Rumpf bleibt: der Konstruktor hat `document.head` (`:581`) und
  `Stylesheets.addRule` (`:602`, `:668`) da schon bedingungslos benutzt. Der
  Feature-Check `typeof IntersectionObserver !== 'undefined'` (`:722`) bleibt.

**Nicht Teil dieses Pakets** (READ-001, Randbemerkung): dass die
Fullscreen-Regel im `styleSheetRoot` des ersten Fullscreen-Frames landet und
eine spätere Neuzuweisung von `styleSheetRoot` nicht mitbekommt. Das ist
dieselbe Frage wie MEM-017 — wo die Regeln eines Displays liegen — und liegt
bei Paket 3. `#fullscreenClassName` wird deshalb weiter einmal installiert
und gecacht. Die Länge von `Display.ts` ist kein Ziel: gemessen wird READ-001
an seiner Empfehlung (Umbenennung, Pipeline, toter Guard); die
Canvas-Freigabe-Helfer oben in der Datei bleiben, wo sie sind, Paket 3
arbeitet an ihnen.

### 4. Übergebenen Canvas bei `dispose()` zurückgeben (MEM-018)

Entscheidung vom 2026-09-24: `dispose()` nimmt bei einem übergebenen Canvas
alles zurück, was das Display gesetzt hat, sodass »not modified« in
`resource-lifecycle.md` wörtlich stimmt. Was das Display (samt seinem
Renderer, über `setDrawingBufferSize()`) auf einen übergebenen Canvas
schreibt, heute vollständig:

| Was | Wo |
| --- | --- |
| Klasse `twopoint5d-canvas-<id>` | Konstruktor, `Stylesheets.addRule(canvas, …)` (`:668`) |
| Attribut `touch-action="none"` | Konstruktor (`:669`) |
| Fullscreen-Klasse | `#applyFullscreenClass()` |
| Inline `width`, `height`, `image-rendering` | `#applyMeasuredSize()`, `#applyImageRendering()` |
| Attribute `width`, `height` (Drawing Buffer) | `setDrawingBufferSize()` |

Alle fünf gehen zurück, die Drawing-Buffer-Attribute eingeschlossen: die
Entscheidung nennt Klassen, Inline-Größe und Fullscreen-Klasse und verlangt,
dass »not modified« wörtlich stimmt — das tut es nur mit ihnen. Einzige
Ausnahme bleibt der verlorene WebGL-Kontext, den die Doku schon als solche
führt. Das Zurücksetzen von `width`/`height` leert den Canvas; nach
`dispose()` zeichnet niemand mehr darauf.

- Modulebene, neben den anderen Canvas-Helfern:

  ```ts
  // What a display writes on a canvas handed to its constructor, as it was before, so
  // dispose() can give the canvas back as the display found it
  interface CanvasState {
    // null where the attribute was absent
    attributes: Record<'class' | 'style' | 'touch-action' | 'width' | 'height', string | null>;
    style: Record<'width' | 'height' | 'image-rendering', {value: string; priority: string}>;
  }
  function readCanvasState(canvas: HTMLCanvasElement): CanvasState
  function restoreCanvasState(canvas: HTMLCanvasElement, state: CanvasState, classNames: readonly string[]): void
  ```

  `restoreCanvasState` in dieser Reihenfolge: die übergebenen
  `classNames` entfernen (nur die, die das Display vergeben hat — Klassen,
  die der Aufrufer in der Zwischenzeit gesetzt hat, bleiben); dann je
  Inline-Eigenschaft `value === '' ? removeProperty(p) : setProperty(p,
  value, priority)`; dann `touch-action`, `width`, `height`:
  `null ? removeAttribute : setAttribute`; zuletzt `class` und `style`
  entfernen, wenn sie vorher fehlten und jetzt leer sind
  (`classList.length === 0` bzw. `style.length === 0`) — damit ist ein
  nackter `<canvas>` danach wieder `<canvas></canvas>`.
- Konstruktor, Zweig `tagName === 'CANVAS'`: `readCanvasState(canvas)`
  **vor** `makeRenderer(…)`. Nach dem erfolgreichen `makeRenderer` nur dann
  als `#callersCanvasBefore` behalten, wenn `this.renderer.domElement ===
  canvas` — ein `createRenderer`, der den Canvas ignoriert, lässt ihn
  unberührt, und ein Zurückschreiben würde Änderungen des Aufrufers
  überschreiben. Die Rückgabe von `Stylesheets.addRule(canvas, …)` als
  `#canvasClassName` merken.
- Neue private Methode `#giveBackCallersCanvas(): void`, aufgerufen in
  `dispose()` direkt nach `off(this)` und **vor** `#releaseRenderer()` (das
  `#callersCanvas` leert): ist `#callersCanvasBefore` gesetzt, ruft sie
  `restoreCanvasState(this.#callersCanvas!, this.#callersCanvasBefore, classNames)`
  mit `classNames` = `#canvasClassName` und `#fullscreenClassName`, soweit
  gesetzt (ein nicht gesetzter Name kommt nicht in die Liste), und setzt
  danach `#callersCanvasBefore = undefined`. Synchron in `dispose()`, nicht am Ende
  der Freigabe: ein Display, das im selben Tick auf demselben Canvas entsteht,
  schreibt seine Werte danach, und nichts Späteres überschreibt sie.
- TSDoc mitziehen: Klassen-TSDoc »Lifecycle«, Punkt 3 (ein übergebener
  Canvas behält seinen Platz **und** bekommt zurück, was das Display darauf
  geschrieben hat); TSDoc von `dispose()` (ein Absatz: Klassen, Inline-
  `width`/`height`/`image-rendering`, `touch-action`, die Drawing-Buffer-
  Attribute `width`/`height` gehen auf den Stand vor dem Konstruktor zurück;
  unter WebGL bleibt der Kontext verloren, wie schon beschrieben).

### 5. TSDoc in `Display.ts`

- `static MaxResolution`: obere Grenze je Achse in Device-Pixeln für den
  Drawing Buffer, den `resize()` dem Renderer gibt — CSS-Größe mal
  `pixelRatio`; mit `pixelZoom > 0` ist die Ratio `1`, also die CSS-Größe
  selbst. Eine größere Größe wird geklemmt, eine einmalige `console.warn`
  nennt die angefragte Größe in Device-Pixeln. Die logische `width`/`height`
  ist dann höchstens `Math.floor(MaxResolution / pixelRatio)`. Der Absatz
  »Adjust this before constructing …« bleibt.
- Klassen-TSDoc, Abschnitt »Resize model«:
  - Der Satz zum Hash (heute `:261-263`): ein `resize()` ändert am Renderer
    nichts und emittiert nichts, solange Größe, Pixel Ratio und Pixel Zoom
    gleich bleiben; `image-rendering` wird bei jedem Aufruf gegen den
    Inline-Style geprüft, unabhängig davon. Den privaten Feldnamen
    `#lastResizeHash` nicht mehr nennen.
  - »evaluated each frame« (`:265`) → »on every `resize()`«.
  - Bullet `"self"` (`:274`): misst `{@link Display.resizeToElement}` —
    standardmäßig den Canvas, oder das Host-Element, wenn das Display seinen
    eigenen Container gebaut hat —, wie ohne Attribut; ist
    `resizeToElement` geleert, den Canvas (DOC-030, gleiche Aussage wie in
    `types.ts`).
  - Bullet Selektor (`:275-280`), ein Satz dazu (DOC-041): »The element a
    selector has found stays the size source for as long as it sits in that
    root node and still matches the selector; an element inserted in front
    of it later that matches as well does not take over. Once the found
    element leaves the root or stops matching, the next `resize()` looks the
    selector up again.«
  - Punkt 2 (`resizeToCallback`, `:281-284`): Ergebnis `undefined` oder ein
    Paar mit nicht endlichem Wert ist »keine Größe« — Fenstergröße unter
    `resize-to="window"`/`"fullscreen"`, sonst 300 × 150.
  - Absatz `:288-294` in der Reihenfolge der Pipeline neu: Größe der Quelle
    in CSS-Pixeln → `box-sizing` (Padding und Border des Canvas gehen ab oder
    auf die CSS-Größe) → Klemme auf `>= 0` → `MaxResolution` begrenzt den
    Drawing Buffer (CSS-Größe mal `pixelRatio`, je Achse) →
    `renderer.setDrawingBufferSize()` und Inline-`width`/`height`;
    `pixelZoom` teilt zur logischen `width`/`height`, die `OnDisplayResize`
    sieht; `image-rendering` bei jedem Aufruf, siehe `styleImageRendering`.
- `resizeToCallback`-Feld (`:452-465`): wie Punkt 2 oben, mit `{@link
  ResizeDisplayToFn}`.
- `resizePollIntervalMs` (`:341-344`, DOC-064): »Defaults to `0`: no
  throttle, and `resize()` measures on every frame.« — »matching the legacy
  behavior« fällt. Ergänzen: `image-rendering` ist vom Intervall nicht
  betroffen.
- `maxDeltaTime` (`:760-769`, DOC-064): der Satz »Useful against rAF
  throttling, GC pauses and debugger breakpoints — a single hiccup no longer
  cascades into physics jumps or animation glitches.« wird »Useful against rAF
  throttling, GC pauses and debugger breakpoints: a single long frame reaches
  physics and animations as a step of at most `maxDeltaTime`.«
- `frameNo` (`:419-422`, DOC-063): »The number of the frame being rendered:
  `0` until the first frame, `1` during the first one, and one more with every
  frame after it.«
- `styleImageRendering` (`:386-397`, DOC-065 und BUG-119), vollständig neu:
  der Wert der CSS-Eigenschaft `image-rendering`, die das Display in den
  Inline-Style des Canvas schreibt; `undefined` folgt `pixelZoom`
  (`"pixelated"` über `0`, sonst `"auto"`); gesetzt pinnt er einen der beiden
  Werte; eine Änderung wirkt mit dem nächsten `resize()` — zu Beginn des
  nächsten Frames oder sofort mit einem eigenen Aufruf —, ob sich die Größe
  ändert oder nicht, und unabhängig von `resizePollIntervalMs`. Der
  MDN-Link und `{@link Display.pixelZoom}` bleiben.

### 6. `docs/resource-lifecycle.md`

- §1, Absatz ab Zeile 23 (»A canvas handed to the `Display` constructor is
  not taken over, and it still comes back changed …«) neu: ein übergebener
  Canvas wird nicht übernommen, und `dispose()` gibt ihn so zurück, wie das
  Display ihn vorgefunden hat — Klassen, Inline-`width`/`height`/
  `image-rendering`, das Attribut `touch-action` und die Attribute
  `width`/`height` des Drawing Buffers gehen auf den Stand vor dem
  Konstruktor zurück. Eines bleibt unter dem WebGL-Backend verändert: der
  Kontext (Rest des bisherigen Absatzes wörtlich: three gibt ihn auf, das
  Display lässt ihn verloren und wiederherstellbar, nur ein `Display` holt
  ihn zurück, ein eigener `WebGPURenderer` oder `getContext('webgl2')` bekommt
  den verlorenen).
- §4, das Zitat von `Display.dispose()` (Zeilen 161–182): zeichengleich mit
  dem neuen Rumpf aus `Display.ts`, samt Kommentaren. Der Satz davor (»emits
  its dispose event before that call«) bleibt.
- Die Datei ist bindend (`AGENTS.md`), und `pnpm typecheck` prüft nur Blöcke
  mit `ts check`; das Zitat ist ein schlichter `ts`-Block und bleibt einer.

### 7. `CHANGELOG.md`, nur unter `[Unreleased]`

Skill `updating-changelog` laden und befolgen.

- `### Fixed`, neu: `Display.MaxResolution` bounds the drawing buffer in
  device pixels — the CSS size times the pixel ratio, the CSS size itself
  while `pixelZoom` is above 0 —, so a display at a device pixel ratio of 2
  or 3 no longer asks for a canvas of twice or three times the limit.
- `### Fixed`, vorhandener Eintrag »fix the `Display.MaxResolution` warning:
  it names the canvas size that was requested, before the clamp, …« (heute
  `CHANGELOG.md:292`): um »in device pixels« ergänzen — er ist unreleased
  und darf geändert werden.
- `### Fixed`, neu: `Display#styleImageRendering` takes effect with the next
  `resize()`, whether or not the size changes, and a change emits no
  `OnDisplayResize`.
- `### Fixed`, neu: a `resizeTo` callback whose result is `undefined` or holds
  a value that is not a finite number counts as no size: the display takes
  the window under `resize-to="window"` or `"fullscreen"`, and 300 × 150
  otherwise, instead of handing `NaN` to the renderer.
- `### Changed`, neu: `ResizeDisplayToFn` returns
  `[width: number, height: number] | undefined`.
- `### Fixed`, neu: `Display#dispose()` gives a canvas handed to the
  constructor back as the display found it — its classes, the inline `width`,
  `height` and `image-rendering`, the `touch-action` attribute and the
  `width` and `height` attributes go back to what they were; under the WebGL
  backend the context stays lost and restorable, as before. Link auf
  `docs/resource-lifecycle.md` im Stil der Nachbareinträge.
- `### Migration Guide`: ein kurzer Abschnitt zu `ResizeDisplayToFn` — Code,
  der einen `resizeTo`-Callback selbst aufruft, behandelt jetzt `undefined`;
  ein Callback, der immer ein Paar liefert, bleibt gültig. Das ist die
  Migration-Guide-Prüfung des Skills für eine geänderte öffentliche Signatur.

### 8. Mitzuziehen

- `packages/twopoint5d-testing/test/display-constructor.test.js`,
  `makeRendererStub()`: `setPixelRatio() {}` und `setSize() {}` durch
  `setDrawingBufferSize() {}` ersetzen — der Kommentar darüber sagt, der Stub
  trägt, was `Display` aufruft, und sonst nichts.
- `grep -rn "setPixelRatio\|setSize" packages/twopoint5d/src/display packages/twopoint5d-testing/test apps/lookbook/src`
  nach dem Umbau: `stage-renderer.test.js:158` ruft `setPixelRatio(2)` am
  echten Renderer selbst auf und bleibt; ein anderer Treffer, der einen
  `Display`-Renderer stubbt, zieht mit.

### Bekannt und in der Queue, nicht Teil dieses Pakets

In den Dateien dieses Pakets stehen Nebenbefunde, die schon in »Offene
Befunde« des Plans stehen, mit eigener Ursache: `display-resize.test.js:100`
und `:413` (kein `finally` um das Aufräumen), `:103` (Testtitel),
`display-dispose.test.js:28`/`:248` (doppelte Backend-Unterscheidung),
`Display.ts:785` (`get pause()`), `Display.ts:625` (TODO — ist READ-019,
Paket 4), `Display.ts:218` (Lifecycle Punkt 2). Nicht anfassen, nicht erneut
melden.

### Für den Abschluss dieses Pakets

Die `Schnittstellen:`-Zeile im Plan nennt nach dem Commit mindestens:
`ResizeDisplayToFn` mit `| undefined`; `Display` ruft am Renderer
`setDrawingBufferSize()` statt `setPixelRatio()`/`setSize()` (ein Stub oder
ein eigener `createRenderer` braucht die Methode); die privaten Namen
`#fullscreenClassName`, `#fullscreenClassApplied`, `#canvasClassName`,
`#callersCanvasBefore`, `#giveBackCallersCanvas()`, `#resolveSizeSource()`,
`#applyFullscreenClass()`, `#measureSizeSource()`, `#applyMeasuredSize()`,
`#applyImageRendering()`; `dispose()` gibt einen übergebenen Canvas zurück —
Paket 3 arbeitet am Konstruktor (`makeRenderer` im Aufräum-`try`, MEM-017)
und an der Klassenvergabe und hält `readCanvasState()` vor `makeRenderer`
sowie `#canvasClassName` mit.


## Findings im Volltext

**BUG-117 · medium · packages/twopoint5d/src/display/Display.ts:735-740** (weitere Stellen: `Display.ts:146-154`, `Display.ts:759-760`; heute `:938-943`, `:309-317`, `:962-963`) — Display.MaxResolution in Device-Pixeln begrenzen, wie die TSDoc es sagt
Geklemmt werden CSS-Pixel aus `getBoundingClientRect` bzw. `innerWidth`. Danach setzen `setPixelRatio(devicePixelRatio)` und `setSize(width, …)` den Drawing Buffer auf `width × dpr`. Bei dpr 2 oder 3 entstehen 16384 bzw. 24576 px, also genau die Texturgrenze, vor der der Clamp schützen soll. Der Browser-Test prüft nur die logische Breite.
Empfehlung: Gegen `w × pixelRatio` klemmen (bei `pixelZoom > 0` gegen `w`) oder die TSDoc korrigieren. Im Test `canvas.width` mit emuliertem dpr prüfen.

**BUG-119 · low · packages/twopoint5d/src/display/Display.ts:743** (weitere Stelle: `Display.ts:764`; heute `:946`, `:967`) — styleImageRendering sofort anwenden, nicht erst beim nächsten Resize
Der Resize-Hash enthält `styleImageRendering` nicht, und das Style wird nur im Changed-Zweig geschrieben. `display.styleImageRendering = 'pixelated'` bleibt ohne Wirkung, bis sich Größe oder Pixel Ratio ändern.
Empfehlung: Den Wert in den Hash aufnehmen oder außerhalb des Hash-Zweigs gegen den aktuellen Inline-Style vergleichen.

**BUG-120 · low · packages/twopoint5d/src/display/Display.ts:691-696** (weitere Stelle: `types.ts:15`; heute `Display.ts:894-899`) — Das Ergebnis von resizeToCallback validieren und korrekt typisieren
Der Typ verspricht immer ein Tupel, die Laufzeit akzeptiert aber auch ein falsy Ergebnis. `NaN` und `Infinity` laufen ungeprüft bis `setSize`. Ein Callback, der aus einem noch nicht gelayouteten Element `0/0` ableitet, erzeugt so `NaN`.
Empfehlung: Rückgabetyp `[number, number] | undefined` und nicht endliche Werte wie »kein Ergebnis« behandeln.

**MEM-018 · low · packages/twopoint5d/src/display/Display.ts:877-893** (weitere Stellen: `Display.ts:473-474`, `Display.ts:762-764`; heute `:1137-1156`, `:668-669`, `:965-967`) — Einen übergebenen Canvas bei dispose() von Display-Klassen und -Styles befreien
resource-lifecycle.md §1 sagt über übergebene Ressourcen »not disposed, not cleared, not modified«. Ein übergebener Canvas behält nach `dispose()` aber Klassen, Inline-Größe und die Fullscreen-Klasse mit `position:fixed`.
Empfehlung: Mindestens die Fullscreen-Klasse beim Dispose entfernen und den Rest dokumentieren, oder alle Änderungen zurücknehmen.
(Entschieden am 2026-09-24: alle Änderungen zurücknehmen.)

**READ-001 · low · packages/twopoint5d/src/display/Display.ts:633** (heute `resize()` `:836-975`) — Display.ts mit 940 und StageRenderer.ts mit 733 Zeilen; resize() als 140-Zeilen-Pipeline entwirren
Beide Dateien sind seit dem Vorlauf (731/624 Zeilen) weiter gewachsen. In `Display.resize()` heißt das Feld `#fullscreenCssRulesMustBeRemoved` tatsächlich »die Fullscreen-Klasse liegt gerade auf dem Canvas«, die lokale Kopie wechselt mitten in der Funktion die Bedeutung zu »am Ende dieses Aufrufs entfernen«. Die Logik stimmt (beide Richtungen nachvollzogen, der `resize-to="window"`-Browsertest deckt den Rundweg), braucht aber drei Lesedurchgänge. `resize()` mischt Quellenauflösung, Klassen-Toggle, Messung, Clamping und Anwendung. Nebenbei: `#fullscreenCssRules` wird in den `styleSheetRoot` des ersten Fullscreen-Frames installiert und ignoriert eine spätere Neuzuweisung des öffentlichen Felds; der `typeof document !== 'undefined'`-Guard in 505 ist tot, weil `document.head` (387) und `Stylesheets.addRule` (465) schon bedingungslos liefen.
Empfehlung: Umbenennen in `#fullscreenClassApplied` und `const wantsFullscreen = …; if (wantsFullscreen !== this.#fullscreenClassApplied) { classList.toggle(cls, wantsFullscreen); … }` schreiben. `#resolveSizeSource()` und `#applyMeasuredSize()` extrahieren, damit `resize()` sich als Pipeline liest. Den toten Guard streichen oder den Konstruktor durchgehend SSR-sicher machen.
(In diesem Lauf nur der `Display.ts`-Anteil, Entscheidung vom 2026-09-24; der `StageRenderer.ts`-Anteil bleibt im Audit offen.)

**DOC-030 · low · packages/twopoint5d/src/display/types.ts:57** (heute `:74-76`) — TSDoc von resizeToAttributeEl an das Verhalten von "self" angleichen
Das TSDoc von `resizeToAttributeEl` sagt, `"self"` messe den Canvas. `Display.resize()` nimmt `this.resizeToElement ?? canvasElement`, und die Klassen-TSDoc von `Display` sagt das auch; nur die Parameter-Doku weicht ab. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Den Satz wie in der Klassen-TSDoc formulieren: »the canvas (or `resizeToElement`) itself«.

**DOC-041 · info · packages/twopoint5d/src/display/Display.ts:102** (heute `:265`, `:275-280`) — Die bewusst hingenommene Cache-Unschärfe des resize-to-Selektors im TSDoc nennen
Das TSDoc sagt »evaluated each frame«; tatsächlich hält `Display` das gefundene Element, solange es im selben Root-Knoten liegt und noch passt. Ein Element, das später *vor* dem gecachten in Dokumentreihenfolge eingefügt wird und ebenfalls passt, übernimmt nicht — bewusst so entschieden, aber nirgends dokumentiert. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Einen Satz ans TSDoc: der Treffer bleibt, solange er im Root-Knoten liegt und passt; ein später davor eingefügtes Element übernimmt nicht.

**DOC-063 · low · packages/twopoint5d/src/display/Display.ts:409** (heute `:419-422`) — Das TSDoc von Display#frameNo nennt 1 als Startwert, das Feld beginnt bei 0
Aufgefallen im Remediation-Lauf vom 2026-09-21. Das TSDoc sagt »Starts at 1«. Das Feld wird mit `0` angelegt und erst im ersten Frame zu 1.
Empfehlung: Das TSDoc auf »0 vor dem ersten Frame, 1 im ersten Frame« korrigieren.

**DOC-064 · low · packages/twopoint5d/src/display/Display.ts:333** (weitere Stelle: `Display.ts:739`; heute `:343-344`, `:765`) — Zwei TSDoc-Kommentare in Display.ts beziehen sich auf einen früheren Zustand
Aufgefallen im Remediation-Lauf vom 2026-09-21. »matching the legacy behavior« am Resize-Intervall und »no longer cascades« an der `deltaTime`-Obergrenze setzen einen früheren Zustand voraus, den ein Leser nicht kennt.
Empfehlung: Beide Stellen so formulieren, dass sie beschreiben, was jetzt gilt.

**DOC-065 · low · packages/twopoint5d/src/display/Display.ts:380** (heute `:391`) — Das TSDoc von Display#styleImageRendering bricht mitten im Satz ab
Aufgefallen im Remediation-Lauf vom 2026-09-21. »If you want to explicitly specify a value here, set.« — der Satz nennt nicht, was zu setzen ist.
Empfehlung: Den Satz vervollständigen.
(Aus Paket 4 übernommen in Zug 0 von Paket 2: BUG-119 schreibt genau diese TSDoc neu.)

**TEST-042 · medium · packages/twopoint5d-testing/test/stage-pipeline.test.js** (weitere Stellen u. a. `display-resize.test.js:307-327`) — Die riskantesten GPU- und Lifecycle-Pfade mit Browser-Tests absichern
Die Defekte dieses Laufs mit der höchsten Wirkung sitzen dort, wo Vitest-Mocks nichts sehen, und kein Test deckt sie ab. Es gibt keinen Pixel-Readback für Mode E und für ein verschachteltes Plain-Kind über zwei Frames. Nicht getestet sind außerdem Billboards an einem verschobenen Mesh, `texCoordsFromIndex` und die Frame-Index-Formel, ein Dispose während eines echten Init, der Device-Pixel-Clamp bei dpr > 1, der start/stop-Race und ein verlorenes `keyup`. `Display` und `PanControl2D` haben keine `*.spec.ts`.
Empfehlung: Je Pfad einen Browser-Test mit Pixel-Readback bzw. echtem Renderer ergänzen. Für den start/stop-Race und den Chronometer genügen Vitest-Specs mit Renderer-Stub.
(Hier nur der Device-Pixel-Clamp bei dpr > 1; der übrige Display-Anteil ist in Paket 1 erledigt, die Anteile zu Stage, Sprites und PanControl2D bleiben im Audit offen.)

## Urteil des Reviewers

Je Finding (Review Runde 1, in Runde 2 bestätigt):

- BUG-117 behoben — `Display.ts` `#applyMeasuredSize()`: Klemme gegen `wPx * pixelRatio`, `MaxResolution / pixelRatio`, ein `setDrawingBufferSize(#width, #height, pixelRatio)`; Warnung nennt »device pixels«; Spec (dpr 2, dpr 3, `pixelZoom`) und Browser-Test dpr 2 (`canvas.width === 256`)
- BUG-119 behoben — `#applyImageRendering()` (`Display.ts:981-986`) vor der Intervall-Prüfung, außerhalb des Hashs; Spec und Browser-Test
- BUG-120 behoben — `#measureSizeSource()` mit `Number.isFinite` für beide Werte; `types.ts` `ResizeDisplayToFn … | undefined` samt TSDoc; Spec mit `NaN`, `Infinity`, `undefined`
- MEM-018 behoben — `readCanvasState()`/`restoreCanvasState()`, `#callersCanvasBefore`, `#canvasClassName`, `#giveBackCallersCanvas()` (`Display.ts:1305`) synchron vor `#releaseRenderer()`; zwei Browser-Tests in `display-dispose.test.js` (`outerHTML` zeichengleich); `data-engine` mit zurückgesetzt
- READ-001 (Display.ts) behoben — `resize()` als Pipeline aus fünf Schritten, `#fullscreenClassName`/`#fullscreenClassApplied`, keine Kopie mit wechselnder Bedeutung, `typeof document`-Guard entfernt
- DOC-030 behoben — `types.ts` `resizeToAttributeEl` und Klassen-TSDoc gleichlautend zu `"self"`
- DOC-041 behoben — Klassen-TSDoc, Bullet Selektor: Treffer bleibt Quelle, ein später davor eingefügtes Element übernimmt nicht
- DOC-063 behoben — `frameNo`: »`0` until the first frame, `1` during the first one …«
- DOC-064 behoben — `resizePollIntervalMs` ohne »legacy«, `maxDeltaTime` ohne »no longer cascades«
- DOC-065 behoben — TSDoc von `styleImageRendering` vollständig neu
- TEST-042 (dpr-Anteil) behoben — `display-resize.test.js`, `emulateDevicePixelRatio(2)`, prüft `canvas.width`/`height`

Kleine Befunde, offen:

- `Display.ts:299` — Lifecycle-Punkt 3: eine Zeile (~93 Zeichen) ungleich umbrochen gegenüber ihren Nachbarn (~75); kosmetisch.
- Migration Guide `ResizeDisplayToFn`: »handles the `undefined` now« behält sein »now« — ein Migrationshinweis beschreibt einen Übergang; Reviewer hält es für in Ordnung.

Urteile der Nebenbefunde (Queue): `Display.ts:376`/`:447` »exactly once per frame« — Doku des Displays, Scope-Regel greift, low; `Display.ts:468` Zeilenlänge — Scope-Regel greift, info. Beide vorbestehend (Zeilen nicht von diesem Paket geschrieben).

