# Paket 18 — Zeilenbreite in Doku und Kommentaren

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — der Queue-Eintrag »in Paket 18 aufgenommen« (Prosa über 100
  Zeichen in `docs/text.md`, `docs/sprites.md`, `docs/proposals/dynamic-atlas-and-bitmap-text.md`)
  und die acht kleinen Reviewer-Befunde der Pakete 2, 4, 8, 10, 12, 19 aus »Folgen von«, dazu jeder
  Absatz derselben Ursache, den die Prüfung unten findet: zusammen 191 Absätze in 48 Dateien
- Ziel: Jeder Prosa-Absatz in Doku und Kommentaren ist auf die Breite seiner Datei umbrochen, ohne
  Inhaltsänderung.
- Modell: mittlere Stufe
- Effort: low
- Dateien: genau die 48 Dateien der Arbeitsliste unten (auch als Liste in
  `$ARBEITSDIR/paket-18.files.zug0.txt`); keine andere Datei des Repos ändert sich, keine kommt hinzu
- Werkzeuge im Arbeitsverzeichnis `$ARBEITSDIR` =
  `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/cedc8d36-b4ab-44d5-99e0-ae0ffbada2ae/scratchpad`
  (nicht im Repo, nicht ändern — sie sind der Maßstab):
  - `paket-18.widths.py` — die Prüfung (`python3 -I … ` ohne Argument: ein Befund je Zeile, Exit 1
    bei einem), die Arbeitsliste (`--list`) und der Inhaltsvergleich (`--content <ref>`); die Regeln
    stehen in ihrem Kopfkommentar
  - `paket-18.worklist.zug0.txt` — die Arbeitsliste, Stand `eb20cfe6` (dieselbe wie unten)
  - `paket-18.widths.zug0.txt` — die Einzelbefunde zu jedem Absatz der Liste, mit Zeilen und Längen
  - `paket-18.simulate.zug0.py` — der Beleg, dass die Regeln aufgehen: setzt Schritt 3 und 4 im
    Speicher um, schreibt nichts ins Repo und den simulierten Diff in die Datei des zweiten
    Arguments (`python3 -I paket-18.simulate.zug0.py $ARBEITSDIR <diff-datei>`); Ergebnis in Zug 0:
    `left 0 content diffs 0 files 48`
