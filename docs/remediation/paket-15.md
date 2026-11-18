# Paket 15 — Drain: Lookbook-Demos

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Nebenbefunde: die sechs Lookbook-Einträge aus »Offene Befunde« (sieben Zeilen,
  Volltext unten) — `stage-masks-frozen.astro` (Store nicht freigegeben, wenn ein
  Szenen-Konstruktor wirft), `MothChapel.ts` (`room.json` ohne Kerzen → NaN),
  `matteMasks.ts` (Import aus fremdem Demo-Modul; Cast ohne Typgrund),
  `SwayingMeadow.ts` (eigene `frame`-Closure statt `atlasFrame()`), `CrawlRig.ts`
  (Feld zwischen den Methoden); alle vorbestehend. Dazu gleicher Ursache wie
  `SwayingMeadow.ts`, in Zug 0 gefunden, vorbestehend (das Lookbook ist seit
  `2e3f585b` nur in den Paketen 9, 9b, 9c geändert, und keines fasste diese Stellen
  an): `CardboardParade.ts:162–166`, `RopeBridge.ts:463–467`, `VectorBalls.ts:124–128`,
  `NeonSigns.ts:101–103` (low/info)
- Ziel: Die Demos geben ihre Assets auch im Fehlerfall frei, prüfen ihr Layout
  vollständig, halten die Modulgrenzen zwischen Demos ein und nutzen die gemeinsamen
  Helfer.
- Modell: mittlere Stufe
- Effort: medium
- Dateien (alle unter `apps/lookbook/`):
  - neu `src/demos/utils/demoParts.ts`, neu `src/demos/utils/demoParts.spec.ts`
  - `vitest.config.ts` (`coverage.include`)
  - `src/pages/demos/stage-masks-frozen.astro`
  - `README.md` (Absatz »Whatever the page builds …«, Zeilen 81–94)
  - `src/demos/stage-masks/SeanceClock.ts`, `src/demos/stage-masks/SeanceClock.spec.ts`
  - verschoben `src/demos/stage-masks/SoftBlobs.ts` → `src/demos/utils/SoftBlobs.ts`
    (Inhalt unverändert), dazu die Importzeile in `src/demos/stage-masks/InkWell.ts:22`,
    `Trench.ts:31`, `InkVignette.ts:6`, `RiftMembrane.ts:7`, `DrownedHouse.ts:33`,
    `CrematoriumWindow.ts:17`, `WardC.ts:30`, `WatchingWallpaper.ts:22` und
    `src/demos/stage-transitions/matteMasks.ts:13`; der Kopfkommentar von
    `src/demos/stage-masks/helpers.ts:19–23`
  - `src/demos/stage-transitions/matteMasks.ts` (`BoilingNoise`)
  - `src/demos/swaying-grass/SwayingMeadow.ts`, `src/demos/cardboard-parade/CardboardParade.ts`,
    `src/demos/rope-bridge/RopeBridge.ts`, `src/demos/vector-balls/VectorBalls.ts`,
    `src/demos/boomer-shooter-corridor/NeonSigns.ts`
  - `src/demos/stage-masks/CrawlRig.ts`
