# Paket 13 — Texture-Animationen, TileSet und die öffentliche API

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-002 (medium), BUG-026 (low), API-006 (low), API-009 (low), CONS-004 (low),
  READ-006 (low), API-001 (low), API-007 (low), DX-001 (low)
- Ziel: TileSet und FrameBasedAnimations lehnen widersprüchliche oder überdimensionierte Eingaben
  ab, und die öffentliche Oberfläche ist benannt exportiert, vollständig dokumentiert und in der
  README verlinkt.
- Modell: stärkste Stufe
- Effort: high
- Dateien (alle Pfade unter `packages/twopoint5d/`, wo nicht anders angegeben):
  - `src/texture/TileSet.ts`, `src/texture/TileSet.spec.ts`
  - `src/texture/FrameBasedAnimations.ts`, `src/texture/FrameBasedAnimations.spec.ts`
  - `src/texture/FrameTable.ts`, `src/texture/AtlasFrameTable.ts`, neu `src/texture/frameTexels.ts`
    samt `src/texture/frameTexels.spec.ts`
  - `src/texture/TextureAtlas.ts`, neu `src/utils/randomInt.ts` samt `src/utils/randomInt.spec.ts`
  - `src/texture/TextureResource.ts`, `src/texture/TextureStore.ts`, `src/texture/internals.ts`,
    `src/texture/TextureResource.spec.ts`, `src/texture/TextureStore.spec.ts`
  - `src/texture/TextureCoords.ts`, `src/texture/DynamicAtlas.ts`, `src/display/styleUtils.ts`,
    `src/sprites/node-utils.ts`, `src/utils/unpick.ts`, `src/utils/findRootNode.ts`,
    `src/utils/Dependencies.ts` (nur TSDoc bzw. Kommentar)
  - `src/texture/public-api.ts`, `src/map2d/public-api.ts`, `src/map2d/chunk-quad-tree/public-api.ts`,
    `src/sprites/public-api.ts`, `src/map2d/chunk-quad-tree/base64toUint32Arr.ts` (nur TSDoc)
  - `docs/architecture.md` (§1), `docs/proposals/animation-playback-and-aseprite.md` (§3.2),
    `CHANGELOG.md`
  - Repo-Root: `README.md` (»📖 Documentation«, »Getting involved«)
- Vorgehen: siehe Abschnitt »Vorgehen« unten — die Schritte sind nummeriert und in dieser
  Reihenfolge auszuführen; Schritt 0 vor jeder Änderung.
- Verify: `pnpm run ci`, dazu die Exportprobe aus Schritt 0/9 (Vergleich zweier Listen, Erwartung
  dort)
- Commit: `fix(twopoint5d)!: work out how many tiles a TileSet holds instead of laying them out one by one and refuse a set of more than TileSet.MaxTiles, refuse animation timing that gives more than one of duration, frameRate and durations, make FrameBasedAnimations.MaxTextureSize read-only, type the error events of TextureResource and TextureStore, write the texels of a frame in one place for both frame tables and the animsMap, draw random ids through one helper, name the exports of texture, map2d and sprites one by one and deprecate MapTuple, MapSubTypes and base64toUint32Arr, document the members of TextureAtlas, TextureCoords and DynamicAtlas and the helpers the library exports, and point the documentation section of the README to the guides`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · PERF-002 unverändert (`TileSet.ts:258`) · BUG-026
    unverändert (`FrameBasedAnimations.ts:180`) · API-006 unverändert (`FrameBasedAnimations.ts:316`;
    Spec `FrameBasedAnimations.spec.ts:771` schreibt den Wert) · API-009 unverändert
    (`internals.ts:28`; Inline-Typ jetzt `TextureStore.ts:336`) · CONS-004 unverändert
    (`TextureAtlas.ts:26`, `TileSet.ts:31`) · READ-006 umgeformt (`selectAtlasFrames()` teilt die
    Auswahl schon; die Texel-Belegung steht weiter dreifach: `FrameTable.ts:136–142`,
    `AtlasFrameTable.ts:105–113`, `FrameBasedAnimations.ts:289–298`) · API-001 unverändert (vier
    `public-api.ts` mit `export *`; gebautes Paket 473 Namen, 197 mit Laufzeitwert) · API-007
    unverändert (alle elf Fundstellen ohne TSDoc; `Dependencies#clear()` jetzt Z. 211) · DX-001
    unverändert (`README.md:161–180`) · keine offenen Folgen im Plan · aus »Offene Befunde« nichts
    übernommen; Eintrag `FrameLoop.ts:185` um `FixedFrameLoop.ts:96–97` ergänzt
  - 2026-10-24 Zug 1: Implementierer beauftragt (opus, effort high), Brief `paket-13.impl-0.brief.txt`, Report nach `paket-13.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG (rote Läufe: TileSet 3, FrameBasedAnimations/TextureResource 5, Typfälle TS2578/TS2724) · 28 Dateien geändert, neu `src/texture/frameTexels.ts`, `frameTexels.spec.ts`, `src/utils/randomInt.ts`, `randomInt.spec.ts` · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-13.verify.log`) · Exportprobe 473 → 475, genau der erwartete Unterschied (`paket-13.exports-probe.diff`)
  - 2026-10-24 Zug 3: Reviewer beauftragt (opus, effort high), Diff `paket-13.diff` (3039 Zeilen), Report nach `paket-13.review-0.json`
  - 2026-10-24 Zug 3: Urteil freigegeben — alle neun Findings und die drei Folgen aus Zug 0 behoben, drei kleine Befunde (`TileSet.ts`), kein kritischer, kein wichtiger · Report `paket-13.review-0.report.md`
  - 2026-10-24 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-10-24 Zug 5: committet 94744819 (32 Dateien, Trailer `Remediation-Run: 2026-10-23`), Verify `paket-13.verify.log` exit=0 auf dem committeten Stand · drei Nebenbefunde nach »Offene Befunde«

## Vorgehen

Gilt für jede Zeile: Abschnitt »Konventionen« im Kopf von `./remediation-plan.md` (keine
Finding-IDs, kein Rückblick auf den Vorzustand, englische Texte im Code und in der Doku),
`AGENTS.md` (Fehlermeldungen mit Subjekt, `describeValue()` für abgewiesene Werte, private Member
nur mit `#`, Importe mit `.js`, `import type`). Für den CHANGELOG den Skill `updating-changelog`
laden, für Guide und Proposal den Skill `project-harness-dev-docs`.

### 0. Grundlinie der Exporte festhalten — vor jeder Änderung

```bash
pnpm build:twopoint5d
node /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-13.list-exports.mjs \
  > /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-13.exports-before.tsv
```

Das Skript (liegt dort schon, nicht ins Repo kopieren) listet jeden Namen, den
`packages/twopoint5d/dist/lib/index.d.ts` exportiert, als `<name>\t<value|type|value+type>\t<deprecated?>`.
Erwartet: 473 Zeilen. Schritt 9 wiederholt es nach dem Umbau.

### 1. PERF-002 — TileSet rechnet seine Tiles aus und hat eine Obergrenze

In `src/texture/TileSet.ts`:

1. Neue Konstante der Klasse, direkt unter `export class TileSet<…> {`:

   ```ts
   /**
    * The most tiles a tile set holds: 2^20 — every tile of 8 × 8 texels or more on an image of
    * 8192 × 8192, the largest 2D texture every WebGPU device takes. `new TileSet()` refuses a set
    * of more, and a `tileCount` above it, before it lays a tile.
    */
   static readonly MaxTiles: number = 1_048_576;
   ```

   Grund für den Wert (gemessen am gebauten `dist`, Zug 0): 2^20 Tiles kosten 73 ms und 130 MB
   Heap, 67 Mio. (1 × 1 auf 8192²) wären gut 8 GB. `FrameBasedAnimations.MaxTextureSize ** 2` aus
   der Empfehlung wäre genau diese 67 Mio. und schützte nicht.

2. `tileCount` wird gegen die Grenze geprüft: im `assertOption` für `tileCount` (heute Z. 226–231)
   die Bedingung zu `tileCountLimit === Infinity || (Number.isInteger(tileCountLimit) && tileCountLimit >= 1 && tileCountLimit <= TileSet.MaxTiles)`
   und die Regel zu `` `a whole number from 1 to ${TileSet.MaxTiles}` `` — Meldung dann
   `TileSet: tileCount must be a whole number from 1 to 1048576, got 2000000`.

