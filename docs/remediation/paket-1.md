# Paket 1 — Modus C und verschachtelte Kinder: Clears, Output-Transform und interne RenderTargets

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-114 (medium), BUG-129 (low), BUG-130 (low), BUG-013 (low), PERF-019 (low), MEM-002 (low), MEM-016 (low), PERF-035 (info, Optimierungspotenzial), IMPL-008 (low), PERF-024 (info, aus Paket 2 übernommen)
- Nebenbefund im Paket: ein Modus-C-Renderer mit einem verschachtelten Kind, das eine eigene Pipeline hat, trägt den Output-Transform ebenfalls doppelt auf (dieselbe Ursache wie BUG-114, siehe unten)
- Ziel: Das interne RenderTarget von Modus C und die Vorab-Renderings verschachtelter Kinder werden korrekt geleert, in HalfFloat mit den Samples des Renderers angelegt, nur bei Bedarf neu gebaut und beim Verlassen ihres Modus freigegeben; eine Kind-Pipeline trägt im komponierten Modus keinen Output-Transform doppelt auf.
- Modell: stärkste Stufe (`opus`)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  - `packages/twopoint5d/CHANGELOG.md` (Abschnitt `[Unreleased]`)
- Verify: `pnpm run ci`
  (während der Arbeit schneller: `pnpm nx test twopoint5d -- src/stage/StageRenderer.spec.ts`; die Browser-Tests laufen nur über `pnpm test:browser` gegen die gebaute Library, also vorher `pnpm build:twopoint5d`)
- Commit: `fix: let a StageRenderer draw into the targets its own pipeline samples without tone mapping or output encoding, clear the internal target of the pipeline-only mode in full to transparent black before its own clear, build its internal render targets with the output buffer type and the sample count of the renderer and release them when their mode ends, keep the output node of the pipeline-only mode until the pipeline or the target changes, leave out the transparent black clear of a nested renderer whose own clear covers color and depth, and let the stage docs say that clear is the only clear`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · BUG-114 unverändert (Vorab-Rendern
    `StageRenderer.ts:592-609`, README Mode E `:319-347`) · BUG-129 unverändert
    (`:570-575`) · BUG-130 unverändert (`:568-569`) · BUG-013 unverändert, nach
    `:692` verschoben · PERF-019 unverändert (`:556-560`) · MEM-002/MEM-016
    unverändert (Setter `:406-413`, `:443-448`; `remove()` `:919-935`;
    `dispose()` `:762-765`) · PERF-035 unverändert (`:599-603`) · IMPL-008
    unverändert (README `:192`, `:514-516`) · PERF-024 aus Paket 2 übernommen
    (`:898-905`, `:556-560`) · Nebenbefund Modus-C-Parent mit Kind-Pipeline
    (`:548`) ins Paket genommen · Folgen: keine (erstes Paket) · Queue »Offene
    Befunde« leer
  - 2026-09-29 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-1.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG_MIT_VORBEHALT (Browser-Test Tönung unter WebGL2 nicht rot zu sehen, Vitest-Test rot) · geändert: `StageRenderer.ts`, `StageRenderer.spec.ts`, `stage/README.md`, `stage-pipeline.test.js`, `CHANGELOG.md` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 → `paket-1.verify.log`
  - 2026-09-29 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-1.diff`, Report nach `paket-1.review-0.json`
  - 2026-09-29 Zug 3 Urteil: alle 10 Findings und der Nebenbefund behoben · 1 wichtig (README `:492` und TSDoc `dispose()` verschweigen die Freigabe der Pass-Targets der Kinder) · 2 klein (Linear-Umschaltung gilt unter Modus C auch für ein Kind mit eigenem `outputRenderTarget`, undokumentiert; Klassen-TSDoc `:79` nennt den schwarzen Clear von Modus C nicht)
  - 2026-09-29 Zug 4 Runde 1: offen 1 wichtig + 2 klein (mitgegeben, nur Doku) → Resume des Implementierers (opus, medium), Report nach `paket-1.impl-1.json`
  - 2026-09-29 Zug 4 Runde 1 zurück: FERTIG, nur TSDoc/README (`StageRenderer.ts`, `stage/README.md`) · Verify `pnpm run ci` exit=0 → `paket-1.verify-1.log` · Diff `paket-1.r1.diff` · Nachreview per Resume des Reviewers → `paket-1.review-1.json`
  - 2026-09-29 Zug 4 Runde 1 Urteil: 1 wichtig + 2 klein behoben · neu 1 klein (Kurzform der Modus-C-Definition) → keine weitere Runde
  - 2026-09-29 Zug 5: Commit 676eefa7 (5 Dateien), Verify `paket-1.verify-1.log` exit=0, Runden 1

## Reviewer-Urteil

Aus `paket-1.review-0.json`, Zeilen im Stand von Runde 0; Runde 1 (`paket-1.review-1.json`) hat die offenen Befunde bestätigt behoben.

- BUG-114 — behoben: `StageRenderer.ts:678-706` (lineare Umschaltung um das Vorab-Rendern der Kinder, Wiederherstellung im `finally` vor Ausgabeknoten und `pipeline.render()`), README Mode E, TSDoc `outputRenderTarget`; Vitest und Browser-Test Mode E (≈128)
- Nebenbefund Kind mit Pipeline unter Modus C — behoben: `StageRenderer.ts:621-638`; Vitest und Browser-Test
- BUG-129 — behoben: `StageRenderer.ts:664`, `#clearToTransparentBlack` `:726-732`
- BUG-130 — behoben: `StageRenderer.ts:664-665`, README `:204-209`, Browser-Test mit zwei Frames
- BUG-013 — behoben: `StageRenderer.ts:795` (Typ und Samples vom Renderer), `:797` (Samples nachgeführt)
- PERF-019 — behoben: `StageRenderer.ts:644-651`, `invalidateOutputNode()` `:510`; alter Test ersetzt
- PERF-024 — behoben: `StageRenderer.ts:1008-1014`, Kamera-Abo setzt nur `#outputDirty`
- MEM-002 — behoben: Setter `:435`, `:482`; `remove()` `:1042` (erreicht auch `detach()`)
- MEM-016 — behoben: dieselben Stellen
- PERF-035 — behoben: `#clearsWholeTarget` `:584-586`, Vorab-Rendern `:697`; Kind ohne Kamera getestet
- IMPL-008 — behoben (dokumentiert): README `:192`, `:548-552`; TSDoc `:79-87`, `:113-116`; Vitest

