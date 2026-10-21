# Remediation-Plan — twopoint5d

Quelle: ./audit.html vom 2026-10-21 · Branch: main · erstellt: 2026-10-21
Baseline: `pnpm run ci` ✓ (umfasst `pnpm run lint`, `pnpm run build`, `pnpm run typecheck`,
`pnpm run checkPkgTypes`, `pnpm run checkNameableTypes`, `pnpm run lintPkg`, `pnpm run test:scripts`,
`pnpm run test:coverage`, `pnpm run test:allocations`, `pnpm run test:browser`) · Verify-Gate je Paket: `pnpm run ci`
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/2700fbd8-0496-4bd7-9248-d90b950d4db7/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 24 von 106 Findings (2 high, 22 medium) · ausgenommen: low (79), info (3), acknowledged (10)
Scope-Regel: alles ab medium aufwärts, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen
Kaltstarts: 5 Pakete × mindestens 3 Agenten ≈ 15, je Nachrunde zwei mehr · 4,8 Findings je Paket (Paket 5 trägt nur Folgen aus Paket 3)
Stand (2026-10-21): Lauf abgeschlossen — 6 Pakete committet (328f7a8e..dbc69f47), nichts blockiert, Befund-Queue leer, Endverify `pnpm run ci` ✓, audit.html nachgeführt (Score 79 → 88), Tokentabelle nach docs/remediation/20261021-remediation-report.md umgezogen

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` geparkt, Stand im Stash.

## Entscheidungen
- PaletteSwap unterstützt `colorSpace: 'srgb'` für `colorMap` und `palette`: der Stage liest den Farbraum aus `textureShapeKey()` und vergleicht im Farbraum der Texturdaten; Docs und Lookbook bleiben, wie sie sind (2026-10-21)
- Der `material`-Slot von `FeatureSprites` bleibt tauschbar. `FeatureSprites` merkt sich das selbst gebaute Material und die selbst gebaute Geometry und released genau diese; ein eingetauschtes Material gehört dem Aufrufer, der es disposed. Steht in `docs/sprites.md` (2026-10-21)
- Ein `TextureStore` ohne Renderer lädt die GPU-freien Werte (Bild, `imageCoords`, `atlas`, `frameBasedAnimations`); Subtypes, die eine GPU-Textur brauchen, warten auf den Renderer. TSDoc und `docs/sprites.md` sagen das (2026-10-21)
- `CameraBasedVisibility`: Default-`depth` bleibt 100, nicht breaking; die Box wird vor dem Frustum-Test auf den y-Bereich geklemmt, den das Frustum tatsächlich überdeckt. TSDoc von `depth`/`searchCanStop()` ergänzt, Spec begrenzt die Tile-Zahl mit Default-`depth` und Grid 1 (2026-10-21)
- Ansage, ohne Widerspruch umgesetzt: `RectangularVisibilityArea` entscheidet Reuse über ganzzahlige Tile-Indizes — unabhängig davon, ob Kachelgrößen unter 1 vorgesehen sind, ist das für jede Größe richtig (2026-10-21)
- Ansage: `NineSlice` neben `segmentPlacement()` wird in `checkKind` laut abgelehnt, mit Fehlermeldung, die die Alternative nennt; festgehalten in `docs/sprites.md` unter »Nine-slice panels« und »Segments« (2026-10-21)
- Ansage: Ping-Pong-Adoption zwischen `VertexObjectPool`s ist unterstützt, der Quell-Pool bleibt nach `adoptVOs()` nutzbar (2026-10-21)
- Ansage: `PanControl2D` bekommt die Option `pointerTarget?: EventTarget` (Default `document`, kompatibel); pointerdown auf editierbaren oder interaktiven Zielen (input, textarea, select, button, contenteditable) startet kein Panning (2026-10-21)
- Ansage: ein neuer `TextureStore#loadAsync()` bricht den laufenden Fetch ab; das ältere Promise rejected mit `AbortError`. Im TSDoc beschrieben (2026-10-21)
- Ansage: `TextureStore` bekommt eine haltende Variante zu `getAsync()` (additiv, z. B. `acquireAsync(id, type)` → `{value, release()}`); der TSDoc von `getAsync()` nennt den Leihstatus (2026-10-21)
- Ansage: eine direkt disposte `TextureResource` wird aus dem Store ausgetragen; pendende `getAsync()` rejecten mit klarer Meldung (2026-10-21)
- Supersampling über `resolutionScale > 1` bleibt außerhalb dieses Laufs (kein Finding ab medium); die reine Funktion aus der Display-Auflösung bildet das heutige Verhalten unverändert ab (2026-10-21)
- Neue öffentliche Symbole landen im `public-api.ts` ihres Moduls; jede für Aufrufer sichtbare Änderung bekommt einen Eintrag im CHANGELOG (2026-10-21)

