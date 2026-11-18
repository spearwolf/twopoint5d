# Paket 11 — StageDirector: Shape-Cache und Masken-Buchhaltung in interne Klassen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ARCH-001 (medium, Director-Teil; der Display-Teil ist mit Paket 10 erledigt)
- Ziel: Shape-Bau, -Cache, -Eviction und Compile des `StageDirector` stehen in einer internen Klasse `DirectorShapeCache`, die Masken-Buchhaltung in einer internen Klasse `DirectorMasks`; der Director behält Stapel, Layer und Transitions, bei unveränderter öffentlicher API und unverändertem Verhalten.
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/stage/StageDirector.ts`, neu `packages/twopoint5d/src/stage/directorSlots.ts`, `packages/twopoint5d/src/stage/DirectorShapeCache.ts`, `packages/twopoint5d/src/stage/DirectorMasks.ts`; Doku `packages/twopoint5d/docs/architecture.md`
- Abgeteilt in Zug 0: ARCH-002 nach Paket 11b, READ-005 nach Paket 11c
- Verify: `pnpm run ci`
- Commit: `refactor(twopoint5d): build, cache and compile the shapes of a director in an internal DirectorShapeCache, and keep the masks of its slots and transitions in an internal DirectorMasks`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · ARCH-001 (Director-Teil) unverändert, um bis zu 11 Zeilen verschoben (`StageDirector.ts` 2499 → 2510 Zeilen durch die Pakete 4, 5, 7; Klasse `:500`, `precompile()` `:1384`, `#placeholder()` `:2214`, `#currentShape()` `:2233`, `#compileShape()` mit dem Ersatz von `renderer.render` `:2431`) · ARCH-002 nach Paket 11b, READ-005 nach Paket 11c abgeteilt · offene Folgen: keine (alle erledigten Pakete `Folgen: keine`) · Queue: kein Eintrag gleicher Ursache; `StageDirector.ts:365` zieht mit `parseShapes()` nach `DirectorShapeCache.ts`
  - 2026-11-18 Zug 1: Implementierer beauftragt (opus, effort medium, `paket-11.impl-0.json`)
  - 2026-11-18 Zug 2: Report FERTIG · geändert `StageDirector.ts` (2510 → 1647 Zeilen), `docs/architecture.md`; neu `directorSlots.ts`, `DirectorShapeCache.ts`, `DirectorMasks.ts` · `.d.ts`-diff leer, Spec-diff leer laut Report · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-11.verify.log`), `.d.ts`-diff vom Runner nachgeprüft: leer
  - 2026-11-18 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-11.diff` · Urteil: ARCH-001 behoben, 0 kritisch, 0 wichtig, 3 klein (`paket-11.review-0.json`)
  - 2026-11-18 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-18 Zug 5: committet a687ec89 · Verify aus Zug 2 (`paket-11.verify.log`, exit=0), seither keine Codeänderung · Queue-Eintrag `parseShapes()` auf `DirectorShapeCache.ts:179` nachgeführt · der kleine Befund zu `precompile()` als Folge in den Plan

## Entscheidungen aus Zug 0

