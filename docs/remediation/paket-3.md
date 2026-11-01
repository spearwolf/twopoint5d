# Paket 3 — Browser-Test-Harness und Abhängigkeiten der Workspace-Pakete

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-005 (low), TEST-006 (low), TEST-007 (low), DEP-001 (low), DEP-002 (low)
- Ziel: Die Browser-Tests teilen ihre Helfer, prüfen, was sie zu prüfen behaupten, laufen nicht
  redundant, nutzen chai 6, und jedes Workspace-Paket deklariert seine Tools.
- Modell: mittlere Stufe (Sonnet)
- Effort: medium
- Dateien:
  - `packages/twopoint5d-testing/test/helpers/fixtures.js`
  - `packages/twopoint5d-testing/test/stage-masks.test.js`
  - `packages/twopoint5d-testing/test/stage-transitions.test.js`
  - `packages/twopoint5d-testing/test/sprites-visible.test.js`
  - `packages/twopoint5d-testing/test/display-fullscreen.test.js`
  - `packages/twopoint5d-testing/web-test-runner.config.js`
  - `packages/twopoint5d-testing/test/*.test.js` — alle 67 Dateien, nur die chai-Importzeile
  - `packages/twopoint5d-testing/package.json`, `packages/twopoint5d/package.json`,
    `apps/lookbook/package.json`, `package.json` (Root), `pnpm-workspace.yaml`, `pnpm-lock.yaml`
  - `.github/dependabot.yml`, `.github/workflows/deploy.yml` (nur Kommentare)
  - `AGENTS.md`, `docs/architecture.md`
- Verify: `pnpm run ci`
- Commit: `test: tighten the browser harness, move it to chai 6 and declare every package's tools`
  (Body: ein Absatz je Thema — Zähler der Node-Builds, Pixel-Zählung und Wachstumstest,
  renderer-freie Dateien und Skip-Liste, chai 6, Tools je Paket und Katalog; ohne Finding-IDs,
  ohne Rückblick auf den Vorzustand, Trailer wie in den Paketen davor)
- Verlauf:
  - 2026-10-31 Zug 0: Detailplan steht · TEST-005 unverändert (`stage-masks.test.js:52-69`,
    `stage-transitions.test.js:45-62`) · TEST-006 unverändert (`sprites-visible.test.js:150-151`)
    · TEST-007 umgeformt: vier Launcher statt der fünf des Audits (schon in d9b648bf vier), fünf
    Native-Tests statt drei, Skip an `display-fullscreen.test.js:48` unverändert; laut Gate-Log
    von Paket 14 überspringt heute kein Launcher einen Native-Test · DEP-001 unverändert, dazu
    `@types/three` in Testpaket und Lookbook, `vitest`/`sinon`/`@types/node` in der Library ·
    DEP-002 unverändert (`package.json:25`, 68 Importzeilen) · Folgen erledigter Pakete: keine
    offen · »Offene Befunde« (drei Advisories im Lockfile): andere Ursache, bleiben in der Queue
    · Restplan unverändert: 4, 5 und 9 schreiben Browser-Tests und kommen nach diesem Paket
  - 2026-10-31 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-3.impl-0.json`
  - 2026-10-31 Zug 2: Report FERTIG · 84 Pfade geändert (6 Manifeste/Lockfile, Harness-Config, fixtures.js, 67 Testdateien, dependabot.yml, deploy.yml, AGENTS.md, docs/architecture.md) · Arbeitsbaum schmutzig · eigener Verify-Lauf `paket-3.verify.log` exit=0 (Browser-Lauf aus dem Nx-Cache des Implementierer-Gates, gleicher Stand; je Launcher 67/56/67/67 Dateien, Skip-Block 1/3/3/3)
  - 2026-10-31 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-3.diff` (2755 Zeilen), Report nach `paket-3.review-0.json`
  - 2026-10-31 Zug 3: Urteil freigeben · alle fünf Findings behoben · 0 kritisch, 0 wichtig, 5 klein · Diff `paket-3.diff`
  - 2026-10-31 Zug 4: entfällt (keine Runde)
  - 2026-10-31 Zug 5: Commit a01acfd1 (79 Dateien), getragen von `paket-3.verify.log` exit=0, seither keine Codeänderung

## Worum es geht

Das Paket räumt die Harness der Browser-Tests (`packages/twopoint5d-testing`) und die
Abhängigkeitsdeklaration aller Workspace-Pakete auf. Fünf Teile, eine Reihenfolge, ein Commit:

- **A** — chai 6 statt `@esm-bundle/chai` (DEP-002). Zuerst, weil jede Testdatei ihre Importzeile
  ändert und alle späteren Teile auf dem neuen Import aufsetzen.
- **B** — jedes Workspace-Paket deklariert seine Tools, gemeinsame Versionen im Katalog
  (DEP-001). Zusammen mit A ein einziges `pnpm install`.
- **C** — `countNodeBuilds()` nach `fixtures.js`, über den öffentlichen Debug-Hook von three, mit
  eingebauter Kalibrierung (TEST-005).
- **D** — `countLit()` statt `diffPixels(x, x).lit`, dazu ein Visible-Test über eine
  Wachstumsgrenze des Pools (TEST-006).
- **E** — renderer-freie Dateien laufen einmal je Engine, eine Liste der übersprungenen Tests am
  Ende jedes Laufs, die Native-Fullscreen-Tests laufen in jedem Launcher statt still zu
  überspringen (TEST-007).

