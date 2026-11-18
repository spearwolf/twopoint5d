# Paket 5 — StageDirector, StageRenderer und Stage2D: Fehlerpfade und Oberfläche

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-007 (low), BUG-008 (low), READ-002 (low), BUG-015 (low), API-003 (low), PERF-001 (low), TYPE-005 (info), dazu gleicher Ursache wie TYPE-005 `StageMaskInternals` und `StageTransitionInternals` (vorbestehend) und `CameraRigInternals` (aus Paket 4, 92ed8863)
- Ziel: Director-Rückwege verlieren keinen Fehler und melden einen ausbleibenden Compile, Stage2D setzt die Szene vor der Projektion, und der StageRenderer bietet readonly-Maße und prüft seine Pipeline-Warnung nicht mehr in jedem Frame.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageDirector.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRendererTargets.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts`
  - `packages/twopoint5d/src/stage/StageMask.ts`, `StageTransition.ts`, `CameraRig.ts` (nur die Internals-Brücke)
  - neu `packages/twopoint5d/src/utils/unfilledInternal.ts` und `unfilledInternal.spec.ts`
  - Specs: `StageDirector.spec.ts`, `StageDirector.shapes.spec.ts`, `StageDirector.masks.spec.ts`, `StageRenderer.spec.ts`, `StageRendererTargets.spec.ts`, `Stage2D.spec.ts`
  - Doku: `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`), `packages/twopoint5d/docs/stages.md`
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: keep every error a director meets as it lets go of a layer, reject a precompile() whose pipeline compiled nothing, set the scene of a stage before its projection, make the size of a stage renderer read-only, check for a pipeline of a child only after a change, and give the internal bridges of the stage module stand-ins that name themselves`

## Vorgehen

Reihenfolge: erst die Regressionstests der Bugfixes rot sehen (1, 2, 4, 5, 6a, 7a), dann
beheben. Jede Fehlermeldung unten ist der exakte String. Die Regeln aus `AGENTS.md`
(»Error and warning messages«, `#private`, `.js`-Suffix, `import type`) und die
»Konventionen« im Plan gelten für jede Zeile, Kommentare, CHANGELOG und Guide eingeschlossen.

### 1. Fehler von `#release()` sammeln (BUG-007)

`StageDirector.ts:1882` (`#release(layer)`). Heute wirft `super.remove(layer.renderer)`
(Zeile 1897) im `try`, und `layer.renderer.dispose()` im `finally` ersetzt dessen Fehler,
wenn es selbst wirft.

Neu, ab `layer.unsubscribe?.();` (Rest der Methode davor unverändert):

```ts
    layer.unsubscribe?.();
    // what listeners throw as the layer leaves — on the remove from the base, on the dispose of a
    // wrapper — comes out once the layer is gone, the error of the remove first
    const errors: unknown[] = [];
    this.#internalCall++;
    try {
      super.remove(layer.renderer);
    } catch (error) {
      errors.push(error);
    } finally {
      this.#internalCall--;
    }
    if (layer.wrapped) {
      try {
        layer.renderer.dispose();
      } catch (error) {
        errors.push(error);
      }
    } else if (layer.scale !== 1) {
      // a StageRenderer of the caller leaves with the full size of its pass target it came with
      StageRendererInternals.setPassTargetScale(layer.renderer, 1);
    }
    throwCollected(
      errors,
      `StageDirector: more than one listener of OnStageRemoved, OnRemoveFromParent and OnStageDispose threw as the director let go of the stage ${describeValue(layer.stage.name)}`,
    );
```

JSDoc der Methode: »Takes the layer out of the base and forgets it; a wrapper the director
made is disposed. What listeners throw on the way comes out afterwards — one unchanged,
several as an `AggregateError`.« Die Aufrufer bleiben, wie sie sind: sie fangen und
sammeln bereits (`#dropLayer`, `#dropMask`, `#unuseMask`, `setStack()`, das Ende eines
Laufs bei 2064 und 2124). Der Aufruf in `dispose()` (Zeile 1507) läuft nach
`super.dispose()`, das jede Ebene schon über `remove()` → `#dropLayer()` losgelassen hat;
er bleibt unverändert.

Regressionstest in `StageDirector.spec.ts`, neben den Tests, in denen ein Listener von
`OnStageRemoved` wirft (um Zeile 1143): Director mit einer `Stage2D` als Ebene (also
gewrappt), `wrapper = director.stages[0]!.stage`, `on(wrapper, OnRemoveFromParent, () => { throw first; })`,
`on(wrapper, OnStageDispose, () => { throw second; })`, dann `director.remove(stage)`.
Erwartet: ein `AggregateError` mit `errors` gleich `[first, second]` und der Meldung oben
(Stage-Name per `describeValue()` gerendert, also mit Anführungszeichen). Vor dem Fix rot:
geworfen wird nur `second`. Name z. B.
`keeps both errors when listeners throw as the director lets go of a stage it wrapped and disposes the wrapper`.

