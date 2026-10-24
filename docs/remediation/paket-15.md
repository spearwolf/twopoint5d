# Paket 15 — Canvas2DStage: eigene Größenprüfung in setContainerSize()

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 5
- Findings: — (Folge, kein Audit-Finding; low)
- Ziel: `Canvas2DStage#setContainerSize()` weist eine Breite oder Höhe, die keine
  endliche Zahl ist, mit einem `RangeError` ab, der den Aufruf des Nutzers nennt
  (`Canvas2DStage#setContainerSize(): width must be a finite number, got NaN`),
  bevor sie an `StageRenderer#resize()` geht — auch nach `dispose()`, wie
  `setCanvasSize()` und `StageRenderer#resize()`; 0 und negative Werte bleiben
  zulässig wie bei `StageRenderer#resize()`.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/src/stage/Canvas2DStage.ts`,
  `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts`,
  `packages/twopoint5d/CHANGELOG.md`
- Vorgehen:
  1. **Regressionstest zuerst, rot sehen.** In
     `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts`, im
     `describe('sizes', …)` (heute Z. 298–322), hinter den Test
     `setCanvasSize() refuses a width that is not a finite number above 0, also after dispose()`
     zwei Tests anlegen. Die Datei hat schon `sandbox` (sinon, `afterEach`
     mit `sandbox.restore()`) und `makeStage()`; nichts Neues importieren.

     ```ts
     test('setContainerSize() refuses a width or a height that is no finite number in its own name, also after dispose()', () => {
       const stage = makeStage();
       stage.setContainerSize(320, 240);
       const resize = sandbox.spy(stage.stageRenderer, 'resize');

       expect(() => stage.setContainerSize(NaN, 240)).toThrow(
         new RangeError('Canvas2DStage#setContainerSize(): width must be a finite number, got NaN'),
       );
       expect(() => stage.setContainerSize(320, Infinity)).toThrow(
         new RangeError('Canvas2DStage#setContainerSize(): height must be a finite number, got Infinity'),
       );
       expect(resize.called, 'the size does not reach the stage renderer').toBe(false);
       expect([stage.stageRenderer.width, stage.stageRenderer.height], 'the renderer keeps its size').toEqual([320, 240]);

       stage.dispose();

       expect(() => stage.setContainerSize(NaN, 240)).toThrow(
         new RangeError('Canvas2DStage#setContainerSize(): width must be a finite number, got NaN'),
       );
     });

     test('setContainerSize() hands a size of 0 and a negative one on to the stage renderer as they are', () => {
       const stage = makeStage();
       const resize = sandbox.stub(stage.stageRenderer, 'resize');

       stage.setContainerSize(0, 0);
       stage.setContainerSize(-320, 240);

       expect(resize.args).toEqual([
         [0, 0],
         [-320, 240],
       ]);
     });
     ```

     `pnpm nx test twopoint5d -- src/stage/Canvas2DStage.spec.ts` laufen
     lassen, **bevor** `Canvas2DStage.ts` angefasst wird: der erste Test muss
     rot sein — vor dem Fix kommt der `RangeError` mit dem Subjekt
     `StageRenderer#resize()`, und nach `dispose()` wirft der Aufruf gar
     nicht. Der zweite ist schon vor dem Fix grün (Charakterisierung: er hält
     fest, dass die neue Prüfung 0 und negative Werte nicht abweist). Die
     Ausgabe des roten Laufs gehört in den Report.
  2. **`setContainerSize()` prüft selbst.** In
     `packages/twopoint5d/src/stage/Canvas2DStage.ts` (heute Z. 199–206) die
     Methode so umbauen — die Prüfung steht **vor** dem `#disposed`-Guard,
     wie bei `setCanvasSize()` (Z. 208–214):

     ```ts
     /**
      * Hands the size of the area the stage is drawn into — the size a `Display` reports with
      * `OnDisplayResize`, for one — to {@link stageRenderer}, which hands it on to {@link stage}:
      * the stage takes its camera from it, and before the first call nothing is drawn.
      *
      * Width and height must be finite numbers: `NaN` and an infinite value are refused with a
      * `RangeError` that names this call, before the size reaches the renderer — on a disposed
      * stage as well. A width or a height of 0 or below goes on to `StageRenderer#resize()` as it is.
      */
     setContainerSize(width: number, height: number): void {
       // checked here although StageRenderer#resize() checks the same: the refusal names the call
       // the caller made, and a disposed stage, which hands nothing on, refuses it all the same
       assertFinite(width, 'Canvas2DStage#setContainerSize()', 'width');
       assertFinite(height, 'Canvas2DStage#setContainerSize()', 'height');

       if (this.#disposed) return;

       // the renderer hands the size on to every stage it holds, this one included: its own
       // width and height then answer the container, and a render target built behind a pipeline
       // set on it gets that size instead of the 1×1 minimum
       this.stageRenderer.resize(width, height);
     }
     ```

     Import ergänzen, alphabetisch vor dem bestehenden
     `import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';`
     (Z. 7): `import {assertFinite} from '../utils/assertFinite.js';`.
     `assertPositiveFinite()` ist hier falsch — es wiese 0 ab, und
     `StageRenderer#resize()` nimmt 0 und negative Werte (Entscheidung von
     Paket 5, steht in dessen `Schnittstellen:`-Zeile im Plan).
  3. **TSDoc von `dispose()` nachziehen.** In `Canvas2DStage.ts` heute
     Z. 316–318 steht:

     ```
      * Afterwards `isDisposed` is `true`, `texture` answers `undefined`, and `render()`,
      * `setCanvasSize()`, `setContainerSize()`, a write to `fit` and a further `dispose()` do nothing;
      * `setCanvasSize()` still refuses a size that is no finite number above 0.
     ```

     Den letzten Satz ersetzen durch:
     `` `setCanvasSize()` still refuses a size that is no finite number above 0, and `setContainerSize()` one that is no finite number. ``
     — Umbruch an der Breite des Blocks (die Nachbarzeilen gehen bis etwa
     Spalte 100), kein Wort sonst geändert.
  4. **CHANGELOG.** `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` →
     `### Fixed`, der Eintrag heute Z. 161:

     ```
     - `new Canvas2DStage(renderer, width, height)` and `setCanvasSize()` refuse a width or a height that is no finite number above 0 with a `RangeError` that names the call, before anything is built or written; `setCanvasSize()` refuses it on a disposed stage as well
     ```

     um einen Satz verlängern (kein neuer Eintrag, keine Migration-Guide-
     Notiz — ein Aufrufer mit gültigen Zahlen merkt nichts):

     ```
     - `new Canvas2DStage(renderer, width, height)` and `setCanvasSize()` refuse a width or a height that is no finite number above 0 with a `RangeError` that names the call, before anything is built or written; `setCanvasSize()` refuses it on a disposed stage as well. `setContainerSize()` refuses a width or a height that is `NaN` or infinite with a `RangeError` that names it, before the size reaches `stageRenderer`, also on a disposed stage; 0 and negative values go on to `StageRenderer#resize()` as they are
     ```

     Skill `updating-changelog` laden; die Zeile bleibt eine Zeile wie ihre
     Nachbarn (der Abschnitt bricht Einträge nicht um).
  5. Nichts sonst. `README.md` unter `src/stage/` und
     `docs/resource-lifecycle.md` nennen die Größenprüfungen von
     `Canvas2DStage` nicht — dort ist nichts nachzuziehen. Der Test
     `behaves as documented after dispose()` (heute Z. 437–460) ruft
     `setContainerSize(320, 240)` nach `dispose()` und erwartet keinen Wurf:
     bleibt so und muss grün bleiben.
  6. Vor dem Gate formatieren, nur die beiden Quelldateien:
     `pnpm exec biome check --write packages/twopoint5d/src/stage/Canvas2DStage.ts packages/twopoint5d/src/stage/Canvas2DStage.spec.ts`
     (Zeilenbreite 130 aus `biome.jsonc`; `pnpm lint` im Gate prüft nur).
- Verify: `pnpm run ci` (Gate); zur Fehlersuche vorab
  `pnpm nx test twopoint5d -- src/stage/Canvas2DStage.spec.ts`
- Commit: `fix(twopoint5d): let Canvas2DStage#setContainerSize() refuse a width or a height that is no finite number in its own name, on a disposed stage as well`
- Verlauf:
  - 2026-10-23 Zug 0: Detailplan steht · Folge aus Paket 5 unverändert an
    `Canvas2DStage.ts:199–206` (kein eigener Check, `StageRenderer#resize()`
    wirft mit seinem Subjekt `StageRenderer#resize()`, nach `dispose()` gar
    nichts) · keine weitere Fundstelle derselben Ursache: einziger anderer
    Aufrufer von `StageRenderer#resize()` in `src/` ist die Host-Weitergabe
    `StageRenderer.ts:395` · offene Folge aus Paket 6 (`docs/text.md`
    »Refusals«) als Symptom von Paket 6 → Nachtragspaket 16 · aus »Offene
    Befunde« nichts übernommen
  - 2026-10-23 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-15.impl-0.json`
  - 2026-10-23 Zug 2: FERTIG · geändert `Canvas2DStage.ts`, `Canvas2DStage.spec.ts`, `CHANGELOG.md` · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-15.verify.log`)
  - 2026-10-23 Zug 3: Reviewer (sonnet, low) — Ziel erfüllt, keine kritischen/wichtigen Befunde, drei kleine · Diff `paket-15.diff`, Report `paket-15.review-0.json`
  - 2026-10-23 Zug 4: keine Runde nötig
  - 2026-10-23 Zug 5: Commit 8c92bbbf, Gate `pnpm run ci` exit=0