Kein Teil ändert die öffentliche API der Library: kein Eintrag in
`packages/twopoint5d/CHANGELOG.md`. Die neuen `devDependencies` der Library erreichen keinen
Konsumenten — `packages/twopoint5d/package.override.json` setzt `devDependencies` und `scripts`
im veröffentlichten Manifest auf `null` (nachgesehen: `dist/package.json` trägt keines von
beiden).

## Vorgehen

### A — chai 6 (DEP-002)

1. In `packages/twopoint5d-testing/package.json` unter `devDependencies`: `@esm-bundle/chai`
   entfernen, `"chai": "^6.3.0"` und `"@types/chai": "^5.2.3"` eintragen (alphabetisch
   einsortiert). chai 6.3.0 ist ein einziges gebündeltes ESM-Modul ohne Abhängigkeiten
   (`index.js`, `"type": "module"`) und bringt keine Typen mit — nachgesehen im Tarball von
   6.3.0: Dateien `index.js`, `register-*.js`, `package.json`, `README.md`, `LICENSE`. Daher
   `@types/chai`. Beide Releases sind älter als die `minimumReleaseAge` von einem Tag (chai 6.3.0
   vom 2026-09-30).
2. In allen 67 `packages/twopoint5d-testing/test/*.test.js` und in
   `packages/twopoint5d-testing/test/helpers/fixtures.js` die Zeile
   `import {expect} from '@esm-bundle/chai';` durch `import {expect} from 'chai';` ersetzen. Es
   gibt im Repo keine andere Importform (geprüft: 68 Treffer, alle identisch). Sonst nennt nichts
   im Repo `@esm-bundle` (außer dem Plan).
3. Deckt der Wechsel von chai 4 auf 6 einen Unterschied in einer Assertion auf (ein Test, der
   unter chai 4 grün und unter chai 6 rot ist, ohne dass sich die Library geändert hat), wird die
   Assertion im Test an chai 6 angepasst — die Aussage des Tests bleibt dieselbe — und der Fall
   mit Test, Zeile und Grund in den Report geschrieben. `src/` der Library wird dafür nicht
   angefasst.

### B — Tools je Paket, gemeinsame Versionen im Katalog (DEP-001)

Regel, nach der der Nutzer am 2026-10-31 entschieden hat (»jedes Workspace-Paket deklariert die Tools,
die seine Scripts aufrufen, als devDependencies«), hier zu Ende gedacht: ein Paket deklariert, was
seine Scripts aufrufen und was sein Code, seine Specs, Tests und Configs importieren, Typen
eingeschlossen. Die Root deklariert nur, was die Root-Scripts, das Nx-Projekt `scripts/` und die
Workflows an der Root aufrufen. Erst wenn die Root die Tools der Pakete nicht mehr trägt, fällt ein
künftig undeklariertes Tool beim Install auf, statt still aus `node_modules` der Root aufgelöst zu
werden. Ein Tool, das mehr als ein Manifest nennt, steht mit seiner Version im `catalog:` — sonst
driften zwei Ranges auseinander.

1. `pnpm-workspace.yaml`, Block `catalog:` — vier Einträge dazu, mit genau den Ranges, die heute
   in der Root stehen (dann ändert der Install keine aufgelöste Version), alphabetisch zu den
   vorhandenen:
   ```yaml
   catalog:
     '@spearwolf/eventize': ^6.3.0
     '@spearwolf/signalize': ^1.0.0
     '@types/node': ^24.19.2
     '@types/three': ~0.187.0
     playwright: ^1.64.1
     rimraf: ^6.1.3
     three: ~0.187.0
     typescript: ^7.0.2
   ```
   Über dem Block ein Kommentar in zwei Sätzen: die Einträge `three`, `@types/three`,
   `@spearwolf/eventize` und `@spearwolf/signalize` sind die Peers der Library (Ablauf einer
   Hebung: `docs/architecture.md` §5); die übrigen sind Tools, die mehr als ein Manifest nennt.
2. Root `package.json`, `devDependencies` danach genau:
   `@biomejs/biome` (`2.6.3`), `@types/node` (`catalog:`), `@typescript/typescript6`
   (`^6.0.2`), `esbuild` (`^0.28.2`), `nx` (`24.0.1`), `playwright` (`catalog:`), `rimraf`
   (`catalog:`), `semver` (`^7.8.5`), `typescript` (`catalog:`), `yaml` (`^2.9.1`).
   Entfernt aus der Root: `@arethetypeswrong/cli`, `@types/sinon`, `@types/three`,
   `@vitest/coverage-v8`, `publint`, `sinon`, `vitest` — nichts an der Root ruft oder importiert
   sie (geprüft: `scripts/`, `.github/`, Root-Configs; `scripts/checkNameableTypes.mjs:2-3` nennt
   `attw`/`publint` nur im Kommentar). `esbuild` bleibt: es ist nicht Gegenstand dieses Befunds.
   Begründung der Root-Liste: `biome` (`pnpm lint`), `nx`, `rimraf` (`clean`: `rimraf dist`),
   `typescript` (`scripts:typecheck`: `pnpm exec tsc -p scripts/tsconfig.json`), `@types/node`,
   `@typescript/typescript6`, `semver`, `yaml` (Scripts unter `scripts/`), `playwright`
   (`scripts/lookbook/generateDemoPreviews.mjs`, und `ci.yml:117/140/149` ruft
   `pnpm exec playwright` an der Root — der Browser-Cache hängt an dieser Version).
