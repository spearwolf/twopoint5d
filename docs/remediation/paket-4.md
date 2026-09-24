# Paket 4 — Öffentliche Display-API, Typen, Doku und Demos

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-065 (low), TYPE-013 (low), DOC-033 (info), READ-019 (low), DOC-014 (low), DOC-023 (low), MEM-006 (info), CONS-045 (info)
- Dazu aus der Triage (Zug 0, 2026-09-24): zwei Folgen von Paket 3 in `Stylesheets.ts` (`newSheetFor()` für ein Dokument ohne Fenster, der Name `getGlobalSheet()`), die Nebenbefunde `Display.ts:530` (Queue) und `CHANGELOG.md:248` (Queue), neu `README.md:60` und die überlangen Kommentarzeilen `Chronometer.ts:51`, `Display.spec.ts:437`, `Stylesheets.ts:181` — Begründung unter »Triage«
- Folge von: Paket 3 — gilt nur für die beiden `Stylesheets`-Folgen (zweite Generation); die Audit-Findings dieses Pakets sind erste Generation
- Ziel: Die Display-Oberfläche exportiert nur Gewolltes mit echten Signaturen und nur lesbarem Zustand, `Stylesheets` nennt sein Sheet nach dem, was es ist, und weist ein Dokument ohne Fenster mit klarer Meldung ab, Doku, README- und CHANGELOG-Einträge stimmen, und die Multi-Display-Demo räumt auf.
- Modell: stärkste Stufe — die öffentliche API wird neu geschnitten (Breaking Change samt Migration Guide), der Umbau reicht über ~15 Dateien in drei Projekten, und die CHANGELOG-Prosa steht unter strengen Konventionen; ein Fehlgriff dort kostet eine Review-Runde.
- Effort: medium — die Signaturen und Schritte stehen unten exakt; was bleibt, ist sorgfältige Ausführung über viele Dateien. `high` lüde zu Verbesserungen ein, die hier nicht stehen.
- Dateien:
  - `packages/twopoint5d/src/display/public-api.ts`, `Display.ts`, `FrameLoop.ts`, `FixedFrameLoop.ts`, `Stylesheets.ts`, `Chronometer.ts` (nur Kommentar)
  - Specs: `packages/twopoint5d/src/display/Display.spec.ts`, `FrameLoop.spec.ts`, `FixedFrameLoop.spec.ts`, neu `public-api.spec.ts`
  - Browser-Tests: `packages/twopoint5d-testing/test/stylesheets.test.js`, `pan-control-cursor.test.js`, `pan-control-stylesheet-root.test.js`
  - Doku: `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d/README.md`, `packages/twopoint5d/docs/resource-lifecycle.md` (§4, Zitat von `dispose()`), `packages/twopoint5d/docs/architecture.md` (§1)
  - Lookbook: `apps/lookbook/src/pages/demos/display-multi.astro`
- Verify: `pnpm run ci`
- Commit (Betreff und Body, mit Leerzeile dazwischen):

  ```
  refactor(display,lookbook): export the display module by name and keep postFixID, OnRAF and ISetAnimationLoop inside it and drop the unused globalStylesID, make Display#renderer, #frameLoop and #frameNo read-only, return the unsubscribe function from FixedFrameLoop#onTick() and #onRender(), add Stylesheets.getSheet() in place of the deprecated getGlobalSheet() and refuse a root in a document without a window with a message that says so, drop the stale TODO at the default renderer, bring the changelog entries on FrameLoop#start() and the FrameLoop event keys in line with the code, point the display section of the README at the Display docs, and let the multi-display demo release what it builds

  BREAKING CHANGE: postFixID and globalStylesID are no longer exported, and
  Display#renderer, Display#frameLoop and Display#frameNo are read-only
  accessors — a write is a type error and throws a TypeError at runtime in
  strict-mode code, which every ES module is.
  ```

- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · API-065 verschoben (`Stylesheets.ts:1-2`, `FrameLoop.ts:3-8`, `Display.ts:576/584/653`), `globalStylesID` seit Paket 3 unbenutzt · TYPE-013 unverändert (`FixedFrameLoop.ts:285-291`) · DOC-033 unverändert (`FixedFrameLoop.ts:274`) · READ-019 verschoben (`Display.ts:805`) · DOC-014 unverändert (`README.md:61`) · DOC-023 verschoben (`CHANGELOG.md:117`, Migration `:1653`) · MEM-006 verschoben (`display-multi.astro:96-127`) · CONS-045 verschoben (`display-multi.astro:20`) · Folgen von Paket 3: `Display.ts:1386` → neues Paket 5, `Stylesheets.ts:22-24` und `getGlobalSheet()` → dieses Paket · Queue `Display.ts:530`, `CHANGELOG.md:248` → dieses Paket
  - 2026-09-24 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-4.impl-1.json`
  - 2026-09-24 Zug 2: Report FERTIG (session 5ff4e3c9) · 17 Dateien geändert, neu `public-api.spec.ts` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-4.verify.log`)
  - 2026-09-24 Zug 3: Reviewer (opus, effort medium) — alle Findings und Folgen behoben, 4 kleine Befunde, kein kritischer oder wichtiger · Diff `paket-4.diff`, Report `paket-4.review-1.json`
  - 2026-09-24 Zug 4: keine Runde — nur kleine Befunde; Commit-Message nach Befund 3 und 4 präzisiert
  - 2026-09-24 Zug 5: committet 78ee4952 (Verify aus Zug 2, seither keine Codeänderung) · 6 Nebenbefunde in »Offene Befunde«

## Vorgehen

