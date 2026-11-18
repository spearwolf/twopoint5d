# Paket 11b — StageRenderer und Stage2D: Host-Anbindung, Renderpfade und Kamera-Verwaltung in interne Klassen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des Laufs, hier die
Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ARCH-002 (low)
- Ziel: Host-Verdrahtung und die drei Modus-Renderpfade des `StageRenderer` sowie die Kamera- und
  Driver-Verwaltung von `Stage2D` stehen in eigenen internen Klassen, bei unveränderter öffentlicher
  API und unverändertem Verhalten.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - neu, alle unter `packages/twopoint5d/src/stage/`: `StageRendererHostLink.ts`,
    `StageRendererDraw.ts`, `StageRendererWholePicture.ts`, `StageRendererComposition.ts`,
    `Stage2DCamera.ts`
  - geändert: `packages/twopoint5d/src/stage/StageRenderer.ts`, `packages/twopoint5d/src/stage/Stage2D.ts`,
    `packages/twopoint5d/src/stage/StageRenderer.spec.ts` (nur der Kommentar in Zeile 1662),
    `packages/twopoint5d/docs/architecture.md`, `packages/twopoint5d/docs/proposals/stage-transitions.md`
    (§9), `packages/twopoint5d/docs/proposals/camera-rig.md` (Zeilen 440 und 671)
  - ausdrücklich **unverändert**: `StageDirector.ts`, `StageRendererTargets.ts`, `StageRenderOrder.ts`,
    `public-api.ts`, `CHANGELOG.md`, jede andere Spec und jeder Browser-Test
- Vorgehen: Schritte 0–9 unten
- Verify: `pnpm run ci` aus dem Repo-Root; dazu der `.d.ts`-Vergleich aus Schritt 0 und 9
- Commit: `refactor(twopoint5d): hold a stage renderer to its host through an internal StageRendererHostLink, draw its three modes through the internal classes StageRendererDraw, StageRendererWholePicture and StageRendererComposition, and keep the camera of a Stage2D and the driver of its rig in an internal Stage2DCamera`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · ARCH-002 unverändert, Zeilen wie im Hinweis aus Zug 0
    von Paket 11 (beide Dateien zuletzt in ab9147be geändert) · Folge aus Paket 11 (`precompile()`
    pinnt gecachte Shapes nicht mehr synchron) als echte Folge nach Paket 12 · aus »Offene Befunde«
    nichts gleicher Ursache · ein neuer Nebenbefund (fehlendes TSDoc an `Stage2D` und an drei
    Clear-Flags des `StageRenderer`, vorbestehend, info) in »Offene Befunde«
  - 2026-11-18 Zug 1: Schritt 0 vom Runner (`.d.ts`-Baseline in `paket-11b.dts-before/`, alte Quellen als
    `paket-11b.StageRenderer.before.ts`/`paket-11b.Stage2D.before.ts`) · Implementierer beauftragt (opus,
    effort medium, `paket-11b.impl-0.json`)
  - 2026-11-18 Zug 2: Report FERTIG_MIT_VORBEHALT · neu `StageRendererDraw.ts` (245), `StageRendererWholePicture.ts`
    (110), `StageRendererComposition.ts` (195), `StageRendererHostLink.ts` (134), `Stage2DCamera.ts` (227); geändert
    `StageRenderer.ts` 1737 → 1272, `Stage2D.ts` 972 → 800, `StageRenderer.spec.ts` (eine Kommentarzeile),
    `architecture.md`, `stage-transitions.md`, `camera-rig.md` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0
    (`paket-11b.verify.log`) · `Stage2D.d.ts`, `StageDirector.d.ts` byte-gleich; `StageRenderer.d.ts` weicht nur in
    Zeile 2 ab (`import { Color, type Node, … }` → `import type { Color, Node, … }`): Runner nimmt das an — `Color`
    ist im Modul nur noch Typ, Biome `useImportType` verlangt die Typ-Form, kein Export und keine Signatur bewegt
  - 2026-11-18 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-11b.diff` · Urteil: ARCH-002 behoben,
    0 kritisch, 0 wichtig, 2 klein (`paket-11b.review-0.json`)
  - 2026-11-18 Zug 4: keine Runde (nichts offen außer kleinen Befunden)
  - 2026-11-18 Zug 5: committet als 41937df9 (Trailer `Remediation-Run: 2026-11-17`), Verify aus Zug 2 trägt
    (keine Änderung seither)

## Abgleich

**ARCH-002 — unverändert, verschoben.** `StageRenderer.ts` hat 1737 Zeilen (Audit 1674), Klasse
`:154`; Host-Verdrahtung `#parent` `:162`, `#hostSubscriptions` `:169`, `#removeFromParent()`
`:404`, `#unsubscribeFromHost()` `:436`, `#addToHost()` `:452`; die drei Renderpfade von
`renderToCurrentTarget()` `:954` bis `#applyClear()` `:1374`. `Stage2D.ts` hat 972 Zeilen (Audit
949), Klasse `:92` (Audit `:85`), Kamera und Driver `:240–662`. Seit Zug 0 von Paket 11 hat kein
Commit eine der beiden Dateien berührt (`git log -- …` endet bei ab9147be).

## Entscheidungen dieses Pakets

1. **Fünf interne Module, keins in `public-api.ts`.** `public-api.ts` re-exportiert
   `StageRenderer.ts` mit `export *`; jede neue Klasse, jede neue Funktion und jeder neue Typ steht
   deshalb in einer neuen Datei, und `StageRenderer.ts` bekommt **keinen** neuen Export.
   `Stage2D.ts` exportiert weiter nur `Stage2D` und `Stage2DInternals`.
2. **Der plain-Modus steht in `StageRendererDraw`.** Er besteht aus nichts als den Schritten, die
   auch die beiden anderen Modi brauchen (Prüfung auf ein Kind mit eigener Pipeline, Clear, Zeichnen
   der Stages). Eine eigene Klasse für drei Aufrufe wäre Zeremonie; `StageRendererDraw` zeichnet den
   plain-Modus und hält, womit jeder Modus zeichnet. Whole-picture und composed haben eigenen
   Zustand und bekommen je eine Klasse.