- Vorgehen:
  1. **`DemoParts` (neu, `src/demos/utils/demoParts.ts`).** Zuerst die Spec
     `src/demos/utils/demoParts.spec.ts` schreiben und rot sehen (das Modul fehlt noch),
     dann das Modul. Inhalt:

     ```ts
     /** What `DemoParts` needs of a display: a `Display` passes as it is, a spec hands in a stand-in. */
     export interface DemoPartsDisplay {
       readonly isDisposed: boolean;
       onDispose(release: () => void): unknown;
     }

     /**
      * What the init of a demo builds after an `await`, let go of as the display is disposed. Made
      * right after the init has asked `display.isDisposed`, it keeps each part the moment the part
      * exists: a part that throws as it is built leaves behind nothing that was built before it, and
      * the error stays the one `onDemoInit()` shows. The parts go in the reverse order they were kept
      * in — a mask before the stage it reads, a scene before the store whose textures it draws with —,
      * and each one goes even behind one whose release throws; that error is thrown once all of them
      * have gone, and the display throws it once it is down.
      */
     export class DemoParts {
       readonly #releases: (() => void)[] = [];

       constructor(display: DemoPartsDisplay) {
         // a disposed display calls no onDispose() listener any more: nothing kept here would go
         if (display.isDisposed) {
           throw new Error('new DemoParts(): the display is disposed already, and nothing kept would go with it');
         }
         display.onDispose(() => this.#releaseAll());
       }

       /** Keeps `part` and answers it: its `dispose()` runs as the display is disposed. */
       keep<T extends {dispose(): void}>(part: T): T {
         this.#releases.push(() => part.dispose());
         return part;
       }

       /**
        * Runs `release` as the display is disposed, in its place among the kept parts: a listener
        * to take off, a timeout to clear, a lil-gui panel to destroy.
        */
       onDispose(release: () => void): void {
         this.#releases.push(release);
       }

       #releaseAll(): void {
         // last kept, first released, and every release runs, behind one that throws as well
         const errors: unknown[] = [];
         for (let release = this.#releases.pop(); release !== undefined; release = this.#releases.pop()) {
           try {
             release();
           } catch (error) {
             errors.push(error);
           }
         }
         if (errors.length === 1) throw errors[0];
         if (errors.length > 1) {
           throw new AggregateError(errors, `DemoParts: ${errors.length} releases threw as the display was disposed`);
         }
       }
     }
     ```

     Formatierung und Zeilenumbruch nach Biome (`pnpm format`); weicht Biome an der
     Schleife ab (etwa `noAssignInExpressions`), ist eine `while`-Schleife über
     `this.#releases.length` mit `pop()` gleichwertig — Hauptsache, jede Release läuft genau
     einmal, die zuletzt angemeldete zuerst.

     Kein Default-Export, keine weiteren Exporte. Die Spec (`describe('DemoParts')`)
     arbeitet mit einem Stand-in `{isDisposed, onDispose(release) { listeners.push(release); }}`
     und einer Funktion, die die gesammelten Listener ruft — ohne Cast. Fälle, Namen
     wörtlich:
     - `lets go of nothing before the display is disposed, and of every part in the reverse order it kept them in after`
       (drei `keep()`, ein `onDispose()` dazwischen, die Reihenfolge als Liste geprüft)
     - `keep() answers the part it keeps` (`toBe`)
     - `lets go of the parts kept before a part that throws as it is built`
       (`keep(a)`, dann wirft der Bau des nächsten Teils vor dem `keep()`; nach dem Dispose
       ist `a.dispose()` genau einmal gerufen)
     - `releases every part behind one that throws, and throws that error once all have gone`
       (dasselbe Fehlerobjekt per `toBe` auf dem gefangenen Fehler)
     - `throws an AggregateError when more than one release throws`
       (Meldung `DemoParts: 2 releases threw as the display was disposed`, `errors` in der Reihenfolge des Werfens)
     - `refuses a display that is disposed already, and subscribes nothing`
       (`toThrow(new Error('new DemoParts(): the display is disposed already, and nothing kept would go with it'))`,
       der Stand-in hat danach keinen Listener)

     In `vitest.config.ts` kommt `'src/demos/utils/demoParts.ts'` in `coverage.include`
     (alphabetisch zwischen `checkJson.ts` und `disposeMaterial.ts`). Die `thresholds`
     bleiben: ein voll abgedecktes Modul hebt den Stand, die Schwellen sind Untergrenzen.
  2. **`stage-masks-frozen.astro`** (Init `:43–181`) auf `DemoParts` umstellen. Import
     `import {DemoParts} from '~demos/utils/demoParts';` zu den übrigen `~demos/utils/`-Imports.
     Nach der Prüfung `if (display.isDisposed) { assets.store.dispose(); return; }` (`:45–48`,
     bleibt) folgt, eingeleitet vom Kommentar
     `// from here on each part goes with the display the moment it exists, also when a part after it throws as it is built`:
     - `const parts = new DemoParts(display);` und `parts.keep(assets.store);`
     - `new SeanceClock(…)` bleibt ohne `keep()` (es hat kein `dispose()`)
     - `dark`, `room`, `amber`, `violet`, `wall`, `rose` je als `parts.keep(new …)`, in der
       Reihenfolge von heute
     - `throughGlass`, `amberGlass`, `violetGlass` je als `parts.keep(new StageMask(…))`
     - der Keydown-Listener: `const listening = new AbortController();`,
       `parts.onDispose(() => listening.abort());`, dann
       `window.addEventListener('keydown', onKeyDown, {signal: listening.signal});` — das
       Muster, das `README.md:87–90` verlangt
     - direkt nach `new GUI(…)`: `parts.onDispose(() => gui.destroy());`
     - `let previewTimeout …` (`:160`) bleibt vor `await precompiled`, gefolgt von
       `parts.onDispose(() => clearTimeout(previewTimeout));`
     - der Block `display.onDispose(() => { … })` `:162–176` entfällt ganz.
     Die Freigabe läuft damit in der Reihenfolge Timeout, GUI, Listener, `violetGlass`,
     `amberGlass`, `throughGlass`, `rose`, `wall`, `violet`, `amber`, `room`, `dark`, Store —
     die Masken vor der Stage, die sie lesen, die Szenen vor dem Store; das entspricht dem
     Block von heute bis auf die Stellung von Listener und GUI untereinander. Der Kommentar
     `:39–40` zum Director und `display.onDispose(() => director.dispose())` `:41` bleiben.
     Sonst ändert sich an der Seite nichts.
  3. **`README.md`**, Absatz ab `:81`. Den Satz `:86–87` »What the page builds before
     `display.start()` is freed by an `onDispose()` right after it is built, what the init
     builds after an `await` by one at the end of the init.« ersetzen durch:
     »What the page builds before `display.start()` is freed by an `onDispose()` right after
     it is built. What the init builds after an `await` goes into a `DemoParts` from
     `src/demos/utils/demoParts.ts`, made as soon as the init has asked `display.isDisposed`:
     `parts.keep(part)` takes each part with a `dispose()` the moment it exists,
     `parts.onDispose(release)` anything else, so a part that throws as it is built leaves
     nothing behind that was built before it, and the display lets go of the parts in the
     reverse order they were kept in.« Den Satz `:92–94` »`platformer.astro` and
     `rope-bridge.astro` show the pattern, and `PerspectiveOrbitDemo` frees its orbit
     controls itself.« ersetzen durch »`stage-masks-frozen.astro` shows the pattern, and
     `PerspectiveOrbitDemo` frees its orbit controls itself.« (die beiden genannten Seiten
     folgen der neuen Regel erst mit Paket 15b). Den Absatz danach auf die Breite der
     Nachbarzeilen neu umbrechen (rund 96 Spalten, Einzug drei Leerzeichen).
  4. **`SeanceClock`** (`SeanceClock.ts:54–57`): direkt nach der Prüfung der Kopfzahl
     ```ts
     // SeanceRoom lights the heads from the middle of the candles on the table: without a candle that middle is NaN
     if (layout.candles.length === 0) {
       throw new Error('new SeanceClock(): room.json has no candles, and the heads are lit from their middle');
     }
     ```
     Zuerst in `SeanceClock.spec.ts` nach dem Fall `refuses another count of heads …` (`:48–52`)
     den Fall `refuses a room without candles, as it is built` mit
     `room((layout) => (layout.candles = []))` und genau dieser Meldung schreiben, rot sehen,
     dann beheben. `MothChapel.ts:254–257` bleibt unverändert.
  5. **`SoftBlobs` nach `~demos/utils/`.** `git mv apps/lookbook/src/demos/stage-masks/SoftBlobs.ts
     apps/lookbook/src/demos/utils/SoftBlobs.ts`, Inhalt unverändert. Die neun Importzeilen
     (Liste unter »Dateien«) lauten danach `import {SoftBlobs} from '~demos/utils/SoftBlobs';`
     bzw. `import {type SoftBlob, SoftBlobs} from '~demos/utils/SoftBlobs';`; die Reihenfolge
     der Imports bestimmt Biome (`pnpm format` schreibt sie, `pnpm lint` prüft). Kopfkommentar
     `stage-masks/helpers.ts:19–23` ersetzen durch:
     ```ts
     // The helpers that more than one demo needs — the seeded random, the named atlas frame, the
     // loading and checking of the files, the soft blobs of a mask stage — lie under `~demos/utils/`.
     // This module holds what the scenes of the stage mask demos share among themselves. A scene
     // imports from it, from `~demos/utils/` and from the modules of its own demo page, never from the
     // module of another demo: a scene that someone takes as a template brings nothing foreign with it.
     ```
  6. **`BoilingNoise`** (`matteMasks.ts:99–140`): ein eigenes Feld
     `readonly #texels = new Uint8Array(NOISE_WIDTH * NOISE_HEIGHT * 4);` **vor** `#noise`
     (die Felder werden in ihrer Reihenfolge belegt), `#noise` baut die `DataTexture` aus
     `this.#texels`, und `#boil()` schreibt in `this.#texels`; die Zeile
     `const texels = this.#noise.image.data as Uint8Array;` `:125` entfällt samt Cast.
  7. **`atlasFrame()` statt eigener Frame-Suche**, je mit
     `import {atlasFrame} from '~demos/utils/atlasFrame';`, Subjekt der Modulname wie in
     Paket 9c (`'Backdrop'`, `'SineScroller'`, …):
     - `SwayingMeadow.ts:281–285`: `const frame = (name: string) => atlasFrame(atlas, 'SwayingMeadow', name);`
       — die `.map(frame)`-Aufrufe darunter bleiben
     - `CardboardParade.ts:162–166`: dasselbe mit `'CardboardParade'`
     - `RopeBridge.ts:463–467`: der Rumpf von `#frame(name)` wird
       `return atlasFrame(this.#assets.atlas, 'RopeBridge', name);` (die Methode bleibt, sie hat
       zehn Aufrufe)
     - `VectorBalls.ts:124–128`: `BALL_COLOURS.map((name) => prepareSpriteFrame(atlasFrame(atlas, 'VectorBalls', name)))`
     - `NeonSigns.ts:101–103`: `const frame = atlasFrame(atlas, 'NeonSigns', sign.frame);` und
       `if (sprite == null) continue;` — ein fehlender Frame wirft, statt das Schild still
       auszulassen (Grund unten)
  8. **`CrawlRig`**: `readonly #q = new Vector2();` von `CrawlRig.ts:240` zu den übrigen
     Feldern, direkt unter `readonly #random = new SeededRandom(1);` (`:127`), mit dem
     Kommentar `/** the point on each plane that {@link CrawlRig.coverageAt} reads, reused */`.
     `coverageAt()` bleibt sonst unverändert.
