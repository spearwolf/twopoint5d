# Paket 7 — Lookbook: Einstieg, Suche, Demo-Boilerplate

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: DOC-003 (medium), IMPL-004 (low), READ-013 (low), TYPE-019 (low),
  TYPE-020 (low), API-049 (low)
- Ziel: Die Lookbook bekommt eine »Your First Sprite«-Demo samt Erklärung der
  VertexObjectDescription, eine funktionierende Ctrl/Cmd+K-Suche, geteiltes
  Demo-Boilerplate mit einer einzigen Instanced-Quad-Definition und übernimmt
  `printSceneGraphToConsole` aus der Library-API.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - Lookbook, geändert: `apps/lookbook/src/layouts/VanillaDemo.astro`,
    `apps/lookbook/src/components/SearchLookbook.astro`,
    `apps/lookbook/src/components/LookbookMetadata.astro`,
    `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts`,
    `apps/lookbook/src/demos/utils/showTexturePreview.ts`,
    `apps/lookbook/src/demos/instanced-quads/InstancedQuadsGeometry.ts`, die elf Seiten
    `apps/lookbook/src/pages/demos/{animated-billboards,animated-sprites,crosses,instanced-quads,map2d-cam-visi,map2d-rect-visi,map2d-tile-sprites,textured-quads,textured-quads-from-texture-atlas,textured-quads-from-tileset,textured-sprites}.astro`,
    `apps/lookbook/src/pages/demos/_crosses.json`,
    `apps/lookbook/src/pages/demos/_instanced-quads.json`, `apps/lookbook/README.md`
  - Lookbook, neu: `apps/lookbook/src/pages/demos/first-sprite.astro`,
    `apps/lookbook/src/pages/demos/_first-sprite.json`,
    `apps/lookbook/src/components/TexturePreview.astro`,
    `apps/lookbook/src/components/searchDemos.ts`,
    `apps/lookbook/src/demos/utils/fullscreenCanvas.ts`,
    `apps/lookbook/src/demos/utils/printSceneGraphToConsole.ts`
  - Library: `packages/twopoint5d/src/utils/public-api.ts`,
    `packages/twopoint5d/src/utils/printSceneGraphToConsole.ts` (gelöscht),
    `packages/twopoint5d/CHANGELOG.md`, neu `packages/twopoint5d/src/vertex-objects/README.md`
  - Repo: `AGENTS.md` (ein Punkt unter »Deeper docs«)
