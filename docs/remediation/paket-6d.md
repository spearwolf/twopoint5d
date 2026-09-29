# Paket 6d — Fertige `buildOutputNode`-Builder für die gängigen Effekt-Stacks

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-026 (info) · dazu der Queue-Eintrag aus Paket 6c zu `README.md:581-583`
  (der README-Punkt zum disposten `StageRenderer` nennt `buildOutputNode` und
  `internalTargetPool` nicht)
- Ziel: Die Bibliothek liefert Factory-Funktionen, die fertige `buildOutputNode`-Callbacks für
  die im Repo wiederkehrenden Effekt-Stacks zurückgeben und die Effekt-Knoten, die sie bauen,
  selbst wieder freigeben.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - neu `packages/twopoint5d/src/stage/outputNodeBuilders.ts`
  - neu `packages/twopoint5d/src/stage/outputNodeBuilders.spec.ts`
  - `packages/twopoint5d/src/stage/public-api.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.ts` (nur Setter und TSDoc von `buildOutputNode`)
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/CHANGELOG.md`
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  - `apps/lookbook/src/pages/demos/stage-postprocessing.astro`,
    `apps/lookbook/src/pages/demos/_stage-postprocessing.json`
  - `apps/lookbook/src/pages/demos/stage-nested-pipelines.astro`
- Verify: `pnpm run ci` (im Repo-Root; schneller Zwischenlauf während der Arbeit:
  `pnpm --filter @spearwolf/twopoint5d exec vitest --run src/stage`)
- Commit: `feat(stage): add createBloomOutputNodeBuilder(), a ready-made buildOutputNode that composes the passes of the stages additively and adds bloom on top, releases the bloom node of its previous call once the next output node stands and the last one on dispose(), and is refused by a StageRenderer once disposed, and let the lookbook demos and the stage docs build their bloom through it`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · API-026 verschoben (Fundstelle `StageRenderer.ts:422`
    → Accessor `buildOutputNode` `StageRenderer.ts:504-537`), sachlich unverändert · Queue-Eintrag
    `README.md:581-583` (aus 6c) aufgenommen, gleiche Ursache · neuer Nebenbefund
    `StageRenderer.ts:671-677` (leere Komposition) → »Offene Befunde« · Queue-Eintrag »internal
    pass-target« als in 6c (`44743b2d`) behoben abgehakt · keine offenen `Folgen:` im Plan
  - 2026-09-29 Zug 1: Implementierer beauftragt (`sonnet`, effort medium), Report nach `paket-6d.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG_MIT_VORBEHALT (zusätzlicher Browser-Test für Mutation 3; nur WebGL2 gemessen) · 2 neue Dateien (`outputNodeBuilders.ts`, `.spec.ts`), 9 geänderte · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-6d.verify.log`)
  - 2026-09-29 Zug 3: Reviewer beauftragt (`opus`, effort medium), Diff `paket-6d.diff`, Report nach `paket-6d.review-0.json`
  - 2026-09-29 Zug 3: Urteil — API-026 behoben, Queue-Eintrag `README.md:581-583` behoben · 1 wichtig (Browser-Test ruft `withSquare()` zweimal, erstes Display bleibt liegen), 3 klein
  - 2026-09-29 Zug 4 Runde 1: offen 1 wichtig (Display-Leak `stage-pipeline.test.js:413-432`) → derselbe Implementierer per `--resume` (`sonnet`, medium), Report nach `paket-6d.impl-1.json`
    · zurück: FERTIG, nur `stage-pipeline.test.js` (`withSquare()` baut und disposed ein eigenes Display) · Verify exit=0 (`paket-6d.verify.log`; Lauf aus Zug 2 jetzt `paket-6d.verify-0.log`) · Reviewer gezielt (`opus`, medium), Diff `paket-6d.r1.diff`, Report nach `paket-6d.review-1.json`
    · Urteil: Befund behoben (`stage-pipeline.test.js:376-412`), nichts Neues über `klein` → Fortschritt, Kette endet nach Runde 1
  - 2026-09-29 Zug 5: Commit `f4213cf8` (11 Dateien, +545/−42), Verify `paket-6d.verify.log` exit=0, Plan auf `[x]`

## Abgleich (Zug 0, gegen `44743b2d`)

**API-026 — verschoben, sachlich unverändert.** Die Fundstelle `StageRenderer.ts:422` ist nach
den Paketen 1–6c der Accessor `buildOutputNode` in `StageRenderer.ts:504-537` (Typ
`StageRendererBuildOutputNode = (stagePasses: Node[]) => Node`, `:35`). In `src/stage/` gibt es
keinen fertigen Builder; `RootRenderPipeline.buildOutputNode` (`RootRenderPipeline.ts:26-38`) ist
nur die additive Komposition `p0.add(p1)…` und wirft für eine leere Liste
`RootRenderPipeline.buildOutputNode: no passes to compose`. Von Hand geschrieben wird genau ein
Stack, an vier Stellen: Pass plus Bloom des Passes —
`apps/lookbook/src/pages/demos/stage-postprocessing.astro:36-42`,
`apps/lookbook/src/pages/demos/stage-nested-pipelines.astro:53-59`, README Mode D
(`README.md:354-365`) und Mode E (`README.md:409-417`). Keine dieser Stellen gibt den `BloomNode`
frei, den sie baut: `StageRenderer#rebuildComposedOutputNode()` (`StageRenderer.ts:856-862`) ruft
den Callback bei jedem Neubau wieder auf und setzt `pipeline.outputNode` neu, three.js'
`RenderPipeline` gibt den ersetzten Knoten nicht frei, und `BloomNode` hält 11 RenderTargets
(je 5 horizontale und vertikale Blur-Targets plus `_renderTargetBright`) und bis zu 7
Materialien, die erst sein `dispose()` freigibt (`three/examples/jsm/tsl/display/BloomNode.js:470-495`).

