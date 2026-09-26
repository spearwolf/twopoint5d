# Paket 10 — Lookbook auf den Store: jede Demo lädt über `TextureStore`

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ARCH-005 (medium, anteilig — die Lookbook-Seite; die Library-Seite hat Paket 6 in `e5a19377` erledigt, erst mit diesem Paket ist ARCH-005 geschlossen) · dazu aus »Offene Befunde« `apps/lookbook/public/assets/textures.json` (ein Katalog, den keine Seite lädt)
- Ziel: Jede Demo des Lookbooks, die ein Bild, ein Tile Set oder einen Atlas über einen der vier Callback-Loader lädt, lädt es über `TextureStore` mit `loadAsync()` und `getAsync()` aus dem Katalog `public/assets/textures.json`; keine Seite importiert mehr einen der vier Loader oder ruft die deprecated `load()`/`get()` des Stores, und die Metadaten nennen `TextureStore` statt der Loader.
- Modell: mittlere Stufe
- Effort: medium — der Code-Teil ist exakt vorgegeben, aber die Sichtprüfung (Dev-Server, Screenshots, Urteil Bild gegen Bild) ist keine Transkription
- Dateien:
  - neu geschrieben: `apps/lookbook/public/assets/textures.json`
  - geändert: `apps/lookbook/src/demos/map2d/map2d-cam-visi.ts`, `map2d-rect-visi.ts`, `map2d-tile-sprites.ts`; `apps/lookbook/src/pages/demos/animated-billboards.astro`, `animated-sprites.astro`, `textured-quads.astro`, `textured-quads-from-tileset.astro`, `textured-quads-from-texture-atlas.astro`, `textured-sprites.astro`; die Metadaten `_animated-billboards.json`, `_map2d-cam-visi.json`, `_map2d-rect-visi.json`, `_map2d-tile-sprites.json`, `_textured-sprites.json`, `_textured-quads.json`, `_textured-quads-from-tileset.json`, `_textured-quads-from-texture-atlas.json`; `apps/lookbook/src/data/tag-categories.json`; `apps/lookbook/README.md`
  - gelöscht: `apps/lookbook/src/pages/demos/textured-quads-po2image-loader.astro`, `apps/lookbook/src/pages/demos/_textured-quads-po2image-loader.json`, `apps/lookbook/public/images/demo-preview/textured-quads-po2image-loader.png`, `apps/lookbook/public/assets/platform-blau.png`
  - nicht angefasst: alles unter `packages/`, `apps/lookbook/public/assets/nobingers.json`, die Seiten, die `TextureFactory#load()` benutzen (`display-minimal.astro`, `display-multi.astro`, `stage-nested-pipelines.astro`, `stage-postprocessing.astro`), und der three.js-`TextureLoader` für den Boden in `animated-billboards.astro`