- Vorgehen:
  1. **Vollbild-Canvas ins Layout (READ-013).** Neu
     `apps/lookbook/src/demos/utils/fullscreenCanvas.ts` mit
     `export const FULLSCREEN_CANVAS_ID = 'canvas-container';` und
     `export function getFullscreenCanvas(): HTMLCanvasElement`, das
     `document.getElementById(FULLSCREEN_CANVAS_ID)` liefert und sonst wirft — Muster und
     Tonfall wie `showTexturePreview.ts:9–12`, die Meldung nennt `#canvas-container` und
     dass `VanillaDemo.astro` es mit `fullscreenCanvas` schreibt; ein Element, das kein
     `HTMLCanvasElement` ist, wirft ebenso. `VanillaDemo.astro` bekommt in `Props`
     `fullscreenCanvas?: boolean` (Vorgabe `false`, TSDoc ein Satz). Ist er gesetzt,
     schreibt das Layout `<canvas id={FULLSCREEN_CANVAS_ID} resize-to="window"></canvas>`
     unmittelbar vor `<slot />` (also nach `<DemoNavBar />`, wie heute in jeder Seite) und
     setzt am `<body>` per `class:list` die Klasse `fullscreen-canvas`; der vorhandene
     `<style is:global>`-Block bekommt `body.fullscreen-canvas { height: 100vh; overflow-y:
     hidden; }`. Die Regel steht global, weil der `<body>` im Layout steht; ein bedingtes
     `<style>` hoistet Astro nicht.
  2. **Die elf Seiten umstellen** — `animated-billboards`, `animated-sprites`, `crosses`,
     `instanced-quads`, `map2d-cam-visi`, `map2d-rect-visi`, `map2d-tile-sprites`,
     `textured-quads`, `textured-quads-from-texture-atlas`, `textured-quads-from-tileset`,
     `textured-sprites` (Liste aus `grep -l canvas-container src/pages/demos/*.astro`; die
     sechs Seiten mit `<canvas id="twopoint5d">` bleiben unberührt, sie bauen einen
     eigenen `Display`). Je Seite: `<Layout … fullscreenCanvas>`, die
     `<canvas id="canvas-container" …>`-Zeile weg, aus der `body`-Regel der Seite nur
     `height: 100vh;` und `overflow-y: hidden;` weg (Hintergrund, Farbe, Schrift bleiben —
     Astro gibt `body`-Regeln einer Seite ungescoped aus, das ist im gebauten
     `dist/demos/crosses/index.html` so zu sehen). Im Script
     `document.getElementById('canvas-container')!` samt dem Kommentar »the <canvas
     id="canvas-container"> is written by the markup of this very page« durch
     `getFullscreenCanvas()` aus `~demos/utils/fullscreenCanvas` ersetzen — der Kommentar
     wäre nach dem Umzug falsch. In `map2d-rect-visi`, `map2d-tile-sprites` und
     `map2d-cam-visi` steht der Aufruf in `run(new PerspectiveOrbitDemo(…))`; die Demo-Module
     unter `src/demos/map2d/` bekommen weiter ihren `PerspectiveOrbitDemo`.
  3. **`.actionBtn` einmal (READ-013).** Die beiden Kopien in `animated-sprites.astro:29–45`
     und `textured-sprites.astro:24–35` wandern als eine Regel samt `:hover` (die Fassung
     aus `animated-sprites`) in den `<style is:global>`-Block von `VanillaDemo.astro`; in
     beiden Seiten weg. Grund: die zweite Kopie hat den Hover schon verloren — dieselbe
     Divergenz, die das Finding an den Quads rügt.
  4. **Texturvorschau als Komponente (READ-013).** `showTexturePreview.ts` exportiert
     `export const TEXTURE_PREVIEW_ID = 'texture-preview';` und liest damit statt des
     Literals. Neu `apps/lookbook/src/components/TexturePreview.astro`: Props `size?:
     number` (Kantenlänge in px, Vorgabe `150`) und `title?: string`; schreibt `<div
     id={TEXTURE_PREVIEW_ID} class="texture-preview">` mit Breite und Höhe aus `size`
     (`style` oder `define:vars`), darin bei `title` ein `<header>` mit dem Text, der nur
     bei Hover erscheint. Die Styles sind die gemeinsame Fassung aus
     `textured-quads-from-texture-atlas.astro:18–33` (Hintergrund, 5px-Rand `#324168`,
     Schatten, `overflow: hidden`, `max-width: 100%` für `img`/`canvas`), dazu Hover-Rahmen
     und `<header>`-Regeln aus `textured-quads-from-tileset.astro:31–54`. Die drei Seiten
     `textured-quads` (`<TexturePreview size={256} />` — die Seite behielt 256px; ihr
     eigener Look aus `:19–36` geht zugunsten des gemeinsamen), `…-from-texture-atlas`
     (`<TexturePreview />`) und `…-from-tileset` (`<TexturePreview title="tileset image" />`)
     verlieren ihr `<div id="texture-preview">` und alle `.texture-preview`- und
     `.tileset-image-title`-Regeln.
  5. **Eine Instanced-Quad-Definition (READ-013, TYPE-019, TYPE-020).**
     `InstancedQuadsGeometry.ts:23–25` — `x4`, `y4`, `z4` streichen; der Descriptor mit
     `vertexCount: 4` erzeugt `x0` … `x3`. `instanced-quads.astro` verliert
     `BaseQuad`, `BaseQuadDescriptor`, `InstancedQuad`, `InstancedQuadDescriptor`
     (`:36–81`) und importiert wie `textured-quads.astro:45` `InstancedQuadsGeometry` und
     `type InstancedQuad` aus `~demos/instanced-quads/InstancedQuadsGeometry`;
     `createMesh()` baut `new InstancedQuadsGeometry(rows * columns)`, `createQuads()`
     nimmt `VertexObjectPool<InstancedQuad>` und schreibt
     `quad.setInstancePosition([x…, y…, 0])` — das Tripel, das die Signatur verlangt.
     Die geteilte Geometrie trägt zusätzlich `uv`, `texCoords` und `texFlipDiagonal`, die
     das Material dieser Seite nicht liest; das kostet bei 20 000 Instanzen rund 400 KB und
     ist hinzunehmen — eine zweite Definition ist genau, was das Finding rügt. Den
     Kommentar `:96–98` und `forceWebGL: true` behalten.
  6. **`printSceneGraphToConsole` in die Lookbook (API-049, Entscheidung vom
     2026-09-30).** Aus `packages/twopoint5d/src/utils/public-api.ts:5` die Zeile streichen
     und `packages/twopoint5d/src/utils/printSceneGraphToConsole.ts` löschen; `findRootNode`
     bleibt exportiert. Neu `apps/lookbook/src/demos/utils/printSceneGraphToConsole.ts`
     mit derselben Funktion (`/* eslint-disable no-console */` bleibt,
     `findRootNode` aus `@spearwolf/twopoint5d`) und einem TSDoc-Satz, was sie ausgibt.
     Genutzt wird sie in `instanced-quads.astro`: `console.log('InstancedQuadsMesh', {mesh:
     demo.scene.children[0], demo})` (`:183–184`) wird
     `printSceneGraphToConsole(demo.scene)` — ohne Nutzer wäre die Datei toter Code in der
     Lookbook; `window.display` setzt `PerspectiveOrbitDemo.ts:48` ohnehin.
     CHANGELOG `[Unreleased]` nach dem Skill `updating-changelog`: unter `### Removed`
     (`:330`) ein Eintrag im Ton der Nachbarn, etwa »remove `printSceneGraphToConsole()`
     from the public API: a debug helper that wrote every node of a subtree to the console
     through `console.dir`, without a limit, and that nothing in the library called. See
     the Migration Guide«; im `### Migration Guide` ein H4 »`printSceneGraphToConsole()` is
     gone« neben den anderen »… is gone«-H4 (etwa nach `:955`) mit **Before**/**After** als
     schlichte `ts`-Blöcke: `printSceneGraphToConsole(scene);` gegen ein
     `scene.traverse((node) => console.log(node.type, node.name));` oder eine eigene
     Kopie der Funktion. Commit-Typ mit `!` (siehe unten), weil ein Export fällt.
  7. **Reihenfolge der Demos.** `loadMetadataForDemos.ts`: `IDemo` bekommt
     `order?: number` (TSDoc: aufsteigend, Vorgabe 0, wie `order` der Tag-Kategorien in
     derselben Datei); `demos` wird nach dem `map()` mit `(a.order ?? 0) - (b.order ?? 0)`
     sortiert — `sort()` ist stabil, die übrigen Demos bleiben alphabetisch. Nur die
     Einstiegs-Demo trägt `"order": -1`. Grund: ohne das stünde der Einstieg als siebte
     von 18 Karten zwischen `display-multi` und `instanced-quads`.
  8. **Die Einstiegs-Demo (DOC-003).** Neu `first-sprite.astro` auf
     `<Layout title={title} description={description} fullscreenCanvas>` mit einer
     `body`-Regel nur für den Hintergrund. Das Script importiert nur aus
     `@spearwolf/twopoint5d`, `three/webgpu` und den zwei Lookbook-Helfern `assetsUrl` und
     `getFullscreenCanvas` — keine `PerspectiveOrbitDemo`, keine Subclass, keine eigene
     Description, damit ein Leser es in sein Projekt übernehmen kann. Gestalt:
     `new Display(getFullscreenCanvas())`; `Scene` und `PerspectiveCamera`;
     `display.onResize(({width, height}) => …)` setzt `aspect` und
     `updateProjectionMatrix()`; `display.onInit(async ({renderer}) => …)`: `new
     TextureStore(renderer)`, `await store.loadAsync(assetsUrl('textures.json'))`,
     `const [atlas, texture] = await store.getAsync('splotchs', ['atlas', 'texture'])`,
     `const frame = atlas.frame('splotch0')` (256×296, benannter Frame, keine Zahl),
     `const sprites = new TexturedSprites(1, texture)`, `sprites.createSprite()`,
     `sprite.setSize(frame.coords.width, frame.coords.height)` (eine Welteinheit je Pixel),
     `sprite.setFrame(frame)`, `sprites.update()`, `scene.add(sprites)`;
     `display.onRenderFrame(({renderer}) => renderer.render(scene, camera))`;
     `display.onDispose(…)` gibt erst `sprites.dispose()`, dann `store.dispose()` frei (der
     Store besitzt die Textur, das Mesh nur das Material um sie —
     `packages/twopoint5d/docs/resource-lifecycle.md`); `display.start()`. Jede Zahl ist
     eine benannte Konstante mit Kommentar oder steht an einem Namen, der sie erklärt —
     etwa `FIELD_OF_VIEW` und `CAMERA_DISTANCE`, so gewählt, dass der ganze Frame mit Rand
     im Bild steht. Ein `!` nach `createSprite()` und `frame()` bekommt je einen Kommentar
     wie im Rest der Lookbook (»the mesh has room for one sprite, …«). Ziel rund 30 Zeilen
     Code ohne Kommentare; Kommentare, die dem Einsteiger sagen, was jeder Schritt tut,
     sind erwünscht.
     `_first-sprite.json`: `"title": "your first sprite"`, `"url": "/demos/first-sprite"`,
     `"order": -1`, `"shortDescription"` ein Satz für die Karte, `"description"` in
     Markdown für den Dialog der Demo: was die Seite zeigt, dass ein `TexturedSprites`-Mesh
     jedes Sprite als eine Instanz aus zwei Vertex-Object-Descriptions zeichnet, und ein
     Link auf die Konzeptseite
     `https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/src/vertex-objects/README.md`;
     `"tags": ["Display", "TexturedSprites", "TextureStore", "textures", "vanilla"]` —
     jeder großgeschriebene ist ein Export, `scripts/lookbook/demoMetadata.test.mjs` prüft
     das. Kein `previewImage`: `Card.astro` fällt auf sein Standardbild zurück, wie bei den
     beiden Stage-Demos.
     `_crosses.json` und `_instanced-quads.json` nennen sich nicht mehr »minimal example«
     (das ist jetzt die Einstiegs-Demo): `crosses` etwa »A vertex object description of
     its own — a cross of twelve vertices — drawn by the VertexObjects mesh«,
     `instanced-quads` etwa »Twenty thousand quads of one InstancedVertexObjectGeometry,
     waved by a node material«. Formulierung frei, Inhalt so.
  9. **Konzeptseite (DOC-003).** Neu `packages/twopoint5d/src/vertex-objects/README.md`,
     Gegenstück zu `src/stage/README.md`; der Link `📚 [vertex-objects](src/vertex-objects/)`
     im Library-README landet auf GitHub dann auf ihr. Englisch, um 88–90 Zeichen
     umbrochen, alles aus dem Code gelesen, nicht aus dem Gedächtnis:
     - was ein Vertex Object ist: ein JS-Objekt, dessen Properties in Slices eines
       gemeinsamen Buffers schreiben (`docs/architecture.md` §2 `vertex-objects/` sagt es
       für Maintainer; hier für Anwender, darauf verlinken statt es zu wiederholen);
     - die Schlüssel der Description — `vertexCount`, `indices`, `attributes` (je Attribut
       `components` oder `size`, dazu die Optionen aus `VertexAttributeDescriptor.ts` wie
       `type`, `usage`, `setter`, `getter`, `autoTouch`, soweit ein Einsteiger sie braucht),
       `basePrototype`, `methods` — nach dem TSDoc in `types.ts:171–202`;
     - welche Accessoren daraus entstehen, nach `vertexObjectPropertyNames.ts:17–52`:
       Komponenten je Vertex mit Index (`x0` … `x3`), ohne Index bei `vertexCount` 1,
       ein Attribut der Größe 1 bei `vertexCount` 1 als Property unter seinem Namen
       (`rotation`), Setter und Getter unter den Namen aus `VertexAttributeDescriptor`;
     - ein Quad Schritt für Schritt: vier Vertices, `indices: [0, 2, 1, 0, 3, 2]` als zwei
       Dreiecke, mit der ASCII-Skizze aus `sprites/BaseSprite.ts:35–45` und `:74–80`;
     - instanziert: eine Base-Description je Vertex und eine Instanz-Description je Objekt,
       `InstancedVertexObjectGeometry(instanced, capacity, base)`, `basePool` und
       `instancedPool` — und dass `TexturedSprites` genau dieses Paar ist
       (`BaseSpriteDescriptor`, `TexturedSpriteDescriptor`, beide exportiert), das Sprite
       der Einstiegs-Demo also eine Instanz davon;
     - weiter: die Lookbook-Demos `first-sprite`, `crosses` (eigene Description mit zwölf
       Vertices), `instanced-quads`, `textured-quads` mit ihrem Quellpfad, und
       `docs/resource-lifecycle.md` für `dispose()`.
     Genau ein Block mit Infostring `ts check`: eine vollständige kleine Description samt
     `VertexObjectGeometry`, `createVO()` und einem Setter, die für sich steht (importiert
     alles, deklariert alles); `pnpm typecheck` compiliert ihn gegen die gebaute Library.
     Weitere Code-Blöcke als schlichtes `ts`. Danach in `AGENTS.md` unter »Deeper docs«
     ein Punkt nach dem Stage-Cheat-Sheet: `[Vertex objects](packages/twopoint5d/src/vertex-objects/README.md)`
     — was eine Description deklariert und welche Accessoren sie erzeugt.
  10. **Suche (IMPL-004, Entscheidung vom 2026-09-30: implementieren über die Metadaten im
      DOM).** Neu `apps/lookbook/src/components/searchDemos.ts`:
      `export function searchDemos(demos: readonly IDemo[], query: string): IDemo[]` —
      `query` getrimmt, klein, an Leerraum in Begriffe zerlegt; ein Demo passt, wenn jeder
      Begriff als Teilstring in `title`, `id`, einem Tag, `shortDescription` oder
      `description` steht (klein verglichen); leere Anfrage → alle Demos in der Reihenfolge
      der Metadaten. `IDemo` als `import type` aus `~demos/utils/loadMetadataForDemos`.
      `LookbookMetadata.astro`: `data-lookbook-tags` fällt weg — kein Script liest es, die
      Tag-Wolke trägt ihre Beziehungen in eigenen Attributen (`TagCloudFilter.astro:19–21`),
      und die Suche findet Tags über die `tags` jedes Demos; `data-lookbook-demos` bleibt die
      Quelle. `SearchLookbook.astro`:
      - Markup: `:24` »TODO search lookbook« weg; statt dessen ein
        `<input type="search">` mit `aria-label` und Platzhalter, `autofocus` wandert vom
        Schließen-Knopf (`:14`) auf dieses Feld, darunter eine Ergebnisliste (`<ul>`) und
        ein zunächst verborgener Satz für »keine Treffer«. Styles im vorhandenen
        `<style>`-Block, im Look des Dialogs.
      - Script: liest `#lookbook-metadata` und `JSON.parse` seines `data-lookbook-demos`;
        fehlt das Element, wirft es mit einer Meldung, die `LookbookMetadata` nennt (die
        Seite, die den Header trägt, schreibt beide — `pages/index.astro:12–13`). Bei jedem
        `input` die Liste neu aus `searchDemos()`: je Treffer ein `<li>` mit `<a
        href={demo.href}>` und dem Titel, dazu die Tags, gebaut mit `createElement` und
        `textContent`, nie `innerHTML`. Enter im Feld öffnet den ersten Treffer. Öffnen über
        den Knopf wie heute und über einen `keydown`-Listener auf `document`:
        `(event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
        event.key.toLowerCase() === 'k'` → `preventDefault()`, `dialog.showModal()` falls
        nicht offen, Fokus ins Feld und dessen Text markiert. Escape schließt nativ. Die
        Beschriftung »Ctrl K« des Knopfs bleibt; Cmd+K geht auf dem Mac zusätzlich.
      - Kein Event `lookbook.showDemos`: die Treffer stehen im modalen Dialog, und ein
        Filter über das Grid würde den Zustand der Tag-Wolke (`TagCloudFilter.astro`,
        `localStorage`) überschreiben, ohne dass sie davon hört. Das weicht von der
        Empfehlung des Audits ab; die Entscheidung vom 2026-09-30 verlangt nur die
        Metadaten im DOM als Quelle.
  11. **`apps/lookbook/README.md` nachziehen.** Die Zählungen `17` (`:3`, `:17`, `:18`,
      `:28`) auf 18; `components/` nennt `TexturePreview`; unter »Adding a demo« Schritt 2
      `fullscreenCanvas` und `getFullscreenCanvas()`, dazu `<TexturePreview>` für eine
      Texturvorschau, als Beispielseite `first-sprite.astro` statt `crosses.astro`;
      Schritt 3 nennt `shortDescription` (Karte) neben `description` (Dialog) und
      `order`. `:55–56` (»lookbook and« / »is part of«) gehört DOC-070 in Paket 8 und
      bleibt stehen.
  12. **Rauchprobe im Browser.** Nichts im Gate startet die Lookbook: `astro check` und
      `astro build` sehen keinen Laufzeitfehler, keinen leeren Canvas und keine tote Suche.
      Deshalb vor den Änderungen und danach je einmal ein Wegwerf-Skript im
      Arbeitsverzeichnis des Laufs,
      `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad`
      (nicht im Repo), das `playwright` aus dem Repo-Root auflöst
      (`createRequire('/Users/spw/spaceland/twopoint5d/package.json')('playwright')`,
      Chromium ist installiert), gegen `pnpm nx preview lookbook` (hängt selbst an `build`) oder
      `pnpm lookbook` läuft, beide unter `http://localhost:4321/lookbook/`; den Server
      danach beenden:
      - jede Seite unter `/lookbook/demos/*/` ohne `pageerror` und ohne `console.error`
        über die Baseline hinaus, die der Lauf vor den Änderungen gezeigt hat;
      - `/lookbook/demos/first-sprite/`: ein Screenshot des Canvas ist nicht einfarbig;
      - `/lookbook/`: die erste Karte ist »your first sprite«; Ctrl+K öffnet den Dialog
        mit Fokus im Feld, `sprite` listet `first-sprite`, Enter landet auf
        `/lookbook/demos/first-sprite/`.
      Ausgabe beider Läufe in den Report.
- Verify: `pnpm run ci`
- Rauchprobe: Schritt 12, beide Läufe im Report des Implementierers
- Regressionstest: keiner im Sinn der Konventionen — kein Finding ist ein
  Laufzeitfehler. TYPE-019 und TYPE-020 sind Typen, die das Laufzeitverhalten nicht
  ändern (der generierte Setter schreibt so viele Werte, wie ein Tupel hält; `z` blieb 0);
  `astro check` hält sie. Die Tags der neuen Demo hält
  `scripts/lookbook/demoMetadata.test.mjs`, den `ts check`-Block `pnpm typecheck`.
- Commit: `feat!: add a first-sprite demo to the lookbook and a page on vertex object
  descriptions, let Ctrl/Cmd+K search the demos, let the demo layout write the fullscreen
  canvas and hold the action button, give the texture previews a component, build the
  instanced quads demo on the shared quad geometry, and move printSceneGraphToConsole out
  of the public API into the lookbook` — eine Zeile, `!`, weil ein Export fällt (wie
  `feat!:` in `git log`)
- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · DOC-003 im Kern unverändert (`_crosses.json:3`
    nennt sich »minimal example«, `Crosses.ts:4–54` und `:109–118` mit 12 Vertices und 18
    Indizes, keine Einstiegs-Demo unter 17 Seiten), die Grad-Umrechnung ist behoben
    (`Crosses.ts:77–79` `MathUtils.degToRad`) · IMPL-004 unverändert
    (`SearchLookbook.astro:7–10`, `:24`, kein `keydown` und kein Leser von
    `#lookbook-metadata` unter `src/`) · READ-013 umgeformt: elf Seiten statt zwölf,
    `.texture-preview` in drei statt vier, `.actionBtn` in zwei, die Quad-Definitionen in
    `instanced-quads.astro:36–81` · TYPE-019 unverändert (`InstancedQuadsGeometry.ts:23–25`)
    · TYPE-020 verschoben nach `instanced-quads.astro:73`, Aufruf `:135–138` mit zwei Werten
    · API-049 unverändert (`printSceneGraphToConsole.ts:6`, `utils/public-api.ts:5`, kein
    Nutzer in `packages/` und `apps/`) · Folgen aus Paket 6 (`StageRenderer.ts:344–351`,
    `:318–324`) als Symptome an das neue Nachtragspaket 10 · Nebenbefund
    `DemoNavBar.astro:111–155` in die Queue · Restplan: Paket 10 zwischen 7 und 8, Hinweise
    an Paket 8 und 9
  - 2026-09-30 Zug 1: Implementierer Runde 0 beauftragt · opus, Effort medium · Report nach
    `paket-7.impl-0.json`
  - 2026-09-30 Zug 2: Report `paket-7.impl-0.json` ohne Inhalt (Zug endete, während der
    Gate-Lauf im Hintergrund lief) · Fortsetzung derselben Session als
    `paket-7.impl-0-versuch-2.json`, gleiches Profil
  - 2026-09-30 Zug 2: Report FERTIG_MIT_VORBEHALT (TexturePreview ohne `overflow: hidden`)
    · 26 Dateien geändert, 7 neu, 1 gelöscht · Rauchprobe vorher/nachher in
    `paket-7.smoke-{vorher,nachher}.txt` · Arbeitsbaum schmutzig · eigener Verify läuft
    (`paket-7.verify.log`)
  - 2026-09-30 Zug 2: Verify `pnpm run ci` exit=0, Proben leer bis auf Markdown-Links und
    den einzeiligen CHANGELOG-Eintrag (Nachbarn ebenso)
  - 2026-09-30 Zug 3: Reviewer Runde 0 beauftragt · opus, Effort medium · Diff
    `paket-7.diff` (1953 Zeilen, 30 Dateien)
  - 2026-09-30 Zug 3: Reviewer `paket-7.review-0.json` · angenommen · alle sechs Findings
    behoben · 0 kritisch, 0 wichtig, 4 klein
  - 2026-09-30 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-30 Zug 5: Commit b8868b16 (30 Pfade, Trailer `Remediation-Run: 2026-09-30`) ·
    Verify aus Zug 2 trägt (Baum seither unverändert, Diff byte-gleich) · sieben
    Nebenbefunde in »Offene Befunde«