1. **Paket 11 wird dreigeteilt** — 11 (Director, ARCH-001), 11b (StageRenderer und Stage2D, ARCH-002), 11c (Projektionen, READ-005). Grund: drei Umbauten der Größen L, L und M in getrennten Dateien ohne gemeinsamen Code; zusammen wären es rund 5.400 Zeilen Verschiebung in vier Klassen, die im Review nicht mehr als »Verhalten unverändert« prüfbar sind. Derselbe Grund wie bei 6/6b und 9/9b. Paket 11 zuerst, weil ARCH-001 die Severity medium trägt.
2. **Zwei interne Klassen nach dem Muster von `DisplaySizer` (Paket 10):** jede bekommt im Konstruktor den Director selbst — für seine öffentlichen Member — und ein Host-Objekt mit Pfeilfunktionen für das, was privat bleibt. Namen: `DirectorShapeCache` wie in der Empfehlung des Audits, `DirectorMasks` für die Masken-Buchhaltung.
3. **Der Director behält** `#join()`, `#release()`, `#rebuildOrder()`, `#isNested()`, `#drawOffScreen()`, alle öffentlichen Methoden, die Optionsprüfung (`parseOptions()`, `parsePrecompileOptions()` …), die Transitions (`#begin()`, `#endRun()`, `#host`) und die Frame-Hooks. Grund: Layer-Lebenszyklus, Ordnung und Stapel sind seine Sache; `#isNested()` prüft `instanceof StageDirector`, in einem anderen Modul bräuchte das einen Laufzeit-Import der Klasse und damit einen Importkreis.
4. **`parseShapes()` geht mit in `DirectorShapeCache.ts`**: es baut `ShapeKind`s aus `LAYER_KIND` und `isEffect()`, die dem Cache gehören. Der offene Eintrag »`StageDirector.ts:365` schreibt die Regel von `isRecord()` aus« zieht damit um und wird hier **nicht** behoben (eigene Ursache, Drain-Runde).
5. **Kein CHANGELOG-Eintrag**: keine öffentliche Änderung (Konvention: »Jede öffentliche Änderung«; Paket 10 ebenso).
6. **Kein bestehender Spec ändert sich.** Die Specs prüfen den Director über seine öffentliche API; ein Spec, der angepasst werden müsste, zeigt eine Verhaltensänderung an und ist als Abweichung zu melden, nicht umzuschreiben.
7. **Kein Bugfix-Paket**: es gibt keinen roten Regressionstest. Der Beleg für »unverändert« sind die unveränderten Specs, die Allocation-Specs und die gleiche `.d.ts` (Schritt 0 und 6).

## Vorgehen

Alle Pfade relativ zu `packages/twopoint5d/src/stage/`. Verschieben heißt: Code, Kommentare und TSDoc wortgleich übernehmen; geändert wird nur, was der neue Ort verlangt (`this.#x` → Host- oder Director-Zugriff). Fehler- und Warnmeldungen bleiben Zeichen für Zeichen, auch ihr Subjekt (`StageDirector#precompile(): …`, `StageDirector: …`, `StageTransitionInput#mask(): …`). Die Reihenfolge jedes Schritts innerhalb einer Methode bleibt, wie sie ist — die Reentrancy-Regeln (Listener, die mitten im Aufruf den Director entsorgen oder den Stapel ändern) hängen daran.

0. **Baseline der Typen.** Vor der ersten Änderung `pnpm build:twopoint5d`, dann `cp packages/twopoint5d/dist/lib/stage/StageDirector.d.ts /tmp/claude-1000/-home-spw-spaceland-twopoint5d/25b68af0-a25d-4ede-b583-3d06a691b428/scratchpad/paket-11.StageDirector.before.d.ts` (vom Repo-Root aus).

1. **Neu `directorSlots.ts`** — die Datensätze, die Director, Cache und Masken teilen. Kopfkommentar im Stil von `StageRendererTargets.ts`: was das Modul hält, dass es nicht in `public-api.ts` steht und nur von `StageDirector.ts`, `DirectorShapeCache.ts` und `DirectorMasks.ts` gelesen wird. Jeder Export trägt `@internal` in seinem TSDoc. Aus `StageDirector.ts` hierher, unverändert:
   - `interface Layer` (`:115`), `interface Run` (`:139`), `interface Slot` (`:158`), `type OrderRef` (`:207`) — exportiert, Namen bleiben.
   - `const maskOwners` (`:215`) und `const layerOwners` (`:218`), exportiert; ihr Typ nennt `StageDirector` über `import type`.
   - `const NO_MASKS` (`:222`) und `function masksOf()` (`:241`), exportiert.
   - neu `export function holdRefusal(holder: StageRenderer, stage: IStage): string | undefined` — der Rumpf von `#holdRefusal()` (`:1598`), `this` durch `holder` ersetzt; die beiden Texte `'that stage is this director'` und `'that stage holds this director'` bleiben, der Vergleich `holder === this` wird `h === holder`. Laufzeit-Import von `StageRenderer` (aus `./StageRenderer.js`) — kein Kreis, `StageRenderer.ts` importiert den Director nicht.
   - `StageDirector.ts` importiert all das von hier; `#holdRefusal()` entfällt, `#refuseStage()` ruft `holdRefusal(this, stage)`.

