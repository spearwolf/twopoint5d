# Paket 4 — Sprites, Stage, Vertex-Pools: Besitz von GPU-Ressourcen und Feature-Kombinationen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: RES-001 (medium), BUG-004 (medium), BUG-005 (medium), RES-002 (medium), TEST-005 (medium), BUG-010 (medium)
- Ziel: `FeatureSprites` released nur, was es selbst gebaut hat, `NineSlice` lehnt Segment-Placement laut ab, `PaletteSwap` vergleicht im Farbraum der Texturdaten, der `StageRenderer` gibt Pass-Targets beim Verlassen des Composed-Modus frei und ist gegen Pixel-Ratio-Wechsel getestet, und `VertexObjectPool` übersteht Ping-Pong-Adoption.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts`, `FeatureSprites.spec.ts`, `FeatureSprites.grow.spec.ts`
  - `packages/twopoint5d/src/sprites/SpritePicker.spec.ts`
  - `packages/twopoint5d/src/sprites/features/segmentChecks.ts` (neu), `NineSlice.ts`, `NineSlice.spec.ts`, `SegmentPlacement.ts`
  - `packages/twopoint5d/src/sprites/passes/refuseSegments.ts`
  - `packages/twopoint5d/src/sprites/features/PaletteSwap.ts`, `PaletteSwap.spec.ts`
  - `packages/twopoint5d/src/sprites/SpriteFeature.ts`, `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSpritesMaterial.ts`, `FeatureSpritesMaterial.spec.ts`, `packages/twopoint5d/src/testing/spriteGraph.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.ts`, `StageRenderer.spec.ts`, `Stage2D.ts`, `Stage2D.spec.ts`, `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`, `VertexObjectPool.adoptVOs.spec.ts`, `packages/twopoint5d/src/vertex-objects/README.md`
  - `packages/twopoint5d-testing/test/sprites-palette-swap.test.js`
  - `packages/twopoint5d/docs/sprites.md`, `packages/twopoint5d/docs/resource-lifecycle.md`, `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: siehe Abschnitt »Vorgehen« unten — sechs Teile, je Finding einer, in beliebiger Reihenfolge; jeder Teil mit seinem Regressionstest zuerst (rot sehen, dann beheben), ausgenommen TEST-005 (nur Tests, Mutationsprobe statt rotem Lauf) und der Ping-Pong-Spec aus BUG-010 (läuft erst nach dem Fix, Grund dort).
- Verify: `pnpm run ci` — für die roten Läufe einzeln: `pnpm nx test twopoint5d -- src/<pfad>.spec.ts` (Vitest, aus dem Repo-Root), Browser-Test siehe Teil 3
- Commit: `fix(twopoint5d): FeatureSprites releases only what it built, NineSlice refuses segment placements, PaletteSwap compares in the color space of its palette, StageRenderer frees pass targets on leaving the composed mode, and vertex pools adopt back and forth`
- Verlauf:
  - 2026-10-21 Zug 0: Detailplan steht · RES-001 unverändert (`FeatureSprites.ts:596–600`, `#grow()` 322–336, `SpritePicker.spec.ts:644`) · BUG-004 unverändert (`NineSlice.ts:185–194`, `:203`, `SegmentPlacement.ts:86`); dazu belegt: beim Placement-Tausch läuft nur das `checkKind` der neuen Placement (`FeatureSpritesMaterial.ts:410`) · BUG-005 unverändert (`PaletteSwap.ts:27`, `:80–83`) · RES-002 unverändert (`StageRenderer.ts:677–680`, `:1348`, `Stage2D.ts:395–400`) · TEST-005 unverändert (`StageRendererTargets.ts:148`, `StageRenderer.ts:440–446`) · BUG-010 unverändert (`VertexObjectPool.ts:259`, `:657`) · Folgen aus Paket 3 (`TextureStore.ts:631`, `DynamicAtlas.ts:444–447`) als Symptome eingeordnet → Nachtragspaket 5 · aus »Offene Befunde« nichts übernommen (keine gemeinsame Ursache) · ein Nebenbefund in die Queue (`DynamicAtlas.ts:297`, low → Audit)
  - 2026-10-21 Zug 1: Implementierer beauftragt (Runde 0), opus, Effort high, Session `remediate-twopoint5d-p4-impl-0`, Brief `paket-4.impl-0.brief.md`, Report `paket-4.impl-0.json`
  - 2026-10-21 Zug 2: Report FERTIG_MIT_VORBEHALT (Session bab64267-69b9-4c7f-8625-0b51ad1c7022) · 27 Dateien geändert, neu `src/sprites/features/segmentChecks.ts`, dazu `twopoint5d-testing/test/stage-pipeline.test.js` · Arbeitsbaum schmutzig · rote Läufe Teil 1 (4), 2 (2), 3 (Vitest 1, Browser 1), 4 (6), 6 (1), Mutationsprobe Teil 5 (3 rot) · Verify `pnpm run ci` exit=0 (`paket-4.verify.log`)
  - 2026-10-21 Zug 3: Reviewer beauftragt (Runde 0), opus, Effort high, Diff `paket-4.diff` (28 Dateien, +794/−85), Report `paket-4.review-0.json`
  - 2026-10-21 Zug 3: Reviewer (Session b5b7cdc8-ca1a-4a12-84d7-5ee5d87cc73a): alle sechs Findings behoben · 1 wichtig (`CHANGELOG.md:170`, Migration-Guide-Snippet ohne `colorSpace`), 2 klein · Diff `paket-4.diff`
  - 2026-10-21 Zug 4 Runde 1: offen 1 wichtig (CHANGELOG) + 2 Folgen aus dem Report (`docs/proposals/sprite-features.md:214` ohne `colorSpace`, TSDoc `StageRenderer#dispose()`) → derselbe Implementierer per `--resume bab64267-…`, opus, high, Report `paket-4.impl-1.json`
  - 2026-10-21 Zug 4 Runde 1 zurück: FERTIG · `CHANGELOG.md` (Changed-Eintrag `colorSpace`, Migration-Guide-Snippet), `docs/proposals/sprite-features.md`, TSDoc `StageRenderer#dispose()` · Verify exit=0 (`paket-4.verify-r1.log`) · Reviewer gezielt (sonnet, medium), Diff `paket-4.r1.diff`, Report `paket-4.review-1.json`
  - 2026-10-21 Zug 4 Runde 1 Review (Session e7416196-41cd-4ee1-b187-7f740f55f5c8): alle drei Stellen erledigt, keine neuen Befunde
  - 2026-10-21 Zug 5: committet fd3f7540 (29 Dateien, +810/−89), Verify `paket-4.verify-r1.log` exit=0, Trailer `Remediation-Run: 2026-10-21` · Nebenbefunde → Queue (2)

## Entscheidungen, die dieses Paket binden

Aus »Entscheidungen« im Plan, wörtlich übernommen — der Implementierer liest den Plan nicht:

- PaletteSwap unterstützt `colorSpace: 'srgb'` für `colorMap` und `palette`: der Stage liest den Farbraum aus `textureShapeKey()` und vergleicht im Farbraum der Texturdaten; Docs und Lookbook bleiben, wie sie sind (2026-10-21)
- Der `material`-Slot von `FeatureSprites` bleibt tauschbar. `FeatureSprites` merkt sich das selbst gebaute Material und die selbst gebaute Geometry und released genau diese; ein eingetauschtes Material gehört dem Aufrufer, der es disposed. Steht in `docs/sprites.md` (2026-10-21)
- `NineSlice` neben `segmentPlacement()` wird in `checkKind` laut abgelehnt, mit Fehlermeldung, die die Alternative nennt; festgehalten in `docs/sprites.md` unter »Nine-slice panels« und »Segments« (2026-10-21)
- Ping-Pong-Adoption zwischen `VertexObjectPool`s ist unterstützt, der Quell-Pool bleibt nach `adoptVOs()` nutzbar (2026-10-21)
- Neue öffentliche Symbole landen im `public-api.ts` ihres Moduls; jede für Aufrufer sichtbare Änderung bekommt einen Eintrag im CHANGELOG (2026-10-21)

