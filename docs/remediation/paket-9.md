# Paket 9 — Rotierte Frames in den Konsumenten: Sprites, TileSprites und Lookbook werten die Diagonalspiegelung aus

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: IMPL-011 (medium, anteilig — die Konsumentenseite; Paket 4 hat Format und Drehung eingelesen, erst mit diesem Paket ist IMPL-011 geschlossen) · dazu der vorbestehende Befund zum Layout des `animsMap` (Schreiber und Leser teilen es nicht), in Zug 0 von Paket 4 diesem Paket zugeschlagen
- Ziel: Jeder Konsument von `TextureCoords` in `src/sprites/`, `src/map2d/` und im Lookbook zeichnet einen Frame mit `FLIP_DIAGONAL` so, wie `TextureCoords` ihn beschreibt — ein rotierter TexturePacker-Frame steht damit aufrecht —, und der Leser des `animsMap` kennt das Layout, das `bakeDataTexture()` schreibt.
- Modell: stärkste Stufe
- Effort: high
- Hängt ab von: Paket 4 (`286f6b56`) — `TextureCoords#getTexCoords()`, `TextureCoords#flipD`, der Lookup-Vertrag unter `FLIP_DIAGONAL` in der Klassen-TSDoc von `TextureCoords`, rotierte Frames aus `TexturePackerJson.parse()` als `FLIP_DIAGONAL | FLIP_VERTICAL`
- Dateien:
  - Bibliothek: `packages/twopoint5d/src/sprites/node-utils.ts`, `src/sprites/TexturedSprites/TexturedSprite.ts`, `src/sprites/TexturedSprites/TexturedSpritesMaterial.ts`, `src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`, `src/texture/FrameBasedAnimations.ts` (nur `BakeTextureOptions`, `getBufferSize`, `renderFloatsBuffer`, `bakeDataTexture()`), `src/map2d/TileSprites/descriptors.ts`, `src/map2d/TileSprites/TileSpritesFactory.ts`, `src/map2d/TileSprites/TileSpritesMaterial.ts`
  - Specs: `src/sprites/node-utils.spec.ts`, `src/sprites/TexturedSprites/TexturedSprites.spec.ts`, `src/sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts`, `src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts`, `src/texture/FrameBasedAnimations.spec.ts`, `src/map2d/TileSprites/TileSpritesFactory.spec.ts`, `src/map2d/TileSprites/TileSpritesMaterial.spec.ts`; dazu jede Spec, die durch das neue Attribut bricht (Attributlisten, `itemSize`, Buffer-Layouts — etwa `TexturedSpritesGeometry.spec.ts`, `TileSpritesGeometry.spec.ts`)
  - Browser-Tests: neu `packages/twopoint5d-testing/test/sprites-rotated-frames.test.js` und `packages/twopoint5d-testing/test/map2d-rotated-tiles.test.js`, erweitert `sprites-animated-material.test.js`, neuer Helfer in `test/helpers/fixtures.js`; dazu jeder Browser-Test, der durch das neue Attribut bricht (etwa `map2d-tile-upload.test.js`, falls er Layout oder Bytezahlen prüft)
  - Lookbook: `apps/lookbook/src/demos/instanced-quads/InstancedQuadsGeometry.ts`, `apps/lookbook/src/demos/instanced-quads/createTexturedQuads.ts`, `apps/lookbook/src/pages/demos/textured-quads.astro`, `textured-quads-from-texture-atlas.astro`, `textured-quads-from-tileset.astro`, `textured-quads-po2image-loader.astro`
  - Doku: `packages/twopoint5d/docs/architecture.md` (Abschnitt `sprites/`), `packages/twopoint5d/CHANGELOG.md` unter `[Unreleased]`
