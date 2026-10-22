# Paket 8 — FeatureSprites und Stage: Sortierung, Pass-Targets, Dispose-Vertrag

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-018 (low), PERF-006 (low), TEST-016 (low), READ-003 (info), CONS-007 (info), CONS-003 (low), PERF-007 (low), API-009 (low), API-010 (low), BUG-038 (low)
- Aufgenommen, gleiche Ursache:
  - zu READ-003: jede Prosa-Kommentarzeile über `lineWidth` 130 im Repo — 22 weitere Stellen (Liste in Schritt 9), darunter `src/sprites/features/Wave.ts:9` aus »Offene Befunde« und fünf Stellen, die Paket 4, 5 und 7 geschrieben haben
  - zu CONS-007: jede Prosazeile über 105 Zeichen in `packages/twopoint5d/docs/sprites.md` (17 statt 2) und `docs/architecture.md:240`, `:290`
  - zu API-010: die Reihenfolge der gesammelten Fehler in der TSDoc von `StageRenderer#add()`, `#remove()` und dem `parent`-Setter
- Ziel: `sortByViewDepth()` schreibt direkt in den Pool und ist auf eingesetzten Geometrien getestet, Texturwechsel und `ClearStage` im Composed-Modus werden erkannt, der Target-Pool verwendet Targets weiter, und der Dispose-Vertrag sowie die Doku sagen nur, was gilt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts`, `StageRenderer.spec.ts`, `StageRenderTargetPool.ts`, `StageRenderTargetPool.spec.ts`, `ClearStage.ts`, `Canvas2DStage.ts`, `Stage2D.ts`, `src/stage/README.md`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`, `VertexObjectPool.sortBy.spec.ts` (`describe('VertexObjectPool#sortByKeys()')` ab `:519`), `src/vertex-objects/hot-path-allocations.spec.ts`
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts`, `FeatureSprites.spec.ts`, `FeatureSpritesMaterial.ts`, `SpriteResources.ts`, `SpriteResources.spec.ts`
  - Doku: `packages/twopoint5d/docs/sprites.md`, `docs/architecture.md`, `packages/twopoint5d/docs/proposals/pool-sorting.md`, `packages/twopoint5d/docs/proposals/growing-capacity.md`, `packages/twopoint5d/CHANGELOG.md`
  - nur Kommentarumbrüche (Schritt 9): die 22 Dateien der Liste dort
- Vorgehen: siehe unten, Schritte 1–11 in dieser Reihenfolge
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: refuse a stage without asPassNode() under a composing pipeline at add() and at the pipeline and builder setters, resize a free target of a render target pool to the size asked for, release the pass node memory only of a stage that has the method, write the view depth of sortByViewDepth() straight into the sort scratch of the pool, state the error contract of the stage teardowns without the order of the errors, say which changes of a set texture take touchTexture(), test sortByViewDepth() on a geometry put into the slot, and wrap the comments and doc paragraphs that run past their width`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · BUG-018 unverändert (`SpriteResources.ts:138`, `textureShapeKey.ts:65`) · PERF-006 unverändert (`FeatureSprites.ts:254`, `:475–491`; Kopie `VertexObjectPool.ts:512–513`) · TEST-016 unverändert (`FeatureSprites.spec.ts:1047`) · READ-003 nach `FeatureSprites.ts:42` gewandert · CONS-007 nach `sprites.md:1604`/`:2190` gewandert, 15 weitere Zeilen derselben Ursache · CONS-003 unverändert (`docs/architecture.md:160–167`, `vite.config.ts:64`) · PERF-007 unverändert (`StageRenderTargetPool.ts:71`/`:73`, `StageRenderer.ts:879`, `:908–920`) · API-009 unverändert (`StageRenderer.ts:1026–1033`, `:1005–1011`, `ClearStage.ts:11–21`) · API-010 unverändert (`StageRenderer.ts:1113–1123`, `Canvas2DStage.ts:276–286`, `Stage2D.ts:447–453`) · BUG-038 unverändert (`StageRenderer.ts:706`) · Folgen der Pakete 1–7: keine offen; fünf überlange Kommentarzeilen aus Paket 4, 5, 7 als Symptom zu READ-003 hier · aus »Offene Befunde« übernommen: `Wave.ts:9`
  - 2026-10-22 Zug 1: Implementierer beauftragt (sonnet, effort medium), Brief `paket-8.impl-0.brief.txt`, Report nach `paket-8.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG (session 00e45215-f935-4b62-b3ff-11ab271ea100) · 39 Dateien geändert (Stage, Pool, FeatureSprites, Doku, 22 Umbruchdateien plus `fakeCanvas.ts`, `typedNodes.ts`, `types.ts`, drei `.js`-Testhelfer) · rote Läufe vor dem Fix für Schritt 1, 2, 3 belegt · Arbeitsbaum schmutzig · eigenes Verify `pnpm run ci` → `paket-8.verify.log` exit=0
  - 2026-10-22 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-8.diff`, Report nach `paket-8.review-0.json`
  - 2026-10-22 Zug 3: Urteil: alle zehn Findings behoben, kritisch 0, wichtig 0, klein 5 · Diff `paket-8.diff` (2973 Zeilen) · keine Fehlerkette
  - 2026-10-22 Zug 5: Commit 92091780 auf Verify `paket-8.verify.log` exit=0 (kein Code seit dem Lauf geändert) · Commit-Message gegenüber der Zeile oben um »name the exception of src/sprites from the coverage threshold in the architecture guide« ergänzt (Hinweis des Reviewers)

## Was für das ganze Paket gilt

- `AGENTS.md` im Repo-Root zuerst lesen, dazu »Konventionen« im Kopf von `./remediation-plan.md`: Code, Kommentare, Doku, CHANGELOG und Commit auf Englisch, keine Finding-IDs, kein Rückblick auf den Vorzustand (»no longer«, »now«, »instead of before« fallen weg — ein Satz beschreibt, was gilt).
- `src/sprites/**` steht in `packages/twopoint5d/vite.config.ts:64` auf **100 %** Statements, Branches, Functions und Lines. Jeder neue oder geänderte Zweig unter `src/sprites/` braucht einen Test, sonst ist `pnpm test:coverage` rot.
- Schnittstellen aus erledigten Paketen, gegen die hier gebaut wird:
  - `VertexObjectPool#slotMoves` (`@internal`, Paket 6) steigt in `#sortByOwnKeys()`, wenn ein Sort bewegt; `SpritePicker` liest ihn. Der neue Sortierpfad aus Schritt 5 läuft über `#sortByOwnKeys()` und erbt das.
  - `FeatureSprites#sortBy()` reicht per Cast `as VOSortKeyName<Api & VO> | VOSortKey<Api & VO>` an den Pool weiter (Paket 5) — bleibt, wie er ist.
  - `typed-stages.spec.ts` (Paket 7) verbietet `as unknown as` in Nicht-Spec-Dateien unter `src/sprites/features/` und `src/sprites/passes/`; der Umbruch in `Wave.ts` ändert nur einen Kommentar.
