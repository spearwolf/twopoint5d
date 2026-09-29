# Paket 9 — Drain: Folgen des Laufs in Stage-Code, Doku und Tests

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings · zwölf Reviewer-Befunde »klein« aus den Paketen 2, 4, 6, 6b, 6c, 6d (Folge von: Paketen 2, 4, 6, 6b, 6c, 6d), dazu drei Stellen gleicher Ursache (siehe Abgleich)
- Ziel: Was die Pakete dieses Laufs an kleinen Unschärfen in Stage-Code, Doku und Tests hinterlassen haben, ist behoben — Stage2D#dispose() verliert keinen Fehler mehr, README und TSDoc sagen, was gilt, und die Tests stehen dort und lesen sich so, wie ihr Name sagt.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - Bibliothek: `packages/twopoint5d/src/stage/Stage2D.ts`, `src/stage/StageRenderer.ts` (nur TSDoc von `dispose()`), `src/stage/outputNodeBuilders.ts` (nur TSDoc von `OutputNodeBuilder`), `src/stage/StageRendererTargets.ts` (nur Feld-TSDoc), `src/stage/StageRenderOrder.ts` (nur Kommentar/TSDoc von `entries()`)
  - Specs: `packages/twopoint5d/src/stage/Stage2D.spec.ts`, `src/stage/StageRenderer.spec.ts`
  - Browser-Tests: `packages/twopoint5d-testing/test/stage-pipeline.test.js`, `packages/twopoint5d-testing/test/stage-canvas2d.test.js`
  - Doku: `packages/twopoint5d/src/stage/README.md`, `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]` → `### Added`, zwei bestehende Einträge umformuliert, kein neuer Eintrag, kein Migration Guide)
  - nicht: `src/display/**`, `src/controls/**`, `apps/lookbook/**`, `docs/resource-lifecycle.md`; keine Neuumbrüche an Stellen, die dieser Plan nicht nennt — das ist Paket 10
