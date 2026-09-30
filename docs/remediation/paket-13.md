# Paket 13 — Folgen-Nachlese: First-Sprite-Demo, Suche, Stage-Kommentare

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — die zehn kleinen Reviewer-Befunde auf die Diffs der
  Pakete 7, 9, 10 und 12, die keine Runde ausgelöst hatten (Entscheidung »Drain, zweite
  Runde« vom 2026-09-30), dazu aus Zug 0 eine Stelle gleicher Ursache: der `ts check`-Block
  unter »Usage« im Root-`README.md` (aus d05f0422, dem Demo nachgebaut)
- Ziel: Die Einstiegs-Demo räumt beim Abbruch auf und fängt ihr Start-Promise, die Suche
  respektiert IME-Eingabe, und die im Lauf geschriebenen Kommentare, Doku-Absätze und
  CHANGELOG-Sätze sind eindeutig und umbrochen.
- Modell: mittlere Stufe
- Effort: low (jede Codezeile und jeder Absatz steht unten im Wortlaut; zu tun sind
  Übertragen, Proben, Gate)
- Dateien:
  - `apps/lookbook/src/pages/demos/first-sprite.astro` (`:20–36`, `:38–45`, `:70`)
  - `README.md` (Root; nur der `ts check`-Block `:106–147`)
  - `apps/lookbook/src/components/SearchLookbook.astro` (`:186–192`)
  - `packages/twopoint5d/src/stage/IStageRendererHost.ts` (TSDoc `:7–13`)
  - `packages/twopoint5d/src/stage/StageRenderer.ts` (Kommentar `:126–130`)
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts` (Kommentar `:127–129`)
  - `packages/twopoint5d/src/stage/README.md` (»Custom host« `:608–619`)
  - `packages/twopoint5d/README.md` (`:44–48`, `:50–53`)
  - `packages/twopoint5d/CHANGELOG.md` (Kopfabsatz des `[Unreleased]`-Blocks `:10–12`)
- Vorgehen:
  0. **Rote Proben zuerst.** `pnpm nx preview lookbook` (hängt selbst an `build`) im
     Hintergrund starten, dann die Proben A und B unten gegen
     `http://localhost:4321/lookbook/` laufen lassen und die Ausgabe in den Report; dazu die
     Rauchprobe (Schritt 10) als Baseline. Server beenden. Erst dann ändern.
  1. **`first-sprite.astro`, Kamera.** Die Zeilen `:20–36` werden zu genau diesem Stand
     (Einrückung wie im File, zwei Leerzeichen im `<script>`):

     ```ts
       // the vertical field of view of the camera, in degrees
       const FIELD_OF_VIEW = 60;
       // one world unit per pixel of the frame: from this far away the camera sees about 460
       // units across the shorter side of the window, and the frame of 256 × 296 pixels stands
       // in it with room to spare
       const CAMERA_DISTANCE = 400;

       // the display owns the renderer, drives the frame loop and follows the window's size
       const display = new Display(getFullscreenCanvas());

       const scene = new Scene();
       const camera = new PerspectiveCamera(FIELD_OF_VIEW);

       display.onResize(({width, height}) => {
         camera.aspect = width / height;
         // the field of view is vertical: a window taller than wide moves the camera back, so
         // the sprite fits across as well
         camera.position.z = CAMERA_DISTANCE / Math.min(1, camera.aspect);
         camera.updateProjectionMatrix();
       });
     ```

     Die Zeile `camera.position.z = CAMERA_DISTANCE;` (heute `:31`) fällt weg: `onResize`
     setzt die Position vor dem ersten Frame (das Resize-Event ist retained und geht vor dem
     ersten `OnDisplayRenderFrame` aus, `Display.ts:988`, `:1724–1725`). Rechnung zur
     Kontrolle: sichtbare Höhe bei Abstand d ist `2·d·tan(30°)`, bei d = 400 also 461,9;
     unter `aspect < 1` ist d = 400 / aspect und die sichtbare Breite damit wieder 461,9.
     Das Frame (256 × 296) passt also in jedem Seitenverhältnis; ohne die Zeile wird es
     unter `aspect < 256 / 461,9 ≈ 0,554` seitlich beschnitten. Die Default-`far`-Ebene
     (2000) wird erst bei `aspect = 0,2` erreicht — kein Code dafür.
  2. **`first-sprite.astro`, Abbruch während des Ladens.** Direkt nach der Zeile
     `const [atlas, texture] = await store.getAsync('splotchs', ['atlas', 'texture']);`
     (heute `:42`) und vor dem Kommentar zu `splotchs-256x.json` einfügen, mit je einer
     Leerzeile davor und danach:

     ```ts
         // a dispose() while the catalog and the texture loaded has gone out already, and an
         // onDispose() from here on would never hear it: the store goes, and nothing is built
         if (display.isDisposed) {
           store.dispose();
           return;
         }
     ```

     Der Rest des `onInit`-Listeners bleibt Zeile für Zeile, auch `display.onDispose(…)`
     an seiner Stelle. Nach der Prüfung folgt kein `await` mehr: zwischen ihr und
     `display.onDispose(…)` kann kein `dispose()` mehr fallen.
  3. **`first-sprite.astro`, Start.** `:70` `display.start();` wird
     `await display.start();` — ohne Kommentar, wie die Schwesterseiten
     (`textured-quads.astro:94`, `animated-billboards.astro:49`); das Skript ist ein Modul,
     Top-Level-`await` ist dort schon üblich.
  4. **Root-`README.md`, `ts check`-Block `:106–147`** — dieselbe Ursache, derselbe Fix.
     Der Block wird zu genau diesem Stand (die Zeilen vor und nach dem Block bleiben):

     ```ts
     import {Display, TextureFactory, TexturedSprites} from '@spearwolf/twopoint5d';
     import {PerspectiveCamera, Scene} from 'three/webgpu';

     // the display owns the renderer and drives the frame loop
     const display = new Display(document.getElementById('canvas')!);

     const scene = new Scene();
     const camera = new PerspectiveCamera(60);

     display.onResize(({width, height}) => {
       camera.aspect = width / height;
       // the field of view is vertical: a window taller than wide moves the camera back, so
       // the sprite fits across as well
       camera.position.z = 400 / Math.min(1, camera.aspect);
       camera.updateProjectionMatrix();
     });

     display.onInit(async ({renderer}) => {
       const texture = await new TextureFactory(renderer).loadAsync('sprite.png');

       // a dispose() while the image loaded has gone out already, and an onDispose() from
       // here on would never hear it
       if (display.isDisposed) {
         texture.dispose();
         return;
       }

       // a mesh with room for one sprite, drawn with the texture
       const sprites = new TexturedSprites(1, texture);

       const sprite = sprites.createSprite()!;
       sprite.setSize(256, 256);
       // s, t, u, v: the whole image
       sprite.setTexCoords(0, 0, 1, 1);

       // upload what the sprite wrote into the buffers of the mesh
       sprites.update();
       scene.add(sprites);

       display.onDispose(() => {
         // the mesh releases the material it built around the texture; the texture is yours
         sprites.dispose();
         texture.dispose();
       });
     });

     display.onRenderFrame(({renderer}) => renderer.render(scene, camera));

     await display.start();
     ```

     Der Infostring bleibt `ts check`. `pnpm typecheck` compiliert den Block gegen die
     gebaute Library; Top-Level-`await` trägt die Root-tsconfig (`module: ESNext`,
     `target: ES2022`, `scripts/checkDocSnippets/compileSnippets.mjs:32–45` mit
     `moduleDetection: Force`). Die Prosa um den Block bleibt unverändert.
  5. **`SearchLookbook.astro:186–192`.** Der Keydown-Handler des Suchfelds wird zu:

     ```ts
       input.addEventListener('keydown', (event) => {
         // an Enter that picks a word in an IME composition belongs to the composition, not to
         // the search. 229 is the keyCode of a keydown the IME has taken; a browser that ends
         // the composition before that keydown reports it with isComposing false
         if (event.isComposing || event.keyCode === 229) return;

         const first = results[0];
         if (event.key === 'Enter' && first) {
           event.preventDefault();
           window.location.assign(first.href);
         }
       });
     ```

     Die Prüfung ist das Muster, das MDN unter `Element: keydown event` für IME empfiehlt;
     `keyCode` ist dafür der einzige Träger (Safari meldet den Keydown, der die Komposition
     beendet, mit `isComposing: false`). Im Repo hält keine Lint-Regel `keyCode` an
     (`eslint.config.mjs` ohne `no-deprecated`).
  6. **`IStageRendererHost.ts`, TSDoc `:7–13`.** Hinter den Absatz »Implemented
     structurally — … Used as the (non-nested) parent type of `StageRenderer`.« einen
     weiteren Absatz setzen, getrennt durch ` *`, genau so:

     ```ts
      *
      * `onResize()` and `onRenderFrame()` each hand back the unsubscribe of the subscription
      * they take, and the renderer calls it once: when it leaves the host, or right away when
      * the host throws on the other subscription as the renderer joins it. A host that throws
      * there holds nothing of the renderer, which joins no holder then, and an unsubscribe
      * that throws does not keep the renderer from giving up its other subscription. Neither
      * error is swallowed: both reach the caller of the call that moved the renderer, see
      * `StageRenderer#parent`.
     ```

     `StageRenderer#parent` in Backticks, nicht als `{@link}`: die Datei importiert
     `StageRenderer` nicht, und ein Import nur für den Link schlösse einen Typ-Zyklus
     (`StageRenderer.ts` importiert diese Datei). Belegt am Code: `#addToHost()`
     `StageRenderer.ts:359–381`, `#unsubscribeFromHost()` `:344–357`, Setter `:282–313`.
  7. **`StageRenderer.ts:126–130`**, Kommentar an `#hostSubscriptions`, wird zu:

     ```ts
       // the subscriptions #addToHost() took at the host that drives this renderer. When the
       // host refuses one of them, #addToHost() gives back at once what the host handed out;
       // otherwise #removeFromParent() gives them up before OnRemoveFromParent goes out, and
       // no listener of OnRemoveFromParent does: a listener that disposes this renderer takes
       // every listener with it that the event has not reached yet
     ```

  8. **`StageRenderer.spec.ts:127–129`**, Kommentar über `makeHost()`, wird zu:

     ```ts
       // failures: onResize and onRenderFrame make the host throw that error before it takes a
       // handler; unsubscribeResize and unsubscribeFrame make the unsubscribe of that event
       // count the call and throw, and the host keeps its handler
     ```

  9. **Doku-Absätze**, Wortlaut und Umbruch genau so (greedy bei ≤ 88 Zeichen, in Zeichen
     gezählt — `perl -CSD`, macOS-`awk` zählt Bytes):
     - `packages/twopoint5d/src/stage/README.md:608–613` wird zu:

       ```md
       The renderer books each unsubscribe as soon as the host hands it out and calls it once:
       when it leaves the host — through a write to `parent`, `attach()`, `detach()`, an
       `add()` to a `StageRenderer` or `dispose()` — before `OnRemoveFromParent` goes out, or
       right away when the host throws on the other subscription as the renderer joins it, see
       below. An unsubscribe that throws does not keep the renderer from giving up its other
       subscription; its error reaches the caller of that call together with those of the
       listeners — one unchanged, several as an `AggregateError`.
       ```

     - `packages/twopoint5d/src/stage/README.md:615–619` wird zu:

       ```md
       A host whose `onResize()` or `onRenderFrame()` throws as the renderer joins it holds
       nothing of it: the renderer gives back what the host had handed out and joins no holder
       — `parent` answers `undefined`, and `OnAddToParent` does not go out. The error of the
       host reaches the caller after those of the move out, and an unsubscribe that throws as
       the renderer gives back follows it. `new StageRenderer(host)` throws the same way.
       ```

       (Reihenfolge belegt am Setter `StageRenderer.ts:282–313`: erst `#removeFromParent`,
       dann in `#addToHost()` der Fehler des Hosts, danach die der Rückgabe; der Konstruktor
       `:383–395` geht über denselben Setter.)
     - `packages/twopoint5d/README.md:44–48` wird zu:

       ```md
       Such a geometry almost always needs a material of its own, since the built-in materials
       of three.js know nothing of custom attributes. In this library that is a `NodeMaterial`
       whose shader is written in TSL (`three/tsl`) and reads the attributes through
       `attribute()` nodes, as the sprite materials under [src/sprites/](src/sprites/) do.
       ```

     - `packages/twopoint5d/README.md:50–53` wird zu:

       ```md
       The main motivation behind the _vertex objects_ is to make it easier to create custom
       geometries, especially _instanced_ geometries (multiple objects within one buffer
       geometry) without worrying too much about the buffer attributes of three.js underneath.
       ```

     - `packages/twopoint5d/CHANGELOG.md:10–12` wird zu (nur Prosa im `[Unreleased]`-Kopf,
       kein Eintrag, kein Release-Abschnitt berührt):

       ```md
       The changes in this block are held back on purpose, to go out together in one release:
       many of them break the API, and the Migration Guide at the end of this block walks a
       project through the upgrade.
       ```

  10. **Proben nach den Änderungen** wie in Schritt 0, jetzt grün, dazu die Rauchprobe:
      Wegwerf-Skript im Arbeitsverzeichnis des Laufs
      `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad`
      (nicht im Repo), das `playwright` aus dem Repo-Root auflöst
      (`createRequire('/Users/spw/spaceland/twopoint5d/package.json')('playwright')`,
      Chromium ist installiert), gegen `pnpm nx preview lookbook` unter
      `http://localhost:4321/lookbook/`; den Server danach beenden. `/lookbook/` und jede
      Seite unter `/lookbook/demos/*/` (18) ohne `pageerror` und ohne `console.error` über
      die Baseline aus Schritt 0 hinaus. Ausgabe beider Läufe in den Report.
