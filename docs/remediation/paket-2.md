# Paket 2 — Sprites und map2d: Slot-Reset neuer Sprites, Labels der Geometrie-Args, Fehlermeldungen der TileSpritesFactory

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Nebenbefunde (Drain-Runde, keine Audit-Findings): Slot-Reset `TexturedSprite` (low) · Slot-Reset
  `AnimatedSprite` (low) · Tupel-Labels `makeBaseSpriteArgs` (info) · Fehlermeldungen
  `TileSpritesFactory#createTile()` (info) — Wortlaut unten unter »Nebenbefunde im Volltext«
- Ziel: Ein Sprite aus `createSprite()` beginnt ohne Werte seines Slot-Vorgängers, die Geometrie-Args
  heißen nach dem, was sie tragen, und `TileSpritesFactory#createTile()` nennt sich und das fehlende
  Feld in seinen Fehlern.
- Modell: mittlere Stufe (`sonnet`)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts` (nur TSDoc)
  - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprite.ts`
  - `packages/twopoint5d/src/sprites/BaseSprite.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`
  - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts`
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`
  - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprites.spec.ts`
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci` (das Pre-Commit-Gate; vorher `pnpm format`, damit `prettier --check` in
  `pnpm lint` nicht an Zeilenumbrüchen scheitert)
- Commit: `fix(sprites,map2d): let a sprite from TexturedSprites#createSprite() or from the pool of an AnimatedSpritesGeometry start with its size, tex coords, animation, position and rotation at 0 whatever its slot held, name the half width and half height the base sprite args of both sprite geometries and BaseSprite#make() take, and let TileSpritesFactory#createTile() name itself, the field to set and the tile when it has no tile data provider or tile set`
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · Slot-Reset `TexturedSprite` unverändert
    (`TexturedSprite.ts:67-73`), dazu `texCoords` gleicher Ursache aufgenommen · Slot-Reset
    `AnimatedSprite` unverändert (`AnimatedSprite.ts:22-30`), dazu `quadSize`, `instancePosition`,
    `rotation` · Labels unverändert (`TexturedSpritesGeometry.ts:19`, `AnimatedSpritesGeometry.ts:19`),
    dazu `BaseSprite.ts:34` gleicher Ursache · Fehlermeldungen unverändert
    (`TileSpritesFactory.ts:45,50,52`), Zeile 52 als echte Invariante ausgenommen · Folgen aus Paket 1
    und 1a: keine · Queue: Eintrag `FrameBasedAnimations.ts:104` bleibt (andere Ursache), neu
    `OrthographicProjection.ts:133`/`ParallaxProjection.ts:136` → Audit · Restplan:
    Paket 2 ist das einzige offene Paket, keine Folgen offen, kein Queue-Eintrag im Scope teilt die
    Ursache — Reihenfolge und Schnitt bleiben
  - 2026-09-26 Zug 1: Implementierer beauftragt (sonnet, medium), Report nach `paket-2.impl-0.json`
  - 2026-09-26 Zug 2: Report FERTIG · 11 Dateien geändert (7 Quellen, 3 Specs, CHANGELOG) · roter Lauf 4 failed / 46 passed belegt · Arbeitsbaum schmutzig · Verify `pnpm format && pnpm run ci` exit=0 (`paket-2.verify.log`)
  - 2026-09-26 Zug 3: Reviewer (sonnet, medium) · alle vier Nebenbefunde behoben · kritisch 0, wichtig 0, klein 4 · Diff `paket-2.diff`, Report `paket-2.review-0.json`
  - 2026-09-26 Zug 4: keine Runde nötig
  - 2026-09-26 Zug 5: committet `980a01e5` auf dem Verify aus Zug 2 (keine Änderung seither) · 1 Nebenbefund aus dem Review in »Offene Befunde« (→ Scope)

## Vorgehen

Vor der ersten Zeile `AGENTS.md` im Repo-Root lesen. Code, Kommentare und Doku auf Englisch.
Relative Imports mit `.js`-Suffix, Typen mit `import type`.

