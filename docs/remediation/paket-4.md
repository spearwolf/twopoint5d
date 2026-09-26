# Paket 4 — TextureCoords und Atlas-Format: rotierte Frames, JSON Array, TileSet-Grenzen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: IMPL-011 (medium, anteilig — die Seite des Atlas-Formats; die Konsumenten in `src/sprites/`, `src/map2d/` und im Lookbook, die einen Frame mit Diagonalspiegelung richtig zeichnen, sind Paket 9, und erst mit ihm ist IMPL-011 geschlossen), BUG-109 (low), API-036 (low), TYPE-016 (low), PERF-029 (info, Optimierungspotenzial) · dazu aus »Offene Befunde« `TileSet.ts:154` (gleiche Ursache wie TYPE-016)
- Ziel: `TextureCoords` rechnet `s`, `t`, `u`, `v` in einem Gang durch die Parent-Kette und ist ehrlich typisiert; `TexturePackerJson` liest »JSON Hash« und »JSON Array« und legt einen rotierten Frame als `TextureCoords` an, die die Drehung tragen; `TileSet` weist einen ersten Tile, der nicht ins Bild passt, und eine Tile-id, die keine ganze Zahl ist, zurück und hält immer ein Options-Objekt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/TextureCoords.ts`, `TextureCoords.spec.ts`
  - `packages/twopoint5d/src/texture/TexturePackerJson.ts`, `TexturePackerJson.spec.ts`
  - `packages/twopoint5d/src/texture/isAtlasJsonResponse.ts`, `isAtlasJsonResponse.spec.ts`
  - `packages/twopoint5d/src/texture/TileSet.ts`, `TileSet.spec.ts`
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts` (nur `renderFloatsBuffer`)
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts` (nur `setFrame()`), `TexturedSprites.spec.ts` (zwei Attrappen)
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts` (nur `createTile()`)
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts` (zwei `root?.`), dazu dort und in `TextureResource.spec.ts` Bild-Attrappen, die kleiner sind als ihr Tile (Schritt 6)
  - `apps/lookbook/src/pages/demos/textured-sprites.astro` (eine Option)
  - `packages/twopoint5d/docs/architecture.md` (ein Satz), `packages/twopoint5d/CHANGELOG.md`
- Vorgehen:
  1. **`TextureCoords` — ein Gang durch die Kette, ehrliche Typen.**
     - `get root(): TextureCoords` (ohne `| undefined`); der Rumpf bleibt.
     - Eine modulinterne Funktion rechnet in **einem** Gang von `this` bis zur Wurzel die Summe der `x` und die Summe der `y` aller Glieder, merkt sich `width`/`height` der Wurzel und leitet daraus `minX = sumX / rootW`, `maxX = (width + sumX) / rootW`, `minY = sumY / rootH`, `maxY = (height + sumY) / rootH` ab (`width`/`height` die eigenen). Dann nach den Flip-Bits: s-Achse = `flipD ? y : x`, t-Achse = `flipD ? x : y`; `s = flipH ? sMax : sMin`, `s1 = flipH ? sMin : sMax`, `t = flipV ? tMax : tMin`, `t1 = flipV ? tMin : tMax`. Das ist exakt die heutige Semantik von `minCoord`/`maxCoord`, nur ohne zweiten Gang.
     - Alle sechs Getter `s`, `t`, `s1`, `t1`, `u` (`s1 - s`), `v` (`t1 - t`) und die neue Methode unten lesen aus dieser einen Funktion, damit sie bitgenau übereinstimmen. Um je Getter-Aufruf nichts zu allozieren, darf die Funktion in ein modulweites Scratch-Array schreiben (kein Callback, keine Reentranz). `minCoord`/`maxCoord` entfallen.
     - Neu, öffentlich, nach der Konvention der generierten `get…()`-Methoden der Vertex-Objekte (`vertex-objects/createVertexObjectPrototype.ts:38`, `VOAttrGetter` in `vertex-objects/types.ts:240`):
       ```ts
       getTexCoords(): [s: number, t: number, u: number, v: number];
       getTexCoords<T extends {length: number; [index: number]: number}>(target: T): T;
       ```
       Ohne `target` ein neues Tupel `[s, t, u, v]`, mit `target` werden die vier Werte ab Index 0 hineingeschrieben und `target` zurückgegeben, ohne Allokation. Ein `target` mit `length < 4` wirft `RangeError` mit ``TextureCoords: getTexCoords() got a target of ${target.length} values, s, t, u and v are 4`` und bleibt unverändert. Kein Import aus `vertex-objects/` — der strukturelle Typ oben deckt `number[]` und jedes Typed Array.
     - TSDoc der Klasse (englisch): die drei Flip-Bits beschreiben zusammen alle acht Lagen eines Rechtecks — `FLIP_HORIZONTAL` und `FLIP_VERTICAL` spiegeln die gezeichnete Achse, `FLIP_DIAGONAL` vertauscht die Achsen. Unter `FLIP_DIAGONAL` laufen `s`/`u` entlang der y-Achse der Textur und `t`/`v` entlang ihrer x-Achse; der Lookup an der Quad-Position `(a, b)` (0 bis 1, `b` nach unten) nimmt `(s + a·u, t + b·v)` und vertauscht die beiden Komponenten, ohne `FLIP_DIAGONAL` nimmt er sie, wie sie sind. `width`/`height` bleiben die Maße des Bereichs in der Textur, gezeichnet ist er unter `FLIP_DIAGONAL` `height` breit und `width` hoch. Ein rotierter TexturePacker-Frame kommt mit `FLIP_DIAGONAL | FLIP_VERTICAL` (Schritt 3). Diese Sätze sind der Vertrag, gegen den Paket 9 die Shader schreibt — keine Formulierung, die ein Konsument anders lesen kann.
     - TSDoc an `getTexCoords()`: ein Gang durch die Kette für alle vier Werte, während die Getter je einen gehen.
  2. **`isAtlasJsonResponse` — beide Formate, `rotated` als Boolean.**
     - `isFrameData` prüft zusätzlich: `rotated` ist `undefined` oder ein `boolean`.
     - Ist `frames` ein Array (`Array.isArray`), besteht es, wenn jedes Element `isFrameData` besteht **und** ein `filename` vom Typ `string` trägt; sonst (Objekt) wie heute über `Object.values(frames).every(isFrameData)`.
     - Doppelte Namen prüft der Guard nicht — das ist Semantik, und die prüft `parse()` für jeden Weg, auch für ein von außen geschriebenes `atlasJson`, das den Guard nie sieht.
  3. **`TexturePackerJson` — Typen, Array-Format, rotierte Frames, Namensprüfung vor dem ersten `add()`.**
     - Typen (öffentlich über `public-api.ts`):
       ```ts
       export interface TexturePackerFrameData {
         frame: {x: number; y: number; w: number; h: number};
         rotated?: boolean;
       }
       export interface TexturePackerArrayFrameData extends TexturePackerFrameData {
         filename: string;
       }
       export interface TexturePackerJsonData {
         frames: Record<string, TexturePackerFrameData> | TexturePackerArrayFrameData[];
         meta: TexturePackerMetaData;
       }
       ```
       TSDoc: `frames` ist »JSON Hash« (Name = Schlüssel) oder »JSON Array« (Name = `filename`); `rotated: true` heißt, der Packer hat das Sprite um 90° im Uhrzeigersinn gedreht in den Bogen gelegt, `frame.w`/`frame.h` sind die Maße des Sprites wie gezeichnet, im Bogen belegt es `h` × `w` Pixel ab `frame.x`/`frame.y`.
     - `parse()`: zuerst die Liste `[name, frameData]` bilden — Array: `filename` des Elements, Hash: `Object.entries()`. Dann **vor dem ersten `add()`** jeden Namen prüfen und bei Verstoß `Error` werfen, `target` bleibt dabei unverändert:
       - doppelt im json: ``TexturePackerJson: the frame name "${name}" appears more than once in the json``
       - in `target` schon vergeben (`target.frameId(name) !== undefined`): ``TexturePackerJson: the frame name "${name}" is already taken in the target atlas``
     - Dann je Frame: nicht rotiert `new TextureCoords(parentCoords, frame.x, frame.y, frame.w, frame.h)` wie heute; `rotated === true`: `new TextureCoords(parentCoords, frame.x, frame.y, frame.h, frame.w)` und `coords.flip = TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL`, mit einem Kommentar, warum (Bereich im Bogen ist `h` breit und `w` hoch; die Diagonal- plus Vertikalspiegelung dreht ihn beim Zeichnen zurück).
     - Kein `data` am Frame, keine Auswertung von `trimmed`/`spriteSourceSize` — steht als eigener Eintrag in »Offene Befunde«.
  4. **`TileSet` — Options-Objekt, erster Tile, Tile-id.**
     - Konstruktor: `this.options = options ?? {}` in beiden Zweigen; alle Getter lesen `this.options.…` ohne `?.`. Typ von `options` bleibt `TileSetOptions` und stimmt damit.
     - In `#createTextureCoords` nach dem letzten `assertOption` und vor der Schleife, mit `tileOuterWidth`/`tileOuterHeight` wie heute:
       - `margin * 2 + tileOuterWidth > baseWidth` → `RangeError` ``[TileSet] the first tile does not fit into the width of the baseCoords: margin, padding and tileWidth take ${margin * 2 + tileOuterWidth}, the baseCoords are ${baseWidth} wide``
       - `margin * 2 + tileOuterHeight > baseHeight` → `RangeError` ``[TileSet] the first tile does not fit into the height of the baseCoords: margin, padding and tileHeight take ${margin * 2 + tileOuterHeight}, the baseCoords are ${baseHeight} high``
       Die Breite zuerst. Damit gilt nach dem Konstruktor `tileCount >= 1`, und jeder gelegte Tile liegt im Bild.
     - `frameId(tileId)`: als erste Anweisung `assertOption(Number.isInteger(tileId), 'tileId', 'a whole number', tileId)` — Meldung damit ``[TileSet] tileId must be a whole number, got ${describeValue(tileId)}``, `RangeError`. `frame(tileId)` geht über `frameId()` und erbt die Prüfung; der Rückgabetyp `TextureAtlasFrame` stimmt damit (das `!` bleibt und ist jetzt wahr — Kommentar dazu, warum).
     - TSDoc: `@throws` des Konstruktors um den ersten Tile ergänzen; `frameId()` und `frame()` bekommen `@throws {RangeError}` für eine Tile-id, die keine ganze Zahl ist (negative ganze Zahlen bleiben erlaubt, die Arithmetik wickelt sie um).
  5. **Aufrufer auf `getTexCoords()` umstellen**, ohne Verhaltensänderung:
     - `FrameBasedAnimations.ts` `renderFloatsBuffer` (`:127-131`): statt `({s, t, u, v, width, height}) => …` die vier Werte über `getTexCoords()` plus `width`/`height`; das Buffer-Layout bleibt Byte für Byte, wie es ist (das Layout ändert Paket 9).
     - `TexturedSprite.ts` `setFrame()` (`:50-53`) und `TileSpritesFactory.ts` `createTile()` (`:62`): `setTexCoords(coords.getTexCoords(scratch))` mit einem modulweiten Scratch-Tupel `[number, number, number, number]` — der VO-Setter kopiert die Werte in seinen Buffer, das Tupel ist danach frei. Kommentar dazu. Die Diagonalspiegelung werten diese Stellen noch nicht aus; das ist Paket 9.
     - Das Lookbook bleibt unberührt bis auf Schritt 6 — seine `setTexCoords([texCoords.s, …])`-Stellen zieht Paket 9 um, das sie ohnehin anfassen muss.
  6. **Was die Änderung umwirft, mitziehen:**
     - `apps/lookbook/src/pages/demos/textured-sprites.astro:56` — `margin: 1` streichen: `skinball-256.png` ist 256 × 256, ein Tile von 256 hat neben einem Rand von 1 keinen Platz, und der neue `RangeError` beendete das Demo. Ohne Rand liegt der eine Tile genau auf dem Bild.
     - `TileSet.spec.ts:133-140` (`a single tile that does not fit inside the margin is laid all the same`) hält das alte Verhalten fest — wird zum Regressionstest unten umgeschrieben, der Kommentar dazu sagt, was jetzt gilt, nicht was früher galt.
     - `TileSet.spec.ts:125-131` (`a tile wider than the image still ends the layout`, Basis 64 × 64, `tileWidth: 100`) sicherte, dass die Schleife endet; jetzt wird der Tile vor der Schleife abgewiesen. Umschreiben auf den `RangeError` zur Breite (`take 100`, `64 wide`); die Endlichkeit der Schleife hält weiter der Test mit `tileWidth: 0`.
     - Specs, deren Bild-Attrappe kleiner ist als ihr Tile (`TextureResource.spec.ts` und `TextureStore.spec.ts` arbeiten mit Attrappen ab 8 × 8 und Tile-Sets ab 8 × 8, `TextureStore.spec.ts:894-952,1374-1450`): läuft dort jetzt der neue `RangeError` statt des geprüften Verhaltens, bekommt die Attrappe die Größe, die ihr Tile braucht — die Prüfung wird nicht gelockert, und ein Test, der genau den zu großen Tile meint, prüft die neue Meldung.
     - `TextureStore.spec.ts:1235,1291` — `coords.root?.width` → `coords.root.width`.
     - `TexturedSprites.spec.ts:73,148` — die Attrappen `{coords: {s, t, u, v}} as unknown as TextureAtlasFrame` haben kein `getTexCoords()`: auf echte `TextureCoords` umstellen, deren `s`/`t`/`u`/`v` die bisher erwarteten Werte ergeben — Wurzel `new TextureCoords(0, 0, 4, 2)`, Kind `new TextureCoords(root, 1, 1, 3, 2)` → `0.25, 0.5, 0.75, 1`, die Erwartungen bleiben stehen —, statt `getTexCoords` in die Attrappe zu kleben.
     - `packages/twopoint5d/docs/architecture.md:83-84` — »parse the external formats (TexturePacker JSON, …)« nennt beide Formate: »TexturePacker JSON Hash and JSON Array, rotated frames included«.
     - `pnpm typecheck` prüft Lookbook, Browser-Tests und `ts check`-Blöcke gegen die gebaute Library; was dort an `TexturePackerJsonData.frames` (jetzt Union) oder `root` hängt, zieht mit.
  7. **CHANGELOG** `packages/twopoint5d/CHANGELOG.md` unter `[Unreleased]` (Skill `updating-changelog`), ohne Rückblick-Sätze:
     - Added: »JSON Array« in `TexturePackerJson.parse()` und damit in `TextureAtlasLoader` und den Atlas-Resources des `TextureStore`, Name aus `filename`, Typ `TexturePackerArrayFrameData`; ein rotierter Frame (`rotated: true`) wird zu `TextureCoords` über den Bereich im Bogen mit `FLIP_DIAGONAL | FLIP_VERTICAL`; `TextureCoords#getTexCoords(target?)`.
     - Changed: `TexturePackerJsonData#frames` ist eine Union aus Hash und Array — wer `frames` liest, unterscheidet die beiden; `TextureCoords#root` ist `TextureCoords`; `TileSet#options` ist ohne zweites Argument `{}`.
     - Fixed: `TileSet` wirft `RangeError` für einen ersten Tile, der samt `margin` und `padding` nicht in die `baseCoords` passt — ein Tile-Set, das das bisher stillschweigend mit UVs über 1 anlegte, bricht jetzt mit Meldung ab; `TileSet#frameId()`/`frame()` werfen `RangeError` für eine Tile-id, die keine ganze Zahl ist; `TexturePackerJson.parse()` weist einen Frame-Namen, der doppelt vorkommt oder im `target` schon vergeben ist, ab, bevor es einen Frame einträgt.
