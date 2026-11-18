# Paket 9 — Lookbook: Testoberfläche, Demo-Logik und Masken-Szenen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-009 (low), BUG-011 (low), BUG-012 (low), BUG-013 (low), CONS-004 (low), CONS-009 (low), TYPE-001 (low), READ-004 (low), COMP-001 (low), BUG-030 (info) — READ-003 in Zug 0 nach Paket 9b abgeteilt, die Stellen gleicher Ursache von TYPE-001, CONS-004 und CONS-009 in den übrigen Demos nach Paket 9c (Gründe unter »Entscheidungen aus Zug 0«)
- Ziel: Das Lookbook hat einen Vitest-Lauf im Gate für seine Logik-Helfer, und die Demos rechnen Layout, Licht, Übergänge und Zufall richtig und deterministisch, ohne Material-Casts in der Mottenkapelle und mit benannten Atlas-Frames in den Stage-Transitions-Szenen.
- Modell: stärkste Stufe
- Effort: medium — jeder Schritt steht mit Dateien, Namen, Code und Meldungstexten da; die Breite (Nx-, Vitest- und Catalog-Konfiguration, fünf Regressionstests, zwei Helfer nach `~demos/utils` samt Importumstellung in 14 Szenen, Doku in drei Dateien) ist der Grund für die Modellstufe, nicht eine offene Frage
- Dateien (alle Pfade unter `apps/lookbook/` relativ dazu, sofern nicht vom Repo-Root aus genannt):
  - Konfiguration: `pnpm-workspace.yaml` (Root), `packages/twopoint5d/package.json` (nur `devDependencies`), `apps/lookbook/package.json`, `apps/lookbook/project.json`, neu `apps/lookbook/vitest.config.ts`, `pnpm-lock.yaml` (Root, von `pnpm install`), `.gitignore` (Root)
  - neu `src/demos/utils/seededRandom.ts`, `src/demos/utils/atlasFrame.ts`
  - geändert `src/demos/utils/checkJson.ts`, `src/demos/utils/fetchAsset.ts`, `src/demos/stage-masks/helpers.ts`, `src/demos/stage-masks/CrawlRig.ts`, `src/demos/stage-masks/TransitionCycler.ts`, `src/demos/stage-masks/MothChapel.ts`, `src/pages/demos/stage-masks-frozen.astro`, `src/demos/stage-transitions/GalleryScene.ts`, `GameLevel.ts`, `TitleMenu.ts`, `Starfield.ts`, `matteMasks.ts`, `glowLayerBuilder.ts`
  - nur Importzeilen: `src/demos/stage-masks/Crawlspace.ts`, `CrematoriumWindow.ts`, `DeepListening.ts`, `FoundFootage.ts`, `InkWell.ts`, `MirrorShatter.ts`, `PaintedMoor.ts`, `PaintingHallway.ts`, `RiftMembrane.ts`, `Trench.ts`, `WardC.ts`, `WardRig.ts`
  - neue Specs: `src/demos/utils/seededRandom.spec.ts`, `atlasFrame.spec.ts`, `checkJson.spec.ts`, `fetchAsset.spec.ts`, `src/demos/stage-masks/helpers.spec.ts`, `CrawlRig.spec.ts`, `TransitionCycler.spec.ts`, `MothChapel.spec.ts`
  - Doku: `AGENTS.md` (Root), `docs/architecture.md` (Root), `apps/lookbook/README.md`
- Nicht anfassen: alles unter `packages/twopoint5d/src/`, `packages/twopoint5d/CHANGELOG.md` und die Guides der Library (keine öffentliche Änderung der Library: der Catalog-Umzug von `vitest` betrifft nur `devDependencies`); `.github/workflows/`; `scripts/`; die Vorschaubilder des Lookbooks (kein `pnpm lookbook:generate-previews` — es schreibt Binärdateien und braucht einen Browser); der Aufbau von `MothChapel.ts` jenseits der in den Schritten genannten Stellen (Teilung, Mesh-Bündel und Frame-Sampler sind Paket 9b); die Casts, `atlas.frame(…)!` und `Math.random()` in Demos außerhalb der hier genannten Dateien (Paket 9c); jedes `createSprite()!` (Grund unter »Entscheidungen aus Zug 0«)
- Verify: `pnpm run ci`
- Commit: `fix(lookbook): run the specs of the lookbook's logic helpers in the gate, refuse a séance board without its marks or with another count of heads as it loads, aim the flashlight from its lens, end a run of the transition cycler that the slider or a restart takes over, pass on a fault of a json check as it is, map a plane to a frame from the uv it was built with, name a missing atlas frame in the stage transition scenes and draw their random from a seeded generator, type the meshes of the moth chapel and the glow builder without casts, and keep constants ahead of the classes that read them`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · alle Findings unverändert, das Lookbook ist seit `2e3f585b` nur in `README.md` geändert (`git diff --stat 2e3f585b HEAD -- apps/lookbook`); Fundstellen unter »Abgleich« · READ-003 nach Paket 9b abgeteilt · Stellen gleicher Ursache in den übrigen Demos (20 Casts, 7 `frame(…)!`, 13 Dateien mit `Math.random()`) nach Paket 9c · Folgen der Pakete 1–8: keine offen · aus »Offene Befunde« nichts übernommen (kein Eintrag teilt eine Ursache mit dem Lookbook)
  - 2026-11-18 Zug 1: Implementierer beauftragt (opus, effort medium) · Brief `paket-9.impl-0.brief.txt`, Report `paket-9.impl-0.json` im Arbeitsverzeichnis
  - 2026-11-18 Zug 2: Report FERTIG · 34 Dateien geändert, 11 neu (vitest.config.ts, seededRandom.ts, atlasFrame.ts, 8 Specs) · rote Läufe für BUG-030, COMP-001, BUG-012, BUG-013 (2), BUG-011 (3) belegt · Coverage gemessen 71,47/62/75/72,26 → Schwellen 69/60/73/70 · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-9.verify.log`; Coverage dort aus dem Nx-Cache, ungecacht nachgeprüft: `paket-9.coverage-nocache.log` exit=0, 39 Tests)
  - 2026-11-18 Zug 3: Reviewer (opus, effort medium) · alle zehn Findings behoben, kein kritischer, kein wichtiger Befund, drei kleine · Diff `paket-9.diff`, Report `paket-9.review-0.json`
  - 2026-11-18 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-18 Zug 5: Commit 4cf5fc5e mit Trailer `Remediation-Run: 2026-11-17` · Verify aus Zug 2 (keine Änderung seither) · 45 Pfade · fünf Nebenbefunde nach »Offene Befunde«, alle vorbestehend (gegen `2e3f585b` geprüft), Urteil → Scope: die Scope-Regel nimmt jede Severity

## Urteil des Reviewers

- TEST-009 behoben: `apps/lookbook/project.json:3` (Tag `ci`), `:32–50` (Targets `test`, `coverage`), `apps/lookbook/package.json:15–16`, `apps/lookbook/vitest.config.ts:35` (Schwellen), `pnpm-workspace.yaml:15, 20`
- BUG-011 behoben: `MothChapel.ts:301–314` (Prüfung im Konstruktor, Flicker aus dem Layout), `:286` (`turn = TURNS.map(…)`), Aufrufer `stage-masks-frozen.astro:48`, Test `MothChapel.spec.ts:38–55`
- BUG-012 behoben: `CrawlRig.ts:144–145` (dieselbe Formel wie `#place()` `:206`), Test `CrawlRig.spec.ts:92–99`
- BUG-013 behoben, auch in `restart()`: `TransitionCycler.ts:175–181` (`#cancelRunning`), `:100`, `:115`, Tests `TransitionCycler.spec.ts:83–103`
- CONS-004 behoben: `GalleryScene.ts:107`, `GameLevel.ts:116, 119`, `TitleMenu.ts:44`, Helfer `utils/atlasFrame.ts:7–11`
- CONS-009 behoben: `Starfield.ts:21, 40, 64, 80`, `GameLevel.ts:39, 79, 125, 176, 178`, `matteMasks.ts:91, 104, 127`
- TYPE-001 behoben: `MothChapel.ts:72–73` (`PlaneMesh`), alle fünf `dispose()` ohne Cast, `glowLayerBuilder.ts:18–34` (`Object.assign`)
- READ-004 behoben: `CrawlRig.ts:63–64`, `MothChapel.ts:25` (`min`), `:758`, `min2` entfernt
- COMP-001 behoben: `helpers.ts:70–94` (`WeakMap` je uv-Attribut), Test `helpers.spec.ts:138–147`
- BUG-030 behoben: `checkJson.ts` (`JsonCheckError`, von `refuse()` geworfen), `fetchAsset.ts` (nur `JsonCheckError` gilt als Ablehnung der Datei), Test `fetchAsset.spec.ts` »passes on a TypeError that a fault of the check throws, unwrapped«

