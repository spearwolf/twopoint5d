# Paket 11 — Nachtrag aus der Befund-Queue: Resttexte, Fehlermeldungen und Randfälle in texture, Freigabe der map2d-Demos

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nachtragspaket der Drain-Runde) · die elf Einträge aus »Offene Befunde« mit dem Vermerk »in Nachtragspaket 11 aufgenommen«, dazu aus Zug 0 der kleine Befund des Reviewers von Paket 3 an derselben Zeile wie der Loader-Eintrag (`this.fileLoader.path + url` ohne `?? ''`)
- Ziel: Die Befund-Queue der Domain texture ist leer — jede Zusage in TSDoc und Meldung stimmt mit dem Verhalten überein, ein getrimmter Atlas-Frame trägt Lage und Größe seines ungetrimmten Quellbilds als `data` bei sich, und die map2d-Demos geben frei, was sie bauen.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/TextureStore.ts`, `TextureStore.spec.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts`, `TextureResource.spec.ts`
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.ts`, `TextureAtlasLoader.spec.ts`
  - `packages/twopoint5d/src/texture/TexturePackerJson.ts`, `TexturePackerJson.spec.ts`
  - `packages/twopoint5d/src/texture/isAtlasJsonResponse.ts`, `isAtlasJsonResponse.spec.ts`
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, `FrameBasedAnimations.spec.ts`
  - `packages/twopoint5d/src/texture/TextureImageLoader.ts`, `TextureImageLoader.spec.ts`, `TextureAtlasLoader.spec.ts` (eine Assertion)
  - `apps/lookbook/src/demos/map2d/map2d-cam-visi.ts`, `apps/lookbook/src/demos/map2d/map2d-tile-sprites.ts`
  - `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]`, Skill `updating-changelog`)