- Verify: `pnpm run ci` (zwischendurch `pnpm nx test lookbook`, `pnpm lint`, `pnpm typecheck`)
- Commit: `fix(lookbook): let go of what the moth chapel built when a part of it throws as it is built, through a DemoParts the README now asks of every init, refuse a séance room without candles, share SoftBlobs through ~demos/utils, hold the texels of the boiling noise in a field of their own, name a missing atlas frame through atlasFrame() in the swaying meadow, the cardboard parade, the rope bridge, the vector balls and the neon signs, and keep the fields of the crawl rig together`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · Lookbook seit 2401e5b7 unberührt, alle
    Fundstellen unverändert an ihrer Zeile (`stage-masks-frozen.astro:44, 162`,
    `MothChapel.ts:257`, `matteMasks.ts:13, 125`, `SwayingMeadow.ts:281–285`,
    `CrawlRig.ts:240`) · gleicher Ursache wie `SwayingMeadow.ts` dazu `CardboardParade.ts`,
    `RopeBridge.ts`, `VectorBalls.ts`, `NeonSigns.ts` · gleicher Ursache wie
    `stage-masks-frozen.astro` 33 weitere Demo-Seiten → Paket 15b abgeteilt · neuer
    Nebenbefund Listener-Abnahme per `removeEventListener()` in 11 Seiten → »Offene Befunde«
    · keine offenen Folgen erledigter Pakete; Queue-Eintrag `Stage2D.ts:412` andere Ursache,
    bleibt
  - 2026-11-18 Zug 1: Implementierer beauftragt (Sonnet, mittlere Stufe, Effort medium), Brief `paket-15.impl-0.brief.txt`, Report `paket-15.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG (Text erst über Resume `paket-15.impl-0-versuch-2.json`), 2 neue Dateien (`utils/demoParts.ts`, `utils/demoParts.spec.ts`), 1 verschoben (`SoftBlobs.ts` → `utils/`), 21 geändert unter `apps/lookbook/`; rote Läufe belegt (Modul fehlt; Kerzen-Fall wirft nicht) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-15.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (Sonnet, medium) — alle Nebenbefunde behoben, Schritte 1–8 erfüllt, 0 kritisch, 0 wichtig, 2 klein · Diff `paket-15.diff`, Report `paket-15.review-0.json`
  - 2026-11-18 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-18 Zug 5: Commit 5909821e auf Verify `paket-15.verify.log` exit=0 (keine Änderung seither) · Trailer `Remediation-Run: 2026-11-17`

## Urteil des Reviewers (Zug 3, gegen 5909821e)

- `stage-masks-frozen.astro` (Store und Teile bei werfendem Konstruktor) — behoben: `new DemoParts(display)` nach der `isDisposed`-Prüfung, Store, sechs Szenen und drei `StageMask` per `parts.keep()`, Listener über `AbortController`, `gui.destroy()` und `clearTimeout` per `parts.onDispose()`; der Block `display.onDispose(() => { … })` am Ende entfällt
- `MothChapel.ts:257` (Raum ohne Kerzen) — behoben in `SeanceClock.ts:55–58`, Fall `SeanceClock.spec.ts:51–55`; `MothChapel.ts` unberührt
- `matteMasks.ts:13` (Import aus fremdem Demo-Modul) — behoben: `~demos/utils/SoftBlobs`, `git mv` mit 100 % Similarity, neun Importzeilen umgestellt, kein alter Pfad im Code
- `matteMasks.ts:125` (Cast ohne Typgrund) — behoben: Feld `#texels` vor `#noise` (`:102–103`), `#boil()` schreibt in `this.#texels` (`:126`)
- `SwayingMeadow.ts:281–285` — behoben: `atlasFrame(atlas, 'SwayingMeadow', name)`
- `CrawlRig.ts:240` — behoben: `#q` unter `#random` mit Kommentar
- `CardboardParade.ts`, `RopeBridge.ts`, `VectorBalls.ts`, `NeonSigns.ts` — behoben: `atlasFrame()` mit Modulnamen; `RopeBridge#frame` bleibt; `NeonSigns` wirft bei fehlendem Frame
- README `:81ff.` — beide Sätze ersetzt, Absatz umbrochen