Dazu vorbestehend und im selben Abschnitt: der Mode-D-Codeblock der README (`README.md:354-365`)
gibt `bloom(pass, 1.2, 0.6, 0.0)` allein zurück — das ist nur der Glow, die Szene fehlt; three.js
dokumentiert `scenePassColor.add(bloomPass)`, und die Lookbook-Demo daneben tut das auch. Schritt 7
ersetzt den Block ohnehin; kein eigener Eintrag.

**Queue-Eintrag `README.md:581-583` (aus Paket 6c) — unverändert.** Der Punkt lautet heute
»A disposed `StageRenderer` builds no further `RenderTarget`: `asPassNode()` throws, `renderTo()`
does nothing — it neither draws nor clears the caller's target — and a write to `pipeline` falls
through.« Die TSDoc von `StageRenderer#dispose()` (`StageRenderer.ts:972-974`) nennt
`pipeline`, `buildOutputNode` und `internalTargetPool`. Aufgenommen, weil dieselbe Ursache: der
Abschnitt »Resource lifecycle« der README trägt den Lebenszyklus von `buildOutputNode` nicht,
und genau diesen Abschnitt schreibt Schritt 7 um — der neue Punkt zum Builder steht direkt unter
diesem, und beide müssen dasselbe über `buildOutputNode` nach `dispose()` sagen.

**Triage der offenen Befunde.** Unter den erledigten Paketen steht keine unverteilte `Folgen:`-Zeile
(1–5 verteilt, 6, 6b, 6c »keine«). Aus »Offene Befunde« übernommen: nur `README.md:581-583`
(oben). Liegen gelassen, weil ohne gemeinsame Ursache mit API-026: `Stage2D.ts:29-41`
(Klassen-TSDoc), TEST-042, API-063, `IProjection.ts` (TSDoc), `Stage2D.ts:309` (tote Prüfung),
`StageRenderer.ts:833` (Fehlermeldung von `#getStagePass()` — Benennung des Kompositionspfads,
nicht des Builders), `StageRenderer.spec.ts:1739` (Testname). Der Eintrag »internal pass-target«
steht noch auf `[ ]`, ist aber laut `Ergebnis:` von 6c behoben — im Plan abgehakt.

**Neuer Nebenbefund, vorbestehend** (nachgesehen: `git show 5ff01ea2:packages/twopoint5d/src/stage/StageRenderer.ts`,
`:583-590` prüft dort ebenfalls nur Fläche und Kamera): `#canCompose()` (`StageRenderer.ts:671-677`)
lässt eine leere Stage-Liste durch. Ein komponierender Renderer ohne Stages ruft in jedem Frame
`buildOutputNode([])` bzw. `RootRenderPipeline.buildOutputNode([])` auf; letzteres wirft
`no passes to compose` aus `renderTo()`, bis eine Stage dazukommt, und ein Callback, der seinen
ersten Pass destrukturiert, scheitert in sich. Nicht dieselbe Ursache wie API-026 (der Aufrufer
reicht die leere Liste weiter, nicht der Builder) → »Offene Befunde«, low, `→ Scope`. Der Builder
dieses Pakets wirft für `[]` mit eigener Meldung (Schritt 1); das Paket ändert `#canCompose()`
nicht.

## Entscheidungen dieses Zug 0

1. **Ein Builder, für den einen Stack, der wiederkehrt.** Das Repo zeigt genau einen
   wiederkehrenden Stack — additive Komposition aller Pässe, darauf Bloom der Komposition addiert
   (vier Stellen, siehe Abgleich). Film-Grain und chromatische Aberration nennt das Finding, im
   Repo schreibt sie niemand. Die Empfehlung des Audits sagt selbst »erst sinnvoll, wenn sich
   abzeichnet, welche Stacks tatsächlich wiederkehren«, und das Ziel im Plan sagt »für die im Repo
   wiederkehrenden Effekt-Stacks«. Also kein `film()`/`chromaticAberration()` in diesem Paket.
   Dazu kommt ein technischer Grund: `chromaticAberration()` wickelt eine Komposition über
   `convertToTexture()` in einen `RTTNode` mit eigenem RenderTarget, den `Node#dispose()` nicht
   freigibt — ein zweiter Lebenszyklus, den niemand braucht. Der gemeinsame Typ
   `OutputNodeBuilder` ist so geschnitten, dass ein späterer Stack als weitere Factory im selben
   Modul danebenpasst.
2. **Ein Builder ist eine Funktion mit `dispose()`.** `OutputNodeBuilder` ist eine aufrufbare
   Schnittstelle — `(stagePasses: Node[]) => Node` plus `readonly isDisposed` und `dispose()` —
   und damit ohne Adapter an `StageRenderer#buildOutputNode` zuweisbar. Eine Klasse mit einer
   `build`-Methode bräuchte `sr.buildOutputNode = b.build` samt Bindung; die Funktion liest sich
   an der Zuweisung wie jeder andere Callback.
