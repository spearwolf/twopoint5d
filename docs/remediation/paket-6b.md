# Paket 6b — StageRenderer entwirren: Modusauswahl, RenderTarget-Verwaltung, Renderreihenfolge

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: READ-001 (low) · dazu die Folge aus Paket 5 (`Canvas2DStage.ts:6` importiert `throwCollected` aus `../texture/internals.js`; Nachtragspaket hier zusammengelegt)
- Ziel: `StageRenderer.ts` liest sich als Folge benannter Schritte — die Modusauswahl steht an einer Stelle, die Verwaltung der beiden internen RenderTargets und die Berechnung der Renderreihenfolge liegen in eigenen, nicht öffentlichen Modulen —, ohne dass sich ein Verhalten ändert; `throwCollected` liegt in `src/utils/`, und die Stage-Schicht greift nicht mehr in die Interna des Texture-Moduls.
- Modell: stärkste Stufe
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`):
  - `src/stage/StageRenderer.ts` — umgebaut
  - `src/stage/StageRendererTargets.ts` — neu, nicht in `public-api.ts`
  - `src/stage/StageRenderOrder.ts` — neu, nicht in `public-api.ts`
  - `src/utils/throwCollected.ts` und `src/utils/throwCollected.spec.ts` — neu, nicht in `src/utils/public-api.ts`
  - `src/texture/internals.ts`, `src/texture/TextureStore.ts`, `src/texture/TextureResource.ts`, `src/stage/Canvas2DStage.ts` — nur Import bzw. Entfernen
  - `src/stage/README.md` — drei Stellen, die private Feldnamen nennen (Schritt 7)
  - `src/stage/StageRenderer.spec.ts` — ein Kommentar (Schritt 7), sonst nichts
- Vorgehen:

  **Rahmen, gilt für jeden Schritt.**
  (a) Kein Verhalten ändert sich. Der Beleg ist `pnpm run ci` ohne eine geänderte Assertion und ohne einen neuen oder geänderten Test unter `src/stage/` oder `packages/twopoint5d-testing/`. Muss ein Test sich ändern, damit er grün wird, ist das ein Befund: zurückbauen, nicht den Test anpassen; lässt sich der Schritt ohne das nicht umsetzen, Status `BLOCKIERT` mit Test, erwartet/erhalten.
  (b) Der Frame-Pfad allokiert nichts: `renderTo()`, `updateFrame()` und alles, was sie pro Frame rufen, legen kein Closure, kein Array und kein Objekt an. Erlaubt bleibt, was schon heute nur bei Bedarf allokiert — der Neubau des Schnappschusses in `orderedStages`, der Neubau des Ausgabeknotens (`stages.map(…)`, `texture(…)`), der Bau eines RenderTargets. Für die Stage gibt es keinen `hot-path-allocations.spec.ts`; kein Test fängt einen Verstoß, der Report listet deshalb jede neue Methode auf dem Frame-Pfad mit »allokiert nichts« oder dem Grund, warum nur bei Bedarf.
  (c) Reihenfolgen bleiben exakt, wo unten eine genannt ist — sie tragen Verhalten im Fehlerfall (was gilt, wenn `setRenderTarget()`, `setSize()` oder ein Stage-Draw wirft).
  (d) Die Methoden `#renderStagesInline()`, `#renderPipelineSimple()`, `#renderPipelineComposed()`, `#renderToCurrentTarget()`, `#clearForInternalRT()`, `#clearToTransparentBlack()`, `#applyClear()`, `#canCompose()`, `#clearsWholeTarget()`, `#getStagePass()` behalten ihre Namen — Paket 6c plant gegen `#renderPipelineSimple()`.
  (e) TSDoc und Kommentare wandern mit dem Code, den sie erklären, unverändert im Wortlaut, außer wo sie eine Stelle nennen, die umzieht oder umbenannt wird. Nach dem Umbau `StageRenderer.ts` nach jedem `#`-Namen und jedem Methodennamen in Kommentaren durchgehen (`grep -n '#[a-zA-Z]' src/stage/StageRenderer.ts`) und jeden Verweis auf eine umgezogene oder entfallene Stelle auf ihren neuen Ort richten. Neue Module bekommen einen Kopfkommentar im Stil von `src/texture/internals.ts:1-3`: was sie halten, und dass sie nicht in `public-api.ts` stehen, weil nur `StageRenderer` sie erreicht.
  (f) Nichts wird exportiert, was heute nicht exportiert ist: `StageRenderer.ts` wird per `export *` veröffentlicht (`src/stage/public-api.ts`), ein neuer Typ dort bleibt deshalb ohne `export`. Die beiden neuen Module stehen nicht in `src/stage/public-api.ts`, `throwCollected.ts` nicht in `src/utils/public-api.ts`.

  1. **`throwCollected` nach `src/utils/`.** Neue Datei `src/utils/throwCollected.ts` mit der Funktion aus `src/texture/internals.ts:48-55`, Signatur und TSDoc unverändert (`export function throwCollected(errors: readonly unknown[], message: string): void`), Muster `src/utils/isPositiveFinite.ts`. In `internals.ts` die Funktion samt TSDoc löschen und im Modulkopf (`:1-3`) den Teilsatz », and what the teardowns of both share« streichen; der Kopf endet dann mit »… belong to the store and not to its callers. This module is not in `public-api.ts`, so that nobody outside `src/texture/` can name them.« (Umbruch neu nach Prettier). Die drei Aufrufer importieren von dort: `src/texture/TextureStore.ts:12` und `src/texture/TextureResource.ts:15` nehmen `throwCollected` aus dem `./internals.js`-Import und bekommen `import {throwCollected} from '../utils/throwCollected.js';` — in `TextureResource.ts` direkt hinter `../utils/describeValue.js` (`:6`), in `TextureStore.ts` hinter dem letzten `./`-Import (`:26`); `src/stage/Canvas2DStage.ts:6` ersetzt die Zeile durch denselben Import, hinter `../texture/TextureFactory.js`. Neue `src/utils/throwCollected.spec.ts` im Stil von `src/utils/isObject.spec.ts` (`describe('throwCollected')`, `it`):
     - `it('throws nothing for no error')`: `expect(() => throwCollected([], 'm')).not.toThrow()`.
     - `it('throws a single error unchanged')`: `const error = new RangeError('one')`; der Wurf ist `error` selbst (`try/catch` und `toBe(error)`), nicht eingewickelt.
     - `it('throws several errors as an AggregateError with the message')`: zwei Fehler `a`, `b`; der Wurf ist `instanceof AggregateError`, `message` `'m'`, `errors` `toEqual([a, b])` und `errors[0]` `toBe(a)`.
     `StageRenderer#resize()` (`StageRenderer.ts:405-425`) behält seinen eigenen Wurf: sein Text zählt die Stages und nennt das RenderTarget eigens, und er gehört nicht zu diesem Schritt.

  2. **Neues Modul `src/stage/StageRendererTargets.ts`** — die beiden RenderTargets, die ein `StageRenderer` für sich baut, und das Pixelverhältnis, mit dem sie bemessen werden. Import `{RenderTarget, type WebGPURenderer}` aus `'three/webgpu'`. Klasse `export class StageRendererTargets`, private Felder und öffentliche Methoden (öffentlich heißt hier: für `StageRenderer` erreichbar; das Modul selbst ist intern):
     ```ts
     #pixelRatio = 1;                       // Doku von StageRenderer.ts:568-572, Verweis auf `#ensureRT()` → "the next internalTarget() or passTarget()"
     #internal?: RenderTarget;              // das interne Target von Mode C (Doku :554)
     #pass?: RenderTarget;                  // das Pass-Target, in das ein komponierender Eltern-Renderer rendert (Doku :556)

     internalTarget(renderer: WebGPURenderer, width: number, height: number): RenderTarget   // = #ensureInternalRT(), :842-844
     passTarget(renderer: WebGPURenderer, width: number, height: number): RenderTarget       // = der #ensureRT()-Teil von #ensureAsPassNodeRT(), :852 — OHNE den Disposed-Guard
     releaseInternalTarget(): void          // this.#internal?.dispose() — Objekt bleibt (so :492, :550)
     releasePassTarget(): void              // this.#pass?.dispose() — Objekt bleibt (so :1224)
     resize(width: number, height: number): void   // :384-385: erst #internal, dann #pass, jeweils nur wenn vorhanden; KEIN eigenes try — wirft setSize() beim internen Target, bleibt das Pass-Target unberührt, wie heute
     dispose(): void                        // :962-963 und :966-967: #internal dispose + undefined, dann #pass dispose + undefined, in dieser Reihenfolge

     #deviceSize(size: number): number      // Math.max(1, Math.floor(size * this.#pixelRatio)) — ersetzt #renderTargetWidth()/#renderTargetHeight(), :855-863
     #resize(rt: RenderTarget, width: number, height: number): void   // = #resizeRenderTarget(), :865-871
     #ensure(rt: RenderTarget | undefined, renderer: WebGPURenderer, width: number, height: number): RenderTarget   // = #ensureRT(), :873-888, samt Kommentar, Reihenfolge: zuerst #pixelRatio aus renderer.getPixelRatio?.() ?? 1, dann bauen bzw. samples angleichen und resize
     ```
     `width`/`height` sind die logischen Maße des Renderers; `StageRenderer` übergibt `this.width`/`this.height` zum Zeitpunkt des Aufrufs — genau die Werte, die `#renderTargetWidth()` heute liest. TSDoc je Methode in einem Satz, was sie tut und was bleibt (»The object stays, so every `texture()` node on it stays valid; three.js allocates the memory again on the next draw into it.« an beiden `release…`-Methoden, aus `:1221-1223`). Mode C bekommt in diesem Paket kein Erwerben und Zurückgeben: `internalTarget()` antwortet mit dem eigenen Target wie heute; Paket 6c führt `acquire`/`release` mit dem Pool ein (Begründung unter »Entscheidungen dieses Zugs«).

  3. **Neues Modul `src/stage/StageRenderOrder.ts`** — der Wert von `renderOrder`, seine Einträge und der Schnappschuss der Stages in dieser Ordnung. `import type {StageItem} from './StageRenderer.js';` (nur Typ, keine Laufzeitabhängigkeit zurück). Klasse `export class StageRenderOrder`:
     ```ts
     #value = '*';                          // war StageRenderer#renderOrder (:188)
     #entries?: string[];                   // war #renderOrderArray (:225)
     #snapshot?: StageItem[];               // war #orderedStages (:189)
     #snapshotNames: string[] = [];         // war #orderedStageNames (:190)
     readonly #onRename: () => void;

     constructor(onRename: () => void)      // läuft, wenn eine umbenannte Stage den Schnappschuss verwirft — nur solange die Ordnung Namen nennt (heute :1024 `this.#outputDirty = true`)
     get value(): string
     set(value: string | undefined): boolean   // `value || '*'`; gleich dem jetzigen → false, nichts ändert sich; sonst #value setzen, #entries und #snapshot verwerfen, true (heute :203-207)
     entries(): readonly string[]           // = #getRenderOrderArray(), :235-244, samt Kommentar :235 umformuliert auf "the frame path reads the entries through here; StageRenderer#renderOrderArray hands out a copy"; die Einträge selbst, keine Kopie
     listedNames(): Set<string>             // = #listedNames(), :246-249
     invalidate(): void                     // #snapshot = undefined — für add() und remove()
     snapshot(stages: ReadonlyArray<StageItem>): ReadonlyArray<StageItem>   // = Rumpf des Getters orderedStages, :1013-1073, mit allen Kommentaren; `this.#outputDirty = true` (:1024) wird `this.#onRename()`, `this.#stages` wird `stages`
     warnAboutSharedNames(stages: ReadonlyArray<StageItem>, names: Iterable<string>): void   // = #warnAboutSharedNames(), :1085-1103; `this.#stages` → `stages`, `this.#renderOrder` → `this.#value`; Meldungstext und eslint-disable-Zeile unverändert
     #hasSnapshotNames(stages: ReadonlyArray<StageItem>): boolean   // = #hasOrderedStageNames(), :1076-1083
     ```
     Der Sonderfall bleibt, wie er ist: im `'*'`-Fall schreibt `snapshot()` `#snapshotNames` nicht (:1027-1031).

  4. **`StageRenderer.ts` — Felder und Accessoren auf die Module umstellen.**
     - Import `{StageRenderOrder}` aus `./StageRenderOrder.js`, `{StageRendererTargets}` aus `./StageRendererTargets.js`. `RenderTarget` wird in `StageRenderer.ts` nur noch als Typ gebraucht (`type RenderTarget`, sonst meldet `pnpm lint` `consistent-type-imports`).
     - An die Stelle von `#renderOrder`, `#orderedStages`, `#orderedStageNames` (:188-190) tritt
       ```ts
       // a renamed stage that moves the snapshot moves the pass nodes with it
       readonly #order = new StageRenderOrder(() => {
         this.#outputDirty = true;
       });
       ```
       (einmal je Renderer angelegt, nicht pro Frame). `#renderOrderArray` (:225), `#getRenderOrderArray()` (:235-244), `#listedNames()` (:246-249), `#hasOrderedStageNames()` (:1076-1083), `#warnAboutSharedNames()` (:1085-1103) entfallen in `StageRenderer.ts`.
     - `set renderOrder(order)`: `if (this.#order.set(order)) { this.#outputDirty = true; this.#order.warnAboutSharedNames(this.#stages, this.#stages.map((item) => item.stage.name)); this.onRenderOrderChanged(); }` — Reihenfolge wie :204-211.
     - `get renderOrder()` → `this.#order.value`; `get renderOrderArray()` → `this.#order.entries().slice()`; `get orderedStages()` → `this.#order.snapshot(this.#stages)`. Die öffentliche TSDoc der drei Getter und des Setters bleibt, wo sie steht, unverändert.
     - `add()`: `:1168` → `this.#order.warnAboutSharedNames(this.#stages, [stage.name]);`, `:1169` → `this.#order.invalidate();`. `remove()`: `:1217` → `this.#order.invalidate();`.
     - An die Stelle von `#internalRT`, `#asPassNodeRT` (:554-557) und `#pixelRatio` (:568-573) tritt `readonly #targets = new StageRendererTargets();` (Kommentar: die beiden Targets, die dieser Renderer für sich baut). `#internalOutputNode`, `#internalOutputTexture`, `#outputDirty` bleiben in `StageRenderer`.
     - `#ensureInternalRT()` (:842-844) entfällt. `#ensureAsPassNodeRT()` (:846-853) heißt `#ensurePassTarget(renderer: WebGPURenderer): RenderTarget`, behält Disposed-Guard und Kommentar und endet mit `return this.#targets.passTarget(renderer, this.width, this.height);`. `asPassNode()` ruft `#ensurePassTarget()`. `#renderTargetWidth()`, `#renderTargetHeight()`, `#resizeRenderTarget()`, `#ensureRT()` (:855-888) entfallen in `StageRenderer.ts`.
     - `resize()`: `:384-385` → `this.#targets.resize(width, height);` im selben `try`. Sonst bleibt `resize()` Zeichen für Zeichen.
     - `dispose()`: `:962-967` → `this.#targets.dispose(); this.#internalOutputNode = undefined; this.#internalOutputTexture = undefined;` mit dem Kommentar :960-961 davor. Reihenfolge im Rest von `dispose()` unverändert.
     - `remove()`: `:1224` → `stage.#targets.releasePassTarget();` mit dem Kommentar :1221-1223 davor.

  5. **`StageRenderer.ts` — die Modusauswahl an einer Stelle.**
     - Modulprivater Typ, ohne `export`: `type StageRendererMode = 'plain' | 'pipeline-only' | 'composed';`
     - `#isComposing()` und `#isPipelineOnly()` (:628-636) entfallen; an ihrer Stelle
       ```ts
       #renderMode(): StageRendererMode {
         if (this.#pipeline == null) return 'plain';
         return this.#buildOutputNode != null || this.#pipeline instanceof RootRenderPipeline ? 'composed' : 'pipeline-only';
       }
       ```
       mit TSDoc: die einzige Stelle, die entscheidet, wie dieser Renderer zeichnet — ohne Pipeline die Stages direkt ins Ziel (plain), eine Pipeline mit `buildOutputNode` oder eine `RootRenderPipeline` komponiert die Pass-Knoten der Stages (Mode D, für verschachtelte Renderer Mode E), jede andere Pipeline sampelt das interne Target (Mode C).
     - `#renderToCurrentTarget()` (:615-626): `const stages = this.orderedStages;` samt Kommentar, dann `switch (this.#renderMode())` mit den drei Fällen `'composed'` → `#renderPipelineComposed(renderer, stages)`, `'pipeline-only'` → `#renderPipelineSimple(renderer, stages)`, `'plain'` → `#renderStagesInline(renderer, stages)`, je Fall ein Aufruf und `break`, kein `default`. Die TSDoc (:609-614) sagt statt »Picks the right mode (plain / pipeline-only / pipeline+buildOutputNode). A `RootRenderPipeline` triggers the composed path automatically via its static `buildOutputNode`.« nur noch, dass es in dem Modus zeichnet, den `#renderMode()` wählt.
     - `#clearsWholeTarget()` (:663): `(this.#renderMode() !== 'composed' || this.#canCompose(this.orderedStages))`.
     - Beide Setter (:485-494, :544-552) rufen nach dem Schreiben des Felds einen neuen Schritt:
       ```ts
       #modeInputChanged(previousMode: StageRendererMode): void {
         this.#outputDirty = true;
         if (previousMode === 'pipeline-only' && this.#renderMode() !== 'pipeline-only') this.#targets.releaseInternalTarget();
       }
       ```
       Im Setter: Disposed-Guard und Gleichheitsprüfung wie heute, dann `const previousMode = this.#renderMode();`, Feld schreiben, `this.#modeInputChanged(previousMode);`. Der Kommentar »a pipeline arrives with an outputNode of its own; …« (:490) bleibt im `pipeline`-Setter vor dem Aufruf. TSDoc von `#modeInputChanged()`: markiert den Ausgabeknoten für einen Neubau und gibt den GPU-Speicher des internen Targets frei, wenn der Schreibvorgang Mode C verlassen hat. Platz: direkt hinter dem `buildOutputNode`-Setter.

  6. **`StageRenderer.ts` — die Draws als benannte Schritte.**
     - Lineare Ausgabe über ein vorab angelegtes Zustandsobjekt, keine Callback-Funktion (Rahmen b): zwei private Felder, direkt vor `#renderPipelineSimple()`,
       ```ts
       #callerToneMapping: WebGPURenderer['toneMapping'] = NoToneMapping;
       #callerOutputColorSpace: WebGPURenderer['outputColorSpace'] = ColorManagement.workingColorSpace;

       #beginLinearOutput(renderer: WebGPURenderer): void {
         this.#callerToneMapping = renderer.toneMapping;
         this.#callerOutputColorSpace = renderer.outputColorSpace;
         renderer.toneMapping = NoToneMapping;
         renderer.outputColorSpace = ColorManagement.workingColorSpace;
       }

       #endLinearOutput(renderer: WebGPURenderer): void {
         renderer.toneMapping = this.#callerToneMapping;
         renderer.outputColorSpace = this.#callerOutputColorSpace;
       }
       ```
       Die TSDoc von `#beginLinearOutput()` ist der Kommentar :693-699 (warum linear, warum nicht `pipeline.outputColorTransform`), dazu ein Satz: die Werte des Aufrufers liegen in Feldern dieses Renderers, damit kein Frame etwas anlegt; ein verschachtelter Renderer hält seine eigenen, deshalb überschreibt ein Kind, das während des Draws seines Eltern-Renderers zeichnet, die Werte des Eltern-Renderers nicht.
     - Neuer Schritt, genutzt vom plain mode und von Mode C:
       ```ts
       /** Draws the stages into the current target, with renderer.autoClear off while they draw and restored afterwards. */
       #drawStages(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void {
         const wasPreviouslyAutoClear = renderer.autoClear;
         renderer.autoClear = false;
         try {
           for (const stageItem of stages) this.renderStage(stageItem, renderer);
         } finally {
           renderer.autoClear = wasPreviouslyAutoClear;
         }
       }
       ```
     - `#renderStagesInline()`: `if (this.clear) this.#applyClear(renderer); this.#drawStages(renderer, stages);` — gleichwertig zu :669-678, weil `#applyClear()` `autoClear` nicht anfasst.
     - `#renderPipelineSimple()` (TSDoc :681-688 bleibt):
       ```ts
       const pipeline = this.#pipeline!;
       const rt = this.#targets.internalTarget(renderer, this.width, this.height);
       this.#drawIntoInternalTarget(renderer, rt, stages);
       this.#wireInternalOutputNode(pipeline, rt);
       if (this.clear) this.#applyClear(renderer);
       pipeline.render();
       ```
       `#drawIntoInternalTarget(renderer, rt, stages)`, in exakt dieser Reihenfolge (Rahmen c — wirft `setRenderTarget(rt)`, bleibt die Ausgabe des Aufrufers unberührt, wie heute):
       ```ts
       const prev = renderer.getRenderTarget();
       renderer.setRenderTarget(rt);
       this.#beginLinearOutput(renderer);
       try {
         this.#clearForInternalRT(renderer);
         this.#drawStages(renderer, stages);
       } finally {
         this.#endLinearOutput(renderer);
         renderer.setRenderTarget(prev);
       }
       ```
       `#wireInternalOutputNode(pipeline: RenderPipeline, rt: RenderTarget): void` = :720-731 samt Kommentar :720-723.
     - `#renderPipelineComposed()` (TSDoc :748-754 bleibt, »(see `#renderPipelineSimple()`)« wird »(see `#beginLinearOutput()`)«):
       ```ts
       if (!this.#canCompose(stages)) return;
       this.#prerenderNestedRenderers(renderer, stages);
       if (this.#outputDirty) this.#rebuildComposedOutputNode(renderer, stages);
       if (this.clear) this.#applyClear(renderer);
       this.pipeline!.render();
       ```
       `#prerenderNestedRenderers(renderer, stages)`: `this.#beginLinearOutput(renderer); try { for (const {stage} of stages) { if (stage instanceof StageRenderer) this.#prerenderChild(renderer, stage); } } finally { this.#endLinearOutput(renderer); }` — der Kommentar :758-759 entfällt, weil `#beginLinearOutput()` den Grund trägt.
       `#prerenderChild(renderer: WebGPURenderer, child: StageRenderer): void` = :768-781: `const childRT = child.#ensurePassTarget(renderer);`, `prev`, `setRenderTarget(childRT)`, `try { <Kommentar :772-776> if (!child.#clearsWholeTarget()) this.#clearToTransparentBlack(renderer); child.#renderToCurrentTarget(renderer); } finally { renderer.setRenderTarget(prev); }`. Der Zugriff auf private Glieder des Kinds bleibt instanzübergreifend innerhalb der Klasse, wie heute.
       `#rebuildComposedOutputNode(renderer, stages)` = :790-794.
     - Verweise nachziehen (Rahmen e), mindestens: TSDoc von `#outputDirty` (:562-565) »see `#renderPipelineSimple()`« → »see `#wireInternalOutputNode()`«; TSDoc von `#pixelRatio` wandert nach Schritt 2; jede weitere Fundstelle aus dem `grep`.

  7. **Doku und Spec-Kommentar, die private Feldnamen nennen, die es danach nicht mehr gibt.** In `src/stage/README.md`:
     - `:289`, Kommentarzeile im Codeblock von Mode C — heute »the renderer wires `texture(internalRT)` into `pipeline.outputNode`«, danach die Zeile:
       ```ts
       // nothing else — the renderer wires a texture() node of its internal target into `pipeline.outputNode`
       ```
     - `:321-323`: »the child's own pass-target (not `internalRT`, which is the target of Mode C); before the pipeline runs, …« → »the child's own pass-target (not the internal target of Mode C); before the pipeline runs, …«
     - `:379-381`: »`worldRenderer.asPassNode()` returns a `texture()` node sampling the renderer's `asPassNodeRT`; the root clears that RT and pre-renders the child into it …« → »… sampling the renderer's own pass-target; the root clears that target and pre-renders the child into it …«
     Absätze danach mit Prettier neu umbrechen (`pnpm format`), sonst keine Änderung am README. In `src/stage/StageRenderer.spec.ts:1764` der Kommentar »(the child's asPassNodeRT)« → »(the child's pass-target)« — die einzige Änderung an einem Spec unter `src/stage/`.

  8. **Nichts sonst.** Kein CHANGELOG-Eintrag: keine nutzersichtbare Änderung, kein öffentliches Symbol bewegt sich. Kein Umbau von `resize()`, `add()`, `remove()`, `#applyClear()`, `#clearToTransparentBlack()` über die genannten Zeilen hinaus. Kein neuer Browser-Test: das Verhalten ändert sich nicht, und `test:browser` in `pnpm run ci` (`stage-pipeline.test.js`, `stage-renderer.test.js`, `stage-canvas2d.test.js`) ist das Netz der GPU-Seite. Keine Finding-ID, kein Rückblick auf den Vorzustand in Code, Kommentar oder Commit-Message.