- Vorgehen:
  0. **Vorher-Bilder, bevor eine Datei geändert wird.** Arbeitsverzeichnis für alles Folgende: `ARBEITSDIR=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0b6aa1e7-f4dd-40ca-8a4b-c96b3bffeabf/scratchpad` — nichts davon ins Repo.
     - Dev-Server abgekoppelt starten, mit eigener Prozessgruppe, damit er am Ende gezielt endet (auf dem Rechner laufen andere Sessions, kein `pkill astro`):
       `setsid bash -c 'echo $$ > "$0/paket-10.lookbook.pgid"; exec pnpm lookbook' "$ARBEITSDIR" > "$ARBEITSDIR/paket-10.lookbook.log" 2>&1 < /dev/null &`
       `pnpm lookbook` baut die Library zuerst (`^build`). Warten, bis im Log die Zeile mit `Local` und der URL steht, und den Port **aus dem Log** lesen — ist 4321 belegt, nimmt Astro den nächsten.
     - Diese neun Routen unter `http://localhost:<port>/lookbook/demos/`: `map2d-cam-visi`, `map2d-rect-visi`, `map2d-tile-sprites`, `animated-billboards`, `animated-sprites`, `textured-quads`, `textured-quads-from-tileset`, `textured-quads-from-texture-atlas`, `textured-sprites`. Je Route: laden, auf `networkidle` warten, dann 3 s, Screenshot des Viewports nach `$ARBEITSDIR/paket-10-shots/before/<route>.png`, dazu jede Konsolenmeldung der Stufe `error` und jeden `pageerror` mitschreiben.
     - Werkzeug: die Playwright-MCP-Werkzeuge, wenn sie da sind (`browser_navigate`, `browser_wait_for`, `browser_take_screenshot`, `browser_console_messages`). Sonst ein Wegwerfskript `$ARBEITSDIR/paket-10-shots.mjs` mit `import {chromium} from 'playwright'` (das Repo-Root hat `playwright` als devDependency), gestartet **aus dem Repo-Root** mit `node --input-type=module < "$ARBEITSDIR/paket-10-shots.mjs"`, damit der Import gegen `node_modules` des Roots auflöst. Die Positionen der Quads und Sprites sind zufällig: ein Pixelvergleich sagt nichts, verglichen wird mit dem Auge.
  1. **`apps/lookbook/public/assets/textures.json`** bekommt genau diesen Inhalt (danach `pnpm format` bzw. Prettier entscheidet über Zeilenumbrüche; Inhalt und Reihenfolge nicht ändern):
     ```json
     {
       "items": {
         "ballPatternRot": {
           "imageUrl": "ball-pattern-rot--not-power-of-2.png",
           "texture": ["nearest", "srgb"]
         },
         "ballPatternTiles": {
           "imageUrl": "ball-patterns.png",
           "tileSet": {"tileWidth": 128, "tileHeight": 128},
           "texture": ["nearest", "srgb"]
         },
         "glaskugelnTiles": {
           "imageUrl": "glaskugeln-2-256x.png",
           "tileSet": {"tileWidth": 256, "tileHeight": 256},
           "texture": ["nearest", "srgb"]
         },
         "happyWurmFace": {
           "imageUrl": "happy-wurm-face.png",
           "texture": ["linear", "flipy", "srgb"]
         },
         "labWallsAtlas": {
           "atlasUrl": "lab-walls-tiles.json",
           "texture": ["nearest", "srgb"]
         },
         "map2dDebugTiles": {
           "imageUrl": "map2d-debug-tiles_4x256x256.png",
           "tileSet": {"tileWidth": 256, "tileHeight": 256},
           "texture": ["nearest", "srgb"]
         },
         "nobingerTiles": {
           "imageUrl": "nobinger-anim-sheet.png",
           "tileSet": {"tileWidth": 64, "tileHeight": 64, "margin": 1},
           "texture": ["nearest", "srgb"]
         },
         "skinballTiles": {
           "imageUrl": "skinball-256.png",
           "tileSet": {"tileWidth": 256, "tileHeight": 256},
           "texture": ["nearest", "srgb"]
         },
         "splotchs": {
           "atlasUrl": "splotchs-256x.json",
           "texture": ["srgb"]
         }
       }
     }
     ```
     Die URLs sind relativ zum Katalog (`loadAsync()` löst sie gegen die URL der Json auf), `meta.image` von `lab-walls-tiles.json` gegen die Atlas-Json. `happyWurmFace` und `splotchs` bleiben mit ihren Klassen, wie sie waren, nur die URLs werden relativ; `ballPatternRot` verliert `flipy` (die Loader setzen `flipY: false`, der Store ebenso — mit `flipy` stünde das Bild auf `textured-quads` kopf).
  2. **Das gemeinsame Muster** jeder umgezogenen Stelle, jeweils im Callback, der den Renderer als Argument bekommt (`Display#start(beforeStartCallback)` bzw. `Display#onInit()` reichen `DisplayEventProps` mit `renderer: WebGPURenderer` herein — dort nie `undefined`):
     ```ts
     const store = new TextureStore(renderer);
     // the catalog of the lookbook, public/assets/textures.json, names the image, tile set and texture classes of each item
     await store.loadAsync(assetsUrl('textures.json'));
     const [tileSet, texture] = await store.getAsync('<id>', ['tileSet', 'texture']);
     ```
     Der Import des Loaders wird zum Import von `TextureStore` aus `@spearwolf/twopoint5d`, einsortiert in die bestehende alphabetische Liste. Wo der Callback bisher `async () =>` war, wird er `async ({renderer}) =>`. Liest derselbe Callback schon `demo.renderer!`, wird daraus `renderer` (nur in diesen Callbacks, nirgends sonst).
  3. **`apps/lookbook/src/demos/map2d/map2d-cam-visi.ts`**: Import `TileSetLoader` (`:8`) → `TextureStore`; `demo.start(async () =>` (`:20`) → `async ({renderer}) =>`; der Loader-Block `:47-54` → Muster aus Schritt 2 mit der id `'ballPatternTiles'`.
  4. **`map2d-rect-visi.ts`**: Import `:11` → `TextureStore`; Start-Callback `:23` mit `{renderer}`; Loader-Block `:75-82` → Muster mit `'map2dDebugTiles'`. Im `OnDisplayDispose`-Handler wird `texture.dispose();` (`:134`) an derselben Stelle der Reihenfolge zu
     ```ts
     // the texture belongs to the store, which releases it with its resource
     store.dispose();
     ```
  5. **`map2d-tile-sprites.ts`**: Import `:7` → `TextureStore`; Start-Callback `:18` mit `{renderer}`; Loader-Block `:34-41` → Muster mit `'map2dDebugTiles'`.
  6. **`animated-billboards.astro`**: Import `TileSetLoader` (`:43`) → `TextureStore`; `await demo.start(async () =>` (`:53`) → `async ({renderer}) =>`; Loader-Block `:60-68` → Muster mit `'nobingerTiles'`. Die Seite baut ihre `FrameBasedAnimations` weiter selbst (`anims.add('anim0', 0.66, tileSet, [1, 2, 3, 4, 5, 4, 3, 2])`), der Boden bleibt beim three.js-`TextureLoader`.
  7. **`animated-sprites.astro`** (steht schon auf dem Store, Katalog `nobingers.json` bleibt): `store.load(assetsUrl('nobingers.json'));` (`:85`) → `await store.loadAsync(assetsUrl('nobingers.json'));`, das `console.log('loading textures...', store)` samt seinem `eslint-disable`-Kommentar (`:87-88`) wandert **vor** diese Zeile, damit es vor dem Laden erscheint; `store.get(` (`:90`) → `store.getAsync(`. Der `error`-Listener `:80-83` bleibt.
  8. **`textured-quads.astro`**: Import (`:41`) → `{colorFromTextureByTexCoords, TextureStore, vertexByInstancePosition, VertexObjects}`. Der Block vor `demo.start()` (`:122-131`: Loader-Aufruf, `console.log`, Vorschau) entfällt dort und steht im Start-Callback (`:133`, jetzt `async ({renderer}) =>`), nach den zwei Tone-Mapping-Zeilen (die zu `renderer.toneMapping = AgXToneMapping;` und `renderer.toneMappingExposure = 1.1;` werden) und vor `demo.scene.add(...)`:
     ```ts
     const store = new TextureStore(renderer);
     // the catalog of the lookbook, public/assets/textures.json, names the image, tile set and texture classes of each item
     await store.loadAsync(assetsUrl('textures.json'));
     const [texCoords, texture] = await store.getAsync('ballPatternRot', ['imageCoords', 'texture']);

     // eslint-disable-next-line no-console
     console.log('loaded texture-image', {texCoords, texture});

     <Vorschau-Block aus Schritt 11>
     ```
     `createMesh(16, 32, 3.7, 1, texCoords, texture)` bleibt, wie es ist.
  9. **`textured-quads-from-tileset.astro`**: Import (`:59`) → `TextureStore`; Start-Callback `:117` mit `{renderer}`, `demo.renderer!.toneMapping = NeutralToneMapping;` → `renderer.toneMapping = NeutralToneMapping;`; Loader-Block `:120-127` → Muster mit `'glaskugelnTiles'`; `console.log('loaded tileset', {tileSet, texture})` (ohne `imgEl`); die Vorschau `:132-133` → Vorschau-Block aus Schritt 11.
  10. **`textured-quads-from-texture-atlas.astro`**: Import (`:38`) → `TextureStore`; Start-Callback `:92` mit `{renderer}`; Loader-Block `:93-96` → Muster mit `const [atlas, texture] = await store.getAsync('labWallsAtlas', ['atlas', 'texture']);`; `console.log('loaded texture-atlas', {atlas, texture})`; die Vorschau `:101-102` → Vorschau-Block aus Schritt 11.
  11. **Vorschau-Block** der drei `textured-quads*`-Seiten — eine Kopie, nie das Bild der Texture selbst:
      ```ts
      // a copy: an <img> in the layout answers width and height as its CSS sizes it, and three.js
      // reads the size of the texture from there
      if (texture.image instanceof HTMLImageElement) {
        // the <div id="texture-preview"> is written by the markup of this very page
        document.getElementById('texture-preview')!.appendChild(texture.image.cloneNode());
      }
      ```
      Grund: `Textures#getSize()` in three.js 0.185 liest für ein Bild `image.width`/`image.height`, und ein `<img>` im Layout (`max-width: 100%` in `.texture-preview`) antwortet dort in CSS-Pixeln; das Bild liegt zudem im Bild-Cache des Stores. `texture.image` ist als `unknown` typisiert, die `instanceof`-Probe engt ein, ohne Cast.
  12. **`textured-sprites.astro`**: Import `{TexturedSprites, TileSetLoader}` (`:39`) → `{TexturedSprites, TextureStore}`; `demo.onInit(async () =>` (`:50`) → `async ({renderer}) =>`; Loader-Block `:51-58` → Muster mit `'skinballTiles'`.
  13. **Metadaten**: in `_animated-billboards.json`, `_map2d-cam-visi.json`, `_map2d-rect-visi.json`, `_map2d-tile-sprites.json`, `_textured-sprites.json`, `_textured-quads-from-tileset.json` wird der Tag `"TileSetLoader"`, in `_textured-quads-from-texture-atlas.json` `"TextureAtlasLoader"`, in `_textured-quads.json` `"TextureImageLoader"` jeweils **an seiner Stelle** durch `"TextureStore"` ersetzt. In `src/data/tag-categories.json`, Kategorie »Textures«, fallen `"TextureAtlasLoader"`, `"TextureImageLoader"`, `"TileSetLoader"` und `"PowerOf2ImageLoader"` weg; `"TextureStore"` steht dort schon.
  14. **Die Demo des `PowerOf2ImageLoader` entfällt** — sie zeigt nur das Auffüllen auf Zweierpotenzen, das der Store nach der Entscheidung vom 2026-09-26 nicht bekommt: `git rm` auf `src/pages/demos/textured-quads-po2image-loader.astro`, `src/pages/demos/_textured-quads-po2image-loader.json`, `public/images/demo-preview/textured-quads-po2image-loader.png` und `public/assets/platform-blau.png` (einziger Verbraucher war diese Seite, `:91`).
  15. **`apps/lookbook/README.md`**: die Zahl der Demo-Seiten von 17 auf 16 an allen vier Stellen — `:3` (»17 runnable demos«), `:17` (»17 demo pages«), `:18` (»17 metadata files«), `:28` (»All 17 demo pages«).
  16. `pnpm format`, dann `git grep -nE 'PowerOf2ImageLoader|TextureImageLoader|TextureAtlasLoader|TileSetLoader|store\.(load|get)\(' -- apps/lookbook` — muss leer sein.
  17. **Nachher-Bilder** mit demselben Dev-Server (er lädt die Änderungen nach; hängt er, neu starten wie in Schritt 0) für dieselben neun Routen nach `$ARBEITSDIR/paket-10-shots/after/<route>.png`, dazu die Übersicht `http://localhost:<port>/lookbook/` (16 Karten, keine Karte der entfallenen Demo, keiner der vier Loader-Tags in der Tag-Wolke). Vergleich je Route mit dem Auge, vorher gegen nachher: dieselbe harte Pixelkante (`nearest`, kein Weichzeichnen), dieselben Farben (`srgb`), Kacheln und Frames aufrecht und am selben Platz im Bild, keine leere oder schwarze Fläche, keine neue Konsolenmeldung der Stufe `error`. **Erwartet und kein Rückschritt:** die Vorschau auf `textured-quads` (Bild 197×205) und `textured-quads-from-texture-atlas` (Bild 344×54) zeigt das Bild ohne den transparenten Rand, mit dem der Loader es auf 256×256 bzw. 512×64 aufgefüllt hat. Danach den Dev-Server beenden: `kill -- -"$(cat "$ARBEITSDIR/paket-10.lookbook.pgid")"`, und prüfen, dass der Port frei ist.
  18. Kein CHANGELOG-Eintrag: das Paket ändert nichts an `@spearwolf/twopoint5d`, das Lookbook wird nicht mit dem Paket veröffentlicht, und die Lookbook-Teile der Pakete 3 und 9 dieses Laufs haben ebenfalls keinen bekommen. Kein Regressionstest: kein Korrektheitsfehler, sondern ein Umzug ohne Verhaltensänderung der Library; der Beleg sind der leere `git grep` aus Schritt 16, `scripts/lookbook/demoMetadata.test.mjs` (Tags und Routen, läuft in `pnpm run ci`) und die Sichtprüfung.
  19. Report zusätzlich zu den Pflichtfeldern: je Route das Urteil der Sichtprüfung in einer Zeile und die Pfade der beiden Screenshot-Verzeichnisse.