- Vorgehen (Zeilen gegen `2f8804a8`; jeder Schritt steht für sich, die Reihenfolge ist frei):
  1. **`TextureStore#onResource()` ruft genau einmal** (`TextureStore.ts:345-363`).
     - Neue private Methode `#followResource(id: string, callback: (resource: TextureResource) => void): () => void` mit dem heutigen Rumpf von `onResource()`, unverändert: disposed → `() => {}`; Resource da → sofort rufen, `() => {}` zurück; sonst `on(this, \`${OnResource}:${id}\`, …)`. Kommentar darüber, sinngemäß: die Resource sofort und einmal, wenn sie da ist, sonst mit jedem `parse()`, das sie bringt, solange das Abo steht — dieselbe Instanz wieder eingeschlossen; `on()` und `getAsync()` brauchen das, damit eine Resource, die an die Stelle einer evicted tritt, sie erreicht, und beide überspringen eine Instanz, die sie schon halten.
     - Die beiden internen Aufrufer rufen `this.#followResource(…)` statt `this.onResource(…)`: `:819` (in `on()`, `onReadyHandler`) und `:991` (in `#getOnce()`). Sonst ändert sich dort nichts.
     - `onResource()` selbst: disposed → `() => {}`; Resource da → sofort rufen, `() => {}` zurück; sonst `return once(this, \`${OnResource}:${id}\`, (resource: TextureResource) => callback(resource));` (`once` ist in `:1` schon importiert).
     - TSDoc `:345-350` neu, sinngemäß: »Call `callback` once with the resource `id` — right away if it is already there, otherwise with the first {@link TextureStore.parse} that brings it. A later `parse()` that names the id again does not call it, nor does a resource that takes the place of an evicted one; {@link TextureStore.on} follows the values of a resource. The returned function takes back a callback that is still waiting.« Der Absatz zum disposed Store bleibt.
     - Regressionstests in `TextureStore.spec.ts`, neuer `describe('onResource() calls its callback once', …)`:
       - `a callback that waits for its resource is called once, whatever parse() names the id afterwards` — `onResource('a', cb)` auf leerem Store, zweimal `parse()` mit Item `a` → `cb` genau einmal, mit der Resource. Vor dem Fix rot (2 Aufrufe).
       - `a callback that waits for its resource does not hear a resource that takes the place of an evicted one` — abonnieren, `parse()` mit `a`, `parse({defaultTextureClasses: [], items: {other: {imageUrl: 'other.png'}}}, {evictMissing: true})`, `parse()` mit `a` → `cb` genau einmal. Vor dem Fix rot.
       - `the function onResource() returns takes back a callback that is still waiting` — abmelden vor dem `parse()` → kein Aufruf (Wächter des neuen Pfads, vorher schon grün).
     - Die bestehenden Tests `:1018-1030` und `:1296-1307` (evicted id feuert nicht synchron) bleiben unverändert grün; der Browser-Test `texture-store-on.test.js:384` abonniert nach `loadAsync()` und ist nicht betroffen.
  2. **Spec-Kommentar** `TextureStore.spec.ts:427-428`: Kommentar `// val should be typed as \`Texture | undefined\`` und `void val;` ersetzen durch `expectTypeOf(val).toEqualTypeOf<Texture>();` — `expectTypeOf` zum `vitest`-Import in `:4` nehmen, `type Texture` ist in `:3` schon importiert. Damit hält der Satz in `:425` (»type assertion would fail at build if literal narrowing broke«); `pnpm typecheck` prüft die Specs.
  3. **printWidth** `TextureResource.ts:179` (`derivedImageUrlError`, 142 Zeichen): die Meldung mit `+` auf zwei Zeilen teilen wie `wrongAnimationDataError` `:160-161`, Wortlaut der Meldung Zeichen für Zeichen gleich (`TextureResource.spec.ts:1570` und `TextureStore.spec.ts:1630` prüfen einen Teil davon). Danach hat `TextureResource.ts` keine Zeile über 130. Die übrigen Zeilen über 130 in der Domain (41, Template-Literale von Meldungen und Testnamen in `FrameBasedAnimations.ts`, `TextureStore.ts`, `TileSet.ts`, `checkTextureStoreData.ts` und den Specs) fasst dieses Paket nicht an und meldet sie nicht als Nebenbefund — Begründung unten unter »Entscheidungen in Zug 0«.
  4. **Fehler-URLs im `TextureAtlasLoader`** (`TextureAtlasLoader.ts:78-93`): `const jsonUrl = (this.fileLoader.path ?? '') + url;` samt Kommentar `:83-84` vor den Guard in `:78` ziehen; beide Meldungen nennen `"${jsonUrl}"` statt `"${url}"` (`:79` »is no texture atlas json«, `:91` »names no image and no overrideImageUrl was given«). Das `?? ''` schützt vor einem `path`, den ein Aufrufer zur Laufzeit auf `undefined` gesetzt hat (`@types/three` tippt ihn als `string`). In der TSDoc von `load()` `:51-63` den Satz »A load that fails reaches the caller through `onErrorCallback`« ergänzen: die Meldung nennt die URL, von der die Json kam, also `path` und `url` zusammen. Regressionstests in `TextureAtlasLoader.spec.ts` mit einem `fileLoader`, dessen `path` `'assets/'` ist (das Muster des Paket-3-Tests `a relative meta.image is resolved against the url the json came from, path of the file loader included` übernehmen): eine Antwort, die keine Atlas-Json ist, und eine Json ohne `meta.image` ohne `overrideImageUrl` — jeweils enthält die Meldung `"assets/atlas.json"`. Vor dem Fix rot.
  5. **Getrimmte TexturePacker-Frames tragen ihren Json-Eintrag als `data`** (`TexturePackerJson.ts`, `isAtlasJsonResponse.ts`).
     - `TexturePackerFrameData` `:4-16` bekommt drei optionale Felder mit TSDoc: `trimmed?: boolean` (`true`, wenn der Packer den transparenten Rand abgeschnitten hat — `frame` ist dann der Bereich, der übrig bleibt), `spriteSourceSize?: {x: number; y: number; w: number; h: number}` (wo dieser Bereich im ungetrimmten Sprite liegt), `sourceSize?: {w: number; h: number}` (wie groß das ungetrimmte Sprite ist).
     - `parse()` `:69-79`: jeder Frame geht mit seinem Eintrag der Json als drittem Argument in `target.add(name, coords, frameData)` — dasselbe Objekt, keine Kopie, wie `parse()` auch `data.meta` zurückgibt. Die Schleife destrukturiert dafür `for (const [name, frameData] of entries)` und liest `frame`, `rotated` aus `frameData`. `TexturePackerFrameData` lässt sich an `TextureAtlasFrameData` (`Record<string, any>`) zuweisen (mit `tsc --strict` geprüft).
     - TSDoc von `parse()` `:40-43` ergänzen: jeder Frame trägt seinen Eintrag der Json als `data`, `trimmed`, `spriteSourceSize` und `sourceSize` eingeschlossen; die `coords` eines getrimmten Frames sind der getrimmte Bereich, und ihn dorthin zu legen, wo das ungetrimmte Sprite stünde, ist Sache des Aufrufers.
     - `isFrameData` in `isAtlasJsonResponse.ts:18-32` lässt die drei Felder nur in TexturePackers Form durch, nach der Regel im Kommentar `:15-17`: `trimmed` `undefined` oder Boolean; `spriteSourceSize` `undefined` oder ein Objekt mit Zahlen `x`, `y`, `w`, `h`; `sourceSize` `undefined` oder ein Objekt mit Zahlen `w`, `h`. Die Lookbook-Atlanten (`apps/lookbook/public/assets/splotchs-256x.json`) tragen alle drei in dieser Form.
     - Tests: in `TexturePackerJson.spec.ts` `a trimmed frame carries its entry of the json as data, spriteSourceSize and sourceSize among it` für »JSON Hash« und »JSON Array« (bei Array trägt `data` auch `filename`) — vor dem Fix rot (`data` ist `undefined`); in `isAtlasJsonResponse.spec.ts` ein Frame mit den drei Feldern in TexturePackers Form besteht, `trimmed: 'true'`, ein `spriteSourceSize` ohne `h` und ein `sourceSize` als String fallen durch — die drei Ablehnungen vor dem Fix rot.
     - Nicht in diesem Paket: ein Konsument, der den Quad nach `spriteSourceSize`/`sourceSize` legt (`TexturedSprite#setFrame()`, `AnimatedSprites`, das Layout von `bakeDataTexture()`; `TileSprites` zeichnet Tiles eines `TileSet`, die nie getrimmt sind). Steht als eigener Eintrag in »Offene Befunde« des Plans.
  6. **`FrameBasedAnimations#add()` kopiert das Frame-Array** (`FrameBasedAnimations.ts:209-210`): `frames = args[2].slice();` mit einem Kommentar, warum (der Aufrufer behält das Array und darf es ändern; die Prüfungen darunter gelten dem, was registriert wird). In der TSDoc von `add()` `:148-179` hinter den Absatz zu den Frame-Quellen: »An array of frames is copied: a change to it after the call leaves the animation as it was registered.« Regressionstest in `FrameBasedAnimations.spec.ts`: `an array of frames is copied: emptying it after add() leaves the animation its frames` — `add('walk', 1, frames)` mit zwei `TextureCoords`, danach `frames.length = 0`, `bakeDataTexture()` schreibt für `walk` im Header-Texel `frameCount` 2 und die beiden Frames. Vor dem Fix rot.
  7. **Fehler-URL im Atlas-Image-Effekt** (`TextureResource.ts`).
     - Neues modulinternes Interface neben `AtlasSignals` `:182-190`: `interface FetchedAtlasJson { readonly json: AtlasJsonResponse; readonly url: string }`, Kommentar: `url` ist die URL, von der diese Json kam — `atlasUrl` kann schon die nächste nennen.
     - `AtlasSignals.fetchedAtlasJson: Signal<FetchedAtlasJson | undefined>` (`:188`) und `createSignal<FetchedAtlasJson | undefined>(…)` (`:540`); der Setter von `atlasJson` `:401` setzt weiter `undefined`.
     - Fetch-Effekt `:932`: `fetchedAtlasJsonSignal.set({json: result.json, url: atlasUrl})`.
     - Atlas-Image-Effekt `:948-976`: `const {json, url} = fetched;` nach der `undefined`-Prüfung; `imageUrl = this.overrideImageUrl ?? json.meta.image`; `#fail('atlasImage', {source: 'atlas', url, …})` und die Meldung nennen `url` statt `this.atlasUrl` (`:959`, `:961`); `atlasJsonSignal.set({...json, meta: {...json.meta, image: imageUrl}})`. Der Kommentar `:965-971` spricht weiter vom Fetch-Ergebnis in `#fetchedAtlasJson` und bleibt stimmig.
     - Regressionstest in `TextureResource.spec.ts`: `an atlas json that names no image is reported with the url it came from, not with an atlasUrl written after it` — Atlas-Resource, `fetch` gestubbt: URL A antwortet mit einer Json ohne `meta.image` (`meta.size` gesetzt, sonst lehnt der Guard sie ab), URL B bleibt hängen; `overrideImageUrl` gesetzt, `atlasUrl = A`, `activate()`, warten; dann `atlasUrl = B`, `overrideImageUrl = undefined` → der gemeldete Fehler (`error`-Event mit `source: 'atlas'`) trägt `url` A, und die Meldung nennt `"A"`. Vor dem Fix rot (B).
  8. **Standalone-Factory der `TextureResource`** (`TextureResource.ts:650-662`).
     - Der Effekt baut die Factory ohne Texture-Klasse, wie die Factory des Stores `TextureStore.ts:335` (`new TextureFactory(renderer, [])`), und für einen neuen Renderer eine neue:

       ```ts
       // the factory this fallback built and the renderer it built it for
       let fallback: {renderer: WebGPURenderer; factory: TextureFactory} | undefined;
       createEffect(
         () => {
           const renderer = this.#renderer.get();
           if (!renderer || renderer === fallback?.renderer) return;
           // a factory written from outside — the shared one of a store among them — stays
           const factory = this.#textureFactory.value;
           if (factory && factory !== fallback?.factory) return;
           fallback = {renderer, factory: new TextureFactory(renderer, [])};
           this.textureFactory = fallback.factory;
         },
         {attach: this},
       );
       ```

       `#textureFactory` wird ungetrackt gelesen (`.value`): der Fallback antwortet auf einen Renderer-Wechsel, nicht auf eine geschriebene Factory. Ein geleerter Renderer lässt die Factory stehen — wie ein geleerter `textureFactory` nichts zurücknimmt (Klassen-TSDoc). Der Kommentar `:650-653` sagt das mit: keine Klasse wie beim Store, ein neuer Renderer bringt eine neue Factory mit seinem Anisotropie-Maximum, eine von außen geschriebene Factory bleibt.
     - TSDoc an den `renderer`-Accessor `:489`, sinngemäß: »The renderer a resource on its own builds its textures with. While no `textureFactory` was written from outside — a `TextureStore` writes its shared one — the resource builds a `TextureFactory` for it that starts from no texture class, as the factory of a store does, and a new one whenever another renderer is written; the texture follows the new factory.«
     - Regressionstests in `TextureResource.spec.ts`, `describe('a resource on its own builds its texture factory from its renderer', …)`, mit einem Renderer-Stub wie `makeRendererStub` in `TextureStore.spec.ts:14` (`getMaxAnisotropy`):
       - `starts from no texture class, as the factory of a store does` — `renderer` schreiben, `activate()` → `textureFactory!.getOptions([]).magFilter` ist `undefined` (mit `nearest` wäre es `NearestFilter`). Vor dem Fix rot.
       - `a new renderer brings a new factory with the anisotropy of that renderer` — Stub mit Maximum 4, dann Stub mit Maximum 16 → `textureFactory` ist eine neue Instanz, `getOptions(['anisotropy']).anisotropy` antwortet 16. Vor dem Fix rot.
       - `a factory written from outside stays when a renderer is written` — `textureFactory = X`, dann `renderer` → weiter `X` (Wächter, vorher schon grün).
  9. **TSDoc von `TextureStore#defaultTextureClasses`** `TextureStore.ts:234-246`: den zweiten Absatz `:238-242` neu umbrechen, sodass keine Zeile mitten im Satz endet (»… before it reads it. A resource that no« / »later `parse()` names …«). Wortlaut bleibt.
  10. **Freigabe in den map2d-Demos**, nach dem Muster von `map2d-rect-visi.ts:121-133`:
      - `apps/lookbook/src/demos/map2d/map2d-cam-visi.ts`: `once` zum Import aus `@spearwolf/eventize` (`:17`, `on` steht dort schon), `OnDisplayDispose` zum Import aus `@spearwolf/twopoint5d`; am Ende von `demo.start()` `once(demo, OnDisplayDispose, () => { … })` mit dem Kommentar aus `map2d-rect-visi.ts:121` und in dieser Reihenfolge: `tileRenderer.dispose()`, `map2d.dispose()`, `tileSprites.geometry?.dispose()`, `tileSprites.material?.dispose()`, `store.dispose()` (Kommentar: die Texture gehört dem Store), `panControl.dispose()`. `CameraBasedVisibility` hat kein `dispose()`.
      - `apps/lookbook/src/demos/map2d/map2d-tile-sprites.ts`: dieselben Imports (`once` aus `@spearwolf/eventize`, `OnDisplayDispose`); Handler mit `tiles.dispose()`, `tileSprites.geometry?.dispose()`, `tileSprites.material?.dispose()`, `store.dispose()`, dazu der Rahmen, den die Demo baut: `edges.dispose()`, `geometry.dispose()` (die `BoxGeometry`), `line.material.dispose()`.
      - Die sechs Astro-Seiten, die über den Store laden, bekommen keinen Handler: sie geben gar nichts frei, auch keine Sprites und Materialien, und leben so lange wie die Seite (kein Client-Router im Lookbook). Das ist kein texture-Befund.
  11. **`TextureImageLoader` benennt seine Texture** (`TextureImageLoader.ts:65`): nach `texture = new Texture(imageData.imgEl);` `texture.name = url;` wie `TileSetLoader.ts:70`. Die Texture des `TextureAtlasLoader` heißt damit nach der aufgelösten Bild-URL (er lädt über den `TextureImageLoader`). Tests: in `TextureImageLoader.spec.ts` ein Test nach dem Muster von `TileSetLoader.spec.ts:29-46` (`a loaded image comes back as a texture named by the url`, vor dem Fix rot), in `TextureAtlasLoader.spec.ts` eine Assertion, dass `texture.name` die aufgelöste Bild-URL ist.
  12. **CHANGELOG** `packages/twopoint5d/CHANGELOG.md` unter `[Unreleased]` im Stil der vorhandenen Einträge, Skill `updating-changelog`:
      - `Fixed`: `onResource()` ruft einmal (Schritt 1); eine alleinstehende Resource baut für einen neuen Renderer eine neue Factory (Schritt 8); die Meldung einer Atlas-Json ohne Bild nennt die URL, von der die Json kam (Schritt 7); die Meldungen des `TextureAtlasLoader` nennen `path` und `url` (Schritt 4); `add()` kopiert ein Frame-Array (Schritt 6); die Texture des `TextureImageLoader` heißt nach ihrer URL, wie beim `TileSetLoader` (Schritt 11)
      - `Changed` mit Absatz im Migration Guide: eine alleinstehende `TextureResource` mit Renderer beginnt ohne Texture-Klasse, wie im Store; wer `nearest` will, nennt es in `textureClasses`
      - `Added`: `TexturePackerFrameData#trimmed`, `#spriteSourceSize`, `#sourceSize`, und jeder Frame aus `TexturePackerJson.parse()` trägt seinen Json-Eintrag als `data`; eine Atlas-Json, die eins der drei Felder in anderer Form trägt, gilt als keine Atlas-Json
      - Die Lookbook-Demos, Schritt 2, 3 und 9 brauchen keinen Eintrag.
