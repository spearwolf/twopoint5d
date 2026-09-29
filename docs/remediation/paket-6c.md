# Paket 6c — RenderTarget-Pool für gleich dimensionierte Renderer

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-008 (info) · dazu der Queue-Eintrag aus Paket 6b »die TSDoc
  nennt das Target von Mode C `internal pass-target`« (info, gleiche Ursache,
  siehe Abgleich)
- Ziel: Renderer gleicher Größe, deren Pipeline das interne RenderTarget sampelt
  (Modus C), teilen sich dieses Target über einen Pool, den der Aufrufer baut,
  übergibt und freigibt.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - neu `packages/twopoint5d/src/stage/StageRenderTargetPool.ts`
  - neu `packages/twopoint5d/src/stage/StageRenderTargetPool.spec.ts`
  - `packages/twopoint5d/src/stage/public-api.ts`
  - `packages/twopoint5d/src/stage/StageRendererTargets.ts` (intern)
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/IPassProvider.ts` (ein Wort in der TSDoc)
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/CHANGELOG.md`
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  - nicht angefasst: `packages/twopoint5d/docs/resource-lifecycle.md` (Grund
    unter »Entscheidungen dieses Detailplans«), kein Lookbook, kein Migration
    Guide (nichts bricht: ohne Pool bleibt jedes Verhalten, wie es ist)
- Verify: `pnpm run ci` (aus dem Repo-Root; enthält `test:browser`)
- Commit: `feat(stage): add StageRenderTargetPool, through which StageRenderers of the same size share the internal target of the pipeline-only mode — each renderer borrows it for one draw and gives it back once its pipeline has run —, set on a renderer as StageRenderer#internalTargetPool and left to the caller by dispose(), and let the stage docs call the target of the pipeline-only mode the internal target and keep the pass-target for the one a composing parent samples`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · PERF-008 umgeformt (verschoben durch
    Paket 6b: das interne Target liegt in `StageRendererTargets.ts:15-24`
    `#internal`/`internalTarget()`, einziger Aufruf `StageRenderer.ts:711` in
    `#renderPipelineSimple()`; kein Pool vorhanden, Sachverhalt besteht) ·
    Queue-Eintrag »internal pass-target« (`StageRenderer.ts:95`, `:463`, `:518`,
    `:702`) unverändert, beim Abgleich dazu `README.md:210`, `:517`,
    `IPassProvider.ts:7`, `StageRenderer.spec.ts:1021`, `:2006` gefunden (alle
    vorbestehend, schon in `5ff01ea2`) — ins Paket aufgenommen · offene Folgen:
    keine (6 und 6b »Folgen: keine«, ältere verteilt) · übrige Queue-Einträge
    ohne gemeinsame Ursache, bleiben liegen · Restplan unverändert
  - 2026-09-29 Zug 1: Implementierer beauftragt (`opus`, effort high), Report nach `paket-6c.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG · 10 Dateien (neu `StageRenderTargetPool.ts` samt Spec; `public-api.ts`, `StageRendererTargets.ts`, `StageRenderer.ts` samt Spec, `IPassProvider.ts`, `README.md`, `CHANGELOG.md`, `stage-pipeline.test.js`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-6c.verify.log`)
  - 2026-09-29 Zug 3: Reviewer beauftragt (`opus`, effort high), Diff `paket-6c.diff` (1556 Zeilen)
  - 2026-09-29 Zug 3: Urteil — PERF-008 behoben, Queue-Eintrag »internal pass-target« behoben; keine kritischen oder wichtigen Befunde, drei kleine · Report `paket-6c.review-0.json`
  - 2026-09-29 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-29 Zug 5: committet `44743b2d` auf Verify `paket-6c.verify.log` (exit=0) · Arbeitsbaum sauber · ein Nebenbefund nach »Offene Befunde« (`README.md:581-583`)

## Abgleich

**PERF-008 · info · `StageRenderer.ts:444` (Audit)** — umgeformt. Nach Paket 6b
hält jeder `StageRenderer` sein internes Target in `readonly #targets =
new StageRendererTargets()` (`StageRenderer.ts:548`); das Target von Mode C
kommt aus `StageRendererTargets#internalTarget(renderer, width, height)`
(`StageRendererTargets.ts:22-24`, gebaut in `#ensure()` `:77-92` mit
`type: renderer.getOutputBufferType()`, `samples: renderer.samples`, Größe in
Gerätepixeln über `#deviceSize()` `:65-67`). Einziger Aufruf:
`StageRenderer.ts:711`, erste Zeile von `#renderPipelineSimple()`. Freigegeben
per `releaseInternalTarget()` beim Verlassen von Mode C (`#modeInputChanged()`
`StageRenderer.ts:542-545`) und per `dispose()` (`:938`). Ein Pool existiert
nicht. Der Satz des Audits »jeder `StageRenderer` mit Pipeline« stimmt seit
Paket 1 nur noch für Mode C — die komponierenden Modi halten kein internes
Target, und das Pass-Target (`#pass`, `passTarget()`) sampelt der Eltern-Renderer
für alle Kinder in einem Pipeline-Lauf zugleich; es bleibt je Kind eigenes.

