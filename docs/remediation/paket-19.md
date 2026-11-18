# Paket 19 — Abschluss: offene Reviewer-Anmerkungen in Doku, CHANGELOG und Importen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen — kleine Reviewer-Befunde der Pakete 1, 2, 3, 5, 6, 8, 9, 9b,
  9c, 10, 11c, 13, 14, 17 (Liste im Plan), dazu aus Zug 0 die zwei `Folgen:` unter
  Paket 18 (Folgen von 13 und 11c), die zwei Queue-Einträge `Stage2D.ts:747, 778`
  (vorbestehend, gleiche Ursache) und drei Stellen gleicher Ursache (unten, »Abgleich«)
- Ziel: Doku, CHANGELOG, TSDoc und die genannten Importe folgen den Formatregeln des
  Projekts — jeder in diesem Lauf geschriebene Absatz ist auf die Breite seiner Datei
  umbrochen, das CHANGELOG führt jeden Eintrag in der richtigen Gruppe und ohne Rückblick,
  das Diagramm in Proposal §3.5 zeigt jede Antwort, die einen Request nach `'idle'` führt.
- Modell: mittlere Stufe
- Effort: low (jeder Schritt nennt Datei, Zeilen, Breite und, wo Wörter sich ändern, den
  Wortlaut)
- Dateien:
  - `packages/twopoint5d/CHANGELOG.md`
  - `docs/architecture.md`
  - `packages/twopoint5d/docs/architecture.md`
  - `packages/twopoint5d/docs/resource-lifecycle.md`
  - `packages/twopoint5d/docs/stages.md`
  - `packages/twopoint5d/docs/textures.md`
  - `packages/twopoint5d/docs/sprites.md`
  - `packages/twopoint5d/docs/proposals/display-fullscreen.md`
  - `AGENTS.md`
  - `apps/lookbook/README.md`
  - `apps/lookbook/src/pages/demos/stage-masks-frozen.astro`
  - `apps/lookbook/src/demos/rope-bridge/RopeBridge.ts`
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts` (nur TSDoc)
  - `packages/twopoint5d/src/stage/planeProjection.ts` (nur TSDoc)
  - `packages/twopoint5d/src/stage/Stage2D.ts` (nur TSDoc)
  - nicht: `scripts/publishNpmPkg.mjs` (kein Befund, Grund unten)
- Verify: `pnpm run ci`, davor die zwei Abnahmeprüfungen am Ende des Vorgehens
- Commit: `docs: wrap the paragraphs and doc comments that ran past the width of their files, list the binary search of TextureAtlas under Changed, name what two steps of the migration guide refuse without what they did before, draw every answer that ends a fullscreen request in idle, bound the firstId of a tile set in the texture guide, document near and far of PlaneProjectionView, size the stage module anew, and put the imports and a seed of two demos in order`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · alle Fundstellen an HEAD 11b53b5a geprüft:
    `CHANGELOG.md:91, 137` unverändert; `docs/architecture.md:266, 303` unverändert,
    `:667` unverändert, dazu `:404, 420` (Paket 1) und `:277, 403` über 90;
    `packages/twopoint5d/docs/architecture.md` Absatz `:194–205` (kurze Zeile `:201`);
    `resource-lifecycle.md:54` (22 Zeichen); `stages.md:1324` (142), `:1891` (75);
    `textures.md:123` → `:121` (273), `:263` → `:407` (126), `:221` Grenze von `firstId`
    fehlt weiter; `sprites.md:2957` → `:2973` (130); Proposal
    `display-fullscreen.md:281` unverändert; `AGENTS.md:168` (118);
    `apps/lookbook/README.md:67` (91), `:70` (99); `stage-masks-frozen.astro:23–24`
    unverändert; `RopeBridge.ts:38–39, 159` unverändert; `publishNpmPkg.mjs:8` → kein
    Befund · Folgen von Paket 18: `FrameBasedAnimations.ts:600–606` (kurze Zeilen `:601`,
    `:604` aus 2577a22e) und `planeProjection.ts:117, 121` (aus 2867d92f) → in dieses
    Paket · Queue `Stage2D.ts:747, 778` → in dieses Paket · Restplan unverändert
  - 2026-11-18 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), effort low, Report `paket-19.impl-0.json`
  - 2026-11-18 Zug 2: FERTIG_MIT_VORBEHALT · 15 Dateien laut Liste geändert · Arbeitsbaum schmutzig · Abnahme 1 = 22, alle `+*`/`-*` (TSDoc-Präfix), Abnahme 2 leer · `pnpm run ci` exit=0 (`paket-19.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (sonnet, low): alle 15 Schritte umgesetzt, keine kritischen/wichtigen Befunde, 3 klein · Diff `paket-19.diff`, Report `paket-19.review-0.json`
  - 2026-11-18 Zug 4: entfällt, keine Runde
  - 2026-11-18 Zug 5: Commit 05d59dd1, Trailer `Remediation-Run: 2026-11-17`, Verify `paket-19.verify.log` exit=0

