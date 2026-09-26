# Paket 5 — TextureResource: Shape im Konstruktor, load() nach Shapes zerlegt, geleertes Bild nimmt zurück

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-054 (low), API-047 (low), READ-011 (low), DOC-042 (low), DOC-043 (low) · dazu
  der Testpunkt von TEST-016 für API-047 · dazu aus »Offene Befunde« der vorbestehende
  Nebenbefund »ein `atlasJson`, das vor `load()` geschrieben wird, greift nicht« (gleiche Ursache
  wie API-047, siehe »Triage«)
- Ziel: Eine `TextureResource` legt ihre Shape im Konstruktor fest, registriert ihre Effekte in je
  einem Registrierer pro Shape und nimmt bei geleertem `imageUrl` alles Abgeleitete zurück — mit
  einer TSDoc, die genau das sagt.
- Modell: stärkste Stufe — ein Umbau der ganzen Effekt-Registrierung einer 1030-Zeilen-Datei, deren
  Korrektheit an Registrierungsreihenfolge, Effekt-Prioritäten, statischen Deps (signalize), dem
  Räumen retained Events (eventize) und der Freigabe-Reihenfolge der Texture hängt; das Hauptrisiko
  ist eine Verschiebung, die still eine Reihenfolge ändert, und ein Test, der aus dem falschen Grund
  grün ist
- Effort: medium — Struktur, Namen, Signaturen und die neuen Zweige stehen unten fest, der
  Implementierer überträgt sie
- Dateien: `packages/twopoint5d/src/texture/TextureResource.ts`,
  `packages/twopoint5d/src/texture/TextureResource.spec.ts`,
  `packages/twopoint5d/src/texture/TextureStore.spec.ts` (ein Test),
  `packages/twopoint5d/docs/resource-lifecycle.md` (ein Halbsatz),
  `packages/twopoint5d/CHANGELOG.md`
- Vor dem Code lesen: `AGENTS.md`; die Skills `using-signalize` (Pitfall 7: statische Deps laufen
  nicht bei der Registrierung, nur auf eine Änderung) und `using-eventize` (`retain`,
  `retainClear`, `emitStrict`), für den CHANGELOG `updating-changelog`. `TextureResource.ts` ganz
  lesen, nicht nur die Fundstellen.

## Vorgehen

Alle Zeilennummern gegen HEAD `686a4597`. Code, Kommentare, TSDoc und CHANGELOG auf Englisch, im Ton
der Datei; Kommentare erklären das Warum. Keine Finding-IDs, kein Rückblick auf den Vorzustand (»no
longer«, »now«, »instead of before«) — auch nicht im CHANGELOG. Zeilen, die dieses Paket neu
schreibt, bleiben unter der `printWidth` von 130; ein langer Meldungstext wird dafür in zwei
Template-Literale mit `` ` + `` geteilt (Idiom der Library, z. B. `VOBufferPool.ts:284`), der Text
selbst bleibt Zeichen für Zeichen gleich.

Zuerst die Regressionstests aus Schritt 10 schreiben und rot laufen lassen, den roten Lauf in den
Report, dann Schritt 1–9 und 11–12.

**Die Zerlegung in Schritt 4–8 ist Verschieben, nicht Umschreiben.** Jeder Effekt wandert samt
Kommentaren, Abhängigkeiten, `priority` und `attach` unverändert in seinen Registrierer; geändert
wird nur, was ein Schritt ausdrücklich nennt. Die Reihenfolge der Registrierung bleibt exakt die
heutige — Bridges, Bild-Effekt, Tile-Set-Effekt, Tile-Set-Animationen, Fetch-Effekt,
Atlas-Image-Effekt, `imageUrl`-aus-Json-Effekt, Atlas-Parse-Effekt, Atlas-Animationen, die
`touch()`-Aufrufe, Standalone-Factory-Fallback: der Kommentar an `DERIVED_FROM_IMAGE_PRIORITY`
`:125-135` hängt an ihr. Was Paket 8 festgelegt hat, bleibt stehen: die Bridges dispatchen mit
`emitStrict()`, Tile Set und Atlas gehen in einem `batch()` hinaus, `#fail` und das Veröffentlichen
stehen im Fetch- und im Bild-Effekt hinter dem `try`, der Bild-Effekt hat keinen abschließenden
`.catch`.