2. **Neu `DirectorShapeCache.ts`** — Kopfkommentar: baut, hält und kompiliert die Shapes des Stapels eines Directors — die Graphen der Komposition, ihre `RootRenderPipeline`s und Platzhalter, die zuletzt gezeichneten 16 neben den von `precompile()` gepinnten —, nicht in `public-api.ts`.
   - Aus `StageDirector.ts` hierher, unverändert: `interface ShapeSlot` (`:168`), `interface Shape` (`:177`), `interface CachedShape` (`:188`), `const KEPT_SHAPES` (`:238`), `effectIds`/`nextEffectId`/`effectId()` (`:259–269`), `interface ShapeKind` (`:275`), `const LAYER_KIND` (`:281`), `interface ShapeMask` (`:284`), `distinctMasks()` (`:298`), `shapeKey()` (`:334`), `isEffect` (`:349`), `parseShapes()` (`:352`), `over()` (`:413`). Exportiert (`@internal`) werden nur `Shape`, `ShapeKind`, `parseShapes`, `withTarget`, `DirectorShapeCacheHost`, `DirectorShapeCache`; der Rest bleibt modullokal. Der Kommentar von `distinctMasks()` nennt `orderedStages` — er bleibt, die Reihenfolge baut weiter `#rebuildOrder()` des Directors.
   - `export function withTarget(renderer: WebGPURenderer, target: RenderTarget | null, linear: boolean, draw: () => void): void` — der Rumpf von `#withTarget()` (`:2460`). Der Director ruft ihn in `#drawOffScreen()`, der Cache in `#compileShape()`.
   - `export interface DirectorShapeCacheHost { rendererChanged(): void }` — TSDoc: »Der Renderer, für den die Shapes gebaut werden, hat gewechselt: die Ziele der Layer halten unter dem neuen kein Bild; jeder eingefrorene Layer zeichnet einmal.«
   - `export class DirectorShapeCache`, `constructor(director: StageDirector, host: DirectorShapeCacheHost)` (`StageDirector` als `import type`). Private Felder, aus dem Director umbenannt wo der Klassenname es schon sagt: `#director`, `#host`, `#shapes` (Map, Kommentar »the order of insertion is the order of use …« mit), `#key` (war `#shapeKey`), `#shape`, `#renderer` (war `#shapesRenderer`), `#lettingGoErrors`, `#placeholders` (Kommentar zu den 1×1-Zielen mit), `#clearUniform`, `#resolution`, `#clearColorOfRenderer`.
   - Öffentliche Methoden (für den Director), je mit TSDoc:
     - `setResolution(width: number, height: number): void` — `this.#resolution.value.set(width, height)`; die Werte rechnet der Director.
     - `invalidate(): void` — `this.#key = undefined`: der Stapel hat sich geändert, der nächste `current()` sucht seine Shape neu.
     - `current(renderer: WebGPURenderer, slots: readonly Slot[]): Shape` — der Rumpf von `#currentShape()` (`:2233`), `this.#slots` → `slots`, `this.#shapesFor(...)` → `this.bindTo(...)`.
     - `writeProgress(shape: Shape, slots: readonly Slot[]): void` — die Schleife aus `renderToCurrentTarget()` `:1314–1319` samt Kommentar (»written only when it changed …«).
     - `updateClear(renderer: WebGPURenderer): void` — der Rumpf von `#updateClearUniform()` (`:2500`), `this.clear`/`this.clearColor`/`this.clearAlpha` → `this.#director.…`.
     - `fill(passes: Node[], refs: readonly OrderRef[]): Node` — der Rumpf von `#fillShape()` (`:2479`), `this.#orderRefs` → `refs`.
     - `bindTo(renderer: WebGPURenderer, errors: unknown[]): void` — der Rumpf von `#shapesFor()` (`:2317`); die Schleife `for (const layer of this.#layers.values()) layer.needsPicture = true` samt Kommentar wird `this.#host.rendererChanged()`.
     - `precompile(renderer: WebGPURenderer, kinds: readonly ShapeKind[], nestedTarget: () => RenderTarget | undefined, errors: unknown[], stopped: () => boolean): Promise<boolean>` — der Rumpf **einer** Iteration der Schleife in `precompile()` `:1420–1448` ab `this.#shapesFor(renderer, errors)` (→ `this.bindTo(renderer, errors)`). Jedes `break` wird `return false`, jedes `continue` und das Ende `return true`; jedes `this.isDisposed` wird `stopped()`. `nestedTarget()` wird genau dort aufgerufen, wo `asLayer ? (this.outputRenderTarget ?? target()) : undefined` stand — nur für eine neue Shape, damit das Pass-Ziel weiter erst bei Bedarf entsteht. Ein Fehler aus `#buildShape()` (ein `effect.build()`, das wirft) geht wie bisher ungeprüft durch; nur nach einem Fehler eines Compiles — des eigenen oder des fremden, auf das gewartet wird — wird `stopped()` gefragt.
     - `takeLettingGoErrors(): unknown[] | undefined` — antwortet `#lettingGoErrors` und setzt es auf `undefined`.
     - `dispose(errors: unknown[]): void` — `StageDirector#dispose()` `:1498–1509` in dieser Reihenfolge: jede Shape über `#disposeShape()`, `#shapes.clear()`, `#shape`/`#key`/`#renderer` auf `undefined`, Platzhalter freigeben und leeren, dann die noch nicht geworfenen `#lettingGoErrors` an `errors` anhängen und auf `undefined`.
   - Private Methoden, Namen und Rümpfe aus dem Director: `#placeholder()` (`:2214`), `#evictShapes()` (`:2267`), `#forgetFailedShape()` (`:2284`), `#disposeShape()` (`:2297`), `#buildShape()` (`:2332`, `this.#clearUniform`/`this.#resolution` wie gehabt), `#compileShape()` (`:2431`, `this.outputRenderTarget` → `this.#director.outputRenderTarget`, `this.#withTarget` → `withTarget`, die Meldung `StageDirector#precompile(): the render pipeline drew without calling renderer.render(), and nothing was compiled` bleibt).