- Regressionstests (vor dem Fix rot; der rote Lauf gehört in den Report):
  - `TexturePackerJson.spec.ts`:
    - `a JSON Array registers every frame under its filename` — zwei Elemente mit `filename: 'walk_01.png'`/`'walk_02.png'`, `frameNames()` ergibt genau diese beiden (heute `'0'`, `'1'`).
    - `a rotated frame spans the area it takes in the sheet and turns back by a diagonal and a vertical flip` — `meta.size` `{w: 128, h: 256}`, Frame `{x: 16, y: 32, w: 64, h: 32}`, `rotated: true` → `coords` `{x: 16, y: 32, width: 32, height: 64}`, `flip === TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL`, `s: 0.125`, `t: 0.375`, `u: 0.25`, `v: -0.25` (alle Werte exakt binär, `toBe` genügt).
    - `the corners of a rotated frame come out of the sheet turned back by 90°` — spec-lokaler Helfer `lookup(coords, a, b)`: `p = [s + a·u, t + b·v]`, unter `flipD` `[p[1], p[0]]`, sonst `p`. Für den Frame oben: `(0, 0)` → `[0.375, 0.125]` (rechts oben im Bogen), `(1, 0)` → `[0.375, 0.375]` (rechts unten), `(1, 1)` → `[0.125, 0.375]` (links unten), `(0, 1)` → `[0.125, 0.125]` (links oben). Das ist die Zuordnung, die PixiJS für TexturePacker-Frames mit `rotated: true` rechnet (`rotate: 2`, Bereich `(x, y, h, w)`), und der Vertrag für Paket 9.
    - `a json that names a frame twice is refused and leaves the target atlas as it was` — Array mit zwei gleichen `filename`, `target` mit einem Frame `x`: wirft mit der Meldung oben, `target.frameNames()` bleibt `['x']`.
    - `a frame name the target atlas already holds is refused before any frame is added` — Hash `{a, b}`, `target` hält schon `b`: wirft, `target.frameNames()` bleibt `['b']` (heute steht danach `a` drin).
  - `isAtlasJsonResponse.spec.ts`: bestehen — `a JSON Array whose entries carry a filename passes`, `a frame with rotated true passes`; abgelehnt, in die Tabelle — `a JSON Array entry without a filename` (heute besteht es), `a JSON Array entry whose filename is a number`, `a frame whose rotated is a string`.
  - `TextureCoords.spec.ts`:
    - `getTexCoords() answers s, t, u and v as the getters do` — `test.each` über `flip` 0 bis 7 an Coords mit zwei Parents (`root 320 × 160`, `parent (4, 6, 200, 120)`, `tex (20, 10, 100, 50)`), `toEqual([tex.s, tex.t, tex.u, tex.v])`.
    - `getTexCoords() writes into the target it is given and answers it` — `Float32Array(6)` und `number[]`, dieselbe Instanz zurück, Werte ab Index 0.
    - `getTexCoords() refuses a target shorter than four values and leaves it as it was`.
    - `root is a TextureCoords, never undefined` — `expectTypeOf(tex.root).toEqualTypeOf<TextureCoords>()` (vitest; rot heißt hier: `pnpm typecheck` meldet den Typfehler — diese Ausgabe in den Report).
  - `TileSet.spec.ts`:
    - `a first tile that does not fit inside the margin is refused` — `new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 256, tileHeight: 256, margin: 1})` wirft `RangeError` mit ``[TileSet] the first tile does not fit into the width of the baseCoords: margin, padding and tileWidth take 258, the baseCoords are 256 wide`` (ersetzt den Test `:133-140`).
    - `a first tile taller than the baseCoords is refused` — `(0, 0, 64, 32)`, `{tileWidth: 32, tileHeight: 64}` → Meldung zur Höhe mit `take 64`, `32 high`.
    - `a tile set built without options holds an empty options object` — `new TileSet(new TextureCoords(0, 0, 64, 64)).options` `toEqual({})` (heute `undefined`).
    - `frameId() and frame() refuse a tileId that is no whole number` — `test.each` über `1.5`, `NaN`, `Infinity`, Meldung ``[TileSet] tileId must be a whole number, got 1.5`` usw., für `frameId()` und `frame()`; eine negative ganze Zahl wirft nicht.
