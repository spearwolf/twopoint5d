# Paket 4 — StageDirector: Transitionen, Stapel und Shape-Cache

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-001 (high), RES-001 (high), TEST-002 (medium), ASYNC-003 (medium), BUG-006
  (medium), BUG-007 (medium), BUG-005 (medium), TEST-004 (low), RES-005 (low, im Zug 0 aus
  Paket 6 hierher gezogen)
- Dazu (Nebenbefunde gleicher Ursache, im Zug 0 aufgenommen, alle vorbestehend — `StageDirector.ts`
  ist seit dem Audit-Commit d9b648bf unverändert): siehe »Abgleich«, Punkte N1–N4
- Ziel: Laufende Transitionen überstehen `setStack()`, `show()`, `push()` und werfende Listener mit
  konsistentem Stapel, und der Shape-Cache wächst nicht unbegrenzt.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/stage/StageDirector.ts`
  - `packages/twopoint5d/src/testing/stageFixtures.ts` (neu)
  - `packages/twopoint5d/src/stage/StageDirector.spec.ts`
  - `packages/twopoint5d/src/stage/StageDirector.masks.spec.ts`
  - `packages/twopoint5d/src/stage/StageDirector.shapes.spec.ts` (neu)
  - `packages/twopoint5d/src/stage/hot-path-allocations.director.spec.ts`
  - `packages/twopoint5d-testing/test/stage-transitions.test.js`
  - `packages/twopoint5d/docs/stages.md`
  - `packages/twopoint5d/docs/proposals/stage-transitions.md`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): keep the stack of a StageDirector whole through listeners and refusals, and bound its shapes`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · alle acht Findings unverändert an ihren Fundstellen
    (`StageDirector.ts` seit d9b648bf nicht angefasst; die Guide-Stelle von RES-001 liegt bei
    `docs/stages.md:743/746/750`, das Audit nennt den Kommentar `:722` darüber) · RES-005 aus
    Paket 6 hierher gezogen · Nebenbefunde N1–N4 gleicher Ursache aufgenommen, N5 nach »Offene
    Befunde« (→ Scope) · keine offenen `Folgen:` aus erledigten Paketen; die drei
    Lockfile-Advisories in »Offene Befunde« haben eine andere Ursache und bleiben liegen ·
    Restplan: Reihenfolge unverändert, Paket 6 ohne RES-005 und mit zwei Schnittstellen-Hinweisen
  - 2026-11-01 Zug 1: Implementierer beauftragt (opus, effort high), Brief `paket-4.impl-0.brief.txt`, Report nach `paket-4.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG (session 86ed4f78-7c76-4888-b154-802fdaba151d) · 8 geändert, 2 neu (`src/testing/stageFixtures.ts`, `StageDirector.shapes.spec.ts`) · Arbeitsbaum schmutzig · rote Läufe für alle Bugfix-Specs belegt · gemeldete Folge: `#shapesFor()` setzt `needsPicture` gefrorener Layer nicht zurück · Verify `paket-4.verify.log` exit=0
  - 2026-11-01 Zug 3: Reviewer beauftragt (opus, effort high), Diff `paket-4.diff`, Report nach `paket-4.review-0.json`
  - 2026-11-01 Zug 3: Review (session 0ce318dd) · Erfüllung: alle neun Findings und N1–N4 behoben, Abweichungen 1–6 gebilligt · 2 wichtig (`dispose()` aus einem End-Listener während `push()`/`#show()` nicht erkannt; `precompile()` verliert die von `#shapesFor()` gesammelten Fehler bei Kompilier-/Build-Fehler) · 5 klein · Diff `paket-4.diff`
  - 2026-11-01 Zug 4 Runde 1: offen 2 wichtig + eigene Folge `needsPicture` beim Renderer-Wechsel (Report impl-0) + 5 klein mitgegeben · an Implementierer per Resume (86ed4f78, opus, high), Brief `paket-4.impl-1.brief.txt`
    → zurück: FERTIG, A (auch auf `#hide()`/`replace()` ausgedehnt), B, C mit rotem Lauf, D–H erledigt · neue Nebenbefunde: Sammeltexte `:519/:1081/:1172/:1822`, `dispose()` aus `OnStageAdded`-Listener mitten in `#join()` · Verify `paket-4.verify-1.log` exit=0 · Reviewer Runde 1 beauftragt (opus, high), Diff `paket-4.diff-1`
    → Review Runde 1 (b04f730c): B–H erfüllt, A Restlücke (`push()` mit `at` nach `dispose()` aus End-Listener wirft RangeError vor dem Rückweg) · neu wichtig: Doku-Satz »a listener that disposes the director makes it answer a cancelled transition« gilt nicht für `dispose()` aus `OnStageAdded` mitten in `#join()` (vorbestehender Defekt, Nebenbefund impl-1, gleiche Ursache wie A → ins Paket) · 4 klein
  - 2026-11-01 Zug 4 Runde 2: offen A-Rest, `#join()`-Dispose samt Doku, 4 klein (davon Sammeltexte `:519/:1081/:1172/:1822`, gleiche Ursache wie D) · frischer Implementierer (opus, high, ohne Resume), Brief `paket-4.impl-2.brief.txt`
    → zurück (session 8f4ba0b7): FERTIG, Punkt 1 (`push()` mit `at`) und 2 (`#join()` antwortet `Layer | undefined` an entsorgtem Director) mit rotem Lauf, 3–6 erledigt · Verify `paket-4.verify-2.log` exit=0 · Reviewer Runde 2 beauftragt (opus, high), Diff `paket-4.diff-2`
    → Review Runde 2 (447d3a63): Punkte 1–6 erfüllt, Stack nach jedem Abbruch konsistent, »commit-fähig« · 2 klein (siehe unten), keine Runde
  - 2026-11-01 Zug 5: Commit f9a8bfde (10 Dateien, +1418/−349), getragen von `paket-4.verify-2.log` exit=0 (keine Änderung danach) · 2 Runden, 3 Implementierer-Reports (impl-0, impl-1 Resume, impl-2 frisch), 3 Reviews · Folge (`#join()` am entsorgten Director nach Slot-Masken-Join) im Plan unter `Folgen:` für Paket 6

## Urteil des Reviewers

Drei Durchgänge (`paket-4.review-0.json`, `-1`, `-2`, alle opus/high). Fundstellen im Stand von f9a8bfde
nach Review 0, nachgeführt durch Review 1/2:

- BUG-001: behoben — `StageDirector.ts` `setStack()` `#endRun(…, layers)` mit `kept`-Filter, `stays` in `#endRun()`; Spec `setStack() keeps the stage a running transition brings`
- RES-001: behoben — `DEFAULT_EFFECT`, `KEPT_SHAPES`, `#shapes: Map<string, CachedShape>`, LRU in `#currentShape()`/`#evictShapes()`, `#shapesFor()`; Guide »A pause menu over the frozen game«; `StageDirector.shapes.spec.ts`
- TEST-002: behoben — Reentrancy-Specs und Fehlerpfad/Dispose von `precompile()` in `StageDirector.spec.ts`
- ASYNC-003: behoben — Slot-Prüfung in `#hide()`/`replace()`, `#stackLocked`/`#ignoresChanges()` in `setStack()`/`dispose()`, Rückweg bei `dispose()` aus Listenern in `#show()`/`push()`/`#hide()`/`replace()` (Runde 1/2); Specs in `StageDirector.spec.ts`, `StageDirector.masks.spec.ts`
- BUG-006: behoben — `#refuseStage()`/`#refuseLayer()` in `show()`, `push()`, `replace()`, `setStack()`
- BUG-007: behoben — `push()` zeigt und friert vor `throwCollected()`
- BUG-005: behoben — `#show()` rechnet `at` nach `#finishRunsWith()`
- TEST-004: behoben — `src/testing/stageFixtures.ts`, importiert in den drei Specs
- RES-005: behoben — `#disposeShape()` mit try/catch je Aufruf, Placeholder in jedem Fall; `#lettingGoErrors` in `dispose()` übernommen (Runde 1)
- N1–N4: behoben — `#join()`-catch über `stages`, `#release()` gefangen in `#begin()`/`setStack()`, Freeze in `push()` nur bei stehenden Slots, `#advancingRuns`, `isDisposed`-Abbruch in `updateFrame()`
- Abweichungen des Implementierers 1–6 (Zug 2) gebilligt; Runde 1 dehnte den Dispose-Rückweg auf `#hide()`/`replace()` aus, Runde 2 lässt `#join()` am entsorgten Director `undefined` antworten