- Verify: `pnpm run ci && ! git grep -nE 'PowerOf2ImageLoader|TextureImageLoader|TextureAtlasLoader|TileSetLoader|store\.(load|get)\(' -- apps/lookbook`
- Commit: `refactor(lookbook): load the images, tile sets and the atlas of the demos through TextureStore with loadAsync() and getAsync() from the catalog in public/assets/textures.json, whose items name nearest where the callback loaders applied it by default, show a copy of the image in the texture previews, let the store of the map2d-rect-visi demo release its texture, tag the demos with TextureStore, and drop the demo of PowerOf2ImageLoader, whose padding to powers of 2 the store does not have`
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · ARCH-005 Library-Seite in `e5a19377` erledigt (Loader `@deprecated`, Klassen-TSDoc `TextureStore.ts:163-179`), Lookbook-Seite unverändert, seit `ee725355` kein Commit unter `apps/lookbook/` · neun Loader-Stellen und `animated-sprites.astro:85,90` bestätigt, Zeilen im Plan teils innerhalb des `<script>`-Blocks gezählt, hier Dateizeilen · Nebenbefund `textures.json` aufgenommen (gleiche Ursache) · Folgen offen: keine · neu im Bereich: `textures.json`, `platform-blau.png`, `apps/lookbook/README.md` · Ziel präzisiert (auch im Plan) · Restplan: kein offenes Paket dahinter, Reihenfolge unverändert; übrige »Offene Befunde« teilen die Ursache nicht und bleiben für die Drain-Runde
  - 2026-09-26 Zug 1: Implementierer beauftragt (sonnet, effort medium), Brief `paket-10.impl-0.brief.md`, Report nach `paket-10.impl-0.json`
  - 2026-09-26 Zug 2: Report FERTIG_MIT_VORBEHALT (Vorbehalt: Astro-Dev-Server koppelt sich über Nx ab, die gespeicherte PGID griff nicht; beendet über `kill -- -<pgid des astro dev>`, Port frei) · 24 Pfade unter `apps/lookbook/` (4 gelöscht) · Arbeitsbaum schmutzig · Verify `paket-10.verify.log` exit=0 · Sichtprüfung 9 Routen + Übersicht OK, Shots `paket-10-shots/before|after/`
  - 2026-09-26 Zug 3: Reviewer (sonnet, effort medium) — freigeben, ARCH-005 (Lookbook-Seite) und `textures.json` behoben, 3 kleine Befunde · Diff `paket-10.diff`, Report `paket-10.review-0.json`
  - 2026-09-26 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-26 Zug 5: committet `2f8804a8` mit Trailer `Remediation-Run: 2026-09-26` · Verify `paket-10.verify.log` exit=0 (kein Code seit dem Lauf geändert) · Plan auf `[x]`, 1 Nebenbefund in »Offene Befunde«