- Verify: `pnpm run ci`
- Commit: `fix(stage): let Stage2D#dispose() hand the caller the error of its dispose listeners and that of the release of its pass node together, let the stage docs count the internal target pool and a builder among what the caller owns and give the example of a custom buildOutputNode a renderer of its own, let the docs of the builder and of the internal targets name what they describe, and let the stage specs and browser tests stand under their headings and release what they build when their setup throws`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · alle zwölf Stellen unverändert: `Stage2D.ts:444` (`finally` mit `#disposePassNode()`), `README.md:696-699`, `README.md:388-410` (setzt auf `sr` auf, das `:368` disposed), `outputNodeBuilders.ts:9`, `StageRendererTargets.ts:23`, `StageRenderOrder.ts:40`, `Stage2D.spec.ts:764` (gehört zu `:779`), `StageRenderer.spec.ts:1951-1953` (über `:1954` und `:1970`, gehört zu `:1993`), `stage-pipeline.test.js:460`, `:443` (`try` in `withSquare()`), `stage-canvas2d.test.js:50`, `CHANGELOG.md:27` · dazu gleiche Ursache: `README.md:661-662`, `StageRenderer.ts:967-969`, `StageRendererTargets.ts:19`, `CHANGELOG.md:39` (Eintrag von `Stage2D#dispose()`, unveröffentlicht) · offene Folgen: keine unter erledigten Paketen · »Offene Befunde« (`Display.ts`, `PanControl2D.spec.ts:344`): andere Ursache, liegen gelassen · Restplan: Paket 10 bleibt hinter 9, Hinweis dort
  - 2026-09-29 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-9.impl-0.json`
  - 2026-09-29 Zug 1 (Nachtrag): erster Start ohne `setsid` (macOS) nicht angelaufen, neu gestartet über `paket-9.impl-0.sh`
  - 2026-09-29 Zug 2: Report FERTIG_MIT_VORBEHALT (geänderte Dateien nicht ganz gelesen), 11 Dateien geändert, Regressionstest rot belegt, Arbeitsbaum schmutzig
  - 2026-09-29 Zug 2: Verify `pnpm run ci` exit=0 (`/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/4315597f-d231-47b0-abdc-4c175c925e0c/scratchpad/paket-9.verify.log`)
  - 2026-09-29 Zug 3: Reviewer beauftragt (sonnet, effort medium), Diff `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/4315597f-d231-47b0-abdc-4c175c925e0c/scratchpad/paket-9.diff`
  - 2026-09-29 Zug 3: Reviewer: alle 16 Stellen erfüllt, 0 kritisch, 0 wichtig, 3 klein (`paket-9.review-0.json`)
  - 2026-09-29 Zug 4: keine Runde nötig
  - 2026-09-29 Zug 5: Commit d9d8c2dc, Verify `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/4315597f-d231-47b0-abdc-4c175c925e0c/scratchpad/paket-9.verify.log` exit=0

## Urteil des Reviewers

- Stellen 1–12 und die vier gleicher Ursache: erfüllt — `Stage2D.ts` (`dispose()` sammelt, `throwCollected`), `Stage2D.spec.ts` (zwei neue Tests unter `describe('dispose()')`, Kommentar (d) über `'is safe to call twice'`), `StageRenderer.ts` (TSDoc `dispose()`), `README.md` (»Pipeline lifecycle«, »Resource lifecycle«, Beispiel mit eigenem Renderer unter Mode D), `outputNodeBuilders.ts` (TSDoc nennt die Factory), `StageRendererTargets.ts` (`#internal`/`#pass`), `StageRenderOrder.ts` (`entries()`), `StageRenderer.spec.ts` (Banner vor `describe('renderOrder controls …')`), `stage-pipeline.test.js` (`withSquare()`, `readSquare()`), `stage-canvas2d.test.js` (`fill()`), `CHANGELOG.md` (Zeilen 27 und 39)
- Klein:
  1. `stage-pipeline.test.js`, Kommentar in `withSquare()`: »Everything from the container on sits in the try« — das `try` beginnt erst mit `new Display(…)`; Wortlaut sollte »from the display on« heißen (Code korrekt)
  2. `StageRendererTargets.ts`, Feld-TSDoc von `#pass`: ~104 Zeichen, über den ~100 des Vorgehens
  3. Werfen mehrere Listener und zusätzlich die Pass-Node-Freigabe, ist der erste Eintrag des `AggregateError` selbst ein `AggregateError` (nicht flachgezogen, konsistent mit `Canvas2DStage#dispose()`); ungetestet, TSDoc sagt »the same way«
- Abweichungen des Implementierers: Leerzeile vor `'applies its own clear …'` in Schritt 8 stehen gelassen; Schritt 12 Wortlaut wie im Plan

## Abgleich

Stand `ffd22adc`. Jede Stelle an der Fundstelle nachgesehen.

