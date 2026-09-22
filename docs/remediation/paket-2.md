# Paket 2 — Test-Harness und Lookbook-Beschreibungen vereinheitlichen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-038 (low, gegenstandslos laut Zug 0), TEST-039 (low), TEST-041 (low),
  TEST-019 (low), TEST-026 (info), CONS-029 (low)
- Ziel: Browser-Teardowns hängen und leaken nicht, das Dirty-Range-Protokoll und
  `setUploadRange` haben ein Regressionsnetz, der Renderer-Stub hat eine Bauform, die
  Pipeline-/Projektionstests sind einmal rot gesehen, und die Demo-Beschreibung rendert
  überall gleich.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d-testing/test/display-resize.test.js`,
    `packages/twopoint5d-testing/test/stage-pipeline.test.js`,
    `packages/twopoint5d-testing/test/stage-renderer.test.js`
  - `packages/twopoint5d/src/vertex-objects/setUploadRange.spec.ts` (neu),
    `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts`
  - `apps/lookbook/src/layouts/VanillaDemo.astro`, `apps/lookbook/src/components/DemoNavBar.astro`,
    15 Seiten unter `apps/lookbook/src/pages/demos/` (Liste in Schritt 5)
  - nur als Probe, danach wieder im HEAD-Zustand: `packages/twopoint5d/src/stage/StageRenderer.ts`,
    `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`,
    `packages/twopoint5d/src/vertex-objects/setUploadRange.ts`
- Arbeitsverzeichnis für Probe-Logs: `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/5ff55df3-1e69-4969-a8e1-082491304971/scratchpad`
  (im Folgenden `$ARBEITSDIR`)

## Vorgehen

Reihenfolge einhalten: Schritt 1 läuft auf dem sauberen Baum, bevor irgendetwas anderes
geändert ist.

### 1. Pipeline- und Projektionswechsel im Browser rot sehen (TEST-026)

Vom Nutzer entschieden (»Entscheidungen« im Plan, 2026-09-22): den Fix, den die beiden
Browsertests absichern, testweise im Quellcode zurückdrehen, `dist` bauen, die Tests rot
sehen, zurückdrehen. Ein Commit entsteht dafür nur, wenn ein Test den Defekt **nicht**
erkennt.

Die beiden Tests in `packages/twopoint5d-testing/test/stage-pipeline.test.js`:

- `Mode D: swapping the stage projection after the first frame rebuilds the output node through the new camera` (Zeile 97–126)
- `Mode C: a replaced pipeline takes over the output` (Zeile 196–231)

Einzellauf der Datei (im Zug 0 ausprobiert, grün mit Exit 0 auf dem HEAD-`dist`):

```bash
cd packages/twopoint5d-testing && pnpm web-test-runner --files test/stage-pipeline.test.js
```

**Probe A — Projektion.** In `packages/twopoint5d/src/stage/StageRenderer.ts`, Methode
`add()`, Zeile 877, den Listener leeren:

```ts
on(stage, OnStageAfterCameraChanged, () => this.invalidateOutputNode()),
// wird für die Probe zu
on(stage, OnStageAfterCameraChanged, () => {}),
```

Dann `pnpm build:twopoint5d`, dann den Einzellauf, Ausgabe samt Exit-Code nach
`$ARBEITSDIR/paket-2.probe-projection.log`. Erwartet: der Projektionstest ist rot, mit
`the new camera needs a new pass node` (1 statt 2 Aufrufe von `buildOutputNode`), in
Chromium und Firefox. Danach `git checkout -- packages/twopoint5d/src/stage/StageRenderer.ts`.

**Probe B — Pipeline.** In derselben Datei, Setter `set pipeline` (Zeile 399–406), die Zeile
`this.#outputDirty = true;` (Zeile 404) samt dem Kommentar darüber entfernen. Dann
`pnpm build:twopoint5d`, Einzellauf, Log nach `$ARBEITSDIR/paket-2.probe-pipeline.log`.
Erwartet: der Pipeline-Test ist rot, mit `the replaced pipeline carries the output node of
the renderer`. Danach `git checkout -- packages/twopoint5d/src/stage/StageRenderer.ts`.

Abschluss der Probe: `git diff --exit-code -- packages/twopoint5d/src/stage/` muss Exit 0
geben, dann `pnpm build:twopoint5d`, damit `dist` wieder dem HEAD entspricht.

