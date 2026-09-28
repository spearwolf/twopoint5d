# Paket 2 — Sprites: Setter-Semantik, AnimatedSprites angleichen, Texturwechsel und Allokationen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

Alle Pfade relativ zu `packages/twopoint5d/`, sofern nicht anders angegeben.
Code, Kommentare, JSDoc, Doku und CHANGELOG auf Englisch; die Konventionen aus
dem Plan-Kopf gelten (keine Finding-IDs, kein Rückblick auf den Vorzustand).

- Findings: BUG-005 (medium), API-001 (medium), PERF-003 (medium), CONS-003 (low), PERF-014 (low), PERF-015 (low), PERF-016 (low), READ-022 (info)
- Nebenbefund im Paket: `src/map2d/TileSprites/TileSpritesMaterial.ts:88` — derselbe Color-Graph-Neubau bei jedem `colorMap`-Wechsel wie PERF-015 (gleiche Ursache, gleicher Helfer), low
- Ziel: `TexturedSprites` und `AnimatedSprites` teilen ein Besitz- und Aufrufmodell, ihre Setter überschreiben nichts still und dokumentieren den Upload-Weg, und Frame-, Farb- und Texturwechsel kosten keinen Graph-Neubau und keine Allokation.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `src/sprites/TexturedSprites/TexturedSprite.ts`, `TexturedSprites.ts`, `TexturedSpritesGeometry.ts`, `TexturedSpritesMaterial.ts` samt ihren `*.spec.ts`
  - `src/sprites/AnimatedSprites/AnimatedSprite.ts`, `AnimatedSprites.ts`, `AnimatedSpritesGeometry.ts`, `AnimatedSpritesMaterial.ts` samt ihren `*.spec.ts`
  - `src/sprites/textureShapeKey.ts` und `src/sprites/textureShapeKey.spec.ts` (neu, intern)
  - `src/sprites/hot-path-allocations.spec.ts`, `src/sprites/hot-path.bench.ts`
  - `src/map2d/TileSprites/TileSpritesMaterial.ts`, `TileSpritesMaterial.spec.ts`
  - `src/vertex-objects/VertexObjects.ts` (nur JSDoc von `update()`)
  - `docs/architecture.md` (Abschnitt `### sprites/`)
  - `CHANGELOG.md` (`[Unreleased]`)
  - `packages/twopoint5d-testing/test/sprites-textured-material.test.js`, `sprites-animated-material.test.js`, `map2d-*`-Browsertest nur falls für den Tile-Material-Wechsel nötig (siehe Schritt D5)
- Verify: `pnpm run ci` (vom Repo-Root)
- Commit: siehe unten, Abschnitt »Commit-Message«
- Verlauf:
  - 2026-09-28 Zug 0: Detailplan steht · BUG-005 unverändert (`TexturedSprite.ts:93` und `:120`, `AnimatedSprite.ts:46`) · API-001 unverändert (`TexturedSprite.ts:107`, `:120`, `:87`; `AnimatedSprite.ts:8`), dazu die irreführende JSDoc `VertexObjects.ts:36` · PERF-003 unverändert (`AnimatedSprite.ts:58-59`, `AnimatedSpritesGeometry.ts:17`) · CONS-003 unverändert (`AnimatedSprites.ts:15-41`) · PERF-014 nach `TexturedSprite.ts:107-111` gewandert, Sachverhalt unverändert · PERF-015 unverändert (`TexturedSpritesMaterial.ts:222`, `TexturedSprites.ts:31`, `AnimatedSpritesMaterial.ts:70`) · PERF-016 nach `TexturedSprite.ts:128` gewandert · READ-022 nach `TexturedSpritesGeometry.ts:68-70` gewandert · Folgen aus Paket 1: keine · Offene Befunde: leer; neuer Nebenbefund `TileSpritesMaterial.ts:88` (gleiche Ursache wie PERF-015) in dieses Paket genommen und in »Offene Befunde« eingetragen · Restplan: Paket 3 unberührt, Paket 4 verliert `TileSpritesMaterial.ts` aus dem Bereich, Reihenfolge unverändert · Paket nicht geteilt (Begründung 7)
  - 2026-09-28 Zug 1: Implementierer beauftragt (`claude -p`, Modell opus, Effort high, Session `remediate-twopoint5d-p2-impl-0`), Report nach `paket-2.impl-0.json` im Arbeitsverzeichnis
  - 2026-09-28 Zug 2: Report FERTIG_MIT_VORBEHALT (WebGPU-Pfad der Browsertests nur über WebGL2-Fallback belegt; Abweichungen: `textureShapeKey()` mit drei Flags mehr, Material-Parameter von `AnimatedSprites` mit `& {isMaterial?: never; isTexture?: never}`, CHANGELOG-Zuordnung) · 21 Dateien geändert, neu `src/sprites/textureShapeKey.ts` und `.spec.ts` · roter Lauf 19 Tests (A3, D5 (a), C4) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`)
  - 2026-09-28 Zug 3: Reviewer (opus, high) — alle 8 Findings und der Nebenbefund behoben · 2 wichtig: `textureShapeKey()` übersieht Nearest-Filter/Multisampling (unfilterable → anderer WGSL-Code/Layout), `docs/proposals/sprite-features.md:315-317` verweist auf entfallenen Satz in `touchAnimsMap()` · 3 klein (Cache-Formulierung, Klassen-JSDoc „dynamisch“ ohne Einschränkung, `FlatPlacement`-Skizze mit `z = 0`) · Diff `paket-2.diff`
  - 2026-09-28 Zug 4 Runde 1: offen 2 wichtig + 3 klein (Doku) → derselbe Implementierer per `--resume` (opus, high), Report nach `paket-2.impl-1.json`
    zurück: FERTIG · `textureShapeKey()` um vier Bits erweitert (nearest/nearest, mischender Filter, `compareFunction`, `renderTarget.samples > 1`), roter Lauf 4 Tests in `textureShapeKey.spec.ts` · JSDocs/CHANGELOG/Proposal berichtigt
    Verify `pnpm run ci` exit=0 (`paket-2.verify-1.log`) · Reviewer per `--resume` auf `paket-2.diff-1`: alle 5 erledigt, 1 neu klein (Samples-Bit) → keine weitere Runde
  - 2026-09-28 Zug 5: Commit 0fca59f7 (26 Dateien, Trailer `Remediation-Run: 2026-09-28`), Verify aus Runde 1 trägt (keine Änderung seither) · Plan: Paket 2 auf `[x]`, Nebenbefund `TexturedSprites.ts:57`/`:65` in »Offene Befunde«

## Urteil des Reviewers

Review in zwei Durchgängen (`paket-2.review-0.json`, `paket-2.review-1.json`), Modell opus, Effort high.

- BUG-005: behoben — `src/sprites/TexturedSprites/TexturedSprite.ts:143`, `:210`, `src/sprites/AnimatedSprites/AnimatedSprite.ts:81`
- API-001: behoben — JSDoc an `TexturedSprite#setSize()` (`:133`), `#setFrame()`, `#setPreparedFrame()` (`:188`), `#setColor()`, `AnimatedSprite` `animId`/`animOffset` (`:18`), `#setSize()` (`:71`), `src/vertex-objects/VertexObjects.ts:37`
- PERF-003: behoben — `src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts:49` ff.
- CONS-003: behoben — `src/sprites/AnimatedSprites/AnimatedSprites.ts:39`, `:62` ff., `docs/architecture.md`
- PERF-014: behoben nach Begründung 1 — `TexturedSprite.ts:82` (`prepareSpriteFrame`), `:188` (`setPreparedFrame`)
- PERF-015: behoben nach Begründung 5, Schlüssel in Runde 1 um nearest/nearest, mischenden Filter, `compareFunction` und Render-Target-Samples ergänzt — `src/sprites/textureShapeKey.ts:73-76`, `TexturedSpritesMaterial.ts:72`/`:269`, `AnimatedSpritesMaterial.ts:68`/`:183`
- PERF-016: behoben nach Begründung 2 — `TexturedSprite.ts:230`
- READ-022: behoben — `src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:64`
- Nebenbefund `TileSpritesMaterial.ts:88`: behoben — `src/map2d/TileSprites/TileSpritesMaterial.ts:31`, `:128`, Browsertest in `packages/twopoint5d-testing/test/map2d-rotated-tiles.test.js`

