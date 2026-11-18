# Paket 13 — Drain: Eingabeprüfung, Fehlermeldungen und die Nachsicht für Layout-Maße

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen — acht vorbestehende Nebenbefunde aus »Offene Befunde« (Volltext
  unten), dazu gleicher Ursache wie der Eintrag zu `firstTileId` die Id-Arithmetik von `TileSet`
  (vorbestehend laut `git show 2e3f585b:packages/twopoint5d/src/texture/TileSet.ts:232–233, 305`,
  in Zug 0 gefunden; Schritt 1c); low und info
- Ziel: Die genannten Eingaben werden nach der Projektregel geprüft und gemeldet, die Nachsicht
  für je Frame aus dem Layout gerechnete Maße steht als ausdrückliche Ausnahme in AGENTS.md, und
  die TSDoc von `attachInstancedPool()` nennt den gewollten Unterschied zu den Konstruktoren.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, `FrameBasedAnimations.spec.ts`
  - `packages/twopoint5d/src/texture/TileSet.ts`, `TileSet.spec.ts`
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`, `RepeatingTilesProvider.spec.ts`
  - `packages/twopoint5d/src/controls/PanControl2D.ts`, `PanControl2D.spec.ts`
  - `packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts`, `SpriteResources.spec.ts`
  - `packages/twopoint5d/src/texture/AsepriteJson.ts`, `packages/twopoint5d/src/stage/DirectorShapeCache.ts`
  - TSDoc allein: `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/src/display/Chronometer.ts`,
    `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
  - `AGENTS.md` (Repo-Root), `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: siehe unten, Schritte 1–9. Jede Meldung steht hier wortgleich; Code, Kommentare,
  TSDoc und CHANGELOG auf Englisch, ohne Rückblick auf den Vorzustand.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: end an add() over a tile range for every first id, wrap a tile id of a TileSet exactly within the safe integers, take four strings as the keys of a PanControl2D, name the row a tile pattern is refused for and the values a uniform is refused with, read a record through isRecord(), and write down which measures of a layout fall back instead of throwing and why attachInstancedPool() takes a pool of another capacity`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · `firstTileId` unverändert (`FrameBasedAnimations.ts:503`,
    `framesOfTileRange()` `:479–506`) · `tileIds`-Setter unverändert (`RepeatingTilesProvider.ts:59–86`) ·
    `keys`/`keyCodes` verschoben nach `PanControl2D.ts:356–357`, Feld `keys` `:234`; der
    `keyCodes`-Teil geht mit dessen Entfernung nach Paket 14 · `#shapeError()` verschoben nach
    `SpriteResources.ts:263–267`, Aufruf `:309` · `AsepriteJson.ts:128–129` und
    `DirectorShapeCache.ts:179` unverändert, keine weitere Stelle in `src/` · Display-Maße
    unverändert (`Display.ts:376, 397, 420, 435`, `types.ts:113–126`), `maxDeltaTime`
    (`Display.ts:1041`, `Chronometer.ts:55`) ohne Satz zur Nachsicht · `fitIntoRectangle()`
    dokumentiert (`fitIntoRectangle.ts:259–261, 279`) · `attachInstancedPool()`-TSDoc unverändert
    (`InstancedVOBufferGeometry.ts:205–208`) · neu aufgenommen: `TileSet#frameId()` `:231–234` und
    die `firstId`-Prüfung `:305` · keine offenen Folgen erledigter Pakete · Restplan: Hinweis und
    `Hängt ab von: 13` an Paket 14
  - 2026-11-18 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-13.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG (2 Abweichungen: Grenze als `first + (count - 1)`, TSDoc von `add()` zur immer laufenden Bereichsprüfung), 17 Dateien geändert, keine neu, roter Lauf 24 Tests · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-13.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (sonnet, medium) FREIGABE, keine kritischen/wichtigen Befunde, vier kleine · Diff `paket-13.diff` · Report `paket-13.review-0.json`
  - 2026-11-18 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-18 Zug 5: committet als 2577a22e, Verify `paket-13.verify.log` exit=0 aus Zug 2 (keine Änderung seither)

## Gründe aus Zug 0

- **`keyCodes` gehört nicht hierher.** `keyCodes` ist seit 0.22.0 veraltet
  (`CHANGELOG.md:2238`, Abschnitt `[0.22.0]`), also vor 0.25.0 — nach der Entscheidung vom
  2026-11-18 entfernt Paket 14 ihn samt Option, Feld, `DEFAULT_KEY_CODES` und dem Zweig in
  `#speedFieldFor()`. Eine Längen- und Typprüfung, die ein Paket später mit dem Feld verschwindet,
  wäre verschenkt. Dieses Paket prüft `keys` allein und lässt jede `keyCodes`-Zeile stehen.