- Verify: `pnpm run ci && test -z "$(awk 'length > 130' packages/twopoint5d/src/texture/TextureResource.ts)"`
- Commit: `fix(texture,lookbook): call the callback of TextureStore#onResource() once, let a TextureResource on its own start its factory from no texture class and build a new one for a new renderer, name the url an atlas json came from in the errors of TextureResource and TextureAtlasLoader, hand every frame of TexturePackerJson.parse() its entry of the json as data with trimmed, spriteSourceSize and sourceSize typed and checked, copy the frames FrameBasedAnimations#add() is given, name the texture of TextureImageLoader by its url, and let the map2d-cam-visi and map2d-tile-sprites demos release what they build`
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · alle elf Queue-Einträge bestehen an `2f8804a8`, sieben verschoben (`TextureStore.ts:345-363`, `TextureStore.spec.ts:427`, `TextureAtlasLoader.ts:79,91`, `TexturePackerJson.ts:4-16,69-79`, `FrameBasedAnimations.ts:210`, `TextureResource.ts:959,961`, `TextureStore.ts:241-242`), vier an ihrer Stelle (`TextureResource.ts:179`, `:654-662`, die beiden map2d-Demos, `TextureImageLoader.ts:65`) · dazu der kleine Befund von Paket 3 `TextureAtlasLoader.ts:85` (gleiche Zeile) · keine offenen Folgen im Plan · Konsumentenseite getrimmter Frames als neuer Eintrag »→ Rückfrage« in »Offene Befunde« · Restplan: außer 11 kein offenes Paket, keine Umsortierung
  - 2026-09-26 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort medium · Report nach `paket-11.impl-0.json`
  - 2026-09-26 Zug 2: Report FERTIG · 17 Dateien geändert (7 texture-Module samt Specs, 2 map2d-Demos, CHANGELOG), keine neuen · 15 Regressionstests vor dem Fix rot · Arbeitsbaum schmutzig · Verify exit=0 (`paket-11.verify.log`)
  - 2026-09-26 Zug 3: Reviewer (sonnet, medium) freigegeben, 12/12 Schritte erfüllt, keine kritischen/wichtigen · Diff `paket-11.diff` · Runner stuft den kleinen Befund `TextureStore.ts:66-67` (TSDoc von `Resource` schickt zu `onResource()`, das jetzt einmal ruft) auf wichtig
  - 2026-09-26 Zug 4 Runde 1: offen `TextureStore.ts:66-67` (wichtig), dazu zwei kleine (Leerzeile im Fallback-Kommentar, Wächtertest für `path` `undefined`) · Resume des Implementierers `89dd0d09`, sonnet/medium, Report nach `paket-11.impl-1.json`
  - 2026-09-26 Zug 4 Runde 1 zurück: FERTIG · `TextureStore.ts:66-70` neu, Leerzeile im Fallback-Kommentar, Wächtertest `a path a caller set to undefined at runtime leaves the bare url in the message` · Verify exit=0 (`paket-11.verify-1.log`) · Diff `paket-11-1.diff` · Reviewer gezielt beauftragt (`paket-11.review-1.json`)
  - 2026-09-26 Zug 4 Runde 1 Review: freigegeben, `TextureStore.ts:66-70` behoben, keine neuen kritischen/wichtigen · Fortschritt: 1 offener Befund erledigt, keiner zurück
  - 2026-09-26 Zug 5: Commit `f0000436` (17 Dateien, Trailer `Remediation-Run: 2026-09-26`) · Verify `paket-11.verify-1.log` exit=0 · Plan: [x], elf Queue-Einträge auf [x]