- Report, zusätzlich zum Rückgabevertrag: je neue oder umgezogene Methode auf dem Frame-Pfad eine Zeile »allokiert nichts« bzw. »nur bei Bedarf: …« (Rahmen b); die Zeilenzahl von `StageRenderer.ts` vorher (1234) und nachher.
- Verify: `pnpm run ci`
- Commit: `refactor(stage): let StageRenderer pick its render mode in one place and draw in named steps, keep its two internal render targets and the computation of its render order in internal modules of their own, share one throwCollected from utils between the texture and the stage modules, and let the stage docs name the internal target and the pass target without the names of private fields`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · READ-001 umgeformt und gewachsen (1234 statt 733 Zeilen; Modusauswahl an 5 Stellen, RT-Verwaltung in 6 Methoden und 5 Handgriffen anderer Methoden, Renderreihenfolge in 3 Cache-Feldern und 5 Methoden) · Folge aus Paket 5 unverändert (`Canvas2DStage.ts:6`) → Schritt 1 · Offene Befunde: keiner mit gleicher Ursache · Restplan unverändert, Hinweis an 6c
  - 2026-09-29 Zug 1: Implementierer beauftragt, stärkste Stufe (opus), Effort medium · Report nach `paket-6b.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG · 7 Dateien geändert (`StageRenderer.ts` 1234→1118 Zeilen, `Canvas2DStage.ts`, `README.md`, `StageRenderer.spec.ts` ein Kommentar, `internals.ts`, `TextureStore.ts`, `TextureResource.ts`), 4 neu (`StageRendererTargets.ts` 93, `StageRenderOrder.ts` 165, `utils/throwCollected.ts`, `utils/throwCollected.spec.ts`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-6b.verify.log`)
  - 2026-09-29 Zug 3: Reviewer (opus, medium) · READ-001 behoben, Folge aus Paket 5 behoben · 1 wichtig (`StageRenderer.ts:764` TSDoc sagt noch »asPassNode-RTs«), 2 klein · Diff `paket-6b.diff`
  - 2026-09-29 Zug 4 Runde 1: offen `StageRenderer.ts:764` (wichtig) · derselbe Implementierer per Resume (opus, medium) · zurück FERTIG, TSDoc sagt »pass-targets« · Verify exit=0 (`paket-6b.verify-1.log`) · Diff `paket-6b.r1.diff`, Reviewer gezielt · Reviewer: behoben, nichts Neues, nichts zurückgeholt
  - 2026-09-29 Zug 5: Commit `7f0d5159` · Verify `paket-6b.verify-1.log` exit=0 (jünger als die letzte Änderung) · 11 Dateien