Für den CHANGELOG gilt das Repo-Skill `updating-changelog` (Abschnitt `## [Unreleased]` in
`packages/twopoint5d/CHANGELOG.md`, Keep a Changelog). Aus früheren Paketen dieses Laufs gibt es
keine Schnittstelle, gegen die dieses Paket kompiliert.

## Vorgehen

### Teil 1 — RES-001: `FeatureSprites` released, was es gebaut hat, und spricht sein eigenes Material an

Ausgangslage: `dispose()` released, was in den three-Slots `this.geometry`/`this.material` steht
(`FeatureSprites.ts:596–600`), `#grow()` lässt den aktuellen Geometry-Slot adoptieren und disposed
ihn (`:322–336`). Jedes Weiterreichen an »das Material« liest `this.material`, also den Slot, während
die Pass-Materialien die gemeinsamen `SpriteResources` des gebauten Materials lesen.

Die Regel, die dieses Paket einführt — sie füllt die Entscheidung oben aus:
**`material` und `geometry` sind three's Slots; was darin steht, zeichnet den Mesh. Die API der
Sprites — `placement` (Getter und Setter), `uniforms`, `setUniform()`, `bindUniform()`,
`getTexture()`, `setTexture()`, `touchTexture()`, `update()` — spricht das Material der Sprites an:
das gebaute oder das als `options.material` übergebene, gleich, was gerade im Slot steht. Die Pässe
zeichnen mit ihren eigenen Materialien auf den Resources des gebauten Materials. Ein Material oder
eine Geometry, die der Aufrufer später in einen Slot setzt, gehört dem Aufrufer.**

Warum nicht, wie die Audit-Empfehlung vorschlägt, Pässe und Bindings dem Slot nachziehen: ein
fremdes Material derselben Kind hält nur die Uniforms und Texturen der Kind, nicht die der Pässe
(`shadowLight`, `groundPlane`, …) — die Pass-Materialien lassen sich darauf nicht bauen, und eine
Bindung an einen Pass-Uniform hätte im Slot-Material keinen Knoten. Außerdem hat three's Slot keinen
Setter-Hook. Mit der Regel oben sehen Sprites-Material, Pässe und Bindungen immer dieselben Knoten;
genau die Divergenz, die das Finding beschreibt, verschwindet. Kein Produktionscode tauscht heute
das Material (geprüft: `grep` über `packages/twopoint5d/src` und `apps/lookbook/src`), nur der
Picker-Spec.

1. Felder in `FeatureSprites`:
   - `#ownsGeometry: boolean` ersetzen durch `#builtGeometry: FeatureSpritesGeometry<Api> | undefined`
     — die Geometry, die dieser Mesh gebaut hat (`undefined`, wenn eine übergeben wurde). Im
     Konstruktor `this.#builtGeometry = ownsGeometry ? geometry : undefined` (Werte aus
     `resolveParts()`). `#warnFull()` fragt `this.#builtGeometry !== undefined` statt `#ownsGeometry`.
   - neu `#material: FeatureSpritesMaterial<Api> | undefined` — das Material der Sprites, gebaut oder
     übergeben; im Konstruktor `this.#material = material`. `#ownsMaterial` bleibt mit seiner
     Bedeutung (ob `#material` hier gebaut wurde).
2. Jede Stelle, die heute `this.material` als »das Material der Sprites« liest, liest `this.#material`:
   `get placement`, `set placement`, `get uniforms`, `setUniform()`, `bindUniform()` (die Konstante
   `material` am Anfang), `getTexture()`, `setTexture()`, `touchTexture()` und die Bedingung in
   `update()` (`sources.length > 0 && this.#material != null`). Der Konstruktor nutzt schon die lokale
   Variable `material` und bleibt.
3. `dispose()`: an Stelle von Zeile 596–600
   ```ts
   this.#builtGeometry?.dispose();
   this.#builtGeometry = undefined;
   this.geometry = undefined;

   if (this.#ownsMaterial) this.#material?.dispose();
   this.#material = undefined;
   this.material = undefined;
   ```
   Reihenfolge wie bisher (Pässe, Geometry, Material, dann `#resources`). Was in einem Slot steht und
   nicht gebaut wurde, wird losgelassen (Slot auf `undefined`), nicht disposed.
4. `#grow(capacity)`: vor allem anderen
   `if (old !== this.#builtGeometry) throw new Error(…)` — ein `Error`, gebaut wie der für
   angehängte Pools darunter, Inhalt auf Englisch: der Pool ist voll und kann nicht wachsen, weil im
   `geometry`-Slot nicht die Geometry steht, die die Sprites gebaut haben; `grow` ersetzt nur die
   eigene — die gebaute zurück in den Slot setzen oder die Sprites mit der Kapazität bauen, die sie
   brauchen. Nach dem Umschalten `this.#builtGeometry = grown`; `old.dispose()` bleibt (sie ist dann
   nachweislich die gebaute). Unter `grow` ist `#builtGeometry` immer gesetzt (eine übergebene
   Geometry neben `grow` lehnt `resolveParts()` schon ab).
5. TSDoc in `FeatureSprites.ts`:
   - Klassen-Doc (Zeile 198–205): ein Material oder eine Geometry, die der Aufrufer später in einen
     Slot setzt, bleibt wie eine übergebene beim Aufrufer.
   - `declare material` bekommt einen TSDoc: der Slot, mit dem three den Mesh zeichnet; ein dort
     eingesetztes Material gehört dem Aufrufer (er disposed es); die API der Sprites spricht das
     Material an, mit dem die Sprites gebaut wurden, und die Pässe, gleich, was der Slot hält.
     Am `declare geometry` den Satz zum Slot ergänzen (eine eingesetzte Geometry bleibt beim Aufrufer).
   - `createSprite()`: `@throws` um den neuen Fall aus Schritt 4 ergänzen.
   - `dispose()`: released die gebaute Geometry und das gebaute Material, auch wenn ein anderes
     ihren Slot eingenommen hat; was der Aufrufer eingesetzt hat, bleibt seins, und beide Slots
     antworten danach `undefined`.
6. Doku:
   - `packages/twopoint5d/docs/sprites.md`, Abschnitt »FeatureSprites«, Absatz **Ownership.**
     (bei Zeile 1572): die Regel oben in zwei, drei Sätzen — ein in `material` oder `geometry`
     eingesetztes Objekt gehört dem Aufrufer, `dispose()` released die gebauten auch dann; die API
     der Sprites und die Pässe bleiben beim Material der Sprites; wer ein eingesetztes Material mit
     den Uniforms und Texturen der Sprites zeichnen lassen will, baut es mit
     `resources: sprites.material.resources` vor dem Tausch (so macht es `SpritePicker`).
   - dort im Absatz zu `grow` (»**Refused**«, bei Zeile 1566): der neue Fall aus Schritt 4.
   - Abschnitt »Binding uniforms to the scene graph«, Punkt **A material handed in.** (bei Zeile
     2447): Bindungen schreiben in das Material der Sprites (gebaut oder übergeben), nicht in eines,
     das später in den Slot gesetzt wurde.
   - `packages/twopoint5d/docs/resource-lifecycle.md`, Absatz »A resource replaced while the
     instance lives is released by whoever built it« (Zeile 89): ein Satz, dass `FeatureSprites` die
     gebaute Geometry und das gebaute Material released, auch wenn der Aufrufer ihren Slot neu belegt
     hat, und das Eingesetzte dem Aufrufer bleibt.
