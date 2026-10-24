# Paket 6 — TextureStore: parse, Fehlermeldungen, Lebenszyklus

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-009 (medium), BUG-012 (medium), READ-001 (medium), BUG-027 (low), API-008 (low), READ-002 (low), CONS-008 (low), IMPL-004 (low), PERF-004 (info)
- Ziel: `TextureStore#parse()` ist in benannte Schritte zerlegt, meldet jedes Katalogproblem als `error`-Event und übersteht werfende Subscriber, mit einheitlichen Fehlermeldungen.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/texture/TextureStore.ts`, `TextureStore.spec.ts`
  - `packages/twopoint5d/src/texture/ResourceFollower.ts` (neu, intern), `ResourceFollower.spec.ts` (neu)
  - `packages/twopoint5d/src/texture/types.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts` (TSDoc der Accessoren, Erfolgsweg des Image-Effekts als Methode), `TextureResource.spec.ts` nur, falls ein Fall dort an einer Meldung hängt
  - `packages/twopoint5d/src/texture/fetchAtlasJson.ts`, `fetchAtlasJson.spec.ts`
  - `packages/twopoint5d/src/utils/describeValue.ts`, `describeValue.spec.ts`
  - `packages/twopoint5d/src/display/DisplayStateMachine.ts`, `DisplayStateMachine.spec.ts`
  - `packages/twopoint5d/src/text/BitmapFont.ts`, `BitmapFont.spec.ts`
  - `packages/twopoint5d/docs/sprites.md` (Absatz »In a `TextureStore` catalog«), `packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md` (§6.2)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`)
- Verify: `pnpm run ci` (Fehlersuche einzeln: `pnpm nx test twopoint5d -- src/texture src/utils src/text src/display`, `pnpm typecheck`, `pnpm lint`)
- Commit: `fix(twopoint5d)!: let TextureStore#parse() finish behind a subscriber that throws and report the throw, report every catalog field the type of an item does not read and a tile set item without an image, throw a TypeError for an item of a conflicting type, say why an item was refused when getAsync() or whenResource() find no resource for it, split parse() into named steps and let on() and getAsync() follow their resource through one internal follower, state what every member of TextureStore and TextureResource does after dispose(), refuse the numbers of a BitmapFont with a RangeError, start the messages of TextureStore and of the display state machine with their subject and cut long strings and typed arrays short in error messages`
- Verlauf:
  - 2026-10-23 Zug 0: Detailplan steht · alle neun Findings unverändert an ihrer Fundstelle (`src/texture/`, `src/utils/`, `src/text/`, `src/display/DisplayStateMachine.ts` seit `004ab0d1` unberührt; Zeilen wie im Audit) · Folge aus Paket 5 (`Canvas2DStage.ts:205`) als Symptom → Nachtragspaket 15 · Nebenbefund `TextureStore.ts:831` → »Offene Befunde« · TextureResource-Teil von READ-001 bleibt hier
  - 2026-10-23 Zug 1: Implementierer beauftragt (Opus, Effort high, `claude -p`, Brief `paket-6.impl-0.brief.md`, Report `paket-6.impl-0.json`)
  - 2026-10-23 Zug 2: Report FERTIG_MIT_VORBEHALT (Fall 6 vor dem Fix schon grün, `#getOnce()` ≈ 98 Zeilen) · 16 Dateien, neu `ResourceFollower.ts`/`.spec.ts` · roter Lauf 30 failed / 270 passed · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-6.verify.log`)
  - 2026-10-23 Zug 3: Reviewer beauftragt (Opus, Effort high, Brief `paket-6.review-0.brief.md`, Diff `paket-6.diff`, 3569 Zeilen)
  - 2026-10-23 Zug 3: Urteil alle neun Findings behoben · 0 kritisch, 0 wichtig, 6 klein (Report `paket-6.review-0.json`) → keine Runde
  - 2026-10-23 Zug 4: entfällt (nur kleine Befunde)
  - 2026-10-23 Zug 5: Commit `a154cadc` (16 Dateien, +1370/−520) auf dem Verify-Lauf aus Zug 2 (`paket-6.verify.log`, exit=0; Baum seither unverändert, Diff byte-gleich) · Trailer `Remediation-Run: 2026-10-23`

## Vorher lesen

`AGENTS.md` (Regel »Error and warning messages«, »Working on the library«: die Module
ganz lesen, nicht grep-weise), `packages/twopoint5d/docs/resource-lifecycle.md` §3 und §6
Punkt 6, die Skills `using-signalize` und `using-eventize`, für den CHANGELOG den Skill
`updating-changelog`. `TextureStore.ts` und `TextureResource.ts` ganz lesen, bevor du
etwas änderst.

## Vorgehen

Reihenfolge: erst die Regressionstests der Korrektheitsfehler (Schritt 1) rot sehen, dann
umbauen. READ-001 ist ein Refactoring unter unveränderten Specs — außer an den Stellen, an
denen dieses Paket das Verhalten bewusst ändert (Meldungen, neue Events, `TypeError`).

### 1. Regressionstests zuerst, alle rot vor dem Fix

In `TextureStore.spec.ts`, je ein `describe`-Block oder Fälle in den bestehenden Blöcken:

1. **Werfender Subscriber in `parse()`**: Store mit Renderer-Mock wie in den übrigen
   Specs, Katalog mit Tile-Set-Item `t` (mit `frameBasedAnimations`), Bild-Item `b` und
   Bild-Item `c`; `store.on('t', 'frameBasedAnimations', cb)` mit einem `cb`, der ab dem
   zweiten Aufruf wirft; warten, bis die Animationen da sind. Dann zweiter
   `parse({evictMissing: true})` mit geänderter `frameRate` an `t`, anderer `imageUrl` an `b`
   und ohne `c`. Erwartet: `parse()` wirft nicht; `ready` geht hinaus; `resource:t` und
   `resource:b` gehen hinaus; `c` ist entfernt und disposed; `b.imageUrl` ist die neue; danach genau ein
   `error`-Event `{source: 'parse', error}` mit dem geworfenen Fehler als `error` (ohne
   `id`), und zwar nach dem `dispose`-Event von `c`. Ein zweiter Fall: dasselbe über
   `store.loadAsync(url)` (Instanzmethode, `fetch` gemockt wie in den übrigen Specs) — das
   Promise löst mit dem Store auf.
2. **Felder, die der Typ nicht liest**: je ein Fall für ein Atlas-Item mit `imageUrl`, ein
   Tile-Set-Item mit `atlasUrl`, `overrideImageUrl` und `atlasAdapter` zugleich (ein Event,
   alle drei genannt) und ein Bild-Item mit `overrideImageUrl` und `frameBasedAnimations`.
   Jeweils ein `error`-Event mit `source: 'parse'`, der Item-ID und der Meldung aus Schritt
   2.4; die Ressource wird gebaut. Den bestehenden Fall `TextureStore.spec.ts:3630`
   (`… but atlasAdapter only reads an atlas — left out`) auf die neue Meldung ziehen.
3. **Tile-Set-Item ohne `imageUrl`**: `{items: {t: {tileSet: {tileWidth: 8, tileHeight: 8}}}}`
   → ein `error`-Event mit `source: 'parse'`, `id: 't'` und der Meldung aus Schritt 2.4;
   `whenResource('t')` löst mit einer Ressource vom `type` `'tileset'` auf.
4. **Konflikt als `TypeError`**: die beiden Konflikt-Fälle (`TextureStore.spec.ts:1587` und
   `:1604`) prüfen zusätzlich `toThrow(TypeError)`.
5. **Grund eines verworfenen Items**: Katalog mit `a: {}` (keine Quelle) und
   `b: {tileSet: 5}` (falscher Typ). `getAsync('a', 'texture')` und `whenResource('b')`
   rejecten mit `TextureStore: no resource with id "a" — its item names no tileSet,
   atlasUrl or imageUrl and builds no resource` bzw. `… "b" — its item builds no resource:
   tileSet is 5, not an object`; `cause` ist dasselbe `Error`-Objekt, das als `error`-Event
   hinausging. Eine ID, die im Katalog gar nicht vorkommt, behält die bisherige Meldung
   (`… — check your TextureStoreData.items keys.`). Ein folgender `parse()`, der `a` baut
   oder nicht mehr nennt, vergisst den Grund.
6. **Nach `dispose()`**: `clearUnused()` auf einem disposten Store antwortet 0 und wirft
   nicht; `registerAtlasAdapter('', fn)` wirft auf einem disposten Store weiter den
   `TypeError`, `registerAtlasAdapter('x', fn)` wirft nichts.

Dazu in den anderen Specs (rot, weil die neue Meldung oder Klasse noch fehlt):

7. `describeValue.spec.ts`: ein String von 121 Zeichen wird nach 120 gekürzt
   (`"<120 Zeichen>…"`), einer von genau 120 bleibt ganz; liegt Zeichen 120 in einem
   Surrogatpaar (Emoji an Stelle 119/120), endet der Kopf vor dem Paar; `new
   Float32Array([1.5, NaN])` → `Float32Array [1.5, NaN]`; ein `Uint8Array` mit zehn Einträgen
   zeigt acht und `…`; `new BigInt64Array([1n])` → `BigInt64Array [1n]`; ein `DataView`
   bleibt bei `String()` (`[object DataView]`); ein langer String in einem Array wird
   ebenfalls gekürzt.
8. `BitmapFont.spec.ts`: die Fälle für `common.*`, die Zeichenfelder und `amount` der
   Kerning-Paare (um `:302`, `:342`, `:368`) erwarten `RangeError` und die Meldungen aus
   Schritt 5.3.
9. `DisplayStateMachine.spec.ts:301`: der Fall prüft zusätzlich, dass die Meldung des
   `AggregateError` mit `Display: ` beginnt.
10. Die Abbruch-Meldungen in `TextureStore.spec.ts` (`:489`, `:746`, `:905`, `:1069`, `:1076`,
    `:1203`, `:1208`) auf die Form aus Schritt 5.1 ziehen.

Den roten Lauf (Kommando und Ausgabe) in den Report.

### 2. `parse()` in benannte Schritte, mit BUG-009, BUG-012, BUG-027, API-008, READ-002

`parse()` bleibt öffentlich mit seiner Signatur und liest danach so:

```ts
parse(data: TextureStoreData, options?: TextureStoreParseOptions) {
  if (this.#disposed) return;
  assertTextureStoreData(data);
  const checked = this.#checkItems(data);            // throws the TypeError of a conflict; writes and emits nothing
  if (checked.defaults?.known.length) this.defaultTextureClasses = checked.defaults.known;
  this.#reportItemProblems(checked);                 // the error events, in the order of the data
  const {updatedResources, publishError} = this.#writeItems(data, checked, options?.baseUrl);
  this.#refusedItems = /* the refusals of this parse whose id carries no resource now */;
  emitSafe(this, OnReady, this);
  for (const resource of updatedResources) emitSafe(this, `${OnResource}:${resource.id}`, resource);
  if (options?.evictMissing) this.#evictMissing(updatedResources);
  if (publishError) emitSafe(this, OnError, {source: 'parse', error: publishError.error});
}
```

Die Reihenfolge der Events und der Zeitpunkt, zu dem `defaultTextureClasses` ersetzt wird,
bleiben genau wie heute (Defaults ersetzt → Fehler der Defaults → je Item seine Fehler →
Schreiben → `ready` → `resource:<id>` → Eviction); neu ist nur das letzte Event.

1. **Typen** (modulintern, nicht exportiert, über `TextureStore` in `TextureStore.ts`):
   - `ItemRefusal` — `{readonly phrase: string; readonly error: Error}`: `phrase` ist der
     Text hinter `item "<id>"`, `error` ist `new Error(`TextureStore: item "${id}" ${phrase}`)`.
     Die drei Phrasen behalten die heutigen Meldungen wortgleich:
     `builds no resource: ${problems.join('; ')}`,
     `names no tileSet, atlasUrl or imageUrl and builds no resource`,
     `names the atlasAdapter "${item.atlasAdapter}", which this store does not know — known: ${known}; register it with registerAtlasAdapter() before parse()`.
   - `CheckedItem` — entweder `{readonly refused: ItemRefusal}` oder
     `{readonly type: TextureResourceType; readonly classes: TextureOptionClasses[] | undefined; readonly notes: readonly Error[]}`.
     `classes` sind die bekannten Klassen von `item.texture` (`undefined` ohne `texture`),
     `notes` alle Meldungen eines gebauten Items in Ausgabereihenfolge: ausgelassene Felder,
     Tile-Set ohne `imageUrl`, unbekannte Texturklassen.
   - `CheckedCatalog` — `{readonly defaults: {known: TextureOptionClasses[]; unknown: unknown[]} | undefined; readonly items: ReadonlyMap<string, CheckedItem>}`
     (Reihenfolge der Map = Reihenfolge von `Object.entries(data.items)`).
   - Namen dürfen abweichen, wenn ein anderer im Modul besser passt; die Aufteilung nicht.
2. **`#checkItems(data): CheckedCatalog`** — prüft jedes Item gegen das, was schon dasteht,
   schreibt und emittiert nichts. Vorrang je Item wie heute: Feldtypen
   (`textureResourceDataProblems`) → keine Quelle → `atlasAdapter` (auf einem Nicht-Atlas
   ausgelassen, auf einem Atlas unbekannt = verworfen) → Konflikt mit der vorhandenen
   Ressource. Der Typ bleibt `item.tileSet ? 'tileset' : item.atlasUrl ? 'atlas' : item.imageUrl ? 'image' : undefined`.
   Konflikte sammeln und am Ende **`throw new TypeError(…)`** mit dem heutigen Text (API-008).
   Danach `defaults` per `partitionTextureClasses(data.defaultTextureClasses)`.
3. **`#reportItemProblems(checked)`** — `emitSafe(this, OnError, …)` für die unbekannten
   Defaults (ohne `id`, heutiger Text), dann je Item in Datenreihenfolge: verworfen →
   `{source: 'parse', id, error: refused.error}`; gebaut → je Eintrag aus `notes`
   `{source: 'parse', id, error: note}`.
4. **Neue Meldungen an gebauten Items** (in `#checkItems`, als `notes`):
   - **Ausgelassene Felder (BUG-012)**: welcher Typ welches Feld liest, steht in einer
     Konstanten `FIELDS_READ_BY_TYPE: Record<TextureResourceType, ReadonlySet<keyof TextureResourceData>>`:
     `tileset` liest `imageUrl`, `tileSet`, `texture`, `frameBasedAnimations`; `atlas` liest
     `atlasUrl`, `overrideImageUrl`, `atlasAdapter`, `texture`, `frameBasedAnimations`;
     `image` liest `imageUrl`, `texture`. Ein Feld gilt als genannt, wenn es
     `!== undefined` ist. Alle genannten, nicht gelesenen Felder eines Items in der
     Reihenfolge `imageUrl`, `overrideImageUrl`, `atlasUrl`, `atlasAdapter`, `tileSet`,
     `frameBasedAnimations` in **einer** Meldung:
     `TextureStore: item "${id}" builds ${articleOf(type)} "${type}" resource, which reads no ${fields.join(', ')} — left out`
     (z. B. `TextureStore: item "hero" builds an "atlas" resource, which reads no imageUrl — left out`).
     Sie ersetzt die bisherige Sondermeldung für `atlasAdapter`. Geschrieben wird ein
     ausgelassenes Feld nicht — das tut `#writeItems` schon heute nicht.
   - **Tile-Set ohne Bild (BUG-027)**, für `type === 'tileset' && !item.imageUrl` (dieselbe
     Wahrheitsprüfung wie die Typwahl, also auch `''`):
     `TextureStore: item "${id}" builds a "tileset" resource without an imageUrl — it loads no image, and a getAsync() of its texture or tile set waits until an imageUrl is written to the resource`.
     Gebaut wird es weiterhin (Entscheidung 2026-10-23).
   - Unbekannte Texturklassen: heutige Meldung, unverändert.
5. **`#writeItems(data, checked, baseUrl): {updatedResources: AnyTextureResource[]; publishError: {error: unknown} | undefined}`**
   — die heutige `batch()`-Schleife samt `joinTextureClasses(this.defaultTextureClasses, classes)`
   und Aufnahme neuer Ressourcen (Image-Source, Atlas-Picker, Factory, Dispose-Listener auf
   `Priority.Max`), unverändert. **BUG-009**: der äußere `batch()` steht in `try/catch`, der
   Fang landet in `publishError = {error}`. Kommentar dazu, warum das sicher ist: geschachtelte
   `batch()`-Aufrufe flushen nicht, der Wurf kommt aus dem Flush des äußeren, nachdem die
   Schleife jedes Item geschrieben hat; signalize isoliert jeden Wurf eines Effekts, lässt
   alle übrigen laufen und wirft am Ende einen, mehrere als `AggregateError` — jeder
   Subscriber hat seinen Wert gehört. Der gefangene Wert geht unverändert hinaus, wie
   `TextureResource` es mit `publishError` hält; eine `id` gibt es nicht, der Flush ordnet
   den Wurf keinem Item zu.
6. **`#evictMissing(updatedResources)`** — die heutige Eviction-Schleife, unverändert.
7. **READ-002**: Feld `#refusedItems = new Map<string, ItemRefusal>()`. `parse()` ersetzt es
   nach `#writeItems` und **vor** `ready` durch die verworfenen Items dieses Laufs, deren ID
   jetzt keine Ressource trägt (ein `ready`-Listener, der `getAsync()` ruft, sieht den
   Grund schon). `dispose()` leert es. `noResourceError(id, refusal?: ItemRefusal)`: ohne
   `refusal` der heutige Text; mit
   `new Error(`TextureStore: no resource with id "${id}" — its item ${refusal.phrase}`, {cause: refusal.error})`.
   Beide Aufrufer (`whenResource()`, der `ready`-Listener in `#getOnce()`) reichen
   `this.#refusedItems.get(id)` mit.
8. Jede der privaten Methoden bekommt einen kurzen Kommentar, was sie tut und welche
   Invariante sie hält (»nothing written or emitted before the conflicts are refused«,
   »the order of the events«); die Kommentare mitten in der heutigen Schleife wandern mit.

### 3. `#subscribe()` und `#getOnce()` über einen gemeinsamen `ResourceFollower` (READ-001)

Neues internes Modul `packages/twopoint5d/src/texture/ResourceFollower.ts`, nicht in
`public-api.ts`. Es ersetzt `#followResource()` und die Verfolgung der Instanzen in
`#subscribe()` und `#getOnce()`. Vertrag:

```ts
export class ResourceFollower {
  // `current` answers the resource the store carries under the id right now; `announced`
  // subscribes to every announcement of a resource under the id (the `resource:<id>` event of
  // the store) and answers its unsubscribe
  constructor(current: () => AnyTextureResource | undefined, announced: (callback: (resource: AnyTextureResource) => void) => () => void);
  // hands `onResource` every instance under the id once: the current one at once, else the next
  // one announced, and after a direct dispose of an instance the one that takes its place
  follow(onResource: (resource: AnyTextureResource, hold: (release: () => void) => void) => void): void;
  // releases everything it holds; a second call does nothing
  dispose(): void;
}
```

Invarianten, die der Follower hält und in seiner Klassen-TSDoc nennt:

- Dieselbe Instanz wird nie zweimal übergeben, auch nicht, wenn jeder `parse()` sie neu
  ankündigt.
- `hold(release)` bindet `release` an die übergebene Instanz: es läuft, wenn diese Instanz
  disposed wird, wenn die nächste übergeben wird, und bei `dispose()` des Followers. Ein
  `hold()` nach `dispose()` ruft `release` sofort — ein `on()` kann einen retainten Wert
  synchron zustellen, bevor es seine Abmeldung zurückgegeben hat (heute `track()` in
  `#getOnce()`).
- `dispose()` darf aus `onResource` heraus kommen (ein `getAsync()`, das dort settlet):
  danach wird nichts mehr übergeben, und jedes weitere `hold()` derselben Runde gibt sofort frei.
- Nach dem Dispose einer Instanz liest der Follower `current()` neu: der
  `Priority.Max`-Listener des Stores hat die Map vorher geräumt, also wartet er auf die
  nächste Ankündigung.

Umbau:

- `#subscribe()` legt den Follower an und startet `follow()` erst im `once(this, OnReady, …)`
  wie heute (die Werte eines Abos kommen damit weiterhin während `ready`, vor den
  `resource:<id>`-Events). Was heute `followed` je Instanz tut (Image-Source, Picker,
  `activate()`, Factory, Warnung, `changeRefCount(±1)`, Abos der Subtypen, `lastValues`),
  steht in einer benannten privaten Methode, die ihre Abmeldungen über `hold` bucht.
- `#getOnce()` legt für die Fehlerbeobachtung einen eigenen Follower an und startet ihn
  sofort; die Reihenfolge »erst `#subscribe()`, dann der Follower« bleibt (ein synchron
  zugestellter Wert gewinnt). `track()`/`settle()` bleiben das Muster des Promises; der
  Follower steht über `track(() => follower.dispose())` darin.
- Ziel: keine der beiden Methoden über etwa 80 Zeilen, keine `let`-Variable, die eine Closure
  für eine andere setzt, ohne dass ein Kommentar daneben sagt, warum.
- `ResourceFollower.spec.ts` mit Charakterisierungsfällen gegen einen Stub (eventisiertes
  Objekt als Store, `TextureResource.fromImage()` als Ressourcen): übergibt die vorhandene
  Instanz sofort · wartet ohne Instanz auf die Ankündigung · dieselbe Instanz nur einmal ·
  nach dem Dispose der Instanz sind ihre `hold`s frei und die nächste angekündigte kommt ·
  `dispose()` gibt alles frei und übergibt nichts mehr · `hold()` nach `dispose()` gibt
  sofort frei · `dispose()` aus `onResource` beendet die Runde.
- `TextureStore.spec.ts` bleibt für diesen Schritt unverändert grün. Fällt ein Fall,
  stimmt der Umbau nicht — nicht den Fall anpassen.

### 4. Erfolgsweg des Image-Effekts als Methode (READ-001, `TextureResource.ts`)

Den Zweig mit Factory aus dem Effekt in `#registerImageEffect()` (heute
`TextureResource.ts:829–872`, von »the coordinates first« bis zum `emitSafe` des
`publishError`) als `#publishImageWithTexture(url: string, image: HTMLImageElement, factory: TextureFactory, classes: TextureOptionClasses[] | undefined): void`
neben `#publishImageWithoutTexture()` ziehen, mit einem Kopfkommentar im Stil des
Nachbarn; die Kommentare wandern mit. Der Erfolgs-Handler des `.then()` liest danach:
`if (aborted) return; if (factory) this.#publishImageWithTexture(url, image, factory, classes); else this.#publishImageWithoutTexture(url, image);`.
Sonst nichts an diesem Effekt; `TextureResource.spec.ts` bleibt unverändert grün. Paket 7
baut `TextureResource` danach weiter um (`activate()`-Fallback, Setter `textureClasses`,
Atlas-Effekte) — diese Stellen hier nicht anfassen.

### 5. Fehlermeldungen nach der Regel in AGENTS.md (CONS-008)

1. `TextureStore.ts`, abschließende Liste:
   - `whenResource()`: `this.#whenReady(`whenResource(${describeValue(id)})`)`.
   - `loadAsync()`: alle drei `AbortError` mit Subjekt —
     `TextureStore: ${what} aborted` (zweimal) und
     `TextureStore: ${what} aborted: a later loadAsync() on this store took its place`.
   - `#getOnce()`: `TextureStore: ${what} aborted before subscription` (mit den Argumenten
     aus `what`, statt `${method}()`), `TextureStore: ${what} aborted`.
   - Die übrigen Meldungen des Moduls folgen der Regel schon; ein `"${id}"` von Hand ist
     zulässig (Name, der Instanzen unterscheidet).
2. `fetchAtlasJson.ts:32`: `TextureResource: fetch(${describeValue(url)}) answered …`
   (Import von `describeValue`), wie `TextureStore` es für seinen eigenen Fetch hält.
3. `BitmapFont.ts` (Konstruktor):
   - `common.lineHeight`, `common.scaleW`, `common.scaleH` über
     `assertPositiveFinite(value, WHERE, `common.${key}`)`, `common.base` über
     `assertFinite(value, WHERE, 'common.base')` — Text wie heute, jetzt `RangeError`.
   - Zeichenfelder (`CHAR_FIELDS`): `assertFinite(value, WHERE, `the ${field} of the char ${label}`)`
     → `BitmapFont: the x of the char "A" (65) must be a finite number, got NaN`; die Prüfung
     auf 0 oder mehr (`AT_LEAST_ZERO`) als
     `new RangeError(`${WHERE}: the ${field} of the char ${label} must be a finite number of 0 or more, got ${describeValue(value)}`)`
     (Muster: `DynamicAtlas.ts:92`).
   - `amount` eines Kerning-Paars: `assertFinite(amount, WHERE, `the amount of kerning pair ${index}`)`.
   - Code-Point-Prüfungen (`id`, `first`, `second`) bleiben, wie sie sind.
   - `@throws` des Konstruktors (und von `BitmapFont.parse()`, falls er die Klassen nennt)
     teilen: `{RangeError}` für die Zahlen, `{Error}` für den Rest.
4. `DisplayStateMachine.ts:164`: `'Display: a listener of start threw, and a listener of pause threw in the pause that followed'`.

### 6. Verhalten nach `dispose()` an jedem öffentlichen Member (IMPL-004)

- `TextureStore#registerAtlasAdapter()`: nach den drei Argumentprüfungen
  `if (this.#disposed) return;`; TSDoc: »On a disposed store it still refuses the arguments
  above and registers nothing.«
- `TextureStore#clearUnused()`: TSDoc »On a disposed store this does nothing and answers 0.«
  (Verhalten steht schon, die Map ist geleert.)
- `TextureResource` (Basis): je ein Satz in der TSDoc von `imageUrl`, `imageCoords`, `atlas`,
  `tileSet`, `frameBasedAnimations`, `textureClasses`, `textureFactory`, `renderer` —
  »Answers `undefined` once {@link TextureResource.dispose} has run«, bei den Accessoren mit
  Setter ergänzt um »; a write afterwards does nothing«. Wo noch keine TSDoc steht, eine
  kurze anlegen, die sagt, was der Wert ist. `refCount`: »Goes on counting once
  {@link TextureResource.dispose} has run, until the last subscription that holds the
  resource lets go.« `id` und `type` bekommen eine einzeilige TSDoc, die sagt, was sie sind
  und dass sie nach `dispose()` weiter antworten.
- Unterklassen: dieselben Sätze an `ImageTextureResource#imageUrl`,
  `TileSetTextureResource#imageUrl`, `#tileSetOptions`, `#frameBasedAnimationsData`,
  `AtlasTextureResource#atlasUrl`, `#atlasJson`, `#overrideImageUrl`, `#atlasAdapter`,
  `#frameBasedAnimationsData`. Die Overrides, die immer `undefined` antworten
  (`atlas`, `tileSet`, `frameBasedAnimations` der Unterklassen), bleiben ohne Satz.
- Code ändert sich in `TextureResource` dabei nicht.

### 7. `describeValue()` begrenzt Strings und Typed Arrays (PERF-004)

- `const MAX_STRING_LENGTH = 120;` — ein String über 120 UTF-16-Einheiten wird auf die
  ersten 120 gekürzt, `…` vor dem schließenden Anführungszeichen (`"abc…"`, wie `[1, 2, …]`
  bei Arrays). Ist `value.charCodeAt(119)` ein High Surrogate (`0xD800–0xDBFF`), endet der
  Kopf bei 119. Gilt auch für Strings in Arrays und Objekten.
- Typed Arrays: `ArrayBuffer.isView(value) && !(value instanceof DataView)` →
  `${Object.prototype.toString.call(value).slice(8, -1)} [${entries}]`, die Einträge wie bei
  Arrays über `describeAt(value[index], depth + 1)`, höchstens `MAX_ENTRIES`, dann `…`;
  jenseits von `MAX_DEPTH` `Float32Array […]`. `DataView` bleibt bei `String()`.
- TSDoc von `describeValue()` um beide Sätze ergänzen.
- Specs anderer Module, die eine Meldung mit einem String über 120 Zeichen erwarten, auf die
  gekürzte Form ziehen.

### 8. TSDoc, Typen, Doku, CHANGELOG

- `TextureStoreEvents` (`Error`): unter `parse` zusätzlich »a field the type of an item does
  not read, which is left out, a tile set item without an `imageUrl`, which is built all the
  same, and a subscriber of a resource that throws while `parse()` writes the values«.
- `parse()`: der Absatz zu `atlasAdapter` auf einem Nicht-Atlas wird zur allgemeinen Regel
  (Typ = erstes von `tileSet`, `atlasUrl`, `imageUrl`; jedes Feld, das dieser Typ nicht liest,
  wird ausgelassen und in einem Event je Item gemeldet); Satz zum Tile-Set ohne `imageUrl`;
  der Absatz zu werfenden Listenern um den werfenden Subscriber einer Ressource ergänzen —
  jeder hört seinen Wert, der Parse läuft zu Ende, der Wurf geht nach `evictMissing` als
  `error` mit `source: 'parse'` hinaus. Der Satz »`parse()` throws only for data it refuses
  before anything is written or emitted« bleibt und stimmt jetzt.
- `loadAsync()` (Instanz): »A listener of the store that throws inside the parse changes
  nothing either« um den Subscriber einer Ressource ergänzen.
- `TextureStore.loadAsync()` (statisch): seine Regel »every failure the attempt reports
  counts« gilt auch für die neuen Meldungen — kein neuer Satz nötig, aber im CHANGELOG
  sagen (siehe unten).
- `whenResource()` und `getAsync()`: ein Satz, dass ein Item, das der letzte `parse()`
  verworfen hat, mit einem Fehler rejected, der den Grund nennt und das Fehlerobjekt seines
  `error`-Events als `cause` trägt.
- `types.ts` `TextureResourceData`: Interface-TSDoc mit der Typwahl (`tileSet` → Tile-Set,
  sonst `atlasUrl` → Atlas, sonst `imageUrl` → Bild, sonst keine Ressource) und dem Satz,
  dass `parse()` ein Feld, das der Typ nicht liest, auslässt und meldet. Je Feld, welcher
  Typ es liest: `imageUrl` Bild und Tile-Set (ein Atlas nimmt das Bild aus seinem json oder
  `overrideImageUrl`), `overrideImageUrl`/`atlasUrl`/`atlasAdapter` nur Atlas, `tileSet`
  (neu dokumentieren: die Optionen eines Tile-Sets; ein Item mit `tileSet` wird eines, was
  es sonst auch nennt; ohne `imageUrl` gemeldet und gebaut), `texture` jeder Typ,
  `frameBasedAnimations` (neu dokumentieren: Animationen eines Tile-Sets oder Atlas nach
  Namen; ein Bild liest sie nicht).
- `docs/sprites.md`, Absatz »In a `TextureStore` catalog« (um Z. 416): an den Satz zum
  unbekannten Adapter einen Halbsatz, dass ein Feld, das der Typ eines Items nicht liest —
  ein `imageUrl` neben einem `atlasUrl` —, ausgelassen und ebenso gemeldet wird.
- `docs/proposals/animation-playback-and-aseprite.md` §6.2 (um Z. 402): das Zitat
  `… atlasAdapter only reads an atlas — left out` durch die neue Meldung ersetzen
  (`… builds a "tileset" resource, which reads no atlasAdapter — left out`).
- `CHANGELOG.md`, `## [Unreleased]`: unter `Changed` (je mit Migrationshinweis im
  `### Migration Guide`, wo ein Aufrufer etwas tun muss):
  - `TextureStore#parse()` wirft für Items eines widersprüchlichen Typs einen `TypeError`
    (weiter `instanceof Error`).
  - `parse()` meldet jedes Feld, das der Typ eines Items nicht liest, und ein Tile-Set-Item
    ohne `imageUrl` als `error` mit `source: 'parse'`; die Meldung für `atlasAdapter` auf
    einem Nicht-Atlas hat den neuen Wortlaut. Migration: das statische
    `TextureStore.loadAsync()` rejected einen solchen Katalog jetzt — die Felder entfernen
    oder die Instanzmethode nehmen.
  - `getAsync()`/`acquireAsync()`/`whenResource()` nennen den Grund eines verworfenen Items.
  - Die `AbortError`-Meldungen von `TextureStore` beginnen mit `TextureStore: ` und nennen
    die Argumente.
  - `BitmapFont` weist seine Zahlen mit `RangeError` ab (weiter `instanceof Error`), mit den
    neuen Meldungen der Zeichenfelder und der Kerning-Paare.
  - Fehlermeldungen kürzen lange Strings nach 120 Zeichen und zeigen Typed Arrays mit Art
    und Inhalt.
  - Unter `Fixed`: `parse()` läuft hinter einem werfenden Subscriber einer Ressource zu Ende
    und meldet den Wurf als `error`; `registerAtlasAdapter()` registriert auf einem
    disposten Store nichts mehr.
  Eintragsstil der bestehenden Einträge übernehmen (Verb vorn, klein).

### 9. Gegenprobe der Kataloge

Zug 0 hat geprüft: die zwei JSON-Kataloge im Repo und die Inline-Kataloge in
`apps/lookbook/src/` (`ui-panels.astro`, `sine-scroller.astro`, `demos/platformer/assets.ts`),
in den Browser-Tests (`texture-store-on.test.js`, `texture-aseprite-sheet.test.js`) und in
`docs/sprites.md` nennen kein Feld, das ihr Typ nicht liest, und kein Tile-Set ohne
`imageUrl`. Vitest-Specs, die solche Items bauen und die `error`-Events zählen, bekommen ein
Event mehr — dort die Erwartung anpassen, wenn das Item absichtlich so gebaut ist, sonst das
Item bereinigen.

## Entscheidungen in Zug 0, mit Grund

- **CONS-008 ganz in diesem Paket**, auch `BitmapFont` und `DisplayStateMachine`, obwohl der
  Grobplan nur `src/texture/` nannte: eine Ursache (die Meldungsregel), drei Stellen — ein
  Paket, nicht drei. Paket 11 (`src/text/`) plant gegen den geänderten `BitmapFont`;
  BUG-024 (`BitmapFont.ts:199`) liegt außerhalb der hier geänderten Zeilen.
- **Der `TextureResource`-Teil von READ-001 bleibt hier**: eine reine Extraktion
  (`TextureResource.ts:829–872`), disjunkt zu den Stellen von Paket 7 (`activate()`-Fallback
  Z. 740–750, Setter `textureClasses` Z. 469, Atlas-Effekte Z. 1390–1432); so schließt das
  Finding in einem Paket.
- **Subjekt `Display:` statt der auslösenden Methode** in der State Machine: sie ist intern
  (nicht in `display/public-api.ts`) und wird auf drei Wegen gestartet, die sie nicht
  unterscheidet — `Display#start()`, das Zurücknehmen der Pause, ein Wechsel von Sichtbarkeit
  oder Viewport. Die Klasse ist laut AGENTS.md ein zulässiges Subjekt.
- **Grenze 120 statt »etwa 80«** für Strings in `describeValue()`: Strings, die eine Meldung
  als Aufrufargument schreibt, sind oft URLs (`loadAsync("…")`, `fetch("…")`); 80 schneidet
  übliche Asset-URLs ab, 120 lässt sie stehen, und der Zweck — keine Meldung in der Größe
  einer `data:`-URL oder eines JSON-Bodys — bleibt.
- **`registerAtlasAdapter()` auf einem disposten Store** wird ein No-op nach den
  Argumentprüfungen: `resource-lifecycle.md` §3 Punkt 3 (mutierende Methode, nichts mehr zum
  Handeln, ungültige Eingaben weiter abgewiesen).
- **Der Wurf eines Subscribers** geht ohne `id`, als gefangener Wert und nach `evictMissing`
  hinaus: der Flush ordnet ihn keinem Item zu, `TextureResource` meldet denselben Fall mit
  dem rohen Wert, und die Empfehlung des Audits nennt diese Reihenfolge.
- **Eine Meldung je Item** für ausgelassene Felder, »genannt« heißt `!== undefined` — wie die
  bestehende Prüfung für `atlasAdapter`; die Typwahl bleibt unverändert.
- **READ-002 mit Text und `cause`**: der Text ist, was ein Aufrufer liest; `cause` verbindet
  die Ablehnung mit dem Event, das er vielleicht doch abonniert hat. Gemerkt nur für IDs, die
  nach dem Parse keine Ressource tragen — sonst gäbe ein später direkt disposter Vorgänger
  einen falschen Grund.
- **`ResourceFollower` als eigenes Modul mit Charakterisierungs-Spec**: hält
  `TextureStore.ts` kleiner (Zweck von READ-001) und folgt dem Muster von
  `display/canvasHandover.ts` aus Paket 4.
- **Statisches `TextureStore.loadAsync()`** rejected die neuen Meldungen mit: das folgt aus
  seinem Vertrag (»every failure the attempt reports counts«, heute schon für `atlasAdapter`
  auf einem Nicht-Atlas); Bruch mit Migrationshinweis im Rahmen von 0.24.0 (Entscheidung
  »Kleine API-Brüche wie empfohlen«).

## Nebenbefunde aus Zug 0

- `TextureStore.ts:831` — die Konfliktmeldung schreibt ihren Artikel von Hand:
  `"b" is a "image" resource` statt `an "image"`; `articleOf()` steht im selben Modul
  (`outOfReachError`). Vorbestehend (Datei seit `004ab0d1` unverändert), eigene Ursache (keine
  der Meldungsregel aus AGENTS.md) → »Offene Befunde«, low → Scope. Nicht in diesem Paket
  beheben, auch wenn die Zeile für den `TypeError` ohnehin angefasst wird.

## Abweichungen des Implementierers (Runde 0, aus seinem Report)

- Fall 6 (nach `dispose()`) war vor dem Fix schon grün: `clearUnused()` antwortete 0, der
  `TypeError` und das Schweigen von `registerAtlasAdapter('x', fn)` galten schon; dass
  nichts registriert wird, ist über die öffentliche API nicht beobachtbar. Fall bleibt als
  Absicherung, Fix und TSDoc sind drin.
- Fall 10, `:1076` und `:1208`: auf die volle Meldung mit `TextureStore: ` gezogen, weil der
  Substring-Match von `toThrow()` sonst mit alter wie neuer Meldung grün wäre.
- Zusätzliche private Helfer (`#checkItem()`, `#writeItem()`, `#adopt()`,
  `#refusalsWithoutResource()`, `#subscribeToResource()`, `#watchResource()`,
  `#followerOf()`, Modulfunktion `leaseOn()`); die Aufteilung aus Schritt 2/3 bleibt.
- `#getOnce()` ≈ 98 Zeilen samt Kommentaren (Ziel etwa 80); `#subscribe()` ≈ 27.
- `ResourceFollower` hört den Dispose einer Instanz auf `Priority.Min`, damit ein per `hold`
  gebuchter Dispose-Listener (Reject von `getAsync()`) den Dispose hört, bevor er
  abgemeldet wird; eigener Charakterisierungsfall.
- `warnedResource` entfallen (der Follower übergibt jede Instanz nur einmal); Parameter
  `hold` von `#getOnce()` heißt `asLease`.
- `BitmapFont`: Helfer `article()` entfallen; `@throws` von `parse()` nennt `RangeError`.
- Changelog zusätzlich: das `AggregateError` von `Display#start()` beginnt mit `Display: `.
- TSDoc von `TextureStore#dispose()` nennt `registerAtlasAdapter()` und `clearUnused()`.
- Gemeldet, nicht mitgezogen: `packages/twopoint5d/docs/text.md:52–58` (»Refusals«) nennt
  keine Fehlerklasse; Nebenbefund `describeValue.ts` `describeKey()` kürzt Objektschlüssel
  nicht.

## Urteil des Reviewers (Zug 3, `paket-6.review-0.json`)

Stand des Commits `a154cadc`, Zeilen in `packages/twopoint5d/src/`:

- BUG-009 behoben — `texture/TextureStore.ts:1029–1060` (`try/catch` um den äußeren `batch()` in `#writeItems()`), Event nach `evictMissing` `:902–904`; Specs `TextureStore.spec.ts:3560–3628`
- BUG-012 behoben — `FIELDS_READ_BY_TYPE`/`TYPE_SPECIFIC_FIELDS` `TextureStore.ts:153–169`, Meldung `:961–970`, Feld-TSDoc `texture/types.ts:45–91`, alter `atlasAdapter`-Fall `TextureStore.spec.ts:3818` nachgezogen
- READ-001 behoben, mit Vorbehalt bei der Länge — `parse()` `TextureStore.ts:863–905` mit `#checkItems` `:911`, `#reportItemProblems` `:997`, `#writeItems` `:1021`, `#evictMissing` `:1156`; `#subscribe` `:1205–1231` (27 Zeilen); `#getOnce` `:1393–1491` (99 Zeilen); `texture/ResourceFollower.ts` samt Spec; `TextureResource.ts:893` `#publishImageWithTexture()`; Follower gegen den alten `#followResource()` gelesen: gleiches Verhalten, auch bei synchron zugestelltem Wert und Dispose aus `onResource`
- BUG-027 behoben — `TextureStore.ts:971–978`, Spec `TextureStore.spec.ts:3202`
- API-008 behoben — `TextureStore.ts:925–929`, Specs `TextureStore.spec.ts:1609`, `:1627`
- READ-002 behoben — `noResourceError(id, refusal?)` `TextureStore.ts:174–177`, `#refusedItems` `:419`, gesetzt vor `ready` `:883`, Aufrufer `:611`, `:1480`, geleert in `dispose()` `:1608`; Specs `TextureStore.spec.ts:3219`, `:3245`
- CONS-008 behoben — `TextureStore.ts:608`, `:677`, `:700`, `:708`, `:1408`, `:1442`; `texture/fetchAtlasJson.ts:33`; `display/DisplayStateMachine.ts:164`; `text/BitmapFont.ts:191`, `:193`, `:226–231`, `:260`
- IMPL-004 behoben — `registerAtlasAdapter()` No-op nach den Prüfungen `TextureStore.ts:534`, TSDoc `:512`; `clearUnused()` TSDoc `:1532`, `dispose()` `:1569–1571`; `TextureResource.ts:411–429` (`id`, `type`, `refCount`), `:446–556` (Basis-Accessoren) und die Accessoren der Unterklassen; »a write afterwards does nothing« gegen die Setter geprüft
- PERF-004 behoben — `utils/describeValue.ts:5` (`MAX_STRING_LENGTH`), `:52–60` (Typed Arrays), `:70–75` (`describeString` mit Surrogatpaar-Schutz); Specs `describeValue.spec.ts:10–34`

Konventionen: keine Finding-IDs in Code, Doku, CHANGELOG, Commit-Message; kein Satz über den
Vorzustand; kein Aufrufer, Test oder Doku-Zitat an einer alten Meldung; Event-Reihenfolge von
`parse()` unverändert.

### Kleine Befunde (keine Runde)

1. `TextureStore.ts:1029–1060` — der `catch` in `#writeItems()` fängt auch einen Wurf aus der
   Schleife selbst, nicht nur aus dem Flush; dann ginge `ready` hinaus und `evictMissing`
   disposte Ressourcen benannter, aber nicht geschriebener Items. Heute wirft die Schleife nur
   über `expectDefined`, der Kommentar »after the loop has written every item« trägt also —
   ungeschützt. Absicherung: ein `written`-Flag am Schleifenende, das im `catch` den Wurf
   andernfalls weiterreicht.
2. `TextureStore.ts:1393–1491` — `#getOnce()` 99 Zeilen statt etwa 80 (vom Implementierer
   gemeldet; `track()`/`settle()`/`giveUp()` bleiben laut Detailplan inline).
3. `TextureStore.ts:96` und `:857` — TSDoc nach dem Einfügen nicht neu umbrochen (114 bzw.
   131 Zeichen, Rest des Blocks bei etwa 100).
4. `packages/twopoint5d/docs/sprites.md:418` — derselbe Umbruchfehler im Fließtext (121
   Zeichen).
5. `packages/twopoint5d/CHANGELOG.md:588` — im »After«-Block des Migration Guide ist `store`
   ein `Promise<TextureStore>`, das `await` aus »Before« fehlt; geprüfte Blöcke erlauben
   Top-Level-`await` (`docs/sprites.md:992`).
6. `TextureStore.spec.ts:3219–3257` — ohne Spec: ein verworfenes Item, dessen ID weiter eine
   Ressource trägt, merkt sich keinen Grund (`#refusalsWithoutResource`, `TextureStore.ts:1144`),
   und der Grund ist schon für einen `ready`-Listener sichtbar (`:883`).

### Nebenbefunde aus Zug 1–5, mit Grund

- `utils/describeValue.ts:99` `describeKey()` kürzt Objektschlüssel nicht. Vorbestehend
  (`describeKey()` steht seit vor dem Lauf unverändert da); PERF-004 nennt Strings als Werte
  und Typed Arrays, nicht Schlüssel → »Offene Befunde«, low → Scope.
- `TextureStore.ts:921` (Artikel von Hand) — der Nebenbefund aus Zug 0 ist mit `#checkItems()`
  gewandert; Eintrag in »Offene Befunde« auf die neue Zeile gezogen.

### Folge

- `packages/twopoint5d/docs/text.md:53–58` (»Refusals«) nennt keine Fehlerklasse; der Text
  stimmt weiter, sagt aber nicht, dass `BitmapFont` seine Zahlen jetzt mit `RangeError`
  abweist → `Folgen:` im Plan, Vorschlag Paket 11.

## Findings im Volltext

**BUG-009 · medium · packages/twopoint5d/src/texture/TextureStore.ts:882** (auch `:697`) — Werfenden Werte-Subscriber in `TextureStore#parse()` vom Batch-Flush abschirmen
`parse()` schreibt alle Items in einem äußeren `batch()`. Am Ende des Batches laufen synchron die Effekte bereits aktivierter Ressourcen (Tile-Set-Effekt bei geänderten `tileSetOptions`, Animations-Effekt bei geänderten `frameBasedAnimations`, Atlas-Effekt bei geändertem `atlasAdapter`), und deren Change-Bridges emittieren per `emitStrict`. Wirft dabei ein Subscriber — etwa ein Callback von `store.on(id, 'frameBasedAnimations', …)` —, sammelt signalize den Throw und wirft ihn aus `batch()` heraus: `parse()` bricht nach dem Schreiben ab, `ready` und `resource:<id>` gehen nicht raus, `evictMissing` läuft nicht, und `loadAsync()` meldet einen `parse`-Fehler und rejected, obwohl der Katalog geschrieben ist. Per Probe gegen `dist/` nachgestellt: zweiter `parse()` mit geänderter `frameRate` und werfendem `on()`-Callback wirft `subscriber throws`, 0 Ready-Events. Die TSDoc von `parse()` (Z. 773–777) und `loadAsync()` (Z. 578–580) versprechen das Gegenteil.
Beleg: `batch(() => { for (const [id, item] of Object.entries(data.items)) { … } });` — kein try/catch, danach erst `emitSafe(this, OnReady, this)`
Empfehlung: Den Throw aus dem `batch()` fangen, wie es der Image-Effekt in `TextureResource` tut (`publishError`), den Parse zu Ende führen (Ready, Resource-Events, `evictMissing`) und den Fehler danach als `error`-Event mit `source: 'parse'` melden. Einen Spec ergänzen: aktivierte Tile-Set-Ressource, werfender `on()`-Callback, zweiter `parse()` mit geänderten Animationsdaten.

**BUG-012 · medium · packages/twopoint5d/src/texture/TextureStore.ts:805** (auch `:938`, `:917`) — Katalogfelder melden, die der Typ des Items nicht liest
`parse()` leitet den Typ aus `tileSet` > `atlasUrl` > `imageUrl` ab und liest danach nur die Felder dieses Typs. Ein `imageUrl` auf einem Atlas-Item, ein `atlasUrl` auf einem Tile-Set-Item, ein `overrideImageUrl` auf einem Bild- oder Tile-Set-Item und `frameBasedAnimations` auf einem Bild-Item verschwinden kommentarlos — der Katalogautor bekommt ein anderes Bild oder keine Animationen und keinen Hinweis. Für `atlasAdapter` auf einem Nicht-Atlas-Item gibt es genau diese Meldung bereits (`leftOut`, Z. 810–818), für unbekannte Texturklassen ebenfalls.
Beleg: `const wanted = item.tileSet ? 'tileset' : item.atlasUrl ? 'atlas' : item.imageUrl ? 'image' : undefined;`
Empfehlung: Die `leftOut`-Prüfung auf alle Felder ausweiten, die der gewählte Typ nicht liest, und sie als `error`-Event mit `source: 'parse'` und der Item-ID melden; `TextureResourceData` in `types.ts` je Feld sagen lassen, welcher Typ es liest.

**READ-001 · medium · packages/twopoint5d/src/texture/TextureStore.ts:782** (auch `:1039`, `:1261`, `:601`, `TextureResource.ts:794`) — `TextureStore#parse()`, `#subscribe()` und `#getOnce()` in benannte Teilschritte zerlegen
`TextureStore.ts` (1491 Zeilen) und `TextureResource.ts` (1565 Zeilen) bündeln je mehrere Verantwortungen. `parse()` umfasst rund 220 Zeilen in drei Durchläufen über die Items (Prüfen, Melden, Schreiben) plus Eviction; `#subscribe()` und `#getOnce()` je rund 140 Zeilen mit fünf bis sieben Closures, die sich gegenseitig über `let`-Variablen steuern; der Image-Effekt in `TextureResource` rund 100. Die Invarianten (Reihenfolge der Listener, Priority.Max, `track()` vor `settle()`) stehen nur in Kommentaren mitten in diesen Blöcken. Jede Änderung muss den ganzen Block im Kopf halten — der Konflikt mit dem Batch-Flush in `parse()` ist so ein Fall, der dort nicht auffällt.
Beleg: `parse(data, options) { … }` von Z. 782 bis 1003
Empfehlung: `parse()` in `#checkItems()`, `#reportItemProblems()`, `#writeItems()` und `#evictMissing()` teilen; die Abo-Verwaltung von `#subscribe()` in eine kleine interne Klasse (Resource-Follower mit `follow()`/`dispose()`) ziehen, die `#getOnce()` mitbenutzt; die Image-Effekt-Erfolgspfade als eigene Methode wie `#publishImageWithoutTexture()`.

**BUG-027 · low · packages/twopoint5d/src/texture/TextureStore.ts:898** (auch `:910`) — Tile-Set-Item ohne `imageUrl` in `parse()` melden
Ein Katalog-Item mit `tileSet`, aber ohne `imageUrl` baut eine `TileSetTextureResource` ohne Bild. Sie lädt nie etwas, meldet keinen Fehler, und `subTypesOutOfReach` schließt nichts aus — ein `getAsync(id, 'texture')` oder `getAsync(id, 'tileSet')` bleibt bis zum `dispose()` des Stores pending. Für den programmatischen Weg (`fromTileSet(id, undefined, …)` und späteres Setzen von `imageUrl`) ist das gewollt, aus einem Katalog kann aber niemand die URL nachreichen.
Beleg: `resource = TextureResource.fromTileSet(id, resolve(item.imageUrl), item.tileSet, …)` mit `item.imageUrl === undefined`
Empfehlung: Ein Tile-Set-Item ohne `imageUrl` in `parse()` als `error`-Event mit `source: 'parse'` und der Item-ID melden (bauen darf es weiterhin), oder `getAsync()` für eine Tile-Set-Ressource ohne `imageUrl` per `subTypesOutOfReach(…, 'now')` rejecten lassen. — Entschieden (2026-10-23): melden und weiter bauen.

**API-008 · low · packages/twopoint5d/src/texture/TextureStore.ts:836** (auch `:738`) — Konflikt-Fehler von `parse()` als `TypeError` werfen, wie die TSDoc sagt
Die TSDoc von `parse()` sagt: Was das Ganze unlesbar macht, wirft einen `TypeError` — »So does an item whose type does not match the resource that already carries its id«. Der Code wirft dafür ein einfaches `Error`. Ein Aufrufer, der per `instanceof TypeError` zwischen verworfenen Daten und anderen Fehlern unterscheidet, übersieht den Typkonflikt; die Specs prüfen nur die Nachricht, nicht die Klasse.
Beleg: `throw new Error(`TextureStore: parse() found ${conflicts.length} item(s) of a conflicting type: …`)`
Empfehlung: `new TypeError(…)` werfen und im Spec die Klasse mitprüfen — oder die TSDoc korrigieren, falls `Error` gewollt ist. — Entschieden (2026-10-23): `TypeError`.

**READ-002 · low · packages/twopoint5d/src/texture/TextureStore.ts:121** (auch `:1391`) — `getAsync()` für ein verworfenes Item nicht mit »check your keys« ablehnen
Ein Item, das `parse()` wegen eines falsch typisierten Feldes verwirft, baut keine Ressource. Ein `getAsync()` auf seine ID rejected dann mit `no resource with id "a" — check your TextureStoreData.items keys.` — der Schlüssel steht aber im Katalog, falsch ist ein Feld. Der eigentliche Grund ging nur als `error`-Event raus, das ein Aufrufer von `getAsync()` meist nicht abonniert hat.
Beleg: `new Error(`TextureStore: no resource with id "${id}" — check your TextureStoreData.items keys.`)`
Empfehlung: Die Gründe verworfener Items bis zum nächsten `parse()` merken und `noResourceError` für eine solche ID mit diesem Grund (als `cause` oder im Text) ausgeben.

**CONS-008 · low · packages/twopoint5d/src/texture/TextureStore.ts:538** (auch `TextureStore.ts:1276`, `fetchAtlasJson.ts:32`, `DisplayStateMachine.ts:164`, `BitmapFont.ts:183`, `:221`, `:259`) — Fehlermeldungen an die Regel für Subjekt, Zahlen- und Wertprüfung angleichen
Die Projektregel für Fehlermeldungen (AGENTS.md: Subjekt zuerst, Zahlen über `assertFinite()`/`assertPositiveFinite()`, Werte über `describeValue()`) wird an drei Stellen gebrochen: `TextureStore` schreibt Aufruf-Argumente per Interpolation in die Meldung, die State Machine des Displays beginnt ihre Meldung nicht mit dem Subjekt des Aufrufs, und `BitmapFont` prüft Zahlen von Hand und wirft einen einfachen `Error` statt `RangeError`. Wer Fehler nach Typ oder Präfix auswertet, bekommt in diesen drei Modulen ein anderes Format als im Rest der Library.
Beleg: `await this.#whenReady(`whenResource(${id})`);` · `reject(new DOMException(`${method}() aborted before subscription`, 'AbortError'));`
Empfehlung: In `TextureStore` die Argumente durch `describeValue()` schreiben, in `DisplayStateMachine` das Subjekt der auslösenden Display-Methode voranstellen, in `BitmapFont` die Zahlenprüfungen auf `assertFinite()`/`assertPositiveFinite()` umstellen. Die bestehenden Specs auf die Meldungen ziehen nach.

**IMPL-004 · low · packages/twopoint5d/src/texture/TextureStore.ts:1412** (auch `TextureStore.ts:441`, `TextureResource.ts:449`, `:465`) — Verhalten nach `dispose()` an jedem öffentlichen Member dokumentieren
`resource-lifecycle.md` §3 und Checkliste Punkt 6 verlangen, dass die TSDoc jedes öffentlichen Members sagt, wie er sich nach `dispose()` verhält. `TextureStore#clearUnused()` (liefert dann 0) und `registerAtlasAdapter()` (registriert auf einem toten Store weiter) sagen nichts dazu. In `TextureResource` sagt es nur `texture`; `imageCoords`, `atlas`, `tileSet`, `frameBasedAnimations`, `textureClasses`, `textureFactory` und `renderer` verlassen sich auf einen Sammelsatz in der TSDoc von `dispose()` und einen Code-Kommentar.
Beleg: `clearUnused(): number {` — TSDoc ohne Aussage zum disposed Store
Empfehlung: An den genannten Membern je einen Satz ergänzen (»Answers `undefined` once … has run«, »Does nothing on a disposed store«); für `registerAtlasAdapter()` entscheiden, ob es auf einem disposed Store ein No-op wird.

**PERF-004 · info · packages/twopoint5d/src/utils/describeValue.ts:36** (auch `:52`) — Strings und Typed Arrays in describeValue begrenzen
Arrays und Objekte werden auf acht Einträge und drei Ebenen gekürzt, damit eine Fehlermeldung kurz bleibt. Ein String wird dagegen in voller Länge in Anführungszeichen gesetzt, und ein Typed Array (Array.isArray ist false) geht über String(value), das alle Elemente verbindet. Wird ein langer Text oder ein Float32Array mit Millionen Einträgen als Fehlerwert übergeben, wird die Meldung entsprechend groß.
Beleg: `if (typeof value === 'string') return `"${value}"`;` und `return String(value);`
Empfehlung: Strings ab einer Grenze (etwa 80 Zeichen) mit '…' kürzen und Typed Arrays wie Arrays behandeln (ArrayBuffer.isView).