3. **Name nach dem Muster `create…` der Bibliothek** (`createVertexObject`):
   `createBloomOutputNodeBuilder()`. Modul `outputNodeBuilders.ts` statt eines Dateinamens nach
   der Funktion, weil der Typ `OutputNodeBuilder` allen künftigen Buildern gehört.
4. **Freigabe nach dem Neubau.** Der Builder baut erst den neuen Graphen und gibt danach den
   `BloomNode` des vorigen Aufrufs frei. Wirft der Aufruf, bleibt der Ausgabeknoten, den die
   Pipeline noch hält, intakt. `StageRenderer` weist `pipeline.outputNode` direkt nach dem Aufruf
   zu (`StageRenderer.ts:858-860`), der alte Knoten rendert danach nicht mehr.
5. **Optionen ohne eigene Validierung.** `strength`, `radius`, `threshold` gehen unverändert an
   `bloom()` von three.js, mit dessen Defaults (1, 0, 0); three validiert sie nicht, eine zweite
   Regelmenge liefe auseinander. Gelesen werden sie einmal beim Erzeugen.
6. **Nach `dispose()` wirft der Aufruf** — der Rückgabetyp `Node` behauptet Anwesenheit
   (`docs/resource-lifecycle.md` §3, Regel 2). Und nach außen (§3, letzter Absatz): der Setter
   `StageRenderer#buildOutputNode` weist einen Builder mit `isDisposed === true` ab, im Wortlaut
   und in der Reihenfolge des Setters `internalTargetPool` (`StageRenderer.ts:568-575`).
7. **Ein Builder je Renderer** — dokumentiert, nicht erzwungen. Der Callback erfährt nicht, wer
   ihn ruft; ein von zwei Renderern geteilter Builder gibt beim Neubau des einen den Bloom des
   anderen frei. Das steht in TSDoc und README.
8. **Import aus `three/examples`.** Das neue Modul ist das erste der Bibliothek, das aus
   `three/examples/jsm/…` importiert — derselbe Pfad wie Lookbook und README. `three` exportiert
   `./examples/jsm/*`, `@types/three@0.185.4` liefert `BloomNode.d.ts`, `bloom()` baut auch unter
   Node.js ohne DOM (in Zug 0 geprüft). Scheitert `checkPkgTypes`, `lintPkg`,
   `checkNameableTypes` oder der Doku-Typcheck am Import, wird das **nicht** umgangen und der
   Effekt nicht nachgebaut: Status `BLOCKIERT` mit der Ausgabe.
9. **Modell mittlere Stufe, Effort medium.** Neue öffentliche API, aber vollständig
   ausgeschnitten: Signaturen, Meldungen, Texte stehen hier. Offen bleibt nur das Kalibrieren
   der Pixel-Schwellen im Browser-Test.

## Vorgehen

Vorab lesen: `packages/twopoint5d/docs/resource-lifecycle.md` §1–3 und §6–7 (Besitz,
Idempotenz, Verhalten nach `dispose()`, Test-Muster mit `createSandbox()` aus `sinon`). Für
Schritt 8 den Skill `updating-changelog` laden. Keine Finding-ID und kein Satz über den
Vorzustand in Code, Kommentar, Testname, Doku oder CHANGELOG (Abschnitt »Konventionen« im Plan).

### 1. Neues Modul `packages/twopoint5d/src/stage/outputNodeBuilders.ts`

Exporte, genau diese drei:

```ts
import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';
import type {Node} from 'three/webgpu';
import {RootRenderPipeline} from './RootRenderPipeline.js';

export interface OutputNodeBuilder {
  (stagePasses: Node[]): Node;
  readonly isDisposed: boolean;
  dispose(): void;
}

export interface BloomOutputNodeBuilderOptions {
  strength?: number;
  radius?: number;
  threshold?: number;
}

export function createBloomOutputNodeBuilder(options?: BloomOutputNodeBuilderOptions): OutputNodeBuilder;
```

Verhalten von `createBloomOutputNodeBuilder(options)`:

- Liest `options` genau einmal, beim Aufruf: `strength` Default `1`, `radius` Default `0`,
  `threshold` Default `0` (die Defaults von `bloom()` in three.js). Eine spätere Änderung am
  übergebenen Objekt wirkt nicht.
- Zustand im Closure: der zuletzt gebaute `BloomNode` (Typ `ReturnType<typeof bloom>`,
  anfangs `undefined`) und ein `disposed`-Flag.
- Der Aufruf `builder(stagePasses)`, in dieser Reihenfolge:
  1. disposed → `throw new Error('The builder of createBloomOutputNodeBuilder() is not available: this builder has been disposed')`
  2. `stagePasses.length === 0` → `throw new Error('The builder of createBloomOutputNodeBuilder() has no passes to compose')`
     — vor allem anderen, der zuletzt gebaute `BloomNode` bleibt unangetastet.
  3. `composed = RootRenderPipeline.buildOutputNode(stagePasses)`, gecastet auf
     `Node<'vec4'> & {add(other: Node): Node}` — mit einem Kommentar am Cast, warum: `bloom()`
     verlangt `Node<'vec4'>`, und `.add()` hängt TSL zur Laufzeit über den ShaderNodeProxy an,
     der statische Typ `Node` zeigt es nicht (dieselbe Begründung wie `RootRenderPipeline.ts:30-31`).
  4. `glow = bloom(composed, strength, radius, threshold)`
  5. `output = composed.add(glow)`
  6. Den vorigen `BloomNode` freigeben (`dispose()`), dann `glow` als den zuletzt gebauten merken.
     Kommentar an der Stelle: freigegeben wird erst, wenn der neue Graph steht, damit ein
     Aufruf, der wirft, den Ausgabeknoten des vorigen Aufrufs intakt lässt.
  7. `return output`
