# Paket 12 — Drain: StageRenderer#dispose() läuft hinter einem werfenden Listener zu Ende

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings · Nebenbefund aus Zug 0 von Paket 11
  (`StageRenderer.ts:998-1000`, `dispose()` bricht hinter einem werfenden
  Listener von `OnStageRemoved`/`OnRemoveFromParent` ab, low, vorbestehend) ·
  dazu gleiche Ursache: `remove()` (`:1161-1183`), `#removeFromParent()`
  (`:272-286`), `add()` (`:1097-1147`) und der Setter `parent` (`:254-270`) —
  jede dieser Methoden sendet ein Beziehungs-Event per fail-fast `emit()`
  mitten in Schritten, die zusammengehören · dazu der Wiedereintritt beim
  Umzug (ein Listener, der während des Auszugs einen der beiden Renderer
  disposed oder dem Kind einen anderen Halter gibt; im Setter vorbestehend,
  von Paket 3 nach `add()` getragen — Nachtragspaket zu Paket 3, hier
  zusammengelegt, siehe »Entscheidungen in Zug 0«)
- Ziel: `StageRenderer#dispose()` gibt Targets, Stages und Parent auch dann
  vollständig frei und meldet sich ab, wenn ein Listener wirft, und wirft die
  gesammelten Fehler danach in derselben Form wie die übrigen Stage-Klassen.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts` (Setter `parent`,
    `#removeFromParent()`, `dispose()`, `add()`, `remove()`, deren TSDoc, der
    Import aus `@spearwolf/eventize`, neuer Import von `throwCollected`)
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts` (16 neue Tests;
    `getSubscriptionCount`, `Stage2D`, `ParallaxProjection` sind schon
    importiert, `:23`, `:25`, `:28`)
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts` (nur TSDoc von
    `dispose()`)
  - `packages/twopoint5d/src/stage/README.md` (ein Absatz unter »Events you
    can subscribe to«, ein Satz im Punkt `StageRenderer.dispose()` unter
    »Resource lifecycle«)
  - `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]`: Zeile 26 und 178
    ergänzen, ein neuer Eintrag unter `### Fixed`)