## Abgleich

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| DOC-003 | im Kern unverändert; die im Audit erwähnte falsche Grad-Umrechnung ist weg | `apps/lookbook/src/pages/demos/_crosses.json:3`, `apps/lookbook/src/demos/crosses/Crosses.ts:4–54`, `:109–118`; `Crosses.ts:77–79` rechnet mit `MathUtils.degToRad` |
| IMPL-004 | unverändert | `apps/lookbook/src/components/SearchLookbook.astro:7–10`, `:24`; `LookbookMetadata.astro:7–19` |
| READ-013 | umgeformt: elf Seiten mit Canvas, `body`-Regel und `new PerspectiveOrbitDemo(…)`, `.texture-preview` in drei Seiten, `.actionBtn` in zwei | `apps/lookbook/src/pages/demos/instanced-quads.astro:36–81` und die Liste in Schritt 2 |
| TYPE-019 | unverändert | `apps/lookbook/src/demos/instanced-quads/InstancedQuadsGeometry.ts:23–25` |
| TYPE-020 | verschoben | `apps/lookbook/src/pages/demos/instanced-quads.astro:73`, Aufruf `:135–138` |
| API-049 | unverändert | `packages/twopoint5d/src/utils/printSceneGraphToConsole.ts:6`, `packages/twopoint5d/src/utils/public-api.ts:5` |

