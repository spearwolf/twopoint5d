# Paket 9b — Lookbook: MothChapel.ts teilen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: READ-003 (low)
- Ziel: `MothChapel.ts` ist in Assets samt JSON-Schemas, die Uhr der Séance und die Stages geteilt; `SeanceRoom`, `ChapelWall`, `ChapelVoid` und `GlassTint` legen ihre Meshes über ein gemeinsames Mesh-Bündel an und geben sie darüber frei, Planchette und Motten lesen ihren Atlas-Frame über einen `frameSample()`-Helfer aus `stage-masks/helpers.ts` — bei unverändertem Bild.
- Modell: mittlere Stufe
- Effort: low
- Dateien (alle unter `apps/lookbook/`):
  - neu `src/demos/stage-masks/chapelAssets.ts`
  - neu `src/demos/stage-masks/SeanceClock.ts`
  - `src/demos/stage-masks/MothChapel.spec.ts` → `src/demos/stage-masks/SeanceClock.spec.ts` (`git mv`)
  - `src/demos/stage-masks/MothChapel.ts`
  - `src/demos/stage-masks/helpers.ts`, `src/demos/stage-masks/helpers.spec.ts`
  - `src/demos/stage-masks/RoseWindow.ts` (nur Importe)
  - `src/pages/demos/stage-masks-frozen.astro` (nur Importe)
  - `vitest.config.ts` (`coverage.include`, `thresholds`)
