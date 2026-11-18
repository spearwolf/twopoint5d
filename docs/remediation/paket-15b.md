# Paket 15b — Lookbook: die übrigen Demo-Seiten halten, was ihre Init baut, in einem DemoParts

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen aus dem Audit — Stellen gleicher Ursache wie
  `stage-masks-frozen.astro` (Paket 15) in 33 Demo-Seiten und, in Zug 0 von 15b
  gefunden, in den drei Init-Modulen `demos/map2d/map2d-*.ts`; dazu der
  Queue-Eintrag zur Listener-Abnahme per `removeEventListener()` (elf Seiten,
  alle in diesem Paket). Alle vorbestehend, low/info.
- Ziel: Jede Demo-Seite, deren Init nach einem `await` baut, hält das Gebaute ab
  ihrer `isDisposed`-Prüfung in einem `DemoParts`, sodass ein Teil, der beim Bau
  wirft, nichts zurücklässt; die Freigabe wahrt jede Abhängigkeit, die der
  Freigabeblock heute einhält (ein Teil geht vor dem, was er benutzt), und jeder
  Listener der Init geht über das `signal` eines `AbortController` ab.
- Modell: mittlere Stufe
- Effort: medium
- Dateien (alle unter `apps/lookbook/src/`): `pages/demos/` —
  `animated-billboards`, `animated-sprites`, `atlas-frames-on-meshes`,
  `boomer-shooter-corridor`, `camera-rig-into-the-map`, `camera-rig-two-rooms`,
  `cardboard-parade`, `first-sprite`, `platformer`, `rope-bridge`,
  `sine-scroller`, `sprite-reflection`, `stage-masks-flashlight`,
  `stage-masks-heat-haze`, `stage-masks-matte-3d`, `stage-masks-matte-ink`,
  `stage-masks-matte-threshold`, `stage-masks-portal`,
  `stage-masks-resolution`, `stage-masks-rift`, `stage-masks-shared`,
  `stage-masks-spotlight`, `stage-masks-without-director`,
  `stage-post-process-etching`, `stage-transitions-gallery`,
  `stage-transitions-game-menu`, `swaying-grass`, `textured-quads`,
  `textured-quads-from-texture-atlas`, `textured-quads-from-tileset`,
  `textured-sprites`, `ui-panels`, `vector-balls` (je `.astro`); dazu
  `demos/map2d/map2d-tile-sprites.ts`, `demos/map2d/map2d-rect-visi.ts`,
  `demos/map2d/map2d-cam-visi.ts`. Nicht anfassen: `demos/utils/demoParts.ts`
  (fertig aus Paket 15, mit Spec), `README.md` des Lookbooks (die Regel steht
  schon), `stage-masks-frozen.astro` (das Muster), kein CHANGELOG (Lookbook).
- Verify: `pnpm run ci`, dazu die drei Abnahme-Greps unter »Abnahme«
- Commit: `fix(lookbook): hold what the init of each demo page and map2d demo builds in a DemoParts, so that a part that throws as it is built leaves nothing behind, take the listeners of the demo pages off through the signal of an AbortController, and let the director of the camera rig map demo go with the display however its init ends`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · alle 33 Seiten der Liste unverändert
    seit 5909821e/2401e5b7, Muster an jeder Seite wie erwartet (Freigabeblock
    am Ende der Init) · neu gefunden gleicher Ursache: `demos/map2d/map2d-tile-sprites.ts`,
    `map2d-rect-visi.ts`, `map2d-cam-visi.ts` (seit `2e3f585b` unverändert) ·
    Queue-Eintrag `removeEventListener()` (elf Seiten) ins Paket genommen ·
    neu in die Queue: Fehleranzeige der Seiten mit `start(async …)` (info) ·
    Folge aus Paket 15 (`NeonSigns.ts:75–78`, TSDoc an `FLICKER_SEED`) als
    echte Folge von Paket 9c eingeordnet → Paket 16 geschnitten
  - 2026-11-18 Zug 1: Implementierer beauftragt (sonnet, medium), Report nach `paket-15b.impl-0.json`
  - 2026-11-18 Zug 2: Report nur Schlussnotiz, vollständig über Resume in `paket-15b.impl-0-versuch-2.json` · FERTIG · 36 Dateien unter `apps/lookbook/src/` geändert · Arbeitsbaum schmutzig · Verify (`pnpm run ci` + Abnahme-Greps) exit=0, `paket-15b.verify.log`
  - 2026-11-18 Zug 3: Reviewer (opus, medium), Diff `paket-15b.diff`, Report `paket-15b.review-0.json` · alle Bestandteile erfüllt · wichtig 1 (Dot-Kommentar in gallery/game-menu falsch) · klein 2 (Commit-Message, Kommentarplatz in animated-billboards)
  - 2026-11-18 Zug 4 Runde 1: Dot-Kommentar an den Implementierer per Resume (sonnet, medium) · Commit-Message vom Runner nach dem kleinen Befund geschärft · zurück: FERTIG, Kommentar in beiden Dateien neu (`paket-15b.impl-1.json`) · Verify exit=0 (`paket-15b.verify.log`; Lauf aus Zug 2 jetzt `paket-15b.verify-0.log`) · Nachreview (sonnet, medium) auf `paket-15b.diff-1`
  - 2026-11-18 Zug 4 Runde 1 Nachreview: Befund behoben, keine neuen (`paket-15b.review-1.json`)
  - 2026-11-18 Zug 5: committet 528096d5 (36 Dateien), Verify `paket-15b.verify.log` exit=0 · 2 Nebenbefunde in die Queue

