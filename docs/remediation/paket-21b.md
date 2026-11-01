# Paket 21b — Drain: Lookbook — Dispose-Pfade der Demo-Seiten, isDisposed nach await, ein Readout und zwei Casts

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nebenbefunde aus »Offene Befunde«, im Zug 0 von Paket 21 hierher abgeteilt; Volltext unten)
- Ziel: Jede Demo-Seite gibt beim `dispose()` ihres Displays frei, was sie baut, und meldet jeden Listener ab, den sie anmeldet; nach einem `await` und in einem `then` prüft sie `isDisposed`, bevor sie weiterbaut; »Adding a demo« nennt die Regel; der Portal-Readout heißt nach dem, was er liest, und `matte-threshold` reicht lil-gui Kopien statt Casts.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `apps/lookbook/src/demos/utils/PerspectiveOrbitDemo.ts`
  - Seiten unter `apps/lookbook/src/pages/demos/`: `animated-billboards`, `animated-sprites`, `atlas-frames-on-meshes`, `boomer-shooter-corridor`, `cardboard-parade`, `crosses`, `display-minimal`, `first-sprite`, `instanced-quads`, `map2d-cam-visi`, `platformer`, `quadtree-playground`, `rope-bridge`, `sine-scroller`, `sprite-reflection`, `stage-masks-flashlight`, `stage-masks-frozen`, `stage-masks-heat-haze`, `stage-masks-matte-3d`, `stage-masks-matte-ink`, `stage-masks-matte-threshold`, `stage-masks-portal`, `stage-masks-resolution`, `stage-masks-rift`, `stage-masks-shared`, `stage-masks-spotlight`, `stage-nested-pipelines`, `stage-postprocessing`, `stage-projections`, `stage-transitions-gallery`, `stage-transitions-game-menu`, `swaying-grass`, `textured-quads`, `textured-quads-from-texture-atlas`, `textured-quads-from-tileset`, `textured-sprites`, `ui-panels`, `vector-balls` (je `.astro`)
  - Demo-Module: `src/demos/map2d/map2d-cam-visi.ts`, `map2d-rect-visi.ts`, `map2d-tile-sprites.ts`, `src/demos/atlas-frames-on-meshes/NightCity.ts`, `src/demos/quadtree-playground/QuadTreeVisualization.ts`, `src/demos/platformer/assets.ts`
  - `apps/lookbook/README.md` (»Adding a demo«)
  - nicht: Library-Code, CHANGELOG, Vorschaubilder, `display-multi.astro`, `stage-masks-without-director.astro` (beide vollständig, siehe Abgleich)
- Vorgehen: siehe »Vorgehen« unten (Schritte 1–9)
- Verify: `pnpm run ci && node /tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-21b-probe/disposeProbe.mjs` — beide mit Exit 0, nacheinander, nie parallel (die Probe startet ihr eigenes `astro preview` auf dem `dist/` aus dem Gate)
- Commit: `fix(lookbook): free what each demo page builds and take off every listener it adds when its display is disposed, ask isDisposed after each await of a start, name the portal readout after the stage it reads and hand lil-gui copies instead of casts`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · die sieben Nebenbefunde unverändert an ihren Zeilen (Abgleich unten), `PerspectiveOrbitDemo.ts:29` unverändert · Inventur aller 42 Seiten: 38 Seiten und 7 Module (`PerspectiveOrbitDemo` eingeschlossen) ändern sich, `display-multi` und `stage-masks-without-director` sind vollständig · im Zug 0 dazu (gleiche Ursache): die frühen Rücksprünge, die Gebautes der Modulebene liegen lassen, die Ladefehler, die den Store der Seite liegen lassen (README-Regel aus Paket 13b), `assets.ts` des Platformers · dazu (vorbestehend, an d9b648bf ebenso; nötig für den Ladefehler-Schritt): `animated-sprites.astro:55`, `sprite-reflection.astro:65` hängen ihr asynchrones Init an `onDemoInit()` vorbei · offene Folgen: keine im Plan (alle `Folgen:`-Zeilen verteilt); die drei offenen Einträge in »Offene Befunde« teilen die Ursache nicht · Restplan unverändert
  - 2026-11-01 Zug 1: Implementierer beauftragt (opus, Effort medium), Report nach `paket-21b.impl-0.json`; ein Fehlstart ohne Brief (relativer Pfad) liegt als `paket-21b.impl-0-versuch-1.*`
  - 2026-11-01 Zug 2: Report FERTIG_MIT_VORBEHALT (ein RenderTarget auf vier Director-Seiten nicht zugeordnet) · 46 Dateien geändert (38 Seiten, 7 Module, README) · Probe rot vorher 43 PASS / 38 FAIL / 3 n/a (`paket-21b.probe-red.log`) · eigener Verify `paket-21b.verify.log`: Gate grün, Probe 81 PASS / 0 FAIL / 3 n/a, exit=0 · Arbeitsbaum schmutzig
  - 2026-11-01 Zug 3: Reviewer beauftragt (opus, Effort medium), Diff `paket-21b.diff`, Report nach `paket-21b.review-0.json`
  - 2026-11-01 Zug 3: Urteil FREIGABE · alle Punkte aus Schritt 2–8 und alle sieben Nebenbefunde erfüllt · keine kritischen oder wichtigen Befunde · ein kleiner (nur die Probe)
  - 2026-11-01 Zug 4: keine Runde nötig
  - 2026-11-01 Zug 5: committet als 4d959c08 (46 Dateien), getragen vom Verify `paket-21b.verify.log` (exit=0), Baum seither unverändert

## Urteil des Reviewers (Zug 3, `paket-21b.review-0.json`)

FREIGABE. Erfüllung je Nebenbefund:

| Nebenbefund | Urteil | Fundstelle nach dem Commit |
| --- | --- | --- |
| `matte-threshold`: zwei `as unknown as` | behoben | `stage-masks-matte-threshold.astro:156`, `:160` (`[...SOFTNESS]`, `[...SONAR_KINDS]`) |
| `textured-sprites`: Prüfung, `onDispose`, anonymer Listener, Kommentar | behoben | `textured-sprites.astro:41-98` |
| `rope-bridge`: vier Canvas-Listener | behoben | `rope-bridge.astro:128-170`, `abort()` `:170`, `stage.dispose()` `:177` |
| `ui-panels`: Listener, `StageRenderer` | behoben | `ui-panels.astro:64`, `:144-186` |
| Galerie/Spielmenü: `finished.then`, `preview.ready()` | behoben | Galerie `:137`, `:147`, `:218`; Spielmenü `:195` |
| Portal-Readout | behoben | `stage-masks-portal.astro:187` (`maskOf(moor)`) |
| `animated-billboards`: Dispose-Pfad | behoben | `animated-billboards.astro:69`, `:132` |
| Zusatz `PerspectiveOrbitDemo.ts:29` | behoben | `PerspectiveOrbitDemo.ts:33-34`, TSDoc `:11-15` |

Tabellen Schritt 4–7, Schritt 6 (`QuadTreeVisualization.ts:28`, `NightCity.ts:243`, `assets.ts:53-62`) und der README-Absatz (`apps/lookbook/README.md:77-90`): erfüllt, Fundstellen im Report.

Kleine Befunde:
- Nur die Probe (`paket-21b-probe/disposeProbe.mjs`, `MARK_THREE` ab `:166`): markiert three-Objekte erst direkt vor dem Dispose, ein vorher schon freigegebenes, über three-Caches erreichbares Objekt erscheint als »not disposed«. So das RenderTarget auf `stage-masks-heat-haze`, `stage-masks-matte-3d`, Galerie und Spielmenü: das `passTarget` von `StageDirector#precompile()` (`packages/twopoint5d/src/stage/StageDirector.ts:1391-1397`), freigegeben im `finally` `:1444-1446`, erreichbar nur noch über `outputTarget` der RenderObjects und den Renderer-State (nachgemessen in `scratchpad/review-21b-rt/probe-rt.mjs`). Kein Befund der Seiten, keiner der Library.

Abweichungen des Implementierers (Report `paket-21b.impl-0.json`), vom Reviewer mitgetragen: Material der drei `textured-quads`-Seiten über einen Cast auf das Node-Material (`VertexObjects#material` ist `Material | Material[] | undefined`); `stage-projections` gibt die `PlaneGeometry` hinter der `EdgesGeometry` mit frei; `instanced-quads`, `stage-nested-pipelines`, `stage-postprocessing` holen Material, Pipelines und Builder in eigene `const`s.

## Abgleich (2026-11-01, Stand ba93887b; `apps/lookbook/` seit e68e11b7 unberührt)

Die sieben Nebenbefunde aus »Offene Befunde« stehen alle noch an ihren Zeilen oder um wenige verschoben:

| Nebenbefund | Fundstelle jetzt | Einordnung |
| --- | --- | --- |
| `textured-sprites.astro`: anonymer `pointerdown`, kein `onDispose`, Kommentar »the sprites were disposed« | `:55`, `:69-70`, kein `onDispose` | unverändert |
| `rope-bridge.astro`: vier anonyme `canvas`-Listener, `onDispose` meldet keinen ab | `:124`, `:130`, `:135`, `:136`; `onDispose` `:152` | unverändert |
| `ui-panels.astro`: drei anonyme `canvas`-Listener, `StageRenderer` nie freigegeben | `:139`, `:142`, `:143`; `new StageRenderer(display)…` `:63` ohne Referenz; `onDispose` `:167` | unverändert |
| `animated-billboards.astro`: kein `onDispose`, kein `isDisposed` nach `await` | `demo.start(async …)` `:54-122`, Store `:61`, `bakeDataTexture` `:73`, Boden `:99-114` | unverändert |
| `stage-transitions-gallery.astro`/`-game-menu.astro`: `finished.then` ohne Prüfung, `preview.ready()` nach `await precompiled` ohne Prüfung | Galerie `:127`, `:148` (`nextEffect` `:136-141`), `:209-210`; Spielmenü `:192-193` | unverändert; die elf Masken-Seiten prüfen an derselben Stelle (`stage-masks-rift.astro:224-226`) |
| `stage-masks-portal.astro`: Readout `maskOf(other)` liest `maskOf(moor.stage)` | Label `:184`, Wert `:73` | unverändert; auf der Seite gibt es kein `other` |
| `stage-masks-matte-threshold.astro`: zwei `as unknown as` | `:153` (`SOFTNESS`, Deklaration `:68`), `:157` (`SONAR_KINDS`, `src/demos/stage-masks/Sonar.ts:39`) | unverändert |
| Dazu aus Zug 0 von 21: `PerspectiveOrbitDemo.ts:29` (`OrbitControls`, nie `controls.dispose()`) | `:29`, 15 Seiten bauen darauf | unverändert |

Inventur aller 42 Seiten (fünf lesende Agenten, Seiten und importierte Demo-Module ganz gelesen, Library-Klassen nachgeschlagen). Was die Library tut und was nicht, gilt für jeden Schritt unten:

- `Display#dispose()` (`packages/twopoint5d/src/display/Display.ts:2009-2065`) setzt `isDisposed` (`:2011`) vor `OnDisplayDispose` (`:2038`), wirft danach mit `off(this)` (`:2042`) jeden Listener der eigenen Events weg — `display.onRenderFrame()`, `onResize()`, `onInit()`, `on(display, …)` brauchen keine Abmeldung — und gibt den Renderer frei. Sonst nichts: kein Store, keine Stage, kein Material, kein `OrbitControls`. `onDispose()` ist ein `once()` (`:2237`), nach dem Dispose angemeldet hört es nichts mehr.
- `StageRenderer#dispose()` (`src/stage/StageRenderer.ts:1360-1407`, TSDoc `:1317-1328`) lässt seine Stages nur los und gibt weder Pipeline noch `buildOutputNode`-Builder noch Stages frei. `Stage2D#dispose()` (`src/stage/Stage2D.ts:566-590`) gibt den Pass-Node frei und wirft die `on(stage, …)`-Listener weg. `StageDirector#dispose()` (`src/stage/StageDirector.ts:1462-1504`): »The stages and the effects stay the caller's«.
- `FeatureSprites#dispose()` (`src/sprites/FeatureSprites/FeatureSprites.ts:744-779`) gibt Geometrie und Material nur frei, wenn es sie selbst gebaut hat (`:354`, `:768`, `:772`); übergebene Geometrie, Material und Texturen bleiben beim Aufrufer.
- `FrameBasedAnimations#bakeDataTexture()` (`src/texture/FrameBasedAnimations.ts:728-729`) und `TextureFactory#load()` (`src/texture/TextureFactory.ts:366`) übergeben eine Textur, die der Aufrufer freigibt. Was ein `TextureStore` ausgibt, ist geliehen und geht mit `store.dispose()`.
- `SpritePicker#dispose()` (`src/sprites/SpritePicker.ts:546-559`) lehnt jeden laufenden `pick()` ab (`:550-551`).
- three: `OrbitControls#dispose()` → `disconnect()` nimmt die Listener am Canvas und am Dokument ab; lil-gui `gui.destroy()` entfernt das DOM des Panels und beendet die `.listen()`-Schleifen. `Scene`, Kameras, `Light`, `Group`, `Fog`, Projektionen und `Sprite` (teilt eine Modul-Geometrie) halten nichts Freizugebendes.