3. Die Schleife Z. 251–278 und das Array `positions` entfallen. Stattdessen rechnet eine private
   statische Hilfe die Zahl der Zellen je Achse aus:

   ```ts
   // How many cells of `outer` with `spacing` between them fit along `extent` with `margin` at both
   // ends; the caller has made sure the first one fits. The quotient is rounded once and can land one
   // off where the cells meet the bound exactly, so the count is held to the test the layout places a
   // cell by. A count past 2^53 is far over MaxTiles, and so is Infinity, which a tile of a denormal
   // width yields: neither is corrected, and the caller refuses both. The first cell is there in any
   // case, whatever the rounding of the quotient says.
   static #cellsAlong(extent: number, margin: number, outer: number, spacing: number): number {
     const step = outer + spacing;
     let count = Math.floor((extent - 2 * margin - outer) / step) + 1;
     if (Number.isSafeInteger(count)) {
       if (margin + count * step + outer + margin <= extent) count += 1;
       else if (count > 1 && margin + (count - 1) * step + outer + margin > extent) count -= 1;
     }
     return Math.max(count, 1);
   }
   ```

   Bei `columns` gleich `Infinity` (nur mit einer Option `tileCount` erreichbar, sonst abgewiesen)
   liegen alle Tiles in der ersten Zeile: `i % Infinity` ist `i`, `Math.floor(i / Infinity)` ist 0.

   In `#createTextureCoords`, nach den beiden `assertFits` für den ersten Tile (Z. 240–249):

   ```ts
   const columns = TileSet.#cellsAlong(baseWidth, margin, tileOuterWidth, spacing);
   const rows = TileSet.#cellsAlong(baseHeight, margin, tileOuterHeight, spacing);
   const fitting = columns * rows;
   ```

   Dann in dieser Reihenfolge:
   - Ohne Option `tileCount` und `fitting > TileSet.MaxTiles` (auch `Infinity`): `RangeError` über
     `assertFits` mit
     `` `${fitting} tiles of ${this.tileWidth} × ${this.tileHeight} fit into ${baseWidth} × ${baseHeight} with margin ${margin}, padding ${padding} and spacing ${spacing} — a tile set holds at most ${TileSet.MaxTiles}; give a tileCount, or larger tiles` ``
     (mit Präfix `TileSet: ` aus `assertFits`).
   - Mit Option `tileCount` und `tileCount > fitting`: die bestehende Meldung Z. 280–284
     unverändert, mit `fitting` an der Stelle des bisherigen Schleifenzählers
     (`${fitting === 1 ? '1 tile' : `${fitting} tiles`} of …`).
   - `const tileCount = this.options.tileCount ?? fitting;` — jetzt höchstens `MaxTiles`.
   - Die Tiles in Zeilen von links oben, Tile `i` bei
     `x = margin + (i % columns) * (tileOuterWidth + spacing)`,
     `y = margin + Math.floor(i / columns) * (tileOuterHeight + spacing)`, je
     `new TextureCoords(this.baseCoords, x + padding, y + padding, this.tileWidth, this.tileHeight)`
     über `this.atlas.add(coords)`; `#firstFrameId` beim ersten, `#tileCount = tileCount` danach.
     Keine Änderung am Atlas, bevor alle Prüfungen durch sind.
   - Den Kommentar Z. 210–213 um den Satz ergänzen, dass auch die Zahl der Tiles vor dem ersten
     begrenzt wird (ein winziges `tileWidth` aus dem Katalog füllte sonst den Speicher).
   - Kommentar Z. 238–239 und Z. 254–255 an die Rechnung anpassen (der erste Tile ist geprüft, die
     übrigen zählt `#cellsAlong`; der Atlas bekommt erst Tiles, wenn ihre Zahl feststeht).

4. TSDoc nachziehen: `TileSetOptions.tileCount` (Z. 46–50) — »a whole number from 1 to
   {@link TileSet.MaxTiles}, no more than fit into the image. Defaults to as many tiles as fit into
   the image, which may be no more than `MaxTiles`.« · `@throws` des Konstruktors (Z. 109–116) um
   »a `tileCount` above {@link TileSet.MaxTiles}, more than `MaxTiles` tiles that fit without a
   `tileCount`« ergänzen.

5. Specs in `src/texture/TileSet.spec.ts`, Block `describe('degenerate options')` oder ein neuer
   `describe('TileSet.MaxTiles')`:
   - **Regressionstest, vor dem Fix rot sehen:** `refuses more than TileSet.MaxTiles tiles without a tileCount before it lays one, and leaves the atlas handed in empty`
     — `new TileSet(atlas, new TextureCoords(0, 0, 2048, 1024), {tileWidth: 1, tileHeight: 1})`
     wirft `RangeError` mit `/2097152 tiles of 1 × 1 fit into 2048 × 1024 .* a tile set holds at most 1048576/`,
     `atlas.size` bleibt 0. Vor dem Fix legt die Schleife 2 097 152 Tiles (endlich, rund 0,3 s) und
     wirft nicht. Erwartungen mit Zahlenliteralen, nicht über `TileSet.MaxTiles`.
   - **Regressionstest, vor dem Fix rot:** `refuses a tileCount above TileSet.MaxTiles` —
     dieselbe Basis mit `tileCount: 1048577` wirft `RangeError` `/tileCount must be a whole number from 1 to 1048576, got 1048577/`.
   - `TileSet.MaxTiles` ist `2 ** 20`.
   - Nach dem Fix (kein roter Lauf möglich, die alte Schleife käme nicht zurück):
     `refuses a tileWidth of 0.001 on a 64 × 64 image` → `RangeError`, Atlas leer.
   - Charakterisierung (vor und nach dem Fix grün): `takes a tileCount within MaxTiles from an image that holds far more`
     — Basis 8192 × 8192, Tiles 1 × 1, `tileCount: 16` → `tileCount` 16, letzter Frame bei
     `x: 15, y: 0`.
   - Die bestehenden Specs bleiben unverändert grün (die Positionen mit `padding: 1.5` Z. 63–78
     treffen mit der Multiplikation dieselben Werte).

### 2. BUG-026 — mehr als ein Timing-Feld wird abgewiesen

In `src/texture/FrameBasedAnimations.ts`, `resolveTiming()` (Z. 153–193): die Konfliktprüfung
Z. 171–176 wird durch eine Prüfung über alle drei Felder ersetzt, die **vor** dem
`durations`-Zweig steht (nach der Playback-Prüfung):

```ts
// the type allows one of the three, and a catalog is json: a second field would be dropped
// without a word — the frameRate branch comes first and would win — so it is refused
const given = [
  'durations' in timing && timing.durations !== undefined ? 'durations' : undefined,
  'duration' in timing && timing.duration !== undefined ? 'a duration' : undefined,
  'frameRate' in timing && timing.frameRate !== undefined ? 'a frameRate' : undefined,
].filter((field) => field !== undefined);
if (given.length > 1) {
  const fields = given.length === 2 ? `${given[0]} and ${given[1]}` : `${given[0]}, ${given[1]} and ${given[2]}`;
  throw new Error(
    `FrameBasedAnimations: add() got ${fields} for the animation ${animNameInError(name)} — give one of duration, frameRate and durations`,
  );
}
```

`fields` ergibt genau: `durations and a duration`, `durations and a frameRate`,
`a duration and a frameRate`, `durations, a duration and a frameRate`. Danach bleibt der
`durations`-Zweig ohne eigene Konfliktprüfung.

TSDoc nachziehen: `AnimationTimingOptions` (Z. 70–103) — Satz »Timing that gives more than one of
them is refused by `add()`.« · `resolveTiming()` `@throws` (Z. 149–151) · `add()` (Z. 347–351)
in der Aufzählung der Abweisungen »timing that gives more than one of `duration`, `frameRate` and
`durations`« · `TextureResourceEvents` in `src/texture/TextureResource.ts` (Z. 98–106), Liste der
übersprungenen Einträge: »timing that gives more than one of `duration`, `frameRate` and
`durations`«.

Specs:
- `FrameBasedAnimations.spec.ts` Z. 1197–1206: das `test.each` um `{duration: 1, frameRate: 10}`
  und `{durations: [0.1, 0.1], duration: 1, frameRate: 10}` erweitern und je die ganze Meldung
  prüfen (`FrameBasedAnimations: add() got a duration and a frameRate for the animation "a" — give one of duration, frameRate and durations`
  usw.). **Der Fall `{duration: 1, frameRate: 10}` ist der Regressionstest und vor dem Fix rot.**
