# Paket 6 — StageDirector: Dispose, Eingaben, precompile und Lebenszyklus-Doku

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-017 (low), API-002 (low), BUG-018 (low), ASYNC-005 (low), IMPL-002 (low)
- Dazu (Zug 0, Folge von Paket 4, Symptom): `#join()` prüft und baut an einem Director, den ein
  Listener eines früheren Joins desselben Aufrufs entsorgt hat (`StageDirector.ts:684` →
  `:1647-1660`), samt der fehlenden Spec-Abdeckung, die Paket 4 nennt
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie API-002, aus »Offene Befunde«): die
  Stage-Argumente von `hide()`, `replace()` (`from`), `setMask()`, `freeze()`/`run()` werden nicht
  als Objekt geprüft
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie BUG-017): ein `freeze()`/`run()` von Hand auf
  die Layer, die ein `push()` mit `below: 'freeze'` darunter eingefroren hat, geht beim `pop()`,
  `hide()`, Entfernen des Slots und `setStack()` verloren
- Ziel: Der Director bleibt bei Dispose, Fehlereingaben und parallelen `precompile()`-Aufrufen
  konsistent, und `resource-lifecycle.md` beschreibt die neuen Features samt der
  »never rejects«-Ausnahme.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageDirector.ts`
  - `packages/twopoint5d/src/stage/StageDirector.spec.ts`
  - `packages/twopoint5d/src/stage/transitionEffects.ts`
  - `packages/twopoint5d/src/stage/transitionEffects.spec.ts`
  - `packages/twopoint5d/src/stage/StageTransition.ts` (nur TSDoc von `finished`)
  - `packages/twopoint5d/src/display/Display.ts` (nur Klassen-TSDoc, Schritt 3)
  - `packages/twopoint5d/docs/resource-lifecycle.md`
  - `packages/twopoint5d/docs/stages.md`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): check the arguments of a disposed StageDirector, keep freezes set by hand and let precompile() wait for a running compile`

## Warum so — Entscheidungen des Zugs 0

- **Modell stärkste Stufe, Effort medium.** Die Schritte unten nennen Namen, Signaturen und
  Meldungstexte; was bleibt, ist das Lesen einer Datei von 2 300 Zeilen, in der Listener mitten in
  eine Änderung zurückrufen (Paket 4 brauchte zwei, Paket 5 fünf Runden). Dafür das stärkere
  Modell. Effort nicht `high`: die einzige Nebenläufigkeit — zwei `precompile()`-Aufrufe, die sich
  über ein Promise begegnen — ist unten Zustand für Zustand beschrieben.
- **Folge aus Paket 4 hier, kein eigenes Nachtragspaket.** Die Tabelle verlangt für ein Symptom
  eines committeten Pakets ein Nachtragspaket. Das wäre ein Paket direkt hinter diesem, auf
  denselben Methoden (`#show()`, `#join()`), deren Einstieg API-002 hier umbaut; Paket 4 hat die
  Folge ausdrücklich an diesen Zug 0 adressiert. Ein Review sieht beide Änderungen zusammen.
  Spur der Kette: `Folge von: Paket 4` am Block im Plan, nur für diesen Teil.
- **Stage-Argumente aus der Queue mitgenommen.** Gleiche Ursache wie API-002: es fehlt eine
  Eingabeprüfung, die unabhängig vom Zustand des Directors läuft. Ohne sie kann API-002 für
  `hide()`, `replace()`, `setMask()`, `freeze()`/`run()` gar nicht »invalid input is still turned
  away« erfüllen. Vorbestehend: Datei an der Basis `d9b648bf` schon so.
- **`frozeBelow` mitgenommen.** Gleiche Ursache wie BUG-017: der Director hebt seinen eigenen
  Freeze auf und überschreibt dabei einen Zustand von Hand. Vorbestehend:
  `git show d9b648bf:packages/twopoint5d/src/stage/StageDirector.ts` hat `frozeBelow` an `:679-681`,
  `:850`, `:1517-1519`. Den Guide-Satz »set it by hand« nur für Transitionen wahr zu machen, wäre
  die halbe Ursache.
- **`renderOrder` nach `dispose()` still** (Empfehlung des Audits), nicht umgekehrt alle drei
  werfend. Der Guide verspricht für jeden entsorgten `StageRenderer`: »a write to `pipeline`,
  `buildOutputNode` or `internalTargetPool` is ignored« (`docs/stages.md` »Who disposes what«), und
  der Director hält das für `pipeline` und `buildOutputNode` schon so (`StageDirector.ts:548-561`).
  Die Ablehnung »the director's own« ist eine Ablehnung des Zustands, nicht des Werts; nach
  `dispose()` gibt es nichts mehr, dem der Wert widerspräche.
- **Welche Prüfungen vor den Rückweg `#ignoresChanges()` gehören:** alles, was ohne Blick auf den
  Stapel falsch ist — Optionen (`parseOptions()`, `below`), die Masken-Liste des Effekts
  (`masksOf()`), der Typ von `mask`, `at` als ganze Zahl ≥ 0, ein Stage-Argument als Objekt, und für
  eine Stage, die eine Layer werden soll, `#refuseStage()` ganz (entsorgt, `ClearStage`, ohne
  `renderTo()`, der Director selbst oder einer, der ihn hält). Dahinter bleibt, was am Stapel oder
  an den Masken des Directors hängt: schon im Stapel / nicht im Stapel, `#refuseMaskStageAsLayer()`,
  `#checkMask()` über den Typ hinaus, `#checkEffectMasks()`, `#checkScales()`, die Obergrenze von
  `at`. Auf einem entsorgten Director ist der Stapel leer: diese Prüfungen würden jedes gültige
  `hide(stage)` und jedes `at > 0` ablehnen.
- **`precompile()`, das auf eine fremde Kompilierung wartet, teilt deren Ausgang.** Scheitert sie,
  lehnt auch der Wartende mit ihrem Fehler ab, statt selbst neu zu kompilieren: ein Fehler beim
  Bau desselben Graphen für denselben Renderer kommt beim zweiten Versuch im selben Moment wieder,
  und ein aufgelöstes `await` soll heißen »kompiliert«. Erst ein `precompile()`, das nach dem
  Fehlschlag beginnt, baut und kompiliert neu.
- **Gescheiterte Kompilierung: Eintrag fliegt raus** (statt eines Flags »nicht kompiliert«). So
  gilt die Invariante: ein Eintrag in `#shapes` ist kompiliert — gezeichnet oder vorkompiliert —,
  oder seine Kompilierung läuft (`compiling`). Ausnahme: hat ein Frame die Shape in der Zwischenzeit
  zum Shape des Stapels gemacht (`this.#shape === entry.shape`), bleibt sie, nur nicht mehr
  gepinnt — der Frame hat sie gebaut.
- **`precompile()` resolved nach einem `dispose()` während der Kompilierung auch dann, wenn diese
  danach ablehnt.** Entscheidung vom 2026-10-31 (»never rejects«): `precompile()` löst bei einem
  `dispose()` während des Laufs auf. Der Wartende macht diesen Pfad neu; ohne den Guard stimmte der
  Satz in §3 nur, solange three eine Kompilierung einer entsorgten Pipeline nicht ablehnt. Die
  Shape ist mit dem Director gegangen, der Fehler hätte keinen Gegenstand mehr.