## Entscheidungen in Zug 0

- **Modell stärkste Stufe, Effort medium.** Die Konzeptseite muss die Accessor-Regeln aus
  dem Code treffen, und kein Gate fängt einen Laufzeitfehler der Lookbook — der erste
  Anlauf soll sitzen. Der Effort bleibt bei medium: die meisten Schritte sind exakt
  vorgegeben, und die Berührung der öffentlichen API ist eine mechanische Entfernung.
- **Konzeptseite als `src/vertex-objects/README.md`, nicht als Lookbook-Seite.** Die
  Lookbook ist ein Demo-Raster ohne Seiten für Prosa; eine Markdown-Datei unter
  `packages/twopoint5d/**` fällt in die Eingaben des Code-Block-Checks
  (`packages/twopoint5d-testing/project.json:22`), ihr `ts check`-Block compiliert gegen
  die gebaute Library und veraltet nicht still. Das Muster steht schon da
  (`src/stage/README.md`), und der vorhandene Link im Library-README trifft sie ohne
  Änderung. Die Demo verlinkt sie aus ihrem Dialog.
- **Einstiegs-Demo über `Display`, nicht über `PerspectiveOrbitDemo`.** Das Finding
  verlangt »ohne Subclass«; `PerspectiveOrbitDemo` ist eine `Display`-Subclass der
  Lookbook. Mit `Display`, `Scene` und `PerspectiveCamera` ist jede Zeile Library oder
  three.js und in ein eigenes Projekt übertragbar.