| # | Herkunft | Stelle heute | Urteil |
| --- | --- | --- | --- |
| 1 | Paket 4, Reviewer | `packages/twopoint5d/src/stage/Stage2D.ts:435-448` — `try { emitStrict(this, OnStageDispose, this) } finally { off(this); this.#disposePassNode(); }`; wirft `#disposePassNode()` (`:395-400`, `this.#passNode?.dispose()`), ersetzt dessen Fehler den des Listeners | unverändert |
| 2 | Paket 6c, Reviewer | `packages/twopoint5d/src/stage/README.md:696-699` — »Pipeline lifecycle« nennt nur `pipeline` und `outputRenderTarget` als Eigentum des Aufrufers und sagt »the renderer only releases what it owns — its internal RTs« | unverändert; dazu gleiche Ursache `README.md:661-662` (»Neither is a `pipeline` or an `outputRenderTarget` assigned from outside.«) und die TSDoc von `StageRenderer#dispose()` `StageRenderer.ts:967-969` (nennt den Pool, nicht den Builder) — beide Listen des Aufrufer-Eigentums kennen nicht alles, was 6c und 6d an Übergebenem eingeführt haben |
| 3 | Paket 6d, Reviewer | `README.md:388-410` — »Writing your own `buildOutputNode`« schreibt `sr.buildOutputNode = …` auf das `sr`, das der Block davor (`:358-371`) in `:368` disposed hat; wörtlich ein No-op | unverändert |
| 4 | Paket 6d, Reviewer | `packages/twopoint5d/src/stage/outputNodeBuilders.ts:9` — »a call throws an error naming the class and the state«; die Meldung (`:78`) nennt die Factory: `The builder of createBloomOutputNodeBuilder() is not available: this builder has been disposed` | unverändert |
| 5 | Paket 6c, Reviewer | `packages/twopoint5d/src/stage/StageRendererTargets.ts:23` — `/** Internal RT used when a parent calls \`asPassNode()\` on the renderer. */` über `#pass`, dem Pass-Target | unverändert; dazu `:19` »Internal RT used in Mode C …« — der Rest der Datei sagt »internal target« und »pass target« (`:1-3`, `:26`, `:44`, `:81`, `:87`, `:95`) |
| 6 | Paket 6b, Reviewer | `packages/twopoint5d/src/stage/StageRenderOrder.ts:40` — Zeilenkommentar vor dem TSDoc-Block von `entries()` (`:41-45`) | unverändert |
| 7 | Paket 2, Reviewer | `packages/twopoint5d/src/stage/Stage2D.spec.ts:764` — `// (d) the second call throws nothing …` über `'takes a scene after dispose() and announces nothing'` (`:765`, gehört inhaltlich zu (c)); der Test zu (d) ist `'is safe to call twice'` (`:779`) | unverändert |
| 8 | Paket 6, Reviewer | `packages/twopoint5d/src/stage/StageRenderer.spec.ts:1951-1953` — Banner `renderOrder × buildOutputNode …` über `'applies its own clear to the target it writes to before the pipeline runs'` (`:1954`) und `'sizes the pass target of a nested renderer …'` (`:1970`); der Banner gehört zu `describe('renderOrder controls …')` (`:1993`) | unverändert |
| 9 | Paket 6d, Reviewer | `packages/twopoint5d-testing/test/stage-pipeline.test.js:460-471` — `readProbe` als Helfer für genau einen Aufruf, der Kontrolldurchlauf darunter (`:473-482`) schreibt dasselbe von Hand | unverändert |
| 10 | Paket 6d, Reviewer | `stage-pipeline.test.js:421-456` — das `try` (`:443`) beginnt erst nach `new Display()`, `await squareDisplay.start()`, `new RenderPipeline()` und `makeBuild()`; wirft davor etwas, bleiben Display und Container liegen | unverändert; `disposeDisplay()` (`helpers/fixtures.js:69-76`) nimmt `undefined` hin, `tsconfig.json` des Testpakets hat `strictNullChecks: false` |
| 11 | Paket 4, Reviewer | `packages/twopoint5d-testing/test/stage-canvas2d.test.js:50` — `/** @param {HTMLCanvasElement} canvas */` über `fill(canvas, color)`, `color` ohne Typ | unverändert |
| 12 | Paket 4, Reviewer | `packages/twopoint5d/CHANGELOG.md:27` — Added-Eintrag beginnt »`Canvas2DStage#render()` takes …« statt »add …« | unverändert; `CHANGELOG.md:39` (»add `Stage2D#dispose()` …«) beschreibt die Fehlerbehandlung, die Schritt 1 ändert, und zieht mit (unveröffentlicht, deshalb kein `### Fixed`) |

Nicht aufgenommen: der zweite kleine Befund aus Paket 6 (`StageRenderer.spec.ts:1971`, `getPixelRatio.mockReturnValue(2)` ohne Zurücksetzen) ist gegenstandslos — `beforeEach` baut den Renderer-Mock je Test neu (`StageRenderer.spec.ts:123-124`). `StageRenderer#dispose()` (`StageRenderer.ts:1022-1026`) hat nur `off(this)` im `finally`, das nicht wirft: keine zweite Stelle zu Schritt 1. `Canvas2DStage#dispose()` sammelt bereits (`Canvas2DStage.ts:282-322`).