- Vorgehen:
  1. **Vorab** `AGENTS.md` lesen und den Abschnitt »Konventionen« im Kopf von
     `./remediation-plan.md`. Hilfsskripte, Notizen und Umleitungen gehören nach `$ARBEITSDIR`, nie
     ins Repo (Paket 17 hat drei Streudateien im Repo-Root hinterlassen).
  2. **Arbeitsliste lesen.** Je Datei ein Absatz je Zeile: `a–b  from s  Regeln  wrap at W` — der
     Absatz steht in `eb20cfe6` auf den Zeilen a bis b, er wird ab Zeile s bis zu seinem Ende b neu
     umbrochen, auf höchstens W Zeichen je Zeile; die Zeilen a bis s−1 bleiben, wie sie sind. Je
     Datei **von unten nach oben** arbeiten, dann gelten die Nummern der Liste bis zum letzten
     Absatz der Datei.
  3. **Neu umbrechen**, je Absatz der Liste, nach diesen Regeln:
     - *Start in einem offenen Codespan:* beginnt Zeile s innerhalb eines Codespans, den eine
       frühere Zeile des Absatzes geöffnet hat (die Zeilen a bis s−1 tragen zusammen eine ungerade
       Zahl einzelner Backticks), beginnt der Umbruch an der Zeile, die ihn geöffnet hat.
     - *Tokens:* die Wörter der Zeilen s bis b in ihrer Reihenfolge. Ein Codespan (`` `…` ``, auch
       mit Leerzeichen darin, das Zitat einer Meldung eingeschlossen) und ein `{@link …}` sind je
       ein Token, zusammen mit dem, was ohne Leerzeichen an ihnen hängt (`` (`x y`), `` ist ein
       Token); sie werden nie gebrochen. Ein Codespan, den der Text über zwei Zeilen gebrochen hat,
       wird ein Token, sobald beide Zeilen im umbrochenen Teil liegen.
     - *Präfix:* Zeile s behält ihr Präfix — in Markdown ihre Einrückung (ein Listenmarker am Anfang
       ist das erste Token), in einem Kommentar `<Einrückung> * ` bzw. `<Einrückung>// ` samt der
       Einrückung ihres Texts (ein Listenmarker oder ein Tag am Anfang ist das erste Token). Jede
       weitere Zeile bekommt das Präfix, das Zeile s+1 im Text hat. Ist s die letzte Zeile des
       Absatzes (s = b, in der Liste nur in Markdown): das Präfix von Zeile s; beginnt ihr Text mit
       einem Listenmarker, dazu so viele Leerzeichen, wie Marker und Leerzeichen breit sind
       (`- ` → 2, `14. ` → 4).
     - *Gierig füllen:* eine Zeile nimmt das nächste Token, solange sie samt Präfix höchstens W
       Zeichen hat; ein Token, das schon allein mit dem Präfix über W kommt, steht allein auf seiner
       Zeile (so stehen Meldungszitate, die länger sind als W).
     - *Keine neue Struktur:* keine neue Zeile darf mit einem Token beginnen, das der Leser als
       Blockanfang nähme — in Markdown `-`, `+`, `*`, `>…`, `#…`, `|…`, `<…`, `=…`, eine Zahl mit `.`
       oder `)` (`1.`, `12)`), ` ``` ` oder `~~~`; in einem Kommentar dieselben und dazu `@…` (ein
       TSDoc-Tag) und `*/`. Fiele eines an den Zeilenanfang, endet die Zeile davor ein Token früher.
     - *Sonst nichts:* kein Wort, kein Satzzeichen, keine Leerzeile ändert sich; Codeblöcke (jeder
       `ts check`-Block eingeschlossen), Tabellen, Überschriften, Zitate (`>`), HTML-Zeilen,
       Linkdefinitionen und alles außerhalb der 191 Absätze bleiben Byte für Byte.
     Für 191 Absätze lohnt ein Hilfsskript `$ARBEITSDIR/paket-18.reflow.py`, das diese Regeln
     umsetzt; es darf `paket-18.widths.py` als Modul laden (`tokens()`, `MARKER`). Von Hand geht es
     auch — es entscheiden die Prüfungen in Schritt 4 und 5.
  4. **Prüfen:** `python3 -I $ARBEITSDIR/paket-18.widths.py` (im Repo-Root) gibt nichts aus und endet
     mit Exit 0. Steht ein Absatz danach noch da (in der Simulation von Zug 0 waren es drei:
     `packages/twopoint5d/docs/architecture.md:140–154`, `Display.ts:1937–1943`,
     `InstancedVOBufferGeometry.ts:217–225`), wird er ganz neu umbrochen — ab seiner ersten Zeile,
     mit dem W der Arbeitsliste. Hält die Prüfung danach noch einen Absatz fest, den diese Regeln
     nicht lösen, bleibt die Prüfung, wie sie ist: der Absatz kommt mit Zeile und Befund in den
     Report (`FERTIG_MIT_VORBEHALT`).
  5. **Inhalt prüfen:** `python3 -I $ARBEITSDIR/paket-18.widths.py --content HEAD` meldet
     `0 difference(s)` und endet mit Exit 0 — jede geänderte Datei hat dieselben Wörter in denselben
     Absätzen, dieselben festen Zeilen (Codeblöcke, Tabellen, Überschriften, Zitate, HTML, in
     `AGENTS.md` alles außer dem Punkt »Error and warning messages«) und dieselben Codezeilen wie
     `HEAD`.
  6. **Diff lesen:** `git diff` einmal ganz durchsehen — jeder Hunk verschiebt nur Zeilenumbrüche
     innerhalb eines Absatzes. `git status --porcelain` zeigt die 48 Dateien der Liste und sonst nur
     die ungetrackten Laufdateien (`remediation-plan.md`, `docs/remediation/`).
  7. Kein CHANGELOG-Eintrag, keine Doku-Ergänzung: das Paket ändert kein Verhalten und keine
     Signatur, das TSDoc behält jedes Wort.
- Verify: `cd /home/spw/spaceland/twopoint5d && python3 -I /tmp/claude-1000/-home-spw-spaceland-twopoint5d/cedc8d36-b4ab-44d5-99e0-ae0ffbada2ae/scratchpad/paket-18.widths.py && python3 -I /tmp/claude-1000/-home-spw-spaceland-twopoint5d/cedc8d36-b4ab-44d5-99e0-ae0ffbada2ae/scratchpad/paket-18.widths.py --content HEAD && pnpm run ci`
- Commit: `docs: wrap the paragraphs of the guides, the proposals and the architecture docs that run past the width of their file or break unevenly, and the uneven comment paragraphs of the library at the width of their block, without changing a word`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · Queue-Eintrag besteht, gewandert und kleiner (`text.md`
    9 Zeilen über 100: `:20`, `:66`, `:67`, `:96`, `:116`, `:117`, `:173`, `:184`, `:186`; `sprites.md`
    30 Absätze, `dynamic-atlas-and-bitmap-text.md` 15) · Folgen: Paket 2 `docs/architecture.md:290`
    (91) umgeformt, Paket 4 und 8 `AdaptiveResolution.ts:119–133` ein Absatz (Restzeile `:128`),
    `VertexObjectPool.ts:91–95`, `StageRenderer.ts:279–288` und `:1274–1287`, `pool-sorting.md:236`,
    `dynamic-atlas-and-bitmap-text.md:414` unverändert, `:597–599` → `:600–604`, `AGENTS.md:103–121`
    besteht · gleiche Ursache: 191 Absätze in 48 Dateien (174 Zeilen über der Breite, 33 + 29
    ungleich umbrochene Absätze) · Umbruch nach den Regeln in Zug 0 im Speicher simuliert: zwei
    Durchgänge, 0 Befunde, 0 Inhaltsabweichungen, rund 650 geänderte Zeilen · keine offene
    `Folgen:`-Zeile eines erledigten Pakets; die Queue-Einträge `SpritePicker.ts:279–280`,
    `extractSnippets.mjs:33`/`:176`, `:224–244`, `layoutText.spec.ts:59`/`:65` teilen die Ursache
    nicht und bleiben für den Abschluss
  - 2026-10-22 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-18.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG · 48 Dateien der Arbeitsliste geändert (+708 −684), Arbeitsbaum schmutzig · Verify exit=0 (`paket-18.verify.log`)
  - 2026-10-22 Zug 3: Reviewer beauftragt (sonnet, effort low), Diff `paket-18.diff`
  - 2026-10-22 Zug 3: Urteil: alle Punkte erfüllt, 0 kritisch, 0 wichtig, 2 klein · Zug 4: keine Runde
  - 2026-10-22 Zug 5: Commit `4b013345`, 48 Dateien, Verify `paket-18.verify.log` exit=0

## Breiten

| Dateien | Breite | Grund |
| --- | --- | --- |
| `packages/twopoint5d/docs/**/*.md` außer `resource-lifecycle.md`; `packages/twopoint5d/src/**/*.md` außer `src/stage/README.md` | 100 | Doku-Konvention des Laufs (Pakete 8, 10, 12, 17); gemessen: das 90. Perzentil der Zeilen, denen eine Zeile ihres Absatzes folgt, liegt bei 92–101 |
| `docs/architecture.md`; `AGENTS.md`, nur der Punkt »Error and warning messages« (`:103–121`); `packages/twopoint5d/docs/resource-lifecycle.md`; `packages/twopoint5d/src/stage/README.md` | 90 | die Breite dieser Dateien: 90. Perzentil 86–89; Paket 17 für `docs/architecture.md`, Paket 19 für `AGENTS.md` |
| Kommentare (`/* */`, `/** */`, `//`) in `.ts`, `.js`, `.mjs` unter `packages/twopoint5d/src/` | die des Blocks: »wrap at« der Liste, höchstens 130 | Biome `lineWidth` 130 ist die einzige feste Grenze; die Dateien brechen Kommentare verschieden breit um (Klassen-TSDoc von `Display` ≈ 80, `DynamicAtlas` ≈ 105) — ein Absatz folgt seinem Block |

