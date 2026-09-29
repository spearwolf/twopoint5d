# Paket 4 — Canvas2DStage: Texturlebenszyklus und Frame-Tick

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-004 (medium), PERF-021 (medium, Optimierungspotenzial), API-062 (low),
  IMPL-002 (low), CONS-046 (info), TEST-047 (low, nachgetragen in Zug 0) · dazu die Folge aus
  Paket 3 (Nachtragspaket hier zusammengelegt: `Stage2D#dispose()` und `StageRenderer#dispose()`
  lassen einen werfenden `dispose`-Listener den Abbau und die übrigen Listener aufhalten) und der
  vorbestehende gleiche Fehler in `Canvas2DStage#dispose()` (gleiche Ursache)
- Ziel: `Canvas2DStage` baut ihre Textur nur bei geänderter Canvas-Größe neu, zeichnet den ersten
  Frame, gibt die Textur nur lesend heraus und reicht den Frame-Tick an ihre Stage weiter; dazu
  hört bei `Canvas2DStage`, `Stage2D` und `StageRenderer` jeder `dispose`-Listener das Event, und
  der Abbau läuft zu Ende, auch wenn einer wirft.
- Modell: mittlere Stufe
- Effort: medium — die öffentliche Oberfläche (Getter `texture`, Überladungen von `render()`,
  Fehlersemantik von `dispose()`) steht unten mit Signaturen und Semantik fest; die Arbeit ist
  Umsetzung, Regressionstests, Browser-Test und Doku, kein Entwurf.
