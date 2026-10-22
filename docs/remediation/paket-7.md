# Paket 7 — Sprite-Features: Eingaben klemmen, Ablehnungen vereinheitlichen, Shader typisieren

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-017 (low), BUG-019 (low), BUG-035 (low), CONS-001 (low), API-008 (low), TYPE-001 (low), TEST-015 (low)
- Ziel: Grid, AnimatedFrames, Segment-Ablehnung und TableFrame liefern für jede gültige Eingabe das dokumentierte Ergebnis, Ablehnungen zeigen Werte einheitlich, und Shader-Stages wie Graphtests kommen ohne doppelte Casts und three-Interna aus.
- Modell: stärkste Stufe — sieben Findings über Features, Passes, `FeatureSprites`, den Graph-Helfer in `src/testing/`, Browsertest, Lookbook und vier Docs; dazu f32/f64-Randfälle in TSL und eine Bedeutungsänderung an `frameIndex`
- Effort: medium — jede Signatur, jeder Wert und jede Meldung steht unten; die API-Änderung ist ausgeschrieben, der Blast Radius aufgezählt
- Dateien:
  - Code: `packages/twopoint5d/src/sprites/GridBase.ts`, `src/sprites/features/AnimatedFrames.ts`, neu `src/sprites/features/evenFrame.ts`, `src/sprites/features/TableFrame.ts`, `src/sprites/features/Wave.ts`, `SegmentPlacement.ts`, `FlatPlacement.ts`, `AxisBillboardPlacement.ts`, `src/sprites/passes/passFeatures.ts`, `src/sprites/FeatureSprites/FeatureSprites.ts`, neu `src/sprites/typedNodes.ts`, `src/sprites/cameraNodes.ts`, `src/sprites/FeatureSprites/FeatureSpritesMaterial.ts` (nur die Ausdrucks-Casts unten), alle Nicht-Spec-Dateien unter `src/sprites/features/` und `src/sprites/passes/` mit `as unknown as`, `src/testing/spriteGraph.ts`
  - Specs: `src/sprites/GridBase.spec.ts`, neu `src/sprites/features/evenFrame.spec.ts`, `src/testing/spriteGraph.spec.ts`, `src/sprites/passes/segment-passes.spec.ts`, die Ablehnungs-Specs von `wave()`, `segmentPlacement()`, `flatPlacement()`, `axisBillboardPlacement()` und `FeatureSprites` (`grow`), `src/sprites/features/PaletteSwap.spec.ts`, neu `src/sprites/typed-stages.spec.ts`, `src/sprites/FeatureSprites/presetGraphs.spec.ts` samt `fixtures/preset-graphs.json`
  - Browser: `packages/twopoint5d-testing/test/sprites-table-frame.test.js`
  - Lookbook: `apps/lookbook/src/demos/boomer-shooter-corridor/Stalkers.ts`, `apps/lookbook/src/pages/demos/_boomer-shooter-corridor.json`, `apps/lookbook/assets-src/README.md`
  - Docs: `packages/twopoint5d/docs/sprites.md`, `docs/proposals/table-frames-and-palette-swap.md`, `docs/proposals/pipeline-stages-and-grid-base.md`, `docs/proposals/animation-playback-and-aseprite.md`, `packages/twopoint5d/CHANGELOG.md`