- **IMPL-002, Teil Display: Paket 5 hat den Großteil erledigt** (siehe Abgleich). Offen ist nur der
  Schritt 3 der Klassen-TSDoc in `Display.ts`.
- **CHANGELOG:** `StageDirector`, `StageTransition`, `precompile()` und die Effekte stehen
  unveröffentlicht unter `## [Unreleased]` → `### Added`. Paket 4 hat deshalb die Added-Einträge
  fortgeschrieben, keine Fixed-Einträge angelegt; dieses Paket ebenso. Für die Richtungsnamen von
  `wipe()`/`slide()` kein Eintrag: der Added-Eintrag der Effekte beschreibt keine Ablehnung.

## Vorgehen

Alle Texte in Code, Kommentaren, Doku und CHANGELOG auf Englisch, nach den »Konventionen« im Plan:
keine Finding-IDs, kein Rückblick (»now«, »no longer«, »instead of before«). Meldungen nach
AGENTS.md: Subjekt, Doppelpunkt, was falsch ist, der abgelehnte Wert über `describeValue()`.
Bei jedem Korrektheitsfehler zuerst den Regressionstest schreiben und rot laufen sehen
(`pnpm nx test twopoint5d -- src/stage/StageDirector.spec.ts` bzw. `…/transitionEffects.spec.ts`),
den roten Lauf in den Report.

### 1. `#join()` auf einem entsorgten Director (Folge aus Paket 4)

1. Regressionstest in `StageDirector.spec.ts`, `describe('a listener that changes the stack')`,
   neben den Tests ab `:777`:
   `show() with a mask and the masks of an effect answers a cancelled transition when a listener of the join of the mask disposes the director and a mask stage of the effect`.
   Aufbau: `director.setStack([a])`; `m = fakeStage('m')`; `n = new StageRenderer(); n.name = 'n'`
   (eine `FakeStage` hat kein `dispose()`); `once(director, OnStageAdded, () => { director.dispose(); n.dispose(); })`;
   `const t = director.show(c, {mask: new StageMask(m), effect: {...crossfade(), masks: [new StageMask(n)]}, duration: 0.2})`.
   Erwartet: kein Wurf, `t.state === 'cancelled'`, `director.isDisposed`, `director.stack` `[]`,
   `director.stages` Länge 0. Vor dem Fix rot mit
   `StageDirector#show() cannot take the stage "n": that stage has been disposed`.
2. `StageDirector.ts` `#join()` (`:1640`): als erste Anweisung
   `if (this.isDisposed) return undefined;` mit einem Kommentar, warum: ein Listener eines
   früheren Joins desselben Aufrufs — der Slot-Maske in `#show()`, einer Masken-Stage in
   `#useMasks()` — hat den Director entsorgt; an einem Director, der weg ist, wird nichts mehr
   geprüft und nichts gebaut. Das TSDoc von `#join()` (`:1633-1639`) um den Fall ergänzen: auch ein
   Director, der beim Aufruf schon entsorgt ist, antwortet `undefined`. Alle Aufrufer behandeln
   `undefined` bereits (`#show()` `:697`, `replace()` `:814`, `setStack()` `:969`, `#useMasks()`
   `:1554`, `#maskSlot()` `:1585`).
3. Abdeckung, die Paket 4 fehlte (kein roter Lauf nötig, es ist Abdeckung):
   - in der Tabelle des Tests `a listener of OnStageAdded that disposes the director makes every change answer as a disposed director`
     (`:777`) zwei Zeilen dazu:
     `['hide() with the masks of an effect', () => director.hide(a, {effect: {...crossfade(), masks: [new StageMask(m)]}, duration: 0.2})]`
     und
     `['pop() with the masks of an effect', () => director.pop({effect: {...crossfade(), masks: [new StageMask(m)]}, duration: 0.2})]`;
   - neuer Test `a listener of OnAddToParent that disposes the director makes setMask() answer the director`:
     `director.setStack([a])`; Masken-Stage `m = new StageRenderer(); m.name = 'm'`;
     `once(m, OnAddToParent, () => director.dispose())`;
     `expect(director.setMask(a, new StageMask(m))).toBe(director)`; danach `director.isDisposed`,
     `director.stack` `[]`, `m.parent` `undefined`, `m.isDisposed` `false`, und ein zweiter
     Director nimmt `m` als Maske (`other.setStack([b]); other.setMask(b, new StageMask(m))` wirft
     nicht; `other.dispose()`) — wie im Test `:811`.

### 2. Eingaben vor dem Rückweg prüfen (API-002 und die Stage-Argumente)

1. Regressionstests in `StageDirector.spec.ts` (rot vor dem Fix):
   - `describe('dispose()')`, Test
     `refuses invalid arguments after dispose() as before, and answers valid ones as a disposed director`:
     nach `director.setStack([a]); director.dispose();`
     - `director.show(b, {duration: -1})` wirft `StageDirector#show(): duration must be a finite number of 0 or above, got -1`
     - `director.push(b, {below: 'still' as any})` wirft `StageDirector#push(): below must be 'run' or 'freeze', got "still"`
     - `director.show(b, {at: -1})` wirft `RangeError` `StageDirector#show(): at must be a whole number of 0 or above, got -1`
     - `director.show(b, {mask: 'm' as any})` wirft `StageDirector#show(): mask must be a StageMask, got "m"`
     - `director.show(new ClearStage())` wirft `TypeError`
     - `director.hide(undefined as any)` wirft `StageDirector#hide(): stage must be a stage, got undefined`
     - `director.replace(a, b, {easing: 'bounce' as any})` wirft `/StageDirector#replace\(\): easing must be/`
     - `director.pop({effect: 5 as any})` wirft `StageDirector#pop(): effect must be a StageTransitionEffect, got 5`
     - `director.setStack('x' as any)` wirft `StageDirector#setStack(): the stages must be an array, got "x"`
     - `director.setMask(a, 'm' as any)` wirft `StageDirector#setMask(): mask must be a StageMask, got "m"`
     - `director.freeze(null as any)` wirft `StageDirector#freeze(): stage must be a stage, got null`
     - und gültige Aufrufe antworten als entsorgter Director: `director.show(b, {at: 3}).state`
       `'cancelled'` (ein `at` über den leeren Stapel hinaus ist keine Ablehnung),
       `director.hide(a).state` `'cancelled'`, `director.setStack([a, b])` ist `director`,
       `director.freeze(a)` ist `director`.
   - `describe('dispose()')`, Test
     `ignores a write to pipeline, buildOutputNode and renderOrder after dispose()`: alle drei
     Schreibzugriffe werfen nach `dispose()` nicht; `director.renderOrder` bleibt `''`.
     Der Test `owns pipeline, buildOutputNode and renderOrder` (`:141`) bleibt für den lebenden
     Director stehen.
   - `describe('a listener that changes the stack')`, Test
     `a change a listener asks for under the lock of setStack() refuses its invalid arguments`:
     `director.setStack([a]); director.replace(a, b, {duration: 1});` ein `once(director,
     OnStageTransitionEnd, …)`, der `director.show(c, {duration: -1})` ruft und den Fehler fängt;
     `director.setStack([a])`; der gefangene Fehler ist ein `RangeError` mit
     `StageDirector#show(): duration must be a finite number of 0 or above, got -1`;
     `names(director.stack)` ist `['a']`.
   - `describe('refusals')`, Test
     `refuses a stage argument that is no object, with the call as its subject` (lebender
     Director, `director.setStack([a])`):
     `hide(undefined)` → `StageDirector#hide(): stage must be a stage, got undefined`,
     `replace(undefined, b)` → `StageDirector#replace(): from must be a stage, got undefined`,
     `setMask(null, undefined)` → `StageDirector#setMask(): stage must be a stage, got null`,
     `freeze(undefined)` → `StageDirector#freeze(): stage must be a stage, got undefined`,
     `run(7)` → `StageDirector#run(): stage must be a stage, got 7`; jeweils `TypeError`, und
     `names(director.stack)` bleibt `['a']`.