## Urteil des Reviewers (Zug 3, `paket-15b.review-0.json`; Runde 1 `paket-15b.review-1.json`)

- 33 Seiten nach den Angaben je Datei: behoben, alle abgeglichen (z. B. `animated-billboards.astro`, `platformer.astro`, `stage-masks-resolution.astro`); jede Freigabe des alten Blocks geht genau einmal ab.
- Regel 4 (umbesetzte Masken): behoben — `stage-masks-rift.astro:79–84`, `stage-masks-spotlight.astro:100f.` per Closure, `stage-masks-resolution.astro` `masks` als `const []` mit Push-Schleife.
- Regel 6 (Abhängigkeiten): behoben — Maske vor Stage, Picker vor Bällen bzw. Stalkern, Tile-Renderer vor Tile-Geometrie, alles vor dem Store; `stage-masks-without-director.astro` baut die Pipeline vor `sr`.
- Drei map2d-Module: behoben — `new DemoParts(demo)` als erste Anweisung, `isDisposed`-Zweig gibt nur den Store frei, `once`/`OnDisplayDispose` entfernt.
- Regel 7 (Listener per `signal`, Queue-Eintrag `removeEventListener()`): behoben — jeder `addEventListener` der 36 Dateien trägt ein `signal`; `vector-balls.astro` hat vor dem Start den Controller `resizing`; `wheel` in portal behält `passive: false`.
- `camera-rig-into-the-map.astro`: Director-`onDispose` vor dem Start, `parts.onDispose(freeAsset)` — behoben.
- `camera-rig-two-rooms.astro`: Kamera-Suche nach `parts.onDispose(freeAsset)` — behoben.
- Regel 8 (Kopfkommentare etching, game-menu): behoben.
- Wichtig, in Runde 1 behoben: Kommentar zum Dot in `stage-transitions-gallery.astro:83`/`stage-transitions-game-menu.astro:65` behauptete Herkunft aus dem Store; jetzt »drawn on a canvas, not lent by the store: the dot is the page's to free«.

## Kleine Befunde

- Commit-Message: »every other demo« las sich als »jede zweite Demo« und nannte die map2d-Module nicht → vom Runner vor dem Commit geschärft.
- `animated-billboards.astro`: der Besitzkommentar steht an `geometry` statt, wie geplant, an `mesh`; inhaltlich stimmt er dort — belassen.
- Abweichungen laut Implementierer: `camera-rig-two-rooms.astro:141` ohne Bindung `stageRenderer` (sonst ungenutzt); `stage-masks-matte-threshold.astro`: `hud` geht vor `ping` (unkritisch, `SonarHud#dispose()` fasst die Maske nicht an).

## Nebenbefunde (Urteil → Scope, Scope-Regel: alles)

- `first-sprite.astro:22–23` Importreihenfolge, `map2d-cam-visi.ts:17` Import hinter den relativen: beide vorbestehend (`git show 2e3f585b:`), info; Scope-Regel greift, kein gemeinsamer Grund mit einem offenen Paket → Drain-Runde.

## Vorgehen

Erst die Regeln, die für jede Datei gelten, dann je Datei, was dort steht und
was davon abweicht. Zeilennummern gegen den Stand von 5909821e.

### Regeln für jede Datei

1. **Import.** `import {DemoParts} from '~demos/utils/demoParts';` in die
   `~demos/utils/*`-Importe, alphabetisch wie in `stage-masks-frozen.astro:25–30`
   (nach `demoKeys`/`demoInit`, vor `demoPreview`). Die map2d-Module importieren
   relativ: `import {DemoParts} from '../utils/demoParts';`.
2. **Anlegen.** Direkt nach dem Block `if (<display>.isDisposed) { …; return; }`,
   der dem Laden folgt: `const parts = new DemoParts(<display>);` — `display` oder
   `demo`, wie die Seite ihr Display nennt —, und sofort danach das, was das
   Laden geliefert hat: `parts.keep(store);` bzw. `parts.keep(assets.store);`.
   Das gilt auch dort, wo der Store vor dem `await` gebaut wird
   (`new TextureStore(renderer)`): sein Fehlerpfad bleibt der `.catch()`, der
   ihn freigibt, die `isDisposed`-Prüfung bleibt wie sie ist. Ausnahmen stehen
   bei der Datei (two-rooms, into-the-map, die map2d-Module).