Triage: Unter den erledigten Paketen steht keine unverteilte `Folgen:`-Zeile. Die beiden offenen Einträge in »Offene Befunde« (`Display.ts:423-593`, `PanControl2D.spec.ts:344`) haben eine andere Ursache und liegen außerhalb der Stage-Schicht; sie bleiben für den Abschluss liegen.

## Vorgehen

Allgemein: Zeilennummern sind der Stand `ffd22adc`; nach dem ersten Einschub wandern sie — nach dem Inhalt suchen, den dieser Plan zitiert. Neuer Fließtext wird auf die Breite seines Blocks umbrochen (TSDoc in `src/stage/*.ts` um 100 Zeichen, README-Absätze wie ihre Nachbarzeilen); darüber hinaus nichts neu umbrechen. Keine Finding-IDs, kein Rückblick auf den Vorzustand in Code, Kommentar, Doku, Testnamen oder Commit-Message.

### Schritt 1 — `Stage2D#dispose()` sammelt beide Fehler (Bugfix, Regressionstest zuerst)

1a. Regressionstest zuerst, in `packages/twopoint5d/src/stage/Stage2D.spec.ts`, `describe('dispose()')`, direkt nach dem Test `'a dispose listener that throws does not keep the stage from releasing its pass node and its listeners'` (endet heute `:699`). Beide Tests neu:

```ts
    it('an error from releasing the pass node reaches the caller together with the error of a dispose listener', () => {
      const stage = makeStage();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const listenerFailure = new Error('the listener failed');
      const releaseFailure = new Error('the release failed');
      sandbox.stub(passNode, 'dispose').throws(releaseFailure);
      const heard = vi.fn();
      on(stage, OnStageDispose, () => {
        throw listenerFailure;
      });
      on(stage, OnStageDispose, heard);

      let caught: unknown;
      try {
        stage.dispose();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).errors).toEqual([listenerFailure, releaseFailure]);
      expect((caught as AggregateError).message).toMatch(/^Stage2D#dispose\(\)/);
      expect(heard, 'the listener behind the one that throws').toHaveBeenCalledTimes(1);
      expect(stage.isDisposed).toBe(true);
      expect(getSubscriptionCount(stage)).toBe(0);
    });

    it('an error from releasing the pass node reaches the caller unchanged when no listener throws', () => {
      const stage = makeStage();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const releaseFailure = new Error('the release failed');
      sandbox.stub(passNode, 'dispose').throws(releaseFailure);

      let caught: unknown;
      try {
        stage.dispose();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBe(releaseFailure);
      expect(stage.isDisposed).toBe(true);
    });
```

Laufen lassen: `pnpm nx test twopoint5d -- src/stage/Stage2D.spec.ts`. Erwartet: der erste Test rot (`caught` ist `releaseFailure`, kein `AggregateError`), der zweite grün (Wächter, sichert Bestehendes). Die rote Ausgabe gehört in den Report.

1b. Fix in `packages/twopoint5d/src/stage/Stage2D.ts`:

- Import ergänzen, nach `import {isPositiveFinite} from '../utils/isPositiveFinite.js';` (`:16`): `import {throwCollected} from '../utils/throwCollected.js';`
- die Methode `dispose()` (`:435-448`) ganz ersetzen durch:

```ts
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    const errors: unknown[] = [];

    // the listeners are still attached here: this event is what tells them to let go. Every one
    // of them hears it, also behind one that throws — so every StageRenderer that holds this stage
    // lets go of it; the error goes to the caller after the teardown
    try {
      emitStrict(this, OnStageDispose, this);
    } catch (error) {
      errors.push(error);
    }
    off(this);

    try {
      this.#disposePassNode();
    } catch (error) {
      errors.push(error);
    }

    throwCollected(errors, 'Stage2D#dispose(): a listener of the dispose event threw, and so did the release of the pass node');
  }
```

- TSDoc von `dispose()`: an den Satz, der heute mit `the caller afterwards — one unchanged, several as an \`AggregateError\`.` endet (`:433`), anhängen und den Absatz auf ~100 Zeichen umbrechen: `An error from releasing the pass node reaches the caller the same way, collected after that of the listeners.`