- `TextureResource.spec.ts` neben Z. 619–657 (Muster »an animation entry without a duration and
  without a frameRate is skipped and reported …«): `an animation entry with a duration and a frameRate is skipped and reported, and the other entries are registered`
  — Fehler-Event `{source: 'frameBasedAnimations', animation: 'walk'}` mit der neuen Meldung, ein
  zweiter Eintrag ist in `frameBasedAnimations` registriert. Vor dem Fix rot.

Proposal `docs/proposals/animation-playback-and-aseprite.md` §3.2: Tabellenzeile Z. 111 wird
`| more than one of `durations`, `duration` and `frameRate` | `` a duration and a frameRate for the animation "a" — give one of duration, frameRate and durations `` |`;
der Absatz Z. 119–120 (»… `frameRate` wins; refusing the pair would break such a catalog«) wird
ersetzt durch: »A json catalog that gives more than one of them has that entry refused like any
other timing the types forbid: the `TextureResource` reports it as an `error` with `source:
'frameBasedAnimations'` and registers the other entries of the map.« Kein Satz über das alte
Verhalten (Konvention).

Abweichung von der Proposal-Notiz, begründet: TSDoc und Typ verlangen »exactly one«, und ein
stilles `frameRate` vor `duration` versteckt einen Katalogfehler. Der Bruch bleibt klein — ein
`TextureResource` überspringt nur diesen Eintrag und meldet ihn —, kein Katalog des Repos
kombiniert die Felder (Zug 0: `apps/lookbook/public/assets/nobingers.json` nutzt `frameRate`
allein), und Entscheidung »Kleine API-Brüche wie empfohlen, je mit Changelog-Migrationshinweis«
deckt ihn.

### 3. API-006 — `FrameBasedAnimations.MaxTextureSize` ist `static readonly`

- `src/texture/FrameBasedAnimations.ts` Z. 316: `static readonly MaxTextureSize: number = 8192;`
  — nur auf Typebene, wie `MaxFramesWithDurations` und `AtlasFrameTable.MaxFrames` (kein
  `Object.defineProperty`). TSDoc Z. 309–315 um den Satz: »Read-only: a bake takes a limit of its
  own through `maxTextureSize` or `renderer` of {@link BakeTextureOptions}, a `FrameTable` through
  the same options of its `bakeDataTexture()`.«
- `add()` TSDoc Z. 355: », as read at the call« streichen (der Wert ändert sich nicht mehr).
- `FrameBasedAnimations.spec.ts` Z. 763–777: der Test schreibt `MaxTextureSize = 2`. Umstellen auf
  `animations.bakeDataTexture({maxTextureSize: 2})` mit derselben Meldungsprüfung, ohne
  `try/finally`; Testname bleibt.
- **Typfall, vor dem Fix rot (TS2578 in `pnpm typecheck`):** in `FrameBasedAnimations.spec.ts`
  ein Test `MaxTextureSize is read-only for TypeScript` mit
  `// @ts-expect-error — the limit of a bake is an option of the bake` vor
  `FrameBasedAnimations.MaxTextureSize = 4096;` — der Test darf die Zuweisung nicht ausführen
  (in eine nie aufgerufene Funktion legen, z. B. `const write = () => { … }; expect(write).toBeTypeOf('function');`).

### 4. API-009 — Payload-Typen der `error`-Events

1. In `src/texture/TextureResource.ts`, direkt vor `export const TextureResourceEvents`:

   ```ts
   /**
    * The payload of an `error` event of a {@link TextureResource}, one shape per `source`;
    * {@link TextureResourceEvents} says when each goes out.
    */
   export type TextureResourceErrorEvent =
     | {readonly source: 'image'; readonly url: string; readonly error: unknown}
     | {readonly source: 'atlas'; readonly url: string; readonly status?: number; readonly error: unknown}
     | {readonly source: 'texture'; readonly id: string; readonly error: unknown}
     | {readonly source: 'frameBasedAnimations'; readonly id: string; readonly animation: string; readonly error: unknown};
   ```

   (Abgeglichen in Zug 0: `image` trägt `url` ohne `status`, `atlas` `url` mit oder ohne `status`
   — `fetchAtlasJson.ts` und Z. 1505 —, `texture` nur `id`, `frameBasedAnimations` `id` und den
   Namen des Eintrags aus `Object.entries()`.) Den Bullet »`error` carries one payload per
   `source`« (Z. 79) auf »`error` carries a {@link TextureResourceErrorEvent}, one shape per
   `source`:« umstellen.

2. In `src/texture/TextureStore.ts`, direkt vor `export const TextureStoreEvents`:

   ```ts
   /**
    * The payload of an `error` event of a {@link TextureStore}: a `fetch` that failed or answered
    * with a status, with the url of the request, or a `parse` failure — with the url of the catalog
    * when `loadAsync()` could not parse its body, with the id of the item at fault, or with neither
    * for what belongs to the catalog as a whole. {@link TextureStoreEvents} says when each goes out.
    */
   export type TextureStoreErrorEvent =
     | {readonly source: 'fetch'; readonly url: string | URL; readonly status?: number; readonly error: unknown}
     | {readonly source: 'parse'; readonly url?: string | URL; readonly id?: string; readonly error: unknown};
   ```

   Bullet `Error` im TSDoc von `TextureStoreEvents` (Z. 88) beginnt mit »fires with a
   {@link TextureStoreErrorEvent}, `{source: 'fetch'|'parse', url?, id?, status?, error}`.«

3. `src/texture/internals.ts` Z. 24–34: `TextureResourceLoadFailure` wird
   `export type TextureResourceLoadFailure = Exclude<TextureResourceErrorEvent, {source: 'frameBasedAnimations'}>;`
   mit `import type {TextureResourceErrorEvent} from './TextureResource.js';`; der Kommentar
   bleibt sinngemäß (der Teil der Payloads, den die Ressource als Ladefehler festhält).
   `fetchAtlasJson.ts` bleibt unverändert.

4. Jede Ausgabe eines `error`-Events geht durch einen typisierten Helfer auf Modulebene:
   - `TextureResource.ts`: `const reportError = (resource: TextureResource, event: TextureResourceErrorEvent): void => { emitSafe(resource, OnError, event); };`
     (Modulebene, weil die drei Formklassen im selben Modul ihn auch brauchen und `#`-Methoden
     der Basis nicht erreichen). Ersetzt `emitSafe(this, OnError, …)` in Z. 697, 962, 999, 1055,
     1474.
   - `TextureStore.ts`: `const reportError = (store: TextureStore, event: TextureStoreErrorEvent): void => { emitSafe(store, OnError, event); };`
     Ersetzt Z. 721, 903, 999, 1008, 1012, 1166.
   - Danach zeigt `grep -n "OnError" src/texture/TextureResource.ts src/texture/TextureStore.ts`
     nur noch die Konstante, die beiden Helfer und die `on()`-Abonnements.

5. Interne Leser auf die Typen umstellen:
   - `TextureStore.loadAsync()` (statisch, Z. 333–341): der Listener nimmt
     `(event: TextureStoreErrorEvent)`, die Fundstelle wird
     `event.url ?? (event.source === 'parse' ? event.id : undefined) ?? url`.
   - `resourceFailedError()` (Z. 195–198): `url` über `'url' in failure ? failure.url : undefined`
     (die `texture`-Form hat keine).

6. Specs (Typfälle, vor dem Fix rot mit TS2305 — fehlender Export):
   - `TextureResource.spec.ts`: ein Test, der die Events eines fehlschlagenden Bilds als
     `TextureResourceErrorEvent[]` sammelt (Import aus `./TextureResource.js`) und über `source`
     verengt (`if (event.source === 'image') expect(event.url).toBe(…)`), dazu
     `// @ts-expect-error — an image failure names its url` vor
     `const missing: TextureResourceErrorEvent = {source: 'image', error: new Error('x')};`.
   - `TextureStore.spec.ts`: dasselbe Muster für `TextureStoreErrorEvent` mit einem `fetch`, der
     einen Status beantwortet (vorhandenes Fetch-Mock des Specs nutzen), und
     `// @ts-expect-error — a fetch failure names its url` vor `{source: 'fetch', error: 1}`.

### 5. CONS-004 — eine Zufallshilfe

- Neu `src/utils/randomInt.ts` (nicht in `src/utils/public-api.ts`):

  ```ts
  /**
   * A whole number from 0 up to, but not including, `max`, drawn by `Math.random()`; 0 for a `max`
   * of 0. `Math.floor()` and not `| 0`, which cuts a draw of 2^31 or more down to a negative number.
   */
  export const randomInt = (max: number): number => Math.floor(Math.random() * max);
  ```