## Abgleich

Stand `2f8804a8`, je Eintrag aus »Offene Befunde«:

| Eintrag | Fundstelle jetzt | Einordnung |
| --- | --- | --- |
| TSDoc von `onResource()` gegen sein Verhalten | `TextureStore.ts:345-363`; Umgehungen in den internen Aufrufern `:819-824`, `:991-993` | unverändert, verschoben |
| falscher Spec-Kommentar | `TextureStore.spec.ts:427` | unverändert, verschoben (war `:420`) |
| printWidth in `TextureResource.ts` | `:179`, 142 Zeichen; `:161` und `:775` hat Paket 5 behoben | unverändert |
| Fehler-URLs im `TextureAtlasLoader` | `TextureAtlasLoader.ts:79`, `:91`; `jsonUrl` erst in `:85` | unverändert, verschoben (war `:66,78`) |
| getrimmte TexturePacker-Frames | `TexturePackerJson.ts:4-16` (Typ ohne die Felder), `:69-79` (`add()` ohne `data`) | unverändert, verschoben (war `:38-40`) |
| Frame-Array per Referenz | `FrameBasedAnimations.ts:210` | unverändert, verschoben (war `:208`) |
| Fehler-URL im Atlas-Image-Effekt | `TextureResource.ts:959`, `:961` | unverändert, verschoben (war `:951,953`) |
| Standalone-Factory | `TextureResource.ts:654-662`, `new TextureFactory(renderer)` in `:658`; Default `['nearest']` in `TextureFactory.ts:179` | unverändert |
| TSDoc von `defaultTextureClasses` | `TextureStore.ts:241-242` | unverändert, verschoben (war `:240-241`) |
| Freigabe der map2d-Demos | `map2d-cam-visi.ts` ohne Handler (Store in `:47`), `map2d-tile-sprites.ts` ohne Handler (Store in `:34`); Muster `map2d-rect-visi.ts:121-133` | unverändert |
| `texture.name` im `TextureImageLoader` | `TextureImageLoader.ts:65` ohne Namen, `TileSetLoader.ts:70` mit | unverändert |

