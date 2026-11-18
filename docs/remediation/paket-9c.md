# Paket 9c — Lookbook: Material-Casts, Atlas-Frames und Zufall in den übrigen Demos

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen — die Stellen gleicher Ursache wie TYPE-001, CONS-004
  und CONS-009 außerhalb der Mottenkapelle und der Stage-Transitions-Szenen
  (vorbestehend, low); die drei Findings selbst hat Paket 9 (4cf5fc5e) behoben
- Ziel: Keine Demo des Lookbooks zwingt ein Material per Cast in seinen Typ,
  holt einen Atlas-Frame mit `!` statt über `atlasFrame()`, oder zieht für das,
  was ihr Vorschaubild zeigt, `Math.random()` statt eines `SeededRandom`.
- Modell: mittlere Stufe
- Effort: medium
- Dateien (alle unter `apps/lookbook/src/`):
  - neu `demos/utils/disposeMaterial.ts`, `demos/utils/disposeMaterial.spec.ts`
  - `apps/lookbook/vitest.config.ts` (`coverage.include`)
  - `demos/atlas-frames-on-meshes/NightCity.ts`
  - `demos/boomer-shooter-corridor/Corridor.ts`, `demos/boomer-shooter-corridor/NeonSigns.ts`
  - `demos/cardboard-parade/CardboardParade.ts`
  - `demos/stage-post-process/Caption.ts`, `demos/stage-post-process/InkedRoom.ts`
  - `demos/vector-balls/VectorBalls.ts`
  - `demos/swaying-grass/SwayingMeadow.ts`
  - `demos/stage-masks/`: `Camcorder.ts`, `Crawlspace.ts`, `CrematoriumWindow.ts`,
    `DeepListening.ts`, `DrownedHouse.ts`, `FoundFootage.ts`, `InkVignette.ts`,
    `InkWell.ts`, `MirrorBathroom.ts`, `PaintedMoor.ts`, `PaintingHallway.ts`,
    `RiftMembrane.ts`, `Sonar.ts`, `Trench.ts`, `WardC.ts`, `WatchingWallpaper.ts`
  - `demos/ui-panels/DungeonScreen.ts`, `demos/platformer/Backdrop.ts`,
    `demos/sine-scroller/SineScroller.ts`
  - `demos/animated-sprites/BouncingSprites.ts`,
    `demos/animated-billboards/BouncingSprites.ts`,
    `demos/textured-sprites/BouncingSprites.ts`
  - `demos/quadtree-playground/QuadTreeVisualization.ts`, `demos/rope-bridge/RopeBridge.ts`
  - `pages/demos/`: `textured-quads.astro`, `textured-quads-from-texture-atlas.astro`,
    `textured-quads-from-tileset.astro`, `first-sprite.astro`, `instanced-quads.astro`,
    `stage-postprocessing.astro`, `rope-bridge.astro`
- Nicht anfassen: alles unter `packages/`, auch die Guides der Library
  (`packages/twopoint5d/docs/sprites.md` zeigt `atlas.frame('…')!` als Kurzform
  der Library-API, die kein `atlasFrame()` kennt); die Vorschaubilder (kein
  `pnpm lookbook:generate-previews` — es schreibt Binärdateien und braucht einen
  Browser); `createSprite()!` (eine Pool-Kapazität, die die Demo selbst setzt,
  kein Atlas-Frame — Paket 9 hat es in den Stage-Transitions ebenso stehen
  lassen); `createVO() as Sprite | undefined` in den `BouncingSprites`
  (Pool-Typ, kein Material); `matteMasks.ts:125` (`image.data`-Cast, eigener
  Eintrag in »Offene Befunde«); `Mesh`-Felder, deren Material nicht über einen
  Cast freigegeben wird (`Camcorder#bars`, `#cross`, `#recDot`,
  `PaintingHallway#doors` u. a.); die Coverage-Schwellen (das neue Modul hebt
  die Quote, die Schwellen bleiben 75/66/74/76)