Kleine Befunde (offen, lösen keine Runde aus):
- `src/sprites/textureShapeKey.ts:76` — das Samples-Bit gilt für jede Textur mit `renderTarget.samples > 1`; three r185 bindet nur Tiefentexturen multisampled (`WebGPUUtils.js:126-127`). Folge höchstens ein überflüssiger Neubau beim Wechsel zwischen der Farbtextur eines MSAA-Targets und einer ohne; falsch gezeichnet wird nichts.

Anmerkungen:
- Abweichungen des Implementierers, vom Reviewer mitgetragen: `textureShapeKey()` liest zusätzlich `isDataArrayTexture`, `isCompressedArrayTexture`, `is3DTexture` (eine `DataArrayTexture` der Tiefe 1 hat `isArrayTexture === false`); der Material-Parameter von `AnimatedSprites` schließt per `& {isMaterial?: never; isTexture?: never}` fremde Materialien und nackte Texturen im Typ aus (mit der Plansignatur kompilierte `new AnimatedSprites(4, new MeshBasicMaterial())`); CHANGELOG ordnet `touchAnimsMap()` unter den bestehenden **Added**-Eintrag, weil die Methode seit 0.21.2 neu ist.
- Nebenbefund `TexturedSprites.ts:57`/`:65` (Urteil → Scope): dieselbe Typlücke wie oben bei `TexturedSprites`, vor diesem Lauf schon vorhanden (`git show 93628b3c:packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts`, Konstruktor); liegt in `src/sprites/`, also unter der Scope-Regel; nicht mitgenommen, weil der Paketplan die `TexturedSprites`-Signatur nicht berührt.
- `docs/remediation/20260925-remediation-report.md:11`/`:39` beschreibt `AnimatedSprites` als generisch — archivierter Bericht eines früheren Laufs, gibt den damaligen Stand wieder, bleibt unverändert.

## Begründungen der Wahl

Was dieser Plan anders macht als die Empfehlung des Audits oder zwischen zwei
Wegen wählt, und warum. Der Reviewer misst die Erfüllung an diesem Abschnitt.

1. **PERF-014 — vorbereitete Frames statt eines internen Caches.** Die
   Empfehlung (Cache in einer `WeakMap<TextureAtlasFrame, …>`, invalidiert über
   eine Version der `TextureCoords`) setzt eine Version voraus, die es nicht
   gibt: `TextureCoords` hat öffentliche, frei schreibbare Felder `x`, `y`,
   `width`, `height`, `flip`, `parent` (`src/texture/TextureCoords.ts:64-72`),
   und das Repo schreibt sie nach dem Bau eines Atlas selbst
   (`src/map2d/TileSprites/TileSpritesFactory.spec.ts:193`,
   `packages/twopoint5d-testing/test/map2d-rotated-tiles.test.js:95` setzen
   `coords.flip`). Ein Cache ohne Invalidierung zeichnete danach den alten
   Frame; eine Version bräuchte Accessoren in `src/texture/`, außerhalb der
   Scope-Regel; ein Cache, der die Eingaben prüft, liest so viele Felder, wie
   die Rechnung selbst. Deshalb: `setFrame()` rechnet weiter bei jedem Aufruf
   (korrekt bei jeder Mutation), und wer Frames pro Frame wechselt, bereitet
   sie einmal mit `prepareSpriteFrame()` vor und setzt sie mit
   `setPreparedFrame()` — neun kopierte Zahlen, kein Lookup, keine
   Invalidierungsfrage, weil der Aufrufer den Schnappschuss besitzt. Das
   erfüllt die Absicht des Findings (der Pro-Frame-Wechsel zahlt nur noch das
   Kopieren) im Modul `sprites/`.
2. **PERF-016 — JSDoc statt Pflicht-`target`.** Ein verpflichtendes `target`
   wäre ein weiterer Bruch der öffentlichen API, den keine Entscheidung im Plan
   deckt; die Empfehlung nennt die JSDoc als gleichwertige erste Option.
3. **API-001 — keine Durchreiche `touch()` auf den Meshes.** Der enge Weg ist
   `VertexObjectPool#touchVO(vo, ...attrNames)` (lädt nur den Slot des einen
   Sprites), und der Pool ist über `spritePool` am Mesh erreichbar — nach
   CONS-003 an beiden Meshes. Eine `touch()`-Methode am Mesh verdoppelte nur
   `geometry.touch()`. Die JSDoc nennt beide Wege beim Namen.
4. **CONS-003 — kein `texture`-Accessor an `AnimatedSprites`.** Die
   Entscheidung vom 2026-09-28 zählt die Helfer auf (`createSprite()`,
   `freeSprite()`, `spritePool`); ein `texture` wäre bei zwei Texturen des
   Materials (`colorMap`, `animsMap`) mehrdeutig. Aus demselben Grund nimmt der
   Material-Parameter von `AnimatedSprites` keine nackte `Texture` an, anders
   als bei `TexturedSprites`: die Entscheidung nennt »Parameter/Material«.
5. **PERF-015 — Neubau nur bei anderer Texturart, nicht nur bei
   `undefined` ↔ gesetzt.** In three r185 prägen einige Eigenschaften einer
   Textur den erzeugten Shader-Code oder das Bind-Group-Layout:
   `TextureNode.generate()` dekodiert per `colorSpaceToWorking()` abhängig von
   `texture.colorSpace` (`three/src/nodes/accessors/TextureNode.js:633-636`),
   `type` wählt Int/Uint/Float-Sampling (`:231-245`), Tiefen-, Würfel-, Array-,
   3D- und Video-Texturen andere Bindungstypen. Alles andere nimmt three zur
   Laufzeit aus `textureNode.value`: `NodeSampledTexture.update()` und
   `NodeSampler.update()` (`three/src/renderers/common/nodes/`) vergleichen
   `textureNode.value` mit ihrer gebundenen Textur und binden neu; `flipY` ist
   ein Uniform. Ein Wechsel nur zwischen »keine Textur« und »eine Textur« zu
   prüfen, ließe einen Wechsel von einer sRGB- auf eine lineare Textur mit
   falschem Shader weiterlaufen. Deshalb vergleicht ein kleiner interner Helfer
   `textureShapeKey()` genau diese Eigenschaften.
6. **Nebenbefund `TileSpritesMaterial` im Paket.** Dieselbe Ursache wie
   PERF-015 an einer dritten Stelle; halb behoben (zwei von drei Materialien)
   wäre sie ein Nachtragspaket. Der Helfer aus Schritt D1 deckt alle drei.
7. **Paket nicht geteilt.** Alle acht Findings liegen in `src/sprites/`, zwei
   Dateien (`TexturedSprite.ts`, `TexturedSpritesMaterial.ts`) tragen Teile aus
   mehreren Findings; ein geteiltes Paket kostete drei Kaltstarts mehr und
   ließe den zweiten Implementierer gegen einen halb umgebauten Stand arbeiten.

## Vorgehen

Reihenfolge A bis E; Regressionstests jeweils zuerst schreiben und rot sehen,
der rote Lauf gehört in den Report (Kommando:
`pnpm nx test twopoint5d -- src/path/to/file.spec.ts`).

### A. Setter ohne stille Defaults (BUG-005, Entscheidung 2026-09-28)