## Kleine Befunde

- `apps/lookbook/src/demos/utils/demoParts.spec.ts` (Fall `throws an AggregateError …`): zwei `as AggregateError`-Casts auf den gefangenen Fehler; ein `instanceof`-Guard würde verengen (Reviewer)
- `docs/superpowers/plans/2026-10-31-stage-masks-a-c.md:205` nennt `stage-masks/SoftBlobs.ts` — historischer Plan, bleibt (Reviewer, Implementierer)
- Die `atlasFrame`-Imports stehen in den fünf Demos hinter den übrigen Imports; Biome verlangt keine Reihenfolge, `pnpm lint` grün (Abweichung laut Implementierer)
- `DemoParts#releaseAll` als `while`/`pop()`-Schleife, die im Detailplan als gleichwertig genannte Form

## Abgleich (Zug 0, gegen c972df9d)

Das Lookbook ist seit 2401e5b7 (Paket 9c) unberührt (`git log 2e3f585b..HEAD --
apps/lookbook`); die Pakete 10 bis 14b haben nur die Library geändert.

- `stage-masks-frozen.astro:44, 162` — unverändert. `loadChapelAssets()` `:44`, danach
  `new SeanceClock()`, sechs Szenen, drei `StageMask`, GUI; die Freigabe erst `:162–176`.
  Wirft `atlasFrame()` in `SeanceRoom`/`ChapelWall`/`RoseWindow` oder `new SeanceClock()`,
  fängt `onDemoInit()` den Fehler, und Store und gebaute Szenen bleiben, bis die Seite geht.