- Vorgehen:
  1. **Helfer `disposeMaterial()`** in `demos/utils/disposeMaterial.ts`:

     ```ts
     import type {Material} from 'three/webgpu';

     /**
      * Disposes the material of a mesh as three.js types it — one material, a list of them, or
      * none —, for a mesh whose material the code that disposes it did not build or cannot name.
      */
     export function disposeMaterial(material: Material | readonly Material[] | null | undefined): void
     ```

     Ein Material: `dispose()` einmal; eine Liste: jedes Element einmal;
     `null`/`undefined`: nichts. Kein Cast im Rumpf (`Array.isArray()` grenzt
     ein). Spec `demos/utils/disposeMaterial.spec.ts` (Vitest, Node, Import aus
     `three/webgpu` wie `stage-masks/helpers.spec.ts`), `describe('disposeMaterial()')`:
     - `disposes one material once` (`vi.spyOn(material, 'dispose')`, ein
       `new MeshBasicMaterial()`)
     - `disposes each material of a list once` (zwei Materialien)
     - `does nothing for a mesh without a material` (`undefined` und `null`,
       kein Wurf)

     In `apps/lookbook/vitest.config.ts` `'src/demos/utils/disposeMaterial.ts'`
     in `coverage.include` nach `'src/demos/utils/checkJson.ts'` (alphabetisch
     unter `utils/`).
  2. **Material-Casts weg: Felder nach dem Material typisieren** (der Weg aus
     TYPE-001 und aus Paket 9 in `MothChapel.ts`). Regel für jede Stelle unten:
     das Feld, die Liste oder der Rückgabetyp der Fabrik bekommt
     `Mesh<G, M>` mit `G` der Geometrieklasse, die der Konstruktor übergibt,
     und `M` der Materialklasse; hält eine Liste Meshes verschiedener
     Geometrien, ist `G` `BufferGeometry`, bei verschiedenen Materialien `M`
     die engste gemeinsame Klasse (notfalls `Material`). Die Aufrufstelle wird
     dann `mesh.material.dispose()` ohne Klammer und Cast. Fabriken und
     Hilfs-Closures, die solche Meshes bauen oder entgegennehmen, ziehen ihren
     Typ mit (Rückgabe- und Parametertyp), damit nirgends ein neuer Cast
     entsteht. Benennt eine Datei denselben Mesh-Typ dreimal oder öfter, steht
     er als lokales `type` am Dateikopf (Muster `type PlaneMesh =
     Mesh<PlaneGeometry, MeshBasicNodeMaterial>` aus `MothChapel.ts`), sonst
     inline. Laufzeit und Bild bleiben unverändert.
     - `demos/boomer-shooter-corridor/Corridor.ts:56` `#lamp` →
       `Mesh<OctahedronGeometry, MeshBasicNodeMaterial>`; damit fallen der
       Material-Cast `:97` und der Geometrie-Cast `:96` weg
     - `demos/cardboard-parade/CardboardParade.ts:149` `#disc` →
       `Mesh<CircleGeometry, MeshBasicNodeMaterial>`, `:150` `#rim` →
       `Mesh<CylinderGeometry, MeshBasicNodeMaterial>` (Casts `:433`, `:435`)
     - `demos/stage-post-process/Caption.ts:19` `#mesh` →
       `Mesh<PlaneGeometry, MeshBasicMaterial>` (`:77`)
     - `demos/stage-post-process/InkedRoom.ts:82` `#mesh` →
       `Mesh<PlaneGeometry, MeshBasicNodeMaterial>` (`:120`)
     - `demos/vector-balls/VectorBalls.ts:94` `#floor` →
       `Mesh<PlaneGeometry, MeshBasicNodeMaterial>` (`:343`)
     - `demos/swaying-grass/SwayingMeadow.ts:183` `#scenery` samt Rückgabe von
       `#buildScenery()` (`:439`; Geometrien gemischt → `BufferGeometry`)
     - `demos/stage-masks/Camcorder.ts:46` `mesh` (öffentliches readonly-Feld,
       `:88`) und `:330` `#plane` (`:384`)
     - `demos/stage-masks/Crawlspace.ts:254` `#meshes`, die Closure `add`
       (`:275`), `:419`/`:420` `#cone`/`#shaft` (`:453`), `:486` `#fog`
       (`:584`); alle Meshes der Datei tragen `PlaneGeometry`
       (`frameGeometry()` `:226` antwortet `PlaneGeometry`), damit fällt auch
       der Geometrie-Cast in `:404`
       (`this.#playerFrames.includes(mesh.geometry as PlaneGeometry)`) weg
     - `demos/stage-masks/CrematoriumWindow.ts:130` `#meshes` (`:276`; `#add` `:212`)
     - `demos/stage-masks/DeepListening.ts:334` `#meshes` (`:461`), `:484`
       `#meshes` (`:696`), `:714` `#plane` (`:743`), dazu die Rückgabetypen der
       Fabrikfunktionen `:158`, `:203`, `:297`, soweit sie in diese Listen gehen
     - `demos/stage-masks/DrownedHouse.ts:135` Rückgabe von `plane()`, `:143`
       Parameter von `disposeMesh` (`:145`), `:157` `#meshes`, `:252` `#wall`
     - `demos/stage-masks/FoundFootage.ts:294` `#planes` (`:505`; `#addPlane`
       `:468`, das Mesh `:450`), `:518` `#plane` (`:542`)
     - `demos/stage-masks/InkVignette.ts:42` `#plane` (`:175`)
     - `demos/stage-masks/InkWell.ts:190` und `:265` `#plane` (`| undefined`
       bleibt; `:246`, `:345` werden `this.#plane?.material.dispose()`)
     - `demos/stage-masks/MirrorBathroom.ts:98` `#mesh` (`:166`)
     - `demos/stage-masks/PaintedMoor.ts:113` `#meshes` (`:346`), `:364`
       `#mesh` (`:383`), `:399` `#oval` (`:475`)
     - `demos/stage-masks/PaintingHallway.ts:398` `#meshes` (`:617`)
     - `demos/stage-masks/RiftMembrane.ts:167` und `:248` `#plane` (`:236`, `:272`)
     - `demos/stage-masks/Sonar.ts:129` `#plane` (`:141`), `:174`/`:175`
       `#overlay`/`#inset` (`| undefined` bleibt; Schleife `:292`, Cast `:295`)
     - `demos/stage-masks/Trench.ts:131` `#meshes` (`:256`; `#add` `:196`)
     - `demos/stage-masks/WardC.ts:233`/`:234` `#floor`/`#water` (`:401`,
       `:403`), `:478` `#water` (`:599`)
     - `demos/stage-masks/WatchingWallpaper.ts:205` `#meshes` und Parameter von
       `#addMesh` (`:252`), Material `MeshBasicMaterial` (`:402`)
  3. **Material-Casts weg, wo kein Typ zur Hand ist: `disposeMaterial()`.**
     - `demos/atlas-frames-on-meshes/NightCity.ts:248` (`traverse()` über ein
       `Object3D`, `instanceof Mesh` grenzt nur auf `Material | Material[]`
       ein): `disposeMaterial(object.material);`, der Kommentar `:247` (»every
       mesh of the city is built with one material of its own, none with a
       list«) entfällt, weil er nur den Cast trug
     - `pages/demos/textured-quads.astro:125`,
       `pages/demos/textured-quads-from-texture-atlas.astro:105`,
       `pages/demos/textured-quads-from-tileset.astro:107` (`VertexObjects`
       deklariert `material: Material | Material[] | undefined`):
       `disposeMaterial(mesh.material);`; im Kommentar davor entfällt der
       Teilsatz »VertexObjects types its material as a list or none as well«,
       der Rest (wer Geometrie und Material gebaut und wer die Textur geliehen
       hat) bleibt
     Import jeweils `import {disposeMaterial} from '~demos/utils/disposeMaterial';`
     — Alias-Importe aus `~demos/utils/` stehen im Lookbook ohne `.js`-Suffix
     (so `~demos/utils/seededRandom` in `Starfield.ts:13`), relative Importe
     mit.
  4. **`atlas.frame(…)!` → `atlasFrame(atlas, subject, name)`** aus
     `~demos/utils/atlasFrame`. Subjekt ist bei einem Modul der Klassen- bzw.
     Modulname, bei einer Astro-Seite die Demo-ID (Dateiname ohne `.astro`):
     - `demos/atlas-frames-on-meshes/NightCity.ts:183` →
       `atlasFrame(atlas, 'NightCity', layer.frame).coords`
     - `demos/ui-panels/DungeonScreen.ts:253` →
       `atlasFrame(assets.kit, 'DungeonScreen', 'panels 0.aseprite')`
     - `demos/ui-panels/DungeonScreen.ts:287` →
       `atlasFrame(assets.icons, 'DungeonScreen', item.icon)`
     - `demos/platformer/Backdrop.ts:88` → `atlasFrame(atlas, 'Backdrop', frameName)`
     - `demos/sine-scroller/SineScroller.ts:200` →
       `atlasFrame(assets.sabers, 'SineScroller', name)`
     - `pages/demos/textured-quads-from-texture-atlas.astro:42` →
       `atlasFrame(atlas, 'textured-quads-from-texture-atlas', name).coords`;
       der Kommentar `:41` (»the names come out of frameNames() of this very
       atlas, so frame() finds each of them«) entfällt mit dem `!`
     - `pages/demos/first-sprite.astro:68` →
       `atlasFrame(atlas, 'first-sprite', 'splotch0')`
  5. **`Math.random()` → `SeededRandom`** aus `~demos/utils/seededRandom`, nach
     dem Muster von Paket 9 (`Starfield.ts`: `const STAR_SEED = 3;` am
     Modulkopf, `readonly #random = new SeededRandom(STAR_SEED);`,
     `this.#random.next()` an jeder Stelle). In Klassen ein Generator je
     Instanz für **alle** Ziehungen der Klasse; in Astro-Seiten entsteht der
     Generator am Anfang der Funktion, die die Szene baut (nicht auf
     Modulebene), damit jeder Aufbau der Demo dieselbe Folge zieht. Seeds:
     - `demos/animated-sprites/BouncingSprites.ts` (`:53–65`, `:75`, `:110`):
       `const SPRITES_SEED = 7;`
     - `demos/animated-billboards/BouncingSprites.ts` (`:64–74`, `:105`):
       `const BILLBOARDS_SEED = 9;`
     - `demos/textured-sprites/BouncingSprites.ts` (`:62–73`, `:116–121`):
       `const SPRITES_SEED = 13;`
     - `demos/boomer-shooter-corridor/NeonSigns.ts` (`:120–121`, Flackern im
       Takt der Szene): `const FLICKER_SEED = 17;`
     - `demos/quadtree-playground/QuadTreeVisualization.ts` (`:133–136`,
       `:155–158`; `makeRandomQuadTree()` läuft beim Laden der Seite,
       `quadtree-playground.astro:36`): `const CHUNKS_SEED = 19;` — der Knopf
       »make random chunks« zieht aus demselben Generator weiter und zeigt so
       bei jedem Klick ein neues Bild
     - `demos/rope-bridge/RopeBridge.ts` (`#burst()` `:854–860`, ausgelöst vom
       Zusammenprall im Duell `:837`/`:844`, ohne Eingabe):
       `const SPARK_SEED = 23;`
     - `demos/ui-panels/DungeonScreen.ts` (`#combatRound()` `:918–930`, im Takt
       `COMBAT_TICK` aus `#animateParty()` `:886–889`): `const COMBAT_SEED = 29;`
     - `pages/demos/instanced-quads.astro:80–81`: `const QUADS_SEED = 31;`
     - `pages/demos/stage-postprocessing.astro:49`: `const SPRITES_SEED = 37;`
     - `pages/demos/textured-quads.astro:50`: `const QUADS_SEED = 41;`
     - `pages/demos/textured-quads-from-texture-atlas.astro:31, 51`:
       `const QUADS_SEED = 43;`; `sample<T>(arr: T[], random: SeededRandom): T`
       zieht mit `random.next()`, der Kommentar `:29` sagt dann »next() stays
       below 1, …« statt »Math.random() stays below 1, …«
     - `pages/demos/textured-quads-from-tileset.astro:53`: `const QUADS_SEED = 47;`

     **Bleibt `Math.random()`:** `pages/demos/rope-bridge.astro:161` — die
     Laterne fällt nur auf einen Klick auf »drop a lantern«, den ein
     Vorschaubild nie sieht. Darüber ein Kommentar, der das sagt (englisch,
     ein Satz, etwa »only a click drops this lantern, which no preview sees:
     its place may differ on every run«).
  6. Vorschaubilder nicht neu erzeugen. Kein CHANGELOG-Eintrag: die Library
     ändert sich nicht, das Lookbook ist privat und führt keinen.