2. Drei Hilfen auf Modulebene in `StageDirector.ts`, neben `modeOption()`/`nonNegative()` (`:395ff.`),
   je mit einer TSDoc-Zeile:
   ```ts
   /** Refuses a stage argument that is no object: the director looks a stage up by its identity. */
   function stageArgument(subject: string, name: string, stage: unknown): void {
     if (stage === null || typeof stage !== 'object') {
       throw new TypeError(`${subject}: ${name} must be a stage, got ${describeValue(stage)}`);
     }
   }

   /** Refuses an `at` that is no whole number of 0 or above; `#slotIndexAt()` holds it to the length of the stack. */
   function atOption(subject: string, at: unknown): void {
     if (at !== undefined && (!Number.isInteger(at) || (at as number) < 0)) {
       throw new RangeError(`${subject}: at must be a whole number of 0 or above, got ${describeValue(at)}`);
     }
   }

   /** Refuses a `mask` that is neither `undefined` nor a `StageMask`; `#checkMask()` checks the rest. */
   function maskOption(subject: string, mask: unknown): void {
     if (mask !== undefined && !(mask instanceof StageMask)) {
       throw new TypeError(`${subject}: mask must be a StageMask, got ${describeValue(mask)}`);
     }
   }
   ```
3. Einstieg der Methoden, in genau dieser Reihenfolge; ein Kommentar an der ersten Stelle (bei
   `show()`) sagt einmal, warum: die Prüfungen der Argumente laufen vor dem Rückweg eines
   entsorgten oder gesperrten Directors, der ungültige Eingaben trotzdem ablehnt; dahinter, was
   am Stapel hängt.
   - `show()` (`:630`): `const options = parseOptions(subject, opts);`
     `this.#refuseStage(subject, stage);` `maskOption(subject, opts?.mask);`
     `atOption(subject, opts?.at);` `masksOf(subject, options.effect);` — dann
     `if (this.#ignoresChanges()) return this.#cancelledHandle(undefined, stage);` — dann wie
     bisher: schon im Stapel, `this.#refuseMaskStageAsLayer(subject, stage)` (statt
     `#refuseLayer()`), `#checkMask()`, `#checkEffectMasks()`, `#checkScales()`, `#slotIndexAt()`.
   - `push()` (`:838`): `const below = modeOption(subject, 'below', opts?.below);`
     `const options = parseOptions(subject, opts);` `this.#refuseStage(subject, stage);`
     `maskOption(subject, opts?.mask);` `atOption(subject, opts?.at);`
     `masksOf(subject, options.effect);` — dann `#ignoresChanges()` — dann schon im Stapel,
     `#refuseMaskStageAsLayer()`, Rest unverändert.
   - `hide()` (`:724`): `stageArgument(subject, 'stage', stage);`
     `const options = parseOptions(subject, opts);` `masksOf(subject, options.effect);` — dann
     `#ignoresChanges()` — dann `return this.#hide(subject, stage, options, false);`.
     `#hide()` (`:735`) nimmt statt `opts` die geparsten `options: ParsedOptions` und ruft
     `parseOptions()` nicht mehr selbst.
   - `pop()` (`:930`): `const options = parseOptions(subject, opts);`
     `masksOf(subject, options.effect);` — dann `#ignoresChanges()` — dann leerer Stapel,
     `return this.#hide(subject, top, options, true);`.
   - `replace()` (`:781`): `stageArgument(subject, 'from', from);`
     `const options = parseOptions(subject, opts);` `this.#refuseStage(subject, to);`
     `masksOf(subject, options.effect);` — dann `#ignoresChanges()` — dann nicht im Stapel, schon im
     Stapel, `this.#refuseMaskStageAsLayer(subject, to)`, Rest unverändert.
   - `setStack()` (`:948`): Array-Prüfung, dann die Schleife mit »twice« und
     `this.#refuseStage(subject, stage)` — dann `if (this.#ignoresChanges()) return this;` — dann
     eine Schleife `for (const stage of stages) this.#refuseMaskStageAsLayer(subject, stage);`, Rest
     unverändert.
   - `setMask()` (`:1027`): `stageArgument(subject, 'stage', stage);`
     `maskOption(subject, mask);` — dann `#ignoresChanges()` — Rest unverändert.
   - `#setFrozen()` (`:1059`): `stageArgument(subject, 'stage', stage);` vor
     `if (this.isDisposed) return this;`.
   - `set renderOrder()` (`:568`): `if (this.isDisposed) return;` vor dem `throw`, wie
     `pipeline` und `buildOutputNode`.
   - `#refuseLayer()` (`:1441`) hat danach keinen Aufrufer mehr und entfällt.
   - `precompile()` prüft schon vor `isDisposed` (`:1263-1268`) — unverändert.
4. TSDoc: jedes öffentliche Member, das `StageDirector` selbst deklariert, sagt in einem Satz, was
   es nach `dispose()` tut (`resource-lifecycle.md` §6 Punkt 6):
   - `show()`, `hide()`, `replace()`, `push()`, `pop()`: after `dispose()` — and while
     `setStack()` or `dispose()` end the running transitions — it answers a cancelled transition
     and changes nothing; its arguments are checked all the same.
   - `setStack()`, `setMask()`: dasselbe, mit »answers the director«.
   - `freeze()`, `run()`: after `dispose()` it does nothing; a stage argument that is no object is
     refused all the same.
   - `pipeline`, `buildOutputNode`: der Getter antwortet nach `dispose()` `undefined`, ein
     Schreibzugriff tut nichts; `renderOrder`: der Getter bleibt `''`, ein Schreibzugriff tut nichts.
   - `orderedStages`, `stack`, `transitions`: leer nach `dispose()`; `has()`, `isFrozen()`:
     `false`; `maskOf()`: `undefined`.
   - `add()`, `remove()`, `updateFrame()`: tun nach `dispose()` nichts (`add()` endet in
     `StageRenderer#add()`, das auf einem entsorgten Renderer sofort zurückkehrt; `remove()` findet
     keine Layer und keine Stage mehr) — vor dem Schreiben am Code nachsehen, nichts behaupten,
     was er nicht tut.
   - `precompile()`: siehe Abschnitt 4, Schritt 5.
