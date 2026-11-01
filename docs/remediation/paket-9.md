# Paket 9 — Sprites, Text und Fehlermeldungen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-016 (low), CONS-008 (low), CONS-009 (low), RES-004 (low), TYPE-003 (low), BUG-014 (low), CONS-011 (low), CONS-006 (low)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie CONS-006 — Graph-Helfer, die `src/testing/spriteGraph.ts` schon führt, stehen als lokale Kopie in einer Spec und laufen über `Node#traverse()`): `src/map2d/TileSprites/TileSpritesMaterial.spec.ts:9-25` (`attributeNamesOf`, `textureNodesOf`), `src/stage/StageDirector.masks.spec.ts:14-21` (`textureNodesOf`, das die Basen der Samples sammelt) und die Inline-Schleife in `src/stage/maskNodes.spec.ts:66-72`; alle drei an d9b648bf unverändert vorhanden
- Ziel: FeatureSprites, SpriteResources, SpritePicker und BitmapFont prüfen ihre Eingaben einheitlich, halten ihre Caches begrenzt und benennen abgelehnte Werte über `describeValue()`/`describeThreeValue()`.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts` (+ `FeatureSprites.spec.ts`)
  - `packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts` (+ `SpriteResources.spec.ts`), TSDoc in `FeatureSpritesMaterial.ts`
  - `packages/twopoint5d/src/sprites/features/SegmentPlacement.ts` (+ `segments.spec.ts`)
  - `packages/twopoint5d/src/sprites/GridBase.ts` (+ `GridBase.spec.ts`)
  - `packages/twopoint5d/src/sprites/SpritePicker.ts` (+ `SpritePicker.spec.ts`)
  - `packages/twopoint5d/src/text/BitmapFont.ts` (+ `BitmapFont.spec.ts`), `packages/twopoint5d/src/text/writeText.ts`
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts`
  - `packages/twopoint5d/src/testing/spriteGraph.ts` (+ `spriteGraph.spec.ts`), `packages/twopoint5d/src/sprites/node-utils.spec.ts`, `packages/twopoint5d/src/map2d/TileSprites/TileSpritesMaterial.spec.ts`, `packages/twopoint5d/src/stage/StageDirector.masks.spec.ts`, `packages/twopoint5d/src/stage/maskNodes.spec.ts`
  - `packages/twopoint5d/docs/sprites.md`, `packages/twopoint5d/docs/proposals/pipeline-stages-and-grid-base.md`, `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: check what the sprites take as material and texture, refuse rotation and shear on a segment by name, let go of grid bases nothing holds and freeze the info of a font all the way down`

## Rahmen für den Implementierer

- `src/sprites/**` ist in `packages/twopoint5d/vite.config.ts` auf **100 %** Coverage gehalten
  (statements, branches, functions, lines), `src/text/**` auf 98 %. Jeder neue Zweig in
  `src/sprites/` braucht einen Test, der ihn nimmt — auch ein `??` und ein `?.`.
- Meldungen nach AGENTS.md, »Error and warning messages«: Subjekt vorn, ein abgelehnter Wert durch
  `describeValue()`, ein three.js-Objekt durch `describeThreeValue()`, ein Name vom Typ `string`, der
  Instanzen unterscheidet oder nicht gefunden wurde, von Hand in `"…"`.
- Konventionen des Plans: keine Finding-IDs, kein Satz über den Vorzustand (»no longer«, »now«,
  »instead of before«) — in Code, Kommentaren, Guide, Proposal, CHANGELOG und Commit-Message.
- Für jede Verhaltensänderung zuerst der Regressionstest, rot sehen, dann beheben; der rote Lauf
  gehört in den Report (Kommando `pnpm nx test twopoint5d -- src/path/to/file.spec.ts`).
- CHANGELOG über den Skill `updating-changelog`, alle Einträge unter `## [Unreleased]`.

## Vorgehen

### 1. Ein Material, das für einen Pass gebaut ist, wird nicht Material der Sprites (BUG-016)

`FeatureSprites.ts`, `resolveParts()`, im Block `if (material != null)` (`:203-217`): direkt nach
der Kind-Prüfung (`:209`) und vor der Prüfung der Material-Parameter (`:210`):

```ts
if (material.pass != null) {
  throw new TypeError(
    `${WHERE}: the material handed in was built for pass "${material.pass.name}" — hand in a material built without a pass, or leave out the material and give the sprites the pass in passes`,
  );
}
```

- Regressionstest in `FeatureSprites.spec.ts`, `describe('refuses')` (ab `:238`), neben
  `a geometry or a material built for another kind`: `new FeatureSprites(kind, {material: new
  FeatureSpritesMaterial(kind, {pass: ShadowPass})})` wirft genau diese Meldung (Pass-Name
  `ShadowPass.name`), und nichts bleibt gebaut — Signal- und Effekt-Zähler wie im Test
  `refuses %s and leaves nothing built` (`:524ff.`); das Material bleibt unberührt
  (`isDisposed` des Materials nicht gesetzt — es gehört dem Aufrufer) und wird am Testende freigegeben.
- TSDoc des Konstruktors (`:330-341`): in die `@throws`-Liste »for a material built for a pass«.
- Guide `docs/sprites.md`, **Refusals** (`:1797-1808`): »a `geometry` or a `material` that is no
  `FeatureSpritesGeometry` or `FeatureSpritesMaterial`, or one built for another sprite kind« um
  »— or a material built for a pass« ergänzen.
- CHANGELOG `### Changed`: `new FeatureSprites()` refuses a `material` built for a pass — one whose
  `pass` is set — with a `TypeError` that names the pass.

### 2. Der Wert einer Textur wird geprüft, bevor ein Signal ihn sieht (CONS-008)

`SpriteResources.ts`:

1. Modul-lokal neben `isRecord` (`:48`):

   ```ts
   // three tells a texture by its flag: a texture of another copy of three passes as well
   const isTextureOrNone = (value: unknown): value is Texture | null | undefined =>
     value == null || (value as Partial<Texture>).isTexture === true;
   ```

