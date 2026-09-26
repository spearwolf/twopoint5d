# Paket 3 — Katalog- und Atlasdaten validieren, relative URLs auflösen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des Laufs, hier
die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-105 (medium), BUG-106 (medium), SEC-001 (low), MEM-015 (low), IMPL-001
  (low) — dazu die Testpunkte von TEST-016 für SEC-001 (`parse()` mit fehlendem `items`
  und mit unbekanntem Klassennamen) und zwei vorbestehende Nebenbefunde derselben Ursache
  wie BUG-106 (Schritt 8 und 9, Herleitung unter »Triage«)
- Ziel: Was aus Katalog- und Atlas-JSON kommt, wird geprüft, bevor es wirkt, relative
  Bild-URLs zeigen auf die Datei neben dem JSON, und wer eine Texture herausbekommt, weiß,
  dass er sie freigibt.
- Modell: stärkste Stufe — öffentliche Oberfläche (neue Option, neuer Export, Typänderung),
  eine Vertrauensgrenze mit Angriffsmodell, ein `parse()`, das atomar bleiben muss, und
  rund 16 Dateien über Library, Lookbook und Browser-Tests
- Effort: high — Sicherheit und öffentliche API nach der Tabelle; der Detailplan nennt die
  Werte, der Effort ist für die Sorgfalt an den Rändern da, nicht für Verbesserungen
  daneben
- Dateien:
  - neu `packages/twopoint5d/src/texture/resolveRelativeUrl.ts`
  - neu `packages/twopoint5d/src/texture/checkTextureStoreData.ts`
  - `packages/twopoint5d/src/texture/TextureStore.ts`
  - `packages/twopoint5d/src/texture/TextureFactory.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts`
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.ts`
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`
  - `packages/twopoint5d/src/texture/TileSet.ts`
  - `packages/twopoint5d/src/texture/types.ts`
  - `packages/twopoint5d/src/texture/TextureImageLoader.ts`
  - `packages/twopoint5d/src/texture/TileSetLoader.ts`
  - `packages/twopoint5d/src/texture/TexturePackerJson.ts`
  - Specs: `TextureStore.spec.ts`, `TextureResource.spec.ts`, `TextureAtlasLoader.spec.ts`,
    `FrameBasedAnimations.spec.ts`, `TileSet.spec.ts`, `TextureFactory.spec.ts`, neu
    `resolveRelativeUrl.spec.ts` (alle unter `packages/twopoint5d/src/texture/`)
  - `packages/twopoint5d/docs/resource-lifecycle.md`
  - `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro`
  - `apps/lookbook/public/assets/textures.json`
  - `packages/twopoint5d-testing/test/texture-store-on.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci` (zum Iterieren vorher `pnpm nx test twopoint5d -- src/texture`)
- Commit: `fix(texture,lookbook): resolve the relative urls of a catalog against the catalog, with a new TextureStoreParseOptions#baseUrl, and a relative meta.image against the url its atlas json came from, check catalog data before parse() writes anything, leave out texture classes no TextureFactory knows and export isTextureOptionClass(), make TextureStoreData#defaultTextureClasses optional, refuse a tile id, first tile id, tile count or frame name query that cannot pick frames in FrameBasedAnimations#add() and a firstId that is no whole number in TileSet, let a TextureResource skip an animation entry whose tileIds is no array, say who owns the textures the loaders, TextureFactory and bakeDataTexture() hand out, and load the lookbook atlases without overrideImageUrl`
  (in Zug 4 von B nachgezogen: `baseUrl`, `isTextureOptionClass()`, `defaultTextureClasses?`, `tileIds` ohne Array — kleiner Befund des Reviewers)

## Entscheidungen dieses Pakets

Getroffen in Zug 0, mit Grund. Der Implementierer setzt sie um und stellt sie nicht neu
zur Wahl.

1. **Die Katalogprüfung ist eine Assertion plus eine Problemliste je Item, kein
   boolescher Guard `isTextureStoreData`** (Abweichung vom Namen in der Empfehlung von
   SEC-001). Die Empfehlung verlangt »sprechende Fehler«; ein `value is T`-Guard kann nur
   `false` sagen, nicht was fehlt. `isAtlasJsonResponse` ist boolesch, weil sein Aufrufer
   nur eine Meldung kennt — der Katalog hat mehrere Ebenen mit je eigener Folge.
2. **Zwei Ebenen, zwei Folgen.** Was das Ganze unlesbar macht — `data` kein Objekt,
   `items` kein Objekt, `defaultTextureClasses` weder abwesend noch ein Array —, lässt
   `parse()` mit einem `TypeError` scheitern, bevor irgendetwas geschrieben oder emittiert
   ist; so hält es `parse()` schon mit Typkonflikten (»a parse either runs whole or not at
   all«). Ein einzelnes Item mit einem Feld falschen Typs baut keine Resource und geht als
   `error` mit `source: 'parse'` und seiner id hinaus; eine Resource, die die id schon
   trägt, bleibt, wie sie ist. Das ist exakt die bestehende Behandlung eines Items ohne
   Quelle (`TextureStore.ts:464-470`, `:543-547`) — ein kaputtes Item soll nicht den
   ganzen Katalog kosten, wenn ein quellenloses es auch nicht tut.
3. **Abwesend heißt `undefined`.** `null` in einem optionalen Feld ist ein Feld falschen
   Typs. Die Typen sagen `?: string` bzw. `?: T[]`; JSON kennt ein fehlendes Feld, und ein
   ausgeschriebenes `null` ist kein Weg, es zu sagen.
4. **Unbekannte Texturklassen werden weggelassen und gemeldet, das Item baut trotzdem**
   (Empfehlung von SEC-001: `error` mit `source: 'parse'`). Ein Tippfehler wie `nearset`
   soll die Resource nicht kosten, aber auch nicht still verschwinden. Für
   `defaultTextureClasses` der Daten gilt dasselbe; die Regel »nur eine nicht leere Liste
   ersetzt die bisherige« (BUG-020 bleibt acknowledged) wird auf die bereinigte Liste
   angewandt: `["nearset"]` lässt die bisherigen Defaults stehen und meldet den Namen. Der
   statische `TextureStore.load()` rejectet auf jeden `error` des Stores — das ist sein
   Vertrag (`TextureStore.ts:151-159`) und bleibt es: ein Katalog mit Tippfehler fällt dort
   beim Start auf.
5. **`TextureFactory#getOptions()` überspringt Namen, die keine Texturklasse sind, und
   wirft nicht.** Die Methode ist typisiert, ein fremder Name kommt nur aus untypisiertem
   JS. Ein Wurf dort erreichte `TextureImageLoader`, `TileSetLoader` und
   `TextureFactory#load()` in Callbacks, die im `load`-Event des Bildes laufen; das
   Überspringen macht die Sortierung bestimmt, und gemeldet wird an der einen Grenze, über
   die fremde Namen hereinkommen: dem Katalog.
6. **ReDoS über `frameNameQuery` wird dokumentiert, nicht technisch verhindert.** Im
   Browser gibt es keine Regex-Engine mit linearer Laufzeit; eine Heuristik gegen
   verschachtelte Quantoren ist löchrig. Verhindern hieße, `frameNameQuery` die
   RegExp-Semantik zu nehmen — ein Bruch des öffentlichen Datenformats
   (`types.ts:28-31`, `TextureAtlas#frameNames()`), den keine Entscheidung deckt.
   Umgesetzt wird: `add()` weist eine Query zurück, die weder String noch `RegExp` ist
   (heute weitet sie still auf alle Frames), ein ungültiges Muster wirft wie bisher den
   `SyntaxError` von `new RegExp`, und die TSDoc von `parse()`, `load()` und
   `FrameBasedAnimationsDataByAtlas.frameNameQuery` zieht die Vertrauensgrenze ausdrücklich.
7. **Aufgelöst wird jede URL im Katalog-JSON, auch `overrideImageUrl`.** Die Entscheidung
   vom 2026-09-26 nennt `imageUrl`/`atlasUrl` der Items als Beispiele des Grundsatzes
   »Relative Bild-URLs in … Katalog-JSON werden gegen die URL der JSON-Datei aufgelöst«;
   `overrideImageUrl` ist eine Bild-URL im Katalog-JSON. Ein `overrideImageUrl`, das im
   Code auf eine Resource geschrieben wird, bleibt, wie es ist.
8. **`baseUrl` wird eine öffentliche Option von `TextureStoreParseOptions`**, und
   `load(url)` setzt sie auf `url`. So kann auch auflösen, wer das JSON selbst holt und
   `parse()` ruft; ohne `baseUrl` schreibt `parse()` die URLs wie bisher.