### 2. Ausbleibenden Compile in `#compileShape()` melden (BUG-008)

`StageDirector.ts:2428`. Nach dem `try { … } finally { … }` und **vor** `await compiled;`
(Zeile 2446):

```ts
    // three.js draws the quad of a RenderPipeline through renderer.render(); a draw that went another
    // way compiled nothing, and the first frame of the shape would build what precompile() promised
    if (compiled === undefined) {
      throw new Error('StageDirector#precompile(): the render pipeline drew without calling renderer.render(), and nothing was compiled');
    }
    await compiled;
```

`#compileShape()` ist `async`, der Wurf wird zur Ablehnung von `compiling`; `precompile()`
fängt sie schon (`#forgetFailedShape(key, entry, errors)`, dann `throw error`), so dass die
nächste Runde die Form neu baut. Sonst nichts am Ablauf ändern.

Geprüft gegen three 0.187.0: `RenderPipeline#render()` → `QuadMesh#render(renderer)` →
`renderer.render(this, _camera)` (`three/src/renderers/common/QuadMesh.js:118`); der Weg
ist heute also immer gegeben.

Regressionstest in `StageDirector.shapes.spec.ts` (dort stehen die `precompile()`-Tests der
Formen): `vi.spyOn(RenderPipeline.prototype, 'render').mockImplementation(() => {})`,
`precompile()` einer Form → lehnt mit genau dieser `Error` ab, `renderer.compileAsync`
wurde nicht gerufen; dann `mockRestore()`, dieselbe `precompile()` noch einmal → löst auf,
`compileAsync` einmal gerufen (die gescheiterte Form wurde vergessen und neu gebaut). Vor
dem Fix rot: die erste `precompile()` löst auf.

TSDoc von `precompile()` (Absatz ab »A shape the director holds is skipped«,
`StageDirector.ts:1383`) und Guide `docs/stages.md:1888` (Absatz »`precompile()` takes a
`WebGPURenderer` …«) je um einen Satz ergänzen: »A render pipeline that draws without
going through `renderer.render()` compiles nothing: the call rejects with an `Error` that
says so, and the next call builds that shape again.«

### 3. Rückweg-Fehler über `throwCollected()` (READ-002)

Acht Stellen in `StageDirector.ts` ersetzen das Muster
`if (collected.length === 1) throw error; throw new AggregateError(collected, msg);`
durch `throwCollected(collected, msg)` — **Meldungstexte und Reihenfolge der Fehler bleiben
exakt**, ebenso die Kommentare über den Stellen:

| Zeile | Methode | Form danach |
| --- | --- | --- |
| 730 | `#show()`, catch um `#maskSlot()` | `const collected = [error, ...errors];` · `if (usesHeld) this.#unuseMasks(effectMasks, collected);` · `throwCollected(collected, \`${subject}: more than one error on the way back from a mask stage that refused to join\`);` |
| 761 | `#show()`, zweiter catch | `const collected = …;` · `#unmaskSlot` · `#unuseMasks` wie heute · `throwCollected(collected, \`${subject}: more than one error on the way back from a change that was refused\`);` |
| 822 | `#hide()` | … `throwCollected(collected, \`${subject}: more than one error on the way back from a stack a listener changed\`);` |
| 890 | `replace()` | … `throwCollected(collected, \`${subject}: more than one error on the way back from a change that was refused\`);` |
| 952 | `push()` | … `throwCollected(collected, \`${subject}: more than one error on the way back from a stack a listener changed\`);` |
| 1073 | `setStack()` | `throwCollected([error, ...errors], \`${subject}: more than one error on the way back from a stage that refused to join\`);` |
| 1461 | `precompile()` | `throwCollected([error, ...errors], \`${subject}: more than one error on the way back from a build that failed\`);` |
| 1707 | `#useMasks()` | `const collected = [error, ...errors.splice(before)];` · `#unuseMasks(…, collected)` · `throwCollected(collected, \`${subject}: more than one error on the way back from a mask stage that refused to join\`);` |

`collected` enthält immer mindestens `error`, `throwCollected()` wirft also immer; die
Signatur von `throwCollected()` bleibt `void` (kein `never`-Overload): hinter keinem der
acht `catch`-Blöcke hängt Code, der für TypeScript wissen müsste, dass der Block nicht
weiterläuft — `#show()`, `#hide()`, `replace()` und `push()` prüfen ihre `let`-Variablen
danach selbst, die übrigen sind `void`.

Damit die Meldungen den Umbau sichtbar überstehen: die beiden Tests, die heute einen
dieser `AggregateError` prüfen, bekommen zusätzlich die `message`:
`StageDirector.shapes.spec.ts:179` → `'StageDirector#precompile(): more than one error on the way back from a build that failed'`,
`StageDirector.masks.spec.ts:390` (`show() whose layer refuses to join keeps the original
error beside a listener that threw on the way back`; die Ebene scheitert in `#join()` nach der
Maske, `#unmaskSlot()` lässt die Maske im zweiten catch von `#show()` los) →
`'StageDirector#show(): more than one error on the way back from a change that was refused'`.

