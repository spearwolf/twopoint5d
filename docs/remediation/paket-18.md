# Paket 18 — Drain: Stage, Display und Doku-Nachträge

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Drain-Runde 1, kein Audit-Finding) · neun Nebenbefunde aus »Offene Befunde«, alle low, Volltext unten · dazu sieben Stellen gleicher Ursache aus Zug 0 (Abschnitt »Dazu«)
- Ziel: Canvas2DStage und die Frame-Loops weisen ungültige Eingaben ab und überstehen werfende Listener, `getContentAreaSize()` misst transformierte Elemente richtig, und Guide, Architektur-Doku und Proposal nennen, was der Code tut.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts`, `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts`, `packages/twopoint5d/src/stage/README.md` (Abschnitt »On `Canvas2DStage`«, Z. 621–629)
  - `packages/twopoint5d/src/display/FrameLoop.ts`, `FrameLoop.spec.ts`, `FixedFrameLoop.ts`, `FixedFrameLoop.spec.ts`, `DisplayStateMachine.ts`, `DisplayStateMachine.spec.ts`, `Display.ts`, `Display.spec.ts`, `types.ts` (TSDoc `maxFps`), `styleUtils.ts`, `styleUtils.spec.ts`
  - `packages/twopoint5d-testing/test/display-resize.test.js`
  - `docs/architecture.md` (§3 Z. 160–169, §6 Z. 511–528), `AGENTS.md` (Z. 57–58)
  - `packages/twopoint5d/docs/text.md` (»Refusals« Z. 174–183, Abschnitt »Measuring: `layoutText()`« ab Z. 185), `packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md` (§4.4 Z. 422, §5.4 Z. 583–601)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`: `### Changed` ab Z. 68, `### Fixed` ab Z. 149 — Eintrag Z. 191 —, `### Migration Guide` ab Z. 209)
- Skills: `updating-changelog` für den CHANGELOG, `project-harness-dev-docs` für das Proposal, `using-eventize` für `emitStrict()`/`emit()`.
- Vorgehen: siehe unten, Teile A–E
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: refuse a fit and a canvas size a Canvas2DStage cannot show, let every listener of its resize event hear it and the frame be drawn behind one that throws, refuse a frame rate of a FrameLoop that is no finite number of 0 or more and give a display no limit for a maxFps that is no positive finite number, make the event names of the frame loops read-only, take the borders and the padding of a transformed element off in the scale of its transform, and catch the text guide, the bitmap text proposal, the architecture docs and AGENTS.md up with what the code refuses and what test:scripts runs`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · alle neun Nebenbefunde unverändert an ihrer Fundstelle (Canvas2DStage `fit` Z. 36–41 und Konstruktor Z. 136/144, `render()` Z. 277–285, Größen Z. 126–127/225–226; `FrameLoop.ts:185` und `:294–295`, `FixedFrameLoop.ts:96–97`; `styleUtils.ts:43–51`; `docs/architecture.md` §6 jetzt Z. 511–528; `text.md` »Refusals« Z. 174–183; Proposal §4.4 jetzt Z. 422) · sieben Stellen gleicher Ursache dazu (»Dazu«), davon eine Folge der eigenen Änderung (`Display.ts:934`) und ein Symptom von Paket 1 (§3 ohne `libraryVitestInputs.test.mjs`), die übrigen am Laufbeginn schon so (`git show 7341059f:…`) · keine offenen `Folgen:` aus erledigten Paketen · Restplan unverändert
  - 2026-10-24 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-18.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG, 20 Dateien geändert (Canvas2DStage samt Spec/README, display/* samt Specs, display-resize.test.js, docs/architecture.md, AGENTS.md, text.md, Proposal, CHANGELOG), roter Lauf 23 Vitest + 10× TS2578 + 2 Browser · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-18.verify.log`)
  - 2026-10-24 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-18.diff`
  - 2026-10-24 Zug 3: Reviewer: alle neun Nebenbefunde und sieben »Dazu«-Stellen behoben; 1 wichtig (CHANGELOG `### Changed` Eintrag zu den readonly-Event-Statics ohne Migration-Guide-Abschnitt), 3 klein · Report `paket-18.review-0.json`
  - 2026-10-24 Zug 4 Runde 1: offen der wichtige Befund (Migration Guide für die Event-Statics) → derselbe Implementierer per `--resume` (opus, medium), Report nach `paket-18.impl-1.json`
  - 2026-10-24 Zug 4 Runde 1: zurück FERTIG — CHANGELOG `### Migration Guide` Abschnitt »Writing over the event names of the frame loops«, Eintrag mit »See the Migration Guide« · Verify `pnpm run ci` exit=0 (`paket-18.verify-1.log`) · Reviewer gezielt (opus, medium), Diff `paket-18.diff-1`
  - 2026-10-24 Zug 4 Runde 1: Reviewer `paket-18.review-1.json`: offener Befund behoben (`CHANGELOG.md:140` + Abschnitt um Z. 961), keine neuen Befunde
  - 2026-10-24 Zug 5: Commit 39ee32e5 auf Verify `paket-18.verify-1.log` (exit=0), Trailer `Remediation-Run: 2026-10-23` · 3 Nebenbefunde in »Offene Befunde« · Plan auf `[x]`

## Dazu (Zug 0)

Stellen derselben Ursache wie ein Nebenbefund des Pakets. Sie gehören hierher,
weil der Nebenbefund sonst nur halb behoben wäre:

1. **`packages/twopoint5d/src/display/DisplayStateMachine.ts:8–15`** — die sieben
   Statics `NEW`, `RUNNING`, `PAUSED`, `Init`, `Start`, `Pause`, `Restart` sind
   beschreibbar; `Init`/`Start`/`Pause`/`Restart` sind Event-Namen, die
   `DisplayStateMachine` emittiert und `Display.ts:961–984` abonniert. Dieselbe
   Ursache wie `FrameLoop.OnFrame`. Intern (nicht in `public-api.ts`), deshalb nur
   `static readonly`, kein CHANGELOG-Eintrag. Am Laufbeginn schon so.
2. **`packages/twopoint5d/src/display/Display.ts:1439–1443`**
   (`#measureSizeSource()`) — dieselbe Rechnung wie `getContentAreaSize()`:
   transformiertes `getBoundingClientRect()` minus untransformierte Rahmen und
   Innenabstände. Laut `CHANGELOG.md` (0.22.0, Migration Guide Z. 4602) erreicht
   eine CSS-Transformation der Größenquelle den Canvas — die transformierte
   Messung ist also gewollt, nur die Ränder passen nicht dazu. Am Laufbeginn
   schon so (damals Z. 1763–1764).