2. Private Methode neben `#assertUniform()`:

   ```ts
   #checkTexture(name: string, value: unknown): void {
     if (!isTextureOrNone(value)) {
       throw new TypeError(
         `${this.#where}: the texture "${name}" must be a three.js Texture or undefined, got ${describeThreeValue(value, 'isTexture')}`,
       );
     }
   }
   ```

   Import `describeThreeValue` aus `../../utils/describeThreeValue.js`. Flag und Formulierung wie
   `lumaMask()` in `src/stage/transitionEffects.ts:325-326`.
3. Konstruktor, Schleife über `options.textures` (`:174-180`, »refused before any signal exists«):
   pro Eintrag nach der Namensprüfung `this.#checkTexture(name, options.textures[name])` — also vor
   jedem `createSignal()` (`:183`); ein abgelehnter Konstruktor lässt nichts zurück.
4. `setTexture()` (`:310-314`): Reihenfolge `#slot(name)` → `this.#checkTexture(name, texture)` →
   `if (this.#disposed) return;` → `slot.signal.set(texture ?? undefined)`. Die Prüfung läuft wie die
   Namensprüfung auch nach `dispose()`.
5. `null` wird **nicht** abgelehnt, sondern leert den Slot wie `undefined` und wird als `undefined`
   gespeichert (`getTexture()` antwortet `undefined`). Abweichung von der Empfehlung des Audits, das
   jeden Wert außer `undefined` und einer Textur ablehnen will: `material.map = null` ist das Idiom von
   three.js, ein JavaScript-Aufrufer schreibt heute `setTexture('colorMap', null)`, und das läuft —
   eine Ablehnung wäre ein neuer Fehler ohne Not (Maßstab der RES-004-Entscheidung im Plan). Die
   TypeScript-Signatur bleibt `Texture | undefined`.

TSDoc und Guide:

- `SpriteResources`-Konstruktor (`:124-130`): `@throws` um »a `TypeError` for a texture in
  `options.textures` that is no three.js Texture, `undefined` or `null`« ergänzen.
- `SpriteResources#setTexture()` (`:303-309`): »A `null` from JavaScript unsets it as `undefined`
  does. @throws a `TypeError` for a value that is no three.js Texture, `undefined` or `null`, and an
  `Error` for a name no feature declares — after `dispose()` as well.«
- `FeatureSpritesMaterial#setTexture()` (`FeatureSpritesMaterial.ts:445-459`) und
  `FeatureSprites#setTexture()` (`FeatureSprites.ts:664-671`): je ein Satz zum `TypeError`, mit
  Verweis auf `SpriteResources.setTexture`; bei `FeatureSprites` bleibt »Does nothing once disposed«
  (dort läuft nach `dispose()` keine Prüfung, wie heute für den Namen).
- Guide `docs/sprites.md`: im Absatz `setTexture(name, texture) and getTexture(name) take the names
  …` (`:1244-1250`) ein Satz: ein Wert, der keine three.js-Textur ist, wirft einen `TypeError`, der
  die Textur nennt, bevor sich etwas ändert; `undefined` (aus JavaScript auch `null`) nimmt sie
  heraus. Im Absatz zum Material (`:1202-1209`) die Liste der `TypeError`-Fälle um »a texture in
  `textures` that is no three.js Texture« ergänzen.
- CHANGELOG `### Changed`: `SpriteResources#setTexture()`, `FeatureSpritesMaterial#setTexture()`
  and `FeatureSprites#setTexture()`, and the `textures` of their options, refuse a value that is
  neither a three.js texture (`isTexture`) nor `undefined` or `null` with a `TypeError` that names
  the texture, before a texture changes; `null` unsets a texture as `undefined` does, and
  `getTexture()` answers `undefined` for it.

Tests in `SpriteResources.spec.ts` (Regressionstest zuerst, rot):

- `describe('refuses')` (`:220ff.`): Konstruktor mit `{textures: {colorMap: 5}}`, `{colorMap: 'hero.png'}`
  und `{colorMap: {}}` wirft `SpriteResources: the texture "colorMap" must be a three.js Texture or
  undefined, got 5` bzw. `got "hero.png"`/`got {}`, und Signal-/Effekt-Zähler stehen danach wie
  vorher. (Ein three-Objekt einer anderen Klasse schreibt `describeThreeValue(…, 'isTexture')` wie
  bei `lumaMask()` über `describeValue()` — kein Testfall, der diese Ausgabe festschreibt.)
- `setTexture('colorMap', 5)` wirft dieselbe Meldung, und `getTexture('colorMap')` hält die Textur
  von vorher.
- `setTexture('colorMap', null)` leert den Slot: `getTexture()` ist `undefined`, `shapeOf()` ist
  `undefined`; `{textures: {colorMap: null}}` im Konstruktor ebenso.
- Nach `dispose()`: `setTexture('colorMap', 5)` wirft weiter, `setTexture('colorMap', new Texture())`
  tut nichts.
- In `FeatureSprites.spec.ts` ein Test, dass `sprites.setTexture('colorMap', 5 as never)` mit dem
  Subjekt der Klasse wirft, die die Ressourcen baut (`FeatureSpritesMaterial` ohne Pässe,
  `FeatureSprites` mit Pässen) — wie die bestehenden Fälle `textures: 5` (`:568`).

### 3. Rotation und Shear werden neben einer Segment-Placement nach Namen abgelehnt (CONS-009)

`SegmentPlacement.ts:21-38`:

```ts
// the local stages a segment cannot follow, by the names of their features and the names of their
// exports for the fix. By name and not by identity, as refuseNineSliceOnSegments() judges NineSlice: a
// copy of Rotation — defineFeature({...Rotation}) — or a feature of one's own under its name turns the
// local quad all the same
const REFUSED: readonly (readonly [feature: string, exported: string])[] = [
  [Rotation.name, 'Rotation'],
  [Shear.name, 'Shear'],
];

function checkSegmentKind(kind: SpriteKindShape): void {
  const held = REFUSED.filter(([name]) => kind.features.some((feature) => feature.name === name));
  if (held.length > 0) {
    const names = held.map(([name]) => `"${name}"`).join(' and ');
    const exports = held.map(([, exported]) => exported).join(' and ');
    // the message stays as it is
  }
  refuseNineSliceOnSegments(kind);
}
```

Die Meldung (`:33-35`) bleibt wörtlich; die Reihenfolge der Namen bleibt die von `REFUSED`.