In den Report: je Probe die Fehlermeldung und die Browser, in denen der Test rot war.

**Fällt ein Test nicht:** Dieser Test wird so nachgeschärft, dass er unter seiner Probe rot
wird und auf dem HEAD-Stand grün — die Assertion muss die Folge des fehlenden
`#outputDirty` sehen (das Output-Node des alten Zustands bleibt stehen). Der rote Lauf mit
der Probe gehört dann in den Report, und die Commit-Message bekommt den Zusatz aus Schritt
»Commit«. Sonst ändert Schritt 1 keine Datei.

### 2. Die drei Teardown-Helfer mit `start()` angleichen (TEST-039)

Drei der elf Helfer rufen `display.dispose()` außerhalb eines `try`; wirft es, endet der
`afterEach` vor dem Entfernen des Containers. Die übrigen acht haben schon die Form, auf die
alle elf kommen — Vorlage ist `sprites-rotation.test.js:23-31`.

In `display-resize.test.js` (Zeile 24–32), `stage-pipeline.test.js` (Zeile 21–29) und
`stage-renderer.test.js` (Zeile 25–33) den Helfer ersetzen durch genau diesen Text:

```js
/** Teardown must not mask the failure that got it here: no display, or a display that fails to go down. */
function disposeDisplay(display) {
  if (!display) return;
  try {
    display.dispose();
  } catch {
    // ignore — the fixture still has to leave the dom
  }
}
```

Der Aufruf von `display.start()` im Teardown entfällt: `Display#dispose()` wartet bei einer
noch laufenden Initialisierung selbst auf deren Ende, bevor es den Renderer freigibt
(`packages/twopoint5d/src/display/Display.ts:1105-1116`), und die acht anderen Helfer bauen
seit Commit 049ba431 schon allein auf `dispose()`.

Im zugehörigen `afterEach` (`display-resize.test.js:69`, `stage-pipeline.test.js:37`,
`stage-renderer.test.js:48`) `async` und `await` streichen:
`afterEach(() => {` und `disposeDisplay(display);`. Der Rest des `afterEach` bleibt.

### 3. Das Dirty-Range-Protokoll mit zwei Geometries und `setUploadRange` absichern (TEST-041)

Das Protokoll ist korrekt; es bekommt ein Netz. Alle Erwartungswerte unten sind im Zug 0
gegen das gebaute Paket nachgerechnet.

**3a. Neue Datei `packages/twopoint5d/src/vertex-objects/setUploadRange.spec.ts`.** Ein
`describe('setUploadRange', …)` mit `test.each` (Stil wie
`packages/twopoint5d/src/display/FixedFrameLoop.spec.ts:137`). Jeder Fall baut
`new BufferAttribute(new Float32Array(10 * 4 * 3), 3)` aus `three/webgpu`, legt die
stehenden Ranges mit `addUpdateRange(start, count)` an und ruft
`setUploadRange(attr, fromIdx, toIdx, 4, 3)` — 4 Vertices je Objekt, 3 Elemente je Vertex,
also 12 Elemente je Objekt:

| Fall | stehende Ranges | fromIdx | toIdx | `updateRanges` danach |
| --- | --- | --- | --- | --- |
| keine Range steht, Objekte 2–4 | — | 2 | 4 | `[{start: 24, count: 36}]` |
| keine Range steht, ein Objekt | — | 5 | 5 | `[{start: 60, count: 12}]` |
| `toIdx` unter `fromIdx` nennt kein Objekt | — | 3 | 2 | `[{start: 36, count: 0}]` |
| stehende Range darunter | `{0, 12}` | 5 | 5 | `[{start: 0, count: 72}]` |
| stehende Range darüber | `{60, 12}` | 1 | 1 | `[{start: 12, count: 60}]` |
| stehende Range überlappt | `{12, 36}` | 3 | 5 | `[{start: 12, count: 60}]` |
| stehende Range mit `count` 0 zählt nicht | `{36, 0}` | 1 | 1 | `[{start: 12, count: 12}]` |
| leere neue Range übernimmt die stehende | `{24, 12}` | 3 | 2 | `[{start: 24, count: 12}]` |
| zwei stehende Ranges | `{0, 12}`, `{48, 12}` | 2 | 2 | `[{start: 0, count: 60}]` |

