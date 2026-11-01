# Paket 21 — Drain: precompile unter WebGPU — eine Instanz-Geometrie zeichnet vor ihrem ersten update() keine Instanz

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Nebenbefund: `apps/lookbook/src/pages/demos/stage-transitions-gallery.astro:102-109` und
  `stage-transitions-game-menu.astro:163-166` — `director.precompile()` scheitert unter WebGPU mit
  `TypeError: Failed to execute 'drawIndexed' on 'GPURenderPassEncoder': Value is infinite` (medium,
  aus Paket 13b, Runde 0). Die übrigen Einträge, die die Drain-Runde in Paket 21 überführt hatte,
  gehen im Zug 0 mit ihrer Ursache nach Paket 21b (siehe »Schnitt«).
- Ziel: `precompile()` der Transition-Seiten läuft unter WebGPU durch: eine `InstancedVOBufferGeometry`
  zeichnet vor ihrem ersten `update()` keine Instanz, unter WebGPU wie unter WebGL 2, und Guide und
  TSDoc sagen das und dass der Off-Screen-Draw von `precompile()` kein Frame der Stage ist.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts` (Konstruktor, TSDoc von
    Konstruktor und `update()`)
  - `packages/twopoint5d/src/vertex-objects/asInstancedCopySource.ts` (TSDoc)
  - `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts` (zwei Tests)
  - `packages/twopoint5d/src/vertex-objects/README.md` (ein Satz)
  - `packages/twopoint5d/src/stage/StageDirector.ts` (nur das TSDoc von `precompile()`)
  - `packages/twopoint5d/docs/stages.md` (§ »No hitch on the first transition«)
  - `packages/twopoint5d/docs/sprites.md` (§ »Uploads: static and dynamic attributes«)
  - `packages/twopoint5d/CHANGELOG.md` (`### Fixed` unter `## [Unreleased]`)
  - `packages/twopoint5d-testing/test/stage-transitions.test.js` (ein Test)
  - `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js` (ein Test)
  - keine Datei unter `apps/lookbook/`: mit dem Fix in der Library laufen beide Seiten unverändert durch