- Vorgehen (Reihenfolge einhalten: Schritt 1 belegt, dass das Entfernen der Casts keinen Graphen ändert, bevor Schritt 3 einen ändert):
  1. **Casts der Shader-Stages entfernen (TYPE-001).**
     - In jeder Nicht-Spec-Datei unter `src/sprites/features/` und `src/sprites/passes/` jedes `as unknown as <NodeTyp>` streichen (heute 87, in 16 Dateien). Unter `@types/three` 0.186 typt `tsc` diese Ausdrücke selbst: in Zug 0 an einer Kopie von `src/` geprobt — nach dem Streichen aller 87 blieben genau vier echte Lücken und sieben unbenutzte `import type {Node}`, sonst kein Fehler. Eine falsche Zuweisung (`const bad: Node<'vec2'> = round(mul(insets, 3))` mit `insets: Node<'vec4'>`) fällt ohne Cast durch `tsc` (TS2322); jeder entfernte Cast schaltet also echte Prüfung ein.
     - Die vier Lücken, so geschlossen:
       - `PaletteSwap.ts:77` — `sRGBTransferOETF()` ist in `@types/three` als bloßes `Node` deklariert: `asVec3(sRGBTransferOETF(rgb))` (Helfer unten).
       - `PaletteSwap.ts:86`/`:93` — `let index = float(-1) …` wird zu `let index: Node<'float'> = float(-1);` (Annotation statt Cast; `mix()` liefert `Node<'float'>`, `float()` einen `VarNode`-Typ).
       - `RepeatingTextureColor.ts:60` — `const lookup = asTextureNode(sample('colorMap', st));` — `.value` (`:65`) und `.grad()` (`:68`) brauchen den `TextureNode`; der Ausdruck der Rückgabe braucht danach keinen Cast mehr (prüft `tsc`).
     - Die unbenutzten `import type {Node}` entfernen (`Anchor.ts`, `Fade.ts`, `Flash.ts`, `Flip.ts`, `Wave.ts`, `MirrorAtPlane.ts`, `PlanarShadow.ts`; `RepeatingTextureColor.ts` behält `Node`, wenn noch benutzt, und importiert `TextureNode` nur noch über den Helfer, falls ungenutzt).
     - Wo `tsc` nach dem Streichen an einer weiteren Stelle widerspricht: zuerst eine Annotation der Variable oder einen Rückgabetyp der Funktion (`(…): Node<'vec3'> =>`), nie einen neuen Cast. Jede exportierte Funktion einer geänderten Datei behält ihren deklarierten Typ: wo der Cast ihn bestimmt hat, tritt eine explizite Rückgabe-Annotation an seine Stelle.
     - Dieselbe Altlast außerhalb, mitnehmen: `src/sprites/cameraNodes.ts:11`, `:20` und in `src/sprites/FeatureSprites/FeatureSpritesMaterial.ts` die Ausdrucks-Casts `:66`, `:75`, `:182`, `:183`, `:210`, `:326`. **Nicht** anfassen: die Typgrenze des Shader-Kontexts (`FeatureSpritesMaterial.ts:268`, `:270`, `:277`, `:289`, `:296`) — sie macht aus einem Namen den `Node<T>`, den der Aufrufer nennt, und ist die typisierte Schicht, die das Audit verlangt —, die `Record<string, unknown>`-Casts (`:406`, `SpritePicker.ts`, `textureShapeKey.ts`) und `matrixColumn.ts:13`.
     - Neu `src/sprites/typedNodes.ts`, intern (nicht in `public-api.ts`; `node-utils.ts` ist öffentlich und scheidet deshalb aus), mit genau diesen zwei Helfern und TSDoc, das sagt, warum es sie gibt:
       ```ts
       import type {Node, TextureNode} from 'three/webgpu';

       /** A node that @types/three declares as a plain `Node` and the caller knows to be a vec3 — `sRGBTransferOETF()` of a vec3. @internal */
       export const asVec3 = (node: Node): Node<'vec3'> => node as unknown as Node<'vec3'>;

       /** The node `sample()` of a stage context answers, as the `TextureNode` it is. Throws for any other node. @internal */
       export function asTextureNode(node: Node<'vec4'>): TextureNode {
         if ((node as Partial<TextureNode>).isTextureNode !== true) {
           throw new TypeError('asTextureNode: the node is no TextureNode — sample() of a stage context answers one');
         }
         return node as unknown as TextureNode;
       }
       ```
       Abweichung von der Empfehlung (»Hilfsschicht für `mix`, `add`, `vec4` …, Laufzeitprüfung im Dev-Build«): `tsc` typt 83 der 87 Ausdrücke selbst, eine Hülle um `mix`/`add` hätte nichts mehr zu bündeln. Einen Dev-Build gibt es in der Bibliothek nicht (kein `NODE_ENV`, kein `import.meta.env` in `src/`), und den Typ eines `OperatorNode` kennt erst ein `NodeBuilder`; geprüft wird deshalb, wo es ohne Builder geht — `isTextureNode` beim Bau des Graphen, einmal je Material, nicht je Frame.
     - Neu `src/sprites/typed-stages.spec.ts`, Test `'no feature and no pass casts a node through unknown'`: liest jede `.ts`-Datei unter `src/sprites/features/` und `src/sprites/passes/` außer `*.spec.ts` und `*.bench.ts` (`node:fs`, Pfade über `import.meta.url`) und erwartet die Liste der Fundstellen `datei:zeile` von `as unknown as` leer. Das hält neue Stages ohne Cast.
     - Danach `pnpm nx test twopoint5d -- src/sprites/FeatureSprites/presetGraphs.spec.ts` **ohne** `UPDATE_SPRITE_GRAPHS`: muss grün sein — die Casts sind reine Typen, kein Graph darf sich ändern. `pnpm nx typecheck twopoint5d` grün.
  2. **`evaluateNode()` lernt, was der Frame-Stage von `AnimatedFrames` baut** (`src/testing/spriteGraph.ts`), Voraussetzung für den Regressionstest in Schritt 3:
     - Operator `'%'` in `OPERATORS`: `(x, y) => x - y * Math.floor(x / y)` — die Formel von three's `tsl_mod_float` (WGSL) und von GLSLs `mod()`; Kommentar sagt das.
     - Math-Methode `'floor'`: `zip(a, 0, Math.floor)`.
     - Konvertierung: ein Knoten mit `type === 'ConvertNode'` (three 0.186 setzt kein `isConvertNode`; erkannt wie `JoinNode` über `type`) wertet `node.node` aus und wendet je `convertTo` an: `'int'` und `'uint'` → `Math.trunc` (WGSL `i32(f32)` schneidet zur Null hin ab), `'float'` → unverändert; jedes andere `convertTo` wirft wie ein unbekannter Knoten. `EvaluableNode` um `convertTo?: string` ergänzen.
     - Die TSDoc-Liste von `evaluateNode()` nennt `%` (gefloort), `floor` und die Konvertierung nach int, uint und float.
     - `src/testing/spriteGraph.spec.ts`: je ein Test — `'%' floors as WGSL's tsl_mod_float does: mod(-1, 4) is 3` (dazu `mod(-Number.MIN_VALUE, 4)` ist `-Number.MIN_VALUE`, wie die Formel es rechnet), `floor`, und `toInt()` von `-1.5` ist `-1`, von `2.7` ist `2`; `toFloat()` reicht durch.
  3. **BUG-019 — Frame der gleichmäßigen Wiedergabe klemmen.**
     - Neu `src/sprites/features/evenFrame.ts`, intern (nicht in `public-api.ts`; `AnimatedFrames.ts` wird per `export *` veröffentlicht, ein Export dort wäre öffentlich — `frameSlices.ts` und `segmentChecks.ts` sind die Vorbilder):
       ```ts
       export function evenFrameOf(params: {
         steps: Node<'float'>; frameCount: Node<'float'>; lastFrame: Node<'float'>;
         isPingpong: Node<'bool'>; isOnce: Node<'bool'>;
       }): Node<'int'>
       ```
       Inhalt sind `AnimatedFrames.ts:81–85` samt dem Kommentar `:75–79`, mit Klemme in jedem Zweig **vor** dem `.toInt()` des Zweigs (der Kommentar `:77–79` erklärt, warum jeder Zweig schon int ist; so bleibt es):
       - `loopFrame = clamp(mod(steps, frameCount).floor(), float(0), lastFrame).toInt()`
       - `onceFrame` unverändert
       - `turnStep` unverändert; `pingpongFrame = clamp(sub(lastFrame, abs(sub(turnStep, lastFrame))), float(0), lastFrame).toInt()`
       - Rückgabe `select(isPingpong, pingpongFrame, select(isOnce, onceFrame, loopFrame))`
       Ein Satz im Kommentar, warum geklemmt wird: die f32-Division in `mod` darf mehrere ULP danebenliegen, `floor()` landet dann bei `−1` oder `frameCount`, und der Shader läse einen Header-Texel als Tex-Coords. Die Klemme hält den Frame in der Animation; an der Kante zeigt ein `−1` den ersten Frame statt des letzten — ein gültiger Frame statt Header-Daten.
     - `AnimatedFrames.ts`: `steps` bleibt dort berechnet (`:80`), dann `const evenFrame = evenFrameOf({steps, frameCount, lastFrame, isPingpong, isOnce});`.
     - Neu `src/sprites/features/evenFrame.spec.ts` über `evaluateNode()`, Eingaben als `uniform()`-Knoten, `isPingpong`/`isOnce` als `uniform(0).lessThan(1)` (wahr) bzw. `uniform(1).lessThan(0)` (falsch) — `'<'` kann `evaluateNode()` schon. `frameCount = 4`, `lastFrame = 3`. Regressionstests, **vor** der Klemme rot (rot laufen lassen und den Lauf in den Report):
       - `'holds a looped frame within the animation where the modulo lands on frameCount'`: `steps = -1e-20` → `3` (ungeklemmt `4`: `mod` gibt in f64 genau `4`)
       - `'holds a looped frame within the animation where the modulo lands below 0'`: `steps = -Number.MIN_VALUE` → `0` (ungeklemmt `-1`: `x / y` unterläuft zu `-0`, `mod` bleibt `-5e-324`)
       - `'holds a ping-pong frame within the animation where the modulo lands below 0'`: Ping-Pong, `steps = -Number.MIN_VALUE` → `0` (ungeklemmt `-1`)
       Dazu als Stütze, grün vor und nach: Loop `steps = 5.5` → `1`; Once `steps = 7` → `3`, `steps = -2` → `0`; Ping-Pong `steps = 4` → `2`, `steps = 6` → `0`.
       (Das Audit nannte »`steps` genau auf einem Vielfachen von `frameCount`«: in f64 rechnet `mod` dort exakt `0` und zeigt nichts; die beiden Werte oben bilden dieselbe Kante auf der CPU ab.)
     - `presetGraphs.spec.ts`: die Klemmen ändern den Graphen von `AnimatedSpriteKind` mit animsMap gewollt. Fixture mit `UPDATE_SPRITE_GRAPHS=1 pnpm nx test twopoint5d -- src/sprites/FeatureSprites/presetGraphs.spec.ts` neu schreiben; im Diff von `fixtures/preset-graphs.json` dürfen sich nur die vier Einträge `AnimatedSpriteKind, …` (die sprites und drei Pässe) ändern — sonst anhalten und im Report melden. Der Kopfkommentar `:12–15` und der `describe`-Titel sagen danach nicht mehr die Wahrheit (»before the pipeline stages«, »build them unchanged«); neu, ohne Rückblick:
       ```ts
       // The graphs the preset kinds and the passes over them build, as graphSignature() writes them. A
       // change to the graph of a preset feature, or a three bump that changes how its nodes are built,
       // changes them; then write them anew with UPDATE_SPRITE_GRAPHS=1 and read the diff.
       ```
       `describe('the preset kinds build the graphs of the fixture', …)`.
     - `docs/proposals/animation-playback-and-aseprite.md:205–207`: Tabelle sagt den Bau — loop `clamp(floor(mod(s, N)), 0, N − 1)`, pingpong Frame `clamp((N − 1) − abs(k − (N − 1)), 0, N − 1)` — und ein Satz unter der Tabelle zur ULP-Kante wie im Code-Kommentar.
  4. **BUG-035 — Segment-Ablehnung der Pass-Placements bei jeder Placement, mit der die Sprites zeichnen.** Ursache: `passFeatures()` lässt die `checkKind` der Pass-Features nur gegen die Placement der Kind laufen; die Sprites zeichnen aber mit der, die der `placement`-Setter tauscht **oder** die Option `placement` beim Bau setzt (`FeatureSprites.spec.ts:469` baut so). Beide Eingänge werden geschlossen.
     - `src/sprites/passes/passFeatures.ts`: die Faltung `:121–128` in eine private Funktion `foldFeatures(kind, pass, placement)` ziehen — die Placement der Kind (`kind.pipeline.placement!`) wird durch `placement` ersetzt, bei einem Pass mit eigener Placement durch `withoutPlacement(placement)`, sonst durch `placement` selbst; dahinter `stageFeaturesOf(pass)`, eingefroren. `passFeatures()` faltet mit der Placement der Kind und liefert wie bisher. Neu exportiert, `@internal`:
       ```ts
       /**
        * Runs the `checkKind` of every feature of `pass` on the features a material of the pass over `kind`
        * folds when the sprites draw with `placement` in place of the placement of the kind, in the words
        * of `where` — what passFeatures() runs for the placement of the kind. @internal
        */
       export function checkPassFeatures(kind: SpriteKind, pass: SpritePass, placement: SpriteFeature, where: string): void
       ```
       `passFeatures()` benutzt für seine letzte Schleife (`:129–131`) dieselbe Prüfung.
     - `FeatureSprites#placement` (Setter, `FeatureSprites.ts:501–508`): nach dem `#material == null`-Return zuerst `for (const mesh of Object.values(this.#passes)) checkPassFeatures(this.kind, mesh.pass, feature, WHERE);`, dann wie bisher Material, dann Pass-Materialien. Kommentar `:503–504` neu: jeder Pass prüft die Placement gegen seine Features, bevor irgendein Material sie bekommt; dann prüft das Material, und die Pass-Materialien nehmen, was es genommen hat. TSDoc des Setters bekommt `@throws` für eine Placement, die ein Pass nicht neben sich zeichnen kann.
     - `resolveParts()` (`FeatureSprites.ts:149–153`): nach `passFeatures(kind, pass, WHERE)` bei `materialParameters.placement != null` auch `checkPassFeatures(kind, pass, materialParameters.placement, WHERE)`; die Reihenfolge »jede Prüfung vor jedem Bau« bleibt. Constructor-TSDoc `:257–260`: »an `Error` for a pass the kind cannot draw« → »… cannot draw, with the placement the sprites start with«.
     - Meldung beider Eingänge exakt die des Baus, Präfix `FeatureSprites`:
       `FeatureSprites: feature "lightFacingPlacement" of pass "shadow": it turns each sprite to the light about its instance position, and of a segment of "segmentPlacement" it would draw the quad of the caps at the start — take SegmentShadowPass, which projects the segment as it lies` (für `BillboardReflectionPass` die Meldung aus `segment-passes.spec.ts:34`).
     - Regressionstests in `src/sprites/passes/segment-passes.spec.ts`, Kind `defineSprite({base: QuadBase, features: [InstancePosition, SegmentEnd, FlatPlacement, QuadSize]})` (eine Segment-Placement darf dort für die flache einstehen, `segments.spec.ts:192`), für jede der drei `PLACEMENTS`; vor dem Fix rot:
       - `'ShadowPass refuses a segment placement swapped in, and every material keeps its placement'`: `passes: [ShadowPass, ReflectionPass]`, `sprites.placement = placement` wirft obige Meldung; danach `sprites.placement`, `passes['reflection'].material.placement` beide `FlatPlacement`.
       - `'BillboardReflectionPass refuses a segment placement swapped in, and every material keeps its placement'`: `passes: [BillboardReflectionPass, SegmentShadowPass]` (beide heißen verschieden: `reflection`, `shadow`), Meldung von `mirroredBillboardPlacement`; `passes['shadow'].material.placement` bleibt `FlatPlacement`.
       - `'ShadowPass refuses a segment placement handed in as the placement option'`: `new FeatureSprites(kind, {capacity: 1, passes: [ShadowPass], placement})` wirft dieselbe Meldung.
       Die bestehenden Tests `FeatureSprites.spec.ts:459–495` bleiben grün (der `Tint`-Fall wirft weiter den `TypeError` des Materials: `refuseSegments` findet an `Tint` keine Segment-Placement).
     - `docs/sprites.md:1485–1487`: »so both refuse a kind of segments, naming the pass to take« → beide lehnen eine Kind von Segmenten ab, und die Sprites lehnen eine Segment-Placement ab, die unter ihnen in `placement` getauscht oder als Option `placement` übergeben wird, jeweils mit dem Pass, den man nehmen soll. `docs/sprites.md:2175–2177` (Bullet »Placement.«): eine Placement, die ein Pass nicht neben sich zeichnen kann, wird abgelehnt, bevor irgendein Material sie bekommt.
  5. **CONS-001 — Optionswerte in Ablehnungen über `describeValue()`** (`src/utils/describeValue.ts`):
     - `Wave.ts:48`, `:52`; `SegmentPlacement.ts:67`, `:76`; `FlatPlacement.ts:57`, `:60`; `AxisBillboardPlacement.ts:34`: `JSON.stringify(x)` → `describeValue(x)`.
     - Gleiche Ursache, mitnehmen: `FeatureSprites.ts:125` (`grow is true or false, got ${JSON.stringify(grow)}` → `describeValue(grow)`) und `GridBase.ts:102` (`typeof value === 'string' ? JSON.stringify(value) : String(value)` → `describeValue(value)`, gleiche Ausgabe für jeden bestehenden Testfall).
     - Specs: je Factory ein `NaN`-Fall in der bestehenden Ablehnungstabelle — `wave({weight: NaN})` → `wave: the weight NaN is neither 'top' nor 'uniform'`, `wave({weight: 'top', axis: NaN})`, `segmentPlacement({facing: NaN})`, `segmentPlacement({plane: NaN})`, `flatPlacement({plane: NaN})`, `flatPlacement({orientation: NaN})`, `axisBillboardPlacement({axis: NaN})`, `new FeatureSprites(kind, {grow: NaN})` → `FeatureSprites: grow is true or false, got NaN`; dazu `flatPlacement({plane: 1n})` → `flatPlacement: the plane 1 is neither 'xy' nor 'xz'` (vorher warf `JSON.stringify` »Do not know how to serialize a BigInt«). Vor dem Fix rot (`null` statt `NaN`).
     - Nicht dazu: `spriteDeclarations.ts:35` zeigt strukturierte Deklarationen, für die `describeValue()` nur `[object Object]` hätte — andere Abhilfe, steht als Nebenbefund im Plan.
  6. **API-008 — `frameIndex` von `tableFrame({views})` zählt Frames.**
     - `TableFrame.ts` Frame-Slot (`:93–112`): ohne `views` unverändert. Mit `views`:
       ```
       entries = header.x                                          // lookup(int(0)).x
       frames  = floor(entries / views)
       frame   = clamp(round(frameIndex), 0, max(frames − 1, 0))
       entry   = clamp(frame · views + view, 0, max(entries − 1, 0))
       ```
       `view` aus `viewOf()` wie heute. Die äußere Klemme deckt nur eine Tabelle mit weniger Einträgen als `views`. Weiter vier Lookups (`TableFrame.spec.ts:102` bleibt `4`).
     - TSDoc: `TableFrameOptions.views` (`:9–12`): der Shader liest den View der Kamera aus dem Block des Frames, `round(frameIndex) · views + view`. `TableFrameApi.frameIndex` (`:17–21`): der Frame, den der Sprite zeigt — mit und ohne `views` eine Frame-Nummer; gerundet; vor dem ersten oder hinter dem letzten Frame zeigt er den ersten oder letzten (mit `views`: dessen View). `tableFrame()` (`:59–61`, `:67–68`): »the view … is added to it« → der View wird im Block des Frames gewählt, die `n` Views eines Frames sind `n` aufeinanderfolgende Einträge, View 0 zuerst.
     - Browsertest `sprites-table-frame.test.js:215–228`: Titel → `'a yaw turns the views with the sprite, and frameIndex picks the frame whose views the shader reads'`, `sprite.frameIndex = 1` statt `8`. Neuer Test daneben, vor dem Fix rot: `'a frameIndex past the last frame shows the view of the last frame, one below the first that of the first'` — `colourTable()` hält 16 Einträge = 2 Frames × 8 Views; Yaw 0, für `k` 0…7: `frameIndex = 5` → `COLORS[8 + k]`, `frameIndex = -3` → `COLORS[k]`, `frameIndex = 0.6` → `COLORS[8 + k]`. Der umgestellte Test mit `frameIndex = 1` ist vor dem Fix ebenfalls rot (zeigt Eintrag `1 + View`).
     - Lookbook `Stalkers.ts`: `#first` hält die erste **Frame**-Nummer je Animation, `table.indexOf(`stalker_${anim}_0_0`) / 8`; `#setFrame()` (`:198`) `this.#first[anim] + frame`. Kommentare `:25–26` (»adds to its `frameIndex` the view« → wählt den View des Frames `frameIndex`), `:96–97` (»the first entry of an eight-view block, `first(anim) + frame · 8`« → der Frame `first(anim) + frame`), `:107–108` (»the walk's frame 1 is `first.walk + 1 · 8`« → `first.walk + 1`).
     - `_boomer-shooter-corridor.json`, `description`: »`tableFrame({views: 8})` adds to its `frameIndex` the view the camera sees it from« → … reads, for its `frameIndex`, the view the camera sees it from; »`frameIndex = first + frame · 8`« → `frameIndex = first + frame`.
     - `apps/lookbook/assets-src/README.md:388–389`: »`atlasFrameTable(atlas, /^stalker_walk_/)` lists the walk as `frame · 8 + view`: set `frameIndex = frame · 8` and `tableFrame({views: 8})` adds the view.« → `FrameTable.fromAtlas(atlas, /^stalker_walk_/)` (die Datentextur, die `tableFrame()` liest; `atlasFrameTable()` baut die `AtlasFrameTable` für Uniform-Arrays) lists the walk as `frame · 8 + view`: set `frameIndex = frame` and `tableFrame({views: 8})` reads entry `frame · 8 + view`.
     - `docs/sprites.md`: `:555` (»adds to `frameIndex` the view«), Beispiel `:594` → `stalker.frameIndex = Math.floor(time / 0.15) % 4; // walk frame 0 … 3`, Bullet `:599–600` → `frameIndex` zählt Frames wie ohne Views, der Shader liest Eintrag `round(frameIndex) · n + view`; ein `frameIndex` hinter dem letzten Frame zeigt den passenden View des letzten Frames. Der Block ist `ts check` — er bleibt typgeprüft.
     - `docs/proposals/table-frames-and-palette-swap.md` §4.1 (`TableFrameApi`-Kommentar `:139`, Pseudocode `index`/`entry`) und §4.2 (Pseudocode `index = round(frameIndex) + view`, Bullet »The layout«) sagen den Bau, mit dem Pseudocode oben.
     - CHANGELOG: siehe unten; kein Migration Guide (Begründung dort).
  7. **BUG-017 — Grid über das Produkt begrenzen.**
     - `GridBase.ts`: `MAX_CELLS` → `MAX_CELLS_PER_AXIS = 1024`, neu `MAX_GRID_CELLS = 4096`. Kommentar `:29` nennt beide und warum: keine GPU-Grenze; 1024 je Achse hält die Gitterlinie jeder Vertex exakt in ihrer UV (`round(uv.x · columns)`, Proposal §4.1), 4096 Zellen begrenzen die Base selbst, deren Indices für die Laufzeit der Seite im Cache `grids` bleiben.
     - Nach der Achsenprüfung (`:96–105`): `if (columns * rows > MAX_GRID_CELLS) throw new TypeError(`gridBase: a grid of ${columns} × ${rows} is ${columns * rows} cells — a grid holds at most ${MAX_GRID_CELLS}`)`.
     - TSDoc: `GridBaseOptions.columns`/`rows` (`:4`, `:6`) und `@throws` von `gridBase()` (`:88–89`) nennen die 4096.
     - `gridIndices()` bleibt `number[]` — Abweichung von der Empfehlung (`Uint16Array`/`Uint32Array`): `VertexObjectDescription.indices` ist öffentlich `number[]` (`types.ts:192`), `VertexObjectDescriptor` friert die Indices ein (`VertexObjectDescriptor.ts:34`), und `Object.freeze()` wirft auf einem Typed Array mit Elementen (»Cannot freeze array buffer views with elements«, in Zug 0 geprüft); `createIndicesArray()` baut je Geometrie ohnehin ein `Uint32Array`. Mit der Produktgrenze hält das gecachte Array höchstens 24 576 Einträge.
     - `GridBase.spec.ts`, Tabelle `'refuses %j'`, vor dem Fix rot: `{columns: 1000, rows: 1000}` → `gridBase: a grid of 1000 × 1000 is 1000000 cells — a grid holds at most 4096`, `{columns: 1024, rows: 5}` → `… 1024 × 5 is 5120 cells …`. Dazu `'takes a grid of 4096 cells: 64 × 64 and 1024 × 4'`.
     - Docs: `docs/sprites.md:177` und `docs/proposals/pipeline-stages-and-grid-base.md` §4.1 (Optionskommentare `:155–157`, Bullet »Refusals« `:198–202`) nennen die 4096.
  8. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, Skill `updating-changelog`):
     - `tableFrame()` und `gridBase()` sind unveröffentlicht: `git show v0.23.0:packages/twopoint5d/src/sprites/features/TableFrame.ts` und `…/GridBase.ts` gibt es nicht, beide stehen unter `[Unreleased] → Added` (`:25`, `:39`). Ihre Änderungen werden deshalb **in diesen beiden `Added`-Zeilen** festgehalten, ohne `Changed`-Eintrag und ohne Migration Guide — kein veröffentlichter Verbraucher hat etwas umzustellen. Das ist der Weg, den Paket 4 für das ebenfalls unveröffentlichte `AdaptiveResolution` aus derselben Entscheidungszeile gegangen ist (`920bfdac`); die Umformulierung dieser beiden fremden `[Unreleased]`-Zeilen ist damit entschieden, die Rückfrage aus dem Skill (»reword an existing bullet … ask first«) entfällt. `:39`: `views` liest den View aus dem Block des Frames `frameIndex`, Eintrag `round(frameIndex) · n + view`, `frameIndex` zählt Frames wie ohne Views, hinter dem letzten Frame der passende View des letzten. `:25`: »Columns and rows are whole numbers from 1 to 1024« → … and a grid holds at most 4096 cells.
     - `### Fixed`, je ein Eintrag: `AnimatedFrames` hält den Frame einer geloopten und einer Ping-Pong-Animation in der Animation, wo der Modulo der GPU auf ihrer Kante landet (released Feature) · `FeatureSprites` lehnt eine Segment-Placement ab, die unter `ShadowPass` oder `BillboardReflectionPass` in `placement` getauscht oder als Option `placement` übergeben wird, mit dem Pass, den man nehmen soll (Vorbild: der `NineSlice`-Eintrag unter `Fixed`) · die Ablehnungen von `flatPlacement()`, `axisBillboardPlacement()`, `segmentPlacement()`, `wave()`, `gridBase()` und der Option `grow` zeigen den Wert wie `describeValue()`: `NaN` und `Infinity` als sie selbst, ein BigInt ohne dass die Meldung verloren geht.
     - TYPE-001 und TEST-015 sind intern: kein Eintrag.
  9. **TEST-015 — PaletteSwap-Graphtest ohne three-Interna** (`PaletteSwap.spec.ts`):
     - `encodingsOf()` (`:31–35`, liest `shaderNode.layout.name`) streichen. Stattdessen am Kopf der Datei
       ```ts
       vi.mock('three/tsl', async (importOriginal) => {
         const tsl = await importOriginal<typeof import('three/tsl')>();
         return {...tsl, sRGBTransferOETF: vi.fn(tsl.sRGBTransferOETF)};
       });
       ```
       — der Spy reicht an three durch, kein anderer Test der Datei merkt etwas; Vorbild für `vi.mock` in einer Spec ist `src/display/hot-path-allocations.spec.ts` (Paket 4 mockt dort `@spearwolf/eventize`). Der Test `:105–113` (Titel bleibt) zählt nach `mockClear()` die Aufrufe von `sRGBTransferOETF` beim Bau des Farbgraphen: `1 + 16` unter einer `srgb`-Palette, nach dem Wechsel auf eine lineare Palette und erneutem `mockClear()` `0`. Damit bleibt der `srgb`-Zweig unter dem 100-%-Branch-Gate von `src/sprites/**` ausgeführt und geprüft, über die öffentliche Export-Grenze von three; das sichtbare Ergebnis hält weiter der Browsertest `sprites-palette-swap.test.js:173`.
     - Nimmt three's `Fn` den Wrapper nicht an (der Graph baut dann nicht), im Report als Abweichung melden und den Zweig über einen Vergleich zweier `graphSignature()` (srgb gegen linear, dieselbe Palette sonst) prüfen.