- Regressionstest in `segments.spec.ts` neben `is refused next to Rotation or Shear, naming the fix`
  (`:154-163`): `kindOf(SegmentPlacement, QuadSize, defineFeature({...Rotation}))` und
  `kindOf(SegmentPlacement, defineFeature({...Shear}))` werfen dieselben Meldungen wie für `Rotation`
  und `Shear` (vor dem Fix rot: kein Wurf). Prüfen, dass `defineFeature({...Rotation})` ohne
  Ablehnung durchgeht; falls nicht, eine eigene `defineFeature({name: 'rotation', …})` mit einer
  lokalen Stage bauen.
- Der Weg über einen Placement-Tausch am Material (`segments.spec.ts:212ff.`) prüft dieselbe Funktion
  und braucht keinen eigenen Test.
- Guide `docs/sprites.md:1604-1607` (**No `Rotation`, no `Shear`**): ergänzen, dass die Ablehnung nach
  dem Namen geht — eine Feature namens `rotation` oder `shear` zählt als `Rotation` bzw. `Shear`.
- CHANGELOG `### Changed`: a segment placement refuses a feature named `rotation` or `shear` as it
  refuses `Rotation` and `Shear`, judged by name as `NineSlice` is.

### 4. `gridBase()` hält eine Basis nur, solange jemand sie hält (RES-004)

Entscheidung (Plan, »Entscheidungen«: Zug 0 von Paket 9 wählt zwischen harter Grenze und WeakRef):
**WeakRef, keine harte Grenze.** Eine Grenze für die Zahl verschiedener Raster wirft für einen
Aufrufer, der heute mehr verschiedene Raster nutzt, einen neuen Fehler — ohne Not, denn die Identität
einer Basis zählt nur zwischen Objekten, die jemand hält: eine Feature vergleicht `kind.base` (vom Kind
gehalten) mit `gridBase(…)`, und solange das Kind lebt, liefert die WeakRef dasselbe Objekt. Kein
Modul der Library hält eine Basis stark (geprüft: kein modulweiter `Map`/`WeakMap` außer `grids`, der
eine Basis oder ihre `description` als Wert hält).

Kein `FinalizationRegistry`: die Rückstände einer eingesammelten Basis sind ein Schlüssel und eine
leere WeakRef, höchstens eine je erlaubtem Paar — 25 846 Paare erfüllen `columns, rows ≤ 1024` und
`columns · rows ≤ 4096` —, und ohne Registry entsteht kein Callback, dessen Zweige unter der
100-%-Grenze von `src/sprites/` nur über eine nicht deterministische GC-Runde zu decken wären.

`GridBase.ts`:

1. `:79-81`:

   ```ts
   // one base per grid while anything holds it — a kind, its geometries, the caller: a feature
   // recognizes its base by identity, and every geometry of a kind shares one descriptor. A base
   // nothing holds is collected, and the next call builds an equal one; its key and the empty
   // WeakRef stay, at most one per pair the limits allow
   const grids = new Map<string, WeakRef<GridBase>>();
   ```

2. `:119-138`: `let grid = grids.get(key)?.deref();` — baut wie bisher, wenn `grid == null`, dann
   `grids.set(key, new WeakRef(grid));`.
3. Kommentar `:31-33`: der Halbsatz »whose indices stay in the cache `grids` for the life of the
   page« fällt; stattdessen »4096 cells bound the base itself — at most 5125 vertices and 24 576
   indices —, so that a typo builds no base of a million vertices per sprite«.
4. JSDoc `gridBase()` (`:90-93`): der Satz »Every grid built stays for the life of the page — the
   identity is what a feature recognizes its base by —, so `gridBase()` is meant for a few fixed
   grids, not for sizes derived from data.« wird ersetzt durch die bezifferte Grenze: »Equal options
   answer the same frozen base for as long as anything holds it — a kind built on it, its
   geometries, the caller. The cache holds no base of its own: a base nothing holds is collected, and
   the next call builds an equal one. It holds no more bases than are in use, each of at most 4096
   cells — 5125 vertices and 24 576 indices —, and for a grid let go its key alone, at most 25 846 of
   them.«

Regressionstest in `GridBase.spec.ts` (vor dem Fix rot: die Map hält die Basis fest):

```ts
test('lets go of a grid nothing holds, and answers a held one with every call', async () => {
  const held = gridBase({columns: 5, rows: 7});
  const ref = new WeakRef(gridBase({columns: 13, rows: 11}));
  // a WeakRef keeps its target to the end of the job that made or read it: each round ends the job first
  for (let round = 0; round < 5 && ref.deref() !== undefined; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    globalThis.gc!();
  }
  expect(ref.deref()).toBeUndefined();
  expect(gridBase({columns: 5, rows: 7})).toBe(held);
  const again = gridBase({columns: 13, rows: 11});
  expect([again.name, again.columns, again.rows, Object.isFrozen(again)]).toEqual(['grid 13x11', 13, 11, true]);
});
```

- Die beiden Größen benutzt kein anderer Test der Datei; vorher prüfen und sonst andere wählen. `gc`
  ist da: `vite.config.ts:14` startet jeden Worker mit `--expose-gc`; den Zugriff typisieren wie
  `src/testing/measureAllocatedBytes.ts:35` (`const {gc} = globalThis;` mit Prüfung).
- Der Test `answers one frozen base per option set` (`:37ff.`) bleibt und hält die Identität.
- Guide `docs/sprites.md:179-184` (**One base per grid**): »Every grid built stays for the life of
  the page, so `gridBase()` is meant for a few fixed grids, not for sizes derived from data.« ersetzen
  durch: die Basis bleibt, solange ein Kind oder sonst jemand sie hält, ein Raster, das nichts mehr
  nutzt, wird freigegeben, und der nächste Aufruf baut es neu — Größen aus Daten kosten nur die
  Raster in Gebrauch.
- Proposal `docs/proposals/pipeline-stages-and-grid-base.md` (Status: implemented, beschreibt den
  Bau): `:178-180` (»every grid built stays for the life of the page, so … not for sizes derived from
  data«) und `:205-207` (»whose indices the cache of bases would hold for the life of the page«) auf
  den Bau ziehen — im Präsens, ohne Hinweis auf eine frühere Fassung; der Status-Kopf bleibt.
- CHANGELOG `### Fixed`: `gridBase()` holds a base only while a kind, its geometries or the caller
  hold it: a grid nothing holds is let go and built anew by the next call with its options, so grid
  sizes derived from data hold no more bases than are in use.

### 5. Die Feldkopie des SpritePicker ist typisiert und gegen three geprüft (TYPE-003)

`SpritePicker.ts`:

