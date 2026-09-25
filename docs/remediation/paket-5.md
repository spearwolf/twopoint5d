# Paket 5 — TileSprites-Material und -Geometrie, map2d-Browsertests und Lookbook

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-032 (low), TYPE-024 (low), DOC-068 (info), READ-022 (info), DOC-026 (low), DOC-008 (info)
- Ziel: TileSprites-Material und -Geometrie folgen dem Muster der übrigen Sprite-Klassen, die map2d-Browsertests teilen ihre Kamera-Fixture, und die map2d-Demos der Lookbook liegen geordnet und mit geprüften Metadaten.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - Library: `packages/twopoint5d/src/map2d/TileSprites/TileSpritesMaterial.ts`, `TileSpritesMaterial.spec.ts`, `TileSpritesGeometry.ts`, `TileSpritesGeometry.spec.ts` (neu), `TileSprites.ts`, `packages/twopoint5d/CHANGELOG.md`
  - Browsertests: `packages/twopoint5d-testing/test/helpers/fixtures.js`, `map2d-placement.test.js`, `map2d-tile-upload.test.js`, `map2d-visibility-helpers.test.js`
  - Lookbook: `apps/lookbook/src/demos/map2d-cam-visi.ts`, `map2d-rect-visi.ts`, `map2d-tile-sprites.ts` (alle drei nach `apps/lookbook/src/demos/map2d/`), `apps/lookbook/src/components/DemoNavBar.astro`, `apps/lookbook/src/layouts/VanillaDemo.astro`, alle 17 `apps/lookbook/src/pages/demos/*.astro` und alle 17 `apps/lookbook/src/pages/demos/_*.json`, `apps/lookbook/src/data/tag-categories.json`, `apps/lookbook/README.md`
  - Prüfung und Doku: `scripts/lookbook/demoMetadata.test.mjs` (neu), `AGENTS.md`, `docs/architecture.md`