- Verify: `pnpm run ci`
- Commit: `fix(texture,sprites,map2d,lookbook): read the JSON Array format of TexturePacker with the frame names from filename and a rotated frame as the area it takes in the sheet, turned back by a diagonal and a vertical flip, refuse a frame name that appears twice or that the target atlas already holds before TexturePackerJson.parse() adds a frame, type TextureCoords#root as never undefined and add TextureCoords#getTexCoords() that answers s, t, u and v in one walk up the parents, give TileSet an empty options object when none is passed, refuse a first tile that does not fit into the base coords and a tile id that is no whole number, and drop the margin the tile set of the textured-sprites demo has no room for`
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · IMPL-011 unverändert (`isAtlasJsonResponse.ts:22-24`), die Parser-Stelle nach `TexturePackerJson.ts:38-40` gewandert (Paket 3 hat den TODO in `:19` entfernt) · BUG-109 unverändert, nach `TileSet.ts:199-225` gewandert; der Spec `TileSet.spec.ts:133-140` aus Paket 1 hält das alte Verhalten fest · API-036 unverändert `TextureCoords.ts:71` · TYPE-016 unverändert `TileSet.ts:67,82-95` · PERF-029 unverändert `TextureCoords.ts:121-155` · Paket geteilt: die Konsumentenseite von IMPL-011 → Paket 9 · aus »Offene Befunde« aufgenommen: `TileSet.ts:154` · neu in »Offene Befunde«: getrimmte Frames (`TexturePackerJson.ts:38-40`, → Scope) · keine offenen Folgen (Paket 1 und 2 triagiert, Paket 3 und 8 ohne Folgen)
  - 2026-09-26 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-4.impl-0.json`
  - 2026-09-26 Zug 2: Report FERTIG · 16 Dateien geändert (texture: TextureCoords, TexturePackerJson, isAtlasJsonResponse, TileSet, FrameBasedAnimations samt Specs, TextureStore.spec; TexturedSprite + Spec, TileSpritesFactory, textured-sprites.astro, architecture.md, CHANGELOG) · Arbeitsbaum schmutzig · 25 Regressionstests vor dem Fix rot · Verify `pnpm run ci` exit=0 (`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0b6aa1e7-f4dd-40ca-8a4b-c96b3bffeabf/scratchpad/paket-4.verify.log`)
  - 2026-09-26 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0b6aa1e7-f4dd-40ca-8a4b-c96b3bffeabf/scratchpad/paket-4.diff`, Report nach `paket-4.review-0.json`
  - 2026-09-26 Zug 3: Urteil — alle Findings behoben; 0 kritisch, 1 wichtig (Rückblick »instead of one to two walks each« im CHANGELOG), 2 klein (Array-Destructuring in `u`/`v`/`getTexCoords()`, Migration-Snippet ohne Schleife)
  - 2026-09-26 Zug 4 Runde 1: offen 1 wichtig + 2 klein → derselbe Implementierer per Resume (sonnet, medium), Report nach `paket-4.impl-1.json`
  - 2026-09-26 Zug 4 Runde 1 zurück: FERTIG · CHANGELOG (Rückblick gestrichen, zwei weitere Fixed-Sätze ohne Vorzustand, Migration-Snippet mit Schleife), `TextureCoords.ts` Indexzugriff · Verify `pnpm run ci` exit=0 (`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0b6aa1e7-f4dd-40ca-8a4b-c96b3bffeabf/scratchpad/paket-4.verify-1.log`) · der gemeldete Prettier-Befund am CHANGELOG trägt nicht (`prettier --check` sauber an HEAD und jetzt) · Reviewer gezielt (opus, medium), Diff `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0b6aa1e7-f4dd-40ca-8a4b-c96b3bffeabf/scratchpad/paket-4.diff-1`, Report nach `paket-4.review-1.json`
  - 2026-09-26 Zug 4 Runde 1 Review: alle drei Befunde behoben, 0 neu
  - 2026-09-26 Zug 5: committet `286f6b56` (Verify `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0b6aa1e7-f4dd-40ca-8a4b-c96b3bffeabf/scratchpad/paket-4.verify-1.log` exit=0) · Plan auf [x]