1. **Eingaben der Shape im Konstruktor.**
   - Neues, nicht exportiertes Interface auf Modulebene, direkt vor
     `export interface TextureResource extends EventizedObject {}` `:182-183`:

     ```ts
     // the inputs only an atlas resource carries
     interface AtlasSignals {
       readonly atlasUrl: Signal<string | undefined>;
       readonly atlasJson: Signal<TexturePackerJsonData | undefined>;
       // <der Kommentar von :275-276 wandert hierher>
       readonly fetchedAtlasJson: Signal<AtlasJsonResponse | undefined>;
       readonly overrideImageUrl: Signal<string | undefined>;
     }
     ```

   - Die Felder `:273-281` werden ersetzt durch:

     ```ts
     // the inputs of one shape each, created by the constructor for that shape and no other: a
     // setter of another shape finds none and throws, and load() registers the effects of the
     // shape they belong to
     readonly #tileSetOptions?: Signal<TileSetOptions | undefined>;
     readonly #atlasSignals?: AtlasSignals;

     // outputs sit on every resource, like the texture: a shape that builds no atlas or no tile
     // set leaves them `undefined`
     #atlas = createSignal<TextureAtlas | undefined>(undefined, {attach: this});
     #tileSet = createSignal<TileSet | undefined>(undefined, {attach: this});
     ```

     Begründung für die Teilung: Eingaben mit Setter sind shape-gebunden (der Setter wirft auf der
     falschen Shape), Ausgaben haben keinen Setter und lesen `undefined`, wo die Shape sie nie baut
     — so, wie `#frameBasedAnimations` heute schon auf jeder Resource liegt. Die Bridges brauchen
     damit kein optionales Signal mehr.

   - Konstruktor `:497-504`, zwischen `this.type = type;` und `retain(...)`:

     ```ts
     if (type === 'tileset') {
       this.#tileSetOptions = createSignal<TileSetOptions | undefined>(undefined, {compare: cmpShallow, attach: this});
     } else if (type === 'atlas') {
       this.#atlasSignals = {
         atlasUrl: createSignal<string | undefined>(undefined, {attach: this}),
         atlasJson: createSignal<TexturePackerJsonData | undefined>(undefined, {attach: this}),
         fetchedAtlasJson: createSignal<AtlasJsonResponse | undefined>(undefined, {attach: this}),
         overrideImageUrl: createSignal<string | undefined>(undefined, {attach: this}),
       };
     }
     ```

   - TSDoc am Konstruktor (neu):

     ```ts
     /**
      * A resource of the given `type`, with the inputs of that shape and of no other: an `'atlas'`
      * resource takes `atlasUrl`, `atlasJson` and `overrideImageUrl`, a `'tileset'` resource
      * `tileSetOptions`, and {@link TextureResource.load} registers the effects of that shape. The
      * static factories {@link TextureResource.fromImage}, {@link TextureResource.fromTileSet} and
      * {@link TextureResource.fromAtlas} build one the same way and write its first values.
      */
     ```

2. **Die statischen Factories weisen nur noch Werte zu** (`:227-271`). `fromTileSet()` schreibt im
   `batch()` `resource.imageUrl`, `resource.tileSetOptions = tileSetOptions` (Setter),
   `resource.textureClasses`, `resource.frameBasedAnimationsData`; die drei `createSignal`-Zeilen
   `:238-243` entfallen. `fromAtlas()` schreibt `resource.atlasUrl = atlasUrl`,
   `resource.overrideImageUrl = overrideImageUrl` (beide über den Setter), `textureClasses`,
   `frameBasedAnimationsData`; die fünf `createSignal`-Zeilen `:261-265` entfallen. `fromImage()`
   bleibt.

3. **Getter und Setter über die neuen Felder** (`:346-417`).
   - `atlasUrl`, `atlasJson`, `overrideImageUrl` lesen und schreiben `this.#atlasSignals?.<name>`;
     `tileSetOptions` liest `this.#tileSetOptions?.value`; `atlas` und `tileSet` lesen
     `this.#atlas.value` bzw. `this.#tileSet.value` (ohne `?.`). Die `#disposed`-Wachen bleiben.
   - Jeder shape-gebundene Setter bindet das Record bzw. Signal an eine `const` und wirft, wenn es
     fehlt — `const signals = this.#atlasSignals; if (!signals) throw wrongShapeError(this, 'atlasUrl');`.
     Das ist der Guard auf die Shape, den die Empfehlung verlangt: der Konstruktor legt das Record
     genau für diesen `type` an und nie später, und anders als `this.type === 'atlas'` verengt es
     den Typ für TypeScript. Kein zusätzlicher Vergleich auf `this.type`.
   - Neues privates Feld hinter `#atlasFetch` `:489-492`:

     ```ts
     // whether load() starts the fetch of `atlasUrl`: a url that changes makes it due, and an
     // `atlasJson` written after it takes its place, as it cuts short a fetch under way. Read by
     // load() alone — once the effects are registered, a new url starts its fetch by itself
     #atlasFetchDue = false;
     ```

   - Setter `atlasUrl`: vor dem `set()` `if (value !== signals.atlasUrl.value) this.#atlasFetchDue = true;`.
   - Setter `atlasJson` `:374-389`: neben `this.#atlasFetch?.abort(); this.#atlasFetch = undefined;`
     zusätzlich `this.#atlasFetchDue = false;` — für jeden geschriebenen Wert, `undefined`
     eingeschlossen, wie der Abbruch auch. Den Kommentar `:377-379` um »and a fetch that load() has
     yet to start« ergänzen. Die übrigen Zeilen bleiben (`fetchedAtlasJson` auf `undefined`,
     `#loadFailures.delete('atlasFetch')`, dann `atlasJson.set(value)`).

4. **`load()` `:571-1029` wird zum Verteiler:**

   ```ts
   load(): TextureResource {
     if (this.#disposed || this.#load) return this;
     this.#load = true;

     // <Kommentar :577-580 und die lokale Funktion publish :581-591, Parameter `signal` nicht mehr
     // optional: `signal.onChange(...)`>
     // <Kommentar :593-594>
     publish(this.#imageCoords, 'imageCoords');
     publish(this.#atlas, 'atlas');
     publish(this.#tileSet, 'tileSet');
     publish(this.#frameBasedAnimations, 'frameBasedAnimations');
     publish(this.#texture, 'texture');

     this.#registerImageEffect();

     // the type decides which effects run, not the values the resource holds at this call: the
     // inputs of its shape are there from the constructor on, and a value that arrives later
     // reaches the effects that read it
     if (this.#tileSetOptions) this.#registerTileSetEffects(this.#tileSetOptions);
     if (this.#atlasSignals) this.#registerAtlasEffects(this.#atlasSignals);

     // <Standalone-Fallback :1014-1026 unverändert>
     return this;
   }
   ```

   Die Kommentare `:689-692` (»Only fromTileSet() and fromAtlas() create the signals …«) und `:803`
   (»guarded by the signals of the shape as well …«) entfallen, ebenso die lokalen Bindungen und
   `&&`-Guards `:693-697` und `:804-810`.