Kleine Befunde (offen, keine Runde):
- `StageDirector.ts:684`, `:1659-1660` — `#join()` prüft und baut nach einem Director-Dispose durch den Slot-Masken-Join weiter; mit entsorgter Effekt-Masken-Stage kommt eine Ablehnung statt eines abgebrochenen Handles (gegen `docs/stages.md:941`, Proposal §5.4). Vorschlag: `if (this.isDisposed) return undefined;` am Anfang von `#join()`. Als `Folgen:` im Plan, weil die Doku-Zusage aus diesem Paket stammt
- `StageDirector.spec.ts:777-842` — keine Specs für `hide()`/`pop()` mit Effekt-Masken, deren Join den Director entsorgt, und für `setMask()` über `OnAddToParent` (Probe des Reviewers: verhalten sich korrekt)
- Aus Review 0, in Runde 1 erledigt: Sammeltexte, »fabrics«, Kommentar »the draw goes first«, Formulierung »precompile() compiles stays until …«

## Warum ein Paket und nicht zwei

Stapel-Teil und Cache-Teil treffen sich in `dispose()` (Sperre gegen Listener, Abbau der Shapes)
und in `precompile()` (Renderer-Bindung, Fehlerpfad aus TEST-002). Zwei Implementierer
nacheinander würden dieselben Methoden zweimal umbauen. Deshalb ein Implementierer auf der
stärksten Stufe, das Vorgehen in Etappen, die jede für sich grün werden können.

## Abgleich

| Finding | Urteil | Fundstelle jetzt |
| --- | --- | --- |
| BUG-001 | unverändert | `StageDirector.ts:837` löst bekannte Layer auf (`known ?? this.#join(...)`), `:848` beendet die Runs mit `keep 'from'`, `#endRun()` gibt `to` in `:1671` frei, `:853` baut die Slots aus den freigegebenen Layern |
| RES-001 | unverändert | `:405` `effect: effect ?? crossfade()`, `:1706` `#cancelledHandle()` mit `crossfade()`, `:458` `#shapes` ohne Eviction, `:1788-1792` Einfügen, `:285` Key über `effectId()`, `transitionEffects.ts:155` neues Objekt je Aufruf; Guide `docs/stages.md:743/746/750` |
| TEST-002 | unverändert | keine Reentrancy-Specs; `compileAsync` nur mit Erfolgs-Mocks (`StageDirector.spec.ts:38`, `:455`) |
| ASYNC-003 | unverändert | `#hide()` `:683-684`, `replace()` `:710/:719`, `dispose()` `:1132-1135`, `setStack()` `:847-853` |
| BUG-006 | unverändert | `replace()` prüft vorab nur `#refuseMaskStageAsLayer()` (`:699`), die übrigen Refusals stehen in `#join()` `:1384-1398`; `push()` beendet Runs in `:750-756` vor `#show()` |
| BUG-007 | unverändert | `push()` `:763-764` wirft die Listener-Fehler vor `#show()` |
| BUG-005 | unverändert | `#show()` rechnet `at` in `:608`, beendet die Runs in `:641`, `splice()` in `:651`; `push()` rechnet in `:752` neu |
| TEST-004 | unverändert | `createRendererMock()` wortgleich in `StageDirector.spec.ts:13` und `StageDirector.masks.spec.ts:26`, `plainRenderer()` in `hot-path-allocations.director.spec.ts:29`, `fakeStage()`/`names` doppelt (`:58/:62`, `:71/:75`) |
| RES-005 | unverändert | `dispose()` `:1143-1148` ruft `pipeline.dispose()` und `effect.dispose(node)` ohne try/catch |

Nebenbefunde, im Zug 0 gefunden, vorbestehend (Datei seit d9b648bf unverändert):

- **N1, gleiche Ursache wie BUG-007** (Listener-Fehler unterbrechen eine Änderung mittendrin):
  `super.add(renderer)` in `#join()` (`:1414`) fügt den Renderer hinzu und wirft die Fehler von
  `OnStageAdded`- und `OnAddToParent`-Listenern erst danach (Vertrag von `StageRenderer#add()`).
  `#join()` hält jeden Wurf für eine Ablehnung: Der Wrapper wird disposed, der Layer nie
  eingetragen, ein Renderer des Aufrufers bleibt als Kind ohne Layer zurück. Dasselbe für
  `OnStageRemoved`/`OnRemoveFromParent`: `#release()` steht ungefangen im Sofortpfad von
  `#begin()` (`:1625`, danach fehlen `#slotsChanged()`, `settle()` und beide Events), in der
  Release-Schleife von `setStack()` (`:855-857`, danach fehlt `#slotsChanged()`) und im Rückweg
  von `setStack()` (`:842`, der Originalfehler ginge verloren). Schwere: low.
- **N2, gleiche Ursache wie ASYNC-003** (Zustand vor einem Listener-Aufruf gelesen und danach
  benutzt): `push()` friert in `:767-771` `belowLayer` ein, nachdem der Sofortpfad von `#begin()`
  Listener aufgerufen hat. Hat einer die gepushte Stage entfernt, bleibt `belowLayer` gefroren,
  und kein Slot taut ihn je wieder auf. Schwere: low.
- **N3, gleiche Ursache wie ASYNC-003**: `updateFrame()` sammelt in `:971-975` Slots und treibt in
  `:978-983` den Run, der dann in `slot.run` steht. Startet ein End-Listener eines früheren Slots
  im selben Frame eine neue Transition in einem späteren Slot, wird sie im Frame ihres Starts
  advanced. Die TSDoc und der Guide versprechen dagegen: »The frame after the call is its first
  one«. Schwere: low.
- **N4, gleiche Ursache wie ASYNC-003, Gegenstand von TEST-002**: disposed eine Stage den Director
  in ihrem `updateFrame()`, laufen die Stages dahinter in `:1006-1009` weiter. `#byRenderer` ist
  dann leer, und ein gefrorener Layer des Aufrufers wird trotzdem upgedatet. Schwere: low.
- **N5, andere Ursache, nach »Offene Befunde« (→ Scope):** Die Stage-Argumente der Methoden werden
  nicht als Objekt geprüft. `hide(undefined)` (`:672`), `replace(undefined, x)` (`:695`),
  `setMask(undefined, mask)` (`:873`) und `freeze(undefined)`/`run(undefined)` (`:902`) lesen
  `stage.name` an `undefined` und werfen einen TypeError ohne Subjekt. Das ist Eingabeprüfung, das Thema von Paket 6. Dieses Paket
  schreibt nur die neue Prüffunktion `#refuseStage()` mit `?.` (siehe Schritt 2), damit `show()`,
  `push()`, `replace(from, to)` und `setStack()` einen ungültigen neuen Layer sprechend ablehnen.

## Vorgehen

Code, Kommentare, Doku und Fehlermeldungen auf Englisch, nach AGENTS.md (»Error and warning
messages«, `#private`, `.js`-Suffix, `import type`). Keine Finding-IDs und kein Rückblick auf den
Vorzustand, weder im Code noch in der Doku (Abschnitt »Konventionen« in `./remediation-plan.md`).
Bestehende Fehlermeldungen bleiben wortgleich, wo dieser Plan keinen neuen Text nennt. Vor dem
Umbau `StageDirector.ts` ganz lesen (AGENTS.md, »Working on the library«) und für die Events die
Skill `using-eventize` laden.

### 1. Geteilte Testhilfe (TEST-004)

Neue Datei `packages/twopoint5d/src/testing/stageFixtures.ts`. Sie importiert `vi` und `type Mock`
aus `vitest`; `src/testing/` ist aus Build und Coverage ausgeschlossen.