3. `packages/twopoint5d/package.json` bekommt einen Block `devDependencies` (nach
   `peerDependenciesMeta` oder vor `peerDependencies`, wie es zur Datei passt):
   `@arethetypeswrong/cli` (`^0.18.5`, Script `checkPkgTypes`), `@types/node` (`catalog:`,
   `tsconfig.json` hat `types: ["node"]`), `@types/sinon` (`^22.0.2`), `@types/three`
   (`catalog:` — steht schon als optionaler Peer, ein optionaler Peer wird aber nur aufgelöst,
   wenn ihn jemand anderes installiert; der Peer-Eintrag bleibt, er gilt den Konsumenten),
   `@vitest/coverage-v8` (`^5.0.5`, `coverage.provider: 'v8'` in `vite.config.ts`), `publint`
   (`^0.3.25`, Script `lintPkg`), `rimraf` (`catalog:`, Script `clean`), `sinon` (`^22.1.0`,
   Specs), `typescript` (`catalog:`, Scripts `compile`/`typecheck`), `vitest` (`^5.0.5`, Scripts
   und Specs). Die Ranges ohne Katalog sind die, die heute in der Root stehen.
   Nicht dazu: `free-tex-packer-core` und `pngjs`, die
   `src/texture/fixtures/free-tex-packer/generate.mjs` importiert — der README daneben
   (`README.md:26-34`) sagt ausdrücklich, dass sie keine Abhängigkeit des Repos sind und der
   Generator in einem eigenen Projekt läuft.
4. `packages/twopoint5d-testing/package.json`, `devDependencies` dazu: `@types/three`
   (`catalog:` — die Tests und die Code-Blöcke der Doku, die `checkDocSnippets.mjs` von hier aus
   compiliert, lesen die Typen von three), `playwright` (`catalog:` — JSDoc
   `import('playwright').LaunchOptions` in `web-test-runner.config.js:13`; die Version muss die
   sein, deren Browser `pnpm exec playwright install` an der Root holt, und der Katalog hält beide
   gleich), `typescript` (`catalog:`, Script `typecheck`: `pnpm tsc`). Dazu chai aus Teil A.
5. `apps/lookbook/package.json`: `@types/node` auf `catalog:` (gleiche Range wie heute), neu
   `@types/three` (`catalog:` — `astro check` liest die Typen von three, heute aus der Root).
   `typescript` bleibt `^6.0.3`, außerhalb des Katalogs (`astro check`, siehe AGENTS.md »Two
   TypeScripts«).
6. `pnpm install` (einmal, nach A und B). Danach `git diff --stat pnpm-lock.yaml` und den Diff
   lesen: erwartet sind nur Änderungen in `importers` (neue `catalog:`-Specifier, verschobene
   Einträge), der Katalog-Block, `chai@6.3.0` und `@types/chai@5.2.3` samt ihrer Abhängigkeiten
   neu, `@esm-bundle/chai` samt seiner allein von ihm gehaltenen Pakete weg. Ändert sich die
   aufgelöste Version irgendeines anderen Pakets, ist das ein Fehler im Manifest (abweichende
   Range) — beheben, nicht hinnehmen.
7. Fällt das Gate, weil ein Tool oder Typpaket fehlt, das bisher aus der Root kam: das Paket, das
   es braucht, deklariert es (`catalog:`, wenn es dann mehr als ein Manifest nennt) — zurück in
   die Root nur, wenn ein Root-Script, `scripts/` oder ein Workflow an der Root es braucht. Jeden
   solchen Fall mit Datei und Grund in den Report.
8. Kommentare in `.github/dependabot.yml`:
   - Zeilen 3-5: »the four catalog entries in pnpm-workspace.yaml are the peer dependencies of
     the library« → die Peers beim Namen nennen: »the catalog entries three, @types/three,
     @spearwolf/eventize and @spearwolf/signalize are the peer dependencies of the library«;
     der Rest des Satzes (playwright) bleibt. `exclude-patterns` bleiben unverändert — die neuen
     Katalog-Einträge `typescript`, `rimraf`, `@types/node` gehören in die Gruppe `toolchain`,
     `playwright` steht schon in den Ausnahmen.
   - Zeilen 25-27 (typescript): »so this also holds back a major of the root's typescript« →
     »…of the catalog's typescript, which the root, the library and the browser tests use«.
   - Zeilen 31-34 (`@types/node`): »and in both manifests that name it: the root and
     apps/lookbook« → »and in its catalog entry in pnpm-workspace.yaml«.
9. `.github/workflows/deploy.yml:98-99`, Kommentar des Install-Schritts: »the root holds the
   toolchain of the build and the checks« → »the root and the library hold the toolchain of the
   build and the checks«. Der Befehl selbst bleibt.
10. `AGENTS.md`, Abschnitt »Shared dependency versions«: nach dem ersten Satz ergänzen, dass der
    Katalog außerdem jedes Tool hält, das mehr als ein Manifest nennt — `typescript` (7),
    `rimraf`, `@types/node`, `playwright` —, ebenfalls nur dort zu heben. Dazu ein neuer
    Spiegelstrich direkt danach, Wortlaut sinngemäß:
    »**Each package declares what it uses.** A workspace package lists every tool its scripts
    call and every package its code, specs, tests and configs import — type packages included —
    in its own `package.json`. The root lists only what the root scripts, `scripts/` and the
    workflows call at the root. pnpm resolves an undeclared package from the root's
    `node_modules` as long as the root has it, so a missing entry shows only in a filtered
    install like the deploy's.«