Reihenfolge: zuerst die Regressionstests (Schritt 1) rot sehen und die Ausgabe in
den Report, dann der Umbau. Die Zeilennummern beziehen sich auf den Stand
`e9c29c0b`.

### 1. Regressionstests zuerst

a. **Neu `packages/twopoint5d/src/display/public-api.spec.ts`**, Test
   `display public API > exports the classes and functions of the display module and nothing else`:

   ```ts
   import * as displayApi from './public-api.js';
   // …
   expect(Object.keys(displayApi).sort()).toEqual([
     'Chronometer', 'Display', 'FixedFrameLoop', 'FrameLoop', 'Stylesheets',
     'getContentAreaSize', 'isWebGLRenderer', 'isWebGPURenderer',
   ]);
   ```

   Vor dem Umbau rot: `OnRAF`, `globalStylesID`, `postFixID` stehen zusätzlich
   in der Liste. (`Object.keys` eines Modul-Namespace liefert die Exportnamen
   sortiert; das `.sort()` hält den Test davon unabhängig.)

b. **`Display.spec.ts`**, neuer `describe('read-only state')` mit einem Test
   `renderer, frameLoop and frameNo are accessors without a setter`: für jeden
   der drei Namen hat `Object.getOwnPropertyDescriptor(Display.prototype, name)`
   einen `get` und keinen `set`; auf einem Display aus `makeDisplay()` wirft
   ein Schreibversuch `(display as unknown as Record<string, unknown>)[name] = …`
   einen `TypeError` (Spec-Module laufen im Strict Mode), und der Wert bleibt,
   was er vorher war. Vor dem Umbau rot: die drei sind Instanzfelder, der
   Deskriptor auf dem Prototyp ist `undefined`.

c. **`FixedFrameLoop.spec.ts`**, Test
   `onTick() and onRender() hand back the function that takes the handler off again`:
   `const offTick: UnsubscribeFunc = sim.onTick(handler)` und dasselbe für
   `onRender` — ohne Cast, `type UnsubscribeFunc` aus `@spearwolf/eventize`;
   beide aufrufen, einen Frame mit `emit(display, OnDisplayRenderFrame, makeFrame(1 / 60))`
   senden, keiner der beiden Handler wird erreicht. Der rote Lauf ist hier
   `pnpm typecheck` (vor dem Umbau ist der Rückgabetyp `unknown` und nicht
   zuweisbar) — zur Laufzeit gab `on()` die Funktion schon immer zurück.
   Die Typecheck-Ausgabe gehört in den Report.

d. **`packages/twopoint5d-testing/test/stylesheets.test.js`**, Test
   `refuses a root in a document without a window, on every call, with a message that says so`:
   `const doc = document.implementation.createHTMLDocument('');`, ein `div` in
   `doc.body`; zweimal nacheinander
   `Stylesheets.installRule('twopoint5d-test-windowless', 'color: red', el)` —
   beide Male ein `Error`, dessen Meldung `without a window` enthält;
   `Stylesheets.releaseRule('twopoint5d-test-windowless', el)` wirft nicht.
   Vor dem Umbau rot: es kommt ein `NotAllowedError` mit anderer Meldung.

### 2. `public-api.ts` — benannte Exporte (API-065)

Den Inhalt ganz ersetzen durch:

```ts
// Named one by one: a file of this module exports for its neighbours as well, and only what is
// listed here is published
export {Chronometer} from './Chronometer.js';
export {Display, type DisplayEventListener} from './Display.js';
export {FixedFrameLoop, type FixedFrameLoopRenderProps, type FixedFrameLoopTickProps} from './FixedFrameLoop.js';
export {FrameLoop} from './FrameLoop.js';
export {isWebGLRenderer} from './isWebGLRenderer.js';
export {isWebGPURenderer} from './isWebGPURenderer.js';
export {Stylesheets} from './Stylesheets.js';
export {getContentAreaSize} from './styleUtils.js';
export type {
  CreateRendererParameters,
  DisplayEventProps,
  DisplayParameters,
  DisplayRendererParameters,
  ResizeDisplayToFn,
} from './types.js';
```

Die Typen aus `types.ts` stehen ebenfalls benannt da, nicht als
`export type *`: die Entscheidung verlangt benannte Exporte, und ein Typ, der
später in `types.ts` dazukommt, bleibt so intern, bis er hier steht.
`pnpm checkNameableTypes` (Teil von `pnpm run ci`) ist der Beleg, dass keine
öffentliche Signatur mehr auf etwas zeigt, das hier fehlt — Schritte 3 und 4
nehmen die beiden Stellen heraus, die sonst anschlügen.

### 3. `FrameLoop.ts` — `OnRAF` und `ISetAnimationLoop` werden intern (API-065)

- `export` vor `interface ISetAnimationLoop` (Z. 3) und vor
  `const OnRAF` (Z. 8) entfernen. Der Wert von `OnRAF` bleibt
  `Symbol.for('twopoint5d:FrameLoop.OnRAF')`.
- Konstruktor: der zweite Parameter bekommt die Form ausgeschrieben, damit die
  veröffentlichte Signatur keinen internen Namen trägt:

  ```ts
  // the shape is written out, so the published signature names nothing the package keeps inside
  constructor(maxFps = 0, renderer?: {setAnimationLoop(callback: ((now: number) => unknown) | null): unknown}) {
  ```

  Nicht `Pick<WebGPURenderer, 'setAnimationLoop'>`: three erwartet dort ein
  `Promise<void>` als Rückgabe, und der Renderer-Stub in `FrameLoop.spec.ts`
  (`makeFakeRenderer()`) gibt `void` zurück.