3. **Zugriff auf geschützte Hooks und fremde Renderer über eine Brücke.** Die Renderpfade rufen
   geschützte Hooks (`renderStage()`, `shouldRenderPass()`, `renderToCurrentTarget()` eines Kindes)
   und private Teile verschachtelter Renderer (`child.#ensurePassTarget()`,
   `child.#clearsWholeTarget()`, `child.#renderMode()`) und unterscheiden Stages per
   `instanceof StageRenderer`. Ein Modul neben `StageRenderer.ts` kann `StageRenderer` nur als Typ
   importieren, sonst entsteht ein Importkreis (derselbe Grund wie in Paket 6b). Der vorhandene Weg
   ist die Brücke nach dem Muster von `StageRendererInternals`: ein Objekt mit Platzhaltern aus
   `unfilledInternal()`, das `StageRenderer` in seinem `static`-Block füllt. Die neue Brücke heißt
   `StageRendererDrawInternals` und liegt in `StageRendererDraw.ts`; `StageRendererInternals` in
   `StageRendererTargets.ts` bleibt, wie es ist (der Director importiert es).
4. **`#removeFromParent()` bleibt als dünne Hülle im Renderer.** Halter (`#parent`) und
   Host-Abos ziehen in `StageRendererHostLink`; das Ereignis `OnRemoveFromParent` am Renderer und
   `parent.remove(this)` für einen Renderer als Halter bleiben in `StageRenderer`: das Ereignis
   gehört dem Renderer, und die Unterscheidung Renderer/Host braucht `instanceof StageRenderer`
   (Importkreis, siehe 3). Abweichung von der Empfehlung des Audits, die `#removeFromParent` mit
   in die Klasse nennt.
5. **`Stage2D` behält `#updateProjection()` und `#placeWithoutView()`.** Beide rechnen die Sicht aus
   der Projektion und entscheiden, wie die Kamera platziert wird; die Platzierung rollt bei einem
   Fehler Sicht und `needsUpdate` zurück, und dieser `try` umschließt ausschließlich die Platzierung,
   nicht die Ankündigungen danach. Würde die Kamera-Klasse Platzierung und Ankündigung in einem Aufruf
   tun, fiele ein Fehler aus `takeCamera()` in den Rollback; würde sie `placed`/`created` zwischen zwei
   Aufrufen in Feldern halten, wäre ein reentranter Aufruf aus Projektion oder Driver nicht mehr sicher.
   `Stage2DCamera` hält deshalb den Zustand der Kamera, ihre Ankündigungen und den Lebenslauf des
   Drivers; `Stage2D` fragt die Projektion und ruft die Kamera-Klasse. Die Proposals nennen beide
   Methoden in `Stage2D` (`camera-rig.md:534–535`, `:597`) und bleiben dort richtig.
6. **Namen.** Private Member, die umziehen, behalten ihren Namen (der Review liest den Umzug mit
   `git diff --color-moved`). Neue Namen bekommen nur die Einstiege, die aus einem `#`-Member eine
   öffentliche Methode der neuen Klasse werden — sie sind unten je Schritt genannt.
7. **Kein CHANGELOG, kein neuer Spec, kein Regressionstest.** Keine öffentliche Änderung. Beleg für
   unverändertes Verhalten: `StageRenderer.d.ts`, `Stage2D.d.ts` und `StageDirector.d.ts` byte-gleich,
   kein Spec geändert außer einer Kommentarzeile, `pnpm run ci` grün einschließlich der
   Allocation-Specs und der Browser-Tests. Coverage-Schwellen gelten je Modul (`src/stage/**` in
   `packages/twopoint5d/vite.config.ts`), nicht je Datei.

## Stolpersteine — vor dem ersten Edit lesen

1. **Virtuell gegen privat.** Der `StageDirector` überschreibt die Getter `pipeline`,
   `buildOutputNode`, `renderOrder` und `orderedStages`; sein `buildOutputNode`-Getter antwortet
   seine Komposition `#compose`, während das Basisfeld `#buildOutputNode` `undefined` bleibt. Genau
   so, wie es heute steht, muss es bleiben:
   - der **Modus** kommt aus den privaten Feldern: `#renderMode()` → `modeOf(this.#pipeline, this.#buildOutputNode)`;
   - **whole-picture** zeichnet mit `this.#pipeline` (privat) — `renderToCurrentTarget()` reicht es
     als Argument an `StageRendererWholePicture#draw()` durch;
   - **composed** liest die öffentlichen Getter: `owner.pipeline!` für `render()` und
     `owner.buildOutputNode ?? RootRenderPipeline.buildOutputNode` im Rebuild;
   - `#clearsWholeTarget()` liest `this.orderedStages` (virtuell);
   - `applyClear()` liest die Farbe aus dem privaten `#clearColor` (über die Brücke
     `clearColorOf()`), nicht aus dem Getter `clearColor`; `clear`, `clearAlpha`,
     `clearColorBuffer`, `clearDepthBuffer`, `clearStencilBuffer` und `name` sind öffentliche Felder
     und werden über den Besitzer gelesen, wie heute über `this`.
   - `resize()`, `updateFrame()` und `renderTo()` ruft die Host-Verdrahtung auf dem Besitzer auf
     (`this.#owner.resize(…)`): der Director überschreibt `resize()` und `updateFrame()`.
2. **Keine Allokation im Frame.** Die Allocation-Specs `hot-path-allocations.director.spec.ts`,
   `.post-process.spec.ts` und `.camera-rig.spec.ts` decken die Renderpfade und die Platzierung.
   Keine Closure pro Frame, keine neuen Objekte pro Aufruf; Brücke und Host-Objekte entstehen einmal
   (Brücke beim Laden, Host von `Stage2DCamera` je Stage). Und **keine gebrochene Zahl über eine neue
   Aufrufgrenze im Frame** (AGENTS.md, Abschnitt zu den Allocation-Specs: V8 boxt sie an jedem nicht
   inline gesetzten Aufruf): `canCompose()` bekommt den Besitzer und liest `width`/`height` selbst,
   statt sie als Argumente zu nehmen. `acquireInternalTarget(renderer, width, height)` bekommt die
   Maße wie heute — dieselbe eine Aufrufgrenze.
3. **Reihenfolge der Felder.** Private Felder werden in Deklarationsreihenfolge angelegt. In
   `StageRenderer`: `#targets` vor `#draw`, `#draw` vor `#wholePicture` und `#composition` (deren
   Initialisierer `this.#draw` und `this.#targets` lesen). Die Closure in `#order` (`:271`) liest
   `#composition` und `#draw` erst beim Aufruf — das ist nach dem Konstruktor. In `Stage2D` rufen die
   Closures des Hosts von `Stage2DCamera` `#passNode`, `#postProcessRun` und `#updateProjection` erst
   beim Aufruf; aufgerufen wird nichts davon, bevor der Konstruktorrumpf (`this.projection = …`)
   läuft.
