# Paket 16 — Lookbook: zwei Kommentare stehen wieder an ihrem Code

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen — die `Folgen:`-Zeile von Paket 15 (5909821e) zu
  `NeonSigns.ts:75–78`, dazu in Zug 0 gleicher Ursache `instanced-quads.astro:77–79`; info
- Folge von: Paket 9c (2401e5b7)
- Ziel: Das TSDoc »The neon signs on the walls of the corridor; one of them flickers.«
  steht direkt an `class NeonSigns`, `FLICKER_SEED` steht mit einem eigenen Kommentar
  davor, und in `instanced-quads.astro` steht der Kommentar über den Platz im Pool wieder
  direkt über den beiden Schleifen, die er beschreibt.
- Modell: günstigste Stufe
- Effort: low
- Dateien: `apps/lookbook/src/demos/boomer-shooter-corridor/NeonSigns.ts`,
  `apps/lookbook/src/pages/demos/instanced-quads.astro` — sonst keine
- Vorgehen:
  1. `apps/lookbook/src/demos/boomer-shooter-corridor/NeonSigns.ts`, Zeilen 75–78. Heute:

     ```ts
     /** The neon signs on the walls of the corridor; one of them flickers. */
     const FLICKER_SEED = 17;

     export class NeonSigns {
     ```

     Danach, Zeichen für Zeichen (eine Leerzeile zwischen `}` von `SignState` und dem
     neuen Kommentar bleibt wie heute):

     ```ts
     // the seed of the flicker: the faulty sign stutters to the same beat on every run
     const FLICKER_SEED = 17;

     /** The neon signs on the walls of the corridor; one of them flickers. */
     export class NeonSigns {
     ```

     Der Rest der Datei bleibt, wie er ist — ausdrücklich auch die Importliste
     (`type FeatureSpritesOf` in Zeile 14 steht in der Queue, andere Ursache).
  2. `apps/lookbook/src/pages/demos/instanced-quads.astro`, Funktion `createQuads()`,
     Zeilen 77–79 (Einrückung vier Leerzeichen). Heute:

     ```ts
         // the pool holds rows * columns instances and the two loops run exactly that many
         // times, so every createVO() finds room
         const random = new SeededRandom(QUADS_SEED);
         for (let y = 0; y < rows; y++) {
     ```

     Danach:

     ```ts
         const random = new SeededRandom(QUADS_SEED);
         // the pool holds rows * columns instances and the two loops run exactly that many
         // times, so every createVO() finds room
         for (let y = 0; y < rows; y++) {
     ```

     Nur diese eine Zeile wandert; Wortlaut der Kommentare, `QUADS_SEED` (Zeile 24) und
     alles andere bleiben.
  3. Nichts weiter: kein CHANGELOG (Lookbook, keine öffentliche Änderung), kein README,
     kein Guide, keine Spec. Kein Regressionstest — die Änderung verschiebt nur Kommentare
     und eine Deklaration ohne Wirkung auf die Reihenfolge der Auswertung (`random` wird
     vor der ersten Schleife gebaut, wie heute); Beleg ist der Diff und das grüne Gate.
- Abnahme (für den Reviewer):
  - `git diff --numstat` nennt genau die zwei Dateien: `NeonSigns.ts` 2 hinzu, 1 entfernt
    (Kommentar neu, TSDoc gewandert), `instanced-quads.astro` 1 hinzu, 1 entfernt (eine
    gewanderte Zeile).
  - `grep -n -B1 '^export class NeonSigns' apps/lookbook/src/demos/boomer-shooter-corridor/NeonSigns.ts`
    zeigt das TSDoc der Klasse direkt darüber; `grep -n -B1 '^const FLICKER_SEED'` zeigt
    den neuen `//`-Kommentar.
  - `grep -n -A1 'so every createVO() finds room' apps/lookbook/src/pages/demos/instanced-quads.astro`
    zeigt in `createQuads()` direkt darunter `for (let y = 0; y < rows; y++) {`.