## Abgleich

Gegen `e5a19377` (HEAD). `git diff --stat ee725355 HEAD -- apps/lookbook` ist leer.

- **ARCH-005, Library-Seite** — erledigt in Paket 6: die vier Loader samt Typen `@deprecated`, der Absatz über beide Wege steht in der Klassen-TSDoc von `TextureStore` (`packages/twopoint5d/src/texture/TextureStore.ts:163-179`), der Migration Guide unter »The callback loaders give way to `TextureStore`« (`packages/twopoint5d/CHANGELOG.md:2765`).
- **ARCH-005, Lookbook-Seite** — unverändert. Loader-Aufrufe (Dateizeilen): `apps/lookbook/src/demos/map2d/map2d-cam-visi.ts:47`, `map2d-rect-visi.ts:75`, `map2d-tile-sprites.ts:34`, `apps/lookbook/src/pages/demos/animated-billboards.astro:60`, `textured-sprites.astro:51`, `textured-quads-from-tileset.astro:120`, `textured-quads-from-texture-atlas.astro:93`, `textured-quads.astro:122`, `textured-quads-po2image-loader.astro:91`; deprecated Store-Namen `animated-sprites.astro:85` (`store.load()` ohne `await`), `:90` (`store.get()`). Der Plan nannte für `textured-quads.astro`, `-from-tileset` und `-from-texture-atlas` die Zeilen innerhalb des `<script>`-Blocks (`:84`, `:64`, `:58`).
- **Renderer-Zeitpunkt** — `PerspectiveOrbitDemo` baut den Renderer im Konstruktor, `Display#start(cb)` wartet `renderer.init()` ab und reicht `DisplayEventProps` (`renderer: WebGPURenderer`) an den Callback, `Display#onInit` ebenso. Der Store bekommt den Renderer in genau diesem Callback; auf `textured-quads` wandert das Laden deshalb aus der Zeit vor `demo.start()` hinein. Ein `TextureFactory` vor `init()` läse das Anisotropie-Maximum aus einem Backend ohne `capabilities` und bliebe bei 0.
- **Texture-Klassen** — die Loader bauen `new TextureFactory()` mit der Vorgabe `['nearest']` und dem Seed `{anisotropy: 0, flipY: false}`, der Store `new TextureFactory(renderer, [])` mit demselben Seed und ohne Klasse (`TextureStore.ts:332`). Jede umgezogene Seite übergibt heute `['srgb']` oder `['nearest', 'srgb']`, wirksam also überall `nearest` + `srgb` — so steht es auf jedem neuen Item.
- **Bildgrößen** — `ball-pattern-rot--not-power-of-2.png` 197×205, `lab-walls-tiles.png` 344×54, `nobinger-anim-sheet.png` 322×66 sind keine Zweierpotenzen; die Loader füllen sie auf eine Canvas auf und geben Koordinaten als Kind davon heraus, der Store nimmt das Bild, wie es ist, mit `imageCoords` als Wurzel. `setQuadTexCoords()` und die Tile Sets greifen damit dieselben Pixel. `glaskugeln-2-256x.png` (1024×256), `skinball-256.png`, `ball-patterns.png` (256×256), `map2d-debug-tiles_4x256x256.png` (512×512) sind Zweierpotenzen.
- **Vorschau** — `textured-quads.astro:131` und `textured-quads-from-texture-atlas.astro:102` hängen heute `imgEl` selbst ein (bei 197×205 und 344×54 die aufgefüllte Canvas), `textured-quads-from-tileset.astro:133` eine Kopie. `Textures#getSize()` (`three@0.185.1`, `src/renderers/common/Textures.js:478-479`) liest für ein Bild `image.width`/`image.height` — ein `<img>` im Layout antwortet dort mit seiner CSS-Größe. Daher überall eine Kopie.
- **`textures.json`** (Nebenbefund aus Paket 3) — `git grep textures.json` findet keinen Verbraucher; die drei Items nennen absolute URLs `/lookbook/assets/…`, `ballPatternRot` mit `flipy`. `ballPatternRot` ist genau das Bild von `textured-quads`.
- **`platform-blau.png`** — einziger Verbraucher ist `textured-quads-po2image-loader.astro:91`.
- **`apps/lookbook/README.md`** — nennt 17 Demo-Seiten an vier Stellen (`:3`, `:17`, `:18`, `:28`); nach dem Wegfall sind es 16.
- **Außerhalb** — `TextureFactory#load()` in `display-minimal.astro:31`, `display-multi.astro:107`, `stage-nested-pipelines.astro:30-31` und `stage-postprocessing.astro:52`, der three.js-`TextureLoader` in `animated-billboards.astro:98`: keiner davon ist einer der beiden Stacks, die ARCH-005 nennt, und `TextureFactory#load()` ist nicht deprecated. `packages/twopoint5d-testing/test/texture-store-on.test.js` nutzt Lookbook-Assets, aber weder `textures.json` noch `platform-blau.png`.