- Die Pässe (Einträge von `stagePasses`) gehören den Stages; der Builder ruft auf ihnen nichts
  auf außer dem, was `RootRenderPipeline.buildOutputNode` und `bloom()` tun.
- `dispose()`: idempotent per Flag (Muster §2): `if (disposed) return; disposed = true;` dann
  den zuletzt gebauten `BloomNode` freigeben und die Referenz auf `undefined` setzen.
- `isDisposed` ist ein Getter auf dem Funktionsobjekt (z. B. per `Object.defineProperties`),
  kein kopierter Wert — er muss den aktuellen Zustand antworten.

TSDoc, in Englisch, im Ton der Datei `StageRenderTargetPool.ts`:

- an `OutputNodeBuilder`: ein `buildOutputNode`-Callback, der die Effekt-Knoten besitzt, die er
  baut, und sie selbst wieder freigibt; ohne Adapter an `StageRenderer#buildOutputNode`
  zuweisbar. Je Glied, was es nach `dispose()` tut: der Aufruf wirft mit Klasse und Zustand,
  `isDisposed` ist `true`, ein weiteres `dispose()` tut nichts.
- an `BloomOutputNodeBuilderOptions`: je Feld, dass es an `bloom()` von three.js geht, mit dem
  Default; `radius` im Bereich `[0, 1]`, wie three.js ihn dokumentiert; `threshold` ist die
  Luminanzschwelle, ab der ein Bereich zum Bloom beiträgt.
- an `createBloomOutputNodeBuilder()`:
  - was entsteht: die Pässe additiv komponiert wie `RootRenderPipeline.buildOutputNode`, darauf
    der Bloom dieser Komposition addiert — `composed.add(bloom(composed, strength, radius, threshold))`;
    bei einer Stage `pass.add(bloom(pass, …))`. Die Optionen werden beim Aufruf gelesen.
  - Lebenszyklus: `StageRenderer` ruft den Builder bei jedem Neubau des Ausgabeknotens, und
    weder der Renderer noch `RenderPipeline` gibt den ersetzten `outputNode` frei; jeder Aufruf
    gibt deshalb den Bloom-Knoten des vorigen frei, sobald der neue Graph steht, `dispose()` den
    letzten. Die Pass-Knoten gehören den Stages und bleiben.
  - Besitz: der Builder gehört dem Aufrufer; `StageRenderer#dispose()` lässt ihn stehen. Ein
    Builder je Renderer — ein geteilter gibt beim Neubau des einen Renderers den Bloom des
    anderen frei. Vor `dispose()` den Builder vom Renderer nehmen (`buildOutputNode = undefined`
    oder den Renderer disposen): ein Renderer, der noch einen disposten Builder hält, wirft beim
    nächsten Neubau; ein `StageRenderer` nimmt einen disposten Builder nicht an.
  - Eine leere Liste wirft.
  - Beispiel (`@example`-freier Codeblock wie in `RootRenderPipeline.ts:6-12`):

    ```ts
    const pipeline = new RenderPipeline(display.renderer!);
    const withBloom = createBloomOutputNodeBuilder({strength: 1.2, radius: 0.6});
    stageRenderer.pipeline = pipeline;
    stageRenderer.buildOutputNode = withBloom;

    // teardown: the renderer lets go first, then the builder and the pipeline go
    stageRenderer.dispose();
    withBloom.dispose();
    pipeline.dispose();
    ```

### 2. `packages/twopoint5d/src/stage/public-api.ts`

`export * from './outputNodeBuilders.js';` direkt unter `export * from './OrthographicProjection.js';`.

### 3. `packages/twopoint5d/src/stage/StageRenderer.ts` — Setter und TSDoc von `buildOutputNode`

- `import type {OutputNodeBuilder} from './outputNodeBuilders.js';` zu den übrigen Typ-Importen.
- Setter (`:531-537`): innerhalb des Zweigs `this.#buildOutputNode !== buildOutputNode`, vor
  `const previousMode = …`:

  ```ts
  if ((buildOutputNode as Partial<OutputNodeBuilder> | undefined)?.isDisposed === true) {
    throw new Error('StageRenderer#buildOutputNode cannot take the builder: that builder has been disposed');
  }
  ```

  Reihenfolge damit wie beim Setter `internalTargetPool`: disposter Renderer → stiller No-op;
  derselbe Wert → nichts; disposter Builder → Wurf, der bisherige Callback bleibt.