Dazu ein eigener Test: steht schon genau die Range, die herauskäme, bleibt sie unangetastet —
`vi.spyOn(attr, 'clearUpdateRanges')` wird nicht aufgerufen, und `attr.updateRanges[0]` ist
danach dasselbe Objekt wie davor (`toBe`). Zwei Fälle: stehend `{24, 12}` mit 2…2, und stehend
`{0, 72}` mit 2…2 (die stehende Range enthält das Objekt schon).

Ein Test mit `new InterleavedBuffer(new Float32Array(10 * 4 * 5), 5)` und
`setUploadRange(buffer, 2, 3, 4, 5)` → `[{start: 40, count: 40}]`: die Funktion rechnet mit dem
`itemSize`, das ihr gegeben wird, auch für einen verschränkten Buffer.

**3b. Zwei Geometries auf einem Pool, in
`packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`,** im
`describe('update ranges', …)` direkt nach dem Test
`a geometry that missed the frames in between uploads everything` (endet Zeile 757). Die
vorhandenen Helfer `staticQuadDesc`, `uploaded()` und `updateRangesOf()` werden benutzt.

Ein Helfer neben `settledQuadGeometry` (Zeile 631):

```ts
/**
 * Two geometries over one pool of `count` objects, both wound forward past their first
 * `update()` the way `settledQuadGeometry()` winds one. `write(idx)` writes the object in slot
 * `idx` and names it to the pool: a generated setter records nothing, so the caller that knows
 * which object it wrote says so.
 */
const twoSettledQuadGeometries = (count: number) => {
  const pool = new VertexObjectPool<MyBaseVO>(staticQuadDesc, 10);
  const first = new VertexObjectGeometry<MyBaseVO>(pool, 10);
  const second = new VertexObjectGeometry<MyBaseVO>(pool, 10);
  const objects = Array.from({length: count}, () => pool.createVO()!);
  for (const geometry of [first, second]) {
    geometry.update();
    uploaded(geometry, 'position');
  }
  const write = (idx: number) => {
    objects[idx]!.setPosition([idx, 0, 0, idx, 0, 0, idx, 0, 0, idx, 0, 0]);
    pool.buffer.touchBuffer('positions', idx, idx);
  };
  return {first, second, write};
};
```

Drei Tests, jeweils mit `twoSettledQuadGeometries(6)`; Werte als Produkte geschrieben wie im
Rest des Blocks (`{start: 1 * 4 * 3, count: 4 * 3}`):

1. `two geometries that update in the same frame both upload the object that was written` —
   `write(1)`, `first.update()`, `second.update()`: beide `[{start: 1 * 4 * 3, count: 4 * 3}]`.
   `uploaded()` für beide, dann `write(4)`, `first.update()`, `second.update()`: beide
   `[{start: 4 * 4 * 3, count: 4 * 3}]`. Kern: die erste Geometry nimmt der zweiten die Range
   nicht weg.
2. `a write between the updates of two geometries sends the second one every object in use` —
   `write(1)`, `first.update()`, `write(4)`, `second.update()`: `first`
   `[{start: 1 * 4 * 3, count: 4 * 3}]`, `second` `[{start: 0, count: 6 * 4 * 3}]` (die Range
   über Objekt 1 hat `first` abgeholt, eine neue hat mit Objekt 4 begonnen, und `second` stand
   vor ihrem Anfang). `uploaded()` für beide, dann `first.update()`, `second.update()`: `first`
   `[{start: 4 * 4 * 3, count: 4 * 3}]`, `second` `[]` — sie hat den Write an 4 schon mit allem
   anderen bekommen und nennt keine Range.
3. `a range still standing on one geometry widens there and nowhere else` — `write(1)`,
   `first.update()`, `second.update()`, nur `uploaded(second, 'position')`; dann `write(4)`,
   `first.update()`, `second.update()`: `first` `[{start: 1 * 4 * 3, count: 4 * 4 * 3}]`
   (Objekte 1…4 — die nicht hochgeladene Range steht noch auf ihrem Buffer und wird
   verbreitert), `second` `[{start: 4 * 4 * 3, count: 4 * 3}]`.

**3c. Das Netz einmal fangen sehen.** Die neuen Tests prüfen korrektes Verhalten und laufen
sofort grün; dass sie den Defekt erkennen, zeigt je eine Mutation, Ausgabe samt Exit-Code nach
`$ARBEITSDIR/paket-2.mutation-<n>.log`, danach die Datei mit `git checkout -- <datei>`
zurück:

1. `VertexObjectBuffer.ts`, `pickUpDirtyRange()` (Zeile 267): `seenSerial < buf.dirtySince || `
   aus der Bedingung streichen → Test 3b.2 rot.
2. `VertexObjectBuffer.ts`, `#markDirty()` (Zeile 237): `buf.pickedUpSerial === buf.serial || `
   aus der Bedingung streichen → Test 3b.1 rot.
3. `setUploadRange.ts`: die `for`-Schleife über `bufAttr.updateRanges` (Zeile 19–31)
   auskommentieren → die Tabellenfälle mit stehender Range rot.

Lauf je Mutation: `pnpm nx test twopoint5d -- src/vertex-objects/vertex-buffers-geometry-updates.spec.ts src/vertex-objects/setUploadRange.spec.ts`.
Nach der letzten: `git diff --exit-code -- packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts packages/twopoint5d/src/vertex-objects/setUploadRange.ts`
muss Exit 0 geben. Die roten Läufe in den Report.

### 4. Ein Renderer-Stub in der TextureStore-Spec (TEST-019)

In `packages/twopoint5d/src/texture/TextureStore.spec.ts` die Konstante in Zeile 12–13
ersetzen durch:

```ts
// the factory asks a renderer for exactly one thing, so a stub that answers it is a renderer
// enough; `dispose` is there for the test that watches whether the store releases a renderer
const makeRendererStub = ({maxAnisotropy = 16, dispose = () => {}}: {maxAnisotropy?: number; dispose?: () => void} = {}) =>
  ({getMaxAnisotropy: () => maxAnisotropy, dispose}) as unknown as WebGPURenderer;
```

Dann jede Renderer-Übergabe der Datei darauf umstellen:

| Zeile | jetzt | danach |
| --- | --- | --- |
| 144–147 | `const renderer = {getMaxAnisotropy: () => 16, dispose: rendererDispose};` + `new TextureStore(renderer as never)` | `new TextureStore(makeRendererStub({dispose: rendererDispose}))`, die Konstante `renderer` entfällt |
| 182–183 | Kommentar `// the store never reads the renderer it is given; it only has to be something` + `new TextureStore({backend: {}} as never)` | Kommentar streichen (er stimmt nicht: die Factory fragt `getMaxAnisotropy()`), `new TextureStore(makeRendererStub())` |
| 266 | `new TextureStore({backend: {}} as never)` | `new TextureStore(makeRendererStub())` |
| 275 | `store.renderer = {backend: {}} as never;` | `store.renderer = makeRendererStub();` |
| 379–381 | Kommentar `// assign a stub "renderer" with the expected API surface`, `const stubRenderer = …`, `store.renderer = stubRenderer as never;` | nur `store.renderer = makeRendererStub();` |
| 403–404 | `const stubRenderer2 = {getMaxAnisotropy: () => 8};` + `store.renderer = stubRenderer2 as never;` | `store.renderer = makeRendererStub({maxAnisotropy: 8});`, der Kommentar in Zeile 402 bleibt |
| 1163, 1187 | `new TextureStore(rendererStub)` | `new TextureStore(makeRendererStub())` |
| 1591, 1602 | `new TextureFactory(rendererStub, [])` | `new TextureFactory(makeRendererStub(), [])` |

Prüfung danach: `grep -n "getMaxAnisotropy\|backend: {}\|rendererStub\b\|stubRenderer" packages/twopoint5d/src/texture/TextureStore.spec.ts`
trifft nur noch die Zeilen des Helfers. `TextureFactory.spec.ts` und `Canvas2DStage.spec.ts`
bleiben, wie sie sind: der erste braucht bewusst einen Renderer ohne `getMaxAnisotropy`,
der zweite einen mit `render`.

### 5. Die Demo-Beschreibung immer als Prop (CONS-029)

Die Index-Karte (`apps/lookbook/src/components/Card.astro:27-29`) und der Dialog
(`apps/lookbook/src/components/DemoNavBar.astro:65-68`) schicken die Beschreibung durch
`marked`; nur der Slot-Weg der 15 Seiten escaped sie. Danach geht jede Seite über die Prop.

