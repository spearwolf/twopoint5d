# Paket 17 — Drain 2: Fehleranzeige der Demo-Inits über `start()`, Importreihenfolge und `readonly` an den Arrow-Feldern der Library

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Nebenbefunde (alle vorbestehend, aus »Offene Befunde« des Plans, Drain-Runde 2):
  1. Init als Callback von `display.start()` statt über `onDemoInit()` — acht Demo-Seiten
     und drei map2d-Module; eine scheiternde Init endet als unbehandelte Rejection ohne
     Namen der Demo und ohne Zeile über der Canvas (info)
  2. `Stage2D.ts:412` — Arrow-Feld `#updateProjection` ohne `readonly` (info); dazu in
     Zug 0 gleicher Ursache 17 weitere Arrow-Felder der Library (Liste in Schritt 7)
  3. `NeonSigns.ts:14` — `type FeatureSpritesOf` nicht einsortiert (info)
  4. `first-sprite.astro:21–22` — `~demos/utils/*`-Importe nicht alphabetisch (info)
  5. `map2d-cam-visi.ts:17` — `@spearwolf/eventize` hinter den relativen Importen (info)
- Ziel: Eine Demo, deren Init `display.start()` abwartet, zeigt ein Scheitern dieser Init
  unter ihrem Namen in der Konsole und über der Canvas, wie es `onDemoInit()` für ein
  `onInit` tut; die drei genannten Importlisten stehen in der Ordnung ihrer Datei; jedes
  Arrow-Feld der Library ist `readonly`.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `apps/lookbook/src/demos/utils/demoInit.ts`, neu `apps/lookbook/src/demos/utils/demoInit.spec.ts`
  - `apps/lookbook/vitest.config.ts` (`coverage.include`)
  - `apps/lookbook/README.md` (Absatz ab Zeile 65)
  - `apps/lookbook/src/pages/demos/` — `animated-billboards.astro`, `atlas-frames-on-meshes.astro`,
    `cardboard-parade.astro`, `swaying-grass.astro`, `textured-quads.astro`,
    `textured-quads-from-texture-atlas.astro`, `textured-quads-from-tileset.astro`,
    `vector-balls.astro`, `first-sprite.astro`
  - `apps/lookbook/src/demos/map2d/map2d-tile-sprites.ts`, `map2d-rect-visi.ts`, `map2d-cam-visi.ts`
  - `apps/lookbook/src/demos/boomer-shooter-corridor/NeonSigns.ts`
  - `packages/twopoint5d/src/` — `controls/InputControlBase.ts`, `controls/PanControl2D.ts`,
    `display/DisplayStateMachine.ts`, `display/FrameLoop.ts`, `stage/DirectorMasks.ts`,
    `stage/Stage2D.ts`, `texture/TileSet.ts`, `texture/TextureStore.ts`
- Kein CHANGELOG: das Lookbook ist kein veröffentlichtes Paket (wie Paket 15), und
  `readonly` an einem `#`-Feld ändert weder das ausgelieferte JavaScript noch die `.d.ts`.

## Vorgehen

Code, Kommentare, TSDoc, README und Testnamen auf Englisch. Keine Finding-IDs, kein
Rückblick auf den Vorzustand (Abschnitt »Konventionen« im Plan-Kopf).