- TSDoc des Accessors (`:506-526`): nach dem Absatz, der mit »Assigning or clearing it switches«
  beginnt, und vor dem Absatz »A disposed renderer answers `undefined` here …« diesen Absatz
  einfügen:

  ```
   * The callback runs again on every rebuild of the output node, and neither this renderer nor
   * the pipeline releases the output node a rebuild replaces: an effect node the callback builds
   * with render targets of its own, such as a `bloom()` of three.js, is the callback's to release.
   * A builder from `createBloomOutputNodeBuilder()` does that itself; once disposed it is refused
   * here with an error naming the call and the state, and the callback set before stays.
  ```

Sonst nichts in `StageRenderer.ts` — insbesondere nicht `#canCompose()` (Nebenbefund in der Queue).

### 4. Spec `packages/twopoint5d/src/stage/outputNodeBuilders.spec.ts` (neu)

Pässe sind echte TSL-Knoten: `texture(new Texture())` (`texture` aus `three/tsl`, `Texture` aus
`three/webgpu`). Den `BloomNode` im Ergebnis findet ein kleiner Helfer im Spec, der den Graphen
über `Node#getChildren()` durchläuft (mit `Set` gegen Zyklen) und die Instanzen von `BloomNode`
(Default-Export von `three/examples/jsm/tsl/display/BloomNode.js`) sammelt — in Zug 0 geprüft:
für `c.add(bloom(c))` findet er genau einen, und dessen `inputNode` ist `c`. Nicht auf
`.node.bNode` o. ä. greifen, das ist three-interne Struktur. Spies mit `createSandbox()` aus
`sinon`, `afterEach(() => sandbox.restore())`.

`describe('createBloomOutputNodeBuilder()')`, Tests genau mit diesen Namen:

- `composes the passes additively and adds the bloom of the composition on top` — zwei Pässe;
  genau ein `BloomNode` im Ergebnis; beide Pässe sind von dessen `inputNode` aus erreichbar, und
  vom Ergebnis aus sind beide Pässe auch erreichbar, ohne durch den `BloomNode` zu gehen (die
  Szene steht im Ausgang, nicht nur der Glow).
- `hands a single pass to the bloom as it is` — ein Pass; `inputNode` des `BloomNode` ist der Pass.
- `hands strength, radius and threshold to the bloom, with the defaults of three.js` — mit
  `{strength: 1.2, radius: 0.6, threshold: 0.1}` die `.value` von `strength`, `radius`,
  `threshold`; ohne Optionen `1`, `0`, `0`.
- `reads its options once, when it is created` — Optionsobjekt nach dem Erzeugen ändern, der
  Bloom des nächsten Aufrufs trägt die ursprünglichen Werte.
- `releases the bloom of the previous call once the next output node stands` — zwei Aufrufe;
  `dispose` des ersten `BloomNode` genau einmal, des zweiten nicht.
- `throws for an empty pass list and keeps the bloom it built last` — Meldung
  `The builder of createBloomOutputNodeBuilder() has no passes to compose`; `dispose` des zuvor
  gebauten `BloomNode` nicht gerufen.
- `leaves the passes alone` — Spies auf `dispose` beider Pässe; nach zwei Aufrufen und
  `dispose()` des Builders nicht gerufen.
- `isDisposed is false until dispose()`.
- `describe('dispose()')` nach §7:
  - `releases the bloom it built last, once` (a)
  - `behaves as documented after dispose()` (c) — `isDisposed` ist `true`, der Aufruf wirft
    `The builder of createBloomOutputNodeBuilder() is not available: this builder has been disposed`
  - `is safe to call twice` (d) — zweites `dispose()` wirft nicht und gibt nichts erneut frei
  - `releases nothing when it has built nothing`

Die Coverage-Schwelle von `src/stage/**` (94/88/95/95, `vite.config.ts`) muss halten; das neue
Modul ist von diesem Spec vollständig abgedeckt.

### 5. `packages/twopoint5d/src/stage/StageRenderer.spec.ts`

Import `createBloomOutputNodeBuilder` aus `./outputNodeBuilders.js` und `BloomNode` wie in
Schritt 4 (Helfer zum Finden des `BloomNode` hier ebenfalls, lokal).

- Im `describe('Mode D and E: composing the pass nodes of the stages')`, mit dem vorhandenen
  `makeComposedSetup()` (`:1690`), dessen `buildOutputNode` durch einen Builder ersetzt wird —
  der `Stage2D` liefert dort einen echten `pass()`-Knoten:
  - `a rebuild through a builder of createBloomOutputNodeBuilder() releases the bloom node of the build before`
    — `resize(100, 100)`, `renderTo()`, `BloomNode` in `pipeline.outputNode` finden,
    `invalidateOutputNode()`, `renderTo()`: `dispose` des ersten genau einmal, und
    `pipeline.outputNode` enthält einen anderen `BloomNode`.
  - `refuses a disposed builder with an error naming the call and the state, and keeps the callback it had`
    — Muster wie der Test `:1635` für den Pool; Meldung
    `StageRenderer#buildOutputNode cannot take the builder: that builder has been disposed`.
- Im `describe('dispose()')` (`:2231`):
  - `leaves a builder of createBloomOutputNodeBuilder() alone` — Renderer mit Builder einmal
    rendern, Renderer disposen: `isDisposed` des Builders bleibt `false`, `dispose` des
    `BloomNode` nicht gerufen, `sr.buildOutputNode` ist `undefined`.

### 6. Browser-Tests in `packages/twopoint5d-testing/test/stage-pipeline.test.js`