- Vorgehen:
  0. **Regressionstests zuerst, rot sehen, dann beheben.** Die Tests aus
     Schritt 7 schreiben, gegen den unveränderten Code laufen lassen
     (`pnpm nx test twopoint5d -- src/stage/StageRenderer.spec.ts`), die rote
     Ausgabe in den Report. Alle 16 sind vor dem Fix rot (Begründung je Test in
     Schritt 7).
  1. **Eine Regel für alle Beziehungs-Events von `StageRenderer`.** Jedes
     Event, das `StageRenderer.ts` sendet, geht per `emitStrict()` hinaus:
     jeder Listener hört es, auch hinter einem, der wirft (eventize ≥ 6.2:
     ein Fehler unverändert, mehrere als `AggregateError` in
     Dispatch-Reihenfolge, geworfen erst nach der Zustellung). Wo nach dem
     Event noch Schritte derselben Operation folgen, laufen sie trotzdem; die
     Fehler werden in einem Array `errors: unknown[]` gesammelt und am Ende der
     **öffentlichen** Methode per `throwCollected(errors, <Meldung>)` geworfen
     (`import {throwCollected} from '../utils/throwCollected.js';`, wie in
     `Stage2D.ts:17`). Ein Fehler kommt unverändert beim Aufrufer an, mehrere
     als `AggregateError` mit der Meldung aus diesem Plan; jeder Eintrag steht,
     wie er geworfen wurde — auch ein `AggregateError` aus `emitStrict()` oder
     aus einem verschachtelten `remove()` bleibt ein Eintrag, nichts wird
     flachgezogen (so halten es `Stage2D#dispose()`, `Canvas2DStage#dispose()`
     und `docs/resource-lifecycle.md` §4). Danach kommt `emit` in
     `StageRenderer.ts` nicht mehr vor; aus dem Import in Zeile 1 fällt
     `emit` heraus.
  2. **`#removeFromParent(errors: unknown[]): void`** (heute `:272-286`, ohne
     Parameter) — der private Helfer wirft nicht mehr selbst, sondern legt
     seine Fehler in das Array des Aufrufers, damit jede öffentliche Methode
     eine flache, geordnete Sammlung hat und keine Meldung ohne öffentlichen
     Methodennamen entsteht:

     ```ts
     #removeFromParent(errors: unknown[]): void {
       const parent = this.#parent;
       if (parent == null) return;

       // (bestehender Kommentar »cleared before the event goes out …« bleibt)
       this.#parent = undefined;

       // <Kommentar: jeder Listener hört es, auch hinter einem, der wirft —
       //  die Host-Abos aus #addToHost() sind Listener dieses Events und lassen
       //  den Host hier los; der Fehler geht an den Aufrufer, wenn sein Aufruf
       //  zu Ende gelaufen ist>
       try {
         emitStrict(this, OnRemoveFromParent);
       } catch (error) {
         errors.push(error);
       }

       if (parent instanceof StageRenderer) {
         try {
           parent.remove(this);
         } catch (error) {
           errors.push(error);
         }
       }
     }
     ```

     Aufrufer: Setter `parent`, `add()` (für `child`), `remove()` (für einen
     entfernten Kind-Renderer), `dispose()` — alle vier reichen ihr eigenes
     `errors` hinein.
  3. **Setter `parent`** (heute `:254-270`). Der Weg über
     `parent instanceof StageRenderer` → `parent.add(this); return;` bleibt.
     Danach:

     ```ts
     const errors: unknown[] = [];
     this.#removeFromParent(errors);
     // <Kommentar: ein Listener des Auszugs kann diesen Renderer disposed oder
     //  ihm einen anderen Halter gegeben haben — dann endet der Umzug hier>
     if (!this.#disposed && this.#parent === undefined) {
       this.#parent = parent;
       if (parent) {
         this.#addToHost(parent);
         try {
           emitStrict(this, OnAddToParent);
         } catch (error) {
           errors.push(error);
         }
       }
     }
     throwCollected(errors, 'StageRenderer#parent: more than one listener of OnRemoveFromParent, OnStageRemoved and OnAddToParent threw');
     ```

     Wirft ein Listener beim Verlassen des alten Halters, verlässt der Renderer
     ihn trotzdem vollständig und hängt sich an den neuen Host; der Fehler
     kommt danach. Hat ein Listener des Auszugs den Renderer disposed oder ihm
     selbst einen Halter zugewiesen, bleibt es dabei: kein `#parent = parent`,
     kein `#addToHost()`, kein `OnAddToParent`. `attach()` und `detach()` gehen
     über den Setter und erben das ohne eigene Änderung.
  4. **`add()`** (heute `:1097-1147`). Die Größe bleibt der erste Schritt und
     wirft wie bisher direkt (ein Stage, der die Größe verweigert, wird nicht
     aufgenommen, nichts hat sich geändert — die Tests `:642-689` bleiben
     unverändert grün). Nach der Größe `const errors: unknown[] = [];`, dann an
     der heutigen Stelle (`:1115`):

     ```ts
     if (child) {
       child.#removeFromParent(errors);
       // <Kommentar: ein Listener des Auszugs kann einen der beiden Renderer
       //  disposed oder dem Kind einen anderen Halter gegeben haben — dann nimmt
       //  dieser Renderer es nicht auf>
       if (this.#disposed || child.#disposed || child.#parent !== undefined) {
         throwCollected(
           errors,
           'StageRenderer#add(): more than one listener of OnRemoveFromParent, OnStageRemoved, OnStageAdded and OnAddToParent threw',
         );
         return this;
       }
     }
     ```

     Die Meldung steht damit zweimal; eine modulprivate Konstante neben
     `disposedError()` (`:54`) ist erlaubt. Push, Order, Abos und
     `child.#parent = this` unverändert. Am Ende statt der beiden `emit()`
     (`:1143-1144`):

     ```ts
     try {
       emitStrict(this, OnStageAdded, {stage, renderer: this} as StageAddedProps);
     } catch (error) {
       errors.push(error);
     }
     if (child) {
       try {
         emitStrict(child, OnAddToParent);
       } catch (error) {
         errors.push(error);
       }
     }
     throwCollected(
       errors,
       'StageRenderer#add(): more than one listener of OnRemoveFromParent, OnStageRemoved, OnStageAdded and OnAddToParent threw',
     );
     return this;
     ```

     Reihenfolge der Einträge: `OnRemoveFromParent` am Kind, der Fehler von
     `remove()` am vorigen `StageRenderer` (dessen `OnStageRemoved`),
     `OnStageAdded` hier, `OnAddToParent` am Kind.
  5. **`remove()`** (heute `:1161-1183`). Splice, Abo-Abbau, `invalidate()`
     und `#outputDirty` bleiben vor dem Event. Dann:

     ```ts
     const errors: unknown[] = [];
     try {
       emitStrict(this, OnStageRemoved, {stage, renderer: this} as StageRemovedProps);
     } catch (error) {
       errors.push(error);
     }
     if (stage instanceof StageRenderer) {
       // (bestehende Kommentare zum Pass-Target und zum »move both sides make« bleiben)
       stage.#targets.releasePassTarget();
       if (stage.parent === this) {
         stage.#removeFromParent(errors);
       }
     }
     throwCollected(errors, 'StageRenderer#remove(): more than one listener of OnStageRemoved and OnRemoveFromParent threw');
     ```

     Das Pass-Target wird damit auch hinter einem werfenden
     `OnStageRemoved`-Listener freigegeben, und das Kind verlässt den Renderer
     (`child.parent` → `undefined`, sein `OnRemoveFromParent` geht hinaus).
  6. **`dispose()`** (heute `:993-1022`). Reihenfolge der Schritte bleibt;
     jeder Schritt läuft, gleich was davor warf:

     ```ts
     dispose(): void {
       if (this.#disposed) return;
       this.#disposed = true;

       const errors: unknown[] = [];

       // (bestehender Kommentar »the stages came in through add() …« bleibt; dazu:
       //  ein Stage, dessen remove() wirft, ist trotzdem draußen, der Abbau geht
       //  mit dem nächsten weiter)
       for (const {stage} of this.#stages.slice()) {
         try {
           this.remove(stage);
         } catch (error) {
           errors.push(error);
         }
       }

       // (Kommentar und Zeilen zu #targets.dispose(), #internalOutputNode,
       //  #internalOutputTexture unverändert)
       this.#targets.dispose();
       this.#internalOutputNode = undefined;
       this.#internalOutputTexture = undefined;

       // (Kommentar zum Parent-Setter unverändert)
       this.#removeFromParent(errors);

       this.#pipeline = undefined;
       this.#buildOutputNode = undefined;

       // <bestehender Kommentar »the listeners are still attached here …«, auf
       //  try/catch statt try/finally angepasst: jeder Listener hört es, der
       //  Fehler wartet, bis der Renderer abgebaut ist>
       try {
         emitStrict(this, OnStageDispose, this);
       } catch (error) {
         errors.push(error);
       }
       off(this);

       throwCollected(
         errors,
         'StageRenderer#dispose(): more than one listener of OnStageRemoved, OnRemoveFromParent and OnStageDispose threw',
       );
     }
     ```

     `this.#targets.dispose()` bleibt ohne `try`: es ruft nur
     `RenderTarget#dispose()` von three.js, keinen Listener dieser Bibliothek
     und keinen Pool (`StageRendererTargets.ts:116-121`, `:128-132`) — wie
     `Canvas2DStage#dispose()` `material.dispose()` ohne `try` ruft.
  7. **Tests** in `packages/twopoint5d/src/stage/StageRenderer.spec.ts`. Namen
     wörtlich; Helfer `thrownBy()` (`:102`), `makeHost()` (`:127`, zählt
     `_unsubs` ehrlich), `fakeStage()`, `makePipelineMock()`, `renderer`,
     `sandbox`; `Stage2D` und `ParallaxProjection` sind schon importiert
     (Test `'leaves a builder of createBloomOutputNodeBuilder() alone'`). Ein
     Listener, der vor einem Host-Anschluss (`attach()`, Konstruktor mit Host)
     registriert wird, läuft vor den `once()`-Abos aus `#addToHost()` —
     gleiche Priorität, Registrierungsreihenfolge; genau das macht die
     Host-Tests heute rot.

     In `describe('dispose()')` (`:2347`), hinter
     `'every dispose listener hears the event, even behind one that throws'`:

     - T1 `'a listener of OnStageRemoved that throws does not hold up the teardown'`
       — Host `h`, `sr = new StageRenderer(h)`, `sr.resize(50, 50)`,
       `a = fakeStage('a')`, `b = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 100}))`,
       `const onB = getSubscriptionCount(b)` vor `sr.add(a); sr.add(b)`,
       `sr.pipeline = makePipelineMock()`, `sr.renderTo(renderer)` (baut das
       interne Target), Spy auf `RenderTarget.prototype.dispose`, Listener auf
       `OnStageRemoved`, der nur für `a` `failure` wirft, `heard` auf
       `OnStageDispose`. Erwartet: `thrownBy(() => sr.dispose())` ist
       `failure`; `sr.stages` leer; `getSubscriptionCount(b)` gleich `onB`;
       Spy einmal gerufen; `h._unsubs === 2`; `heard` genau einmal mit `sr`;
       `getSubscriptionCount(sr) === 0`; `sr.pipeline` `undefined`; ein
       zweites `sr.dispose()` wirft nicht. Heute rot: `dispose()` endet bei
       `a`.
     - T2 `'a listener of OnRemoveFromParent that throws does not keep the renderer on its host'`
       — `sr = new StageRenderer()`, Listener auf `OnRemoveFromParent` wirft
       `failure`, **danach** `sr.attach(h)`, `stage = fakeStage('s')`,
       `sr.add(stage)`, `heard` auf `OnStageDispose`. Erwartet: `failure`;
       `h._unsubs === 2`; `h._emitFrame(1, 0.016, 1)` ruft `stage.renderTo`
       nicht; `sr.parent` `undefined`; `heard` einmal;
       `getSubscriptionCount(sr) === 0`. Heute rot: die `once()`-Abos hinter
       dem werfenden Listener laufen nicht.
     - T3 `'a listener of OnRemoveFromParent that throws does not keep the renderer among the stages of its parent'`
       — `parent = new StageRenderer()`, `sr = new StageRenderer(parent)`,
       Listener auf `OnRemoveFromParent` an `sr` wirft `failure`. Erwartet:
       `failure`; `parent.hasStage(sr) === false`; `sr.parent` `undefined`;
       `getSubscriptionCount(sr) === 0`. Heute rot: `parent.remove(this)`
       bleibt aus.
     - T4 `'a child whose OnRemoveFromParent listener throws leaves the renderer and releases its pass target'`
       — `parent = new StageRenderer()`, `child = new StageRenderer(parent)`,
       `child.resize(50, 50)`, `passTarget = (child.asPassNode(renderer) as any).value.renderTarget`
       (wie `:2556`), Listener auf `OnRemoveFromParent` an `child` wirft
       `failure`, Spy auf `RenderTarget.prototype.dispose`, `heard` auf
       `OnStageDispose` an `parent`. `parent.dispose()` → `failure`;
       `child.parent` `undefined`; Spy mit `thisValue === passTarget`
       gerufen; `heard` einmal; `getSubscriptionCount(parent) === 0`. Heute
       rot: `dispose()` endet im `remove()` des Kinds.
     - T5 `'errors from several parts of the teardown reach the caller as an AggregateError in the order they arose'`
       — Host `h`, `sr = new StageRenderer(h)`, Stages `a`, `b`
       (`fakeStage`), `OnStageRemoved`-Listener wirft `eA` für `a`, `eB` für
       `b`; `OnRemoveFromParent`-Listener wirft `eP`; `OnStageDispose`-Listener
       wirft `eD`. Erwartet: ein `AggregateError` mit `message`
       `'StageRenderer#dispose(): more than one listener of OnStageRemoved, OnRemoveFromParent and OnStageDispose threw'`
       und `errors` identisch `[eA, eB, eP, eD]` (je `toBe`); `h._unsubs === 2`.
     - T6 `'a remove() that threw twice stands as one AggregateError among the errors of dispose()'`
       — `sr = new StageRenderer()`, `child = new StageRenderer(sr)`,
       `OnStageRemoved`-Listener an `sr` wirft `e1`, `OnRemoveFromParent`-Listener
       an `child` wirft `e2`, `OnStageDispose`-Listener an `sr` wirft `e3`.
       Erwartet: `AggregateError` (Meldung von `dispose()`) mit zwei
       Einträgen; der erste ein `AggregateError` mit der Meldung
       `'StageRenderer#remove(): more than one listener of OnStageRemoved and OnRemoveFromParent threw'`
       und `errors` `[e1, e2]`, der zweite `e3`.

     In `describe('add / remove')` (`:445`) ein neues inneres
     `describe('listeners that throw')` am Ende:

     - T7 `'remove() lets go of both sides of a child behind an OnStageRemoved listener that throws'`
       — `parent`, `child = new StageRenderer(parent)`, `child.resize(50, 50)`,
       `passTarget` wie T4, `OnStageRemoved`-Listener an `parent` wirft
       `failure`, ein zweiter `heard` an `parent` auf `OnStageRemoved`,
       `left` an `child` auf `OnRemoveFromParent`, Spy auf
       `RenderTarget.prototype.dispose`. Erwartet:
       `thrownBy(() => parent.remove(child))` ist `failure`; `heard` einmal;
       `left` einmal; `child.parent` `undefined`; `parent.hasStage(child)`
       `false`; Spy mit `thisValue === passTarget`. Heute rot: `heard` hört
       nichts, `child.parent` bleibt `parent`.
     - T8 `'remove() hands on the errors of OnStageRemoved and of OnRemoveFromParent at the child as an AggregateError'`
       — Aufbau wie T7 ohne Spy, `OnStageRemoved` wirft `e1`,
       `OnRemoveFromParent` am Kind wirft `e2`. Erwartet: `AggregateError`
       mit der `remove()`-Meldung und `errors` `[e1, e2]`.
     - T9 `'add() gives an added child its OnAddToParent behind an OnStageAdded listener that throws'`
       — `root`, `child = new StageRenderer()`, `OnStageAdded`-Listener an
       `root` wirft `failure`, `heard` an `root` auf `OnStageAdded`, `joined`
       an `child` auf `OnAddToParent`. Erwartet: `thrownBy(() => root.add(child))`
       ist `failure`; `heard` einmal; `joined` einmal; `child.parent === root`;
       `root.hasStage(child)`. Heute rot: `heard` und `joined` hören nichts.
     - T10 `'add() moves a child whose OnRemoveFromParent listener throws out of its previous holder and in'`
       — `a = new StageRenderer()`, `b = new StageRenderer()`,
       `child = new StageRenderer(a)`, `OnRemoveFromParent`-Listener an
       `child` wirft `failure`, `joined` an `child` auf `OnAddToParent`
       (**nach** dem Aufbau registriert). Erwartet: `thrownBy(() => b.add(child))`
       ist `failure`; `a.hasStage(child) === false`; `b.hasStage(child)`;
       `child.parent === b`; `joined` einmal. Heute rot: `add()` endet vor dem
       Push.
     - T11 `'add() hands on the errors of OnStageAdded and of OnAddToParent at the child as an AggregateError'`
       — `root`, `child = new StageRenderer()`, `OnStageAdded` wirft `e1`,
       `OnAddToParent` am Kind wirft `e2`. Erwartet: `AggregateError` mit der
       `add()`-Meldung und `errors` `[e1, e2]`.

     In `describe('parent / host wiring')` (`:863`) am Ende:

     - T12 `'attach() to a new host behind an OnRemoveFromParent listener that throws leaves the old host and joins the new one'`
       — `hostA`, `hostB`, `sr = new StageRenderer()`,
       `OnRemoveFromParent`-Listener wirft `failure`, **danach**
       `sr.attach(hostA)`, `stage = fakeStage('s')`, `sr.add(stage)`.
       Erwartet: `thrownBy(() => sr.attach(hostB))` ist `failure`;
       `hostA._unsubs === 2`; `sr.parent === hostB`;
       `hostA._emitFrame(1, 0.016, 1)` ruft `stage.renderTo` nicht,
       `hostB._emitFrame(2, 0.016, 2)` ruft es genau einmal. Heute rot:
       `hostA` treibt weiter, `hostB` gar nicht.
     - T13 `'a write to parent hands on the errors of OnRemoveFromParent and OnAddToParent as an AggregateError'`
       — `hostA`, `hostB`, `sr = new StageRenderer(hostA)`,
       `OnRemoveFromParent` wirft `e1`, `OnAddToParent` wirft `e2` (beide
       nach dem Anschluss an `hostA` registriert). `sr.parent = hostB` →
       `AggregateError` mit der Setter-Meldung und `errors` `[e1, e2]`.
     - T14 `'a write to parent leaves a renderer that a listener of OnRemoveFromParent disposes off the new host'`
       — `hostA`, `hostB`, `sr = new StageRenderer(hostA)`,
       `stage = fakeStage('s')`, `sr.add(stage)`, danach
       `on(sr, OnRemoveFromParent, () => sr.dispose())`,
       `joined` auf `OnAddToParent`. `sr.parent = hostB` wirft nicht;
       `sr.isDisposed`; `sr.parent` `undefined`; `joined` nie gerufen;
       `hostB._emitResize(80, 40)` lässt `sr.width` unverändert,
       `hostB._emitFrame(1, 0.016, 1)` ruft `stage.renderTo` nicht. Heute
       rot: `sr.parent === hostB`, `hostB` treibt den disposten Renderer.

     In `describe('add / remove')` → `describe('listeners that throw')` (aus
     T7–T11) zusätzlich — der Name des inneren `describe` lautet damit
     `'listeners that throw or dispose'`:

     - T15 `'add() leaves out a child that a listener disposes while it leaves its previous holder'`
       — `a`, `b`, `child = new StageRenderer(a)`,
       `on(child, OnRemoveFromParent, () => child.dispose())`. `b.add(child)`
       wirft nicht; `b.hasStage(child) === false`; `a.hasStage(child) === false`;
       `child.parent` `undefined`; `child.isDisposed`. Heute rot: `b` nimmt
       das disposte Kind auf.
     - T16 `'add() takes no child into a renderer that a listener disposes while the child leaves its previous holder'`
       — `a`, `b`, `child = new StageRenderer(a)`,
       `on(child, OnRemoveFromParent, () => b.dispose())`. `b.add(child)`
       wirft nicht; `b.isDisposed`; `b.stages` leer; `child.parent`
       `undefined`; `child.isDisposed === false`. Heute rot: `b` hält das
       Kind nach seinem `dispose()`.

     Unverändert und weiter grün bleiben müssen u. a.
     `'stops listening even when a dispose listener throws'` (`:2500`),
     `'every dispose listener hears the event, even behind one that throws'`
     (`:2512`), `'lets go of a Stage2D that is disposed even behind a dispose listener that throws'`
     (`:731`) und die Canvas2DStage-Specs zu `dispose()`. Kein Browser-Test:
     die Änderung berührt keinen Render- oder GPU-Pfad, nur Ereignisse und
     Buchführung; `pnpm run ci` fährt `test:browser` trotzdem mit.
  8. **TSDoc in `StageRenderer.ts`** — Zieltexte, auf ≤ 100 Zeichen je Zeile
     bzw. die Breite des jeweiligen Blocks umbrechen:
     - `dispose()`, der Absatz `:976-982` wird zu zwei Absätzen:

       ```
          * An `OnStageDispose` goes out to every subscriber before this renderer stops listening; no
          * event follows it. Every listener on this renderer goes with it, including the `OnStageAdded`
          * and `OnStageRemoved` subscriptions a caller placed on it, and so do the camera, scene and
          * dispose listeners it placed on its stages (through `remove()`).
          *
          * A listener that throws does not hold up the teardown — one of `OnStageRemoved` or
          * `OnRemoveFromParent` while the renderer lets go of its stages and its holder, or one of
          * `OnStageDispose`: every subscriber hears its event, the renderer is torn down completely,
          * and the errors reach the caller afterwards — one unchanged, several as an `AggregateError`
          * in the order they arose: that of the {@link remove} of each stage that threw, in the order
          * of `stages`; then those of leaving the holder — of the `OnRemoveFromParent` listeners here,
          * then of the `remove()` of a parent `StageRenderer`; then that of the `OnStageDispose`
          * listeners. Each is as it was thrown — an `AggregateError` itself when more than one
          * listener of one event threw, or when both events of a `remove()` did.
       ```

     - `remove()` (`:1150-1160`), neuer letzter Absatz im Stil des Blocks
       (Breite ~76):

       ```
          *
          * A listener that throws does not cut the call short: every listener of
          * `OnStageRemoved` hears it, and so does every listener of
          * `OnRemoveFromParent` at a removed child, which leaves this renderer and
          * releases its pass-target all the same. The errors reach the caller
          * afterwards — one unchanged, several as an `AggregateError`, those of
          * `OnStageRemoved` first.
       ```

     - `add()` (`:1068-1096`), neuer Absatz hinter »A renderer has one
       holder.«:

       ```
          *
          * A listener that throws does not cut the call short — one of
          * `OnRemoveFromParent` at a child and of `OnStageRemoved` at its previous
          * `StageRenderer` while the child leaves that holder, one of `OnStageAdded`
          * here or of `OnAddToParent` at the child: every listener hears its event,
          * the stage is added, and the errors reach the caller afterwards — one
          * unchanged, several as an `AggregateError` in the order they arose. The
          * size stays the exception: a stage that refuses it is not added. A
          * listener that disposes this renderer or the child, or gives the child
          * another holder, while the child leaves its previous one ends the call
          * there: the child is not added.
       ```

     - Setter/Getter `parent` (`:238-249`), neuer letzter Absatz:

       ```
          *
          * A listener that throws does not cut the assignment short — one of `OnRemoveFromParent`
          * here or of `OnStageRemoved` at a previous `StageRenderer` while this renderer leaves its
          * holder, one of `OnAddToParent` as it joins a host: every listener hears its event, the
          * renderer leaves its holder and joins the new one, and the errors reach the caller
          * afterwards — one unchanged, several as an `AggregateError` in the order they arose. A
          * listener that disposes this renderer or gives it another holder while it leaves its holder
          * ends the assignment there. For a `StageRenderer` assigned here, {@link add} says the same.
       ```

  9. **TSDoc von `Canvas2DStage#dispose()`** (`Canvas2DStage.ts:277-287`):
     der `StageRenderer` einer `Canvas2DStage` hat keinen Parent
     (`Canvas2DStage.ts:107`), trägt aber die `Stage2D` (`:130`) — ein
     werfender `OnStageRemoved`-Listener an `canvas2dStage.stageRenderer` ist
     damit ein neuer Beitrag, und der Fehler von `StageRenderer#dispose()`
     kann nun aus mehreren Teilen bestehen. Zieltext des Absatzes:

     ```
        * A listener of `OnCanvas2DStageDispose` that throws does not hold up the teardown: every
        * subscriber hears the event, the instance is torn down completely, and the error reaches the
        * caller afterwards — one unchanged, several as an `AggregateError`. That holds for the
        * `OnStageDispose` listeners of the {@link StageRenderer} and the {@link Stage2D} as well, for
        * the `OnStageRemoved` listeners of the `StageRenderer`, and for the release of the pass node
        * of the `Stage2D`. Three parts contribute one error each at most — the listeners of
        * `OnCanvas2DStageDispose`, `StageRenderer#dispose()` and `Stage2D#dispose()`; when more than
        * one of them throws, the `AggregateError` carries their errors in this order, each as it was
        * thrown — an `AggregateError` itself when more than one listener of its event threw, when
        * more than one part of the teardown of the `StageRenderer` threw, or when both the listeners
        * of the `Stage2D` and the release of its pass node threw.
     ```

     Code und Meldung von `Canvas2DStage#dispose()` bleiben.
  10. **`src/stage/README.md`:**
      - »Events you can subscribe to«, hinter der Liste »On `StageRenderer`:«
        (heute `:555-557`), vor »On `Stage2D`:«, ein Absatz:

        ```
        A listener of one of these events that throws does not cut short the call that sends it:
        every listener hears the event, `add()`, `remove()`, a write to `parent`, `attach()`,
        `detach()` and `dispose()` run to their end, and the error reaches the caller afterwards —
        one unchanged, several as an `AggregateError`.
        ```

      - »Resource lifecycle«, Punkt `StageRenderer.dispose()` (heute
        `:614-620`), hinter »An `OnStageDispose` goes out before the renderer
        stops listening.« anhängen und den Punkt auf seine Breite (~90)
        neu umbrechen:
        »A listener of `OnStageRemoved`, `OnRemoveFromParent` or
        `OnStageDispose` that throws holds up none of this; its error reaches
        the caller once the renderer is down.«
  11. **`packages/twopoint5d/CHANGELOG.md`, `[Unreleased]`** (einzeilige
      Einträge bleiben einzeilig):
      - Zeile 178 (`StageRenderer#dispose()` unter `### Changed`): den Satz
        »A listener of the `dispose` event that throws does not hold up the
        teardown: every subscriber hears the event, the instance is torn down
        completely, and the error reaches the caller afterwards — one
        unchanged, several as an `AggregateError`.« ersetzen durch
        »A listener that throws does not hold up the teardown — one of the
        `dispose` event, or one of `OnStageRemoved` or `OnRemoveFromParent`
        while the renderer lets go of its stages and its holder: every
        subscriber hears its event, the instance is torn down completely, and
        the errors reach the caller afterwards — one unchanged, several as an
        `AggregateError` in the order they arose.«
      - Zeile 26 (`Canvas2DStage#dispose()`): »That holds for the `dispose`
        listeners of its `StageRenderer` and its `Stage2D` as well, and for
        the release of the pass node of its `Stage2D`.« wird zu »That holds
        for the `dispose` listeners of its `StageRenderer` and its `Stage2D`
        as well, for the `OnStageRemoved` listeners of its `StageRenderer`,
        and for the release of the pass node of its `Stage2D`.«; und »— an
        `AggregateError` itself when more than one listener of its event
        threw, or when both the listeners of the `Stage2D` and the release of
        its pass node threw.« wird zu »— an `AggregateError` itself when more
        than one listener of its event threw, when more than one part of the
        teardown of the `StageRenderer` threw, or when both the listeners of
        the `Stage2D` and the release of its pass node threw.«
      - `### Fixed`, neuer erster Eintrag (vor `:341`):
        »- fix `StageRenderer` for a listener of `OnStageAdded`,
        `OnStageRemoved`, `OnAddToParent` or `OnRemoveFromParent` that
        throws: every listener hears its event, and `add()`, `remove()`, a
        write to `parent`, `attach()` and `detach()` run to their end before
        the error reaches the caller — one unchanged, several as an
        `AggregateError`. A renderer that leaves a host lets go of its frame
        loop, a child that leaves a `StageRenderer` is out of its stages and,
        removed through `remove()`, has its pass-target released, and a child
        that `add()` moves leaves its previous holder and joins the new one. A
        listener that disposes either renderer, or gives the child another
        holder, while it leaves its previous one ends the move there: no
        disposed renderer is wired into a host or takes a stage«
      - Kein Migration-Guide-Eintrag: ein einzelner werfender Listener
        erreicht den Aufrufer unverändert wie bisher; anders ist nur der
        Zustand danach (vollständig statt halb), und ein `AggregateError`
        entsteht erst, wo bisher der zweite Fehler verloren ging.
  12. **Nicht anfassen:**
      - Wiedereintritt jenseits des Auszugs: Listener von `OnStageAdded`,
        `OnAddToParent` oder `OnStageRemoved`, die nach dem Push bzw. nach dem
        Splice Stages oder Renderer umhängen oder disposen. Geprüft wird nur
        an der einen Stelle, an der nach einem Event noch Zustand geschrieben
        wird — hinter `#removeFromParent()` im Setter und in `add()`.
      - `src/utils/throwCollected.ts`, `Stage2D.ts`, `docs/resource-lifecycle.md`
        (nennt `StageRenderer` nicht), `StageRendererTargets.ts`, der
        Mode-C-/Pipeline-Pfad, die Browser-Tests.
      - Die Meldungen aus Schritt 2–6 wörtlich übernehmen; Prettier darf sie
        umbrechen, nicht kürzen.