- Abnahme zusätzlich zum Verify (alle vier aus dem Repo-Root, je leer bis auf
  die genannte Ausnahme):
  - `grep -rnE "as (unknown as )?[A-Za-z]*Material\b" apps/lookbook/src`
  - `grep -rnE "as [A-Za-z]*Geometry\b" apps/lookbook/src`
  - `grep -rnE "\.frame\([^)]*\)!" apps/lookbook/src`
  - `grep -rn "Math.random()" apps/lookbook/src` — nur `pages/demos/rope-bridge.astro`
    (Klick) und der Kommentar `demos/stage-transitions/matteMasks.ts:48`
- Verify: `pnpm run ci`
- Commit: `fix(lookbook): type the meshes of the demos by the material they dispose instead of casting it, name a missing atlas frame through atlasFrame(), and draw what a preview shows from a seeded generator`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · Material-Casts: 39 in 26 Dateien
    statt der 20 in 17 aus Zug 0 von Paket 9 (dessen Suche traf nicht alle
    Schreibweisen; jede Stelle vorbestehend, `git show 2e3f585b:<pfad>` je
    Datei gezählt), dazu 2 Geometrie-Casts gleicher Ursache (`Corridor.ts:96`,
    `Crawlspace.ts:404`) · `atlas.frame(…)!`: 7 in 6 Dateien, unverändert ·
    `Math.random()`: 13 Dateien unverändert, 12 ziehen fürs Vorschaubild, 1
    (`rope-bridge.astro:161`) nur auf Klick · `MeshBundle` nicht übernommen
    (Grund unten) · Folgen der Pakete 1–9b: keine offen · aus »Offene Befunde«
    nichts übernommen (`matteMasks.ts:125` ist ein `image.data`-Cast, kein
    Material; die übrigen Lookbook-Einträge haben eigene Ursachen) · Restplan:
    10 und 11 unverändert (nur `packages/twopoint5d/src/`, kein Berührungspunkt
    mit dem Lookbook)
  - 2026-11-18 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-9c.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG_MIT_VORBEHALT (Dateien nicht ganz gelesen) · 40 Dateien geändert, neu `demos/utils/disposeMaterial.ts` + Spec · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-9c.verify.log`) · vier greps wie verlangt
  - 2026-11-18 Zug 3: Review (sonnet, medium) — alle Zielpunkte erfüllt, kritisch 0, wichtig 0, klein 2 · Diff `paket-9c.diff`, Report `paket-9c.review-0.json`
  - 2026-11-18 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-18 Zug 5: Commit 2401e5b7 auf Verify exit=0 aus Zug 2 · Nebenbefund `SwayingMeadow.ts:281-285` → Offene Befunde

## Abgleich

Das Lookbook hat sich seit `2e3f585b` nur in den Paketen 9 und 9b bewegt
(`git diff --stat 2e3f585b HEAD -- apps/lookbook/src`, 38 Dateien); in den
Dateien dieses Pakets haben 9/9b nur Importe (`atlasFrame`/`SeededRandom` aus
`~demos/utils/`) verschoben, keine der Fundstellen berührt.

- **Material-Casts** (`grep -rnE "as (unknown as )?[A-Za-z]*Material\b"`):
  39 Stellen in 26 Dateien, gegen `2e3f585b` dieselben 26 Dateien plus
  `MothChapel.ts` (dort von Paket 9 behoben). Der Plan nannte 20 Stellen in
  17 Dateien; zusätzlich gefunden: `DeepListening.ts:461, 696, 743`,
  `FoundFootage.ts:505, 542`, `InkWell.ts:246, 345`, `PaintedMoor.ts:346,
  383, 475`, `RiftMembrane.ts:236, 272`, `WardC.ts:401, 403, 599`,
  `InkedRoom.ts:120`, `Sonar.ts:295`, `textured-quads-from-texture-atlas.astro:105`,
  `textured-quads-from-tileset.astro:107`. Gleiche Ursache (ungetypter `Mesh`),
  vom Ziel »keine Demo« schon gedeckt — kein Scope-Zuwachs, daher hier
  aufgenommen.
- **Geometrie-Casts** gleicher Ursache: `Corridor.ts:96`
  (`this.#lamp.geometry as OctahedronGeometry`) und `Crawlspace.ts:404`
  (`mesh.geometry as PlaneGeometry`) — sie verschwinden mit demselben Feldtyp.