- **Atlas `splotchs` mit dem Frame `splotch0`.** Ein benannter Frame und die Größe aus
  `frame.coords` lassen keine unerklärte Zahl übrig; eine Kachel aus einem Tile-Set
  bräuchte die Kachel-ID 1.
- **Suche als Ergebnisliste im Dialog statt Grid-Filter** — Grund in Schritt 10.
- **`data-lookbook-tags` fällt weg** — kein Leser, siehe Schritt 10.
- **`order` in `IDemo`** — Grund in Schritt 7.
- **`.actionBtn` mitgenommen**, obwohl die Empfehlung es nicht nennt — Grund in Schritt 3.
- **Folgen aus Paket 6 → Nachtragspaket 10.** Beide Stellen sind die unfertige
  Buchführung der Host-Abonnements aus 4b9306c8: `#addToHost()` legt beide Handles in
  einem `push()` ab, so dass ein werfendes `host.onRenderFrame()` den schon genommenen
  `onResize()`-Handle verliert — vor 4b9306c8 registrierten zwei `once()`-Aufrufe den
  ersten sofort (`git show 4b9306c8 -- …/StageRenderer.ts`); und der `catch` um eine
  werfende Abmeldung ist ungetestet. Symptome einer Ursache, deren Paket committet ist:
  ein Nachtragspaket, kein offenes Paket teilt die Datei.