Qualität: Runde 0 ein `wichtig` (README »Resource lifecycle« und `dispose()`-TSDoc verschwiegen die Freigabe der Pass-Targets der Kinder), zwei `klein` (Linear-Umschaltung für ein Kind mit eigenem `outputRenderTarget` undokumentiert; Klassen-TSDoc nannte den schwarzen Clear von Modus C nicht) — alle in Runde 1 behoben.

Kleine Befunde, offen:
- Modus C wird verkürzt als »`pipeline` ohne `buildOutputNode`« umschrieben, obwohl eine `RootRenderPipeline` ohne `buildOutputNode` komponiert: `StageRenderer.ts:89`, `:459`, `:497`, `README.md:204`, `:247`, `CHANGELOG.md:291` (als Folge im Plan)

Nebenbefunde (Urteil → Scope, weil unter `src/stage/**`; beide an der Basis `5ff01ea2` nachgesehen, vorbestehend):
- `buildOutputNode`-Setter ohne Disposed-Guard (Basis `:443`, jetzt `:488`)
- Test `'invalidateOutputNode() forces a rebuild on next render'` im falschen `describe` (Basis `:1107`, jetzt `:1398`)

Abweichung des Implementierers, vom Reviewer mitgetragen: das Kamera-Abo in `add()` setzt direkt `#outputDirty = true` statt `invalidateOutputNode()` aufzurufen, weil diese nun auch den Modus-C-Knoten verwirft und ein Kamerawechsel Modus C sonst neu bauen ließe.

## Begriffe

Im Code und in der README heißen die Modi so; der Plan benutzt dieselben Namen.

- **Plain**: kein `pipeline` — `#renderStagesInline()`.
- **Modus C** (pipeline-only): `pipeline` gesetzt, kein `buildOutputNode`, und
  `pipeline` ist keine `RootRenderPipeline` — `#renderPipelineSimple()`. Die
  Stages zeichnen in `#internalRT`, die Pipeline sampelt es über `texture()`.
- **Komponiert** (Modus D/E): `pipeline` gesetzt und `buildOutputNode` gesetzt
  oder `pipeline instanceof RootRenderPipeline` — `#renderPipelineComposed()`.
  Verschachtelte `StageRenderer`-Kinder werden vorab in ihr `#asPassNodeRT`
  gerendert.

## Befunde gegen den three.js-Quelltext (three 0.185.1)

Diese Stellen tragen die Abweichungen von den Audit-Empfehlungen; sie gehören
in die Begründungskommentare im Code.

- `RenderPipeline#_update()` (`three/src/renderers/common/RenderPipeline.js`)
  liest `outputColorTransform`, `renderer.toneMapping` und
  `renderer.outputColorSpace` nur, wenn es den Quad-Material neu baut. Neu
  gebaut wird bei `needsUpdate === true` oder wenn `renderer.toneMapping` bzw.
  `renderer.outputColorSpace` von den zwischengespeicherten Werten
  (`_toneMapping`, `_outputColorSpace`) abweichen. Der Transform
  (`renderOutput(outputNode, toneMapping, outputColorSpace)`) wird in den
  Material eingebacken, unabhängig davon, in welches Target die Pipeline
  zeichnet.
- `renderOutput` mit `NoToneMapping` und `ColorManagement.workingColorSpace`
  ist bis auf das Alpha-Clamping die Identität
  (`three/src/nodes/display/RenderOutputNode.js`).
- `Renderer#isOutputTarget` / `currentToneMapping` / `currentColorSpace`:
  ein gewöhnliches `renderer.render()` in ein RenderTarget schreibt immer
  linear im Working Color Space, ohne Tone Mapping. Nur `RenderPipeline`
  kodiert auch in ein RenderTarget.
- `PassNode#setup()` gibt den Pass-Targets des komponierten Modus
  `samples = renderer.samples` und `texture.type = renderer.getOutputBufferType()`
  (Default `HalfFloatType`, fest pro Renderer ab dem Konstruktor).
- `Textures#updateRenderTarget()` vergleicht die Sample-Zahl eines Targets bei
  jeder Benutzung und baut die GPU-Texturen bei einer Änderung neu — ein
  `rt.samples = n` auf einem bestehenden Target wirkt beim nächsten Zeichnen,
  Target- und Texture-Objekt bleiben dieselben.
- `RenderTarget#setSize()` ruft bei geänderter Größe selbst `this.dispose()`
  auf, und das Backend legt die GPU-Ressourcen beim nächsten Zeichnen neu an
  (`Textures#updateRenderTarget()`, `initialized !== true`). Ein
  RenderTarget-Objekt nach `dispose()` weiterzubenutzen ist also three.js'
  eigenes Muster: `dispose()` gibt den GPU-Speicher frei, das Objekt und seine
  `texture` bleiben gültig.
- `unpremultiplyAlpha` liefert für `alpha == 0` `vec4(0)`: mit dem
  Default-Output-Transform verschwindet die RGB-Tönung aus BUG-129 im Bild. Sie
  wird sichtbar, sobald `pipeline.outputColorTransform = false` ist — so misst
  der Browser-Test sie.

## Abweichungen von den Audit-Empfehlungen (entschieden in Zug 0)

- **BUG-114 — nicht `outputColorTransform` umschalten, sondern Tone Mapping und
  Output Color Space des Renderers für die Dauer der Zwischen-Draws auf linear
  stellen.** Die Empfehlung (»`pipeline.outputColorTransform = false` setzen und
  danach zurücksetzen«) geht an three vorbei: ohne `needsUpdate` bleibt das
  Umschalten wirkungslos, mit `needsUpdate` baut die Kind-Pipeline ihren Quad
  zweimal pro Frame neu. Außerdem gehört das Feld der Pipeline des Aufrufers.
  Stattdessen setzt ein `StageRenderer`, während er Stages oder Kinder in ein
  Target zeichnet, das seine eigene Pipeline anschließend sampelt,
  `renderer.toneMapping = NoToneMapping` und `renderer.outputColorSpace =
  ColorManagement.workingColorSpace` und stellt beides danach wieder her. Eine
  verschachtelte Pipeline sieht dann linear, baut sich genau einmal darauf um
  und bleibt stabil; der äußerste Output-Transform wirkt einmal, am Ende. Das
  ist dasselbe Modell, das three für jedes RenderTarget anwendet
  (`currentToneMapping`), und dasselbe Umschalten, das `RenderPipeline#render()`
  selbst für seinen Quad macht.
