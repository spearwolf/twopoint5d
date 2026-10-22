# Paket 11 — Texture-Daten: Aseprite/TexturePacker, FrameTable, Sampling, Atlas, TileSet

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-027 (low), BUG-028 (low), BUG-029 (low), TYPE-003 (low), BUG-030 (low), API-011 (low)
- Ziel: Parser validieren und typisieren ihre Eingaben, Frame-Indizes werden ganzzahlig und
  backendunabhängig berechnet, und Atlas wie TileSet liefern nur, was sie dokumentieren.
- Modell: stärkste Stufe
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`, außer wo anders genannt):
  - Code: `src/texture/AsepriteJson.ts`, `src/texture/FrameBasedAnimations.ts`, neu
    `src/texture/animationPlayback.ts`, `src/texture/TexturePackerJson.ts`,
    `src/texture/atlasAdapters.ts`, `src/texture/FrameTable.ts`, `src/texture/AtlasFrameTable.ts`
    (nur TSDoc), `src/texture/sampleAtlasFrame.ts`, neu `src/texture/roundHalfUp.ts`,
    `src/texture/TextureAtlas.ts`, `src/texture/internals.ts`, `src/texture/selectAtlasFrames.ts`,
    `src/texture/DynamicAtlas.ts` (nur `remove()`-TSDoc und die Zahl in der Voll-Meldung von
    `#pack()`), `src/texture/TileSet.ts`, `src/sprites/node-utils.ts`,
    `src/sprites/features/TableFrame.ts`, `src/sprites/features/PaletteSwap.ts`
  - Specs: `src/texture/AsepriteJson.spec.ts`, `src/texture/TexturePackerJson.spec.ts`,
    `src/texture/FrameTable.spec.ts`, `src/texture/AtlasFrameTable.spec.ts`,
    `src/texture/sampleAtlasFrame.spec.ts`, neu `src/texture/roundHalfUp.spec.ts`,
    `src/texture/TextureAtlas.spec.ts`, `src/texture/DynamicAtlas.spec.ts`,
    `src/texture/TileSet.spec.ts`, `src/sprites/node-utils.spec.ts`,
    `src/sprites/features/TableFrame.spec.ts`, `src/sprites/features/PaletteSwap.spec.ts`,
    `packages/twopoint5d-testing/test/sprites-table-frame.test.js`
  - Doku: `docs/sprites.md`, `docs/proposals/table-frames-and-palette-swap.md`,
    `docs/proposals/atlas-frame-sampling.md`, `docs/proposals/animation-playback-and-aseprite.md`,
    `docs/proposals/dynamic-atlas-and-bitmap-text.md` (nur §3.6), `CHANGELOG.md`
