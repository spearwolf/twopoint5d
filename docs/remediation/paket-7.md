# Paket 7 — StageRenderer, Stage2D und Render-Target-Pool

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-019 (low), BUG-029 (low), API-003 (low), API-004 (low), TYPE-004 (low), DOC-002 (low), PERF-003 (low)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie BUG-029 — der Join behandelt `host.onResize()` als
  reines Abo, obwohl ein Host mit gehaltener Größe darin schon den ersten `resize()` fährt): ein
  Listener dieses Replays (`OnStageResize` einer Stage), der den Renderer entsorgt oder an einen
  anderen Host hängt, findet noch keinen gebuchten Abo-Handle — `#addToHost()` bucht ihn erst nach der
  Rückkehr von `onResize()` (`StageRenderer.ts:400-404`). Folge: der entsorgte Renderer bleibt am
  Display abonniert (Leck), bzw. der umgehängte Renderer hängt an beiden Hosts und zeichnet in
  beiden. Vorbestehend: `StageRenderer.ts` ist seit d9b648bf unverändert.
- Ziel: Renderer und Stage2D lehnen Fehleingaben sichtbar ab, geben ihren Zustand typsicher heraus und übernehmen Kamerawechsel ohne Shader-Rebuild.
- Modell: stärkste Stufe
- Effort: high (öffentliche API: `StageItem`, `acquire()`, Pass-Node-Identität; Re-Entrance im Join)
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts` (+ `StageRenderer.spec.ts`)
  - `packages/twopoint5d/src/stage/Stage2D.ts` (+ `Stage2D.spec.ts`)
  - `packages/twopoint5d/src/stage/StageRenderTargetPool.ts` (+ `StageRenderTargetPool.spec.ts`)
  - `packages/twopoint5d/src/stage/IStageRendererHost.ts`, `packages/twopoint5d/src/stage/IPassProvider.ts` (nur TSDoc)
  - `packages/twopoint5d/docs/stages.md`
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`, Skill `updating-changelog`)
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  - Nicht anfassen: `StageDirector.ts` (liest `StageItem` nur, ruft `super.resizeStage()`; bleibt unverändert und muss weiter compilieren), Proposals (halten ihre Grundlage fest; der Guide gilt)

## Vorgehen

Reihenfolge so, dass jeder Bugfix seinen roten Lauf vor dem Fix bekommt. Zeilenangaben gegen den
Stand 11f2b368 (identisch mit d9b648bf für alle Dateien dieses Pakets außer `StageTransition.ts`).

### 1. TYPE-004 — `satisfies` statt `as` an den Event-Props

`StageRenderer.ts:1455`: `{stage, renderer: this} as StageAddedProps` → `{stage, renderer: this} satisfies StageAddedProps`.
`StageRenderer.ts:1502`: dasselbe mit `StageRemovedProps`. Vorbild `Stage2D.ts:424`. Kein Test, kein
CHANGELOG (keine Verhaltensänderung).

### 2. API-004 — `StageItem` öffentlich schreibgeschützt

- `StageRenderer.ts:75-82`: alle vier Felder `readonly` (`stage`, `width`, `height`, `pixelRatio`).
  TSDoc an das Interface: »One stage of a `StageRenderer` and the size it carries — the record
  `resize()` keeps of which size each stage has taken. Read-only: the renderer writes it in `add()`
  and `resize()`, and nothing else does.« Die TSDoc von `pixelRatio` bleibt.
- Direkt darunter, **nicht exportiert** (sonst wird er über `export * from './StageRenderer.js'` in
  `public-api.ts` öffentlich): `type StageItemRecord = {-readonly [K in keyof StageItem]: StageItem[K]};`
  mit Kommentar: das Item, wie der Renderer es führt; abgeleitet, damit es mit `StageItem` Schritt hält.
- `readonly #stages: StageItemRecord[] = [];` (`:219`); in `add()` (`:1408`) `const item: StageItemRecord = {…}`.
- `resizeStage(stageItem: StageItem, …)` (`:556`) behält seine Signatur (protected, Teil der
  öffentlichen `.d.ts`; `StageDirector.ts:1229` überschreibt sie). Geschrieben wird über
  `const record: StageItemRecord = stageItem;` — ohne `as`: TypeScript lässt einen `readonly`-Typ in
  einen beschreibbaren, das ist hier gewollt (im Zug 0 mit `tsc` 7.0.2 nachgeprüft: compiliert, und
  ein direkter Schreibzugriff auf `StageItem` scheitert). Kommentar dazu: die Items sind Records, die
  dieser Renderer in `add()` gebaut hat; `readonly` hält Aufrufer außerhalb davon ab.
- TSDoc `stages` (`:221-226`): »a read-only view of the live list, its items included«.
  TSDoc `resizeStage()` (`:550-555`) ergänzen: »The item is read-only to an override: this method is
  the one place that writes it, so an override that leaves out `super.resizeStage()` leaves the item
  at the size it had.«
- Spec (`StageRenderer.spec.ts`, describe `'add / remove'`): ein Test, der
  `// @ts-expect-error a stage item is read-only` vor `sr.stages[0]!.width = 800;` setzt (und je eine
  Zeile für `stage` und `pixelRatio`) und zur Laufzeit nichts weiter prüft als, dass ein folgendes
  `sr.resize(800, …)` die Stage erreicht. **Roter Lauf** vor der Änderung: `pnpm typecheck` meldet
  `TS2578: Unused '@ts-expect-error' directive`.
- CHANGELOG `### Changed`: »`StageItem` is read-only: `stage`, `width`, `height` and `pixelRatio` of
  an item in `StageRenderer#stages` and `orderedStages` are `readonly`, so a write into the record of
  the renderer no longer compiles.« Dazu ein Eintrag im `### Migration Guide` von `[Unreleased]`:
  wer in ein Item schrieb (`renderer.stages[0].width = 800`), gibt die Größe über
  `renderer.resize()`, die Stage über `add()`/`remove()`; eine Unterklasse, die in ihrem
  `resizeStage()`-Override selbst ins Item schrieb, ruft `super.resizeStage()`. Block als
  einfacher `ts`-Auszug, nicht `ts check`.

### 3. BUG-019 — `needsUpdate` übersteht eine werfende Projektion

