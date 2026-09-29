# Paket 2 — Stage2D im Frame-Pfad: Szenenwechsel, needsUpdate, Allokationen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-006 (medium), API-006 (low), PERF-017 (low), DOC-037 (low), DOC-047 (info)
- Dazu im Paket:
  - Folge aus Paket 1 (Symptom): die Kurzform »`pipeline` ohne `buildOutputNode`« für Modus C unterschlägt die `RootRenderPipeline` — Schritt 7
  - vorbestehend, dieselbe Ursache wie PERF-017: die Closure in `#canCompose()` (`StageRenderer.ts:587`), pro Frame im komponierten Modus und pro Kind — Schritt 5
- Ziel: Ein Wechsel von `Stage2D.scene` baut den Ausgabeknoten des komponierten Modus neu, `needsUpdate` wirkt im Frame-Pfad, und der Render-Pfad der Stage allokiert pro Frame nichts.
- Modell: stärkste Stufe (`opus`)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/events.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts`
  - `packages/twopoint5d/src/stage/Stage2D.spec.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  - `packages/twopoint5d/CHANGELOG.md` (Abschnitt `[Unreleased]` samt dessen `### Migration Guide`)
- Verify: `pnpm run ci`
  (während der Arbeit schneller: `pnpm nx test twopoint5d -- src/stage/Stage2D.spec.ts src/stage/StageRenderer.spec.ts`; die Browser-Tests laufen nur über `pnpm test:browser` gegen die gebaute Library, also vorher `pnpm build:twopoint5d`)
- Commit: `fix: let a StageRenderer that composes pass nodes build its output node anew after the scene of a Stage2D changes, let Stage2D#updateFrame() apply a pending needsUpdate, hand the frame events of a stage one props object per stage and size the internal render targets without allocating, let the error of Stage2D#asPassNode() without a camera say when the projection creates one, give the IPassProvider example of the stage docs the guard of Stage2D, and let the docs name the pipeline-only mode as a pipeline without buildOutputNode that is not a RootRenderPipeline`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · BUG-006 unverändert (Feld `Stage2D.ts:44`; Kamera-Abo `StageRenderer.ts:1026-1028`, seit Paket 1 mit direktem `#outputDirty = true`; Neubau `:720-726`; Vergleich in `asPassNode()` `Stage2D.ts:332`) · API-006 unverändert (Feld `:50`, einzige Lesestelle `:198`, `updateFrame()` `:257-286` liest es nicht) · PERF-017 unverändert (`Stage2D.ts:273-278`; `#renderTargetSize()` `StageRenderer.ts:787-789`, gerufen aus `:792` und `:805`, pro Frame über `:623` in Modus C und `:699` je Kind) · DOC-037 unverändert (`Stage2D.ts:327`, Meldung per Regex geprüft in `StageRenderer.spec.ts:999`, `:1001`) · DOC-047 verschoben nach README `:418-441`, Inhalt unverändert · Folge aus Paket 1 (Kurzform Modus C) als Symptom hierher gezogen (Nachtragspaket mit Paket 2 zusammengelegt) · Closure in `#canCompose()` `:587` vorbestehend (vor dem Lauf `:590`), gleiche Ursache wie PERF-017, ins Paket · Queue »Offene Befunde« (2 Einträge aus Paket 1) nicht betroffen, bleibt liegen · Nutzer-Entscheidung zu den `getZoom()`-Namen eingeholt, im Plan unter »Entscheidungen« · Restplan geprüft: Reihenfolge und Schnitt bleiben, Hinweise an Paket 3 (`renderOrderArray`-Kopie im Frame-Pfad, umbenanntes Abo) und Paket 5 (Namen stehen fest) im Plan
  - 2026-09-29 Zug 1: Implementierer beauftragt (Runde 0, `opus`, effort medium), Brief `paket-2.impl-0.brief.txt`, Report nach `paket-2.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG · 8 Dateien geändert (`events.ts`, `Stage2D.ts`, `Stage2D.spec.ts`, `StageRenderer.ts`, `StageRenderer.spec.ts`, `README.md`, `CHANGELOG.md`, `stage-pipeline.test.js`) · 6 Vitest-Tests und 1 Browser-Test vor dem Fix rot · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-2.verify.log`)
  - 2026-09-29 Zug 3: Reviewer beauftragt (`opus`, effort medium), Diff `paket-2.diff`, Report nach `paket-2.review-0.json`
  - 2026-09-29 Zug 3: Urteil — alle 7 Punkte behoben, 0 kritisch, 0 wichtig, 4 klein · Diff `paket-2.diff`
  - 2026-09-29 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-29 Zug 5: Commit `59424ef0` auf `main`, Verify `paket-2.verify.log` exit=0 (keine Codeänderung seit dem Lauf) · Folge `StageRenderer.ts:662` im Plan unter Paket 2

## Urteil des Reviewers (Zug 3, `paket-2.review-0.json`)

