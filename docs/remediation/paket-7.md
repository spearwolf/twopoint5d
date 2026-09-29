# Paket 7 — Drain: Stage-Schicht — leere Stage-Liste beim Komponieren, TSDoc, Fehlermeldung, Testnamen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-045 (low) · DOC-066 (low) gegenstandslos, siehe Abgleich · dazu sechs Einträge aus »Offene Befunde«: `#canCompose()` mit leerer Stage-Liste (low), Fehlermeldung von `#getStagePass()` (info), Testname mit totem Feldnamen (info), Klassen-TSDoc von `Stage2D` über der Interface-Deklaration (info), tote `scene`-Prüfungen in `Stage2D` (info), `IProjection` ohne TSDoc an vier Membern (info)
- Ziel: Ein komponierender StageRenderer ohne Stages rendert nichts statt einen leeren Pass-Satz zu komponieren, und die Stage-Schicht sagt in TSDoc, Fehlermeldungen, README-Verweisen und Testnamen genau, was gilt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts`
  - `packages/twopoint5d/src/stage/IProjection.ts`
  - `packages/twopoint5d/src/stage/RootRenderPipeline.ts` (nur TSDoc von `buildOutputNode`)
  - `packages/twopoint5d/src/stage/outputNodeBuilders.ts` (nur ein Satz TSDoc)
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]`)
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`

## Abgleich (2026-09-29, Stand `f4213cf8`)

| Eintrag | Urteil | Fundstelle heute |
| --- | --- | --- |
| TEST-045 | unverändert, verschoben | `packages/twopoint5d-testing/test/stage-pipeline.test.js:32-55`; die Assertion `expect(runs).to.be.greaterThan(0)` steht in `:53` |
| DOC-066 | gegenstandslos | `packages/twopoint5d/src/stage/README.md` enthält kein `§` mehr (`grep -n '§'` leer); vor dem Lauf (`5ff01ea2`) standen die Verweise in `:22-25`, `:251`, `:267`, `:319`. Behoben in Paket 3 (`8614c309`), dort mit Reviewer-Urteil gebucht. Kein Schritt in diesem Paket. |
| `#canCompose()` lässt eine leere Stage-Liste durch | unverändert, verschoben | `StageRenderer.ts:682-688` (`#canCompose`), `:827-833` (`#renderPipelineComposed`), `:866-872` (`#rebuildComposedOutputNode` ruft `compose(passes)` mit `[]`) |
| Fehlermeldung von `#getStagePass()` | unverändert, verschoben | `StageRenderer.ts:887-895`, Meldung in `:891` |
| Testname mit totem Feldnamen | unverändert, verschoben | `StageRenderer.spec.ts:2037` |
| Klassen-TSDoc von `Stage2D` über der Interface-Deklaration | unverändert | `Stage2D.ts:29-41` (TSDoc `:29-39`, `eslint-disable`-Kommentar `:40`, Interface `:41`, Klasse `:43`) |
| toter `scene == null`-Check | unverändert, dazu dieselbe Ursache an zwei weiteren Stellen | `Stage2D.ts:309` (`updateFrame`), `:341` (`renderTo`, `this.scene && this.camera`), `:373-375` (`asPassNode`, `if (!scene) throw …`); TSDoc von `renderTo()` `:333-337` sagt »until both are present« |
| `IProjection` ohne TSDoc | unverändert | `IProjection.ts:17` (`updateViewRect`), `:25` (`projectionPlane`), `:36` (`createCamera`), `:37` (`updateCamera`) |

Folgen aus erledigten Paketen: keine offen — alle `Folgen:`-Zeilen der Pakete 1–6d sind verteilt oder `keine`.

Nebenbefunde aus »Offene Befunde«: die sechs mit `Drain: Paket 7` gehören hierher. Nicht hierher: TEST-042 (vom Abschluss als behoben durch `676eefa7` zu buchen, kein Paket), API-063 (Paket 8).