**Queue-Eintrag aus Paket 6b (info)** — »die öffentliche TSDoc nennt das Target
von Mode C `internal pass-target`, während README und `asPassNode()`
`pass-target` für das Target sagen, in das ein komponierender Eltern-Renderer
rendert«. Unverändert an `StageRenderer.ts:95`, `:463`, `:518`, `:702`. Beim
Abgleich dieselbe Verwechslung an weiteren Stellen: `README.md:210` (Clear
policy, fett: »**internal pass-target**«), `README.md:517` (Resource lifecycle),
`IPassProvider.ts:6-7` (»a `texture()` node sampling the renderer's internal
pass-target« — gemeint ist dort das Pass-Target, nicht das von Mode C),
`StageRenderer.spec.ts:1021` (`describe('Mode C: a pipeline that samples the
internal pass-target')`) und `:2006` (Kommentar). Vorbestehend: `git show
5ff01ea2:packages/twopoint5d/src/stage/StageRenderer.ts` enthält die Wendung
fünfmal. **Aufgenommen**, weil die Ursache geteilt ist: die Doku dieses Pakets
muss sagen, dass das interne Target von Mode C gepoolt wird und das Pass-Target
nicht (Hinweis (2) aus Zug 0 von Paket 6: »Das in der TSDoc sagen«). Solange
dasselbe Target in der TSDoc »internal pass-target« heißt, liest jeder Satz über
den Pool, als würde auch das Pass-Target geliehen. Alle Stellen liegen in den
Absätzen, die dieses Paket ohnehin umschreibt, oder in derselben Datei.

**Übrige Queue-Einträge** — ohne gemeinsame Ursache, bleiben in »Offene
Befunde«: `Stage2D.ts:29-41` (Position der Klassen-TSDoc), TEST-042 (vom
Abschluss zu buchen), API-063 (→ Rückfrage), `IProjection.ts` (fehlende TSDoc),
`Stage2D.ts:309` (tote Prüfung), `StageRenderer.ts:833` (Fehlermeldung von
`#getStagePass()`), `StageRenderer.spec.ts:1739` (Testname mit privatem
Feldnamen). Die drei letzten liegen in Dateien dieses Pakets, gehören aber nicht
dazu: nicht anfassen.

## Entscheidungen dieses Detailplans

Der Weg steht in den Hinweisen aus Zug 0 von Paket 6 und 6b im Plan (Opt-in,
Leihe für die Dauer eines Draws, exakte Passung, freie Targets vor dem Neubau
freigeben, Pool gehört dem Aufrufer). Hier nur, was darüber hinaus entschieden
wurde:

1. **Name des Accessors: `StageRenderer#internalTargetPool`**, Klasse
   `StageRenderTargetPool` (Arbeitsname aus Paket 6 bleibt). Grund: gepoolt wird
   allein das Target, das README und TSDoc nach diesem Paket durchgehend
   »internal target« nennen; `renderTargetPool` ließe lesen, auch das Pass-Target
   oder `outputRenderTarget` kämen aus dem Pool.
2. **`acquire(width, height, type, samples)` positional, Größe in Gerätepixeln.**
   Grund: ein Optionsobjekt wäre eine Allokation pro Frame im Render-Pfad; der
   Frame-Pfad der Stage allokiert nichts (Rahmen (2) aus Zug 0 von Paket 6). Der
   Pool kennt keinen Renderer; `StageRendererTargets` rechnet die Gerätepixel wie
   für das eigene Target.
3. **`dispose()` des Pools gibt die freien Targets sofort frei, ein verliehenes
   bei seiner Rückgabe.** Grund: ein verliehenes Target ist in diesem Moment das
   aktuelle RenderTarget eines laufenden Draws; es mitten darin freizugeben hieße,
   dass three.js es beim nächsten Draw derselben Runde neu allokiert und niemand
   diese Allokation je wieder freigibt. So gibt der Pool trotzdem jedes Target
   frei, das er gebaut hat (Hinweis (5) aus Paket 6).
4. **`release()` weist ein Target ab, das der Pool nicht verliehen hat**
   (fremdes Target, doppelte Rückgabe) — auch nach `dispose()`. Grund:
   `docs/resource-lifecycle.md` §3, »Invalid input is still turned away«; eine
   doppelte Rückgabe ließe zwei Renderer gleichzeitig in dasselbe Target zeichnen.
5. **Der Renderer weist einen disposten Pool ab** (Setter wirft) — nach
   `docs/resource-lifecycle.md` §3, letzter Absatz. Ein Pool, der disposed wird,
   während er gesetzt ist, lässt den nächsten Mode-C-Frame mit dem Fehler von
   `acquire()` werfen; kein stilles Zurückfallen auf ein eigenes Target — der
   Fehler nennt Klasse, Methode und Zustand, der Stack zeigt auf den echten
   Fehler.
