# Paket 3 — StageRenderer und seine Stages: Beziehung, Transaktionen, Iteration, Lesesicht

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ARCH-007 (medium), BUG-098 (low), ASYNC-002 (low), API-064 (low), DOC-027 (low), DOC-028 (low), TEST-031 (info), TEST-048 (low)
- Dazu im Paket:
  - DOC-066 (low) aus dem Audit — dieselbe Ursache wie TEST-048 (Verweise auf nummerierte Abschnitte eines Dokuments, das es nicht gibt), liegt unter `src/stage/**` und damit unter der Scope-Regel; im Audit ohne `component` und darum von der Scope-Auswahl »Komponente stage« nicht erfasst — Schritt 8
  - vorbestehend, dieselbe Ursache wie TEST-048: `StageRenderer.ts:624` (»Mode C (§6.4)«), `:690` (»Mode D (§6.2)«) und der describe-Name `StageRenderer.spec.ts:556` (»(3.7)«), alle drei schon in `5ff01ea2` — Schritt 8
  - aus »Offene Befunde«: der `buildOutputNode`-Setter ohne Disposed-Guard (`StageRenderer.ts:495`, Queue-Zeile sagt noch `:488`) — Schritt 5
  - aus »Offene Befunde«: der Modus-C-Test `'invalidateOutputNode() forces a rebuild on next render'` im falschen `describe` (`StageRenderer.spec.ts:1415`, Queue-Zeile sagt noch `:1398`) — Schritt 8
  - Folge aus Paket 2 (Symptom der Modus-C-Doku von Paket 1, Nachtragspaket hier zusammengelegt): der Kommentar `StageRenderer.ts:662` — Schritt 9
- Ziel: Ein `StageRenderer` kennt seine Stages zweiseitig (Parent, Dispose-Austrag), `add()` ist transaktional, beide Frame-Pfade iterieren einen stabilen Schnappschuss, und die Stage-Liste ist nach außen nur lesbar und vollständig dokumentiert.
- Modell: stärkste Stufe (`opus`)
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts` (nur die TSDoc von `dispose()`)
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  - `packages/twopoint5d/CHANGELOG.md` (Abschnitt `[Unreleased]` samt dessen `### Migration Guide`)
- Verify: `pnpm run ci`
  (während der Arbeit schneller: `pnpm nx test twopoint5d -- src/stage/StageRenderer.spec.ts src/stage/Stage2D.spec.ts src/stage/Canvas2DStage.spec.ts`; die Browser-Tests laufen nur über `pnpm test:browser` gegen die gebaute Library, also vorher `pnpm build:twopoint5d`)
- Commit: `fix!: let a StageRenderer take a renderer it adds as its child and let go of a stage that is disposed, emit a dispose event from StageRenderer#dispose(), release the pass target of a disposed child once, add no stage that refuses the size or has been disposed, let updateFrame(), renderTo() and resize() go through the stages as they stood when the call began, hand out stages and orderedStages read-only and renderOrderArray as a copy, let a disposed renderer answer undefined for buildOutputNode and take no new one, document the protected hooks and the parent accessor, and name the render modes instead of numbered sections in the stage docs and specs`
  (Zug 3: `fix!:` statt `fix:` — zwei Migration-Guide-Abschnitte für Breaking Changes, Repo-Stil wie `98f2f561`; dazu die doppelte Freigabe und die `parent`-TSDoc aus Zug 2/4)