- Vorgehen:
  1. **Regressionstests zuerst, rot sehen.** Vor jeder Änderung an `src/`:
     - In `vertex-buffers-geometry-updates.spec.ts`, `describe('InstancedVertexObjectGeometry')`
       (ab `:139`): Test `draws no instance before its first update(): instanceCount starts at 0 and
       follows the instanced pool from the first update() on`. `makeInstancedGeometry()` des Blocks
       (`:140-172`) legt drei Instanzen und ein Basis-VO an, ohne `update()`:
       `expect(geometry.instanceCount).toBe(0)`; nach `geometry.update()` `toBe(3)`. Vor dem Fix rot
       mit `Infinity`.
     - Im selben Spec, `describe('constructed with a BufferGeometry')` (ab `:1041`): Test `starts at an
       instanceCount of 0, where copy() of a plain BufferGeometry would leave it undefined`. Aufbau wie
       der Test `keeps the name of its class …` darüber (`new InstancedVOBufferGeometry(instancedDesc,
       10, base)`), `expect(geometry.instanceCount).toBe(0)`. Vor dem Fix rot mit `undefined`.
     - In `stage-transitions.test.js`, direkt nach dem Test `precompile() draws the layers it is given
       once, …` (`:284-301`): Test `precompile() draws a layer whose sprites wait for their first
       update(), and resolves`. Eine `Stage2D` (wie in `layer()` `:47-53`, über `keep()`), darin ein
       `FeatureSprites(TexturedSpriteKind, {capacity: 2, textures: {colorMap}})` mit `colorMap =
       keep(makeColorTexture([[255, 0, 0, 255]]))` aus `helpers/fixtures.js`, ein `createSprite()` mit
       `setSize(SIZE, SIZE)`, **kein** `update()`. `director.setStack([red.stage])`, `await draw()`,
       dann `await director.precompile(display.renderer, [[crossfade()]], {layers: [stage]})` — muss
       auflösen. Danach `sprites.update()`, `director.replace(red.stage, stage, {effect, manual:
       true})` mit `progress = 1` und `draw()`: die Bildmitte ist rot (`isNearColor(rgbAt(…, SIZE, 32,
       32), [255, 0, 0])`), damit der Test auch zeigt, dass das Sprite nach seinem `update()` zeichnet.
       Imports `FeatureSprites`, `TexturedSpriteKind` aus `@spearwolf/twopoint5d` und `makeColorTexture`
       aus `./helpers/fixtures.js` ergänzen. Vor dem Fix rot unter dem Launcher Chromium WebGPU
       (`drawIndexed … Value is infinite`), unter den WebGL-2-Launchern grün — so in den Report.
     - In `vertex-objects-gpu-upload.test.js`, neben `an instanced geometry uploads its base quad and
       every used instance` (`:263`): Test `an instanced geometry drawn before its first update() draws
       nothing and throws nothing`. Geometrie, Material und `VertexObjects` wie dort, Basis-Quad und
       eine Instanz anlegen, **ohne** `mesh.update()` `display.renderer.render(scene, camera)` und
       `await display.nextFrame()` — wirft nicht; danach `mesh.update()`, rendern, und `readBack()` des
       Attributs `instanceOffset` zeigt die Instanz (dieselben Mittel wie der Nachbartest). Vor dem
       Fix rot unter Chromium WebGPU.
     - Kommandos für den roten Lauf: `pnpm nx test twopoint5d -- src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`
       und `pnpm build:twopoint5d && pnpm --filter @spearwolf/twopoint5d-testing exec web-test-runner test/stage-transitions.test.js test/vertex-objects-gpu-upload.test.js`
       (die Gruppe `renderer-free` läuft dabei mit, das ist harmlos). Beide Ausgaben des roten Laufs
       gehören in den Report.
  2. **Fix.** In `InstancedVOBufferGeometry`, im `try` des Konstruktors als letzte Anweisung, nach
     `this.#routes.add({… group: 'instanced'})`: `this.instanceCount = 0;`, darüber ein Kommentar, der
     das *Warum* sagt — three startet eine `InstancedBufferGeometry` bei `instanceCount = Infinity`, und
     `copy()` einer einfachen `BufferGeometry` lässt `undefined` stehen; ein Draw vor dem ersten
     `update()` reicht das an das Backend weiter, und WebGPU lehnt `Infinity` in `drawIndexed()` ab,
     während WebGL 2 daraus 0 macht. Die Stelle deckt beide Konstruktorpfade, weil sie hinter dem
     `copy()` liegt. Kein `#updateDrawRange()` im Konstruktor (siehe »Entscheidungen«).
  3. **TSDoc in `InstancedVOBufferGeometry.ts`.** Im TSDoc des Konstruktors (`:110-123`) ein Absatz:
     die Geometrie zeichnet bis zu ihrem ersten `update()` keine Instanz — `instanceCount` beginnt bei
     0, auch gebaut aus einer `BufferGeometry`. Im TSDoc von `update()` (`:599-608`) den ersten Satz so
     ergänzen, dass er sagt: bis zum ersten Aufruf ist `instanceCount` 0.
  4. **`asInstancedCopySource.ts:7-10`.** Der Satz »`InstancedVOBufferGeometry#update()` writes its own
     `instanceCount` from the instanced pool before the first frame is drawn.« verspricht, was niemand
     sicherstellt. Ersetzen durch: der Konstruktor von `InstancedVOBufferGeometry` setzt `instanceCount`
     nach dem `copy()` auf 0, und `update()` nimmt ihn aus dem Instanz-Pool. Der Verweis auf
     `threeVertexLayout.spec.ts` bleibt; der Test dort (`:89-93`) hält three's Verhalten fest und bleibt
     unverändert.
  5. **`StageDirector.ts`, TSDoc von `precompile()`** (`:1349-1353`, der Absatz »The stages of
     `options.layers` draw once, off screen, as the director draws a layer …«): einen Satz anfügen —
     der Draw ist kein Frame dieser Stages: kein `updateFrame()`, kein `OnStageUpdateFrame`; Sprites,
     deren erstes `update()` auf dieses Event wartet, zeichnen dort keine Instanz, ihr Material baut
     trotzdem. Kein Code in `StageDirector.ts`.
  6. **Guides.** `docs/stages.md` § »No hitch on the first transition«, Absatz `:806-810` (»… the
     stages in `layers` draw once, off screen, as the director draws a layer …«): derselbe Satz wie in
     Schritt 5, in der Sprache des Guides. `docs/sprites.md` § »Uploads: static and dynamic
     attributes«, erster Satz `:1181`: davor oder darin sagen, dass ein Mesh bis zu seinem ersten
     `update()` keines seiner Sprites zeichnet und `update()` setzt, wie viele es zeichnet. In
     `src/vertex-objects/README.md`, Absatz `:86-89` (»A generated setter marks nothing for upload …«):
     ein Satz, dass eine *instanzierte* Geometrie bis zu ihrem ersten `update()` keine Instanz zeichnet
     (`instanceCount` beginnt bei 0). Nur instanziert: `VOBufferGeometry` zeichnet vor dem ersten
     `update()` über die Draw-Range `Infinity`, die bleibt.
  7. **CHANGELOG.** Unter `## [Unreleased]` → `### Fixed` (Skill `updating-changelog`), im Stil der
     Einträge dort (Gegenwart, was jetzt gilt): eine `InstancedVOBufferGeometry` — damit die Geometrie
     von `FeatureSprites` und `InstancedVertexObjectGeometry` — zeichnet vor ihrem ersten `update()`
     keine Instanz, unter WebGPU wie unter WebGL 2, auch gebaut aus einer `BufferGeometry`; so zeichnet
     `StageDirector#precompile()` eine Stage aus `layers`, deren Sprites auf ihr erstes `update()` warten,
     ohne Fehler aus `drawIndexed()`. Nichts **BREAKING**, keine Migration.
  8. **Mitziehen, falls nötig.** Ein Spec oder Browser-Test, der `instanceCount` vor dem ersten
     `update()` als `Infinity` oder `undefined` erwartet, gibt es nach der Suche im Zug 0 nicht
     (`grep -rn instanceCount` über `src/` und `packages/twopoint5d-testing/test/`: alle Erwartungen
     nach einem `update()`); taucht im Gate doch einer auf, wird er mitgezogen und im Report genannt.