- Alle Zeilen, die dieses Paket neu schreibt, halten die Breiten aus Schritt 9 und 10 ein: Kommentare ≤ 130 Zeichen und im Umbruch der umgebenden Kommentare, Prosa in `docs/sprites.md` ≤ 100.
- Bei jedem Korrektheitsfehler (BUG-038, API-009, PERF-007) zuerst der Regressionstest, rot sehen, dann der Fix. Der rote Lauf gehört in den Report.

## Schritte

### 1. BUG-038 — `releasePassNodeMemory()` nur rufen, wo es sie gibt

`StageRenderer.ts:701–708`, `#releasePassMemoryOf()`: der `isStage2D`-Zweig ruft
`(stage as Stage2D).releasePassNodeMemory()`. Ein Objekt mit dem Flag ohne die Methode
(zweite Kopie der Bibliothek, ein Double) wirft dort in `remove()`, `dispose()` und
`#modeInputChanged()`.

- Erst der Test in `StageRenderer.spec.ts`, neben den vorhandenen Tests zu
  `releasePassNodeMemory`: `a stage flagged isStage2D without releasePassNodeMemory() leaves through remove(), dispose() and a write that leaves the composed mode`.
  Ein Double `{name, isStage2D: true, camera, asPassNode, renderTo, updateFrame, resize}`
  ohne `releasePassNodeMemory` — mit Kamera und `asPassNode()`, denn Schritt 2 lässt im
  Composed-Modus keine Stage ohne `asPassNode()` mehr zu. Drei Fälle, je ohne Wurf:
  `add()` + `remove()`; `add()` + `dispose()`; Composed-Modus (`buildOutputNode` plus
  Pipeline-Mock wie in `:2660–2661`) mit dem Double, dann `sr.pipeline = undefined`.
  Rot vor dem Fix (`TypeError … is not a function`).
- Fix: `(stage as Partial<Stage2D>).releasePassNodeMemory?.();`. Der Kommentar darüber
  sagt, warum gefragt wird: das Flag erkennt einen `Stage2D` ohne Laufzeit-Import, und
  ein Objekt mit dem Flag aus einer anderen Kopie der Bibliothek oder ein Double muss die
  Methode nicht haben.

### 2. API-009 — eine Stage ohne `asPassNode()` im Composed-Modus früh abweisen

Entscheidung des Laufs vom 2026-10-21 (Zeile 4 der »Entscheidungen«): `ClearStage` im
Composed-Modus wird gefixt **und** dokumentiert. Heute wirft `#getStagePass()`
(`StageRenderer.ts:1026–1033`) beim Rebuild in `renderTo()`; `#outputDirty` bleibt `true`,
der Fehler kommt jeden Frame aus dem `onRenderFrame` des Hosts. Gefixt wird an den drei
Stellen, an denen eine solche Stage unter eine komponierende Pipeline gerät.

- Modus ohne Seiteneffekt berechnen: eine private Methode (oder modulweite Funktion)
  `#modeOf(pipeline, buildOutputNode): StageRendererMode` mit der Logik von
  `#renderMode()` (`:783–786`); `#renderMode()` ruft sie mit den Feldern.
- `add(stage)` (`:1268`): nach der Prüfung auf eine disposed Stage und **vor**
  `this.resizeStage(item, …)`: ist `this.#renderMode() === 'composed'` und
  `!hasAsPassNode(stage)`, wirft
  `new TypeError(`StageRenderer#add() cannot take the stage ${JSON.stringify(stage.name)}: that stage has no asPassNode(), and a pipeline with buildOutputNode or a RootRenderPipeline composes the pass node of every stage`)`.
  Nichts hat sich dann geändert: keine Größe an die Stage, kein Eintrag in `stages`,
  kein `OnStageAdded`, kein Listener, kein Wechsel des Holders eines Kind-Renderers.
- `pipeline`-Setter (`:564–571`): innerhalb von `if (this.#pipeline !== pipeline)` und
  vor der Zuweisung: ist `#modeOf(pipeline, this.#buildOutputNode) === 'composed'`, wirft
  er für die erste Stage in `this.#stages` ohne `asPassNode()`
  `new TypeError(`StageRenderer#pipeline cannot take the pipeline: the stage ${JSON.stringify(name)} has no asPassNode(), and a pipeline with buildOutputNode or a RootRenderPipeline composes the pass node of every stage`)`.
  Die Pipeline von vorher bleibt.
- `buildOutputNode`-Setter (`:631–641`): nach der Prüfung auf einen disposed Builder, vor
  der Zuweisung: ist `#modeOf(this.#pipeline, buildOutputNode) === 'composed'`, dieselbe
  Prüfung mit
  `StageRenderer#buildOutputNode cannot take the builder: the stage ${JSON.stringify(name)} has no asPassNode(), and a pipeline with buildOutputNode or a RootRenderPipeline composes the pass node of every stage`.
  Der Builder von vorher bleibt. Ein Builder ohne Pipeline bleibt erlaubt (Modus `plain`).
- `#getStagePass()` behält Wurf und Meldung: er trifft nur noch eine Stage, die ihr
  `asPassNode()` nach dem `add()` verliert.
- TSDoc: `add()` nennt die Ablehnung neben der für eine disposed Stage; `pipeline` und
  `buildOutputNode` nennen ihre Ablehnung (heute »the write is a silent no-op« nur für den
  disposed Renderer). `ClearStage` (`ClearStage.ts:11–21`): sie wirkt ohne Pipeline und in
  Mode C (eine Pipeline ohne `buildOutputNode`, die keine `RootRenderPipeline` ist), wo alle
  Stages in ein Target zeichnen. Unter einer komponierenden Pipeline zeichnet jede Stage in
  ein Target mit eigenem Tiefenpuffer (der `pass()`-Node eines `Stage2D`, das Pass-Target
  eines Kind-Renderers), die Komposition legt sie übereinander, und zwischen ihnen gibt es
  nichts zu löschen: `StageRenderer#add()` lehnt eine `ClearStage` dort ab, und ebenso der
  `pipeline`- und der `buildOutputNode`-Setter, solange eine unter den Stages ist. Das
  Beispiel (`root.add(world).add(new ClearStage(...)).add(ui)`) bleibt, es ist Plain-Modus.
- `src/stage/README.md`: im Abschnitt »Intermediate clear with `ClearStage`« (`:136–149`)
  ein Satz, dass sie nur ohne Pipeline und in Mode C gilt; im Pitfall »Composing + non-pass
  stages« (`:755–758`) ersetzt die Ablehnung durch `add()` und die beiden Setter den Satz
  »The renderer throws with a clear message in that case.«