- **Nebenbefund mit derselben Ursache aufgenommen:** Ein Modus-C-Renderer, der
  ein verschachteltes `StageRenderer`-Kind mit eigener Pipeline hält
  (`StageRenderer.ts:548` → `renderStage()` → `child.renderTo()` → dessen
  `pipeline.render()` in `#internalRT`), kodiert doppelt wie Mode E. Der Fix
  oben deckt beide Stellen ab; getrennt behoben bliebe die Ursache halb.
  Vorbestehend: der Lauf hat noch keinen Commit, Basis `5ff01ea2`.
- **MEM-002 / MEM-016 — freigeben heißt `rt.dispose()`, das Objekt bleibt.**
  Die Empfehlung lässt die Targets beim nächsten Bedarf neu bauen. Ein neues
  Objekt hätte eine neue `texture`; jeder `texture()`-Knoten, den ein Parent aus
  `asPassNode()` komponiert hat, sampelte danach eine tote Textur — etwa wenn
  dasselbe Kind per `add()` in zwei komponierenden Parents steckt und einer es
  entfernt. Mit `dispose()` am bestehenden Objekt ist der GPU-Speicher frei
  (die 130 MB aus MEM-002), und three legt ihn beim nächsten Zeichnen wieder
  an, genau wie nach `setSize()`. `resize()` darf ein freigegebenes Target
  weiter per `setSize()` nachführen: das ändert nur Zahlen, GPU-Speicher
  entsteht erst beim Zeichnen.
- **MEM-002 — `#asPassNodeRT` wird in `remove()` freigegeben, nicht in
  `#removeFromParent()`.** Ein Kind, das per `parent.add(child)` hinzukam,
  kennt seinen Parent nicht (`StageRenderer.ts:669-671`), und
  `#removeFromParent()` läuft für es nie. `remove()` erreicht beide Wege: auch
  `#removeFromParent()` ruft für einen `StageRenderer`-Parent `parent.remove(this)`.
- **BUG-013 — Typ aus `renderer.getOutputBufferType()` statt fest
  `HalfFloatType`.** Das ist `HalfFloatType` per Default und genau das, was
  `PassNode` den Pass-Targets des komponierten Modus gibt; ein Renderer mit
  anderem `outputBufferType` bekommt überall denselben Typ.
- **PERF-019 — `invalidateOutputNode()` behält seinen Vertrag in Modus C.** Die
  TSDoc verspricht »the next render rebuilds it« ohne Einschränkung; der
  bestehende Test dafür läuft in Modus C. Modus C hört nicht mehr auf
  `#outputDirty`, `invalidateOutputNode()` verwirft aber zusätzlich den
  zwischengespeicherten Knoten von Modus C.
- **PERF-024 aus Paket 2 übernommen.** Es beschreibt dieselbe Ursache wie
  PERF-019 (Modus C baut bei jedem `#outputDirty`, auch nach einem
  Kamerawechsel, neu) und ist mit Schritt 5 erledigt: das Kamera-Abo bleibt für
  den komponierten Modus, und Modus C liest das Flag nicht mehr. Im Plain-Modus
  war es schon folgenlos. Die Empfehlung (»nur invalidieren, wenn der Renderer
  komponiert«) wird damit überflüssig und nicht umgesetzt: ein Moduswechsel
  läuft ohnehin über den `pipeline`- oder `buildOutputNode`-Setter, die
  `#outputDirty` setzen.
- **IMPL-008** folgt der Entscheidung vom 2026-09-29 im Plan: dokumentieren,
  nicht umbauen.
- **BUG-129 / BUG-130** folgen der Entscheidung vom 2026-09-29: das interne
  Target immer vollständig zu (0, 0, 0, 0) leeren, danach den eigenen Clear.

## Vorgehen

Alle Namen sind verbindlich, sofern nicht »frei« dabeisteht. Code, Kommentare
und Doku auf Englisch. Im Frame-Pfad entsteht pro Frame kein neues Objekt:
keine Closures, keine Options-Objekte, keine Tupel außer den schon vorhandenen
aus `#renderTargetSize()` (deren Abbau gehört zu PERF-017 in Paket 2 und bleibt
hier liegen).

### 1. Modus-Prädikate (Grundlage für 2, 5, 6)

In `StageRenderer.ts` vier private Methoden:

- `#isComposing(): boolean` — `this.#pipeline != null && (this.#buildOutputNode != null || this.#pipeline instanceof RootRenderPipeline)`.
- `#isPipelineOnly(): boolean` — `this.#pipeline != null && !this.#isComposing()` (Modus C).
- `#canCompose(): boolean` — die beiden Early-Return-Bedingungen, die heute oben
  in `#renderPipelineComposed()` stehen (`StageRenderer.ts:589-590`): positive
  endliche `width` und `height`, und keine `Stage2D` ohne Kamera in
  `orderedStages`. Der erklärende Kommentar (`:584-588`) zieht mit.
  `#renderPipelineComposed()` beginnt danach mit `if (!this.#canCompose()) return;`.
- `#clearsWholeTarget(): boolean` — `this.clear && this.clearColorBuffer && this.clearDepthBuffer && (!this.#isComposing() || this.#canCompose())`.
  Kommentar: der eigene Clear dieses Renderers überschreibt Farbe und Depth
  des Targets vollständig, und er erreicht ihn in diesem Frame — ein
  komponierender Renderer ohne Fläche oder ohne Kamera kehrt vor seinem Clear
  zurück.

`#renderToCurrentTarget()` entscheidet mit `#isComposing()` statt der
Inline-Bedingung (`:507-515`); das Verhalten bleibt gleich.

### 2. Clears von Modus C und von verschachtelten Kindern (BUG-129, BUG-130, PERF-035)

- `#clearForInternalRT()` (`:567-576`) wird zu:
  1. `if (!this.#clearsWholeTarget()) this.#clearToTransparentBlack(renderer);`
  2. `if (this.clear) this.#applyClear(renderer);`

  Der Kommentar sagt: das interne Target gehört niemandem sonst, der es leert;
  es wird jeden Frame vollständig zu transparentem Schwarz geleert, Farbe und
  Depth, damit weder die Clear-Farbe des Renderers noch ein Rest des Vorframes
  darin steht; der eigene `clear` wirkt danach wie beim verschachtelten Kind,
  und ein eigener Clear, der Farbe und Depth ganz abdeckt, ersetzt den
  schwarzen.