5. **`#registerImageEffect(): void`** — der Bild-Effekt `:601-687` samt Kommentar `:601-605`
   wandert hierher. Geändert wird nur der Anfang des Callbacks: die drei `.get()` bleiben vor jedem
   Rücksprung (sonst trackt der Effekt nicht alle drei), danach

   ```ts
   // no url, no image: what was built from the last one is taken back. No factory is a "not
   // yet" instead — the texture of the last factory stays until the next one builds
   if (!url) {
     this.#takeBackImage();
     return;
   }
   if (!factory) return;
   ```

   und der Kommentar `:608` wird zu »a new run is a new attempt; a run without a factory is a "not
   yet", one without a url takes the image back«. Ein geleerter `textureFactory` nimmt bewusst
   nichts zurück: `TextureStore` setzt ihn auf jeder Resource auf `undefined`, sobald sein Renderer
   geht (`TextureStore.ts:301-308`), und die Entscheidung des Nutzers betrifft das Bild.

   Neue private Methode, direkt hinter `#registerImageEffect()`:

   ```ts
   // A cleared image takes back what was built from it: the coordinates and the texture here, and
   // with the coordinates the tile set, its atlas and the animations, in the effects that hang off
   // them. The texture was built here and is released here, once the signal has given it up, so no
   // reader reaches a texture that is already freed. Nothing is announced: the bridges clear the
   // retained events instead of handing a subscriber `undefined`
   #takeBackImage(): void {
     const previous = this.#ownTexture;
     this.#ownTexture = undefined;
     try {
       batch(() => {
         this.#imageUrlOfCoords.set(undefined);
         this.#imageCoords.set(undefined);
         this.#texture.set(undefined);
       });
     } finally {
       previous?.dispose();
     }
   }
   ```

   Ein Bild, das beim Leeren noch lädt, baut nichts: die Cleanup des vorigen Laufs setzt `aborted`
   und gibt den Lease zurück, wie heute.

6. **`#registerTileSetEffects(tileSetOptions: Signal<TileSetOptions | undefined>): void`** — der
   Tile-Set-Effekt `:698-744` wandert hierher, `tileSetSignal` wird `this.#tileSet`,
   `tileSetAtlasSignal` wird `this.#atlas`, `tileSetOptionsSignal` wird der Parameter
   (Deps `[this.#imageCoords, tileSetOptions]`, `priority: DERIVED_FROM_IMAGE_PRIORITY`). Geändert:
   `if (!imageCoords) return;` `:702` entfällt; `const options = tileSetOptions.value;`; gebaut wird
   nur unter `if (imageCoords && options)`. Damit läuft ein Lauf ohne Bild in den bestehenden
   Rücknahme-Block `:734-736`. Dessen Kommentar `:726-733` beginnt mit »Nothing on the resource may
   have been built from an image or from options other than the current ones, so without a tile set
   from both of them …« und behält den Rest. Danach die Animationen:
   `this.#registerAnimationsEffect(this.#tileSet, <addEntry der Tile-Set-Shape, Schritt 8>)`.

7. **`#registerAtlasEffects(signals: AtlasSignals): void`** — Fetch-Effekt `:811-888`,
   Atlas-Image-Effekt `:890-919`, `imageUrl`-aus-Json-Effekt `:921-931`, Atlas-Parse-Effekt
   `:933-973` wandern in dieser Reihenfolge hierher. Am Anfang
   `const {atlasUrl: atlasUrlSignal, atlasJson: atlasJsonSignal, fetchedAtlasJson: fetchedAtlasJsonSignal, overrideImageUrl: overrideImageUrlSignal} = signals;`
   (Prettier bricht die Zeile um) und `const atlasSignal = this.#atlas;`, damit die Effekte mit
   ihren heutigen Namen wandern. Geändert:
   - Atlas-Parse-Effekt: `if (!imageCoords) return;` `:950` wird
     `if (!imageCoords) { takeBack(); return; }` mit dem Kommentar »without an image nothing is
     built from one«. Erreichbar ist das auf einer Atlas-Resource, deren von außen geschriebene
     Json kein Bild nennt und die kein `overrideImageUrl` hat: der `imageUrl`-aus-Json-Effekt
     schreibt dann `undefined`, Schritt 5 nimmt Bild und Texture zurück, und ohne diese Zeile bliebe
     der Atlas eines Bildes stehen, das es nicht mehr gibt.
   - Danach die Animationen:
     `this.#registerAnimationsEffect(this.#atlas, <addEntry der Atlas-Shape, Schritt 8>)`.
   - `touch(atlasUrlSignal);` `:1011` wird ersetzt durch:

     ```ts
     // load() takes up what the resource holds at this call as if it were written right after it.
     // These effects have static dependencies and run on a change alone: a json written before
     // the call builds its atlas once touched, and the fetch of `atlasUrl` starts only while it is
     // due — an `atlasJson` written after that url takes its place, as it cuts short a fetch under way
     if (atlasJsonSignal.value !== undefined) touch(atlasJsonSignal);
     if (this.#atlasFetchDue) touch(atlasUrlSignal);
     ```

     Der Touch auf die Json weckt den `imageUrl`-aus-Json-Effekt (der den Bild-Effekt anstößt) und
     den Atlas-Parse-Effekt (ohne Koordinaten eine Rücknahme ohne Wirkung).