Kleine Befunde (keine Runde):
- `apps/lookbook/vitest.config.ts:20` und `apps/lookbook/README.md:208–209`: Kommentar und README-Regel (»a new module with a spec goes into that list«) passen nicht zu `MothChapel.ts`, das eine Spec hat und bewusst nicht in `coverage.include` steht; ein Halbsatz zur Ausnahme fehlt — erledigt sich, wenn Paket 9b `SeanceClock.ts` aufnimmt
- `AGENTS.md:156`: die geänderte Zeile ist nicht neu umbrochen (über 110 Zeichen, die Datei bricht bei etwa 90 um)
- Commit-Message: nennt `min` statt `min2` nur halb und den Umzug von `SeededRandom`/`atlasFrame` nach `~demos/utils` samt Catalog-Eintrag nicht

Abweichungen des Implementierers (Report): Importe von Hand sortiert (`biome.jsonc:66` `organizeImports: "off"`); `toThrow` statt `toThrowError` (ts6385 deprecated); Flicker-Kommentar in `SeanceRoom` über `const lamps = [...]`; `from`/`to`/`start` in `#movePlanchette()` ohne Annotation, abgeleitet als `readonly [number, number]`; Spec-Helfer `without()` und `uvOf()`.

Begründung der Urteile zu den Nebenbefunden: Die Scope-Regel nimmt alles, jede Severity; keiner kippt eine Entscheidung oder sprengt ein Paket. Keiner teilt die Ursache von 9b (Teilung) oder 9c (Material-Casts in `dispose()`, `frame(…)!`, `Math.random()`): der `image.data`-Cast in `matteMasks.ts:125` ist kein Material-Cast.

## Abgleich

Alle Zeilen gegen `HEAD` = `e97f246c` gelesen.

- **TEST-009** unverändert: `apps/lookbook/package.json:6–15` hat kein `test`-Script, im Lookbook gibt es keine Spec, `apps/lookbook/project.json` trägt nur den Tag `app`. Wichtig für den Weg: das Gate (`ci:gate` in der Root-`package.json`) ruft `test:coverage` (`nx run-many -t coverage`), nicht `test:ci`; ein `test`-Target allein mit Tag `ci` liefe in `pnpm test:ci`, aber weder in `pnpm run ci` noch im CI-Workflow (`.github/workflows/ci.yml:56–57`).
- **BUG-011** unverändert: `MothChapel.ts:281` (`turn = [0, 0, 0, 0]`), `:294–295` (`constructor(layout, lights)`, Flicker-Zahl von außen), `:324` (`this.flicker[i]!`, Audit `:325`), `:329–330` (`for (let i = 0; i < 4; i++)` / `TURNS[i]!`, Audit `:331`), `:379–383` (`#markOf` wirft im Frame), `:558`, `:571`, `:576` (`clock.flicker[i]!`), `:650` (`clock.turn[i]!`); der Aufrufer `src/pages/demos/stage-masks-frozen.astro:48–49` rechnet `lamps` selbst. `room.json` trägt heute die Marken `0–9`, `A–Z`, `YES`, `NO`, `GOOD BYE`, 4 Köpfe, 3 Kerzen, 2 Ständer.
- **BUG-012** unverändert: `CrawlRig.ts:141` zielt von `player.x + player.facing * 20`, `#place()` (`:202`) setzt die Linse auf `player.x + player.facing * layout.lens.x`; `layout.json` hat `lens.x = 88`. `this.lens.y` (aus dem letzten `#place()`) ist konstant (`layout.floorY + PLAYER_CENTER_ABOVE_FLOOR + layout.lens.y`) und bleibt.
- **BUG-013** unverändert: `TransitionCycler.ts:93–101` (`setScrub()` ruft `cancel('end')`, setzt `#running = undefined`, beginnt neu), `:179–184` (der `then`-Handler ruft `onEnd` nur bei `#running === t`). Dieselbe Ursache steht in `restart()` (`:108–113`, `cancel('start')`, dann `#begin(true)`): auch dort hört die Seite `onBegin` des neuen Laufs ohne `onEnd` des alten. Die Seiten setzen in `onBegin` einen Zustand, den `onEnd` zurücknimmt (`stage-masks-matte-ink.astro:98–106` `edge.running`, `stage-masks-matte-threshold.astro:137–145` `hud.running`).
- **CONS-004** unverändert: `GalleryScene.ts:106`, `GameLevel.ts:111`, `:116`, `TitleMenu.ts:43` (`assets.ships.frame(…)!`). `atlasFrame()` steht in `stage-masks/helpers.ts:103–107`.
- **CONS-009** unverändert: `Starfield.ts:60`, `:76`, `GameLevel.ts:119`, `:170`, `:172`, `matteMasks.ts:123`. `SeededRandom` und `randomAt` stehen in `stage-masks/helpers.ts:18–55`. Das Vorschaubild der Gallery zeigt `luma mask: spiral` (`stage-transitions-gallery.astro:201–205`), nicht das Rauschen.
- **TYPE-001** unverändert: `MothChapel.ts:413`, `:531`, `:656`, `:687` (Audit `:688`), `:860`; `glowLayerBuilder.ts:18–33` (`… as GlowLayerBuilder`, `dispose` danach zugewiesen).
- **READ-003** unverändert: `MothChapel.ts` 871 Zeilen, `#add` wortgleich `:638–644` und `:815–821`, Sampler `:584` und `:787` — nach Paket 9b.
- **READ-004** unverändert: `CrawlRig.ts:246–247` (`PLAYER_CENTER_ABOVE_FLOOR` nach der Klasse), `MothChapel.ts:866–871` (`min2` nach `ChapelWall`). `min` und `max` haben in `@types/three` 0.187 denselben Typ `MinMax` (`nodes/math/MathNode.d.ts:453–454`): für `min2` gibt es keinen Typgrund.
- **COMP-001** unverändert: `stage-masks/helpers.ts:116–127`; Aufrufer `Crawlspace.ts:227`, `DeepListening.ts:183`, je einmal auf frischer Geometrie.
- **BUG-030** unverändert: `utils/fetchAsset.ts:47–52` unterscheidet nur über `instanceof TypeError`. Kein Check außerhalb von `checkJson.ts` wirft selbst einen `TypeError` (`grep -rn "new TypeError\|JsonCheck<" apps/lookbook/src`).

## Entscheidungen aus Zug 0