3. **Behalten, sobald es existiert.** Jeder Teil mit eigenem `dispose()`, den
   die Init danach baut, geht in seiner Bauzeile durch `parts.keep()`:
   `const dark = parts.keep(new ChapelVoid(clock));` (Muster
   `stage-masks-frozen.astro:56–61`). Was anders freigegeben wird, bekommt direkt
   nach seiner Bauzeile `parts.onDispose(() => …)`:
   - `const gui = new GUI(…);` → `parts.onDispose(() => gui.destroy());`
   - ein `AbortController` → `parts.onDispose(() => listening.abort());`
   - `setInterval(…)` → `parts.onDispose(() => clearInterval(<name>));`
   - `let previewTimeout …;` → in der Zeile danach
     `parts.onDispose(() => clearTimeout(previewTimeout));` (Muster
     `stage-masks-frozen.astro:168–170`); ein `const timeout = setTimeout(…)`
     ebenso direkt danach.
   - eine Unsubscribe-Funktion → `parts.onDispose(<name>);`
   - was heute eine Funktion freigibt (`disposeNightCity(city)`,
     `freeAsset()`, `mesh.geometry?.dispose(); disposeMaterial(mesh.material);`)
     → genau diese Zeilen in einem `parts.onDispose(() => { … })`.
4. **Umbesetzte Variablen.** Eine Maske in `let`, die die Seite später ersetzt
   und dabei die alte selbst freigibt (`riftMask`, `cutMask` in rift, `mask` in
   spotlight, das Array `masks` in resolution), geht **nicht** durch
   `parts.keep()` — sonst gäbe die Teardown die ersetzte ein zweites Mal frei.
   Stattdessen direkt nach der Bauzeile `parts.onDispose(() => riftMask.dispose());`:
   die Closure liest beim Dispose den dann aktuellen Wert.
5. **Der alte Block geht.** Der `display.onDispose(() => { … })` bzw.
   `demo.onDispose(…)` bzw. `once(demo, OnDisplayDispose, …)` am Ende der Init
   entfällt ganz. Vor dem Löschen Zeile für Zeile abhaken, dass jede Freigabe
   darin ihren Platz nach Regel 2–4 hat und keine doppelt läuft. Imports, die
   danach ungenutzt sind (`once`, `OnDisplayDispose` in den map2d-Modulen),
   gehen mit; Biome meldet sie sonst.
6. **Reihenfolge.** `DemoParts` gibt rückwärts frei, in der Reihenfolge, in der
   behalten wurde. Damit geht jeder Teil vor dem, was vor ihm gebaut wurde — und
   das ist an jeder Seite, was der heutige Block einhält: eine Maske vor der
   Stage, die sie liest, Sprites vor der Geometrie, die sie bekommen haben, ein
   Renderer vor Pipeline und Stage, ein Tile-Renderer vor der Geometrie seiner
   Slots, der Picker vor den Bällen, alles vor dem Store. Wo die Bau-Reihenfolge
   das brechen würde, steht die Umstellung bei der Datei (nur
   `stage-masks-without-director`). Unabhängige Teile dürfen ihre Reihenfolge
   untereinander tauschen (wie in Paket 15 an den drei Masken der Muster-Seite).
7. **Listener.** Jeder `addEventListener()` der Init auf Fenster, Canvas,
   Dokument oder ein Element des Markups bekommt das `signal` eines
   `AbortController`, der vor dem ersten dieser Listener angelegt und mit
   `parts.onDispose(() => listening.abort())` registriert wird (Muster
   `stage-masks-frozen.astro:143–145`); die `removeEventListener()`-Zeilen
   entfallen. Wo eine Seite schon einen Controller hat (`listening`,
   `listeners`), bleibt sein Name; er bekommt nur die `parts.onDispose`-Zeile
   direkt nach seiner Erzeugung. Neue Controller heißen `listening`. Benannte
   Handler (`onKeyDown` …) bleiben stehen, sie werden ja noch übergeben. Ein
   Listener mit weiteren Optionen behält sie: `{signal: listening.signal, passive: false}`.
8. **Kommentare.** Ein Kommentar im alten Block, der Besitz oder Reihenfolge
   erklärt (»the sprites leave the geometry they were handed to the page«, »the
   picker first: …«, »the mask owns the stage it built …«), wandert gekürzt an
   die `parts.keep()`-Zeile, die er erklärt, oder entfällt, wo die Zeile es
   selbst sagt. Kein Kommentar über den alten Block (Konventionen: kein
   Rückblick). Den Kommentar von `stage-masks-frozen.astro:51` nicht an jeder
   Seite wiederholen: README und Muster tragen ihn. Die beiden Kopfkommentare
   »each layer goes in the onDispose() of the init« (`stage-post-process-etching.astro:44`,
   `stage-transitions-game-menu.astro:40`) werden zu »each layer goes with the
   parts of the init«. »which the init frees« an den übrigen Seiten stimmt
   weiter und bleibt.
9. **Sonst nichts.** Kein anderes Refactoring, keine Umbenennung, nichts, was
   die Seite anders baut oder zeigt. `display.onResize()`, `onRenderFrame()`,
   `on(display|demo, …)` bleiben: das Display lässt die Listener seiner eigenen
   Ereignisse selbst fallen (README). `on(stage, …)` bleibt, wie es ist.

### Je Datei

`keep:` zählt in Bau-Reihenfolge auf, was durch `parts.keep()` geht;
`onDispose:` was Regel 3/4 bekommt; `weg:` der alte Block.