- **`atlas.frame(…)!`**: 7 Stellen in 6 Dateien, Zeilen wie im Plan.
- **`Math.random()`**: 13 Dateien wie im Plan; Einordnung oben in Schritt 5.
  Das Vorschaubild entsteht unter `?preview=1` nach `DEFAULT_PREVIEW_DELAY_MS`
  = 5000 ms (`demos/utils/demoPreview.ts:14`) ohne Eingabe; was beim Aufbau
  oder im Takt der Szene würfelt, trifft es, was nur auf einen Klick würfelt,
  nicht.

## Entscheidungen aus Zug 0

- **Feldtypen statt `MeshBundle`.** Der Plan hängt 9c an 9b, weil das
  Mesh-Bündel »die Casts der Stage-Masks-Szenen tragen« könnte. Die Ursache der
  Casts ist der Typ, nicht die Buchführung: `Mesh<G, M>` am Feld beseitigt sie
  ohne Laufzeitänderung, wie Paket 9 es in `MothChapel.ts` getan hat und wie
  TYPE-001 empfiehlt. `MeshBundle` setzt Name, Lage und `renderOrder` und hängt
  sofort an; `DeepListening`, `PaintedMoor` und `PaintingHallway` hängen ihre
  Meshes später oder bedingt an (`if (!mesh.parent)`), und `Crawlspace` teilt
  Geometrien (`#playerFrames`), die ein Bündel doppelt freigäbe. Ein Umbau auf
  das Bündel wäre ein Refactor in zehn Szenen mit Risiko fürs Bild, ohne dass
  er die Ursache besser behebt.