11. `docs/architecture.md` §5:
    - Erster Absatz: der Katalog hält die vier Peers und die Tools, die mehr als ein Manifest
      nennt (`typescript` 7, `rimraf`, `@types/node`, `playwright`); ein neuer Absatz danach mit
      der Regel aus Schritt 10 (wer was deklariert, warum die Root die Tools der Pakete nicht
      trägt).
    - Dependabot-Absatz: »The four catalog entries stay out of it« → »The four peer entries of
      the catalog stay out of it«; dass die Tool-Einträge des Katalogs zur Gruppe gehören, ein
      Halbsatz.
    - TypeScript-Absatz: »`typescript` in the root is 7.x« → »The catalog's `typescript` is 7.x
      — the root, the library and the browser tests reference it«; »a major of the root's
      `typescript`« → »of the catalog's `typescript`«.
    - `@types/node`-Absatz, Schluss: »Two manifests name it: the root … Both move together when
      the Node line changes.« → der Katalog hält es für Root, Library und Lookbook (dort hält es
      die Peers von astro, vite und sharp von der neuesten Linie fern — der Grund bleibt
      stehen), sodass alle drei zusammen wechseln.

### C — `countNodeBuilds()` in `fixtures.js` (TEST-005)

Abweichung von der Empfehlung, mit Grund: das Audit empfiehlt, die Kopie nach `fixtures.js` zu
ziehen und den Gegencheck dort zu verankern. Beides geschieht; zusätzlich zählt der Helfer nicht
mehr über das Patchen von `renderer.backend.createNodeBuilder` (intern, nicht typisiert), sondern
über `renderer.debug.onNodeBuilderCreated`. Das ist in three 0.187.0 ein typisiertes Feld
(`@types/three` 0.187.0, `src/renderers/common/Renderer.d.ts:357`:
`onNodeBuilderCreated: ((nodeBuilder: NodeBuilder, object: unknown) => void) | null`), und three
ruft es an genau den beiden Stellen, die `backend.createNodeBuilder()` aufrufen
(`build/three.webgpu.js:17841-17844` in `Nodes#_createNodeBuilder()`, `:18152-18157` in
`Nodes#getForCompute()`) — es zählt also exakt dasselbe. Library und Lookbook setzen den Hook
nirgends (geprüft).

1. In `packages/twopoint5d-testing/test/helpers/fixtures.js`, neuer Abschnitt `// --- node builds ---`
   (nach dem Abschnitt der Pixel-Helfer oder an passender Stelle), Export:
   ```js
   /**
    * Counts the node builders three creates for `renderer` until `stop()` — one per shader build of a
    * render object or a compute node — through `renderer.debug.onNodeBuilderCreated`, which three
    * calls at each of them. Before it counts, it has three compile a material no render object has
    * used yet and throws when that build goes uncounted: a count of 0 then says that a frame built
    * nothing, not that the hook went quiet.
    *
    * @param {WebGPURenderer} renderer
    * @returns {Promise<{count: number, stop: () => void}>}
    */
   export async function countNodeBuilds(renderer) { … }
   ```
   (`WebGPURenderer` als Typ aus `three/webgpu`, per `@import`-JSDoc oder Import — wie es zur
   Datei passt; die Datei hat oben schon ein `/** @import … */`.)
   Ablauf:
   - Kalibrierung: ein `MeshBasicNodeMaterial` (aus `three/webgpu`), dessen
     `customProgramCacheKey` als eigene Property eine Funktion ist, die einen nie wiederholten
     Schlüssel liefert — `` () => `countNodeBuilds probe ${n}` ``, wobei `n` der Stand eines
     Modul-Zählers `let probesBuilt = 0` ist, je Aufruf vorher erhöht (`const n = ++probesBuilt`). three nimmt diesen Schlüssel in den
     Cache-Schlüssel des Render-Objekts (`RenderObject#getMaterialCacheKey()` →
     `Nodes#getCustomProgramCacheKey()`), findet also keinen gecachten `NodeBuilderState` und baut
     einen. Das Material an ein `Mesh` mit `PlaneGeometry(1, 1)` in eine eigene `Scene`, eine
     `OrthographicCamera(-1, 1, 1, -1, 0.1, 10)` mit `position.z = 1`.
   - Während der Kalibrierung den Hook auf eine Funktion setzen, die zählt und einen vorher
     gesetzten Hook weiterruft (`previous?.(builder, object)`); `await
     renderer.compileAsync(scene, camera)` — es zeichnet nichts und stellt den Zustand des
     Renderers wieder her. Im `finally`: Hook zurück auf den vorherigen Wert, Geometrie und
     Material `dispose()`.
   - Zählte die Kalibrierung 0: `throw new Error(…)` mit einem Satz, der sagt, was passiert ist
     und was es bedeutet, etwa: `countNodeBuilds(): three compiled a material it had never seen
     without a call of renderer.debug.onNodeBuilderCreated, so a count of 0 would prove nothing`.
   - Dann den Zähler installieren (zählt, ruft den vorherigen Hook weiter) und
     `{count, stop}` zurückgeben; `stop()` setzt den Hook auf den vorherigen Wert zurück. `count`
     bleibt eine Property, die die Aufrufer als `builds.count` lesen.
2. `stage-masks.test.js`: die lokale `countNodeBuilds()` (Zeilen 52-69, samt Kommentar »as
   stage-transitions.test.js does«) löschen, `countNodeBuilds` aus `./helpers/fixtures.js`
   importieren, Aufruf in `maskedFirstFrame()` (Zeile 252) zu
   `const builds = await countNodeBuilds(display.renderer);`. Der Gegentest
   `'without precompile() the first frame of a masked shape builds nodes: …'` (Zeile 266) bleibt:
   er belegt für diese Form, dass der precompile-Test nicht leer läuft — das kann die generische
   Kalibrierung nicht.