Beim Abgleich neu gefunden: `packages/twopoint5d/src/display/Display.ts:423-593` trägt denselben Versatz wie `Stage2D` — die Klassen-TSDoc von `Display` steht über `export interface Display extends EventizedObject {}` (`:593`) statt über der Klasse (vorbestehend, `5ff01ea2` `:593`). Dieselbe Ursache, aber `src/display/` liegt außerhalb der Scope-Regel; deshalb nicht in diesem Paket, sondern in »Offene Befunde« mit `→ Audit`. Die anderen Interface-Merges (`StageRenderer.ts:65`, `Canvas2DStage.ts:22`, `TextureResource.ts:208`, `TextureStore.ts:176`, `FrameLoop.ts:180`, `PanControl2D.ts:188`) stehen richtig.

## Entscheidungen dieses Pakets (von A getroffen, mit Grund)

1. **Leere Stage-Liste im komponierenden Modus: die eigene Clear, sonst nichts.** Ein komponierender Renderer (Pipeline mit `buildOutputNode` oder `RootRenderPipeline`) mit Fläche und ohne Stage trägt seine eigene Clear auf (wenn `clear` gesetzt ist) und ruft weder `buildOutputNode` bzw. `RootRenderPipeline.buildOutputNode` noch `pipeline.render()`. Grund: `clear` ist laut »Entscheidungen« die einzige Clear eines Renderers, und der Plain-Modus sowie Mode C zeigen für einen Renderer ohne Stages die Clear-Farbe; kehrte der komponierende Modus vor der Clear zurück, bliebe nach dem Entfernen der letzten Stage das letzte Bild auf der Canvas stehen. `#canCompose()` bleibt unverändert — eine leere Liste besteht es weiterhin —, damit `#clearsWholeTarget()` für ein komponierendes Kind ohne Stages richtig antwortet (seine Clear erreicht das Target in diesem Frame); die Rückkehr sitzt in `#renderPipelineComposed()`.
2. **Neue Meldung von `#getStagePass()`**, weiterhin `TypeError`: `StageRenderer#renderTo() cannot compose the stage "<name>": that stage has no asPassNode(), and a pipeline with buildOutputNode or a RootRenderPipeline composes the pass node of every stage`. Grund: der Wurf entsteht immer in `renderTo()` (eigenem oder dem eines Eltern-Renderers), und die Muster-Meldungen des Laufs heißen `Klasse#methode() …: <Zustand>` (`StageRenderer#add() cannot take the stage "<name>": …`).
3. **Alle drei `scene`-Prüfungen in `Stage2D` fallen**, nicht nur die in `updateFrame()`. Grund: der Konstruktor setzt immer eine Szene (`Stage2D.ts:189-199`), der Setter nimmt nur `Scene`; die drei Prüfungen sind dieselbe tote Annahme an drei Stellen, und die Meldung `Stage2D#asPassNode() has no scene … assign one to stage.scene` beschreibt einen Zustand, den die Klasse nicht erreicht. Die Meldung gibt es nur in `[Unreleased]` (aus Paket 2, `59424ef0`); der dazugehörige CHANGELOG-Halbsatz wird mitgenommen. Kein Test prüft sie (`grep -rn "has no scene"` trifft nur `Stage2D.ts:374`).
4. **TEST-045: Frames zählen, nicht nur Läufe**, Titel bleibt. Grund: Empfehlung des Audits, erste Option; Mode C ruft `pipeline.render()` in jedem Frame ohne Vorbedingung (`StageRenderer.ts:761-773`), also gilt `runs === frames` ab dem ersten Frame.

## Vorgehen

Reihenfolge wie hier. Schritt 1 ist ein Korrektheitsfehler: erst die Regressionstests, rot sehen, dann beheben. Alle anderen Schritte sind Doku, Meldung, Testqualität und toter Code.