- `Stage2D.ts:315-319`: `updateViewRect()` und `getViewRect()` in ein `try`; im `catch`
  `this.needsUpdate = prevNeedsUpdate; throw error;`. `this.needsUpdate = false` bleibt vor dem `try`
  stehen (kleinster Eingriff, die Reihenfolge der übrigen Zustände bleibt). Der Kommentar `:307-308`
  stimmt danach; der Kommentar `:339-341` bekommt keinen Zusatz.
- TSDoc `needsUpdate` (`:80-82`): »…and turns `false` as soon as the projection has answered; a
  projection that throws, or cannot place the camera, leaves it set.« Die TSDoc von `updateFrame()`
  (`:380-381`) verspricht das schon und bleibt.
- Spec (`Stage2D.spec.ts`, neben `'keeps needsUpdate and the size when the projection refuses the
  camera'` `:284`): je ein Test für `updateViewRect()` und `getViewRect()`, die einmal werfen
  (`vi.spyOn(projection, 'updateViewRect').mockImplementationOnce(() => { throw failure; })`): Stage
  mit Größe und Kamera, `stage.needsUpdate = true`, `updateFrame()` wirft `failure`, `needsUpdate` ist
  danach `true`, das nächste `updateFrame()` fragt die Projektion erneut (Aufrufzahl 2) und setzt das
  Flag zurück; Breite und Höhe unverändert. Derselbe Fall einmal über `updateProjection()` direkt.
  **Roter Lauf** vor dem Fix.
- CHANGELOG `### Fixed` (neu unter `[Unreleased]`, nach `### Deprecated`, vor `### Migration Guide`):
  »`Stage2D` keeps `needsUpdate` set when `updateViewRect()` or `getViewRect()` of its projection
  throws, so the next `updateFrame()` tries the update again, as its documentation says«.

### 4. API-003 — `StageRenderTargetPool#acquire()` prüft seine Zahlen

- `StageRenderTargetPool.ts:60`: als Erstes, **vor** der Prüfung auf `#disposed` (wie der Director
  seine Argumente auch nach `dispose()` prüft, Paket 6) und vor jeder Suche:
  `width` und `height` ganze Zahlen ≥ 1, `samples` ganze Zahl ≥ 0. Modul-lokaler Helfer, nicht
  exportiert:

  ```ts
  function assertWholeNumber(value: unknown, name: string, min: number): void {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
      throw new RangeError(
        `StageRenderTargetPool#acquire(): ${name} must be a whole number of ${min} or more, got ${describeValue(value)}`,
      );
    }
  }
  ```

  (`describeValue` aus `../utils/describeValue.js`). `type` bleibt ungeprüft.
- **Abweichung von der Empfehlung** (`assertPositiveFinite()`): die Zahlen sind Pixel des Targets
  selbst (TSDoc `:54-55`); `0.5` bestünde `assertPositiveFinite()`, ergäbe aber eine Textur der Breite
  0, und der Fehler käme wieder tief aus three.js — genau der Befund. Ganzzahlprüfungen schreibt die
  Library von Hand mit derselben Form (`AsepriteJson.ts:150`, `PaletteSwap.ts:61`).
- TSDoc `acquire()` (`:51-59`) ergänzen: »`width` and `height` are whole numbers of 1 or more,
  `samples` a whole number of 0 or more; any other value is refused with a `RangeError` that names
  the call, the argument and the value, before the pool changes — a refused call resizes and releases
  no target. The check comes first, also after `dispose()`.«
- Spec (`StageRenderTargetPool.spec.ts`): Tabelle über `width` und `height` je `NaN`, `0`, `-1`,
  `1.5`, `Infinity`, `'8'` (als `any`) und über `samples` je `-1`, `1.5`, `NaN` — jeder Aufruf wirft
  `RangeError` mit dem Text oben; davor ein Target geliehen und zurückgegeben, danach liefert ein
  gültiges `acquire()` derselben Größe genau dieses Objekt, und sein `dispose()` (Spy) lief nicht.
  Ein Fall nach `pool.dispose()`: `acquire(NaN, …)` wirft den `RangeError`. **Roter Lauf** vor dem Fix.
- Guide: keine Änderung (`docs/stages.md` §»Sharing the internal target« `:527ff.` nennt `acquire()` nicht).
- CHANGELOG `### Changed`: »`StageRenderTargetPool#acquire()` refuses a `width` or `height` that is
  not a whole number of 1 or more and a `samples` that is not a whole number of 0 or more with a
  `RangeError`, before it lends, resizes or releases a target«.

### 5. BUG-029 und der Re-Entrance-Nebenbefund — die gehaltene Größe nach dem Join

Hintergrund (nachgesehen): `Display` hält `OnDisplayResize` per `retain()` (`Display.ts:942`),
`onResize = (listener) => on(this, OnDisplayResize, listener)` (`:2176`). eventize 6.3.0 spielt den
gehaltenen Wert während `on()` ab und fängt, was der Listener dabei wirft, nur mit `console.warn`
ab (`node_modules/@spearwolf/eventize/docs/retain.md` §»A listener that throws on a replay«).

- `StageRenderer.ts` `#addToHost()` (`:395-417`): Die Größe, die ein Host während des Abos abspielt,
  wird **gehalten**, nicht sofort angewendet. Lokale Variablen (kein Objekt, keine Allokation je
  Event): `let joining = true; let replayed = false; let replayedWidth = 0; let replayedHeight = 0; let replayedPixelRatio = 1;`.
  Der `onResize`-Listener: solange `joining`, schreibt er die drei Werte und `replayed = true` und
  kehrt zurück; danach ruft er wie bisher `this.resize(width, height, pixelRatio)`. `joining = false`
  in einem `finally` um beide Abos. Nur wenn beide Abos gebucht sind und `replayed` gilt:
  `try { this.resize(replayedWidth, replayedHeight, replayedPixelRatio); } catch (error) { errors.push(error); }`,
  dann `return true`. Wirft der Host bei einem Abo, verfällt die gehaltene Größe mit den
  zurückgegebenen Handles (der Renderer hält dann nichts vom Host).
  Kommentar über dem Listener, sinngemäß: ein Host, der seine letzte Größe neuen Abonnenten
  nachreicht — `Display` hält `OnDisplayResize` —, reicht sie während `onResize()`, und eventize
  fängt, was dabei geworfen wird. Gehalten, bis beide Abos gebucht sind, erreicht die Größe
  `resize()` außerhalb des Abos: eine Stage, die sie ablehnt, erreicht den Aufrufer, und ein
  Listener dieses Resize, der den Renderer entsorgt oder umhängt, findet jedes Abo gebucht vor.