5. Guide `docs/stages.md`:
   - Abschnitt »The transition«, Absatz **Events** (`:937-943`): an den Satz »While `setStack()` or
     `dispose()` end the running transitions, a change a listener asks for answers a cancelled
     `StageTransition` and changes nothing« anschließen, dass seine Argumente trotzdem geprüft
     werden und ein ungültiges abgelehnt wird wie überall.
   - Abschnitt »Who disposes what«, Liste unter dem Teardown-Beispiel: ein Punkt für den Director
     nach `dispose()`: every change answers a cancelled `StageTransition` — `setStack()` and
     `setMask()` the director —, invalid arguments are refused as before, a write to `pipeline`,
     `buildOutputNode` and `renderOrder` is ignored, and `precompile()` resolves at once.

### 3. Freeze von Hand bleibt stehen (BUG-017 und `frozeBelow`)

1. Regressionstests in `StageDirector.spec.ts`, `describe('run and freeze')` (rot vor dem Fix):
   - `a freeze() by hand of the stage a transition brings stays past its end`:
     `director.setStack([a]); director.replace(a, b, {duration: 0.2}); frame(); director.freeze(b); frame();`
     → `director.transitions` `[]`, `director.isFrozen(b)` `true` (vor dem Fix `false`).
   - `a run() by hand of the stage a transition leaves stays when the transition is cancelled`:
     `director.setStack([a]); director.freeze(a); const t = director.replace(a, b, {duration: 1}); frame(); director.run(a); t.cancel();`
     → `names(director.stack)` `['a']`, `director.isFrozen(a)` `false` (vor dem Fix `true`).
   - `a freeze() by hand of the layer a push() froze below stays through pop()`:
     `director.setStack([a]); director.push(b, {below: 'freeze'}); director.freeze(a); director.pop();`
     → `director.isFrozen(a)` `true`.
   - `a freeze() by hand of the layer a push() froze below stays through setStack()`:
     `director.setStack([a]); director.push(b, {below: 'freeze'}); director.freeze(a); director.setStack([a, b]);`
     → `director.isFrozen(a)` `true`.
   Die bestehenden Tests `:296-341` (ohne Eingriff von Hand) bleiben grün und unverändert.
2. `interface Run` (`:132`): zwei veränderliche Felder mit TSDoc —
   `fromByHand: boolean` und `toByHand: boolean`: »Whether a `freeze()` or `run()` reached `from`
   (`to`) while the transition ran: its state is then the caller's, and the end of the transition
   leaves it as it is.«
3. `#begin()` (`:1915`): `slot.run = {transition, from, to, fromWasFrozen: from?.frozen === true, fromByHand: false, toByHand: false, masks};`
4. `#endRun()` (`:1949-1952`): beide Zeilen bekommen die Bedingung `!run.toByHand` bzw.
   `!run.fromByHand` vorn in der Klammer; der Kommentar darüber sagt dazu, dass ein Zustand von
   Hand während der Transition dem Aufrufer gehört.
5. `#setFrozen()` (`:1059`): nach `layer.frozen = frozen;` eine Schleife über `this.#slots`: ist
   `slot.frozeBelow === layer`, wird `slot.frozeBelow = undefined`; ist `slot.run?.from === layer`,
   wird `slot.run.fromByHand = true`; ist `slot.run?.to === layer`, wird `slot.run.toByHand = true`.
   Kommentar: ein Zustand von Hand gehört dem Aufrufer; der Director hebt keinen eigenen Freeze
   darüber auf — weder am Ende einer Transition mit der Layer als Quelle noch, wenn der Slot geht,
   für den ein `push()` sie eingefroren hat. Die Stellen, die `frozeBelow` auftauen (`#hide()`
   `:765-768`, `#removeSlot()` `:1791-1794`, `setStack()` `:999`), bleiben unverändert: ohne
   `frozeBelow` tun sie nichts.
6. TSDoc von `freeze()` und `run()` (`:1049`, `:1054`): ein Satz, dass der Zustand von Hand dem
   Aufrufer gehört und das Ende einer Transition sowie der `pop()`/`setStack()` nach einem `push()`
   mit `below: 'freeze'` ihn stehen lassen.
7. Guide `docs/stages.md` »Run and freeze« (`:894`): an den Satz »`director.freeze(stage)` and
   `director.run(stage)` set it by hand; `director.isFrozen(stage)` asks.« anschließen: a state set
   by hand is yours — the end of a transition with the layer as a source, and the `pop()` or
   `setStack()` that ends a `push()` with `below: 'freeze'`, leave it as it is.

### 4. `precompile()` wartet auf eine laufende Kompilierung (ASYNC-005)

1. Regressionstests in `StageDirector.spec.ts`, `describe('precompile() on the way back')`
   (`:993`); `renderer.compileAsync` ist ein Mock, ein initialisierter Renderer erreicht die
   Kompilierung synchron (vgl. Test `:1008`):
   - `a second precompile() of a shape the first one still compiles resolves once that compile is through`
     (rot vor dem Fix): `compileAsync` per `mockImplementationOnce` mit zurückgehaltenem Promise;
     `const effect = crossfade();` erster Aufruf `director.precompile(renderer as any, [['layer', effect]])`;
     zweiter Aufruf mit derselben Shape, dessen Ende ein Flag setzt; nach
     `await new Promise((resolve) => setTimeout(resolve, 0))` ist das Flag noch nicht gesetzt;
     nach `release()` und `await` beider Aufrufe gesetzt; `compileAsync` genau einmal gerufen.
   - `a shape whose compile failed compiles again with the next precompile()` (rot vor dem Fix):
     `compileAsync.mockRejectedValueOnce(new Error('compile failed'))`; erster Aufruf lehnt mit
     `compile failed` ab; zweiter Aufruf mit derselben Shape resolved; `compileAsync` zweimal
     gerufen.
   - `a precompile() that waits for a compile that fails rejects with its error` (rot vor dem
     Fix): zurückgehaltenes Promise, das per Hand ablehnt; beide Aufrufe lehnen mit
     `compile failed` ab; ein dritter Aufruf danach kompiliert neu (`compileAsync` zweimal).
   - `a compile that fails after dispose() resolves the precompile() that started it and the one that waits for it`
     (rot vor dem Fix für den ersten Aufruf): zurückgehaltenes Promise; zwei Aufrufe;
     `director.dispose()`; dann ablehnen lassen; beide resolven `undefined`.
   - `a shape the stack draws while its compile fails stays the shape of the stack` (Abdeckung des
     neuen Pfads, kein roter Lauf erwartet): `const effect = crossfade()`; zurückgehaltenes
     Promise; `precompile(renderer, [['layer', effect]])`; während es wartet
     `director.setStack([a]); director.show(b, {effect, duration: 1}); frame(); draw();`
     `const pipeline = director.pipeline;` dann ablehnen lassen und die Ablehnung erwarten;
     `draw()` wirft nicht, `director.pipeline` ist dasselbe Objekt `pipeline`.
2. `interface CachedShape` (`:171`): Feld `compiling?: Promise<void>` mit TSDoc: »The compile
   `precompile()` runs for the shape: another `precompile()` that finds the shape waits for it. An
   entry without one is compiled — drawn, or through a compile that went through.«