### 4. Szene vor der Projektion (BUG-015)

`Stage2D.ts:418`, Konstruktor. Der `if (scene) … else …`-Block (Zeilen 424–429) wandert vor
`this.projection = projection;` (Zeile 422), mit dem Kommentar
`// the scene first: the projection setter goes through the camera and its events, and a path there may read scene or name`.
Sonst nichts.

Regressionstest in `Stage2D.spec.ts`: eine Unterklasse, die den Accessor `projection`
überschreibt und im Setter nach `super.projection = projection` `this.name` in ein äußeres
Array schreibt (`override get projection() { return super.projection; }` dazu). `new Probe(projection)`
→ Array `['Stage2D']`; mit einer übergebenen Szene namens `'level'` → `['level']`. Vor dem
Fix rot: der Konstruktor wirft einen `TypeError` (`#scene` ist noch `undefined`).

### 5. `width`, `height`, `pixelRatio` des StageRenderer schreibgeschützt (API-003)

`StageRenderer.ts:171–177`. Die drei öffentlichen Felder werden zu `#width = 0`,
`#height = 0`, `#pixelRatio = 1` mit je einem `get` ohne `set`. Das TSDoc von `pixelRatio`
wandert an den Getter; `width` und `height` bekommen: »The width this renderer carries, as
the last {@link resize} that every stage took handed it in; `0` until then. Read-only:
`resize()` is the one way to change it.« (`height` entsprechend). In `resize()` (Zeilen
558–560 und 591–593) die privaten Felder schreiben. Alle übrigen Lesestellen (`this.width`
usw. in `StageRenderer` und `StageDirector`) bleiben Lesezugriffe über den Getter.

`StageRendererTargets.ts:184–192` (`#deviceSize`): der Zweig für eine nicht endliche Größe
entfällt — `return Math.max(1, Math.floor(size * this.#pixelRatio * scale));` —, ebenso der
Satz »A size that is not a finite number — written into the public `width` or `height` of
a `StageRenderer` past its `resize()` — gives the minimum as well.« und der Import von
`isFiniteNumber` (Zeile 10). Begründung: alle Größen kommen jetzt aus `resize()`, das
`assertFinite()` prüft.

Spec `StageRenderer.spec.ts:1937` (`gives a render target at least one pixel for a width
written past resize()`) prüft den entfallenen Zweig und wird ersetzt durch
`width, height and pixelRatio are read-only: a write throws a TypeError and the size stays`:
`sr.resize(10, 20, 2)`, dann je `expect(() => { (sr as unknown as {width: number}).width = 5; }).toThrow(TypeError)`
für alle drei, danach `[sr.width, sr.height, sr.pixelRatio]` gleich `[10, 20, 2]`. Vor dem
Fix rot: kein Wurf.

Guide `docs/stages.md:1322–1324`: »`root.width`, `root.height` and `root.pixelRatio` read
what the renderer carries« → »… read what the renderer carries — `resize()` is the one way
to set them —«.

CHANGELOG `## [Unreleased]`, `### Changed`:
- `` `StageRenderer#width`, `#height` and `#pixelRatio` are read-only: `resize()` sets them, and a write throws a `TypeError` (**BREAKING**). See the Migration Guide ``

`### Migration Guide`, neuer Abschnitt nach dem letzten bestehenden:
`#### \`StageRenderer#width\`, \`height\` and \`pixelRatio\` are read-only` — ein Satz
(der Renderer trägt die Größe, die `resize()` jeder Stage gegeben hat; eine Größe geht über
`resize()` hinein), dann **Before** `renderer.width = 800;` und **After**
`renderer.resize(800, renderer.height, renderer.pixelRatio);`, als ```` ```ts ````-Blöcke ohne
`check` — wie der Abschnitt »`StageItem` is read-only« unter 0.25.0.

### 6. Pipeline-Child-Warnung nur nach einer Änderung prüfen (PERF-001)

`StageRenderer.ts`. Heute laufen `#renderStagesInline()` (Zeile 983) und
`#renderPipelineSimple()` (Zeile 1080) in jedem Frame über alle Stages, bis gewarnt wurde.

a) Neues Feld neben `#warnedAboutPipelineChild` (Zeile 988):
   `#pipelineChildCheckDue = true;` mit Kommentar, dass es jede Änderung setzt, die eine
   solche Stage hereinbringen kann, und der nächste Frame der beiden Modi es abräumt.

