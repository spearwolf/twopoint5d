# Paket 1 — Sprites: getrimmte Frames, Standbild-Animationen und GPU-Tests

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-126 (low, Aufwand L), BUG-125 (low), TEST-042 (medium, nur der Sprites-Anteil)
- Nebenbefund aufgenommen: `TexturedSprite#[voInitialize]()` setzt `texFlipDiagonal` nicht zurück (low, vorbestehend) — dieselbe Ursache wie der Reset, den das neue Attribut `texTrim` braucht; siehe Schritt 2
- Abgetrennt: TEST-049 → Paket 1a (eigener Block im Plan)
- Ziel: Sprites zeichnen getrimmte und stehende Frames richtig, belegt durch Browser-Tests mit Pixelprobe.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - neu: `packages/twopoint5d/src/texture/frameTrimMargins.ts`, `packages/twopoint5d/src/texture/frameTrimMargins.spec.ts`, `packages/twopoint5d-testing/test/sprites-trimmed-frames.test.js`
  - geändert: `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, `packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts`, `packages/twopoint5d/src/texture/TexturePackerJson.ts` (nur TSDoc), `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts`, `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`, `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts`, `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`, die Specs `TexturedSprites.spec.ts`, `TexturedSpritesGeometry.spec.ts`, `TexturedSpritesMaterial.spec.ts`, `AnimatedSpritesMaterial.spec.ts`, `packages/twopoint5d-testing/test/sprites-animated-material.test.js`, `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d/docs/architecture.md`
  - Lookbook: keine Änderung erwartet. Kein Atlas unter `apps/lookbook/public/assets/` ist getrimmt (alle acht JSONs geprüft: 0 Frames mit `trimmed`), keine Demo liest das `animsMap`-Layout selbst, und die Demos mit eigener Geometrie (`instanced-quads`, `textured-quads`) bauen ein eigenes `NodeMaterial`. Meldet `pnpm typecheck` dort etwas, wird es mitgezogen.
- Verify: `pnpm run ci`
- Commit: `fix(sprites,texture): draw a trimmed TexturePacker frame inside the quad of its untrimmed sprite, through the texTrim instance attribute of TexturedSprites and a third texel per frame in the animsMap of FrameBasedAnimations, show the first frame of an animation whose duration is 0, let a sprite from createSprite() start upright and untrimmed whatever its slot held, and cover animOffset, a time past the duration, a second animation and an animsMap of two rows in the browser tests`
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · BUG-126 unverändert (`TexturedSprite.ts:60`, `AnimatedSpritesMaterial.ts:88-99`, `FrameBasedAnimations.ts:371`) · BUG-125 unverändert (`AnimatedSpritesMaterial.ts:90`) · TEST-042 umgeformt: Billboards am verschobenen Mesh gegenstandslos (`packages/twopoint5d-testing/test/sprites-billboard.test.js:66-118`, seit `deeddeea`), Frame-Index-Formel teilweise belegt (`sprites-animated-material.test.js:98-115`), offen: animOffset, Zeit über der Dauer, zweite Animation, `texCoordsFromIndex` mit Zeile > 0 · TEST-049 als Paket 1a abgetrennt · keine `Folgen:` offen (erstes Paket), »Offene Befunde« leer · ein Nebenbefund aufgenommen (`voInitialize`)
  - 2026-09-26 Zug 1: Implementierer beauftragt · Modell opus (stärkste Stufe), Effort high, `--permission-mode bypassPermissions` · Session `remediate-twopoint5d-p1-impl-0` · Report nach `paket-1.impl-0.json`
  - 2026-09-26 Zug 2: Report FERTIG (session `48af9930-7f11-4ff4-aa34-71e924d5c8af`) · 3 neue, 14 geänderte Dateien wie in »Dateien« · rote Läufe belegt: 4 Browser-Tests getrimmte Frames (Chromium+Firefox), Dauer 0 im Browser (Vitest-Fallback 8.4 entfallen), `voInitialize` im Vitest · Abweichung: Frame-Index-`select` mit `int`-Zweigen (WGSL in Firefox) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-1.verify.log`, Cache-Treffer; ohne Cache wiederholt: `paket-1.verify-nocache.log`, exit=0)
  - 2026-09-26 Zug 3: Reviewer beauftragt · opus, Effort high · Diff `paket-1.diff` (17 Dateien, +846/−58) · Report nach `paket-1.review-0.json`
  - 2026-09-26 Zug 3: Urteil: BUG-126, BUG-125, TEST-042 (Sprites), Nebenbefund `voInitialize` behoben · 1 wichtig (`docs/resource-lifecycle.md:173`, Beispiel `dispose()` ohne `#texTrimNode`), 3 klein (CHANGELOG:53 Zeichensalat, TSDoc `bakeDataTexture()` verweist auf internes `frameTrimMargins()`, Einheitsquad-Grenze fehlt an `texTrimNode`/`makeBaseSpriteArgs`) · Diff `paket-1.diff`
  - 2026-09-26 Zug 4 Runde 1: offen 1 wichtig + 3 klein (klein mitgegeben, da die Runde ohnehin läuft) · Resume derselben Session `48af9930…`, opus, high · Report nach `paket-1.impl-1.json`
  - 2026-09-26 Zug 4 Runde 1 zurück: FERTIG · alle vier Befunde bearbeitet, dazu `docs/resource-lifecycle.md` und `AnimatedSprites/AnimatedSpritesGeometry.ts` (TSDoc) neu im Diff · Verify ohne Cache exit=0 (`paket-1.verify-1.log`) · Diff `paket-1.round-1.diff` · Nachreview per Resume des Reviewers, Report nach `paket-1.review-1.json`
  - 2026-09-26 Zug 4 Nachreview: alle vier Befunde erledigt, keine neuen · Fortschritt: 1 wichtig + 3 klein → 0 · Kette endet nach Runde 1
  - 2026-09-26 Zug 5: Commit `324ab4a1` (19 Dateien, +861/−58) · Verify `paket-1.verify-1.log` exit=0 ohne Nx-Cache, Baum seither unverändert · 4 Nebenbefunde in »Offene Befunde« (3 → Scope, 1 → Audit)