- **`keys` wird ein Accessor**, nach dem Muster von `mouseButton` aus Paket 3: `control.keys =
  ['KeyW']` verliert sonst dieselben drei Richtungen wie die Option. Der Setter hält das Array,
  wie es zugewiesen wird (keine Kopie) — so bleibt die Zuweisung an das Feld, wie sie heute
  wirkt, und das Umbelegen an Ort und Stelle (`control.keys[0] = 'ArrowUp'`) trägt weiter. Eine
  Schreibung in ein Element prüft niemand; das ist die Grenze jedes Accessors auf einem Array.
  Die Prüfung muss vor `cursorPanStyle` laufen, das eine Stylesheet-Regel hält
  (Konstruktorkommentar an `mouseButton`, `PanControl2D.ts:340–342`). Und der Konstruktor kopiert
  nur ein Array: `[...'KeyW']` wären vier Strings und kämen still durch.
- **`TileSet` gehört hinein.** Dieselbe Ursache wie beim Eintrag zu `firstTileId`: Ids werden nur
  mit `Number.isInteger` (`assertWholeNumber`) geprüft, und Arithmetik jenseits ±2^53 verliert
  Ganzzahlen. Bei `framesOfTileRange()` endet die Schleife nie, bei `TileSet#frameId()` landet
  eine Id auf dem Frame ihres Nachbarn — und zwar schon für zwei sichere Ganzzahlen, weil
  `tileId - firstId` bis 2·`Number.MAX_SAFE_INTEGER` reicht (nachgerechnet mit Node: `firstId =
  -(2 ** 53 - 1)`, drei Kacheln, `frameId(2)` antwortet heute `firstFrameId + 2`, richtig ist
  `firstFrameId`). Ein eigenes Paket der Drain-Runde kostete einen ganzen Runner für drei Zeilen.
- **Meldungen für Nicht-Ganzzahlen bleiben wortgleich.** `TileSet: tileId must be a whole number,
  got …` zitieren `TileSet.spec.ts:284` und `TileSpritesFactory.spec.ts:125, 183`, die
  `firstTileId`/`tileId`-Meldungen von `add()` `FrameBasedAnimations.spec.ts:1139, 1150`. Die
  neue Grenze bekommt je einen eigenen Zweig mit eigener Meldung; kein bestehender Test ändert
  sich dafür.
- **Fehlerklassen folgen ihrem Modul.** `add()` verweigert in `FrameBasedAnimations.ts` durchweg
  mit `Error`, `TileSet` mit `RangeError` (`assertOption`, `assertWholeNumber`), der
  `tileIds`-Setter für eine falsche Art mit `TypeError` (wie sein Konstruktor), `keys` mit
  `TypeError` (falsche Art und Länge, keine Zahlengrenze).
- **Die Endlosschleife läuft nie ungebremst rot.** Der rote Lauf des Regressionstests zu
  `framesOfTileRange()` würde ohne Wächter den Worker aufhängen und das Array bis zum OOM füllen.
  Darum zählt ein Spy auf `tileSet.frame` die Aufrufe und wirft, sobald es mehr werden, als die
  Spanne Kacheln hat (Schritt 1e): rot und begrenzt vor dem Fix, grün danach, weil die Prüfung vor
  dem ersten Aufruf greift. Kein Lauf ohne diesen Wächter, auch nicht kurz.
- **Kein CHANGELOG für Doku ohne Verhaltensänderung**: `maxDeltaTime` (Schritt 7),
  `attachInstancedPool()` (Schritt 8), `isRecord()` (Schritt 5, intern) und `AGENTS.md`
  (Schritt 6) ändern nichts an der Library. Die übrigen Schritte bekommen ihren Eintrag
  (Schritt 9).

## Vorgehen

### Schritt 1 — Tile-Ids in `FrameBasedAnimations.ts` und `TileSet.ts`

**1a. `framesOfTileRange()`** (`packages/twopoint5d/src/texture/FrameBasedAnimations.ts:479–506`)

- Die beiden Prüfungen von `firstTileId` (`Number.isInteger`) und `tileCount` bleiben samt
  Meldung, wie sie sind.
- Nach `const first = …;` und `const count: number = …;` neu, vor der Schleife:

  ```ts
  // beyond ±Number.MAX_SAFE_INTEGER a double stands for more than one integer: the ids of the
  // range would repeat, and a counter over them would never reach its end. The range is checked
  // whatever it comes from — a firstTileId passed, or the first id of the tile set with a
  // tileCount passed
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(first + count - 1)) {
    throw new Error(
      `FrameBasedAnimations: add() got a tile range of ${describeValue(count)} tiles from ${describeValue(first)} for the animation ${animNameInError(name)} — the ids of a tile range lie within ±Number.MAX_SAFE_INTEGER`,
    );
  }
  ```