b) An beiden Stellen (983, 1080) statt
   `if (!this.#warnedAboutPipelineChild && stages.length > 1) this.#warnAboutPipelineChild(stages, X);`:

   ```ts
   if (this.#pipelineChildCheckDue && !this.#warnedAboutPipelineChild) {
     // cleared before the check: a stage a listener brings in while the stages draw is checked next frame
     this.#pipelineChildCheckDue = false;
     if (stages.length > 1) this.#warnAboutPipelineChild(stages, X);
   }
   ```
   mit `X` wie heute (`true` bzw. `false`), die Kommentare über den Stellen bleiben.

c) `#pipelineChildCheckDue = true` setzen an genau diesen Stellen:
   - im Callback von `#order` (Zeile 250, ein Rename verschiebt `orderedStages`),
   - im Setter `renderOrder` (Zeile 266),
   - in `#modeInputChanged()` (Zeile 819, eigener Moduswechsel),
   - in `add()` (Zeile 1581),
   - im Listener auf `OnStageAfterCameraChanged`/`OnStageAfterSceneChanged`/`OnStageAfterPostProcessChanged` (Zeile 1592) neben `#passesToCheck = true` — ein neuer `postProcess` einer `Stage2D` kommt über dieses Event; dass auch Kamera- und Szenenwechsel die Prüfung einmal anstoßen, ist gewollt billig,
   - in `remove()` (Zeile 1652).

d) Der Zustand eines **Kind**-Renderers zählt mit (`child.#renderMode()`,
   `child.outputRenderTarget`). Neue private Methode im `StageRenderer`:

   ```ts
   /** A parent that draws this renderer beside other stages checks again for a pipeline of its own. */
   #pipelineChildChanged(): void {
     const parent = this.#parent;
     if (parent instanceof StageRenderer) parent.#pipelineChildCheckDue = true;
   }
   ```
   Aufruf am Ende von `#modeInputChanged()` und im neuen Setter von `outputRenderTarget`.

e) `outputRenderTarget?: RenderTarget;` (Zeile 718) wird ein Accessor-Paar über
   `#outputRenderTarget?: RenderTarget`: `get outputRenderTarget(): RenderTarget | undefined`
   (trägt das bestehende TSDoc) und `set outputRenderTarget(target: RenderTarget | undefined)`,
   der speichert und `this.#pipelineChildChanged()` ruft. Kein Guard gegen `#disposed`:
   die Eigenschaft bleibt nach `dispose()` schreibbar, wie das TSDoc von `dispose()` sagt.

f) Der Kommentar in `#warnAboutPipelineChild()` (Zeile 997, »this runs in every frame until
   it has warned«) wird zu »this runs in the first frame after a change that can bring such
   a stage in«.

Tests in `StageRenderer.spec.ts`, in den beiden Describes ab Zeile 1975 bzw. 2058:
- **rot vor dem Fix**: `asks its stages about a pipeline of their own in the first frame after a change, not in every frame` —
  ein Double aus `fakeStage('room')` mit `isStage2D: true` und einem Getter `postProcess`,
  der seine Lesezugriffe zählt und `undefined` antwortet, neben einer zweiten Stage; drei
  Frames → genau 1 Lesezugriff; dann `root.add(fakeStage('third'))` und ein Frame → 2.
  Heute 3 nach drei Frames.
- grün vorher und nachher, als Wächter der Invalidierung:
  `warns for a child that gets a pipeline after the first frames` (`makeTree({childPipeline: false})`, `drawTwice`, dann `child.pipeline = makePipelineMock()`, `drawTwice` → einmal gewarnt),
  `warns for a child whose outputRenderTarget is taken away after the first frames` (Kind mit eigenem `outputRenderTarget`, `drawTwice`, dann `child.outputRenderTarget = undefined`, `drawTwice` → einmal gewarnt),
  `warns for a stage that joins after the first frames` (`makeTree({withSibling: false})`, `drawTwice`, dann `root.add(passStage('bg'))`, `drawTwice` → einmal gewarnt),
  `warns for a stage that renderOrder brings into the order after the first frames` (`root.renderOrder = 'bloom'`, `drawTwice` → keine Warnung, dann `root.renderOrder = 'bg,bloom'`, `drawTwice` → einmal gewarnt).
  Der bestehende Test `warns for a post-process that comes after the first frames` deckt das Event.

CHANGELOG `### Changed`:
- `` `StageRenderer#outputRenderTarget` is a get/set accessor pair: a subclass overrides it as an accessor, not as a field ``

### 7. Internals-Brücken ohne `{} as` (TYPE-005, dazu drei Stellen gleicher Ursache)

Fünf `@internal`-Objekte werden heute als `{} as {…}` angelegt und erst im `static`-Block
ihrer Klasse gefüllt; bis dahin behauptet der Typ Funktionen, die `undefined` sind:

| Datei:Zeile | Objekt | Funktionen | Herkunft |
| --- | --- | --- | --- |
| `stage/Stage2D.ts:65` | `Stage2DInternals` | `attachDriver`, `detachDriver`, `announceCamera`, `driverOf`, `scenePassesOf` | Audit |
| `stage/StageRendererTargets.ts:19` | `StageRendererInternals` | `setPassTargetScale` | Audit |
| `stage/StageMask.ts:103` | `StageMaskInternals` | `drivenBy`, `setDrivenBy`, `setProgress`, `followProgress`, `followProgressNode`, `onDispose` | vorbestehend (`git show 2e3f585b:…/StageMask.ts:103`) |
| `stage/StageTransition.ts:56` | `StageTransitionInternals` | `create`, `advance`, `settle`, `keptOf`, `isFrozen`, `isUnderWay` | vorbestehend (`2e3f585b`, dort Zeile 52) |
| `stage/CameraRig.ts:218` | `CameraRigInternals` | `driverOf` | Paket 4 (92ed8863) |

a) Neue Datei `packages/twopoint5d/src/utils/unfilledInternal.ts` (nicht in
   `utils/public-api.ts`):

   ```ts
   /**
    * A stand-in for a function of an internals bridge — an `@internal` object whose functions a
    * class fills in from its `static` block —, in place until that class is evaluated. A call
    * before then, which a circular import can bring about, throws an error that names the
    * function instead of calling `undefined`.
    */
   export function unfilledInternal(name: string): () => never {
     return () => {
       throw new Error(`expected ${name} to be defined: the class that fills it in has not been evaluated yet`);
     };
   }
   ```
   Die Meldung folgt der Form von `expectDefined()` (`expected … to be defined`): ein
   gebrochener Invariant der Library, kein Subjekt — so verlangt es `AGENTS.md`.
   Spec `unfilledInternal.spec.ts`: die Funktion wirft `new Error('expected Bridge.call() to be defined: the class that fills it in has not been evaluated yet')` für `unfilledInternal('Bridge.call()')`.

b) Jede der fünf Brücken: der Typ wandert von `as` in eine Annotation, jede Funktion bekommt
   ihren Platzhalter mit dem Namen `'<Objekt>.<funktion>()'`; die JSDoc der Member bleibt
   im Typ. Muster:

   ```ts
   export const Stage2DInternals: {
     attachDriver(stage: Stage2D, driver: StageCameraDriver): void;
     // … die übrigen Signaturen unverändert
   } = {
     attachDriver: unfilledInternal('Stage2DInternals.attachDriver()'),
     // … je Funktion eine Zeile
   };
   ```
   Die `static`-Blöcke bleiben, wie sie sind; sie überschreiben die Platzhalter.

c) Regressionstest in `StageRendererTargets.spec.ts` — die Datei importiert `StageRenderer`
   nicht, dessen `static`-Block läuft dort also nie:
   `StageRendererInternals names the function while StageRenderer has not been evaluated` →
   `expect(() => StageRendererInternals.setPassTargetScale({} as StageRenderer, 0.5)).toThrow(new Error('expected StageRendererInternals.setPassTargetScale() to be defined: the class that fills it in has not been evaluated yet'))`
   (`StageRenderer` nur als `import type`). Vor dem Fix rot: `TypeError … is not a function`.

d) Risiko, auf das der Verify-Lauf achten muss: `StageTransitionInternals.advance()`,
   `StageMaskInternals.followProgress()` und `followProgressNode()` liegen im Frame-Pfad des
   Directors. Der Platzhalter ändert die Form des Objekts nicht und allokiert nichts je
   Aufruf; `pnpm test:allocations` (`hot-path-allocations.director.spec.ts`,
   `hot-path-allocations.camera-rig.spec.ts`) ist der Beleg. Wird dort etwas rot, ist das ein
   Befund dieses Pakets, mit der Messung im Report.

CHANGELOG: kein Eintrag für 3 und 7 (intern, keine Meldung ändert sich). Für 1, 2 und 4
unter `### Fixed`:
- `` `StageDirector` throws every error it meets as it lets go of a layer: when a listener throws as the stage leaves the director and another one as the director disposes the renderer it wrapped the stage in, both reach the caller, as an `AggregateError` ``
- `` `StageDirector#precompile()` rejects with an `Error` when the render pipeline draws a shape without going through `renderer.render()`, which compiles nothing, and the next call builds that shape again ``
- `` `new Stage2D()` takes its scene before its projection: a subclass that reads `scene` or `name` while the projection is set finds them ``

Formulierungen dürfen geglättet werden; kein »früher«, »statt bisher«, »now« im Sinn von
»jetzt anders« (Konvention »Kein Rückblick«).

## Abgleich (Zug 0, 2026-11-18, gegen 92ed8863)