- **Nebenbefund `DemoNavBar.astro:111–155`** → Queue: vier Regeln ohne Element im Markup
  der Komponente (`.lookbook-demo-header img.primary`, `.container`, `.demo-navbar`,
  `.demo-navbar img.primary`), schon in c82f42f7 an denselben Zeilen. Andere Ursache als
  READ-013 (toter Stil statt verdoppeltem), deshalb nicht in dieses Paket; die Datei
  steht nicht in der Liste oben.
- **Queue sonst unberührt:** `apps/lookbook/package.json:18` (`astro-rainbow-line` 2.x)
  liegt in der Lookbook, hat aber eine andere Ursache (Abhängigkeitsstand) und bleibt
  liegen.

## Restplan

- **Paket 10 steht zwischen 7 und 8.** Bibliothekscode vor den beiden Doku-Paketen, wie
  die Phasen des Grobplans laufen; 8 und 9 hängen nicht an ihm, und vor 7 ließe es das
  Paket, dessen Zug 0 gerade läuft, warten.
- **Paket 8** bekommt eine Zeile: Einstiegs-Demo und Konzeptseite sind die Ziele seines
  README-Links (DOC-025), Paket 7 schreibt `apps/lookbook/README.md` und `AGENTS.md`
  fort, die DOC-070-Stelle bleibt ihm.
