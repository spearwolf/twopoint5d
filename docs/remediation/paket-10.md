# Paket 10 — Display und DisplayFullscreen in interne Teile zerlegen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ARCH-001 (medium, Display-Teil), READ-001 (medium, Fullscreen-Teil)
- Ziel: Im `Display` stehen Größe und Hold der Animation-Loop in eigenen internen Teilen, und der Fullscreen-Controller führt seine Zustände als explizites Modell, bei unveränderter öffentlicher API.
- Modell: stärkste Stufe
- Effort: high
- Dateien (alle unter `packages/twopoint5d/`):
  - neu `src/display/DisplaySizer.ts`
  - neu `src/display/AnimationLoopHold.ts`, neu `src/display/AnimationLoopHold.spec.ts`
  - `src/display/Display.ts`
  - `src/display/DisplayFullscreen.ts`, `src/display/DisplayFullscreen.spec.ts` (ein neuer Fall)
  - `docs/proposals/display-fullscreen.md` (§3.2 ein Satz, neu §3.5, §13.1 ein Punkt)
  - `docs/architecture.md` (Abschnitt `display/`)
  - **nicht**: `public-api.ts`, `types.ts`, `docs/display.md`, `CHANGELOG.md` — Grund unter »Entscheidungen dieses Pakets«
- Verify: `pnpm run ci`
- Commit: `refactor(twopoint5d): measure a display through an internal DisplaySizer, hold the animation loop of three through an AnimationLoopHold, keep what the fullscreen controller does of its own as one phase, and let a turn to landscape join a request still under way`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · ARCH-001 (Display-Teil) verschoben, Sachverhalt unverändert: `Display.ts` hat 2257 statt 2238 Zeilen (Paket 3, 7e8d5b14), Fundstellen :355→:356 (`export class Display`), :433→:434 (Size-Watch-Felder), :1398→:1413 (`#resize()`), :2105→:2122 (`#stopAnimationOfThree()`) · READ-001 (Fullscreen-Teil) unverändert, `DisplayFullscreen.ts` seit 2e3f585b unberührt (:214 Klasse, :240 `#element`, :612 `#request()`, :817 `#readState()`) · Folgen: keine offen in den erledigten Paketen · Offene Befunde: keiner gleicher Ursache, nichts übernommen (die drei Einträge zu `display/` — nachsichtige Maße, Allocation-Spec unter Frame-Pacing, `CssRulesPrefixFullscreen` — haben eigene Ursachen) · Restplan: unverändert, Paket 11 hängt an 4, 5 und 7, nicht an 10
  - 2026-11-18 Zug 1: Implementierer beauftragt (opus, effort high), Brief `paket-10.impl-0.brief`, Report nach `paket-10.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG (Volltext `paket-10.impl-0.report.md`, Session 56159085) · neu `src/display/DisplaySizer.ts`, `AnimationLoopHold.ts`, `AnimationLoopHold.spec.ts` · geändert `Display.ts`, `DisplayFullscreen.ts`, `DisplayFullscreen.spec.ts`, `docs/proposals/display-fullscreen.md`, `docs/architecture.md` · Regressionstest `a turn to landscape while a request is under way joins that request, and enters no pseudo mode beside it` vor dem Fix rot (`expected 'pseudo' to be undefined`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-10.verify.log`)
  - 2026-11-18 Zug 3: Review Runde 0 (opus, high, `paket-10.review-0.json`, Diff `paket-10.diff`) · ARCH-001 behoben (`DisplaySizer.ts:105`, `AnimationLoopHold.ts:28`, `Display.ts:319/327`) · READ-001 behoben (`DisplayFullscreen.ts:180/275`, Proposal §3.5) · wichtig 1: `docs/resource-lifecycle.md:312` zitiert noch `this.#stopSizeWatch();` · klein 3 (Diagramm §3.5 folgt der Tabelle nicht ganz; doppelter Kommentar/TSDoc `DisplaySizer.ts:286-289, 394-397`; Ablehnung des beigetretenen Requests ungetestet) · Urteil nachbessern
  - 2026-11-18 Zug 4 Runde 1: offen `resource-lifecycle.md:312` (wichtig) und das Diagramm in §3.5 (Planvorgabe »Kanten folgen der Tabelle«) → Resume des Implementierers (Session 56159085, opus, high), Report nach `paket-10.impl-1.json`
    zurück: FERTIG_MIT_VORBEHALT (Prettier nicht installiert, Biome statt dessen) · `docs/resource-lifecycle.md` Zitat angeglichen, Diagramm §3.5 an die Tabelle angeglichen, Suche nach weiteren entfallenen privaten Namen in `.md` ohne Treffer · Verify `pnpm run ci` exit=0 (`paket-10.verify-1.log`) · Diff `paket-10-1.diff` · Re-Review per Resume (Session 3aefcd4b) nach `paket-10.review-1.json`
    Re-Review: beide erledigt (`resource-lifecycle.md:312`, Proposal `:274-286`), neu klein 1 (Kante `requesting → idle`), Urteil freigeben · Fortschritt: 2 von 2 offenen erledigt
  - 2026-11-18 Zug 5: Commit 8d624eec (9 Dateien), Verify `paket-10.verify-1.log` exit=0 · Plan auf [x], Zeilen in »Offene Befunde« nachgeführt (`Display.ts:376, 397, 420, 435`, `:294`), 3 Nebenbefunde in die Queue

## Entscheidungen dieses Pakets

- **Ein Paket, kein 10b.** Die beiden Teile liegen in getrennten Dateien und ändern
  kein Verhalten (bis auf den einen Randfall unten); der Grund der Teilungen 6/6b und
  9/9b — Verschiebung neben Verhaltensänderung in derselben Datei — trifft nicht zu.
  Ein Reviewer kann `Display.ts`/`DisplaySizer.ts`/`AnimationLoopHold.ts` und
  `DisplayFullscreen.ts` getrennt lesen.
- **Kein Modell als Klasse für das ganze Display.** Die Empfehlung (internes
  `DisplaySizer` für Size-Watch, Size-Source und Messung, Hold der Animation-Loop als
  Helfer neben `canvasHandover.ts`) wird so umgesetzt. Lebenszyklus,
  Sichtbarkeits-Watch, State-Machine, Renderer-Bau und Canvas-Rückgabe bleiben im
  `Display`.