Gezählt werden Zeichen als Unicode-Codepoints (Pythons `len()`), nicht Bytes: `—`, `×`, `·`, `→`
zählen je eins. Ein Hilfsskript, das Bytes zählt (`awk` ohne UTF-8-Locale, `wc -c`), bricht zu früh um.

Die Prüfung (`paket-18.widths.py`, Kopfkommentar) meldet:

- **MD-1** — eine Prosazeile einer Doku-Datei ist länger als deren Breite und hat mehr als ein Token;
- **C-1** — eine Kommentarzeile ist länger als 130 (heute keine);
- **MD-2, C-2** — ein Absatz ist nicht auf eine Breite umbrochen: eine seiner Zeilen läuft mehr als
  10 Spalten über die Stelle hinaus, an der eine andere seiner Zeilen umbrach, obwohl das nächste
  Wort noch gepasst hätte (Länge der Zeile + 1 + erstes Token der Folgezeile). Eine Zeile, die einen
  Satz beendet (`.` `?` `!` `:` `;`), darf früh umbrechen, in `//`-Notizen auch eine vor einem
  großgeschriebenen Wort; eine Zeile aus einem einzigen Token darf lang sein. Ein Kommentarabsatz,
  der Spalten ausrichtet (zwei Leerzeichen in einer Zeile) oder zeichnet (Box-Zeichen), ist keine
  Prosa und fällt heraus.

## Abgleich

Am Code von `eb20cfe6` nachgesehen.