- Vorgehen: siehe Abschnitt »Vorgehen« unten
- Verify: `pnpm run ci`
- Commit (so committet, um den Satz zur `attributeUsage` ergänzt): `fix(sprites,map2d,texture,lookbook): draw a frame with FLIP_DIAGONAL in TexturedSprites, AnimatedSprites and TileSprites as TextureCoords describes it, so that a rotated TexturePacker frame stands upright, through a texFlipDiagonal instance attribute and a flipDiagonal option of colorFromTextureByTexCoords(), let the header texel of an animsMap name how many texels a frame takes and carry the diagonal flip of a frame in its second texel, let texFlipDiagonal take the usage the attributeUsage of a TexturedSpritesGeometry names for texCoords, and read the frames of an animsMap baked with includeTextureSize where bakeDataTexture() writes them`
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · IMPL-011 (Konsumentenseite) unverändert offen, umgeformt: die Fundstellen des Audits `isAtlasJsonResponse.ts:22-24`, `TexturePackerJson.ts:39-41` hat Paket 4 behoben (`TexturePackerJson.ts:67-78` liest `rotated`), offen ist der Lookup in `sprites/node-utils.ts:80-89` und jeder Weg dorthin (`TexturedSprite.ts:53-55,73-83`, `AnimatedSpritesMaterial.ts:84-95`, `FrameBasedAnimations.ts:109-136`, `map2d/TileSprites/descriptors.ts:72-78`, `TileSpritesFactory.ts:65`, `TileSpritesMaterial.ts:91`, Lookbook `createTexturedQuads.ts:9`, `InstancedQuadsGeometry.ts:76-82`, `textured-quads.astro:84,108`, `textured-quads-from-texture-atlas.astro:76`, `textured-quads-from-tileset.astro:101`, `textured-quads-po2image-loader.astro:75`); `git grep` findet außerhalb von `src/texture/` keinen Leser von `FLIP_DIAGONAL`/`flipD` · `animsMap`-Layout unverändert: `FrameBasedAnimations.ts:121,126-133` schreibt mit `includeTextureSize` zwei Texel je Frame, `AnimatedSpritesMaterial.ts:92-95` liest bei `offset + frameIndex` · Folgen: keine offenen (Paket 4: keine neuen, beide Stellen stehen schon hier; Pakete 1 und 2 längst verteilt) · »Offene Befunde«: kein Eintrag derselben Ursache, nichts aufgenommen · Restplan geprüft: keine Änderung
  - 2026-09-26 Zug 1: Implementierer beauftragt (opus, effort high), Brief `paket-9.impl-0.brief.md`, Report nach `paket-9.impl-0.json`
  - 2026-09-26 Zug 2: Report FERTIG (session `69010a0f-2cb8-4c9d-9d6f-d75765cb8886`) · 25 Dateien geändert, 2 neu (`sprites-rotated-frames.test.js`, `map2d-rotated-tiles.test.js`) · 15 Vitest- und 4 Browser-Regressionstests vor dem Fix rot · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-9.verify.log`)
  - 2026-09-26 Zug 3: Reviewer beauftragt (opus, effort high), Diff `paket-9.diff`, Report nach `paket-9.review-0.json`
  - 2026-09-26 Zug 3: Reviewer (session `b496eaca-414b-4ec4-a9f9-612314c90fad`): IMPL-011 Konsumentenseite behoben, animsMap-Layout behoben · 0 kritisch, 1 wichtig (`docs/resource-lifecycle.md:162-176` zitiert `dispose()` von `TexturedSpritesMaterial` ohne `texFlipDiagonalNode`), 1 klein (fehlende Leerzeile `AnimatedSpritesMaterial.spec.ts:161`) · Diff `paket-9.diff`
  - 2026-09-26 Zug 4 Runde 1: offen der wichtige und der kleine Befund → Resume des Implementierers (opus, high), Report nach `paket-9.impl-1.json`
  - 2026-09-26 Zug 4 Runde 1 zurück: FERTIG · `docs/resource-lifecycle.md` (Auszug von `dispose()` zeichengleich mit dem Code), Leerzeile in `AnimatedSpritesMaterial.spec.ts` · Verify des Implementierers exit=0, eigener Lauf folgt nach Runde 2
  - 2026-09-26 Zug 4 Runde 2: offen die vom Implementierer gemeldete Folge `TexturedSpritesGeometry.ts:47-56` (bei `attributeUsage: {dynamic: ['texCoords']}` bleibt `texFlipDiagonal` static, ein späterer Wechsel der Diagonale wird nie hochgeladen; nachgesehen: `VertexAttributeDescriptor.ts:50-54`, `GeometryRoutes.ts` `autoTouch()`) → frischer Implementierer (opus, high), Report nach `paket-9.impl-2.json`
  - 2026-09-26 Zug 4 Runde 2 zurück: FERTIG_MIT_VORBEHALT (CHANGELOG nicht ganz gelesen) · Alias `texCoords: ['texFlipDiagonal']` in `TexturedSpritesGeometry.ts`, TSDoc an `attributeUsage`, Halbsatz im CHANGELOG · Regressionstest `gives texFlipDiagonal the dynamic|stream usage and the buffer of texCoords when attributeUsage names texCoords` vor dem Fix rot (`expected 'static' to be 'dynamic'`) · eigener Verify exit=0 (`paket-9.verify-2.log`) · Reviewer gezielt auf die drei offenen Punkte (opus, high), Diff `paket-9.diff-1`, Report nach `paket-9.review-1.json`
  - 2026-09-26 Zug 4 Runde 2 Review (`paket-9.review-1.json`): alle drei offenen Punkte erledigt · 0 kritisch, 0 wichtig, 1 klein · Fortschritt: Runde 1 schloss 2 Befunde, Runde 2 die Folge, nichts kam zurück
  - 2026-09-26 Zug 5: Commit `bb1fdd51` auf `paket-9.verify-2.log` (exit=0, keine Codeänderung seither), 30 Pfade, Commit-Message um den Satz zur `attributeUsage` ergänzt · Plan auf `[x]`, Nebenbefunde (4) in »Offene Befunde«

## Entscheidungen dieses Zugs 0

Der freigegebene Weg (Plan, »Entscheidungen«, TexturePacker-Atlas): `TextureCoords`
trägt die Drehung, die Konsumenten ziehen mit. Wie sie mitziehen, ist hier
entschieden; keine dieser Wahlen kehrt eine Zeile aus »Entscheidungen« um.

1. **Ein Instanzwert mehr statt eines neuen Formats für `texCoords`.** Unter
   `FLIP_DIAGONAL` vertauscht der Lookup seine beiden Komponenten; das ist in
   `texCoords.xy + uv * texCoords.zw` nicht ausdrückbar, und die Vorzeichen von
   `u` und `v` tragen schon die horizontale und vertikale Spiegelung. Jeder
   Konsument bekommt deshalb je Instanz (bzw. je Frame im `animsMap`) einen
   Wert `texFlipDiagonal`: `1` für einen Frame mit `FLIP_DIAGONAL`, sonst `0`.
   Nicht die ganzen Flip-Bits: `FLIP_HORIZONTAL` und `FLIP_VERTICAL` stecken
   schon in `u` und `v`, ein zweiter Ort für sie wäre einer, an dem sie
   auseinanderlaufen können. Verworfen: Kodierung im Vorzeichen oder Offset von
   `s`/`t` (magische Zahlen, Präzisionsverlust), eine vollständige 2×2-Abbildung
   je Instanz (sechs Floats statt fünf, jeder Aufrufer von `setTexCoords()`
   bräche).
2. **`colorFromTextureByTexCoords()` bleibt ohne neue Option unverändert.** Die
   neue Option `flipDiagonal` hat keinen Default auf ein Attribut: ein Default
   `attribute('texFlipDiagonal')` ließe jede bestehende Geometrie ohne dieses
   Attribut bei jedem Shader-Build `AttributeNode: Vertex attribute
   "texFlipDiagonal" not found on geometry.` warnen
   (`three/src/nodes/core/AttributeNode.js`, Zweig ohne Geometrie-Attribut).
   Die Materialien der Bibliothek und das Lookbook reichen den Knoten
   ausdrücklich herein. Die bestehende Spec `attributeNamesOf(...)` →
   `['texCoords', 'uv']` bleibt damit gültig.
3. **Das `animsMap` nennt im Header, wie viele Texel ein Frame belegt.** Der
   Header-Texel einer Animation ist `[frameCount, duration, offset, 0]`; das
   vierte Feld wird `texelsPerFrame`. Ein Frame belegt zwei Texel, wenn
   `includeTextureSize` gesetzt ist **oder** irgendein Frame des Bakes
   `FLIP_DIAGONAL` trägt, sonst einen — für alle Animationen eines Bakes
   gleich. Der zweite Texel ist `[width, height, flipDiagonal, 0]`: `width` und
   `height` stehen wo bisher, das bisher leere `z` trägt die Diagonale. Damit
   bleibt das Layout eines Bakes ohne gedrehten Frame und ohne
   `includeTextureSize` Byte für Byte, was es war (bis auf `w` im Header: `1`
   statt `0`), und der Leser behebt den vorbestehenden Fehler mit
   `offset + frameIndex * texelsPerFrame`. Verworfen: immer zwei Texel je Frame
   (halbiert die Frame-Kapazität von `MaxTextureSize` und ändert jedes
   bestehende Layout), Diagonale im Header (sie gehört dem Frame, ein Atlas
   dreht einzelne Frames).
4. **Der Leser nimmt `max(header.w, 1)`.** Ein von Hand gebautes `animsMap` nach
   dem bisher dokumentierten Layout (`w = 0`) liest weiter einen Texel je
   Frame. Das kostet eine Instruktion und schützt die einzige Form, in der ein
   `animsMap` von außen kommen kann.
5. **`width` und `height` im zweiten Texel bleiben die Maße aus `TextureCoords`**
   (die Fläche im Bild), auch unter `FLIP_DIAGONAL`, wo der Frame `height`
   breit und `width` hoch gezeichnet wird — derselbe Vertrag wie in der TSDoc
   von `TextureCoords`, und kein Leser in der Bibliothek wertet die Größe aus.
6. **Kein neues Lookbook-Asset, keine neue Demo.** Kein Atlas des Lookbooks hat
   einen Frame mit `rotated: true` (`grep '"rotated": *true'
   apps/lookbook/public/assets/*.json` findet nichts). Den Beweis führen die
   Browser-Tests mit Pixelprobe; das Lookbook zieht nur seine eigenen
   Konsumenten nach (die `instanced-quads`-Helfer mit eigenem `NodeMaterial`).
   Die Demos mit `TexturedSprites`, `AnimatedSpritesMaterial` und `TileSprites`
   erben den Fix ohne Änderung.
7. **`TextureCoords` und `TexturePackerJson` bleiben unberührt** — ihr Vertrag
   ist Paket 4. Ebenso `docs/proposals/sprite-features.md`: ein Entwurf, keine
   Beschreibung des Ist-Stands.

## Vorgehen

Code, Kommentare und Doku auf Englisch (`AGENTS.md`). Relative Imports mit
`.js`, Typen mit `import type`. Keine Finding-ID und kein Rückblick auf den
Vorzustand im Code, in Kommentaren, Tests, Testnamen, CHANGELOG
(»Konventionen« im Plan-Kopf).

### 1. Der Lookup — `src/sprites/node-utils.ts`

`colorFromTextureByTexCoords` (heute `:80-89`) bekommt eine dritte Option:

```ts
export const colorFromTextureByTexCoords = (
  colorMap: Texture,
  params?: {texCoords?: Node<'vec4'>; uv?: Node<'vec2'>; flipDiagonal?: Node<'float'>},
) => { … }
```

- `st = add(texCoords.xy, mul(uv.xy, texCoords.zw))` wie bisher.
- Mit `flipDiagonal`: `select(flipDiagonal.greaterThan(0.5), st.yx, st)` (`select`
  aus `three/tsl`), ohne: `st`. Der Tausch steht **innerhalb** des `varying(...)`:
  der Wert ist je Instanz konstant, und der Tausch vor der Interpolation ist
  derselbe wie danach.
- TSDoc an die Funktion (heute hat sie nur Inline-Kommentare): an der
  Quad-Position `uv = (a, b)` liest sie `(s + a·u, t + b·v)`; mit
  `flipDiagonal` über 0,5 vertauscht sie die beiden Komponenten — der Lookup,
  den `TextureCoords` für `FLIP_DIAGONAL` beschreibt. Ohne `flipDiagonal`
  vertauscht sie nichts; wer Frames aus einem Atlas mit gedrehten Frames
  zeichnet, reicht den Wert herein (Entscheidung 2).
- Die beiden Inline-Kommentare im GLSL-Stil (`// vTexCoords = …`,
  `// gl_FragColor = …`) dürfen dem neuen Ausdruck folgen oder weichen; sie
  dürfen nicht stehen bleiben und etwas anderes sagen als der Code.

### 2. `TexturedSprite` — `src/sprites/TexturedSprites/TexturedSprite.ts`

- Interface `TexturedSprite`: neues Feld `texFlipDiagonal: number;` mit TSDoc:
  `1` while the frame on the sprite is drawn with `TextureCoords.FLIP_DIAGONAL`
  (the lookup swaps its two components), `0` otherwise; `setFrame()` writes it
  together with the tex coords, and a caller who writes the tex coords of a
  `TextureCoords` through `setTexCoords()` writes it as well.
- `TexturedSpriteDescriptor.attributes`: direkt nach `texCoords`
  `texFlipDiagonal: {size: 1},` — gleiche Usage wie `texCoords` (keine Angabe),
  denn beide ändern sich zusammen. Ein Attribut der Größe 1 an einer Instanz
  wird von `createVertexObjectPrototype` als Property `texFlipDiagonal`
  angelegt (`src/vertex-objects/createVertexObjectPrototype.ts:141-149`).
- `setFrame(frame)`: nach `this.setTexCoords(frame.coords.getTexCoords(texCoordsScratch));`
  `this.texFlipDiagonal = frame.coords.flipD ? 1 : 0;`
- Neuer Typ neben den übrigen am Dateiende:
  `export type TAttributeNodeTexFlipDiagonal = Node<'float'>;` mit einer Zeile
  TSDoc.

### 3. `TexturedSpritesMaterial` — `src/sprites/TexturedSprites/TexturedSpritesMaterial.ts`

- `static readonly TexFlipDiagonalAttributeName = 'texFlipDiagonal';` neben den
  anderen Namen.
- `#texFlipDiagonalNode = createSignal<TAttributeNodeTexFlipDiagonal | undefined>(undefined, {attach: this});`
- Accessor `texFlipDiagonalNode` (get/set) nach dem Muster von
  `texCoordsNode`, TSDoc: the node the diagonal flip of the frame comes from;
  `undefined` stands for the `texFlipDiagonal` attribute of the geometry, and
  it is what the getter answers once the material has been disposed.
- Color-Effekt (`:173-188`): im Zweig mit `colorMap`
  `colorFromTextureByTexCoords(this.colorMap, {texCoords: this.texCoordsNode, flipDiagonal: this.texFlipDiagonalNode ?? attribute<'float'>(TexturedSpritesMaterial.TexFlipDiagonalAttributeName)})`.
  `texFlipDiagonalNode` nur in diesem Zweig lesen — wie `texCoordsNode`, damit
  ein Write ohne `colorMap` den Effekt nicht auslöst.
- `dispose()`: `this.#texFlipDiagonalNode.set(undefined);` neben
  `this.#texCoordsNode.set(undefined);` (vor `SignalGroup.delete`), die TSDoc
  von `dispose()` nennt `texFlipDiagonalNode` neben `texCoordsNode`.

### 4. `AnimatedSpritesMaterial` — `src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`

Der Effekt `:70-103` liest das Layout aus Entscheidung 3:

- `animMetaData` wie bisher (Header-Texel der Animation).
- `texelsPerFrame = max(animMetaData.w, 1)` (Entscheidung 4, mit einem
  Kommentar, warum `max`).
- Frame-Texel: `animMetaData.z + frameIndex * texelsPerFrame`, `frameIndex`
  wie bisher. Typen (`int`/`float`) so, dass `texCoordsFromIndex` einen `int`
  bekommt.
- `texCoordsNode` = Texel an dieser Stelle.
- `texFlipDiagonalNode` = `select(texelsPerFrame.greaterThan(1.5), <Texel an Stelle + 1>.z, float(0))`.
- Beide Writes in **einem** `batch()` (`@spearwolf/signalize`), damit der
  Color-Effekt der Basisklasse einmal baut und nicht zweimal.
- Zweig ohne Bildmaße: in einem `batch()` `texCoordsNode = vec4(0, 0, 1, 1)`
  und `texFlipDiagonalNode = float(0)`.
- Der Kommentar in `dispose()` (»the own effect goes before the write below …
  through texCoordsNode«) bleibt richtig; prüfen, ob er `texFlipDiagonalNode`
  mitnennen muss.

### 5. Layout des `animsMap` — `src/texture/FrameBasedAnimations.ts`

- `getBufferSize`: Parameter `sizePerTexture` heißt `texelsPerFrame`
  (modulintern).
- `renderFloatsBuffer(floatsBuffer, names, animations, texelsPerFrame: 1 | 2)`
  statt `includeTextureSize`:
  - Header je Animation `[frames.length, duration, offset, texelsPerFrame]`,
    `curOffset += frames.length * texelsPerFrame`.
  - Frames: bei `texelsPerFrame === 2`
    `[...coords.getTexCoords(), coords.width, coords.height, coords.flipD ? 1 : 0, 0]`,
    sonst `coords.getTexCoords()`.
- `bakeDataTexture()`: `texelsPerFrame = includeTextureSize || <irgendein Frame irgendeiner Animation hat flipD> ? 2 : 1`;
  `getBufferSize(this.#animations, texelsPerFrame, FrameBasedAnimations.MaxTextureSize)`.
- TSDoc von `bakeDataTexture()` beschreibt das Layout vollständig — es ist der
  Vertrag zwischen Schreiber und jedem Leser:
  - Texel `0 … n-1`: je Animation (in der Reihenfolge ihrer ids)
    `[frameCount, duration, first frame texel, texelsPerFrame]`.
  - ab Texel `n`: je Frame `texelsPerFrame` Texel — `[s, t, u, v]` wie
    `TextureCoords#getTexCoords()`, und bei zwei Texeln
    `[width, height, flipDiagonal, 0]` (Maße der Fläche im Bild wie
    `TextureCoords` sie hält; `flipDiagonal` 1 für `FLIP_DIAGONAL`, sonst 0).
  - `texelsPerFrame` ist 2, wenn `includeTextureSize` gesetzt ist oder ein
    registrierter Frame `FLIP_DIAGONAL` trägt, sonst 1 — für alle Animationen
    eines Bakes gleich.
- TSDoc an `BakeTextureOptions.includeTextureSize`: ein Satz, dass es den
  zweiten Texel je Frame erzwingt, und dass ein gedrehter Frame ihn ohnehin
  bringt.
- Die Fehlermeldungen von `add()` bleiben, wie sie sind (siehe »Nicht in
  diesem Paket«).

### 6. TileSprites — `src/map2d/TileSprites/`

- `descriptors.ts`: `TileSpriteDescriptor.attributes` nach `texCoords`
  `texFlipDiagonal: {size: 1, usage: 'dynamic', autoTouch: false},` — dieselbe
  Usage und dasselbe `autoTouch` wie `texCoords`, damit beide im selben Buffer
  liegen und `updateTile()`/`createVO()` sie gemeinsam hochladen. Interface
  `TileSprite`: `texFlipDiagonal: number;` mit derselben TSDoc wie unter 2
  (»`TileSpritesFactory#createTile()` writes it together with the tex coords«).
- `TileSpritesFactory.ts` `createTile()`: nach
  `sprite.setTexCoords(texCoords.getTexCoords(texCoordsScratch));`
  `sprite.texFlipDiagonal = texCoords.flipD ? 1 : 0;` — auch `0` ausdrücklich,
  denn ein wiederverwendeter Slot trägt sonst den Wert seines Vorgängers.
- `TileSpritesMaterial.ts`: `static readonly TexFlipDiagonalAttributeName = 'texFlipDiagonal';`;
  Color-Effekt `colorFromTextureByTexCoords(colorMap, {flipDiagonal: attribute<'float'>(TileSpritesMaterial.TexFlipDiagonalAttributeName)})`.

### 7. Lookbook — `apps/lookbook/src/`

- `demos/instanced-quads/InstancedQuadsGeometry.ts`: `InstancedQuad` bekommt
  `texFlipDiagonal: number;`, `InstancedQuadDescriptor.attributes` nach
  `texCoords` `texFlipDiagonal: {size: 1},`. Neuer Export
  `setQuadTexCoords(quad: InstancedQuad, coords: TextureCoords): void` —
  schreibt `coords.getTexCoords(<modulweites Scratch-Tupel>)` über
  `quad.setTexCoords()` und `quad.texFlipDiagonal = coords.flipD ? 1 : 0`
  (`TextureCoords` als `import type` aus `@spearwolf/twopoint5d`).
- `demos/instanced-quads/createTexturedQuads.ts:9`:
  `colorFromTextureByTexCoords(texture, {flipDiagonal: attribute<'float'>('texFlipDiagonal')})`.
- `pages/demos/textured-quads.astro`: `:108` wie `createTexturedQuads.ts`,
  `:84` → `setQuadTexCoords(quad, texCoords)`.
- `textured-quads-from-texture-atlas.astro:76`, `textured-quads-from-tileset.astro:101`,
  `textured-quads-po2image-loader.astro:75` → `setQuadTexCoords(quad, texCoords)`.
- Die Demos **nicht** auf den `TextureStore` umziehen — das ist Paket 6.
  `BouncingSprites.ts:66` geht über `setFrame()` und bleibt unverändert.

### 8. Tests

Bugfix-Paket: zuerst die Regressionstests, rot sehen, dann beheben. Der rote
Lauf gehört in den Report — für die Browser-Tests mit `pnpm test:browser` (Nx
baut die Bibliothek vorher) oder dem Einzelaufruf des Test-Runners in
`packages/twopoint5d-testing`.

Browser-Tests (Pixelprobe, `packages/twopoint5d-testing/test/`), gebaut wie
`sprites-textured-material.test.js`: `Display`, `RenderTarget` 64 × 64,
Orthokamera, `renderToPixels()`, `rgbAt()`, `isNearColor()` aus
`helpers/fixtures.js`.

- **Vergleich statt absoluter Orientierung.** Jeder Test zeichnet dasselbe Bild
  zweimal nebeneinander: einmal als aufrechten Frame, einmal als gedrehten
  Frame über eine im Blatt gedreht abgelegte Kopie. Verglichen werden die
  Farben an den Zellmitten, jeweils relativ zur Mitte des eigenen Sprites.
  Damit hängt der Test nicht davon ab, in welcher Zeilenrichtung ein Backend
  zurückliest. Zusätzlich prüfen: die Farben des aufrechten Sprites sind
  paarweise verschieden (sonst beweist der Vergleich nichts).
- **Neuer Helfer in `helpers/fixtures.js`** (zwei Testdateien brauchen ihn):
  `makeSheetWithTurnedCopy(texels, width, height)` — ein `DataTexture`-Blatt
  (über `makeColorTexture`) von `width + height` × `max(width, height)` Texeln:
  das Bild aufrecht bei `(0, 0)`, rechts daneben bei `(width, 0)` die Kopie, so
  gedreht, wie TexturePacker einen Sprite mit `rotated: true` ablegt (90° im
  Uhrzeigersinn): der Pixel `(px, py)` des Bildes liegt bei
  `(width + height - 1 - py, px)`. Das folgt aus der Spec
  `TexturePackerJson.spec.ts` »the corners of a rotated frame come out of the
  sheet turned back by 90°«: die obere Kante des Sprites liegt in der rechten
  Spalte der Fläche, von oben nach unten. Leere Texel schwarz mit Alpha 0.
  Antwortet `{texture, json}`, wobei `json` ein `TexturePackerJsonData` mit den
  Frames `upright` (`{x: 0, y: 0, w: width, h: height}`) und `turned`
  (`{x: width, y: 0, w: width, h: height}`, `rotated: true` — TexturePacker
  nennt in `w`/`h` die Maße des Sprites, die Fläche im Blatt ist `h` breit und
  `w` hoch) ist, `meta.size` die Maße des Blatts; der Test holt die Frames über
  `TexturePackerJson.parse(json)`. JSDoc wie die übrigen Helfer.
- `sprites-rotated-frames.test.js` (neu), Bild 3 × 2 Texel mit sechs
  verschiedenen Farben — nicht quadratisch, damit eine Verwechslung von
  `width` und `height` auffällt; gezeichnet 3 × 2 Einheiten (bei 8 Pixeln je
  Einheit eine Zelle = 8 × 8 Pixel):
  - `TexturedSprites`: zwei Sprites über `setFrame()` mit dem Frame `upright`
    und dem Frame `turned` — die sechs Zellen stimmen überein.
  - `AnimatedSprites`: zwei Animationen zu je einem Frame (`upright`,
    `turned`), `bakeDataTexture()` ohne Option, zwei Sprites — die sechs
    Zellen stimmen überein.
- `map2d-rotated-tiles.test.js` (neu): `TileSet` über das Blatt aus
  `makeSheetWithTurnedCopy` mit einem quadratischen Bild 2 × 2 (vier Farben),
  `tileWidth`/`tileHeight` 2 — Kachel 1 aufrecht, Kachel 2 die gedrehte Kopie;
  deren Frame bekommt `coords.flip = TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL`
  (`tileSet.atlas.get(tileSet.frameId(2))!.coords`). `TileSprites` mit
  `TileSpritesGeometry` und `TileSpritesMaterial({colorMap})`,
  `TileSpritesFactory` mit `RepeatingTilesProvider([[1, 2]])`, zwei Kacheln
  über `createTile()` an zwei Koordinaten (wie
  `TileSpritesFactory.spec.ts` »a tile carries the size, position and tex
  coords of its coordinate«), `update()`, Kamera von oben auf die XZ-Ebene —
  die vier Zellen beider Kacheln stimmen überein.
- `sprites-animated-material.test.js` (erweitert): ein Fall für das Layout mit
  zwei Texeln je Frame — drei Frames Rot, Grün, Blau über eine Farbkarte von
  drei Texeln, `bakeDataTexture({includeTextureSize: true})`, Zeitpunkt in der
  Mitte des zweiten Frames → Grün. Nicht mit zwei Frames: der fehlgelesene
  Größen-Texel `[1, 1, 0, 0]` zeigt auf die Ecke `(1, 1)` und träfe bei zwei
  Texeln zufällig die erwartete Farbe; mit drei Frames trifft er Blau.

Vitest, jeweils neben der Quelle:

- `node-utils.spec.ts`: mit `flipDiagonal` hängt der Knoten im `uvNode` (im
  `varying`); ohne bleibt es bei `attributeNamesOf(...)` →
  `['texCoords', 'uv']` (bestehender Test bleibt grün).
- `TexturedSprites.spec.ts`: `setFrame()` schreibt `texFlipDiagonal` 1 für
  einen Frame mit `FLIP_DIAGONAL` und 0 für einen aufrechten, auch wenn vorher
  ein gedrehter auf dem Sprite lag.
- `TexturedSpritesMaterial.spec.ts`: der `colorNode` liest das Attribut
  `texFlipDiagonal`, solange kein `texFlipDiagonalNode` gesetzt ist; ein Write
  auf `texFlipDiagonalNode` baut bei gesetzter `colorMap` einen neuen
  `colorNode` und ohne `colorMap` keinen (Muster: die beiden
  `texCoordsNode`-Tests `:154`, `:168`); nach `dispose()` antwortet der Getter
  `undefined`.
- `AnimatedSpritesMaterial.spec.ts`: der `colorNode` liest das Attribut
  `texFlipDiagonal` nicht (der Wert kommt aus dem `animsMap`).
- `FrameBasedAnimations.spec.ts`, `describe('bakeDataTexture')`: `w` des
  Headers ist 1 ohne Option, 2 mit `includeTextureSize`, 2 ohne Option, sobald
  ein Frame `FLIP_DIAGONAL` trägt; der zweite Texel eines Frames ist
  `[width, height, 1, 0]` für einen gedrehten und `[width, height, 0, 0]` für
  einen aufrechten Frame; die Offsets im Header zählen zwei Texel je Frame.
  Die beiden heutigen Tests `bake DataTexture with/without includeTextureSize
  option` prüfen nur, dass eine Textur entsteht — sie bekommen das Layout als
  Assertion oder weichen den neuen.
- `TileSpritesFactory.spec.ts`: `createTile()` schreibt `texFlipDiagonal` aus
  dem Frame; ein Slot, der nach einer gedrehten Kachel eine aufrechte bekommt,
  trägt 0.
- `TileSpritesMaterial.spec.ts`: mit `colorMap` liest der `colorNode` das
  Attribut `texFlipDiagonal`.

Was das neue Attribut an bestehenden Specs und Browser-Tests umwirft
(Attributlisten, `itemSize`, Bytezahlen eines Uploads), wird mitgezogen — das
ist Folge dieser Änderung, kein Nebenbefund.

### 9. Doku

- `packages/twopoint5d/docs/architecture.md`, Abschnitt `sprites/`: ein Satz,
  wie die Orientierung eines Frames in den Shader kommt — `s, t, u, v` tragen
  Lage und die beiden Spiegelungen, die Diagonale reist als `texFlipDiagonal`
  je Instanz bzw. im zweiten Texel eines Frames im `animsMap`.
- `packages/twopoint5d/CHANGELOG.md` unter `[Unreleased]`, mit dem Skill
  `updating-changelog`, ohne Rückblick-Formulierungen:
  - Added: die Option `flipDiagonal` von `colorFromTextureByTexCoords()`; das
    Instanzattribut `texFlipDiagonal` von `TexturedSprite` und `TileSprite`;
    `TexturedSpritesMaterial#texFlipDiagonalNode`,
    `TexturedSpritesMaterial.TexFlipDiagonalAttributeName`,
    `TileSpritesMaterial.TexFlipDiagonalAttributeName`, der Typ
    `TAttributeNodeTexFlipDiagonal`.
  - Changed: `w` des Header-Texels im `animsMap` ist die Zahl der Texel je
    Frame; ein Bake mit einem Frame unter `FLIP_DIAGONAL` legt je Frame zwei
    Texel an, der zweite `[width, height, flipDiagonal, 0]`. Die Instanz-Buffer
    von `TexturedSprites` und `TileSprites` tragen einen Wert mehr: ein
    `toBuffersData()`-Schnappschuss des bisherigen Layouts passt nicht in das
    neue, und eine eigene Klasse, die `TexturedSprite` oder `TileSprite`
    implementiert, braucht das Feld `texFlipDiagonal`.
  - Fixed: `TexturedSprites`, `AnimatedSprites` und `TileSprites` zeichnen
    einen Frame mit `FLIP_DIAGONAL` so, wie `TextureCoords` ihn beschreibt —
    ein rotierter TexturePacker-Frame steht aufrecht; `AnimatedSpritesMaterial`
    liest die Frames eines mit `includeTextureSize` gebackenen `animsMap` dort,
    wo `bakeDataTexture()` sie schreibt.
  - Die Migrationshinweis-Prüfung des Skills für die öffentliche API
    durchlaufen (neues Pflichtfeld für eigene Implementierungen des
    Interfaces).

### Nicht in diesem Paket

- Die Meldungen von `FrameBasedAnimations#add()` ohne Präfix
  (`FrameBasedAnimations.ts:201,271`) — eigener Eintrag in »Offene Befunde«,
  andere Ursache.
- Getrimmte TexturePacker-Frames (`TexturePackerJson.ts`, `spriteSourceSize`) —
  eigener Eintrag in »Offene Befunde«: Lage und Größe des Quads, nicht der
  Lookup.
- `TextureCoords`, `TexturePackerJson`, `isAtlasJsonResponse` — Vertrag aus
  Paket 4.
- Umzug der Lookbook-Demos auf den `TextureStore` — Paket 6.

## Findings im Volltext

**IMPL-011 · medium · packages/twopoint5d/src/texture/isAtlasJsonResponse.ts:22-24** (auch `packages/twopoint5d/src/texture/TexturePackerJson.ts:39-41`) — TexturePacker »JSON Array« und rotierte Frames im Atlas-Guard ablehnen oder unterstützen
Bei `frames` als Array (TexturePacker »JSON Array«, Default in Phaser) besteht jedes Element den Guard. `Object.entries` liefert dann die Namen `"0"`, `"1"` … statt `filename`, und `frame('walk_01.png')` findet nichts. `rotated: true` wird ohne Meldung ignoriert, rotierte Frames werden verzerrt gezeichnet.
Empfehlung: Das Array-Format unterstützen (Name aus `filename`) oder im Guard ablehnen. `rotated === true` ablehnen oder auswerten.
Stand nach Paket 4: Array-Format und `rotated` werden gelesen, ein rotierter Frame ist `TextureCoords(parent, x, y, h, w)` mit `FLIP_DIAGONAL | FLIP_VERTICAL`. Offen ist allein der Satz »rotierte Frames werden verzerrt gezeichnet«: kein Konsument wertet `FLIP_DIAGONAL` aus.

**Vorbestehend, aus Zug 0 von Paket 4 · low · packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:92-95** — Schreiber und Leser des `animsMap` teilen kein Layout
`bakeDataTexture({includeTextureSize: true})` schreibt zwei Texel je Frame (`FrameBasedAnimations.ts:121,126-133`: `[s, t, u, v]`, `[width, height, 0, 0]`, Offsets um zwei je Frame), `AnimatedSpritesMaterial` liest den Frame bei `offset + frameIndex` und trifft ab dem zweiten Frame einen Größen-Texel. Vorbestehend: `fceda80b:…/AnimatedSpritesMaterial.ts:94`, `fceda80b:…/FrameBasedAnimations.ts:110`. Gleiche Ursache wie die Konsumentenseite von IMPL-011: der Leser muss ohnehin erfahren, wo die Diagonale eines Frames steht.

## Urteil des Reviewers

- **IMPL-011 (Konsumentenseite): behoben** — Lookup `src/sprites/node-utils.ts:90-106` (`select(…greaterThan(0.5), st.yx, st)` im `varying`, Zeile 102); `TexturedSprite.ts:24,62,85`; `TexturedSpritesMaterial.ts:33,37,101-107,196-203,233`; `AnimatedSpritesMaterial.ts:96-106,110,115`; `map2d/TileSprites/descriptors.ts:76,98`, `TileSpritesFactory.ts:68`, `TileSpritesMaterial.ts:18,93-95`; Lookbook `InstancedQuadsGeometry.ts` (`setQuadTexCoords()`), `createTexturedQuads.ts:9`, `textured-quads.astro:84,108`, `-from-texture-atlas.astro:77`, `-from-tileset.astro:102`, `-po2image-loader.astro:76`; Beweis über `sprites-rotated-frames.test.js`, `map2d-rotated-tiles.test.js`. Der Reviewer hat den Tausch gegen `computeBounds()` in `TextureCoords.ts` nachgerechnet. Mit Paket 4 ist IMPL-011 geschlossen.
- **Vorbestehend, Layout des `animsMap`: behoben** — Schreiber `FrameBasedAnimations.ts:121,130,365-366`, Vertrag in der TSDoc von `bakeDataTexture()` `:346-358`, Leser `AnimatedSpritesMaterial.ts:96-97`; Regressionstest `sprites-animated-material.test.js:113` (drei Frames).
- Folge der eigenen Änderung, in Runde 2 behoben: `TexturedSpritesGeometry.ts:58-63` (Alias), TSDoc `:29-32`, Test `TexturedSpritesGeometry.spec.ts:94-109`.

## Kleine Befunde

- `TexturedSpritesGeometry.ts:31` — die TSDoc sagt ohne Einschränkung »`texFlipDiagonal` takes the usage named for `texCoords`«; nennt ein Aufrufer `texFlipDiagonal` selbst in einer anderen Liste, entscheidet der Vorrang dynamic > stream > static zwischen eigener Angabe und Alias. Laufzeitverhalten richtig (die sichere Richtung gewinnt).

## Nebenbefunde — Begründung der Urteile

- `FrameBasedAnimations.ts:208` (Frame-Array per Referenz): liegt in `src/texture/`, → Scope.
- `AnimatedSpritesMaterial.ts:90` (Division durch `duration` 0): der Code liegt in `sprites/`, außerhalb der Domain; das gebrochene Versprechen (eine `duration` von 0 ist ein Standbild) gibt `FrameBasedAnimations#add()` in texture. Die Scope-Regel passt nicht eindeutig → Rückfrage.
- `docs/architecture.md:108` (`ShaderMaterial`): Abschnitt `sprites/`, nicht texture → Audit.
- `InstancedQuadsGeometry.ts:22-25` (`x4`/`y4`/`z4`): Typ der Quad-Geometrie im Lookbook, benutzt texture nicht → Audit.