- **Der Sizer liest die öffentlichen Member über das Display**, nicht über Kopien:
  `display.pixelZoom`, `display.maxPixelRatio`, `display.maxPixels`,
  `display.resolutionScale`, `display.styleImageRendering`,
  `display.resizePollIntervalMs`, `display.resizeToElement`,
  `display.resizeToCallback`, `display.resizeToAttributeEl`, `display.devicePixelRatio`,
  `display.pixelRatio`, `display.frameNo`, `display.isFirstFrame`, `display.canvas`,
  `display.renderer`. So bleibt jedes heutige `this.<member>` dasselbe Lesen — auch
  für eine Unterklasse, die einen Getter überschreibt. Was das Display privat hält
  (`#doc`, `#view`, `#styleSheetRoot`, `#emit`) und die Statics
  (`Display.MaxResolution`, `Display.CssRulesPrefixFullscreen`) kommen über ein
  Host-Objekt nach dem Muster von `DisplayFullscreenHost`; ein Laufzeit-Import von
  `Display.js` im Sizer entfiele sonst nicht (Importkreis).
- **Fullscreen: die Phase ist eine Union über das, was sich wirklich ausschließt.**
  Die sechs Zustände des Audits (idle, requesting, active, exiting, armed, pseudo)
  sind keine sechs exklusiven Werte: »active« ist der Zustand des Dokuments und steht
  neben `requesting` (ein `fullscreenchange` vor der Antwort) und `exiting` (bis der
  Browser durch ist); »armed« steht neben `requesting`, wenn die Seite bei
  gespanntem Tap `request()` ruft (Knopf außerhalb des Ziels) — `isArmed` bleibt dann
  bis zur Antwort `true`, und das wird gesendet. Eine Union aller sechs würde
  `isArmed`/`OnDisplayFullscreenChange` ändern. Deshalb: eine Phase
  `'idle' | 'requesting' | 'exiting' | 'pseudo'` (heute `#pending`, `#pendingExit`,
  `#pseudo`, die sich per Konstruktion ausschließen), daneben `#native` (heute
  `#activeElement` + `#entered`, immer gemeinsam gesetzt und geräumt) und
  `#armedElement`, `#declined`, `#foreignHeld` als benannte Achsen. Die Tabelle der
  Übergänge steht im Proposal (§3.5), wie es die Empfehlung verlangt.
- **Der eine Randfall, den die Union entscheidet:** `#turned()` betritt heute in
  Landscape den Pseudo-Modus, während ein nativer Request noch offen ist, wenn
  `isSupported` inzwischen `false` antwortet (`DisplayFullscreen.ts:964-966` hinter
  dem offenen `#pending`). Dann stünden Request und Pseudo-Modus nebeneinander. Neu:
  ein Turn in Landscape während `'requesting'` schließt sich dem Request an
  (`#request('landscape', false)`), was auch immer `isSupported` antwortet; der
  Pseudo-Modus wird nur aus `'idle'` betreten. Im Browser ist der Fall nicht
  erreichbar (jedes `HTMLElement` trägt `requestFullscreen`, wo `fullscreenEnabled`
  gilt), im Spec mit Stubs schon. Deshalb Regressionstest, aber **kein**
  CHANGELOG-Eintrag und kein Guide-Satz: kein Nutzer kann den Unterschied sehen.
- **Kein CHANGELOG, kein Guide.** Öffentliche Exporte, Typen, Meldungen und
  Verhalten bleiben gleich; `docs/display.md` nennt keine Interna. Entdeckt der
  Implementierer doch eine sichtbare Änderung, meldet er sie als Abweichung statt
  sie einzutragen.
- **Ein neuer Spec nur für `AnimationLoopHold`**, keiner für `DisplaySizer`:
  `Display.spec.ts` (Resize-Modell, über tausend Zeilen) und
  `hot-path-allocations.spec.ts` tragen die Messung über die öffentliche API und
  bleiben unverändert; ein zweiter Spec desselben Verhaltens wäre Doppelung. Der Hold
  ist ein eigenständiges Modul mit drei Regeln, die ein eigener Spec beim Namen nennt
  (wie `canvasHandover.spec.ts`).

## Vorgehen

Zeilennummern beziehen sich auf den Stand `2401e5b7`: `Display.ts` 2257 Zeilen,
`DisplayFullscreen.ts` 1102 Zeilen. **Verschobener Code wandert wörtlich**:
Kommentare, Fehlermeldungen, Warnungstexte, Bezeichner und Reihenfolge bleiben. Erlaubt
ist nur, was die Verschiebung erzwingt: `this.<öffentliches Member>` wird
`this.#display.<member>`, Privates des Displays geht über `this.#host`, ein
`#privat`-Aufruf zwischen den Teilen wird ein Aufruf der unten genannten Methode. Die
einzige Umbenennung steht in Schritt 1c. Nichts wird nebenbei verbessert.

Vor dem ersten Eingriff: `src/display/Display.ts`, `DisplayFullscreen.ts`,
`canvasHandover.ts`, `resolveDrawingBuffer.ts` ganz lesen (AGENTS.md, »Working on the
library«), dazu `Display.spec.ts` Zeilen 650–900 (Hold der Animation-Loop) und
`hot-path-allocations.spec.ts`.

### Teil A — `Display`: Messung und Hold der Animation-Loop auslagern