- **`disposeMaterial()` nur, wo kein Typ zur Hand ist** (Traversal über ein
  `Object3D`, die Library-Klasse `VertexObjects` mit
  `material: Material | Material[] | undefined`). Vier gleiche Fallunterscheidungen
  inline wären Duplikat; ein Helfer mit Spec liegt bei `atlasFrame()` und
  `SeededRandom` unter `~demos/utils/`, wo jede Demo importieren darf.
- **Ein Generator je Klasse für alle ihre Ziehungen**, auch für Ziehungen auf
  Eingabe (`destroySprites()` in `animated-sprites/BouncingSprites.ts:75`):
  eine Klasse mit zwei Zufallsquellen wäre schwerer zu lesen, und die
  Reproduzierbarkeit des Starts hängt nicht daran. Eigene Seeds je Modul,
  damit zwei Demos nicht dieselbe Folge zeigen.
- **`createSprite()!` bleibt.** Es ist kein Atlas-Frame, sondern eine
  Kapazität, die die Demo selbst setzt; Paket 9 hat es bei CONS-004 in den
  Stage-Transitions ebenso stehen lassen, und der Reviewer hat CONS-004 als
  behoben bestätigt.

## Findings im Volltext

Zur Herkunft: die drei Findings sind mit Paket 9 geschlossen. Hier stehen sie,
weil 9c dieselbe Ursache an den übrigen Stellen behebt.