- Die Schleife zählt den Index, nicht die Id:

  ```ts
  for (let i = 0; i < count; i++) {
    atlasFrames.push(tileSet.frame(first + i));
  }
  ```

- Der Kommentar über den beiden bestehenden Prüfungen (»only what was passed is checked …«)
  bleibt; er betrifft die Grenzen von `firstTileId` und `tileCount`.

**1b. `framesOfTileIds()`** (`FrameBasedAnimations.ts:463–475`)

- Im `forEach` bleibt der Zweig `!Number.isInteger(tileId)` samt Meldung. Dahinter ein zweiter
  Zweig für eine Ganzzahl jenseits der sicheren:

  ```ts
  if (!Number.isSafeInteger(tileId)) {
    throw new Error(
      `FrameBasedAnimations: add() got a tileId of ${describeValue(tileId)} at index ${index} for the animation ${animNameInError(name)} — a tileId lies within ±Number.MAX_SAFE_INTEGER`,
    );
  }
  ```

**1c. `TileSet`** (`packages/twopoint5d/src/texture/TileSet.ts`)

- `frameId()` (`:228–234`), auf dem Pfad jedes `frame()`-Aufrufs, deshalb inline und ohne
  Allokation:

  ```ts
  frameId(tileId: number): number {
    // a tile id beyond ±Number.MAX_SAFE_INTEGER stands for more than one integer; the check of
    // a whole number runs inside the failure branch alone and keeps its message
    if (!Number.isSafeInteger(tileId)) {
      assertWholeNumber(tileId, 'TileSet', 'tileId');
      throw new RangeError(
        `TileSet: tileId must be a whole number within ±Number.MAX_SAFE_INTEGER, got ${describeValue(tileId)}`,
      );
    }
    const n = this.tileCount;
    // each id is taken modulo n before the difference: tileId - firstId may reach twice
    // Number.MAX_SAFE_INTEGER, where a double has no odd numbers left
    return ((((tileId % n) - (this.firstId % n)) % n) + n) % n + this.firstFrameId;
  }
  ```

  Biome formatiert die Klammern; das Ergebnis liegt für jede sichere Id in `[0, n)` plus
  `firstFrameId`. Für jede Eingabe, die die alte Formel exakt rechnete, ist das Ergebnis gleich.
- TSDoc `@throws` an `frameId()` (`:229`) und `frame()` (`:250`): `@throws {RangeError} if
  `tileId` is not a whole number, or lies beyond ±`Number.MAX_SAFE_INTEGER`; a negative whole
  number is fine, the arithmetic wraps it around.`
- `#createTextureCoords`: nach `const tileCount = this.options.tileCount ?? fitting;` und **vor**
  der Schleife, die die Kacheln in den Atlas legt (deren Kommentar sagt, warum: ein abgelehnter
  Satz lässt den Atlas, wie er war):

  ```ts
  // the ids of the tiles are counted from firstId on and wrapped by frameId(): beyond
  // ±Number.MAX_SAFE_INTEGER they would stand for more than one tile
  assertOption(
    Number.isSafeInteger(this.firstId) && Number.isSafeInteger(this.firstId + tileCount - 1),
    'firstId',
    'a whole number that keeps the ids of all tiles, up to firstId + tileCount - 1, within ±Number.MAX_SAFE_INTEGER',
    this.firstId,
  );
  ```

  Die bestehende `assertWholeNumber(this.firstId, 'TileSet', 'firstId')` (`:305`) bleibt, wo sie
  ist.
- Konstruktor-TSDoc (`:137–142`, Satz der Ablehnungen): `… if \`firstId\` is not a whole number,
  if \`firstId\` or the id of the last tile, \`firstId + tileCount - 1\`, lies beyond
  ±\`Number.MAX_SAFE_INTEGER\`, …`.

**1d. TSDoc von `add()`** (`FrameBasedAnimations.ts:584–594`, Absatz »What picks the frames is
refused as well …«): nach »a tile id that is no whole number, naming its index;« einfügen »a tile
id beyond ±`Number.MAX_SAFE_INTEGER`, naming its index;«, und nach dem Satzteil zu `tileCount`
»a range of tiles — from `firstTileId`, or the first id of the tile set, `tileCount` of them —
whose ids reach beyond ±`Number.MAX_SAFE_INTEGER`;«.

**1e. Tests** — Regressionstests zuerst, roter Lauf in den Report:

- `FrameBasedAnimations.spec.ts`, bei den Ablehnungen von `firstTileId` (`:1139`):
  `refuses a tile range whose ids reach beyond ±Number.MAX_SAFE_INTEGER, and lays no frame of it`,
  `test.each` über `firstTileId`/`tileCount` `[2 ** 53 - 1, 3]`, `[2 ** 53, 2]`, `[-(2 ** 53), 2]`.
  **Wächter Pflicht**: `const frame = vi.spyOn(tileSet, 'frame')` mit einer Implementierung, die
  nach `tileCount` Aufrufen `throw new Error('frame() was called more often than the range has tiles')`
  wirft und sonst das Original ruft. Erwartet: `add()` wirft
  `FrameBasedAnimations: add() got a tile range of 3 tiles from 9007199254740991 for the animation "walk" — the ids of a tile range lie within ±Number.MAX_SAFE_INTEGER`
  für den ersten Fall, für die beiden anderen `… of 2 tiles from 9007199254740992 …` und
  `… of 2 tiles from -9007199254740992 …`, und `frame` wurde nicht gerufen. Vor dem Fix wirft in
  den ersten beiden Fällen der Wächter (die Id bleibt bei 2^53 stehen), im dritten wirft nichts
  (`-(2 ** 53) + 1` ist darstellbar, die Schleife endet): rot, begrenzt.
- Ebenda: `refuses a tileId beyond ±Number.MAX_SAFE_INTEGER, naming its index` mit `[1, 2 ** 53]`
  → `FrameBasedAnimations: add() got a tileId of 9007199254740992 at index 1 for the animation "walk" — a tileId lies within ±Number.MAX_SAFE_INTEGER`.
  Vor dem Fix antwortet `TileSet#frameId(2 ** 53)` einen Frame: rot.
- `TileSet.spec.ts`, bei den `frameId()`-Tests (`:284`):
  - `refuses a tile id beyond ±Number.MAX_SAFE_INTEGER` für `2 ** 53` und `-(2 ** 53)` →
    `new RangeError('TileSet: tileId must be a whole number within ±Number.MAX_SAFE_INTEGER, got 9007199254740992')`
    bzw. `got -9007199254740992`, für `frameId()` und `frame()`.
  - `answers the frame of a tile far from firstId exactly`: ein `TileSet` mit `firstId: -(2 ** 53 - 1)`
    und drei Kacheln, `frameId(2)` ist `firstFrameId` (vor dem Fix `firstFrameId + 2`: rot).
- `TileSet.spec.ts`, bei den Ablehnungen von `firstId` (`:342–344`): `firstId: 2 ** 53 - 2` mit
  drei Kacheln und `firstId: 2 ** 53` →
  `new RangeError('TileSet: firstId must be a whole number that keeps the ids of all tiles, up to firstId + tileCount - 1, within ±Number.MAX_SAFE_INTEGER, got 9007199254740990')`
  bzw. `got 9007199254740992`; ein übergebener Atlas behält seine Framezahl, wie die
  Nachbartests es prüfen.

### Schritt 2 — `RepeatingTilesProvider#tileIds` (`packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:59–86`)

- Erste Anweisung des Setters:

  ```ts
  if (!Array.isArray(tileIds)) {
    throw new TypeError(`RepeatingTilesProvider: a tile id pattern is an array of rows of tile ids, got ${describeValue(tileIds)}`);
  }
  ```

- Nach der Prüfung `rows === 0`, vor `const cols = tileIds[0]!.length;`:

  ```ts
  for (let row = 0; row < rows; row++) {
    if (!Array.isArray(tileIds[row])) {
      throw new TypeError(
        `RepeatingTilesProvider: every row of a tile id pattern is an array of tile ids, but row ${row} is ${describeValue(tileIds[row])}`,
      );
    }
  }
  ```

- TSDoc des Setters, nach dem Satz zur Zeilenlänge: »A pattern that is no array, or that holds a
  row that is none, throws a `TypeError` naming the row, and leaves the pattern the provider had
  as well.«
- Tests in `RepeatingTilesProvider.spec.ts` bei den Setter-Ablehnungen (`:78`, `:106`):
  `tiles.tileIds = [1, 2] as never` →
  `new TypeError('RepeatingTilesProvider: every row of a tile id pattern is an array of tile ids, but row 0 is 1')`,
  `[[1, 2], 3]` → `… but row 1 is 3`, `null` →
  `new TypeError('RepeatingTilesProvider: a tile id pattern is an array of rows of tile ids, got null')`;
  je danach `tiles.tileIds` unverändert. Vor dem Fix rohe `TypeError`s anderer Meldung
  (`row.slice is not a function`, `Cannot read properties of null`): rot.

### Schritt 3 — `PanControl2D#keys` (`packages/twopoint5d/src/controls/PanControl2D.ts`)