- **Paket 9** nennt unter »Hängt ab von« den Removed-Eintrag und den Migration-Guide-H4
  aus Paket 7, die es mitglättet.
- Reihenfolge und Schnitt sonst unverändert: kein Finding eines offenen Pakets ist
  weggefallen oder gewandert.

## Findings im Volltext

**DOC-003 · medium · apps/lookbook/src/demos/crosses/Crosses.ts:4** — Kein
Einstiegs-Beispiel für Vertex-Object-Descriptions
Die bestehenden Demos zeigen fertige Systeme mit Subclasses und Magic Numbers; `crosses`
nennt sich »minimal example«, bringt aber eine 12-Vertex-Description mit 18 Indizes und
eine falsche Grad-Umrechnung (BUG-095) mit. Wer verstehen will, was eine
`VertexObjectDescription` überhaupt ist, findet keinen Einstieg — dabei ist genau das der
Begriff, an dem die ganze Bibliothek hängt. Re-Check: unverändert.
Empfehlung: Eine Demo *Your First Sprite*, die in dreißig Zeilen einen einzelnen
TexturedSprite zeigt — ohne Subclass, ohne unerklärte Zahlen. Begleitend eine
Concept-Seite, die die Description erklärt.

**IMPL-004 · low · apps/lookbook/src/components/SearchLookbook.astro:7-10** — Die Suche
ausliefern oder den Button entfernen; Ctrl K verdrahten, wenn sie bleibt
Der Header bewirbt eine `Ctrl K`-Suche; nirgends in `src/` existiert ein
`keydown`-Handler, und der Dialog-Rumpf ist der String »TODO search lookbook«.
`LookbookMetadata.astro` serialisiert den gesamten Demo-Katalog und den Tag-Graphen in
DOM-Attribute eines versteckten Divs, das kein Script liest — vermutlich die Datenquelle
für diese Suche. Als Startseite der lebenden Dokumentation sieht der Stub für einen
Besucher wie ein Bug aus. Re-Check: unverändert.
Empfehlung: Entweder implementieren (die Daten liegen schon im DOM: `.link-card` nach
Titel/Tags filtern und das bestehende `lookbook.showDemos`-Event dispatchen) mit einem
`keydown`-Listener für Ctrl/Cmd+K, oder `SearchLookbook` und `LookbookMetadata` bis dahin
entfernen.

**READ-013 · low · apps/lookbook/src/pages/demos/instanced-quads.astro:71-76** — Das
Boilerplate pro Demo-Seite in VanillaDemo.astro falten und eine Definition des
Instanced-Quads behalten
`PerspectiveOrbitDemo` und `assetsUrl` sind sauber geteilt. Dupliziert sind: `<canvas
id="canvas-container" resize-to="window">` + `body {height:100vh; overflow-y:hidden}` +
`new PerspectiveOrbitDemo(…)` in 12 Seiten, das `.texture-preview`-CSS in 4, `.actionBtn`
in 2, und — was den Leser kostet — zwei `InstancedQuad`/`BaseQuad`-Definitionen, deren
`setInstancePosition`-Signaturen sich unterscheiden (2-Tupel gegen 3-Tupel), während der
Descriptor drei Komponenten deklariert. Etwas Wiederholung ist für selbsttragende
Demo-Seiten richtig; zwei divergierende Definitionen desselben Konzepts nicht.
Empfehlung: `VanillaDemo.astro` bekommt eine `fullscreenCanvas`-Prop, die Canvas und
Body-Regel emittiert; eine `TexturePreview.astro`-Komponente; `instanced-quads.astro`
importiert `InstancedQuadsGeometry.ts` wie `textured-quads.astro`.

**TYPE-019 · low · apps/lookbook/src/demos/instanced-quads/InstancedQuadsGeometry.ts:22-24**
— BaseQuad sagt drei Properties zu, die der Descriptor nie erzeugt
Das Interface `BaseQuad` deklariert `x4`, `y4` und `z4`, obwohl `BaseQuadDescriptor` mit
`vertexCount: 4` nur `x0` … `x3` erzeugt. Drei Properties, die zur Laufzeit `undefined`
sind und die der Typ zusagt. Aufgefallen im Remediation-Lauf vom 2026-09-20.
Empfehlung: Die drei Deklarationen streichen; der Descriptor ist die Quelle, das
Interface bildet ihn ab.