7. Tests, rot vor dem Fix:
   - `FeatureSprites.spec.ts`: `a material put into the slot stays the caller's: dispose() releases the material the sprites built and leaves the other alone`
     — Spies auf `dispose` beider Materialien, `sprites.material = other`, `sprites.dispose()`:
     gebautes einmal disposed, `other` nie, `sprites.material` ist danach `undefined`.
   - `FeatureSprites.spec.ts`: `a geometry put into the slot stays the caller's: dispose() releases the geometry the sprites built`
     (ohne `grow`) — Spies auf `dispose` der gebauten Geometry und einer zweiten
     (`new FeatureSpritesGeometry(kind, {capacity: 4})`), `sprites.geometry = other`,
     `sprites.dispose()`: die gebaute einmal disposed, `other` nie, `sprites.geometry` danach `undefined`;
     `other.dispose()` am Testende.
   - `FeatureSprites.spec.ts`: `while another material sits in the slot, setUniform(), setTexture() and a binding reach the material of the sprites and every pass`
     — Sprites mit `passes: [ShadowPass]` (aus `../passes/passPresets.js`, wie im Spec schon
     importiert), ein anderes `FeatureSpritesMaterial` derselben Kind in den Slot, `setUniform()` auf
     einen Uniform der Kind, `setTexture('colorMap', …)` und
     `bindUniform('groundPlane', {type: 'vec4', write: (v) => v.set(0, 1, 0, 2)})` (`groundPlane` ist
     ein `vec4` von `PlanarShadow`, `passes/PlanarShadow.ts:21`), dann `update()`: die Knoten des
     gebauten Materials und des Pass-Materials tragen die Werte und die Textur, das eingesetzte
     Material nicht.
   - `FeatureSprites.grow.spec.ts`: `a full pool does not grow a geometry put into the slot: createSprite() throws and nothing is disposed`
     — Sprites mit `grow: true`, fremde volle Geometry derselben Kind in den Slot, `createSprite()`
     wirft (Meldung nennt beide Auswege), keine der beiden Geometries ist disposed.
   - `SpritePicker.spec.ts:644`: das Zurücktauschen `sprites.material = own;` vor `sprites.dispose()`
     fällt weg — der Test disposed nach dem Tausch, wie RES-001 es verlangt; `other.dispose()`
     bleibt beim Test.
8. CHANGELOG `### Fixed`: `FeatureSprites#dispose()` released die gebaute Geometry und das gebaute
   Material auch nach einem Tausch der Slots und lässt Eingesetztes beim Aufrufer; die API der
   Sprites bleibt beim Material der Sprites und seinen Pässen; `createSprite()` unter `grow` wirft
   für eine eingesetzte Geometry.

### Teil 2 — BUG-004: `NineSlice` neben einer Segment-Placement wird abgelehnt, auf jedem Weg

Ausgangslage: `NineSlice.checkKind` (`NineSlice.ts:185–194`) prüft Basis und `colorMap`, nicht die
Placement. Eine Ablehnung nur dort reicht nicht: tritt eine Placement auf einem lebenden Material
ein, läuft allein das `checkKind` der **neuen** Placement (`FeatureSpritesMaterial.ts:410`) — eine
NineSlice-Kind mit `FlatPlacement` und `SegmentEnd` nähme `material.placement = SegmentPlacement`
also an. Deshalb lehnen beide Seiten ab, über eine gemeinsame Funktion mit einer Meldung.

1. Neues internes Modul `packages/twopoint5d/src/sprites/features/segmentChecks.ts` (nicht in
   `public-api.ts`, TSDoc mit `@internal`):
   - `export const isSegmentPlacement = (feature: {readonly name: string}): boolean` — die Regex
     `/^segmentPlacement(\+|$)/` samt ihrem Kommentar (Namen statt Identität, weil ein Pass mit
     eigener Placement die Placement der Kind als Kopie sieht), aus `passes/refuseSegments.ts`
     hierher verschoben.
   - `export function refuseNineSliceOnSegments(kind: SpriteKindShape): void` — wirft ein `Error`,
     wenn `kind.features` ein Feature mit dem Namen `nineSlice` (der Name von `NineSlice`,
     `NineSlice.ts:129`; als Konstante mit Kommentar, kein Import von `NineSlice.ts`, sonst entsteht
     ein Importzyklus mit `SegmentPlacement.ts`) und eines hält, für das `isSegmentPlacement()` gilt.
     Meldung auf Englisch, sie muss beides enthalten: warum (ein Segment liegt entlang seiner Enden,
     im lokalen Quad liegen nur seine Caps — `NineSlice` setzt den Rand im lokalen Quad, er landete
     mitten im Segment) und die Alternative für einen Balken mit festen Enden: ein Nine-Slice-Panel
     unter `FlatPlacement`, gedreht mit `Rotation` und gestreckt mit `setSize(length, thickness)`,
     oder die Enden als eigene Sprites an beiden Enden eines Segments mit `TextureColor` bzw.
     `RepeatingTextureColor`. Vorschlag:
     `` `"nineSlice" sets its border in the local quad, and a segment of "${segment.name}" holds only its caps there — the border would land inside the segment. For a bar with fixed ends, lay a nine-slice panel with FlatPlacement, turn it with Rotation and stretch it with setSize(length, thickness), or draw the ends as sprites of their own at the ends of the segment` ``
     (`runCheckKind()` stellt `feature "…"` davor).
2. `passes/refuseSegments.ts`: `isSegmentPlacement` aus `../features/segmentChecks.js` importieren,
   die eigene Regex entfällt; Verhalten unverändert.
3. `NineSlice.ts`, `checkKind`: die Signatur nimmt `kind` statt der Destrukturierung, nach den beiden
   vorhandenen Prüfungen `refuseNineSliceOnSegments(kind)`.
4. `SegmentPlacement.ts`, `refuseTurns` (Zeile 24): umbenannt in `checkSegmentKind` (sie lehnt
   jetzt mehr ab als Drehungen; auch in `checkKind: …`, Zeile 80), nimmt `kind`, ruft nach der
   `Rotation`/`Shear`-Prüfung `refuseNineSliceOnSegments(kind)` — deckt den Placement-Tausch auf einem
   lebenden Material und einen Pass, der eine Segment-Placement mitbringt. TSDoc von
   `segmentPlacement()` (»A kind with `Rotation` or `Shear` is refused«) um `NineSlice` ergänzen;
   im TSDoc von `NineSlice` (`NineSlice.ts`, Zeile ~126: »Its `checkKind` refuses a kind on another
   base, and one no feature of which declares the `colorMap`.«) den dritten Fall anhängen: eine Kind
   mit einer Segment-Placement.
5. Doku `packages/twopoint5d/docs/sprites.md`:
   - »Nine-slice panels«, letzter Punkt (`checkKind` refuses …, bei Zeile 788): die Ablehnung neben
     einer Segment-Placement, mit der Meldung im Wortlaut und dem Hinweis, dass sie auch beim
     Placement-Tausch greift.
   - »Segments: ropes, chains, lasers«, nach dem Punkt **No `Rotation`, no `Shear`.**: ein Punkt
     **No `NineSlice`.** mit Grund und Alternative.