8. **`#registerAnimationsEffect` — ein Helfer statt zwei Fast-Duplikaten** (`:746-800`,
   `:975-1009`). Abweichung vom Namen der Empfehlung (`#buildAnimations(add)`): dupliziert ist
   nicht nur die Schleife, sondern der ganze Effekt um sie — Rücknahme ohne Quelle oder Daten,
   Veröffentlichen als ein fertiges Objekt, dieselben Deps. Der Helfer registriert deshalb den
   Effekt.

   ```ts
   // The animations of the current data, built out of the current tile set or atlas. `addEntry`
   // registers one entry or throws for it: an entry it throws for is skipped and reported, and every
   // other entry of the map is registered all the same
   #registerAnimationsEffect<S extends TileSet | TextureAtlas>(
     source: Signal<S | undefined>,
     addEntry: (animations: FrameBasedAnimations, name: string, data: FrameBasedAnimationsData, source: S) => void,
   ): void {
     createEffect(
       () => {
         const from = source.value;
         const animationsData = this.frameBasedAnimationsData;
         // <Kommentar :750-751, »tile set« → »source«>
         if (!from || !animationsData) {
           this.#frameBasedAnimations.set(undefined);
           return;
         }
         // <Kommentar :756-757>
         const animations = new FrameBasedAnimations();
         for (const [name, data] of Object.entries(animationsData)) {
           try {
             addEntry(animations, name, data, from);
           } catch (error) {
             // <Kommentar :790-792>
             emit(this, OnError, {source: 'frameBasedAnimations', id: this.id, animation: name, error});
           }
         }
         this.#frameBasedAnimations.set(animations);
       },
       [source, this.#frameBasedAnimationsData],
       {attach: this},
     );
   }
   ```

   `FrameBasedAnimationsData` kommt zum Import aus `./types.js` dazu. `wrongAnimationDataError`
   `:153-163` gibt nur noch den `Error` zurück (Rückgabetyp `Error`, Text unverändert, in zwei
   Template-Literale geteilt, Kommentar: »… and this is the error it is skipped with«); die Payload
   `{source: 'frameBasedAnimations', id, animation, error}` baut der `catch` des Helfers — dieselbe
   Form wie heute.

   `addEntry` der Tile-Set-Shape (Schritt 6):

   ```ts
   (animations, name, data, tileSet) => {
     const shape = animationDataShape(data);
     if (shape !== 'tileIds' && shape !== 'firstTileId') throw wrongAnimationDataError(this, name, shape);
     // <Kommentar :782-783, einmal über beiden add()-Aufrufen>
     if ('tileIds' in data) {
       // <Kommentar :765-766>
       const {tileIds} = data as {tileIds: unknown};
       if (!Array.isArray(tileIds)) {
         throw new Error(
           `[TextureResource] animation "${name}" of resource "${this.id}" carries tileIds of ${describeValue(tileIds)} ` +
             `— tileIds is an array of tile ids`,
         );
       }
       animations.add(name, data, tileSet, data.tileIds);
     } else if ('firstTileId' in data) {
       animations.add(name, data, tileSet, data.firstTileId, data.tileCount);
     }
   }
   ```

   `addEntry` der Atlas-Shape (Schritt 7):

   ```ts
   (animations, name, data, atlas) => {
     const shape = animationDataShape(data);
     if (shape !== 'frameNameQuery') throw wrongAnimationDataError(this, name, shape);
     // <Kommentar :993-994>
     if ('frameNameQuery' in data) animations.add(name, data, atlas, data.frameNameQuery);
   }
   ```

   Beobachtbar ändert sich nichts: jede Meldung, die heute als `emit` vor dem `try` hinausgeht,
   kommt als Wurf in den `catch` und geht mit derselben Payload hinaus. Die bestehenden Tests unter
   `describe('frame based animations')` `:352` und
   `describe('a tile set animation entry whose tiles cannot be picked is skipped')` `:1903` laufen
   unverändert grün.

9. **TSDoc.**
   - `TextureResourceEvents` `:61-62`, hinter »are retained — late subscribers see the latest
     value.«:

     > A value the resource takes back is not announced: rather than carrying `undefined`, its
     > retained event is cleared, and a subscriber that arrives later waits for the next value.
     > {@link TextureResource} lists when a value is taken back.

   - Klassen-TSDoc `:200-202`: »while its `atlasJson` is cleared or cannot be read — the texture
     stays in both cases« wird »while its `atlasJson` is cleared or cannot be read once the image it
     names is there — the texture stays in both cases«.
   - Klassen-TSDoc, neuer Absatz direkt hinter `:203-205` (»… waits for the next value.«):

     > An image or a tile set resource whose `imageUrl` is cleared takes its `imageCoords` and its
     > `texture` back the same way, together with everything built from them — the `tileSet`, its
     > `atlas` and the `frameBasedAnimations` — and releases the texture it built, since a
     > subscriber only borrows it. An image that is still loading when the url is cleared builds
     > nothing. An atlas resource whose json names no image, with no `overrideImageUrl` to fall back
     > on, has no `imageUrl` either and does the same. A `textureFactory` that is cleared takes
     > nothing back: the texture stays until the next factory builds one.

   - TSDoc von `load()` `:560-562`: der Satz »Which effects are registered follows the shape of the
     resource, whatever values it holds at the call: …« wird zu

     > Which effects are registered follows the `type` of the resource, whatever values it holds at
     > the call: a `tileSetOptions` or an `atlasUrl` that is empty now and set later still reaches
     > them. What the resource holds at the call is taken up as if it were written right after it:
     > an `atlasJson` written before builds its atlas once the image it names is there, and the
     > `atlasUrl` is fetched unless an `atlasJson` was written after it.

   - TSDoc des `atlasJson`-Getters `:360-363`: hinter »… arrives after the write.« den Satz
     »Written before {@link TextureResource.load}, it takes the place of the fetch of the
     `atlasUrl` it was written after.«