- Vorgehen — Zeilennummern beziehen sich auf `MothChapel.ts` im Stand `4cf5fc5e` (878 Zeilen). Verschobener Code wandert **wörtlich**: Kommentare, Fehlermeldungen, Bezeichner und Reihenfolge bleiben, wie sie sind. Nichts darin wird nebenbei verbessert.
  1. **`chapelAssets.ts` anlegen** — Laden der Assets samt JSON-Schemas. Hinein, in dieser Reihenfolge: Zeile 59 (`const DIR = 'stage-masks/frozen';`) und die Zeilen 82–248 (`PaneInfo` bis einschließlich `loadChapelAssets()`). Der Trennkommentar Z. 78–80 (`// ---…` / `// the assets` / `// ---…`) entfällt: das Modul ist der Abschnitt. Exportiert bleiben genau die heute exportierten Namen: `PaneInfo`, `HeadJson`, `RoomJson`, `ChapelAssets`, `loadChapelAssets`. `RoseWindowJson`, `FaceMap`, die `check…`-Konstanten, `catalog`, `isFiniteNumber` und `readFaceMap` bleiben unexportiert. Der Subject-String `'MothChapel'` in beiden `fetchJson(…)`-Aufrufen und die Meldung `'MothChapel: sprites.json carries no faceMap with a width, a height and a wrap'` bleiben wörtlich — sie nennen die Szene, nicht die Datei. Importe:
     ```ts
     import {type TextureAtlas, TextureStore, type TextureStoreData} from '@spearwolf/twopoint5d';
     import type {Texture, WebGPURenderer} from 'three/webgpu';
     import assetsUrl from '~demos/utils/assetsUrl';
     import {jsonList, jsonNumber, jsonObject, jsonOneOf, jsonRecord, jsonString, jsonTuple} from '~demos/utils/checkJson';
     import {fetchJson} from '~demos/utils/fetchAsset';
     ```
  2. **`SeanceClock.ts` anlegen** — die Uhr der Séance. Hinein: die Zeilen 254–396 (`ROUND` bis einschließlich Klasse `SeanceClock`, mit `SPELL`, `SPELL_START`, `SPELL_STEP`, `SPELL_END`, `TURNS`, `TURN_BACK` und `ease`). Der Trennkommentar Z. 250–252 entfällt. Exportiert wird nur `SeanceClock`, wie heute. Importe:
     ```ts
     import {uniform} from 'three/tsl';
     import type {UniformNode} from 'three/webgpu';
     import {SeededRandom} from '~demos/utils/seededRandom';
     import type {RoomJson} from './chapelAssets.js';
     import {smoothstepCpu} from './helpers.js';
     ```
     `import type` für reine Typ-Importe (Biome `useImportType`), nicht `import {type …}`: unter `verbatimModuleSyntax` bliebe sonst ein `import {} from './chapelAssets.js'` stehen, und die Spec der Uhr lüde den Store-Code samt Library mit.
  3. **Spec der Uhr mitziehen** — `git mv src/demos/stage-masks/MothChapel.spec.ts src/demos/stage-masks/SeanceClock.spec.ts`. Einzige Änderung im Inhalt: Zeile 2 `import {type HeadJson, type RoomJson, SeanceClock} from './MothChapel';` wird zu
     ```ts
     import type {HeadJson, RoomJson} from './chapelAssets.js';
     import {SeanceClock} from './SeanceClock.js';
     ```
  4. **`helpers.ts`: `frameSample()` und `MeshBundle` ergänzen.**
     - Importe erweitern: aus `'three/tsl'` zusätzlich `float`, `texture`, `uv`, `vec2` (zu `dot`, `fract`, `vec3`); aus `'three/webgpu'` zusätzlich `type Material`, `type Mesh`, `type Object3D`, `type Texture` (zu den vorhandenen). `TextureCoords` steht schon im `import type` aus `'@spearwolf/twopoint5d'`.
     - Direkt nach `setPlaneUvToFrame()`:
       ```ts
       /**
        * Reads the frame `coords` of the atlas `map` over a plane, upright: the uv of the plane, 0 … 1,
        * runs over the frame, and the top edge of the plane shows the top of the frame (the atlas is
        * read with `flipY = false`, t counts down from the top of the image).
        */
       export const frameSample = (map: Texture, coords: TextureCoords): Node<'vec4'> =>
         texture(map, vec2(float(coords.s).add(uv().x.mul(coords.u)), float(coords.t).add(float(1).sub(uv().y).mul(coords.v))));
       ```
       Der Ausdruck ist Zeichen für Zeichen der aus `MothChapel.ts:597` und `:801` (`f` → `coords`), damit der Shader derselbe bleibt; nicht über `uprightUv()` umformen. Der Parameter heißt `map`, nicht `texture` — er verdeckte sonst den TSL-Import `texture`.
     - Am Ende der Datei:
       ```ts
       /**
        * The meshes of a scene that each own their geometry and their material: {@link add} names and
        * places a mesh and puts it into the parent, {@link dispose} disposes the geometry and the
        * material of every mesh it added, once. It leaves the meshes in their parent — the stage that
        * holds them goes with them.
        */
       export class MeshBundle {
         readonly #parent: Object3D;
         readonly #meshes: Mesh<BufferGeometry, Material>[] = [];

         constructor(parent: Object3D) {
           this.#parent = parent;
         }

         /** Names `mesh`, puts it at (`x`, `y`, 0) in the render order `order`, and adds it to the parent. */
         add<M extends Mesh<BufferGeometry, Material>>(mesh: M, name: string, x = 0, y = 0, order = 0): M {
           mesh.name = name;
           mesh.position.set(x, y, 0);
           mesh.renderOrder = order;
           this.#meshes.push(mesh);
           this.#parent.add(mesh);
           return mesh;
         }

         dispose(): void {
           for (const mesh of this.#meshes) {
             mesh.geometry.dispose();
             mesh.material.dispose();
           }
           this.#meshes.length = 0;
         }
       }
       ```
       Typen in Zug 0 per `tsc` gegen die `three`-Typen des Lookbooks geprüft: `Mesh<PlaneGeometry, MeshBasicNodeMaterial>` erfüllt die Schranke, `add()` gibt den Mesh in seinem eigenen Typ zurück, `frameSample(…).rgb`/`.a` typen — kein Cast nötig. Die Schranke `Material` (kein Array) ist es, die `material.dispose()` ohne Cast erlaubt; darauf baut Paket 9c.
  5. **`MothChapel.ts` auf die Stages zurückschneiden.**
     - Heraus: Z. 59, 78–248, 250–396 (nach Schritt 1 und 2 verschoben). Es bleiben `VIEW`, `makeChapelStage`, `FloatNode`, `Vec2Node`, `PlaneMesh`, `uprightUv`, der Trennkommentar »the stages« und alles ab Z. 402.
     - Importe danach: aus `'@spearwolf/twopoint5d'` nur noch `OnStageUpdateFrame`, `OrthographicProjection`, `Stage2D`; die TSL-Liste aus `'three/tsl'` bleibt vollständig (jeder Name wird von den Stages weiter gelesen); aus `'three/webgpu'` entfallen `type Texture` und `type WebGPURenderer`; es entfallen `assetsUrl`, die `checkJson`-Namen, `fetchJson`, `SeededRandom` und `smoothstepCpu`; `atlasFrame` bleibt. Neu:
       ```ts
       import type {ChapelAssets, HeadJson} from './chapelAssets.js';
       import {frameSample, MeshBundle} from './helpers.js';
       import type {SeanceClock} from './SeanceClock.js';
       ```
       `SeanceClock` wird in `MothChapel.ts` nur als Typ gelesen (Parameter von `ChapelVoid`, `flameMaterial`, `Head`, `SeanceRoom`, `ChapelWall`, `flightOf`), daher `import type`. Kein Re-Export der verschobenen Namen aus `MothChapel.ts` (wie in Paket 9 bei `helpers.ts`).
     - Das Bündel wird **im Konstruktor** angelegt, als erste Anweisung nach der Stage, nicht als Feld-Initialisierer: das Projekt fährt `useDefineForClassFields: false`, und ein `#`-Feld, dessen Initialisierer `this.stage.scene` liest, kann damit vor der Zuweisung von `stage` laufen. Feld je Klasse: `readonly #meshes: MeshBundle;`.
     - `ChapelVoid`: Feld `#plane` entfällt. Im Konstruktor als erste Anweisung `this.#meshes = new MeshBundle(this.stage.scene);`; Z. 418–420 werden zu `this.#meshes.add(new Mesh(new PlaneGeometry(8000, 8000), material), 'void');`. `dispose()`: `this.#meshes.dispose(); this.stage.dispose();`.
     - `GlassTint`: Feld `#plane` entfällt. Nach `this.stage = makeChapelStage(name);` folgt `this.#meshes = new MeshBundle(this.stage.scene);`; Z. 694–696 werden zu `this.#meshes.add(new Mesh(new PlaneGeometry(8000, 8000), material), name);`. `dispose()` wie bei `ChapelVoid`.
       (Position (0, 0, 0) und `renderOrder` 0 aus den Voreinstellungen von `add()` sind die Werte, die ein neuer Mesh ohnehin trägt.)
     - `Head`: `this.mesh.name = …` und `this.mesh.position.set(…)` (Z. 531–532) entfallen, ebenso `Head#dispose()` (Z. 541–544). Name und Lage setzt das Bündel der `SeanceRoom`.
     - `SeanceRoom`: Feld `#meshes: PlaneMesh[]` wird `readonly #meshes: MeshBundle;`, erste Anweisung im Konstruktor `this.#meshes = new MeshBundle(this.stage.scene);` (vor `this.#clock = clock;`). Jedes `this.#add(` wird `this.#meshes.add(` mit denselben Argumenten. Die Köpfe (Z. 607–613) gehen ebenfalls durch das Bündel, an derselben Stelle der Reihenfolge:
       ```ts
       const head = new Head(spec, assets, clock, light);
       this.#heads.push(head);
       this.#meshes.add(head.mesh, `head ${spec.name}`, spec.x, spec.y, 4);
       ```
       Planchette: Z. 597 wird `const pl = frameSample(assets.sprites, f);` — `f` bleibt, die Größe der Plane liest `f.width`/`f.height`. Die private Methode `#add()` (Z. 651–657) entfällt. `dispose()`: `this.#meshes.dispose(); this.stage.dispose();` — die Schleife über `#heads` entfällt, `#heads` bleibt für `#update()`.
     - `ChapelWall`: wie `SeanceRoom` — Feld `readonly #meshes: MeshBundle;`, erste Anweisung im Konstruktor `this.#meshes = new MeshBundle(this.stage.scene);`, jedes `this.#add(` wird `this.#meshes.add(` mit denselben Argumenten, `#add()` (Z. 829–835) entfällt, `dispose()`: `this.#meshes.dispose(); this.stage.dispose();`. Motten: Z. 801 wird `const m = frameSample(assets.sprites, f);`.
     - **Unverändertes Bild heißt:** jeder Mesh wird in derselben Reihenfolge gebaut und in dieselbe Szene gelegt wie in `4cf5fc5e`, mit demselben Namen, derselben Lage, demselben `renderOrder` und demselben Shader-Ausdruck (three sortiert durchsichtige Objekte nach `renderOrder`, dann z, dann `id`, und die `id` vergibt der Konstruktor). Die `clock.random()`-Aufrufe der Motten bleiben in Zahl und Reihenfolge, wie sie sind.
     - `RoseWindow` bleibt ohne Bündel: seine 253 Meshes teilen ein Material, ein Bündel gäbe es 253-mal frei.
  6. **`RoseWindow.ts` (Z. 3)** — `import {type ChapelAssets, makeChapelStage, type PaneInfo, type SeanceClock} from './MothChapel';` wird zu
     ```ts
     import type {ChapelAssets, PaneInfo} from './chapelAssets.js';
     import {makeChapelStage} from './MothChapel.js';
     import type {SeanceClock} from './SeanceClock.js';
     ```
  7. **`stage-masks-frozen.astro` (Z. 21)** — `import {ChapelVoid, ChapelWall, GlassTint, loadChapelAssets, SeanceClock, SeanceRoom} from '~demos/stage-masks/MothChapel';` wird zu
     ```ts
     import {loadChapelAssets} from '~demos/stage-masks/chapelAssets';
     import {ChapelVoid, ChapelWall, GlassTint, SeanceRoom} from '~demos/stage-masks/MothChapel';
     import {SeanceClock} from '~demos/stage-masks/SeanceClock';
     ```
     Sonst nichts an der Seite.
  8. **`helpers.spec.ts`: `describe('MeshBundle')`** mit drei Fällen; Meshes aus `new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial())`, Elternteil `new Group()` (alles aus `'three/webgpu'`), gezählt über `addEventListener('dispose', …)` an Geometrie und Material:
     - `adds a mesh to its parent under its name, at x and y on the plane, in its render order` — `add(mesh, 'moth', 3, -4, 2)` gibt denselben Mesh zurück; `parent.children` enthält ihn; `name` `'moth'`, `position` (3, −4, 0), `renderOrder` 2.
     - `puts a mesh at the origin in render order 0 when no place is given` — ein Mesh mit vorher gesetzter Position (5, 6, 7) und `renderOrder` 9 steht nach `add(mesh, 'void')` auf (0, 0, 0) und 0.
     - `disposes the geometry and the material of every mesh it added, once` — zwei Meshes, `dispose()` zweimal: jede Geometrie und jedes Material genau 1 Dispose-Event.

     `frameSample()` bekommt keine Spec: es baut nur einen TSL-Knoten, und was er zeigt, liest erst ein Renderer — den hat der Node-Lauf nicht. Es ist kein Bugfix-Paket; ein roter Lauf vor der Änderung ist nicht verlangt.
  9. **`vitest.config.ts`** — `'src/demos/stage-masks/SeanceClock.ts'` in `coverage.include`, zwischen `…/helpers.ts` und `…/TransitionCycler.ts` (die Liste ist ohne Rücksicht auf Groß-/Kleinschreibung sortiert). `chapelAssets.ts` und `MothChapel.ts` kommen nicht hinein (keine Spec; Shader- und Ladecode). Danach `pnpm nx coverage lookbook --skip-nx-cache` laufen lassen, die vier Prozentwerte aus der `text-summary` ablesen und `thresholds` neu setzen: je Wert abgerundet, minus zwei (Regel im Kommentar darüber). Gemessene Werte und neue Schwellen in den Report.
  10. Formatieren nur der geänderten Dateien: `pnpm exec biome check --write <pfade>`. Keine Doku, kein CHANGELOG: das Lookbook ist nicht die Library, keine öffentliche Oberfläche bewegt sich; `AGENTS.md` und `docs/architecture.md` nennen keine Modulnamen dieser Szene (in Zug 0 per `git grep` geprüft). Kein `pnpm lookbook:generate-previews`: das Bild bleibt, wie es ist.