6. Tests, rot vor dem Fix, in `packages/twopoint5d/src/sprites/features/NineSlice.spec.ts`:
   - `defineSprite() refuses NineSlice next to each form of segmentPlacement(), naming the alternative`
     — für `SegmentPlacement`, `segmentPlacement({plane: 'xz'})`, `segmentPlacement({facing: 'camera'})`;
     Kind auf `gridBase({columns: 3, rows: 3})` mit `InstancePosition`, `SegmentEnd`, der Form,
     `QuadSize`, `NineSlice`, `AtlasFrame`, `TextureColor`; die Meldung nennt `nineSlice`, `FlatPlacement`
     und `Rotation`.
   - `a segment placement cannot stand in for the placement of a live NineSlice material`
     — Kind mit `FlatPlacement`, `SegmentEnd` und `NineSlice`, `new FeatureSpritesMaterial(kind)`,
     `material.placement = SegmentPlacement` wirft, `material.placement` bleibt `FlatPlacement`.
   - grün als Wache: `the kind the refusal names — NineSlice under FlatPlacement with Rotation — is defined`.
     Fällt diese Wache, stimmt die Alternative in der Meldung nicht: Meldung und Doku auf eine
     Alternative ändern, die definierbar ist, und das im Report als Abweichung nennen.
7. CHANGELOG `### Fixed`: `NineSlice` neben einer Segment-Placement wird von `defineSprite()` und beim
   Placement-Tausch abgelehnt, mit Meldung samt Alternative.

### Teil 3 — BUG-005: `PaletteSwap` vergleicht im Farbraum der Texturdaten

Ausgangslage: Toleranz `1/512` je Kanal (`PaletteSwap.ts:27`), verglichen wird `color.rgb` mit dem
gesampelten Paletteneintrag (`:80–83`). Unter `SRGBColorSpace` liefert der Sampler lineare Werte, in
denen dunkle Nachbarfarben enger als `1/512` liegen.

Weg: der Stage liest den Farbraum der `palette` beim Graphbau und bringt **beide** Seiten in die
8-Bit-Werte der Texturdaten zurück, bevor er vergleicht. Nur die `palette` wird gefragt, nicht die
`colorMap`: die Doku verlangt beide Texturen im selben Farbraum (»both `srgb`, or both none«, bleibt
laut Entscheidung so stehen), die `palette` deklariert `PaletteSwap` selbst, und eine Kind ohne
`colorMap`-Feature bekäme sonst einen neuen Fehler. Der ersetzte Farbwert (`replacement.rgb`) bleibt
der gesampelte, wie bisher.

1. `packages/twopoint5d/src/sprites/SpriteFeature.ts`, `interface SpriteFrameContext`: neues Mitglied
   ```ts
   colorSpace(name: string): string | undefined;
   ```
   TSDoc: der `colorSpace` der Textur `name`, die irgendein Feature des Materials deklariert, so wie
   sie gesetzt ist — `undefined`, solange sie nicht gesetzt ist (bei `needsImage`, bis ihr Bild Maße
   hat). Ein verfolgtes Lesen ihrer Form (`textureShapeKey()` trägt den Farbraum): eine Textur in
   einem anderen Farbraum baut den Graph neu. Der Material wirft, das Feature nennend, für einen Namen,
   den kein Feature deklariert — wie `textureSize()`. Das Interface ist öffentlich (`export *` aus
   `SpriteFeature.js` in `src/sprites/public-api.ts`), also kein neuer Export nötig.
2. `FeatureSpritesMaterial.ts`, `#frameContext()` (neben `textureSize`, Zeile 280): `colorSpace`
   implementieren — dieselbe Prüfung auf ein deklarierendes Feature wie `textureSize` (Meldung:
   `` `${where} reads the color space of the texture "${textureName}", which no feature of these sprites declares` ``),
   dann `this.resources.shapeOf(textureName) === undefined ? undefined : this.resources.peekTexture(textureName)!.colorSpace`
   (das `shapeOf()` ist das verfolgte Lesen; Kommentar dazu).
3. `packages/twopoint5d/src/testing/spriteGraph.ts`, `stubShaderContext()`: `colorSpace: () => undefined`.
4. `PaletteSwap.ts`, Color-Stage: aus dem Kontext `colorSpace` holen;
   `const encoded = colorSpace('palette') === SRGBColorSpace` (`SRGBColorSpace` aus `three/webgpu`);
   eine lokale Hilfe, die für `encoded` `sRGBTransferOETF(rgb)` (aus `three/tsl`, in three 0.186.1
   vorhanden) zurückgibt, sonst `rgb`; einmal auf `color.rgb` vor der Schleife, je Eintrag auf
   `source.rgb`; `distance = abs(sub(colorData, sourceData))`. `TOLERANCE` bleibt `1/512`, der
   Kommentar dazu sagt jetzt: in den 8-Bit-Werten der Texturdaten. Ein Kommentar am Vergleich nennt
   den Grund (sRGB-Texel kommen linear an, dort liegen dunkle Farben enger als 1/512).
   TSDoc von `paletteSwap()` (Zeile 37, »within `1/512` per channel«): im Wert der Texturdaten, unter
   `srgb` werden beide Farben vor dem Vergleich zurückkodiert.
5. Doku `packages/twopoint5d/docs/sprites.md`:
   - Abschnitt »Palette swap and colour cycling« bleibt **wörtlich** stehen (Entscheidung: Docs
     bleiben, wie sie sind — die Aussage »both `srgb`, or both none« wird mit diesem Fix wahr).
   - Abschnitt »Writing a feature«, der Absatz »A stage reads through its context: …« (bei Zeile
     1961): `colorSpace(name)` in einem Satz ergänzen. Das ist neue öffentliche API und gehört nach der
     Konvention »Docs wachsen mit dem Feature« in die Doku; die Entscheidung oben betrifft den
     Palette-Abschnitt.
6. Tests:
   - rot vor dem Fix, Vitest, `FeatureSpritesMaterial.spec.ts`: `the context answers the color space of a texture any feature declares, undefined while it is unset, and builds the graph anew for another color space`
     — ein Test-Feature mit Color-Stage, das `ctx.colorSpace('colorMap')` aufzeichnet; `colorMap`
     mit `SRGBColorSpace` → `'srgb'`; ungesetzt → `undefined`; eine Textur mit `NoColorSpace`
     gesetzt → neuer `colorNode` und `''`; ein Name ohne Deklaration wirft mit dem Feature-Namen.
     Rot vor dem Fix über Typecheck bzw. `TypeError` — das ist der rote Lauf.
   - rot vor dem Fix, Browser, `packages/twopoint5d-testing/test/sprites-palette-swap.test.js`:
     `compares sRGB textures in their 8-bit values: black and a dark grey keep their colour beside close palette entries`
     — `colorMap` aus `makeColorTexture([[0,0,0,255], [5,5,5,255], [25,25,25,255], [28,28,28,255]], 4, 1)`,
     `palette` aus `makeColorTexture([[5,5,5,255], [28,28,28,255], RED, GREEN], 2, 2)`, beide mit
     `colorSpace = SRGBColorSpace` und `NearestFilter`, Kind `Swapped`, `paletteSwap({colors: 2})`
     oder eine Kind mit dieser Form, Sprite auf `paletteRow = 1`. Erwartet: der Texel `5` wird `RED`,
     `28` wird `GREEN`, Schwarz bleibt nahe Schwarz, `25` bleibt dunkelgrau (weder `RED` noch `GREEN`).
     Vor dem Fix wird Schwarz rot (linear 0 gegen 0,0015) und `25` grün (linear 0,0097 gegen 0,0114).
     Läuft wie jede Datei dort unter WebGPU und WebGL 2. Einzeln:
     `pnpm build:twopoint5d && pnpm --dir packages/twopoint5d-testing exec web-test-runner test/sprites-palette-swap.test.js`
     (sonst `pnpm test:browser`).
   - `PaletteSwap.spec.ts` bekommt keinen Graph-Strukturtest: die Unit-Specs dort prüfen die Struktur
     schon, und das Verhalten belegt nur der Browser-Test. Der Spec muss nach dem Fix grün bleiben
     (`stubShaderContext()` antwortet `undefined`, also kein Kodieren).