9. **Nur relative URLs werden aufgelöst.** Eine absolute bleibt Byte für Byte, wie sie
   steht (kein Normalisieren durch `URL#href`); ein leerer String bleibt leer. Die Basis
   wird selbst gegen `document.baseURI` aufgelöst, in einem Worker gegen `location.href` —
   dagegen löst `fetch()` eine relative URL auf. Gibt es keine absolute Basis (kein
   Dokument und eine relative Basis) oder kann die Basis keine relative Referenz tragen
   (`blob:`, `data:` — `new URL(x, 'blob:…')` wirft), bleibt die URL, wie sie steht, und
   der Browser löst sie wie bisher gegen das Dokument auf. Der Browser-Test lädt seinen
   Katalog über eine `blob:`-URL (`texture-store-on.test.js:27-30`, `:92`); ohne diese
   Regel bräche er.
10. **`meta.image` wird im Fetch-Effekt aufgelöst, gegen die `atlasUrl` genau dieses
    Fetches**, bevor die Json in `#fetchedAtlasJson` geht — nicht im Effekt, der das Bild
    wählt (`TextureResource.ts:814-842`). Dort kann `this.atlasUrl` schon den nächsten
    Atlas nennen, während die Json noch vom vorigen stammt. Eine über den Setter von
    außen geschriebene `atlasJson` hat keine URL und behält ihr `meta.image`, wie es ist.
11. **Die Grenzen von BUG-106 sitzen in `FrameBasedAnimations#add()`**, der öffentlichen
    Stelle, nicht im Effekt der Resource: so sind der Katalogpfad und jeder direkte
    Aufrufer gedeckt, und der Effekt meldet den Wurf schon heute als übersprungenen
    Eintrag (`TextureResource.ts:742-747`). `tileCount` ist eine ganze Zahl von 1 bis
    `FrameBasedAnimations.MaxTextureSize` (zur Aufrufzeit gelesen — der statische Wert ist
    schreibbar): mehr Frames passen in keine Datentextur, und die exakte Kapazitätsprüfung
    bleibt in `bakeDataTexture()`. `firstTileId` und jede Tile-id sind ganze Zahlen,
    negative eingeschlossen — `TileSet#frameId()` rechnet modulo. Geprüft wird nur, was
    übergeben wurde: der Default `tileSet.tileCount` darf über `MaxTextureSize` liegen (ein
    Tile-Set aus 1×1-Tiles), `add()` ohne späteres `bakeDataTexture()` ist legitim.
12. **MEM-015 bleibt Dokumentation.** Keine gecachte Datentextur, kein
    `FrameBasedAnimations#dispose()`: `add()` nach `bakeDataTexture()` ist erlaubt, die
    Textur hängt an `includeTextureSize`, und ein Cache machte die zurückgegebene Textur zu
    einer geteilten — genau die Ownership-Frage, die das Finding klären will. Das Lookbook
    bleibt, wie es ist: `animated-billboards.astro:79` und `animated-sprites.astro:106`
    backen je eine Textur für die Lebensdauer der Seite, keine Demo hat einen Abbau, in den
    ein `dispose()` gehörte.
13. **IMPL-001: das TODO wird gestrichen, nicht umgesetzt.** Texturklassen stehen am
    Katalog-Item (`texture`) und als Argument von `TextureAtlasLoader#load()`; eine zweite
    Quelle in `meta` bräuchte eine Vorrangregel, nach der niemand gefragt hat, und
    TexturePacker schreibt dieses Feld nicht.
14. **`TextureStoreData.defaultTextureClasses` wird optional.** `parse()` und die neue
    Prüfung nehmen sein Fehlen hin, und beide Kataloge des Lookbooks (`nobingers.json`,
    `textures.json`) lassen es weg. Für Code, der das Feld liest, ist das ein Typbruch —
    0.x, CHANGELOG und Migration Guide nennen es.
15. **`isTextureOptionClass()` wird öffentlich.** `TextureStore.ts` braucht die Frage
    außerhalb von `TextureFactory.ts`, und `public-api.ts` re-exportiert die Datei mit
    `export *`; ein modulinterner Weg wie in Paket 2 (Symbole in `internals.ts`) passt für
    eine Funktion nicht. Katalog-Autoren können sie selbst benutzen.

## Vorgehen

Zeilenangaben gegen HEAD `724df0eb`. Zuerst `AGENTS.md` im Repo-Root lesen. Zu jedem
Korrektheitsfix erst den Regressionstest schreiben und rot laufen sehen (Schritt 14 nennt,
welche Tests vor dem Fix rot sein müssen); die rote Ausgabe gehört in den Report.

### 1. Neu `packages/twopoint5d/src/texture/resolveRelativeUrl.ts` (BUG-105)

Nicht in `public-api.ts`. Inhalt:

```ts
// what fetch() resolves a relative url against: the document, or in a worker its location
const documentBase = (): string | undefined => {
  if (typeof document !== 'undefined') return document.baseURI;
  if (typeof location !== 'undefined') return location.href;
  return undefined;
};

const isAbsoluteUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * `url` resolved against `base`, the way a url inside a json file names a file next to that
 * file. A relative `base` is itself resolved against the document first.
 *
 * An absolute `url` comes back exactly as written, and so does an empty one. So does every
 * `url` that cannot be resolved: without a `base`, without a document to make a relative
 * `base` absolute, or against a `base` that cannot carry a relative url — a `blob:` or a
 * `data:` url. The browser then resolves it against the document, as it would have anyway.
 */
export const resolveRelativeUrl = (url: string, base: string | URL | undefined): string => {
  if (url === '' || base == null || isAbsoluteUrl(url)) return url;
  try {
    const docBase = documentBase();
    const absoluteBase = docBase != null ? new URL(base, docBase) : new URL(base);
    return new URL(url, absoluteBase).href;
  } catch {
    return url;
  }
};
```

Die Kommentare dürfen umformuliert werden, die Regeln nicht. Kein `URL.canParse` — die
`try`-Form läuft überall, wo die Library läuft.

### 2. Neu `packages/twopoint5d/src/texture/checkTextureStoreData.ts` (SEC-001)

Nicht in `public-api.ts`. Kopfkommentar: die Prüfung des Katalog-JSON, bevor
`TextureStore#parse()` es liest; was sie durchlässt, darf `parse()` lesen, ohne selbst zu
prüfen. Drei Exporte, genau diese Meldungen:

```ts
import {describeValue} from '../utils/describeValue.js';
import {isTextureOptionClass, type TextureOptionClasses} from './TextureFactory.js';
import type {TextureStoreData} from './types.js';

// an object or an array quoted into a message says nothing as `String()` writes it
const describeCatalogValue = (value: unknown): string =>
  Array.isArray(value) ? 'an array' : typeof value === 'object' && value !== null ? 'an object' : describeValue(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function assertTextureStoreData(data: unknown): asserts data is TextureStoreData { … }
export const textureResourceDataProblems = (item: unknown): string[] => { … };
export const partitionTextureClasses = (names: readonly unknown[]): {known: TextureOptionClasses[]; unknown: unknown[]} => { … };
```

`assertTextureStoreData` — eine `function`-Deklaration (eine Arrow-Funktion braucht für
`asserts` eine eigene Typannotation). Wirft `TypeError`, in dieser Reihenfolge, beim ersten
Treffer (`d` = `describeCatalogValue`):

- `data` kein `isPlainObject`:
  ``[TextureStore] parse() got ${d(data)} instead of texture store data, an object with an items object``
- `data.items` kein `isPlainObject`:
  ``[TextureStore] parse() got texture store data whose items is ${d(items)} — items is an object of resource items by id``
- `data.defaultTextureClasses` weder `undefined` noch ein Array:
  ``[TextureStore] parse() got texture store data whose defaultTextureClasses is ${d(value)} — defaultTextureClasses is an array of texture class names``

`textureResourceDataProblems(item)` — die Liste der Probleme eines Items, leer, wenn
`parse()` es lesen kann. Ein Problem ist ein Satzteil ohne Präfix:

- `item` kein `isPlainObject` → nur `` `it is ${d(item)}, not an object` ``, sonst nichts
- für `imageUrl`, `atlasUrl`, `overrideImageUrl` in dieser Reihenfolge: Wert `!== undefined`
  und kein String → `` `${key} is ${d(value)}, not a string` ``
- `tileSet` `!== undefined` und kein `isPlainObject` → `` `tileSet is ${d(value)}, not an object` ``
- `texture` `!== undefined` und kein Array → `` `texture is ${d(value)}, not an array` ``
- `frameBasedAnimations` `!== undefined` und kein `isPlainObject` →
  `` `frameBasedAnimations is ${d(value)}, not an object` ``

