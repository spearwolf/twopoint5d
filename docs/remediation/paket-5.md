# Paket 5 — Stage: StageRenderer, Stage2D, Canvas2DStage, Projektionen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-004 (medium), BUG-005 (medium), BUG-006 (medium), BUG-007 (medium), IMPL-001 (medium), MEM-003 (low), BUG-021 (low, nur der Stage-Teil), BUG-022 (low)
- Dazu: zwei Nebenbefunde gleicher Ursache aus Zug 0 (Abschnitt »Nebenbefunde im Paket« unten) — `OnStageResize` geht in `Stage2D` über `emit()` aus der Rollback-Zone von `resize()` heraus (Ursache von BUG-006); `Canvas2DStage` lädt ein Canvas ohne Fläche hoch (Ursache des Stage-Teils von BUG-021)
- Ziel: Die Stage-Schicht weist ungültige Bäume und Werte ab, meldet ihre Zustandswechsel strikt und folgt Größenänderungen des Canvas.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts`, `StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/StageRendererTargets.ts`
  - `packages/twopoint5d/src/stage/IStageRendererHost.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts`, `Stage2D.spec.ts`
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts`, `Canvas2DStage.spec.ts`
  - `packages/twopoint5d/src/stage/fitIntoRectangle.ts`, `OrthographicProjection.ts`, `ParallaxProjection.ts`, `OrthographicProjection.spec.ts`, `ParallaxProjection.spec.ts`
  - `packages/twopoint5d/src/stage/ProjectionPlane.ts`, `ProjectionPlane.spec.ts`
  - `packages/twopoint5d-testing/test/stage-canvas2d.test.js`
  - `packages/twopoint5d/src/stage/README.md`, `packages/twopoint5d/docs/resource-lifecycle.md` (§1), `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]` samt Migration Guide)
- Hängt ab von: —
- Verify: `pnpm run ci` (exit 0). Zur Fehlersuche: `pnpm nx test twopoint5d -- src/stage/`, `pnpm typecheck`, `pnpm test:browser`.
- Commit: `fix(twopoint5d)!: refuse a StageRenderer that is or holds the renderer it is added to and a parent or host that has been disposed, let every listener of a camera, scene, size or first-frame change of a Stage2D hear it before the error comes out, let a Canvas2DStage follow a canvas resized in place, release only the sprite material it built and upload no canvas without area, check the sizes of StageRenderer#resize() and Canvas2DStage, refuse an unknown plane description and take anchorPosition out of the projection specs`
- Verlauf:
  - 2026-10-23 Zug 0: Detailplan steht · BUG-004 unverändert (`StageRenderer.ts:1298`/`1321`, Rekursion über `resize()` Z. 482) · BUG-005 unverändert (Setter `parent` Z. 299–330, TSDoc Z. 273–274 nennt den stillen Fall gewollt) · BUG-006 unverändert (`Stage2D.ts:69`, `:185`, `:326`) · BUG-007 unverändert (`Canvas2DStage.ts:217`, `:149`, `:186`) · IMPL-001 unverändert (`OrthographicProjection.ts:156`, `ParallaxProjection.ts:161`, `fitIntoRectangle.ts:45`) · MEM-003 unverändert (`Canvas2DStage.ts:300`, `:162`) · BUG-021 Stage-Teil unverändert (`StageRendererTargets.ts:136`, `Canvas2DStage.ts:114`, `:183`), Map2D-Teil (`Map2DTileCoordsUtil.ts:104/111`, `Map2DTileStreamer.ts:40/47/125/142`, `Map2DSpatialHashGrid.ts:70`) an Paket 8 · BUG-022 unverändert (`ProjectionPlane.ts:31`) · kein Commit dieses Laufs hat `src/stage/` berührt · offene Folgen: keine · »Offene Befunde«: ein Eintrag (Paket 1, Doku), andere Ursache, bleibt liegen · zwei Nebenbefunde gleicher Ursache ins Paket
  - 2026-10-23 Zug 1: Implementierer beauftragt (Opus, Effort high, `claude -p`, Brief `paket-5.impl-0.brief.md`, Report `paket-5.impl-0.json`)
  - 2026-10-23 Zug 2: Report FERTIG · 19 Dateien geändert (`src/stage/` 17, `stage-canvas2d.test.js`, `CHANGELOG.md`, `resource-lifecycle.md` §1), keine neue · 23 Vitest-Regressionstests, ein Typfall und ein Browser-Test vor dem Fix rot · Arbeitsbaum schmutzig · zwei Nebenbefunde gemeldet (`Canvas2DStage.ts:35` `fit` ungeprüft; `OnCanvas2DStageResize` per `emit()` vor `#lastWidth`/`#lastHeight`) · Verify `pnpm run ci` exit=0, Log `paket-5.verify.log`
  - 2026-10-23 Zug 3: Reviewer (Opus, high) — alle acht Findings und beide Nebenbefunde erfüllt · 0 kritisch, 3 wichtig (Changelog-Vorzustand `CHANGELOG.md:148`, TSDoc `Canvas2DStage#dispose()` zu `setCanvasSize()`, TSDoc `StageRenderer#dispose()` zu `resize()`), 7 klein; Befund `CHANGELOG.md:108` (Vorzustand in veröffentlichter Doku) nach der Konvention auf wichtig gehoben · Diff `paket-5.diff`, Report `paket-5.review-0.json`
  - 2026-10-23 Zug 4 Runde 1: offen die vier wichtigen plus klein `Stage2D.ts:149` (Prüfung `this.projection != null`) → derselbe Implementierer per `--resume 7134cb08-…` (Opus, high), Report `paket-5.impl-1.json`
  - 2026-10-23 Zug 4 Runde 1 zurück: FERTIG, alle fünf behoben · `CHANGELOG.md`, `Canvas2DStage.ts`, `StageRenderer.ts`, `Stage2D.ts`, `Stage2D.spec.ts` · Regressionstest `a camera listener that takes the projection away as the previous one lets go of its camera leaves the stage without one` vor dem Fix rot (`TypeError … updateViewRect`) · Verify `pnpm run ci` exit=0 (`paket-5.verify.log`; Lauf aus Zug 2 jetzt `paket-5.verify-r0.log`) · Reviewer gezielt (Opus, medium), Diff `paket-5.r1.diff`, Report `paket-5.review-1.json`
  - 2026-10-23 Zug 4 Runde 1 Review: alle fünf erledigt, keine neuen Befunde (`paket-5.review-1.json`) · Fortschritt 5 von 5, Kette endet nach Runde 1
  - 2026-10-23 Zug 5: Commit b81c67a5 (19 Dateien) mit Trailer `Remediation-Run: 2026-10-23` · Verify-Lauf `paket-5.verify.log` exit=0 ist jünger als die letzte Änderung · Plan auf `[x]`

## Urteil des Reviewers je Finding

Review 0 (`paket-5.review-0.json`, Opus) auf dem Stand aus Zug 2, Review 1 (`paket-5.review-1.json`) auf dem Commit-Stand; beide ohne offene Erfüllungslücke.