1. `:50-60`:

   ```ts
   // the fields of a material that decide which fragments a sprite draws, copied to its pick material;
   // judged against the fields of a NodeMaterial of three 0.187.0, which SpritePicker.spec.ts holds
   /** @internal */
   export const DRAWN_FRAGMENTS = [
     'side',
     'alphaTest',
     'alphaTestNode',
     'opacity',
     'opacityNode',
     'maskNode',
     'alphaHash',
     'alphaToCoverage',
   ] as const satisfies readonly (keyof FeatureSpritesMaterial)[];

   // writes the field `key` of the material of the sprites into the pick material, typed by its name:
   // a field three renames fails the build. Answers whether it changed
   const takeField = <K extends (typeof DRAWN_FRAGMENTS)[number]>(
     to: FeatureSpritesMaterial,
     from: FeatureSpritesMaterial,
     key: K,
   ): boolean => {
     if (to[key] === from[key]) return false;
     to[key] = from[key];
     return true;
   };
   ```

   Nicht in `src/sprites/public-api.ts` aufnehmen.
2. `#sync()` (`:299-307`): die beiden `as unknown as Record<string, unknown>` entfallen; die Schleife
   wird `for (const key of DRAWN_FRAGMENTS) if (takeField(pickMaterial, material, key)) changed = true;`
   (kein Kurzschluss: jedes Feld wird geschrieben). Lässt TypeScript 7 die Zuweisung `to[key] =
   from[key]` mit generischem `K` nicht zu, im Report melden und die acht Felder einzeln typisiert
   kopieren — kein Cast.
3. Neuer Test in `SpritePicker.spec.ts` neben `takes the fields that decide which fragments a sprite
   draws, before every pick` (`:831ff.`):

   ```ts
   // the fields of a NodeMaterial of three 0.187.0 without its flags (is…) and its internals (_…):
   // DRAWN_FRAGMENTS is judged against them. A field three adds or renames fails here — judge it there
   const MATERIAL_FIELDS = [/* sortiert */];

   test('copies the fields DRAWN_FRAGMENTS names, judged against the fields of a material of three', () => {
     const material = new NodeMaterial();
     const fields = Object.keys(material).filter((key) => !/^(?:is[A-Z]|_)/.test(key)).sort();
     expect(fields).toEqual(MATERIAL_FIELDS);
     for (const key of DRAWN_FRAGMENTS) expect(key in material, key).toBe(true);
   });
   ```

   `MATERIAL_FIELDS` sind die 70 Namen, die `node -e "import('three/webgpu').then((T) =>
   console.log(JSON.stringify(Object.keys(new T.NodeMaterial()).filter((k) =>
   !/^(?:is[A-Z]|_)/.test(k)).sort())))"` aus `packages/twopoint5d` ausgibt. Der Kommentar nennt
   »three 0.187.0«, damit Schritt 3 der Hebung in `docs/architecture.md` §5 (`git grep -nE "three
   0\.[0-9]+"`) ihn findet.
4. Geurteilt gegen die 70 Felder (im Report wiedergeben, im Code nicht): `visible` prüft `#gather()`
   (`:266`), `blending`/`transparent`/`depthTest`/`depthWrite`/`name`/`outputNode` setzt der Picker
   selbst (`:320-333`), `positionNode`/`colorNode` baut das Pick-Material aus derselben Art und
   Placement, `clippingPlanes`/`clipIntersection` wertet der WebGPU-Renderer von three 0.187.0 am
   Material nicht aus (Clipping über `ClippingGroup`, `ClippingContext#getGroupContext()`), die
   Stencil-Felder kann ein Pick ohne den Stencil-Puffer des Draws nicht nachbilden. Die Liste der acht
   bleibt.

Kein CHANGELOG-Eintrag (intern, keine Verhaltensänderung).

### 6. `info` und `common` einer Schrift sind Kopien, ganz eingefroren (BUG-014)

`BitmapFont.ts`:

1. `BitmapFontInfo` (`:37-51`): `charset?: string | readonly string[];`, `padding?: readonly
   number[];`, `spacing?: readonly number[];`.
2. Modul-lokal (nicht `deepFreeze()` aus `src/utils/`: es friert die Listen des Aufrufers an Ort und
   Stelle ein, statt sie zu kopieren):

   ```ts
   // a frozen copy of a block of the font file, its plain records and lists all the way down, so the
   // font shares no object with the data it was read from. A key named __proto__ stays a field of its
   // own (defineProperty defines, an assignment would set the prototype), and a cycle stays a cycle
   function frozenCopy(value: unknown, copies = new WeakMap<object, unknown>()): unknown { … }
   ```

   - Primitive und Objekte, die weder Array noch einfacher Record sind (Prototyp `Object.prototype`
     oder `null`), gehen unverändert durch.
   - Ein schon kopiertes Objekt antwortet seine Kopie (`copies`), eingetragen **bevor** die Kinder
     kopiert werden.
   - Array → neues Array mit kopierten Einträgen; Record → neues Objekt mit `Object.prototype`, jede
     eigene aufzählbare String-Eigenschaft (`Object.entries`) über `Object.defineProperty(copy, key,
     {value, enumerable: true, writable: true, configurable: true})`; danach `Object.freeze()`.
3. `:264-265`: `this.info = frozenCopy(info) as Readonly<BitmapFontInfo>;` und `this.common =
   frozenCopy(common) as Readonly<BitmapFontCommon>;`.
4. TSDoc der Felder (`:158-161`): »The `info` block as read, a frozen copy all the way down — its
   lists are frozen copies of their own.« entsprechend für `common`.

Tests in `BitmapFont.spec.ts` (Regressionstest zuerst, rot):

- Nach `new BitmapFont(data)` mit `info.padding = [1, 2, 3, 4]` und `info.charset = ['a', 'b']`:
  `font.info.padding` ist nicht `data.info.padding`, `Object.isFrozen(font.info.padding)` ist `true`,
  ein `push()` darauf wirft einen `TypeError`, und `data.info.padding.push(5)` nach dem Bau ändert
  `font.info.padding` nicht; dasselbe für `charset` und `spacing`. Die Daten des Aufrufers bleiben
  unfrozen (`Object.isFrozen(data.info.padding) === false`).
- Ein Feld von `common`, das eine Liste ist (über einen Cast, kein BMFont schreibt eines), ist eine
  eingefrorene Kopie.