1. **Regressionstest zuerst.** Neu `apps/lookbook/src/demos/utils/demoInit.spec.ts`
   (Vitest, Umgebung `node` wie die übrigen Specs des Lookbooks; `restoreMocks` und
   `unstubGlobals` sind in `apps/lookbook/vitest.config.ts` an). `document` gibt es in
   `node` nicht: per `vi.stubGlobal('document', …)` ein Objekt mit
   `createElement()` (antwortet ein Zeilen-Objekt `{className: '', textContent: '', setAttribute: vi.fn()}`),
   `querySelector(selector)` (antwortet für `'demo-ui'` ein Objekt `{append: vi.fn()}` oder,
   im Fall ohne `<demo-ui>`, `null`) und `body: {append: vi.fn()}`. `console.error` per
   `vi.spyOn(console, 'error').mockImplementation(() => {})` (Muster:
   `packages/twopoint5d/src/controls/PanControl2D.spec.ts:181`). Display-Stubs per
   `as unknown as Display`, Props als `{} as DisplayEventProps`. Fälle:
   - `describe('startDemo()')`
     - `shows a failed init under the name of the demo, in the console and over the canvas, and the display starts all the same`:
       Stub `start: vi.fn(async (callback) => { await callback(props); return display; })`,
       Init wirft `new Error('the atlas answered 404')`. `startDemo(display, 'cardboard-parade', init)`
       löst mit `display` auf; `console.error` mit `('cardboard-parade: the demo failed to start', error)`;
       die Zeile hat `className` `'demo-failure'`, `setAttribute('role', 'alert')`, `textContent`
       `'cardboard-parade failed to start: the atlas answered 404. The console has the details.'`
       und geht per `append()` in das `<demo-ui>`-Objekt.
     - `hands the props of the display to the init, and shows nothing when the init succeeds`:
       die Init (Spy, löst auf) bekommt genau das Props-Objekt, das der Stub an den Callback gibt;
       weder `console.error` noch `createElement` werden gerufen.
     - `writes the line into the body of a page without <demo-ui>, and a thrown value that is no Error as it is`:
       `querySelector` antwortet `null`, die Init wirft den String `'gone'`, Demo
       `'map2d-cam-visi'`; `body.append` bekommt die Zeile mit `textContent`
       `'map2d-cam-visi failed to start: gone. The console has the details.'`.
     - `rejects where start() itself rejects, and shows nothing`: der Stub `start` lehnt mit
       einem eigenen `Error` ab, ohne den Callback zu rufen; `startDemo()` lehnt mit genau
       diesem Fehler ab, `console.error` wird nicht gerufen.
   - `describe('onDemoInit()')`
     - `puts the guarded init on onInit, and answers what onInit answers`: Stub
       `onInit: vi.fn((listener) => { captured = listener; return unsubscribe; })`;
       `onDemoInit(display, 'first-sprite', init)` antwortet `unsubscribe`; der eingefangene
       Listener, gerufen mit Props, löst trotz werfender Init auf und schreibt
       `('first-sprite: the demo failed to start', error)` in die Konsole.
   - `describe('catchPrecompile()')`
     - `logs a failed precompile() under the name of the demo, and resolves`:
       `console.error` mit `('stage-masks-portal: precompile() failed, the shaders build on first use', error)`,
       die Antwort löst mit `undefined` auf.
     - `resolves with nothing logged when precompile() resolves`.

   Roter Lauf vor Schritt 2, Ausgabe in den Report:
   `pnpm --dir apps/lookbook exec vitest --run src/demos/utils/demoInit.spec.ts` — die vier
   `startDemo()`-Fälle sind rot (`startDemo` gibt es noch nicht), die übrigen grün.

2. **Helfer.** In `apps/lookbook/src/demos/utils/demoInit.ts`:
   - Neue, nicht exportierte Funktion, direkt unter `onDemoInit()`:
     ```ts
     function guardInit(demo: string, init: (props: DisplayEventProps) => Promise<void>): (props: DisplayEventProps) => Promise<void> {
       return async (props: DisplayEventProps) => {
         try {
           await init(props);
         } catch (error) {
           showDemoFailure(demo, error);
         }
       };
     }
     ```
   - Der Rumpf von `onDemoInit()` wird `return display.onInit(guardInit(demo, init));`;
     Signatur und TSDoc von `onDemoInit()` bleiben.
   - Neu, exportiert, zwischen `onDemoInit()` und `guardInit()`:
     ```ts
     /**
      * Starts `display` with `init` as the callback that `start()` awaits before the first frame,
      * and shows a failure of it as {@link onDemoInit} does: logged under the name of the demo and
      * written over the canvas. The rejection of `start()` would name no demo and write no line.
      * After a failed init the display starts all the same, as it does beside a failed
      * `onDemoInit()`.
      *
      * @param demo the name of the demo, its route, for the console and the line over the canvas
      * @returns what `display.start()` answers; it still rejects where `start()` fails on its own —
      *   a display disposed while `init` ran, a renderer that does not come up
      */
     export function startDemo(display: Display, demo: string, init: (props: DisplayEventProps) => Promise<void>): Promise<Display> {
       return display.start(guardInit(demo, init));
     }
     ```
   - `showDemoFailure()` und `catchPrecompile()` bleiben unverändert.