Folgen unter erledigten Paketen: keine offen — die von Paket 1 und 2 sind in Paket 7 und 8 behoben, alle übrigen Pakete tragen `Folgen: keine`.

## Entscheidungen in Zug 0

- **`onResource()` folgt der TSDoc, nicht die TSDoc dem Code.** Der Zweig »Resource schon da« ruft einmal und gibt ein leeres Abmelden zurück; die internen Aufrufer `on()` und `getAsync()` filtern die wiederholten Aufrufe mit derselben Instanz aus (`TextureStore.ts:820-824`, `:992-993`) — das Wiederholen ist dort ein Artefakt, das umgangen wird, keine Zusage. Paket 2 hat `on()` auf »einmal je Wert, gleich welches `parse()` folgt« gezogen; `onResource()` bekommt dieselbe Linie. Die internen Aufrufer behalten ihr heutiges Verhalten über `#followResource()`, damit sich an `on()` und `getAsync()` nichts ändert. Im Repo ruft außer den Specs niemand `onResource()` vor dem ersten `parse()` (Browser-Test `texture-store-on.test.js:384` abonniert danach).
- **printWidth: nur `TextureResource.ts`.** Prettier ist im Repo der Maßstab der `printWidth` und lässt Template-Literale stehen; `pnpm lint` ist grün. In der Domain stehen 41 weitere Zeilen über 130, außerhalb 46, fast alle Meldungen in einem Literal und Testnamen. Der Eintrag nennt `TextureResource.ts`, und dort hat Paket 5 die Meldungen mit `+` geteilt (`:160-161`); Zeile `:179` folgt dem, danach ist die Datei unter 130. Die anderen Dateien in einem Rutsch umzubrechen wäre ein Stil-Sweep ohne Befund, und eine geteilte Meldung lässt sich schlechter greppen. Deshalb kein Nebenbefund für sie.
- **Getrimmte Frames: die Daten ja, die Lage des Quads nein.** Der Eintrag nennt als kleinsten Fix, den Frame-Eintrag als `TextureAtlasFrame#data` durchzureichen; die Ziel-Zeile des Plans ist in Zug 0 präzisiert (»trägt Lage und Größe … als `data` bei sich«). Einen Quad nach `spriteSourceSize` zu legen, betrifft `TexturedSprite#setFrame()`, den `AnimatedSprites`-Shader und das Layout des `animsMap` — ein Umbau in der Größe von Paket 9, zur Hälfte außerhalb der Domain. Er steht als eigener Eintrag »→ Rückfrage« in »Offene Befunde«. `data` ist das Json-Objekt selbst, ohne Kopie, wie `parse()` `data.meta` zurückgibt; der Guard prüft die drei jetzt typisierten Felder, weil sein Kommentar verspricht, dass jedes durchgelassene Feld tragfähig ist (Präzedenz: `rotated` in Paket 4).
- **Standalone-Factory beginnt ohne Klasse.** Der Store baut seine Factory mit `[]` (`TextureStore.ts:335`), und der CHANGELOG sagt über den Store schon »starts from no texture class« (`CHANGELOG.md:243`); Paket 10 hat im Lookbook-Katalog `nearest` ausdrücklich nachgetragen. Eine Resource soll allein nicht anders filtern als im Store. Im Repo nutzt niemand den Standalone-Weg (`git grep` findet keinen Aufrufer außerhalb der TSDoc). Für externe Aufrufer ist das eine Verhaltensänderung: `Changed` mit Migration-Hinweis, die Library steht auf 0.x.
- **Fehler-URL des Atlas: die URL reist mit der Json.** Statt `fetchedAtlasJson` beim Wechsel von `atlasUrl` zu leeren (ändert, was ein geleertes `overrideImageUrl` im Fenster bewirkt) trägt das Signal Json und URL zusammen; nur die Meldung ändert sich.
- **Paket-3-Kleinbefund `?? ''` mitgenommen**: dieselbe Zeile wie der Loader-Eintrag, dieselbe Ursache (die URL der Json wird nicht einmal und robust bestimmt), ein Zeichenpaar.
- **Astro-Seiten ohne Handler** bleiben so: keine von ihnen gibt irgendetwas frei; ihre Lebensdauer ist die Seite. Der Eintrag vergleicht die beiden map2d-Demos mit ihrer Schwester `map2d-rect-visi`, und nur dort gibt es das Muster.
- **Modell/Effort:** elf lokale Korrekturen mit Regressionstests über sieben Library-Dateien, eine davon ein Effekt in signalize — mittlere Stufe, `medium`. Keine Teilung: die Lookbook-Seite sind zwei Handler.