3. `stage-transitions.test.js`: die lokale `countNodeBuilds()` (Zeilen 45-62) löschen, Import
   aus `./helpers/fixtures.js` ergänzen, die drei Aufrufe (Zeilen 234, 254, 274) zu
   `const builds = await countNodeBuilds(display.renderer);`.
4. Kein Test für den Helfer selbst: die Kalibrierung ist sein Test und läuft bei jedem Aufruf.

### D — `countLit()` und Visible über eine Wachstumsgrenze (TEST-006)

1. `fixtures.js`, neben `countColor()`: Export
   ```js
   /**
    * How many pixels of a read-back target are lit: brighter than the black clear color in any
    * channel, by more than 16. Independent of the order in which a backend reads the rows back.
    *
    * @param {ArrayLike<number>} pixels
    * @returns {number}
    */
   export function countLit(pixels) { … }
   ```
   Die Schwelle `> 16` je Kanal ist dieselbe wie die von `lit` in `diffPixels()`. Beide nutzen ein
   gemeinsames nicht exportiertes Prädikat (etwa `isLitAt(pixels, i)`), damit die Schwelle an
   einer Stelle steht; `diffPixels()` behält sein Feld `lit` (sieben Testdateien lesen es, als
   Helligkeit von `a` neben `differing`), und sein TSDoc verweist für eine Zählung ohne Vergleich
   auf `countLit()`.
2. `sprites-visible.test.js:150-151`: `diffPixels(shown, shown).lit` → `countLit(shown)`,
   `diffPixels(hidden, hidden).lit` → `countLit(hidden)`; Import anpassen (`diffPixels` bleibt
   importiert, Zeile 112 nutzt es).
3. Neuer Test in `sprites-visible.test.js` (nach dem zweiten Test), Titel etwa
   `'a sprite hidden before its pool grows stays hidden after the growth, and shown again it is drawn'`:
   - `makeSprites([[-2, 0, 0]], {grow: true})` — Kapazität 1; den Sprite verstecken
     (`visible = 0`, `sprites.spritePool.touchVO(sprite, 'visible')`, `sprites.update()`),
     rendern: `countColor(…, [255, 0, 0])` ist 0.
   - Einen zweiten Sprite bei `[2, 0, 0]` mit `setSize(2, 2)` anlegen — das löst das Wachstum aus
     —, `sprites.update()`, rendern: `sprites.spritePool.capacity` ist 2, genau `SPRITE_PIXELS`
     rote Pixel, und die Stelle des versteckten Sprites (`rgbAt(…, CENTER - 2 * PIXELS_PER_UNIT,
     CENTER)`) ist schwarz.
   - Den ersten wieder zeigen (`visible = 1`, `touchVO` über `sprites.spritePool` — nach dem
     Wachstum neu gelesen, der Guide verlangt das, `docs/sprites.md:1768`), `update()`, rendern:
     `2 * SPRITE_PIXELS` rote Pixel.
   - Die Konsolen-Notiz des ersten Wachstums mit `withSilencedInfo()` aus `fixtures.js`
     unterdrücken (um den `createSprite()`-Aufruf, der wächst), wie `sprites-grow.test.js` es
     für den Log des Laufs tut.
   - Läuft dieser Test rot, ist das ein vorbestehender Fehler der Library: nicht in `src/`
     beheben, sondern mit Ausgabe als Nebenbefund melden und den Test aus dem Diff nehmen.

### E — renderer-freie Dateien, Skip-Liste, Native-Fullscreen (TEST-007)

Gemessen (Gate-Log von Paket 14, `paket-14.verify.log` im Arbeitsverzeichnis): Chromium WebGPU
3 skipped (die drei WebGL-only-Tests in `display-dispose.test.js:370/412/464`), Chromium WebGL2
1 (`display-dispose.test.js:215`, WebGPU-only), Firefox WebGL2 3 (`:215`, `vertex-objects-heap`,
`sprites-picking.test.js:320` ohne `gc`), WebKit WebGL2 2 bei 66/67 Dateien, mit der Heap-Datei 3.
Kein Launcher überspringt einen der fünf Native-Fullscreen-Tests; mit einem Skip dort stünden
mindestens fünf mehr. Auf CI ist die Skip-Zahl unsichtbar, weil `reportTestProgress` dort aus ist
(`web-test-runner.config.js:91`).

1. `display-fullscreen.test.js:46-49`: das `this.skip()` fällt weg. Der `beforeEach` des
   `describe('native')` prüft stattdessen
   `expect(document.fullscreenEnabled, 'document.fullscreenEnabled under this launcher').to.equal(true);`
   mit einem Kommentar: every launcher of `web-test-runner.config.js` offers the Fullscreen API,
   and one that does not fails here instead of passing the native path by unseen. (Pfeilfunktion
   statt `function`, weil `this` nicht mehr gebraucht wird.)