3. **Neu `DirectorMasks.ts`** — Kopfkommentar: die Masken der Slots und der laufenden Transitions eines Directors — ihre Prüfung vor jeder Änderung, die Nutzungen ihrer Stages, die Wache auf ihr `dispose()` und der Fortschritt, den die Transitions an ihre Masken geben —, nicht in `public-api.ts`.
   - Aus `StageDirector.ts` hierher, modullokal: `firstOnItsStage()` (`:253`).
   - `export interface DirectorMasksHost` (`@internal`), jedes Member mit einer Zeile TSDoc:
     - `slots(): readonly Slot[]` — die Slots des Directors, wie sie jetzt stehen (`#slots` wird in `setStack()` und `dispose()` neu zugewiesen; deshalb eine Funktion, kein Feld).
     - `layerOf(stage: IStage): Layer | undefined` — `#layers.get(stage)`.
     - `joinMask(subject: string, stage: StageDirectorLayer, errors: unknown[], scale: number): Layer | undefined` — `#join(subject, stage, errors, 'mask', scale)`.
     - `release(layer: Layer): void` — `#release(layer)`, wirft wie dieser.
     - `endRun(slot: Slot, keep: 'from' | 'to', state: 'finished' | 'cancelled', errors: unknown[]): void` — `#endRun(slot, keep, state, errors)`.
     - `slotsChanged(): void` — `#slotsChanged()`.
   - `export class DirectorMasks` (`@internal`), `constructor(director: StageDirector, host: DirectorMasksHost)`; privat `#director`, `#host`, `#watches` (die Map aus `#maskWatches` `:508`, Kommentar mit) und die Pfeilfunktion `#maskDisposed` (`:2015`, Meldung `StageDirector: more than one listener of OnStageTransitionEnd, OnStageRemoved and OnRemoveFromParent threw while a disposed mask left` bleibt).
   - Methoden, Rümpfe aus dem Director; `this.#slots` → `this.#host.slots()`, `this.#layers.get(s)` → `this.#host.layerOf(s)`, `this.#join(subject, stage, errors, 'mask', scale)` → `this.#host.joinMask(subject, stage, errors, scale)`, `this.#release` / `this.#endRun` / `this.#slotsChanged` → Host, `maskOwners.get(stage) !== this` → `!== this.#director`, `this.#holdRefusal(stage)` → `holdRefusal(this.#director, stage)`:
     - `check(subject: string, mask: unknown, layer?: IStage): StageMask | undefined` ← `#checkMask()` (`:1610`)
     - `checkEffectMasks(subject: string, options: {readonly effect: StageTransitionEffect; readonly instant: boolean}, layer: IStage | undefined, ends: (transition: StageTransition) => boolean): readonly StageMask[]` ← `#checkEffectMasks()` (`:1637`); der Director übergibt seine `ParsedOptions` unverändert (strukturell passend, `ParsedOptions` bleibt in `StageDirector.ts`).
     - `checkScales(subject: string, masks: readonly (StageMask | undefined)[]): void` ← `#checkScales()` (`:1661`)
     - `refuseDriven(subject: string, masks: readonly StageMask[]): void` ← `#refuseDrivenMasks()` (`:1589`)
     - `use(subject: string, masks: readonly StageMask[], errors: unknown[]): void` ← `#useMasks()` (`:1686`)
     - `unuse(masks: readonly StageMask[], errors: unknown[]): void` ← `#unuseMasks()` (`:1704`)
     - `maskSlot(subject: string, slot: Slot, mask: StageMask | undefined, errors: unknown[]): void` ← `#maskSlot()` (`:1715`)
     - `unmaskSlot(slot: Slot, errors: unknown[]): void` ← `#unmaskSlot()` (`:1729`)
     - `drop(layer: Layer, errors: unknown[]): void` ← `#dropMask()` (`:1934`)
     - `watch(): void` ← `#watchMasks()` (`:1979`)
     - `followProgress(): void` — die Schleife aus `updateFrame()` `:1280–1288` samt Kommentar; `const current = this.#slots` → `const current = this.#host.slots()`.
     - `followProgressNodes(): void` — die Schleife aus `renderToCurrentTarget()` `:1320–1328` samt Kommentar.
     - privat `#unuseMask(mask, errors)` ← `#unuseMask()` (`:1737`).