- **Paket 9b abgeteilt (READ-003).** Die Teilung von `MothChapel.ts` verschiebt rund 870 Zeilen; im selben Diff stünden die Verhaltensänderungen an `SeanceClock` (BUG-011), die Mesh-Typen (TYPE-001) und `min2` (READ-004). Derselbe Grund wie bei 6/6b: Verschiebungen sollen im Review nicht neben Verhaltensänderungen in derselben Datei stehen. Paket 9 ändert die Datei an Ort und Stelle, 9b verschiebt danach.
- **Paket 9c abgeteilt (gleiche Ursache, übrige Demos).** In Zug 0 gefunden, vorbestehend (das Lookbook ist seit `2e3f585b` unberührt): Material-Casts in `dispose()` an 20 Stellen in 17 Dateien, `atlas.frame(…)!` an 7 Stellen in 6 Dateien, `Math.random()` in 13 weiteren Dateien. Gleiche Ursache gehört in dieses Paket; zusammen mit TEST-009 und vier Bugfixes wäre es nicht mehr reviewbar. Die Fundstellen stehen im Plan unter 9c.
- **`createSprite()!` bleibt.** CONS-004 nennt es in Klammern, die Empfehlung nicht. Ein fehlender Frame kommt aus einer Datei (`spaceships.json`) und braucht eine Meldung mit Szene und Namen; `createSprite()` antwortet `undefined` nur bei vollem Pool, die Kapazitäten sind hier gleich der Zahl der Aufrufe, und die Library warnt dann selbst einmal mit dem Namen der `FeatureSprites`. Keine gleiche Ursache.
- **TEST-009 über ein `coverage`-Target.** Das Lookbook bekommt `test` (Tag `ci`: `pnpm test`, `pnpm test:ci`) **und** `coverage`; nur `coverage` erreicht das Gate und den CI-Job »Unit tests with coverage«, ohne dass Root-Skripte oder Workflow sich ändern. `coverage` misst wirklich (v8, Schwellen gemessen, abgerundet, minus zwei — die Regel der Library). `coverage.include` nennt die getesteten Module einzeln: ein Glob über `src/demos/**` zöge die Schwellen mit Shader-Code ohne Spec in den Keller.
- **`vitest` und `@vitest/coverage-v8` in den Catalog.** Ab hier nennen zwei Manifeste beide Werkzeuge; die Regel in `AGENTS.md` (»Shared dependency versions«) und `docs/architecture.md` §5 verlangt dann den Catalog.
- **`vitest.config.ts`, nicht `vite.config.ts`.** Der Name sagt, wer die Datei liest; Astro liest sie nicht. Weil `vitestDefaults` (`nx.json`) nur `vite.config.*` kennt, nennen die beiden Targets des Lookbooks `{projectRoot}/vitest.config.ts` selbst als Input; `nx.json` bleibt unberührt.
- **BUG-013 auch in `restart()`.** Gleiche Ursache, drei Zeilen daneben (Abgleich). Entscheidung 2 des Plans verlangt den Code-Fix für `setScrub()`; derselbe private Schritt deckt `restart()`, damit jedes `onBegin` sein `onEnd` hat.
- **COMP-001 als Code-Fix** (Entscheidung 2: bei zwei Wegen der Code-Fix): `setPlaneUvToFrame()` liest die uv aus einer Kopie, die es beim ersten Aufruf je uv-Attribut zieht, und ist damit wiederholbar.
- **BUG-012 mit `layout.lens.x`** (erster Weg der Empfehlung): dieselbe Formel wie `#place()`, ohne sich auf die Reihenfolge der Aufrufe zu verlassen.
- **BUG-011:** die Prüfung sitzt im Konstruktor von `SeanceClock`, der die Marken, `TURNS` und die Lampen kennt; die Zahl der Flicker leitet er aus `layout.candles.length + layout.stands.length` ab, der Parameter `lights` entfällt.
- **CONS-004/CONS-009:** `atlasFrame()` und `SeededRandom`/`randomAt` ziehen nach `~demos/utils/`, statt dass die Stage-Transitions-Szenen aus `../stage-masks/helpers` importieren (die Regel im Kopf von `helpers.ts`: keine Szene importiert aus dem Modul eines fremden Demos). Die Meldung von `atlasFrame()` schreibt den Namen durch `JSON.stringify()`: `describeValue()` ist nicht öffentlich, und `JSON.stringify()` maskiert einen Namen so, wie `checkJson.ts` (`jsonOneOf`) schon heute zitiert.
- **CONS-009 BoilingNoise:** ein eigener `SeededRandom` je Instanz statt `Math.random()`. Das Rauschen kocht weiter mit der Zeit, aber jede Seite zieht dieselbe Folge; das Vorschaubild der Gallery zeigt es nicht (Abgleich), ein eigener Preview-Zweig ist deshalb unnötig.

## Vorgehen

Reihenfolge einhalten: Schritt 1 schafft die Testoberfläche, auf der die
Regressionstests der Schritte 3–7 **zuerst rot** laufen, bevor der Fix kommt.
Jeder rote Lauf (Kommando, Testname, Ausgabe) gehört in den Report. Ein
Einzellauf: `pnpm nx test lookbook -- src/demos/<pfad>.spec.ts` (oder in
`apps/lookbook`: `pnpm vitest --run src/demos/<pfad>.spec.ts`).

Alle Specs importieren aus `vitest` ausdrücklich (`import {describe, expect, it, vi} from 'vitest'`), keine Globals; Code, Kommentare, Testnamen und Meldungen auf Englisch.

### 1. Vitest-Lauf für das Lookbook (TEST-009)

a. `pnpm-workspace.yaml`, Block `catalog:`, alphabetisch einsortieren:
   `'@vitest/coverage-v8': ^5.1.0` (nach `'@types/three'`) und `vitest: ^5.1.0` (nach `typescript`). Der Kommentar über dem Block (»The others are tools that more than one manifest names.«) bleibt wahr und bleibt.

b. `packages/twopoint5d/package.json`, `devDependencies`: `"@vitest/coverage-v8": "catalog:"`, `"vitest": "catalog:"`.

c. `apps/lookbook/package.json`:
   - `scripts`: `"test": "pnpm vitest --run"`, `"coverage": "pnpm vitest --run --coverage"` (nach `assets:check` oder an passender Stelle; die Reihenfolge der übrigen bleibt)
   - `devDependencies`: `"@vitest/coverage-v8": "catalog:"`, `"vitest": "catalog:"`, alphabetisch

d. `pnpm install` am Root ausführen; `pnpm-lock.yaml` ändert sich nur in den Specifiern und den neuen Einträgen des Lookbooks. Kein Versionssprung: beide stehen heute auf 5.1.0.

e. `apps/lookbook/project.json`: `"tags": ["app", "ci"]`, dazu unter `targets`:

   ```json
   "test": {
     "inputs": [
       "vitestDefaults",
       "{projectRoot}/vitest.config.ts",
       "{projectRoot}/src/**/*",
       {"dependentTasksOutputFiles": "**/*", "transitive": true}
     ]
   },
   "coverage": {
     "dependsOn": ["^build"],
     "cache": true,
     "inputs": [
       "vitestDefaults",
       "{projectRoot}/vitest.config.ts",
       "{projectRoot}/src/**/*",
       {"dependentTasksOutputFiles": "**/*", "transitive": true}
     ],
     "outputs": ["{projectRoot}/coverage"]
   }
   ```

   `test` erbt `dependsOn: ["^build"]` und den Executor aus `targetDefaults`; `coverage` läuft über das gleichnamige Script (wie beim `coverage` der Library). Die Specs importieren `@spearwolf/twopoint5d` aus `dist/` (`atlasFrame.spec.ts`, `helpers.spec.ts`, `MothChapel.spec.ts`), daher `^build` und die Build-Ausgabe als Input.

f. Neu `apps/lookbook/vitest.config.ts`:

   ```ts
   import {fileURLToPath} from 'node:url';
   import {defineConfig} from 'vitest/config';

   // the aliases of tsconfig.json, which Astro resolves for the pages and Vitest does not read
   const alias = (dir: string): string => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

   export default defineConfig({
     resolve: {
       alias: {'~components': alias('components'), '~demos': alias('demos'), '~layouts': alias('layouts')},
     },
     test: {
       // the specs of the logic helpers, next to their modules; the demo pages themselves are left to
       // the preview generator
       include: ['src/**/*.spec.ts'],
       environment: 'node',
       restoreMocks: true,
       unstubGlobals: true,
       coverage: {
         provider: 'v8',
         // the modules a spec holds, named one by one: a glob over src/demos would count the shader code
         // of every scene, which no spec reaches, and pull the thresholds down with it
         include: [
           'src/demos/utils/atlasFrame.ts',
           'src/demos/utils/checkJson.ts',
           'src/demos/utils/fetchAsset.ts',
           'src/demos/utils/seededRandom.ts',
           'src/demos/stage-masks/CrawlRig.ts',
           'src/demos/stage-masks/helpers.ts',
           'src/demos/stage-masks/TransitionCycler.ts',
         ],
         reporter: ['text-summary'],
         // two points under the level measured when they were set — the measured percentage rounded
         // down, minus two —, as in packages/twopoint5d/vite.config.ts: a regression turns the gate
         // red, a line that moves does not
         thresholds: {statements: 0, branches: 0, functions: 0, lines: 0},
       },
     },
   });
   ```

   Die vier Schwellen setzt Schritt 11 nach der Messung; `0` ist nur der Platzhalter bis dahin und steht im fertigen Diff nicht mehr. `MothChapel.ts` steht bewusst nicht in `include` (Shader-Bau der Stages); Paket 9b nimmt das dann eigene `SeanceClock.ts` auf. Meldet `astro check` (`pnpm typecheck`) `node:url` als unbekannt, kommt `/// <reference types="node" />` als erste Zeile dazu — `@types/node` ist schon `devDependency` des Lookbooks.