Ergebnis je Seite steht in Schritt 4 bis 7. Ohne Änderung bleiben `display-multi.astro` (je Display Stage, Renderer, Textur, Material frei in `:115-120`, keine Listener) und `stage-masks-without-director.astro` (vollständig, `:74-83`).

## Entscheidungen und Abweichungen (Zug 0)

1. **Gleiche Ursache, im Zug 0 dazu.** Die Ursache des Pakets ist: eine Demo-Seite hat keinen vollständigen Freigabepfad für das, was sie baut. Dazu gehören neben den aufgezählten Stellen
   - die frühen Rücksprünge nach einem `await`, die nur den Store freigeben, während die Seite vorher auf Modulebene schon Director, Masken, Mattes, Renderer, Pipelines oder Controls gebaut hat (Galerie `:66-69`, Spielmenü `:53-56`, `boomer-shooter-corridor.astro:110-113`, die elf Masken-Seiten, `swaying-grass` ganz ohne Prüfung) — und der Fall, dass das Display vor dem Init entsorgt wird, in dem dieselben Objekte nie freikommen;
   - der Ladefehler nach dem Bau des Stores: `apps/lookbook/README.md:75` (Paket 13b) sagt »a loader that fails disposes the store it built«, und die Seiten, die `loadTextureCatalog()`/`new TextureStore()` selbst rufen und danach `getAsync()` awaiten, lassen den Store bei einer Ablehnung liegen; dasselbe in `src/demos/platformer/assets.ts:76-107` für die schon gebackenen `animsMap`;
   - `stage-postprocessing.astro:43-51` lädt dasselbe Bild 80-mal als eigene Textur; die Seite meint eine geteilte Textur, und ihre Freigabe wird damit eine Zeile statt 80.
2. **Zwei Seiten an `onDemoInit()` vorbei, hier mitgenommen.** `animated-sprites.astro:55` und `sprite-reflection.astro:65` hängen ihr asynchrones Init als `on(demo, OnDisplayInit, async …)` an — vorbestehend (an d9b648bf dieselben Zeilen), gegen die Regel »An `onInit` that awaits goes through `onDemoInit(…)`« (`apps/lookbook/README.md:63-66`, Paket 13), deren Umstellung beide nicht erfasst hat (sie suchte `onInit(async`). Aufgenommen, weil dieses Paket es sonst nicht sauber schließt: der Ladefehler-Schritt (Entscheidung 1) gibt den Store frei und wirft weiter, und nur unter `onDemoInit()` landet dieser Wurf in der Meldung der Seite statt als unbehandelte Ablehnung eines Listeners, auf den niemand wartet. Dieselbe Zeile, kein eigenes Paket.
3. **Zwei `onDispose`-Ebenen.** Was eine Seite synchron auf Modulebene baut (vor `start()`), gibt ein `display.onDispose()` frei, das direkt nach dem Bau auf Modulebene steht — Vorbild `rope-bridge.astro:158-163`, `sine-scroller.astro:80-84`. Was das Init nach seinen `await` baut, gibt das `onDispose()` am Ende des Inits frei. Nur so kommt das Gebaute der Modulebene auch dann frei, wenn das Display während des Ladens oder vor dem Init entsorgt wird. Die Reihenfolge verschiebt sich dadurch: der Director einer Masken-Seite wird vor Cycler, Masken und Szenen entsorgt (die erste Anmeldung hört zuerst). Das ist unschädlich: `director.dispose()` lässt die Stages nur los, und die `finished`-Reaktionen der abgebrochenen Transitionen laufen als Microtask nach dem ganzen `dispose()`, wenn auch `cycler.dispose()` durch ist.
4. **Listener.** Eine Seite, die ihre Handler schon benennt und mit `removeEventListener` abmeldet, bleibt dabei. Anonyme Listener gehen über das `signal` eines `AbortController` der Seite (`const listening = new AbortController();` … `{signal: listening.signal}` … `listening.abort()` als erste Zeile des `onDispose`) — das Muster steht in `src/demos/boomer-shooter-corridor/CorridorWalker.ts:50-65`, es meldet jeden auf einmal ab und braucht keinen Namen je Pfeilfunktion.
5. **`start(async …)` bleibt.** Acht Seiten und die drei map2d-Module laden im Callback von `demo.start(async …)`. Sie bekommen die Prüfung nach dem `await` und ihr `onDispose` im Callback, die Form bleibt: `Display#start()` lehnt nach einem `dispose()` während des Callbacks ab (TSDoc `Display.ts:1910-1914`, `:1933`), wie es das bei jeder Seite während des Wartens auf den Renderer tut — das ist der Vertrag der Library, keine Lücke der Seite. Eine Umstellung auf `onDemoInit()` änderte, wann der erste Frame zeichnet, und ist für die Freigabe nicht nötig.
6. **Nicht Teil dieses Pakets, mit Grund:**
   - die Debug-Globals (`window.display`, `Object.assign(window, {display, director})`, `window.map2d` …): gewollte Griffe für die Devtools, wie die `console.log` der Seiten; ein entsorgtes Display bleibt so inspizierbar und hält keine GPU-Ressource mehr;
   - ein Wurf beim Bauen nach dem Laden (ein Konstruktor einer Szene): das ist ein gescheiterter Start, den `onDemoInit()` zeigt; jede Seite dafür atomar zu machen hieße `try`/`finally` um jeden Konstruktor. Der Ladefehler dagegen ist ein erwarteter Ausgang (Netz, 404) und steht schon in der README-Regel;
   - ein `onDispose`, dessen erster Aufruf wirft: `Display#dispose()` sammelt werfende Listener und wirft danach (`Display.ts:1996-2001`); ein werfendes `dispose()` einer Szene ist ein Fehler der Szene;
   - DOM-Zustand des eigenen Markups — Readouts, das `<img>` von `showTexturePreview()`, `canvas.style.touchAction`, Pointer-Capture, Stile der `caption` von `matte-threshold` —: hält keine Ressource;
   - `matte-3d.astro:152` `.finally(() => shatter.afterPrecompile())` und `stage-masks-shared.astro:131` `.finally(() => ink.takeDraws())`: schreiben nur CPU-Zustand eines entsorgten Objekts, bauen nichts;
   - die `click`-Listener der `RadioButtons`-Komponente (`src/components/RadioButtons.astro:41`): gehören der Komponente, nicht der Seite;
   - die Beschreibung in `_stage-masks-portal.json:4`: nennt die Slots nach ihrer Rolle (`[world, other, glaze]`), wie die von `stage-masks-rift`; nur das Label des Readouts nennt eine Variable.
