# Paket 6b — Texturen: TextureStore, AsepriteJson und FrameBasedAnimations zerlegen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: READ-006 (low), READ-007 (low)
- Ziel: `AsepriteJson.parse()` und `FrameBasedAnimations#add()` laufen als Folge benannter Teilschritte, und Bild-Cache und Ladeversuch von `loadAsync()` stehen in eigenen Modulen neben `TextureStore.ts`, bei unveränderter öffentlicher API.
- Modell: mittlere Stufe
- Effort: low — jeder Schritt nennt Funktion, Signatur und die Zeilen, aus denen ihr Rumpf kommt; der Auftrag ist Verschieben ohne Verändern, und genau das soll der Implementierer nicht verbessern
- Dateien: `packages/twopoint5d/src/texture/AsepriteJson.ts`, `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, `packages/twopoint5d/src/texture/TextureStore.ts`, neu `packages/twopoint5d/src/texture/SharedImageCache.ts`, neu `packages/twopoint5d/src/texture/SharedImageCache.spec.ts`, neu `packages/twopoint5d/src/texture/loadCatalog.ts`
- Nicht anfassen: `TextureResource.ts`, `internals.ts`, `public-api.ts`, jede Spec außer der neuen `SharedImageCache.spec.ts`, `CHANGELOG.md`, Guides, Proposals
- Verify: `pnpm run ci`
- Commit: `refactor(twopoint5d): run AsepriteJson.parse() and FrameBasedAnimations#add() as a sequence of named steps, and move the image cache and the catalog load of TextureStore into modules of their own`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · READ-006 unverändert (`AsepriteJson.ts:350–524`, Audit `:350`; `FrameBasedAnimations.ts:426–631`, Audit `:424`) · READ-007 unverändert, um wenige Zeilen verschoben (`TextureStore.ts` 1706 Zeilen, `#images` `:483`, `#imageSource` `:496–524`, Audit `:504`; Instanz-`loadAsync()` `:749–863`, Audit `:745`; `TextureResource.ts:402`, Audit `:401`, Shape-Klassen bleiben, Grund unter »Abweichungen«) · Folgen der Pakete 1–6: keine offen · aus »Offene Befunde« nichts übernommen; Fundstelle von `FrameBasedAnimations.ts:573` wandert mit Schritt 2 nach `framesOfTileRange()`, im Plan vermerkt
  - 2026-11-18 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-6b.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG_MIT_VORBEHALT (TextureStore.ts nur in geänderten Bereichen gelesen; Report-Text erst per Resume `paket-6b.impl-0-versuch-2.json`) · geändert AsepriteJson.ts, FrameBasedAnimations.ts, TextureStore.ts · neu SharedImageCache.ts, SharedImageCache.spec.ts, loadCatalog.ts · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-6b.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (sonnet, effort medium) — beide Findings behoben, 0 kritisch, 0 wichtig, 2 klein · Diff `paket-6b.diff`, Report `paket-6b.review-0.json`
  - 2026-11-18 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-18 Zug 5: Commit f2be2168 auf Verify `paket-6b.verify.log` exit=0 · Offene-Befunde-Eintrag `firstTileId` auf `FrameBasedAnimations.ts:503` (`framesOfTileRange()`) nachgetragen

## Urteil des Reviewers

- READ-006 behoben: `AsepriteJson.parse()` ruft `readSheet`, `assertAsepriteFrames`, `assertFrameTagObjects`, `checkFrameTags`, `planTagAnimations`, `assertPlaybackOfKnownTags`, `assertSlices`, `framesWithSlices` nacheinander; `FrameBasedAnimations#add()` geht über `pickFrames()` an `framesOfList`, `framesOfNamedAtlasFrames`, `framesOfAtlasQuery`, `framesOfTileIds`, `framesOfTileRange`. Prüfreihenfolge und Meldungen zeilengleich.
- READ-007 behoben: Bild-Cache als `SharedImageCache` in `SharedImageCache.ts` mit Spec, `TextureStore` hält `#imageSource = new SharedImageCache()` und ruft in `dispose()` `.clear()`; Ladeversuch als `loadCatalog()` in `loadCatalog.ts`, `TextureStore#loadAsync()` ruft ihn mit Hooks. Shape-Klassen bleiben in `TextureResource.ts` (Abweichung begründet).
- klein: `SharedImageCache.ts:44` — `acquire()` ohne TSDoc.
- klein: `SharedImageCache.spec.ts` — `settleMicrotasks` leert pauschal 8 Microtasks, stille Annahme über die Kettentiefe.
- Vorbehalt des Implementierers: `TextureStore.ts` nur in den geänderten Bereichen gelesen; Nebenbefunde dort nicht ausgeschlossen.