- Vorgehen (Zeilen: Stand `59424ef0`):
  1. **Stage-Liste privat, Lesesichten** (API-064, DOC-027).
     - Das Feld `readonly stages: StageItem[] = []` (`:176-180`) wird das private Feld `readonly #stages: StageItem[] = []` plus Getter `get stages(): ReadonlyArray<StageItem>`, der `this.#stages` selbst zurückgibt (lebende, nur lesbare Sicht, keine Kopie). Jede interne Stelle liest und schreibt `this.#stages`: `resize()` `:337`, `:361`, `:381`; `renderOrder`-Setter `:203`; `orderedStages` `:928`, `:935`, `:968`; `#hasOrderedStageNames()` `:975-977`; `#warnAboutSharedNames()` `:990`; `#getIndex()` `:1006`; `add()` `:1034`; `remove()` `:1068`; `dispose()` `:890`.
     - TSDoc am Getter statt `:176-179` (ersetzt den Verweis auf das nicht existierende `getOrderedStages()`), sinngemäß: »Every stage of this renderer, in the order they were added — a read-only view of the live list; {@link add} and {@link remove} are the only way in and out. The order in which the stages update and draw is {@link orderedStages}: a stage that {@link renderOrder} does not place is in here and not there, and {@link resize} reaches it all the same.«
     - `renderOrderArray` (`:216-226`): die Cache-Logik wandert in eine private Methode `#getRenderOrderArray(): string[]`; der öffentliche Getter gibt `this.#getRenderOrderArray().slice()` zurück, Rückgabetyp bleibt `string[]`. TSDoc: die Einträge von `renderOrder`, an den Kommas getrennt, getrimmt, leere weggelassen — eine Kopie, ein Schreiben hinein ändert nichts. `#listedNames()` (`:230`) und `orderedStages` (`:925`) lesen `#getRenderOrderArray()`, nie den öffentlichen Getter — sonst allokiert der Frame-Pfad bei jedem Frame (so der Hinweis aus Zug 0 von Paket 2).
     - `orderedStages` bekommt den Rückgabetyp `ReadonlyArray<StageItem>` (Begründung unten, »Abgleich und Begründungen«).
  2. **Stabiler Schnappschuss** (ASYNC-002).
     - `orderedStages` (`:916-971`): im `'*'`-Fall (`renderOrder` leer oder genau `['*']`, `:927-929`) wird ebenfalls ein Array gecacht: `this.#orderedStages = this.#stages.slice()`. In diesem Fall werden **keine** Namen in `#orderedStageNames` festgehalten und `#hasOrderedStageNames()` nicht geprüft: ohne gelistete Namen verschiebt eine Umbenennung keine Stage, und das `#outputDirty = true` aus `:922` darf dort nicht feuern — sonst baut jede Umbenennung im komponierten Modus den Ausgabeknoten neu und `pipeline.needsUpdate = true` kompiliert den Shader neu. Der Zweig mit expliziter Reihenfolge bleibt, wie er ist. Die Prüfung, ob der `'*'`-Fall vorliegt, allokiert nicht (sie liest das gecachte Array aus `#getRenderOrderArray()`).
     - Ein ausgegebenes Schnappschuss-Array wird nie verändert; `add()`, `remove()` und der `renderOrder`-Setter setzen `#orderedStages = undefined` wie heute, der nächste Zugriff baut ein neues.
     - `#renderToCurrentTarget()` (`:565-573`) liest `const stages = this.orderedStages` einmal und reicht die Liste weiter: `#renderStagesInline(renderer, stages)`, `#renderPipelineSimple(renderer, stages)`, `#renderPipelineComposed(renderer, stages)`. Der komponierte Pfad benutzt dieselbe Liste für `#canCompose(stages)`, die Vorab-Render-Schleife (`:706`) und das `passes`-`map` (`:731`). Signatur `#canCompose(stages: ReadonlyArray<StageItem>): boolean`; `#clearsWholeTarget()` (`:605-607`) ruft `this.#canCompose(this.orderedStages)`.
     - `updateFrame()` (`:402-406`) iteriert schon über einen einmal gelesenen Getter-Wert; nur TSDoc neu (unten).
     - `resize()` (`:361`): `const stages = this.#stages.slice();` vor der Schleife, die Schleife läuft über `stages`, die Meldung des `AggregateError` (`:381`) zählt `stages.length`. Die Größen-Wache `:334-340` liest weiter die lebende Liste.
     - TSDoc: `orderedStages` bekommt erstmals eines, sinngemäß: »The stages in the order they update and draw: {@link renderOrder} applied to {@link stages}. Without `'*'` in the order, a stage whose name it does not list is left out — neither updated nor drawn, though still resized. The array is a snapshot: `add()`, `remove()`, a write to `renderOrder` and — while `renderOrder` lists names — a renamed stage give the next read a new one, and an array handed out before stays as it was. `updateFrame()` and `renderTo()` each go through the order as it stood when the call began, `resize()` through `stages` as they stood: a stage that `add()` or `remove()` brings in or takes out during such a call — from a listener of a stage's frame event, say — is reached from the next call on. A stage removed during `updateFrame()` has its `updateFrame()` in that call and is not drawn by the `renderTo()` after it; a stage added there is drawn by that `renderTo()` and updates from the next frame on.« `updateFrame()` bekommt: ruft `updateFrame()` jeder Stage von `orderedStages` in dieser Reihenfolge; auf einem disposten Renderer ist die Liste leer. In `add()`, `remove()` und `resize()` je ein Satz mit Verweis: eine Änderung während eines dieser Aufrufe wirkt ab dem nächsten, siehe `orderedStages`.
  3. **Zweiseitige Beziehung zu einem Kind-Renderer** (ARCH-007).
     - `parent`-Setter (`:237-247`): ist der neue Parent ein `StageRenderer`, geht der Setter über dessen `add()` und kehrt zurück — `add()` ist der eine Weg, auf dem ein Renderer ein Kind wird:

       ```ts
       set parent(parent: StageRendererParentType | undefined) {
         if (this.#disposed) return;
         if (this.#parent === parent) return;
         if (parent instanceof StageRenderer) {
           // add() moves this renderer: the size first, then out of its previous holder, then in
           parent.add(this);
           return;
         }
         this.#removeFromParent();
         this.#parent = parent;
         if (parent) {
           this.#addToHost(parent);
           emit(this, OnAddToParent);
         }
       }
       ```

       `#addToParent()` (`:265-272`) entfällt; `constructor`, `attach()`, `detach()` bleiben unverändert (sie gehen über den Setter).
     - `add()` (`:1025-1055`) in dieser Reihenfolge:
       1. `if (this.#disposed) return this;`
       2. `if (this.hasStage(stage)) return this;`
       3. Eine disposte Stage wird abgewiesen (Schritt 4).
       4. `const item: StageItem = {stage, width: 0, height: 0};` und **zuerst** `this.resizeStage(item, this.width, this.height);` — wirft die Stage, geht der Fehler unverändert aus `add()` heraus, und weder dieser Renderer noch die Stage noch der bisherige Halter eines Kind-Renderers haben sich geändert (BUG-098).
       5. `const child = stage instanceof StageRenderer ? stage : undefined;` und `child?.#removeFromParent();` — ein Kind verlässt seinen bisherigen Halter, Host oder Renderer (`#removeFromParent()` ruft bei einem Renderer-Halter dessen `remove(child)`, emittiert `OnRemoveFromParent` und meldet damit die Host-Abos ab).
       6. `this.#stages.push(item)`, `#warnAboutSharedNames([stage.name])`, `#orderedStages = undefined`, `#outputDirty = true`, Abos (Schritt 3, letzter Punkt).
       7. `if (child) child.#parent = this;`
       8. `emit(this, OnStageAdded, {stage, renderer: this} as StageAddedProps);` danach `if (child) emit(child, OnAddToParent);` — dieselbe Reihenfolge wie heute bei `new StageRenderer(parent)`.

       Ergebnis: `root.add(child)`, `child.parent = root`, `child.attach(root)` und `new StageRenderer(root)` stellen dieselbe Beziehung her; ein Renderer hat genau einen Halter, und ein `add()` an einen zweiten Renderer oder ein `attach(host)` nimmt ihn aus dem ersten. Ein disposter Parent nimmt kein Kind (`add()` kehrt in 1. zurück), das Kind bleibt dann bei seinem bisherigen Halter.
     - Der Kommentar in `#ensureAsPassNodeRT()` (`:789-790`, »a child added with add() never learned who holds it«) wird falsch; neu: »the guard sits here and not in asPassNode(): a parent pre-renders a nested child through this method directly«.
     - Abos in `add()` (`:1038-1050`): auf jeder eventisierten Stage zusätzlich zum bestehenden Listener für `[OnStageAfterCameraChanged, OnStageAfterSceneChanged]` ein Listener auf `'dispose'`, der `this.remove(stage)` ruft. `#stageSubscriptions` (`:1003`) hält weiter **einen** Handle je Stage, der beide Listener beendet; Feldkommentar (`:1002`) nennt Kamera, Szene und `dispose`. `remove()` ruft ihn wie heute. `'dispose'` als String-Literal, wie `Stage2D#dispose()` (`Stage2D.ts:441`) es emittiert. Dass ein Listener sich während des eigenen Emits abmeldet (über `remove()`), prüft ein Test (Schritt 10).
  4. **Disposte Stage abweisen** (ARCH-007, Ausprägung vor dem `add()`): in `add()` nach dem `hasStage`-Check `if ((stage as {isDisposed?: unknown}).isDisposed === true) throw new Error(\`StageRenderer#add() cannot take the stage ${JSON.stringify(stage.name)}: that stage has been disposed\`);` — resource-lifecycle.md §3, letzter Absatz. `Stage2D`, `StageRenderer` und jede eigene Stage mit `isDisposed` fallen darunter; eine Stage ohne das Feld nicht.
  5. **`StageRenderer#dispose()`** (`:885-910`) und `buildOutputNode` nach `dispose()` (ARCH-007, Queue-Eintrag).
     - Nach `this.#pipeline = undefined;` zusätzlich `this.#buildOutputNode = undefined;`.
     - Statt `off(this)` am Ende:

       ```ts
       // the listeners are still attached here: this event is what tells them to let go, and no
       // event follows it. A listener that throws does not leave the renderer half torn down
       try {
         emit(this, 'dispose', this);
       } finally {
         off(this);
       }
       ```

       Der bisherige Kommentar `:908` (»last: the events above still have to reach the listeners that act on them«) geht darin auf.
     - `buildOutputNode`-Setter (`:495-502`): erste Zeile `if (this.#disposed) return;`. TSDoc des Accessors (`:473-490`) bekommt den Satz, den `pipeline` trägt: ein disposter Renderer antwortet hier `undefined` und nimmt keinen neuen; das Schreiben ist ein stilles No-op.
     - TSDoc von `dispose()` (`:856-884`) nachziehen: `parent`, `pipeline` und `buildOutputNode` antworten `undefined`; `buildOutputNode` fliegt aus der Aufzählung »keep the values the renderer was left with« (`:878-879`); ein Parent-`StageRenderer`, der diesen Renderer hält, lässt ihn los (steht heute nur für den Host); »the camera and scene listeners it placed on its stages« wird zu »the camera, scene and dispose listeners«; neuer Satz: ein `dispose`-Event geht an jeden Abonnenten, bevor der Renderer aufhört zuzuhören, und keines folgt ihm.
  6. **Transaktionales `add()`** (BUG-098) — umgesetzt in Schritt 3, Punkt 4. TSDoc von `add()` (`:1013-1024`) neu, sinngemäß: Add a stage … Returns `this`. The stage gets the size of this renderer first: a stage that refuses it is not added, the error of its `resize()` comes out of this call, and neither this renderer nor the stage has changed. A disposed stage is refused with an error naming the call and the state. A `StageRenderer` added here becomes the child of this renderer — equivalent to `child.parent = this`: it leaves the host or the renderer that held it, `parent` answers this renderer, and it gets its `OnAddToParent` after `OnStageAdded` went out here. On an eventized stage — every `Stage2D` and every `StageRenderer` — it listens for `OnStageAfterCameraChanged` and `OnStageAfterSceneChanged` (composed mode: rebuild on the next render) and for `dispose`, on which it takes the stage out through `remove()`; `remove()` stops listening. Dazu der Satz aus Schritt 2.
  7. **Protected Hooks dokumentieren** (DOC-028, API-064) — sie bleiben `protected`, Begründung unten.
     - `onRenderOrderChanged()` (`:208-210`): `// ntdh` weicht einem TSDoc: läuft nach jedem Schreiben auf `renderOrder`, das den Wert ändert — nachdem der Renderer die gecachte Reihenfolge verworfen und vor geteilten Namen gewarnt hat, bevor der nächste Frame die Reihenfolge liest; tut per Default nichts, eine Unterklasse überschreibt ihn, um auf die neue Reihenfolge zu reagieren. Der Rumpf bleibt leer.
     - `renderStage()` (`:912-914`): zeichnet eine Stage in das aktuelle Ziel des Renderers; gerufen für jede Stage der Reihenfolge im Plain-Modus und in Mode C. Die komponierenden Modi (Mode D und E) nehmen den `asPassNode()` jeder Stage und rufen diesen Hook für keine Stage — ein Override, der anders zeichnet, wirkt dort nicht.
     - `resizeStage()` (`:392-400`): gibt Breite und Höhe an die Stage des Items, sofern das Item sie nicht schon trägt, und schreibt sie ins Item, sobald die Stage sie genommen hat; `resize()` ruft ihn für jede Stage, `add()` für die neue Stage, bevor sie in `stages` steht; ein Override, der wirft, gilt als Weigerung der Stage (siehe `resize()`).
  8. **Nummerierte Abschnitte durch Modusnamen ersetzen** (TEST-048, DOC-066, die vorbestehenden Stellen gleicher Ursache, Queue-Eintrag zum Modus-C-Test). Kein Verweis bleibt auf einen Abschnitt mit Nummer.
     - `StageRenderer.spec.ts`: `'parent / host wiring (3.7)'` (`:556`) → `'parent / host wiring'`; `'outputRenderTarget (§6.4 RT only, no pipeline)'` (`:620`) → `'outputRenderTarget without a pipeline'`; `'pipeline without buildOutputNode (§6.4 Mode C)'` (`:640`) → `'Mode C: a pipeline that samples the internal pass-target'`; `'asPassNode + buildOutputNode (§6.2 / §6.3)'` (`:994`) → `'Mode D and E: composing the pass nodes of the stages'`.
     - Der Test `'invalidateOutputNode() forces a rebuild on next render'` (`:1415-1424`) prüft Modus C (Pipeline ohne `buildOutputNode`) und wandert unverändert in das Mode-C-`describe` (endet bei `:992`).
     - `StageRenderer.ts:624`: »Mode C (§6.4): render stages …« → »Mode C: render stages …«; `:690`: »Mode D (§6.2): for each stage …« → »Mode D, and Mode E for nested renderers: for each stage …«.
     - `README.md`, Diagramm `:22-25`: die rechten Spalten nennen statt `§3.2`, `§6.2 / §6.4`, `§6.4`, `§6.2` die Abschnitte beim Namen — `clear policy`, `Mode C / Mode D`, `Mode C`, `Mode D` — Rahmenbreite der Box bleibt (Zeichen zählen). Überschriften `:269` `### Mode C (§6.4) — …` → `### Mode C — …`, `:295` `### Mode D (§6.2) — …` → `### Mode D — …`, `:348` `### Mode E (§6.3) — …` → `### Mode E — …`. Kein Link im Repo zielt auf die alten Anker (geprüft: `grep -rn "#mode-"` leer).
  9. **Folge aus Paket 2**: Kommentar `StageRenderer.ts:662-664` — »stages, their order and cameras leave it standing« → »stages, their order and names, their scenes and their cameras leave it standing«, wie die TSDoc von `pipeline` (`:429-431`) und `README.md:289-291` es schon sagen.
  10. **Doku, die das Paket sonst lügen ließe.**
      - `Stage2D.ts` TSDoc von `dispose()`, Absatz `:418-423` (»Take this stage out of every `StageRenderer` that holds it before calling this …«): wird ersetzt — jeder `StageRenderer`, der die Stage hält, nimmt sie auf das `dispose`-Event hin selbst heraus, und sein nächster Frame komponiert ohne sie. Der Rest der TSDoc bleibt.
      - `README.md`:
        - »Nested `StageRenderer`« (`:166-184`): ein Absatz — `root.add(hud)` und `new StageRenderer(root)` sind derselbe Zug, `hud.parent` ist danach `root`; ein Renderer hat einen Halter, ein `add()` an einen anderen Renderer oder ein `attach(host)` nimmt ihn aus dem ersten.
        - »Custom stages« (`:405-450`): ein Satz unter dem `IPassProvider`-Beispiel — ein `StageRenderer` nimmt eine Stage selbst heraus, wenn sie ihr Ende ankündigt: eine eventisierte Stage (`eventize(this)` aus `@spearwolf/eventize`), die in ihrem `dispose()` `dispose` emittiert, wie `Stage2D`; jede andere Stage vor dem `dispose()` aus jedem Renderer nehmen, der sie hält (`remove(stage)`). Ebenda: eine Stage mit `isDisposed === true` weist `add()` ab.
        - »Events you can subscribe to« (`:456-465`), On `StageRenderer`: `dispose` — einmal, aus `dispose()`, bevor der Renderer aufhört zuzuhören.
        - »Resource lifecycle« (`:496-541`): Bullet `:510-513` um den Parent-Renderer und das `dispose`-Event ergänzen; Bullet `:517-518` (»`remove(stage)` clears both sides of the relation«) um `add()` ergänzen (setzt beide Seiten, ein Kind hat einen Halter); Bullet `:519-527` — der Schluss »Take the stage out of every `StageRenderer` that holds it first — see the pitfall …« wird zu: jeder Renderer, der die Stage hält, nimmt sie auf ihr `dispose` hin heraus.
        - Pitfall »Disposing a stage a renderer still holds« (`:580-588`): gilt nur noch für eine Stage, die ihr `dispose` nicht ankündigt. Der Pitfall bleibt und wird auf diesen Fall umgeschrieben, Titel »Disposing a custom stage a renderer still holds«: eine eigene Stage ohne `dispose`-Event vor ihrem `dispose()` aus jedem Renderer nehmen (`remove(stage)`), sonst behält der komponierte Ausgabeknoten ihren freigegebenen Pass-Knoten; `Stage2D` und `StageRenderer` erledigen das über ihr Event selbst. Der Verweis in `:527` entfällt mit der Änderung des Bullets.
  11. **Tests**, `StageRenderer.spec.ts` — bei jedem Korrektheitsfehler zuerst rot sehen, der rote Lauf gehört in den Report:
      - `'parent / host wiring'`:
        - `add() makes a StageRenderer the child of the renderer it joins` — `root.add(child)` → `child.parent === root`, `OnAddToParent` genau einmal, `OnStageAdded` an `root` vorher (Reihenfolge über ein gemeinsames Log).
        - `attaching a child that add() took moves it out of its parent` — `root.add(child)`, `child.attach(host)` → `root.hasStage(child)` false; ein Frame des Hosts plus `root.renderTo()` zeichnen die innere Stage des Kinds genau einmal (vorher zweimal).
        - `add() moves a StageRenderer out of the renderer that held it` — `a.add(child)`, `b.add(child)` → `a.hasStage(child)` false, `b.hasStage(child)` true, `child.parent === b`, `OnStageRemoved` an `a` einmal.
        - `add() moves a StageRenderer off the host that drove it` — `child = new StageRenderer(host)`, `root.add(child)` → `host._unsubs === 2`, ein Host-Frame erreicht das Kind nicht mehr.
      - `'add / remove'`:
        - `adds no stage that refuses the size` — `sr.resize(320, 240)`, Stage mit werfendem `resize` → `add()` wirft genau diesen Fehler, `sr.hasStage(stage)` false, kein `OnStageAdded`, auf einer eventisierten Stage (`new Stage2D()` mit gestubbtem `resize`) `getSubscriptionCount(stage)` wie vor dem Aufruf.
        - `adds no renderer that refuses the size and leaves it with its host` — Kind an `host`, eine Stage des Kinds weigert die Größe → `root.add(child)` wirft, `child.parent === host`, `host._unsubs === 0`, `root.hasStage(child)` false.
        - `refuses a stage that has been disposed` — disposte `Stage2D` → wirft `/StageRenderer#add\(\) cannot take the stage .*: that stage has been disposed/`, nicht gelistet; dasselbe für einen disposten `StageRenderer`.
        - `lets go of a Stage2D that is disposed while it holds it` — `stage.dispose()` → `sr.hasStage(stage)` false, `OnStageRemoved` einmal; im komponierten Modus (`buildOutputNode`-Spy, zwei Stages) ruft das nächste `renderTo()` `buildOutputNode` mit einem Pass, ohne zu werfen.
        - `several stages that refuse the size come out as one AggregateError in the order they were added` (TEST-031) — drei Stages `a`, `b`, `c`, `a` und `c` werfen `errA`, `errC`, `renderOrder = 'c,b,a'` → `AggregateError`, `errors[0]` ist `errA`, `errors[1]` ist `errC` (`toBe`), `message` genau `'StageRenderer#resize(): 2 of 3 stages refused the size 320x240'`, `sr.width`/`sr.height` wie vor dem Aufruf; nimmt man `a` und `c` die Weigerung, erreicht derselbe `resize(320, 240)` genau `a` und `c`, nicht `b`. Die TSDoc von `resize()` (`:316-329`) bekommt dazu den Satz: `errors` steht in der Reihenfolge, in der die Stages hinzugefügt wurden, der Fehler eines RenderTargets vorn.
        - Schnappschuss (ASYNC-002), jeweils `it.each` über `'*'` und eine explizite Reihenfolge `'a,b,c'`: `a stage removed during updateFrame() does not keep the next one from its updateFrame()` (die `updateFrame` von `a` entfernt `a`; `b` und `c` je einmal; das folgende `renderTo()` zeichnet `a` nicht); `a stage added during updateFrame() updates from the next frame on`; `a stage removed during resize() does not keep the next one from the size`.
        - `orderedStages hands out the same array until the stages change` — bei `'*'` zweimal gelesen `toBe` dasselbe Array; nach `add()` ein neues, das vorher ausgegebene unverändert.
        - `a rename leaves the output node standing while renderOrder is '*'` — komponierender Renderer, nach dem ersten Frame `pipeline.needsUpdate = false`, Stage umbenennen, `renderTo()` → `needsUpdate` bleibt false, `buildOutputNode` nicht erneut gerufen.
        - `renderOrderArray hands out a copy` — `push('x')` in das Ergebnis ändert weder den nächsten Lesewert noch die Reihenfolge.
        - Mutationsprobe für TEST-031, zweiter Teil: vorübergehend die Rücknahme `this.width = prevWidth; this.height = prevHeight;` (`:375-376`) auskommentieren → `'leaves the renderer the size it had when a stage refuses it'` (`:498`) muss an der Width-Assertion rot werden; vorübergehend in der Schleife `:361-367` den ersten Fehler sofort werfen → `'asks every stage for its size even when one of them refuses'` (`:520`) muss rot werden. Beide roten Läufe in den Report, Code zurück. Bleibt einer grün, die Assertion schärfen, bis sie ohne die Rücknahme bzw. ohne das Weiterfragen fällt.
      - `'dispose()'`:
        - `'behaves as documented after dispose()'` (`:1572`) ergänzt: `sr.buildOutputNode` vorher gesetzt, danach `undefined`; ein Schreiben danach lässt es `undefined`.
        - `emits dispose once before it stops listening` — `on(sr, 'dispose', spy)` → `spy` einmal mit `sr`, danach `getSubscriptionCount(sr) === 0`; zweites `dispose()` emittiert nichts. Ein werfender `dispose`-Listener: `dispose()` wirft diesen Fehler, und `getSubscriptionCount(sr) === 0` gilt trotzdem.
        - `'does not pre-render a disposed child into a fresh pass target'` (`:1648-1659`) beschreibt das bisherige Fehlverhalten (sein Kommentar sagt es) und wird ersetzt durch `lets go of a child renderer that is disposed while it holds it` — `parent.add(child)`, `child.dispose()` → `parent.hasStage(child)` false, `child.parent` undefined, komponierendes `parent.renderTo()` wirft nicht. Der Test `'throws instead of building a pass target after dispose()'` behält die Wache in `#ensureAsPassNodeRT()` im Blick.
      - Browser-Test in `packages/twopoint5d-testing/test/stage-pipeline.test.js`: `Mode D: a stage disposed while the renderer holds it leaves the renderer, and the next frame composes the stages that are left` — `Display`, zwei `Stage2D` mit je einem farbigen Mesh, `RenderPipeline`, `sr.buildOutputNode = (passes) => { calls.push(passes); return passes[0]; }` (wie der Nachbartest `:191`, der `passes[0]` zurückgibt); nach zwei Frames `second.dispose()` → `sr.hasStage(second)` false; nach `await display.nextFrame()` wurde `buildOutputNode` erneut gerufen, mit genau einem Pass, dem Knoten der ersten Stage. Vor dem Fix rot (kein Neubau, weil nichts `#outputDirty` setzt). Aufräumen wie die Nachbartests (`sr.dispose()`, `first.dispose()`, `pipeline.dispose()`).
  12. **CHANGELOG** `[Unreleased]` (Skill `updating-changelog`), Einträge in eigenen Worten, ohne Finding-IDs, ohne Rückblick:
      - Changed: `StageRenderer#add()` macht einen hinzugefügten `StageRenderer` zu seinem Kind (`parent`, `OnAddToParent`), ein Renderer hat einen Halter, ein zweites `add()` oder ein `attach(host)` nimmt ihn aus dem ersten — See the Migration Guide.
      - Changed: `StageRenderer#stages` ist ein Getter vom Typ `ReadonlyArray<StageItem>`, `orderedStages` ein `ReadonlyArray<StageItem>`-Schnappschuss, `renderOrderArray` eine Kopie — See the Migration Guide.
      - Changed: `add()` weist eine Stage mit `isDisposed === true` mit einem `Error` ab.
      - `StageRenderer#dispose()` emittiert ein `dispose`-Event, bevor der Renderer aufhört zuzuhören, und ein Parent-Renderer lässt ihn los — das geht in den bestehenden Unreleased-Eintrag zu `StageRenderer#dispose()` (`CHANGELOG.md:171`, unter Changed), nicht in einen eigenen, und dort fliegt nichts heraus, was weiter stimmt.
      - Fixed: ein `StageRenderer` nimmt eine eventisierte Stage heraus, sobald sie `dispose` emittiert (jede `Stage2D`, jeder `StageRenderer`); der komponierte Modus baut danach ohne sie.
      - Fixed: `add()` einer Stage, die die Größe verweigert, lässt Renderer, Stage und den bisherigen Halter eines Kind-Renderers unverändert.
      - Fixed: `updateFrame()`, `renderTo()` und `resize()` gehen durch die Stages, wie sie zu Beginn des Aufrufs standen; ein `remove()` aus einem Frame-Listener lässt die nächste Stage nicht mehr aus, in jedem `renderOrder`.
      - Changed: ein disposter `StageRenderer` antwortet für `buildOutputNode` mit `undefined` und nimmt keinen neuen.
      - Bestehende `[Unreleased]`-Einträge, die danach nicht mehr stimmen, werden an Ort und Stelle berichtigt; `:177` (`remove()` räumt beide Seiten) bleibt stehen, der neue Eintrag zu `add()` steht daneben. Veröffentlichte Abschnitte bleiben unangetastet.
      - `### Migration Guide` (`:509`), neue Unterabschnitte: »A `StageRenderer` has one holder« (vorher/nachher: ein Kind an zwei Renderer, oder `root.add(child)` plus `child.attach(display)`) und »The stage lists of `StageRenderer` are read-only« (`stages`, `orderedStages` nicht mehr per `push`/`splice` änderbar — `add()`/`remove()` nehmen; `renderOrderArray` ist eine Kopie). Codeblöcke, die für sich stehen, mit `ts check`.
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · ARCH-007 unverändert (`add()` `StageRenderer.ts:1025-1055` setzt keinen `parent`; `#removeFromParent()` `:249-263`; `dispose()` `:885-910` ohne `dispose`-Event; Wache mit Kommentar »a child added with add() never learned who holds it« `:787-794`; Stage2D-Pitfall `Stage2D.ts:418-423`, README `:580-588`; der Test `StageRenderer.spec.ts:1648` hält das Fehlverhalten fest) · BUG-098 unverändert (`resizeStage()` erst nach `push` und Abo, `:1051`) · ASYNC-002 unverändert (`'*'`-Fall gibt `this.stages` selbst, `:927-929`; `resize()` iteriert die lebende Liste `:361`) · API-064 unverändert (`readonly stages: StageItem[]` `:180`, `renderOrderArray` gibt den Cache `:218-226`, Hooks `:208`, `:392`, `:912`) · DOC-027 unverändert (`:177-178`) · DOC-028 unverändert (`:208-210`, `// ntdh`) · TEST-031 teils umgeformt (mehrere ablehnende Stages ungetestet; der einzige `AggregateError`-Test `:958` mischt RenderTarget und Stage; die Width-Assertion `:509` des ersten Tests fällt nach Lesart ohne die Rücknahme — Mutationsprobe im Paket) · TEST-048 unverändert (`:620`, `:640`, `:994`) · DOC-066 unverändert (README `:22-25`, `:269`, `:295`, `:348`), ins Paket · vorbestehend gleiche Ursache `StageRenderer.ts:624`, `:690`, `StageRenderer.spec.ts:556` (in `5ff01ea2` vorhanden), ins Paket · Queue: `buildOutputNode`-Setter (`:495`) und Modus-C-Test (`:1415`) ins Paket, beide Einträge bleiben bis zum Abschluss in der Queue · Folge aus Paket 2 (`:662`) als Symptom hierher gezogen · Restplan geprüft: Reihenfolge und Schnitt bleiben
  - 2026-09-29 Zug 1: Implementierer beauftragt (Runde 0), `opus`/high, Report `paket-3.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG · geändert `StageRenderer.ts`, `StageRenderer.spec.ts`, `Stage2D.ts`, `README.md`, `CHANGELOG.md`, `stage-pipeline.test.js` · 19 Vitest-Tests und 1 Browser-Test vor dem Fix rot, dazu 2 für die doppelte Freigabe des Pass-Targets · Mutationsprobe beide rot · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-3.verify.log`)
  - 2026-09-29 Zug 3: Reviewer beauftragt (Runde 0), `opus`/high, Diff `paket-3.diff`
  - 2026-09-29 Zug 3: Reviewer (`paket-3.review-0.json`): alle 12 Punkte erfüllt · 1 wichtig (Rückblick »no longer« in `CHANGELOG.md:514`) · 6 klein (Mechanik Kind-dispose in `CHANGELOG.md:512`/TSDoc `add()`, Umbruch `StageRenderer.ts:710`, Umbruch `CHANGELOG.md:3392`, `parent`-Accessor ohne TSDoc, README-Diagramm `:21` `IStage[]`, Commit-Typ `fix!:`) · Diff `paket-3.diff`
  - 2026-09-29 Zug 4 Runde 1: offen das wichtige plus die kleinen (ohne Commit-Typ, den trägt die Paketdatei), dazu `Stage2D.ts:428` (Umbruch, Folge aus Paket 2 im selben TSDoc-Block) und `README.md:187` (Verweis auf nicht existierende Überschrift, gleiche Ursache wie DOC-066) · Resume Session `feae565c-0742-4a11-9c5a-f9014959032b`, `opus`/high, Report `paket-3.impl-1.json` · zurück: FERTIG, alle 8 als behoben gemeldet (`CHANGELOG.md`, `StageRenderer.ts`, `Stage2D.ts`, `README.md`, nur Doku/Kommentare) · Verify `pnpm run ci` exit=0 (`paket-3.verify-1.log`) · Nach-Review beauftragt, `sonnet`/medium, Diff `paket-3.r1.diff` · Nach-Review (`paket-3.review-1.json`): alle 8 erledigt, nichts Neues außer klein (Waisen-Umbruch) · Fortschritt: 1 wichtig + 7 klein → 0 offen
  - 2026-09-29 Zug 5: Commit `8614c309` (`fix!: …`, Trailer `Remediation-Run: 2026-09-29`) · Verify `paket-3.verify-1.log` exit=0 nach der letzten Codeänderung · Plan auf `[x]`, Queue: beide Einträge aus Paket 1 auf `[x]`, 1 Nebenbefund neu (`Stage2D.ts:29-41`, → Scope), 1 Folge (`Stage2D.ts:438`)

