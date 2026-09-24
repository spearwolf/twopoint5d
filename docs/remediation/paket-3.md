# Paket 3 — Display-Doku: Formulierungen aus den Paketen 1 und 2 schärfen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit · vier Folgen aus den Reviews der Pakete 1 und 2
  (kleine Befunde ohne eigene Runde), siehe »Folgen im Volltext«
- Folge von: 1, 2
- Ziel: Die in diesem Lauf entstandenen TSDoc-, Kommentar- und CHANGELOG-Sätze
  der Display-Domäne sagen genau, was der Code tut, und sind umbrochen wie ihre
  Umgebung.
- Modell: mittlere Stufe (drei Dateien, fünf Stellen; die Texte stehen
  wörtlich hier, aber es sind mehrere Dateien und veröffentlichte Doku — die
  günstigste Stufe ist für eine Datei an einer Stelle)
- Effort: low (exakter Auftrag: alter und neuer Wortlaut stehen unten)
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts` (Klassen-TSDoc Punkt 2,
    `:445-446`; TSDoc des `pause`-Getters, `:1146-1148`)
  - `packages/twopoint5d/src/display/FrameLoop.ts` (Kommentar in
    `#onAnimationFrame`, `:84-86`)
  - `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]` → `### Changed`, Bullet
    `:47`; `### Migration Guide` → `#### A disposed display refuses to be
    used`, `:848-851`)
- Kein Verhalten, keine Signatur, kein Test. Es ist kein Bugfix-Paket: ein
  Regressionstest und ein roter Lauf entfallen, weil kein ausführbarer Code
  sich ändert.