A1. `src/sprites/TexturedSprites/TexturedSprite.ts`
- `setPosition(x: number, y: number, z?: number): void` — bei `z === undefined`
  schreibt die Methode `x` und `y` in ein neues Modul-Scratch
  `const positionXYScratch: [x: number, y: number] = [0, 0];` und ruft
  `this.setInstancePosition(positionXYScratch)`. Der generierte Setter schreibt
  nur so viele Werte, wie das Array hält (`writeValues()` in
  `src/vertex-objects/createVertexObjectPrototype.ts:74-92` endet an
  `source.length`), `z` bleibt stehen. Mit `z` wie bisher über
  `positionScratch`.
- `setColor(color: Color, a?: number): void` — bei `a === undefined` ein neues
  `const colorRGBScratch: [r: number, g: number, b: number] = [0, 0, 0];` an
  `this.setColorValues(colorRGBScratch)`, Alpha bleibt stehen. Mit `a` wie
  bisher über `colorScratch`.
- **Kein `undefined` in ein Scratch-Tupel schreiben.** Das kippt die
  Elements-Kind des Arrays weg von reinen Doubles; danach boxt V8 jeden
  Bruchwert, der hineingeschrieben wird, als Heap-Number — genau die
  Allokation, die die Tupel vermeiden sollen. Ein kurzer Kommentar an den
  beiden neuen Scratch-Tupeln sagt das.
- Interface `TexturedSprite`: die Tupel-Overloads erweitern, damit die kürzeren
  Tupel typen — `setInstancePosition(position: [x: number, y: number, z?: number]): void;`
  und `setColorValues(color: [r: number, g: number, b: number, a?: number]): void;`.
  Die Einzelwert-Overloads bleiben.
- JSDoc `setPosition()`: `z` bleibt stehen, wenn es fehlt; ein Sprite aus
  `createSprite()` beginnt bei `z = 0`. JSDoc `setColor()`: bestehenden Text
  behalten, dazu: das Alpha bleibt stehen, wenn `a` fehlt; ein Sprite beginnt
  mit Alpha 1.

A2. `src/sprites/AnimatedSprites/AnimatedSprite.ts`: `setPosition()` genauso,
eigenes `positionXYScratch`, Interface-Overload
`setInstancePosition(position: [x: number, y: number, z?: number]): void;`,
gleiche JSDoc (»a sprite out of `createSprite()`« — nach C4 hat auch
`AnimatedSprites` ein `createSprite()`).

A3. Regressionstests (vor dem Fix rot):
- `TexturedSprites.spec.ts`: `setPosition(x, y) keeps the z the sprite was given`
  (`setPosition(1, 2, 3)`, dann `setPosition(4, 5)` → `x` 4, `y` 5, `z` 3) und
  `setColor(color) keeps the alpha the sprite was given`
  (`setColor(c, 0.25)`, dann `setColor(c2)` → `r/g/b` aus `c2`, `a` 0.25).
- `AnimatedSprites.spec.ts`: `setPosition(x, y) keeps the z the sprite was given`.
- `src/sprites/hot-path-allocations.spec.ts`: zwei neue Tests, nach dem Muster
  der bestehenden (`measureSettledBytes`, `BYTES_PER_CALL_LIMIT`):
  `moving a textured sprite by x and y alone and tinting it without an alpha allocates nothing per call`
  (`sprite.setPosition(i * 0.5 + 0.25, 1.5)` und `sprite.setColor(tint)` je
  Sprite, Divisor `all.length * 2`) und
  `moving an animated sprite by x and y alone allocates nothing per call`.
  Diese beiden sind keine Regressionstests für BUG-005, sondern halten den
  neuen Pfad allokationsfrei; sie laufen nach dem Fix grün.
- Die bestehenden Erwartungen `expect(sprite.z).toBe(0)` nach
  `setPosition(1, 2)` an einem frischen Sprite (`TexturedSprites.spec.ts:78-81`,
  `AnimatedSprites.spec.ts:27-30`) bleiben gültig und bleiben stehen.

### B. Upload-Weg dokumentieren (API-001)

B1. JSDoc an jedem Setter, der ein statisches Attribut schreibt. Inhalt, je
Attribut mit dem richtigen Namen:

> `<attr>` is a static attribute. What is written before the first `update()`
> after `createSprite()` reaches the gpu with it; a later change reaches it only
> once it is marked for upload — `spritePool.touchVO(sprite, '<attr>')` for this
> sprite alone, `geometry.touch('<attr>')` for every sprite in use. A value that
> changes every frame belongs in a geometry built with
> `attributeUsage: {dynamic: ['<usage-name>']}`, whose attributes upload with
> every `update()`.

| Stelle | `<attr>` | `<usage-name>` |
| --- | --- | --- |
| `TexturedSprite#setSize()` | `quadSize` | `size` |
| `TexturedSprite#setFrame()`, `#setPreparedFrame()` (E1) | `texCoords` (mit `texFlipDiagonal` und `texTrim`, die denselben Upload-Weg nehmen) | `texCoords` |
| `TexturedSprite#setColor()` | `color` | `color` |
| `AnimatedSprite#setSize()` | `quadSize` | `size` |
| Interface `AnimatedSprite`, Felder `animId` und `animOffset` (neue JSDoc an beiden) | `anim` | `anim` |

Die Formulierung darf gestrafft werden, die drei Aussagen (wann ohne Zutun,
die zwei Markierungswege, die Alternative über `attributeUsage`) bleiben. Vor
dem Schreiben gegen den Code prüfen: `VertexObjectPool#createVO()`
(`src/vertex-objects/VertexObjectPool.ts:129-141`) markiert den Slot,
`touchVO()` (`:169-190`) markiert den Buffer hinter dem Attribut für diesen
Slot, und `touchVO(sprite, 'texCoords')` erreicht `texFlipDiagonal` und
`texTrim`, weil sie im selben Buffer liegen — bei `attributeUsage` über den
Alias in `TexturedSpritesGeometry.ts:71-77`.

B2. Klassen-JSDoc an `TexturedSprites` (fehlt bisher) und an `AnimatedSprites`
(neu gefasst in C4), je ein Absatz: Position und Rotation sind dynamisch und
gehen mit jedem `update()` hoch; die übrigen Attribute sind statisch, siehe
die Setter.

B3. `src/vertex-objects/VertexObjects.ts:36-43`, JSDoc von `update()`: der Satz
»Must be called after any changes to the vertex-objects, or in the update loop
if you are constantly changing the geometry data.« verspricht mehr, als die
Methode hält. Neu sinngemäß: Uploads what the pools of the geometry have
marked for upload and syncs the draw range and the instance count; call it
once per frame before rendering. An attribute with `autoTouch` — every usage
but `static` — is marked by every call; a static attribute by
`VertexObjectPool#createVO()` for the slot it hands out, by the `touch()` of the
geometry and by `VertexObjectPool#touchVO()`, and a write to it alone reaches
the gpu with none of them. Gegen `GeometryRoutes#autoTouch()`
(`src/vertex-objects/GeometryRoutes.ts:295-310`) prüfen, auch den einmaligen
Upload beim ersten `update()` (`firstAutoTouch`). Der zweite Absatz der
bestehenden JSDoc (`onBeforeRender` kommt zu spät) bleibt.

B4. Kein neuer Test (reine Doku).

### C. AnimatedSprites an TexturedSprites angleichen (CONS-003, PERF-003, READ-022; Entscheidung 2026-09-28)

C1. `src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts`, neue Exporte:

```ts
export type AnimatedSpritesBasePool = VertexObjectPool<BaseSprite>;
export type AnimatedSpritesPool = VertexObjectPool<AnimatedSprite>;

export type AnimatedSpritesMakeBaseSpriteArgs =
  [halfWidth: number, halfHeight: number] | [halfWidth: number, halfHeight: number, xOffset: number, yOffset: number];

export interface AnimatedSpritesGeometryParameters {
  capacity: number;
  attributeUsage?: Omit<VertexAttributeUsageOverrides, 'alias'>;
}
```

- JSDoc von `attributeUsage` nach dem Vorbild von
  `TexturedSpritesGeometryParameters#attributeUsage`
  (`TexturedSpritesGeometry.ts:26-41`): die Namen `size` (→ `quadSize`) und
  `position` (→ `instancePosition`) gelten neben den Attributnamen; der
  Kommentar zum fehlenden `alias`; der Absatz über den eigenen Descriptor und
  die Prototypen. Der Absatz über `texFlipDiagonal`/`texTrim` entfällt, ein
  Beispiel nennt `{static: ['position']}` für ortsfeste animierte Sprites, die
  per `touchVO(sprite, 'instancePosition')` nur beim Bewegen hochladen.
- Klasse: `declare readonly basePool: AnimatedSpritesBasePool;`,
  `declare readonly instancedPool: AnimatedSpritesPool;`,
  `readonly isAnimatedSpritesGeometry = true;`.
- Konstruktor `(capacity: number | AnimatedSpritesGeometryParameters = 100, makeBaseSpriteArgs: AnimatedSpritesMakeBaseSpriteArgs = [0.5, 0.5])`.
  Ohne `attributeUsage` geht **`AnimatedSpriteDescriptor` selbst** an `super()`,
  damit Geometrien ohne Usage-Wahl weiter Descriptor und Prototyp teilen
  (`sharedVertexObjectDescriptor()`); mit `attributeUsage`
  `cloneVertexObjectDescription(AnimatedSpriteDescriptor, {dynamic, stream, static, alias: {size: ['quadSize'], position: ['instancePosition']}})`.
- Form der Verzweigung wie in C2, ohne optionale Verkettung.

C2. `src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:63-78` (READ-022):
`attributeUsage` einmal auslesen und verengen, etwa
`const attributeUsage = typeof capacity === 'number' ? undefined : capacity.attributeUsage;`,
dann `attributeUsage == null ? TexturedSpriteDescriptor : cloneVertexObjectDescription(TexturedSpriteDescriptor, {dynamic: attributeUsage.dynamic, stream: attributeUsage.stream, static: attributeUsage.static, alias: {…}})`
— keine `?.` mehr im Klon-Zweig. Verhalten unverändert.

C3. `src/sprites/AnimatedSprites/AnimatedSprites.ts`, neu nach dem Vorbild von
`TexturedSprites.ts`:

```ts
export class AnimatedSprites extends VertexObjects<AnimatedSpritesGeometry> {
  declare geometry: AnimatedSpritesGeometry | undefined;
  declare material: AnimatedSpritesMaterial | undefined;

  #ownsGeometry: boolean;
  #ownsMaterial: boolean;

  get spritePool(): AnimatedSpritesPool | undefined;

  constructor(
    geometry?: number | AnimatedSpritesGeometry | AnimatedSpritesGeometryParameters,
    material?: AnimatedSpritesMaterial | AnimatedSpritesMaterialParameters,
  );

  createSprite(): AnimatedSprite | undefined;
  freeSprite(sprite: AnimatedSprite): void;
  dispose(): void;
}
```

- Der Typparameter `GeoType` entfällt; `material` ist nicht mehr
  `| MeshBasicMaterial`, weil der Mesh ein fehlendes Material selbst baut.
- `geometry instanceof AnimatedSpritesGeometry ? geometry : new AnimatedSpritesGeometry(geometry)`,
  `material instanceof AnimatedSpritesMaterial ? material : new AnimatedSpritesMaterial(material)`;
  `#ownsGeometry`/`#ownsMaterial` wie in `TexturedSprites.ts:52-53`. Die
  Imports von Geometry und Material werden dafür Wert-Imports.
- `createSprite()`: `this.geometry?.instancedPool.createVO()`; JSDoc: der
  Sprite beginnt mit Größe, `animId`, `animOffset`, Position und Rotation bei 0,
  was auch immer sein Slot vorher trug; `undefined` bei voller Kapazität oder
  nach `dispose()`.
- `freeSprite()`, `spritePool`, `dispose()` samt JSDoc wie bei
  `TexturedSprites` (ohne `texture`): `dispose()` nimmt den Mesh aus dem
  Szenengraph, gibt nur selbst gebaute Geometry und Material frei, lässt
  übergebene stehen, danach `geometry`, `material`, `spritePool` und
  `createSprite()` `undefined`, `freeSprite()` ohne Wirkung, zweiter Aufruf
  ohne Wirkung. Regeln aus `docs/resource-lifecycle.md` gelten.
- Klassen-JSDoc: Konstruktor-Formen, Besitzregel, B2-Absatz.

C4. Specs:
- `AnimatedSprites.spec.ts`: die beiden Tests über den Typ eines Mesh ohne
  Geometry/Material (`:57-85`, `BufferGeometry`/`MeshBasicMaterial`) ersetzen
  durch: ohne Argumente eine `AnimatedSpritesGeometry` der Kapazität 100 und
  ein `AnimatedSpritesMaterial` (`expectTypeOf(...).toEqualTypeOf<AnimatedSpritesGeometry | undefined>()`,
  entsprechend `AnimatedSpritesMaterial | undefined`); aus einer Kapazität; aus
  `{capacity, attributeUsage}`; aus `AnimatedSpritesMaterialParameters` (etwa
  `{time: 2}` → `material.time` 2); `createSprite()`/`freeSprite()`/`spritePool`
  nach dem Muster von `TexturedSprites.spec.ts`; `dispose()` gibt selbst Gebautes
  frei (Spy auf `dispose` von Geometry und Material) und lässt Übergebenes
  stehen — die bestehenden Dispose-Tests (`:95-160`) mit übergebenen Teilen
  bleiben gültig; Verhalten nach `dispose()` wie dokumentiert.
- `AnimatedSpritesGeometry.spec.ts`: `isAnimatedSpritesGeometry` ist `true`;
  `{capacity: 4}` teilt Descriptor und Prototyp mit `new AnimatedSpritesGeometry(4)`;
  `attributeUsage` setzt die Usage von `quadSize` über `size`, von
  `instancePosition` über `position`, von `anim` und `rotation` direkt; mit
  `attributeUsage` ein eigener Descriptor — Vorbild
  `TexturedSpritesGeometry.spec.ts:75-160`.
- `TexturedSpritesGeometry.spec.ts`: bestehende Tests decken C2 ab, keiner neu.

C5. Aufrufer: `apps/lookbook/src/pages/demos/animated-sprites.astro:112`,
`animated-billboards.astro:78` und die Browsertests
`sprites-rotated-frames.test.js:146`, `sprites-trimmed-frames.test.js:185`,
`sprites-animated-material.test.js:96` bauen `new AnimatedSprites(geometry, material)`
mit eigenen Instanzen — das bleibt gültig und bleibt stehen; die Teile bleiben
Besitz des Aufrufers. `hot-path*.ts` bauen `new AnimatedSpritesGeometry(n)` —
gültig. `pnpm typecheck` bestätigt es.

C6. Doku: `docs/architecture.md`, Abschnitt `### sprites/` (`:141-154`): ein
Satz, dass beide Meshes Kapazität, Parameter oder Geometry und Parameter oder
Material nehmen (`TexturedSprites` zusätzlich eine `Texture`), Fehlendes selbst
bauen, nur das in `dispose()` freigeben und `createSprite()`, `freeSprite()`
und `spritePool` anbieten. Das Wort `ShaderMaterial` in diesem Absatz **nicht**
anfassen: es ist ein eigenes Audit-Finding außerhalb dieses Laufs.
`docs/resource-lifecycle.md` nennt `AnimatedSprites` nicht — prüfen, nichts
ändern, wenn das so bleibt.

