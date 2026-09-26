# Paket 5 — Sprites: der Testname zum Slot-Reset von createSprite()

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — Folge von Paket 4 (Reviewer, klein)
- Folge von: Paket 4
- Ziel: Der Testname sagt, was der Test prüft, in den Worten des TSDoc.
- Modell: günstigste Stufe (`haiku`) — Transkription: eine Datei, eine Zeile, der neue Wortlaut steht unten buchstäblich
- Effort: low
- Dateien: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`
- Vorgehen:
  1. In `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`, Zeile 137, den Namen des Tests ersetzen. Heute:

     ```ts
     test('createSprite() hands out a sprite that starts upright and untrimmed, whatever its slot held before', () => {
     ```

     Danach, buchstäblich:

     ```ts
     test('createSprite() hands out a sprite that starts with its texFlipDiagonal and trim margins at 0, whatever its slot held before', () => {
     ```

     Der Wortlaut folgt dem TSDoc von `TexturedSprites#createSprite()` (`packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:62-63`: »The sprite starts with its size, tex coords, `texFlipDiagonal`, trim margins, position and rotation at 0 …«) und nennt genau die beiden Werte, die der Test prüft (`texFlipDiagonal` in Zeile 151–152, die vier Trim-Ränder in Zeile 153–156). Keine Backticks im Testnamen — die übrigen Namen der Spec schreiben Bezeichner blank (`setFrame() writes texFlipDiagonal 1 …`, Zeile 101).
  2. Sonst nichts an der Datei. Ausdrücklich **stehen bleiben**:
     - der Rumpf des Tests samt der Variablen `upright` und `turned` (Zeile 139–145) — dort benennt »upright« den Sprite, der einen im Atlas ungedrehten Frame zeigt, im Gegensatz zu `turned` mit `FLIP_DIAGONAL` zwei Zeilen tiefer; das ist das Vokabular des Repos für Frames (Fixture-Frame `upright` in `packages/twopoint5d-testing/test/helpers/fixtures.js:231`, `const upright` in `packages/twopoint5d-testing/test/sprites-rotated-frames.test.js:112`, CHANGELOG `packages/twopoint5d/CHANGELOG.md:423`) und kollidiert nicht mit `rotation`, weil ein Frame keine hat;
     - der Testname in Zeile 101 und die Meldung `'texFlipDiagonal of the upright frame'` in Zeile 112 — beide aus demselben Grund: sie sprechen von einem Frame, nicht vom Zustand eines neuen Sprites;
     - der Test in Zeile 161 (`createSprite() hands out a sprite with every attribute at the value of an unused slot …`), der den vollständigen Reset hält — dieser Test hier bleibt der gezielte für `texFlipDiagonal` und `texTrim`.
  3. Kein CHANGELOG-Eintrag: ein Testname ist nicht nutzerwirksam.
  4. Nicht committen.
- Verify: `pnpm run ci` (das Pre-Commit-Gate aus `AGENTS.md`); für den Implementierer vorab schnell: `pnpm nx test twopoint5d -- src/sprites/TexturedSprites/TexturedSprites.spec.ts && pnpm lint`
- Commit: `test(sprites): name the slot reset test of TexturedSprites#createSprite() after the texFlipDiagonal and trim margins it holds at 0`
- Hinweis für Zug 5: `Ergebnis:` von Paket 1 im Plan nennt den Regressionstest noch unter dem alten Namen (`createSprite() hands out a sprite that starts upright and untrimmed, whatever its slot held before`). `Ergebnis:` von Paket 5 nennt deshalb alten und neuen Namen, damit der Abschluss den Test findet. Kein Bugfix, also kein roter Lauf; eine Mutationsprobe braucht es nicht, der Rumpf bleibt unberührt.
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · Folge unverändert an `TexturedSprites.spec.ts:137`, Name kommt im Repo nur dort vor (`git grep "starts upright"`) · Folgen der Pakete 1–4: keine offen · Queue: beide Einträge (`FrameBasedAnimations.ts:104`, `OrthographicProjection.ts:133`/`ParallaxProjection.ts:136`) ohne gemeinsame Ursache, bleiben `→ Audit` · Kette 2 → 4 → 5: keine Rückfrage (Begründung unten) · Restplan unverändert
  - 2026-09-26 Zug 1: Implementierer beauftragt, haiku, effort low
  - 2026-09-26 Zug 2: FERTIG (impl-0 scheiterte an Schreibrechten, impl-0-versuch-2 mit bypassPermissions) · TexturedSprites.spec.ts geändert · Baum schmutzig · pnpm run ci exit=0
  - 2026-09-26 Zug 3: Reviewer (sonnet, low): erfüllt, kritisch 0 · wichtig 0 · klein 0 · Diff /tmp/claude-1000/-home-spw-spaceland-twopoint5d/0cde42d5-f02f-4e8e-b346-766a21beec2d/scratchpad/paket-5.diff
  - 2026-09-26 Zug 4: keine Runde
  - 2026-09-26 Zug 5: committet 840e2c0e

## Urteil des Reviewers

- Folge aus Paket 4 (`TexturedSprites.spec.ts:137`): behoben — neuer Testname wörtlich nach Schritt 1, Rumpf, Zeile 101/112 und der Test in Zeile 161 unberührt.
- Kleine Befunde: keine.

## Folge im Volltext

**Folge von Paket 4 · klein · `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts:137`** —
Testname `createSprite() hands out a sprite that starts upright and untrimmed` trägt das mehrdeutige
»upright«, das das TSDoc von `createSprite()` jetzt als `texFlipDiagonal` 0 ausschreibt (Reviewer, klein).

Abgleich 2026-09-26: unverändert. Zeile 137 trägt den Namen wörtlich; das TSDoc in
`TexturedSprites.ts:62-63` nennt `texFlipDiagonal` und die Trim-Ränder seit `ef223cae` beim Namen.

## Anmerkungen aus Zug 0

**Kette.** `Folge von:` führt von Paket 5 über Paket 4 zu Paket 2 (und 1a, 3) — zwei Glieder,
mit der Wurzel gezählt drei Pakete. Die Regel der dritten Generation soll einen Weg anhalten, der
bei jedem Fix einen neuen Schaden erzeugt. Hier erzeugt keiner einen: jedes Glied ist ein
Wortlaut-Befund der Stufe klein, und die Alternative »an der Wurzel anders lösen« hieße, das
mehrdeutige »upright« am Slot-Reset überall zu tilgen — das ist genau dieses Paket, das letzte
Vorkommen im Kontext des Resets fällt. Der Detailplan sähe bei jeder Antwort gleich aus. Dazu
begrenzt die Entscheidung vom 2026-09-26 (»Paket 5 ist die letzte Runde: was sein Review noch
findet, geht als Finding ins Audit«) die Kette bereits auf dieses Paket. Deshalb keine Rückfrage.

**Warum nur der Testname.** Die Folge nennt den Testnamen, und nur dort steht »upright« als
Zustand eines Sprites, den ein Leser mit `rotation` verwechselt. Wo »upright« einen Frame
beschreibt, ist es der feste Begriff des Repos (siehe Vorgehen, Schritt 2); ihn in dieser einen
Spec umzubenennen, machte sie uneinheitlich mit den Browser-Tests und dem CHANGELOG.