- `src/texture/TextureAtlas.ts` Z. 26 und `src/texture/TileSet.ts` Z. 31: die lokale `rand`
  entfällt, die Aufrufer (`TextureAtlas.ts:139`, `:152`, `TileSet.ts:186`, `:190`) rufen
  `randomInt()`.
- `src/utils/randomInt.spec.ts`: `Math.random` per `vi.spyOn` auf `0` → `0`; auf `0.999999` mit
  `max` 3 → `2`; `max` 0 → `0`; `max` `2 ** 32` mit `0.75` → `3221225472` (mit `| 0` käme
  `-1073741824` heraus).

### 6. READ-006 — die Texel eines Frames an einer Stelle

Neu `src/texture/frameTexels.ts` (intern, nicht in `public-api.ts`):

- Modulkommentar: die Texel eines Frames, wie die beiden Tabellen und das animsMap sie lesen —
  `[s, t, u, v]` wie `TextureCoords#getTexCoords()`, `[width, height, flipDiagonal, endTime]`,
  `[left, top, right, bottom]` der Trimränder; die öffentliche Beschreibung des Layouts bleibt in
  der TSDoc der drei Bakes.
- `export function writeFrameTexels(target: Float32Array | Float64Array, offset: number, coords: TextureCoords, texels: 1 | 2 | 3, margins: Readonly<FrameTrimMargins>, endTime: number): void`
  — schreibt ab `offset` (in Floats) das erste Texel, mit `texels >= 2` das zweite (`endTime` als
  vierte Komponente), mit `texels === 3` das dritte. Ohne Allokation: `getTexCoords()` in einen
  Modul-Scratch `Float64Array(4)`, dann vier Zuweisungen.
- `export function writeTableEntryTexels(target: Float32Array | Float64Array, offset: number, entry: TextureAtlasFrame<unknown> | TextureCoords): void`
  — löst `entry` in `coords` und Frame-Daten auf
  (`entry instanceof TextureCoords ? entry : entry.coords`, Daten `undefined` für bloße
  `TextureCoords`), liest die Trimränder über `frameTrimMargins(data, trimScratch)` in einen
  Modul-Scratch und ruft `writeFrameTexels(target, offset, coords, 3, trimScratch, 0)`.

Aufrufer:
- `FrameTable#bakeDataTexture()` (Z. 134–142): Schleife ruft
  `writeTableEntryTexels(data, (1 + k * TEXELS_PER_FRAME) * 4, entry)`; die lokalen Scratches
  `texCoords`/`trim` entfallen.
- `AtlasFrameTable#update()` (Z. 102–114): Modul-Scratch `const frameScratch = new Float64Array(12)`
  (Float64, damit die Werte so genau ankommen wie heute); je Frame
  `writeTableEntryTexels(frameScratch, 0, entry)`, dann `values[i * 3]!.fromArray(frameScratch, 0)`,
  `values[i * 3 + 1]!.fromArray(frameScratch, 4)`, `values[i * 3 + 2]!.fromArray(frameScratch, 8)`.
  Die Scratches Z. 19–21 entfallen. `src/texture/hot-path-allocations.spec.ts` › `AtlasFrameTable#update() allocates nothing per frame`
  muss grün bleiben.
- `renderFloatsBuffer()` in `FrameBasedAnimations.ts` (Z. 289–298): je Frame
  `writeFrameTexels(floatsBuffer, offset, coords, texelsPerFrame, trims[i]!, durations ? endTime : 0)`
  nach dem Aufsummieren von `endTime`.

Nicht gemeinsam gemacht, mit Grund: Konstruktor (Leer-Prüfung, Kopie), `size`, `indexOf()` und die
Übernahme der Indizes in `fromAtlas()` bleiben je Klasse. Eine gemeinsame Basisklasse stünde in den
öffentlichen `.d.ts` beider Tabellen und müsste exportiert werden (`checkNameableTypes`); die
Auswahl teilen beide schon über `selectAtlasFrames()`, der Rest sind je drei Zeilen. Die beiden
gleichlautenden öffentlichen Typen `FrameTableEntry` und `AtlasFrameTableEntry` bleiben.

`src/texture/frameTexels.spec.ts` (Charakterisierung): ein Frame mit `FLIP_DIAGONAL` und
Trimrändern ergibt mit `texels` 1, 2, 3 genau 4, 8, 12 geschriebene Werte ab `offset` 4, der Rest
des Ziels bleibt unberührt; `writeTableEntryTexels()` für bloße `TextureCoords` schreibt vier
Nullen als Ränder. Die bestehenden Layout-Specs von `FrameTable`, `AtlasFrameTable` und
`FrameBasedAnimations#bakeDataTexture()` laufen unverändert.

### 7. API-001 — benannte Exporte in texture, map2d und sprites

Entscheidung im Plan (2026-10-23): `public-api.ts` von texture, map2d und sprites auf benannte
Exporte; schon exportierte Hilfen bleiben exportiert und bekommen `@deprecated`. Die Menge der
exportierten Namen ändert sich nicht (bis auf die zwei neuen Typen aus Schritt 4).

1. `src/texture/public-api.ts`, `src/map2d/public-api.ts`, `src/map2d/chunk-quad-tree/public-api.ts`,
   `src/sprites/public-api.ts`: jede Zeile `export * from './X.js'` wird
   `export {A, type B, …} from './X.js';` mit **jedem** Namen, den `X.ts` heute exportiert
   (Werte ohne, reine Typen mit `type`; Klassen und `enum` ohne `type`); `export type * from './types.js'`
   wird `export type {…} from './types.js';`. Reihenfolge der Dateien wie heute, Namen je Zeile
   alphabetisch wie in `src/display/public-api.ts`. Kopfkommentar wie dort:
   `// Named one by one: a file of this module exports for its neighbours as well, and only what is listed here is published`.
   Ausnahme: `src/map2d/public-api.ts` behält `export * from './chunk-quad-tree/public-api.js';`
   (eine kuratierte Liste, wie `src/index.ts` sie einbindet). Formatierung über
   `pnpm exec biome format --write <Datei>` (Zeilenbreite 130).
   Neu dazu: `TextureResourceErrorEvent` (aus `./TextureResource.js`) und `TextureStoreErrorEvent`
   (aus `./TextureStore.js`). `randomInt`, `frameTexels` und `internals` bleiben draußen.

2. `@deprecated` genau an drei Deklarationen — keine weiteren:
   - `MapTuple` (`src/texture/TextureStore.ts` Z. 51–61): TSDoc ergänzen um
     `@deprecated A step of {@link MapSubTypes}, not a name to use outside the library. It stays exported until a breaking release.`
   - `MapSubTypes` (Z. 63–70):
     `@deprecated A helper of the signatures of {@link TextureStore}, not a name to use: name the value of one subtype as \`TextureResourceSubTypeMap['atlas']\`, and the values of a list as a tuple of them, \`[TextureResourceSubTypeMap['atlas'], TextureResourceSubTypeMap['texture']]\`. It stays exported until a breaking release.`
   - `base64toUint32Arr` (`src/map2d/chunk-quad-tree/base64toUint32Arr.ts` Z. 4, bekommt dabei
     eine TSDoc: was es tut — base64 zu `Uint32Array`, `isLittleEndian` Vorgabe `true`, eine
     angehängte Bytegruppe unter 4 fällt weg):
     `@deprecated A helper of {@link DataIdsChunk2D}, not a name to use outside the library: a subclass that overrides \`prepareData()\` decodes the ids through \`super.prepareData(base64)\`. It stays exported until a breaking release.`
   Die internen Verwender (`TextureStore`-Signaturen, `DataIdsChunk2D.ts:76`) bleiben wie sie sind.

   Keine weiteren Kandidaten (»u. ä.« der Entscheidung), geprüft in Zug 0 gegen Guides, CHANGELOG,
   Lookbook, Browser-Tests und öffentliche Signaturen: `FrameBasedAnimDef` (im unveröffentlichten
   CHANGELOG und im Proposal als öffentliche Form genannt), `tileKey`/`packTileCoords` (Migration
   Guide »What CameraBasedVisibility hands out«), `isTextureOptionClass` (0.22.0 bewusst
   hinzugefügt), `Quadrant`, `IChunkQuadTreeChildNodes`, `TextureResourceSubTypeMap` (0.22.0 für
   die Benennbarkeit exportiert, stehen in Signaturen), die TSL-Helfer in `node-utils.ts` (Schritt
   8 dokumentiert sie), `SpriteMethod` (Typ von `SpriteFeature.methods`), `prepareSpriteFrame`
   und `shadowFallsOnPlane` (Guide).