4. **Reihenfolge der Schritte bleibt Schritt für Schritt.** Jeder umgezogene Rumpf behält die
   Reihenfolge seiner Anweisungen, seine `try`/`catch`/`finally`-Grenzen und jede Fehlermeldung
   wortgleich, das Subjekt eingeschlossen (`StageRenderer#…`, `Stage2D#…`,
   `Stage2DInternals.attachDriver(): …`, `StageRenderer#renderTo() cannot compose the stage …`).
   Kommentare ziehen mit dem Code um. Ein Kommentar, der einen umgezogenen Member beim alten Namen
   nennt (`#renderPipelineComposed()`, `#composedPassesChanged()`, `#wireInternalOutputNode()`,
   `#addToHost()`, `#updateCamera` …), nennt danach den Namen, unter dem er jetzt steht.
5. **Typen aus `StageRenderer.ts` nur als Typ.** Die neuen Module importieren `StageRenderer`,
   `StageItem`, `StageRendererParentType`, `StageRendererBuildOutputNode` mit `import type`, `Stage2D`
   ebenso. `StageRendererMode` (heute nicht exportiert in `StageRenderer.ts:58`) zieht nach
   `StageRendererDraw.ts` und wird dort exportiert — in `StageRenderer.ts` exportiert, stünde er in
   der öffentlichen API.

## Vorgehen

### Schritt 0 — Vorher-Stand der Typen festhalten

Vor dem ersten Edit, aus dem Repo-Root:

```bash
pnpm build:twopoint5d
mkdir -p /tmp/claude-1000/-home-spw-spaceland-twopoint5d/25b68af0-a25d-4ede-b583-3d06a691b428/scratchpad/paket-11b.dts-before
cp packages/twopoint5d/dist/lib/stage/StageRenderer.d.ts packages/twopoint5d/dist/lib/stage/Stage2D.d.ts packages/twopoint5d/dist/lib/stage/StageDirector.d.ts /tmp/claude-1000/-home-spw-spaceland-twopoint5d/25b68af0-a25d-4ede-b583-3d06a691b428/scratchpad/paket-11b.dts-before/
```

### Schritt 1 — neu `src/stage/StageRendererDraw.ts`

Kopfkommentar im Stil von `StageRendererTargets.ts`/`DirectorMasks.ts`: was die Klasse hält (der
plain-Modus; die Clears, die lineare Ausgabe in ein Ziel, das eine Pipeline abtastet, das Zeichnen
der Stages und die Warnung vor einer Stage mit eigener Pipeline neben anderen — womit jeder Modus
zeichnet), dass das Modul nicht in `public-api.ts` steht und nur `StageRenderer.ts` und die beiden
Modus-Klassen es erreichen.

a. **Aus `StageRenderer.ts` hierher, unverändert im Rumpf:** `TRANSPARENT_BLACK` (`:43–44`, nicht
   exportiert), `hasAsPassNode` (`:46`, jetzt `export`), `isStage2DWithPostProcess` (`:52–54`, nicht
   exportiert), `type StageRendererMode` (`:58`, jetzt `export`), `NO_PASS_NODE` (`:60–61`, jetzt
   `export`), `modeOf()` (`:63–70`, jetzt `export`), je mit ihrem Kommentar.

b. **Brücke** — `@internal`, TSDoc wie bei `StageRendererInternals` (»The functions through which
   the draw classes of the stage module reach the protected hooks of a `StageRenderer` and the
   private parts of the renderers it draws; they are not part of the public API. `StageRenderer`
   fills them in when its class is defined.«), je Member eine TSDoc-Zeile:

   ```ts
   export const StageRendererDrawInternals: {
     renderStage(owner: StageRenderer, stageItem: StageItem, renderer: WebGPURenderer): void;
     shouldRenderPass(owner: StageRenderer, child: StageRenderer): boolean;
     renderToCurrentTarget(child: StageRenderer, renderer: WebGPURenderer): void;
     isStageRenderer(stage: unknown): stage is StageRenderer;
     renderModeOf(renderer: StageRenderer): StageRendererMode;
     clearsWholeTarget(renderer: StageRenderer): boolean;
     passTargetOf(child: StageRenderer, renderer: WebGPURenderer): RenderTarget;
     clearColorOf(owner: StageRenderer): Color | null;
   } = {
     renderStage: unfilledInternal('StageRendererDrawInternals.renderStage()'),
     // … je Member derselbe Name im Platzhalter
   };
   ```

c. **Klasse `StageRendererDraw`** (`@internal`), `constructor(owner: StageRenderer)` mit
   `readonly #owner`. Felder hierher, mit ihren Kommentaren: `#oldClearColor` (`:254`),
   `#warnedAboutPipelineChild` (`:1034`), `#pipelineChildCheckDue` (`:1036–1039`),
   `#callerToneMapping` und `#callerOutputColorSpace` (`:1086–1087`). Methoden:
   - `drawPlain(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void` ← Rumpf von
     `#renderStagesInline()` (`:1021–1032`); der Block der Prüfung wird
     `this.checkPipelineChildren(stages, true)`, sein Kommentar »a child with a pipeline, or a stage
     with a post-process, alone is the one writer …« bleibt an dieser Aufrufstelle; `this.clear` →
     `this.#owner.clear`.
   - `pipelineChildrenChanged(): void` — setzt `#pipelineChildCheckDue = true`.
   - `checkPipelineChildren(stages: ReadonlyArray<StageItem>, nestedRenderers: boolean): void` — der
     Block, der heute zweimal steht (`:1025–1029` und `:1131–1135`): `if (this.#pipelineChildCheckDue
     && !this.#warnedAboutPipelineChild) { this.#pipelineChildCheckDue = false; if (stages.length > 1)
     this.#warnAboutPipelineChild(stages, nestedRenderers); }` samt Kommentar »cleared before the
     check: …«.
   - `#warnAboutPipelineChild()` (`:1041–1073`), privat; `child instanceof StageRenderer` →
     `StageRendererDrawInternals.isStageRenderer(child)`, `child.#renderMode()` →
     `StageRendererDrawInternals.renderModeOf(child)`, `this.name` → `this.#owner.name`.
   - `drawStages()` (`:1075–1084`), öffentlich; `this.renderStage(stages[i]!, renderer)` →
     `StageRendererDrawInternals.renderStage(this.#owner, stages[i]!, renderer)`.
   - `beginLinearOutput()` und `endLinearOutput()` (`:1089–1114`), öffentlich, unverändert.
   - `clearBeforePipeline()` (`:1221–1237`), öffentlich; `this.clear…` → `this.#owner.clear…`,
     `this.#applyClear(renderer)` → `this.applyClear(renderer)`.
   - `clearToTransparentBlack()` (`:1324–1335`), öffentlich, unverändert.
   - `applyClear()` (`:1374–1390`), öffentlich; die Farbe einmal am Anfang lesen:
     `const clearColor = StageRendererDrawInternals.clearColorOf(this.#owner);` und statt
     `this.#clearColor` verwenden; `this.clearAlpha`, `this.clearColorBuffer`, `this.clearDepthBuffer`,
     `this.clearStencilBuffer` → `this.#owner.…`.