`createBloomOutputNodeBuilder` in den vorhandenen Import aus `@spearwolf/twopoint5d` aufnehmen.
Zwei Tests im vorhandenen `describe`, Aufbau wie `a nested StageRenderer without a pipeline shows
only the content of the current frame` (`:322`): Display 64 × 64, gestartet, eigenes
`RenderTarget(64, 64)` als `outputRenderTarget`, Renderer ohne Host von Hand getrieben
(`resize(64, 64)`, `renderTo(display.renderer)`), `Stage2D(new OrthographicProjection('xy|bottom-left'))`,
Auslesen per `readRenderTargetPixelsAsync` und `rgbAt`/`isNearColor` aus `helpers/fixtures.js`.
Am Ende gibt der Test alles frei, was er gebaut hat, der Renderer zuerst, dann Builder, Stage,
Pipeline, Target, Geometrie, Material.

- `Mode D: createBloomOutputNodeBuilder() keeps the stage and lays a glow around what is bright`
  — weißes Quadrat `PlaneGeometry(16, 16)` im Ursprung, `setClearColor(new Color('#000'), 1)`,
  `pipeline = new RenderPipeline(renderer)`, Builder mit `{strength: 1, radius: 0, threshold: 0}`.
  Prüfen: Mitte (32, 32) ist nahe Weiß (die Szene steht im Ausgang); ein Probepunkt einige Pixel
  außerhalb der Kante des Quadrats (z. B. (46, 32), 6 px rechts der Kante bei x = 40) hat einen
  Rotkanal deutlich über 0. Kontrolle im selben Test: derselbe Aufbau mit
  `buildOutputNode = ([pass]) => pass` liest am Probepunkt Schwarz. Die Schwelle am gemessenen
  Wert beider Backends kalibrieren, mit Abstand, und den gemessenen Wert im Kommentar nennen.
- `Mode D: a rebuild through createBloomOutputNodeBuilder() leaves the texture count of the renderer where the first build left it`
  — Aufbau wie oben; nach dem ersten `renderTo()` `display.renderer.info.memory.textures`
  merken (Vorbild `vertex-objects-dispose.test.js:164-169`), `invalidateOutputNode()`,
  `renderTo()`; der Zähler steht wieder auf dem gemerkten Wert. Mutationsprobe: ohne die
  Freigabe des vorigen `BloomNode` im Builder muss dieser Test rot werden. Bleibt er unter einem
  der beiden Browser trotz Mutation grün, weil der Zähler dort nicht zählt, Status
  `FERTIG_MIT_VORBEHALT` mit dem gemessenen Verlauf — den Test dann trotzdem behalten, wenn er
  unter dem anderen Browser rot wird.

### 7. `packages/twopoint5d/src/stage/README.md`

Codeblöcke als `ts` (Auszüge wie ihre Nachbarn), nicht `ts check`. Die Zeilenangaben gelten für
den Stand `44743b2d`; jede Einfügung verschiebt die Zeilen darunter — von unten nach oben
bearbeiten oder an den zitierten Texten orientieren.

a. »Post-processing«, Absatz »Two notes on the types in the examples below« (`:268-275`): nach
   dem Umbau castet nur noch das Beispiel in »Writing your own `buildOutputNode`« (Punkt c), und
   zwar für beides. Den letzten Satz (`:273-275`, ab »Each example casts for what it needs«)
   ersetzen durch:

   ```
   runtime are visible to the static type. An example that writes its own callback casts
   for both, and the comment next to the cast names the reason the pass is there at all.
   ```

   (Die erste Zeile davon ist der Rest von `:273`; die Sätze davor bleiben.)

b. Tabelle »Class roles«: nach der Zeile `StageRenderTargetPool` (`:52`) diese Zeile:

   ```
   | `createBloomOutputNodeBuilder()` | Returns a ready-made `buildOutputNode`: every pass composed additively, the bloom of the composition on top. Releases the bloom it built when it builds the next one and on `dispose()`. Built, assigned and disposed by the caller, one per `StageRenderer`. |
   ```

c. »Mode D« (`:348-365`): die Einleitung (`:350-352`) bleibt. Den Codeblock `:354-365` ersetzen
   durch diesen Absatz und Block:

   ````
   For the stack that comes up again and again — every pass composed additively,
   the bloom of that composition on top — `createBloomOutputNodeBuilder()` hands you
   a ready-made `buildOutputNode`:

   ```ts
   import {createBloomOutputNodeBuilder} from '@spearwolf/twopoint5d';

   const sr = new StageRenderer(display).setClearColor(new Color('#000')).add(stage);
   const pipeline = new RenderPipeline(display.renderer!);
   const withBloom = createBloomOutputNodeBuilder({strength: 1.2, radius: 0.6});
   sr.pipeline = pipeline;
   sr.buildOutputNode = withBloom;

   // teardown: the renderer lets go first, then the builder and the pipeline go
   sr.dispose();
   withBloom.dispose();
   pipeline.dispose();
   ```
   ````

   Die beiden Punkte zu `asPassNode()` und der Absatz »`buildOutputNode` runs again on the next
   render after …« (`:367-379`) bleiben unverändert. Danach, vor »### Shortcut:
   `RootRenderPipeline`«, ein neuer Unterabschnitt:

   ````
   #### Writing your own `buildOutputNode`

   Neither the renderer nor three's `RenderPipeline` releases the `outputNode` a
   rebuild replaces. An effect node your callback builds with render targets of
   its own — `bloom()` has them — is yours to release, or every rebuild leaves one
   behind. Release the one of the previous call once the next one stands, and the
   last one when you are done, as `createBloomOutputNodeBuilder()` does:

   ```ts
   import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';
   import type {Node} from 'three/webgpu';

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
   ```
   ````