- Die Methode `[OnRAF](now, _frameNo, measuredFps)` (Z. 255) verschwindet aus
  der Klasse; ihr Rumpf wird unverändert ein privates Feld
  `readonly #onRAF = (now: number, _frameNo: number, measuredFps: number): void => { … };`.
  Grund: eine öffentliche Methode mit dem Schlüssel `[OnRAF]` hielte `OnRAF`
  in der Signatur von `FrameLoop`, und `checkNameableTypes` prüft auch
  berechnete Namen (`ts.isComputedPropertyName`), private TS-Member
  eingeschlossen — nur ein `#`-Feld taucht in der `.d.ts` nicht auf.
- `RAF` meldet Funktionen statt Objekte an:
  - `#loops` wird `new Map<FrameLoop, UnsubscribeFunc>()` (Kommentar darüber
    bleibt sinngemäß: der Treiber läuft, solange ihn jemand treibt).
  - `attach(loop: FrameLoop, onRAF: (now: number, frameNo: number, measuredFps: number) => void): void` —
    `if (this.#loops.has(loop)) return; this.#loops.set(loop, on(this, OnRAF, onRAF)); this.start();`
  - `detach(loop: FrameLoop): void` — Handle holen; fehlt es, `return`; sonst
    aus der Map löschen, Handle aufrufen, bei leerer Map `this.stop()`.
  - `FrameLoop#start()` ruft `this.raf.attach(this, this.#onRAF)`.
  - `import {…, type UnsubscribeFunc} from '@spearwolf/eventize'`.
- Die bestehende Suite `FrameLoop.spec.ts` bleibt grün und deckt das
  Verhalten; in ihr den Import von `OnRAF` und die Zeile
  `expect(OnRAF).toBe(Symbol.for('twopoint5d:FrameLoop.OnRAF'));` (Z. 293)
  streichen, der Test prüft dann nur noch `FrameLoop.OnFrame`.

### 4. `Stylesheets.ts` (API-065 und die beiden Folgen von Paket 3)

- `globalStylesID` (Z. 2) löschen — seit Paket 3 benutzt es niemand, es gibt
  kein `<style>`-Element mehr, das es benennen könnte.
- `postFixID` (Z. 1): `export` entfernen, sonst unverändert; `classNameOf()`
  benutzt es weiter.
- Neue statische Methode `Stylesheets.getSheet(root: HTMLElement | ShadowRoot = document.head): CSSStyleSheet`
  mit dem heutigen Rumpf und der heutigen TSDoc von `getGlobalSheet()`, dazu
  ein `@throws`: »when `root` lies in a document without a window — one from
  `document.implementation.createHTMLDocument()`, a `DOMParser` or the content
  of a `<template>` —, since such a document adopts no constructed stylesheet.
  Nothing is cached for it, and every call throws again.«
- `getGlobalSheet()` bleibt als Alias für ein Release:

  ```ts
  /**
   * @deprecated Use {@link Stylesheets.getSheet}: there is one sheet per document or shadow root,
   *   not one global sheet. This name stays as an alias for one release.
   */
  static getGlobalSheet(root: HTMLElement | ShadowRoot = document.head): CSSStyleSheet {
    return Stylesheets.getSheet(root);
  }
  ```

- `putRule()` (Z. 50) ruft `Stylesheets.getSheet(root)`; der Kommentar in
  `releaseRule()` (Z. 168) nennt `getSheet()`.
- `newSheetFor(scope)` (Z. 22-29): der Fallback auf den `CSSStyleSheet` dieses
  Realms fällt weg — ein Dokument adoptiert nur ein Sheet, dessen Constructor
  Document es selbst ist, und das erfüllt für ein Dokument ohne Fenster kein
  Konstruktor. Stattdessen:

  ```ts
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (view == null) {
    throw new Error(
      'Stylesheets: the root lies in a document without a window, and such a document adopts no ' +
        'constructed stylesheet. Install the rule for a root in a document that a window or a frame shows.',
    );
  }
  return new view.CSSStyleSheet();
  ```

  Den Kommentar über der Funktion auf den neuen Stand bringen (ohne Rückblick):
  ein Dokument oder ShadowRoot adoptiert nur ein Sheet aus dem `CSSStyleSheet`
  seines eigenen Fensters; ein Dokument ohne Fenster adoptiert keines, und der
  Aufruf wirft, bevor etwas im Cache `sheets` landet. `getSheet()` ruft
  `newSheetFor()` weiterhin vor `sheets.set()`, damit der Cache leer bleibt.
- Klassen-TSDoc von `Stylesheets`: ein Satz dazu — ein Root in einem Dokument
  ohne Fenster bekommt einen Fehler, der das sagt.
- Kommentarzeile Z. 181 (105 Zeichen) auf höchstens 100 Zeichen umbrechen.

### 5. `Display.ts` (API-065, READ-019, Kommentarbreite)

- `renderer?: WebGPURenderer;` (Z. 653) → privates Feld `#renderer?: WebGPURenderer;`
  und Getter an derselben Stelle:

  ```ts
  /**
   * The `WebGPURenderer` this display draws with — the one it built, or the one handed to the
   * constructor. The display owns it and releases it in {@link Display.dispose}; afterwards this
   * answers `undefined`.
   */
  get renderer(): WebGPURenderer | undefined {
    return this.#renderer;
  }
  ```

  Der Konstruktor schreibt `this.#renderer = …` (Z. 777 und 811); `dispose()`
  ersetzt `delete this.renderer;` (Z. 1389) durch `this.#renderer = undefined;`.
  Lesende Stellen (`this.renderer`, `this.renderer!`) dürfen bleiben.