**`start(async …)`-Seiten** (Init über `Display#start(beforeStartCallback)`;
`DemoParts` greift dort genauso, `start()` prüft `#disposed` direkt vor und
nach dem Callback, `packages/twopoint5d/src/display/Display.ts:1299, 1307`):

- `animated-billboards.astro` (`demo`): `parts` nach `:69–72` · keep: `store`,
  `geometry` `:74`, `animsMap` `:84`, `mesh` `:85`, `planeGeometry` `:113`,
  `planeMaterial` `:114` · weg: `:132–141`; Kommentar `:133–134` an `mesh`.
- `atlas-frames-on-meshes.astro` (`demo`): `parts` nach `:75–78` · keep:
  `store` · onDispose: nach `:80` `parts.onDispose(() => disposeNightCity(city));`
  · weg: `:83–87`.
- `cardboard-parade.astro` (`demo`): `parts` nach `:64–67` · keep: `store`,
  `parade` `:69` · onDispose: `listening` `:76`, `readout` `:97` · weg: `:101–107`.
- `swaying-grass.astro` (`display`): `parts` nach `:94–97` · keep: `store`,
  `meadow` `:99` · onDispose: `gui` `:108` · weg: `:185–189`. Der Block vor dem
  Start (`:70–78`) bleibt.
- `textured-quads.astro` (`demo`): `parts` nach `:112–115` · keep: `store` ·
  onDispose: nach `:123` `parts.onDispose(() => { mesh.geometry?.dispose(); disposeMaterial(mesh.material); });`
  · weg: `:126–131`.
- `textured-quads-from-texture-atlas.astro` (`demo`): `parts` nach `:92–95` ·
  keep: `store` · onDispose: wie oben nach `:103` · weg: `:110–115`.
- `textured-quads-from-tileset.astro` (`demo`): `parts` nach `:94–97` · keep:
  `store` · onDispose: wie oben nach `:105` · weg: `:108–114`.
- `vector-balls.astro` (`demo`): **vor dem Start** `:54–55` wird zu
  `const resizing = new AbortController();`, `demo.onDispose(() => resizing.abort());`,
  `window.addEventListener('resize', fitPixelZoom, {signal: resizing.signal});`
  (`fitPixelZoom();` davor bleibt; eigener Name, weil die Init `listening`
  führt). In der Init: `parts` nach `:73–76` · keep: `store`, `vectorBalls`
  `:78`, `picker` `:128` · onDispose: `listening` `:87`, `readoutTimer` `:121` ·
  weg: `:158–165`; Kommentar `:161` an `picker` (behalten nach den Bällen:
  er weist einen laufenden Pick ab, bevor die Bälle gehen).
- `demos/map2d/map2d-tile-sprites.ts`, `map2d-rect-visi.ts`,
  `map2d-cam-visi.ts` (`demo`, Init in `run()`): **Abweichung von Regel 2** —
  diese Inits bauen schon vor dem `await` (Rahmen, `Map2D`, Helfer, Punkte),
  und heute verliert ein fehlschlagendes Laden genau das. Deshalb ist
  `const parts = new DemoParts(demo);` die erste Anweisung des
  `start`-Callbacks (das Display lebt dort: `Display.ts:1299`), jeder Teil vor
  dem `await` geht sofort hinein, und der `isDisposed`-Zweig nach dem Laden
  gibt nur noch den Store frei (`store.dispose(); return;` — das Vorherige ging
  mit dem Dispose schon); sein Kommentar sagt das. Danach `parts.keep(store)`.
  - `map2d-tile-sprites.ts`: keep `geometry` `:27`, `edges` `:28`; nach `:29`
    `parts.onDispose(() => line.material.dispose());` · `isDisposed` `:42–48` →
    nur Store · keep `store`; nach `:55–60`
    `parts.onDispose(() => { tileSprites.geometry?.dispose(); tileSprites.material?.dispose(); });`;
    keep `tiles` `:64` (nach den Tile-Sprites behalten: der Renderer gibt seine
    Slots zurück, bevor Geometrie und Material dahinter fallen — Kommentar
    `:83–84` dorthin) · weg: `:81–94`, Imports `once`, `OnDisplayDispose`.
  - `map2d-rect-visi.ts`: nach `:31–51`
    `parts.onDispose(() => { points.geometry.dispose(); points.material.dispose(); });`;
    keep `map2d` `:56`, `rectVisiAreaHelpers` `:68` · `isDisposed` `:82–89` →
    nur Store · keep `store`; Tile-Sprites wie oben nach `:96–101`; keep
    `tileRenderer` `:103`, `panControl` `:109` · weg: `:132–147`, Imports
    `once`, `OnDisplayDispose`, falls ungenutzt. `map2d` geht danach erst nach
    der Geometrie der Tile-Sprites: sicher, denn `Map2D#dispose()` nimmt den
    schon entsorgten Renderer nur ab, und dessen `clearTiles()` kehrt ohne
    Factory sofort zurück (`packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:216–218`,
    `Map2D.ts:285–295`). Der Kommentar `:134–135` wird an `tileRenderer` zu
    dem, was weiter gilt (Slots zurück vor Geometrie und Material).
  - `map2d-cam-visi.ts`: keep `map2d` `:31` · `isDisposed` `:54–58` → nur Store
    · keep `store`; Tile-Sprites wie oben nach `:79–84`; keep `tileRenderer`
    `:86`, `panControl` `:92` · weg: `:117–128`, Imports `once`,
    `OnDisplayDispose`, falls ungenutzt (`on` bleibt, `:97`).