- Verify: `pnpm run ci` (aus dem Repo-Root). Schnelle Schleife vorher:
  `pnpm nx test twopoint5d -- src/stage/StageRenderer.spec.ts src/stage/Canvas2DStage.spec.ts src/stage/Stage2D.spec.ts`
- Commit: `fix(stage): let StageRenderer#dispose() release its render targets, leave its holder, emit its dispose event and stop listening behind a listener of OnStageRemoved or OnRemoveFromParent that throws, let add(), remove() and a write to parent run to their end the same way while every listener of OnStageAdded, OnStageRemoved, OnAddToParent and OnRemoveFromParent hears its event, let a move end where a listener disposes either renderer or gives the child another holder, and let the stage docs say in which shape several errors reach the caller`
- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · Nebenbefund unverändert
    (`StageRenderer.ts:993-1022` `dispose()`, Schleife `:998-1000`, `emit`
    `OnStageRemoved` `:1169`, `emit` `OnRemoveFromParent` `:281`;
    vorbestehend, `5ff01ea2` `:748-770`, `emit` `:234`, `:927`) ·
    aufgenommen, gleiche Ursache: `remove()` `:1161-1183`,
    `#removeFromParent()` `:272-286`, `add()` `:1097-1147` (`emit`
    `:1143-1144`), Setter `parent` `:254-270` (`emit` `:268`), dazu TSDoc
    `Canvas2DStage.ts:277-287` und `CHANGELOG.md:26`, `:178` · offene Folgen:
    keine (Paket 11 `Folgen: keine`) · »Offene Befunde«: `Display.ts` und
    `PanControl2D.spec.ts:344` ohne gemeinsame Ursache, liegen gelassen ·
    aufgenommen als Nachtragspaket zu Paket 3, hier zusammengelegt:
    Wiedereintritt beim Umzug (Setter `:263-269`, vorbestehend `5ff01ea2`
    `:213-223`; `add()` `:1115`, von `8614c309` dorthin getragen) · Restplan
    unverändert: Paket 12 ist das letzte, danach der Abschluss
  - 2026-09-30 Zug 1: Implementierer beauftragt, stärkste Stufe (opus), Effort medium
  - 2026-09-30 Zug 2: Report FERTIG · 5 Dateien geändert (StageRenderer.ts/.spec.ts, Canvas2DStage.ts, README.md, CHANGELOG.md) · 16 Regressionstests vor dem Fix rot · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-12.verify.log`)
  - 2026-09-30 Zug 3: Reviewer (opus, medium) bestanden · alle Punkte erfüllt · 0 kritisch, 0 wichtig, 3 klein · Diff `paket-12.diff`
  - 2026-09-30 Zug 4: keine Runde
  - 2026-09-30 Zug 5: committet `51e8b330`, Verify aus Zug 2 (exit=0, keine Änderung seither)

## Urteil des Reviewers

- Abbruch von `dispose()` hinter werfendem Listener: behoben, `StageRenderer.ts:1036-1080` (Schleife `:1045-1050`, `#removeFromParent(errors)` `:1061`, `OnStageDispose`/`off(this)` `:1069-1075`, `throwCollected` `:1077-1080`)
- `remove()`: behoben, `StageRenderer.ts:1264-1282`
- `#removeFromParent()`: behoben, `StageRenderer.ts:297-322`, Signatur `(errors: unknown[])`, alle vier Aufrufer `:274`, `:1191`, `:1058`, `:1278`
- `add()`: behoben, `StageRenderer.ts:1180-1235`, Konstante `ADD_THREW` `:59-60`
- Setter `parent`: behoben, `StageRenderer.ts:263-294`, TSDoc `:253-260`
- Wiedereintritt beim Umzug: behoben, Setter `:280`, `add()` `:1194-1197`
- Doku: `Canvas2DStage.ts:277-287`, `README.md:559-562`, `:627-629`, `CHANGELOG.md:26`, `:178`, `:341`
- Klein:
  - `StageRenderer.ts:1178` gegen `:1194-1197` — `resizeStage()` läuft vor dem Abbruch beim Wiedereintritt; die TSDoc sagt nur »the child is not added« (deckt sich mit der Folge im Report des Implementierers)
  - T14 (`a write to parent leaves a renderer that a listener of OnRemoveFromParent disposes off the new host`) prüft `hostA._unsubs === 2` nicht
  - T15/T16 prüfen nicht, dass ein im Auszug geworfener Fehler auf dem frühen `return`-Pfad (`throwCollected` `:1195`) beim Aufrufer ankommt