7. **Kein Regressionstest im Repo** (das Lookbook hat keine Testoberfläche). Rot/grün belegt eine Probe außerhalb des Repos (Schritt 1), wie in Paket 12, 13 und 13b. Sie misst, was sich messen lässt: Listener, Fehler nach dem Dispose, nicht freigegebene three-Objekte. Ob jede Seite *alles* freigibt, prüft der Reviewer gegen die Listen in Schritt 4 bis 7.

## Vorgehen

### Schritt 1 — die Probe, vor jeder Änderung, rot sehen

Verzeichnis `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-21b-probe/` (außerhalb des Repos, nicht ins Repo kopieren), darin `disposeProbe.mjs` und eine `README.md` im Stil von `paket-13b-probe/README.md` daneben. Aufruf aus dem Repo-Root: `node <dir>/disposeProbe.mjs [--only=<id>,<id>] [--phase=after-start|during-load]` (ohne `--phase` beide). Voraussetzung: `apps/lookbook/dist` ist gebaut (`pnpm nx run lookbook:build`, oder das Gate).

- Imports: `playwright` über `createRequire('/home/spw/spaceland/twopoint5d/package.json')`; aus dem Repo per absolutem Pfad `startPreviewServer` (`scripts/lookbook/previewServer.mjs`), `chromiumGpuArgs`, `EVENT_GENERATE_PREVIEW` (`scripts/lookbook/demoPreviewConfig.mjs`), `listLookbookDemos` (`scripts/lookbook/lookbookDemos.mjs`). Chromium mit `chromiumGpuArgs()`, Viewport 1000×700. Ohne WebGPU-Adapter (wie `describeWebGpuAdapter()` in `generateDemoPreviews.mjs`) bricht die Probe mit Exit 2 ab.
- **Register (Init-Skript, `page.addInitScript`)**: `Error.stackTraceLimit = 50`; `EventTarget.prototype.addEventListener`/`removeEventListener` gewrappt, ein Register lebender Einträge `{target, type, listener, capture, stack}` mit `new Error().stack` bei der Anmeldung. `once` wird beachtet (Wrapper um den Listener, der den Eintrag löscht; `removeEventListener` mit dem Original findet ihn über eine `WeakMap` Original → Wrapper), ein `signal` ebenso (beim `abort` wird der Eintrag gelöscht, ein bereits abgebrochenes Signal meldet nichts an). Dazu `window.__probe = {errorsAfterDispose: false}` zum Umschalten.
- **Displays finden und entsorgen** (CDP, `context.newCDPSession(page)`): `Runtime.evaluate('Object.prototype')` → `Runtime.queryObjects({prototypeObjectId})` → `Runtime.callFunctionOn` auf dem Array mit einem Filter in `try`: `Object.hasOwn(o, 'onDispose') && Object.hasOwn(o, 'onRenderFrame') && typeof o.dispose === 'function' && typeof o.start === 'function' && 'isDisposed' in o && !o.isDisposed`; jedes Treffer-Objekt bekommt `dispose()` in `try`, ein Wurf ist ein FAIL der Seite mit seiner Meldung. `display-multi` hat sechs Displays, `stage-projections` zwei.
- **three-Objekte markieren** (nur Phase `after-start`, direkt vor dem Dispose, ebenfalls über `queryObjects`): jedes Objekt mit `isBufferGeometry`, `isMaterial`, `isTexture` oder `isRenderTarget === true` bekommt eine eigene `dispose`-Property, die es in ein `WeakSet` einträgt und die geerbte Methode ruft; die markierten Objekte merkt sich ein Array in `window.__probe`.
- **Phase `after-start`** je Seite (`<base>/demos/<id>/`): `pageerror` und `console`-Fehler mitschreiben; warten auf `EVENT_GENERATE_PREVIEW` am `document` (höchstens 30 s, wie der Generator), dann 500 ms. Ein Fehler bis hierher ist ein FAIL (»startet nicht sauber«, wie `--strict`). Dann markieren, entsorgen, 3 s warten (die Freigabe des Renderers wartet bis zu zwei Frames oder 2 s, `Display.ts:1972-1979`). Dann anstoßen: `keydown`/`keyup` für `ArrowLeft`, `ArrowRight`, ` `, `k`, `r` am `window`; `pointerdown`, `pointermove`, `pointerup`, `click`, `wheel` (Mitte des Elements) an jedem `<canvas>`; `click` an jedem Element, das das Register je mit einem `click`-Listener gesehen hat und das noch im Dokument steht. 1 s warten.
- **Phase `during-load`** je Seite: `page.route()` auf den ersten Request unter `<base>/assets/` (der Pfad von `assetsUrl()`, `src/demos/utils/assetsUrl.ts`); dort zuerst alle Displays entsorgen, dann `route.continue()`; danach 5 s warten, dann dasselbe Anstoßen. Kommt binnen 30 s kein Asset-Request, ist die Phase für die Seite »n/a« (kein FAIL).
- **FAIL einer Seite**, wenn nach dem Dispose
  1. ein `pageerror` oder `console.error` auftritt — ausgenommen eine Meldung mit `Display#start() is not available: this display has been disposed` (Vertrag, Entscheidung 5);
  2. ein lebender Listener an einem `<canvas>` hängt;
  3. ein lebender Listener an `window`, `document` oder einem verbundenen Element (`isConnected`) hängt, dessen Stack einen Frame aus dem Skript-Chunk der Seite trägt (`/_astro/<id>.astro_astro_type_script_`; Astro benennt so jedes Seitenskript, nachgesehen in `apps/lookbook/dist/_astro/`).