1. **Regressionstests zur leeren Stage-Liste (vor dem Fix, rot).**
   a. In `StageRenderer.spec.ts` die beiden Helfer `makePipelineMock()` und `fakeRootPipeline()` aus `describe('release of the internal render targets')` (`:2199-2207`) in den Rumpf von `describe('StageRenderer')` heben, neben `logClearsAndDraws()` (`:174`); die bisherigen Aufrufer im Release-`describe` nutzen sie unverändert von dort.
   b. In `describe('Mode D and E: composing the pass nodes of the stages')` (`:1692`) drei Tests, Namen exakt:
      - `'a composing renderer without stages draws its own clear and calls neither buildOutputNode nor the pipeline'` — `new StageRenderer()`, `resize(100, 100)`, `setClearColor(new Color(0xff0000), 1)` (setzt `clear = true`), `buildOutputNode = vi.fn(...)`, `pipeline = makePipelineMock()`; `renderTo(renderer)` wirft nicht, `buildOutputNode` nicht aufgerufen, `pipeline.render` nicht aufgerufen, und `logClearsAndDraws()` zeigt genau eine Clear mit der Clear-Farbe des Renderers.
      - `'a RootRenderPipeline without stages draws the clear of its renderer and does not throw'` — dasselbe mit `pipeline = fakeRootPipeline()` und ohne `buildOutputNode`; `renderTo()` wirft nicht (vor dem Fix: `RootRenderPipeline.buildOutputNode: no passes to compose`), `pipeline.render` nicht aufgerufen, eine Clear.
      - `'a composing renderer composes the first stage that joins it after frames without stages'` — zwei `renderTo()` ohne Stage, dann `add()` einer Stage mit `asPassNode`, dann `renderTo()`: `buildOutputNode` genau einmal, mit `[passNode]`, `pipeline.render` genau einmal.
   c. Den roten Lauf festhalten: `pnpm --filter @spearwolf/twopoint5d exec vitest run src/stage/StageRenderer.spec.ts`, Ausgabe der drei roten Tests in den Report.
2. **Fix in `StageRenderer.ts`, `#renderPipelineComposed()` (`:827-833`):** direkt nach `if (!this.#canCompose(stages)) return;` einfügen:
   ```ts
   // without a stage there is no pass to compose: the own clear is all this renderer draws, and
   // the output node waits for the first stage that joins
   if (stages.length === 0) {
     if (this.clear) this.#applyClear(renderer);
     return;
   }
   ```
   `#outputDirty` bleibt dabei unberührt (ein `add()` setzt es ohnehin). `#canCompose()` selbst ändert sich nicht (siehe Entscheidung 1); seine TSDoc (`:675-681`) bekommt einen Satz: `An empty list passes: #renderPipelineComposed() then draws the own clear alone.` Die TSDoc von `#renderPipelineComposed()` (`:820-826`) bekommt einen Satz: `Without a stage it draws its own clear and neither builds an output node nor runs the pipeline.`
3. **Doku zur leeren Stage-Liste**, gleicher Wortlaut in der Sache:
   - TSDoc des `buildOutputNode`-Accessors (`StageRenderer.ts:507-533`): nach dem Satz »While this renderer's `width` or `height` is 0, or while a `Stage2D` it composes has no camera, the composed mode draws nothing.« ergänzen: `Without a stage it draws its own clear and calls neither this callback nor the pipeline.`
   - `README.md:383-385` (Ende von »Mode D«): denselben Sachverhalt anhängen — ein komponierender Renderer ohne Stage trägt seine eigene Clear auf und ruft weder `buildOutputNode` noch die Pipeline, bis eine Stage dazukommt.
   - `README.md:659-664` (Pitfall »Stage with no camera yet«): an »draws nothing while it has no area or while one of its `Stage2D`s has no camera« anfügen, dass er ohne Stage nur seine Clear zeichnet.
   - `RootRenderPipeline.ts:23-24`: »Throws when `passes` is empty.« → »Throws when `passes` is empty; a `StageRenderer` without stages does not call it.«
   - `outputNodeBuilders.ts:54`: »An empty list of passes throws.« → »An empty list of passes throws; a `StageRenderer` without stages does not call the builder.«
   - `CHANGELOG.md` `[Unreleased]` → `### Fixed` (`:336`), neuer Punkt: `` - fix `StageRenderer` composing pass nodes — with `buildOutputNode` or a `RootRenderPipeline` — without a stage: it draws its own clear and calls neither `buildOutputNode` nor the pipeline until a stage joins it, so neither `RootRenderPipeline.buildOutputNode()` nor a callback that reads its first pass gets an empty list ``. Formulierung nach Skill `updating-changelog`, ohne Rückblick auf den Vorzustand (Konventionen).