- BUG-004 — behoben: `StageRenderer.ts:1328–1339` (Kette der Halter vor composed-mode-Prüfung und `resizeStage()`), Specs `StageRenderer.spec.ts:1577–1628`
- BUG-005 — behoben: Setter `StageRenderer.ts:301ff.` (`parent?.isDisposed === true`), `IStageRendererHost.ts:73–77`, Specs `StageRenderer.spec.ts:1630–1671`
- BUG-006 — behoben: `Stage2D.ts:149–160` (Setter `projection`), `:194–207` (Setter `camera`), `:209–220` (`#updateCamera`), `:264` (`resize()`), First-Frame-Zweig von `updateFrame()`; composed-mode-Regressionstest in `StageRenderer.spec.ts`, Stage-Fälle `Stage2D.spec.ts:1117–1233`
- BUG-007 — behoben: `#followCanvasSize()` (`Canvas2DStage.ts:~226–236`), gerufen in `render()` vor `OnCanvas2DStageResize` (`:264`) und in `setCanvasSize()` (`:221`); Browser-Test `stage-canvas2d.test.js:104–121`
- IMPL-001 — behoben: `ProjectionFitSpecs` in `fitIntoRectangle.ts:~101–106`, `OrthographicProjection.ts:18–21`, `ParallaxProjection.ts:18–21`, `@ts-expect-error` in beiden Specs, Changelog samt Migration Guide
- MEM-003 — behoben: `#material` (`Canvas2DStage.ts:~80`) in `updateTexture()` und `dispose()`, Fall (b) im Spec, `resource-lifecycle.md:172–174`
- BUG-021 (Stage-Teil) — behoben: `StageRenderer.ts:464–465` (`assertFinite`), `StageRendererTargets.ts:~143` (Fallback 1), `Canvas2DStage.ts:125–126` und `:210–211` (`assertPositiveFinite`)
- BUG-022 — behoben: `ProjectionPlane.ts:~31–42` (`isPlane`-Zweig, `TypeError` mit `describeValue()`), `@throws`, vier Spec-Fälle
- Nebenbefund `OnStageResize` — behoben: `Stage2D.ts:251–264`, Spec `Stage2D.spec.ts:1169–1185`
- Nebenbefund Upload ohne Fläche — behoben: `Canvas2DStage.ts:~170–173`

## Kleine Befunde des Reviewers (offen, ohne Runde)

- `packages/twopoint5d/src/stage/Stage2D.ts:356–359` — TSDoc von `updateFrame()` nennt nur Fehler der Projektion aus dem ausstehenden `needsUpdate`; ein werfender Kamera- oder Resize-Listener in diesem Schritt beendet den Frame ohne `OnStageFirstFrame`/`OnStageUpdateFrame`, ein werfender First-Frame-Listener lässt ihn weiterlaufen — so geplant, aber nirgends beschrieben.
- `packages/twopoint5d/src/stage/Canvas2DStage.ts:125` und `:210` — `assertPositiveFinite()` nimmt `0.5` an, das Canvas rundet auf 0; der Upload-Schutz fängt die Fläche 0 ab, die Prüfung selbst lässt den Wert durch.
- `packages/twopoint5d/src/stage/Canvas2DStage.ts:205` — `setContainerSize(NaN, …)` wirft mit dem Subjekt `StageRenderer#resize()` statt des Nutzeraufrufs (als Folge im Plan).
- `packages/twopoint5d/src/stage/Canvas2DStage.ts:264` — ändert ein Listener von `OnCanvas2DStageRender` die Canvas-Größe in place, zeigt dieser Frame die neue Textur einen Frame lang auf Sprite und Sicht der alten Größe.
- `packages/twopoint5d/src/stage/StageRenderer.ts:534` — ein Listener-Fehler der Stage nach angenommener Größe zählt in `resizeStage()` als Weigerung; Renderer und `StageItem` bleiben bis zum nächsten `resize()` auf der alten Größe. Im Detailplan hingenommen, in TSDoc und README nicht genannt.

## Nebenbefunde des Implementierers

Beide vorbestehend (in `git show da0fd577:packages/twopoint5d/src/stage/Canvas2DStage.ts` unverändert vorhanden), andere Ursache als die Findings des Pakets, in »Offene Befunde« mit `→ Scope` (Scope-Regel: alles):

- `Canvas2DStage.ts:35` Setter `fit` und Konstruktor-`fit` ungeprüft · low
- `Canvas2DStage#render()` — `OnCanvas2DStageResize` per `emit()` vor dem Schreiben von `#lastWidth`/`#lastHeight`, ein werfender Listener wiederholt das Event jeden Frame · low. Die Entscheidung zu `emitStrict()` betrifft nur `Stage2D`; ob `Canvas2DStage` denselben Weg geht, gehört zur Drain-Runde.

## Vorgehen

Vor der ersten Zeile: `AGENTS.md` im Repo-Root (Fehlermeldungsregel, `describeValue()`,
`assertFinite()`/`assertPositiveFinite()`, Doku-Regeln) und die Abschnitte §1 und §3 von
`packages/twopoint5d/docs/resource-lifecycle.md`. Die Stage-Quellen ganz lesen, nicht
grepweise. Für jeden Korrektheitsfehler zuerst den Regressionstest, rot sehen, dann
beheben; der rote Lauf gehört in den Report.

Für eventize gilt (6.2.0, `node_modules/@spearwolf/eventize/docs/emit.md`, »What changes
versus `emit()`«): `emitStrict()` ruft jeden Listener, auch hinter einem werfenden,
schreibt den `retain`-Wert auch dann, und wirft danach — einen Fehler unverändert, mehrere
als `AggregateError` in Aufrufreihenfolge. `throwCollected(errors, message)` aus
`src/utils/throwCollected.ts` wirft nichts, einen unverändert oder ein `AggregateError`
mit `message`.

### 1. `StageRenderer#add()` weist Zyklen ab (BUG-004)

In `add(stage)` (`StageRenderer.ts:1298`), nach den beiden Frühausstiegen
(`#disposed`, `hasStage()`) und nach der Prüfung auf eine disposte Stage, **vor** der
Prüfung des composed mode und vor `resizeStage()`:

```ts
// a renderer that is this one, or holds it further up, would draw itself without end: every
// resize(), updateFrame() and renderTo() would go round in a circle
if (stage instanceof StageRenderer) {
  for (let holder: StageRendererParentType | undefined = this; holder instanceof StageRenderer; holder = holder.#parent) {
    if (holder === stage) {
      throw new Error(
        holder === this
          ? `StageRenderer#add() cannot take the stage "${stage.name}": that stage is this renderer`
          : `StageRenderer#add() cannot take the stage "${stage.name}": that stage holds this renderer`,
      );
    }
  }
}
```

Die Form der Schleife ist frei, die beiden Meldungen und die Stelle sind es nicht: nichts
hat sich geändert, wenn sie wirft — keine Größe an die Stage, kein Auszug des Kinds aus
seinem Halter, kein Event. Der Setter `parent` läuft für einen `StageRenderer` über
`add()` und erbt die Prüfung (`a.parent = enkelVonA` wirft dieselbe Meldung).

TSDoc von `add()` (Z. 1252–1297): ein Satz nach dem über die disposte Stage — ein
`StageRenderer`, der dieser Renderer ist oder ihn hält, als `parent` oder weiter oben,
wird abgewiesen, mit einem Fehler, der Aufruf und Stage nennt, bevor die Stage die Größe
bekommt; beide zeichneten einander sonst ohne Ende. TSDoc des Setters `parent`
(Z. 268–294): dort steht »everything `add()` says holds here« — einen Halbsatz ergänzen,
dass das die Abweisung eines Renderers einschließt, den dieser Renderer hält.

Specs in `StageRenderer.spec.ts` (eigenes `describe('a renderer holds no renderer that holds it')` oder unter den vorhandenen `add()`-Fällen):

1. `root.add(root)` wirft `…that stage is this renderer`; `root.stages` leer, `root.parent`
   unverändert (an einem `makeHost()`-Host: `host._unsubs === 0`), kein `OnStageAdded`.
2. **Regressionstest:** `a.add(b); expect(() => b.add(a)).toThrow('…that stage holds this renderer')`;
   `a.parent` wie zuvor, `b.parent === a`, `b.stages` leer; danach endet `a.resize(10, 10)`
   (kein `RangeError: Maximum call stack size exceeded`). Vor dem Fix nimmt `b.add(a)` an
   und `resize()` läuft in den Stack-Überlauf — das ist der rote Lauf.
3. Drei Ebenen: `a.add(b); b.add(c)`, dann `c.add(a)` und `a.parent = c` werfen
   `…that stage holds this renderer`; `a` bleibt an seinem Host.

### 2. `StageRenderer#parent` weist einen disposten Halter ab (BUG-005)