3. Folge des `@deprecated` an `base64toUint32Arr`, gehört zu diesem Paket: der Migration Guide
   `CHANGELOG.md` »#### A subclass of DataIdsChunk2D« (Z. 753–777, aus Paket 8) empfiehlt die
   Funktion im »After«. Den Block ersetzen durch

   ````markdown
   ```ts check
   import {DataIdsChunk2D} from '@spearwolf/twopoint5d';

   declare function decode(base64: string): Uint32Array;

   class MyChunk extends DataIdsChunk2D {
     protected override prepareData(base64: string): Uint32Array {
       return decode(base64);
     }
   }
   ```
   ````

   und vor »**Before**« den Satz »The ids as `DataIdsChunk2D` decodes them come from
   `super.prepareData(base64)`.« ergänzen.

4. `docs/architecture.md` §1 (Z. 14–26): neuer Spiegelstrich nach dem ersten: »`display/`,
   `texture/`, `map2d/` (with `chunk-quad-tree/`) and `sprites/` name their exports one by one,
   because their files export for their neighbours as well: a new export of such a file stays
   internal until it is listed. A helper listed only because an earlier release published it
   carries `@deprecated`.« Im Spiegelstrich zu `export type` »as `display/` does« → »as the four
   modules above do«.

### 8. API-007 — TSDoc der undokumentierten Exporte

Je Deklaration ein TSDoc-Block mit Zweck, Einheiten und Verhalten an den Rändern, im Stil der
übrigen Library (ganze Sätze, `{@link …}` wo es eine Stelle gibt). Umfang ist genau diese Liste:

- `src/texture/TextureAtlas.ts`: `TextureAtlasFrame` (die `coords` im Bild, optionale `data` vom
  Typ `D`), `TextureAtlasArgs` und `NamedTextureAtlasArgs` (die Argumente von `add()`),
  `TextureAtlasFrameName` (String oder Symbol; ein Symbol findet `frameNames(match)` nicht),
  `get(id)` (der Frame unter `id`, auch einer, den `DynamicAtlas#remove()` losgelassen hat;
  `undefined` für eine `id` ohne Frame — ab `size`, negativ, gebrochen), `frameId(name)` (die id
  oder `undefined`, auch für einen losgelassenen Namen), `frame(name)` (der Frame oder
  `undefined`). Die TSDoc von `add()` (Z. 45–51) beginnt mit Großbuchstaben: »Adds a frame and
  answers its id: …«.
- `src/texture/TextureCoords.ts`: `FLIP_HORIZONTAL`, `FLIP_VERTICAL`, `FLIP_DIAGONAL` (Bits von
  `flip`), `x`, `y` (Pixel relativ zu `parent`, ohne ihn zur Textur), `width`, `height` (Pixel,
  unter `FLIP_DIAGONAL` gezeichnet vertauscht — Klassen-TSDoc), `flip`, `parent`, der Konstruktor
  (drei Formen: leer — alles 0; `(parent, x?, y?, width?, height?)`; `(x?, y?, width?, height?)`;
  fehlende Werte 0), `clone()` (neue Instanz mit denselben Werten und **demselben** `parent`, nicht
  dessen Kopie), `root` (der oberste Vorfahr, ohne `parent` die Instanz selbst), `flipH`, `flipV`,
  `flipD` (Lesen und Setzen des einen Bits, die anderen bleiben), `flipHorizontal()`,
  `flipVertical()`, `flipDiagonal()` (kippen das Bit, antworten `this`), `s`, `t` (Ecke des
  Bereichs in Texturkoordinaten 0–1 der Wurzel, nach den Flips), `s1`, `t1` (die Gegenecke), `u`,
  `v` (`s1 - s`, `t1 - t`, negativ bei gespiegelter Achse). Jeder Getter geht die Kette der Eltern
  einmal hinauf; für alle vier Werte auf einmal `getTexCoords()`.
- `src/texture/DynamicAtlas.ts`: `width`, `height` (Texel der Atlasfläche), `padding`, `extrude`
  (wie die Optionen Z. 39–45 sie beschreiben, nach der Vorgabe aufgelöst), `isDisposed` (`true`
  ab dem ersten `dispose()`), `DynamicAtlasSize.width`/`height` (Texel, aufgerundet — wie die
  Interface-TSDoc), `DynamicAtlasOptions` (ein Satz zum Interface).
- `src/display/styleUtils.ts` `getContentAreaSize(element, style?)` (Entscheidung: bleibt
  öffentlich mit TSDoc): Breite und Höhe des Inhaltsbereichs in CSS-Pixeln — `getBoundingClientRect()`
  abzüglich Rahmen und Innenabstand beider Seiten —, `style` Vorgabe `getComputedStyle(element)`,
  die Antwort trägt den benutzten `style` mit; ein transformiertes Element wird mit seiner
  Transformation gemessen.
- `src/sprites/node-utils.ts`: `vertexByInstancePosition()` (TSL: Vertexposition, Vorgabe
  Attribut `position`, je Achse mit `scale` multipliziert, falls gegeben, plus `instancePosition`,
  Vorgabe Attribut `instancePosition`; lokaler Raum des Meshes, kein Billboard) und
  `texCoordsFromIndex(mapSize, ndx)` (UV der Mitte von Texel `ndx` einer Textur der Größe
  `mapSize`, Zeile für Zeile von Texel 0 an gezählt). Die GLSL-Kommentarzeilen Z. 78–81 und Z. 85
  löschen; der Absatz Z. 74–76 (warum `int`) wandert als Kommentar in den Funktionskörper, damit die
  TSDoc direkt über der Deklaration steht.
- `src/utils/unpick.ts` `unpick(o, ...keys)`: flache Kopie der eigenen aufzählbaren Schlüssel
  (String und Symbol) ohne `keys`; `undefined` für `null`/`undefined`; ein eigener Schlüssel
  `__proto__` bleibt ein Feld.
- `src/utils/findRootNode.ts` `findRootNode(node)`: der oberste Vorfahr — der Knoten ohne
  `parent` —, ohne Eltern `node` selbst.
- `src/utils/Dependencies.ts` `clear()` (Z. 211): leert den Zustand; danach liest `value()` für
  jeden Schlüssel `undefined`, und das nächste `equals()`/`changed()` vergleicht mit einem
  leeren Zustand (Verhalten aus dem Code bestätigen, nicht raten).

Die Signaturen ändern sich nicht. Was in diesen Dateien sonst ohne TSDoc auffällt, als Nebenbefund
melden, nicht dokumentieren.

### 9. Exportprobe

```bash
pnpm build:twopoint5d
node /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-13.list-exports.mjs \
  > /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-13.exports-after.tsv
diff /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-13.exports-before.tsv \
     /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-13.exports-after.tsv
```

Erwartet ist genau dieser Unterschied und kein anderer: zwei neue Zeilen
`TextureResourceErrorEvent\ttype\t` und `TextureStoreErrorEvent\ttype\t`, und die drei Zeilen
`MapSubTypes`, `MapTuple`, `base64toUint32Arr` tragen in der dritten Spalte `deprecated`. Die
Ausgabe von `diff` gehört in den Report.

### 10. DX-001 — README

Root-`README.md`:
- »## 📖 Documentation« (Z. 161–180): den ersten Satz (stabile und experimentelle Features)
  behalten; den Rest des Absatzes (»as an independent solo developer …«), das Zitat »Read the
  source, Luke!« und den Satz über »one or two READMEs« streichen. Stattdessen eine Liste:
  - die Guides für Anwender — [sprites](packages/twopoint5d/docs/sprites.md),
    [text](packages/twopoint5d/docs/text.md), [tile maps](packages/twopoint5d/docs/map2d.md),
    [display: resolution and frame rate](packages/twopoint5d/docs/display.md)
  - [Stage layer cheat-sheet](packages/twopoint5d/src/stage/README.md) und
    [Vertex objects](packages/twopoint5d/src/vertex-objects/README.md)
  - [Resource lifecycle](packages/twopoint5d/docs/resource-lifecycle.md)
  - [Library architecture](packages/twopoint5d/docs/architecture.md) und
    [Monorepo architecture](docs/architecture.md) — Nx, Build, Publish, CI-Gate
  - [Proposals](packages/twopoint5d/docs/proposals/README.md) — für Entwickler der Library
  - [CHANGELOG](packages/twopoint5d/CHANGELOG.md) — mit einem Migration Guide für jeden Bruch
  Der Absatz zur LOOKBOOK-App und der Hinweis auf `pnpm lookbook` bleiben.