2. `web-test-runner.config.js` — renderer-freie Dateien einmal je Engine:
   - Die vier Launcher werden vor dem `export default` je einmal gebaut und als Konstanten
     gehalten (`chromiumWebGPU`, `chromiumWebGL2`, `firefoxWebGL2`, `webkitWebGL2`, Argumente
     und Kommentare unverändert mitnehmen); `browsers` listet diese vier Konstanten. Der Runner
     dedupliziert Launcher über die Objektidentität (`createTestSessions()` in
     `@web/test-runner-core/dist/runner/createSessionGroups.js` sammelt sie in einem `Set`): eine
     Gruppe mit denselben Objekten startet keinen weiteren Browser.
   - Konstante `RENDERER_FREE_FILES` mit genau diesen elf Pfaden (relativ zum Paket, wie
     `files`):
     `test/display-fullscreen.test.js`, `test/harness-rejections.test.js`,
     `test/pan-control-cursor.test.js`, `test/pan-control-dispose.test.js`,
     `test/pan-control-input.test.js`, `test/pan-control-keys.test.js`,
     `test/pan-control-pointer-target.test.js`, `test/pan-control-stylesheet-root.test.js`,
     `test/pan-control-switch-off.test.js`, `test/stylesheets.test.js`,
     `test/texture-store-on.test.js`.
     Kommentar darüber mit dem Kriterium: a file belongs here when none of its tests renders,
     reads a pixel back or asserts anything about the renderer or its backend. A `Display` it
     builds still initializes its renderer under the backend of the launcher (the constructor
     calls `renderer.init()`), but serves the test as an element with a size. Such a file runs
     once per engine: Chromium under WebGPU — the launcher that leaves a page as a user's
     Chromium has it —, Firefox and WebKit.
     Bewusst nicht drin: `display-constructor.test.js` (baut und entsorgt echte Renderer und
     prüft deren Freigabe), `display-stylesheets.test.js`, `hello-twopoint5d-canvas.test.js`,
     `map2d-visibility-helpers.test.js` (rufen `display.start()` bzw. rendern).
   - `files: ['test/**/*.test.js', ...RENDERER_FREE_FILES.map((file) => `!${file}`)]` und
     `groups: [{name: 'renderer-free', files: RENDERER_FREE_FILES, browsers: [chromiumWebGPU,
     firefoxWebGL2, webkitWebGL2]}]`. Ohne `--group` läuft die Default-Gruppe und jede Gruppe
     (`parseConfig()` in `@web/test-runner/dist/config/parseConfig.js`); `files` geht durch
     globby, `!`-Muster schließen aus.
   - Der Kommentar über `browsers` (Zeilen 94-98, »Every test file runs under both backends …«)
     sagt danach: every test file that starts a renderer runs under all four launchers; the files
     of `RENDERER_FREE_FILES` run under three.
3. `web-test-runner.config.js` — Liste der übersprungenen Tests:
   - Funktion `skippedTestsReporter()` in der Config (JSDoc: lists every skipped test at the end
     of a run, by launcher — on CI as well, where the progress report and its count are off — so
     a test that skips where it ought to run shows in the log of a green run). Sie gibt ein
     Reporter-Objekt mit `stop({sessions})` zurück: je `session.browser.name` die übersprungenen
     Tests sammeln — `session.testResults` (kann `undefined` sein, wenn eine Datei nicht lud)
     rekursiv über `suites` und `tests` gehen, `test.skipped === true`, Name als
     `<Datei relativ zu process.cwd()> › <Suite> › … › <Test>` —, dann mit `console.log` einen
     Block ausgeben: Kopfzeile `Skipped tests:`, je Launcher eine Zeile `  <name>: <Anzahl>` (auch
     bei 0), darunter je Test eine eingerückte Zeile. Launcher in der Reihenfolge von `browsers`
     bzw. alphabetisch — Hauptsache stabil.
   - `reporters: [defaultReporter({…unverändert…}), skippedTestsReporter()]`.
   - `import path from 'node:path';` oben, falls für den relativen Pfad gebraucht.
4. `fixtures.js:36-38`, TSDoc von `expectedBackend()`: »and every test file runs once per
   backend« → »and a test file that starts a renderer runs under every one of them«.
5. Doku:
   - `AGENTS.md:16` (Tabelle »Projects«): »each file under WebGPU and under WebGL 2« → »each file
     that renders under WebGPU and under WebGL 2«.
   - `AGENTS.md:177-179` (»Two test surfaces«): »every file under WebGPU and under WebGL 2« →
     dasselbe, dazu ein Satz: a file none of whose tests renders runs once per engine and goes
     into `RENDERER_FREE_FILES` in `web-test-runner.config.js`.
   - `docs/architecture.md` §3, Absatz ab Zeile 247 (»The browser suite runs every test file in
     four browsers …«): ergänzen, dass die Dateien aus `RENDERER_FREE_FILES` einmal je Engine
     laufen (Chromium WebGPU, Firefox, WebKit) und warum; neuer kurzer Absatz zur Skip-Liste am
     Ende jedes Laufs und dazu, dass die Native-Fullscreen-Tests in jedem Launcher laufen müssen
     (ein Launcher ohne Fullscreen API scheitert, statt zu überspringen).
   - `docs/architecture.md` §6, Zeile 539: »every file under WebGPU in Chromium and under WebGL 2
     in Chromium, Firefox and WebKit« → um die renderer-freien Dateien ergänzen (Verweis auf §3).
   - Das Proposal `packages/twopoint5d/docs/proposals/sprite-features.md:921` bleibt: es spricht
     von Sprite-Tests, die rendern, und bleibt wahr.

### Verify und was im Log stehen muss

`pnpm run ci`, grün. Zusätzlich im Log des Gates nachsehen und in den Report schreiben:

- Endstand des Browser-Laufs: Chromium WebGPU, Firefox WebGL2, Webkit WebGL2 je 67/67 Dateien,
  Chromium WebGL2 56/56.