- Verify: `pnpm run ci`
- Commit: `fix(map2d,lookbook): stop the effects of TileSpritesMaterial before dispose() clears the color map they read, declare the pools of TileSpritesGeometry read-only and say once in the docs of TileSprites when a tile finds no capacity, build the camera of the map2d browser tests with one fixture, move the map2d demos of the lookbook into a folder of their own, link every demo page to its own source by its route, and correct the tags and descriptions of the demos, with a check that every capitalised tag names an export of the library`
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · PERF-032 unverändert (`TileSpritesMaterial.ts:105-112` `dispose()`, Farb-Effekt `:83-92`) · TYPE-024 unverändert (`TileSpritesGeometry.ts:7-10`, Interface-Merge ohne `readonly`) · DOC-068 unverändert (`TileSprites.ts:9-15`) · READ-022 unverändert, verschoben (`map2d-tile-upload.test.js:23-25`, `map2d-visibility-helpers.test.js:48-50`, `makeCamera` in `map2d-placement.test.js:6-12`) · DOC-026 unverändert, dazu in `tag-categories.json` der Tag `Stage` ohne Library-Export und `RenderPipeline` (three.js) in zwei Stage-Demos; die README-Zahlen sind weiter gedriftet (heute 32 `.astro`, 21 `.ts` unter `src/`) · DOC-008 unverändert (drei `map2d-*.ts` flach in `src/demos/`) · offene Folgen: keine (Pakete 1–4 je `Folgen: keine`) · »Offene Befunde«: beide Einträge (`CameraBasedVisibility.ts` Frustum, `ChunkQuadTreeNode.ts` Endlosrekursion) haben eine andere Ursache und bleiben für die Drain-Runde liegen · Restplan: Paket 5 ist das letzte offene Paket, nichts umzusortieren
  - 2026-09-25 Zug 1: Implementierer beauftragt, Sonnet (mittlere Stufe), Effort medium · Brief `paket-5.impl-1.brief.md`, Report `paket-5.impl-1.json`
  - 2026-09-25 Zug 2: Report FERTIG (Session 36855b86-9b81-422b-8dd9-ccdc1f882ddd) · roter Lauf belegt für Schritte 1, 3, 11 · Dateien: TileSprites-Material/-Geometrie/-Spec (neu)/TileSprites.ts, CHANGELOG, fixtures.js + drei map2d-Browsertests, drei Demos nach `demos/map2d/`, DemoNavBar, VanillaDemo, 17 Seiten, 17 JSON, tag-categories, Lookbook-README, `scripts/lookbook/demoMetadata.test.mjs` (neu), AGENTS.md, docs/architecture.md · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-5.verify.log`)
  - 2026-09-25 Zug 3: Reviewer beauftragt, Sonnet, Effort medium · Diff `paket-5.diff`, Brief `paket-5.review-1.brief.md`, Report `paket-5.review-1.json`
  - 2026-09-25 Zug 3: Urteil freigeben · alle sechs Findings behoben · keine kritischen, keine wichtigen Befunde, zwei kleine · Diff `paket-5.diff`
  - 2026-09-25 Zug 4: entfällt, keine Runde ausgelöst
  - 2026-09-25 Zug 5: Commit a45cac19 (54 Dateien, drei Demos als Umbenennung erkannt) · Verify `paket-5.verify.log` exit=0, keine Codeänderung seither

## Entscheidungen dieses Zugs 0

- **Kein Browsertest für PERF-032 und TYPE-024.** Die Konvention verlangt beide Testflächen für Rendering- und GPU-Buffer-Code. `dispose()` des Materials legt keinen GPU-Zustand an, und die Änderung spart nur einen Node-Bau auf einem Material, das nie wieder rendert. Ein Browser sieht davon nichts. TYPE-024 ist reine Typebene. Die map2d-Browsertests, die `TileSpritesMaterial` und `TileSpritesGeometry` über `makeMap()` bauen, bleiben grün, und das genügt als Browserfläche.
- **Kein CHANGELOG-Eintrag für PERF-032.** Die API ändert sich nicht. Das Gegenstück in `TexturedSpritesMaterial` hat auch keinen; die Zusage steht in der TSDoc von `dispose()`. Für TYPE-024 gibt es eine Zeile unter `Changed`, wie für `TexturedSpritesGeometry`. Einen Migrationsabschnitt bekommt TYPE-024 nicht, weil das Gegenstück auch keinen hat.
- **DOC-026 als ganzes Finding.** Das Finding liegt im freigegebenen Scope. Es umfasst auch Stellen außerhalb von map2d: den Tippfehler in `_crosses.json`, die README-Zahlen und die Quelllinks aller 17 Demos. Alles davon gehört ins Paket; ein halb behobenes Finding ließe sich im Abschluss nicht schließen.
- **Der Quelllink wird in `DemoNavBar.astro` aus der Route abgeleitet, nicht in `loadMetadataForDemos.ts`.** Das weicht von der Empfehlung des Audits ab, weil die Empfehlung am Code vorbeigeht: Jede Demoseite importiert ihre eigene JSON direkt (`import {description, showSource, title} from './_<name>.json'`), und `loadMetadataForDemos.ts` bedient allein die Übersicht `pages/index.astro`. Den Link sieht nur der Dialog in `DemoNavBar.astro`, und dort ist die Route bekannt.
- **Alle 17 Quelllinks zeigen auf die Seite `src/pages/demos/<id>.astro`.** Das gilt auch für die drei map2d-Demos, deren Link bisher auf die `.ts` zeigte. 14 von 17 Demos verlinken schon so, und die README beschreibt es so (»The wiring lives in the page's `<script>` block«). Die map2d-Seite importiert das verschobene Modul mit einer Zeile `import {run} from '~demos/map2d/…'`. Ein handgeschriebener Link auf `src/demos/map2d-*.ts` wäre nach DOC-008 genau der tote Link, den DOC-026 beschreibt.
- **Die Tag-Prüfung liest die Exporte aus den Quellen**, über die TypeScript-Compiler-API gegen `packages/twopoint5d/src/index.ts`. Sie liest also nicht `import * as lib`, wie das Audit vorschlägt. Zwei Gründe: `import * as lib` sieht keine Typ-Exporte, und `VO` und `Map2DTileCoords` sind Tags auf Typen. Außerdem braucht der Weg über die Quellen keinen Build, `pnpm test:scripts` läuft also auch allein. Gemessen: 283 Exporte in ≈ 0,6 s. `scripts/checkNameableTypes.mjs` macht es genauso, nur gegen `dist`.
- **`RenderPipeline` bleibt als Tag, mit Begründung in einer Ausnahmeliste der Prüfung.** Die Klasse kommt aus three.js und ist echt. Die Demos `stage-postprocessing` und `stage-nested-pipelines` bauen genau sie. `Stage` fällt aus `tag-categories.json`: kein Export der Library, keine Demo trägt den Tag, und `Stage2D` steht schon in derselben Kategorie.
- **Die Dateinamen der verschobenen Demos bleiben** (`demos/map2d/map2d-cam-visi.ts` usw.). Jeder Name passt 1:1 zu seiner Seite `pages/demos/<name>.astro`; eine Suche nach dem Seitennamen findet beide.
- **`mv`, nicht `git mv`.** Ein `git mv` stagt die Umbenennung. Der Reviewer-Diff in Zug 3 (`git diff` gegen den Index) zeigte die verschobenen Dateien dann nicht. Git erkennt die Umbenennung beim Commit aus dem Inhalt.
- **Die Frame-Helfer der drei Browsertests bleiben, wie sie sind.** `renderTwice()` in `map2d-placement`, die Doppel-Frames in `map2d-tile-upload` und `frame()` in `map2d-visibility-helpers` unterscheiden sich (`frame()` ruft zusätzlich `helpers.update()`). READ-022 betrifft nur die Kamera.
- **Die Dateizahlen fallen aus der README.** Sie sind seit dem Audit weiter gedriftet (README 36/22, Audit 35/21, heute 32/21) und driften mit jeder neuen Komponente wieder. Die »17« für Demos, Seiten und JSON-Dateien stimmen und bleiben.

## Vorgehen

Reihenfolge: bei jedem Korrektheitsschritt zuerst der Test, dann der rote Lauf, dann der Fix. Die roten Läufe gehören mit Kommando und Ausgabe in den Report.

### A. Library — `packages/twopoint5d/src/map2d/TileSprites/`

1. **PERF-032, Regressionstest zuerst.** In `TileSpritesMaterial.spec.ts` kommt im `describe('dispose()')` hinter den Test `(e) does not leak signals or effects` (Zeile 77-91) und vor den Kommentar `(f)` dieser Test. Er folgt dem Muster aus `TexturedSpritesMaterial.spec.ts:262-275`:

   ```ts
   // the teardown builds no node: the effects are gone before dispose() clears what they read
   test('builds no node on the way out', () => {
     const colorMap = new Texture();
     const material = new TileSpritesMaterial({colorMap});
     const {version, colorNode, positionNode} = material;

     material.dispose();

     expect(material.version).toBe(version);
     expect(material.colorNode).toBe(colorNode);
     expect(material.positionNode).toBe(positionNode);

     colorMap.dispose();
   });
   ```

   Der Test braucht eine `colorMap`. Ohne sie ändert `dispose()` den Signalwert nicht (`undefined` → `undefined`), der Farb-Effekt läuft nicht, und der Test wäre schon vor dem Fix grün. Roter Lauf: `pnpm nx test twopoint5d -- src/map2d/TileSprites/TileSpritesMaterial.spec.ts`. Erwartet ist, dass `colorNode` zu `TileSpritesMaterial.DefaultColor` wird und `version` wächst.

2. **PERF-032, Fix** in `TileSpritesMaterial.ts`, wie in `sprites/TexturedSprites/TexturedSpritesMaterial.ts:61-63, 151, 173, 198-211`:
   - Import: `import {createEffect, createSignal, type Effect, SignalGroup} from '@spearwolf/signalize';`
   - Unter `#colorMap` (Zeile 25) zwei Felder, je mit Leerzeile davor wie im Vorbild:
     ```ts
     readonly #positionEffect: Effect;

     readonly #colorEffect: Effect;
     ```
   - Im Konstruktor `this.#positionEffect = createEffect(…)` für den ersten Effekt (Zeile 66) und `this.#colorEffect = createEffect(…)` für den zweiten (Zeile 83). Die Rümpfe bleiben unverändert, die Reihenfolge im Konstruktor auch: erst die Effekte, dann `alphaTestNode`, dann `this.colorMap = options?.colorMap`.
   - `dispose()` beginnt mit:
     ```ts
     // the effects go first: a write to a signal runs every effect that reads it on the spot, and
     // clearing the reference below would build a node for a material on its way out
     this.#positionEffect.destroy();
     this.#colorEffect.destroy();
     ```
     Danach unverändert der bestehende Kommentar, `this.#colorMap.set(undefined);`, `SignalGroup.delete(this);` und `super.dispose();`. Ein zweites `dispose()` ruft `destroy()` erneut; `TexturedSpritesMaterial` tut das auch, und der Test `(d) is safe to call twice` deckt es ab.
   - Die TSDoc von `dispose()` wird zu:
     ```ts
     /**
      * Tears down the signals and effects of this material and gives up its optional member:
      * {@link colorMap} answers `undefined` afterwards. The `colorMap` texture itself is handed in
      * and belongs to the caller, so it is not released here. The node accessors keep their last
      * node, and so do `colorNode` and `positionNode`: `dispose()` builds no new one. A second call
      * does nothing.
      */
     ```