3. `precompile()`, Schleife über `parsed` (`:1291-1303`), in dieser Form:
   - Treffer im Cache: `cached.pinned = true;` und, wenn `cached.compiling` steht, darauf
     `await`en; lehnt es ab und ist der Director inzwischen entsorgt (`this.isDisposed`), `break`,
     sonst den Fehler werfen; dann `continue`.
   - Neue Shape: `const entry: CachedShape = {shape, pinned: true};` in `#shapes` eintragen;
     `const compiling = this.#compileShape(…)` mit denselben Argumenten wie heute;
     `entry.compiling = compiling;` dann `try { await compiling; entry.compiling = undefined; }`
     `catch (error) { this.#forgetFailedShape(key, entry, errors); if (this.isDisposed) break; throw error; }`.
   - Der äußere `try/catch/finally` bleibt: der Fehler der Kompilierung bleibt der erste des
     `AggregateError`, `passTarget` wird freigegeben, `throwCollected(errors, …)` am Ende bleibt.
4. Neue private Methode bei `#evictShapes()`/`#disposeShape()`:
   ```ts
   /**
    * Lets go of the shape under `key` whose compile failed, so that the next `precompile()` builds and
    * compiles it anew — unless a draw since has made it the shape of the stack: then it stays, as one
    * the stack built itself.
    */
   #forgetFailedShape(key: string, entry: CachedShape, errors: unknown[]): void {
     entry.compiling = undefined;
     // a dispose() or a draw with another renderer has let go of it already
     if (this.#shapes.get(key) !== entry) return;
     if (this.#shape === entry.shape) {
       entry.pinned = false;
       return;
     }
     this.#shapes.delete(key);
     this.#disposeShape(entry.shape, errors);
   }
   ```
5. TSDoc von `precompile()` (`:1251-1255`): »A shape the director holds is skipped;« wird zu: a
   shape the director holds is skipped — once its compile is through, when another `precompile()`
   still compiles it —, and a shape whose compile failed is built and compiled again by the next
   call. »A disposed director resolves at once.« wird zu: a disposed director checks the arguments
   and resolves at once; one disposed while the call runs ends the work, and the promise resolves —
   also when a compile it waits for fails after the dispose.
6. Guide `docs/stages.md` »No hitch on the first transition« (`:793-797`): den Satz »A shape the
   director holds is skipped« ebenso ergänzen (wartet auf eine laufende Kompilierung, eine
   gescheiterte kompiliert der nächste Aufruf neu).

### 5. Richtungsnamen von `wipe()` und `slide()` (BUG-018)

1. Regressionstest in `transitionEffects.spec.ts`, neben den Ablehnungen `:61-65`:
   `refuses a direction that names a member of Object.prototype` —
   `wipe({direction: 'constructor' as any})` und `wipe({direction: '__proto__' as any})` werfen
   `wipe: direction must be 'left', 'right', 'up', 'down' or an angle in radians, got "constructor"`
   bzw. `… got "__proto__"`; `slide({direction: 'toString' as any})` wirft
   `slide: direction must be 'left', 'right', 'up' or 'down', got "toString"`. Vor dem Fix rot
   (`TypeError: … is not iterable`).
2. `transitionEffects.ts:109`: `DIRECTIONS[direction]` nur lesen, wenn
   `typeof direction === 'string' && Object.hasOwn(DIRECTIONS, direction)`.
3. `transitionEffects.ts:229`: `!(direction in DIRECTIONS)` wird zu
   `!Object.hasOwn(DIRECTIONS, direction as PropertyKey)` (die Prüfung auf `number` davor bleibt).

### 6. Lebenszyklus-Doku (IMPL-002)

1. `packages/twopoint5d/docs/resource-lifecycle.md` §3, nach dem Absatz »A pending promise does
   not survive either — …« (`:187-188`), ein Absatz für die Ausnahme. Inhalt, in eigenen Worten:
   ein Promise, das für das Ende von etwas steht, dessen Ende kein Fehler ist, resolved bei
   `dispose()` mit diesem Ende, statt abzulehnen; sein Wert trägt den Ausgang, und ein `await` der
   UI braucht kein try/catch. Namentlich, mit Links auf die Quellen:
   - `StageTransition#finished` (`src/stage/StageTransition.ts`): resolved mit der Transition, die
     `StageDirector#dispose()` als `'cancelled'` beendet — ein Pausenmenü, das nie ganz
     eingeblendet war, ist kein Fehler;
   - `StageDirector#precompile()`: ein `dispose()` während des Laufs beendet die Arbeit, und das
     Promise resolved — es gibt nichts mehr, wofür kompiliert würde;
   - `DisplayFullscreen#request()`, `exit()` und `toggle()` (`src/display/DisplayFullscreen.ts`): ein
     beim `Display#dispose()` offener Aufruf resolved `false`, ein Fullscreen, den der Browser danach
     gewährt, wird wieder verlassen, und `DisplayFullscreen#isDisposed` sagt es.
   Schlusssatz: jedes dieser Member sagt es in seinem eigenen TSDoc, und ein neues Member nimmt die
   Ausnahme nur in Anspruch, wenn sein aufgelöster Wert den Ausgang trägt, und sagt es ebenso.
2. §6 Punkt 7 (`:392`): »Reject every pending promise.« um die Ausnahme ergänzen: oder, unter der
   Ausnahme von §3, mit dem Ausgang auflösen, den sein Wert trägt, und das im TSDoc sagen.
3. §1, Absatz »What a method builds for its caller …« (`:16-30`):
   [`FrameTable`](../src/texture/FrameTable.ts)`#bakeDataTexture()` in die Aufzählung neben
   `FrameBasedAnimations#bakeDataTexture()` (neue Textur je Aufruf, der Aufrufer besitzt und
   entsorgt sie; ein Material, dem sie als `frameTable` übergeben wird, borgt sie —
   `FrameTable.ts:100-101`). Danach ein Satz zu [`DynamicAtlas`](../src/texture/DynamicAtlas.ts):
   es besitzt seine Texturen — `texture` und die zweite aus `textureFor()` —, einen selbst gebauten
   Canvas sowie Staging-Canvas und -Textur von `upload()`, und `dispose()` gibt sie frei (Texturen
   entsorgt, eigener Canvas und Staging-Canvas auf 0 × 0); ein übergebener Canvas bleibt beim
   Aufrufer, wird bemalt, aber weder in der Größe geändert noch freigegeben
   (`DynamicAtlas.ts:144-145`, `:533-551`).
4. §2: `DynamicAtlas` als zweites Beispiel der Flag-Form neben `VOBufferPool.dispose()` (`:121-122`)
   und in der Getter-Aufzählung »VOBufferPool and FixedFrameLoop do« (`:141-142`) ergänzen — es hat
   `isDisposed`.
5. §3: nach der Liste der drei Arten (`:156-170`) ein Satz mit `DynamicAtlas` als Beispiel, das
   alle drei zeigt — genau nach seinem TSDoc (`DynamicAtlas.ts:533-540`): `texture`,
   `textureFor()`, `canvas` und `context` werfen, ebenso `add()` und `redraw()` (beide geben einen
   `TextureAtlasFrame` zurück, `:343-345`, `:399`); `remove()` antwortet `false`; `clear()` und
   `upload()` tun nichts; `atlas` und die Größen antworten, was sie hielten. Nichts dazuerfinden.