### Schritt 2 — neu `src/stage/StageRendererWholePicture.ts`

Kopfkommentar: der whole-picture-Modus — eine Pipeline ohne `buildOutputNode`, die keine
`RootRenderPipeline` ist —: die Stages in das interne Ziel aus `StageRendererTargets`, die Pipeline
tastet es als `texture()` ab; nicht in `public-api.ts`, nur `StageRenderer.ts` erreicht es.

Klasse `StageRendererWholePicture` (`@internal`),
`constructor(owner: StageRenderer, draw: StageRendererDraw, targets: StageRendererTargets)` mit
`readonly #owner`, `#draw`, `#targets`. Felder hierher: `#internalOutputNode` und
`#internalOutputTexture` (`:893–895`). Methoden:

- `draw(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>, pipeline: RenderPipeline): void`
  ← `#renderPipelineSimple()` (`:1116–1146`) samt TSDoc; die Zeile `const pipeline = this.#pipeline!;`
  entfällt (Parameter); der Prüfblock wird `this.#draw.checkPipelineChildren(stages, false)`, der
  Kommentar »the stages share the internal target: …« bleibt davor; `this.width`/`this.height` →
  `this.#owner.width`/`.height`; `this.#clearBeforePipeline(renderer)` →
  `this.#draw.clearBeforePipeline(renderer)`.
- `#drawIntoInternalTarget()` (`:1148–1163`), `#wireInternalOutputNode()` (`:1165–1179`),
  `#clearForInternalRT()` (`:1181–1191`), privat; Ersetzungen: `this.#beginLinearOutput`/`#endLinearOutput`/
  `#drawStages`/`#applyClear`/`#clearToTransparentBlack` → `this.#draw.…`;
  `this.#clearsWholeTarget()` → `StageRendererDrawInternals.clearsWholeTarget(this.#owner)`;
  `this.clear` → `this.#owner.clear`.
- `forgetOutputNode(): void` — `this.#internalOutputNode = undefined` (der zweite Teil von
  `invalidateOutputNode()`, `:916`).
- `dispose(): void` — `#internalOutputNode` und `#internalOutputTexture` auf `undefined` (`:1461–1462`).

### Schritt 3 — neu `src/stage/StageRendererComposition.ts`

Kopfkommentar: der composed-Modus — eine Pipeline mit `buildOutputNode` oder eine
`RootRenderPipeline` —: verschachtelte Renderer in ihre Pass-Ziele, dann der Output-Node aus dem
Pass-Node jeder Stage; nicht in `public-api.ts`, nur `StageRenderer.ts` erreicht es.

a. `isStage2DWithoutCamera` (`:48–50`) hierher, nicht exportiert.
b. `export function canCompose(owner: StageRenderer, stages: ReadonlyArray<StageItem>): boolean` ←
   `#canCompose()` (`:990–1005`) samt Kommentar; `this.width`/`this.height` → `owner.width`/`owner.height`
   (gelesen in der Funktion, siehe Stolperstein 2); der Satz »#renderPipelineComposed() then draws the
   own clear alone« nennt `StageRendererComposition#draw()`.
c. Klasse `StageRendererComposition` (`@internal`),
   `constructor(owner: StageRenderer, draw: StageRendererDraw)`. Felder hierher, mit TSDoc:
   `#outputDirty` (`:896–902`), `#passesToCheck` (`:904–908`), `#composedPasses` (`:910–911`).
   Methoden:
   - `draw(renderer: WebGPURenderer, stages: ReadonlyArray<StageItem>): void` ←
     `#renderPipelineComposed()` (`:1193–1219`) samt TSDoc; `this.#canCompose(stages)` →
     `canCompose(this.#owner, stages)`; `this.clear` → `this.#owner.clear`; `this.#applyClear` und
     `this.#clearBeforePipeline` → `this.#draw.…`; `this.pipeline!.render()` →
     `this.#owner.pipeline!.render()`.
   - `markOutputDirty(): void` — `#outputDirty = true`.
   - `checkPasses(): void` — `#passesToCheck = true`.
   - `forgetPasses(): void` — `#composedPasses = []`.
   - privat, mit TSDoc: `#prerenderNestedRenderers()` (`:1239–1254`): `stage instanceof StageRenderer
     && this.shouldRenderPass(stage)` → `StageRendererDrawInternals.isStageRenderer(stage) &&
     StageRendererDrawInternals.shouldRenderPass(this.#owner, stage)`; linear output über `this.#draw`.
     `#prerenderChild()` (`:1256–1272`): `child.#ensurePassTarget(renderer)` →
     `StageRendererDrawInternals.passTargetOf(child, renderer)`, `child.#clearsWholeTarget()` →
     `StageRendererDrawInternals.clearsWholeTarget(child)`, `this.#clearToTransparentBlack` →
     `this.#draw.clearToTransparentBlack`, `child.renderToCurrentTarget(renderer)` →
     `StageRendererDrawInternals.renderToCurrentTarget(child, renderer)`.
     `#rebuildComposedOutputNode()` (`:1274–1295`): `this.buildOutputNode` → `this.#owner.buildOutputNode`,
     `this.pipeline!` → `this.#owner.pipeline!`. `#composedPassesChanged()` (`:1297–1312`):
     `item.stage instanceof StageRenderer` → `StageRendererDrawInternals.isStageRenderer(item.stage)`.
     `#getStagePass()` (`:1337–1345`) unverändert, mit `hasAsPassNode`/`NO_PASS_NODE` aus
     `StageRendererDraw.ts`.

### Schritt 4 — neu `src/stage/StageRendererHostLink.ts`

Kopfkommentar: der Halter eines `StageRenderer` — ein Host, dessen Frame und Resize er abonniert,
oder ein Eltern-Renderer, der ihn treibt — und die Abos am Host samt der Größe, die ein Host beim
Abonnieren hereingibt; die Ereignisse des Wechsels (`OnRemoveFromParent`, `OnAddToParent`) sendet der
Renderer selbst; nicht in `public-api.ts`, nur `StageRenderer.ts` erreicht es.

Klasse `StageRendererHostLink` (`@internal`), `constructor(owner: StageRenderer)` mit `readonly #owner`.
Felder: `#holder?: StageRendererParentType` (heute `StageRenderer#parent`, `:162`) und
`#hostSubscriptions` (`:164–169` samt Kommentar; der Satz über `#addToHost()`/`#removeFromParent()`
nennt die neuen Orte). Methoden:

- `get holder(): StageRendererParentType | undefined`.
- `joinHost(host: IStageRendererHost, errors: unknown[]): boolean` — bildet die heutige Folge im
  Setter `parent` (`:382–396`) nach: `this.#holder = host; if (this.#addToHost(host, errors)) return
  true; this.#holder = undefined; return false;` Der Kommentar »a host that refused a subscription
  does not hold this renderer« zieht an die letzte Zeile.
- `joinRenderer(parent: StageRenderer): void` — `this.#holder = parent` (heute
  `child.#parent = this` in `add()`, `:1667`); TSDoc: ein Eltern-Renderer treibt sein Kind aus dem
  eigenen Frame, abonniert wird nichts.
- `leave(errors: unknown[]): StageRendererParentType | undefined` — die erste Hälfte von
  `#removeFromParent()` (`:405–415`): Halter lesen, `if (holder == null) return undefined;`, Halter
  auf `undefined`, `this.#unsubscribeFromHost(errors)`, Halter zurückgeben. Die beiden Kommentare
  (»cleared before the event goes out …«, »the host lets go before anyone hears of the move …«)
  ziehen mit.
- privat `#unsubscribeFromHost()` (`:434–446`) und `#addToHost()` (`:448–499`), Rumpf wortgleich;
  `this.resize(…)`, `this.updateFrame(…)`, `this.renderTo(…)` → `this.#owner.…`.

### Schritt 5 — `StageRenderer.ts` umbauen

a. **Felder.** Entfernen: `#parent`, `#hostSubscriptions`, `#oldClearColor`, `#internalOutputNode`,
   `#internalOutputTexture`, `#outputDirty`, `#passesToCheck`, `#composedPasses`,
   `#warnedAboutPipelineChild`, `#pipelineChildCheckDue`, `#callerToneMapping`,
   `#callerOutputColorSpace`. Neu: `readonly #hostLink = new StageRendererHostLink(this);` an der
   Stelle von `#parent` (`:162`), und direkt nach `#targets` (`:886`):
   `readonly #draw = new StageRendererDraw(this);`,
   `readonly #wholePicture = new StageRendererWholePicture(this, this.#draw, this.#targets);`,
   `readonly #composition = new StageRendererComposition(this, this.#draw);` — je mit einer Zeile
   TSDoc.
b. **Ersetzungen:**
   - `#order` (`:271–274`) und Setter `renderOrder` (`:288–289`): `this.#outputDirty = true;
     this.#pipelineChildCheckDue = true;` → `this.#composition.markOutputDirty();
     this.#draw.pipelineChildrenChanged();`
   - Getter `parent`: `return this.#hostLink.holder;`
   - Setter `parent`: `this.#parent === parent` → `this.#hostLink.holder === parent`; der Block
     `:381–397` wird `if (!this.#disposed && this.#hostLink.holder === undefined && parent) { if
     (this.#hostLink.joinHost(parent, errors)) { if (!this.#disposed && this.#hostLink.holder ===
     parent) { … emitStrict(this, OnAddToParent) … } } }` — der `else`-Zweig entfällt, er steht in
     `joinHost()`. Die Kommentare im Block bleiben.
   - `#removeFromParent()` (`:404–432`): `const parent = this.#hostLink.leave(errors); if (parent ==
     null) return;`, danach das Ereignis und `parent.remove(this)` unverändert. Der Satz über die
     Rekursion zwischen beiden Hälften bleibt hier.
   - `#unsubscribeFromHost()` und `#addToHost()` entfallen.
   - `#modeInputChanged()` (`:852–862`): `this.#outputDirty = true` → `this.#composition.markOutputDirty()`,
     `this.#pipelineChildCheckDue = true` → `this.#draw.pipelineChildrenChanged()`.
   - `#pipelineChildChanged()` (`:865–868`): `const parent = this.#hostLink.holder; if (parent
     instanceof StageRenderer) parent.#draw.pipelineChildrenChanged();`
   - `static`-Block (`:888–892`): `StageRendererInternals.setPassTargetScale` bleibt; dazu die acht
     Member von `StageRendererDrawInternals`: `renderStage: (owner, stageItem, renderer) =>
     owner.renderStage(stageItem, renderer)`, `shouldRenderPass: (owner, child) =>
     owner.shouldRenderPass(child)`, `renderToCurrentTarget: (child, renderer) =>
     child.renderToCurrentTarget(renderer)`, `isStageRenderer: (stage): stage is StageRenderer =>
     stage instanceof StageRenderer`, `renderModeOf: (renderer) => renderer.#renderMode()`,
     `clearsWholeTarget: (renderer) => renderer.#clearsWholeTarget()`, `passTargetOf: (child,
     renderer) => child.#ensurePassTarget(renderer)`, `clearColorOf: (owner) => owner.#clearColor`.
   - `invalidateOutputNode()` (`:914–917`): `this.#composition.markOutputDirty();
     this.#wholePicture.forgetOutputNode();`
   - `renderToCurrentTarget()` (`:958–968`): `'composed'` → `this.#composition.draw(renderer,
     stages)`, `'whole-picture'` → `this.#wholePicture.draw(renderer, stages, this.#pipeline!)`,
     `'plain'` → `this.#draw.drawPlain(renderer, stages)`.
   - `#clearsWholeTarget()` bleibt hier (`:1012–1019`); `this.#canCompose(this.orderedStages)` →
     `canCompose(this, this.orderedStages)`; der TSDoc-Satz über die Rückkehr vor dem Clear bleibt.
   - `dispose()` (`:1461–1464`): `this.#wholePicture.dispose();` und `this.#composition.forgetPasses();`
     an die Stelle der vier Zuweisungen, der Kommentar »the pass nodes belong to the stages …« vor
     `forgetPasses()`. Reihenfolge zu `this.#targets.dispose()` davor und `#removeFromParent()`
     danach bleibt.
   - `add()`: Zyklusprüfung (`:1600`) `holder = holder.#parent` → `holder = holder.#hostLink.holder`;
     `child.#parent !== undefined` (`:1631`) → `child.#hostLink.holder !== undefined`; `:1640–1641`
     → `this.#composition.markOutputDirty(); this.#draw.pipelineChildrenChanged();`; im Listener
     `:1652–1654` → `this.#composition.checkPasses(); this.#draw.pipelineChildrenChanged();` (die
     Kommentare bleiben); `child.#parent = this` (`:1667`) → `child.#hostLink.joinRenderer(this)`.
   - `remove()` (`:1714–1715`): wie in `add()`.