- BUG-006: behoben — `Stage2D.ts` Accessor `scene` ab `:48`, Event `events.ts:117-123`, Abo `StageRenderer.ts:1037-1049`; Tests in `Stage2D.spec.ts`, `StageRenderer.spec.ts`, `stage-pipeline.test.js:112-143`
- API-006: behoben — `Stage2D.ts:302` (`updateProjection()` vor der Prüfung auf Szene und Kamera), TSDoc `needsUpdate` `:71-78`
- PERF-017: behoben — `#updateFrameProps` (`Stage2D.ts` ~`:284`), `#renderTargetWidth()`/`#renderTargetHeight()` (`StageRenderer.ts` ~`:796-804`), TSDoc an `StageUpdateFrameProps`, Migration Guide
- DOC-037: behoben — getrennte Meldungen `Stage2D.ts` ~`:351-360`, Regexe `/has no camera/`
- DOC-047: behoben — `README.md` ~`:436-446`
- Folge aus Paket 1 (Kurzform Modus C): behoben — `StageRenderer.ts:90-91`, `:416-423`, `:429`, `:463-464`, `:479-481`, `:504`; `README.md:204-205`, `:246-248`, `:271-273`; CHANGELOG `[Unreleased]`
- Closure in `#canCompose()`: behoben — `for…of` mit frühem `return false` (`StageRenderer.ts` ~`:594-599`)

Kleine Befunde (keine Runde):
- `Stage2D.spec.ts:577` — Kommentar `// (d) the second call …` steht über dem neuen Test `takes a scene after dispose() …` statt über `is safe to call twice` (`:592`)
- `Stage2D.ts:432` — TSDoc-Zeile von `dispose()` nach der Ergänzung nicht umbrochen (~150 Zeichen)
- `StageRenderer.ts:91` — Klassen-TSDoc »Clearing«, überlange Zeile
- `README.md:205`, `:291` — Absätze nach den Einschüben nicht neu umbrochen (nur kosmetisch)

Vom Implementierer gemeldet: `StageRenderer.ts:662` (Kommentar in `#renderPipelineSimple()` ohne Namen und Szenen) — in `git show 5ff01ea2` nicht vorhanden, also in Paket 1 entstanden: Folge, nicht Nebenbefund; steht als `Folgen:` unter Paket 2 im Plan.

## Abgleich und Begründungen

- **BUG-006 — Event statt Vergleich pro Frame.** Die Empfehlung nennt zwei
  Wege; gewählt ist der erste: `scene` wird ein Accessor, jeder Wechsel
  emittiert ein eigenes Event `OnStageAfterSceneChanged`, und `StageRenderer`
  hört darauf wie auf den Kamerawechsel. Das ist das Muster, das für die Kamera
  schon steht, und kostet im Frame-Pfad nichts. `OnStageAfterCameraChanged` zu
  verallgemeinern scheidet aus: seine Argumente `[stage, prevCamera]` sind
  veröffentlicht. Plain-Modus und Modus C lesen `stage.scene` bei jedem
  `renderTo()` und brauchen nichts; das Abo setzt nur `#outputDirty`, das
  Modus C seit Paket 1 nicht mehr liest.
- **BUG-006 — nach `dispose()`.** Die TSDoc von `Stage2D#dispose()` sagt, dass
  ein Schreiben auf `scene` danach durchgeht und nichts bewirkt, und dass nach
  dem `dispose`-Event keines mehr folgt. Beides bleibt wahr: der Setter
  schreibt das Feld auch danach, emittiert aber nur auf einer lebenden Stage.
- **API-006 — umgesetzt, nicht dokumentiert**, nach der Entscheidung vom
  2026-09-29. `updateProjection()` steht in `updateFrame()` direkt hinter dem
  Disposed-Guard und **vor** der Prüfung auf Szene und Kamera: eine Stage,
  deren Specs erst nach einem `needsUpdate` eine View ergeben, bekommt ihre
  Kamera so im selben Frame, statt ohne Kamera nie wieder an die Reihe zu
  kommen. Ohne gesetztes Flag kostet der Aufruf zwei Boolean-Checks. Wirft die
  Projektion dabei (eine zugewiesene Kamera, die sie nicht platzieren kann),
  kommt der Fehler aus `updateFrame()` heraus, und `needsUpdate` bleibt gesetzt
  — so wie `resize()` und `updateProjection()` sich heute schon verhalten;
  das Flag still zu löschen hieße, die Fehlkonfiguration zu verschlucken.
- **PERF-017 — Props je Stage, erster Frame eigenes Objekt.** Wie empfohlen:
  `OnStageFirstFrame` ist per `retain()` aufbewahrt und bekommt ein eigenes,
  einmal gebautes Objekt, sonst läse ein später Abonnent die Werte des
  aktuellen Frames. Dass die Props von `OnStageUpdateFrame` nur während des
  Aufrufs gelten, ist eine Verhaltensänderung für Code, der sie aufhebt: ein
  Eintrag im Migration Guide, obwohl sich keine Signatur ändert.
  `#renderTargetSize()` wird zu zwei Methoden, die je eine Zahl liefern —
  einfacher als ein Scratch-Vektor, und das Options-Objekt beim Neubau des
  Targets entsteht nur beim Neubau.
- **PERF-017 — die Closure in `#canCompose()`** ist dieselbe Ursache
  (Allokation pro Frame im Render-Pfad der Stage) und stand vor dem Lauf schon
  in `#renderPipelineComposed()`; Paket 1 hat sie nur in `#canCompose()`
  verschoben und zusätzlich aus `#clearsWholeTarget()` erreichbar gemacht. Eine
  Schleife ersetzt sie.