## Findings im Volltext

Kein Audit-Finding; die Einträge aus »Offene Befunde« im Wortlaut des Plans (Zeilenangaben dort gegen den jeweiligen Stand, aktuell siehe »Abgleich«):

**`TextureStore.ts:288-293`** — die TSDoc von `onResource()` verspricht einen Aufruf (»right away … otherwise as soon as a parse brings it«), ein vor der Resource angelegtes Abo bleibt aber dauerhaft auf `resource:<id>` und wird von jedem weiteren `parse()` mit dieser id erneut gerufen · vorbestehend (`dff733ff`) · aufgefallen in Paket 2 · low → Scope

**`TextureStore.spec.ts:420`** — der Kommentar »val should be typed as `Texture | undefined`« ist falsch, der Callback bekommt `Texture` · vorbestehend (`dff733ff`) · aufgefallen in Paket 2 · info → Scope

**`TextureResource.ts:167,185`** — zwei Zeilen über der `printWidth` von 130 (162 und 142 Zeichen) · vorbestehend (`dff733ff`) · aufgefallen in Paket 2 · info → Scope · nachgeführt in Zug 0 von Paket 5: jetzt `:161` und `:179`, dazu `:775`; `:161` und `:775` in Paket 5 neu geschrieben (`ee725355`), offen `:179`