- `export interface RendererSurface`: die Mitglieder eines `WebGPURenderer`, die der Director und
  seine Pipelines anfassen — `autoClear`, `autoClearColor`, `autoClearDepth`, `autoClearStencil`,
  `samples`, `toneMapping`, `outputColorSpace`, `xr: {enabled: boolean}`, `initialized`,
  `setClearColor(color, alpha?)`, `getClearColor(out)`, `setClearAlpha(alpha)`, `getClearAlpha()`,
  `clear(...)`, `render(scene, camera)`, `setRenderTarget(target)`, `getRenderTarget()`,
  `getPixelRatio()`, `getOutputBufferType()`, `init()`, `compileAsync(scene, camera)`.
- `export function createRendererMock()`: der heutige Inhalt von `createRendererMock()` aus
  `StageDirector.spec.ts:13-54` unverändert (vi.fn-Mitglieder, `__clearColor`, `__clearAlpha`,
  `__renderTarget`, dieselben Implementierungen), mit `satisfies RendererSurface`.
- `export function createPlainRenderer()`: der heutige `plainRenderer()` aus
  `hot-path-allocations.director.spec.ts:29-55` unverändert, dazu `init: async () => {}` und
  `compileAsync: async () => {}`, mit `satisfies RendererSurface`. Der Kommentar bleibt: einfache
  Funktionen, weil ein Mock jeden Aufruf aufzeichnet und damit alloziert. Ein Mitglied, das nur
  eine der beiden Fabriken bekommt, bricht dann den Typecheck — das ist der Zweck des Interfaces.
- `export type FakeStage`, `export function fakeStage(name)` (vi.fn wie heute),
  `export function plainStage(name)` (der heutige `stage()` der Allocation-Spec, einfache
  Funktionen), `export const names`.
- Die drei Specs importieren daraus und verlieren ihre Kopien; in der Allocation-Spec wird
  `stage(...)` zu `plainStage(...)` und `plainRenderer()` zu `createPlainRenderer()`. Die
  Kommentare »as StageDirector.spec.ts mocks them« entfallen mit den Kopien.
- Die Mocks in `StageRenderer.spec.ts`, `RootRenderPipeline.spec.ts` und
  `StageRendererTargets.spec.ts` haben eigene Vorgaben (z. B. `samples: 4`, `__clearAlpha: 0.5`)
  und bleiben, wie sie sind.

### 2. Refusals vor jeder Änderung (BUG-006)

- Neue Methode `#refuseStage(subject: string, stage: IStage): void` mit den vier Prüfungen aus
  `#join()` `:1384-1398`, in dieser Reihenfolge und mit unveränderten Meldungen: entsorgt,
  `ClearStage`, kein `renderTo()`, `#holdRefusal()`. Die Prüfung auf `isDisposed` liest
  `(stage as {isDisposed?: unknown} | undefined)?.isDisposed === true`, damit ein Nicht-Objekt bis
  zur `renderTo()`-Prüfung kommt, die es über `describeValue()` benennt.
- Neue Methode `#refuseLayer(subject, stage)`: `this.#refuseMaskStageAsLayer(subject, stage)`,
  dann `this.#refuseStage(subject, stage)`.
- `#join()`: an die Stelle von `:1382-1398` treten
  `if (role === 'layer') this.#refuseMaskStageAsLayer(subject, stage);` und
  `this.#refuseStage(subject, stage);`. Die Reihenfolge der Prüfungen bleibt dieselbe.
- In `show()` (`:585`), `push()` (`:735`), `replace()` (`:699`) und `setStack()` (`:827`) wird
  `#refuseMaskStageAsLayer(...)` zu `#refuseLayer(...)`. Die Prüfung läuft für jede Stage, auch für
  einen schon bekannten Layer; ein bekannter Layer besteht sie (er ist beigetreten und ist weder
  entsorgt noch eine `ClearStage`).

### 3. Listener-Fehler kommen nach der Änderung (BUG-007, N1)

- `#join(subject, stage, errors: unknown[], role = 'layer', scale = 1)`: neuer Pflichtparameter
  `errors` an dritter Stelle. Wirft `super.add(renderer)`, prüft der catch-Zweig, ob der Renderer
  jetzt unter `this.stages` steht (`this.stages.some((item) => item.stage === renderer)`). Steht
  er dort, war es ein Listener-Fehler: `errors.push(error)`, und `#join()` trägt den Layer ein wie
  sonst. Steht er nicht dort, ist es eine Ablehnung: Wrapper disposen, Fehler werfen, wie heute.
  Ein Kommentar sagt, warum: Die Basis fügt hinzu und wirft die Fehler ihrer Listener erst danach.
- `#useMasks(subject, masks, errors)` reicht `errors` an `#join()` weiter; `#maskSlot()` gibt
  sein `errors` weiter. Jeder Aufrufer übergibt das `errors`-Array, das er ohnehin führt (in
  `setStack()` wird es dafür vor die Join-Schleife gezogen).
- `#release()` in try/catch mit `errors.push(error)` an den drei ungefangenen Stellen: im
  Sofortpfad von `#begin()` (`:1625`), in der Release-Schleife von `setStack()` (`:855-857`) und
  im Rückweg von `setStack()` (`:842`). Im Rückweg landen die Fehler hinter dem Originalfehler:
  `[error, ...errors]`, ein einzelner unverändert, mehrere als
  `AggregateError(collected, `${subject}: more than one error on the way back from a stage that refused to join`)`.
- `#show(subject, stage, opts, options, mask, effectMasks, usesHeld, errors: unknown[])`: neuer
  letzter Parameter `errors`. `#show()` sammelt dort hinein und wirft gesammelte Listener-Fehler
  **nicht** mehr selbst; Ablehnungen wirft es weiter (mit den gesammelten Fehlern dahinter, wie
  heute in den catch-Zweigen).
- `show()` legt `const errors: unknown[] = []` an, ruft `#show(..., errors)` und danach
  `throwCollected(errors, `${subject}: more than one listener of OnStageTransitionStart and OnStageTransitionEnd threw`)`.
- `push()`: `:763-764` entfallen. `push()` reicht sein `errors` an `#show()` weiter, setzt danach
  die Freeze-Zuweisung (Schritt 4, N2) und ruft zuletzt
  `throwCollected(errors, `${subject}: more than one listener of OnStageTransitionStart and OnStageTransitionEnd threw`)`.
  Ein werfender End-Listener verhindert damit weder die neue Stage noch das Einfrieren darunter.

### 4. Der Stapel nach Listener-Rückrufen (BUG-005, ASYNC-003, N2)

- Neue Methode `#refuseDrivenMasks(subject, masks: readonly StageMask[])`: wirft für die erste
  Maske, deren `StageMaskInternals.drivenBy(mask)` nicht `undefined` ist, dieselbe Meldung wie
  `#checkEffectMasks()`: `${subject}: the mask "${mask.stage.name}" drives a transition already`.
  Aufgerufen wird sie, nachdem ein Aufruf die Runs beendet hat, die er beenden wollte. Ein Treiber,
  der dann noch steht, gehört einer Transition, die ein Listener gestartet hat.
- `#show()`: Der try/catch um `#slotIndexAt()` am Anfang (`:606-615`) entfällt. Im try-Block nach
  `this.#finishRunsWith(stage, errors)` gilt diese Reihenfolge:
  1. `if (this.#slotWithEnd(stage)) throw new Error(`${subject} cannot take the stage "${stage.name}": that stage is in the stack already`)`;
  2. `this.#refuseDrivenMasks(subject, effectMasks)`;
  3. `at = this.#slotIndexAt(subject, opts?.at)` — erst jetzt, weil ein Run, der mit nichts
     endete, seinen Slot herausgenommen hat (Kommentar dazu);
  4. `layer = this.#join(subject, stage, errors)`.

  Der catch-Zweig bleibt (Masken-Slot zurück, Mask-Uses zurück); der Text seines `AggregateError`
  wird `${subject}: more than one error on the way back from a change that was refused`. Die
  Vorabprüfung `this.#slotIndexAt(subject, opts?.at)` in `show()` (`:589`) bleibt: Ein `at`
  außerhalb des Stapels wird abgelehnt, bevor sich etwas ändert.