Reihenfolge: erst die Tests (Schritte 1–3), rot sehen, den roten Lauf mitschneiden, dann die
Umsetzung (Schritte 4–8), dann CHANGELOG (Schritt 9). Der rote Lauf:

```bash
pnpm nx test twopoint5d -- src/sprites/TexturedSprites/TexturedSprites.spec.ts src/sprites/AnimatedSprites/AnimatedSprites.spec.ts src/map2d/TileSprites/TileSpritesFactory.spec.ts
```

Erwartet rot: der neue Test aus Schritt 1 (`quadSize`, `texCoords`, `instancePosition`, `rotation`
lesen 7), der aus Schritt 2 (alle fünf Komponenten lesen 7), beide Tests aus Schritt 3 (alte Meldung
`expected the … of this factory to be defined`). Die Ausgabe gehört in den Report.

### 1. Regressionstest `TexturedSprites.spec.ts`

Neuer Test direkt nach dem bestehenden Test
`createSprite() hands out a sprite that starts upright and untrimmed, whatever its slot held before`
(heute Zeile 137–159; der bestehende Test bleibt unverändert stehen). Name:

`createSprite() hands out a sprite with every attribute at the value of an unused slot — 0, and white as its color — whatever its slot held before`

Ablauf, mit den vorhandenen Imports der Datei:

```ts
const sprites = new TexturedSprites(4);
const pool = sprites.spritePool!;
sprites.createSprite();
const second = sprites.createSprite()!;
// 7 in every element of every buffer stands for whatever the two sprites were given
for (const {typedArray} of pool.buffer.buffers.values()) typedArray!.fill(7);

// the last sprite of the pool goes back, and the next createSprite() takes its slot again
sprites.freeSprite(second);
sprites.createSprite();

// every attribute the description declares, so that one added later is held to the reset as well
const names = [...pool.descriptor.attributeNames];
const slot = pool.buffer.toAttributeArrays(names, 1, 2);
for (const name of names) {
  const {size} = pool.descriptor.getAttribute(name)!;
  const expected = name === 'color' ? [1, 1, 1, 1] : new Array<number>(size).fill(0);
  expect(Array.from(slot[name]!), `${name} of the new sprite`).toEqual(expected);
}

sprites.dispose();
```

`VertexObjectBuffer#toAttributeArrays(names, startIndex, endIndex)` ist öffentlich, `endIndex`
exklusiv; einen eigenen Lesehelfer braucht der Test nicht.

### 2. Regressionstest `AnimatedSprites.spec.ts`

Neuer Test direkt nach `the sprite methods write every value they are given` (heute Zeile 19–34).
Name:

`a sprite out of the pool of an AnimatedSpritesGeometry starts with every attribute at 0, whatever its slot held before`

```ts
const geometry = new AnimatedSpritesGeometry(2);
const pool = geometry.instancedPool;
pool.createVO();
const second = pool.createVO()!;
// 7 in every element of every buffer stands for whatever the two sprites were given
for (const {typedArray} of pool.buffer.buffers.values()) typedArray!.fill(7);

pool.freeVO(second);
pool.createVO();

const names = [...pool.descriptor.attributeNames];
const slot = pool.buffer.toAttributeArrays(names, 1, 2);
for (const name of names) {
  const {size} = pool.descriptor.getAttribute(name)!;
  expect(Array.from(slot[name]!), `${name} of the new sprite`).toEqual(new Array<number>(size).fill(0));
}

geometry.dispose();
```

`AnimatedSpritesGeometry` ist in der Datei schon importiert. Die Attribute sind `quadSize`, `anim`
(`animId`, `animOffset`), `instancePosition`, `rotation`.

### 3. Tests `TileSpritesFactory.spec.ts`

a) Den bestehenden Test `a factory without a tile set leaves the instanced pool as it found it`
(heute Zeile 44–51) umbenennen in
`a factory without a tile set throws an Error naming the method, the field and the tile, and leaves the instanced pool as it found it`
und die Erwartung ersetzen:

```ts
const call = () => factory.createTile(new Map2DTileCoords(0, 0));
expect(call).toThrow(Error);
expect(call).toThrow(
  'TileSpritesFactory#createTile() has no tileSet to look up tile id 1 of tile 0,0 in: set TileSpritesFactory#tileSet before the factory builds tiles',
);
expect(pool.usedCount, 'usedCount after a throw').toBe(0);
```

b) Neuer Test direkt danach:
`a factory without a tile data provider throws an Error naming the method, the field and the tile, and leaves the instanced pool as it found it`

```ts
const tileSprites = new TileSprites(new TileSpritesGeometry(4));
const factory = new TileSpritesFactory(tileSprites, makeTileSet());
const pool = tileSprites.geometry!.instancedPool;

const call = () => factory.createTile(new Map2DTileCoords(2, 3));
expect(call).toThrow(Error);
expect(call).toThrow(
  'TileSpritesFactory#createTile() has no tileDataProvider to read tile 2,3 from: set TileSpritesFactory#tileDataProvider before the factory builds tiles',
);
expect(pool.usedCount, 'usedCount after a throw').toBe(0);
```

### 4. `TexturedSprite.ts` — `[voInitialize]()` (heute Zeile 67–73)

Setzt jedes Attribut des Deskriptors auf den Wert eines unbenutzten Slots — 0, die Farbe weiß.
Reihenfolge wie im `TexturedSpriteDescriptor`:

```ts
[voInitialize]() {
  // the slot createVO() hands out still carries the values of the sprite that stood in it before;
  // a new sprite starts from the values of a slot no sprite has stood in — 0 in every attribute,
  // and white as the color that tints it
  this.setQuadSize(0, 0);
  this.setTexCoords(0, 0, 0, 0);
  this.texFlipDiagonal = 0;
  this.setTexTrim(0, 0, 0, 0);
  this.setInstancePosition(0, 0, 0);
  this.rotation = 0;
  this.setColorValues(1, 1, 1, 1);
}
```

Die TSDoc an `texFlipDiagonal` (»A sprite out of `createVO()` starts with 0.«) bleibt, sie stimmt.

### 5. `TexturedSprites.ts` — TSDoc von `createSprite()` (heute Zeile 58–61)

Einen Satz anhängen, sonst nichts ändern:

```ts
/**
 * Takes a sprite from the sprite pool. Answers `undefined` once the pool has reached its
 * capacity or the sprites have been disposed.
 *
 * The sprite starts with its size, tex coords, trim margins, position and rotation at 0, upright,
 * and white as its color, whatever the sprite that stood in its slot before carried.
 */
```

### 6. `AnimatedSprite.ts` — neues `[voInitialize]()`

`import {voInitialize} from '../../vertex-objects/constants.js';` ergänzen (vor dem `import type`,
wie in `TexturedSprite.ts`), und in der Klasse `AnimatedSprite` als erste Methode:

```ts
[voInitialize]() {
  // the slot createVO() hands out still carries the values of the sprite that stood in it before;
  // a new sprite starts from the values of a slot no sprite has stood in
  this.setQuadSize(0, 0);
  this.animId = 0;
  this.animOffset = 0;
  this.setInstancePosition(0, 0, 0);
  this.rotation = 0;
}
```

Einziger Deskriptor mit `AnimatedSprite.prototype` als `basePrototype` ist
`AnimatedSpriteDescriptor`; er deklariert alle fünf Komponenten.

### 7. Labels: `BaseSprite.ts`, `TexturedSpritesGeometry.ts`, `AnimatedSpritesGeometry.ts`

- `BaseSprite.ts:34`: `make(halfWidth = 0.5, halfHeight = 0.5, xOffset = 0, yOffset = 0)`; im Rumpf
  (Zeile 48–53) `width` → `halfWidth`, `height` → `halfHeight`. Kein weiterer Umbau, keine neue TSDoc.
- `TexturedSpritesGeometry.ts:18-19`:
  `[halfWidth: number, halfHeight: number] | [halfWidth: number, halfHeight: number, xOffset: number, yOffset: number]`