- `apps/lookbook/src/layouts/VanillaDemo.astro`: in `Props` `description: string` (ohne `?`),
  damit `astro check` (Teil von `pnpm typecheck`) eine Seite ohne Beschreibung meldet. Der
  Aufruf wird `<DemoNavBar title={title} showSource={showSource} description={description} />`
  — die Zeile `<slot name="demo-description" slot="description" />` und das schließende Tag
  entfallen.
- `apps/lookbook/src/components/DemoNavBar.astro`: die Zeile `<slot name="description" />`
  (Zeile 67) streichen. Danach nutzt keine Seite mehr einen Slot für die Beschreibung, und ein
  stehender Slot wäre der Weg zurück in die escapte Darstellung.
- Die 15 Seiten `animated-billboards`, `animated-sprites`, `crosses`, `display-minimal`,
  `display-multi`, `instanced-quads`, `map2d-tile-sprites`, `quadtree-playground`,
  `stage-nested-pipelines`, `stage-postprocessing`, `textured-quads`,
  `textured-quads-from-texture-atlas`, `textured-quads-from-tileset`,
  `textured-quads-po2image-loader`, `textured-sprites` (je `.astro` unter
  `apps/lookbook/src/pages/demos/`): `<Layout title={title} showSource={showSource}>` wird
  `<Layout title={title} showSource={showSource} description={description}>`, die Zeile
  `<p slot="demo-description">{description}</p>` entfällt samt der Leerzeile davor, wenn sonst
  zwei Leerzeilen aufeinanderträfen. `map2d-cam-visi` und `map2d-rect-visi` haben die Form schon.

Vorher/Nachher am gebauten Lookbook: vor der Änderung enthält
`apps/lookbook/dist/demos/map2d-tile-sprites/index.html` die Zeichenfolge
`` `Map2DTileRenderer` `` und kein `<code>Map2DTileRenderer</code>` (im Zug 0 nachgesehen);
danach umgekehrt. Beide Zustände in den Report.

## Verify

```bash
pnpm run ci \
  && ! grep -q '`Map2DTileRenderer`' apps/lookbook/dist/demos/map2d-tile-sprites/index.html \
  && grep -q '<code>Map2DTileRenderer</code>' apps/lookbook/dist/demos/map2d-tile-sprites/index.html
```

Baseline im Plan: vollständig grün, jeder rote Schritt ist neu.

## Commit

```
test(vertex-objects,texture,lookbook): tear the displays of the resize and stage browser tests down with dispose() alone, cover two geometries reading one pool and the merge of upload ranges with specs, build every renderer stub of the texture store spec with one helper, and let every lookbook demo hand its description to the layout, so the dialog renders its Markdown the way the index card does
```

Nur wenn Schritt 1 einen Test nachschärfen musste, kommt vor `, and let every lookbook demo`
ein Zusatz, je nach nachgeschärftem Test genau einer dieser beiden oder beide:

- Pipeline-Test: `, make the browser test of a replaced pipeline fail when the renderer keeps the output node it had`
- Projektionstest: `, make the browser test of a swapped stage projection fail when the renderer keeps the output node it had`

Warum `test` für einen Commit mit Lookbook-Änderung: vier der fünf Stränge sind Tests, das
Paket wird in einem Commit geschlossen, und das Repo führt gemischte Scopes unter einem Typ
(`fix(stage,map2d,lookbook)`, 6073b0a2).

## Entscheidungen im Zug 0

- **TEST-038 gegenstandslos.** Die Datei an der Fundstelle gibt es nicht mehr; kein Teardown
  im Harness wartet auf die GPU-Queue (Abgleich unten). Der fristlose Wartevorgang steht jetzt
  im Library-Code und geht nach der Scope-Regel als Nebenbefund ins Audit, nicht in dieses
  Paket — ein Eingriff in `Display#dispose()` verschöbe den Scope von 11 gewählten
  Harness-Findings in die Library.
- **TEST-039 auf die drei verbliebenen Helfer eingegrenzt,** mit der Form der acht anderen
  statt eines `finally` im `afterEach`: die Empfehlung will alle elf gleich, und acht haben
  schon eine Form, die nicht werfen kann.
- **TEST-041 ohne eigene `GeometryRoutes.spec.ts`.** Das Protokoll wirkt nur zwischen
  Pool-Buffer, Route und Attribut; getestet wird es dort, wo die Helfer dafür schon stehen
  und der einzige Zwei-Geometry-Test liegt. `setUploadRange` ist eine reine Funktion und
  bekommt die Tabellentests in einer eigenen Datei, wie die Empfehlung sagt. Die Mutationen in
  3c sind kein Teil der Empfehlung; sie sind der Beleg, dass das neue Netz fängt, denselben
  Mangel, den TEST-026 an den Browsertests beschreibt.