3. **TYPE-024, Typtest zuerst.** Die Datei `TileSpritesGeometry.spec.ts` ist neu:

   ```ts
   import {describe, expect, test} from 'vitest';

   import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
   import type {TileBaseSprite, TileSprite} from './descriptors.js';
   import {TileSpritesGeometry} from './TileSpritesGeometry.js';

   describe('TileSpritesGeometry', () => {
     // basePool is read without `!` or `?.` on purpose: the line compiles only while the field is
     // typed without `undefined`, which the geometry promises by building the pool itself
     test('builds an instanced pool of the capacity it is given and a base pool holding its one base sprite', () => {
       const geometry = new TileSpritesGeometry(4);

       expect(geometry.instancedPool.capacity).toBe(4);
       expect(geometry.basePool.usedCount).toBe(1);

       geometry.dispose();
     });

     test('declares its pools read-only (a type-level check)', () => {
       const geometry = new TileSpritesGeometry(4);

       // the @ts-expect-error lines carry the claim: `pnpm typecheck` fails as soon as a field takes a
       // write; Vitest checks nothing here. The function is never called.
       const assignPools = (basePool: VertexObjectPool<TileBaseSprite>, instancedPool: VertexObjectPool<TileSprite>) => {
         // @ts-expect-error the pools are built by the constructor and are read-only
         geometry.basePool = basePool;
         // @ts-expect-error the pools are built by the constructor and are read-only
         geometry.instancedPool = instancedPool;
       };
       void assignPools;

       geometry.dispose();
     });
   });
   ```

   Roter Lauf: `pnpm nx run twopoint5d:typecheck` vor dem Fix (die Library-Typprüfung schließt die Specs ein). Erwartet ist zweimal TS2578 »Unused '@ts-expect-error' directive«. Vitest selbst bleibt dabei grün.

