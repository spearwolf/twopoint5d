# Paket 5 — Display-Doku: TSDoc von pause nennt die Grenze für eigene Animation-Loop-Callbacks

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — Folge von Paket 4 (kleiner Befund seines
  Reviewers, ohne eigene Runde), dazu ein Symptom derselben Ursache aus Zug 0
- Ziel: Die TSDoc von `pause` (und der gleichlautende CHANGELOG-Satz) nennt jede
  Lage, in der ein angehaltenes Display fremde Animation-Loop-Callbacks auf
  seinem Renderer ohne Ticks lässt.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/src/display/Display.ts`,
  `packages/twopoint5d/CHANGELOG.md` — nur Doku und Kommentare, kein Verhalten,
  kein Test
- Vorgehen: siehe Abschnitt »Vorgehen« unten, drei Ersetzungen mit exaktem
  Wortlaut
- Verify: `pnpm run ci`
- Commit: `docs(display): say that a callback that goes on the renderer after a display has stopped the animation loop of three gets no frame while the loop stands still, and that any callback still on the loop keeps it running`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · Folge aus Paket 4 unverändert
    (`Display.ts:1720` ruft `#stopAnimationOfThree()` in `NEW`, TSDoc `pause`
    `:1159-1161` und `CHANGELOG.md:47` nennen nur »another FrameLoop«) · neu
    als Symptom derselben Ursache: Kommentar in `#stopAnimationOfThree()`
    `Display.ts:1731-1734` (»A callback left on the loop belongs to such a
    FrameLoop« gilt vor dem ersten Start nicht, seit 81ca08de) · Queue »Offene
    Befunde« leer, keine offenen `Folgen:` anderer Pakete · Restplan
    unverändert (Paket 5 ist das einzige offene)
  - 2026-09-24 Zug 1: Implementierer beauftragt, sonnet (mittlere Stufe), effort low, Report `paket-5.impl-1.json`
  - 2026-09-24 Zug 2: FERTIG · `Display.ts`, `CHANGELOG.md` geändert, Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-5.verify.log`)
  - 2026-09-24 Zug 3: Reviewer (sonnet, low): alle drei Schritte erfüllt · 1 × wichtig (Kommentar `#stopAnimationOfThree()` `Display.ts:1737-1738` verspricht mit »until the loop runs again« Frames, die ein direkt gesetzter Callback nie bekommt) · 2 × klein · Diff `paket-5.diff`
  - 2026-09-24 Zug 4 Runde 1: wichtig an denselben Implementierer (Resume `c9bc9989`) · zurück: FERTIG, Schluss auf »while the loop stands still«, ci exit=0 · neu durch die Runde: Satz doppelt »while the loop stands still … while the loop stands still«
  - 2026-09-24 Zug 4 Runde 2: Doppelung an frischen Implementierer (opus, low) · zurück: FERTIG, Schluss »after the display has stopped the loop gets no frame while it stands still« · ci exit=0 (`paket-5.verify-2.log`) · Nach-Review (`paket-5.review-2.json`, Diff `paket-5-2.diff`): behoben, keine neuen Befunde außer 1 × klein
  - 2026-09-24 Zug 5: committet 3fbfdb55 · 2 Runden

## Urteil des Reviewers

- Folge aus Paket 4 (TSDoc `pause`, CHANGELOG): behoben — `Display.ts:1155-1167`, `CHANGELOG.md:47`
- Symptom in `#stopAnimationOfThree()`: behoben nach Runde 2 — `Display.ts:1735-1739`
- klein: »goes on the renderer« (`Display.ts:1166`, `CHANGELOG.md:47`, Commit-Message) liest sich auch als »läuft weiter«; »is set on« wäre eindeutiger
- klein: `Animation.start()` von three ruft beim Wiederanlauf sofort einen Tick; der Text behauptet darüber nichts und bleibt richtig

## Abgleich

**Folge aus Paket 4 — unverändert.** Fundstellen im Stand von `81ca08de`:

- `packages/twopoint5d/src/display/Display.ts:1717-1724` —
  `#followPauseBeforeStart()` ruft in `NEW` bei `pausedByUser`
  `#stopAnimationOfThree()` (`:1720`).
- `Display.ts:1726-1738` — `#stopAnimationOfThree()` hält die Schleife nur an,
  wenn `renderer.getAnimationLoop() == null` (`:1735`), sonst früher Return.
- `Display.ts:1155-1164` — TSDoc von `pause`, Absatz über die Schleife von
  three. Der Satz `:1159-1161` nennt als Ausnahme nur »a renderer without it«
  und »a renderer another {@link FrameLoop} still runs on as the display goes
  into the pause«. Kein Wort über einen Callback, der erst nach dem Anhalten auf
  den Renderer kommt.
- `packages/twopoint5d/CHANGELOG.md:47` (Unreleased, `### Changed`) — derselbe
  Inhalt in einer Zeile: »A renderer without that field, and one another
  `FrameLoop` still runs on as the display pauses, keep their loop running.«

**Symptom derselben Ursache — `Display.ts:1731-1734`**, Kommentar in
`#stopAnimationOfThree()`:

```ts
    // the display is off its frame loop here, and the driver has taken its callback off the
    // renderer unless another FrameLoop still holds it. A callback left on the loop belongs to
    // such a FrameLoop, and its frames go on. One that starts on the renderer while the loop
    // stands still gets its frames once the display runs again
```

Vor 81ca08de lief `#stopAnimationOfThree()` nur aus dem Pause-Handler
(`git show 3995236e:packages/twopoint5d/src/display/Display.ts`, Aufruf `:1040`
war der einzige). Dort stimmt »belongs to such a FrameLoop«: der rAF-Driver des
Displays nimmt beim Pausieren mit `setAnimationLoop(null)` jeden Callback vom
Renderer, übrig bleibt nur der des Drivers, wenn noch ein `FrameLoop` auf ihm
hängt. Paket 4 ruft die Methode auch in `NEW`, wo der Driver des Displays nie
lief; ein Callback, den der Aufrufer vor dem ersten Start mit
`renderer.setAnimationLoop()` gesetzt hat, steht dort auf der Schleife und hält
sie am Laufen. Wäre Paket 4 seiner Ursache (Doku der Schleife vor dem ersten
Start) zu Ende gefolgt, gäbe es den Eintrag nicht → Symptom, in dieses
Nachtragspaket.

## Was der Code tut — Grundlage des Wortlauts

- three 0.185.1, `src/renderers/common/Animation.js`: `setAnimationLoop(cb)`
  setzt nur `_animationLoop`; `start()` startet die rAF-Kette und ruft sofort
  einen Tick ohne Zeitstempel, `stop()` bricht sie ab. Ein Callback, der auf eine
  gestoppte Schleife kommt, bekommt keinen Tick, bis jemand `start()` ruft.
- `Renderer.setAnimationLoop(cb)` (`Renderer.js:1921`) reicht an
  `_animation.setAnimationLoop()` durch; `getAnimationLoop()` (`:1934`) liest
  zurück.
- Der rAF-Driver (`FrameLoop.ts`, Klasse `RAF`) gibt es einmal je Renderer
  (`RAF.get(renderer)`); `start()` setzt seinen Callback per
  `renderer.setAnimationLoop()`, `stop()` ruft `setAnimationLoop(null)`, sobald
  kein `FrameLoop` mehr auf ihm hängt.
- Anhalten: `#stopAnimationOfThree()` bei Pause (`PAUSED`) und bei
  `stop()`/`pause = true` vor dem ersten Start (`NEW`), nie, solange ein
  Callback auf der Schleife steht. Wieder anlaufen: im Start-Handler, und in
  `NEW` bei `pause = false` oder im nächsten `start()`.
- Daraus die eine Lage, die die TSDoc noch nicht nennt: ein Callback, der auf
  den Renderer kommt, nachdem das Display die Schleife angehalten hat — direkt
  per `renderer.setAnimationLoop()` oder über einen `FrameLoop`, der auf diesem
  Renderer startet —, bekommt keinen Tick, solange die Schleife steht. Und die
  Ausnahme »another FrameLoop« ist enger als der Code: jeder Callback, der beim
  Anhalten auf der Schleife steht, hält sie am Laufen.

Bewusst **nicht** in den Text: dass der Driver des Displays beim Lauf einen
direkt gesetzten Callback des Aufrufers per `setAnimationLoop()` ersetzt. Das
ist das Ein-Slot-API von three und gilt unabhängig von der Pause; die TSDoc
verspricht deshalb nur »no frame while the loop stands still«, nicht »frames
once it runs again«.

## Vorgehen

Drei Ersetzungen, Wortlaut exakt wie unten. Nur Zeilenumbruch darf sich
ändern, falls Prettier oder die Umgebung es verlangen; Kommentar- und
TSDoc-Zeilen bleiben unter 100 Zeichen wie ihre Nachbarn (gemessen: der neue
Text liegt bei höchstens 98).

1. **`packages/twopoint5d/src/display/Display.ts`, TSDoc von `get pause()`,
   dritter Absatz (`:1155-1164`).** Den ganzen Absatz von »While the display
   holds in the pause« bis »runs it again.« ersetzen durch:

   ```ts
   * While the display holds in the pause, the animation loop of its renderer stands still as
   * well. three runs that loop from `renderer.init()` on, on every animation frame of the page,
   * and `setAnimationLoop(null)` only takes the callback out of it; so the display stops the loop
   * as it goes into the pause and starts it again as it runs. three 0.185 offers no public way to
   * do so, and the display reaches the loop through `renderer._animation`: a renderer without it
   * keeps its loop running through the pause. So does a renderer whose loop still carries a
   * callback when the display would stop it — that of another {@link FrameLoop} on the renderer,
   * say. Before the first start the loop follows `pause` too: a `stop()` or `pause = true` stops
   * it — one that comes while `renderer.init()` still runs stops it once the init has started
   * it — also when that call keeps the first `start()` from starting the display, and a
   * `pause = false` or the next `start()` runs it again. A callback that goes on the renderer
   * after the display has stopped the loop — through `renderer.setAnimationLoop()`, or through a
   * {@link FrameLoop} that starts on the renderer — gets no frame while the loop stands still.
   ```

   (Einrückung wie die Nachbarzeilen: drei Leerzeichen vor `*`.) Die Absätze
   davor und danach bleiben unverändert.

