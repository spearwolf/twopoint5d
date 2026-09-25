# Remediation-Plan — twopoint5d (Sprites)

Quelle: ./audit.html vom 2026-09-24 · Branch: main · erstellt: 2026-09-25
Baseline: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser)
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/63e1010a-9f1d-4e3f-9de0-3c1460fd486e/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 9 von 151 Findings (4 medium, 5 low) — alle Findings der Komponente `sprites` plus TEST-009 (Browser-Suite, betrifft die Sprite-Materialien) · ausgenommen: alle übrigen Komponenten, acknowledged
Scope-Regel: alles, was in den Feature-Domains »Sprites« (`packages/twopoint5d/src/sprites/**` samt der Tests, die sie abdecken) oder »Vertex Objects« (`packages/twopoint5d/src/vertex-objects/**` samt Tests) liegt, jede Severity, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen. Ziel: beide Domains ohne offenes Finding. Befunde in anderen Domains → Audit.
Kaltstarts: 2 Pakete × mindestens 3 Agenten ≈ 6, je Nachrunde zwei mehr · 4,5 Findings je Paket
Stand (2026-09-25): Lauf abgeschlossen — 4 Pakete committet (`deeddeea`, `aceff5f0`, `0d982277`, `9eae955d`), nichts blockiert; 4 Nebenbefunde als TEST-047, PERF-032, TYPE-024, DOC-070 ins Audit übergeben; Report: docs/remediation/20260925-remediation-report.md

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` blockiert.

## Entscheidungen
- IMPL-013: Das Instanzattribut `color` wird im Shader ausgewertet (Textur-Sample × `attribute('color')`), für TexturedSprites und AnimatedSprites; Attribut und Methoden bleiben. Nicht breaking, weil der Default Weiß ist (2026-09-25)
- API-038 + TYPE-023: `AnimatedSprites` wird wie `TileSprites` generisch über die Geometrie mit Default `BufferGeometry`; der Konstruktor nimmt nur `AnimatedSpritesMaterial`, das Feld heißt `AnimatedSpritesMaterial | MeshBasicMaterial | undefined`. Breaking auf Typebene: CHANGELOG-Eintrag, eigene Aufrufer (Lookbook, Tests) werden mitgezogen (2026-09-25)
- API-059: Die Deklaration `basePool: TexturedSpritesBasePool` gilt — `TexturedSpritesGeometry` übergibt immer einen Base-Deskriptor; das `?.` entfällt. Gleiches Muster in `AnimatedSpritesGeometry` mit prüfen (2026-09-25)
- TEST-009 gehört in den Scope, obwohl es keiner Komponente zugeordnet ist (2026-09-25)
- Commits direkt auf `main`, ohne GPG-Signatur (2026-09-25)

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
- Commit-Messages auf Englisch im Conventional-Commits-Stil des `git log`
  (`fix(sprites): …`, `test(sprites): …`).
- Verify-Gate vor jedem Commit: `pnpm run ci` (AGENTS.md). Öffentliche API-Änderungen
  bekommen einen Eintrag in `packages/twopoint5d/CHANGELOG.md` (Skill `updating-changelog`).
- Browser-Tests in `packages/twopoint5d-testing/test/` laufen gegen die gebaute Library.

## Vorbestehende Fehler
- keine

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.


## Pakete

### [x] 1. Sprite-Materialien: Billboards, Tint, Parameter, Teardown — mit Pixel-Tests
- Findings: BUG-116 (medium), IMPL-013 (medium), API-027 (medium), PERF-023 (low), TEST-009 (low)
- Ziel: Die Sprite-Materialien rendern transformierte Billboards und den Instanz-Tint korrekt, reichen three.js-Parameter durch und bauen beim dispose() nichts mehr neu — abgesichert durch Browser-Tests, die Pixel zurücklesen.
- Bereich: `packages/twopoint5d/src/sprites/node-utils.ts`, `packages/twopoint5d/src/sprites/*/…Material.ts`, `packages/twopoint5d-testing/test/`
- Detail: docs/remediation/paket-1.md
- Hängt ab von: —
- Hash: deeddeea
- Ergebnis: 2 Runden · BUG-116, IMPL-013, API-027, PERF-023, TEST-009 (Sprite-Teil) behoben · Regressionstests vor dem Fix rot: `sprites-billboard.test.js` (3 Tests, 0 px statt 32 × 8), `sprites-textured-material.test.js` »tints the color map by the color of the sprite« und »does not draw a sprite whose color has an alpha of 0«, Specs `parameters` (4) und `builds no node on the way out` (2) in beiden Material-Specs · Vorbehalt: Chromium lief lokal über den WebGL2-Fallback, ein echtes WebGPU-Backend ist für die Pixel-Tests nicht belegt · Commit trägt `BREAKING CHANGE:`-Footer, CHANGELOG `### Changed` plus Migration Guide
- Nebenbefunde: → Queue (2)
- Folgen: Paket 2 (TEST-005, Empfehlung 3) kann nicht mehr assertieren, dass `colorMap` den `colorNode` zu einem `TextureNode` macht — `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:169-181` baut `mul(<Sample>, vertexColor())`; gehört in den Detailplan von Paket 2 → verteilt 2026-09-25: Paket 2, Detailplan Schritt 8 (Ersatz-Assertion auf `mul(TextureNode, VertexColorNode)`)
- Schnittstellen: `TexturedSpritesMaterialParameters extends Omit<NodeMaterialParameters, 'positionNode' | 'colorNode'>` (vererbt an `AnimatedSpritesMaterialParameters`); beide Konstruktoren wenden den Rest per `setValues()` an, `AnimatedSpritesMaterial` nimmt `animsMap`/`time` vor `super()` heraus; `alphaTestNode = float(0.001)` nur ohne `alphaTest`/`alphaTestNode` in den Optionen · `TexturedSpritesMaterial#colorNode` = `mul(<colorMap-Sample | vec4(0.5, 0.5, 0.5, 1)>, vertexColor())` · `dispose()` beider Materialien zerstört zuerst die eigenen Effekt-Handles (`#positionEffect`, `#colorEffect`, `#texCoordsEffect`); `version`, `colorNode`, `positionNode` ändern sich durch `dispose()` nicht · `billboardVertexByInstancePosition()` liest `modelWorldMatrixInverse` · `packages/twopoint5d-testing/test/helpers/fixtures.js` exportiert `coveredBox`, `renderToPixels`, `makeColorTexture`, `rgbAt`, `isNearColor` (Zeilenlänge `size * 4`, Targets bei 64 px halten)

### [x] 2. Sprite-Klassen und Geometrien: ehrliche Typen und Spec-Abdeckung
- Findings: API-038 (low), TYPE-023 (low), API-059 (low), TEST-005 (medium) · dazu Nebenbefund `TexturedSpritesGeometry.ts:35-36` (`readonly` der Pool-Felder, gleiche Ursache wie API-059)
- Ziel: `AnimatedSprites` und die Sprite-Geometrien deklarieren, was sie tatsächlich halten, und Geometrien, Sprites, node-utils und die Effektpfade der Materialien sind mit Specs abgedeckt.
- Bereich: `packages/twopoint5d/src/sprites/**` (Klassen, Geometrien, Specs), Aufrufer in `apps/lookbook`
- Detail: docs/remediation/paket-2.md
- Hängt ab von: 1 (die Material-Specs aus TEST-005 prüfen die in Paket 1 umgebaute Effekt-Verdrahtung)
- Hash: aceff5f0
- Ergebnis: 1 Runde · API-038, TYPE-023, API-059, TEST-005 und Nebenbefund `readonly` an `TexturedSpritesGeometry` behoben · Typtests vor der Typänderung rot (`pnpm typecheck`, 9 Fehler): `AnimatedSprites.spec.ts` »an AnimatedSprites built without a geometry or a material is typed with what THREE.Mesh puts there«, »takes an AnimatedSpritesMaterial only«, »declares a base pool that is always there« in beiden Geometrie-Specs · neue Specs `TexturedSpritesGeometry.spec.ts`, `AnimatedSpritesGeometry.spec.ts`, `node-utils.spec.ts`, Block `node wiring` in beiden Material-Specs · 8 kleine Befunde des Reviewers in der Paketdatei (Spec-Namen, die mehr behaupten, als sie prüfen; CHANGELOG-Umbruch) · Commit trägt `BREAKING CHANGE:`-Footer, CHANGELOG `### Changed` plus Migration Guide
- Nebenbefunde: keine neuen (`TileSpritesGeometry.ts:7-10` stand seit Zug 0 in der Queue)
- Folgen: keine — Lookbook-Aufrufer und Browser-Tests compilieren unverändert (`pnpm typecheck` grün)
- Schnittstellen: `AnimatedSprites<GeoType extends AnimatedSpritesGeometry | BufferGeometry = BufferGeometry> extends VertexObjects<GeoType>` · `constructor(geometry?: GeoType, material?: AnimatedSpritesMaterial)` · `AnimatedSprites#material: AnimatedSpritesMaterial | MeshBasicMaterial | undefined` · `AnimatedSpritesGeometry#basePool: readonly VertexObjectPool<BaseSprite>` (ohne `undefined`) · `TexturedSpritesGeometry#basePool`/`#instancedPool` `readonly`

### [x] 3. Sprites-Nachlese: Specs, die prüfen, was sie behaupten, und saubere Doku
- Folge von: Paket 1, Paket 2
- Nebenbefund: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:34`, `:78` — Signal `#vertexPositionNode` und Setter `vertexPositionNode` sind als `TAttributeNodeInstancePosition` typisiert, tragen aber die Vertex-Position (low, aus Paket 1, → Scope)
- Folgen aus Paket 2 (Review, »Kleine Befunde« in `docs/remediation/paket-2.md`):
  - `node-utils.spec.ts` »samples the color map through the texture coordinates and uv it is given« prüft dasselbe wie der Default-Test — bliebe grün, wenn `texCoords`/`uv` ignoriert würden
  - `node-utils.spec.ts` »turns the quad about the instance position it is given« prüft nur `op` und `aNode`, nicht `vertexPosition` und `scale`
  - `node-utils.spec.ts` »divides the cell of the index by the size of the map« prüft nur `op === '/'`, nicht die Operanden
  - `AnimatedSpritesMaterial.spec.ts` »a time write reaches the uniform and builds no node« liest `material.time` über den Getter statt den Uniform-Wert
  - `AnimatedSpritesGeometry.spec.ts`, `TexturedSpritesGeometry.spec.ts`: `expect(assignPool).toBeInstanceOf(Function)` ist dekorativ — die Aussage tragen allein die `@ts-expect-error`-Zeilen; ehrlich formulieren (Spec-Name/Kommentar) statt eine Laufzeitaussage vorzutäuschen
  - `packages/twopoint5d/CHANGELOG.md` `### Changed`: der `AnimatedSprites<GeoType …>`-Eintrag ungewrappt und deutlich länger als seine Nachbarn — Abgleich Zug 0: im `### Changed` ist jeder Eintrag eine Zeile (Hausstil), der ungewrappte Absatz steht im Migration Guide, `CHANGELOG.md:1542`
  - `packages/twopoint5d/CHANGELOG.md` Migration Guide: die `readonly`-Aussage zu `TexturedSpritesGeometry` steht unter einer Überschrift, die nur `AnimatedSprites` nennt
- Folgen aus Paket 1 (Review, »Urteil des Reviewers« in `docs/remediation/paket-1.md`):
  - `AnimatedSpritesMaterialParameters` (`AnimatedSpritesMaterial.ts:7`) trägt den alphaTest-Hinweis nur über den geerbten Typ, nicht im eigenen TSDoc
  - `packages/twopoint5d-testing/test/helpers/fixtures.js:176-179`: der Kommentar zur 256-Byte-Ausrichtung steht als Block am Abschnittsanfang statt an `rgbAt`/`coveredBox`
- Ziel: Jede Sprite-Spec aus diesem Lauf fällt, wenn das Verhalten fällt, das ihr Name nennt, und Typnamen, TSDoc und CHANGELOG sagen genau, was gilt.
- Bereich: `packages/twopoint5d/src/sprites/**` (Specs, `TexturedSprite.ts`, `TexturedSpritesMaterial.ts`, `AnimatedSpritesMaterial.ts`), `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d-testing/test/helpers/fixtures.js`
- Detail: docs/remediation/paket-3.md
- Hängt ab von: 2
- Hash: 0d982277
- Ergebnis: 1 Runde · Nebenbefund `vertexPositionNode`-Typ und alle Folgen aus Paket 1 und 2 behoben (Reviewer: alle Punkte erfüllt, keine Befunde über »klein«) · Mutationsproben vor dem Commit rot: `node-utils.spec.ts` »samples the color map through the texture coordinates and uv it is given«, »turns the quad it is given about the instance position it is given, at the scale it is given« (zwei Proben), »divides the center of the cell of the index by the width and height of the map«, `AnimatedSpritesMaterial.spec.ts` »a time write reaches the uniform and builds no node« · klein: Importreihenfolge in `TexturedSpritesMaterial.ts:6-10`
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: neuer Export `TAttributeNodeVertexPosition = Node<'vec3'>` (`TexturedSprite.ts`, über `sprites/public-api.ts`) · `TexturedSpritesMaterial#vertexPositionNode` typisiert als `TAttributeNodeVertexPosition`

### [x] 4. Importreihenfolge in TexturedSpritesMaterial
- Folge von: Paket 3 — ausgelöst durch dessen Schritt 6, den Fix des vorbestehenden Nebenbefunds `vertexPositionNode`; erste Generation, nicht dritte (Begründung in der Paketdatei)
- Folge aus Paket 3 (Review, klein, `docs/remediation/paket-3.md`): `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:6-10` — `TAttributeNodeVertexPosition` steht im `import type` vor `TAttributeNodeQuadSize`, nicht alphabetisch wie die übrigen Namen
- Ziel: Der Typimport aus `./TexturedSprite.js` ist alphabetisch sortiert wie seine Nachbarn.
- Bereich: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts`
- Detail: docs/remediation/paket-4.md
- Hängt ab von: 3
- Hash: 9eae955d
- Ergebnis: 1 Runde · Folge aus Paket 3 behoben (Reviewer: erfüllt, keine Befunde über »klein«) · kein Regressionstest, keine Verhaltensänderung
- Nebenbefunde: keine
- Folgen: keine

