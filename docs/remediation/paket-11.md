# Paket 11 — Drain: Reste aus Paket 9 — verschachtelter AggregateError von Stage2D#dispose(), Kommentar in withSquare()

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings · zwei Reviewer-Befunde »klein« aus Paket 9
  (Nebenbefund 1: verschachtelter `AggregateError` von `Stage2D#dispose()`,
  low; Nebenbefund 2: Kommentar in `withSquare()`, info) · dazu gleiche
  Ursache wie Nebenbefund 1: TSDoc, Fehlermeldung und Test von
  `Canvas2DStage#dispose()` und die beiden unveröffentlichten
  CHANGELOG-Einträge von `Stage2D#dispose()` und `Canvas2DStage#dispose()`
- Folge von: Paket 9
- Ziel: Stage2D#dispose() meldet mehrere gleichzeitige Fehler in einer
  dokumentierten und getesteten Form, und der Kommentar in withSquare()
  beschreibt den try-Block so, wie er steht.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/stage/Stage2D.ts` (nur TSDoc von `dispose()`)
  - `packages/twopoint5d/src/stage/Stage2D.spec.ts` (zwei neue Tests)
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts` (TSDoc und Meldung von
    `dispose()`)
  - `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts` (ein neuer Test,
    ein Typ-Import)
  - `packages/twopoint5d/CHANGELOG.md` (zwei Sätze in `[Unreleased]`, Zeilen
    26 und 39)
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js` (ein Kommentar)
- Vorgehen:
  1. **Keine Verhaltensänderung an der Fehlerform.** `Stage2D#dispose()` und
     `Canvas2DStage#dispose()` sammeln ihre Fehler und werfen sie per
     `throwCollected()`; was jede Quelle wirft, geht unverändert in die
     Sammlung — ein `AggregateError` aus `emitStrict()` (mehrere werfende
     Listener) bleibt als ein Eintrag stehen, wird nicht flachgezogen.
     `src/utils/throwCollected.ts` bleibt, wie es ist. Nur die Meldung von
     `Canvas2DStage#dispose()` ändert sich (Schritt 4).
  2. `packages/twopoint5d/src/stage/Stage2D.ts`, TSDoc von `dispose()`: die
     beiden letzten Zeilen des Blocks (heute `:434-435`)

     ```
        * the caller afterwards — one unchanged, several as an `AggregateError`. An error from releasing
        * the pass node reaches the caller the same way, collected after that of the listeners.
     ```

     ersetzen durch genau diese vier Zeilen (Breite des Blocks, höchstens 100
     Zeichen je Zeile; die erste Zeile bleibt wortgleich):

     ```
        * the caller afterwards — one unchanged, several as an `AggregateError`. An error from releasing
        * the pass node reaches the caller as well: on its own unchanged, together with that of the
        * listeners as an `AggregateError` of the error of the listeners and that of the release, in
        * this order — the first an `AggregateError` itself when more than one listener threw.
     ```

     Code von `dispose()` und die Meldung
     `'Stage2D#dispose(): a listener of the dispose event threw, and so did the release of the pass node'`
     (`:459`) bleiben unverändert.
  3. `packages/twopoint5d/src/stage/Canvas2DStage.ts`, TSDoc von `dispose()`:
     den letzten Absatz (heute `:277-280`)

     ```
        * A listener of `OnCanvas2DStageDispose` that throws does not hold up the teardown: every
        * subscriber hears the event, the instance is torn down completely, and the error reaches the
        * caller afterwards — one unchanged, several as an `AggregateError`. That holds for the
        * `OnStageDispose` listeners of the {@link StageRenderer} and the {@link Stage2D} as well.
     ```

     ersetzen durch genau diese zehn Zeilen:

     ```
        * A listener of `OnCanvas2DStageDispose` that throws does not hold up the teardown: every
        * subscriber hears the event, the instance is torn down completely, and the error reaches the
        * caller afterwards — one unchanged, several as an `AggregateError`. That holds for the
        * `OnStageDispose` listeners of the {@link StageRenderer} and the {@link Stage2D} as well, and
        * for the release of the pass node of the `Stage2D`. Three parts contribute one error each at
        * most — the listeners of `OnCanvas2DStageDispose`, `StageRenderer#dispose()` and
        * `Stage2D#dispose()`; when more than one of them throws, the `AggregateError` carries their
        * errors in this order, each as it was thrown — an `AggregateError` itself when more than one
        * listener of its event threw, or when both the listeners of the `Stage2D` and the release of
        * its pass node threw.
     ```

  4. `packages/twopoint5d/src/stage/Canvas2DStage.ts`, Meldung im
     `throwCollected()`-Aufruf am Ende von `dispose()` (heute `:320`):
     `'Canvas2DStage#dispose(): listeners of the dispose events of the stage, its stage renderer and its Stage2D threw'`
     wird zu
     `'Canvas2DStage#dispose(): more than one of its dispose listeners, StageRenderer#dispose() and Stage2D#dispose() threw'`.
     Grund: seit `Stage2D#dispose()` den Fehler der Freigabe seiner Pass-Node
     meldet, stammt nicht jeder gesammelte Fehler von einem Listener. Der
     Aufruf bleibt mehrzeilig, wie Prettier ihn formatiert.
  5. `packages/twopoint5d/src/stage/Stage2D.spec.ts`, im
     `describe('dispose()')` direkt hinter dem Test
     `'an error from releasing the pass node reaches the caller together with the error of a dispose listener'`
     (heute `:701-726`) zwei neue Tests, Idiom wie die Nachbarn (`it`,
     `makeStage()`, `noRenderer`, `sandbox`, `on`, `getSubscriptionCount`,
     `try … catch` in `caught`):
     - `it('two dispose listeners that throw reach the caller as one AggregateError of both errors, after the teardown', …)`:
       `makeStage()`, `asPassNode(noRenderer) as PassNode`, `sandbox.spy`
       auf dessen `dispose`; zwei Listener auf `OnStageDispose`, die
       `first` bzw. `second` (je `new Error(…)`) werfen. Erwartet:
       `caught` ist `AggregateError`, `.errors` gleich `[first, second]`,
       der Spy auf `passNode.dispose` einmal gerufen, `stage.isDisposed`
       `true`, `getSubscriptionCount(stage)` `0`.
     - `it('two dispose listeners that throw and a failing release of the pass node reach the caller as an AggregateError of the AggregateError of the listeners and the error of the release', …)`:
       wie oben, aber `sandbox.stub(passNode, 'dispose').throws(releaseFailure)`.
       Erwartet: `caught` ist `AggregateError`, Meldung passt auf
       `/^Stage2D#dispose\(\)/`, `errors` hat Länge 2, `errors[0]` ist
       `AggregateError` mit `.errors` gleich `[first, second]`, `errors[1]`
       ist `releaseFailure` (`toBe`), `stage.isDisposed` `true`,
       `getSubscriptionCount(stage)` `0`.
  6. `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts`: den Import
     `import type {WebGPURenderer} from 'three/webgpu';` zu
     `import type {PassNode, WebGPURenderer} from 'three/webgpu';` erweitern.
     Im `describe('dispose()')` direkt hinter dem Test
     `'collects the errors of the dispose listeners of the stage, its stage renderer and its Stage2D'`
     (heute `:431-460`) ein neuer Test, Idiom wie der Nachbar (`test`,
     `makeStage()`, `sandbox`, `on`):
     `test('hands on the error of each part as it was thrown: two listeners of the stage, and a listener and the release of the pass node of the Stage2D', …)`:
     - `stage.setContainerSize(320, 240)` — die `Stage2D` bekommt damit ihre
       Kamera (wie in den Tests ab `:132`); dann
       `const passNode = stage.stage.asPassNode(stage.renderer) as PassNode;`
       (`asPassNode()` liest den Renderer nicht) und
       `sandbox.stub(passNode, 'dispose').throws(releaseFailure)`.
     - Zwei Listener auf `stage` für `OnCanvas2DStageDispose`, die `first`
       bzw. `second` werfen; ein Listener auf `stage.stage` für
       `OnStageDispose`, der `stage2DError` wirft.
     - Erwartet: `caught` ist `AggregateError`, Meldung passt auf
       `/^Canvas2DStage#dispose\(\)/`, `errors` hat Länge 2; `errors[0]` ist
       `AggregateError` mit `.errors` gleich `[first, second]`; `errors[1]`
       ist `AggregateError` mit `.errors` gleich
       `[stage2DError, releaseFailure]` und Meldung passend auf
       `/^Stage2D#dispose\(\)/`; `stage.stageRenderer.isDisposed` und
       `stage.stage.isDisposed` sind `true`.
  7. Gegenprobe der neuen Tests (sie sichern bestehendes Verhalten und laufen
     sofort grün; einen roten Lauf vor dem Fix gibt es hier nicht, weil kein
     Korrektheitsfehler behoben wird): vorübergehend in `Stage2D#dispose()`
     den Catch des `emitStrict()` auf
     `errors.push(...(error instanceof AggregateError ? error.errors : [error]))`
     ändern — der zweite neue Stage2D-Test muss rot werden; dieselbe Änderung
     im Catch des `emitStrict()` von `Canvas2DStage#dispose()` — der neue
     Canvas2DStage-Test muss rot werden. Beide roten Läufe (Testname und
     Assertion) in den Report, dann beide Änderungen zurücknehmen.
  8. `packages/twopoint5d/CHANGELOG.md`, nur im Abschnitt `[Unreleased]`,
     beide Einträge bleiben einzeilig, kein neuer Eintrag (Skill
     `updating-changelog`: unveröffentlichte Einträge werden an Ort und Stelle
     berichtigt):
     - Zeile 26 (Eintrag `add Canvas2DStage#dispose() …`): den Satz

       ```
       That holds for the `dispose` listeners of its `StageRenderer` and its `Stage2D` as well.
       ```

       ersetzen durch

       ```
       That holds for the `dispose` listeners of its `StageRenderer` and its `Stage2D` as well, and for the release of the pass node of its `Stage2D`. Three parts contribute one error each at most — the `dispose` listeners of the stage, `StageRenderer#dispose()` and `Stage2D#dispose()`; when more than one of them throws, the `AggregateError` carries their errors in this order, each as it was thrown — an `AggregateError` itself when more than one listener of its event threw, or when both the listeners of the `Stage2D` and the release of its pass node threw.
       ```

     - Zeile 39 (Eintrag `add Stage2D#dispose() …`): den Satz

       ```
       An error from releasing the pass node reaches the caller the same way, collected after that of the listeners.
       ```

       ersetzen durch

       ```
       An error from releasing the pass node reaches the caller as well: on its own unchanged, together with that of the listeners as an `AggregateError` of the error of the listeners and that of the release, in this order — the first an `AggregateError` itself when more than one listener threw.
       ```
  9. `packages/twopoint5d-testing/test/stage-pipeline.test.js`, Kommentar in
     `withSquare()` (heute `:428-430`)

     ```
         // a display of its own, released here: a test that calls this twice must not leave the first one to
         // the afterEach of the suite, which knows only the last one. Everything from the container on sits
         // in the try, so a display that fails to start or a builder that throws leaves nothing behind
     ```

     ersetzen durch genau diese vier Zeilen (Code darunter unverändert):

     ```
         // a display of its own, released here: a test that calls this twice must not leave the first one to
         // the afterEach of the suite, which knows only the last one. The try begins with the display, and
         // its finally releases what was built before it as well, the container included, so a display that
         // fails to start or a builder that throws leaves nothing behind
     ```

  10. Nicht anfassen: `StageRenderer.ts` (sein `dispose()` hat eine einzige
      Fehlerquelle, das `emitStrict()` des `OnStageDispose`; die TSDoc »one
      unchanged, several as an `AggregateError`« stimmt dort genau),
      `src/utils/throwCollected.ts`, `src/stage/README.md` (nennt keine
      Fehlerform), `docs/resource-lifecycle.md`. Der dort unter »Offene
      Befunde« neu gebuchte Abbruch von `StageRenderer#dispose()` hinter einem
      werfenden `OnStageRemoved`-Listener gehört **nicht** zu diesem Paket.
- Verify: `pnpm run ci` (aus dem Repo-Root). Schnelle Schleife vorher:
  `pnpm nx test twopoint5d -- src/stage/Stage2D.spec.ts src/stage/Canvas2DStage.spec.ts`
- Commit: `fix(stage): let the docs of Stage2D#dispose() and Canvas2DStage#dispose() say in which shape several errors reach the caller and test the nested AggregateError, let the error of Canvas2DStage#dispose() name the parts that threw, and let the comment in the helper withSquare() of the pipeline browser tests say where its try begins`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · Nebenbefund 1 unverändert
    (`Stage2D.ts:434-435` TSDoc, `:447` `emitStrict`, `:459`
    `throwCollected`; Spec `:701-726` mit einem werfenden Listener) ·
    Nebenbefund 2 unverändert (`stage-pipeline.test.js:428-430`, `try` ab
    `:438`) · aufgenommen, gleiche Ursache: `Canvas2DStage.ts:277-280`,
    `:318-321`, `Canvas2DStage.spec.ts:431-460`, `CHANGELOG.md:26`, `:39` ·
    offene Folgen: keine (Pakete 9 und 10 `Folgen: keine`) · »Offene
    Befunde«: `Display.ts` und `PanControl2D.spec.ts:344` ohne gemeinsame
    Ursache, liegen gelassen · neu nach »Offene Befunde«:
    `StageRenderer.ts:998-1000` (→ Scope)
  - 2026-09-29 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort low
  - 2026-09-30 Zug 2: Report FERTIG · 6 Dateien geändert (Stage2D.ts/.spec.ts, Canvas2DStage.ts/.spec.ts, CHANGELOG.md, stage-pipeline.test.js) · Gegenprobe: beide neuen Tests rot unter Flachziehen · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0
  - 2026-09-30 Zug 3: Reviewer (sonnet, low) bestanden, keine kritischen/wichtigen Befunde · Diff `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/4315597f-d231-47b0-abdc-4c175c925e0c/scratchpad/paket-11.diff`
  - 2026-09-30 Zug 4: keine Runde nötig
  - 2026-09-30 Zug 5: committet `a7206036`, Verify-Log `paket-11.verify.log` exit=0

## Urteil des Reviewers

- Nebenbefund 1 (Stage2D): behoben — `Stage2D.ts:434-437` TSDoc, zwei neue Tests in `Stage2D.spec.ts` hinter `:726`; aufgenommene Stellen erfüllt: `Canvas2DStage.ts` TSDoc und Meldung, neuer Test in `Canvas2DStage.spec.ts`, `CHANGELOG.md:26`, `:39`
- Nebenbefund 2 (withSquare): behoben — `stage-pipeline.test.js:428-431`
- Klein: Meldung in `Canvas2DStage.ts:~319` über 100 Zeichen (von Prettier so gesetzt, gemäß Vorgabe, kein Mangel)

## Entscheidungen in Zug 0

- **Verschachtelt lassen, dokumentieren, testen — nicht flachziehen.** Der
  Befund lässt beides offen. Für die verschachtelte Form spricht dreierlei im
  Repo selbst: `Display#start()` dokumentiert und testet genau diese Form
  (`Display.ts:463-466` »each an `AggregateError` itself when more than one
  listener of its event throws«, `Display.spec.ts:532-558`); das
  Referenzbeispiel in `docs/resource-lifecycle.md` §4 sammelt den Fehler aus
  `emitStrict()` unverändert; `Canvas2DStage#dispose()` verschachtelt ebenso.
  Flachziehen verlöre die Zuordnung (welche Fehler von Listenern, welcher von
  der Freigabe stammt) und müsste entweder `throwCollected()` ändern, das auch
  `TextureStore` und `TextureResource` nutzen, oder in jeder Stage-Klasse eine
  Sonderbehandlung einführen.