- Das Feld `keys` (`:229–234`) wird privates Feld plus Accessor. Das Feld bei den übrigen
  privaten Feldern: `#keys!: [string, string, string, string];` mit dem Kommentar »Assigned in the
  constructor through the `keys` setter.« (Muster `#cursorPanStyle!`, `:215`). Accessor an der
  Stelle des Feldes:

  ```ts
  /**
   * The `KeyboardEvent.code` of the keys for up, down, left and right. The array is held as it is
   * assigned, so a rebinding in place (`control.keys[0] = 'ArrowUp'`) takes effect. An array of
   * another length, or one with an element that is no string, throws a `TypeError` and leaves the
   * keys the control holds.
   *
   * @see {@link PanControl2DOptions.keys}
   */
  get keys(): [string, string, string, string] {
    return this.#keys;
  }

  set keys(value: [string, string, string, string]) {
    // three keys, or a fifth, would lose a direction without a word
    if (!Array.isArray(value) || value.length !== 4 || !value.every((key) => typeof key === 'string')) {
      throw new TypeError(
        `PanControl2D: keys must be an array of four KeyboardEvent.code strings, for up, down, left and right, got ${describeValue(value)}`,
      );
    }
    this.#keys = value;
  }
  ```

- Konstruktor (`:333–364`): die Zuweisung von `keys` wandert direkt hinter `this.mouseButton = …`
  (vor `#styleSheetRoot` und `cursorPanStyle`, die eine Regel halten):

  ```ts
  // before the cursorPanStyle below, which retains a rule: keys the setter refuses throw while
  // the control holds nothing yet. A copy of an array, so that a rebinding in place on this
  // control reaches neither the options nor another control built from them; anything else goes
  // to the setter as it is — a spread would make four keys of the string 'KeyW'
  const keys: unknown = options?.keys ?? DEFAULT_KEYS;
  this.keys = (Array.isArray(keys) ? [...keys] : keys) as [string, string, string, string];
  ```

  Die Zeile `this.keyCodes = …` bleibt an ihrem Platz; ihr Kommentar spricht danach nur noch von
  `keyCodes` (»A copy, because keyCodes is public and writable, and `keyCodes[0] = 38` rebinds in
  place: …«). `#speedFieldFor()` liest `this.keys` über den Getter, unverändert.
- TSDoc der Option `keys` (`PanControl2DOptions`, `:139–157`), nach »The control works on a copy of
  the array.«: »An array of another length, or one with an element that is no string, makes the
  constructor throw a `TypeError` before the control holds anything.«
- Tests in `PanControl2D.spec.ts` bei den `mouseButton`-Ablehnungen (`:580–600`), nach deren
  Muster: `test.each` über `['KeyW']`, `['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ']`,
  `['KeyW', 'KeyS', 'KeyA', 68]`, `'KeyW'` und `{}` (jeweils `as never`) — der Konstruktor wirft
  `new TypeError(\`PanControl2D: keys must be an array of four KeyboardEvent.code strings, for up, down, left and right, got ${written}\`)`
  mit `written` wie `describeValue()` es schreibt (`["KeyW"]`, `"KeyW"`, `{}` …), und hält danach
  keine Cursor-Regel (prüfen wie der bestehende Test, dass ein abgelehnter `mouseButton` nichts
  hält); der Setter wirft dasselbe, und `control.keys` ist danach dasselbe Array wie vorher
  (`toBe`). Vor dem Fix wirft nichts: rot. Der bestehende Test
  `copies keys and keyCodes of the options …` (`:292`) bleibt unverändert grün.

### Schritt 4 — `SpriteResources#setUniform()` (`packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts`)

- `#shapeError()` (`:263–267`):

  ```ts
  #shapeError(name: string, size: number, given: number, x: unknown, y: unknown, z: unknown, w: unknown): TypeError {
    const got = given === 1 ? describeValue(x) : describeValue([x, y, z, w].slice(0, given));
    return new TypeError(
      `${this.#where}: the uniform ${describeValue(name)} is a ${VECTOR_TYPES[size - 1]} and takes ${size} value${size === 1 ? '' : 's'}, got ${got}`,
    );
  }
  ```

- Aufruf `:309`: `if (given !== size) throw this.#shapeError(name, size, given, x, y, z, w);` — das
  Array entsteht nur im Fehlerfall, der Erfolgspfad allokiert weiter nichts.