**`TextureAtlasLoader.ts:66,78`** — beide `onErrorCallback`-Meldungen nennen `"${url}"` ohne den `path` des `fileLoader`, also nicht die URL, von der die Json kam · vorbestehend (`fceda80b:…/TextureAtlasLoader.ts:51,58`) · aufgefallen in Paket 3 · info → Scope

**`TexturePackerJson.ts:38-40`** — ein getrimmter Frame (`trimmed: true`, TexturePackers Voreinstellung) wird mit den Maßen seines beschnittenen Bereichs angelegt, `spriteSourceSize` und `sourceSize` liest niemand, und `parse()` gibt dem Frame kein `data` mit, aus dem ein Aufrufer sie holen könnte — die Frames einer Animation springen, ein Sprite nach `coords.width`/`height` ist zu klein · vorbestehend (`fceda80b:…/TexturePackerJson.ts:39-41`) · aufgefallen in Paket 4, Zug 0 · eigene Ursache (Lage und Größe des Quads, nicht die UVs, die Paket 4 und 9 behandeln); der kleinste Fix reicht den Frame-Eintrag als `TextureAtlasFrame#data` durch · low → Scope

**`FrameBasedAnimations.ts:208`** — `add()` übernimmt ein Frame-Array des Aufrufers per Referenz (`frames = args[2]`); leert oder ändert er es danach, läuft die Prüfung auf eine leere Frame-Liste ins Leere und der nächste `bakeDataTexture()` schreibt eine Animation ohne Frames · vorbestehend (`fceda80b:…/FrameBasedAnimations.ts:187`) · aufgefallen in Paket 9 · low → Scope

**`TextureResource.ts:951,953`** — der Atlas-Image-Effekt meldet eine Json ohne Bild mit `url: this.atlasUrl`, der aktuellen statt der, von der die Json kam; wechselt `atlasUrl`, während die alte Json noch in `fetchedAtlasJson` liegt, und wird dann `overrideImageUrl` geleert, nennt die Meldung die falsche URL · vorbestehend (`fceda80b:…/TextureResource.ts:760`) · aufgefallen in Paket 5 · info → Scope

**`TextureResource.ts:657-658`** — der Standalone-Fallback baut `new TextureFactory(renderer)` und beginnt damit mit der Klasse `nearest`, eine Resource im Store ohne Klasse; und weil er nur bei `!this.#textureFactory.value` greift, ersetzt ein späterer Renderer die Factory nie, sie behält das Anisotropie-Maximum des ersten · vorbestehend (`ee725355:…/TextureResource.ts:659`) · aufgefallen in Paket 6 · low → Scope

**`TextureStore.ts:240-241`** — die TSDoc von `defaultTextureClasses` bricht mitten im Satz um (»A resource that no« / »later `parse()` names …«) · vorbestehend (`ee725355:…/TextureStore.ts:215`) · aufgefallen in Paket 6 · info → Scope