3. **`packages/twopoint5d/src/display/Display.ts:934`** —
   `new FrameLoop(maxFps ?? 0, …)` reicht `maxFps` ungeprüft weiter. Mit Teil B1
   würfe `new FrameLoop()` für `NaN` oder einen negativen Wert — und zwar nach dem
   Bau des Renderers und vor dem `try`, das ihn wieder abbaut: der Renderer
   bliebe liegen. **Folge der eigenen Änderung**, gehört in dieses Paket.
   Unabhängig davon war ein negatives `maxFps` schon inkonsistent: `FrameLoop`
   nahm den Betrag als Grenze, `AdaptiveResolution` (Z. 955,
   `isPositiveFinite(maxFps)`) las es als »keine Grenze«.
4. **`docs/architecture.md:160–169`** (§3, Bullet `test:scripts`) — nennt die
   Specs der Helfer des Preview-Generators (`scripts/lookbook/demoPreviewConfig`,
   `previewServer`, `webpSize`), die Preview-Bild-Probe
   (`demoPreviews.test.mjs`) und die View-Transition-Probe
   (`navViewTransitions.test.mjs`) nicht — am Laufbeginn schon so —, und auch
   `scripts/nxInputs/libraryVitestInputs.test.mjs` nicht, den Paket 1 angelegt und
   nur in §6 eingetragen hat (**Symptom von Paket 1**; kein Nachtragspaket, weil
   dieses Paket dieselbe Aufzählung ohnehin zu Ende bringt).
5. **`docs/architecture.md` §6, Bullet `demoMetadata.test.mjs`** — beschreibt nur
   die Tags; der Spec prüft auch, dass jede Demo-Seite eine JSON-Datei hat, deren
   `url` die Route der Seite ist (`demoMetadata.test.mjs:45`), wie `AGENTS.md`
   (»tags and routes«) sagt.
6. **`AGENTS.md:57–58`** — »`node --test` over the helpers of the publish
   pipeline, the CI cache server, the docs' code block check and the
   Nameable-Types check« lässt die Helfer des Preview-Generators aus. Am
   Laufbeginn schon so (damals Z. 54).
7. **Proposal `dynamic-atlas-and-bitmap-text.md` §5.4, Z. 594–597** — der
   Listenpunkt der Optionen nennt keine Fehlerklasse (`layoutText.ts:274–276`:
   `RangeError` für die Zahlen, `Error` für `align` und `fallback`), und weder
   §5.4 noch `text.md` nennen die Abweisung eines Texts, der kein String ist
   (`TypeError`, `layoutText.ts:277/286`). Dieselbe Ursache wie der
   Nebenbefund zu `text.md` »Refusals«.

## Vorgehen

Zuerst die Regressionstests (Abschnitt »Tests«), rot sehen, dann beheben. Den
roten Lauf in den Report. Browser-Tests laufen gegen das gebaute `dist`: rot
gegen das alte `dist`, dann bauen, grün.

### Teil A — Canvas2DStage (`packages/twopoint5d/src/stage/Canvas2DStage.ts`)

**A1 — `fit` prüfen.**

- Modul-lokal in `Canvas2DStage.ts` (nicht exportiert):

  ```ts
  const FIT_TYPES: ReadonlySet<unknown> = new Set<Canvas2DStageFitType>(['contain', 'cover']);

  // a fit the projection does not know would land in the view specs as it is, and no view follows from it
  function checkFit(fit: unknown, subject: string): Canvas2DStageFitType {
    if (!FIT_TYPES.has(fit)) {
      throw new TypeError(`${subject}: fit must be "contain" or "cover", got ${describeValue(fit)}`);
    }
    return fit as Canvas2DStageFitType;
  }
  ```

  `describeValue` aus `../utils/describeValue.js`. `TypeError` wie die Abweisung
  einer unbekannten Beschreibung in `new ProjectionPlane()` (`ProjectionPlane.ts:43`),
  dem Nachbarn im selben Modul.
- Konstruktor: im vorhandenen Block »before anything is built« (Z. 123–128) auch
  den Fit prüfen — im Zahlen-Arm `args[2]`, im Canvas-Arm `args[1]`, jeweils nach
  `?? 'contain'` (fehlend und `undefined` geben weiter `'contain'`) — mit Subjekt
  `new Canvas2DStage()`: `new Canvas2DStage(): fit must be "contain" or "cover", got "fill"`.
  Die Prüfung steht vor `this.renderer = renderer` und `new StageRenderer()`.
  Die Zuweisungen `this.#fit = fit ?? this.#fit` (Z. 136, 144) nehmen dann den
  geprüften Wert.
- Setter `fit` (Z. 36–41): `checkFit(value, 'Canvas2DStage')` als erste Zeile,
  **vor** `if (this.#disposed || this.#fit === value) return;` — eine ungültige
  Eingabe wird auch nach `dispose()` abgewiesen (`docs/resource-lifecycle.md` §3,
  Regel 3: »Invalid input is still turned away«), der Fit bleibt stehen. Meldung
  `Canvas2DStage: fit must be "contain" or "cover", got "fill"` (Subjekt die
  Klasse, wie bei den Settern `Map2DTileCoordsUtil#xOffset`).
- TSDoc: der Getter `fit` bekommt eine (heute keine): `'contain'` (Vorgabe) oder
  `'cover'`, wie die View die Canvas in den Container bringt; ein anderer Wert
  wirft einen `TypeError` und lässt den Fit stehen, auch auf einer disposten
  Stage, wo ein gültiger Wert nichts tut. Der Konstruktor bekommt eine TSDoc mit
  `@throws {RangeError}` (Breite oder Höhe keine endliche Zahl ab 1, siehe A2) und
  `@throws {TypeError}` (ein Fit außer `'contain'`/`'cover'`), jeweils bevor etwas
  gebaut ist.

**A2 — Breite und Höhe unter 1 abweisen.**