- **TEST-019 bleibt in der einen Spec.** Einen dateiübergreifenden Test-Helfer gibt es im
  Library-Paket nicht, und die zwei anderen Specs mit Renderer-Stub brauchen bewusst andere
  Bauformen.
- **CONS-029 über die Prop, der Slot fällt.** Die Empfehlung erlaubt beides (Slot streichen
  oder für Zusatz-Markup behalten); keine Seite hat Zusatz-Markup. `VanillaDemo` liest die
  JSON nicht selbst: es kennt die Demo nicht, zu der es gehört, und `title`/`showSource`
  kommen genauso von der Seite.
- **Ein Paket, kein Schnitt.** Nach dem Abgleich bleibt ein mittelgroßer Diff ohne gemeinsame
  Dateien zwischen den Strängen; ein zweites Paket kostete drei Kaltstarts mehr.

## Abgleich

- **TEST-038 · gegenstandslos.** `packages/twopoint5d-testing/test/support/stopAndDrain.js`
  wurde in 049ba431 (2026-09-21) gelöscht. `git grep onSubmittedWorkDone -- packages/twopoint5d-testing`
  trifft nur den Stub innerhalb eines Tests, `display-dispose.test.js:381-386`. Das Warten
  selbst steht jetzt in `packages/twopoint5d/src/display/Display.ts:55-64`
  (`drainSubmittedWork()`), aufgerufen in der Hintergrund-Freigabe `Display.ts:1115`;
  `dispose()` kehrt synchron zurück, kein Teardown wartet darauf. Rest im Library-Code → Offene
  Befunde im Plan.
- **TEST-039 · umgeformt.** `stopAndDrain` ist aus allen elf Helfern verschwunden. Acht
  (`sprites-rotation:24`, `map2d-placement:32`, `map2d-tile-upload:37`,
  `map2d-visibility-helpers:35`, `vertex-objects-buffers-data:23`, `vertex-objects-dispose:26`,
  `vertex-objects-gpu-upload:31`, `vertex-objects-heap:51`) sind synchron und fangen
  `dispose()` ab. Drei (`display-resize.test.js:24-32`, `stage-pipeline.test.js:21-29`,
  `stage-renderer.test.js:25-33`) rufen `display.dispose()` nach einem `await display.start()`
  außerhalb eines `try`; wirft es, bleibt der Container im DOM.
- **TEST-041 · unverändert.** `VertexObjectBuffer.ts:231-275` (`#markDirty`,
  `pickUpDirtyRange`), `GeometryRoutes.ts:169-199` (`syncUploads`), `setUploadRange.ts:15-38`;
  kein Commit seit dem Audit im Modul. Vorhanden ist ein Zwei-Geometry-Test,
  `vertex-buffers-geometry-updates.spec.ts:737-757`, für eine Geometry, die zwei Frames
  aussetzt. Nicht abgedeckt: beide im selben Frame, ein Write zwischen den beiden Updates, eine
  stehende Range auf nur einer Geometry. `setUploadRange` hat keine Spec-Datei.
- **TEST-019 · unverändert.** `TextureStore.spec.ts:13` `rendererStub`, daneben sechs
  Inline-Stubs in drei Formen (Zeilen 145, 183, 266, 275, 380, 403). `{backend: {}}` trägt, weil
  `TextureFactory.ts:122-128` `renderer.getMaxAnisotropy?.()` optional aufruft.
- **TEST-026 · unverändert, verschoben.** Die Tests stehen jetzt in
  `stage-pipeline.test.js:97-126` und `:196-231`; 049ba431 hat dort nur den Teardown geändert.
  Die Fix-Stellen aus f1c0e58e stehen in `StageRenderer.ts:877` (Kamera-Listener in `add()`)
  und `StageRenderer.ts:399-406` (`set pipeline`).
- **CONS-029 · unverändert.** `Card.astro:27-29` mit `marked`, 15 von 17 Seiten über den Slot;
  das gebaute `apps/lookbook/dist/demos/map2d-tile-sprites/index.html` zeigt die Backticks
  literal, `map2d-cam-visi` rendert `<code>Map2D</code>`.
