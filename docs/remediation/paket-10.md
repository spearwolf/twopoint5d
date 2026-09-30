# Paket 10 — StageRenderer: jeden Host-Handle buchen, sobald er genommen ist

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nachtragspaket aus den Folgen von Paket 6, geschnitten in Zug 0 Paket 7)
- Folge von: Paket 6
- Ziel: `StageRenderer#addToHost()` bucht jeden Host-Handle einzeln, so dass ein werfendes
  `host.onRenderFrame()` den schon genommenen `onResize()`-Handle nicht verliert, und die
  Abmeldeschleife in `#removeFromParent()` ist samt ihrem `catch` getestet.
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/stage/StageRenderer.ts`,
  `packages/twopoint5d/src/stage/StageRenderer.spec.ts`,
  `packages/twopoint5d/src/stage/README.md` (Abschnitt »Custom host«),
  `packages/twopoint5d/CHANGELOG.md` (Fixed-Eintrag `:346`)
- Verify: `pnpm run ci`
- Commit: `fix(stage): let a StageRenderer book each subscription at its host as soon as the
  host hands it out, so a host whose onRenderFrame() throws gets its onResize() subscription
  back once the renderer moves on, let the AggregateError messages of add(), a write to parent
  and dispose() count an unsubscribe of the host that throws, say in their TSDoc, the custom
  host section of the stage docs and the CHANGELOG that such an unsubscribe does not keep the
  renderer on the other event of the host, and cover the unsubscribe loop behind a host that
  throws through add(), detach(), a write to parent and dispose()` (eine Zeile, ohne
  Umbruch)

## Vorgehen

Lies vorher `AGENTS.md` und in `StageRenderer.ts` die Zeilen `:120–135`, `:249–365`,
`:1004–1095` und `:1133–1299` im Ganzen, in `StageRenderer.spec.ts` `makeHost()` (`:127–166`),
`describe('parent / host wiring')` (`:1091–1364`) und die Dispose-Tests `:2960–3025`. Die
Zeilennummern gelten für `b8868b16`.

1. **`makeHost()` lernt werfen** (`StageRenderer.spec.ts:127`). Neuer, optionaler Parameter;
   der Rückgabetyp (`:127–131`, `IStageRendererHost & {_emitResize; _emitFrame; _unsubs}`)
   bleibt wörtlich:

   ```ts
   function makeHost(failures: {onRenderFrame?: Error; unsubscribeResize?: Error; unsubscribeFrame?: Error} = {})
   ```

   - `onRenderFrame`: ist `failures.onRenderFrame` gesetzt, wirft der Aufruf diesen Fehler,
     bevor er einen Handler annimmt — kein Handler, kein Unsubscribe.
   - `makeUnsub(forget, failure?: Error)`: zählt den Aufruf (`unsubs += 1`) wie bisher; ist
     `failure` gesetzt, wirft es ihn danach **ohne** `forget()` — ein Host, dessen Abmeldung
     scheitert, behält seinen Handler. `onResize` reicht `failures.unsubscribeResize` durch,
     `onRenderFrame` `failures.unsubscribeFrame`.
   - Einen Satz Kommentar über die Signatur, was die drei Schlüssel bewirken (≤ 90 Zeichen je
     Zeile). Alle bestehenden Aufrufe `makeHost()` bleiben unverändert.

2. **Regressionstest zuerst, rot sehen** — in `describe('parent / host wiring')`, ans Ende
   (nach dem Test, der bei `:1346` beginnt und `:1363` endet):

   `it('a host whose onRenderFrame() throws gets its onResize() subscription back once the renderer moves on', …)`

   ```ts
   const failure = new Error('the host refused the frame handler');
   const hostA = makeHost({onRenderFrame: failure});
   const hostB = makeHost();
   const sr = new StageRenderer();
   expect(thrownBy(() => sr.attach(hostA))).toBe(failure);

   sr.attach(hostB);

   expect(hostA._unsubs, 'the onResize subscription given up').toBe(1);
   hostA._emitResize(80, 40);
   expect(sr.width, 'the first host reaches the renderer no more').toBe(0);
   hostB._emitResize(80, 40);
   expect([sr.width, sr.height], 'the new host drives it').toEqual([80, 40]);
   ```

   Über `attach()`, nicht über den Konstruktor (der Konstruktor wirft, der Renderer ist dann
   unerreichbar — das ist der Nebenbefund unten). Der Test sagt bewusst **nichts** über
   `sr.parent` nach dem ersten `attach()`: welcher Halter nach einem werfenden `onRenderFrame()`
   gilt, ist der Nebenbefund unten und wird nicht hier festgeschrieben. Vor dem Fix rot
   (`hostA._unsubs` 0 statt 1) — Kommando und Ausgabe in den Report:
   `pnpm nx test twopoint5d -- src/stage/StageRenderer.spec.ts`.

3. **Der Fix** in `#addToHost()` (`StageRenderer.ts:343–353`): zwei getrennte `push()`, der
   erste mit dem Handle von `host.onResize(…)`, der zweite mit dem von
   `host.onRenderFrame(…)`; die Handler-Körper bleiben wörtlich. Darüber dieser Kommentar
   (≤ 90 Zeichen je Zeile umbrechen):

   ```ts
   // each handle is booked as soon as the host hands it out: a host whose onRenderFrame()
   // throws still gets its onResize() subscription back once this renderer leaves it
   ```

   Danach ist der Test aus Schritt 2 grün. An `set parent`, am Konstruktor und an
   `#removeFromParent()` ändert dieser Schritt nichts.