1. **`src/display/DisplaySizer.ts` anlegen.**

   a. Kopfkommentar (englisch, zwei bis vier Zeilen): das Modul misst für ein Display
      — Size-Watch, Auflösung der Size-Source, die Regel eines Fullscreens um die
      Canvas, die Buchhaltung einer Canvas, die sich selbst misst, unter einem Zoom,
      und der Drawing Buffer, den es anwendet; das Display behält die öffentlichen
      Optionen und Member des Resize-Modells und fragt den Sizer am Anfang jedes
      Frames und in `resize()`.

   b. Host und Klasse, exakt diese Oberfläche (TSDoc je Member ein Satz, `@internal`
      an Interface und Klasse; nichts davon in `public-api.ts`):

      ```ts
      import type {Display} from './Display.js';

      /**
       * What a {@link DisplaySizer} reads of its display beyond the public members. The display
       * fills it. Not exported from the package.
       * @internal
       */
      export interface DisplaySizerHost {
        readonly doc: Document;
        readonly view: Window & typeof globalThis;
        /** `Display.MaxResolution`, read at every measurement. */
        maxResolution(): number;
        /** `Display.CssRulesPrefixFullscreen`, read when the rule of `resize-to="window"` is installed. */
        windowRulePrefix(): string;
        /** The `styleSheetRoot` of the display. */
        styleSheetRoot(): HTMLElement | ShadowRoot;
        /** Emits `OnDisplayResize` with the props of the display. */
        emitResize(): void;
      }

      /** @internal */
      export class DisplaySizer {
        constructor(display: Display, host: DisplaySizerHost);
        get width(): number;
        get height(): number;
        get devicePixelZoom(): number;
        /** The class of the rule of `resize-to="window"`, once installed; undefined before. */
        get windowClassName(): string | undefined;
        pixelRatioAt(resolutionScale: number): number;
        watchFullscreen(): void;
        updateContainingFullscreen(): void;
        setPseudoTarget(target: HTMLElement | undefined): void;
        startWatch(): void;
        stopWatch(): void;
        /** Answers whether this call emitted `OnDisplayResize`. */
        resize(fromFrame: boolean): boolean;
        installRules(root: HTMLElement | ShadowRoot): void;
      }
      ```

      Felder `readonly #display: Display;` und `readonly #host: DisplaySizerHost;`.
      Importe nur, was der verschobene Code braucht (`Stylesheets`, `describeValue`,
      `isPositiveFinite`, die Namen aus `resolveDrawingBuffer.js` und `styleUtils.js`);
      `Display` nur als `import type`.

   c. **Hinein, wörtlich und in dieser Reihenfolge** (Modulebene vor der Klasse):
      - `Display.ts:54-55` (die beiden `…WarningWasShown`-Flags)
      - `:57-65` `showResizeToFullscreenWarning()`
      - `:67-76` `showCanvasMaxResolutionWarning()` — bekommt den Wert als ersten
        Parameter: `showCanvasMaxResolutionWarning(maxResolution: number, w: number, h: number)`,
        im Template `${maxResolution}` statt `${Display.MaxResolution}`. Der Text beider
        Argumente von `console.warn` bleibt Zeichen für Zeichen; die zweite Zeile nennt
        weiter `Display.MaxResolution`.
      - `:87-94` `isApart()`, `:96-100` `parentAcrossShadow()`, `:102-112`
        `containingFullscreenOf()`, `:114-119` `containsAcrossShadow()`
      - `:132` `FULLSCREEN_RULE_CSS` — **umbenannt** in `WINDOW_RULE_CSS`, mit einer
        Kommentarzeile darüber: `// the rule of resize-to="window": the canvas covers the window`
      - `:134-136` `RESIZE_TO_WINDOW` samt Kommentar

      In die Klasse, Felder mit ihren Kommentaren:
      - `:423-432` `#applied…`, `:434-443` Size-Watch, `:450-457` `#onSizeChange`,
        `#onPixelRatioChange`, `:459-464` Size-Source, `:466-476` Self-Size, `:478-498`
        `#containingFullscreen`, `#pseudoTarget`, `#selfSizeBeforeFullscreen`,
        `#onFullscreenChange` (dessen Rumpf ruft `this.updateContainingFullscreen()`),
        `:500-504` die Styles, `:526` `#lastResizePollMs`, `:528-534` `#didEmitResize`
        (TSDoc angepasst: »Set by `resize()` to mark whether it emitted
        `OnDisplayResize`, and what it answers: the display decides by it whether the
        first frame still needs its fallback emit.«), `:536-539` als
        `#windowClassName`/`#windowClassApplied` (**umbenannt**; Kommentare: »the class
        name of the rule of resize-to="window", installed with the first resize() under
        it« und »the class of resize-to="window" sits on the canvas right now«),
        `:541-544` `#resizeToSelector`, `:649-651` `#width`, `#height`,
        `#devicePixelZoom`, `:653-685` `#contentWidth`/`#contentHeight`,
        `#drawingBufferParams`, `#drawingBuffer`.

      Methoden:
      - `:1348-1359` `#pixelRatioParams()` (liest `devicePixelRatio`, `maxPixelRatio`,
        `maxPixels`, `pixelZoom` über `this.#display`); dazu öffentlich
        `pixelRatioAt(resolutionScale) { return pixelRatioFor(this.#pixelRatioParams(resolutionScale)); }`
      - `:1410-1469` `#resize(fromFrame)` → öffentlich `resize(fromFrame: boolean): boolean`;
        der Kommentar darüber bleibt, endet die Methode, antwortet sie
        `this.#didEmitResize` (auch auf dem frühen `return` des Poll-Intervalls und der
        unveränderten Größe: dort `return false`, der Wert wurde zu Beginn auf `false`
        gesetzt — `return this.#didEmitResize` an allen drei Ausgängen ist gleichwertig
        und vorzuziehen). `#applyFullscreenClass(canvas, this.#sizeSourceIsWindow)` heißt
        `#applyWindowClass(canvas, this.#sizeSourceIsWindow)`.
      - `:1471-1480` `#startSizeWatch()` → öffentlich `startWatch()`
      - `:1482-1488` `#watchPixelRatio()`, `:1490-1513` `#observeSizeSource()`
      - `:1515-1529` `#stopSizeWatch()` → öffentlich `stopWatch()`; ans Ende die Zeile
        `this.#host.doc.removeEventListener('fullscreenchange', this.#onFullscreenChange);`
        aus `:1539`. Kommentar über der Methode: »Called by the display's dispose()
        directly, so a constructor that throws after startWatch() takes the watch down
        as well; the fullscreenchange listener of watchFullscreen() comes off with it«.
      - neu `watchFullscreen()`: genau die beiden Zeilen aus `:1089-1091`
        (`doc.addEventListener('fullscreenchange', this.#onFullscreenChange)` über
        `this.#host.doc`, dann `this.updateContainingFullscreen()`) samt ihrem Kommentar
        »the size source follows a fullscreen the app enters on its own as well«.
      - `:1546-1554` `#applyImageRendering()`, `:1556-1576` `#resolveSizeSource()`
      - `:1578-1583` `#updateContainingFullscreen()` → öffentlich
        `updateContainingFullscreen()` (`this.#display.renderer?.domElement`)
      - neu `setPseudoTarget(target)`: der Rumpf von `:1111-1114`
        (`this.#pseudoTarget = target; this.updateContainingFullscreen();`)
      - `:1585-1623` `#followFullscreen()`
      - `:1625-1640` `#applyFullscreenClass()` → `#applyWindowClass(canvas, wantsWindow)`,
        `Display.CssRulesPrefixFullscreen` → `this.#host.windowRulePrefix()`,
        `FULLSCREEN_RULE_CSS` → `WINDOW_RULE_CSS`, `this.#styleSheetRoot` →
        `this.#host.styleSheetRoot()`
      - neu `installRules(root)`: der dritte Zweig von `:1650-1652`
        (`if (this.#windowClassName != null) Stylesheets.installRule(this.#host.windowRulePrefix(), WINDOW_RULE_CSS, root);`)
      - `:1655-1690` `#measureSizeSource()`, `:1692-1704` `#getCanvasStyle()`,
        `#getSourceStyle()`, `:1706-1812` `#applyMeasuredSize()` (`Display.MaxResolution`
        → `this.#host.maxResolution()`, auch im Aufruf der Warnung;
        `this.renderer!` → `this.#display.renderer!`; `this.frameNo` →
        `this.#display.frameNo`; `this.#emit(OnDisplayResize)` →
        `this.#host.emitResize()`), `:1814-1841` `#resolveResizeToSelector()`
      - Getter `width`, `height`, `devicePixelZoom`, `windowClassName` antworten die
        privaten Felder.

   d. **Hot Path.** `resize(true)` läuft in jedem Frame und `resize(false)` steht unter
      `hot-path-allocations.spec.ts`: kein Objekt-, Array- oder Closure-Literal pro
      Aufruf, keine Rest-/Spread-Parameter, kein neuer Rückgabewert außer `boolean`. Die
      Host-Funktionen legt das Display einmal im Konstruktor an.