## Abgleich (Zug 0, Stand `4de94744`)

- **READ-001** — umgeformt und gewachsen: `StageRenderer.ts` hat 1234 Zeilen (das Finding nennt 733), die Pakete 1–5 haben die Mischung vertieft, nicht aufgelöst. Heute verteilt:
  - Modusauswahl an fünf Stellen: `#renderToCurrentTarget()` `:615-626` (if/else-Kette), `#isComposing()` `:629-631`, `#isPipelineOnly()` `:634-636`, die beiden Setter `:485-494` und `:544-552` (je `wasPipelineOnly` und Freigabe des internen Targets, doppelt), `#clearsWholeTarget()` `:658-665`.
  - RenderTarget-Verwaltung: Felder `:554-557`, `:568-573`, `#ensureInternalRT()` `:842`, `#ensureAsPassNodeRT()` `:846`, `#renderTargetWidth/Height()` `:855-863`, `#resizeRenderTarget()` `:865`, `#ensureRT()` `:873-888`, dazu Handgriffe in `resize()` `:384-385`, `dispose()` `:962-967`, `remove()` `:1224` und den Settern `:492`, `:550`.
  - Pass-Komposition: `#renderPipelineComposed()` `:755-799` in einem Stück (Vorab-Render der Kinder, Neubau des Ausgabeknotens, Clear, Render); Sichern und Wiederherstellen von `toneMapping`/`outputColorSpace` doppelt in `:700-718` und `:760-787`.
  - Renderreihenfolge (vom Plan-Ziel ergänzt): `:188-249`, `:997-1103` — drei Cache-Felder, die zusammen verworfen werden müssen, dazu Namensprüfung und Warnung.
  - Die Empfehlung (»Modusauswahl und RenderTarget-Verwaltung in eigene Module oder private Methoden mit sprechenden Namen«) trägt weiter; der Detailplan folgt ihr und nimmt die Renderreihenfolge nach dem Ziel im Plan dazu.