4. **Die Meldungen zählen die Abmeldung mit.** Paket 6 hat den `catch` um jede Abmeldung
   eingeführt (`:318–324`); ein solcher Fehler landet in denselben `errors` wie die der
   Listener, und die Sammelmeldung behauptete dann »more than one listener … threw«, wo nur
   ein Listener und der Host geworfen haben. Neue Texte, wörtlich:

   - `ADD_THREW` (`:59–60`):
     `'StageRenderer#add(): more than one listener of OnRemoveFromParent, OnStageRemoved, OnStageAdded and OnAddToParent or unsubscribe of the previous host threw'`
   - `set parent` (`:299`):
     `'StageRenderer#parent: more than one listener of OnRemoveFromParent, OnStageRemoved and OnAddToParent or unsubscribe of the previous host threw'`
   - `dispose()` (`:1091`):
     `'StageRenderer#dispose(): more than one listener of OnStageRemoved, OnRemoveFromParent and OnStageDispose or unsubscribe of the host threw'`
   - `remove()` (`:1295`) bleibt: ein Kind, das `remove()` loslässt, steht an einem
     `StageRenderer`, nie an einem Host, und hat keine Host-Abonnements.

   Die fünf Specs, die die drei alten Texte wörtlich prüfen, ziehen mit:
   `StageRenderer.spec.ts:971`, `:1044` (add), `:1293` (parent), `:2984`, `:3014` (dispose).
   `:909` und `:3020` (remove) bleiben.

5. **Die Abmeldeschleife samt `catch` testen** — vier Tests, Namen wörtlich. Die ersten drei
   ans Ende von `describe('parent / host wiring')` hinter den Test aus Schritt 2, der vierte in
   `describe('dispose()')` direkt hinter dem Test
   `'errors from several parts of the teardown reach the caller as an AggregateError in the order they arose'`
   (`:2960`). Überall wirft die **erste** Abmeldung der Schleife (`unsubscribeResize`), damit
   der Test belegt, dass die Schleife hinter ihr weiterläuft.

   a. `'detach() from a host whose unsubscribe throws gives up the other subscription, sends OnRemoveFromParent and hands the error on'` —
      `makeHost({unsubscribeResize: failure})`, `new StageRenderer(host)`, ein `fakeStage('s')`
      hinzufügen, `vi.fn()` an `OnRemoveFromParent`. Erwartet: `thrownBy(() => sr.detach())`
      ist `failure` (derselbe Fehler, kein `AggregateError`), `host._unsubs` 2,
      `sr.parent` `undefined`, der Listener genau einmal gerufen, nach
      `host._emitFrame(1, 0.016, 1)` ist `stage.renderTo` nicht gerufen.
   b. `'a write to parent hands on the error of an unsubscribe of the previous host ahead of those of the listeners'` —
      `hostA = makeHost({unsubscribeResize: eU})`, `hostB = makeHost()`,
      `new StageRenderer(hostA)`, Listener an `OnRemoveFromParent` wirft `eP`, an
      `OnAddToParent` wirft `eA`. `sr.parent = hostB` wirft einen `AggregateError` mit der
      neuen `parent`-Meldung aus Schritt 4 und `errors` genau `[eU, eP, eA]`; danach
      `sr.parent` ist `hostB`, `hostA._unsubs` 2, `hostB._emitResize(80, 40)` setzt
      `[sr.width, sr.height]` auf `[80, 40]`.
   c. `'add() takes a child off a host whose unsubscribe throws and hands the error on'` —
      `host = makeHost({unsubscribeResize: failure})`, `child = new StageRenderer(host)`,
      ein `fakeStage('inner')` in `child`, `root = new StageRenderer()`. Erwartet:
      `thrownBy(() => root.add(child))` ist `failure`, `root.hasStage(child)` `true`,
      `child.parent` ist `root`, `host._unsubs` 2, nach `host._emitFrame(1, 0.016, 1)` sind
      `inner.updateFrame` und `inner.renderTo` nicht gerufen.
   d. `'dispose() gives up the other subscription at a host whose unsubscribe throws and hands the error on between those of the stages and of OnRemoveFromParent'` —
      `h = makeHost({unsubscribeResize: eU})`, `new StageRenderer(h)`, eine Stage
      `fakeStage('a')`, Listener an `OnStageRemoved` wirft `eS`, an `OnRemoveFromParent`
      `eP`, an `OnStageDispose` `eD`. `sr.dispose()` wirft einen `AggregateError` mit der
      neuen `dispose()`-Meldung aus Schritt 4 und `errors` genau `[eS, eU, eP, eD]`; danach
      `sr.isDisposed` `true`, `h._unsubs` 2. (Kein `_emitFrame`-Check: ein disposter Renderer
      zeichnet ohnehin nichts, die Zeile bewiese nichts.)

   Diese vier decken einen schon vorhandenen `catch` ab und können vor keinem Fix rot sein.
   Beleg ist eine **Mutationsprobe**: den `try`/`catch` in der Schleife von
   `#removeFromParent()` (`:318–324`) vorübergehend entfernen, so dass `unsubscribe()` nackt
   läuft → a, b, c und d müssen rot werden; Ausgabe in den Report, dann zurückstellen.