- Verify: `pnpm run ci`
- Commit: `refactor(lookbook): split the moth chapel into the loading of its assets, the clock of the séance and its stages, add and dispose the meshes of its stages through one bundle, and read an atlas frame on a plane through one helper`
- Nach dem Commit (Zug 5), in »Offene Befunde« die Fundstellen nachführen, die der Schnitt verschiebt: den Eintrag `stage-masks-frozen.astro:42, 160` (die Importzeile wird drei Zeilen lang) und den Eintrag `MothChapel.ts:606` (`centre.divideScalar(…)` bleibt in `MothChapel.ts`, auf neuer Zeile). Nicht beheben — eigene Ursachen.
- Schnittstellen für den Plan (Zug 5, Paket 9c baut darauf): `MeshBundle` in `stage-masks/helpers.ts` — `new MeshBundle(parent: Object3D)`, `add<M extends Mesh<BufferGeometry, Material>>(mesh, name, x = 0, y = 0, order = 0): M` setzt Name, Lage (x, y, 0) und `renderOrder` und hängt an, `dispose()` gibt Geometrie und Material jedes Meshes einmal frei und lässt die Meshes im Elternteil · `frameSample(map: Texture, coords: TextureCoords): Node<'vec4'>` in `stage-masks/helpers.ts` · neu `stage-masks/chapelAssets.ts` (`loadChapelAssets`, `ChapelAssets`, `PaneInfo`, `HeadJson`, `RoomJson`) und `stage-masks/SeanceClock.ts` (`SeanceClock`), kein Re-Export aus `MothChapel.ts` · `MothChapel.spec.ts` heißt `SeanceClock.spec.ts` · `Head#dispose()` entfällt.
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · READ-003 verschoben (Paket 9 hat die Datei an Ort und Stelle geändert, 871 → 878 Zeilen): `#add()` in `SeanceRoom` `MothChapel.ts:651` (Audit `:638`) und `ChapelWall` `:829` (`:815`), Dispose-Schleifen `:667` (`:653`) und `:871` (`:857`), Frame-Sampler Planchette `:597` (`:584`) und Motten `:801` (`:787`), `ChapelVoid`/`GlassTint` `:403`/`:681` — Substanz unverändert, `#add(mesh: Mesh, …)` heißt jetzt `#add(mesh: PlaneMesh, …)` · Folgen: keine offen (alle erledigten Pakete `Folgen: keine`) · Offene Befunde: keiner gleicher Ursache, keiner übernommen · Restplan geprüft: keine Änderung an Reihenfolge oder Schnitt · Typprobe `MeshBundle`/`frameSample` per `tsc` grün
  - 2026-11-18 Zug 1: Implementierer beauftragt, Modell sonnet (mittlere Stufe), Effort low, Report `paket-9b.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG (Volltext per Resume in `paket-9b.impl-0-versuch-2.json`) · 9 Dateien (2 neu, 1 `git mv`) · Arbeitsbaum schmutzig · Coverage-Schwellen 75/66/74/76 · Verify `pnpm run ci` exit=0 (`paket-9b.verify.log`)
  - 2026-11-18 Zug 3: Reviewer sonnet/low, READ-003 behoben, keine kritischen oder wichtigen Befunde, ein kleiner · Diff `paket-9b.diff`, Report `paket-9b.review-0.json`
  - 2026-11-18 Zug 4: keine Runde
  - 2026-11-18 Zug 5: Commit 36aec5b0 (erster Anlauf c65e8301 trug nur den `git mv`, per `--amend` um die übrigen acht Pfade ergänzt; Inhalt byte-gleich mit dem reviewten Diff) · Offene Befunde nachgeführt: `stage-masks-frozen.astro:44, 162`, `MothChapel.ts:257`

## Abgleich

**READ-003 — verschoben, Substanz unverändert.** Seit dem Audit-Stand
`2e3f585b` hat nur Paket 9 (`4cf5fc5e`) die Datei geändert: `PlaneMesh` als
Elementtyp, `atlasFrame()` statt `!`, `min` aus `three/tsl`, die Prüfungen
der Uhr. Die beiden `#add()` stehen wortgleich in `SeanceRoom`
(`MothChapel.ts:651–657`) und `ChapelWall` (`:829–835`), ebenso die
Dispose-Schleifen (`:667–674`, `:871–877`); `ChapelVoid` (`:403–428`) und
`GlassTint` (`:681–704`) wiederholen »Plane mit Material plus dispose«; der
Frame-Sampler steht zweimal inline (`:597`, `:801`) und nur dort im Lookbook
(`git grep` über `apps/lookbook/src`). Die Datei hält 878 Zeilen mit
Asset-Loader, JSON-Schemas, Uhr, fünf Stage-Klassen und Shader-Bau.