## Abgleich

Gegen HEAD `d6022aa4`.

- **IMPL-011** — unverändert. `isAtlasJsonResponse.ts:22-24`: `frames` muss nur ein Objekt sein, `Object.values(frames).every(isFrameData)` lässt ein Array durch; `TexturePackerJson.ts:38-40` (im Audit `:39-41`, eine Zeile höher gewandert, seit Paket 3 den TODO-Kommentar entfernt hat) iteriert `Object.entries(data.frames)`, ein Array liefert die Namen `'0'`, `'1'`, …; `rotated` wird nirgends gelesen. Kein Atlas im Lookbook ist rotiert oder im Array-Format (`apps/lookbook/public/assets/*.json`: 74× `"rotated": false`, `frames` stets ein Objekt).
- **BUG-109** — unverändert, verschoben. Die Schleife `TileSet.ts:199-225` legt den ersten Tile ohne Prüfung (`:200-202`); die Grenzprüfung `:216,221` gilt erst dem nächsten. Paket 1 und 3 haben davor `assertOption`-Zeilen ergänzt (`:171-190`), am Sachverhalt nichts. `TileSet.spec.ts:133-140` schreibt ihn als erwartetes Verhalten fest, mit Verweis auf das Demo `textured-sprites.astro` — genau das Demo bricht mit dem Fix (256er-Tile, `margin: 1`, Bild 256 × 256) und zieht mit. Die übrigen Tile-Sets im Lookbook passen (nachgerechnet: `nobingers.json` 322 × 66 braucht 66 × 66; `ball-patterns.png` 256² mit 128er-Tiles; `glaskugeln-2-256x.png` 1024 × 256; `map2d-debug-tiles_4x256x256.png` 512²), ebenso das Fixture der Browser-Tests (`fixtures.js:163`, 256² mit 128er-Tiles).
- **API-036** — unverändert, `TextureCoords.ts:71`. Aufrufer mit überflüssigem `?.`: `TextureStore.spec.ts:1235,1291`.
- **TYPE-016** — unverändert, `TileSet.ts:67` und `:82-95` (im Audit `:83-91`); die Getter `:97-140` lesen `this.options?.`.
- **PERF-029** — unverändert, `TextureCoords.ts:121-155`. Heiße Aufrufer: `TexturedSprite.ts:52` und `TileSpritesFactory.ts:62` (je sechs Gänge durch die Kette pro Aufruf), `FrameBasedAnimations.ts:129-131` beim Backen; dazu fünf Stellen im Lookbook (→ Paket 9).
- **Aus »Offene Befunde«: `TileSet.ts:154`** — unverändert. `frame(tileId)` gibt für eine Tile-id, die keine ganze Zahl ist, `undefined` hinter `!` zurück; `frameId()` `:142-144` rechnet dafür eine gebrochene Frame-id. Aufrufer: `FrameBasedAnimations.ts:246,267` (seit Paket 3 vorher geprüft), `TileSpritesFactory.ts:48` (fängt es heute über `expectDefined` mit anderer Meldung, wirft danach aus `frameId()` — beides vor der Pool-Entnahme, die TSDoc von `createTile()` bleibt wahr).