- `MothChapel.ts:257` — unverändert: `centre.divideScalar(layout.candles.length)`, bei
  `candles: []` ein `Vector3(NaN, NaN, NaN)` und daraus die Lichtrichtung jedes Kopfes.
  `checkRoomJson` (`chapelAssets.ts:92`) nimmt eine leere Liste, `SeanceClock`
  (`SeanceClock.ts:54–73`) prüft Kopfzahl und Marken, Kerzen nicht.
- `matteMasks.ts:13` — unverändert: `import {SoftBlobs} from '../stage-masks/SoftBlobs';`,
  einziger demoübergreifende Import im Lookbook (Suche nach `from '../<anderes Demo>/'` und
  `~demos/<anderes Demo>/` in `src/demos/`).
- `matteMasks.ts:125` — unverändert: `this.#noise.image.data as Uint8Array`.
- `SwayingMeadow.ts:281–285` — unverändert, Meldung `swaying-grass: the atlas has no frame "${name}"`.
- `CrawlRig.ts:240` — unverändert. Eine Suche nach Feldern hinter der ersten Methode einer
  Klasse über `apps/lookbook/src/**/*.ts` findet sonst nur Arrow-Felder als Handler
  (`TransitionCycler.ts:236`, `Platformer.ts:97, 107`) — die sind Methoden in Feldform und
  keine Stelle gleicher Ursache.