## Urteil des Reviewers

Aus `paket-1.review-0.json`, bestätigt in `paket-1.review-1.json` nach Runde 1:

- BUG-126: behoben. `TexturedSprite.ts:93` schreibt die Ränder per `frameTrimMargins()` nach `texTrim`, `TexturedSpritesMaterial.ts:198` verschiebt die Quad-Ecken vor Skalierung und Drehung, `FrameBasedAnimations.ts:142/258/402-403` schreibt das dritte Texel, `AnimatedSpritesMaterial.ts:118` liest es. Belegt durch die vier Pixelproben in `packages/twopoint5d-testing/test/sprites-trimmed-frames.test.js:417-432`, aufrecht und gedreht, jeweils für `TexturedSprites` und `AnimatedSprites`.
- BUG-125: behoben. `AnimatedSpritesMaterial.ts:93-99`: `select` auf `duration > 0`, sonst `int(0)`, und die `ConditionalNode` von three r185 baut daraus einen `if`, die Division läuft nicht. Test `sprites-animated-material.test.js:144`.
- TEST-042 (Sprites-Anteil): behoben. `sprites-animated-material.test.js`: `animOffset` (:154), Zeit über der Dauer (:160), zweite Animation (:170), `texCoordsFromIndex` in Zeile 1 mit Ködern (:184), Dauer 0 (:144).
- Nebenbefund `voInitialize`: behoben. `TexturedSprite.ts:71-72`, Vitest in `TexturedSprites.spec.ts`.
- Kleine Befunde: keine offen. Die drei aus Review 0 (CHANGELOG-Zeichenfolge, TSDoc-Verweis auf internes `frameTrimMargins()`, Grenze des Einheitsquads an `texTrimNode`/`makeBaseSpriteArgs`) hat Runde 1 mitgenommen.

## Urteile an den Nebenbefunden

- `rotation`/`quadSize`/`instancePosition` in `[voInitialize]()`: → Scope. Es ist dieselbe Ursache wie beim aufgenommenen Nebenbefund, betrifft aber ein anderes Attribut. In Zug 4 kam er nicht mehr dazu, weil B keinen neuen Umfang schneidet.
- `AnimatedSprite` ohne `[voInitialize]()`: → Scope. Der Implementierer hat ihn als Folge gemeldet. `git show ead22dd1` zeigt die Klasse aber ohne `voInitialize`, der Fehler ist also vorbestehend.
- Tupel-Labels von `makeBaseSpriteArgs`: → Scope, info. Den Befund hat der Reviewer gemeldet.
- `getBufferSize()`-Literal: → Audit. Die Stelle liegt in `src/texture/` und ist nicht Teil des Trim-Umbaus.

## Abgleich

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| BUG-126 | unverändert | `TexturedSprite#setFrame()` (`TexturedSprite.ts:60-63`) schreibt nur tex coords und `texFlipDiagonal`; `AnimatedSpritesMaterial.ts:88-107` liest je Frame höchstens zwei Texel; `renderFloatsBuffer()` (`FrameBasedAnimations.ts:114-138`) schreibt `[s,t,u,v]` und `[width,height,flipDiagonal,0]`, keinen Versatz. `TexturePackerJson.parse()` hängt die Trim-Daten als `TextureAtlasFrame#data` an (`TexturePackerJson.ts:78-90`), `FrameBasedAnimations#add()` wirft sie im Atlas-Zweig weg (`FrameBasedAnimations.ts:240`: nur `.coords`). |
| BUG-125 | unverändert | `AnimatedSpritesMaterial.ts:90`: `mod(mul(div(add(time, animOffset), animMetaData.y), animMetaData.x), animMetaData.x)` — Division durch die Dauer ohne Wache; `FrameBasedAnimations.ts:297-303` lässt `duration` 0 als Standbild zu. |
| TEST-042 (Sprites) | umgeformt | Billboards an verschobenem, gedrehtem und skaliertem Mesh sowie an verschobenem Elternknoten: belegt in `sprites-billboard.test.js:66-118` → dieser Teil ist gegenstandslos. Frame-Index-Formel: belegt für Zeit 0, Zeit 0,75 bei zwei Frames und die Mitte des zweiten von drei Frames mit `includeTextureSize` (`sprites-animated-material.test.js:98-115`); offen sind `animOffset`, eine Zeit über der Dauer, eine Animation mit `animId` ≠ 0 und die Dauer 0. `texCoordsFromIndex()` (`node-utils.ts:107-115`) läuft in jedem Test nur mit Zeile 0, weil `bakeDataTexture()` immer eine Zeile baut; eine Datentextur mit zwei Zeilen prüft nichts. |
| TEST-049 | abgetrennt | → Paket 1a; der Abgleich (20 Stellen samt Meldungen) steht im Plan unter Paket 1a. |

## Entscheidungen dieses Zugs

Jede Zeile ist entschieden; der Implementierer folgt ihr, statt neu abzuwägen.