Die Werte in `tileSet` prüft `TileSet`, die Einträge von `frameBasedAnimations` prüfen die
Animations-Effekte der Resource — beide melden schon heute; hier nicht nachbauen.

`partitionTextureClasses(names)` — `known`: die Einträge, für die `isTextureOptionClass`
gilt, in ihrer Reihenfolge; `unknown`: der Rest, in seiner Reihenfolge.

### 3. `TextureFactory.ts` — `isTextureOptionClass`, bestimmte Sortierung, Ownership (SEC-001, MEM-015)

- Neu, exportiert, unter `TextureOptionClasses` (Zeile 87):

  ```ts
  /**
   * Whether `name` is one of the {@link TextureOptionClasses} — a name a
   * {@link TextureFactory} applies. For names out of json, such as a texture store catalog.
   */
  export const isTextureOptionClass = (name: unknown): name is TextureOptionClasses =>
    typeof name === 'string' && Object.hasOwn(TextureClasses, name);
  ```

  `Object.hasOwn`, nicht `in`: `'toString' in TextureClasses` ist `true`.
- `getOptions()` Zeile 159: vor dem `.map(...)` ein `.filter(isTextureOptionClass)`, mit
  Kommentar: ein Name, den diese Factory nicht kennt, trägt weder Optionen noch Priorität,
  und seine `undefined`-Priorität machte die Reihenfolge aller anderen Klassen unbestimmt.
  TSDoc an `getOptions()`: »A name that is no texture option class is skipped;
  `TextureStore#parse()` reports such a name when a catalog carries it.« Denselben Satz
  sinngemäß an `create()` und `update()`, die über `getOptions()` gehen.
- Ownership (MEM-015), je ein Satz an `create()`, `load()` (am Implementierungs-Overload
  vorbei an der TSDoc, die heute über den Overloads steht) und `loadAsync()`: »Every call
  builds a new texture and keeps no reference to it: the caller owns it and disposes it.«
  `update()` bekommt ihn nicht — es ändert die Textur des Aufrufers.

### 4. `TextureStore.ts` — `baseUrl`, Prüfung in `parse()`, TSDoc (BUG-105, SEC-001)

- Imports: `assertTextureStoreData`, `textureResourceDataProblems`,
  `partitionTextureClasses` aus `./checkTextureStoreData.js`, `resolveRelativeUrl` aus
  `./resolveRelativeUrl.js`, `type TextureOptionClasses` ist schon da.
- `TextureStoreParseOptions` (Zeile 114) bekommt:

  ```ts
  /**
   * The url the relative `imageUrl`, `atlasUrl` and `overrideImageUrl` of the items are
   * resolved against: the url of the catalog, so that a catalog names the files next to
   * it. A relative `baseUrl` is itself resolved against the document, in a worker against
   * its location. An absolute url of an item stays exactly as written.
   *
   * {@link TextureStore.load} sets it to the url it fetches. Without it `parse()` writes the
   * urls as the data carries them, and the browser resolves them against the document; a
   * base that cannot carry a relative url — a `blob:` or a `data:` url — leaves them as
   * written as well.
   */
  baseUrl?: string | URL;
  ```

- `load()` Zeile 406: `this.parse(data, {...options, baseUrl: options?.baseUrl ?? url});`
- `parse()` Zeile 435–554, neu gegliedert. Die Invariante bleibt: **alles, was die
  Ausführung verweigern kann, läuft vor dem ersten Schreiben und dem ersten Emit.**

  ```ts
  if (this.#disposed) return;

  // the shape the loops below read is checked first: data without an items object is
  // refused whole, before anything is written or emitted
  assertTextureStoreData(data);

  const conflicts: string[] = [];
  // every item that builds nothing this run, with what says why; a resource that already
  // carries its id stays as it is
  const skipped = new Map<string, Error>();

  for (const [id, item] of Object.entries(data.items)) {
    const problems = textureResourceDataProblems(item);
    if (problems.length) {
      skipped.set(id, new Error(`[TextureStore] item "${id}" builds no resource: ${problems.join('; ')}`));
      continue;
    }
    const wanted = …; // wie Zeile 445
    if (wanted == null) {
      skipped.set(id, new Error(`[TextureStore] item "${id}" names no tileSet, atlasUrl or imageUrl and builds no resource`));
      continue;
    }
    // Konfliktprüfung wie Zeile 450–453
  }

  if (conflicts.length) throw …; // wie Zeile 456–458

  const defaults = data.defaultTextureClasses === undefined ? undefined : partitionTextureClasses(data.defaultTextureClasses);
  if (defaults?.known.length) this.defaultTextureClasses = defaults.known;
  if (defaults?.unknown.length) {
    emit(this, OnError, {source: 'parse', error: new Error(`[TextureStore] defaultTextureClasses names ${list(defaults.unknown)}, which no TextureFactory knows — left out`)});
  }

  const itemClasses = new Map<string, TextureOptionClasses[]>();
  for (const [id, item] of Object.entries(data.items)) {
    const why = skipped.get(id);
    if (why) {
      emit(this, OnError, {source: 'parse', id, error: why});
      continue;
    }
    if (item.texture === undefined) continue;
    const {known, unknown} = partitionTextureClasses(item.texture);
    itemClasses.set(id, known);
    if (unknown.length) {
      emit(this, OnError, {source: 'parse', id, error: new Error(`[TextureStore] item "${id}" names ${list(unknown)} in texture, which no TextureFactory knows — left out`)});
    }
  }
  ```

  `list(values)` = `values.map(describeCatalogValue-Äquivalent).join(', ')` — für Strings
  also `"nearset"` in Anführungszeichen; eine lokale Hilfsfunktion oder ein vierter Export
  aus `checkTextureStoreData.ts`, nach Wahl des Implementierers.

  Im `batch()`-Durchlauf (heute Zeile 475):

  - erste Anweisung je Item: `if (skipped.has(id)) { const existing = this.#resources.get(id); if (existing) updatedResources.push(existing); continue; }`
    — das ist das heutige Verhalten eines Items ohne Quelle (die bestehende Resource
    bleibt, wird angekündigt und fällt nicht unter `evictMissing`), jetzt ausdrücklich und
    für beide Gründe. Die Felder eines übersprungenen Items werden nie gelesen: `tileSet:
    5` wäre sonst truthy.
  - `const textureClasses = joinTextureClasses(this.defaultTextureClasses, itemClasses.get(id));`
  - die URLs vor dem Schreiben auflösen, mit `const baseUrl = options?.baseUrl;` und einer
    lokalen Hilfe `const resolve = (url: string | undefined) => (url === undefined ? undefined : resolveRelativeUrl(url, baseUrl));`
    — für `item.imageUrl` (Zeilen 485, 491, 515, 519), `item.atlasUrl` (497, 505) und
    `item.overrideImageUrl` (498, 506). `fromImage()` und `fromAtlas()` verlangen einen
    `string`: wo der Zweig die URL schon verengt hat (`item.atlasUrl` in 505,
    `item.imageUrl` in 519), direkt `resolveRelativeUrl(item.atlasUrl, baseUrl)` statt der
    Hilfe, deren Rückgabetyp `string | undefined` ist.
  - Der Kommentar Zeile 544–546 zu `evictMissing` nennt beide Gründe, aus denen ein Item
    nichts baut.

- TSDoc:
  - `TextureStoreEvents`, Zeile 62–67: `parse` deckt »a body that is no JSON, a `parse()`
    that threw — data without an items object among it —, an item that builds no resource
    because it names no source or carries a field of the wrong type, and texture class
    names no `TextureFactory` knows, which are left out«.
  - statisches `load()`, Zeile 134–146: zu den Ablehnungen kommen ein Item mit einem Feld
    falschen Typs und ein Klassenname, den keine `TextureFactory` kennt; dazu ein Satz, dass
    relative URLs der Items gegen `url` aufgelöst werden.
  - instanz-`load()`, Zeile 357–375: relative URLs der Items gegen `url`, mit Verweis auf
    `TextureStoreParseOptions.baseUrl`.
  - `parse()`, Zeile 414–434: die Prüfung in zwei Ebenen (was wirft, was als `error`
    hinausgeht), die bereinigten Klassennamen, `options.baseUrl`, und die
    Vertrauensgrenze, sinngemäß: »The data is configuration, trusted as far as these checks
    do not reach: a `frameNameQuery` is compiled into a `RegExp` and run against every
    frame name of its atlas, and a pattern that backtracks catastrophically stalls the
    page. Check a catalog from a source you do not control before handing it in.«

### 5. `types.ts` (SEC-001, BUG-105, BUG-106)