## Abgleich und Entscheidungen aus Zug 0

- **Alle Fundstellen stehen** (Zeilen oben im Verlauf). Was sich verschoben hat, verschob
  Paket 14b (Löschungen in `textures.md`) und Paket 8/18 (`sprites.md`).
- **`scripts/publishNpmPkg.mjs:8` ist kein Befund.** Die Zeile hat genau 130 Zeichen,
  `lineWidth` in `biome.jsonc:33` ist 130. In Zug 0 geprüft: dieselbe Importliste,
  von Hand auf fünf Zeilen gebrochen, gibt `biome format --stdin-file-path=scripts/x.mjs`
  wieder als eine Zeile aus. Ein Umbruch würde `pnpm lint` (`biome ci`) rot machen.
- **`CHANGELOG.md:121` gehört dazu (gleiche Ursache wie `:137`).** Derselbe Relativsatz
  über das alte Verhalten (»A `0`, which turned panning with the mouse off, …«), geschrieben
  von Paket 3. Die Kommentare in den `**Before**`-Blöcken (`// panned with no button`,
  `// panned up only`, `// NaN drew without a limit`, …) bleiben: der Before-Block zeigt
  den alten Aufruf, das ist die Form der Migration Guides des Projekts, auch im
  veröffentlichten Abschnitt 0.25.0 (`CHANGELOG.md:499, 505`). Auch die Überschriften der
  Guides bleiben.
- **Proposal §3.5: auch die Zeile `'idle'` der Tabelle.** Ihre Spalte »in« nennt »the
  answer to a request with no exit noted on it« und lässt damit denselben Fall aus wie das
  Diagramm (gewährt, Exit vermerkt, ein Element der App liegt auf dem Ziel → `'idle'`,
  Code `DisplayFullscreen.ts:715–718`: `#leaveNative()` nur bei `#nativeElement() != null`)
  und dazu den verweigerten Request mit vermerktem Exit. Die Zeile `'requesting'`
  (`:291`) stimmt und bleibt.
- **`textures.md`: Satz statt Tabellenzeile.** Die Grenze von `firstId` kommt als Satz in
  den Absatz über die Ablehnungen (`:221–223`), mit den Worten der TSDoc
  (`TileSet.ts:62–63`), die Paket 18 geschrieben hat. Fehlerklasse belegt:
  `assertWholeNumber()` (`utils/assertWholeNumber.ts:11`) und `assertOption()`
  (`TileSet.ts:71`) werfen `RangeError`.
- **Drei Stellen gleicher Ursache, in Zug 0 gefunden:** `docs/architecture.md:277` (94,
  Paket 14) und `:403` (93, Paket 1) liegen in Absätzen, die dieses Paket ohnehin neu
  umbricht; `AGENTS.md:154–161` (92–94, Paket 13) und `:277–281` (91–92, Paket 1) gehen
  über die Breite der Datei — vor dem Lauf hatte `AGENTS.md` keine Zeile über 90.
- **`AGENTS.md:278` »`stage` about 13k lines« wird »about 14k«.** Gezählt in Zug 0 wie
  Paket 1 (alle `.ts` unter `src/stage/` ohne `.spec.ts`/`.bench.ts`): a964bd90 13 161,
  HEAD 14 328 — gewachsen durch die Zerlegungen der Pakete 11, 11b, 11c. `texture` (8 805)
  bleibt »about 9k«. Eigene Ursache (Folge von 11–11c), aber ein Wort in einem Absatz, den
  dieses Paket umbricht; ein eigenes Paket kostete einen ganzen Durchlauf.