- **DOC-037.** Die Meldung übernimmt die Bedingung aus der Warnung in
  `updateFrame()` (`Stage2D.ts:267`) und das Format von `disposedError()`
  (`Stage2D#asPassNode() …`). Szene und Kamera bekommen getrennte Meldungen:
  eine fehlende Szene entsteht nur durch eine Zuweisung an `scene`, die der Typ
  nicht erlaubt, und hat mit `resize()` nichts zu tun.
- **DOC-047.** Das Beispiel bekommt den Guard (erste Hälfte der Empfehlung):
  wer die Vorlage übernimmt, übernimmt ihn mit.
- **Folge aus Paket 1.** Symptom von Paket 1: Paket 1 hat Stellen mit der
  Kurzform neu geschrieben (`StageRenderer.ts:89`, `:425`, `:459`, README
  `:204`, `:247`, CHANGELOG `:291`), drei weitere standen vor dem Lauf schon so
  da (`StageRenderer.ts:415`, `:474`, `:497`). Paket 1 ist committet; das
  Nachtragspaket für reine Doku in genau den Dateien, die Paket 2 ohnehin
  ändert, kostete drei Kaltstarts und ist deshalb mit Paket 2 zusammengelegt.
  Alle neun Stellen werden gezogen, die vorbestehenden mit, damit die Ursache
  zu Ende behoben ist. Die veröffentlichte Stelle `CHANGELOG.md:3403`
  (Abschnitt `[0.21.x]` und älter) bleibt, released Abschnitte sind
  unveränderlich.

## Vorgehen

Alle Namen sind verbindlich. Code, Kommentare und Doku auf Englisch, im Ton der
umliegenden TSDoc (volle Sätze, was der Code tut, kein Rückblick auf einen
Vorzustand). Zeilennummern gelten für den Stand von `676eefa7`; gesucht wird
über den zitierten Text.

### 1. Neues Event in `packages/twopoint5d/src/events.ts`

Direkt unter dem Block zu `OnStageAfterCameraChanged` (`:110-116`), im selben
Stil:

```ts
export const OnStageAfterSceneChanged = 'stageAfterSceneChanged';

export type StageAfterSceneChangedArgs = [stage: IStage, prevScene: Scene];

export interface IStageAfterSceneChanged {
  [OnStageAfterSceneChanged](...args: StageAfterSceneChangedArgs): void;
}
```

`Scene` kommt als `import type` zum bestehenden `import type {Camera} from 'three/webgpu';`
dazu. `packages/twopoint5d/src/index.ts` exportiert `events.js` schon mit
`export * from`, die drei Symbole sind damit öffentlich; kein Eintrag in einem
`public-api.ts` nötig.

Über `StageUpdateFrameProps` (`:93`) eine TSDoc (Inhalt verbindlich, Wortlaut
frei im Ton der Datei): Ein `Stage2D` gibt jedem `OnStageUpdateFrame` seiner
Frames dasselbe Objekt, vor jedem Emit neu beschrieben — die Werte gelten für
den Aufruf, in dem sie ankommen, und wer einen davon später braucht, kopiert
ihn. Die Props von `OnStageFirstFrame` sind ein eigenes Objekt, das die Stage
für einen Abonnenten aufhebt, der nach dem ersten Frame kommt.

### 2. `Stage2D.scene` als Accessor (`Stage2D.ts`)

- Das Feld `scene: Scene;` (`:44`) wird zu einem privaten Feld `#scene: Scene;`
  plus Accessor an derselben Stelle:
  - `get scene(): Scene` liefert `this.#scene`.
  - `set scene(scene: Scene)`: gleich wie bisher → `return`. Sonst
    `const prevScene = this.#scene; this.#scene = scene;`, dann
    `if (this.#disposed) return;` und
    `const args: StageAfterSceneChangedArgs = [this, prevScene]; emit(this, OnStageAfterSceneChanged, ...args);`
    — wie `#updateCamera()` (`:147-154`) es für die Kamera tut.
  - TSDoc am Getter: die `THREE.Scene`, die diese Stage rendert. Eine neue Szene
    gilt ab dem nächsten Frame in jedem Modus eines `StageRenderer`; jeder
    Wechsel emittiert `OnStageAfterSceneChanged` mit der Szene, die er ersetzt
    hat, und ein Renderer, der Pass-Nodes komponiert, baut darauf seinen
    Ausgabeknoten neu. Die Szene gehört dem Aufrufer: eine neue lässt die
    vorige, wie sie ist. Nach `dispose()` geht ein Schreiben durch und
    kündigt nichts an.
- Der Konstruktor (`:162-167`) schreibt `this.#scene` direkt, nicht über den
  Setter.
- `name` (`:52-58`) liest und schreibt über `this.#scene`.
- Die TSDoc von `dispose()` (`:380-382`): der Satzteil »a write to `scene`
  goes through and has no effect, since the stage no longer builds a node from
  it« bekommt dazu, dass er nichts ankündigt (kein `OnStageAfterSceneChanged`).