- Verify: `pnpm run ci && bash -c 'pnpm lookbook:generate-previews --only=stage-transitions-gallery,stage-transitions-game-menu --strict; s=$?; mkdir -p /tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-21-previews && cp apps/lookbook/public/images/demo-preview/stage-transitions-gallery.webp apps/lookbook/public/images/demo-preview/stage-transitions-game-menu.webp /tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-21-previews/; git checkout -- apps/lookbook/public/images/demo-preview/; exit $s'`
  — erst das Gate, danach (nie parallel, eine Sperre pro Checkout) der Vorschau-Generator für die
  zwei Seiten mit `--strict`: er scheitert an jedem `console.error`, also auch an dem von
  `catchPrecompile()`. Die zwei Bilder, die er schreibt, landen im Arbeitsverzeichnis, und der Baum
  wird danach zurückgesetzt — keine Vorschaubilder in diesem Commit (die Seiten zeigten auch mit
  gescheitertem `precompile()` dasselbe, die Shader bauten beim ersten Gebrauch). Der Implementierer
  führt den Generator-Teil nach seinem Fix einmal selbst aus, mit demselben Zurücksetzen.
- Commit: `fix(twopoint5d): let an instanced geometry draw no instance before its first update(), so precompile() draws a layer whose sprites wait for their first frame under WebGPU as well`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · Nebenbefund `precompile()` unter WebGPU besteht
    (`stage-transitions-gallery.astro:102-109`, `stage-transitions-game-menu.astro:163-166`), Ursache in
    der Library (`InstancedVOBufferGeometry`-Konstruktor ohne `instanceCount`), vorbestehend · Paket
    geteilt: sieben Einträge aus »Offene Befunde« samt 20 weiteren Seiten, `PerspectiveOrbitDemo.ts:29`
    und Regel im README nach 21b · keine offene Folge zu verteilen (alle `Folgen:`-Zeilen im Plan
    verteilt) · Restplan: 21b hinter 21
  - 2026-11-01 Zug 1: Implementierer beauftragt (sonnet, effort medium, `--dangerously-skip-permissions`),
    Brief `paket-21.impl-0.brief.txt`, Report `paket-21.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG (Session b660b85f; das `result` der JSON ist ein Nachsatz, der
    Report steht im Transkript der Session) · 10 Dateien laut Plan, nichts unter `apps/lookbook/` ·
    rot vor dem Fix: Vitest 2 (`Infinity`, `undefined`), Chromium WebGPU 2 (`drawIndexed … Value is
    infinite`), WebGL-2-Launcher grün · Abweichung: Browser-Test setzt `setTexCoords(0, 0, 1, 1)`, kein
    `setPosition()` · Arbeitsbaum schmutzig · Verify läuft (`paket-21.verify.log`)
  - 2026-11-01 Zug 2 (Verify): `paket-21.verify.log` exit=0 (Gate grün, Vorschau-Generator `--strict`:
    beide Seiten `ok ready`, Bilder in `paket-21-previews/`, Baum zurückgesetzt)
  - 2026-11-01 Zug 3: Reviewer (sonnet, effort medium) FREIGABE, Ziel und Schritte 1–8 erfüllt, vier
    kleine Befunde · Diff `paket-21.diff`, Report `paket-21.review-0.json`
  - 2026-11-01 Zug 4: keine Runde (nichts kritisch oder wichtig)
  - 2026-11-01 Zug 5: Commit ba93887b, Trailer `Remediation-Run: 2026-10-31`, Verify aus Zug 2 trägt ihn
    (keine Änderung danach) · Arbeitsbaum sauber

## Abgleich (Zug 0, 2026-11-01)

**`precompile()` unter WebGPU** — besteht. Fundstellen jetzt: Galerie `:102-109` (`catchPrecompile(…,
director.precompile(renderer, [...], {layers: [b.stage, ...mattes.maskStages]}))`), Spielmenü `:163-166`
(`{layers: [level.renderer, pause.stage]}`). Ursache, nach Lesen des Codes (nicht ausgeführt; der rote
Browser-Test in Schritt 1 belegt sie):

- `StageDirector#precompile()` zeichnet jede Stage aus `options.layers` über `#drawOffScreen()`
  (`src/stage/StageDirector.ts:2376-2381`): `stage.renderTo(renderer)` in einem Pass-Target, **ohne**
  `updateFrame()`. Kein `OnStageUpdateFrame` geht hinaus.