- `TextureStoreData.defaultTextureClasses?: TextureOptionClasses[]` — optional, mit TSDoc:
  die Klassen, mit denen jede Resource beginnt; ein Name, den keine `TextureFactory` kennt,
  wird von `parse()` weggelassen und gemeldet.
- `TextureResourceData`: TSDoc an `imageUrl`, `overrideImageUrl`, `atlasUrl`: relativ zur
  URL des Katalogs, wenn `TextureStore#load()` ihn holt (bzw. zu `baseUrl`); an
  `texture`: unbekannte Namen werden weggelassen und gemeldet.
- `FrameBasedAnimationsDataByTileIds.tileIds`: »whole numbers«;
  `FrameBasedAnimationsDataByTileCount.firstTileId`: »a whole number«, `.tileCount`: »a
  whole number from 1 to `FrameBasedAnimations.MaxTextureSize`«;
  `FrameBasedAnimationsDataByAtlas.frameNameQuery`: bleibt ein regulärer Ausdruck, dazu
  der Satz zur Vertrauensgrenze (kürzer als in `parse()`).

### 6. `TextureResource.ts` — `meta.image` gegen die `atlasUrl` (BUG-105), `tileIds` ohne Array (Nebenbefund, Schritt 9)

- Import `resolveRelativeUrl` aus `./resolveRelativeUrl.js`.
- Fetch-Effekt, Zeile 799: statt `fetchedAtlasJsonSignal.set(atlasJson);`

  ```ts
  // a relative image name is a file next to the atlas json, and `atlasUrl` here is the url
  // this very json came from — the effect that picks the image may already see the next one
  const image = atlasJson.meta.image;
  fetchedAtlasJsonSignal.set(
    typeof image === 'string' ? {...atlasJson, meta: {...atlasJson.meta, image: resolveRelativeUrl(image, atlasUrl)}} : atlasJson,
  );
  ```

- Kommentar an `#fetchedAtlasJson` (Zeile 281): »the json as `atlasUrl` delivered it, with a
  relative `meta.image` resolved against that url, but without the `overrideImageUrl` put
  in its place«.
- TSDoc `atlasJson`, Zeile 361–370: für eine gefetchte Json ist ein relatives `meta.image`
  gegen `atlasUrl` aufgelöst; eine von außen geschriebene behält ihr `meta.image`, wie es
  ist, und der Bildlader löst ein relatives gegen das Dokument auf. `overrideImageUrl` wird
  genommen, wie es geschrieben ist.
- Tile-Set-Animationseffekt, Zeile 729–734, direkt nach der Shape-Prüfung: ein Eintrag der
  Shape `tileIds`, dessen `tileIds` kein Array ist, wird übersprungen und gemeldet, statt
  an `add()` zu gehen — `add()` läse eine Zahl dort als `firstTileId` (Zeile 221–226):

  ```ts
  const tileIds: unknown = shape === 'tileIds' ? (data as {tileIds: unknown}).tileIds : undefined;
  if (shape === 'tileIds' && !Array.isArray(tileIds)) {
    emit(this, OnError, {
      source: 'frameBasedAnimations',
      id: this.id,
      animation: name,
      error: new Error(`[TextureResource] animation "${name}" of resource "${this.id}" carries tileIds of ${describeValue(tileIds)} — tileIds is an array of tile ids`),
    });
    continue;
  }
  ```

  Import `describeValue` aus `../utils/describeValue.js`. Die Form des Zugriffs darf der
  Implementierer glätten; der Cast behauptet nicht mehr als `unknown`, und die Meldung
  bleibt wörtlich.
- TSDoc `TextureResourceEvents`, Zeile 90–94: die Aufzählung der übersprungenen Einträge
  ersetzt »an empty tile range« durch das, was jetzt gilt: Daten, die die Animation nicht
  bauen lassen — kein `duration` und kein `frameRate`, ein `frameRate` von 0, `tileIds`
  ohne Array, eine Tile-id, `firstTileId` oder `tileCount`, die `add()` zurückweist, eine
  `frameNameQuery`, die weder String noch `RegExp` ist —, und Einträge, deren Frames leer
  bleiben: eine `frameNameQuery` ohne Treffer, eine leere Liste von `tileIds`.

Den Fetch-Effekt darüber hinaus nicht anfassen: der Abbruch eines laufenden Fetches durch
den `atlasJson`-Setter ist Paket 8.

### 7. `TextureAtlasLoader.ts` (BUG-105, MEM-015)

- Import `resolveRelativeUrl` aus `./resolveRelativeUrl.js`.
- Zeile 55: `const imageUrl = options?.overrideImageUrl ?? (typeof jsonData.meta.image === 'string' ? resolveRelativeUrl(jsonData.meta.image, url) : undefined);`
  — die Prüfung Zeile 56 bleibt. Basis ist das `url`, das `load()` bekommt.
- `TextureAtlasLoadOptions.overrideImageUrl` (Zeile 15–16): »taken as written, not
  resolved against the atlas url«.
- TSDoc an `load()` und `loadAsync()` (heute keine): was sie liefern; ein relatives
  `meta.image` wird gegen `url` aufgelöst; Ownership: »The texture handed out is built for
  this call and kept by no one else: the caller owns it and disposes it.«

### 8. `FrameBasedAnimations.ts` — Grenzen in `add()` (BUG-106, SEC-001), Ownership (MEM-015)

Alle Meldungen im Format aus Paket 1 (`describeValue`, `animNameInError(name)`; `name` ist
an dieser Stelle der übergebene, der anonyme Name wird erst danach vergeben):

- TileSet-Zweig mit Array (Zeile 221–223), vor dem `map`: jedes Element
  `Number.isInteger`, sonst
  ``FrameBasedAnimations: add() got a tileId of ${describeValue(tileId)} at index ${index} for the animation `${animNameInError(name)}` — a tileId is a whole number``
- TileSet-Zweig mit Bereich (Zeile 224–231), vor der Schleife, nur für übergebene Werte
  (`args[3] !== undefined` bzw. `args[4] !== undefined`):
  - ``FrameBasedAnimations: add() got a firstTileId of ${describeValue(firstTileId)} for the animation `…` — a firstTileId is a whole number``
    für `!Number.isInteger(firstTileId)`
  - ``FrameBasedAnimations: add() got a tileCount of ${describeValue(tileCount)} for the animation `…` — a tileCount is a whole number from 1 to ${FrameBasedAnimations.MaxTextureSize}``
    für `!Number.isInteger(tileCount) || tileCount < 1 || tileCount > FrameBasedAnimations.MaxTextureSize`
- Atlas-Zweig (Zeile 205): ein `args[3]`, das `!== undefined`, kein String und keine
  `RegExp` ist, wirft
  ``FrameBasedAnimations: add() got a frameNameQuery of ${describeValue(query)} for the animation `…` — a frameNameQuery is a string or a RegExp``;
  danach ist die Query ein String, eine `RegExp` oder `undefined`, und der Kommentar Zeile
  202–204 sagt das statt »letting one of them fall away«.
- TSDoc `add()`, Absatz Zeile 160–164: die neuen Ablehnungen aufzählen; und dass
  `firstTileId` und `tileCount` nur geprüft werden, wenn sie übergeben sind.
- TSDoc `bakeDataTexture()` (heute keine): »Every call builds a new `DataTexture` and keeps
  no reference to it: the caller owns it and disposes it. A material it is handed to as
  `animsMap` borrows it and does not dispose it.«

Kein Test mit `tileCount: 1e9` oder ähnlich vor dem Fix: die Schleife liefe bis zum
Speicherende. Der rote Lauf nimmt `FrameBasedAnimations.MaxTextureSize + 1`.

### 9. `TileSet.ts` — `firstId` (Nebenbefund, gleiche Ursache wie BUG-106)

- In `#createTextureCoords` (Zeile 169–186) als letzte Prüfung:
  `assertOption(Number.isInteger(this.firstId), 'firstId', 'a whole number', this.firstId);`
  — Meldung damit `[TileSet] firstId must be a whole number, got "1"`.
- `TileSetOptions.firstId` (Zeile 49) bekommt TSDoc wie seine Nachbarn: »The `tileId` of
  the first tile — a whole number. Defaults to 1.« Die `@throws`-Zeile am Konstruktor
  (Zeile 76–78) nennt `firstId`.

### 10. Ownership in den übrigen Loadern (MEM-015)

`TextureImageLoader#load()`/`loadAsync()` und `TileSetLoader#load()`/`loadAsync()`
bekommen TSDoc (heute keine): was sie liefern, und der Ownership-Satz aus Schritt 7.
`PowerOf2ImageLoader` gibt ein Bild oder ein Canvas heraus, keine GPU-Resource — bleibt.