- Proben (Schritt 0 rot, Schritt 10 grün; Screenshots ins Arbeitsverzeichnis, nicht ins
  Repo):
  - **A — IME.** Auf `/lookbook/`: Ctrl+K, in `dialog.search-lookbook-dialog
    input.search-input` `sprite` tippen (die Liste füllt sich über das `input`-Event), dann
    im Seitenkontext auf dem Feld dispatchen:
    `new KeyboardEvent('keydown', {key: 'Enter', isComposing: true, bubbles: true, cancelable: true})`;
    500 ms warten, `location.pathname` muss `/lookbook/` bleiben. Zweite Variante: dasselbe
    Event ohne `isComposing`, vor dem Dispatch
    `Object.defineProperty(event, 'keyCode', {value: 229})`; ebenfalls kein Wechsel.
    Vorher rot: beide landen auf `/lookbook/demos/first-sprite/`. Kontrolle, vorher wie
    nachher grün: ein schlichtes `Enter` (Playwright `press('Enter')`) landet auf
    `/lookbook/demos/first-sprite/`.
  - **B — Hochkant.** `/lookbook/demos/first-sprite/` mit Viewport 390 × 844 und mit
    1280 × 720, je nach dem Laden etwa 2 s warten, Screenshot. Vorher rot: im Hochkant-Bild
    ist das Sprite links und rechts angeschnitten (sichtbare Breite dort 461,9 · 0,462 ≈ 213
    Einheiten gegen 256). Nachher: das Sprite steht im Hochkant-Bild ganz, im Querformat
    sieht es aus wie vorher (Abstand dort unverändert 400). Den Befund in Worten in den
    Report, die Pfade der vier PNGs dazu.
  - Der Abbruch während des Ladens hat keine Probe: die Demo reicht die `Display`-Instanz
    nirgends hinaus, und ein Eingriff nur für die Probe gehört nicht ins Repo. Beleg ist
    der Vertrag in `Display.ts`: ein `onDispose()` nach `dispose()` wird nie gerufen
    (`:2088–2095`), `isDisposed` antwortet ab dem ersten Satz von `dispose()` `true`
    (`:898–900`, `:1866–1868`); der Reviewer prüft die Zeilenfolge.