- Modul-lokal in `Canvas2DStage.ts`:

  ```ts
  // a canvas takes its width and its height as whole numbers and rounds a fraction down: below 1 it has no area
  function assertCanvasSide(value: unknown, subject: string, name: string): number {
    if (!isFiniteNumber(value) || value < 1) {
      throw new RangeError(`${subject}: ${name} must be a finite number of 1 or more, got ${describeValue(value)}`);
    }
    return value;
  }
  ```

  `isFiniteNumber` aus `../utils/isFiniteNumber.js`. Statt
  `assertPositiveFinite()` in Z. 126–127 (Subjekt `new Canvas2DStage()`) und Z.
  225–226 (Subjekt `Canvas2DStage#setCanvasSize()`); der Import von
  `assertPositiveFinite` fällt weg, wenn er sonst nicht gebraucht wird.
  Gebrochene Werte ab 1 bleiben zulässig — die Canvas rundet ab, und
  `#followCanvasSize()` liest die Größe danach von der Canvas (Kommentar Z.
  239–240 stimmt weiter).
- Der Kommentar Z. 124–125 bleibt sinngemäß; »a canvas without area« trifft jetzt
  auch den Fall unter 1.
- TSDoc von `dispose()` (Z. 331–334): »`setCanvasSize()` still refuses a size
  that is no finite number of 1 or more, `setContainerSize()` one that is no
  finite number, and a write to `fit` one that is neither `'contain'` nor
  `'cover'`.« (Wortlaut frei, Inhalt so.)
- Die vorhandenen Tests `the constructor refuses a width or a height that is not a
  finite number above 0` und `setCanvasSize() refuses a width that is not a finite
  number above 0, also after dispose()` (`Canvas2DStage.spec.ts:299–322`) ziehen
  auf den neuen Wortlaut und Namen um (»… that is no finite number of 1 or more …«).

**A3 — `render()`: `OnCanvas2DStageResize` hinter einem werfenden Listener.**

Vorbild ist `Stage2D#updateFrame()` mit `OnStageFirstFrame`
(`Stage2D.ts:355–411`): `emitStrict()`, Zustand vor dem Wurf abgeschlossen, der
Frame geht weiter, die Fehler kommen danach über `throwCollected()`.

- Z. 277–305 so umbauen (Struktur verbindlich, Kommentare frei):

  ```ts
  let resizeFailed = false;
  let resizeError: unknown;

  if (this.width !== this.#lastWidth || this.height !== this.#lastHeight) {
    // ahead of the event: a listener reads sprite and view in the new size already
    this.#followCanvasSize();

    // ahead of the event as well: a listener that throws must not bring the same size back
    // as a change in every frame after it
    this.#lastWidth = this.width;
    this.#lastHeight = this.height;

    try {
      emitStrict(this, OnCanvas2DStageResize, this);
    } catch (error) {
      resizeFailed = true;
      resizeError = error;
    }
  }

  try {
    emit(this, OnCanvas2DStageRender, this);
    this.#updateTexture();
    // … die Uhr wie bisher (Z. 291–302) …
    this.stageRenderer.updateFrame(now, deltaTime, frameNo);
    this.stageRenderer.renderTo(this.renderer);
  } catch (error) {
    if (!resizeFailed) throw error;
    throwCollected(
      [resizeError, error],
      'Canvas2DStage#render(): a listener of OnCanvas2DStageResize threw, and so did the frame after it',
    );
  }

  if (resizeFailed) throw resizeError;
  ```

- `#dispatchEvent()` (Z. 308–310) entfällt; beide Events werden direkt
  emittiert. `OnCanvas2DStageRender` bleibt `emit()`: ein werfender
  Render-Listener beendet den Frame (kein Upload, kein Zeichnen), wie
  `OnStageUpdateFrame` bei `Stage2D`.
- Mehrere werfende Resize-Listener: `emitStrict()` wirft selbst schon einen
  `AggregateError`; der geht unverändert als `resizeError` weiter.
- TSDoc von `render()` (Z. 256–271), neuer Absatz: Jeder Listener von
  `OnCanvas2DStageResize` hört das Event, auch hinter einem, der wirft; die Stage
  hat die neue Größe übernommen, bevor es hinausgeht — der nächste `render()`
  schickt für sie kein zweites —, der Frame geht weiter mit
  `OnCanvas2DStageRender`, dem Upload und dem Zeichnen, und der Fehler erreicht
  den Aufrufer danach, einer unverändert, mehrere als `AggregateError`.
  `OnCanvas2DStageRender` geht über `emit()`: ein werfender Listener beendet den
  Frame, die Canvas wird weder hochgeladen noch gezeichnet.
- `packages/twopoint5d/src/stage/README.md` Z. 621–629: der Bullet
  `OnCanvas2DStageResize` bekommt denselben Satz in kurz, im Ton von Z. 615–619
  (Stage2D): jeder Listener hört es, die Stage hat die Größe übernommen, der
  Frame wird gezeichnet, der Fehler kommt danach; `OnCanvas2DStageRender` geht
  über `emit()`.
- Kein Allokations-Spec deckt `Canvas2DStage#render()` ab; trotzdem kein Objekt
  pro Frame im Pfad ohne Wurf (die beiden Locals sind Skalare, das Array für
  `throwCollected()` entsteht nur im Fehlerfall).

### Teil B — Frame-Loops (`packages/twopoint5d/src/display/`)

**B1 — `FrameLoop`.**

- `FrameLoop.ts:185`: `static readonly OnFrame = OnFrame;` mit TSDoc: der Name des
  Events, unter dem jeder Frame hinausgeht; ein Ziel, das {@link start}
  bekommt, empfängt ihn über seine Methode dieses Namens.
- `start()` (Z. 315), `stop()` (Z. 328) und `#onRAF` (Z. 379) nehmen die
  Modulkonstante `OnFrame`, nicht `FrameLoop.OnFrame` — Kommentar an einer der
  drei Stellen: ein Schreiben über `FrameLoop.OnFrame` aus JavaScript kann
  `on()`, `emit()` und `off()` so nicht auseinanderbringen.
- Modul-lokal:

  ```ts
  function checkMaxFps(maxFps: unknown, subject: string): number {
    if (!isFiniteNumber(maxFps) || maxFps < 0) {
      throw new RangeError(`${subject}: maxFps must be a finite number of 0 or more, got ${describeValue(maxFps)}`);
    }
    return maxFps;
  }
  ```

  Wortlaut »a finite number of 0 or more« wie `TexturePackerJson.ts:135` und
  `TileSet.ts:249`. Imports `isFiniteNumber` (`../utils/isFiniteNumber.js`) und
  `describeValue` (`../utils/describeValue.js`).