6. **TSDoc**, jeweils nur der genannte Absatz; seine Breite halten (die Blöcke dieser Datei
   laufen bis 99 Zeichen, keine Zeile über 100), die übrigen Absätze nicht neu umbrechen.

   - `parent` (`:260–266`): hinter »… in the order they arose.« (`:264`), vor »A listener
     that disposes this renderer …«, einfügen:
     »An unsubscribe of the host this renderer leaves that throws is taken the same way: the
     renderer gives up its other subscription there all the same, and the error joins those
     of the listeners, ahead of them.«
   - `add()` (`:1156–1166`): hinter »… in the order they arose.« (`:1161`), vor »The size
     stays the exception …«, einfügen:
     »An unsubscribe of the host a child leaves that throws is taken the same way: the child
     gives up its other subscription there all the same, and the error joins those of the
     listeners, ahead of them.«
   - `dispose()` (`:1029–1038`): in der Reihenfolge-Aufzählung wird aus »then those of
     leaving the holder — of the `OnRemoveFromParent` listeners here, then of the `remove()`
     of a parent `StageRenderer`;« der Text »then those of leaving the holder — of an
     unsubscribe of the host that threw, then of the `OnRemoveFromParent` listeners here,
     then of the `remove()` of a parent `StageRenderer`;«. Ans Ende desselben Absatzes (hinter
     »… or when both events of a `remove()` did.«) der Satz: »An unsubscribe of the host that
     throws holds up nothing either: the renderer gives up its other subscription there all
     the same.«

7. **Stage-README, Abschnitt »Custom host«** (`packages/twopoint5d/src/stage/README.md:588`):
   hinter den Codeblock (`:603`), vor das `---`, einen Absatz, bei ≤ 90 Zeichen umbrochen:

   »The renderer books each unsubscribe as soon as the host hands it out and calls it once
   when it leaves the host — through a write to `parent`, `attach()`, `detach()`, an `add()` to
   a `StageRenderer` or `dispose()` — before `OnRemoveFromParent` goes out. An unsubscribe that
   throws does not keep the renderer from giving up its other subscription; its error reaches
   the caller of that call together with those of the listeners — one unchanged, several as an
   `AggregateError`.«

8. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md:346`, der Fixed-Eintrag »fix `StageRenderer`
   for a listener of …«, eine lange Zeile ohne Schlusspunkt): an ihr Ende, hinter »… wherever
   it stands among the listeners«, anhängen:
   ». An unsubscribe of that host that throws does not keep the renderer from giving up its
   other subscription there, and its error reaches the caller with those of the listeners«
   — wieder ohne Schlusspunkt. Kein eigener Eintrag für die Buchung aus Schritt 3: der letzte
   Release 0.21.2 (62174770) buchte jeden Handle sofort über ein eigenes `once()`, den
   Verlust gab es nur im `[Unreleased]`-Stand (seit 4b9306c8). Keinen Migration-Guide-H4.

9. `pnpm format`, dann `pnpm run ci`.

Nicht in diesem Paket: was `set parent` und der Konstruktor tun, wenn `host.onResize()` oder
`host.onRenderFrame()` wirft (Halter, `OnAddToParent`, verlorene gesammelte Fehler) — das ist
der Nebenbefund in »Offene Befunde« und wird in der Drain-Runde entschieden.

## Abgleich

- **Fundstelle 1** `StageRenderer.ts:344–351` — unverändert an `:343–353`: ein `push()` mit
  beiden Aufrufen als Argumenten; wirft `host.onRenderFrame()`, ist `onResize()` abonniert, der
  Handle aber nie in `#hostSubscriptions`. Vor diesem Lauf nicht so: 5738b5e5~1 und 0.21.2
  (62174770) banden jeden Handle einzeln per `once(this, OnRemoveFromParent, …)`, der erste
  stand also, bevor `onRenderFrame()` lief. Folge von Paket 6 bestätigt.
- **Fundstelle 2** `StageRenderer.ts:318–324` — unverändert: Schleife mit `try`/`catch` je
  Handle, Fehler in `errors`. `makeHost()` an `:127` kennt keinen werfenden Host; kein Spec
  ruft den `catch` (`grep` auf `_unsubs` zeigt nur Zählungen ehrlicher Abmeldungen).
- **Symptom derselben Ursache, neu in Zug 0** — der `catch` aus 4b9306c8 wurde nicht zu Ende
  geführt: die Sammelmeldungen von `add()` (`:60`), `parent` (`:299`) und `dispose()`
  (`:1091`) nennen nur Listener, die TSDoc von `parent`, `add()` und `dispose()`, die
  Stage-README und der CHANGELOG-Eintrag `:346` sagen nichts über eine Abmeldung, die wirft.
  Prüffrage: hätte Paket 6 seine Ursache zu Ende gebracht, stünde das — Schritte 4, 6, 7, 8.
  Gleicher Fall wie die ungetestete Fundstelle 2, daher hier und nicht als neues Paket.
- **CHANGELOG-Prüfung** (aus dem Plan): für die Buchung kein Eintrag nötig (siehe Schritt 8);
  für die werfende Abmeldung ein angehängter Satz am bestehenden Fixed-Eintrag.

## Offene Folgen und Queue

- `Folgen:` unter erledigten Paketen: Paket 6 → hier (beide Fundstellen); Paket 1–5 und 7
  tragen keine offenen mehr (alle schon verteilt).
- »Offene Befunde«: kein Eintrag betrifft `src/stage/` — keiner teilt die Ursache.
- **Neuer Nebenbefund** (vorbestehend, in »Offene Befunde« mit `→ Scope`, low): wirft
  `host.onResize()` oder `host.onRenderFrame()`, hat `set parent` den Host schon als `#parent`
  gesetzt (`:287`), der Fehler aus `#addToHost()` (`:289`) läuft ungesammelt heraus — die
  Fehler der Abmeldungen und der `OnRemoveFromParent`-Listener aus demselben Aufruf gehen
  verloren, `OnAddToParent` geht nie aus, `parent` antwortet den Host; über den Konstruktor
  (`:360–365`) bleibt das schon genommene Abonnement mit einem unerreichbaren Renderer am Host.
  Schon in 5738b5e5~1 (`:283`, Konstruktor `:347`) und in 0.21.2 (`#addToParent()`). Eigene
  Ursache: der Fehlervertrag des Setters erfasst das Abonnieren nicht, nicht die Buchung der
  Handles. Die Buchung aus Schritt 3 hält unter jedem späteren Vertrag (Rückbau oder
  Sammeln), und der Test aus Schritt 2 legt `parent` nach dem Wurf bewusst nicht fest. `Display` wirft hier
  nie (`Display.ts:2046–2048` sind reine `on()`-Aufrufe) — nur ein eigener
  `IStageRendererHost` trifft ihn.

## Fundstellen im Volltext

**Aus den Folgen von Paket 6 (Review von 4b9306c8), beide klein:**

`packages/twopoint5d/src/stage/StageRenderer.ts:344–351` — `#addToHost()` legt beide Handles
in einem `push()` ab; wirft `host.onRenderFrame()`, geht der schon genommene Handle von
`onResize()` verloren (zwei getrennte `push()`). Wirft `host.onRenderFrame()`, ist `onResize()`
schon abonniert, sein Handle aber nie in `#hostSubscriptions`, und der Renderer bleibt nach
dem nächsten Umzug am Resize des alten Hosts (vor 4b9306c8 registrierten zwei `once()`-Aufrufe
den ersten Handle sofort).