- BUG-007 — unverändert: `StageDirector.ts:1882` `#release()`, `super.remove()` in Zeile 1897 im `try`, `dispose()` des Wrappers im `finally` (Zeilen 1898–1906).
- BUG-008 — unverändert: `StageDirector.ts:2428` `#compileShape()`, `let compiled` Zeile 2433, `await compiled` Zeile 2446 ohne Prüfung.
- READ-002 — unverändert, Zeilen leicht verschoben: 730, 761, 822, 890, 952, 1073, 1461 (Audit 1460), 1707 (Audit 1706).
- BUG-015 — unverändert: `Stage2D.ts:422` `this.projection = projection` vor `#scene` (Zeilen 424–429).
- API-003 — unverändert: `StageRenderer.ts:171, 172, 177`; einziger Schreiber außerhalb von `resize()` ist der Spec `StageRenderer.spec.ts:1941`; kein Schreiber in `apps/`, `packages/twopoint5d-testing/` oder `docs/`; keine Unterklasse außer `StageDirector`, die nur liest.
- PERF-001 — unverändert: `StageRenderer.ts:983`, `996`, `1080`.
- TYPE-005 — unverändert: `Stage2D.ts:65`, `StageRendererTargets.ts:19`; dieselbe Ursache an `StageMask.ts:103`, `StageTransition.ts:56` (beide schon in `2e3f585b`) und `CameraRig.ts:218` (neu aus 92ed8863).

## Triage (Zug 0)

- `Folgen:` der Pakete 1–4: alle »keine« — nichts zu verteilen.
- »Offene Befunde«: keiner teilt eine Ursache mit diesem Paket (Browser-Matrix-Doku, Nachsicht der Display-Maße und von `fitIntoRectangle()`, `firstTileId`, `tileIds`-Zeilen, `PanControl2D#keys`, `#shapeError()`, Allocation-Spec unter `run-many`) — alle bleiben liegen.
- `StageMaskInternals`, `StageTransitionInternals`: vorbestehende Nebenbefunde gleicher Ursache wie TYPE-005 → in dieses Paket (Schritt 7). `CameraRigInternals`: Symptom derselben Ursache, entstanden in Paket 4 nach dem Hausmuster; das Paket der Ursache (dieses) ist offen → hierher.

## Entscheidungen dieses Pakets

- READ-002: `throwCollected()` bleibt `void`; kein `never`-Overload, weil keine der acht Stellen ihn braucht (Schritt 3).
- BUG-007: Fehler in `#release()` gesammelt und gemeinsam geworfen, wie das Audit empfiehlt; kein `errors`-Parameter für `#release()` — die sieben Aufrufer fangen schon, und Paket 11 schneidet den Director ohnehin neu.
- PERF-001: Dirty-Flag mit Meldung des Kindes an den Elternrenderer; dafür wird `outputRenderTarget` ein Accessor-Paar, sonst bliebe das Wegnehmen des Ziels eines Kindes unbemerkt und die Warnung fiele dort aus.
- TYPE-005: Platzhalter-Funktionen (erste Option der Empfehlung) statt Symbol/WeakMap: kleinster Umbau, gleiche Aufrufstellen, keine zusätzliche Indirektion im Frame-Pfad.
- API-003: der `NaN`-Zweig in `StageRendererTargets#deviceSize()` entfällt, wie das Audit sagt.
- Modell stärkste Stufe: sieben Findings über fünf Dateien eines 2500-Zeilen-Directors, öffentliche Oberfläche (Breaking) und Frame-Pfade mit Allocation-Specs; Effort `medium`, weil jeder Schritt mit Namen, Zeilen und Strings dasteht.

## Findings im Volltext

**BUG-007 · low · packages/twopoint5d/src/stage/StageDirector.ts:1899** — Fehler von super.remove() in StageDirector#release() nicht im finally verlieren
`#release()` ruft `super.remove(layer.renderer)` im `try` und `layer.renderer.dispose()` im `finally`. Wirft ein Listener von `OnStageRemoved` und danach ein Listener von `OnRemoveFromParent`/`OnStageDispose` des Wrappers, ersetzt die Exception aus dem `finally` die erste: der erste Fehler ist verloren. Der Rest der Klasse sammelt jeden Listener-Fehler sorgfältig (`errors`, `throwCollected`), hier geht einer stumm unter.
Beleg: `try { super.remove(layer.renderer); } finally { this.#internalCall--; if (layer.wrapped) { layer.renderer.dispose(); } … }`
Empfehlung: Beide Fehler sammeln: `dispose()` des Wrappers in ein eigenes try/catch legen und die Fehler über `throwCollected()` gemeinsam werfen.