- Der Block `Skipped tests:` steht am Ende des Browser-Laufs; erwartet (Stand Paket 14):
  Chromium WebGPU 3, Chromium WebGL2 1, Firefox WebGL2 3, Webkit WebGL2 3 — keiner davon aus
  `display-fullscreen.test.js`. Weicht eine Zahl ab, den Grund nennen.
- `git diff pnpm-lock.yaml` wie in B.6 beschrieben: keine aufgelöste Version eines Pakets außer
  chai/`@types/chai` (neu) und `@esm-bundle/chai` (weg) ändert sich.

## Für die Schnittstellen-Zeile nach dem Commit

Was spätere Pakete (4 StageDirector, 5 Display, 9 Sprites schreiben Browser-Tests) brauchen:
`import {expect} from 'chai'` · `countNodeBuilds(renderer)` in `test/helpers/fixtures.js`, async,
liefert `{count, stop}` · `countLit(pixels)` in `fixtures.js` · eine renderer-freie neue
Testdatei gehört in `RENDERER_FREE_FILES` in `web-test-runner.config.js` · Katalog um
`@types/node`, `playwright`, `rimraf`, `typescript` erweitert; Tools stehen im Manifest des
Pakets, das sie nutzt, nicht in der Root.

## Findings im Volltext

**TEST-005 · low · packages/twopoint5d-testing/test/stage-masks.test.js:52** (auch
`stage-transitions.test.js:45`) — Node-Builder-Zähler der Browser-Tests in helpers/fixtures.js
bündeln
countNodeBuilds() ist in zwei Browser-Tests kopiert und patcht das nicht öffentliche
`renderer.backend.createNodeBuilder` von three. Bricht three diese interne Methode um, müssen beide
Kopien angepasst werden; fällt es nicht auf, zählt der Test 0 und die 'erstes Frame baut
nichts'-Aussagen werden wertlos. Der Gegentest in stage-masks.test.js:266 (ohne precompile > 0)
fängt das für diese Datei ab, nicht für die Kopie.
Empfehlung: Hilfsfunktion nach test/helpers/fixtures.js verlagern und den Sanity-Check 'zählt > 0
ohne precompile' einmal dort verankern.

**TEST-006 · low · packages/twopoint5d-testing/test/sprites-visible.test.js:150** (auch `:151`) —
Visible-Browsertest: Selbstvergleich diffPixels(shown, shown) ersetzen
Der Schattentest zählt die beleuchteten Pixel über `diffPixels(shown, shown).lit`, also den
Vergleich eines Bildes mit sich selbst, um ein Zählergebnis zu bekommen. Das liest sich wie ein
Versehen und verbirgt, was gemessen wird; bei einer Änderung von diffPixels (etwa lit nur bei
Differenz) bleibt der Test grün, weil `hidden` ebenfalls 0 liefert, und der Positivfall `above(0)`
bricht erst dann. Zudem deckt die Datei nur Rendern, Slot-Wiederverwendung, Schatten und Picking
ab; ein Visible-Wechsel nach Resize/Pool-Wachstum fehlt.
Empfehlung: Eine benannte Hilfsfunktion (countLit/countNonBlack) in fixtures.js nutzen statt
diffPixels mit zwei gleichen Argumenten.

**TEST-007 · low · packages/twopoint5d-testing/web-test-runner.config.js:83** (auch
`display-fullscreen.test.js:28`) — Backend-unabhängige Browser-Tests laufen unter allen fünf
Launchern
Jede Testdatei läuft unter Chromium WebGPU, Chromium WebGL2, Firefox und WebKit.
display-fullscreen.test.js erzeugt Display ohne start(), braucht also keinen Renderer; die Datei
läuft dennoch zweimal unter Chromium. Bei Firefox/WebKit-Headless ist `document.fullscreenEnabled`
nicht garantiert, `this.skip()` (display-fullscreen.test.js:48) verwandelt dann alle drei
Native-Tests ohne Warnung in 'skipped'; der Gate bleibt grün, ohne dass der echte Fullscreen-Pfad
je in einem Browser lief. Das Reporter-Setup zeigt keine Skip-Zahl als Fehler.
Empfehlung: In CI die Zahl der übersprungenen Tests melden oder per Env erzwingen, dass die
Native-Tests in mindestens einem Launcher laufen; backend-unabhängige Dateien nur einmal pro Engine
laufen lassen.

**DEP-001 · low · packages/twopoint5d-testing/package.json:18** (auch
`web-test-runner.config.js:13`, `packages/twopoint5d/package.json:46`) — Undeklarierte
Tool-Abhängigkeiten in Workspace-Paketen (Phantom-Dependencies)
@spearwolf/twopoint5d-testing deklariert weder `playwright` (JSDoc
`import('playwright').LaunchOptions`, web-test-runner.config.js:13) noch `@types/three`,
`typescript` (Skript `pnpm tsc`, package.json:16); das Library-Paket ruft
`pnpm tsc`/`vitest`/`attw`/`publint`/`rimraf` ohne eigene devDependencies auf
(package.json:46-58), alles kommt aus dem Workspace-Root. pnpm löst das über den
Root-node_modules-Pfad auf. Das funktioniert, solange der Root alles bereitstellt; das gefilterte
Install in deploy.yml:100 (--filter twopoint5d-workspace --filter @spearwolf/twopoint5d) deckt das
für die Library ab, ein Install nur des Test-Pakets hätte keine tsc.
Empfehlung: Die benutzten Tools als devDependencies im jeweiligen Paket nennen (catalog: oder
workspace-Root-Range) oder in AGENTS.md festhalten, dass der Root die Toolchain besitzt.