- **Folge aus Paket 5** — unverändert: `src/stage/Canvas2DStage.ts:6` `import {throwCollected} from '../texture/internals.js';`, Aufruf `:317`; `src/texture/internals.ts:48-55` definiert die Funktion, Modulkopf `:1-3` sagt, niemand außerhalb von `src/texture/` solle diese Symbole nennen; weitere Aufrufer `TextureStore.ts:12`/`:1123`/`:1184`, `TextureResource.ts:15`/`:627`. Kein Spec importiert `throwCollected`.
- Private Glieder von `StageRenderer` in Specs, Browser-Tests, Lookbook: keine. Nur Kommentare und lokale Variablennamen (`StageRenderer.spec.ts:1764`, `:1922-1945`; `stage-pipeline.test.js:527-530`) und das README (`:289`, `:322`, `:380`). Die lokalen Namen bleiben, Kommentar und README zieht Schritt 7 nach. `CHANGELOG.md:3555` (`internalRT.texture`) steht in einem veröffentlichten Abschnitt und bleibt.

## Triage (Zug 0)

- Folgen der erledigten Pakete: bis auf die aus Paket 5 alle schon verteilt und behoben; Paket 6 hat keine. Die aus Paket 5 ist hier (Schritt 1), wie in Zug 0 von Paket 6 verteilt.
- Offene Befunde: keiner teilt die Ursache dieses Pakets (Lesbarkeit von `StageRenderer.ts`). `Stage2D.ts:29-41` (Klassen-TSDoc über dem Interface), `IProjection.ts` (TSDoc der Interface-Glieder) und `Stage2D.ts:309` (tote `scene == null`-Prüfung) liegen in anderen Dateien und bleiben für die Drain-Runde; TEST-042 und API-063 bleiben, wie eingetragen.