- `#hide()`: nach `#useMasks()` und dem Auftauen von `frozeBelow` ein try-Block um
  `if (slot.run) this.#endRun(slot, 'to', 'finished', errors)`, gefolgt von
  `if (!this.#slots.includes(slot) || slot.layer?.stage !== stage) throw new Error(`${subject} cannot hide the stage "${stage.name}": a listener of OnStageTransitionEnd changed its slot`)`
  und `this.#refuseDrivenMasks(subject, effectMasks)`. Im catch-Zweig `collected = [error, ...errors]`,
  `this.#unuseMasks(effectMasks, collected)`, dann ein einzelner Fehler unverändert, mehrere als
  `AggregateError(collected, `${subject}: more than one error on the way back from a stack a listener changed`)`.
  Erst danach `#begin()`.
- `replace()`: im bestehenden try-Block nach `#endRun()` und `#finishRunsWith(to, errors)`, vor
  `#join()`:
  `if (!this.#slots.includes(slot) || slot.layer?.stage !== from) throw new Error(`${subject} cannot replace the stage "${from.name}": a listener of OnStageTransitionEnd changed its slot`)`,
  `if (this.#slotWithEnd(to)) throw new Error(`${subject} cannot take the stage "${to.name}": that stage is in the stack already`)`,
  `this.#refuseDrivenMasks(subject, effectMasks)`. Der Text des `AggregateError` im catch-Zweig
  wird `${subject}: more than one error on the way back from a change that was refused`.
- `push()`, Freeze-Zuweisung (N2): `belowLayer` wird nur eingefroren, wenn
  `const slot = this.#slotOfLayer(this.#layers.get(stage))` existiert und
  `this.#slotOfLayer(belowLayer)` noch einen Slot findet; dann wie heute `belowLayer.frozen = true`
  und `slot.frozeBelow = belowLayer`. Hat ein Listener des Sofortwechsels die gepushte Stage oder
  den Layer darunter entfernt, friert nichts ein.

### 5. `setStack()` und `dispose()`: ganzer Stapel unter Sperre (BUG-001, ASYNC-003)

- Neues Feld `#stackLocked = 0` mit Kommentar: größer 0, solange `setStack()` oder `dispose()` den
  ganzen Stapel ersetzen; eine Änderung, um die ein Listener in diesem Fenster bittet, ändert
  nichts.
- Neue Methode `#ignoresChanges(): boolean` → `this.isDisposed || this.#stackLocked > 0`. Sie
  ersetzt den `isDisposed`-Rückweg in `show()`, `hide()`, `replace()`, `push()`, `pop()` (Rückgabe
  wie heute `#cancelledHandle(...)`) und in `setStack()`, `setMask()` (Rückgabe `this`). `add()`
  läuft über `show()` und ändert damit ebenfalls nichts. `remove()`, `freeze()` und `run()` bleiben
  wirksam: `remove()` hält das Verhältnis Kind–Parent ehrlich, auch während der Sperre.
- `#endRun(slot, keep, state, errors, stays?: readonly Layer[])`: neuer optionaler Parameter
  `stays` — Layer, die der Aufrufer gleich wieder in den Stapel setzt. Die Freigabe in `:1671`
  wird `if (left && !this.#isReferenced(left) && !stays?.includes(left))`.
- `setStack()` in dieser Reihenfolge:
  1. Prüfungen wie heute (Array, doppelte Stage, `#refuseLayer()` je Stage, Schritt 2).
  2. `const errors: unknown[] = []`, dann die Join-Schleife wie heute, mit `errors` an `#join()`.
     Rückweg wie in Schritt 3.
  3. `this.#stackLocked++`, dann `try { … } finally { this.#stackLocked--; }` um alles Weitere.
  4. Im try: `for (const slot of this.#slots.slice()) if (slot.run) this.#endRun(slot, 'from', 'cancelled', errors, layers);`
  5. `const kept = layers.filter((layer) => this.#layers.get(layer.stage) === layer);` mit
     Kommentar: Eine Stage, die ein Listener in diesem Fenster entfernt hat, bleibt draußen; kein
     Slot entsteht aus einem freigegebenen Layer.
  6. Auftauen von `frozeBelow`, `this.#slots = kept.map((layer) => ({layer}))`, `#unmaskSlot()` je
     alter Slot, Freigabe jedes Layers der Rolle `'layer'`, der nicht in `kept` steht (try/catch je
     Freigabe, Schritt 3), `this.#slotsChanged()`.
  7. Nach dem finally:
     `throwCollected(errors, `${subject}: more than one listener of OnStageTransitionEnd and OnStageRemoved threw`)`.
- `dispose()`: `this.#stackLocked++` gleich nach dem `isDisposed`-Rückweg, ohne Gegenzug (der
  Director ist danach entsorgt); der Rest folgt Schritt 7.
- TSDoc von `setStack()` und der Absatz »Events« im Guide sagen, was das für einen Listener heißt
  (Schritt 9).

### 6. `updateFrame()` (ASYNC-003 N3, TEST-002 N4)

- Neues Feld `readonly #advancingRuns: (Run | undefined)[] = []`, nach Index befüllt wie
  `#advancing` und nie gekürzt (der Kommentar über `#advancing` gilt für beide). In der
  Sammelschleife zusätzlich `advancingRuns[count] = slot.run` vor `count++`.
- In der Treiberschleife: `const run = advancingRuns[i]; advancingRuns[i] = undefined;` und
  `if (!slot || !run || slot.run !== run) continue;`. Kommentar: Ein End-Listener früher in diesem
  Frame kann den Run eines späteren Slots beendet oder ersetzt haben; ein Run, der in diesem Frame
  beginnt, hat seinen ersten Frame mit dem nächsten.
- In der Stage-Schleife am Anfang jedes Durchlaufs `if (this.isDisposed) break;`: Eine Stage, die
  den Director in ihrem `updateFrame()` disposed, beendet den Frame für die Stages dahinter.
- Beides bleibt allokationsfrei; `hot-path-allocations.director.spec.ts` hält das.

### 7. Shape-Cache: geteilter Default, LRU, Renderer-Bindung, sicherer Abbau (RES-001, RES-005)

Grundlage ist zusätzlich die Entscheidung im Plan vom 2026-10-31: Shapes und Placeholder gehören
dem Renderer, für den sie gebaut sind; wechselt er, verwirft der Director sie und baut neu.

- Modulweit in `StageDirector.ts`:
  - `const DEFAULT_EFFECT: StageTransitionEffect = Object.freeze(crossfade());` mit Kommentar:
    der Effekt jeder Transition ohne eigenen `effect`, ein Objekt, damit ihre Shapes eines sind.
  - `const KEPT_SHAPES = 16;` mit Kommentar: so viele Shapes, die der Stapel selbst gebaut hat,
    behält ein Director neben denen, die `precompile()` kompiliert hat; die zuletzt benutzte
    bleibt am längsten.
- `parseOptions()`: `effect: effect ?? DEFAULT_EFFECT`. `#cancelledHandle()`: `effect: DEFAULT_EFFECT`.
  `crossfade()` selbst bleibt eine Fabrik.
- Neues internes Interface
  `interface CachedShape { readonly shape: Shape; pinned: boolean }`, TSDoc an `pinned`: compiled
  by `precompile()`, it stays until `dispose()` or a draw with another renderer.
  `#shapes` wird `Map<string, CachedShape>` mit Kommentar: Einfügereihenfolge ist die Benutzung,
  die am längsten unbenutzte zuerst. Neues Feld `#shapesRenderer?: WebGPURenderer`.
- Neue Methode `#disposeShape(shape: Shape, errors: unknown[]): void`: `shape.pipeline.dispose()`
  und für jeden Slot mit `slot.effect?.dispose` und `slot.effectNode`
  `slot.effect.dispose(slot.effectNode)`, jeder Aufruf einzeln in try/catch mit
  `errors.push(error)`.