**`onDemoInit()`-Seiten:**

- `animated-sprites.astro` (`demo`): `parts` nach `:81–84` · keep: `store`,
  `geometry` `:86`, `animsMap` `:100`, `material` `:101`, `mesh` `:107` ·
  onDispose: `listening` `:123` · weg: `:142–151`; Kommentar `:144–145` an `mesh`.
- `boomer-shooter-corridor.astro` (`display`): `parts` nach `:124–127` · keep:
  `store`, `corridor` `:129`, `stalkers` `:130`, `signs` `:131`, `picker` `:141`
  · onDispose: `listening` `:177` · weg: `:205–212`.
- `camera-rig-into-the-map.astro` (`display`): drei Schritte.
  (a) Der Director geht heute nur im Block am Ende der Init (`:432`) — wird das
  Display beim Laden entsorgt oder scheitert die Init, bleibt er stehen. Nach
  `:132` einfügen: `display.onDispose(() => director.dispose());` mit dem
  Kommentar von `stage-masks-flashlight.astro:48–49` (»here, before the init:
  …«); der Director geht dann vor den Rigs, was der Guide trägt
  (`packages/twopoint5d/docs/stages.md:963`: ein entsorgter Director lässt beide
  Rigs zurückgehen).
  (b) `parts` nach `:157–160`, sofort `parts.onDispose(freeAsset);`; im
  Ablehnungszweig `:163–166` entfällt `freeAsset();` (das Asset geht mit dem
  Display), der `throw` bleibt.
  (c) keep: `map` `:170`, `sheetGeometry` `:176`, `sheetMaterial` `:177`,
  `markerGeometry` `:181`, `markerMaterial` `:182`; nach dem Literal
  `tokenParts` (`:188–195`)
  `parts.onDispose(() => { for (const part of Object.values(tokenParts)) part.dispose(); });`;
  keep `room` `:207`, `glowTexture` `:221`, `glowMaterial` `:223`, `mapRig`
  `:250`, `roomRig` `:251` · onDispose: `listeners` `:374`, `gui` `:418` · weg:
  `:427–443` samt `director.dispose()`.
- `camera-rig-two-rooms.astro` (`display`): die Kamera-Suche `:106–115` wirft
  vor der `isDisposed`-Prüfung und verliert dabei das geladene glTF. Neue
  Reihenfolge nach `:105`: `freeAsset` (`:119–127`, unverändert) · die
  `isDisposed`-Prüfung (`:128–131`) · `const parts = new DemoParts(display);`
  `parts.onDispose(freeAsset);` · dann `camera`, die drei Kameras und die
  Clip-Prüfung (`:106–115`, unverändert; wirft eine, geht das Asset mit dem
  Display). keep: `stage` `:135`, `stageRenderer` `:137`, `rig` `:138` ·
  onDispose: nach `:142`
  `parts.onDispose(() => { mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene); });`,
  `listeners` `:195`, `gui` `:253` · weg: `:262–271`.
- `first-sprite.astro` (`display`): `parts` nach `:63–66` · keep: `store`,
  `sprites` `:72` · weg: `:86–90`.
- `platformer.astro` (`display`): `parts` nach `:63–66` · keep: `assets` (es
  hat `dispose()`), `game` `:68` · Listener: `const listening` (`:91`) rückt vor
  `:73`, mit `parts.onDispose(() => listening.abort())`; `:73–74` bekommen
  `{signal: listening.signal}` · onDispose: `timeout` `:118` · weg: `:124–131`.
- `rope-bridge.astro` (`display`): `parts` nach `:103–106` · keep: `store`;
  `:108` wird `bridge = parts.keep(new RopeBridge(…));` · onDispose:
  `listening` `:128` · weg: `:171–175`. Der Block vor dem Start (`:178–185`)
  bleibt.
- `sine-scroller.astro` (`display`): `parts` nach `:143–146` · keep: `store`,
  `scroller` `:148` · onDispose: `listening` `:173` · weg: `:211–216`.
- `sprite-reflection.astro` (`demo`): `parts` nach `:86–89` · keep: `store`,
  `geometry` `:91`, `animsMap` `:106`, `sprites` `:107` · onDispose: nach
  `:128–131` `parts.onDispose(() => { horizon.geometry.dispose(); horizon.material.dispose(); });`,
  `listening` `:144` · weg: `:162–172`; Kommentar `:164–165` an `sprites`.
- `stage-masks-flashlight.astro` (`display`): `parts` nach `:62–65` · keep:
  `assets.store`, `dark` `:69`, `level` `:70`, `flashlight` `:71`, `mask` `:77`
  (Kommentar `:207` hierher) · onDispose: `readoutInterval` `:89` · Listener:
  neuer `listening` vor `:148`, Signal an `:148–150` und `:167–170` · onDispose:
  `gui` `:172`, `previewTimeout` `:194` · weg: `:196–213`.