- Ein zyklischer Record in `info` (über einen Cast) baut die Schrift, und die Kopie hält den Zyklus
  (`copy.self === copy`).
- Der bestehende Test `keeps an attribute named __proto__ as a field of its block …` (`:234ff.`)
  bleibt grün.

CHANGELOG `### Changed` mit **BREAKING**: `BitmapFont#info` and `BitmapFont#common` are frozen copies
all the way down: `info.padding`, `info.spacing` and a `charset` list are frozen lists of their own,
and `BitmapFontInfo` types them `readonly` — a write into them throws, and the font data handed in
shares no list with the font (**BREAKING**). See the Migration Guide. Dazu im `### Migration Guide`
ein Abschnitt »The lists of `BitmapFont#info` are read-only« mit **Before** (`font.info.padding!.push(0);`)
und **After** (`const padding = [...(font.info.padding ?? [])]; padding.push(0);`) als `ts`-Blöcke.

### 7. Meldungen benennen Text, Glyph und Kamera über die gemeinsamen Formatierer (CONS-011)

- `writeText.ts:152` und `:211`: `"${preview(text)}"` → `${describeValue(preview(text))}`; Import
  `import {describeValue} from '../utils/describeValue.js';` (fehlt heute). `preview()` (`:34-39`)
  bleibt davor.
- `BitmapFont.ts:222`: `` const label = `${describeValue(String.fromCodePoint(id))} (${id})`; ``.
- `ParallaxProjection.ts:178-182`: der Ausdruck nach `got` wird
  `${describeThreeValue(camera, 'isObject3D')}` wie `OrthographicProjection.ts:171`; Import
  `describeThreeValue` aus `../utils/describeThreeValue.js`, der Import von `describeValue` (`:4`)
  entfällt — er hat sonst keinen Nutzer in der Datei.
- Die Ausgabe der Meldungen ändert sich dabei nicht (`describeValue()` schreibt einen String in
  doppelten Anführungszeichen, `describeValue.ts:71-77`; `preview()` kürzt auf 15 Zeichen, unter der
  Grenze von 120): kein roter Lauf möglich, die bestehenden Specs der Meldungen bleiben grün und
  belegen das.
- Abgrenzung: die Beschreibung des Audits nennt Zeilenumbrüche, Anführungszeichen und einzelne
  Surrogate im Text, die eine Meldung zerreißen. `describeValue()` schreibt sie ebenfalls roh — das
  ist Verhalten des gemeinsamen Formatierers, nicht dieser Stellen, und steht als eigener Eintrag in
  »Offene Befunde« des Plans. Nicht hier anfassen.

Kein CHANGELOG-Eintrag (keine sichtbare Änderung).

### 8. Graph-Helfer der Specs kommen aus `src/testing/spriteGraph.ts` (CONS-006 und Dazu)

`src/testing/spriteGraph.ts`:

1. Neu exportiert, mit TSDoc:
   - `unwrap(node: Node | null | undefined): Node` — ein VarNode gibt seinen `node`, jeder andere
     Node sich selbst (heute lokal in `node-utils.spec.ts:49-53`);
   - `attributeNameOf(node: Node): string` — der Name eines `AttributeNode` ohne Builder (heute lokal
     in `node-utils.spec.ts:32-33`); `attributeNamesOf()` (`:87-91`) und `propsOf()` (`:57`) nutzen
     ihn;
   - `textureBasesOf(root: Node): Set<TextureNode>` — die Basis (`getBase()`) jedes Texture-Nodes des
     Graphen, je einmal: `new Set(textureNodesOf(root).map((node) => node.getBase()))`.
2. `operatorOf()` (`:11-14`) wird über `unwrap()` geschrieben (`unwrap(node) as unknown as
   OperatorNode`), TSDoc bleibt.
3. Für jede neue Funktion ein Test in `src/testing/spriteGraph.spec.ts`.

Specs:

- `src/sprites/node-utils.spec.ts:25-53`: die lokalen `operatorOf`, `attributeNameOf`, `nodesOf`,
  `attributeNamesOf`, `unwrap` entfallen; Import aus `../testing/spriteGraph.js` neben `evaluateNode`
  (`:16`). Ungenutzte Typ-Importe (`NodeBuilder`, `OperatorNode`, `VarNode`, `AttributeNode` …)
  entfernen, soweit die Datei sie nicht mehr braucht.
- `src/map2d/TileSprites/TileSpritesMaterial.spec.ts:9-25`: die lokalen `attributeNamesOf` und
  `textureNodesOf` entfallen; Import aus `../../testing/spriteGraph.js`.
- `src/stage/StageDirector.masks.spec.ts:14-21`: die lokale Funktion `textureNodesOf` entfällt; jeder
  Aufruf (`:591`, `:618`, `:630`, `:640`, `:645`, `:662`, `:1052`) ruft `textureBasesOf` aus
  `../testing/spriteGraph.js` — gleiche Semantik (eine Menge der Basen).
- `src/stage/maskNodes.spec.ts:66-72`: die `traverse()`-Schleife wird `const sampled =
  textureBasesOf(source.coverage(at));`.
- Danach findet `git grep -n "traverse(" -- 'packages/twopoint5d/src/**/*.spec.ts'` nichts mehr.

Kein CHANGELOG-Eintrag (nur Specs und `src/testing/`, das nie nach `dist/` gelangt).

## Abgleich (Zug 0, 2026-11-01)

Basis aller Urteile: HEAD fd239a63. Seit d9b648bf berührt in diesem Bereich nur
`SpritePicker.ts` (Paket 1, Kommentar/three 0.187), `RepeatingTextureColor.ts` (Paket 14),
`matrixColumn.ts`, `node-utils.spec.ts`, `typed-stages.spec.ts`, `spriteGraph.ts` (Paket 1, TSL 0.187)
und `stageFixtures.ts` (Paket 4); keine Fundstelle ist dadurch gewandert, außer um Zeilen.

- BUG-016 — unverändert: `FeatureSprites.ts:203-217`, einzige Kind-Prüfung `:209`, `material.pass`
  ungeprüft; `FeatureSpritesMaterial.pass` öffentlich (`FeatureSpritesMaterial.ts:154-155`).
- CONS-008 — unverändert: `SpriteResources.ts:310-314` (`setTexture()` schreibt ins Signal) und
  `:215-217` (Konstruktor über `setTexture()`); kein `isTexture` in der Datei.
