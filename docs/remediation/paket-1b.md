# Paket 1b — Gemeinsame Test-Helfer der Browser-Suite

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-024 (low), READ-017 (info)
- Ziel: Die Browser-Suite holt ihre Fixture-Helfer aus einem gemeinsamen Modul `test/helpers/fixtures.js`, keine Testdatei trägt mehr eine eigene Kopie davon, jedes Display geht mit demselben Teardown ab, und der Kommentar in `display-resize.test.js` liest sich ohne Vorzustand.
- Modell: mittlere Stufe
- Effort: low
- Dateien (alle Testdateien unter `packages/twopoint5d-testing/test/`):
  - `packages/twopoint5d-testing/test/helpers/fixtures.js` (neu)
  - Display: `display-adopt-renderer.test.js`, `display-constructor.test.js`, `display-dispose.test.js`, `display-lifecycle.test.js`, `display-resize.test.js`, `hello-twopoint5d-canvas.test.js`, `renderer-backend.test.js`
  - Stage und Sprites: `stage-pipeline.test.js`, `stage-renderer.test.js`, `sprites-rotation.test.js`
  - Map2D: `map2d-placement.test.js`, `map2d-tile-upload.test.js`, `map2d-visibility-helpers.test.js`
  - Vertex Objects: `vertex-objects-buffers-data.test.js`, `vertex-objects-dispose.test.js`, `vertex-objects-gpu-upload.test.js`, `vertex-objects-heap.test.js`
  - PanControl2D: `pan-control-cursor.test.js`, `pan-control-dispose.test.js`, `pan-control-input.test.js`, `pan-control-keys.test.js`, `pan-control-switch-off.test.js`
  - `eslint.config.mjs` (Repo-Root)
  - `AGENTS.md` (Repo-Root)