1. **Trim als Ränder, nicht als Rechteck.** Das neue Attribut und das dritte Texel tragen `[left, top, right, bottom]`: was der Packer an jeder Seite abgeschnitten hat, als Anteil des ungetrimmten Sprites (`left`/`right` von dessen Breite, `top`/`bottom` von dessen Höhe, `top` von oben gezählt wie `spriteSourceSize.y`). Grund: alle vier 0 heißt »ungetrimmt«. Damit ist ein frischer Buffer, ein Animations-Bake ohne drittes Texel und eine Geometrie, der das Attribut fehlt (TSL setzt dort die Konstante 0 ein), von selbst richtig. Ein Rechteck `[x, y, w, h]` bräuchte `[0, 0, 1, 1]` als Vorgabe und ließe jeden Sprite mit Nullbuffer auf einen Punkt schrumpfen.
2. **Die Ränder kommen aus den beiden Rechtecken, nicht aus `trimmed`.** TexturePacker schreibt `spriteSourceSize` und `sourceSize` für jeden Frame; bei einem ungetrimmten füllt das erste das zweite, die Ränder werden 0. Das Flag sagt nichts, was die Rechtecke nicht schon sagen.
3. **Der Quad wird verschoben, nicht im Fragment maskiert** — so will es die Entscheidung vom 2026-09-26 (»legen den Quad danach«). Verschoben wird jede Ecke um die Differenz zwischen ihrer `uv` auf dem ungetrimmten und auf dem getrimmten Sprite, gemessen im Einheitsquad. Grund für `uv`: sie sagt ohne weitere Daten, welche Ecke ein Vertex ist, und sie bleibt richtig für jeden Versatz, den `makeBaseSpriteArgs` dem Quad gibt (`xOffset`, `yOffset`). Die Grenze: ein Basis-Quad mit einer anderen Seitenlänge als 1 (`makeBaseSpriteArgs` mit `width`/`height` ≠ 0.5) verschiebt die Ecken um das Maß des Einheitsquads. Beide Geometrien bauen den Einheitsquad als Vorgabe, jeder Aufrufer im Repo nutzt ihn, und `TAttributeNodeVertexPosition` nennt ihn schon heute »the unit quad a sprite is drawn from«. Die Grenze steht im TSDoc (Schritt 3), eine Lösung dafür bräuchte die Maße des Basis-Quads im Shader und ist nicht Teil dieses Pakets.
4. **`quadSize` steht für das ungetrimmte Sprite.** `setFrame()` setzt keine Größe, wie bisher; der Aufrufer bemisst ein Sprite mit getrimmten Frames nach `sourceSize`. Das steht im TSDoc von `setFrame()` und im Migration Guide.
5. **Ein Spiegeln, das der Aufrufer selbst an `TextureCoords` setzt (`flipH`, `flipV`), spiegelt nur den Lookup innerhalb des getrimmten Bereichs, nicht seine Lage.** Die Flip-Bits eines gedrehten TexturePacker-Frames (`FLIP_DIAGONAL | FLIP_VERTICAL`) drehen ihn nur zurück; ein `FLIP_VERTICAL` aus dieser Drehung ließe sich von einem eigenen nicht unterscheiden. Die Ränder gelten im aufrechten Sprite, so wie TexturePacker `spriteSourceSize` schreibt. Ein Satz dazu im TSDoc der Ränder.
6. **`frameTrimMargins()` bleibt intern** — kein Eintrag in `src/texture/public-api.ts`. Es wird nur von `TexturedSprite` und `FrameBasedAnimations` gebraucht; die öffentliche Oberfläche wächst um die Attribute und die Knoten, nicht um den Helfer.
7. **Drei Texel je Frame nur, wenn ein registrierter Frame getrimmt ist** (mindestens ein Rand ≠ 0) — analog zu `FLIP_DIAGONAL`, das zwei erzwingt. Ein Bake ohne getrimmten Frame behält sein Layout Bit für Bit. Keine neue Option in `BakeTextureOptions`.
8. **`FrameBasedAnimDef` bleibt, wie es ist.** Die Ränder liegen in einem internen Typ neben den Frames (Schritt 5); das exportierte Interface bekommt kein Feld.
9. **Nebenbefund `voInitialize`.** `createVO()` gibt einen Slot mit dem Inhalt heraus, der vorher darin stand (`VertexObjectPool.ts:128-139`, `freeVO()` kopiert nur nach unten, Zeile 201). `TexturedSprite#[voInitialize]()` setzt nur die Farbe. Ein neues Sprite in einem Slot, dessen letzter Bewohner einen gedrehten Frame trug, kommt mit `texFlipDiagonal` 1 heraus; wer dann nur `setTexCoords()` schreibt, bekommt einen vertauschten Lookup. Das neue `texTrim` hätte denselben Fehler. Beide werden in derselben Zeile auf 0 gesetzt. Vorbestehend: `git show ead22dd1:packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts` zeigt dieselbe `voInitialize`.
10. **Regressionstest zu BUG-125.** Der Browser-Test mit Dauer 0 kommt zuerst. Ob er vor dem Fix rot wird, hängt davon ab, wohin das Backend `NaN` beim Wandeln in `int` bringt. Erwartet, nicht gemessen: Tint in Chromium klemmt die Wandlung und bringt `NaN` an den Rand des Wertebereichs, dann liest der Shader den Header-Texel als Frame, und das Pixel ist falsch. Bleibt er vor dem Fix in beiden Browsern grün, kommt der Vitest aus Schritt 8.4 dazu, und dessen roter Lauf ist der Beleg. Beide Läufe gehören in den Report.
11. **`TileSprites` in `map2d/` bleibt ohne Trim.** `TileSpritesMaterial` erbt nicht von `TexturedSpritesMaterial` (`TileSpritesMaterial.ts:14`), und die Frames eines `TileSet` sind nie getrimmt. Ebenso bleiben die Lookbook-Demos mit eigenem `NodeMaterial` unberührt.
12. **TEST-049 als Paket 1a.** Das Paket berührt ohne TEST-049 schon 17 Dateien; TEST-049 brächte neun Specs in `map2d/` dazu, die mit Sprites nur die Domänengrenze teilen. Der Plan-Hinweis erlaubt die Abtrennung.

## Vorgehen

Vor der ersten Zeile: `AGENTS.md` im Repo-Root lesen, die Skills `using-signalize` (die Material-Effects) und `updating-changelog` (Schritt 10) laden. Die Quellen der Module `sprites/` und `texture/FrameBasedAnimations.ts` ganz lesen, nicht grep-weise. Bugfix-Reihenfolge: zuerst die Tests der Schritte 7 und 8, rot sehen, dann die Schritte 1 bis 6.

### 1. `packages/twopoint5d/src/texture/frameTrimMargins.ts` (neu, intern)