- **Folgen von Paket 18 → hierher.** Beide sind Umbruch- bzw. TSDoc-Befunde wie die übrigen
  dieses Pakets, verursacht von 13 (`git blame`: `FrameBasedAnimations.ts:599–604` aus
  2577a22e) und 11c (`planeProjection.ts:117–123` aus 2867d92f) — zweite Generation wie
  das ganze Paket, `Folge von: Pakete 1–17` deckt sie.
- **Queue `Stage2D.ts:747, 778` → hierher.** Vorbestehend (07da4adb vom 2026-11-12), aber
  dieselbe Ursache — ein TSDoc-Absatz, der nach dem Einfügen nicht neu umbrochen wurde —
  und dieselbe Handgriff-Art wie `FrameBasedAnimations.ts`. Ohne Übernahme schnitte der
  Abschluss für zwei Umbrüche ein eigenes Paket.
- **Nicht übernommen: die drei kleinen Befunde des Reviewers von Paket 18** (Kommentarzeilen
  über 100 Zeichen in `DisplayFullscreen.ts`, an `releaseSortScratch()`, am `finally` in
  `SpritePicker#place()`). Sie stehen weder in `Folgen:` noch in der Queue, und als Folge
  von Paket 18 (selbst `Folge von: Pakete 4–17`) wären sie die dritte Generation der Kette
  — das ist eine Frage an den Nutzer, keine Entscheidung von Zug 0. Sie stehen in der
  Ergebniszeile von Paket 18 für den Abschluss.
- **Kein CHANGELOG-Eintrag neu**: die CHANGELOG-Änderungen berichtigen bestehende
  Unreleased-Einträge; TSDoc, Guides und Proposal ändern kein Verhalten.
- **Kein Regressionstest**: kein Verhalten ändert sich. Beleg für »nur Umbruch« ist die
  Wortdiff-Prüfung am Ende.

## Vorgehen

Lies vor dem ersten Schritt AGENTS.md (Konventionen) und den Abschnitt »Konventionen« im
Kopf von `./remediation-plan.md`. Die Zeilennummern gelten für HEAD 11b53b5a; bearbeite
jede Datei von unten nach oben, dann stimmen sie beim Bearbeiten.

### Regel »neu umbrechen« (gilt für jeden Schritt, der sie nennt)

- Bereich: von der genannten Startzeile bis zum Ende des Absatzes bzw. Listenpunkts (die
  nächste Leerzeile, der nächste Listenpunkt `- `, das Ende des TSDoc-Absatzes vor ` *`
  allein oder ` */`). Zeilen vor der Startzeile bleiben byte-gleich.
- Die Wörter bleiben, in ihrer Reihenfolge, mit ihrer Interpunktion — außer dort, wo der
  Schritt einen neuen Wortlaut vorgibt.
- Greedy füllen: jede Zeile nimmt so viele Wörter, wie bis zur Breite W (in Zeichen, der
  Einzug zählt mit) passen. Gebrochen wird nur an einem Leerzeichen, nie innerhalb eines
  Code-Spans (`` `…` ``) und nie innerhalb einer URL `(…)` eines Links. Ein Stück, das allein
  länger als W ist, steht allein auf seiner Zeile.
- Einzug: Folgezeilen eines Listenpunkts tragen den Einzug, den die Folgezeilen dieses
  Punkts schon haben (2 Leerzeichen bei `- `, 3 in der nummerierten Liste von
  `apps/lookbook/README.md`); TSDoc-Zeilen tragen das Präfix der Nachbarzeilen
  (`   * ` in einer Klasse).

### Schritte

1. **`packages/twopoint5d/CHANGELOG.md`** (nur `## [Unreleased]`, sonst nichts):
   a. `:137` ersetzen durch genau:
      `A list of another length, or a string, throws.`
   b. `:121` ersetzen durch genau:
      `A \`0\` or a string from a config throws.`
      (also: `A ` + Code-Span `0` + ` or a string from a config throws.`)
   c. `:91` (der Punkt `- \`TextureAtlas\` lets go of a frame name by binary search, …
      one by one`) unter `### Fixed` löschen.
   d. Unter `### Changed` direkt nach dem letzten Punkt (`:66`, beginnt mit
      `` - `InstancedVOBufferGeometry#dispose()` empties the buffer and serial maps ``) als
      neuen letzten Punkt einfügen, eine Zeile, genau:
      ``- `TextureAtlas` finds a frame name it lets go of by binary search over the ids of its named frames, so `DynamicAtlas#remove()` takes a logarithmic search per frame, not a linear one``
      (Die CHANGELOG-Punkte sind einzeilig; nicht umbrechen.)
