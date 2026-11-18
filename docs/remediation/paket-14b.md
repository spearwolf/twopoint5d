# Paket 14b — Drain: die vor 0.25.0 veralteten Exporte entfernen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen aus dem Audit — der Nebenbefund »übrige `@deprecated`-Exporte« aus
  »Offene Befunde« (aus Paket 7, Zug 0, vorbestehend; info), beschlossen am 2026-11-18: vor 0.25.0
  veraltete entfernen, seit 0.25.0 veraltete → `acknowledged`
- Ziel: 0.26.0 verliert jeden vor 0.25.0 veralteten Export samt Aufrufern, Specs und Doku, mit
  Removed-Eintrag und Migration Guide im CHANGELOG; `Display.CssRulesPrefixFullscreen` (seit 0.25.0
  veraltet) bleibt und geht im Abschluss nach `acknowledged`.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - löschen: `packages/twopoint5d/src/texture/PowerOf2ImageLoader.ts`, `PowerOf2ImageLoader.spec.ts`,
    `TextureImageLoader.ts`, `TextureImageLoader.spec.ts`, `TextureAtlasLoader.ts`,
    `TextureAtlasLoader.spec.ts`, `TileSetLoader.ts`, `TileSetLoader.spec.ts`
  - ändern: `packages/twopoint5d/src/texture/public-api.ts`, `TextureStore.ts`, `TextureStore.spec.ts`,
    `TextureResource.ts`, `TextureResource.spec.ts`, `TextureFactory.ts`, `TextureFactory.spec.ts`;
    `packages/twopoint5d/src/controls/PanControl2D.ts`, `PanControl2D.spec.ts`;
    `packages/twopoint5d-testing/test/pan-control-keys.test.js`,
    `packages/twopoint5d-testing/test/texture-factory-anisotropy.test.js`;
    `scripts/checkNameableTypes.mjs`; `packages/twopoint5d/docs/textures.md`,
    `docs/resource-lifecycle.md`, `docs/architecture.md`,
    `docs/proposals/fade-flash-axis-billboards.md`; `packages/twopoint5d/CHANGELOG.md`
  - bleiben unberührt: `src/utils/findNextPowerOf2.ts` und `src/utils/isPowerOf2.ts` (öffentlich
    über `utils/public-api.ts:3, 5`, `FrameBasedAnimations.ts:4` nutzt `findNextPowerOf2`),
    `src/texture/isAtlasJsonResponse.ts` und `resolveRelativeUrl.ts` (genutzt von
    `fetchAtlasJson.ts`, `TextureResource.ts`, `TextureStore.ts`), `src/display/Display.ts`
    (`CssRulesPrefixFullscreen` `:286–294` und der Alias `resize-to="fullscreen"` sind seit 0.25.0
    veraltet und bleiben), `.vscode/settings.json:5` (Wörterliste: der CHANGELOG trägt das Wort
    `anisotrophy` weiter)