- Tests in `SpriteResources.spec.ts`: `:58–60` exakt
  `new TypeError('SpriteResources: the uniform "light" is a vec3 and takes 3 values, got [1, 2]')`,
  `:101` exakt `new TypeError('SpriteResources: the uniform "time" is a float and takes 1 value, got [1, 2]')`,
  neu `setUniform('light', 1)` → `… takes 3 values, got 1` und `setUniform('light', 1, 2, 3, 4)` →
  `… takes 3 values, got [1, 2, 3, 4]`. Vor dem Fix fehlt der `got`-Teil: rot.

### Schritt 5 — `isRecord()` statt der ausgeschriebenen Regel

- `packages/twopoint5d/src/texture/AsepriteJson.ts:128–129`: `isObject(slices) &&
  !Array.isArray(slices)` → `isRecord(slices)`; Import `isRecord` aus `../utils/isRecord.js`
  (`isObject` bleibt importiert, die Datei nutzt es weiter).
- `packages/twopoint5d/src/stage/DirectorShapeCache.ts:179`: `slot !== null && typeof slot ===
  'object' && !Array.isArray(slot) && 'mask' in slot` → `isRecord(slot) && 'mask' in slot`, danach
  `const {effect, mask} = slot;` ohne den Cast (`isRecord` engt auf `Record<string, unknown>` ein);
  Import `isRecord` aus `../utils/isRecord.js`.
- Kein Verhalten ändert sich (`isRecord` ist genau `typeof === 'object' && !== null &&
  !Array.isArray`, `utils/isRecord.ts:7`, `utils/isObject.ts`), kein Test, kein CHANGELOG.

### Schritt 6 — Die Ausnahme für Layout-Maße in `AGENTS.md`

Neuer Punkt in »Rules you cannot read off the code«, direkt hinter dem Punkt **Error and warning
messages** (endet mit »… get theirs from `defineSprite()`.«), Zeilen umbrochen wie die Nachbarn:

```markdown
- **Invalid input is refused.** A value a public call or setter cannot use throws, in the
  words of the rule above, and the object keeps what it held; nothing is passed over or
  replaced without a word. The one exception are the measures a layout may hand in anew with
  every frame: `Display#pixelZoom`, `#maxPixelRatio`, `#maxPixels`, `#resolutionScale` and
  `#maxDeltaTime`, `Chronometer#maxDeltaTime`, the options `maxPixelRatio` and `maxPixels` of
  `new Display()`, and `pixelZoom`, `minPixelZoom` and `maxPixelZoom` of `fitIntoRectangle()`.
  They count an invalid value — the `NaN` of a container 0 pixels wide while the page lays it
  out, a negative one — as the value that leaves them without effect (`0`; `1` for
  `resolutionScale` and the `pixelZoom` of `fitIntoRectangle()`; `minPixelZoom` and
  `maxPixelZoom` do not apply), and their TSDoc says so: the frame is drawn with the fallback
  instead of throwing in it. A new measure of that kind joins this list; every other input
  throws.
```

### Schritt 7 — `maxDeltaTime` nennt seine Nachsicht

- `packages/twopoint5d/src/display/Display.ts:1039`, nach »Defaults to `1 / 30` (~33ms). Set to
  `0` to disable the cap entirely.«: »A value that is not a positive finite number counts as `0`.«
- `packages/twopoint5d/src/display/Chronometer.ts:53`, nach »Default is `0` (disabled).«: derselbe
  Satz.
- Belegt am Code: `Chronometer.ts:131` kappt nur bei `this.maxDeltaTime > 0 && deltaTime >
  this.maxDeltaTime` — `NaN`, eine negative Zahl und `Infinity` kappen nichts; der Setter von
  `Display` reicht den Wert durch (`Display.ts:1045–1047`).

### Schritt 8 — TSDoc von `attachInstancedPool()` (`packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:205–208`)

Die zwei Sätze »An existing pool with a different capacity can still be attached; matching it to
the `.instancedPool` is then the caller's responsibility.« werden zu:

> An existing pool with a different capacity is attached as it is — unlike the constructors,
> which refuse a pool whose capacity is not the one they are handed, because a geometry takes
> its sizes from the pools it is built on. Here the `.instancedPool` alone sets the instance
> count; matching the capacity of an attached pool to it is the caller's responsibility.

### Schritt 9 — CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, Skill `updating-changelog`)

- `### Changed`, hinter dem Eintrag zu `PanControl2D#mouseButton`:
  - `` `PanControl2D#keys` is an accessor and, like the option `keys`, takes an array of four strings, the `KeyboardEvent.code` of the keys for up, down, left and right; anything else throws a `TypeError` and the control keeps the keys it holds. The array is held as it is assigned, so a rebinding in place (`control.keys[0] = 'ArrowUp'`) takes effect (**BREAKING**). See the Migration Guide ``