- Dateien:
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts`, `Canvas2DStage.spec.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts` (nur `dispose()` samt TSDoc), `Stage2D.spec.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.ts` (nur `dispose()` samt TSDoc),
    `StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/README.md`, `packages/twopoint5d/docs/resource-lifecycle.md`
  - `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]` samt Migration Guide)
  - `apps/lookbook/src/pages/demos/quadtree-playground.astro`
  - neu: `packages/twopoint5d-testing/test/stage-canvas2d.test.js`
- Vorgehen:
  1. **Textur einmal bauen, danach in dieselbe hochladen** (PERF-004, PERF-021) —
     `Canvas2DStage.ts`:
     - Das öffentliche Feld `texture?: Texture` wird das private Feld `#texture?: Texture`.
       Zwei neue private Felder `#textureWidth = 0` und `#textureHeight = 0` halten die
       Canvas-Größe, für die `#texture` gebaut wurde.
     - `makeTexture()` geht in `updateTexture()` auf. `updateTexture(): void` tut nichts, solange
       `needsUpdate` `false` ist. Sonst setzt es `needsUpdate = false` und:
       - hat die Stage eine Textur und ist `this.canvas.width`/`height` gleich
         `#textureWidth`/`#textureHeight`: nur `this.#texture.needsUpdate = true` — kein neues
         Objekt, kein `material.needsUpdate`, nichts wird freigegeben.
       - sonst (erste Textur, oder die Canvas hat eine andere Größe): `#textureFactory ||= new
         TextureFactory(this.renderer, ['nearest', 'flipy', 'srgb'])` wie bisher, neue Textur
         über `this.#textureFactory.create(this.canvas)` in `#texture`, `#textureWidth`/
         `#textureHeight` auf die Canvas-Größe, `this.sprite.material.map = this.#texture`,
         `this.sprite.material.needsUpdate = true`, **danach** `previous?.dispose()`. Die
         Reihenfolge »Nachfolger auf dem Material, dann Vorgänger frei« und ihr Kommentar bleiben.
     - Die Größe wird an der Canvas gemessen, nicht an `setCanvasSize()`: eine übergebene Canvas,
       deren `width`/`height` der Aufrufer selbst setzt, bekommt so ebenfalls eine neue Textur.
     - Warum-Kommentar an den Größenvergleich, sinngemäß: three.js legt die GPU-Textur einmal an,
       in der Größe des ersten Uploads, und kopiert jeden späteren `needsUpdate`-Upload in sie
       hinein (`Textures#updateTexture()` in three r185, `backend.createTexture()` nur solange
       `isDefaultTexture` gilt); eine Canvas anderer Größe braucht deshalb eine eigene Textur.
     - `setCanvasSize()` bleibt, wie es ist, und setzt `needsUpdate` nicht; der Neubau geschieht
       beim nächsten Upload, den der Aufrufer anfordert.
  2. **`texture` nur lesend, erster Frame sichtbar** (API-062; Entscheidung »`Canvas2DStage.texture`
     wird ein reiner Getter«):
     - `get texture(): Texture | undefined { return this.#texture; }`, **kein Setter**. Eine
       Zuweisung compiliert nicht und wirft in Strict-Mode-Code einen `TypeError`.
     - TSDoc des Getters, sinngemäß: die Textur, durch die der Sprite die Canvas zeigt; die Stage
       baut sie beim ersten `render()` und neu beim ersten Upload, nachdem die Canvas ihre Größe
       geändert hat, und gibt die vorige frei, sobald die neue auf dem Material sitzt; jede davon
       gehört der Stage, die letzte gibt `dispose()` frei; `undefined` vor dem ersten `render()`
       und nach `dispose()`.
     - `needsUpdate = true` als Startwert. TSDoc: nach jeder Änderung des Canvas-Inhalts auf
       `true` setzen, das nächste `render()` lädt ihn hoch; startet mit `true`, damit das erste
       `render()` zeigt, was die Canvas schon trägt — auch eine vor dem Konstruktor bemalte,
       übergebene Canvas.
     - `#placeholderTexture` bleibt unverändert: das Material hat vom Konstruktor an eine `map`,
       das erste `render()` tauscht sie aus.
  3. **`render()` treibt den Frame der Stage** (IMPL-002):
     - Zwei Überladungen und eine Implementierung:
       ```ts
       render(): void;
       render(now: number, deltaTime: number, frameNo: number): void;
       render(now?: number, deltaTime?: number, frameNo?: number): void { … }
       ```
     - Ablauf, in dieser Reihenfolge: Disposed-Guard wie bisher; `resize`-Event wie bisher;
       `render`-Event wie bisher; `updateTexture()`; **`this.stageRenderer.updateFrame(now,
       deltaTime, frameNo)`**; `this.stageRenderer.renderTo(this.renderer)`.
     - Sind alle drei Werte übergeben, gehen sie unverändert an `updateFrame()`. Fehlt einer
       (`undefined`), nimmt die Stage alle drei aus einer eigenen Uhr: privates Feld
       `#clock?: Chronometer` (Import `{Chronometer} from '../display/Chronometer.js'`), angelegt
       beim ersten `render()` ohne Werte — dieser Aufruf bekommt `now = 0`, `deltaTime = 0`; jeder
       weitere ohne Werte ruft `this.#clock.update()` und nimmt `now = this.#clock.time`,
       `deltaTime = this.#clock.deltaTime` (Sekunden). `frameNo` zählt die Aufrufe ohne Werte ab 1,
       wie ein `Display` seine Frames zählt: privates Feld `#frameNo = 0`, vor der Übergabe
       hochgezählt. Aufrufe mit Werten berühren Uhr und Zähler nicht.
     - TSDoc von `render()`: die Reihenfolge oben (das `render`-Event ist der Moment, in die
       Canvas zu zeichnen und `needsUpdate` zu setzen); die Werte kommen typischerweise aus den
       `DisplayEventProps` von `OnDisplayRenderFrame`; ohne sie die eigene Uhr wie beschrieben;
       ohne `setContainerSize()` hat die `Stage2D` keine Kamera und `render()` zeichnet nichts —
       nach 100 solchen Frames warnt die Stage einmal; `render()` treibt `stageRenderer` selbst,
       an einen Host (`Display`) gehängt würde er pro Frame doppelt aktualisiert und gezeichnet.
  4. **Rückgabetypen** (CONS-046): `updateTexture(): void`, `setContainerSize(…): void`,
     `setCanvasSize(…): void`, `render(…): void` (alle Überladungen), `dispatchEvent(…): void`.
     Die `private`-Methoden bleiben TS-`private`; kein Umbau auf `#`.
  5. **`dispose`-Event erreicht jeden Listener, der Abbau läuft zu Ende** (Folge aus Paket 3,
     dazu `Canvas2DStage`):
     - `Stage2D#dispose()` (`Stage2D.ts:433-442`):
       ```ts
       try {
         emitStrict(this, 'dispose', this);
       } finally {
         off(this);
         this.#disposePassNode();
       }
       ```
       Kommentar: jeder Listener hört das Event, auch hinter einem, der wirft — so lässt jeder
       `StageRenderer`, der die Stage hält, sie los; der Fehler geht nach dem Abbau an den
       Aufrufer.
     - `StageRenderer#dispose()` (`StageRenderer.ts:973-980`): im bestehenden `try … finally`
       `emit` → `emitStrict`; Kommentar entsprechend ergänzen. Sonst nichts an der Methode.
     - `Canvas2DStage#dispose()` (`Canvas2DStage.ts:222-243`), nach dem Muster von
       `TextureResource#dispose()`: `const errors: unknown[] = []`; `emitStrict(this, 'dispose',
       this)` in `try … catch` (Fehler sammeln), danach `off(this)`; Sprite aus der Szene,
       Material, Platzhalter, `#texture` frei, `#texture = undefined`, `#textureFactory =
       undefined` wie bisher; `this.stageRenderer.dispose()` und `this.stage.dispose()` je in
       eigenem `try … catch` (Fehler sammeln), in dieser Reihenfolge; zuletzt
       `throwCollected(errors, 'Canvas2DStage#dispose(): listeners of the dispose events of the
       stage, its stage renderer and its Stage2D threw')` — Import `{throwCollected} from
       '../texture/internals.js'` (ein Fehler unverändert, mehrere als `AggregateError`).
     - Die private `dispatchEvent()` bleibt für `resize` und `render` mit `emit`.
     - TSDoc aller drei `dispose()` um einen Satz ergänzen, sinngemäß: ein Listener des
       `dispose`-Events, der wirft, hält den Abbau nicht auf — jeder Abonnent hört das Event, die
       Instanz wird ganz abgebaut, und der Fehler erreicht den Aufrufer danach, einer unverändert,
       mehrere als `AggregateError`. Bei `Canvas2DStage` zusätzlich: das gilt ebenso für die
       `dispose`-Listener ihres `StageRenderer` und ihrer `Stage2D`.
  6. **Doku**:
     - `Canvas2DStage#dispose()`-TSDoc: der Satz »{@link texture} is the one field the stage owns
       whoever wrote it — a texture assigned there from outside is released here as well.« fällt;
       es bleibt: die Stage gibt die Texturen frei, die sie gebaut hat.
     - `src/stage/README.md:48` (Tabellenzeile `Canvas2DStage`): um einen Halbsatz ergänzen —
       `render(now, deltaTime, frameNo)` aus der eigenen Frame-Schleife aufrufen; die Stage hat
       eine Kamera, sobald `setContainerSize()` ihr eine Größe gegeben hat.
     - `src/stage/README.md:545-549` (Lifecycle-Bullet `Canvas2DStage.dispose()`): »a texture
       assigned to `texture` from outside as much as one the stage built« fällt. Im
       `Stage2D.dispose()`-Bullet (`:541-544`) »Every `StageRenderer` that holds the stage takes
       it out on its `dispose` event« um », even behind a listener of that event that throws«
       ergänzen.
     - `docs/resource-lifecycle.md:30-34`: »Two exist today: … and `Canvas2DStage` takes over
       every texture that lands in its `texture` field, assigned from outside or built in-house.«
       wird zu einer Übernahme — nur `Display` mit dem `WebGPURenderer` seines Konstruktors.
     - `CHANGELOG.md` `[Unreleased]` (Skill `updating-changelog` laden):
       - die bestehenden Einträge zu `Canvas2DStage#dispose()` (`:26`), `Stage2D#dispose()`
         (`:38`) und `StageRenderer#dispose()` (`:171`) um den Satz zum werfenden Listener aus
         Schritt 5 ergänzen — alle drei sind unveröffentlicht, ein eigener `Fixed`-Eintrag entfällt;
       - `### Added`: `Canvas2DStage#render()` nimmt `now`, `deltaTime`, `frameNo` und ruft damit
         `stageRenderer.updateFrame()` vor dem Zeichnen; ohne Werte eigene Uhr und Frame-Zählung;
         `OnStageFirstFrame`/`OnStageUpdateFrame` erreichen die Listener von `canvasStage.stage`,
         eine Stage ohne Kamera warnt nach 100 Frames; wer `stageRenderer.updateFrame()` neben
         `render()` selbst aufgerufen hat, lässt das weg;
       - `### Changed`, bei den übrigen Stage-Einträgen (Umgebung `:299`): `Canvas2DStage#texture`
         ist ein Getter, »See the Migration Guide«; `Canvas2DStage` lädt eine Änderung der Canvas
         in die vorhandene Textur und baut eine neue nur für eine Canvas anderer Größe, das
         Material wird nur dann neu gebaut; `needsUpdate` startet mit `true`, das erste `render()`
         zeigt, was die Canvas schon trägt;
       - Migration Guide: neuer Abschnitt `#### \`Canvas2DStage#texture\` is read-only` hinter
         `#### The stage lists of \`StageRenderer\` are read-only` (vor `## [0.21.2]`): eine
         Zuweisung compiliert nicht und wirft in Strict-Mode-Code einen `TypeError`; die Stage
         baut die Textur aus ihrer Canvas und besitzt sie; anderen Inhalt in `canvas` zeichnen und
         `needsUpdate = true` setzen; eine eigene Textur gehört auf ein eigenes Material. **Before**
         als schlichter `ts`-Block (`canvasStage.texture = myTexture;`), **After** als `ts check`
         (Import aus `@spearwolf/twopoint5d` und `three/webgpu`, `new Canvas2DStage(renderer, 256,
         256)`, in `canvasStage.canvas.getContext('2d')!` zeichnen, `canvasStage.needsUpdate =
         true`).
  7. **Lookbook** — `apps/lookbook/src/pages/demos/quadtree-playground.astro:44-46`:
     `[OnDisplayRenderFrame]: ({now, deltaTime, frameNo}: DisplayEventProps) => {
     visual.canvasStage.render(now, deltaTime, frameNo); }`.
  8. **Vitest, je zuerst rot** (Bugfix-Paket — der rote Lauf gehört in den Report):
     - `Canvas2DStage.spec.ts`:
       - `'uploads a change of the same size into the texture it has'` — `render()`, Textur und
         `sprite.material.version` merken; `needsUpdate = true`, `render()` → dieselbe Textur,
         `texture.version` gestiegen, `material.version` unverändert.
       - `'builds a new texture for a canvas of another size'` — nach `setCanvasSize(64, 32)` und
         `needsUpdate = true` eine neue Textur auf `material.map`, die vorige freigegeben.
       - `'builds a new texture when a canvas handed in changes its size itself'` —
         `canvas.width = 48` direkt, `needsUpdate = true`, `render()` → neue Textur.
       - der bestehende Test `'puts the new texture in place before it releases the one it
         replaces'` bekommt zwischen den beiden `render()` ein `setCanvasSize(…)` mit anderer
         Größe, sonst entsteht keine zweite Textur mehr.
       - `'shows the canvas on the first render() without needsUpdate'` — neue Stage ohne
         `needsUpdate`-Zuweisung, `render()` → `texture` definiert und `=== sprite.material.map`.
       - `'hands out its texture read-only'` — Zuweisung über einen Cast wirft `TypeError`; dazu
         eine Zeile mit `// @ts-expect-error` gegen die direkte Zuweisung.
       - `'render(now, deltaTime, frameNo) hands the frame to the stage renderer before it
         draws'` — `updateFrame` und `renderTo` des `stageRenderer` mit `sandbox.spy`/`stub`,
         `render(1.5, 0.25, 7)` → `updateFrame` mit `(1.5, 0.25, 7)`, vor `renderTo`.
       - `'render() without frame values counts frames of its own'` — zweimal `render()` → erster
         `updateFrame`-Aufruf `(0, 0, 1)`, zweiter `frameNo` 2, `now` und `deltaTime` ≥ 0.
       - `'the Stage2D gets OnStageUpdateFrame once the container has a size'` —
         `setContainerSize(320, 240)`, `renderTo` gestubbt (unter Node zeichnet nichts), Listener
         auf `OnStageUpdateFrame` an `stage.stage`, `render(2, 0.5, 3)` → Props mit `now: 2,
         deltaTime: 0.5, frameNo: 3`.
       - in `describe('dispose()')`: `'a dispose listener that throws does not hold up the
         teardown'` — werfender Listener auf der Stage → `dispose()` wirft genau diesen Fehler,
         Material, Platzhalter, `stageRenderer` (`isDisposed`) und `stage` (`isDisposed`) sind
         trotzdem abgebaut; ein Fall, in dem auch ein `dispose`-Listener an `stageRenderer` wirft
         → `AggregateError` mit beiden Fehlern, die Stage-Fehler zuerst.
       - die bestehenden Dispose-Tests (a) und (d) setzen `needsUpdate = true` vor `render()`;
         das darf bleiben, sie müssen grün bleiben.
     - `Stage2D.spec.ts`, `describe('dispose()')`: `'a dispose listener that throws does not keep
       the stage from releasing its pass node and its listeners'` — Pass-Node bauen, werfender
       Listener, `dispose()` wirft ihn; Pass-Node-`dispose` einmal gerufen,
       `getSubscriptionCount(stage) === 0`.
     - `StageRenderer.spec.ts`:
       - neben `'lets go of a Stage2D that is disposed in every renderer that holds it'` (`:688`):
         `'lets go of a Stage2D that is disposed even behind a dispose listener that throws'` —
         werfender Listener auf der Stage **vor** den beiden `add()`, `stage.dispose()` wirft ihn,
         beide Renderer halten die Stage danach nicht mehr.
       - in `describe('dispose()')` neben `'stops listening even when a dispose listener
         throws'` (`:1970`): `'every dispose listener hears the event, even behind one that
         throws'`. Der bestehende Test bleibt unverändert grün (ein Fehler kommt unverändert).
  9. **Browser-Test** (TEST-047; Rendering-Änderung braucht beide Testflächen) — neue Datei
     `packages/twopoint5d-testing/test/stage-canvas2d.test.js`, Aufbau wie
     `stage-pipeline.test.js` (`makeContainer`, `disposeDisplay`, `rgbAt`, `isNearColor` aus
     `./helpers/fixtures.js`; `afterEach` räumt Display und Host ab). Container 64 × 64,
     `display.start()`; eine eigene Canvas 64 × 64 per `document.createElement`, **vor** dem
     Konstruktor rot gefüllt (`#ff0000`); `new Canvas2DStage(display.renderer, canvas)`;
     `stageRenderer.outputRenderTarget = new RenderTarget(64, 64)`; `setContainerSize(64, 64)`;
     von Hand `render()`, gelesen mit `display.renderer.readRenderTargetPixelsAsync(target, 0, 0,
     64, 64)`, geprüft an `rgbAt(pixels, 64, 32, 32)`. Reine Primärfarben, damit die
     sRGB-Umrechnung nichts verschiebt. Fälle:
     - `'draws a canvas painted before the constructor on the first render()'` — rot, ohne
       `needsUpdate` zu setzen.
     - `'uploads new content of the same size into the same texture'` — grün übermalen,
       `needsUpdate = true`, `render()` → grün, `texture` dasselbe Objekt.
     - `'shows a canvas of another size through a new texture'` — `setCanvasSize(128, 128)`, blau
       füllen, `needsUpdate = true`, `render()` → blau, `texture` ein anderes Objekt (Zielgröße
       bleibt 64: `rgbAt` braucht Zeilen von 64 Pixeln).
     - Aufräumen im Test: `canvasStage.dispose()`, dann das `RenderTarget` des Tests.