### 11. `TexturePackerJson.ts` (IMPL-001)

Zeile 19 `// TODO add textureOptions: TextureClasses[]` streichen. Danach gibt
`grep -rn TODO packages/twopoint5d/src --include=*.ts` außerhalb der Specs nichts mehr aus.

### 12. `packages/twopoint5d/docs/resource-lifecycle.md` §1 (MEM-015)

Nach dem Absatz, der mit »Handing a resource out does not transfer it either; returning a
pool from a getter keeps you the owner.« endet (Zeile 12–14), ein neuer Absatz:

> **What a method builds for its caller and keeps no reference to belongs to the caller.**
> The loaders of the texture module — `TextureImageLoader`, `TileSetLoader`,
> `TextureAtlasLoader` —, `TextureFactory#create()`, `#load()` and `#loadAsync()`, and
> `FrameBasedAnimations#bakeDataTexture()` build a new texture on every call and have no
> `dispose()` of their own: whoever called them disposes what came back.
> [`TextureResource`](../src/texture/TextureResource.ts) is the other case — it keeps the
> texture it built and disposes it itself, and a subscriber of `TextureStore` only
> borrows it.

Links im Stil des Dokuments (relativ, `../src/…`). Kein `ts check`-Block.

### 13. Lookbook und Browser-Test (BUG-105)

- `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro:92-98`: das
  Options-Objekt mit `overrideImageUrl` fällt weg, der Aufruf wird
  `new TextureAtlasLoader().loadAsync(assetsUrl('lab-walls-tiles.json'), ['nearest', 'srgb'])`.
  `lab-walls-tiles.json` nennt `"image": "lab-walls-tiles.png"` — die Datei daneben.
- `apps/lookbook/public/assets/textures.json:13`: die Zeile `"overrideImageUrl": …` des
  Items `splotchs` fällt weg (`splotchs-256x.json` nennt `splotchs-256x.png`, die Datei
  daneben); das Komma der Zeile davor mit.
- `packages/twopoint5d-testing/test/texture-store-on.test.js`: beim Item `fire`
  (Zeile 71–77) fällt `overrideImageUrl` weg, die Konstante `FIRE_ATLAS_IMG` (Zeile 20) mit;
  `balls` behält sein `overrideImageUrl`, damit der Override im Browser gedeckt bleibt. Der
  Test `on(id, "frameBasedAnimations") (frameNameQuery) delivers atlas-based animations`
  (Zeile 335–350) prüft zusätzlich:
  `expect((await store.whenResource('fire')).imageUrl).to.equal(new URL(\`${ASSET_BASE}/fire-particles.png\`, document.baseURI).href);`
  — der Katalog kommt über eine `blob:`-URL, `atlasUrl` bleibt deshalb, wie geschrieben,
  und `meta.image` wird gegen sie und das Dokument aufgelöst.

### 14. Specs

Konventionen aus Paket 1: jeder `describe`-Name sagt, was er prüft; jeder Wurf wird an
seiner Meldung gehalten (`toThrow('<exakte Meldung>')` oder `toThrowError(new TypeError(…))`),
nicht nur an seiner Klasse. `document` wird mit `vi.stubGlobal('document', {baseURI: …})`
gestellt und in `afterEach(() => vi.unstubAllGlobals())` zurückgenommen, wie in
`PowerOf2ImageLoader.spec.ts:6-8`. Fetch-Mocks wie in `TextureResource.spec.ts:328`.
**(rot)** heißt: vor dem Fix rot, die Ausgabe gehört in den Report.

`resolveRelativeUrl.spec.ts` (neu), `describe('resolveRelativeUrl resolves a url out of a json file against that file')`:

- a relative url against an absolute base (`'a.png'`, `'../img/b.png'`, `'/root.png'`,
  `'//cdn.example.test/c.png'` gegen `'http://example.test/assets/catalog.json'`)
- an absolute url comes back exactly as written (`'HTTP://Example.test/A%20b.png'` bleibt
  genau so), `'data:image/png;base64,AAAA'` ebenso, `''` bleibt `''`
- without a base the url stays as written
- a relative base is resolved against `document.baseURI` (gestubbt); without a document it
  leaves the url as written
- a `blob:` base leaves the url as written

`TextureFactory.spec.ts`:

- `isTextureOptionClass` answers true for every class name and false for `'nearset'`,
  `'toString'`, `5`, `undefined`
- **(rot)** `getOptions() skips a name that is no texture option class and orders the rest
  as if it were not there` — `getOptions(['linear', 'nearset' as never, 'mag-nearest'])`
  gleich `getOptions(['linear', 'mag-nearest'])`

`TextureStore.spec.ts`, neuer `describe('parse() checks catalog data before it writes anything')`:

- **(rot)** data without `items` (`{defaultTextureClasses: []}`) throws the `TypeError`
  naming `items is undefined`; ebenso `{items: null}` (`items is null`) und `{items: []}`
  (`items is an array`) — das ist der Testpunkt von TEST-016 »fehlendes `items`«
- **(rot)** data that is no object (`parse(null as never)`) throws the `TypeError` naming
  `null`
- **(rot)** a `defaultTextureClasses` that is no array (`'nearest'`) throws, and neither
  a resource nor `defaultTextureClasses` nor an event has changed
- **(rot)** an item that is no object (`{a: null}`) builds no resource and goes out as a
  parse error with its id and the message ``[TextureStore] item "a" builds no resource: it is null, not an object``;
  the other items of the same data are built
- **(rot)** an item with `imageUrl: 5` builds no resource (Meldung nennt
  `imageUrl is 5, not a string`); ebenso `tileSet: true` (`tileSet is true, not an
  object`) und `texture: 'srgb'` (`texture is "srgb", not an array`); ein Item mit zwei
  Problemen nennt beide, durch `; ` getrennt
- **(rot)** a malformed item leaves the resource that already carries its id as it was —
  zweites `parse()` mit `{a: {imageUrl: 5}}` nach `{a: {imageUrl: 'a.png'}}`:
  `imageUrl` bleibt `'a.png'`, und mit `{evictMissing: true}` wird sie nicht entfernt
- a type conflict still throws before any parse error of a malformed item goes out
  (Konflikt plus kaputtes Item in denselben Daten: Wurf, kein Event)
- **(rot)** a texture class no TextureFactory knows is left out and reported with the item
  id — `texture: ['nearset', 'srgb']` → `resource.textureClasses` enthält `srgb`, nicht
  `nearset`; ein Event ``[TextureStore] item "a" names "nearset" in texture, which no TextureFactory knows — left out`` —
  das ist der Testpunkt von TEST-016 »unbekannter Klassenname«
- **(rot)** a default texture class no TextureFactory knows is left out and reported —
  `defaultTextureClasses: ['nearset', 'linear']` → `store.defaultTextureClasses` gleich
  `['linear']`, ein Event ohne `id`; `['nearset']` allein lässt die bisherigen Defaults
  stehen
- **(rot)** `TextureStore.load()` rejects a catalog that names an unknown texture class,
  naming the parse step

`TextureStore.spec.ts`, neuer `describe('load() resolves the relative urls of a catalog against the catalog')`:

- **(rot)** `store.load('http://example.test/assets/catalog.json')` mit Items
  `{a: {imageUrl: 'a.png'}, b: {atlasUrl: 'atlas/b.json', overrideImageUrl: '../img/b.png'}}`
  → `a.imageUrl` `'http://example.test/assets/a.png'`, `b.atlasUrl`
  `'http://example.test/assets/atlas/b.json'`, `b.overrideImageUrl`
  `'http://example.test/img/b.png'`
- an absolute item url stays exactly as written
- **(rot)** a relative catalog url is resolved against the document first (gestubbt
  `baseURI` `'http://example.test/demo/page.html'`, `load('assets/catalog.json')` →
  `'http://example.test/demo/assets/a.png'`)
- a catalog behind a `blob:` url leaves relative item urls as written
- **(rot)** `parse(data, {baseUrl})` resolves against `baseUrl`; `parse(data)` without one
  writes the urls as the data carries them

Bestehende Tests, die nach `store.load('http://example.test/…')` oder
`TextureStore.load('http://example.test/…')` eine relative URL zurücklesen (etwa um Zeile
1535), lesen jetzt die aufgelöste — mitziehen, nicht abschwächen.

`TextureResource.spec.ts`:

- **(rot)** an atlas resolves a relative `meta.image` against its `atlasUrl` —
  `fromAtlas('a', 'http://example.test/atlases/a.json')`, Json mit `meta.image: 'a.png'` →
  `imageUrl` und `atlasJson.meta.image` sind `'http://example.test/atlases/a.png'`, und
  der Bildlader bekommt diese URL