- Konventionen: keine Finding-ID, kein Rückblick, Commit-Message passt
- Verbleib der »klein« und der Folge: → Audit, nach der Entscheidung vom 2026-09-30 zu Paket 12 (keine weitere Drain-Runde)

## Findings im Volltext

**Nebenbefund aus Zug 0 von Paket 11 · low · `packages/twopoint5d/src/stage/StageRenderer.ts:998-1000`**
— `StageRenderer#dispose()` lässt seine Stages per `remove()` los, das
`OnStageRemoved` per `emit` sendet (`:1169`), und löst sich per
`#removeFromParent()`, das `OnRemoveFromParent` per `emit` sendet (`:281`);
wirft ein Listener eines dieser Events, bricht `dispose()` dort ab: `#disposed`
ist schon `true`, `#targets.dispose()`, das `OnStageDispose` und `off(this)`
bleiben aus, ein zweites `dispose()` ist ein No-op — der Renderer bleibt mit
RenderTargets und Listenern halb abgebaut (vorbestehend, `5ff01ea2`
`StageRenderer.ts:748-770`, `emit` `:927`).
Empfehlung (aus dem Plan): Fix nach dem Muster von `Stage2D#dispose()` /
`Canvas2DStage#dispose()`: Fehler sammeln, den Abbau zu Ende führen, per
`throwCollected()` werfen; Regressionstest zuerst.