## Entscheidungen in Zug 0

- **Ein Katalog statt `parse()` auf jeder Seite.** Der Migration Guide zeigt den Eins-zu-eins-Ersatz eines Loader-Aufrufs mit `store.parse({items: …})`; das Ziel dieses Pakets nennt `loadAsync()`. Mit dem Katalog zeigt das Lookbook den anderen, im TSDoc zuerst genannten Weg — Katalog holen, nehmen, was die Seite braucht, relative URLs gegen den Katalog —, und der tote `textures.json` bekommt Verbraucher. Beide Wege sind danach dokumentiert: der eine im CHANGELOG, der andere im Lookbook. Ein gemeinsamer Katalog statt einem je Seite: die Items sind lazy (eine Resource lädt erst mit `activate()`, das `on()`/`getAsync()` auslöst), sieben Items mehr im `parse()` kosten nichts, und `map2d-rect-visi` und `map2d-tile-sprites` teilen ein Item.
- **`nobingers.json` bleibt eigener Katalog** von `animated-sprites`: er ist in Gebrauch und richtig; ihn in `textures.json` zu falten, änderte nichts Sichtbares. Seine Klassen (`['srgb']`, also linear gefiltert) bleiben — `animated-billboards` bekommt mit `nobingerTiles` ein eigenes Item mit `nearest`, sonst änderte sich eine der beiden Seiten.
- **`texture` je Item statt `defaultTextureClasses`.** Ein Katalog-Default `['nearest', 'srgb']` hätte auch `splotchs` (`['srgb']`) auf `nearest` gezogen; je Item bleibt jedes vorhandene Item, wie es war, und es liest sich wie der Satz im Migration Guide (»`nearest` is named on the item where the loader applied it by default«).
- **`happyWurmFace` und `splotchs` bleiben im Katalog**, ohne Verbraucher unter den Seiten: sie zu streichen, ließe `happy-wurm-face.png` und `splotchs-256x.*` ohne jede Referenz zurück, und das Beispiel im Migration Guide (`CHANGELOG.md:2636-2669`) spiegelt `splotchs`. Ein Katalog darf mehr nennen, als eine Seite zeigt.
- **Der Nebenbefund `textures.json` gehört hierher**: dieselbe Ursache wie die Lookbook-Seite von ARCH-005 — das Lookbook lädt über die Loader, und die Store-Hälfte, die dieser Katalog sein sollte, wurde nie angeschlossen.
- **Ziel präzisiert** (auch im Plan): »jede Demo« heißt jede, die über einen der vier Callback-Loader lädt. Die Seiten mit `TextureFactory#load()` und der three.js-`TextureLoader` stehen nicht im Bereich des Plans und nicht in ARCH-005.
- **`platform-blau.png` und die README-Zahl** kommen dazu, weil der Wegfall der Demo sie umwirft: ein Asset ohne Verbraucher, eine Zahl, die danach lügt.
- **Kein Test, der das Lookbook von deprecated Exporten fernhält.** Er stünde in keinem Finding; der `git grep` im Verify-Kommando hält den Stand dieses Commits fest.