4. **`StageDirector.ts` danach.**
   - Felder: `#maskWatches`, `#shapes`, `#shapeKey`, `#shape`, `#shapesRenderer`, `#lettingGoErrors`, `#placeholders`, `#clearUniform`, `#resolution`, `#clearColorOfRenderer` entfallen. Neu, nach `#advancingRuns` und vor `#host`:
     ```ts
     readonly #shapeCache = new DirectorShapeCache(this, {
       rendererChanged: () => {
         for (const layer of this.#layers.values()) layer.needsPicture = true;
       },
     });
     readonly #masks = new DirectorMasks(this, {
       slots: () => this.#slots,
       layerOf: (stage) => this.#layers.get(stage),
       joinMask: (subject, stage, errors, scale) => this.#join(subject, stage, errors, 'mask', scale),
       release: (layer) => this.#release(layer),
       endRun: (slot, keep, state, errors) => this.#endRun(slot, keep, state, errors),
       slotsChanged: () => this.#slotsChanged(),
     });
     ```
     Je eine Zeile Kommentar darüber, was die Klasse hält. Die Pfeilfunktionen entstehen einmal je Director, nie je Frame.
   - `#compose` wird `(passes) => this.#shapeCache.fill(passes, this.#orderRefs)`.
   - `resize()`: im `finally` `this.#shapeCache.setResolution(Math.max(1, Math.floor(this.width * this.pixelRatio)), Math.max(1, Math.floor(this.height * this.pixelRatio)))`.
   - `updateFrame()`: die Masken-Schleife `:1280–1288` wird `this.#masks.followProgress();` an derselben Stelle.
   - `renderToCurrentTarget()` in genau dieser Reihenfolge: `const shape = this.#shapeCache.current(renderer, this.#slots);` · `if (super.pipeline !== shape.pipeline) super.pipeline = shape.pipeline;` · `this.#shapeCache.writeProgress(shape, this.#slots);` · `this.#masks.followProgressNodes();` · `this.#shapeCache.updateClear(renderer);` · der `try`/`catch` um `super.renderToCurrentTarget(renderer)` wie bisher · `const errors = this.#shapeCache.takeLettingGoErrors(); if (errors) throwCollected(errors, 'StageDirector: more than one effect threw from dispose() as the director let go of its shapes');`. Die Kommentare der Stelle bleiben.
   - `precompile()`: die Schleife über `parsed` wird
     ```ts
     for (const kinds of parsed) {
       if (this.isDisposed) break;
       const goOn = await this.#shapeCache.precompile(
         renderer,
         kinds,
         () => (asLayer ? (this.outputRenderTarget ?? target()) : undefined),
         errors,
         () => this.isDisposed,
       );
       if (!goOn) break;
     }
     ```
     Alles davor und danach (`parseShapes()` jetzt importiert, `#drawOffScreen()`, `passTarget`, das äußere `catch` mit `throwCollected([error, ...errors], …)`, `finally`, der letzte `throwCollected`) bleibt.
   - `dispose()`: `:1498–1509` wird `this.#shapeCache.dispose(errors);` an derselben Stelle (nach der Schleife über `#release()`, vor dem `throwCollected`).
   - `#slotsChanged()`: `this.#shapeKey = undefined` → `this.#shapeCache.invalidate()`, `this.#watchMasks()` → `this.#masks.watch()`; Reihenfolge der Zeilen bleibt.
   - Aufrufer der Masken-Methoden: `#checkMask` → `this.#masks.check` (in `show()`, `push()`, `setMask()`), `#checkEffectMasks` → `this.#masks.checkEffectMasks`, `#checkScales` → `this.#masks.checkScales`, `#refuseDrivenMasks` → `this.#masks.refuseDriven`, `#useMasks` → `this.#masks.use`, `#unuseMasks` → `this.#masks.unuse`, `#maskSlot` → `this.#masks.maskSlot`, `#unmaskSlot` → `this.#masks.unmaskSlot` (auch in `#removeSlot()` und `setStack()`), `#dropMask` → `this.#masks.drop` (in `remove()`).
   - `#drawOffScreen()` ruft `withTarget(renderer, target, true, () => stage.renderTo(renderer))`; `#withTarget()` entfällt.
   - Kommentare, die einen umgezogenen Member beim alten Namen nennen, nennen den neuen: »`#checkMask()` checks the rest« (`maskOption()`, `:437`) → »`DirectorMasks#check()` checks the rest«, »as `#checkMask()` refuses …« → »as `check()` refuses …«, »the callers have checked the scale … with `#checkScales()`« (`#join()`) → »with `DirectorMasks#checkScales()`«, »#useMasks()« im Kommentar von `#join()` → »`DirectorMasks#use()`«; der Kommentar von `#watches` sagt statt »kept in step with the slots by `#slotsChanged()`«, dass `watch()` es mit jeder Änderung der Slots abgleicht, die der Director über `#slotsChanged()` meldet. Suche danach mit `grep -n '#\(checkMask\|checkEffectMasks\|checkScales\|useMasks\|unuseMasks\|maskSlot\|unmaskSlot\|dropMask\|watchMasks\|maskDisposed\|currentShape\|buildShape\|shapesFor\|fillShape\|compileShape\|withTarget\|placeholder\|holdRefusal\)' packages/twopoint5d/src/stage/*.ts`.
   - Nicht mehr gebrauchte Importe fallen weg (`float`, `texture`, `uniform`, `uv`, `Color`, `ColorManagement`, `NoToneMapping`, `Vector2`, `Vector4`, `maskCoverage`, `maskSource`, `RootRenderPipeline`, `textureSource` — `pnpm lint` meldet jeden übrigen).
   - Unverändert bleiben: die öffentlichen Typen am Kopf (`StageDirectorLayer` … `StagePrecompileOptions`), die Klassen-TSDoc, jede öffentliche und geschützte Signatur, `public-api.ts`.