- Die TSDoc von `asPassNode()` (`:305-318`): hinter »… or in {@link dispose} if
  none comes.« ein Satz: ein `StageRenderer`, der diese Stage komponiert, hört
  beide Wechsel — `OnStageAfterCameraChanged` und `OnStageAfterSceneChanged` —
  und ruft diese Methode bei seinem nächsten Render erneut.

### 3. `StageRenderer` hört auf den Szenenwechsel (`StageRenderer.ts`)

- Import `OnStageAfterSceneChanged` aus `../events.js` neben
  `OnStageAfterCameraChanged`.
- `#cameraSubscriptions` (`:984-985`) heißt `#stageSubscriptions`; TSDoc:
  »Unsubscribe handle of the listener on each eventized stage: its camera and
  scene changes.« Alle Verwendungen in `add()` und `remove()` ziehen mit.
- In `add()` (`:1022-1030`) wird **ein** Listener auf beide Events gelegt:
  `on(stage, [OnStageAfterCameraChanged, OnStageAfterSceneChanged], () => { this.#outputDirty = true; })`
  — ein Handle für beide Namen. Der Kommentar darüber: ein Pass-Node behält
  Szene und Kamera, mit denen er gebaut wurde; eine Stage, die eine neue von
  beiden ankündigt, braucht einen neuen Pass-Node und damit einen neuen
  Ausgabeknoten — nur im komponierten Modus, weil der Knoten von Modus C das
  interne Target sampelt und weder Szene noch Kamera hält; deshalb wird das
  Flag hier gesetzt und nicht über `invalidateOutputNode()`, das jenen Knoten
  mit verwirft. (Den bestehenden Kommentar entsprechend erweitern.)
- TSDoc von `add()` (`:1002-1004`): »it listens for `OnStageAfterCameraChanged`
  and `OnStageAfterSceneChanged` and, in the composed mode, rebuilds the output
  node on the next render; `remove()` stops listening.«
- TSDoc von `remove()` (`:1042`): »Stops listening for the stage's camera and
  scene changes.«
- TSDoc von `dispose()` (`:854-855`): »the camera listeners it placed on its
  stages« → »the camera and scene listeners it placed on its stages«.
- TSDoc von `#outputDirty` (`:505-508`): »or the camera of a stage changed« →
  »or the camera or the scene of a stage changed«.
- TSDoc von `pipeline` (`:425-426`): »stages, their order and names and their
  cameras leave it standing« → »stages, their order and names, their scenes
  and their cameras leave it standing« (Satzanfang siehe Schritt 7).

### 4. `needsUpdate` im Frame-Pfad (`Stage2D.ts`)

- In `updateFrame()` (`:257`) direkt nach `if (this.#disposed) return;` die
  Zeile `this.updateProjection();` — vor `const {scene, camera} = this;`.
- `updateFrame()` bekommt eine TSDoc: wendet ein ausstehendes
  {@link needsUpdate} zuerst an — was die Projektion dabei wirft, kommt aus
  diesem Aufruf, und das Flag bleibt dann gesetzt —, emittiert danach im ersten
  Frame mit Kamera `OnStageFirstFrame` und in jedem Frame mit Kamera
  `OnStageUpdateFrame`. Auf einer entsorgten Stage tut es nichts.
- TSDoc von `needsUpdate` (`:46-49`) ersetzen, Inhalt: auf `true` setzen nach
  einer Änderung, die die Stage nicht selbst sieht — ein neuer Wert in den
  View-Specs ihrer Projektion wie `pixelZoom`; das nächste `updateFrame()`
  berechnet View und Kamera neu, oder ein eigenes `updateProjection()` vorher.
  Das Flag bleibt `true`, solange der Container keine Fläche hat, und geht auf
  `false`, sobald die Projektion gefragt wurde; eine Projektion, die die Kamera
  nicht platzieren kann, lässt es gesetzt.

### 5. Keine Allokation pro Frame

In `Stage2D.ts`:

- Neues Feld neben `isFirstFrame` (`:252`):
  `readonly #updateFrameProps: StageUpdateFrameProps = {stage: this, now: 0, deltaTime: 0, frameNo: 0};`
  mit einem Kommentar: ein Objekt je Stage für `OnStageUpdateFrame`, in jedem
  Frame neu beschrieben; `OnStageFirstFrame` bekommt ein eigenes, weil die Stage
  jenes für späte Abonnenten aufhebt.
- `updateFrame()` (`:273-285`): statt des Objektliterals
  `const props = this.#updateFrameProps; props.now = now; props.deltaTime = deltaTime; props.frameNo = frameNo;`.
  Im ersten Frame
  `emit(this, OnStageFirstFrame, {stage: this, now, deltaTime, frameNo} satisfies StageUpdateFrameProps);`
  (eigenes Objekt), danach wie bisher `this.isFirstFrame = false;`, dann
  `emit(this, OnStageUpdateFrame, props);`.

In `StageRenderer.ts`:

- `#renderTargetSize()` (`:786-789`) entfällt. An seine Stelle
  `#renderTargetWidth(): number` und `#renderTargetHeight(): number`, je
  `Math.max(1, Math.floor(this.width * this.#pixelRatio))` bzw. mit
  `this.height`; TSDoc je »Width (Height) a `RenderTarget` has to have, in
  device pixels, for the current `width` (`height`).«