## Entscheidungen dieses Zugs

- **Zwei Klassen statt reiner Funktionen.** Die Renderreihenfolge ist Zustand, der zusammen verworfen werden muss (Wert, Einträge, Schnappschuss, Namen) — reine Funktionen ließen genau diese vier Felder in `StageRenderer` zurück. Dasselbe für die Targets (zwei Targets und das Pixelverhältnis, das beide bemisst).
- **Maße als Argumente, kein Rückverweis auf den Renderer.** `StageRendererTargets` bekommt `width`/`height` bei jedem Aufruf; so hängt das Modul nicht an `StageRenderer`, und das Verhalten von `resize()` im Fehlerfall (Renderer fällt auf die alte Größe zurück, die Targets bleiben auf der neuen, bis der nächste Draw sie angleicht) bleibt Zeichen für Zeichen.
- **Der Disposed-Guard bleibt in `StageRenderer`** (`#ensurePassTarget()`): er meldet einen Zustand des Renderers, nicht der Targets, und ein Eltern-Renderer ruft ihn beim Vorab-Render direkt.
- **Mode C erwirbt und gibt in 6b noch nicht zurück.** Der Hinweis aus Zug 0 von Paket 6 macht das Modul zur Stelle, an die 6c den Pool hängt; das ist erfüllt: `StageRenderer` hält das interne Target in keinem eigenen Feld mehr, und `#renderPipelineSimple()` holt es über genau einen Aufruf. Ein `release`, das ohne Pool nichts tut, hätte in diesem Paket weder Verhalten noch Test; 6c führt `acquire`/`release` und das `finally` nach `pipeline.render()` mit seiner ersten Implementierung ein (so auch 6c-Hinweis (2)).
- **Lineare Ausgabe über zwei Felder statt ein eigenes Objekt.** Der Hinweis verlangt ein vorab angelegtes Zustandsobjekt; zwei private Felder des Renderers sind genau das, ohne eine dritte Datei für zwei Methoden. Wiedereintritt ist ausgeschlossen: ein Renderer hat einen Halter, und jeder verschachtelte Renderer sichert in seine eigenen Felder.
- **`resize()` behält seinen eigenen Wurf** statt `throwCollected`: sein Text zählt die Stages und nennt das RenderTarget eigens, und der Umbau ist nicht Teil des Findings.
- **`throwCollected.spec.ts` neu**: die Funktion wird ein Werkzeug zweier Schichten; Vorbild ist der Umzug von `isObject` nach `src/utils/` (`35e7942e`), der seinen Spec mitbrachte.
- **Modell: stärkste Stufe**, obwohl das Paket ein Modul umbaut: kein Test hält die Allokationsfreiheit und die Reihenfolgen im Fehlerfall, und der Umbau greift instanzübergreifend auf private Glieder zu. Effort `medium`: Signaturen stehen hier, die Verweise in Kommentaren muss der Implementierer selbst finden.