- Setter `parent` (`:332-344`): nach `#addToHost(parent, errors) === true` geht `OnAddToParent` nur
  noch hinaus, wenn `!this.#disposed && this.#parent === parent` — ein Listener des nachgereichten
  Resize kann den Renderer entsorgt oder umgehängt haben. Der `else`-Zweig (`this.#parent = undefined`)
  bleibt allein für `false`. Die Größe kommt weiter **vor** `OnAddToParent` (ein Listener dort liest
  die Größe des Hosts, wie bisher).
- Verhalten, das daraus folgt und so dokumentiert wird: die Ablehnung macht den Join nicht
  rückgängig — `parent` antwortet den Host, der Renderer behält die Größe, die er hatte (Regel von
  `resize()`), und der nächste Resize des Hosts fragt die Stage erneut, auch mit derselben Größe.
  »Size first« wie bei einem Parent-Renderer geht hier nicht: der Host nennt seine Größe erst im Abo,
  und der Renderer hat seinen vorigen Halter da schon verlassen.
- Konstruktor: keine Änderung. `new StageRenderer(display)` hat noch keine Stage und kein Target,
  nichts kann die Größe ablehnen; `StageDirector` setzt `parent` erst nach seinen Feldern
  (`StageDirector.ts:568-572`).
- TSDoc `parent` (`:298-303`), neuer Absatz vor dem letzten: »A host that hands its current size to
  a new subscriber — a `Display` does — gives it to this renderer once the renderer has joined, before
  `OnAddToParent`: a stage that refuses it makes the assignment throw that error after the join,
  together with the errors of the listeners. The renderer stays joined and keeps the size it had,
  see {@link resize}, and the next resize of the host asks the stage again. A listener of that resize
  that disposes this renderer or gives it another holder ends the join there: no `OnAddToParent`
  goes out for the host.«
- TSDoc `IStageRendererHost` (`IStageRendererHost.ts:7-15`) ergänzen: »A host may hand its current
  size to the listener while `onResize()` subscribes, as a `Display` does: the renderer holds that
  size until both subscriptions stand and hands it to its `resize()` afterwards, so a stage that
  refuses it reaches the caller as well.«
- Guide `docs/stages.md:416-424`: dritter Punkt der Liste »A stage refuses the size …«: »in
  `attach(host)` or `parent = host` on a `Display` that already has a size, the renderer joins first
  and takes the size after: a stage that refuses it makes the call throw once the renderer has joined;
  the renderer keeps the size it had, and the next resize of the display asks again.«
- Specs (`StageRenderer.spec.ts`, describe `'parent / host wiring'` `:1212`): neuer Helfer
  `makeRetainingHost()` mit echtem eventize wie `Display`: `eventize(host)`, `retain(host, 'resize')`,
  `onResize: (l) => on(host, 'resize', l)`, `onRenderFrame: (l) => on(host, 'frame', l)`,
  `emitResize(w, h, r = 1)` → `emit(host, 'resize', {width: w, height: h, pixelRatio: r})` (die
  Felder, die `#addToHost()` liest). Fälle, je mit `getSubscriptionCount()` aus eventize:
  a. eine Stage, deren `resize()` die nachgereichte Größe ablehnt: `attach(host)` wirft genau diesen
     Fehler, `sr.parent === host`, `sr.width === 0`; ein erneutes `emitResize` mit derselben Größe
     fragt die Stage wieder und der Renderer nimmt die Größe. **Roter Lauf** vor dem Fix (kein Throw).
  b. ein Listener von `OnAddToParent` liest `sr.width`/`sr.height` des Hosts (Reihenfolge bleibt).
  c. eine Stage, deren `resize()` den Renderer entsorgt: danach `getSubscriptionCount(host) === 0`,
     kein `OnAddToParent`. **Roter Lauf** vor dem Fix (2 Abos bleiben).
  d. eine Stage, deren `resize()` den Renderer an einen zweiten Host hängt: `getSubscriptionCount(host1) === 0`,
     `sr.parent === host2`, `OnAddToParent` genau einmal. **Roter Lauf** vor dem Fix.
  e. `new StageRenderer(host)` an einem Host mit Größe trägt die Größe nach dem Konstruktor.
- CHANGELOG `### Fixed`: »a `StageRenderer` that joins a `Display` — or another host that hands its
  current size to a new subscriber — takes that size once it has joined: a stage that refuses it makes
  `attach()` or the `parent` assignment throw that error, where it reached only the console before,
  and a listener of that resize that disposes the renderer or attaches it elsewhere leaves no
  subscription behind at the host«.

### 6. DOC-002 — einmalige Warnung bei gemischten Schreibern

Entscheidung vom 2026-10-31 (Plan, »Entscheidungen«): einmalige `console.warn` im Stil von
`StageRenderOrder#warnAboutSharedNames`, keine Ablehnung.

- `StageRenderer.ts` `#renderStagesInline()` (`:906-909`), **nur der plain mode**: vor
  `#drawStages()` `if (!this.#warnedAboutPipelineChild && stages.length > 1) this.#warnAboutPipelineChild(stages);`
  Feld `#warnedAboutPipelineChild = false`.
- `#warnAboutPipelineChild(stages)`: indizierte Schleife (keine Allokation, wie `#canCompose()`); die
  erste Stage mit `stage instanceof StageRenderer && stage.#renderMode() !== 'plain' && stage.outputRenderTarget == null`
  setzt das Flag und warnt einmal, mit `// biome-ignore lint/suspicious/noConsole: the warning to the developer is the point`:

  ```
  StageRenderer "${this.name}" has no pipeline and draws the renderer "${child.name}", which runs a pipeline of its own, into one target with other stages: the quad of that pipeline covers every pixel of the target without blending, and what the stages before it drew there is lost. Give the outer renderer the pipeline — a RootRenderPipeline composes every child —, or give "${child.name}" an outputRenderTarget of its own.
  ```

  Namen von Hand gequotet (string-typisiert, unterscheiden Instanzen — AGENTS.md).