## Gründe aus Zug 0

- **Freigabe über `DemoParts`, nicht über ein vorgezogenes `display.onDispose()` je Teil.**
  `Display` ruft die Listener von `OnDisplayDispose` in der Reihenfolge ihrer Anmeldung
  (`emitStrict`, `Display.ts:1420`); ein Listener je Teil, gleich nach dem Bau angemeldet,
  gäbe den Store zuerst frei und die Masken zuletzt — umgekehrt zu dem, was die Seiten heute
  tun und was `ui-panels.astro:64–68` begründet (»the renderer only lets go of the stage, so
  the stage goes after it«). Ein Stapel, der als ein Listener rückwärts freigibt, hält die
  Reihenfolge und deckt den Teilbau ab. Ein `try`/`catch` nur um den Store ließe die schon
  gebauten Szenen liegen. `DemoParts` ist ein Helfer unter `~demos/utils/` nach dem Muster
  von `atlasFrame()` und `disposeMaterial()` (Pakete 9, 9c), weil Paket 15b dieselbe Regel
  in 33 Seiten umsetzt.
- **`DemoParts` wirft auf einem entsorgten Display**, statt still nichts freizugeben: ein
  `onDispose()` nach `dispose()` wird nie gerufen (`Display.ts:1581–1586`), jeder gehaltene
  Teil bliebe liegen. Die Seiten prüfen `display.isDisposed` vorher ohnehin.
- **Die Releases laufen alle, auch hinter einem, der wirft**, und werfen danach einen Fehler
  oder einen `AggregateError` — dieselbe Zusage, die `Display#dispose()` für seine Listener
  macht (`Display.ts:1378–1384`).
- **README-Regel ändert sich in diesem Paket**, weil `README.md:86–87` (»what the init builds
  after an `await` by one at the end of the init«) die Ursache des Befunds als Regel
  festschreibt. Sie gilt damit für alle Seiten; die 33 übrigen setzt Paket 15b um.
- **Die Prüfung der Kerzen steht in `SeanceClock`**, nicht in `checkRoomJson`: die Uhr ist
  die Stelle, an der Paket 9 die Annahmen der Séance über `room.json` beim Bau ablehnt
  (Kopfzahl, Marken), sie liegt in `coverage.include` und hat eine Spec; `MothChapel.ts`
  (Shader-Code) hat keine. Die Seite baut die Uhr vor `SeanceRoom`.
- **`SoftBlobs` zieht nach `~demos/utils/`**, statt in `stage-transitions/` kopiert zu
  werden: es ist ein Baustein, den zwei Demos nutzen, und `utils/` hält schon
  Szenen-Bausteine (`PerspectiveOrbitDemo.ts`, `makePoints.ts`). Die Regel im Kopf von
  `helpers.ts` bleibt in der Sache, nennt aber `~demos/utils/` statt `SoftBlobs.ts`.
- **`NeonSigns` wirft bei fehlendem Frame**, statt das Schild auszulassen: das ist die Regel,
  die Paket 9c mit `atlasFrame()` für jede Demo eingeführt hat; `createSprite()` kann bei
  `capacity: SIGNS.length` (`NeonSigns.ts:87`) nicht leer bleiben, die Prüfung auf `sprite`
  bleibt nur als Wache.
- **Kein Regressionstest für die Seite**: Demo-Seiten haben keine Spec (`vitest.config.ts`,
  »the demo pages themselves are left to the preview generator«). Den Vertrag hält die Spec
  von `DemoParts`, der Fall »lets go of the parts kept before a part that throws as it is
  built« bildet den Befund nach. Rot vor dem Fix ist der Fall der Kerzen.
- **Kein CHANGELOG**: das Lookbook wird nicht veröffentlicht, die Library ändert sich nicht.
  Kein neues Vorschaubild nötig, kein Bild ändert sich.