- Tests in `StageRenderer.spec.ts`, rot vor dem Fix mindestens der erste:
  - `add() refuses a stage without asPassNode() under a composing pipeline, before it sizes, lists or announces it` — unter `buildOutputNode` + Pipeline und unter einer `RootRenderPipeline` (`fakeRootPipeline()`); `resize` der Stage nicht gerufen, `stages` unverändert, kein `OnStageAdded`.
  - `the pipeline setter refuses a pipeline that composes while a stage without asPassNode() is among the stages, and keeps the one it had` — für eine `RootRenderPipeline` und für eine Pipeline neben einem gesetzten `buildOutputNode`.
  - `the buildOutputNode setter refuses a builder over a pipeline while a stage without asPassNode() is among the stages, and keeps the one it had`; daneben: ein Builder ohne Pipeline wird genommen.
  - `renderTo() throws for a stage that has lost its asPassNode() since it was added` — hält den Zweig in `#getStagePass()`.
  - neu, bisher ohne Test: `a ClearStage draws its clear in the plain mode and in Mode C` — unter den Aufrufen von `renderer.clear` einer mit `(false, true, false)` in beiden Modi (in Mode C ruft auch das Löschen des internen Targets auf transparentes Schwarz `renderer.clear(true, true, false)`).
- Tests gegen das alte Verhalten umschreiben: `StageRenderer.spec.ts:2669` (`throws when a stage in the build path has no asPassNode()`) und `:2678` (`throws the same error under a RootRenderPipeline without buildOutputNode`) erwarten den Wurf in `renderTo()`; nach dem Fix wirft schon der `pipeline`-Setter — sie werden zu den Setter-Tests oben. Jede weitere Spec unter `src/stage/` und in `packages/twopoint5d-testing/test/`, die eine Stage ohne `asPassNode()` unter eine komponierende Pipeline bringt, ist ebenso ein Test des alten Verhaltens: auf die Ablehnung umstellen oder der Stage ein `asPassNode()` geben.
- CHANGELOG (Schritt 11): Breaking unter »Changed« mit Migrationshinweis.

### 3. PERF-007 — ein freies Pool-Target per `setSize()` weiterverwenden

`StageRenderTargetPool.acquire()` (`StageRenderTargetPool.ts:52–75`) verwirft bei einem
Fehlgriff alle freien Targets (`:71`) und baut ein neues (`:73`). Jeder Schritt der
adaptiven Auflösung ändert die Device-Größe, die `StageRendererTargets.acquireInternalTarget()`
anfragt (`StageRendererTargets.ts:48–60`); mit dem neuen `rt.texture` baut
`#wireInternalOutputNode()` (`StageRenderer.ts:908–920`) einen neuen `texture()`-Node und
setzt `pipeline.needsUpdate = true`.

- Neu in `acquire()`, nach der Schleife über die exakt passenden freien Targets: das
  älteste freie Target (erste Fundstelle in `#entries`, Bau-Reihenfolge) mit
  `rt.texture.type === type && rt.samples === samples` bekommt `rt.setSize(width, height)`,
  wird als verliehen markiert und zurückgegeben; jedes **andere** freie Target wird
  disposed und fällt aus `#entries` (der Eintrag des umdimensionierten behält seinen
  Platz). three's `RenderTarget.setSize()` (three 0.186.1, `src/core/RenderTarget.js:365–393`)
  ruft bei geänderter Größe selbst `this.dispose()`: der GPU-Speicher der alten Größe geht,
  Objekt, `texture` und jeder `texture()`-Node darauf bleiben. Gibt es kein freies Target
  dieses Typs und dieser Samples, bleibt es beim heutigen Weg: `#releaseFreeTargets()`,
  dann ein neues `RenderTarget`. Am einfachsten über einen Parameter
  `#releaseFreeTargets(keep?: StageRenderTargetPoolEntry)`.
- Abweichung von nichts, aber zu wissen: ein Renderer, der während des Draws eines
  anderen borgt (ein Mode-C-Kind unter einem Mode-C-Elternteil), findet nach einem
  Größenwechsel sein altes Target disposed und bekommt ein neues — der Eltern-Renderer hat
  beim Fehlgriff die übrigen freien Targets freigegeben. Das ist die Empfehlung des Audits;
  die Klassen-TSDoc sagt es in einem Satz.
- TSDoc der Klasse (`:24–30`): ein Target wird in genau der angefragten Breite und Höhe
  verliehen, mit Typ und Samples, mit denen es gebaut wurde. Hat kein freies Target die
  Größe, wird das älteste freie dieses Typs und dieser Samples auf sie umdimensioniert —
  dasselbe Objekt, also bleiben der `texture()`-Node von Mode C und die Pipeline darauf
  über einen Wechsel der Pixel Ratio stehen — und jedes andere freie Target freigegeben;
  ohne ein solches werden alle freien freigegeben und ein neues gebaut. Ein Pool, den
  Renderer verschiedener Größe teilen, dimensioniert sein Target bei jedem Wechsel um und
  belegt dabei jedes Mal neuen GPU-Speicher — je Größe ein eigener Pool. TSDoc von
  `acquire()` (`:46–52`): »a free one that fits, or a new one« wird zu den drei Wegen.
- `src/stage/README.md:334–337`: derselbe Inhalt.
- Tests, rot vor dem Fix:
  - `StageRenderTargetPool.spec.ts:49–70`: die Fälle `width` und `height` werden zu `resizes the oldest free target of the type and the samples for another ${what}, the same object` — derselbe Rückgabewert wie `old`, neue Größe, `dispose`-Spy einmal auf `old` (durch `setSize()`). Die Fälle `type` und `samples` bleiben, wie sie sind.
  - neu: `resizes the oldest of two free targets of the type and the samples asked for and releases the other` — zwei verleihen, beide zurück, eine andere Größe anfragen: das zuerst gebaute kommt umdimensioniert zurück, das zweite ist disposed und wird nicht mehr verliehen.
  - `StageRenderer.spec.ts:3051` (`a target borrowed from the pool follows the ratio in the next frame, and the pool releases the one of the old size`) wird zu `a target borrowed from the pool follows the ratio in the next frame as the same object, and Mode C keeps its texture node and its pipeline` — `targets[1]` ist `first`, Größe `[75, 75]`; nach dem ersten Frame `pipeline.needsUpdate = false` setzen, nach dem zweiten erwarten: weiterhin `false`, `pipeline.outputNode` derselbe Node.
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js` (Pool-Fälle ab `:593`) bleibt grün.
- CHANGELOG (Schritt 11): »Changed«, ohne Migration Guide — `acquire()` liefert weiterhin ein Target der angefragten Größe, nur das Objekt eines freien Targets kommt umdimensioniert zurück statt disposed.

### 4. API-010 — der Fehlervertrag der Teardowns ohne Reihenfolge

Die TSDoc sagt, in welcher Reihenfolge und Verschachtelung die Fehler im `AggregateError`
ankommen. Der Vertrag wird auf das reduziert, was ein Aufrufer prüft: der Teardown läuft
vollständig, danach kommt ein Fehler unverändert, mehrere als `AggregateError`.

- `StageRenderer#dispose()` (`StageRenderer.ts:1113–1123`): den Absatz ab »A listener that
  throws does not hold up the teardown« so fassen, dass er nennt, *welche* Fehler
  mitkommen (Listener von `OnStageRemoved`, `OnRemoveFromParent`, `OnStageDispose`, ein
  werfendes Unsubscribe des Hosts, das die andere Subscription nicht aufhält) und dass sie
  nach dem vollständigen Teardown kommen — einer unverändert, mehrere als
  `AggregateError` —, ohne »in the order they arose: …«, ohne »Each is as it was thrown —
  an `AggregateError` itself when …«.