- Nicht in diesem Paket: `setCanvasSize()` setzt kein `needsUpdate`; `TextureFactory` und
  `texture/internals.ts` bleiben unverändert (nur Import); keine Event-Konstanten für `resize`,
  `render`, `dispose` (das ist API-063, liegt in »Offene Befunde«); die Klassen-TSDoc von
  `Stage2D` (Queue-Eintrag `Stage2D.ts:29-41`) bleibt, wo sie steht.
- Verify: `pnpm run ci`
- Commit: `fix!: let Canvas2DStage upload a change of its canvas into the texture it has and build a new one only for a canvas of another size, show the canvas on the first render(), hand out its texture read-only, drive the frame of its Stage2D from render() with the frame values it is given or a clock of its own, and let every dispose listener of Canvas2DStage, Stage2D and StageRenderer hear the event and the teardown run to its end when one of them throws`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · PERF-004 unverändert (`Canvas2DStage.ts:135-147`,
    `makeTexture()` `:127-133`) · PERF-021 unverändert, dieselbe Stelle, deckungsgleich mit
    PERF-004 · API-062 unverändert (`texture?` `:62-67`, `needsUpdate = false` `:74`) · IMPL-002
    unverändert (`render()` `:173-188` ohne `updateFrame()`; die Audit-Aussage, das Lookbook rufe
    nie `setContainerSize()`, trifft nicht zu — `quadtree-playground.astro:40-42` tut es) ·
    CONS-046 unverändert (`:135`, `:149`, `:158`, `:173`, `:190`) · TEST-047 nachgetragen: die
    OrthographicProjection-Hälfte ist gegenstandslos (`stage-pipeline.test.js:321-361` rendert
    eine Orthographic-Stage und liest Pixel zurück, stand schon vor dem Lauf da), die
    Canvas2DStage-Hälfte deckt Schritt 9 · Folge aus Paket 3 (`Stage2D.ts:437-441`, unverändert)
    als Symptom eingeordnet und als Nachtragspaket hier zusammengelegt, dazu dieselbe Ursache in
    `StageRenderer.ts:973-980` (`emit` statt `emitStrict`, `dispose`-Event neu aus Paket 3) ·
    `Canvas2DStage.ts:222-243` vorbestehend (`git show 5ff01ea2:…/Canvas2DStage.ts` identisch),
    gleiche Ursache, ins Paket · Queue-Eintrag `Stage2D.ts:29-41` nicht aufgenommen (andere
    Ursache) · TEST-042 und API-063 beim Abgleich der Scope-Liste gefunden, nach »Offene Befunde« ·
    Restplan unverändert: Paket 5 und 6 fassen `Stage2D.ts` und `StageRenderer.ts` an anderen
    Stellen an, Reihenfolge und »Hängt ab von« bleiben; was Paket 6 von `dispose()` wissen muss,
    trägt die `Schnittstellen:`-Zeile dieses Pakets nach dem Commit
  - 2026-09-29 Zug 1: Implementierer beauftragt (Runde 0, sonnet, effort medium), Brief `paket-4.impl-0.brief.txt`, Report nach `paket-4.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG (session `55a453fc-bfbd-468a-bb50-c23a3a729dd0`) · geändert `Canvas2DStage.ts`/`.spec.ts`, `Stage2D.ts`/`.spec.ts`, `StageRenderer.ts`/`.spec.ts`, `src/stage/README.md`, `docs/resource-lifecycle.md`, `CHANGELOG.md`, `quadtree-playground.astro`, neu `stage-canvas2d.test.js` · 14 Vitest-Tests vor dem Fix rot, Browser-Test vor dem Fix Hänger (Timeout 120 s) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-4.verify.log`, Browser-Suite aus dem Nx-Cache desselben Eingabestands)
  - 2026-09-29 Zug 3: Reviewer (opus, effort medium) — alle acht Punkte behoben, 0 kritisch, 0 wichtig, 4 klein · Diff `paket-4.diff`, Report `paket-4.review-0.json`
  - 2026-09-29 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-29 Zug 5: Commit `abf84d48` auf `main`, getragen vom Verify-Lauf aus Zug 2 (keine Codeänderung danach)