- `#resizeRenderTarget()` (`:791-796`):
  `const w = this.#renderTargetWidth(); const h = this.#renderTargetHeight();`.
- `#ensureRT()` (`:804-807`):
  `return new RenderTarget(this.#renderTargetWidth(), this.#renderTargetHeight(), {type: renderer.getOutputBufferType(), samples: renderer.samples});`
- `#canCompose()` (`:585-588`): statt `.some(({stage}) => …)`
  `for (const {stage} of this.orderedStages) { if (isStage2DWithoutCamera(stage)) return false; } return true;`
  nach dem bestehenden Größen-Check; der Kommentar darüber bleibt.

### 6. Fehlermeldungen von `Stage2D#asPassNode()` (`Stage2D.ts:324-328`)

Die gemeinsame Prüfung `if (!scene || !camera)` wird zu zwei Prüfungen:

- ohne Szene: `throw new Error('Stage2D#asPassNode() has no scene to build a pass node from: assign one to stage.scene');`
- ohne Kamera: `throw new Error('Stage2D#asPassNode() has no camera to build a pass node with: the projection creates one on the first resize() whose width and height are finite numbers above 0 and for which its specs give a view with an area, and a stage without a projection needs one assigned to stage.camera');`

`StageRenderer.spec.ts:999` und `:1001` prüfen heute `/no scene or camera/`;
beide werden auf `/has no camera/` umgestellt.

### 7. Modus C präzise benennen (Folge aus Paket 1)

Modus C ist eine `pipeline`, die keine `RootRenderPipeline` ist, ohne
`buildOutputNode` (`#isPipelineOnly()`). Jede Stelle bekommt das mit:

- `StageRenderer.ts:89` (Klassen-TSDoc, Abschnitt »Clearing«): »With a
  {@link pipeline} and without {@link buildOutputNode}, …« → »With a
  {@link pipeline} that is not a `RootRenderPipeline` and without
  {@link buildOutputNode} (Mode C), …«.
- `:414-418` (TSDoc `pipeline`): Mode C als »a pipeline that is not a
  `RootRenderPipeline`, without `buildOutputNode`« beschreiben; mit
  `buildOutputNode` oder als `RootRenderPipeline` läuft ein aus den Pass-Nodes
  komponierter TSL-Graph — der eigene bzw. die additive Komposition der
  `RootRenderPipeline`.
- `:425` (TSDoc `pipeline`): »Without `buildOutputNode`, the output node is
  rebuilt only …« → »In Mode C, the output node is rebuilt only …« (Rest wie in
  Schritt 3).
- `:459` (TSDoc `outputRenderTarget`): »Under a parent with a pipeline but
  without `buildOutputNode`, …« → »Under a Mode C parent — a pipeline without
  `buildOutputNode` that is not a `RootRenderPipeline` — …«.
- `:474-478` (TSDoc `buildOutputNode`): »Without `buildOutputNode` but with
  `pipeline`, the renderer falls back …« → »Without `buildOutputNode`, a
  `pipeline` that is not a `RootRenderPipeline` falls back …«; und »Assigning
  or clearing it switches between the two pipeline modes« bekommt die Ausnahme:
  unter einer `RootRenderPipeline` komponiert der Renderer in beiden Fällen.
- `:497`: `/** Internal RT used in Mode C (a pipeline without buildOutputNode that is not a RootRenderPipeline). */`
- `README.md:204`: »When the renderer has a `pipeline` without
  `buildOutputNode` (Mode C), …« → »… a `pipeline` without `buildOutputNode`
  that is not a `RootRenderPipeline` (Mode C), …«.
- `README.md:246-247`: »(a `pipeline` without `buildOutputNode`)« → »(a
  `pipeline` without `buildOutputNode` that is not a `RootRenderPipeline`)«.
- `README.md:268-272`, Abschnitt »Mode C (§6.4)«: ein Satz zur Definition vor
  »The simplest path: …« — Mode C gilt für eine `pipeline` ohne
  `buildOutputNode`, die keine `RootRenderPipeline` ist; eine
  `RootRenderPipeline` komponiert wie Mode D (Verweis auf den Abschnitt
  »Shortcut: `RootRenderPipeline`«).
- `CHANGELOG.md:291` (`[Unreleased]`, `### Changed`): »(a `pipeline` without
  `buildOutputNode`)« → »(a `pipeline` without `buildOutputNode` that is not a
  `RootRenderPipeline`)«.

### 8. README (`packages/twopoint5d/src/stage/README.md`)

- `:284-286` (Mode C): »stages, `renderOrder`, stage names and cameras leave it
  standing« → »stages, `renderOrder`, stage names, scenes and cameras leave it
  standing«.
- `:316-321` (Mode D): »after a stage announced a new camera through
  `OnStageAfterCameraChanged` (every `Stage2D` does)« → »after a stage
  announced a new camera or a new scene through `OnStageAfterCameraChanged` or
  `OnStageAfterSceneChanged` (every `Stage2D` does)«.