4. **Browser-Test zur leeren Stage-Liste** in `stage-pipeline.test.js`, im Stil von `'a nested StageRenderer without a pipeline shows only the content of the current frame'` (`:323-364`: Renderer ohne Host, von Hand getrieben, `outputRenderTarget` 64 × 64, `readRenderTargetPixelsAsync`, `rgbAt`, `isNearColor`). Name exakt: `'Mode D: a RootRenderPipeline without stages shows the clear color of its renderer, and composes the first stage that joins it'`. Ablauf: `display` auf 64 × 64 starten; `new StageRenderer().setClearColor(new Color('#f00'), 1)`, `pipeline = new RootRenderPipeline(display.renderer)`, `outputRenderTarget = target`, `resize(64, 64)`; `renderTo()` wirft nicht, Pixel `(32, 32)` ist `[255, 0, 0]`; dann eine `Stage2D` mit `OrthographicProjection('xy|bottom-left')` und einem grünen `PlaneGeometry(16, 16)`-Quadrat in der Mitte (`#0f0`) hinzufügen, `renderTo()`, Pixel `(32, 32)` ist `[0, 255, 0]`. Reine Farben, damit die Farbtransformation der Pipeline das Ergebnis nicht verschiebt. Aufräumen wie im Vorbild (Renderer, Stage, Pipeline, Target, Geometrie, Material). Vor dem Fix rot (`no passes to compose`) — den roten Lauf mit in den Report, falls sich die Browser-Suite gezielt starten lässt; sonst genügt der rote Vitest-Lauf aus Schritt 1c.
5. **Meldung von `#getStagePass()`** (`StageRenderer.ts:891`): ersetzen durch
   ``StageRenderer#renderTo() cannot compose the stage ${JSON.stringify(stage.name)}: that stage has no asPassNode(), and a pipeline with buildOutputNode or a RootRenderPipeline composes the pass node of every stage``, weiterhin `TypeError`.
   - Test `'throws when a stage in the build path has no asPassNode()'` (`StageRenderer.spec.ts:2028-2035`): die Erwartung auf die neue Meldung schärfen (`toThrow(/StageRenderer#renderTo\(\) cannot compose the stage "bare"/)`) und einen zweiten Test daneben: `'throws the same error under a RootRenderPipeline without buildOutputNode'` mit `pipeline = fakeRootPipeline()` und derselben Erwartung.
   - `README.md:680-682` (Pitfall »`buildOutputNode` + non-pass stages«): Überschrift und Satz auf beide komponierenden Einstellungen weiten — »Composing + non-pass stages: under a pipeline with `buildOutputNode` or a `RootRenderPipeline` every stage in the list must implement `asPassNode()` …«; »The renderer throws with a clear message« bleibt sinngemäß.
   - `CHANGELOG.md` `[Unreleased]` → `### Changed` (`:77`), neuer Punkt: `` - the error `StageRenderer#renderTo()` throws for a stage without `asPassNode()` names the call and both setups that compose — a pipeline with `buildOutputNode` and a `RootRenderPipeline` ``.