5. **Doku** — `packages/twopoint5d/docs/architecture.md`, Abschnitt `### stage/`, am Ende des Absatzes zu `StageDirector` (endet mit »… is [`docs/stages.md`](./stages.md).«), auf Englisch, ohne Rückblick: zwei Sätze, die sagen, dass das Bauen, Halten und Kompilieren der Shapes des Stapels — die Graphen, ihre Pipelines und Platzhalter, die 16 zuletzt gezeichneten neben den gepinnten — die interne Klasse `DirectorShapeCache` in `src/stage/DirectorShapeCache.ts` ist, die Masken der Slots und laufenden Transitions — Prüfung, Nutzung ihrer Stages, Wache auf ihr `dispose()` — `DirectorMasks` in `src/stage/DirectorMasks.ts`, beide über die Datensätze in `src/stage/directorSlots.ts`, während der Director Stapel, Layer und Transitions behält. Absatz neu umbrechen wie die Nachbarn (≈ 95 Zeichen). Guides (`docs/stages.md`) und Proposals bleiben unberührt: sie nennen keinen der umziehenden Member (geprüft mit `grep` über `packages/twopoint5d/docs/`).

6. **Prüfen, bevor du meldest.**
   - `pnpm build:twopoint5d`, dann `diff /tmp/claude-1000/-home-spw-spaceland-twopoint5d/25b68af0-a25d-4ede-b583-3d06a691b428/scratchpad/paket-11.StageDirector.before.d.ts packages/twopoint5d/dist/lib/stage/StageDirector.d.ts` — keine Zeile Unterschied. Das Ergebnis gehört in den Report.
   - `git diff --stat -- 'packages/twopoint5d/src/**/*.spec.ts'` ist leer.
   - `pnpm run ci` grün. Besonders: `pnpm test:allocations` (`hot-path-allocations.director.spec.ts` — fünf Fälle, `updateFrame()` und `renderTo()` mit Transition, Maske, Matte und Masken in der Welt einer Stage) muss ohne neue Bytes bleiben: kein Array, kein Objekt, keine Closure je Aufruf in `current()`, `writeProgress()`, `updateClear()`, `fill()`, `followProgress()`, `followProgressNodes()`. Fällt die Funktions-Coverage von `src/stage/**` (Schwelle 95 in `packages/twopoint5d/vite.config.ts`) unter die Schwelle, weil eine neue Host-Funktion von keinem Spec erreicht wird, kommt ein kleiner Spec für die neue Klasse dazu (`DirectorShapeCache.spec.ts` bzw. `DirectorMasks.spec.ts`); die Schwelle wird nicht gesenkt.