- `setFps(maxFps: number): void` (Z. 294–298): erste Zeile
  `checkMaxFps(maxFps, 'FrameLoop#setFps()')`, dann `this.#maxFps = maxFps`
  (kein `Math.abs`, kein `Number.isFinite`-Zweig mehr); eine Abweisung lässt
  Grenze, `#nextEmitAt` und `#emitTolerance` stehen. TSDoc (heute keine): begrenzt
  die Frames, die die Loop emittiert, auf `maxFps` je Sekunde, `0` emittiert auf
  jedem Animation Frame; der Takt beginnt mit dem nächsten Frame neu;
  `@throws {RangeError}` für einen Wert, der keine endliche Zahl ab 0 ist — die
  Loop behält ihre Grenze.
- Konstruktor (Z. 288–292): `checkMaxFps(maxFps, 'new FrameLoop()')` als erste
  Zeile, vor `eventize(this)` und `RAF.get(renderer)`; danach wie bisher
  `this.setFps(maxFps)`. TSDoc mit `@throws {RangeError}`, bevor die Loop einen
  Treiber nimmt. `-0` bleibt zulässig (`-0 < 0` ist `false`).

**B2 — `FixedFrameLoop.ts:96–97`:** `static readonly OnTick = OnTick;` und
`static readonly OnRender = OnRender;`, je mit einer Zeile TSDoc (das Event jedes
Simulationsschritts, {@link onTick} abonniert es / das Event jedes Render-Frames,
{@link onRender} abonniert es). Die Interna nehmen schon die Modulkonstanten
(Z. 235, 254, 304, 310) — sonst nichts zu ändern.

**B3 — `DisplayStateMachine.ts:8–15`:** alle sieben `static readonly`, die Typen
bleiben (`static readonly NEW: DisplayStateName = 'new'`; `Init` usw. werden zu
Literaltypen, `Display.ts:961–984` verträgt das).

**B4 — `Display` und `maxFps`.**

- `Display.ts:934`:
  `this.#frameLoop = new FrameLoop(isPositiveFinite(maxFps) ? maxFps : 0, this.#renderer);`
  mit Kommentar: ein `maxFps`, das keine positive endliche Zahl ist, ist keine
  Grenze — wie `adaptiveResolution` es unten liest —, und `new FrameLoop()` wiese
  es erst ab, wenn der Renderer schon steht. `isPositiveFinite` ist schon
  importiert (Z. 33).
- Grund für »nachsichtig statt werfen«: die Geschwister-Optionen im selben
  Objekt — `maxPixelRatio`, `maxPixels` (`types.ts:57–67`) — fallen für alles
  außer einer positiven endlichen Zahl ebenso still auf ihre Vorgabe zurück,
  dokumentiert; `new Display()` bleibt damit für keine seiner Zahlenoptionen ein
  werfender Konstruktor.
- TSDoc von `DisplayParameters.maxFps` (`types.ts:46–54`): »Without it, with 0,
  or with anything but a positive finite number, the display draws as many frames
  as the page gives it.« an die Stelle von »If nothing or 0 is specified here, the
  maximum possible FPS are used.«; der Absatz davor bleibt.

### Teil C — Inhaltsfläche transformierter Elemente

**C1 — `packages/twopoint5d/src/display/styleUtils.ts`.**

- Neue Funktion, exportiert aus dem Modul, **nicht** in `public-api.ts`:

  ```ts
  /**
   * A side of the content area as `getBoundingClientRect()` measures it: `rectSide` less
   * `innerMargin` — the borders and the padding of that side from the computed style — in the scale
   * the CSS transforms of the element and its ancestors give the element, `rectSide / layoutSide`.
   * `layoutSide` is the same side of the border box without transforms, `offsetWidth` or
   * `offsetHeight`. Where it is no number above 0 — an SVG element has none — or lies within 1 of
   * `rectSide`, which is how far `offsetWidth` and `offsetHeight` round, the margin comes off as the
   * style gives it.
   */
  export function contentAreaSide(rectSide: number, layoutSide: unknown, innerMargin: number): number {
    if (typeof layoutSide !== 'number' || !(layoutSide > 0) || Math.abs(rectSide - layoutSide) < 1) {
      return rectSide - innerMargin;
    }
    return rectSide - innerMargin * (rectSide / layoutSide);
  }
  ```

  Warum die Schwelle 1: `offsetWidth`/`offsetHeight` sind ganze Zahlen (CSSOM
  View, `long`), ein untransformiertes Element mit gebrochener Breite läge sonst
  um bis zu 0,5 px daneben und bekäme eine Skala ≠ 1. Unter der Schwelle bleibt
  die Rechnung exakt die bisherige; der Fehler bei einer Skala nahe 1 ist kleiner
  als `innerMargin / layoutSide` px und damit unter 1 px.
- `getContentAreaSize()` (Z. 37–53): `width` über
  `contentAreaSide(elementSize.width, (element as HTMLElement).offsetWidth, horizontalInnerMargin)`,
  `height` entsprechend mit `offsetHeight`/`verticalInnerMargin`. Duck-Typing statt
  `instanceof HTMLElement`: ein Element aus einem iframe (die Library nimmt
  Elemente aus same-origin iframes, `Display`-Konstruktor) hat ein anderes
  `HTMLElement`.
- TSDoc von `getContentAreaSize()` (Z. 31–36): Rahmen und Innenabstände gehen in
  der Skala ab, die die CSS-Transformationen des Elements und seiner Vorfahren
  ihm geben — ein Element unter `scale(2)` antwortet mit der doppelten
  Inhaltsbox; ein gedrehtes Element mit seiner Bounding Box aus
  `getBoundingClientRect()`, die Ränder in deren Verhältnis zur Layoutgröße; ein
  Element ohne `offsetWidth` — ein SVG-Element — mit den Rändern, wie der Style
  sie gibt. Der Satz »A transformed element is measured with its transform, as
  `getBoundingClientRect()` measures it.« geht darin auf.

**C2 — `packages/twopoint5d/src/display/Display.ts:1439–1443`** (`#measureSizeSource()`):

```ts
// the content area: the client rect minus padding and border, both in the scale the transforms give the element
const rect = element.getBoundingClientRect();
const style = this.#getSourceStyle(element, canvas);
this.#measuredWidth = contentAreaSide(rect.width, (element as HTMLElement).offsetWidth, getHorizontalInnerMargin(style));
this.#measuredHeight = contentAreaSide(rect.height, (element as HTMLElement).offsetHeight, getVerticalInnerMargin(style));
```