7. CHANGELOG: `### Added` `SpriteFrameContext#colorSpace(name)`; `### Fixed` `PaletteSwap` vergleicht
   sRGB-Texturen in ihren 8-Bit-Werten.

### Teil 4 — RES-002: Pass-Targets beim Verlassen des Composed-Modus freigeben

Ausgangslage: `#modeInputChanged()` (`StageRenderer.ts:677–680`) gibt nur das interne Target frei,
wenn ein Schreibzugriff Mode C verlässt; `remove()` (`:1344–1353`) gibt nur das Pass-Target eines
Kind-Renderers frei, nicht die `PassNode` eines `Stage2D` (`Stage2D.ts:347–400`).

1. `Stage2D.ts`: neue öffentliche Methode
   ```ts
   releasePassNodeMemory(): void {
     this.#passNode?.renderTarget.dispose();
   }
   ```
   TSDoc: gibt den GPU-Speicher des Render-Targets der Pass-Node frei, die `asPassNode()` gebaut hat
   (Farbe und Tiefe); die Node bleibt, also bleiben jede `texture()`-Node darauf und die Pipeline
   darauf gültig, three.js alloziert beim nächsten Zeichnen der Node neu — sicher auch für einen
   `Stage2D`, den zwei Renderer teilen. Ohne Pass-Node und nach `dispose()` tut sie nichts. Ein
   `StageRenderer` ruft sie, sobald er diesen Stage nicht mehr komponiert. Die Klasse ist schon
   öffentlich; kein neuer Export.
2. `StageRenderer.ts`: private Hilfe
   ```ts
   #releasePassMemoryOf(stage: IStage): void
   ```
   — für `stage instanceof StageRenderer` `stage.#targets.releasePassTarget()`, für einen Stage mit
   `isStage2D === true` `(stage as Stage2D).releasePassNodeMemory()`. Das Modul bleibt ohne
   Laufzeit-Import von `Stage2D` (Typ-Import wie bei `isStage2DWithoutCamera`, Zeile 45–47).
3. `#modeInputChanged(previousMode)`: die neue Mode einmal lesen; die Mode-C-Zeile bleibt; dazu
   `if (previousMode === 'composed' && mode !== 'composed') for (const {stage} of this.#stages) this.#releasePassMemoryOf(stage);`.
   Wege hinaus: `pipeline = undefined`, eine gewöhnliche `RenderPipeline` ohne `buildOutputNode`,
   `buildOutputNode = undefined` unter einer Pipeline, die keine `RootRenderPipeline` ist.
   TSDoc von `#modeInputChanged()` entsprechend.
4. `remove(stage)`: `this.#releasePassMemoryOf(stage)` an die Stelle von
   `stage.#targets.releasePassTarget()` (Zeile 1348), vor den `instanceof`-Block gezogen, sodass ein
   entfernter `Stage2D` ebenso freigibt; die Logik zum Lösen des Parents bleibt. Freigegeben wird
   unabhängig davon, ob dieser Renderer gerade komponiert — wie heute beim Kind-Renderer; ein
   anderer Renderer, der denselben `Stage2D` noch komponiert, alloziert beim nächsten Frame neu.
   TSDoc von `remove()` (Zeile 1312ff.) um den `Stage2D` ergänzen.
5. TSDoc der Setter `pipeline` (Zeile ~540) und `buildOutputNode` (Zeile ~612): ein Schreibzugriff,
   der den Composed-Modus verlässt, gibt den GPU-Speicher der Pass-Targets verschachtelter Renderer
   und der Pass-Nodes der komponierten `Stage2D` frei; die Rückkehr alloziert ihn im nächsten Frame neu.
6. `packages/twopoint5d/src/stage/README.md`, beim Absatz zum Pass-Target eines verschachtelten
   `StageRenderer` (bei Zeile 232) und bei Mode D: dasselbe in zwei Sätzen.
7. Bewusst nicht behandelt: ein Schreibzugriff aus einem Listener **während** des eigenen
   Composed-Draws gibt Targets frei, die derselbe Draw dann neu alloziert. Mode C fängt das über
   `#lent` ab, weil Leihen und Rückgabe dort in einem Aufruf liegen; für Pass-Targets gibt es dieses
   Paar nicht. Kein Aufschub-Mechanismus in diesem Paket.
8. Tests, rot vor dem Fix, in `StageRenderer.spec.ts`, `describe('release of the internal render targets')`
   (Vorlage: `releases the internal target of Mode C once on leaving it through …`, Zeile 2869):
   - je Weg hinaus aus Schritt 3: `releases the pass target of a nested renderer once on leaving the composed mode through ${leave}`
     — Parent mit Kind-`StageRenderer`, `buildOutputNode` + Pipeline-Mock, ein Frame, Spy auf
     `RenderTarget.prototype.dispose`, Weg anwenden: genau ein Aufruf, `thisValue` ist das
     Pass-Target des Kinds; `child.asPassNode()` gibt danach eine Node auf derselben Textur.
   - `releases the pass node memory of a Stage2D it composed on leaving the composed mode`
     — ein Fake-Stage nach dem Muster von `fakeStage()` mit `isStage2D: true`, einer `camera`,
     `asPassNode: vi.fn(() => passNode)` und `releasePassNodeMemory: vi.fn()`: genau ein Aufruf. Der
     echte `Stage2D` wird in `Stage2D.spec.ts` geprüft (dort bauen die Specs Pass-Nodes ohne Renderer,
     `describe('asPassNode (IPassProvider)')`, Zeile 607).
   - `remove() of a Stage2D from a composing renderer releases its pass node memory`.
   - grün als Wache: `releases no pass target on a change between two composing setups`
     (z. B. `buildOutputNode` A → B).
   - `Stage2D.spec.ts`: `releasePassNodeMemory() releases the render target of its pass node and keeps the node`
     — Spy, `thisValue` ist `passNode.renderTarget`, `asPassNode()` danach dieselbe Node; ohne Node
     und nach `dispose()` kein Aufruf.
9. CHANGELOG: `### Added` `Stage2D#releasePassNodeMemory()`; `### Fixed` der `StageRenderer` gibt beim
   Verlassen des Composed-Modus und in `remove()` die Pass-Targets frei.

### Teil 5 — TEST-005: Pixel-Ratio-Wechsel bei gleicher logischer Größe

Kein Bugfix: der Code liest die Ratio in jedem Frame (`StageRendererTargets.ts:52`, `:148`), nur
ungetestet. Kein roter Lauf; stattdessen eine **Mutationsprobe**: nach dem Schreiben der drei Tests
das Lesen der Ratio in `#ensure()` und in `acquireInternalTarget()` vorübergehend auskommentieren
(`#pixelRatio` bleibt dann beim Wert aus `resize()`), die drei Tests rot sehen, die Ausgabe in den
Report, Änderung zurücknehmen.

Tests in `StageRenderer.spec.ts`, neues `describe('a pixel ratio change at the same logical size')`,
Muster der vorhandenen Ratio-Tests (Zeilen 1884, 2040, 2546: `renderer.getPixelRatio.mockReturnValue(…)`):