2. **`docs/architecture.md`**, W = 90:
   a. Absatz `:658–668`: ab `:666` neu umbrechen (die Zeile `:667` »spec covers both. No«
      verschwindet dabei).
   b. Absatz `:409–441`: ab `:417` neu umbrechen.
   c. Absatz `:399–407`: ab `:403` neu umbrechen.
   d. Absatz `:299–305`: ab `:303` neu umbrechen.
   e. Absatz `:259–280`: zuerst den Wortlaut ändern, dann ab `:263` neu umbrechen. Der Satz
      von »Left to themselves« (`:263`) bis »WebGPU would go untested.« (`:267`) wird zu
      genau diesen zwei Sätzen:
      `Left to themselves the browsers would pick by machine: headless Chromium has
      \`navigator.gpu\` but finds no adapter without \`--enable-unsafe-webgpu\`, and headless
      Firefox has no \`navigator.gpu\` at all (measured with Playwright 1.65.0, Chromium 158
      and Firefox 159, on Linux). So both would end up on WebGL2, and WebGPU would go
      untested.`
      (die Backslashes stehen hier nur vor den Backticks der Code-Spans; im Text stehen
      die Code-Spans wie im Bestand). Der Rest des Absatzes (»Now an init script …« bis
      »… no `navigator.gpu`.«) bleibt wortgleich.
   Die Zeile `:112` liegt in einem Code-Block und bleibt.
3. **`packages/twopoint5d/docs/architecture.md`**, W = 100: Absatz `:194–205` (Abschnitt
   `### \`stage/\``) ab `:197` neu umbrechen.
4. **`packages/twopoint5d/docs/resource-lifecycle.md`**, W = 90: Absatz `:41–63` ab `:53`
   neu umbrechen. Die Linkzeilen `:85`, `:407` bleiben.
5. **`packages/twopoint5d/docs/stages.md`**, W = 100:
   a. Absatz `:1888–1892` ab `:1889` neu umbrechen.
   b. Absatz `:1321–1324` ab `:1323` neu umbrechen (endet mit »… when its `resize()`
      throws:«, die Liste danach bleibt).
   Alle übrigen Zeilen über 100 in `stages.md` sind älter als der Lauf und bleiben.
6. **`packages/twopoint5d/docs/textures.md`**, W = 100:
   a. Absatz `:407–408` ab `:407` neu umbrechen.
   b. Absatz `:221–223`: an sein Ende (nach »… that does not fit into the image.«) diesen
      Satz anhängen, dann ab `:221` neu umbrechen:
      ``A `firstId` is a whole number that keeps the ids of all tiles, up to `firstId + tileCount - 1`, within ±`Number.MAX_SAFE_INTEGER`; another is refused with a `RangeError` as well.``
   c. Listenpunkt `:121` (»- `defaultClassNames` line up ahead …«, 273 Zeichen) ab `:121`
      neu umbrechen, Folgezeilen mit 2 Leerzeichen Einzug; der Punkt `:122–123` bleibt.
7. **`packages/twopoint5d/docs/sprites.md`**, W = 100: Listenpunkt `:2971–2977` ab `:2973`
   neu umbrechen.
8. **`packages/twopoint5d/docs/proposals/display-fullscreen.md`** (§3.5):
   a. Tabellenzeile `'idle'` (`:290`), Spalte »in«: den Teil
      `the answer to a request with no exit noted on it` ersetzen durch genau
      `the answer to a request, unless it is granted with an exit noted on it while the target lies on top`.
      Sonst bleibt die Zeile byte-gleich (Tabellenzeilen werden nicht umbrochen).
   b. Diagrammzeile `:281` (`requesting ── the answer: refused, or granted with no exit
      noted on it; dispose() ───▶ idle`) ersetzen durch genau diese zwei Zeilen; das `▶`
      steht in Spalte 86 wie in jeder Diagrammzeile, die Folgezeile hat 14 Leerzeichen
      Einzug wie `:278`, `:280`, `:285`, und zwischen `dispose() ` und `▶` stehen genau
      12 Zeichen `─`:
      ```text
      requesting ── the answer: refused; granted, with no exit noted on it, or with one while
                    an element of the app lies on top of the target; dispose() ────────────▶ idle
      ```
      Die Zeile `:282` (`requesting ── granted, with an exit noted on it, while the target
      lies on top ───────▶ exiting`) bleibt.