- an `overrideImageUrl` is taken as written, not resolved against the `atlasUrl`
- an `atlasJson` written from outside keeps its `meta.image` as written
- **(rot)** a relative `atlasUrl` is resolved against the document before it serves as the
  base (gestubbtes `document`)
- **(rot)** an animation entry whose `tileIds` is no array is skipped and reported, the
  other entries of the map are registered
- **(rot)** an animation entry with a `tileCount` of `"5"` is skipped and reported with the
  message of `add()`, the other entries are registered

`TextureAtlasLoader.spec.ts`:

- **(rot)** a relative `meta.image` is resolved against the url of the atlas json — Muster
  des Tests Zeile 229–249, mit `url` `'http://example.test/atlases/sprites.json'` und
  `meta.image` `'sprites.png'` → der Bildlader bekommt
  `'http://example.test/atlases/sprites.png'`, `meta.image` im Ergebnis ebenso
- an `overrideImageUrl` is taken as written

`FrameBasedAnimations.spec.ts`, neuer `describe('add() refuses tile ids, a first tile id, a tile count and a frame name query that cannot pick frames')`:

- **(rot)** a `tileCount` of `'5'`, `2.5`, `NaN` and `FrameBasedAnimations.MaxTextureSize + 1`
  each throw the exact message; **(rot)** `0` throws the tileCount message, not the one
  about no frames
- **(rot)** a `firstTileId` of `'1'` and of `1.5` throw
- **(rot)** a tile id of `'2'` at index 1 and one of `1.5` throw, naming the index
- a negative `firstTileId` and a negative tile id are accepted (the tile set wraps them)
- a tile set with more tiles than `MaxTextureSize` is accepted without `tileCount`
  (TileSet aus 1×1-Tiles über `TextureCoords(0, 0, 200, 100)` = 20000 Tiles; `add(name, 1,
  tileSet)` wirft nicht)
- **(rot)** a `frameNameQuery` of `5` throws instead of taking every frame of the atlas

`TileSet.spec.ts`:

- **(rot)** a `firstId` that is no whole number (`'1'`, `1.5`, `NaN`) is refused with
  `[TileSet] firstId must be a whole number, got …`; a negative `firstId` is accepted

### 15. CHANGELOG `packages/twopoint5d/CHANGELOG.md`

Über den Skill `updating-changelog`, unter `[Unreleased]`, ohne Finding-IDs, ohne
Rückblick in Code und Doku (im CHANGELOG ist »was sich ändert« der Gegenstand):

- Added: `TextureStoreParseOptions.baseUrl`; `isTextureOptionClass()`.
- Changed: `TextureStore#load()` und das statische `TextureStore.load()` lösen relative
  `imageUrl`, `atlasUrl`, `overrideImageUrl` der Items gegen die Katalog-URL auf, absolute
  bleiben, `blob:`/`data:`-Kataloge lassen sie stehen; eine Atlas-Resource und
  `TextureAtlasLoader` lösen ein relatives `meta.image` gegen die URL der Atlas-Json auf,
  `overrideImageUrl` wird genommen, wie es steht; `parse()` prüft die Daten (Wurf für die
  ganze Form, `error` je Item, unbekannte Klassen weggelassen und gemeldet, der statische
  `load()` rejectet auf jede dieser Meldungen); `TextureStoreData.defaultTextureClasses`
  ist optional; `TextureFactory#getOptions()` überspringt fremde Namen.
- Fixed: `FrameBasedAnimations#add()` weist `tileCount`, `firstTileId`, Tile-ids und
  `frameNameQuery` zurück, die keine Frames wählen können — mit den Meldungen; eine
  `TextureResource` überspringt einen solchen Eintrag und einen mit `tileIds` ohne Array
  und meldet ihn; `TileSet` weist ein `firstId` zurück, das keine ganze Zahl ist.
- Migration Guide: ein Abschnitt »Relative urls of a catalog resolve against the catalog«
  — wer Item-URLs relativ zum Dokument geschrieben hat, während der Katalog woanders
  liegt, schreibt sie relativ zum Katalog oder absolut; ein `overrideImageUrl`, das nur
  auf die Datei neben der Atlas-Json zeigte, kann weg. Ein zweiter, kurzer Abschnitt zu
  `defaultTextureClasses?` für Code, der `TextureStoreData` liest.
- Ownership (MEM-015) ist Doku ohne Verhaltensänderung und bekommt keinen Eintrag;
  ebenso das gestrichene TODO.

### 16. Deklarationen prüfen

Nach `pnpm build:twopoint5d`: `dist/lib/texture/TextureFactory.d.ts` zeigt
`isTextureOptionClass`, `dist/lib/texture/TextureStore.d.ts` `baseUrl`; weder
`resolveRelativeUrl` noch `assertTextureStoreData` erscheinen in
`dist/lib/texture/public-api.d.ts` oder über `dist/lib/index.d.ts`.

## Für Zug 5: Zeilen für den Plan

`Schnittstellen:` unter Paket 3 muss mindestens nennen — Paket 8 (Atlas-Fetch) und Paket 6
(API-Linie, `AbortSignal` für `load()`) bauen darauf:

- `TextureStoreParseOptions.baseUrl?: string | URL` (öffentlich); `TextureStore#load(url)`
  reicht `url` als `baseUrl` an `parse()`, sofern der Aufrufer keinen eigenen übergibt
- `isTextureOptionClass(name: unknown): name is TextureOptionClasses` aus
  `TextureFactory.ts` (öffentlich); `getOptions()` überspringt fremde Namen
- `TextureStoreData.defaultTextureClasses` optional
- intern, nicht in `public-api.ts`: `resolveRelativeUrl(url, base)` in
  `src/texture/resolveRelativeUrl.ts`; `assertTextureStoreData`,
  `textureResourceDataProblems`, `partitionTextureClasses` in
  `src/texture/checkTextureStoreData.ts`
- `#fetchedAtlasJson` einer Resource trägt `meta.image` schon gegen die `atlasUrl` des
  Fetches aufgelöst
- Meldungen von `FrameBasedAnimations#add()` für `tileId`, `firstTileId`, `tileCount`,
  `frameNameQuery` im Format aus Paket 1; `TileSet` wirft
  `[TileSet] firstId must be a whole number, got …`

## Abgleich (Zug 0, 2026-09-26, gegen HEAD `724df0eb`)

- **BUG-105** unverändert, verschoben — die Json geht ungeändert in `#fetchedAtlasJson`
  (`TextureResource.ts:799`, Audit `:784`), der Bild-Effekt nimmt `this.overrideImageUrl ??
  fetched.meta.image` (`:819`, Audit `:754`); `TextureAtlasLoader.ts:55` unverändert;
  `TextureStore#parse()` schreibt die URLs der Items unverändert (`:485, 491, 497-498,
  503-509, 515, 519`, Audit `:431-432`), `load()` reicht `parse()` keine URL
  (`:376-411`). Workaround im Lookbook: `textured-quads-from-texture-atlas.astro:96`,
  `public/assets/textures.json:13`; der Browser-Test trägt ihn bei `fire` und `balls`
  (`texture-store-on.test.js:69, 73`).
- **BUG-106** unverändert, verschoben — `FrameBasedAnimations.ts:224-231` (Audit
  `:213-219`): `firstTileId + tileCount` ungeprüft, `tileCount: "5"` ergibt
  `1 + "5"` = `"15"`; Tile-ids `:221-223` ungeprüft; der Resource-Aufruf steht jetzt
  `TextureResource.ts:738-741` (Audit `:677`). Die Größenprüfung sitzt weiter erst in
  `getBufferSize()` (`:94-107`).
- **SEC-001** unverändert, umgeformt — `parse()` liest `Object.entries(data.items)`
  ungeprüft (`TextureStore.ts:444, 475`, Audit `:381-383`), fehlendes `items` gibt einen
  nichtssagenden `TypeError`; Klassennamen gehen ungefiltert in `joinTextureClasses`
  (`:478`) und von dort an `TextureFactory#getOptions()`, wo `TextureClassPriority[name]`
  `undefined` ist und die Sortierung `NaN` sieht (`TextureFactory.ts:160-161`, unverändert).
  Seit Paket 2 schreibt `parse()` die Default-Klassen erst nach der Konfliktprüfung
  (`:460-462`); Items ohne Quelle gehen schon als `error` hinaus (`:464-470`). Die Query:
  `FrameBasedAnimations.ts:205` lässt eine Nicht-String-Query zu `undefined` werden (alle
  Frames), `TextureAtlas.ts:298` kompiliert sie mit `new RegExp`.