10. **Tests** (vor dem Fix rot, wo nicht anders vermerkt; Namen wörtlich übernehmen). Helfer der
    Spec: `makeTextureFactory()` `:32-49`, `asStub()`, `flushMicrotasks()`; die Json `atlasJson`
    `:1616-1619` (Frame `idle.1`, `meta.image: 'atlas.png'`) steht heute im Scope von
    `describe('load()')` — sie wandert unverändert in den Scope von `describe('TextureResource')`
    direkt unter `sandbox` `:54`, damit die neuen `describe`s sie lesen; `ImageLoader.prototype.loadAsync`
    per `vi.spyOn` wie `:1646-1648`, `fetch` per `vi.spyOn(globalThis, 'fetch')` wie `:1645`.

    `TextureResource.spec.ts`, neues `describe('a resource built with its constructor')` hinter
    `describe('setters on the wrong shape')` `:1528-1579`:
    - `new TextureResource(id, 'atlas') takes an atlasUrl and builds its atlas once loaded` —
      der Testpunkt von TEST-016. `new TextureResource('sprites', 'atlas')`; die Writes
      `overrideImageUrl = undefined` und `atlasUrl = 'atlas.json'` werfen nicht; Factory, `load()`,
      zwei Mal flushen: `fetch` einmal mit `'atlas.json'` gerufen, `imageUrl` ist `'atlas.png'`,
      `texture` und `atlas` definiert.
    - `new TextureResource(id, 'tileset') takes tileSetOptions and builds its tile set once loaded`
      — `new TextureResource('tiles', 'tileset')`, `imageUrl = 'tiles.png'`,
      `tileSetOptions = {tileWidth: 16, tileHeight: 16}` (Bild 64×64), Factory, `load()`, flushen:
      `tileSet.tileCount` ist 16, `atlas` ist `tileSet.atlas`.
    - `new TextureResource(id, 'image') carries no input of another shape` — Schutz, heute grün:
      `tileSetOptions`, `atlasUrl`, `atlasJson` und `overrideImageUrl` werfen je den `TypeError`
      `TextureResource "<id>" is an "image" resource and has no "<property>"`.

    `TextureResource.spec.ts`, neues `describe('an atlasJson written before load()')` direkt hinter
    `describe('load()')` `:1581-1720`:
    - `builds its atlas without an atlasUrl` — `TextureResource.fromAtlas('sprites', 'atlas.json')`,
      `atlasUrl = undefined`, `atlasJson = atlasJson`, Factory, `load()`, flushen: `fetch` nicht
      gerufen, `imageUrl` ist `'atlas.png'`, `texture` und `atlas` definiert. (Über `fromAtlas`,
      damit er aus dem Grund dieses Befunds rot ist und nicht am Konstruktor.)
    - `takes the place of the fetch of the atlasUrl it was written after` — `fromAtlas('sprites',
      'atlas.json')`, dann eine Json mit `meta.image: 'own.png'` schreiben, Factory, `load()`, drei
      Mal flushen: `fetch` nicht gerufen, `resource.atlasJson` ist das geschriebene Objekt (`toBe`),
      `imageUrl` ist `'own.png'`, `atlas` definiert, kein `error`.
    - `an atlasUrl written after it is fetched and replaces it` — Schutz, heute grün:
      `fromAtlas('sprites', 'first.json')`, Json mit `'own.png'` schreiben, dann
      `atlasUrl = 'atlas.json'`, Factory, `load()`, drei Mal flushen: `fetch` genau einmal, mit
      `'atlas.json'`, `imageUrl` ist `'atlas.png'`.

    `TextureResource.spec.ts`, neues `describe('an imageUrl that is cleared')` hinter
    `describe('an imageUrl that changes while its image loads')` `:1722-1791`; `error`-Events in
    jedem Test sammeln und am Ende leer erwarten:
    - `takes the texture and the imageCoords back and releases the texture` — `fromImage`, Factory,
      `load()`, flushen; `imageUrl = undefined`: `texture` und `imageCoords` sind `undefined`, die
      Stub-Texture ist `disposed`.
    - `a subscriber that arrives afterwards waits for the next image` — nach dem Leeren
      `on(resource, 'texture', late)`: `late` nicht gerufen; `imageUrl = 'second.png'` (zweites
      Bild mit anderem `tag`), flushen: `late` genau einmal, mit der Texture des zweiten Bildes.
    - `a subscriber of the texture is never handed undefined` — Schutz: ein vor `load()` angelegter
      `texture`-Subscriber ist nach dem Leeren genau einmal gerufen, mit der ersten Texture.
    - `a tile set resource takes its tile set, its atlas and its animations back` —
      `fromTileSet('tiles', 'tiles.png', {tileWidth: 16, tileHeight: 16}, undefined,
      {walk: {duration: 1, firstTileId: 1, tileCount: 2}})`, Bild 64×64, laden bis alles steht;
      `imageUrl = undefined`: `tileSet`, `atlas`, `frameBasedAnimations`, `texture` sind
      `undefined`, die Texture ist `disposed`.
    - `an image cleared while it loads builds no texture` — Schutz: `loadAsync` antwortet auf
      Zuruf; vor der Antwort `imageUrl = undefined`, dann antworten, flushen: `texture` ist
      `undefined`, die Factory hat keine Texture gebaut.
    - `a textureFactory that is cleared leaves the texture in place` — Schutz: nach dem Laden
      `textureFactory = undefined`: `texture` ist dieselbe, nicht `disposed`.
    - `an atlas json written from outside that names no image takes the texture and the atlas back`
      — `fromAtlas('sprites', 'atlas.json')`, `atlasUrl = undefined`, `load()`, Factory, Json
      schreiben, flushen bis `atlas` und `texture` stehen; dann
      `atlasJson = {...atlasJson, meta: {size: atlasJson.meta.size}} as never`, flushen: `atlas` und
      `texture` sind `undefined`, die Texture ist `disposed`.

    `TextureStore.spec.ts`, im `describe('parse() update path')` `:920` als letzter Test:
    - `a tile set item without an imageUrl takes the texture of its resource back, and a get() waits for the next image`
      — Factory wie `:1214-1224` über `store.whenResource()` auf die Resource setzen, Bild-Stub per
      `loadAsync`; `parse` mit `{t: {imageUrl: 'tiles.png', tileSet: {tileWidth: 16, tileHeight: 16}}}`,
      `await store.get('t', 'texture')`; `parse` mit demselben Item ohne `imageUrl`:
      `resource.texture` ist `undefined`, die erste Texture ist `disposed`,
      `settleWithin(store.get('t', 'texture'))` ist `'pending'`; `parse` mit
      `imageUrl: 'tiles2.png'`: dieses `get()` löst mit `resource.texture` auf.

    Die bestehenden Tests laufen unverändert grün. Muss einer angepasst werden, ist das ein Befund
    für den Report, kein Anlass zur Anpassung.