- Vorgehen — jede Ersetzung wörtlich übernehmen, Gedankenstrich ist »—«
  (U+2014) wie in der Umgebung, Einrückung und Kommentarpräfix unverändert:
  1. **`Display.ts`, TSDoc des `pause`-Getters, `:1146-1148`.** Ersetze die drei
     Zeilen

     ```
        * keeps its loop running through the pause. So does a renderer another {@link FrameLoop} still
        * runs on as the display goes into the pause, and before the first start the loop runs as three
        * started it.
     ```

     durch diese vier:

     ```
        * keeps its loop running through the pause. So does a renderer another {@link FrameLoop} still
        * runs on as the display goes into the pause. Until the display goes into the pause for the
        * first time, it leaves the loop as three runs it — also while the first `start()` waits, and
        * when a `stop()` or `pause = true` keeps that call from starting the display.
     ```

     (Jede Zeile beginnt mit drei Leerzeichen, `*`, einem Leerzeichen — wie
     die Nachbarn. Die Leerzeile ` *` und `After {@link Display.dispose} …`
     darunter bleiben.)
  2. **`CHANGELOG.md:47`**, eine einzige lange Zeile wie alle Bullets der
     Liste — nicht umbrechen. Ersetze am Zeilenende

     ```
     keep their loop running; before the first start the loop runs as three started it
     ```

     durch

     ```
     keep their loop running; until the display goes into the pause for the first time, it leaves the loop as three runs it — also while the first `start()` waits, and when a `stop()` or `pause = true` keeps that call from starting the display
     ```

     Der Rest der Zeile bleibt, auch das fehlende Satzzeichen am Ende (die
     Bullets der Liste enden ohne Punkt).
  3. **`Display.ts`, Klassen-TSDoc Punkt 2, `:445-446`.** Ersetze die Zeile

     ```
      *    throws as well, `start()` rejects with an `AggregateError` of both errors.
     ```

     durch diese drei:

     ```
      *    throws as well, `start()` rejects with an `AggregateError` of the error of
      *    the start and that of the pause — each an `AggregateError` itself when
      *    more than one listener of its event throws.
     ```

     (Präfix ` *    `: ein Leerzeichen, `*`, vier Leerzeichen, wie die Zeile
     `:445` darüber. Die Zeile `:445` und ` * 3. \`display.dispose()\` …`
     darunter bleiben.)
  4. **`FrameLoop.ts:84-86`.** Ersetze

     ```
         // three runs the first tick of its animation loop right away as the loop starts, without a
         // timestamp — after a Display has started the loop again, and at the end of an XR session. A
         // tick without one measures nothing and reaches no FrameLoop
     ```

     durch

     ```
         // three runs the first tick of its animation loop right away as the loop starts, without a
         // timestamp — after whoever stopped the loop has started it again, and at the end of an XR
         // session. A tick without one measures nothing and reaches no FrameLoop
     ```

     (Vier Leerzeichen Einrückung vor `//`, wie jetzt.)
  5. **`CHANGELOG.md:848-851`**, Absatz unter `#### A disposed display refuses
     to be used`. Nur neu umbrechen, kein Wort ändern. Die Zeilen `:844-847`
     bleiben, die vier Zeilen ab `:848`

     ```
     `await` or a `.catch()`, not a `try` around a call that is not awaited. `#resize()`, `#renderFrame()`, `#stop()`, a write to `#pause` and a further
     `#dispose()` do nothing. `#pause` is the one of them with a getter, and it answers `true` once the
     display is disposed, however it is written. Use `Display#isDisposed` where a display may already be
     gone.
     ```

     werden zu

     ```
     `await` or a `.catch()`, not a `try` around a call that is not awaited. `#resize()`,
     `#renderFrame()`, `#stop()`, a write to `#pause` and a further `#dispose()` do nothing. `#pause` is
     the one of them with a getter, and it answers `true` once the display is disposed, however it is
     written. Use `Display#isDisposed` where a display may already be gone.
     ```

     (Keine Zeile über 99 Zeichen, wie die Nachbarzeilen `:844-847`.)
  6. Nichts sonst. Insbesondere bleiben die übrigen »before the first start«
     (`Display.ts:1133` im `pause`-Getter, `CHANGELOG.md:46` und `:225`) wie
     sie sind: sie stehen seit vor diesem Lauf da (`git show
     ff427a76:packages/twopoint5d/src/display/Display.ts`, Zeile `1086`) und
     treffen unter beiden Lesarten zu — ein erster `start()`, der direkt in
     die Pause geht, fällt dort unter »while it holds in the pause« bzw. »during
     a pause«. Kein neuer CHANGELOG-Eintrag: die Änderung berichtigt
     Unreleased-Text in `:47` und `:848-851` an Ort und Stelle und ändert kein
     Verhalten.
- Verify: `pnpm run ci` (vom Repo-Root; das Pre-Commit-Gate laut `AGENTS.md`
  und Plan-Konventionen — `lint` prüft Prettier, `typecheck` die markierten
  Doku-Blöcke; die Änderung berührt keinen Codeblock)
- Commit: `docs(display): say that a display leaves the animation loop of three as three runs it until it first goes into the pause, say that each error in the AggregateError of a failed start and the pause after it may be an AggregateError itself, let the comment on the tick without a timestamp name no caller, and wrap the migration note on a disposed display like its neighbours`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · Folge `pause`-TSDoc/CHANGELOG
    unverändert, gewandert nach `Display.ts:1146-1148` und `CHANGELOG.md:47`
    (Plan nannte `:1130-1137`, `:65`) · Folge Klassen-TSDoc unverändert,
    gewandert nach `Display.ts:445-446` (Plan: `:454-455`) · Folge
    `FrameLoop.ts:84-86` unverändert · Folge Migration Guide unverändert an
    `CHANGELOG.md:848` (147 Zeichen) · offene Folgen im Plan: keine weiteren ·
    Queue war leer; neuer Nebenbefund »three-Schleife vor der ersten Pause«
    (info, vorbestehend) → »Offene Befunde« `→ Scope` · Restplan: nach Paket
    3 kein offenes Paket, nichts umzusortieren · Plan-Block von Paket 3 auf
    die aktuellen Zeilen und die Abweichungen bei Folge 1 und 3 nachgeführt
  - 2026-09-24 Zug 1: Implementierer beauftragt, sonnet, effort low
  - 2026-09-24 Zug 2: Report FERTIG · Display.ts, FrameLoop.ts, CHANGELOG.md geändert · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (paket-3.verify.log)
  - 2026-09-24 Zug 3: Reviewer (sonnet, low) freigegeben, 4/4 Folgen behoben, 0 kritisch, 0 wichtig, 2 klein · Diff paket-3.diff
  - 2026-09-24 Zug 5: Commit 3995236e, Verify aus Zug 2 (exit=0), keine Fehlerkette

## Folgen im Volltext

Quelle: Block von Paket 3 in `./remediation-plan.md`, aus den kleinen Befunden
der Reviewer von Paket 1 (412f4a66) und Paket 2 (e796aac3).

**Folge 1 · Paket 1 Review · `Display.ts` TSDoc `pause` und `CHANGELOG.md`** —
»before the first start the loop runs as three started it« ist zweideutig; ein
Display, das beim ersten `start()` direkt in die Pause geht, hält die Schleife
an. Vorschlag des Reviewers: »before the first call of `start()`«.

**Folge 2 · Paket 1 Review · `Display.ts` Klassen-TSDoc** — »an
`AggregateError` of both errors« vereinfacht den Fall mehrerer werfender
Start-Listener, in dem `errors[0]` selbst ein `AggregateError` ist; an die
genaue Beschreibung in der TSDoc von `start()` angleichen.

**Folge 3 · Paket 1 Review · `FrameLoop.ts:84-86`** — der Kommentar nennt
»after a Display has started the loop again«; `FrameLoop` soll kein Wissen
über einen Aufrufer tragen, »after something has started the loop again«
genügt.

**Folge 4 · Paket 2 Review · `CHANGELOG.md:848`** — Absatz »A disposed display
refuses to be used« im Migration Guide mit einer Zeile von rund 150 Zeichen;
Absatz neu umbrechen wie die Umgebung.

## Abgleich und Abweichungen

- **Folge 1 — Abweichung vom Vorschlag des Reviewers.** »before the first
  call of `start()`« wäre selbst ungenau. Das Display hält die three-Schleife
  nur in seinem Handler für `DisplayStateMachine.Pause` an (`Display.ts:1028`,
  `#stopAnimationOfThree()` in `:1038`), und der läuft erst, wenn
  `start()` den Renderer und den `beforeStartCallback` abgewartet und
  `this.#stateMachine.start()` gerufen hat (`:1501-1523`). Vorher — während
  der erste `start()` wartet, und wenn ein `stop()` oder `pause = true` in
  dieser Wartezeit den Start aufhält (früher Return in `:1518-1520`, die State
  Machine bleibt in `NEW`) — läuft die Schleife, wie three sie laufen lässt.
  Die genaue Grenze ist deshalb »bis das Display zum ersten Mal in die Pause
  geht«; ein erster `start()`, der bei verborgenem Tab direkt in die Pause
  geht, liegt schon dahinter (`DisplayStateMachine.ts` emittiert `Pause` in
  `#initOrRestartThenStart()`). »it leaves the loop as three runs it« statt
  »the loop runs as three started it«, weil three die Schleife erst am Ende
  von `renderer.init()` startet (three 0.185.1, `Renderer.js:825`) und
  `start()` bis dahin warten kann. »waits« ist das Wort, das die Klassen-TSDoc
  für dieselbe Wartezeit schon benutzt (»that comes in while `start()` waits«).