2. **`src/display/AnimationLoopHold.ts` anlegen.**

   a. Hinein, wörtlich: der Kommentarblock `Display.ts:138-145` (über das Interface),
      `:146-149` `AnimationOfThree`, `:151-152` `holdStart()`, `:154-160`
      `getAnimationOfThree()`.

   b. Die Klasse, `@internal`:

      ```ts
      import type {WebGPURenderer} from 'three/webgpu';

      /** @internal */
      export class AnimationLoopHold {
        /**
         * Stops the animation loop of three on `renderer` and covers its start() until resume() or
         * release(). Does nothing while it holds a loop already, for a renderer without
         * `renderer._animation`, and while the loop carries a callback.
         */
        hold(renderer: WebGPURenderer): void;
        /** Ends the hold and starts the loop it held; does nothing while it holds none. */
        resume(): void;
        /** Ends the hold without starting the loop; does nothing while it holds none. */
        release(): void;
      }
      ```

      Feld: `:412-416` `#heldAnimationOfThree` samt Kommentar, umbenannt in `#held`
      (der Kommentar beginnt dann »the animation loop of three this hold keeps still …«;
      sonst wörtlich). `hold()` ist der Rumpf von `:2122-2138` ohne die erste
      `renderer`-Zeile: `if (this.#held != null) return;` und weiter ab
      `const animation = getAnimationOfThree(renderer);`, Kommentare wörtlich.
      `release()` ist `:2144-2156` (`#releaseAnimationOfThree()`), öffentlich und ohne
      Rückgabewert; `resume()` ist `:2140-2142`, das sich den gehaltenen Loop vor dem
      Freigeben merkt und danach `start()` ruft — intern darf `release()` dafür eine
      private Variante `#letGo(): AnimationOfThree | undefined` nutzen, die beide rufen.

   c. **`src/display/AnimationLoopHold.spec.ts`** mit genau drei Fällen, Stubs wie in
      `Display.spec.ts:661-760` (`renderer` mit `_animation` und `getAnimationLoop()`):
      - `hold() stops the loop and covers its start(), and resume() hands start() back and starts the loop once`
      - `release() hands an own start() back as it was, and starts nothing`
      - `leaves a loop that carries a callback running, and a renderer without _animation alone`