- `Canvas2DStage#dispose()` (`Canvas2DStage.ts:276–286`): die Sätze ab »Three parts
  contribute one error each at most« fallen weg; der Satz davor (welche Listener und das
  Freigeben des Pass-Nodes mitzählen) bleibt.
- `Stage2D#dispose()` (`Stage2D.ts:447–453`): »An error from releasing the pass node
  reaches the caller as well: on its own unchanged, together with that of the listeners as
  an `AggregateError` … in this order — the first an `AggregateError` itself when more than
  one listener threw.« wird zu: ein Fehler beim Freigeben des Pass-Nodes kommt ebenso mit,
  nach derselben Regel.
- Gleiche Ursache, mitgenommen: die Reihenfolge-Angaben in der TSDoc des `parent`-Setters
  (`StageRenderer.ts:267–274`: »in the order they arose«, »ahead of them«), von `add()`
  (`:1242–1250`: »in the order they arose«, »ahead of them«) und von `remove()`
  (`:1355–1360`: »those of `OnStageRemoved` first«). Was mitkommt, bleibt gesagt; wie es
  geordnet ist, nicht.
- Nicht angefasst: die TSDoc des Resize-Pfads (`:418–430`, »`errors` … stands in the order
  in which the stages were added, the error of a render target first«). Sie ordnet jeden
  Fehler der Stage zu, die die Größe verweigert hat, und gehört zu keiner Teardown-Kaskade.
- Die Reihenfolge wandert in einen Code-Kommentar: in `StageRenderer#dispose()`,
  `Canvas2DStage#dispose()` und `Stage2D#dispose()` je eine Zeile vor dem Werfen der
  gesammelten Fehler, dass ihre Reihenfolge die des Teardowns ist und kein Vertrag. Die
  Specs, die die Reihenfolge prüfen, bleiben, wie sie sind.
- `src/stage/README.md:586`, `:636` sagen schon nur »one unchanged, several as an
  `AggregateError`« — bleiben.
- CHANGELOG (Schritt 11): »Changed«.

### 5. PERF-006 — `sortByViewDepth()` schreibt in den Sort-Scratch des Pools

`FeatureSprites#sortByViewDepth()` hält `#depthKeys` (`FeatureSprites.ts:253–254`,
angelegt `:475–479`, freigegeben `:652`), schreibt dort hinein und ruft
`pool.sortByKeys(keys)` (`:491`), das die Keys in `#sortKeys` kopiert
(`VertexObjectPool.ts:512–513`).

- `VertexObjectPool.ts`, direkt nach `sortByKeys()` (`:502–515`), zwei interne Member:
  - `prepareSortKeys(): Float64Array` — `return this.#prepareSort();`. TSDoc mit
    `@internal`: die Keys des nächsten Sorts, der Scratch des Pools passend zur Kapazität;
    der Aufrufer schreibt den Key von Slot `i` an Index `i` für jeden Slot unter
    `usedCount` und ruft gleich danach `sortByPreparedKeys()`, bevor irgendetwas diesen Pool
    sortiert. Alloziert nur, wenn die Kapazität seit dem letzten Sort gewachsen ist.
  - `sortByPreparedKeys(options?: VOSortOptions): boolean` — `false` auf einem disposed
    Pool und unter zwei Slots in Gebrauch; wirft
    `new Error('VertexObjectPool#sortByPreparedKeys(): no keys are prepared for the capacity of this pool — call prepareSortKeys() first')`,
    wenn `#sortKeys` fehlt oder kürzer als `capacity` ist; sonst
    `return this.#sortByOwnKeys(n, options?.descending === true);`. TSDoc mit `@internal`;
    alles Übrige ist `sortBy()`, `slotMoves` steigt mit, wenn ein Slot sich bewegt.
  - Nicht in `public-api.ts`.
- Feldkommentar `:90–93` nennt den neuen Weg neben `sortBy()` und `sortByKeys()`.
- TSDoc von `sortByKeys()` (`:490–491`): »The form for keys worked out in bulk, as
  `FeatureSprites#sortByViewDepth()` does.« wird zu: die Form für Keys, die außerhalb des
  Pools in einem Rutsch entstehen — ein Array für zwei Pools, die ihre Slots per Index
  paaren (siehe `sortBy()`).
- `FeatureSprites.ts`: Feld `#depthKeys` samt Kommentar weg (der Kommentar an
  `:253` bleibt für `#modelView` stehen, ohne die Keys); `:475–479` wird zu
  `const keys = pool.prepareSortKeys();`, `:491` zu `return pool.sortByPreparedKeys();`;
  `:652` (`this.#depthKeys = undefined;`) entfällt. Die Prüfreihenfolge bleibt: erst
  `instancePosition` (Wurf), dann `n < 2` (ein disposed Pool hat `usedCount` 0), dann die
  Keys. TSDoc »Allocates nothing once its scratch is there« bleibt wahr — es ist der
  Scratch des Pools.
- Tests:
  - in `VertexObjectPool.sortBy.spec.ts`, ein `describe('VertexObjectPool#sortByPreparedKeys()')` neben dem von `sortByKeys()` (`:519`): `sortByPreparedKeys() sorts the slots in use by the keys written into prepareSortKeys(), in both directions and with a NaN last`, `raises slotMoves when a slot moves and leaves it when none does`, `answers false on a disposed pool and with fewer than two slots in use`, `refuses a sort before prepareSortKeys() has made the keys fit the capacity` (nach einem Wachsen des Pools), `prepareSortKeys() answers the same array until the capacity grows`.
  - `src/vertex-objects/hot-path-allocations.spec.ts`: eine Runde `prepareSortKeys()`, Keys schreiben, `sortByPreparedKeys()` alloziert nichts — nach dem Muster von `sortByKeys() allocates nothing once the scratch is there` (`:285`).
  - `src/sprites/hot-path-allocations.spec.ts:358` (`sortByViewDepth() and sortBy() …`) und `src/sprites/FeatureSprites/FeatureSprites.sortBy.spec.ts` bleiben grün; `sorting.bench.ts` compiliert.
- Doku:
  - `packages/twopoint5d/docs/proposals/pool-sorting.md:97–98`: `sortByKeys` ist die Form für Keys von außerhalb des Pools, etwa ein Array für zwei gepaarte Pools — nicht mehr das Beispiel `sortByViewDepth()`; `:224–227`: die Tiefe geht direkt in den Sort-Scratch des Pools (`prepareSortKeys()`, intern), dann `sortByPreparedKeys()`; `:236–238`: allokationsfrei, sobald der Scratch des Pools steht, der mit der Kapazität wächst.
  - `packages/twopoint5d/docs/proposals/growing-capacity.md:79–80`: `sortByViewDepth()` schreibt in den Sort-Scratch des Pools, den der neue Pool bei seinem ersten Sort anlegt wie jeder Pool.
  - `docs/sprites.md:2718` bleibt wahr.
- Kein CHANGELOG-Eintrag: beide Member sind intern, `sortByViewDepth()` steht unter `[Unreleased]` »Added«, und dessen Eintrag bleibt wahr.