Import von `contentAreaSide` aus `./styleUtils.js` (Z. 41). Die Klassen-TSDoc
Z. 251–252 (»3. Otherwise the content-area … minus padding/border.«) sagt
dazu, dass Rahmen und Innenabstände in der Skala einer CSS-Transformation des
Elements abgehen, wie bei `getContentAreaSize()`. `pnpm test:allocations` muss
grün bleiben (`src/display/hot-path-allocations.spec.ts` misst `resize()`;
`contentAreaSide()` legt kein Objekt an, die Mocks dort haben kein
`offsetWidth` und laufen über den ersten Zweig).

### Teil D — Doku

**D1 — `docs/architecture.md` §3, Bullet `test:scripts` (Z. 160–169):** zur
Aufzählung kommen, im Stil der vorhandenen Glieder: die Specs der Helfer des
Preview-Generators des Lookbooks (`scripts/lookbook/demoPreviewConfig.mjs`,
`previewServer.mjs`, `webpSize.mjs`), die Probe, dass jede Datei, die git unter
`packages/twopoint5d/src/` führt, ein Input von `test`, `coverage` und
`allocations` der Library ist, die Probe der Preview-Bilder gegen die Demos, ihre
Ids und die Kartengröße, und die Probe der View-Transition-Namen der Navbar gegen
ihre zwei Seiten und die Stylesheets. Gegen das Dateisystem gehalten:
`git ls-files 'scripts/**/*.test.mjs'` — jede der 30 Dateien muss sich in einem
Glied des Bullets wiederfinden.

**D2 — `docs/architecture.md` §6 (Z. 511–528):**

- Erster Satz: »The helpers of the publish pipeline, the CI cache server, the code
  block check, the Nameable-Types check and the preview generator of the lookbook
  run under `node --test` (`pnpm test:scripts`), and seven more specs share that
  run.«; »The five are:« → »The seven are:«.
- Neue Bullets, im Stil der vorhandenen:
  - `scripts/lookbook/demoPreviews.test.mjs` hält
    `apps/lookbook/public/images/demo-preview/` (`previewDir` in
    `scripts/lookbook/lookbookDemos.mjs:9`) zu den Demos: ein `<id>.webp` je
    Demo, nichts sonst, jedes in der Größe der Karte, und keine Metadatei, die ein
    Bild nennt — die Karte leitet es aus der Id ab.
  - `scripts/lookbook/navViewTransitions.test.mjs` hält die
    `view-transition-name`s jeder der zwei Seiten des Lookbooks zu den Paaren des
    Designs und die Stylesheets zu den Namen, die die Seiten deklarieren; weder
    der Build noch `astro check` sehen davon etwas (Kopfkommentar des Specs).
- Bullet `demoMetadata.test.mjs`: dazu, dass jede Demo-Seite eine JSON-Datei hat,
  deren `url` die Route der Seite ist.
- Zeilen bis 90 Zeichen, wie der Rest der Datei.

**D3 — `AGENTS.md:57–58`:** »over the helpers of the publish pipeline, the CI
cache server, the docs' code block check, the Nameable-Types check and the
lookbook's preview generator (`scripts/**/*.test.mjs`)«. Der Rest des Bullets
stimmt (gegen die Liste der Specs gehalten).

**D4 — `packages/twopoint5d/docs/text.md` »Refusals« (Z. 174–183)** — jede
Abweisung mit ihrer Klasse, maßgeblich die TSDoc `writeText.ts:130–136`,
`:174–180` und `layoutText.ts:274–277`:

- Art ohne `InstancePosition`, `QuadSize` oder `AtlasFrame` → `TypeError`, bevor
  ein Sprite entsteht, jedes fehlende Feature benannt;
- Pool voll → `RangeError`, mit der Zahl; die bis dahin erzeugten Sprites werden
  wieder frei;
- ein Fehler von `createSprite()` → unverändert weiter, nach derselben Freigabe;
- `scale`, `lineHeight`, `maxWidth` keine endliche Zahl über 0, und `x`, `y`, `z`,
  `letterSpacing` keine endliche Zahl → `RangeError` (heute fehlen `x`, `y`, `z`,
  `letterSpacing`, und »no number above 0« wird »no finite number above 0«);
  `align` unbekannt, `fallback` kein einzelnes Zeichen oder keine Glyphe der
  Schrift → `Error`; jeweils mit der Option benannt;
- ein Text, der kein String ist → `TypeError`;
- `rewriteText()`: eine Glyphe, die kein Sprite dieser Sprites ist → `TypeError`
  mit ihrem Index, bevor sich etwas ändert; Pool voll: die Glyphen behalten ihren
  Text.
- Der Satz zu disposten Sprites bleibt.
- Im Abschnitt »Measuring: `layoutText()`« (ab Z. 185) ein Satz, falls er es
  nicht schon sagt: `layoutText()` weist seine Optionen und einen Text, der kein
  String ist, ab wie `writeText()`.
- Ton des Guides halten: für Nutzer, ohne Interna, ohne Historie
  (`packages/twopoint5d/docs/proposals/README.md` zur Aufteilung).

**D5 — Proposal `dynamic-atlas-and-bitmap-text.md` §4.4, Z. 422:** »`width`,
`height` below 0« → »`x`, `y`, `width`, `height` below 0« (`AT_LEAST_ZERO`,
`BitmapFont.ts:107`).

**D6 — Proposal §5.4 (Z. 583–601):** im Listenpunkt der Optionen (Z. 594–597)
die Klassen: `RangeError` für die Zahlen, `Error` für `align` und `fallback`; ein
neuer Listenpunkt: ein Text, der kein String ist — ein `TypeError`
(`layoutText: the text must be a string, got 5`). Die Statuszeile des Proposals
bleibt, wie sie ist (Skill `project-harness-dev-docs`: ein gebautes Proposal
darf nachgezogen werden).

Kein CHANGELOG-Eintrag für Teil D (nur Doku, wie Paket 16).

### Teil E — `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`

Skill `updating-changelog`; Konventionen des Plans (kein Rückblick auf den
Vorzustand, jeder Bruch mit Migrationshinweis). Die Einträge unten geben den
Inhalt vor; geschrieben werden sie englisch, im Ton der Nachbareinträge.