`packages/twopoint5d/src/stage/StageRenderer.ts:318–324` — der `catch` (`:321–323`) um eine
werfende Host-Abmeldung in `#removeFromParent()` ist ungetestet: die übrigen Handles gehen
trotzdem ab, `OnRemoveFromParent` geht trotzdem aus, der Fehler erreicht den Aufrufer;
`makeHost()` in `StageRenderer.spec.ts:127` kennt noch keinen werfenden Host.

## Verlauf

- 2026-09-30 Zug 0: Detailplan steht · Fundstelle 1 unverändert (`:343–353`), Regression erst
  seit 4b9306c8 (0.21.2 und 5738b5e5~1 buchten je `once()`) · Fundstelle 2 unverändert
  (`:318–324`), ungetestet · dazu als Symptom: drei Sammelmeldungen, TSDoc `parent`/`add()`/
  `dispose()`, Stage-README »Custom host«, CHANGELOG `:346` · CHANGELOG: nur ein Satz am
  Fixed-Eintrag `:346` · neuer Nebenbefund (werfendes Abonnieren im Setter/Konstruktor) →
  »Offene Befunde«, low → Scope · Restplan: Paket 9 hängt jetzt auch an 10 (Satz am
  CHANGELOG-Eintrag `:346`); Reihenfolge 10 → 8 → 9 bleibt, Paket 8 berührt
  `src/stage/README.md` nicht
- 2026-09-30 Zug 1: Implementierer beauftragt, Runde 0, sonnet (mittlere Stufe), Effort medium
- 2026-09-30 Zug 2: Report FERTIG · `StageRenderer.ts`, `StageRenderer.spec.ts`,
  `src/stage/README.md`, `CHANGELOG.md` · Regressionstest vor dem Fix rot (`_unsubs` 0
  statt 1) · Mutationsprobe: a–d rot · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0
  (`/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad/paket-10.verify.log`)
- 2026-09-30 Zug 3: Reviewer beauftragt, Runde 0, sonnet, Effort medium · Diff `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad/paket-10.diff`
- 2026-09-30 Zug 3: Reviewer-Urteil: erfüllt, kein kritisch/wichtig, vier klein · Diff
  `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad/paket-10.diff`
- 2026-09-30 Zug 4: entfällt, keine Runde
- 2026-09-30 Zug 5: committet 6861f3d0 (`fix(stage): …`, Trailer `Remediation-Run:
  2026-09-30`) auf dem Verify aus Zug 2 (`/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad/paket-10.verify.log`, exit=0)

## Urteil des Reviewers

- Fundstelle 1 (Buchung in `#addToHost()`): behoben — `StageRenderer.ts:346–360`, zwei
  `push()`, Kommentar darüber; Regressionstest `StageRenderer.spec.ts:1372`
- Fundstelle 2 (`catch` der Abmeldeschleife): behoben — Schleife `StageRenderer.ts:321–327`,
  Tests `StageRenderer.spec.ts:1388` (detach), parent-Test dahinter, `:1435` (add),
  `:3082` (dispose); `makeHost(failures)` an `:127`
- Sammelmeldungen: behoben — `StageRenderer.ts:60`, `:302`, `:1100`; `remove()` `:1307`
  bleibt
- TSDoc `parent` (`:264–267`), `add()` (`:1170–1173`), `dispose()` (`:1040–1046`): behoben,
  Reihenfolge stimmt mit dem Code
- Stage-README »Custom host«: behoben — `src/stage/README.md:605–610`
- CHANGELOG: behoben — Satz am Fixed-Eintrag `:346`, ohne Schlusspunkt

Kleine Befunde:
- `StageRenderer.ts:1173–1175` — `add()`-TSDoc-Absatz nach dem Einschub ausgefranst (»… is
  not added. A« am Zeilenende, dann eine kurze Zeile) → Folge im Plan
- `src/stage/README.md` »Resource lifecycle« (`:614ff`, `dispose()`-Punkt) nennt nur
  werfende Listener als nach dem Teardown gemeldet, nicht die werfende Host-Abmeldung → Folge
  im Plan
- `CHANGELOG.md:346` — der Fixed-Eintrag wird noch länger; Paket 9 glättet
- `IStageRendererHost.ts` — der Host-Vertrag sagt nicht, dass eine werfende Abmeldung
  aufgefangen wird (optional)

Abweichungen des Implementierers: `dispose()`-TSDoc-Absatz neu umbrochen (der Einschub hätte
die Zeilen gesprengt); README bei 90 Zeichen umbrochen, Wortlaut unverändert.
