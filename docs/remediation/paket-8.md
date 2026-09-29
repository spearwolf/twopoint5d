# Paket 8 — Drain: Event-Konstanten für Stages und PanControl2D, Projektions-Demo

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-063 (low), DOC-009 (low) · TEST-047 (low) gegenstandslos, behoben und gebucht in Paket 4 (`abf84d48`), kein Schritt
- Ziel: Die Events der Stage-Klassen und von PanControl2D sind als typisierte Konstanten exportiert, und das Lookbook zeigt dieselbe Szene unter beiden Projektionen samt fit-Modi.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - Bibliothek: `packages/twopoint5d/src/events.ts`, `src/stage/Stage2D.ts`, `src/stage/StageRenderer.ts`, `src/stage/Canvas2DStage.ts`, `src/controls/PanControl2D.ts`
  - Specs: `src/stage/Stage2D.spec.ts`, `src/stage/StageRenderer.spec.ts`, `src/stage/Canvas2DStage.spec.ts`, `src/controls/PanControl2D.spec.ts`
  - Doku: `packages/twopoint5d/src/stage/README.md`, `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]` → `### Added`, kein Migration Guide)
  - Lookbook: neu `apps/lookbook/src/pages/demos/stage-projections.astro` und `apps/lookbook/src/pages/demos/_stage-projections.json`, `apps/lookbook/README.md` (Anzahl der Demos)
  - nicht: `packages/twopoint5d-testing/test/*.test.js` (Grund unten), `packages/twopoint5d/src/display/**`, `src/texture/**`