**`apps/lookbook/src/demos/map2d/map2d-cam-visi.ts:47` und `map2d-tile-sprites.ts:34`** — beide Demos haben keinen `OnDisplayDispose`-Handler und geben weder ihren `TextureStore` (samt Texture) noch Geometrie, Material oder Map frei; `map2d-rect-visi.ts:122-132` tut es · vorbestehend (`e5a19377`: die Loader-Texture wurde dort ebenso nie freigegeben) · aufgefallen in Paket 10 (Reviewer) · low → Scope

**`TextureImageLoader.ts`** — die Texture bekommt keinen `name`, `TileSetLoader.ts:70` setzt `texture.name = url`; uneinheitlich zwischen den deprecated Loadern · vorbestehend (`ee725355`) · aufgefallen in Paket 6 · info → Scope

Dazu aus Zug 0, kleiner Befund des Reviewers von Paket 3 (`Ergebnis:` unter Paket 3 im Plan): **`TextureAtlasLoader.ts:72`** (jetzt `:85`) — `this.fileLoader.path + url` ohne `?? ''`.

## Urteil des Reviewers

Review `paket-11.review-0.json` (freigegeben), Nachprüfung `paket-11.review-1.json` (freigegeben). Je Eintrag, Fundstellen am Stand `f0000436`:

| Schritt / Eintrag | Urteil | Fundstelle |
| --- | --- | --- |
| 1 · TSDoc von `onResource()` gegen sein Verhalten | behoben | `TextureStore.ts` `onResource()` mit `once`, `#followResource()` für `on()` und `getAsync()`; TSDoc der Event-Konstante `Resource` `:66-70` in Runde 1 nachgezogen; Tests `describe('onResource() calls its callback once')` in `TextureStore.spec.ts` |
| 2 · falscher Spec-Kommentar | behoben | `TextureStore.spec.ts`: `expectTypeOf(val).toEqualTypeOf<Texture>()` |
| 3 · printWidth in `TextureResource.ts` | behoben | `derivedImageUrlError` mit `+` geteilt, `awk 'length > 130'` leer |
| 4 · Fehler-URLs im `TextureAtlasLoader` samt `?? ''` | behoben | `TextureAtlasLoader.ts` `jsonUrl` vor dem Guard, beide Meldungen; Tests mit `path` `'assets/'` und Wächter für `path` `undefined` |
| 5 · getrimmte TexturePacker-Frames (`data`) | behoben | `TexturePackerJson.ts` Typ und `parse()`, `isAtlasJsonResponse.ts` `isRect`; Tests für Hash, Array und drei Ablehnungen |
| 6 · Frame-Array per Referenz | behoben | `FrameBasedAnimations.ts` `args[2].slice()`; Test `an array of frames is copied: …` |
| 7 · Fehler-URL im Atlas-Image-Effekt | behoben | `TextureResource.ts` `FetchedAtlasJson {json, url}`; Test `an atlas json that names no image is reported with the url it came from, …` |
| 8 · Standalone-Factory | behoben | `TextureResource.ts` Fallback-Effekt, TSDoc am `renderer`-Accessor; drei Tests in `describe('a resource on its own builds its texture factory from its renderer')` |
| 9 · TSDoc von `defaultTextureClasses` | behoben | `TextureStore.ts` zweiter Absatz neu umbrochen |
| 10 · Freigabe der map2d-Demos | behoben | `map2d-cam-visi.ts`, `map2d-tile-sprites.ts` je `once(demo, OnDisplayDispose, …)` |
| 11 · `texture.name` im `TextureImageLoader` | behoben | `TextureImageLoader.ts` `texture.name = url`; Tests in `TextureImageLoader.spec.ts` und `TextureAtlasLoader.spec.ts` |
| 12 · CHANGELOG | erfüllt | `[Unreleased]` Added, Changed, Fixed, Migration Guide »A `TextureResource` on its own starts from no texture class« |

Regressionstests, vor dem Fix rot (Report `paket-11.impl-0.json`): die beiden `onResource()`-Tests (2 Aufrufe statt 1), zwei `TextureAtlasLoader`-Meldungstests, zwei `TexturePackerJson`-Tests (`data` undefined), drei `isAtlasJsonResponse`-Ablehnungen, der Frame-Array-Test (`frameCount` 0), der Atlas-URL-Test (`B` statt `A`), zwei Factory-Tests (`magFilter` 1003, dieselbe Instanz), zwei `texture.name`-Tests. Wächter, vorher grün: Abmelden von `onResource()`, eine von außen geschriebene Factory bleibt, der Frame in TexturePackers Form besteht, `path` `undefined`.

Kleine Befunde (lösen keine Runde aus):
- `CHANGELOG.md`, `Fixed`-Eintrag zu `onResource()`: »no longer with every later `parse()`« blickt auf den Vorzustand zurück — in einem `Fixed`-Eintrag Hausstil des CHANGELOG, stehen gelassen.
- `TextureResource.ts` Standalone-Fallback: die beiden Kommentare trennt eine leere `//`-Zeile, keine echte Leerzeile — Optik.
- `TextureAtlasLoader.spec.ts`: der Wächtertest für `path` `undefined` wurde nicht gegen den Code ohne `?? ''` rot gesehen.
