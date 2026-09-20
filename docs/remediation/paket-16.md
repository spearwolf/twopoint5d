# Paket 16 — Nachzug: den Rollback von `StageRenderer#resize()` zu Ende führen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 15
- Findings: keine — zwei Symptome aus der `Folgen:`-Zeile von Paket 15,
  beide unten im Volltext
- Ziel: Scheitert eine Stage an der Größenschranke, trägt hinterher keine
  andere Stage eine Größe, die der Renderer selbst nicht mehr führt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/stage/StageRenderer.ts`,
  `packages/twopoint5d/src/stage/StageRenderer.spec.ts`,
  `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(stage): reach every stage that still owes the size the renderer carries, and count only stages as refusing it`

## Vorgehen

Reihenfolge ist bindend: erst die beiden Tests, rot sehen, dann der Code, dann
Doku und CHANGELOG. Beide Symptome sind Korrektheitsfehler, beide bekommen
ihren Regressionstest **vor** dem Fix, und der rote Lauf gehört in den Report.

### 1. Regressionstest zum Rollback (rot vor dem Fix)

In `packages/twopoint5d/src/stage/StageRenderer.spec.ts`, im Block
`describe('add / remove', …)`, unmittelbar hinter dem bestehenden Test
`'asks every stage for its size even when one of them refuses'` (derzeit
Zeile 426–440):

```ts
    it('asks a stage for the size the renderer fell back to', () => {
      const sr = new StageRenderer();
      const stage1 = fakeStage('a');
      const stage2 = fakeStage('b');
      stage2.resize.mockImplementation(() => {
        throw new Error('stage refused the size');
      });
      sr.add(stage1).add(stage2);

      expect(() => sr.resize(320, 240)).toThrow('stage refused the size');
      expect(stage1.resize, 'the first stage took the size').toHaveBeenLastCalledWith(320, 240);

      sr.resize(0, 0);

      expect(stage1.resize, 'and gives it up for the size the renderer carries').toHaveBeenLastCalledWith(0, 0);
      expect(sr.width).toBe(0);
      expect(sr.height).toBe(0);
    });
```

Rot ist er heute daran, dass `sr.resize(0, 0)` an der Größenschranke umkehrt:
`stage1.resize` wurde zuletzt mit `320, 240` gerufen. `stage2` wird in diesem
zweiten Aufruf nicht gefragt, weil ihr `StageItem` nie über `0×0` hinauskam —
der Test wirft dort also nicht.

### 2. Regressionstest zur Zählweise (rot vor dem Fix)

Im Block `describe('pipeline without buildOutputNode (§6.4 Mode C)', …)`,
hinter `'a fractional css size reaches the internal target as whole device
pixels'` (derzeit Zeile 687–702). Der Block hat `renderer` aus seinem
`beforeEach` und die lokale Fabrik `makePipelineMock()`; das interne
`RenderTarget` wird über `renderer.__renderTarget` während des Stage-Renderings
eingefangen, wie im Test `'the internal target keeps its device-pixel size when
resize() moves it'`:

```ts
    it('counts only the stages that refused the size, not the render target', () => {
      const sr = new StageRenderer();
      sr.resize(100, 50);
      const stage1 = fakeStage('a');
      const stage2 = fakeStage('b');
      sr.add(stage1).add(stage2);
      sr.pipeline = makePipelineMock() as any;

      let rt: any;
      stage1.renderTo.mockImplementation(() => {
        rt = renderer.__renderTarget;
      });
      sr.renderTo(renderer as any);

      rt.setSize = () => {
        throw new Error('the render target refused the size');
      };
      stage2.resize.mockImplementation(() => {
        throw new Error('stage refused the size');
      });

      let caught: unknown;
      try {
        sr.resize(300, 150);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).errors).toHaveLength(2);
      expect((caught as Error).message).toBe(
        'StageRenderer#resize(): the render target and 1 of 2 stages refused the size 300x150',
      );
    });
```

Rot ist er heute an der Meldung: sie lautet `StageRenderer#resize(): 2 of 2
stages refused the size 300x150`, weil der Fehler des Render-Targets als
abweisende Stage mitgezählt wird.

### 3. Die Größenschranke an die `StageItem`s binden

