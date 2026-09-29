# Paket 10 — Drain: Zeilenumbrüche nach den Umbauten des Laufs

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings · Reviewer-Befunde »klein« aus den Paketen 2, 3, 5, 7, 8 (reine Formatierung von Fließtext, 15 Stellen), dazu acht Stellen gleicher Ursache aus dem Abgleich (Pakete 1, 2, 4, 6b, 7) — zusammen 24 Absätze A1–H1, dazu der Typ-Alias in der Lookbook-Demo (siehe Abgleich)
- Folge von: Paketen 1, 2, 3, 4, 5, 6b, 6c, 7, 8
- Ziel: Jede Stelle, an der ein Paket dieses Laufs Fließtext oder Kommentare verlängert hat, ist auf die Zeilenbreite ihres Blocks neu umbrochen; keine inhaltliche Änderung außer dem Bezugswort in README.md:676 (heute `:686`).
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - Bibliothek (nur TSDoc, kein Code): `packages/twopoint5d/src/stage/StageRenderer.ts`, `src/stage/RootRenderPipeline.ts`, `src/stage/OrthographicProjection.ts`, `src/stage/ParallaxProjection.ts`, `src/stage/outputNodeBuilders.ts`, `src/stage/Canvas2DStage.ts`, `src/controls/PanControl2D.ts`
  - Doku: `packages/twopoint5d/src/stage/README.md`, `packages/twopoint5d/CHANGELOG.md` (nur der eine Absatz im Migration Guide von `[Unreleased]`, kein neuer Eintrag)
  - Lookbook: `apps/lookbook/src/pages/demos/stage-projections.astro` (nur der Typ von `specs`)
  - nicht: Specs, Browser-Tests, `docs/resource-lifecycle.md`, `src/display/**`, jede Zeile, die unten nicht steht
- Vorgehen:
  1. **Absätze ersetzen.** Für jeden Absatz A1–H1 unter »Zieltexte« den bestehenden Absatz in der genannten Datei durch den Zieltext ersetzen — zeichengenau, Einrückung und Kommentarpräfix (` * ` bzw. `   * `) wie im Zieltext. Die Zeilennummern gelten für den Stand `d9d8c2dc`; innerhalb einer Datei von unten nach oben arbeiten (oder den Absatz am ersten und letzten Wort suchen), damit frühere Ersetzungen die Nummern nicht verschieben. Ein Absatz reicht von der ersten bis zur letzten genannten Zeile; die Leerzeilen (` *` bzw. leere Markdown-Zeile) davor und danach bleiben stehen. Die Zieltexte enthalten dieselben Wörter in derselben Reihenfolge wie das Original, nur neu umbrochen — einzige Ausnahme G6: dort heißt »Until then its `width` and `height` are 0« jetzt »Until that first `resize()` the stage's `width` and `height` are 0«. Kein Absatz außer A1–H1 wird angefasst, auch nicht, wenn er ähnlich aussieht (Begründungen im Abgleich).
  2. **Typ-Alias im Lookbook.** In `apps/lookbook/src/pages/demos/stage-projections.astro` steht in `:49`
     `const specs: {fit: 'contain' | 'cover' | 'fill'; width: number; height: number; distanceToProjectionPlane: number} = {`.
     Direkt vor dem Kommentarblock `:46-48` (»// one specs object for both projections: …«) einfügen, gefolgt von einer Leerzeile:
     ```ts
       type SharedSpecs = {
         fit: 'contain' | 'cover' | 'fill';
         width: number;
         height: number;
         distanceToProjectionPlane: number;
       };
     ```
     und `:49` wird `  const specs: SharedSpecs = {`. Der Kommentarblock `:46-48` bleibt unverändert über `const specs`. Danach `pnpm exec prettier --write apps/lookbook/src/pages/demos/stage-projections.astro`; was Prettier am Layout des Typs ändert, gilt.
  3. **Nichts sonst.** Kein CHANGELOG-Eintrag (nichts Nutzersichtbares; der Absatz H1 liegt im unveröffentlichten Migration Guide), kein Test, kein Umbruch außerhalb von A1–H1. Specs und Browser-Tests bleiben unberührt.
  4. **Prüfen, dass nur umbrochen wurde** (vor dem Verify-Gate, aus dem Repo-Root):
     ```bash
     git diff --word-diff=porcelain --word-diff-regex='[^[:space:]*/]+' -- packages/twopoint5d/src packages/twopoint5d/CHANGELOG.md | grep -E '^[-+][^-+]'
     ```
     Erwartet sind genau diese zwei Zeilen, sonst nichts:
     ```
     -then its
     +that first `resize()` the stage's
     ```
     Jede weitere Zeile ist ein verlorenes, verdoppeltes oder geändertes Wort — zurück an den Zieltext. Dazu die Breite:
     ```bash
     git diff -U0 -- packages/twopoint5d apps/lookbook | perl -CSD -ne 'print if /^\+(?!\+\+)/ && length($_) - 2 > 100'
     ```
     Erwartet: keine Ausgabe (die längste neue Zeile hat 100 Zeichen).
- Verify: `pnpm run ci` (dazu die beiden Prüfungen aus Schritt 4)
- Commit: `docs: rewrap the stage and PanControl2D docs and comments that outgrew the width of their blocks, let the README pitfall on a stage without a camera say whose width and height stay 0 until the first resize(), and give the specs of the projections demo a type of their own`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · 15 Stellen aus dem Plan: 12 unverändert (`StageRenderer.ts:98`, `README.md:213`, `CHANGELOG.md:3407`, `ParallaxProjection.ts:70`, `OrthographicProjection.ts:68`, `outputNodeBuilders.ts:54`, `Canvas2DStage.ts:199-200`, `:274-279`, `PanControl2D.ts:357`, `:444`, `:698`, `stage-projections.astro:49`), 3 nach unten gewandert durch Paket 8/9 (`README.md:535` → `:544`, `:646` → `:655`, `:676` → `:686`), »zweiter Absatz derselben Einfügung« zu `README.md:213` ist `:297-301` · 8 Stellen gleicher Ursache aufgenommen (A1, A3, A4, A5, A6, A7, B1, G2), dazu die vorbestehende Kurzzeile `PanControl2D.ts:696` im Absatz F3 · Folgen: keine offen (alle `Folgen:`-Zeilen im Plan »keine« oder verteilt) · die drei kleinen Befunde aus Paket 9 nicht aufgenommen (dritte Generation, für den Abschluss) · Offene Befunde: beide ohne gemeinsame Ursache, liegen gelassen
  - 2026-09-29 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort low, Report `paket-10.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG · 10 Dateien geändert (7 TS in `src/stage`/`src/controls`, `README.md`, `CHANGELOG.md`, `stage-projections.astro`) · Arbeitsbaum schmutzig · Wortprüfung genau die zwei erwarteten Zeilen, Breitenprüfung leer · `pnpm run ci --skip-nx-cache` exit=0 (`paket-10.verify.log`)
  - 2026-09-29 Zug 3: Reviewer (sonnet, low) bestanden, keine Befunde · Diff `paket-10.diff`, Report `paket-10.review-0.json`
  - 2026-09-29 Zug 4: entfällt, nichts offen
  - 2026-09-29 Zug 5: committet `c242a58c` mit Trailer `Remediation-Run: 2026-09-29`

## Urteil des Reviewers

- A1–A7 `StageRenderer.ts` (87, 97, 491, 518, 605, 824, 978): erfüllt
- B1 `RootRenderPipeline.ts:23`, C1 `OrthographicProjection.ts:64`, C2 `ParallaxProjection.ts:66`, D1 `outputNodeBuilders.ts:49`: erfüllt
- E1–E3 `Canvas2DStage.ts` (199, 267, 277), F1–F3 `PanControl2D.ts` (356, 443, 690, Kurzzeile `:696` aufgegangen): erfüllt
- G1–G5 `README.md` (212, 249, 297, 542, 653), G6 `README.md:680` mit Bezugswort: erfüllt · H1 `CHANGELOG.md:3401`: erfüllt · Typ-Alias `SharedSpecs` in `stage-projections.astro`: erfüllt
- Qualität: kritisch, wichtig, klein — nichts


## Abgleich

Stand `d9d8c2dc`. Jede Stelle an der Fundstelle nachgesehen, Zeilenlängen in Zeichen (nicht Bytes), Herkunft per `git blame`.

**Aus dem Plan** (Reviewer-Befunde »klein« der Pakete 2, 3, 5, 7, 8):

| Stelle im Plan | heute | Befund | Absatz |
| --- | --- | --- | --- |
| `StageRenderer.ts:98` | unverändert, `:97-101` | 116 Zeichen im Klassen-TSDoc, das sonst bei ≤ 79 bricht (`44743b2d` auf `59424ef0`) | A2 |
| `README.md:213` | unverändert, `:212-218` | 107 Zeichen im Abschnitt »Clear policy«, der bei ≤ 78 bricht (`59424ef0`, `44743b2d`) | G1 |
| »zweiter Absatz derselben Einfügung« | `README.md:297-301` | Paket 2 nannte `:205` und `:291` (Stand damals); `:299` 82 Zeichen im Mode-C-Abschnitt bei ≤ 78 | G3 |
| `README.md:535` | `:542-546` (Paket 8 hat oberhalb eingefügt) | `:544` 96 Zeichen bei ≤ 79 (`ffd22adc`) | G4 |
| `README.md:646` | `:653-657` | `:655` 137 Zeichen im Punkt zu `Canvas2DStage.dispose()`, Block ≤ 97 (`fa412714`) | G5 |
| `README.md:676` | `:680-690` | `:685-686`: nach dem Einschub »and without a stage only its clear« (`e121dbb4`) zeigt »its« in »Until then its `width` and `height` are 0« auf den `StageRenderer` statt auf die Stage; `:686` hat 35 Zeichen | G6 (Bezugswort) |
| `CHANGELOG.md:3407` | unverändert, Absatz `:3401-3407` | Waise »last.« (`8614c309`); bei 100 Zeichen Breite sechs Zeilen ohne Waise, im Rahmen des Abschnitts (93–101) | H1 |
| `ParallaxProjection.ts:70` | unverändert, `:66-72` | 128 Zeichen, Block ≤ 100 (`fa412714`) | C2 |
| `OrthographicProjection.ts:68` | unverändert, `:64-70` | 128 Zeichen, Block ≤ 100 (`fa412714`) | C1 |
| `outputNodeBuilders.ts:54` | unverändert, `:49-54` | 144 Zeichen, Block ≤ 99 (`e121dbb4`) | D1 |
| `Canvas2DStage.ts:199-200` | unverändert, `:199-201` | 102/105 Zeichen, Block ≤ 96 (`ffd22adc`) | E1 |
| `Canvas2DStage.ts:274-279` | unverändert, `:267-275` und `:277-280` | 102/103/102 Zeichen und die Kurzzeile »follows it.« `:275` (`ffd22adc`) | E2, E3 |
| `PanControl2D.ts:357` | unverändert, `:356-359` | 106 Zeichen, Block ≤ 96 (`ffd22adc`) | F1 |
| `PanControl2D.ts:444` | unverändert, `:443-445` | 107 Zeichen (`ffd22adc`) | F2 |
| `PanControl2D.ts:698` | unverändert, `:690-700` | 104 Zeichen (`ffd22adc`); im selben Absatz die Kurzzeile `:696` (41 Zeichen, vor dem Lauf, `68c3bffb`) — wird mit dem Absatz neu umbrochen, kein eigener Eintrag | F3 |
| `stage-projections.astro:49` | unverändert | Inline-Typ von `specs`, 120 Zeichen (`ffd22adc`); Code, kein Fließtext — deshalb Schritt 2 statt eines Umbruchs | — |

**Gleiche Ursache, beim Abgleich gefunden** — ein Durchgang mit einem Skript über alle Kommentar- und Prosablöcke der Dateien, die der Lauf seit `5ff01ea2` geändert hat: Blöcke mit einer Zeile, die dieser Lauf geschrieben hat, und einer Zeile, die deutlich über die Breite ihrer Nachbarn hinausragt, oder einer Nicht-Schlusszeile mit mehr als 18 Zeichen Luft vor dem nächsten Wort. Jeder Treffer von Hand nachgesehen:

| Stelle | Befund | Herkunft | Absatz |
| --- | --- | --- | --- |
| `StageRenderer.ts:87-91` (Klassen-TSDoc »Clearing«, erster Absatz) | `:88` »(default `false`). When `clear` is« mit 37 Zeichen, Block ≤ 79 | `676eefa7` | A1 |
| `StageRenderer.ts:491-502` (TSDoc `outputRenderTarget`) | `:499` »a `RootRenderPipeline` — a child« mit 37 Zeichen nach dem Einschub | `59424ef0` | A3 |
| `StageRenderer.ts:518-525` (TSDoc `buildOutputNode`, dritter Absatz) | `:520` 68 Zeichen, `:522` 95 Zeichen, Block ≤ 76 | `59424ef0`, `e121dbb4` | A4 |
| `StageRenderer.ts:605-607` (TSDoc `#outputDirty`) | `:606` 108 Zeichen, Nachbarn 93/88 | `59424ef0` | A5 |
| `StageRenderer.ts:824-829` (TSDoc `#renderPipelineComposed()`) | Zeilen 98/72/68/69/97 — zwei Umbauten mit verschiedener Breite übereinander | `7f0d5159`, `676eefa7`, `e121dbb4` | A6 |
| `StageRenderer.ts:978-984` (TSDoc `dispose()`) | `:982` »renderer goes with it, including the« mit 41 Zeichen | `abf84d48` | A7 |
| `RootRenderPipeline.ts:23-24` (TSDoc `buildOutputNode()`) | `:24` 99 Zeichen, Block ≤ 78 | `e121dbb4` | B1 |
| `README.md:249-259` (Abschnitt `outputRenderTarget`) | `:252` 59, `:256` 60, `:257` 49 Zeichen nach dem Einschub zu Mode C, Block ≤ 79 | `59424ef0` | G2 |

**Bewusst nicht aufgenommen** — mit Grund, damit niemand sie für vergessen hält:

- `README.md:281` (101 Zeichen): ein Markdown-Link mit langem Anker `[Shortcut: …](#shortcut-rootrenderpipeline--additive-composition-out-of-the-box)`; darin lässt sich nicht sinnvoll umbrechen.
- `README.md:269-275` (»Two notes on the types …«, `f4213cf8`): `:274-275` mit 85 Zeichen neben 67–81 — innerhalb der Streuung des Absatzes, kein Ausreißer.
- `README.md:644-647`: die kurze Zeile »each of the two changes.« (`59424ef0`) endet einen Satz, und der nächste Satz beginnt nach dem Stil des Punkts vor dem Lauf auf einer eigenen Zeile (`5ff01ea2`: »either of them has changed.« / »`Stage2D.dispose()` releases …«).
- Einzeilige `/** … */`-TSDocs über 100 Zeichen (`StageRenderer.ts:601`, `:713`, `:748`, `:795`, `:845`, `:857`; `StageRendererTargets.ts:23`, `:26`, `:28`, `:37`): Form des Projekts — vor dem Lauf waren 74 von 235 einzeiligen TSDocs in `packages/twopoint5d/src` länger als 100 Zeichen, Prettier hält 130. Das gilt auch für den kleinen Befund aus Paket 9 zu `StageRendererTargets.ts:23` (`#pass`, 104 Zeichen).
- Zweizeilige Absätze mit langer erster und kurzer Schlusszeile (etwa `events.ts:164-197`, `StageRenderOrder.ts`, `IProjection.ts:32-64`, `stage-pipeline.test.js:414-701`): gewöhnlicher Umbruch, keine Stelle ragt über ihren Block.
- Migration Guide in `CHANGELOG.md` (`[Unreleased]`, `:529-3529`): 86 Absätze stehen dort einzeilig (auch vor dem Lauf, z. B. `:533`, `:593`), die neuen einzeiligen Absätze `:3381`, `:3460`, `:3486`, `:3507` folgen dieser Form. Nur die Waise in H1 ist ein Umbruchfehler.
- `apps/lookbook/src/pages/demos/stage-postprocessing.astro:32-33`: zwei Kommentarsätze auf je einer Zeile, kein Umbruch.

**Folgen und Offene Befunde:**

- `Folgen:`-Zeilen im Plan: alle »keine« oder bereits verteilt — nichts zu triagieren.
- Die drei kleinen Befunde des Reviewers von Paket 9 (`paket-9.md`, »Urteil des Reviewers«: Kommentar in `withSquare()` »from the container on« statt »from the display on«; `#pass`-TSDoc 104 Zeichen; verschachtelter `AggregateError` aus `Stage2D#dispose()` ungetestet, TSDoc »the same way«) sind nicht aufgenommen. Paket 9 ist selbst `Folge von: Paketen 2, 4, 6, 6b, 6c, 6d`; ein Nachtrag zu seinen Befunden wäre die dritte Generation der Kette, und die legt der Skill dem Nutzer vor, statt sie still zu verteilen. Sie liegen für den Abschluss in `paket-9.md`, der die kleinen Befunde aus den Paketdateien einsammelt; der zweite ist nach dem Punkt oben ohnehin kein Befund.
- »Offene Befunde«: `Display.ts:423-593` (→ Audit) und `PanControl2D.spec.ts:344` (→ Rückfrage) teilen die Ursache nicht mit diesem Paket; liegen gelassen. F3 schreibt den TSDoc von `PanControl2D#dispose()` nur neu um — der Satz »{@link update} still moves {@link panView} …«, um den es in der Rückfrage geht, bleibt Wort für Wort.

## Begründungen

- **Breite je Block, nicht je Datei.** Die Blöcke dieses Repos brechen verschieden: das Klassen-TSDoc von `StageRenderer` und die TSDocs von `outputRenderTarget`/`buildOutputNode` bei etwa 80, die meisten Methoden-TSDocs bei etwa 100, die README-Abschnitte zur Clear-Policy, zu Mode C und zu den Pitfalls bei etwa 80, die Punkte unter »Resource lifecycle« bei etwa 98. Jeder Zieltext nimmt die Breite seines Blocks; Prettier bricht weder Kommentare noch Markdown um (`*.md` steht in `.prettierignore`), deshalb stehen die Zieltexte fertig da.
- **Gieriger Umbruch mit drei Ausnahmen.** Jede Zeile nimmt so viele Wörter, wie in die Breite passen; `{@link …}` und Code-Spans in Backticks werden nie getrennt. Wo das eine Waise oder einen Zeilenanfang »—,« ergab, ist die Breite um wenige Zeichen verschoben: A1 bei 81 (bei 80 endete eine Zeile auf »/« zwischen `{@link clearColor}` und `{@link clearAlpha}`), A7 bei 98 (bei 100 blieb »`remove()`).« allein), E1 bei 98 (bei 100 begann die dritte Zeile mit »—,«), G1 bei 77 (bei 80 blieb »in it.«), G4 bei 78 (bei 80 blieb »`add()`.«). Alle Zieltexte sind gegen die Originale geprüft: dieselben Wörter in derselben Reihenfolge.
- **Das Bezugswort in G6.** Der Punkt handelt von der `Stage2D`; nach dem Einschub von Paket 7 über den `StageRenderer` zeigen »its« und »then« auf den Renderer und seine Stages. »the stage's« nennt den Besitzer, »that first `resize()`« den Zeitpunkt, den der Satz meint — auch für den Fall »or you assign your own« camera, in dem »then« (die Kamera entsteht) nicht passt: `width` und `height` kommen aus `updateViewRect()` und bleiben bis zum ersten `resize()` mit Fläche 0.
- **Typ-Alias statt Bibliothekstyp.** `ParallaxProjectionSpecs` und `OrthographicProjectionSpecs` bauen auf der Union `FitIntoRectangleSpecs` auf; die Demo schreibt `fit` über lil-gui in dasselbe Objekt, das beide Projektionen lesen, und braucht dafür genau die vier Felder. Ein lokaler Alias verkürzt die Zeile, ohne die Typisierung zu ändern.

## Zieltexte

Jeder Block ersetzt genau die genannten Zeilen (Stand `d9d8c2dc`). Das Präfix in den TSDoc-Blöcken gehört zum Text: ` * ` auf Klassen- und Modulebene, `   * ` in Klassenmitgliedern.

**A1** · `packages/twopoint5d/src/stage/StageRenderer.ts:87-91` · Klassen-TSDoc »Clearing«, erster Absatz ab »{@link clear} is the only clear« · Breite 81

```text
 * {@link clear} is the only clear of the target this renderer writes to (default
 * `false`). When `clear` is `true`, the renderer clears the active render target
 * before drawing its stages, using {@link clearColor} / {@link clearAlpha} and
 * the `clearColorBuffer` / `clearDepthBuffer` / `clearStencilBuffer` flags.
```

**A2** · `packages/twopoint5d/src/stage/StageRenderer.ts:97-101` · Klassen-TSDoc »Clearing«, Absatz ab »With a {@link pipeline} that is not a« · Breite 80

```text
 * With a {@link pipeline} that is not a `RootRenderPipeline` and without
 * {@link buildOutputNode} (Mode C), the stages draw into an internal target
 * that the renderer clears to transparent black (color and depth) every frame,
 * whatever `clear` says; the own `clear` then applies on top, and one that
 * covers color and depth replaces the black clear.
```

**A3** · `packages/twopoint5d/src/stage/StageRenderer.ts:491-502` · TSDoc von `outputRenderTarget`, zweiter Absatz ab »Without a {@link pipeline}« · Breite 80

```text
   * Without a {@link pipeline}, the stages draw into it linear in the working
   * color space and without tone mapping, as three.js draws into every
   * `RenderTarget`. With a pipeline, its output transform applies — tone
   * mapping and the encoding to `renderer.outputColorSpace`, as long as
   * `pipeline.outputColorTransform` is `true` — just as on the canvas. A
   * renderer that a parent draws into a target of the parent's own pipeline
   * writes linear in both cases; the outermost pipeline applies the transform.
   * Under a Mode C parent — a pipeline without `buildOutputNode` that is not a
   * `RootRenderPipeline` — a child writes linear into its own
   * `outputRenderTarget` as well: the parent switches to linear output for all
   * of its stage draws, whichever target they write to.
```

**A4** · `packages/twopoint5d/src/stage/StageRenderer.ts:518-525` · TSDoc von `buildOutputNode`, dritter Absatz ab »Assigning or clearing it« · Breite 80

```text
   * Assigning or clearing it switches between the two pipeline modes; the
   * output node is rebuilt on the next render. Under a `RootRenderPipeline` the
   * renderer composes either way. While this renderer's `width` or `height` is
   * 0, or while a `Stage2D` it composes has no camera, the composed mode draws
   * nothing. Without a stage it draws its own clear and calls neither this
   * callback nor the pipeline. Assigning it to a renderer whose pipeline
   * samples the internal target releases the GPU memory of that target;
   * clearing it again allocates that memory again on the next frame.
```

**A5** · `packages/twopoint5d/src/stage/StageRenderer.ts:605-607` · TSDoc von `#outputDirty` · Breite 100

```text
   * Marks `pipeline.outputNode` of the composed mode as needing a rebuild: the stages, their order
   * or names, the pipeline, `buildOutputNode` or the camera or the scene of a stage changed. Only
   * the composed mode reads it; Mode C keeps its own node, see `#wireInternalOutputNode()`.
```

**A6** · `packages/twopoint5d/src/stage/StageRenderer.ts:824-829` · TSDoc von `#renderPipelineComposed()` · Breite 100

```text
   * Mode D, and Mode E for nested renderers: for each stage, get its pass node; pre-render nested
   * `StageRenderer` children into their pass-targets first, with linear output (see
   * `#beginLinearOutput()`). Then run the pipeline with `buildOutputNode(passes)` as `outputNode`;
   * it applies the output transform of the caller. Without a stage it draws its own clear and
   * neither builds an output node nor runs the pipeline.
```

**A7** · `packages/twopoint5d/src/stage/StageRenderer.ts:978-984` · TSDoc von `dispose()`, Absatz ab »An `OnStageDispose` goes out« · Breite 98

```text
   * An `OnStageDispose` goes out to every subscriber before this renderer stops listening; no
   * event follows it. A listener of the event that throws does not hold up the teardown: every
   * subscriber hears the event, the renderer is torn down completely, and the error reaches the
   * caller afterwards — one unchanged, several as an `AggregateError`. Every listener on this
   * renderer goes with it, including the `OnStageAdded` and `OnStageRemoved` subscriptions a
   * caller placed on it, and so do the camera, scene and dispose listeners it placed on its
   * stages (through `remove()`).
```

**B1** · `packages/twopoint5d/src/stage/RootRenderPipeline.ts:23-24` · TSDoc von `static buildOutputNode()` (zwei Zeilen werden drei) · Breite 80

```text
   * Additively combine `passes` (`p0.add(p1).add(p2)…`) into a single output
   * node. Throws when `passes` is empty; a `StageRenderer` without stages does
   * not call it.
```

**C1** · `packages/twopoint5d/src/stage/OrthographicProjection.ts:64-70` · TSDoc von `updateViewRect()` · Breite 100

```text
   * Fits the view into a container of `width` × `height`. A width or a height that is not a finite
   * number above 0 leaves the projection as it is. Specs that give no view with an area keep the
   * last view, while the pixel ratio follows the new container; a projection that has no view yet
   * stays as it is. Until the first call that gives a view with an area, `getViewRect()` reports
   * `{width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0}`. A call that gives a view with an area
   * also takes `near`, `far` and `distanceToProjectionPlane` from the specs; a value no camera can
   * be built from counts as not given, as `OrthographicProjectionSpecs` describes.
```

**C2** · `packages/twopoint5d/src/stage/ParallaxProjection.ts:66-72` · TSDoc von `updateViewRect()` · Breite 100

```text
   * Fits the view into a container of `width` × `height`. A width or a height that is not a finite
   * number above 0 leaves the projection as it is. Specs that give no view with an area keep the
   * last view, while the pixel ratio follows the new container; a projection that has no view yet
   * stays as it is. Until the first call that gives a view with an area, `getViewRect()` reports
   * `{width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0}`. A call that gives a view with an area
   * also takes `near`, `far` and `distanceToProjectionPlane` from the specs; a value no camera can
   * be built from counts as not given, as `ParallaxProjectionSpecs` describes.
```

**D1** · `packages/twopoint5d/src/stage/outputNodeBuilders.ts:49-54` · TSDoc von `createBloomOutputNodeBuilder()`, Absatz ab »The builder belongs to the caller« (endet vor ` *` und dem Codebeispiel) · Breite 100

```text
 * The builder belongs to the caller: `StageRenderer#dispose()` leaves it alone. Give every renderer
 * a builder of its own — the callback cannot tell who calls it, so one builder that two renderers
 * share releases the bloom of one of them whenever the other rebuilds. Take the builder off the
 * renderer before you dispose it (`buildOutputNode = undefined`, or dispose the renderer): a
 * renderer that still holds a disposed builder throws on its next rebuild, and a `StageRenderer`
 * does not take a disposed builder. An empty list of passes throws; a `StageRenderer` without
 * stages does not call the builder.
```

**E1** · `packages/twopoint5d/src/stage/Canvas2DStage.ts:199-201` · TSDoc von `render()`, erster Absatz · Breite 98

```text
   * Draws one frame, in this order: `OnCanvas2DStageResize` if the canvas size changed since the
   * last frame, `OnCanvas2DStageRender` — the moment to draw into the canvas and set
   * `needsUpdate` —, the upload of the canvas, `stageRenderer.updateFrame()` and
   * `stageRenderer.renderTo()`.
```

**E2** · `packages/twopoint5d/src/stage/Canvas2DStage.ts:267-275` · TSDoc von `dispose()`, Absatz ab »Afterwards `isDisposed` is `true`, `texture` answers« · Breite 100

```text
   * Afterwards `isDisposed` is `true`, `texture` answers `undefined`, and `render()`,
   * `setCanvasSize()`, `setContainerSize()`, a write to `fit` and a further `dispose()` do nothing.
   * `canvas`, `renderer`, `projection`, `scene`, `sprite` and `needsUpdate` keep the values the
   * stage was left with. {@link width} and {@link height} read `canvas.width` and `canvas.height`,
   * so they keep answering with whatever stands at the canvas — including what the caller sets
   * there later. The `readonly` fields {@link stage} and {@link stageRenderer} answer with the same
   * instance as before, and both of them report `isDisposed === true`. An `OnCanvas2DStageDispose`
   * goes out to every subscriber before this stage stops listening; no event follows it.
```

**E3** · `packages/twopoint5d/src/stage/Canvas2DStage.ts:277-280` · TSDoc von `dispose()`, Absatz ab »A listener of `OnCanvas2DStageDispose` that throws« · Breite 100

```text
   * A listener of `OnCanvas2DStageDispose` that throws does not hold up the teardown: every
   * subscriber hears the event, the instance is torn down completely, and the error reaches the
   * caller afterwards — one unchanged, several as an `AggregateError`. That holds for the
   * `OnStageDispose` listeners of the {@link StageRenderer} and the {@link Stage2D} as well.
```

**F1** · `packages/twopoint5d/src/controls/PanControl2D.ts:356-359` · TSDoc von `panView`, zweiter Absatz · Breite 100

```text
   * The first `update()` after a state is assigned — in the constructor through `options.state`, or
   * here — emits `OnPanControl2DUpdate` even when nothing moved, so a listener learns where the
   * view starts. Assigning the state this control already holds changes nothing: before that first
   * `update()` the announcement stays due, after it none is added.
```

**F2** · `packages/twopoint5d/src/controls/PanControl2D.ts:443-445` · TSDoc von `update()`, erster Absatz · Breite 100

```text
   * Move {@link panView} by what the speed fields, the keys and the pointer collected since the
   * last call, and emit `OnPanControl2DUpdate` with the new `x` and `y` when that moved the view —
   * and on the first call after a state was assigned to {@link panView}, whether it moved or not.
```

**F3** · `packages/twopoint5d/src/controls/PanControl2D.ts:690-700` · TSDoc von `dispose()`, Absatz ab »Afterwards `isDisposed` is `true`, `isActive` is `false`« · Breite 100

```text
   * Afterwards `isDisposed` is `true`, `isActive` is `false`, and neither a pointer nor a key
   * reaches this control any more. {@link update} still moves {@link panView} by the speed fields a
   * caller sets by hand; a key that was still held down when `dispose()` ran has given its field
   * back, and what it no longer delivers is a pan from a drag before the call. A write to
   * {@link cursorPanStyle} is refused: a disposed control retains no more rules from a stylesheet
   * that is not its own. `pixelsPerSecond`, `mouseButton`, `keys`, `keyCodes`, `keyboardDisabled`,
   * `pointerDisabled`, `panView` and the four `speed…` fields still take values, they just drive
   * nothing. A control that was hiding the cursor emits one last `OnPanControl2DRestoreCursor`
   * while its subscribers can still hear it; after that every listener on this control goes with
   * it, and a further `dispose()` does nothing.
```

**G1** · `packages/twopoint5d/src/stage/README.md:212-218` · Abschnitt »Clear policy in one table«, Absatz zu Mode C · Breite 77

```text
When the renderer has a `pipeline` without `buildOutputNode` that is not a
`RootRenderPipeline` (Mode C), the **internal target** is cleared in full to
transparent black every frame, color and depth, so frame content does not
accumulate. With `clear = true` your own clear applies after that; one that
covers color and depth (`clearColorBuffer` and `clearDepthBuffer` both
`true`) replaces the black clear. A target borrowed from an
`internalTargetPool` is cleared the same way, so nothing of the renderer that
borrowed it before stays in it.
```

**G2** · `packages/twopoint5d/src/stage/README.md:249-259` · Abschnitt »Off-screen rendering: `outputRenderTarget`«, Absatz ab »Without a pipeline, the stages draw« · Breite 80

```text
Without a pipeline, the stages draw into the target linear in the working color
space and without tone mapping, as three.js draws into every `RenderTarget`.
With a pipeline, its output transform applies — tone mapping and the encoding to
`renderer.outputColorSpace`, as long as `pipeline.outputColorTransform` is
`true` — just as on the canvas. A renderer that a parent draws into a target of
the parent's own pipeline writes linear in both cases; the outermost pipeline
applies the transform. Under a Mode C parent (a `pipeline` without
`buildOutputNode` that is not a `RootRenderPipeline`), a child writes linear
into its own `outputRenderTarget` as well: the parent switches to linear output
for all of its stage draws, whichever target they write to.
```

**G3** · `packages/twopoint5d/src/stage/README.md:297-301` · Abschnitt »Mode C«, Absatz ab »The output node is rebuilt only« · Breite 80

```text
The output node is rebuilt only for a new `pipeline` or after
`invalidateOutputNode()`; stages, `renderOrder`, stage names, scenes and cameras
leave it standing. The internal target has the type and the samples of the
renderer (`renderer.getOutputBufferType()`, `renderer.samples`), the values
three.js' `PassNode` gives the pass targets of Mode D.
```

**G4** · `packages/twopoint5d/src/stage/README.md:542-546` · Absatz ab »A `StageRenderer` takes a stage out by itself« (vor `---` und »Events you can subscribe to«) · Breite 78

```text
A `StageRenderer` takes a stage out by itself when the stage announces its
end: an eventized stage (`eventize(this)` from `@spearwolf/eventize`) that
emits `OnStageDispose` (`'dispose'`) in its `dispose()`, as `Stage2D` does.
Take any other stage out of every renderer that holds it — `remove(stage)` —
before you call its `dispose()`. A stage whose `isDisposed` is `true` is
refused by `add()`.
```

**G5** · `packages/twopoint5d/src/stage/README.md:653-657` · »Resource lifecycle«, Punkt zu `Canvas2DStage.dispose()` · Breite 98

```text
- `Canvas2DStage.dispose()` releases the sprite material, the blank texture the material starts
  out with and the texture the stage built last from the canvas — each earlier one was released
  when its successor took its place —, its `StageRenderer` and the `Stage2D` its constructor
  built, and leaves the `WebGPURenderer` and a canvas handed to the constructor alone. The sprite
  geometry is shared by every `THREE.Sprite` of the module and stays.
```

**G6** · `packages/twopoint5d/src/stage/README.md:680-690` · »Common pitfalls«, Punkt »Stage with no camera yet« — mit dem neuen Bezugswort · Breite 80

```text
- **Stage with no camera yet**: `Stage2D#renderTo` is a no-op until the first
  `resize()` with a width and a height that are finite numbers above 0, for
  which the projection's specs give a view with an area, creates the camera (or
  you assign your own). `Stage2D#asPassNode` throws in that state, and a
  `StageRenderer` composing pass nodes draws nothing while it has no area or
  while one of its `Stage2D`s has no camera, and without a stage only its clear.
  Until that first `resize()` the stage's `width` and `height` are 0, and
  assigning another `projection` — or `undefined` — puts them back to 0 until
  the new projection gives a view. The camera the previous projection created
  goes with them; a camera you assigned to `stage.camera` stays, and the new
  projection places it once it gives a view.
```

**H1** · `packages/twopoint5d/CHANGELOG.md:3401-3407` · Migration Guide von `[Unreleased]`, »A `StageRenderer` has one holder«, erster Absatz · Breite 100

```text
`StageRenderer#add()` makes a renderer it adds the child of the renderer it joins, exactly as
`child.parent = root` does: `parent` answers that renderer, and the child gets its `OnAddToParent`.
A renderer has one holder. Adding it to a second renderer takes it out of the first, and attaching
it to a host takes it out of the renderer that held it — a renderer that loses the child hears of it
through `remove()`, with its `OnStageRemoved`. A child that was meant to be driven twice per frame,
by two renderers or by a renderer and the display, is driven once, by the holder it joined last.
```