## Rahmen für den Implementierer

Dieses Paket ändert kein Verhalten. Jede Meldung, jede Prüfung und ihre
Reihenfolge, jedes `throw`, jeder Microtask bleibt, wie er ist. Die Reihenfolge
der Prüfungen ist Vertrag: bei einem Json oder einem `add()`-Aufruf mit mehreren
Fehlern muss dieselbe Meldung zuerst kommen wie vorher, und vor der letzten
Prüfung wird nichts hinzugefügt.

- **Rümpfe wandern wörtlich.** Erlaubt sind nur die Ersetzungen, die ein Schritt
  ausdrücklich nennt (ein Name aus dem umgebenden Rumpf wird zum Parameter, ein
  `this.#…` zum Hook). Keine Umformulierung einer Meldung, keine neue Prüfung,
  keine zusammengelegte Schleife, kein anderes `Array`-Verfahren.
- **Kommentare wandern mit ihrem Code.** Ein Kommentar, der mit »below« oder
  »above« auf Code zeigt, der jetzt in einer anderen Funktion steht, nennt diese
  Funktion beim Namen; die Schritte geben den Wortlaut vor, wo es dazu kommt.
  Kein Satz über den Vorzustand (»moved from«, »extracted«, »used to«).
- **Typen:** dieselben Casts wie im Ursprungszweig, kein neues `any`, kein
  `@ts-expect-error`, kein `!` außer den vorhandenen.
- **Specs als Beleg.** `AsepriteJson.spec.ts`, `FrameBasedAnimations.spec.ts`,
  `TextureStore.spec.ts` und `TextureResource.spec.ts` bleiben Zeichen für
  Zeichen, wie sie sind; `git diff --stat` nennt keine von ihnen. Müsste eine
  davon geändert werden, hat sich Verhalten geändert — dann nicht anpassen,
  sondern als `BLOCKIERT` melden, mit dem roten Test.
- Kein Bugfix-Paket: kein Regressionstest, kein roter Lauf.
- Neue Module sind intern: nicht in `public-api.ts`, nicht in `src/index.ts`.
  Relative Imports mit `.js`, Typen über `import type`.
- Zwischendurch: `pnpm nx test twopoint5d -- src/texture/` und `pnpm lint`.
  Vor dem Report einmal `pnpm run ci` — nie zwei Läufe nebeneinander.

## Vorgehen

### 1. `AsepriteJson.parse()` in Teilschritte (READ-006, erster Teil)

Alle neuen Funktionen sind modulprivate `const`-Pfeilfunktionen wie
`assertSlices`, ohne `export`, und stehen zwischen `slicesAt` (`:283–303`) und
`export class AsepriteJson` (`:308`), in der Reihenfolge, in der `parse()` sie
ruft. Jede bekommt einen Zeilenkommentar darüber, der sagt, was sie prüft oder
baut und was sie antwortet — im Ton der Kommentare über `assertSlices` und
`slicesAt`.

a. **Typ `AsepriteSheet`** (modulprivates `interface`):

   ```ts
   // the json as parse() reads it: its frames in their order, each by its name, and the frame tags
   // and slices of its meta — the tags checked to be a list, the slices not yet checked
   interface AsepriteSheet {
     readonly isArray: boolean;
     readonly entries: [name: string, frameData: AsepriteJsonFrameData][];
     readonly tags: readonly unknown[];
     readonly slices: unknown;
   }
   ```

b. **`readSheet(data: AsepriteJsonData): AsepriteSheet`** — Rumpf aus `:354–381`
   wörtlich (die drei `TypeError` für Json, `frames` und `meta`, `isArray`,
   `entries`, `tags`, `slices`, die Prüfung von `meta.frameTags` als Liste),
   antwortet `{isArray, entries, tags, slices}`. Im Kommentar `:368–369` wird
   »is refused below, by its index« zu »is refused by assertAsepriteFrames(), by
   its index«.