### 6. TEST-016 — `sortByViewDepth()` auf einer eingesetzten Geometry

In `FeatureSprites.spec.ts`, `describe('another geometry in the slot')` (`:1030`), neben
`:1047`: `sortByViewDepth() sorts the pool of a geometry put into the slot, past the capacity the sprites were built with`.
Sprites mit `capacity: 2` und `passes: [ShadowPass]`, `other = new FeatureSpritesGeometry(TexturedSpriteKind, 4)`
in den Slot; drei Sprites `a`, `b`, `c` mit `setPosition(0, 0, z)` für `z` = 0, −5, −2;
eine `PerspectiveCamera` (aus `three/webgpu` importieren) auf `(0, 0, 10)`, sie blickt entlang −z. Erwartet:
`sortByViewDepth(camera)` ist `true`; `other.instancedPool.getVO(0)`, `(1)`, `(2)` sind
`b`, `c`, `a`; `other.instancedPool.slotMoves` ist gestiegen; der Pass-Mesh zeichnet
`other`; der Pool der gebauten Geometry hat `usedCount` 0. Drei Sprites über der
gebauten Kapazität 2 zeigen, dass der Key-Scratch dem Pool im Slot folgt.

### 7. BUG-018 — welche Änderung an einer gesetzten Textur `touchTexture()` braucht

Der Shape-Key (`SpriteResources.ts:138–144`, `textureShapeKey()` in `textureShapeKey.ts:65`)
wird nur gelesen, wenn das Signal der Textur feuert — bei `setTexture()` mit einer anderen
Textur und bei `touchTexture()`. Ändert der Aufrufer `minFilter`/`magFilter`, `colorSpace`,
`type` oder `format` einer gesetzten Textur so, dass sie eine Textur anderer Art wird
(etwa zweimal `NearestFilter` → `LinearFilter`), bleibt der Graph bei der alten Bindung.
`setTexture()` mit der Textur, die schon gesetzt ist, tut nichts (das Signal vergleicht
per Identität).

- `SpriteResources.ts`: TSDoc von `setTexture()` (`:256–260`) bekommt den Satz, dass
  `setTexture()` mit der gesetzten Textur nichts tut; TSDoc von `touchTexture()`
  (`:267–270`): liest Bild **und** Art der Textur neu — `TextureLoader` schreibt ein
  geladenes Bild ohne Event in dieselbe Textur, und eine Änderung von Filtern,
  `colorSpace`, `type` oder `format` kann sie zu einer Textur anderer Art machen (siehe
  `textureShapeKey()`), die die Graphen erst hier erfahren und dann neu bauen; nach dem
  Laden und nach einer solchen Änderung aufrufen.
- `FeatureSpritesMaterial.ts`: `setTexture()` (`:358–369`) und `touchTexture()`
  (`:373–375`) sagen dasselbe kurz und verweisen auf `SpriteResources`.
- `FeatureSprites.ts`: `touchTexture()` (`:586–587`): »once a loader filled in its image
  or its filters, `colorSpace`, `type` or `format` changed«.
- `packages/twopoint5d/docs/sprites.md:1066–1068`: an den Absatz zu `setTexture()`,
  `getTexture()`, `touchTexture()` dieselbe Aussage, mit dem Beispiel des Wechsels von
  `NearestFilter` auf `LinearFilter`; der Absatz danach (`:1070–1078`, »Of the same kind
  means …«) definiert die Art schon.
- Vertragstest in `SpriteResources.spec.ts`: `a change of the filters of the texture that is set keeps its shape until touchTexture(), which then gives it the shape of its new kind` —
  Textur mit `NearestFilter`/`NearestFilter` setzen, `shapeOf()` merken, beide Filter auf
  `LinearFilter`, `setTexture()` mit derselben Textur: `shapeOf()` unverändert;
  `touchTexture()`: `shapeOf()` geändert. Läuft sofort grün; es pinnt den dokumentierten
  Vertrag, kein Bugfix-Test.
- Keine Erkennung im Frame-Pfad, keine Dev-Warnung (Gründe unten).

### 8. CONS-003 — die 100-%-Ausnahme in `docs/architecture.md`

`docs/architecture.md:160–167` sagt, die Schwellen lägen »globally and per module« beim
gemessenen Wert abgerundet minus zwei. Nach »A regression turns the gate red, a line that
moves does not.« ein Satz: `src/sprites/**` ist die Ausnahme und steht auf 100 % für
Statements, Branches, Functions und Lines — das Sprite-Modul wurde mit vollständiger
Abdeckung als Anforderung neu gebaut, eine Zeile ohne Test ist dort eine Regression, kein
Rauschen (Begründung aus dem Kommentar in `packages/twopoint5d/vite.config.ts:53–56`).
Umbruch in der Breite des Absatzes (≤ 90).

### 9. READ-003 und dieselbe Ursache — Kommentarzeilen über `lineWidth` 130

Biome bricht Kommentare nicht um. Jede Zeile unten von Hand umbrechen, an Wortgrenzen,
ohne ein Wort zu ändern; ein einzeiliges `/** … */` wird ein mehrzeiliger Block. Breite
wie die der Kommentare drumherum (meist ≈ 100), höchstens 130.

Prosa (vorbestehend, wenn nicht anders vermerkt):

- `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:42` (READ-003)
- `packages/twopoint5d/src/sprites/features/Wave.ts:9` (aus »Offene Befunde«)
- `packages/twopoint5d/src/sprites/typedNodes.ts:6` (Paket 7)
- `packages/twopoint5d/src/display/AdaptiveResolution.ts:124` (Paket 4)
- `packages/twopoint5d/src/vertex-objects/vertexObjectProperties.ts:15`, `:17` (Paket 5)
- `packages/twopoint5d/src/testing/fakeCanvas.ts:58`
- `packages/twopoint5d/src/texture/TileSet.ts:67`
- `packages/twopoint5d/src/texture/DynamicAtlas.ts:187`
- `packages/twopoint5d/src/texture/TextureAtlas.ts:5`
- `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:16`
- `packages/twopoint5d/src/vertex-objects/types.ts:22`, `:272`, `:325`
- `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:15`
- `packages/twopoint5d-testing/test/sprites-palette-swap.test.js:118`
- `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts:11`
- `apps/lookbook/src/demos/cardboard-parade/CardboardParade.ts:137`

Sonderfälle:

- `packages/twopoint5d/src/display/hot-path-allocations.adaptive-resolution.spec.ts:34`
  (Paket 4) ist ein `// biome-ignore lint/suspicious/noThenProperty: …`. Die
  Unterdrückung muss eine Zeile direkt über dem Code bleiben: den Grund auf ≤ 130 kürzen
  (etwa `a stand-in for the promise resolveTimestampsAsync() answers`); was dabei wegfällt,
  in eine Kommentarzeile **über** die Unterdrückung.
- JSDoc-Typen: `packages/twopoint5d-testing/test/stage-pipeline.test.js:420`,
  `packages/twopoint5d-testing/test/sprites-pipeline-stages.test.js:50`,
  `packages/twopoint5d-testing/test/helpers/fixtures.js:573`. Den Typ innerhalb der
  Klammern über Zeilen mit ` * ` umbrechen, ein Member je Zeile; `pnpm typecheck` prüft die
  Browsertests. Lehnt TypeScript den Umbruch ab, einen `@typedef` darüber anlegen und auf
  ihn verweisen.