- Vorgehen (Zeilen gegen HEAD `ea6b44f9`):
  1. **Die vier Loader** (veraltet in 0.22.0, `CHANGELOG.md:2262`).
     a. Die acht Dateien oben löschen. Sie importieren nur einander; kein Modul außerhalb und kein
        Lookbook-Demo, kein Browser-Test importiert sie.
     b. `src/texture/public-api.ts`: die Blöcke `:49–54` (`./PowerOf2ImageLoader.js`), `:64–70`
        (`./TextureAtlasLoader.js`), `:79–84` (`./TextureImageLoader.js`) und die Zeile `:116`
        (`./TileSetLoader.js`) streichen. Damit fallen die Exporte `PowerOf2ImageLoader`,
        `TextureImageLoader`, `TextureAtlasLoader`, `TileSetLoader`, `ImageWithTexCoords`,
        `TextureImage`, `TextureAtlasData`, `TextureAtlasLoadOptions`, `TileSetData`,
        `PowerOf2ImageLoadCallback`, `PowerOf2ImageLoadErrorCallback`, `TextureImageLoadCallback`,
        `TextureImageLoadErrorCallback`, `TextureAtlasLoadCallback`, `TextureAtlasLoadErrorCallback`,
        `TileSetLoadCallback`, `TileSetLoadErrorCallback`.
     c. `TextureStore.ts:347–353`: den Absatz »The four callback loaders — … belongs to its caller.«
        aus der TSDoc der Klasse streichen samt der Leerzeile `* ` davor; die TSDoc endet mit
        »… holds the resource for as long as the caller needs it.«
     d. `TextureResource.ts:1651`: im Kommentar »the resolved url goes into the published json,
        mirroring `TextureAtlasLoader`: `atlasJson` is typed …« den Verweis streichen — »the
        resolved url goes into the published json: `atlasJson` is typed …«, Rest unverändert, neu
        umbrechen.
     e. `docs/resource-lifecycle.md:17–21`: die Aufzählung beginnt ohne die Loader —
        »**What a method builds for its caller and keeps no reference to belongs to the caller.**
        [`TextureFactory`](../src/texture/TextureFactory.ts)`#create()`, `#load()` and
        `#loadAsync()`, and [`FrameBasedAnimations`]…`#bakeDataTexture()` and [`FrameTable`]…
        `#bakeDataTexture()` build a new texture on every call …«; Rest des Absatzes unverändert,
        neu umbrechen.
     f. `docs/architecture.md:149–152`: den Satz »The four `*Loader` classes are the older way and
        deprecated; they pad … and starts from no texture class.« streichen, den Absatz neu
        umbrechen. Der Satz `:28` (»A helper listed only because an earlier release published it
        carries `@deprecated`.«) bleibt: er ist eine Regel für künftige Fälle, keine Aussage über
        einen bestimmten Export.
     g. `docs/proposals/fade-flash-axis-billboards.md:303–304`: »`isAtlasJsonResponse()` accepts
        both, so `TextureAtlasLoader` and `TextureStore` take them.« → »… accepts both, so
        `TextureStore` takes them.« Das Proposal ist implementiert; der Satz beschreibt, was die
        Spec belegt, und wäre mit dem Loader falsch.
     h. `CHANGELOG.md:86` (Unreleased, `### Fixed`): den Eintrag »`TextureImageLoader#load()`
        without an `onErrorCallback` reports …« streichen. Die Klasse gibt es in 0.26.0 nicht, der
        Fix erreicht kein Release; der Unreleased-Abschnitt ist offen und darf das.
  2. **`TextureResource#load()`** (veraltet in 0.22.0).
     a. `TextureResource.ts:895–902` (TSDoc samt `load(): this { return this.activate(); }`)
        streichen.
     b. `TextureResource.spec.ts:2359`: Testname »… and activate() and load() answer the same« →
        »the static factories answer the class of the shape, and activate() answers the same«;
        `:2368` `expectTypeOf(atlas.load())` → `expectTypeOf(atlas.activate())` (die
        Typprüfung der Atlas-Form bleibt erhalten).
     c. `TextureResource.spec.ts:2576–2594` (im `describe('activate()')`): der Test prüft neben dem
        Alias, dass wiederholtes Aktivieren die Effekte nur einmal anlegt, und das prüft sonst
        keiner. Umschreiben statt löschen: Name »activate() answers the resource and registers the
        effects once, however often it is called«, `resource.load()` an `:2586` und `:2588` durch
        `resource.activate()` ersetzen, sonst unverändert.
  3. **`TextureStore#get()`** (veraltet in 0.22.0).
     a. `TextureStore.ts:1351–1365` (TSDoc und Methode `get()`) streichen.
     b. `#getOnce()` `:1371`: `method: 'get' | 'getAsync' | 'acquireAsync'` →
        `method: 'getAsync' | 'acquireAsync'`; Kommentar `:1367` »the body of getAsync(), of its
        alias and of acquireAsync(); …« → »the body of getAsync() and of acquireAsync(); …«.
     c. Die Aufzählungen in der TSDoc ohne `get()`: `:95` »A `whenReady()`, `whenResource()`,
        `getAsync()`, `acquireAsync()` or `on()` …« und `:780` »`whenReady()`, `whenResource()`,
        `getAsync()`, `acquireAsync()`, `on()`«; beide Absätze neu umbrechen.
     d. `TextureStore.spec.ts:1018–1065` (`describe('the deprecated get()')`) ganz streichen. Jeder
        Fall hat seinen Zwilling über `getAsync()` oder `acquireAsync()`, die durch dasselbe
        `#getOnce()` laufen: Bildschritt `:2552`, abgebrochen vor der Subskription `:510` und
        `:1217`, abgebrochen im Warten `:1222`, entsorgter Store `:1227` und `:3775`.
  4. **Die Schreibweise `anisotrophy`** (veraltet in 0.22.0).
     a. `TextureFactory.ts:39–43`: die TSDoc und das Feld `anisotrophy?: number` aus
        `TextureOptions` streichen.
     b. `:60–62` Kommentar über `TextureClasses`: den letzten Satz »The `anisotrophy` names are
        aliases and write the same values as the names they stand for.« streichen.
     c. `:76–87`: die vier Einträge `anisotrophy`, `'anisotrophy-2'`, `'anisotrophy-4'`,
        `'no-anisotrophy'` aus `TextureClasses` streichen.
     d. `:173–175`: den Absatz »`anisotrophy`, … until a breaking release removes them.« aus der
        TSDoc von `TextureOptionClasses` streichen samt der Leerzeile `*` davor.
     e. `:203–206`: die vier Prioritäten streichen.
     f. Konstruktor `:284–291`: `const {anisotrophy, ...given} = defaultOptions ?? {};` →
        `const given = defaultOptions ?? {};`; den Kommentar »the deprecated key stands in for the
        one it names while that one is missing« streichen;
        `anisotropy: defined.anisotropy ?? anisotrophy ?? 0` → `anisotropy: defined.anisotropy ?? 0`.
     g. `getOptions()` `:297–312`: TSDoc-Satz »The anisotropy comes in both counts: … the deprecated
        `anisotrophy` from 0.« → »`anisotropy` comes counted as three.js counts it, from 1, as
        {@link TextureFactory.update} gives it to the texture.«; im Rumpf den Kommentar »one raw
        value, two counts: …« und `options.anisotrophy = anisotropy;` streichen, die Zuweisung wird
        `options.anisotropy = Math.max(1, Math.min(options.anisotropy ?? 0, this.#maxAnisotropy()));`
        (Kommentar dazu: »the raw value of the classes, capped at the maximum of the renderer;
        three.js counts 1 as none«).
     h. `update()` `:352–357`: `delete textureOptions.anisotrophy;` streichen, der Kommentar wird
        »`anisotropy` stays out of the assignment and is set once below«.
     i. `TextureFactory.spec.ts`: `:43` (`expect(texture).not.toHaveProperty('anisotrophy')`)
        streichen; `describe('the deprecated anisotrophy spelling')` `:143–186` ganz streichen;
        dafür in `describe('anisotropy reaches the texture')` (`:36`) ein Test »defaultOptions with
        anisotropy count it as three.js does, and 0 as none«: `new TextureFactory(16, [],
        {anisotropy: 2})` → `getOptions([]).anisotropy` und `update(new Texture()).anisotropy` je
        `2`; `{anisotropy: 0}` → je `1` (der einzige Fall von `defaultOptions.anisotropy`, den der
        gestrichene Block mit abdeckte; die übrigen Fälle stehen an `:58–62`, `:64–69`, `:134`). In
        `everyClassName` `:362–365` die vier `anisotrophy`-Namen streichen und `'anisotrophy'` in
        die Liste des Falls »answers false« (`['nearset', 'toString', 5, undefined]`) aufnehmen
        — `['nearset', 'anisotrophy', 'toString', 5, undefined]`.
     j. `packages/twopoint5d-testing/test/texture-factory-anisotropy.test.js:46`
        (`expect(texture).to.not.have.own.property('anisotrophy')`) streichen: kein Weg der
        Library schreibt den Namen mehr.
     k. `docs/textures.md:75–76`: den Satz »`anisotrophy`, … are deprecated spellings of the
        anisotropy classes.« streichen.
  5. **`PanControl2D#keyCodes`** (veraltet in 0.22.0).
     a. `PanControl2D.ts:53` `DEFAULT_KEY_CODES` streichen; `:55` Kommentar »in the order keys and
        keyCodes list them« → »in the order keys lists them«; `:58–59` `holdsDefault` streichen
        (einziger Aufrufer ist die Bedingung in `#speedFieldFor()`).
     b. `:159–176`: Leerzeile und Option `keyCodes` samt TSDoc aus `PanControl2DOptions` streichen.
     c. `:211–212` Kommentar über `#keyedSpeeds` → »the field name a key currently holds up, not
        the key that raised it — keys can be rebound while a key is down, and what a key held
        down gives back is the field it moved«.
     d. `:253–260`: Leerzeile und Feld `keyCodes` samt TSDoc streichen.
     e. Konstruktor `:377–380`: Leerzeile, Kommentar und `this.keyCodes = …` streichen.
     f. `#speedFieldFor()` `:792–802`: Rumpf wird
        `return KEYED_SPEED_FIELDS[this.keys.indexOf(event.code)];`, der Kommentar entfällt.
     g. TSDoc von `dispose()` `:863`: `keyCodes` aus der Liste der Member streichen, neu umbrechen.
     h. `PanControl2D.spec.ts`: `:283–291` (»keyCodes decide while keys holds its default«) und
        `:311–319` (»keys win over keyCodes when both are set«) streichen; `:293–309` umschreiben
        zu »copies keys of the options: a rebinding in place on one control leaves the options and
        a second control built from them as they are« — `const keyCodes …`, `first.keyCodes[0] =
        73;` und `expect(keyCodes)…` streichen, `{keys, keyCodes}` → `{keys}`. `keyCode` im
        Event-Helfer (`KeyInit` `:34`, `keyEvent()` `:48`) streichen, kein Test reicht ihn danach
        noch herein.
     i. `pan-control-keys.test.js:76–120`: die drei Tests »keeps honouring keyCodes a caller sets«,
        »keeps honouring keyCodes rebound in place« und »prefers keys over keyCodes when both are
        set« streichen. `ARROWS` bleibt (`:66`), ebenso das `keyCode` der AZERTY- und
        Pfeil-Ereignisse `:45, 57, 68` — dort ist es das Ablenkungsfeld, das zeigt, dass die
        Control nach `code` geht.
  6. **`MapTuple` und `MapSubTypes`** (veraltet in 0.24.0, `CHANGELOG.md:724`).
     a. `src/texture/public-api.ts:105–106` streichen.
     b. `TextureStore.ts:51–79`: beide Typen bleiben als Helfer der Signaturen von `getAsync()`,
        `on()`, `acquireAsync()` und `#getOnce()` stehen, ohne `export` (wie `TextureClasses` in
        `TextureFactory.ts`; nichts in `src/` importiert sie außer `public-api.ts`). Nicht
        `@internal` markieren: `stripInternal` steht in `tsconfig.json:49` und nähme sie aus der
        `.d.ts`, deren Signaturen sie tragen. TSDoc ohne `@deprecated`:
        `MapTuple` — »A step of {@link MapSubTypes}: maps a tuple of subtypes to the tuple of their
        values.«; `MapSubTypes` — »Maps a subtype to its value, and a list of subtypes to the tuple
        of their values: the helper of the signatures of {@link TextureStore}, not exported. Name
        the value of one subtype as `TextureResourceSubTypeMap['atlas']`, and the values of a list
        as a tuple of them.«
     c. `scripts/checkNameableTypes.mjs`, `ACCEPTED` unter `packages/twopoint5d/dist/lib/index.d.ts`,
        nach dem Muster von `TextureClasses` zwei Einträge mit Grund:
        `'texture/TextureStore.d.ts:MapSubTypes'` — »a helper of the signatures of `getAsync()`,
        `on()` and `acquireAsync()`, not a name to use: a caller names the value of one subtype as
        `TextureResourceSubTypeMap[…]`, and the values of a list as a tuple of them«;
        `'texture/TextureStore.d.ts:MapTuple'` — »a step of `MapSubTypes`, reached only through
        it«. Danach meldet `pnpm checkNameableTypes` weder einen Namen noch einen veralteten
        Eintrag.
  7. **`docs/textures.md`, Abschnitt »Deprecated names«** `:751–772` (Leerzeile davor bis
     Dateiende) ganz streichen; sein Inhalt steht danach im Migration Guide (Schritt 8). Kein
     Anker verweist auf ihn.
  8. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, Skill
     `updating-changelog`; Wortlaut englisch, ohne Rückblick).
     a. `### Removed` (`:68`), hinter den drei vorhandenen Einträgen, je **BREAKING**:
        - `PowerOf2ImageLoader`, `TextureImageLoader`, `TextureAtlasLoader` and `TileSetLoader`,
          with `ImageWithTexCoords`, `TextureImage`, `TextureAtlasData`, `TextureAtlasLoadOptions`,
          `TileSetData` and their callback types, deprecated (**BREAKING**). See the Migration Guide
        - `TextureResource#load()` and `TextureStore#get()`, the deprecated names of `activate()`
          and `getAsync()` (**BREAKING**). See the Migration Guide
        - `TextureOptions#anisotrophy` and the texture classes `anisotrophy`, `anisotrophy-2`,
          `anisotrophy-4` and `no-anisotrophy`, deprecated: a catalog of a `TextureStore` that
          names one of them gets it reported as a class no `TextureFactory` knows (**BREAKING**).
          See the Migration Guide
        - the `keyCodes` option and the `PanControl2D#keyCodes` field, deprecated: the control
          pans by `keys` alone, compared with `event.code` (**BREAKING**). See the Migration Guide
        - the exports of the types `MapTuple` and `MapSubTypes`, deprecated (**BREAKING** for
          TypeScript). See the Migration Guide
     b. `### Fixed`: Schritt 1h.
     c. `### Migration Guide`, Muster wie `:195` und `:231` (`**Before**`/`**After**` mit
        `ts`-Block, ein Satz danach, wo nötig):
        - `#### PanControl2D#keyCodes is gone` direkt hinter `#### PanControl2D#keys takes four
          strings` (`:131`), vor `:147`. Before:
          `new PanControl2D({keyCodes: [38, 40, 37, 39]});` und `control.keyCodes[0] = 38;`
          After: `new PanControl2D({keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']});`
          und `control.keys[0] = 'ArrowUp';`. Satz danach: `keys` names the `KeyboardEvent.code`
          of a key, its position, whatever the layout labels it; a `keyCodes` passed in is not
          read.
        - Hinter `#### A narrower default class of a TextureFactory …` (`:213`), vor `:231`, drei
          Abschnitte:
          `#### The texture loaders are gone` — Before:
          `const {texture, texCoords} = await new TextureImageLoader().loadAsync('hero.png', ['nearest']);`,
          `const {atlas} = await new TextureAtlasLoader().loadAsync('sheet.json', ['nearest']);`,
          `const {tileSet} = await new TileSetLoader().loadAsync('tiles.png', {tileWidth: 16, tileHeight: 16}, ['nearest']);`;
          After: `const store = new TextureStore(renderer);`, ein `store.parse({defaultTextureClasses:
          ['nearest'], items: {hero: {imageUrl: 'hero.png'}, sheet: {atlasUrl: 'sheet.json'}, tiles:
          {imageUrl: 'tiles.png', tileSet: {tileWidth: 16, tileHeight: 16}}}});` und
          `const [texture, imageCoords] = await store.getAsync('hero', ['texture', 'imageCoords']);`,
          `const atlas = await store.getAsync('sheet', 'atlas');`,
          `const tileSet = await store.getAsync('tiles', 'tileSet');`. Danach in Prosa, was
          `docs/textures.md:763–772` sagt: a loader pads an image whose sides are no powers of 2
          onto a canvas whose sides are, hands out its coordinates as a child of that canvas,
          starts from the texture class `nearest` and gives the texture to its caller to dispose;
          the store loads the image as it is, its `imageCoords` are the root of the image, it
          starts from no texture class — name `nearest` in the catalog where the loader gave it —
          and it keeps the texture (`acquireAsync()` holds it). `PowerOf2ImageLoader` built no
          texture; an image item with `getAsync(id, 'imageCoords')` takes its place, unpadded, and
          the padding to powers of 2 has no counterpart. Feld- und Subtyp-Namen gegen
          `TextureResourceData` (`src/texture/types.ts:56`) und `TextureResourceSubTypeMap`
          (`TextureStore.ts:43–49`) prüfen, bevor sie im Block stehen.
          `#### TextureResource#load() and TextureStore#get() are gone` — Before
          `resource.load();` / `const texture = await store.get('hero', 'texture');`, After
          `resource.activate();` / `const texture = await store.getAsync('hero', 'texture');`;
          Satz: the messages of a refusal name `getAsync()`.
          `#### The anisotrophy spelling is gone` — Before
          `new TextureFactory(renderer, ['anisotrophy-4'], {anisotrophy: 4});` und
          `factory.getOptions(['no-anisotrophy']).anisotrophy; // 0`, After
          `new TextureFactory(renderer, ['anisotropy-4'], {anisotropy: 4}); // the same values` und
          `factory.getOptions(['no-anisotropy']).anisotropy; // 1, which three.js counts as none`.
          Satz: a catalog renames the classes in `texture` and `defaultTextureClasses`; one that
          keeps them gets an `error` event from `parse()` and the class left out, and the static
          `TextureStore.loadAsync()` rejects. (Belegt: `TextureStore.ts:360–368`, `:757–761`; das
          Umrechnen ist 1:1, weil beide Schlüssel denselben Rohwert setzen und `getOptions()` ihn
          mit `Math.max(1, …)` in die Zählung von three.js bringt.)
        - `#### MapTuple and MapSubTypes are no longer exported` hinter `#### The deprecated exports
          of map2d are gone` (`:231`), vor `:254`. Before
          `const values: MapSubTypes<['atlas', 'texture']> = await store.getAsync('hero', ['atlas', 'texture']);`,
          After `const values: [TextureResourceSubTypeMap['atlas'], TextureResourceSubTypeMap['texture']] = await store.getAsync('hero', ['atlas', 'texture']);`;
          Satz: or leave the type to inference.