## Urteil des Reviewers

- Folge aus Paket 5: behoben — `Canvas2DStage.ts` `setContainerSize()` prüft mit `assertFinite(…, 'Canvas2DStage#setContainerSize()', …)` vor dem `#disposed`-Guard; Tests im `describe('sizes')` in `Canvas2DStage.spec.ts`.
- klein: Die `dispose()`-TSDoc zählt `setContainerSize()` noch unter »do nothing« auf, der Folgesatz schränkt ein (Wortlaut war vorgegeben).
- klein: Der Disposed-Zweig im Test prüft nur die Breite, nicht die Höhe.
- klein: Commit-Message war nicht im Diff; die aus der Paketdatei entspricht den Konventionen.

## Abgleich

- **Folge aus Paket 5** — unverändert. `packages/twopoint5d/src/stage/Canvas2DStage.ts:199–206`:
  `setContainerSize()` prüft nichts, steigt nach `dispose()` per
  `if (this.#disposed) return;` aus und reicht sonst an
  `this.stageRenderer.resize(width, height)` weiter.
  `StageRenderer#resize()` (`StageRenderer.ts:463–465`) prüft mit
  `assertFinite(…, 'StageRenderer#resize()', …)`: `setContainerSize(NaN, 1)`
  wirft also `StageRenderer#resize(): width must be a finite number, got NaN`
  — gegen die Fehlermeldungsregel in `AGENTS.md` (Subjekt ist der Aufruf des
  Nutzers). Auf einem disposten Stage wirft derselbe Aufruf nichts, während
  `setCanvasSize()` und `StageRenderer#resize()` dort abweisen.