6. `src/stage/StageTransition.ts:173`: der Getter `finished` bekommt ein TSDoc: resolves with the
   transition once it is over — finished, or cancelled, as `StageDirector#dispose()` cancels it —,
   and never rejects.
7. `src/stage/StageDirector.ts` TSDoc von `dispose()` (`:1328-1336`): »Ends every running
   transition as cancelled« um »— their `finished` resolves —« ergänzen.
8. `src/display/Display.ts` Klassen-TSDoc Schritt 3 (`:209-212`): zwischen »… down,« und »fires
   `OnDisplayDispose`« einfügen, dass `dispose()` einen Fullscreen verlässt, den diese Display
   betreten oder angefragt hat (see {@link Display.fullscreen}) — derselbe Inhalt wie im
   Methoden-TSDoc `:1966-1968`.

### 7. CHANGELOG

Skill `updating-changelog` laden. In `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`,
`### Added`:
- Eintrag »add `StageDirector`, …« fortschreiben: ein Zustand von `freeze()`/`run()` gehört dem
  Aufrufer und überdauert das Ende einer Transition und einen `pop()`; nach `dispose()` antwortet
  jede Änderung mit einer abgebrochenen Transition (`setStack()`, `setMask()` mit dem Director),
  ein Schreibzugriff auf `pipeline`, `buildOutputNode`, `renderOrder` tut nichts, und ungültige
  Argumente werden trotzdem abgelehnt.
- Eintrag »add `StageDirector#precompile(…)`« fortschreiben: ein zweiter Aufruf wartet auf eine
  Kompilierung, die ein erster noch ausführt; eine gescheiterte Shape kompiliert der nächste Aufruf
  neu; ein während des Aufrufs entsorgter Director lässt ihn auflösen.
Keine Einträge unter Changed/Fixed (unveröffentlichtes Feature), keiner für `wipe()`/`slide()`,
keiner für die Doku.

### 8. Commit-Message

Betreff wie oben. Body auf Englisch, ohne Finding-IDs, in eigenen Worten:
- the arguments of every change of a `StageDirector` are checked before it looks at its state:
  after `dispose()` and under the lock of `setStack()`/`dispose()` an invalid argument is refused
  and a valid one answers a cancelled transition; a stage argument that is no object is refused
  with the call as its subject; a write to `renderOrder` of a disposed director does nothing, as one
  to `pipeline` and `buildOutputNode`
- a `freeze()` or `run()` by hand outlasts the end of a transition with the layer as a source and
  the `pop()` or `setStack()` that ends a `push()` with `below: 'freeze'`
- `precompile()` of a shape another call still compiles waits for that compile, a shape whose
  compile failed compiles again with the next call, and a director disposed during the call makes
  it resolve
- a change whose listener disposes the director as a stage joins lets no further stage join, so a
  mask stage that listener disposed is no refusal
- `wipe()` and `slide()` look their direction names up among their own keys
- `resource-lifecycle.md` names the promises that resolve with their outcome on `dispose()`,
  `FrameTable#bakeDataTexture()` and `DynamicAtlas`; the class TSDoc of `Display` names the
  fullscreen its `dispose()` leaves

## Abgleich (Zug 0, 2026-11-01)

- **BUG-017** — umgeformt: `StageDirector.ts:1951-1952` (`#endRun()`), Paket 4 hat `leftStays`
  dazugesetzt; der harte Reset `run.to.frozen = false` / `run.from.frozen = run.fromWasFrozen`
  steht weiter. `#setFrozen()` `:1059-1067` setzt nur `layer.frozen`.
- **API-002** — unverändert in der Sache, Rückweg umbenannt: `#ignoresChanges()` (`:1404-1406`,
  entsorgt oder `#stackLocked > 0`) steht vor jeder Prüfung in `show()` `:632`, `hide()` `:726`,
  `replace()` `:783`, `push()` `:840`, `pop()` `:932`, `setStack()` `:950`, `setMask()` `:1029`;
  `#setFrozen()` `:1060` mit `isDisposed`. `set renderOrder()` `:568-570` wirft auch entsorgt,
  `pipeline`/`buildOutputNode` `:548-561` schweigen.
- **BUG-018** — unverändert: `transitionEffects.ts:109` (`DIRECTIONS[direction]`), `:229`
  (`direction in DIRECTIONS`).
- **ASYNC-005** — verschoben: `StageDirector.ts:1295-1302` (`precompile()`), `CachedShape`
  `:171-178` mit `{shape, pinned}`; Treffer im Cache setzt `pinned` und überspringt.
- **IMPL-002** — teilweise erledigt durch Paket 5 (4308cc70): der Auszug von `Display.dispose()`
  in `resource-lifecycle.md:240-301` enthält `this.#fullscreen?.dispose()` mit Begründung der
  Reihenfolge (`:259-266`); das Methoden-TSDoc `Display.ts:1966-1968` nennt den Fullscreen; die
  TSDocs `DisplayFullscreen.ts:469-471`, `:489-490`, `:504` und die Klassen-TSDoc `:203-206`
  nennen das Verhalten nach `dispose()`. Offen: Klassen-TSDoc `Display.ts:209-212`, die Ausnahme in
  §3 (`resource-lifecycle.md:187-188`) und §6 Punkt 7 (`:392`), `FrameTable`/`DynamicAtlas` in §1
  (`:16-30`), §2, §3; `StageTransition#finished` ohne eigenes TSDoc (`StageTransition.ts:173`),
  `precompile()`-TSDoc nennt nur den vorher entsorgten Director (`StageDirector.ts:1254-1255`).
- **Folge aus Paket 4** — unverändert: `#show()` ruft `#useMasks()` (`:684`) nach einem
  `#maskSlot()`, dessen Join den Director entsorgt haben kann; `#join()` prüft `:1659-1660` und baut
  `:1662-1676` ohne Blick auf `isDisposed`. Bestätigt am Code: nur der Fall, dass derselbe Listener
  eine Effekt-Masken-Stage entsorgt, endet in einer Ablehnung; sonst kehrt `StageRenderer#add()`
  auf dem entsorgten Director zurück, und `#join()` entsorgt den Wrapper wieder.
- **Nebenbefund Stage-Argumente** (Queue, aus Paket 4) — verschoben: `#hide()` `:738`
  (`stage.name`), `replace()` `:786` (`from.name`), `setMask()` `:1031`, `#setFrozen()` `:1063`.
- **Nebenbefund `frozeBelow`** (neu im Zug 0) — `#hide()` `:765-768`, `#removeSlot()`
  `:1791-1794`, `setStack()` `:999`; an der Basis `d9b648bf` `:679-681`, `:1517-1519`, `:850`.

## Verlauf

- 2026-11-01 Zug 0: Detailplan steht · BUG-017 umgeformt (`#endRun()` `:1951-1952`) · API-002
  unverändert (Rückweg `#ignoresChanges()`) · BUG-018 unverändert · ASYNC-005 verschoben
  (`:1295-1302`) · IMPL-002 teils durch Paket 5 erledigt, Rest offen · Folge aus Paket 4 als Symptom
  hierher · Folge aus Paket 5 als Symptom → Nachtragspaket 15 · Nebenbefund Stage-Argumente aus der
  Queue hierher · neuer vorbestehender Nebenbefund `frozeBelow` hierher · Restplan: Paket 15 neu
  direkt hinter 6 (Begründung im Block); 7–13 unverändert — keines berührt `StageDirector.ts`
  oder §1/§3 von `resource-lifecycle.md`; Paket 8 ändert an `DynamicAtlas` die Dirty-Liste, nicht
  das Verhalten nach `dispose()`, das hier in §3 beschrieben wird; Paket 13 ruft `precompile()` in
  den Demos und bekommt damit nur die stärkere Zusage