- Kein Regressionstest im Sinn eines Bugfix-Pakets (Entfernung, kein Fehler). Belege für die
  Entfernung: `isTextureOptionClass('anisotrophy')` antwortet `false` (Schritt 4i), der Typecheck
  der Specs, Browser-Tests und Doku-Blöcke läuft ohne die Namen, `checkNameableTypes` grün mit den
  zwei neuen Einträgen.
- Coverage: die Loader tragen 83 Zeilen bei 96 % (gemessen aus `coverage/lcov.info` des Laufs von
  Paket 14); `src/texture/**` liegt danach bei rund 98,8 % Zeilen, Schwelle 94. Kein Risiko für
  `test:coverage`, keine Schwelle ändern.
- Verify: `pnpm run ci`
- Commit: `refactor(twopoint5d)!: remove the texture loaders, TextureResource#load(), TextureStore#get(), the anisotrophy spelling and the keyCodes of PanControl2D, which 0.22.0 deprecated, and stop exporting MapTuple and MapSubTypes`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · Nebenbefund unverändert gegen HEAD `ea6b44f9`, Fundstellen
    verschoben: `PanControl2D.ts` durch Paket 13 (`keys` als Accessor; `keyCodes` jetzt `:53, 55,
    58, 160–176, 211, 254–260, 378–380, 792–802, 863`), `texture/public-api.ts` Loader-Blöcke
    `:49–54, 64–70, 79–84, 116`, `MapTuple`/`MapSubTypes` `:105–106`; `TextureStore.ts:54, 68,
    347–353, 1355`, `TextureResource.ts:896, 1651`, `TextureFactory.ts:40` unverändert · neu
    gefunden: Unreleased-Eintrag `CHANGELOG.md:86` (Fix an `TextureImageLoader#load()`),
    `docs/architecture.md:149–152`, TSDoc-Aufzählungen `TextureStore.ts:95, 780`, der Rest
    `holdsDefault` und `keyCode` im Event-Helfer der Spec · seit 0.25.0 veraltet und bleibend:
    `Display.CssRulesPrefixFullscreen` (`Display.ts:294`), Alias `resize-to="fullscreen"` (kein
    Export) · offene Folgen erledigter Pakete: keine (Paket 14 `Folgen: keine`) · »Offene
    Befunde«: `Stage2D.ts:412` (`#updateProjection` nicht `readonly`) hat eine andere Ursache,
    bleibt in der Queue · Restplan unverändert (15 hängt von nichts ab, berührt nur das Lookbook)
  - 2026-11-18 Zug 1: Implementierer beauftragt (sonnet, medium), Report nach `paket-14b.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG · 8 Dateien gelöscht, 18 geändert (texture/, controls/, twopoint5d-testing, checkNameableTypes.mjs, 4 Doku-Dateien, CHANGELOG) · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-14b.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (sonnet, medium): alle Schritte 1–8 erfüllt, 0 kritisch · 0 wichtig · 1 klein (`TextureFactory.ts:55` Kommentar »both counts« veraltet; vom Runner auf wichtig gehoben, weil der Umbau ihn falsch gemacht hat) · Diff `paket-14b.diff`
  - 2026-11-18 Zug 4 Runde 1: offen `TextureFactory.ts:55`, Resume des Implementierers aus Runde 0 (sonnet, medium), Report nach `paket-14b.impl-1.json`
    → zurück: Kommentar `:55–56` neu, biome sauber · `pnpm run ci` exit=0 (`paket-14b.verify-1.log`) · Reviewer gezielt (`paket-14b.review-1.json`): behoben; neu derselbe Rest an `TextureFactory.ts:226` (»two counts«, vom Runner auf wichtig gehoben)
  - 2026-11-18 Zug 4 Runde 2: offen `TextureFactory.ts:226`, frischer Implementierer (opus, low), Report nach `paket-14b.impl-2.json`
    → zurück: Kommentar `:225–227` neu, biome sauber · `pnpm run ci` exit=0 (`paket-14b.verify-2.log`) · Reviewer gezielt (`paket-14b.review-2.json`): behoben, keine weiteren Reste, 0 Befunde · Diff `paket-14b.diff-2`
  - 2026-11-18 Zug 5: Commit c972df9d (25 Dateien, +163 −1613; erster Commit trug wegen eines gescheiterten `git add` nur die acht Löschungen und wurde vor jedem weiteren Schritt per `--amend` um den verifizierten Stand ergänzt) · Verify-Log `paket-14b.verify-2.log`

## Urteil des Reviewers

- Nebenbefund »übrige `@deprecated`-Exporte (vor 0.25.0)«: behoben — `git grep @deprecated packages/*/src` trifft nur noch `display/Display.ts:289` (`CssRulesPrefixFullscreen`, seit 0.25.0, bleibt gewollt).
- Schritt 1 Loader: erfüllt (8 Dateien gelöscht, `texture/public-api.ts`, `TextureStore.ts`-TSDoc, `TextureResource.ts`-Kommentar, `resource-lifecycle.md`, `architecture.md`, Proposal, Unreleased-Fix gestrichen).
- Schritt 2 `TextureResource#load()`: erfüllt; Idempotenz-Test in `describe('activate()')` auf `activate()` umgeschrieben.
- Schritt 3 `TextureStore#get()`: erfüllt; `#getOnce()` mit zwei Methodennamen, TSDoc-Aufzählungen ohne `get()`.
- Schritt 4 `anisotrophy`: erfüllt nach Runden 1 und 2 (Kommentare `TextureFactory.ts:55–56` und `:225–227`).
- Schritt 5 `PanControl2D#keyCodes`: erfüllt; `keyCode` der Ablenkungsereignisse im Browser-Test bleibt.
- Schritt 6 `MapTuple`/`MapSubTypes`: erfüllt; ohne `export`, ohne `@deprecated`, zwei Einträge in `ACCEPTED`.
- Schritt 7 Abschnitt »Deprecated names«: erfüllt, kein Verweis mehr.
- Schritt 8 CHANGELOG: erfüllt; Feld- und Subtyp-Namen des Migration Guide gegen `TextureResourceData` und die Loader-Signaturen geprüft; veröffentlichte Abschnitte unverändert.
- Commit-Message ohne Finding-ID und ohne Rückblick.

Kleine Befunde: keine offen. Abweichungen des Implementierers: Migration-Guide-Blöcke als `ts`, nicht `ts check` (zeigen entfernte Namen); Doku-Pfade liegen unter `packages/twopoint5d/docs/`.

## Befund im Volltext

**Nebenbefund · info · aus Paket 7, Zug 0, vorbestehend** — Die übrigen `@deprecated`-Exporte der
Library warten auf einen Breaking Release, den 0.26.0 darstellt: die Loader in
`packages/twopoint5d/src/texture/` (`TileSetLoader.ts`, `TextureImageLoader.ts`,
`TextureAtlasLoader.ts`, `PowerOf2ImageLoader.ts` samt Typen), `MapTuple`/`MapSubTypes`
(`TextureStore.ts:54, 68`), `TextureStore.ts:1355`, `TextureResource.ts:896`,
`TextureFactory.ts:40`, `PanControl2D` `keyCodes` (`controls/PanControl2D.ts:168, 239`),
`Display.CssRulesPrefixFullscreen` (`display/Display.ts:294`).

Entscheidung des Nutzers (2026-11-18): Von den übrigen `@deprecated`-Exporten entfernt 0.26.0 nur
die, die vor 0.25.0 veraltet sind, samt Migrationshinweis im CHANGELOG; was erst seit 0.25.0
veraltet ist, bleibt bis zum nächsten Breaking Release und geht mit dieser Begründung nach
`acknowledged`.

Einordnung nach CHANGELOG: veraltet in 0.22.0 (`CHANGELOG.md:2257–2267`) — die vier Loader samt
Typen, `PanControl2D` `keyCodes`, `TextureResource#load()`, `TextureStore#get()`,
`TextureOptions#anisotrophy` und die vier `anisotrophy`-Klassen; in 0.24.0 (`:722–724`) —
`MapTuple`, `MapSubTypes`; in 0.25.0 (`:356–359`) — `Display.CssRulesPrefixFullscreen` und
`resize-to="fullscreen"`, beide bleiben.

## Gründe der Entscheidungen in Zug 0

- **`MapTuple`/`MapSubTypes` ohne `export`, mit Eintrag in `ACCEPTED`:** beide stehen in den
  Signaturen von `getAsync()`, `on()` und `acquireAsync()` und bleiben deshalb in der `.d.ts`.
  `checkNameableTypes` nennt für einen so erreichbaren, nicht exportierten Namen genau zwei Wege —
  exportieren oder mit Grund in `ACCEPTED`; der erste ist durch die Entscheidung vom 2026-11-18
  verschlossen. Das `export` in `TextureStore.ts` fällt mit, weil kein Nachbar die Typen braucht —
  dieselbe Form wie `TextureClasses`.
- **Unreleased-Fix an `TextureImageLoader#load()` streichen:** 0.26.0 enthält die Klasse nicht; ein
  `### Fixed` daneben beschriebe eine Änderung an etwas, das der Leser im selben Release nirgends
  findet.
- **Der Test zu `load()` in `describe('activate()')` wird umgeschrieben, nicht gelöscht:** er ist
  der einzige, der ein zweites `activate()` gegen doppelt angelegte Effekte prüft.
- **`anisotrophy` im Fall »answers false«:** der kleinste Beleg dafür, dass der alte Name keine
  Klasse mehr ist — und damit dafür, was der Migration Guide über einen Katalog sagt.
- **Kein Laufzeit-Refusal für `keyCodes` oder `defaultOptions.anisotrophy`:** TypeScript lehnt
  beide ab; ein JavaScript-Aufrufer läuft in dasselbe Verhalten wie bei jeder anderen unbekannten
  Option. Ein eigener Wurf für zwei entfernte Namen wäre neue Oberfläche, die keine Entscheidung
  deckt; der Migration Guide sagt, dass `keyCodes` nicht gelesen wird.
- **Modell und Effort:** mittlere Stufe, weil das Paket aus Prosa arbeitet (Migration Guide, Doku)
  und über drei Pakete und ein Skript reicht; `medium` statt `high`, obwohl die öffentliche API
  berührt ist: jede Stelle samt Wortlaut steht hier, und der Detailplan lässt keine
  Entwurfsentscheidung offen.
