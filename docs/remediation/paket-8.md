# Paket 8 — stage: Nachtrag — Warnung und TSDoc zu geteilten Stage-Namen an die Render-Reihenfolge angleichen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 1
- Findings: — (Folgen aus Paket 1, kein Audit-Finding)
- Ziel: Die Warnung zu geteilten Namen und die TSDoc von `IStage#name` beschreiben genau das Verhalten, das `StageRenderer#renderOrder` nach Paket 1 hat.
- Modell: mittlere Stufe (sonnet)
- Effort: low — Code, Tests und alle Texte stehen unten wörtlich
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/IStage.ts`
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/CHANGELOG.md`
- Weg: Die Warnung fällt nur noch für einen Namen, den `renderOrder` ausdrücklich
  listet; Sortierung und Warnung lesen die gelisteten Namen aus einem gemeinsamen
  privaten Helfer `#listedNames()`. Begründung unter »Weg und Begründung«.
- Verify: `pnpm run ci`
- Commit: `fix(stage): warn about stages sharing a name only when renderOrder lists that name`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · Fundstelle `StageRenderer.ts:737-752` (`#warnAboutSharedNames`) unverändert · Fundstelle `IStage.ts:8-11` unverändert · dieselbe Bedingung »while renderOrder is not '*'« zusätzlich in `StageRenderer.ts:153-157` (Setter-TSDoc), `StageRenderer.ts:769-770` (TSDoc `add()`), `stage/README.md:157-162` und `:468-471`, `CHANGELOG.md:129` — alle ins Paket · Folgen aus Paket 2: keine · aus »Offene Befunde« nichts übernommen (keine gleiche Ursache) · Restplan unverändert
  - 2026-09-19 Zug 1: Implementierer beauftragt (sonnet, effort low), Brief `paket-8.impl-1.brief.md`
  - 2026-09-19 Zug 2: Report FERTIG · 5 Dateien (StageRenderer.ts, StageRenderer.spec.ts, IStage.ts, stage/README.md, CHANGELOG.md) · 2 Tests vor dem Fix rot, dritter grün wie geplant · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer (sonnet, low) — beide Folgen behoben, keine Befunde · Diff `paket-8.diff`
  - 2026-09-19 Zug 4: keine Runde nötig
  - 2026-09-19 Zug 5: `pnpm run ci` exit=0 (`paket-8.verify.log`) · Commit 7130201

## Abgleich

Beide Fundstellen aus der `Folgen:`-Zeile von Paket 1, gelesen gegen `HEAD` = `f499ca2`:

1. **`packages/twopoint5d/src/stage/StageRenderer.ts:737-752` — unverändert.**
   `#warnAboutSharedNames(names)` beginnt mit `if (this.#renderOrder === '*') return;`
   und vergleicht damit den Rohstring. Die Sortierung in `orderedStages`
   (`:671-726`) arbeitet mit `renderOrderArray` (`:181-189`: `split(',')`, `trim()`,
   `filter(Boolean)`) und `listed = new Set(renderOrder.filter((name) => name !== '*'))`
   (`:686`). Gerufen wird die Warnung aus dem Setter (`:166`, mit allen Namen) und
   aus `add()` (`:786`, mit dem Namen der neuen Stage).
2. **`packages/twopoint5d/src/stage/IStage.ts:8-11` — unverändert.** »Sort key for
   {@link StageRenderer.renderOrder}. Should be unique within a single
   `StageRenderer`, otherwise `renderOrder` cannot disambiguate.« Das stand schon
   vor dem Lauf so (`git show e352b56:packages/twopoint5d/src/stage/IStage.ts`);
   seit Paket 1 rendern geteilte gelistete Namen gemeinsam in Einfügereihenfolge,
   und eine Umbenennung greift ab dem nächsten Frame — davon sagt der Text nichts.

Dieselbe Warnbedingung »solange `renderOrder` nicht `'*'` ist« hat Paket 1 an vier
weiteren Stellen festgeschrieben; alle vier gehören zur selben Ursache und kommen
ins Paket:

- `StageRenderer.ts:153-157` — TSDoc des `renderOrder`-Setters
- `StageRenderer.ts:769-770` — TSDoc von `add()`
- `packages/twopoint5d/src/stage/README.md:157-162` (Abschnitt »Render order«) und
  `:468-471` (Pitfall »Non-unique stage names + `renderOrder`«)