6. **Ein eigenes Target, das während des eigenen Draws weggenommen wird** — ein
   Pool, der aus dem `renderTo()` einer Stage gesetzt wird, oder `dispose()` des
   Renderers aus einer Stage heraus —, wird erst bei der Rückgabe am Ende des
   Draws freigegeben, nicht mittendrin (derselbe Grund wie 3). Ein Helfer für
   beide Wege.
7. **`docs/resource-lifecycle.md` bleibt unberührt.** Grund: §1 (»What was
   borrowed is given back«, Ownership) und §3 tragen den Pool ohne neues Muster;
   was der Stage-Schicht eigen ist, steht im README-Abschnitt »Resource
   lifecycle«, der dafür da ist.
8. **Kein Migration Guide, CHANGELOG unter `### Added`.** Nichts Bestehendes
   ändert sich; die Umbenennung »internal pass-target« → »internal target« ist
   reine Doku.

## Vorgehen

Die Reihenfolge ist die empfohlene; Tests dürfen zuerst entstehen (sie scheitern
dann an der fehlenden Klasse — das ist kein Bugfix-Paket, ein roter Lauf ist
nicht gefordert).

### 1. `src/stage/StageRenderTargetPool.ts` (neu, öffentlich)

```ts
import {RenderTarget, type TextureDataType} from 'three/webgpu';

interface StageRenderTargetPoolEntry {
  readonly renderTarget: RenderTarget;
  lent: boolean;
}

export class StageRenderTargetPool {
  readonly #entries: StageRenderTargetPoolEntry[] = [];
  #disposed = false;

  get isDisposed(): boolean;
  acquire(width: number, height: number, type: TextureDataType, samples: number): RenderTarget;
  release(renderTarget: RenderTarget): void;
  dispose(): void;
}
```

Der Entry-Typ wird nicht exportiert. Kein Konstruktor-Parameter, keine weiteren
öffentlichen Glieder.

Verhalten, exakt:

- `acquire()`:
  1. Disposed → `throw new Error('StageRenderTargetPool#acquire() is not available: this pool has been disposed')`.
  2. Sonst der erste Eintrag in Bau-Reihenfolge, der nicht verliehen ist und
     dessen `renderTarget.width === width`, `renderTarget.height === height`,
     `renderTarget.texture.type === type` und `renderTarget.samples === samples`
     gilt: `lent = true`, Target zurück.
  3. Kein solcher Eintrag: jeden **nicht verliehenen** Eintrag per
     `renderTarget.dispose()` freigeben und aus `#entries` entfernen (in place,
     die Reihenfolge der übrigen bleibt), dann
     `new RenderTarget(width, height, {type, samples})` bauen, als
     `{renderTarget, lent: true}` anhängen, zurückgeben.
- `release(renderTarget)`:
  1. Eintrag per Identität suchen. Keiner, oder er ist nicht verliehen →
     `throw new Error('StageRenderTargetPool#release() cannot take the render target back: it is not on loan from this pool')`.
     Das gilt auch nach `dispose()`.
  2. Disposed → Eintrag entfernen, `renderTarget.dispose()`.
  3. Sonst `lent = false`.
- `dispose()`: idempotent über `#disposed` (Muster `docs/resource-lifecycle.md`
  §2). Jeden nicht verliehenen Eintrag freigeben und entfernen; verliehene
  bleiben gelistet, bis `release()` sie freigibt.
- Treffer-Pfad von `acquire()` und `release()` allokiert nichts: Schleifen über
  `#entries`, kein `find()`/`filter()`/`some()`/Closure, kein neues Array. Das
  Entfernen in place (Schreibindex, danach `length` kürzen) ist nicht
  Treffer-Pfad, darf aber ebenfalls ohne neues Array auskommen.

Klassen-TSDoc (Englisch, Inhalt vollständig, Wortlaut frei):

- A pool of `RenderTarget`s that `StageRenderer`s share for the internal target
  of Mode C — a `pipeline` without `buildOutputNode` that is not a
  `RootRenderPipeline`. Build one, set it as `internalTargetPool` on each
  renderer that shall share, and dispose it when the renderers are done with it.
- A renderer borrows a target at the start of its Mode C draw and gives it back
  once its pipeline has run, in the same call — also when a stage or the
  pipeline throws. Renderers that draw one after another therefore draw through
  the same target; a renderer that draws during the draw of another — a child
  with a pipeline of its own under a Mode C renderer — gets a target of its own.
  Each renderer clears the borrowed target in full before its stages draw, as it
  does its own, so nothing of the previous borrower stays in it.
- The pass-target a composing parent samples through `asPassNode()` is not
  pooled: the parent samples the pass-targets of all its children in one run of
  its pipeline, so each child keeps its own.
- A target is lent only for the exact width, height, `type` and `samples` it was
  built with. When no free target fits, the pool releases every free target
  before it builds a new one, so nothing of an earlier size stays behind after a
  resize. A pool that renderers of different sizes share builds a new target on
  every switch between them — give each size a pool of its own.