- `AnimatedSpritesGeometry.ts:19`: dieselben Labels im Inline-Tupeltyp des Parameters
  `makeBaseSpriteArgs`. Keinen neuen exportierten Typ einführen.
- Die TSDoc beider Konstruktoren sagt es schon richtig und bleibt. Formatierung nach Prettier.

### 8. `TileSpritesFactory.ts` — `createTile()` (heute Zeile 36–52)

Die beiden `expectDefined()` für die Felder des Aufrufers werden eigene Prüfungen mit `Error`; der
Aufruf für den Atlas-Frame bleibt:

```ts
const {tileDataProvider} = this;
if (tileDataProvider == null) {
  throw new Error(
    `TileSpritesFactory#createTile() has no tileDataProvider to read tile ${tileCoords.x},${tileCoords.y} from: ` +
      'set TileSpritesFactory#tileDataProvider before the factory builds tiles',
  );
}
const tileDataId = tileDataProvider.getTileIdAt(tileCoords.x, tileCoords.y);

if (tileDataId === 0) return;

const {tileSet} = this;
if (tileSet == null) {
  throw new Error(
    `TileSpritesFactory#createTile() has no tileSet to look up tile id ${tileDataId} of tile ${tileCoords.x},${tileCoords.y} in: ` +
      'set TileSpritesFactory#tileSet before the factory builds tiles',
  );
}
const frameId = tileSet.frameId(tileDataId);
// frameId() answers a frame id inside the range of the tile set, and its atlas holds a frame for
// each of them: a missing frame is a broken invariant, not a field the caller left empty
const texCoords = expectDefined(tileSet.atlas.get(frameId), `the atlas frame of tile ${tileDataId}`).coords;
```

Der Import von `expectDefined` bleibt. Das `@throws` der TSDoc (heute Zeile 41–42) ersetzen durch:

```ts
 * @throws an `Error` naming the method and the field to set when the factory has no
 * `tileDataProvider`, or no `tileSet` for a coordinate whose tile id is not `0`; the `RangeError`
 * of `TileSet#frameId()` when the provider answers a tile id that is no whole number. Nothing is
 * taken out of the pool then
```

Der Rest der Methode (ab dem Kommentar »everything that can throw has thrown by now«) bleibt.

### 9. `packages/twopoint5d/CHANGELOG.md`

Drei **neue** Bullets unter `## [Unreleased]` → `### Fixed`. Bestehende Bullets nicht umformulieren
(Regel des Skills `updating-changelog`). Kein Migration-Guide-Eintrag: die Labels ändern keine
Signatur, und auf geerbte Slot-Werte baut kein Aufrufer, der eine frische Pool-Kapazität nutzt.

- direkt nach dem Bullet, der mit ``- fix `TexturedSprites#createSprite()`: the sprite starts with `texFlipDiagonal` 0`` beginnt:
  ``- fix `TexturedSprites#createSprite()` for the size, the tex coords, the position and the rotation of the sprite: each of them starts at 0, as in a slot no sprite has stood in, whatever the sprite that stood in its slot before carried. `VertexObjectPool#createVO()` of an `AnimatedSpritesGeometry` does the same for an `AnimatedSprite`: its size, `animId`, `animOffset`, position and rotation start at 0``
- direkt danach:
  ``- fix the labels of `TexturedSpritesMakeBaseSpriteArgs`, of the `makeBaseSpriteArgs` of the `AnimatedSpritesGeometry` constructor and the parameters of `BaseSprite#make()`: they read `halfWidth` and `halfHeight`, the half width and the half height of the base quad they take``
- direkt nach dem Bullet, der mit ``- fix `TileSpritesFactory#createTile()`: it resolves the tile set and the atlas frame`` beginnt:
  ``- fix the errors of `TileSpritesFactory#createTile()` for a factory without a `tileDataProvider` or without a `tileSet`: they name `TileSpritesFactory#createTile()`, the field to set and the tile the factory was building``

### Nicht in diesem Paket