`IStageRendererHost.ts`: optionales Feld mit TSDoc ergänzen —

```ts
/**
 * `true` once the host has been disposed, as `Display#isDisposed` answers. A `StageRenderer`
 * refuses a host that answers `true` here; a host without the member counts as alive.
 */
readonly isDisposed?: boolean;
```

`Display` erfüllt das strukturell schon (`get isDisposed(): boolean`, `Display.ts:729`).

Im Setter `parent` (`StageRenderer.ts:299`), direkt nach `if (this.#parent === parent) return;`
und vor dem Zweig für `StageRenderer`:

```ts
// a disposed holder never drives this renderer again: taken, the renderer would look attached
// and never draw
if (parent?.isDisposed === true) {
  throw new Error(
    parent instanceof StageRenderer
      ? `StageRenderer#parent cannot take the renderer "${parent.name}": that renderer has been disposed`
      : 'StageRenderer#parent cannot take the host: that host has been disposed',
  );
}
```

Wirft, bevor dieser Renderer seinen Halter verlässt. Konstruktor und `attach()` gehen
über den Setter und werfen dasselbe. `disposedRenderer.add(x)` direkt bleibt der
dokumentierte stille Fall (dort ist `this` disposed, nicht das Übergebene); der Fall eines
Halters, den ein Listener *während* des Umzugs disposed, bleibt wie er ist
(`StageRenderer.spec.ts:1033–1129`).

TSDoc: Setter `parent` Z. 273–274 — »a disposed target renderer takes nothing, and the
assignment silently leaves this renderer with its holder« ersetzen durch: ein disposter
`StageRenderer` und ein Host, dessen `isDisposed` `true` ist, werden mit einem Fehler
abgewiesen, der Aufruf und Zustand nennt, bevor dieser Renderer seinen Halter verlässt.
Konstruktor-TSDoc (Z. 400–406) einen Satz dazu.

Specs in `StageRenderer.spec.ts`:

1. **Regressionstest:** `child` an `makeHost()`, `other = new StageRenderer(); other.dispose();`
   `expect(() => (child.parent = other)).toThrow('…cannot take the renderer "StageRenderer": that renderer has been disposed')`;
   `child.parent` ist der Host, `host._unsubs === 0`, kein `OnRemoveFromParent`. Vor dem
   Fix still — rot.
2. `new StageRenderer(host)` mit einem `makeHost()`-Host, der `isDisposed: true` trägt
   (Feld am Fixture ergänzen), wirft `StageRenderer#parent cannot take the host: that host has been disposed`,
   und der Host hat kein `onResize()`/`onRenderFrame()` bekommen.
3. `attach(disposedHost)` an einem Renderer mit lebendem Host: wirft, der Renderer bleibt
   am alten Host.

### 3. `Stage2D` meldet seine Zustandswechsel strikt (BUG-006, Nebenbefund `OnStageResize`)

Entscheidung vom 2026-10-23: Kamera-, Szenen- und Frame-Ereignis über `emitStrict()`, der
Zustand wird vor dem Weiterwerfen abgeschlossen. Dazu `OnStageResize` (Nebenbefund unten).
`OnStageUpdateFrame` bleibt bei `emit()`: es ist das Ereignis jedes Frames, kein
Zustandswechsel.

Der Kern: ein Listener-Fehler darf nie in einen der beiden Rollback-Zweige fallen
(`resize()` Z. 214–223 nimmt den Container zurück, `#updateProjection` Z. 258–273 Größe
und `needsUpdate`). Die Ankündigungen wandern deshalb hinter den Zustandswechsel, ihre
Fehler werden gesammelt und am Ende des öffentlichen Aufrufs geworfen.

- `#updateCamera(update, errors: unknown[])`: wie heute `prevCamera`, `update()`, bei
  Wechsel `try { emitStrict(this, OnStageAfterCameraChanged, ...args); } catch (error) { errors.push(error); }`.
- `#updateProjection(width, height, errors: unknown[])`: bis zur Kamera wie heute. Im
  `try` mit Rollback stehen nur noch `this.projection!.updateCamera(this.camera)` bzw.
  `const created = this.projection!.createCamera()` — was die Projektion wirft, nimmt wie
  heute Größe und `needsUpdate` zurück und geht unverändert hinaus. Danach, außerhalb
  des `try`: bei neuer Kamera `this.#updateCamera(() => { this.#cameraFromProjection = created; }, errors)`,
  dann bei neuer Größe `try { emitStrict(this, OnStageResize, props); } catch (error) { errors.push(error); }`.
  Reihenfolge Kamera vor Größe wie heute.
- `resize(cw, ch)`: `const errors: unknown[] = [];` im Änderungszweig, `try { this.#updateProjection(cw, ch, errors); } catch (error) { /* Container zurück wie heute */ throw error; }`,
  danach `throwCollected(errors, 'Stage2D#resize(): more than one listener of OnStageAfterCameraChanged and OnStageResize threw')`.
- `updateProjection(forceUpdate)`: das Array erst **im** Zweig `(forceUpdate || this.needsUpdate) && this.projection`
  anlegen — `updateFrame()` ruft die Methode in jedem Frame —, dann `#updateProjection(…, errors)`
  und `throwCollected(errors, 'Stage2D#updateProjection(): more than one listener of OnStageAfterCameraChanged and OnStageResize threw')`.
- Setter `projection`: `const errors: unknown[] = [];`, das Fallenlassen der alten Kamera
  über `#updateCamera(…, errors)`, dann — statt `this.updateProjection(true)` und nur,
  wenn die neue Projektion nicht `undefined` ist —
  `try { this.#updateProjection(this.#containerWidth, this.#containerHeight, errors); } catch (error) { errors.push(error); }`,
  zuletzt `throwCollected(errors, 'Stage2D#projection: more than one of the listeners of OnStageAfterCameraChanged and OnStageResize and the new projection threw')`.
  Wirft ein Listener beim Fallenlassen, bekommt die Stage trotzdem die Kamera der neuen
  Projektion.
- Setter `camera`: `#updateCamera(() => void (this.#cameraUserOverride = camera), errors)`;
  ist danach `this.camera == null` und eine Projektion da, `#updateProjection(…)` im
  `try`, Fehler ins Array; `throwCollected(errors, 'Stage2D#camera: more than one of the listeners of OnStageAfterCameraChanged and OnStageResize and the projection threw')`.