- Renderers that draw in the same order every frame borrow the same target every
  frame, so the `texture()` node of Mode C and the pipeline built on it stay.
- Ownership: the pool belongs to whoever built it. `StageRenderer#dispose()`
  leaves it alone.
- `acquire()`/`release()` TSDoc: width and height in pixels of the target;
  every `acquire()` is paired with one `release()`; code of your own may borrow
  from the same pool on the same terms. Which errors, after `dispose()` wie oben.
- `dispose()` TSDoc: releases every target that is back in the pool now and every
  lent target when it comes back through `release()`; afterwards `isDisposed` is
  `true` and `acquire()` throws an error naming the class and the state. Safe to
  call twice.

### 2. `src/stage/public-api.ts`

`export * from './StageRenderTargetPool.js';` als letzte Zeile, nach
`./StageRenderer.js` (die Datei sortiert ohne Rücksicht auf Groß-/Kleinschreibung).

### 3. `src/stage/StageRendererTargets.ts` (intern)

- `import type {StageRenderTargetPool} from './StageRenderTargetPool.js';`
- Neue Felder: `#pool?: StageRenderTargetPool`; `#lent?: RenderTarget` (das
  Target des laufenden Mode-C-Draws, eigenes wie geliehenes) und
  `#lentFrom?: StageRenderTargetPool` (der Pool, aus dem `#lent` stammt;
  `undefined` für das eigene).
- `get pool(): StageRenderTargetPool | undefined` und
  `set pool(pool: StageRenderTargetPool | undefined)`: speichert; mit einem Pool
  ruft der Setter `#dropOwnInternalTarget()`.
- `#dropOwnInternalTarget(): void` (privat): vergisst `#internal`
  (`this.#internal = undefined`) und gibt es per `dispose()` frei — außer es ist
  gerade `#lent`; dann gibt `returnInternalTarget()` es frei.
- `internalTarget()` entfällt, ersetzt durch
  `acquireInternalTarget(renderer: WebGPURenderer, width: number, height: number): RenderTarget`:
  - ohne Pool: `rt = (this.#internal = this.#ensure(this.#internal, renderer, width, height))`,
    `#lent = rt`, `#lentFrom = undefined` — dasselbe Verhalten wie bisher
    `internalTarget()` (Samples-Nachführung, Resize, Bau mit Typ und Samples).
  - mit Pool: `this.#pixelRatio = renderer.getPixelRatio?.() ?? 1`, dann
    `rt = pool.acquire(this.#deviceSize(width), this.#deviceSize(height), renderer.getOutputBufferType(), renderer.samples)`,
    `#lent = rt`, `#lentFrom = pool`.
- `returnInternalTarget(): void`: liest `#lent` und `#lentFrom`, setzt beide
  zuerst auf `undefined`; ohne `#lent` nichts. Mit `#lentFrom` →
  `lentFrom.release(rt)` (an den Pool, aus dem es kam, auch wenn inzwischen ein
  anderer oder keiner gesetzt ist). Ohne `#lentFrom` und `rt !== this.#internal`
  → `rt.dispose()` (ein eigenes Target, das während des Draws weggenommen wurde,
  Entscheidung 6).
- `dispose()`: statt `this.#internal?.dispose(); this.#internal = undefined;`
  jetzt `#dropOwnInternalTarget()`; Pass-Target wie bisher; zusätzlich
  `this.#pool = undefined` — der Pool selbst wird nicht disposed.
- `resize()`, `releaseInternalTarget()`, `passTarget()`, `releasePassTarget()`
  unverändert (mit Pool gibt es kein eigenes internes Target, beide laufen dann
  für Mode C leer).
- Modulkopf-Kommentar und Feld-TSDoc: das interne Target ist entweder hier gebaut
  oder für die Dauer eines Draws aus dem Pool geliehen; was dieses Modul
  freigibt, ist nur das eigene.

### 4. `src/stage/StageRenderer.ts`

- `import type {StageRenderTargetPool} from './StageRenderTargetPool.js';`
- Neuer Accessor direkt nach dem `buildOutputNode`-Setter (vor
  `#modeInputChanged()`):

  ```ts
  get internalTargetPool(): StageRenderTargetPool | undefined {
    return this.#targets.pool;
  }

  set internalTargetPool(pool: StageRenderTargetPool | undefined) {
    if (this.#disposed) return;
    if (this.#targets.pool === pool) return;
    if (pool?.isDisposed) {
      throw new Error('StageRenderer#internalTargetPool cannot take the pool: that pool has been disposed');
    }
    this.#targets.pool = pool;
  }
  ```

  TSDoc am Getter, Inhalt vollständig: optional pool the internal target of
  Mode C is borrowed from (Definition von Mode C wie an `pipeline`); renderers of
  the same size on the same pool that draw one after another draw through one
  target, see `StageRenderTargetPool`; without a pool the renderer builds its
  internal target itself. Borrowed at the start of the Mode C draw, given back
  once the pipeline has run, in the same call, also when a stage or the pipeline
  throws — no pooled target is held between frames. In the plain mode and the
  composing modes the pool is not used, and the pass-target a composing parent
  samples through `asPassNode()` never comes from it. Assigning a pool releases
  the internal target this renderer built for itself; clearing it again builds a
  new one on the next Mode C frame; a pool assigned during a Mode C draw of this
  renderer counts from the next draw on. The pool is handed in and stays the
  caller's: `dispose()` leaves it alone. A disposed pool is refused with an
  error naming the call and the state; a pool disposed while it is set makes the
  next Mode C frame throw the error of its `acquire()`. A disposed renderer
  answers `undefined` here and takes no new pool: like `pipeline`, the write is a
  silent no-op.