3. **`src/display/Display.ts` umstellen.**
   - Entfernen, was in Schritt 1 und 2 umgezogen ist (inklusive der nun ungenutzten
     Importe — `describeValue`, `isPositiveFinite`, die Namen aus
     `resolveDrawingBuffer.js` und `styleUtils.js`, soweit nichts im Display sie mehr
     liest; Biome meldet den Rest). `isHTMLElement()`, `disposedError()`,
     `CONTAINER_RULE_CSS`, `CANVAS_RULE_CSS` und ihre Kommentare bleiben; der Kommentar
     `:127-129` bleibt über den beiden.
   - Neue Felder: `readonly #sizer: DisplaySizer;` mit dem Kommentar »how the display
     measures: the size watch, the size source and the drawing buffer it applies« und
     `readonly #animationLoopHold = new AnimationLoopHold();` an der Stelle von
     `#heldAnimationOfThree`, mit dessen gekürztem Kommentar »the animation loop of three
     this display holds still in the pause, or while `pause` answered true before its
     first start«.
   - Konstruktor, direkt nach `this.#view = …` (`:980`):

     ```ts
     this.#sizer = new DisplaySizer(this, {
       doc: this.#doc,
       view: this.#view,
       maxResolution: () => Display.MaxResolution,
       windowRulePrefix: () => Display.CssRulesPrefixFullscreen,
       styleSheetRoot: () => this.#styleSheetRoot,
       emitResize: () => this.#emit(OnDisplayResize),
     });
     ```

     `:1089-1091` (`doc.addEventListener('fullscreenchange', …)` und
     `this.#updateContainingFullscreen()`) wird `this.#sizer.watchFullscreen();` — an
     **genau dieser Stelle**, vor `new DisplayFullscreen(…)`, damit der Listener des
     Displays vor dem des Controllers am Dokument hängt wie heute. Der Kommentar
     `:1084-1087` bleibt. Im Host des Controllers: `emit` ruft
     `this.#sizer.updateContainingFullscreen()` statt `this.#updateContainingFullscreen()`
     (Kommentar bleibt), `pseudoTargetChanged: (target) => this.#sizer.setPseudoTarget(target)`.
     `:1120` `this.#startSizeWatch()` → `this.#sizer.startWatch()`.
   - Getter `width`/`height`/`devicePixelZoom` antworten `this.#sizer.…`;
     `pixelRatio` antwortet `this.#sizer.pixelRatioAt(this.resolutionScale)`,
     `pixelRatioAt(s)` antwortet `this.#sizer.pixelRatioAt(s)`. TSDoc unverändert.
   - `resize()`: `if (this.#disposed) return; this.#sizer.resize(false);`
   - `renderFrame()`: `const emitted = this.#sizer.resize(true);` und
     `if (this.isFirstFrame && !emitted) this.#emit(OnDisplayResize);` — der Kommentar
     `:1877-1880` bleibt über der zweiten Zeile.
   - `#installRules(root)`: Container- und Canvas-Regel wie heute, statt des dritten
     Zweigs `this.#sizer.installRules(root);`.
   - `#stopVisibilityWatch()`: die Zeile `:1539` (`fullscreenchange`) entfällt, ihr
     Kommentar `:1531-1534` bleibt sinngemäß (nennt nur noch `visibilitychange` und den
     Observer). `dispose()`: `this.#stopSizeWatch()` → `this.#sizer.stopWatch()`, an
     derselben Stelle.
   - `#giveBackCallersCanvas()`: `this.#fullscreenClassName` → `this.#sizer.windowClassName`.
   - Animation-Loop: im `Start`-Handler `this.#startAnimationOfThree()` →
     `this.#animationLoopHold.resume()`; im `Pause`-Handler und in
     `#followPauseBeforeStart()` `this.#stopAnimationOfThree()` → zwei Zeilen
     `const renderer = this.renderer;` / `if (renderer != null) this.#animationLoopHold.hold(renderer);`
     — im `#followPauseBeforeStart()`-Zweig `else` → `this.#animationLoopHold.resume()`;
     `#releaseRenderer()` `this.#releaseAnimationOfThree()` → `this.#animationLoopHold.release()`.
     Alle Kommentare an diesen Aufrufstellen bleiben.
   - Die Klassen-TSDoc (Lifecycle, Resize model) und alle TSDoc öffentlicher Member
     bleiben Zeichen für Zeichen.

4. **`docs/architecture.md`, Abschnitt `### display/`.** Nach dem Satz über
   `canvasHandover.ts` (endet »… `releaseRenderer()` after `dispose()`.«) einfügen:
   »How a display measures — the size watch, the size source, the rule of a fullscreen
   that contains the canvas, the bookkeeping of a canvas that measures itself under a
   zoom, and the drawing buffer it applies — is the internal class `DisplaySizer` in
   `src/display/DisplaySizer.ts`. `Display` keeps the public options and members of the
   resize model and asks the sizer at the start of each frame and in `resize()`. The
   hold of the animation loop of three while a display pauses is `AnimationLoopHold` in
   `src/display/AnimationLoopHold.ts`.« Umbruch wie die Nachbarzeilen (unter 100
   Zeichen).

### Teil B — `DisplayFullscreen`: die Phase als Modell

5. **Regressionstest zuerst** in `src/display/DisplayFullscreen.spec.ts`, unter
   `describe('pseudo fullscreen') › describe('with onLandscape')`, Name:
   `a turn to landscape while a request is under way joins that request, and enters no pseudo mode beside it`.
   Aufbau mit den Stubs der Datei: `make({fallback: 'pseudo', onLandscape: true})`,
   Gate offen (coarse pointer), Bildschirm erst Portrait; `request()` der Seite mit
   einer Antwort, die noch aussteht; dann `doc.fullscreenEnabled = false` und eine
   Drehung nach Landscape samt `change`-Event. Erwartet: `controller.mode` ist danach
   `undefined` (heute `'pseudo'` — **rot sehen und den Lauf in den Report**), und
   nachdem die Antwort gewährt und `fullscreenchange` gefeuert ist, `'native'`; das
   Promise des `request()` löst mit `true` auf.

6. **Typen** in `DisplayFullscreen.ts` (bleiben im Modul, nicht exportiert):
   - `PendingRequest` bekommt als erstes Feld `readonly kind: 'requesting';`,
     `PendingExit` `readonly kind: 'exiting';`, `PseudoState` `readonly kind: 'pseudo';`.
   - Neu:
     ```ts
     interface Idle {
       readonly kind: 'idle';
     }
     const IDLE: Idle = {kind: 'idle'};

     // What the controller does of its own, one thing at a time — see §3.5 of the proposal
     // display-fullscreen.md: it waits ('idle'), the browser has not answered a request of it
     // ('requesting') or an exit of it ('exiting'), or it holds the pseudo mode ('pseudo'). The
     // pseudo mode is entered from 'idle' only; a call that comes while the browser answers is
     // noted on the call under way
     type FullscreenPhase = Idle | PendingRequest | PendingExit | PseudoState;

     // the native fullscreen of the target this controller has seen entered, kept until the target
     // leaves the fullscreen stack: the element it entered with, and who entered it — undefined for
     // a fullscreen someone else entered
     interface NativeHold {
       readonly element: HTMLElement;
       by: EnteredBy | undefined;
     }
     ```
   - Die Kommentare über `PendingRequest`, `PendingExit`, `PseudoState` und der
     Absatz `:111-117` bleiben; über `PendingRequest` kommt vorn »the phase
     'requesting': « dazu, über `PendingExit` »the phase 'exiting': «, über
     `PseudoState` »the phase 'pseudo': «.

7. **Felder.** `#activeElement` und `#entered` → `#native?: NativeHold;` (Kommentar:
   der aus `:242-243`, ergänzt um »It stands beside every phase but 'pseudo': beside
   'requesting' where the browser fires fullscreenchange before it answers, beside
   'exiting' until the browser is through«). `#pending`, `#pendingExit` und `#pseudo` →
   `#phase: FullscreenPhase = IDLE;` an der Stelle von `#pending` (Kommentar: die
   Kommentare von `:247-251` zusammengezogen). Am Kommentar von `#armedElement`
   (`:270`) ergänzen: »set only in 'idle' while no fullscreen holds; it stays beside
   'requesting' where the page calls request() while armed, until the browser
   answers«. `#declined`, `#foreignHeld`, `#run`, `#locked`, die Optionen und die
   `#emitted…`-Felder bleiben, wie sie sind.