- **Offene Folgen und Befunde vor diesem Paket:** keine — Paket 1 hat `Folgen: keine` und
  `Nebenbefunde: keine`, »Offene Befunde« war leer.

## Findings im Volltext

**TEST-038 · low · packages/twopoint5d-testing/test/support/stopAndDrain.js:23** —
stopAndDrain wartet ohne Timeout auf onSubmittedWorkDone()
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. Geht das Device
verloren, löst `device.queue.onSubmittedWorkDone()` womöglich nie auf; der Teardown hängt
dann bis zum Mocha-Timeout, und die Meldung zeigt auf den Timeout statt auf das verlorene
Device.
Empfehlung: Das Warten mit einer kurzen Frist per `Promise.race` begrenzen und bei Ablauf mit
einer eigenen Meldung weitermachen.

**TEST-039 · low · packages/twopoint5d-testing/test/sprites-rotation.test.js:24-31** — In elf
Teardown-Helfern steht stopAndDrain vor dem try, ein Reject lässt die Fixture stehen
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers.
`disposeDisplay` in den elf Testdateien mit eigenem Helfer ruft `await stopAndDrain(display)`
vor dem `try`; rejected es, laufen `dispose()` und das Entfernen des Containers nicht, und die
Fixture bleibt für die folgenden Tests im DOM (so vom Detailplan festgelegt).
Empfehlung: `stopAndDrain` in das `try` ziehen oder den Container in einem `finally`
entfernen — in allen elf Helfern gleich.

**TEST-041 · low · packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:257-275**
(dazu `GeometryRoutes.ts`, `setUploadRange.ts:15-38`) — Das Dirty-Range-Protokoll mit
mehreren Konsumenten gezielt testen
`pickedUpSerial` und `dirtySince` sind dafür gebaut, dass mehrere Geometries denselben Pool
lesen. Die Specs zu »second geometry« prüfen aber nur Dispose und Ownership, keine versetzt
laufenden `update()`s mit Teil-Writes. `GeometryRoutes`, `GeometryAttributeSlots` und
`setUploadRange` haben keine eigene Spec-Datei. Beim Durchrechnen ist das Protokoll korrekt,
es hat aber kein Regressionsnetz.
Empfehlung: Spec mit zwei Geometries auf einem Pool, abwechselnden `update()`s mit Writes an
verschiedenen Indizes und Prüfung der `updateRanges`. Dazu Tabellentests für
`setUploadRange`.

**TEST-019 · low · packages/twopoint5d/src/texture/TextureStore.spec.ts:13** — Zwei
Bauformen für den Renderer-Stub in derselben Spec
`{getMaxAnisotropy: () => 16, dispose}` und `{backend: {}}` stehen nebeneinander. Beide
funktionieren, weil `TextureFactory` den Aufruf von `getMaxAnisotropy()` optional macht;
welche die richtige ist, sagt die Datei nicht. Re-Check: unverändert.
Empfehlung: Einen gemeinsamen Helfer `makeRendererStub()` anlegen.

**TEST-026 · info · packages/twopoint5d-testing/test/stage-pipeline.test.js:99** — Die
Browsertests zum Pipeline- und Projektionswechsel einmal rot sehen
Die beiden Browsertests zum Wechsel von Pipeline bzw. Stage-Projektion nach dem ersten Frame
wurden nie rot gesehen, weil die Browser-Suite gegen das gebaute `dist` läuft. Dass sie den
Defekt erkennen würden, belegen nur die Vitest-Regressionen. Aufgefallen im Remediation-Lauf
vom 2026-09-19.
Empfehlung: Einmal gegen ein `dist` vom Stand vor dem Fix laufen lassen oder die Erwartung
testweise umdrehen.