- Verify: `pnpm run ci`, dazu die Proben A und B und die Rauchprobe aus Schritt 10
- Commit: `fix: let the first-sprite demo and the usage example of the README await the
  start of the display, build nothing for a display that is disposed while its texture
  loads and move the camera back in a window taller than wide so the whole sprite stays in
  view, let the lookbook search leave an Enter that belongs to an IME composition to the
  composition, say in the host contract of StageRenderer what it does with a host or an
  unsubscribe that throws, and let the stage comments and docs, the library README and the
  head of the unreleased changes say exactly what they mean at their width` (eine Zeile,
  wie im `git log` üblich)
- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · `first-sprite.astro` drei Stellen verschoben
    (`:70`, `:59–63`, `:22–23`) · `SearchLookbook.astro` unverändert (`:186–192`) ·
    `IStageRendererHost.ts` unverändert, jetzt auch ohne Satz zum werfenden Abonnieren aus
    f1b770e7 · `StageRenderer.spec.ts:128` unverändert (93) · Library-`README.md:44–48`,
    `:50–53` unverändert · `#hostSubscriptions` `:126–130` unverändert · Stage-README
    `:608–610` unverändert · CHANGELOG-Kopf nach `:10–12` verschoben · neu aus Zug 0: der
    `ts check`-Block im Root-`README.md:106–147` (Symptom derselben Ursache wie die Demo,
    aus d05f0422) · Offene Befunde: nur `coordsTarget` (→ Audit, Abschluss), nichts
    übernommen · keine offenen Folgen unter den Paketen 1–12 · Restplan: 13 ist das einzige
    offene Paket, nichts umzusortieren
  - 2026-09-30 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-13.impl-0.json`
  - 2026-09-30 Zug 2: Report FERTIG_MIT_VORBEHALT (Nebenbefunde nicht flächendeckend gesucht) · 9 Dateien wie geplant · Proben A/B vorher rot, nachher grün · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-13.verify.log`)
  - 2026-09-30 Zug 3: Reviewer (sonnet, low) gibt frei, alle Befunde behoben, keine Qualitätsbefunde · Diff `paket-13.diff`
  - 2026-09-30 Zug 4: keine Runde
  - 2026-09-30 Zug 5: committet dcd53a3b