- Verify: `pnpm run ci`
- Commit: `fix(sprites): hold the frame of a looped or ping-pong animation within its animation, count the frameIndex of tableFrame({views}) in frames, refuse a segment placement swapped in or handed in under a pass that turns each sprite about its instance position, bound a grid base to 4096 cells, show a refused option value as describeValue() does, let the shader stages type their nodes without casts, and observe the sRGB encoding of PaletteSwap through three's export`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · BUG-017 unverändert (`GridBase.ts:30`, `:60`, `:76`) · BUG-019 unverändert (`AnimatedFrames.ts:81`, `:83`, `:115`) · BUG-035 besteht, Setter nach `FeatureSprites.ts:501–508` gewandert, Leitfaden-Stelle nach `docs/sprites.md:1485–1487`; zweiter Eingang derselben Ursache aufgenommen: Option `placement` in `resolveParts()` (`FeatureSprites.ts:152`) · CONS-001 besteht, `SegmentPlacement.ts:62`/`:71` nach `:67`/`:76` gewandert; gleiche Ursache aufgenommen: `FeatureSprites.ts:125`, `GridBase.ts:102` · API-008 unverändert (`TableFrame.ts:18`, `:98`); Aufrufer mit `views`: `Stalkers.ts:198`, `sprites-table-frame.test.js:222`, `docs/sprites.md:594`, Lookbook-Beschreibung, `assets-src/README.md:389` · TYPE-001 besteht, 87 Casts in 16 Dateien (Audit: 82), davon 83 ohne Ersatz entfernbar (Probe an einer Kopie von `src/`); gleiche Altlast aufgenommen: `cameraNodes.ts:11`, `:20`, `FeatureSpritesMaterial.ts:66`, `:75`, `:182`, `:183`, `:210`, `:326` · TEST-015 unverändert (`PaletteSwap.spec.ts:32`) · Folgen aus Paketen 1–6: keine offen · Queue: kein Eintrag mit derselben Ursache · neuer Nebenbefund `spriteDeclarations.ts:35` → Offene Befunde · Restplan unverändert
  - 2026-10-22 Zug 1: Implementierer beauftragt (opus, effort medium), Brief `paket-7.impl-0.brief.txt`, Report nach `paket-7.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG_MIT_VORBEHALT (Schritt 9 Spy als Lambda, `vi.fn(fn)` scheitert am Proxy von `Fn`), 48 Dateien geändert/neu (u. a. `typedNodes.ts`, `typed-stages.spec.ts`, `evenFrame.ts`, `evenFrame.spec.ts`), Arbeitsbaum schmutzig, Verify `pnpm run ci` exit=0 (`paket-7.verify.log`)
  - 2026-10-22 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-7.diff` (47 Dateien, +564/−241), Report nach `paket-7.review-0.json`; Urteil: alle sieben behoben, 1 wichtig (`TableFrame.ts:105` f32-Division `entries / views`), 6 klein
  - 2026-10-22 Zug 4 Runde 1: offen `TableFrame.ts:105` (wichtig) samt gleicher Ursache in `viewOf()` `:56` (vorbestehend, aufgenommen), dazu klein CHANGELOG `:39`, Umbrüche `TableFrame.ts:72`/`FeatureSprites.ts:262`, `uint`-Konvertierung in `spriteGraph.ts` → derselbe Implementierer per Resume (opus, medium), Brief `paket-7.impl-1.brief.txt` → FERTIG, alle fünf Punkte behoben (`TableFrame.ts` und `viewOf()` mit `floor((x + 0.5) / views)`, Proposal §4.2 nachgezogen; `uint` klemmt, Test `toUint() takes a negative value to 0, as WGSL u32() does` vor dem Fix rot; für die f32-Kante kein CPU-Test möglich, f64 rechnet exakt), Verify exit=0 (`paket-7.verify-1.log`), Nachprüfung beauftragt → `paket-7.review-1.json`, Diff `paket-7.r1.diff`
  - 2026-10-22 Zug 4 Runde 1 Nachprüfung: alle fünf Punkte erledigt, keine neuen Befunde, nichts zurückgekehrt (`paket-7.review-1.json`)
  - 2026-10-22 Zug 5: committet `5ed8cceb` (47 Dateien), Verify `paket-7.verify-1.log` exit=0, 1 Runde