- `### Changed`, drei neue Einträge:
  1. `FrameLoop#setFps()` und `new FrameLoop()` werfen einen `RangeError` für
     ein `maxFps`, das keine endliche Zahl ab 0 ist — `NaN`, ±`Infinity`, ein
     negativer Wert —, und `setFps()` behält dabei seine Grenze (**BREAKING**).
     Ein `maxFps` von `Display`, das keine positive endliche Zahl ist, gibt der
     Frame-Loop keine Grenze, wie `adaptiveResolution` es liest. See the
     Migration Guide.
  2. `FrameLoop.OnFrame`, `FixedFrameLoop.OnTick` und `FixedFrameLoop.OnRender`
     sind `static readonly` (**BREAKING** for TypeScript), und eine `FrameLoop`
     abonniert, emittiert und meldet ab unter dem Event-Namen ihres Moduls, was
     auch immer auf dem Static steht.
  3. `new Canvas2DStage()` und ein Schreiben von `fit` weisen einen Fit außer
     `'contain'` und `'cover'` mit einem `TypeError` ab, der den Aufruf nennt —
     der Konstruktor, bevor etwas gebaut ist, das Schreiben auch auf einer
     disposten Stage, und der Fit bleibt stehen (**BREAKING**). See the Migration
     Guide.
- `### Fixed`:
  4. Eintrag Z. 191 anpassen (unveröffentlicht, darf geändert werden): »refuse a
     width or a height that is no finite number of 1 or more« statt »… above 0«,
     mit dem Grund in einem Halbsatz — eine Canvas rundet Breite und Höhe auf
     ganze Zahlen ab und hätte unter 1 keine Fläche. Der Rest des Eintrags bleibt.
  5. neu: `Canvas2DStage#render()` — jeder Listener von `OnCanvas2DStageResize`
     hört das Event auch hinter einem, der wirft; die Stage hat die Größe
     übernommen, der nächste `render()` schickt für sie kein zweites, der Frame
     wird gezeichnet, und der Fehler erreicht den Aufrufer danach, einer
     unverändert, mehrere als `AggregateError`.
  6. neu: `getContentAreaSize()` und die Messung der Größenquelle eines `Display`
     ziehen Rahmen und Innenabstand eines Elements, das eine CSS-Transformation
     skaliert, in der Skala dieser Transformation ab: ein Element unter
     `scale(2)` misst seine doppelte Inhaltsbox.
- `### Migration Guide`, zwei neue Abschnitte im Muster der vorhandenen
  (`#### …`, `**Before**`, `**After**`):
  - `#### The frame rate of a FrameLoop` — Before `new FrameLoop(-30)` /
    `loop.setFps(Number.POSITIVE_INFINITY)`, After `new FrameLoop(30)` /
    `loop.setFps(0)` (0 ist »keine Grenze«).
  - `#### A Canvas2DStage given a fit or a size it cannot show` — ein Fit außer
    `'contain'`/`'cover'` (nur aus JavaScript erreichbar) und eine Breite oder
    Höhe unter 1: was stattdessen zu übergeben ist.
  - Codeblöcke: wo ein Block für sich steht, `ts check` (in `[Unreleased]`
    compiliert der Check sie); ein Aufruf, den die Typen verbieten (`'fill'`),
    steht in einem nicht markierten `ts`- oder `js`-Block oder mit `as never`,
    wie es die vorhandenen Abschnitte halten.

## Tests

Zuerst schreiben, rot sehen (außer den als Charakterisierung markierten), dann
Teile A–C.

**Vitest**

- `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts`
  - `the constructor refuses a fit it does not know with a TypeError, before anything is built` — Zahlen- und Canvas-Arm, `'fill'` und `5` (`as never`), Meldung wörtlich `new Canvas2DStage(): fit must be "contain" or "cover", got "fill"`.
  - `a write to fit refuses a value it does not know with a TypeError and keeps the fit it has, also after dispose()` — Meldung `Canvas2DStage: fit must be "contain" or "cover", got "fill"`, `stage.fit` danach unverändert, `projection.viewSpecs.fit` ebenso.
  - `the constructor and setCanvasSize() refuse a width or a height below 1, which would leave a canvas without area` — `0.5`, `0.999`; Meldung `… must be a finite number of 1 or more, got 0.5`; `setCanvasSize()` auch nach `dispose()`.
  - Charakterisierung: `takes a width of 1, and a fraction above it as the canvas rounds it down` — `1` und `1.5` → `width === 1`.
  - `a listener of OnCanvas2DStageResize that throws: every listener hears it, the frame is drawn, the error comes out afterwards, and the next render() sends no second OnCanvas2DStageResize` — zwei Listener, der erste wirft; der zweite wurde gerufen, `OnCanvas2DStageRender` kam, `stageRenderer.renderTo` (Spy) wurde gerufen, `render()` warf genau den Fehler des ersten, ein zweiter `render()` ohne Größenwechsel ruft keinen Resize-Listener.
  - `a listener of OnCanvas2DStageResize and one of OnCanvas2DStageRender that throw come out together as an AggregateError` — `errors` in dieser Reihenfolge.
  - Die zwei vorhandenen Größentests (Z. 299–322) auf den neuen Wortlaut.
- `packages/twopoint5d/src/display/FrameLoop.spec.ts`
  - `setFps() refuses %p with a RangeError and keeps the limit it had` — `test.each` über `NaN`, `Infinity`, `-Infinity`, `-1`, `'30'`; nach `setFps(30)` und der Abweisung drosselt die Loop weiter auf 30 (Ticks wie in `setFps() resets the schedule mid-loop`, Z. 200ff.). Meldung `FrameLoop#setFps(): maxFps must be a finite number of 0 or more, got NaN`.
  - `new FrameLoop() refuses %p in its own name` — dieselben Werte, Subjekt `new FrameLoop()`.
  - `keeps emitting to a target subscribed under FrameLoop.OnFrame when JavaScript writes over the static` — Ziel mit Methode `[FrameLoop.OnFrame]`, danach `(FrameLoop as unknown as {OnFrame: symbol}).OnFrame = Symbol('other')`, ein Tick erreicht das Ziel; im `finally` den Static zurücksetzen.
  - `FrameLoop.OnFrame is read-only for TypeScript` — Muster `FrameBasedAnimations.spec.ts:843–849` (Funktion, nie gerufen, `@ts-expect-error`); rot ist hier `pnpm typecheck` mit TS2578.
