# Paket 6 — SpritePicker: Pick-Pfad und Tests gegen den echten Renderer

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-005 (low), RES-005 (low), ASYNC-003 (low), BUG-015 (low), BUG-016 (low), TEST-007 (low), TEST-008 (low), TEST-009 (low), TEST-010 (low)
- Ziel: `pick()` ist gegen gleichzeitige Änderungen, Growth und unsichtbare Materialien robust, nutzt keine three-Interna, und Spec wie Browsertest prüfen Ressourcenfreigabe mit einem Fixture, das Teardown-Fehler meldet.
- Modell: stärkste Stufe
- Effort: high
- Dateien (Pfade relativ zum Repo-Root):
  - `packages/twopoint5d/src/sprites/SpritePicker.ts` samt `SpritePicker.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts` (zwei interne Member, ein privates Feld) samt `VertexObjectPool.spec.ts`
  - neu `packages/twopoint5d/src/testing/threeInternals.ts` samt neuer Spec `threeInternals.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts` (nur der Helfer `inCoordinateSystem()`, `:132–147`)
  - `packages/twopoint5d-testing/test/sprites-picking.test.js`, `packages/twopoint5d-testing/test/helpers/fixtures.js`
  - Doku: `packages/twopoint5d/docs/sprites.md` (Abschnitt »Picking: which sprite is under the pointer« `:1708–1772`, »Performance« `:2714–2716`), `packages/twopoint5d/docs/resource-lifecycle.md` (`:99–107`), `packages/twopoint5d/docs/proposals/gpu-picking.md` (Kopf `:3–13`, §3.2 `:132–143`, §3.3 `:170–176`, §4 `:214–230`, §5 `:243–253`, §6 `:255–278` soweit betroffen), `packages/twopoint5d/CHANGELOG.md` (der `SpritePicker`-Eintrag unter `[Unreleased]` → `### Added`, `:46`)
- Vorgehen: siehe Abschnitt »Vorgehen« unten, Schritte 1–10 in dieser Reihenfolge. Jeder Bugfix-Schritt beginnt mit dem Regressionstest und dessen rotem Lauf.
- Verify: `pnpm run ci`
  - zum Iterieren: `pnpm nx test twopoint5d -- src/sprites/SpritePicker.spec.ts` · `pnpm nx test twopoint5d -- src/vertex-objects/VertexObjectPool.spec.ts` · `pnpm nx typecheck twopoint5d` · `pnpm build:twopoint5d && pnpm typecheck` (Browsertests und `ts check`-Blöcke laufen gegen die gebaute Bibliothek) · `pnpm build:twopoint5d && pnpm test:browser`