- Im Vorab-Rendern der Kinder in `#renderPipelineComposed()` (`:599-603`):
  `if (!stage.#clearsWholeTarget()) this.#clearToTransparentBlack(renderer);`
  statt des bedingungslosen Aufrufs. Kommentar anpassen: ein Kind, dessen
  eigener Clear Farbe und Depth ganz abdeckt und in diesem Frame erreicht wird,
  überschreibt das Target selbst; jedes andere bekommt vorher transparentes
  Schwarz (die Begründung aus dem heutigen Kommentar bleibt stehen).
- Stencil: der schwarze Clear leert wie heute nur Farbe und Depth
  (`renderer.clear(true, true, false)`); daran ändert sich nichts.

### 3. Output-Transform verschachtelter Pipelines (BUG-114 + Nebenbefund)

- Import von `ColorManagement` und `NoToneMapping` aus `'three/webgpu'`.
- In `#renderPipelineSimple()`: bevor die Stages in `#internalRT` zeichnen,
  `renderer.toneMapping` und `renderer.outputColorSpace` in lokale Variablen
  sichern, dann `renderer.toneMapping = NoToneMapping` und
  `renderer.outputColorSpace = ColorManagement.workingColorSpace`; im
  `finally`, das heute das RenderTarget zurücksetzt (`:552-554`), beides
  wiederherstellen. Die Wiederherstellung liegt vor `pipeline.render()` der
  eigenen Pipeline, die ihren Transform also mit den Werten des Aufrufers baut.
- In `#renderPipelineComposed()`: dasselbe einmal um die ganze Schleife, die
  die `StageRenderer`-Kinder vorab rendert (`:592-609`), mit Wiederherstellung
  im `finally` nach der Schleife — vor dem Neubau des Ausgabeknotens und vor
  `pipeline.render()`.
- Der Kommentar an einer der beiden Stellen (die andere verweist darauf)
  erklärt: three's `RenderPipeline` backt Tone Mapping und die Kodierung nach
  `renderer.outputColorSpace` in seinen Quad, egal in welches Target er
  zeichnet, und baut neu, wenn sich die beiden Werte ändern; solange sie linear
  lauten, schreibt eine verschachtelte Pipeline lineare Werte in das Target,
  das diese Pipeline sampelt, und der Transform wirkt einmal, in der äußersten
  Pipeline. Warum nicht `outputColorTransform`: gelesen nur beim Neubau, und
  das Feld gehört dem Aufrufer. Ein gewöhnlicher `renderer.render()` in ein
  RenderTarget ist davon nicht betroffen — three schreibt dort ohnehin linear.
- Plain-Modus bekommt kein Umschalten: dort zeichnet ein Kind mit Pipeline auf
  das Ziel des Aufrufers, und sein Transform ist der letzte.

### 4. Typ und Samples der internen Targets (BUG-013)

- `#ensureRT()` (`:688-696`) baut ein neues Target als
  `new RenderTarget(w, h, {type: renderer.getOutputBufferType(), samples: renderer.samples})`.
- Für ein bestehendes Target zusätzlich zum Resize:
  `if (rt.samples !== renderer.samples) rt.samples = renderer.samples;`.
- Kommentar: dieselben Werte, die three's `PassNode` den Pass-Targets des
  komponierten Modus gibt; eine geänderte Sample-Zahl übernimmt three beim
  nächsten Zeichnen in das Target, das Target und seine Textur bleiben dieselben
  Objekte — jeder `texture()`-Knoten darauf bleibt gültig. Der Typ steht pro
  Renderer ab dessen Konstruktor fest.

### 5. Ausgabeknoten von Modus C (PERF-019, PERF-024)

- Zwei neue Felder: `#internalOutputNode?: Node` und
  `#internalOutputTexture?: Texture` (`type Texture` aus `'three/webgpu'`).
- In `#renderPipelineSimple()` ersetzt dieser Block den `#outputDirty`-Block (`:556-560`):
  ```ts
  if (this.#internalOutputNode == null || this.#internalOutputTexture !== rt.texture) {
    this.#internalOutputNode = texture(rt.texture);
    this.#internalOutputTexture = rt.texture;
  }
  if (pipeline.outputNode !== this.#internalOutputNode) {
    pipeline.outputNode = this.#internalOutputNode;
    pipeline.needsUpdate = true;
  }
  ```
  (`pipeline` = `this.pipeline!`, als lokale Konstante oder wie die
  Umgebung es liest.) Modus C liest und setzt `#outputDirty` nicht mehr. Der
  Vergleich mit `pipeline.outputNode` fängt eine neue Pipeline, die Rückkehr
  aus dem komponierten Modus und einen Knoten, den jemand von außen
  hineingeschrieben hat.
- `invalidateOutputNode()` setzt zusätzlich `this.#internalOutputNode = undefined`.
  TSDoc: »the next render rebuilds it, in either pipeline mode«.
- Die TSDoc von `#outputDirty` (`:454-457`) sagt, dass nur der komponierte
  Modus es liest.
- Das Kamera-Abo in `add()` (`:898-905`) bleibt; sein Kommentar nennt, dass es
  nur den komponierten Modus betrifft.
- `dispose()` setzt `#internalOutputNode` und `#internalOutputTexture` auf
  `undefined`, neben `#internalRT`.

### 6. Freigabe der internen Targets (MEM-002, MEM-016)

- `pipeline`-Setter: vor der Zuweisung `const wasPipelineOnly = this.#isPipelineOnly();`,
  nach der Zuweisung `if (wasPipelineOnly && !this.#isPipelineOnly()) this.#internalRT?.dispose();`.
  Der Disposed-Guard am Anfang bleibt.
- `buildOutputNode`-Setter: dasselbe Muster.
- Ein Wechsel zwischen zwei Pipelines, die beide Modus C ergeben, gibt nichts frei.
- `#internalRT` bleibt gesetzt (siehe »Abweichungen«); der nächste Modus-C-Frame
  zeichnet in dasselbe Objekt, und `#internalOutputNode` bleibt gültig.
