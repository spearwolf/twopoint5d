# Paket 1 — stage: Output- und Pass-Nodes invalidieren, Render-Reihenfolge und Projektionen robust machen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-078 (high), BUG-079 (high), BUG-080 (medium), BUG-031 (medium), BUG-081 (low), BUG-082 (low)
- Mitgenommen: zwei vorbestehende Nebenbefunde gleicher Ursache, unten als **N1** und **N2** (Begründung im Abschnitt »Entscheidungen in diesem Paket«)
- Ziel: Wechsel von Pipeline, Output-Builder und Stage-Kamera bauen die Nodes neu, und Projektionen bzw. Stage2D entstehen nie in einem Zustand, der nichts rendert.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts`
  - `packages/twopoint5d/src/stage/OrthographicProjection.ts`
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts`
  - `packages/twopoint5d/src/stage/fitIntoRectangle.ts`
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`, `Stage2D.spec.ts`, `OrthographicProjection.spec.ts`, `ParallaxProjection.spec.ts`, `fitIntoRectangle.spec.ts`, `Canvas2DStage.spec.ts` (nur ein Kommentar)
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(stage): rebuild the output node whenever what it composes changes and give a stage no camera before its container has an area`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · BUG-078 unverändert (`StageRenderer.ts:318-321, 340, 439-443, 481-487`) · BUG-079 unverändert (`Stage2D.ts:79-85, 104-106, 225-230`, `StageRenderer.ts:481-487`; three `PassNode.js:221` hält die Kamera) · BUG-080 unverändert (`Stage2D.ts:90-99, 117-121, 142-176, 180-194`, `fitIntoRectangle.ts:212-219`, `StageRenderer.spec.ts:502-503`) · BUG-031 unverändert (`OrthographicProjection.ts:30-33`, `ParallaxProjection.ts:32-35`) · BUG-081 unverändert (`StageRenderer.ts:408-416, 427-437`) · BUG-082 unverändert (`StageRenderer.ts:155-164, 632-669, 686-697`) · keine offenen Folgen, »Offene Befunde« leer · N1 (`Stage2D.ts:97-106, 131-140`) und N2 (`StageRenderer.ts:644-662`) ins Paket genommen · Restplan unverändert
  - 2026-09-19 Zug 1: Implementierer beauftragt · Modell opus (stärkste Stufe), Effort medium · Report nach `paket-1.impl-1.json` im Arbeitsverzeichnis
  - 2026-09-19 Zug 2: erster Anlauf endete ohne Report (Gate lief im Hintergrund) → Session fortgesetzt als `paket-1.impl-1-versuch-2.json` · Status FERTIG · 14 Dateien geändert (stage/*.ts, 6 Specs, README, CHANGELOG, `stage-pipeline.test.js`) · rote Läufe belegt (22 rot vor dem Fix; N1 nach Schritt 5 rot) · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer opus/medium (`paket-1.review-1.json`) · alle 6 Findings + N1/N2 behoben · 0 kritisch, 0 wichtig, 3 klein · Diff `paket-1.diff` im Arbeitsverzeichnis
  - 2026-09-19 Zug 4: keine Runde nötig (nur kleine Befunde)
  - 2026-09-19 Zug 5: `pnpm run ci` selbst gelaufen, exit=0 (`paket-1.verify.log`) · Commit f1c0e58 · 6 Nebenbefunde in »Offene Befunde«, 2 Folgen unter dem Paket im Plan

## Vorgehen

Für jeden Korrektheitsfehler zuerst den Regressionstest schreiben und rot
laufen sehen (`pnpm nx test twopoint5d -- src/stage/<datei>.spec.ts`), dann
beheben. Die roten Läufe gehören in den Report. Code, Kommentare, Doku und
CHANGELOG auf Englisch; keine Finding-IDs, auch nicht N1/N2. In Code,
Kommentaren, TSDoc und README kein Satz über den Vorzustand (»previously«, »no
longer«, »now«); im CHANGELOG gilt der Test aus »Konventionen« im Plan, und
der Migrationsabschnitt zeigt Code davor/danach wie seine Nachbarn. Die
Kommentartexte unten sind Vorschläge im Ton des Moduls — Inhalt verbindlich,
Wortlaut darf glätten.

### 1. `StageRenderer.ts` — Output-Node bei jedem Wechsel neu bauen (BUG-078)

1. `pipeline`-Setter: nach dem `#disposed`-Guard nur bei Instanzwechsel
   zuweisen und dirty markieren:

   ```ts
   set pipeline(pipeline: RenderPipeline | undefined) {
     if (this.#disposed) return;
     if (this.#pipeline !== pipeline) {
       this.#pipeline = pipeline;
       // a pipeline arrives with an outputNode of its own; the next render writes this renderer's into it
       this.#outputDirty = true;
     }
   }
   ```

   TSDoc am Getter um einen Satz ergänzen: »Assigning a different pipeline
   gives it this renderer's `outputNode` on the next render.«
2. Das öffentliche Feld `buildOutputNode?: StageRendererBuildOutputNode`
   (Zeile 340) wird ein Accessor-Paar über `#buildOutputNode?:
   StageRendererBuildOutputNode`:
   - `get buildOutputNode(): StageRendererBuildOutputNode | undefined`
   - `set buildOutputNode(buildOutputNode: StageRendererBuildOutputNode | undefined)` —
     bei `!==` zuweisen und `this.#outputDirty = true`. **Kein**
     `#disposed`-Guard: das `dispose()`-TSDoc sagt, `buildOutputNode` behält
     seinen Wert und bleibt schreibbar.
   - Das bestehende TSDoc wandert an den Getter und bekommt den Satz:
     »Assigning or clearing it switches between the two pipeline modes; the
     output node is rebuilt on the next render.«
   - Alle internen Lesezugriffe (`#renderToCurrentTarget`, `#renderPipelineComposed`) bleiben über den Getter oder lesen das Feld — gleichgültig.
3. Kommentar an `#outputDirty` (Zeile 346) auf den neuen Umfang: »Marks
   `pipeline.outputNode` as needing a rebuild: the stages, their order or
   names, the pipeline, `buildOutputNode` or the camera of a stage changed.«

### 2. `StageRenderer.ts` — Kamerawechsel einer Stage abonnieren (BUG-079)

Erster Weg der Empfehlung (Event-Abo), kein Versionszähler an `IPassProvider`.

1. Imports: `isEventized` und `on` aus `@spearwolf/eventize` dazunehmen,
   `OnStageAfterCameraChanged` in den Import aus `'../events.js'`.
2. Privates Feld `#cameraSubscriptions = new Map<IStage, () => void>();`
   (Unsubscribe-Handle je Stage). `StageItem` bleibt unverändert — es ist
   öffentlicher Typ.
3. In `add()`, im `!this.hasStage(stage)`-Zweig nach `this.stages.push(si)` und
   vor `this.resizeStage(...)`:

   ```ts
   if (isEventized(stage)) {
     // a pass node keeps the camera it was built with: a stage that announces a new camera
     // needs a new pass node, and with it a new output node
     this.#cameraSubscriptions.set(stage, on(stage, OnStageAfterCameraChanged, () => this.invalidateOutputNode()));
   }
   ```

   `isEventized` statt blindem `on()`: `on()` würde eine nicht eventisierte
   Nutzer-Stage (z. B. ein Plain Object wie `fakeStage()` in den Specs)
   stillschweigend eventisieren.
4. In `remove()`, im `index !== -1`-Zweig direkt nach dem `splice`:
   `this.#cameraSubscriptions.get(stage)?.();` und
   `this.#cameraSubscriptions.delete(stage);`. `dispose()` ruft `remove()` für
   jede Stage und räumt damit alle Abos ab — dort nichts extra.
5. TSDoc von `add()`: Satz ergänzen »On an eventized stage — every `Stage2D` —
   it listens for `OnStageAfterCameraChanged` and rebuilds the output node on
   the next render; `remove()` stops listening.« TSDoc von `remove()`: »Stops
   listening for the stage's camera changes.« Im `dispose()`-TSDoc beim Satz
   über die Listener ergänzen, dass auch die Kamera-Listener auf den Stages
   gehen (über `remove()`).

### 3. `StageRenderer.ts` — komponierter Pfad zeichnet bei 0×0 nichts (Folge von Schritt 5, gehört zu BUG-080)

Nach Schritt 5 hat eine `Stage2D` vor dem ersten `resize()` mit Fläche keine
Kamera, und `Stage2D#asPassNode()` wirft dann. Ohne diesen Schritt würfe ein
`StageRenderer` mit `buildOutputNode` oder `RootRenderPipeline` in einem
0×0-Container (z. B. versteckte Display-Fläche) bei jedem Frame.

1. Erste Zeile von `#renderPipelineComposed`:

   ```ts
   // the stages take their camera from the first resize() with an area, and a Stage2D has no
   // pass node to give before that: while this renderer is 0×0 there is nothing to compose
   if (this.width === 0 || this.height === 0) return;
   ```

   Der Guard steht vor dem Pre-Render verschachtelter Kinder, vor dem Rebuild
   und vor dem Clear; `#outputDirty` bleibt stehen, der erste Frame mit Fläche
   baut.
2. Im TSDoc des `buildOutputNode`-Getters ergänzen: »While this renderer's
   `width` or `height` is 0, the composed mode draws nothing.«
3. **Nur** der komponierte Pfad bekommt den Guard. Plain-Modus und Mode C
   bleiben unberührt (bestehende Specs rendern ohne `resize()`).

### 4. `StageRenderer.ts` — `autoClear` in `finally` (BUG-081)

1. `#renderStagesInline`: die Stage-Schleife in `try { … } finally {
   renderer.autoClear = wasPreviouslyAutoClear; }`; `wasPreviouslyAutoClear`
   und `#applyClear` bleiben davor.
2. `#renderPipelineSimple`: innerhalb des bestehenden `try` die Schleife
   ebenso in ein eigenes `try { … } finally { renderer.autoClear =
   wasPreviouslyAutoClear; }` hüllen.
3. Die README-Zeile »Mid-frame state on the WebGPU renderer« und die
   Clear-Policy-Tabelle **nicht** anfassen — sie gehören zu einem anderen
   Audit-Finding (IMPL-008) außerhalb dieses Laufs.

### 5. `Stage2D.ts` — keine Kamera ohne Fläche, Warnung wieder erreichbar (BUG-080)

1. `#updateProjection`: als allererste Anweisung, **vor** `this.needsUpdate =
   false`:

   ```ts
   // a container without area has no aspect ratio to fit a view into: the stage keeps the
   // camera and the size it has, and creates neither before the first resize() with an area
   if (width === 0 || height === 0) return;
   ```

   Damit baut der Projektions-Setter im Konstruktor (Container 0×0) keine
   Kamera, ein `resize(0, h)`/`resize(w, 0)` lässt eine bestehende Kamera samt
   `width`/`height` stehen, und `OnStageResize` geht nie mit `NaN` hinaus.
2. `updateFrame`-Warnung: modulweite Konstante
   `const FRAMES_WITHOUT_CAMERA_BEFORE_WARNING = 100;`, Felder
   `#framesWithoutCamera = 0;` und `#warnedNoCamera = false;` statt
   `#noCameraErrorCount`. Im `camera == null`-Zweig: wenn noch nicht gewarnt
   und `++this.#framesWithoutCamera >= FRAMES_WITHOUT_CAMERA_BEFORE_WARNING`,
   dann `#warnedNoCamera = true` und genau einmal pro Instanz:

   ```ts
   `Stage2D has had no camera for ${FRAMES_WITHOUT_CAMERA_BEFORE_WARNING} frames and renders nothing: the projection creates one on the first resize() with a width and a height above 0, or assign your own to stage.camera`
   ```

   (`// eslint-disable-next-line no-console` bleibt.)
3. TSDoc am `camera`-Getter ersetzen durch: »The camera this stage renders
   with. The projection creates one on the first `resize()` whose width and
   height are both above 0; until then, and on a stage without a projection,
   it is `undefined`: `renderTo()` draws nothing and `asPassNode()` throws. A
   camera assigned here takes precedence over the projection's. Assigning
   `undefined` hands back to the projection's camera, created on the spot if
   the container already has an area. Every change of the camera emits
   `OnStageAfterCameraChanged` with the camera it replaced.«
4. TSDoc an `renderTo()`: »…until the first `resize()` with an area has
   created the camera from the projection«. TSDoc an `asPassNode()`:
   »Requires `camera` — a `resize()` with an area, or an assigned camera.«

### 6. `Stage2D.ts` — jeder Kamerawechsel wird angekündigt (BUG-079, N1)

1. `projection`-Setter: das Zurücksetzen der Projektionskamera läuft durch
   `#updateCamera`, damit der Wechsel auf »keine Kamera« (Projektion
   `undefined`, oder neue Projektion bei 0×0-Container) ein Event mit der
   wirklich abgelösten Kamera erzeugt:

   ```ts
   set projection(projection: IProjection | undefined) {
     if (this.#projection !== projection) {
       this.#projection = projection;
       // the camera of the previous projection goes first, announced as the camera it was;
       // updateProjection() then announces the new one, if the container has an area for it
       this.#updateCamera(() => {
         this.#cameraFromProjection = undefined;
       });
       this.updateProjection(true);
     }
   }
   ```

   Folge, gewollt: bei einem Projektionswechsel mit Fläche gehen zwei Events
   hinaus (alt → `undefined`, dann `undefined` → neu), jedes mit dem echten
   Vorgänger. Im Konstruktor ist `prevCamera === this.camera === undefined`,
   es geht kein Event hinaus.
2. **N1** — `camera`-Setter: nach dem `#updateCamera(...)`-Aufruf
   `if (this.camera == null) this.updateProjection(true);` mit Kommentar
   »without an override the projection's camera takes over, created now if
   there is none yet«. Grund: eine vor dem ersten `resize()` gesetzte
   Nutzerkamera verhindert, dass die Projektion je eine Kamera baut; wird sie
   bei unveränderter Containergröße auf `undefined` zurückgesetzt, bleibt die
   Stage ohne Kamera, weil `resize()` bei gleicher Größe früh zurückkehrt — das
   bisherige TSDoc (»the next call of resize() will create«) stimmt nicht.

### 7. Projektionen — Default-Spec (BUG-031)

1. `OrthographicProjection` und `ParallaxProjection`, Konstruktor:
   `this.viewSpecs = specs ?? {fit: 'fill'};` mit Kommentar »without specs the
   view is the container itself; specs handed in stay the caller's object, so
   a later write to them reaches the next updateViewRect()«.
   Übergebene Specs **nicht** kopieren oder mergen: `Canvas2DStage` hält das
   Objekt, das es übergibt, und schreibt `width`/`height`/`fit` später hinein
   (`Canvas2DStage.ts:35, 164-165`).
2. TSDoc an beiden Konstruktoren (bisher keins): `@param projectionPlane` —
   the plane the camera looks at; `@param specs` — »How the view fits into the
   container. Defaults to `{fit: 'fill'}`: one view unit per container
   pixel.«
3. Die Projektionsebene bleibt optional ohne Default — ohne Ebene wirft
   `createCamera()` bereits mit Namen (`expectDefined`), das ist kein stiller
   Zustand.

### 8. `fitIntoRectangle.ts` — Rechteck ohne Fläche (BUG-080)

1. Am Anfang des `contain`/`cover`-Zweigs:

   ```ts
   if (rect.width === 0 || rect.height === 0) {
     // a container without area has no aspect ratio to keep, so the view has no area either
     target.set(0, 0);
     return target;
   }
   ```

   Der frühe Return überspringt auch `minPixelZoom`/`maxPixelZoom` (sonst
   `800 / 0 = Infinity` im Clamp).
2. Im TSDoc-Absatz über Teil-Specs ergänzen: »For `contain` and `cover`, a
   `rect` with a width or a height of 0 gives a 0×0 view, and `minPixelZoom`
   and `maxPixelZoom` do not apply to it.« `pixelZoom` und `fill` bleiben
   unverändert (liefern bei 0 keine `NaN`).

### 9. `StageRenderer.ts` — Duplikate und Umbenennungen in `renderOrder` (BUG-082, N2)

1. Privater Helfer `#warnAboutSharedNames(names: Iterable<string>): void`:
   kehrt zurück, solange `this.#renderOrder === '*'`; sonst für jeden
   **verschiedenen** Namen aus `names`, den mindestens zwei Einträge von
   `this.stages` tragen, genau ein `console.warn`:

   ```ts
   `StageRenderer: ${count} stages are named ${JSON.stringify(name)} and renderOrder=${JSON.stringify(this.#renderOrder)} cannot tell them apart; they render in the order they were added. Set unique names on your stages.`
   ```

2. `add()`: die bisherige Inline-Prüfung (Zeilen 690-697) entfällt; nach
   `this.stages.push(si)` `this.#warnAboutSharedNames([stage.name])`.
3. `renderOrder`-Setter: im `!==`-Zweig nach den Invalidierungen und vor
   `this.onRenderOrderChanged()`:
   `this.#warnAboutSharedNames(this.stages.map((item) => item.stage.name));`.
   Eine Zuweisung mit unverändertem Wert bleibt ein No-op.
4. `orderedStages` neu aufbauen; der Default-Zweig (`'*'` bzw. leer →
   `return this.stages`) bleibt:
   - Jeder Eintrag von `this.stages` kommt **höchstens einmal** vor.
   - Alle Stages eines gelisteten Namens stehen an dessen Position, in
     Einfügereihenfolge (nicht nur die erste).
   - **N2:** ein Name, der in `renderOrder` mehrfach steht, zählt an seiner
     ersten Position; ebenso zählt nur das erste `'*'`. Bisher liefert
     `'a,b,a'` die Stage `a` zweimal und `'*,x,*'` den Rest zweimal — sie
     rendern dann zweimal pro Frame.
   - Stages, deren Name nicht gelistet ist, bilden den Rest für `'*'`, in
     Einfügereihenfolge; ohne `'*'` fallen sie weg (bestehendes Verhalten,
     Spec »names missing from renderOrder are dropped«).
   - Algorithmus: `listed = new Set(renderOrderArray ohne '*')`; ein Durchgang
     über `this.stages` verteilt in `Map<string, StageItem[]>` (gelistet) bzw.
     `rest`; ein Durchgang über `renderOrderArray` mit `placed = new
     Set<string>()` und `restPlaced`-Flag hängt an.
   - `expectDefined`-Import entfernen, falls danach ungenutzt.
5. Umbenennung nach `add()`: der Cache prüft sich beim Lesen selbst.
   Privates Feld `#orderedStageNames: string[] = []`, gesetzt zusammen mit
   `#orderedStages` auf `this.stages.map((item) => item.stage.name)`. Am
   Anfang des Getters: ist `#orderedStages` gesetzt und stimmen Länge und
   jeder Name per Index mit `this.stages` überein (Schleife, keine
   Allokation), wird der Cache zurückgegeben; weicht ein Name ab, `#outputDirty
   = true` (die Pass-Reihenfolge kann sich geändert haben) und neu berechnen.
   Kommentar: »a stage name is a plain mutable field: the cache holds the
   names it was built from and rebuilds when one of them moved«.
6. TSDoc am `renderOrder`-Setter: den Satz »Stage `name`s must be unique …
   kicks in.« ersetzen durch »Stages sharing a listed name render together at
   that position, in the order they were added; while `renderOrder` is not
   `'*'`, {@link add} and every write here warn about a shared name. A name or
   `'*'` listed twice counts at its first position. A stage renamed after
   `add()` is sorted under its new name from the next frame on.« TSDoc von
   `add()`: »Warns while `renderOrder` is not `'*'` and another stage already
   carries the same `name`.«

### 10. `README.md` (Stage-Cheat-Sheet)

1. »Render order« (Zeilen 157-158) ersetzen durch den Inhalt von 9.6: geteilte
   Namen rendern gemeinsam an ihrer Position in Einfügereihenfolge; Warnung
   bei `add()` und bei jedem Schreiben von `renderOrder`, solange nicht `'*'`;
   Umbenennung greift ab dem nächsten Frame.
2. Mode D (Zeilen 283-284) ersetzen: »`buildOutputNode` runs again on the next
   render after the stages, `renderOrder`, a stage name, `pipeline` or
   `buildOutputNode` itself changed, after a stage announced a new camera
   through `OnStageAfterCameraChanged` (every `Stage2D` does), or after
   `invalidateOutputNode()`. While the renderer is 0×0 the composed mode draws
   nothing.«
3. »Common pitfalls«:
   - »Stage with no camera yet«: »`Stage2D#renderTo` is a no-op until the
     first `resize()` with a width and a height above 0 creates the camera (or
     you assign your own). `Stage2D#asPassNode` throws in that state, and a
     `StageRenderer` composing pass nodes draws nothing while it is 0×0.«
   - »Non-unique stage names + `renderOrder`«: Stages mit gleichem Namen
     rendern in Einfügereihenfolge an ihrer Position; der Renderer warnt bei
     `add()` und bei jedem `renderOrder`-Write; eindeutige Namen vergeben, wenn
     die Reihenfolge zählt.
   - »Mid-frame state …« **nicht** ändern (siehe 4.3).
4. »Events you can subscribe to« → bei `OnStageAfterCameraChanged` ergänzen:
   »emitted on every camera change with the replaced camera; a `StageRenderer`
   listens to it on each stage it holds«.

### 11. Specs (Vitest)

Jede Spec zuerst rot. Namen verbindlich, Gestaltung frei im Stil der Datei.

`StageRenderer.spec.ts`:

- `describe('pipeline without buildOutputNode (§6.4 Mode C)')`:
  - `it('replacing the pipeline rebuilds the output node')` — zwei
    Pipeline-Mocks; nach dem ersten `renderTo()` den zweiten zuweisen,
    `renderTo()`: zweiter hat `outputNode` definiert, `needsUpdate === true`,
    `render` einmal gerufen.
  - `it('assigning the same pipeline again keeps the output node')`.
  - `it('assigning buildOutputNode after the first frame switches mode')` —
    Stage mit `asPassNode`; Mode C rendern, dann `buildOutputNode = vi.fn(…)`
    zuweisen, `renderTo()`: einmal gerufen, `pipeline.outputNode` ist sein
    Rückgabewert; danach `buildOutputNode = undefined`, `renderTo()`:
    `outputNode` ist nicht mehr dieser Rückgabewert, `needsUpdate === true`.
- `describe('rendering')`:
  - `it('restores autoClear when a stage throws')` — Plain-Modus: Stage wirft,
    `expect(() => sr.renderTo(…)).toThrow()`, danach `renderer.autoClear ===
    true`.
  - `it('restores autoClear and the render target when a stage throws in the pipeline path')` — Mode C, dasselbe plus `__renderTarget` zurück.
  - `it('renders every stage of a listed name, in the order they were added')`
    — `a`, `a` (zweite Instanz), `b`; `renderOrder = 'b,a'` → Aufrufreihenfolge
    `b`, `a`, `a2`.
  - `it('places a name or wildcard listed twice once')` — `renderOrder =
    'a,*,a,*'`: jede Stage genau einmal `renderTo`.
  - `it('sorts a stage renamed after add() under its new name')` — `a`, `b`,
    `renderOrder = 'b,c'`: nur `b`; `a.name = 'c'`, neuer Frame: `b` dann `a`.
- `describe('add / remove')`:
  - `it('warns about a shared name when renderOrder is set after the stages')`
    — `add(a); add(a2); renderOrder = 'a,b'` → `console.warn` genau einmal.
  - Der bestehende Test `warns on duplicate name when renderOrder is non-default` bleibt grün (einmal).
- `describe('asPassNode + buildOutputNode (§6.2 / §6.3)')`:
  - Bestehenden Test `Stage2D.asPassNode requires a camera (throws without projection)` umbauen und umbenennen in `Stage2D.asPassNode requires a camera: none before the first resize() with an area` — nach `stage.projection = …` wirft er weiterhin, nach `stage.resize(100, 100)` nicht.
  - `it('swapping the projection of a Stage2D after the first render rebuilds with a new pass node')` — echte `Stage2D` mit `ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 100})`, `sr.resize(100, 100)`, `add`, Pipeline-Mock, `buildOutputNode = vi.fn((passes) => passes[0])`; `renderTo()`; `stage.projection = new ParallaxProjection(…)`; `renderTo()`: zweiter Aufruf, dessen Pass-Node `!==` dem ersten und `.camera === stage.camera`.
  - `it('assigning a camera to a Stage2D rebuilds the output node')` — `stage.camera = new PerspectiveCamera()` nach dem ersten Render.
  - `it('remove() stops listening to the camera of a stage')` — `getSubscriptionCount(stage)` (aus `@spearwolf/eventize`) nach `remove()` gleich dem Wert vor `add()`.
  - `it('a composing renderer draws nothing while it is 0×0')` — ohne `sr.resize()`, echte `Stage2D` mit Projektion, `buildOutputNode` + Pipeline-Mock: `renderTo()` wirft nicht, `buildOutputNode` und `pipeline.render` nicht gerufen; nach `sr.resize(100, 100)` und `renderTo()` genau einmal.
  - `it('a renamed stage rebuilds the output node')` — Mode D, zwei Stages, `renderOrder` mit beiden Namen, Umbenennung → `buildOutputNode` zweites Mal mit neuer Reihenfolge.

`Stage2D.spec.ts`:

- `it('creates no camera before the first resize() with an area')` — `{fit: 'contain', width: 640}`: nach Konstruktion `camera` `undefined`; `resize(0, 600)`: weiterhin; `resize(800, 600)`: definiert.
- `it('never emits OnStageResize with NaN')` — für `{fit: 'contain', width: 640}` und `{pixelZoom: 2}`: Folge `resize(800, 600)`, `resize(0, 0)`, `resize(0, 600)`, `resize(800, 0)`, `resize(640, 480)`; alle ausgesendeten `width`/`height` sind `Number.isFinite`.
- `it('keeps its camera and size while the container has no area')`.
- `it('warns once when it runs without a camera')` — Stage ohne Projektion, 250× `updateFrame`, `console.warn` genau einmal.
- `it('announces a projection change with the camera it replaced')` — nach `resize(800, 600)`: `cam1`; neue Projektion → erstes Event `[stage, cam1]`, `stage.camera` neu und definiert; `stage.projection = undefined` → Event `[stage, cam2]`, `stage.camera` `undefined`.
- `it('hands back to the projection camera when the assigned one is cleared')` (N1) — `stage.camera = custom` vor dem ersten `resize(800, 600)`; dann `stage.camera = undefined` ohne weiteres `resize()`: `stage.camera` definiert und `!== custom`.

`OrthographicProjection.spec.ts` / `ParallaxProjection.spec.ts`:

- Ortho: `it('starts from an empty spec when built without one')` ersetzen durch `it('fills the container when built without specs')` — `viewSpecs` `toEqual({fit: 'fill'})`, nach `updateViewRect(800, 600)` `getViewRect()` `[800, 600, 1, 1]`; mit `new OrthographicProjection('xy|bottom-left')` gebaute Kamera hat `right - left === 800`, `top - bottom === 600`.
- Parallax: dieselbe Spec neu; Kamera `aspect` `toBeCloseTo(800 / 600)`, `fov` endlich.
- Die beiden `it('without arguments')`-Tests **nicht** anfassen (eigenes Audit-Finding TEST-012 außerhalb dieses Laufs).

`fitIntoRectangle.spec.ts`:

- `it('contain and cover give a 0×0 view for a rect without area')` — Rechtecke `(0, 0)`, `(0, 600)`, `(800, 0)` × Specs `{fit: 'contain', width: 640}`, `{fit: 'cover', height: 480}`, `{fit: 'contain', width: 640, height: 480, maxPixelZoom: 2}` → jeweils `[0, 0]`.

`Canvas2DStage.spec.ts:23`: Kommentar auf den Methodennamen, der die Kamera
bringt: »without a setContainerSize() the Stage2D has no camera …«.

### 12. Browsertest `packages/twopoint5d-testing/test/stage-pipeline.test.js`

Rendering-Code ändert sich, also Browsertest (AGENTS.md):

1. `it('Mode D: swapping the stage projection after the first frame rebuilds the output node through the new camera')` — Aufbau wie der bestehende Mode-D-Test; nach zwei Frames `buildCalls === 1`; `stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 160})`; `await display.nextFrame()`; `buildCalls === 2` und `lastPasses[0].camera === stage.camera`.
2. `it('Mode C: a replaced pipeline takes over the output')` — nach zwei Frames `sr.pipeline = next` (neue `RenderPipeline(display.renderer)`), `next.render` zählen; nach einem Frame `next.outputNode` existiert und `runs > 0`; der Test disposed beide Pipelines selbst (sie gehören ihm).
3. Im bestehenden Mode-D-Test die Assertion-Message »buildOutputNode should be invoked only when stage list changes« ersetzen durch »buildOutputNode runs once while nothing it composes changes«.

### 13. `CHANGELOG.md` — Skill `updating-changelog` laden und befolgen

Unter `## [Unreleased]`:

- `### Fixed`: Wechsel von `pipeline`/`buildOutputNode` baut den Output-Node neu; Kamerawechsel einer Stage (`projection`, `camera`) baut den Pass-Node neu; `autoClear` wird zurückgesetzt, wenn eine Stage wirft; alle Stages eines gelisteten Namens rendern, jede Stage höchstens einmal, Umbenennung greift; Zurücksetzen der Nutzerkamera gibt die Projektionskamera sofort zurück; `OnStageAfterCameraChanged` bei jedem Kamerawechsel mit dem echten Vorgänger.
- `### Changed`: `Stage2D` erzeugt die Kamera beim ersten `resize()` mit Fläche (vorher `undefined`, `asPassNode()` wirft, `OnStageResize` nie `NaN`); komponierter `StageRenderer` zeichnet bei 0×0 nichts; `fitIntoRectangle` liefert für `contain`/`cover` bei Rechteck ohne Fläche 0×0; Projektionen ohne Specs starten mit `{fit: 'fill'}`; `buildOutputNode` ist ein Accessor-Paar auf dem Prototyp (Lesen/Schreiben unverändert — Formulierung wie beim bestehenden `pipeline`-Eintrag); Warnung zu geteilten Namen auch beim Setzen von `renderOrder`; die »no camera«-Warnung kommt einmal nach 100 Frames.
- Den bestehenden Unreleased-Eintrag unter `### Fixed` »fix `OrthographicProjection#updateViewRect()` for a projection built without specs: `viewSpecs` holds an empty object from construction on …« (Zeile 149) so umschreiben, dass er zum Default `{fit: 'fill'}` passt — der Abschnitt ist unveröffentlicht und darf geändert werden.
- `### Migration Guide`: ein Abschnitt für Code, der `stage.camera` direkt nach `new Stage2D(projection)` liest oder `asPassNode()` vor dem ersten `resize()` ruft — Muster der bestehenden Abschnitte (Überschrift `####`, Code davor/danach).

## Entscheidungen in diesem Paket

- **BUG-031, Default `{fit: 'fill'}`** statt `{pixelZoom: 1}`: beide ergeben
  dieselbe View, aber `pixelZoom` gewinnt in `fitIntoRectangle` vor `fit` — ein
  späteres `viewSpecs.fit = 'contain'` bliebe bei einem `pixelZoom`-Default
  wirkungslos. Default nur bei fehlenden Specs, kein Merge: `Canvas2DStage`
  schreibt in das übergebene Objekt und braucht die Referenz. Entscheidung
  »Default-Spec, Signatur bleibt optional« (Plan, 2026-09-19) ist damit
  umgesetzt.
- **BUG-079, erster Weg (Event-Abo)** gemäß der Regel »erster Weg, sofern kein
  Breaking Change«. `isEventized`-Guard statt `on()` auf jede Stage, weil
  `on()` fremde Objekte auto-eventisiert. Der Projektions-Setter läuft durch
  `#updateCamera`, sonst verlöre der Wechsel auf `projection = undefined` sein
  Event und der Renderer sampelte die alte Kamera weiter.
- **BUG-080, Guard im komponierten Pfad** (Schritt 3): Folge der eigenen
  Änderung, deshalb in diesem Paket. Größen-Guard statt `instanceof
  Stage2D`-Prüfung: eine Stage2D ohne Projektion wirft bei Fläche weiterhin
  mit ihrer klaren Meldung, statt still nichts zu rendern.
- **BUG-082, Abweichung von der Empfehlung beim Umbenennen:** Der erste Weg
  (»dokumentieren, dass ein Umbenennen ein erneutes Setzen von `renderOrder`
  braucht«) geht am Code vorbei — der Setter ignoriert eine Zuweisung mit
  unverändertem Wert, das dokumentierte Mittel bewirkte also nichts; ihn dafür
  zu öffnen hieße, jede gleichwertige Zuweisung einen Pass-Node-Rebuild
  auslösen zu lassen. Der Cache prüft stattdessen die Namen gegen seinen
  Schnappschuss — Wirkung des zweiten Wegs (Umbenennen greift ohne Zutun), ohne
  pro Frame Arrays zu bauen.
- **N1 und N2 im Paket, nicht in »Offene Befunde«:** gleiche Ursache wie die
  Findings. N1: ob `Stage2D` eine Kamera hat, entscheidet heute, welche Methode
  zuletzt lief, nicht der Zustand (Projektion + Fläche + kein Override) — das
  ist die Ursache von BUG-080, und das Kamera-TSDoc, das Schritt 5.3 neu
  schreibt, verspräche sonst weiter etwas Falsches. N2: dieselbe
  Name→Stage-Zuordnung in `orderedStages`, die BUG-082 neu schreibt.
- **Modell stärkste Stufe, Effort medium:** sechs Fixes greifen ineinander
  (Kamera-Timing × Event-Abo × 0×0-Guard × Cache), dazu Browsertest und
  Migrationshinweis — dafür die stärkste Stufe. Die API-Änderungen
  (`buildOutputNode`-Accessor, Kamera-Timing, Projektions-Default) stehen hier
  mit Signaturen und Werten fest; was bleibt, sind Bugfixes mit
  Regressionstests, also medium. Mehr Effort lüde dazu ein, die direkt
  benachbarten Fremd-Findings unten gleich mitzunehmen.
- **Nicht anfassen**, obwohl direkt daneben (eigene Audit-Findings außerhalb
  der BUG-Serie): PassNode-Leak bei jedem Rebuild (MEM-005), README-Clear-Policy
  und »Mid-frame state« (IMPL-008), `add()` setzt den Parent eines Kind-Renderers
  nicht (ARCH-007), `updateCamera()` vs. `createCamera()` (CONS-025), die
  »without arguments«-Tests (TEST-012).

## Urteil des Reviewers (`paket-1.review-1.json`)

- BUG-078: behoben — `StageRenderer.ts:324` (`pipeline`-Setter dirty bei Instanzwechsel), `:360` (`buildOutputNode`-Accessor)
- BUG-079: behoben — `StageRenderer.ts:789` (Abo in `add()`), `:814` (Abmeldung in `remove()`), `Stage2D.ts:81` (Projektions-Setter über `#updateCamera`)
- BUG-080: behoben — `Stage2D.ts:159` (0×0-Guard), `fitIntoRectangle.ts:210`, `StageRenderer.ts:503` (Guard im komponierten Pfad), `Stage2D.ts:18` (Warnkonstante + Flag)
- BUG-031: behoben — `OrthographicProjection.ts:39`, `ParallaxProjection.ts:41`
- BUG-081: behoben — `StageRenderer.ts:444`, `:466`
- BUG-082: behoben — `StageRenderer.ts:737` (`#warnAboutSharedNames`), `:166`, `:786`, `:675` (Namens-Schnappschuss im Cache)
- N1: behoben — `Stage2D.ts:113`
- N2: behoben — `StageRenderer.ts:712`
- Konventionen: keine Verstöße (keine IDs, kein Vorzustand in Code/TSDoc/README, keine übersehenen Aufrufer)

Kleine Befunde (keine Runde ausgelöst):

- `packages/twopoint5d/CHANGELOG.md:128` — »reading and writing it is unchanged« stimmt für Aufrufer, aber eine TS-Unterklasse, die `buildOutputNode` als Feld deklariert, bekommt TS2610, und ein Klassenfeld verdeckte den Setter; Halbsatz zu Unterklassen wäre möglich (der `pipeline`-Eintrag Zeile 100 hat dieselbe Lücke)
- `packages/twopoint5d/src/stage/StageRenderer.ts:789` — das Kamera-Abo invalidiert auch im Plain-Modus und in Mode C; in Mode C baut ein Kamerawechsel `texture(rt.texture)` neu und stößt eine unnötige Neukompilierung an — harmlos, nur bei Kamerawechsel
- `packages/twopoint5d-testing/test/stage-pipeline.test.js:94` — die zwei neuen Browsertests wurden nie rot gesehen (laufen gegen `dist`); Vitest-Regressionen belegen dasselbe Verhalten

Abweichungen des Implementierers vom Detailplan: `warns once when it runs without a camera` um eine zweite Stage (mit Projektion, nie resized, 1300 Frames) ergänzt, weil die geplante Variante schon vor dem Fix grün war; Browsertest Mode C prüft zusätzlich `outputNode` ≠ Platzhalter der neuen Pipeline und disposed `sr` vor den Pipelines; `Stage2D`/`ParallaxProjection` in `StageRenderer.spec.ts` statisch importiert.

Begründung der Urteile an den Nebenbefunden: `updateViewRect(0, h)` und `{pixelZoom: 0}` sind Rechenfehler (Division durch 0) → BUG-Serie, Scope. `updateCamera()` auf der Nutzerkamera → Rückfrage, weil unklar ist, ob die Projektion jede Kamera nachführen soll, und weil ein Audit-Finding außerhalb der BUG-Serie dieselbe Stelle behandelt. Die drei TSDoc-Lücken sind Doku, keine Korrektheitsdefekte → Audit.

## Findings im Volltext

**BUG-078 · high · packages/twopoint5d/src/stage/StageRenderer.ts:318-321, 340, 439-443, 481-487** — Den Output-Node dirty markieren, wenn pipeline oder buildOutputNode wechseln

`#outputDirty` wird nur von `add()`, `remove()`, `renderOrder` und `invalidateOutputNode()` gesetzt. Nach dem ersten Frame ist es `false`, also: (a) eine neue `RenderPipeline` zuzuweisen — ein Fall, den README.md ausdrücklich vorsieht (»Dispose the previous instance yourself when you replace one«) — lässt die neue Pipeline mit ihrem Default-`outputNode` stehen, `render()` zeichnet den Platzhalter statt der Stages; (b) `buildOutputNode` nachträglich zu setzen (README: »overrides the default«) schaltet den Codepfad auf `#renderPipelineComposed`, der nicht mehr in `#internalRT` rendert, während die Pipeline weiter das nun eingefrorene `texture(internalRT)` sampelt. Weder README noch JSDoc nennen ein nötiges `invalidateOutputNode()`.

Empfehlung: Im `pipeline`-Setter `this.#outputDirty = true` bei Instanzwechsel; `buildOutputNode` zu Getter/Setter machen, der bei Änderung dirty setzt. Zwei Specs: »replacing the pipeline rebuilds the output node«, »assigning buildOutputNode after the first frame switches mode«.

**BUG-079 · high · packages/twopoint5d/src/stage/Stage2D.ts:79-85, 104-106, 225-230; StageRenderer.ts:481-487** — Den Pass-Node des Parents neu bauen, wenn die Kamera einer Stage2D wechselt

threes `PassNode` speichert die Kamera bei der Konstruktion (`PassNode.js:221`) und rendert in `updateBefore()` durch `this.camera`. Der Parent-`StageRenderer` ruft `asPassNode()` nur, solange `#outputDirty` gesetzt ist. Nach `stage.projection = other` (erzeugt eine neue Kamera) oder `stage.camera = myCamera` (dokumentiert als vorrangig) rendert die Pipeline die Szene weiter durch das vorige Kameraobjekt — das kein `updateCamera()` beim Resize mehr bekommt, weil `#updateProjection` `this.camera` aktualisiert, die neue. Das Bild wird stumm falsch. `OnStageAfterCameraChanged` existiert (Zeile 108-115), `StageRenderer` abonniert es nicht.

Empfehlung: In `StageRenderer.add()` bei einer `Stage2D` (oder allem, was das Event exponiert) `OnStageAfterCameraChanged` abonnieren und `invalidateOutputNode()` rufen; in `remove()` abmelden. Alternativ `IPassProvider` einen Versionszähler geben, den der Renderer pro Frame vergleicht. Spec: Projektion nach dem ersten Render tauschen, `buildOutputNode` wird ein zweites Mal mit neuem Pass-Node gerufen.

**BUG-080 · medium · packages/twopoint5d/src/stage/Stage2D.ts:90-99, 117-121, 142-166, 182-194; fitIntoRectangle.ts:212-215; stage/README.md (»Common pitfalls«)** — Keine Kamera aus einem 0×0-Container im projection-Setter erzeugen — oder die Doku korrigieren, die »nach resize()« verspricht

Der Setter ruft `updateProjection(true)` → `#updateProjection(0, 0)` → `createCamera()` bereits im Konstruktor, die Kamera existiert also vor jedem `resize()`. Für eine einseitige Spec (`{fit:'contain', width: 640}`) ergibt das 0×0-Rechteck `height = 0 * Infinity = NaN`; `ParallaxProjection` baut dann eine `PerspectiveCamera(NaN, NaN, …)`, und `OnStageResize` geht mit `height: NaN` hinaus. Für `{pixelZoom: n}` ist der Aspect `0/0 = NaN`. Folgen: Der »no camera«-Guard in `updateFrame()` (mit seinen magischen `100`/`-1000`-Zählern) und das No-op in `renderTo()` greifen für eine Stage mit Projektion nie — ein Frame vor dem ersten Resize läuft durch eine NaN-Kamera ohne Warnung; README (»Stage2D#renderTo is a no-op until the first resize() … asPassNode throws in that state«) und das Kamera-TSDoc sind für jede mit Projektion gebaute Stage falsch (StageRenderer.spec.ts:502-503 assertiert sogar, dass `asPassNode()` direkt nach dem Setzen der Projektion nicht wirft).

Empfehlung: In `#updateProjection` (oder im Setter) früh zurückkehren, solange `#containerWidth === 0 || #containerHeight === 0`, und die Kamera vom ersten `resize()` erzeugen lassen — was die Doku verspricht; `fitIntoRectangle` gegen `rect.width/height === 0` absichern. Dann ist die `updateFrame`-Warnung wieder erreichbar: die Zähler durch eine benannte Konstante und ein `#warnedNoCamera`-Flag ersetzen. Specs »no camera before the first resize()« und »OnStageResize never carries NaN«.

**BUG-031 · medium · packages/twopoint5d/src/stage/OrthographicProjection.ts:30-33; ParallaxProjection.ts:32-35; fitIntoRectangle.ts** — Eine ohne Specs gebaute Projektion liefert eine Kamera, die nichts rendert

Beide Konstruktoren nehmen ausschließlich optionale Argumente; `viewSpecs` ist `specs ?? {}`. Ohne Specs lässt `fitIntoRectangle` das Ziel unberührt, `#viewRect` bleibt `(0, 0)`, `#pixelRatio` wird per Division durch null `Infinity`, und `createCamera()` gibt eine Kamera zurück, die nichts zeichnet. Belegt über `StageRenderer.spec.ts` und `OrthographicProjection.spec.ts:10`, die genau so konstruieren. Re-Check: unverändert; BUG-080 ist der Zwilling auf der Stage-Seite (0×0-Container statt leerer Spec).

Empfehlung: Einen Default-Spec im Konstruktor setzen, der ein brauchbares Zielrechteck ergibt — oder die Argumente zu Pflichtargumenten machen. Ein Objekt, das nur in einem unbrauchbaren Zustand entstehen kann, sollte gar nicht erst entstehen.

**BUG-081 · low · packages/twopoint5d/src/stage/StageRenderer.ts:408-416, 427-437** — autoClear in einem finally wiederherstellen, wenn eine Stage wirft

Die Render-Target-Wiederherstellung in `renderTo()`/`#renderPipelineSimple` nutzt `try/finally`, die `autoClear`-Wiederherstellung nicht (auch innerhalb des `try`-Blocks in 431-434). Eine Stage, die einmal wirft, hinterlässt den geteilten Renderer mit `autoClear=false` für jeden späteren Frame jedes anderen Konsumenten (`Display` tickt nach `OnDisplayError` weiter).

Empfehlung: Die Schleife an beiden Stellen in `try { … } finally { renderer.autoClear = wasPreviouslyAutoClear; }` hüllen.

**BUG-082 · low · packages/twopoint5d/src/stage/StageRenderer.ts:155-164, 644-662, 690-697; stage/README.md (»Render order«)** — Bei jedem Setzen von renderOrder vor doppelten Namen warnen und das Duplikat nicht stumm verwerfen

`orderedStages` nimmt die erste Stage pro Name; eine zweite mit demselben Namen bleibt in `otherStages` und wird nur gerendert, wenn `*` in der Order steht — mit `renderOrder='a,b'` wird sie nie gerendert und nie erwähnt. Die Warnung feuert nur, wenn das Duplikat *nach* dem Setzen von `renderOrder` hinzukommt; `add(a); add(a2); renderOrder='a,b'` bleibt stumm, entgegen README. `IStage.name` ist zudem mutierbar (`Stage2D` reicht `scene.name` durch), eine Umbenennung nach `add()` invalidiert `#orderedStages` nicht.

Empfehlung: Die Duplikat-Prüfung in einen Helfer ziehen, den `add()` und der `renderOrder`-Setter rufen; in `orderedStages` *alle* Stages eines gelisteten Namens (in Einfügereihenfolge) sammeln statt der ersten. Dokumentieren, dass ein Umbenennen ein erneutes Setzen von `renderOrder` braucht (oder den Cache streichen — die Liste ist winzig).