`packages/twopoint5d/src/stage/StageRenderer.ts:296` — die Schranke fragt heute
nur die eigenen Felder. Die `StageItem`s führen Buch darüber, welche Stage
welche Größe genommen hat; solange eines davon die Größe schuldet, mit der der
Renderer antwortet, hat der Aufruf Arbeit:

```ts
    // the stage items are the record of which size each stage carries: while one of them still
    // owes the size this renderer answers with, the call has work to do — a stage that took a
    // size the renderer gave up again is reached by no other call
    if (
      this.width === width &&
      this.height === height &&
      this.stages.every((item) => item.width === width && item.height === height)
    ) {
      return;
    }
```

Was dabei ausdrücklich **nicht** angefasst wird: der Rollback selbst. Eine
Stage, die die Größe genommen hat, behält sie samt Item — das ist die Zusage
aus Paket 15, sie steht in TSDoc und CHANGELOG und wird hier nur um den Weg
zurück ergänzt, nicht umgedreht. Kein Umbau auf eine echte Transaktion.

Zwei Nebenwirkungen, beide erwünscht und beide kein Widerspruch zu
Bestehendem:

- Das interne Render-Target bleibt außen vor. Es leitet seine Größe in
  `#renderTargetSize()` aus `width`/`height` ab und wird in jedem Frame über
  `#ensureRT()` nachgezogen; eine Größe, die ein Rollback dort stehen lässt,
  hält bis zum nächsten `renderTo()` und ist nicht der Fall, den dieses Paket
  behebt.
- `add()` ruft `resizeStage(si, this.width, this.height)`. Wirft die Stage
  dabei, bleibt ihr Item auf `0×0`, während der Renderer eine Größe führt — ein
  späterer `resize()` mit genau dieser Größe erreicht sie jetzt ebenfalls. Der
  Pfad ist vorbestehend (`e7a112b3^:815`) und braucht keinen eigenen Test.

Die Zusage aus Paket 13 für `Canvas2DStage#setContainerSize()` bleibt
unberührt: ein direktes `stage.resize(…)` von außen bewegt kein `StageItem`,
also kehrt ein Aufruf mit der Größe, die der Renderer trägt, weiterhin an der
Schranke um.

### 4. Die abweisende Render-Target-Seite aus der Zählung nehmen

Dieselbe Methode, `:304-335`. Zwei benannte Sammlungen statt einer, damit die
Trennung im Code steht und nicht in einem Flag:

```ts
    const refusedByRenderTarget: unknown[] = [];

    try {
      if (this.#internalRT) this.#resizeRenderTarget(this.#internalRT);
      if (this.#asPassNodeRT) this.#resizeRenderTarget(this.#asPassNodeRT);
    } catch (error) {
      refusedByRenderTarget.push(error);
    }

    // a stage that refuses the size does not keep the others from theirs: each one is asked,
    // and what they threw comes out together once every stage has had the call
    const refusedByStages: unknown[] = [];

    for (const stage of this.stages) {
      try {
        this.resizeStage(stage, width, height);
      } catch (error) {
        refusedByStages.push(error);
      }
    }

    const refused = [...refusedByRenderTarget, ...refusedByStages];

    if (refused.length > 0) {
      // while a stage refuses the size, this renderer keeps the one it carried into the call, so
      // the very same call goes through again as soon as that stage fits — written through, it
      // would fall out of the size guard above and never reach the stage a second time
      this.width = prevWidth;
      this.height = prevHeight;

      if (refused.length === 1) throw refused[0];

      // the render target is none of the stages: it joins the error without moving their count
      const stagesRefused = `${refusedByStages.length} of ${this.stages.length} stages refused the size ${width}x${height}`;

      throw new AggregateError(
        refused,
        refusedByRenderTarget.length > 0
          ? `StageRenderer#resize(): the render target and ${stagesRefused}`
          : `StageRenderer#resize(): ${stagesRefused}`,
      );
    }