- `packages/twopoint5d/CHANGELOG.md:129` — Eintrag unter `## [Unreleased]` →
  `### Changed`; unveröffentlicht, darf geändert werden

Der Rohstring-Vergleich stand vor dem Lauf schon in `add()`
(`git show e352b56:…/StageRenderer.ts:690`); Paket 1 hat ihn in den Helfer gezogen
und auf den Setter ausgedehnt. Die Einordnung als Folge von Paket 1 (Zug 0 von
Paket 2) bleibt stehen.

## Weg und Begründung

Welche Namen muss `renderOrder` auseinanderhalten? Genau die, die es ausdrücklich
listet. Eine Stage unter einem ungelisteten Namen landet mit allen anderen
ungelisteten in `rest` hinter `'*'`, in Einfügereihenfolge — ob sie einen Namen
mit einer anderen teilt, ändert daran nichts. Fehlt `'*'` in der Liste, wird sie
gar nicht gezeichnet, und der Warntext (»they render in the order they were
added«) wäre dann schlicht falsch.

Zwei Wege standen offen:

- (a) den Rohstring-Vergleich durch »`renderOrderArray` enthält nur `'*'` oder ist
  leer« ersetzen. Das repariert `'*,*'`, `' * '` und `','`, warnt aber bei
  `renderOrder = 'ui,*'` weiter über zwei Stages namens `bg`, die sich exakt so
  verhalten wie unter `'*'`.
- (b) nur für gelistete Namen warnen. Das schließt (a) ein, und der Warntext
  stimmt dann in jedem Fall, in dem er erscheint.

**Gewählt: (b).** Die Fundstelle im Plan beschreibt den Defekt als Warnung »über
geteilte Namen, die gar nicht unterschieden werden müssen«; (a) behebt davon nur
den Sonderfall der reinen Wildcard-Listen. Die Ursache ist, dass Warnung und
Sortierung `renderOrder` verschieden lesen — darum lesen beide künftig dieselbe
Menge aus `#listedNames()`. Die Warnbedingung ist Diagnose, keine öffentliche
API; die Texte, die sie beschreiben, stammen aus Paket 1 und sind unveröffentlicht.

Der Warntext selbst bleibt wörtlich, wie er ist: mit (b) ist er für jeden Fall
richtig, in dem er fällt.

Kein Browsertest: Was gezeichnet wird, ändert sich nicht. `orderedStages` bekommt
nur den gemeinsamen Helfer, der dieselbe Menge liefert wie die bisherige Zeile
`:686`; die Sortierung bewachen die bestehenden Specs (`respects renderOrder`,
`renders every stage of a listed name, in the order they were added`,
`places a name or wildcard listed twice once`, `sorts a stage renamed after add()
under its new name`, die Blöcke unter
`renderOrder controls the order of pass nodes passed to buildOutputNode`) und der
Browsertest `renders multiple stages in renderOrder additively` in
`packages/twopoint5d-testing/test/stage-renderer.test.js`, der im Gate mitläuft.

## Vorgehen

Alle Zeilennummern gegen `f499ca2`.

### 1. Regressionstests zuerst, rot sehen

In `packages/twopoint5d/src/stage/StageRenderer.spec.ts`, im Block
`describe('add / remove')`, direkt hinter
`it('warns about a shared name when renderOrder is set after the stages')`
(endet Zeile 351) und vor
`it('does NOT warn on duplicate name when renderOrder is default "*"')`, drei
Tests einfügen:

```ts
    it('does not warn about a shared name while renderOrder lists no name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      for (const order of ['*,*', ' * ', ',']) {
        const early = new StageRenderer();
        early.renderOrder = order;
        early.add(fakeStage('a')).add(fakeStage('a'));

        const late = new StageRenderer();
        late.add(fakeStage('a')).add(fakeStage('a'));
        late.renderOrder = order;
      }
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('does not warn about a shared name that renderOrder does not list', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sr = new StageRenderer();
      sr.renderOrder = 'ui,*';
      sr.add(fakeStage('ui')).add(fakeStage('bg')).add(fakeStage('bg'));
      sr.renderOrder = 'ui';
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('warns about a shared name that renderOrder lists between blanks', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sr = new StageRenderer();
      sr.renderOrder = ' a , * ';
      sr.add(fakeStage('a')).add(fakeStage('a'));
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });
```