```ts
import type {TextureAtlasFrameData} from './TextureAtlas.js';

/** `[left, top, right, bottom]`, the margins of {@link frameTrimMargins}. */
export type FrameTrimMargins = [left: number, top: number, right: number, bottom: number];

export function frameTrimMargins(
  data: TextureAtlasFrameData | undefined,
  target: FrameTrimMargins = [0, 0, 0, 0],
): FrameTrimMargins;
```

- Liest `data.spriteSourceSize` (`x`, `y`, `w`, `h`) und `data.sourceSize` (`w`, `h`). Sind beide da, jede der sechs Zahlen `typeof === 'number'` und endlich, und `sourceSize.w > 0` sowie `sourceSize.h > 0`, dann schreibt sie in `target`: `x / W`, `y / H`, `(W - x - w) / W`, `(H - y - h) / H` mit `W = sourceSize.w`, `H = sourceSize.h`. Sonst schreibt sie vier Nullen. Antwortet `target`.
- `trimmed` wird nicht gelesen (Entscheidung 2). Keine Klemmung, kein Werfen: die Form prüfen `isAtlasJsonResponse()` und `TexturePackerJson`; ein Frame von Hand ohne die Felder ist ungetrimmt.
- TSDoc auf Englisch: was die vier Werte sind (Anteile des ungetrimmten Sprites, `top` von oben gezählt wie `spriteSourceSize.y`), woher sie kommen, dass ein Frame ohne beide Rechtecke oder mit einer `sourceSize` nicht über 0 vier Nullen bekommt, dass die Ränder im aufrechten Sprite gelten (Entscheidung 5), und dass sie mit `target` nichts allokiert.

### 2. `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts`

- `TexturedSpriteDescriptor.attributes` bekommt nach `texFlipDiagonal`: `texTrim: {components: ['trimLeft', 'trimTop', 'trimRight', 'trimBottom']}`. Der generierte Setter heißt `setTexTrim` (`VertexAttributeDescriptor.ts:91`).
- Interface `TexturedSprite`: die Felder `trimLeft`, `trimTop`, `trimRight`, `trimBottom: number` mit einem gemeinsamen TSDoc am ersten (Anteile des ungetrimmten Sprites, 0 an jeder Seite für einen ungetrimmten Frame; `setFrame()` schreibt sie; sie verschieben die Ecken des Einheitsquads, und ein Basis-Quad anderer Seitenlänge wird um das Maß des Einheitsquads verschoben — Entscheidung 3), dazu die beiden Überladungen `setTexTrim(left: number, top: number, right: number, bottom: number): void` und `setTexTrim(margins: [left: number, top: number, right: number, bottom: number]): void`, wie `setTexCoords` sie hat.
- `[voInitialize]()`: nach `setColorValues(1, 1, 1, 1)` die Zeilen `this.texFlipDiagonal = 0;` und `this.setTexTrim(0, 0, 0, 0);`, mit einem Kommentar zum Warum: der Slot, den `createVO()` herausgibt, trägt die Werte des Sprites, das vorher darin stand, und ein neues Sprite beginnt aufrecht und ungetrimmt.
- `setFrame(frame)`: nach der `texFlipDiagonal`-Zeile `this.setTexTrim(frameTrimMargins(frame.data, trimScratch));`, mit einem modulweiten `const trimScratch: FrameTrimMargins = [0, 0, 0, 0];` neben `texCoordsScratch` (gleicher Kommentar-Grund: der Setter kopiert). Import `frameTrimMargins`, `type FrameTrimMargins` aus `'../../texture/frameTrimMargins.js'`.
- TSDoc an `setFrame()` (bisher keines): schreibt tex coords, diagonalen Flip und Ränder des Frames; der Quad des Sprites — `width`, `height` — steht für das ungetrimmte Sprite, ein getrimmter Frame liegt in dem Teil davon, aus dem der Packer ihn geschnitten hat; ein Sprite mit getrimmten Frames wird nach `sourceSize` bemessen.
- TSDoc an `texFlipDiagonal` ergänzen: ein Sprite aus `createVO()` beginnt mit 0.
- Neuer Typ am Dateiende neben den anderen: `export type TAttributeNodeTexTrim = Node<'vec4'>;` mit einem Satz TSDoc (`[left, top, right, bottom]`, die Ränder eines getrimmten Frames als Anteile des ungetrimmten Sprites).

### 3. `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts`

- `static readonly TexTrimAttributeName = 'texTrim';` neben `TexFlipDiagonalAttributeName`.
- `#texTrimNode = createSignal<TAttributeNodeTexTrim | undefined>(undefined, {attach: this});` mit Getter und Setter `texTrimNode`, TSDoc nach dem Muster von `texFlipDiagonalNode`: der Knoten, aus dem die Ränder des Frames kommen, `[left, top, right, bottom]`; `undefined` steht für das Attribut `texTrim` der Geometrie und ist, was der Getter nach `dispose()` antwortet.
- Position-Effect (`#positionEffect`), vor `rotate(...)`:

  ```ts
  const trim = this.texTrimNode ?? attribute<'vec4'>(TexturedSpritesMaterial.TexTrimAttributeName);
  const uv = attribute<'vec2'>('uv');
  const trimmedUv = add(trim.xy, mul(uv, sub(float(1), add(trim.xy, trim.zw))));
  const shift = sub(trimmedUv, uv);
  const trimmedVertexPosition = add(this.vertexPositionNode, vec3(shift.x, shift.y.negate(), 0));
  const vertexPosition = rotate(mul(trimmedVertexPosition, scale), rotationEulerNode);
  ```

  Kommentar zum Warum: `uv` ist, wo der Vertex auf dem ungetrimmten Sprite liegt, x nach rechts, y nach unten; der getrimmte Frame deckt den Teil zwischen den Rändern, jede Ecke wandert an ihre Ecke dieses Teils; `y` wird negiert, weil die Position nach oben zählt; gemessen im Einheitsquad (Entscheidung 3). Der Trim kommt vor Skalierung und Drehung, damit er sich mit dem Sprite dreht. Imports aus `three/tsl` um `add` und `sub` ergänzen.