- Galerie: `GalleryScene#ships` (`apps/lookbook/src/demos/stage-transitions/GalleryScene.ts:101-114`)
  bekommt sein erstes `update()` erst im Listener von `OnStageUpdateFrame` (`:116-124`); `#chrome`
  ruft `update()` im Konstruktor (`:99`). `b.stage` ist eine solche Szene. Die Masken-Stages der
  Mattes rufen `#blots.update()` im Konstruktor (`matteMasks.ts:63`).
- Spielmenü: `GameLevel#ships`/`#shots` (`GameLevel.ts:97-126`) bekommen ihr `update()` nur in
  `#update()` (`:264-265`), das `OnStageUpdateFrame` (`:139`) oder `reset()` ruft — `reset()` erst bei
  `start()`. `#text` und die beiden Sprite-Meshes von `PauseMenu` (`PauseMenu.ts:47-48`) sind im
  Konstruktor aktualisiert.
- Eine `InstancedVOBufferGeometry` vor ihrem ersten `update()` trägt three's Startwert
  `instanceCount = Infinity` (gebaut aus einer `BufferGeometry`: `undefined`, `copy()` übernimmt den
  fehlenden Wert, `threeVertexLayout.spec.ts:89-93`). Der Konstruktor (`InstancedVOBufferGeometry.ts:124ff.`)
  setzt ihn nicht; nur `update()` (`:611`) tut es.
- three 0.187.0 reicht ihn durch: `RenderObject#getDrawParameters()`
  (`node_modules/.pnpm/three@0.187.0/node_modules/three/build/three.webgpu.js:5869-5883`) übernimmt
  `geometry.instanceCount` und prüft nur auf `=== 0`; `WebGPUBackend#draw()` ruft
  `passEncoderGPU.drawIndexed(indexCount, instanceCount, …)` (`:50784`). `GPUSize32` ist
  `[EnforceRange]`, `Infinity` wirft den `TypeError` »Value is infinite«. Unter WebGL 2 geht
  `instanceCount > 1` an `drawElementsInstanced()` (`:34882`), dessen `GLsizei` aus `Infinity` still 0
  macht — darum sieht man den Fehler nur unter WebGPU. `undefined` zeichnet unter WebGPU eine Instanz
  (Default des optionalen Arguments), unter WebGL 2 einen nicht instanzierten Draw.
- Im normalen Frame tritt der Fehler nicht auf: eine Stage kommt erst mit `updateFrame()` vor
  `renderTo()` in den Stapel, ihre Sprites sind dann aktualisiert.

Einordnung: **vorbestehend.** An d9b648bf derselbe Konstruktor ohne `instanceCount`
(`git show d9b648bf:…/InstancedVOBufferGeometry.ts`: `instanceCount` nur in `update()`, `:603`) und
dasselbe Spielmenü (`:155` `{layers: [level.renderer, pause.stage]}`, `GameLevel.ts` seit d9b648bf
unberührt). Paket 13 hat mit `layers: [b.stage, ...mattes.maskStages]` die Galerie als zweite Stelle
dazugebracht; die Ursache hat es nicht gesetzt. Keine Folge, kein `Folge von:`.