9. **`AGENTS.md`**, W = 90:
   a. Absatz `:274–283` (»Read a module's sources whole …«): `stage` about 13k lines
      (`:278`) wird `stage` about 14k lines; dann ab `:277` neu umbrechen.
   b. Listenpunkt `:164–174` (»**Shared dependency versions.**«) ab `:168` neu umbrechen.
   c. Listenpunkt `:152–163` (»**Invalid input is refused.**«) ab `:154` neu umbrechen.
10. **`apps/lookbook/README.md`**, W = 90 (Einzug 3 zählt mit): Absatz `:65–73` ab `:67` neu
    umbrechen.
11. **`apps/lookbook/src/pages/demos/stage-masks-frozen.astro`**: die Zeilen `:23`
    (`import {SeanceClock} from '~demos/stage-masks/SeanceClock';`) und `:24`
    (`import {RoseWindow} from '~demos/stage-masks/RoseWindow';`) tauschen — `RoseWindow`
    vor `SeanceClock`, wie `chapelAssets`/`MothChapel` davor ohne Rücksicht auf Groß-/
    Kleinschreibung sortiert.
12. **`apps/lookbook/src/demos/rope-bridge/RopeBridge.ts`**:
    a. `const SPARK_SEED = 23;` (`:159`) aus der Gruppe `MAX_WEIGHTS`/`WEIGHT_*` nehmen und
       direkt nach `const SPARK_LIFE = 0.45;` (`:162`) einsetzen, vor `const MOTES = 26;`.
       Kein Kommentar dazu (Paket 16: Seeds ohne getrennten Kommentar bleiben ohne).
    b. Die Zeilen `:38` (`import {atlasFrame} from '~demos/utils/atlasFrame';`) und `:39`
       (`import {SeededRandom} from '~demos/utils/seededRandom';`) vor `:36`
       (`import {crossing, duelAngles} from './SaberDuel';`) setzen, direkt nach
       `} from 'three/webgpu';` (`:35`), ohne Leerzeile dazwischen — die Form von
       `NeonSigns.ts:17–19` und `CardboardParade.ts:33–34`.
13. **`packages/twopoint5d/src/stage/planeProjection.ts`**: über `get near(): number {`
    (`:117`) die Zeile `  /** The near plane of the camera, as the last \`takeNearAndFar()\` set it. */`
    und über `get far(): number {` (`:121`) die Zeile
    `  /** The far plane of the camera, as the last \`takeNearAndFar()\` set it. */`
    einsetzen (Backslashes nur hier vor den Backticks), Form der Getter darüber
    (`:92`, `:97`).
14. **`packages/twopoint5d/src/texture/FrameBasedAnimations.ts`**, W = 100: TSDoc-Absatz von
    `add()` `:598–610` (»What picks the frames is refused as well …« bis »… whatever it
    comes from.«) ab `:601` neu umbrechen.
15. **`packages/twopoint5d/src/stage/Stage2D.ts`**, W = 100:
    a. TSDoc von `dispose()`, Absatz `:777–780` (»The {@link scene}, the {@link camera} …«
       bis »… as little as one assigned here.«) ab `:778` neu umbrechen. `{@link …}` ist
       ein Stück und wird nicht gebrochen.
    b. TSDoc von `releasePassNodeMemory()`, Absatz `:746–750` ab `:747` neu umbrechen.

### Abnahmeprüfungen (vor `pnpm run ci`, Ausgabe in den Report)

1. Reiner Umbruch — Ausgabe muss `0` sein:
   ```bash
   git diff --word-diff=porcelain -- packages/twopoint5d/docs/architecture.md packages/twopoint5d/docs/resource-lifecycle.md packages/twopoint5d/docs/stages.md packages/twopoint5d/docs/sprites.md apps/lookbook/README.md packages/twopoint5d/src/texture/FrameBasedAnimations.ts packages/twopoint5d/src/stage/Stage2D.ts | grep -cE '^[-+][^-+]'
   ```
   Für `docs/architecture.md`, `textures.md`, `AGENTS.md`, `CHANGELOG.md` und das Proposal
   zeigt `git diff --word-diff=plain -- <datei>` nur die Wortänderungen aus den Schritten
   1, 2e, 6b, 8 und 9a.
2. Breite — keine Ausgabe, außer einem Stück, das allein länger als W ist:
   ```bash
   for spec in docs/architecture.md:90 AGENTS.md:90 apps/lookbook/README.md:90 packages/twopoint5d/docs/resource-lifecycle.md:90 packages/twopoint5d/docs/architecture.md:100 packages/twopoint5d/docs/stages.md:100 packages/twopoint5d/docs/textures.md:100 packages/twopoint5d/docs/sprites.md:100 packages/twopoint5d/src/texture/FrameBasedAnimations.ts:100 packages/twopoint5d/src/stage/Stage2D.ts:100; do
     f=${spec%:*}; w=${spec#*:}
     git diff -U0 -- "$f" | grep '^+[^+]' | awk -v w="$w" -v f="$f" 'length($0) - 1 > w {print f ": " length($0) - 1}'
   done
   ```
   (CHANGELOG und die Tabellenzeile des Proposals sind einzeilig gewollt und nicht dabei.)

## Findings im Volltext

Die Befunde dieses Pakets sind kleine Befunde von Reviewern, ohne Finding-ID. Wortlaut
aus den Paketdateien der Pakete, die sie gemeldet haben:

- **Paket 6** — `CHANGELOG.md:108` (jetzt `:91`): die Namensfreigabe per Binärsuche steht
  unter `### Fixed`, `### Changed` passte besser; »compares no element … one by one« ist
  schief formuliert.
- **Paket 13** — `CHANGELOG.md:~108` (jetzt `:137`, Migration Guide `PanControl2D#keys`) —
  »which lost a direction without a word« blickt auf den Vorzustand; im Migration Guide
  üblich, optional kürzen.
- **Paket 2** — `docs/architecture.md:292` (jetzt `:303`): der neue `EXPECTED_SKIPS`-Satz
  ist nicht umbrochen (151 Zeichen).
- **Paket 14** — `docs/architecture.md:266`: Interpunktion »— on Linux) —, so both«
  stolpert.