- Neue Methode `#shapesFor(renderer: WebGPURenderer, errors: unknown[]): void`: Ist
  `renderer === this.#shapesRenderer`, kehrt sie zurück. War ein anderer Renderer gesetzt, dann:
  `#disposeShape()` für jede Shape, `#shapes.clear()`, `#shape` und `#shapeKey` auf `undefined`,
  jeder Placeholder `dispose()`, `#placeholders.length = 0`. Danach `#shapesRenderer = renderer`.
- Neues Feld `#lettingGoErrors?: unknown[]`: Fehler aus `dispose()` von Effekten, während eine
  Zeichnung Shapes loslässt. Angelegt nur, wenn eine Shape losgelassen wird. Ein Frame ohne
  Shape-Wechsel alloziert weiterhin nichts.
- `#currentShape(renderer)`:
  - Am Anfang `if (renderer !== this.#shapesRenderer) this.#shapesFor(renderer, (this.#lettingGoErrors ??= []));`
  - Im Neuberechnungszweig: Treffer → `this.#shapes.delete(key); this.#shapes.set(key, entry);`
    (zuletzt benutzt ans Ende). Fehlschlag → `entry = {shape: this.#buildShape(renderer, kinds), pinned: false}`,
    einfügen, dann Eviction: Solange mehr als `KEPT_SHAPES` Einträge `pinned === false` haben, wird
    der älteste nicht gepinnte Eintrag, der nicht der neue ist, aus der Map genommen und über
    `#disposeShape(entry.shape, (this.#lettingGoErrors ??= []))` abgebaut.
- `renderToCurrentTarget(renderer)`: nach `super.renderToCurrentTarget(renderer)`:
  `const errors = this.#lettingGoErrors; if (errors) { this.#lettingGoErrors = undefined; throwCollected(errors, 'StageDirector: more than one effect threw from dispose() as the director let go of its shapes'); }`.
  Die Zeichnung selbst wird davon nicht aufgehalten.
- `precompile()`: in der Shape-Schleife vor `shapeKey(kinds)` `this.#shapesFor(renderer, errors)`
  (ein lokales `errors`-Array von `precompile()`). Ein Treffer setzt `cached.pinned = true` und
  überspringt die Shape; eine neue Shape geht als `{shape, pinned: true}` in die Map, dann folgt
  `#compileShape()` wie heute. Die gesammelten Fehler wirft `precompile()` über
  `throwCollected(errors, 'StageDirector#precompile(): more than one effect threw from dispose() as the director let go of its shapes')`,
  wenn es seine Arbeit getan hat, auch wenn es an einem entsorgten Director vorzeitig aufhört (die
  frühen `return`s im try werden dafür zu einem Ausstieg, der am Ende vorbeikommt). Ein
  `dispose()` während des Laufs lässt `precompile()` weiter auflösen, nicht ablehnen (Entscheidung
  »never rejects«). Was bei einer fehlgeschlagenen Kompilierung mit dem Eintrag geschieht, regelt
  Paket 6; hier bleibt er, wie er ist.
- `dispose()` (RES-005): nach dem Beenden der Runs und `super.dispose()` jede Freigabe eines
  Layers wie heute; dann `#disposeShape(entry.shape, errors)` für jeden Eintrag, `#shapes.clear()`,
  `#shape`, `#shapeKey` und `#shapesRenderer` auf `undefined`, jeder Placeholder `dispose()` in
  jedem Fall, `#placeholders.length = 0`. Der Sammeltext wird
  `'StageDirector#dispose(): more than one listener of OnStageTransitionEnd, OnStageRemoved, OnRemoveFromParent and OnStageDispose or dispose() of an effect threw'`.

### 8. Specs und Browser-Test

Bei jedem Korrektheitsfehler zuerst den Regressionstest, rot sehen, dann beheben; jeder rote Lauf
gehört in den Report. In `StageDirector.spec.ts`, wenn nicht anders gesagt; die Fixtures aus
Schritt 1.

- BUG-001: `setStack([a])`, `replace(a, b, {effect: crossfade(), duration: 1})`, `frame()`,
  `setStack([b])` → `stack` ist `['b']`, `has(b)`, `director.stages` hat Länge 1, `orderedStages`
  hat Länge 1; der nächste `frame()` ruft `b.updateFrame`, `draw()` ruft `b.renderTo`.
- BUG-005: `setStack([a, b])`, `hide(a, {effect: crossfade(), duration: 1})`, `frame()`,
  `show(a, {at: 0})` → `stack` ist `['a', 'b']`.
- BUG-006: `setStack([a])`, `replace(a, b, {duration: 1})`, `frame()`, ein Listener auf
  `OnStageTransitionEnd` zählt mit; `replace(b, new ClearStage())` wirft die ClearStage-Meldung;
  danach `transitions` mit Länge 1 und `state === 'running'`, der Zähler bei 0, `stack` ist
  `['b']`. Zweiter Fall: `push()` einer entsorgten `StageRenderer` mit `below: 'freeze'`, während
  darunter ein Run läuft → wirft »has been disposed«, der Run läuft weiter.
- BUG-007: `setStack([a])`, End-Listener wirft `new Error('listener')`, `replace(a, b, {duration: 1})`,
  `frame()`; `push(c, {below: 'freeze'})` wirft `'listener'`, danach `stack` ist `['b', 'c']` und
  `isFrozen(b)`.
- ASYNC-003:
  - `replace(a, b, {duration: 1})` läuft; ein einmaliger End-Listener ruft `director.remove(b)`;
    `hide(b, {effect: crossfade(), duration: 0.2})` wirft
    `StageDirector#hide() cannot hide the stage "b": a listener of OnStageTransitionEnd changed its slot`;
    danach `transitions` leer.
  - Derselbe Aufbau mit `replace(b, c, {effect: crossfade(), duration: 0.2})` → wirft die
    `replace()`-Meldung, `has(c)` ist `false`.
  - In `StageDirector.masks.spec.ts`: dasselbe für `hide()` mit einem Effekt, der eine Maske nennt
    → nach dem Wurf startet eine weitere Transition mit derselben Maske ohne »drives a transition
    already«.
  - `dispose()` während ein End-Listener `show(c, {effect: crossfade(), duration: 1})` ruft → der
    zurückgegebene Handle hat `state === 'cancelled'`, sein `finished` löst auf, der Director ist
    entsorgt.
  - `setStack([a])` während ein End-Listener `show(c, {effect: crossfade(), duration: 1})` ruft →
    Handle `'cancelled'`, `stack` ist `['a']`, `transitions` leer.
  - `setStack([a, b])` während ein End-Listener `director.remove(b)` ruft → `stack` ist `['a']`,
    `director.stages` hat Länge 1.
  - Zwei Slots mit laufenden Transitionen; der End-Listener des ersten, der in diesem Frame endet,
    ruft `replace()` auf die Stage des zweiten mit neuer Transition → nach diesem Frame steht die
    neue auf `'pending'`, nach dem nächsten auf `'running'`.
  - N2: `push(c, {below: 'freeze'})` ohne Transition; ein Listener auf `OnStageTransitionEnd`
    entfernt `c` → `isFrozen(b)` ist `false`.
- N1: ein `OnStageAdded`-Listener auf dem Director wirft; `show(a)` wirft diesen Fehler, und `a`
  steht im Stapel und in `orderedStages`. Ein `OnStageRemoved`-Listener wirft; `hide(a)` ohne
  Transition wirft ihn, `stack` ist leer, und ein Listener auf `OnStageTransitionEnd` hat den
  Handle mit `state === 'finished'` gesehen (der Aufruf wirft, also kommt der Handle nicht zurück).
- TEST-002 Reentrancy:
  - Verkettung: End-Listener startet bei `transition.to === b` die Folge-Transition
    `replace(b, c, {effect, duration: 0.25})`; nach den Frames ist `stack` `['c']`, beide
    `finished` lösen auf, `transitions` ist leer.
  - Start-Listener ruft `show(c)` → `c` steht im Stapel, die laufende Transition läuft weiter.
  - End-Listener ruft `director.dispose()` aus `updateFrame()` → kein Wurf, `isDisposed`.
  - `a.updateFrame` disposed den Director; `setStack([a, b])`, `frame()` → kein Wurf,
    `isDisposed`, `b.updateFrame` in diesem Frame nicht aufgerufen.
  - `a.updateFrame` ruft einmal `director.show(c)` → nach dem Frame steht `c` im Stapel,
    `c.updateFrame` erst im nächsten Frame aufgerufen.