- `frameLoop: FrameLoop;` (Z. 584) → `readonly #frameLoop: FrameLoop;` und

  ```ts
  /**
   * The {@link FrameLoop} this display runs on, built by the constructor with `maxFps`. The display
   * stands on it while it runs, and {@link Display.dispose} takes it off again.
   */
  get frameLoop(): FrameLoop {
    return this.#frameLoop;
  }
  ```

  Der Konstruktor schreibt `this.#frameLoop = new FrameLoop(maxFps ?? 0, this.#renderer);`
  (Z. 851) — weiterhin vor dem `try`, `dispose()` im `catch` braucht ihn.
- `frameNo = 0;` (Z. 576) → `#frameNo = 0;` und `get frameNo(): number`, die
  bestehende TSDoc (»The number of the frame being rendered: `0` until the
  first frame, …«) wandert an den Getter. `renderFrame()` zählt
  `this.#frameNo += 1` (Z. 1259); die lesenden Stellen (Z. 1199, 1258, 1480)
  dürfen den Getter oder das Feld nehmen.
- READ-019, `makeRenderer` (Z. 801-808): TODO und Spread fallen weg:

  ```ts
  const makeRenderer =
    createRenderer ??
    // three writes its getFallback onto the options it is given; these are built for this one call
    ((params: CreateRendererParameters) => new WebGPURenderer(params));
  ```

  Begründung (für den Report, nicht für den Code): `WebGPURenderer` setzt
  `parameters.getFallback` auf das übergebene Objekt
  (`three/src/renderers/webgpu/WebGPURenderer.js:65`); das Objekt ist das
  Literal, das der Konstruktor ein paar Zeilen tiefer nur für diesen Aufruf
  baut, niemand hält es danach. Die Kopie schützte nichts.
- TSDoc von `pixelZoom`, Z. 530 (105 Zeichen), auf höchstens 100 Zeichen
  umbrechen.
- Sonst nichts an `Display.ts`: `dispose()` bleibt in seiner Reihenfolge
  (Paket 5 fasst die Rückgabe des Canvas an).

### 6. `docs/resource-lifecycle.md` §4

Das zeichengleiche Zitat von `dispose()` (Z. 184-186) mitziehen:
`delete this.renderer;` → `this.#renderer = undefined;`. Danach muss der Block
Zeichen für Zeichen dem Rumpf in `Display.ts` entsprechen.

### 7. `FixedFrameLoop.ts` (TYPE-013, DOC-033)

- `onTick`/`onRender` (Z. 285-291) als Pfeilfelder in der Form der `on*` von
  `Display` — ein abgetrenntes `const {onTick} = loop` funktioniert damit wie
  heute:

  ```ts
  /** Subscribes `handler` to every simulation tick. Returns the function that takes it off again. */
  readonly onTick = (handler: (props: FixedFrameLoopTickProps) => unknown): UnsubscribeFunc =>
    on(this, OnTick, handler);

  /** Subscribes `handler` to every render frame of the loop. Returns the function that takes it off again. */
  readonly onRender = (handler: (props: FixedFrameLoopRenderProps) => unknown): UnsubscribeFunc =>
    on(this, OnRender, handler);
  ```

  `type UnsubscribeFunc` zum Import aus `@spearwolf/eventize` dazu. Die
  Kommentarzeilen ebenfalls ≤ 100 Zeichen.
- DOC-033: den letzten Absatz der TSDoc von `dispose()` (Z. 269-275) auf
  höchstens 100 Zeichen je Zeile neu umbrechen; Wortlaut unverändert.

### 8. Übrige überlange Kommentarzeilen im Display-Modul

Gleiche Ursache wie DOC-033, auf höchstens 100 Zeichen umbrechen, Wortlaut
unverändert: `Chronometer.ts:51` (104), `Display.spec.ts:437` (105). Danach
liefert

```bash
awk 'length($0)>100 && $0 ~ /^[[:space:]]*(\*|\/\/)/ {print FILENAME":"FNR}' packages/twopoint5d/src/display/*.ts
```

nichts mehr.

### 9. Browser-Tests auf `getSheet()`

Jeder Aufruf von `Stylesheets.getGlobalSheet(…)` in
`stylesheets.test.js` (Z. 10, 15, 85, 238, 242, 246, 277),
`pan-control-cursor.test.js` (Z. 138, 223, 282) und
`pan-control-stylesheet-root.test.js` (Z. 7) wird `Stylesheets.getSheet(…)`.
Dazu in `stylesheets.test.js` ein Test
`getGlobalSheet() answers the sheet getSheet() answers for the same root`
(Dokument und ein ShadowRoot) — der einzige Aufruf des Alias.

### 10. CHANGELOG `[Unreleased]` (`packages/twopoint5d/CHANGELOG.md`)

Nach dem Skill `updating-changelog`; nichts außerhalb von `[Unreleased]`
anfassen. Einzelne Einträge:

- **Added, Z. 18** (»export 30 types …«): `ISetAnimationLoop` und `OnRAF` aus
  der Aufzählung nehmen, die Zahl auf 28 senken. Beide waren im Release 0.21.2
  nicht exportiert (dort stand `FrameLoop.js` gar nicht in `public-api.ts`) —
  sie verschwinden also nur aus einem unveröffentlichten Eintrag, ein
  `Removed`-Eintrag entfällt.
- **Added**: `add Stylesheets.getSheet()`: die Stylesheet des Dokuments oder
  ShadowRoots, für das `root` steht — dasselbe, was `getGlobalSheet()`
  liefert, unter dem Namen dessen, was es ist.
- **Changed, Z. 117** (DOC-023): ersetzen durch einen Eintrag, der das
  Verhalten beschreibt: `FrameLoop#start()` gibt bei jedem Aufruf eine
  Funktion zurück, die `target` wieder von der Schleife nimmt — auch für ein
  `target`, das schon auf der Schleife steht und dort genau einmal bleibt.
  (Gegen 0.21.2 ist das eine Laufzeitänderung: dort kam für ein fehlendes
  oder schon laufendes `target` `undefined` zurück, obwohl die Deklaration
  ohne `strictNullChecks` `() => void` hieß.)
- **Changed, Z. 138**: `OnRAF` herausnehmen — der Eintrag spricht nur noch
  von `FrameLoop.OnFrame` als `Symbol.for('twopoint5d:FrameLoop.OnFrame')`;
  der letzte Satz: »Code that subscribes through `FrameLoop.OnFrame` needs no
  change; code that rebuilds the key from its string does — see the
  migration guide«.
- **Changed, Z. 189** (Stylesheets auf Constructable Stylesheets): einen Satz
  anhängen — ein Root in einem Dokument ohne Fenster (aus
  `document.implementation.createHTMLDocument()`, einem `DOMParser` oder dem
  Inhalt eines `<template>`) bekommt einen Fehler, der das sagt, weil ein
  solches Dokument kein Constructable Stylesheet adoptiert.
- **Changed, neu**: `Display#renderer`, `#frameLoop` und `#frameNo` sind nur
  lesbare Accessoren auf dem Prototyp; ein Schreiben ist ein Typfehler und
  wirft zur Laufzeit einen `TypeError`. Der Display besitzt Renderer und
  Schleife und gibt beide in `dispose()` frei; `frameNo` zählt er selbst.
  Verweis auf den Migration Guide.
- **Changed, neu**: `FixedFrameLoop#onTick()` und `#onRender()` geben die
  `UnsubscribeFunc` zurück, die den Handler wieder abmeldet, so wie die
  `on…()`-Methoden von `Display`.
- **Changed, Z. 248** (Nebenbefund aus der Queue): den zweiten Satz »The sheet
  no longer grows by a rule per `Display`, per created container and per
  fullscreen toggle« durch den heutigen Stand ersetzen: ein Name trägt je
  Root eine Regel, wie viele Displays, Container und Fullscreen-Wechsel sie
  auch installieren.
- **Deprecated**: `deprecate Stylesheets.getGlobalSheet() in favour of getSheet()`:
  es gibt ein Sheet je Dokument oder ShadowRoot, kein globales; der alte Name
  bleibt ein Release lang als Alias (Formulierung wie die beiden
  bestehenden Deprecated-Einträge).
- **Removed**: `remove the exports postFixID and globalStylesID`: der
  Klassenname, den `Stylesheets` vergibt, kommt vollständig aus dem
  Rückgabewert von `installRule()`, `retainRule()` und `addRule()`;
  `globalStylesID` benannte ein `<style>`-Element, das das Modul nicht mehr
  anlegt. Verweis auf den Migration Guide.
- **Migration Guide**:
  - Abschnitt »`FrameLoop#start()` can answer `undefined`« (Z. 1653-1670)
    löschen: die Deklaration bleibt `() => void`, Code nach dem »Before« läuft
    unverändert.
  - Abschnitt »The event keys of `FrameLoop` carry the library namespace«
    (Z. 1772): den ersten Satz »The symbols are exported; take them from the
    module instead of building them from their name.« ersetzen durch einen,
    der nur `FrameLoop.OnFrame` nennt (»`FrameLoop.OnFrame` carries the key;
    take it from the class instead of building it from its name.«). Die
    Codeblöcke bleiben.
  - Neuer Abschnitt `#### Display#renderer, #frameLoop and #frameNo are read-only`
    mit **Before**/**After**: vorher ein Schreiben (z. B. ein eigener Renderer
    über `display.renderer = …`), nachher: einen eigenen Renderer übergibt man
    dem Konstruktor (`new Display(renderer)`), eine eigene Schleife abonniert
    man über `display.frameLoop.start(target)` oder die `on…()`-Methoden,
    `frameNo` liest man nur.
  - Neuer Abschnitt `#### postFixID and globalStylesID are gone` mit
    **Before** `` const className = `${name}-${postFixID}`; `` und **After**
    `const className = Stylesheets.installRule(name, css);`.
  - Die Codeblöcke im Migration Guide sind Auszüge und tragen `ts`, nicht
    `ts check`.

### 11. `docs/architecture.md` §1

Der Punkt »Type-only exports use `export type * from './types.js'`, matching
`@typescript-eslint/consistent-type-imports` on the import side.« stimmt für
das Display-Modul nicht mehr. Ersetzen durch: Type-only exports go through
`export type` — `export type * from './types.js'`, or a named
`export type {…}` list in a module that names its exports one by one, as
`display/` does —, matching `@typescript-eslint/consistent-type-imports` on
the import side.

### 12. `packages/twopoint5d/README.md`, Block `#### [display]` (DOC-014)

- Z. 60 »there is no other dependency than the three.js package itself«
  stimmt nicht: das Modul importiert `three` und `@spearwolf/eventize`. Ersetzen
  durch: »depends on nothing but three.js and `@spearwolf/eventize`, both peer
  dependencies of the package«.
- Z. 61: statt des Stage-Cheat-Sheets auf die Doku zeigen, die es für die
  Display-Schicht gibt — die Klassen-TSDoc mit den Abschnitten »Lifecycle« und
  »Resize model«:
  `- api docs: the \`Display\` class docs — lifecycle and resize model — in [src/display/Display.ts](src/display/Display.ts)`.
  Der Stage-Block darüber behält seinen Verweis.

### 13. `apps/lookbook/src/pages/demos/display-multi.astro` (MEM-006, CONS-045)

- CONS-045: die Klasse `debug` am zweiten Container (Z. 20) entfernen.
  Nachgesehen: keine Regel für `.debug` in `apps/lookbook/src/**/*.{astro,css,scss,ts}`
  oder `apps/lookbook/public/**/*.css`, kein Skript fragt sie ab, und Tailwind 4
  kennt keine Utility dieses Namens.
- MEM-006: in der Schleife (Z. 96-127) den `StageRenderer` in einer Konstante
  halten (`const stageRenderer = new StageRenderer(display);`, dann
  `stageRenderer.setClearColor(new Color('#304050')).add(stage);`) und je
  Display einen Aufräumpfad anmelden, in dieser Reihenfolge:

  ```ts
  // the display carries the lifetime of everything built for it here, so its end is where they go
  display.onDispose(() => {
    stageRenderer.dispose();
    stage.dispose();
    sprite.removeFromParent();
    material.dispose();
    textureImage.dispose();
  });
  ```

  `StageRenderer#dispose()` gibt die Stage frei, bevor `Stage2D#dispose()`
  ihren Pass-Node löst (so verlangt es dessen TSDoc). `TextureFactory` hat
  kein `dispose()` und hält nichts. Die Geometrie eines `THREE.Sprite` teilen
  sich alle Sprites des Moduls — sie wird nicht freigegeben. Die
  `OnDisplayResize`-Subscription nimmt `display.dispose()` selbst mit.
  `display.renderer` im `TextureFactory`-Aufruf bleibt wie es ist (Typ
  unverändert `WebGPURenderer | undefined`).