- `stage-masks-heat-haze.astro` (`display`): `parts` nach `:53–56` · keep:
  `assets.store`, `snow` `:58`, `ash` `:59`, `heat` `:63`, `cycler` `:69` ·
  onDispose: `gui` `:93`, `previewTimeout` `:115` · weg: `:117–125`.
  (`TransitionCycler#dispose()` fasst die GUI nicht an,
  `demos/stage-masks/TransitionCycler.ts:155–159`; dass die GUI jetzt vor ihm
  geht, ist gleichgültig. Dasselbe gilt für matte-3d, matte-ink,
  matte-threshold.)
- `stage-masks-matte-3d.astro` (`display`): `parts` nach `:66–69` · keep:
  `assets.store`, `bathroom` `:71`, `reflection` `:72`, `shatter` `:76`,
  `byCoverage` `:80`, `byLook` `:81`, `cycler` `:92` · onDispose: `gui` `:126`,
  `previewTimeout` `:160` · weg: `:162–172`.
- `stage-masks-matte-ink.astro` (`display`): `parts` nach `:61–64` · keep:
  `assets.store`, `title` `:66`, `hall` `:67`, `blots` `:73`, `ink` `:74`,
  `edge` `:76`, `cycler` `:88` · onDispose: `gui` `:109` · Listener: neuer
  `listening` vor `:130`, Signal an `:130–132` · onDispose: `previewTimeout`
  `:148` · weg: `:150–163`.
- `stage-masks-matte-threshold.astro` (`display`): `parts` nach `:94–97` ·
  keep: `assets.store`, `survey` `:99`, `thing` `:100`, `sonar` `:106`, `ping`
  `:107`, `hud` `:108`, `cycler` `:130` · onDispose: `gui` `:152`,
  `previewTimeout` `:221` · weg: `:223–233`.
- `stage-masks-portal.astro` (`display`): `parts` nach `:45–48` · keep:
  `assets.store`, `hallway` `:57`, `moor` `:58`, `glaze` `:59`, `portal` `:60` ·
  onDispose: `unsubscribePlace` `:63`, `unsubscribeReadouts` `:87` · Listener:
  neuer `listening` vor `:141`, Signal an `:141–143` und `:158–161` (`wheel`
  mit `{signal: listening.signal, passive: false}`) · onDispose: `gui` `:163`,
  `previewTimeout` `:196` · weg: `:198–215`.
- `stage-masks-resolution.astro` (`display`): `parts` nach `:96–99` · keep:
  `assets.store`, `room` `:102` · `:106` wird
  `layout.panels.map((_, i) => parts.keep(new SpiritPlate(assets, i)))`, `:107`
  ebenso mit `EctoplasmFog` · `masks` (`:108`, von `setScale()` `:180–190`
  umbesetzt, Regel 4): `const masks: StageMask[] = [];`, dann
  `parts.onDispose(() => { for (const mask of masks) mask.dispose(); });`, dann
  `for (let i = 0; i < fogs.length; i++) masks.push(new StageMask(fogs[i]!.stage, {scale: settings.scales[i]}));`
  · nach `:116–121`
  `parts.onDispose(() => { for (const el of plaques) el.remove(); });` ·
  onDispose: `gui` `:213` · Listener: neuer `listening` vor `:249`, Signal an
  `:249` · onDispose: `previewTimeout` `:270` · weg: `:272–282`.
- `stage-masks-rift.astro` (`display`): `parts` nach `:56–59` · keep:
  `assets.store`, `membrane` `:63`, `snow` `:64`, `world` `:65`, `other` `:66`,
  `rim` `:67` · Regel 4: nach `:74` `parts.onDispose(() => riftMask.dispose());`,
  nach `:77` `parts.onDispose(() => cutMask.dispose());` · Listener: neuer
  `listening` vor `:151`, Signal an `:151–153` und `:176–179` · onDispose:
  `gui` `:181`, `previewTimeout` `:203` · weg: `:205–223`.
- `stage-masks-shared.astro` (`display`): `parts` nach `:50–53` · keep:
  `assets.store`, `rot` `:56`, `forest` `:57`, `vhs` `:58`, `hud` `:59`, `ink`
  `:60`, `inkMask` `:70` · Listener: neuer `listening` vor `:108`, Signal an
  `:108` · onDispose: `gui` `:110`, `previewTimeout` `:136` · weg: `:138–149`.
- `stage-masks-spotlight.astro` (`display`): `parts` nach `:66–69` · keep:
  `assets.store`, `deep` `:73`, `ward` `:74`, `laundromat` `:75`, `player`
  `:76`, `fog` `:77` · Regel 4: nach `:95` `parts.onDispose(() => mask.dispose());`
  · Listener: neuer `listening` vor `:180`, Signal an `:180–182` und `:205–208`
  · onDispose: `gui` `:210`, `previewTimeout` `:233` · weg: `:235–252`.