g. `.gitignore` (Root): unter `packages/*/coverage` die Zeile `apps/*/coverage`. Biome ignoriert `**/coverage` schon (`biome.jsonc:9`).

h. Probe, dass beide Targets laufen: `pnpm nx run lookbook:test` und `pnpm nx run lookbook:coverage` (noch ohne Specs scheitert Vitest an »No test files found« — das ist erwartet, bis Schritt 2 die erste Spec anlegt; die Probe gehört nach Schritt 2).

### 2. Geteilte Helfer nach `~demos/utils` (Vorbedingung für CONS-004 und CONS-009)

a. Neu `src/demos/utils/seededRandom.ts`: `STEP`, `mix32()`, `SeededRandom` und `randomAt` aus `stage-masks/helpers.ts:18–55` **wortgleich** verschieben, samt TSDoc; exportiert werden `SeededRandom` und `randomAt` wie bisher.

b. Neu `src/demos/utils/atlasFrame.ts`:

   ```ts
   import type {TextureAtlas, TextureAtlasFrame} from '@spearwolf/twopoint5d';

   /**
    * The frame `name` of `atlas`; a frame the atlas lacks throws, with `subject` — the module of the
    * scene — as the first word of the message.
    */
   export function atlasFrame(atlas: TextureAtlas, subject: string, name: string): TextureAtlasFrame {
     const frame = atlas.frame(name);
     // JSON.stringify() quotes the name as checkJson.ts quotes a value: a quote or a line break in it stays visible
     if (!frame) throw new Error(`${subject}: the atlas has no frame ${JSON.stringify(name)}`);
     return frame;
   }
   ```

c. `src/demos/stage-masks/helpers.ts`: `STEP`, `mix32`, `SeededRandom`, `randomAt` und `atlasFrame` entfernen, den Import von `TextureAtlas` streichen, wenn er danach ungenutzt ist. Der Kommentar im Kopf (`:13–16`) sagt danach: die Helfer, die jede Demo braucht — der Zufall mit Seed, der benannte Atlas-Frame, das Laden und Prüfen der Dateien —, liegen unter `~demos/utils/`; dieses Modul hält, was die Szenen der Stage-Masks-Demos untereinander teilen, und die Regel (keine Szene importiert aus dem Modul eines fremden Demos) bleibt.

d. Importe umstellen, keine Re-Exporte aus `helpers.ts`:
   - `SeededRandom` und/oder `randomAt` aus `'~demos/utils/seededRandom'`: `CrawlRig.ts:3`, `CrematoriumWindow.ts:15`, `DeepListening.ts:50`, `FoundFootage.ts:41`, `InkWell.ts:21`, `MirrorShatter.ts:24`, `MothChapel.ts:54`, `PaintedMoor.ts:32`, `RiftMembrane.ts:5`, `Trench.ts:30`, `WardRig.ts:3`
   - `atlasFrame` aus `'~demos/utils/atlasFrame'`: `Crawlspace.ts:60`, `DeepListening.ts:50`, `FoundFootage.ts:41`, `MothChapel.ts:54`, `PaintingHallway.ts:51`, `WardC.ts:28`
   - der Rest jeder dieser Importzeilen bleibt bei `'./helpers'`. Biome sortiert Importe (`pnpm format` danach).

e. Neu `src/demos/utils/seededRandom.spec.ts`: zwei `SeededRandom` mit gleichem Seed liefern dieselbe Folge; ein anderer Seed eine andere; `randomAt(seed, i)` ist für `i = 0 … 9` der Wert des `(i + 1)`-ten `next()` eines frischen `new SeededRandom(seed)`; `next()` liegt in `[0, 1)`; `range(min, max)` in `[min, max)`.

f. Neu `src/demos/utils/atlasFrame.spec.ts`: ein `TextureAtlas` der Library (Runtime-Import aus `@spearwolf/twopoint5d`) mit einem benannten Frame, angelegt wie in `packages/twopoint5d/src/texture/TextureAtlas.spec.ts`; `atlasFrame()` gibt diesen Frame; ein fehlender wirft `Error` mit genau `GalleryScene: the atlas has no frame "ship-99"`; ein Name mit Anführungszeichen erscheint maskiert (`"a\"b"`).

g. Jetzt die Probe aus 1h.

### 3. BUG-030: nur die Ablehnung eines Checks ist ein Fehler der Datei

a. **Erst der Test, rot.** Neu `src/demos/utils/fetchAsset.spec.ts`, `fetch` per `vi.stubGlobal('fetch', vi.fn(…))` mit `new Response(…)` (Node 24 hat `Response`):
   - Regressionstest `passes on a TypeError that a fault of the check throws, unwrapped`: ein Check `() => { throw new TypeError('a fault of the check'); }`; `fetchJson('MothChapel', 'room.json', check)` lehnt mit **genau diesem** Fehler ab (`rejects.toBe(error)`). Vor dem Fix rot (er kommt umhüllt als `MothChapel: room.json is not what MothChapel reads: …`).
   - dazu, schon vor dem Fix grün: ein abgelehnter Wert (`jsonNumber` auf `"4"`) lehnt ab mit `MothChapel: room.json is not what MothChapel reads: the root must be a number, got "4"`, `cause` ist der Fehler des Checks; ein Body, der kein JSON ist, mit `MothChapel: room.json is no JSON` und `SyntaxError` als `cause`; `fetchText` mit einem `fetch`, der ablehnt: `MothChapel: room.json could not be fetched`, `cause` ist der Grund; Status 404: `MothChapel: room.json answered 404`; ein Check, der etwas anderes als einen `TypeError` wirft (`RangeError`), kommt unverändert durch.

b. **Fix**, `src/demos/utils/checkJson.ts`:

   ```ts
   /**
    * The refusal of a check: the value at a path of the file is not what the caller reads.
    * `fetchJson()` reports it as a fault of the file; anything else a check throws, a `TypeError` of
    * its own code included, is a fault of the check.
    */
   export class JsonCheckError extends TypeError {
     override name = 'JsonCheckError';
   }
   ```

   `refuse()` wirft `new JsonCheckError(…)` mit unverändertem Text. TSDoc von `JsonCheck<T>` (`:14–18`): »… or throws a `JsonCheckError` that reads `<where> must be <what>, got <value>`«. Jeder Check der Datei läuft schon über `refuse()`; nichts sonst ändert sich.

c. `src/demos/utils/fetchAsset.ts:47–52`: `if (!(cause instanceof JsonCheckError)) throw cause;`, Import `JsonCheckError` (Wert-Import neben `type JsonCheck`). Kommentar darüber: »a check refuses with a JsonCheckError (see `JsonCheck`); anything else, a TypeError of its own code included, is a fault of the check, not of the file, and passes on as it is«. TSDoc von `fetchJson()` (`:24–35`): »… and the `JsonCheckError` of the check as its `cause` …«, »Anything else a check throws — a `TypeError` of its own code included — is a fault of the check …«.