## Entscheidungen dieses Zug 0 mit Grund

- **CHANGELOG ohne Migration Guide für `tableFrame({views})`.** Die Entscheidung vom 2026-10-21 nennt die Änderung als Breaking Change »mit Migrationshinweis«. `tableFrame()` lag in keinem Release (geprüft am Tag `v0.23.0`), ein Verbraucher von 0.23.0 hat nichts umzustellen; der Migration Guide wäre für ihn eine falsche Anweisung. Paket 4 hat dieselbe Lage beim unveröffentlichten `AdaptiveResolution` aus derselben Entscheidungszeile so gelöst; die eigenen Aufrufer (Lookbook, Browsertest, Docs) zieht dieses Paket mit, wie die Entscheidung es verlangt.
- **TYPE-001: Casts streichen statt bündeln.** Die Empfehlung setzte voraus, dass die Casts nötig sind. Unter `@types/three` 0.186 sind es 4 von 87; die übrigen schalten nur Prüfung ab. Zwei Helfer decken die echten Lücken, ein Spec hält die Verzeichnisse der Stages frei von neuen Doppel-Casts.
- **BUG-019: Test über einen herausgezogenen Helfer.** Der Frame-Stage liest seine Eingaben aus einer Textur, die `evaluateNode()` nicht auswerten kann; `evenFrameOf()` nimmt `steps` direkt und macht die Kante auf der CPU zeigbar. »Genau auf einem Vielfachen« reicht dafür in f64 nicht (dort ist `mod` exakt), `-1e-20` und `-Number.MIN_VALUE` treffen dieselbe Kante.
- **BUG-035 auch beim Bau.** Die Option `placement` lässt Sprites mit einer anderen Placement starten als der der Kind; `resolveParts()` prüfte die Pässe trotzdem gegen die der Kind. Gleiche Ursache, gleicher Helfer.
- **Nicht im Umfang:** eine eigene Pass-Prüfung im Setter von `FeatureSpritesMaterial`. Ein Pass-Material kennt die Placement der Sprites nur über `FeatureSprites`, und kein mitgelieferter Pass ohne eigene Placement trägt eine `checkKind`; beide Wege, auf denen Sprites mit einer Placement zeichnen, prüft `FeatureSprites` jetzt vor jedem Material.