## Entscheidungen in Zug 0

- **Teilung in 4 und 9.** Die Konsumentenseite der rotierten Frames — `colorFromTextureByTexCoords()`, die Deskriptoren von `TexturedSprite` und `TileSprite`, das Layout des `animsMap` samt `AnimatedSpritesMaterial`, das Lookbook und ein Browser-Test mit Pixelprobe — geht über drei Module, braucht die zweite Testfläche und die stärkste Modellstufe; der Rest ist ein Texture-Paket für die mittlere Stufe mit Unit-Tests. Die Kennung `4a`/`4b` trägt die Schleife nicht: sie führt Zug 0 dieses Pakets unter der Nummer 4 und prüft danach die Marke von `4`. Deshalb bleibt 4 das Texture-Paket, und die Konsumentenseite bekommt die nächste freie Nummer, 9, direkt hinter 4 eingereiht. Zwischen beiden Commits zeichnen die Sprites einen rotierten Frame noch falsch — wie heute, nur anders falsch; kein Release liegt dazwischen.
- **Die Drehung trägt `flip`, kein neues Feld.** Die drei Flip-Bits von `TextureCoords` beschreiben bereits alle acht Lagen eines Rechtecks (Diedergruppe D4), eine Drehung um 90° ist Diagonal- plus eine Achsspiegelung. Ein eigenes `rotation`-Feld wäre eine zweite Beschreibung desselben und müsste mit `flip` verrechnet werden. `FLIP_DIAGONAL | FLIP_VERTICAL` über dem Bereich `(x, y, h, w)` ergibt genau die Zuordnung, die PixiJS für TexturePacker rechnet (`Spritesheet#_processFrames`: Rechteck `(rect.x, rect.y, rect.h, rect.w)`, `rotate: 2`; die Ecken daraus: gezeichnet links oben → Bogen rechts oben, rechts oben → rechts unten, rechts unten → links unten, links unten → links oben). Die Doku von TexturePacker lässt die Drehrichtung im Custom-Exporter offen (`cw`/`ccw`), die Standard-Exporter für JSON drehen im Uhrzeigersinn — Pixi und Phaser (`Frame#updateUVsInverted`: rechter Rand bei `cutX + cutHeight`) lesen `frame.w`/`frame.h` beide als Maße des ungedrehten Sprites. Der Regressionstest mit den vier Ecken hält das fest.
- **`getTexCoords(target?)` statt Cache mit Invalidierung.** `x`, `y`, `width`, `height`, `flip` und `parent` sind öffentliche, veränderliche Felder, und ein Kind erfährt nicht, wenn sich ein Parent ändert; ein Cache müsste bei jedem Zugriff die Kette ablaufen, um sich zu prüfen — das kostet so viel wie das Rechnen. Die Empfehlung des Audits nennt `getUV(out)` als zweiten Weg; der Name folgt den generierten `get…()`-Methoden der Vertex-Objekte, die ebenfalls ein optionales Target nehmen, und passt zu `setTexCoords()` der Sprites: `sprite.setTexCoords(coords.getTexCoords(scratch))`.
- **`frameId()` wirft statt `frame()` mit `| undefined`.** `TileSet` prüft seine Eingaben streng (`assertOption`), `FrameBasedAnimations#add()` weist dieselbe Tile-id schon ab; ein `| undefined` im Rückgabetyp würde jeden Aufrufer zu einer Prüfung zwingen, die nur für einen Programmierfehler greift. Gleiche Ursache wie TYPE-016: ein Member von `TileSet` verspricht im Typ, was er nicht hält.
- **`parse()` prüft die Namen vor dem ersten `add()`.** Das Array-Format macht doppelte Namen erst möglich (Hash-Schlüssel sind eindeutig); `TextureAtlas#add()` würde beim zweiten werfen und die Hälfte der Frames im `target` stehen lassen. Beide Aufrufer mit eigenem `parse()` (`TextureResource.ts:974`, `TextureAtlasLoader.ts:96`) fangen den Wurf und melden ihn bereits — für ein frisches Atlas ohne Spur, für ein übergebenes `target` jetzt ebenso.
- **Das Buffer-Layout von `bakeDataTexture()` bleibt hier, wie es ist.** Die Diagonalspiegelung braucht dort einen Platz je Frame, und Schreiber und Leser (`AnimatedSpritesMaterial`) müssen gemeinsam umgestellt werden — das ist Paket 9. Paket 4 stellt nur die Werteberechnung auf `getTexCoords()` um.