- CONS-009 — unverändert: `SegmentPlacement.ts:29` (`kind.features.includes(feature)`); die
  Schwesterprüfung `segmentChecks.ts:22` geht nach Name.
- RES-004 — unverändert: `GridBase.ts:81` (`new Map<string, GridBase>()`), `:137` (`grids.set()`), keine
  Entfernung; JSDoc `:90-93` warnt nur.
- TYPE-003 — unverändert: `SpritePicker.ts:51-60` (`DRAWN_FRAGMENTS`), `:300-301` (die beiden Casts).
- BUG-014 — unverändert: `BitmapFont.ts:264-265` (`Object.freeze({...info})`, `…common`), Typen
  `:37-51` mutable.
- CONS-011 — unverändert: `writeText.ts:152`, `:211`, `BitmapFont.ts:222`, `ParallaxProjection.ts:180`;
  `OrthographicProjection.ts:171` hält die Regel.
- CONS-006 — unverändert, um Zeilen verschoben (Paket 1 hat `spriteGraph.ts` um fünf Zeilen
  wachsen lassen): `spriteGraph.ts:11`/`:21`/`:87` (Audit `:8`/`:18`/`:84`), lokale Kopien
  `node-utils.spec.ts:27`/`:36`/`:43` (Audit `:27`/`:45`/`:50`, dazu `:33` und `:50`).

Offene Befunde und Folgen: keine `Folgen:`-Zeile eines erledigten Pakets steht offen (1 → Paket 14,
4 → Paket 6, 5 → Paket 15, alle übrigen »keine«). Von den neun offenen Einträgen in »Offene Befunde«
teilt keiner eine Ursache mit diesem Paket (Lockfile, DisplayFullscreen, Display-Spec,
Browser-Fixtures, TextureCoords-Spec) — sie bleiben liegen.

Neue Nebenbefunde dieses Zugs, in »Offene Befunde« eingetragen, Begründung hier:

- `SpritePicker` und `ClippingGroup` — vorbestehend, eigene Ursache (Szenengraph, nicht Feldkopie):
  die Pick-Meshes liegen in der Szene des Pickers (`SpritePicker.ts:147`, `#gather()` `:260ff.`),
  three 0.187.0 clippt über die `ClippingGroup`-Vorfahren eines Objekts, `isShown()` (`:118-125`)
  übernimmt von den Vorfahren nur `visible`. Ein Pick trifft ein Sprite, wo der Draw es weggeclippt
  hat. Urteil `→ Scope` (Scope-Regel: alles). Nach Lesen des Codes, nicht ausgeführt.
- Pass-Material im `material`-Slot der Sprites — vorbestehend, verwandt mit BUG-016, aber eigene
  Stelle und eigener Fix: BUG-016 schließt den Konstruktor; den Slot belegt der Aufrufer, und
  `#sync()` (`:288`, `:299`) baut das Pick-Material ohne den Pass und reicht ihm `material.placement`
  des Pass-Materials weiter, das `checkPlacementStandIn()` ablehnen kann — dieselbe namenlose
  Ablehnung beim ersten `pick()`, die BUG-016 beschreibt. Der Fix gehört in den Picker (den Pass
  mitnehmen oder sprechend ablehnen), nicht in `resolveParts()`. Urteil `→ Scope`. Nach Lesen des
  Codes, nicht ausgeführt.
- `describeValue()` schreibt Strings unmaskiert — vorbestehend, eigene Ursache (der gemeinsame
  Formatierer, nicht die Aufrufer von CONS-011): `describeValue.ts:71-77` setzt einen String roh
  zwischen doppelte Anführungszeichen; ein Zeilenumbruch, ein `"` oder ein einzelnes Surrogat landet
  so in jeder Meldung, die ihn zitiert. Eine Änderung dort berührt jede Meldung der Library — für die
  Drain-Runde mit allen Befunden vor Augen. Urteil `→ Scope`, Severity info.

Wahl und Abweichungen mit Grund: RES-004 WeakRef ohne Registry (§4 oben); CONS-008 lässt `null`
durch (§2, Punkt 5); TYPE-003 hält die Liste über einen Feld-Snapshot von `NodeMaterial` statt einer
Einordnung je Feld in der Spec — der Snapshot fällt bei jeder three-Hebung, an der ein Feld dazukommt
oder umbenannt wird, und zwingt dort zum Urteil (§5).

Modell und Effort: stärkste Stufe wegen des Umfangs — acht Findings und drei Dazu-Stellen über
`src/sprites/`, `src/text/`, `src/stage/`, `src/map2d/`-Specs und `src/testing/`, Guide, Proposal,
CHANGELOG mit Migration Guide, die 100-%-Grenze von `src/sprites/` und ein GC-abhängiger
Regressionstest —; eine Runde der Fehlerkette kostet mehr als die Stufe. Effort `medium`: jede
Änderung ist ein lokaler Fix mit Regressionstest, Signaturen, Meldungen und Werte stehen hier.

Restplan: unverändert. Kein offenes Paket (10–13) berührt `src/sprites/`, `src/text/` oder
`src/testing/`; Paket 11 (map2d) findet `TileSpritesMaterial.spec.ts` mit geänderten Imports vor, das
ändert weder Schnitt noch Reihenfolge.

## Findings im Volltext

**BUG-016 · low · packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:203** — Pass-Material als Sprites-Material in FeatureSprites abweisen
resolveParts() prüft ein übergebenes `material` auf Klasse, Kind, Material-Parameter und `passes`, aber nicht auf `material.pass`. Ein FeatureSpritesMaterial, das für einen Pass gebaut wurde (z. B. ShadowPass), wird als Material der Sprites akzeptiert: das Mesh zeichnet dann mit dem Pass-Graphen, `placement` liefert die Pass-Placement, und SpritePicker#build() reicht genau diese Placement an ein Kind-Material weiter, dessen checkPlacementStandIn() sie ablehnen kann (requires `planarShadow`). Der Fehler taucht erst beim ersten pick() auf und nennt die Ursache nicht.
Beleg: `if (material.kind !== kind) throw …` (Z. 209) ist die einzige Kind-Prüfung; `FeatureSpritesMaterial.pass` ist öffentlich (FeatureSpritesMaterial.ts:155).
Empfehlung: In resolveParts() ein `material.pass != null` mit TypeError im Stil der übrigen Meldungen abweisen (`FeatureSprites: the material handed in was built for a pass …`) und den Fall im Spec festhalten.