## Entscheidungen und Gründe

- **Fix in der Library, nicht im Lookbook.** Das Ziel im Plan verlangt es, wenn die Ursache dort liegt,
  und sie liegt dort: jeder Nutzer, der Sprites erst im Frame-Event aktualisiert und `precompile()` mit
  `layers` ruft, trifft denselben Fehler. Die Szenen des Lookbooks bleiben, wie sie sind; ein
  `update()` im Konstruktor dort wäre ein Workaround um einen Library-Fehler.
- **`instanceCount = 0`, nicht `instancedPool.usedCount`.** 0 heißt »bis zum ersten `update()` keine
  Instanz« — eine Regel, die sich ohne Zustand erklären lässt, und genau das Bild, das WebGL 2 heute
  zeigt. Der Zählerstand bei der Konstruktion wäre ein Wert, der danach mit keinem `createVO()` mehr
  mitläuft. Für die Geometrie aus einer `BufferGeometry` zeichnet WebGPU heute eine Instanz aus Slot 0,
  ob angelegt oder nicht; 0 beendet auch das.
- **Der Zweck von `precompile()` bleibt.** three baut die Pipeline in `Renderer#_renderObjectDirect()`
  über `this._pipelines.updateForRender(renderObject)` vor `backend.draw()`, und erst `draw()` fragt
  `getDrawParameters()` und überspringt 0 Instanzen. Das Material eines noch nicht aktualisierten
  Sprite-Meshes baut im Off-Screen-Draw also weiter — was der Kommentar im Spielmenü (`:161-162`)
  verspricht, stimmt danach.
- **Kein `updateFrame()` im Off-Screen-Draw.** Er feuerte `OnStageFirstFrame` und `OnStageUpdateFrame`
  einer Stage, die noch nicht zu sehen ist, und schöbe Animationen vor. Stattdessen sagen TSDoc und
  Guide, dass der Draw kein Frame der Stage ist.
- **Die Draw-Range bleibt.** `VOBufferGeometry` und die Basis-Pool-Seite der instanzierten Geometrie
  zeichnen vor dem ersten `update()` über die Draw-Range `{start: 0, count: Infinity}`; three klemmt sie
  an die Indexzahl, nichts wirft, und `vertex-buffers-geometry-updates.spec.ts:446` hält genau diesen
  Stand fest. Bei 0 Instanzen ist sie ohnehin ohne Wirkung. Kein Nebenbefund: ein Fehler ist das
  nicht, nur ungenutzte Vertices aus Nullen.
- **Regressionstests auf zwei Ebenen.** Vitest hält den Startwert (beide Konstruktorpfade), der
  Browser-Test in `vertex-objects-gpu-upload.test.js` den Draw der Geometrie selbst, der in
  `stage-transitions.test.js` den gemeldeten Weg über `precompile()`. AGENTS.md verlangt für
  GPU-Buffer-Code beide Oberflächen.
- **Kein Vorschaubild im Commit** (wie in Paket 13b entschieden): der Generator läuft nur als Probe mit
  `--strict`.
- **Modell mittlere Stufe, Effort medium:** ein lokaler Bugfix mit benannter Stelle und
  Regressionstests; der Blast Radius ist durchsucht (alle `instanceCount`-Erwartungen in Specs und
  Browser-Tests stehen nach einem `update()`).
- **Commit `fix(twopoint5d)`** mit `### Fixed`: `InstancedVOBufferGeometry` und `FeatureSprites` sind
  öffentlich (`src/vertex-objects/public-api.ts:1`, `src/sprites/public-api.ts:43`).

## Schnitt: Paket 21b