### D. Texturwechsel ohne Graph-Neubau (PERF-015 und Nebenbefund TileSpritesMaterial)

D1. Neues internes Modul `src/sprites/textureShapeKey.ts` — **nicht** in
`src/sprites/public-api.ts` aufnehmen:

```ts
export const textureShapeKey = (texture: Texture | undefined): string | undefined
```

`undefined` ohne Textur; sonst ein String aus `colorSpace`, `type`, `format` und
den Flags `isDepthTexture`, `isCubeTexture`, `isArrayTexture`, `isData3DTexture`,
`isVideoTexture`, `isCompressedTexture`, `isStorageTexture` (je `=== true`).
Kommentar im Modul: warum genau diese (Begründung 5 oben, knapp und ohne
Rückblick); was three zur Laufzeit aus `textureNode.value` nimmt.
`textureShapeKey.spec.ts`: ohne Textur `undefined`; zwei frische `Texture` gleich;
unterschiedlich in `colorSpace`, `type`, `format`, als `CubeTexture` bzw.
`DataArrayTexture` → verschieden; nur Bild, Größe, Filter oder Wrap
verschieden → gleich.

D2. `src/sprites/TexturedSprites/TexturedSpritesMaterial.ts`:
- `#colorMapShape = createMemo(() => textureShapeKey(this.#colorMap.get()), {attach: this})`
  (`createMemo` aus `@spearwolf/signalize`; ein Memo mit gleichem String
  benachrichtigt niemanden).
- Privates Feld `#colorTextureNode` für den `TextureNode`, den
  `colorFromTextureByTexCoords()` zurückgibt (`texture(colorMap, …)` in
  `src/sprites/node-utils.ts:104`); Typ aus `three/webgpu` bzw. über
  `ReturnType<typeof colorFromTextureByTexCoords>`.
- `#colorEffect` liest statt `this.colorMap` das Memo `this.#colorMapShape()`.
  Mit Schlüssel: `const colorMap = this.#colorMap.value!` (ungetrackt), daraus
  der Texture-Node, in `#colorTextureNode` gemerkt, `colorNode = mul(textureNode, spriteColor)`;
  ohne Schlüssel `#colorTextureNode = undefined` und die graue
  Default-Farbe. `needsUpdate = true` bleibt in diesem Effekt. `texCoordsNode`
  und `texFlipDiagonalNode` bleiben wie bisher nur hinter der Textur gelesen.
- Neuer Effekt `#colorMapValueEffect`: liest `this.#colorMap.get()` und setzt,
  wenn Textur und `#colorTextureNode` da sind, `this.#colorTextureNode.value = colorMap`
  — **ohne** `needsUpdate`. Er läuft bei jedem Wechsel; bei einem Wechsel der
  Texturart läuft zusätzlich der Neubau, beide Reihenfolgen enden im selben
  Stand.
- `dispose()`: den neuen Effekt zusammen mit den beiden anderen zuerst
  zerstören, vor den `set(undefined)`. Das Memo hängt an der `SignalGroup` und
  fällt mit `SignalGroup.delete(this)`; der Test »does not leak signals or
  effects« muss grün bleiben.
- JSDoc des `colorMap`-Setters: eine Textur derselben Art wie die gesetzte —
  gleicher `colorSpace`, `type`, `format`, gleiche Texturklasse — tritt ohne
  Neubau an ihre Stelle, der Texture-Node bekommt sie nur als Wert; eine
  andere Art, und der Wechsel von keiner Textur zu einer und zurück, baut den
  Color-Graph neu und setzt `needsUpdate`, three erzeugt den Shader-Quelltext
  dann neu (Programm und Pipeline aus dem Cache) — solche Texturen nicht pro
  Frame abwechseln. Die JSDoc von `TexturedSprites#texture` (Setter) verweist
  darauf.

D3. `src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`:
- `#animsMapSize = uniform(new Vector2(0, 0))` (`Vector2` aus `three/webgpu`),
  an `texCoordsFromIndex()` statt `vec2(width, height)` (`:80`).
- `#animsMapShape = createMemo(…)`: Schlüssel `textureShapeKey(animsMap)` nur,
  wenn das Bild Breite und Höhe über 0 hat, sonst `undefined` — so baut der
  Übergang »Bild fehlt« → »Bild da« weiter einmal neu.
- `#texCoordsEffect` liest das Memo; mit Schlüssel baut er den Graph wie
  bisher, schreibt die Maße aus `this.#animsMap.value` (ungetrackt) in
  `#animsMapSize.value` und merkt sich die vier `texture(this.animsMap, …)`-Nodes
  (Header, Frame, Flip, Trim; `:89`, `:106`, `:112`, `:120`) in
  `#animsTextureNodes`; ohne Schlüssel der neutrale Zweig wie bisher,
  `#animsTextureNodes` leer.
- Neuer Effekt `#animsMapValueEffect`: liest `this.#animsMap.get()`; bei einem
  Bild mit Maßen über 0 setzt er `#animsMapSize.value.set(width, height)` und
  `value = animsMap` an jedem gemerkten Texture-Node. Kein `needsUpdate`. Er
  läuft auch bei `touchAnimsMap()` (das `touch()` des Signals erreicht ihn).
- `dispose()`: den neuen Effekt mit `#texCoordsEffect` vor
  `this.#animsMap.set(undefined)` zerstören.
- JSDoc `animsMap`-Setter und `touchAnimsMap()` (`:31-40`, `:145-159`) neu
  fassen: eine animsMap derselben Art tritt ohne Neubau an die Stelle, ihre
  Maße gehen in einen Uniform; `touchAnimsMap()` baut nur neu, wenn die Textur
  seit dem letzten Lesen erst ein Bild bekommen hat (oder ihre Art wechselte),
  sonst aktualisiert es die Maße; weiter: aufrufen, wenn eine Textur geladen
  hat, nicht pro Frame. Die Aussage über einen lebenden Material ohne animsMap
  gegen das neue Verhalten prüfen und anpassen.

D4. `src/map2d/TileSprites/TileSpritesMaterial.ts:88-101` (Nebenbefund): wie D2
— Memo über `textureShapeKey(this.#colorMap.get())`, gemerkter Texture-Node,
Wert-Effekt ohne `needsUpdate`, `dispose()` zerstört ihn zuerst, JSDoc des
`colorMap`-Setters. Import aus `../../sprites/textureShapeKey.js` (map2d
importiert schon aus `../../sprites/node-utils.js`).

D5. Tests:
- `TexturedSpritesMaterial.spec.ts`: (a) `a colorMap swapped for a texture of the same kind keeps the colorNode and hands the texture node the new texture`
  — `colorNode` dasselbe Objekt, `material.version` unverändert, der
  Texture-Node im Graph (`colorNode` ist `mul(textureNode, spriteColor)`;
  über `aNode` oder `traverse()`) hat `value === b`; (b)
  `a colorMap of another kind builds a new colorNode` (etwa andere `colorSpace`);
  (c) `clearing the colorMap builds the grey default again`. Vor dem Fix sind
  (a) rot, (b) und (c) grün.
- `AnimatedSpritesMaterial.spec.ts`: (a) `an animsMap swapped for a loaded texture of the same kind and another size builds no node`
  — `texCoordsNode` und `colorNode` dieselben Objekte, `version` unverändert,
  jeder Texture-Node der Lookups liest die neue Textur, der Größen-Uniform
  trägt die neuen Maße (Uniform und Texture-Nodes sind privat: im Graph von
  `texCoordsNode` über `traverse()` finden, **kein** neuer Getter); (b)
  `touchAnimsMap() on a texture that had its image builds no node and takes the new size`
  (Bild durch eines anderer Größe ersetzen, `touchAnimsMap()`). Der bestehende
  Test `touchAnimsMap() picks up the image once the texture has one` (`:332`)
  bleibt: dort baut es neu. Tests, die bisher einen Neubau bei jedem
  animsMap-Wechsel erwarten, gegen das neue Verhalten ziehen.