- **Abweichungen von der Empfehlung**, beide begründet: (1) Ein `outputRenderTarget` des Parents
  nimmt ihn nicht aus — das Quad deckt jedes Ziel, in das der Parent zeichnet, die Stages davor
  gehen dort ebenso verloren (`RenderPipeline` zeichnet ins aktuelle Target, Klassen-TSDoc `:120`).
  (2) Gewarnt wird erst ab einer zweiten Stage: ein Kind mit Pipeline allein ist der eine Schreiber,
  den »One writer per canvas« erlaubt. Kein whole-picture-Parent: der zeichnet seine Kinder in sein
  internes Target, das seine Pipeline sampelt — dokumentiert und unterstützt (`docs/stages.md:672-674`).
  Einmal je Renderer-Instanz, wie `Stage2D` seine Kamera-Warnung (`Stage2D.ts:377`, `:406`).
- Klassen-TSDoc (`:120-125`) am Ende des Absatzes: »A renderer without a pipeline that draws a nested
  renderer with a pipeline of its own beside other stages into one target warns once on the console
  — see "One writer per canvas" in the stages guide.«
- Guide `docs/stages.md:685-686` (Muster 2) ergänzen: »A renderer without a pipeline that draws such a
  child beside other stages warns once on the console.« Troubleshooting `:2031-2032`: »…; a root
  without a pipeline warns once when it draws a child with a pipeline beside other stages.«
- Specs (`StageRenderer.spec.ts`, neuer describe `'a child with a pipeline under a renderer without one'`):
  plain Parent mit `fakeStage` + Kind-Renderer im whole-picture mode (Pipeline-Mock wie `:446`) ohne
  `outputRenderTarget`: zwei `renderTo()` → `console.warn` genau einmal, Text enthält beide Namen.
  Je ein Test ohne Warnung: Kind allein; Kind mit eigenem `outputRenderTarget`; Kind ohne Pipeline;
  Parent im composed mode; Parent im whole-picture mode. Und: ein Parent mit `outputRenderTarget`
  warnt. **Roter Lauf** vor dem Fix (keine Warnung).
- CHANGELOG `### Changed`: »a `StageRenderer` without a pipeline warns once on the console when it
  draws a nested renderer with a pipeline of its own and without an `outputRenderTarget` beside other
  stages into one target — the combination the stages guide calls not supported«.

### 7. PERF-003 — der Pass-Node eines `Stage2D` übersteht neue Kamera und Szene

Grundlage (nachgesehen): three 0.187.0 `PassNode` liest `scene` und `camera` als einfache Felder in
`updateBefore()` (`node_modules/.pnpm/three@0.187.0/node_modules/three/src/nodes/display/PassNode.js:855-896`)
und schreibt dort jedes Frame die Near/Far-Uniforms aus `this.camera` (`:895-896`); `setup()` und die
Depth-Nodes (`:764-793`) hängen am Kameratyp nicht. Derselbe Node kann die neue Kamera ohne
Graph-Änderung übernehmen.

**Stage2D.ts**
- `asPassNode()` (`:481-507`): nach der Kamera-Prüfung `this.#passNode ??= pass(scene, camera); return this.#passNode;`.
  `#passNodeScene` und `#passNodeCamera` (`:462-463`, `:503-504`, `:526-527`) entfallen;
  `#disposePassNode()` setzt nur noch `#passNode` zurück.
- Setter `scene` (`:63-73`): direkt nach `this.#scene = scene;` `if (this.#passNode != null) this.#passNode.scene = scene;`
  (nach `dispose()` ist `#passNode` schon `undefined`).
- `#updateCamera` (`:224-235`): innerhalb von `if (prevCamera !== this.camera)`, **vor** dem Emit:
  `const camera = this.camera; if (camera != null && this.#passNode != null) this.#passNode.camera = camera;`.
  Eine Kamera, die wegfällt (`undefined`), lässt dem Node seine bisherige: gezeichnet wird er dann
  nicht (`renderTo()` zeichnet nichts, ein komponierender Renderer nicht ohne Kamera, `#canCompose()`),
  und die nächste Kamera geht hinein. Damit folgt auch ein Node, den eigener Code einmal geholt hat,
  jeder Zuweisung. Kommentar mit dem Grund aus »Grundlage« (ein Satz, ohne Versionsgeschichte).
- TSDoc `scene` (`:48-58`): statt »a renderer that composes pass nodes builds its output node anew on
  it«: »the pass node of {@link asPassNode} renders the new scene from its next draw, and a renderer
  that composes this stage keeps its output node«. TSDoc `camera` (`:194-197`): denselben Satz für die
  Kamera vor »Every change of the camera emits …«. TSDoc `asPassNode()` (`:465-480`) neu für den
  Mittelteil: »The same node comes back for the life of the stage: a new scene or camera goes into it
  as it is assigned and applies from its next draw, so a renderer that composes this stage keeps its
  graph and builds no shader for it. A camera that goes away leaves the node with the camera it had.«
  Der Satz über zwei Renderer, Besitz und `dispose()` bleibt.

**StageRenderer.ts**
- Felder: `#passesToCheck = false` und `#composedPasses: Node[] = []`.
- `add()` (`:1433-1441`): der Listener auf `[OnStageAfterCameraChanged, OnStageAfterSceneChanged]`
  setzt `this.#passesToCheck = true` statt `#outputDirty`. Kommentar `:1434-1438` neu: eine Stage, die
  eine neue Kamera oder Szene meldet, kann einen neuen Pass-Node reichen — ein `Stage2D` behält seinen
  und schreibt beide hinein —, also fragt der nächste komponierende Frame nach und baut nur für einen
  anderen Node neu; der whole-picture mode liest das Flag nicht.
- `#rebuildComposedOutputNode()` (`:1102-1112`): `this.#composedPasses = passes;` und `this.#passesToCheck = false;`.
- `#renderPipelineComposed()` (`:1038`) statt der einen Zeile:

  ```ts
  if (!this.#outputDirty && this.#passesToCheck) {
    this.#passesToCheck = false;
    if (this.#composedPassesChanged(renderer, stages)) this.#outputDirty = true;
  }
  if (this.#outputDirty) this.#rebuildComposedOutputNode(renderer, stages);
  ```

- `#composedPassesChanged(renderer, stages)`: `true`, wenn `stages.length !== #composedPasses.length`;
  sonst indiziert über die Stages, **ohne** `StageRenderer`-Instanzen (ihr `asPassNode()` baut bei
  jedem Aufruf einen neuen `texture()`-Node über demselben Pass-Target, und sie melden weder Kamera
  noch Szene): `this.#getStagePass(stages[i]!, renderer) !== this.#composedPasses[i]` → `true`.
  Allokationsfrei für `Stage2D` (liefert seinen Node).