## Konventionen
Gelten für jede Zeile, die in diesem Lauf entsteht — Code, Kommentare,
Dokumentation, CHANGELOG, Migrations-Hinweise, Commit-Messages:
- Inline-Kommentare sind erwünscht, wo sie erklären, *warum* etwas so ist.
- Keine Finding-IDs, auch nicht in der Commit-Message. Sie gehören diesem einen
  Audit, sind danach tot, und die Commit-Message überdauert den Lauf. Sie leben
  in diesem Plan und sonst nirgends; die Verbindung zwischen Finding und Commit
  trägt das Feld `Hash:` unter dem Paket — in genau der Richtung, in der jemand
  sie später sucht. Eine Commit-Message sagt in eigenen Worten, was sie ändert.
- Kein Rückblick auf den Vorzustand: kein »früher«, kein »statt bisher«, kein
  »im Zuge des Audits umgestellt«. Der Test: Ergibt der Satz für jemanden Sinn,
  der den Vorzustand nie gesehen hat? Dann bleibt er. Braucht er ihn, gehört er
  in die Commit-Message — die Historie ist bereits konserviert.
- Projektspezifisch: Code, Kommentare, TSDoc, Docs und Commit-Messages auf Englisch;
  Commit-Messages im Conventional-Commits-Stil wie in `git log` (`fix(display): …`).
- Projektspezifisch: `AGENTS.md` ist die Agentenreferenz des Repos und wird vor der ersten
  Änderung gelesen. Relative Imports mit `.js`-Suffix, Typen per `import type`.
- Projektspezifisch: Docs wachsen mit dem Feature — eine neue oder geänderte Fähigkeit wird im
  selben Commit in `docs/` (v. a. `docs/sprites.md`, `docs/display.md`) nachgetragen.
- Projektspezifisch: Allokations-Specs folgen den Regeln aus `AGENTS.md` (ganze Zahlen und
  Konstanten in der Runde, `measureSettledBytes()`).