Die Drain-Runde hatte in Paket 21 außerdem sieben Lookbook-Einträge überführt (`textured-sprites`,
`rope-bridge`, `ui-panels`, `animated-billboards` ohne vollständigen Dispose-Pfad; fehlende
`isDisposed`-Prüfungen in Galerie und Spielmenü; der Portal-Readout; die zwei Casts in
`matte-threshold`). Der Abgleich zeigt dieselbe Ursache — eine Demo-Seite gibt beim `dispose()` ihres
Displays nicht frei, was sie baut, und meldet ihre Listener nicht ab — auf 20 weiteren Seiten und in
`PerspectiveOrbitDemo.ts:29` (`OrbitControls` am Canvas, nie `dispose()`, 15 Seiten), alle vorbestehend
(an d9b648bf ebenso, 17 der Seiten seither ohne Commit). Drei Stellen einer Ursache sind ein Paket; zwei
Dutzend Seiten Lookbook-Hygiene neben einem Library-Fix mit Browser-Tests sind zwei. Deshalb geteilt:
dieses Paket behält den Library-Fix, 21b bekommt die Seiten samt der zwei kleinen Einträge (Readout,
Casts), die nur die Seite mit ihnen teilen. Fundstellen und Ziel von 21b stehen im Plan; sein eigener
Zug 0 liest die Seiten.

## Triage

- `Folgen:`-Zeilen erledigter Pakete: alle verteilt (Paket 1 → 14, 4 → 6, 5 → 15, 11 → 16, 18 → 22),
  die übrigen »keine«. Nichts zu verteilen.
- »Offene Befunde«, offen: `DisplayFullscreen.ts` `#holdsTarget()`/`#turned()` (Paket 18),
  `docs/display.md:510-511`/`#declined` (Paket 18), handgesetzte Anführungszeichen in `src/` (Paket 19,
  `→ Rückfrage`). Keiner teilt die Ursache dieses Pakets; sie bleiben.
- Neue Nebenbefunde dieses Zugs: die 20 Seiten und `PerspectiveOrbitDemo.ts:29` — gleiche Ursache wie
  die Dispose-Einträge, deshalb in 21b statt in »Offene Befunde«.

## Nebenbefund im Volltext

**`apps/lookbook/src/pages/demos/stage-transitions-gallery.astro:102-104` und
`stage-transitions-game-menu.astro:163-165` · medium · aus Paket 13b (Runde 0)** —
`director.precompile()` scheitert im Vorschau-Generator unter WebGPU mit `TypeError: Failed to execute
'drawIndexed' on 'GPURenderPassEncoder': Value is infinite` (»--strict fails them«); an 353a7dbd
vorhanden (Vorher-Lauf von 13b), an d9b648bf nicht geprüft — Paket 13 hat die `layers` des
`precompile()` der Galerie geändert, also möglicherweise Folge von Paket 13 · → Scope · überführt in
Paket 21 (Drain-Runde, 2026-11-01).
Ziel aus dem Plan: `precompile()` der Transition-Seiten läuft unter WebGPU durch (Ursache geklärt; liegt
sie in der Library, wird sie dort behoben).

## Urteil des Reviewers (Zug 3)

- Nebenbefund `precompile()` unter WebGPU: **behoben** — `InstancedVOBufferGeometry.ts:196-201`
  (`this.instanceCount = 0` als letzte Anweisung im `try`, hinter `copy()`); belegt durch den
  Vorschau-Generator mit `--strict` für beide Seiten und die Browser-Tests in
  `stage-transitions.test.js` und `vertex-objects-gpu-upload.test.js`
- Schritte: 1 Regressionstests (`vertex-buffers-geometry-updates.spec.ts` zwei Tests,
  `stage-transitions.test.js`, `vertex-objects-gpu-upload.test.js`), 2 Fix, 3 TSDoc (`:119-120`,
  `:608`), 4 `asInstancedCopySource.ts:8-9`, 5 TSDoc `precompile()`, 6 Guides und README,
  7 CHANGELOG `### Fixed`, 8 nichts mitzuziehen — alle erfüllt

### Kleine Befunde

- `InstancedVOBufferGeometry.ts:608-609`: TSDoc von `update()` bricht unregelmäßig um (eine Zeile ≈ 140 Zeichen)
- `docs/stages.md` um `:798-805`: eine Zeile deutlich länger als die Nachbarn
- `docs/sprites.md:1174-1175`: der neue Satz steht vor »`update()` of the mesh uploads …« und liest sich
  dadurch holprig; eigener Absatz oder dahinter wäre glatter
- `docs/proposals/pool-groups.md:37`, `docs/proposals/sprite-features.md:128`: geprüft, stimmen weiter

### Gemeldet vom Implementierer, nicht übernommen

- `InstancedVOBufferGeometry.ts:109-123`: Reihenfolge im TSDoc des Konstruktors (Attribut-Kollision,
  Draw-Range, `@throws`) — vom Implementierer selbst als Stil ohne Fehler eingeordnet; kein Befund,
  deshalb nicht in »Offene Befunde«