## Urteil des Reviewers

Alle behoben: `first-sprite.astro` (`await display.start()`, `isDisposed`-Prüfung `:41–46` ohne `await` bis `display.onDispose`, Kamera in `onResize`) · `SearchLookbook.astro:186–192` · `IStageRendererHost.ts` TSDoc · `StageRenderer.spec.ts:127–129` · `packages/twopoint5d/README.md:44–47`, `:50–52` · `StageRenderer.ts:126–130` · `stage/README.md` beide Absätze · `CHANGELOG.md` Kopf von `[Unreleased]` · Root-`README.md` `ts check`-Block. Kleine Befunde: keine.

## Abgleich

Gegen HEAD f1b770e7.

- **`first-sprite.astro:69` (Start-Promise)** — verschoben nach `:70`, unverändert:
  `display.start();` ohne `await` und ohne `.catch()`. `Display#start()` lehnt ab, wenn der
  Renderer nicht hochkommt, wenn ein Listener von `OnDisplayInit` wirft und nach `dispose()`
  (`Display.ts:1734–1775`); die TSDoc sagt selbst, dass nur ein `await` oder ein `.catch()`
  die Ablehnung sieht (`:1769–1773`).
- **`first-sprite.astro:58–62` (`onDispose` nach zwei `await`)** — verschoben nach
  `:59–63`, unverändert: `display.onDispose(…)` steht hinter
  `await store.loadAsync(…)` (`:41`) und `await store.getAsync(…)` (`:42`). Ein `dispose()`
  in diesem Fenster feuert `OnDisplayDispose` ohne diesen Listener, ein später angehängter
  wird nie gerufen (`Display.ts:2088–2095`, `once()`); Store, Textur und Mesh bleiben.