- Kommentar/TSDoc `#outputDirty` (`:789-795`): »… or the camera or the scene of a stage changed« →
  »… or a stage handed a new pass node after a change of its camera or scene (see `#composedPassesChanged()`)«.
- `TSDoc` von `add()` (`:1368-1372`): »… listens for `OnStageAfterCameraChanged` and
  `OnStageAfterSceneChanged` and, in the composed mode, rebuilds the output node on the next render
  for a stage that hands a new pass node after either — a `Stage2D` keeps its node, and nothing is
  rebuilt for it —, and for `OnStageDispose` …«.

**IPassProvider.ts** TSDoc ergänzen: »A composing `StageRenderer` asks an eventized provider for its
node again after it announced `OnStageAfterCameraChanged` or `OnStageAfterSceneChanged`, and rebuilds
its output node only for a node that differs from the one it composed.«

**Guide `docs/stages.md`**
- `:593`: »a `Stage2D` gives `pass(scene, camera)`, one node for the life of the stage: a new scene or
  camera goes into that node, and the composition stays;«
- `:596-597`: »after a stage got a new camera or a new scene« → »after a stage of your own handed a new
  node following its `OnStageAfterCameraChanged` or `OnStageAfterSceneChanged`«.
- `:1842-1844` (eigene Stage mit `IPassProvider`): Satz anhängen: »A stage that builds a new node for
  a new scene or camera announces it through `OnStageAfterSceneChanged` or `OnStageAfterCameraChanged`,
  and a composing renderer rebuilds its output node for it; one that writes the new scene or camera
  into the node it has, as `Stage2D` does, costs no rebuild.« Der `ts check`-Block bleibt.

**Tests gegen das alte Verhalten — mitziehen**
- `Stage2D.spec.ts:689-711` (`'builds a new node for a new camera …'`, `'… for a new scene …'`) →
  `'keeps its node for a new camera and renders through that camera'` (gleiches Objekt,
  `node.camera === camera`, `dispose`-Spy nicht gerufen) und dasselbe für die Szene. Neu:
  `'a node handed out before follows a new camera and a new scene without another asPassNode()'`;
  `'a camera that goes away leaves the node with the camera it had, and the next one goes into it'`
  (`projection = undefined` → `node.camera` alt; neue Projektion → `node.camera === stage.camera`).
- `StageRenderer.spec.ts:2548`, `:2564`, `:2577`, `:2614`, `:2629` → je »keeps the output node«:
  `buildOutputNode` einmal gerufen, `pipeline.needsUpdate` bleibt `false`, der komponierte Pass
  trägt die neue Kamera bzw. Szene; die beiden Fälle hinter einem werfenden Listener behalten den
  Throw und zeigen, dass der Node die neue Kamera/Szene trotzdem trägt. Neu: eine eigene eventisierte
  Stage, die nach ihrem `OnStageAfterCameraChanged` einen neuen Node reicht, löst genau einen Rebuild
  mit dem neuen Node aus; ein verschachtelter `StageRenderer` neben einem `Stage2D` mit neuer Kamera
  löst keinen aus. `:1831` (whole-picture) bleibt grün und unverändert.
- Browser `stage-pipeline.test.js:91` und `:122` → `'… keeps the output node and draws through the new
  camera'` bzw. `'… for the new scene'`: `buildCalls` bleibt 1, `lastPasses[0]` ist derselbe Node mit
  `camera === stage.camera` bzw. `scene === stage.scene`; dazu ein Pixel über `rgbAt()`: nach dem
  Zoom (`width: 160`) ist ein Punkt 40 px rechts der Mitte orange, vorher schwarz; nach dem
  Szenenwechsel ist die Mitte `#08f` (`isNearColor`). Neu daneben: `'composed mode: a new projection of
  the same kind builds no node'` — zwei `ParallaxProjection`s A und B, einmal A→B→A gewärmt, dann
  `const counter = await countNodeBuilds(display.renderer)` (`helpers/fixtures.js:258`), auf B
  wechseln, ein Frame, `counter.stop()`, `expect(counter.count).to.equal(0)`. Die Datei rendert unter
  WebGPU und WebGL 2 (nicht in `RENDERER_FREE_FILES`). **Roter Lauf** vor der Änderung: die Vitest-
  und Browser-Erwartungen »ein Build« schlagen fehl.
- CHANGELOG `### Changed`: »`Stage2D#asPassNode()` hands the same node back for the life of the
  stage: a new `scene` or `camera` goes into it as it is assigned, so a node handed out before follows
  it, and a `StageRenderer` that composes the stage keeps its output node — a new camera, a change of
  the projection or a new scene builds neither a pass node nor a shader. A composing `StageRenderer`
  rebuilds its output node after `OnStageAfterCameraChanged` or `OnStageAfterSceneChanged` only for a
  stage that hands a new pass node«.

### 8. Abschluss im Arbeitsbaum

- `pnpm format` nicht über fremde Dateien laufen lassen; `pnpm lint` muss grün sein.
- `pnpm test:allocations` deckt den Frame-Pfad: die Warnprüfung und `#composedPassesChanged()`
  allokieren nichts (indizierte Schleifen, keine Closures).
- `docs/stages.md` und CHANGELOG im selben Commit (Konvention »Guide-Abschnitt im selben Commit«).

- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): pass on a size refused while joining a display, check what a target pool lends and keep the pass node of a Stage2D through a new camera`

  Body (Englisch, ohne Finding-IDs):

  ```
  - a StageRenderer holds the size a host hands in while it subscribes and gives it to resize()
    once it has joined: a stage that refuses it reaches the caller, and a listener of that resize
    finds every subscription booked
  - Stage2D keeps needsUpdate when updateViewRect() or getViewRect() of its projection throws
  - StageRenderTargetPool#acquire() refuses a width, height or sample count that is no whole number
    in range, before it changes anything
  - StageItem is read-only to callers
  - a StageRenderer without a pipeline warns once when it draws a child with a pipeline of its own
    beside other stages into one target
  - Stage2D writes a new camera or scene into the pass node it has, and a composing StageRenderer
    rebuilds its output node only for a stage that hands a new node
  - the props of OnStageAdded and OnStageRemoved are checked with satisfies
  ```

- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · alle sieben Findings unverändert an ihren Fundstellen
    (`Stage2D.ts`, `StageRenderer.ts`, `StageRenderTargetPool.ts`, `IStageRendererHost.ts` seit
    d9b648bf unberührt) · aufgenommen: Re-Entrance im Join (vorbestehend, gleiche Ursache wie BUG-029)
    · »Offene Befunde«: keiner teilt die Ursache, alle bleiben · keine offenen `Folgen:` im Plan ·
    Restplan unverändert
  - 2026-11-01 Zug 1: Implementierer beauftragt (opus, Effort high) · Brief `paket-7.impl-0.brief.txt`, Report nach `paket-7.impl-0.json` im Arbeitsverzeichnis
  - 2026-11-01 Zug 2: Report FERTIG · geändert `StageRenderer.ts`/`.spec.ts`, `Stage2D.ts`/`.spec.ts`, `StageRenderTargetPool.ts`/`.spec.ts`, `IStageRendererHost.ts`, `IPassProvider.ts`, `docs/stages.md`, `CHANGELOG.md`, `stage-pipeline.test.js` · rote Läufe für Schritte 2–7 im Report · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-7.verify.log`)
  - 2026-11-01 Zug 3: Reviewer beauftragt (opus, Effort high) · Diff `paket-7.diff` · Report nach `paket-7.review-0.json`
  - 2026-11-01 Zug 3: Urteil — alle sieben Findings und der Re-Entrance-Punkt behoben (Fundstellen unten); zwei wichtige Befunde (Sammeltext des `parent`-Setters ohne die abgelehnte Größe, `StageRenderer.ts:370`; Rückblick-Nebensatz »where it reached only the console before« in `CHANGELOG.md:61`), drei kleine · `paket-7.review-0.json`
  - 2026-11-01 Zug 4 Runde 1: offen die zwei wichtigen Befunde, dazu die drei kleinen mitgegeben · Resume des Implementierers (Session 378bd498, opus, Effort high) · Brief `paket-7.impl-1.brief.txt`, Report nach `paket-7.impl-1.json`
  - 2026-11-01 Zug 4 Runde 1: zurück FERTIG · geändert `StageRenderer.ts`, `StageRenderer.spec.ts`, `CHANGELOG.md` · Sammeltext nennt die abgelehnte Größe, Rückblick gestrichen, `OnRemoveFromParent` dokumentiert, Vergleichskopie `passes.slice()`, Warn-Spy prüft `not.toHaveBeenCalled()` · Verify `pnpm run ci` exit=0 (`paket-7.verify-1.log`)
  - 2026-11-01 Zug 4 Runde 1: Reviewer gezielt beauftragt (opus, Effort high) · Diff `paket-7.diff-1`, Delta `paket-7.diff-0-to-1.txt` · Report nach `paket-7.review-1.json`
  - 2026-11-01 Zug 4 Runde 1: Urteil — alle fünf offenen Befunde behoben, keine neuen; Findings weiter behoben · `paket-7.review-1.json`
  - 2026-11-01 Zug 5: Commit 88a937ca (Trailer `Remediation-Run: 2026-10-31`), getragen von `paket-7.verify-1.log` (exit=0, jünger als die letzte Änderung) · 1 Runde · Arbeitsbaum sauber

## Urteil des Reviewers (Zug 3 und Runde 1, 2026-11-01)

Erfüllung (Fundstellen im Stand 88a937ca, nach `paket-7.review-0.json`/`-1.json`):

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| BUG-019 | behoben | `Stage2D.ts:327-336` (try/catch schreibt `prevNeedsUpdate` zurück), TSDoc `:82-83`, Spec `Stage2D.spec.ts:301-345` |
| BUG-029 | behoben | `StageRenderer.ts:421-470` (`#addToHost()` hält die Größe, `resize()` nach beiden Abos `:461-467`), TSDoc `parent` `:310-316`, `IStageRendererHost.ts:21-24`, `docs/stages.md:426-428` |
| API-003 | behoben | `StageRenderTargetPool.ts:6-13`, `:78-80` (vor `#disposed`), TSDoc `:69-72` |
| API-004 | behoben | `StageRenderer.ts:76-91` (`readonly`, `StageItemRecord` nicht exportiert), `:229`, `:614`; Migration Guide im CHANGELOG |
| TYPE-004 | behoben | `StageRenderer.ts:1573`, `:1620` |
| DOC-002 | behoben | `StageRenderer.ts:973-1004`, Klassen-TSDoc `:134-136`, `docs/stages.md:691-692`, `:2040-2041` |
| PERF-003 | behoben | `Stage2D.ts:69`, `:237`, `:507`; `StageRenderer.ts:1131-1134`, `:1204-1212`, `#composedPassesChanged()` `:1221-1230`; gegen three 0.187.0 `PassNode.js:855-896` geprüft |
| Dazu: Re-Entrance im Join | behoben | `StageRenderer.ts:352/357` (`OnAddToParent` nur bei `!#disposed && #parent === parent`), Spec-Fälle c und d |

Befunde des ersten Durchgangs, alle in Runde 1 behoben: [wichtig] Sammeltext des `parent`-Setters
ohne die abgelehnte Größe (`StageRenderer.ts:370`) · [wichtig] Rückblick »where it reached only the
console before« in `CHANGELOG.md:61` (stand so im Vorgehen, Schritt 5; die Konvention des Plans geht
vor) · [klein] TSDoc `parent` ohne `OnRemoveFromParent` beim beendeten Join · [klein]
`#composedPasses` teilte das Array mit `buildOutputNode` · [klein] `console.warn`-Spy in Fall a ohne
Erwartung. Zweiter Durchgang: keine Befunde. Offene kleine Befunde: keine.

Nebenbefund (Implementierer, Runde 0): `stage-pipeline.test.js` — Tests ab `:33`, `:65`, `:232`
geben `RenderPipeline`, Stage, Geometrie und Material nicht über `keep()` frei, im Test ab `:189`
Geometrie und Material von `second`; an d9b648bf schon so (`:40`, `:72`, `:205`), also vorbestehend.
Urteil `→ Scope`: die Scope-Regel nimmt jeden Befund; teilt keine Ursache mit diesem Paket (dessen
Tests nutzen `keep()`), deshalb in »Offene Befunde«.

## Abgleich (Zug 0, 2026-11-01)