- »## Getting involved« (Z. 222–225): ein Satz, der auf [AGENTS.md](AGENTS.md) zeigt — Befehle,
  Aufbau des Repos und die Regeln, die man dem Code nicht ansieht; für Coding-Agents geschrieben
  und für menschliche Beitragende ebenso brauchbar.
Vorbild für Reihenfolge und Wortlaut der Links: `packages/twopoint5d/README.md:131–134`. Alle
Links relativ zum Repo-Root und vorhanden (prüfen).

### 11. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`:

- `### Added` (ab Z. 10):
  - add `TextureResourceErrorEvent` and `TextureStoreErrorEvent`, the payloads of the `error`
    events of `TextureResource` and `TextureStore` as unions over `source`
  - add `TileSet.MaxTiles`, the most tiles a tile set holds: 2^20, every tile of 8 × 8 texels or
    more on an image of 8192 × 8192
- `### Changed` (ab Z. 66):
  - `new TileSet()` works out how many tiles fit and refuses more than `TileSet.MaxTiles` of them
    without a `tileCount`, and a `tileCount` above it, with a `RangeError` before it lays a tile
    (**BREAKING**). See the Migration Guide
  - `FrameBasedAnimations#add()` refuses timing that gives more than one of `duration`,
    `frameRate` and `durations` with an error that names the animation and the fields; a
    `TextureResource` skips such an entry of its animation data and reports it with
    `source: 'frameBasedAnimations'` (**BREAKING** for JavaScript and catalog json). See the
    Migration Guide
  - `FrameBasedAnimations.MaxTextureSize` is `static readonly`: a bake takes a limit of its own
    through `maxTextureSize` or `renderer` (**BREAKING** for TypeScript). See the Migration Guide
- neu `### Deprecated` zwischen `### Changed` und `### Removed` (Z. 135):
  - deprecate `MapTuple`, `MapSubTypes` and `base64toUint32Arr`: helpers of `TextureStore` and
    `DataIdsChunk2D` the public surface carries without meaning to. Name a value of `getAsync()`
    through `TextureResourceSubTypeMap`; a subclass of `DataIdsChunk2D` decodes its ids through
    `super.prepareData(base64)`. They stay until a breaking release takes them out
- `### Migration Guide`, drei neue `####`-Abschnitte am Ende, je mit **Before** (`ts`) und
  **After** (`ts check`, eigenständig: alles importiert, alles deklariert):
  - »A TileSet of more than 1 048 576 tiles« — Before
    `new TileSet(new TextureCoords(0, 0, 2048, 1024), {tileWidth: 1, tileHeight: 1})`, After mit
    `tileCount` (z. B. `tileCount: 4096`) oder größeren Tiles.
  - »Animation timing with more than one of duration, frameRate and durations« — Before
    `animations.add('walk', {duration: 1, frameRate: 12} as never, frames)` (bzw. das
    Katalog-Json `{"duration": 1, "frameRate": 12, "tileIds": [1, 2, 3]}`), After nur `frameRate: 12`;
    Satz: wer `duration` und `frameRate` gab, bekam die Dauer aus `frameRate`.
  - »A bake limit set through FrameBasedAnimations.MaxTextureSize« — Before
    `FrameBasedAnimations.MaxTextureSize = 4096; animations.bakeDataTexture();`, After
    `animations.bakeDataTexture({maxTextureSize: 4096})`; Satz: die Grenze eines `tileCount` in
    `add()` ist 8192.
  - Dazu die Änderung an »A subclass of DataIdsChunk2D« aus Schritt 7.3.

Ausgelassen, mit Grund: kein Eintrag zu den benannten Exporten (die Menge der Namen bleibt gleich,
für Anwender unsichtbar), zu `frameTexels`, `randomInt` (intern) und zur TSDoc (API-007).

## Abgleich

| Finding | Urteil | Fundstelle jetzt |
| --- | --- | --- |
| PERF-002 | unverändert | `src/texture/TileSet.ts:258` (`while (tileCount < tileCountLimit)`, `tileCountLimit` ohne Option `Infinity`, Z. 161–163) |
| BUG-026 | unverändert | `src/texture/FrameBasedAnimations.ts:180` (Zweig `frameRate` vor `duration`); die Konfliktprüfung Z. 172 deckt nur `durations` |
| API-006 | unverändert | `src/texture/FrameBasedAnimations.ts:316` `static MaxTextureSize = 8192`; Leser Z. 246, 481, 666, `FrameTable.ts:115`; Spec schreibt ihn `FrameBasedAnimations.spec.ts:771` |
| API-009 | unverändert | `src/texture/internals.ts:28` `TextureResourceLoadFailure`; Inline-Typ des Listeners `TextureStore.ts:336` (Audit: Z. 267); Payload-Doku `TextureResource.ts:79–106`, `TextureStore.ts:88` |
| CONS-004 | unverändert | `src/texture/TextureAtlas.ts:26`, `src/texture/TileSet.ts:31` |
| READ-006 | umgeformt | `selectAtlasFrames()` (`src/texture/selectAtlasFrames.ts`) teilt Auswahl und Indizes; doppelt bleiben Texel-Belegung (`FrameTable.ts:136–142`, `AtlasFrameTable.ts:105–113`, `FrameBasedAnimations.ts:289–298`), Konstruktor, `size`, `indexOf()` |
| API-001 | unverändert | `src/texture/public-api.ts`, `src/map2d/public-api.ts`, `src/map2d/chunk-quad-tree/public-api.ts:7`, `src/sprites/public-api.ts` mit `export *`; `TextureStore.ts:54` (`MapTuple`), `:65` (`MapSubTypes`), `base64toUint32Arr.ts:4` |
| API-007 | unverändert | `TextureAtlas.ts:99/103/107`, `TextureCoords.ts:94` (und fast alle Member), `DynamicAtlas.ts:257`, `styleUtils.ts:31`, `node-utils.ts:7/77` (GLSL-Kommentar Z. 78–85), `unpick.ts:1`, `findRootNode.ts:3`, `Dependencies.ts:211` |
| DX-001 | unverändert | `README.md:161–180` (»Read the source, Luke!« Z. 168) |

## Triage

- Offene Folgen im Plan: keine — die `Folgen:`-Zeilen der Pakete 2, 5, 6 und 8 sind über die
  Pakete 14–17 erledigt, alle übrigen lauten »keine« oder »—«.
- »Offene Befunde«: kein Eintrag teilt eine Ursache mit diesem Paket. Nächstliegend:
  - `TextureStore.ts:921` (Artikel der Konfliktmeldung von Hand) — eine Meldung von `#checkItems()`,
    nicht die Payload-Typen von API-009; bleibt in der Queue.
  - `AsepriteJson.ts` (drei Einträge) — Eingabeprüfung des Aseprite-Parsers, keine Datei dieses
    Pakets; bleiben.
  - `FrameLoop.ts:185` (`static OnFrame` beschreibbar) — dasselbe Muster wie API-006, aber eine
    andere Ursache: ein Event-Name, dessen Umschreiben `on()`/`off()` trennt, im Modul `display`;
    API-006 ist ein Grenzwert mit eigener Option je Bake. Die übrigen beschreibbaren Statics in
    `display` sind laut TSDoc absichtlich einstellbar (`Display.MaxResolution`,
    `DefaultMaxPixelRatio`, `FixedFrameLoop.DefaultFps`, `DefaultMaxStepsPerFrame`). Gleiche
    Ursache wie der Queue-Eintrag haben `FixedFrameLoop.OnTick`/`OnRender`
    (`FixedFrameLoop.ts:96–97`) — dort im Eintrag ergänzt, für die Drain-Runde.
- Gefunden in Zug 0, gehört in dieses Paket (Folge der eigenen Änderung, kein Nebenbefund): der
  Migration Guide »A subclass of DataIdsChunk2D« empfiehlt `base64toUint32Arr`, das dieses Paket
  laut Entscheidung `@deprecated` setzt → Schritt 7.3. Ebenso die Notiz »`frameRate` wins« im
  Proposal (Schritt 2) und der Spec, der `MaxTextureSize` schreibt (Schritt 3).

## Findings im Volltext