- Setter `scene`: `emit` → `emitStrict(this, OnStageAfterSceneChanged, ...args)`. Die Szene
  steht vorher schon; `emitStrict()` wirft selbst einen Fehler unverändert oder mehrere als
  `AggregateError`.
- `updateFrame()`: `this.updateProjection()` am Anfang wirft wie heute aus dem Aufruf
  heraus und beendet den Frame (Projektion oder Listener; nach einem Listener-Fehler ist
  `needsUpdate` aufgelöst, der Zustand steht). Der First-Frame-Zweig:

  ```ts
  if (this.isFirstFrame) {
    const errors: unknown[] = [];
    try {
      emitStrict(this, OnStageFirstFrame, {stage: this, now, deltaTime, frameNo} satisfies StageUpdateFrameProps);
    } catch (error) {
      errors.push(error);
    }
    // the first frame is over whatever its listeners threw; emitStrict() has written the retained props
    this.isFirstFrame = false;
    if (errors.length > 0) {
      // the frame goes on: the listeners of OnStageUpdateFrame get frame 1 all the same
      try {
        emit(this, OnStageUpdateFrame, props);
      } catch (error) {
        errors.push(error);
      }
      throwCollected(errors, 'Stage2D#updateFrame(): a listener of OnStageFirstFrame threw, and so did one of OnStageUpdateFrame');
      return;
    }
  }
  emit(this, OnStageUpdateFrame, props);
  ```

  Der Pfad eines gewöhnlichen Frames legt kein Array an und bleibt allokationsfrei (der
  Kommentar an `#updateFrameProps`, Z. 287–289, sagt warum).

Hingenommen, keine Änderung: `StageRenderer#resize()` zählt einen Fehler, den ein
Listener der Stage nach angenommener Größe wirft, als Weigerung dieser Stage — das
`StageItem` behält seine alte Größe, der nächste `resize()` erreicht die Stage, die die
Größe schon hat, und trägt sie ein.

TSDoc in `Stage2D.ts`: am Setter `scene` (Z. 48–55), am Getter `camera` (Z. 166, »Every
change of the camera emits …«), an `width` (Z. 104–111, `OnStageResize`) und an
`updateFrame()` (Z. 294–299) je ein Satz: jeder Listener hört das Ereignis, auch hinter
einem werfenden; die Stage hat Kamera, Szene, Größe bzw. das Ende des ersten Frames zu
dem Zeitpunkt schon übernommen, der Fehler erreicht den Aufrufer danach — einer
unverändert, mehrere als `AggregateError`.

Specs:

1. **Regressionstest** in `StageRenderer.spec.ts` beim composed mode (vorhandene
   Pipeline-Mocks): ein `Stage2D` mit Kamera, davor — vor `renderer.add(stage)` — ein
   Listener `on(stage, OnStageAfterCameraChanged, () => { throw failure; })`; einmal
   rendern; `stage.camera = new OrthographicCamera()` wirft `failure`; das nächste
   `renderTo()` baut den Output-Node neu (`buildOutputNode` ein zweites Mal gerufen bzw.
   neuer `pipeline.outputNode`). Vor dem Fix hört der Renderer nichts — rot. Derselbe Fall
   für `stage.scene = new Scene()` mit einem werfenden `OnStageAfterSceneChanged`-Listener.
2. `Stage2D.spec.ts`: ein werfender Listener von `OnStageAfterCameraChanged` beim Wechsel
   der Projektion (Stage mit Größe) — der Setter wirft den Fehler, `stage.camera` ist die
   Kamera der neuen Projektion, `stage.width`/`height` die neue Sicht. Vor dem Fix ohne
   Kamera — rot.
3. `Stage2D.spec.ts`: zwei Listener von `OnStageFirstFrame`, der erste wirft —
   `updateFrame()` wirft den Fehler unverändert, der zweite hat das Ereignis gehört,
   `isFirstFrame === false`, ein `OnStageUpdateFrame`-Listener hat Frame 1 bekommen, das
   nächste `updateFrame()` sendet `OnStageFirstFrame` keinem ein zweites Mal, ein später
   Subscriber bekommt die gehaltenen Props. Vor dem Fix rot.
4. `Stage2D.spec.ts`: ein werfender `OnStageResize`-Listener vor einem zweiten — `resize()`
   wirft, `containerWidth`/`containerHeight` sind die neuen, der zweite Listener hat
   gehört. Vor dem Fix nimmt die Stage den Container zurück — rot.
5. `Stage2D.spec.ts`: beim ersten `resize()` mit Fläche werfen ein Kamera- und ein
   Resize-Listener — ein `AggregateError` mit beiden Fehlern und der Meldung von
   `Stage2D#resize()`; Kamera, Größe, `needsUpdate === false` stehen.

### 4. `Canvas2DStage`: eigenes Material, Größe folgt dem Canvas, Prüfungen (BUG-007, MEM-003, BUG-021, Nebenbefund Upload ohne Fläche)

Entscheidung vom 2026-10-23: direktes Ändern von `canvas.width`/`canvas.height` eines
übergebenen Canvas ist ein unterstützter Weg; Sprite und Projektion ziehen nach wie bei
`setCanvasSize()`.

- **Material (MEM-003):** Feld `readonly #material: SpriteMaterial`, im Konstruktor gebaut,
  `this.sprite = new Sprite(this.#material)`. `updateTexture()` schreibt
  `this.#material.map` und `this.#material.needsUpdate` (Z. 162–163), `dispose()` gibt
  `this.#material` frei (Z. 300). TSDoc an `readonly sprite` (Z. 58) neu: das Sprite zeigt
  das Canvas über ein `SpriteMaterial` der Stage; ein Material, das der Aufrufer in den
  Slot setzt, bleibt seins — `dispose()` lässt es stehen, und die Stage schreibt die
  Canvas-Textur weiter in ihr eigenes. Die Aufzählung in der `dispose()`-TSDoc
  (Z. 256–261): »the sprite material« → das Sprite-Material, das sie gebaut hat.
- **Größe folgt dem Canvas (BUG-007):** private Methode `#followCanvasSize()`: liest
  `this.width`/`this.height` (das Canvas), kehrt zurück, wenn `#viewSpecs` beides schon
  trägt, sonst `this.sprite.scale.set(width, height, 1)`, `#viewSpecs.width/height`,
  `this.stage.updateProjection(true)`. `setCanvasSize()` schreibt das Canvas und ruft sie
  (statt Z. 186–191). `render()` ruft sie im Größenwechsel-Zweig (Z. 217) **vor**
  `OnCanvas2DStageResize`, damit ein Listener Sprite und Sicht schon in der neuen Größe
  liest; danach `#lastWidth/#lastHeight` wie heute. Gelesen wird aus dem Canvas, nicht
  aus den Argumenten: `setCanvasSize(10.5, 8)` gibt Sprite und Sicht die 10, die das
  Canvas annimmt.
- **Prüfungen (BUG-021, Stage-Teil):** Konstruktor, Zahlen-Arm: `assertPositiveFinite(width, 'new Canvas2DStage()', 'width')`
  und dasselbe für `height`, **bevor** etwas gebaut wird (vor `new StageRenderer()`).
  `setCanvasSize(width, height)`: `assertPositiveFinite(width, 'Canvas2DStage#setCanvasSize()', 'width')`
  und `height` als erste Zeilen, auch auf einer disposten Stage (resource-lifecycle §3:
  ungültige Eingaben werden weiter abgewiesen), erst danach der Frühausstieg. Der
  Canvas-Arm des Konstruktors bleibt ungeprüft — das Canvas gehört dem Aufrufer und darf
  auch ohne Fläche übergeben oder auf 0 gestellt werden.