## Findings im Volltext

**BUG-017 · low · packages/twopoint5d/src/sprites/GridBase.ts:30** (auch `:76`, `:61`) — Grid-Größe über das Produkt begrenzen und Indizes typisiert halten
Der Kommentar zu `MAX_CELLS` verspricht, einen Tippfehler am Bau einer Base mit einer Million Vertices pro Sprite zu hindern. Die Grenze gilt aber pro Achse: `gridBase({columns: 1000, rows: 1000})` geht durch und ergibt rund 1 Mio. Vertices pro Instanz und 6 Mio. Indizes als `number[]` (etwa 48 MB). Dieses Array bleibt im modulglobalen `grids`-Cache für die Laufzeit der Seite liegen, denn der Cache wird nie geräumt.
Beleg: `const MAX_CELLS = 1024;` mit `isCount(columns) && isCount(rows)`
Empfehlung: Zusätzlich `columns * rows` begrenzen (etwa auf 4096 Zellen) und die Fehlermeldung danach formulieren. `gridIndices()` sollte ein `Uint16Array`/`Uint32Array` liefern, und der Kommentar muss die tatsächliche Grenze nennen.

**BUG-019 · low · packages/twopoint5d/src/sprites/features/AnimatedFrames.ts:81** (auch `:83`, `:115`) — Frame-Index der gleichmäßigen Wiedergabe in AnimatedFrames klemmen
`loopFrame` und `turnStep`/`pingpongFrame` werden aus `mod(steps, n).floor()` gebildet und ungeklemmt als Frame-Index benutzt; nur `onceFrame` und der Pfad mit Einzeldauern (`min(count, lastFrame)`) sind geklemmt. `tsl_mod_float` rechnet `x − y·floor(x/y)`; WGSL und GLSL erlauben für die f32-Division mehrere ULP Fehler (viele GPUs rechnen `x·rcp(y)`). Liegt `steps` knapp unter oder genau auf einem Vielfachen von `frameCount`, kann das Ergebnis −ε oder `frameCount` werden, `floor()` liefert dann −1 bzw. `frameCount`. Der Shader liest in dem Fall den Kopf-Texel bzw. den zweiten Header als Tex-Coords — ein Ein-Frame-Flackern, das bei vielen Sprites über lange Laufzeit sichtbar werden kann.
Beleg: `const loopFrame = mod(steps, frameCount).floor().toInt();`
Empfehlung: `evenFrame` (oder jeden Zweig) mit `clamp(…, 0, lastFrame)` begrenzen, wie es `onceFrame` und `walkedFrame` schon tun; ein evaluateNode-Spec mit `steps` exakt auf einem Vielfachen von `frameCount` sichert es ab.