d. »Shortcut: `RootRenderPipeline`«, letzter Absatz (`:396-398`) ersetzen durch:

   ```
   Setting `stageRenderer.buildOutputNode` overrides the default — use it
   when you want more than the additive composition, such as the bloom on top
   of it that `createBloomOutputNodeBuilder()` adds.
   ```

e. »Mode E«, Codeblock (`:406-424`): die Zeilen `:409-417`, von `// World layer with its own bloom …`
   bis `};`, ersetzen durch:

   ```ts
   // World layer with its own bloom (Mode D — a ready-made composition)
   const worldRenderer = new StageRenderer(root).add(worldStage);
   const worldBloom = createBloomOutputNodeBuilder({strength: 1.5, radius: 0.5});
   worldRenderer.pipeline = new RenderPipeline(display.renderer!);
   worldRenderer.buildOutputNode = worldBloom;
   ```

   Der Rest des Blocks und der Abschnitt danach bleiben.

f. »Resource lifecycle«: der Punkt `:581-583` wird zu

   ```
   - A disposed `StageRenderer` builds no further `RenderTarget`: `asPassNode()` throws,
     `renderTo()` does nothing — it neither draws nor clears the caller's target — and a
     write to `pipeline`, `buildOutputNode` or `internalTargetPool` falls through.
   ```

   und direkt danach dieser neue Punkt:

   ```
   - A builder from `createBloomOutputNodeBuilder()` belongs to the caller. Each call releases
     the bloom node the call before built, once the new output node stands — neither the
     renderer nor three's `RenderPipeline` releases an `outputNode` a rebuild replaces —, and
     `dispose()` releases the last one; the pass nodes it composes belong to the stages and
     stay. `StageRenderer#dispose()` lets go of the builder and leaves it alone. Give every
     renderer a builder of its own: one that two renderers share releases the bloom of one of
     them whenever the other rebuilds. A disposed builder throws when it is called, and a
     `StageRenderer` refuses it; take the builder off the renderer — `buildOutputNode =
     undefined`, or dispose the renderer — before you dispose it.
   ```

   Umbruch der README-Absätze wie ihre Nachbarn (um 90 Zeichen); Prettier prüft die Datei.

### 8. `packages/twopoint5d/CHANGELOG.md`

Unter `## [Unreleased]` → `### Added`, als letzter Punkt direkt nach dem Punkt zu
`StageRenderTargetPool` (`:74`), einzeilig wie seine Nachbarn:

```
- add `createBloomOutputNodeBuilder()` and the `OutputNodeBuilder` and `BloomOutputNodeBuilderOptions` types: a ready-made `StageRenderer#buildOutputNode` that composes the pass of every stage additively, as `RootRenderPipeline` does, and adds the bloom of three.js over that composition on top, with the `strength`, `radius` and `threshold` of `bloom()`. Neither the renderer nor `RenderPipeline` releases an `outputNode` a rebuild replaces; the builder releases the bloom node of its previous call once the next output node stands, and the last one on `dispose()`. The builder belongs to the caller: `StageRenderer#dispose()` leaves it alone, a `StageRenderer` refuses one that has been disposed, and a disposed builder throws when it is called. Give every renderer a builder of its own
```

Kein Eintrag im Migration Guide — nichts bricht.

### 9. Lookbook

- `apps/lookbook/src/pages/demos/stage-postprocessing.astro`: `createBloomOutputNodeBuilder` in
  den Import aus `@spearwolf/twopoint5d` (alphabetisch einsortiert), die Zeile
  `import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';` entfällt, `type Node` fällt
  aus dem `three/webgpu`-Import. Die Zeilen `:32-42` (Kommentar, Pipeline, auskommentierte
  Variante, Callback) werden zu:

  ```ts
  // A tiny post-pass: bloom on top of the rendered scene.
  // The display was constructed above, so it holds its renderer; only dispose() takes it away again.
  stageRenderer.pipeline = new RenderPipeline(display.renderer!);
  stageRenderer.buildOutputNode = createBloomOutputNodeBuilder({strength: 1.2, radius: 0.6});
  ```

- `apps/lookbook/src/pages/demos/_stage-postprocessing.json`: `description` wird
  `"Stage2D with a \`RenderPipeline\` post-pass (bloom) from \`createBloomOutputNodeBuilder()\`, wired via \`StageRenderer.buildOutputNode\`"`.
- `apps/lookbook/src/pages/demos/stage-nested-pipelines.astro`: Importe wie oben; die Zeilen
  `:53-59` (Callback samt Kommentaren) werden zu
  `worldRenderer.buildOutputNode = createBloomOutputNodeBuilder({strength: 1.5, radius: 0.5});`.
  Der Kommentarblock `:42-45` (»World layer (with its OWN bloom pipeline …)«) bleibt.

Die Demos leben so lange wie die Seite und geben auch Display und Pipeline nicht frei; der
Builder bekommt dort kein `dispose()`.