```

Die Reihenfolge im `AggregateError` bleibt die des Ablaufs: Render-Target
zuerst, dann die Stages in Listenreihenfolge. Ein einzelner Fehler kommt
unverändert heraus, gleich aus welcher der beiden Quellen — auch das bleibt.

### 5. TSDoc von `resize()` nachziehen

`StageRenderer.ts:285-294`. Beide neuen Zusagen gehören hinein, formuliert als
Zustand und ohne Rückblick auf den Vorzustand:

```ts
  /**
   * Hands the size to every stage of this renderer. A stage that refuses it does not keep the
   * others from theirs: each one is asked, and what they threw comes out together once every
   * stage has had the call — a single error unchanged, several of them as an `AggregateError`
   * whose message counts the stages that refused; a render target that refuses the size joins
   * that error without counting as one of them.
   *
   * While a stage refuses the size, this renderer answers with the size it carried before the
   * call, and the {@link StageItem} of that stage keeps the size it carried — a stage that took
   * the new size keeps it, item and all. The very same call therefore goes through again as soon
   * as the refusing stage fits, and reaches exactly the stages that do not have the size yet. A
   * call is carried out as long as one stage still owes the size this renderer answers with, so
   * the size this renderer fell back to reaches the stages that moved past it.
   */
```

### 6. CHANGELOG

`packages/twopoint5d/CHANGELOG.md:261`, in `## [Unreleased]` → `### Fixed`. Die
bestehende Zeile wird ersetzt, keine zweite daneben gestellt — sie beschreibt
dasselbe `resize()` und darf die Zählweise nicht weiter behaupten:

```markdown
- fix `StageRenderer#resize()` for a stage that refuses the size: `width` and `height` of the renderer stay the way the call found them, and so does the size of the stage item of every stage that refused — a stage that took the size keeps it, item and all. Each of the other stages is asked for the size all the same. A call is carried out as long as one stage item still owes the size the renderer answers with, so the size the renderer fell back to reaches the stages that moved past it, and the very same call goes through again as soon as the refusing stage takes the size, reaching exactly the stages that still owe it. Several stages refusing at once come out as one `AggregateError` naming how many of them it was, and a render target that refuses the size joins that error without counting as a stage; a single error comes out unchanged, so a `TypeError` of a projection reaches the caller as a `TypeError`
```

Kein Eintrag im `### Migration Guide`: `resize()` behält Signatur und
Rückgabewert, und der Unterschied zeigt sich allein in einem Zustand, in den
kein Aufrufer ohne eine werfende Stage gerät. Wer heute sauber durchläuft,
merkt nichts.

## Für die `Schnittstellen:`-Zeile im Plan (Zug 5)

`StageRenderer#resize(width, height)` führt den Aufruf aus, solange ein
`StageItem` eine andere Größe trägt als der Renderer — ein Aufruf mit der
Größe, die der Renderer gerade führt, erreicht also die Stages, die sie noch
schulden, und kann dabei werfen. Die Meldung des `AggregateError` zählt
ausschließlich Stages; ein abweisendes Render-Target steht in `errors`, nicht
in der Zahl, und wird in der Meldung eigens genannt.

## Folgen im Volltext

Beide aus der `Folgen:`-Zeile von Paket 15, Hash `6073b0a2`:

**Symptom 1 · `packages/twopoint5d/src/stage/StageRenderer.ts:296`** — die
Größenschranke von `resize()` kann eine Stage auf einer Größe stehen lassen,
die der Renderer nach einem Rollback nicht mehr führt: weist Stage 2 `320x240`
ab, fällt der Renderer auf `0x0` zurück, Stage 1 bleibt auf `320x240`, und ein
folgendes `resize(0, 0)` kehrt am Guard um.

**Symptom 2 · `packages/twopoint5d/src/stage/StageRenderer.ts:333`** — die
`AggregateError`-Meldung zählt einen Fehler aus dem Render-Target-`try`
(`:305-310`) als abweisende Stage mit, `CHANGELOG.md:261` übernimmt die
Zählweise.

## Abgleich (Zug 0, 2026-09-20)

- Symptom 1: unverändert. `StageRenderer.ts:296` ist
  `if (this.width === width && this.height === height) return;`, der Rollback
  steht in `:327-328`, `resizeStage()` in `:338-345` schreibt `stageItem.width`
  erst nach `stage.resize()`. Die Reihenfolge aus der Folgenbeschreibung fährt
  heute genau so.