Prüfung am Ende, nach allen anderen Schritten — gibt nichts aus:

```bash
find packages/twopoint5d/src packages/twopoint5d-testing apps/lookbook/src scripts -name node_modules -prune -o \( -name "*.ts" -o -name "*.js" -o -name "*.mjs" -o -name "*.astro" \) -type f -print | xargs awk 'length > 130 && ($0 ~ /^[ \t]*(\*|\/\/|\/\*\*)/) {print FILENAME":"FNR": "length}'
```

### 10. CONS-007 und dieselbe Ursache — Absätze außerhalb des Umbruchs

`packages/twopoint5d/docs/sprites.md` bricht Prosa bei ≈ 100 um; eingefügte Sätze stehen
darüber hinaus. Jeden Absatz und jeden Listenpunkt mit einer Zeile über 105 Zeichen —
außerhalb von Codeblöcken, Tabellen und Überschriften — neu umbrechen, auf ≤ 100, ohne ein
Wort zu ändern; Listenpunkte behalten ihre Einrückung. Stand heute 17 Zeilen: 53, 54, 1063,
1264, 1593, 1604 (CONS-007), 1789, 1790, 2009, 2150, 2190 (CONS-007), 2195, 2257, 2306,
2316, 2350, 2585 — die Nummern verschieben sich durch Schritt 7. Ebenso
`docs/architecture.md:240` (112) und `:290` (159) in der Breite ihres Absatzes (≤ 90).

Prüfung am Ende — gibt nichts aus:

```bash
awk 'BEGIN{c=0} /^[ \t]*(```|~~~)/{c=!c; next} !c && length > 105 && $0 !~ /^\|/ && $0 !~ /^#/ {print FNR": "length}' packages/twopoint5d/docs/sprites.md
```

Nicht angefasst: `packages/twopoint5d/docs/resource-lifecycle.md:70` und
`packages/twopoint5d/src/vertex-objects/README.md:328` — je ein einzelner Link ohne
Stelle zum Umbrechen.

### 11. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, `[Unreleased]`, nach dem Skill `updating-changelog`
(Keep a Changelog 1.1.0, freigegebene Abschnitte bleiben unberührt). Beschreibt, was gilt,
ohne Rückblick:

- »Changed« (breaking): `StageRenderer#add()` lehnt unter einer komponierenden Pipeline
  (`buildOutputNode` oder `RootRenderPipeline`) eine Stage ohne `asPassNode()` — etwa eine
  `ClearStage` — mit einem `TypeError` ab, der die Stage nennt; der `pipeline`- und der
  `buildOutputNode`-Setter lehnen eine Pipeline bzw. einen Builder ab, die eine solche
  Stage komponieren würden, und behalten den Wert von vorher. Dazu ein Eintrag im
  »Migration Guide« von `[Unreleased]` (`:107` ff.): unter einer komponierenden Pipeline
  die `ClearStage` weglassen — jede Stage zeichnet dort in ein Target mit eigenem
  Tiefenpuffer, und die Komposition legt sie übereinander; eine eigene Stage bekommt ein
  `asPassNode()`.
- »Changed«: `StageRenderTargetPool#acquire()` dimensioniert, wenn kein freies Target die
  Größe hat, das älteste freie Target des angefragten Typs und der Samples auf sie um und
  gibt die übrigen freien frei; der `texture()`-Node von Mode C und die Pipeline darauf
  bleiben über einen Wechsel der Pixel Ratio stehen.
- »Changed«: die TSDoc von `dispose()` an `StageRenderer`, `Stage2D` und `Canvas2DStage`
  sowie von `StageRenderer#add()`, `#remove()` und `parent` nennt, was beim Aufrufer
  ankommt — ein Fehler unverändert, mehrere als `AggregateError` — und lässt die
  Reihenfolge darin offen.
- »Fixed«: `StageRenderer` ruft `releasePassNodeMemory()` nur an einer Stage, die die
  Methode hat; eine Stage mit `isStage2D` ohne sie verlässt den Renderer über `remove()`,
  `dispose()` und einen Moduswechsel ohne Fehler.

## Entscheidungen dieses Pakets

- **BUG-018 nur dokumentiert, ohne Erkennung.** Die Empfehlung macht die Doku zur
  Behebung und die Warnung optional; Zeile 4 der »Entscheidungen« (fixen *und*
  dokumentieren) nennt die drei Findings, deren Empfehlung »fixen oder dokumentieren«
  offenlässt — BUG-018 ist keins davon. Die optionale Warnung »im Dev-Modus« fällt weg:
  die Bibliothek hat keinen Dev-Modus (kein `NODE_ENV`, kein `import.meta.env` unter
  `src/`). Ein Vergleich des Keys in `FeatureSprites#update()` legte je Textur und Frame
  einen String (`textureShapeKey()`) auf den Heap, gegen das allokationsfreie `update()`,
  das `src/sprites/hot-path-allocations.spec.ts:296` hält; ein allokationsfreier Vergleich
  bräuchte eine zweite Kopie der Regeln von `textureShapeKey()`, und ein Folgen von
  `texture.version` feuerte bei `VideoTexture` und `DynamicAtlas` jeden Frame.
- **PERF-007 nach der Empfehlung**: das älteste passende freie Target umdimensionieren,
  die übrigen freien freigeben. Ein Weg, der auch die übrigen behält und später
  umdimensioniert, erspart einem Mode-C-Kind unter einem Mode-C-Elternteil den Neubau nach
  einem Größenwechsel, hält dafür Targets ohne Abnehmer im Pool; der häufige Fall —
  Renderer nacheinander, auch Geschwister — ist mit der Empfehlung gelöst.
- **API-009 als Ablehnung, nicht als Warnung**: Zeile 4 der »Entscheidungen« verlangt den
  Fix. Geprüft wird an allen drei Eingängen in den Composed-Modus (`add()`, `pipeline`,
  `buildOutputNode`); der Wurf in `#getStagePass()` bleibt als Netz. Breaking, weil
  `add()` und die Setter einer veröffentlichten API jetzt werfen — daher `!` im Commit und
  der Migrationshinweis.
- **API-010 mit `add()`, `remove()`, `parent`**: dieselbe Ursache, dieselbe Datei — die
  Ordnung der Listener-Fehler steht dort ebenso im Vertrag. Die Resize-TSDoc bleibt: sie
  ordnet Fehler den verweigernden Stages zu.
- **READ-003 und CONS-007 über die gemeldeten Stellen hinaus**: drei Stellen aus einer
  Ursache sind ein Paket, nicht drei. Die fünf Kommentarzeilen aus Paket 4, 5 und 7 sind
  Symptome derselben Ursache und kein eigenes Nachtragspaket wert; die vorbestehenden sind
  Nebenbefunde mit derselben Ursache. Die Zeilen in Dateien späterer Pakete (Paket 9:
  `Map2DTileStreamer.ts`; Paket 11: `TileSet.ts`, `TextureAtlas.ts`; Paket 12:
  `DynamicAtlas.ts`) sind reine Kommentarumbrüche — deren Zug 0 gleicht gegen den Stand
  nach diesem Paket ab.
