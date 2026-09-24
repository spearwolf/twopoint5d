# Paket 6 — Display-Doku: »goes on the renderer« eindeutig machen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: 5 (kleiner Befund des Reviewers, ohne eigene Runde)
- Findings: keine Audit-ID — das Paket behebt eine Folge aus Paket 5
- Ziel: Die Doku zur angehaltenen three-Schleife sagt an jeder Stelle unmissverständlich »auf den Renderer gesetzt«.
- Modell: günstigste Stufe — reine Transkription: drei Ersetzungen an benannten Stellen in zwei Dateien, der neue Wortlaut steht unten buchstabengetreu, nichts zu suchen, kein Umbruch nötig
- Effort: low
- Dateien: `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: nur Doku und Kommentar, kein Verhalten, kein Test. Genau diese drei Ersetzungen, sonst nichts — jede alte Zeichenfolge kommt in ihrer Datei genau einmal vor.
  1. `packages/twopoint5d/src/display/Display.ts:1165` (TSDoc des Getters `pause`). Die Zeile

     ```
        * `pause = false` or the next `start()` runs it again. A callback that goes on the renderer
     ```

     wird zu

     ```
        * `pause = false` or the next `start()` runs it again. A callback that is set on the renderer
     ```

     Einrückung wie bisher: drei Leerzeichen vor dem `*` (die Codeblöcke hier tragen zusätzlich die Einrückung der Liste). Die Zeilen `:1166-1167` bleiben unverändert (»after the display has stopped the loop — through `renderer.setAnimationLoop()`, or through a {@link FrameLoop} that starts on the renderer — gets no frame while the loop stands still.«). Die neue Zeile ist 96 Zeichen breit, kein Umbruch.
  2. `packages/twopoint5d/src/display/Display.ts:1737-1738` (Kommentar in `#stopAnimationOfThree()`). Die beiden Zeilen

     ```
         // start — keeps the loop running, and its frames go on. One that goes on the renderer after
         // the display has stopped the loop gets no frame while it stands still
     ```

     werden zu

     ```
         // start — keeps the loop running, and its frames go on. One that is set on the renderer after
         // the display has stopped the loop gets no frame while the loop stands still
     ```

     Einrückung vier Leerzeichen wie bisher; die Zeilen sind 98 und 81 Zeichen breit, die Kommentare in `Display.ts` brechen bei 100 um. »its frames go on« in derselben Zeile bleibt — dort heißt »go on« »laufen weiter«, und genau das ist gemeint.
  3. `packages/twopoint5d/CHANGELOG.md:47` (Abschnitt `[Unreleased]` → `### Changed`, Eintrag »a paused `Display` lets the animation loop of its renderer rest«). Innerhalb der einen langen Zeile die Zeichenfolge

     ```
     A callback that goes on the renderer after the display has stopped the loop
     ```

     ersetzen durch

     ```
     A callback that is set on the renderer after the display has stopped the loop
     ```

     Der Rest der Zeile bleibt unverändert, die Zeile wird nicht umbrochen (jeder Eintrag der Liste steht auf einer Zeile). Kein neuer CHANGELOG-Eintrag: der geänderte Satz gehört zu einem Eintrag, der noch nicht veröffentlicht ist; veröffentlichte Abschnitte (ab `## [0.21.2]`, `:2348`) werden nicht angefasst.
  4. Nachprüfen: `grep -n "goes on the renderer" packages/twopoint5d/src/display/Display.ts packages/twopoint5d/CHANGELOG.md` findet nichts mehr; `pnpm exec prettier --check packages/twopoint5d/src/display/Display.ts packages/twopoint5d/CHANGELOG.md` ist grün.
  - Nicht anfassen, obwohl ähnlich klingend: `packages/twopoint5d/src/display/FrameLoop.ts:173` (»it goes on ticking« heißt »tickt weiter« und ist so gemeint), `packages/twopoint5d/CHANGELOG.md:910` (»a subscriber of your own goes onto the frame loop« — Richtungsangabe mit »onto«, ein Abonnent des `FrameLoop`, nicht ein Callback auf der Schleife von three; nicht zweideutig).
  - Konventionen des Plans: der neue Wortlaut steht für sich, kein Hinweis auf die frühere Formulierung in Code oder CHANGELOG.
- Verify: `pnpm run ci`
- Commit: `docs(display): say that a callback is set on the renderer where the docs of pause and the comment that stops the animation loop of three name one that gets no frame while the loop stands still, so it does not read as a callback that keeps running`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · TSDoc `pause` unverändert, eine Zeile höher bei `Display.ts:1165` (Plan: `:1166`) · `CHANGELOG.md:47` unverändert · Kommentar `#stopAnimationOfThree()` umgeformt nach `Display.ts:1737-1738` (Runde 2 von Paket 5; der Plan zitiert noch »One that goes on the renderer while the loop stands still«), dazu das zweideutige »it« im selben Satz · Queue »Offene Befunde« leer, keine offenen `Folgen:` unter den Paketen 1–5, nichts zu verteilen · Restplan: Paket 6 ist das einzige offene, danach der Abschluss
  - 2026-09-24 Zug 1: Implementierer beauftragt, günstigste Stufe (haiku), Effort low · Report `paket-6.impl-1.json`
  - 2026-09-24 Zug 2: Report FERTIG · Display.ts, CHANGELOG.md geändert · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-6.verify.log`)
  - 2026-09-24 Zug 3: Reviewer (sonnet, low) · alle drei Stellen erfüllt, 0 kritisch, 0 wichtig, 2 klein · Diff `paket-6.diff`
  - 2026-09-24 Zug 4: keine Runde nötig
  - 2026-09-24 Zug 5: Commit c983e745

## Abgleich

| Stelle | Stand | Fundstelle jetzt |
| --- | --- | --- |
| TSDoc `pause`, »A callback that goes on the renderer« | unverändert, eine Zeile verschoben | `packages/twopoint5d/src/display/Display.ts:1165` |
| CHANGELOG, derselbe Satz | unverändert | `packages/twopoint5d/CHANGELOG.md:47` |
| Kommentar in `#stopAnimationOfThree()` | umgeformt: jetzt »One that goes on the renderer after the display has stopped the loop gets no frame while it stands still« | `packages/twopoint5d/src/display/Display.ts:1737-1738` |

Weitere Fundstellen der Wendung: keine. Gesucht in `packages/`, `apps/`, `docs/` (ohne `docs/remediation/`) nach »goes on the renderer«, »go on the renderer«, »going on the renderer«, »goes onto«, »put on the renderer«; die Doku unter `packages/twopoint5d/docs/` und `src/stage/README.md` nennt `setAnimationLoop` gar nicht.

## Abweichung von der Vorlage

Der Plan verlangt nur »goes on« → »is set on«. Im Kommentar `Display.ts:1738` wird zusätzlich »while it stands still« zu »while the loop stands still«: nach der Ersetzung lautet der Satz »One that is set on the renderer after the display has stopped the loop gets no frame while it stands still«, und »it« kann dort auf den Callback (das Subjekt) wie auf »the loop« zeigen. Dieselbe Unschärfe im selben Satz, dieselbe Ursache wie der Befund; TSDoc und CHANGELOG sagen an der Stelle schon »while the loop stands still«. Ohne die Mitnahme bliebe genau der Satz zweideutig, den das Paket eindeutig machen soll, und der nächste Reviewer schnitte daraus ein Paket 7.

## Befund im Volltext

**Folge aus Paket 5 · klein (Reviewer, ohne eigene Runde) · `packages/twopoint5d/src/display/Display.ts:1166`, `packages/twopoint5d/CHANGELOG.md:47`**

Wortlaut des Reviewers: »goes on the renderer« (`Display.ts:1166`, `CHANGELOG.md:47`, Commit-Message) liest sich auch als »läuft weiter«; »is set on« wäre eindeutiger.

Aus dem Plan: »A callback that goes on the renderer after the display has stopped the loop« liest sich auch als »der weiterläuft«; gemeint ist ein Callback, der auf den Renderer gesetzt wird. Eindeutig: »is set on the renderer«. Dieselbe Wendung im Kommentar von `#stopAnimationOfThree()` mitziehen.

Die Commit-Message von Paket 5 (3fbfdb55) trägt die Wendung ebenfalls; sie ist committet und bleibt, wie sie ist.

## Urteil des Reviewers

- TSDoc `pause`: behoben — `packages/twopoint5d/src/display/Display.ts:1165`
- Kommentar `#stopAnimationOfThree()`: behoben — `packages/twopoint5d/src/display/Display.ts:1737-1738`
- CHANGELOG: behoben — `packages/twopoint5d/CHANGELOG.md:47`

Kleine Befunde:
- Der Abschnitt »Abweichung von der Vorlage« beschreibt als Abweichung, was Vorgehen-Punkt 2 bereits vorschreibt (Unstimmigkeit nur in dieser Datei, ohne Wirkung auf den Code).
- Vor dem Commit prüfen, dass nur `Display.ts` und `CHANGELOG.md` gestaged sind — geschehen.