**DEP-002 · low · packages/twopoint5d-testing/package.json:25** — @esm-bundle/chai 4.3.4-fix.0 als
Browser-Assertion-Bibliothek ersetzen oder bewusst festhalten
Die Browser-Tests hängen an `@esm-bundle/chai` in einer exakt gepinnten Fix-Version von 2021
(chai 4), dazu `@types/mocha`. Das Paket wird nicht mehr gepflegt; die restlichen Dependencies sind
frisch (`pnpm outdated -r`: nur Patch/Minor-Rückstand bei biome, astro, marked, nx, three 0.187 und
@types/node 24 gegen 26). Kein Sicherheitsproblem belegt, aber eine Abhängigkeit, die bei einem
Node-/Browser-Wechsel zuerst bricht.
Empfehlung: Auf chai 5/6 über ESM-Import (oder den im Runner mitgelieferten Expect) umziehen,
sobald das Test-Paket ohnehin angefasst wird; bis dahin im Kommentar begründen.

## Entscheidungen in Zug 0 (Begründungen)

- **Root trägt die Tools der Pakete nicht mehr** (B.2): die Nutzer-Entscheidung verlangt, dass jedes
  Paket seine Tools deklariert; solange die Root sie zusätzlich hält, bleibt jede künftige Lücke
  unsichtbar, und der Befund wäre nur dokumentiert, nicht behoben. Doppelt genannte Tools über
  den Katalog, damit keine zwei Ranges driften.
- **Öffentlicher Debug-Hook statt Patch der internen Methode** (C): behebt die Ursache, die das
  Finding nennt (Abhängigkeit von einem nicht öffentlichen Member), und zählt nachweislich dasselbe.
- **Kalibrierung im Helfer statt eines Gegentests je Datei** (C): »einmal dort verankern« — sie
  schützt jeden Aufrufer, auch künftige. Der szenariospezifische Gegentest in `stage-masks` bleibt,
  weil er etwas anderes belegt.
- **Native-Fullscreen als Assertion statt Env-Schalter** (E.1): gemessen laufen die Tests in allen
  vier Launchern; eine Assertion ist strenger als »mindestens einer« und braucht keine Variable,
  die jemand setzen muss. Die Skip-Liste (E.3) macht die übrigen, gewollten Skips sichtbar.
- **Renderer-frei in Chromium unter WebGPU** (E.2): der WebGPU-Launcher lässt `navigator.gpu` stehen
  wie die Seite eines Chromium-Nutzers; der WebGL2-Launcher nimmt es künstlich weg.
- **Wachstumstest dazu** (D.3): die Beschreibung von TEST-006 nennt die fehlende Abdeckung als Teil
  des Befunds; die Scope-Regel nimmt alles mit.
- **Offene Befunde nicht übernommen**: die drei Advisories (`minimatch`, `glob`, `deepmerge`) haben
  eine eigene Ursache (transitive Releases ohne Fix bzw. Override nötig); dieses Paket ändert keine
  aufgelöste Version. Sie bleiben `→ Scope` für die Drain-Runde.

## Urteil des Reviewers (Zug 3, opus, `paket-3.review-0.json`)

- TEST-005 behoben — `countNodeBuilds()` in `packages/twopoint5d-testing/test/helpers/fixtures.js:258`
  über `renderer.debug.onNodeBuilderCreated`, Kalibrierung mit `throw`; Aufrufe
  `stage-masks.test.js:234`, `stage-transitions.test.js:223/243/263`; Gegentest in `stage-masks` erhalten
- TEST-006 behoben — `countLit()` `fixtures.js:648`, Prädikat `isLitAt()` `fixtures.js:637`;
  `sprites-visible.test.js:178-179`; Wachstumstest `sprites-visible.test.js:134`
- TEST-007 behoben — Assertion `display-fullscreen.test.js:49`; `RENDERER_FREE_FILES`
  `web-test-runner.config.js:89`, Gruppe `renderer-free` `:222` mit denselben Launcher-Objekten;
  `skippedTestsReporter()` `:162`; Log 67/56/67/67, Skips 1/3/3/3
- DEP-001 behoben — Katalog `pnpm-workspace.yaml:658-669`, Root `package.json:42-53`, Library
  `packages/twopoint5d/package.json:61`, Testpaket `packages/twopoint5d-testing/package.json:24-35`,
  Lookbook; Kommentare `dependabot.yml`, `deploy.yml`, `AGENTS.md:136-152`, `docs/architecture.md` §5
- DEP-002 behoben — `chai ^6.3.0`, `@types/chai ^5.2.3` (`packages/twopoint5d-testing/package.json:25,32`),
  68 Importzeilen, `git grep esm-bundle` leer

Kleine Befunde (lösen keine Runde aus):
- `packages/twopoint5d-testing/test/stage-masks.test.js:18` — `countNodeBuilds` im Import nicht alphabetisch
- `docs/architecture.md:247`, `web-test-runner.config.js:213`, `fixtures.js:40` — »every test file that
  starts a renderer« passt nicht zum Kriterium von `RENDERER_FREE_FILES` (auch renderer-freie Displays
  initialisieren ihren Renderer); genauer »that renders« wie in `AGENTS.md`. Wortlaut kam aus dem Detailplan
- `docs/architecture.md:468` — »the four first« statt »the first four«
- `docs/architecture.md:247, 483-484, 516-517, 567-568`, `AGENTS.md:186-188` — Zeilenumbruch der Umgebung gebrochen
- Commit-Body vor dem Commit nicht prüfbar (lag dem Reviewer nicht vor); geschrieben nach der Vorgabe unter »Commit:«