| Punkt | Stand | Fundstelle jetzt |
| --- | --- | --- |
| Queue-Eintrag: Prosa über 100 in `docs/text.md`, `docs/sprites.md`, `dynamic-atlas-and-bitmap-text.md` | besteht, gewandert; kleiner, weil die Pakete 8, 10, 12, 17 einen Teil umbrochen haben | `text.md` `:20`, `:66`, `:67`, `:96`, `:116`, `:117`, `:173`, `:184`, `:186` (101–103); `sprites.md` 30 Absätze, `dynamic-atlas-and-bitmap-text.md` 15 Absätze der Liste; die Meldungszitate, die dort allein auf ihrer Zeile stehen (`:209`, `:211`, `:235`, `:238`, `:580` …), und die Zitatzeilen `:144`, `:407` bleiben lang (Regel »Codespans bleiben ganz«) |
| Paket 2: `docs/architecture.md` §4, Absatz `catalog:` bis `link:`, eine überlange Zeile | besteht, umgeformt: Paket 8 hat die 159-Zeichen-Zeile umbrochen, `:290` hat noch 91 | `docs/architecture.md:279–304`, ab `:290` |
| Paket 4: `AdaptiveResolution.ts:124`, Klassen-TSDoc nicht neu umbrochen | besteht, umgeformt: Paket 8 hat den Absatz nur bis zur Einfügestelle umbrochen, Restzeile `:128` (64) | `AdaptiveResolution.ts:119–133`, ab `:122` |
| Paket 8: `AdaptiveResolution.ts:183–184`, halbe Zeile »… or a 30 Hz« | derselbe Absatz wie bei Paket 4 (der Reviewer nannte Zeilen des Diffs) | wie oben |
| Paket 8: `VertexObjectPool.ts:90–94`, Feldkommentar bis 104, Restzeile »buffer« | unverändert (105, 103, 104, `// buffer`) | `VertexObjectPool.ts:91–95`, ganz |
| Paket 8: `StageRenderer.ts:283–287` und `:1279–1283`, kurze Restzeilen | unverändert | `StageRenderer.ts:279–288` ab `:283`, `:1274–1287` ab `:1279` |
| Paket 8: `pool-sorting.md:236`, 104 Zeichen | unverändert | `pool-sorting.md:236–238` |
| Paket 10: Bullet »font data that is no object«, 132 Zeichen | unverändert | `dynamic-atlas-and-bitmap-text.md:414`; das Meldungszitat kommt auf eine eigene Zeile, wie der Reviewer vorschlug |
| Paket 12: `dynamic-atlas-and-bitmap-text.md:597–599`, §6 nicht neu umbrochen | gewandert | `:600–604`, ab `:601` (»(§3.7). `BitmapFont` and its atlas are plain«, 44) |
| Paket 19 (aufgenommen in Zug 0 Paket 17): `AGENTS.md:119`, Absatz endet mit kurzer Zeile | besteht; `:118` hat 91 bei Breite 90 | `AGENTS.md:103–121`, ab `:118`; `:115` (65) bleibt — ihr folgt das Token `` (`getAsync("hero", ["atlas", "texture"])`) `` mit 42 Spalten, mehr passt nicht auf die Zeile |
| gleiche Ursache | die übrigen Absätze der Liste: Zeilen über der Breite und ungleich umbrochene Absätze in Guides, Proposals, READMEs unter `src/` und Kommentaren, vorbestehend oder von früheren Paketen des Laufs; Ziel und Bereich des Grobplans nennen sie schon | Arbeitsliste |

## Entscheidungen dieses Pakets

- **Kein Generalumbruch.** Gierig auf die Dateibreite umbrochen, änderte sich in den Guides und
  Proposals jede Zeile, die noch ein Wort aufnehmen könnte — rund 1 360 —, ohne dass sie fehlerhaft
  wäre: Handumbruch schwankt. Das Paket nimmt, was die Prüfung als Mangel erkennt: Zeilen über der
  Breite und Absätze, die sichtbar nicht auf eine Breite umbrochen sind. Die Schwelle von 10 Spalten
  liegt über dem Schwanken eines Handumbruchs; die benannten Reviewer-Stellen liegen bei 15 bis 89.
- **Neu umbrochen ab der ersten Zeile, die sich ändern muss.** Der Kopf eines Absatzes und bewusste
  Umbrüche davor bleiben stehen (etwa die Loader in `resource-lifecycle.md:17–23`, einer je Zeile),
  und der Diff bleibt klein. Simuliert: nach zwei Durchgängen kein Befund.
- **Codespans bleiben ganz.** Ein Meldungszitat bleibt so greifbar und mit dem Code vergleichbar
  (Paket 17 hat 86 Zitate gegen die Templates gehalten); Paket 12 hat Meldungszitate über 100
  zugelassen, der Reviewer von Paket 10 schlug die eigene Zeile vor. Eine Zeile, die nur ein Token
  trägt, darf deshalb über die Breite gehen. Codespans, die der Text heute schon über zwei Zeilen
  bricht (rund 200 Stellen), bleiben außerhalb der Liste so.
- **Kommentare ohne Dateibreite.** Biome begrenzt Kommentare nur bei 130, und die Dateien brechen
  sie unterschiedlich breit um; ein Absatz wird deshalb auf die Breite seines Blocks umbrochen
  (90. Perzentil der übrigen Absätze des Blocks, sonst der Kommentare der Datei). Einzeilige
  Kommentare unter 130 sind kein Mangel.
- **Satzenden dürfen früh umbrechen.** Ältere Kommentare schreiben einen Satz je Zeile
  (`Stage2D.ts:34–36`); ein `//`-Hinweis je Zeile ohne Schlusspunkt (`ProjectionPlane.spec.ts:55–56`)
  ebenso.