- **`Canvas2DStage#dispose()` gehört dazu.** Der Befund verlangt Einklang mit
  `Canvas2DStage#dispose()`, und der Reviewer von Paket 9 nennt dieselbe
  Lücke dort (»wie Canvas2DStage#dispose()«): TSDoc nennt die verschachtelte
  Form nicht, der Test (`Canvas2DStage.spec.ts:431-460`) prüft je Teil nur
  einen einzelnen Fehler. Die Sammlung dort stammt aus Paket 4 (`abf84d48`;
  vor dem Lauf, `5ff01ea2`, rief `dispose()` die Teile ohne Sammlung). Die
  Meldung »listeners of the dispose events … threw« wird mitgezogen, weil
  `Stage2D#dispose()` den Fehler der Freigabe seiner Pass-Node beisteuert —
  kein Listener-Fehler.
- **`StageRenderer#dispose()` bleibt unberührt**: eine Fehlerquelle, keine
  Verschachtelung, TSDoc stimmt.
- **CHANGELOG mitziehen**: die Einträge `:26` und `:39` in `[Unreleased]`
  tragen denselben unscharfen Satz wie die TSDoc; sonst lügt die Doku an einer
  Stelle weiter.
- **Dritte Generation**: Paket 11 ist `Folge von: Paket 9`, Paket 9 `Folge
  von` 2, 4, 6, 6b, 6c, 6d. Kein Halt: der Orchestrator hat das Paket mit
  dieser Kette vor Augen geschnitten (»Entscheidungen«, Eintrag »Dritte
  Drain-Runde (Paket 11)«, nachdem Zug 0 von Paket 10 die dritte Generation
  benannt hatte), und der Weg der Wurzel (Fehler sammeln, per
  `throwCollected()` werfen, wie `Display`) trägt — offen sind Doku und Test,
  kein Fehler des Wegs. Folgerung: Was der Reviewer dieses Pakets als »klein«
  meldet, bekommt kein weiteres Paket, sondern geht an den Abschluss.
- **Neuer Nebenbefund, nicht aufgenommen**: `StageRenderer#dispose()` bricht
  hinter einem werfenden `OnStageRemoved`- oder `OnRemoveFromParent`-Listener
  ab (`StageRenderer.ts:998-1000` → `remove()` → `emit` `:1169`;
  `#removeFromParent()` → `emit` `:281`): `#disposed` ist schon `true`,
  `#targets.dispose()`, das `OnStageDispose` und `off(this)` bleiben aus, ein
  zweites `dispose()` ist ein No-op. Vorbestehend — `git show
  5ff01ea2:packages/twopoint5d/src/stage/StageRenderer.ts`, `dispose()` ab
  `:748`, dieselbe Schleife über `remove()`, `emit` `:927`. Andere Ursache als
  dieses Paket: dort fehlt die Sammlung ganz (Verhaltensfix mit
  Regressionstest in einer anderen Klasse), hier geht es um die Form einer
  bestehenden Sammlung. Severity low, liegt unter `src/stage/**` → Scope; die
  Begründung steht hier, der Eintrag in »Offene Befunde«.

## Findings im Volltext

Keine Audit-Findings. Die beiden Reviewer-Befunde aus Paket 9, wie im Plan
gebucht:

**Nebenbefund 1 · low · `packages/twopoint5d/src/stage/Stage2D.ts:435`** —
werfen mehrere dispose-Listener und dazu die Freigabe der Pass-Node, ist der
erste Eintrag des AggregateError selbst ein AggregateError aus emitStrict;
throwCollected (`:459`) zieht ihn nicht flach, die TSDoc sagt nur »the same
way«, `Stage2D.spec.ts` testet nur einen werfenden Listener plus
Pass-Node-Fehler (`:720-722`).
Empfehlung: Test für mehrere Listener plus Pass-Node-Fehler ergänzen und die
verschachtelte Form in der TSDoc nennen, oder bewusst flachziehen, im Einklang
mit `Canvas2DStage#dispose()` und `StageRenderer#dispose()`.

**Nebenbefund 2 · info · `packages/twopoint5d-testing/test/stage-pipeline.test.js:430`** —
Kommentar »Everything from the container on sits in the try« stimmt nicht, das
try beginnt mit `new Display(squareHost)`.
Empfehlung: Wortlaut korrigieren.