## Urteil des Reviewers

- PERF-004 behoben — `Canvas2DStage.ts:141-167` (Re-Upload bei gleicher Größe, Neubau nur bei anderer Canvas-Größe, Warum-Kommentar `:145-148`); Spec `Canvas2DStage.spec.ts:99`, `:116`, `:132`
- PERF-021 behoben — dieselbe Stelle wie PERF-004
- API-062 behoben — Getter ohne Setter `Canvas2DStage.ts:77`, `needsUpdate = true` `:88`; Spec `:147`, `:158`; Migration Guide `CHANGELOG.md:3449`
- IMPL-002 behoben — Überladungen und Implementierung `Canvas2DStage.ts:211-242` (`updateFrame()` vor `renderTo()`, eigene `Chronometer`-Uhr und Zähler, TSDoc zur fehlenden Kamera ohne `setContainerSize()`); Spec `:171`, `:183`, `:197`; Lookbook `quadtree-playground.astro:44-46`
- CONS-046 behoben — `: void` an `Canvas2DStage.ts:141`, `:170`, `:179`, `:211-213`, `:244`
- TEST-047 behoben (Canvas2DStage-Hälfte; Orthographic-Hälfte laut Zug 0 gegenstandslos) — `packages/twopoint5d-testing/test/stage-canvas2d.test.js`, drei Pixel-Fälle
- Folge aus Paket 3 behoben — `Stage2D.ts:442-447` (`emitStrict` in `try … finally { off; #disposePassNode }`), `StageRenderer.ts:981` (`emitStrict`); Spec `Stage2D.spec.ts:525`, `StageRenderer.spec.ts:702`, `:2000`
- Nebenbefund `Canvas2DStage#dispose()` behoben — `Canvas2DStage.ts:283-319` (Fehler gesammelt, Abbau vollständig, `throwCollected()`); Spec `:321`, `:342`
- Konventionen: keine Finding-IDs, kein Rückblick; Commit-Message passt (`fix!`), Migration Guide an der geplanten Stelle

## Kleine Befunde

- `Canvas2DStage.ts:255-256` (dazu `README.md:545`, `CHANGELOG.md:26`): TSDoc von `dispose()` sagt »both textures that ever sat behind it« und hängt »The stage releases the textures it built.« an — doppelt und ungenau; als Folge im Plan gebucht, weil Doku, die nicht stimmt
- `CHANGELOG.md:27`: der neue `### Added`-Eintrag beginnt mit »`Canvas2DStage#render()` takes …« statt wie die übrigen mit »add …«
- `stage-canvas2d.test.js`, Helfer `fill(canvas, color)`: JSDoc typisiert `color` nicht
- `Stage2D.ts:444-447`: wirft `#disposePassNode()` im `finally`, verdrängt dieser Fehler den des Listeners (Form vom Detailplan festgelegt; `Canvas2DStage#dispose()` löst denselben Fall per `throwCollected()`)

## Anmerkungen aus dem Report des Implementierers

- Zusätzliche Tests: `a call with values leaves the clock and the frame count alone`, `collects the errors of the dispose listeners of the stage, its stage renderer and its Stage2D`
- Migration-Guide-Block nutzt `declare const renderer: WebGPURenderer;`; `resource-lifecycle.md` sagt »One exists today«
- `builds a new texture when a canvas handed in changes its size itself` war vor dem Fix nicht rot (alter Code baute bei jedem Upload neu) — Wächter, kein roter Beleg
- Browser-Test vor dem Fix: jeder Fall hing (Timeout 120 s) beim ersten `render()` ohne `needsUpdate`; Ursache nicht verfolgt

## Begründungen

- **Nachtragspaket hier.** Die Folge aus Paket 3 ist ein Symptom: Paket 3 hat den `StageRenderer`
  an das `dispose`-Event seiner Stages gehängt, `Stage2D#dispose()` aber ausdrücklich
  ausgenommen — hätte es seine Ursache zu Ende behoben, gäbe es den Eintrag nicht. Paket 3 ist
  committet, also ein Nachtragspaket; wie bei Paket 2 und 3 mit dem nächsten Paket
  zusammengelegt, weil Paket 4 `Canvas2DStage#dispose()` ohnehin umschreibt (Getter `texture`)
  und `Canvas2DStage` beide Klassen baut und abbaut.
- **`emitStrict` statt `try { emit } finally`.** Der Folgetext schlug »wie
  `StageRenderer#dispose()`« vor. Das hält den Abbau, lässt aber `emit` beim ersten werfenden
  Listener stehen: hängt ein Listener des Nutzers vor dem eines zweiten haltenden
  `StageRenderer`, behält dieser eine disposte Stage, und sein nächster komponierter Frame wirft
  in `asPassNode()`. `emitStrict` bedient jeden Listener und wirft danach — derselbe Weg, den
  `TextureResource#dispose()` schon geht; die Kosten des geschützten Dispatch zahlt die Library
  darüber ohnehin. Aus demselben Grund `StageRenderer#dispose()`: seine TSDoc verspricht das
  Event »to every subscriber«, `emit` hält das bei einem werfenden Listener nicht.