**BUG-035 · low · packages/twopoint5d/src/sprites/passes/refuseSegments.ts:13** (auch `LightFacingPlacement.ts:21`, `MirroredBillboardPlacement.ts:21`) — Segment-Ablehnung der Pass-Placements auch beim Placement-Tausch prüfen
`LightFacingPlacement` und `MirroredBillboardPlacement` lehnen eine Kind mit Segment-Placement über `checkKind` ab — aber nur, wenn der Pass-Material gebaut wird (`passFeatures()`). Der Setter `FeatureSprites#placement` (FeatureSprites.ts:451–458) tauscht die Placement der Sprites und reicht sie nur an Pässe ohne eigene Placement weiter; die `checkKind` der Features eines Passes mit eigener Placement läuft dabei nicht erneut. Eine Kind, die `SegmentEnd` hält und mit einer flachen Placement startet, kann also zur Laufzeit auf `segmentPlacement()` wechseln, während `ShadowPass` oder `BillboardReflectionPass` still den Cap-Quad am Segmentstart zeichnen — genau der Fall, den die Ablehnung laut docs/sprites.md:1462 »loudly« verhindern soll.
Beleg: FeatureSprites.ts:457 `if (placementOfPass(mesh.pass) == null) mesh.material.placement = feature;`
Empfehlung: Beim Tausch für jeden Pass mit eigener Placement die `checkKind` seiner Features gegen die Kind mit der neuen Placement laufen lassen (wie `passFeatures()` es beim Bau tut), bevor irgendein Material umgestellt wird; einen Spec für den Tausch FlatPlacement → segmentPlacement() unter ShadowPass ergänzen.