## Abgleich

- **Nebenbefund `dispose()`: unverändert.** `StageRenderer.ts:993-1022`: die
  Schleife `:998-1000` ruft `this.remove(stage)` ohne Schutz; `remove()`
  sendet `emit(this, OnStageRemoved, …)` (`:1169`) **vor** der Freigabe des
  Pass-Targets und dem Auszug eines Kind-Renderers (`:1170-1180`);
  `#removeFromParent()` sendet `emit(this, OnRemoveFromParent)` (`:281`)
  **vor** `parent.remove(this)` (`:283-285`). Nur das `OnStageDispose` ist
  seit Paket 4 per `emitStrict` in `try … finally` geschützt (`:1019-1023`).
- **Zusätzlich halb:** eventize bricht bei `emit()` am ersten werfenden
  Listener ab; die `once()`-Abos aus `#addToHost()` (`:288-303`), die den Host
  loslassen, sind selbst Listener von `OnRemoveFromParent`. Steht ein
  werfender Listener vor ihnen, bleibt der Renderer am Frame-Loop des Hosts —
  im Setter, in `attach()`/`detach()`, in `add()` und in `dispose()`.
- **Gleiche Ursache, andere Stelle:** `remove()` (Pass-Target und Auszug des
  Kinds bleiben hinter einem werfenden `OnStageRemoved` aus),
  `#removeFromParent()` (s. o.), `add()` (`:1115` Auszug beim vorigen Halter,
  `:1143-1144` — ein werfender `OnStageAdded`-Listener nimmt dem Kind sein
  `OnAddToParent`, obwohl README `:638-642` es für `add()` zusagt), Setter
  `parent` (`:263-269`). Die `emit()` sind alle vorbestehend (`5ff01ea2`:
  `:234`, `:247`, `:907`, `:927`); den Auszug beim vorigen Halter in `add()`
  (`:1115`) gibt es seit Paket 3 (`8614c309`).