d. Neu `src/demos/utils/checkJson.spec.ts`: je Check ein angenommener Wert (zurückgegeben wie übergeben) und eine Ablehnung mit genauer Meldung — `jsonNumber` (`the root must be a number, got "4"`), `jsonString`, `jsonOneOf('a', 'b')` (`… must be one of "a", "b", got "c"`), `jsonList` (Pfad `[1]`), `jsonTuple` (`… must be a list of 2, …`), `jsonRecord` (Pfad `a.b`), `jsonObject` (fehlendes Feld: `x must be a number, got nothing`; verschachtelt `eyes[1].x`); `show()` kürzt nach 40 Zeichen mit `…`; jede Ablehnung ist `instanceof JsonCheckError` **und** `instanceof TypeError`.

### 4. COMP-001: `setPlaneUvToFrame()` ist wiederholbar

a. **Erst der Test, rot.** Neu `src/demos/stage-masks/helpers.spec.ts`:
   - Regressionstest `maps a plane to a second frame from the uv it was built with, not from the first frame`: `new PlaneGeometry(1, 1, 1, 2)`, zwei `TextureCoords` der Library (Runtime-Import; `new TextureCoords(new TextureCoords(0, 0, 256, 256), x, y, w, h)` — die Form aus `packages/twopoint5d/src/texture/TextureCoords.ts:85–94`), Aufruf erst mit A, dann mit B; das uv-Array gleicht dem einer frischen Plane, die nur B bekam. Vor dem Fix rot.
   - dazu: ein Aufruf bildet die Ecken der Plane aufrecht auf den Frame ab (oben links der Plane = `s`, `t`; unten rechts = `s + u`, `t + v`); `needsUpdate` steigt (`uv.version` wächst).
   - `smoothstepCpu`: `0` bis `e0`, `1` ab `e1`, `0.5` in der Mitte.

b. **Fix**, `src/demos/stage-masks/helpers.ts`:

   ```ts
   /** the uv of each plane as the plane built it, copied at the first call that maps it */
   const builtUv = new WeakMap<BufferAttribute | InterleavedBufferAttribute, Float32Array>();
   ```

   In `setPlaneUvToFrame()`: das uv-Attribut holen; liegt für es keine Kopie vor, `Float32Array(uv.count * 2)` mit `getX(i)`/`getY(i)` füllen und ablegen; dann `uv.setXY(i, s + built[2 * i]! * u, t + (1 - built[2 * i + 1]!) * v)`. Schlüssel ist das Attribut, nicht die Geometrie: ein ersetztes uv-Attribut bekommt seine eigene Kopie. TSDoc ergänzen: »A second call — the next frame of an animation — maps from the uv the plane was built with, not from the one the call before wrote.« Typ-Importe `BufferAttribute`, `InterleavedBufferAttribute` aus `three/webgpu`.

### 5. BUG-012: der Lichtkegel zielt von der Linse

a. **Erst der Test, rot.** Neu `src/demos/stage-masks/CrawlRig.spec.ts` mit einem `CrawlLayout`, inline als typisiertes Objekt (`lens: {x: 88, y: 4}`, `floorY: -150`, `playerRange: 400`, `cameraRange: 300`, die übrigen Felder mit kleinen gültigen Werten). Regressionstest `aims the beam at the pointer from the lens, where the layout puts it`: `const rig = new CrawlRig(layout)`; einen Zielpunkt `aimAt = (rig.lens.x + 100, rig.lens.y + 100)` wählen, den Zeiger daraus rückrechnen — `rig.input.pointer = new Vector2((aimAt.x - rig.camera.x) / rig.view.x, (aimAt.y - rig.camera.y) / rig.view.y)` —, `rig.update(1 / 60)`, erwartet `rig.aim` ≈ `Math.PI / 4` (`toBeCloseTo(…, 9)`). Vor dem Fix rot (≈ 0,537, weil von `player.x + 20` aus gezielt wird). Alle Zahlen aus `rig.lens` und `rig.camera` ableiten, nicht hart verdrahten.

b. **Fix**, `CrawlRig.ts:141`: `this.aim = Math.atan2(aimAt.y - this.lens.y, aimAt.x - (player.x + player.facing * layout.lens.x));` mit dem Kommentar »from the lens, as `#place()` puts it: the player has not moved yet in this update«.

### 6. BUG-013: jedes `onBegin` hat sein `onEnd`

a. **Erst der Test, rot.** Neu `src/demos/stage-masks/TransitionCycler.spec.ts`. Kein DOM: `vi.stubGlobal('window', {addEventListener: vi.fn(), removeEventListener: vi.fn()})`. Fakes, per `as unknown as Display` / `as unknown as StageDirector` übergeben:
   - `display`: `{onRenderFrame: vi.fn(() => () => {})}`
   - `director`: `{stack: [a], replace(from, to, opts)}`; `replace` legt eine Fake-Transition an und gibt sie zurück: `{from, to, manual: opts.manual, progress: 0, elapsed: 0, duration: opts.duration, finished, cancel(jumpTo = 'start')}`. `cancel()` setzt bei `'end'` synchron `director.stack[0] = to` (sonst `from`) und löst `finished` mit der Transition auf; ein Helfer `finish(t)` tut dasselbe für »läuft von selbst aus«.
   - Optionen: `stages: [a, b]`, `names: ['A', 'B']`, `settings: {duration: 1, easing: 'linear', cycle: false, scrub: false, progress: 0.5}`, `hold: 1`, `effect: () => ({}) as StageTransitionEffect`, `progress: () => 0`, `progressName: 'p'`, `onBegin` und `onEnd` schreiben in ein gemeinsames Protokoll-Array (`'begin'`, `'end'`).
   - Regressionstests, beide vor dem Fix rot:
     - `ends a run by the clock that the slider takes over, before the run by hand begins`: `play()`, dann `settings.scrub = true; setScrub()` → Protokoll `['begin', 'end', 'begin']`, sofort (synchron); nach `await` der Microtasks (`await Promise.resolve()` zweimal oder `await` auf das `finished` des ersten Laufs) **kein** zweites `'end'`.
     - `ends a run by hand that restart() begins anew`: `holdAt(0.5)` (Lauf von Hand), dann `restart()` → `['begin', 'end', 'begin']`.
   - dazu: ein Lauf, der von selbst ausläuft (`finish(t)`), ruft `onEnd` einmal, nach den Microtasks; `setScrub()` mit `scrub = false` beendet einen Lauf von Hand über `cancel()`, `onEnd` kommt einmal über `finished`; `dispose()` nimmt den Listener ab (`removeEventListener` mit derselben Funktion wie `addEventListener`) und ruft die Abmeldung von `onRenderFrame`.

b. **Fix**, `TransitionCycler.ts`: ein privater Schritt

   ```ts
   /**
    * Ends the run on the screen by hand: it leaves the slot as `cancel(jumpTo)` sets it, and the page
    * hears `onEnd` now, before the next run begins; its `finished` comes later and finds another run,
    * or none, and calls no `onEnd` of its own.
    */
   #cancelRunning(jumpTo: 'start' | 'end'): void {
     const running = this.#running;
     if (!running) return;
     running.cancel(jumpTo);
     this.#running = undefined;
     this.#options.onEnd?.();
   }
   ```

   `setScrub()`, Zweig `scrub`: `this.#cancelRunning('end'); this.#begin(true);`. `restart()`: `if (!this.#running?.manual) return; this.#cancelRunning('start'); this.#begin(true);`. Der Zweig ohne `scrub` und der `then`-Handler in `#begin()` bleiben. TSDoc von `onEnd` (`:40`): »called as the run on the screen ends — by itself, by `cancel()`, or as the slider takes it over or a restart begins it anew —, before the next `onBegin` and before the readouts are written: every `onBegin` has its `onEnd`«. TSDoc von `setScrub()` und `restart()` um »the page hears `onEnd` of the run that ends« ergänzen.

### 7. BUG-011: die Séance prüft Brett und Köpfe beim Laden