- **`Canvas2DStage#dispose()` im Paket.** Vorbestehend, aber dieselbe Ursache wie die Folge, und
  die Methode wird in Schritt 2 ohnehin angefasst. Mit `throwCollected()` statt verschachteltem
  `finally`, weil ein späterer Fehler in `finally` den früheren verschluckt.
- **`needsUpdate = true` als Startwert** statt »ohne Textur immer bauen«: so empfiehlt es das
  Audit, und der Merker sagt dann ehrlich, dass noch nichts hochgeladen ist.
- **Neue Textur nur bei anderer Größe, gemessen an der Canvas.** So verlangt es die Empfehlung;
  `texture.dispose()` samt Wiederverwendung desselben Objekts hinge an three.js-Interna
  (Neuanlage nach `dispose`, Bindings), der neue Wrapper nicht.
- **`render()` bleibt ohne Argumente aufrufbar.** Das Audit lässt »Parameter oder eigener
  Zähler« offen; Pflichtparameter wären ein Bruch, den keine Entscheidung deckt. Beides zusammen
  hält jeden bestehenden Aufrufer lauffähig und gibt den Listenern der Stage ehrliche Werte.
- **TEST-047 im Paket.** Es liegt unter der Scope-Regel (»das Verhalten der Stages und der
  Render-Pipeline«) und fehlte in der Scope-Liste nur mangels `component` — wie DOC-066 in
  Paket 3. Der Browser-Test aus Schritt 9 ist nach `AGENTS.md` ohnehin Pflicht.

## Findings im Volltext

**PERF-004 · medium · packages/twopoint5d/src/stage/Canvas2DStage.ts:135** — Canvas-Textur in
`Canvas2DStage` wiederverwenden statt pro Inhaltsänderung neu zu bauen
Jedes `render()` mit `needsUpdate === true` ruft `makeTexture()`, das über
`TextureFactory.create()` eine neue `THREE.Texture` baut (TextureFactory.ts:237–239), setzt sie
als `sprite.material.map`, markiert das Material mit `material.needsUpdate = true` und disposed
die Vorgängertextur. Für eine animierte 2D-Canvas — der Zweck der Klasse, und die Lookbook-Demo
`QuadTreeVisualization.render()` setzt `needsUpdate` bei jedem Aufruf — heißt das pro Frame: eine
neue GPU-Textur allozieren und hochladen, die alte zerstören, und den Node-Material-Build samt
Pipeline-Lookup erneut anstoßen. Nötig wäre pro Frame nur ein Re-Upload in dieselbe Textur.
Aufrufpfad: Anwendung → Canvas2DStage.render → updateTexture → makeTexture →
TextureFactory.create.
Empfehlung: Die Textur einmal bauen (bzw. nach einem `setCanvasSize()`, weil sich die GPU-Größe
ändert) und bei `needsUpdate` nur `this.texture.needsUpdate = true` setzen; `material.needsUpdate`
nur beim Wechsel der Textur selbst. Den Vertrag zu `texture` (Stage besitzt, was im Feld steht)
beibehalten.

**PERF-021 · medium (Optimierungspotenzial) · packages/twopoint5d/src/stage/Canvas2DStage.ts:127-147**
— In Canvas2DStage eine Texture wiederverwenden statt pro Update eine neue zu bauen
Jedes `needsUpdate` erzeugt über `TextureFactory.create()` eine neue `Texture` samt
GPU-Allokation, setzt `material.needsUpdate` und disposed die alte. Bei einem animierten Canvas
passiert das jeden Frame, das Lookbook setzt `needsUpdate` bei jeder Datenänderung.
Empfehlung: Die Textur einmal bauen und danach `texture.needsUpdate = true` setzen. Neu bauen nur
bei geänderter Canvas-Größe.