- Weitere Fundstellen derselben Ursache: `grep '\.resize(' src` außerhalb der
  Specs trifft `StageRenderer.ts:395` (Host-Weitergabe, Größen des Displays,
  keine Eingabe des Nutzers), `StageRenderer.ts:487` und `:540` (intern
  hinter der Prüfung), `Display.ts:948` (eigene Methode ohne Argumente) und
  `Canvas2DStage.ts:205`. Nur die letzte gehört hierher.
- Doku: `src/stage/README.md` (Tabelle Z. 49, Ereignisse Z. 621–629,
  Lebenszyklus Z. 733–738) und `docs/resource-lifecycle.md` Z. 99–101 sagen
  über die Größenprüfung nichts; einzige Doku-Stellen sind die TSDoc von
  `dispose()` (Z. 316–318) und der CHANGELOG-Eintrag Z. 161 unter
  `[Unreleased]` → `### Fixed`.

## Triage der offenen Folgen und Befunde

- **Folge aus Paket 6** (`packages/twopoint5d/docs/text.md:53–58`,
  »Refusals«): Symptom von Paket 6. Paket 6 hat `BitmapFont` die Zahlen mit
  `RangeError` abweisen lassen und den Guide nicht nachgezogen (Konvention
  »Geänderte Verträge in Guides nachziehen«); die anderen Guides nennen ihre
  Fehlerklassen (`docs/sprites.md` z. B. Z. 179, 1805, 2632), `text.md` nennt
  keine. Prüffrage erfüllt: hätte Paket 6 seine Ursache zu Ende behoben, gäbe
  es den Eintrag nicht. Paket 6 ist committet → ein Nachtragspaket
  (**Paket 16**, `Folge von: Paket 6`), nicht in Paket 11 wie im Vorschlag:
  Paket 11 ist nicht das verursachende Paket, und seine Findings (SEC-001,
  BUG-023, BUG-024 in `src/text/`) ändern an den Fehlerklassen nichts — der
  Absatz läge dort als fremde Aufgabe. Einzige Fundstelle: `text.md`; die
  TSDoc (`BitmapFont.ts:129–132` und `:170–176`) und der CHANGELOG
  (Z. 115) nennen `RangeError` schon, die Proposals dürfen nachhinken.