8. **Jede Lesestelle umschreiben, ohne Logik zu ändern** (heute → neu):
   - `this.#pending != null` → `this.#phase.kind === 'requesting'`; ein lesendes
     `const open = this.#pending` → `const phase = this.#phase; … phase.kind === 'requesting' ? phase : undefined`.
   - `this.#pendingExit != null` → `this.#phase.kind === 'exiting'`; entsprechend für
     `const running`/`const exit`.
   - `this.#pseudo != null` / `this.#pseudo?.by` → `this.#phase.kind === 'pseudo'` /
     über die eingeengte Phase.
   - `this.#activeElement` → `this.#native?.element`; `this.#entered` →
     `this.#native?.by`; die gemeinsame Zuweisung in `#readState()` (`:824-827`) wird
     `this.#native = {element: active, by: phase.kind === 'requesting' ? phase.by : undefined};`,
     das gemeinsame Räumen (`:837-838`) `this.#native = undefined;`, die Umschreibung
     `this.#entered = 'request'` (`:625`, `:650`) `this.#native.by = 'request'` unter
     derselben Bedingung.
   - Schreiben: `this.#pending = request` → `this.#phase = request` (das Objekt trägt
     `kind: 'requesting'`); `this.#pending = undefined` → `this.#phase = IDLE`;
     ebenso `#pendingExit` in `#leaveNative()` (`:766`, `:771`) und `#pseudo` in
     `#enterPseudo()`/`#leavePseudo()` (`:1045`, `:1067`). Die Reihenfolge jeder
     Methode bleibt — insbesondere `#readState()` **vor** dem Zurücksetzen auf `IDLE`
     im Erfolgszweig des Requests (`:689-690`) und in `settle` von `#leaveNative()`
     (`:770-771`), weil `#readState()` an der noch gesetzten Phase abliest, wer
     eingetreten ist und ob ein Verlassen eigenes war.
   - `dispose()` (`:574-585`): `const exiting = this.#phase.kind === 'exiting';`, dann
     `if (this.#phase.kind === 'requesting' || exiting) this.#phase = IDLE;`, der Rest
     in derselben Reihenfolge; `this.#entered != null` (`:589`) →
     `this.#native?.by != null`; `:595-596` → `this.#native = undefined;`. Kommentare
     bleiben.
   - `#nativeElement()` (`:606`):
     `const candidate = this.#native?.element ?? (phase.kind === 'requesting' ? phase.element : undefined) ?? this.element;`
   - `#enteredBy()` (`:1024`): Pseudo-Phase → deren `by`, sonst
     `this.#native?.by ?? (Request-Phase → deren by)`.
   - `#turned()` Portrait-Zweig (`:943-944`): `declines = false` an der Phase, wenn
     sie `'requesting'` oder `'exiting'` ist.
   - `installRules()` (`:551-556`) über die eingeengte Pseudo-Phase; `pseudo.root = root`
     bleibt eine Schreibung am Phasenobjekt.
   - `toggle()` (`:545`), `#endRun()` (`:807`), `#rearm()` (`:985-986`),
     `onLandscape`-Setter (`:381`), `#readState()` (`:834`, `:851`): je die
     Phasenabfrage statt der Feldabfrage.
   - Optional und nur, wo es eine Wiederholung spart: ein privater Helfer
     `#answerAwaited(): boolean` (`'requesting'` oder `'exiting'`). Keine weiteren
     Helfer, keine Umbenennung von Methoden.

9. **Die eine Verhaltensänderung** (macht den Test aus Schritt 5 grün): in `#turned()`
   steht nach `if (this.#fullscreenHolds() || this.#declined || !this.#gateIsOpen()) return;`
   und **vor** `if (!this.isSupported)` der Zweig: während `'requesting'` schließt sich
   der Turn dem Request an —
   `void this.#request('landscape', false).then((active) => this.#rearm(active)); return;` —
   mit dem Kommentar »a request is under way: the turn joins it, whatever isSupported
   answers by now — the pseudo mode is entered from 'idle' only«. Über `#enterPseudo()`
   kommt die Zeile »entered from 'idle' only: every caller has made sure no call is
   under way«.