## Entscheidungen in Zug 0

- **Modulnamen.** `chapelAssets.ts` in camelCase wie die Funktionsmodule
  `fetchAsset.ts`, `checkJson.ts`, `heatHaze.ts`; `SeanceClock.ts` in
  PascalCase wie die Klassenmodule `CrawlRig.ts`, `TransitionCycler.ts` — und
  so, wie Paket 9 das Modul der Uhr im Plan schon benennt. Die Stages bleiben
  in `MothChapel.ts`: `RoseWindow.ts` holt `makeChapelStage` von dort, und die
  Szene heißt so.
- **Köpfe im Bündel.** `Head` legt seinen Mesh weiter selbst an, Name, Lage und
  Freigabe übernimmt das Bündel der `SeanceRoom`. Sonst bliebe neben dem Bündel
  ein zweiter Dispose-Pfad in derselben Stage stehen — genau die Doppelung, die
  das Finding meint.
- **Voreinstellungen von `add()`.** `x`, `y`, `order` defaulten auf 0, damit
  `ChapelVoid` und `GlassTint` ohne Nullen auskommen; `SeanceRoom` und
  `ChapelWall` übergeben ihre Werte weiter ausdrücklich, damit der Diff dort
  nur `#add(` → `#meshes.add(` zeigt.