c. **`assertAsepriteFrames({isArray, entries}: AsepriteSheet): void`** — Rumpf
   aus `:386–413` (Objekt- und `filename`-Prüfung je Eintrag, Frame-Name doppelt,
   Dauer jedes Frames). Vom Kommentar `:383–385` kommt der zweite Satz hierher,
   über die Schleife der doppelten Namen (`:401`), im Wortlaut: `// A name twice
   in "Array" would overwrite its first frame in framesWithSlices(); Aseprite
   writes it when the filename format has no {frame}`.

d. **`assertFrameTagObjects(tags: readonly unknown[]): void`** — Rumpf aus
   `:417–426` (Tag kein Objekt, Name kein String).

e. **`checkFrameTags(frameTags: readonly AsepriteFrameTag[], frameCount: number,
   options: AsepriteParseOptions | undefined): Map<string, AnimationPlayback>`** —
   Rumpf aus `:428–472` samt den Deklarationen `tagNames` und `overrides` aus
   `:415–416`; antwortet `overrides`. Einzige Ersetzung: `entries.length` (in
   `inRange` und in der Meldung `:436`) wird `frameCount`.

f. **Typ und Funktion der Pläne**:

   ```ts
   interface TagAnimationPlan {
     name: string;
     timing: AnimationTimingOptions;
     frameNames: string[];
   }
   ```

   **`planTagAnimations(frameTags: readonly AsepriteFrameTag[], entries:
   AsepriteSheet['entries'], overrides: ReadonlyMap<string, AnimationPlayback>):
   TagAnimationPlan[]`** — Rumpf aus `:473–490` samt der Deklaration `plans` aus
   `:414` (dort mit dem neuen Typ); antwortet `plans`.

g. **`assertPlaybackOfKnownTags(options: AsepriteParseOptions | undefined,
   frameTags: readonly AsepriteFrameTag[]): void`** — Rumpf aus `:491–497`. Die
   Menge `tagNames` baut sie selbst als `new Set(frameTags.map(({name}) => name))`:
   nach `checkFrameTags()` sind die Namen eindeutig, die Reihenfolge der Menge ist
   die der Tags, die Meldung bleibt dieselbe.

h. **`framesWithSlices(entries: AsepriteSheet['entries'], slices: readonly
   AsepriteSlice[]): Record<string, AsepriteFrameData>`** — Rumpf aus `:500–509`
   samt seinem Kommentar `:500`; antwortet `frames`.

i. **`parse()`** behält Signatur und TSDoc (`:309–353`) und ruft nur noch auf, in
   genau dieser Reihenfolge:

   ```ts
   const sheet = readSheet(data);
   // Everything is checked and every animation planned before the first frame is added, so a
   // refused sheet leaves the target as it was
   assertAsepriteFrames(sheet);
   assertFrameTagObjects(sheet.tags);
   const frameTags = sheet.tags as AsepriteFrameTag[];
   const overrides = checkFrameTags(frameTags, sheet.entries.length, options);
   const plans = planTagAnimations(frameTags, sheet.entries, overrides);
   assertPlaybackOfKnownTags(options, frameTags);
   assertSlices(sheet.slices);

   const frames = framesWithSlices(sheet.entries, sheet.slices as AsepriteSlice[]);
   ```

   Danach `:510–523` wörtlich: der Kommentar und der Aufruf von
   `TexturePackerJson.parse({frames, meta: data.meta}, …)`, der Kommentar und die
   Schleife über `animations.add()` (Destrukturierung `frameNames: names` bleibt),
   `return [atlas, data.meta, animations]`. Beide Lesezugriffe auf `data.meta`
   bleiben Lesezugriffe auf `data`, nicht auf ein Feld von `sheet`.

### 2. `FrameBasedAnimations#add()` in Teilschritte (READ-006, zweiter Teil)

Je Frame-Quelle ein Resolver mit Rückgabe `{frames, trims, atlasFrames}`, wie
das Audit empfiehlt. Alles modulprivat, als `const`-Pfeilfunktionen wie
`resolveTiming`, direkt über `export class FrameBasedAnimations` (`:359`), nach
`renderFloatsBuffer`, in dieser Reihenfolge:

a. ```ts
   // the frames an add() picked, in the order they are played: their coords, the trim margins of
   // each, and the frames animation() hands out
   interface PickedFrames {
     frames: TextureCoords[];
     trims: FrameTrimMargins[];
     atlasFrames: TextureAtlasFrame<unknown>[];
   }

   // the arguments of add(), one tuple per form
   type AddArguments = Parameters<FrameBasedAnimations['add']>;

   // only the frames of an atlas carry data to read margins from
   const untrimmed = (frames: readonly TextureCoords[]): FrameTrimMargins[] =>
     frames.map((): FrameTrimMargins => [0, 0, 0, 0]);
   ```

   `untrimmed` ist der Ausdruck aus `:585` wörtlich, mit dessen Kommentar `:584`.

b. **`framesOfList(list: TextureCoords[], name: AnimName | undefined):
   PickedFrames`** — Rumpf aus `:464–476`; dazu `trims: untrimmed(frames)` und
   `atlasFrames: frames.map((coords) => ({coords}))` (der Ausdruck aus `:587`
   wörtlich, mit dem Kommentar `:586`). Im Kommentar `:474–475` wird »the checks
   below and the bake see what was registered« zu »the checks in add() and the
   bake see what was registered«.

c. **`framesOfNamedAtlasFrames(atlas: TextureAtlas<unknown>, frameNames:
   readonly unknown[], name: AnimName | undefined): PickedFrames`** — Rumpf aus
   `:478–498` samt Kommentar `:478–480`; `(args[3] as readonly unknown[])` wird
   `frameNames`.

d. **`framesOfAtlasQuery(atlas: TextureAtlas<unknown>, query: unknown, name:
   AnimName | undefined): PickedFrames`** — Rumpf aus `:501–539`; `args[3]` wird
   `query`. Die lokale Konstante `frameNames` (`:531`) behält ihren Namen.

e. **`framesOfTileIds(tileSet: TileSet<unknown>, tileIds: readonly unknown[],
   name: AnimName | undefined): PickedFrames`** — Rumpf aus `:543–553`; nach der
   Prüfung `tileSet.frame(tileId as number)`; dazu `trims: untrimmed(frames)`.

f. **`framesOfTileRange(tileSet: TileSet<unknown>, firstTileId: number |
   undefined, tileCount: number | undefined, name: AnimName | undefined):
   PickedFrames`** — Rumpf aus `:555–576`; `args[3]` wird `firstTileId`,
   `args[4]` wird `tileCount`, die lokalen Konstanten heißen dann `first` und
   `count` statt `firstTileId` und `tileCount` (`:570–571`), damit sie die
   Parameter nicht verdecken; dazu `trims: untrimmed(frames)`. **Die Schleife
   `:573` bleibt, wie sie ist** — auch mit ihrem bekannten Mangel ab ±2^53 (siehe
   »Offene Befunde« im Plan); den behebt die Drain-Runde, nicht dieses Paket.

g. **`pickFrames(args: AddArguments, name: AnimName | undefined):
   PickedFrames`** — die Weiche aus `:463–582` in derselben Reihenfolge der
   Bedingungen, jeder Zweig ein `return` des passenden Resolvers mit den
   Ausdrücken `args[2]`, `args[3]`, `args[4]` wie im Original; der letzte Zweig
   wirft die Meldung aus `:579–581` wörtlich. Casts, wo der Typ der Weiche nicht
   reicht, wie im Original (`args[3] as number | undefined` aus `:570`).

h. **`add()`** behält Signatur und TSDoc (`:385–449`) und wird:

   ```ts
   let [name] = args;
   // :452–457 wörtlich (Name schon vergeben)
   const {frames, trims, atlasFrames} = pickFrames(args, name);

   const id = this.#names.length;
   // :591–598 wörtlich (keine Frames), Kommentar angepasst, siehe unten
   // :600–609 wörtlich (Timing, Dauer)
   // :611–616 wörtlich (anonymer Name)
   // :618–628 wörtlich (Registrierung)
   return id;
   ```

   Die Deklarationen `:459–461` und die Ersatzwerte `:584–587` entfallen in
   `add()`, sie stehen jetzt in den Resolvern. Im Kommentar `:591–593` wird
   »The guard sits behind the branches, because all four of them can arrive here
   empty« zu »The guard sits behind pickFrames(), because a list, an atlas and a
   tile set can each arrive here empty«.

