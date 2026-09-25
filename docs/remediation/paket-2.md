# Paket 2 — Sprite-Klassen und Geometrien: ehrliche Typen und Spec-Abdeckung

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-038 (low), TYPE-023 (low), API-059 (low), TEST-005 (medium)
- Nebenbefund aufgenommen (gleiche Ursache wie API-059): `TexturedSpritesGeometry.ts:35-36` redeklariert `basePool` und `instancedPool` ohne das `readonly` der Basisklasse
- Ziel: `AnimatedSprites` und die Sprite-Geometrien deklarieren, was sie tatsächlich halten, und Geometrien, Sprites, node-utils und die Effektpfade der Materialien sind mit Specs abgedeckt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - geändert: `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprites.ts`,
    `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts`,
    `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`,
    `packages/twopoint5d/CHANGELOG.md`
  - Specs geändert: `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprites.spec.ts`,
    `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts`,
    `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`,
    `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts`
  - Specs neu: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.spec.ts`,
    `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.spec.ts`,
    `packages/twopoint5d/src/sprites/node-utils.spec.ts`
  - nicht anfassen: `apps/lookbook/**` (siehe »Abgleich«, die Aufrufer compilieren unverändert),
    `packages/twopoint5d-testing/**` (keine Render- oder GPU-Buffer-Änderung in diesem Paket),
    `TexturedSpritesMaterial.ts`, `AnimatedSpritesMaterial.ts`, `node-utils.ts` (nur Specs dazu)
- Verify: `pnpm run ci`
  - schnelle Schleife während der Arbeit: `pnpm nx test twopoint5d -- src/sprites` und `pnpm typecheck`
    (die `expectTypeOf`- und `@ts-expect-error`-Zeilen der Specs prüft nur `pnpm typecheck`, nicht Vitest)
- Commit (Subject und Footer als zwei `-m`):
  - Subject: `fix(sprites): type AnimatedSprites by the geometry it holds and let it take only an AnimatedSpritesMaterial, declare the pools of both sprite geometries as always there and read-only, and cover the sprite geometries, the sprites, node-utils and the node wiring of the sprite materials with specs`
  - Footer: `BREAKING CHANGE: AnimatedSprites is generic over its geometry with BufferGeometry as the default, types its material as AnimatedSpritesMaterial | MeshBasicMaterial | undefined and takes an AnimatedSpritesMaterial only; TexturedSpritesGeometry#basePool and #instancedPool are read-only.`
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · API-038 unverändert (`AnimatedSprites.ts:11`) · TYPE-023 unverändert (`AnimatedSprites.ts:8`, `:9`, `:11`) · API-059 unverändert (`TexturedSpritesGeometry.ts:35`, `:62`), gleiches Muster in `AnimatedSpritesGeometry.ts:18` · TEST-005 umgeformt (Sprite-Methoden in `TexturedSprites.spec.ts:41-75` und `AnimatedSprites.spec.ts:19-34` inzwischen abgedeckt, Rest offen) · Folge aus Paket 1 → Schritt 8 · Nebenbefund `TexturedSpritesGeometry.ts:35-36` (`readonly`) aufgenommen → Schritt 3 · neuer Nebenbefund `TileSpritesGeometry.ts:7-10` → »Offene Befunde« (→ Audit)
  - 2026-09-25 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort medium · Brief `paket-2.impl-1.brief.txt`, Report nach `paket-2.impl-1.json`
  - 2026-09-25 Zug 2: Report FERTIG (session 5132d92d) · 4 Quell-/Doku-Dateien und 4 Specs geändert, 3 Specs neu · Typecheck vor der Typänderung rot (9 Fehler in 3 Specs) · Abweichungen: `@ts-expect-error`-Zuweisungen für `readonly` in beiden Geometrie-Specs, `attributes['quadSize']?.usage`, `VaryingNode<unknown>`-Casts · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`)
  - 2026-09-25 Zug 3: Reviewer beauftragt, mittlere Stufe (sonnet), Effort medium · Diff `paket-2.diff` (968 Zeilen)
  - 2026-09-25 Zug 3: Urteil — alle vier Findings und der Nebenbefund behoben, 0 kritisch, 0 wichtig, 8 klein · Report `paket-2.review-1.json`
  - 2026-09-25 Zug 4: keine Runde nötig
  - 2026-09-25 Zug 5: Commit aceff5f0 auf main, Verify `paket-2.verify.log` exit=0, Arbeitsbaum sauber

## Vorgehen

Konventionen aus dem Kopf von `./remediation-plan.md` gelten für jede Zeile:
keine Finding-IDs, kein Rückblick auf den Vorzustand in Code, Kommentaren und
Doku, Code und Kommentare auf Englisch, relative Imports mit `.js`, Typen per
`import type`. Nach dem Schreiben `pnpm format`, falls Prettier Zeilen umbricht.

### Schritt 1 — `AnimatedSprites` generisch über die Geometrie (API-038, TYPE-023)

Vorbild ist `packages/twopoint5d/src/map2d/TileSprites/TileSprites.ts:1-26`.
`packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprites.ts` bekommt:

- Imports: `import type {BufferGeometry, MeshBasicMaterial} from 'three/webgpu';` statt
  `import type {Material} from 'three/webgpu';`. `AnimatedSpritesGeometry` und
  `AnimatedSpritesMaterial` bleiben `import type`.
- Klassen-TSDoc über der Klasse, sinngemäß wie bei `TileSprites`:

  ```ts
  /**
   * The mesh that draws animated sprites, one instance of its `AnimatedSpritesGeometry` per sprite.
   *
   * `GeoType` is the geometry the mesh holds. Built without one, the mesh holds the plain
   * `BufferGeometry` that `THREE.Mesh` puts in its place — `GeoType` is then `BufferGeometry`. A
   * type argument named explicitly while the geometry is left out states a geometry the mesh does
   * not hold.
   */
  ```

- Signatur: `export class AnimatedSprites<GeoType extends AnimatedSpritesGeometry | BufferGeometry = BufferGeometry> extends VertexObjects<GeoType>`
- Die Zeile `declare geometry: AnimatedSpritesGeometry | undefined;` entfällt —
  `VertexObjects` deklariert `geometry: GeoType | undefined` bereits.
- `material` wird so deklariert, mit dem Kommentar darüber:

  ```ts
  // built without a material, the mesh holds the MeshBasicMaterial THREE.Mesh puts in its place
  declare material: AnimatedSpritesMaterial | MeshBasicMaterial | undefined;
  ```

- Konstruktor: `constructor(geometry?: GeoType, material?: AnimatedSpritesMaterial)`.
  Rumpf und `dispose()` bleiben, wie sie sind.

Die Aufrufer in `apps/lookbook/src/pages/demos/animated-sprites.astro:112` und
`apps/lookbook/src/pages/demos/animated-billboards.astro:85` übergeben ein
`AnimatedSpritesGeometry` und ein `AnimatedSpritesMaterial` und halten das
Material in einer eigenen Variablen; sie compilieren ohne Änderung.
`packages/twopoint5d-testing/test/sprites-animated-material.test.js:68` ist JavaScript.
`pnpm typecheck` bestätigt beides — schlägt dort etwas fehl, wird es mitgezogen.

### Schritt 2 — `AnimatedSpritesGeometry#basePool` ohne `undefined` (API-059, Muster aus »Entscheidungen«)