| Finding | Fundstelle jetzt | Urteil |
| --- | --- | --- |
| BUG-019 | `Stage2D.ts:316` (`needsUpdate = false`), `:318-319` ungeschützt, Rollback nur `:339-345`; Zusage `:380-381` | unverändert |
| BUG-029 | `StageRenderer.ts:398-417` (`#addToHost()`), `:401-403` Listener; `Display.ts:942` `retain`, `:2176` `onResize`; `IStageRendererHost.ts:12-15` | unverändert |
| API-003 | `StageRenderTargetPool.ts:60-100`, keine Zahlenprüfung | unverändert |
| API-004 | `StageRenderer.ts:75-82` (beschreibbar), `:227-229` `stages`, Schreiber nur `:561-563` (im ganzen Repo gesucht) | unverändert |
| TYPE-004 | `StageRenderer.ts:1455`, `:1502` | unverändert |
| DOC-002 | `StageRenderer.ts:906-916` (plain mode, keine Prüfung), `docs/stages.md:676-686` | unverändert |
| PERF-003 | `Stage2D.ts:494-506`, `StageRenderer.ts:1439-1441` (`#outputDirty`), `:1102-1112` | unverändert |

Triage: Die `Folgen:`-Zeilen der erledigten Pakete sind alle verteilt (1 → 14, 4 → 6, 5 → 15), die
übrigen sagen »keine«. Die offenen Einträge in »Offene Befunde« (Lockfile-Advisories,
`DisplayFullscreen`, `Display.spec.ts`, Proposal-Kopf) berühren keine Datei dieses Pakets und teilen
keine Ursache; sie bleiben, wo sie sind.

Restplan: Kein offenes Paket hängt an Paket 7 oder berührt seine Dateien; Paket 10 (Event-Namen in
`events.ts`) zieht die Namen in `StageRenderer.ts`/`Stage2D.ts` danach mit, unabhängig von der
Reihenfolge. Keine Änderung an Reihenfolge oder Schnitt.

## Findings im Volltext

**BUG-019 · low · packages/twopoint5d/src/stage/Stage2D.ts:316** — `needsUpdate` in `Stage2D#updateProjection` erst nach `updateViewRect()` zurücksetzen
`#updateProjection` setzt `needsUpdate = false` (Zeile 316), bevor es `projection.updateViewRect()` und `getViewRect()` aufruft. Der Rollback in Zeile 339–345 stellt das Flag nur wieder her, wenn `createCamera()`/`updateCamera()` werfen. Wirft eine eigene `IProjection` schon in `updateViewRect()` oder `getViewRect()`, kommt der Fehler aus `updateFrame()` heraus, aber das Flag ist weg: das nächste `updateFrame()` versucht das Update nicht mehr. Die TSDoc von `updateFrame()` (Zeile 380–381) verspricht das Gegenteil: »what the projection throws on it comes out of this call, and the flag then stays set«. Die Spec deckt nur den Fall ab, dass die Kamera abgelehnt wird (`Stage2D.spec.ts`: »keeps needsUpdate and the size when the projection refuses the camera«).
Beleg: `this.needsUpdate = false;\n\nthis.projection!.updateViewRect(width, height, pixelRatio);` — der Rollback `this.needsUpdate = prevNeedsUpdate` steht nur im catch um `updateCamera()`/`createCamera()`
Empfehlung: `prevNeedsUpdate` auch dann zurückschreiben, wenn `updateViewRect()`/`getViewRect()` werfen (try um Zeile 318–319), oder das Flag erst nach erfolgreichem `getViewRect()` löschen. Dazu einen Spec-Fall mit einer Projektion, deren `updateViewRect()` wirft.

**BUG-029 · low · packages/twopoint5d/src/stage/StageRenderer.ts:402** — Größenablehnung beim Anhängen an einen laufenden `Display` nicht im eventize-Replay versickern lassen
`Display` hält `OnDisplayResize` per `retain()` fest (`display/Display.ts:933`), und `onResize()` ist ein einfaches `on()`. Hängt sich ein `StageRenderer` an einen Display, der schon eine Größe gemeldet hat, ruft eventize den Listener `this.resize(width, height, pixelRatio)` synchron während `on()` auf. Lehnt dabei eine Stage die Größe ab (eigene Kamera falscher Art, ein werfender `OnStageResize`-Listener), wirft `resize()` — eventize 6 fängt Replay-Fehler aber ab und meldet sie nur per `console.warn` (`docs/retain.md`, »A listener that throws on a replay«). Der Setter `parent` meldet Erfolg. Der Renderer bleibt dabei per Design auf seiner alten Größe (meist 0×0, Zeile 528–534) und bekommt erst mit der nächsten echten Größenänderung des Displays einen neuen Versuch. Im composed mode zeichnet er bis dahin nichts (`#canCompose()`), im whole-picture mode sampelt die Pipeline ein 1×1-Target. Die Host-Doku (`IStageRendererHost.ts:18–20`) sagt »Neither error is swallowed«; das gilt für Host-Fehler, ausgerechnet dieser Pfad ist aber nicht beschrieben.
Beleg: `host.onResize(({width, height, pixelRatio}) => {\n  this.resize(width, height, pixelRatio);\n})` — `onResize = (listener) => on(this, OnDisplayResize, listener)` auf einem retained Event
Empfehlung: In `#addToHost()` die erste Größe nicht dem Replay überlassen: entweder nach dem Abonnieren die Größe des Hosts explizit lesen und `resize()` außerhalb von `on()` aufrufen, damit der Fehler aus `parent =` herauskommt, oder den Replay-Fehler im Listener fangen und nach dem Join über `throwCollected()` weiterreichen. Mindestens den Fall in der TSDoc von `parent` und in `IStageRendererHost` festhalten.

**API-003 · low · packages/twopoint5d/src/stage/StageRenderTargetPool.ts:60** — Größe und Samples in `StageRenderTargetPool#acquire()` prüfen
`acquire(width, height, type, samples)` ist öffentlich, und die TSDoc lädt eigenen Code ausdrücklich ein, vom Pool zu leihen. Werte werden dabei nicht geprüft. `NaN` passt auf kein Target, also wird das älteste freie per `setSize(NaN, …)` verbogen, und alle anderen freien Targets werden freigegeben. Bei `0` oder negativen Werten entsteht ein `RenderTarget`, für das WebGPU keine Textur bauen kann; der Fehler kommt erst beim Zeichnen tief aus three.js. AGENTS.md verlangt für Zahlenprüfungen `assertFinite()`/`assertPositiveFinite()` mit einer Meldung, die den Aufruf nennt. `StageRendererTargets` reicht immer mindestens 1 durch, deshalb betrifft das nur fremde Aufrufer.
Beleg: `acquire(width: number, height: number, type: TextureDataType, samples: number): RenderTarget {\n  if (this.#disposed) { … }\n  const entries = this.#entries;` — keine Prüfung der Zahlen
Empfehlung: Am Anfang von `acquire()` `assertPositiveFinite(width, 'StageRenderTargetPool#acquire()', 'width')` und dasselbe für `height` aufrufen, `samples` als endliche ganze Zahl ≥ 0 prüfen — vor der Suche, damit ein abgelehnter Aufruf keine freien Targets freigibt. Dazu eine Spec.