**API-062 · low · packages/twopoint5d/src/stage/Canvas2DStage.ts:62-67** (dazu `:74`) —
Canvas2DStage.texture wirksam oder lesend machen und den ersten Frame zeichnen
Eine von außen zugewiesene Textur landet nie in `sprite.material.map`. Sie wird nur beim nächsten
Update oder in `dispose()` freigegeben, obwohl die TSDoc sie »the texture the canvas content is
drawn from« nennt. `needsUpdate` startet mit false, deshalb bleibt ein schon bemalter, übergebener
Canvas unsichtbar, bis der Aufrufer das Flag setzt.
Empfehlung: `texture` nur lesend exponieren oder im Setter aufs Material anwenden und
`needsUpdate` initial auf true setzen. — Entschieden (Plan, »Entscheidungen«): reiner Getter,
Migration Guide.

**IMPL-002 · low · packages/twopoint5d/src/stage/Canvas2DStage.ts:173** —
`Canvas2DStage.render()` den Frame-Tick an seine Stage weitergeben lassen
`render()` emittiert `render`, aktualisiert die Textur und ruft `stageRenderer.renderTo()` — aber
nie `stageRenderer.updateFrame()`. Die `Stage2D` hinter `canvas2DStage.stage` bekommt dadurch kein
`updateFrame()`: `OnStageFirstFrame` und `OnStageUpdateFrame` feuern nie, und die Warnung nach 100
Frames ohne Kamera (Stage2D.ts:262–269) greift nicht. Ruft der Aufrufer nie `setContainerSize()`
— die Lookbook-Demo `QuadTreeVisualization` tut das nicht —, hat die Stage keine Kamera und
`render()` zeichnet stumm nichts.
Empfehlung: `render()` um die Frame-Parameter (`now`, `deltaTime`, `frameNo`) erweitern oder
einen eigenen Zähler führen und vor `renderTo()` `this.stageRenderer.updateFrame(…)` aufrufen; in
der JSDoc festhalten, dass ohne `setContainerSize()` keine Kamera entsteht.

**CONS-046 · info · packages/twopoint5d/src/stage/Canvas2DStage.ts:135** — Fünf Methoden der
Canvas2DStage tragen keinen Rückgabetyp
`updateTexture()`, `setContainerSize()`, `setCanvasSize()`, `render()` und `dispatchEvent()`
stehen ohne Rückgabetyp, anders als der Rest der Klasse und die Module ringsum.
Empfehlung: Die fünf Signaturen um ihren Rückgabetyp ergänzen.

**TEST-047 · low · packages/twopoint5d-testing/test/** — Kein Browser-Test rendert Canvas2DStage
oder OrthographicProjection und liest ein Pixel zurück
Aufgefallen im Remediation-Lauf vom 2026-09-25. Die Sprite-Materialien haben inzwischen
Pixel-Tests (`sprites-textured-material.test.js`, `sprites-animated-material.test.js`,
`sprites-billboard.test.js`). `Canvas2DStage` und `OrthographicProjection` werden in der
Browser-Suite dagegen nie instanziiert und nie gerendert. Ein kaputter Render-Pfad dort passiert
das volle Gate. Das Finding hängt mit TEST-022 zusammen, dort fehlen die Specs der stage-Schicht.
Empfehlung: Je eine Smoke-Datei: Stage mit bekannter Füllung in ein `RenderTarget` rendern und das
Pixel über `renderToPixels`/`rgbAt` aus `test/helpers/fixtures.js` assertieren.

**Folge aus Paket 3 · low · packages/twopoint5d/src/stage/Stage2D.ts:438** — `Stage2D#dispose()`
emittiert `dispose` ohne `try … finally`; wirft ein Listener, bleiben `off(this)` und
`#disposePassNode()` aus. Seit Paket 3 hört jeder haltende `StageRenderer` auf das Event und ruft
`remove()`, ein werfender `OnStageRemoved`-Listener schlägt damit bis hierher durch (der Emit ohne
`finally` stand vor dem Lauf schon so da, der neue Weg dorthin ist Folge). Dazu beim Abgleich:
`emit` hält beim ersten werfenden Listener an, ein zweiter haltender `StageRenderer` hinter ihm
lässt die Stage nicht los; `StageRenderer.ts:977` hat denselben `emit` für das in Paket 3 neue
`dispose`-Event des Renderers.

**Nebenbefund, vorbestehend · low · packages/twopoint5d/src/stage/Canvas2DStage.ts:227** —
`Canvas2DStage#dispose()` emittiert `dispose` ohne Schutz; wirft ein Listener, bleiben Sprite,
Material, Texturen, `StageRenderer` und `Stage2D` unfreigegeben, und weil `#disposed` schon `true`
ist, holt ein zweites `dispose()` das nicht nach. Gleiche Ursache wie die Folge oben.