- Commit: `fix(sprites): take the pointer and the list of a pick at the call, leave out a mesh whose material is not visible, turn the projection of a pick to a reversed depth buffer itself and leave the depth convention of the caller's camera alone, let the pick mesh go with the geometry a growth disposes, copy the handles of a pick without building a vertex object, and have the browser tests check what the picker releases and report a display whose dispose() throws in the teardown`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · Abgleich: alle neun bestehen, unverändert an ihren Fundstellen; RES-005 auf der `FeatureSprites`-Seite nach `FeatureSprites.ts:370`/`:373` gewandert (Audit 336) · Folgen der Pakete 1–5: keine offen · Offene Befunde: vier Einträge, keiner mit der Ursache dieses Pakets — bleiben liegen · aufgenommen, gleiche Ursache wie TEST-008: `src/map2d/CameraBasedVisibility.spec.ts:143` schreibt `_reversedDepth` · Restplan: Paket 8 hängt zusätzlich von Paket 6 ab (Zähler `slotMoves` im Sortierpfad des Pools), sonst keine Änderung
  - 2026-10-22 Zug 1: Implementierer beauftragt, Modell opus (stärkste Stufe), Effort high, Session `cedc8d36-p6-impl-0`, Report `paket-6.impl-0.json`
  - 2026-10-22 Zug 2: Report `FERTIG_MIT_VORBEHALT` (Heap-Test wartet >10 Frames + einen Render, weil three die Geometry in der RenderList der Pick-Szene hält) · 11 Dateien geändert, 2 neu (`src/testing/threeInternals.ts`, `threeInternals.spec.ts`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-6.verify.log`)
  - 2026-10-22 Zug 3: Reviewer beauftragt, Modell opus, Effort high, Diff `paket-6.diff`, Report `paket-6.review-0.json`
  - 2026-10-22 Zug 3 Urteil: alle neun Findings behoben · wichtig: Heap-Test weicht vom Detailplan ab (three's RenderList hält die Geometry) — vom Runner angenommen, siehe »Anmerkungen des Reviewers« · klein: Rückblick in der Commit-Message (»instead of«), `gpu-picking.md:294` §6 sagt noch, die Geometry folge den Sprites (vom Runner auf wichtig gehoben: Doku, die nach dem Umbau nicht mehr stimmt), Zeilenumbruch `gpu-picking.md:149`/`:296` und `resource-lifecycle.md:107`, vorbestehender `RangeError`-Pfad in `#gather()` → Offene Befunde
  - 2026-10-22 Zug 4 Runde 1: offen `gpu-picking.md:294` (wichtig) und die drei Umbrüche (klein) → derselbe Implementierer per `--resume 719fd628-2659-4f62-890e-6346baf43cf7`, Report `paket-6.impl-1.json`
  - 2026-10-22 Zug 4 Runde 1 zurück: `FERTIG`, nur `gpu-picking.md` (§3.2, §6) und `resource-lifecycle.md` geändert · Verify `pnpm run ci` exit=0 (`paket-6.verify-1.log`) · Diff `paket-6.r1.diff` · Reviewer gezielt per Resume, Report `paket-6.review-1.json`
  - 2026-10-22 Zug 4 Runde 1 Urteil: alle vier Punkte erledigt, keine neuen Befunde, Freigabe
  - 2026-10-22 Zug 5: Commit `5b7f68ce` mit Trailer `Remediation-Run: 2026-10-21`, getragen von `paket-6.verify-1.log` (exit=0, jünger als die letzte Änderung) · Plan auf `[x]`, Nebenbefund `RangeError`-Pfad in »Offene Befunde«

## Abgleich

Alle Zeilen gegen `0d04dce6` (HEAD bei Zug 0). Pfade unter `packages/twopoint5d/`, wo nicht anders angegeben.

| Finding | Fundstelle jetzt | Urteil |
| --- | --- | --- |
| PERF-005 | `src/sprites/SpritePicker.ts:239` `for (let i = 0; i < n; i++) handles[i] = pool.getVO(i);` in `#handlesOf()` (`:236–241`), aufgerufen aus `#gather()` `:229` | unverändert |
| RES-005 | `SpritePicker.ts:270` `mesh.geometry = sprites.geometry!;` nur in `#sync()`; Growth in `src/sprites/FeatureSprites/FeatureSprites.ts:370` `this.geometry = grown;` und `:373` `old.dispose();` | unverändert; die `FeatureSprites`-Seite ist durch Paket 5 von `:336` nach `:370`/`:373` gewandert. Nachgesehen in three 0.186.1: `RenderObject.js:155` merkt sich `object.geometry`, `:514` `setGeometry()` tauscht sie erst beim nächsten Zeichnen des Pick-Meshes, `onGeometryDispose` (`:336–343`) leert nur `attributes` |
| ASYNC-003 | `SpritePicker.ts:190` `if (!this.renderer.initialized) await this.renderer.init();`, danach `:194` `const drawn = this.#gather(list);` und `:197` `this.#aim(camera, pointer);` | unverändert |
| BUG-015 | `SpritePicker.ts:219` `if (pool === undefined \|\| pool.usedCount === 0 \|\| !isShown(sprites)) continue;`; `DRAWN_FRAGMENTS` `:47–56` ohne `visible` | unverändert |
| BUG-016 | `SpritePicker.ts:329–333` `(camera as unknown as {_reversedDepth: boolean})._reversedDepth = true;` (`:331`) | unverändert |
| TEST-007 | `packages/twopoint5d-testing/test/sprites-picking.test.js:64–73` — `picker?.dispose()` im `afterEach` ohne Erwartung; `SpritePicker.spec.ts:699–720` prüft `targetDispose`/`materialDispose` nur auf Spies | unverändert |
| TEST-008 | `SpritePicker.spec.ts:144` (`_reversedDepth` im Fake-Renderer), `:560` (`scope === 'instance'`), `:561` und `:610` (`isUniformNode`) | unverändert; dazu `src/map2d/CameraBasedVisibility.spec.ts:143`, dieselbe Ursache |
| TEST-009 | `packages/twopoint5d-testing/test/helpers/fixtures.js:88–95` `} catch { // ignore — the fixture still has to leave the dom` | unverändert; 51 Testdateien rufen `disposeDisplay()` |
| TEST-010 | `sprites-picking.test.js:215–235` und `:239–274` — `const info = console.info; console.info = () => {}; try { … } finally { console.info = info; }` | unverändert |

## Triage

- **Folgen der Pakete 1–5:** alle `Folgen:`-Zeilen lauten »keine«. Nichts zu verteilen.
- **Offene Befunde** — keiner hat die Ursache dieses Pakets, alle bleiben liegen:
  - `extractSnippets.mjs:11` Fence-Einrückung — Doc-Snippet-Check, nicht der Picker.
  - `CHANGELOG.md:71` Rückblick im Eintrag `Display#pixelZoom` — dieses Paket ändert einen anderen Eintrag desselben Abschnitts; andere Ursache.
  - `AdaptiveResolution.ts:346–353` Zähler in `#takeOverScale()` — Display.
  - `VertexObjectPool.ts:450` `NaN`-Zeile im `@throws` von `sortBy()` — dieses Paket ändert dieselbe Datei, aber die Ursache ist eine falsch platzierte TSDoc-Zeile, nicht der Pick-Pfad. Nicht mitnehmen.
- **Aufgenommen, gleiche Ursache wie TEST-008:** `src/map2d/CameraBasedVisibility.spec.ts:143` schreibt `_reversedDepth` im Spec-Helfer `inCoordinateSystem()` — dieselbe Abhängigkeit von einem privaten three-Feld, die TEST-008 in einem Helfer unter `src/testing/` bündeln will. Bliebe die Stelle, gäbe es nach dem Paket zwei Orte, die bei einem three-Bump zu prüfen sind. Vorbestehend (steht so in `0d04dce6`), Schwere low.

## Entscheidungen dieses Pakets

- **PERF-005 — roher Snapshot, Materialisieren erst beim Treffer, abgesichert durch einen Zähler.** Der Pool bekommt eine interne Methode `copyVOsInto(into)`, die `#voIndex` ohne Prüfung und ohne Materialisierung kopiert. Ein Slot ohne Handle (gefüllt über `createFromAttributes()`) bleibt im Snapshot `undefined`; trifft der Pick genau diesen Slot, holt `resolvePixel()` den Handle über `getVO(slot)` — aber nur, wenn seit dem Zeichnen kein Slot umgezogen ist. Sonst nennte `getVO(slot)` nach einem Sort einen anderen Sprite. Dafür zählt der Pool in einem privaten Feld `#slotMoves`, sichtbar über den internen Getter `slotMoves`: es steigt in `#sortByOwnKeys()`, wenn der Sort etwas bewegt, und in `onUsedCountShrunk()` (deckt `freeVO()`, `clear()`, den `usedCount`-Setter, `resize()` nach unten und die Adoption, die die Quelle leert). `createVO()` und `createFromAttributes()` hängen hinten an und zählen nicht. `#sortByOwnKeys()` ist der gemeinsame Weg von `sortBy()` und `sortByKeys()`; der Sortierpfad, den Paket 8 für `sortByViewDepth()` baut (PERF-006), läuft ebenfalls dort durch. Ein eigener Zähler statt `#slotChanges`, weil `#slotChanges` den Wächter der Key-Funktion von `sortBy()` trägt und mit `createVO()` steigt; ein Sort, der dort zählte, meldete einen verschachtelten Sort als »created and freed«.
  - Nicht übernommen: die optionale Variante, bei unverändertem Zähler ganz auf den Snapshot zu verzichten. Der Snapshot ist das, was die Antwort über einen Sort zwischen Zeichnen und Read-back trägt (`sprites-picking.test.js:238`); ohne ihn müsste der Picker den letzten Snapshot je Pool halten und bei jedem `createVO()` verlängern. Das kostet mehr Buchführung, als die Kopie einer Referenz je Sprite spart.
  - Ein Handle-loser Sprite nach einer Growth (`spritePool` ist ein anderer Pool) oder nach einem Sort/Free zwischen Zeichnen und Read-back antwortet `undefined`. Ein `onCreateVO`-Hook, der beim Materialisieren wirft, lässt den Pick mit diesem Fehler scheitern — der Vertrag von `getVO()`.
- **RES-005 — Listener auf der Geometry, Eintrag freigeben; Abweichung von der Empfehlung.** Die Empfehlung (Event `geometrychange` auf `FeatureSprites`, darauf die Geometry des Pick-Meshes umhängen; oder im `finally` lösen) reicht nicht: das `RenderObject` des Pick-Materials hält die alte Geometry selbst (`RenderObject.js:155`), und `setGeometry()` (`:514`) läuft erst, wenn three den Pick-Mesh wieder zeichnet. Freigegeben wird es nur über das `dispose`-Event des Meshes oder des Materials. Darum hört der Picker zusätzlich auf das `dispose`-Event der Geometry, auf der er den Pick-Mesh gebaut hat, und gibt dann den ganzen Eintrag frei (`#release()`: Mesh-`dispose()` → three verwirft das `RenderObject`; Material-`dispose()`). Der nächste Pick baut beides auf der neuen Geometry. Eine Geometry, die der Caller in den Slot setzt, ohne die alte zu disposen, behandelt `#sync()` genauso: neuer Eintrag. Damit entfällt das Umhängen `mesh.geometry = sprites.geometry!` ganz, und `FeatureSprites` bekommt kein neues öffentliches Event — Paket 8 baut dort parallel an Sortierung und Texturwechsel. Kosten: ein Neubau des Pick-Materials nach einer Growth; eine Growth verdoppelt die Kapazität und ist selten. Reihenfolge beim `dispose()` der Sprites: `FeatureSprites.ts:632` feuert das `dispose`-Event des Meshes (`super.dispose()`) vor `#builtGeometry?.dispose()` (`:649`) — wer zuerst kommt, nimmt in `#release()` beide Listener ab.
- **ASYNC-003 — immer kopieren, wie empfohlen.** `pick()` kopiert Pointer und Liste nach `checkArguments()`, nicht nur auf dem Init-Pfad: so ist die geprüfte Liste die gezeichnete. Die Allokationszeile in `docs/sprites.md:2714–2716` nennt die Kopie.
- **BUG-015 — keine Opt-in-Option für unsichtbare Hit-Areas.** Der Pick zeigt, was three zeichnet; three überspringt ein Material mit `visible === false`. Eine Option wäre öffentliche API ohne Aufrufer. TSDoc und Guide sagen, dass ein solcher Mesh ausgelassen wird.
- **BUG-016 — beide Varianten der Empfehlung.** Die Projektion des Picks wird selbst auf Reversed-Z umgerechnet, statt `_reversedDepth` auf die Kamera des Callers zu schreiben; dazu ein Browsertest unter `reversedDepthBuffer: true`, damit ein three-Bump, der die Konvention ändert, sichtbar bricht. Hergeleitet aus three 0.186.1 `Matrix4#makePerspective()` (`:1140–1185`) und `#makeOrthographic()` (`:1200–1240`): die Reversed-Projektion ist in beiden Koordinatensystemen die normale mit umgedrehter Tiefenzeile, `z' = w − z` unter WebGPU (Tiefe 0 … 1), `z' = (w − z) / 2` unter WebGL (−1 … 1). Für Perspektive und Orthografie nachgerechnet; die Konstanten stehen in Schritt 5. Die Vorbereitung des **Koordinatensystems** bleibt: `coordinateSystem` ist ein öffentliches Feld, und three setzt es beim nächsten `render()` genauso. Wie three (`Renderer.js:3617`) wird nur in eine Richtung umgerechnet: Reversed-Renderer und nicht reversed Kamera.
- **TEST-007 — `renderer.info.memory` im Browsertest, Heap-Probe bei RES-005.** Der Test mit 50 Picks zählt über `info.memory`, das alle drei Browser haben; der Heap-Teil (Chromium mit `gc`) prüft per `WeakRef`, dass die durch die Growth ersetzte Geometry frei wird. Ein `WeakRef` sagt genauer als ein Schwellwert auf `usedJSHeapSize`, ob genau dieses Objekt noch gehalten wird.
- **TEST-008 — neue Datei `src/testing/threeInternals.ts`.** Sie trägt `setReversedDepth()` (Kamera-Interna) und `pickOutputOf()` (Graphstruktur des Pick-Outputs) mit dem three-Stand, gegen den beide geprüft sind. Eine eigene Spec `threeInternals.spec.ts` schlägt fehl, sobald ein three-Bump eines davon verschiebt — die »Markierung, bei welchem three-Bump sie zu prüfen sind«, als Test statt nur als Kommentar. `spriteGraph.ts` bleibt, wie es ist; `pickOutputOf()` nutzt dessen `nodesOf()`.
- **TEST-009 — ein Root-Hook in `fixtures.js`, keine Änderung an den 51 Aufrufern.** `disposeDisplay()` sammelt den Fehler; ein `afterEach` auf oberster Ebene von `fixtures.js` registriert sich in jeder Testdatei, die das Modul importiert, am Root-Suite und läuft nach den `afterEach`-Hooks der Datei, also nach dem DOM-Aufräumen. War der Test grün, wirft er; war er rot, schreibt er den Fehler per `console.error` ins Log, ohne den ursprünglichen zu verdecken. Ein fehlschlagender Root-Hook lässt Mocha die restlichen Tests der Datei überspringen — hingenommen: der Lauf ist rot und nennt den Grund. Kein Test der Suite erwartet ein werfendes `Display#dispose()` (gesucht nach `dispose()).to.throw` und werfenden Stubs; `display-constructor.test.js:12–21` gibt seinem Stub ein leeres `dispose()`).
- **TEST-010 — `withSilencedInfo(body)` in `fixtures.js`, asynchron.** Die beiden Tests in `sprites-picking.test.js` und die neuen Growth-Tests dieses Pakets nutzen ihn. `sprites-grow.test.js:57–62` schaltet `console.info` für eine ganze Suite in `beforeEach`/`afterEach` ab, in der jeder Test wächst — ein anderes Muster, bleibt.
- **CHANGELOG — der `Added`-Eintrag wird ergänzt, keine `Fixed`-Zeilen.** `SpritePicker` steht unter `[Unreleased]` → `### Added` (`CHANGELOG.md:46`) und ist nie veröffentlicht worden (letzter Tag `v0.23.0`). Keep a Changelog führt Korrekturen an einem unveröffentlichten Feature in dessen Eintrag. Nichts davon ist ein Breaking Change gegenüber `0.23.0`.
- **Proposal `gpu-picking.md` mitziehen.** Status »implemented«, Abweichungen im Kopf; Paket 5 hat `pool-sorting.md` und `growing-capacity.md` im selben Zustand nachgeführt. Die Abweichung zur Reversed-Tiefe im Kopf (`:10–12`) und die Absätze, die heute `getVO()` je Slot, das Umhängen der Geometry und die Kamera-Vorbereitung beschreiben, sagen danach, was gilt.
- **Modell stärkste Stufe, Effort high.** Neun Findings über drei Testflächen (Vitest, Browser unter WebGPU/WebGL 2/Firefox, Heap), dazu ein Eingriff in den Kern-Pool und ein Fixture, das alle 51 Browsertest-Dateien betrifft. Zwei Schritte verlangen Messungen gegen den echten Renderer, deren Zahlen erst im Browser feststehen (Schritt 7, Schritt 8).

## Vorgehen

Vor der ersten Änderung `AGENTS.md` im Repo-Root lesen, für den CHANGELOG den Skill `updating-changelog`. Bibliothekspfade relativ zu `packages/twopoint5d/`, Browsertest-Pfade relativ zu `packages/twopoint5d-testing/`. Die Browsertests laufen gegen die gebaute Bibliothek: nach jeder Änderung unter `src/` zuerst `pnpm build:twopoint5d`.

Für jeden Kommentar und jede Doku-Zeile gilt »kein Rückblick«: der Text nennt die Regel, die gilt, nicht was vorher war.

### Schritt 1 — TEST-008: three-Interna der Specs an einer Stelle

1. Neu `src/testing/threeInternals.ts`. Dateikommentar oben, sinngemäß: »The places where the specs reach past the typed API of three.js, each checked against three 0.186.1. Check them again with every bump of `three` in the catalog of `pnpm-workspace.yaml`; `threeInternals.spec.ts` fails when one has moved.«
   - `export function setReversedDepth(camera: Camera, reversedDepth: boolean): void` — schreibt `(camera as unknown as {_reversedDepth: boolean})._reversedDepth = reversedDepth;`. Kommentar: `Camera#reversedDepth` ist in three ein Getter über `_reversedDepth`, das `Renderer#_updateCamera()` (`src/renderers/common/Renderer.js`) vor dem Zeichnen schreibt; ein Spec, der den Renderer spielt oder eine von three vorbereitete Kamera braucht, schreibt es hier und nirgends sonst.
   - `export function pickOutputOf(outputNode: Node): {readsInstanceIndex: boolean; meshNumber: {value: number} | undefined}` — über `nodesOf(outputNode)` aus `./spriteGraph.js`: `readsInstanceIndex` ist wahr, wenn ein Knoten `instanceof IndexNode` mit `scope === IndexNode.INSTANCE` ist (beide in `@types/three` typisiert, `IndexNode` aus `three/webgpu`); `meshNumber` ist der erste Knoten mit `isUniformNode === true`. Kommentar: der Pick schreibt `vec4(instanceIndex + 1, meshNumber, 0, 1)` als `outputNode`; die Struktur — `instanceIndex` als `IndexNode` im Graph, die Mesh-Nummer als einziger `UniformNode` — ist die von three 0.186.1. Findet `instanceof IndexNode` den Knoten nicht (Proxy der TSL-Knoten), die heutige Prüfung `(node as {scope?: string}).scope === 'instance'` übernehmen und das im Report sagen.
2. Neu `src/testing/threeInternals.spec.ts`:
   - `setReversedDepth() is what Camera#reversedDepth reads, and updateProjectionMatrix() builds the reversed projection from it` — `PerspectiveCamera(60, 1, 0.1, 100)` und `OrthographicCamera(-4, 4, 4, -4, 0.1, 100)`, je `coordinateSystem = WebGPUCoordinateSystem`; nach `setReversedDepth(camera, true)` ist `camera.reversedDepth` `true`; nach `camera.updateProjectionMatrix()` gilt für die Perspektive `elements[10] ≈ near / (far − near)` und `elements[14] ≈ far · near / (far − near)`, für die Orthografie `elements[10] ≈ 1 / (far − near)` und `elements[14] ≈ far / (far − near)` (`toBeCloseTo(…, 12)`). `setReversedDepth(camera, false)` setzt den Getter zurück.
   - `pickOutputOf() finds the instance index and the mesh number of a pick output` — `vec4(add(float(instanceIndex), 1), uniform(3), 0, 1)` ergibt `{readsInstanceIndex: true, meshNumber.value: 3}`; `vec4(1, 2, 0, 1)` ergibt `{readsInstanceIndex: false, meshNumber: undefined}`.
3. `src/sprites/SpritePicker.spec.ts`:
   - Fake-Renderer `render()` (`:143–146`): statt der Zuweisung an `_reversedDepth` `setReversedDepth(camera, true);`, der Aufruf von `updateProjectionMatrix()` bleibt. Der Kommentar über `makeRenderer()` (`:60–64`) bleibt sinngemäß.
   - `:559–564` (`is the graph of the kind …`): `const {readsInstanceIndex, meshNumber} = pickOutputOf(material.outputNode!); expect(readsInstanceIndex).toBe(true); expect(meshNumber?.value).toBe(1);`
   - `:608–611` (`numberOf` in `is kept per mesh …`): `const numberOf = (child: Object3D) => pickOutputOf((child as unknown as {material: FeatureSpritesMaterial}).material.outputNode!).meshNumber!;`
   - Import `nodesOf` entfällt, wenn ihn nichts mehr braucht; `graphSignature` bleibt.
4. `src/map2d/CameraBasedVisibility.spec.ts:143`: `setReversedDepth(camera, reversedDepth);` statt der Zuweisung; der TSDoc-Satz `:135` endet »… the renderer writes it behind the getter, and so does this helper through `setReversedDepth()`« (sinngemäß, ohne den Feldnamen zu wiederholen).
5. `pnpm nx test twopoint5d -- src/testing/threeInternals.spec.ts src/sprites/SpritePicker.spec.ts src/map2d/CameraBasedVisibility.spec.ts` grün. Kein roter Lauf nötig (Testumbau, kein Bugfix).

### Schritt 2 — TEST-009 und TEST-010: das Fixture der Browsertests

In `test/helpers/fixtures.js`:

1. `disposeDisplay(display)` (`:81–95`): der `catch` legt den Fehler in eine modulweite Liste `const teardownErrors = [];` statt ihn zu verwerfen. TSDoc neu, sinngemäß: »Teardown must not mask the failure that got it here: no display is fine, and an error `dispose()` throws is held for the hook below, which reports it once the dom is cleaned up — it fails a test that passed and logs it for one that failed. It calls `dispose()` and nothing else — a disposed display refuses `start()`, and a start in the teardown would cost a renderer init per test.«
2. Direkt darunter, auf oberster Ebene des Moduls:

   ```js
   // Registered on the root suite of every test file that imports this module, so it runs after the
   // afterEach hooks of the file's own suites — the dom is cleaned up when it throws
   afterEach(function () {
     if (teardownErrors.length === 0) return;
     const errors = teardownErrors.splice(0);
     if (this.currentTest?.state === 'failed') {
       // biome-ignore lint/suspicious/noConsole: the teardown error goes into the log beside the failure it must not mask
       console.error(`display.dispose() threw in the teardown of "${this.currentTest.fullTitle()}":`, ...errors);
       return;
     }
     throw new AggregateError(errors, `display.dispose() threw in the teardown of "${this.currentTest?.fullTitle()}"`);
   });
   ```

   Den Biome-Kommentar nur, wenn `pnpm lint` ohne ihn anschlägt. `this` ist in `checkJs` als Mocha-Kontext typisiert (`types: ["mocha"]` in `packages/twopoint5d-testing/tsconfig.json`); braucht der Typecheck einen Hinweis, `/** @this {Mocha.Context} */` über die Funktion.
3. Neu, unter `// --- containers and displays ---` oder einem eigenen Abschnitt `// --- console ---`:

   ```js
   /**
    * Runs `body` with `console.info` silenced and puts it back afterwards, also when `body` throws or
    * its promise rejects — for a test whose code notes something on the console on purpose, such as
    * the first growth of `FeatureSprites`.
    *
    * @template T
    * @param {() => T | Promise<T>} body
    * @returns {Promise<T>}
    */
   export async function withSilencedInfo(body) {
     const info = console.info;
     console.info = () => {};
     try {
       return await body();
     } finally {
       console.info = info;
     }
   }
   ```
4. `test/sprites-picking.test.js`: die Tests `:214` und `:238` laufen über `await withSilencedInfo(async () => { … })` statt des Handpaars `const info = console.info; … finally { console.info = info; }`. Import aus `./helpers/fixtures.js` ergänzen.
5. **Gegenprobe für TEST-009, nicht einchecken:** in einem beliebigen grünen Test von `sprites-picking.test.js` vorübergehend `display.dispose = () => { throw new Error('probe'); };` setzen, `pnpm build:twopoint5d && pnpm test:browser` laufen lassen — erwartet: rot mit `display.dispose() threw in the teardown of "sprites — picking …"` und `probe` im Log. Probe zurücknehmen, Ausgabe der Probe in den Report. Danach die ganze Browsersuite grün; macht der neue Hook einen bestehenden Test rot, ist das ein `dispose()`, das bisher still warf: nicht filtern, sondern mit Datei, Testname und Fehler als Nebenbefund melden und Status `FERTIG_MIT_VORBEHALT`.

### Schritt 3 — ASYNC-003: Pointer und Liste zum Zeitpunkt des Aufrufs

1. **Regressionstest zuerst**, `src/sprites/SpritePicker.spec.ts`, `describe('the renderer')`, nach `is initialized first when it is not` (`:522`):
   - `takes the pointer and the list as they are at the call, while the renderer initializes` — `state.initialized = false`; `const init = deferred<void>(); fake.init.mockImplementation(() => init.promise);` (Muster von `:748–752`); `const {sprites} = makeSprites(1); const other = makeSprites(1).sprites; const pointer = {x: 0.1, y: -0.3}; const list: FeatureSprites[] = [sprites];` → `const picked = picker.pick(makeCamera(), pointer, list);` → danach `pointer.x = 0.9; pointer.y = 0.9; list[0] = other; list.push(new Group() as unknown as FeatureSprites);` → `init.resolve(); await picked;`. Erwartet: `rendered` hat einen Eintrag, dessen einziges Kind `geometry === sprites.geometry` hat, und dessen `projection` gleich `pixel × camera.projectionMatrix` für den Pixel `(35, 11)` des 64 × 32-Puffers (Rechnung wie in `is the projection of the camera blown up …`, `:404–411`: `[w, h, cx, cy] = [64, 32, 0.109375, -0.28125]`). Rot vor dem Fix: die Projektion des Pixels unter `(0.9, 0.9)`, das Kind ist der Pick-Mesh von `other`.
2. `pick()` (`:163–186`): nach `checkArguments()` und der `#disposed`-Prüfung

   ```ts
   // taken now: a caller that reuses its pointer or its list while the renderer initializes changes
   // neither what is drawn nor what checkArguments() has seen
   const at: PickPointer = {x: pointer.x, y: pointer.y};
   const list: FeatureSprites[] = [...sprites];
   ```

   und `this.#pick(camera, at, list)` statt `this.#pick(camera, pointer, sprites)`.
3. TSDoc von `pick()`: ein Satz »The pointer and the list are taken as they are at the call; the camera is read at the draw.« (Platz: nach »Call it after the `update()` of the sprites …«).

### Schritt 4 — BUG-015: ein Mesh mit unsichtbarem Material wird ausgelassen

1. **Regressionstest zuerst**, `describe('draws nothing and answers undefined')` (`:253`):
   - `for a mesh whose material is not visible, and draws the others of the list` — `const hidden = makeSprites(1).sprites; hidden.material!.visible = false; const shown = makeSprites(1).sprites;` → `expect(await picker.pick(makeCamera(), center, [hidden])).toBeUndefined(); expect(rendered).toHaveLength(0);` → `await picker.pick(makeCamera(), center, [hidden, shown]);` → `rendered[0]!.children` hat Länge 1, dessen `geometry` ist `shown.geometry`. Rot vor dem Fix: `hidden` wird gezeichnet.
2. `#gather()` `:219`: `if (pool === undefined || pool.usedCount === 0 || !isShown(sprites) || sprites.material?.visible === false) continue;` — der Kommentar über `isShown()` (`:89`) oder an der Zeile sagt: three zeichnet weder ein Objekt, das nicht gezeigt wird, noch eines, dessen Material nicht sichtbar ist.
3. TSDoc von `pick()` (`:146–148`): »A mesh that is disposed, not visible (or under a parent that is not), whose material is not visible, or that holds no sprite is left out; …«.

### Schritt 5 — BUG-016: Reversed-Tiefe in der Projektion des Picks, nicht auf der Kamera des Callers

1. **Regressionstest zuerst**, `describe('the pixel under the pointer')`. Der Test `prepares a camera of another coordinate system or depth convention as the renderer would` (`:437–465`) wird zu `prepares the coordinate system of a camera as the renderer would, and leaves its depth convention alone`:
   - der Teil zum Koordinatensystem bleibt (`:446–449`);
   - `state.reversedDepthBuffer = true; await picker.pick(camera, center, [sprites]);` → `expect(camera.reversedDepth).toBe(false); expect(update).toHaveBeenCalledOnce();` (rot vor dem Fix: `true`, zweimal). Die Projektion `rendered[1]!.projection` ist elementweise (`toBeCloseTo(…, 12)`) gleich `pixel × reference.projectionMatrix`, wobei `const reference = camera.clone(); setReversedDepth(reference, true); reference.updateProjectionMatrix();` — three's eigene Reversed-Projektion; `pixel` die Matrix des mittleren Pixels des 64 × 32-Puffers, gerechnet wie `:407–409` (`i = 32`, `j = 16`).
   - der Teil zur `plain`-Kamera (`:458–462`) bleibt.
2. Neue Tests im selben `describe`:
   - `turns the projection to a reversed depth buffer as three builds it, perspective and orthographic, under both coordinate systems` — `test.each` über `[WebGPUCoordinateSystem, WebGLCoordinateSystem] × [PerspectiveCamera(60, 1, 0.1, 100) mit position.z = 10, OrthographicCamera(-4, 4, 4, -4, 0.1, 100) mit position.z = 10]`: `state.coordinateSystem = cs; state.reversedDepthBuffer = true;` die Kamera in `cs`, nicht reversed, `updateProjectionMatrix()`; nach dem Pick ist die Projektion elementweise gleich `pixel × reference.projectionMatrix` (Referenz wie oben, im selben `cs`), und `camera.reversedDepth` bleibt `false`. Vor dem Fix ebenfalls grün — er sichert die Umrechnung gegen three's Formel.
   - `takes the projection of a camera three has prepared for a reversed depth buffer as it is` — `setReversedDepth(camera, true); camera.updateProjectionMatrix();` vor dem Pick; danach `rendered[0]!.projection` exakt `pixel × camera.projectionMatrix`, und `updateProjectionMatrix` (Spy nach der Vorbereitung angelegt) nicht aufgerufen.
3. `SpritePicker.ts`, auf Modulebene bei den Konstanten:

   ```ts
   // three's projection for a reversed depth buffer is the plain one with its depth row turned over:
   // z' = w - z from the 0 … 1 of WebGPU, z' = (w - z) / 2 from the -1 … 1 of WebGL — the near plane
   // at 1, the far plane at 0 (three 0.186.1, Matrix4#makePerspective() and #makeOrthographic())
   // biome-ignore format: the matrix row by row
   const REVERSE_DEPTH_WEBGPU = new Matrix4().set(
     1, 0, 0, 0,
     0, 1, 0, 0,
     0, 0, -1, 1,
     0, 0, 0, 1,
   );
   // biome-ignore format: the matrix row by row
   const REVERSE_DEPTH_WEBGL = new Matrix4().set(
     1, 0, 0, 0,
     0, 1, 0, 0,
     0, 0, -0.5, 0.5,
     0, 0, 0, 1,
   );
   ```

   Import `WebGLCoordinateSystem` aus `three/webgpu`.
4. `#aim()` (`:321–361`):
   - Der Block `:323–335` wird zu: ist `camera.coordinateSystem !== renderer.coordinateSystem`, `camera.coordinateSystem = renderer.coordinateSystem;` und, wenn `hasProjectionUpdate(camera)`, `camera.updateProjectionMatrix();` — Kommentar: wie der Renderer die Kamera vor dem Zeichnen vorbereitet, was er beim nächsten `render()` ohnehin täte. Danach `camera.updateWorldMatrix(true, false);`. Kein Zugriff auf `_reversedDepth`, keine Variable `stale` mehr.
   - Nach `pick.projectionMatrix.multiplyMatrices(this.#pixel, camera.projectionMatrix);`:

     ```ts
     // three keeps the depth convention of a camera behind a getter and sets it inside render(): the
     // pick takes the projection the camera has and turns it to the reversed depth buffer itself,
     // and the caller's camera keeps its own
     if (renderer.reversedDepthBuffer && !camera.reversedDepth) {
       pick.projectionMatrix.premultiply(
         renderer.coordinateSystem === WebGLCoordinateSystem ? REVERSE_DEPTH_WEBGL : REVERSE_DEPTH_WEBGPU,
       );
     }
     ```

     Die Pixel-Matrix berührt nur die x- und y-Zeile, die Umkehr nur die z-Zeile; die Reihenfolge der beiden ist gleichgültig. `pick.projectionMatrixInverse` wird danach gebildet wie bisher.
   - Der Klassenkommentar von `PickCamera` (`:77–81`) bleibt gültig (three markiert die Pick-Kamera selbst reversed und ruft ihr leeres `updateProjectionMatrix()`); prüfen, dass er nichts über die Kamera des Callers behauptet.
5. TSDoc von `pick()`: im Satz aus Schritt 3 ergänzen: »… the camera is read at the draw: its coordinate system is set to the renderer's, as its next render would, and its depth convention is left alone — under a reversed depth buffer the pick turns its projection over itself.«
6. **Browsertest**, `test/sprites-picking.test.js`, neu nach `picks the front sprite where two overlap …` (`:103`):
   - `picks the front sprite under a reversed depth buffer, through a camera three has not drawn with and one it has` — eigener Container `makeContainer({width: 64, height: 64})` und `new Display(reversedHost, {reversedDepthBuffer: true})`, `await reversed.start()`, eigener `new SpritePicker(reversed.renderer)`; alles im `try`, im `finally` `reversedPicker?.dispose(); disposeDisplay(reversed); reversedHost.remove();`. Unter `reversed.isWebGPUBackend` erst `expect(reversed.renderer.reversedDepthBuffer, 'WebGPU takes a reversed depth buffer').to.be.true` (WebGL 2 fällt ohne `EXT_clip_control` auf normale Tiefe zurück, three 0.186.1 `WebGLBackend.js:276–287`; die Meldungen nennen den Wert). Sprites wie im ersten Test (`[-0.5, 0, 0]` hinten, `[0.5, 0, 1]` vorn). Für `makeFlatCamera()` und eine `PerspectiveCamera(50, 1, 0.1, 100)` an `(0, 0, 10)` mit `lookAt(0, 0, 0)`: Pick auf `pointerAt(camera, 0, 0)` → der vordere Sprite; `camera.reversedDepth` danach `false`; dann einmal `reversed.renderer.render(scene, camera)` mit einer `Scene`, die die Sprites hält (danach wieder `scene.remove(sprites)`), → `camera.reversedDepth` gleich `reversed.renderer.reversedDepthBuffer`; zweiter Pick → wieder der vordere Sprite. Rot vor dem Fix unter WebGPU: `camera.reversedDepth` ist nach dem ersten Pick `true`.

### Schritt 6 — PERF-005: Handle-Snapshot ohne `getVO()` und ohne Hook

1. **Regressionstests zuerst.**
   - `src/vertex-objects/VertexObjectPool.spec.ts`, neues `describe('copyVOsInto() and slotMoves, which SpritePicker reads')` am Ende:
     - `copyVOsInto() copies the vertex objects of the slots in use by slot, leaves a slot without one empty, cuts the array to usedCount and builds none` — Pool der Kapazität 4, zwei `createVO()`, dann `createFromAttributes()` für einen Slot; `onCreateVO = vi.fn()` erst danach setzen; `const into = [a, a, a, a, a]` (fünf beliebige Einträge) → `pool.copyVOsInto(into)` → `into` ist `[vo0, vo1, undefined]`, Länge 3; der Hook ist nicht aufgerufen; `pool.getVO(2)` danach materialisiert und ruft den Hook einmal (der Snapshot hat nichts vorweggenommen).
     - `copyVOsInto() leaves the array empty on a disposed pool`.
     - `slotMoves rises with a sort that moves a slot and whenever usedCount goes down, and not with a sort that moves nothing, createVO() or createFromAttributes()` — je Schritt `before = pool.slotMoves`, dann die Operation, dann die Erwartung: `sortBy()` auf schon sortierten Keys → gleich; `sortBy()`, das bewegt → `before + 1`; `sortByKeys()`, das bewegt → `+ 1`; `freeVO()` eines mittleren Slots → `+ 1`; `freeVO()` des letzten → `+ 1`; `usedCount = 1` → `+ 1`; `clear()` → `+ 1`; `createVO()` → gleich; `createFromAttributes()` → gleich; die Quelle nach `target.adoptVOs(source)` → `+ 1`.
     Rot vor dem Fix: `copyVOsInto`/`slotMoves` gibt es nicht — der Typecheck (`pnpm nx typecheck twopoint5d`) und Vitest schlagen fehl; das ist der rote Lauf dieser Tests.
   - `src/sprites/SpritePicker.spec.ts`, `describe('the answer')`:
     - `is taken from a copy of the handles, without a look-up of each slot` — `makeSprites(3)`, `const getVO = vi.spyOn(sprites.spritePool!, 'getVO');` `state.pixel = [2, 1, 0, 1];` → Antwort `{sprites, sprite: all[1], index: 1}`, `expect(getVO).not.toHaveBeenCalled()`. Rot vor dem Fix: dreimal aufgerufen.
     - `gives a sprite without a handle its handle when the pick hits it, and nothing once the slots have moved since the draw` — `const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 3}); const pool = sprites.spritePool!; pool.createFromAttributes({instancePosition: [0, 0, 0, 1, 0, 0, 2, 0, 0]});` (Attributname gegen `TexturedSpriteKind` prüfen; fehlt `instancePosition`, das Positionsattribut der Art nehmen) `const hook = vi.fn(); pool.onCreateVO = hook;` → `state.pixel = [2, 1, 0, 1]` → Antwort mit `index: 1` und `sprite === pool.getVO(1)`; `hook` genau einmal aufgerufen (rot vor dem Fix: dreimal, beim Zeichnen). Zweiter Teil: `state.readBack = pending.promise`, Pick auf Slot 0 (`[1, 1, 0, 1]`), vor dem Read-back `sprites.sortBy('x', {descending: true})` (liest die Keys aus dem Buffer, materialisiert nichts; muss `true` liefern) → `pending.resolve(…)` → `undefined`.
2. `VertexObjectPool.ts`:
   - Feld nach `#slotChanges` (`:109`):

     ```ts
     // rises when slots below usedCount change places: a sort that moves one, and usedCount going down —
     // a freeVO() moves the last vertex object into the slot it frees. SpritePicker holds the vertex
     // objects of a draw against it
     #slotMoves = 0;
     ```
   - In `onUsedCountShrunk()` (`:342–355`) `this.#slotMoves++;` neben `this.#slotChanges++;`.
   - In `#sortByOwnKeys()` (`:552–590`) `this.#slotMoves++;` unmittelbar vor `this.#permuteBuffers(order, first, last);` — nach dem frühen `return false`, also nur, wenn etwas bewegt wird.
   - Zwei interne Member, bei `getVO()`:

     ```ts
     /**
      * How often the slots in use have changed places: it rises with a sort that moves a slot and
      * whenever `usedCount` goes down — {@link freeVO} moves the last vertex object into the slot it
      * frees. {@link createVO} and `createFromAttributes()` add a slot behind the others and leave it.
      * The same value at two moments says that no slot below `usedCount` has moved between them.
      *
      * @internal
      */
     get slotMoves(): number {
       return this.#slotMoves;
     }

     /**
      * Copies the vertex objects of the slots in use into `into`, slot by slot from 0, and cuts `into`
      * to `usedCount`. A slot that holds none yet — filled through `createFromAttributes()`,
      * `fromBuffersData()` or the buffers data handed to the constructor — is `undefined` there: unlike
      * {@link getVO} it builds no vertex object and calls no hook. On a disposed pool `into` comes back
      * empty.
      *
      * @internal
      */
     copyVOsInto(into: Array<(VOType & VO) | undefined>): void {
       const n = this.isDisposed ? 0 : this.usedCount;
       const vos = this.#voIndex;
       for (let i = 0; i < n; i++) into[i] = vos[i];
       into.length = n;
     }
     ```

     `stripInternal` (Root-`tsconfig.json:49`) nimmt beide aus der `.d.ts`; `SpritePicker.ts` compiliert im selben Projekt dagegen. Nicht in `public-api.ts`, nicht in die README der Vertex-Objekte.
3. `SpritePicker.ts`:
   - `interface Drawn` (`:71–75`) bekommt `readonly pool: VertexObjectPool<object & VO>;` und `readonly slotMoves: number;` — TSDoc: der Pool, aus dem gezeichnet wurde, und sein `slotMoves` beim Zeichnen.
   - `#gather()` `:229`: `drawn[k] = {sprites, pool, slotMoves: pool.slotMoves, handles: this.#handlesOf(pool)};`
   - `#handlesOf()` (`:234–241`): `const handles = this.#spareHandles.pop() ?? []; pool.copyVOsInto(handles); return handles;`. Kommentar: die Handles jedes belegten Slots, wie sie beim Zeichnen stehen, als Kopie ohne Nachschlagen — der Read-back löst den Slot hier auf, bevor ein Sort, ein `freeSprite()` oder eine Growth ihn bewegt; ein Slot ohne Handle bleibt leer und bekommt erst einen, wenn der Pick ihn trifft. Der Typ von `handles` muss zu `copyVOsInto()` passen; notfalls `#spareHandles` als `(object & VO | undefined)[][]` führen.
   - `resolvePixel()` (`:442–451`):

     ```ts
     function resolvePixel(pixel: TypedArray, drawn: readonly Drawn[]): SpritePick | undefined {
       const slot = Math.round(pixel[0]!) - 1;
       const record = drawn[Math.round(pixel[1]!) - 1];
       // only a slot that was drawn
       if (slot < 0 || record === undefined || slot >= record.handles.length) return undefined;
       const pool = record.sprites.spritePool;
       let sprite = record.handles[slot];
       if (sprite === undefined) {
         // the slot held no handle at the draw — filled through createFromAttributes() —: it gets one
         // as getVO() gives it, as long as no sort, free or growth has moved the slots since
         if (pool !== record.pool || pool.slotMoves !== record.slotMoves) return undefined;
         sprite = pool.getVO(slot);
       }
       // a sprite freed since the draw is in the pool of its mesh no more
       if (sprite === undefined || pool?.containsVO(sprite) !== true) return undefined;
       return {sprites: record.sprites, sprite: sprite as object & VO, index: slot};
     }
     ```

     `resolvePixel()` läuft im `return` des `try` von `#pick()`, also bevor das `finally` die Handle-Arrays leert — so bleibt es.
4. TSDoc von `pick()`: nach »… a sprite freed since answers `undefined`.« ergänzen: »A sprite without a handle — written into the pool through `createFromAttributes()` — gets one when the pick hits it, as `getVO()` gives it, and answers `undefined` when a sort, a free or a growth has moved the slots since the draw.« Unter `@throws` ergänzen: »… and whatever the `onCreateVO` hook of the pool throws for such a sprite«.

### Schritt 7 — RES-005: der Pick-Mesh geht mit der Geometry, die eine Growth disposed

1. **Regressionstests zuerst**, `src/sprites/SpritePicker.spec.ts`. Der Test `the pick mesh follows the geometry, the world matrix, the layers and the render order of the sprites` (`:667–696`) wird geteilt:
   - `the pick mesh follows the world matrix, the layers and the render order of the sprites, and is kept between picks` — wie bisher, aber ohne Growth (ohne `grow: true`, ohne `createSprite()` zwischen den Picks, ohne den `console.info`-Spy); `expect(mesh).toBe(rendered[0]!.children[0])` und `mesh.geometry === sprites.geometry` bleiben.
   - `a growth lets the pick mesh and its material go with the geometry it disposes, and the next pick builds them on the new one` — `vi.spyOn(console, 'info').mockImplementation(() => {});` `makeSprites(1, {grow: true})`; Pick; `const first = rendered[0]!.children[0] as unknown as Object3D & {material: FeatureSpritesMaterial; geometry: unknown};` Spies auf `first.material.dispose` und ein Listener `meshDisposed` auf `first`s `dispose`-Event; `sprites.createSprite();` (wächst) → beide genau einmal (rot vor dem Fix: keiner). Nächster Pick: `rendered[1]!.children[0]` ist nicht `first`, seine `geometry` ist `sprites.geometry`.
   - `a geometry put into the slot gets a pick mesh of its own, and the one before goes` — `const other = new FeatureSpritesGeometry(TexturedSpriteKind, {capacity: 2}); other.instancedPool.createVO();` Pick auf den Sprites, `sprites.geometry = other;` nächster Pick → ein neuer Pick-Mesh auf `other`, das alte Pick-Material einmal disposed; danach `sprites.dispose(); other.dispose();` ohne Wurf (die Geometry gehört dem Caller). Import `FeatureSpritesGeometry` aus `./FeatureSprites/FeatureSpritesGeometry.js`.
2. `SpritePicker.ts`:
   - `interface PickEntry` (`:63–69`) bekommt `readonly geometry: FeatureSpritesGeometry;` — TSDoc: die Geometry der Sprites, auf der der Pick-Mesh gebaut ist und die er zeichnet. `onDispose` bekommt die TSDoc: gibt den Eintrag frei; hört auf die Sprites und auf diese Geometry.
   - `#sync()` (`:243–276`): die Prüfung `:248` wird zu `if (entry !== undefined && (entry.material.resources !== material.resources || entry.geometry !== sprites.geometry)) { this.#release(sprites, entry); entry = undefined; }`, Kommentar: ein getauschtes Material liest andere Uniforms und Texturen, eine in den Slot gesetzte Geometry ist eine andere zum Zeichnen — für beides wird der Pick-Mesh neu gebaut. Zeilen `:269–270` (`mesh.geometry = sprites.geometry!;` samt Kommentar) entfallen.
   - `#build()` (`:278–309`): `const geometry = sprites.geometry!;` `new Mesh(geometry, pickMaterial)`; `geometry` in den Eintrag; nach `sprites.addEventListener('dispose', entry.onDispose);` auch `geometry.addEventListener('dispose', entry.onDispose);` mit Kommentar: eine Growth disposed die Geometry, die der Pick-Mesh zeichnet; three's Render-Objekt des Pick-Meshes hielte sie samt Typed Arrays bis zum nächsten Pick dieser Sprites — Pick-Mesh und Pick-Material gehen mit ihr, der nächste Pick baut beide auf der neuen.
   - `#release()` (`:311–318`): zusätzlich `entry.geometry.removeEventListener('dispose', entry.onDispose);`. three's `dispatchEvent` iteriert über eine Kopie der Listener; ein Abmelden während des Events ist sicher.
   - Klassen-TSDoc (`:105–106`): »… and a pick material and a pick mesh per mesh it has drawn, which go when that mesh is disposed, when the geometry they draw is disposed — a growth does that —, or with {@link dispose}; the next pick of the mesh builds them anew.«
3. **Browsertest mit Heap-Probe**, `test/sprites-picking.test.js`, neu nach `picks again after a growth …` (`:238`):
   - `lets the geometry a growth replaced go, without another pick` — `it(…, async function () { … })`; `if (typeof globalThis.gc !== 'function') this.skip();` (Firefox, wie `vertex-objects-heap.test.js:59–65`). In `withSilencedInfo()`: `makeSprites(FlatKind, [[-2, 0, 0]], {capacity: 1, grow: true})`, Pick auf `pointerAt(camera, -2, 0)`; `const old = new WeakRef(sprites.geometry);` dann `sprites.createSprite();` (Growth, disposed die alte) und `sprites.update();` — keine Variable des Tests hält die alte Geometry. Dann **erst** einen Task beenden (`await new Promise((resolve) => setTimeout(resolve, 0));` — ein `WeakRef`-Ziel bleibt bis zum Ende des Tasks, in dem es angelegt oder gelesen wurde, am Leben), danach dreimal `globalThis.gc({execution: 'sync', type: 'major'});`, `await new Promise((resolve) => setTimeout(resolve, 50));`, und `expect(old.deref(), 'the geometry the growth replaced').to.be.undefined`. Rot vor dem Fix (der Pick-Mesh hält sie). Der Aufruf von `gc` wie in `vertex-objects-heap.test.js:51`; der Typecheck nimmt ihn dort an.
   - Bleibt die Geometry trotz Fix erreichbar, den Halter per Heap-Snapshot bestimmen (Chrome DevTools MCP `take_heapsnapshot` / `get_heapsnapshot_retaining_paths` gegen eine Seite mit dem Testfall, oder die Retainer im DevTools-Protokoll) und im Report nennen — den Test nicht lockern. Hält ihn etwas außerhalb des Pickers (three, die Sprites), ist das `BLOCKIERT` mit dem Halter.

### Schritt 8 — TEST-007: was der Picker gegen den echten Renderer freigibt

1. **Browsertest**, `test/sprites-picking.test.js`, nach `leaves the renderer as it found it` (`:367`):
   - `builds nothing more over 50 picks, and gives back what it built with the mesh and with dispose()` — `const memory = () => { const {textures, renderTargets, uniformBuffers, programs, geometries, attributes} = display.renderer.info.memory; return {textures, renderTargets, uniformBuffers, programs, geometries, attributes}; };` Ablauf:
     1. `const {sprites} = makeSprites(FlatKind, [[0, 0, 0]]);` — die Sprites werden nicht auf dem Schirm gezeichnet, damit ihre einzigen Render-Objekte die des Picks sind. `const colorMap = sprites.getTexture('colorMap');` (oder über die Rückgabe von `makeSprites` erweitern). `const before = memory();`
     2. Ein Pick → `const afterFirst = memory();` weitere 49 Picks → `expect(memory(), 'after 50 picks').to.deep.equal(afterFirst)`.
     3. `sprites.dispose();` → `uniformBuffers`, `geometries`, `attributes` gleich `before` (Pick-Mesh samt Render-Objekt mit dem Mesh fort, die Geometry der Sprites mit ihnen).
     4. `picker.dispose();` → `renderTargets` gleich `before`.
     5. `colorMap.dispose();` → `textures` gleich `before`.
   - Vor dem Festschreiben die Zähler einmal je Backend ablesen (WebGPU, WebGL 2, Firefox). Verhält sich ein Zähler anders als hier erwartet, weil three es so führt — etwa `programs` nach einem Material-`dispose()` im Cache —, die Erwartung an den beobachteten Wert halten und im Report begründen; nie, weil der Picker etwas hält. Rendert der `Display` zwischen den Picks selbst und verschiebt die Zähler, den Grund klären und im Report nennen.
   - **Gegenprobe, nicht einchecken:** in `SpritePicker#dispose()` `this.#target?.dispose();` vorübergehend auskommentieren → der Test wird rot (`renderTargets`); zurücknehmen, Ausgabe in den Report.
2. Der Spec-Test `releases the target and every pick material, …` (`:699–720`) bleibt.

### Schritt 9 — Doku

1. `packages/twopoint5d/docs/sprites.md`, Abschnitt »Picking: which sprite is under the pointer«:
   - »The nearest sprite wins« (`:1748–1751`): »A mesh that is disposed, not visible, whose material is not visible, or empty is left out.«
   - »Sorted and growing meshes work« (`:1754–1757`): »The price is a copy of one reference per sprite of the listed meshes per pick.« statt »one look-up per sprite«; dazu: »A sprite without a handle — written into the pool through `createFromAttributes()` — gets one when the pick hits it, and answers `undefined` when a sort, a free or a growth moved the slots before the read back.«
   - »The cost« (`:1758–1760`): »… and that copy.« statt »and that look-up«.
   - »Ownership« (`:1767–1772`): die Kamera — »The camera takes the coordinate system of the renderer, as its next render would; its depth convention stays as it is — under a reversed depth buffer the pick turns its projection over itself.« Und: »The pointer and the list are taken as they are at the call.« Und der Pick-Mesh: »… releases it when the mesh is disposed, and builds it anew after a growth or a geometry put into the slot.«
   - »Performance« (`:2714–2716`): »A pick of `SpritePicker` draws the listed meshes into one pixel and copies one handle per sprite of them; it allocates its promise, a copy of the pointer and of the list, and three's read back per call — …«.
2. `packages/twopoint5d/docs/resource-lifecycle.md:101–107`: »It listens to three's `dispose` event of each mesh and of the geometry it draws, and releases the pick mesh and the pick material then — the event of the mesh comes before the mesh releases the resources the pick material reads, and the one of the geometry comes with a growth; the next pick builds them anew.« Der Rest des Absatzes bleibt.
3. `packages/twopoint5d/docs/proposals/gpu-picking.md`:
   - Kopf, Abweichungen (`:10–12`): der Punkt zur Reversed-Tiefe wird zu: die Kamera des Pickers übernimmt das Koordinatensystem des Renderers vor jedem Pick; die Tiefenkonvention der Kamera des Callers bleibt, und unter einem Reversed-Depth-Buffer dreht der Picker die Tiefenzeile der Projektion selbst (§3.3). Neue Punkte: die Pick-Meshes gehen mit der Geometry, die sie zeichnen, und werden nach einer Growth neu gebaut (§3.2, §5); der Snapshot kopiert die Handles ohne `getVO()`, ein Slot ohne Handle bekommt ihn erst beim Treffer (§4); ein Mesh mit unsichtbarem Material wird ausgelassen (§3.2).
   - §3.2 (`:134–143`): Geometry nicht mehr »taken before every pick«, sondern beim Bau des Pick-Meshes; ausgelassen auch bei `material.visible === false`.
   - §3.3 (`:170–176`): Kamera-Vorbereitung wie in Schritt 5.
   - §4 (`:222–230`): `copyVOsInto()` statt `getVO(i)` je Slot, der Fall ohne Handle mit `slotMoves`, die Kosten »one copied reference per sprite«.
   - §5 »A mesh disposed« (`:246–248`): auch die Geometry.
   - §6 (`:255–278`): die neuen Specs knapp nachtragen, soweit der Abschnitt Specs aufzählt.
   Kein Rückblick: die Abweichungsliste nennt, was gebaut ist und worin es von der Planung abweicht — das ist ihr Zweck —, ohne »früher« oder »geändert«.
4. `packages/twopoint5d/CHANGELOG.md`, der `SpritePicker`-Eintrag unter `[Unreleased]` → `### Added` (`:46`): ergänzen, dass ein Mesh mit unsichtbarem Material ausgelassen wird, Pointer und Liste zum Zeitpunkt des Aufrufs gelten, die Kamera ihre Tiefenkonvention behält und der Pick seine Projektion für einen Reversed-Depth-Buffer selbst dreht, die Pick-Meshes mit der Geometry gehen, die eine Growth disposed, und ein Sprite ohne Handle seinen Handle erst beim Treffer bekommt. Knapp, im Stil des Eintrags. Keine neuen `Fixed`-Zeilen, kein Migration Guide.
5. TSDoc von `pick()` und der Klasse wie in den Schritten 3–7.

### Schritt 10 — Verify

`pnpm run ci` grün. Dazu im Report: die roten Läufe der Schritte 3, 4, 5, 6, 7 (Testname, Kommando, Ausgabe), die Gegenproben aus Schritt 2 und Schritt 8, die je Backend abgelesenen `info.memory`-Zahlen aus Schritt 8.

## Rückgabevertrag des Implementierers

Status (`FERTIG` | `FERTIG_MIT_VORBEHALT` | `BLOCKIERT` | `KONTEXT_FEHLT`), Dateien, Regressionstests (Name, Kommando, Ausgabe des roten Laufs je Bugfix-Schritt 3, 4, 5, 6, 7; für Schritt 6 die Ausgabe von Typecheck/Vitest gegen die fehlenden Member), Gegenproben (Schritt 2, Schritt 8), Verify, Abweichungen mit Grund, Nebenbefunde, Folgen mit Datei und Zeile — wie in Zug 2 von `runner.md` beschrieben; der Brief nennt sie.

## Findings im Volltext

**PERF-005 · low · packages/twopoint5d/src/sprites/SpritePicker.ts:239** (weitere Fundstelle `:229`) — Handle-Snapshot des Picks ohne getVO() und ohne onCreateVO aufnehmen
Jeder Pick kopiert für jeden gelisteten Mesh die Handles aller belegten Slots über `pool.getVO(i)`: O(usedCount) Aufrufe mit Integer- und Bereichsprüfung pro Pick, und pro Pick in flight ein Array dieser Länge (bei Hover jeden Frame und 1–3 Picks in flight mit 1 Mio. Sprites mehrere 8-MB-Arrays). Für einen Slot ohne Handle (`createFromAttributes()`) materialisiert `getVO()` einen Vertex-Object-Handle und ruft dabei den `onCreateVO`-Hook des Callers auf, also einen sichtbaren Seiteneffekt in einem reinen Lesepfad. Die Doku nennt die Kosten (»one look-up per sprite«), nicht aber den Hook-Aufruf.
Beleg: `for (let i = 0; i < n; i++) handles[i] = pool.getVO(i);`
Empfehlung: Dem Pool eine interne Methode geben, die `#voIndex` roh in ein Ziel-Array kopiert (ohne Prüfungen und ohne Materialisierung). Leere Slots bleiben `undefined` und werden erst in `resolvePixel()` für den einen getroffenen Slot materialisiert. Optional einen Move-Zähler des Pools (Sort, Free, Adopt) mitschreiben und bei unverändertem Zähler ganz auf den Snapshot verzichten.

**RES-005 · low · packages/twopoint5d/src/sprites/SpritePicker.ts:270** (weitere Fundstelle `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:336`) — Pick-Mesh nach einer Growth von der alten Geometry lösen
Nach `grow` disposed `FeatureSprites#grow()` die alte Geometry und hängt die neue an den eigenen Mesh und die Pass-Meshes. Das Pick-Mesh des Pickers bekommt die neue Geometry erst beim nächsten `#sync()`, also beim nächsten Pick dieses Meshes. Bis dahin halten das Pick-Mesh und das RenderObject des Pick-Materials (siehe resource-lifecycle.md §5, »holds the mesh, its geometry — disposed or not — with the typed arrays«) die disposte Geometry mit allen Typed Arrays fest. Wer nur auf Klick pickt, behält sie beliebig lange. Die Menge ist auf eine alte Geometry pro Mesh begrenzt.
Beleg: `mesh.geometry = sprites.geometry!;` läuft nur in `#sync()`
Empfehlung: Bei einer Growth ein Event auf `FeatureSprites` feuern (etwa `geometrychange`), auf das der Picker die Geometry seines Pick-Meshes umhängt. Alternativ im `finally` von `#pick()` die Geometry der gezeichneten Pick-Meshes wieder lösen. Ein Heap-Test in `twopoint5d-testing` nach dem Muster von `vertex-objects-heap.test.js` sichert das ab.

**ASYNC-003 · low · packages/twopoint5d/src/sprites/SpritePicker.ts:190** (weitere Fundstellen `:194`, `:197`) — Pointer und Liste in pick() vor dem ersten await kopieren
`pick()` prüft Kamera, Pointer und Liste synchron, `#pick()` liest Pointer und Liste aber erst nach `await this.renderer.init()`. Ist der Renderer beim ersten Pick noch nicht initialisiert und verwendet der Caller einen mutablen Pointer wieder (das übliche `const pointer = new Vector2()` aus `pointermove`) oder ein wiederverwendetes Listen-Array, dann zielt der Pick auf die Position bzw. die Liste zum Zeitpunkt nach dem Init, nicht auf die beim Aufruf. Ein inzwischen eingetragenes Nicht-`FeatureSprites` umgeht dabei `checkArguments()`. Die Bereichsprüfung `pointer.x < -1 …` und `#aim()` können außerdem verschiedene Werte sehen.
Beleg: `if (!this.renderer.initialized) await this.renderer.init(); … const drawn = this.#gather(list); … this.#aim(camera, pointer);`
Empfehlung: In `pick()` nach `checkArguments()` `{x: pointer.x, y: pointer.y}` und `[...sprites]` kopieren und nur die Kopien an `#pick()` geben. Die Allokation pro Pick ist vernachlässigbar.

**BUG-015 · low · packages/twopoint5d/src/sprites/SpritePicker.ts:219** (weitere Fundstelle `:47`) — Unsichtbares Material im Picker ausschließen
`#gather()` lässt einen Mesh nur über `Object3D.visible` der Kette (`isShown()`) aus. Ein Mesh, dessen Material per `material.visible = false` versteckt ist (das übliche three-Mittel), zeichnet auf dem Schirm nichts, wird aber gepickt, weil das Pick-Material sein eigenes `visible` hat und `DRAWN_FRAGMENTS` es nicht übernimmt. Ein Klick trifft dann einen Sprite, den niemand sieht. Die Doku verspricht »A mesh that is … not visible … is left out«.
Beleg: `if (pool === undefined || pool.usedCount === 0 || !isShown(sprites)) continue;`
Empfehlung: In `#gather()` auch `sprites.material?.visible === false` überspringen und das in der TSDoc von `pick()` und in `docs/sprites.md` nennen. Wer unsichtbare Hit-Areas will, bekommt das als bewusste Option.

**BUG-016 · low · packages/twopoint5d/src/sprites/SpritePicker.ts:331** — Reversed-Depth der Kamera nicht über das three-interne Feld setzen
`#aim()` schreibt `_reversedDepth` direkt auf die Kamera des Callers, also ein privates Feld von three hinter dem Getter `reversedDepth`. Benennt ein three-Update das Feld um oder macht den Getter berechnet, bleibt die Pick-Projektion still bei der falschen Depth-Konvention, und der Pick trifft den hintersten statt des vordersten Sprites. Der Unit-Test arbeitet mit einer Mock-Kamera und fängt das nicht ab.
Beleg: `(camera as unknown as {_reversedDepth: boolean})._reversedDepth = true;`
Empfehlung: Die Projektion für den Pick aus einer eigenen Kamera-Kopie bzw. aus `camera.projectionMatrix` mit expliziter Reversed-Z-Umrechnung bauen, statt die Kamera des Callers über Interna vorzubereiten. Sonst die Stelle mit einem Browser-Test unter `reversedDepthBuffer: true` in `sprites-picking.test.js` absichern, damit ein three-Bump sie sichtbar bricht.

**TEST-007 · low · packages/twopoint5d-testing/test/sprites-picking.test.js:56** (weitere Fundstelle `packages/twopoint5d/src/sprites/SpritePicker.spec.ts:701`) — SpritePicker gegen echten Renderer auf Ressourcen-Freigabe prüfen
Dispose und Leak-Verhalten (Target, Pick-Materialien, Pick-Meshes, dispose-Listener am Mesh) werden nur gegen einen Fake-Renderer mit vi.spyOn geprüft. Der Browsertest ruft picker.dispose() im afterEach, behauptet danach aber nichts (kein Zähler für renderer.info.memory, keine Prüfung, dass nach Mesh-Dispose das Pick-Material beim echten Renderer weg ist). Eine echte Renderer-Zuordnung (RenderObjects/Pipelines je Pick-Material) wird nur durch three selbst freigegeben, wenn dispose-Events fliegen — das testet der Fake nicht. Es fehlt außerdem ein Lauf mit vielen Picks in Folge (Pick-Material wird 'für jedes Mesh einmal' gebaut), der ein Wachsen belegen würde.
Beleg: `picker?.dispose();` im afterEach ohne Assertion; Spec-Tests prüfen `materialDispose`/`targetDispose` auf Spies
Empfehlung: Browsertest ergänzen: 50 Picks, dann Mesh-Dispose und Picker-Dispose; renderer.info.memory (textures/geometries) bzw. Anzahl Pick-Materialien vor/nach vergleichen. Alternativ ein Heap-Test im Stil von vertex-objects-heap.test.js.

**TEST-008 · low · packages/twopoint5d/src/sprites/SpritePicker.spec.ts:144** (weitere Fundstellen `:560`, `:562`) — SpritePicker-Spec von three-Interna entkoppeln
Der Fake-Renderer greift auf die private Kamera-Eigenschaft `_reversedDepth` zu und die Spec identifiziert Pick-Output-Knoten über `scope === 'instance'` und `isUniformNode` im Node-Graphen. three ist nur per Tilde (~0.186) gepinnt, aber jeder Minor-Bump kann diese Interna verschieben; die Spec bricht dann ohne Fehler im Produktcode. Die Browser-Tests decken die Funktion zwar ab, doch ein roter Unit-Test würde als Regression gelesen.
Beleg: `(camera as unknown as {_reversedDepth: boolean})._reversedDepth = true;` und `(node as unknown as {scope?: string}).scope === 'instance'`
Empfehlung: Die Interna-Zugriffe in einem Helfer unter src/testing/ bündeln (wie spriteGraph.js schon für graphSignature) und mit einem Kommentar markieren, bei welchem three-Bump sie zu prüfen sind; Graph-Struktur nur dort beobachten.

**TEST-009 · low · packages/twopoint5d-testing/test/helpers/fixtures.js:88** — Teardown-Fehler im Browsertest-Fixture nicht verschlucken
disposeDisplay() fängt jeden Fehler von display.dispose() und ignoriert ihn. Gedacht ist: ein Teardown soll den ursprünglichen Fehler nicht verdecken. Ist der Test aber grün, wird auch ein Dispose, das wegen eines echten Bugs wirft (Leak-Ursache), nie sichtbar — bei neuen Features wie AdaptiveResolution und SpritePicker verlassen sich alle Browser-Tests darauf. display-dispose.test.js prüft das Dispose gezielt, aber nur für sich.
Beleg: `} catch {\n    // ignore — the fixture still has to leave the dom`
Empfehlung: Fehler sammeln und im afterEach nach dem DOM-Aufräumen erneut werfen, wenn der Test sonst grün war; oder console.error ausgeben, damit der CI-Log den Hinweis trägt.

**TEST-010 · low · packages/twopoint5d-testing/test/sprites-picking.test.js:215** (weitere Fundstelle `:239`) — Browsertest-Dauer im Picking-Test mit console.info-Umbiegen absichern
Zwei Tests ersetzen console.info global per Handzuweisung und stellen es im finally wieder her. Wirft ein Hook oder bricht der Runner den Test ab (Timeout bei kaltem WebGPU-Start), bleibt das Muster korrekt, aber es dupliziert sich und ist ein Stilbruch zur Vitest-Seite, wo vi.spyOn mit restoreMocks diese Last trägt. Kein echter Defekt, begrenzte Wirkung.
Beleg: `const info = console.info;\n    console.info = () => {};\n    try {`
Empfehlung: In einen Helfer (withSilencedInfo(fn)) in helpers/fixtures.js ziehen.

## Anmerkungen des Reviewers

Reviewer `paket-6.review-0.json` (Runde 0) und `paket-6.review-1.json` (Nachprüfung Runde 1), Modell opus, Effort high.

### Erfüllung je Finding

| Finding | Urteil | Fundstelle (Stand `5b7f68ce`) |
| --- | --- | --- |
| PERF-005 | behoben | `src/vertex-objects/VertexObjectPool.ts:655` `copyVOsInto()`, `:642` `slotMoves`, Zähler in `onUsedCountShrunk()` und `#sortByOwnKeys()` nach dem frühen `return false`; `src/sprites/SpritePicker.ts:279` Snapshot über `copyVOsInto()`, `resolvePixel()` materialisiert nur den getroffenen Slot, abgesichert über `pool`/`slotMoves` |
| RES-005 | behoben | `SpritePicker.ts` `#build()` hört auf das `dispose`-Event der Geometry, `#release()` nimmt beide Listener ab, `#sync()` baut bei getauschter Geometry neu; Heap-Browsertest `sprites-picking.test.js` `lets the geometry a growth replaced go, without another pick` |
| ASYNC-003 | behoben | `SpritePicker.ts` `pick()` kopiert Pointer und Liste nach `checkArguments()` |
| BUG-015 | behoben | `SpritePicker.ts` `#gather()` überspringt `sprites.material?.visible === false`; TSDoc, Guide |
| BUG-016 | behoben | `#aim()` schreibt kein `_reversedDepth`; `premultiply(REVERSE_DEPTH_WEBGPU / _WEBGL)`; Konstanten vom Reviewer gegen three 0.186.1 `Matrix4.js:1140–1240` nachgerechnet; Browsertest unter `reversedDepthBuffer: true` |
| TEST-007 | behoben | `sprites-picking.test.js` `builds nothing more over 50 picks, …` über `renderer.info.memory`, Gegenprobe rot |
| TEST-008 | behoben | `src/testing/threeInternals.ts` samt Spec; `SpritePicker.spec.ts` und `CameraBasedVisibility.spec.ts` greifen nur noch darüber auf `_reversedDepth`, `IndexNode`-Scope und `isUniformNode` zu |
| TEST-009 | behoben | `packages/twopoint5d-testing/test/helpers/fixtures.js:82` `teardownErrors`, Root-`afterEach` ab `:104`; Gegenprobe rot |
| TEST-010 | behoben | `fixtures.js` `withSilencedInfo()`, genutzt von beiden Growth-Tests und dem Heap-Test |

### Befunde

- wichtig, angenommen vom Runner: Der Heap-Test weicht von Schritt 7.3 ab. Die Geometry bleibt auch mit dem Fix über three's `RenderList` der Pick-Szene erreichbar (`RenderLists._activeLists` → `renderItems[0].geometry`, three 0.186.1). Die Liste wird beim nächsten Render derselben Szene geleert, oder durch `RenderLists.update()`, wenn sie länger als zehn Frames nicht benutzt wurde. Der Test wartet deshalb, bis `renderer.info.frame` um mehr als 10 gestiegen ist, und rendert dann einmal. Begründung der Annahme: Der Halter ist bestimmt und begrenzt, eine App mit laufender Schleife gibt die Geometry nach etwa zehn Frames frei, `gpu-picking.md` §5 nennt das, und gegen den Picker aus HEAD ist der Test rot. Der Anteil des Pickers ist damit behoben.
- klein, behoben in Runde 1: `gpu-picking.md` §6 sagte noch, die Geometry folge den Sprites. Vom Runner auf wichtig gehoben, weil die Doku nach dem Umbau nicht mehr stimmte.
- klein, behoben in Runde 1: Umbrüche in `gpu-picking.md` §3.2 und §6 sowie in `resource-lifecycle.md`.
- klein, behoben vor dem Commit: In der Commit-Message stand ein Rückblick (»instead of writing to the caller's camera«).
- klein, vorbestehend: der `RangeError`-Pfad in `#gather()` steht unter »Offene Befunde« im Plan. Urteil `→ Scope`, weil die Scope-Regel jede Severity umfasst. Die Ursache ist ein fehlendes Aufräumen auf dem Fehlerpfad, nicht der Pick-Pfad dieses Pakets.
- Abweichungen des Implementierers ohne Befund: `expect(old.deref() === undefined).to.be.true` statt `.to.be.undefined`, denn Chai durchläuft beim Formatieren den Objektgraphen von three und hängt dabei. Die Meldung des `AggregateError` nennt die einzelnen Fehler, weil der Reporter `errors` nicht druckt. `instanceof IndexNode` greift, der Fallback war nicht nötig. Die `test.each`-Fälle aus Schritt 5 waren vor dem Fix rot, aber nur wegen der mitgeprüften Kameraeigenschaft.