1c. `packages/twopoint5d/CHANGELOG.md:39` (Eintrag »add `Stage2D#dispose()` and `Stage2D#isDisposed`: …«, eine Zeile): hinter `… and the error reaches the caller afterwards — one unchanged, several as an \`AggregateError\`.` denselben Satz einfügen: ` An error from releasing the pass node reaches the caller the same way, collected after that of the listeners.` `Stage2D#dispose()` ist unveröffentlicht; kein `### Fixed`-Eintrag. Skill `updating-changelog` laden.

### Schritt 2 — Aufrufer-Eigentum vollständig in README und TSDoc

2a. `packages/twopoint5d/src/stage/README.md:696-699`, den Punkt »Pipeline lifecycle« ganz ersetzen durch:

```markdown
- **Pipeline lifecycle**: a `pipeline`, an `outputRenderTarget`, an
  `internalTargetPool` and a builder assigned as `buildOutputNode` belong to
  whoever assigned them. Dispose the previous instance yourself when you
  replace one, and the current one once the renderers that use it are
  disposed. The renderer only releases the targets it built for itself — its
  internal target, as long as no pool lends it one, and its pass-target.
```

2b. `README.md:661-662`, letzter Punkt von »Resource lifecycle«, ersetzen durch:

```markdown
- Stages added via `add()` are not auto-disposed — the caller owns them. Neither is a
  `pipeline`, an `outputRenderTarget`, an `internalTargetPool` or a builder assigned as
  `buildOutputNode` from outside.
```

2c. `packages/twopoint5d/src/stage/StageRenderer.ts:967-969`, TSDoc von `dispose()`, den Absatz ersetzen durch:

```ts
   * A {@link pipeline}, an {@link outputRenderTarget}, an {@link internalTargetPool}, a builder
   * assigned as {@link buildOutputNode} and every stage were handed in and belong to the caller:
   * none of them is disposed here. Dispose them where they were built.
```

### Schritt 3 — Das Beispiel »Writing your own `buildOutputNode`« bekommt einen eigenen Renderer

Grund der Form: der Block von Mode D (`README.md:358-371`) behält seinen Teardown, der neben dem Builder steht, den er freigibt — dieselben drei Zeilen stehen im TSDoc-Beispiel von `createBloomOutputNodeBuilder()` (`outputNodeBuilders.ts:56-66`). Statt den Teardown in einen eigenen Block hinter beide Beispiele zu ziehen (Vorschlag des Reviewers), bekommt der zweite Block einen eigenen Renderer und einen eigenen Teardown: so steht jeder Auszug für sich, und der zweite zeigt, was der Absatz darüber verlangt — die Glut des letzten Aufrufs freigeben, wenn man fertig ist. Geprüft: `tsc --strict` nimmt `lastGlow?.dispose()` nach der Zuweisung in der Closure an.

`packages/twopoint5d/src/stage/README.md:396-410`, den Codeblock unter »Writing your own `buildOutputNode`« ganz ersetzen durch (Info-String bleibt `ts`, kein `ts check`):

````markdown
```ts
import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';
import type {Node} from 'three/webgpu';

const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
const pipeline = new RenderPipeline(display.renderer!);
sr.pipeline = pipeline;

let lastGlow: {dispose(): void} | undefined;
sr.buildOutputNode = ([scenePass]) => {
  // `sr` was given exactly one stage above, so the pass list has its first entry,
  // and `.add()` lives on the ShaderNodeProxy rather than on `Node`
  const pass = scenePass as Node<'vec4'> & {add(other: Node): Node};
  const glow = bloom(pass, 1.2, 0.6);
  lastGlow?.dispose();
  lastGlow = glow;
  return pass.add(glow);
};

// teardown: the renderer lets go first, then the glow of the last call and the pipeline go
sr.dispose();
lastGlow?.dispose();
pipeline.dispose();
```
````

Der Absatz darüber (`:390-394`) bleibt, wie er ist.

### Schritt 4 — TSDoc von `OutputNodeBuilder` nennt, was die Meldung nennt