- TEST-002 `precompile()`:
  - `renderer.compileAsync.mockRejectedValueOnce(new Error('compile failed'))` →
    `precompile(renderer, [['layer', effect]])` lehnt mit `'compile failed'` ab; danach
    `renderer.__renderTarget` wie vorher, `toneMapping`, `outputColorSpace`, `xr.enabled` wie
    vorher, `renderer.render` ist wieder der ursprüngliche Mock; `setStack([a])`, `frame()`,
    `draw()` werfen nicht.
  - `compileAsync` wartet auf ein von Hand aufgelöstes Promise; `precompile()` mit zwei Shapes
    starten, während der ersten Kompilierung `director.dispose()`, Promise auflösen → `precompile()`
    löst auf, `compileAsync` genau einmal aufgerufen, Renderer-Zustand wie vorher.
- In der neuen `StageDirector.shapes.spec.ts` (RES-001, RES-005, Renderer-Bindung):
  - Default: fünf Runden `push(c, {duration: 0.2})` und `pop({duration: 0.2})` mit Frames und
    `draw()` → jede Transition hat dasselbe `effect`-Objekt, `Object.isFrozen(effect)`, und die
    Menge der gesehenen `director.pipeline` hat Größe 3 (die Shapes `[l]`, `[l, t]`, `[l, l]`).
  - LRU: 17 Effekte, jeder mit `dispose: vi.fn()`, nacheinander `replace(…, {effect, manual: true})`,
    `draw()`, `complete()`, `draw()` → `dispose` des ersten und des zweiten Effekts je einmal mit
    seinem Node aufgerufen, des dritten nicht; derselbe erste Effekt noch einmal → sein `build`
    wird ein zweites Mal aufgerufen.
  - Pin: ein Effekt über `precompile()` kompiliert, danach 20 andere Shapes gezeichnet → sein
    `dispose` nicht aufgerufen; seine Transition danach baut nichts (`build` einmal).
  - Renderer-Wechsel: zwei Mocks; `setStack([a])`, `draw()` mit dem ersten, dann mit dem zweiten →
    `director.pipeline` ist eine andere, die alte Pipeline ist disposed (Spy auf
    `RootRenderPipeline.prototype.dispose`), ein `dispose` eines Effekts mit Node im alten Cache
    aufgerufen, der Placeholder neu über den zweiten Renderer gebaut
    (`getOutputBufferType`/`clear` des zweiten aufgerufen).
  - RES-005: zwei Shapes mit zwei eigenen Effekten, das `dispose` des ersten wirft →
    `director.dispose()` wirft genau diesen Fehler, `dispose` des zweiten Effekts aufgerufen,
    `RootRenderPipeline.prototype.dispose` zweimal aufgerufen, `isDisposed`.
- Browser (`stage-transitions.test.js`, läuft unter WebGPU und WebGL 2): »a director drawn by a
  second renderer draws its stack there«. Zweiter Container über `makeContainer({width: SIZE, height: SIZE})`,
  zweites `Display`, `await start()`. Crossfade rot → grün mit `manual: true`, `progress = 0.5`:
  einmal über `display.renderer` zeichnen und lesen, dann `director.renderTo(second.renderer)` und
  `second.renderer.readRenderTargetPixelsAsync(target, 0, 0, SIZE, SIZE)` → beide Male
  `[srgb(0.5), srgb(0.5), 0]` mit Toleranz 3 wie im Crossfade-Test. Zweites Display und Container
  im `finally` über `disposeDisplay()` und `remove()` abbauen.

### 9. Doku

- TSDoc in `StageDirector.ts`:
  - `StageTransitionOptions.effect`: »Default: one `crossfade()` the director shares among every
    transition without an effect of its own, so that they share their shapes.«
  - Klassen-TSDoc: an »builds one `RootRenderPipeline` per shape of its stack and owns them« an:
    es behält die Shapes, die `precompile()` kompiliert hat, und die 16, die es zuletzt gezeichnet
    hat; für einen anderen Renderer baut es sie neu.
  - `precompile()`: »A shape the director has already drawn or compiled is skipped« wird: Eine
    Shape, die der Director hält, wird übersprungen. Was `precompile()` kompiliert, bleibt bis
    `dispose()` oder bis zu einer Zeichnung mit einem anderen Renderer. Eine Transition ohne
    `effect` lässt sich nicht vorab benennen; wer sie vorab kompilieren will, gibt einen eigenen
    Effekt mit.
  - `setStack()`: Während es die laufenden Transitionen beendet, ändert ein Aufruf eines Listeners
    nichts: Die Methoden, die einen `StageTransition` liefern, liefern einen abgebrochenen.
    `remove()` nimmt eine Stage trotzdem heraus, und diese Stage bleibt aus dem neuen Stapel.
  - `dispose()`: dasselbe für den Abbau, dazu: Ein Effekt, dessen `dispose()` wirft, hält den
    Abbau nicht auf; die Fehler kommen danach.
  - `show()`, `hide()`, `replace()`: Hat ein Listener des Endes, das der Aufruf auslöst, den Slot
    geändert oder die Stage in den Stapel gebracht, lehnt der Aufruf mit einem Fehler ab und gibt
    zurück, was er hielt.
- `docs/stages.md`:
  - »A pause menu over the frozen game« (`:740-751`): Effekte einmal bauen
    (`const menuFade = fade();`, `const toBlack = dipToColor({color: new Color('#000')});`) und in
    `push()`, `pop()` und `replace()` wiederverwenden.
  - Optionstabelle (`:906`): `effect` → »one shared `crossfade()`«.
  - Absatz »Events« (`:921-925`): ein Listener darf den Stapel ändern. Der Aufruf, der die
    Transition beendet hat, arbeitet mit dem Stapel weiter, wie der Listener ihn hinterlassen hat.
    `show()`, `hide()` und `replace()` lehnen ab, wenn der Listener ihre Stage aus dem Slot
    genommen oder in den Stapel gebracht hat, und geben zurück, was sie hielten. Während
    `setStack()` oder `dispose()` die laufenden Transitionen beenden, liefert eine Änderung aus
    einem Listener einen abgebrochenen `StageTransition` und ändert nichts; `remove()` wirkt
    weiter.
  - Absatz nach der Effekttabelle (`:942-947`) und »What a transition costs« (`:989-998`): der
    Director behält die Shapes, die `precompile()` kompiliert hat, und die 16, die er zuletzt
    gezeichnet hat; eine ältere baut beim nächsten Besuch neu. Für einen anderen Renderer baut er
    alle neu. Eine Transition ohne `effect` nimmt den geteilten Crossfade.
  - »No hitch on the first transition« (`:787-790`): der Satz über das Überspringen wie in der
    TSDoc von `precompile()`, dazu der Satz zur Transition ohne `effect`.
  - »An effect of your own« (`:972-974`): `dispose(node)` ruft der Director, wenn er eine Shape
    loslässt — in seinem `dispose()`, wenn sie aus dem Cache fällt, und wenn er mit einem anderen
    Renderer zeichnet.
  - Fallstrick »A new effect object per transition« (`:2013-2015`): dazu, dass neben den
    vorkompilierten nur die 16 zuletzt gezeichneten Shapes bleiben.
  - Cheat-Sheet-Vorgaben (`:2078`): `crossfade()` → »one shared `crossfade()`«.