- Vorgehen: siehe Abschnitt »Vorgehen« unten. Die Schritte sind nummeriert und in dieser Reihenfolge auszuführen.
- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci`
- Commit: `test: share the fixtures of the browser tests through test/helpers/fixtures.js, take every display down with the same dispose-only teardown, point AGENTS.md at the shared module, and reword the first-frame comment of the resize test`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · TEST-024: Extraktion offen und gewachsen (`makeContainer` 15 Dateien statt 11, `disposeDisplay` 12 statt 9, `pointer` 4, `key` 3, `makeState` 4, `bufferOf` 2, `readBack` 2, `quadDescription` 4, `instancedDescription` 3); `start()` im Teardown seit 7ec25649 gegenstandslos; zweiter Teardown-Vertrag lebt in 5 Dateien mit nacktem `dispose()` · READ-017 unverändert, jetzt `display-resize.test.js:467-468` · aufgenommen: `makeMap`/`makeRectMap` in 3 map2d-Tests (gleiche Ursache) · keine offenen Folgen aus Paket 1 · 6 Einträge in »Offene Befunde« liegen alle in `src/display/`, keiner teilt die Ursache → liegen gelassen · Restplan unverändert
  - 2026-09-24 Zug 1: Implementierer beauftragt, sonnet (mittlere Stufe), effort low, Report nach paket-1b.impl-1.json
  - 2026-09-24 Zug 2: FERTIG_MIT_VORBEHALT · 24 Dateien geändert, 1 neu (`test/helpers/fixtures.js`) · Tests vorher/nachher Chromium 164+1 skip, Firefox 160+5 skip, `it(` 165 · Arbeitsbaum schmutzig · eigener Verify exit=0 (`paket-1b.verify.log`)
  - 2026-09-24 Zug 3: Reviewer (sonnet, low): beide Findings behoben, kein kritisch/wichtig, 1 klein · Diff `paket-1b.diff`
  - 2026-09-24 Zug 4: keine Runde nötig
  - 2026-09-24 Zug 5: committet cf1304c7 mit Trailer `Remediation-Run: 2026-09-24`

## Abgleich

Gegen `6a4bcacf` (HEAD beim Zug 0). Die Browser-Suite liegt in
`packages/twopoint5d-testing/test/` und hat 26 Testdateien, 5487 Zeilen und 165
`it(`-Aufrufe (statisch gezählt, kein `it.skip`/`it.only`).

- **TEST-024, Extraktion: unverändert und gewachsen.** Das Audit (Stand
  2026-09-23) zählte `makeContainer` in 11 Dateien und `disposeDisplay` in 9.
  Heute sind es 15 und 12, weil die Tests aus 7ec25649, 2503bd68 und Paket 1
  (`display-lifecycle.test.js`) jeweils eine eigene Kopie mitgebracht haben.
  Es gibt kein `test/helpers/`. Die Kopien im Einzelnen:
  - `makeContainer` in drei Varianten:
    - **(a)** mit Box-Reset (`boxSizing`, `padding`, `margin`, `border`), ohne
      `id`-Option: `display-constructor.test.js:9-23`,
      `display-dispose.test.js:8-22`, `renderer-backend.test.js:6-20`,
      `stage-renderer.test.js:9-23`
    - **(b)** wie (a) plus Option `id`: `display-lifecycle.test.js:16-30`,
      `display-resize.test.js:8-22`
    - **(c)** ohne Box-Reset, ohne `id`: `map2d-placement.test.js:19-29`,
      `map2d-tile-upload.test.js:19-29`, `map2d-visibility-helpers.test.js:22-32`,
      `sprites-rotation.test.js:11-21`, `stage-pipeline.test.js:9-19`,
      `vertex-objects-buffers-data.test.js:10-20`,
      `vertex-objects-dispose.test.js:13-23`,
      `vertex-objects-gpu-upload.test.js:13-23`,
      `vertex-objects-heap.test.js:38-48`

    Jede Datei setzt `el.id` aus einer eigenen Konstante `FIXTURE_ID`. Gelesen
    wird diese ID nirgends: kein `getElementById`, kein `querySelector` auf das
    Präfix. Explizite IDs gibt nur `display-resize.test.js` (`'size-ref'` in
    `:118`, `'alt-ref'` in `:425`), und die liest ein `resize-to`-Selektor.
  - `disposeDisplay`: eine Variante, zeichengleich in 12 Dateien
    (`display-lifecycle:33`, `display-resize:25`, `map2d-placement:32`,
    `map2d-tile-upload:37`, `map2d-visibility-helpers:35`, `sprites-rotation:24`,
    `stage-pipeline:22`, `stage-renderer:26`, `vertex-objects-buffers-data:23`,
    `vertex-objects-dispose:26`, `vertex-objects-gpu-upload:31`,
    `vertex-objects-heap:51`).
  - `pointer` in zwei Signaturen: `(type, {x, y, buttons})` auf `document.body`
    in `pan-control-cursor:6`, `pan-control-dispose:14`,
    `pan-control-switch-off:11` (zusammen 33 Aufrufe) und
    `(target, type, {x, y, buttons, pointerId, pointerType})` in
    `pan-control-input:21` (25 Aufrufe).
  - `key` in zwei Signaturen: `(type, code)` in `pan-control-dispose:28` und
    `pan-control-switch-off:25`, `(type, init)` in `pan-control-keys:6`.
  - `makeState`: zeichengleich in `pan-control-cursor:28`,
    `pan-control-dispose:32`, `pan-control-input:35`, `pan-control-switch-off:29`.
  - `bufferOf`: zeichengleich in `map2d-tile-upload:32` und
    `vertex-objects-gpu-upload:26`; nur die JSDoc-Zeile unterscheidet sich.
  - `readBack` in zwei Signaturen: `(renderer, attr)` in
    `vertex-objects-buffers-data:33` (1 Aufruf, `:94`) und `(display, attr)` in
    `vertex-objects-gpu-upload:41` (5 Aufrufe: `:58`, `:160`, `:200`, `:241`,
    `:242`).
  - `quadDescription`: zeichengleich in `vertex-objects-buffers-data:38`,
    `vertex-objects-dispose:36`, `vertex-objects-gpu-upload:74`,
    `vertex-objects-heap:61`.
  - `instancedDescription`: zeichengleich in `vertex-objects-dispose:43`,
    `vertex-objects-gpu-upload:90`, `vertex-objects-heap:68`.
- **TEST-024, Teardown, erster Teil: gegenstandslos.** Kein `afterEach` der
  Suite ruft `start()`. Die drei Dateien, die das Audit nennt, gehen seit
  7ec25649 mit `disposeDisplay` ab. Geprüft sind alle 26 `afterEach`-Blöcke. Der
  einzige Treffer `start()` in `display-dispose.test.js:668` steht in einem
  Testrumpf.
- **TEST-024, Teardown, zweiter Teil: offen.** Es gibt weiter zwei
  Teardown-Verträge. Fünf Dateien bauen ein Display und rufen im `afterEach`
  `dispose()` nackt auf, ohne `try/catch`:
  `display-constructor.test.js:52-61`, `display-dispose.test.js:69-82` (zwei
  Displays: `previous` und `display`), `renderer-backend.test.js:31-36`,
  `display-adopt-renderer.test.js:21-33` und
  `hello-twopoint5d-canvas.test.js:11-14`. Wirft dort ein `dispose()`, verdeckt
  der Teardown den Fehler, der ihn ausgelöst hat.
- **READ-017: unverändert, verschoben.** Der Kommentar steht jetzt in
  `display-resize.test.js:467-468` im Test `does not double-emit OnDisplayResize
  on the first frame when the size differs from construction`: `… — frame 1
  still emits OnDisplayResize exactly once, with that size.`
- **Aufgenommen, gleiche Ursache: `makeMap`.** Die drei map2d-Tests tragen je
  eine Kopie von `makeMap` (`map2d-placement:50`, `map2d-tile-upload:47`,
  `map2d-visibility-helpers:45`). `map2d-visibility-helpers:68` hat dazu
  `makeRectMap`. Alle vier bauen dieselbe Szene und unterscheiden sich nur im
  `visibilitor` und in den Feldern, die sie zurückgeben. Das Audit hat sie nicht
  gezählt, die Ursache ist aber dieselbe wie bei TEST-024: kopierte
  Fixture-Helfer ohne gemeinsames Modul. Außerdem fasst dieses Paket die drei
  Dateien ohnehin an. Blieben sie stehen, wäre das Ziel »keine Testdatei trägt
  mehr eine eigene Kopie« in genau den Dateien verfehlt, die das Paket ändert.
- **Nicht aufgenommen:** Helfer, die nur einmal vorkommen, bleiben lokal. Das
  sind `animationFrames`, `recordEvents` und `nextEvent` (display-lifecycle),
  `nextFrame`, `collectWarnings` und `makeSizeRef` (display-resize),
  `whenReleased` und `expectLiveBackend` (display-dispose), `makeRendererStub`
  (display-constructor), `makeCamera` (map2d-placement), `makeBox`
  (pan-control-input), `makeTarget` (pan-control-cursor), `press`, `release`,
  `speeds` und `STILL` (pan-control-keys), `readBackInterleaved` und die
  Beschreibungen `staticQuadDescription`/`interleavedQuadDescription`
  (vertex-objects-gpu-upload) sowie `extraInstancedDescription`
  (vertex-objects-dispose). Die Tastenkonstanten `KEY_*` in pan-control-dispose
  und pan-control-switch-off sind Daten, keine Helfer, und bleiben ebenfalls
  lokal (siehe Schritt 6). Die Zeilen `host.parentNode.removeChild(host)` in
  den `afterEach`-Blöcken bleiben, wie sie sind: Das sind keine kopierten
  Funktionen, und das Audit empfiehlt dafür keinen Helfer.

## Entscheidungen dieses Pakets

- **Ein Modul, wie empfohlen.** Alles kommt nach `test/helpers/fixtures.js`,
  auch die Helfer für PanControl2D, Vertex Objects und Map2D, in
  kommentierten Abschnitten. Die Empfehlung des Audits nennt dieses eine Modul,
  und alle Testdateien importieren `@spearwolf/twopoint5d` ohnehin.
  `@web/test-runner` lädt nur `test/**/*.test.js` (`web-test-runner.config.js`),
  `fixtures.js` wird also nicht als Test ausgeführt. `tsconfig.json`
  (`"include": ["test"]`) und die Nx-Inputs von `typecheck`
  (`{projectRoot}/test/**/*.js`) erfassen die Datei schon.
- **`makeContainer` = Variante (b), ohne Datei-Präfix.** Gilt jetzt für alle
  15 Dateien. Der Box-Reset ändert für die neun Dateien der Variante (c) nichts:
  Ein `div` ohne Stylesheet hat `padding`, `margin` und `border` 0, und dann ist
  `box-sizing` wirkungslos. Die `testRunnerHtml` bringt kein Stylesheet mit. Die
  Standard-ID heißt `fixture-<zufall>`, und die 15 Konstanten `FIXTURE_ID`
  entfallen. Das Präfix hat nie etwas unterschieden, denn `@web/test-runner`
  lädt jede Testdatei in eine eigene Seite, und gelesen wird die ID nirgends.
- **`disposeDisplay` gilt für jedes Display der Suite.** Das betrifft auch
  die fünf Dateien mit nacktem `dispose()`, und dort auch `previous` in
  `display-dispose.test.js`. Dass ein zweites `dispose()` nicht wirft, prüft
  `display-dispose.test.js` in einem eigenen Fall. Das `try/catch` des Teardowns
  verdeckt dort also nichts, was sonst ungeprüft bliebe.
- **`pointer(type, {…, target = document.body})`.** Das Ziel geht als Option
  mit, damit die 33 Aufrufe ohne Ziel unverändert bleiben. Die 25 Aufrufe in
  `pan-control-input.test.js` ziehen ihr erstes Argument in die Option `target`.
- **`key(type, init)` mit einem `KeyboardEventInit`.** So kann
  `pan-control-keys` weiterhin `keyCode` und `key` mitgeben. In
  `pan-control-dispose` und `pan-control-switch-off` werden die Konstanten
  `KEY_*` zu Init-Objekten (`{code: 'KeyW'}`), und ihre Aufrufe
  `key('keydown', KEY_NORTH)` bleiben zeichengleich.
- **`readBack(renderer, attr)`.** Die Funktion liest vom Renderer. Die fünf
  Aufrufe in `vertex-objects-gpu-upload.test.js` übergeben deshalb
  `display.renderer`.
- **`makeMap(visibilitor)` gibt `{map2d, tileSprites, tileRenderer}` zurück.**
  Die Aufrufer bauen den `visibilitor` selbst und behalten ihn, wenn sie ihn
  brauchen. `makeRectMap` entfällt, weil sie `makeMap` mit einer
  `RectangularVisibilityArea` ist.
- **Zwei Stellen außerhalb der Suite.** `eslint.config.mjs` muss mit, sonst
  scheitert Lint: Die Browser-Globals hängen am Muster `**/*.test.js`, und
  `fixtures.js` ergäbe `no-undef` für `document` und `PointerEvent`, per
  `eslint --stdin` gegen den Pfad geprüft. `AGENTS.md` bekommt einen Satz,
  weil die Kopien seit dem Audit an einem einzigen Tag von 11 auf 15 gewachsen
  sind, eine davon aus diesem Lauf. Ohne Hinweis kopiert der nächste Test
  wieder.
- **Kein CHANGELOG-Eintrag.** `@spearwolf/twopoint5d-testing` ist privat und
  hat kein CHANGELOG, und am veröffentlichten Paket ändert sich nichts.
- **Kein roter Lauf.** Das ist kein Bugfix-Paket. Der Beleg ist, dass die Suite
  vorher und nachher dieselben Tests zählt und grün bleibt (Schritt 1 und 12).

## Vorgehen

Pfade in den Schritten 2 bis 8 und 11 sind relativ zu
`packages/twopoint5d-testing/test/`; Schritt 9 und 10 betreffen Dateien im
Repo-Root. Jede Testdatei importiert ihre Helfer mit
einer Zeile `import {…} from './helpers/fixtures.js';` als letztem
`import`-Statement, vor den `/** @import … */`-Kommentaren. Importiert wird nur,
was die Datei benutzt. Imports, die nach dem Entfernen einer Kopie ungenutzt
sind (`TileSet`, `Map2D` usw. aus `@spearwolf/twopoint5d`), fallen weg. Lint
meldet sie sonst über `@typescript-eslint/no-unused-vars`.

1. **Vorher zählen.** Führ vor jeder Änderung vom Repo-Root aus
   `pnpm nx test twopoint5d-testing --skip-nx-cache --output-style=static` aus
   und notier die Zahl der bestandenen Tests je Browser (Chromium, Firefox) aus
   der Zusammenfassung. Dazu kommt
   `grep -cE "^\s*it\(" packages/twopoint5d-testing/test/*.test.js | awk -F: '{s+=$2} END {print s}'`,
   das jetzt `165` ergibt.

2. **`helpers/fixtures.js` anlegen**, mit genau diesem Inhalt (danach nur
   Prettier):

   ```js
   /** @import {Display, VertexObjectDescription} from '@spearwolf/twopoint5d' */
   import {
     Map2D,
     Map2DTileRenderer,
     RepeatingTilesProvider,
     TextureCoords,
     TileSet,
     TileSprites,
     TileSpritesFactory,
     TileSpritesGeometry,
     TileSpritesMaterial,
   } from '@spearwolf/twopoint5d';

   // The fixtures the browser tests build their cases from. A helper that a second test file
   // needs moves here instead of being copied.

   // --- containers and displays ---

   /**
    * A box of exactly `width` × `height` CSS pixels at the top left of the page, appended to
    * `document.body`. The display measures its container, so nothing — padding, margin, border —
    * may add to that size. `id` names the box for a `resize-to` selector; without one it gets a
    * random id.
    *
    * @param {{width?: number, height?: number, id?: string}} [options]
    */
   export function makeContainer({width = 320, height = 200, id} = {}) {
     const el = document.createElement('div');
     el.id = id ?? `fixture-${Math.random().toString(36).slice(2, 8)}`;
     el.style.position = 'absolute';
     el.style.left = '0';
     el.style.top = '0';
     el.style.width = `${width}px`;
     el.style.height = `${height}px`;
     el.style.boxSizing = 'border-box';
     el.style.padding = '0';
     el.style.margin = '0';
     el.style.border = '0';
     document.body.appendChild(el);
     return el;
   }

   /**
    * Teardown must not mask the failure that got it here: no display, or a display that fails to
    * go down. It calls `dispose()` and nothing else — a disposed display refuses `start()`, and a
    * start in the teardown would cost a renderer init per test.
    *
    * @param {Display | undefined} display
    */
   export function disposeDisplay(display) {
     if (!display) return;
     try {
       display.dispose();
     } catch {
       // ignore — the fixture still has to leave the dom
     }
   }

   // --- input for PanControl2D ---

   /**
    * PanControl2D listens on `document`, so a pointer event dispatched on any element bubbles up
    * to it. The element it is dispatched on — `document.body` unless `target` names another — is
    * what the control sees as `event.target`.
    */
   export function pointer(type, {x = 0, y = 0, buttons = 1, pointerId = 1, pointerType = 'mouse', target = document.body} = {}) {
     target.dispatchEvent(
       new PointerEvent(type, {
         bubbles: true,
         pointerId,
         isPrimary: true,
         pointerType,
         buttons,
         clientX: x,
         clientY: y,
       }),
     );
   }

   /** A key event on `document`, where PanControl2D listens; `init` names the key, usually by `code`. */
   export function key(type, init) {
     document.dispatchEvent(new KeyboardEvent(type, {bubbles: true, ...init}));
   }

   /** The pan state a PanControl2D writes into: at the origin, at a pixel ratio of 1. */
   export function makeState() {
     return {x: 0, y: 0, pixelRatio: 1};
   }

   // --- vertex objects ---

   /**
    * The buffer behind an attribute — an interleaved attribute shares it with its siblings. It
    * carries the version that counts the uploads and the update ranges that steer them.
    */
   export function bufferOf(attr) {
     return attr.isInterleavedBufferAttribute ? attr.data : attr;
   }

   /** Reads an attribute back out of the gpu buffer three has uploaded it into. */
   export async function readBack(renderer, attr) {
     return Array.from(new Float32Array(await renderer.getArrayBufferAsync(attr)));
   }

   /** @type {VertexObjectDescription} */
   export const quadDescription = {
     vertexCount: 4,
     indices: [0, 1, 2, 0, 2, 3],
     attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
   };

   /** @type {VertexObjectDescription} */
   export const instancedDescription = {
     attributes: {instanceOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
   };

   // --- map2d ---

   /** A map on the XZ ground plane, seen through `visibilitor`, without a loaded texture: the tile set builds its own atlas. */
   export function makeMap(visibilitor) {
     const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
     const tileData = new RepeatingTilesProvider([
       [1, 2],
       [3, 4],
     ]);
     const tileSprites = new TileSprites(new TileSpritesGeometry(512), new TileSpritesMaterial());
     const tileRenderer = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData));

     const map2d = new Map2D();
     map2d.tileWidth = 256;
     map2d.tileHeight = 256;
     map2d.xOffset = -128;
     map2d.yOffset = -128;
     map2d.visibilitor = visibilitor;
     map2d.addTileRenderer(tileRenderer);

     return {map2d, tileSprites, tileRenderer};
   }
   ```

   Meldet `pnpm typecheck` an diesem Modul einen Typfehler, den eine
   JSDoc-Annotation behebt, ist sie erlaubt. Die Signaturen bleiben dabei, wie
   sie hier stehen.

3. **Die 15 Kopien von `makeContainer` und die 15 Konstanten `FIXTURE_ID`
   löschen** (Dateien und Zeilen: siehe Abgleich). Mit ihnen geht auch der
   `@param`-Kommentar über `makeContainer` in `display-lifecycle.test.js:15` und
   `display-resize.test.js:7`. Die Aufrufe bleiben zeichengleich, die Signatur
   ist dieselbe.

4. **Die 12 Kopien von `disposeDisplay` samt JSDoc-Zeile löschen.** Dann stellen
   die fünf Dateien mit nacktem `dispose()` ihren Teardown auf `disposeDisplay`
   um. Den Rest ihres `afterEach` lassen sie, wie er ist:
   - `display-constructor.test.js:53-55`:
     `if (display) { display.dispose(); }` → `disposeDisplay(display);`
   - `display-dispose.test.js:70-72` und `:74-76`: `if (previous) {
     previous.dispose(); }` → `disposeDisplay(previous);`, das Gleiche für
     `display`. Der Kommentar in `:67-68` bleibt stehen.
   - `renderer-backend.test.js:32`: `display?.dispose();` →
     `disposeDisplay(display);`
   - `display-adopt-renderer.test.js:24`: `display.dispose();` →
     `disposeDisplay(display);`. Der `if/else`-Zweig mit `renderer.dispose()`
     und der Kommentar in `:23` bleiben.
   - `hello-twopoint5d-canvas.test.js:12`: `display?.dispose();` →
     `disposeDisplay(display);`

   Danach gibt
   `awk '/^  afterEach/,/^  \}\);/' *.test.js | grep -nE "(display|previous)\??\.dispose\(\)"`
   (aus `packages/twopoint5d-testing/test/`) nichts mehr aus. Vorher sind es
   sechs Treffer. Ein `display.dispose()` in einem Testrumpf ist Gegenstand des
   Tests und bleibt.

5. **Vertex Objects.** Die Kopien von `bufferOf`, `readBack`, `quadDescription`
   und `instancedDescription` samt ihrer JSDoc-Zeilen löschen (Dateien und
   Zeilen: siehe Abgleich). In `vertex-objects-gpu-upload.test.js` werden die
   fünf Aufrufe `readBack(display, …)` zu `readBack(display.renderer, …)`, das
   betrifft `:58` in `readBackInterleaved` sowie `:160`, `:200`, `:241` und
   `:242`. `readBackInterleaved`, `staticQuadDescription` und
   `interleavedQuadDescription` bleiben lokal, ebenso die `@typedef`-Zeilen
   und, wo noch gebraucht, der `/** @import {…VertexObjectDescription} */`.
   `map2d-tile-upload.test.js` bezieht `bufferOf` ebenfalls aus dem Modul.

6. **PanControl2D.**
   - `pointer` und `makeState` in `pan-control-cursor`, `pan-control-dispose`,
     `pan-control-input` und `pan-control-switch-off` löschen, `key` in
     `pan-control-dispose`, `pan-control-keys` und `pan-control-switch-off`.
   - `pan-control-input.test.js`: Jeder der 25 Aufrufe
     `pointer(<ziel>, '<typ>', {…})` wird zu `pointer('<typ>', {target: <ziel>, …})`,
     bei gespreiztem `touch` also `pointer('pointerdown', {...touch, target: box, x: 10, y: 10})`.
     Die Aufrufe stehen in `:67`, `:68`, `:80`, `:81`, `:197`, `:198`, `:202`,
     `:203`, `:207`, `:220-225` (fünf) und `:237-276`.
   - `pan-control-dispose.test.js:7-10`: `const KEY_NORTH = {code: 'KeyW'};`,
     ebenso `KEY_SOUTH` (`'KeyS'`), `KEY_WEST` (`'KeyA'`) und `KEY_EAST`
     (`'KeyD'`). `pan-control-switch-off.test.js:7`:
     `const KEY_NORTH = {code: 'KeyW'};`. Der zweizeilige Kommentar darüber ist
     heute in beiden Dateien gleich; seine zweite Zeile
     `// the KeyboardEvent.code of the keys at the W, S, A and D positions` wird in
     beiden Dateien zu
     `// each as the init of a key event, naming the KeyboardEvent.code of the keys at the W, S, A and D positions`.
     Die erste Zeile bleibt. Die Aufrufe `key('keydown', KEY_NORTH)` bleiben
     zeichengleich.
   - Kommentare über den gelöschten Funktionen, die nur wiederholen, was die
     JSDoc im Modul sagt (»the control listens on `document`, so a pointer event
     dispatched on `document.body` bubbles up to it«), fallen weg. Zwei sagen
     etwas über ihre Datei und bleiben als Kommentar über dem `describe` stehen:
     `pan-control-cursor.test.js:5` (»both controls listen on `document`, so one
     drag over `document.body` reaches them both«) und die zweite Hälfte von
     `pan-control-keys.test.js:4-5` (»every keydown a test sends is followed by
     its keyup, so no key stays held for the next control«). Letztere steht über
     `press`/`release`, die lokal bleiben.

7. **Map2D.**
   - `makeMap` in allen drei Dateien löschen, `makeRectMap` in
     `map2d-visibility-helpers.test.js` ebenfalls.
   - `map2d-placement.test.js:105` und `:115`:
     `makeMap(originCamera)` → `makeMap(new CameraBasedVisibility(originCamera))`,
     das Gleiche für `movedCamera`.
   - `map2d-tile-upload.test.js:99` und `:128`:
     `makeMap(camera)` → `makeMap(new CameraBasedVisibility(camera))`.
   - `map2d-visibility-helpers.test.js:148`, `:178`, `:207`, `:243`:
     `const {map2d, visibility} = makeMap(camera);` →
     `const visibility = new CameraBasedVisibility(camera);` plus
     `const {map2d} = makeMap(visibility);`. `:277`:
     `const {map2d, visibility} = makeRectMap();` →
     `const visibility = new RectangularVisibilityArea(640, 480);` plus
     `const {map2d} = makeMap(visibility);`.
   - Die Imports aus `@spearwolf/twopoint5d` auf das kürzen, was die Datei noch
     selbst benutzt. `CameraBasedVisibility` bleibt überall, dazu in
     visibility-helpers `RectangularVisibilityArea`.

8. **READ-017.** `display-resize.test.js:468` (nach den Löschungen weiter oben
   in der Datei, der Test heißt `does not double-emit OnDisplayResize on the
   first frame when the size differs from construction`):
   `// size the constructor never saw — frame 1 still emits OnDisplayResize exactly once, with that size.`
   →
   `// size the constructor never saw — frame 1 nonetheless emits OnDisplayResize exactly once, with that size.`
   Das Audit schlägt »all the same« vor. »nonetheless« sagt dasselbe, ist
   eindeutig und passt vor die folgende Apposition.

9. **`eslint.config.mjs`**, direkt nach dem Block mit
   `files: ['**/*.test.js']` einen eigenen Block einfügen:

   ```js
   {
     // the shared fixtures of the browser tests run in the page of the test that imports them
     files: ['packages/twopoint5d-testing/test/helpers/*.js'],
     languageOptions: {globals: globals.browser},
   },
   ```

10. **`AGENTS.md`**, Abschnitt »Rules you cannot read off the code«, Punkt
    **Two test surfaces**. Nach `A change to rendering or GPU-buffer code needs
    both.` diesen Satz im selben Absatz anhängen, umbrochen wie der Absatz (rund
    88 Zeichen je Zeile, Folgezeilen zwei Leerzeichen eingerückt):

    ```markdown
    The browser tests share their fixtures through
    `packages/twopoint5d-testing/test/helpers/fixtures.js`; a helper that a second
    test file needs goes there, not into both.
    ```

11. **Formatieren und gegenprüfen.** Führ
    `pnpm exec prettier --write` nur auf den geänderten und neuen `.js`- und
    `.mjs`-Dateien aus, nicht `pnpm format`. Danach müssen diese Befehle aus
    `packages/twopoint5d-testing/test/` leer bleiben:
    - `grep -nE "^(async )?function (makeContainer|disposeDisplay|pointer|key|makeState|bufferOf|readBack|makeMap|makeRectMap)\b" *.test.js`
    - `grep -nE "^const (quadDescription|instancedDescription|FIXTURE_ID)\b" *.test.js`

12. **Nachher zählen.** Den Lauf aus Schritt 1 wiederholen. Die Zahl der
    bestandenen Tests je Browser muss gleich sein und `it(` weiter `165`
    ergeben. Beide Zahlenpaare kommen in den Report.

## Review

- TEST-024: behoben — Schritt-11-Greps leer, `helpers/fixtures.js` zeichengleich mit Schritt 2, `afterEach`-Grep leer (auch `previous` in `display-dispose.test.js`), `eslint.config.mjs:67-71`, `AGENTS.md:94-96`
- READ-017: behoben — `display-resize.test.js:440` »frame 1 nonetheless emits OnDisplayResize exactly once, with that size.«
- klein: `fixtures.js`, `disposeDisplay` — Kommentar `// ignore — the fixture still has to leave the dom` passt nicht, die Funktion nimmt nichts aus dem DOM (das tut der `afterEach` des Aufrufers); besser »the caller's teardown still has to remove the host«
- Nebenbefunde-Urteile: die drei in `display-*.test.js` fallen unter die Scope-Regel (Tests von `src/display/`), die übrigen vier liegen in Stage-, PanControl2D- und Map2D-Tests außerhalb der Domäne → Audit

## Findings im Volltext

**TEST-024 · low · packages/twopoint5d-testing/test/display-resize.test.js:25-34**, »Die kopierten Test-Helfer extrahieren und sich auf ein disposeDisplay einigen«

`makeContainer` existiert in 11 Dateien, `disposeDisplay` in 9,
`pointer`/`key`/`makeState` in 3, `bufferOf`/`readBack`/`quadDescription`/`instancedDescription`
in 3–4. Schlimmer als das Volumen: Drei Dateien (`display-resize`,
`stage-pipeline`, `stage-renderer`) *starten* ein Display im Teardown, bevor sie
es disposen. Das kostet einen WebGPU-Init pro Test nur zum Abbauen. Dagegen
dokumentiert `display-dispose`, dass der Teardown `start()` nicht rufen darf.
Das sind zwei widersprüchliche Teardown-Verträge in derselben Suite.

Empfehlung: `test/helpers/fixtures.js` mit `makeContainer`, `disposeDisplay`
(nur dispose, try/catch), `pointer`, `key`, `makeState`, `bufferOf`,
`readBack` und den zwei Descriptors. Das `await display.start()` im Teardown
löschen.

**READ-017 · info · packages/twopoint5d-testing/test/display-resize.test.js:470**, »»still« im Kommentar von display-resize liest sich wie ein Rückblick«

Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers.
»frame 1 still emits OnDisplayResize exactly once« meint »trotzdem«, liest
sich aber knapp als Hinweis auf einen früheren Zustand.

Empfehlung: Umformulieren, etwa »frame 1 emits OnDisplayResize exactly once
all the same«.