- `:418-441` (DOC-047), Beispiel `MyStage` bleibt ein Block mit ```` ```ts ````
  (nicht `ts check`, er nennt `myScene`/`myCamera` ohne sie zu deklarieren):
  ein Feld `#disposed = false;`, in `asPassNode()` als erste Zeile
  `if (this.#disposed) throw new Error('MyStage#asPassNode() is not available: this stage has been disposed');`,
  in `dispose()` als erste Zeile `this.#disposed = true;`. Ein Kommentar am
  Guard: wie `Stage2D` baut eine entsorgte Stage keinen Knoten mehr, sonst
  hinge ein Render-Target an einem Knoten, den niemand mehr freigibt.
- `:454-456` (Events auf `Stage2D`): neuer Punkt nach
  `OnStageAfterCameraChanged`: »`OnStageAfterSceneChanged` — emitted on every
  change of `scene` with the replaced scene; a `StageRenderer` listens to it on
  each stage it holds as well.« Der Punkt `OnStageResize`,
  `OnStageFirstFrame`, `OnStageUpdateFrame` bekommt dazu: `OnStageUpdateFrame`
  gibt jedem Frame dasselbe Props-Objekt, neu beschrieben — Werte, die nach
  dem Aufruf gebraucht werden, kopieren; `OnStageFirstFrame` wird für späte
  Abonnenten aufbewahrt und trägt ein eigenes Objekt.
- `:504-506` (Lifecycle, `Stage2D#asPassNode()`): hinter »… after either of them
  has changed« ergänzen: ein komponierender `StageRenderer` fragt bei seinem
  nächsten Render nach jedem der beiden Wechsel erneut.

### 9. Tests — zuerst rot sehen, dann beheben

Vitest, `Stage2D.spec.ts` (Import `Scene` ist schon da; `OnStageAfterSceneChanged`
aus `../events.js` dazu):

- `'announces a scene change with the scene it replaced'` — Listener auf
  `OnStageAfterSceneChanged`, `stage.scene = next` → einmal mit
  `(stage, previous)`; dieselbe Szene noch einmal zugewiesen → kein weiterer
  Aufruf.
- im `describe('dispose()')`: `'takes a scene after dispose() and announces nothing'`
  — nach `dispose()` `on(stage, OnStageAfterSceneChanged, spy)`, dann
  `stage.scene = next` → `stage.scene` ist `next`, `spy` nicht gerufen.
- `'applies needsUpdate on the next updateFrame()'` —
  `new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640})`,
  `resize(320, 200)` (→ 640 × 400), dann
  `projection.viewSpecs = {fit: 'contain', width: 320}`, `needsUpdate = true`,
  `updateFrame(1, 0.016, 1)` → `[width, height]` ist `[320, 200]`,
  `needsUpdate` ist `false`, `OnStageResize` einmal mit der neuen Größe.
- `'leaves the projection alone in a frame without needsUpdate'` — nach
  `resize()` `vi.spyOn(projection, 'updateViewRect')`, `updateFrame()` → nicht
  gerufen.
- `'creates the camera in the frame that applies needsUpdate'` —
  `new ParallaxProjection('xy|bottom-left', {})`, `resize(800, 600)` → keine
  Kamera; `projection.viewSpecs = {fit: 'contain', width: 640}`,
  `needsUpdate = true`, Listener auf `OnStageFirstFrame`, `updateFrame(1, 0.016, 1)`
  → Kamera gesetzt, `OnStageFirstFrame` in genau diesem Frame einmal gerufen.
- `'hands every OnStageUpdateFrame the same props object, rewritten per frame'`
  — Listener sammelt Objekt und `frameNo` zur Aufrufzeit; zwei Frames → beide
  Male dasselbe Objekt (`toBe`), `frameNo` 1 und 2 zur jeweiligen Aufrufzeit.
- `'keeps the retained first-frame props apart from the per-frame props'` —
  `updateFrame(1, …, 1)`, `updateFrame(2, …, 2)`, dann später Abonnent auf
  `OnStageFirstFrame` → bekommt `frameNo` 1 und ein anderes Objekt als die
  Props von `OnStageUpdateFrame`. (Wächter, vor dem Fix schon grün; im Report
  so benennen.)

Vitest, `StageRenderer.spec.ts` (`Scene` kommt zum Import aus `three/webgpu`
`:2-13` dazu):

- im `describe('asPassNode + buildOutputNode (§6.2 / §6.3)')` neben
  `'assigning a camera to a Stage2D rebuilds the output node'` (`:1033`):
  `'assigning a scene to a Stage2D rebuilds the output node'` — mit
  `makeComposedSetup()`, `resize(100, 100)`, `renderTo()`, dann
  `stage.scene = new Scene()`, `renderTo()` → `buildOutputNode` zweimal
  gerufen, der zweite Pass ist ein anderer Knoten, und sein `scene` ist
  `stage.scene`.
- `'remove() stops listening to the camera of a stage'` (`:1046`) heißt
  `'remove() stops listening to the camera and the scene of a stage'`; die
  Zählung über `getSubscriptionCount` bleibt.
- in `'keeps the output node of Mode C through changes of stages, order, names and cameras'`
  (`:679`) ein weiterer Eintrag in `changes`:
  `['a scene change of a Stage2D', () => (stage2D.scene = new Scene())]`, der
  Testname endet auf »names, scenes and cameras«.
- `:999`, `:1001`: Regex `/has no camera/` (Schritt 6).