## Was gleich bleiben muss (für Implementierer und Review)

- Öffentliche API: `public-api.ts` unberührt, `StageDirector.d.ts` byte-gleich (Schritt 6).
- Jede Meldung wortgleich, jedes `throwCollected` an seiner Stelle mit seinem Text.
- Die Reihenfolge der Seiteneffekte in jeder umgezogenen Methode — besonders `#maskSlot` (Join vor Unuse), `#useMasks` (Rückgabe der Nutzungen bei Ablehnung), `#maskDisposed` und `drop()` (Schleifen über Kopien der Slots), `precompile()` (gepinnte Shape mit laufendem Compile, Fehlschlag nach `dispose()`), `#currentShape()` (LRU: zuletzt benutzte ans Ende, Eviction nie der neuesten und nie einer gepinnten).
- Hot Paths ohne Allokation (siehe Schritt 6).
- Projektregeln aus AGENTS.md: `#private`-Member, `.js`-Suffix, `import type` für Typen, englische Kommentare, keine Finding-ID, kein »moved from«/»previously« in Code und Doku.

## Für Zug 5 (Runner)

- Unter »Offene Befunde« im Plan den Eintrag »`packages/twopoint5d/src/texture/AsepriteJson.ts:128-129` … und `packages/twopoint5d/src/stage/StageDirector.ts:365`« auf die neue Fundstelle von `parseShapes()` in `packages/twopoint5d/src/stage/DirectorShapeCache.ts` (Datei und Zeile) nachführen.
- `Schnittstellen:` intern neu `directorSlots.ts` (`Layer`, `Run`, `Slot`, `OrderRef`, `maskOwners`, `layerOwners`, `NO_MASKS`, `masksOf()`, `holdRefusal()`), `DirectorShapeCache`/`DirectorShapeCacheHost`, `DirectorMasks`/`DirectorMasksHost`; der Director hält `#shapeCache` und `#masks`; keine Exporte neu oder entfernt. Paket 11b braucht davon: der Director überschreibt von `StageRenderer` weiter `renderToCurrentTarget()`, `shouldRenderPass()`, `resizeStage()`, `pipeline`, `buildOutputNode`, `renderOrder`, `orderedStages`, `add()`, `remove()`, `resize()`, `updateFrame()`, `dispose()` und ruft `invalidateOutputNode()` und `super.pipeline =`.