- **Nicht in diesem Paket:** `CHANGELOG.md` (ein Eintrag je Zeile, freigegebene Abschnitte
  unveränderlich), `docs/superpowers/**` und `docs/remediation/**` (datierte Arbeitspapiere),
  `apps/lookbook/**`, `packages/twopoint5d-testing/**`, `scripts/**` (nicht im Bereich des
  Grobplans; die Prüfung von Paket 8 auf Kommentarzeilen über 130 findet dort heute nichts),
  `AGENTS.md` außerhalb des einen Punkts, Template-Strings (keine Kommentare, Biome bricht sie nicht).
- **Kein Breiten-Check im Gate.** Die Prüfung bleibt ein Werkzeug dieses Pakets im
  Arbeitsverzeichnis; ein neuer Schritt in `pnpm run ci` wäre eine neue Regel für jeden Beitrag und
  gehört nicht zum freigegebenen Weg (der Grobplan verlangt den Umbruch).
- **Kein CHANGELOG-Eintrag:** kein Verhalten, keine Signatur, kein Wort ändert sich.

## Arbeitsliste

Stand `eb20cfe6`, erzeugt mit `python3 -I $ARBEITSDIR/paket-18.widths.py --list` (Datei
`paket-18.worklist.zug0.txt`). Die Einzelbefunde je Absatz stehen in `paket-18.widths.zug0.txt`.