- **MEM-015** unverändert — kein Ownership-Satz an `FrameBasedAnimations#bakeDataTexture()`
  (`:304`, Audit `:292`), `TextureImageLoader.ts:28`, `TileSetLoader.ts:30`,
  `TextureAtlasLoader.ts:37`; dieselbe Lücke an `TextureFactory#create()`/`load()`/
  `loadAsync()` (`:168, 190-192, 217`), mitgenommen. Lookbook: je ein
  `bakeDataTexture()` in `animated-billboards.astro:79`, `animated-sprites.astro:106`.
- **IMPL-001** unverändert — `TexturePackerJson.ts:19`; `grep -rn TODO
  packages/twopoint5d/src --include=*.ts` außerhalb der Specs findet nur diesen.
- **TEST-016** (Anteil dieses Pakets) — `TextureStore.spec.ts` hat keinen Test für
  `parse()` ohne `items` oder mit unbekanntem Klassennamen; beide entstehen hier
  (Schritt 14).

## Triage in Zug 0

- `Folgen:` von Paket 2, erste — ein Atlas-Fetch, der beim Schreiben von `atlasJson` noch
  läuft und danach scheitert, legt über `#fail('atlasFetch', …)` (`TextureResource.ts:779,
  791, 802`) wieder einen Record an; ein `get(id, 'atlas')` rejectet zu Unrecht, die
  `get()`-TSDoc `TextureStore.ts:697-699` sagt zu viel. Einordnung: **Symptom** von
  Paket 2 — der Setter räumt den Record (`:383`), bricht den Fetch aber nicht ab; hätte
  Paket 2 das zu Ende gebracht, gäbe es den Eintrag nicht. Paket 2 ist committet, also
  **Nachtragspaket 8** mit `Folge von: Paket 2`. Nicht in Paket 3: andere Ursache.
- `Folgen:` von Paket 2, zweite (klein) — der `.catch` des Image-Effekts
  (`TextureResource.ts:642-651`) trägt den Wurf eines Subscribers aus dem `batch()` als
  `#fail('image', {source: 'texture'})` ein; der Record hält alle Subtypes zurück, obwohl
  Texture und Koordinaten veröffentlicht sind. Vor Paket 2 ging derselbe Wurf nur als
  Event hinaus (`git show fceda80b:…/TextureResource.ts`, `.catch` ohne Record). Einordnung:
  **Symptom** von Paket 2 derselben Ursache wie die erste — der Record steht für etwas, das
  kein ladeabschließender Fehler des laufenden Schritts ist. Der Vorschlag des Reviewers,
  ihn in der Zerlegung von Paket 5 mitzunehmen, fällt: Paket 5 ist ein Umbau, der Fix ist
  ein Korrektheitsfix mit eigenem Regressionstest, und die Regel für ein Symptom eines
  committeten Pakets ist das Nachtragspaket. **→ Paket 8.**
- »Offene Befunde« — `TextureResource.ts:799,838` (spät gelingender Fetch überschreibt eine
  von außen geschriebene Json, vorbestehend) hat dieselbe Ursache wie die erste Folge: der
  Setter bricht den Fetch nicht ab. **→ in Paket 8 aufgenommen.** Die übrigen Einträge
  teilen keine Ursache mit Paket 3 und bleiben liegen: `onResource()`-TSDoc (Zustellung),
  verirrter Resource-Test und falscher Spec-Kommentar (Store-Spec), überlange Zeilen
  (`TextureResource.ts:167,185`, Meldungstexte), `stage`- und `map2d`-Einträge (→ Audit).
- Neu, vorbestehend, **in Paket 3 aufgenommen** (gleiche Ursache wie BUG-106: Zahlen und
  Formen aus dem Katalog erreichen Arithmetik ungeprüft):
  - `TileSet.ts:106-108` — `firstId` wird nie geprüft; `firstId: "1"` macht
    `randomTileId()` zu `"1" + rand(…)`, eine Zeichenkette (`git show
    fceda80b:…/TileSet.ts:107-108, 146`). Schritt 9.
  - `TextureResource.ts:737-738` mit `FrameBasedAnimations.ts:221-226` — ein `tileIds`, das
    kein Array ist, liest `add()` als `firstTileId` und baut still eine Animation über das
    ganze Tile-Set (`git show fceda80b:…/TextureResource.ts:674`,
    `…/FrameBasedAnimations.ts:209`). Schritt 6.
- Neu, vorbestehend, **in »Offene Befunde«** (andere Ursache):
  - `FrameBasedAnimations.ts:193,233` — zwei Ablehnungen von `add()` ohne das Präfix
    `FrameBasedAnimations: add()` der übrigen (`name='…' must be unique!`, `add(): the
    third argument must be …`); `fceda80b:…/FrameBasedAnimations.ts:181,221` · info →
    Scope (Domain texture). Keine gemeinsame Ursache mit BUG-106 (fehlende Prüfung), hier
    ist es das Meldungsformat.
  - `apps/lookbook/public/assets/textures.json` — ein Katalog, den keine Seite des
    Lookbooks lädt (`git grep textures.json` findet keinen Verbraucher, an `fceda80b`
    ebenso) · info → Scope (Lookbook-Stelle, die texture benutzt). Paket 3 streicht dort
    trotzdem das Workaround-`overrideImageUrl` — ob die Datei bleibt, entscheidet die
    Drain-Runde.

## Verlauf

- 2026-09-26 Zug 0: Detailplan steht · BUG-105, BUG-106, SEC-001, MEM-015 unverändert, an
  neue Zeilen verschoben (`TextureResource.ts:799, 819`, `FrameBasedAnimations.ts:224-231`,
  `TextureStore.ts:444, 478`, `FrameBasedAnimations.ts:304`), IMPL-001 unverändert
  (`TexturePackerJson.ts:19`) · beide Folgen aus Paket 2 als Symptome → neues
  Nachtragspaket 8 (mit dem Nebenbefund `TextureResource.ts:799,838`), eingereiht nach
  Paket 3 · zwei vorbestehende Nebenbefunde gleicher Ursache ins Paket (`TileSet.ts`
  `firstId`, `tileIds` ohne Array) · zwei neue in »Offene Befunde« (→ Scope) · Restplan:
  Paket 5 hängt zusätzlich von 8 ab, Paket 4 jetzt von 3 (`TileSet.ts`,
  `TexturePackerJson.ts`, `TextureAtlasLoader.ts`); Reihenfolge 3 → 8 → 4 → 7 → 5 → 6
- 2026-09-26 Zug 1: Implementierer beauftragt (Runde 0, opus/high, Session
  `remediate-twopoint5d-p3-impl-0`, Report `paket-3.impl-0.json` im Arbeitsverzeichnis)