- **Abweichung von der Empfehlung:** keine. Das Audit nennt
  `frameSample(texture, coords)`; der erste Parameter heißt `map`, weil
  `texture` in `helpers.ts` der TSL-Import ist.
- **`.js`-Suffix.** Neue und geänderte relative Importe tragen `.js`
  (`AGENTS.md`, »Imports«; Konventionen im Plan-Kopf). Unberührte Importzeilen
  anderer Szenen (`'./helpers'`) bleiben, wie sie sind.
- **Offene Befunde.** Die beiden Einträge an der Mottenkapelle
  (`stage-masks-frozen.astro`: Store bei werfendem Szenen-Konstruktor nicht
  freigegeben; `MothChapel.ts`: Lichtrichtung NaN ohne Kerzen) haben eigene
  Ursachen — Reihenfolge der Dispose-Registrierung bzw. eine fehlende
  Layout-Prüfung — und bleiben in der Queue; nur ihre Fundstellen zieht Zug 5
  nach.

## Findings im Volltext

**READ-003 · low · apps/lookbook/src/demos/stage-masks/MothChapel.ts:638** — Doppelten Szenen-Code in MothChapel.ts zusammenführen und die Datei teilen
(weitere Fundstellen im Audit: `:815`, `:584`, `:787`, `:653`, `:857`)