- **Bericht**, kein FAIL: je Seite die Zahl der markierten three-Objekte, deren `dispose()` nicht lief, mit `constructor.name`, `type` und `name` der ersten zehn. Im grünen Lauf bleiben nur Objekte, die keiner Seite gehören (geteilte Modul-Objekte von three oder der Library, Platzhalter), der Implementierer benennt im Report jede verbleibende Art.
- Ausgabe je Seite und Phase eine Zeile `PASS`/`FAIL`/`n/a` samt Gründen, am Ende die Summe; Exit 1 bei einem FAIL, sonst 0. Der Preview-Server geht im `finally` und bei einem Signal zu (wie `generateDemoPreviews.mjs:136-144`).

Lauf vor der Änderung: Log nach `<Arbeitsverzeichnis>/paket-21b.probe-red.log`. Erwartet rot u. a. jede Seite auf `PerspectiveOrbitDemo` (Listener von `OrbitControls` am Canvas), `rope-bridge`, `ui-panels`, `vector-balls`, `cardboard-parade`, `platformer`, `sine-scroller`, `boomer-shooter-corridor`, `textured-sprites`, `animated-sprites`, `sprite-reflection` (Listener), `cardboard-parade`/`vector-balls` in `during-load` (bauen nach dem `await` weiter). Der rote Lauf gehört mit Seitenliste und Gründen in den Report.

### Schritt 2 — `PerspectiveOrbitDemo`

`src/demos/utils/PerspectiveOrbitDemo.ts`: im Konstruktor direkt nach `this.controls.enableDamping = true;` (`:30`) die Zeile `this.onDispose(() => this.controls.dispose());` mit Kommentar, dass die Controls Listener an Canvas und Dokument tragen, die ein `Display` nicht kennt. Das Klassen-TSDoc (`:12-14`) neu fassen, in einem richtigen Satz: ein `Display` mit Szene, perspektivischer Kamera und Orbit-Controls auf transparentem Hintergrund; sein `dispose()` gibt die Controls mit frei, was eine Seite in die Szene legt, gibt die Seite selbst frei. Keine Seite ruft danach `controls.dispose()`.

### Schritt 3 — das Muster, das jede folgende Seite anwendet

```ts
// after the awaits of the start, before anything is built on them
const [atlas, texture] = await store.getAsync('vectorBalls', ['atlas', 'texture']).catch((error: unknown) => {
  // a loader that fails disposes the store it built
  store.dispose();
  throw error;
});
// a dispose() while the assets loaded has gone out already: nothing is built
if (demo.isDisposed) {
  store.dispose();
  return;
}
const listening = new AbortController();
button.addEventListener('click', onClick, {signal: listening.signal});
// … build …
demo.onDispose(() => {
  listening.abort();
  // what this init built, in reverse order of its use; what the store lent goes with the store
  mesh.dispose();
  store.dispose();
});
```

- Folgen mehrere `getAsync()` aufeinander, ohne dass dazwischen gebaut wird, werden sie zu einem `Promise.all([...])` mit einem `.catch` zusammengezogen; folgt ein `loadAsync()` vor dem `getAsync()`, wird daraus `store.loadAsync(url).then(() => store.getAsync(…)).catch(…)`. Eine Prüfung `isDisposed` nach dem letzten `await` genügt, wenn vorher nichts gebaut wird.
- Was vor dem ersten `await` gebaut wird und nur danach gebraucht wird, rückt hinter die Prüfung.
- Ein `then`-/`finally`-Callback, der Seitenobjekte anfasst, beginnt mit `if (display.isDisposed) return;`.
- Ein Seitenobjekt hat eine eigene `dispose()`, also ruft die Seite sie; eine geliehene Textur gibt die Seite nicht frei.
- Kommentare erklären *warum* (Konventionen des Plans), kein Rückblick.

### Schritt 4 — Seiten auf `PerspectiveOrbitDemo` (Controls kommen aus Schritt 2)