## Restplan (Zug 0)

Reihenfolge und Schnitt der offenen Pakete bleiben: 6c hängt an der RenderTarget-Verwaltung aus 6b (erfüllt durch `StageRendererTargets`), 6d ist unabhängig und bleibt hinter 6c, weil beide `README.md` und `CHANGELOG.md` anfassen. 6b fasst im README nur drei Sätze in Mode C/D/E an (Schritt 7), keinen Absatz, den 6c oder 6d umschreiben. Im Plan bei 6c ein Hinweis zu den Namen aus 6b und dazu, dass `acquire`/`release` dort entstehen.

## Findings im Volltext

**READ-001 · low · packages/twopoint5d/src/stage/StageRenderer.ts** — StageRenderer.ts mit 733 Zeilen entwirren
Der `Display.ts`-Anteil ist im Remediation-Lauf vom 2026-09-24 behoben (`resize()` als Pipeline benannter Schritte, `a33a6961`). `StageRenderer.ts` ist seit dem Vorlauf (624 Zeilen) auf 733 Zeilen gewachsen und mischt Modusauswahl, RenderTarget-Verwaltung und Pass-Komposition.
Empfehlung: Modusauswahl und RenderTarget-Verwaltung in eigene Module oder private Methoden mit sprechenden Namen ziehen, sodass `render()` sich als Folge von Schritten liest.