## Urteil des Reviewers

Aus `paket-4.review-0.json`, bestätigt nach Runde 1 in `paket-4.review-1.json`:

- **IMPL-011 (anteilig)** — behoben für die Formatseite: Guard `isAtlasJsonResponse.ts:19-44` (Array nur mit `filename: string`, `rotated` nur Boolean), `TexturePackerJson.ts:53-55` (Liste aus `filename` bzw. `Object.entries`), `:69-78` (rotierter Frame über `(x, y, h, w)` mit `FLIP_DIAGONAL | FLIP_VERTICAL`), Vertrag in der TSDoc `TextureCoords.ts:45-58` und im Eckentest `TexturePackerJson.spec.ts:95-104`. Konsumentenseite offen → Paket 9.
- **BUG-109** — behoben: `TileSet.ts:209-220` prüft vor der Schleife Breite, dann Höhe; Specs `TileSet.spec.ts:125-157`; `textured-sprites.astro` ohne `margin: 1`.
- **API-036** — behoben: `TextureCoords.ts:105` `get root(): TextureCoords`; `TextureStore.spec.ts:1235,1291` ohne `?.`; Typtest `TextureCoords.spec.ts:227-233`.
- **TYPE-016** — behoben: `TileSet.ts:92,98` `options ?? {}` in beiden Zweigen, Getter ohne `?.`.
- **PERF-029** — behoben: `computeBounds()` `TextureCoords.ts:1-42`, alle Getter und `getTexCoords()` lesen daraus; heiße Aufrufer `TexturedSprite.ts:54`, `TileSpritesFactory.ts:65`, `FrameBasedAnimations.ts:129-131` umgestellt.
- **Nebenbefund `TileSet.ts:154`** — behoben: `frameId()` prüft `Number.isInteger` (`TileSet.ts:151-154`), `frame()` erbt, `!` kommentiert (`:163-167`).

