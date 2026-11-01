# Paket 13b — Lookbook: Assets der Masken-Szenen über TextureStore laden

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: CONS-002 (low), BUG-012 (low), READ-003 (low), dazu der Atlas-Teil von ARCH-001 (low) — im
  Zug 0 von Paket 13 abgeteilt; ARCH-001 schließt mit diesem Paket
- Dazu (Zug 0, vorbestehend, gleiche Ursache — eine Demo holt ein Asset an der Textur-API der Library
  vorbei bzw. per `fetch()` ohne Statusprüfung, und ein Fehlschlag lässt Geladenes liegen):
  `src/demos/stage-transitions/assets.ts:33` (`loadFont`) und `:62-68` (Store ohne `dispose()` bei
  Fehlschlag), `src/pages/demos/sine-scroller.astro:103` (`loadFont`) und `:113-133`,
  `src/pages/demos/ui-panels.astro:97` (`.fnt` per `fetch().text()`) und `:93-101`,
  `src/pages/demos/animated-billboards.astro:100` (eigener `TextureLoader` neben dem Katalog-Store
  derselben Seite). Alle vier an d9b648bf schon so (nachgesehen mit `git show`)
- Ziel: Die zwölf Szenen-Module unter `stage-masks/` laden ihre Bilder und Atlanten über einen
  `TextureStore` mit unveränderten Texturoptionen, lesen Frames über `TextureAtlas` statt eigener
  UV-Rechnung, holen ihre Layout-JSONs über einen gemeinsamen Helfer, der `response.ok` prüft und Datei
  samt Status nennt, geben bei einem Fehlschlag Geladenes frei, und kein Feld verdeckt das globale
  `window`.
- Modell: stärkste Stufe (Umbau über zwölf Szenen-Module, 16 Seiten und zwei Helfer-Module; keine
  Testoberfläche im Lookbook, die Richtigkeit hängt an Texturoptionen und UV-Konventionen)
- Effort: medium (Klassen, Signaturen und Ersetzungen stehen unten exakt)
- Dateien (alle unter `apps/lookbook/`):
  - neu `src/demos/utils/fetchAsset.ts`
  - `src/demos/stage-masks/helpers.ts` (drei Atlas-Helfer dazu)
  - die Loader und Atlas-Stellen in `src/demos/stage-masks/`: `Crawlspace.ts`, `CrematoriumWindow.ts`,
    `DeepListening.ts`, `DrownedHouse.ts`, `FoundFootage.ts`, `MirrorBathroom.ts`, `MothChapel.ts`,
    `PaintingHallway.ts`, `SeancePhotographs.ts`, `Trench.ts`, `WardC.ts`, `WatchingWallpaper.ts`,
    dazu `RoseWindow.ts` (READ-003); `PaintedMoor.ts` bleibt unverändert (Signatur von `setFrame()`
    aus `PaintingHallway.ts` bleibt)
  - die zwölf Masken-Seiten `src/pages/demos/stage-masks-{flashlight,heat-haze,rift,matte-ink,shared,
    matte-3d,frozen,portal,resolution,matte-threshold,spotlight,without-director}.astro` (je Import
    und zwei Dispose-Zeilen)
  - `src/demos/stage-transitions/assets.ts`, `src/pages/demos/sine-scroller.astro`,
    `src/pages/demos/ui-panels.astro`, `src/pages/demos/animated-billboards.astro`,
    `public/assets/textures.json` (ein Eintrag)
  - `README.md` des Lookbooks (»Adding a demo«, ein Satz)
  - kein Library-Code, kein CHANGELOG, nichts unter `assets-src/` und `public/assets/stage-masks/`,
    keine Vorschaubilder