**TYPE-020 · low · apps/lookbook/src/pages/demos/instanced-quads.astro:75** —
setInstancePosition ist als Paar typisiert, nimmt aber ein Tripel
`setInstancePosition: (position: [number, number]) => void` bei einem Attribut
`instancePosition` mit drei Komponenten; der generierte Setter nimmt drei Werte. Die
Demo-Version daneben (`InstancedQuadsGeometry.ts:67`) schreibt das Tripel korrekt.
Aufgefallen im Remediation-Lauf vom 2026-09-20.
Empfehlung: Die Signatur auf drei Komponenten ziehen, wie in der Schwesterdatei.

**API-049 · low · packages/twopoint5d/src/utils/printSceneGraphToConsole.ts:6** —
printSceneGraphToConsole aus der öffentlichen Oberfläche nehmen oder begrenzen
Eine Debughilfe, die jedes `Object3D` eines Teilbaums per `console.dir` ausgibt (ein
`TexturedSprites`-Mesh zieht Geometrie, Pools und TypedArrays in die Konsole, wo DevTools
sie erreichbar hält), ist als erstklassige API neben den Rendering-Klassen exportiert.
Kein Tiefen- oder Anzahllimit, keine injizierbare Senke, keine Spec; nichts in
`packages/` oder `apps/` nutzt sie. Es ist der einzige Bibliothekscode, der außerhalb
eines einmaligen `warn` in die Konsole schreibt.
Empfehlung: In die Lookbook verschieben (oder einen `/devtools`-Subpath, sollte je einer
entstehen) und aus `utils/public-api.ts` streichen (CHANGELOG »Removed«); bleibt sie,
einen `log`-Senken-Parameter und ein `maxDepth` nehmen, eine Zeile pro Knoten statt
`console.dir`.

## Urteil des Reviewers (Runde 0)

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| DOC-003 | behoben | `apps/lookbook/src/pages/demos/first-sprite.astro:14–71`, `_first-sprite.json:1–8`, `packages/twopoint5d/src/vertex-objects/README.md:1–219` (ein `ts check`-Block `:127–170`), `_crosses.json:3`, `_instanced-quads.json:3` |
| IMPL-004 | behoben | `apps/lookbook/src/components/searchDemos.ts:9–19`, `SearchLookbook.astro:20–30`, `:120–201`, `LookbookMetadata.astro:7` |
| READ-013 | behoben | `VanillaDemo.astro:10`, `:26–27`, `:47–70`, `fullscreenCanvas.ts:1–15`, `TexturePreview.astro`, die elf Seiten, `instanced-quads.astro:17` |
| TYPE-019 | behoben | `InstancedQuadsGeometry.ts:4–24` |
| TYPE-020 | behoben | `InstancedQuadsGeometry.ts:62`, Aufruf `instanced-quads.astro:76–80` |
| API-049 | behoben | `packages/twopoint5d/src/utils/public-api.ts`, `apps/lookbook/src/demos/utils/printSceneGraphToConsole.ts:1–25`, Nutzer `instanced-quads.astro:125`, `CHANGELOG.md:342`, `:970–986` |

Die Konzeptseite hat der Reviewer Aussage für Aussage gegen den Code geprüft
(`vertexObjectPropertyNames.ts`, `createVertexObjectPrototype.ts`, `VertexObjectPool.ts:137`,
`VertexObjectDescriptor.ts:19`, `TexturedSprite.ts:248`, `docs/architecture.md:43`); alles
stimmt. Die Abweichung bei `TexturePreview` (`max-height: 100%` statt `overflow: hidden`,
`TexturePreview.astro:28–33`) trägt er.

Kleine Befunde (lösen keine Runde aus):

- `first-sprite.astro:69` — `display.start()` liefert ein Promise, das niemand abwartet
  oder abfängt; die Schwesterseiten schreiben `await demo.start(…)`.
- `first-sprite.astro:58–62` — `display.onDispose(…)` steht nach zwei `await` im
  Init-Listener; ein `dispose()` während des Ladens verpasst den Listener
  (`Display.ts:2088–2094`) und lässt Store und Mesh liegen. Robuster: vor die Awaits ziehen,
  `sprites?.dispose()`.
- `first-sprite.astro:21–23` — der Kommentar rechnet nur die Höhe; bei Aspekt unter etwa
  0,55 (Hochkant-Telefon) wird das Sprite seitlich beschnitten.
- `SearchLookbook.astro:186–191` — Enter navigiert auch während einer IME-Komposition
  (`event.isComposing` ungeprüft).

## Nebenbefunde: Urteil

Alle sieben aus dem Report des Implementierers, je gegen `git show 4b9306c8:<pfad>` als
vorbestehend bestätigt. Die Scope-Regel nimmt jede Severity, deshalb `→ Scope`; keiner teilt
die Ursache eines Findings dieses Pakets (tote Kommentare, Metadaten-Nebenwirkungen,
Debug-Global, Umbruch, Groß-/Kleinschreibung im CHANGELOG), keiner kippt eine
Entscheidung. Die Stelle `apps/lookbook/README.md:65–66` ist kein neuer Eintrag, sie ist
DOC-070 in Paket 8.