4. **TYPE-024, Fix** in `TileSpritesGeometry.ts`. Das `export interface TileSpritesGeometry { … }` (Zeile 7-10) fällt weg. In den Klassenrumpf kommen, vor den Konstruktor und wie in `sprites/TexturedSprites/TexturedSpritesGeometry.ts:35-37`:
   ```ts
   // the constructor hands super() a base descriptor, never a BufferGeometry, so the base pool is always there
   declare readonly basePool: VertexObjectPool<TileBaseSprite>;
   declare readonly instancedPool: VertexObjectPool<TileSprite>;
   ```
   Die Importe bleiben, wie sie sind. `TileSpritesFactory.ts` und alle anderen Stellen lesen die Pools nur; die Suche nach Schreibzugriffen (`\.basePool\s*=[^=]`, `\.instancedPool\s*=[^=]`) findet außerhalb der Specs nur `InstancedVOBufferGeometry.ts:151`, eine andere Klasse.

5. **TYPE-024, CHANGELOG.** In `packages/twopoint5d/CHANGELOG.md` unter `## [Unreleased]` → `### Changed` kommt direkt unter die Zeile, die mit ``- `AnimatedSpritesGeometry#basePool` is typed`` beginnt, diese Zeile:
   ```markdown
   - `TileSpritesGeometry#basePool` and `#instancedPool` are read-only, as `InstancedVertexObjectGeometry` declares them; `basePool` stays typed `VertexObjectPool<TileBaseSprite>`, without `undefined`, since the geometry builds its base pool in the constructor
   ```
   Kein Migrationsabschnitt (Grund oben). Skill `updating-changelog` beachten; nur `Unreleased` anfassen.

6. **DOC-068** in `TileSprites.ts`: Der Klassenkommentar (Zeile 6-16) wird vollständig ersetzt durch:
   ```ts
   /**
    * The mesh that draws the tiles of a map, one instance of its `TileSpritesGeometry` per tile.
    *
    * `GeoType` is the geometry the mesh holds. Built without one, the mesh holds the plain
    * `BufferGeometry` that `THREE.Mesh` puts in its place, and `GeoType` is then `BufferGeometry`. A
    * type argument named explicitly while the geometry is left out states a geometry the mesh does
    * not hold. The constructor takes any `BufferGeometry`, but only a `TileSpritesGeometry` has room
    * for tiles: while the mesh holds none — built without a geometry or with another one —
    * `TileSpritesFactory#createTile()` answers `noTileCapacity` for every tile.
    */
   ```
   Code und die Feldkommentare darunter bleiben.

### B. Browsertests — `packages/twopoint5d-testing/test/`

7. **READ-022, Fixture.** In `helpers/fixtures.js` kommt `makeCamera` im Abschnitt `// --- map2d ---` vor `makeMap` (Zeile 151-153). Funktion und JSDoc wandern wörtlich aus `map2d-placement.test.js:6-12`, dazu `export`:
   ```js
   /** The tilted camera the map is watched through, looking at `x` on the ground plane from behind and above. */
   export function makeCamera(x = 0) {
     const camera = new PerspectiveCamera(75, 1.6, 0.1, 4000);
     camera.position.set(x, 350, 500);
     camera.lookAt(x, 0, 0);
     return camera;
   }
   ```
   Import in Zeile 13: `import {DataTexture, PerspectiveCamera} from 'three/webgpu';`

8. `map2d-placement.test.js`: Die lokale `makeCamera` (Zeile 6-12) fällt weg. Der Fixture-Import wird zu `import {makeContainer, disposeDisplay, makeCamera, makeMap} from './helpers/fixtures.js';`, und aus `three/webgpu` bleibt `import {Scene, Vector3} from 'three/webgpu';`.