- Vorgehen:
  0. **Vorher-Bilder, bevor eine Zeile geändert ist** (Schritt 9 braucht sie). Aus dem Repo-Root:
     `pnpm lookbook:generate-previews --only=<LISTE>` mit `<LISTE>` =
     `stage-masks-flashlight,stage-masks-heat-haze,stage-masks-rift,stage-masks-matte-ink,stage-masks-shared,stage-masks-matte-3d,stage-masks-frozen,stage-masks-portal,stage-masks-resolution,stage-masks-matte-threshold,stage-masks-spotlight,stage-masks-without-director,stage-transitions-gallery,stage-transitions-game-menu,sine-scroller,ui-panels,animated-billboards`.
     Endet der Lauf mit Exit 2 (kein WebGPU-Adapter), denselben Aufruf mit `--allow-webgl2`
     wiederholen und das im Report vermerken. Die geschriebenen
     `apps/lookbook/public/images/demo-preview/<name>.webp` nach
     `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-13b-previews/before/` kopieren, dann
     `git checkout -- apps/lookbook/public/images/demo-preview/` — die Vorschaubilder gehören nicht in
     den Commit. Danach die Proben aus Schritt 8 schreiben und rot laufen lassen.
  1. **`src/demos/utils/fetchAsset.ts`** (neu), zwei Exporte, je mit TSDoc:
     - `fetchText(subject: string, url: string): Promise<string>` — `fetch(url)`; ein `fetch()`, das
       selbst ablehnt, wird zu `new Error(`${subject}: ${url} could not be fetched`, {cause})`; eine
       Antwort mit `!response.ok` zu `new Error(`${subject}: ${url} answered ${response.status}`)`;
       sonst `response.text()`.
     - `fetchJson<T>(subject: string, url: string): Promise<T>` — `fetchText()`, dann `JSON.parse()`;
       ein Body, der kein JSON ist, wird zu `new Error(`${subject}: ${url} is no JSON`, {cause})` (der
       `SyntaxError` als `cause`). Kein `as` — `JSON.parse()` liefert `any`. Das TSDoc sagt, dass die
       Form nicht geprüft wird: die Layout-Dateien sind Ausgaben der Generatoren unter `assets-src/`,
       mit ihrer Demo committet, und `assets-src/README.md` ist ihr Vertrag; was die Library liest
       (die Atlanten), prüft der `TextureStore`.
     - `subject` ist in den Szenen der Modulname, wie in ihren übrigen Meldungen (`'Crawlspace'`,
       `'MothChapel'` …), in den Seiten der Demo-Name (`'sine-scroller'`, `'ui-panels'`), in
       `stage-transitions/assets.ts` `'loadStageTransitionAssets'`.
  2. **Atlas-Helfer in `src/demos/stage-masks/helpers.ts`** (Typen aus `@spearwolf/twopoint5d`:
     `TextureAtlas`, `TextureAtlasFrame`, `TextureCoords`, `TexturedSprite`; `BufferGeometry` aus
     `three/webgpu`), je mit TSDoc:
     - `atlasFrame(atlas: TextureAtlas, subject: string, name: string): TextureAtlasFrame` —
       `atlas.frame(name)`, sonst `throw new Error(`${subject}: the atlas has no frame "${name}"`)`
       (der Wortlaut, den die Szenen heute schreiben).
     - `setMirroredFrame(sprite: TexturedSprite, frame: TextureAtlasFrame): void` — `sprite.setFrame(frame)`,
       dann `sprite.setTexCoords(s + u, t, -u, v)` aus `frame.coords.getTexCoords()`: das Frame von
       links nach rechts gespiegelt.
     - `setPlaneUvToFrame(geometry: BufferGeometry, coords: TextureCoords): void` — schreibt das
       `uv`-Attribut einer `PlaneGeometry` (beliebig viele Segmente) so, dass sie `coords` aufrecht
       zeigt: je Vertex `uv.setXY(i, s + x · u, t + (1 − y) · v)` mit `[s, t, u, v] =
       coords.getTexCoords()`, danach `uv.needsUpdate = true`. TSDoc: die Ebene zählt v von unten, der
       Atlas wird mit `flipY = false` gelesen und zählt t von oben.
     - Der Modul-TSDoc oben bleibt gültig (die Szenen importieren nur von hier).
  3. **Das Muster jedes Szenen-Loaders** (gilt für alle zwölf, Einzelheiten in Schritt 4):
     - ein modul-lokaler `const catalog: TextureStoreData` mit den Einträgen aus Schritt 4, die Ids
       wie die heutigen Felder (`'wall'`, `'sprites'` …), `imageUrl` bzw. `atlasUrl` relativ;
     - `const store = new TextureStore(renderer); store.parse(catalog, {baseUrl: assetsUrl(`${DIR}/`)});`
       (`assetsUrl()` behält den Schrägstrich am Ende, die relativen Urls landen unter `DIR`);
     - alles Laden in `try { … } catch (error) { store.dispose(); throw error; }`, Texturen über
       `store.getAsync(id, 'texture')`, Atlanten über `store.getAsync(id, ['atlas', 'texture'])`, die
       JSON-Dateien über `fetchJson<Typ>('<Modul>', assetsUrl(`${DIR}/<datei>`))`, nebeneinander in
       einem `Promise.all`;
     - das `<X>Assets`-Interface bekommt `store: TextureStore` und behält die Feldnamen, die die
       Szenen lesen; ein `atlas`-Feld wird `TextureAtlas`, das lokale `interface AtlasJson` entfällt;
     - `dispose<X>Assets()` entfällt; die Seiten rufen `assets.store.dispose()` (Schritt 6);
     - `TextureLoader`, `SRGBColorSpace`, `LinearFilter`, `LinearMipmapLinearFilter`,
       `RepeatWrapping`, `ClampToEdgeWrapping`, `NearestFilter`, `NoColorSpace`, `Wrapping` und
       `BufferAttribute` fallen aus den Imports, sobald sie nicht mehr gebraucht werden.
     - Klassen: die elf Szenen außer `MothChapel` nehmen `defaultTextureClasses: ['srgb',
       'anisotropy', 'flipy']` — das ist `SRGBColorSpace`, das Maximum des Renderers (`anisotropy`
       wird von der `TextureFactory` auf `renderer.getMaxAnisotropy()` gekappt), und der
       `flipY = true` von three, den die Loader heute stehen lassen. Die Filter Linear/
       LinearMipmapLinear sind die einer neuen `Texture` und brauchen keine Klasse (die Fabrik des
       Stores hat keine Standardklassen, `TextureStore.ts:546`). Eine Klasse am Eintrag schlägt eine
       Standardklasse gleicher Breite (`'no-flipy'` gegen `'flipy'`, `TextureFactory.ts:153-160`).
  4. **Je Szene** (Zeilen Stand 353a7dbd):
     - `Crawlspace.ts` (`flashlight`, `:82-109`): erst `layout.json` per `fetchJson`, dann die Bilder
       aus `layout.layers.{back,mid,play}.images` — je `{imageUrl: name}` unter der Id `name` (ein Name
       in zwei Ebenen teilt sich eine Textur) — über einen zweiten `store.parse()` oder einen Katalog,
       der nach dem Layout gebaut wird; `sprites: {atlasUrl: 'sprites.json', texture: ['no-flipy']}`.
       `frameGeometry()` (`:217-229`) baut `new PlaneGeometry(w, h)` und ruft
       `setPlaneUvToFrame(geometry, atlasFrame(atlas, 'Crawlspace', name).coords)`;
       `setSpriteFrame()` (`:232-239`) wird `sprite.setFrame(atlasFrame(atlas, 'Crawlspace', name));
       sprite.setSize(w, h)`. Der Kommentar »flipped on upload« entfällt.
     - `CrematoriumWindow.ts` (`heat-haze`, `:56-79`): `outsideSnow`, `outsideAsh`, `roomSnow`,
       `roomAsh` je `{imageUrl: '<datei>.webp'}`; `layout.json` per `fetchJson`. Rückgabe bleibt
       `{outside: {snow, ash}, room: {snow, ash}, layout}` plus `store`.
     - `DeepListening.ts` (`rift`, `:101-131`): `roomNight`, `roomDrowned`, `sky`, `deep` je
       `{imageUrl}`; `sprites: {atlasUrl: 'sprites.json', texture: ['no-flipy']}`. `frameUv()`
       (`:134-140`) entfällt; `setFrame()` (`:143-147`) wird `const frame = atlasFrame(atlas,
       'DeepListening', name); sprite.setFrame(frame); sprite.setSize(frame.coords.width /
       TEXELS_PER_UNIT * scale, frame.coords.height / TEXELS_PER_UNIT * scale)`; die hängende Ebene
       (`:189-196`) nimmt `coords` aus `atlasFrame()` für Maße und `setPlaneUvToFrame()` statt der
       Schleife (dieselbe Formel); `:544-545` (Glocke) liest ihre Maße aus `coords.width/height /
       TEXELS_PER_UNIT`.
     - `DrownedHouse.ts` (`matte-ink`, `:83-111`): `house`, `title`, `prompt`, `hall` (`.webp`),
       `eyes` (`eyes.png`) je `{imageUrl}`; `layout.json` per `fetchJson`.
     - `FoundFootage.ts` (`found-footage`, `:159-184`): `sprites: {atlasUrl: 'sprites.json', texture:
       ['no-flipy']}`, `ground: {imageUrl: 'ground.webp', texture: ['repeat-s']}`. `frameOf()`
       (`:187-193`) entfällt; `place()` (`:246-250`) ruft `setMirroredFrame()` bzw. `setFrame()` und
       setzt die Größe aus `coords.width/height / TEXELS_PER_UNIT · scale`; Figur (`:346-357`) und
       Augenglanz (`:363ff.`) setzen ihr Frame über `setFrame()`, Maße aus `coords`.
     - `MirrorBathroom.ts` (`matte-3d`, `:43-65`): `bathroom`, `reflection` je `{imageUrl}`;
       `layout.json` per `fetchJson`.
     - `MothChapel.ts` (`frozen`, `:134-172`): **ohne** `defaultTextureClasses` (der Seed der Fabrik ist
       schon `flipY: false`, wie die Szene alles liest); Einträge `glass: {imageUrl: 'glass.webp',
       texture: ['anisotropy']}`, `panes: {imageUrl: 'panes.png', texture: ['nearest']}` (ohne
       Anisotropie-Klasse ist sie 1), `frame`/`room` je `{imageUrl: '<datei>.webp', texture:
       ['srgb', 'anisotropy']}`, `sprites: {atlasUrl: 'sprites.json', texture: ['srgb',
       'anisotropy']}`. Ohne Farbklasse bleibt `NoColorSpace` einer neuen `Texture` — das, was die
       Szene heute für `glass` und `panes` setzt. Nach dem `getAsync` von `panes`:
       `panes.generateMipmaps = false;` mit Kommentar: keine Texturklasse schreibt `generateMipmaps`,
       unter WebGPU wählt ein Sampler mit `NearestFilter` sonst Mip-Stufen und mischte die Ids der
       Scheiben; der Store dieser Szene baut die Textur genau einmal (kein Wechsel von Renderer oder
       Klassen), also bleibt der Wert stehen. `window.json` und `room.json` per `fetchJson`.
       `faceMap`: nach dem `getAsync` des Atlas `const resource = await store.whenResource('sprites')`
       und eine modul-lokale Prüfung `readFaceMap(json: unknown): FaceMap` über `resource.atlasJson`
       (Objekt mit `faceMap`, darin `width`, `height`, `wrap` als endliche Zahlen, sonst `throw new
       Error('MothChapel: sprites.json carries no faceMap with a width, a height and a wrap')`), ohne
       Cast. `ChapelAssets` bekommt `faceMap: FaceMap` und `atlas: TextureAtlas`; `:422` liest
       `assets.faceMap`. `frameOf()` (`:175-181`) entfällt; `:421`, `:520`, `:722` nehmen
       `atlasFrame(assets.atlas, 'MothChapel', name).coords` und lesen `s`/`t`/`u`/`v`/`width` statt
       `u`/`v`/`uw`/`vh`/`w` (`:438-441`, `:522`, `:725`). **READ-003:** `ChapelAssets.window` heißt
       `rose`, `interface WindowJson` heißt `RoseWindowJson`; `:670` liest `assets.rose.stoneRadius`;
       in `RoseWindow.ts:58` `const {rose} = assets`, `:59` `rose.extent`, `:73` `rose.panes`. Kein
       Bezeichner `window` bleibt in beiden Dateien außer im Kommentar.
     - `PaintingHallway.ts` (`portal`, `:125-161`): `wall: {imageUrl: 'wall.webp', texture:
       ['repeat-s']}`, `floor: {imageUrl: 'floor.webp', texture: ['repeat-t']}` (die jeweils andere
       Achse bleibt `ClampToEdge`, der Wert einer neuen `Texture`), `doors`, `frame` je `{imageUrl}`,
       `sprites: {atlasUrl: 'sprites.json', texture: ['no-flipy']}`; `sprites.json` (BUG-012, `:142`)
       entfällt als `fetch`, `layout.json` (`:143`) per `fetchJson`. Das exportierte
       `setFrame(sprite, assets, name, w, h, flip = false)` (`:164-171`) behält seine Signatur
       (`PaintedMoor.ts` ruft es) und ruft `atlasFrame(assets.atlas, 'PaintingHallway', name)`, dann
       `setMirroredFrame()` bzw. `sprite.setFrame()` und `sprite.setSize(w, h)`.
     - `SeancePhotographs.ts` (`resolution`, `:52-76`): `wall`, `living`, `spirit` je `{imageUrl}`;
       `layout.json` per `fetchJson`.
     - `Trench.ts` (`matte-threshold`, `:71-95`): `survey`, `thing` (`.webp`), `eyes` (`eyes.png`) je
       `{imageUrl}`; `layout.json` per `fetchJson`. `worldUv` (`:98`) bleibt: die Bilder behalten
       `flipy`.
     - `WardC.ts` (`spotlight`, `:60-84`): `wardC: {imageUrl: 'ward-c.webp'}`, `laundromat:
       {imageUrl: 'laundromat.webp'}`, `sprites: {atlasUrl: 'sprites.json', texture: ['no-flipy']}`.
       `setFrame()` (`:90-100`) wird `const frame = atlasFrame(atlas, 'WardC', name);
       sprite.setFrame(frame);` mit der Größe `coords.width/height / TEXELS_PER_UNIT · scale`; der
       Kommentar »flipped on upload« entfällt.
     - `WatchingWallpaper.ts` (`without-director`, `:81-112`): `plain`/`haunted` je `{imageUrl:
       'wallpaper-<x>.webp', texture: ['repeat']}`, `wainscotPlain`/`wainscotHaunted` je
       `{imageUrl: 'wainscot-<x>.webp', texture: ['repeat-s']}`, `eyeParts: {imageUrl:
       'eye-parts.png'}` (beide Achsen `ClampToEdge`); `eyes.json` per `fetchJson`.
  5. **Erwartete Bildänderung bei Crawlspace und WardC.** Beide lesen ihre Sprites heute mit
     `flipY = true` und `t = (ah − y − h) / ah` über `setTexCoords()`. Das Sprite-Quad legt uv (0, 0)
     oben links (`packages/twopoint5d/src/sprites/SpriteBase.ts:11`, `:78-91`) und sampelt
     `texCoords.xy + uv · texCoords.zw` (`src/sprites/frameUv.ts:13`); mit `flipY = true` liegt die
     untere Kante des Frames dann oben — die Sprites stehen heute vermutlich kopfüber (nach Lesen,
     nicht ausgeführt). Mit `setFrame()` auf einer Textur ohne `flipy` stehen sie aufrecht, wie in
     DeepListening, FoundFootage und PaintingHallway, die heute schon so lesen. Die Ebenen von
     Crawlspace (`frameGeometry()`) stehen vorher wie nachher aufrecht. Zeigt Schritt 9 genau diese
     Umkehr an den Augen von Crawlspace bzw. an den Sprites von WardC, ist das die Korrektur und steht
     im Report; jede andere Abweichung ist ein Fehler.
  6. **Die zwölf Masken-Seiten:** der Import `dispose<X>Assets` entfällt; im `isDisposed`-Zweig nach
     dem Laden und im `display.onDispose()` steht `assets.store.dispose()` an derselben Stelle (Zeilen
     siehe `grep -n "dispose[A-Z][a-zA-Z]*Assets" src/pages/demos/stage-masks-*.astro`, Stand 353a7dbd
     je zwei Aufrufe).
  7. **Die vier Stellen gleicher Ursache:**
     - `src/demos/stage-transitions/assets.ts`: `loadFont()` (`:32-36`) liest über
       `fetchText('loadStageTransitionAssets', assetsUrl(…))`; das `Promise.all` in
       `loadStageTransitionAssets()` (`:62-67`) steht in `try`/`catch` mit `store.dispose()` und
       erneutem Wurf; TSDoc der Funktion um »a load that fails disposes the store it built« ergänzen
       (Satzform von `loadTextureCatalog.ts`).
     - `src/pages/demos/sine-scroller.astro`: `loadFont()` (`:102-107`) über
       `fetchText('sine-scroller', …)`; das `Promise.all` (`:113-133`) in `try`/`catch` mit
       `store.dispose()` und erneutem Wurf (`onDemoInit()` zeigt ihn).
     - `src/pages/demos/ui-panels.astro`: `:97` wird `fetchText('ui-panels', assetsUrl('ui-panels/pixel-8.fnt'))`;
       das `Promise.all` (`:93-101`) in `try`/`catch` mit `store.dispose()` und erneutem Wurf.
     - `src/pages/demos/animated-billboards.astro:100-101`: Eintrag `"blueGround": {"imageUrl":
       "blue-ground-2048x.webp", "texture": ["srgb", "flipy"]}` in `public/assets/textures.json`
       (alphabetisch einsortiert, Format wie die Nachbarn — Biome hält jede JSON-Datei), auf der Seite
       `const blueGroundTexture = await store.getAsync('blueGround', 'texture');` aus dem Store, den
       die Seite schon hat (`:62`); `TextureLoader` und `SRGBColorSpace` fallen aus dem Import, wenn
       sonst unbenutzt. Die Optionen bleiben (`srgb`; `flipy` = Default von three; Filter und
       Anisotropie 1 wie bei `new TextureLoader()`).
  8. **Proben außerhalb des Repos** (das Lookbook hat keine Testoberfläche), in
     `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-13b-probe/`, aufgebaut wie `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-13-probe/`
     (dort `vitest.config.mjs` und `README.md`: Lauf aus `packages/twopoint5d` mit
     `./node_modules/.bin/vitest run --config <dir>/vitest.config.mjs`, Aliasse `~demos`,
     `three/tsl`, `three/webgpu` auf die Kopie des Lookbooks; `packages/twopoint5d/dist` gebaut).
     Vor Schritt 1 schreiben und rot laufen lassen, Log nach `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-13b.probe-red.log`,
     am Ende grün nach `paket-13b.probe-green.log`:
     - `fetchAsset.probe.ts` — `fetch` per `vi.stubGlobal`: 404 → Ablehnung mit genau
       `Scene: /a/layout.json answered 404`; Body `<!doctype html>` → `Scene: /a/layout.json is no
       JSON` mit `SyntaxError` als `cause`; ein ablehnendes `fetch` → `… could not be fetched` mit
       `cause`; ok → Text bzw. geparster Wert.
     - `sceneLoaders.probe.ts` — je Loader der zwölf Szenen: `TextureStore.prototype.parse` mitschneiden
       (Original danach aufrufen), `TextureStore.prototype.getAsync` ablehnen lassen,
       `TextureStore.prototype.dispose` beobachten, `fetch` liefert ok-JSON (für Crawlspace ein Layout
       mit Bildnamen, für MothChapel mit `faceMap`), Renderer-Fake `{getMaxAnisotropy: () => 16}`.
       Erwartet: der Loader lehnt mit dem Fehler von `getAsync` ab, `dispose()` lief genau einmal; für
       jedes Bild ergibt `new TextureFactory(16, []).getOptions(<Standardklassen + Klassen des
       Eintrags>)` die Optionen, die der alte Loader setzte — eine Tabelle in der Probe, aus dem Code
       an 353a7dbd abgeschrieben (`colorSpace`, `flipY`, `magFilter`, `minFilter`, `anisotropy`,
       `wrapS`, `wrapT`); einzige gewollte Abweichung `flipY: false` für die Atlanten von Crawlspace
       und WardC (Kommentar in der Tabelle). Dazu je Szene: der Katalog nennt jedes Bild, das der alte
       Loader lud, und kein anderes.
     - `atlasHelpers.probe.ts` — `atlasFrame()` wirft `X: the atlas has no frame "nope"`; für jedes
       Frame der sechs echten `public/assets/stage-masks/*/sprites.json` (per `fs` gelesen, über
       `TexturePackerJson.parse()` der Library) gilt `atlasFrame(…).coords.getTexCoords()` =
       `[x/aw, y/ah, w/aw, h/ah]`; `setPlaneUvToFrame()` auf `new PlaneGeometry(w, h, 1, 24)` schreibt
       dieselben uv wie die Schleife `DeepListening.ts:195-196` an 353a7dbd; `setMirroredFrame()`
       schreibt `(s + u, t, −u, v)` an einen Sprite-Fake mit `setFrame`/`setTexCoords`.
  9. **Nachher-Bilder:** derselbe Aufruf wie in Schritt 0 (mit demselben Flag), Bilder nach
     `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-13b-previews/after/`, danach wieder
     `git checkout -- apps/lookbook/public/images/demo-preview/`. Jedes Paar ansehen (Read-Werkzeug
     zeigt WebP): gleiche Bilder, gleiche Ausrichtung, gleiche Schärfe — erlaubt sind Animationsphase
     und die Umkehr aus Schritt 5. Kein Lauf darf an einem Konsolenfehler eines Ladefehlers scheitern
     (die Zeile des Generators je Demo nennt Konsolenfehler). Ergebnis je Seite in einer Zeile im
     Report. Lässt sich der Generator gar nicht starten, ist das `FERTIG_MIT_VORBEHALT` mit der
     Ausgabe, kein `BLOCKIERT`.
  10. **`README.md` des Lookbooks, »Adding a demo«, Punkt 2:** nach dem Absatz zu `onDemoInit()`/
      `ignoredKey()` ein Satz: Bilder und Atlanten einer Demo laden über einen `TextureStore` — den
      Katalog `public/assets/textures.json` über `loadTextureCatalog()` oder einen eigenen Katalog wie
      die Szenen unter `src/demos/stage-masks/` —, eine JSON- oder Textdatei daneben über
      `fetchJson()`/`fetchText()` aus `src/demos/utils/fetchAsset.ts`, die bei einem Fehlschlag Datei
      und Status nennen; ein Loader, der scheitert, gibt den Store frei, den er gebaut hat.
  11. Gegenprobe vor dem Report: `grep -rn "TextureLoader\|fetch(" apps/lookbook/src` trifft nur noch
      `src/demos/utils/fetchAsset.ts`; `grep -rn "interface AtlasJson\|meta.size\|dispose[A-Z][a-zA-Z]*Assets"
      apps/lookbook/src` trifft nichts; `grep -n "\bwindow\b" apps/lookbook/src/demos/stage-masks/{MothChapel,RoseWindow}.ts`
      trifft nur Kommentare.