## Abgleich (gegen `e9c29c0b`)

- **API-065 — verschoben, in der Sache unverändert.** `Stylesheets.ts:1-2`
  exportiert `postFixID` und `globalStylesID` (Audit: `:3-4`), `FrameLoop.ts:3`
  `ISetAnimationLoop` und `:8` `OnRAF`, und `public-api.ts` reicht beide Dateien
  mit `export *` durch. `Display.ts:576` `frameNo = 0`, `:584`
  `frameLoop: FrameLoop`, `:653` `renderer?: WebGPURenderer` — alle drei
  schreibbare Instanzfelder (Audit: `:254/:262/:314`). Neu seit Paket 3:
  `globalStylesID` ist unbenutzt und kann weg. Im Release 0.21.2 (`62174770`)
  waren `postFixID`/`globalStylesID` exportiert, `OnRAF`/`ISetAnimationLoop`
  nicht (`FrameLoop.js` fehlte in `public-api.ts`) — daher `Removed` nur für
  die ersten beiden.
- **TYPE-013 — unverändert.** `FixedFrameLoop.ts:285-291`, beide per
  `.bind` und `as unknown as (…) => unknown`.
- **DOC-033 — unverändert.** `FixedFrameLoop.ts:274`, 107 Zeichen.
- **READ-019 — verschoben.** `Display.ts:805` (Audit: `:606`),
  `// TODO check if this is still needed` über `...params`.
- **DOC-014 — unverändert.** `README.md:61` zeigt auf `src/stage/README.md`,
  dasselbe Ziel wie `:54`.
- **DOC-023 — verschoben, unverändert.** `CHANGELOG.md:117` (Changed) und der
  Migrationsabschnitt `:1653`; der Code sagt `start(target: object): () => void`
  (`FrameLoop.ts:226`) und gibt immer eine Funktion zurück.
- **MEM-006 — verschoben, unverändert.** `display-multi.astro:96-127`: sechs
  Displays, je `Stage2D`, `StageRenderer`, `TextureFactory`, Textur,
  `SpriteMaterial`, `Sprite`, nichts wird freigegeben.
- **CONS-045 — verschoben, unverändert.** `display-multi.astro:20`, Klasse
  `debug` ohne Regel (siehe Schritt 13).

## Triage (Zug 0, 2026-09-24)

Folgen unter Paket 3:

- `Display.ts:1386` (Rückgabe eines übergebenen Canvas vor der GPU-Arbeit,
  Firefox/WebGPU) — **echte Folge von Paket 2**, eigene Ursache (Zeitpunkt der
  Rückgabe von `width`/`height` gegen laufende GPU-Arbeit), mit der
  Oberfläche dieses Pakets nicht verwandt. Geschnitten als **Paket 5**
  (`Folge von: Paket 2`), eingereiht nach diesem Paket, weil beide
  `Display#dispose()` und dessen Zitat in `resource-lifecycle.md` ändern.
- `Stylesheets.ts:22-24` (`newSheetFor()`: der Realm-Fallback wirft immer
  `NotAllowedError`, das Sheet bleibt im Cache) — **Symptom von Paket 3**:
  dessen Ursache (Sheets aus dem Fenster des Dokuments) ist für das Dokument
  ohne Fenster nicht zu Ende gebracht. Das Nachtragspaket dafür ist mit
  diesem Paket zusammengelegt: dieselbe Funktion `getGlobalSheet()`/`getSheet()`
  ruft `newSheetFor()` und füllt den Cache, und dieses Paket benennt sie um.
  Gewählt: abweisen mit klarer Meldung statt nur den Kommentar zu richten —
  ein Codepfad, der immer mit fremder Meldung wirft, bliebe sonst stehen.
- `Stylesheets.getGlobalSheet()` (Name) und `globalStylesID` — **Symptom von
  Paket 3** (die Semantik ist seitdem »ein Sheet je Scope«, der öffentliche
  Name blieb), ausdrücklich an API-065 adressiert. Gewählt: neuer Name
  `getSheet()`, `getGlobalSheet()` als `@deprecated`-Alias für ein Release —
  der Weg, den das Projekt für `TexturedSpritePool` und `keyCodes` gegangen
  ist; nicht brechend, darum keine Rückfrage.