**BUG-008 · low · packages/twopoint5d/src/stage/StageDirector.ts:2445** (auch 2435) — Ausbleibenden Compile in #compileShape() melden statt still resolven
`#compileShape()` ersetzt für die Dauer von `pipeline.render()` `renderer.render` durch eine Funktion, die `compileAsync()` startet, und wartet danach auf `compiled`. Ruft `RenderPipeline#render()` den Renderer nicht (mehr) über `renderer.render` — eine Änderung der three.js-Interna, die der Catalog-Bump auf eine neue `three`-Minor jederzeit bringen kann —, bleibt `compiled` `undefined`, `await undefined` resolved, und `precompile()` meldet Erfolg, obwohl nichts kompiliert wurde. Der erste Frame mit der Transition hat dann den Hitch, den `precompile()` verhindern soll, ohne dass ein Test oder eine Warnung es zeigt.
Beleg: `renderer.render = ((scene, camera) => { compiled = renderer.compileAsync(scene, camera); }) …; … await compiled;`
Empfehlung: Nach dem Draw prüfen, ob `compiled` gesetzt wurde, und andernfalls mit einer Fehlermeldung (`StageDirector#precompile(): …`) werfen, damit ein three.js-Update den Weg sichtbar bricht statt stumm.

**READ-002 · low · packages/twopoint5d/src/stage/StageDirector.ts:730** (auch 761, 822, 890, 952, 1073, 1460, 1706) — Rückweg-Fehler über throwCollected() statt achtfach von Hand werfen
Achtmal steht dasselbe Muster: `const collected = [error, ...errors]; if (collected.length === 1) throw error; throw new AggregateError(collected, …)`. Das ist exakt `throwCollected(collected, message)` aus `utils/throwCollected.ts`, das die Klasse an anderen Stellen schon benutzt. Die Kopien bauschen die ohnehin langen Fehlerpfade auf und laden dazu ein, dass eine Kopie abweicht.
Beleg: `const collected = [error, ...errors];\n if (collected.length === 1) throw error;\n throw new AggregateError(collected, \`${subject}: …\`);`
Empfehlung: Die acht Stellen durch `throwCollected([error, ...errors], message)` ersetzen.

**BUG-015 · low · packages/twopoint5d/src/stage/Stage2D.ts:422** (auch 424) — Szene im Stage2D-Konstruktor vor der Projektion setzen
Der Konstruktor schreibt `this.projection = projection` (Zeile 422), bevor `#scene` belegt wird (Zeilen 424–429). Der Setter läuft dabei durch `#updateCamera()`, Events und `#updateProjection()`. Das geht heute nur gut, weil der Container noch 0×0 ist und `#updateProjection()` früh zurückkehrt. Jeder Pfad, der vorher `name` oder `scene` liest (Getter lesen `#scene`, das dann `undefined` ist), wirft einen TypeError. Die Reihenfolge hängt an einer unausgesprochenen Invariante.
Beleg: `this.projection = projection;` steht vor `this.#scene = scene` bzw. `new Scene()`
Empfehlung: Zuerst die Szene anlegen, dann `this.projection` zuweisen (oder `#projection` direkt setzen, solange noch kein Container da ist).

**API-003 · low · packages/twopoint5d/src/stage/StageRenderer.ts:171** (auch 177, `StageRendererTargets.ts:190`) — Öffentliche Felder `width`, `height`, `pixelRatio` des StageRenderer schreibgeschützt machen
`width`, `height` und `pixelRatio` sind frei beschreibbare Felder, obwohl `resize()` sie validiert (`assertFinite`) und den Vergleich mit den StageItems daran aufhängt. Ein direktes Schreiben (`renderer.width = NaN`) umgeht beides; `StageRendererTargets.#deviceSize()` fängt das eigens ab ("written into the public width or height ... past its resize()"). Die Absicherung existiert, weil die API den Fehlerfall zulässt.
Beleg: `width: number = 0;` / `height: number = 0;` / `pixelRatio: number = 1;`
Empfehlung: Als `get`-Accessoren mit privatem Feld anbieten, das nur `resize()` schreibt; `#deviceSize()` braucht den NaN-Zweig dann nicht mehr.

**PERF-001 · low · packages/twopoint5d/src/stage/StageRenderer.ts:983** (auch 1080, 996) — Pipeline-Child-Warnung nicht in jedem Frame neu prüfen
Solange nichts gewarnt wurde (der Normalfall) und `stages.length > 1`, läuft `#warnAboutPipelineChild()` in jedem Frame über alle Stages (`instanceof`, Property-Reads von `postProcess`). Der Kommentar nennt das selbst: "this runs in every frame until it has warned" — und das bleibt es bei einem korrekt aufgebauten Renderer für immer. Die Kosten sind klein, liegen aber im Hot Path jedes Mehr-Stage-Renderers.
Empfehlung: Die Prüfung nur bei `add()`/`remove()`/Änderung von `postProcess`/`pipeline` anstoßen (Dirty-Flag), nicht per Frame.