3. **Acht Seiten und drei Module auf `startDemo()`.** Je Datei zwei Änderungen, sonst keine:
   der Aufruf wird ersetzt (Rumpf, Einrückung und das schließende `});` bleiben, weil der
   Callback letztes Argument bleibt), und direkt **über** der Zeile, die `DemoParts`
   importiert, kommt der Import von `startDemo` (`demoInit` steht vor `demoParts`):

   | Datei | Zeile | aus | wird | Import über Zeile |
   | --- | --- | --- | --- | --- |
   | `pages/demos/animated-billboards.astro` | 55 | `await demo.start(async ({renderer}) => {` | `await startDemo(demo, 'animated-billboards', async ({renderer}) => {` | 49 |
   | `pages/demos/atlas-frames-on-meshes.astro` | 47 | `await demo.start(async ({renderer}) => {` | `await startDemo(demo, 'atlas-frames-on-meshes', async ({renderer}) => {` | 36 |
   | `pages/demos/cardboard-parade.astro` | 46 | `await demo.start(async ({renderer}) => {` | `await startDemo(demo, 'cardboard-parade', async ({renderer}) => {` | 35 |
   | `pages/demos/swaying-grass.astro` | 81 | `await display.start(async ({renderer}) => {` | `await startDemo(display, 'swaying-grass', async ({renderer}) => {` | 23 |
   | `pages/demos/textured-quads.astro` | 102 | `await demo.start(async ({renderer}) => {` | `await startDemo(demo, 'textured-quads', async ({renderer}) => {` | 27 |
   | `pages/demos/textured-quads-from-texture-atlas.astro` | 85 | `await demo.start(async ({renderer}) => {` | `await startDemo(demo, 'textured-quads-from-texture-atlas', async ({renderer}) => {` | 26 |
   | `pages/demos/textured-quads-from-tileset.astro` | 85 | `await demo.start(async ({renderer}) => {` | `await startDemo(demo, 'textured-quads-from-tileset', async ({renderer}) => {` | 27 |
   | `pages/demos/vector-balls.astro` | 59 | `await demo.start(async ({renderer}) => {` | `await startDemo(demo, 'vector-balls', async ({renderer}) => {` | 38 |
   | `demos/map2d/map2d-tile-sprites.ts` | 18 | `demo.start(async ({renderer}) => {` | `startDemo(demo, 'map2d-tile-sprites', async ({renderer}) => {` | 13 |
   | `demos/map2d/map2d-rect-visi.ts` | 21 | `demo.start(async ({renderer}) => {` | `startDemo(demo, 'map2d-rect-visi', async ({renderer}) => {` | 15 |
   | `demos/map2d/map2d-cam-visi.ts` | 20 | `demo.start(async ({renderer}) => {` | `startDemo(demo, 'map2d-cam-visi', async ({renderer}) => {` | 14 |

   Pfade relativ zu `apps/lookbook/src/`. Importzeile in den `.astro`-Seiten
   `import {startDemo} from '~demos/utils/demoInit';` (eingerückt wie die Nachbarn), in den
   map2d-Modulen `import {startDemo} from '../utils/demoInit';`. Der Demo-Name ist die Route,
   gleich dem Dateinamen ohne Endung. Die Zeilen sind gegen `1e40bfff` gezählt; Schritt 5
   ändert `map2d-cam-visi.ts` oben, die Zuordnung gilt über den Inhalt.

   Was nach dem `await` der Seiten steht, läuft nach einer gescheiterten Init jetzt weiter,
   wie hinter `await display.start()` auf den Seiten mit `onDemoInit()`: das Ausblenden der
   `.loading-wrapper` (`animated-billboards`, `atlas-frames-on-meshes`), das `console.log` der
   Szene (`textured-quads`, `textured-quads-from-tileset`), die Radio-Buttons von
   `map2d-cam-visi.astro`. Das ist gewollt und bleibt unverändert; diese Zeilen nicht anfassen.