- Verify: `pnpm run ci`
- Commit: `feat: export the events of Stage2D, StageRenderer, Canvas2DStage and PanControl2D as named constants with typed payloads, add onUpdate(), onHideCursor() and onRestoreCursor() to PanControl2D, and add a lookbook demo that shows one scene under both projections and switches their fit`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · API-063 unverändert, Fundstellen gewandert: `Stage2D.ts:442` (Audit `:391`), `Canvas2DStage.ts:217`, `:223`, `:245`, `:289` (Audit `:177-227`), `PanControl2D.ts:468`, `:513`, `:576` (Audit `:406`, `:451`, `:514`); dazu `StageRenderer.ts:1022`, `:1134` (das `dispose`-Event aus Paket 3, gleiche Ursache) und `Canvas2DStage.ts:289` (`dispose`, gleiche Ursache) · DOC-009 unverändert (16 Lookbook-Seiten, keine zeigt beide Projektionen oder schaltet `fit`) · TEST-047 gegenstandslos: `packages/twopoint5d-testing/test/stage-canvas2d.test.js` (Paket 4, `abf84d48`) rendert `Canvas2DStage` in ein `RenderTarget` und liest per `rgbAt` zurück (drei Fälle), `stage-pipeline.test.js:330-373` (und `:394`, `:430`, `:543`, `:611`, `:691`, `:728`) tut dasselbe mit einer `Stage2D` unter `OrthographicProjection` · Folgen von Paket 7: keine · Queue: API-063 in dieses Paket (Drain-Zuteilung), TEST-042 bleibt beim Abschluss, `Display.ts` bleibt `→ Audit`
  - 2026-09-29 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-8.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG_MIT_VORBEHALT (Dateien nur teilweise gelesen; zwei Abweichungen: TSDoc/Test von `onUpdate()` nach `dispose()`, Default-Import `GUI`) · 12 Dateien geändert, 2 neu (`stage-projections.astro`, `_stage-projections.json`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-8.verify.log`)
  - 2026-09-29 Zug 3: Reviewer (sonnet, effort medium) — API-063 behoben, DOC-009 behoben, TEST-047 gegenstandslos bestätigt, beide Abweichungen berechtigt; kritisch 0, wichtig 0, klein 4 · Diff `paket-8.diff`, Report `paket-8.review-0.json`
  - 2026-09-29 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-29 Zug 5: committet `ffd22adc` auf `main` (Verify aus Zug 2, seither keine Codeänderung), Pre-Commit-Hooks grün

## Abgleich

**API-063 — unverändert, Fundstellen gewandert, um zwei Stellen gleicher Ursache ergänzt.**
Heute emittieren als nackte Strings:

| Stelle | Event | Payload |
| --- | --- | --- |
| `packages/twopoint5d/src/stage/Stage2D.ts:442` | `'dispose'` (`emitStrict`) | die Stage |
| `packages/twopoint5d/src/stage/StageRenderer.ts:1022` | `'dispose'` (`emitStrict`) | der Renderer |
| `packages/twopoint5d/src/stage/StageRenderer.ts:1134` | `on(stage, 'dispose', …)` — das Abo, mit dem ein Renderer eine Stage beim Dispose austrägt | — |
| `packages/twopoint5d/src/stage/Canvas2DStage.ts:217`, `:223` über `dispatchEvent()` `:244-246` | `'resize'`, `'render'` (`emit`) | die Canvas2DStage |
| `packages/twopoint5d/src/stage/Canvas2DStage.ts:289` | `'dispose'` (`emitStrict`) | die Canvas2DStage |
| `packages/twopoint5d/src/controls/PanControl2D.ts:468` | `'update'` (`emit`) | `{x, y}`, je Emit ein neues Objekt |
| `packages/twopoint5d/src/controls/PanControl2D.ts:513` | `'hideCursor'` (`emit`) | das Control |
| `packages/twopoint5d/src/controls/PanControl2D.ts:576` | `'restoreCursor'` (`emit`) | das Control |

`StageRenderer.ts:1022`/`:1134` gab es beim Audit noch nicht (Paket 3, `8614c309`, hat das
`dispose`-Event des Renderers eingeführt, im Stil des vorbestehenden `Stage2D`-Events);
`Canvas2DStage.ts:289` nennt das Audit nicht, es ist dasselbe Muster. Gleiche Ursache — nackter
String statt Konstante —, beide ins Paket. Sonst emittiert in `src/` nichts mehr per String-Literal
(`grep -rn "emit\w*(this, *'" src` trifft genau die sechs Emit-Stellen oben). `TextureResource`
führt eigene Konstanten in `src/texture/TextureResource.ts` und ist nicht betroffen.

Aufrufer, die per String abonnieren: nur Specs (`Stage2D.spec.ts:681`, `:684`, `:801`;
`StageRenderer.spec.ts:737`, `:2476`, `:2484`, `:2492`, `:2505`, `:2508`; `Canvas2DStage.spec.ts:41`,
`:42`, `:49`, `:375`, `:378`, `:395`; `PanControl2D.spec.ts:301`) und Browser-Tests
(`pan-control-input.test.js:77`, `:110`, `:131`, `:153`, `:173`; `pan-control-cursor.test.js:82`;
`pan-control-dispose.test.js:113`; `pan-control-switch-off.test.js:47`). Lookbook und Markdown-Doku
abonnieren keines dieser Events per String (`stage/README.md:573` ist das eigene Event-System eines
Beispiel-Hosts, nicht betroffen).

**DOC-009 — unverändert.** `apps/lookbook/src/pages/demos/` hat 16 Demo-Seiten. Die Stage-Demos
(`stage-postprocessing`, `stage-nested-pipelines`, `display-minimal`, `display-multi`) nutzen alle
`ParallaxProjection`, `quadtree-playground` nutzt `OrthographicProjection` über `Canvas2DStage`;
keine zeigt beide nebeneinander, keine schaltet `fit` um.

**TEST-047 — gegenstandslos.** Die Canvas2DStage-Hälfte ist `stage-canvas2d.test.js` aus Paket 4
(`abf84d48`): `Canvas2DStage` zeichnet in ein 64×64-`RenderTarget`, `rgbAt()` aus
`test/helpers/fixtures.js` liest das Mittelpixel, drei Fälle (erster `render()`, Upload gleicher
Größe, neue Textur bei neuer Größe). Die Orthographic-Hälfte war schon in Paket 4 gegenstandslos:
`stage-pipeline.test.js:330-373` rendert eine `Stage2D` unter `OrthographicProjection('xy|bottom-left')`
in ein `RenderTarget` und liest per `rgbAt()` zurück, dazu sechs weitere Tests derselben Datei.
Die Plan-Zeile von Paket 4 bucht TEST-047 als behoben; hier kein Schritt.

## Entscheidungen dieses Detailplans

1. **Werte der Konstanten bleiben die Strings, die heute emittiert werden.** Die Änderung ist rein
   additiv: wer per String abonniert, hört weiter mit — kein Breaking Change, kein Migration-Guide-
   Eintrag. Ein anderer Wert (etwa `'stageDispose'`) bräche jeden bestehenden Abonnenten und das
   Protokoll, mit dem ein `StageRenderer` jede eventisierte Stage beim `dispose` austrägt, auch
   fremde `IStage`-Implementierungen, die die README (`stage/README.md:533-537`) dazu anleitet.
2. **Namen nach dem Muster, das `events.ts` hat:** `On<Klasse><Event>` wie `OnDisplayDispose`, die
   Interfaces ohne `On` wie die Stage-Interfaces aus Paket 2 (`IStageAfterSceneChanged`), Payload-
   Objekte als `<Klasse><Event>Props` wie `StageResizeProps`.
3. **Ein `OnStageDispose` für `Stage2D` und `StageRenderer`, ein eigenes `OnCanvas2DStageDispose`.**
   `Stage2D` und `StageRenderer` sind beide `IStage`, und das `dispose`-Event ist das Protokoll, auf
   das `StageRenderer#add()` bei jeder gehaltenen Stage hört (`StageRenderer.ts:1134`) — eine Konstante
   für dieses eine Protokoll, Payload `IStage`. `Canvas2DStage` ist keine `IStage`, ihr Payload ist die
   `Canvas2DStage`; sie bekommt ihre eigene Konstante wie `Display` (`OnDisplayDispose`) — gleicher
   Wert `'dispose'`, anderer Payload-Typ.
4. **`on*()`-Helfer nur an `PanControl2D`.** Die Empfehlung des Audits nennt sie nur dort, und die
   Stage-Klassen haben für keins ihrer Events einen (`OnStageUpdateFrame` wird per `on(stage, …)`
   abonniert). Form wie an `Display` (`Display.ts:2046-2095`): `readonly`-Arrow-Felder, die ein
   `UnsubscribeFunc` zurückgeben.
5. **Browser-Tests bleiben, wie sie sind.** Sie sind JavaScript, eine Konstante brächte dort keine
   Typprüfung; und sie abonnieren per String — damit bleibt im Gate belegt, dass die Strings weiter
   tragen (Entscheidung 1). Die Vitest-Specs sind TypeScript und ziehen auf die Konstanten um.
6. **Demo mit zwei Displays nebeneinander statt einer Umschaltung der Projektion.** Der Vergleich
   „dieselbe Szene unter beiden Projektionen“ ist nebeneinander direkt sichtbar; Parallaxe zeigt sich
   erst, wenn sich etwas bewegt, deshalb bewegt sich die Szene. Beide Projektionen bekommen **ein**
   gemeinsames Specs-Objekt — die Projektionen behalten das übergebene Objekt (`viewSpecs`), ein
   Schreiben von `fit` trifft beide, `needsUpdate = true` an beiden Stages wendet es im nächsten
   Frame an (der Weg, den die TSDoc von `Stage2D#needsUpdate` beschreibt). Das Durchschalten läuft
   über lil-gui wie in `quadtree-playground.astro` (lil-gui steht schon in den Dependencies).
7. **CHANGELOG nennt die Demo**, wie die Bibliothek frühere Lookbook-Demos gebucht hat
   (`CHANGELOG.md:3582-3583`, `[0.21.0]`).

## Vorgehen

Zuerst `packages/twopoint5d/src/events.ts`, `Stage2D.ts`, `StageRenderer.ts` (ab `:960` bis
`:1175`), `Canvas2DStage.ts`, `PanControl2D.ts` und `Display.ts:2040-2096` lesen. Skill
`using-eventize` für `on`/`emit`/`emitStrict`/`UnsubscribeFunc`.

### API-063 — Konstanten und Payload-Typen

1. **`packages/twopoint5d/src/events.ts`** — zwei Type-Imports ergänzen (alphabetisch nach Pfad
   einsortiert wie die bestehenden):

   ```ts
   import type {PanControl2D} from './controls/PanControl2D.js';
   import type {Canvas2DStage} from './stage/Canvas2DStage.js';
   ```

   Direkt nach dem Block `OnStageAfterSceneChanged` (vor der Trennlinie zu `OnAddToParent`) einen
   neuen, durch `// ----…` abgetrennten Block:

   ```ts
   /**
    * Emitted once by `dispose()` of a `Stage2D` and of a `StageRenderer`, with the stage itself,
    * before the stage stops listening. A `StageRenderer` listens for it on every eventized stage it
    * holds and takes that stage out; a stage of your own that emits it from its `dispose()` gets the
    * same treatment.
    */
   export const OnStageDispose = 'dispose';

   export interface IStageDispose {
     [OnStageDispose](stage: IStage): void;
   }
   ```

   Ans Ende der Datei, je durch `// ----…` abgetrennt:

   ```ts
   /**
    * Emitted by `Canvas2DStage#render()`, with the stage, when the canvas has another size than at
    * the previous `render()`; the first `render()` counts as a change.
    */
   export const OnCanvas2DStageResize = 'resize';
   /**
    * Emitted by every `Canvas2DStage#render()`, with the stage, before the canvas is uploaded: the
    * moment to draw into the canvas and set `needsUpdate`.
    */
   export const OnCanvas2DStageRender = 'render';
   /** Emitted once by `Canvas2DStage#dispose()`, with the stage, before it stops listening. */
   export const OnCanvas2DStageDispose = 'dispose';

   export interface ICanvas2DStageResize {
     [OnCanvas2DStageResize](stage: Canvas2DStage): void;
   }

   export interface ICanvas2DStageRender {
     [OnCanvas2DStageRender](stage: Canvas2DStage): void;
   }

   export interface ICanvas2DStageDispose {
     [OnCanvas2DStageDispose](stage: Canvas2DStage): void;
   }
   ```

   ```ts
   /**
    * Emitted by `PanControl2D#update()` when the call moved the view, and on the first call after a
    * state was assigned to `panView`, whether it moved or not.
    */
   export const OnPanControl2DUpdate = 'update';
   /**
    * Emitted by `PanControl2D`, with the control, when a mouse drag with the pan button starts to move
    * and the control hides the cursor.
    */
   export const OnPanControl2DHideCursor = 'hideCursor';
   /**
    * Emitted by `PanControl2D`, with the control, when a cursor it hid comes back — the pan button
    * goes up, the browser cancels the pointer, the pointer is switched off, the control unsubscribes
    * or is disposed. A cursor it never hid is not reported.
    */
   export const OnPanControl2DRestoreCursor = 'restoreCursor';

   /** Where `PanControl2D#update()` moved the view to: a new object for every event, the listener may keep it. */
   export interface PanControl2DUpdateProps {
     x: number;
     y: number;
   }

   export interface IPanControl2DUpdate {
     [OnPanControl2DUpdate](props: PanControl2DUpdateProps): void;
   }

   export interface IPanControl2DHideCursor {
     [OnPanControl2DHideCursor](control: PanControl2D): void;
   }

   export interface IPanControl2DRestoreCursor {
     [OnPanControl2DRestoreCursor](control: PanControl2D): void;
   }
   ```

   `events.ts` wird per `export * from './events.js'` in `src/index.ts` veröffentlicht; kein Eintrag
   in einem `public-api.ts` nötig. Die TSDoc-Sätze oben sind so zu übernehmen; vorher gegen den Code
   prüfen (`Canvas2DStage.ts:216-223`, `PanControl2D.ts:465-469`, `:508-514`, `:562-577`), und wo der
   Code etwas anderes tut, gilt der Code und der Satz wird angepasst — das Verhalten ändert sich in
   diesem Paket nicht.

2. **`Stage2D.ts`** — `OnStageDispose` zu den Imports aus `'../events.js'`;
   `:442` → `emitStrict(this, OnStageDispose, this);`. TSDoc `:417` und `:429-430`: statt »the
   `dispose` event« heißt es »`OnStageDispose`« (z. B. »takes it out itself on `OnStageDispose`
   below«, »`OnStageDispose` goes out to every subscriber …«, »A listener of `OnStageDispose` that
   throws …«).

3. **`StageRenderer.ts`** — `OnStageDispose` zu den Imports; `:1022` →
   `emitStrict(this, OnStageDispose, this);`, `:1134` → `on(stage, OnStageDispose, () => {`. TSDoc
   `:977`, `:1059`, `:1092`, `:1157` nennen das Event `OnStageDispose` statt `dispose`/»its
   `dispose`«. Kommentar `:1011` bleibt (er spricht von `OnRemoveFromParent`).

4. **`Canvas2DStage.ts`** — Import `{OnCanvas2DStageDispose, OnCanvas2DStageRender, OnCanvas2DStageResize}`
   aus `'../events.js'`. `:217` → `this.dispatchEvent(OnCanvas2DStageResize);`, `:223` →
   `this.dispatchEvent(OnCanvas2DStageRender);`, `:244` → Signatur
   `private dispatchEvent(eventName: typeof OnCanvas2DStageResize | typeof OnCanvas2DStageRender): void`
   (Methode bleibt, sie ist `private` und steht in der `.d.ts`), `:289` →
   `emitStrict(this, OnCanvas2DStageDispose, this);`. TSDoc von `render()` `:198-200`: »the
   `OnCanvas2DStageResize` event if …, `OnCanvas2DStageRender` — the moment …«. TSDoc von `dispose()`
   `:272-279`: »`OnCanvas2DStageDispose` goes out to every subscriber …«, »A listener of
   `OnCanvas2DStageDispose` that throws …«, »That holds for the `OnStageDispose` listeners of the
   {@link StageRenderer} and the {@link Stage2D} as well.« Die Fehlermeldung `:319` bleibt wörtlich.

5. **`PanControl2D.ts`** — Imports: `{emit, type EventizedObject, eventize, off, on, type UnsubscribeFunc}`
   aus `'@spearwolf/eventize'`, dazu aus `'../events.js'`
   `{OnPanControl2DHideCursor, OnPanControl2DRestoreCursor, OnPanControl2DUpdate, type PanControl2DUpdateProps}`.
   `:468` → `emit(this, OnPanControl2DUpdate, {x: this.panView.x, y: this.panView.y} satisfies PanControl2DUpdateProps);`,
   `:513` → `emit(this, OnPanControl2DHideCursor, this);`, `:576` →
   `emit(this, OnPanControl2DRestoreCursor, this);`. TSDoc `:351` und `:438` (»emits `update`«) →
   »emits `OnPanControl2DUpdate`«, `:692` (»emits one last `restoreCursor`«) → »emits one last
   `OnPanControl2DRestoreCursor`«; die Kommentare `:564-566`, `:701`, `:713` sagen `hideCursor`/
   `restoreCursor` als Bezeichnung des Vorgangs und bleiben.

   Am Ende der Klasse, nach `dispose()`, die drei Helfer in der Form von `Display.ts:2046-2095`:

   ```ts
   /**
    * Subscribes `listener` to `OnPanControl2DUpdate`: the position {@link update} moved the view to.
    * Returns the function that takes the listener off again. A listener attached after
    * {@link dispose} is never called.
    */
   readonly onUpdate = (listener: (props: PanControl2DUpdateProps) => unknown): UnsubscribeFunc =>
     on(this, OnPanControl2DUpdate, listener);

   /**
    * Subscribes `listener` to `OnPanControl2DHideCursor`: a mouse drag with the pan button started to
    * move, and the control hid the cursor. Returns the function that takes the listener off again.
    */
   readonly onHideCursor = (listener: (control: PanControl2D) => unknown): UnsubscribeFunc =>
     on(this, OnPanControl2DHideCursor, listener);

   /**
    * Subscribes `listener` to `OnPanControl2DRestoreCursor`: a cursor this control hid came back.
    * Returns the function that takes the listener off again. {@link dispose} of a control that is
    * hiding the cursor emits it one last time; a listener attached after that is never called.
    */
   readonly onRestoreCursor = (listener: (control: PanControl2D) => unknown): UnsubscribeFunc =>
     on(this, OnPanControl2DRestoreCursor, listener);
   ```

   Namenskonflikt prüfen: `InputControlBase` hat keine Glieder `onUpdate`/`onHideCursor`/
   `onRestoreCursor` (Stand: `addEventListener`, `removeEventListener`, `isActive`, `subscribe`,
   `unsubscribe`, `isDisposed`, `destroyAllListeners`, `dispose`).

### API-063 — Specs

6. **Vitest-Specs auf die Konstanten umstellen** — jede Stelle aus der Tabelle unter »Abgleich«
   (`Stage2D.spec.ts:681`, `:684`, `:801`; `StageRenderer.spec.ts:737`, `:2476`, `:2484`, `:2492`,
   `:2505`, `:2508`; `Canvas2DStage.spec.ts:41`, `:42`, `:49`, `:375`, `:378`, `:395`;
   `PanControl2D.spec.ts:301`) abonniert bzw. emittiert per Konstante statt String. `sandbox.spy(x, 'dispose')`
   und Ähnliches nennt eine Methode, kein Event, und bleibt. Keine Assertion ändert ihre Erwartung.

7. **Neue Tests** (Namen so übernehmen; sie sichern neue Oberfläche, kein Bugfix — laufen nach der
   Umsetzung grün, ein roter Lauf vorher ist nicht gefordert):
   - `Stage2D.spec.ts`, im `describe('dispose()')` (`:651`): `'announces its dispose to a listener of IStageDispose with the stage'` —
     `const heard = vi.fn(); const listener: IStageDispose = {[OnStageDispose]: heard}; on(stage, listener); stage.dispose();`
     → `heard` genau einmal mit `stage` aufgerufen.
   - `StageRenderer.spec.ts`, im `describe('dispose()')` (`:2347`): `'announces its dispose to a listener of IStageDispose with the renderer'` — dasselbe
     Muster mit dem Renderer.
   - `Canvas2DStage.spec.ts`: `'emits OnCanvas2DStageResize before OnCanvas2DStageRender on the first render(), each with the stage'` —
     beide über ein Listener-Objekt, das `ICanvas2DStageResize & ICanvas2DStageRender` erfüllt, in ein
     gemeinsames Log aus `[eventName, payload]`-Paaren; nach `stage.render()` ist das Log
     `[['resize', stage], ['render', stage]]`, ein zweiter `render()` ohne Größenwechsel fügt nur
     `['render', stage]` an.
   - `Canvas2DStage.spec.ts`: `'announces its dispose to a listener of ICanvas2DStageDispose with the stage'`.
   - `PanControl2D.spec.ts`, neues `describe('on…() shorthands')`:
     - `'onUpdate() hears where update() moved the view, until the function it returns takes it off'` —
       `const seen: PanControl2DUpdateProps[] = []; const off = control.onUpdate((props) => seen.push(props));`
       `control.update(0)` (erstes Update meldet die Startposition), `off()`, `control.speedEast = 10; control.update(1);`
       → `seen` hat genau einen Eintrag `{x: 0, y: 0}`.
     - `'onHideCursor() and onRestoreCursor() hear a drag that hides the cursor and gives it back, with the control'` —
       mit den Pointer-Hilfen der Spec (`drag()` und `pointer()`, `PanControl2D.spec.ts:61-78`):
       `drag(1)` → `onHideCursor`-Listener einmal mit `control`, `onRestoreCursor`-Listener noch nicht;
       `pointer('pointerup', {buttons: 0})` → `onRestoreCursor`-Listener einmal mit `control`.
     - `'a listener added through onUpdate() after dispose() hears nothing'` — `control.dispose()`,
       dann `onUpdate(spy)`, `control.panView = {x: 1, y: 1}`, `control.update(0)` → `spy` nicht aufgerufen.
   - Die neuen Typen aus `'../events.js'` importieren (`import {…, type IStageDispose} …`), die Specs
     laufen durch `pnpm typecheck` — das ist die Typprüfung der Interfaces.

### API-063 — Doku

8. **`packages/twopoint5d/src/stage/README.md`**:
   - `:533-537`: »an eventized stage (`eventize(this)` from `@spearwolf/eventize`) that emits
     `OnStageDispose` (`'dispose'`) in its `dispose()`, as `Stage2D` does.«
   - Abschnitt »Events you can subscribe to« (`:541-558`): unter »On `StageRenderer`« `:547` →
     »`OnStageDispose` — once, from `dispose()`, before the renderer stops listening.«; unter »On
     `Stage2D`« einen Punkt »`OnStageDispose` — once, from `dispose()`, before the stage stops
     listening; every `StageRenderer` that holds the stage takes it out on it.«; danach neu:

     ```markdown
     On `Canvas2DStage`:

     - `OnCanvas2DStageResize` — from `render()`, when the canvas has another size than at the
       previous `render()`, the first `render()` included.
     - `OnCanvas2DStageRender` — from every `render()`, before the canvas is uploaded: draw into the
       canvas here and set `needsUpdate`.
     - `OnCanvas2DStageDispose` — once, from `dispose()`, before the stage stops listening.
     ```

     Der Satz »All event names are exported from `@spearwolf/twopoint5d`.« bleibt am Ende.
   - `:601`, `:633`, `:691`: »A `dispose` event« / »its `dispose` event« / »emits no `dispose` event« →
     `OnStageDispose` (»An `OnStageDispose` goes out …«, »on its `OnStageDispose`«, »emits no
     `OnStageDispose`«). Umbruch der Absätze auf die Zeilenbreite des Abschnitts nachziehen.
   - `docs/resource-lifecycle.md` spricht allgemein von »the dispose event« und bleibt.

9. **`packages/twopoint5d/CHANGELOG.md`**, `## [Unreleased]` → `### Added`, ans Ende der Liste
   (Skill `updating-changelog`), zwei Einträge im Ton der Nachbarn:
   - »export the event names of `Stage2D`, `StageRenderer`, `Canvas2DStage` and `PanControl2D` as
     constants with an interface for their payload, as the other events of the library have them:
     `OnStageDispose` (`IStageDispose`) for the `dispose` event of `Stage2D` and `StageRenderer`,
     `OnCanvas2DStageResize`, `OnCanvas2DStageRender` and `OnCanvas2DStageDispose` (`ICanvas2DStageResize`,
     `ICanvas2DStageRender`, `ICanvas2DStageDispose`), `OnPanControl2DUpdate`, `OnPanControl2DHideCursor`
     and `OnPanControl2DRestoreCursor` (`IPanControl2DUpdate`, `IPanControl2DHideCursor`,
     `IPanControl2DRestoreCursor`) with `PanControl2DUpdateProps`. The values are the event names the
     classes emit, so a subscription by name keeps working. Add `PanControl2D#onUpdate()`,
     `#onHideCursor()` and `#onRestoreCursor()`: each subscribes a listener to its event and returns
     the function that takes it off again«
   - »add lookbook demo `stage-projections.astro` — one scene under `OrthographicProjection` and
     `ParallaxProjection` side by side, moving so the parallax shows, with the `fit` of both switched
     in one place«

   Kein Migration-Guide-Eintrag: nichts bricht (Entscheidung 1).

### DOC-009 — Lookbook-Demo

10. **`apps/lookbook/src/pages/demos/_stage-projections.json`**:

    ```json
    {
      "title": "stage projections",
      "description": "The same scene under an `OrthographicProjection` and a `ParallaxProjection` side by side, with the `fit` of both switched in one place",
      "url": "/demos/stage-projections",
      "tags": ["Display", "OrthographicProjection", "ParallaxProjection", "Stage2D", "StageRenderer", "vanilla"]
    }
    ```

    Kein `previewImage` (wie `_stage-postprocessing.json`; `Card.astro` nimmt dann das Standardbild).

11. **`apps/lookbook/src/pages/demos/stage-projections.astro`** — Aufbau wie
    `stage-postprocessing.astro` (Layout `~layouts/VanillaDemo.astro` als `Layout`, `title`/`description`
    aus der JSON), Markup und Styles für zwei Spalten nach dem Muster von `display-multi.astro`
    (Wrapper `<div class="pt-[28px] h-full">`, Grid, je Zelle ein Container-`div`, auf dem der
    `Display` sein Canvas anlegt, und eine Beschriftung unten in der Zelle: `OrthographicProjection`
    links, `ParallaxProjection` rechts). Script:
    - Imports: `on` aus `@spearwolf/eventize`; `Display`, `OnStageUpdateFrame`, `OrthographicProjection`,
      `ParallaxProjection`, `Stage2D`, `StageRenderer`, `TextureFactory`, `type StageUpdateFrameProps`
      aus `@spearwolf/twopoint5d`; `Color`, `EdgesGeometry`, `Group`, `LineBasicMaterial`,
      `LineSegments`, `PlaneGeometry`, `Sprite`, `SpriteMaterial` aus `three/webgpu`; `GUI` aus `lil-gui`;
      `assetsUrl` aus `~demos/utils/assetsUrl`.
    - **Ein** Specs-Objekt für beide Projektionen:
      `const specs: {fit: 'contain' | 'cover' | 'fill'; width: number; height: number; distanceToProjectionPlane: number} = {fit: 'contain', width: 800, height: 600, distanceToProjectionPlane: 300};`
      `distanceToProjectionPlane: 300` für beide: die orthografische Kamera stünde sonst bei `100` und
      schnitte die nahe Ebene bei `z = 150` ab. Nimmt `astro check` das Objekt für einen der beiden
      Konstruktoren nicht an, bekommt es den Typ `Partial<ParallaxProjectionSpecs>` (Import `type
      ParallaxProjectionSpecs`), und der `fit`-Handler schreibt weiter in dieses eine Objekt — zwei
      Objekte sind keine Lösung, die Demo zeigt ja gerade, dass beide dieselben Specs lesen.
    - Je Zelle (Funktion `setupPane(container: HTMLElement, projection: OrthographicProjection | ParallaxProjection): Stage2D`,
      zweimal aufgerufen mit `new OrthographicProjection('xy|bottom-left', specs)` und
      `new ParallaxProjection('xy|bottom-left', specs)`):
      - `const display = new Display(container);`,
        `const stage = new Stage2D(projection);`,
        `const stageRenderer = new StageRenderer(display).setClearColor(new Color('#0a0a1f'), 1).add(stage);`
      - Rahmen des 800×600-Rechtecks der Specs bei `z = 0`:
        `new LineSegments(new EdgesGeometry(new PlaneGeometry(800, 600)), new LineBasicMaterial({color: '#ffd166'}))`
        — Linien verdecken nichts, der Rahmen zeigt, wie `contain`, `cover` und `fill` das Rechteck in
        die Zelle legen.
      - Drei Ebenen in einer `Group` `layers`: `z = -150` (fern, Tönung `#118ab2`), `z = 0` (`#06d6a0`),
        `z = 150` (nah, `#ef476f`); je Ebene ein Raster aus 5 × 3 Sprites bei `x ∈ {-320, -160, 0, 160, 320}`,
        `y ∈ {-180, 0, 180}`, `sprite.scale.set(60, 60, 1)`, ein `SpriteMaterial({map, color})` je Ebene,
        eine Textur je Display: `new TextureFactory(display.renderer, ['nearest', 'srgb', 'flipy']).load(assetsUrl('skinball-256.png'))`.
      - Bewegung: `on(stage, OnStageUpdateFrame, ({now}: StageUpdateFrameProps) => { layers.position.x = Math.sin(now * 0.5) * 120; });`
        — unter `ParallaxProjection` wandert die nahe Ebene weiter als die ferne, unter
        `OrthographicProjection` alle gleich.
      - `display.onDispose(() => { … })` gibt frei, was die Zelle gebaut hat: `stageRenderer.dispose()`,
        `stage.dispose()`, Geometrien, Materialien, Textur (Muster `display-multi.astro:107-114`).
      - `display.start();`
    - lil-gui: `const gui = new GUI({title: 'stage projections'});`
      `gui.add(specs, 'fit', ['contain', 'cover', 'fill']).onChange(() => { for (const stage of stages) stage.needsUpdate = true; });`
      mit `const stages = [setupPane(…), setupPane(…)];`.
    - Kein `(window as any)`-Export, keine `console.log`.

12. **`apps/lookbook/README.md`** — die Zahl der Demos von 16 auf 17: `:3`, `:17`, `:18`, `:28`.

13. **Sichtprüfung der Demo**: nach `pnpm build` den Dev-Server `pnpm lookbook` starten, die Seite
    `http://localhost:4321/lookbook/demos/stage-projections` per Playwright-MCP öffnen, einen Screenshot
    nehmen und `fit` einmal auf `cover` und `fill` schalten: beide Zellen zeigen den Rahmen und drei
    Ebenen, links gleich große Sprites, rechts nah größer als fern, der Rahmen folgt dem `fit`. Ergebnis
    in einem Satz in den Report; ist Playwright nicht erreichbar oder zeigt das Canvas nichts (kein
    GPU-Backend im Headless-Browser), steht genau das im Report. Den Dev-Server danach beenden.

### Abschluss der Umsetzung

14. `pnpm format`, dann `pnpm run ci` (Verify). `scripts/lookbook/demoMetadata.test.mjs` prüft Tags,
    Paarung und Route der neuen Demo, `astro check` die Seite, `checkNameableTypes` die neuen Typen.

## Findings im Volltext

**API-063 · low · packages/twopoint5d/src/stage/Stage2D.ts:391** (dazu `Canvas2DStage.ts:177-227`,
`PanControl2D.ts:406`, `:451`, `:514`) — Stage-, Canvas2DStage- und PanControl2D-Events als Konstanten
mit Payload-Typ exportieren
Die übrigen Events der Library stehen als `On*`-Konstanten mit Interface in `events.ts`. `Stage2D`
(`dispose`), `Canvas2DStage` (`resize`, `render`) und `PanControl2D` (`update`, `hideCursor`,
`restoreCursor`) emittieren dagegen nackte Strings. Ein Tippfehler beim Abonnieren wird so kein
Compilerfehler, und die Payloads sind nicht typisiert.
Empfehlung: Konstanten und Interfaces in `events.ts` ergänzen, für `PanControl2D` zusätzlich typisierte
`on*()`-Helfer analog zu `Display`.
Entscheidung des Nutzers (2026-09-29, »Entscheidungen« im Plan): vollständig, einschließlich
PanControl2D; das Finding wird nicht gespalten.

**DOC-009 · low · apps/lookbook/src/pages/demos/display-minimal.astro** — Keine dedizierte Demo für
Projections
Für `stage/` gibt es `stage-postprocessing` und `stage-nested-pipelines`. Die Projektionen —
Orthographic und Parallax, der Kern der 2.5D-Idee — kommen weiterhin nur nebenbei vor. Re-Check:
unverändert.
Empfehlung: Eine Demo, die dieselbe Szene unter beiden Projektionen zeigt und die `fit`-Modi
durchschaltet.

**TEST-047 · low · packages/twopoint5d-testing/test/** — Kein Browser-Test rendert Canvas2DStage oder
OrthographicProjection und liest ein Pixel zurück
Aufgefallen im Remediation-Lauf vom 2026-09-25. Die Sprite-Materialien haben inzwischen Pixel-Tests
(`sprites-textured-material.test.js`, `sprites-animated-material.test.js`, `sprites-billboard.test.js`).
`Canvas2DStage` und `OrthographicProjection` werden in der Browser-Suite dagegen nie instanziiert und
nie gerendert. Ein kaputter Render-Pfad dort passiert das volle Gate. Das Finding hängt mit TEST-022
zusammen, dort fehlen die Specs der stage-Schicht.
Empfehlung: Je eine Smoke-Datei: Stage mit bekannter Füllung in ein `RenderTarget` rendern und das
Pixel über `renderToPixels`/`rgbAt` aus `test/helpers/fixtures.js` assertieren.
Stand: gegenstandslos, siehe »Abgleich« — behoben in Paket 4 (`abf84d48`).

## Reviewer-Urteil (Zug 3, `paket-8.review-0.json`)

- **API-063 — behoben.** Konstanten und Interfaces in `packages/twopoint5d/src/events.ts:142`, `:167-174`, `:194-205`, Werte = bisherige Strings; Emits über Konstanten in `Stage2D.ts`, `StageRenderer.ts` (Emit und Abo, `:1128`, `:1140`), `Canvas2DStage.ts` (typisiertes `dispatchEvent`, `dispose`), `PanControl2D.ts` (alle drei, `update` mit `satisfies PanControl2DUpdateProps`); `on*()`-Helfer am Klassenende von `PanControl2D`; alle Spec-Stellen umgezogen ohne geänderte Erwartung; README (`stage/README.md:535`, Event-Liste samt `Canvas2DStage`, drei Fließtextstellen) und CHANGELOG `[Unreleased]` → `### Added`; kein weiterer String-Emit oder -Abonnent in `src/`, `docs/`, Lookbook.
- **DOC-009 — behoben.** `apps/lookbook/src/pages/demos/stage-projections.astro` (ein gemeinsames `specs`-Objekt `:114-119`, `fit`-Umschaltung per `needsUpdate` `:190-193`), `_stage-projections.json`, `apps/lookbook/README.md` auf 17, CHANGELOG nennt die Demo.
- **TEST-047 — gegenstandslos bestätigt** (behoben in Paket 4, `abf84d48`).
- **Abweichungen:** `onUpdate()` nach `dispose()` berechtigt — `off(this)` leert nur vorhandene Listener, `update()` emittiert weiter, TSDoc und Test `PanControl2D.spec.ts:342` beschreiben das; `onRestoreCursor()` nach `dispose()` hört nichts (`:354`); Default-Import `GUI` wie `quadtree-playground.astro:27`.
- Sichtprüfung (Schritt 13): der Reviewer sah keinen Beleg; der Report des Implementierers (`paket-8.impl-0.json`) belegt sie — Seite ohne Console-Warnungen, beide Zellen mit Rahmen und drei Ebenen, links gleich große Sprites, rechts nah größer als fern, `cover` und `fill` umgeschaltet, unter `fill` fällt der Rahmen mit dem Zellenrand zusammen.

Kleine Befunde:
- `PanControl2D.ts` (TSDoc bei `panView`, `update()`, `dispose()`), `Canvas2DStage.ts` (TSDoc `render()`, `dispose()`), `StageRenderer.ts` (`#stageSubscriptions`): durch die längeren Konstantennamen über 100 Zeichen gewachsene Zeilen, nicht neu umbrochen.
- `stage/README.md:535`, `:1018` und die drei umgestellten Fließtextstellen: Umbruch nicht auf die Zeilenbreite nachgezogen (Schritt 8 verlangte es).
- `stage-projections.astro:114`: Typannotation von `specs` in einer 120 Zeichen langen Zeile.

Nebenbefund des Implementierers geprüft, kein Befund: `Stage2D.ts:429` »`scene.name` as it always does« (vorbestehend, `6369ae7f`) beschreibt das gewöhnliche Verhalten, keinen Vorzustand — kein Verstoß gegen »Kein Rückblick«.