6. **Testname** `StageRenderer.spec.ts:2037`: `'nested StageRenderer is pre-rendered into its asPassNode-RT before parent pipeline runs'` → `'nested StageRenderer is pre-rendered into its pass target before parent pipeline runs'`. Sonst nichts an diesem Test.
7. **TEST-045** in `stage-pipeline.test.js:32-55`: nach `const sr = new StageRenderer(display)…` (`:37`), also nach dem Abo des Renderers, einen Frame-Zähler abonnieren: `let frames = 0; display.onRenderFrame(() => { frames += 1; });` — so läuft er im selben Emit nach dem Renderer. `:53` ersetzen durch `expect(frames, 'frames').to.be.at.least(2);` und `expect(runs, 'pipeline runs').to.equal(frames);`. Titel bleibt. Gegenprobe: im Quelltext `pipeline.render()` in `#renderPipelineSimple()` (`StageRenderer.ts:769`) testweise doppelt aufrufen → der Test wird rot; zurücknehmen, Ergebnis der Probe in den Report.
8. **`Stage2D`-Klassen-TSDoc** (`Stage2D.ts:29-43`): die Kommentarzeile `// eslint-disable-next-line @typescript-eslint/no-empty-object-type` und `export interface Stage2D extends EventizedObject {}` über den TSDoc-Block ziehen, sodass die TSDoc direkt über `export class Stage2D` steht — Muster `StageRenderer.ts:64-67`. Text der TSDoc unverändert.
9. **Tote `scene`-Prüfungen in `Stage2D`** (Entscheidung 3):
   - `updateFrame()` `:307-316`: `const {scene, camera} = this;` → `const {camera} = this;`, `if (scene == null || camera == null)` → `if (camera == null)`, und in der inneren Bedingung `!camera &&` streichen (es bleibt `if (!this.#warnedNoCamera && ++this.#framesWithoutCamera >= FRAMES_WITHOUT_CAMERA_BEFORE_WARNING)`).
   - `renderTo()` `:338-343`: `if (this.scene && this.camera)` → `if (this.camera)`; TSDoc `:333-337` → »Render this stage's scene with its camera. No-op until the stage has a camera (until the first `resize()` with an area has created it from the projection, or one is assigned), and on a disposed stage.«
   - `asPassNode()` `:369-375`: `const {scene, camera} = this;` bleibt, der Block `if (!scene) { throw … }` fällt.
   - `CHANGELOG.md:301` (`[Unreleased]`, `### Changed`): »the error of `Stage2D#asPassNode()` without a camera says when the projection creates one, and a stage without a scene gets an error of its own« → Halbsatz ab », and a stage without a scene …« streichen.
   - Kein neuer Test: typisierter Code erreicht den Zustand nicht; die bestehenden Stage2D-Specs sind der Beleg, dass sich nichts ändert.
10. **TSDoc der vier `IProjection`-Member** (`IProjection.ts:17`, `:25`, `:36`, `:37`), Wortlaut:
    ```ts
    /**
     * Fits the view into a container of `width` × `height`. {@link getViewRect}, {@link createCamera}
     * and {@link updateCamera} work from the last call that gave a view with an area. A width or a
     * height that is not a finite number above 0 leaves the projection as it is; specs that give no
     * view with an area keep the last view, while the pixel ratio follows the new container.
     */
    updateViewRect(width: number, height: number): void;
    ```
    ```ts
    /**
     * The plane the camera looks at. {@link createCamera} and {@link updateCamera} need it: without
     * one, both throw.
     */
    get projectionPlane(): ProjectionPlane | undefined;
    ```
    ```ts
    /**
     * Builds a new camera with the setup of the last {@link updateViewRect} that gave a view with an
     * area, aimed at the projection plane and placed at its distance. `Stage2D` asks for one once it
     * has a view and no camera.
     *
     * @throws {Error} if the projection has no {@link projectionPlane}, with a message that names the
     * class, the method and the field to set.
     */
    createCamera(): Camera;
    ```
    ```ts
    /**
     * Gives `camera` the setup {@link createCamera} gives a new one; what the camera carried there is
     * replaced. `Stage2D` calls it for the camera it has — the projection's or one assigned to
     * `stage.camera` — whenever it computes its view anew.
     *
     * @throws {TypeError} if `camera` is not of the kind {@link createCamera} builds, checked before
     * the projection plane.
     * @throws {Error} if the projection has no {@link projectionPlane}, with a message that names the
     * class, the method and the field to set.
     */
    updateCamera(camera: Camera): void;
    ```
    Zeilen auf die Breite der Datei umbrechen (Prettier/Lint). Die TSDoc der beiden Implementierungen bleibt.
11. Den Rest: `pnpm run ci` grün; kein weiterer CHANGELOG-Eintrag (Schritte 6–8 und 10 sind nicht nutzersichtbar, Schritt 9 nur für ein unerreichbares `null`).