- `docs/proposals/stage-transitions.md`, Status-Zeile unverändert:
  - Abweichungsliste, zwei neue Punkte: Eine Transition ohne `effect` nimmt einen Crossfade, den der
    Director teilt (§5.1). Der Director behält die Shapes, die `precompile()` kompiliert hat, und
    die 16, die er zuletzt gezeichnet hat, und baut sie für einen anderen Renderer neu; `dispose(node)`
    eines Effekts läuft, wenn er eine Shape loslässt (§6.1, §7.1, §8).
  - §5.1 Kommentar `effect?` (`:248`): `// default: one crossfade() the director shares`.
  - §5.4 (`:329-331`): der Satz zu Listenern, die den Stapel ändern, wie im Guide.
  - §6.1 (`:366-369`), §7.1 (`:441-442`, `:475-476`) und die Tabelle in §8 (`:512`, `:515`): Cache-Grenze,
    Renderer-Bindung, wann `dispose(node)` läuft.
- `packages/twopoint5d/CHANGELOG.md`, Skill `updating-changelog`: `StageDirector` ist
  unveröffentlicht. Die Änderungen gehen deshalb in die bestehenden `Added`-Einträge unter
  `## [Unreleased]`, kein `Fixed`. Im Eintrag `add StageDirector, …`: der Director behält die
  Shapes, die `precompile()` kompiliert hat, und die 16, die er zuletzt gezeichnet hat, und baut
  sie für einen anderen Renderer neu; eine Transition ohne `effect` nimmt einen geteilten
  `crossfade()`. Im Eintrag `add StageDirector#precompile(…)`: was es kompiliert, bleibt bis
  `dispose()` oder zu einer Zeichnung mit einem anderen Renderer.

## Schnittstellen für spätere Pakete

- Paket 6 (API-002) baut auf `#ignoresChanges()` auf: Die Argumentprüfung wandert vor diesen
  Rückweg, nicht vor einen nackten `isDisposed`-Test.
- Paket 6 (ASYNC-005) legt das Promise der Kompilierung in `CachedShape` ab (neues Feld neben
  `pinned`).
- `#join(subject, stage, errors, role?, scale?)` und `#useMasks(subject, masks, errors)` haben den
  neuen Pflichtparameter `errors`.
- Testhilfe `src/testing/stageFixtures.ts`: `createRendererMock()`, `createPlainRenderer()`,
  `RendererSurface`, `fakeStage()`, `plainStage()`, `FakeStage`, `names`.

## Findings im Volltext

**BUG-001 · high · packages/twopoint5d/src/stage/StageDirector.ts:848** — setStack() darf die eintreffende Ebene einer laufenden Transition nicht freigeben
setStack() sammelt zuerst die Layer-Objekte der neuen Stages (Zeile 837, bekannte Layer werden wiederverwendet) und beendet danach jede laufende Transition als 'cancelled' mit keep 'from' (Zeile 848). #endRun() gibt dabei die Quelle 'to' frei, weil sie in keinem Slot mehr steht (Zeile 1671: #release() nimmt den Renderer aus der Basis und disposed den Wrapper). Anschließend baut setStack() die neuen Slots aus genau diesen nun freigegebenen Layer-Objekten. Ergebnis: `stack` und `has()` melden die Stage, gezeichnet wird sie nie — sie ist weder in #layers noch unter den Stages der Basis. Belegt mit einem Probe-Skript gegen dist/: setStack([a]); replace(a, b, {effect, duration: 1}); updateFrame(); setStack([b]) → stack ['b'], has(b) true, orderedStages [], stages.length 0. Der typische Pfad »Transition überspringen, Endzustand per setStack() setzen« zeigt damit ein leeres Bild.
Empfehlung: In setStack() erst die Runs beenden und danach die Layer der neuen Stages auflösen bzw. joinen — oder in #endRun() Layer, die setStack() gleich wieder braucht, nicht freigeben (z. B. die Freigabe der Quellen bis nach dem Neuaufbau der Slots aufschieben und dann über #isReferenced() entscheiden). Dazu einen Spec: setStack() mit einer Stage, die als 'to' einer laufenden Transition steht.
Umsetzung: zweite Option der Empfehlung (`stays` an `#endRun()`, Schritt 5). Die erste Option beendete die Runs vor dem Join; ein Join, der danach scheitert — eine Stage, deren `resize()` wirft —, hätte den Stapel dann schon verändert.