**CONS-029 · low · apps/lookbook/src/components/Card.astro:27-29** — description auf der
Index-Karte und im Demo-Dialog gleich rendern
Die Karte lässt `marked` über die Beschreibung laufen, Backticks werden also `<code>`; 15 von
17 Seiten reichen denselben String an `<p slot="demo-description">`, das ihn escaped, sodass
der Dialog literale Backticks zeigt (`_map2d-tile-sprites`, `_stage-nested-pipelines`,
`_stage-postprocessing`). Nur die zwei `map2d-*-visi`-Seiten nutzen die
`description={description}`-Prop, die in `DemoNavBar` durch `marked` geht. XSS ist keins:
Beide `set:html`-Eingaben sind repo-eigene Build-Zeit-JSON, kein Nutzerinput erreicht sie;
dasselbe gilt für die `?raw`-SVG-Icons.
Empfehlung: `VanillaDemo.astro` die `description` selbst aus der JSON lesen lassen (es bekommt
`title`/`showSource` schon) und immer als Prop übergeben; den Slot streichen oder nur für
zusätzliches Markup behalten. Jede Seite verliert drei Zeilen.

## Verlauf

- 2026-09-22 Zug 0: Detailplan steht · TEST-038 gegenstandslos (`stopAndDrain.js` in 049ba431
  gelöscht) · TEST-039 umgeformt, Rest in 3 Helfern · TEST-041, TEST-019, CONS-029 unverändert
  · TEST-026 unverändert, Tests nach `:97` und `:196` verschoben · Erwartungswerte 3a/3b gegen
  `packages/twopoint5d/dist` nachgerechnet · 1 Nebenbefund (`Display.ts:55-64`) → Offene
  Befunde, → Audit · keine offenen Folgen zu verteilen
- 2026-09-22 Zug 1: Implementierer beauftragt (sonnet, effort medium, `remediate-p2-impl-1`), Brief `$ARBEITSDIR/paket-2.impl-1.brief.txt`
- 2026-09-22 Zug 2: Report FERTIG · 3 Browsertests, 2 Specs (1 neu), `TextureStore.spec.ts`, `VanillaDemo.astro`, `DemoNavBar.astro`, 15 Demo-Seiten · Proben A/B rot, Mutationen 1–3 rot (Logs `$ARBEITSDIR/paket-2.probe-*.log`, `paket-2.mutation-*.log`) · Arbeitsbaum schmutzig
- 2026-09-22 Zug 2 Verify: eigener Lauf exit=0, Log `$ARBEITSDIR/paket-2.verify.log`
- 2026-09-22 Zug 3: Reviewer (sonnet, effort medium, `remediate-p2-review-1`) Gesamturteil ok, keine Befunde · Diff `$ARBEITSDIR/paket-2.diff`, Report `$ARBEITSDIR/paket-2.review-1.json`
- 2026-09-22 Zug 4: entfällt, keine Befunde
- 2026-09-22 Zug 5: committet 7ec25649, Verify `$ARBEITSDIR/paket-2.verify.log` exit=0 (keine Codeänderung seit dem Lauf)

## Urteil des Reviewers

- TEST-038 · gegenstandslos bestätigt — `packages/twopoint5d-testing/test/support/stopAndDrain.js` existiert nicht mehr, kein Teardown wartet auf die GPU-Queue
- TEST-039 · behoben — `display-resize.test.js:24-32`, `stage-pipeline.test.js:21-29`, `stage-renderer.test.js:25-33`, `afterEach` synchron
- TEST-041 · behoben — `packages/twopoint5d/src/vertex-objects/setUploadRange.spec.ts` (9 Tabellenfälle, 2 Unangetastet-Fälle, InterleavedBuffer), `vertex-buffers-geometry-updates.spec.ts` (`twoSettledQuadGeometries` + 3 Tests); Mutationen 1–3 rot
- TEST-019 · behoben — `TextureStore.spec.ts:12-15` `makeRendererStub()`, alle acht Übergaben umgestellt
- TEST-026 · behoben — Proben A/B rot mit den vorhergesagten Meldungen, Logs `$ARBEITSDIR/paket-2.probe-projection.log`, `paket-2.probe-pipeline.log`
- CONS-029 · behoben — `VanillaDemo.astro` Prop `description: string`, `DemoNavBar.astro` Slot gestrichen, 15 Seiten auf Prop umgestellt

## Kleine Befunde

- keine im Diff · Anmerkung Reviewer: Mutation 2 (`#markDirty`) macht 9 statt der im Plan genannten einen Test rot — Ungenauigkeit im Detailplan, der Nachweis steht
- Abweichung des Implementierers: bei 5 Seiten (`animated-billboards`, `animated-sprites`, `display-minimal`, `stage-nested-pipelines`, `stage-postprocessing`) auch die Leerzeile vor `</Layout>` gestrichen, damit alle Seiten die Form von `map2d-cam-visi.astro` tragen