9. `map2d-tile-upload.test.js`: Die Zeilen 23-25 werden zu `camera = makeCamera();`. Der Kommentar in Zeile 22 (»the camera belongs to the test and not to the display, so a resize does not move it«) bleibt darüber stehen. Der Fixture-Import bekommt `makeCamera`, und aus `three/webgpu` bleibt `import {Scene} from 'three/webgpu';`.

10. `map2d-visibility-helpers.test.js`: Die Zeilen 48-50 werden genauso zu `camera = makeCamera();`, und der Kommentar in Zeile 47 bleibt. Der Fixture-Import bekommt `makeCamera`, aus `three/webgpu` bleibt `import {Scene} from 'three/webgpu';`.

    Kein Regressionstest: Das ist ein Refactoring. `pnpm test:browser` muss mit derselben Zahl an Tests grün bleiben. Die Frame-Helfer bleiben unangetastet (Grund oben).

### C. Lookbook — `apps/lookbook/`

11. **DOC-026, Prüfung zuerst.** Neu ist `scripts/lookbook/demoMetadata.test.mjs` (`node:test`, `node:assert/strict`, Aufbau wie `scripts/lookbook/rainbowLineScript.test.mjs`). Kopfkommentar: wofür die Prüfung da ist, nämlich dass jeder Tag, der mit einem Großbuchstaben beginnt, eine Klasse, Funktion oder einen Typ der Library bewirbt, nach dem ein Leser suchen wird, und dass keine andere Prüfung die JSON-Dateien der Lookbook liest.
    - Pfade über `new URL('../../…', import.meta.url)` wie im Vorbild: `apps/lookbook/src/pages/demos/`, `apps/lookbook/src/data/tag-categories.json` und `packages/twopoint5d/src/index.ts`.
    - Die Exporte der Library kommen aus den Quellen, mit den Compiler-Optionen aus `scripts/checkNameableTypes.mjs:27-33`:
      ```js
      const program = ts.createProgram([entry], {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        skipLibCheck: true,
        strict: true,
      });
      const checker = program.getTypeChecker();
      const exported = new Set(
        checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(entry))).map((sym) => sym.getName()),
      );
      ```
      Dazu ein Kommentar: Gelesen werden die Quellen und nicht `dist`, damit die Prüfung ohne Build läuft, und Typ-Exporte wie `VO` zählen mit.
    - Ausnahmen mit Grund, als `Map` wie `ACCEPTED` in `checkNameableTypes.mjs`:
      ```js
      const FROM_THREE = new Map([
        ['RenderPipeline', 'the three.js class the post-processing demos build their pipeline from; the library extends it as RootRenderPipeline'],
      ]);
      ```
    - Ein Tag gilt als großgeschrieben bei `/^[A-Z]/`. Er ist in Ordnung, wenn `exported.has(tag) || FROM_THREE.has(tag)`.
    - Drei `it` in einem `describe('the metadata of the lookbook demos', …)`. Jeder sammelt seine Verstöße als Strings (`'_map2d-cam-visi.json: Map2DTileSpritesRenderer'`) und prüft mit `assert.deepEqual(offenders, [], <Satz, was die Regel ist>)`:
      1. `'pairs every demo page with a JSON file whose url is the route of the page'`: Zu jeder `<name>.astro` in `pages/demos/` gibt es `_<name>.json` und umgekehrt, und `json.url === '/demos/<name>'`.
      2. `'names an export of the library, or a three.js class listed here, with every tag that starts with a capital letter'`: prüft alle `tags` aller `_*.json`.
      3. `'lists every tag of tag-categories.json once, and names an export with every capitalised one'`: prüft die `includeTags` aller `categories` auf Doppelte über die ganze Datei hinweg und die großgeschriebenen wie in 2.
    - Roter Lauf, **vor** Schritt 12: `node --test scripts/lookbook/demoMetadata.test.mjs`. Erwartet (per Probe in Zug 0 bestätigt): 1 grün. 2 rot mit `_map2d-cam-visi.json: Map2DTileSpritesRenderer` und `_map2d-rect-visi.json: Map2DTileSpritesRenderer`. 3 rot mit `Map2DTileSpritesRenderer` und `Stage` sowie den doppelten `TileSpritesGeometry` und `TileSpritesMaterial`. `RenderPipeline` fällt nur ohne den `FROM_THREE`-Eintrag auf.

12. **DOC-026, die Strings:**
    - `src/pages/demos/_map2d-cam-visi.json`: Tag `Map2DTileSpritesRenderer` → `Map2DTileRenderer`; in `description` `RepeatingTilesProvoder` → `RepeatingTilesProvider`.
    - `src/pages/demos/_map2d-rect-visi.json`: dieselben zwei Korrekturen.
    - `src/pages/demos/_crosses.json`: in `description` `VertexObjcts` → `VertexObjects`.
    - `src/data/tag-categories.json`: In `Map2D.includeTags` fallen `Map2DTileSpritesRenderer`, das zweite `TileSpritesGeometry` und das zweite `TileSpritesMaterial` weg. In `Display, Stage and Projections.includeTags` fällt `Stage` weg. Name und `tagId` der Kategorie bleiben.
    - Danach muss `node --test scripts/lookbook/demoMetadata.test.mjs` grün sein.