- **Paket 15b** (abgeteilt): dieselbe Ursache wie `stage-masks-frozen.astro` in 33 weiteren
  Seiten — 25 mit `onDemoInit()` (`animated-sprites`, `boomer-shooter-corridor`,
  `camera-rig-into-the-map`, `camera-rig-two-rooms`, `first-sprite`, `platformer`,
  `rope-bridge`, `sine-scroller`, `sprite-reflection`, `stage-masks-flashlight`,
  `stage-masks-heat-haze`, `stage-masks-matte-3d`, `stage-masks-matte-ink`,
  `stage-masks-matte-threshold`, `stage-masks-portal`, `stage-masks-resolution`,
  `stage-masks-rift`, `stage-masks-shared`, `stage-masks-spotlight`,
  `stage-masks-without-director`, `stage-post-process-etching`, `stage-transitions-gallery`,
  `stage-transitions-game-menu`, `textured-sprites`, `ui-panels`) und 8 mit einem
  `start(async …)`-Callback (`animated-billboards`, `atlas-frames-on-meshes`,
  `cardboard-parade`, `swaying-grass`, `textured-quads`, `textured-quads-from-texture-atlas`,
  `textured-quads-from-tileset`, `vector-balls`). Abgeteilt aus demselben Grund wie 9/9c:
  rund 33 mechanische Umstellungen sollen im Review nicht neben dem neuen Helfer und den
  Einzelkorrekturen stehen.
- **Neuer Nebenbefund, nicht in diesem Paket**: elf Seiten nehmen Listener per
  `removeEventListener()` ab, `README.md:87–90` verlangt das `signal` eines
  `AbortController`. Andere Ursache (Form der Abnahme, nicht ihr Zeitpunkt; die Listener
  gehen ab), deshalb in »Offene Befunde«; `stage-masks-frozen.astro` stellt dieses Paket
  mit um, weil die Seite in Schritt 3 zum Beispiel der README wird.

## Nebenbefunde im Volltext (aus »Offene Befunde«)

- `apps/lookbook/src/pages/demos/stage-masks-frozen.astro:44, 162`: wirft ein
  Szenen-Konstruktor nach `loadChapelAssets()` (`atlasFrame()` in
  `Head`/`SeanceRoom`/`ChapelWall`, `new SeanceClock()`), wird `assets.store` nie
  freigegeben, weil `display.onDispose(…)` erst am Ende der Init registriert wird (aus
  Paket 9, vorbestehend laut `git show 2e3f585b:…:161`; low) → Scope
- `apps/lookbook/src/demos/stage-masks/MothChapel.ts:257`
  (`centre.divideScalar(layout.candles.length)`): eine `room.json` ohne Kerzen macht die
  Lichtrichtung der Köpfe zu NaN; weder `checkRoomJson` noch `SeanceClock` prüfen das (aus
  Paket 9, vorbestehend laut `git show 2e3f585b:…:593`; low) → Scope
- `apps/lookbook/src/demos/stage-transitions/matteMasks.ts:13`: importiert `SoftBlobs` aus
  `../stage-masks/` gegen die Regel im Kopf von `stage-masks/helpers.ts` (keine Szene
  importiert aus dem Modul eines fremden Demos) (aus Paket 9, vorbestehend laut
  `git show 2e3f585b:…:12`; low) → Scope
- `apps/lookbook/src/demos/stage-transitions/matteMasks.ts:125`:
  `this.#noise.image.data as Uint8Array` — Cast ohne Typgrund im Code (aus Paket 9,
  vorbestehend laut `git show 2e3f585b:…:121`; info) → Scope
- `apps/lookbook/src/demos/swaying-grass/SwayingMeadow.ts:281-285` (`#growMeadow()`): eine
  eigene `frame`-Closure schreibt die Ausnahme von `atlasFrame()` nach (Subjekt
  `swaying-grass`, Name ohne `JSON.stringify`), statt `atlasFrame(atlas, 'SwayingMeadow',
  name)` aus `~demos/utils/atlasFrame` zu rufen (aus Paket 9c, vorbestehend; info) → Scope
- `apps/lookbook/src/demos/stage-masks/CrawlRig.ts:240`: `readonly #q = new Vector2();` steht
  zwischen den Methoden statt bei den übrigen Feldern (aus Paket 9, vorbestehend laut
  `git show 2e3f585b:…:236`; info) → Scope