c. **Entfallen** (umgezogen in Schritt 1–3): `#canCompose`, `#renderStagesInline`,
   `#warnAboutPipelineChild`, `#drawStages`, `#beginLinearOutput`, `#endLinearOutput`,
   `#renderPipelineSimple`, `#drawIntoInternalTarget`, `#wireInternalOutputNode`, `#clearForInternalRT`,
   `#renderPipelineComposed`, `#clearBeforePipeline`, `#prerenderNestedRenderers`, `#prerenderChild`,
   `#rebuildComposedOutputNode`, `#composedPassesChanged`, `#clearToTransparentBlack`,
   `#getStagePass`, `#applyClear`, sowie die modulweiten Helfer aus Schritt 1a und 3a.
d. **Bleiben:** alle öffentlichen und geschützten Member mit unveränderter Signatur und TSDoc,
   `#renderMode()`, `#refuseStageWithoutPassNode()`, `#modeInputChanged()`, `#pipelineChildChanged()`,
   `#releasePassMemoryOf()`, `#ensurePassTarget()`, `#clearsWholeTarget()`, `disposedError()`,
   `ADD_THREW`, `StageItem`, `StageItemRecord`.
e. **Importe:** aus `StageRendererDraw.js` `hasAsPassNode`, `modeOf`, `NO_PASS_NODE`,
   `StageRendererDraw`, `StageRendererDrawInternals`, `type StageRendererMode`; aus
   `StageRendererComposition.js` `canCompose`, `StageRendererComposition`; `StageRendererWholePicture`;
   `StageRendererHostLink`. Was danach unbenutzt ist, fällt weg (Biome und `tsc` sagen es).

### Schritt 6 — neu `src/stage/Stage2DCamera.ts`, `Stage2D.ts` umbauen

a. **Neues Modul.** Kopfkommentar: die Kamera eines `Stage2D` — mit welcher die Stage zeichnet (die
   eines Drivers, eine an `stage.camera` zugewiesene, die ihrer Projektion), die Ankündigung jedes
   Wechsels und jeder Platzierung, das Anhängen und Lösen eines Drivers —; die Stage behält
   Projektion, Container, Sicht und Pass-Node und rechnet die Platzierung aus der Projektion;
   nicht in `public-api.ts`, nur `Stage2D.ts` erreicht es.

   ```ts
   /** What a {@link Stage2DCamera} reaches of its stage beyond the public members. @internal */
   export interface Stage2DCameraHost {
     /** Hands `camera` to the pass node of the stage and to the run of its post-process, where either exists. */
     takeCamera(camera: Camera): void;
     /** Computes view and camera anew for the container of the last `resize()`; what the projection throws comes out, what a listener or the driver throws goes into `errors`. */
     updateProjection(errors: unknown[]): void;
   }
   ```

   Klasse `Stage2DCamera` (`@internal`), `constructor(stage: Stage2D, host: Stage2DCameraHost)` mit
   `readonly #stage`, `#host`. Felder hierher, Namen und Kommentare unverändert:
   `#cameraFromProjection`, `#cameraUserOverride` (`:240–241`), `#driver`, `#driverCamera`
   (`:243–246`), `#cameraPlacedProps` (`:595`). Methoden:
   - `get current(): Camera | undefined` ← Rumpf des Getters `camera` (`:284`).
   - `get driver(): StageCameraDriver | undefined`.
   - `assign(camera: Camera | undefined, errors: unknown[]): void` →
     `this.#updateCamera(() => void (this.#cameraUserOverride = camera), errors)` (heute `:291`).
   - `setProjectionCamera(camera: Camera | undefined, errors: unknown[]): void` →
     `this.#updateCamera(() => { this.#cameraFromProjection = camera; }, errors)` (heute `:221–223`
     mit `undefined`, `:574–576` mit `created`).
   - `outgrown(projection: IProjection, camera: Camera): boolean` ← `#outgrown()` (`:419–424`) samt
     Kommentar.
   - `announcePlacement(camera, projection, driver, errors): unknown[] | undefined` ←
     `#announcePlacement()` (`:597–631`) samt Kommentar; `{stage: this, …}` →
     `{stage: this.#stage, …}`, `emitStrict(this, …)` → `emitStrict(this.#stage, …)`.
   - `attachDriver(driver: StageCameraDriver): void` ← `#attachDriver()` (`:330–352`),
     `detachDriver(): void` ← `#detachDriver()` (`:354–391`), `announceDriverCamera(): void` ←
     `#announceDriverCamera()` (`:393–401`); darin `this.#disposed` → `this.#stage.isDisposed`,
     `this.projection`/`this.#projection` → `this.#stage.projection`, `this.name` →
     `this.#stage.name`, `Stage2D.#buildsKindOf(…)` → `Stage2DCamera.#buildsKindOf(…)`,
     `this.#updateProjection(this.#containerWidth, this.#containerHeight, this.#containerPixelRatio,
     errors)` → `this.#host.updateProjection(errors)` (das umschließende `try`/`catch` bleibt).
   - privat `#updateCamera(updateCallback: () => void, errors: unknown[]): void` ← das Arrow-Feld
     `#updateCamera` (`:306–328`) als Methode samt Kommentaren; die zwei Schreibzugriffe auf
     `#passNode` und `#postProcessRun` → `this.#host.takeCamera(camera)`, innerhalb des bestehenden
     `if (camera != null)` und vor dem Ereignis wie heute; die Args
     `[this, prevCamera]` → `[this.#stage, prevCamera]`, `emitStrict(this, …)` →
     `emitStrict(this.#stage, …)`.
   - privat `static #buildsKindOf()` (`:403–417`) samt Kommentar.