- `stage-masks-without-director.astro` (`display`): `parts` nach `:40–43` ·
  keep: `assets.store`, `wall` `:45` · **Umstellung nach Regel 6**: heute geht
  `sr` vor `pipeline` (`:79–80`), gebaut wird `sr` zuerst (`:49`, `:51`) —
  deshalb `const pipeline = parts.keep(new RenderPipeline(renderer));` vor
  `const sr = parts.keep(new StageRenderer(display)…)`, `sr.add(…)`,
  `sr.pipeline = pipeline;` und `sr.buildOutputNode = …` unverändert danach ·
  Listener: neuer `listening` vor `:63`, Signal an `:63–64` · onDispose: `gui`
  `:68`, `previewTimeout` `:72` · weg: `:74–83`.
- `stage-post-process-etching.astro` (`display`): `parts` nach `:65–68` · keep:
  `assets.store`, `bathroom` `:70`, `reflection` `:71`, `caption` `:72` ·
  onDispose: `listeners` `:109`, `gui` `:139` · weg: `:144–151` · Kommentar
  `:44` nach Regel 8.
- `stage-transitions-gallery.astro` (`display`): `parts` nach `:74–78` · keep:
  `store`, `assets.dot` (in dieser Reihenfolge: der Punkt geht vor dem Store,
  wie heute), `a` `:80`, `b` `:81`, `label` `:84`, `text` `:88` · onDispose:
  `gui` `:168` · weg: `:207–215`.
- `stage-transitions-game-menu.astro` (`display`): `parts` nach `:56–60` ·
  keep: `store`, `assets.dot`, `stars` `:62`, `title` `:63`, `level` `:64`,
  `pause` `:65` · Listener: neuer `listening` vor `:147`, Signal an `:147–149`
  · onDispose: `gui` `:172` · weg: `:181–192` · Kommentar `:40` nach Regel 8.
- `textured-sprites.astro` (`demo`): `parts` nach `:47–50` · keep: `store`,
  `sprites` `:54` · onDispose: `listening` `:64` · weg: `:98–103`.
- `ui-panels.astro` (`display`): `parts` nach `:114–117` · keep: `store`,
  `screen` `:122` · onDispose: `listening` `:144`, `readout` `:179` · weg:
  `:186–192`.

### Abnahme

Nach dem Umbau, aus `apps/lookbook/src/`, alle drei ohne Treffer (Exit 1):

```bash
grep -n 'removeEventListener' pages/demos/*.astro demos/map2d/*.ts
grep -n 'once(demo, OnDisplayDispose' demos/map2d/*.ts
grep -c 'new DemoParts(' pages/demos/*.astro demos/map2d/*.ts | grep ':0$' | grep -E 'animated-|atlas-frames|boomer|camera-rig|cardboard|first-sprite|platformer|rope-bridge|sine-scroller|sprite-reflection|stage-masks-|stage-post-process-etching|stage-transitions-|swaying-grass|textured-|ui-panels|vector-balls|map2d/map2d-'
```

Dazu: in keiner der 36 Dateien steht nach `new DemoParts(` noch ein
`display.onDispose(`/`demo.onDispose(` (die Blöcke vor dem Start, auch der neue
in into-the-map und vector-balls, stehen davor). Danach `pnpm run ci` (Lint,
`astro check` im Typecheck, Lookbook-Vitest mit `demoParts.spec.ts`).

**Kein Regressionstest**, mit Absicht: die Seiten haben keinen Testlauf, und
was sie gewinnen, ist das Verhalten von `DemoParts`, das
`demos/utils/demoParts.spec.ts` seit Paket 15 belegt (dort rot gesehen).
Belege dieses Pakets sind die Abnahme-Greps oben und der Typecheck, der jeden
`parts.keep()` gegen `{dispose(): void}` prüft. Ein Durchlauf von
`pnpm lookbook:generate-previews` ist nicht verlangt (schreibt getrackte
Bilder neu).

## Abgleich (Zug 0, gegen 5909821e)

- Alle 33 Seiten der Liste stehen, wie Paket 15 sie fand: Bauen nach dem
  `await`, Freigabe in einem Block am Ende der Init. Jede kann zwischen Laden
  und Block werfen — `atlasFrame()`/Szenen-Konstruktoren, `BitmapFont.parse()`,
  `makeNightCity()`, Kamera-Suchen im glTF, `bakeDataTexture()` —, und dann
  bleibt mindestens der Store liegen. Keine Seite fällt heraus.
- `start(async …)` statt `onDemoInit()`: `animated-billboards`,
  `atlas-frames-on-meshes`, `cardboard-parade`, `swaying-grass`, die drei
  `textured-quads*`, `vector-balls` und die drei map2d-Module. Für dieses Paket
  gleichgültig (`Display.ts:1299, 1307`). Dass ein Fehler dieser Inits nur als
  unbehandelte Rejection in der Konsole landet, ohne Demo-Namen und ohne die
  Zeile über der Canvas, ist eine andere Ursache → neu in »Offene Befunde«.
- Neu gleicher Ursache: `demos/map2d/map2d-tile-sprites.ts:82`,
  `map2d-rect-visi.ts:133`, `map2d-cam-visi.ts:118` registrieren ihre Freigabe
  per `once(demo, OnDisplayDispose, …)` am Ende der Init; ein fehlschlagendes
  Laden verliert dazu, was sie vor dem `await` gebaut haben. Seit `2e3f585b`
  unverändert (`git diff --stat 2e3f585b HEAD -- apps/lookbook/src/demos/map2d/`
  leer). Ins Paket: gleiche Ursache.