- **Paket 1** — `docs/architecture.md`: die eingefügten Sätze sind nicht auf die übliche
  Zeilenbreite umbrochen (überlange Zeilen, eine Zeile nur »spec covers both. No«);
  kosmetisch. · `scripts/publishNpmPkg.mjs:5` (jetzt `:8`): Importzeile über 120 Zeichen;
  Biome im Gate hat nichts beanstandet.
- **Paket 11c** — Absatz im Abschnitt `stage/` von `docs/architecture.md` (gemeint
  `packages/twopoint5d/docs/architecture.md:194–205`) nicht neu umbrochen, wie der
  Detailplan verlangte.
- **Paket 3** — `docs/resource-lifecycle.md:55-57` (jetzt `:53–55`): unregelmäßiger Umbruch
  nach »a new«.
- **Paket 5** — `packages/twopoint5d/docs/stages.md:1324`: der Einschub »— `resize()` is the
  one way to set them —« ist nicht neu umbrochen (Folgezeile 142 Zeichen, Guide bricht um
  100). · `packages/twopoint5d/docs/stages.md:1891`: der neue Satz zu `precompile()` nicht
  neu umbrochen, Zeile bricht nach rund 75 Zeichen ab.
- **Paket 6** — Neue TSDoc-Sätze in `TextureStore.ts:1195`, `:1249`, `:1410`, `:1522` und
  `docs/textures.md:123`, `:263` (jetzt `:121`, `:407`) sind 130–190 Zeichen lang, die
  Umgebung bricht bei etwa 100 um. (Der `TextureStore.ts`-Teil ist mit Paket 18 erledigt.)
- **Paket 13** — `TileSet.ts:62` (TSDoc der Option `firstId`) und
  `packages/twopoint5d/docs/textures.md:221` nennen `firstId` nur »a whole number«, nicht
  die Grenze ±`Number.MAX_SAFE_INTEGER` für die Ids aller Kacheln. (`TileSet.ts` hat
  Paket 18 erledigt; `textures.md` nennt die Grenze an HEAD gar nicht.)
