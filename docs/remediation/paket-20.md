# Paket 20 — Drain: Stage-Events in der Doku, dissolve-Rauschen, TSL-Casts, Vertex-Pool und map2d-Kleinigkeiten

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Drain: acht Nebenbefunde aus »Offene Befunde«, dort »überführt in Paket 20«; Volltext unten)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie `#centerPoint2D`): `#matrixWorldInverse`, `#tileBoxMatrix`, `#tileBoxOffset` in `src/map2d/CameraBasedVisibility.ts:359`/`:363`/`:369` — in place beschriebene Felder ohne `readonly`, die einzigen der Klasse neben `#centerPoint2D` (an d9b648bf `:383`/`:387`/`:393`, ebenso ohne)
- Ziel: Doku und TSDoc nennen jeden Sender und jedes Event, `dissolve()` rauscht ohne `sin()`-Hash streifenfrei, die TSL-Casts entfallen, wo @types/three 0.187 sie trägt, und Pool, Buffer und map2d prüfen bzw. dokumentieren, was ihr TSDoc verspricht.
- Modell: mittlere Stufe (sonnet)
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`, wo nicht anders genannt):
  - `src/events.ts`, `docs/stages.md` (Schritt 1)
  - `src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` (Schritt 2)
  - `src/map2d/CameraBasedVisibility.ts` (Schritt 3)
  - `src/vertex-objects/VOBufferPool.ts`, `src/vertex-objects/VertexObjectPool.spec.ts` (Schritt 4)
  - `src/vertex-objects/VertexObjectBuffer.ts`, `src/vertex-objects/VertexObjectBuffer.spec.ts` (Schritt 5)
  - `src/stage/transitionEffects.ts`, `src/stage/transitionEffects.spec.ts`, `packages/twopoint5d-testing/test/stage-transitions.test.js` (Schritt 6)
  - `src/sprites/SpritePicker.ts`, `src/stage/StageMask.ts`, `src/stage/transitionEffects.ts`, `src/stage/StageDirector.ts`, `src/texture/sampleFrameAt.ts`, `src/texture/sampleAtlasFrame.ts`, `src/sprites/FeatureSprites/FeatureSpritesMaterial.ts`, `src/texture/AtlasFrameTable.ts` (Schritt 7)
  - `CHANGELOG.md` (Schritt 8)
- Vorgehen:
  1. **Sender der Stage-Events.**
     - `src/events.ts:150-153`, TSDoc von `OnStageDispose`: der erste Satz wird zu »Emitted once by `dispose()` of a `Stage2D`, of a `StageRenderer` — a `StageDirector` is one — and of the mask stage `StageMask.inWorldOf()` builds, with the stage itself, before the stage stops listening.« Der Rest des Blocks (»A `StageRenderer` listens for it …«, »Shares its name …«) bleibt.
     - `docs/stages.md:1959`, Tabelle unter »## Events«: die Zeile `` | `StageRenderer`, `Stage2D` | `OnStageDispose` | once, from `dispose()` | `` wird zu `` | `StageRenderer`, `Stage2D`, the stage `StageMask.inWorldOf()` builds | `OnStageDispose` | once, from `dispose()` | ``.
     - Direkt darunter eine neue Zeile: `` | `StageDirector` | `OnStageTransitionStart`, `OnStageTransitionEnd` | `{director, transition}`: the first frame of a transition after its delay, and the frame or the call that ends it; both at once for a change without a transition — see [The transition](#the-transition) | ``. Der Anker `#the-transition` ist die Überschrift `### The transition` (`:905`); der Prosa-Absatz »**Events.**« dort (`:939-943`) bleibt.
     - Kein Test, kein CHANGELOG (Doku).
  2. **`ChunkQuadTreeNode`, Klassen-TSDoc** `src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:108-109`: »A node is either a leaf without children or has exactly four children corresponding to the celestial directions (quadrants).« wird zu »A node is either a leaf without children or is split by `subdivide()` into the four quadrants of the celestial directions, each of which holds a child node or `null` where no chunk lies — a node split along one axis has two children at most.« Die übrigen Absätze des Blocks bleiben. Kein Test, kein CHANGELOG.
  3. **`readonly` in `CameraBasedVisibility`** (`src/map2d/CameraBasedVisibility.ts`): `readonly` vor `#centerPoint2D` (`:352`, gehalten von `#dependencyValues` `:405`), `#matrixWorldInverse` (`:359`), `#tileBoxMatrix` (`:363`), `#tileBoxOffset` (`:369`). Sonst nichts — keines der vier Felder wird neu zugewiesen (`grep -nE "this\.#(centerPoint2D|matrixWorldInverse|tileBoxMatrix|tileBoxOffset) =[^=]"` ohne Treffer). Kein Test (tsc hält es), kein CHANGELOG (privat).
  4. **`VOBufferPool#usedCount` lehnt Nicht-Zahlen ab** (`src/vertex-objects/VOBufferPool.ts:138-149`):
     - Bedingung im Setter: `if (typeof value !== 'number' || Number.isNaN(value) || (Number.isFinite(value) && !Number.isInteger(value)))`. Meldung: `` new RangeError(`VOBufferPool#usedCount must be a whole number, Infinity or -Infinity, got ${describeValue(value)}`) `` (»a whole number« wie die Helfer in `src/utils/`; eigene Meldung, weil ±Infinity geklemmt wird und auf keinen Helfer passt — AGENTS.md »A check whose message says more … writes its own in the same words«). Der Inline-Kommentar über der Bedingung nennt zusätzlich »a value that is no number«. Die Prüfung bleibt vor `if (this.#disposed) return;`.
     - TSDoc des Setters, erster Absatz (`:126-128`): »Takes every whole number, clamped to `0` … {@link capacity}; `Infinity` and `-Infinity` are clamped the same way. Throws a `RangeError` for `NaN`, for a fraction and for a value that is no number — `undefined`, a string —, none of which names a slot — on a disposed pool as well.« Der zweite und dritte Absatz bleiben.
     - Hot Path: `VertexObjectPool#createVO()` ruft den Setter (`this.usedCount++`); ein `typeof` allokiert nichts, `pnpm test:allocations` im Gate hält das.
     - Specs in `src/vertex-objects/VertexObjectPool.spec.ts`, `describe('usedCount')` (`:676`), **vor dem Fix schreiben und rot sehen**:
       - neu `usedCount refuses a value that is no number, and the count stays where it was`: `pool.usedCount = 3`, dann `undefined`, `null`, `'3'`, `{}` (je `as unknown as number`) — jeder Wurf ein `RangeError`, für `undefined` mit genau `VOBufferPool#usedCount must be a whole number, Infinity or -Infinity, got undefined`; danach `pool.usedCount` `3`; nach `pool.dispose()` wirft `undefined` weiter einen `RangeError`. Rot vorher: kein Wurf.
       - neu `fromBuffersData() refuses buffers data whose usedCount is no number, and leaves the pool as it was`: Daten aus `toBuffersData({copy: true})` eines gefüllten Pools mit `usedCount: undefined`; `RangeError`, `usedCount` und die Werte der Buffer unverändert. Rot vorher: `usedCount` wird `NaN`.
       - neu `the constructor refuses buffers data whose usedCount is no number`: `new VertexObjectPool(descriptor, {capacity: 2, buffers: {}} as unknown as VertexObjectBuffersData)` wirft einen `RangeError`. Rot vorher: kein Wurf.
       - `:701` (Test `usedCount refuses NaN and a fraction`): Regex auf `/VOBufferPool#usedCount must be a whole number, Infinity or -Infinity, got 1.5/`.
  5. **`VertexObjectBuffer#copy()` nennt die Quelle** (`src/vertex-objects/VertexObjectBuffer.ts`):
     - neben `releasedError()` (`:106-108`) eine Modulfunktion `releasedSourceError(method: string): Error` mit `` `VertexObjectBuffer#${method}: the source buffer holds no typed array any more — the pool behind it has been disposed` `` (Wortlaut der Konstruktor-Meldung `:188`) und einem Kommentar, warum: die Quelle ist losgelassen, nicht dieser Buffer — eine Meldung über »this buffer« schickte den Aufrufer zum falschen Pool.
     - `:441-442`: `throw other.#released ? releasedSourceError('copy()') : new Error(…)`. `releasedError()` bleibt für die übrigen Methoden.
     - Spec `src/vertex-objects/VertexObjectBuffer.spec.ts:909` (`copy() from a released buffer throws`): dazu `expect(run, 'the message names the source').toThrow('VertexObjectBuffer#copy(): the source buffer holds no typed array any more — the pool behind it has been disposed')`. Vor dem Fix rot.
  6. **`dissolve()` ohne `sin()`** (`src/stage/transitionEffects.ts`):
     - neue exportierte Funktion, nicht in `src/stage/public-api.ts`, mit `@internal`:
       ```ts
       /**
        * A hash in 0 … 1 of a cell, without `sin()` — Dave Hoskins' "hash without sine": a `sin()` of
        * the cells of a large picture, past 10⁵ radians at 4K, leaves diagonal stripes on some GPUs.
        * @internal
        */
       export function cellHash(cell: Node<'vec2'>): Node<'float'> {
         const p3 = fract(vec3(cell.x, cell.y, cell.x).mul(0.1031));
         const q = p3.add(dot(p3, p3.yzx.add(33.33)));
         return fract(q.x.add(q.y).mul(q.z));
       }
       ```
       (dieselbe Formel wie `hash21` in `apps/lookbook/src/demos/stage-masks/helpers.ts:68-72`). Lehnt tsc einen Ausdruck ab, die engste Typisierung — kein `as unknown as`.
     - `dissolve()` `:298`: `const noise = cellHash(cell);`. Import `vec3` aus `three/tsl` dazu, `sin` (nur `:298`) weg.
     - Specs in `src/stage/transitionEffects.spec.ts`, **vor dem Fix schreiben und rot sehen**:
       - `dissolve builds its noise without sin()`: über `nodesOf(dissolve({scale: 4}).build(input()))` aus `../testing/spriteGraph.js` kein Knoten mit `method === 'sin'`. Rot vorher.
       - `cellHash answers a value in 0 … 1 spread over the range, at the cells of a 4K picture as well`: `evaluateNode(cellHash(vec2(x, y)))` für die 64 × 64 Zellen ab `(0, 0)` und ab `(3776, 2096)` — jeder Wert in `[0, 1)`, je Block hält jedes der zehn Zehntel 5–15 % der Werte.
     - Browser `packages/twopoint5d-testing/test/stage-transitions.test.js`, neu `dissolve() switches about half of the picture at progress 0.5, at the cells of a 4K picture as well`: Muster des `wipe()`-Tests (`:120`), `layer('red', '#f00')`, `layer('green', '#0f0')`, für `scale` `1` und `1 / 64` (bei 64 px sind das Zellen bis 4096 je Achse) je `director.replace(red.stage, green.stage, {effect: dissolve({scale, softness: 0}), manual: true})`, `progress = 0.5`, `draw()`; jedes Pixel ist rot oder grün (`isNearColor`), der grüne Anteil liegt in `[0.4, 0.6]`; `cancel()` zwischen den beiden. `dissolve` zum Import aus `@spearwolf/twopoint5d`. Kein Regressionstest im strengen Sinn (die Streifen zeigen sich nur auf manchen GPUs, nicht auf den Runnern): er hält, dass die neue Formel unter WebGPU und WebGL 2 kompiliert und streut.
     - `docs/stages.md:965` und Proposal `docs/proposals/stage-transitions.md:403` bleiben (»a noise per cell«, weiterhin wahr). Kein CHANGELOG-Eintrag: `dissolve()` steht nur unter `## [Unreleased]` (`CHANGELOG.md:34`, »Added«), ist unveröffentlicht, und die Zeile bleibt wahr. Vorschaubilder des Lookbooks werden nicht neu erzeugt.
  7. **TSL-Casts, die @types/three 0.187 trägt.** Vorlage ist der Probe-Diff `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-20-probe/casts.probe.diff` (gegen 8379ebe7, tsc des Library-Typechecks dort exit 0). Ihn von Hand übertragen, nicht als Patch anwenden (Schritt 6 ändert `transitionEffects.ts` daneben):
     - entfallen ganz (Ausdruck bleibt, ` as unknown as …` weg): `src/sprites/SpritePicker.ts:405`/`:417`; `src/stage/StageMask.ts:148` (die Feld-Annotation `UniformNode<'float', number>` bleibt); `src/stage/transitionEffects.ts:480`/`:487` und der Einzelcast `p as Node<'float'>` `:484` (→ `progress: p,`); `src/stage/StageDirector.ts:2304`/`:2320`/`:2338`/`:2343`/`:2345`/`:2360`; `src/texture/sampleFrameAt.ts:68`/`:71`/`:75`/`:81`/`:82`/`:83`/`:87`/`:90`/`:91`/`:92`/`:95`; `src/texture/sampleAtlasFrame.ts:114`/`:117`/`:124`/`:130`; `src/sprites/FeatureSprites/FeatureSpritesMaterial.ts:365`/`:377` und der äußere Cast von `:384`; `src/texture/AtlasFrameTable.ts:123`.
     - ersetzt: `StageDirector.ts:2332` → `let out: Node<'vec4'> = this.#clearUniform;` · `FeatureSpritesMaterial.ts:356` → `return attribute<T>(attributeName);` · `:384` → `return vec2(textureSizeOf(node) as unknown as Node<'vec2'>);`, Kommentar darüber: `// a uvec2 that @types/three types as a plain Node, which no vec2() overload takes; vec2() converts it`.
     - bleiben: `FeatureSpritesMaterial.ts:358` (`uniform<T>`: die Ressourcen halten die Union `SpriteUniformNode`, der Kontext verspricht das `Node<T>`, das das Feature nennt) mit einem Kommentar, der das sagt; `src/sprites/typedNodes.ts` und `src/sprites/matrixColumn.ts` (ihr Zweck ist genau dieser eine Cast); alles, was kein TSL-Knoten ist (`FeatureSpritesMaterial.ts:100`, `textureShapeKey.ts:70`, `Display.ts:155`, `HelpersManager.ts:108`, `readBitmapFontSource.ts:61`, `sorting.bench.ts:47`), `src/testing/` und die Specs.
     - Klammern, die nur den Cast trugen, fallen mit (`progress ?? uniform(0)`, `color.mul(covered)`, die Bedingungsausdrücke in `sampleAtlasFrame.ts:117`/`:124`); `progress: progress` in `StageDirector.ts:2343` wird `progress`.
     - Importe: `type Node` aus dem `three/webgpu`-Import von `SpritePicker.ts` (`:13`) und `type UniformNode` aus dem von `transitionEffects.ts` (`:23`) entfallen (sonst TS6133).
     - TSDoc `AtlasFrameTable.ts:119-121` behauptet danach Falsches (»which three's TSL types do not let pass as a `Node<'vec4'>`; the cast lives here«) → `/** @internal The `vec4` at `index` of the array. */`.
     - Probe: `grep -rn "as unknown as" src --include=*.ts | grep -v "\.spec\.ts" | grep -v "src/testing/"` listet danach nur noch `typedNodes.ts:12`/`:21`, `matrixColumn.ts:13`, `FeatureSpritesMaterial.ts:100`/`:358`/`:384`, `textureShapeKey.ts:70`, `Display.ts:155`, `HelpersManager.ts:108`, `readBitmapFontSource.ts:61`, `sorting.bench.ts:47`. Reine Typänderung, das ausgelieferte JavaScript bleibt gleich: kein Test, kein CHANGELOG.
  8. **CHANGELOG** `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` → `### Fixed` (`:70ff.`), zwei Einträge im Präsens, ohne Rückblick:
     - »`VOBufferPool#usedCount`, and with it `VertexObjectPool#usedCount`, throws its `RangeError` for a value that is no number — `undefined`, `null`, a string — as it does for `NaN` and a fraction, on a disposed pool and from buffers data handed to `fromBuffersData()` or to the constructor as well; the message reads `VOBufferPool#usedCount must be a whole number, Infinity or -Infinity, got …`«
     - »`VertexObjectBuffer#copy()` from the buffer of a disposed pool names the source: `VertexObjectBuffer#copy(): the source buffer holds no typed array any more — the pool behind it has been disposed`«
- Verify: `pnpm run ci` (dazu vor dem Commit `pnpm exec biome ci --error-on-warnings .` ohne Warnung, wie seit Paket 17)
- Commit: `fix(twopoint5d): draw the noise of dissolve() without sin(), refuse a usedCount that is no number, name the source a copy() finds released, drop the TSL casts three's types carry and name every sender of the stage events`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · alle acht Nebenbefunde bestehen: `events.ts:150` und `docs/stages.md:1959` unverändert (Sender `StageMaskWorldStage.ts:85`), Transition-Events fehlen in der Tabelle `:1955-1967` · `transitionEffects.ts:298` unverändert · Casts: 4 `uniform()`-Casts (`SpritePicker.ts:328` → `:405`, sonst an ihren Zeilen), weitere TSL-Casts verschoben (`SpritePicker.ts:340` → `:417`), dazu `StageDirector.ts:2332`/`:2343`/`:2345`/`:2360`, `AtlasFrameTable.ts:123`; Probe: 32 von 34 Casts (33 Zeilen) entfallen, dazu der Einzelcast `transitionEffects.ts:484`, tsc exit 0 · `VOBufferPool.ts:139-142` unverändert · `VertexObjectBuffer.ts:441-442` unverändert · `ChunkQuadTreeNode.ts:108` unverändert · `CameraBasedVisibility.ts:352` unverändert, drei weitere Felder ohne `readonly` aufgenommen · keine offene Folge; die drei offenen Einträge in »Offene Befunde« (`DisplayFullscreen` ×2, handgesetzte Anführungszeichen) teilen keine Ursache und bleiben
  - 2026-11-01 Zug 1: Implementierer Runde 0 beauftragt (sonnet, effort medium), Report nach `<Arbeitsverzeichnis>/paket-20.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG · 19 Dateien geändert (17 in `packages/twopoint5d/`, dazu `stage-transitions.test.js`), keine neuen · rote Läufe vor dem Fix für Schritte 4 (4 Specs), 5 (1), 6 (2) im Report · Arbeitsbaum schmutzig · Verify `pnpm run ci && pnpm exec biome ci --error-on-warnings .` exit=0 (`<Arbeitsverzeichnis>/paket-20.verify.log`)
  - 2026-11-01 Zug 3: Reviewer (opus, effort medium) — alle acht Schritte erfüllt, kritisch 0, wichtig 0, klein 5 · Diff `<Arbeitsverzeichnis>/paket-20.diff`, Report `paket-20.review-0.json`
  - 2026-11-01 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-01 Zug 5: committet d36fe515 auf dem Verify-Lauf aus Zug 2 (exit=0, keine Änderung dazwischen)

## Abgleich

| Nebenbefund | Stand an 8379ebe7 | Urteil |
| --- | --- | --- |
| `OnStageDispose`-Sender (`events.ts:150`, `stages.md:1959`) | TSDoc `:150-153` und Tabellenzeile `:1959` nennen `Stage2D`/`StageRenderer`; `StageMaskWorldStage#dispose()` sendet `OnStageDispose` (`StageMaskWorldStage.ts:85`) und ist über `mask.stage` (`StageMask.ts:137`) erreichbar, obwohl die Klasse `@internal` ist | unverändert |
| Transition-Events in der Tabelle (`stages.md:1955ff.`) | Tabelle `:1955-1967` ohne `OnStageTransitionStart`/`End`, nur Prosa `:939-943` | unverändert |
| Klassen-TSDoc `ChunkQuadTreeNode.ts:108` | »has exactly four children«; Getter `nodes` `:199` sagt schon »`null` where a quadrant holds no chunk«, `subdivide()` `:239-249` beschreibt die Einachsenteilung | unverändert |
| `VOBufferPool.ts:139-142` | Bedingung `Number.isNaN(value) \|\| (Number.isFinite(value) && !Number.isInteger(value))` lässt `undefined` durch, `Math.max(0, Math.min(undefined, capacity))` ist `NaN`; Meldung »must be an integer« | unverändert |
| `VertexObjectBuffer.ts:441-442` | `other.#released ? releasedError('copy()')`, Meldung »the pool behind this buffer«; Spec `:909-916` prüft nur `/disposed/` | unverändert |
| `CameraBasedVisibility.ts:352` | `#centerPoint2D = new Vector2()` ohne `readonly`, gehalten von `#dependencyValues` `:404-405` | unverändert |
| `transitionEffects.ts:298` | `fract(sin(dot(cell, vec2(12.9898, 78.233))).mul(43758.5453))` | unverändert |
| TSL-Casts | `uniform(…) as unknown as UniformNode<'float', number>`: `UniformNode<'float'>` ist per Default-Parameter `UniformNode<'float', number>` (`@types/three@0.187.0/src/nodes/core/UniformNode.d.ts:108-111`, `:137`), der Cast ist wirkungslos. Probe über alle 34 TSL-Casts (33 Zeilen) der acht Dateien: tsc verlangt nur `FeatureSpritesMaterial.ts:358` und den inneren von `:384`; `:356` geht über `attribute<T>()`, `StageDirector.ts:2332` über eine Annotation | unverändert, verschoben (`SpritePicker.ts`) |

## Entscheidungen und Abweichungen (mit Grund)

- **Hash von `dissolve()`: Hoskins' »hash without sine«**, nicht ein Integer-Hash (PCG). Er ist im Repo erprobt (`hash21` der Masken-Demos, unter WebGPU und WebGL 2), rechnet in float, und eine Ganzzahl-Konstante über 2³¹ wie die von PCG ist für den GLSL-Zweig von TSL ein Risiko, das kein Runner sicher prüft. Bei 4K liegen die Zellen unter 4096, `fract(p · 0.1031)` behält dort in f32 rund 15 Bit Nachkomma — für ein Schaltmuster reicht das.
- **`cellHash()` exportiert, aber intern** (`@internal`, nicht in `public-api.ts`), damit der Spec ihn über `evaluateNode()` prüfen kann — wie `switched()` daneben. Keine neue öffentliche API; das Lookbook behält seine eigene Kopie.
- **Kein CHANGELOG für `dissolve()`**, gegen den Ziel-Wortlaut im Plan (»CHANGELOG: Muster ändert sich«): `dissolve()` steht nur unter `## [Unreleased]` (`CHANGELOG.md:34`, schon an d9b648bf dort), ein veröffentlichtes Muster gibt es nicht. Der Nebenbefund nahm einen veröffentlichten Effekt an; Ziel im Plan entsprechend angepasst.
- **Vorschaubilder des Lookbooks bleiben** (Galerie und Game-Menu zeigen `dissolve()`): sie werden außerhalb des Gates erzeugt, und der Check der Vorschaubilder prüft Vorhandensein und Größe, nicht den Inhalt — wie in Paket 12 entschieden.
- **Meldung des `usedCount`-Setters**: Subjekt `VOBufferPool#usedCount` bleibt (Spec und Aufrufer kennen es), nur »an integer« → »a whole number, Infinity or -Infinity«; `RangeError` auch für Nicht-Zahlen wie bei `assertWholeNumber()`. Ein Helfer passt nicht, weil der Setter ±Infinity klemmt (so schon im Zug 0 von Paket 16 festgestellt).
- **Konstruktor und `fromBuffersData()` bekommen keine eigene Prüfung** von `buffersData.usedCount`: beide schreiben über den Setter, der jetzt wirft, bevor sich etwas am Pool ändert (`fromBuffersData()` prüft vorher nur die Arrays). Ein eigener Name `buffersData.usedCount` in der Meldung wäre eine zweite Wortlaut-Familie für denselben Wert.
- **Drei weitere `readonly`-Felder in `CameraBasedVisibility`** (`#matrixWorldInverse`, `#tileBoxMatrix`, `#tileBoxOffset`) mit aufgenommen: dieselbe Auslassung wie bei `#centerPoint2D` — in place beschriebene Felder ohne `readonly`, die einzigen der Klasse; Paket 11b hat seine drei Felder aus demselben Grund `readonly` gemacht. Kosten: drei Schlüsselwörter.
- **Tabellenzeile für die Masken-Stage** nennt sie als »the stage `StageMask.inWorldOf()` builds«, nicht beim Klassennamen: `StageMaskWorldStage` ist `@internal`, Nutzer erreichen sie als `mask.stage`.
- **Browser-Test für `dissolve()`** ist eine Abdeckung, kein roter Vorher-Lauf: die Streifen zeigen sich nur auf manchen GPUs. Der rote Lauf liegt in den Vitest-Specs (`sin`-Knoten im Graph).

## Nicht dazu

- `src/vertex-objects/VertexObjectBuffer.ts:182-183` und `:401-402` (TSDoc »no integer of 0 or more« neben Meldungen »a whole number of 0 or more«): Wortwahl eines TSDoc, keine falsche Aussage; nicht Teil der Nebenbefunde.
- Einfache `as SpriteUniformNode`-Casts in `SpriteResources.ts:80-87`: Aufwärts-Casts, die tsc prüft und die die Typprüfung nicht abschalten — nicht die Ursache des Nebenbefunds.
- Die drei offenen Einträge in »Offene Befunde« (`DisplayFullscreen.ts` `onLandscape` neben fremdem Fullscreen, `#declined` nur für den eigenen, handgesetzte Anführungszeichen `→ Rückfrage`): andere Ursache, bleiben.

## Findings im Volltext

Kein Audit-Finding; die acht Nebenbefunde aus »Offene Befunde« im Wortlaut des Plans:

**Nebenbefund · low · `packages/twopoint5d/src/events.ts:150` (TSDoc `OnStageDispose`) und `packages/twopoint5d/docs/stages.md:1959` (Tabelle »Events«)** — nennen als Sender nur `Stage2D` und `StageRenderer`; `StageMaskWorldStage` sendet es ebenfalls (`src/stage/StageMaskWorldStage.ts:85`); vorbestehend (an d9b648bf `events.ts:144`) · aus Paket 10 (Runde 0)

**Nebenbefund · info · `packages/twopoint5d/docs/stages.md:1955ff.` (Tabelle »Events«)** — `OnStageTransitionStart`/`OnStageTransitionEnd` fehlen in der Tabelle, sie stehen nur in Prosa bei `:939`; vorbestehend · aus Paket 10 (Runde 0)

**Nebenbefund · info · `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:108` (Klassen-TSDoc)** — sagt »has exactly four children«, ein Quadrant ohne Chunk ist aber `null` (und nach einer Einachsenteilung sind es zwei); vorbestehend (an d9b648bf derselbe Satz, `null`-Quadranten schon dort) · aus Paket 11 (Runde 0)

**Nebenbefund · low · `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:139-142` (Setter `usedCount`)** — lässt `undefined` und andere Nicht-Zahlen durch (`Number.isNaN(undefined)` und `Number.isFinite(undefined)` sind `false`), `#usedCount` wird `NaN` gegen das TSDoc `:124-128`, das einen `RangeError` verspricht; dazu lautet die Meldung »must be an integer« statt »a whole number«; vorbestehend (an d9b648bf `:142`) · aus Paket 11 (Runde 0)

**Nebenbefund · low · `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:441-442` (`copy()`)** — ist die Quelle `other` losgelassen, wirft die Methode `releasedError('copy()')`, dessen Meldung von »the pool behind this buffer« spricht, gemeint ist aber die Quelle; `VertexObjectBuffer.spec.ts:909` prüft nur `/disposed/`; vorbestehend (an d9b648bf `:441`) · aus Paket 11 (Runde 0)

**Nebenbefund · info · `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:352` (`#centerPoint2D`)** — nicht `readonly`, obwohl `#dependencyValues` (`:405`) das Objekt festhält; ein neu zugewiesenes Feld ließe das Cache-Gate am alten Objekt, heute weist niemand neu zu (fehlende Typgarantie); vorbestehend (an b91ab441 und d9b648bf ohne `readonly`) · aus Paket 11b (Runde 0)

**Nebenbefund · low · `packages/twopoint5d/src/stage/transitionEffects.ts:298` (`dissolve()`)** — Rauschen je Zelle über den Sinus-Hash `fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453)` mit `cell = floor(uv * resolution / scale)`: bei 4K und `scale` 1 laufen die Argumente bis ~2,2·10⁵ rad — genau der Fall, für den `hash21` im Lookbook (`stage-masks/FoundFootage.ts:327-335`) diagonale Streifen auf manchen GPUs beschreibt; die Library hat keinen Hash ohne `sin()`, eine Änderung verschiebt das Muster eines veröffentlichten Effekts (CHANGELOG) (nach Lesen des Codes, nicht ausgeführt); vorbestehend (an d9b648bf `:296`) · aus Paket 12 (Zug 0)

**Nebenbefund · info · `packages/twopoint5d/src/sprites/SpritePicker.ts:328`, `src/stage/StageMask.ts:148`, `src/stage/transitionEffects.ts:480`, `src/stage/StageDirector.ts:2338`** — `uniform(…) as unknown as UniformNode<'float', number>` ist unter @types/three 0.187 wirkungslos (`uniform(number)` liefert `UniformNode<"float">`, `UniformNode.d.ts:136-155`) und schaltet die Typprüfung dort ab; daneben weitere `as unknown as Node<…>` um TSL-Knoten (`texture/sampleFrameAt.ts:68-95`, `texture/sampleAtlasFrame.ts:114-130`, `sprites/FeatureSprites/FeatureSpritesMaterial.ts:356-384`, `stage/StageDirector.ts:2304`/`:2320`, `stage/transitionEffects.ts:487`, `sprites/SpritePicker.ts:340`), einzeln nicht geprüft, ob 0.187 sie trägt; vorbestehend (an d9b648bf `StageMask.ts:148`, `SpritePicker.ts:321`, `transitionEffects.ts:478`, `StageDirector.ts:1840`) · aus Paket 12 (Zug 0)

## Urteil des Reviewers

| Schritt | Urteil | Fundstelle (an d36fe515) |
| --- | --- | --- |
| 1 Sender der Stage-Events | behoben | `src/events.ts:150-152`; `docs/stages.md:1959`, `:1960` (Anker `#the-transition` → `:905`) |
| 2 `ChunkQuadTreeNode` TSDoc | behoben | `src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:108-110` |
| 3 `readonly` (vier Felder) | behoben | `src/map2d/CameraBasedVisibility.ts:352`, `:359`, `:363`, `:369` |
| 4 `usedCount` | behoben | `src/vertex-objects/VOBufferPool.ts:126-128`, `:139-142`; `VertexObjectPool.spec.ts:696`, `:712`, `:732`, `:746` |
| 5 `copy()` nennt die Quelle | behoben | `src/vertex-objects/VertexObjectBuffer.ts:110-116`, `:450`; Spec `:916` |
| 6 `dissolve()` ohne `sin()` | behoben | `src/stage/transitionEffects.ts:289-298`, `:309`; Specs `transitionEffects.spec.ts:62`, `:68`; Browser `stage-transitions.test.js:143` |
| 7 TSL-Casts | behoben | `StageDirector.ts:2332`; `FeatureSpritesMaterial.ts:356`, `:358-359`, `:384-385`; `AtlasFrameTable.ts:118`; `transitionEffects.ts:491`, `:495` |
| 8 CHANGELOG | behoben | `CHANGELOG.md:92`, `:93` |

Kleine Befunde (lösen keine Runde aus):

- `VertexObjectPool.spec.ts:732-743`: die Prüfung »Buffer-Werte unverändert« greift nicht — die Daten stammen per `toBuffersData({copy: true})` aus demselben Pool; veränderte Werte in `buffersData` würden sie scharf machen. Rot vor dem Fix lieferte nur `usedCount` (`NaN`).
- `VertexObjectPool.spec.ts:746-750`: der Konstruktor-Test prüft nur die Klasse `RangeError`, nicht die Meldung.
- `transitionEffects.ts:503`: der geprüfte Upcast `progress: p as Node<'float'>` bleibt, obwohl derselbe Wert bei `:495` ohne Cast durchgeht; stand nicht auf der Planliste.
- `VOBufferPool.ts:127-128`: drei Gedankenstriche in einem TSDoc-Satz (planwörtlich), liest sich holprig.
- Commit-Message nennt `readonly` und das `ChunkQuadTreeNode`-TSDoc nicht; für eine Sammel-Message vertretbar.