**API-004 · low · packages/twopoint5d/src/stage/StageRenderer.ts:75** — `StageItem` im öffentlichen Typ von `stages` schreibgeschützt ausgeben
`stages` gibt die lebende Liste als `ReadonlyArray<StageItem>` heraus, die Items selbst sind aber voll beschreibbar (`stage`, `width`, `height`, `pixelRatio`). Die Items sind die Buchführung darüber, welche Größe jede Stage trägt (`resize()` Zeile 483–493, `resizeStage()` Zeile 557–565). Schreibt ein Aufrufer `renderer.stages[0].width = 800`, überspringt der nächste `resize()` diese Stage, obwohl sie die Größe nie bekommen hat. `item.stage = other` tauscht eine Stage aus, ohne dass Abos, `OnStageAdded` oder die Freigabe des Pass-Nodes laufen. Die TSDoc nennt `add()` und `remove()` »the only way in and out«, der Typ setzt das nicht durch.
Beleg: `export interface StageItem {\n  stage: IStage & IRenderable;\n  width: number;\n  height: number;\n  pixelRatio: number;\n}` — `get stages(): ReadonlyArray<StageItem> { return this.#stages; }`
Empfehlung: Öffentlich `Readonly<StageItem>` bzw. ein `readonly`-Interface ausgeben (`stages`, `orderedStages`) und für den geschützten Hook `resizeStage()` und `StageDirector` intern einen beschreibbaren Typ behalten. Laufzeitverhalten ändert sich dadurch nicht, nur der Typ.

**TYPE-004 · low · packages/twopoint5d/src/stage/StageRenderer.ts:1455** — Event-Props in `StageRenderer` mit `satisfies` statt `as` typisieren
`emitStrict(this, OnStageAdded, {stage, renderer: this} as StageAddedProps)` und dasselbe mit `StageRemovedProps` casten ein Objekt, das ohnehin passt (`stage: IStage`, `renderer: StageRenderer`). Das `as` prüft nichts: fügt `events.ts` den Props ein Pflichtfeld hinzu, kompiliert der Aufruf weiter und Listener bekommen `undefined`. `Stage2D.ts:424` macht dasselbe richtig mit `satisfies StageUpdateFrameProps`.
Beleg: `{stage, renderer: this} as StageAddedProps` / `{stage, renderer: this} as StageRemovedProps`
Empfehlung: `as` durch `satisfies` ersetzen, wie in `Stage2D.ts:424`.

**DOC-002 · low · packages/twopoint5d/src/stage/StageRenderer.ts:916** — Kind-Renderer mit Pipeline unter einem schreibenden Parent ohne Komposition melden
Ein verschachtelter `StageRenderer` mit eigener Pipeline (composed oder whole-picture) zeichnet unter einem Parent im plain mode sein Pipeline-Quad direkt in das Target des Parents. Laut eigener Klassen-Doku (Zeile 120–122) deckt das Quad jedes Pixel ohne Blending ab: alles, was frühere Geschwister-Stages in diesem Frame dort gezeichnet haben, ist weg, und durchsichtige Pixel des Kinds werden schwarz statt durchscheinend. `docs/stages.md` (»One writer per canvas«) nennt die Kombination »not supported«. Der Code lässt sie aber wortlos zu: `add()`, `pipeline` und `renderTo()` warnen nicht, und der Fehler sieht aus wie eine verschwundene Ebene. Die Konstellation liegt nahe — Root am Display ohne Pipeline, darin Hintergrund-Stage plus Kind mit Bloom.
Beleg: `for (let i = 0; i < stages.length; i++) this.renderStage(stages[i]!, renderer);` — `renderStage()` ruft `stage.renderTo(renderer)`, ein Kind mit Pipeline endet in `pipeline.render()` auf dem Target des Parents
Empfehlung: Einmalige `console.warn` (Stil wie `StageRenderOrder#warnAboutSharedNames`), wenn ein Renderer im plain mode ohne `outputRenderTarget` ein Kind zeichnet, dessen Modus nicht plain ist und das kein eigenes `outputRenderTarget` hat — mit Verweis auf die beiden stabilen Muster (Pipeline oben, oder keine gemischten Schreiber).

**PERF-003 · low · packages/twopoint5d/src/stage/Stage2D.ts:496** — Kamerawechsel eines `Stage2D` ohne neuen Pass-Node und ohne Shader-Rebuild übernehmen
`asPassNode()` verwirft den Pass-Node samt Render-Target, sobald sich `camera` oder `scene` ändern, und baut einen neuen. Der `StageRenderer` hört auf `OnStageAfterCameraChanged`/`OnStageAfterSceneChanged`, baut die Komposition neu und setzt `pipeline.needsUpdate = true`, also wird der Shader neu gebaut. Jede Zuweisung an `stage.camera`, jeder Projektionswechsel (Ortho ↔ Parallax) und jede neue Szene kostet damit im composed mode einen Shader-Compile und eine Target-Allokation mitten im Frame-Loop, also einen sichtbaren Ruckler. Bei three.js liest `PassNode` `scene` und `camera` als einfache Felder erst in `updateBefore()` (`PassNode.js:833`). Dieselbe Node könnte die neue Kamera daher ohne Graph-Änderung übernehmen.
Beleg: `if (this.#passNode != null && this.#passNodeScene === scene && this.#passNodeCamera === camera) return this.#passNode;\nthis.#disposePassNode();\nthis.#passNode = pass(scene, camera);`
Empfehlung: Bestehenden Pass-Node behalten und `passNode.scene`/`passNode.camera` umschreiben. Die Änderungs-Events setzen dann im Renderer kein `#outputDirty` mehr, solange der Node derselbe bleibt. Vorher im Browser-Test unter WebGPU und WebGL 2 prüfen, dass three.js keinen kamerabezogenen Zustand im Graph cached (Near/Far-Uniforms des Depth-Nodes).