| Seite | Prüfung nach `await` und Ladefehler | freigeben im `onDispose` | Listener, Timer |
| --- | --- | --- | --- |
| `textured-sprites` (`onDemoInit`) | `getAsync` `:41` mit `.catch`, Prüfung danach | `sprites` (`:45`, baut Geometrie und Material selbst), `store` | `pointerdown` `:55` über `signal`. `:69-70`: `const spritePool = sprites.spritePool!;` mit dem Kommentar, dass ein `FeatureSprites` erst nach `dispose()` keinen Pool hat und dieses eben gebaut ist |
| `animated-billboards` (`start(async …)`) | `getAsync` `:62` und `:99` (`blueGround`) in ein `Promise.all` mit `.catch` vor allem Bauen; Prüfung danach; die Geometrie `:59` rückt dahinter | `mesh` (`:71`), `geometry` (übergeben, `FeatureSprites` gibt sie nicht frei), `animsMap` (`:73` in eine `const`, `bakeDataTexture`), `planeGeometry`, `planeMaterial`, `store` | — |
| `animated-sprites` | `on(demo, OnDisplayInit, async …)` `:55` → `onDemoInit(demo, 'animated-sprites', async …)` (Entscheidung 2; unbenutzte Imports raus); `loadAsync` `:73` + `getAsync` `:75` als `.then(…).catch(…)`, Prüfung danach; Geometrie `:61` rückt hinter die Prüfung | `mesh` (`:94`), `material` (`:88`, übergeben), `geometry` (`:61`, übergeben), `animsMap` (`:89` in eine `const`), `store` (nimmt `on(store, 'error')` `:65` mit) | `click` `:110`, `:115` über `signal` |
| `sprite-reflection` | wie `animated-sprites`: `:65` → `onDemoInit(demo, 'sprite-reflection', …)`; `:76`/`:77` als `.then(…).catch(…)`, Prüfung danach | `sprites` (`:93`), `geometry` (`:79`, übergeben), `animsMap` (`:95` in eine `const`), Geometrie und Material von `horizon` (`:114-117`), `store` | `click` `:130`, `:134` über `signal` |
| `atlas-frames-on-meshes` (`start(async …)`) | `Promise.all` `:65` mit `.catch`, Prüfung danach | die Stadt über `disposeNightCity(city)` (Schritt 6), `store` | — |
| `cardboard-parade` (`start(async …)`) | `getAsync` `:55`, `:56` in ein `Promise.all` mit `.catch`, Prüfung danach | `parade.dispose()` (`:58`, existiert in `CardboardParade.ts:428-437`), `store` | `click` `:65`, `:69` über `signal`; `setInterval` `:77` mit Id, `clearInterval` |
| `crosses` (synchrones `onInit`) | — | `geometry` (`:35`), `material` (`:49`); `VertexObjects` hat keine eigene Freigabe | — |
| `instanced-quads` (synchroner Start-Callback) | — | `geometry` (`:35`), `material` (`:92`), angemeldet auf der Ebene, auf der beide gebaut werden | — |
| `textured-quads` (`start(async …)`) | `getAsync` `:101` mit `.catch`, Prüfung danach | `mesh.geometry` und `mesh.material` — das Ergebnis von `createMesh(…)` (`:109`, baut Geometrie `:38` und Material `:79`, Mesh `:63`) kommt dafür in eine `const mesh`, bevor es in die Szene geht —, `store` | — |
| `textured-quads-from-texture-atlas` | `getAsync` `:77` mit `.catch`, Prüfung danach | `mesh.geometry`, `mesh.material` des Meshes aus `createTexturedQuads()` (`:44`; das Ergebnis in eine `const mesh`, falls es heute direkt in die Szene geht), `store` | — |
| `textured-quads-from-tileset` | `getAsync` `:83` mit `.catch`, Prüfung danach | `mesh.geometry` des Meshes aus `createTexturedQuads()` (das Ergebnis in eine `const mesh`, falls es heute direkt in die Szene geht), `material` (`:40`), `store` | — |
| `vector-balls` (`start(async …)`) | `getAsync` `:66` mit `.catch`, Prüfung danach | `picker` (`:100`), `vectorBalls` (`:68`, `VectorBalls.ts:340-346`), `store` | Modulebene: direkt nach `:54` `demo.onDispose(() => window.removeEventListener('resize', fitPixelZoom));`. Im Init: `click` `:77`, `:81`, `:86`, `:89`, `pointerdown` `:103`, `pointerup` `:106` über `signal`; `setInterval` `:93` mit Id, `clearInterval`. Im `pointerup`: `await picker.pick(…).catch((error: unknown) => { if (demo.isDisposed) return undefined; throw error; })` und danach `if (demo.isDisposed) return;` — `picker.dispose()` lehnt einen laufenden Pick ab |
| `map2d-cam-visi` (Modul `run`, `start(async …)`) | `src/demos/map2d/map2d-cam-visi.ts:47-48`: `getAsync` mit `.catch` (Store frei), danach `if (demo.isDisposed) { map2d.dispose(); store.dispose(); return; }` (`map2d` steht schon vor dem `await`) | das bestehende `once(demo, OnDisplayDispose, …)` `:108-118` bleibt | Seite `map2d-cam-visi.astro:50`: das Abmelden, das `cameraControl.onChange(…)` zurückgibt, in eine `const`, `app.onDispose(…)` ruft es (`Signal#onChange()` gibt es als `VoidFunc` zurück; das Signal lebt auf Modulebene von `src/components/RadioButtonsApi.ts`) |
| `map2d-rect-visi` | `map2d-rect-visi.ts:74-75` wie oben; der frühe Rücksprung gibt `helpers` (`:67`), `map2d` (`:55`) und die Punkte frei | `makePoints(…)` `:31` in eine `const points`, `points.geometry` und `points.material` im `once` `:119-130` und im Rücksprung | — |
| `map2d-tile-sprites` | `map2d-tile-sprites.ts:35-36` wie oben; der Rücksprung gibt `edges`, `geometry`, `line.material` (`:27-31`) frei | das bestehende `once` `:70-82` bleibt | — |

### Schritt 5 — Seiten mit eigenem `Display`