- **Kein Upload ohne Fläche (Nebenbefund):** in `updateTexture()` direkt nach
  `if (!this.needsUpdate) return;`: hat das Canvas Breite oder Höhe 0, zurück, ohne
  `needsUpdate` zu löschen — der erste `render()` mit Fläche lädt hoch. Kommentar mit dem
  Grund (WebGPU baut keine Textur der Breite oder Höhe 0, und three.js reicht die Größe
  des Bildes ungeprüft durch, `Textures#updateTexture()`).
- TSDoc: Getter `width`/`height` (Z. 43–49) neu — die Größe des Canvas; gesetzt über
  `setCanvasSize()` oder bei einem übergebenen Canvas direkt an `canvas.width`/`height`,
  dann bringt der nächste `render()` Sprite und Sicht mit, bevor `OnCanvas2DStageResize`
  hinausgeht. `render()` (Z. 197–211): die Reihenfolge um »Sprite und Sicht folgen einer
  neuen Canvas-Größe« ergänzen. `needsUpdate` (Z. 83–87): ohne Fläche wird nicht
  hochgeladen, das Flag bleibt stehen.

Specs in `Canvas2DStage.spec.ts`:

1. **Regressionstest (BUG-007):** übergebenes Canvas 64×64, `render()`, dann
   `canvas.width = 48; canvas.height = 32; render()` — `sprite.scale` ist `(48, 32, 1)`,
   `projection.viewSpecs` `toMatchObject({width: 48, height: 32})`, und ein Listener von
   `OnCanvas2DStageResize` liest `sprite.scale.x === 48` schon. Vor dem Fix 64 — rot.
2. **Regressionstest (MEM-003), Fall (b) aus resource-lifecycle §7:** `own = stage.sprite.material`,
   `stage.sprite.material = new SpriteMaterial()`, Spies auf beide; `render()` schreibt die
   Textur in `own.map`; `dispose()` gibt `own` einmal frei und das eingesetzte nicht. Vor
   dem Fix umgekehrt — rot.
3. BUG-021: `new Canvas2DStage(renderer, 0, 10)`, `(renderer, NaN, 10)`, `(renderer, 10, -1)`
   werfen `RangeError` `new Canvas2DStage(): width must be a finite number above 0, got 0`
   bzw. `…height…`; `setCanvasSize(NaN, 10)` wirft `Canvas2DStage#setCanvasSize(): width must be a finite number above 0, got NaN`,
   das Canvas behält seine Größe; auf einer disposten Stage wirft derselbe Aufruf ebenso.
4. Upload ohne Fläche: übergebenes Canvas, `canvas.width = 0`, `render()` — keine Textur
   gebaut (`stage.texture` bleibt `undefined`), `needsUpdate === true`; `canvas.width = 32`,
   `render()` — Textur da.

Browser-Test in `packages/twopoint5d-testing/test/stage-canvas2d.test.js` (Rendering
ändert sich, AGENTS.md »Two test surfaces«), neben »shows a canvas of another size
through a new texture«: nach `setup()` und einem `render()` `stage.canvas.width = 128; stage.canvas.height = 32;`
blau füllen, `needsUpdate = true`, `render()`. Ein `contain` von 128×32 im Container
64×64 gibt eine Sicht von 128×128, das Canvas liegt als Band von 16 Pixeln Höhe quer
durch die Mitte: das Mittelpixel ist blau, ein Pixel bei `x = 32` in den obersten und in
den untersten Zeilen (`y = 2`, `y = 61`) ist es nicht (dort steht das Rot des ersten
Frames, der Renderer räumt das Ziel nicht). Vor dem Fix zeigt das gestreckte Sprite das
ganze Ziel blau — rot.

### 5. `StageRenderer#resize()` und die Render-Targets (BUG-021, Stage-Teil)

- `StageRenderer#resize(width, height)` (Z. 447): als erste Zeilen
  `assertFinite(width, 'StageRenderer#resize()', 'width')` und dasselbe für `height`
  (`src/utils/assertFinite.ts`, `RangeError`), vor dem Größen-Guard, auch auf einem
  disposten Renderer. 0 und negative Werte bleiben zulässig: 0 ist die Größe eines Hosts
  ohne Layout, `#deviceSize()` hebt jeden Wert unter 1 auf 1, `#canCompose()` und
  `Stage2D` zeichnen für eine Größe ohne Fläche nichts.
- `StageRendererTargets#deviceSize(size)` (Z. 135): ein nicht endlicher Wert gibt 1 —
  `return isFiniteNumber(size) ? Math.max(1, Math.floor(size * this.#pixelRatio)) : 1;`
  (`src/utils/isFiniteNumber.ts`). Das deckt die öffentlichen Felder `width`/`height`, die
  ein Aufrufer am `resize()` vorbei beschreiben kann.
- TSDoc von `resize()` (Z. 426–446): ein Satz — Breite und Höhe müssen endliche Zahlen
  sein, `NaN` und Unendlich werden mit einem `RangeError` abgewiesen, der den Aufruf nennt,
  bevor sich etwas ändert.

Specs in `StageRenderer.spec.ts`:

1. **Regressionstest:** `sr.resize(NaN, 10)` wirft `StageRenderer#resize(): width must be a finite number, got NaN`,
   `sr.resize(10, Infinity)` `…height…, got Infinity`; `width`/`height` unverändert, keine
   Stage hat `resize()` bekommen. Vor dem Fix kein Wurf — rot.
2. `sr.width = NaN` direkt, dann die Pass-Target-Größe über
   `(sr.asPassNode(renderer as any) as any).value.renderTarget` (so liest sie
   `StageRenderer.spec.ts:917`): `width === 1`. Vor dem Fix `NaN` — rot.

### 6. `anchorPosition` aus den Projektions-Specs (IMPL-001)

Entscheidung vom 2026-10-23: per `Omit` aus den Projektions-Specs, TSDoc sagt, dass es nur
für `fitIntoRectangle()`/`calculateAnchorOffset()` gilt, Bruch auf Typebene mit
Migrationshinweis.

Ein schlichtes `Omit<FitIntoRectangleSpecs, 'anchorPosition'>` verteilt sich nicht über
die Union und ließe nur die gemeinsamen Schlüssel stehen; gebraucht wird ein verteilendes.
In `fitIntoRectangle.ts`, hinter `FitIntoRectangleSpecs`, ein exportierter Typ (über
`export *` in `public-api.ts` öffentlich, damit `checkNameableTypes` ihn benennen kann):

```ts
/**
 * The arms of {@link FitIntoRectangleSpecs} without `anchorPosition`: how `OrthographicProjection`
 * and `ParallaxProjection` fit their view into the container. A projection centers its view on the
 * projection plane and places no anchor.
 */
export type ProjectionFitSpecs = FitIntoRectangleSpecs extends infer Specs
  ? Specs extends unknown
    ? Omit<Specs, 'anchorPosition'>
    : never
  : never;
```