### 10. Verify und Report

- `pnpm run ci` im Repo-Root, grün.
- Kein Regressionstest gefordert (Feature, kein Bugfix). Die Tests entstehen nach dem Code,
  deshalb je eine Mutationsprobe, Ergebnis in den Report: (1) Freigabe des vorigen `BloomNode`
  im Builder entfernt → `releases the bloom of the previous call …`, der StageRenderer-Test zum
  Neubau und der Browser-Test zum Texturzähler rot; (2) Prüfung auf `isDisposed` im Setter
  entfernt → `refuses a disposed builder …` rot; (3) `+ glow` statt `composed.add(glow)`
  (nur der Glow im Ausgang) → `composes the passes additively …` und der Pixel-Test (Mitte weiß) rot.
- Scheitert `pnpm run ci` an Paket-Checks des `three/examples`-Imports (`checkPkgTypes`,
  `lintPkg`, `checkNameableTypes`, Doku-Typcheck), nicht umgehen: `BLOCKIERT` mit der Ausgabe
  (Entscheidung 8).

## Reviewer-Urteil

Aus `paket-6d.review-0.json` (Diff `paket-6d.diff`) und `paket-6d.review-1.json` (Diff `paket-6d.r1.diff`):

- **API-026 — behoben.** `packages/twopoint5d/src/stage/outputNodeBuilders.ts:12-20` (`OutputNodeBuilder`),
  `:68` (`createBloomOutputNodeBuilder()`), `:86-93` (Freigabe des vorigen `BloomNode` nach dem Neubau),
  `:77-79` (Wurf nach `dispose()`); Setter-Guard `StageRenderer.ts:539-543`, TSDoc `:525-529`;
  `public-api.ts:10`; README `:53`, `:274`, `:354-409`, `:427-428`; CHANGELOG `:75`; beide Lookbook-Demos.
  Entscheidungen 1–9 und Schritte 1–10 umgesetzt; die Abweichung in Schritt 6 (zusätzlicher
  Browser-Test, weil der geforderte Pixeltest Mutation 3 nicht unterscheidet) ist begründet.
- **Queue-Eintrag `README.md:581-583` — behoben.** `README.md:609` nennt `pipeline`, `buildOutputNode`
  und `internalTargetPool`; der Punkt zum Builder folgt direkt darunter (`:610-618`).
- Runde 1: der `wichtig`-Befund (zweites Display im Browser-Test blieb liegen) ist behoben,
  `stage-pipeline.test.js:376-412` — `withSquare()` baut und disposed ein eigenes Display samt Container.

Implementierer-Report: drei Mutationsproben je rot (1: Freigabe entfernt → Spec-Test, StageRenderer-Test,
Texturzähler 26 statt 15; 2: `isDisposed`-Guard entfernt → `refuses a disposed builder …`; 3: nur Glow im
Ausgang → `composes the passes additively …` und Browser-Test `… draws what stays below its threshold …`).
Browser-Messwerte (Chromium und Firefox, beide unter WebGL2): Mitte 255, Probepunkt (46,32) 116, Kontrolle 0,
Schwelle `> 60`; Texturzähler 15 → 15.

### Kleine Befunde (ohne Runde)

- `outputNodeBuilders.ts:9` — die TSDoc sagt, der Fehler nenne »the class and the state«; die Meldung nennt
  die Factory (`The builder of createBloomOutputNodeBuilder()`), keine Klasse.
- `README.md:387-409` — der Block »Writing your own `buildOutputNode`« setzt auf `sr` auf, das der Block
  davor (`:368-370`) im Teardown schon disposed hat; wörtlich gelesen ist die Zuweisung ein No-op.
  Wortlaut vom Detailplan vorgegeben; Teardown in einen eigenen Block zu ziehen wäre klarer.
- `stage-pipeline.test.js:411-422` — `readProbe` wird nur einmal aufgerufen, asymmetrisch zum
  Kontrolldurchlauf darunter (Lesbarkeit).
- `stage-pipeline.test.js:379-393` — das `try` in `withSquare()` beginnt erst nach `squareDisplay.start()`
  und dem Aufbau; wirft davor etwas, bleiben Display und Container liegen (nur im ohnehin roten Fall).

## Findings im Volltext

**API-026 · info · packages/twopoint5d/src/stage/StageRenderer.ts:422** — Keine Helper-Builder
für gängige Effekt-Stacks
`buildOutputNode` ist der richtige Hook, aber jeder Nutzer schreibt seinen bloom-, chromatic-
oder film-grain-Graph von Hand. Unverändert.
Empfehlung: Ein kleines Set an Factory-Funktionen, die fertige `buildOutputNode`-Callbacks
liefern. Erst sinnvoll, wenn sich abzeichnet, welche Stacks tatsächlich wiederkehren.
(effort M, status carried-over, component stage)

**Queue-Eintrag aus Paket 6c · info · packages/twopoint5d/src/stage/README.md:581-583** — der
Punkt »A disposed `StageRenderer` builds no further `RenderTarget` … a write to `pipeline` falls
through« nennt weder `buildOutputNode` (nach `dispose()` ein No-op seit Paket 3, `8614c309`; der
Satz stand vor dem Lauf so da) noch `internalTargetPool` (Paket 6c), während die TSDoc von
`StageRenderer#dispose()` beide nennt.