Nebenbefunde:

- Queue `Display.ts:468` (jetzt `:530`, TSDoc von `pixelZoom` über 100
  Zeichen) — gleiche Ursache wie DOC-033 (Kommentarzeilen über die Breite der
  Umgebung), aufgenommen; ebenso die bei der Suche nach derselben Ursache
  gefundenen `Chronometer.ts:51`, `Display.spec.ts:437`, `Stylesheets.ts:181`.
- Queue `CHANGELOG.md:248` (Rückblick im `[Unreleased]`-Eintrag zu
  `installRule()`) — gleiche Ursache wie DOC-023: ein `[Unreleased]`-Eintrag,
  der vor dem Release nicht stimmt; derselbe Abschnitt, den dieses Paket
  ohnehin schreibt. Aufgenommen.
- Neu `README.md:60` »there is no other dependency than the three.js package
  itself« — vorbestehend (stand so in `62174770:packages/twopoint5d/README.md:62`),
  gleiche Ursache wie DOC-014 (der Display-Block des README beschreibt das
  Modul nicht, wie es ist), dieselben zwei Zeilen. Aufgenommen.
- Queue `Display.ts:625` (TODO) — deckungsgleich mit READ-019, schließt mit
  diesem Commit.
- Nicht aufgenommen, andere Ursache: `Chronometer.ts:145-160`,
  `Display.ts:785` (`get pause()`), `Display.ts:218`/`:376` (Aussagen der
  Klassen-TSDoc über Start und Resize-Emission), `DisplayStateMachine.ts:131-162`,
  die Browser-Test-Einträge aus Paket 1b — bleiben für die Drain-Runde.

## Findings im Volltext

**API-065 · low · packages/twopoint5d/src/display/Stylesheets.ts:3-4** (auch `FrameLoop.ts:3-8`, `Display.ts:254`, `:262`, `:314`) — Interna und veränderbaren Zustand aus der Display-Oberfläche nehmen
`export *` veröffentlicht `postFixID`, `globalStylesID`, `OnRAF` und `ISetAnimationLoop`. `frameNo`, `frameLoop` und `renderer` sind öffentlich beschreibbar. Wer `renderer` oder `frameLoop` neu zuweist, unterläuft Ownership und `dispose()`, und ein geschriebenes `frameNo` bricht die Erst-Frame-Logik. Jede spätere Einschränkung wird ein Breaking Change.
Empfehlung: In den `public-api.ts`-Dateien benannte Exporte führen und die drei Felder als Getter bzw. `readonly` exponieren.
Entscheidung (2026-09-24): jetzt umsetzen, Breaking Change mit CHANGELOG- und Migration-Guide-Eintrag, eigene Aufrufer mitziehen.

**TYPE-013 · low · packages/twopoint5d/src/display/FixedFrameLoop.ts:285-291** — onTick/onRender eine echte Signatur geben und die Unsubscribe-Funktion zurückgeben
`onTick` und `onRender` sind per `as unknown as` mit dem Rückgabetyp `unknown` typisiert. Wer abmelden will, muss casten, anders als bei den `on*`-Methoden von `Display`.
Empfehlung: Als echte Methoden mit `UnsubscribeFunc` als Rückgabetyp und ohne `.bind`-Cast deklarieren.
Abweichung: Pfeilfelder statt Prototyp-Methoden, in der Form der `on*` von `Display` — so bleibt ein abgetrennter Aufruf (`const {onTick} = loop`) gültig, wie er es mit `.bind` heute ist.

**DOC-033 · info · packages/twopoint5d/src/display/FixedFrameLoop.ts:274** — Den Umbruch im TSDoc von FixedFrameLoop#dispose() reparieren
Das TSDoc bricht mitten im Satz um, mit einer überlangen Zeile nach »writes them: a write the setter accepts lands, …«. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Den Absatz auf die Zeilenbreite der Umgebung neu umbrechen.

**READ-019 · low · packages/twopoint5d/src/display/Display.ts:606** — Ein verwaistes TODO steht am Spread der Renderer-Parameter im Standard-makeRenderer
Aufgefallen im Remediation-Lauf vom 2026-09-21. `// TODO check if this is still needed` steht an einem reinen Spread der Renderer-Parameter. Offen bleibt, was geprüft werden soll.
Empfehlung: Klären und entweder den Spread begründen oder das TODO entfernen.

**DOC-014 · low · packages/twopoint5d/README.md:61** — Der display-Block im README verweist auf die stage-Doku
Der `#### [display]`-Block verweist unter »api docs« auf `src/stage/README.md`, dasselbe Ziel wie der Stage-Block darüber; für die Display-Schicht gibt es dort nur die Rolle in der Übersicht, keine eigene Doku. Re-Check: unverändert.
Empfehlung: Den Verweis entfernen oder auf eine Display-Doku zeigen lassen, sobald es eine gibt.

**DOC-023 · low · packages/twopoint5d/CHANGELOG.md:109** — Ein Unreleased-Eintrag beschreibt eine FrameLoop-Signatur, die es nicht gibt
Der Eintrag »change the return type of `FrameLoop#start()` to `(() => void) | undefined`« steht unter `[Unreleased]` (samt Migration-Guide-Abschnitt in Zeile 1197) und beschreibt ein Verhalten, das der Code nicht hat: `FrameLoop#start()` ist als `() => void` deklariert, das TSDoc sagt »every call hands one back«, und `FrameLoop.spec.ts` prüft genau das. So wandert die Zeile in die nächsten Release Notes. Re-Check: unverändert (Zeile verschoben von 62 nach 83).
Empfehlung: Den Eintrag und den Migration-Guide-Abschnitt auf das tatsächliche Verhalten umschreiben oder streichen, bevor er in ein Release geht.

