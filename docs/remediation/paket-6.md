# Paket 6 — Stage und Display: TSDoc und Umzugs-Tests

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: DOC-079 (info), DOC-080 (info), TEST-052 (info), TEST-053 (info)
- Dazu (Nebenbefunde aus Zug 0, gleiche Ursache — Begründung unter »Abgleich«):
  - A · low: ein `StageRenderer`, den ein Listener von `OnRemoveFromParent` beim Umzug
    disposed, bleibt am alten Host abonniert, sobald dieser Listener vor den
    Host-Abonnements registriert wurde (`StageRenderer.ts:324–339`, `:1058–1061`)
  - B · info: der dritte Abbruchgrund des Umzugs — ein Listener gibt dem Renderer einen
    anderen Halter — ist weder für `add()` noch für einen Schreibzugriff auf `parent`
    getestet (`StageRenderer.ts:1188`, `:280`)
- Ziel: Die TSDoc von `Display` und `StageRenderer#add()` steht an der richtigen Stelle
  und sagt den abgebrochenen Umzug vollständig, die Umzugs-Tests prüfen Abmeldung,
  Fehlerweitergabe und jeden Abbruchgrund, und ein Renderer, den ein Listener beim Umzug
  disposed, hängt an keinem Host mehr.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md` (nur der Fixed-Eintrag `:345`)
- Verify: `pnpm run ci` — zum Iterieren vorher
  `pnpm nx test twopoint5d -- src/stage/StageRenderer.spec.ts` und `pnpm lint`
- Commit: `fix(twopoint5d): let a StageRenderer give up its host subscriptions before OnRemoveFromParent goes out, so a listener that disposes it during a move leaves no frame loop driving it, cover the old host a write to parent leaves, the error of a move out that add() hands on when a listener ends the move, and a listener that gives the renderer another holder, let the TSDoc of add() say what a child whose move ends there keeps, and set the TSDoc of Display over its class`

## Vorgehen

Reihenfolge einhalten: erst die reinen Doku- und Testschritte (1–4), dann der Bugfix mit
rotem Lauf (5–7). Neue und geänderte Kommentarzeilen ≤ 90 Zeichen; die TSDoc von `add()`
behält die Breite ihres Blocks (≤ 76 Zeichen je Zeile). Keine Finding-ID, kein Satz über
den Vorzustand — weder im Code noch in Testnamen, CHANGELOG oder Commit-Message.

1. **DOC-079 — `Display.ts`.** Die beiden Zeilen `:592–593`

   ```ts
   // eslint-disable-next-line @typescript-eslint/no-empty-object-type
   export interface Display extends EventizedObject {}
   ```

   samt der Leerzeile danach wandern über den TSDoc-Block `:423–591`, direkt hinter
   `export type DisplayEventListener<T = DisplayEventProps> = (props: T) => unknown;`
   (`:421`), mit je einer Leerzeile davor und danach. Danach steht der Block
   `/** The \`Display\` is the entry point … */` unmittelbar über `export class Display {`.
   Das ist das Muster von `Stage2D.ts:31–45` und `StageRenderer.ts:69–116`. Am Text des
   Blocks ändert sich nichts.

2. **DOC-080 — TSDoc von `StageRenderer#add()`, `StageRenderer.ts:1149–1152`.** Der Satz
   endet heute mit »ends the call there: the child is not added.« Dahinter kommt, im
   selben Absatz und auf die Breite des Blocks umbrochen:

   > What came before stays: the child has taken the size of this renderer and has left
   > its previous holder.

   Beides stimmt für alle drei Abbruchgründe: `resizeStage()` läuft in `:1178` vor dem
   Auszug, `#removeFromParent()` in `:1185` hat den alten Halter schon verlassen. Die
   TSDoc des `parent`-Setters (`:244–260`) verweist für einen `StageRenderer` als Ziel
   ausdrücklich auf `add()` (»For a `StageRenderer` assigned here, {@link add} says the
   same«) und bleibt unverändert.

3. **TEST-052 — `StageRenderer.spec.ts:1217–1239`**, Test »a write to parent leaves a
   renderer that a listener of OnRemoveFromParent disposes off the new host«. Nach
   `expect(joined).not.toHaveBeenCalled();` (`:1232`) einfügen:

   ```ts
   expect(hostA._unsubs, 'both subscriptions to the first host given up').toBe(2);
   ```

   Der Test ist heute schon grün (sein Listener hängt hinter den Host-Abonnements, die der
   Konstruktor anlegt). Beleg ist eine Mutationsprobe: in `#addToHost()` die Abmeldung für
   `onRenderFrame` verwerfen → die neue Assertion rot (1 statt 2); Probe zurücknehmen. Den
   roten Lauf in den Report.

4. **TEST-053 und Nebenbefund B — neue Tests.** Die Tests `:978` und `:992` bleiben, wie
   sie sind: sie decken den Abbruch ohne Fehler (`not.toThrow()`). Neu dazu, alle im
   `describe('listeners that throw or dispose')` hinter `:1004` (die ersten drei) bzw. im
   `describe('parent / host wiring')` hinter `:1239` (der vierte). `makeHost()` und
   `thrownBy()` stehen oben im Spec bereit.

   a. **Ein Fehler, Kind disposed:**

   ```ts
   it('add() hands on the error of the move out when a listener disposes the child while it leaves its previous holder', () => {
     const a = new StageRenderer();
     const b = new StageRenderer();
     const child = new StageRenderer(a);
     const failure = new Error('the listener failed');
     // ahead of the listener that disposes the child: dispose() takes every listener with it
     // that the event has not reached yet
     on(child, OnRemoveFromParent, () => {
       throw failure;
     });
     on(child, OnRemoveFromParent, () => child.dispose());

     expect(thrownBy(() => b.add(child))).toBe(failure);

     expect(b.hasStage(child)).toBe(false);
     expect(a.hasStage(child)).toBe(false);
     expect(child.parent).toBeUndefined();
     expect(child.isDisposed).toBe(true);
   });
   ```

   b. **Zwei Fehler, Zielrenderer disposed:** der eine aus `OnRemoveFromParent` am Kind,
   der andere aus `OnStageRemoved` am alten Halter `a`.

   ```ts
   it('add() hands on the errors of the move out as an AggregateError when a listener disposes this renderer while the child leaves its previous holder', () => {
     const a = new StageRenderer();
     const b = new StageRenderer();
     const child = new StageRenderer(a);
     const e1 = new Error('left');
     const e2 = new Error('removed');
     on(child, OnRemoveFromParent, () => {
       throw e1;
     });
     on(child, OnRemoveFromParent, () => b.dispose());
     on(a, OnStageRemoved, () => {
       throw e2;
     });

     const error = thrownBy(() => b.add(child)) as AggregateError;

     expect(error).toBeInstanceOf(AggregateError);
     expect(error.message).toBe(
       'StageRenderer#add(): more than one listener of OnRemoveFromParent, OnStageRemoved, OnStageAdded and OnAddToParent threw',
     );
     expect(error.errors).toHaveLength(2);
     expect(error.errors[0]).toBe(e1);
     expect(error.errors[1]).toBe(e2);
     expect(b.isDisposed).toBe(true);
     expect(b.stages).toHaveLength(0);
     expect(a.hasStage(child)).toBe(false);
     expect(child.parent).toBeUndefined();
     expect(child.isDisposed).toBe(false);
   });
   ```

   c. **`add()`, anderer Halter (Nebenbefund B):**

   ```ts
   it('add() leaves out a child that a listener gives another holder while it leaves its previous one', () => {
     const a = new StageRenderer();
     const b = new StageRenderer();
     const hostC = makeHost();
     const child = new StageRenderer(a);
     on(child, OnRemoveFromParent, () => {
       child.parent = hostC;
     });

     expect(() => b.add(child)).not.toThrow();

     expect(b.hasStage(child)).toBe(false);
     expect(a.hasStage(child)).toBe(false);
     expect(child.parent).toBe(hostC);
     hostC._emitResize(80, 40);
     expect([child.width, child.height], 'the new host drives the child').toEqual([80, 40]);
   });
   ```

   d. **Schreibzugriff auf `parent`, anderer Halter (Nebenbefund B)**, in
   `describe('parent / host wiring')`:

   ```ts
   it('a write to parent leaves a renderer that a listener of OnRemoveFromParent gives another host off the host it was assigned', () => {
     const hostA = makeHost();
     const hostB = makeHost();
     const hostC = makeHost();
     const sr = new StageRenderer(hostA);
     on(sr, OnRemoveFromParent, () => {
       sr.parent = hostC;
     });

     expect(() => {
       sr.parent = hostB;
     }).not.toThrow();

     expect(sr.parent).toBe(hostC);
     expect(hostA._unsubs, 'both subscriptions to the first host given up').toBe(2);
     hostB._emitResize(10, 10);
     expect(sr.width, 'the assigned host does not reach the renderer').toBe(0);
     hostC._emitResize(80, 40);
     expect([sr.width, sr.height], 'the host the listener gave drives it').toEqual([80, 40]);
   });
   ```

   Alle vier sind auf dem jetzigen Code grün (gegen `dist/` geprobt: a wirft `failure`
   unverändert, b ein `AggregateError` mit `[e1, e2]`, c und d landen bei `hostC`).
   Mutationsproben, je einzeln, Ausgabe in den Report, danach zurücknehmen:
   - in `add()` `:1189` das `throwCollected(errors, ADD_THREW);` des Abbruchzweigs
     streichen → a und b rot;
   - in `add()` `:1188` den Operanden `|| child.#parent !== undefined` streichen → c rot;
   - im `parent`-Setter `:280` den Operanden `&& this.#parent === undefined` streichen →
     d rot.

   Testnamen dürfen länger als 90 Zeichen sein (Prettier-Breite 130, so wie die Namen um
   `:978` herum); die Kommentarzeilen darin nicht.

5. **Nebenbefund A — Regressionstests zuerst, rot sehen.** Zwei Tests, beide mit dem
   disposenden Listener **vor** den Host-Abonnements:

   a. in `describe('parent / host wiring')` hinter dem Test aus 4d:

   ```ts
   it('a write to parent takes a renderer off its host when a listener registered ahead of the host subscriptions disposes it', () => {
     const hostA = makeHost();
     const hostB = makeHost();
     const sr = new StageRenderer();
     // ahead of the host subscriptions: registered before attach()
     on(sr, OnRemoveFromParent, () => sr.dispose());
     sr.attach(hostA);

     expect(() => {
       sr.parent = hostB;
     }).not.toThrow();

     expect(sr.isDisposed).toBe(true);
     expect(hostA._unsubs, 'both subscriptions to the first host given up').toBe(2);
     const width = sr.width;
     hostA._emitResize(80, 40);
     expect(sr.width, 'the first host reaches the renderer no more').toBe(width);
   });
   ```

   b. in `describe('listeners that throw or dispose')` hinter dem Test aus 4c:

   ```ts
   it('add() takes a child off its host when a listener registered ahead of the host subscriptions disposes it', () => {
     const host = makeHost();
     const b = new StageRenderer();
     const child = new StageRenderer();
     // ahead of the host subscriptions: registered before attach()
     on(child, OnRemoveFromParent, () => child.dispose());
     child.attach(host);

     expect(() => b.add(child)).not.toThrow();

     expect(b.hasStage(child)).toBe(false);
     expect(child.isDisposed).toBe(true);
     expect(host._unsubs, 'both host subscriptions given up').toBe(2);
   });
   ```

   Vor dem Fix sind beide rot: `_unsubs` ist 0, die Handler des alten Hosts leben weiter
   (gegen `dist/` geprobt). Den roten Lauf mit Kommando und Ausgabe in den Report.

6. **Nebenbefund A — der Fix in `StageRenderer.ts`.** Die Host-Abonnements hängen heute
   als `once()`-Listener an `OnRemoveFromParent` (`#addToHost()`, `:324–339`). Ein
   Listener davor, der den Renderer disposed, ruft in `dispose()` `off(this)`
   (`:1074`), und eventize überspringt dann jeden Listener, den der Dispatch noch nicht
   erreicht hat (`docs/off.md` von `@spearwolf/eventize` 6.2.0, Abschnitt »Behavior during
   emit«). Der Fix nimmt die Abmeldung aus dem Event heraus:

   - Neues Feld direkt unter `#parent?: StageRendererParentType;` (`:124`):

     ```ts
     // the subscriptions #addToHost() took at the host that drives this renderer, given up by
     // #removeFromParent() before OnRemoveFromParent goes out rather than by listeners of that
     // event: a listener that disposes this renderer takes every listener with it that the
     // event has not reached yet
     #hostSubscriptions: StageRendererHostUnsubscribe[] = [];
     ```

     `StageRendererHostUnsubscribe` kommt als Typ-Import aus `./IStageRendererHost.js`
     in die bestehende Zeile `:30`
     (`import type {IStageRendererHost, StageRendererHostUnsubscribe} from …`).

   - `#addToHost()` wird zu:

     ```ts
     #addToHost(host: IStageRendererHost): void {
       this.#hostSubscriptions.push(
         host.onResize(({width, height}) => {
           this.resize(width, height);
         }),
         host.onRenderFrame(({renderer, now, deltaTime, frameNo}) => {
           this.updateFrame(now, deltaTime, frameNo);
           this.renderTo(renderer);
         }),
       );
     }
     ```

     `once` fällt damit aus dem eventize-Import in `:1`; der Rest der Zeile bleibt.

   - In `#removeFromParent()` (`:297–320`) direkt hinter `this.#parent = undefined;` und
     vor dem `try { emitStrict(this, OnRemoveFromParent) }`:

     ```ts
     // the host lets go before anyone hears of the move, so a listener that disposes this
     // renderer or gives it another holder finds it off the old host already. Each handle is
     // asked on its own, and what one throws waits for the caller like the error of a listener
     const hostSubscriptions = this.#hostSubscriptions;
     this.#hostSubscriptions = [];
     for (const unsubscribe of hostSubscriptions) {
       try {
         unsubscribe();
       } catch (error) {
         errors.push(error);
       }
     }
     ```

     Das Feld wird vor dem ersten Aufruf geleert: ein Listener, der dem Renderer einen
     neuen Host gibt (Test 4d), legt dessen Abonnements in das frische Array.

   - Der Kommentar über dem `emitStrict` in `#removeFromParent()` (`:306–308`) sagt
     heute, die Host-Abonnements seien Listener dieses Events. Neu:

     ```ts
     // every listener hears it, even behind one that throws. The error goes to the caller once
     // its call has run to its end
     ```

   - Der Kommentar in `dispose()` `:1058–1060` sagt heute, das Event lasse die
     Host-Abonnements los. Neu:

     ```ts
     // the parent setter refuses a disposed renderer, so the detach runs on the field itself.
     // #removeFromParent() gives up the host subscriptions from #addToHost() and emits
     // OnRemoveFromParent
     ```

   Die TSDoc von `parent`, `add()`, `remove()` und `dispose()` bleibt: sie verspricht
   schon, dass kein Host-Event einen disposed Renderer mehr erreicht (`:1005–1007`), und
   der Code hält es jetzt in jeder Reihenfolge der Listener. Eine Abmeldung, die wirft,
   nennt die TSDoc nicht — die Abmeldungen von `Display` werfen nicht, und das `catch`
   hält nur den Rest des Umzugs und des `dispose()` am Laufen, wie es der Dispatch in
   `emitStrict` bisher tat.

   Nach dem Fix: beide Tests aus 5 grün, alle aus 3 und 4 weiter grün, die übrigen
   Host-Tests (`:1022–1029`, `:1125`, `:1133–1215`, `:2640`, `:2769`, `:2792`, `:2867`)
   unverändert grün.

7. **CHANGELOG — `packages/twopoint5d/CHANGELOG.md:345`.** Der Fixed-Eintrag »fix
   `StageRenderer` for a listener of `OnStageAdded`, …« endet heute mit »no disposed
   renderer is wired into a host or takes a stage«. Dahinter, im selben Eintrag mit
   ». « angehängt und wie die übrigen Einträge ohne Schlusspunkt:

   > The host a renderer leaves lets go of it before the first listener of
   > `OnRemoveFromParent` hears of the move, so a listener that disposes the renderer
   > there leaves no frame loop driving it, wherever it stands among the listeners

   Der Eintrag steht wie alle in diesem Block auf einer einzigen Zeile. Kein weiterer
   CHANGELOG-Eintrag: DOC-079, DOC-080 und die Tests ändern nichts, was ein Konsument
   sieht. Skill `updating-changelog` beachten (nur `[Unreleased]` wird angefasst).

- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · DOC-079 unverändert (`Display.ts:423–593`) ·
    DOC-080 unverändert in der TSDoc (`StageRenderer.ts:1149–1152`), Abbruchzweig nach
    `:1186–1191` gewandert · TEST-052 unverändert (`StageRenderer.spec.ts:1217`) ·
    TEST-053 Tests unverändert (`:978`, `:992`), `throwCollected` nach
    `StageRenderer.ts:1189` gewandert · Nebenbefunde A (low) und B (info) aus Zug 0 ins
    Paket genommen · keine offenen Folgen zu verteilen (Paket 5: »Folgen: keine«),
    kein Queue-Eintrag mit gleicher Ursache · Paket 9 hängt jetzt auch an 6
    (CHANGELOG `:345`)
  - 2026-09-30 Zug 1: Implementierer beauftragt (sonnet, effort medium), Brief
    `paket-6.impl-0.brief.txt` im Arbeitsverzeichnis
  - 2026-09-30 Zug 2: Report FERTIG (session 3ed4654a) · geändert `Display.ts`,
    `StageRenderer.ts`, `StageRenderer.spec.ts`, `CHANGELOG.md` · Arbeitsbaum schmutzig ·
    Schritt-5-Tests vor dem Fix rot (0 statt 2), Mutationsproben rot · Abweichung: fünf
    Wortlaut-Kommentare auf ≤ 90 umbrochen
  - 2026-09-30 Zug 2: Verify `pnpm run ci` exit=0 (`paket-6.verify.log`, 2689 Tests)
  - 2026-09-30 Zug 3: Reviewer (opus, medium) — alles erfüllt, 0 kritisch, 0 wichtig,
    3 klein · Diff `paket-6.diff`, Report `paket-6.review-0.json`
  - 2026-09-30 Zug 4: keine Runde nötig
  - 2026-09-30 Zug 5: committet 4b9306c8 auf dem Verify-Lauf aus Zug 2

## Abgleich

Basis des Laufs ist `c82f42f7`. `git diff c82f42f7 HEAD` über `Display.ts`,
`StageRenderer.ts`, `StageRenderer.spec.ts` und `IStageRendererHost.ts` ist leer: keines
der Pakete 1–5 hat diese Dateien angefasst.

- **DOC-079 — unverändert.** `Display.ts:423–591` ist der Klassen-Block, `:592` der
  eslint-Disable, `:593` die mergende Interface-Deklaration, `:595` die Klasse.
  `Stage2D.ts:31–45` und `StageRenderer.ts:69–116` zeigen das Zielmuster.
- **DOC-080 — unverändert.** Der Satz steht in `StageRenderer.ts:1149–1152` und endet mit
  »the child is not added«. `resizeStage()` läuft in `:1178` vor dem Auszug in `:1185`,
  der Abbruchzweig steht in `:1186–1191` (Audit: `:1194–1197`). Die Empfehlung nennt nur
  die Größe; der Detailplan nimmt den verlassenen Halter in denselben Satz, weil der
  Abbruch auch ihn nicht zurücknimmt und die Tests `:978`/`:992` genau das prüfen
  (`a.hasStage(child)` ist `false`). Zur Größe bei einem 0×0-Renderer: ein neues Item
  trägt 0×0, `resizeStage()` ruft die Stage dann nicht (dokumentiert in dessen TSDoc
  `:451–456`); der neue Satz sagt dasselbe wie der Absatz »The stage gets the size of
  this renderer first« darüber und braucht keine Ausnahme, die jener nicht hat.
- **TEST-052 — unverändert.** `StageRenderer.spec.ts:1217–1239`, keine Assertion auf
  `hostA._unsubs`.
- **TEST-053 — unverändert.** Die Tests `:978` und `:992` prüfen `not.toThrow()`, keiner
  lässt beim Auszug einen Listener werfen; `throwCollected(errors, ADD_THREW)` des
  Abbruchzweigs steht in `:1189` (Audit: `:1195`). Die Empfehlung, einen werfenden
  Listener zu ergänzen, setzt der Plan als zwei neue Tests um, statt `:978`/`:992`
  umzubauen: die beiden decken den fehlerfreien Abbruch, und der soll gedeckt bleiben.
  Die Reihenfolge der Listener in 4a ist Pflicht — gegen `dist/` geprobt, wirft
  `b.add(child)` nichts, wenn der disposende Listener vor dem werfenden hängt.

### Nebenbefund A — ins Paket, gleiche Ursache wie TEST-052

Gefunden in Zug 0, vorbestehend: `51e8b330` (vor der Basis `c82f42f7`) hat den Abbruch
des Umzugs eingeführt, `git diff c82f42f7 HEAD -- …/StageRenderer.ts` ist leer.

Probe gegen `packages/twopoint5d/dist` (Skript im Scratchpad dieser Session, keine Datei
im Projekt): `new StageRenderer()`, `on(sr, OnRemoveFromParent, () => sr.dispose())`,
`sr.attach(hostA)`, `sr.parent = hostB` → `hostA` zählt 0 Abmeldungen, beide Handler
leben weiter; mit dem Listener hinter den Host-Abonnements (so wie im Test `:1217`) sind
es 2. Dasselbe für `b.add(child)` mit einem Kind an einem Host. Folge: der Host treibt
einen disposed Renderer weiter (`resize()` schreibt `width`/`height`, `updateFrame()`
und `renderTo()` laufen leer) und hält ihn im Speicher — gegen die TSDoc von `dispose()`
(»no host event reaches this renderer any more«, `:1005–1007`), den Absatz in
`src/stage/README.md:621–625` und den Fixed-Eintrag `CHANGELOG.md:345`.

Severity geschätzt: low (Leck und gebrochene Zusage, aber nur mit einem Listener, der vor
dem Anhängen an den Host registriert wurde und beim Umzug disposed). Warum in dieses
Paket: TEST-052 verlangt, dass der Test für genau diesen Pfad — ein Listener von
`OnRemoveFromParent` disposed den Renderer beim Schreibzugriff auf `parent` — die
Abmeldung vom alten Host prüft. Diese Eigenschaft hält heute nur, wenn der Listener hinter
den Host-Abonnements hängt; die Assertion allein beglaubigte einen Zufall der
Registrierungsreihenfolge. Test und Fix sind eine Ursache: die Abmeldung hängt am
Dispatch von `OnRemoveFromParent`. Der Fix bleibt in einer Datei, berührt keine
öffentliche Signatur und keine Entscheidung des Laufs.

Verworfen: die Abmeldungen als `once()`-Listener mit hoher Priorität anhängen. Ein
Listener mit gleicher oder höherer Priorität, früher registriert, stünde wieder davor.

### Nebenbefund B — ins Paket, gleiche Ursache wie TEST-053

Gefunden in Zug 0, vorbestehend (`51e8b330`, wie oben). Die TSDoc von `add()` und
`parent` sowie `CHANGELOG.md:345` nennen drei Abbruchgründe des Umzugs: ein Listener
disposed diesen Renderer, das Kind, oder gibt ihm einen anderen Halter. Getestet sind
für `add()` die ersten beiden (`:978`, `:992`), für `parent` nur der disposende
(`:1217`); `grep "another holder"` im Spec findet keinen Test. Der Operand
`child.#parent !== undefined` in `:1188` und `this.#parent === undefined` in `:280`
laufen in keinem Test auf ihren Abbruchzweig. Severity info. Gleiche Ursache wie TEST-053:
die Tests zum abgebrochenen Umzug aus dem Lauf vom 2026-09-29 lassen einen Teil des
dokumentierten Abbruchs unbelegt; die beiden Tests stehen neben denen aus TEST-053. Gegen
`dist/` geprobt: beide landen bei `hostC`, `b` bzw. `hostB` bleiben ohne den Renderer.

## Findings im Volltext

**DOC-079 · info · packages/twopoint5d/src/display/Display.ts:593** — Die Klassen-TSDoc von
Display steht über der mergenden Interface-Deklaration

Aufgefallen im Remediation-Lauf vom 2026-09-29. Die Klassen-TSDoc von `Display` steht über
`export interface Display extends EventizedObject {}` statt über der Klasse; Editoren und
API-Extraktion ordnen sie damit dem Interface zu. Bei `Stage2D` ist derselbe Versatz im
selben Lauf behoben worden.

Empfehlung: Die TSDoc direkt über die Klassendeklaration setzen und die mergende
Interface-Deklaration darunter ohne eigenen Block führen.

**DOC-080 · info · packages/twopoint5d/src/stage/StageRenderer.ts:1152** (auch `:1178`,
`:1194–1197`) — TSDoc von StageRenderer#add() verschweigt, dass die Stage schon auf die
Größe gebracht ist, wenn der Umzug abbricht

Aufgefallen im Remediation-Lauf vom 2026-09-29. `add()` ruft `resizeStage()` vor dem
Auszug eines Kind-Renderers aus seinem vorigen Halter; bricht der Umzug ab, weil ein
Listener einen der Renderer disposed oder dem Kind einen anderen Halter gibt, ist die
Größe schon gesetzt. Die TSDoc sagt nur »the child is not added«.

Empfehlung: In der TSDoc festhalten, dass die Stage in diesem Fall bereits auf die Größe
des Renderers gebracht ist.

**TEST-052 · info · packages/twopoint5d/src/stage/StageRenderer.spec.ts:1217** — Test zum
Umzug per parent-Setter prüft die Abmeldung vom alten Host nicht

Aufgefallen im Remediation-Lauf vom 2026-09-29. Der Test »a write to parent leaves a
renderer that a listener of OnRemoveFromParent disposes off the new host« prüft nicht,
dass der Renderer seine Abonnements am alten Host vollständig abgemeldet hat
(`hostA._unsubs === 2`).

Empfehlung: Die Assertion auf die Abmeldungen am alten Host ergänzen.

**TEST-053 · info · packages/twopoint5d/src/stage/StageRenderer.spec.ts:978** (auch
`:992`, `StageRenderer.ts:1195`) — Tests zum abgebrochenen Umzug in add() prüfen nicht,
dass ein Fehler aus dem Auszug beim Aufrufer ankommt

Aufgefallen im Remediation-Lauf vom 2026-09-29. Die beiden Tests zum Abbruch des Umzugs
in `add()` decken den frühen `return`-Pfad ab, prüfen aber nicht, dass ein beim Auszug
gesammelter Fehler über `throwCollected()` beim Aufrufer ankommt.

Empfehlung: Einen werfenden Listener des Auszugs ergänzen und den geworfenen Fehler beim
Aufrufer assertieren.

## Urteil des Reviewers (Zug 3)

- DOC-079 behoben — `Display.ts:423–424` Interface-Deklaration hinter `DisplayEventListener`,
  TSDoc unmittelbar über `export class Display {` (`:598`), Text unverändert
- DOC-080 behoben — `StageRenderer.ts:1164–1165`, gilt für alle drei Abbruchgründe
  (`resizeStage()` `:1192` vor dem Auszug `:1199`)
- TEST-052 behoben — `StageRenderer.spec.ts:1317` prüft `hostA._unsubs` auf 2
- TEST-053 behoben — `StageRenderer.spec.ts:1006` (ein Fehler, Kind disposed), `:1025`
  (`AggregateError` `[e1, e2]`, Zielrenderer disposed); `:978`/`:992` unverändert
- Nebenbefund A behoben — `StageRenderer.ts:130` (Feld), `:313–324` (Abmeldung vor dem
  `emitStrict`), `:343–352` (`#addToHost()`); Tests `spec:1081`, `spec:1344`
- Nebenbefund B behoben — `spec:1063` (`add()`), `spec:1325` (`parent`)

Kleine Befunde:

- `StageRenderer.ts:344–351` — ein `push()` mit beiden Handles; wirft `onRenderFrame()`,
  geht der Handle von `onResize()` verloren (nur theoretisch, `Display` wirft nicht) →
  Folge im Plan
- `StageRenderer.ts:299`, `:1091`, `ADD_THREW` `:60` — die Aggregat-Messages sagen »more
  than one listener … threw«, eine werfende Host-Abmeldung ist kein Listener; vom
  Detailplan bewusst hingenommen
- `StageRenderer.spec.ts` — kein Test für den `catch` einer werfenden Abmeldung
  (`StageRenderer.ts:321–323`) → Folge im Plan