- Nicht anfassen: `assets-src/` samt Generatoren und README (der Asset-Vertrag bleibt, `faceMap` bleibt
  in `sprites.json`), die Bilder unter `public/assets/stage-masks/`, die Vorschaubilder,
  `Camcorder.ts:68` (eine eigene `CanvasTexture`), `SoftBlobs.ts:81`, die Einträge in »Offene Befunde«
  zu `textured-sprites`, `rope-bridge`, `ui-panels` (Listener, `StageRenderer`), Galerie/Game-Menu
  (`isDisposed`), `stage-masks-portal` (Readout) und `stage-masks-matte-threshold` (`as const`) — andere
  Ursache; was davon in einer geänderten Datei steht, ist schon gemeldet.
- Verify: `pnpm run ci`
- Commit: `fix(lookbook): load the art of the stage mask scenes through a TextureStore, read their frames through its atlases, name the file and status of a failed asset fetch and let go of what a failed load holds`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · CONS-002 unverändert, zwölf Loader statt der sechs des
    Audits (`Crawlspace.ts:82`, `CrematoriumWindow.ts:56`, `DeepListening.ts:101`, `DrownedHouse.ts:83`,
    `FoundFootage.ts:159`, `MirrorBathroom.ts:43`, dazu `MothChapel.ts:134`, `PaintingHallway.ts:125`,
    `SeancePhotographs.ts:52`, `Trench.ts:71`, `WardC.ts:60`, `WatchingWallpaper.ts:81`) · BUG-012 um
    eine Zeile verschoben (`MothChapel.ts:147`), `PaintingHallway.ts:142`/`:143` unverändert · READ-003
    um eine Zeile verschoben (`MothChapel.ts:148`), `RoseWindow.ts:58` unverändert · ARCH-001 (Atlas-Teil)
    unverändert: sechs lokale `AtlasJson` (`Crawlspace.ts:69`, `DeepListening.ts:86`, `FoundFootage.ts:147`,
    `MothChapel.ts:116`, `PaintingHallway.ts:104`, `WardC.ts:47`) samt UV-Funktionen · dazu vier Stellen
    gleicher Ursache (`stage-transitions/assets.ts`, `sine-scroller.astro`, `ui-panels.astro`,
    `animated-billboards.astro`) · ein neuer Nebenbefund nach »Offene Befunde« (`TextureFactory` ohne
    Klasse für `generateMipmaps`) · keine offene Folge, kein Eintrag der Queue teilt die Ursache
  - 2026-11-01 Zug 1: Implementierer beauftragt (opus, medium), Brief `<Arbeitsverzeichnis>/paket-13b.impl-0.brief.txt`, Report nach `paket-13b.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG_MIT_VORBEHALT (Schritt 5: keine Umkehr der Sprites von Crawlspace/WardC sichtbar, Bilder vorher = nachher) · 33 Pfade geändert/neu (neu `src/demos/utils/fetchAsset.ts`; 14 Module unter `stage-masks/`, 12 Masken-Seiten, `stage-transitions/assets.ts`, `sine-scroller`/`ui-panels`/`animated-billboards.astro`, `textures.json`, `README.md`) · Arbeitsbaum schmutzig · Proben rot vorher (25 Fehlschläge + 1 Datei), grün 30/30 · Vorschau ohne Flag (WebGPU)
  - 2026-11-01 Zug 2 (Verify): `pnpm run ci` + Proben → exit=0, 30/30, Log `<Arbeitsverzeichnis>/paket-13b.verify.log` · Gegenproben Schritt 11 sauber (nur Strings `'rose window'`, `window.json`)
  - 2026-11-01 Zug 3: Reviewer (opus, medium) freigegeben, alle vier Findings und vier »Dazu«-Stellen behoben · 1 wichtig (`assets-src/README.md:619` »every image is loaded with the default `flipY`« stimmt für den Atlas von Crawlspace nicht mehr), 3 klein · Diff `<Arbeitsverzeichnis>/paket-13b.diff`, Report `paket-13b.review-0.json`
  - 2026-11-01 Zug 4 Runde 1: offen 1 wichtig (README-Satz, mitzuziehen — der Ausschluss von `assets-src/` gilt Generatoren und Vertrag) · Resume des Implementierers (opus, medium), Brief `paket-13b.impl-1.brief.txt`
  - 2026-11-01 Zug 4 Runde 1 zurück: Implementierer FERTIG, `apps/lookbook/assets-src/README.md:619-620` und `:633` (Atlas `sprites.webp` »loaded upright (`flipY = false`)«) · Verify `paket-13b.verify-1.log` exit=0, 30/30 · Reviewer-Resume `paket-13b.review-1.json`: erledigt, nichts wieder offen, 1 klein, freigegeben · Fortschritt: 1 von 1 offenen Befunden erledigt
  - 2026-11-01 Zug 5: Commit e68e11b7 (34 Dateien), Trailer `Remediation-Run: 2026-10-31` · Plan auf `[x]`, zwei Nebenbefunde nach »Offene Befunde«

## Wahl und Abweichungen mit Grund

- **`dispose<X>Assets()` entfallen**, die Seiten rufen `assets.store.dispose()`, wie die Empfehlung von
  CONS-002 es sagt. Ein dünner Wrapper behielte zwölf Exporte, die nichts mehr tun, als eine Methode
  weiterzureichen.
- **Die Layout-JSONs werden nicht zur Laufzeit geprüft.** CONS-002 nennt den ungeprüften Cast; zwölf
  handgeschriebene Validierer für Generator-Ausgaben, die mit ihrer Demo im selben Commit stehen,
  kosten mehr, als sie fangen. Was die Library liest — die Atlanten —, prüft der `TextureStore`
  (`TexturePackerJson.parse()`); eine fehlende oder kaputte Datei nennt `fetchJson()` mit Url und
  Status. Das TSDoc von `fetchJson()` sagt das.
- **`faceMap` bleibt in `sprites.json`** und kommt über `resource.atlasJson` mit einer Prüffunktion statt
  über einen Umbau des Generators: ein Generatorlauf für `stage-masks` braucht Blender (`matte-3d`) und
  schriebe alle Masken-Assets neu, und der Vertrag in `assets-src/README.md:532` bliebe gültig.
- **Atlanten von Crawlspace und WardC wechseln auf `flipY = false`** — die einzige Abweichung von
  »unveränderten Texturoptionen«: `TextureAtlas`-Frames zählen t von oben, und `setFrame()` setzt das
  voraus (Schritt 5).
- **`panes.generateMipmaps = false` von Hand** am geliehenen Texture-Objekt: der Katalog kennt keine
  Klasse dafür, und ohne den Wert läse WebGPU die Ids der Scheiben aus verkleinerten Mip-Stufen
  (`three.webgpu.js:40911` setzt `mipmapFilter` aus `minFilter`, `:10706` erzeugt Mips bei
  `generateMipmaps === true`). Die Lücke der Library steht als Nebenbefund in »Offene Befunde«.
- **Helfer-Modul `fetchAsset.ts` mit zwei Exporten** statt eines `fetchJson.ts`: die drei `.fnt`-Stellen
  derselben Ursache lesen Text.
- **Meldungswortlaut** `<Subject>: <url> answered <status>` nach der Empfehlung von BUG-012; die Url steht
  ohne Anführungszeichen wie dort.
- **`assets-src/README.md` doch angefasst** (Runde 1, auf den Befund des Reviewers): nur die Aussage
  zum Laden im Abschnitt `flashlight` — die Ebenen mit default `flipY`, der Atlas aufrecht. Der
  Ausschluss galt Generatoren und Asset-Vertrag; diesen Satz hat die Änderung selbst falsch gemacht.
- **`.catch()` am `Promise.all` statt `try`/`catch`** in `sine-scroller.astro` und `ui-panels.astro`
  (Implementierer): gleiche Wirkung, die Destrukturierung braucht keine vorab deklarierte Variable.
- **`store.parse()` innerhalb des `try`** in allen zwölf Loadern und `stage-transitions/assets.ts`:
  ein werfendes `parse()` gibt den Store ebenfalls frei.
- **Modellstufe** stärkste statt mittlere: zwölf Module mit eigenen UV-Konventionen, die nur ein
  Bildvergleich bestätigt.

## Findings im Volltext

**CONS-002 · low · apps/lookbook/src/demos/stage-masks/Crawlspace.ts:82** (weitere: `CrematoriumWindow.ts:61`,
`DeepListening.ts:100`, `DrownedHouse.ts:84`, `FoundFootage.ts:164`, `MirrorBathroom.ts:43`) — Assets der
Masken-Demos über `TextureStore` laden
Sechs Module bringen je einen eigenen Loader mit, jedes Mal dieselben Zeilen: `TextureLoader`,
`SRGBColorSpace`, Filter, Anisotropie. Dazu kommt ein eigenes `AtlasJson`-Interface im TexturePacker-Hash-Format
samt UV-Rechnung (Crawlspace.ts:217/232, DeepListening.ts:133, FoundFootage.ts:192). Die Library hat dafür
`TextureStore`/`TextureFactory` mit Texture-Klassen (`srgb`, `anisotropy`) und `texturePackerAtlasAdapter`.
Der Eigenbau hat zudem Lücken. `fetch(…).then((r) => r.json() as Promise<…>)` prüft `r.ok` nicht, ein 404
wird zu einem SyntaxError über `<`, der die Datei nicht nennt. Das JSON wird ungeprüft auf den Typ gecastet.
Scheitert eine Datei, bleiben die bereits geladenen Texturen ohne `dispose()`. Die Lookbook-App ist die
Live-Doku der Library, und hier lebt sie an der eigenen Textur-API vorbei.
Beleg: `fetch(assetsUrl(`${DIR}/layout.json`)).then((response) => response.json() as Promise<CrematoriumLayout>),`
Empfehlung: Die Bilder und Atlanten der Demos in einen Katalog legen und über `TextureStore` laden;
`store.dispose()` ersetzt die `dispose…Assets()`-Funktionen. Bleibt der Eigenbau, dann als ein gemeinsamer
Helfer unter `~demos/utils/` mit `if (!response.ok) throw new Error(`…: ${url} answered ${response.status}`)`
und Aufräumen der schon geladenen Texturen bei einem Fehler.

**BUG-012 · low · apps/lookbook/src/demos/stage-masks/MothChapel.ts:146** (weitere: `PaintingHallway.ts:142`,
`:143`) — `response.ok` vor `response.json()` der Demo-Assets prüfen
Die Asset-Loader holen die JSON-Layouts per `fetch(...).then((response) => response.json())` ohne
Statusprüfung. Fehlt eine Datei (falscher `BASE_URL`, umbenanntes Asset), liefert der Server eine
HTML-404-Seite, und die Demo bricht mit einem `SyntaxError: Unexpected token '<'` ab, der weder Datei noch
Status nennt. Zudem bleiben bei einem Fehlschlag in `Promise.all` die schon geladenen Texturen undisposed.
Beleg: `const json = <T>(name: string) => fetch(assetsUrl(`${DIR}/${name}`)).then((response) => response.json() as Promise<T>);`
Empfehlung: Einen kleinen gemeinsamen Helper (z. B. `fetchJson(url)` neben `assetsUrl`) nutzen, der bei
`!response.ok` mit `MothChapel: <url> answered <status>` wirft.

**READ-003 · low · apps/lookbook/src/demos/stage-masks/MothChapel.ts:147** (weitere: `RoseWindow.ts:58`) —
Globales `window` nicht durch eine lokale Variable verdecken
`loadChapelAssets` destrukturiert ein Layout als `window`, `RoseWindow` holt es mit `const {window} = assets`
heraus. In Browser-Code, dessen Nachbarseiten mit `window.addEventListener` arbeiten, verdeckt das das
globale Objekt; ein später eingefügter `window.…`-Aufruf in diesem Scope greift still auf das JSON zu.
Beleg: `const [glass, panes, frame, room, sprites, window, layout, atlas] = await Promise.all([`
Empfehlung: Das Feld in `rose` bzw. `windowLayout` umbenennen (Interface `ChapelAssets.window` inklusive).

**ARCH-001 · low · apps/lookbook/src/demos/stage-masks/InkWell.ts:42** — Gemeinsame Helfer der Masken-Demos
in ein Modul ziehen (hier nur der Atlas-Teil; den Rest hat Paket 12 mit `stage-masks/helpers.ts` erledigt)
Die Szenenmodule teilen Helfer kreuz und quer. `InkRandom` liegt in der Tinten-Demo InkWell und wird von der
Krematoriums- und der Spiegel-Demo importiert. Daneben gibt es drei weitere PRNGs: eine LCG in
`CrawlRig#random`, Park-Miller in `FootageClock.random` und zweimal als `scatter()` in FoundFootage und
DeepListening. Es gibt zwei `smoothstep`/`smooth`-Kopien und zwei `additive()`-Materialhelfer
(FoundFootage.ts:315 und der aus RiftMembrane, den DeepListening importiert). `Camcorder` hängt für
`hash21` und `makeFootageStage` an FoundFootage. Eine Änderung an einer Demo kann so eine andere
verschieben, und wer eine Szene als Vorlage nimmt, muss Helfer aus fremden Szenen mitschleppen.
Beleg: `import {InkRandom} from './InkWell';`
Empfehlung: Ein Modul `demos/stage-masks/shared.ts` (oder unter `~demos/utils/`) mit einem PRNG,
`smoothstep`, `hash21`, den Blend-Helfern und den Atlas-UV-Funktionen; die Szenen importieren nur von dort.

## Urteil des Reviewers (Zug 3, Runde 1)

- CONS-002 · behoben · zwölf Loader über je einen `TextureStore` mit `try`/`catch` + `store.dispose()`
  (`Crawlspace.ts:99-115`, `CrematoriumWindow.ts:70-85`, `WardC.ts:70-83` …), Layouts über `fetchJson`
  (`src/demos/utils/fetchAsset.ts:33-39`), die zwölf Seiten je zweimal `assets.store.dispose()`
- BUG-012 · behoben · `MothChapel.ts:183-184` (`fetchJson`), `PaintingHallway.ts:130` (`sprites.json` als
  `atlasUrl`), `:148` (`layout.json` über `fetchJson`); Statusprüfung `fetchAsset.ts:16-18`
- READ-003 · behoben · `MothChapel.ts:91` `RoseWindowJson`, `:133` Feld `rose`; `RoseWindow.ts:58-59`, `:73`
- ARCH-001 (Atlas-Teil) · behoben · `helpers.ts:104` `atlasFrame`, `:111` `setMirroredFrame`, `:123`
  `setPlaneUvToFrame`; kein `interface AtlasJson`, kein `meta.size`, kein `frameOf`/`frameUv` mehr
- Dazu `stage-transitions/assets.ts:59-76`, `sine-scroller.astro:105`/`:124-127`, `ui-panels.astro:99`/
  `:103-106`, `animated-billboards.astro:99` + `public/assets/textures.json:12-15` · behoben
- Texturoptionen je Bild gegen 353a7dbd geprüft: gleich, gewollt anders nur `flipY` der Atlanten von
  Crawlspace und WardC · freigegeben (Runde 0 mit einem »wichtig«, Runde 1 erledigt)

Kleine Befunde (ohne Runde):
- `MothChapel.ts:192` — `'atlasJson' in resource ? … : undefined`: der Reviewer hält den Guard für
  überflüssig (`TextureResource.ts:1414` hat den Getter), der Implementierer begründet ihn mit dem Typ
  `AnyTextureResource` von `whenResource()`; harmlos, `readFaceMap` lehnt `undefined` ab
- `sine-scroller.astro:124`, `ui-panels.astro:103` — `.catch()` statt `try`/`catch` (oben unter »Wahl«
  nachgetragen)
- Schritt 5 — Umkehr der Sprites von Crawlspace/WardC nachgerechnet, an den Frames nicht sichtbar
  (Pixel-Diff im Mittel 0,33 bzw. 1,35 von 255); neuer Pfad folgt der Konvention von DeepListening,
  FoundFootage, PaintingHallway
- `assets-src/README.md:620` — kurze Zeile nach »atlas upright. The art is«, Absatz nicht neu umbrochen

Nebenbefunde (Urteil → Scope, Begründung): `animated-billboards.astro` ohne Dispose-Pfad — andere
Ursache (Lebenszyklus der Seite), vorbestehend; `precompile()` der Galerie/des Game-Menus mit
»Value is infinite« — andere Ursache (GPU-Draw), im Zweifel als mögliche Folge von Paket 13 vermerkt,
medium geschätzt, weil zwei Demo-Seiten ihr Vorabzeichnen nicht schaffen.