Browser, `packages/twopoint5d-testing/test/stage-pipeline.test.js`, direkt nach
`'Mode D: swapping the stage projection after the first frame rebuilds the output node through the new camera'`
(`:81-110`) und nach dessen Muster:
`'Mode D: swapping the stage scene after the first frame rebuilds the output node for the new scene'`
— Display 320 × 200, `buildOutputNode` zählt Aufrufe und merkt sich die Pässe,
zwei Frames, `buildCalls` 1; dann `stage.scene = new Scene()` (mit einem Mesh
darin), ein Frame → `buildCalls` 2 und `lastPasses[0].scene` ist `stage.scene`.
`Scene` kommt zum Import aus `three/webgpu` dazu.

Rot vor dem Fix gehört in den Report: der Szenen-Test in `Stage2D.spec.ts`
(Event fehlt), `'assigning a scene to a Stage2D rebuilds the output node'`,
`'applies needsUpdate on the next updateFrame()'`, `'creates the camera in the
frame that applies needsUpdate'`, `'hands every OnStageUpdateFrame the same
props object …'` und der Browser-Test.

### 10. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, `[Unreleased]`, Skill `updating-changelog`)

- `### Added`: das Event `OnStageAfterSceneChanged` von `Stage2D` mit den Typen
  `StageAfterSceneChangedArgs` und `IStageAfterSceneChanged`: jeder Wechsel von
  `Stage2D#scene` emittiert es mit der ersetzten Szene.
- `### Changed`:
  - `Stage2D#updateFrame()` wendet ein gesetztes `needsUpdate` an, bevor es die
    Frame-Events emittiert: ein neuer Wert in den View-Specs samt
    `needsUpdate = true` wirkt ab dem nächsten Frame.
  - mit Präfix `perf `: `Stage2D` gibt jedem `OnStageUpdateFrame` dasselbe
    Props-Objekt je Stage, neu beschrieben — die Werte gelten für den Aufruf;
    `OnStageFirstFrame` trägt ein eigenes Objekt. Die internen Render-Targets
    von `StageRenderer` werden ohne Allokation gegen die Größe geprüft.
  - die Meldung von `Stage2D#asPassNode()` ohne Kamera nennt, wann die
    Projektion eine erzeugt.
- `### Fixed`: ein `StageRenderer`, der Pass-Nodes komponiert — mit
  `buildOutputNode` oder einer `RootRenderPipeline` —, baut seinen
  Ausgabeknoten nach einem Wechsel von `Stage2D#scene` neu und zeigt die neue
  Szene ab dem nächsten Frame.