## Abgleich und Begründungen

- **ARCH-007 — `add()` ist der eine Weg zum Kind.** Die Empfehlung sagt »in
  `add()` bei einem `StageRenderer` den `parent` setzen«. Ginge `add()` dafür
  über den `parent`-Setter und der Setter wie heute zurück über `add()`,
  entstünde eine Rekursion, und die Transaktion aus BUG-098 ließe sich nicht
  halten: der Setter verlässt den alten Halter, bevor `add()` die Größe fragt.
  Darum dreht der Plan die Richtung um — der Setter delegiert für einen
  Renderer-Parent an `add()`, und `add()` fragt zuerst die Größe, verlässt dann
  den alten Halter und trägt dann ein. Beobachtbar bleibt für
  `new StageRenderer(parent)` alles gleich, auch die Reihenfolge `OnStageAdded`
  vor `OnAddToParent`.
- **ARCH-007 — ein Halter je Renderer.** Ein Kind-Renderer hat ein einziges
  `parent`-Feld und ein einziges Pass-Target; in zwei Listen würde er doppelt
  getrieben und in zwei komponierenden Eltern zweimal pro Frame in dasselbe
  Target gerendert. Ein zweites `add()` verschiebt ihn deshalb. Für `Stage2D`
  gilt das nicht: zwei Renderer dürfen sie halten und teilen sich ihren
  Pass-Knoten (TSDoc `Stage2D#asPassNode()`); beide hören auf ihr `dispose`.