Dann `pnpm nx test twopoint5d -- src/stage/StageRenderer.spec.ts` laufen lassen.
Erwartet vor dem Fix: die ersten beiden rot (die Warnung fällt), der dritte grün —
er bewacht, dass der Fix gelistete Namen nach dem `trim()` erkennt. Die Ausgabe
des roten Laufs gehört in den Report.

### 2. `packages/twopoint5d/src/stage/StageRenderer.ts`

a) Neuer privater Helfer direkt hinter dem Getter `renderOrderArray` (nach Zeile 189):

```ts
  /** The names `renderOrder` places explicitly: every entry of {@link renderOrderArray} except `'*'`. */
  #listedNames(): Set<string> {
    return new Set(this.renderOrderArray.filter((name) => name !== '*'));
  }
```

b) In `get orderedStages()` Zeile 686
`const listed = new Set(renderOrder.filter((name) => name !== '*'));` ersetzen durch

```ts
    const listed = this.#listedNames();
```

Die lokale Variable `renderOrder` (Zeile 680) wird weiter gebraucht (Zeilen 682
und 709) und bleibt.

c) `#warnAboutSharedNames` (Zeilen 737-752) vollständig ersetzen durch:

```ts
  #warnAboutSharedNames(names: Iterable<string>): void {
    // only a name that renderOrder lists has to be told apart: stages under any other name go
    // with the rest behind '*', or are not drawn at all, whatever they are called
    const listed = this.#listedNames();

    for (const name of new Set(names)) {
      if (!listed.has(name)) continue;
      let count = 0;
      for (const item of this.stages) {
        if (item.stage.name === name) count++;
      }
      if (count > 1) {
        // eslint-disable-next-line no-console
        console.warn(
          `StageRenderer: ${count} stages are named ${JSON.stringify(name)} and renderOrder=${JSON.stringify(this.#renderOrder)} cannot tell them apart; they render in the order they were added. Set unique names on your stages.`,
        );
      }
    }
  }
```

Der Warntext bleibt Zeichen für Zeichen, wie er ist. Die Aufrufe in Setter (`:166`)
und `add()` (`:786`) bleiben unverändert; im Setter ist `#renderOrderArray` zu dem
Zeitpunkt schon zurückgesetzt (`:163`), der Helfer liest also die neue Liste.

d) TSDoc des `renderOrder`-Setters: die Zeilen 153-157

```
   * Stages sharing a listed name render together at that position, in the
   * order they were added; while `renderOrder` is not `'*'`, {@link add} and
   * every write here warn about a shared name. A name or `'*'` listed twice
   * counts at its first position. A stage renamed after `add()` is sorted
   * under its new name from the next frame on.
```

ersetzen durch

```
   * Stages sharing a listed name render together at that position, in the
   * order they were added, and {@link add} and every write here warn about
   * that name; a shared name that is not listed draws no warning. A name or
   * `'*'` listed twice counts at its first position. A stage renamed after
   * `add()` is sorted under its new name from the next frame on.
```

Die Zeilen 149-152 davor bleiben.

e) TSDoc von `add()`: die Zeilen 769-770

```
   * Emits `OnStageAdded`. Warns while `renderOrder` is not `'*'` and another
   * stage already carries the same `name`.
```

ersetzen durch

```
   * Emits `OnStageAdded`. Warns when {@link renderOrder} lists the stage's
   * `name` and another stage already carries it.
```

### 3. `packages/twopoint5d/src/stage/IStage.ts`

Die TSDoc von `name` (Zeilen 8-11) ersetzen durch:

```ts
  /**
   * Sort key for {@link StageRenderer.renderOrder}. Stages sharing a name that
   * `renderOrder` lists render together at its position, in the order they
   * were added, and the `StageRenderer` warns about them; a stage needs a name
   * of its own to get a position of its own. A stage renamed after `add()` is
   * sorted under its new name from the next frame on.
   */
```

### 4. `packages/twopoint5d/src/stage/README.md`

a) Abschnitt »Render order«, der Absatz Zeilen 157-162 (»Stages sharing a listed
name render together … from the next frame on.«) wird zu:

```
Stages sharing a listed name render together at that position, in the order
they were added, and `add()` and every write to `renderOrder` emit a
`console.warn` about that name — give your stages unique names when sorting
matters. A shared name that `renderOrder` does not list draws no warning. A
name or `*` listed twice counts at its first position. A stage renamed after
`add()` is sorted under its new name from the next frame on.
```