```text
AGENTS.md
  103–121  from 118  MD-1/MD-2  wrap at 90
docs/architecture.md
  197–202  from 198  MD-1  wrap at 90
  247–261  from 253  MD-2  wrap at 90
  279–304  from 290  MD-1  wrap at 90
packages/twopoint5d/docs/architecture.md
  119–136  from 126  MD-2  wrap at 100
  140–154  from 150  MD-2  wrap at 100
  168–186  from 177  MD-2  wrap at 100
packages/twopoint5d/docs/display.md
  138–139  from 139  MD-1  wrap at 100
  149–156  from 152  MD-1  wrap at 100
packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md
  3–7  from 4  MD-1/MD-2  wrap at 100
  451–456  from 451  MD-1/MD-2  wrap at 100
packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md
  138–142  from 139  MD-1  wrap at 100
  232–241  from 233  MD-1  wrap at 100
  266–268  from 267  MD-1  wrap at 100
  269–271  from 270  MD-1  wrap at 100
  391–396  from 395  MD-1  wrap at 100
  414–414  from 414  MD-1  wrap at 100
  420–420  from 420  MD-1  wrap at 100
  504–507  from 506  MD-1  wrap at 100
  554–558  from 555  MD-1  wrap at 100
  581–583  from 581  MD-1/MD-2  wrap at 100
  600–604  from 601  MD-2  wrap at 100
  608–613  from 608  MD-1/MD-2  wrap at 100
  617–627  from 620  MD-2  wrap at 100
  652–655  from 653  MD-1  wrap at 100
  656–657  from 656  MD-1  wrap at 100
packages/twopoint5d/docs/proposals/fade-flash-axis-billboards.md
  17–20  from 17  MD-2  wrap at 100
packages/twopoint5d/docs/proposals/flat-placement-orientation.md
  21–24  from 22  MD-2  wrap at 100
packages/twopoint5d/docs/proposals/flip-anchor-nine-slice.md
  3–6  from 5  MD-1  wrap at 100
  8–10  from 10  MD-1  wrap at 100
  13–14  from 13  MD-1  wrap at 100
  105–109  from 108  MD-1  wrap at 100
  178–180  from 178  MD-1  wrap at 100
  187–188  from 187  MD-1  wrap at 100
  190–194  from 191  MD-1  wrap at 100
  197–200  from 198  MD-1  wrap at 100
  218–223  from 219  MD-1  wrap at 100
  263–272  from 263  MD-1  wrap at 100
  300–301  from 300  MD-1  wrap at 100
  328–329  from 328  MD-1  wrap at 100
  335–336  from 335  MD-1  wrap at 100
  337–344  from 337  MD-1/MD-2  wrap at 100
  345–351  from 345  MD-1  wrap at 100
  373–376  from 374  MD-1  wrap at 100
  439–440  from 439  MD-1  wrap at 100
  441–442  from 441  MD-1  wrap at 100
  443–444  from 443  MD-1  wrap at 100
packages/twopoint5d/docs/proposals/gpu-picking.md
  7–9  from 7  MD-1  wrap at 100
  10–12  from 11  MD-1  wrap at 100
  108–112  from 110  MD-1  wrap at 100
  113–120  from 116  MD-1  wrap at 100
  126–129  from 127  MD-1  wrap at 100
  178–187  from 187  MD-1  wrap at 100
  188–190  from 188  MD-1  wrap at 100
  211–215  from 213  MD-1  wrap at 100
  228–232  from 229  MD-1  wrap at 100
  234–240  from 236  MD-2  wrap at 100
  249–250  from 249  MD-1  wrap at 100
  254–262  from 255  MD-1  wrap at 100
  266–272  from 268  MD-1  wrap at 100
  273–277  from 274  MD-1  wrap at 100
  301–311  from 302  MD-1  wrap at 100
  319–323  from 321  MD-1  wrap at 100
packages/twopoint5d/docs/proposals/growing-capacity.md
  3–5  from 4  MD-1  wrap at 100
  7–8  from 8  MD-1  wrap at 100
  65–67  from 65  MD-1  wrap at 100
  83–88  from 85  MD-2  wrap at 100
  116–120  from 117  MD-1  wrap at 100
packages/twopoint5d/docs/proposals/pipeline-stages-and-grid-base.md
  426–437  from 431  MD-1/MD-2  wrap at 100
packages/twopoint5d/docs/proposals/pool-sorting.md
  3–5  from 4  MD-1  wrap at 100
  9–10  from 9  MD-1  wrap at 100
  11–13  from 11  MD-1  wrap at 100
  81–90  from 84  MD-1  wrap at 100
  140–143  from 142  MD-1  wrap at 100
  236–238  from 236  MD-1  wrap at 100
  261–272  from 264  MD-1/MD-2  wrap at 100
  297–303  from 297  MD-1  wrap at 100
  306–306  from 306  MD-1  wrap at 100
packages/twopoint5d/docs/proposals/sprite-and-texture-roadmap.md
  21–29  from 23  MD-2  wrap at 100
  288–292  from 289  MD-1  wrap at 100
  326–331  from 327  MD-1/MD-2  wrap at 100
  362–366  from 363  MD-1/MD-2  wrap at 100
  450–452  from 450  MD-2  wrap at 100
  652–655  from 655  MD-1  wrap at 100
packages/twopoint5d/docs/proposals/sprite-features.md
  556–562  from 558  MD-2  wrap at 100
packages/twopoint5d/docs/proposals/sprite-uniform-bindings.md
  91–91  from 91  MD-1  wrap at 100
  144–147  from 144  MD-1  wrap at 100
  217–221  from 217  MD-1/MD-2  wrap at 100
  389–392  from 389  MD-1  wrap at 100
packages/twopoint5d/docs/proposals/table-frames-and-palette-swap.md
  16–21  from 16  MD-2  wrap at 100
  114–119  from 118  MD-1  wrap at 100
  124–125  from 124  MD-1  wrap at 100
  209–212  from 210  MD-1  wrap at 100
  215–219  from 217  MD-1  wrap at 100
  251–252  from 251  MD-1  wrap at 100
  253–254  from 254  MD-1  wrap at 100
  258–261  from 260  MD-1  wrap at 100
  342–346  from 345  MD-1  wrap at 100
  350–352  from 350  MD-1  wrap at 100
  371–372  from 371  MD-1  wrap at 100
packages/twopoint5d/docs/proposals/wave-and-segment-sprites.md
  16–20  from 17  MD-1  wrap at 100
  52–55  from 52  MD-1  wrap at 100
  89–92  from 92  MD-1  wrap at 100
  122–125  from 124  MD-1  wrap at 100
  269–279  from 275  MD-1  wrap at 100
  285–288  from 285  MD-1  wrap at 100
  294–295  from 294  MD-1  wrap at 100
  357–359  from 359  MD-1  wrap at 100
  380–382  from 382  MD-1  wrap at 100
  388–396  from 388  MD-1  wrap at 100
  405–412  from 406  MD-1  wrap at 100
  520–520  from 520  MD-1  wrap at 100
  521–522  from 521  MD-1  wrap at 100
  523–523  from 523  MD-1  wrap at 100
packages/twopoint5d/docs/resource-lifecycle.md
  16–30  from 29  MD-1  wrap at 90
packages/twopoint5d/docs/sprites.md
  104–108  from 105  MD-1  wrap at 100
  176–179  from 178  MD-1  wrap at 100
  578–580  from 578  MD-1  wrap at 100
  627–635  from 627  MD-1  wrap at 100
  636–640  from 637  MD-1  wrap at 100
  913–916  from 915  MD-1  wrap at 100
  971–974  from 972  MD-1  wrap at 100
  1013–1018  from 1016  MD-1  wrap at 100
  1024–1028  from 1026  MD-1  wrap at 100
  1030–1030  from 1030  MD-1  wrap at 100
  1034–1039  from 1036  MD-2  wrap at 100
  1431–1437  from 1434  MD-1  wrap at 100
  1501–1513  from 1502  MD-1  wrap at 100
  1516–1526  from 1521  MD-1  wrap at 100
  1578–1586  from 1585  MD-1  wrap at 100
  1609–1613  from 1610  MD-1  wrap at 100
  1617–1624  from 1620  MD-1  wrap at 100
  1626–1639  from 1633  MD-1  wrap at 100
  1641–1645  from 1642  MD-1  wrap at 100
  1647–1651  from 1648  MD-1  wrap at 100
  1698–1704  from 1703  MD-1  wrap at 100
  1731–1733  from 1731  MD-2  wrap at 100
  1783–1787  from 1783  MD-1  wrap at 100
  1788–1789  from 1788  MD-1  wrap at 100
  1790–1795  from 1790  MD-1  wrap at 100
  1799–1804  from 1799  MD-1  wrap at 100
  1988–1994  from 1991  MD-1  wrap at 100
  2321–2327  from 2325  MD-2  wrap at 100
  2759–2763  from 2763  MD-1  wrap at 100
  2767–2770  from 2768  MD-1  wrap at 100
packages/twopoint5d/docs/text.md
  20–21  from 20  MD-1  wrap at 100
  66–69  from 66  MD-1  wrap at 100
  94–98  from 96  MD-1  wrap at 100
  114–117  from 116  MD-1  wrap at 100
  171–180  from 173  MD-1  wrap at 100
  184–187  from 184  MD-1  wrap at 100
packages/twopoint5d/src/stage/README.md
  299–301  from 300  MD-1/MD-2  wrap at 90
  405–412  from 409  MD-2  wrap at 90
  666–672  from 668  MD-1/MD-2  wrap at 90
  673–683  from 676  MD-1/MD-2  wrap at 90
packages/twopoint5d/src/text/fixtures/README.md
  6–6  from 6  MD-1  wrap at 100
  17–18  from 17  MD-1  wrap at 100
packages/twopoint5d/src/texture/fixtures/aseprite/README.md
  17–19  from 17  MD-1  wrap at 100
packages/twopoint5d/src/texture/fixtures/free-tex-packer/README.md
  3–5  from 4  MD-1  wrap at 100
packages/twopoint5d/src/vertex-objects/README.md
  3–6  from 5  MD-2  wrap at 100
  246–253  from 253  MD-1  wrap at 100
  261–263  from 263  MD-1  wrap at 100
packages/twopoint5d/src/controls/PanControl2D.ts
  775–780  from 775  C-2  wrap at 90
packages/twopoint5d/src/display/AdaptiveResolution.ts
  119–133  from 122  C-2  wrap at 98
packages/twopoint5d/src/display/Display.ts
  481–497  from 482  C-2  wrap at 79
  517–532  from 518  C-2  wrap at 79
  814–822  from 818  C-2  wrap at 98
  993–1000  from 993  C-2  wrap at 77
  1937–1943  from 1940  C-2  wrap at 98
packages/twopoint5d/src/display/FixedFrameLoop.ts
  135–137  from 135  C-2  wrap at 95
  154–156  from 154  C-2  wrap at 95
packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.ts
  65–66  from 65  C-2  wrap at 98
packages/twopoint5d/src/map2d/Map2DTileStreamer.ts
  10–13  from 10  C-2  wrap at 100
  15–18  from 16  C-2  wrap at 100
packages/twopoint5d/src/map2d/chunk-quad-tree/IDataChunk2D.ts
  6–7  from 6  C-2  wrap at 65
packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts
  616–625  from 618  C-2  wrap at 102
packages/twopoint5d/src/sprites/features/AnimatedFrames.ts
  7–11  from 7  C-2  wrap at 101
packages/twopoint5d/src/stage/Stage2D.ts
  38–42  from 38  C-2  wrap at 98
packages/twopoint5d/src/stage/StageRenderTargetPool.ts
  51–55  from 52  C-2  wrap at 98
packages/twopoint5d/src/stage/StageRenderer.ts
  279–288  from 283  C-2  wrap at 99
  1274–1287  from 1279  C-2  wrap at 81
packages/twopoint5d/src/texture/PowerOf2ImageLoader.ts
  43–46  from 43  C-2  wrap at 112
packages/twopoint5d/src/texture/TextureAtlas.ts
  113–114  from 113  C-2  wrap at 104
packages/twopoint5d/src/texture/TextureCoords.ts
  182–184  from 182  C-2  wrap at 120
packages/twopoint5d/src/texture/TextureImageLoader.ts
  58–62  from 58  C-2  wrap at 99
packages/twopoint5d/src/texture/TextureResource.ts
  417–421  from 418  C-2  wrap at 100
packages/twopoint5d/src/texture/TileSetLoader.ts
  61–65  from 61  C-2  wrap at 99
packages/twopoint5d/src/texture/fixtures/aseprite/generate.mjs
  1–3  from 1  C-2  wrap at 91
packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts
  217–225  from 220  C-2  wrap at 98
packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts
  14–19  from 16  C-2  wrap at 99
packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts
  91–95  from 91  C-2  wrap at 102

```