In Zug 0 gegen `tsc` geprüft (Scratch-Datei mit den Arm-Formen): `{fit: 'contain', width, height}`,
`{pixelZoom}`, `{}` und ein `{fit, width, height}`-Objekt gehen als `Partial<…>` durch,
ein Objektliteral mit `anchorPosition` ist ein Fehler, und `Partial<ProjectionFitSpecs & …>`
passt weiter an `fitIntoRectangle()`.

- `OrthographicProjection.ts:16` und `ParallaxProjection.ts:16`: `… = ProjectionFitSpecs & {…}`,
  Import entsprechend. TSDoc an beiden Specs-Typen: die Sicht steht mittig auf der
  Projektionsebene; ein `anchorPosition` nehmen sie nicht.
- TSDoc an `FitIntoRectangleSpecs` (Z. 41) neu: `anchorPosition` liest allein
  `calculateAnchorOffset()` — `fitIntoRectangle()` rechnet die Größe der Sicht und
  überlässt ihre Lage dem Aufrufer; die Projektionen nehmen `ProjectionFitSpecs`, ohne
  `anchorPosition`.
- Kommentar an `Canvas2DViewSpecs` (`Canvas2DStage.ts:14–19`): »one arm of the
  `FitIntoRectangleSpecs` union« → `ProjectionFitSpecs`.
- Specs: in `OrthographicProjection.spec.ts` und `ParallaxProjection.spec.ts` je ein Fall
  mit `// @ts-expect-error` auf `new …Projection('xy|bottom-left', {fit: 'contain', width: 640, height: 480, anchorPosition: 'top left'})`
  (`pnpm typecheck` prüft die Specs mit; das Muster steht z. B. in
  `src/utils/Dependencies.spec.ts`). `fitIntoRectangle.spec.ts` bleibt, wie es ist.

### 7. `new ProjectionPlane()` weist eine unbekannte Beschreibung ab (BUG-022)

Im Konstruktor (`ProjectionPlane.ts:29`) wird aus dem `else` ein
`else if ((planeDescription as Partial<THREE_Plane> | null | undefined)?.isPlane === true)`
für die eigene Ebene (Inhalt wie heute), und ein neues `else` wirft:

```ts
throw new TypeError(
  `ProjectionPlane: unknown plane description ${describeValue(planeDescription)}, expected "xy|bottom-left", "xy|top-left", "xz|bottom-left", "xz|top-left" or a THREE.Plane`,
);
```

`TypeError`, weil die Art des Arguments nicht stimmt (wie `StageRenderer#renderTo()` für
einen `WebGLRenderer`); Subjekt `ProjectionPlane:` wie die vorhandene Meldung im selben
Konstruktor. Eine `ProjectionPlane`-Instanz, direkt an den Konstruktor gegeben, wird jetzt
ebenfalls abgewiesen (sie trägt `clone()` und landete bisher als falsch typisierte
`plane`). TSDoc am Konstruktor: `@throws {TypeError}` für eine unbekannte Beschreibung.

Specs in `ProjectionPlane.spec.ts`: **Regressionstest** `new ProjectionPlane('xy|bottom_left' as any)`
wirft `TypeError` mit `"xy|bottom_left"` in der Meldung (vor dem Fix
`planeDescription.clone is not a function` — rot); `new ProjectionPlane({} as any)` wirft;
`new OrthographicProjection('xy' as any)` wirft dieselbe Meldung; eine `THREE.Plane` mit
`up` geht wie bisher.

### 8. Doku, Changelog

Skill `updating-changelog` für `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`:

- Changed (**BREAKING** for TypeScript): `OrthographicProjectionSpecs` und
  `ParallaxProjectionSpecs` ohne `anchorPosition`, neuer Typ `ProjectionFitSpecs`.
  Migration Guide: das Feld streichen — keine Projektion hat es je gelesen, die Sicht steht
  mittig wie zuvor; wer die Sicht im Container verankern will, rechnet mit
  `fitIntoRectangle()` und `calculateAnchorOffset()` und setzt die Kamera selbst.
- Changed (**BREAKING**): eine Zuweisung an `StageRenderer#parent`, `attach()` und der
  Konstruktor weisen einen disposten `StageRenderer` und einen Host mit `isDisposed === true`
  ab; `IStageRendererHost` hat das optionale `isDisposed`. Migration Guide: vor der
  Zuweisung `isDisposed` prüfen bzw. einen neuen Renderer/Host bauen.
- Fixed: `StageRenderer#add()` weist einen Renderer ab, der der aufnehmende ist oder ihn
  hält; `StageRenderer#resize()` weist `NaN`/Unendlich ab, die Render-Targets bekommen
  mindestens 1×1; jeder Listener von `OnStageAfterCameraChanged`, `OnStageAfterSceneChanged`,
  `OnStageResize` und `OnStageFirstFrame` hört das Ereignis, der Zustand steht, ein
  komponierender `StageRenderer` baut neu; `Canvas2DStage` folgt einem direkt
  umgestellten Canvas, gibt nur das eigene Sprite-Material frei, lädt kein Canvas ohne
  Fläche hoch und weist ungültige Größen ab; `new ProjectionPlane()` weist eine
  unbekannte Beschreibung mit `TypeError` ab.

Codeblöcke mit `ts check` im Changelog müssen weiter typchecken.

`packages/twopoint5d/src/stage/README.md`:

- »Nested `StageRenderer`« (Z. 175–198): ein Satz — ein Renderer nimmt weder sich selbst
  noch einen, der ihn hält; `add()` und `parent` weisen das ab.
- »Custom host« (Z. 624–655): ein Host mit `isDisposed === true` wird abgewiesen; das Feld
  ist optional.
- »Events you can subscribe to«, `On Stage2D` (Z. 598–609): ein Absatz wie der zum
  `StageRenderer` (Z. 593–596) — ein werfender Listener von `OnStageAfterCameraChanged`,
  `OnStageAfterSceneChanged`, `OnStageResize` oder `OnStageFirstFrame` kürzt den Aufruf
  nicht ab, die Stage übernimmt den Wechsel, der Fehler kommt danach; `OnStageUpdateFrame`
  geht über `emit()`, ein werfender Listener beendet den Frame für die hinter ihm.
  `On Canvas2DStage` (Z. 612–616): `OnCanvas2DStageResize` kommt, wenn Sprite und Sicht
  der neuen Canvas-Größe schon folgen, auch nach einer direkten Änderung des Canvas.
- »Resource lifecycle« (Z. 716–721, `Canvas2DStage.dispose()`): das Sprite-Material, das
  die Stage gebaut hat; ein in den Slot gesetztes bleibt beim Aufrufer.

`packages/twopoint5d/docs/resource-lifecycle.md` §1, Absatz »A resource replaced while the
instance lives …« (der Satz über `FeatureSprites#dispose()` und den `geometry`-/`material`-Slot):
`Canvas2DStage#dispose()` als zweiten Fall für den `material`-Slot ihres `sprite` nennen.
Paket 10 schreibt in §4/§6 derselben Datei — nicht anfassen.

## Abweichungen von der Empfehlung und Gründe

- **BUG-004:** zwei Meldungen statt einer (»is this renderer« / »holds this renderer«);
  der Selbstfall liest sich sonst falsch. Prüfung vor jeder Zustandsänderung, nicht nur
  »vor dem Resize«: sonst verließe das Kind seinen Halter, bevor die Abweisung kommt.
- **BUG-005:** Meldungen im Muster der Nachbarn (»that pool has been disposed«), getrennt
  nach Renderer und Host. `IStageRendererHost` bekommt `isDisposed` optional, damit der
  Vertrag am Interface steht und eigene Hosts nichts nachrüsten müssen.