In `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts`:

- `import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';` dazu.
- Als erstes Klassenmitglied:

  ```ts
  // the constructor hands super() a base descriptor, never a BufferGeometry, so the base pool is always there
  declare readonly basePool: VertexObjectPool<BaseSprite>;
  ```

- Zeile 18: `const baseSprite = this.basePool.createVO();` — ohne `?.`. Die
  `if (baseSprite == null) throw …`-Prüfung bleibt mit ihrer Meldung unverändert:
  `createVO()` antwortet laut Signatur `… | undefined`.

### Schritt 3 — `TexturedSpritesGeometry`: `?.` weg, Pool-Felder `readonly` (API-059 + Nebenbefund)

In `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`:

- Zeilen 35-36 werden, mit dem Kommentar darüber:

  ```ts
  // the constructor hands super() a base descriptor, never a BufferGeometry, so the base pool is always there
  declare readonly basePool: TexturedSpritesBasePool;
  declare readonly instancedPool: TexturedSpritesPool;
  ```

- Zeile 62: `const baseSprite = this.basePool.createVO();` — ohne `?.`. Die
  `throw`-Prüfung bleibt.

Die Typen `TexturedSpritesBasePool`/`TexturedSpritesPool` bleiben, wie sie sind.
Im Repo schreibt nur `InstancedVOBufferGeometry.ts:151` auf `basePool`, im
eigenen Konstruktor; kein anderer Schreibzugriff auf eines der beiden Felder
existiert.

### Schritt 4 — CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, Skill `updating-changelog`)

Alles im Abschnitt `## [Unreleased]`; freigegebene Abschnitte bleiben unberührt.

1. Unter `### Changed` direkt nach dem `TileSprites<GeoType …>`-Eintrag (jetzt
   Zeile 104) zwei Einträge:

   ```markdown
   - `AnimatedSprites<GeoType extends AnimatedSpritesGeometry | BufferGeometry = BufferGeometry>` is generic the same way: built with an `AnimatedSpritesGeometry`, `geometry` is typed as exactly that; built without one, `BufferGeometry`. `material` is typed `AnimatedSpritesMaterial | MeshBasicMaterial | undefined` — built without a material, the mesh holds the `MeshBasicMaterial` `THREE.Mesh` puts in its place — and the constructor takes an `AnimatedSpritesMaterial` as its material
   - `AnimatedSpritesGeometry#basePool` is typed `VertexObjectPool<BaseSprite>`, without `undefined`, as `TexturedSpritesGeometry#basePool` is: both geometries build their base pool in the constructor. `TexturedSpritesGeometry#basePool` and `#instancedPool` are read-only, as `InstancedVertexObjectGeometry` declares them
   ```

2. Im `### Migration Guide` den Abschnitt `#### A mesh built without a geometry is
   typed with the \`BufferGeometry\` it holds` (jetzt ab Zeile 1536) erweitern:
   der erste Absatz nennt `AnimatedSprites<GeoType>` neben `VertexObjects<GeoType>`
   und `TileSprites<GeoType>` (»…`VOBufferGeometry`/`TileSpritesGeometry`/`AnimatedSpritesGeometry`…«),
   und der Satz zum Material nennt auch `animatedSprites.material`, typed
   `AnimatedSpritesMaterial | MeshBasicMaterial | undefined`.

3. Direkt danach ein neuer Abschnitt:

   ````markdown
   #### `AnimatedSprites` takes an `AnimatedSpritesMaterial`, and its `material` may be a `MeshBasicMaterial`

   The constructor of `AnimatedSprites` takes an `AnimatedSpritesMaterial` as its material. A mesh
   built without one holds the `MeshBasicMaterial` `THREE.Mesh` puts in its place, so
   `sprites.material` is typed `AnimatedSpritesMaterial | MeshBasicMaterial | undefined`: a member
   of `AnimatedSpritesMaterial` read through it needs an `instanceof` check — or the reference to
   the material you built.

   **Before**

   ```ts
   const sprites = new AnimatedSprites(geometry, material);
   sprites.material!.time = now;
   ```

   **After**

   ```ts
   const sprites = new AnimatedSprites(geometry, material);
   material.time = now; // the reference you built the mesh with keeps its type

   if (sprites.material instanceof AnimatedSpritesMaterial) {
     sprites.material.time = now;
   }
   ```

   `TexturedSpritesGeometry#basePool` and `#instancedPool` are read-only. The geometry builds its
   attributes on the pools it was constructed with; a pool written there afterwards was never drawn.
   ````

   Die Codeblöcke sind Auszüge wie ihre Nachbarn (`ts`, nicht `ts check`).

### Schritt 5 — `TexturedSpritesGeometry.spec.ts` (neu, TEST-005 Empfehlung 1, `BaseSprite.make`)

Datei `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.spec.ts`,
Aufbau wie die Nachbar-Specs (`describe`, `test`, `expect`, `expectTypeOf` aus
`vitest`, `createSandbox` aus `sinon` mit `sandbox.restore()` in `afterEach`).
Jede Geometrie wird am Testende mit `geometry.dispose()` freigegeben. Tests:

1. `'builds a sprite pool of 100 and a base pool holding one base sprite by default'`:
   `new TexturedSpritesGeometry()` → `instancedPool.capacity` 100, `basePool.capacity` 1,
   `basePool.usedCount` 1, `name` `'twopoint5d.TexturedSpritesGeometry'`,
   `isTexturedSpritesGeometry` `true`.
2. `'makes the base sprite a quad of half width and height 0.5 around the origin'`:
   `const base = geometry.basePool.getVO(0)!` →
   `x0, y0` = `-0.5, -0.5` · `x1, y1` = `-0.5, 0.5` · `x2, y2` = `0.5, 0.5` · `x3, y3` = `0.5, -0.5` ·
   `z0 … z3` = `0` · `u0, v0` = `0, 1` · `u1, v1` = `0, 0` · `u2, v2` = `1, 0` · `u3, v3` = `1, 1`.
3. `'makes the base sprite from the arguments it is given'`:
   `new TexturedSpritesGeometry(4, [2, 3, 1, 1])` →
   `x0, y0` = `-1, -2` · `x1, y1` = `-1, 4` · `x2, y2` = `3, 4` · `x3, y3` = `3, -2`.
4. `'takes the usage of each attribute from the sprite description for a capacity number'`:
   `new TexturedSpritesGeometry(4)`, gelesen über
   `geometry.instancedPool.descriptor.getAttribute(name)!.usageType`:
   `quadSize` `'static'`, `texCoords` `'static'`, `instancePosition` `'dynamic'`,
   `rotation` `'dynamic'`, `color` `'static'`.
5. `'gives the attributes named in attributeUsage their usage, size and position included'`:
   `new TexturedSpritesGeometry({capacity: 8, attributeUsage: {dynamic: ['size'], stream: ['position'], static: ['rotation']}})` →
   `instancedPool.capacity` 8; `quadSize` `'dynamic'`, `instancePosition` `'stream'`,
   `rotation` `'static'`, `texCoords` `'static'`, `color` `'static'`; danach
   `TexturedSpriteDescriptor.attributes.quadSize.usage` weiterhin `undefined`
   (die Kopie hat die geteilte Beschreibung nicht verändert; Import aus `./TexturedSprite.js`).
6. `'keeps the usage of the sprite description for parameters without attributeUsage'`:
   `new TexturedSpritesGeometry({capacity: 8})` → dieselben Usages wie Test 4, `capacity` 8.
7. `'throws when the base pool has no room for the base sprite'`:
   `sandbox.stub(VertexObjectPool.prototype, 'createVO').returns(undefined)` (Import
   `VertexObjectPool` aus `../../vertex-objects/VertexObjectPool.js`), dann
   `expect(() => new TexturedSpritesGeometry(4)).toThrow('TexturedSpritesGeometry: the base pool has no room for the base sprite')`.
   Der Stub verhindert nur diesen Weg; ohne ihn ist er unerreichbar, weil der Base-Pool frisch mit Kapazität 1 entsteht.
8. `'declares a base pool that is always there'`:
   `expectTypeOf(geometry.basePool).toEqualTypeOf<TexturedSpritesBasePool>()`
   (Import `type TexturedSpritesBasePool` aus `./TexturedSpritesGeometry.js`) und
   `expect(geometry.basePool).toBeDefined()`.

### Schritt 6 — `AnimatedSpritesGeometry.spec.ts` (neu, TEST-005 Empfehlung 1)

Datei `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.spec.ts`,
Aufbau wie Schritt 5. Tests:

1. `'builds a sprite pool of 100 and a base pool holding one base sprite by default'`:
   `instancedPool.capacity` 100, `basePool.capacity` 1, `basePool.usedCount` 1,
   `name` `'twopoint5d.AnimatedSpritesGeometry'`.
2. `'makes the base sprite a quad of half width and height 0.5 around the origin'`:
   dieselben Werte wie Schritt 5, Test 2.
3. `'makes the base sprite from the arguments it is given'`:
   `new AnimatedSpritesGeometry(4, [2, 3, 1, 1])` → dieselben Werte wie Schritt 5, Test 3.
4. `'takes the usage of each attribute from the sprite description'`:
   `quadSize` `'static'`, `anim` `'static'`, `instancePosition` `'dynamic'`, `rotation` `'dynamic'`.
5. `'throws when the base pool has no room for the base sprite'`: wie Schritt 5, Test 7, Meldung
   `'AnimatedSpritesGeometry: the base pool has no room for the base sprite'`.
6. `'declares a base pool that is always there'`:
   `expectTypeOf(geometry.basePool).toEqualTypeOf<VertexObjectPool<BaseSprite>>()`
   (`import type {BaseSprite} from '../BaseSprite.js'`) und `expect(geometry.basePool).toBeDefined()`.

### Schritt 7 — Sprites: `getColor()`, Pool-Arrays, Typen des argumentlosen `AnimatedSprites` (TEST-005 Empfehlung 2, TYPE-023 Typtest)

**`packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`** — zwei Tests
dazu, auf oberster `describe`-Ebene vor `describe('dispose()')`:

1. `'getColor() answers the rgb of the sprite, in a new Color or in the target it is given'`:
   `sprite.setColor(new Color(0.5, 0.25, 0.125), 0.75)`; `const color = sprite.getColor()` →
   `toBeInstanceOf(Color)`, `r, g, b` = `0.5, 0.25, 0.125`; `const target = new Color()`,
   `expect(sprite.getColor(target)).toBe(target)` und dieselben drei Werte an `target`.
2. `'the sprite methods write through to the buffers of the sprite pool'`: Hilfsfunktion
   im Spec-Modul, mit dem Kommentar darüber:

   ```ts
   // the values of one attribute of the object at `index`, read straight from the typed array of its buffer
   const readAttribute = (pool: VertexObjectPool<TexturedSprite>, name: string, index: number): number[] => {
     const {bufferName, offset} = pool.buffer.bufferAttributes.get(name)!;
     const {itemSize, typedArray} = pool.buffer.buffers.get(bufferName)!;
     const {size} = pool.descriptor.getAttribute(name)!;
     const start = index * pool.descriptor.vertexCount * itemSize + offset;
     return Array.from(typedArray!.subarray(start, start + size));
   };
   ```

   Ablauf: `new TexturedSprites(4)`, `const first = sprites.createSprite()!` (Index 0),
   `first.setSize(4, 5)`, `first.setPosition(1, 2, 3)`,
   `first.setFrame({coords: {s: 0.25, t: 0.5, u: 0.75, v: 1}} as unknown as TextureAtlasFrame)`,
   `first.setColor(new Color(0.5, 0.25, 0.125), 0.75)`; dann `sprites.createSprite()` (Index 1).
   Mit `const pool = sprites.spritePool!`:
   `readAttribute(pool, 'quadSize', 0)` = `[4, 5]` · `'instancePosition', 0` = `[1, 2, 3]` ·
   `'texCoords', 0` = `[0.25, 0.5, 0.75, 1]` · `'color', 0` = `[0.5, 0.25, 0.125, 0.75]` ·
   `'color', 1` = `[1, 1, 1, 1]` (der Weiß-Default aus `[voInitialize]`, im Buffer gelesen).
   Alle Werte sind in `Float32` exakt darstellbar, also `toEqual`. Imports:
   `import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js'`,
   `import type {TexturedSprite} from './TexturedSprite.js'`.

**`packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprites.spec.ts`** — vier Tests
dazu, auf oberster `describe`-Ebene vor `describe('dispose()')`, nach dem Muster von
`packages/twopoint5d/src/map2d/TileSprites/TileSprites.spec.ts:8-27`:

3. `'an AnimatedSprites built without a geometry or a material is typed with what THREE.Mesh puts there'`:
   `const sprites = new AnimatedSprites()`;
   `expectTypeOf(sprites.geometry).toEqualTypeOf<BufferGeometry | undefined>()`,
   `expect(sprites.geometry).toBeInstanceOf(BufferGeometry)`,
   `expect(sprites.geometry).not.toBeInstanceOf(AnimatedSpritesGeometry)`;
   `expectTypeOf(sprites.material).toEqualTypeOf<AnimatedSpritesMaterial | MeshBasicMaterial | undefined>()`,
   `expect(sprites.material).toBeInstanceOf(MeshBasicMaterial)`.
4. `'an AnimatedSprites built with an AnimatedSpritesGeometry is typed with it'`:
   `expectTypeOf(new AnimatedSprites(geometry).geometry).toEqualTypeOf<AnimatedSpritesGeometry | undefined>()`;
   `geometry.dispose()` am Ende.
5. `'takes an AnimatedSpritesMaterial only'`:

   ```ts
   const material = new MeshBasicMaterial();
   // @ts-expect-error the constructor takes an AnimatedSpritesMaterial only
   const sprites = new AnimatedSprites(undefined, material);
   ```

   dann `expect(sprites.material).toBe(material)` (zur Laufzeit legt `THREE.Mesh` es ab)
   und `material.dispose()`.
6. `'is named twopoint5d.AnimatedSprites'`: `expect(new AnimatedSprites().name).toBe('twopoint5d.AnimatedSprites')`.

Imports dazu: `BufferGeometry`, `MeshBasicMaterial` aus `three/webgpu`; `expectTypeOf` aus `vitest`.

### Schritt 8 — Node-Verdrahtung der Materialien (TEST-005 Empfehlung 3, Folge aus Paket 1)

Die Empfehlung, »`colorMap` macht den `colorNode` zu einem `TextureNode`« zu
assertieren, geht am Code nach Paket 1 vorbei: das Farb-Effect in
`TexturedSpritesMaterial.ts:172-187` baut (Zeilen 179 und 181)
`colorNode = mul(<Sample oder vec4(0.5, 0.5, 0.5, 1)>, vertexColor())`. An ihre
Stelle tritt: der `colorNode` ist eine Multiplikation, deren linker Operand mit
`colorMap` ein `TextureNode` auf genau diese Textur ist und ohne `colorMap` keiner,
und deren rechter Operand ein `VertexColorNode`. Jede Aussage unten ist am
2026-09-25 gegen `packages/twopoint5d/dist/lib/sprites/**` (Stand `deeddeea`,
three 0.185.1) nachgeprüft.

three 0.185 legt das Ergebnis jedes TSL-Operators in einen `VarNode` (`isVarNode`,
`intent`), der den `OperatorNode` als `node` hält; dessen `aNode`/`bNode` sind die
Operanden, identisch (`toBe`) mit den übergebenen Nodes. Hilfsfunktion in
`TexturedSpritesMaterial.spec.ts` und `node-utils.spec.ts`, je mit Kommentar:

```ts
// three wraps the result of each TSL operator in a VarNode that holds the OperatorNode as `node`
const operatorOf = (node: Node | null | undefined): OperatorNode => {
  const varNode = node as unknown as VarNode<unknown, OperatorNode>;
  return varNode.isVarNode ? varNode.node : (node as unknown as OperatorNode);
};
```

Typen aus `three/webgpu` per `import type` (`Node`, `OperatorNode`, `VarNode`,
`TextureNode`, `VertexColorNode`, `VaryingNode`, `AttributeNode`, `NodeBuilder`);
passt ein Generic nicht, gilt, was `pnpm typecheck` annimmt.

**`packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts`** —
neuer Block `describe('node wiring', …)` zwischen `describe('parameters')` und
`describe('dispose()')`. Jeder Test gibt Material und Texturen am Ende frei.

1. `'builds a flat positionNode by default, the instance position added last'`:
   `operatorOf(material.positionNode).op` = `'+'`, `.bNode` `toBe(material.instancePositionNode)`.
2. `'builds a billboard positionNode once renderAsBillboards is set'`: `positionNode` und
   `version` merken, `material.renderAsBillboards = true` → `positionNode` nicht mehr
   derselbe, `version` größer, `operatorOf(material.positionNode).aNode`
   `toBe(material.instancePositionNode)`.
3. `'builds no positionNode for a renderAsBillboards write of the value it holds'`: auf
   einem neuen Material `renderAsBillboards = false` → `positionNode` und `version` unverändert.
4. `test.each` über die vier Node-Setter — `['vertexPositionNode', vec3(0, 0, 0)]`,
   `['rotationNode', float(1)]`, `['instancePositionNode', vec3(0, 0, 0)]`,
   `['quadSizeNode', vec2(1, 1)]` (aus `three/tsl`) — Name
   `'builds a new positionNode for a write to %s'`: danach `positionNode` nicht mehr
   derselbe, `version` größer.
5. `'tints a grey default color by the sprite color while there is no colorMap'`:
   `operatorOf(material.colorNode)` → `op` `'*'`, `(aNode as TextureNode).isTextureNode`
   falsy, `(bNode as VertexColorNode).isVertexColorNode` `true`.
6. `'samples the colorMap once one is set, still tinted by the sprite color'`: `colorNode`
   und `version` merken, `material.colorMap = colorMap` → `colorNode` nicht mehr derselbe,
   `version` größer; `operatorOf(material.colorNode)`: `op` `'*'`,
   `aNode.isTextureNode` `true`, `aNode.value` `toBe(colorMap)`,
   `(aNode.uvNode as VaryingNode).isVaryingNode` `true`, `bNode.isVertexColorNode` `true`.
7. `'builds a new colorNode for a texCoordsNode write while a colorMap is set'`: Material
   mit `colorMap`, `colorNode`/`version` merken, `material.texCoordsNode = vec4(0, 0, 1, 1)` →
   `colorNode` nicht mehr derselbe, `version` größer.
8. `'leaves the colorNode alone for a texCoordsNode write without a colorMap'`: Material
   ohne `colorMap`, `material.texCoordsNode = vec4(0, 0, 1, 1)` → `colorNode` und `version`
   unverändert. Das Farb-Effect liest `texCoordsNode` nur hinter `if (this.colorMap)` und
   hängt ohne `colorMap` deshalb nicht daran.

**`packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts`** —
zwei Tests in einem neuen Block `describe('node wiring', …)` vor `describe('dispose()')`:

9. `'an animsMap set through the setter drives the texture coordinates and the colorNode'`:
   `new AnimatedSpritesMaterial({colorMap})`, `colorNode` merken,
   `const animsMap = makeAnimsMap(); material.animsMap = animsMap` →
   `(material.texCoordsNode as TextureNode).isTextureNode` `true`, `.value` `toBe(animsMap)`,
   `colorNode` nicht mehr derselbe.
10. `'a time write reaches the uniform and builds no node'`:
    `new AnimatedSpritesMaterial({colorMap, animsMap: makeAnimsMap()})`, `texCoordsNode`,
    `colorNode`, `version` merken, `material.time = 3` → `time` 3, alle drei unverändert.

### Schritt 9 — `node-utils.spec.ts` (neu, TEST-005 Empfehlung 4)

Datei `packages/twopoint5d/src/sprites/node-utils.spec.ts`, mit `operatorOf` aus
Schritt 8 und dieser Hilfsfunktion samt Kommentar:

```ts
// AttributeNode answers its name without looking at the builder it is typed to take
const attributeNameOf = (node: Node): string => (node as AttributeNode).getAttributeName(undefined as unknown as NodeBuilder);
```

Gemeinsame Nodes: `const vertexPosition = vec3(1, 2, 3)`, `const instancePosition = vec3(4, 5, 6)`,
`const scale = vec3(2, 2, 2)`. Tests:

- `describe('vertexByInstancePosition()')`
  1. `'adds the instancePosition attribute to the position attribute by default'`:
     `operatorOf(vertexByInstancePosition())` → `op` `'+'`, `attributeNameOf(aNode)` `'position'`,
     `attributeNameOf(bNode)` `'instancePosition'`.
  2. `'adds the instance position it is given to the vertex position it is given'`:
     `aNode` `toBe(vertexPosition)`, `bNode` `toBe(instancePosition)`.
  3. `'scales the vertex position before it adds the instance position'`: mit `scale` →
     äußerer `op` `'+'`, `bNode` `toBe(instancePosition)`; `operatorOf(aNode)` → `op` `'*'`,
     `aNode` `toBe(vertexPosition)`, `bNode` `toBe(scale)`.
- `describe('billboardVertexByInstancePosition()')`
  4. `'turns the quad about the instancePosition attribute by default'`:
     `operatorOf(billboardVertexByInstancePosition())` → `op` `'+'`, `attributeNameOf(aNode)` `'instancePosition'`.
  5. `'turns the quad about the instance position it is given'`: mit allen drei Parametern →
     `op` `'+'`, `aNode` `toBe(instancePosition)`.
- `describe('colorFromTextureByTexCoords()')`
  6. `'samples the color map through a varying'`: `const texture = new Texture()`,
     `colorFromTextureByTexCoords(texture)` → `isTextureNode` `true`, `value` `toBe(texture)`,
     `(uvNode as VaryingNode).isVaryingNode` `true`; `texture.dispose()`.
  7. `'samples the color map through the texture coordinates and uv it is given'`: mit
     `{texCoords: vec4(0, 0, 1, 1), uv: vec2(0.5, 0.5)}` → dieselben drei Aussagen.
- `describe('texCoordsFromIndex()')`
  8. `'divides the cell of the index by the size of the map'`:
     `operatorOf(texCoordsFromIndex(vec2(4, 4), int(5))).op` `'/'`.

Rendering und GPU-Buffer ändern sich in diesem Paket nicht; eine Browser-Suite
kommt deshalb nicht dazu (AGENTS.md verlangt beide Test-Oberflächen nur für
Änderungen an Render- oder GPU-Buffer-Code).

## Abgleich (2026-09-25, gegen `deeddeea`)

- **API-038** — unverändert. `AnimatedSprites.ts:11`: `constructor(geometry?: AnimatedSpritesGeometry, material?: Material)`,
  `:9`: `declare material: AnimatedSpritesMaterial | undefined`.
- **TYPE-023** — unverändert. `AnimatedSprites.ts:8` `declare geometry: AnimatedSpritesGeometry | undefined`,
  `:9` `declare material: …`, `:11` der Konstruktor. Das Vorbild `TileSprites.ts:17-21` steht
  wie im Finding beschrieben.
- **API-059** — unverändert. `TexturedSpritesGeometry.ts:35` `declare basePool: TexturedSpritesBasePool`,
  `:62` `this.basePool?.createVO()`. Dasselbe Muster, wie »Entscheidungen« verlangt, in
  `AnimatedSpritesGeometry.ts:18` — dort ohne Redeklaration, das `?.` ist also vom Typ
  `VertexObjectPool<BaseSprite> | undefined` aus `InstancedVertexObjectGeometry.ts:19` erzwungen.
- **TEST-005** — umgeformt. Der Befund ist »carried-over«, sein Text älter als der Stand:
  `TexturedSprites.spec.ts:41-75` prüft `setSize`, `setPosition`, `setFrame`, `setColor` und
  den Weiß-Default aus `[voInitialize]` (über die VO-Getter), `AnimatedSprites.spec.ts:19-34`
  die Methoden des `AnimatedSprite`; beide Material-Specs haben seit Paket 1 `parameters` und
  `builds no node on the way out`. Offen bleiben: keine `TexturedSpritesGeometry.spec.ts`,
  keine `AnimatedSpritesGeometry.spec.ts`, keine `node-utils.spec.ts`, `getColor()` ungeprüft,
  `BaseSprite.make` nur mittelbar, kein Lesen der Pool-Arrays, keine Assertion auf die
  Node-Verdrahtung der Materialien. Empfehlung 3 wird nach Schritt 8 angepasst.

## Begründungen aus Zug 0

- **Folge aus Paket 1** (`Folgen:`-Zeile unter Paket 1): Einordnung als Anpassung der
  Empfehlung, kein Defekt — sie gehört in Schritt 8 und löst kein eigenes Paket aus.
- **Nebenbefund `readonly` aufgenommen**: `InstancedVertexObjectGeometry.ts:19-20` deklariert
  beide Pools `readonly`, `TexturedSpritesGeometry.ts:35-36` redeklariert sie ohne. Dieselbe
  Ursache wie API-059 — die Redeklaration gibt die Deklaration der Basisklasse nicht treu
  wieder —, in derselben Zeile, die das Paket ohnehin ändert. Kein Schreibzugriff im Repo
  bricht (nur `InstancedVOBufferGeometry.ts:151` im eigenen Konstruktor). Die Entscheidung
  zu API-059 (»die Deklaration gilt«) betrifft die Optionalität und bleibt unberührt.
- **Nicht aufgenommen: `TexturedSpritesMaterial.ts:34`, `:78`** (»Offene Befunde«, → Scope):
  der Alias `TAttributeNodeInstancePosition` ist strukturell richtig (`Node<'vec3'>`), nur
  falsch benannt — eine andere Ursache als die Typen, die hier etwas anderes deklarieren, als
  das Objekt hält. Bleibt für die Drain-Runde.
- **Neuer Nebenbefund `TileSpritesGeometry.ts:7-10`**: dieselbe Lücke wie der aufgenommene
  Befund, aber per Interface-Merge in map2d — Scope-Regel greift nicht, → Audit. Vorbestehend:
  die Datei ist seit `c7cbb6d8` (vor dem ersten Paket-Commit) unverändert.
- **`AnimatedSpritesGeometry` mit `readonly`**: die neue Redeklaration übernimmt das `readonly`
  der Basisklasse, statt es wie die alte in `TexturedSpritesGeometry` fallen zu lassen.
- **Coverage-Schwellen bleiben**: `vite.config.ts` setzt sie beim Festlegen zwei Punkte unter
  das Gemessene; ein Anheben nach diesem Paket ist nicht Teil der Empfehlung und bleibt eine
  eigene Entscheidung.
- **Restplan**: Paket 2 ist das letzte offene Paket; nichts ist umzusortieren oder zu
  schneiden. »Offene Befunde« bleibt für die Drain-Runde des Abschlusses.
- **Modell mittlere Stufe, Effort medium**: die API-Änderung übernimmt ein Muster, das im
  Repo steht (`TileSprites`), mit exakten Signaturen; die Specs sind mit Werten vorgegeben und
  gegen die gebaute Library nachgeprüft. Die stärkste Stufe wäre für »öffentliche API neu
  schneiden«; hier wird kopiert, nicht geschnitten.

## Findings im Volltext

**API-038 · low · packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprites.ts:7-15** — Den AnimatedSprites-Materialparameter als das typisieren, was das Feld deklariert
Der Konstruktor nimmt `material?: Material`, das Feld deklariert `AnimatedSpritesMaterial | undefined`. Ein fremdes Material passt durch die Typprüfung, und die Deklaration stimmt dann nicht mehr.
Empfehlung: Den Konstruktorparameter auf `AnimatedSpritesMaterial` verengen.

**TYPE-023 · low · packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprites.ts:8 (auch :11)** — AnimatedSprites deklariert geometry und material enger, als three sie belegt
Aufgefallen im Remediation-Lauf vom 2026-09-23. `declare geometry: AnimatedSpritesGeometry | undefined` und `declare material: AnimatedSpritesMaterial | undefined`: Ohne Argumente hält das Mesh die nackte `BufferGeometry` und das `MeshBasicMaterial` von `THREE.Mesh`. Der Konstruktor nimmt außerdem jedes `Material`, das die Deklaration dann `AnimatedSpritesMaterial` nennt. `VertexObjects` und `TileSprites` sind für dieselbe Ursache bereits generisch über die Geometrie.
Empfehlung: Wie bei `TileSprites`: generisch über die Geometrie mit Default `BufferGeometry`, und das Material als `AnimatedSpritesMaterial | MeshBasicMaterial | undefined` typisieren. Dazu ein Typtest für den argumentlosen Konstruktor.

**API-059 · low · packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:62** — Den Optional-Chain auf basePool auflösen oder die Deklaration korrigieren
`this.basePool?.createVO()` benutzt den Optional-Chain auf einem Feld, das als nicht-optional deklariert ist (`declare basePool: TexturedSpritesBasePool`). Entweder lügt die Deklaration — `InstancedVOBufferGeometry.ts:27` sagt, `basePool` sei optional, sobald eine `BufferGeometry` übergeben wird — oder das `?.` ist überflüssig. Aufgefallen im Remediation-Lauf vom 2026-09-20.
Empfehlung: Entscheiden, welche der beiden Aussagen gilt, und die andere anpassen. (Entschieden am 2026-09-25: die Deklaration gilt, siehe »Entscheidungen« im Plan.)

**TEST-005 · medium · packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts:20** — Die Sprite-Geometrien, node-utils und die Effektpfade der Materialien mit Specs abdecken
Das sprites-Verzeichnis hat vier Specs, und alle testen nur `dispose()`. Es gibt keine `TexturedSpritesGeometry.spec.ts`/`AnimatedSpritesGeometry.spec.ts` (der `attributeUsage`- + `size`/`position`-Alias-Pfad, der `make()`-Aufruf und der »base pool has no room«-Throw sind unausgeführt), keine `node-utils.spec.ts`, und `BaseSprite.make`, `TexturedSprite.setFrame/setColor/getColor` und der `[voInitialize]`-Weiß-Default sind ungetestet. Am Material assertiert nichts, dass `renderAsBillboards = true` den `positionNode` tauscht, dass `colorMap` den `colorNode` zu einem `TextureNode` macht oder dass ein `texCoordsNode`-Write den Farbeffekt erneut laufen lässt — genau die reaktive Verdrahtung, die der Remediation-Lauf gerade umgebaut hat. API-027 und BUG-089 sind die Art Regression, die solche Specs gefangen hätten.
Empfehlung: Specs, die (1) die Geometrie mit `{capacity, attributeUsage: {dynamic: ['size']}}` bauen und `quadSize`-Usage am Descriptor assertieren; (2) ein Sprite anlegen, `setFrame`/`setColor`/`getColor`/`setSize` rufen und die Pool-Arrays lesen; (3) am Material `positionNode`/`colorNode`-Identitätswechsel und `version`-Inkremente assertieren; (4) für `node-utils` jeden Helfer konstruieren und Node-Typen prüfen.

## Urteil des Reviewers (2026-09-25, `paket-2.review-1.json`)

- **API-038** — behoben: `AnimatedSprites.ts` Konstruktor nimmt `material?: AnimatedSpritesMaterial`; `AnimatedSprites.spec.ts` »takes an AnimatedSpritesMaterial only« sichert das per `@ts-expect-error`.
- **TYPE-023** — behoben: `AnimatedSprites<GeoType extends AnimatedSpritesGeometry | BufferGeometry = BufferGeometry> extends VertexObjects<GeoType>`, `declare material: AnimatedSpritesMaterial | MeshBasicMaterial | undefined`; Typtests für den argumentlosen Konstruktor und den mit Geometrie in `AnimatedSprites.spec.ts`.
- **API-059** — behoben: `?.` entfällt in `TexturedSpritesGeometry.ts` und `AnimatedSpritesGeometry.ts`; `AnimatedSpritesGeometry` deklariert `declare readonly basePool: VertexObjectPool<BaseSprite>`; der Throw ist per Stub erreicht (beide Geometrie-Specs).
- **Nebenbefund `readonly`** — behoben: `TexturedSpritesGeometry.ts` deklariert beide Pools `readonly`, `@ts-expect-error`-Zuweisungen in `TexturedSpritesGeometry.spec.ts`.
- **TEST-005** — behoben: alle vier Empfehlungen abgedeckt, Empfehlung 3 wie geplant an `mul(<Sample>, vertexColor())` angepasst.

### Kleine Befunde

- `node-utils.spec.ts` »samples the color map through the texture coordinates and uv it is given« prüft dasselbe wie der Default-Test; ignorierte die Funktion `texCoords`/`uv`, bliebe er grün.
- `node-utils.spec.ts` »turns the quad about the instance position it is given« prüft nur `op` und `aNode`; `vertexPosition` und `scale` blieben unbemerkt.
- `node-utils.spec.ts` »divides the cell of the index by the size of the map« prüft nur `op === '/'`, nicht die Operanden.
- `AnimatedSpritesMaterial.spec.ts` »a time write reaches the uniform and builds no node« liest `material.time` über den Getter, nicht den Uniform-Wert.
- `AnimatedSpritesGeometry.spec.ts`, `TexturedSpritesGeometry.spec.ts`: `expect(assignPool).toBeInstanceOf(Function)` ist dekorativ, die Aussage tragen nur die `@ts-expect-error`-Zeilen (geprüft von `pnpm typecheck`).
- `packages/twopoint5d/CHANGELOG.md` `### Changed`: der neue `AnimatedSprites<GeoType …>`-Eintrag ist ungewrappt und deutlich länger als seine Nachbarn.
- `packages/twopoint5d/CHANGELOG.md` Migration Guide: die `readonly`-Aussage zu `TexturedSpritesGeometry` steht unter einer Überschrift, die nur `AnimatedSprites` nennt.
- Commit-Subject (über 250 Zeichen) länger als sein Vorbild `deeddeea`; konventionsgemäß und ID-frei.

### Abweichungen des Implementierers vom Detailplan

- `@ts-expect-error`-Zuweisungen an `basePool`/`instancedPool` in einer nie aufgerufenen Hilfsfunktion (`no-self-assign`), weil `toEqualTypeOf` den `readonly`-Modifier nicht unterscheidet und der Typtest sonst vor der Änderung nicht rot wäre.
- `TexturedSpriteDescriptor.attributes['quadSize']?.usage` statt Punktzugriff (`noPropertyAccessFromIndexSignature`).
- Casts `as unknown as VaryingNode<unknown>` in den Specs, weil `VaryingNode` ein Generic verlangt.