- Verify: `pnpm run ci`
- Commit: `docs(lookbook): put the doc comment of NeonSigns on its class, and the note on the room in the pool of the instanced quads on the loops it speaks of`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · Folge `NeonSigns.ts:75–78` unverändert (seit
    2401e5b7; 5909821e änderte die Datei nur an `:17` und `:103–104`) · gleicher Ursache neu
    `instanced-quads.astro:77–79` (seit 2401e5b7 unberührt), ins Paket genommen ·
    Durchgang über den ganzen Diff `2401e5b7 -- apps/lookbook`: keine dritte Stelle ·
    offene Folgen erledigter Pakete: keine weiteren (15b: —) · Queue unverändert, kein
    Eintrag gleicher Ursache · Restplan unverändert
  - 2026-11-18 Zug 1: Implementierer beauftragt (haiku, effort low)
  - 2026-11-18 Zug 2: Report FERTIG · NeonSigns.ts (+2/−1), instanced-quads.astro (+1/−1) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (paket-16.verify.log)
  - 2026-11-18 Zug 3: Reviewer (sonnet, low): beide Fundstellen behoben, keine Befunde · Diff paket-16.diff
  - 2026-11-18 Zug 4: entfällt, keine Runde
  - 2026-11-18 Zug 5: committet 1e40bfff

## Abgleich

**Folge aus Paket 15, `NeonSigns.ts:75–78`** — unverändert. Im Basisstand
`git show 2e3f585b:apps/lookbook/src/demos/boomer-shooter-corridor/NeonSigns.ts:72–73`
steht das TSDoc direkt an `export class NeonSigns {`. 2401e5b7 (Paket 9c) hat
`const FLICKER_SEED = 17;` samt Leerzeile zwischen TSDoc und Klasse eingefügt; seitdem
hängt das TSDoc an der Konstanten, die Klasse steht ohne Kommentar. 5909821e (Paket 15)
hat die Datei an anderer Stelle geändert (Import `atlasFrame` `:17`, `atlasFrame()` in
`:103–104`), die Fundstelle nicht.

**Gleicher Ursache, `apps/lookbook/src/pages/demos/instanced-quads.astro:77–79`** — neu in
Zug 0 gefunden. Im Basisstand (`git show 2e3f585b:…/instanced-quads.astro:74–76`) steht
der Kommentar »the pool holds rows * columns instances and the two loops run exactly that
many times, so every createVO() finds room« direkt über `for (let y = 0; …)`; er begründet
das `!` an `vertexObjectPool.createVO()!` in der inneren Schleife. 2401e5b7 hat
`const random = new SeededRandom(QUADS_SEED);` zwischen Kommentar und Schleife eingefügt.
Die Datei ist seit 2401e5b7 unberührt (`git log 2401e5b7..HEAD` leer).

**Vollständigkeit.** Zwei Durchgänge über `git show 2401e5b7 -- apps/lookbook`:
(a) jede reine Einfügung, deren Vorgängerzeile eine unveränderte Kommentarzeile (`//…`
oder `…*/`) und deren Folgezeile unverändert ist; (b) jede Ersetzung hinter einer
Kommentarzeile, die mehr Zeilen einfügt als entfernt. (a) trifft genau die zwei Stellen
oben, (b) nichts. Die übrigen Seeds aus 9c stehen an eigener Stelle: hinter einem
Interface (`animated-billboards/`, `animated-sprites/`, `textured-sprites/`
`BouncingSprites.ts`), hinter den Importen (`QuadTreeVisualization.ts`, `stage-postprocessing.astro`,
`textured-quads*.astro`, `instanced-quads.astro:24`), im Konstantenblock
(`RopeBridge.ts:159`, `DungeonScreen.ts:84`) oder als erstes Feld der Klasse.

## Gründe der Entscheidungen in Zug 0