- `### Changed`, hinter dem Eintrag zu `new RepeatingTilesProvider()`:
  - `` the `tileIds` setter of `RepeatingTilesProvider` throws a `TypeError` naming the row for a pattern with a row that is no array — `[1, 2]` —, and one for a pattern that is no array, and keeps the pattern it had ``
- `### Changed`, hinter dem Eintrag zu `SpriteResources#setUniform()`:
  - `` the `TypeError` of `SpriteResources#setUniform()` — and of `setUniform()` of `FeatureSpritesMaterial` and `FeatureSprites` — for another count of values than the uniform takes names the values it got: `SpriteResources: the uniform "light" is a vec3 and takes 3 values, got [1, 2]` ``
- `### Fixed`:
  - `` `FrameBasedAnimations#add()` over a range of a `TileSet` ends for every `firstTileId`: a range whose ids reach beyond ±`Number.MAX_SAFE_INTEGER` is refused with an `Error` naming the animation, and so is a tile id of a list beyond it, naming its index ``
  - `` `TileSet#frameId()` and `TileSet#frame()` answer the frame of every tile id within ±`Number.MAX_SAFE_INTEGER` exactly, also far from `firstId`, and throw a `RangeError` for a tile id beyond it; `new TileSet()` throws one for a `firstId` whose tiles reach beyond it ``
- `### Migration Guide`, hinter »#### `PanControl2D#mouseButton` takes a whole number from 1 to 31«:

  ````markdown
  #### `PanControl2D#keys` takes four strings

  A list of another length, which lost a direction without a word, and a string throw now.

  **Before**

  ```ts
  new PanControl2D({keys: ['ArrowUp'] as unknown as [string, string, string, string]}); // panned up only
  ```

  **After**

  ```ts
  new PanControl2D({keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']});
  ```
  ````

### Nicht in diesem Paket

- `keyCodes` von `PanControl2D` (Option, Feld, `DEFAULT_KEY_CODES`, Zweig in `#speedFieldFor()`):
  entfernt Paket 14.
- Alles Übrige aus Paket 14 und 15 (`Display#stop()`, fehlende TSDoc an `Display`/`Stage2D`,
  `#emit`, Lookbook-Demos).

## Findings im Volltext

Keine Audit-Findings. Die Nebenbefunde aus »Offene Befunde« des Plans, wortgleich:

**`packages/twopoint5d/src/texture/FrameBasedAnimations.ts:503`** (`framesOfTileRange()`,
TileSet-Zweig von `add()`): `firstTileId` wird nur mit `Number.isInteger` geprüft; ab ±2^53 mit
`tileCount ≥ 2` zählt `tileId++` nicht weiter und die Schleife endet nie (aus Paket 3,
vorbestehend; low; mit Paket 6b f2be2168 von `:573` nach `framesOfTileRange()` gewandert) → Scope

**`packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:59-85`** (Setter `tileIds`): prüft nicht,
ob jede Zeile ein Array ist; `tileIds = [1, 2]` endet in einem rohen `TypeError` aus `row.slice`
(aus Paket 3, vorbestehend; low) → Scope

**`packages/twopoint5d/src/controls/PanControl2D.ts:352-353`**: `keys` und `keyCodes` werden weder
auf Länge 4 noch auf den Elementtyp geprüft; `keys: ['KeyW']` verliert still drei Richtungen (aus
Paket 3, vorbestehend; low) → Scope

**`packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts:267-271`**: die Meldung von
`#shapeError()` hat keinen `got …`-Teil mit `describeValue()` (aus Paket 3, vorbestehend; info) →
Scope

**`packages/twopoint5d/src/texture/AsepriteJson.ts:128-129`** (`isObject(slices) &&
!Array.isArray(slices)`) und **`packages/twopoint5d/src/stage/DirectorShapeCache.ts:179`**
(`parseShapes()`: `slot !== null && typeof slot === 'object' && !Array.isArray(slot) && …`)
schreiben die Regel von `isRecord()` (`utils/isRecord.ts`) in positiver Form aus (aus Paket 7,
Runde 2, vorbestehend; info; mit Paket 11 a687ec89 von `StageDirector.ts:365` hierher gewandert) →
Scope

**`packages/twopoint5d/src/display/Display.ts:376, 397, 420, 435`** (`pixelZoom`,
`maxPixelRatio`, `maxPixels`, `resolutionScale`), die Optionen `maxPixelRatio`/`maxPixels`
(`display/types.ts:113-126`) und `maxDeltaTime` von `Display`/`Chronometer` zählen einen
ungültigen Wert dokumentiert als `0` bzw. `1`, während nach Paket 3 die Raten werfen (aus Paket 3,
Zug 0, vorbestehend; low) → Scope (Entscheidung 2026-11-18: Nachsicht bleibt; Regel in AGENTS.md
festschreiben, dann `acknowledged`)