- **Wiedereintritt beim Umzug:** ein Listener des Auszugs (`OnRemoveFromParent`
  am Renderer, `OnStageRemoved` am vorigen Halter), der einen der beiden
  Renderer disposed oder dem Kind einen anderen Halter gibt — danach schreibt
  der Setter `#parent = parent` und `#addToHost(parent)` (ein disposter
  Renderer hängt am Host, `parent` antwortet nicht `undefined`), und `add()`
  nimmt ein disposed gewordenes Kind bzw. in einen disposten Halter auf. Mit oder ohne
  Wurf. Im Setter vorbestehend (`5ff01ea2` `:213-223`), in `add()` seit
  Paket 3.
- **Folgen der erledigten Pakete:** keine offen — jede `Folgen:`-Zeile ist
  verteilt, Paket 11 hat `Folgen: keine`.

## Entscheidungen in Zug 0

- **Die Ursache an der Wurzel, nicht nur in `dispose()`.** Ein
  `try/catch` um `this.remove(stage)` und `this.#removeFromParent()` in
  `dispose()` allein ließe die Helfer halb stehen: ein Kind-Renderer bliebe
  mit dem disposten Renderer als `parent` zurück, ein Parent hielte den
  disposten Renderer weiter in seinen Stages (sein nächster komponierter Frame
  wirft dann `asPassNode()` is not available), und ein Host triebe ihn weiter.
  `dispose()` ist erst vollständig, wenn `remove()` und `#removeFromParent()`
  selbst zu Ende laufen — damit tun sie das auch für ihre übrigen Aufrufer
  (Setter, `attach()`, `detach()`, `add()`). Drei Stellen aus derselben
  halb behobenen Ursache wären drei halbe Fixe.