- **ARCH-007 — disposte Stage abweisen.** Nicht wörtlich in der Empfehlung,
  aber derselbe Fehlerfall von der anderen Seite: eine Stage, die schon
  disposed ist, emittiert nie wieder `dispose`, bliebe für immer gelistet, und
  der komponierende Parent würfe ab dem nächsten Frame — genau das Symptom, das
  ARCH-007 beschreibt. resource-lifecycle.md §3, letzter Absatz, verlangt die
  Abweisung mit Aufruf und Zustand in der Meldung.
- **ARCH-007 — `try … finally` um das `dispose`-Event.** `Display#dispose()`
  zeigt, dass ein werfender Listener den Abbau nicht halbieren darf. Das Muster
  mit gesammelten Fehlern wäre für ein einzelnes Event überzogen; `finally`
  sorgt dafür, dass `off(this)` läuft und der Fehler danach herauskommt.
  `Stage2D#dispose()` bleibt, wie es ist — nicht Teil dieses Pakets.
- **ASYNC-002 — Schnappschuss je Aufruf, nicht je Frame.** Die Empfehlung
  schreibt als Regel »Änderungen wirken ab dem nächsten Frame«. Ein
  Frame-weiter Schnappschuss (dieselbe Liste für `updateFrame()` und das
  folgende `renderTo()`) würde eine Stage, die sich in ihrem Frame-Listener
  disposed und darum austragen lässt, im selben Frame noch zeichnen — im
  komponierten Modus mit einem Wurf aus `asPassNode()`. Außerdem sind
  `updateFrame()` und `renderTo()` zwei öffentliche Aufrufe, die der manuelle
  Modus getrennt treibt. Die Regel lautet deshalb »ab dem nächsten Aufruf«, und
  die TSDoc sagt genau, was das für ein `add()` und ein `remove()` in
  `updateFrame()` bedeutet. Dass eine in `updateFrame()` hinzugefügte Stage im
  selben Frame gezeichnet wird, bevor sie ihr erstes `updateFrame()` hatte, war
  schon so und wird dokumentiert, nicht geändert.