- **BUG-006:** zusätzlich `OnStageResize` (Nebenbefund gleicher Ursache, unten). Die
  Ankündigungen wandern aus den Rollback-Zweigen, sonst nähme ein Listener-Fehler unter
  `emitStrict()` Container und Größe zurück, obwohl die Stage beides übernommen hat.
- **BUG-007:** erste Variante der Empfehlung (gemeinsame private Methode); die
  Entscheidung vom 2026-10-23 schließt die TSDoc-Variante aus.
- **BUG-021:** geteilt. Der Map2D-Teil geht an Paket 8 — dort stehen BUG-014 (dieselbe
  Art Zahlprüfung an Map2D-Einstiegen) und die Umbauten genau der Dateien
  `Map2DTileStreamer.ts` und `Map2DSpatialHashGrid.ts`, dazu die Allokations-Specs in
  `src/map2d/`, an denen ein neuer Setter für `centerX`/`centerY` gemessen werden muss. Im
  Stage-Teil beide Varianten der Empfehlung: Abweisung in `StageRenderer#resize()` (das
  Paketziel »weist ungültige Werte ab«) und der Schutz in `#deviceSize()` für die direkt
  beschreibbaren Felder. Negative Werte bleiben zulässig (Grund in Schritt 5).
- **IMPL-001:** zweite Variante, wie entschieden; verteilendes `Omit` als benannter Typ,
  weil ein schlichtes die Union zerlegt.
- **BUG-022:** `TypeError` statt `Error`; Subjekt `ProjectionPlane:` wie die Nachbarmeldung.

## Nebenbefunde im Paket

Beide vorbestehend: kein Commit dieses Laufs hat `src/stage/` berührt
(`git log 9b72e4bd~1..HEAD -- packages/twopoint5d/src/stage` leer).

- `packages/twopoint5d/src/stage/Stage2D.ts:281` — `OnStageResize` geht über `emit()` aus
  `#updateProjection` heraus, das `resize()` in seinem Rollback-`try` (Z. 214–223) ruft:
  ein werfender Listener nimmt den Container zurück, obwohl Sicht und Kamera schon stehen,
  und die Listener hinter ihm hören die Größe nie. Dieselbe Ursache wie BUG-006 (Zustands-
  ereignis über `emit()` vor abgeschlossenem Zustand) · low · in Schritt 3.
- `packages/twopoint5d/src/stage/Canvas2DStage.ts:141–168` — `updateTexture()` lädt auch
  ein Canvas der Breite oder Höhe 0 hoch; three.js reicht die Größe ungeprüft an das
  Backend (`node_modules/three/src/renderers/common/Textures.js:290`), WebGPU baut keine
  Textur ohne Fläche. Dieselbe Ursache wie der Stage-Teil von BUG-021 (eine Größe ohne
  Fläche erreicht den Upload); über den Canvas-Arm und die entschiedene direkte Änderung
  des Canvas lässt sie sich nicht an einer Schnittstelle abweisen · low · in Schritt 4.

## Findings im Volltext

**BUG-004 · medium · packages/twopoint5d/src/stage/StageRenderer.ts:1321** (auch `:1298`, `:482`) — Zyklische Verschachtelung in `StageRenderer#add()` abweisen
`add()` prüft nur `hasStage(stage)` und ob die Stage disposed ist. Ein Renderer, der sich selbst hinzufügt (`root.add(root)`), oder zwei Renderer, die sich gegenseitig aufnehmen (`a.add(b); b.add(a)` – `b` verlässt dabei `a` nicht, weil `a` Kind von `b` wird und `b` Kind von `a` bleibt), werden ohne Fehler angenommen. Der nächste `resize()`, `updateFrame()` oder `renderTo()` läuft dann in eine endlose Rekursion: `resize()` schreibt `width`/`height` vor der Stage-Schleife, die StageItems aber erst nach dem `resize()` der Stage, sodass der Guard nie greift. Ergebnis ist ein `RangeError: Maximum call stack size exceeded` aus dem Frame-Loop, ohne Hinweis auf die Ursache; die Spec prüft den Fall nicht.
Beleg: `const child = stage instanceof StageRenderer ? stage : undefined;` – kein Test, ob `child === this` oder `this` unter den Vorfahren/Nachfahren von `child` liegt
Empfehlung: Vor dem Resize in `add()` die Kette `this`, `this.parent`, … nach `stage` absuchen (nur `StageRenderer`-Eltern) und mit einem Fehler im Projektformat abweisen, z. B. `StageRenderer#add() cannot take the stage "…": it holds this renderer`. Ein Spec-Fall für Selbst- und Kreuzaufnahme dazu.

**BUG-005 · medium · packages/twopoint5d/src/stage/StageRenderer.ts:303** (auch `:380`, `:407`) — Disposed Parent oder Host in `StageRenderer#parent` abweisen
`resource-lifecycle.md` §3 verlangt: ein Konstruktor oder eine Methode, der eine bereits disposte Instanz übergeben wird, weist sie mit einem Fehler zurück, statt etwas zu bauen, das lebendig aussieht und nichts tut. `new StageRenderer(disposedRenderer)` bzw. `child.parent = disposedRenderer` endet in `parent.add(this)`, das auf dem disposten Renderer still zurückkehrt – das TSDoc des Setters dokumentiert das sogar als gewollt. Bei einem disposten `Display` als Host abonniert `#addToHost()` über `on(this, …)` Events eines Displays, das nach `off(this)` nie wieder feuert; `parent` zeigt dann auf den toten Host und `OnAddToParent` geht raus. In beiden Fällen rendert der Renderer nie, ohne dass ein Fehler erscheint.
Beleg: `if (parent instanceof StageRenderer) { parent.add(this); return; }` – `add()` beginnt mit `if (this.#disposed) return this;`
Empfehlung: Im `parent`-Setter (und damit im Konstruktor und in `attach()`) einen Parent oder Host mit `isDisposed === true` mit `StageRenderer#parent cannot take the parent: it has been disposed` abweisen, analog zu `add()` für disposte Stages und zum `internalTargetPool`-Setter; das TSDoc entsprechend anpassen.

**BUG-006 · medium · packages/twopoint5d/src/stage/Stage2D.ts:185** (auch `:69`, `:326`) — Zustandsereignisse von `Stage2D` mit `emitStrict` senden
`OnStageAfterCameraChanged`, `OnStageAfterSceneChanged` und `OnStageFirstFrame` gehen über `emit()` raus, das beim ersten werfenden Listener abbricht. Ein `StageRenderer` erfährt Kamera- und Szenenwechsel nur über genau diese Events (`#outputDirty = true`); steht vor ihm ein Listener, der wirft, bleibt im composed mode der alte Pass-Node mit alter Szene/Kamera im Pipeline-Graph, bis zufällig etwas anderes einen Rebuild auslöst. Im `projection`-Setter verhindert der Wurf außerdem das folgende `updateProjection(true)`: die Stage hat die neue Projektion, aber keine Kamera. Bei `OnStageFirstFrame` bleibt `isFirstFrame` nach einem Wurf `true` und der retained Wert ungeschrieben, sodass die Listener vor dem werfenden das First-Frame-Event im nächsten Frame ein zweites Mal bekommen. Die Dispose-Pfade derselben Klasse nutzen dagegen `emitStrict` und sammeln Fehler.
Beleg: `emit(this, OnStageAfterCameraChanged, ...args);` / `emit(this, OnStageFirstFrame, …); this.isFirstFrame = false;`
Empfehlung: Die drei Zustandsereignisse mit `emitStrict()` senden und den Zustand (`isFirstFrame = false`, ausstehendes `updateProjection`) vor dem Weiterwerfen abschließen, so wie `dispose()` es mit gesammelten Fehlern tut; Spec-Fall mit einem werfenden Listener vor einem `StageRenderer` im composed mode.