- Kein Browser-Test: `[voInitialize]()` ändert nur die Werte im Slot, die die Specs aus dem Buffer
  lesen; dass `createVO()` den Slot zum Upload markiert, halten die Specs von `VertexObjectPool` fest.
- `TileSprite` (map2d) bekommt kein `[voInitialize]()`: `createTile()` schreibt alle vier Attribute
  selbst.
- `OrthographicProjection`/`ParallaxProjection` nutzen `expectDefined()` auf dieselbe Weise; sie
  liegen in `stage/`, außerhalb der Scope-Regel, und stehen in »Offene Befunde« des Plans.

## Abgleich und Entscheidungen (Zug 0)

- **Slot-Reset `TexturedSprite`** — unverändert. `[voInitialize]()` (`TexturedSprite.ts:67-73`)
  setzt `color`, `texFlipDiagonal`, `texTrim`; `quadSize`, `texCoords`, `instancePosition`, `rotation`
  nicht. `texCoords` fehlt im Wortlaut des Nebenbefunds, hat aber dieselbe Ursache: ein neuer Sprite
  zeigte sonst den Frame seines Vorgängers. Aufgenommen.
- **Slot-Reset `AnimatedSprite`** — unverändert. Die Klasse (`AnimatedSprite.ts:22-30`) hat kein
  `[voInitialize]()`; betroffen sind nicht nur `animId`/`animOffset`, sondern alle fünf Komponenten.
- **Maßstab des Resets**: der Wert eines Slots, in dem nie ein Sprite stand — 0 überall, Farbe weiß
  (das setzt `[voInitialize]()` schon heute). Damit beginnt ein Sprite gleich, ob sein Slot frisch oder
  wiederverwendet ist; ein eigener Default wie `quadSize` 1 × 1 würde einen dritten Zustand erfinden.
  Die Tests iterieren über `descriptor.attributeNames`, damit ein später ergänztes Attribut, das der
  Reset vergisst, rot wird — genau so ist dieser Befund entstanden.
- **Labels** — unverändert (`TexturedSpritesGeometry.ts:19`, `AnimatedSpritesGeometry.ts:19`).
  `BaseSprite#make()` (`BaseSprite.ts:34`) trägt dieselben irreführenden Parameternamen, in die die
  Tupel gespreizt werden; ohne sie wanderte die Verwechslung nur eine Datei weiter. Aufgenommen.
  Parameternamen und Tupel-Labels sind nicht signaturwirksam, kein Breaking Change.
  `TileBaseSprite#make(width = 1, height = 1, …)` in map2d nimmt volle Maße und heißt richtig.
- **Fehlermeldungen `TileSpritesFactory`** — unverändert (`TileSpritesFactory.ts:45,50,52`).
  Abweichung vom Wortlaut des Nebenbefunds: Zeile 52 (Atlas-Frame) ist eine echte Invariante.
  `TileSet#frameId()` antwortet immer innerhalb `firstFrameId … firstFrameId + tileCount - 1`, der
  Konstruktor legt für jede dieser Ids einen Frame an, und `TextureAtlas` kennt kein Entfernen;
  `TileSet#frame()` verlässt sich mit demselben Argument darauf. Das ist genau der Einsatz, für den
  `expectDefined()` laut TSDoc da ist — die Zeile bleibt, bekommt einen Kommentar, und fällt aus dem
  `@throws`. Die Meldungen folgen dem Muster von `HelpersManager#add()` in map2d
  (`Klasse#methode() hat kein X: setze Klasse#feld …`), Fehlerklasse `Error` wie dort.
- **Kein Browser-Test**, Begründung oben unter »Nicht in diesem Paket«. Präzedenz: der Reset aus
  Paket 1 ist ebenfalls allein in `TexturedSprites.spec.ts` belegt.
- **CHANGELOG**: neue Bullets statt Umformulierung der bestehenden aus Paket 1, weil der Skill
  `updating-changelog` für fremde `[Unreleased]`-Bullets eine Rückfrage verlangt, die ein
  Implementierer ohne Terminal nicht stellen kann.