- **`first-sprite.astro:21–23` (Kommentar rechnet nur die Höhe)** — verschoben nach
  `:22–23`, unverändert: »the camera sees about 460 units from top to bottom, and the frame
  of 296 pixels stands in it«. Bei `aspect < 0,554` ist die sichtbare Breite kleiner als
  256.
- **`SearchLookbook.astro:186–191` (IME)** — jetzt `:186–192`, unverändert: der Handler
  prüft `event.key === 'Enter'` ohne `isComposing`.
- **`IStageRendererHost.ts` (Host-Vertrag)** — unverändert: die TSDoc `:7–13` nennt weder
  die aufgefangene Abmeldung noch — seit f1b770e7 — den Rückbau bei einem Host, der beim
  Abonnieren wirft.
- **`StageRenderer.spec.ts:128`** — unverändert, 93 Zeichen; im File ist es die einzige
  Kommentarzeile über 90 aus diesem Lauf (`git blame` gegen die zwölf Hashes; die übrigen
  langen Kommentarzeilen stammen von vor c82f42f7, das Projekt hat keine Regel für die
  Kommentarbreite in `src/`, `.prettierrc` `printWidth: 130`).
- **`packages/twopoint5d/README.md:44–48`, `:52–53`** — unverändert: Absatz `:44–48` mit
  Zeilen von 77/82/84/58/32, Absatz `:50–53` endet mit »underneath.« (11). Greedy bei 88
  werden es vier bzw. drei Zeilen (Schritt 9).