b. **`Stage2D.ts`.** An der Stelle von `#cameraFromProjection` (`:240`):

   ```ts
   readonly #camera = new Stage2DCamera(this, {
     takeCamera: (camera) => {
       if (this.#passNode != null) this.#passNode.camera = camera;
       this.#postProcessRun?.setCamera(camera);
     },
     updateProjection: (errors) => {
       this.#updateProjection(this.#containerWidth, this.#containerHeight, this.#containerPixelRatio, errors);
     },
   });
   ```

   mit dem Kommentar aus `#updateCamera` (`:312–315`, »a PassNode reads its camera as a plain field
   …«) über `takeCamera`. Ersetzungen:
   - `static`-Block (`:97–100`): `stage.#attachDriver(driver)` → `stage.#camera.attachDriver(driver)`,
     `stage.#detachDriver()` → `stage.#camera.detachDriver()`, `stage.#announceDriverCamera()` →
     `stage.#camera.announceDriverCamera()`, `stage.#driver` → `stage.#camera.driver`;
     `scenePassesOf` bleibt.
   - Setter `projection` (`:221–223`) → `this.#camera.setProjectionCamera(undefined, errors);`
   - Getter `camera` → `return this.#camera.current;` (TSDoc bleibt); Setter `camera` (`:291`) →
     `this.#camera.assign(camera, errors);`
   - `#updateProjection` (`:546`) `const driver = this.#driver;` → `const driver = this.#camera.driver;`;
     `:555` `this.#outgrown(…)` → `this.#camera.outgrown(…)`; `:573–577` → `if (created != null)
     this.#camera.setProjectionCamera(created, errors);`; `:579` →
     `this.#camera.announcePlacement(placed, projection, driver, errors);` — der `try`/`catch` um die
     Platzierung (`:550–568`) bleibt genau so in `Stage2D`.
   - `#placeWithoutView` (`:637–662`): `this.#driver` → `this.#camera.driver`, `this.#outgrown` →
     `this.#camera.outgrown`, `this.#announcePlacement` → `this.#camera.announcePlacement`.
   - `updateFrame()` (`:719`): `this.#driver?.write();` → `this.#camera.driver?.write();`
   - Entfallen: die vier Kamera-Felder, `#updateCamera`, `#attachDriver`, `#detachDriver`,
     `#announceDriverCamera`, `#buildsKindOf`, `#outgrown`, `#cameraPlacedProps`, `#announcePlacement`.
   - Bleiben in `Stage2D.ts`: `Stage2DInternals` samt TSDoc (`camera-rig.md:493` und
     `architecture.md:211` nennen es dort), `#updateProjection`, `#placeWithoutView`, alle
     öffentlichen Member mit TSDoc.
   - Importe: was danach unbenutzt ist (`CameraProjection`, `OrthographicProjection`,
     `ParallaxProjection`, `describeThreeValue`, `type OrthographicCamera`, `type PerspectiveCamera`,
     `OnStageAfterCameraChanged`, `OnStageCameraPlaced`, `type StageAfterCameraChangedArgs`,
     `type StageCameraPlacedProps`, soweit nicht mehr gebraucht), fällt weg; neu `Stage2DCamera`.

### Schritt 7 — Kommentar in `StageRenderer.spec.ts:1662`

»The props carry the fields #addToHost() reads« → »The props carry the fields
StageRendererHostLink#joinHost() reads«. Sonst nichts an Specs.

### Schritt 8 — Doku

a. `packages/twopoint5d/docs/architecture.md`, Abschnitt `### stage/`: nach dem Absatz, der mit
   »… `Canvas2DStage` shows a 2D canvas on a sprite through a `StageRenderer` of its own.« endet
   (`:234`), ein neuer Absatz, auf 100 Zeichen umbrochen wie die Datei:

   > A `StageRenderer` draws through internal classes beside it. `StageRendererHostLink` holds it to
   > its holder — a host whose frame and resize it subscribes to, or a parent `StageRenderer` that
   > drives it. `StageRendererDraw` draws the plain mode and holds what every mode draws with: the
   > clears, the linear output into a target a pipeline samples, the draw of the stages and the
   > warning about a stage that runs a pipeline of its own beside others. `StageRendererWholePicture`
   > draws the whole-picture mode through the internal target of `StageRendererTargets`, and
   > `StageRendererComposition` the composed mode: the nested renderers into their pass targets, then
   > the output node built from the pass node of every stage. The camera of a `Stage2D` — the one it
   > draws with, every announcement of a change or a placement of it, and the driver of a
   > `CameraRig` that takes it over — is the internal class `Stage2DCamera`, while the stage keeps
   > its projection, its view and its pass node.

b. `packages/twopoint5d/docs/proposals/stage-transitions.md` §9 (`:549–567`):
   - Einleitung (`:551–552`): »The director is a subclass and needs four seams in `StageRenderer` and
     in the internal classes it draws through (`src/stage/StageRendererComposition.ts`,
     `src/stage/StageRendererWholePicture.ts`), none of which a user of `StageRenderer` sees:«
   - Punkt 2: `#prerenderNestedRenderers()` asks a protected `shouldRenderPass(child)` →
     `` `StageRendererComposition#prerenderNestedRenderers()` asks the protected `shouldRenderPass(child)` of its renderer ``.
   - Punkt 3: `#rebuildComposedOutputNode()` → `StageRendererComposition#rebuildComposedOutputNode()`;
     »as `#wireInternalOutputNode()` already does for the whole-picture mode« → »as
     `StageRendererWholePicture#wireInternalOutputNode()` does for the whole-picture mode«.
   - Punkte 1 und 4 bleiben. Absätze neu umbrechen, Zeilen ≤ 100 Zeichen.