a. **Erst der Test, rot.** `MothChapel.ts`: `interface HeadJson` und `interface RoomJson` werden `export interface` (nur Typen; die Spec braucht sie). Neu `src/demos/stage-masks/MothChapel.spec.ts` (`describe('SeanceClock')`), ein `RoomJson` inline: Marken `I`, `S`, `E`, `Y`, `O`, `U`, `GOOD BYE` (Werte beliebig, verschieden), 4 Köpfe, 3 Kerzen, 2 Ständer, `lights: []`. Regressionstests, alle drei vor dem Fix rot:
   - `refuses a board without a mark the planchette spells, as it is built`: Marke `S` fehlt → `new SeanceClock(layout)` wirft `Error` mit genau `new SeanceClock(): the board of room.json has no mark "S"`; ebenso ohne `GOOD BYE` (`… no mark "GOOD BYE"`).
   - `refuses another count of heads than the séance turns, as it is built`: 3 Köpfe → `new SeanceClock(): room.json has 3 heads, and the séance turns 4`.
   - `holds one flicker per candle and stand of the layout`: `clock.flicker.length === 5`.
   - dazu: über eine ganze Runde (`update(0.1)` bis 46 s) sind jeder Flicker-Wert, jedes `turn[i]`, `planchetteX`, `planchetteY` endlich, und `turn.length === 4`.
   Vor dem Fix hat der Konstruktor zwei Parameter; die Spec ruft ihn mit einem (Vitest prüft keine Typen, `lights` ist dann `undefined`, und die Flicker-Liste bleibt leer — rot).

b. **Fix**, `MothChapel.ts`, Klasse `SeanceClock`:
   - `constructor(layout: RoomJson)`; der Parameter `lights` entfällt.
   - zuerst die Köpfe: `if (layout.heads.length !== TURNS.length) throw new Error(\`new SeanceClock(): room.json has ${layout.heads.length} heads, and the séance turns ${TURNS.length}\`);`
   - dann die Marken, einmal aufgelöst: eine lokale Funktion `markOf(name)` liest `layout.board.marks[name]` und wirft bei Fehlen `new Error(\`new SeanceClock(): the board of room.json has no mark ${JSON.stringify(name)}\`)`; `this.#spell = SPELL.map(markOf)` (`readonly #spell: readonly (readonly [number, number])[]`), `this.#bye = markOf('GOOD BYE')`. `#marks` und `#markOf()` entfallen.
   - die Flicker: `const lamps = layout.candles.length + layout.stands.length;` mit dem Kommentar »one flicker per lamp, the candles first and then the stands: the order SeanceRoom lights them in«.
   - `readonly turn = TURNS.map(() => 0);` (TSDoc bleibt), `update()`: `for (let i = 0; i < TURNS.length; i++)`.
   - `#movePlanchette()`: `this.#spell[step - 1]!`, `this.#spell[step]!`, `this.#spell[SPELL.length - 1]!`, `this.#bye`; die Prüfung `SPELL[step] === SPELL[step - 1]` (die zweite E) bleibt auf den Buchstaben. Typen von `from`/`to`/`start` auf `readonly [number, number]` anpassen.
   - `SeanceRoom`: bei `:558` ein Kommentar »the clock holds one flicker per lamp of this layout«; bei `#update()` (`:650`) »one head per head of room.json, as many as the clock turns: its constructor refuses another count«.
   - `src/pages/demos/stage-masks-frozen.astro:48–49`: `const lamps = …` entfällt, `const clock = new SeanceClock(assets.layout);`.

### 8. CONS-004: Atlas-Frames der Stage-Transitions über `atlasFrame()`

Import `import {atlasFrame} from '~demos/utils/atlasFrame';`, Subjekt ist der Modul-/Klassenname:
- `GalleryScene.ts:106`: `const frame = atlasFrame(assets.ships, 'GalleryScene', look.ship);`
- `GameLevel.ts:111`: `this.#player.setFrame(atlasFrame(assets.ships, 'GameLevel', 'ship-00'));`; `:116`: den Frame **vor** der Schleife holen (`const enemyFrame = atlasFrame(assets.ships, 'GameLevel', 'ship-02');`) und in der Schleife `sprite.setFrame(enemyFrame)`
- `TitleMenu.ts:43`: `this.#ship.setFrame(atlasFrame(assets.ships, 'TitleMenu', 'ship-01'));`

### 9. CONS-009: Zufall der Stage-Transitions mit Seed

Import `import {SeededRandom} from '~demos/utils/seededRandom';`, je Klasse ein privates Feld, je Datei eine Konstante mit TSDoc:
- `Starfield.ts`: `/** the seed of the sky: the same stars on every run, and on every card the preview generator takes */ const STAR_SEED = 3;`, Feld `readonly #random = new SeededRandom(STAR_SEED);`; `:60` `x: (this.#random.next() - 0.5) * SPREAD_X, y: (this.#random.next() - 0.5) * SPREAD_Y`; `:76` `star.x = (this.#random.next() - 0.5) * SPREAD_X;`
- `GameLevel.ts`: `/** the seed of the enemies: every page opens on the same wave; a new game draws on from it */ const LEVEL_SEED = 5;`, Feld `readonly #random = new SeededRandom(LEVEL_SEED);`; `:119` `phase: this.#random.next() * Math.PI * 2`; `#respawn()` `:170` `(this.#random.next() - 0.5) * (this.#halfWidth * 2 - 80)`, `:172` `50 + this.#random.next() * 50`. `reset()` zieht weiter aus demselben Generator, kein neuer Seed.
- `matteMasks.ts`, `BoilingNoise`: `/** the seed of the noise: it boils on with its time, and every page draws the same boils */ const NOISE_SEED = 7;`, Feld `readonly #random = new SeededRandom(NOISE_SEED);`; `:123` `texels[i] = texels[i + 1] = texels[i + 2] = this.#random.next() * 255;`. Der TSDoc der Klasse bleibt (»the noise is drawn again several times a second«).

Kein Test: die Szenen bauen `FeatureSprites` und `Stage2D`; der Generator selbst ist in Schritt 2 getestet.

### 10. TYPE-001: getypte Meshes in `MothChapel.ts`, Glow-Builder ohne Cast

a. `MothChapel.ts`: nach `type Vec2Node` (`:68`) `/** a plane with a node material: every mesh of the chapel */ type PlaneMesh = Mesh<PlaneGeometry, MeshBasicNodeMaterial>;`
   - `ChapelVoid#plane`, `Head#mesh`, `SeanceRoom#meshes` (`PlaneMesh[]`), `SeanceRoom#planchette`, `SeanceRoom#add(mesh: PlaneMesh, …)`, `GlassTint#plane`, `ChapelWall#meshes`, `ChapelWall#add(mesh: PlaneMesh, …)`, `interface Moth { mesh: PlaneMesh; … }` auf `PlaneMesh`
   - in jedem `dispose()` (`:413`, `:531`, `:656`, `:687`, `:860`) `….material.dispose()` ohne Cast
   - `new Mesh(new PlaneGeometry(…), material)` schließt die Typen schon; wo `astro check` widerspricht, den Typ am `new Mesh<PlaneGeometry, MeshBasicNodeMaterial>(…)` nennen, nie einen Cast

b. `glowLayerBuilder.ts`: den Builder als Funktion bauen und `dispose` mit `Object.assign` anhängen, ohne Cast:

   ```ts
   const build = (passes: Node[]): Node => { … };
   return Object.assign(build, {
     dispose(): void {
       last?.dispose();
       last = undefined;
     },
   });
   ```

   Der Rumpf von `build` bleibt wortgleich, auch der Kommentar und der Cast `passes as Node<'vec4'>[]` (er ist begründet: der Renderer reicht seine Pässe als `Node`; nicht Teil des Findings).

### 11. READ-004: Konstanten vor die Klassen, `min` statt `min2`

- `CrawlRig.ts`: `PLAYER_CENTER_ABOVE_FLOOR` samt TSDoc (`:246–247`) nach oben zu den exportierten Konstanten, direkt nach `VENT_DEPTH` (`:60–61`); Wert und Export bleiben.
- `MothChapel.ts`: `min2` (`:866–871`) entfällt; `min` aus `three/tsl` importieren (alphabetisch zwischen `max` und `mix`), `:744` `const edge = min(min(lx, span.sub(lx)), min(ly, course.sub(ly)));`. `abs` bleibt importiert, wenn es noch gebraucht wird (`flameMaterial`, `#ectoplasm`).