- **`StageRenderer.ts` `#hostSubscriptions`** — unverändert `:126–130`: »… or by
  #addToHost() itself when the host refuses one of them, rather than by listeners of that
  event« — »that event« steht hinter dem Einschub und greift nicht mehr eindeutig auf
  `OnRemoveFromParent`.
- **`stage/README.md:608–610`** — unverändert: »calls it once when it leaves the host«;
  den Rückbau beim Beitritt nennt erst `:615–619`.
- **`CHANGELOG.md:3–5`** — verschoben nach `:10–12` (der Kopf des `[Unreleased]`-Blocks,
  nicht der Dateikopf), unverändert: »walks a project through all of them in one upgrade«.

## Entscheidungen in Zug 0

- **Abbruch während des Ladens: prüfen statt vorziehen.** Der Reviewer schlug vor,
  `display.onDispose()` vor die `await` zu ziehen und `sprites?.dispose()` zu schreiben.
  Dann bräche `store.dispose()` die laufenden `loadAsync()`/`getAsync()` ab, und die lehnen
  ab (`TextureStore.ts:408–409`, `:422–423`, `:468–471`); die Ablehnung liefe aus dem
  `async`-Listener, den `emit()` nicht abwartet (`Display.ts:2040–2043`), als unbehandelte
  Promise-Ablehnung in die Konsole — bei jedem ordentlichen Abbruch. Außerdem bliebe ein
  Fenster zwischen dem letzten `await` und der Zuweisung an `sprites`. Die Prüfung
  `display.isDisposed` direkt nach dem letzten `await` schließt beides: danach läuft alles
  synchron bis `display.onDispose(…)`. Im README-Block, dessen `TextureFactory.loadAsync()`
  kein Abbruchsignal kennt (`TextureFactory.ts:311–312`), gibt es ohnehin nur diesen Weg.