Kleine Befunde: beide aus Review 0 in Runde 1 mit erledigt (Indexzugriff in `TextureCoords.ts:171-178,194-199`; Migration-Snippet `CHANGELOG.md:2653-2664`). Hinweis des Reviewers an den Detailplan: Schritt 6 nennt »den Test mit `tileWidth: 0`« als Wächter der Schleifenendlichkeit, `tileWidth: 0` scheitert aber schon an `assertOption` — kein Mangel, eine endlose Schleife ist mit der Prüfung des ersten Tiles nicht mehr möglich. Die Abweichung des Implementierers: die Bild-Attrappe in `TileSet.spec.ts` (`a fractional padding lays out as many tiles as fit`) von 100 × 10 auf 100 × 13 vergrößert, Erwartungen unverändert. Der vom Implementierer in Runde 1 gemeldete Prettier-Befund am CHANGELOG trägt nicht (`prettier --check` sauber an `d6022aa4` und an `286f6b56`).

## Findings im Volltext

**IMPL-011 · medium · packages/twopoint5d/src/texture/isAtlasJsonResponse.ts:22-24** (dazu `TexturePackerJson.ts:39-41`) — TexturePacker »JSON Array« und rotierte Frames im Atlas-Guard ablehnen oder unterstützen
Bei `frames` als Array (TexturePacker »JSON Array«, Default in Phaser) besteht jedes Element den Guard. `Object.entries` liefert dann die Namen `"0"`, `"1"` … statt `filename`, und `frame('walk_01.png')` findet nichts. `rotated: true` wird ohne Meldung ignoriert, rotierte Frames werden verzerrt gezeichnet.
Empfehlung: Das Array-Format unterstützen (Name aus `filename`) oder im Guard ablehnen. `rotated === true` ablehnen oder auswerten.
Entscheidung vom 2026-09-26 im Plan: »JSON Array« wird unterstützt, rotierte Frames echt — `TextureCoords` trägt die Drehung, UV-Ableitung und Konsumenten ziehen mit.