- **ASYNC-002 — `resize()` gehört dazu.** Die Fundstelle nennt nur die beiden
  Frame-Pfade; `resize()` iteriert dieselbe lebende Liste, und ein
  `OnStageResize`-Listener, der eine Stage entfernt, lässt dort genauso die
  nächste aus. Dieselbe Ursache, eine Zeile. `resize()` ist kein Frame-Pfad,
  die Kopie dort kostet nichts Messbares.
- **ASYNC-002 — keine Namensprüfung im `'*'`-Fall.** Heute cacht der
  `'*'`-Fall nichts und prüft darum auch keine Namen. Würde der neue Cache die
  Namensprüfung erben, setzte jede Umbenennung `#outputDirty`, und der
  komponierte Modus kompilierte seinen Shader neu, ohne dass sich die
  Reihenfolge geändert hätte. Ein Test hält das fest.
- **API-064 — `orderedStages` ebenfalls `ReadonlyArray`.** Die Entscheidung
  vom 2026-09-29 nennt `stages` und `renderOrderArray`. `orderedStages` gibt
  nach ASYNC-002 in beiden Modi den Schnappschuss heraus, den die Frame-Pfade
  iterieren; ein veränderliches `StageItem[]` ließe einen Aufrufer genau diese
  Liste umbauen. Dieselbe Behandlung wie `stages` (Typ statt Kopie, kein
  Allokieren im Frame-Pfad), dieselbe Migration-Guide-Stelle — die
  Entscheidung wird angewandt, nicht umgekehrt.