10. **Proposal `docs/proposals/display-fullscreen.md`.**
    - §3.2, Satz `:131-133` (»The display builds it in its constructor … beyond the
      size source rule of §5.«) wird: »The display builds it in its constructor and
      keeps it for its life; the display does not grow by the logic of §5 to §7 beyond
      the size source rule of §5, which lives with the rest of the measurement in the
      internal `DisplaySizer` (`src/display/DisplaySizer.ts`).«
    - Neu **`### 3.5 The states of the controller`** zwischen §3.4 und §4 (vor
      `## 4. The target element`). Inhalt, englisch, im Ton von `camera-rig.md` §4.2.1:
      ein Absatz, dass die Phase (`#phase`) beschreibt, was der Controller selbst tut,
      eins zur Zeit, und daneben zwei Achsen und zwei Erinnerungen stehen; dann ein
      `text`-Block mit einem Diagramm im Stil von `camera-rig.md` §2.1 (Kästen-freie
      Pfeile `──▶`), dessen Kanten genau den Zeilen der Tabelle folgen — vier Knoten
      `idle`, `requesting`, `exiting`, `pseudo`; dann diese Tabelle (wörtlich
      übernehmen, Umbruch frei):

      | phase | what the controller does | in | out |
      | --- | --- | --- | --- |
      | `'idle'` | waits; the target may be in native fullscreen all the same — by this controller or by anyone —, and `onLandscape` may wait for a tap | the start; the answer to a request with no exit noted on it; an exit through; a leave of the pseudo mode; `dispose()` | `request()`, the armed tap or the try at once of a turn → `'requesting'`, or → `'pseudo'` where only the pseudo mode is there; `exit()`, or a turn to portrait of a fullscreen `onLandscape` entered, while the target lies on top → `'exiting'`; `onLandscape = true` in landscape where only the pseudo mode is there → `'pseudo'` |
      | `'requesting'` | a native request the browser has not answered; it notes who asked to leave meanwhile (`exitAfter`), whether that leave was a refusal of the user (`declines`), and whether a refusal is told to the developer (`warn`) | a request asked of the browser in `'idle'` | the answer: refused → `'idle'`; granted → `'idle'`, or → `'exiting'` where an exit was noted on it and the target lies on top; `dispose()` → `'idle'` |
      | `'exiting'` | a native exit until its promise settles; it notes a `request()` of the page (`requestAfter`), a turn to landscape or the armed tap (`turnAfter`), and a refusal of the user (`declines`) | `exit()` or a turn to portrait while the target lies on top and no call is under way; a granted request with an exit noted on it | the exit through or refused → `'idle'`; a `request()` noted on it then asks as it does in `'idle'`, and a turn noted on it is evaluated as a turn in `'idle'`; `dispose()` → `'idle'` |
      | `'pseudo'` | holds the target over the viewport through CSS | a request — of the page, of a turn, of `onLandscape = true` in landscape — in `'idle'` where only the pseudo mode is there | `exit()`, Escape, a turn to portrait of a pseudo mode `onLandscape` entered, `dispose()` → `'idle'` |

      Darunter als Liste, je ein Punkt:
      - **The native fullscreen of the target** (`#native`): the state of the document,
        not of the controller. Set by the `fullscreenchange` — or the answer of a
        request — that shows the target on top, with who entered it; kept while an
        element of the app is stacked on it (§3.2); cleared once the target leaves the
        fullscreen stack. It stands beside `'idle'`, beside `'requesting'` where the
        browser fires `fullscreenchange` before it answers, and beside `'exiting'`
        until the browser is through. `isActive` is the phase `'pseudo'` or the target
        on top of its root.
      - **The armed tap** (`#armedElement`, §6.2): set only in `'idle'` while no
        fullscreen holds — neither the target's nor another element's; taken down by
        any fullscreen, by the tap itself, by a leave in landscape and by
        `onLandscape = false`. A `request()` of the page while armed — from a button
        outside the target — moves to `'requesting'` and leaves the tap armed until the
        browser answers.
      - **The refusal** (`#declined`, §6.3): a leave in landscape holds off the arming
        beside any phase until the screen has turned to portrait; an `exit()` of the
        page notes it on the call under way first (`declines`).
      - **A fullscreen of another element** (`#foreignHeld`): what the last
        `fullscreenchange` showed of one, so that its end in landscape counts as a
        leave.
      - **The run**: the calls of one overlap share one promise; it resolves once the
        phase is back in `'idle'` or `'pseudo'`.

      Schlusssatz des Abschnitts: »The pseudo mode is entered from `'idle'` only: a
      turn to landscape while a request is under way joins that request, whatever
      `isSupported` answers by then.«
    - §13.1, Liste der Vitest-Fälle: ein Punkt »a turn to landscape while a request is
      under way joins that request and enters no pseudo mode beside it;« an der Stelle
      der übrigen Punkte zum Pseudo-Modus mit `onLandscape`.
    - Statuszeile und Abweichungsliste bleiben: der Abschnitt beschreibt das Innere,
      keine Abweichung vom Entwurf.

### Was unverändert bleiben muss

- Öffentliche Exporte (`public-api.ts`), Typen (`types.ts`), Signaturen, TSDoc
  öffentlicher Member, Fehler- und Warnungstexte, Ereignisse und ihre Reihenfolge,
  die Reihenfolge der Listener am Dokument (`fullscreenchange` des Displays vor dem des
  Controllers).
- `Display.spec.ts`, `DisplayFullscreen.spec.ts` (bis auf den neuen Fall),
  `hot-path-allocations*.spec.ts`, `canvasHandover.spec.ts`,
  `resolveDrawingBuffer.spec.ts` und die Browser-Tests unter
  `packages/twopoint5d-testing/test/` laufen ohne eine geänderte Zeile grün. Muss ein
  bestehender Test angefasst werden, ist das eine Abweichung mit Grund im Report.
- `DisplayFullscreenHost` bleibt, wie er ist (`DisplayFullscreen.spec.ts:4` importiert
  ihn).

### Hinweise für Verify und Zug 5

- `pnpm run ci` ist der Lauf. Der offene Befund zu
  `hot-path-allocations.adaptive-resolution.spec.ts:83-93` (16.02 B je Aufruf, nur unter
  `pnpm nx run-many -t allocations --skip-nx-cache`, im Gate grün) ist vorbestehend und
  nicht dieses Paket; zeigt er sich im Gate, einmal neu laufen lassen und beide Läufe
  ins Log.
- Nach dem Commit in »Offene Befunde« die Zeilenangaben in `display/Display.ts`
  nachführen, die dieser Umbau verschiebt: der Eintrag zu `pixelZoom`,
  `maxPixelRatio`, `maxPixels`, `resolutionScale` (steht dort als `:567, 588, 611,
  626`, im Stand `2401e5b7` schon `:568, 589, 612, 627`) und der zu
  `Display.CssRulesPrefixFullscreen` (dort `:384`, im Stand `2401e5b7` `:389`) — per
  `grep -n` auf die Membernamen im neuen Stand.
- `Schnittstellen:` im Plan: intern neu `DisplaySizer`/`DisplaySizerHost`
  (`display/DisplaySizer.ts`) und `AnimationLoopHold` (`display/AnimationLoopHold.ts`);
  `DisplayFullscreen` führt `#phase` und `#native`; keine Exporte neu oder entfernt.

## Findings im Volltext

**ARCH-001 · medium · packages/twopoint5d/src/display/Display.ts:355** (dazu
`Display.ts:433`, `:1398`, `:2105`; der Director-Teil `StageDirector.ts:500, 1391,
2229, 2427` gehört zu Paket 11) — `Display` und `StageDirector` in interne Teile mit
eigenem Zustand zerlegen