**TYPE-005 · info · packages/twopoint5d/src/stage/Stage2D.ts:65** (auch `StageRendererTargets.ts:19`) — Interne Brücken-Objekte nicht als leeres Objekt mit Cast anlegen
`Stage2DInternals` und `StageRendererInternals` sind `{} as {…}`: der Typ behauptet Funktionen, die bis zum Auswerten des `static`-Blocks der Klasse `undefined` sind. Wer das Modul nur importiert, aber die Klasse nicht ausgewertet hat (zyklische Imports), ruft `undefined` auf. Es funktioniert, weil die Importe heute in der richtigen Reihenfolge laufen.
Empfehlung: Als `let`-Objekt mit Platzhalter-Funktionen anlegen, die mit Fehlermeldung werfen, oder den Zugriff über ein Symbol/WeakMap-Modul lösen, das ohne Cast auskommt.

## Verlauf

- 2026-11-18 Zug 0: Detailplan steht · BUG-007, BUG-008, BUG-015, API-003, PERF-001, TYPE-005 unverändert · READ-002 unverändert, zwei Zeilen um 1 verschoben (1461, 1707) · TYPE-005 um `StageMask.ts:103`, `StageTransition.ts:56` (vorbestehend) und `CameraRig.ts:218` (aus Paket 4) erweitert · Folgen der Pakete 1–4: keine · »Offene Befunde«: nichts übernommen · Restplan unverändert
- 2026-11-18 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-5.impl-0.json`
- 2026-11-18 Zug 1: zwei Fehlstarts des Aufrufs (Brief nicht übergeben, Pfad), gesichert als `paket-5.impl-0-versuch-1.*`/`-versuch-2.exit`; Runde 0 lief als `paket-5.impl-0.json` (Session cca34e5b-2ac7-4b64-863e-197f3c69650b)
- 2026-11-18 Zug 2: Report FERTIG · 7 Quell-, 6 Spec-, 2 Doku-Dateien geändert, neu `utils/unfilledInternal.ts` und `.spec.ts` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-5.verify.log`)
- 2026-11-18 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-5.diff` (17 Dateien, +371/−65), Report nach `paket-5.review-0.json`
- 2026-11-18 Zug 3: Review `paket-5.review-0.json` · alle Findings erfüllt · 4 klein, kein kritisch/wichtig · Diff `paket-5.diff`
- 2026-11-18 Zug 4: keine Runde (nur kleine Befunde) · der kleine Befund »`test:allocations` aus dem Nx-Cache« ist erledigt: `pnpm nx run-many -t allocations --skip-nx-cache` exit=0 (`paket-5.allocations.log`)
- 2026-11-18 Zug 5: committet 19ba32da (17 Dateien, +371/−65), Verify `paket-5.verify.log` exit=0

## Urteil des Reviewers (review-0)

- BUG-007 behoben — `StageDirector.ts:1872` (`#release()` sammelt und wirft über `throwCollected()`), Test `StageDirector.spec.ts:1152`
- BUG-008 behoben — `StageDirector.ts:2451`, TSDoc von `precompile()`, Guide `docs/stages.md:1889–1891`, Test `StageDirector.shapes.spec.ts:184`
- READ-002 behoben — `StageDirector.ts:732, 760, 819, 886, 947, 1065, 1453, 1699`, Meldungen unverändert; `message`-Assertions `shapes.spec.ts:179`, `masks.spec.ts:390`
- BUG-015 behoben — `Stage2D.ts:429–437`, Test `Stage2D.spec.ts:198`
- API-003 behoben — `StageRenderer.ts:174–197`, `StageRendererTargets.ts:192`, Test `StageRenderer.spec.ts:1937`, Guide, CHANGELOG und Migration Guide
- PERF-001 behoben — Flag `StageRenderer.ts:1039`, Prüfung `:1025`/`:1131`, gesetzt an `:273, :289, :855, :1637, :1650, :1711`, `#pipelineChildChanged()` `:865`, Setter `outputRenderTarget` `:745`
- TYPE-005 behoben — `Stage2D.ts:73`, `StageRendererTargets.ts:23`, `utils/unfilledInternal.ts` samt Spec, Test `StageRendererTargets.spec.ts:728`
- `StageMaskInternals` behoben — `StageMask.ts:126`; `StageTransitionInternals` — `StageTransition.ts:73`; `CameraRigInternals` — `CameraRig.ts:222`

## Kleine Befunde

- `packages/twopoint5d/docs/stages.md:1324`: der Einschub »— `resize()` is the one way to set them —« ist nicht neu umbrochen (Folgezeile 142 Zeichen, Guide bricht um 100)
- `packages/twopoint5d/docs/stages.md:1891`: der neue Satz zu `precompile()` nicht neu umbrochen, Zeile bricht nach rund 75 Zeichen ab
- `packages/twopoint5d/src/stage/StageDirector.ts:1872`: wirft `super.remove()` schon einen `AggregateError` und das `dispose()` des Wrappers einen weiteren Fehler, entsteht ein verschachtelter `AggregateError` — vom Plan so gewollt, aber ungetestet und nicht dokumentiert
- (erledigt) `test:allocations` kam im Verify aus dem Nx-Cache; frischer Lauf ohne Cache grün