- **API-064 / DOC-028 — Hooks bleiben `protected`.** Die Empfehlung lässt
  »dokumentieren oder privat machen« offen. DOC-028 verlangt ausdrücklich ein
  TSDoc für `onRenderOrderChanged()`, setzt den Hook also voraus; privat
  machen bräche Unterklassen außerhalb des Repos ohne Gewinn außer Ordnung.
  `renderStage()` bekommt den Satz, dass er in den komponierenden Modi nicht
  greift — das ist der Teil der Beschreibung, der Nutzer überrascht.
- **TEST-031 — zweiter Teil schon teilweise erledigt.** Die Width-Assertion im
  ersten Test (`StageRenderer.spec.ts:509`, `toBe(0)` nach der Weigerung)
  fällt ohne die Rücknahme in `resize()` `:375-376` — nach meiner Lesart. Die
  Mutationsprobe belegt das statt der Lesart; nur wo sie grün bleibt, wird
  geschärft.
- **DOC-066 ins Paket.** Das Finding liegt unter `src/stage/**`, die
  Scope-Regel deckt es wörtlich, und es teilt die Ursache mit TEST-048 (die
  Spec-Namen zitieren dieselben Abschnittsnummern wie die README). Es fehlte
  in der Scope-Liste nur, weil das Audit ihm keine `component` gegeben hat.
  Kein Scope-Wechsel, sondern die freigegebene Regel angewandt.
- **Queue-Einträge.** Der `buildOutputNode`-Setter ohne Wache ist dieselbe
  Ursache wie der ARCH-007-Teil zu `dispose()`: `StageRenderer#dispose()`
  erfüllt die Checkliste aus resource-lifecycle.md §6 nicht ganz (Punkt 3:
  Event vor `off(this)`, Punkt 6: das Verhalten jedes öffentlichen Members nach
  `dispose()` in dessen TSDoc). Gelöst wie beim `pipeline`-Setter: `dispose()`
  gibt die Referenz auf, der Getter antwortet `undefined` (Typ erlaubt die
  Abwesenheit, §3 Nr. 1), das Schreiben ist ein stilles No-op (§3 Nr. 3). Der
  falsch einsortierte Modus-C-Test hat dieselbe Ursache wie TEST-048: der
  `describe`-Name sagt einem roten Test nicht, welche Zusage gemeint ist — nach
  der Umbenennung in »Mode D and E« stünde ein Modus-C-Test unter einem Namen,
  der ihm widerspricht.