- `packages/twopoint5d/src/display/FixedFrameLoop.spec.ts`: `OnTick and OnRender are read-only for TypeScript` (dasselbe Muster, beide Statics).
- `packages/twopoint5d/src/display/DisplayStateMachine.spec.ts`: `its states and its event names are read-only for TypeScript` (alle sieben, dasselbe Muster).
- `packages/twopoint5d/src/display/Display.spec.ts`
  - `a maxFps that is no positive finite number gives the frame loop no limit` — `maxFps: -30`: bei Frames im Abstand von 16 ms kommt jeder als `OnDisplayRenderFrame` (vor dem Fix jeder zweite); `NaN` und `Infinity` bauen ein Display ohne Wurf (Charakterisierung, vor dem Fix schon grün).
  - `measures a size source scaled by a CSS transform with its borders and padding in that scale` — Größenquelle mit `getBoundingClientRect` `{width: 640, height: 400}`, `offsetWidth` 320, `offsetHeight` 200, und einem `getComputedStyleStub`, der für diese Quelle je Seite `padding` 10px gibt (der Stub in `beforeEach`, Z. 119–121, gibt sonst nur `box-sizing`); erwartet ist die Inhaltsgröße 600 × 360 an der Stelle, an der die übrigen Messungstests sie ablesen.
- `packages/twopoint5d/src/display/styleUtils.spec.ts`
  - `takes the borders and the padding off in the scale a transform gives the element` — `getBoundingClientRect` `{width: 2000, height: 1000}`, `offsetWidth` 1000, `offsetHeight` 500, der vorhandene `style` → `width` 2000 − 2·204 = 1592, `height` 1000 − 2·51 = 898.
  - Charakterisierung: `takes them off as the style gives them where the offset size lies within 1 of the client rect` — `{width: 1000.4, height: 500.3}`, `offsetWidth` 1000, `offsetHeight` 500 → 796.4 bzw. 449.3 (`toBeCloseTo`).
  - Der vorhandene Fall `subtracts the inner margin of each axis from the bounding box` (Element ohne `offsetWidth`) bleibt und gilt als Fall »ohne Layoutgröße«; Name darf das sagen.
  - `contentAreaSide()` direkt: `layoutSide` `undefined`, `0`, `NaN` → ohne Skala.

**Browser** — `packages/twopoint5d-testing/test/display-resize.test.js` (alle vier Launcher):

- `getContentAreaSize() of an element at scale(2) answers twice its content box` — `div` mit `width: 200px; height: 100px; padding: 10px; border: 5px solid; box-sizing: content-box; transform: scale(2); transform-origin: 0 0` → 400 × 200 (vor dem Fix 430 × 230; rot gegen das alte `dist`).
- Charakterisierung: `getContentAreaSize() of an untransformed element of a fractional width answers that width` — `width: 200.5px`, `padding: 10px` → 200,5 (`closeTo`, 1e-6).
- `a display measures a resizeToElement at scale(2) as twice its content box` — Ablesestelle wie im Test `uses resizeToElement option as the size source` (Z. 101ff.); rot gegen das alte `dist`.
- Aufräumen über die Muster der Datei (`afterEach`, `disposeDisplay()`); `getContentAreaSize` ist aus `@spearwolf/twopoint5d` exportiert.

## Findings im Volltext

Die neun Nebenbefunde, wie sie in »Offene Befunde« stehen (Zeilennummern dort
vom Zeitpunkt der Meldung, die aktuellen im Verlauf oben):

**Nebenbefund · low · `docs/architecture.md:477-479` (§6)** — die Aufzählung der
Specs, die in `pnpm test:scripts` neben den Checks mitlaufen, nennt fünf;
`AGENTS.md:60-69` führt weitere (Preview-Bilder und View-Transition-Namen des
Lookbooks), die Zählung war schon vor dem Lauf zu klein · aus Paket 1.

**Nebenbefund · low · `packages/twopoint5d/src/stage/Canvas2DStage.ts:35`** (Setter
`fit`) und das `fit`-Argument des Konstruktors — nehmen jeden Wert ungeprüft, aus
JavaScript landet z. B. `'fill'` in den View-Specs, obwohl `Canvas2DViewSpecs` nur
`contain`/`cover` kennt · aus Paket 5.

**Nebenbefund · low · `packages/twopoint5d/src/stage/Canvas2DStage.ts` `render()`**
— `OnCanvas2DStageResize` geht über `emit()` hinaus, `#lastWidth`/`#lastHeight`
werden erst danach geschrieben: ein werfender Listener lässt das Event in jedem
folgenden `render()` wiederkommen, der Frame wird nicht gezeichnet · aus Paket 5.

**Nebenbefund · low · `packages/twopoint5d/docs/text.md:172–181`** (nach Paket 16
Z. 174–183), zweiter Absatz »Refusals« zu `writeText()`/`rewriteText()`/`layoutText()`
— nennt keine Fehlerklasse, obwohl `writeText.ts` `TypeError` (Art ohne Features,
fremde Glyphe) und `RangeError` (Pool voll) wirft und `layoutText.ts` `RangeError`
(`scale`, `lineHeight`, `maxWidth`) und `Error` (`align`, `fallback`); TSDoc und
Proposal §5.4 nennen sie, am Laufbeginn schon so · aus Paket 16.

**Nebenbefund · low · `packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md:420–421`**
(§4.4, Listenpunkt »a char whose `id` …«; nach Paket 16 Z. 421–422) — nennt unter
0 nur `width`, `height`; der Konstruktor weist auch `x`, `y` unter 0 ab
(`AT_LEAST_ZERO`, `BitmapFont.ts:107`), am Laufbeginn schon so · aus Paket 16.

**Nebenbefund · low · `packages/twopoint5d/src/display/FrameLoop.ts:185`** —
`static OnFrame = OnFrame;` ist beschreibbar: ein `FrameLoop.OnFrame = …` trennt
`on()` in `start()` und `emit()` in `#onRAF` vom `off()` in `stop()`, das Event
geht ins Leere; `readonly` fehlt. Dasselbe bei `FixedFrameLoop.OnTick`/`OnRender`
(`FixedFrameLoop.ts:96–97`, Event-Namen wie `OnFrame`; Zug 0 von Paket 13 — die
übrigen beschreibbaren Statics in `display` sind laut TSDoc absichtlich
einstellbar) · aus Paket 9.

**Nebenbefund · low · `packages/twopoint5d/src/display/FrameLoop.ts:294` `setFps()`**
— `NaN` oder `Infinity` wird still zu 0, ein negativer Wert still zu seinem
Betrag; die Library weist solche Werte sonst mit `RangeError` ab · aus Paket 9.

**Nebenbefund · low · `packages/twopoint5d/src/stage/Canvas2DStage.ts:126–127` und
`:225–226`** — `assertPositiveFinite` lässt Breiten und Höhen zwischen 0 und 1
durch (z. B. 0.5); `canvas.width = 0.5` ergibt eine Canvas der Breite 0, die
Textur wird nie hochgeladen · aus Paket 9.