- `remove(stage)`: für `stage instanceof StageRenderer` — unabhängig davon, ob
  `stage.parent === this` — `stage.#asPassNodeRT?.dispose()`. Kommentar: das
  Target gehört dem Kind; der Parent, der es losgelassen hat, sampelt es nicht
  mehr; das Objekt bleibt, damit jeder `texture()`-Knoten, den ein anderer
  Parent daraus gebaut hat, gültig bleibt, und three legt den Speicher beim
  nächsten Zeichnen wieder an.
- `dispose()` bleibt, wie es ist (es gibt beide Targets frei und setzt sie auf
  `undefined`); da es jede Stage über `remove()` abgibt, gibt ein disposter
  Parent auch die Pass-Targets seiner verschachtelten Kinder frei.
- `resize()` bleibt unverändert.

### 7. TSDoc und README (IMPL-008 und die Doku zu 2–6)

TSDoc in `StageRenderer.ts`:

- Klassen-Doku, Abschnitt »Clearing« (`:68-82`): `clear` ist das einzige Clear.
  Während die Stages zeichnen, ist `renderer.autoClear` `false`, was immer der
  Aufrufer gesetzt hat, und wird danach wiederhergestellt; mit `clear = false`
  löscht nichts das Target, Frames sammeln sich an, sofern nicht etwas anderes
  löscht. Der Absatz zum verschachtelten Kind nennt die Ausnahme aus Schritt 2.
- Feld `clear` (`:97-102`): derselbe Satz in Kurzform.
- `pipeline`- und `buildOutputNode`-TSDoc: wer Modus C verlässt, gibt den
  GPU-Speicher des internen Targets frei; die Rückkehr legt ihn beim nächsten
  Frame wieder an. In Modus C baut der Renderer den Ausgabeknoten nur für eine
  neue Pipeline oder nach `invalidateOutputNode()` neu; Stages, Reihenfolge,
  Namen und Kameras lassen ihn stehen.
- `outputRenderTarget` (`:415-421`): ohne Pipeline zeichnen die Stages linear
  im Working Color Space ohne Tone Mapping hinein, wie three in jedes
  RenderTarget; mit Pipeline wirkt deren Output-Transform (Tone Mapping und
  Kodierung nach `renderer.outputColorSpace`, solange
  `pipeline.outputColorTransform` `true` ist), wie auf dem Canvas. Ein
  Renderer, den ein Parent in ein Target von dessen eigener Pipeline zeichnet,
  schreibt in beiden Fällen linear; den Transform trägt die äußerste Pipeline.
- `asPassNode()` (`:646-657`): der Parent leert das Target vorher zu
  transparentem Schwarz, außer der eigene Clear des Kindes deckt Farbe und
  Depth ab; er rendert das Kind mit linearem Output.
- `remove()` (`:912-918`): ein entfernter `StageRenderer` gibt den
  GPU-Speicher seines Pass-Targets frei.
- Die Doku-Kommentare von `#renderPipelineSimple()` (`:532-538`) und
  `#renderPipelineComposed()` (`:578-582`) auf den neuen Stand.

`packages/twopoint5d/src/stage/README.md`:

- Tabelle »Clear policy« (`:192`): die Zeile `false (default)` sagt statt
  »Renderer state untouched«: nichts löscht, auch nicht `autoClear` des
  Renderers — er ist während der Stage-Draws `false` und wird danach
  wiederhergestellt; Frames sammeln sich an, sofern nicht etwas anderes löscht.
- `:204-206` (internes Pass-Target): jeden Frame vollständig zu transparentem
  Schwarz, Farbe und Depth; mit `clear = true` wirkt der eigene Clear danach,
  und einer, der Farbe und Depth abdeckt, ersetzt den schwarzen.
- `:208-211` (Pass-Target des Kindes): die Ausnahme aus Schritt 2.
- Abschnitt »Off-screen rendering« (`:215-232`): der Farbraum-Satz aus der
  `outputRenderTarget`-TSDoc.
- »Mode C« (`:251-265`): wann der Ausgabeknoten neu gebaut wird; das interne
  Target hat Typ und Samples des Renderers (`getOutputBufferType()`,
  `samples`).
- »Mode E« (`:319-347`): die Kind-Pipeline schreibt linear, der Renderer stellt
  `toneMapping` und `outputColorSpace` für das Vorab-Rendern auf
  `NoToneMapping` und den Working Color Space; Tone Mapping und Kodierung
  wirken einmal, in der äußersten Pipeline. Dasselbe gilt für ein Kind mit
  Pipeline unter einem Modus-C-Renderer.
- »Resource lifecycle« (`:457-458`): Typ und Samples, Nachführen der Samples,
  Freigabe beim Verlassen von Modus C und beim `remove()` aus einem Parent;
  three legt den Speicher beim nächsten Zeichnen wieder an.
- Pitfall »Mid-frame state on the WebGPU renderer« (`:514-516`): `autoClear` wird
  für die Stage-Draws auf `false` gesetzt und immer wiederhergestellt;
  Clear-Farbe und -Alpha ändern sich nur für einen Clear und werden gleich
  danach wiederhergestellt; `toneMapping` und `outputColorSpace` stehen,
  solange der Renderer in ein Target seiner eigenen Pipeline zeichnet, auf
  `NoToneMapping` und dem Working Color Space und werden danach
  wiederhergestellt — auch wenn eine Stage wirft.
- Kein Satz über den Vorzustand (Konventionen im Plan).

### 8. Vitest (`StageRenderer.spec.ts`)

Mock: `RendererMock` und `createRendererMock()` bekommen `samples: number`
(Start `4`), `getOutputBufferType: Mock` (liefert `FloatType`, damit der Test
belegt, dass der Typ vom Renderer kommt und nicht fest verdrahtet ist),
`toneMapping` (Start `ACESFilmicToneMapping`) und `outputColorSpace` (Start
`SRGBColorSpace`), alle Konstanten aus `'three/webgpu'`.

Tests gegen altes Verhalten mitziehen:

- `'rebuilds outputNode only when stage list changes'` (`:586-607`) prüft genau
  das Verhalten, das PERF-019 abschafft. Ersetzen durch
  `'keeps the output node of Mode C through changes of stages, order, names and cameras'`:
  nach dem ersten Frame `needsUpdate = false`, dann nacheinander `add()`,
  `remove()`, ein Schreiben von `renderOrder`, eine Umbenennung unter
  explizitem `renderOrder` und ein Kamerawechsel einer echten `Stage2D`
  (`stage.camera = new PerspectiveCamera()` nach `resize()`), jeweils mit einem
  `renderTo()` — `outputNode` bleibt derselbe, `needsUpdate` bleibt `false`.