`packages/twopoint5d/src/stage/outputNodeBuilders.ts:9-10` ersetzen durch:

```ts
 * After {@link dispose} a call throws an error naming the factory that built the builder and the
 * state, `isDisposed` is `true`, and a further `dispose()` does nothing.
```

Die Meldungen (`:78`, `:81`) bleiben. `:54` (überlange Zeile) nicht anfassen — Paket 10.

### Schritt 5 — Feld-TSDoc in `StageRendererTargets.ts`

`packages/twopoint5d/src/stage/StageRendererTargets.ts:18-24` ersetzen durch:

```ts
  /**
   * The internal target of Mode C (a pipeline without buildOutputNode that is not a
   * RootRenderPipeline), built here. Without a pool only; with one, Mode C borrows its target.
   */
  #internal?: RenderTarget;
  /** The pass target a composing parent draws this renderer into and samples through `asPassNode()`. */
  #pass?: RenderTarget;
```

### Schritt 6 — Kommentar von `entries()` in die TSDoc

`packages/twopoint5d/src/stage/StageRenderOrder.ts:40-45`: die Kommentarzeile `// the frame path reads the entries through here; StageRenderer#renderOrderArray hands out a copy` entfällt, der TSDoc-Block wird zu:

```ts
  /**
   * The entries of the order, split at the commas, trimmed, empty ones left out — the entries
   * themselves, not a copy. The frame path reads the entries through here;
   * `StageRenderer#renderOrderArray` hands out a copy.
   */
```

### Schritt 7 — Kommentar (d) in `Stage2D.spec.ts`

`packages/twopoint5d/src/stage/Stage2D.spec.ts`: die Zeile `    // (d) the second call throws nothing and releases nothing a second time` (heute `:764`, nach Schritt 1 weiter unten) von über `it('takes a scene after dispose() and announces nothing', …)` nach direkt über `it('is safe to call twice', …)` verschieben. Der Test `'takes a scene after dispose() …'` bleibt, wo er ist, und steht damit in Gruppe (c). Leerzeilen wie in den Nachbargruppen: eine Leerzeile vor dem Kommentar, keine zwischen Kommentar und `it`.

### Schritt 8 — Banner in `StageRenderer.spec.ts`

`packages/twopoint5d/src/stage/StageRenderer.spec.ts:1951-1953`, die drei Zeilen

```ts
    // -------------------------------------------------------------------------
    // renderOrder × buildOutputNode — the order the user reads in their pipeline
    // -------------------------------------------------------------------------
```

samt der Leerzeile davor ausschneiden und direkt über `    describe('renderOrder controls the order of pass nodes passed to buildOutputNode', () => {` (heute `:1993`) einsetzen, mit einer Leerzeile davor. Die Tests `'applies its own clear to the target it writes to before the pipeline runs'` und `'sizes the pass target of a nested renderer in device pixels, before and after a resize'` stehen danach ohne Banner direkt unter `'buildOutputNode receives a pass node per stage (default renderOrder = "*", insertion order)'`. Kein Test ändert sich.

### Schritt 9 — `withSquare()` räumt auch bei einem Wurf im Aufbau auf

`packages/twopoint5d-testing/test/stage-pipeline.test.js:421-456`, den Rumpf von `withSquare()` ersetzen; die JSDoc darüber (`:413-420`) bleibt:

```js
  async function withSquare(makeBuild, run, color = '#fff') {
    const target = new RenderTarget(64, 64);
    const stage = new Stage2D(new OrthographicProjection('xy|bottom-left'));
    const geometry = new PlaneGeometry(16, 16);
    const material = new MeshBasicMaterial({color: new Color(color)});
    stage.scene.add(new Mesh(geometry, material));
    const sr = new StageRenderer().setClearColor(new Color('#000'), 1).add(stage);

    // a display of its own, released here: a test that calls this twice must not leave the first one to
    // the afterEach of the suite, which knows only the last one. Everything from the container on sits
    // in the try, so a display that fails to start or a builder that throws leaves nothing behind
    const squareHost = makeContainer({width: 64, height: 64});
    /** @type {Display | undefined} */
    let squareDisplay;
    /** @type {RenderPipeline | undefined} */
    let pipeline;
    let build;
    try {
      squareDisplay = new Display(squareHost);
      await squareDisplay.start();
      const renderer = squareDisplay.renderer;

      pipeline = new RenderPipeline(renderer);
      build = makeBuild();
      sr.pipeline = pipeline;
      sr.buildOutputNode = build;
      sr.outputRenderTarget = target;
      sr.resize(64, 64);

      await run({sr, target, renderer});
    } finally {
      // the renderer lets go first, then the builder, the stage, the pipeline and the rest, the display last
      sr.dispose();
      build?.dispose?.();
      stage.dispose();
      pipeline?.dispose();
      target.dispose();
      geometry.dispose();
      material.dispose();
      disposeDisplay(squareDisplay);
      squareHost.remove();
    }
  }
```

Vor dem Container steht nur, was weder DOM noch GPU hält; ab `makeContainer()` liegt alles im `try`.

### Schritt 10 — `readSquare()` für beide Durchläufe

In `stage-pipeline.test.js` direkt nach `withSquare()` einen Helfer anlegen:

```js
  /**
   * The pixels of the 64 x 64 target once `withSquare()` has drawn the square through the
   * `buildOutputNode` `makeBuild` answers.
   *
   * @param {Parameters<typeof withSquare>[0]} makeBuild
   * @param {string} [color] the color of the square, white by default
   */
  async function readSquare(makeBuild, color) {
    let pixels;
    await withSquare(
      makeBuild,
      async ({sr, target, renderer}) => {
        sr.renderTo(renderer);
        pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);
      },
      color,
    );
    return pixels;
  }
```

(`color` `undefined` greift auf den Default `'#fff'` von `withSquare()` zurück.)

Dann:

- Test `'Mode D: createBloomOutputNodeBuilder() keeps the stage and lays a glow around what is bright'` (`:459-493`): `readProbe` samt Aufruf (`:460-471`) und den Kontrolldurchlauf (`:473-482`) ersetzen durch

  ```js
      const withBloom = await readSquare(() => createBloomOutputNodeBuilder({strength: 1, radius: 0, threshold: 0}));
      const control = await readSquare(() => ([pass]) => pass);
  ```

  Der Rest des Tests (`center`, `probe`, `controlProbe`, der Messkommentar, die drei `expect`) bleibt unverändert.
- Test `'Mode D: createBloomOutputNodeBuilder() draws what stays below its threshold as the stage draws it'` (`:495-510`): `let pixels;` und den `withSquare(…)`-Aufruf ersetzen durch

  ```js
      const pixels = await readSquare(() => createBloomOutputNodeBuilder({strength: 1, radius: 0, threshold: 0.9}), '#808080');
  ```

  Kommentar und `expect` bleiben.
- Der dritte Test (`'Mode D: a rebuild through createBloomOutputNodeBuilder() leaves the texture count …'`) ruft `withSquare()` weiter direkt.

### Schritt 11 — JSDoc von `fill()` in `stage-canvas2d.test.js`

`packages/twopoint5d-testing/test/stage-canvas2d.test.js:50` ersetzen durch:

```js
  /**
   * Paints the whole canvas in one color.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {string} color a CSS color, as `fillStyle` takes it
   */
```

### Schritt 12 — CHANGELOG-Eintrag zu `Canvas2DStage#render()` im Stil der Nachbarn

`packages/twopoint5d/CHANGELOG.md:27` (eine Zeile) ersetzen durch:

```markdown
- add the parameters `now`, `deltaTime` and `frameNo` of `Canvas2DStage#render()`: the stage hands them to `stageRenderer.updateFrame()` before it draws; without them it counts frames and measures time with a clock of its own. `OnStageFirstFrame` and `OnStageUpdateFrame` reach the listeners of `canvasStage.stage` this way, and a stage without a camera warns after 100 frames. Whoever called `stageRenderer.updateFrame()` next to `render()` leaves that call out
```

(ohne Schlusspunkt, wie bisher)

### Rahmen

- Verhaltensänderung nur in Schritt 1; alle übrigen Schritte ändern Text, Kommentare oder die Struktur von Tests, keine Assertion. Die beiden Browser-Tests aus Schritt 10 prüfen danach dieselben Pixel mit denselben Schwellen.
- Beide Testflächen laufen im Verify-Gate (`test:coverage`, `test:browser`); `pnpm typecheck` prüft die geänderten `.test.js`-Dateien mit.

## Findings im Volltext

Keine Audit-Findings. Die zwölf Befunde im Wortlaut ihrer Reviewer:

**Paket 4 · low · `Stage2D.ts:444-447`** — wirft `#disposePassNode()` im `finally`, verdrängt dieser Fehler den des Listeners (Form vom Detailplan festgelegt; `Canvas2DStage#dispose()` löst denselben Fall per `throwCollected()`).
Plan: Fehler aus `#disposePassNode()` im `finally` verdrängt den Fehler der dispose-Listener — sammeln und per `throwCollected()` werfen wie `Canvas2DStage#dispose()`.

**Paket 6c · low · `README.md:647-651` (heute `:696-699`)** — »Pipeline lifecycle« zählt nur `pipeline` und `outputRenderTarget` als Eigentum des Aufrufers und sagt »the renderer only releases what it owns — its internal RTs«; der Pool fehlt, und mit Pool hat der Renderer kein eigenes internes Target.

**Paket 6d · low · `README.md:387-409` (heute `:388-410`)** — der Block »Writing your own `buildOutputNode`« setzt auf `sr` auf, das der Block davor (`:368-370`) im Teardown schon disposed hat; wörtlich gelesen ist die Zuweisung ein No-op. Wortlaut vom Detailplan vorgegeben; Teardown in einen eigenen Block zu ziehen wäre klarer.

**Paket 6d · info · `outputNodeBuilders.ts:9`** — die TSDoc sagt, der Fehler nenne »the class and the state«; die Meldung nennt die Factory (`The builder of createBloomOutputNodeBuilder()`), keine Klasse.

**Paket 6c · info · `StageRendererTargets.ts:23`** — die Feld-TSDoc von `#pass` nennt das Pass-Target »Internal RT« (intern, aus Paket 6b).

**Paket 6b · info · `StageRenderOrder.ts:40`** — der Zeilenkommentar »the frame path reads the entries through here; …« steht vor dem TSDoc-Block von `entries()` statt im Rumpf oder als Satz in der TSDoc (vom Implementierer bewusst so gesetzt, damit die TSDoc an der Methode hängt).

**Paket 2 · info · `Stage2D.spec.ts:577` (heute `:764`)** — Kommentar `// (d) the second call …` steht über dem neuen Test `takes a scene after dispose() …` statt über `is safe to call twice` (`:592`, heute `:779`).

**Paket 6 · info · `StageRenderer.spec.ts:1590-1593` (heute `:1951-1953`)** — die zwei neuen `it`s im komponierten `describe` stehen direkt unter dem Banner »renderOrder × buildOutputNode«, zu dem sie nicht gehören (Banner vor das `describe('renderOrder controls…')` bei `:1632` — heute `:1993` — ziehen oder die Tests darüber setzen).

**Paket 6d · info · `stage-pipeline.test.js:411-422` (heute `:460-482`)** — `readProbe` wird nur einmal aufgerufen, asymmetrisch zum Kontrolldurchlauf darunter (Lesbarkeit).

**Paket 6d · info · `stage-pipeline.test.js:379-393` (heute `:421-456`)** — das `try` in `withSquare()` beginnt erst nach `squareDisplay.start()` und dem Aufbau; wirft davor etwas, bleiben Display und Container liegen (nur im ohnehin roten Fall).

**Paket 4 · info · `stage-canvas2d.test.js`, Helfer `fill(canvas, color)` (heute `:50`)** — JSDoc typisiert `color` nicht.

**Paket 4 · info · `CHANGELOG.md:27`** — der neue `### Added`-Eintrag beginnt mit »`Canvas2DStage#render()` takes …« statt wie die übrigen mit »add …«.