**RES-001 · high · packages/twopoint5d/src/stage/StageDirector.ts:405** — Shape-Cache des StageDirector begrenzen und den Default-Effekt teilen
#shapes ist ein Map ohne Eviction: jeder Shape-Key, den der Stapel je hatte, behält bis zum dispose() des Directors eine eigene RootRenderPipeline, seinen Node-Graph und seine kompilierte Material-Variante. Der Key enthält die ID des Effekt-Objekts (shapeKey(): `t${effectId(effect)}`). parseOptions() setzt ohne `effect` für jede Transition ein frisches `crossfade()` (Zeile 405), und crossfade() baut bei jedem Aufruf ein neues Objekt. Jede Transition ohne explizites Effekt-Objekt — `push(menu, {duration: 0.2})` — baut damit einen neuen Shader (Hitch im Frame des Aufrufs) und lässt eine weitere Pipeline zurück; precompile() kann diesen Default nie treffen, weil der Aufrufer das Objekt nicht kennt. Probe: 5× push/pop mit {duration: 0.2} → 5 verschiedene Effekt-Objekte. Der Guide zeigt das Muster selbst: `director.push(pauseMenu, {effect: fade(), duration: 0.2, below: 'freeze'})` erzeugt pro Pause ein neues fade(). Dazu halten verwaiste Shapes Effekte mit Masken fest, und damit StageMask, Mask-Stage und bei inWorldOf() die Szene des Aufrufers.
Empfehlung: Einen modulweiten, eingefrorenen Default-Crossfade verwenden (ein Objekt für alle Transitionen ohne `effect`, auch für #cancelledHandle()). Den Cache begrenzen: Shapes, deren Effekt in keinem laufenden Run und keiner precompile-Liste mehr vorkommt, nach einer LRU- oder Generationsregel disposen (pipeline.dispose(), effect.dispose(node)). Das Guide-Beispiel für push/pop auf einmal gebaute Effekte umstellen.
Umsetzung: LRU mit 16 nicht gepinnten Shapes, vorkompilierte gepinnt (Schritt 7). Eine Generationsregel »kein laufender Run mehr« würfe die Shape eines wiederverwendeten Effekts nach jeder Transition weg. Gerade das Muster, das der Guide empfiehlt, bekäme dann bei jedem Besuch einen neuen Shader. Kein neuer öffentlicher Export für den Default; wer ihn vorab kompilieren will, gibt einen eigenen Effekt mit (Guide und TSDoc sagen das). Dazu die Renderer-Bindung aus der Entscheidung vom 2026-10-31.

**TEST-002 · medium · packages/twopoint5d/src/stage/StageDirector.spec.ts:590** — StageDirector: Reentrancy aus Event-Listenern und Fehlerpfad von precompile() testen
Die Specs sind sonst sehr gründlich (Refusals mit Snapshot-Vergleich, Dispose, Mask-Lebenszyklus). Es fehlen aber zwei Klassen. (1) Reentrancy: Listener von OnStageTransitionEnd/-Start, die selbst show()/replace()/dispose() aufrufen (das übliche Muster, Übergänge zu verketten), sowie dispose() oder show() aus einem Stage-updateFrame() heraus. Getestet sind nur ein werfender Listener (:614) und einer, der remove() ruft (masks.spec:910). (2) precompile() bei fehlschlagendem compileAsync oder Dispose des Directors während des await: der Test 'the renderer is given back as it was' (:451-474) prüft nur den Erfolgspfad; ob renderTarget/toneMapping/outputColorSpace/xr nach einer Rejection zurückgesetzt werden, ist ungeprüft.
Empfehlung: Tests ergänzen: Listener in OnStageTransitionEnd startet die Folge-Transition und löst dispose() aus; compileAsync rejected, danach Renderer-Zustand wie vorher und Director weiter nutzbar; director.dispose() zwischen Start und Ende eines precompile().

**ASYNC-003 · medium · packages/twopoint5d/src/stage/StageDirector.ts:683** — Nach Listener-Rückrufen prüfen, ob der Slot noch im Stapel steht
Mehrere Methoden rufen #endRun() auf — das synchron OnStageTransitionEnd an Listener emittiert — und arbeiten danach mit Zustand weiter, den sie vorher gelesen haben. #hide() startet anschließend mit #begin() eine Transition auf `slot`, auch wenn ein Listener den Slot inzwischen per remove() aus #slots genommen hat; der Run hängt dann an einem abgehängten Slot, wird nie advanced, und `finished` löst nie auf (Probe: replace(a,b) läuft, Listener von dessen Ende ruft remove(b), dann hide(b, {effect, duration: 0.2}) → state nach 1 s noch 'pending', transitions []). replace() hat dasselbe Muster. dispose() und setStack() beenden die Runs über eine Kopie von #slots und überschreiben #slots danach; eine Transition, die ein Listener in diesem Fenster startet, wird ohne settle verworfen (Probe: show() im End-Listener während dispose() → 'pending' für immer). Nennt der Effekt Masken, bleibt StageMaskInternals.drivenBy auf dieser Transition stehen, und die Maske wird überall als 'drives a transition already' abgewiesen.
Empfehlung: Nach jedem #endRun()/#finishRunsWith() vor #begin() prüfen, ob `slot` noch in #slots steht und seine Quelle noch Layer ist; sonst mit einer Fehlermeldung abbrechen und die Mask-Uses zurückgeben. In dispose() und setStack() so lange Runs beenden, bis keiner mehr läuft (oder neue Änderungen während des Abbaus abweisen, etwa über ein #disposing-Flag, das show()/push()/replace() wie isDisposed behandeln). Specs mit einem Listener, der den Stapel ändert.
Umsetzung: Sperre `#stackLocked` für `setStack()` und `dispose()` (zweite Option der Empfehlung). »So lange Runs beenden, bis keiner mehr läuft« liefe beim üblichen Verkettungsmuster — ein End-Listener startet die nächste Transition — endlos.

**BUG-006 · medium · packages/twopoint5d/src/stage/StageDirector.ts:710** — Refusals von #join() vor dem Beenden laufender Transitions prüfen
Der Guide verspricht, dass eine Methode einen entsorgten Stage, einen ClearStage, den Director selbst oder einen Renderer, der ihn hält, abweist, 'before anything has changed'. replace() prüft vorab nur #refuseMaskStageAsLayer(); die Prüfungen auf isDisposed, ClearStage, renderTo() und #holdRefusal() stehen erst in #join() (Zeile 1384 ff.). Läuft im Slot von `from` eine Transition, beendet replace() sie zuerst (Zeile 710, Endzustand landet, OnStageTransitionEnd geht raus) und wirft erst danach. push() beendet ebenso Runs mit der Stage und unter 'freeze' den Run darunter (Zeile 750 ff.), bevor #show() → #join() eine ClearStage oder eine entsorgte Stage abweist. Der Aufruf scheitert, hat aber den Stapel verändert.
Empfehlung: Die stage-bezogenen Refusals von #join() (disposed, ClearStage, renderTo, #holdRefusal) in eine eigene Prüffunktion ziehen und in show(), push(), replace() und setStack() vor jeder Änderung aufrufen, wie #checkMask() es für Masken tut. Spec: replace() auf eine ClearStage, während im Slot eine Transition läuft — die Transition läuft weiter.

**BUG-007 · medium · packages/twopoint5d/src/stage/StageDirector.ts:763** — push() nach einem werfenden End-Listener nicht abbrechen
push() beendet vorab die Runs mit der Stage und unter below: 'freeze' den Run darunter. Hat dabei ein Listener von OnStageTransitionEnd geworfen, gibt push() die Mask-Uses zurück und wirft, ohne die neue Stage je zu zeigen (Zeile 763 f.). Der Guide sagt dagegen: 'A listener that throws keeps neither the other listeners, the layers nor the change of the stack from happening; its error comes out of the call afterwards.' show() hält sich daran und zeigt die Stage, erst danach kommt der Fehler. Probe: replace(a, b) läuft, End-Listener wirft; push(menu, {below: 'freeze'}) → wirft, stack ['b']; show(menu, {at: 0}) → wirft, stack ['menu', 'b']. Ein Fehler in irgendeinem Listener verhindert damit das Pausenmenü.
Empfehlung: Die gesammelten Listener-Fehler an #show() weiterreichen (ein errors-Parameter, den #show() vor dem Wurf mit den eigenen zusammenführt), statt vorher zu werfen; die Freeze-Zuweisung danach wie bisher. Spec: push() mit werfendem End-Listener zeigt die Stage und wirft danach.
Umsetzung: `#show()` wirft die gesammelten Listener-Fehler gar nicht mehr selbst, sondern seine Aufrufer. Nur so liegt die Freeze-Zuweisung in `push()` noch vor dem Wurf (Schritt 3).

**BUG-005 · medium · packages/twopoint5d/src/stage/StageDirector.ts:608** — show() mit `at` nach dem Beenden der Runs positionieren
#show() rechnet den Slot-Index für `opts.at` aus (Zeile 608), bevor #finishRunsWith(stage) Runs mit der Stage beendet (Zeile 641). Läuft gerade ein hide() der Stage, endet dieser Run mit nichts und nimmt seinen Slot heraus; der vorher berechnete Index zeigt danach einen Slot zu weit, und splice() setzt die Stage an die falsche Position. Probe: setStack([x, y]); hide(x, {effect, duration: 1}); updateFrame(); show(x, {at: 0}) → stack ['y', 'x'] statt ['x', 'y']. push() rechnet den Index nach dem Beenden neu (Zeile 752), show() nicht.
Empfehlung: Den Index in #show() erst nach #finishRunsWith() bestimmen (wie push() es tut) und eine dort geworfene RangeError wie die übrigen Rückwege behandeln. Spec: show(stage, {at}) einer Stage, deren hide() läuft.

**TEST-004 · low · packages/twopoint5d/src/stage/StageDirector.spec.ts:13** — Renderer-Mock der Director-Specs in eine geteilte Testhilfe ziehen
createRendererMock() steht wortgleich in StageDirector.spec.ts und StageDirector.masks.spec.ts (der Kommentar dort verweist auf die Schwesterdatei), eine dritte Variante plainRenderer() in der Allocation-Spec; dazu fakeStage()/names() doppelt. Ändert three die vom Director berührte Renderer-Oberfläche, müssen drei Kopien synchron nachgezogen werden, sonst driften die Mocks auseinander und ein Test grünt gegen eine nicht mehr echte Oberfläche. src/testing/ existiert bereits (measureSettledBytes).
Empfehlung: createRendererMock, fakeStage und names nach packages/twopoint5d/src/testing/ verschieben und aus allen drei Specs importieren.
Umsetzung: Die Allocation-Spec braucht Funktionen, die keine Aufrufe aufzeichnen. Deshalb zwei Fabriken in einer Datei, die beide `RendererSurface` erfüllen müssen (Schritt 1).

**RES-005 · low · packages/twopoint5d/src/stage/StageDirector.ts:1146** — Teardown in StageDirector#dispose() gegen werfende Effekt-dispose() absichern
dispose() ruft für jeden Slot jeder Shape `effect.dispose(node)` des Aufrufers und `shape.pipeline.dispose()` ohne try/catch. Wirft ein Effekt eigener Bauart, bricht die Schleife ab: die Pipelines der übrigen Shapes und alle 1×1-Placeholder-RenderTargets bleiben unreleased, #shapes wird nicht geleert, und der Fehler läuft am throwCollected() vorbei. Für Listener sammelt die Methode Fehler ausdrücklich ein (resource-lifecycle.md §4: ein Werfender hält den Teardown nicht auf).
Empfehlung: Jeden effect.dispose()- und pipeline.dispose()-Aufruf in try/catch fassen, die Fehler in `errors` sammeln und die Placeholder in jedem Fall freigeben; Spec mit einem Effekt, dessen dispose() wirft.
Hierher gezogen, weil Schritt 7 `#disposeShape()` für Eviction und Renderer-Wechsel ohnehin schreibt; `dispose()` nutzt dieselbe Hilfe.