SeanceRoom.#add und ChapelWall.#add sind wortgleich, ebenso die dispose-Schleifen über #meshes; ChapelVoid und GlassTint wiederholen das Muster Plane mit Material plus dispose. Der Atlas-Frame-Sampler (texture(sprites, vec2(f.s + uv.x*f.u, f.t + (1-uv.y)*f.v))) steht zweimal inline (Planchette, Motten). Die Datei hält 871 Zeilen mit Asset-Loader, JSON-Schemas, Uhr, fünf Stage-Klassen und Shader-Bau in einem Modul.

Beleg: `#add(mesh: Mesh, name: string, x: number, y: number, order: number)` in beiden Klassen

Empfehlung: Ein kleines Mesh-Bündel (add/dispose) und einen frameSample(texture, coords)-Helfer in helpers.ts anlegen; MothChapel.ts in Assets/Uhr (SeanceClock) und Stages teilen.

## Urteil des Reviewers

- READ-003: behoben — `chapelAssets.ts`, `SeanceClock.ts` wortgleich verschoben; `MeshBundle` in allen vier Stages (`MothChapel.ts:10`, `:153`, `:268`, `:324`); `frameSample()` an `MothChapel.ts:195`, `:381`.
- klein: `apps/lookbook/src/pages/demos/stage-masks-frozen.astro:21–23` — `SeanceClock`-Import steht vor dem `RoseWindow`-Import, nicht alphabetisch (Zeilen wie in der Paketdatei verlangt).