**`packages/twopoint5d/src/stage/fitIntoRectangle.ts`** (TSDoc von `fitIntoRectangle()`, Optionen
`pixelZoom`, `minPixelZoom`, `maxPixelZoom`): ein ungültiger Wert wird dokumentiert nachsichtig
behandelt — dieselbe Frage wie der Eintrag zu den Display-Maßen darüber (aus Paket 3,
vorbestehend; low) → Scope (Entscheidung 2026-11-18: Nachsicht bleibt; Regel in AGENTS.md
festschreiben, dann `acknowledged`)

**`packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`** (TSDoc von
`attachInstancedPool()`, »An existing pool with a different capacity can still be attached …«):
`attachInstancedPool()` nimmt still einen Pool mit anderer Capacity als `instancedPool` an, während
die Konstruktoren nach Paket 8 dieselbe Unstimmigkeit ablehnen (aus Paket 8, vorbestehend laut
`git show 2e3f585b:…InstancedVOBufferGeometry.ts:239`; info) → Scope (Entscheidung 2026-11-18:
Zusage bleibt; TSDoc nennt den Unterschied zu den Konstruktoren, dann `acknowledged`)

**In Zug 0 aufgenommen, gleicher Ursache wie der Eintrag zu `firstTileId`:
`packages/twopoint5d/src/texture/TileSet.ts:231–234, 305`** — `frameId()` prüft `tileId` und der
Konstruktor `firstId` nur mit `assertWholeNumber()` (`Number.isInteger`); `tileId - firstId`
verlässt die sicheren Ganzzahlen schon für zwei sichere Ids weit voneinander, und `frameId()`
antwortet dann den Frame eines Nachbarn (`firstId = -(2 ** 53 - 1)`, drei Kacheln: `frameId(2)` ist
`firstFrameId + 2` statt `firstFrameId`); eine Id jenseits ±2^53 steht für mehrere Ganzzahlen
(vorbestehend laut `git show 2e3f585b:packages/twopoint5d/src/texture/TileSet.ts:232–233, 305`;
info)

## Urteil des Reviewers (Zug 3)

- `framesOfTileRange()`/`firstTileId`: behoben — `FrameBasedAnimations.ts:507–512` (Grenze vor der Schleife, Schleife über den Index)
- `RepeatingTilesProvider#tileIds`: behoben — `RepeatingTilesProvider.ts:459–472`
- `PanControl2D#keys`: behoben — Accessor mit Längen- und Typprüfung, Zuweisung vor `cursorPanStyle`
- `SpriteResources#shapeError()`: behoben — `SpriteResources.ts:263–269`, Aufruf `:309`
- `isRecord()`: behoben — `AsepriteJson.ts:119–121`, `DirectorShapeCache.ts:179`
- Nachsicht der Display-Maße: behoben — Ausnahme in `AGENTS.md`, `maxDeltaTime` in `Display.ts`/`Chronometer.ts` ergänzt → `acknowledged` im Abschluss
- `fitIntoRectangle()`: behoben — TSDoc `fitIntoRectangle.ts:259–261` deckt sich mit `AGENTS.md` → `acknowledged` im Abschluss
- `attachInstancedPool()`: behoben — TSDoc `InstancedVOBufferGeometry.ts:~205` → `acknowledged` im Abschluss
- `TileSet` (Zug 0): behoben — `frameId()` modulo je Id, Grenze für `firstId` in `#createTextureCoords` (`TileSet.ts:353–361`)
- Abweichungen des Implementierers: Klammerung `first + (count - 1)` berechtigt (zusätzlicher Testfall `[2**53 - 2, 3]`); TSDoc von `add()` angepasst, aber nur halb (kleiner Befund 1)

### Kleine Befunde

1. `FrameBasedAnimations.ts:607–609` — der Satz »`firstTileId` and `tileCount` are checked only when they are passed« steht neben der immer laufenden Bereichsprüfung; besser »The whole-number checks of …«.
2. `TileSet.ts:62` (TSDoc der Option `firstId`) und `packages/twopoint5d/docs/textures.md:221` nennen `firstId` nur »a whole number«, nicht die Grenze ±`Number.MAX_SAFE_INTEGER` für die Ids aller Kacheln.
3. `RepeatingTilesProvider.ts:~436` — TSDoc-Absatz des Setters nach dem eingefügten Satz nicht neu umbrochen, eine Zeile deutlich zu lang.
4. `CHANGELOG.md:~108` (Migration Guide `PanControl2D#keys`) — »which lost a direction without a word« blickt auf den Vorzustand; im Migration Guide üblich, optional kürzen.