- Vorgehen: siehe Abschnitt »Vorgehen« unten, Schritte 0–8.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: refuse a playback of AsepriteJson.parse() that is none of the three before the first frame and read it by the own keys of the option, type TexturePackerJson.parse() by the data of its frames, find the texel of an index in int, round a float frame index, the frameIndex of tableFrame() and the paletteRow of PaletteSwap half up on every backend, floor the colour cycle of PaletteSwap clear of the f32 division, leave a frame a DynamicAtlas removed out of the random draws, the tables of every frame and the count of a full atlas, and refuse a TileSet whose tileCount does not fit`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · alle sechs Findings bestehen: BUG-027 unverändert
    (`AsepriteJson.ts:141`, `:263`, `:299–301`), BUG-028 unverändert (`FrameTable.ts:121`, `:29–31`,
    `node-utils.ts:77`), BUG-029 unverändert (`sampleAtlasFrame.ts:106`, TSDoc `:65`), TYPE-003
    unverändert (`AsepriteJson.ts:291–295`, `atlasAdapters.ts:29`/`:30`), BUG-030 unverändert
    (`TextureAtlas.ts:116–118`, `selectAtlasFrames.ts:24–28`, `DynamicAtlas.ts:434`), API-011
    unverändert (`TileSet.ts:89–92`, `:271–273`) · aufgenommen, gleiche Ursache: zu BUG-027 das
    Lesen von `options.playback` über die Prototypkette, zu BUG-028 `PaletteSwap.ts:104`, zu
    BUG-029 `TableFrame.ts:106` und `PaletteSwap.ts:107` · Triage: keine `Folgen:` offen, kein
    Eintrag in »Offene Befunde« mit gleicher Ursache · Restplan: Paket 12 hängt von Paket 11 ab
  - 2026-10-22 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach
    `paket-11.impl-0.json` im Arbeitsverzeichnis
  - 2026-10-22 Zug 2: Report FERTIG · 37 Pfade geändert/neu (neu `animationPlayback.ts`, `roundHalfUp.ts`,
    `roundHalfUp.spec.ts`; mitgezogen `FeatureSprites/fixtures/preset-graphs.json`) · Arbeitsbaum schmutzig ·
    Verify `pnpm run ci` exit=0 (`paket-11.verify.log`)
  - 2026-10-22 Zug 3: Reviewer (opus, medium) — alle sechs Findings und die drei aufgenommenen Punkte
    behoben · 1 wichtig (`docs/sprites.md:2628` ohne »a half up«), 3 klein · Diff `paket-11.diff`
  - 2026-10-22 Zug 4 Runde 1: offen 1 wichtig + 3 klein → derselbe Implementierer per `--resume` (opus, medium) ·
    zurück: FERTIG, `docs/sprites.md`, `atlas-frame-sampling.md`, `TableFrame.ts`, `DynamicAtlas.spec.ts` · Verify
    exit=0 (`paket-11.verify-1.log`) · Diff `paket-11.diff-1`
  - 2026-10-22 Zug 4 Runde 1 Review (sonnet, medium, `paket-11.review-1.json`): alle vier Befunde erledigt, keine
    neuen
  - 2026-10-22 Zug 5: Commit 1c42f02d (37 Pfade, Trailer `Remediation-Run: 2026-10-21`), Verify
    `paket-11.verify-1.log` exit=0 · Plan auf `[x]`

## Abgleich je Finding

Stand: `72127b52`. Zeilen in `packages/twopoint5d/src/`.

- **BUG-027** besteht unverändert. `texture/AsepriteJson.ts:141` reicht in `framesOfTag()` den
  Override ungeprüft weiter (`if (playbackOverride !== undefined) return {indices: pass, playback:
  playbackOverride};`), die Planschleife liest ihn bei `:263` als `options?.playback?.[tag.name]`.
  Geprüft wird er erst in `resolveTiming()` (`texture/FrameBasedAnimations.ts:165–169`) über
  `animations.add()` bei `:299–301` — nach `TexturePackerJson.parse()` (`:291`), also nachdem die
  Frames im `target` stehen.
- **BUG-028** besteht unverändert. `sprites/node-utils.ts:77`:
  `const column = mod(ndx.toInt().toFloat(), mapSize.x.toFloat()).toInt();`, die Zeile `:79`
  ganzzahlig. `texture/FrameTable.ts:121` legt die Breite auf `Math.min(texelCount,
  maxTextureSize)`, `:29–31` begründet `MAX_TEXELS` mit der Float-Adressierung. Aufrufer von
  `texCoordsFromIndex()`: `sprites/features/TableFrame.ts:101` und
  `sprites/features/AnimatedFrames.ts:50`.
- **BUG-029** besteht unverändert. `texture/sampleAtlasFrame.ts:106`:
  `clamp(round(typeof index === 'number' ? float(index) : index.toFloat()), 0, table.size - 1)`,
  TSDoc `:65` »A float `index` is rounded«. Das von der Empfehlung genannte Gegenstück steht in
  `sprites/features/TableFrame.ts:106` (`round(attribute<'float'>('frameIndex'))`).
- **TYPE-003** besteht unverändert. `texture/AsepriteJson.ts:291–295` castet Ziel und Ergebnis
  doppelt über `unknown`; `texture/atlasAdapters.ts:29` (`json as unknown as AsepriteJsonData`) und
  `:30` (`atlas as unknown as TextureAtlas`). Signatur `texture/TexturePackerJson.ts:55–59` kennt
  nur `TextureAtlas` (= `TextureAtlas<TexturePackerFrameData>`).
- **BUG-030** besteht unverändert. `texture/TextureAtlas.ts:116–118` zieht `rand(this.#frames.length)`
  über alle Ids, auch die, deren Name `[forgetFrameName]()` (`:75–79`) losgelassen hat;
  `texture/selectAtlasFrames.ts:24–28` nimmt ohne Auswahl `Array.from({length: atlas.size}, …)`;
  `texture/DynamicAtlas.ts:434` zählt in der Voll-Meldung `this.#atlas.size`. `remove()` steht bei
  `:323–333`, sein TSDoc bei `:317–322`.
- **API-011** besteht unverändert. TSDoc des Getters `tileCount` bei `texture/TileSet.ts:89–92`
  (»the option `tileCount`, or as many as fit«), stiller Abbruch der Layoutschleife bei `:271–273`.

## Aufgenommen — gleiche Ursache

- **Zu BUG-027:** `options?.playback?.[tag.name]` liest über die Prototypkette. Ein Tag namens
  `constructor` oder `toString` bekommt bei `parse(json, {playback: {}})` die Funktion von
  `Object.prototype` als Override, und `add()` wirft nach dem Schreiben der Frames — derselbe
  ungeprüfte Override, derselbe halb befüllte `target`.
- **Zu BUG-028:** `sprites/features/PaletteSwap.ts:104`,
  `sub(shifted, mul(safeCount, div(shifted, safeCount).floor()))`: ein ganzzahliger Quotient aus
  einer f32-Division, gefloort. Bei einem exakten Vielfachen (`shifted = 6`, `count = 3`) kann die
  GPU-Division `1.9999999` liefern, `floor` landet eins zu tief, und der Eintrag fällt aus
  `[first, first + count)`. Steht so seit `6500527f` (vor dem Lauf). Paket 7 hat dieselbe Ursache in
  `TableFrame.ts:59` und `:112` mit »einem halben Schritt mehr« gelöst.
- **Zu BUG-029:** `sprites/features/PaletteSwap.ts:107`, `round(attribute<'float'>('paletteRow'))`:
  derselbe vom Nutzer gesetzte Float-Index, dieselbe backendabhängige Halbrundung.
- **Nicht aufgenommen:** `TableFrame.ts:55` (`round()` des Kamerawinkels in `viewOf()`: die
  Grenze zwischen zwei Views, jede Seite ist richtig, kein gesetzter Index), `NineSlice.ts:203`/`:227`
  und `GridBase` (`round(uv · n)` auf ganzen Gitterlinien, nie bei .5).

## Entscheidungen dieses Zug 0, mit Grund

1. **BUG-030 und API-011 werden gefixt und dokumentiert**, nicht nur dokumentiert — beide
   Empfehlungen lassen »fixen oder dokumentieren« offen, und »Entscheidungen« Zeile 4 im Plan legt
   für diesen Fall »fixen und dokumentieren« fest.
2. **API-011 ist breaking** (`TileSet` ist veröffentlicht): CHANGELOG `Changed` mit Migration
   Guide nach »Entscheidungen« Zeile 3. Die Prüfung läuft, bevor das erste Frame in den Atlas geht,
   damit ein übergebener Atlas bei der Ablehnung unverändert bleibt (der Konstruktor ist sonst
   durchgehend Fail-fast vor Seiteneffekten).
3. **BUG-030: `TextureAtlas#size` bleibt die Zahl der vergebenen Ids.** `get(id)` antwortet für jede
   Id darunter, auch für ein losgelassenes Frame (`remove()`-Vertrag), und Schleifen über Ids hängen
   daran. Entfernt werden die losgelassenen Frames aus den Zufallsziehungen und aus der Auswahl
   »jedes Frame«; dort ist der Index eines Frames dann seine Position unter den behaltenen Frames,
   gleich seiner Id, solange nichts losgelassen wurde. `randomFrameId()` antwortet ohne ziehbares
   Frame mit `size` — eine Id ohne Frame; bei einem leeren Atlas `0` wie bisher, also kein
   Typwechsel auf `number | undefined`.
4. **BUG-029: `floor(x + 0.5)` statt TSDoc-Regel** — die Empfehlung nennt beides, nur das erste macht
   die Frames auf WebGPU und WebGL 2 gleich. Ein interner Helfer `roundHalfUp()` in
   `src/texture/roundHalfUp.ts`, weil `src/sprites/` aus `src/texture/` importiert (Vorbild
   `sampleFrameAt.ts`), nicht umgekehrt.
5. **BUG-028: Spalte ganzzahlig, keine Zweierpotenz-Breite.** Die int-Rechnung in
   `texCoordsFromIndex()` behebt auch die animsMap von `AnimatedFrames`, deren Breite über
   `bakeDataTexture({maxTextureSize})` ebenfalls keine Zweierpotenz sein muss, und lässt das
   Bake-Layout unverändert. **`MAX_TEXELS` bleibt `2 ** 24`**, nur die Begründung ändert sich: die
   Texel-Adresse ist danach int, aber Frame-Index und Frame-Zahl im Header liest der Shader als
   float32, und unter 2^24 Texeln bleiben beide exakt. Eine Anhebung auf 2^24 Frames hätte dieselben
   Doku-Stellen berührt, einen Grenztest mit 16,7 Mio. Einträgen verlangt und keinem Aufrufer genützt.
6. **BUG-027: eine Quelle für die drei Playbacks**, neues internes Modul
   `src/texture/animationPlayback.ts`. `FrameBasedAnimations.ts` steht per `export *` in
   `public-api.ts`; ein dort exportierter Guard wäre öffentlich.
7. **Changelog-Einordnung:** `AsepriteJson`, `DynamicAtlas`, `FrameTable`, `tableFrame()` und
   `paletteSwap()` stehen nur unter `[Unreleased]` / `Added` (nicht in `v0.23.0`) — Änderungen gehen
   in deren `Added`-Zeilen, ohne Migration Guide (wie Paket 4, 7, 10). Veröffentlicht sind
   `sampleAtlasFrame()` (0.23.0), `AnimatedFrames`, `TexturePackerJson`, `TileSet`: dafür eigene
   Einträge (`Fixed` bzw. `Changed`). Die neue Auswahl-Semantik von `TextureAtlas` greift nur nach
   `DynamicAtlas#remove()` und gehört deshalb in die `DynamicAtlas`-Zeile.

## Vorgehen

### Schritt 0 — Regeln für jede Zeile

- `AGENTS.md` im Repo-Root zuerst lesen, dazu »Konventionen« im Kopf von `./remediation-plan.md`.
- Jede neue Meldung beginnt mit ihrem Subjekt ohne Klammern (`AsepriteJson: …`, `TileSet: …`), wie
  `AGENTS.md` »Error and warning messages« es verlangt.
- Code, Kommentare, Doku, CHANGELOG auf Englisch; keine Finding-IDs; kein Rückblick auf den
  Vorzustand (kein »now«, »no longer«, »previously«, »as before«) — auch nicht im CHANGELOG.
- Kommentarzeilen höchstens 130 Zeichen (`lineWidth` von Biome, Kommentare bricht Biome nicht um),
  jede neue oder geänderte Prosazeile in `packages/twopoint5d/docs/**/*.md` höchstens 100 Zeichen.
- Bei jedem Korrektheitsfix zuerst den Test schreiben, rot laufen lassen (Kommando und Ausgabe in
  den Report), dann beheben.

### Schritt 1 — BUG-027: `options.playback` vor dem ersten Frame prüfen

1. Neu `packages/twopoint5d/src/texture/animationPlayback.ts` (nicht in `public-api.ts`):

   ```ts
   import type {AnimationPlayback} from './FrameBasedAnimations.js';

   // the playbacks FrameBasedAnimations#add() and AsepriteJson.parse() take; a module of its own,
   // because FrameBasedAnimations.ts is public through `export *`
   export const ANIMATION_PLAYBACKS: readonly AnimationPlayback[] = ['loop', 'once', 'pingpong'];

   export const isAnimationPlayback = (value: unknown): value is AnimationPlayback =>
     ANIMATION_PLAYBACKS.includes(value as AnimationPlayback);
   ```

2. `FrameBasedAnimations.ts`: die modullokale Konstante `PLAYBACKS` (`:104`) entfällt;
   `resolveTiming()` (`:165–166`) prüft mit `isAnimationPlayback(playback)`. Die Meldung bleibt
   wortgleich.
3. `AsepriteJson.ts`: ein modullokaler Helfer liest den Override nur aus eigenen Schlüsseln:

   ```ts
   // an own key only: `{}` would answer Object.prototype.constructor for a tag named "constructor"
   const playbackOf = (options: AsepriteParseOptions | undefined, tagName: string): unknown => {
     const playback = options?.playback;
     return playback != null && Object.hasOwn(playback, tagName) ? playback[tagName] : undefined;
   };
   ```

   In der ersten Tag-Schleife (`:231–261`), direkt nach `repeatOf(tag);` (`:252`):

   ```ts
   const override = playbackOf(options, tag.name);
   if (override !== undefined && !isAnimationPlayback(override)) {
     throw new Error(
       `AsepriteJson: parse() got a playback of ${describeValue(override)} for the tag "${tag.name}" — a playback is 'loop', 'once' or 'pingpong'`,
     );
   }
   ```

   Die erste Schleife legt jeden geprüften Override in einer `Map<string, AnimationPlayback>`
   (`overrides`, vor der Schleife angelegt) ab; die Planschleife (`:262–263`) ruft
   `framesOfTag(tag, overrides.get(tag.name))` — kein Cast, kein zweites Lesen von
   `options.playback`. Ein eigener Wert `undefined` zählt wie kein Override (so behandelt ihn
   `framesOfTag()` schon).
4. TSDoc von `parse()` (`:200–205`): in die Liste »Refused, with the tag named: …« »a playback that
   is none of `'loop'`, `'once'` and `'pingpong'`« aufnehmen; beim Satz zu `options.playback`
   (`:197–198`) ergänzen, dass er nur eigene Schlüssel liest — ein geerbter wie `constructor` nennt
   keinen Tag. Das TSDoc von `AsepriteParseOptions.playback` (`:110–114`) bekommt denselben Halbsatz.
5. Tests in `AsepriteJson.spec.ts`, `describe('refusals')`:
   - `test.each` über `'bounce'`, `null`, `1`:
     `refuses a playback of %s, naming the tag, and leaves the target atlas as it was` —
     `parse(sheet(2, {frameTags: [{name: 'walk', from: 0, to: 1, direction: 'forward'}]}),
     {target: target as never, playback: {walk: value as never}})` wirft
     `AsepriteJson: parse() got a playback of "bounce" for the tag "walk" — a playback is 'loop', 'once' or 'pingpong'`
     (für `null` `of null`, für `1` `of 1`, so wie `describeValue()` sie zeigt), und danach ist
     `target.size` `0`. Rot vor dem Fix: die Meldung von `FrameBasedAnimations`, `target.size` `2`.
   - In `describe('frame tags')`: `a tag named constructor takes the playback of its direction
     when options.playback names other tags` — Tag `constructor` (`forward`), `{playback: {}}` →
     `animation('constructor').playback` ist `'loop'`. Rot vor dem Fix (Wurf aus `add()`).
6. Doku: `docs/sprites.md`, Abschnitt »Aseprite sheets« (um `:349–352`; die Ablehnungsliste dort
   per `grep -n "efuse" docs/sprites.md` im Abschnitt finden) um die Ablehnung ergänzen;
   `docs/proposals/animation-playback-and-aseprite.md` §5.2 (`:287–290`, Bullet zu
   `options.playback`) um die Ablehnung eines Werts, der keines der drei Playbacks ist, und um »own
   keys«. Die Rückblicke »as today« im selben Proposal (Eintrag in »Offene Befunde«) bleiben
   unberührt.

### Schritt 2 — TYPE-003: `TexturePackerJson.parse()` generisch über den Frame-Datentyp

1. `TexturePackerJson.ts:55–59`:

   ```ts
   static parse<D extends TexturePackerFrameData = TexturePackerFrameData>(
     data: {frames: Record<string, D> | (D & {filename: string})[]; meta: TexturePackerMetaData},
     parentCoords?: TextureCoords,
     target?: TextureAtlas<D>,
   ): [atlas: TextureAtlas<D>, meta: TexturePackerMetaData]
   ```

   `target ??= new TextureAtlas<D>();`, `entries` als `[name: string, frameData: D][]`. TSDoc um
   einen Satz: `D` ist der Typ der Frame-Einträge; ein json, dessen Einträge mehr tragen als
   TexturePacker schreibt — Aseprites `duration` —, behält diesen Typ im Atlas, den `parse()`
   liefert, und ein `target` nimmt Frames dieses Typs.
   `TexturePackerJsonData` und `TexturePackerArrayFrameData` bleiben unverändert;
   `TextureAtlasLoader.ts:110` (`ReturnType<typeof TexturePackerJson.parse>`) löst auf den Default
   auf.
2. `AsepriteJson.ts:291–295`: beide Casts entfallen —
   `TexturePackerJson.parse({frames, meta: data.meta}, options?.parentCoords, options?.target ?? new TextureAtlas<AsepriteFrameData>())`.
3. `atlasAdapters.ts:29`: `AsepriteJson.parse(json as AsepriteJsonData, {parentCoords})` —
   `AsepriteJsonData` ist `TexturePackerJsonData` zuweisbar, der direkte Downcast compiliert ohne
   `unknown`. `:30`: `return {atlas, animations};` ohne Cast; `D` steht in `TextureAtlas` nur in
   kovarianten Positionen (Methodenparameter sind bivariant), also passt `TextureAtlas<AsepriteFrameData>`
   auf `AtlasAdapterResult.atlas`. Lehnt `pnpm typecheck` das ab, bleibt dort genau ein Cast mit
   einer Kommentarzeile, die den Grund nennt, und der Report sagt es.
4. Tests:
   - `TexturePackerJson.spec.ts`, neues `describe('the type of the frame data')`:
     `expectTypeOf(TexturePackerJson.parse(json)[0]).toEqualTypeOf<TextureAtlas<TexturePackerFrameData>>()`
     für ein `TexturePackerJsonData` der Spec; und für frames vom Typ
     `Record<string, TexturePackerFrameData & {duration: number}>` mit
     `target: new TextureAtlas<TexturePackerFrameData & {duration: number}>()`:
     `toEqualTypeOf<TextureAtlas<TexturePackerFrameData & {duration: number}>>()`, dazu zur Laufzeit
     `atlas.frame('a')!.data!.duration` gleich dem Wert im json. Rot vor dem Fix in
     `pnpm nx typecheck twopoint5d` (Rückgabe `TextureAtlas<TexturePackerFrameData>`).
   - `AsepriteJson.spec.ts`: `expectTypeOf(AsepriteJson.parse(sheet(1))[0]).toEqualTypeOf<TextureAtlas<AsepriteFrameData>>()`
     (pinnt das Ergebnis ohne Cast).
5. CHANGELOG `Changed`: »`TexturePackerJson.parse()` takes the type of the frame entries as a type
   parameter: the `target` it fills and the atlas it answers carry that type —
   `TextureAtlas<TexturePackerFrameData>` for a TexturePacker json, `TextureAtlas<AsepriteFrameData>`
   for the frames `AsepriteJson.parse()` hands it«.

### Schritt 3 — BUG-028: Spalte des Texel-Index ganzzahlig; gleiche Ursache in `PaletteSwap`

1. `sprites/node-utils.ts:74–82`:

   ```ts
   export const texCoordsFromIndex = (mapSize: Node<'vec2'>, ndx: Node<'int'>) => {
     // vec2 texCoordsFromIndex(in vec2 mapSize, in int ndx) {
     //   int width = int(mapSize[0]);
     //   int row = ndx / width;
     //   int column = ndx - row * width;
     const width = mapSize.x.toInt();
     const row = div(ndx, width).toInt();
     const column = sub(ndx, mul(row, width)).toInt();
     //   return (vec2(column, row) + 0.5) / vec2(mapSize[0], mapSize[1]);
     return div(add(vec2(column, row), float(0.5)), vec2(mapSize.x, mapSize.y));
   };
   ```

   Darüber ein Kommentar, warum int: ein Float-Modulo teilt in f32 durch die Breite, und WGSL wie
   GLSL ES runden diese Division nicht exakt; bei einer Breite, die keine Zweierpotenz ist, kippt der
   Quotient auf die nächste ganze Zahl, und die Spalte liest den Texel des Nachbarn. Der Import `mod`
   entfällt, wenn ungenutzt.
2. Tests in `sprites/node-utils.spec.ts`, `describe('texCoordsFromIndex()')` (der bestehende Test
   bleibt):
   - `works out the column in int from the row, without a float modulo` — in
     `nodesOf(texCoordsFromIndex(vec2(3000, 8), int(5999)))` steht kein `OperatorNode` mit `op`
     `'%'`. Rot vor dem Fix.
   - `test.each` `[ndx, column, row]` = `[2999, 2999, 0]`, `[3000, 0, 1]`, `[5999, 2999, 1]`,
     `[16_777_215, 1215, 5592]`: `answers the center of the texel of %i at a width of 3000` —
     `evaluateNode(texCoordsFromIndex(vec2(3000, 5593), int(ndx)))` ist
     `[(column + 0.5) / 3000, (row + 0.5) / 5593]` (`toBeCloseTo`). Auf der CPU (f64) auch vor dem
     Fix grün; pinnt die Arithmetik.
3. `texture/FrameTable.ts`, Begründung von `MAX_TEXELS` nach Entscheidung 5:
   - Kommentar `:29–30`: »A table holds at most 2^24 texels. The texel of an index is worked out in
     int (`texCoordsFromIndex()`), but the shader reads the frame index of a sprite and the frame
     count in the header as floats, and a float32 holds every whole number up to 2^24 exactly: under
     2^24 texels both stay exact« (auf ≤ 130 Zeichen je Zeile umbrechen).
   - TSDoc `:35–36`: »… up to 5 592 405 of them — 2^24 texels, which keeps the frame index the shader
     reads as a float exact.«
   - TSDoc `:100–102`: »a table of more than 2^24 texels — 5 592 405 frames —, and a table that needs
     more rows than the widest texture allowed.«
   - Meldung `:118`: `` `${WHERE}: ${entries.length} frames take ${texelCount} texels — a table holds at most ${MAX_TEXELS} (2^24) texels, which keeps the frame index the shader reads as a float exact; split them into several tables` ``
   - `FrameTable.spec.ts:144`: Titel `refuses a table of more than 2^24 texels`, `:149` die Meldung
     von oben (`5592406 frames take 16777219 texels — a table holds at most 16777216 (2^24) texels, …`).
4. Aufgenommen, `sprites/features/PaletteSwap.ts:104`:
   `const cycled = add(first, sub(shifted, mul(safeCount, div(add(shifted, 0.5), safeCount).floor())));`
   mit dem Kommentar: `shifted` ist ganz; ein halber Schritt mehr hält den Quotienten `0.5 / count`
   von jeder ganzen Zahl fern, sodass eine Division ein paar ULP daneben ein exaktes Vielfaches
   nicht eins zu tief floort (gilt für negative `shifted` ebenso: −3 → −1, −4 → −2 bei `count` 3).
   Kein neuer Test: auf der CPU (f64) ist die Division exakt, kein Test kann das rot zeigen — wie
   Paket 7 bei `viewOf()` —, und `PaletteSwap.spec.ts` rechnet den Zyklus nirgends mit
   `evaluateNode()` aus. Der Report nennt die Stelle als »ohne Regressionstest, CPU exakt«.
5. Doku: `docs/sprites.md:543–544` »the most the shader addresses exactly in float« → »a bound that
   keeps the frame index the shader reads as a float exact«;
   `docs/proposals/table-frames-and-palette-swap.md:114–118`: die Abbildung Index → Texel von
   `texCoordsFromIndex()` rechnet in int, die 2^24 Texel halten den Float-Frame-Index exakt;
   die Formel des Zyklus (`:290–291`) bekommt die Umsetzung `floor((shifted + 0.5) / count)` als
   Satz dazu.

### Schritt 4 — BUG-029: Float-Index halb aufwärts runden, auf jedem Backend

1. Neu `packages/twopoint5d/src/texture/roundHalfUp.ts` (intern, nicht in `public-api.ts`):

   ```ts
   import {add, floor} from 'three/tsl';
   import type {Node} from 'three/webgpu';

   /**
    * @internal `x` rounded to the nearest whole number, a half up: `floor(x + 0.5)`. TSL's `round()`
    * is WGSL's on WebGPU, which takes a half to the even neighbour, and GLSL's on WebGL 2, which leaves
    * the direction of a half to the driver — an index of 2.5 would pick frame 2 on one and 3 on the other.
    */
   export const roundHalfUp = (x: Node<'float'>): Node<'float'> => floor(add(x, 0.5));
   ```

   Lässt sich der Rückgabetyp nicht ohne Cast annotieren, ein einfaches `as Node<'float'>`, kein
   `as unknown as`.
2. Einsetzen:
   - `texture/sampleAtlasFrame.ts:106`: `clamp(roundHalfUp(typeof index === 'number' ? float(index) :
     index.toFloat()), 0, table.size - 1).toInt()`; Import `round` entfällt. TSDoc `:65`: »A float
     `index` is rounded to the nearest frame, a half up — 2.5 draws frame 3 on WebGPU and WebGL 2
     alike —, and every index is clamped …«.
   - `sprites/features/TableFrame.ts:106`: `const frameIndex = roundHalfUp(attribute<'float'>('frameIndex'));`
     (`round` bleibt für `viewOf()` `:55`). TSDoc `:11`: entry `` `floor(frameIndex + 0.5) · views + view` ``;
     `:19`: »Rounded to the nearest frame, a half up; …«.
   - `sprites/features/PaletteSwap.ts:107`: `clamp(roundHalfUp(attribute<'float'>('paletteRow')), …)`;
     Import `round` entfällt, wenn ungenutzt. TSDoc `:15`: »Rounded to the nearest row, a half up; …«.
3. Tests (rot vor dem Fix, wo nicht anders gesagt):
   - Neu `texture/roundHalfUp.spec.ts`: `evaluateNode(roundHalfUp(float(x)))` für `0.5 → 1`,
     `1.5 → 2`, `2.5 → 3`, `2.49 → 2`, `−0.5 → 0`, `3 → 3` (`evaluateNode()` aus
     `src/testing/spriteGraph.ts` kann `floor` und `+`).
   - `texture/sampleAtlasFrame.spec.ts`: `rounds a float index half up: 0.5, 1.5 and 2.5 read the
     frames 1, 2 and 3` — eine Tabelle mit mindestens vier Frames; in `nodesOf(color)` die
     Element-Knoten der Tabelle suchen (`isArrayElementNode`, `node === table.node`), je
     `evaluateNode(element.indexNode)`; das kleinste Ergebnis ist der Texel der Tex-Coords,
     `3 · frame`: 2.5 → 9 (vor dem Fix 6), 0.5 → 3 (vor dem Fix 0), 1.5 → 6.
   - `sprites/features/TableFrame.spec.ts`: `rounds frameIndex half up: 1.5 and 2.5 read the frames 2
     and 3` — die Frame-Stage von `TableFrame` (`TableFrame.frame!(…)`) mit einem Kontext aufrufen,
     gebaut nach `valuedContext()` in `sprites/features/fade-flash.spec.ts:23–30`:
     `{...stubShaderContext(), attribute: (name) => uniform(name === 'frameIndex' ? value : 0),
     sample: (_name, uv) => { uvs.push(uv); return vec4(16, 0, 0, 0); }, textureSize: () =>
     vec2(64, 1)}` (Casts auf `Node<T>` wie dort). Die Texel aller aufgezeichneten uvs,
     `evaluateNode(uv)[0] · 64 − 0.5`, sortiert: `[0, t, t + 1, t + 2]` mit `t = 1 + 3 · frame` —
     2.5 → `t = 10` (vor dem Fix 7), 1.5 → `t = 7`.
   - `sprites/features/PaletteSwap.spec.ts`: `rounds paletteRow half up: 1.5 and 2.5 draw the rows 2
     and 3` — `PaletteSwap.color!.transform(color, ctx)` wie `Fade.color!.transform()` in
     `fade-flash.spec.ts:57`, `ctx` nach demselben Muster: `attribute('paletteRow')` liefert
     `uniform(value)`, `sample` zeichnet die uv auf und liefert eine Konstante, `textureSize` ist
     `vec2(16, 8)`; die Uniforms `paletteCycle`/`paletteShift` liefert der Stub als `uniform(0)`,
     das `evaluateNode()` liest. Die uv des letzten `sample`-Aufrufs (der Ersatzfarbe) ergibt die
     Zeile `(r + 0.5) / 8`, `r = 3` für 2.5 (vor dem Fix 2), `r = 2` für 1.5.
   - Browsertest `packages/twopoint5d-testing/test/sprites-table-frame.test.js`: `a frameIndex of 2.5
     shows frame 3, one of 1.5 frame 2` neben `a frameIndex past the last frame shows …`, mit
     derselben Fixture; die Datei läuft unter WebGPU und WebGL 2. Vor dem Fix unter WebGPU rot
     (2.5 → Frame 2).
4. Doku:
   - `docs/sprites.md:550` »`frameIndex` is rounded to the nearest frame, a half up«; `:601`
     `floor(frameIndex + 0.5) · n + view`; im Abschnitt »Palette swap and colour cycling« der Satz
     zu `paletteRow` (`grep -n paletteRow docs/sprites.md`) mit »a half up«.
   - `docs/proposals/table-frames-and-palette-swap.md:159`, `:182`, `:195`, `:265`:
     `round(frameIndex)`/`round(paletteRow)` → `floor(frameIndex + 0.5)`/`floor(paletteRow + 0.5)`,
     wo Prosa die Rundung nennt, »a half up« dazu.
   - `docs/proposals/atlas-frame-sampling.md:164`: »A float index is rounded to the nearest frame, a
     half up, on WebGPU and WebGL 2 alike;«.
   - Lookbook `apps/lookbook/src/demos/atlas-frames-on-meshes/NightCity.ts:142` bleibt (der Kommentar
     sagt nur »rounded«, das stimmt weiter).

### Schritt 5 — BUG-030: losgelassene Frames aus Zufallsziehung und Komplettauswahl heraushalten

1. `texture/internals.ts`: neuer Schlüssel

   ```ts
   /**
    * The method of a `TextureAtlas` that answers the ids of its frames that {@link forgetFrameName} has
    * not let go of, ascending — its own array, not a copy. `selectAtlasFrames()` takes them for a
    * selection of every frame.
    */
   export const liveFrameIds: unique symbol = Symbol('TextureAtlas.liveFrameIds');
   ```

   Das TSDoc von `forgetFrameName` (`:62–67`) sagt dazu: das Frame bleibt unter seiner Id, verlässt
   aber die Zufallsziehungen des Atlas und eine Auswahl jedes Frames.
2. `texture/TextureAtlas.ts`:
   - Feld `#liveIds: number[] = []` mit Kommentar (die Ids der Frames, deren Name nicht losgelassen
     wurde, aufsteigend; eine Zufallsziehung nimmt ihren Index). `add()` hängt die neue Id in beiden
     Zweigen an, nach dem `push` in `#frames`.
   - `[forgetFrameName](name)`: die Id vor dem `delete` lesen, danach
     `this.#liveIds.splice(this.#liveIds.indexOf(id), 1)`. TSDoc `:70–74` wie in 1.
   - `[liveFrameIds](): readonly number[] { return this.#liveIds; }` mit `@internal`.
   - `randomFrameId()`: `return this.#liveIds[rand(this.#liveIds.length)] ?? this.#frames.length;`
   - TSDoc: `size` — »How many frame ids the atlas has handed out: `get()` answers a frame for every
     id below it, a frame `DynamicAtlas#remove()` let go of included.« `randomFrameId()` — »The id of
     a frame drawn at random among those the atlas has not let go of — `DynamicAtlas#remove()` lets go
     of one —, or `size`, an id without a frame, for an atlas without such a frame.« `randomFrame()`,
     `randomFrameIds()`, `randomFrames()` entsprechend (`undefined` für ein Atlas ohne solches Frame).
     `randomFrameName()` liest schon nur behaltene Namen; TSDoc unverändert.
3. `texture/selectAtlasFrames.ts:24–28` (Zweig ohne Auswahl):

   ```ts
   if (selection == null) {
     // a frame DynamicAtlas#remove() let go of keeps its id and takes no index: its cell is cleared
     const ids = atlas[liveFrameIds]();
     const indexOfId = new Map<number, number>();
     const frames = ids.map((id, index) => {
       indexOfId.set(id, index);
       return atlas.get(id)!;
     });
     for (const name of atlas.frameNames()) indices.set(name, indexOfId.get(atlas.frameId(name)!)!);
     return {frames, indices};
   }
   ```

   TSDoc `:10–17`: »… or without one every frame the atlas has not let go of, in the order of their
   ids — the index of a frame its frame id, unless `DynamicAtlas#remove()` let go of a frame before
   it.« Ebenso `FrameTable.fromAtlas()` (`FrameTable.ts:46–48`), `frameTable()` (`:148–151`),
   `AtlasFrameTable` (Klassen-TSDoc `:14`, `fromAtlas()` `:45–46`).
4. `texture/DynamicAtlas.ts`:
   - `#pack()` `:434`: `const count = this.#cells.size;`
   - TSDoc von `remove()` (`:317–322`) ergänzen: das Frame behält seine Id — `atlas.get(id)` antwortet
     es weiter —, verlässt aber die Zufallsziehungen des Atlas (`randomFrame()` und Geschwister) und
     eine Tabelle jedes Frames (`frameTable(atlas)`, `atlasFrameTable(atlas)`), und die Meldung eines
     vollen Atlas zählt nur die Frames, die er hält.
5. Tests (rot vor dem Fix):
   - `TextureAtlas.spec.ts`, `describe('forgetFrameName (internal)')`: `a frame let go of leaves the
     random draws` — Atlas mit `a`, `b`; `a` vergessen; `NO_LONGER_BE_A_COINCIDENCE`-mal
     `randomFrameId()` ist `1` und `randomFrame()` ist `atlas.get(1)`; `[liveFrameIds]()` ist `[1]`.
     Dann `b` vergessen: `randomFrameId()` ist `2` (`size`), `randomFrame()` `undefined`,
     `randomFrames(2)` `[undefined, undefined]`, `[liveFrameIds]()` `[]`.
   - `FrameTable.spec.ts` und `AtlasFrameTable.spec.ts`: `a table of every frame leaves out a frame
     the atlas let go of, and indexOf() finds the others by name` — Atlas `a`, `b`, `c`; `b`
     vergessen (`atlas[forgetFrameName]('b')`): `size` 2, `indexOf('a')` 0, `indexOf('c')` 1,
     `indexOf('b')` −1.
   - `DynamicAtlas.spec.ts`, `describe('remove()')`: `a removed frame leaves the random draws and a
     table of every frame` (über `atlas.atlas.randomFrame()` und `frameTable(atlas.atlas).size`);
     `the message of a full atlas counts the frames it holds` — nach dem Muster des Tests bei `:230`:
     zwei Frames, eines entfernen, dann eines, das nicht mehr passt → die Meldung sagt `beside the 1
     frame packed into it` (vor dem Fix `the 2 frames`).
6. Doku: `docs/sprites.md:476–478` (der Satz zu `remove(name)`) und `:2590` (»`atlasFrameTable(atlas)`
   takes every frame, the index of a frame its frame id«) sowie die `FrameTable`-Zeile `:541`
   (»every frame by id«) um die Ausnahme der entfernten Frames ergänzen;
   `docs/proposals/dynamic-atlas-and-bitmap-text.md` §3.6, der `remove()`-Punkt, um denselben Satz.
   Paket 12 ändert dasselbe Proposal in §3.2.

### Schritt 6 — API-011: ein `tileCount`, der nicht passt, wird abgelehnt

1. `texture/TileSet.ts`, `#createTextureCoords` (`:199–278`): die Schleife legt nur noch die
   Positionen fest (z. B. ein `number[]` mit `x, y`-Paaren) und ruft `this.atlas.add()` nicht. Nach
   der Schleife, mit `laid` der Zahl der Positionen:

   ```ts
   assertFits(
     this.options.tileCount === undefined || laid === tileCountLimit,
     () =>
       `the tileCount of ${tileCountLimit} does not fit into the baseCoords: ${laid === 1 ? '1 tile' : `${laid} tiles`} of ${this.tileWidth} × ${this.tileHeight} fit into ${baseWidth} × ${baseHeight} with margin ${margin}, padding ${padding} and spacing ${spacing}`,
   );
   ```

   (`assertFits()` setzt `TileSet: ` davor.) Erst danach je Position
   `this.atlas.add(new TextureCoords(this.baseCoords, x + padding, y + padding, this.tileWidth,
   this.tileHeight))`, `#firstFrameId` aus der ersten Id, `#tileCount = laid`. Ein abgelehnter
   `tileCount` lässt den übergebenen Atlas, wie er war.
2. TSDoc: `TileSetOptions.tileCount` (`:46`) »How many tiles the set holds — a whole number of 1 or
   more, no more than fit into the image. Defaults to as many tiles as fit into the image.«; Getter
   `tileCount` (`:89–92`) »the option `tileCount` — the constructor refuses one that does not fit
   into the `baseCoords` —, or as many as fit …«; `@throws` des Konstruktors (`:105–110`) »… or if
   the tiles of a `tileCount` do not all fit into the `baseCoords`; the atlas handed in is then left
   as it was.«
3. Tests in `TileSet.spec.ts`, `describe('degenerate options')`:
   - `a tileCount that does not fit is refused, naming how many tiles fit, and the atlas handed in
     stays empty` — `new TileSet(atlas, new TextureCoords(0, 0, 64, 64), {tileWidth: 16,
     tileHeight: 16, tileCount: 17})` wirft `RangeError` mit
     `TileSet: the tileCount of 17 does not fit into the baseCoords: 16 tiles of 16 × 16 fit into 64 × 64 with margin 0, padding 0 and spacing 0`;
     `atlas.size` ist `0`. Rot vor dem Fix (`tileCount` 16, kein Wurf).
   - `a tileCount that fits exactly is laid in full` — dasselbe mit `tileCount: 16` → `tileCount` 16,
     `atlas.size` 16.
   Die bestehenden Tests (z. B. `tiles with margin + padding`: 8 passen, 6 verlangt) bleiben grün.
   Ein `TextureResource` meldet den Wurf über den bestehenden Pfad als `error` mit
   `source: 'texture'`; kein neuer Test dafür nötig.
4. Aufrufer: Lookbook und Browsertests setzen keinen `tileCount` als Option (geprüft per `grep -rn
   tileCount apps packages/twopoint5d-testing packages/twopoint5d/docs`); `docs/map2d.md` zeigt
   `TileSet` nur als Typ in einem `ts check`-Block — keine Oberflächenänderung, der Block bleibt.

### Schritt 7 — CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, Skill `updating-changelog`)

- `Added`-Zeilen unter `[Unreleased]` fortschreiben (unveröffentlicht, kein Migration Guide):
  `:21` `AsepriteJson.parse()` — Ablehnung eines Playbacks, das keines der drei ist, vor dem ersten
  Frame; `options.playback` liest eigene Schlüssel. `:35` `DynamicAtlas` — `remove()`: das Frame
  behält seine Id, verlässt Zufallsziehungen und Tabellen jedes Frames, die Voll-Meldung zählt die
  gehaltenen Frames. `:39` `FrameTable` — Begründung der 2^24 Texel wie Schritt 3.3. `:40`
  `tableFrame()` — `round(frameIndex) · n + view` → `floor(frameIndex + 0.5) · n + view`, eine Hälfte
  rundet auf beiden Backends auf (die `round(…)`-Formel des View-Winkels bleibt). `:42`
  `paletteSwap()` — `paletteRow` halb aufwärts gerundet.
- `Changed`: `TexturePackerJson.parse()` generisch (Schritt 2.5). Breaking: `new TileSet()` wirft
  `RangeError` für einen `tileCount`, der mit `margin`, `padding` und `spacing` nicht in die
  `baseCoords` passt, nennt, wie viele passen, und lässt den übergebenen Atlas unverändert; ein
  `TextureResource` meldet es als `error` mit `source: 'texture'`; »See the Migration Guide«.
- `Fixed`: `sampleAtlasFrame()` rundet einen Float-Index halb aufwärts, `floor(index + 0.5)`, auf
  WebGPU und WebGL 2 gleich — 2.5 zeichnet Frame 3. `AnimatedFrames` (und `tableFrame()`) finden den
  Texel eines Index ganzzahlig, sodass eine Data-Texture einer Breite, die keine Zweierpotenz ist —
  ein `maxTextureSize` wie 3000 beim Bake —, jeden Texel an seiner Stelle liest.
- `Migration Guide`: neuer Abschnitt `#### A TileSet whose tileCount does not fit` nach dem Muster
  der Nachbarn: was jetzt wirft, und die Abhilfe — den `tileCount` auf die Zahl aus der Meldung
  senken oder weglassen, oder `margin`/`padding`/`spacing` prüfen. Ein Codeblock darin ist `ts check`
  und eigenständig (Imports, Deklarationen), wie es `AGENTS.md` »Code blocks in Markdown« verlangt.

### Schritt 8 — Verify

`pnpm run ci` aus dem Repo-Root; grün, einschließlich `test:browser` (der neue Browsertest unter
WebGPU und WebGL 2) und `typecheck` (Typtests aus Schritt 2, `ts check`-Blöcke der Doku).

## Triage dieses Zug 0

- `Folgen:` der erledigten Pakete 1–10: alle »keine« — nichts zu verteilen.
- »Offene Befunde«: kein Eintrag teilt eine Ursache mit diesem Paket. Nah dran, aber nicht dieselbe
  Ursache: `docs/proposals/animation-playback-and-aseprite.md` »as today« (Rückblick-Konvention),
  Prosa über 100 Zeichen in `docs/sprites.md` (Doku-Breite) — beide bleiben in der Queue; dieses Paket
  hält nur seine eigenen neuen und geänderten Zeilen unter 100 Zeichen.
- Die aufgenommenen Stellen (Abschnitt »Aufgenommen«) sind vorbestehend und teilen die Ursache je
  eines Findings; `PaletteSwap.ts:104` stand so in `6500527f`.

## Findings im Volltext

**BUG-027 · low · packages/twopoint5d/src/texture/AsepriteJson.ts:141** (auch `:263`, `:299`) —
`options.playback` in `AsepriteJson.parse()` vor dem ersten Frame validieren
`parse()` verspricht, dass ein verworfenes Sheet `options.target` unverändert lässt, und prüft dafür
alles vor `TexturePackerJson.parse()`. Der Wert eines `options.playback`-Eintrags wird aber nicht
geprüft: `framesOfTag()` reicht ihn ungeprüft in den Plan, erst `FrameBasedAnimations#add()` (nach
dem Schreiben der Frames) wirft für einen Wert wie `'bounce'` oder `null`. Ein JS- oder JSON-Aufrufer
bekommt so eine Exception und ein halb befülltes Ziel-Atlas, dessen Frame-Namen beim nächsten Versuch
als »already taken« abgewiesen werden.
Beleg: `if (playbackOverride !== undefined) return {indices: pass, playback: playbackOverride};` —
ungeprüft; Prüfung erst in `resolveTiming()` von `add()`.
Empfehlung: Im Prüfblock vor Zeile 291 jeden Wert von `options.playback` gegen
`'loop' | 'once' | 'pingpong'` prüfen und mit Tag-Namen ablehnen; Spec-Fall mit `target` ergänzen,
der nach dem Fehler `target.size` unverändert erwartet.

**BUG-028 · low · packages/twopoint5d/src/texture/FrameTable.ts:121** (auch `FrameTable.ts:31`,
`src/sprites/node-utils.ts:77`) — Spaltenindex der Data-Texture ganzzahlig statt per Float-`mod`
berechnen
Die 2^24-Grenze der `FrameTable` setzt voraus, dass `floor(i / width)` in float32 korrekt gerundet
ist. `texCoordsFromIndex()` rechnet die Spalte aber als `mod(float(ndx), float(width))`, also über
eine GPU-Float-Division, die in WGSL und GLSL ES nur mit 2,5 ULP Genauigkeit spezifiziert ist (bzw.
als `x * (1/y)` umgesetzt wird); die Zeile dagegen ganzzahlig. Bei einer Breite, die keine
Zweierpotenz ist — `width = Math.min(texelCount, maxTextureSize)` mit einem vom Aufrufer gesetzten
`maxTextureSize` wie 3000 — kann der Quotient bei Indizes deutlich unter 2^24 auf die nächste ganze
Zahl kippen; die Spalte wird dann −1 bzw. width, und der Shader liest den Texel eines Nachbarn. Bei
Zweierpotenz-Breiten (alle realen Gerätelimits) ist die Rechnung exakt.
Beleg: `const column = mod(ndx.toInt().toFloat(), mapSize.x.toFloat()).toInt(); const row = div(ndx, mapSize.x.toInt()).toInt();`
Empfehlung: Spalte ganzzahlig ableiten: `column = ndx - row * width` (int), dann ist nur noch die
Normierung `(column + 0.5) / width` in float. Alternativ beim Bake die Zeilenbreite auf eine
Zweierpotenz ≤ `maxTextureSize` abrunden. Kommentar an `MAX_TEXELS` entsprechend präzisieren.

**BUG-029 · low · packages/twopoint5d/src/texture/sampleAtlasFrame.ts:106** — Float-Frame-Index
backendunabhängig runden
`sampleAtlasFrame()` rundet einen Float-Index mit TSL `round()`. WGSL `round()` rundet bei .5 auf die
gerade Zahl (1,5 → 2, 2,5 → 2), GLSL ES 3.0 lässt die Richtung bei .5 offen. Ein Index genau auf .5 —
etwa eine bewusst gesetzte Zwischenposition oder `time * fps` an Halbschritten — zeigt deshalb je
nach Backend (WebGPU vs. WebGL2-Fallback) einen anderen Frame, und auf WebGPU springt eine Folge
0,5/1,5/2,5 nicht gleichmäßig. Das TSDoc sagt nur »A float index is rounded«.
Beleg: `clamp(round(typeof index === 'number' ? float(index) : index.toFloat()), 0, table.size - 1).toInt()`
Empfehlung: `floor(index + 0.5)` statt `round()` verwenden (eindeutig »half up« auf beiden Backends)
oder die Regel im TSDoc festhalten; dasselbe Muster sitzt im `tableFrame()`-Feature der Sprites.

**TYPE-003 · low · packages/twopoint5d/src/texture/AsepriteJson.ts:294** (auch
`atlasAdapters.ts:29`, `:30`) — `TexturePackerJson.parse()` generisch über den Frame-Datentyp machen
`TexturePackerJson.parse()` kennt nur `TextureAtlas<TexturePackerFrameData>`. `AsepriteJson.parse()`
muss Ziel und Ergebnis deshalb doppelt casten (`as unknown as TextureAtlas`,
`as unknown as [TextureAtlas<AsepriteFrameData>]`), und `asepriteAtlasAdapter` castet Eingabe und
Ausgabe noch einmal. Die Casts schalten die Prüfung genau dort ab, wo Frame-Daten zweier Formate
ineinander übergehen; ein späterer Feldwechsel in `AsepriteFrameData` fällt dem Compiler nicht auf.
Beleg: `(options?.target ?? new TextureAtlas<AsepriteFrameData>()) as unknown as TextureAtlas, ) as unknown as [TextureAtlas<AsepriteFrameData>];`
Empfehlung: `parse<D extends TexturePackerFrameData>(data: {frames: Record<string, D> | (D & {filename: string})[]; meta: TexturePackerMetaData}, parentCoords?, target?: TextureAtlas<D>): [TextureAtlas<D>, …]`
— dann entfallen die Casts in `AsepriteJson`; der Adapter braucht höchstens noch einen Cast an seiner
Eingabe.

**BUG-030 · low · packages/twopoint5d/src/texture/TextureAtlas.ts:72** (auch `TextureAtlas.ts:113`,
`selectAtlasFrames.ts:25`, `DynamicAtlas.ts:421`) — Vergessene Frames aus `randomFrame()` und der
Komplettauswahl heraushalten
`DynamicAtlas#remove()` löscht die Zelle und vergisst nur den Namen; der Frame bleibt in `#frames`
(dokumentiert: `atlas.get(id)` antwortet weiter). Unerwähnt bleibt die Folge für alle anderen Leser
von `#frames`: `randomFrame()`/`randomFrameId()` ziehen auch die gelöschten, leeren Zellen, `size`
zählt sie, `FrameTable.fromAtlas(atlas)` und `AtlasFrameTable.fromAtlas(atlas)` ohne Auswahl nehmen
sie als leere Frames auf, und die »atlas is full«-Meldung von `#pack()` nennt sie als belegte Frames.
Wer nach `remove()` zufällige Frames zieht, bekommt unsichtbare Sprites.
Beleg: `[forgetFrameName](name) { if (!this.#frameNames.delete(name)) return false; this.#frameNameList.splice(...); return true; }`
— `#frames` bleibt unverändert; `randomFrameId(): rand(this.#frames.length)`.
Empfehlung: Vergessene Ids in einem Set führen und `randomFrame*()` sowie
`selectAtlasFrames(atlas, undefined)` daran vorbeiführen — oder das Verhalten im TSDoc von
`remove()` und `TextureAtlas#randomFrame()` ausdrücklich nennen. Die Zahl in der Voll-Meldung aus
`#cells.size` statt `atlas.size` nehmen.

**API-011 · low · packages/twopoint5d/src/texture/TileSet.ts:89** (auch `:271`) —
`TileSet#tileCount`-Doku und Kürzung bei zu großem `tileCount` angleichen
Das TSDoc sagt, `tileCount` sei »the option `tileCount`, or as many as fit … when none is given«.
Ist die Option größer als das, was ins Bild passt, bricht die Layout-Schleife beim Zeilenende still
ab, und `tileCount` ist kleiner als die Option. Ein Catalog-Eintrag mit falschem `tileCount` oder
falschem `margin` liefert so stumm weniger Tiles; `frame(tileId)` wickelt höhere Ids per Modulo auf
die vorhandenen um, das Sprite zeigt die falsche Kachel statt eines Fehlers.
Beleg: `if (y + tileOuterHeight + margin > baseHeight) { break; }` — keine Prüfung gegen
`tileCountLimit`.
Empfehlung: Entweder mit `RangeError` ablehnen, wenn eine explizite Option `tileCount` nicht erreicht
wird (passt zum restlichen Fail-fast-Stil des Konstruktors), oder das TSDoc um »höchstens« ergänzen.

## Urteil des Reviewers

Review 0 (`paket-11.review-0.json`), bestätigt durch Review 1 nach Runde 1:

- BUG-027 behoben — `src/texture/AsepriteJson.ts:265` prüft jeden Override vor `TexturePackerJson.parse()` (`:309`),
  die Planschleife liest die geprüfte Map (`:281`); Spec `AsepriteJson.spec.ts:291` (`target.size` 0).
- BUG-028 behoben — `src/sprites/node-utils.ts:84` Spalte als `ndx − row · width` in int; Begründung
  `MAX_TEXELS` in `texture/FrameTable.ts:29–32`; Specs `node-utils.spec.ts:181` ff.
- BUG-029 behoben — `texture/sampleAtlasFrame.ts:108` über `roundHalfUp()`, TSDoc `:66`; Specs
  `sampleAtlasFrame.spec.ts:121`, `roundHalfUp.spec.ts`.
- TYPE-003 behoben — `texture/TexturePackerJson.ts:59` generisch über `D`; Casts in `AsepriteJson.ts:309` entfallen,
  `atlasAdapters.ts:29` nur `as AsepriteJsonData`, Rückgabe ohne Cast; Typtests in beiden Specs.
- BUG-030 behoben — `texture/TextureAtlas.ts:138` zieht aus `#liveIds`, `selectAtlasFrames.ts:29` nur behaltene
  Frames, `DynamicAtlas.ts:436` zählt `#cells.size`; Specs `TextureAtlas.spec.ts:414`, `DynamicAtlas.spec.ts:630`/`:642`,
  `FrameTable.spec.ts`, `AtlasFrameTable.spec.ts`.
- API-011 behoben — `texture/TileSet.ts:280` `assertFits(...)` vor dem ersten Frame; Specs `TileSet.spec.ts:150`/`:161`;
  CHANGELOG `Changed` BREAKING mit Migration Guide.
- Aufgenommen zu BUG-027 (eigene Schlüssel) behoben — `AsepriteJson.ts:135` `Object.hasOwn`; Spec `AsepriteJson.spec.ts:196`.
- Aufgenommen zu BUG-028 (Farbzyklus) behoben — `sprites/features/PaletteSwap.ts:110` `floor((shifted + 0.5) / count)`,
  ohne Regressionstest (CPU exakt).
- Aufgenommen zu BUG-029 (`paletteRow`, `frameIndex`) behoben — `PaletteSwap.ts:113`, `TableFrame.ts:107`; Specs
  `PaletteSwap.spec.ts:159`, `TableFrame.spec.ts:136`, Browsertest `sprites-table-frame.test.js`.

Befunde: 1 wichtig (`docs/sprites.md:2628` ohne »a half up«) und 3 klein (Umbruch `atlas-frame-sampling.md:164–167`,
Import-Reihenfolge `TableFrame.ts`, feste 23 in `DynamicAtlas.spec.ts`) — alle in Runde 1 erledigt (Review 1).

## Nebenbefunde, Urteil

Beide vorbestehend (geprüft mit `git show 72127b52:…`), Scope-Regel »alles« greift → Scope, ohne gemeinsame Ursache
mit diesem Paket, daher in »Offene Befunde«: `sampleAtlasFrame.ts:105` (roher Wert in der `inset`-Meldung),
`TexturePackerJson.ts:69` (Array-Eintrag ohne `filename`).