1. `the own internal target of Mode C follows the ratio in the next frame, the same object`
   — `sr.resize(50, 50)`, Pipeline-Mock, Frame bei Ratio 1 → internes Target 50 × 50;
   `renderer.getPixelRatio.mockReturnValue(1.5)` **ohne** `resize()`; Frame 2 → dasselbe Objekt,
   75 × 75 (`Math.floor(50 * 1.5)`).
2. `a target borrowed from the pool follows the ratio in the next frame, and the pool releases the one of the old size`
   — wie 1, mit `sr.internalTargetPool = new StageRenderTargetPool()`; Frame 2 leiht ein Target
   75 × 75, ein anderes Objekt; das 50 × 50-Target ist disposed (der Pool gibt freie Targets frei,
   die nicht passen, bevor er baut).
3. `the pass target of a nested renderer follows the ratio in the next frame, the same object`
   — Parent komponiert (`buildOutputNode` + Pipeline-Mock) einen Kind-`StageRenderer`, beide 50 × 50;
   Frame bei Ratio 1 → Pass-Target des Kinds 50 × 50; Ratio 1,5 ohne `resize()`; Frame 2 → dasselbe
   Objekt, 75 × 75.

Kein CHANGELOG-Eintrag (nur Tests).

### Teil 6 — BUG-010: `#adoptedBy` ohne Zyklen, der Quell-Pool bleibt nutzbar

Ausgangslage: `adoptVOs()` setzt `source.#adoptedBy = this` und löscht nie (`VertexObjectPool.ts:259`);
`#createVO()` läuft die Kette ab (`:657`). Ping-Pong A→B, B→A schließt sie zum Zyklus, und ein
weiter genutzter Quell-Pool sucht den Slot im Adoptierer.

Weg: das Feld nennt nur noch eine Adoption, die der Hook **dieses** `#createVO()`-Aufrufs gemacht
hat, und ein adoptierender Pool ist niemandes Quelle mehr.

1. `adoptVOs(source)`: vor `source.#adoptedBy = this;` die Zeile `this.#adoptedBy = undefined;` mit
   Kommentar: der Pool, der adoptiert, hält seine Vertex-Objekte jetzt selbst und ist niemandes Quelle
   mehr — damit schließt sich keine Kette von Adoptionen zum Kreis.
2. `#createVO(idx, initialize)`: als erste Zeile `this.#adoptedBy = undefined;` mit Kommentar: das
   Feld nennt nur eine Adoption, die der Hook dieses Aufrufs macht; ein Quell-Pool, der wieder
   ausgibt, gibt einem Ersatzobjekt seinen eigenen Slot. Die Kettenschleife bleibt.
3. Feldkommentar an `#adoptedBy` (Zeile 113–115) auf diese Bedeutung umschreiben.
4. TSDoc von `adoptVOs()` (Absatz »`source` is left empty …«): `source` bleibt nutzbar — ein späteres
   `createVO()` gibt seine eigenen Slots aus, und es kann wieder adoptieren, die Vertex-Objekte dieses
   Pools eingeschlossen, hin und zurück.
5. `packages/twopoint5d/src/vertex-objects/README.md`, »Growing a pool«, Punkt **The old pool**:
   derselbe Satz.
6. Tests in `VertexObjectPool.adoptVOs.spec.ts`:
   - rot vor dem Fix: `a source pool used again gives the replacement of its onCreateVO hook its own slot`
     — `b.adoptVOs(a)`, `a.onCreateVO = (vo) => Object.create(vo)`, `const handed = a.createVO()`,
     `expect(a.getVO(0)).toBe(handed)`; dazu bekommt die Key-Funktion von `a.sortBy()` `handed`.
   - **erst nach dem Fix schreiben und laufen lassen**: `two pools of one capacity adopt each other's vertex objects back and forth, and createVO() with a replacing hook returns`
     — `b.adoptVOs(a); a.adoptVOs(b);`, Hook auf `a`, `createVO()` kehrt zurück und `a.getVO(n)` ist
     der Ersatz; dasselbe in die andere Richtung. Vor dem Fix dreht `#createVO()` synchron in der
     Kette: kein Vitest-Timeout unterbricht das, und ein verwaister Worker unter `timeout` liefe als
     Busy-Loop auf einer Maschine weiter, auf der andere Sessions arbeiten. Kein roter Lauf dieses
     Specs; die Endlosschleife ist im Audit per Probe belegt (Exit 124), den roten Lauf des Pakets für
     BUG-010 liefert der Spec darüber.
   - Die Specs unter `describe('from inside an onCreateVO hook')` und `FeatureSprites.grow.spec.ts`
     (Wachstum aus dem Hook) bleiben grün.
7. CHANGELOG `### Fixed`: ein adoptierter Quell-Pool bleibt nutzbar, zwei Pools können Vertex-Objekte
   hin und zurück adoptieren.

## Findings im Volltext

**RES-001 · medium · packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:599** — Selbst gebautes Material und Geometry merken statt den aktuellen Slot zu releasen
(weitere Stellen: `FeatureSprites.ts:596`, `:323`, `:336`, `SpritePicker.ts:247`)
`FeatureSprites` merkt sich nur die Flags `#ownsMaterial`/`#ownsGeometry`, released in `dispose()` aber das, was gerade in den öffentlich beschreibbaren three-Slots `material`/`geometry` steht. Weist der Caller ein anderes Material zu — ein Szenario, das `SpritePicker#sync()` ausdrücklich unterstützt und testet (»a material swapped on the mesh«) —, dann disposed `dispose()` das Material des Callers, und das selbst gebaute Material samt seinen Signalen, Effects und SpriteResources leakt. Dasselbe gilt für die Geometry: `#grow()` lässt die Sprites des aktuellen Slots adoptieren und disposed ihn. Zusätzlich lesen die Pass-Materialien weiter die alten Resources, während `setUniform()`/`bindUniform()` ins neue Material schreiben. Der Picker-Test umgeht genau das, indem er vor `dispose()` zurücktauscht.
Beleg: `if (this.#ownsMaterial) this.material?.dispose();` — und in SpritePicker.spec.ts:644 `sprites.material = own; sprites.dispose();`
Empfehlung: Das gebaute Material und die gebaute Geometry in privaten Feldern halten und in `dispose()`/`#grow()` genau diese releasen. Außerdem entscheiden, ob der Material-Slot tauschbar sein soll: wenn nicht, `material` als Accessor mit TypeError beim Setzen ausführen (und den Tausch-Pfad im Picker streichen); wenn ja, Pässe und Bindings beim Tausch nachziehen und das in `docs/sprites.md` festhalten. Einen Test ergänzen, der nach einem Tausch ohne Zurücktauschen disposed.
Abweichung (Zug 0): Pässe und Bindings ziehen nicht dem Slot nach, sondern bleiben mit der ganzen API beim Material der Sprites — Grund in Teil 1.