- `'a nested StageRenderer with clear applies its own clear color on top of the transparent black clear'`
  (`:1093-1105`) erwartet zwei Clears. Neu: ein Kind mit `setClearColor()`
  (alle Buffer an) bekommt genau einen Clear vor dem Draw, seinen eigenen.

Neue Tests (Namen frei, aber aussagekräftig):

- IMPL-008: mit `clear = false` und `renderer.autoClear = true` ruft ein
  `renderTo()` mit zwei Stages kein `renderer.clear()`, `autoClear` ist in jedem
  `stage.renderTo()` `false` und danach wieder `true`.
- BUG-129: Modus C ohne `clear`: genau ein Clear auf dem internen Target, mit
  Farbe `0x000000`, Alpha `0`, Argumenten `[true, true, false]`; danach steht
  die Clear-Farbe des Renderers wieder auf `0x111111`/`0.5`. Log-Muster wie in
  `makeNestedSetup()` (`:1044-1069`).
- BUG-130: Modus C mit `setClearColor(new Color(0x123456), 0.25)` und
  `clearColorBuffer = false`: zuerst der schwarze Clear `[true, true, false]`,
  dann der eigene mit `[false, true, true]`, beide auf dem internen Target und
  vor dem ersten Stage-Draw.
- PERF-035 für Modus C: mit `setClearColor()` und allen Buffern an genau ein
  Clear auf dem internen Target, der eigene.
- PERF-035 für Kinder: ein Kind mit `clear` und `clearDepthBuffer = false`
  bekommt den schwarzen Clear und danach seinen eigenen; ein komponierendes
  Kind (Pipeline-Mock plus `buildOutputNode`) mit `setClearColor()`, das eine
  `Stage2D` ohne Kamera hält (`new Stage2D()` ohne Projektion), bekommt den
  schwarzen Clear trotzdem.
- BUG-114: (a) komponierender Parent mit einem Kind, das einen Pipeline-Mock
  hat: in dessen `render()` gilt `renderer.toneMapping === NoToneMapping` und
  `renderer.outputColorSpace === ColorManagement.workingColorSpace`; im
  `render()` der Parent-Pipeline und nach `renderTo()` gelten die
  Ausgangswerte. (b) dasselbe mit einem Modus-C-Parent. (c) ein Modus-C-Renderer
  ohne Kinder: die Stages zeichnen linear, seine eigene `pipeline.render()`
  sieht die Ausgangswerte. (d) der bestehende Test
  `'restores autoClear and the render target when a stage throws in the pipeline path'`
  (`:250-265`) prüft zusätzlich `toneMapping` und `outputColorSpace`; ein neuer
  Test prüft dasselbe, wenn im komponierten Modus das vorab gerenderte Kind wirft.
- BUG-013: das interne Target von Modus C (während eines Stage-Draws aus
  `renderer.__renderTarget` gelesen) und das Pass-Target
  (`(sr.asPassNode(renderer as any) as any).value.renderTarget`) haben
  `texture.type === FloatType` und `samples === 4`; nach `renderer.samples = 0`
  und dem nächsten Frame ist es dasselbe Objekt mit `samples === 0`.
- MEM-002/MEM-016 (Spy auf `RenderTarget.prototype.dispose` über die
  `sinon`-Sandbox wie im `dispose()`-Block): `pipeline = undefined` nach einem
  Modus-C-Frame gibt das interne Target genau einmal frei; eine wieder
  zugewiesene Modus-C-Pipeline zeichnet in dasselbe Objekt. Ebenso ein
  gesetztes `buildOutputNode` und eine zugewiesene `RootRenderPipeline`. Ein
  Wechsel auf eine zweite Modus-C-Pipeline gibt nichts frei.
- MEM-002/MEM-016 für Kinder: ein per `add()` aufgenommenes und ein per
  `child.parent = parent` angehängtes Kind — nach `parent.remove(child)` bzw.
  `child.detach()` ist sein Pass-Target genau einmal freigegeben, und
  `child.asPassNode()` liefert danach einen Knoten auf derselben Textur.
- PERF-019: `invalidateOutputNode()` in Modus C baut neu (der bestehende Test
  `:1107-1117` muss grün bleiben); die Rückkehr aus dem komponierten Modus baut
  neu (bestehender Test `:642-664` bleibt grün).

Bestehende Tests, die grün bleiben müssen, ohne Anpassung: `'disposes the render
targets it built itself'` (zwei `dispose()`-Aufrufe), alle Tests in
`RootRenderPipeline.spec.ts` (deren Mock braucht die neuen Felder nicht, weil
dort kein internes Target entsteht — falls doch, dort dieselben Felder
ergänzen).

Bei jedem Bugfix zuerst den Test, rot sehen, dann beheben; der rote Lauf gehört
in den Report.

### 9. Browser-Tests (`packages/twopoint5d-testing/test/stage-pipeline.test.js`)

Muster wie `'a nested StageRenderer without a pipeline shows only the content of the current frame'`
(`:236-287`): `Display` auf `makeContainer({width: 64, height: 64})`,
`await display.start()`, Renderer von Hand treiben, `outputRenderTarget` =
`new RenderTarget(64, 64)`, `readRenderTargetPixelsAsync`, `rgbAt`,
`isNearColor` (dritter Parameter Toleranz), Stage mit
`new OrthographicProjection('xy|bottom-left')`. Am Ende alles, was der Test
gebaut hat, freigeben — Renderer zuerst, dann Stages, Pipelines, Target,
Geometrie, Material.

- BUG-114, Mode E: Root mit `RootRenderPipeline`, Kind mit eigener
  `RenderPipeline` und `buildOutputNode = ([p]) => p`, eine Fläche
  `PlaneGeometry(32, 32)` am Ursprung mit `MeshBasicMaterial({color: new Color('#808080')})`.
  Pixel `(32, 32)` ≈ `[128, 128, 128]` (Toleranz 3). Vor dem Fix ≈ 187 — die
  zweite Kodierung von sRGB 0.5.
- Nebenbefund, Mode C: Root mit `RenderPipeline` ohne `buildOutputNode`, Kind
  mit eigener `RenderPipeline` (Modus C), sonst wie oben; ebenfalls ≈ 128.