**Folge aus Paket 5 · info · packages/twopoint5d/src/stage/Canvas2DStage.ts:6** — importiert `throwCollected` aus `../texture/internals.js`, die Stage-Schicht greift in die Interna des Texture-Moduls; eingeführt von Paket 4 (`abf84d48`), gefunden vom Implementierer von Paket 5. Verteilt in Zug 0 von Paket 6: Symptom von Paket 4, Umzug nach `src/utils/throwCollected.ts`.

## Reviewer-Urteil (Zug 3, nachgeprüft in Runde 1)

- **READ-001 — behoben.** `#renderMode()` als einzige Modusentscheidung `StageRenderer.ts:620`, `switch` in `#renderToCurrentTarget()` `:650`, `#modeInputChanged()` `:542`; RenderTarget-Verwaltung in `StageRendererTargets.ts:7-93`; Renderreihenfolge in `StageRenderOrder.ts` (`'*'`-Fall lässt `#snapshotNames` unberührt, `:84-89`); Draws als benannte Schritte `StageRenderer.ts:660-698`, `:709-749`, `:769-814`. Rahmen (a)–(f) erfüllt: keine Assertion geändert, Frame-Pfad allokiert nichts außer bei Bedarf, Reihenfolgen im Fehlerfall wie vorher (`setRenderTarget(rt)` vor `#beginLinearOutput()` `:722-732`, `#targets.resize()` ohne eigenes `try`, `dispose()` erst internes, dann Pass-Target), geschützte Methodennamen erhalten, kein neuer Export (`StageRendererMode` ohne `export`, `:47`). Runde 1: TSDoc `:764` sagt jetzt »pass-targets«.
- **Folge aus Paket 5 — behoben.** `src/utils/throwCollected.ts:1-8` mit Signatur und TSDoc unverändert; Aufrufer `TextureResource.ts:7`, `TextureStore.ts:26`, `Canvas2DStage.ts:6`; `internals.ts:1-3` ohne Funktion und Teilsatz; `throwCollected.spec.ts` mit den drei Fällen; `utils/public-api.ts` unberührt.