- `TileSpritesMaterial.spec.ts`: der Test aus (a) für `TileSpritesMaterial`.
- Browser (`packages/twopoint5d-testing/test/`, Fixtures aus
  `helpers/fixtures.js`: `makeColorTexture`, `renderToPixels`, `rgbAt`,
  `isNearColor`): in `sprites-textured-material.test.js`
  `a texture swapped for one of the same kind is drawn from the next frame on`
  (rot rendern, `sprites.texture = green`, rendern → grün); in
  `sprites-animated-material.test.js`
  `an animsMap swapped for a bake of another size draws the frame the new one points at`.
  Diese Tests belegen den Wechsel ohne Neubau auf echter GPU (WebGPU und der
  WebGL2-Fallback); ein eigener Browsertest für `TileSpritesMaterial` nur, wenn
  `map2d-*.test.js` schon ein Rendering mit Tile-Textur hat, an das er sich
  hängen lässt.

### E. Frames vorbereiten (PERF-014, siehe Begründung 1) und `getColor()` (PERF-016)

E1. `src/sprites/TexturedSprites/TexturedSprite.ts`, neue Exporte (über das
bestehende `export *` in `src/sprites/public-api.ts` öffentlich):

```ts
export interface PreparedSpriteFrame {
  readonly texCoords: [s: number, t: number, u: number, v: number];
  readonly texFlipDiagonal: number;
  readonly texTrim: [left: number, top: number, right: number, bottom: number];
}

export function prepareSpriteFrame(frame: TextureAtlasFrame): PreparedSpriteFrame;
```

- `prepareSpriteFrame()` rechnet einmal, was `setFrame()` schreibt:
  `frame.coords.getTexCoords()` (ohne Ziel: neues Tupel), `frame.coords.flipD ? 1 : 0`,
  `frameTrimMargins(frame.data)` (ohne Ziel: neues Tupel). `texTrim` als
  Inline-Tupeltyp, **nicht** `FrameTrimMargins`: `src/texture/frameTrimMargins.ts`
  ist nicht öffentlich exportiert, und `checkNameableTypes` im CI verlangt
  benennbare Typen an öffentlichen Symbolen.
- Methode `setPreparedFrame(prepared: PreparedSpriteFrame): void` an der Klasse
  `TexturedSprite` (und ihr Eintrag im Interface, falls die Deklaration dort
  nötig ist): `this.setTexCoords(prepared.texCoords); this.texFlipDiagonal = prepared.texFlipDiagonal; this.setTexTrim(prepared.texTrim);`
  — die Tupel gehen direkt an die Setter, kein Scratch nötig.
- JSDoc `prepareSpriteFrame()`: ein Schnappschuss des Frames zum Zeitpunkt des
  Aufrufs; wer danach `coords` oder `data` des Frames ändert, bereitet ihn neu
  vor. JSDoc `setFrame()`: rechnet bei jedem Aufruf aus dem aktuellen Frame;
  wer Frames pro Frame wechselt, nimmt `prepareSpriteFrame()` einmal je Frame
  und `setPreparedFrame()`. Dazu der Absatz aus B1.
- Tests in `TexturedSprites.spec.ts`: `setPreparedFrame() writes what setFrame() writes`
  für den aufrechten, den gedrehten (`FLIP_DIAGONAL`) und den getrimmten Frame
  aus den bestehenden Fixtures (`frame`, `turnedCoords`, `trimmedFrame`) —
  Werte von `s, t, u, v, texFlipDiagonal, trimLeft…trimBottom` gleich;
  `prepareSpriteFrame() takes a snapshot` (danach `coords.flip` ändern →
  vorbereiteter Frame unverändert, `setFrame()` folgt der Änderung).
- `hot-path-allocations.spec.ts`: `re-framing a textured sprite with a prepared frame allocates nothing per call`.
- `hot-path.bench.ts`: im Bench der Textured Sprites zwei Fälle ergänzen,
  `re-frame every sprite with setFrame()` und
  `re-frame every sprite with setPreparedFrame()` (zwei Frames im Wechsel,
  einer getrimmt), damit das archivierte Ergebnis den Unterschied zeigt. Kein
  Grenzwert.

E2. `TexturedSprite#getColor()` (`:128`): Signatur bleibt
`getColor(target: Color = new Color()): Color`; JSDoc: answers `r`, `g`, `b` of
the sprite in `target`; without one it builds a new `Color` per call — in an
update loop hand in one that is reused. Alpha steht nicht darin (`a` lesen).

### F. CHANGELOG (`[Unreleased]`, Skill `updating-changelog`)

Der `[Unreleased]`-Abschnitt ist nicht veröffentlicht und wird **berichtigt,
nicht überschichtet**: im letzten Release (`0.21.2`, Commit `62174770`) war
`AnimatedSprites` nicht generisch, typte `geometry`/`material` als
`AnimatedSpritesGeometry`/`AnimatedSpritesMaterial | undefined`, nahm
`material?: Material` und gab in `dispose()` beides frei. Maßstab jedes
Eintrags ist dieser Release, nicht der Zwischenstand.

- **Changed** berichtigen: den Eintrag »`AnimatedSprites<GeoType extends …>` is
  generic the same way …« (Datei-Zeile ~131) streichen — gegen den Release gibt
  es diesen Unterschied nicht mehr. Den Eintrag »`AnimatedSprites#dispose()`
  releases neither …« (~152) umschreiben nach dem Muster des
  `TexturedSprites#dispose()`-Eintrags: gibt genau das frei, was der Mesh
  selbst gebaut hat, Übergebenes bleibt beim Aufrufer.
- **Added**: `AnimatedSprites` nimmt Kapazität, `AnimatedSpritesGeometryParameters`
  oder Geometry und `AnimatedSpritesMaterialParameters` oder Material und baut
  Fehlendes; `AnimatedSprites#createSprite()`, `#freeSprite()`, `#spritePool`;
  `AnimatedSpritesGeometryParameters` mit `attributeUsage`,
  `AnimatedSpritesPool`, `AnimatedSpritesBasePool`,
  `AnimatedSpritesMakeBaseSpriteArgs`, `AnimatedSpritesGeometry#isAnimatedSpritesGeometry`;
  `prepareSpriteFrame()`, `PreparedSpriteFrame`, `TexturedSprite#setPreparedFrame()`.
- **Changed**: `TexturedSprite#setPosition(x, y)` und `AnimatedSprite#setPosition(x, y)`
  lassen `z` stehen, `TexturedSprite#setColor(color)` das Alpha (Verhaltensänderung,
  Migration Guide); die Tupel-Overloads von `setInstancePosition()`/`setColorValues()`
  nehmen ein kürzeres Tupel; perf: ein `colorMap` derselben Art tritt in
  `TexturedSpritesMaterial`, `AnimatedSpritesMaterial` und `TileSpritesMaterial`
  ohne Neubau des Shader-Graphen an die Stelle, eine `animsMap` derselben Art
  in `AnimatedSpritesMaterial` ebenso (Maße als Uniform), `touchAnimsMap()`
  baut nur beim ersten Bild neu.