- BUG-129: Root in Modus C ohne `clear`, `display.renderer.setClearColor(new Color('#f00'), 1)`,
  `root.pipeline.outputColorTransform = false`, eine grüne Fläche nur links;
  ein Pixel rechts ohne Stage-Inhalt ist `[0, 0, 0]` (vor dem Fix `[255, 0, 0]`).
- BUG-130: Root in Modus C mit `setClearColor(new Color('#000'), 1)` und
  `clearColorBuffer = false`, reine grüne Fläche, zwei Frames mit verschobener
  Fläche wie im Vorbild: die alte Stelle ist im zweiten Frame schwarz.
- BUG-013: ein Modus-C-Renderer mit einer eigenen kleinen Stage
  (`{name, resize() {}, updateFrame() {}, renderTo(r) { captured = r.getRenderTarget(); }}`)
  zeichnet in ein Target mit `samples === display.renderer.samples` und
  `texture.type === display.renderer.getOutputBufferType()`; dasselbe für
  `sr.asPassNode(display.renderer).value.renderTarget`. (`Display` baut seinen
  Renderer mit `antialias: true`, also `samples` 4.)

### 10. CHANGELOG

Mit dem Skill `updating-changelog` unter `[Unreleased]`:

- `### Fixed`: Mode E und ein Kind mit Pipeline unter Modus C tragen Tone Mapping
  und Output-Kodierung einmal auf; das interne Target von Modus C wird jeden
  Frame vollständig zu transparentem Schwarz geleert, auch mit
  `clear = true` und abgeschaltetem Buffer-Clear; die internen Targets haben
  Typ und Samples des Renderers.
- `### Changed`: die internen Targets geben ihren GPU-Speicher beim Verlassen
  ihres Modus bzw. beim `remove()` frei; Modus C baut den Ausgabeknoten nur für
  eine neue Pipeline oder nach `invalidateOutputNode()`; ein verschachteltes
  Kind, dessen Clear Farbe und Depth abdeckt, wird vorher nicht mehr schwarz
  geleert.

Kein Eintrag im Migration Guide: keine Signatur ändert sich.

### Was dieses Paket nicht anfasst

- `#renderTargetSize()` gibt weiter ein Tupel zurück (PERF-017, Paket 2).
- Die Stage-Beziehung per `add()` bleibt einseitig (ARCH-007, Paket 3).
- `Stage2D.scene` bekommt keinen Setter (BUG-006, Paket 2).
- Die Lookbook-Demo `apps/lookbook/src/pages/demos/stage-nested-pipelines.astro`
  braucht keine Änderung; ihre Welt-Ebene wirkt nach dem Fix weniger
  ausgewaschen, weil sie nur noch einmal kodiert wird.

## Findings im Volltext

**BUG-114 · medium · packages/twopoint5d/src/stage/StageRenderer.ts:587-595** (weitere Stellen: `StageRenderer.ts:608`, `README.md`) — Den Output-Transform einer Kind-Pipeline im komponierten Modus abschalten
`RenderPipeline.render()` wendet in three 0.185 bei `outputColorTransform === true` (Default) Tone-Mapping und die Kodierung nach `outputColorSpace` an, unabhängig vom Target. Die Kind-Pipeline schreibt so sRGB-kodierte Werte in ihr lineares Pass-RT. Der Parent sampelt sie als linear und kodiert erneut. Im dokumentierten Mode E wirkt das Kind-Bild dadurch ausgewaschen oder doppelt tone-mapped. Das ist aus dem three-Quelltext abgeleitet und nicht per Pixel-Test verifiziert.
Empfehlung: Beim Vorrendern eines Kindes `pipeline.outputColorTransform = false` setzen und danach zurücksetzen. Das Verhalten für `outputRenderTarget` in der TSDoc festhalten und einen Pixel-Test für Mode E ergänzen.

**BUG-129 · low · packages/twopoint5d/src/stage/StageRenderer.ts:560** (weitere Stelle: `README.md:204-206`) — Internes RenderTarget von Modus C zu echtem transparentem Schwarz leeren
`#clearForInternalRT()` leert das interne RT von Modus C mit der aktuellen Clear-Farbe des Renderers bei Alpha 0, während die Stage-README »transparent black« verspricht. Bei einer Clear-Farbe ungleich Schwarz bleibt deren RGB im Target stehen und färbt über die Pipeline ins Bild, sobald ein Pass die Farbkanäle ohne Alpha-Gewichtung nutzt. Aufgefallen im Remediation-Lauf vom 2026-09-29.
Empfehlung: Wie für verschachtelte Kinder die Clear-Farbe für den Clear kurz auf (0, 0, 0, 0) setzen und danach wiederherstellen, oder die README auf das tatsächliche Verhalten zurücknehmen.

**BUG-130 · low · packages/twopoint5d/src/stage/StageRenderer.ts:567-576** (weitere Stelle: `README.md:204-206`) — Modus C mit clear = true und abgeschaltetem Buffer-Clear leert sein internes RT nur teilweise
Bei `clear = true` ruft `#clearForInternalRT()` nur `#applyClear()`. Steht `clearColorBuffer` oder `clearDepthBuffer` auf `false`, bleibt Farbe bzw. Depth des Vorframes im internen RT stehen, während die README »always cleared … so frame content does not accumulate« zusagt. Tritt nur auf, wenn ein Aufrufer einen Buffer-Clear ausdrücklich abschaltet; dort kann Akkumulation gewollt sein. Aufgefallen im Remediation-Lauf vom 2026-09-29.
Empfehlung: Entscheiden, was gilt: entweder das interne RT immer vollständig leeren und die Farbe des Renderers danach per eigenem Clear auftragen (wie beim verschachtelten Kind), oder die README-Zusage auf den Default einschränken.

**BUG-013 · low · packages/twopoint5d/src/stage/StageRenderer.ts:666** — Interne RenderTargets mit HalfFloat und den Samples des Renderers anlegen
`#ensureRT()` baut `#internalRT` und `#asPassNodeRT` als `new RenderTarget(w, h)` mit den three.js-Defaults: `UnsignedByteType`, `samples = 0`. Die `pass()`-Knoten der Stages im komponierten Modus nutzen dagegen `HalfFloatType` und `renderer.samples` (three PassNode.js:246, :766). Wer von Modus D auf Modus C oder auf einen verschachtelten Renderer wechselt, bekommt dadurch ein lineares 8-Bit-Zwischenbild mit sichtbarem Banding in dunklen Verläufen und verliert das MSAA, das der Plain-Modus auf dem Canvas hatte.
Empfehlung: `new RenderTarget(w, h, {type: HalfFloatType, samples: renderer.samples})` verwenden (oder die Optionen konfigurierbar machen) und bei einem geänderten `renderer.samples` in `#ensureRT()` nachziehen.