Zwei Klassen tragen je mehrere Verantwortungen in einem gemeinsamen privaten
Namensraum. `Display.ts` (2238 Zeilen, rund 60 `#`-Felder) vereint Lebenszyklus,
Size-Watch (ResizeObserver, Media-Query), Size-Source-Auflösung, Fullscreen-Folge,
Self-Size-Buchhaltung unter Pixel-Zoom und den Hold der three-Animation-Loop per
`defineProperty` auf `renderer._animation`. `StageDirector.ts` (2499 Zeilen) führt den
Stapel samt Transitions, die Masken-Buchhaltung, einen LRU-Cache der Shapes mit Pinning
und das Precompile mit Monkey-Patch von `renderer.render`; jede Methode des Stapels muss
die Reentrancy-Regeln aller anderen kennen. Jede Änderung an einem Teil verlangt, die
übrigen mitzulesen.

Evidence: `export class Display {` Zeile 355–2238; `export class StageDirector extends
StageRenderer {` 2499 Zeilen, 424 Zeilen mit `#`-Membern

Empfehlung: Im `Display` Size-Watch, Size-Source und Messung in ein internes
`DisplaySizer` ziehen und den Hold der Animation-Loop in einen Helfer neben
`canvasHandover.ts` — beides hat sich mit `resolveDrawingBuffer.ts` und
`canvasHandover.ts` schon bewährt. Im `StageDirector` Shape-Bau, -Cache, -Eviction und
Compile in eine interne `DirectorShapeCache` auslagern, die Masken-Buchhaltung ebenso;
der Director behält Stapel und Transitions. Die öffentliche API bleibt unverändert.
(Effort L)

**READ-001 · medium · packages/twopoint5d/src/display/DisplayFullscreen.ts:214** (dazu
`:240`, `:612`, `:817`; der Rig-Teil `CameraRig.ts` ist mit Paket 4, 92ed8863, behoben)
— Zustand von `CameraRig` und `DisplayFullscreen` als explizites Modell statt als
Flag-Kombination führen

`CameraRig.ts` (1744 Zeilen, rund 50 `#`-Felder) leitet seinen Modus — Pose,
gehaltener Shot, Move, Lock-on, Track, Flight — aus Kombinationen von `#moving`,
`#fromPending`, `#holding`, `#follows`, `#targetPlaced`, `#track`, `#flight` u. a. ab,
und `#refusesLook()`, `#shownShot()`, `#resolveTarget()` und `busy` tun das jeweils
selbst. Der Rückweg aus einem Flight kopiert 17 Felder von Hand in `SavedState` und von
Hand zurück: ein neues Zustandsfeld muss an drei Stellen nachgezogen werden, ein
vergessenes fällt erst bei einem abgebrochenen Flight auf. `DisplayFullscreen` verteilt
seinen Zustand ebenso auf rund 15 sich bedingende Felder (`#pending` mit
`exitAfter`/`declines`, `#pendingExit`, `#foreignHeld`, `#armedElement`, `#pseudo` …);
welche Kombinationen gültig sind, steht nur in Kommentaren an den Zweigen.

Empfehlung: Im Rig den Zielzustand (Pose, Look, Hold, Target samt Rest, Follow, Track,
Focus) in ein Objekt mit `copy()` bündeln, das `SavedState` ersetzt und beim Flight als
Ganzes gesichert wird; den Modus als ein Feld oder diskriminierte Union führen. Im
Fullscreen-Controller die Zustände (idle, requesting, active, exiting, armed, pseudo)
und Übergänge als Tabelle oder Union modellieren und im Proposal als Diagramm
festhalten. (Effort M)

## Urteil des Reviewers

- ARCH-001 (Display-Teil): behoben — Messung, Size-Watch, Size-Source und Drawing Buffer in `src/display/DisplaySizer.ts:105` (Host `:89`), Hold der Animation-Loop in `src/display/AnimationLoopHold.ts:28`, `Display.ts` hält `#animationLoopHold` (`:319`) und `#sizer` (`:327`), 1576 statt 2257 Zeilen; Reihenfolge der `fullscreenchange`-Listener gewahrt (`Display.ts:867`). Verschiebung gegen `HEAD` normalisiert gegengelegt: wörtlich.
- READ-001 (Fullscreen-Teil): behoben — Phase als Union `DisplayFullscreen.ts:180`, `#phase` `:275`, `#native` `:270` (`NativeHold` `:185`), Achsen `#armedElement`, `#declined`, `#foreignHeld`; Tabelle und Diagramm im Proposal §3.5 (`docs/proposals/display-fullscreen.md:267`); Randfall `#turned()` `:992` mit Regressionstest `DisplayFullscreen.spec.ts:2475`.
- Konventionen: keine Finding-IDs, kein Rückblick; `public-api.ts`, `types.ts`, `docs/display.md`, `CHANGELOG.md` unberührt.

### Kleine Befunde (offen, nicht blockierend)

- `src/display/DisplaySizer.ts:286-289` und `:394-397`: verschobener Zeilenkommentar und neuer TSDoc-Satz stapeln sich über demselben Member; bei `stopWatch()` wiederholt der TSDoc die Zeile darüber.
- `src/display/DisplayFullscreen.ts:992-996`: der Regressionstest deckt nur die Gewährung ab; wird der beigetretene Request verweigert, spannt `#rearm()` den Tap auch bei `isSupported === false`, während der `onLandscape`-Setter (`:407`) dort den Pseudo-Modus betritt. Innerhalb der Entscheidung »was auch immer `isSupported` antwortet«, im Browser unerreichbar.
- `docs/proposals/display-fullscreen.md:280`: die Kante `requesting → idle` heißt »refused, or granted with no exit noted on it«; ein gewährter Request mit vermerktem Exit, über dem ein Element der App liegt, geht ebenfalls nach `'idle'` (`#leaveNative` greift nur bei `#nativeElement() != null`) — die Tabelle stimmt, das Diagramm zeigt den Fall nicht.

### Nebenbefunde (Urteil an der Scope-Regel: alles in Scope)

- `Display.ts:1326` `stop()` ohne Prüfung auf `#disposed` gegen sein TSDoc — vorbestehend, low, → Scope: Vertragsbruch zwischen Doku und Code, eigene Ursache.
- `Display.ts:508` `isFirstFrame` ohne TSDoc — vorbestehend, info, → Scope.
- `Display.ts:1506` `#emit` nicht `readonly` — vorbestehend, info, → Scope.