**BUG-004 · medium · packages/twopoint5d/src/sprites/features/NineSlice.ts:197** — NineSlice neben segmentPlacement() ablehnen oder für Segmente rechnen
(weitere Stellen: `NineSlice.ts:203`, `SegmentPlacement.ts:86`)
Eine Kind aus gridBase({columns: 3, rows: 3}), NineSlice und segmentPlacement() wird von defineSprite() angenommen, zeichnet aber falsch. Die Segment-Placement legt einen Vertex über das Basis-Attribut `uv.x` auf das Segment (`along`), die lokale x-Koordinate trägt nur noch die Caps (`QuadSize.width`). Der lokale Stage von NineSlice verschiebt die inneren Gitterlinien aber in der lokalen x-Koordinate und misst den Rand gegen `quadSize.x`, also gegen die Cap-Länge statt gegen die Segmentlänge; der uv-Stage verschiebt die uv-Linien dagegen korrekt auf die Randpixel. Ergebnis: Bei `width = 0` liegen die inneren Linien bei L/3 und 2L/3 des Segments, der Rand der Textur wird über ein Drittel des Segments gestreckt; bei `width > 0` landet die Linie bei `start + L/3 − w/2 + inset·scale` statt `start − w/2 + inset·scale`. Ein Laser oder Balken mit festen Endkappen ist ein naheliegender Anwendungsfall, und weder `NineSlice.checkKind` noch `segmentPlacement().checkKind` (refuseTurns) noch docs/sprites.md erwähnen die Kombination.
Beleg: NineSlice.ts:203 `const border = div(mul(insets, attribute<'float'>('sliceScale')), vec4(size.x, size.y, size.x, size.y))` — SegmentPlacement.ts:86 `along: attribute<'vec2'>('uv').x`
Empfehlung: Kurzfristig in `NineSlice.checkKind` eine Segment-Placement (Namensmuster wie in passes/refuseSegments.ts) mit einer Fehlermeldung ablehnen, die die Alternative nennt, und die Ablehnung in docs/sprites.md unter »Nine-slice panels« und »Segments« festhalten. Soll die Kombination tragen, braucht der Segment-Fall ein verschobenes `along` (z. B. ein Frame-/Varying-Kanal, den NineSlice beschreibt und segmentVertex liest) statt der Basis-uv.
Abweichung (Zug 0): die Ablehnung steht zusätzlich im `checkKind` der Segment-Placement, weil beim Placement-Tausch nur dieses läuft — Grund in Teil 2.

**BUG-005 · medium · packages/twopoint5d/src/sprites/features/PaletteSwap.ts:27** — PaletteSwap-Vergleich im sRGB-Raum statt im linearen Raum ausführen
(weitere Stelle: `PaletteSwap.ts:83`)
Die Toleranz `1/512` pro Kanal ist auf 8-Bit-sRGB-Werte zugeschnitten (»the rounding of 8-bit texels and no more«). docs/sprites.md:977 erlaubt aber ausdrücklich `colorMap` und `palette` »both srgb«, und die Lookbook-Assets laden genau so (apps/lookbook/src/demos/platformer/assets.ts:23, `['nearest', 'srgb']`). Bei sRGB-Texturen liefert der Sampler (WebGPU: `rgba8unorm-srgb`) lineare Werte, und dort liegen benachbarte dunkle Farben weit enger als 1/512: sRGB 0 und 5/255 sind linear 0 und 0,0015, sRGB 25/255 und 28/255 unterscheiden sich linear um ca. 0,0018. Unterhalb von etwa sRGB 77/255 kollidieren schon direkt benachbarte Werte. Folge: eine Sprite-Farbe, die keinem Eintrag gehört (z. B. eine schwarze Outline neben einem fast schwarzen Paletteneintrag), oder ein zweiter, dunklerer Eintrag wird stillschweigend dem ersten passenden Eintrag zugeordnet und getauscht. Die Lookbook-Palette ist zufällig kollisionsfrei (nachgerechnet), Unit-Specs prüfen nur die Graphstruktur, der Browser-Test lädt ohne Farbraum.
Beleg: `const TOLERANCE = 1 / 512;` … `const matches = mul(sub(1, step(TOLERANCE, far)), step(i + 0.5, width));`
Empfehlung: Beide Seiten vor dem Vergleich in den Farbraum der Texturdaten zurückbringen: der Farbraum ist Teil von `textureShapeKey()`, der Stage kann ihn beim Graphbau lesen und für `SRGBColorSpace` `linearToSRGB` (bzw. das passende ColorSpace-Node) auf `color.rgb` und `source.rgb` anwenden. Alternativ in den Docs `colorSpace` none für beide vorschreiben und die Aussage »both srgb« streichen. Einen Browser-Test mit sRGB-Texturen und eng beieinanderliegenden dunklen Einträgen ergänzen.

**RES-002 · medium · packages/twopoint5d/src/stage/StageRenderer.ts:677** — GPU-Speicher der Pass-Targets beim Verlassen des Composed-Modus freigeben
(weitere Stellen: `StageRenderer.ts:1344`, `Stage2D.ts:395`)
`#modeInputChanged()` gibt nur das interne Target frei, wenn ein Schreibzugriff Mode C verlässt (Zeile 679). Verlässt der Renderer dagegen den Composed-Modus (Mode D/E) — `pipeline = undefined`, ein Wechsel auf eine gewöhnliche `RenderPipeline` ohne `buildOutputNode`, oder `buildOutputNode = undefined` unter einer Nicht-Root-Pipeline —, bleibt alles stehen, was das Komponieren alloziert hat: die Pass-Targets der verschachtelten `StageRenderer`-Kinder (`#targets.#pass`, in Device-Pixeln samt Depth) und die `PassNode`-RenderTargets jedes `Stage2D` (Canvas-Drawing-Buffer-Größe, `getOutputBufferType()` = HalfFloat, plus Depth-Texture). Die Kinder werden danach inline gezeichnet, ihre Pass-Targets nie wieder gelesen; die `PassNode` eines `Stage2D` lebt bis `Stage2D#dispose()`, weil `#disposePassNode()` nur bei neuem Scene/Camera-Paar oder im `dispose()` läuft. Dasselbe gilt für ein `Stage2D`, das per `remove()` aus einem komponierenden Renderer genommen wird: `remove()` gibt in Zeile 1348 nur das Pass-Target eines Kind-Renderers frei, nicht die PassNode eines Stage2D. Bei 4K und fünf Stages sind das grob 5 × ~100 MB, die nach dem Moduswechsel ohne Leser im VRAM liegen. Kein unbegrenztes Wachstum, aber eine Asymmetrie zu Mode C, die die README für Mode C ausdrücklich verspricht.
Beleg: `if (previousMode === 'pipeline-only' && this.#renderMode() !== 'pipeline-only') this.#targets.releaseInternalTarget();` — kein Gegenstück für `'composed'`
Empfehlung: In `#modeInputChanged()` beim Verlassen von `'composed'` für jedes Kind `child.#targets.releasePassTarget()` aufrufen. Für `Stage2D` eine öffentliche Methode wie `releasePassNodeMemory()` anbieten, die nur `this.#passNode?.renderTarget.dispose()` ruft (das Objekt bleibt, three.js alloziert beim nächsten Draw neu — sicher auch für einen Stage2D, den zwei Renderer teilen), und sie vom Renderer beim Verlassen des Composed-Modus und in `remove()` aufrufen lassen. Mit einem Test analog zu `releases the internal target of Mode C once on leaving it` absichern.