Kleine Befunde:
- `StageRenderOrder.ts:40` — der Zeilenkommentar »the frame path reads the entries through here; …« steht vor dem TSDoc-Block von `entries()` statt im Rumpf oder als Satz in der TSDoc (vom Implementierer bewusst so gesetzt, damit die TSDoc an der Methode hängt).
- `StageRenderer.spec.ts:1739` — Testname mit »asPassNode-RT«; Rahmen (a) sperrte Spec-Änderungen → »Offene Befunde«.

Nebenbefunde (alle vorbestehend, geprüft mit `git show 4de94744:…`, → »Offene Befunde«, Urteil `→ Scope`, weil unter `src/stage/**`): »internal pass-target« in der öffentlichen TSDoc (`StageRenderer.ts:95`, `:463`, `:518`, `:702`); Meldung von `#getStagePass()` `:833`; Testname `StageRenderer.spec.ts:1739`.

Abweichungen des Implementierers: README nicht per `pnpm format` umgebrochen (`*.md` steht in `.prettierignore`, ein direkter `prettier --write` hätte das ganze README umformatiert), die zwei Absätze von Hand auf die bestehende Breite gebracht · TSDoc von `#pass` sagt »on the renderer« statt »on this renderer« (anderes Modul) · Verweise auf private Methoden in Backticks statt `{@link #…}`, wie im Rest der Datei.