- Der Farb-Lookup bleibt unverändert: `uv` läuft über den verkleinerten Quad weiter von 0 bis 1 und bildet damit den getrimmten Bereich auf den getrimmten Quad ab.
- `dispose()`: `this.#texTrimNode.set(undefined);` neben den beiden anderen; das TSDoc von `dispose()` nennt `texTrimNode` bei den Feldern, die danach `undefined` antworten.
- Import `type TAttributeNodeTexTrim` aus `./TexturedSprite.js`.

### 4. `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`

- Alias: `texCoords: ['texFlipDiagonal', 'texTrim']` (Zeile 64); der Kommentar darüber nennt beide: `setFrame()` schreibt tex coords, Flip und Ränder zusammen.
- Der Kommentar an `attributeUsage` (Zeilen 26-28, Liste der gesetzten Aliase) und das TSDoc (Zeilen 29-34) nennen `texTrim` neben `texFlipDiagonal`: beide nehmen die Usage, die für `texCoords` genannt ist, mit derselben Regel, wenn eine Liste sie selbst nennt.

### 5. `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`

- Interner Typ statt des Map-Werts: `type AnimEntry = FrameBasedAnimDef & {trims: FrameTrimMargins[]};` (die Ränder je Frame in der Reihenfolge von `frames`), `type AnimationsMap = Map<AnimName, AnimEntry>;`. `FrameBasedAnimDef` bleibt unverändert (Entscheidung 8).
- `add()`: der Atlas-Zweig nimmt die Frames einmal: `const atlasFrames = frameNames.map((frameName) => atlas.frame(frameName)!);`, dann `frames = atlasFrames.map(({coords}) => coords)` und `trims = atlasFrames.map(({data}) => frameTrimMargins(data))`. Die anderen drei Zweige tragen keine Ränder; hinter den Zweigen `trims ??= frames.map((): FrameTrimMargins => [0, 0, 0, 0])`. Der Kommentar an Zeile 239 zieht mit.
- `#animations.set(name, {id, name, frames, duration, trims})`.
- `bakeDataTexture()`: `const hasTrimmedFrame = … some(({trims}) => trims.some((margins) => margins.some((margin) => margin !== 0)));` und `const texelsPerFrame = hasTrimmedFrame ? 3 : options?.includeTextureSize || hasTurnedFrame ? 2 : 1;` mit einem Kommentar (ein getrimmter Frame braucht das dritte Texel für seine Ränder und bringt das zweite mit).
- `renderFloatsBuffer()`: Parameter `texelsPerFrame: 1 | 2 | 3`; je Frame `[s, t, u, v]`, ab 2 dazu `[width, height, flipDiagonal, 0]`, bei 3 dazu die vier Ränder. Der Header bleibt `[frameCount, duration, offset, texelsPerFrame]`.
- TSDoc von `bakeDataTexture()`: die Layout-Liste um das dritte Texel `[left, top, right, bottom]` (die Ränder, wie `frameTrimMargins` sie beschreibt, 0 für einen ungetrimmten Frame desselben Bakes) und die Regel »`3` when a registered frame is trimmed, else `2` when …, else `1`« erweitern.
- TSDoc von `BakeTextureOptions#includeTextureSize`: ein Bake mit einem getrimmten Frame bringt das zweite Texel ebenfalls ohne die Option.
- TSDoc von `add()`: ein Satz — die Frames aus einem Atlas bringen ihre Ränder aus `spriteSourceSize` und `sourceSize` ihrer Daten mit, Frames aus einem `TileSet` oder einer Liste von `TextureCoords` sind ungetrimmt.

### 6. `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`

- Frame-Index (Zeile 90), BUG-125:

  ```ts
  const frameIndex = select(
    animMetaData.y.greaterThan(0),
    mod(mul(div(add(time, animOffset), animMetaData.y), animMetaData.x), animMetaData.x).floor(),
    float(0),
  ).toInt();
  ```

  Kommentar: eine Dauer von 0 ist ein Standbild, der erste Frame, und die Division durch sie fällt weg.
- Ränder: nach `texFlipDiagonalNode`

  ```ts
  const texTrimNode = select(
    texelsPerFrame.greaterThan(2.5),
    texture(this.animsMap, texCoordsFromIndex(animsMapSize, add(frameTexel, 2).toInt())),
    vec4(0, 0, 0, 0),
  );
  ```

  Kommentar: das dritte Texel eines Frames ist `[left, top, right, bottom]`; ein Frame aus einem oder zwei Texeln ist ungetrimmt.
- Beide `batch()`-Blöcke setzen `this.texTrimNode` mit (neutraler Zweig: `vec4(0, 0, 0, 0)`); der Kommentar am ersten sagt, dass die Effects der Basisklasse — Farbe und Position — je einmal bauen.
- Der Header-Kommentar in Zeile 88 bleibt; der in `dispose()` (Zeilen 148-149) nennt `texTrimNode` und den Position-Effect der Basisklasse mit.

### 7. Browser-Tests `packages/twopoint5d-testing/test/sprites-trimmed-frames.test.js` (neu, BUG-126, vor dem Fix rot)

Aufbau wie `sprites-rotated-frames.test.js`: `describe('sprites — a trimmed TexturePacker frame is drawn where its untrimmed sprite has it')`, `this.timeout(20000)`, `beforeEach`/`afterEach` mit `makeContainer`, `Display`, `RenderTarget(64, 64)`, `disposeDisplay`. Kamera `OrthographicCamera` über 16 Einheiten (`PIXELS_PER_UNIT = 4`, `TARGET_SIZE = 64`), `camera.position.z = 10`. `frustumCulled = false` an jedem Mesh.

Ein Helfer in der Datei, `makeTrimmedSheet()`, baut mit `makeColorTexture(texels, 8, 4)` ein Blatt von 8 × 4 Texeln, alle `[0, 0, 0, 0]` außer:

- Referenz, das ungetrimmte Sprite, 5 × 4 bei `(0, 0)`: `(1, 2)` = RED `[255, 0, 0, 255]`, `(2, 2)` = GREEN `[0, 255, 0, 255]`.
- getrimmt, 2 × 1 bei `(5, 0)`: `(5, 0)` = RED, `(6, 0)` = GREEN.
- getrimmt und gedreht, im Blatt 1 × 2 bei `(7, 0)`, im Uhrzeigersinn wie TexturePacker: `(7, 0)` = RED, `(7, 1)` = GREEN.

und die json:

```js
frames: {
  reference: {frame: {x: 0, y: 0, w: 5, h: 4}},
  trimmed: {frame: {x: 5, y: 0, w: 2, h: 1}, trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}},
  'trimmed-turned': {frame: {x: 7, y: 0, w: 2, h: 1}, rotated: true, trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}},
},
meta: {image: 'sheet.png', size: {w: 8, h: 4}},
```

Die Ränder sind damit `[0.2, 0.5, 0.4, 0.25]` — vier verschiedene Werte, so dass jede Verwechslung zweier Seiten auffällt.

Je Test zwei Sprites, beide `setSize(5, 4)`: die Referenz bei `x = -4`, der Kandidat bei `x = +4`. Geprüft werden die 20 Zellen (5 Spalten × 4 Zeilen) des Kandidaten gegen die der Referenz, jede relativ zur Mitte ihres Sprites gelesen (`dx = column - 2`, `dy = row - 1.5`, Pixel `CENTER + (spriteX + dx) * 4`, `CENTER + dy * 4`), mit `rgbAt` und `isNearColor` — so ist die Zeilenrichtung des Readbacks egal. Dazu eine Probe, dass die Referenz genau zwei Zellen zeigt, die nicht schwarz sind (RED und GREEN), damit ein ganz schwarzes Bild nicht besteht.

- `it('TexturedSprites draws a trimmed frame where its untrimmed sprite has it')` — `TexturedSprites(2, texture)`, `setFrame(atlas.frame('reference'))` und `setFrame(atlas.frame('trimmed'))`.
- `it('TexturedSprites draws a trimmed frame the packer turned where its untrimmed sprite has it')` — der Kandidat `'trimmed-turned'`.
- `it('AnimatedSprites draws the frame of a trimmed animation where its untrimmed sprite has it')` — `FrameBasedAnimations` mit `add('reference', 1, atlas, '^reference$')` und `add('trimmed', 1, atlas, '^trimmed$')`, `bakeDataTexture()`, `AnimatedSpritesGeometry(2)`, `AnimatedSpritesMaterial({colorMap, animsMap, time: 0})`, je Sprite `animId` aus `anims.animId(…)`, `animOffset = 0`.
- `it('AnimatedSprites draws the frame of a trimmed animation the packer turned where its untrimmed sprite has it')` — der Kandidat `add('turned', 1, atlas, '^trimmed-turned$')`; der Bake trägt dann Flip und Ränder.

Aufräumen wie in den Nachbartests: Mesh, Geometrie, Material, Texturen.

### 8. Weitere Tests

1. `packages/twopoint5d/src/texture/frameTrimMargins.spec.ts` (neu): `spriteSourceSize {x: 1, y: 2, w: 2, h: 1}` in `sourceSize {w: 5, h: 4}` → `[0.2, 0.5, 0.4, 0.25]`; ein ungetrimmter TexturePacker-Frame (`spriteSourceSize {x: 0, y: 0, w: 5, h: 4}`) → vier Nullen; ohne `data`, ohne eines der beiden Rechtecke, mit `sourceSize.w` 0, mit einer Zahl `NaN` und mit einem String statt einer Zahl → vier Nullen (`test.each`); `trimmed: false` neben versetzten Rechtecken ergibt die Ränder der Rechtecke; mit `target` schreibt sie hinein und antwortet dasselbe Array.
2. `FrameBasedAnimations.spec.ts`, im `describe('bakeDataTexture')`: ein Bake aus einem Atlas von `TexturePackerJson.parse()` mit einem getrimmten Frame hat im Header `texelsPerFrame` 3 und im dritten Texel des Frames `[0.2, 0.5, 0.4, 0.25]` (`toBeCloseTo`, Float32); ein ungetrimmter Frame im selben Bake hat im dritten Texel vier Nullen und im zweiten `[width, height, flipDiagonal, 0]`; ein Bake ohne getrimmten Frame bleibt bei 1 Texel je Frame bzw. bei 2 mit `FLIP_DIAGONAL`; Frames aus einer `TextureCoords`-Liste und aus einem `TileSet` sind ungetrimmt (kein drittes Texel); die Größe der Textur zählt drei Texel je Frame.
3. `TexturedSprites.spec.ts`, neben dem `texFlipDiagonal`-Test (Zeile 92): `setFrame()` schreibt die Ränder eines getrimmten Frames nach `texTrim` (Felder und Buffer über `readAttribute(sprites.spritePool!, 'texTrim', 0)`) und vier Nullen für einen ungetrimmten Frame danach. Dazu der Nebenbefund, vor dem Fix rot: Sprite A mit einem ungetrimmten, aufrechten Frame, danach Sprite B mit einem gedrehten und getrimmten Frame; `freeSprite(B)`; das nächste `createSprite()` bekommt B's Slot und hat `texFlipDiagonal` 0 und `texTrim` `[0, 0, 0, 0]`.
4. `AnimatedSpritesMaterial.spec.ts`, `describe('node wiring')`: `takes the trim of a frame out of the animsMap, not from the texTrim attribute` nach dem Muster von Zeile 148 (`samples(material.texTrimNode!, animsMap)`, der `positionNode` enthält den Knoten, `attributeNamesOf(material.positionNode!)` enthält `'texTrim'` nicht); der Test aus Zeile 163 zählt drei Knoten und prüft zusätzlich, dass auch der `positionNode` genau einmal geschrieben wird; der Test aus Zeile 293 nennt den neutralen Zweig »no trim« mit und prüft `texTrimNode`. Nur falls der Browser-Test zu BUG-125 (unten) vor dem Fix in beiden Browsern grün bleibt: `the frame index of an animation does not divide by a duration of 0` — der Graph unter `material.texCoordsNode` enthält einen Knoten mit `isConditionalNode === true` (vor dem Fix keinen, danach die Wache), mit rotem Lauf im Report.
5. `TexturedSpritesMaterial.spec.ts`: `reads the trim from the texTrim attribute while no texTrimNode is set` (`attributeNamesOf(material.positionNode!)` enthält `'texTrim'` und `'uv'`, `texTrimNode` ist `undefined`, `TexTrimAttributeName` ist `'texTrim'`); `builds a new positionNode for a texTrimNode write, reading that node`; der `dispose()`-Test um Zeile 273-280 prüft `texTrimNode` mit.
6. `TexturedSpritesGeometry.spec.ts`, der `test.each` an Zeile 95: auch `texTrim` bekommt Usage, `autoTouch` und Buffer von `texCoords`, wenn `attributeUsage` `texCoords` nennt.
7. `packages/twopoint5d-testing/test/sprites-animated-material.test.js` — den Helfer `renderAt()` so verallgemeinern, dass er eine Liste von Animationen (Name, Dauer, Indizes der Texel des Farb-Maps), den Namen der gezeichneten Animation, `animOffset` und statt des Bakes ein fertiges `animsMap` nimmt; die drei vorhandenen Tests bleiben inhaltlich, wie sie sind. Neu:
   - BUG-125, vor dem Fix rot (siehe Entscheidung 10): `it('shows the first frame of an animation whose duration is 0, at the start and later on')` — Texel `[RED, GREEN, BLUE]`, Dauer 0, bei `time` 0 und bei 0,75 jeweils RED.
   - `it('starts a sprite into its animation by its animOffset')` — `[RED, GREEN]`, Dauer 1, `time` 0, `animOffset` 0,75 → GREEN.
   - `it('runs the animation again once its duration has passed')` — `[RED, GREEN]`, Dauer 1: `time` 1,25 → RED, 1,75 → GREEN.
   - `it('reads the header of the second animation from its own texel')` — Farb-Map `[RED, GREEN, BLUE]`, Animation `first` aus den Texeln 0 und 1, `second` aus Texel 2; gezeichnet `second` bei `time` 0 → BLUE.
   - `it('reads a frame out of the second row of an animsMap it is handed')` — `texCoordsFromIndex()` mit Zeile > 0: Farb-Map `[RED, GREEN]`; `new DataTexture(new Float32Array(4 * 2 * 4), 4, 2, RGBAFormat, FloatType)` mit `needsUpdate = true`; Texel 0 = `[1, 1, 6, 1]` (ein Frame, Dauer 1, Frame-Texel 6, ein Texel je Frame); Texel 6 (Spalte 2, Zeile 1) = die tex coords von GREEN, `[0.5, 0, 0.5, 1]`; als Köder Texel 2 (Spalte 2, Zeile 0) und Texel 5 (Spalte 1, Zeile 1) = die tex coords von RED, `[0, 0, 0.5, 1]` — wer die Zeile übergeht oder Spalte und Zeile vertauscht, liest RED. `animId` 0, `time` 0 → GREEN.