### 12. Schwellen messen, Doku

a. `pnpm nx run lookbook:coverage --skip-nx-cache`, die vier Prozente ablesen, je abrunden und zwei abziehen; in `vitest.config.ts` eintragen (Platzhalter `0` weg). Die Messwerte in den Report.

b. `AGENTS.md`:
   - Absatz zu den Nx-Tags: `ci` (Vitest suite) bleibt; die Projekttabelle unverändert.
   - Kommandos: `pnpm test:coverage` — »the library's Vitest suite once with coverage, held to the thresholds in `packages/twopoint5d/vite.config.ts`, without the allocation specs, and the specs of the lookbook's logic helpers, held to those in `apps/lookbook/vitest.config.ts`«; die Zeile »one Vitest file« um `pnpm nx test lookbook -- src/demos/utils/checkJson.spec.ts` ergänzen.
   - »Shared dependency versions«: die Liste der Catalog-Werkzeuge um `vitest` und `@vitest/coverage-v8` ergänzen.
   - »Two test surfaces«: `*.spec.ts` liegen neben ihrem Modul in der Library **und** unter `apps/lookbook/src/demos/` (die Logik-Helfer des Lookbooks; die Demo-Seiten prüft der Vorschau-Generator).

c. `docs/architecture.md`:
   - §1 Tabelle: `lookbook` mit den Tags `app`, `ci`.
   - §2: der Absatz »The library's `project.json` adds the target `coverage`, which no other project has …« wird zu: die Library und das Lookbook haben ein `coverage`-Target; das des Lookbooks läuft über `apps/lookbook/vitest.config.ts` (Vitest liest es, Astro nicht; `vitestDefaults` kennt nur `vite.config.*`, daher nennen seine Targets die Datei selbst), misst die einzeln genannten Logik-Module und hängt über `^build` an der Build-Ausgabe der Library. Die Ausgabe der Library archiviert der CI-Workflow, die des Lookbooks nicht.
   - §3, `test:coverage`: auch die Specs des Lookbooks, gegen die Schwellen in `apps/lookbook/vitest.config.ts`, nach derselben Regel (gemessen, abgerundet, minus zwei).
   - §5: die Liste der Catalog-Werkzeuge um `vitest` und `@vitest/coverage-v8`.
   - §6: ein Punkt für Vitest in `apps/lookbook` (Tag `ci`): die Logik-Helfer der Demos als `*.spec.ts` neben ihrem Modul, unter Node ohne DOM; die Demo-Seiten bleiben beim Vorschau-Generator.

d. `apps/lookbook/README.md`, Abschnitt »Checks«: ein Absatz zu `pnpm nx test lookbook` (die Specs der Logik-Helfer unter `src/demos/`, Vitest, ohne DOM) und `pnpm nx run lookbook:coverage` (läuft im Gate über `pnpm test:coverage`, Schwellen in `vitest.config.ts`); dazu der Satz, dass ein neues Modul mit Spec in `coverage.include` gehört.

e. Kein Eintrag in `packages/twopoint5d/CHANGELOG.md`: nichts Öffentliches der Library ändert sich.

### 13. Abschluss

- `pnpm format`, dann `pnpm lint` und `pnpm typecheck` (das prüft die Specs und `vitest.config.ts` mit `astro check`); kommt dabei ein Fehler aus Node-Typen, die die Typen von Vitest in das Programm des Lookbooks ziehen, an einer Stelle, die ein Timer-Ergebnis als `number` hält: dort `ReturnType<typeof setTimeout>` (in Zug 0 keine solche Stelle gefunden).
- `pnpm run ci` als Ganzes.
- Jede geänderte Datei vor dem Verlassen ganz lesen und melden, was darin falsch ist und nicht zum Paket gehört.

## Findings im Volltext

**TEST-009 · low · apps/lookbook/package.json:6** — Lookbook ohne Testoberfläche
Das Lookbook hat kein `test`-Script und keine Specs. Die Remediation-Pakete, die Demo-Module und -Seiten geändert haben, konnten ihre Fixes nur über Proben außerhalb der Versionierung rot/grün belegen; ein späterer Umbau der geteilten Helfer (`apps/lookbook/src/demos/stage-masks/helpers.ts`, `apps/lookbook/src/demos/utils/fetchAsset.ts`, `checkJson.ts`) bleibt ungesichert. Aufgefallen im Remediation-Lauf vom 2026-10-31.
Empfehlung: Für die reinen Logik-Helfer des Lookbooks (Zufall, Layout-Checks, Asset-Laden) einen Vitest-Lauf mit Nx-Tag `ci` einrichten; die Demo-Seiten selbst bleiben beim Vorschau-Generator.

**BUG-011 · low · apps/lookbook/src/demos/stage-masks/MothChapel.ts:381** — Layout-Invarianten der Séance beim Laden prüfen statt im Frame-Loop
Weitere Fundstellen: `MothChapel.ts:325`, `:331`, `:558`, `:650`.
checkRoomJson prüft nur die Form der room.json. Dass das Brett die Marken I, S, E, Y, O, U und GOOD BYE trägt, dass es genau vier Köpfe gibt (SeanceClock.turn und TURNS sind fest auf 4 verdrahtet) und dass die Zahl der Flacker-Uniforms der Zahl der Kerzen plus Ständer entspricht (die Zahl kommt als eigener Parameter lights von der Seite), wird erst im Frame-Loop sichtbar: #markOf wirft rund zwei Sekunden nach dem Start aus update(), und turn[i]! bzw. flicker[i]! liefern bei Abweichung undefined, das als NaN in die Uniforms läuft. Die Non-null-Assertions verdecken das für den Typchecker.
Beleg: `this.turn = [0, 0, 0, 0]` (:281), `clock.turn[i]!` (:650), `clock.flicker[i]!` (:558), `throw new Error(`SeanceClock: the board has no mark ...`)` (:381)
Empfehlung: Im SeanceClock-Konstruktor (oder in loadChapelAssets) einmal prüfen: alle Marken aus SPELL plus GOOD BYE vorhanden, heads.length === TURNS.length, und den Parameter lights aus layout.candles.length + layout.stands.length selbst ableiten statt ihn von der Seite zu übernehmen. Ein Fehler beim Laden nennt den Grund früh.