- **Browser-Test.** Die Beziehung ist Buchführung, aber ihr sichtbarer Effekt
  liegt im komponierten Modus auf der GPU: ohne den Austrag behält der
  Ausgabeknoten den freigegebenen Pass-Knoten, und das Backend legt dessen
  RenderTarget still neu an. AGENTS.md verlangt für Rendering-Änderungen
  beide Testflächen; ein Test in `stage-pipeline.test.js` genügt.

## Findings im Volltext

**ARCH-007 · medium · packages/twopoint5d/src/stage/StageRenderer.ts:859-884** (weitere: `StageRenderer.ts:641-646`, `:722-745`, `Stage2D.ts:386-395`; Zeilen aus dem Audit, heute siehe Verlauf) — Die Beziehung zwischen StageRenderer und seinen Stages zweiseitig machen
`root.add(child)` setzt bei einem Kind-Renderer weder `parent` noch `OnAddToParent`. Ein späteres `child.attach(display)` lässt ihn doppelt treiben, vom Display und vom Root. `child.dispose()` lässt ihn in der Liste des Parents stehen, und der komponierende Parent wirft ab dem nächsten Frame jedes Mal. `StageRenderer.dispose()` emittiert kein `dispose`-Event, obwohl resource-lifecycle.md §4/§6.3 das für abonnierte Objekte verlangt. Für `Stage2D` ist dieselbe Falle nur als Pitfall dokumentiert.
Empfehlung: In `add()` bei einem `StageRenderer` den `parent` setzen, auf `dispose` der Stage hören und sie dann per `remove()` austragen. `StageRenderer.dispose()` emittiert vor `off(this)` ein `dispose`-Event.

**BUG-098 · low · packages/twopoint5d/src/stage/StageRenderer.ts:880** — add() hinterlässt eine halb hinzugefügte Stage, wenn sie die Größe abweist
`add()` ruft `resizeStage(si, this.width, this.height)` nach `stages.push(si)` und nach dem Setzen des Kamera-Listeners, aber vor `emit(this, OnStageAdded, …)`. Weist die Stage die Größe ab, steht sie in `stages`, `OnStageAdded` bleibt aus, und der Aufrufer bekommt einen Fehler statt `this` — eine Stage im Renderer, deren Aufnahme nie angekündigt wurde. Aufgefallen im Remediation-Lauf vom 2026-09-20.
Empfehlung: Dieselbe Transaktionsregel wie in `resize()`: entweder vor dem `push` resizen, oder die Stage bei einem Wurf wieder aus `stages` nehmen und den Listener abhängen, bevor der Fehler nach oben geht.

**ASYNC-002 · low · packages/twopoint5d/src/stage/StageRenderer.ts:762** (weitere: `:372`, `:896`; Zeilen aus dem Audit) — Stage-Liste in `updateFrame()` und `renderTo()` über einen Schnappschuss iterieren
Mit dem Default `renderOrder = '*'` gibt `orderedStages` das interne, veränderliche `this.stages`-Array selbst zurück (Zeile 762–764). Ruft ein `OnStageUpdateFrame`-Listener während `updateFrame()` `renderer.remove(stage)` auf — etwa eine Stage, die sich nach einer Überblendung selbst entfernt —, spliced `remove()` das Array mitten in der `for…of`-Schleife, und die nachfolgende Stage bekommt in diesem Frame kein `updateFrame()`, wird aber gerendert. Mit explizitem `renderOrder` iteriert die Schleife dagegen das alte Cache-Array, und die entfernte Stage bekommt ihr `updateFrame()` noch. Das Verhalten beim Reentrancy-Fall hängt so vom Sortiermodus ab; außerdem kann jeder Aufrufer über den öffentlichen Getter die interne Liste verändern.
Beleg: `if (renderOrder.length === 0 || (renderOrder.length === 1 && renderOrder[0] === '*')) { return this.stages; }`
Empfehlung: Im `'*'`-Fall ebenfalls ein gecachtes Array (`this.stages.slice()`, bei `add`/`remove` invalidiert) liefern, sodass beide Modi während eines Frames einen stabilen Schnappschuss iterieren; die Reentrancy-Regel (Änderungen wirken ab dem nächsten Frame) in der JSDoc festhalten.

**API-064 · low · packages/twopoint5d/src/stage/StageRenderer.ts:149** (weitere: `:177-195`, `:361`; Zeilen aus dem Audit) — StageRenderer.stages und renderOrderArray nicht mutierbar herausgeben
`readonly stages: StageItem[]` schützt nur die Referenz. Ein `push` oder `splice` von außen umgeht Kamera-Subscription, Cache und Dirty-Flag. `renderOrderArray` gibt den internen Cache heraus. Die protected Hooks, etwa `onRenderOrderChanged` ohne TSDoc, haben im Repo keinen Nutzer, und `renderStage` greift nur im Plain-Modus und in Mode C.
Empfehlung: `stages` als `ReadonlyArray` typisieren, `renderOrderArray` kopiert herausgeben, die Hooks dokumentieren oder privat machen.

**DOC-027 · low · packages/twopoint5d/src/stage/StageRenderer.ts:147** — TSDoc von StageRenderer#stages auf den Getter orderedStages verweisen lassen
Das TSDoc von `stages` verweist auf `getOrderedStages()`; eine solche Methode gibt es nicht, gemeint ist der Getter `orderedStages`. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: `{@link orderedStages}` statt `getOrderedStages()`.

**DOC-028 · low · packages/twopoint5d/src/stage/StageRenderer.ts:177** — Den Hook onRenderOrderChanged() dokumentieren
Der protected Hook `onRenderOrderChanged()` trägt nur `// ntdh`; wann er läuft und wofür eine Unterklasse ihn überschreibt, steht nirgends. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Ein TSDoc: läuft nach jeder Änderung von `renderOrder`, bevor der nächste Frame die Reihenfolge liest; Default tut nichts.

**TEST-031 · info · packages/twopoint5d/src/stage/StageRenderer.spec.ts:723** — Der AggregateError des Renderers ist nur im Einzelfall getestet
Beide Tests decken den einen ablehnenden Fall ab; dass mehrere ablehnende Stages zu einem `AggregateError` zusammenlaufen und in welcher Reihenfolge sie in `errors` stehen, prüft keiner. Die Assertions auf `sr.width`/`sr.height` im ersten Test gelten mit und ohne den Fix, den sie begleiten.
Empfehlung: Einen Test mit zwei ablehnenden Stages ergänzen und die Assertions so schärfen, dass sie ohne den Fix fallen.