- Verify: `pnpm run ci`
- Commit: `fix(stage): let a composing StageRenderer without stages draw its own clear and call neither buildOutputNode nor the pipeline, let the error for a stage without asPassNode() name renderTo() and both setups that compose, drop the checks of Stage2D for a scene it always has, document the members of IProjection, and let the pipeline test count its frames`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · TEST-045 nach `stage-pipeline.test.js:32-55` gewandert · DOC-066 gegenstandslos (behoben in Paket 3, `8614c309`; kein `§` mehr in `README.md`) · `#canCompose()` jetzt `StageRenderer.ts:682-688`/`:827-833` · `#getStagePass()` jetzt `:891` · Testname jetzt `StageRenderer.spec.ts:2037` · `Stage2D.ts:29-41` unverändert · `scene`-Prüfung `Stage2D.ts:309` unverändert, dazu `:341` und `:373-375` (gleiche Ursache, im Paket) · `IProjection.ts:17/25/36/37` unverändert · keine offenen Folgen zu verteilen · neuer Nebenbefund `Display.ts:423-593` → »Offene Befunde« (`→ Audit`)
  - 2026-09-29 Zug 1: Implementierer beauftragt (sonnet, medium), Report nach `paket-7.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG (erst per Resume als `paket-7.impl-0-versuch-2.json` vollständig) · 9 Dateien geändert (`StageRenderer.ts`, `StageRenderer.spec.ts`, `Stage2D.ts`, `IProjection.ts`, `RootRenderPipeline.ts`, `outputNodeBuilders.ts`, `README.md`, `CHANGELOG.md`, `stage-pipeline.test.js`) · Arbeitsbaum schmutzig · roter Lauf 3 Vitest + 1 Browser · Gegenprobe Schritt 7 rot (4 ≠ 2)
  - 2026-09-29 Zug 2: Verify `pnpm run ci` exit=0, Log `paket-7.verify.log` · Zug 3: Reviewer beauftragt (sonnet, medium), Diff `paket-7.diff` (780 Zeilen)
  - 2026-09-29 Zug 3: Urteil — alle sechs Einträge und TEST-045 behoben, DOC-066 gegenstandslos bestätigt, keine kritischen oder wichtigen Befunde, zwei kleine · Report `paket-7.review-0.json`
  - 2026-09-29 Zug 4: keine Runde nötig
  - 2026-09-29 Zug 5: Commit `e121dbb4`, Verify `paket-7.verify.log` exit=0

## Findings im Volltext

**TEST-045 · low · packages/twopoint5d-testing/test/stage-pipeline.test.js:23** — Der Testtitel »runs once per frame« prüft nur runs > 0
Der Titel verspricht, dass der Pass einmal pro Frame läuft; geprüft wird nur, dass er überhaupt lief. Ein doppelter Aufruf pro Frame bliebe grün. Aufgefallen im Remediation-Lauf vom 2026-09-24.
Empfehlung: Frames und Läufe zählen und `runs === frames` prüfen, oder den Titel auf das Geprüfte zurücknehmen.

**DOC-066 · low · packages/twopoint5d/src/stage/README.md:22-25** — Die Stage-README verweist auf nummerierte Abschnitte, die sie nicht hat
Aufgefallen im Remediation-Lauf vom 2026-09-21. Die Verweise auf `§3.2`, `§6.2`, `§6.3` und `§6.4` führen ins Leere, weil die README keine nummerierten Abschnitte hat. (Weitere Fundstellen im Audit: `README.md:246`, `:262`, `:313`.)
Empfehlung: Die Verweise durch Überschriften-Links ersetzen oder die Abschnitte nummerieren.
→ gegenstandslos, behoben in Paket 3 (`8614c309`).

**Nebenbefund · low · packages/twopoint5d/src/stage/StageRenderer.ts:671-677 (heute `:682-688`)** — `#canCompose()` lässt eine leere Stage-Liste durch: ein komponierender Renderer ohne Stages ruft in jedem Frame `buildOutputNode([])` bzw. `RootRenderPipeline.buildOutputNode([])`; letzteres wirft `no passes to compose` aus `renderTo()`, bis eine Stage dazukommt, ein Callback, der seinen ersten Pass destrukturiert, scheitert in sich (vorbestehend, `5ff01ea2` `StageRenderer.ts:583-590`; aus Zug 0 von Paket 6d).