- 2026-11-01 Zug 1: Implementierer beauftragt (opus, Effort medium) · Brief `paket-6.impl-0.brief.txt`, Report nach `paket-6.impl-0.json` im Arbeitsverzeichnis
- 2026-11-01 Zug 2: Report FERTIG (session 5894109f-6943-4932-8fe8-169a6250583f) · geändert: `StageDirector.ts`, `StageDirector.spec.ts`, `transitionEffects.ts`, `transitionEffects.spec.ts`, `StageTransition.ts`, `Display.ts`, `docs/resource-lifecycle.md`, `docs/stages.md`, `CHANGELOG.md` · 14 Regressionstests rot vor dem Fix, 3 Abdeckung · Arbeitsbaum schmutzig · eigener Verify läuft → `paket-6.verify.log`
- 2026-11-01 Zug 2: eigener Verify `pnpm run ci` exit=0 → `paket-6.verify.log`
- 2026-11-01 Zug 3: Reviewer beauftragt (opus, Effort medium) · Diff `paket-6.diff` · Report nach `paket-6.review-0.json`
- 2026-11-01 Zug 3: Urteil freigabefähig — alle Findings und »Dazu«-Punkte behoben, zwei kleine Befunde · `paket-6.review-0.json`
- 2026-11-01 Zug 4: keine Runde (nur kleine Befunde)
- 2026-11-01 Zug 5: Commit 6d041d1f, 9 Dateien, Verify `paket-6.verify.log` exit=0 (keine Änderung seit dem Lauf)

## Urteil des Reviewers (opus, review-0)

- BUG-017: behoben — `StageDirector.ts:141,146` (`fromByHand`/`toByHand`), `:2049` (`#begin()`), `:1172-1176` (`#setFrozen()`), `:2086-2088` (`#endRun()`)
- API-002: behoben — Prüfungen vor `#ignoresChanges()` in `show()` `:684-689`, `hide()` `:785-788`, `replace()` `:847-851`, `push()` `:910-916`, `pop()` `:1010-1012`, `setStack()` `:1033-1042`, `setMask()` `:1117-1119`, `#setFrozen()` `:1162`; `renderOrder` still nach `dispose()` `:620`
- BUG-018: behoben — `transitionEffects.ts:109-113`, `:233` (`Object.hasOwn`); Spec `transitionEffects.spec.ts:76-86`
- ASYNC-005: behoben — `CachedShape.compiling` `StageDirector.ts:192`, `precompile()` `:1412-1439`, `#forgetFailedShape()` `:2252-2262`, TSDoc `:1361-1370`, Guide `docs/stages.md:794-796`
- IMPL-002: behoben — `resource-lifecycle.md` §1 `:23-31`, §2 `:128-129`/`:148-150`, §3 `:180-183` und Ausnahme `:203-218`, §6 Punkt 7 `:422-423`; `StageTransition.ts:173-176`, `StageDirector.ts:1464`, `Display.ts:210-211`
- Dazu `#join()` entsorgt: behoben — `StageDirector.ts:1776-1778`, TSDoc `:1768-1769`, Specs samt Abdeckung `hide()`/`pop()` mit Effekt-Masken und `setMask()` über `OnAddToParent`
- Dazu Stage-Argumente: behoben — `stageArgument()` `StageDirector.ts:419-423`, aufgerufen in `hide()`, `replace()` (`from`), `setMask()`, `#setFrozen()`
- Dazu `frozeBelow`: behoben — `#setFrozen()` löscht `slot.frozeBelow` `:1173`; `#hide()` `:826`, `setStack()` `:1084`, `#removeSlot()` `:1925` lassen den Zustand von Hand stehen

Kleine Befunde (keine Runde):
- `packages/twopoint5d/docs/stages.md:796` — ergänzter Satz nicht neu umbrochen (~150 Zeichen, Nachbarn ≤ 100)
- `packages/twopoint5d/docs/resource-lifecycle.md:31` — Zeile nach dem neuen `DynamicAtlas`-Satz zu lang, Absatz nicht neu umbrochen

Hinweis des Implementierers (außerhalb der Paketdateien, nicht untersucht): Biome meldet 19 Warnungen, u. a. `noFocusedTests` in `src/stage/fitIntoRectangle.spec.ts:331-408`, `noIdenticalTestTitle` in `src/stage/ProjectionPlane.spec.ts:16` und `src/texture/TextureCoords.spec.ts:109` · B hat `noFocusedTests` geprüft: Fehlalarm, die Spec ruft eine lokale Hilfe `fit()` (kein `.only`, auch nicht an der Basis d9b648bf); Warnungen sind Baseline, nicht in die Queue

## Findings im Volltext

**BUG-017 · low · packages/twopoint5d/src/stage/StageDirector.ts:1666** — freeze()/run() von Hand über das Ende einer Transition erhalten
#endRun() setzt den Frozen-Zustand der behaltenen Quelle hart: `to` auf false, `from` auf den Wert vom Beginn der Transition. Ein freeze(stage) oder run(stage), das der Aufrufer während der Transition setzt, geht am Ende verloren. Probe: replace(a, b, {duration: 0.2}); updateFrame(); freeze(b); weitere Frames → isFrozen(b) false. Der Guide beschreibt freeze()/run() als Setzen 'by hand' ohne Einschränkung.
Beleg: `if (kept === run.to && run.to) run.to.frozen = false;` / `if (kept === run.from && run.from) run.from.frozen = run.fromWasFrozen;`
Empfehlung: Merken, ob freeze()/run() während des Runs auf eine seiner Quellen gerufen wurde (oder den von incoming/outgoing gesetzten Zustand getrennt vom Hand-Zustand halten) und am Ende nur den Transition-eigenen Anteil zurücksetzen. Alternativ das Verhalten im Guide unter 'Run and freeze' festhalten.

**API-002 · low · packages/twopoint5d/src/stage/StageDirector.ts:581** — Eingaben auch nach dispose() abweisen
Weitere Stellen (Audit-Stand): `:660`, `:692`, `:730`, `:822`, `:871`, `:521`.
Auf einem entsorgten Director geben show(), hide(), replace(), push(), pop() sofort einen abgebrochenen Handle zurück und setStack(), setMask() sofort `this` — noch vor jeder Prüfung der Argumente. `setStack('x')` oder `show(stage, {duration: -1})` laufen dann still durch. resource-lifecycle.md §3 verlangt für den stillen No-op: 'Invalid input is still turned away.' Umgekehrt wirft der Setter von renderOrder auch auf einem entsorgten Director, während pipeline und buildOutputNode dort still nichts tun.
Beleg: `if (this.isDisposed) return this.#cancelledHandle(undefined, stage);` / `const options = parseOptions(subject, opts);`
Empfehlung: Die Prüfung der Argumente (parseOptions, Array-Check, Mask-Typ) vor den isDisposed-Rückweg ziehen und für renderOrder dieselbe Regel wie für pipeline und buildOutputNode anwenden; die Wirkung nach dispose() im TSDoc jedes Members festhalten.