- **Folge 2** — neuer Wortlaut deckt sich mit der TSDoc von `start()`
  (`Display.ts:1472-1474`) und dem Code: der Rollback wirft
  `new AggregateError([startError, pauseError], …)`
  (`DisplayStateMachine.ts`, `#initOrRestartThenStart()`), und `emitStrict`
  liefert für jedes der beiden Events bei mehreren werfenden Listenern selbst
  einen `AggregateError`.
- **Folge 3 — Abweichung vom Vorschlag des Reviewers, in der Richtung
  gleich.** »after whoever stopped the loop has started it again« statt »after
  something has started the loop again«: nennt keinen Aufrufer, sagt aber die
  Regel, wann der Tick ohne Zeitstempel einen `FrameLoop` erreicht. Nachgesehen
  in three 0.185.1: `Animation#start()` ruft `update()` ohne Argument
  (`Animation.js:69-89`); der Start in `renderer.init()` (`Renderer.js:825`)
  erreicht keinen `FrameLoop`, weil `setAnimationLoop()` erst `init()`
  abwartet (`Renderer.js:1921-1925`); `XRManager.js:1739-1742` stoppt und
  startet die Schleife am Ende einer XR-Session mit dem alten Callback.
- **Folge 4** — unverändert; reiner Umbruch, Wortlaut bleibt.

## Nebenbefunde aus Zug 0

- **three-Schleife vor der ersten Pause** (info, vorbestehend) — eingetragen
  in »Offene Befunde« mit `→ Scope`. Begründung der Einordnung: vor dem ersten
  Commit dieses Laufs lief die Schleife in jeder Phase
  (`git show ff427a76:packages/twopoint5d/src/display/Display.ts` kennt kein
  `_animation`), also keine Folge. Kein Symptom von Paket 1: PERF-032 nennt
  ausdrücklich die Phase »während einer Pause« (»Ein pausiertes Display …«),
  und ein Display, das nie in die Pause gegangen ist, lag nie im Finding.
  Nicht in dieses Paket, weil die Ursache Verhalten ist (wo `Display` die
  Schleife anhält), dieses Paket aber nur Text ändert. Scope-Regel greift
  (Domäne Display, jede Severity); ein Fix erweitert die Entscheidung zu
  PERF-032 auf eine weitere Phase, kippt sie nicht, daher keine Rückfrage.
  Zieht ein Fix nach, müssen die TSDoc von `pause` und `CHANGELOG.md:47` mit,
  die nach diesem Paket genau diese Grenze nennen.

## Urteil des Reviewers

- Folge 1 behoben — `Display.ts:1146-1149`, `CHANGELOG.md:47`; gegen Pause-Handler `:1030-1038` und frühen Return `:1518-1520` geprüft
- Folge 2 behoben — `Display.ts:445-447`, deckt sich mit TSDoc `start()` `:1472-1474`
- Folge 3 behoben — `FrameLoop.ts:84-86`
- Folge 4 behoben — `CHANGELOG.md:848-851`, keine Zeile über 99 Zeichen, Wortlaut unverändert
- klein: Commit-Message sehr lang (passt zum Stil des Logs)
- klein: `CHANGELOG.md:46` und `Display.ts:1135` »before the first start« bewusst unverändert, zutreffend