**BUG-007 · medium · packages/twopoint5d/src/stage/Canvas2DStage.ts:217** (auch `:149`, `:186`) — Sprite und Projektion von `Canvas2DStage` an extern geänderte Canvas-Größe anpassen
`width`/`height` lesen direkt `canvas.width`/`canvas.height`, und `render()` erkennt eine geänderte Canvas-Größe: es feuert `OnCanvas2DStageResize`, und `updateTexture()` baut eine neue Textur in der neuen Größe. `sprite.scale` und die `#viewSpecs` der Projektion werden aber nur in `setCanvasSize()` nachgezogen. Ändert der Aufrufer die Größe eines Canvas, das er dem Konstruktor übergeben hat und das ihm gehört, direkt (`canvas.width = …`), zeigt die Stage das neue Bild auf einem Sprite der alten Größe in einem View der alten Specs – verzerrt bzw. beschnitten, obwohl das Resize-Event den Wechsel meldet.
Beleg: `if (this.width !== this.#lastWidth || this.height !== this.#lastHeight) { this.dispatchEvent(OnCanvas2DStageResize); … }` – kein `sprite.scale.set()`, kein `#viewSpecs`-Update
Empfehlung: Im Größenwechsel-Zweig von `render()` dieselbe Anpassung wie in `setCanvasSize()` ausführen (Sprite-Scale, `#viewSpecs.width/height`, `stage.updateProjection(true)`), am besten über eine gemeinsame private Methode; oder im TSDoc klar festlegen, dass Größenänderungen nur über `setCanvasSize()` gehen.

**IMPL-001 · medium · packages/twopoint5d/src/stage/OrthographicProjection.ts:156** (auch `ParallaxProjection.ts:161`, `fitIntoRectangle.ts:45`) — `anchorPosition` in den Projektions-Specs umsetzen oder aus dem Typ nehmen
`OrthographicProjectionSpecs` und `ParallaxProjectionSpecs` bauen auf `FitIntoRectangleSpecs` auf, das in jedem Arm ein `anchorPosition` anbietet. Keine der beiden Projektionen liest es: `#applyToCamera()` setzt den Frustum immer symmetrisch um die Mitte (`left = -halfWidth` …), und außer `fitIntoRectangle.ts` selbst referenziert nichts im Quelltext `anchorPosition`, `calculateAnchorOffset` oder `parseAnchorPosition`. Wer `{fit: 'contain', width: 640, height: 480, anchorPosition: 'top left'}` angibt, bekommt ohne Hinweis eine zentrierte Ansicht.
Beleg: `camera.left = -this.#halfWidth; camera.right = this.#halfWidth;` – kein Anchor-Offset
Empfehlung: Entweder den Offset aus `calculateAnchorOffset()` (in View-Einheiten) in `#applyToCamera()` auf Frustum oder Kameraposition anwenden und testen, oder `anchorPosition` aus den Projektions-Specs herausnehmen (z. B. `Omit` im Specs-Typ) und im TSDoc sagen, dass es nur für `fitIntoRectangle()`/`calculateAnchorOffset()` gilt.

**MEM-003 · low · packages/twopoint5d/src/stage/Canvas2DStage.ts:300** (auch `:162`) — Eigenes `SpriteMaterial` in `Canvas2DStage` festhalten statt den Slot zu lesen
`dispose()` gibt `this.sprite.material` frei, und `updateTexture()` schreibt `map` in `this.sprite.material` – also in das, was gerade im Material-Slot des öffentlichen `sprite` steckt. Setzt der Aufrufer dort ein eigenes Material, entsorgt `dispose()` dieses fremde Material und lässt das selbst gebaute `SpriteMaterial` liegen. `resource-lifecycle.md` §1 verlangt, dass `dispose()` nur freigibt, was die Instanz selbst gebaut hat, und dass ein vom Aufrufer eingesetztes Geometry/Material dem Aufrufer bleibt (so gelöst in `FeatureSprites#dispose()`).
Beleg: `this.sprite.material.dispose();`
Empfehlung: Das im Konstruktor gebaute Material in einem privaten Feld halten, in `updateTexture()` und `dispose()` dieses Feld verwenden und einen Spec-Fall (b) für ein ersetztes Material ergänzen.

**BUG-021 · low · packages/twopoint5d/src/stage/StageRendererTargets.ts:136** (auch `Canvas2DStage.ts:114`, `:183`; Map2D-Teil an Paket 8: `Map2DTileCoordsUtil.ts:104`, `:121`, `Map2DTileStreamer.ts:125`, `:142`, `:40`, `Map2DSpatialHashGrid.ts:70`) — Zahlen an öffentlichen Stage- und Map2D-Einstiegen mit `assertFinite()` prüfen
`#deviceSize()` soll mit `Math.max(1, …)` eine Mindestgröße sichern, aber `Math.max(1, NaN)` ist `NaN`: ein `StageRenderer#resize(NaN, …)` (öffentlich) führt zu `rt.setSize(NaN, NaN)` bzw. `new RenderTarget(NaN, …)` und erst die GPU meldet den Fehler. `Canvas2DStage` übernimmt Breite und Höhe in Konstruktor und `setCanvasSize()` ungeprüft: `0`, negative Werte oder `NaN` landen im Canvas (als 0), im Sprite-Scale (`NaN`) und in den View-Specs, und der erste Upload versucht eine Textur ohne Fläche. `Stage2D` und die Projektionen behandeln solche Werte dagegen ausdrücklich.
Beleg: `return Math.max(1, Math.floor(size * this.#pixelRatio));`
Empfehlung: In `Canvas2DStage` (Konstruktor, `setCanvasSize()`) Breite und Höhe über `assertPositiveFinite()` aus `src/utils/` prüfen; in `#deviceSize()` nicht-endliche Werte wie 0 behandeln (`isPositiveFinite(size) ? … : 1`) oder `StageRenderer#resize()` dieselbe Regel wie `Stage2D` geben.

**BUG-022 · low · packages/twopoint5d/src/stage/ProjectionPlane.ts:31** — Unbekannte Beschreibung in `new ProjectionPlane()` mit klarer Meldung abweisen
Der `else`-Zweig des Konstruktors nimmt alles, was keiner der vier Beschreibungen entspricht, als `THREE.Plane` und ruft `.clone()` auf. Eine vertippte Beschreibung (`'xy|bottom_left'`, aus JS oder über einen Cast, oder über `new OrthographicProjection('xy')`) endet in `TypeError: planeDescription.clone is not a function` aus dem Inneren der Klasse, ohne Subjekt und ohne den übergebenen Wert.
Beleg: `this.plane = planeDescription.clone();`
Empfehlung: Im `else`-Zweig auf `(planeDescription as THREE_Plane)?.isPlane === true` prüfen und sonst `ProjectionPlane: unknown plane description …` mit `describeValue()` werfen, wie die Projektmeldungsregel es vorgibt.