4. **README.** `apps/lookbook/README.md`, der Absatz ab Zeile 65 von »An `onInit` that awaits«
   bis »which logs a failure and lets the page go on.« wird zu (Wortlaut, Umbruch wie die
   Nachbarzeilen, höchstens 90 Zeichen, drei Leerzeichen Einzug):

   > An init that awaits goes through `src/demos/utils/demoInit.ts`: an `onInit` through
   > `onDemoInit(display, '<name>', …)` — a `Display` does not wait for the promise of its
   > listener —, the callback of `display.start()` through `startDemo(display, '<name>', …)`,
   > which starts the display with it, since the rejection of `start()` names no demo. Both
   > show a failure under the name of the demo, in the console and over the canvas, and the
   > display runs all the same. A `director.precompile()` goes through `catchPrecompile('<name>', …)`
   > from the same file, which logs a failure and lets the page go on.

   Der Satz über `ignoredKey(event)` danach bleibt.

5. **Importreihenfolge** (drei Dateien, nur verschieben):
   - `apps/lookbook/src/demos/boomer-shooter-corridor/NeonSigns.ts`: die Zeile
     `  type FeatureSpritesOf,` (`:14`) wandert direkt hinter `  FeatureSprites,` (`:4`), vor
     `  flatPlacement,` — die Liste ist ohne Rücksicht auf Groß- und Kleinschreibung sortiert.
   - `apps/lookbook/src/pages/demos/first-sprite.astro`: `import {deferPreview} from '~demos/utils/demoPreview';`
     (`:22`) steht vor `import {getFullscreenCanvas} from '~demos/utils/fullscreenCanvas';` (`:21`).
   - `apps/lookbook/src/demos/map2d/map2d-cam-visi.ts`: `import {on} from '@spearwolf/eventize';`
     (`:17`) wandert nach Zeile 1 (die `// biome-ignore-all …`-Zeile bleibt die erste), also vor
     den Import aus `@spearwolf/twopoint5d`. Danach lautet der Kopf: `biome-ignore-all`,
     `@spearwolf/eventize`, `@spearwolf/twopoint5d`, `three/webgpu`, `../utils/demoInit`
     (Schritt 3), `../utils/demoParts`, `../utils/loadTextureCatalog`, `type … ../utils/PerspectiveOrbitDemo`.

   Kein Durchgang über weitere Dateien: `biome.jsonc:64–66` lässt die Reihenfolge den Autoren
   (`organizeImports` aus), und schon die Seiten dieses Pakets ordnen `PerspectiveOrbitDemo`
   teils nach ASCII, teils ohne Rücksicht auf die Schreibung. Die drei Stellen sind je ein
   Ausreißer in einer sonst sortierten Liste.

6. **Format.** Danach `pnpm exec biome check --write` mit genau den Dateien dieses Pakets,
   nicht über das ganze Repo.

7. **`readonly` an den Arrow-Feldern der Library.** Vor den Namen jedes dieser Felder kommt
   `readonly ` (Zeile, Name, sonst keine Änderung; keines wird irgendwo neu zugewiesen, in Zug 0
   per Grep geprüft, und `pnpm typecheck` bestätigt es); Pfade unter `packages/twopoint5d/src/`:
   - `controls/InputControlBase.ts:9` `#findListenerIndex`
   - `controls/PanControl2D.ts:620` `#onPointerDown`, `:650` `#onPointerUp`, `:665` `#onPointerCancel`,
     `:723` `#onPointerMove`, `:769` `#onKeyDown`, `:783` `#onKeyUp`, `:795` `#onKeyboardLost`
   - `display/DisplayStateMachine.ts:76` `#pausedByUserChanged`, `:92` `#documentIsVisibleChanged`,
     `:105` `#elementIsInsideViewportChanged`, `:118` `#pause`, `:175` `#initOrRestart`
   - `display/FrameLoop.ts:93` `#onAnimationFrame`
   - `stage/DirectorMasks.ts:305` `#maskDisposed`
   - `stage/Stage2D.ts:412` `#updateProjection`
   - `texture/TileSet.ts:292` `#createTextureCoords`
   - `texture/TextureStore.ts:457` `#pickAtlasAdapter`

   Nicht dazu gehört `texture/TextureResource.ts:453` (`shapeContextOf = …` im `static`-Block
   weist eine modulweite `let` zu, kein Feld).