- **Migration Guide** berichtigen:
  - »Geometry, material and texture handed in stay the caller's to dispose«
    (~1305) bleibt inhaltlich richtig; den Schlusssatz um
    `new AnimatedSprites(1000, {animsMap}).dispose()` als Mesh, der seine Teile
    selbst baut und freigibt, ergänzen.
  - »A mesh built without a geometry is typed with the `BufferGeometry` it
    holds« (~1742): `AnimatedSprites<GeoType>` und
    `animatedSprites.material … | MeshBasicMaterial` daraus streichen.
  - »`AnimatedSprites` takes an `AnimatedSpritesMaterial`, and its `material`
    may be a `MeshBasicMaterial`« (~1775) neu fassen: der Material-Parameter
    nimmt `AnimatedSpritesMaterial` oder `AnimatedSpritesMaterialParameters`,
    ein anderes three-`Material` kompiliert nicht mehr (Release: `Material`);
    `material` ist `AnimatedSpritesMaterial | undefined`. Vorher/Nachher-Block.
  - neu: »`setPosition(x, y)` keeps `z`, `setColor(color)` keeps the alpha« mit
    Vorher/Nachher: wer den Rücksprung auf `z = 0` bzw. Alpha 1 braucht,
    übergibt den Wert.
- Code-Blöcke im Migration Guide, die für sich stehen, tragen `ts check`
  (AGENTS.md, »Code blocks in Markdown«) und kompilieren gegen die gebaute
  Library.

## Commit-Message

```
feat(sprites)!: give AnimatedSprites the construction and ownership of TexturedSprites, keep the z and the alpha that setPosition() and setColor() are not handed, swap a texture of the same kind into the sprite and tile materials without rebuilding the shader graph, and add prepareSpriteFrame() with TexturedSprite#setPreparedFrame()

AnimatedSprites takes a capacity, AnimatedSpritesGeometryParameters or an
AnimatedSpritesGeometry, and AnimatedSpritesMaterialParameters or an
AnimatedSpritesMaterial, builds what it is not handed, releases only that in
dispose(), and offers createSprite(), freeSprite() and spritePool.
AnimatedSpritesGeometry takes attributeUsage. The sprite setters of static
attributes name the touch a later change needs.

BREAKING CHANGE: setPosition(x, y) of TexturedSprite and AnimatedSprite keeps
the z of the sprite, and TexturedSprite#setColor(color) keeps its alpha.
AnimatedSprites takes no type parameter, and its material argument is an
AnimatedSpritesMaterial or its parameters, no other three.js material.
```

## Findings im Volltext

**BUG-005 · medium · `src/sprites/TexturedSprites/TexturedSprite.ts:84`** (weitere: `AnimatedSprite.ts:38`, `TexturedSprite.ts:108`) — Default-Parameter von `setPosition()` und `setColor()` nicht still auf `z` bzw. Alpha schreiben lassen
`setPosition(x, y, z = 0)` reicht immer drei Werte an `setInstancePosition()` weiter. Der generierte Setter lässt eine Komponente, die `undefined` ankommt, bewusst unangetastet — der Default `0` hebelt genau das aus. Ein Sprite, dessen Tiefe in einer 2.5D-Szene einmal über `sprite.z` oder `setPosition(x, y, z)` gesetzt wurde, springt beim ersten `setPosition(x, y)` im Update-Loop auf `z = 0` und damit in eine andere Ebene bzw. Zeichenreihenfolge. Ohne JSDoc ist das nirgends festgehalten.
Beleg: `setPosition(x: number, y: number, z = 0): void { this.setInstancePosition(x, y, z); }`
Empfehlung: Den Default streichen (`z?: number`) und `undefined` an `setInstancePosition()` durchreichen, sodass `setPosition(x, y)` die Tiefe behält; falls der Reset gewollt ist, ihn in einer JSDoc ausdrücklich benennen. Einen Test ergänzen, der `z` über ein `setPosition(x, y)` hinweg prüft.

**API-001 · medium · `src/sprites/TexturedSprites/TexturedSprite.ts:95`** (weitere: `TexturedSprite.ts:108`, `:80`, `AnimatedSprite.ts:8`) — An den Sprite-Settern für statische Attribute dokumentieren, dass eine spätere Änderung ein `touch()` braucht
`setFrame()`, `setColor()`/`setColorValues()`, `setSize()` und bei `AnimatedSprite` `animId`/`animOffset` schreiben Attribute ohne `usage` — also `static` und ohne `autoTouch`. Die generierten Setter markieren nichts als geschrieben; hochgeladen wird ein statischer Buffer nur beim ersten `update()` (`firstAutoTouch`) und für frisch per `createVO()` vergebene Slots. Ändert ein Aufrufer später den Frame eines bestehenden Sprites (Klick, Zustandswechsel, handgemachte Flipbook-Animation pro Frame), bleibt das Bild ohne `geometry.touch('texCoords')` bzw. `touch('color')` unverändert — `VertexObjects#update()` allein reicht nicht, obwohl dessen Doku »Must be called after any changes« nahelegt. Weder die JSDoc von `setFrame()`/`setColor()` noch die von `TexturedSprites` nennen diesen Schritt oder die Alternative `attributeUsage: {dynamic: ['texCoords']}` für Frame-Wechsel pro Frame. Wer es trotzdem richtig macht und jedes Frame `touch('texCoords')` ruft, lädt den gesamten statischen Buffer hoch (quadSize, texCoords, texFlipDiagonal, texTrim, color = 15 Floats pro Sprite) statt nur der geänderten 9.
Beleg: `setFrame(frame: TextureAtlasFrame): void { this.setTexCoords(frame.coords.getTexCoords(texCoordsScratch)); … }` — JSDoc erwähnt Upload/touch nicht; `texCoords: {components: ['s', 't', 'u', 'v']}` ohne `usage`
Empfehlung: In der JSDoc von `setFrame()`, `setColor()`, `setSize()` und an `AnimatedSprite.animId` einen Satz ergänzen: nach dem ersten Frame erreicht eine Änderung die GPU erst mit `geometry.touch('<attribut>')`; wer pro Frame wechselt, deklariert das Attribut über `attributeUsage.dynamic` als dynamisch. Optional `TexturedSprites#touch(...)` als Durchreiche anbieten, damit der Aufrufer nicht über `geometry` greifen muss.

**PERF-003 · medium · `src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts:17`** (weitere: `AnimatedSprite.ts:47`, `:48`) — `AnimatedSpritesGeometry` eine Usage-Wahl für `instancePosition` und `rotation` geben
Der `AnimatedSpriteDescriptor` deklariert `instancePosition` und `rotation` als `usage: 'dynamic'`; `VertexAttributeDescriptor#autoTouch` ist für jede nicht-statische Usage `true`. Damit markiert jedes `mesh.update()` → `InstancedVOBufferGeometry#update()` → `GeometryRoutes#autoTouch()` den dynamischen Buffer für einen Voll-Upload über `usedCount` — in jedem Frame, auch wenn kein einziges Sprite sich bewegt hat. Bei animierten Sprites ist das der Normalfall: die Frame-Animation läuft komplett im Shader über das `time`-Uniform, die CPU muss pro Frame nichts schreiben. Anders als `TexturedSpritesGeometry` (Parameterobjekt mit `attributeUsage`, `TexturedSpritesGeometry.ts:55-73`) nimmt der Konstruktor nur `capacity` und `makeBaseSpriteArgs`; der Descriptor ist fest verdrahtet, ein Opt-out gibt es nur über eine selbstgebaute `InstancedVertexObjectGeometry`. Kosten: 16 Byte pro Sprite und Frame Upload plus `needsUpdate`-Pfad in three.js — bei 50 000 stehenden, animierten Sprites 800 KB pro Frame für nichts.
Beleg: `instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'}, rotation: {size: 1, usage: 'dynamic'},` und `constructor(capacity = 100, makeBaseSpriteArgs = [0.5, 0.5]) { super(AnimatedSpriteDescriptor, capacity, BaseSpriteDescriptor);`
Empfehlung: Den Konstruktor wie bei `TexturedSpritesGeometry` auch ein Parameterobjekt `{capacity, attributeUsage}` annehmen lassen und den Descriptor über `cloneVertexObjectDescription()` mit den Aliasen `size`/`position` ableiten. So kann ein Aufrufer mit ortsfesten animierten Sprites `static: ['position']` wählen und per `touch('instancePosition')` nur dann hochladen, wenn er wirklich bewegt.