- **`add()` gehört dazu**, obwohl es nichts abbaut: es teilt mit `remove()`
  das Ereignispaar und die Zusage der README (`:638-642` »sets both sides …
  gets its `OnAddToParent`«), und nach diesem Paket wäre `remove()` robust,
  `add()` nicht — eine Asymmetrie, die ein Reviewer zu Recht als Folge
  melden würde. Der Auszug beim vorigen Halter läuft wie im Setter zu Ende, der
  Umzug wird vollendet, der Fehler kommt danach; die Größe bleibt die
  dokumentierte Ausnahme (wirft vor jeder Änderung).
- **`emitStrict()` statt `emit()` für alle Events der Klasse.** Nur so hören
  die Host-Abos ihr `OnRemoveFromParent` hinter einem werfenden Listener; die
  Bibliothek zahlt die prozessweite Kosten des geschützten Dispatch ohnehin
  schon (`Stage2D`, `Canvas2DStage`, `Display`). Ein einzelner Fehler kommt
  unverändert an, bestehende `toBe(failure)`-Tests bleiben gültig.
- **Der Helfer sammelt in das Array des Aufrufers** statt selbst per
  `throwCollected()` zu werfen: sonst entstünde eine Meldung ohne
  öffentlichen Methodennamen (der Helfer ist von fünf öffentlichen Wegen aus
  erreichbar), und `dispose()`, Setter und `add()` bekämen einen
  verschachtelten Eintrag, wo eine flache Folge in Ereignisreihenfolge
  lesbarer ist. `remove()` bleibt öffentlich und wirft selbst — in
  `dispose()` ist sein Fehler deshalb ein Eintrag je Stage, wie
  `Canvas2DStage#dispose()` die Fehler seiner Teile als je einen Eintrag
  führt.