- `### Migration Guide`: neuer Abschnitt
  `#### The props of OnStageUpdateFrame hold for the call they arrive in` im
  Stil der Nachbarn, mit **Before**/**After**: Before hebt das Props-Objekt in
  einer Liste auf; After kopiert die Werte (`{...props}` oder die einzelnen
  Felder). Ein Satz, dass `OnStageFirstFrame` ein eigenes Objekt bleibt.

### Was dieses Paket nicht anfasst

- `IProjection#getViewRect()` und `getZoom()` (Paket 5); `Stage2D.ts:213`
  destrukturiert weiter das Tupel.
- Die Stage-Beziehung, Dispose-Austrag und Iteration über einen Schnappschuss
  (Paket 3); `add()` behält seinen Ablauf, nur das Abo wechselt auf beide
  Events.
- Den `buildOutputNode`-Setter ohne Disposed-Guard und den falsch
  einsortierten Test `'invalidateOutputNode() forces a rebuild on next render'`
  (Queue »Offene Befunde«).
- Den Frame-Tick von `Canvas2DStage` (Paket 4).

## Findings im Volltext

**BUG-006 · medium · packages/twopoint5d/src/stage/Stage2D.ts:44** — Ausgabeknoten des komponierten Modus bei einem Wechsel von `Stage2D.scene` neu bauen
Weitere Fundstellen: `StageRenderer.ts:876`, `StageRenderer.ts:599`, `Stage2D.ts:332` (Stand des Audits)
`Stage2D.scene` ist ein frei beschreibbares Feld ohne Setter und ohne Event. `StageRenderer` markiert seinen `pipeline.outputNode` nur bei `OnStageAfterCameraChanged` als dirty (StageRenderer.ts:876–878) und fragt `asPassNode()` nur, solange `#outputDirty` gilt (StageRenderer.ts:599–605). Die Doku von `asPassNode()` verspricht, dass ein Szenenwechsel den alten Knoten »on the next call of this method« ersetzt — dieser Aufruf kommt im komponierten Modus aber nicht. Folge: Nach `stage.scene = otherScene` rendert der Plain-Modus und Modus C die neue Szene (über `renderTo()` → `renderer.render(this.scene, …)`), Modus D und E zeigen weiter den `pass(alteSzene, camera)`, bis zufällig ein `add()`, `remove()` oder Kamerawechsel den Knoten neu baut.
Beleg: `on(stage, OnStageAfterCameraChanged, () => this.invalidateOutputNode())` — kein Pendant für die Szene
Empfehlung: `scene` als Accessor mit Setter führen, der bei Änderung ein Event (z. B. das bestehende `OnStageAfterCameraChanged` verallgemeinert oder ein eigenes) auslöst, auf das `StageRenderer.add()` ebenfalls `invalidateOutputNode()` legt. Alternativ im komponierten Pfad pro Frame Szene und Kamera jeder `Stage2D` gegen den gebauten Knoten vergleichen.

**API-006 · low · packages/twopoint5d/src/stage/Stage2D.ts:50** — `Stage2D.needsUpdate` im Frame-Pfad auswerten oder als reinen Merker für manuelles `updateProjection()` dokumentieren
Weitere Fundstellen: `Stage2D.ts:195`, `Stage2D.ts:257`
Das öffentliche Flag `needsUpdate` wird nur in `updateProjection(false)` gelesen. Im ganzen Paket ruft niemand `updateProjection()` ohne `forceUpdate` auf (`Canvas2DStage` und der `projection`-/`camera`-Setter immer mit `true`), und weder `updateFrame()` noch `renderTo()` noch `StageRenderer` schauen auf das Flag. Wer nach einer Änderung an `projection.viewSpecs` (z. B. `pixelZoom`) `stage.needsUpdate = true` setzt, sieht bis zur nächsten Änderung der Containergröße keine Wirkung. Das spart zwar pro Frame jede Projektionsrechnung, lässt das Flag aber ohne Verbraucher.
Beleg: `if ((forceUpdate || this.needsUpdate) && this.projection) {` — einzige Lesestelle
Empfehlung: In `updateFrame()` vor dem Emit `this.updateProjection()` aufrufen: ohne gesetztes Flag kostet das einen Boolean-Check, mit Flag genau eine Neuberechnung. Alternativ JSDoc des Flags ausdrücklich auf »wird nur von einem manuellen `updateProjection()` gelesen« setzen.

**PERF-017 · low · packages/twopoint5d/src/stage/Stage2D.ts:273** — Allokationen pro Frame im Stage-Render-Pfad vermeiden
Weitere Fundstelle: `StageRenderer.ts:652` (Stand des Audits)
`Stage2D.updateFrame()` baut in jedem Frame für jede Stage ein neues `StageUpdateFrameProps`-Objekt und emittiert `OnStageUpdateFrame` auch dann, wenn niemand zuhört (Zeile 273–285). Bei vielen Stages bzw. verschachtelten Renderern summiert sich das zu N Objekten pro Frame für den GC. Im Pipeline-Modus C und für Kind-Renderer ruft `#ensureRT()` → `#resizeRenderTarget()` pro Frame `#renderTargetSize()`, das jedes Mal ein neues Tupel `[w, h]` zurückgibt. Projektions- und Kamera-Updates selbst laufen dagegen nicht pro Frame, sondern nur bei Größen- oder Spezifikationswechseln.
Beleg: `const updateFrameProps: StageUpdateFrameProps = {stage: this, now, deltaTime, frameNo};`
Empfehlung: Pro Stage ein Props-Objekt halten und je Frame nur `now`, `deltaTime`, `frameNo` überschreiben; für `OnStageFirstFrame` ein eigenes Objekt verwenden, weil `retain()` es für späte Abonnenten aufbewahrt. In der JSDoc der Props festhalten, dass sie nur während des Aufrufs gelten. `#renderTargetSize()` in zwei Felder oder einen wiederverwendeten Scratch-Vektor schreiben.

**DOC-037 · low · packages/twopoint5d/src/stage/Stage2D.ts:327** — Die Fehlermeldung von Stage2D#asPassNode() vollständig machen
»no scene or camera yet — call resize() first« ist ungenau: ein `resize()` reicht nicht, wenn die Specs keine View ergeben oder die Projektion fehlt. `updateFrame()` nennt die Bedingung vollständig. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Die Meldung an `updateFrame()` angleichen: Projektion gesetzt, Specs ergeben eine View mit Fläche, `resize()` mit Breite und Höhe > 0.

**DOC-047 · info · packages/twopoint5d/src/stage/README.md:397** — Das IPassProvider-Beispiel im README widerspricht der Zusage von Stage2D
`MyStage#asPassNode()` im Beispiel baut nach dem eigenen `dispose()` wieder einen Knoten, statt zu werfen wie `Stage2D`. Für eine Vorlage vertretbar — wer die Semantik von `Stage2D` will, ergänzt den Guard selbst —, aber ein Leser übernimmt die Vorlage, nicht die Fußnote.
Empfehlung: Dem Beispiel den Guard geben, den `Stage2D` trägt, oder in einem Halbsatz sagen, dass die Vorlage ihn bewusst auslässt.

**Folge aus Paket 1 (Symptom) · Kurzform der Modus-C-Definition**
Kurzform »`pipeline` ohne `buildOutputNode`« für Modus C unterschlägt die `RootRenderPipeline` (die komponiert): `packages/twopoint5d/src/stage/StageRenderer.ts:89`, `:459`, `:497`, `packages/twopoint5d/src/stage/README.md:204`, `:247`, `packages/twopoint5d/CHANGELOG.md:291` — Zusatz »and not a `RootRenderPipeline`« oder Verweis auf die Mode-C-Definition der README. Beim Abgleich dazugekommen, gleiche Ursache: `StageRenderer.ts:415`, `:425`, `:474`.