b) Pitfall-Liste, der Punkt Zeilen 468-471 wird zu:

```
- **Non-unique stage names + `renderOrder`**: stages sharing a name that
  `renderOrder` lists render at that name's position in the order they were
  added. The renderer warns about such a name on `add()` and on every write
  to `renderOrder`; give your stages unique names when the order between
  them matters.
```

### 5. `packages/twopoint5d/CHANGELOG.md`

Unter `## [Unreleased]` → `### Changed` die bestehende Zeile 129

```
- `StageRenderer` warns about stages sharing a name on every write to `renderOrder` as well as on `add()`, while `renderOrder` is not `'*'`
```

ersetzen durch

```
- `StageRenderer` warns about stages sharing a name only while `renderOrder` lists that name, on `add()` and on every write to `renderOrder`. An order that lists no name — `'*'`, `'*,*'`, `' * '` — never warns
```

Kein neuer Eintrag, kein Migration-Guide-Abschnitt: die Warnbedingung ist keine
öffentliche API. Skill `updating-changelog` gilt für Form und Ort.

### 6. Nicht anfassen

- `StageRenderer.ts:139-142` (TSDoc von `stages` nennt `getOrderedStages()`) und
  `:171-173` (`onRenderOrderChanged()` mit `// ntdh`) — beide vorbestehend, stehen
  in »Offene Befunde« mit `→ Audit`.
- `StageRenderer.ts:596` (`as any` an `getClearColor`) — gehört Paket 5.
- Der Rohstring-Vergleich `this.#renderOrder !== order` im Setter (`:161`): ein
  gleichwertiger String baut den Output-Node einmal neu, das ist kein Defekt.
- Der Warntext.

## Folgen im Volltext

Aus der `Folgen:`-Zeile von Paket 1 im Plan:

**`packages/twopoint5d/src/stage/StageRenderer.ts:738`** — `#warnAboutSharedNames`
prüft den Rohstring gegen `'*'`; ein gleichwertiges `renderOrder` wie `'*,*'` oder
`' * '` warnt fälschlich über geteilte Namen.

**`packages/twopoint5d/src/stage/IStage.ts:9-10`** — TSDoc zu `name` (»Should be
unique …«) verschweigt, dass geteilte Namen jetzt gemeinsam in Einfügereihenfolge
rendern und eine Umbenennung ab dem nächsten Frame greift.

## Triage in Zug 0

- `Folgen:` unter erledigten Paketen: Paket 1 — beide Einträge sind dieses Paket;
  Paket 2 — keine.
- »Offene Befunde« mit gleicher Ursache: keiner. Die beiden Einträge in
  `StageRenderer.ts` (`:141` veraltete Referenz `getOrderedStages()`, vor dem
  Lauf schon vorhanden laut `git show e352b56`; `:172` undokumentierter Hook)
  haben mit der Warnbedingung nichts zu tun und bleiben bei `→ Audit (DOC)`. Die
  übrigen `stage/`-Einträge (Projektionen bei 0-Höhe, `pixelZoom: 0`,
  `Stage2D#updateProjection`) haben eigene Ursachen.

## Restplan

Keine Änderung. Paket 8 bleibt vor Paket 3. Paket 5 berührt in `StageRenderer.ts`
nur `#applyClear` (`as any` an `getClearColor`, heute Zeile 596, im Audit als
`:558` verortet), disjunkt zu diesem Paket; seine Fundstelle gleicht dessen Zug 0 ab.

## Urteil des Reviewers

- Folge `StageRenderer.ts` `#warnAboutSharedNames`: behoben — `#warnAboutSharedNames` und `orderedStages` lesen `#listedNames()`; `'*,*'`, `' * '`, `','` warnen nicht, `' a , * '` warnt.
- Folge `IStage.ts:8-13` TSDoc `name`: behoben — nennt gemeinsames Rendern an der Listenposition, die Warnung und die Umbenennung ab dem nächsten Frame.
- Qualität: keine Befunde (kritisch/wichtig/klein: 0).

## Nebenbefunde

- `StageRenderer.ts:690` — `renderOrder[0] === ''` in `orderedStages` ist toter Code. Kein Korrektheitsdefekt, daher `→ Audit (CONS)`.