**Nebenbefund · low · `packages/twopoint5d/src/display/styleUtils.ts:43`
`getContentAreaSize()`** — zieht Rahmen und Innenabstand aus dem berechneten
(untransformierten) Style von der transformierten Größe aus
`getBoundingClientRect()` ab; bei einem skalierten Element passen beide nicht
zusammen, die TSDoc nennt die Messung mit Transformation · aus Paket 13.

## Entscheidungen in Zug 0 (mit Grund)

- **`fit` als `TypeError`**, nicht `RangeError` oder `Error`: ein String außerhalb
  einer geschlossenen Menge ist ein Wert des falschen Typs (`Canvas2DStageFitType`);
  `new ProjectionPlane()` im selben Modul weist eine unbekannte Beschreibung
  ebenso ab.
- **Größe »ab 1« statt »ganze Zahl«**: gebrochene Werte ab 1 rundet die Canvas ab,
  und `#followCanvasSize()` ist darauf gebaut (Kommentar Z. 239–240); eine
  Ganzzahlpflicht bräche Aufrufer mit `300.5`, ohne dass ihnen etwas fehlte.
- **`render()` zeichnet hinter einem werfenden Resize-Listener weiter** und wirft
  danach — wie `Stage2D#updateFrame()` hinter `OnStageFirstFrame`, der nächste
  Nachbar mit einem einmaligen Event auf dem Frame-Pfad. `OnCanvas2DStageRender`
  bleibt `emit()`: wirft der Zeichencode, ist der Canvas-Inhalt halb, und ihn
  hochzuladen wäre falsch.
- **`setFps()` wirft, `Display` bleibt nachsichtig**: `setFps()` ist ein
  Methodenaufruf auf einer Klasse ohne dokumentierte Nachsicht, die Library weist
  Zahlen dort über `assertFinite()`-Muster ab; die Optionen von `Display`
  (`maxPixelRatio`, `maxPixels`) fallen dokumentiert zurück, und `maxFps` folgt
  ihnen — sonst würfe `new Display()` nach dem Bau des Renderers (Dazu 3).
- **`OnFrame` intern über die Modulkonstante**: `static readonly` schützt nur
  TypeScript; dass `on()`, `emit()` und `off()` denselben Namen nehmen, soll auch
  in JavaScript gelten. `FixedFrameLoop` tut das schon.
- **`getContentAreaSize()` skaliert die Ränder**, statt die Doku an den Code
  anzupassen: die Messung mit Transformation ist der dokumentierte und — für
  `Display` laut Migration Guide 0.22.0 — gewollte Weg; nur die Ränder passten
  nicht dazu. `Display` nimmt dieselbe Hilfsfunktion, sonst liefen beide Messungen
  auseinander.
- **Modell stärkste Stufe, Effort medium**: drei Module, zwei Browser-Fälle, vier
  Dokumente und zwei Migration-Guide-Abschnitte mit den Prosa-Konventionen des
  Plans — breit, aber jede Stelle hier ausbuchstabiert.

## Urteil des Reviewers (Zug 3 und Runde 1)

Nebenbefunde, alle behoben:

1. `docs/architecture.md` §6 — »seven more«, Bullets `demoPreviews.test.mjs` und `navViewTransitions.test.mjs` (`docs/architecture.md:518–538`)
2. `Canvas2DStage#fit` und Konstruktor — `checkFit()` im Setter vor dem Disposed-Guard, im Konstruktor vor dem Bau (`Canvas2DStage.ts:28`, `:62`, `:163`, `:165`)
3. `Canvas2DStage#render()` — `#lastWidth`/`#lastHeight` vor dem Event, `emitStrict()`, Frame läuft weiter, dann `throwCollected()` bzw. `throw resizeError` (`Canvas2DStage.ts:336–372`)
4. `text.md` »Refusals« — jede Klasse, dazu `x`/`y`/`z`/`letterSpacing` und der Text ohne String (`docs/text.md:174–187`)
5. Proposal §4.4 — `x`, `y`, `width`, `height` unter 0 (Proposal Z. 422)
6. `OnFrame`/`OnTick`/`OnRender` — `static readonly` mit TSDoc, intern Modulkonstante (`FrameLoop.ts:198`, `:346`, `:359`, `:410`; `FixedFrameLoop.ts:97`, `:100`)
7. `setFps()` — `checkMaxFps()` in Konstruktor und `setFps()`, `-0` zulässig (`FrameLoop.ts:22`, `:309`, `:323`)
8. Canvas-Größe unter 1 — `assertCanvasSide()` (`Canvas2DStage.ts:36`, `:161–162`, `:263–264`)
9. `getContentAreaSize()` — `contentAreaSide()` mit Schwelle 1 (`styleUtils.ts:40`, `:73–74`)

»Dazu«-Stellen, alle behoben: 1 `DisplayStateMachine.ts:8–15` · 2 `Display.ts:1447–1448`, Klassen-TSDoc um `:252` · 3 `Display.ts:938`, `types.ts:53` · 4 `docs/architecture.md:161–175` (alle 30 `scripts/**/*.test.mjs` gegen die Glieder gehalten) · 5 `docs/architecture.md:525–527` · 6 `AGENTS.md:58–59` · 7 Proposal Z. 594–600.

Runde 1: der wichtige Befund (CHANGELOG-Eintrag zu den readonly-Event-Statics ohne Migration Guide) ist behoben — »See the Migration Guide« an `CHANGELOG.md:140`, Abschnitt `#### Writing over the event names of the frame loops` (um Z. 961).

Kleine Befunde (keine Runde):

- `AGENTS.md:59` — umbrochene Zeile mit 91 Zeichen (die Datei hat 17 weitere solche).
- `styleUtils.ts:40` / TSDoc `:62–67` — bei einem gedrehten Element skaliert `rectSide / layoutSide` die Ränder im Verhältnis Bounding Box zu Layoutgröße, nicht mit der Skala des Elements; die TSDoc sagt das.
- `docs/text.md:205` — »`layoutText()` refuses its options … as `writeText()` does«; `layoutText()` kennt kein `z`.

Nebenbefunde des Implementierers (vorbestehend, gegen `7341059f` geprüft, in »Offene Befunde« mit `→ Scope`, weil die Scope-Regel jede Severity umfasst): `FixedFrameLoop` Tick-Schleife über `emit()` vor dem Fortschreiben; `Canvas2DStage#setCanvasSize()` ohne TSDoc; `FrameLoop#subscriptionCount`/`clear()` ohne TSDoc.