- **»Offene Befunde«**: zwei Einträge in derselben Datei —
  `Canvas2DStage.ts:35` (Setter `fit` ungeprüft) und `render()`
  (`OnCanvas2DStageResize` über `emit()`, `#lastWidth`/`#lastHeight` erst
  danach geschrieben). Beide nicht übernommen: andere Ursache. Dieses Paket
  schließt die Lücke, die Paket 5 bei der Größenprüfung gelassen hat; der
  `fit`-Wert ist keine Größe und war vor dem Lauf schon so, die Reihenfolge in
  `render()` ist eine Frage der Ereigniszustellung. Gleiche Datei ist kein
  Grund — die Drain-Runde schneidet sie mit allen Befunden vor Augen. Die
  übrigen drei Einträge (`docs/architecture.md`, `TextureStore.ts`,
  `describeValue.ts`) berühren dieses Paket nicht.
- **Restplan**: Paket 16 hinter Paket 15 eingefügt, sonst unverändert. Kein
  offenes Paket berührt `src/stage/`; Paket 13 (TSDoc der öffentlichen
  Oberfläche) läuft nach 15 und 16 und findet die neue TSDoc von
  `setContainerSize()` schon vor.

## Folge im Volltext

Aus Paket 5, `Folgen:`-Zeile im Plan:

> `packages/twopoint5d/src/stage/Canvas2DStage.ts:205` — `setContainerSize(NaN, …)`
> wirft jetzt den `RangeError` von `StageRenderer#resize()`, die Meldung nennt also
> nicht den Aufruf des Nutzers (Fehlermeldungsregel in AGENTS.md); eigene Prüfung
> `assertFinite(…, 'Canvas2DStage#setContainerSize()', …)` vor der Weitergabe · low

Die Fehlermeldungsregel aus `AGENTS.md`: Meldungen beginnen mit ihrem Subjekt —
der Klasse oder dem Aufruf (`Canvas2DStage#setContainerSize()`); eine
Zahlenprüfung geht über `assertFinite()` oder `assertPositiveFinite()` in
`src/utils/`, die `Subject: name must be a finite number …, got …` schreiben.