- Symptom 2: unverändert. `:306-311` sammelt den Render-Target-Fehler in
  dasselbe `refused` wie die Stage-Schleife `:313-321`, `:333` formatiert
  `${refused.length} of ${this.stages.length} stages`. `CHANGELOG.md:261`
  liegt in `## [Unreleased]` → `### Fixed` und ist damit änderbar.
- Offene Befunde: nichts aufgenommen. Alle Einträge der Queue sind beschlossen
  (`[x]`); die drei mit `→ Audit (dritte Drain-Runde)` liegen beim Abschluss,
  und keiner von ihnen teilt die Ursache dieses Pakets — sie betreffen die
  Lookbook-Demos und fehlende Rückgabetypen in `Canvas2DStage`.
- Unverteilte `Folgen:`-Zeilen: keine. Paket 1 vermerkt »Nichts offen«,
  Paket 7 und 8 gingen in Paket 10, Paket 11 in Paket 14, Paket 15 in dieses.
- Kein neuer Nebenbefund. Der `add()`-Pfad (`:857`) sah aus wie einer, ist aber
  vorbestehend und wird von Schritt 3 mit geheilt; er steht dort als Notiz.
- Generation: zweite. Paket 15 trägt kein `Folge von:`, die Kette endet hier.
- Restplan: unverändert. Paket 16 ist das einzige offene Paket, danach fährt
  der Abschluss; es gibt weder eine Reihenfolge noch einen Schnitt, den der
  Abgleich bewegt.

## Verlauf

- 2026-09-20 Zug 0: Detailplan steht · beide Symptome unverändert an
  `StageRenderer.ts:296` und `:333` · kein Eintrag aus »Offene Befunde«
  aufgenommen, keine Folge verteilt, kein Paket geschnitten · Restplan
  unverändert
- 2026-09-20 Zug 1: Implementierer beauftragt · `claude -p --model sonnet
  --effort medium --name remediate-twopoint5d-p16-impl-1` · Brief in
  `paket-16.impl-1.brief.txt`, Report nach `paket-16.impl-1.json`
- 2026-09-20 Zug 2: Report `FERTIG`, Report in `paket-16.impl-1.json`
  (session `111bb067-b728-4113-82ee-0539daf35d2d`) · geändert
  `packages/twopoint5d/src/stage/StageRenderer.ts`,
  `packages/twopoint5d/src/stage/StageRenderer.spec.ts`,
  `packages/twopoint5d/CHANGELOG.md`, Arbeitsbaum damit schmutzig · beide
  roten Läufe im Report · eigener Verify-Lauf `pnpm run ci`
  `paket-16.verify.log` exit=0
- 2026-09-20 Zug 3: Reviewer (sonnet, effort medium) in
  `paket-16.review-1.json` · beide Symptome behoben, kein `kritisch`, kein
  `wichtig`, sechs `klein` · Diff `paket-16.diff`
- 2026-09-20 Zug 4: entfällt — kein Befund, der eine Runde auslöst
- 2026-09-20 Zug 5: committet als `5a0ae0e4`, Verify aus Zug 2 getragen (seit
  dem Lauf keine Codeänderung) · Arbeitsbaum bis auf die Lauf-Dateien sauber

## Urteil des Reviewers (Zug 3)

- **Symptom 1 · Größenschranke: behoben** — `StageRenderer.ts:303-310`. Die
  Schranke kehrt nur noch um, wenn `width`/`height` passen und jedes
  `StageItem` (`this.stages.every(…)`, `:306`) dieselbe Größe trägt. Im
  Szenario des Pakets passiert `resize(0, 0)` die Schranke, Stage 1 wird mit
  `(0, 0)` gefragt, Stage 2 nicht — ihr Item steht auf `0×0`. Der Rollback
  selbst ist unangetastet.
- **Symptom 2 · Zählweise: behoben** — `StageRenderer.ts:320-357`. Getrennte
  Sammlungen `refusedByRenderTarget` und `refusedByStages`; die Zahl in der
  Meldung kommt allein aus `refusedByStages.length` (`:350`), das
  Render-Target wird eigens genannt (`:353-356`). Reihenfolge in `errors` und
  der unveränderte Einzelfehler (`:347`) bleiben.