**TEST-005 · medium · packages/twopoint5d/src/stage/StageRendererTargets.ts:148** — Pixel-Ratio-Wechsel bei gleicher logischer Größe testen
(weitere Stellen: `StageRenderer.ts:440`, `StageRendererTargets.ts:52`)
Ändert der Display nur die Pixel-Ratio (maxPixelRatio, maxPixels, resolutionScale, adaptive Auflösung), sendet er `OnDisplayResize` mit unveränderter `width`/`height`; `StageRenderer#resize()` kehrt dann am Größen-Guard (Zeile 440–446) zurück, und `StageRendererTargets#resize()` läuft nicht. Korrekt dimensioniert werden die Targets nur, weil `#ensure()` und `acquireInternalTarget()` in jedem Frame `renderer.getPixelRatio()` neu lesen. Genau dieser Pfad — der Kern der neuen Display-Anbindung — ist ungetestet: `StageRenderer.spec.ts` setzt `getPixelRatio` nur einmalig vor dem ersten Frame auf 2 (Zeilen 1884, 2040, 2546) und prüft danach nur `resize()` mit neuer logischer Größe. Ein Refactoring, das die Ratio etwa nur noch in `resize()` liest oder den Guard um die Targets erweitert, bliebe grün und würde nach jedem Auflösungsschritt mit falsch großen Targets (unscharf oder abgeschnitten) rendern.
Empfehlung: Je einen Test für das eigene interne Target (Mode C), das Pool-Target und das Pass-Target eines Kind-Renderers: erster Frame bei Ratio 1, dann `getPixelRatio.mockReturnValue(1.5)` ohne `resize()`, zweiter Frame — erwartet werden Device-Größe `floor(w*1.5)` und beim eigenen/Pass-Target dasselbe Objekt; beim Pool die Freigabe des alten Targets.

**BUG-010 · medium · packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:657** — `#adoptedBy` beim erneuten Gebrauch eines Pools zurücksetzen und Zyklen ausschließen
(weitere Stelle: `VertexObjectPool.ts:259`)
`adoptVOs()` setzt `source.#adoptedBy = this` und löscht das Feld nie wieder. `#createVO()` läuft bei einem Ersatzobjekt aus `onCreateVO` die Kette `while (owner.#adoptedBy !== undefined) owner = owner.#adoptedBy` ab. Zwei Folgen, beide per Probe (esbuild-Bundle der Quellen, Node 24) belegt: (1) Adoptieren zwei Pools gleicher Kapazität einander nacheinander (A→B, dann B→A), entsteht ein Zyklus; der nächste `createVO()` mit einem Hook, der ein Ersatzobjekt liefert, hängt in einer Endlosschleife (Probe mit `timeout 5` abgebrochen, Exit 124). (2) Wird ein adoptierter Quell-Pool, der ja leer und lebendig bleibt, weiter benutzt, sucht `#createVO()` den Slot im Adoptierer statt im eigenen Index; das Ersatzobjekt landet nirgends, `getVO(0)` und die Key-Funktion von `sortBy()` bekommen danach das Originalobjekt statt des ausgegebenen Handles.
Beleg: `while (owner.#adoptedBy !== undefined) owner = owner.#adoptedBy;` — Probe: `b.adoptVOs(a); a.adoptVOs(b); a.onCreateVO = (vo) => Object.create(vo); a.createVO()` kehrt nicht zurück; Wiederverwendung: `a.getVO(0) === handedOut` → false
Empfehlung: `#adoptedBy` nur für die Dauer des Hooks auswerten: in `adoptVOs()` beim Ziel `this.#adoptedBy = undefined` setzen und beim Quell-Pool das Feld löschen, sobald er wieder einen Slot ausgibt (`createVO()`/`getVO()`), oder den Besitzer direkt über `VOUtils.getBuffer(vo)` bestimmen statt über die Kette. Einen Spec für Ping-Pong-Adoption und für den wiederverwendeten Quell-Pool ergänzen.

## Reviewer-Urteil

Runde 0 (`paket-4.review-0.json`), bestätigt nach Runde 1 (`paket-4.review-1.json`):

- RES-001: behoben — `FeatureSprites.ts:226`, `:263`, `:339`, `:621–627` — `#builtGeometry` und `#material` halten das Gebaute, `dispose()` und `#grow()` geben genau das frei, `#grow()` wirft bei fremder Geometry im Slot; Specs in `FeatureSprites.spec.ts`, `FeatureSprites.grow.spec.ts`, `SpritePicker.spec.ts:635` ohne Zurücktauschen.
- BUG-004: behoben — `segmentChecks.ts:22`, `NineSlice.ts:197`, `SegmentPlacement.ts:35` — beide `checkKind` lehnen über dieselbe Funktion ab, Meldung nennt die Alternative; Wache für die Alternative grün.
- BUG-005: behoben — `PaletteSwap.ts:75–89`, `FeatureSpritesMaterial.ts:298`, `SpriteFeature.ts:55` — unter `srgb` beide Seiten per `sRGBTransferOETF` zurückkodiert, `colorSpace()` verfolgt über `shapeOf()`; Vitest- und Browser-Test (Texel 0/5/25/28).
- RES-002: behoben — `StageRenderer.ts:691–707`, `:1378`, `Stage2D.ts:402` — Verlassen des Composed-Modus und `remove()` geben Pass-Targets und Pass-Node-Speicher frei; drei Wege in `StageRenderer.spec.ts:2950ff.`, `stage-pipeline.test.js` an die neue Zählung angepasst.
- TEST-005: behoben — `StageRenderer.spec.ts:3017` — eigenes Target, Pool-Target, Pass-Target je Ratio 1 → 1,5 ohne `resize()`; Mutationsprobe laut Implementierer 3 rot.
- BUG-010: behoben — `VertexObjectPool.ts:265`, `:650` — `adoptVOs()` löscht das Feld am Ziel, kein Zyklus möglich; Specs für wiederverwendeten Quell-Pool und Hin-und-zurück (`VertexObjectPool.adoptVOs.spec.ts:165`).

Runde 1 erledigt: `CHANGELOG.md` (Migration-Guide-Snippet mit `colorSpace`, Eintrag unter `### Changed`), `docs/proposals/sprite-features.md:215–216`, TSDoc `StageRenderer#dispose()` (`StageRenderer.ts:1092–1095`).

## Kleine Befunde

- `packages/twopoint5d/src/stage/StageRenderer.ts:706` — `releasePassNodeMemory()` wird allein über das Flag `isStage2D` erkannt; ein Objekt mit Flag ohne Methode (zweite Kopie der Bibliothek, Fake) wirft in `remove()`, `dispose()` und beim Moduswechsel einen `TypeError`. Vorschlag: `releasePassNodeMemory?.()`.
- `packages/twopoint5d/src/sprites/features/PaletteSwap.spec.ts:32` — Graph-Strukturtest gegen den Detailplan ergänzt, weil das Coverage-Gate 100 % Branches für `src/sprites/**` verlangt und der `srgb`-Zweig sonst ungedeckt bliebe; `encodingsOf` hängt an `shaderNode.layout.name` (three-Interna) und kann beim three-Bump ohne fachlichen Grund rot werden. Bewusste Abweichung, bleibt.

## Abweichungen des Implementierers

- `PaletteSwap.spec.ts` mit Graph-Strukturtest (Grund oben).
- `packages/twopoint5d-testing/test/stage-pipeline.test.js` nachgezogen: `sr.dispose()` gibt über `remove()` den Pass-Node-Speicher jetzt schon frei, der Test zählt zwei `dispose()`-Aufrufe.
- `Stage2D#releasePassNodeMemory()` mit `if (this.#disposed) return;`, damit der `OnStageDispose`-Pfad nicht doppelt disposed.
- CHANGELOG mit zwei Einträgen im Migration Guide (`NineSlice` neben `segmentPlacement()`, Material im Slot von `FeatureSprites`) nach dem Skill `updating-changelog`.

## Urteile an den Nebenbefunden

- `#warnFull()`-Ratschlag bei eingesetzter Geometry: falscher Hinweistext ohne Fehlverhalten → low → Audit.
- Sprite-API auf der Slot-Geometry, Pässe auf der gebauten: dieselbe Mesh/Pass-Divergenz, die das Audit beim Material (RES-001) als medium führte, hier für die Geometry; bestand schon vor dem Paket (`git show ac549468:packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts`: `createSprite()` auf `this.geometry`) → medium → Scope, für die Drain-Runde.