## Findings im Volltext

**Queue-Eintrag (Paket 10, Urteil `→ Scope`, in Paket 18 aufgenommen in der Drain-Runde 2026-10-22)**
— `packages/twopoint5d/docs/text.md:20`, `:30`, `:66`, `:67`, `:96`, `:116`, `:117`, `:172`, `:183`,
`:185` u. a., `docs/sprites.md:105`, `:178`, `:541–556`, `:600`,
`docs/proposals/dynamic-atlas-and-bitmap-text.md:137`, `:204–239`, `:609–612` — Prosa über 100
Zeichen je Zeile gegen die Doku-Konvention; stand schon in `2fc5ddd2` (text.md 18, sprites.md 85
solche Zeilen).

**Kleine Reviewer-Befunde (Folgen von Paket 2, 4, 8, 10, 12, 19)**

- Paket 2 — `docs/architecture.md` §4, Absatz zu `catalog:`/`link:`: »Der Absatz ist an einer Stelle
  zu einer sehr langen Zeile geraten (»number, stays standing with a warning, and the build fails on
  it the same way, with a message that names the section, the name and the value. The script
  writes«). Neu umbrechen wie der Rest der Datei.«
- Paket 4 — `packages/twopoint5d/src/display/AdaptiveResolution.ts:124`: »Nach dem Einschub ist der
  Absatz der Klassen-TSDoc nicht neu umbrochen worden. Die Zeile ist rund 150 Zeichen lang und fällt
  aus dem Umbruch des übrigen Kommentars.«