### 9. Doku

- `packages/twopoint5d/src/texture/TexturePackerJson.ts:47-49`: der Satz »laying it where the untrimmed sprite would stand is up to the caller« stimmt danach nicht mehr — `TexturedSprite#setFrame()` und eine Animation, die `FrameBasedAnimations#add()` aus dem Atlas baut, legen den Frame dorthin, wo das ungetrimmte Sprite ihn hat.
- `packages/twopoint5d/docs/architecture.md:120-126`: nach dem Absatz über die Orientierung ein Satz zur Lage eines getrimmten Frames — die Ränder reisen als `texTrim`, Instanz-Attribut von `TexturedSprites` und drittes Texel eines Frames im `animsMap` von `AnimatedSprites`, und die Sprite-Materialien verschieben damit die Ecken des Quads.
- Danach `grep -rn "setFrame\|bakeDataTexture\|includeTextureSize\|texelsPerFrame\|trimmed" packages/twopoint5d/docs packages/twopoint5d/README.md README.md apps/lookbook/src` und jede Stelle anpassen, die das Layout oder die Lage eines Frames jetzt falsch beschreibt; `docs/proposals/` bleibt unberührt.

### 10. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, Skill `updating-changelog`)

- **Added**: die Lage getrimmter Frames — das Instanz-Attribut `texTrim` von `TexturedSprite` (`trimLeft`, `trimTop`, `trimRight`, `trimBottom`, `setTexTrim()`), geschrieben von `setFrame()` aus `spriteSourceSize` und `sourceSize` der Frame-Daten; `TexturedSpritesMaterial` verschiebt die Ecken des Quads danach, der Quad steht für das ungetrimmte Sprite; `TexturedSpritesMaterial#texTrimNode`, `TexturedSpritesMaterial.TexTrimAttributeName`, `TAttributeNodeTexTrim`; eine Animation aus einem Atlas trägt die Ränder ins `animsMap`, `AnimatedSpritesMaterial` legt den Quad danach; die Grenze des Einheitsquads aus Entscheidung 3.
- **Changed**: ein Bake mit einem getrimmten Frame gibt jedem Frame drei Texel, das dritte `[left, top, right, bottom]`, der Header nennt 3 — neben dem vorhandenen Eintrag zu `texelsPerFrame` (Zeile 237); die Instanz-Buffer von `TexturedSprites` tragen vier Werte mehr, `texTrim`, und `attributeUsage` für `texCoords` erreicht sie wie `texFlipDiagonal` — neben dem Eintrag in Zeile 238. Beide mit »See the Migration Guide«.
- **Fixed**: `AnimatedSpritesMaterial` zeigt für eine Animation mit der Dauer 0 den ersten Frame; ein Sprite aus `TexturedSprites#createSprite()` beginnt mit `texFlipDiagonal` 0 und ohne Ränder, gleich was sein Slot vorher trug.
- **Migration Guide**: ein neuer Abschnitt neben »`TexturedSprite` and `TileSprite` carry `texFlipDiagonal`« (Zeile 2723) und in dessen Ton: ein Sprite mit getrimmten Frames wird nach `sourceSize` bemessen, nicht nach `coords.width`/`height`; wer das `animsMap` selbst liest, nimmt die Texel je Frame aus dem vierten Feld des Headers und findet die Ränder im dritten Texel; eine eigene Klasse, die `TexturedSprite` implementiert, deklariert die vier Felder und beide Überladungen von `setTexTrim`; ein `toBuffersData()`-Schnappschuss eines Layouts ohne `texTrim` wird neu genommen; ein eigenes Material auf einer `TexturedSpritesGeometry` mit getrimmten Frames wendet die Ränder selbst an. Ein Codeblock darin ist `ts check`, wenn er für sich steht, sonst `ts`.