- `camera-rig-into-the-map.astro:432`: der vor dem Start gebaute Director geht
  nur im Block der Init — gleiche Ursache (Freigabe am Ende der Init), und die
  Umstellung muss ihm ohnehin einen Platz geben; die README verlangt für vor dem
  Start Gebautes ein `onDispose()` direkt danach. Ins Paket.
- `camera-rig-two-rooms.astro:106–115`: wirft vor der `isDisposed`-Prüfung und
  verliert das glTF — gleiche Ursache, ins Paket (Umstellung oben).

## Entscheidungen in Zug 0

- **Queue-Eintrag `removeEventListener()` ins Paket**, gegen den Hinweis aus
  Zug 0 von Paket 15. Zehn der elf Seiten nehmen ihre Listener genau in dem
  Block ab, den dieses Paket auflöst; jede Abnahme bekommt einen neuen Platz in
  `parts.onDispose()`, und dort als `removeEventListener()` geschrieben wäre sie
  eine neue Zeile gegen `apps/lookbook/README.md:92–95` — das Paket könnte die
  Seiten nicht regelkonform hinterlassen. Die elfte Stelle
  (`vector-balls.astro:54–55`, vor dem Start) liegt in einer Datei dieses
  Pakets und schließt den Eintrag ganz; sonst müsste die Drain-Runde dieselben
  Seiten noch einmal öffnen.
- **Die map2d-Module ins Paket**, `DemoParts` dort als erste Anweisung der
  Init: sie bauen vor dem `await`, und nur so geht auch das mit, wenn das Laden
  scheitert. Die README sagt »made as soon as the init has asked
  `display.isDisposed`« für das Bauen nach einem `await`; vor dem ersten
  `await` ist das Display lebendig (`Display.ts:1299`), und `new DemoParts()`
  würfe sonst selbst.
- **Reihenfolge:** »wie heute« heißt jede Abhängigkeit des heutigen Blocks, nicht
  dieselbe Abfolge unabhängiger Teile — so hat Paket 15 die Muster-Seite
  umgestellt (die drei Masken gehen jetzt rückwärts). Geprüft an jeder Seite;
  einzige Umstellung `stage-masks-without-director` (Pipeline vor Renderer
  bauen). In `map2d-rect-visi.ts` geht `map2d` nach der Tile-Geometrie,
  belegt sicher (siehe dort).
- **Ein Paket, nicht zwei:** 36 Dateien, ein Muster; der Reviewer prüft eine
  Umstellung, nicht 36 verschiedene. Ein Schnitt `onDemoInit`/`start` brächte
  zwei Kaltstart-Ketten für dieselbe Regel.
- **Effort medium, nicht low:** der Auftrag ist genau, aber lang und verlangt
  an jeder Seite, Freigabe gegen Bau abzugleichen und Kommentare umzusetzen.

## Findings im Volltext

**Paket 15b laut Plan · low · `apps/lookbook/src/pages/demos/` (33 Seiten)** —
Stellen gleicher Ursache wie `stage-masks-frozen.astro` (Paket 15) in 33
weiteren Demo-Seiten, vorbestehend (die Regel stand seit `2e3f585b` in
`apps/lookbook/README.md:86–87`: »what the init builds after an `await` by one
[`onDispose()`] at the end of the init«), in Zug 0 von Paket 15 gefunden. Wirft
ein Teil, den die Init nach dem Laden baut, wird der Block am Ende nie
registriert, und Store, Szenen und Listener bleiben liegen.
Empfehlung: die Seiten auf `DemoParts` umstellen, wie Paket 15 die
Muster-Seite; die README verlangt es seither (`apps/lookbook/README.md:86–92`).

**Queue, aus Paket 15, Zug 0 · info · `apps/lookbook/src/pages/demos/`** —
`platformer.astro`, `stage-masks-flashlight.astro`,
`stage-masks-matte-ink.astro`, `stage-masks-portal.astro`,
`stage-masks-resolution.astro`, `stage-masks-rift.astro`,
`stage-masks-shared.astro`, `stage-masks-spotlight.astro`,
`stage-masks-without-director.astro`, `stage-transitions-game-menu.astro`,
`vector-balls.astro`: nehmen Listener an Fenster, Canvas oder Dokument per
`removeEventListener()` ab, während `apps/lookbook/README.md:87–90` das
`signal` eines `AbortController` verlangt, das `onDispose()` abbricht; die
Listener gehen ab, nur in anderer Form (vorbestehend laut `git show 2e3f585b:`
je Seite und `…README.md:87–89`).

**Zug 0 von 15b · low · `apps/lookbook/src/demos/map2d/`** —
`map2d-tile-sprites.ts:82`, `map2d-rect-visi.ts:133`, `map2d-cam-visi.ts:118`:
dieselbe Freigabe am Ende der Init; ein Fehlschlag beim Laden verliert dazu
Rahmen, `Map2D`, Helfer und Punkte, die vor dem `await` gebaut wurden.