## Findings im Volltext

**ARCH-001 · medium · packages/twopoint5d/src/display/Display.ts:355** (weitere Fundstellen `Display.ts:433, 1398, 2105`, `stage/StageDirector.ts:500, 1391, 2229, 2427`) — `Display` und `StageDirector` in interne Teile mit eigenem Zustand zerlegen

Zwei Klassen tragen je mehrere Verantwortungen in einem gemeinsamen privaten Namensraum. `Display.ts` (2238 Zeilen, rund 60 `#`-Felder) vereint Lebenszyklus, Size-Watch (ResizeObserver, Media-Query), Size-Source-Auflösung, Fullscreen-Folge, Self-Size-Buchhaltung unter Pixel-Zoom und den Hold der three-Animation-Loop per `defineProperty` auf `renderer._animation`. `StageDirector.ts` (2499 Zeilen) führt den Stapel samt Transitions, die Masken-Buchhaltung, einen LRU-Cache der Shapes mit Pinning und das Precompile mit Monkey-Patch von `renderer.render`; jede Methode des Stapels muss die Reentrancy-Regeln aller anderen kennen. Jede Änderung an einem Teil verlangt, die übrigen mitzulesen.

Beleg: `export class Display {` Zeile 355–2238; `export class StageDirector extends StageRenderer {` 2499 Zeilen, 424 Zeilen mit `#`-Membern

Empfehlung: Im `Display` Size-Watch, Size-Source und Messung in ein internes `DisplaySizer` ziehen und den Hold der Animation-Loop in einen Helfer neben `canvasHandover.ts` — beides hat sich mit `resolveDrawingBuffer.ts` und `canvasHandover.ts` schon bewährt. Im `StageDirector` Shape-Bau, -Cache, -Eviction und Compile in eine interne `DirectorShapeCache` auslagern, die Masken-Buchhaltung ebenso; der Director behält Stapel und Transitions. Die öffentliche API bleibt unverändert.

(Display-Teil: erledigt in Paket 10, 8d624eec. Dieses Paket: der StageDirector-Teil.)

## Urteil des Reviewers (Zug 3)

- **ARCH-001 (Director-Teil): behoben.** Bau, Cache, LRU-Eviction samt Pinning und Compile mit Ersatz von `renderer.render` in `packages/twopoint5d/src/stage/DirectorShapeCache.ts:239` (Klasse), `:283` (`current()`), `:473` (`#evictShapes()`), `:601` (`#compileShape()`); Masken-Buchhaltung in `packages/twopoint5d/src/stage/DirectorMasks.ts:44`; gemeinsame Datensätze in `directorSlots.ts`; der Director hält `#shapeCache` und `#masks` (`StageDirector.ts:254`, `:261`). Verhaltensgleichheit gegen den alten `StageDirector.ts` geprüft (`#buildShape()` und Masken-Methoden per `diff` rumpfgleich, Meldungstexte und Reihenfolgen unverändert), keine neue Allokation in den Hot Paths.

## Kleine Befunde

- `packages/twopoint5d/src/stage/StageDirector.ts:1115` mit `DirectorShapeCache.ts:384`: jede Shape in `precompile()` ist ein eigener `await`, auch eine gecachte ohne laufendes Compile; die übrigen gecachten Shapes werden erst in späteren Microtasks gepinnt, ein synchroner Draw direkt danach kann bei mehr als 16 ungepinnten Shapes eine verdrängen und ein zweites Compile kosten. Der Detailplan schrieb die Schleifenform so vor. Als Folge in den Plan gestellt (`Folgen:` unter Paket 11), weil der Umbau unverändertes Verhalten zusagt.
- `packages/twopoint5d/src/stage/directorSlots.ts:74`: TSDoc von `OrderRef` verweist auf `distinctMasks()`, das modullokal in `DirectorShapeCache.ts` steht — der Verweis nennt die Datei nicht.
- `packages/twopoint5d/src/stage/StageDirector.ts:1612`: Kommentar in `#rebuildOrder()` nennt `distinctMasks()` ohne Ort, derselbe Punkt.