**BUG-018 · low · packages/twopoint5d/src/stage/transitionEffects.ts:109** — Richtungsnamen von wipe() und slide() über eigene Keys prüfen
Weitere Stelle: `:229`.
directionVector() liest `DIRECTIONS[direction]` und slide() prüft `direction in DIRECTIONS`; beide sehen die Prototypkette von Object. `slide({direction: 'toString'})` und `wipe({direction: 'constructor'})` passieren die Prüfung und scheitern mit `TypeError: directionVector is not a function or its return value is not iterable` (per Probe belegt) statt mit der Refusal-Meldung, die AGENTS.md für abgewiesene Werte vorgibt.
Beleg: `const vector = typeof direction === 'string' ? DIRECTIONS[direction as StageTransitionDirection] : undefined;`
Empfehlung: `Object.hasOwn(DIRECTIONS, direction)` verwenden (oder DIRECTIONS mit `Object.create(null)` bzw. als Map anlegen), in directionVector() und in slide().

**ASYNC-005 · low · packages/twopoint5d/src/stage/StageDirector.ts:1106** — Parallele precompile()-Aufrufe auf die laufende Kompilierung warten lassen
Weitere Stelle: `:1108`.
precompile() trägt eine Shape in #shapes ein, bevor ihr compileAsync() fertig ist, und überspringt jeden Key, der schon dort steht. Ein zweiter precompile()-Aufruf mit derselben Shape — etwa aus einem zweiten Ladeschritt — resolved daher sofort, während der erste noch kompiliert; ein `await director.precompile(...)` garantiert in diesem Fall keinen fertigen Shader. Dasselbe gilt für eine Shape, deren compileAsync() fehlgeschlagen ist: sie gilt fortan als kompiliert.
Beleg: `if (this.#shapes.has(key)) continue;` / `const shape = this.#buildShape(renderer, kinds);` / `this.#shapes.set(key, shape);` / `await this.#compileShape(...)`
Empfehlung: Pro Shape das Promise der Kompilierung speichern und in einem späteren precompile() darauf warten; bei einem Fehler den Eintrag als nicht kompiliert markieren.

**IMPL-002 · low · packages/twopoint5d/docs/resource-lifecycle.md:258** — resource-lifecycle.md um die Lebenszyklen der neuen Features nachziehen
Weitere Stellen (Audit-Stand): `src/display/Display.ts:1948`, `src/display/Display.ts:201`, `src/stage/StageTransition.ts:76`, `src/stage/StageDirector.ts:1132`, `src/stage/StageDirector.ts:1082`, `src/texture/DynamicAtlas.ts:541`, `src/texture/FrameTable.ts:107`.
Die verbindlichen Lebenszyklus-Regeln sind hinter drei Bereichen zurückgeblieben. **Display:** `Display#dispose()` verlässt seit dem Fullscreen-Feature einen Pseudo-Fullscreen, verlässt einen nativen Fullscreen, den die Display betreten hat, löst ein Orientation-Lock und nimmt den `fullscreenchange`-Listener vom Dokument. Weder die TSDoc von `dispose()` (»stops the frame loop, takes the visibilitychange listener and the observer … down …«) noch Schritt 3 des Lebenszyklus in der Klassen-TSDoc nennen das; der in resource-lifecycle.md §4 als Referenz zitierte Code von `Display.dispose()` enthält die Zeile `this.#fullscreen?.dispose()` nicht mehr. **StageDirector:** resource-lifecycle.md §3 ist verbindlich: 'anything a caller is still awaiting when dispose() runs is rejected as part of it.' StageDirector#dispose() settled laufende Transitionen dagegen als 'cancelled' und resolved `finished`; precompile() auf einem während des Laufs entsorgten Director resolved ebenfalls. Beides ist im TSDoc und im Guide bewusst so beschrieben ('never rejects'), steht aber in den verbindlichen Regeln nicht als Ausnahme — die nächste Umsetzung nach §6 Punkt 7 bricht die API. **Texturen:** `resource-lifecycle.md` ist laut Kopf bindend „für jede Klasse mit `dispose()`" und zählt die Builder-Methoden des Texture-Moduls (`TextureFactory#create()`, `FrameBasedAnimations#bakeDataTexture()`) auf. `DynamicAtlas` (besitzt Texturen, Staging-Canvas, einen selbst gebauten Canvas; ein übergebener bleibt beim Aufrufer) und `FrameTable#bakeDataTexture()` (neue Textur je Aufruf, Aufrufer besitzt sie) kommen im Dokument nicht vor. Die Regeln werden im Code eingehalten, stehen aber nur im TSDoc.
Empfehlung: Display: Beide TSDocs um den Fullscreen-Teardown ergänzen und das Zitat in §4 auf den aktuellen Stand bringen (dort auch die Reihenfolge begründen: vor dem Dispose-Event, solange der Canvas das Default-Ziel noch benennt). StageDirector: In resource-lifecycle.md §3 die Ausnahme mit Begründung aufnehmen (ein Handle, dessen Ende kein Fehler ist, resolved mit einem Endzustand) und StageTransition als Beispiel nennen; für precompile() entscheiden, ob Resolve bei dispose() bleiben soll, und das dort ebenso festhalten. Texturen: Beide in Abschnitt 1 aufführen und `DynamicAtlas#dispose()` in die Idempotenz- und After-dispose-Abschnitte einbeziehen.

**Folge aus Paket 4** (dessen `Folgen:`-Zeile, wörtlich) — `packages/twopoint5d/src/stage/StageDirector.ts:684` und `:1659-1660` — entsorgt der Join der Slot-Maske in `#show()` den Director (Listener von `OnStageAdded`/`OnAddToParent`), läuft `#useMasks()` weiter und `#join()` prüft und baut am entsorgten Director; hat derselbe Listener eine Effekt-Masken-Stage entsorgt, antwortet `show(c, {mask, effect: {masks: [n]}})` mit der Ablehnung »that stage has been disposed« statt mit einem abgebrochenen Handle — gegen den Satz in `docs/stages.md:941` und Proposal §5.4. Vorschlag des Reviewers: `if (this.isDisposed) return undefined;` ganz am Anfang von `#join()`. Dazu fehlt Spec-Abdeckung für `hide()`/`pop()` mit Effekt-Masken und `setMask()` über `OnAddToParent` (`StageDirector.spec.ts:777-842`).

**Nebenbefund aus »Offene Befunde«** (aus Paket 4, Zug 0, wörtlich) — `packages/twopoint5d/src/stage/StageDirector.ts:672`/`:695`/`:873`/`:902` — die Stage-Argumente von `hide()`, `replace()` (`from`), `setMask()` und `freeze()`/`run()` werden nicht als Objekt geprüft: `hide(undefined)` liest `stage.name` und wirft einen TypeError ohne Subjekt statt einer Ablehnung nach AGENTS.md; vorbestehend (Datei seit d9b648bf unverändert) · low.