**PERF-002 · medium · packages/twopoint5d/src/texture/TileSet.ts:258** — Obergrenze für die
Tile-Anzahl in TileSet bei fehlendem tileCount setzen
Der Kommentar bei den Prüfungen sagt, ein ungeprüfter Katalogwert würde die Seite synchron
einfrieren; geprüft wird aber nur, dass Größen endlich und positiv sind. Ohne Option `tileCount`
läuft die Schleife, bis das Bild gefüllt ist, und legt dabei `positions` plus je ein TextureCoords
und einen Atlas-Eintrag an. Ein winziger `tileWidth`/`tileHeight` (etwa 0.001, oder 1 auf einem
8192er-Bild = 67 Mio. Tiles) lässt die Anzahl quadratisch wachsen: Speicher läuft voll oder der
Tab hängt, noch bevor ein Fehler geworfen werden kann.
Beleg: `while (tileCount < tileCountLimit) { positions.push(x, y); … }` mit `tileCountLimit = Infinity` ohne `tileCount`
Empfehlung: Die Spalten- und Zeilenzahl vor der Schleife aus Bildmaßen, Margin, Padding und
Spacing ausrechnen und mit einer Obergrenze (zum Beispiel FrameBasedAnimations.MaxTextureSize ** 2
oder ein eigenes TileSet.MaxTiles) vergleichen; bei Überschreitung RangeError mit Subjekt
`TileSet:` werfen. Die Schleife kann dann durch die Rechnung ersetzt werden.

**BUG-026 · low · packages/twopoint5d/src/texture/FrameBasedAnimations.ts:180** — Widerspruch aus
`duration` und `frameRate` in FrameBasedAnimations.add() ablehnen
resolveTiming() lehnt `durations` zusammen mit `duration`/`frameRate` ab, nicht aber `duration`
zusammen mit `frameRate`. Der Kommentar nennt Katalog-JSON ausdrücklich als Quelle, bei der der Typ
nicht vertraut wird; dort gewinnt bei beiden Feldern stumm `frameRate`, und `duration` wird
ignoriert. TSDoc von AnimationTimingOptions verlangt »exactly one«.
Beleg: `if ('frameRate' in timing && timing.frameRate !== undefined) { return {duration: calculateDurationFromFrameRate(…)} }` vor dem `duration`-Zweig
Empfehlung: Den Konflikt-Check auf alle drei Felder ausdehnen (mehr als eines gesetzt: Error mit
dem Namen der Animation).

**API-006 · low · packages/twopoint5d/src/texture/FrameBasedAnimations.ts:316** —
`FrameBasedAnimations.MaxTextureSize` als readonly deklarieren oder die Veränderbarkeit
dokumentieren
`static MaxTextureSize = 8192` ist ein beschreibbarer globaler Wert, den add()
(tileCount-Obergrenze), bakeDataTexture() beider Tabellen und getBufferSize() bei jedem Aufruf
lesen. Wer ihn setzt, ändert Verhalten und Fehlerschwellen für alle Instanzen der Seite. Die
Schwesterkonstanten `MaxFramesWithDurations` und `AtlasFrameTable.MaxFrames` sind
`static readonly`.
Empfehlung: `static readonly` machen (Limit pro Bake gibt es schon über `maxTextureSize`); soll der
Wert absichtlich einstellbar sein, das im TSDoc sagen.

**API-009 · low · packages/twopoint5d/src/texture/internals.ts:28** — Payload-Typen der
`error`-Events exportieren
Weitere Fundstellen: `packages/twopoint5d/src/texture/TextureStore.ts:80`,
`packages/twopoint5d/src/texture/TextureResource.ts:79`.
Die `error`-Events von `TextureResource` und `TextureStore` tragen dokumentierte Payloads
(`{source: 'image'|'atlas'|'texture', url?, id?, status?, error}`,
`{source: 'frameBasedAnimations', id, animation, error}`,
`{source: 'fetch'|'parse', url?, id?, status?, error}`). Der einzige benannte Typ dafür,
`TextureResourceLoadFailure`, liegt in `internals.ts`, das bewusst nicht in `public-api.ts` steht;
für die übrigen gibt es keinen Typ. Jeder Konsument tippt die Union aus der TSDoc ab — so wie es
`TextureStore.loadAsync()` selbst inline tut (TextureStore.ts:267).
Beleg: `export interface TextureResourceLoadFailure { source: 'image' | 'atlas' | 'texture'; … }` in `internals.ts`
Empfehlung: Je einen diskriminierten Union-Typ `TextureResourceErrorEvent` und
`TextureStoreErrorEvent` in einem öffentlichen Modul definieren, exportieren und intern dafür
verwenden.

**CONS-004 · low · packages/twopoint5d/src/texture/TextureAtlas.ts:26** — Doppelte Zufallshilfe
`rand` zusammenführen
Weitere Fundstelle: `packages/twopoint5d/src/texture/TileSet.ts:31`.
`const rand = (max: number) => (Math.random() * max) | 0;` steht wortgleich in TextureAtlas.ts und
TileSet.ts. Das `| 0` kappt ab 2^31 still; bei beiden Verwendungen unkritisch, aber zwei Kopien
laufen auseinander.
Empfehlung: Eine Hilfsfunktion in `src/utils/` (etwa randomInt) und in beiden Modulen importieren.

**READ-006 · low · packages/twopoint5d/src/texture/FrameTable.ts:55** — Gemeinsamen Kern von
FrameTable und AtlasFrameTable herausziehen
Weitere Fundstelle: `packages/twopoint5d/src/texture/AtlasFrameTable.ts:53`.
Beide Klassen führen dieselbe Struktur: `fromAtlas()` mit selectAtlasFrames() und
Index-Übertragung in ein privates `#indices`, Konstruktor mit Leer-Check und `frames.slice()`,
`size`, `indexOf()`, Entry-Typ `TextureAtlasFrame<unknown> | TextureCoords`, dazu je eine
Kurzform-Funktion. Die Texel-Belegung (coords, Maße/flipD, Trim) steht ebenfalls doppelt, einmal in
update(), einmal in bakeDataTexture(), und in renderFloatsBuffer() ein drittes Mal. Ändert sich das
Layout, müssen drei Stellen im Gleichschritt geändert werden.
Empfehlung: Eine kleine interne Funktion `writeFrameTexels(entry, target, offset)` bzw. ein
gemeinsamer Basistyp für Entry/Selection/Index-Karte; die Tabellen reduzieren sich auf ihre
Backend-Unterschiede (Float-Textur gegen Uniform-Array).

**API-001 · low · packages/twopoint5d/src/texture/TextureStore.ts:46** — Öffentliche Oberfläche
per benannter Exporte statt `export *` festlegen
Weitere Fundstellen: `packages/twopoint5d/src/map2d/chunk-quad-tree/base64toUint32Arr.ts:1`,
`packages/twopoint5d/src/texture/public-api.ts:1`,
`packages/twopoint5d/src/map2d/chunk-quad-tree/public-api.ts:7`.
Bis auf `display/` und Teile von `text/` und `texture/` re-exportieren die `public-api.ts` ganze
Dateien per `export *`. Damit wird jeder Export einer Datei öffentlich, auch reine Hilfen ihrer
Nachbarn: der Rekursionshelfer `MapTuple` und `MapSubTypes` aus `TextureStore.ts` mit Namen, die
nichts mit Texturen zu tun haben und im Konsumentencode leicht kollidieren, oder
`base64toUint32Arr()`, das kein Guide und kein Changelog nennt. Das gebaute Paket exportiert zur
Laufzeit 196 Symbole; welche davon Vertrag sind, sagt nur der Blick in jede einzelne Quelldatei.
Seit 0.23.0 veröffentlicht ist, ist jede Rücknahme ein Breaking Change.
Beleg: `export * from './TextureStore.js';` (texture/public-api.ts) — `display/public-api.ts`
begründet seine benannte Liste: »a file of this module exports for its neighbours as well«
Empfehlung: Die `public-api.ts` von `texture`, `map2d` und `sprites` wie `display/public-api.ts`
auf benannte Exporte umstellen. Für Hilfen, die heute schon draußen sind (`MapTuple`,
`MapSubTypes`, `base64toUint32Arr`), im nächsten Minor `@deprecated` setzen und sie mit dem
nächsten Breaking Release zurücknehmen; `checkNameableTypes` zeigt, welche Typen eine öffentliche
Signatur tatsächlich braucht.