11. **`docs/resource-lifecycle.md:24-26`**: »it keeps the texture it built and disposes it itself«
    wird »it keeps the texture it built and disposes it itself — when a successor takes its place,
    when its `imageUrl` is cleared and on `dispose()` —«; der Rest des Satzes bleibt.

12. **CHANGELOG** `packages/twopoint5d/CHANGELOG.md`, `[Unreleased]`, nach Skill
    `updating-changelog`:
    - `### Changed`, neuer Eintrag hinter `:88` (dem `imageUrl`-Eintrag): ein image- oder
      tileset-`TextureResource`, dessen `imageUrl` geleert wird — direkt oder durch ein
      `TextureStore#parse()`, dessen Tile-Set-Item keins trägt —, nimmt `imageCoords`, `texture`
      und das daraus Gebaute (`tileSet`, `atlas`, `frameBasedAnimations`) zurück und gibt die
      eigene Texture frei; die Getter antworten `undefined`, die retained Events werden geräumt,
      ein späteres `TextureStore#on()`/`get()` wartet auf das nächste Bild; ein geleerter
      `textureFactory` nimmt nichts zurück.
    - `### Fixed`, zwei neue Einträge hinter `:343`: `new TextureResource(id, type)` trägt Setter
      und Effekte seines `type` (ein `'atlas'` nimmt `atlasUrl`, `atlasJson`, `overrideImageUrl`,
      ein `'tileset'` `tileSetOptions`, `load()` registriert deren Effekte; die statischen Factories
      schreiben nur die ersten Werte) · ein `atlasJson`, das vor `load()` geschrieben wird, baut
      seinen Atlas, sobald sein Bild da ist, und der Fetch des `atlasUrl`, nach dem es geschrieben
      wurde, startet nicht und ersetzt es nicht; ein danach geschriebenes `atlasUrl` wird geholt.
    - `### Migration Guide`, neuer Abschnitt hinter »#### The derived values of `TextureResource`
      are read-only« `:844-861`: `#### A TextureResource whose imageUrl is cleared releases its texture`
      — wer die Texture nach dem Leeren weiter braucht, hält sie nicht über die Resource, sondern
      baut sie mit einem eigenen `TextureFactory`; im Stil der Nachbarn mit **Before**/**After** und
      einfachen `ts`-Blöcken (nicht `ts check`).
    - Kein Eintrag für die Zerlegung von `load()`: nicht nutzersichtbar.

- Verify: `pnpm run ci` (schneller Zwischenlauf:
  `pnpm nx test twopoint5d -- src/texture/TextureResource.spec.ts src/texture/TextureStore.spec.ts`)
- Commit: `fix(texture): give a TextureResource built with its constructor the inputs and the effects of its type, register the effects of load() in one method per shape, take the coordinates, the texture and everything built from them back and release the texture once the imageUrl of a resource is cleared, and build the atlas of an atlasJson written before load() instead of fetching the atlasUrl it was written after`
- Für `Schnittstellen:` nach dem Commit: `new TextureResource(id, type)` legt die Eingaben seiner
  Shape an (`#tileSetOptions` auf `'tileset'`, `#atlasSignals: AtlasSignals` auf `'atlas'`, beide
  privat); `#atlas` und `#tileSet` liegen auf jeder Resource · `load()` ruft
  `#registerImageEffect()`, `#registerTileSetEffects(tileSetOptions)`,
  `#registerAtlasEffects(signals)`, beide Shapes `#registerAnimationsEffect(source, addEntry)` ·
  `#takeBackImage()` · `#atlasFetchDue` (privat) entscheidet, ob `load()` den Fetch anstößt ·
  `wrongAnimationDataError()` gibt einen `Error` zurück · ein geleertes `imageUrl` gibt die Texture
  frei — Paket 6 benennt `load()` um und setzt auf diese Registrierer
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · API-054 unverändert (`TextureResource.ts:613`) · API-047
    unverändert, verschoben (Konstruktor `:497-504`, Factories `:216-271`, Guards `:693-697`,
    `:804-810`) · READ-011 umgeformt (`load()` `:571-1029`, rund 460 Zeilen; die `!` sind schon an
    `fceda80b` lokalen Bindungen gewichen, die beiden Animationsschleifen `:746-800`, `:975-1009`
    stehen) · DOC-042 unverändert (`:61-62`) · DOC-043 unverändert (`:200-202`) · aufgenommen aus
    »Offene Befunde«: `atlasJson` vor `load()` (jetzt `:921-931`, `:933-973`, `:1011`) · keine
    offenen `Folgen:` zu verteilen · Restplan unverändert
  - 2026-09-26 Zug 1: Implementierer beauftragt (stärkste Stufe, `opus`, Effort medium), Report nach `paket-5.impl-0.json`
  - 2026-09-26 Zug 2: Report FERTIG · geändert `TextureResource.ts`, `TextureResource.spec.ts`, `TextureStore.spec.ts`, `docs/resource-lifecycle.md`, `CHANGELOG.md` · roter Lauf 9 failed / 185 passed · Arbeitsbaum schmutzig · eigener Verify `pnpm run ci` exit=0 (`paket-5.verify.log`)
  - 2026-09-26 Zug 3: Reviewer beauftragt (`opus`, Effort medium), Diff `paket-5.diff`, Report nach `paket-5.review-0.json`
  - 2026-09-26 Zug 3: Urteil freigeben · alle sieben Punkte erfüllt · kritisch 0, wichtig 0, klein 5 · Diff `paket-5.diff`
  - 2026-09-26 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-26 Zug 5: committet `ee725355` · Verify `pnpm run ci` exit=0 (`paket-5.verify.log`, keine Codeänderung seither) · Nebenbefund `TextureResource.ts:951,953` in »Offene Befunde«

## Abgleich

Gegen HEAD `686a4597`. Die Fundstellen des Audits stammen vom 2026-09-21; seither haben Paket 2, 3,
7 und 8 die Datei umgebaut (886 Zeilen an `fceda80b`, 1030 jetzt).

- **API-054 — geleertes `imageUrl`:** unverändert, verschoben. Der Bild-Effekt kehrt bei fehlendem
  `url` zurück, ohne etwas zurückzunehmen: `if (!factory || !url) return;` `TextureResource.ts:613`
  (Audit `:538`, an `fceda80b` ebenso `:538`). Texture, `imageCoords`, `#imageUrlOfCoords` bleiben,
  der Tile-Set-Effekt kehrt ohne Koordinaten ebenfalls nur zurück (`:702`). Erreichbar über
  `TextureStore#parse()` mit einem Tile-Set-Item ohne `imageUrl` (`TextureStore.ts:582`). Die
  Richtung hat der Nutzer entschieden (»Entscheidungen«, 2026-09-26: zurücknehmen und freigeben).
- **API-047 — Shape im Konstruktor:** unverändert, verschoben. Der Konstruktor `:497-504` legt keine
  Shape-Signale an, nur `fromTileSet()` `:238-243` und `fromAtlas()` `:261-265`;
  `new TextureResource('x', 'atlas')` wirft beim Setter `atlasUrl` `:352`, und `load()` registriert
  keine Shape-Effekte, weil die Guards `:693-697`/`:804-810` die fehlenden Signale lesen. Der
  Kommentar `:689-692` beschreibt genau das als Absicht. Entschieden (»Entscheidungen«): Signale im
  Konstruktor, Konstruktor bleibt öffentlich, Factories weisen nur zu.
- **READ-011 — `load()` zerlegen:** umgeformt. `load()` `:571-1029` trägt weiter alle Effekte —
  Bridges, Bild-Effekt, Tile-Set-Paar, fünf Atlas-Effekte samt Fetch, Fallback —, rund 460 statt 290
  Zeilen. Die sechs `!` des Audits gibt es nicht mehr (an `fceda80b` schon ersetzt durch lokale
  Bindungen und die `&&`-Guards `:693-697`, `:804-810`); die Fast-Duplikate der Animationseffekte
  stehen `:746-800` und `:975-1009`.
- **DOC-042 — TSDoc von `TextureResourceEvents`:** unverändert. `:61-62` sagt nur »retained — late
  subscribers see the latest value«; das Räumen steht allein in der Klassen-TSDoc `:203-205`.
- **DOC-043 — Klassen-TSDoc zum unlesbaren `atlasJson`:** unverändert. `:200-202` »while its
  `atlasJson` is cleared or cannot be read«; der Getter `:366-368` und `TextureResourceEvents`
  `:80-81` sagen richtig »once the image it names is there«.
- **Testpunkt von TEST-016 für API-047:** offen, wie von Paket 1 übergeben (`paket-1.md`, »Nicht in
  diesem Paket«); einen Test auf `new TextureResource(id, 'atlas')` gibt es nicht.

## Triage

- `Folgen:` der erledigten Pakete: Paket 1 → Paket 7 (erledigt), Paket 2 → Paket 8 (erledigt),
  Paket 3, 4, 7, 8, 9 → keine. Nichts neu zu verteilen. Die Zeile `Schnittstellen:` von Paket 8
  übergibt diesem Paket die Semantik von Bild- und Fetch-Effekt (`emitStrict`-Bridges, `batch()` für
  Tile Set und Atlas, `#fail` hinter dem `try`, kein abschließender `.catch`) — sie wandert in
  Schritt 4–7 unverändert mit.
- **Aufgenommen aus »Offene Befunde«, `→ Scope`, low:** `TextureResource.ts:876-886,888-928,965`
  (jetzt `:921-931`, `:933-973`, `:1011`) — ein `atlasJson`, das vor `load()` geschrieben wird,
  greift nicht. Gleiche Ursache wie API-047: die Registrierung in `load()` bringt die Effekte einer
  Shape nicht mit dem Stand zusammen, den die Resource beim Aufruf hält — API-047 fehlt die Shape,
  hier der erste Lauf der Effekte mit statischen Deps. API-047 macht zudem genau den Weg
  »Konstruktor, Setter, `load()`« zum dokumentierten, auf dem der Befund zuerst trifft.
  Vorbestehend an `fceda80b` (`:787`, `:828`, `:867`). Die Semantik folgt der Setter-TSDoc
  (»A json written from outside replaces the fetched one … cuts short a fetch that is still under
  way«): was vor `load()` geschrieben wurde, wirkt, als wäre es direkt danach in derselben
  Reihenfolge geschrieben worden. Dafür das Feld `#atlasFetchDue` statt der einfacheren Regel
  »`load()` holt nichts, solange eine Json da ist«: diese verschluckte ein `atlasUrl`, das nach der
  Json geschrieben wurde — ein Write ohne Wirkung und ohne Meldung, das Muster, gegen das die Datei
  sonst Fehler wirft.
- Liegen gelassen, andere Ursache: `TextureStore.ts:288-293` (`onResource()`-TSDoc),
  `TextureStore.spec.ts:420` (Kommentar), `textures.json`, `TextureAtlasLoader.ts:66,78`,
  `TexturePackerJson.ts:38-40` (getrimmte Frames), `FrameBasedAnimations.ts:208` (Frame-Array per
  Referenz), `AnimatedSpritesMaterial.ts:90` (`→ Rückfrage`, außerhalb der Domain) und die
  `→ Audit`-Einträge.
- **`printWidth`-Eintrag `TextureResource.ts:167,185`** — nicht aufgenommen (Formatfrage, andere
  Ursache), Fundstelle nachgeführt: die Zeilen stehen jetzt `:161` (`wrongAnimationDataError`),
  `:179` (`derivedImageUrlError`), dazu seit `62c99ce1` `:775` (die `tileIds`-Meldung aus Paket 3).
  `:161` und `:775` schreibt dieses Paket ohnehin neu (Schritt 8); eine neu geschriebene Zeile
  hält die `printWidth` ein. Offen bleibt `:179`.

## Entscheidungen dieses Zugs

- **Eingaben shape-gebunden, Ausgaben auf jeder Resource.** `#atlas` und `#tileSet` werden wie
  `#texture` und `#frameBasedAnimations` immer angelegt; nur `#tileSetOptions` und das Record
  `#atlasSignals` hängen am `type`. So bleibt die Regel »der Setter wirft auf der falschen Shape«
  erhalten, die Bridges werden einheitlich, und der `atlas`-Getter muss nicht zwischen zwei Records
  wählen.
- **Guard über das Record statt über `this.type`**, siehe Schritt 3 — gleichwertig, weil der
  Konstruktor das Record genau nach `type` anlegt, und nur so verengt TypeScript ohne `!`.
- **`#registerAnimationsEffect` statt `#buildAnimations(add)`**, siehe Schritt 8.
- **Ein geleerter `textureFactory` nimmt nichts zurück.** Die Entscheidung des Nutzers betrifft das
  Bild; `TextureStore` leert den Factory aller Resources, wenn sein Renderer geht, und eine
  Rücknahme dort gäbe beim Renderer-Wechsel jede Texture frei — eine Verhaltensänderung, die niemand
  verlangt hat. Ein Schutztest hält das fest.
- **Der Atlas-Parse-Effekt nimmt ohne Koordinaten zurück**, damit die Invariante »nichts steht, was
  aus einem Bild gebaut ist, das es nicht mehr gibt« auch auf der Atlas-Shape hält (Schritt 7).
- **Migration Guide ja**: die Freigabe der Texture beim Leeren ändert, was ein Aufrufer halten darf;
  keine Signatur ändert sich.

## Urteil des Reviewers

Gegen den Arbeitsbaum vor `ee725355`, Report `paket-5.review-0.json`. Gesamturteil: freigeben.
Registrierungsreihenfolge, `priority`, statische Deps und Freigabe-Reihenfolge der Texture
unverändert; keine Finding-ID, kein Rückblick.

- API-054 — behoben: `TextureResource.ts:684-688` (`#takeBackImage()` bei leerem `url`),
  `#takeBackImage()` `:770-782`, Tile-Set-Effekt `:793`, `:820-822`, Atlas-Parse-Effekt
  `:999-1004`; Tests `TextureResource.spec.ts:1946` ff., `TextureStore.spec.ts:1031`
- API-047 — behoben: Konstruktor `:534-543`, Factories `:254-278`, Setter `:361-432`, Verteiler
  `:648-649`
- READ-011 — behoben: `load()` `:615-666`, Registrierer `:668`, `:784`, `:854`, `:1048`;
  `wrongAnimationDataError` `:159-163`
- DOC-042 — behoben: `:63-65`
- DOC-043 — behoben: `:211-212`
- Testpunkt von TEST-016 — behoben: `TextureResource.spec.ts:1586` ff., gegen HEAD rot aus dem
  richtigen Grund (Setter `atlasUrl` wirft)
- Nebenbefund »`atlasJson` vor `load()`« — behoben: `#atlasFetchDue` `:513-516`, Setter `:365`,
  `:393-398`, Touches `:1037-1042`, TSDoc `:382-383`, `:602-606`; Tests `TextureResource.spec.ts:1798` ff.

## Kleine Befunde

- `CHANGELOG.md:89`, `:865-885` — `Changed`-Eintrag und Migration Guide nennen nur Image- und
  Tile-Set-Resources; die Rücknahme auf der Atlas-Shape (Json ohne Bild, kein `overrideImageUrl`)
  steht nur in der Klassen-TSDoc `TextureResource.ts:220-222`
- `docs/resource-lifecycle.md:25-26` — der Einschub endet auf »`dispose()` —, and …«, wörtlich nach
  Schritt 11, liest sich holprig
- `CHANGELOG.md:878-882` — im »After«-Block des Migration Guide ist `image` nicht definiert
- `TextureResource.ts:676-683` — zwei Kommentare untereinander sagen fast dasselbe (»a run without a
  factory is a "not yet"«), beide vom Plan vorgegeben
- `TextureStore.spec.ts:1031` — Testname-Zeile 138 Zeichen, über der `printWidth`; Name vom Plan
  wörtlich vorgegeben

## Nebenbefund

- `TextureResource.ts:951,953` — der Atlas-Image-Effekt nennt in `url` und Meldung
  `this.atlasUrl`, nicht die URL der Json, die kein Bild nennt. Vorbestehend an
  `fceda80b:…/TextureResource.ts:760`; gehört zur Domain texture, deshalb `→ Scope`, info
  (falsche URL in einer Fehlermeldung, kein Fehlverhalten).