## Nebenbefunde im Volltext

**Slot-Reset `TexturedSprite` · low · `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts:67`** —
`[voInitialize]()` setzt `rotation` nicht zurück (ebenso `quadSize`, `instancePosition`): ein Sprite
aus `createSprite()` im Slot eines gedrehten Vorgängers beginnt gedreht · aus Paket 1 · vorbestehend
(`ead22dd1`)

**Slot-Reset `AnimatedSprite` · low · `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprite.ts:22`** —
`AnimatedSprite` hat kein `[voInitialize]()`, `animId` und `animOffset` eines neuen Sprites tragen die
Werte des vorigen Slot-Bewohners · aus Paket 1 · vorbestehend (`ead22dd1`)

**Labels der Geometrie-Args · info · `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:19` und `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts:19`** —
die Tupel-Labels von `makeBaseSpriteArgs` heißen `width`/`height`, die Werte sind halbe Breite und
halbe Höhe (`BaseSprite.ts:34-53`); das TSDoc am Konstruktor sagt es seit `324ab4a1` richtig · aus
Paket 1 · vorbestehend

**Fehlermeldungen `TileSpritesFactory` · info · `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts:45,50,52`** —
`createTile()` meldet fehlenden Provider, fehlendes Tile-Set und fehlenden Atlas-Frame über
`expectDefined()` (`expected the tile set of this factory to be defined`): die Meldung nennt weder
`TileSpritesFactory` noch `createTile()`, und `expectDefined()` ist laut TSDoc für Invarianten, die
das Typsystem nicht sieht — `tileSet` und `tileDataProvider` sind optionale öffentliche Felder des
Aufrufers · aus Paket 1a (Zug 0) · vorbestehend (`ead22dd1`)

## Review (Zug 3, 2026-09-26)

Urteil je Nebenbefund:

- **Slot-Reset `TexturedSprite`** — behoben: `TexturedSprite.ts:67-77`, `[voInitialize]()` setzt alle sieben
  Attribute; belegt durch den Test in `TexturedSprites.spec.ts`, der über `descriptor.attributeNames` iteriert.
- **Slot-Reset `AnimatedSprite`** — behoben: `AnimatedSprite.ts:24-30`, neues `[voInitialize]()` mit allen fünf
  Komponenten; belegt durch den Test in `AnimatedSprites.spec.ts`.
- **Labels der Geometrie-Args** — behoben: `TexturedSpritesGeometry.ts:19`, `AnimatedSpritesGeometry.ts:19-20`,
  `BaseSprite.ts:34,48-53`; keine Signaturänderung, Aufrufer unberührt.
- **Fehlermeldungen `TileSpritesFactory`** — behoben: `TileSpritesFactory.ts:45-59`, `Error` mit Methode, Feld und
  Tile, zwei Tests mit vollem Wortlaut und `usedCount` 0; die Ausnahme für den Atlas-Frame ist begründet.

Kleine Befunde (lösen keine Runde aus):

1. `packages/twopoint5d/CHANGELOG.md:16` — der Bullet zum Slot-Reset bündelt `TexturedSprites#createSprite()` und
   `AnimatedSprite` in einem Eintrag; der Skill `updating-changelog` will einen Bullet je Änderung. So vom
   Detailplan vorgegeben.
2. `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:62-63` — TSDoc von `createSprite()`:
   »upright« meint `texFlipDiagonal` 0, nennt es aber nicht und liest sich wie eine Wiederholung von `rotation`.
3. `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts` — kein Test für Tile-Id `0` ohne
   `tileSet` und für den `RangeError` von `TileSet#frameId()`; vorbestehende Testlücke, als Nebenbefund in
   »Offene Befunde« gebucht (→ Scope: map2d-Spec, die Scope-Regel greift für jede Severity).
4. Kein Migration-Guide-Hinweis auf das Anfangsverhalten nach `freeVO()`/`createVO()`; der CHANGELOG-Bullet sagt es
   inhaltlich — nur festgehalten.