13. **DOC-008, verschieben.** Zuerst `mkdir apps/lookbook/src/demos/map2d`, dann ein einfaches `mv` (kein `git mv`, Grund oben) von `src/demos/map2d-cam-visi.ts`, `map2d-rect-visi.ts` und `map2d-tile-sprites.ts` nach `src/demos/map2d/`. Die Namen bleiben.
    - Relative Importe in den verschobenen Dateien: `./utils/…` → `../utils/…`. Betroffen sind `map2d-cam-visi.ts:15-16`, `map2d-rect-visi.ts:18-20` und `map2d-tile-sprites.ts:14-15`.
    - Seiten: `~demos/map2d-cam-visi` → `~demos/map2d/map2d-cam-visi` (`map2d-cam-visi.astro:44`), `~demos/map2d-rect-visi` → `~demos/map2d/map2d-rect-visi` (`map2d-rect-visi.astro:26`), `~demos/map2d-tile-sprites` → `~demos/map2d/map2d-tile-sprites` (`map2d-tile-sprites.astro:21`).
    - Gegenprobe: `grep -rn "demos/map2d-" apps/lookbook/src` findet danach nichts mehr außer den `~demos/map2d/map2d-…`-Importen.

14. **DOC-026, Quelllink aus der Route:**
    - `src/components/DemoNavBar.astro`: `showSource` verschwindet aus `Props` (Zeile 10) und aus der Destrukturierung (Zeile 14). Zeile 16 wird ersetzt durch:
      ```ts
      // every demo page lives at pages/demos/<id>.astro and is served at <base>/demos/<id>/, so the
      // last segment of its path names the file its source link points at
      const id = Astro.url.pathname.split('/').filter(Boolean).at(-1);
      const githubUrl = `https://github.com/spearwolf/twopoint5d/blob/main/apps/lookbook/src/pages/demos/${id}.astro`;
      ```
    - `src/layouts/VanillaDemo.astro`: `showSource` verschwindet aus `Props`, aus der Destrukturierung und aus `<DemoNavBar … />`.
    - Alle 17 `src/pages/demos/*.astro`: `import {description, showSource, title} from './_<name>.json';` → `import {description, title} from './_<name>.json';` und `<Layout title={title} showSource={showSource} description={description}>` → `<Layout title={title} description={description}>`.
    - Alle 17 `src/pages/demos/_*.json`: Der Block `"showSource": { "github": … }` fällt samt vorangehendem Komma weg.
    - `loadMetadataForDemos.ts` bleibt unverändert, weil er `showSource` nie gelesen hat (Grund oben).
    - Belegen, nachdem `pnpm run ci` die Lookbook gebaut hat: `grep -o 'href="https://github.com/spearwolf/twopoint5d/blob/main/[^"]*"' apps/lookbook/dist/demos/*/index.html`. Erwartet sind 17 Zeilen, jede `…/apps/lookbook/src/pages/demos/<verzeichnis>.astro` mit dem Namen ihres eigenen Verzeichnisses. Die Ausgabe kommt in den Report.

15. **Doku:**
    - `apps/lookbook/README.md`:
      - Unter »What's in `src/`« wird die Zeile ``- `demos/` — the demo code itself, TypeScript, grouped by demo`` zu ``- `demos/` — the demo code itself, TypeScript, grouped by demo; the three map2d demos share `map2d/` ``.
      - Unter »Adding a demo«, Schritt 3, bleibt alles bis einschließlich des Satzes über `previewImage` (endet mit ``as in `_stage-nested-pipelines.json` and `_stage-postprocessing.json`.``). Ersetzt wird der Rest des Schritts, von `` `showSource` isn't read by the overview at all `` bis `` `_textured-sprites.json` shows the full pattern. ``, durch: ``The dialog of a demo page links to the page's own source on GitHub; `DemoNavBar.astro` builds that link from the route, so the JSON carries none. A tag that starts with a capital letter names an export of `@spearwolf/twopoint5d`. `scripts/lookbook/demoMetadata.test.mjs` (`pnpm test:scripts`) checks the tags, the tags of `data/tag-categories.json` and that `url` is the page's route; a class from three.js needs an entry with its reason there. `_textured-sprites.json` shows the full pattern.``
      - Unter »Checks« wird ``over the 36 `.astro` and 22 `.ts` files`` zu ``over the `.astro` and `.ts` files of the lookbook`` (Grund oben).
    - `AGENTS.md:40-44`: In der Aufzählung von `pnpm test:scripts` kommt hinter ``one that checks the lookbook's vendored `rainbow-line` script,`` der Teil ``one that holds the tags and routes of the lookbook's demo metadata to the library's exports,`` und danach weiter wie bisher mit ``and one that asks Nx …``.
    - `docs/architecture.md`:
      - Zeile 98-103: In die Liste von `test:scripts` kommt vor ``and the check that the lookbook serves the script `RainbowLine` loads at runtime`` der Punkt ``the check that every capitalised tag of the lookbook demos names an export of the library,``.
      - Zeile 279-284: Nach dem Satz über `rainbowLineScript.test.mjs` (endet mit ``… so only a spec keeps it from being cleaned up.``) kommt: ``So does `scripts/lookbook/demoMetadata.test.mjs`, which holds the demo metadata of the lookbook to the library: every tag that starts with a capital letter names an export of `packages/twopoint5d/src/index.ts`, read through the TypeScript compiler from the sources, so the spec needs no build.``

16. **Formatierung:** `pnpm exec prettier --write` auf alle geänderten und neuen Dateien, danach `pnpm lint`.

### Zwischenprüfungen für den Implementierer

- `pnpm nx test twopoint5d -- src/map2d/TileSprites`
- `pnpm nx run twopoint5d:typecheck`
- `node --test scripts/lookbook/demoMetadata.test.mjs`
- `pnpm nx typecheck lookbook` (`astro check` findet eine Seite, die noch `showSource` übergibt)
- zum Schluss `pnpm run ci`

## Findings im Volltext

**PERF-032 · low · packages/twopoint5d/src/map2d/TileSprites/TileSpritesMaterial.ts:105-112** (auch `:83`) — TileSpritesMaterial.dispose() baut vor dem Löschen noch einen colorNode
Aufgefallen im Remediation-Lauf vom 2026-09-25. `dispose()` leert `colorMap`, solange der Farb-Effekt (`:83`) noch lebt. Der Effekt läuft deshalb erneut und baut direkt vor `SignalGroup.delete()` einen neuen `colorNode`, auf einem Material, das gerade weggeworfen wird. Die Sprite-Materialien zerstören ihre Effekt-Handles am Anfang von `dispose()`. Für die Korrektheit ist das harmlos, aber es ist vergeudete Arbeit bei jedem Teardown.
Empfehlung: Wie in `TexturedSpritesMaterial`: das Handle aus `createEffect()` behalten, es am Anfang von `dispose()` zerstören, danach die Signale leeren. Dazu ein Spec, der prüft, dass `dispose()` weder `colorNode` noch `version` ändert.
Heute: unverändert, `dispose()` in `:105-112`, Farb-Effekt in `:83-92`.

**TYPE-024 · low · packages/twopoint5d/src/map2d/TileSprites/TileSpritesGeometry.ts:7-10** (auch `vertex-objects/InstancedVertexObjectGeometry.ts:19-20`) — TileSpritesGeometry deklariert basePool und instancedPool ohne readonly
Aufgefallen im Remediation-Lauf vom 2026-09-25. Der Interface-Merge deklariert beide Pool-Felder ohne das `readonly`, das `InstancedVertexObjectGeometry` trägt. Damit sind Schreibzugriffe erlaubt, die die Geometrie nicht mitbekommt. `TexturedSpritesGeometry` und `AnimatedSpritesGeometry` deklarieren ihre Pool-Felder `readonly`.
Empfehlung: Beide Felder `readonly` deklarieren, mit einem Typtest (`@ts-expect-error` auf die Zuweisung) wie in `TexturedSpritesGeometry.spec.ts`.

**DOC-068 · info · packages/twopoint5d/src/map2d/TileSprites/TileSprites.ts:9** — Das TSDoc von TileSprites nennt noTileCapacity zweimal
Aufgefallen im Remediation-Lauf vom 2026-09-23. Der Klassenkommentar in den Zeilen 9 bis 15 erklärt die Antwort `noTileCapacity` zweimal mit fast gleichem Wortlaut.
Empfehlung: Die beiden Sätze zu einem zusammenziehen.

**READ-022 · info · packages/twopoint5d-testing/test/map2d-tile-upload.test.js:24** (auch `map2d-visibility-helpers.test.js:49`, `map2d-placement.test.js`) — Zwei map2d-Tests bauen die Kamera von makeCamera inline nach
Beide Dateien bauen inline dieselbe Kamera wie `makeCamera` in `map2d-placement.test.js`. Aufgefallen im Remediation-Lauf vom 2026-09-24.
Empfehlung: `makeCamera` in `test/helpers/fixtures.js` ziehen und in allen drei Dateien verwenden.
Heute: `map2d-tile-upload.test.js:23-25`, `map2d-visibility-helpers.test.js:48-50`, `makeCamera` in `map2d-placement.test.js:6-12`.

**DOC-026 · low · apps/lookbook/src/pages/demos/_map2d-cam-visi.json:8** — Metadaten-Drift in der Lookbook beheben: ein Tag nennt eine Klasse, die es nicht gibt, doppelte Tag-Einträge, Tippfehler, README-Zahlen
`Map2DTileSpritesRenderer` matcht kein Symbol in `packages/twopoint5d/src` (die Demos nutzen `Map2DTileRenderer`); die Tag-Wolke bewirbt eine Klasse, nach der ein Leser vergeblich greppt. Jedes andere CamelCase-Tag löst auf eine Bibliotheksdeklaration auf. `RepeatingTilesProvoder` ist in beiden map2d-visi-Beschreibungen falsch geschrieben, `VertexObjcts` in crosses; `tag-categories.json` listet `TileSpritesGeometry` und `TileSpritesMaterial` je zweimal. Die tatsächlichen Zahlen sind 35 `.astro` und 21 `.ts` (README: 36/22). Die Paarung ist sonst sauber: 17 Seiten ↔ 17 JSON-Dateien, jede `url` gleich `/demos/<file>`, alle 14 referenzierten Vorschaubilder existieren. `showSource.github` ist in allen 17 Dateien eine handgeschriebene absolute URL, die nichts gegen den Seitenpfad prüft.
Empfehlung: Die vier Strings korrigieren. `showSource.github` in `loadMetadataForDemos.ts` aus der id ableiten und aus der JSON streichen. Ein 10-Zeilen-Vitest (oder ein Build-Check), dass jedes CamelCase-Tag ein Key von `import * as lib from '@spearwolf/twopoint5d'` ist.
Heute: wie beschrieben. Zusätzlich: `RenderPipeline` (three.js) in `_stage-nested-pipelines.json` und `_stage-postprocessing.json`, und `Stage` in `tag-categories.json` ohne Library-Export. Abweichungen von der Empfehlung stehen oben unter »Entscheidungen dieses Zugs 0«.

**DOC-008 · info · apps/lookbook/src/demos/map2d-cam-visi.ts** — map2d-Demos liegen unsortiert im Demo-Wurzelverzeichnis
Drei `map2d-*`-Dateien liegen flach in `src/demos/`, während jedes andere Thema einen eigenen Ordner hat. Re-Check: unverändert.
Empfehlung: In ein `map2d/`-Unterverzeichnis verschieben. Kosmetik, aber billig.

## Urteil des Reviewers (Zug 3, `paket-5.review-1.json`)

- PERF-032 behoben — `TileSpritesMaterial.ts:24-29` (Effekt-Handles), `:70`, `:85`, `dispose()` zerstört beide vor `#colorMap.set(undefined)` `:110-114`; Test `TileSpritesMaterial.spec.ts:94-107`
- TYPE-024 behoben — `TileSpritesGeometry.ts:16-17` `declare readonly`; Typtest `TileSpritesGeometry.spec.ts:10-33`; CHANGELOG `Unreleased/Changed` hinter der `AnimatedSpritesGeometry`-Zeile
- DOC-068 behoben — `TileSprites.ts:6-14`, `noTileCapacity` einmal
- READ-022 behoben — `helpers/fixtures.js:152-158` `makeCamera`; genutzt in `map2d-placement.test.js:4`, `map2d-tile-upload.test.js:4,20`, `map2d-visibility-helpers.test.js:9,46`
- DOC-026 behoben — Tags und Beschreibungen in `_map2d-cam-visi.json`, `_map2d-rect-visi.json`, `_crosses.json`; `tag-categories.json` ohne `Map2DTileSpritesRenderer`, Doppelte und `Stage`; Quelllink aus der Route `DemoNavBar.astro:14-17`; `showSource` aus Layout, 17 Seiten, 17 JSON; README ohne Dateizahlen; Prüfung `scripts/lookbook/demoMetadata.test.mjs`
- DOC-008 behoben — `apps/lookbook/src/demos/map2d/` mit `../utils/`-Importen, Seiten importieren `~demos/map2d/…`

Kleine Befunde (lösen keine Runde aus):
- `apps/lookbook/README.md` (»Adding a demo«, Schritt 3), `AGENTS.md:40-44`, `docs/architecture.md` (Liste und Absatz zu `demoMetadata.test.mjs`): die eingefügten Passagen stehen je auf einer sehr langen Zeile, der Text drumherum bricht bei rund 90 Zeichen um; Lint grün, nur Formatpflege.
- `TileSpritesGeometry.spec.ts:10-11`: der Kommentar zum Lesen ohne `!` sagt nicht, dass nur `pnpm typecheck` das prüft und nicht Vitest; der zweite Test sagt es ausdrücklich.