## Findings im Volltext

**ARCH-005 · medium · packages/twopoint5d/src/texture/public-api.ts:1** — Zwei Lade-Stacks im texture-Modul mit unterschiedlichem Verhalten für dasselbe Asset

Das Modul exportiert zwei Generationen: die Callback-Loader `PowerOf2ImageLoader`, `TextureImageLoader`, `TextureAtlasLoader` und `TileSetLoader` (`load(cb, errCb)` plus `loadAsync`) und den signal-basierten `TextureStore` mit `TextureResource`. Die Loader polstern jedes Nicht-Zweierpotenz-Bild über einen Canvas auf und liefern `texCoords` als Kind eines größeren Root; die Resource lädt roh über `ImageLoader`. Dasselbe PNG ergibt je nach Weg eine andere Textur und andere UV-Wurzeln. Die Lookbook nutzt beide Wege nebeneinander. Re-Check dieses Laufs: unverändert, beide Stacks sind exportiert und dokumentieren ihr Verhältnis nirgends.

Empfehlung: Entscheiden, welcher Stack die Zukunft ist. Naheliegend: die Callback-Loader als `@deprecated` markieren, das POT-Padding als Option in `TextureResource` anbieten oder ganz streichen, und die map2d-Demos auf den Store umstellen. Bis dahin ein Absatz im Modul, der die beiden Wege und ihren Unterschied benennt.