## Vorbestehende Fehler
- keine — `pnpm run ci` war zu Lauf-Beginn grün

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.
- [x] `packages/twopoint5d/src/display/AdaptiveResolution.ts:211` — TSDoc von `get method()` sagt »`undefined` until the first frame it judges«, der Wert steht aber schon im ersten Frame, auch während des Settle · aus Paket 1 · low → Audit · ins Audit übertragen (2026-10-21)
- [x] `packages/twopoint5d/src/display/AdaptiveResolution.ts:266` — `#takeOverScale()` legt ein `display.resolutionScale` von NaN oder ∞ auf die unterste Stufe und hält NaN als Rückgabeskala fest · aus Paket 1 · low → Audit · ins Audit übertragen (2026-10-21)
- [x] `packages/twopoint5d/src/display/AdaptiveResolution.ts:74` — `median()` allokiert mit `values.slice()` je GPU-Fenster (12 gemessene Frames) ein Array im Frame-Pfad · aus Paket 1 · low → Audit · ins Audit übertragen (2026-10-21)
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts:23`, `packages/twopoint5d/src/map2d/hot-path-allocations.spec.ts:47` — `makeTopDownCamera()` schaut nicht exakt senkrecht: `lookAt()` entlang des up-Vektors kippt die Kamera um etwa 1e-4 rad; ein Spec mit exakten Höhen fällt darüber (der neue Höhen-Spec nimmt deshalb `rotation.x = -π/2`) · aus Paket 2 · low → Audit · ins Audit übertragen (2026-10-21)
- [x] `docs/architecture.md:160–162` — der Absatz sagt, alle Schwellen lägen »globally and per module« beim gemessenen Wert abgerundet minus zwei; `src/sprites/**` steht in `packages/twopoint5d/vite.config.ts:62` fest auf 100 %, die Ausnahme fehlt in der Doku · aus Paket 2 · low → Audit · ins Audit übertragen (2026-10-21)
- [x] `packages/twopoint5d/src/texture/DynamicAtlas.ts:444–447` — ein mit `close()` geschlossenes `ImageBitmap` (Breite 0) wird mit »has not loaded yet — await image.decode() before …« abgelehnt; `ImageBitmap` hat kein `decode()`, der Rat führt in die Irre · aus Paket 3 · low → Audit · → Paket 5 (Zug 0, 2026-10-21: gleiche Ursache, `#assertLoaded()`) · erledigt in Paket 5 (0e133345)
- [x] `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:368` — `#warnFull()` rät bei einer vom Aufrufer in den `geometry`-Slot gesetzten, vollen Geometry zu »a larger capacity — new FeatureSprites(…)«, voll ist aber die eingesetzte · aus Paket 4 · low → Audit · → Paket 6 (Drain, 2026-10-21: gleiche Ursache, Geometry im Slot) · erledigt in Paket 6 (dbc69f47)
- [x] `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts` (`createSprite()`, `freeSprite()`, `sortBy()`, `spritePool`) — arbeiten auf der Geometry im Slot, die Pass-Meshes zeichnen die gebaute; nach `sprites.geometry = other` zeichnen Mesh und Pässe verschiedene Sprites, dieselbe Divergenz, die das Audit für das Material als medium führte · aus Paket 4 · medium → Scope · → Paket 6 (Drain, 2026-10-21) · erledigt in Paket 6 (dbc69f47)
- [x] `packages/twopoint5d/src/texture/DynamicAtlas.ts:297` — `redraw()` lehnt über dieselbe Prüfung `#assertLoaded()` ein geladenes SVG-`<img>` ohne eigene Größe als »has not loaded yet« ab, schon vor diesem Lauf (`git show 4bf14f2e`, Zeile 297); bringt Paket 5 `#assertLoaded()` selbst in Ordnung, erledigt sich der Eintrag mit · aus Paket 4 (Zug 0) · low → Audit · → Paket 5 (Zug 0, 2026-10-21: gleiche Ursache, `#assertLoaded()`)

## Pakete

### [x] 1. Display: Auflösungspolitik als reine Funktion, AdaptiveResolution korrekt und getestet
- Findings: BUG-001 (high), ARCH-001 (medium), BUG-003 (medium), ASYNC-001 (medium), TEST-001 (medium), TEST-003 (medium)
- Detail: docs/remediation/paket-1.md
- Ziel: Pixel-Ratio und Buffer-Größe kommen aus einer reinen, ohne DOM testbaren Funktion, die `Display` und `AdaptiveResolution` teilen, und der Controller misst Frame-Pacing gegen die erreichbare Bildrate, sagt Step-ups aus der tatsächlichen Ratio vorher, verwirft Messungen nach dem Abschalten und ist samt Dispose gegen ein realistisches Double getestet.
- Bereich: `packages/twopoint5d/src/display/`, `packages/twopoint5d-testing/test/display-adaptive-resolution.test.js`, `docs/display.md`
- Hängt ab von: —
- Hash: 328f7a8e
- Ergebnis: 0 Runden · BUG-001, ARCH-001, BUG-003, ASYNC-001, TEST-001, TEST-003 behoben (Reviewer-Urteil in der Paketdatei) · Regressionstests vor dem Fix rot: zehn in `AdaptiveResolution.spec.ts` (u. a. `predicts a step up from the pixel ratio the display would draw at`, `tells the frames maxFps holds back from late ones by the animation frames of the page`, `drops a measurement in flight when it is disabled`, `gives back the scale the display had when it took over last`) und `lets go of the controller it built with dispose(): …` in `Display.spec.ts` · nebenbei mit erledigt: BUG-011 (low, `#scaleBefore` je Übernahme) · klein: vier Befunde in der Paketdatei, darunter eine Allokation je gemessenem Frame durch das Ergebnisobjekt von `resolveDrawingBuffer()`
- Nebenbefunde: → Queue (drei, alle low → Audit); der vierte, `AdaptiveResolution`-Konstruktor nimmt eine disposte Display an (`AdaptiveResolution.ts:177`), steht schon als RES-004 (low) im Audit
- Folgen: —
- Schnittstellen: alles `@internal`, `public-api.ts` unberührt · neues Modul `src/display/resolveDrawingBuffer.ts` mit `pixelRatioFor(params: PixelRatioParams): number`, `resolveDrawingBuffer(params: DrawingBufferParams): DrawingBuffer` und den Konstanten `DEVICE_PIXEL_ZOOM_EPSILON`, `PIXEL_RATIO_STEP`, `DEVICE_PIXEL_SIZE_TOLERANCE` (aus `Display.ts` dorthin gezogen) · `Display#pixelRatioAt(resolutionScale: number): number` · `FrameLoop#longestRafInterval: number` · `Display#adaptiveResolution` ist nach `dispose()` `undefined`

### [x] 2. Map2D und PanControl2D: Tile-Reuse, Sichtbarkeitsbox, Hot Path, Pointer-Ziel, Coverage-Schwellen
- Findings: BUG-002 (high), PERF-001 (medium), PERF-002 (medium), TEST-004 (medium), BUG-006 (medium), TEST-002 (medium)
- Detail: docs/remediation/paket-2.md
- Ziel: `RectangularVisibilityArea` reused Tiles über Indizes, `CameraBasedVisibility` testet eine ans Frustum geklemmte Box und allokiert im Hull-Pfad nichts — abgesichert durch Allokations-Specs mit geneigter Kamera und für `Map2D#update()` —, `PanControl2D` lässt sich auf ein Element begrenzen und ignoriert interaktive Ziele, und `src/display` sowie `src/controls` bekommen Coverage-Schwellen.
- Bereich: `packages/twopoint5d/src/map2d/`, `packages/twopoint5d/src/controls/`, `packages/twopoint5d/vite.config.ts`, `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d-testing/test/`
- Hängt ab von: 1 (die Coverage-Schwelle für `src/display` misst den Stand nach den Tests aus Paket 1)
- Hash: 4bf14f2e
- Ergebnis: 1 Runde · BUG-002, PERF-001, PERF-002, TEST-004, BUG-006, TEST-002 behoben (Reviewer-Urteil in der Paketdatei) · Regressionstests vor dem Fix rot: `a grid of 0.1 scrolled tile by tile keeps the tile set a fresh area computes` (`RectangularVisibilityArea.spec.ts`), `a recomputation over the same tiles under a tilted camera allocates nothing` (48 B, `src/map2d/hot-path-allocations.spec.ts`), `with the default depth, a tilted view of tiles of 1 takes no more tiles than the ground around the camera holds` (7 168 Tiles, jetzt 936) und der Höhen-Spec daneben (`CameraBasedVisibility.spec.ts`), elf Tests unter `pointerTarget` / `a press on an interactive element` (`PanControl2D.spec.ts`) · die beiden `Map2D on the hot path`-Specs waren schon vor dem Fix grün (0,01 bzw. 0,31 B) · Runde 1: veralteter Satz in `docs/architecture.md` zu Coverage-Schwellen · klein: keiner offen
- Nebenbefunde: → Queue (zwei, beide low → Audit)
- Folgen: —
- Schnittstellen: `PanControl2DOptions.pointerTarget?: EventTarget` neu, öffentlich, Default `document` (nur `pointerdown` hängt dort, move/up/cancel bleiben auf `document`) · `PanControl2D` startet keinen Pan auf `input`/`textarea`/`select`/`button`/`contenteditable` im `composedPath()` bis ausschließlich `pointerTarget` · `TileBox#frustumBox` von `CameraBasedVisibility` ist auf den Höhenbereich des Frustums geklemmt, `TileBox#box` behält die volle `depth` · Browser-Fixture `pointer()` in `packages/twopoint5d-testing/test/helpers/fixtures.js` dispatcht jetzt `composed: true` · `vite.config.ts`: Schwellen `src/controls/**` 90/74/89/92 und `src/display/**` 82/73/81/84, `src/display/Stylesheets.ts` aus dem Coverage-Zähler

### [x] 3. Texture: Store und Atlas laden, warten und geben frei, wie sie es zusagen
- Findings: BUG-007 (medium), BUG-008 (medium), BUG-009 (medium), RES-003 (medium), ASYNC-002 (medium), API-001 (medium)
- Detail: docs/remediation/paket-3.md
- Ziel: `DynamicAtlas#add()` lehnt ungeladene Bilder immer ab, und `TextureStore` lädt ohne Renderer die GPU-freien Werte, weist unerreichbare Subtypes ab, trägt disposte Ressourcen aus, sequenziert überlappende `loadAsync()`-Aufrufe und bietet neben dem geliehenen `getAsync()` eine haltende Variante.
- Bereich: `packages/twopoint5d/src/texture/`, `packages/twopoint5d/docs/` (`sprites.md`, `architecture.md`, `resource-lifecycle.md`), `packages/twopoint5d/CHANGELOG.md`
- Hängt ab von: —
- Hash: ac549468
- Ergebnis: 0 Runden · BUG-007, BUG-008, BUG-009, RES-003, ASYNC-002, API-001 behoben (Reviewer-Urteil in der Paketdatei) · Regressionstests vor dem Fix rot: drei in `DynamicAtlas.spec.ts` (u. a. `refuses an image element that has not loaded when a size is given`), vier zum Store ohne Renderer (u. a. `a store without a renderer loads the image, its coordinates, the atlas and the animations, and the texture waits for the renderer`, `without a factory the resource publishes its imageCoords and builds no texture, …`), sechs zu unerreichbaren Subtypes (u. a. `getAsync() for the atlas of an image item rejects, naming the id, the type and the subtype`, `on() for a subtype its resource never builds warns once`), drei zur direkt disposten Resource (u. a. `a getAsync() waiting on a resource that is disposed directly rejects, naming the id`), drei zu überlappenden Loads (u. a. `a second loadAsync() cuts the first short: …`); `acquireAsync()` rot über den Typecheck · `a loadAsync() started by a ready listener inside the parse of another …` war vor dem Fix grün (Wache) · klein: vier Befunde in der Paketdatei
- Nebenbefunde: → Queue (einer, low → Audit)
- Folgen: `packages/twopoint5d/src/texture/TextureStore.ts:631` — `failed()` sendet das `error`-Event vor `settle()`; ein Listener, der darin `loadAsync()` erneut ruft, bricht den gescheiterten Load als abgelöst ab, sein Promise rejected mit `AbortError` statt mit dem Ladefehler, obwohl das `error`-Event draußen ist (low) · `packages/twopoint5d/src/texture/DynamicAtlas.ts:444` — `add(name, img, size)` prüft jetzt auch mit `size` die natürliche Größe; ein SVG-`<img>` ohne eigene Größe (`naturalWidth` 0 bei `complete` true in manchen Browsern) wird damit abgelehnt (low) · → beide als Symptome in Paket 5 (Nachtrag), Zug 0 von Paket 4, 2026-10-21
- Schnittstellen: `TextureStore#acquireAsync(id, type, options?: {signal?}): Promise<TextureStoreLease<MapSubTypes<T>>>` neu, öffentlich · `interface TextureStoreLease<V> {readonly value: V; release(): void}` neu, öffentlich (über `export *` aus `TextureStore.ts`) · `TextureStore#loadAsync()` rejected ein laufendes älteres mit `AbortError` · `getAsync()` rejected für Subtypes, die die Resource nie baut, und für eine direkt disposte Resource · ein Store ohne Renderer publiziert alles außer `texture` · `internals.ts`: neues `@internal`-Symbol `subTypesOutOfReach` und Methode `TextureResource#[subTypesOutOfReach](subTypes, scope: 'type' | 'now')` · `DynamicAtlas#add()`/`redraw()` lehnen `HTMLImageElement` mit `complete === false` ab

### [x] 4. Sprites, Stage, Vertex-Pools: Besitz von GPU-Ressourcen und Feature-Kombinationen
- Findings: RES-001 (medium), BUG-004 (medium), BUG-005 (medium), RES-002 (medium), TEST-005 (medium), BUG-010 (medium)
- Detail: docs/remediation/paket-4.md
- Ziel: `FeatureSprites` released nur, was es selbst gebaut hat, `NineSlice` lehnt Segment-Placement laut ab, `PaletteSwap` vergleicht im Farbraum der Texturdaten, der `StageRenderer` gibt Pass-Targets beim Verlassen des Composed-Modus frei und ist gegen Pixel-Ratio-Wechsel getestet, und `VertexObjectPool` übersteht Ping-Pong-Adoption.
- Bereich: `packages/twopoint5d/src/sprites/`, `packages/twopoint5d/src/stage/`, `packages/twopoint5d/src/vertex-objects/`, `packages/twopoint5d-testing/test/`, `docs/sprites.md`
- Hängt ab von: —
- Hash: fd3f7540
- Ergebnis: 1 Runde · RES-001, BUG-004, BUG-005, RES-002, TEST-005, BUG-010 behoben (Reviewer-Urteil in der Paketdatei) · Regressionstests vor dem Fix rot: vier zu `FeatureSprites` (u. a. `a material put into the slot stays the caller's: dispose() releases the material the sprites built and leaves the other alone`, `a full pool does not grow a geometry put into the slot: …`), zwei in `NineSlice.spec.ts` (`defineSprite() refuses NineSlice next to each form of segmentPlacement(), naming the alternative`, `a segment placement cannot stand in for the placement of a live NineSlice material`), `the context answers the color space of a texture …` (`FeatureSpritesMaterial.spec.ts`) und der Browser-Test `compares sRGB textures in their 8-bit values: …` (`sprites-palette-swap.test.js`), fünf in `StageRenderer.spec.ts` (`releases the pass target of a nested renderer once on leaving the composed mode through …` ×3, `releases the pass node memory of a Stage2D …`, `remove() of a Stage2D …`) und `releasePassNodeMemory() releases the render target …` (`Stage2D.spec.ts`), `a source pool used again gives the replacement of its onCreateVO hook its own slot` (`VertexObjectPool.adoptVOs.spec.ts`) · Pixel-Ratio-Tests per Mutationsprobe rot (3) · Ping-Pong-Spec erst nach dem Fix gelaufen (vorher Endlosschleife) · Runde 1: Migration Guide und `### Changed` zu `colorSpace`, Proposal und TSDoc von `StageRenderer#dispose()` nachgezogen · klein: zwei in der Paketdatei
- Nebenbefunde: → Queue (zwei: einer low → Audit, einer medium → Scope)
- Folgen: —
- Schnittstellen: `SpriteFrameContext#colorSpace(name: string): string | undefined` neu und **pflichtig** (öffentliches Interface; wer einen Stage-Kontext selbst baut, ergänzt es, `stubShaderContext()` in `src/testing/spriteGraph.ts` antwortet `undefined`) · `Stage2D#releasePassNodeMemory(): void` neu, öffentlich · `StageRenderer#remove()`/`dispose()` und das Verlassen des Composed-Modus geben Pass-Targets verschachtelter Renderer und den Pass-Node-Speicher jedes `Stage2D` frei · `FeatureSprites`: API (`placement`, `uniforms`, `setUniform()`, `bindUniform()`, `get/set/touchTexture()`, `update()`) spricht das gebaute bzw. übergebene Material an, nicht den Slot; `dispose()` released die gebauten, Slots danach `undefined`; `createSprite()` unter `grow` wirft für eine eingesetzte Geometry · neues internes Modul `src/sprites/features/segmentChecks.ts` mit `isSegmentPlacement(feature)` und `refuseNineSliceOnSegments(kind)` (Regex aus `passes/refuseSegments.ts` dorthin gezogen) · `SegmentPlacement.ts`: `refuseTurns` heißt `checkSegmentKind` · `VertexObjectPool#adoptVOs()` lässt den Quell-Pool nutzbar, Ping-Pong-Adoption trägt

### [x] 5. Texture nachgezogen: gescheiterte Loads melden ihren Fehler, `DynamicAtlas` lehnt nur ab, was sich nicht zeichnen lässt
- Findings: — (Nachtragspaket zu Paket 3, keine Audit-Findings)
- Fundstellen: `packages/twopoint5d/src/texture/TextureStore.ts:631` — `failed()` sendet das `error`-Event vor `settle()`; ein `loadAsync()` aus einem Listener darin löst den gescheiterten Load über `#loadUnderWay` (`:624–625`) als abgelöst ab, und sein Promise rejected mit `AbortError` statt mit dem Ladefehler · `packages/twopoint5d/src/texture/DynamicAtlas.ts:371–375` mit `:444–447` — `add(name, img, size)` ruft `#assertLoaded()` auch mit `size`, das ein geladenes SVG-`<img>` ohne eigene Größe (`naturalWidth` 0 bei `complete` true) als »has not loaded yet« ablehnt · beide low, beide erst mit ac549468 entstanden (`git show 4bf14f2e`: kein `#loadUnderWay`, `#assertLoaded()` nur ohne `size`)
- Einordnung: Symptome — Paket 3 hat die Sequenzierung überlappender Loads und die Ablehnung ungeladener Bilder nicht zu Ende gebracht. Ein Paket für beide: dasselbe verursachende Paket, dasselbe Modul, je eine Stelle; zwei Nachtragspakete kosteten zwei Runner-Zyklen. Hinter Paket 4 einsortiert: unabhängig davon (anderes Modul), und Paket 4 hat seinen Detailplan schon
- Mitgenommen (gleiche Ursache, Zug 0): `DynamicAtlas.ts:297` und `DynamicAtlas.ts:444–447` aus »Offene Befunde« (`#assertLoaded()` liest jede natürliche Größe 0 als »lädt noch«) · neu, vorbestehend, low: `TextureStore.ts:614–615`/`:622–623` — ein `error`-Listener, der das Signal abbricht oder den Store disposed, macht aus dem Ladefehler ein `AbortError` bzw. den Disposed-Fehler (derselbe Ablauf in `git show 4bf14f2e`); derselbe Fix
- Ziel: Ein gescheiterter `TextureStore#loadAsync()` rejected mit seinem Ladefehler, auch wenn ein Listener des `error`-Events einen neuen Load startet, das Signal abbricht oder den Store disposed, und `DynamicAtlas` lehnt nur ab, was sich nicht zeichnen lässt — ein noch ladendes Bild-Element, eine geschlossene `ImageBitmap`, einen Canvas ohne Größe —, während es ein geladenes Bild ohne natürliche Größe in der Größe zeichnet, die `add()` bekommt bzw. die der Frame hat.
- Detail: docs/remediation/paket-5.md
- Bereich: `packages/twopoint5d/src/texture/TextureStore.ts`, `packages/twopoint5d/src/texture/DynamicAtlas.ts`, ihre Specs, `packages/twopoint5d-testing/test/texture-dynamic-atlas.test.js`, `packages/twopoint5d/docs/sprites.md` (TextureStore und »Atlases built at run time: `DynamicAtlas`«), `packages/twopoint5d/CHANGELOG.md`
- Hängt ab von: —
- Folge von: Paket 3
- Hash: 0e133345
- Ergebnis: 1 Runde · beide Folgen aus Paket 3 und die drei mitgenommenen Fundstellen behoben (Reviewer-Urteil in der Paketdatei) · Regressionstests vor dem Fix rot: fünf in `TextureStore.spec.ts` (`an error listener that starts another loadAsync() on %s leaves the failed load rejecting with its failure, …` ×3, `an error listener that aborts the signal leaves the rejection to the failure it was told about`, `an error listener that disposes the store …`), fünf in `DynamicAtlas.spec.ts` (u. a. `draws an image element that has loaded without a natural size at the size given`, `… at the size of the frame`, `refuses a closed ImageBitmap or a canvas of no size, …` ×2) · Browser-Probe: ein SVG ohne `width`/`height` meldet in Chromium 150, in Firefox 300 als `naturalWidth`, nicht 0 — der Zweig »geladen ohne natürliche Größe« ist nur über den Vitest-Fake belegt; ein kaputtes PNG wirft in beiden `InvalidStateError` · Runde 1: Proposal `docs/proposals/dynamic-atlas-and-bitmap-text.md` §3.2/§3.6 nachgezogen, zwei Umbrüche · klein: drei in der Paketdatei
- Nebenbefunde: —
- Folgen: —
- Schnittstellen: Signaturen unverändert · `TextureStore#loadAsync()`: ein Load, dessen Fetch, Status oder Body scheitert, ist vor dem `error`-Event abgeschlossen; ein `loadAsync()`, `abort()` oder `dispose()` aus einem `error`-Listener ändert die Rejection nicht · `DynamicAtlas#add()`/`redraw()`: abgelehnt werden nur Bild-Elemente mit `complete === false` und `ImageBitmap`/Canvas mit Breite oder Höhe 0 (neue Meldung `… is W × H — a closed ImageBitmap or a canvas of no size has nothing to draw`); `add()` ohne `size` für ein Bild-Element ohne natürliche Größe wirft `… has no natural size — …`; privates `#assertLoaded()` ersetzt durch `#assertDrawable()` und `#naturalSize()`

### [x] 6. FeatureSprites: Sprite-API und Pass-Meshes arbeiten auf derselben Geometry
- Nebenbefund: `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts` (`createSprite()`, `freeSprite()`, `sortBy()`, `spritePool`) — nach `sprites.geometry = other` schreiben die Sprite-Methoden in die eingesetzte Geometry, die Pass-Meshes zeichnen die gebaute (medium, aus Paket 4) · mitgenommen, gleiche Ursache: `FeatureSprites.ts:368` — `#warnFull()` rät bei einer eingesetzten, vollen Geometry zu einer größeren Kapazität von `FeatureSprites` (low, aus Paket 4)
- Ziel: Nach einem Tausch des `geometry`-Slots zeichnen Mesh und Pässe dieselben Sprites, die `createSprite()`/`freeSprite()`/`sortBy()`/`spritePool` verwalten — analog zur Entscheidung für den `material`-Slot, ob über Nachziehen der Pass-Meshes oder über eine Sprite-API, die konsequent die gebaute bzw. übergebene Geometry anspricht —, und die Meldung einer vollen Geometry nennt die Geometry, die tatsächlich voll ist.
- Detail: docs/remediation/paket-6.md
- Weg (Zug 0): die Pass-Meshes ziehen dem `geometry`-Slot nach, der Slot ist die Geometry der Sprites — die Sprite-API liest ihn schon, `SpritePicker` folgt ihm schon; eine API auf der gebauten Geometry ließe das Mesh selbst andere Sprites zeichnen
- Bereich: `packages/twopoint5d/src/sprites/FeatureSprites/`, `packages/twopoint5d/src/sprites/SpritePicker.ts` (nur Kommentar), `packages/twopoint5d-testing/test/sprites-grow.test.js`, `packages/twopoint5d/docs/sprites.md`, `packages/twopoint5d/docs/proposals/fade-flash-axis-billboards.md`, `packages/twopoint5d/CHANGELOG.md`
- Hängt ab von: —
- Hash: dbc69f47
- Ergebnis: 0 Runden · beide Nebenbefunde behoben (Reviewer-Urteil in der Paketdatei) · Regressionstests vor dem Fix rot: `every pass mesh draws a geometry put into the slot, and the geometry put back`, `createSprite(), freeSprite(), sortBy() and spritePool work on the pool of the geometry the passes draw`, `names the geometry put into the slot as the one to build larger` und der angepasste `names the geometry handed in as the one to build larger` (`FeatureSprites.spec.ts`), Browser-Test `a geometry put into the slot is drawn by the mesh and by its pass, and the geometry it took the place of by neither` (`sprites-grow.test.js`) · klein: drei in der Paketdatei (zwei Umbrüche, `sortByViewDepth()` ohne eigene Erwartung)
- Nebenbefunde: —
- Folgen: —
- Schnittstellen: Signaturen unverändert · `FeatureSprites#geometry` ist ein Accessor auf der Instanz (per `Object.defineProperty` im Konstruktor, nicht auf dem Prototyp); Schreiben des Slots setzt jedes Pass-Mesh auf dieselbe Geometry · `#grow()` zieht die Pässe nur noch über den Slot nach · Voll-Warnung für eine nicht gebaute Geometry im Slot: `Build the FeatureSpritesGeometry in the geometry slot with a larger capacity — new FeatureSpritesGeometry(kind, {capacity: N})`