**TYPE-001 · low · apps/lookbook/src/demos/stage-masks/MothChapel.ts:413** — Material-Casts durch typisierte Meshes ersetzen
mesh.material wird in jedem dispose() mit as MeshBasicNodeMaterial auf den
erwarteten Typ gezwungen; #meshes ist Mesh[] ohne Material-Typ. In
glowLayerBuilder.ts wird eine Funktion ohne dispose als GlowLayerBuilder
gecastet und dispose erst danach zugewiesen, so dass der Typchecker die Lücke
nicht sieht.
Empfehlung: Mesh<PlaneGeometry, MeshBasicNodeMaterial> als Feld- und Array-Typ
verwenden; im Glow-Builder Object.assign(fn, {dispose}) oder eine Funktion mit
angehängtem dispose ohne Cast bauen.

**CONS-004 · low · apps/lookbook/src/demos/stage-transitions/GalleryScene.ts:106** — Atlas-Frames in den Stage-Transitions-Szenen über einen benennenden Helfer holen
Die Stage-Masks-Szenen holen Frames über atlasFrame(atlas, subject, name), das
bei fehlendem Frame mit Subjekt und Namen wirft. Die Stage-Transitions-Szenen
schreiben atlas.frame(name)! (und createSprite()!); fehlt ein Frame in
spaceships.json, folgt ein TypeError ohne Hinweis auf Szene oder Namen mitten
im Konstruktor. Die Regel der Repo-Fehlermeldungen (Subjekt zuerst) gilt hier
nicht.
Empfehlung: atlasFrame aus stage-masks/helpers (oder eine eigene Variante in
stage-transitions/assets.ts) verwenden; die Szene soll nicht von der Datei
eines fremden Demos importieren, daher den Helfer besser in ~demos/utils
verschieben.