**BUG-012 · low · apps/lookbook/src/demos/stage-masks/CrawlRig.ts:141** — Zielursprung des Lichts in CrawlRig aus layout.lens ableiten
Weitere Fundstelle: `CrawlRig.ts:202`.
Beim Zielen mit dem Zeiger geht der Strahl von player.x + facing * 20 und der y-Position der Linse des Vorframes aus. Die Linse selbst sitzt bei player.x + facing * layout.lens.x. Weicht layout.lens.x von 20 ab, zeigt der Lichtkegel neben den Zeiger; die 20 ist eine Magic Number, die die Layout-Datei doppelt.
Beleg: `Math.atan2(aimAt.y - this.lens.y, aimAt.x - (player.x + player.facing * 20))` gegenüber `this.lens.set(player.x + player.facing * layout.lens.x, ...)`
Empfehlung: layout.lens.x statt 20 verwenden (oder #place() vor dem Zielen aufrufen und this.lens.x lesen).

**BUG-013 · low · apps/lookbook/src/demos/stage-masks/TransitionCycler.ts:94** — onEnd in TransitionCycler auch beim Abbruch durch setScrub aufrufen oder Vertrag klarstellen
Weitere Fundstellen: `TransitionCycler.ts:97`, `:181`.
onEnd ist als called as the run on the screen ends dokumentiert. setScrub() bricht einen laufenden Uhrenlauf mit cancel('end') ab und setzt #running auf undefined, bevor finished aufgelöst wird; der then-Handler sieht #running !== t und überspringt onEnd. Wer in onEnd Zustand der Seite zurücksetzt, verpasst genau dann das Ende, wenn der Nutzer mitten im Lauf auf Scrub schaltet.
Beleg: `this.#running?.cancel('end'); this.#running = undefined;` und `if (this.#running === t) { this.#running = undefined; this.#options.onEnd?.(); }`
Empfehlung: onEnd im Zweig von setScrub() ausdrücklich aufrufen, oder die Doku auf run that ends by itself or by hand einschränken.

**CONS-004 · low · apps/lookbook/src/demos/stage-transitions/GalleryScene.ts:106** — Atlas-Frames in den Stage-Transitions-Szenen über einen benennenden Helfer holen
Weitere Fundstellen: `GameLevel.ts:111`, `GameLevel.ts:116`, `TitleMenu.ts:43`.
Die Stage-Masks-Szenen holen Frames über atlasFrame(atlas, subject, name), das bei fehlendem Frame mit Subjekt und Namen wirft. Die Stage-Transitions-Szenen schreiben atlas.frame(name)! (und createSprite()!); fehlt ein Frame in spaceships.json, folgt ein TypeError ohne Hinweis auf Szene oder Namen mitten im Konstruktor. Die Regel der Repo-Fehlermeldungen (Subjekt zuerst) gilt hier nicht.
Beleg: `const frame = assets.ships.frame(look.ship)!;`
Empfehlung: atlasFrame aus stage-masks/helpers (oder eine eigene Variante in stage-transitions/assets.ts) verwenden; die Szene soll nicht von der Datei eines fremden Demos importieren, daher den Helfer besser in ~demos/utils verschieben.

**CONS-009 · low · apps/lookbook/src/demos/stage-transitions/Starfield.ts:60** — Zufall der Stage-Transitions-Demos deterministisch machen wie in den Stage-Masks
Weitere Fundstellen: `Starfield.ts:76`, `GameLevel.ts:119`, `GameLevel.ts:170`, `matteMasks.ts:123`.
Die Stage-Masks-Demos (SeededRandom, randomAt) und die InkBlots (fester Hash, Kommentar: the same ink every run) sind bewusst reproduzierbar. Starfield, GameLevel und BoilingNoise nehmen Math.random(). Die Vorschaubilder der Demos entstehen mit pnpm lookbook:generate-previews gegen den echten Lauf; bei jeder Neugenerierung ändern sich Sternenfeld, Gegnerpositionen und Rauschen, und das committete WebP wechselt ohne inhaltlichen Grund.
Beleg: `x: (Math.random() - 0.5) * SPREAD_X` (Starfield.ts:60) gegenüber `// a fixed hash instead of Math.random(): the same ink every run` (matteMasks.ts:48)
Empfehlung: Die Startpositionen von Starfield und GameLevel aus dem vorhandenen SeededRandom aus ../stage-masks/helpers ziehen (oder einen Seed pro Demo reichen); das Rauschen der BoilingNoise darf zufällig bleiben, wenn es mit der Zeit tanzen soll, sollte dann aber im Preview-Modus festgesetzt werden.

**TYPE-001 · low · apps/lookbook/src/demos/stage-masks/MothChapel.ts:413** — Material-Casts durch typisierte Meshes ersetzen
Weitere Fundstellen: `MothChapel.ts:531`, `:656`, `:688`, `:860`, `stage-transitions/glowLayerBuilder.ts:28`.
mesh.material wird in jedem dispose() mit as MeshBasicNodeMaterial auf den erwarteten Typ gezwungen; #meshes ist Mesh[] ohne Material-Typ. In glowLayerBuilder.ts wird eine Funktion ohne dispose als GlowLayerBuilder gecastet und dispose erst danach zugewiesen, so dass der Typchecker die Lücke nicht sieht.
Beleg: `(this.#plane.material as MeshBasicNodeMaterial).dispose();`
Empfehlung: Mesh<PlaneGeometry, MeshBasicNodeMaterial> als Feld- und Array-Typ verwenden; im Glow-Builder Object.assign(fn, {dispose}) oder eine Funktion mit angehängtem dispose ohne Cast bauen.

**READ-004 · low · apps/lookbook/src/demos/stage-masks/CrawlRig.ts:247** — Konstanten und Helfer vor die Klassen ziehen, die sie benutzen
Weitere Fundstelle: `MothChapel.ts:867`.
PLAYER_CENTER_ABOVE_FLOOR steht nach der Klasse, die sie in #place() liest; min2 steht nach ChapelWall, dessen Konstruktor ihn aufruft. Das funktioniert nur, weil die Klasse erst nach der Moduleauswertung instanziiert wird, und liest sich gegen die Ordnung der übrigen Konstanten am Dateianfang. min2 baut zudem min() aus add/sub/abs nach, obwohl max aus three/tsl im selben Import steht, ohne Kommentar zum Grund.
Beleg: `export const PLAYER_CENTER_ABOVE_FLOOR = 52;` (Dateiende) und `const min2 = (a, b) => a.add(b).sub(abs(a.sub(b))).mul(0.5)`
Empfehlung: Beide Definitionen nach oben holen; min2 durch min aus three/tsl ersetzen oder den Grund (falls einer besteht) in einem Kommentar nennen.

**COMP-001 · low · apps/lookbook/src/demos/stage-masks/helpers.ts:122** — Nicht idempotenten Vertrag von setPlaneUvToFrame dokumentieren
setPlaneUvToFrame liest die vorhandenen uv der PlaneGeometry (0 bis 1) und überschreibt sie mit s + u*uv. Ein zweiter Aufruf auf derselben Geometrie, etwa für einen Frame-Wechsel, würde die schon abgebildeten Werte noch einmal abbilden und ein falsches Rechteck zeigen. Die beiden Aufrufer (Crawlspace.ts:227, DeepListening.ts:183) rufen es einmal pro frischer Geometrie auf, der Vertrag steht aber nirgends.
Beleg: `uv.setXY(i, s + uv.getX(i) * u, t + (1 - uv.getY(i)) * v)`
Empfehlung: Im TSDoc festhalten, dass die Geometrie unberührt sein muss; oder die Normalform (0 bis 1) aus einer Kopie der Ausgangs-uv lesen.

**BUG-030 · info · apps/lookbook/src/demos/utils/fetchAsset.ts:50** — `fetchJson()` meldet einen TypeError aus einem fehlerhaften Check als Ablehnung des Jsons
`fetchJson()` unterscheidet die Ablehnung eines `JsonCheck` von einem Fehler im Check selbst allein am Typ: ein Check lehnt mit einem `TypeError` ab, alles andere wird unverändert weitergeworfen. Ein `TypeError`, den ein Programmierfehler im Check auslöst (etwa der Zugriff auf eine Eigenschaft von `undefined`), erscheint deshalb als »<url> is not what <subject> reads« und lenkt die Suche auf die Json-Datei statt auf den Check. Aufgefallen im Remediation-Lauf vom 2026-10-31 (Review des Abschlusspakets).
Empfehlung: Die Ablehnung eines Checks über eine eigene Fehlerklasse oder ein Kennzeichen (z. B. `JsonCheckError extends TypeError`) erkennbar machen und nur diese als Ablehnung melden.

**READ-003 · low · apps/lookbook/src/demos/stage-masks/MothChapel.ts:638** — nach Paket 9b abgeteilt, hier nur zur Vollständigkeit
SeanceRoom.#add und ChapelWall.#add sind wortgleich, ebenso die dispose-Schleifen über #meshes; ChapelVoid und GlassTint wiederholen das Muster Plane mit Material plus dispose. Der Atlas-Frame-Sampler steht zweimal inline (Planchette, Motten). Die Datei hält 871 Zeilen mit Asset-Loader, JSON-Schemas, Uhr, fünf Stage-Klassen und Shader-Bau in einem Modul.
Empfehlung: Ein kleines Mesh-Bündel (add/dispose) und einen frameSample(texture, coords)-Helfer in helpers.ts anlegen; MothChapel.ts in Assets/Uhr (SeanceClock) und Stages teilen.