**CONS-008 · low · packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts:310** (auch `:215`) — Texturwerte in SpriteResources#setTexture() und `textures` auf Texture prüfen
Alle anderen Eingaben der Sprites-Klassen (Optionen, Geometrie, Material, Uniform-Startwerte, Pässe) werden zur Laufzeit gegen Nicht-TypeScript-Aufrufer geprüft und mit Subjekt-Meldung abgewiesen. Der Wert einer Textur nicht: setTexture(name, value) und die `textures`-Option schreiben beliebige Werte ins Signal. textureShapeKey() und loadedImageOf() lesen dann Eigenschaften eines Nicht-Texture-Objekts; ein Fehler entsteht frühestens im Effekt, der `texture(value)` baut, ohne Subjekt und fern vom Aufruf.
Beleg: `setTexture(name, texture) { const slot = this.#slot(name); if (this.#disposed) return; slot.signal.set(texture); }` — kein isTexture-Test; die Specs prüfen nur `new Texture()` (SpriteResources.spec.ts:268).
Empfehlung: In SpriteResources#setTexture() und im Konstruktor einen Wert, der weder undefined noch ein Objekt mit `isTexture === true` ist, mit TypeError `SpriteResources: the texture "name" must be a three.js Texture, got …` (describeThreeValue) abweisen, bevor ein Signal beschrieben wird.

**CONS-009 · low · packages/twopoint5d/src/sprites/features/SegmentPlacement.ts:29** — Segment-Placement-Verbot für Rotation und Shear nach Name statt nach Identität prüfen
checkSegmentKind() findet Rotation und Shear mit `kind.features.includes(feature)`, also nur das exportierte Objekt. Ein Feature, das aus `defineFeature({...Rotation})` entsteht oder dasselbe Verhalten unter dem Namen `rotation` neu definiert, geht durch; die Segmente drehen sich dann um die lokale Achse, die das Verbot gerade ausschließen soll. Die Schwesterprüfung für NineSlice (segmentChecks.ts:22) arbeitet bewusst nach Name und begründet das im Kommentar.
Beleg: `const held = REFUSED.filter(([feature]) => kind.features.includes(feature));`
Empfehlung: REFUSED über die Feature-Namen (`rotation`, `shear`) abgleichen wie refuseNineSliceOnSegments, oder die Identitätsprüfung im Kommentar begründen.

**RES-004 · low · packages/twopoint5d/src/sprites/GridBase.ts:81** — Cache der gridBase()-Raster begrenzen oder Wachstum dokumentieren
`grids` hält jedes je angefragte Raster bis zum Seitenende, mit Index-Array von bis zu 4096 Zellen mal 6 Indizes. Die Obergrenze (columns·rows ≤ 4096, je Achse ≤ 1024) lässt rund 30 000 verschiedene Paare zu; ein Aufrufer, der Rastergrößen aus Daten ableitet, füllt den Cache ohne Eviction. Die Doku warnt davor (»a few fixed grids«), erzwingt es aber nicht; die übrigen Feature-Caches (wave, tableFrame, paletteSwap, flatPlacement) sind klein und fest begrenzt.
Beleg: `const grids = new Map<string, GridBase>();` und `grids.set(key, grid);` ohne Entfernung.
Empfehlung: Entweder die Zahl verschiedener Raster hart begrenzen (Fehlermeldung mit Hinweis) oder den Cache über WeakRef auf die Base-Objekte stützen; mindestens die Wachstumsgrenze im JSDoc beziffern.

**TYPE-003 · low · packages/twopoint5d/src/sprites/SpritePicker.ts:300** — Felder-Kopie des SpritePicker typisiert statt über String-Schlüssel
#sync() kopiert die Liste DRAWN_FRAGMENTS per `material as unknown as Record<string, unknown>` auf das Pick-Material. Benennt three ein Feld um oder kommt ein Fragment-bestimmendes Feld hinzu (clippingPlanes, colorWrite …), bleibt die Kopie ohne Compilerfehler stumm unvollständig; ein Pick träfe dann Fragmente, die das Sprite nicht zeichnet.
Beleg: `const from = material as unknown as Record<string, unknown>; const to = pickMaterial as unknown as Record<string, unknown>;`
Empfehlung: Die Felder einzeln typisiert kopieren (`to.alphaTest = from.alphaTest` …) oder DRAWN_FRAGMENTS als `readonly (keyof Material)[]` führen und die Zuweisung über ein generisches Hilfsfunktions-Paar schreiben; im Spec festhalten, dass die Liste die Fragment-Felder des Materials abdeckt.

**BUG-014 · low · packages/twopoint5d/src/text/BitmapFont.ts:264** (auch `:265`) — info- und common-Block von BitmapFont tief einfrieren oder kopieren
`info` und `common` sind in der Doku als »frozen« beschrieben, `Object.freeze({...info})` friert aber nur die erste Ebene. `info.padding`, `info.spacing` und `info.charset` (Arrays) bleiben dieselben Objekte wie in den übergebenen Fontdaten: Wer sie danach mutiert — der Aufrufer über seine Daten oder über `font.info.padding.push()` —, verändert den Zustand einer Schrift, die sonst als reine Daten ohne Mutationsweg dasteht.
Beleg: `this.info = Object.freeze({...info});` mit `padding?: number[]; spacing?: number[]; charset?: string | string[]` in BitmapFontInfo
Empfehlung: Die Arrays beim Einfrieren kopieren (oder `deepFreeze()` aus src/utils auf eine Kopie anwenden) und die Typen als readonly number[] deklarieren.