2. **`Display.ts`, Kommentar in `#stopAnimationOfThree()` (`:1731-1734`)**, die
   vier Zeilen zwischen `if (animation == null) return;` und
   `if (renderer.getAnimationLoop() != null) return;` ersetzen durch:

   ```ts
       // the display is off its frame loop here, and the rAF driver keeps its callback on the
       // renderer only while a FrameLoop is still on the driver. A callback left on the loop — the
       // driver's, or one the caller has set with renderer.setAnimationLoop() before the first
       // start — keeps the loop running, and its frames go on. One that goes on the renderer while
       // the loop stands still gets no frame until the loop runs again
   ```

   Der Code der Methode bleibt Zeichen für Zeichen.

3. **`packages/twopoint5d/CHANGELOG.md:47`** (Unreleased, `### Changed`, der
   Eintrag »a paused `Display` lets the animation loop of its renderer rest«).
   Die ganze Zeile ersetzen durch diese eine Zeile (kein Umbruch, kein Punkt am
   Ende — wie die Nachbareinträge):

   ```markdown
   - a paused `Display` lets the animation loop of its renderer rest. three runs that loop from `renderer.init()` on, on every animation frame of the page, and `setAnimationLoop(null)` only takes the callback out of it; the display stops the loop through `renderer._animation` as it goes into the pause and starts it again as it runs. A renderer without that field, and one whose loop still carries a callback when the display would stop it — that of another `FrameLoop` on the renderer, say — keep their loop running. Before the first start the loop follows `pause` as well: a `stop()` or `pause = true` stops it — one that comes while `renderer.init()` still runs stops it once the init has started it — also when that call keeps the first `start()` from starting the display, and `pause = false` or the next `start()` runs it again. A callback that goes on the renderer after the display has stopped the loop — through `renderer.setAnimationLoop()`, or through a `FrameLoop` that starts on the renderer — gets no frame while the loop stands still
   ```

   Der Abschnitt ist `[Unreleased]` und darf geändert werden (Skill
   `updating-changelog`: nur veröffentlichte Abschnitte sind unveränderlich).
   Kein neuer Eintrag: der bestehende beschreibt dieselbe, noch
   unveröffentlichte Änderung.

Nichts sonst. Insbesondere nicht:

- `FrameLoop.ts` anfassen — der `FrameLoop` trägt kein Wissen über das
  Display, das ihn anhält (Grundsatz aus Paket 3).
- Die Klassen-TSDoc (`:433-435`, »the animation loop of three rests while it
  pauses as well, see {@link Display.pause}«) und die TSDoc von `stop()`
  (`:1550-1551`) — beide verweisen auf `pause` und bleiben richtig.
- Einen Test schreiben. Die Aussage beschreibt `Animation.setAnimationLoop()`
  von three, das nur den Callback setzt; ein Vitest gegen einen Stub prüfte den
  Stub, und der Browser-Test aus Paket 1
  (`display-lifecycle.test.js`, »a paused display lets the animation loop of
  three stand still, and one that runs again starts it once«) wacht schon über
  die Interna.
- Der Satz über die Ersetzung eines direkt gesetzten Callbacks durch den Driver
  (siehe »Was der Code tut«).

Suche zur Kontrolle nach dem Edit: `grep -n "still runs on" packages/twopoint5d/src/display/Display.ts packages/twopoint5d/CHANGELOG.md`
liefert keinen Treffer mehr; `grep -n "belongs to such a FrameLoop" packages/twopoint5d/src/display/Display.ts` ebenso.

## Folge und Symptom im Volltext

**Folge von Paket 4 · klein (Reviewer) · `packages/twopoint5d/src/display/Display.ts:1720`
(TSDoc `pause` `:1159-1161`)** — ein nie gestartetes Display hält auch die
Schleife eines vom Aufrufer übergebenen Renderers an; setzt der Aufrufer danach
selbst `renderer.setAnimationLoop(cb)`, bekommt er bis zum Lauf des Displays
keine Ticks. Der Kommentar `:1733-1735` nennt diese Grenze für `PAUSED` schon,
die TSDoc von `pause` nennt nur einen Renderer, auf dem bereits ein anderer
`FrameLoop` läuft, nicht einen Callback, der erst nach dem Anhalten gesetzt
wird. Mitziehen, wo `CHANGELOG.md:47` denselben Satz führt.
Umsetzung: Schritte 1 und 3.

**Symptom, Zug 0 von Paket 5 · info · `packages/twopoint5d/src/display/Display.ts:1731-1734`**
— der Kommentar in `#stopAnimationOfThree()` sagt, ein auf der Schleife
verbliebener Callback gehöre einem anderen `FrameLoop`; seit Paket 4 läuft die
Methode auch vor dem ersten Start, wo es ebenso ein vom Aufrufer per
`renderer.setAnimationLoop()` gesetzter Callback sein kann. Umsetzung: Schritt 2.
