# Remediation-Plan — twopoint5d

Quelle: ./audit.html vom 2026-09-21 (nachgeführt 2026-09-24) · Branch: main · erstellt: 2026-09-24
Baseline: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser)
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/0816cb6e-4ba4-4ccc-a542-5f198874d89d/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 2 von 2 offenen Findings der Domäne »Display & Frame-Loop« (Component `display`): 1 low, 1 info · ausgenommen: alle anderen Domänen, acknowledged
Scope-Regel: jeder Befund in der Domäne »Display & Frame-Loop« — `packages/twopoint5d/src/display/` samt zugehöriger Tests und Doku —, jede Severity einschließlich info; gilt auch für Befunde, die erst im Lauf auffallen. Alles außerhalb geht als neues Finding ins Audit.
Kaltstarts: 1 Paket × mindestens 3 Agenten ≈ 3, je Nachrunde zwei mehr · 2,0 Findings je Paket (Blocker: der Nutzer begrenzt den Lauf auf diese Domäne, sie hat nur zwei offene Findings)
Stand (2026-09-24): Lauf abgeschlossen · 6 Pakete committet (412f4a66, e796aac3, 3995236e, 81ca08de, 3fbfdb55, c983e745) · nichts blockiert · Offene Befunde leer · Report: docs/remediation/20260924-display-pause-remediation-report.md

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` blockiert.

## Entscheidungen
- Folgepakete aus kleinen Reviewer-Befunden werden gefahren, solange sie eine sachliche Unschärfe betreffen; Hinweise, die der Reviewer selbst als zutreffend oder als reinen Hinweis kennzeichnet, gelten nicht als Befund (2026-09-24, Orchestrator nach Nutzerziel »Domäne issue-frei«)
- PERF-032: three wirklich anhalten statt nur dokumentieren. Beim Pausieren `renderer._animation.stop()`, beim Fortsetzen `renderer._animation.start()` (three 0.185.1 hat beides, nur nicht öffentlich). Zugriff per Duck-Typing abgesichert; fehlt die Form, bleibt das bisherige Verhalten. Ein Browser-Test prüft, dass während der Pause kein three-Tick läuft, damit ein three-Update, das die Interna ändert, auffällt. Die TSDoc von `pause` nennt Verhalten und Grenze. (2026-09-24)
- BUG-125: Wirft beim Zurückrollen eines gescheiterten Starts zusätzlich ein `OnDisplayPause`-Listener, rejected `start()` mit einem `AggregateError` aus Start-Fehler(n) und Pause-Fehler — dieselbe Form, mit der mehrere werfende Start-Listener schon gebündelt werden. Test zuerst. (2026-09-24)
- Ziel des Laufs laut Nutzer: die Domäne »Display & Frame-Loop« issue-frei, einschließlich aller Folgen. (2026-09-24)

## Konventionen
Gelten für jede Zeile, die in diesem Lauf entsteht — Code, Kommentare,
Dokumentation, CHANGELOG, Migrations-Hinweise, Commit-Messages:
- Inline-Kommentare sind erwünscht, wo sie erklären, *warum* etwas so ist.
- Keine Finding-IDs, auch nicht in der Commit-Message. Sie gehören diesem einen
  Audit, sind danach tot, und die Commit-Message überdauert den Lauf. Sie leben
  in diesem Plan und sonst nirgends; die Verbindung zwischen Finding und Commit
  trägt das Feld `Hash:` unter dem Paket — in genau der Richtung, in der jemand
  sie später sucht. Eine Commit-Message sagt in eigenen Worten, was sie ändert.
- Kein Rückblick auf den Vorzustand: kein »früher«, kein »statt bisher«, kein
  »im Zuge des Audits umgestellt«. Der Test: Ergibt der Satz für jemanden Sinn,
  der den Vorzustand nie gesehen hat? Dann bleibt er. Braucht er ihn, gehört er
  in die Commit-Message — die Historie ist bereits konserviert.
- Commit-Messages im Stil von `git log`: englisch, Conventional Commits mit Scope (`fix(display): …`).
- `pnpm run ci` ist das Pre-Commit-Gate (siehe `AGENTS.md`); CHANGELOG-Einträge nach dem Skill `updating-changelog`.
- Nie `pnpm publishNpmPkg` oder `scripts/publishNpmPkg.mjs` ausführen.

## Vorbestehende Fehler
- keine

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.


## Pakete

### [x] 1. Display-Pause: three-Schleife anhalten und Rollback-Fehler bündeln
- Findings: PERF-032 (low), BUG-125 (info)
- Ziel: Ein pausiertes Display lässt auch die rAF-Schleife von three ruhen, und ein gescheiterter Start verliert beim Rollback keinen Fehler.
- Bereich: `packages/twopoint5d/src/display/` (Display.ts, DisplayStateMachine.ts, FrameLoop.ts), zugehörige Vitest- und Browser-Tests, CHANGELOG
- Detail: docs/remediation/paket-1.md
- Hängt ab von: —
- Hash: 412f4a66
- Ergebnis: 1 Runde · PERF-032 und BUG-125 behoben, dazu die aufgenommenen Nebenbefunde (Pause-Zustellung strikt, Tick ohne Zeitstempel) · Regressionstests T1–T9 in `Display.spec.ts`, `DisplayStateMachine.spec.ts`, `FrameLoop.spec.ts` (T1, T3–T9 vor dem Fix rot, u. a. `a start listener and a pause listener that throw reject start() with an AggregateError of both errors, and every pause listener hears pause`, `skips a tick of the renderer without a timestamp`), Browser-Test `a paused display lets the animation loop of three stand still, and one that runs again starts it once` · Review freigegeben, 4 × klein (Paketdatei)
- Nebenbefunde: → Queue (TSDoc `start()` »throws« nach `dispose()`)
- Folgen: keine
- Schnittstellen: keine Signatur geändert · `OnDisplayPause` wird strikt zugestellt: `pause = true` und `stop()` (auch das `stop()` in `dispose()`) werfen den Fehler eines Pause-Listeners, bei mehreren einen `AggregateError` · Rollback eines gescheiterten Starts rejected bei zusätzlich werfendem Pause-Listener mit `AggregateError([startError, pauseError], …, {cause: pauseError})` · privat in `Display`: `#stoppedAnimationOfThree`, `#stopAnimationOfThree()`, `#startAnimationOfThree()`, Modul-Helfer `getAnimationOfThree()`