### 3. Bild-Cache als eigene Klasse (READ-007, erster Teil)

a. Neu `src/texture/SharedImageCache.ts`:

   ```ts
   import {ImageLoader} from 'three/webgpu';
   import type {ImageLease, TextureImageSource} from './internals.js';

   /**
    * <der Kommentar aus TextureStore.ts:485–495 als TSDoc, Satz für Satz;
    *  »One fetch per url …« beginnt ihn>
    */
   export class SharedImageCache implements TextureImageSource {
     #images = new Map<string, {image: Promise<HTMLImageElement>; refCount: number}>();

     acquire(url: string): ImageLease {
       // Rumpf aus TextureStore.ts:498–522 wörtlich, `this.#images` bleibt `this.#images`
     }

     /** Forgets every image. A lease still out gives nothing back afterwards, and the next `acquire()` of its url loads anew. */
     clear(): void {
       this.#images.clear();
     }
   }
   ```

   `acquire` ist eine Methode, keine Pfeil-Eigenschaft: `TextureResource` ruft
   sie als `this[imageSource]?.acquire(url)` (`TextureResource.ts:955`), `this`
   ist dort der Cache. Die Pfeile darin (`.catch`, `release`, `queueMicrotask`)
   binden `this` an den Cache wie bisher an den Store.

b. In `TextureStore.ts`: die Felder `#images` (`:483`) und `#imageSource`
   (`:485–524`, Kommentar und Objekt) werden ein Feld

   ```ts
   // the images every resource of this store fetches through: one fetch per url, shared, see
   // SharedImageCache
   #imageSource = new SharedImageCache();
   ```

   an derselben Stelle. `this.#images.clear()` in `dispose()` (`:1698`) wird
   `this.#imageSource.clear()`. Die beiden Injektionen `:1226` und `:1345`
   bleiben unverändert. Aus den Imports fallen `ImageLoader` (`:3`; der Import wird
   dann `import type {Texture, WebGPURenderer} from 'three/webgpu'`), `type
   ImageLease` und `type TextureImageSource` (`:9`, `:13`), sofern nichts sonst
   sie braucht — `pnpm lint` sagt es.

c. Neu `src/texture/SharedImageCache.spec.ts`, Vitest, `ImageLoader` gemockt wie
   in `TextureStore.spec.ts:326` über `vi.spyOn(ImageLoader.prototype,
   'loadAsync')`, Mocks in `afterEach` zurückgesetzt. Microtasks leeren mit
   `await Promise.resolve()` bzw. so oft wie nötig; jeder Fall zählt die Aufrufe
   von `loadAsync`. Ein `describe('SharedImageCache')` mit genau diesen Fällen:
   - `two leases of one url share one load` — zweimal `acquire('a.png')`: ein Aufruf, beide `image` sind dasselbe Promise.
   - `a lease taken in the microtask after the last one came back keeps the image` — `acquire`, `release()`, sofort wieder `acquire`, Microtasks leeren: ein Aufruf.
   - `the image is given up once its last lease has come back, and the next lease loads anew` — `acquire`, `release()`, Microtasks leeren, `acquire`: zwei Aufrufe.
   - `a load that failed is dropped, and the next lease of the url loads anew` — erster Aufruf lehnt ab, Ablehnung abwarten, `acquire`: zwei Aufrufe.
   - `a lease of a failed load leaves the load that took its place cached when it comes back` — Lease A, Load lehnt ab, Lease B (neuer Load, hängt), `A.release()`, Microtasks leeren, Lease C: zwei Aufrufe, `C.image === B.image`.
   - `a second release() of one lease gives back nothing more` — Leases A und B, `A.release()` zweimal, Microtasks leeren, Lease C: ein Aufruf.
   - `clear() forgets every image, and a lease out before it gives back nothing of the next load` — Lease A, `clear()`, Lease B, `A.release()`, Microtasks leeren, Lease C: zwei Aufrufe, `C.image === B.image`.

### 4. Ladeversuch von `loadAsync()` als Funktion (READ-007, zweiter Teil)