**CONS-001 · low · packages/twopoint5d/src/sprites/features/Wave.ts:48** (auch `Wave.ts:52`, `SegmentPlacement.ts:62`, `:71`, `FlatPlacement.ts:57`, `:60`, `AxisBillboardPlacement.ts:34`) — Optionswerte in Ablehnungen mit describeValue() statt JSON.stringify() zeigen
`paletteSwap()` und `tableFrame()` nennen einen falschen Optionswert über `describeValue()` (Commit c807d0a5 hat das für NaN und Infinity eigens eingeführt). `wave()`, `segmentPlacement()`, `flatPlacement()` und `axisBillboardPlacement()` benutzen `JSON.stringify()`: `NaN` und `Infinity` erscheinen als `null`, ein Symbol als `undefined`, und ein BigInt lässt `JSON.stringify` selbst mit »Do not know how to serialize a BigInt« werfen — die eigentliche Meldung geht verloren.
Beleg: `` throw new TypeError(`wave: the weight ${JSON.stringify(weight)} is neither 'top' nor 'uniform'`); ``
Empfehlung: Alle Factory-Ablehnungen auf `describeValue()` umstellen und je einen Spec mit `NaN` ergänzen, wie für paletteSwap()/tableFrame().

**API-008 · low · packages/twopoint5d/src/sprites/features/TableFrame.ts:17** (auch `:98`) — frameIndex von tableFrame({views}) in Frames statt in Tabelleneinträgen zählen
Mit `views` muss der Aufrufer `frameIndex = frame · views` selbst ausrechnen; derselbe Attributname bedeutet je nach Option einmal »Frame«, einmal »erster Eintrag eines View-Blocks«. Ein `frameIndex`, das kein Vielfaches von `views` ist, zeigt still Views des Nachbar-Frames, und ein Wechsel zwischen `tableFrame()` und `tableFrame({views})` ändert die Bedeutung bestehender Werte.
Empfehlung: Im Shader `round(frameIndex) · views + view` rechnen und `frameIndex` überall als Frame-Nummer dokumentieren (Breaking Change, also mit Migrationshinweis), oder zumindest einen Helfer `entryOf(frame)` anbieten.