**BUG-109 · low · packages/twopoint5d/src/texture/TileSet.ts:196-205** — Den ersten Tile eines TileSet gegen die Bildgröße prüfen
Die Grenzprüfung läuft erst für den nächsten Tile. Mit `tileWidth: 64` auf einem 32-px-Bild entsteht ohne Meldung `tileCount = 1` mit UVs über 1, obwohl der Rest der Optionen streng validiert wird.
Empfehlung: Vor der Schleife `margin*2 + tileOuterWidth <= baseWidth` (analog die Höhe) prüfen und sonst einen `RangeError` werfen.

**API-036 · low · packages/twopoint5d/src/texture/TextureCoords.ts:71** — TextureCoords.root als nie-undefined typisieren
`root` ist als `TextureCoords | undefined` deklariert, kann aber nie `undefined` sein. Aufrufer müssen deshalb unnötig `?.` schreiben, der eigene Spec eingeschlossen.
Empfehlung: `root: TextureCoords` deklarieren.

**TYPE-016 · low · packages/twopoint5d/src/texture/TileSet.ts:67** (dazu `:83-91`) — TileSet#options optional typisieren oder immer ein Objekt ablegen
`options` ist als `TileSetOptions` deklariert, ist ohne zweites Konstruktorargument aber `undefined`. Die Klasse liest es selbst defensiv mit `?.`, externe Leser verlassen sich dagegen auf den Typ.
Empfehlung: `options` auf `{}` defaulten, damit der Typ stimmt.

**PERF-029 · info (Optimierungspotenzial) · packages/twopoint5d/src/texture/TextureCoords.ts:121-155** — Absolute UV-Koordinaten in TextureCoords einmal statt pro Zugriff berechnen
Die Getter `u` und `v` laufen bei jedem Zugriff die Parent-Kette ab. `{s,t,u,v}` zu destrukturieren kostet sechs Kettenläufe. Heute ist das unkritisch, es skaliert aber mit der Sprite-Zahl und der Verschachtelungstiefe.
Empfehlung: Lazy berechnen und bei Mutation invalidieren oder `getUV(out)` anbieten.

**Nebenbefund aus »Offene Befunde« · low · packages/twopoint5d/src/texture/TileSet.ts:154** — `frame(tileId)` gibt für eine Tile-id, die keine ganze Zahl ist, `undefined` hinter einem `!` zurück, obwohl der Rückgabetyp `TextureAtlasFrame` verspricht; `FrameBasedAnimations#add()` fängt das seit Paket 3 ab, direkte Aufrufer nicht (vorbestehend, `fceda80b:…/TileSet.ts:153`).

## Restplan

- Paket 9 steht direkt hinter 4: es hängt nur an 4, berührt keine Datei von 7 und 5 (beide `TextureResource.ts`) und muss vor 6 laufen, weil 6 dieselben Lookbook-Demos `textured-quads*.astro` auf den Store umzieht — die Abhängigkeitszeile von 6 nennt deshalb auch 9.
- Sonst ändert sich an Reihenfolge und Schnitt nichts: kein Finding ist weggefallen, keine Folge war offen, und der aufgenommene Nebenbefund `TileSet.ts:154` gehörte keinem anderen Paket.