a. Neu `src/texture/loadCatalog.ts`. Es übernimmt aus `TextureStore.ts` die
   Helfer `hrefOf` (`:210`) und `loadFailedError` (`:212–217`, mit Kommentar)
   wörtlich und exportiert beide; `TextureStore.ts` importiert sie von dort
   (`hrefOf` braucht der Store für `what`, `loadFailedError` das statische
   `loadAsync()` `:394`). Dazu:

   ```ts
   import {describeValue} from '../utils/describeValue.js';
   import type {TextureStoreErrorEvent} from './TextureStore.js';
   import type {TextureStoreData} from './types.js';

   /** What one load of a catalog takes from the store it loads for. */
   export interface CatalogLoad<T> {
     /** The url of the catalog. */
     readonly url: string | URL;
     /** The call the messages name, `loadAsync("<url>")`. */
     readonly what: string;
     /** The signal of the caller, or `undefined`. */
     readonly signal: AbortSignal | undefined;
     /** Aborted when the store is disposed. */
     readonly disposal: AbortSignal;
     /** The error the load rejects with once `disposal` aborts. */
     disposedError(): Error;
     /** Cuts short the load of the store that is still under way, and books `cutShort` in its place. */
     supersede(cutShort: () => void): void;
     /** Takes `cutShort` back, if it is still the one booked. */
     withdraw(cutShort: () => void): void;
     /** Reports a step that failed as an `error` event of the store. */
     report(event: TextureStoreErrorEvent): void;
     /** Parses the catalog: the load resolves with what it answers, and a throw fails the parse step. */
     parse(data: TextureStoreData): T;
   }

   /**
    * Fetches the catalog at `load.url` and hands it to `load.parse`, cut short by the signal of the
    * caller, by the disposal of the store and by the next load of the same store.
    * TextureStore#loadAsync() says what the promise does.
    */
   export const loadCatalog = <T>(load: CatalogLoad<T>): Promise<T> => { … };
   ```

   Der import-type-Kreis `loadCatalog.ts` ↔ `TextureStore.ts` ist zur Laufzeit
   keiner (gelöscht beim Übersetzen) und hat ein Vorbild in `internals.ts` ↔
   `TextureResource.ts`.

b. Rumpf von `loadCatalog`, in dieser Reihenfolge:
   1. `const {url, what, signal} = load;`
   2. die Prüfung des schon abgebrochenen Signals aus `:755` wörtlich
      (`if (signal?.aborted) return Promise.reject(new DOMException(…, 'AbortError'));`)
   3. `return new Promise<T>((resolve, reject) => { … })` mit dem Rumpf aus
      `:760–861` wörtlich, Kommentare eingeschlossen, und nur diesen Ersetzungen:
      - `disposal` (`:768`, `:790`) wird `load.disposal`; die Konstante `:757` entfällt.
      - `if (this.#loadUnderWay === onSuperseded) this.#loadUnderWay = undefined;` (`:769`) wird `load.withdraw(onSuperseded);`
      - `this.#loadUnderWay?.(); this.#loadUnderWay = onSuperseded;` (`:792–793`) wird `load.supersede(onSuperseded);`
      - `cutShort(disposedError(what))` (`:779`) wird `cutShort(load.disposedError())`
      - `reportError(this, …)` (`:799`) wird `load.report(…)`, das Objekt darin bleibt Zeichen für Zeichen
      - `this.parse(data, {...parseOptions, baseUrl: parseOptions.baseUrl ?? url});` (`:847`) wird `parsed = load.parse(data);` mit `let parsed: T;` direkt vor dem `try`, und `resolve(this)` (`:852`) wird `resolve(parsed)`

c. `TextureStore#loadAsync()` behält Signatur und TSDoc (`:713–748`) und wird:

   ```ts
   loadAsync(url: string | URL, options?: TextureStoreLoadOptions): Promise<this> {
     const what = `loadAsync(${describeValue(hrefOf(url))})`;
     if (this.#disposed) return Promise.reject(disposedError(what));

     // the signal belongs to this call and not to the parse
     const {signal, ...parseOptions} = options ?? {};

     return loadCatalog<this>({
       url,
       what,
       signal,
       disposal: this.#disposal.signal,
       disposedError: () => disposedError(what),
       supersede: (cutShort) => {
         this.#loadUnderWay?.();
         this.#loadUnderWay = cutShort;
       },
       withdraw: (cutShort) => {
         if (this.#loadUnderWay === cutShort) this.#loadUnderWay = undefined;
       },
       report: (event) => reportError(this, event),
       parse: (data) => {
         this.parse(data, {...parseOptions, baseUrl: parseOptions.baseUrl ?? url});
         return this;
       },
     });
   }
   ```

   Die Prüfung `this.#disposed` bleibt im Store vor `loadCatalog`: ein Listener
   des `dispose`-Events, der `loadAsync()` ruft, findet `#disposed` schon gesetzt,
   `#disposal` aber noch nicht abgebrochen (`dispose()` bricht es erst nach
   `off(this)` ab, `:1688`) — mit `disposal.aborted` als Prüfung würde er einen
   Fetch starten. `loadCatalog` gibt sein Promise unverändert zurück, ohne
   `.then()`: ein zusätzlicher Schritt verschöbe jede Auflösung um einen
   Microtask. Die Felder `#disposal` und `#loadUnderWay` und ihre Kommentare
   bleiben im Store.

### 5. Abschluss

- `pnpm run ci` grün; `git diff --stat` nennt genau die sechs Dateien oben.
- Kein CHANGELOG-Eintrag: die öffentliche API ändert sich nicht (Konvention im
  Plan: »Jede öffentliche Änderung bekommt ihren Eintrag«). Kein Guide, kein
  Proposal: keiner beschreibt die Interna, die sich bewegen
  (`packages/twopoint5d/docs/architecture.md`, Abschnitt `texture/`, nennt keine
  Dateien des Stores).

## Für Zug 5

- In »Offene Befunde« des Plans den Eintrag `FrameBasedAnimations.ts:573`
  (`firstTileId` ab ±2^53) auf die neue Fundstelle umschreiben: Datei bleibt,
  Zeile der Schleife in `framesOfTileRange()` nach dem Commit, »(TileSet-Zweig
  von `add()`)« wird »(`framesOfTileRange()`, Kachelspanne von `add()`)«; den
  Vermerk »Fundstelle wandert mit Paket 6b …« am Zeilenende streichen.
- `Schnittstellen:` für spätere Pakete: neu intern `SharedImageCache`
  (`SharedImageCache.ts`), `loadCatalog()` mit `CatalogLoad<T>`, `hrefOf()`,
  `loadFailedError()` (`loadCatalog.ts`); in `AsepriteJson.ts` und
  `FrameBasedAnimations.ts` nur modulprivate Funktionen; keine Exporte neu oder
  entfernt.

## Abweichungen von der Empfehlung

- **READ-007, Shape-Klassen von `TextureResource.ts`.** Die Empfehlung nennt sie
  mit »ggf.«; sie bleiben in `TextureResource.ts`. Die statischen Fabriken der
  abstrakten Basis — `TextureResource.fromImage()`, `.fromTileSet()`,
  `.fromAtlas()` (`:403`, `:414`, `:433`) — bauen die Unterklassen
  (`ImageTextureResource` `:1155`, `TileSetTextureResource` `:1205`,
  `AtlasTextureResource` `:1363`). In eigenen Dateien entstünde ein Importkreis,
  in dem `class … extends TextureResource` ausgewertet wird, bevor die Basis
  steht (TDZ), sobald zuerst `TextureResource.ts` geladen wird; tragen würde das
  nur eine Brücke mit Registrierung wie `unfilledInternal` aus Paket 5 — neue
  Indirektion für einen optionalen Teil einer Lesbarkeits-Empfehlung, der
  Gegenteil ihres Zwecks. Der Kern des Findings — Bild-Cache und Ladeversuch
  stecken im 1706-Zeilen-Store — ist mit Schritt 3 und 4 behoben.
- **READ-007, »eigenständig testen«.** `SharedImageCache` bekommt eine eigene
  Spec (Schritt 3c): ihre Invarianten — Freigabe einen Microtask später, Lease
  eines Nachfolgers unberührt — sind am Store nur mittelbar sichtbar.
  `loadCatalog` bekommt keine: sein Vertrag ist der dokumentierte Vertrag von
  `TextureStore#loadAsync()`, den `TextureStore.spec.ts` in über zwanzig Fällen
  hält (`:242`, `:543–613`, das `describe('loadAsync()')` ab `:618`, `:2334` ff.); eine zweite Suite gegen
  die Hooks hielte dieselben Pfade noch einmal, über einen nachgebauten Store.