- **Regressionstests tragen.** `'asks a stage for the size the renderer fell
  back to'` (`StageRenderer.spec.ts:444-461`) und `'counts only the stages
  that refused the size, not the render target'` (`:715-746`) hängen beide am
  Kern, nicht an einer Nebensache. `#resizeRenderTarget` ruft `setSize` nur
  bei abweichender Größe (`:655-659`) — `100×50` gegen `300×150` weicht ab,
  der Zweig wird also wirklich erreicht.
- **Konventionen ohne Verstoß**, kein Aufrufer mit alter Signatur;
  `resize()` hat außerhalb der Spec einen einzigen, `Canvas2DStage.ts:155`,
  und dessen Signatur ist unverändert. `src/stage/README.md` und
  `docs/architecture.md` sagen zur Schranke nichts.

## Kleine Befunde (Zug 3, keine Runde ausgelöst)

- `CHANGELOG.md:255`, der `Canvas2DStage#setContainerSize()`-Eintrag aus
  Paket 13: »The size the renderer already carries is what decides whether
  anything moves« greift jetzt zu weit — es entscheiden `width`/`height`
  **und** die Größen der `StageItem`s. Die Zusage, um die es dem Eintrag geht,
  bleibt wahr: ein direktes `stage.resize(…)` bewegt kein `StageItem`, also
  kehrt der Aufruf mit der Renderer-Größe weiterhin um. Nur nach einem
  Rollback oder einem gescheiterten `add()` erreicht er die Stages. Der
  Detailplan hat die Zeile ausdrücklich ausgenommen, der Reviewer stuft sie
  als `klein` ein — sie bleibt darum stehen und geht als unverteilte Folge in
  den Plan, damit der Abschluss sie mit allen Befunden vor Augen entscheidet.
- `StageRenderer.spec.ts:459-460`: Die Assertions auf `sr.width`/`sr.height`
  gleich `0` gelten mit und ohne Fix. Ein
  `expect(stage2.resize).toHaveBeenCalledTimes(1)` wäre der schärfere Beleg,
  dass eine Stage ohne Schuld nicht erneut gefragt wird.
- `StageRenderer.spec.ts:744-745`: Der Test prüft nicht, dass das
  Render-Target in `errors` an erster Stelle steht. Ein
  `expect(errors[0]).toHaveProperty('message', …)` schlösse die
  Reihenfolge-Zusage mit ein.
- Für die Zusage aus Paket 13 — direktes `stage.resize()` von außen, danach
  `sr.resize()` mit der Renderer-Größe kehrt um — findet sich in den Specs
  kein Test. Ohne ihn bliebe eine spätere Lockerung der Schranke auf »immer
  `resizeStage` rufen« grün.
- Die Browser-Testfläche (`packages/twopoint5d-testing/test/`) braucht hier
  nichts: die Änderung ist Größenbuchführung und Fehlerzählung, kein
  Rendering- und kein GPU-Buffer-Code.
- Die Commit-Message stand nicht im Diff; die Zeile aus diesem Detailplan ist
  Conventional Commits, englisch und ohne Finding-ID.

## Nebenbefund und sein Urteil

`packages/twopoint5d/src/stage/StageRenderer.ts:880` — `add()` ruft
`resizeStage(si, this.width, this.height)` vor `emit(this, OnStageAdded, …)`.
Weist die Stage ab, steht sie in `stages`, das Ereignis bleibt aus, und der
Aufrufer bekommt einen Fehler statt `this`. Vorbestehend: der Pfad steht so
schon vor dem ersten Commit dieses Laufs (`e7a112b3^`), Schritt 3 dieses Pakets
hat ihn nur insofern berührt, als ein späterer `resize()` mit der
Renderer-Größe die halb hinzugefügte Stage jetzt erreicht — der fehlende
`OnStageAdded` und die Stage in der Liste bleiben davon unberührt.

Urteil `→ Scope (low)` an der Scope-Regel im Plan-Kopf: sie nimmt alles auf,
was im Lauf auffällt, ohne Ausnahme für Severity oder Kategorie. Die Ursache —
ein `add()`, das seine Zustandsschreibung nicht zurücknimmt — teilt dieses
Paket nicht; hier ging es um die Schranke von `resize()` und die Zählweise
einer Meldung. Der Eintrag steht deshalb in »Offene Befunde« und wird von der
Drain-Runde des Abschlusses geschnitten, nicht von mir.