- Paket 8 — `src/display/AdaptiveResolution.ts:183–184`: »Der neue Umbruch endet auf eine halbe Zeile
  (»… a power-saving mode or a 30 Hz«), bevor die alte Zeile weiterläuft. Der Absatz ist nur bis zur
  Einfügestelle neu umbrochen.«
- Paket 8 — `src/vertex-objects/VertexObjectPool.ts:90–94`: »Der umbrochene Feldkommentar läuft bis
  104 Zeichen, deutlich über die umgebenden ≈ 100. Außerdem hängt eine Zeile, die nur aus »buffer«
  besteht, vor der unveränderten Zeile »with a view of it per data type«; der Umbruch ist
  zerfranst.«
- Paket 8 — `src/stage/StageRenderer.ts:283–287` und `:1279–1283`: »Wo im `parent`-Setter und in
  `add()` Satzteile weggefallen sind, bleiben kurze Restzeilen stehen (»several as an
  `AggregateError`. An«, »the listeners. A listener that disposes this renderer or gives it
  another«). Der Absatz wurde nicht neu umbrochen.«
- Paket 8 — `docs/proposals/pool-sorting.md:236`: »Die neu geschriebene Zeile hat 104 Zeichen; die
  Datei bricht sonst um ≈ 100 um.«
- Paket 10 — `docs/proposals/dynamic-atlas-and-bitmap-text.md` (Bullet »font data that is no object:
  …«, 132 Zeichen): »Die Prosa geht über 100 Zeichen, weil eine Meldung inline zitiert wird. […]
  Sauberer wäre die Meldung als eigene Zeile oder als Blockzitat.«
- Paket 12 — `dynamic-atlas-and-bitmap-text.md:597–599`: »Der Umbruch in §6 lässt eine auffällig
  kurze Zeile stehen (»(§3.7). `BitmapFont` and its atlas are plain«). Das Absatzende ist nicht neu
  umbrochen.«
- Paket 19 — `AGENTS.md:117` (jetzt `:119`): »der Absatz endet mitten im Punkt mit einer kurzen Zeile
  (54 Zeichen), der Rest des Punkts ist nicht neu umbrochen; Breite ≤ 89 hält.« Zug 0 Paket 17 nannte
  dazu `:115` mit 65 und `:121` mit 64.

## Review

Reviewer-Report `paket-18.review-0.json`, Diff `paket-18.diff`.

| Punkt | Urteil | Fundstelle |
| --- | --- | --- |
| Queue-Eintrag (`text.md`, `sprites.md`, `dynamic-atlas-and-bitmap-text.md`) | behoben | alle drei im Diff, keine Zeile über der Breite außer Ein-Token-Zeilen |
| Paket 2: `docs/architecture.md` §4 | behoben | `:288–296` höchstens 90 |
| Paket 4 und 8: `AdaptiveResolution.ts` Klassen-TSDoc | behoben | `:119–133`, Restzeile weg, »30 Hz« in `:128–129` |
| Paket 8: `VertexObjectPool.ts:91–95` | behoben | vier gefüllte Zeilen, `// buffer` weg |
| Paket 8: `StageRenderer.ts:283–287`, `:1279–1283` | behoben | gefüllt auf ≈100 bzw. ≈80 |
| Paket 8: `pool-sorting.md:236` | behoben | `:236–238` |
| Paket 10: Bullet »font data that is no object« | behoben | `dynamic-atlas-and-bitmap-text.md:415–416` |
| Paket 12: §6 | behoben | `:604–607` |
| Paket 19: `AGENTS.md` »Error and warning messages« | behoben | `:103–121` höchstens 90 |
| gleiche Ursache, 191 Absätze | behoben | Prüfung 0 Befunde |

Kleine Befunde: (1) einige Absätze verschieben nur ein Wort je Zeile (`pool-sorting.md:264–265`,
`StageRenderer.ts:1279`), von den Regeln gedeckt; (2) Listenköpfe vor Meldungszitaten sind kürzer
geworden, gewollt.