- **READ-006, Ort der Resolver.** Sie bleiben in `FrameBasedAnimations.ts` neben
  `resolveTiming()`, statt in ein eigenes Modul zu wandern: das Finding betrifft
  die Länge der Methode, nicht die der Datei, und so sieht der Reviewer jede
  verschobene Zeile im selben Datei-Diff.

## Nebenbefunde und Folgen aus Zug 0

- Folgen der Pakete 1–6: alle `keine`, nichts zu verteilen.
- »Offene Befunde«: kein Eintrag teilt die Ursache dieses Pakets (Lesbarkeit
  durch Länge). Der Eintrag `FrameBasedAnimations.ts:573` liegt in der Methode,
  die Schritt 2 zerlegt, hat aber eine eigene Ursache (fehlende Prüfung auf
  sichere Ganzzahl); ihn hier mitzunehmen, legte eine Verhaltensänderung in einen
  reinen Verschiebe-Diff — genau das, wogegen Paket 6 dieses Paket abgeteilt hat.
  Er bleibt `→ Scope` für die Drain-Runde, seine Fundstelle wandert (»Für Zug 5«).

## Restplan

Keine Änderung an Reihenfolge oder Schnitt der offenen Pakete 7–11: dieses
Paket bewegt nur Interna von `src/texture/`, keine öffentliche Signatur und
keinen Export; Paket 9 (»Hängt ab von: 3 bis 8«) steht ohnehin dahinter, und
kein anderes offenes Paket berührt `src/texture/`.

## Findings im Volltext

**READ-006 · low · packages/twopoint5d/src/texture/AsepriteJson.ts:350** (dazu `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:424`) — Überlange Validierungs- und Registrierungsmethoden in Teilschritte zerlegen
AsepriteJson.parse() ist eine statische Methode von rund 175 Zeilen, die Json-Form prüfen, Frame-Namen prüfen, Tags prüfen, Animationen planen, Slices prüfen und den Atlas bauen in einem Rumpf vermischt. FrameBasedAnimations#add() hat rund 190 Zeilen mit fünf Frame-Quellen-Zweigen, Timing-Auflösung und Registrierung. Die Reihenfolge der Prüfungen ist dabei Teil des Vertrags (nichts wird vor dem letzten Check hinzugefügt), was die Methoden schwer änderbar macht.
Empfehlung: Je Phase eine Funktion (z. B. assertAsepriteFrames, planTagAnimations; je Frame-Quelle ein Resolver mit Rückgabe {frames, trims, atlasFrames}), die in parse()/add() nur noch nacheinander aufgerufen werden.

**READ-007 · low · packages/twopoint5d/src/texture/TextureStore.ts:504** (dazu `TextureStore.ts:745`, `packages/twopoint5d/src/texture/TextureResource.ts:401`) — Bild-Cache und Ladeversuch aus `TextureStore.ts` herauslösen
`TextureStore.ts` (1703 Zeilen) vereint Katalogprüfung, Katalog-Fetch mit Abort/Supersede-Logik, den referenzgezählten Bild-Cache, die Abo-/Lease-Maschinerie und das Fehlerprotokoll; `TextureResource.ts` (1817 Zeilen) enthält Basis und drei Shape-Klassen. Mit `ResourceFollower.ts`, `fetchAtlasJson.ts` und `checkTextureStoreData.ts` ist das Herauslösen schon an drei Stellen gelungen; der Bild-Cache (`#imageSource`/`#images`) und der `loadAsync()`-Versuch sind in sich geschlossen und würden sich ebenso eigenständig testen lassen.
Beleg: `#imageSource: TextureImageSource = { acquire: … }` inline im Store
Empfehlung: Den Bild-Cache als eigene Klasse hinter `TextureImageSource` (internals.ts) und den Ladeversuch von `loadAsync()` als Funktion in eigene Module ziehen; die Shape-Klassen ggf. in eigene Dateien.