**TEST-048 · low · packages/twopoint5d/src/stage/StageRenderer.spec.ts:526** (weitere: `:546`, `:759`; Zeilen aus dem Audit, heute `:620`, `:640`, `:994`) — describe-Namen der StageRenderer-Spec verweisen auf Abschnitte eines Dokuments, das nicht im Repo liegt
Aufgefallen im Remediation-Lauf vom 2026-09-26. Drei describe-Namen tragen `§6.2`, `§6.3` und `§6.4` (»outputRenderTarget (§6.4 RT only, no pipeline)«, »pipeline without buildOutputNode (§6.4 Mode C)«, »asPassNode + buildOutputNode (§6.2 / §6.3)«). Ein Dokument mit diesen Abschnitten liegt nicht im Repo; wer einen roten Test liest, erfährt nicht, welche Zusage gemeint ist. Dieselben Verweise in `src/stage/README.md` führt DOC-066.
Empfehlung: Die Verweise durch den Satz ersetzen, den sie meinen, etwa den Namen des Modus oder die Zusage selbst.

**DOC-066 · low · packages/twopoint5d/src/stage/README.md:22-25** (weitere: `:246`, `:262`, `:313`; Zeilen aus dem Audit, heute `:269`, `:295`, `:348`) — Die Stage-README verweist auf nummerierte Abschnitte, die sie nicht hat
Aufgefallen im Remediation-Lauf vom 2026-09-21. Die Verweise auf `§3.2`, `§6.2`, `§6.3` und `§6.4` führen ins Leere, weil die README keine nummerierten Abschnitte hat.
Empfehlung: Die Verweise durch Überschriften-Links ersetzen oder die Abschnitte nummerieren.

**Queue · low · packages/twopoint5d/src/stage/StageRenderer.ts:495** (aus Paket 1) — der `buildOutputNode`-Setter hat keinen Disposed-Guard wie der `pipeline`-Setter und nimmt nach `dispose()` weiter Werte an; die TSDoc von `dispose()` ist dazu unscharf.

**Queue · info · packages/twopoint5d/src/stage/StageRenderer.spec.ts:1415** (aus Paket 1) — der Test `'invalidateOutputNode() forces a rebuild on next render'` prüft Modus C, steht aber im `describe` `'asPassNode + buildOutputNode'`.

**Folge aus Paket 2 · info · packages/twopoint5d/src/stage/StageRenderer.ts:662** — der Kommentar in `#renderPipelineSimple()` zählt »stages, their order and cameras« auf, es fehlen Namen und Szenen (in Paket 1 entstanden).

## Reviewer-Urteil

Review Runde 0 (`paket-3.review-0.json`, `opus`/high) auf `paket-3.diff`, Nach-Review Runde 1 (`paket-3.review-1.json`, `sonnet`/medium) auf `paket-3.r1.diff`. Zeilen: Stand vor Runde 1, `StageRenderer.ts` hat sich in Runde 1 nur in TSDoc/Kommentaren verschoben.

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| ARCH-007 | behoben | `add()` setzt beide Seiten (`StageRenderer.ts:1143-1177`), Setter delegiert an `add()` (`:256-262`), `dispose`-Listener → `remove()` (`:1164`), `dispose()` emittiert in `try … finally` (`:965`), disposte Stage abgewiesen (`:1135`); `Stage2D.ts:418`; README `:182`, `:458`, `:472`, `:531`, `:596`; Tests `StageRenderer.spec.ts:649`, `:664`, `:688`, `:875` ff., `:1953`, `:2015`, `:2037`; Browser `stage-pipeline.test.js:145` |
| BUG-098 | behoben | `resizeStage()` vor jeder Zustandsänderung (`StageRenderer.ts:1143`); Tests `StageRenderer.spec.ts:601`, `:630` |
| ASYNC-002 | behoben | `'*'`-Fall cacht eine Kopie ohne Namensprüfung (`StageRenderer.ts:1001-1014`), `renderTo` liest einmal (`:607`) und reicht durch (`:634`, `:744`), `resize()` über Kopie (`:384`, `:406`); TSDoc `:434`, `:991`, `:1189`; Tests `StageRenderer.spec.ts:713` ff., `:761`, `:782` |
| API-064 | behoben | `#stages` privat, Getter `ReadonlyArray` (`StageRenderer.ts:184`), `renderOrderArray` Kopie / Frame-Pfad über `#getRenderOrderArray()` (`:236`), `orderedStages` `ReadonlyArray` (`:996`), Hooks dokumentiert (`:215`, `:418`, `:972`); Migration Guide `CHANGELOG.md:3414`; Test `StageRenderer.spec.ts:802` |
| DOC-027 | behoben | `StageRenderer.ts:177-183`, `{@link orderedStages}` |
| DOC-028 | behoben | `StageRenderer.ts:215`, `// ntdh` entfernt |
| TEST-031 | behoben | `StageRenderer.spec.ts:566` (Reihenfolge, Identität, Meldung, Größenrücknahme); Mutationsprobe beide rot (Implementierer-Report) |
| TEST-048 | behoben | `StageRenderer.spec.ts:946`, `:966`, `:1332` |
| DOC-066 | behoben | `README.md:22-25` (Rahmenbreite gehalten), `:273`, `:299`, `:352` |
| vorbestehende §-Verweise | behoben | `StageRenderer.ts:671`, `:737`, `StageRenderer.spec.ts:816` |
| Queue: `buildOutputNode`-Setter ohne Wache | behoben | Wache `StageRenderer.ts:579`, Freigabe in `dispose()` `:960`, TSDoc; Test `StageRenderer.spec.ts:1949` |
| Queue: Modus-C-Test im falschen `describe` | behoben | unverändert nach `StageRenderer.spec.ts:1319` im Mode-C-`describe` (`:966-1331`) |
| Folge aus Paket 2: Kommentar `#renderPipelineSimple()` | behoben | `StageRenderer.ts:709-710`, in Runde 1 umbrochen (`:693-699`) |

Runde 1 hat erledigt (Nach-Review, je »erledigt«): wichtig — Rückblick »no longer« im Fixed-Eintrag (`CHANGELOG.md:158` jetzt »as they stood when it began«); klein — Mechanik Kind-`dispose` in CHANGELOG, TSDoc `add()` und README-Pitfall; Umbruch `#renderPipelineSimple()`; Umbruch Migration Guide »A `StageRenderer` has one holder«; TSDoc am `parent`-Accessor (`StageRenderer.ts:251-261`); README-Diagramm `stages: ReadonlyArray<StageItem>` in eigener Zeile (`README.md:21`); Umbruch TSDoc `Stage2D#dispose()`; README-Verweis »Composing post-effects« → »Mode D« / »Mode E«. Commit-Typ `fix!:` in der Paketdatei gesetzt.

Kleine Befunde, offen gelassen:
- `CHANGELOG.md:3386-3392` — die letzte Zeile des Absatzes ist nur »last.«, ein Waisen-Umbruch.

Urteile an der Queue:
- `Stage2D.ts:29-41` Klassen-TSDoc über der Interface-Deklaration → Scope: liegt unter `src/stage/**`; vor dem Lauf schon so (`5ff01ea2`), keine gemeinsame Ursache mit Paket 3.
- `Stage2D.ts:438` als Folge, nicht als Nebenbefund: der Emit ohne `finally` stand in `5ff01ea2`, aber der Weg, auf dem ein `OnStageRemoved`-Listener dort durchschlägt, entsteht erst durch den `dispose`-Listener aus diesem Paket. Im Zweifel Folge. Nicht in Runde 1 mitgenommen, weil der Detailplan `Stage2D#dispose()` ausdrücklich ausnimmt.