- **Modell mittlere Stufe, Effort medium**: zehn Findings, jedes mit effort S und hier mit
  Namen, Meldungen und Testnamen festgelegt; der breiteste Teil (Schritte 9 und 10) ist
  mechanisch.

## Für Zug 5

- Nach dem Commit in »Offene Befunde« den Eintrag `packages/twopoint5d/src/sprites/features/Wave.ts:9` auf `[x]` mit dem Hash dieses Pakets.
- `Schnittstellen:` im Plan: `VertexObjectPool#prepareSortKeys()` und `#sortByPreparedKeys(options?)` (`@internal`), `FeatureSprites#depthKeys` entfällt · `StageRenderTargetPool#acquire()` dimensioniert ein freies Target des Typs und der Samples um · `StageRenderer#add()`, `pipeline`- und `buildOutputNode`-Setter werfen einen `TypeError` für eine Stage ohne `asPassNode()` unter einer komponierenden Pipeline · `#releasePassMemoryOf()` ruft `releasePassNodeMemory?.()`.

## Urteil des Reviewers (Zug 3, `paket-8.review-0.json`)

- BUG-038: behoben — `StageRenderer.ts:733` `releasePassNodeMemory?.()` mit Begründungskommentar; Spec ab `StageRenderer.spec.ts:3119` deckt `remove()`, `dispose()`, Verlassen des Composed-Modus
- API-009: behoben — `modeOf()` seiteneffektfrei (`StageRenderer.ts:57`); Ablehnung in `add()` `:1314` vor `resizeStage()`, `pipeline`-Setter `:585`, `buildOutputNode`-Setter `:661`; `#getStagePass()` bleibt als Netz (`:1062`); Doku `ClearStage.ts:21–27`, README, CHANGELOG »Changed« mit Migration
- PERF-007: behoben — `StageRenderTargetPool.ts:76–90` per `setSize()`, `lent`-Flag statt `keep`-Parameter (gleichwertig); TSDoc, README `:338–348`, CHANGELOG; Tests für Breite, Höhe, zwei freie Targets, Pixel-Ratio mit `needsUpdate === false`
- API-010: behoben — Reihenfolge entfernt in `StageRenderer#dispose()` `:1151–1156`, `Canvas2DStage#dispose()` `:281`, `Stage2D#dispose()` `:450`, `parent` `:283–292`, `add()`, `remove()`; Code-Kommentare zur Reihenfolge an `StageRenderer.ts:1205`, `Canvas2DStage.ts:319`, `Stage2D.ts:474`
- PERF-006: behoben — `prepareSortKeys()`/`sortByPreparedKeys()` (`@internal`, `VertexObjectPool.ts:519–552`), genutzt in `FeatureSprites.ts:476`/`:488`, `#depthKeys` entfernt; 5 Specs in `VertexObjectPool.sortBy.spec.ts`, Allokationstest in `hot-path-allocations.spec.ts`; Proposals nachgezogen
- TEST-016: behoben — `FeatureSprites.spec.ts:1069`
- BUG-018: behoben (dokumentiert) — TSDoc in `SpriteResources.ts`, `FeatureSpritesMaterial.ts`, `FeatureSprites.ts:582–584`, `sprites.md:1069–1073`; Vertragstest in `SpriteResources.spec.ts`; zusätzlicher CHANGELOG-Eintrag
- CONS-003: behoben — `docs/architecture.md:165–167`
- READ-003 samt 22 Stellen: behoben — Prüfkommando aus Schritt 9 leer
- CONS-007 samt Stellen: behoben — Prüfkommando aus Schritt 10 leer, `docs/architecture.md:240`/`:290` umbrochen

Kleine Befunde (lösen keine Runde aus):
- `src/vertex-objects/VertexObjectPool.ts:90–94` — umbrochener Feldkommentar bis 104 Zeichen, Restzeile »buffer« vor der unveränderten Folgezeile
- `src/display/AdaptiveResolution.ts:183–184` — Absatz nur bis zur Einfügestelle neu umbrochen, halbe Zeile
- `src/stage/StageRenderer.ts:283–287`, `:1279–1283` — nach entfernten Satzteilen kurze Restzeilen, Absatz nicht neu umbrochen
- `docs/proposals/pool-sorting.md:236` — neue Zeile mit 104 Zeichen, Datei bricht sonst um ≈ 100
- `src/stage/StageRenderer.ts:1065` — `#getStagePass()` schreibt den Text von `NO_PASS_NODE` aus statt die Konstante zu nutzen

## Findings im Volltext

**BUG-018 · low · packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts:138** (auch `packages/twopoint5d/src/sprites/textureShapeKey.ts:65`) — Shape-Wechsel einer bereits gesetzten Textur dokumentieren oder erkennen
Der Shape-Key einer Textur wird nur in `setTexture()`/`touchTexture()` neu berechnet. Ändert der Caller an einer bereits gesetzten Textur `minFilter`/`magFilter`, `colorSpace`, `type` oder `format` (etwa beim Umschalten zwischen Pixel-Art- und Linear-Filter), dann bleibt der Graph beim alten Binding. Gebaut für zweimal `NearestFilter` liest die WebGPU-Seite weiter per `textureLoad` ohne Sampler, und der neue Linear-Filter wirkt still nicht. TSDoc und `docs/sprites.md` nennen `touchTexture()` nur für ein nachgeladenes Bild.
Beleg: `const shape = createMemo(() => { const texture = signal.get(); … textureShapeKey(texture); })`
Empfehlung: In der TSDoc von `setTexture`/`touchTexture` und in `docs/sprites.md` festhalten, dass eine Änderung an Filter, `colorSpace`, `type` oder `format` einer gesetzten Textur ein `touchTexture(name)` braucht. Optional den Key in `FeatureSprites#update()` im Dev-Modus vergleichen und einmal warnen.

**PERF-006 · low · packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:422** — Tiefenschlüssel von sortByViewDepth() direkt in den Sort-Scratch des Pools schreiben
`sortByViewDepth()` hält ein eigenes `Float64Array` der Kapazität (`#depthKeys`), das `VertexObjectPool#sortByKeys()` noch einmal Element für Element in seinen eigenen `#sortKeys` der Kapazität kopiert. Pro Sort sind das n zusätzliche Kopien und 8 Byte pro Slot doppelt (8 MB bei 1 Mio. Sprites), bei einem Sort, der für Kamerafahrten jeden Frame laufen soll.
Beleg: `keys[i] = m2 * positions[p]! + …; return pool.sortByKeys(keys);`
Empfehlung: Dem Pool eine interne Variante geben, die den vorbereiteten Key-Scratch herausgibt (etwa `prepareKeys(): Float64Array` plus `sortByPreparedKeys(n, options)`), und `#depthKeys` entfernen.