**MEM-006 · info · apps/lookbook/src/pages/demos/display-multi.astro:98-114** — Die Multi-Display-Demo gibt sechsmal denselben Satz Ressourcen nie frei
Die Schleife baut pro Canvas ein `Display`, einen `StageRenderer`, eine `TextureFactory`, eine Textur, ein `SpriteMaterial` und einen `Sprite` und gibt nichts davon je frei — sechs Displays auf einer Seite, sechsmal derselbe Satz. Für eine Lookbook-Demo vertretbar, aber jede weitere Demo derselben Bauart erbt das Muster.
Empfehlung: Den Aufräumpfad übernehmen, den `map2d-rect-visi.ts` trägt: `once(demo, OnDisplayDispose, …)` beziehungsweise `Display#onDispose()`.

**CONS-045 · info · apps/lookbook/src/pages/demos/display-multi.astro:22** — Die Klasse debug am zweiten Canvas-Container hat keine Regel
Der zweite `.canvasContainer` trägt die Klasse `debug`, für die der `<style>`-Block dieser Seite keine Regel führt. Ob ein globales Stylesheet sie trägt, ist nicht nachgesehen.
Empfehlung: Nachsehen, ob eine globale Regel greift; wenn nicht, die Klasse entfernen oder ihr die gemeinte Regel geben.

**Folge aus Paket 3 · `packages/twopoint5d/src/display/Stylesheets.ts:22-24` (`newSheetFor()`)** — der Kommentar verspricht »A document without a window falls back on the constructor of this realm«; der Fallback wirft immer `NotAllowedError` (ein Dokument adoptiert nur ein Sheet, dessen constructor document es selbst ist — `createHTMLDocument()`, `DOMParser`, `template.content.ownerDocument`), und das nicht adoptierbare Sheet bleibt im Cache `sheets`. Kommentar ehrlich machen oder den Fall vor dem Cache mit klarer Meldung abweisen.

**Folge aus Paket 3 · `packages/twopoint5d/src/display/Stylesheets.ts` `getGlobalSheet()`** — es gibt kein globales Sheet mehr, sondern eines je Dokument oder ShadowRoot; der Name ist eine API-Frage für Paket 4 (API-065), ebenso der unbenutzte Export `globalStylesID` (`:2`).

## Urteil des Reviewers (Zug 3, gegen den Stand von 78ee4952)

- API-065 — behoben: `public-api.ts:1-17` benannte Exporte; `postFixID` intern (`Stylesheets.ts:1`), `globalStylesID` gelöscht; `ISetAnimationLoop`/`OnRAF` intern (`FrameLoop.ts:3`, `:8`, `#onRAF` an `:257`); Getter `Display.ts:578`, `:594`, `:672`; Removed-Eintrag und Migration Guide `CHANGELOG.md:210`, `:894`, `:917`
- TYPE-013 — behoben: `FixedFrameLoop.ts:286`, `:292` Pfeilfelder mit `UnsubscribeFunc`; CHANGELOG `:141`
- DOC-033 — behoben: `FixedFrameLoop.ts:274-275`
- READ-019 — behoben: `Display.ts:824-826`
- DOC-014 — behoben: `README.md:61`
- DOC-023 — behoben: `CHANGELOG.md:118`, Migrationsabschnitt gestrichen, `:139`/`:1801` nennen nur `FrameLoop.OnFrame`
- MEM-006 — behoben: `display-multi.astro:115-121`
- CONS-045 — behoben: `display-multi.astro:20`
- Folge `newSheetFor()` (Dokument ohne Fenster) — behoben: `Stylesheets.ts:26-34`, `@throws` `:101-104`, Klassen-TSDoc `:91`, CHANGELOG `:192`
- Folge Name `getGlobalSheet()` — behoben: `getSheet()` `Stylesheets.ts:108`, Alias `:126`, CHANGELOG `:42`, `:199`
- Nebenbefunde `Display.ts:530-531`, `CHANGELOG.md:253`, `README.md:60`, `Chronometer.ts:51-52`, `Display.spec.ts:437-438`, `Stylesheets.ts:200-201` — behoben

Kleine Befunde:

- offen: `FixedFrameLoop.ts:285` — einzeilige TSDoc von `onTick` hat 101 Zeichen (der awk-Check aus Schritt 8 erkennt `/**` am Zeilenanfang nicht)
- offen: `CHANGELOG.md:140`, `:896-897` — »throws a `TypeError` at runtime« gilt nur für Strict-Mode-Code (in der Commit-Message präzisiert, im CHANGELOG nicht)
- erledigt: Commit-Message nannte `globalStylesID` »inside it«, obwohl es gelöscht wird — präzisiert vor dem Commit
- in die Queue: `FrameLoop.spec.ts:371` (109 Zeichen, vorbestehend)

Urteile der Nebenbefunde aus dem Report des Implementierers: `FrameLoop.ts:197-200` → Rückfrage, weil »nur lesbar« an `FrameLoop` ein Breaking Change ist, den die Entscheidung zu API-065 (nur `Display`) nicht deckt · `FrameLoop.ts:47` → Scope (modulintern, `display/**`) · `Display.ts:557-567`, `CHANGELOG.md:1799`, `FrameLoop.spec.ts:371` → Scope (Display-Modul, seine Doku) · `pan-control-stylesheet-root.test.js:42` → Audit: ein Test der Controls-Domäne über `PanControl2D`, nicht über das Display-Modul