**CONS-003 · low · `src/sprites/AnimatedSprites/AnimatedSprites.ts:21`** (weitere: `TexturedSprites.ts:37`, `AnimatedSpritesGeometry.ts:17`) — `AnimatedSprites` und `TexturedSprites` beim Bau und Besitz von Geometry und Material angleichen
Die beiden Mesh-Klassen desselben Tripel-Musters folgen zwei Modellen: `TexturedSprites` nimmt Kapazität, Parameterobjekt oder Geometry bzw. Textur, Parameter oder Material, baut fehlende Teile selbst, besitzt und entsorgt sie und bietet `createSprite()`, `freeSprite()`, `spritePool` und `texture`. `AnimatedSprites` ist generisch über `GeoType`, baut nichts (ohne Argumente hält es die `BufferGeometry`/`MeshBasicMaterial` von `THREE.Mesh`), entsorgt nichts und hat keinen der Helfer. Dazu kommt `isTexturedSpritesGeometry` ohne Gegenstück und das fehlende Parameterobjekt bei `AnimatedSpritesGeometry`. Wer von einer Klasse zur anderen wechselt, muss Besitz und Aufrufmuster neu lernen; `sprites.dispose()` bedeutet in beiden etwas anderes.
Beleg: `constructor(geometry?: GeoType, material?: AnimatedSpritesMaterial) { super(geometry, material); … }` gegen `super(geometry instanceof TexturedSpritesGeometry ? geometry : new TexturedSpritesGeometry(geometry), …)`
Empfehlung: `AnimatedSprites` dieselbe Konstruktor-Signatur und Besitzregel wie `TexturedSprites` geben (Kapazität/Parameter/Geometry, Parameter/Material; eigene Teile besitzen und entsorgen) samt `createSprite()`/`freeSprite()`/`spritePool`, oder den Unterschied in beiden Klassen-JSDocs ausdrücklich begründen. Der Vorschlag in `docs/proposals/sprite-features.md` §5 wäre der natürliche Ort dafür.

**PERF-014 · low · `src/sprites/TexturedSprites/TexturedSprite.ts:95`** — Die pro Atlas-Frame konstanten Werte von `setFrame()` einmal vorberechnen
`setFrame()` ist allokationsfrei (Scratch-Tupel in Zeile 61/64), rechnet aber bei jedem Aufruf alles neu, was für einen Atlas-Frame fest ist: `frame.coords.getTexCoords()` läuft über `computeBounds()` die Parent-Kette der `TextureCoords` hoch, `frameTrimMargins()` liest sechs Felder aus den rohen TexturePacker-Daten (`spriteSourceSize`, `sourceSize`), prüft jedes auf `Number.isFinite` und dividiert viermal. Wer Frames auf CPU-Seite pro Frame wechselt (Flipbook ohne `AnimatedSprites`, Partikel mit zufälligem Frame), zahlt das pro Sprite und Frame; bei 10 000 Sprites sind das 10 000 Kettenläufe und 60 000 Property-Reads auf JSON-Objekten, die sich nie ändern.
Beleg: `this.setTexCoords(frame.coords.getTexCoords(texCoordsScratch)); this.texFlipDiagonal = frame.coords.flipD ? 1 : 0; this.setTexTrim(frameTrimMargins(frame.data, trimScratch));`
Empfehlung: Die neun Werte (s, t, u, v, flipD, vier Trim-Ränder) pro Frame einmal berechnen und cachen — etwa in einer `WeakMap<TextureAtlasFrame, Float32Array>` in diesem Modul, invalidiert über eine Version der `TextureCoords`, oder als vom Atlas vorberechnetes Feld —, und `setFrame()` kopiert nur noch neun Zahlen.
Umsetzung weicht ab: siehe »Begründungen der Wahl«, Punkt 1.

**PERF-015 · low · `src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:222`** (weitere: `TexturedSprites.ts:31`, `AnimatedSpritesMaterial.ts:70`) — Einen Texturwechsel über den `value` des `TextureNode` führen statt den Color-Graph neu zu bauen
`#colorEffect` liest `this.colorMap`; jede Zuweisung einer anderen Textur (`material.colorMap = t` oder `TexturedSprites#texture = t`) baut den kompletten `colorNode`-Graph neu und setzt `needsUpdate = true`. three.js verwirft daraufhin das RenderObject und lässt den NodeBuilder den Shader-Quelltext erneut generieren; Programm und Pipeline kommen zwar aus dem Cache, der Node-Build selbst kostet aber pro Wechsel einen spürbaren Teil eines Frames. Die Doku von `touchAnimsMap()` warnt für die animsMap bereits vor genau diesem Effekt; für `colorMap` fehlt die Warnung, und ein Umschalten zwischen zwei Sheets im Update-Loop (Tag/Nacht, Hit-Flash) landet unbemerkt im Hot Path. Die animsMap-Variante baut zusätzlich alle vier Lookups neu, weil ihre Größe als Konstante `vec2(width, height)` im Graph steht.
Beleg: `if (this.colorMap) { this.colorNode = mul(colorFromTextureByTexCoords(this.colorMap, {...}), spriteColor); } … this.needsUpdate = true;`
Empfehlung: Den `texture()`-Node einmal anlegen und bei einem Wechsel zwischen zwei vorhandenen Texturen nur `textureNode.value = colorMap` setzen; den Graph nur neu bauen, wenn `colorMap` zwischen `undefined` und gesetzt wechselt. Für die animsMap die Kartengröße als `uniform(vec2)` führen, dann braucht auch ein neues animsMap-Bild keinen Neubau. Ersatzweise mindestens an `colorMap`/`texture` den Hinweis aus `touchAnimsMap()` ergänzen: nicht pro Frame wechseln.
Umsetzung verfeinert: Neubau auch bei anderer Texturart, siehe »Begründungen der Wahl«, Punkt 5.

**PERF-016 · low · `src/sprites/TexturedSprites/TexturedSprite.ts:112`** — `TexturedSprite#getColor()` ohne Ziel nicht pro Aufruf eine `Color` allokieren lassen
`getColor(target = new Color())` legt bei jedem Aufruf ohne Ziel ein neues `Color`-Objekt an. In einer Farbanimation im Update-Loop (lesen, mischen, `setColor()`) entsteht so pro Sprite und Frame Garbage — genau das, was die übrigen Accessoren dieses Slices mit Scratch-Tupeln und die generierten Setter mit festen Parametern vermeiden.
Beleg: `getColor(target: Color = new Color()): Color { return target.set(this.r, this.g, this.b); }`
Empfehlung: In der JSDoc festhalten, dass im Update-Loop ein wiederverwendetes `target` gehört, oder `target` wie bei three.js' `getWorldPosition(target)` verpflichtend machen.

**READ-022 · info · `src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:67`** — Überflüssige optionale Verkettung im Klon-Zweig von TexturedSpritesGeometry
Im Klon-Zweig stehen drei `capacity.attributeUsage?.`, obwohl der Zweig nur mit gesetztem `attributeUsage` betreten wird.
Empfehlung: Die optionale Verkettung dort entfernen.

**Nebenbefund · low · `src/map2d/TileSprites/TileSpritesMaterial.ts:88`** — nicht aus dem Audit, in Zug 0 gefunden
`#colorEffect` liest `this.colorMap` und baut bei jeder Zuweisung einer anderen Textur `colorNode` neu und setzt `needsUpdate = true` — dieselbe Ursache wie PERF-015. Behebung wie D4.