**TYPE-001 · low · packages/twopoint5d/src/sprites/features/NineSlice.ts:199** (auch `PaletteSwap.ts:77`, `Flip.ts:42`, `AnimatedFrames.ts:105`, `passes/facing.ts:47`) — Doppelte Casts `as unknown as Node<…>` in den Shader-Stages durch typisierte Helfer ersetzen
Features und Passes enthalten 82 Doppel-Casts `as unknown as Node<'vec2'|'vec3'|'vec4'|'float'>` (NineSlice allein 13, PaletteSwap 7). Jeder Cast schaltet die Typprüfung des TSL-Ausdrucks ab: ein vec4, der als vec3 weitergereicht wird, oder ein falsch geswizzelter Wert fällt erst beim Shader-Build oder visuell auf, nicht beim `tsc`.
Beleg: `const line = round(mul(uv, 3)) as unknown as Vec2;`
Empfehlung: Eine kleine Hilfsschicht (`asVec2()`, `asVec3()`, `asFloat()` oder typisierte Wrapper für `mix`, `add`, `vec4`) zentral definieren, die den Cast an einer Stelle bündelt und wo möglich den Knotentyp zur Laufzeit im Dev-Build prüft; neue Stages nur noch über diese Schicht.

**TEST-015 · low · packages/twopoint5d/src/sprites/features/PaletteSwap.spec.ts:32** — PaletteSwap-Graphtest von three-Interna lösen
`encodingsOf` hängt an `shaderNode.layout.name` (three-Interna) und kann bei einem three-Bump grundlos rot werden; der Test deckt den `srgb`-Zweig unter dem 100-%-Branch-Gate von `src/sprites/**`. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Den `srgb`-Zweig über eine beobachtbare Größe prüfen (etwa einen Hook im Stage oder das Ergebnis im Browser-Test) und den Strukturtest streichen.

## Urteil des Reviewers je Finding

Aus `paket-7.review-0.json`, bestätigt nach Runde 1 in `paket-7.review-1.json`:

- **BUG-017** behoben — `GridBase.ts:33–34` (`MAX_CELLS_PER_AXIS`, `MAX_GRID_CELLS`), Produktgrenze `:110–114`, TSDoc, Specs `GridBase.spec.ts`; `gridIndices()` bleibt begründet `number[]`.
- **BUG-019** behoben — `features/evenFrame.ts` (Klemme je Zweig vor `.toInt()`), Aufruf `AnimatedFrames.ts:78`, `evenFrame.spec.ts`; dieselbe f32-Kante nach Runde 1 auch in `TableFrame.ts` (`viewOf()`, Frame-Slot) geschlossen.
- **BUG-035** behoben, beide Eingänge — `passes/passFeatures.ts` (`foldFeatures`, `checkPassFeatures`), Setter `FeatureSprites.ts:512`, Bau `:154–155`, Specs `segment-passes.spec.ts:49–79`, `docs/sprites.md:1487–1490`, `:2180–2182`.
- **CONS-001** behoben — `Wave.ts`, `SegmentPlacement.ts`, `FlatPlacement.ts`, `AxisBillboardPlacement.ts`, mitgenommen `FeatureSprites.ts:126`, `GridBase.ts:106`; kein `JSON.stringify` mehr unter `features/`.
- **API-008** behoben — `TableFrame.ts` Frame-Slot und TSDoc, Browsertest `sprites-table-frame.test.js`, Lookbook, Docs, Proposal, CHANGELOG `:39`.
- **TYPE-001** behoben — kein `as unknown as` in Nicht-Spec-Dateien unter `features/` und `passes/`, `sprites/typedNodes.ts`, Wächter `typed-stages.spec.ts`, Ausdrucks-Casts in `FeatureSpritesMaterial.ts` und `cameraNodes.ts` weg.
- **TEST-015** behoben mit begründeter Abweichung — `PaletteSwap.spec.ts:29–37` `vi.mock('three/tsl')` mit Lambda-Spy (der Proxy von `Fn` hat kein `apply`), Zählung `:111–124`, `encodingsOf()` gestrichen.

## Kleine Befunde (ohne Runde)

- `src/sprites/features/evenFrame.spec.ts:11–21` — sechs `as unknown as` im neuen Spec; Specs sind vom Wächter ausgenommen, eine Annotation oder ein typisierter Helfer läge näher.
- `packages/twopoint5d/CHANGELOG.md:97–98` (`Fixed`) — der `describeValue`-Eintrag nennt auch unveröffentlichte Factories (`gridBase()`, `wave()`, `segmentPlacement()`, `axisBillboardPlacement()`); konsequent wären nur `flatPlacement()` und die Option `grow`. Plangemäß, deshalb stehen gelassen.

## Nebenbefunde mit Urteil

Alle vier vorbestehend (geprüft gegen `6500527f`), keiner teilt eine Ursache mit dem Paket; Scope-Regel »alles« → `→ Scope`, eingetragen in »Offene Befunde«: `MirrorAtPlane.ts:16` (Nullnormale → NaN), `Wave.ts:9` (161 Zeichen TSDoc), `Fade.ts`/`Flash.ts` ohne TSDoc am Export, »as today« in `animation-playback-and-aseprite.md:199`, `:412`, `:420`, `:442`.