- **Kein Migration-Guide-Eintrag**, Begründung in Schritt 11.
- **Modell stärkste Stufe, Effort medium.** Fünf Methoden, die über
  `#removeFromParent()` ↔ `remove()` wechselseitig zwischen Parent und Kind
  laufen, dazu eine Fehlerreihenfolge, die TSDoc, CHANGELOG und Tests genau
  gleich sagen müssen — ein Fehler dort kostet eine Runde. Effort nicht
  höher: Code, Meldungen, Tests und Zieltexte stehen hier.

- **Wiedereintritt beim Umzug gehört hierher, nicht ins Audit.** Im Setter
  stand der Fehler schon vor dem Lauf; nach `add()` hat ihn Paket 3 getragen,
  als es den Auszug beim vorigen Halter dorthin legte — im Zweifel Folge, und
  eine Folge schließt dieser Lauf selbst. Ein eigenes Nachtragspaket kostete
  drei Kaltstarts für drei Bedingungen in genau den Zeilen, die Paket 12 ohnehin
  neu schreibt; die Entscheidung vom 2026-09-30 (keine weitere Runde) spricht
  gegen ein neues Paket, nicht gegen das Zusammenlegen. Geprüft wird nur die
  eine Stelle, an der nach einem Event noch Zustand geschrieben wird (hinter
  dem Auszug); weiterer Wiedereintritt steht unter »Nicht anfassen«.

## Nebenbefunde aus Zug 0

- keine offenen — der Wiedereintritt beim Umzug ist aufgenommen (siehe oben).