- `#renderPipelineSimple()`:

  ```ts
  const pipeline = this.#pipeline!;
  // borrowed before the try: an acquire() that throws has lent nothing
  const rt = this.#targets.acquireInternalTarget(renderer, this.width, this.height);
  try {
    this.#drawIntoInternalTarget(renderer, rt, stages);
    this.#wireInternalOutputNode(pipeline, rt);
    if (this.clear) this.#applyClear(renderer);
    pipeline.render();
  } finally {
    this.#targets.returnInternalTarget();
  }
  ```

  TSDoc der Methode neu: Mode C — borrow the internal target (from
  `internalTargetPool` if set, otherwise the renderer's own), draw the stages
  into it, run the pipeline sampling it as `texture()`, give it back — also when
  a stage or the pipeline throws; Clear-Sätze bleiben inhaltlich.
- TSDoc von `#clearForInternalRT()` (`:751-756`): »The internal RT belongs to
  nobody else who would clear it« ersetzen — nobody else clears the internal
  target, neither the renderer's own nor one borrowed from a pool, which still
  holds what its previous borrower drew; Rest bleibt.
- Terminologie (Queue-Eintrag), jeweils »internal pass-target« → »internal
  target«, Sätze sonst unverändert: Klassen-TSDoc `:95`; `pipeline`-TSDoc `:463`
  (dort zusätzlich: die Freigabe beim Verlassen betrifft das eigene Target, ein
  geliehenes ist nach jedem Draw schon zurück); `buildOutputNode`-TSDoc `:518`;
  `#renderPipelineSimple()` `:702` (ohnehin neu).
- TSDoc von `dispose()` (`:891-926`): im Absatz »A pipeline, an
  outputRenderTarget and every stage were handed in …« das
  `internalTargetPool` ergänzen (not disposed here); in »Afterwards … `parent`,
  `pipeline` and `buildOutputNode` answer `undefined`« und »a write to
  `pipeline` or `buildOutputNode` falls through« jeweils `internalTargetPool`
  ergänzen; der erste Satz (»Release the `RenderTarget`s this renderer built for
  itself«) bleibt wahr.
- `dispose()` selbst braucht keine neue Zeile: `this.#targets.dispose()` vergisst
  den Pool, der Getter antwortet danach `undefined`.
- Keine Allokation im Frame-Pfad: kein Closure, kein Objekt, kein Array pro
  `renderTo()`.

### 5. `src/stage/IPassProvider.ts`

Zeile 6-7: »a `texture()` node sampling the renderer's internal pass-target« →
»a `texture()` node sampling the renderer's pass-target«.

### 6. `src/stage/README.md`

- Architektur-Box, nach der Zeile `outputRenderTarget?`, exakt gleich breit:
  `│   – internalTargetPool?  Mode C             │`
- Tabelle »Class roles«, neue Zeile nach `RootRenderPipeline`:
  `StageRenderTargetPool` — lends the internal target of Mode C to the
  `StageRenderer`s it is set on, one draw at a time, so renderers of the same
  size share one target; built, handed in and disposed by the caller.
- »Clear policy in one table«, `:210`: »the **internal pass-target**« → »the
  **internal target**«; dazu ein Satz: a target borrowed from an
  `internalTargetPool` is cleared the same way, so nothing of the renderer that
  borrowed it before stays in it.
- Abschnitt »Mode C — pipeline samples an internal RT«: neuer Unterabschnitt
  `#### Sharing the internal target: StageRenderTargetPool` am Ende (vor
  `### Mode D`). Inhalt: wann (mehrere Renderer derselben Größe in Mode C, etwa
  Kinder mit je eigener Pipeline unter einem komponierenden Root — ohne Pool
  hält jeder sein eigenes Target, und ohne Pool ändert sich nichts); die Leihe
  pro Draw; Geschwister teilen, ein Kind unter einem Mode-C-Renderer bekommt ein
  eigenes; das Pass-Target wird nie gepoolt; exakte Passung und »one pool per
  size«; Besitz beim Aufrufer. Codeblock als `ts check` (importiert und
  deklariert alles; muss gegen die gebaute Library typprüfen):

  ```ts
  import {Display, OrthographicProjection, RootRenderPipeline, Stage2D, StageRenderer, StageRenderTargetPool} from '@spearwolf/twopoint5d';
  import {RenderPipeline} from 'three/webgpu';

  const display = new Display(document.getElementById('canvas')!);
  const renderer = display.renderer!;

  const root = new StageRenderer(display);
  root.pipeline = new RootRenderPipeline(renderer);

  // the children have the size of the root and draw one after another: one internal target serves all of them
  const pool = new StageRenderTargetPool();

  for (const name of ['back', 'front']) {
    const child = new StageRenderer(root).add(new Stage2D(new OrthographicProjection('xy|bottom-left')));
    child.name = name;
    child.pipeline = new RenderPipeline(renderer);
    child.internalTargetPool = pool;
  }

  // the pool is yours: dispose it once the renderers are done with it
  ```

  (Der Block oben steht hier mit `ts`, damit diese Datei ihn nicht anbietet; im
  README trägt er `ts check`. Scheitert der Typcheck an einer Zeile, die Zeile
  an die API anpassen, nicht die Markierung entfernen.)
- »Resource lifecycle«, `:516-519`: »releases the GPU memory of the internal
  pass-target« → »… of the internal target«. `:521`: »`StageRenderer.dispose()`
  releases both internal RTs.« präzisieren: the render targets it built for
  itself — a target borrowed from an `internalTargetPool` is back in the pool by
  then, and the pool is not disposed. Neuer Punkt nach dem `dispose()`-Punkt:
  a `StageRenderTargetPool` set as `internalTargetPool` lends the internal
  target for one draw at a time; while it is set the renderer builds no internal
  target of its own, and assigning it releases the one it had. The pool belongs
  to the caller; `pool.dispose()` releases every target that is back in the pool
  at once and every lent one as it comes back; a disposed pool lends nothing —
  `acquire()` throws, and a `StageRenderer` refuses it.
- Sonst keine Umformulierung; »pass-target« mit Bindestrich bleibt, wie es
  steht.

### 7. `packages/twopoint5d/CHANGELOG.md`

Skill `updating-changelog`. Unter `## [Unreleased]` → `### Added`, als letzter
Eintrag dieses Abschnitts (nach »export the `ProjectionViewRect` type …«). Inhalt:
add `StageRenderTargetPool` and `StageRenderer#internalTargetPool`; renderers of
the same size whose pipeline samples the internal target (a `pipeline` without
`buildOutputNode` that is not a `RootRenderPipeline`) share that target through
one pool; a renderer borrows it for one draw and gives it back once its pipeline
has run, so renderers drawn one after another draw through the same target, and
one that draws during the draw of another gets its own; exact width, height,
type and samples, free targets released before a new one is built — one pool
per size; the pass-target a composing parent samples is not pooled; the pool
belongs to the caller, `StageRenderer#dispose()` leaves it alone. Die
Terminologie-Korrektur bekommt keinen Eintrag.

### 8. `src/stage/StageRenderTargetPool.spec.ts` (neu)

Muster `docs/resource-lifecycle.md` §7: `createSandbox()` aus `sinon`,
`afterEach(() => sandbox.restore())`, Spies auf `RenderTarget.prototype.dispose`
wie in `StageRenderer.spec.ts:1894ff.`; `FloatType`/`HalfFloatType` aus
`three/webgpu`. Tests (Namen englisch, sinngemäß):

1. `acquire() builds a target of the width, the height, the type and the samples it is asked for`
2. `lends a target that is back to the next acquire() of the same size, type and samples` (dasselbe Objekt)
3. `lends a second target while the first is out` (verschiedene Objekte; nach beiden `release()` liefern zwei `acquire()` sie in Bau-Reihenfolge zurück)
4. parametrisiert über Breite, Höhe, `type`, `samples`: `builds a new target for another <width|height|type|samples> and releases the free ones first` (das freie alte Target genau einmal disposed, das neue nicht)
5. `keeps a target that is out when it builds one of another size` (verliehenes A nicht disposed; nach `release(A)` wieder verleihbar)
6. `release() refuses a render target it has not lent out` — fremdes `new RenderTarget()` und doppelte Rückgabe, beide mit exakt der Meldung aus Schritt 1
7. `describe('dispose()')`:
   - (a) `disposes every target that is back in the pool, once`
   - (c) `behaves as documented after dispose()`: `isDisposed === true`; `acquire()` wirft exakt `StageRenderTargetPool#acquire() is not available: this pool has been disposed`; ein bei `dispose()` verliehenes Target ist bis zu seinem `release()` nicht disposed und danach genau einmal; ein `release()` desselben Targets danach wirft die Meldung aus 6
   - (d) `is safe to call twice`
   - (b), (e), (f) entfallen: der Pool bekommt nichts herein, hat keine Signale und ist selbst der Pool.

### 9. `src/stage/StageRenderer.spec.ts`

- `:1021` `describe('Mode C: a pipeline that samples the internal pass-target')`
  → `describe('Mode C: a pipeline that samples the internal target')`.
- `:2006` Kommentar »drives the internal pass-target into existence« → »drives
  the internal target into existence«.
- Neues `describe('Mode C with an internalTargetPool')` hinter dem Mode-C-
  `describe` (eigene `makePipelineMock()` wie die Nachbarn; `sandbox` wie in
  `'release of the internal render targets'`; Spies per `sandbox.spy(pool,
  'acquire')`/`'release'` auf einer echten `StageRenderTargetPool`). Tests:
  1. `borrows its internal target from the pool for the draw and gives it back once the pipeline has run` — die Stage zeichnet in das Target, das `acquire()` lieferte; im Mock von `pipeline.render` ist `release` noch nicht gerufen; danach `release` genau einmal mit diesem Target
  2. `asks the pool for the size in device pixels and the type and the samples of the renderer` — `renderer.getPixelRatio.mockReturnValue(2)`, `resize(200, 100)` → `acquire(400, 200, FloatType, 4)`
  3. `lets two renderers of the same size that draw one after another draw through one target, frame after frame` — zwei Renderer, zwei Frames, beide Stages im selben Target; nach Frame 1 `pipeline.needsUpdate = false` setzen, nach Frame 2 bei beiden weiter `false` (Mode-C-Knoten bleibt)
  4. `gives a nested Mode C renderer under a Mode C parent on the same pool a target of its own` — Kind (eigene Pipeline, Pool) als Stage eines Mode-C-Elternteils (Pipeline, Pool); die Stage des Kinds zeichnet in ein anderes Target als die Stage des Elternteils; im zweiten Frame dasselbe Paar
  5. `gives the target back when a stage throws` — Fehler kommt aus `renderTo()`, `release` genau einmal mit dem Target, das nächste `acquire()` von außen bekommt es
  6. `releases its own internal target when a pool is assigned, and builds a new one when the pool is cleared` — Frame ohne Pool, dann Pool setzen: `RenderTarget.prototype.dispose` einmal mit dem eigenen Target; Frame mit Pool zeichnet ins Pool-Target; Pool auf `undefined`, nächster Frame zeichnet in ein Target, das weder das alte eigene noch das Pool-Target ist
  7. `releases the own target it draws into once the draw ends when a pool is assigned during the draw` — die Stage setzt im `renderTo()` den Pool; während des Draws kein `dispose()` des eigenen Targets, danach genau eins; der nächste Frame zeichnet ins Pool-Target
  8. `uses the pool in Mode C only` — ohne Pipeline und mit `buildOutputNode` kein `acquire()`; das Pass-Target eines Kinds unter einem komponierenden Elternteil mit Pool stammt nicht aus dem Pool
  9. `refuses a disposed pool with an error naming the call and the state, and keeps the pool it had` — exakte Meldung aus Schritt 4
  10. `throws the error of acquire() on the next Mode C frame when its pool has been disposed`
  11. `dispose() leaves the pool alone, and afterwards internalTargetPool answers undefined and takes no new pool` — `pool.dispose` nicht gerufen, `pool.isDisposed === false`, Schreiben nach `dispose()` wirft nicht und ändert nichts
- Bestehende Assertions nicht ändern. Ein bestehender Test, der wegen dieses
  Pakets rot wird, ist ein Befund, keine Anpassung.

### 10. `packages/twopoint5d-testing/test/stage-pipeline.test.js`

- `StageRenderTargetPool` in den Import aus `@spearwolf/twopoint5d` aufnehmen.
- Neuer Test `Mode C: two renderers of the same size on one StageRenderTargetPool draw through one internal target, each only its own stages`:
  64 × 64-Container, `await display.start()`; zwei `Stage2D` mit
  `OrthographicProjection('xy|bottom-left')`, je ein grünes `PlaneGeometry(16, 16)`
  (`#0f0`), A bei `x = -16`, B bei `x = 16`; zu jeder Stage eine Capture-Stage
  (plain object wie im Test `the internal targets have …`, `:503ff.`), die
  `r.getRenderTarget()` festhält; zwei `StageRenderer` a/b mit je eigener
  `RenderPipeline`, eigenem `outputRenderTarget` (64 × 64), demselben Pool,
  `resize(64, 64)`; zwei Frames von Hand: `a.renderTo(renderer); b.renderTo(renderer);`.
  Erwartet: beide Capture-Stages sahen in beiden Frames dasselbe Target; Target
  von a grün bei `(16, 32)`, schwarz bei `(48, 32)`; Target von b schwarz bei
  `(16, 32)`, grün bei `(48, 32)` (`isNearColor`, `rgbAt` wie die Nachbarn).
  Aufräumen: Renderer, dann Pool, Stages, Pipelines, Targets, Geometrie,
  Material.
- `grayThroughNestedPipeline(makeRootPipeline, childComposes, pool)`: dritter,
  optionaler Parameter (JSDoc `@param {StageRenderTargetPool} [pool]`); ist er
  gesetzt, bekommen `child` und `root` ihn als `internalTargetPool`; nach
  `root.dispose(); child.dispose();` `pool?.dispose()`.
- Neuer Test `Mode C: a nested pipeline under a pipeline-only root, both on one StageRenderTargetPool, applies the output transform once` —
  `grayThroughNestedPipeline((renderer) => new RenderPipeline(renderer), false, new StageRenderTargetPool())`,
  erwartet `[128, 128, 128]` mit Toleranz 3 wie die beiden Nachbartests.

## Findings im Volltext

**PERF-008 · info · `packages/twopoint5d/src/stage/StageRenderer.ts:444`** — Kein
RenderTarget-Pool für gleich dimensionierte Renderer
Jeder `StageRenderer` mit Pipeline hält sein eigenes internes RenderTarget.
Mehrere Renderer gleicher Auflösung könnten sich eines teilen. Unverändert; im
Remediation-Lauf bewusst zurückgestellt.
Empfehlung: Nice-to-have. Erst angehen, wenn eine reale Szene mehr als zwei, drei
verschachtelte Pipelines fährt — vorher ist der Pool teurer als das, was er spart.
(Effort M, Status im Audit `carried-over`; umgesetzt wird er laut »Entscheidungen«
vom 2026-09-29. Der Einwand »teurer als das, was er spart« trägt der Opt-in: ohne
Pool bleibt jeder Renderer, wie er ist.)

**Queue-Eintrag aus Paket 6b · info · `packages/twopoint5d/src/stage/StageRenderer.ts:95`, `:463`, `:518`, `:702`** —
die öffentliche TSDoc nennt das Target von Mode C »internal pass-target«, während
README und `asPassNode()` »pass-target« für das Target sagen, in das ein
komponierender Eltern-Renderer rendert; die beiden Targets verschwimmen in der
Doku. Dazu beim Abgleich: `README.md:210`, `:517`, `IPassProvider.ts:7`,
`StageRenderer.spec.ts:1021`, `:2006`.

## Reviewer-Urteil

**PERF-008 — behoben.** `StageRenderTargetPool.ts:35-144` (Treffer-Pfad von
`acquire()` ohne Allokation `:53-76`; freie Targets vor dem Neubau freigegeben
`:71`, `:123-135`; `release()` weist fremde und doppelte Rückgaben ab, auch nach
`dispose()` `:86-107`; verliehene Targets erst bei Rückgabe freigegeben
`:116-120`) · Export `public-api.ts:15` · `StageRendererTargets.ts:26-79`,
`:116-132` (`#dropOwnInternalTarget()` für Pool-Wechsel und `dispose()` während
des Draws, `#lentFrom` gibt an den Ursprungs-Pool zurück) · Accessor samt TSDoc
`StageRenderer.ts:540-575`, Leihe vor dem `try`, Rückgabe im `finally`
`:751-763`, TSDoc `#clearForInternalRT()` `:799`, `dispose()` `:947`, `:971-974`
· `CHANGELOG.md:74` unter `### Added` · README Box `:26`, Tabelle `:52`, Clear
policy `:212-217`, Unterabschnitt samt `ts check`-Block `:303-346`, Resource
lifecycle `:565-580` · Tests `StageRenderTargetPool.spec.ts:16-148`,
`StageRenderer.spec.ts:1434ff.`, zwei Browser-Tests in `stage-pipeline.test.js`.
Entscheidungen 1–8 und Schritte 1–10 ohne Abweichung umgesetzt.

**Queue-Eintrag »internal pass-target« — behoben.** `StageRenderer.ts:96`,
`:450`, `:464-467`, `:521`, `:742ff.`, `IPassProvider.ts:7`, `README.md:212`,
`:565`, `StageRenderer.spec.ts:1022`, `:2249`; in `src/` und den Docs keine
Fundstelle mehr. `CHANGELOG.md:3610` liegt im veröffentlichten Abschnitt und
bleibt.

**Kleine Befunde** (lösen keine Runde aus):

- `README.md:647-651` (»Pipeline lifecycle«) zählt nur `pipeline` und
  `outputRenderTarget` als Eigentum des Aufrufers und sagt »the renderer only
  releases what it owns — its internal RTs«; der Pool fehlt, und mit Pool hat der
  Renderer kein eigenes internes Target.
- `README.md:581-583` nennt `internalTargetPool` (und vorbestehend
  `buildOutputNode`) nicht beim No-op nach `dispose()` — als Nebenbefund in
  »Offene Befunde« gebucht, damit beide Namen in einem Zug nachgetragen werden.
- `StageRendererTargets.ts:23` — die Feld-TSDoc von `#pass` nennt das
  Pass-Target »Internal RT« (intern, aus Paket 6b).

**Abweichungen des Implementierers** (vom Reviewer bestätigt): zusätzliche
Stelle »internal / pass-target« über einen Zeilenumbruch in der
`pipeline`-TSDoc (`StageRenderer.ts:449-450`); Kommentar (f) im
`describe('dispose()')` (`StageRenderer.spec.ts:2478`) mitgezogen, weil »takes no
slot from a pool« mit dem Pool falsch wurde; zwei Absätze neu umbrochen;
Browser-Test vergleicht Targets per Identität statt `deep.equal`;
`release()` nach `dispose()` entfernt per privatem `#removeAt()` statt
`splice()` (keine Allokation).