- **Paket 8** — `docs/sprites.md:2957` (jetzt `:2973`): der neue Halbsatz steht als
  140-Zeichen-Zeile in einem sonst umbrochenen Listenpunkt.
- **Paket 10** — `docs/proposals/display-fullscreen.md:280` (jetzt `:281`): die Kante
  `requesting → idle` heißt »refused, or granted with no exit noted on it«; ein gewährter
  Request mit vermerktem Exit, über dem ein Element der App liegt, geht ebenfalls nach
  `'idle'` (`#leaveNative` greift nur bei `#nativeElement() != null`) — die Tabelle stimmt,
  das Diagramm zeigt den Fall nicht.
- **Paket 9** — `AGENTS.md:156` (jetzt `:168`): die geänderte Zeile ist nicht neu umbrochen
  (über 110 Zeichen, die Datei bricht bei etwa 90 um).
- **Paket 17** — `README.md:65–70` (`apps/lookbook/README.md:67`, `:70`): zwei Zeilen über
  90 Zeichen (Wortlaut der Vorgabe).
- **Paket 9b** — `apps/lookbook/src/pages/demos/stage-masks-frozen.astro:21–23` (jetzt
  `:23–24`): `SeanceClock`-Import steht vor dem `RoseWindow`-Import, nicht alphabetisch.
- **Paket 9c** — `demos/rope-bridge/RopeBridge.ts:~163` (jetzt `:159`, Importe `:38–39`):
  `SPARK_SEED` steht mitten in der `WEIGHT_*`-Gruppe statt bei `SPARKS`/`SPARK_LIFE`; der
  `~demos`-Import steht hinter den relativen Imports.

Aus der `Folgen:`-Zeile von Paket 18 (11b53b5a):

- `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:600–606` — TSDoc von `add()`
  unregelmäßig umbrochen um »reach beyond ±`Number.MAX_SAFE_INTEGER`; and a« (Folge von
  Paket 13, 2577a22e; info)
- `packages/twopoint5d/src/stage/planeProjection.ts:117, 121` — Getter `near` und `far` von
  `PlaneProjectionView` ohne TSDoc, anders als die Getter darüber (Folge von Paket 11c,
  2867d92f; info)

Aus »Offene Befunde«:

- `packages/twopoint5d/src/stage/Stage2D.ts:747` (TSDoc von `releasePassNodeMemory()`): eine
  Zeile mit 142 Zeichen, der Absatz nicht umbrochen (aus Paket 18, vorbestehend laut
  `git blame` → 07da4adb vom 2026-11-12; info)
- `packages/twopoint5d/src/stage/Stage2D.ts:778` (TSDoc von `dispose()`): der Satz »a
  `THREE.Scene` has nothing to release, …« mitten im Absatz unregelmäßig umbrochen (aus
  Paket 18, vorbestehend laut `git blame` → 07da4adb; info)

## Urteil des Reviewers (Zug 3)

Keine Finding-IDs; Urteil je Schritt: 1a–d CHANGELOG, 2a–e `docs/architecture.md`, 3 `packages/twopoint5d/docs/architecture.md`, 4 `resource-lifecycle.md`, 5a/b `stages.md`, 6a–c `textures.md`, 7 `sprites.md`, 8a/b Proposal §3.5 (`▶` in Spalte 86), 9a–c `AGENTS.md` (13k → 14k), 10 `apps/lookbook/README.md`, 11 `stage-masks-frozen.astro`, 12a/b `RopeBridge.ts`, 13 `planeProjection.ts`, 14 `FrameBasedAnimations.ts`, 15a/b `Stage2D.ts` — alle umgesetzt.

Kleine Befunde:
- `AGENTS.md`: Linktext `[monorepo architecture` / `§5](…)` über zwei Zeilen umbrochen; regelkonform, im Quelltext holprig.
- `AGENTS.md:152`: »The four are peer dependencies …« ohne klaren Bezug; nicht vorbestehend vor dem Lauf (fehlt in `2e3f585b`), als Folge im Plan.
- `docs/stages.md`: Zeile »… as the director draws a layer, and« nach `precompile()` weiter über 100 Zeichen; laut Detailplan älter als der Lauf, bewusst stehen gelassen.