8. **Abnahme-Greps** (vom Repo-Root, beide Ergebnisse in den Report):
   - `grep -rn -E "\.start\(async" apps/lookbook/src` — kein Treffer.
   - ```
     grep -rn -E "^\s+(static |protected |public |private |override )*#?[a-zA-Z_]+\s*(:[^=]+)?=\s*(async\s*)?(\(|[a-zA-Z_]+\s*=>)" packages/twopoint5d/src --include=*.ts \
       | grep -v -E "\.spec\.ts|\.bench\.ts|/testing/" | grep -v -E ":\s*(export )?(const|let|var|return|this\.|readonly) " \
       | grep -v -E "^\S+:\s+readonly" | grep -E "=>|= *(async *)?\($"
     ```
     — genau ein Treffer, `texture/TextureResource.ts:453`.

9. **`coverage.include`** in `apps/lookbook/vitest.config.ts`: `'src/demos/utils/demoInit.ts'`
   zwischen `'src/demos/utils/checkJson.ts'` und `'src/demos/utils/demoParts.ts'`. Die
   Schwellen bleiben; die Spec deckt alle vier Funktionen der Datei samt beiden Zweigen von
   `showDemoFailure()`.

- Verify: `pnpm run ci`
- Commit: `fix: name the demo whose init display.start() awaits when that init fails, over its canvas and in the console, through startDemo(), put the imports of three demos in order, and mark every arrow field of the library readonly`

## Gründe

- **`startDemo()` statt Umstellung auf `onDemoInit()`.** Mit `onInit` liefe die Init erst
  nach dem Start, und Code hinter dem `await` liefe vor ihrem Ende:
  `map2d-cam-visi.astro:43–58` sendet `enablePanControl` an den Listener, den die Init in
  `map2d-cam-visi.ts:110` erst anlegt, zwei Seiten blenden ihre Ladeanzeige hinter dem `await`
  aus, zwei loggen die gebaute Szene. `startDemo()` lässt die Reihenfolge, wie sie ist. Ein
  Helfer, der selbst startet, statt eines Wrappers um den Callback, weil der Callback so letztes
  Argument bleibt und Biome die Rümpfe nicht neu einrückt — der Diff bleibt bei zwei Zeilen je
  Datei.
- **Nach einer gescheiterten Init startet das Display.** `guardInit()` löst auf, `start()`
  läuft weiter (`Display.ts:1290–1322`). So hält es heute jede Seite mit `onDemoInit()`, deren
  Display ohnehin nicht auf die Init wartet; die Zeile über der Canvas sagt, was fehlt.
- **Synchrone Start-Callbacks bleiben**: `display-multi.astro:134` und `instanced-quads.astro:132`
  laden nichts und warten auf nichts. Die Regel der README gilt der Init, die wartet — für
  Assets, die mit 404 antworten, oder kaputtes JSON (`demoInit.ts:3–8`).
- **Die 17 weiteren Arrow-Felder** haben dieselbe Ursache wie `#updateProjection` und `#emit`
  (Paket 14): ein einmal gebundener Listener ohne `readonly`, während die Library die übrigen
  so führt (`Display.ts:1518–1587`, `AdaptiveResolution.ts:420–524`, `FramePacer.ts:389–396`,
  `DisplayFullscreen.ts:307–338`, `DisplaySizer.ts:131–177`, `FrameLoop.ts:384`). Alle stehen
  schon in `2e3f585b` (per `git grep` geprüft; `#maskDisposed` dort in `StageDirector.ts:2011`).
  Im Lookbook und in `twopoint5d-testing` gibt es kein Arrow-Feld ohne `readonly`. Keine Regel
  in AGENTS.md: nach diesem Paket zeigt der Code die Konvention ohne Ausnahme.