c. `packages/twopoint5d/docs/proposals/camera-rig.md`: `:440` `` (`#outgrown()`) `` →
   `` (`Stage2DCamera#outgrown()`) ``; `:671` `` (`#buildsKindOf()`, `` →
   `` (`Stage2DCamera.#buildsKindOf()`, ``; die betroffenen Absätze neu umbrechen. `:534–535` und
   `:597` (`#placeWithoutView()`, `#updateProjection()`) bleiben — beide stehen weiter in `Stage2D`.

### Schritt 9 — Prüfen

1. `pnpm run ci` aus dem Repo-Root, grün.
2. Typen unverändert — nach dem Gate (es baut `dist/` neu):
   ```bash
   for f in StageRenderer Stage2D StageDirector; do cmp packages/twopoint5d/dist/lib/stage/$f.d.ts /tmp/claude-1000/-home-spw-spaceland-twopoint5d/25b68af0-a25d-4ede-b583-3d06a691b428/scratchpad/paket-11b.dts-before/$f.d.ts && echo "$f.d.ts identisch"; done
   ```
   Alle drei identisch. Weicht eine ab, ist die öffentliche Oberfläche bewegt worden — zurückbauen,
   nicht dokumentieren.
3. `git diff --stat` nennt außer den Dateien oben nichts; `git diff packages/twopoint5d/src/stage/StageRenderer.spec.ts`
   zeigt genau eine geänderte Kommentarzeile.
4. Keine verwaiste Erwähnung: `grep -n "#addToHost\|#unsubscribeFromHost\|#renderStagesInline\|#renderPipelineSimple\|#renderPipelineComposed\|#canCompose\|#getStagePass\|#outputDirty\|#passesToCheck\|#composedPasses\|#internalOutputNode\|#pipelineChildCheckDue\|#hostSubscriptions" packages/twopoint5d/src/stage/StageRenderer.ts`
   findet nichts; dasselbe in `Stage2D.ts` für `#updateCamera\|#attachDriver\|#detachDriver\|#announceDriverCamera\|#buildsKindOf\|#outgrown\|#announcePlacement\|#cameraUserOverride\|#cameraFromProjection\|#driverCamera\|#cameraPlacedProps`.
5. Zeilenzahl zur Einordnung in den Report: `wc -l` von `StageRenderer.ts` und `Stage2D.ts` vorher
   (1737, 972) und nachher.

## Urteil des Reviewers (Zug 3)

- **ARCH-002 — behoben.** Host-Verdrahtung in `src/stage/StageRendererHostLink.ts:21–133`, `#removeFromParent()`
  als dünne Hülle `StageRenderer.ts:366` (Entscheidung 4); plain `StageRendererDraw.ts:99`, whole-picture
  `StageRendererWholePicture.ts:39`, composed `StageRendererComposition.ts:184`, Dispatch `StageRenderer.ts:840–851`;
  Kamera und Driver in `Stage2DCamera.ts`, `#updateProjection`/`#placeWithoutView` bleiben in `Stage2D`
  (Entscheidung 5). Umgezogene Methoden Zeile für Zeile gegen die Originale verglichen: Reihenfolge,
  `try`/`catch`/`finally` und Meldungen wortgleich; Stolpersteine eingehalten.

Kleine Befunde (lösen keine Runde aus):

1. `Stage2DCamera.ts:153` (dazu `:119`, `:129`, `:145`, `:168`, `:183`, `:194`): drei Lesewege weichen ab — `detachDriver()`
   liest den überschreibbaren Getter `stage.projection` statt `#projection`, die Dispose-Prüfung `isDisposed`
   statt `#disposed`, `#updateCamera()` vergleicht über das private `current` statt den Getter `camera`. Wirkt nur
   bei einer Unterklasse von `Stage2D`, die einen dieser Getter überschreibt (`Stage2D.spec.ts:43` tut es für
   `projection`); die ersten beiden schreibt der Detailplan so vor; keine Spec deckt den Fall.
2. `Stage2DCamera.ts:29`: TSDoc-Zeile an `Stage2DCameraHost.updateProjection` 175 Zeichen lang, über Biomes
   `lineWidth` 130 (Biome umbricht Kommentare nicht und meldet nichts).

Abweichungen des Implementierers (Report `paket-11b.impl-0.json`), vom Runner angenommen: `.d.ts`-Importzeile
(siehe Zug 2); Platzhalter von `isStageRenderer` als Type Predicate um `unfilledInternal()` gewickelt (TS2322);
Rekursions-Kommentar zwischen `StageRendererHostLink#leave()` und `StageRenderer#removeFromParent()` geteilt;
Kommentar am `if (camera != null)` in `Stage2DCamera#updateCamera()` verweist auf `takeCamera()`; `applyClear()`
liest die Clear-Farbe vor `getClearAlpha()`.

## Triage in Zug 0

- **Folge aus Paket 11** (`StageDirector.ts:1113–1123` mit `DirectorShapeCache.ts:384`):
  bestätigt. Vor Paket 11 pinnte `precompile()` eine gecachte Shape ohne laufendes Compile per
  `continue` ohne `await` (`git show 8d624eec:packages/twopoint5d/src/stage/StageDirector.ts`,
  `:1418–1434`); heute steht vor jeder Shape `await this.#shapeCache.precompile(…)`, auch im
  synchronen Fall, und jede gecachte Shape nach der ersten wird erst einen Microtask später gepinnt.
  Einordnung: **echte Folge** — eine eigene Ursache, die der Umbau neu geöffnet hat (eine
  `async`-Grenze), nicht dieselbe Ursache wie ARCH-001 an anderer Stelle. Ausgang: neues Paket 12 mit
  `Folge von: Paket 11`, nicht in 11b (andere Dateien, andere Ursache), einsortiert direkt nach 11b.
- **»Offene Befunde«:** kein Eintrag hat die Ursache von ARCH-002; keiner nennt `StageRenderer.ts`
  oder `Stage2D.ts`. Nichts übernommen.
- **Neuer Nebenbefund** (beim Lesen beider Dateien, vorbestehend laut `git show 2e3f585b:…`): an
  `Stage2D` tragen die öffentlichen Member `projection` (`:205`), `name` (`:152`),
  `containerWidth`/`containerHeight` (`:164`, `:168`) und `isFirstFrame` (`:664`) kein TSDoc, am
  `StageRenderer` die Felder `clearColorBuffer`, `clearDepthBuffer`, `clearStencilBuffer` (`:236–238`).
  API-001 nannte diese Stellen nicht. Andere Ursache als ARCH-002 (Doku, nicht Zuschnitt) → in
  »Offene Befunde«, Urteil `→ Scope` (info). Nicht in diesem Paket.
- **Restplan:** Paket 12 neu direkt nach 11b (Begründung im Plan). 11c bleibt, wie es ist:
  `Stage2DCamera.#buildsKindOf()` prüft per `instanceof` auf `OrthographicProjection` und
  `ParallaxProjection`, und 11c behält beide als Klassen (Hilfsmodul, keine Basisklasse); kein
  »Hängt ab von« ändert sich.

## Findings im Volltext

**ARCH-002 · low · packages/twopoint5d/src/stage/StageRenderer.ts:154** (weitere Fundstelle
`packages/twopoint5d/src/stage/Stage2D.ts:85`) — Zuständigkeiten in StageRenderer und Stage2D weiter
aufteilen

StageRenderer hat 1674 Zeilen und vereint Host-Verdrahtung (parent, Subscriptions), Stage-Liste,
drei Render-Modi, Clear-Logik, Pipeline-Output-Node-Rebuild und Dispose-Fehlersammlung. Stage2D (949
Zeilen) vereint Projektion, Kamera-Override, Driver-Anbindung, Post-Process und Pass-Node. Targets
und Render-Order sind schon ausgelagert (StageRendererTargets, StageRenderOrder,
StagePostProcessRun); Host-Anbindung und Modus-Rendering sind es noch nicht. Das macht Änderungen am
Verhalten bei Fehlern (Collected Errors in jedem Setter) schwer lesbar.

Empfehlung: Host-Wiring (`#addToHost`, `#removeFromParent`, `#hostSubscriptions`) und die drei
Modus-Renderpfade in eigene interne Klassen nach dem Muster von StageRendererTargets ziehen; bei
Stage2D die Kamera-/Driver-Verwaltung herauslösen.

Effort laut Audit: L · Komponente: stage · Paket: `@spearwolf/twopoint5d`