| Seite | Modulebene: `display.onDispose()` direkt nach dem Bau | Init: Prüfung, Ladefehler, `onDispose` | Listener, sonst |
| --- | --- | --- | --- |
| `rope-bridge` | das bestehende `:158-163` gibt zusätzlich `stage.dispose()` (`:75`) frei, nach Renderer, Builder, Pipeline | `Promise.all` `:91` mit `.catch` (Store frei); Prüfung `:99` bleibt | `pointerdown` `:124`, `pointermove` `:130`, `pointerup`/`pointercancel` `:135`/`:136`, `click` `:140`, `:144` über `signal`, `listening.abort()` als erste Zeile in `:152` |
| `ui-panels` | `new StageRenderer(display)…` `:63` in eine `const stageRenderer`; neues `display.onDispose(() => { stageRenderer.dispose(); stage.dispose(); })` danach | unverändert (`.catch` `:103-106`, Prüfung `:109`) | `pointermove` `:139`, `pointerdown` `:142`, `pointerup` `:143`, `click` `:149`, `:153`, `:157` über `signal`, `abort()` in `:167` |
| `boomer-shooter-corridor` | neues `display.onDispose()` nach `:98` für `walker`, `stageRenderer` (`:92`), `withGlow` (`:94`), `pipeline` (`:93`), `stage` (`:81`) — in dieser Reihenfolge; die vier, die heute im Init-`onDispose` `:173-182` stehen, gehen dort raus | `Promise.all` `:102` mit `.catch` (Store frei); Prüfung `:110` bleibt | `click` `:159`, `:162`, `:167` über `signal`; der Pick in `walker.onClick` `:131-133` fängt die Ablehnung nach dem Dispose wie bei `vector-balls` |
| `platformer` | — | unverändert | die drei `click` aus `toggle()` `:94` über `signal`, `abort()` in `:119`. `src/demos/platformer/assets.ts`: `loadSheet()` `:57-73` backt nichts mehr; ein synchrones `toSheet(parts)` backt `animsMap` erst, wenn `Promise.all` `:81-89` durch ist — eine Ablehnung lässt so keine gebackene Textur liegen |
| `sine-scroller` | das bestehende `:80-84` gibt zusätzlich `stage.dispose()` (`:67`) frei, als letztes | unverändert (`.catch` `:124-127`, Prüfung `:141`) | `click` `:171`, `:178`, `:182`, `:186` über `signal`, `abort()` im Init-`onDispose` `:192ff.` |
| `swaying-grass` (`start(async …)`) | neues `display.onDispose()` nach `:66` für `controls` (`:48`), `stageRenderer` (`:64`), `withGlow` (`:66`), `pipeline` (`:65`), `stage` (`:43`); dieselben gehen aus `:164-171` raus | `getAsync` `:74`, `:75`, `:76` in ein `Promise.all` mit `.catch`; danach `if (display.isDisposed) { store.dispose(); return; }`; im `onDispose` bleiben `gui`, `meadow`, `store` | — |
| `first-sprite` | — | `loadAsync` `:51` + `getAsync` `:52` als `.then(…).catch(…)` (Store frei); Prüfung `:56` bleibt | — |
| `display-minimal` (synchron) | `stageRenderer` (`:23`, Kette in eine `const`), `stage` (`:21`), `material` (`:33`), `texture` (`:31`), ein `onDispose` nach dem Bau | — | Globals bleiben (Entscheidung 6) |
| `stage-nested-pipelines` (synchron) | ein `onDispose` nach dem Bau: `root` (`:40`), `worldRenderer` (`:49`), der Bloom-Builder (`:53`), die Pipeline von `:52`, die `RootRenderPipeline` von `:89`, `worldStage` (`:46`), `uiStage` (`:76`), die 24 `SpriteMaterial` aus `:58` und das von `:78` (in einem Array gesammelt), `ballTexture`, `logoTexture` (`:30`, `:31`) | — | — |
| `stage-postprocessing` (synchron) | die Textur einmal vor der Schleife laden (Entscheidung 1), geteilt von den 80 `SpriteMaterial`; ein `onDispose` nach dem Bau: `stageRenderer` (`:30`), Builder (`:35`), Pipeline (`:34`), `stage` (`:28`), die 80 Materialien (`sprites[i].material`), die Textur | — | — |
| `quadtree-playground` (synchron) | ein `onDispose` nach `:57`: `gui.destroy()`, `visual.dispose()` (Schritt 6) | — | — |
| `stage-projections` | `setupPane()` (`:71-125`) gibt `{display, stage}` zurück; die Seite sammelt `stages` daraus. Das GUI (`:134`) gehört keinem der beiden Displays: es geht mit dem letzten — `let open = panes.length;` und je Display `display.onDispose(() => { open -= 1; if (open === 0) gui.destroy(); });` nach dem Bau des GUI | — | — |

### Schritt 6 — Demo-Module

- `src/demos/quadtree-playground/QuadTreeVisualization.ts`: neue Methode `dispose(): void { this.canvasStage.dispose(); }` mit TSDoc (gibt die `Canvas2DStage` frei, die Stage, Renderer, Canvas-Textur und Material baut; den übergebenen Renderer nicht).
- `src/demos/atlas-frames-on-meshes/NightCity.ts`: neue exportierte Funktion `disposeNightCity(city: Group): void` neben `makeNightCity()` (`:213`), mit TSDoc: gibt Geometrie und Material jedes `Mesh` der Stadt frei und ruft `dispose()` jedes `InstancedMesh` (seine `instanceMatrix`); die Atlas-Texturen gehören dem Store. Der Implementierer liest `NightCity.ts` ganz und prüft, dass jedes Mesh seine Geometrie und sein Material selbst baut (Straße `:94-108`, Gebäude `:150-154`, drei Ringe `:186-199`, Boden `:224`) und kein Material ein Array ist; teilen zwei Meshes eines, genügt ein `dispose()` (three verträgt das zweite).
- `src/demos/platformer/assets.ts`: siehe Schritt 5.
- map2d-Module: siehe Schritt 4.

### Schritt 7 — Seiten mit Director

- `stage-transitions-gallery.astro`: neues `display.onDispose()` auf Modulebene direkt nach `:53` für `director` (`:46`), die Masken aus `makeMasks()` (`:48`) und `mattes` (`:51`); dieselben Zeilen gehen aus dem Init-`onDispose` `:196-207` raus. Der frühe Rücksprung `:66-69` gibt neben dem Store `assets.dot` frei. `:127` `transition.finished.then((t) => {` und `nextEffect` `:136` beginnen mit `if (display.isDisposed) return;`. `:209-210` wird `await precompiled; if (display.isDisposed) return; preview.ready(display);`.
- `stage-transitions-game-menu.astro`: neues `display.onDispose(() => director.dispose());` direkt nach `:39`, `:183` geht raus; der Rücksprung `:53-56` gibt `assets.dot` mit frei; `:192-193` wie in der Galerie.
- Die elf Masken-Seiten: je `display.onDispose(() => director.dispose());` direkt nach `new StageDirector(…)`, und `director.dispose()` geht aus dem Init-`onDispose` raus (Entscheidung 3). Zeilen Bau/Freigabe: `flashlight` `:47`/`:206`, `frozen` `:36`/`:163`, `heat-haze` `:37`/`:119`, `matte-3d` `:48`/`:164`, `matte-ink` `:45`/`:155`, `matte-threshold` `:76`/`:225`, `portal` `:38`/`:208`, `resolution` `:82`/`:275`, `rift` `:43`/`:213`, `shared` `:37`/`:140`, `spotlight` `:53`/`:243`. Sonst bleiben diese Seiten, wie sie sind.

### Schritt 8 — Readout, Casts, README