**TEST-016 · low · packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.spec.ts:1046** — `sortByViewDepth()` auf einer eingesetzten Geometry eigens prüfen
`sortByViewDepth()` auf der in den Slot gesetzten Geometry hat keine eigene Erwartung, obwohl TSDoc, Doku und CHANGELOG das Verhalten nennen. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Eine Erwartung für `sortByViewDepth()` nach einem Slot-Tausch ergänzen.

**READ-003 · info · packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:41** — Überlange TSDoc-Zeile zu `FeatureSpritesPass` umbrechen
Die TSDoc-Zeile zu `FeatureSpritesPass` hat 155 Zeichen (`lineWidth` 130); Biome bricht Kommentare nicht um. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Von Hand umbrechen.

**CONS-007 · info · packages/twopoint5d/docs/sprites.md:1600** (auch `:2177`) — docs/sprites.md: zwei Sätze in den Absatzumbruch holen
Eingefügte Sätze stehen außerhalb des Absatzumbruchs (≈ 140–148 Zeichen gegen ≈ 100). Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Die Absätze neu umbrechen.

**CONS-003 · low · docs/architecture.md:160** (auch `packages/twopoint5d/vite.config.ts:62`) — Ausnahme der 100-%-Schwelle für `src/sprites/**` in docs/architecture.md nennen
Der Absatz sagt, alle Coverage-Schwellen lägen »globally and per module« beim gemessenen Wert abgerundet minus zwei; `src/sprites/**` steht in `vite.config.ts` fest auf 100 %, die Ausnahme fehlt in der Doku. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Die Ausnahme samt Begründung in den Absatz aufnehmen.

**PERF-007 · low · packages/twopoint5d/src/stage/StageRenderTargetPool.ts:71** (auch `packages/twopoint5d/src/stage/StageRenderer.ts:885`) — Freies Pool-Target bei Größenwechsel per setSize() weiterverwenden statt neu bauen
Jeder Schritt der adaptiven Auflösung ändert `renderer.getPixelRatio()` und damit die Device-Größe, die `acquireInternalTarget()` beim Pool anfragt. Der Pool findet kein passendes Target, verwirft alle freien (`#releaseFreeTargets()`) und baut ein neues `RenderTarget`-Objekt. Weil sich damit `rt.texture` ändert, baut Mode C in `#wireInternalOutputNode()` einen neuen `texture()`-Node und setzt `pipeline.needsUpdate = true` — three.js' `RenderPipeline._updateContext()` markiert daraufhin das Quad-Material für einen kompletten Node-Rebuild. Das trifft jeden gepoolten Renderer, pro Auflösungsschritt (AdaptiveResolution erlaubt einen Schritt alle ≥30 Frames, im Frame-Pacing-Modus mit Rückfall-Versuchen). Ohne Pool passiert das nicht: das eigene Target wird per `setSize()` in place umdimensioniert, Texture-Objekt und Node bleiben. Kein Leak — die alten Targets werden freigegeben —, aber ein vermeidbarer CPU-Spike (Node-Build, ggf. Pipeline-Lookup) genau in dem Moment, in dem die Auflösung wegen Überlast gesenkt wird. Teilen sich Renderer unterschiedlicher Größe einen Pool (dokumentiert als Fehlgebrauch), wird daraus Allokation plus Material-Rebuild in jedem Frame.
Beleg: `this.#releaseFreeTargets(); const renderTarget = new RenderTarget(width, height, {type, samples});`
Empfehlung: Bei einem Fehlgriff das älteste freie Target mit passendem `type` und `samples` per `setSize(width, height)` umdimensionieren und verleihen (Texture-Identität bleibt, `#wireInternalOutputNode()` baut nichts neu), nur die übrigen freien Targets disposen. Optional einen Test, der nach einem Pixel-Ratio-Wechsel `pipeline.needsUpdate === false` erwartet.

**API-009 · low · packages/twopoint5d/src/stage/ClearStage.ts:22** (auch `packages/twopoint5d/src/stage/StageRenderer.ts:1000`) — ClearStage im Composed-Modus abweisen oder dokumentieren
`ClearStage` implementiert kein `asPassNode()`. Hängt sie an einem Renderer mit `RootRenderPipeline` oder `buildOutputNode`, wirft `#getStagePass()` in `#rebuildComposedOutputNode()` einen `TypeError`; `#outputDirty` bleibt dabei `true`, also wiederholt sich der Rebuild und der Fehler in jedem Frame aus dem `onRenderFrame`-Handler des Hosts. Die JSDoc der Klasse empfiehlt sie für genau das Layering (`root.add(world).add(new ClearStage(...)).add(ui)`) ohne Hinweis, dass sie nur im Plain-Modus und in Mode C wirkt; wer später eine `RootRenderPipeline` setzt, bekommt einen Fehler pro Frame statt einer Meldung beim `add()` bzw. beim Pipeline-Wechsel.
Empfehlung: In der JSDoc von `ClearStage` festhalten, dass sie nur ohne Pipeline und in Mode C wirkt. Zusätzlich prüfen, ob `add()` bzw. der `pipeline`/`buildOutputNode`-Setter Stages ohne `asPassNode` früh mit derselben Meldung abweisen (oder einmalig warnen) sollte, statt den Fehler in jedem Frame zu werfen.

**API-010 · low · packages/twopoint5d/src/stage/Canvas2DStage.ts:276** (auch `packages/twopoint5d/src/stage/StageRenderer.ts:1084`, `packages/twopoint5d/src/stage/Stage2D.ts:433`) — Fehlerreihenfolge der dispose()-Kaskaden nicht als API-Vertrag festschreiben
Die TSDoc von `Canvas2DStage#dispose()`, `StageRenderer#dispose()` und `Stage2D#dispose()` legt fest, in welcher Reihenfolge und Verschachtelung Fehler von Listenern, Unsubscribes und Teil-Disposes als `AggregateError` beim Aufrufer ankommen (bis hin zu »ein `AggregateError` selbst, wenn mehr als ein Listener seines Events warf«). Das Verhalten selbst — Teardown läuft vollständig, Fehler kommen danach — ist gut; die dokumentierte Ordnung der inneren Fehler macht aber jede Umstellung der Teardown-Reihenfolge zur Breaking Change und kostet beim Lesen der API mehr, als sie einem Aufrufer nützt, der in der Praxis nur `instanceof AggregateError` und `.errors` prüft.
Empfehlung: Den Vertrag auf das Wesentliche reduzieren: »Teardown läuft vollständig; ein Fehler kommt unverändert, mehrere als `AggregateError`.« Die genaue Reihenfolge als Implementierungsdetail in einen Code-Kommentar oder die Tests verschieben.

**BUG-038 · low · packages/twopoint5d/src/stage/StageRenderer.ts:706** — `releasePassNodeMemory()` nur rufen, wo es die Methode gibt
`releasePassNodeMemory()` wird allein über das Flag `isStage2D` erkannt; ein Objekt mit Flag ohne Methode (zweite Kopie der Bibliothek, Fake) wirft in `remove()`, `dispose()` und beim Moduswechsel einen `TypeError`. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: `releasePassNodeMemory?.()` aufrufen und einen Spec mit einem Stage-Double ohne die Methode ergänzen.