**Nebenbefund · info · packages/twopoint5d/src/stage/StageRenderer.ts:833 (heute `:891`)** — die Fehlermeldung von `#getStagePass()` beginnt mit `StageRenderer.buildOutputNode:` und spricht vom »buildOutputNode composition path«, erscheint aber auch unter einer `RootRenderPipeline` ohne gesetztes `buildOutputNode` (aus Paket 6b).

**Nebenbefund · info · packages/twopoint5d/src/stage/StageRenderer.spec.ts:1739 (heute `:2037`)** — der Testname `'nested StageRenderer is pre-rendered into its asPassNode-RT before parent pipeline runs'` trägt den Namen eines privaten Felds, das es nicht mehr gibt; Paket 6b durfte Specs nicht ändern (aus Paket 6b).

**Nebenbefund · info · packages/twopoint5d/src/stage/Stage2D.ts:29-41** — die Klassen-TSDoc von `Stage2D` steht über der mergenden `interface Stage2D extends EventizedObject {}` statt über der Klasse (aus Paket 3).

**Nebenbefund · info · packages/twopoint5d/src/stage/Stage2D.ts:309** — `scene == null` prüft einen Accessor, der laut Typ nie `null` ist; die Prüfung ist tot (aus Paket 5). Beim Abgleich dieselbe Prüfung in `:341` und `:373-375`.

**Nebenbefund · info · packages/twopoint5d/src/stage/IProjection.ts:17, :25, :36-37** — `updateViewRect`, `projectionPlane`, `createCamera` und `updateCamera` haben auf dem Interface keine TSDoc; die Pflichten eines Implementierers (`TypeError` beim falschen Kameratyp, `Error` ohne Projektionsebene) stehen nur an den beiden Implementierungen (aus Paket 5).

## Urteil des Reviewers (Zug 3, `paket-7.review-0.json`)

- TEST-045 — behoben: `packages/twopoint5d-testing/test/stage-pipeline.test.js:35-38` (Frame-Zähler nach dem Abo des Renderers), `:56-57` (`frames` ≥ 2, `runs === frames`); Gegenprobe rot (4 ≠ 2)
- DOC-066 — gegenstandslos bestätigt: `packages/twopoint5d/src/stage/README.md` ohne `§`
- Leere Stage-Liste beim Komponieren — behoben: `StageRenderer.ts:832-836`, `#canCompose()` unverändert (`:684`), TSDoc `:681-682`, `:827-828`, `:521`; Tests `StageRenderer.spec.ts` (drei Namen aus Schritt 1b) und Browser `stage-pipeline.test.js:368-406`; Doku `README.md:385-386`, `:665`, `RootRenderPipeline.ts:24`, `outputNodeBuilders.ts:54`, CHANGELOG `Fixed`
- Meldung von `#getStagePass()` — behoben: `StageRenderer.ts:~903`, weiterhin `TypeError`; zwei Tests (einer unter `fakeRootPipeline()`), README-Pitfall, CHANGELOG `Changed`
- Testname mit totem Feldnamen — behoben: `'nested StageRenderer is pre-rendered into its pass target before parent pipeline runs'`
- Klassen-TSDoc von `Stage2D` — behoben: Interface-Merge samt `eslint-disable` über dem TSDoc-Block, TSDoc direkt über `export class Stage2D`
- Tote `scene`-Prüfungen — behoben: `updateFrame()`, `renderTo()` (samt TSDoc), `asPassNode()`; CHANGELOG-Halbsatz gestrichen
- TSDoc von `IProjection` — behoben: `IProjection.ts` an `updateViewRect`, `projectionPlane`, `createCamera`, `updateCamera`, gegen beide Implementierungen geprüft

Kleine Befunde:
- `packages/twopoint5d/src/stage/README.md:665-667` — »Until then its `width` and `height` are 0« hat nach dem eingefügten Halbsatz »without a stage only its clear« sein Bezugswort verloren; dazu ein unsauberer Umbruch davor
- `packages/twopoint5d/src/stage/outputNodeBuilders.ts:54` — Kommentarzeile etwa 147 Zeichen, der Block bricht sonst bei etwa 100 um
