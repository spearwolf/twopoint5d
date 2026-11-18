# Paket 12 — StageDirector: precompile() pinnt gecachte Shapes wieder synchron

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen — die `Folgen:`-Zeile von Paket 11 (a687ec89); low
- Folge von: Paket 11
- Ziel: `StageDirector#precompile()` pinnt jede schon gecachte Shape ohne laufendes Compile synchron im Aufruf, wie vor der Auslagerung in `DirectorShapeCache`; gewartet wird nur auf ein laufendes oder ein neues Compile.
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/stage/DirectorShapeCache.ts`, `packages/twopoint5d/src/stage/StageDirector.ts`, `packages/twopoint5d/src/stage/StageDirector.shapes.spec.ts`
- Vorgehen:
  1. **Regressionstest zuerst, rot sehen.** In `StageDirector.shapes.spec.ts`
     direkt nach dem Test `'keeps a shape precompile() compiled, however many it draws after it'`
     (heute Zeile 111–121) einen neuen Test anlegen, mit den vorhandenen Helfern
     `spiedEffect()`, `drawThrough()` und `draw()` des `describe('StageDirector shapes')`:

     ```ts
     it('precompile() pins every shape it holds within the call, so that draws right after it let go of none of them', async () => {
       // 15 shapes of a transition and the one of the layer: 16 the director drew itself, none let go of yet
       const effects = Array.from({length: 15}, (_, i) => spiedEffect(`effect ${i}`));
       director.setStack([a]);
       for (const effect of effects) drawThrough(effect);
       renderer.compileAsync.mockClear();

       // not awaited: the two draws below run before any microtask of the call
       const done = director.precompile(renderer as any, [[effects[1]!], [effects[0]!]]);
       drawThrough(spiedEffect('x'));
       drawThrough(spiedEffect('y'));
       await done;

       expect(effects[0]!.dispose).not.toHaveBeenCalled();
       expect(effects[0]!.build).toHaveBeenCalledTimes(1);
       expect(renderer.compileAsync).not.toHaveBeenCalled();
     });
     ```

     Warum er vor dem Fix rot ist (nachgerechnet gegen `DirectorShapeCache#current()`
     und `#evictShapes()`, `KEPT_SHAPES = 16`): nach den 15 `drawThrough()` hält der
     Cache in Nutzungsreihenfolge `t0 … t14, layer`, 16 ungepinnte, nichts verdrängt.
     Der Aufruf pinnt `effects[1]` heute noch synchron (der erste Durchlauf läuft bis
     zum ersten `await`), `effects[0]` aber erst einen Microtask später. `drawThrough(x)`
     baut die 16. ungepinnte Shape, `drawThrough(y)` die 17. — `#evictShapes()`
     verdrängt die älteste ungepinnte, `t0`: `effects[0].dispose` läuft, und der
     zweite Durchlauf von `precompile()` findet `[effects[0]]` nicht mehr, baut sie neu
     (`build` zum zweiten Mal) und compiliert (`compileAsync` einmal). Nach dem Fix
     sind beide im Aufruf gepinnt, nach `y` stehen 16 ungepinnte, nichts wird verdrängt.
     Der Renderer-Mock aus `createRendererMock()` hat `initialized: true`, also
     liegt auch kein `await renderer.init()` vor der Schleife.
     Roter Lauf: `pnpm nx test twopoint5d -- src/stage/StageDirector.shapes.spec.ts`
     — die Ausgabe gehört in den Report. Zeigt der Lauf vor dem Fix grün, stimmt
     die Rechnung nicht: dann `BLOCKIERT` mit der Ausgabe, nicht den Test umbauen,
     bis er irgendwie rot wird.
  2. **`DirectorShapeCache#precompile()` (`DirectorShapeCache.ts:384`) antwortet im
     gecachten Fall ohne Compile synchron.** Die Methode verliert `async` und wird
     ```ts
     precompile(
       renderer: WebGPURenderer,
       kinds: readonly ShapeKind[],
       nestedTarget: () => RenderTarget | undefined,
       errors: unknown[],
       stopped: () => boolean,
     ): true | Promise<boolean>
     ```
     Ablauf: `this.bindTo(renderer, errors)`, `const key = shapeKey(kinds)`,
     `const cached = this.#shapes.get(key)`. Ist `cached` da: `cached.pinned = true`;
     ohne `cached.compiling` → `return true`; sonst
     `return this.#joinCompile(cached.compiling, stopped)`. Ohne `cached`:
     `return this.#buildAndCompile(renderer, kinds, key, nestedTarget, errors, stopped)`.
     Zwei neue private `async`-Methoden direkt darunter, ihr Körper ist der heutige
     Code der Methode, unverändert in Wortlaut und Kommentaren:
     - `async #joinCompile(compiling: Promise<void>, stopped: () => boolean): Promise<boolean>`
       — der heutige `try { await cached.compiling } catch …`-Block samt Kommentar
       `// the compile another call runs: its outcome is this call's, a failure included`,
       danach `return true`.
     - `async #buildAndCompile(renderer: WebGPURenderer, kinds: readonly ShapeKind[], key: string, nestedTarget: () => RenderTarget | undefined, errors: unknown[], stopped: () => boolean): Promise<boolean>`
       — der heutige Teil ab `const entry: CachedShape = {shape: this.#buildShape(renderer, kinds), pinned: true};`
       bis `return true;`. `#buildShape()` bleibt **in** dieser `async`-Methode: ein Effekt,
       dessen `build()` wirft, kommt dann wie heute als abgelehnte Promise beim Director an.
     TSDoc von `precompile()` neu, dem Sinn nach: bindet den Cache an `renderer`, pinnt
     die Shape von `kinds` und antwortet `true` sofort, wenn sie schon compiliert ist —
     damit der Director die nächste Shape im selben Aufruf pinnt, bevor ein Draw sie
     verdrängen kann —; wartet sonst auf ein Compile, das ein anderer Aufruf führt,
     oder baut, pinnt und compiliert sie. `nestedTarget` wie heute. Die Promise
     antwortet, ob der Aufruf weitergeht: `false`, sobald ein Compile scheiterte,
     nachdem `stopped()` wahr wurde. Je eine Zeile TSDoc für die beiden neuen Methoden.
     Rückgabetyp `true | Promise<boolean>` statt des vom Reviewer genannten
     `boolean | Promise<boolean>`: der synchrone Zweig antwortet nie `false`, der
     engere Typ macht die Prüfung im Director exakt.
  3. **`StageDirector#precompile()` (`StageDirector.ts:1113–1123`) wartet nur auf eine
     Promise.** Die Schleife über `parsed` wird:
     ```ts
     for (const kinds of parsed) {
       if (this.isDisposed) break;
       const answer = this.#shapeCache.precompile(
         renderer,
         kinds,
         () => (asLayer ? (this.outputRenderTarget ?? target()) : undefined),
         errors,
         () => this.isDisposed,
       );
       // a shape compiled before is pinned now, and the next one in the same task: an await here
       // would leave room for a draw to let go of a shape the call has not pinned yet
       if (answer === true) continue;
       if (!(await answer)) break;
     }
     ```
     Der Aufruf bleibt innerhalb des bestehenden `try`: ein synchroner Wurf aus
     `bindTo()` oder `shapeKey()` landet im selben `catch` wie heute die Ablehnung.
     Das öffentliche TSDoc von `precompile()` bleibt wortgleich.
  4. Nichts sonst. Kein CHANGELOG-Eintrag und keine Änderung an `docs/stages.md`:
     der synchrone Pin war das Verhalten von v0.25.0 (`git show v0.25.0:…/StageDirector.ts:1416–1426`,
     `continue` ohne `await`), die Lücke kam erst mit a687ec89 nach dem Tag
     (`git tag --contains a687ec89` leer) und war nie veröffentlicht; die öffentliche
     Doku hat den Zeitpunkt des Pinnens nie zugesagt. `docs/architecture.md:261`
     („the 16 drawn last beside those `precompile()` pinned") stimmt weiter.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): pin every shape a director holds within the call of precompile(), so that a draw right after the call lets go of none of them`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · Folge aus Paket 11 unverändert (`StageDirector.ts:1115` `await this.#shapeCache.precompile(…)`, `DirectorShapeCache.ts:384` `async precompile()`; v0.25.0 `StageDirector.ts:1416–1426` pinnte per `continue` ohne `await`) · Regressionsszenario gegen `KEPT_SHAPES = 16` und die LRU-Ordnung von `#shapes` nachgerechnet · Folge aus Paket 11b (`docs/superpowers/plans/2026-11-17-camera-rig.md:61`) als kein Befund eingeordnet (Grund unten) · aus »Offene Befunde« nichts übernommen
  - 2026-11-18 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-12.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG · geändert `DirectorShapeCache.ts`, `StageDirector.ts`, `StageDirector.shapes.spec.ts` · Regressionstest vor dem Fix rot (`effects[0].dispose` 1×, `StageDirector.shapes.spec.ts:136`) · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-12.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (sonnet, medium): Befund behoben, keine Befunde · Diff `paket-12.diff`
  - 2026-11-18 Zug 4: entfällt, 0 Runden
  - 2026-11-18 Zug 5: Commit dcf9512c, Verify aus Zug 2 (exit=0), seither keine Codeänderung

## Befund im Volltext

**Folge aus Paket 11 · low · `packages/twopoint5d/src/stage/StageDirector.ts:1115` mit `DirectorShapeCache.ts:384`**
— `precompile()` wartet je Shape auf `await this.#shapeCache.precompile(…)`, auch für
eine schon gecachte Shape ohne laufendes Compile; die gecachten Shapes werden nicht
mehr alle synchron im Aufruf gepinnt, ein synchroner Draw direkt danach kann bei mehr
als 16 ungepinnten Shapes eine verdrängen und ein zweites Compile auslösen.
Abhilfe laut Reviewer von Paket 11: `DirectorShapeCache#precompile()` antwortet im
gecachten Fall synchron mit `boolean | Promise<boolean>`, der Director wartet nur auf
eine Promise.

Einordnung (Zug 0 von Paket 11b, hier bestätigt): echte Folge — eine `async`-Grenze,
die der Umbau neu geöffnet hat, nicht dieselbe Ursache wie ARCH-001.

## Triage in Zug 0

- **Folge aus Paket 11b** — `docs/superpowers/plans/2026-11-17-camera-rig.md:61` nennt
  `#updateCamera()` als Member von `Stage2D`: **kein Befund.** Die Datei ist ein datierter
  Bauplan (Aufgaben mit Checkboxen, »Fail, implement, pass«) und hält den Plan vom
  2026-11-17 fest, nicht den heutigen Code. In der Sache stimmt der Schritt weiter:
  Attach, Detach und `announceCamera()` laufen durch `Stage2DCamera#updateCamera()`
  (`Stage2DCamera.ts:213, 283, 300`), erreicht über `Stage2DInternals.attachDriver`/
  `detachDriver`/`announceCamera` (`Stage2D.ts:82–84`). Kein Paket dieses Laufs hat
  `docs/superpowers/plans/` angefasst (`git log 2e3f585b..HEAD -- docs/superpowers` leer),
  und einen Bauplan jedem Refactor nachzuziehen, hieße, ein Protokoll umzuschreiben.
- **»Offene Befunde«**: kein Eintrag teilt die Ursache dieses Pakets. Der Eintrag zu
  `DirectorShapeCache.ts:179` (`parseShapes()` schreibt die Regel von `isRecord()` aus)
  liegt in derselben Datei, hat aber eine andere Ursache und bleibt in der Queue.
- **Restplan**: unverändert. Paket 11c (Projektionen) berührt weder `StageDirector.ts`
  noch `DirectorShapeCache.ts`; die Reihenfolge 12 → 11c bleibt.

## Urteil des Reviewers

- Folge aus Paket 11: **behoben** — `DirectorShapeCache.ts:394–402` pinnt eine gecachte Shape ohne laufendes Compile synchron und antwortet `true`; `StageDirector.ts:1115–1126` geht dann per `continue` ohne `await` zur nächsten. Regressionstest in `StageDirector.shapes.spec.ts` nach dem Test `keeps a shape precompile() compiled, however many it draws after it`.
- Qualität: keine Befunde (Fehlerpfade: `#buildShape()` bleibt in `#buildAndCompile()`, synchrone Würfe aus `bindTo()`/`shapeKey()` landen im bestehenden `try`; einziger Aufrufer; Konventionen eingehalten).
- Kleine Befunde: keine.