- 2026-09-26 Zug 2: Report FERTIG (54 Tests vor dem Fix rot) · 3 neue Dateien
  (`resolveRelativeUrl.ts`, `resolveRelativeUrl.spec.ts`, `checkTextureStoreData.ts`), 21 geänderte in
  `src/texture/`, Doku, CHANGELOG, Lookbook, Browser-Test · Arbeitsbaum schmutzig · Verify
  `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 (`paket-3.verify.log`)
- 2026-09-26 Zug 3: Reviewer (opus/high, `paket-3.review-0.json`): alle 5 Findings, beide
  TEST-016-Testpunkte und beide Nebenbefunde erfüllt · 4 wichtig (TSDoc `defaultTextureClasses`
  `TextureStore.ts:212-214`, CHANGELOG `:215` widerspricht `:218`, Rückblick-Nebensätze CHANGELOG
  `:378-379`, `TextureAtlasLoader.ts:65-67` löst `meta.image` ohne `fileLoader.path` auf) · 4 klein
  (Commit-Message unvollständig, Kommentar `TextureResource.ts:864`, doppelte Prüfung `:745-746`,
  describe-Namen `TileSet.spec.ts:182`, `TextureFactory.spec.ts:153`) · Diff `paket-3.diff`
- 2026-09-26 Zug 4, Runde 1: offen die 4 wichtig + 3 klein im Code (Commit-Message zieht B
  selbst nach) · Entscheidung zu `fileLoader.path`: Basis `fileLoader.path + url`, Bildlader-`path`
  dokumentiert · an denselben Implementierer per Resume (`c029791f…`, opus/high), Report
  `paket-3.impl-1.json`
  - zurück: FERTIG, alle 7 bearbeitet · Regressionstest `a relative meta.image is resolved against
    the url the json came from, path of the file loader included` (vor dem Fix rot) · Verify
    exit=0 (`paket-3.verify.log`, der Lauf aus Zug 2 jetzt `paket-3.verify-0.log`) · Diff
    `paket-3.round-1.diff` · Reviewer per Resume (`ea4a692b…`), Report `paket-3.review-1.json`
  - Reviewer: alle 8 Befunde aus Runde 0 erledigt, nichts beschädigt · 2 neue klein (Umbruch
    `TextureStore.ts:215-216`, `fileLoader.path` ohne `?? ''` `TextureAtlasLoader.ts:72`) · Fortschritt,
    nichts Auslösendes offen, Kette endet
- 2026-09-26 Zug 5: Commit `62c99ce1` (24 Dateien) · Verify `paket-3.verify.log` exit=0, jünger als
  die letzte Codeänderung · Plan: Paket 3 auf `[x]`, 2 Nebenbefunde nach »Offene Befunde«

## Findings im Volltext

**BUG-105 · medium · packages/twopoint5d/src/texture/TextureResource.ts:754** (auch
`TextureResource.ts:784`, `TextureAtlasLoader.ts:55`, `TextureStore.ts:431-432`) — Bild-URLs
aus Atlas- und Katalog-JSON relativ zur JSON-URL auflösen
`meta.image` geht unverändert an `ImageLoader` bzw. `fetch`. TexturePacker schreibt dort
einen relativen Dateinamen, das gilt für alle Atlanten im Lookbook. Liegt der Atlas unter
`/assets/x.json` und die Seite unter `/demos/y`, wird `/demos/lab-walls-tiles.png` geladen.
Das Lookbook umgeht das mit `overrideImageUrl`. Dasselbe gilt für `imageUrl`/`atlasUrl` der
Katalog-Items.
Empfehlung: `new URL(meta.image, new URL(atlasUrl, document.baseURI)).href` verwenden, die
Katalog-Items analog gegen die Katalog-URL auflösen. Das Verhalten in der TSDoc festhalten
und mit einem Spec absichern.

**BUG-106 · medium · packages/twopoint5d/src/texture/FrameBasedAnimations.ts:213-219** (auch
`TextureResource.ts:677`) — firstTileId und tileCount aus Katalogdaten in
FrameBasedAnimations validieren
Die Werte kommen ungeprüft aus dem Katalog-JSON. Mit `tileCount: 1e9` pusht die Schleife
synchron, bis der Tab einfriert oder der Speicher ausgeht, denn die Größenprüfung greift
erst in `bakeDataTexture`. Mit `"tileCount": "5"` entsteht `1 + "5"` = `"15"`, also 14 statt
5 Frames. `TileSet` prüft dieselben Optionen genau aus diesem Grund.
Empfehlung: `Number.isInteger` und `tileCount >= 1` prüfen, die Obergrenze an die maximale
Texturgröße koppeln und die Elemente von `tileIds` ebenfalls als Integer validieren.

**SEC-001 · low · packages/twopoint5d/src/texture/TextureStore.ts:381-383** (auch
`TextureStore.ts:431-432`, `TextureFactory.ts:160-161`) — Das Katalog-JSON validieren,
bevor parse() es durchläuft
Anders als der Atlas bekommt der Katalog keinen Guard. Fehlt `items`, kommt ein
nichtssagender TypeError. Ein Tippfehler wie `"nearset"` ergibt eine unbekannte Klasse, die
Sortierung wird durch NaN-Prioritäten unbestimmt, und die Klasse fällt ohne Meldung weg.
`frameNameQuery` wird ungeprüft zu `new RegExp`, was bei fremden Katalogen ReDoS erlaubt.
Empfehlung: Einen Guard `isTextureStoreData` mit sprechenden Fehlern einbauen und
unbekannte Klassennamen als `error`-Event mit `source: 'parse'` melden.

**MEM-015 · low · packages/twopoint5d/src/texture/FrameBasedAnimations.ts:292** (auch
`TextureImageLoader.ts:28`, `TileSetLoader.ts:30`, `TextureAtlasLoader.ts:37`) — Ownership
herausgegebener Texturen in Loadern und FrameBasedAnimations dokumentieren
Laut resource-lifecycle.md §1 überträgt das Herausgeben einer Ressource keine Ownership.
`FrameBasedAnimations` und die Loader haben aber kein `dispose()`, damit ist implizit der
Aufrufer Owner, und das steht nirgends. `bakeDataTexture` erzeugt bei jedem Aufruf eine neue
`DataTexture`, und das Lookbook gibt die alten nie frei.
Empfehlung: An jeder Methode »the caller owns the returned texture and disposes it«
ergänzen. Optional die gebackene Textur cachen und `FrameBasedAnimations.dispose()`
anbieten.

**IMPL-001 · low · packages/twopoint5d/src/texture/TexturePackerJson.ts:19** — Die
verstreuten TODO-Marker in ausgelieferten Code-Pfaden auflösen
In ausgelieferten Typen und Code-Pfaden stehen offene TODOs ohne Verweis auf einen Tracker,
etwa `// TODO add textureOptions: TextureClasses[]` im öffentlichen `TexturePackerMetaData`.
Empfehlung: Umsetzen oder als Issue erfassen und aus dem Code entfernen.

**TEST-016 · low (Anteil dieses Pakets)** — aus der Liste des Findings: »`parse()` mit
fehlendem `items` oder unbekanntem Klassennamen«. Empfehlung: »ein Test pro Punkt oben in
den Resource-/Store-Suiten«.

## Urteil des Reviewers (Runde 0, bestätigt in Runde 1)

- **BUG-105** behoben — `resolveRelativeUrl.ts:20-28`; `TextureStore.ts:436` (`load()` reicht `url`
  als `baseUrl`), `:558` (Item-URLs); `TextureResource.ts:821-828` (`meta.image` im Fetch-Effekt
  gegen die `atlasUrl` des Fetches); `TextureAtlasLoader.ts:72-75` (gegen `fileLoader.path + url`);
  Lookbook `textured-quads-from-texture-atlas.astro:92`, `textures.json:12`; Browser-Test
  `texture-store-on.test.js:345-349`
- **BUG-106** behoben — `FrameBasedAnimations.ts:239-263`; Resource-Pfad meldet den Wurf als
  übersprungenen Eintrag (`TextureResource.spec.ts`, »tileCount of "5"«)
- **SEC-001** behoben — `checkTextureStoreData.ts:21-38` (Form), `:48-69` (Items), `:74-85`
  (Klassen); Aufrufe `TextureStore.ts:490, 501, 544`; `TextureFactory.ts:93`
  (`isTextureOptionClass`), `:175` (Filter in `getOptions()`); Query `FrameBasedAnimations.ts:210-216`;
  Vertrauensgrenze in der TSDoc von `parse()` und `types.ts:29-35`
- **TEST-016** (Anteil) behoben — `TextureStore.spec.ts` »data %s throws a TypeError naming what
  items is« (3 Fälle), »a texture class no TextureFactory knows is left out and reported with the
  item id«
- **MEM-015** behoben (Doku) — `TextureFactory.ts:188, 217, 247`, `FrameBasedAnimations.ts:346`,
  `TextureImageLoader.ts:33, 74`, `TileSetLoader.ts:36, 85`, `TextureAtlasLoader.ts:44, 114`,
  `docs/resource-lifecycle.md:16-26`
- **IMPL-001** behoben — TODO in `TexturePackerJson.ts` gestrichen, `grep TODO` über `src` ohne Specs leer
- Nebenbefund `firstId` behoben — `TileSet.ts:190`, TSDoc `:49`, `@throws` `:79`
- Nebenbefund `tileIds` ohne Array behoben — `TextureResource.ts:745-758`

## Kleine Befunde

- `TextureStore.ts:215-216` — TSDoc von `defaultTextureClasses` nach dem Nachziehen nicht neu
  umbrochen (Flatterrand)
- `TextureAtlasLoader.ts:72` — `this.fileLoader.path + url` ohne Rückfallwert; ein gestubbter
  Loader ohne `path` ergäbe `"undefinedsprites.json"` als Basis (der Typ verspricht `string`)
- `TextureStore.ts:182` — das statische `TextureStore.load()` rejectet auf die Meldung zu
  unbekannten `defaultTextureClasses` nur mit `[TextureStore] load failed at the parse step`: das
  Event trägt weder `url` noch `id` (Payload nach Detailplan), Katalog-URL und Name stehen nur in
  `cause`

## Nebenbefunde (Urteil an der Scope-Regel)

- `TileSet.ts:154` `frame()` mit gebrochener Tile-id → `undefined` hinter `!` · vorbestehend ·
  Domain texture → Scope
- `TextureAtlasLoader.ts:66,78` Meldungen ohne `fileLoader.path` · vorbestehend · Domain texture → Scope
- `TextureResource.ts:37` `getTimingOptions()`-Meldung ohne Präfix — schon Paket 7, kein neuer Eintrag