**PERF-019 · low · packages/twopoint5d/src/stage/StageRenderer.ts:549** (weitere Stellen: `:871`, `:877`, `:900`, `:757`) — Pipeline im Modus C nur beim Wechsel von Pipeline oder RenderTarget neu aufbauen
Im Modus C (Pipeline ohne `buildOutputNode`) hängt der Ausgabeknoten von keiner Stage ab — er ist immer `texture(#internalRT.texture)`. Trotzdem setzt jedes `add()`, `remove()`, jeder Kamerawechsel einer Stage, jede Umbenennung unter explizitem `renderOrder` und jede Änderung von `renderOrder` `#outputDirty`, und der nächste Frame baut einen neuen `texture()`-Knoten und setzt `pipeline.needsUpdate = true`. Das stößt einen neuen Node-Build des Fullscreen-Quads an. Bei Szenenwechseln, die Stages zur Laufzeit hinzufügen oder entfernen, oder bei häufig getauschten Kameras entsteht so ein vermeidbarer Hitch.
Evidenz: `if (this.#outputDirty) { this.pipeline!.outputNode = texture(rt.texture); this.pipeline!.needsUpdate = true; … }`
Empfehlung: Im Modus C den gebauten Knoten zusammen mit der Pipeline und dem RenderTarget merken und nur neu bauen, wenn sich eines davon geändert hat; `#outputDirty` bleibt dem komponierten Modus vorbehalten.

**MEM-002 · low · packages/twopoint5d/src/stage/StageRenderer.ts:399** (weitere Stellen: `:437`, `:894`, `:736`) — Interne RenderTargets beim Verlassen ihres Modus freigeben
`#internalRT` (Modus C) und `#asPassNodeRT` (Kind in einem komponierenden Parent) werden lazy in voller Containergröße × Pixel Ratio gebaut und erst in `dispose()` freigegeben. Setzt der Aufrufer `pipeline = undefined` oder `buildOutputNode`, bleibt `#internalRT` ungenutzt allokiert und wird bei jedem `resize()` sogar weiter mitskaliert (Zeile 320–321). Ebenso behält ein per `remove()` aus dem Parent genommenes Kind sein `#asPassNodeRT`. Bei 4K und DPR 2 sind das je RenderTarget rund 130 MB Farbe plus Depth auf der GPU.
Evidenz: `if (this.#internalRT) this.#resizeRenderTarget(this.#internalRT);` — auch ohne Pipeline
Empfehlung: Im `pipeline`- und `buildOutputNode`-Setter das `#internalRT` disposen, wenn der neue Zustand nicht mehr Modus C ist; in `#removeFromParent()` das `#asPassNodeRT` freigeben. Beide werden beim nächsten Bedarf wieder lazy gebaut.

**MEM-016 · low · packages/twopoint5d/src/stage/StageRenderer.ts:443-446** (weitere Stelle: `:399-406`) — Interne RenderTargets beim Moduswechsel und beim Entfernen freigeben
Nach `pipeline = undefined` oder einer Zuweisung von `buildOutputNode` belegt `#internalRT` weiter Speicher in voller Größe mal Pixel Ratio. Dasselbe gilt für `#asPassNodeRT` nach `remove()`. Ein Leak ist das nicht, weil `dispose()` beides freigibt, es kostet aber VRAM.
Empfehlung: `#internalRT` beim Verlassen von Mode C freigeben und `#asPassNodeRT` bei `OnRemoveFromParent`.

**PERF-035 · info (Optimierungspotenzial) · packages/twopoint5d/src/stage/StageRenderer.ts:602** — Doppelten Clear für ein verschachteltes Kind mit eigenem clear einsparen
Der komponierende Parent leert das Pass-Target jedes verschachtelten Kindes pro Frame zu transparentem Schwarz; ein Kind mit `clear = true` leert danach selbst mit seiner Farbe. Das ist gewollt, damit keine Renderer-Clear-Farbe mitaddiert wird und ein teilweise abgeschalteter Buffer-Clear keine Schlieren hinterlässt, kostet aber einen zweiten Clear pro Frame. Aufgefallen im Remediation-Lauf vom 2026-09-29.
Empfehlung: Den Vorab-Clear überspringen, wenn das Kind `clear`, `clearColorBuffer` und `clearDepthBuffer` gesetzt hat und seine Farbe vollständig schreibt.

**IMPL-008 · low · packages/twopoint5d/src/stage/README.md:192** — Die README-Clear-Policy-Tabelle mit dem erzwungenen autoClear = false in Einklang bringen
Mit dem Default `clear=false` wird das `autoClear` des Renderers (three-Default `true`) für jeden Stage-Draw auf `false` übersteuert, nichts löscht also je den Canvas: Wer `clear` auslässt, weil »der Renderer ohnehin löscht«, bekommt akkumulierende Frames. Die Tabellenzeile »Renderer state untouched« ist falsch, und der Pitfalls-Eintrag irrt in die andere Richtung — `autoClear` wird immer wiederhergestellt, Farbe/Alpha nur, wenn ein Clear stattfand.
Empfehlung: Entweder dokumentieren (»`clear` ist das einzige Clear; `autoClear` ist während der Stage-Draws immer aus«) an beiden Stellen, oder `renderer.autoClear` für die erste Stage respektieren, wenn `clear=false` (autoClear erst nach dem ersten `renderStage` auf false). Spec für die gewählte Variante.

**PERF-024 · info · packages/twopoint5d/src/stage/StageRenderer.ts:877** — Den Kamerawechsel einer Stage den Output-Node nur im komponierten Modus invalidieren lassen
Das Abo auf `OnStageAfterCameraChanged` invalidiert den Output-Node in jedem Modus. Im Plain-Modus ist das folgenlos, in Mode C baut ein Kamerawechsel `texture(rt.texture)` neu und stößt eine unnötige Shader-Neukompilierung an. Nur bei Kamerawechsel, deshalb harmlos. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Nur invalidieren, wenn der Renderer pass nodes komponiert (`buildOutputNode` oder `RootRenderPipeline`).