### [x] 2. Display-Dispose: Aufräumen trotz werfender Listener, TSDoc von start() nach dispose()
- Nebenbefund: `packages/twopoint5d/src/display/Display.ts:1565` (low) — `dispose()` bricht ab, wenn ein `OnDisplayPause`-Listener (über das `stop()` in `:1565`, laufendes Display; seit 412f4a66 auch als `AggregateError`) oder ein `OnDisplayDispose`-Listener (`:1569`) wirft: `#disposed` steht schon, Frame-Loop-Abmeldung, `off(this)`, Rückgabe der Canvas, Freigabe des Renderers und Entfernen des Containers bleiben aus, ein zweites `dispose()` kehrt in `:1562` sofort zurück (aufgefallen in Zug 0 von Paket 1, vorbestehend)
- Nebenbefund: `packages/twopoint5d/src/display/Display.ts` (info) — TSDoc von `start()` (Absatz »Throws after {@link Display.dispose}«) und Punkt 4 der Klassen-TSDoc sagen, `start()` »throws« nach `dispose()`; `start()` ist `async` und rejected, ein `try` ohne `await` fängt nichts (aufgefallen in Zug 2 von Paket 1, vorbestehend)
- Ziel: `dispose()` räumt vollständig auf und meldet die Fehler werfender Listener erst danach, und die TSDoc beschreibt die Rejection von `start()` nach `dispose()` richtig.
- Bereich: `packages/twopoint5d/src/display/Display.ts`, `Display.spec.ts`, `packages/twopoint5d-testing/test/display-dispose.test.js` (Testname), `packages/twopoint5d/docs/resource-lifecycle.md` (Code-Auszug §4), CHANGELOG
- Detail: docs/remediation/paket-2.md
- Hängt ab von: 1
- Hash: e796aac3
- Ergebnis: 1 Runde · Dispose-Abbruch und TSDoc start() nach dispose() behoben · Regressionstests in `Display.spec.ts` (vor dem Fix alle fünf rot): `a pause listener that throws does not stop dispose(): the display is torn down, then dispose() throws its error`, `a dispose listener that throws: every dispose listener hears dispose, the display is torn down, then dispose() throws its error`, `two dispose listeners that throw make dispose() throw an AggregateError of both errors, after the teardown`, `a pause listener and a dispose listener that throw make dispose() throw an AggregateError of both errors, after the teardown`, `a constructor that fails, and a dispose listener that throws as it takes the display down, throw an AggregateError of both errors and release the renderer` · Browser-Test umbenannt in `start() rejects after dispose()` · Review freigegeben, 1 × klein (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: keine Signatur geändert · `Display#dispose()` baut vollständig ab und wirft erst danach: den Fehler eines werfenden `OnDisplayPause`- oder `OnDisplayDispose`-Listeners unverändert, bei Fehlern beider Events `AggregateError([pauseError, disposeError], …, {cause: disposeError})` · `OnDisplayDispose` wird mit `emitStrict` zugestellt (jeder Listener hört es, mehrere Fehler eines Events als `AggregateError`) · ein scheiternder Konstruktor, dessen Abbau ein Dispose-Listener mit einem Fehler quittiert, wirft `AggregateError([error, disposeError], …, {cause: disposeError})`

### [x] 3. Display-Doku: Formulierungen aus den Paketen 1 und 2 schärfen
- Folge von: 1, 2 (kleine Befunde der Reviewer, ohne eigene Runde)
- Detail: docs/remediation/paket-3.md
- Folge: `packages/twopoint5d/src/display/Display.ts` (TSDoc `pause`, jetzt `:1146-1148`) und `packages/twopoint5d/CHANGELOG.md` (jetzt `:47`) — »before the first start the loop runs as three started it« ist zweideutig; ein Display, das beim ersten `start()` direkt in die Pause geht, hält die Schleife an. Der Vorschlag des Reviewers »before the first call of `start()`« träfe die Wartezeit von `start()` nicht; genaue Grenze »until the display goes into the pause for the first time«, Wortlaut in der Paketdatei
- Folge: `packages/twopoint5d/src/display/Display.ts` (Klassen-TSDoc, jetzt `:445-446`) — »an `AggregateError` of both errors« vereinfacht den Fall mehrerer werfender Start-Listener, in dem `errors[0]` selbst ein `AggregateError` ist; an die genaue Beschreibung in der TSDoc von `start()` angleichen
- Folge: `packages/twopoint5d/src/display/FrameLoop.ts:84-86` — Kommentar nennt »after a Display has started the loop again«; `FrameLoop` soll kein Wissen über einen Aufrufer tragen, Wortlaut ohne Aufrufer in der Paketdatei
- Folge: `packages/twopoint5d/CHANGELOG.md` (`:848-851`) — Absatz »A disposed display refuses to be used« im Migration Guide mit einer Zeile von rund 150 Zeichen; Absatz neu umbrechen wie die Umgebung
- Ziel: Die in diesem Lauf entstandenen TSDoc-, Kommentar- und CHANGELOG-Sätze der Display-Domäne sagen genau, was der Code tut, und sind umbrochen wie ihre Umgebung.
- Bereich: `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/src/display/FrameLoop.ts`, `packages/twopoint5d/CHANGELOG.md` — nur Doku und Kommentare, kein Verhalten
- Hängt ab von: 1, 2
- Hash: 3995236e
- Ergebnis: 1 Runde · alle vier Folgen behoben (reiner Text, kein Regressionstest) · Review freigegeben, 2 × klein (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine

### [x] 4. Display-Pause vor dem ersten Start: three-Schleife auch dort anhalten
- Findings: PERF-032 (low) — nur der Rest, die Pause vor dem ersten Start; der Abschluss bucht PERF-032 mit 412f4a66 und dem Hash dieses Pakets. Kein `Folge von:`: vorbestehend, keine Folge einer Änderung dieses Laufs
- Detail: docs/remediation/paket-4.md
- Nebenbefund: `packages/twopoint5d/src/display/Display.ts:1518-1520` (info) — ein Display, das noch nie in die Pause gegangen ist, lässt die rAF-Schleife von three laufen, auch wenn `pause` `true` meldet: nach `stop()`/`pause = true` vor dem ersten `start()` ohne folgenden Start, oder wenn ein `stop()` während des Wartens den ersten `start()` aufhält (früher Return, die State Machine bleibt in `NEW`, der Pause-Handler `:1028` mit `#stopAnimationOfThree()` läuft nie) · Paket 3, Zug 0 · vorbestehend · ein Fix zieht TSDoc `pause` und `CHANGELOG.md:47` mit, die nach Paket 3 genau diese Grenze nennen
- Ziel: `pause` meldet `true` genau dann, wenn auch die rAF-Schleife von three ruht, auch vor dem ersten `start()` und wenn ein `stop()` den ersten `start()` aufhält.
- Bereich: `packages/twopoint5d/src/display/Display.ts`, `Display.spec.ts`, ggf. `display-lifecycle.test.js`, `packages/twopoint5d/CHANGELOG.md`
- Hängt ab von: 1, 3
- Hash: 81ca08de
- Ergebnis: 1 Runde · PERF-032 (Rest) behoben, PERF-032 damit ganz (412f4a66 + 81ca08de) · Regressionstests in `Display.spec.ts` (vor dem Fix alle fünf rot): `a stop() before the first start() stops the animation loop of three once the renderer is up, and pause = false starts it again once`, `a pause = true before the first start() stops the animation loop of three right away, and start() starts it again once`, `a stop() while the first start() waits stops the animation loop of three, and the next start() starts it again once`, `an init listener that throws after a stop() before the first start() leaves the animation loop of three running, as pause answers false`, `dispose() of a display that has not started stops the animation loop of three, as it does for a running display` · Browser-Test `a stop() while start() waits for a real init lets the animation loop of three stand still, and the next start() runs it once` · Review freigegeben, 1 × klein (Paketdatei): TSDoc `pause` nennt nicht, dass ein Callback, den der Aufrufer nach dem Anhalten selbst per `renderer.setAnimationLoop()` setzt, bis zum Lauf des Displays keine Ticks bekommt
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: keine Signatur geändert · vor dem ersten Start folgt die rAF-Schleife von three `pause`: `stop()`/`pause = true` hält sie an (während `renderer.init()` sobald die Init sie gestartet hat), `pause = false` oder der nächste `start()` lässt sie wieder laufen · `dispose()` eines nie gestarteten Displays hält sie an · privat in `Display`: `#followPauseBeforeStart()`

### [x] 5. Display-Doku: TSDoc von pause nennt die Grenze für eigene Animation-Loop-Callbacks
- Folge von: 4 (kleiner Befund des Reviewers, ohne eigene Runde)
- Detail: docs/remediation/paket-5.md
- Folge: `packages/twopoint5d/src/display/Display.ts:1720` (TSDoc `pause` `:1159-1161`) — ein nie gestartetes Display hält auch die Schleife eines vom Aufrufer übergebenen Renderers an; setzt der Aufrufer danach selbst `renderer.setAnimationLoop(cb)`, bekommt er bis zum Lauf des Displays keine Ticks. Der Kommentar `:1733-1735` nennt diese Grenze für `PAUSED` schon, die TSDoc von `pause` nennt nur einen Renderer, auf dem bereits ein anderer `FrameLoop` läuft, nicht einen Callback, der erst nach dem Anhalten gesetzt wird. Mitziehen, wo `CHANGELOG.md:47` denselben Satz führt.
- Folge (Symptom, Zug 0 von Paket 5): `packages/twopoint5d/src/display/Display.ts:1731-1734` — Kommentar in `#stopAnimationOfThree()` sagt, ein verbliebener Callback gehöre einem anderen `FrameLoop`; seit 81ca08de läuft die Methode auch vor dem ersten Start, wo es ein vom Aufrufer per `renderer.setAnimationLoop()` gesetzter sein kann. Dieselbe Ursache, deshalb hier
- Ziel: Die TSDoc von `pause` (und der gleichlautende CHANGELOG-Satz) nennt jede Lage, in der ein angehaltenes Display fremde Animation-Loop-Callbacks auf seinem Renderer ohne Ticks lässt.
- Bereich: `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/CHANGELOG.md` — nur Doku, kein Verhalten
- Hängt ab von: 4
- Hash: 3fbfdb55
- Ergebnis: 2 Runden · Folge aus Paket 4 und Symptom in `#stopAnimationOfThree()` behoben (reiner Text, kein Regressionstest) · Runde 1 ließ den Kommentar über Frames nach dem Wiederanlauf schweigen, Runde 2 beseitigte die dabei entstandene Doppelung · Review freigegeben, 2 × klein (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine

### [x] 6. Display-Doku: »goes on the renderer« eindeutig machen
- Folge von: 5 (kleiner Befund des Reviewers, ohne eigene Runde)
- Detail: docs/remediation/paket-6.md
- Folge: `packages/twopoint5d/src/display/Display.ts:1166` (TSDoc `pause`) und `packages/twopoint5d/CHANGELOG.md:47` — »A callback that goes on the renderer after the display has stopped the loop« liest sich auch als »der weiterläuft«; gemeint ist ein Callback, der auf den Renderer gesetzt wird. Eindeutig: »is set on the renderer«. Dieselbe Wendung im Kommentar von `#stopAnimationOfThree()` (»One that goes on the renderer while the loop stands still«) mitziehen.
- Ziel: Die Doku zur angehaltenen three-Schleife sagt an jeder Stelle unmissverständlich »auf den Renderer gesetzt«.
- Bereich: `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/CHANGELOG.md` — nur Doku und Kommentar, kein Verhalten
- Hängt ab von: 5
- Hash: c983e745
- Ergebnis: 1 Runde · Folge aus Paket 5 behoben an `Display.ts:1165`, `Display.ts:1737-1738`, `CHANGELOG.md:47` (reiner Text, kein Regressionstest) · Review freigegeben, 2 × klein (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine
