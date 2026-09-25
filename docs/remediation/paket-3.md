# Paket 3 — Sprites-Nachlese: Specs, die prüfen, was sie behaupten, und saubere Doku

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — das Paket trägt einen Nebenbefund (→ Scope) und die
  kleinen Befunde der Reviewer aus Paket 1 und 2
- Folge von: Paket 1, Paket 2
- Ziel: Jede Sprite-Spec aus diesem Lauf fällt, wenn das Verhalten fällt, das ihr Name nennt, und
  Typnamen, TSDoc und CHANGELOG sagen genau, was gilt.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - geändert (Quelltext): `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts`,
    `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts`,
    `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts` (nur TSDoc)
  - geändert (Specs): `packages/twopoint5d/src/sprites/node-utils.spec.ts`,
    `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts`,
    `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.spec.ts`,
    `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.spec.ts`
  - geändert (Doku): `packages/twopoint5d/CHANGELOG.md`,
    `packages/twopoint5d-testing/test/helpers/fixtures.js` (nur Kommentare)
  - nur für die Mutationsproben angefasst und danach **byte-genau zurückgesetzt**:
    `packages/twopoint5d/src/sprites/node-utils.ts`, der Effekt in
    `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`
  - nicht anfassen: `apps/lookbook/**`, alle anderen Browser-Tests, `node-utils.ts` im Endstand,
    jede Laufzeitlogik der beiden Materialien
- Vorgehen:
  1. **Specs zu `colorFromTextureByTexCoords()`** in `node-utils.spec.ts` (heute `:72-96`).
     Oben in der Datei zwei Hilfen neben `operatorOf`/`attributeNameOf` anlegen:
     ```ts
     // every node the graph below `root` is built from, `root` included
     const nodesOf = (root: Node): Set<Node> => {
       const nodes = new Set<Node>();
       root.traverse((node) => nodes.add(node));
       return nodes;
     };

     // the names of the attributes the graph below `root` reads, sorted
     const attributeNamesOf = (root: Node): string[] =>
       [...nodesOf(root)]
         .filter((node): node is AttributeNode => node instanceof AttributeNode)
         .map(attributeNameOf)
         .sort();
     ```
     `AttributeNode` wird dafür als **Wert** aus `three/webgpu` importiert (heute nur `import type`);
     ein `instanceof` ohne das Type-Predicate verengt den Typ nicht — geprüft in Zug 0 mit `tsc`.
     - Test »samples the color map through a varying« (Default) bekommt zusätzlich
       `expect(attributeNamesOf(node.uvNode as unknown as Node)).toEqual(['texCoords', 'uv']);`
       — der Kontrast, ohne den die Aussage des nächsten Tests nichts bedeutet.
     - Test »samples the color map through the texture coordinates and uv it is given«: die beiden
       Knoten in Konstanten `texCoords = vec4(0, 0, 1, 1)` und `uv = vec2(0.5, 0.5)` halten und
       nach den bestehenden Zeilen prüfen:
       `nodesOf(uvNode).has(texCoords)` ist `true`, `nodesOf(uvNode).has(uv)` ist `true`,
       `attributeNamesOf(uvNode)` ist `[]` (mit `uvNode = node.uvNode as unknown as Node`).
       Gemessen in Zug 0 gegen die gebaute Library: Default `['texCoords', 'uv']`, mit beiden
       Parametern `[]`, beide Knoten im Graphen.
  2. **Specs zu `billboardVertexByInstancePosition()`** (heute `:56-70`).
     - Default-Test zusätzlich: `expect(attributeNamesOf(result)).toEqual(['instancePosition', 'position', 'quadSize']);`
       (`result` = Rückgabe der Funktion, vor `operatorOf`).
     - Test »turns the quad about the instance position it is given« zusätzlich:
       `nodesOf(result).has(vertexPosition)` `true`, `nodesOf(result).has(scale)` `true`,
       `attributeNamesOf(result)` `[]`. Neuer Name, weil er nennen muss, was jetzt geprüft wird:
       »turns the quad it is given about the instance position it is given, at the scale it is
       given«.
       Gemessen in Zug 0: Default `['instancePosition', 'position', 'quadSize']`, mit Parametern `[]`,
       alle drei Knoten im Graphen.
  3. **Spec zu `texCoordsFromIndex()`** (heute `:98-102`), ersetzt den Einzeiler; neuer Name
     »divides the center of the cell of the index by the width and height of the map«:
     ```ts
     const mapSize = vec2(4, 4);
     const index = int(5);
     const node = operatorOf(texCoordsFromIndex(mapSize, index));

     expect(node.op).toBe('/');

     // dividend: column and row of the index, moved by half a cell to its center
     const cell = operatorOf(node.aNode);
     expect(cell.op).toBe('+');
     expect(nodesOf(cell.aNode).has(index)).toBe(true);
     expect((unwrap(cell.bNode) as ConstNode<number>).value).toBe(0.5);

     // divisor: the width and the height of the map, in that order, and nothing of the index
     const size = unwrap(node.bNode) as JoinNode;
     const [width, height] = size.nodes as SplitNode[];
     expect(width.node).toBe(mapSize);
     expect(width.components).toBe('x');
     expect(height.node).toBe(mapSize);
     expect(height.components).toBe('y');
     expect(nodesOf(node.bNode).has(index)).toBe(false);
     ```
     `unwrap` ist `operatorOf` ohne den Typ `OperatorNode`: `VarNode` → `.node`, sonst der Knoten
     selbst. Casts nach dem Muster der vorhandenen Hilfen (`as unknown as …`); die Typnamen
     `ConstNode`, `JoinNode`, `SplitNode` kommen als `import type` aus `three/webgpu`. Struktur in
     Zug 0 zur Laufzeit gemessen: `/` → aNode `VarNode(+ (JoinNode, ConstNode 0.5))`, bNode
     `VarNode(JoinNode[SplitNode 'x' von mapSize, SplitNode 'y' von mapSize])`; `index` liegt im
     Dividenden, nicht im Divisor.
  4. **`AnimatedSpritesMaterial.spec.ts` »a time write reaches the uniform and builds no node«**
     (heute `:100-116`): die Aussage über den Uniform aus dem Knotengraphen lesen, nicht über den
     Getter. Dieselbe `nodesOf`-Hilfe lokal in dieser Spec anlegen (keine geteilte Datei: eine
     Hilfsdatei unter `src/` fiele in Coverage und Build) und dazu:
     ```ts
     // the uniforms of the graph below `root` that hold a number — a TextureNode is a uniform too
     const numberUniformsOf = (root: Node) =>
       [...nodesOf(root)].filter(
         (node): node is UniformNode<'float', number> =>
           (node as UniformNode<'float', number>).isUniformNode === true &&
           typeof (node as UniformNode<'float', number>).value === 'number',
       );
     ```
     Im Test vor `material.time = 3`: `const uniforms = numberUniformsOf(texCoordsNode!)`,
     `expect(uniforms).toHaveLength(1)`; nach dem Schreiben `expect(uniforms[0]!.value).toBe(3)`
     statt `expect(material.time).toBe(3)`. Die Zeilen zu `texCoordsNode`, `colorNode`, `version`
     bleiben. Gemessen in Zug 0: genau ein Zahl-Uniform (Startwert `0`) unter `texCoordsNode`
     eines Materials mit `animsMap` von 4 × 4, nach `time = 3` hält er `3`.
  5. **Die beiden Geometrie-Specs**: in `AnimatedSpritesGeometry.spec.ts` (heute `:76-90`) und
     `TexturedSpritesGeometry.spec.ts` (heute `:112-128`) den Test »declares a base pool that is
     always there« teilen:
     - Er behält Name, `expectTypeOf`-Zeile und `expect(geometry.basePool).toBeDefined()`.
     - Ein neuer Test daneben, »declares its base pool read-only (a type-level check)« bzw.
       »declares its pools read-only (a type-level check)«, trägt die nie aufgerufene
       Zuweisungsfunktion mit den `@ts-expect-error`-Zeilen unverändert. Statt
       `expect(assignPool).toBeInstanceOf(Function)` steht `void assignPool;` (bzw.
       `void assignPools;`), darüber ein Kommentar: die `@ts-expect-error`-Zeilen tragen die
       Aussage, `pnpm typecheck` schlägt fehl, sobald das Feld einen Schreibzugriff annimmt;
       Vitest prüft hier nichts. `void` besteht `pnpm lint` (in Zug 0 per `eslint --stdin`
       geprüft), ohne es meldet `@typescript-eslint/no-unused-vars` die Konstante.
  6. **Vertex-Position mit eigenem Typ.** In `TexturedSprite.ts` neben den anderen Aliassen (heute
     `:83-87`, direkt vor `TAttributeNodeInstancePosition`) anlegen:
     ```ts
     /** The position of a vertex of the unit quad a sprite is drawn from, before scale, rotation and instance position. */
     export type TAttributeNodeVertexPosition = Node<'vec3'>;
     ```
     In `TexturedSpritesMaterial.ts` den Import um `TAttributeNodeVertexPosition` ergänzen und ihn
     an `#vertexPositionNode` (heute `:34`) und am Setter `vertexPositionNode` (heute `:78`) statt
     `TAttributeNodeInstancePosition` setzen. `#instancePositionNode` und `instancePositionNode`
     behalten `TAttributeNodeInstancePosition`. Strukturell ist beides `Node<'vec3'>` — kein
     Breaking Change, kein Footer. Der Export läuft über `export *` in `sprites/public-api.ts`,
     dort ist nichts zu tun.
  7. **TSDoc von `AnimatedSpritesMaterialParameters`** (`AnimatedSpritesMaterial.ts:7`), direkt
     über dem Interface:
     ```ts
     /**
      * The options of an {@link AnimatedSpritesMaterial}: those of a
      * {@link TexturedSpritesMaterialParameters} plus the animation lookup and its start time. Every
      * three.js material parameter among them reaches the material through `setValues()`, and
      * without an `alphaTest` or `alphaTestNode` the material drops every texel with an alpha of
      * `0.001` or less.
      */
     ```
     Dazu am Feld `animsMap?` die fehlende Zeile, im Ton der Nachbarzeile zu `time`:
     ```ts
     /** The animation lookup texture. It stays the caller's; {@link AnimatedSpritesMaterial.dispose} does not release it. */
     ```
     Sonst nichts an dieser Datei im Endstand.
  8. **`fixtures.js`**: den Blockkommentar `:176-179` (256-Byte-Ausrichtung) entfernen; die
     Überschrift `// --- sprites and pixels ---` bleibt. Die Bedingung wandert in die JSDoc der
     beiden Funktionen, die sie betrifft:
     - `rgbAt` (heute `:211`):
       ```js
       /**
        * The `[r, g, b]` of the pixel at `x`, `y` of a read-back target `size` pixels wide.
        *
        * The pixels are read at a row length of `size * 4` bytes. WebGPU aligns every row it copies
        * out of a texture to 256 bytes, so that holds for a target 64 pixels wide, or a multiple of
        * it, and nothing else: at another width the rows come back padded and this reads the wrong
        * pixel without a word. Keep the targets of these tests at 64.
        */
       ```
     - `coveredBox` (heute `:222`): die bestehende Zeile bleibt, darunter ein Absatz:
       ```js
       /**
        * The width and height, in pixels, of the box around every pixel the sprite covered.
        *
        * It reads the pixels at a row length of `size * 4` bytes and needs a target 64 pixels wide,
        * or a multiple of it — see {@link rgbAt}.
        */
       ```
  9. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, Skill `updating-changelog` laden):
     - `### Added` im `[Unreleased]`, direkt nach dem Eintrag »export the
       `AnimatedSpritesMaterialParameters` interface …« (heute `:17`), eine Zeile wie alle
       Einträge dort:
       ```
       - add the `TAttributeNodeVertexPosition` type, `Node<'vec3'>`, for the vertex position of the unit quad a sprite is drawn from: `TexturedSpritesMaterial#vertexPositionNode`, and with it that of `AnimatedSpritesMaterial`, is typed by it, beside `TAttributeNodeInstancePosition` for the position of the sprite
       ```
     - Migration Guide, Abschnitt »A mesh built without a geometry is typed with the
       `BufferGeometry` it holds« (heute `:1540-1545`): den Absatz neu umbrechen, Wortlaut
       unverändert, so:
       ```
       `VertexObjects<GeoType>`, `TileSprites<GeoType>` and `AnimatedSprites<GeoType>` take their
       geometry type from the constructor argument. Built without one, `geometry` is typed
       `BufferGeometry | undefined`, not `VOBufferGeometry`/`TileSpritesGeometry`/`AnimatedSpritesGeometry`
       — reading a member of the more specific geometry needs an `instanceof` check, or the mesh built
       with its geometry in the first place. The same holds for `tileSprites.material`, typed
       `TileSpritesMaterial | MeshBasicMaterial | undefined`, and for `animatedSprites.material`, typed
       `AnimatedSpritesMaterial | MeshBasicMaterial | undefined`.
       ```
       (längste Zeile 100 Zeichen, die Nachbarabsätze liegen bei 83–97).
     - Migration Guide, die beiden Zeilen zu `TexturedSpritesGeometry#basePool`/`#instancedPool`
       (heute `:1597-1598`, unter »`AnimatedSprites` takes an `AnimatedSpritesMaterial` …«)
       bekommen eine eigene Überschrift an derselben Stelle, vor »`TexturedSprites#spritePool`
       and `#texture` can be `undefined`«:
       ```
       #### `TexturedSpritesGeometry` keeps the pools it was built with

       `TexturedSpritesGeometry#basePool` and `#instancedPool` are read-only. The geometry builds its
       attributes on the pools it was constructed with; a pool written there afterwards was never drawn.
       A geometry on other pools is a geometry of its own: build a new `TexturedSpritesGeometry` with
       the `capacity` and the `attributeUsage` it needs.
       ```
       Die ersten beiden Sätze sind die heutigen, verschoben; der dritte ist neu.
  10. **Mutationsproben** — der Beleg, dass die Specs aus 1–4 fallen, wenn das Verhalten fällt.
      Jede Probe einzeln: Mutation setzen, die genannte Spec laufen lassen, den roten Lauf
      (Testname und Assertion) in den Report, Mutation zurücksetzen. Kommando je Probe:
      `pnpm nx test twopoint5d -- <spec-pfad>`.
      - a) `node-utils.ts:81-82`: `params?.texCoords ?? attribute('texCoords')` →
        `attribute('texCoords')` und `params?.uv ?? attribute('uv')` → `attribute('uv')`;
        rot muss »samples the color map through the texture coordinates and uv it is given« werden.
      - b) `node-utils.ts:56`: `params?.vertexPosition ?? attribute('position')` →
        `attribute('position')`; rot muss der Test aus Schritt 2 mit Parametern werden.
      - c) `node-utils.ts:55`: `params?.scale ?? attribute('quadSize')` → `attribute('quadSize')`;
        derselbe Test rot.
      - d) `node-utils.ts:98`: `vec2(mapSize.x, mapSize.y)` → `vec2(mapSize.x, mapSize.x)`;
        rot muss der Test aus Schritt 3 werden.
      - e) `AnimatedSpritesMaterial.ts:74`: `const time = this.#timeUniform;` →
        `const time = uniform(this.#timeUniform.value);`; rot muss der Test aus Schritt 4 werden
        (die heutige Fassung bliebe hier grün — genau das ist ihr Mangel).
      Nach der letzten Probe: `git diff -- packages/twopoint5d/src/sprites/node-utils.ts` ist leer,
      `git diff -- packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`
      zeigt nur die TSDoc aus Schritt 7.
- Verify: `pnpm run ci`
  - schnelle Schleife während der Arbeit: `pnpm nx test twopoint5d -- src/sprites`, `pnpm typecheck`
    (die `@ts-expect-error`- und `expectTypeOf`-Zeilen prüft nur `pnpm typecheck`), `pnpm lint`
- Commit (Subject allein, kein Footer — keine Oberfläche bricht):
  - Subject: `feat(sprites): type the vertex position node of the sprite materials by a TAttributeNodeVertexPosition of its own, and let the sprite specs fail when the behaviour they name breaks`
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · Nebenbefund `TexturedSpritesMaterial.ts:34`, `:78` unverändert → Schritt 6 · Folgen aus Paket 2: `node-utils.spec.ts:85-95`, `:64-69`, `:99-101` unverändert → Schritte 1–3 · `AnimatedSpritesMaterial.spec.ts:108` unverändert → Schritt 4 · `AnimatedSpritesGeometry.spec.ts:87`, `TexturedSpritesGeometry.spec.ts:125` unverändert → Schritt 5 · CHANGELOG-Umbruch umgeformt: `### Changed` `:105` gegenstandslos (Hausstil), ungewrappt ist `:1542` im Migration Guide → Schritt 9 · `readonly` unter AnimatedSprites-Überschrift unverändert `:1597-1598` → Schritt 9 · Folgen aus Paket 1: `AnimatedSpritesMaterial.ts:7` unverändert → Schritt 7 · `fixtures.js:176-179` unverändert → Schritt 8 · »Offene Befunde«: 4 Einträge, keiner mit gleicher Ursache, alle bleiben liegen · Restplan: kein offenes Paket nach 3, keine Umsortierung
  - 2026-09-25 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-3.impl-1.json`
  - 2026-09-25 Zug 2: Report FERTIG · 9 Dateien geändert (7 unter `src/sprites/`, CHANGELOG, `fixtures.js`), keine neuen · Mutationsproben a–e rot belegt · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-3.verify.log`)
  - 2026-09-25 Zug 3: Reviewer (sonnet, low) — alle Punkte erfüllt, 0 kritisch, 0 wichtig, 1 klein · Diff `paket-3.diff`, Report `paket-3.review-1.json`
  - 2026-09-25 Zug 4: entfällt, keine Runde ausgelöst
  - 2026-09-25 Zug 5: Commit 0d982277, Verify `paket-3.verify.log` exit=0

## Abgleich

Gegen `main` auf `aceff5f0`, Arbeitsbaum sauber.

| Eintrag | Fundstelle jetzt | Einordnung |
| --- | --- | --- |
| Nebenbefund `vertexPositionNode` als `TAttributeNodeInstancePosition` | `TexturedSpritesMaterial.ts:34`, `:78` | unverändert |
| `node-utils.spec.ts` texCoords/uv-Test prüft dasselbe wie der Default | `node-utils.spec.ts:85-95` | unverändert |
| `node-utils.spec.ts` Billboard-Test prüft nur `op`/`aNode` | `node-utils.spec.ts:64-69` | unverändert |
| `node-utils.spec.ts` `texCoordsFromIndex` prüft nur `op === '/'` | `node-utils.spec.ts:99-101` | unverändert |
| Time-Test liest den Getter | `AnimatedSpritesMaterial.spec.ts:108` | unverändert |
| `expect(assignPool).toBeInstanceOf(Function)` dekorativ | `AnimatedSpritesGeometry.spec.ts:87`, `TexturedSpritesGeometry.spec.ts:125` | unverändert |
| CHANGELOG `### Changed`: `AnimatedSprites<GeoType …>` ungewrappt und länger | `CHANGELOG.md:105` (483 Zeichen) — jeder Eintrag des Abschnitts ist eine einzige Zeile (86–1048 Zeichen), die Nachbarn `:103`/`:104` haben 451/445 | **dort gegenstandslos**; der gemeinte Umbruchfehler steht im Migration Guide `CHANGELOG.md:1542` (155 Zeichen zwischen Zeilen von 83–97), entstanden in `aceff5f0` → umgeformt, Schritt 9 |
| CHANGELOG Migration Guide: `readonly`-Aussage unter AnimatedSprites-Überschrift | `CHANGELOG.md:1572` (Überschrift), `:1597-1598` (Aussage) | unverändert |
| `AnimatedSpritesMaterialParameters` ohne eigenes TSDoc | `AnimatedSpritesMaterial.ts:7` — kein TSDoc am Interface, keines an `animsMap?` | unverändert |
| 256-Byte-Kommentar als Block am Abschnittsanfang | `fixtures.js:176-179` | unverändert |

## Entscheidungen in Zug 0

- **Eigener Alias statt nacktem `Node<'vec3'>`.** Jeder Knoten-Accessor des Materials hat seinen
  Alias aus der `TAttributeNode…`-Familie (`quadSizeNode` ↔ `TAttributeNodeQuadSize`,
  `instancePositionNode` ↔ `TAttributeNodeInstancePosition` …); nur `vertexPositionNode` borgt sich
  einen fremden. Ein Alias nach dem Accessor-Namen hält die Familie geschlossen. Das ist eine
  additive Erweiterung der öffentlichen Oberfläche (`### Added`), strukturell identisch, also
  nicht breaking. Deshalb `feat` im Commit statt `fix`.
- **`nodesOf`-Hilfe je Spec, nicht geteilt.** Eine Datei unter `src/` außerhalb von `*.spec.ts`
  fiele in die Coverage (`src/**/*.ts`) und in den Build; ein Fünfzeiler in zwei Specs kostet
  weniger.
- **Typtest ehrlich machen, nicht ersetzen.** `expectTypeOf(...).toEqualTypeOf` unterscheidet den
  `readonly`-Modifier nicht (Befund des Implementierers in Paket 2); die
  `@ts-expect-error`-Zuweisung bleibt der Beleg. Der Test bekommt einen Namen, der ihn als
  Typprüfung ausweist, und `void` statt einer Laufzeit-Assertion, die nichts prüft.
- **Mutationsproben statt Regressionstest-Rotlauf.** Das Paket behebt keinen Laufzeitfehler, es
  härtet Specs gegen bestehendes, korrektes Verhalten. Der rote Lauf, der beweist, dass eine Spec
  etwas prüft, entsteht deshalb durch eine gezielte, danach zurückgenommene Mutation des
  Quelltexts — je Spec eine, benannt in Schritt 10.
- **Migrationshinweis zu den Pools mit Ausweg.** Unter eigener Überschrift braucht der Abschnitt,
  was ein Aufrufer stattdessen tut; der Konstruktor nimmt keine Pools entgegen
  (`TexturedSpritesGeometry.ts:41-44`), also neue Geometrie mit `capacity`/`attributeUsage`.

## Findings im Volltext

**Nebenbefund · low · `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:34`, `:78`**
— Signal `#vertexPositionNode` und Setter `vertexPositionNode` sind als
`TAttributeNodeInstancePosition` typisiert, tragen aber die Vertex-Position. Vorbestehend, aus
Zug 2 von Paket 1, Urteil → Scope (liegt in `src/sprites/**`).

**Folgen aus Paket 2** (Reviewer `paket-2.review-1.json`, »Kleine Befunde«):

- `node-utils.spec.ts` »samples the color map through the texture coordinates and uv it is given«
  prüft dasselbe wie der Default-Test; ignorierte die Funktion `texCoords`/`uv`, bliebe er grün.
- `node-utils.spec.ts` »turns the quad about the instance position it is given« prüft nur `op` und
  `aNode`; `vertexPosition` und `scale` blieben unbemerkt.
- `node-utils.spec.ts` »divides the cell of the index by the size of the map« prüft nur
  `op === '/'`, nicht die Operanden.
- `AnimatedSpritesMaterial.spec.ts` »a time write reaches the uniform and builds no node« liest
  `material.time` über den Getter, nicht den Uniform-Wert.
- `AnimatedSpritesGeometry.spec.ts`, `TexturedSpritesGeometry.spec.ts`:
  `expect(assignPool).toBeInstanceOf(Function)` ist dekorativ, die Aussage tragen nur die
  `@ts-expect-error`-Zeilen (geprüft von `pnpm typecheck`).
- `packages/twopoint5d/CHANGELOG.md` `### Changed`: der neue `AnimatedSprites<GeoType …>`-Eintrag
  ist ungewrappt und deutlich länger als seine Nachbarn.
- `packages/twopoint5d/CHANGELOG.md` Migration Guide: die `readonly`-Aussage zu
  `TexturedSpritesGeometry` steht unter einer Überschrift, die nur `AnimatedSprites` nennt.

**Folgen aus Paket 1** (Reviewer `paket-1.review-2.json`, »Kleine Befunde«):

- `AnimatedSpritesMaterialParameters` (`AnimatedSpritesMaterial.ts:7`) trägt den alphaTest-Hinweis
  nur über den geerbten Typ, nicht im eigenen TSDoc.
- Der Kommentar zur 256-Byte-Ausrichtung steht als Block am Abschnittsanfang von
  `fixtures.js:176-179`, nicht an `rgbAt`/`coveredBox`; er nennt beide beim Namen.

## Urteil des Reviewers

- Nebenbefund `vertexPositionNode`: behoben — `TexturedSprite.ts:83-84`, `TexturedSpritesMaterial.ts:34`, `:78`
- Schritte 1–3 (`node-utils.spec.ts`): erfüllt; Casts präzisiert zu `ConstNode<'float', number>`, `JoinNode<'vec2'>` (die Vorlage compilierte nicht)
- Schritt 4: erfüllt — `AnimatedSpritesMaterial.spec.ts:216-229`, `:252-258`
- Schritt 5: erfüllt — beide Geometrie-Specs geteilt, `void assignPool(s)`
- Schritt 7: erfüllt — `AnimatedSpritesMaterial.ts:7-15`
- Schritt 8: erfüllt — `fixtures.js`, JSDoc an `rgbAt`/`coveredBox`
- Schritt 9: erfüllt — CHANGELOG `### Added`, Migration Guide umbrochen, eigene Pool-Überschrift
- Schritt 10: Mutationsproben a–e vom Implementierer rot belegt; `node-utils.ts` unverändert, `AnimatedSpritesMaterial.ts` nur TSDoc
- Klein: `TexturedSpritesMaterial.ts:6-10` — `TAttributeNodeVertexPosition` steht im Import vor `TAttributeNodeQuadSize`, nicht alphabetisch