Stand: Entscheidung vom 2026-09-26 — Store ist die Zukunft, Loader `@deprecated`, POT-Padding wird nicht portiert (Paket 6). Offen ist allein, dass das Lookbook beide Wege nebeneinander nutzt; das schließt dieses Paket.

**Nebenbefund · info · apps/lookbook/public/assets/textures.json** — ein Katalog, den keine Seite des Lookbooks lädt (`git grep textures.json` findet keinen Verbraucher, an `fceda80b` ebenso); vorbestehend, aufgefallen in Paket 3, Zug 0, Urteil → Scope. Aufgenommen in Zug 0 dieses Pakets (gleiche Ursache, siehe »Entscheidungen in Zug 0«).

## Urteil des Reviewers

- **ARCH-005 (Lookbook-Seite)** — behoben: alle neun Loader-Stellen laufen über `new TextureStore(renderer)`, `loadAsync(assetsUrl('textures.json'))` und `getAsync(…)` — `map2d-cam-visi.ts:47`, `map2d-rect-visi.ts:75`, `map2d-tile-sprites.ts:34`, `animated-billboards.astro:60`, `textured-sprites.astro:51`, `textured-quads-from-tileset.astro:120`, `textured-quads-from-texture-atlas.astro:93`, `textured-quads.astro:126`; `animated-sprites.astro:78-90` auf `loadAsync`/`getAsync`; die Demo des `PowerOf2ImageLoader` samt Metadaten, Vorschaubild und `platform-blau.png` entfernt; `git grep` auf Loader- und deprecated Store-Namen unter `apps/lookbook` leer. Mit Paket 6 (`e5a19377`) ist ARCH-005 geschlossen.
- **Nebenbefund `textures.json`** — behoben: `apps/lookbook/public/assets/textures.json` hat sieben Verbraucher, URLs relativ, `ballPatternRot` ohne `flipy`.

