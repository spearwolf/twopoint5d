# Paket 14 — Nachzug: die Node-Untergrenze in Doku und Toolchain angleichen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — dieses Paket kommt aus der `Folgen:`-Zeile von
  Paket 11, triagiert in Zug 0 von Paket 12 als Symptom, das ein committetes
  Paket zurückgelassen hat
- Folge von: Paket 11
- Ziel: Wer die Node-Anforderung nachliest, findet überall die Zahl, die
  `engines` verlangt.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `AGENTS.md`, `README.md`, `docs/architecture.md`
- Unangetastet: `package.json`, `.nvmrc`, `mise.toml`,
  `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
  `packages/twopoint5d/CHANGELOG.md` — Begründung unter »Die Entscheidung aus
  Zug 0« und »Was nicht dazugehört«
- Verify: `pnpm run ci`
- Commit: `docs: name the node range that engines asks for, and say why the version managers carry a plain 24`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · alle vier Fundstellen der Folge aus
    Paket 11 unverändert bestätigt (`AGENTS.md:28`, `README.md:75`,
    `docs/architecture.md:108-109`, `.nvmrc`/`mise.toml` je `24`) · zwei
    weitere Stellen mit `node-version: 24` gefunden
    (`.github/workflows/ci.yml:21`, `deploy.yml:27`), beide korrekt, keine
    Änderung, aber im neuen Absatz von `architecture.md` mitgenannt · aus
    »Offene Befunde« nichts übernommen: keiner der neun offenen Einträge teilt
    die Ursache dieses Pakets · Restplan: Paket 14 ist das letzte, keine
    Umsortierung
  - 2026-09-20 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet,
    effort low), Report `paket-14.impl-1.json`
  - 2026-09-20 Zug 2: Report `FERTIG` · geändert `AGENTS.md`, `README.md`,
    `docs/architecture.md` · Arbeitsbaum jetzt schmutzig · eigener
    `pnpm run ci` exit=0, Log `paket-14.verify.log`
  - 2026-09-20 Zug 3: Reviewer (mittlere Stufe, effort low) · Ziel erfüllt,
    alle drei Ersetzungen zeichengenau und die zugesagten Dateien unangetastet ·
    kein kritischer, kein wichtiger Befund, zwei kleine · Diff
    `paket-14.diff`, Report `paket-14.review-1.json`
  - 2026-09-20 Zug 4: entfällt — keine nicht erfüllte Anforderung, kein
    kritischer und kein wichtiger Befund; 1 Runde
  - 2026-09-20 Zug 5: committet als `6f897686`, Marke im Plan auf `[x]`

## Urteil des Reviewers (Runde 1)

Dieses Paket trägt keine Audit-Findings; geurteilt wurde gegen die drei
Textersetzungen und das Ziel.

| Stelle | Urteil |
| --- | --- |
| `AGENTS.md:28` | erfüllt — Wortlaut zeichengenau, eine Zeile, `>=10.22.0` deckt sich mit `package.json:10` |
| `README.md:75` | erfüllt — Wortlaut zeichengenau, eine Zeile; die Zusage der Versionsmanager stimmt jetzt (`.nvmrc` = `24`, `mise.toml` = `node = "24"`) |
| `docs/architecture.md:108-114` | erfüllt — Wortlaut zeichengenau, umgebrochen bei ~88 Zeichen, Nachbarabsätze unverändert |
| Unangetastet | bestätigt: `package.json`, `.nvmrc`, `mise.toml`, beide Workflows, `packages/twopoint5d/CHANGELOG.md` |

### Kleine Befunde

Beide stehen so im vorgegebenen Wortlaut aus Zug 0 und lösen deshalb keine
Runde aus; wer die Texte später anfasst, kann sie mitnehmen.

- `README.md:75` nennt pnpm als »v10.22 or newer«, `AGENTS.md:28` und
  `docs/architecture.md:109` als `>=10.22.0`. Inhaltlich dasselbe, nur die
  Notation ist uneinheitlich.
- »the 25.x line is out« (`README.md:75`, `docs/architecture.md:109`) lässt
  sich als »ist erschienen« lesen, gemeint ist »ausgeschlossen«.
  Der Vorschlag des Reviewers: »is excluded«.

Der Reviewer hat die repo-weite Suche nach Node-Versionsangaben wiederholt und
außerhalb von Lockfile, Plan und CHANGELOG keine weitere Stelle gefunden, die
nach der Änderung noch etwas Falsches behauptet. Der Implementierer meldet
`packages/twopoint5d/CHANGELOG.md:1131` (»shipped in Node 24«) als historische
Aussage über `Float16Array`, die richtig bleibt.

## Der Sachverhalt

`engines.node` der Root-`package.json` steht seit Paket 11 (`19e183e2`) auf
`^24.16.0 || >=26.3.0` — angeglichen an `eslint-plugin-astro`, dessen Range
`^22.22.3 || ^24.16.0 || >=26.3.0` lautet, ohne dessen 22er-Hälfte. Diese Range
schließt zwei Dinge aus, die kein Text im Repo erwähnt: die Versionen 24.0 bis
24.15 und die gesamte 25.x-Linie.

Drei Texte behaupten etwas anderes oder etwas Falsches:

| Stelle | Steht dort | Was daran nicht stimmt |
| --- | --- | --- |
| `AGENTS.md:28` | »Node ≥24, pnpm ≥10.22 (`engines` in `package.json`)« | `≥24` erlaubt 24.0 und 25.x, `engines` nicht — und der Satz verweist ausgerechnet auf `engines` als Quelle |
| `README.md:75` | »node v24 or newer« | dieselbe Abrundung; dazu die Zusage, die Versionsmanager-Dateien pickten »the right node for you« |
| `docs/architecture.md:108-109` | »`.nvmrc` and `mise.toml` repeat the same numbers for version managers« | sie wiederholen die Zahlen nicht: beide tragen `24`, und `>=26.3.0` steht dort überhaupt nicht |

Die Versionsmanager-Dateien selbst: `.nvmrc` enthält `24`, `mise.toml` enthält
`node = "24"` und `pnpm = "10.27"`. Die CI setzt in beiden Workflows
`node-version: 24`.

Es bricht nichts. `pnpm install` warnt bei einer Node-Version außerhalb der
Range nur (empirisch geprüft mit pnpm 10.27.0 gegen ein Probe-Paket mit
`engines.node: "^99.0.0"`: `WARN Unsupported engine`, danach `exit=0`). Die
Range ist also eine Aussage und kein Gate — umso mehr hängt daran, dass die
Texte sie richtig wiedergeben.

## Die Entscheidung aus Zug 0

Der Plan stellt Zug 0 die Frage, ob `.nvmrc` und `mise.toml` die genaue
Untergrenze tragen sollen oder ob die Doku sagt, warum sie gröber bleiben.

**Entschieden: die beiden Dateien bleiben bei `24`, `docs/architecture.md`
schreibt den Grund auf.** Drei Gründe, jeder für sich tragend:

1. Das Format gibt es nicht her. Weder `.nvmrc` noch der `[tools]`-Block von
   mise noch das `node-version` von `actions/setup-node` kennen eine
   Alternative (`||`). Die zweite Hälfte der Range, `>=26.3.0`, ließe sich nur
   um den Preis der 24er-Empfehlung hineinschreiben.
2. Eine genauere Zahl wäre eine Verschlechterung. `24.16` nagelt die
   Minor-Linie fest, `24.16.0` eine einzelne Patch-Version — `^24.16.0` lässt
   dagegen jede 24er ab 24.16 zu. Wer die Dateien »präzisiert«, schneidet das
   Repo von den Sicherheitsfixes aus 24.17 und später ab.
3. Die Dateien beantworten eine andere Frage. `engines` sagt, welche Versionen
   zulässig sind; `.nvmrc`, `mise.toml` und die Workflows sagen, welche
   installiert werden soll. Ein `24` holt die neueste 24.x, die das Werkzeug
   bekommt, und liegt damit im erlaubten Bereich. Der Satz in
   `architecture.md` behauptet, es sei dieselbe Frage, und genau das ist der
   Fehler, der behoben wird.

## Vorgehen

Drei Textersetzungen, jede exakt in diesem Wortlaut. Der Zeilenumbruch folgt
den Nachbarzeilen der jeweiligen Datei — `AGENTS.md` und `README.md` führen
lange Zeilen ohne harten Umbruch, `docs/architecture.md` bricht bei etwa 88
Zeichen um. `*.md` steht in `.prettierignore`, Prettier formatiert hier also
nichts nach.

### 1. `AGENTS.md`, Zeile 28

Diese Zeile:

```
All from the repo root. Node ≥24, pnpm ≥10.22 (`engines` in `package.json`).
```

wird ersetzt durch:

```
All from the repo root. Node `^24.16.0 || >=26.3.0` (no 25.x), pnpm `>=10.22.0` — `engines` in `package.json`.
```

Das bleibt eine Zeile; 112 Zeichen liegen innerhalb dessen, was die Datei
ohnehin führt (längste Zeile: 117).

### 2. `README.md`, Zeile 75

Diese Zeile:

```
First, you need [node](https://nodejs.org/) v24 or newer and [pnpm](https://pnpm.io/) v10.22 or newer. An `.nvmrc` and a `mise.toml` are checked in, so `nvm use`, `fnm use` or `mise install` picks the right node for you.
```

wird ersetzt durch:

```
First, you need [node](https://nodejs.org/) `^24.16.0 || >=26.3.0` — a 24.16 or newer, or a 26.3 or newer; the 25.x line is out — and [pnpm](https://pnpm.io/) v10.22 or newer. An `.nvmrc` and a `mise.toml` are checked in, both naming `24`, so `nvm install`, `fnm use --install-if-missing` or `mise install` fetches the newest 24.x for you.
```

Ebenfalls eine Zeile; der Abschnitt »Development Setup« führt durchweg lange
Zeilen.

### 3. `docs/architecture.md`, Zeilen 108-109 (Abschnitt »5. Shared dependency versions«)

Diese zwei Zeilen:

```
Node and pnpm versions come from `engines` in the root `package.json`; `.nvmrc` and
`mise.toml` repeat the same numbers for version managers.
```

werden ersetzt durch diesen Absatz:

```
Node and pnpm versions come from `engines` in the root `package.json`: Node
`^24.16.0 || >=26.3.0` — the 25.x line is out — and pnpm `>=10.22.0`. `.nvmrc`,
`mise.toml` and the `node-version` of the CI workflows name a plain `24`. They answer
which version to install, not which ones are allowed, and none of them understands an
alternative like `||`; a `24` picks the newest 24.x the tool can get and lands inside
the range, while a narrower `24.16` would pin the minor line and cut the repo off from
later 24.x releases.
```

Die Leerzeile davor und danach sowie die umgebenden Absätze des Abschnitts
bleiben, wie sie sind.

## Was nicht dazugehört

- **Kein Regressionstest.** Das ist kein Korrektheitsfehler im Code, sondern
  Doku, die einer Zahl hinterherhinkt. Es gibt nichts, was vorher rot sein
  könnte; das Gate ist der `pnpm run ci`-Lauf.
- **Kein CHANGELOG-Eintrag.** `packages/twopoint5d/CHANGELOG.md` führt die
  Änderungen der veröffentlichten Bibliothek. Diese drei Dateien beschreiben
  das Entwickler-Setup des Monorepos; die Bibliothek hat ihre eigene
  `packages/twopoint5d/README.md`, die keine Node-Angabe trägt.
- **`engines` wird nicht angefasst.** `^24.16.0 || >=26.3.0` ist die Quelle,
  an die sich die Texte anpassen, nicht umgekehrt. Paket 11 hat sie gesetzt,
  die Begründung steht dort.
- **`.nvmrc` und `mise.toml` werden nicht angefasst.** Siehe »Die Entscheidung
  aus Zug 0«. Wer hier `24.16` einträgt, verschlechtert die Sache.
- **Die CI-Workflows werden nicht angefasst.** `.github/workflows/ci.yml:21`
  und `deploy.yml:27` setzen `node-version: 24`; `actions/setup-node` löst das
  auf die neueste 24.x auf und liegt damit in der Range. Sie kommen nur im
  Text von `architecture.md` vor, weil dort steht, wo Node-Versionen herkommen.
- **Die pnpm-Zahlen bleiben.** `engines.pnpm` (`>=10.22.0`), `packageManager`
  (`pnpm@10.27.0`) und `mise.toml` (`pnpm = "10.27"`) sind untereinander
  stimmig; nur die Schreibweise `≥10.22` in `AGENTS.md` wird zu `>=10.22.0`
  vereinheitlicht, weil der Satz ohnehin neu gesetzt wird.

## Die Folge im Volltext

Aus der `Folgen:`-Zeile von Paket 11, triagiert in Zug 0 von Paket 12:

> `AGENTS.md:28`, `README.md:75` und `docs/architecture.md:108` nennen »Node
> ≥24« bzw. »v24 or newer«, `.nvmrc` und `mise.toml` stehen auf `24` — die
> `engines` verlangen jetzt 24.16. Bricht nichts, ist aber gröber als die
> Quelle, auf die `AGENTS.md` ausdrücklich verweist · triagiert in Zug 0 von
> Paket 12: Symptom dieses Pakets, das seine Doku nicht mitgezogen hat, und
> Paket 11 ist committet — also ein Nachtrag, → Paket 14

## Abgleich, Zug 0 (2026-09-20)

Gegen `HEAD` = `ff393ae7`.

| Stelle | Stand |
| --- | --- |
| `package.json:9` | unverändert `"node": "^24.16.0 || >=26.3.0"` |
| `AGENTS.md:28` | unverändert, Wortlaut wie in der Folge beschrieben |
| `README.md:75` | unverändert, Wortlaut wie in der Folge beschrieben |
| `docs/architecture.md:108-109` | unverändert; der falsche Satz steht dort, die Zeilennummer der Folge (`:108`) trifft den Absatzbeginn |
| `.nvmrc` | `24` |
| `mise.toml` | `node = "24"`, `pnpm = "10.27"` |
| `.github/workflows/ci.yml:21`, `deploy.yml:27` | `node-version: 24` — neu gefunden, korrekt, keine Änderung |
| Sonstige `*.md` | repo-weite Suche nach `v24`, `≥24`, `>=24`, `^24`, `24.16`, `26.3.0` findet außerhalb von `pnpm-lock.yaml` keine weitere Stelle |

Aus »Offene Befunde« wurde nichts übernommen. Die neun offenen Einträge
betreffen `HelpersManager`, die Lookbook-Demos, `StageRenderer`,
`Canvas2DStage` und die beiden `getZoom()` — keiner teilt die Ursache dieses
Pakets (eine Doku, die einer Versionsangabe hinterherhinkt). Sie bleiben für
die Drain-Runde des Abschlusses liegen.