**CONS-011 · low · packages/twopoint5d/src/text/writeText.ts:152** (auch `writeText.ts:211`, `BitmapFont.ts:222`, `stage/ParallaxProjection.ts:180`, `stage/OrthographicProjection.ts:171`) — Abgelehnte Werte in Fehlermeldungen über describeValue() und describeThreeValue() benennen
Zwei Stellen weichen von der Meldungsregel aus AGENTS.md ab. AGENTS.md verlangt, dass jedes Argument, das eine Meldung ausschreibt, durch describeValue() läuft. writeText und rewriteText setzen den Text in handgemachte Anführungszeichen (`"${preview(text)}"`), BitmapFont das Zeichen eines Glyphen (`"${String.fromCodePoint(id)}"`). Ein Text mit Zeilenumbruch oder Anführungszeichen bricht die Meldung dann in mehrere Zeilen oder macht sie mehrdeutig; ein Glyph mit id 10 oder einer Surrogate-Id schreibt rohe Steuerzeichen in die Meldung. Daneben: AGENTS.md verlangt: ein three.js-Objekt, das wegen seiner Klasse abgelehnt wird, wird über `describeThreeValue()` aus `src/utils/` mit seinem `type` benannt. `OrthographicProjection#updateCamera()` hält sich daran (`describeThreeValue(camera, 'isObject3D')`). Die Schwesterklasse `ParallaxProjection` baut dieselbe Unterscheidung inline nach (`isObject3D === true ? camera.type : describeValue(camera)`). Damit gibt es in zwei Projektionen derselben Schnittstelle zwei Formatierungen, und jede künftige Änderung an `describeThreeValue()` erreicht nur die eine.
Empfehlung: `describeValue(preview(text))` und `describeValue(String.fromCodePoint(id))` verwenden; die Zeichenkürzung von preview() bleibt davor. Durch `describeThreeValue(camera, 'isObject3D')` ersetzen, wie in `OrthographicProjection.ts:171`, und den Import von `describeValue` entfernen, falls er dann nicht mehr gebraucht wird.

**CONS-006 · low · packages/twopoint5d/src/testing/spriteGraph.ts:8** (auch `:18`, `:84`) — Doppelte Graph-Helfer aus src/testing/spriteGraph.ts nicht in node-utils.spec.ts nachbauen
`operatorOf`, `nodesOf` und `attributeNamesOf` stehen in spriteGraph.ts und noch einmal, mit leicht anderer Semantik, lokal in sprites/node-utils.spec.ts (Zeilen 27, 45, 50), obwohl dieselbe Datei `evaluateNode` schon aus spriteGraph.ts importiert. `nodesOf` dort läuft über `Node#traverse()` und damit über alle Pfade — genau der exponentielle Fall, vor dem die Variante in spriteGraph.ts schützt. Ein Fix an einer Kopie erreicht die andere nicht.
Beleg: `const nodesOf = (root: Node): Set<Node> => { … root.traverse((node) => nodes.add(node)); … }` in node-utils.spec.ts neben `export const nodesOf` in spriteGraph.ts
Empfehlung: Die lokalen Kopien in node-utils.spec.ts löschen und aus ../testing/spriteGraph.js importieren (für `unwrap` ggf. eine allgemeine Variante dort ergänzen).

## Verlauf

- 2026-11-01 Zug 0: Detailplan steht · alle acht Fundstellen unverändert (CONS-006 um Zeilen
  verschoben: `spriteGraph.ts:11/21/87`) · Dazu drei Spec-Stellen gleicher Ursache wie CONS-006
  (`TileSpritesMaterial.spec.ts:9-25`, `StageDirector.masks.spec.ts:14-21`, `maskNodes.spec.ts:66-72`)
  · RES-004: WeakRef ohne Registry · keine offene Folge zu verteilen · drei neue Nebenbefunde nach
  »Offene Befunde« (`SpritePicker`/`ClippingGroup`, Pass-Material im Slot beim Pick,
  `describeValue()` unmaskiert) · Restplan unverändert
  - 2026-11-01 Zug 1: Implementierer beauftragt (opus, Effort medium), Report nach `paket-9.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG · 24 Dateien unter `packages/twopoint5d/` geändert, keine neu · Arbeitsbaum schmutzig · rote Läufe für Schritte 1–4 und 6 belegt · gemeldete Folge `docs/proposals/dynamic-atlas-and-bitmap-text.md:361/389` (BitmapFontInfo ohne readonly-Listen) · Nebenbefund `src/text/writeText.ts:50` (Feature-Prüfung nach Identität)
  - 2026-11-01 Zug 2: Verify `pnpm run ci` exit=0 (`paket-9.verify.log`)
  - 2026-11-01 Zug 3: Reviewer (opus, medium) freigegeben, alle acht Findings und »Dazu« behoben, 3 klein · Diff `paket-9.diff`, Report `paket-9.review-0.json`
  - 2026-11-01 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-01 Zug 5: Commit e2bf6480 (24 Dateien), Verify `paket-9.verify.log` exit=0 · Nebenbefund `writeText.ts:50` → »Offene Befunde« (→ Scope: Regel deckt jede Severity; eigene Ursache, kein offenes Paket teilt sie)

## Urteil des Reviewers (Zug 3)

- BUG-016: behoben — `src/sprites/FeatureSprites/FeatureSprites.ts:210-214`, `@throws` `:337`, Test `FeatureSprites.spec.ts:253`
- CONS-008: behoben — `SpriteResources.ts:52` (`isTextureOrNone`), `:259` (`#checkTexture`), `:186`, `:329-332`
- CONS-009: behoben — `SegmentPlacement.ts:25-32`, Test `segments.spec.ts:166`
- RES-004: behoben — `GridBase.ts:83`, `:141`, Test `GridBase.spec.ts:47`
- TYPE-003: behoben — `SpritePicker.ts:62` (`satisfies`), `:315`, Snapshot `SpritePicker.spec.ts:907`
- BUG-014: behoben — `BitmapFont.ts:47-50`, `:287-288` (`frozenCopy`), Tests ab `BitmapFont.spec.ts:131`
- CONS-011: behoben — `writeText.ts:153`, `:212`, `BitmapFont.ts:245`, `ParallaxProjection.ts:180`
- CONS-006: behoben — `src/testing/spriteGraph.ts:8`, `:20`, `:105`; `node-utils.spec.ts:6`
- Dazu: behoben — `TileSpritesMaterial.spec.ts:7`, `StageDirector.masks.spec.ts:6`, `maskNodes.spec.ts:70`
- Gemeldete Folge `docs/proposals/dynamic-atlas-and-bitmap-text.md:361/389`: verworfen, das Proposal nennt `Readonly<BitmapFontInfo>`, das stimmt weiterhin

Kleine Befunde:
- `src/sprites/features/SegmentPlacement.ts:63-65` — JSDoc bricht nach »So is a kind with `NineSlice`,« mitten im Satz um
- `src/sprites/FeatureSprites/FeatureSprites.ts:340` — `@throws`-Zeile deutlich länger als ihre Nachbarn
- `docs/proposals/pipeline-stages-and-grid-base.md:184` — Zeilenrest »Frozen all the way down, its description and the« nicht neu umbrochen