## Kleine Befunde

- Reviewer: `map2d-cam-visi.ts:47` und `map2d-tile-sprites.ts:34` legen einen `TextureStore` an und geben ihn nie frei (vorbestehend, die Demos haben gar keinen Dispose-Handler) — als Nebenbefund in »Offene Befunde«, `→ Scope`: Lookbook-Stelle, die texture benutzt.
- Reviewer: das Katalog-Muster samt Kommentar steht siebenmal, der Vorschau-Block dreimal wortgleich — vom Plan so vorgegeben, ein gemeinsamer Helfer wäre eine eigene Änderung.
- Reviewer: ist `texture.image` kein `HTMLImageElement`, fehlt die Vorschau stumm — bei PNG-Assets nicht erreichbar.
- Implementierer: `pnpm lookbook` startet Astro über Nx als eigenen Daemon mit eigener Prozessgruppe; die in Schritt 0 gespeicherte PGID erreicht ihn nicht. Beendet über die Gruppe des `astro dev`-Prozesses, Port danach frei. Für eine spätere Sichtprüfung: PID aus dem Prozess `astro dev` nehmen, nicht aus dem Wrapper.
- Implementierer: eine Leerzeile zwischen `getAsync(…)` und `console.log` in `textured-quads.astro`, die die Vorlage nicht nannte; Verify lief auf dem Stand danach.