### 11. Abschluss

`pnpm run ci` grün. Nicht committen. Im Report: die roten Läufe aus Schritt 7, aus Schritt 8.3 (der Nebenbefund) und aus Schritt 8.7 bzw. 8.4 (BUG-125), mit Kommando und Ausgabe.

## Findings im Volltext

**BUG-126 · low · `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts:60`** — Getrimmte TexturePacker-Frames werden nach dem getrimmten Bereich gezeichnet
Weitere Fundstellen: `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:88-99`, `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:370`.
Aufgefallen im Remediation-Lauf vom 2026-09-26. Ein getrimmter Frame (`trimmed: true`, TexturePackers Voreinstellung) wird nach seinen `coords` gezeichnet, also nach dem beschnittenen Bereich. Wo er im ungetrimmten Sprite liegt (`spriteSourceSize`) und wie groß dieses ist (`sourceSize`), liest kein Konsument: `TexturedSprite#setFrame()` nicht, `AnimatedSpritesMaterial` nicht, und das Layout, das `bakeDataTexture()` ins `animsMap` schreibt, hat keinen Platz dafür. Die Frames einer getrimmten Animation springen, ein Sprite nach `coords.width`/`height` ist zu klein. Seit dem Lauf trägt jeder Frame aus `TexturePackerJson.parse()` die drei Werte als `TextureAtlasFrame#data`. Zu entscheiden ist, ob und in welchem Rahmen der Umbau kommt: er hat die Größe eines eigenen Pakets (Layout des `animsMap` in texture, Shader und Deskriptoren in sprites) und liegt zur Hälfte außerhalb der Domain texture.
Empfehlung: Das `animsMap`-Layout um Versatz und Quellgröße je Frame erweitern, `AnimatedSpritesMaterial` und `TexturedSprite#setFrame()` legen den Quad danach; ein Browser-Test mit Pixelprobe hält es fest. Alternativ in der Doku festhalten, dass Atlanten ohne Trimming exportiert werden müssen.
Abweichung von der Empfehlung: Versatz und Quellgröße reisen nicht als zwei Werte, sondern zusammengerechnet als die vier Ränder (Entscheidung 1).

**BUG-125 · low · `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:90`** — AnimatedSpritesMaterial teilt durch die duration, die FrameBasedAnimations als 0 zulässt
Weitere Fundstellen: `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:34-35`, `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:296-298`.
Aufgefallen im Remediation-Lauf vom 2026-09-26. Der Shader rechnet den Frame-Index als `(time + animOffset) / duration` mit der `duration` aus dem `animsMap`. `FrameBasedAnimations#add()` lässt eine `duration` von 0 als Standbild zu; bei `time + animOffset = 0` ergibt das 0/0 = NaN und einen undefinierten Frame-Index. Aus dem Code abgeleitet, nicht im Browser gesehen. Zu entscheiden ist, auf welcher Seite der Scope-Grenze texture/sprites der Fix liegt: die Stelle liegt in `sprites/`, das gebrochene Versprechen gibt `FrameBasedAnimations#add()` in texture.
Empfehlung: Im Shader eine `duration` von 0 als Standbild behandeln (Frame 0), oder `bakeDataTexture()` schreibt für ein Standbild einen Wert, den der Shader ohne Division liest; dazu ein Test mit `duration: 0`.
Ergänzung aus dem Abgleich: für `time + animOffset > 0` ergibt die Division `Infinity`, und `mod(Infinity, n)` ist ebenfalls `NaN` — ein Standbild ist also zu jeder Zeit betroffen, nicht nur bei 0. Entschieden ist die erste Variante (Entscheidung vom 2026-09-26 im Plan).

**TEST-042 · medium · `packages/twopoint5d-testing/test/stage-pipeline.test.js`** — Die riskantesten GPU-Pfade von Stage, Sprites und PanControl2D mit Browser-Tests absichern (in diesem Paket nur der Sprites-Anteil)
Weitere Fundstellen: `packages/twopoint5d-testing/test/pan-control-keys.test.js`, `packages/twopoint5d/src/sprites/node-utils.ts:75-83`, `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:74-81`.
Der Display-Anteil (start/stop-Race, Chronometer, Dispose während Init, Device-Pixel-Clamp bei dpr > 1) ist im Remediation-Lauf vom 2026-09-24 abgedeckt (`6a4bcacf`, `a33a6961`). Offen bleiben die Pfade, wo Vitest-Mocks nichts sehen: kein Pixel-Readback für Mode E und für ein verschachteltes Plain-Kind über zwei Frames, keine Tests für Billboards an einem verschobenen Mesh, `texCoordsFromIndex` und die Frame-Index-Formel, kein verlorenes `keyup`; `PanControl2D` hat keine `*.spec.ts`.
Empfehlung: Je Pfad einen Browser-Test mit Pixel-Readback bzw. echtem Renderer ergänzen; für das verlorene `keyup` genügt eine Vitest-Spec.
Abgrenzung: Stage (Mode E, verschachteltes Plain-Kind) und das verlorene `keyup` bleiben im Audit (Entscheidung vom 2026-09-26). Die Billboards sind seit `deeddeea` belegt (siehe Abgleich); dieses Paket liefert `texCoordsFromIndex` und den Rest der Frame-Index-Formel (Schritt 8.7).