- `stage-masks-portal.astro:184`: `.name('maskOf(other)')` → `.name('maskOf(moor)')` — der Wert (`:73`) liest `director.maskOf(moor.stage)`, das Label nennt die Variable wie in `stage-masks-rift.astro:187`.
- `stage-masks-matte-threshold.astro:153`: `SOFTNESS as unknown as number[]` → `[...SOFTNESS]`; `:157`: `SONAR_KINDS as unknown as string[]` → `[...SONAR_KINDS]`. `GUI#add()` nimmt eine veränderbare Liste; die Kopie trägt ohne Cast (`astro check` im Gate prüft es).
- `apps/lookbook/README.md`, »Adding a demo«, Schritt 2: nach dem Absatz über `TextureStore`/`fetchJson()` (`:71-75`) ein neuer Absatz, sinngemäß in diesen Worten:

  > Whatever the page builds, it frees in `display.onDispose()`: the store, the geometries, materials and textures it made — `bakeDataTexture()` and `TextureFactory#load()` hand theirs over —, stages, a `StageRenderer` or `StageDirector` with their pipelines and output node builders, sprites, a picker, a lil-gui panel. `StageRenderer#dispose()` lets go of its stages without disposing them, so the page disposes them too; a texture a store lent goes with the store. What the page builds before `display.start()` is freed by an `onDispose()` right after it is built, what the init builds after an `await` by one at the end of the init. Every listener the page puts on the canvas, the window, the document or an element of its markup comes off there as well — through the `signal` of an `AbortController` whose `abort()` the `onDispose()` calls; the display drops the listeners of its own events itself. After every `await` of its start the page asks `display.isDisposed` before it builds on, and frees what the `await` handed it; a `then` that touches the page asks first as well. `platformer.astro` and `rope-bridge.astro` show the pattern, and `PerspectiveOrbitDemo` frees its orbit controls itself.

  Umbruch und Ton der übrigen README, kein Rückblick.

### Schritt 9 — grün

`pnpm run ci`, danach die Probe ganz (beide Phasen, alle 42 Seiten): Log nach `<Arbeitsverzeichnis>/paket-21b.probe-green.log`, Exit 0. In den Report: rote und grüne Zusammenfassung, die im grünen Lauf verbleibenden three-Objekte je Art mit Begründung, jede Abweichung von diesem Plan mit Grund. `git status` zeigt danach keine Datei außerhalb der Liste oben (die Probe schreibt nichts ins Repo; `apps/lookbook/dist/` ist ignoriert).

## Nebenbefunde im Volltext (aus »Offene Befunde«)

- `apps/lookbook/src/pages/demos/stage-masks-matte-threshold.astro:197`/`:201` — `SOFTNESS as unknown as number[]` und `SONAR_KINDS as unknown as string[]` für lil-gui: zwei `as const`-Tupel (`:67`, `stage-masks/Sonar.ts:39`) gegen die veränderbaren Listen von lil-gui; `[...SOFTNESS]` bzw. `[...SONAR_KINDS]` schaltete die Typprüfung nicht ab; vorbestehend (an d9b648bf `:197`/`:201`) · aus Paket 12 (Zug 0) · info · → Scope
- `apps/lookbook/src/pages/demos/textured-sprites.astro:55`/`:70` — nach den `await` im `onInit` keine Prüfung auf `demo.isDisposed`, kein `onDispose`: `store` und die Sprites werden nie freigegeben, der anonyme `pointerdown`-Listener `:55` bleibt angemeldet; der Kommentar `:70` »the sprites were disposed« passt nicht zu einem eben gebauten Pool; vorbestehend (an d9b648bf `:54`) · aus Paket 13 (Runde 0) · low · → Scope
- `apps/lookbook/src/pages/demos/rope-bridge.astro:124`/`:130`/`:135` — die `canvas`-Listener (`pointerdown`, `pointermove`, `pointerup`, dazu der vierte) sind anonym und werden im `onDispose` `:152` nie abgemeldet, dasselbe Muster wie das Game-Menu vor Paket 13; vorbestehend (an d9b648bf vier `canvas.addEventListener`) · aus Paket 13 (Runde 0) · low · → Scope
- `apps/lookbook/src/pages/demos/ui-panels.astro:134`/`:137`/`:138`/`:62` — drei anonyme `canvas`-Listener ohne Abmeldung im `onDispose` `:162`; der `StageRenderer` aus `:62` wird nie freigegeben; vorbestehend · aus Paket 13 (Runde 0) · low · → Scope
- `apps/lookbook/src/pages/demos/stage-transitions-gallery.astro:127`/`:210` und `stage-transitions-game-menu.astro:193` — `transition.finished.then(…)` der Galerie prüft nicht auf `display.isDisposed` (anders als die übrigen Seiten), und nach `await precompiled` rufen beide Seiten `preview.ready()` ohne `isDisposed`-Prüfung; vorbestehend · aus Paket 13 (Runde 0) · low · → Scope
- `apps/lookbook/src/pages/demos/stage-masks-portal.astro:192` — der Readout heißt `maskOf(other)`, liest aber `maskOf(moor.stage)`; auf der Seite gibt es kein `other`; vorbestehend (an d9b648bf `:195`) · aus Paket 13 (Runde 0) · info · → Scope
- `apps/lookbook/src/pages/demos/animated-billboards.astro:54-116` — kein Dispose-Pfad: `demo.start()` ohne `onDispose`, der Store aus `loadTextureCatalog()` (`:61`), Geometrien, Materialien und die Bodentextur (`:99`) werden nie freigegeben; vorbestehend (an 353a7dbd schon ohne `onDispose`) · aus Paket 13b (Runde 0) · low · → Scope
- Dazu aus dem Zug 0 von Paket 21 (gleiche Ursache, an d9b648bf ebenso): `PerspectiveOrbitDemo.ts:29` (`OrbitControls`, nie `controls.dispose()`), die Button-Listener von `rope-bridge` und `ui-panels`, die `Stage2D` von `rope-bridge` und `ui-panels`, die 17 Seiten ohne jedes `onDispose`, die Listener ohne Abmeldung in `boomer-shooter-corridor`, `platformer`, `sine-scroller`, die fehlende Regel in »Adding a demo«.