- **Die zweite Stelle gehört in dieses Paket.** Dieselbe Ursache wie die Folge: Paket 9c
  hat eine neue Zeile zwischen einen Kommentar und den Code gesetzt, den er beschreibt.
  Paket 16 ist das Nachtragspaket zu dieser Folge von 9c (committet), und ein
  Nachtragspaket zählt alle Fundstellen derselben Ursache auf. Im Plan heißt das Paket
  deshalb »zwei Kommentare stehen wieder an ihrem Code«.
- **`//` statt `/** */` für den Seed-Kommentar.** In `NeonSigns.ts` tragen die übrigen
  Modulkonstanten (`PX` `:29–30`, `OFF_WALL` `:31–32`, `GLOW_LUMINANCE` `:56–58`) einen
  `//`-Kommentar; die Seeds aus Paket 9 in anderen Dateien (`CrawlRig.ts:86`,
  `Starfield.ts:20`) nutzen `/** */`, aber innerhalb der Datei gewinnt ihre eigene Form.
- **`FLICKER_SEED` bleibt direkt vor der Klasse**, statt zu `GLOW_LUMINANCE` hochzuziehen:
  kleinster Diff, und so nennt es das Ziel im Plan.
- **Der Wortlaut** »the seed of the flicker: the faulty sign stutters to the same beat on
  every run« folgt der Form der Seeds aus Paket 9 (»the seed of …: …«) und stimmt: der
  Generator bestimmt in `update()` (`:126–127`) Dauer jedes Stotterns und die Pause bis
  zum nächsten, und mit festem Seed ist diese Folge bei jedem Lauf dieselbe.
- **Die Seeds aus 9c ohne Kommentar** (`BouncingSprites.ts` ×3, `QuadTreeVisualization.ts`,
  `DungeonScreen.ts`, `RopeBridge.ts`, fünf `.astro`-Seiten) bleiben, wie sie sind: von
  ihnen ist kein Kommentar getrennt worden, ein fehlender Kommentar an einer
  selbsterklärenden Konstante ist kein Befund dieser Ursache.
- **Queue-Eintrag `NeonSigns.ts:14`** (Importreihenfolge, `type FeatureSpritesOf`):
  andere Ursache, vorbestehend (`git show 2e3f585b:…NeonSigns.ts:14`). Er bleibt in
  »Offene Befunde« für die Drain-Runde des Abschlusses, obwohl er in derselben Datei steht
  — die Scope-Regel sagt, dass er in den Lauf gehört, nicht in dieses Paket.
- **Modell und Effort.** Zwei benannte Stellen, Text vorgegeben, nichts zu suchen:
  Transkription, günstigste Stufe, Effort `low`. Der Reviewer nach dem Diff: klein und
  mechanisch.

## Findings im Volltext

Keine Audit-Findings. Die Folge im Wortlaut aus der `Folgen:`-Zeile von Paket 15:

**Folge von Paket 9c · info · `apps/lookbook/src/demos/boomer-shooter-corridor/NeonSigns.ts:75–78`**
— das TSDoc der Klasse (»The neon signs on the walls of the corridor; one of them
flickers.«) hängt an `const FLICKER_SEED`, `class NeonSigns` steht ohne Kommentar; Folge
von Paket 9c (2401e5b7 hat die Konstante zwischen TSDoc und Klasse gesetzt, in
`2e3f585b:…NeonSigns.ts:73` stand es an der Klasse), nicht von 15.

**Gleicher Ursache, in Zug 0 gefunden · info · `apps/lookbook/src/pages/demos/instanced-quads.astro:77–79`**
— der Kommentar über den Platz im Pool, der das `!` an `createVO()` begründet, steht seit
2401e5b7 über `const random = new SeededRandom(QUADS_SEED);` statt über den Schleifen.

## Urteil des Reviewers

- Folge `NeonSigns.ts:75–78`: behoben — TSDoc direkt über `export class NeonSigns`, `//`-Kommentar über `const FLICKER_SEED = 17;` (Commit 1e40bfff)
- Gleicher Ursache `instanced-quads.astro:77–79`: behoben — Kommentar direkt über `for (let y = 0; y < rows; y++) {` in `createQuads()`
- Kleine Befunde: keine