- **Kein Regressionstest für Seiten und `readonly`**: die Seiten haben keinen Testlauf (wie
  Paket 15b), `startDemo()` belegt `demoInit.spec.ts`; `readonly` ändert kein Laufzeitverhalten,
  den Beleg liefert `pnpm typecheck`.

## Abgleich (Zug 0)

- Init über `start()`: unverändert. Die Init läuft an `animated-billboards.astro:55`,
  `atlas-frames-on-meshes.astro:47`, `cardboard-parade.astro:46`, `swaying-grass.astro:81`,
  `textured-quads.astro:102`, `textured-quads-from-texture-atlas.astro:85`,
  `textured-quads-from-tileset.astro:85`, `vector-balls.astro:59`, `map2d-tile-sprites.ts:18`,
  `map2d-rect-visi.ts:21`, `map2d-cam-visi.ts:20` als Callback von `start()`; um eine Zeile
  gewandert gegen die Queue (Paket 15b). Die Freigabe nach einem Wurf halten diese Stellen seit
  `528096d5` über `DemoParts`; offen ist allein die Fehleranzeige. Der Paketblock im Plan sprach
  von einer »Freigabelücke« — korrigiert auf den Eintrag der Queue.
- `Stage2D.ts:412`: unverändert.
- `NeonSigns.ts:14`: unverändert (Paket 16 hat nur `:75–78` berührt).
- `first-sprite.astro`: von `:22–23` nach `:21–22` gewandert, sonst unverändert.
- `map2d-cam-visi.ts:17`: unverändert.
- Offene Folgen erledigter Pakete: keine (15b und 16: `Folgen: —`). »Offene Befunde«: jeder
  Eintrag ist `[x]`.

## Verlauf

- 2026-11-18 Zug 0: Detailplan steht · Init über `start()` unverändert (11 Stellen, je +1 Zeile
  gegen die Queue), Freigabe schon durch 528096d5 erledigt, offen nur die Fehleranzeige ·
  `Stage2D.ts:412` unverändert, dazu 17 Arrow-Felder gleicher Ursache in 7 Dateien ·
  `NeonSigns.ts:14`, `map2d-cam-visi.ts:17` unverändert, `first-sprite.astro` → `:21–22` ·
  keine offenen Folgen, Queue leer
- 2026-11-18 Zug 1: Implementierer beauftragt (sonnet, effort low)
- 2026-11-18 Zug 2: Report FERTIG · 25 Dateien (neu `demoInit.spec.ts`), roter Lauf 4 failed/3 passed · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-17.verify.log`) · Abweichung: Schritt 7 listet 18 Felder, nicht 17 — alle 18 gesetzt
- 2026-11-18 Zug 3: Reviewer (sonnet, low): alle 5 erfüllt, keine kritischen/wichtigen Befunde · Diff `paket-17.diff`
- 2026-11-18 Zug 4: keine Runde nötig
- 2026-11-18 Zug 5: Commit 3b37c02d, Verify aus Zug 2 (exit=0)

## Urteil des Reviewers

1. Init über `start()`: behoben — `startDemo()` in `demoInit.ts:30`, 11 Stellen umgestellt, Grep `\.start\(async` leer
2. `readonly`: behoben — 18 Felder in 8 Dateien, Abnahme-Grep nur `TextureResource.ts:453`
3. `NeonSigns.ts`: behoben — `type FeatureSpritesOf` hinter `FeatureSprites`
4. `first-sprite.astro`: behoben — `demoPreview` vor `fullscreenCanvas`
5. `map2d-cam-visi.ts`: behoben — `@spearwolf/eventize` direkt nach `biome-ignore-all`

Klein: `README.md:65–70` zwei Zeilen über 90 Zeichen (Wortlaut der Vorgabe) · TSDoc von `onDemoInit()` könnte auf `startDemo()` verweisen