**CONS-009 · low · apps/lookbook/src/demos/stage-transitions/Starfield.ts:60** — Zufall der Stage-Transitions-Demos deterministisch machen wie in den Stage-Masks
Die Stage-Masks-Demos (SeededRandom, randomAt) und die InkBlots (fester Hash,
Kommentar: the same ink every run) sind bewusst reproduzierbar. Starfield,
GameLevel und BoilingNoise nehmen Math.random(). Die Vorschaubilder der Demos
entstehen mit pnpm lookbook:generate-previews gegen den echten Lauf; bei jeder
Neugenerierung ändern sich Sternenfeld, Gegnerpositionen und Rauschen, und das
committete WebP wechselt ohne inhaltlichen Grund.
Empfehlung: Die Startpositionen von Starfield und GameLevel aus dem vorhandenen
SeededRandom aus ../stage-masks/helpers ziehen (oder einen Seed pro Demo
reichen); das Rauschen der BoilingNoise darf zufällig bleiben, wenn es mit der
Zeit tanzen soll, sollte dann aber im Preview-Modus festgesetzt werden.

## Urteil des Reviewers

- Material-Casts (TYPE-001, übrige Stellen): behoben — alle 26 Dateien typisieren ihre Meshes als `Mesh<G, M>` bzw. lokales `PlaneMesh` (z. B. `Crawlspace.ts:56`), Fabriken ziehen mit (`DeepListening`, `DrownedHouse`, `WatchingWallpaper`, `SwayingMeadow#buildScenery`); grep leer
- Geometrie-Casts: behoben — `Corridor.ts:96`, `Crawlspace.ts:404` ohne Cast
- `disposeMaterial()`: behoben — `NightCity.ts:248`, drei `textured-quads*.astro`; `instanceof Material` statt `Array.isArray()` (`disposeMaterial.ts:9–13`), akzeptiert, kein Cast; Spec mit drei Fällen, `vitest.config.ts:28`
- `atlasFrame()` (CONS-004, übrige Stellen): behoben — 7 Stellen mit den Subjekten aus dem Plan; Filter auf `string` in `textured-quads-from-texture-atlas.astro` nötig wegen `TextureAtlasFrameName = string | symbol`
- `SeededRandom` (CONS-009, übrige Stellen): behoben — 12 Dateien, Seeds 7, 9, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47; `rope-bridge.astro:161` Kommentar vor dem Klick-Zufall
- Konventionen: keine Finding-IDs, kein Rückblick, Kommentare englisch; Commit-Message passt

## Kleine Befunde

- `demos/boomer-shooter-corridor/NeonSigns.ts:75`: `const FLICKER_SEED = 17;` steht zwischen dem JSDoc der Klasse und `class NeonSigns`; der Doc-Kommentar hängt an der Konstante
- `demos/rope-bridge/RopeBridge.ts:~163`: `SPARK_SEED` steht mitten in der `WEIGHT_*`-Gruppe statt bei `SPARKS`/`SPARK_LIFE`; der `~demos`-Import steht hinter den relativen Imports
- Hinweis ohne Befund: die Specs unter `demos/utils/` importieren relativ ohne `.js` wie das ganze Lookbook (Vite-Auflösung); die `.js`-Regel aus AGENTS.md begründet sich mit NodeNext und betrifft die Pakete