**API-007 · low · packages/twopoint5d/src/texture/TextureAtlas.ts:99** — TSDoc für öffentliche
Exporte ohne Dokumentation ergänzen
Weitere Fundstellen: `TextureAtlas.ts:103`, `TextureAtlas.ts:107`, `TextureCoords.ts:94`,
`DynamicAtlas.ts:257`, `display/styleUtils.ts:31`, `sprites/node-utils.ts:7`,
`sprites/node-utils.ts:77`, `utils/unpick.ts:1`, `utils/findRootNode.ts:3`,
`utils/Dependencies.ts:208` (alle unter `packages/twopoint5d/src/`).
Mehrere öffentliche Exporte kommen ohne TSDoc beim Konsumenten an, obwohl der Build die Kommentare
eigens in die `.d.ts` trägt (`removeComments: false`): öffentliche Mitglieder von `TextureAtlas`,
`TextureCoords` und `DynamicAtlas`, `getContentAreaSize()`, die TSL-Helfer in `node-utils.ts`
(dort steht zusätzlich ein auskommentierter GLSL-Block), `unpick()`, `findRootNode()` und
`Dependencies#clear()`. Der Rest der Library dokumentiert seine API ausführlich; an diesen Stellen
bleibt der Editor des Anwenders leer, und Vertrag und Randfälle (Einheiten, Rückgabe bei fehlendem
Treffer) muss er aus dem Quelltext lesen.
Empfehlung: Je Export ein TSDoc-Block mit Zweck, Einheiten und Verhalten an den Rändern, im Stil
der übrigen Library; den auskommentierten GLSL-Block in `node-utils.ts` löschen. Bei
`getContentAreaSize()` vorher entscheiden, ob es öffentlich bleiben soll (siehe Offene Fragen) —
entschieden: bleibt öffentlich mit TSDoc (Plan, »Entscheidungen«, 2026-10-23).

**DX-001 · low · README.md:161** — Dokumentationsabschnitt der README an die vorhandenen Guides
anpassen
Weitere Fundstellen: `README.md:169`, `README.md:178`.
Der Abschnitt Documentation sagt, es sei dem Autor nicht möglich, ausführliche geschriebene
Dokumentation zu pflegen, und verweist auf »Read the source, Luke!« und auf ein paar READMEs in
src-Unterverzeichnissen. Das Repository hat aber Guides (packages/twopoint5d/docs/sprites.md,
text.md, map2d.md, display.md), Proposals, docs/architecture.md und eine AGENTS.md; AGENTS.md
verlangt sogar, dass ein geändertes Feature seinen Guide im selben Commit ändert. Ein neuer Leser
findet die Guides von der README aus nur über die Sprite-Verlinkung in Zeile 151.
Beleg: `create detailed written documentation and keep it up to date ... "Read the source, Luke!"`
Empfehlung: Den Abschnitt auf die Guides (sprites, text, map2d, display), die Stage- und
Vertex-Object-READMEs und docs/architecture.md zeigen lassen; den Verzicht-Absatz streichen. Die
Contributor-Seite kann auf AGENTS.md verweisen.

## Urteil des Reviewers

Reviewer-Prozess `paket-13.review-0` (opus, effort high), Gesamt: freigegeben.

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| PERF-002 | behoben | `TileSet.ts:83` `static readonly MaxTiles = 1_048_576`; `#cellsAlong()` `:219`, `fitting` `:280`, `RangeError` ohne `tileCount` `:285`, `tileCount`-Grenze `:254`; Schleife und `positions` entfernt; Specs `TileSet.spec.ts:177–219` |
| BUG-026 | behoben | Prüfung über alle drei Timing-Felder vor dem `durations`-Zweig, `FrameBasedAnimations.ts:175`; TSDoc `AnimationTimingOptions` `:85`, `resolveTiming()`, `add()`, Liste in `TextureResource.ts`; Specs `FrameBasedAnimations.spec.ts:1203–1214`, `TextureResource.spec.ts:660` |
| API-006 | behoben | `static readonly MaxTextureSize`, `FrameBasedAnimations.ts:326`; Spec über `bakeDataTexture({maxTextureSize: 2})` `FrameBasedAnimations.spec.ts:770`, Typfall `:843` |
| API-009 | behoben | `TextureResourceErrorEvent` `TextureResource.ts:73`, `TextureStoreErrorEvent` `TextureStore.ts:86`; Helfer `reportError` `TextureResource.ts:164`, `TextureStore.ts:135`; `TextureResourceLoadFailure` als `Exclude<…>` in `internals.ts`; Typ-Specs `TextureResource.spec.ts:1574`, `TextureStore.spec.ts:590` |
| CONS-004 | behoben | `src/utils/randomInt.ts:5` mit `randomInt.spec.ts`; kein `rand(` mehr in `src/` |
| READ-006 | behoben (umgeformter Umfang) | `src/texture/frameTexels.ts:19` `writeFrameTexels`, `:51` `writeTableEntryTexels`; Aufrufer `FrameTable.ts`, `AtlasFrameTable.ts:106`, `renderFloatsBuffer()`; `frameTexels.spec.ts` |
| API-001 | behoben | benannte Exporte in `texture`, `map2d`, `map2d/chunk-quad-tree`, `sprites`; `@deprecated` `TextureStore.ts:54` (`MapTuple`), `:68` (`MapSubTypes`), `base64toUint32Arr.ts:9`; Exportprobe genau wie erwartet; `packages/twopoint5d/docs/architecture.md:20` |
| API-007 | behoben | TSDoc an allen gelisteten Deklarationen (TextureAtlas, TextureCoords, DynamicAtlas, `getContentAreaSize`, `node-utils.ts`, `unpick`, `findRootNode`, `Dependencies#clear()`), Aussagen gegen den Code geprüft |
| DX-001 | behoben | `README.md:164–179` Linkliste auf die Guides, AGENTS.md-Absatz `README.md:232` |
| Folge: Migration Guide `DataIdsChunk2D` | behoben | `CHANGELOG.md:762ff.` ohne `base64toUint32Arr` |
| Folge: Proposal-Notiz `frameRate` | behoben | `animation-playback-and-aseprite.md:111`, `:119–121` |
| Folge: Spec schreibt `MaxTextureSize` | behoben | `FrameBasedAnimations.spec.ts:770` |

Kleine Befunde (keine Runde):

- `TileSet.ts:217` — der Kommentar von `#cellsAlong()` sagt »the caller refuses both« (Zahl über 2^53, `Infinity`); das gilt nur ohne `tileCount`, mit `tileCount` nimmt der Aufrufer `fitting = Infinity` an und legt alle Tiles in die erste Zeile (Verhalten richtig, Kommentar ungenau).
- `TileSet.ts:285` — bei denormaler Tile-Breite ohne `tileCount` lautet die Meldung »Infinity tiles of 5e-324 × … fit into …«; bei `fitting === Infinity` läse sich »more than … tiles« besser.
- `TileSet.ts:118–123` — den neuen Gliedern der `@throws`-Aufzählung fehlen »if« und vor dem letzten Glied »or«; Inhalt stimmt, Satz grammatisch kaputt.

Abweichungen des Implementierers (Report `paket-13.impl-0.report.md`), vom Reviewer nicht beanstandet: Typfehler der fehlenden Exporte ist TS2724 statt TS2305 (TypeScript schlägt einen ähnlichen Namen vor); `test.each` heißt `refuses timing that gives more than one of duration, frameRate and durations: %j`; Kommentar über den Prüfungen in `TileSet.ts` umgeschrieben (die Schleife, die er begründete, ist weg); erster Satz des LOOKBOOK-Absatzes der README neu (»Beside them there is a LOOKBOOK app …«); `docs/architecture.md` §1 als `packages/twopoint5d/docs/architecture.md` gelesen; Migration Guide »a write to it does not compile«; benannte Exportlisten per Compiler-API-Skript im Scratchpad erzeugt.

Nebenbefunde (Urteile an der Scope-Regel »alles, jede Severity«, deshalb alle `→ Scope`; keiner teilt eine Ursache mit einem Finding dieses Pakets):

- `TextureAtlas.ts:174/186/195` — `count` ungeprüft; vorbestehend (`git show 8f3d5ff5:packages/twopoint5d/src/texture/TextureAtlas.ts`, Z. 156/168/177), das Paket hat dort nur die Zufallshilfe getauscht.
- `styleUtils.ts:43` — Messfehler bei transformierten Elementen; vorbestehend, das Paket hat nur TSDoc ergänzt.
- fehlende TSDoc außerhalb der Fundstellenliste des Audits — vorbestehend; API-007 nannte nur die elf Fundstellen, eine Erweiterung hätte den Scope des Pakets verschoben.