- **`await display.start()` statt `.catch()`.** Entspricht der Lebenszyklus-Doku von
  `Display` (»2. `await display.start()`«, `Display.ts:445`) und den Schwesterseiten, die
  `await demo.start(…)` schreiben.
- **Hochkant: Verhalten beheben, nicht nur den Kommentar.** Ein Kommentar, der den
  Beschnitt zugibt, ließe die Einstiegs-Demo auf jedem Hochkant-Telefon beschnitten. Eine
  Zeile in `onResize` behebt es; derselbe Beschnitt steckt im README-Block (Sprite 256 bei
  Abstand 400) und wird dort mit derselben Zeile behoben.
- **README-Block ins Paket.** Er stammt aus d05f0422 (`git blame`: alle 43 Zeilen), ist
  laut Paket 8 dem Demo nachgebaut und trägt dieselben drei Mängel. Ein Symptom derselben
  Ursache, und dieses Paket ist das Nachtragspaket für die Folgen dieser Demo — also hier,
  nicht als eigenes Paket.
- **Keine »Folge von«-Kette.** Der Host-Vertrag stammt aus dem Review von Paket 10 (Folge
  von 6), ist aber eine Doku-Ergänzung zu korrektem, getestetem Code; der Weg von Paket 6
  und 10 steht nicht in Frage. Die Aufnahme deckt die Entscheidung »Drain, zweite Runde«.
- **Abgrenzung.** Die übrigen Demos, die `display.start()`/`demo.start()` nicht abwarten
  (`display-minimal.astro:39`, `stage-postprocessing.astro:65`, `crosses.astro:65` u. a.),
  sind kein Symptom: ohne folgenden Code meldet der Browser eine Ablehnung dort genauso wie
  ein Top-Level-`await`, und sie sind nicht die Seite, die Konsumenten abschreiben. Ihre
  `onDispose()`-Listener hängen synchron vor dem Start (`stage-projections.astro:109`,
  `display-multi.astro:115`). Keine Einträge in »Offene Befunde«.

## Findings im Volltext

Kleine Reviewer-Befunde, wörtlich aus den Paketdateien 7, 9, 10 und 12:

**Aus dem Review von b8868b16 (Paket 7):**
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

**Aus dem Review von 6861f3d0 (Paket 10):**
- `IStageRendererHost.ts` — der Host-Vertrag sagt nicht, dass eine werfende Abmeldung
  aufgefangen wird (optional)

**Aus dem Review von f1b770e7 (Paket 12):**
- `StageRenderer.spec.ts:128` — Kommentarzeile an `makeHost()` mit 93 Zeichen, über der
  Kommentarbreite des Laufs; `count` gehört an den Anfang von `:129`
- `packages/twopoint5d/README.md:44–48`, `:52–53` — Umbruch nicht greedy, eine Zeile mit
  11 Zeichen (≤ 88 eingehalten)
- `StageRenderer.ts` Kommentar an `#hostSubscriptions` — durch den geplanten Einschub bezieht
  sich »that event« nicht mehr eindeutig auf `OnRemoveFromParent`
- `stage/README.md:608–610` — der Absatz vor dem neuen sagt, der Renderer rufe jedes
  Unsubscribe »once when it leaves the host«; den Rückbau beim Beitritt nennt erst der
  neue Absatz

**Aus dem Review von f2772ec3 (Paket 9):**
- `CHANGELOG.md:3–5` »walks a project through all of them in one upgrade« überzieht leicht
  (Wortlaut aus dem freigegebenen Detailplan)
