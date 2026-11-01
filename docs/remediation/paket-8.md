# Paket 8 — Texturen: Parser, Ressourcen, Loader und DynamicAtlas

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: RES-006 (low), BUG-021 (low), BUG-022 (low), BUG-023 (low), BUG-024 (low), CONS-010 (low), BUG-025 (low), RES-007 (low), BUG-026 (low), PERF-004 (low)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie RES-007 — die Freigabe einer abgelösten Textur wirft in einem `finally` und verdrängt oder verliert dabei einen Fehler): `#takeBackImage()` (`TextureResource.ts:1029-1037`) ruft `previous?.dispose()` im `finally`; ein werfender `dispose`-Listener der zurückgenommenen Textur verlässt den Image-Effekt roh über den globalen Fehlerkanal von signalize
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie BUG-024 — ohne `onErrorCallback` verschwindet ein Fehler von `load()`): `PowerOf2ImageLoader.load()` reicht `onErrorCallback` unverändert an three's `ImageLoader.load()` weiter (`PowerOf2ImageLoader.ts:81`); ein Bild, das nicht lädt, meldet ohne Callback nichts
- Ziel: Atlas- und Animations-Eingaben werden vollständig geprüft und kopiert, Fehler nicht verschluckt, `atlasUrl` verhält sich wie `imageUrl`, und die Dirty-Liste des DynamicAtlas ist konstant im Aufwand.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/AsepriteJson.ts` (+ `AsepriteJson.spec.ts`)
  - `packages/twopoint5d/src/texture/TexturePackerJson.ts` (+ `TexturePackerJson.spec.ts`)
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts` (+ `FrameBasedAnimations.spec.ts`)
  - `packages/twopoint5d/src/texture/PowerOf2ImageLoader.ts` (+ `PowerOf2ImageLoader.spec.ts`)
  - `packages/twopoint5d/src/texture/TextureResource.ts` (+ `TextureResource.spec.ts`)
  - `packages/twopoint5d/src/texture/DynamicAtlas.ts`
  - `packages/twopoint5d/docs/sprites.md` (Abschnitt »Aseprite sheets«, Zeilen 377-385 und 416-421)
  - `packages/twopoint5d/docs/textures.md` (Abschnitt »Reloading and swapping«, Absatz ab Zeile 558)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`: `### Changed`, `### Fixed`, `### Migration Guide`)
- Verify: `pnpm run ci` (zwischendurch genügt `pnpm nx test twopoint5d -- src/texture`; nie zwei Läufe parallel im selben Checkout)
- Commit: `fix(twopoint5d)!: bound the repeat of an Aseprite tag, check the meta, timing and frames the texture module reads, report what a released texture throws and take an atlas back with its atlasUrl`
  - Body (Spiegelstriche, eigene Worte, keine Finding-IDs, kein Rückblick):
    - A tag of `AsepriteJson.parse()` that plays more than `FrameBasedAnimations.MaxTextureSize` frames is refused before a frame list is built; a ping-pong over one frame plays one frame whatever its repeat.
    - The slices of an Aseprite frame are frozen copies of their key, one per key, shared by the frames it is in force at.
    - `TexturePackerJson.parse()` refuses a `meta` that is no object, with `parentCoords` as well.
    - `FrameBasedAnimations#add()` refuses timing that is neither a number nor an object, and a frame of a list that is no `TextureCoords`.
    - `PowerOf2ImageLoader#load()` without `onErrorCallback` writes a failure to the console.
    - An `AtlasTextureResource` reads `meta` and `meta.image` of a json written from outside without a raw throw, reports a dispose listener of a texture it lets go of that throws as an `error` event, and takes the json fetched from `atlasUrl` — with its image, texture, atlas and animations — back when that url is cleared.
    - `DynamicAtlas` keeps its changed cells in a set.
- Vorgehen:
  0. Lies `AGENTS.md` (Fehlermeldungen, `describeValue()`, `#private`, `.js`-Suffix, Suppressions mit Grund) und die Quellen von `src/texture/` ganz, die du änderst — der Effekt-Graph von `AtlasTextureResource` ergibt nur am Stück Sinn. Für signalize den Skill `using-signalize`, für das CHANGELOG den Skill `updating-changelog`. Jeder Korrektheitsfix: erst der Regressionstest, rot sehen, dann beheben; der rote Lauf gehört in den Report.
  1. **Tag-Repeat begrenzen** (`AsepriteJson.ts`).
     - In der Prüfschleife `for (const tag of frameTags)` (Zeilen 404-433) wird der nackte Aufruf `repeatOf(tag);` (Zeile 425) zu `const repeat = repeatOf(tag);` — er prüft weiter jeden Tag, auch einen mit Override. Nach der Playback-Prüfung, nur wenn `override === undefined` (ein Override lässt den Repeat fallen): `n = tag.to - tag.from + 1`, gespielte Frames `count = isPingpong ? n + (repeat - 1) * (n - 1) : repeat * n` für `repeat ≥ 1` (bei `repeat === 0` ist `count = n`). Arithmetisch, ohne ein Array zu bauen. `isPingpong` wie in `framesOfTag()` (`direction` `pingpong` oder `pingpong_reverse`).
     - Ist `count > FrameBasedAnimations.MaxTextureSize`, wirf `new Error(`AsepriteJson: the tag "${tag.name}" plays ${count} frames with a repeat of ${describeValue(tag.repeat)} — an animation holds at most ${FrameBasedAnimations.MaxTextureSize} frames, more fit into no data texture; lower its repeat`)`. Grund für diese Grenze: `FrameBasedAnimations#add()` begrenzt einen `tileCount` mit derselben Begründung auf `MaxTextureSize` (`FrameBasedAnimations.ts:527-534`).
     - In `framesOfTag()` (Zeilen 167-191) direkt nach `if (repeat === 0) …`: `if (isPingpong && pass.length === 1) return {indices: pass, playback: 'once' as AnimationPlayback};` — eine Ping-Pong-Runde über einen Frame fügt nach der ersten nichts hinzu (heute: `indices` = `[from]`, `'once'`), die Schleife liefe sonst `repeat`-mal leer. Verhalten unverändert, nur ohne Schleife.
     - Die Prüfung auf `MaxFramesWithDurations` (Zeilen 438-442) bleibt.
     - TSDoc von `parse()` (Zeilen 309-312, Liste »Refused, with the tag named«): ergänzen um »a tag that plays more than `FrameBasedAnimations.MaxTextureSize` frames at all — a repeat no data texture holds«. Guide `docs/sprites.md` Zeilen 380-382: ein Satz, dass ein Tag, dessen Repeat mehr als `FrameBasedAnimations.MaxTextureSize` (8192) Frames spielt, abgelehnt wird, mit dem Tag benannt, bevor der erste Frame in den Atlas geht.
     - Tests in `AsepriteJson.spec.ts`: `refuses a tag whose repeat plays more frames than a data texture holds` — zwei Frames gleicher Dauer, `repeat: "5000"` (10000 Frames) wirft mit der Meldung oben (vor dem Fix rot: parst ohne Wurf; kein Riesenwert, damit der rote Lauf nicht hängt); dazu an der Grenze `repeat: "4096"` über zwei Frames (8192) wird angenommen, Ping-Pong über drei Frames mit `repeat: "4096"` (3 + 4095·2 = 8193) abgelehnt und mit `"4095"` (8191) angenommen, und ein abgelehnter Tag lässt `options.target` unverändert. Test `a ping-pong over one frame plays that frame once whatever its repeat` mit `repeat: "1000000000"`: `frameCount` 1, `playback` `'once'`, endet sofort (kein roter Lauf nötig — vor dem Fix liefe er minutenlang; das im Report vermerken). Ein Playback-Override mit hohem Repeat bleibt erlaubt (Test: `playback: {t: 'loop'}` neben `repeat: "1000000000"` parst).
  2. **Slices kopieren und einfrieren** (`AsepriteJson.ts`).
     - Zwei Modul-Helfer: `const frozenRect = ({x, y, w, h}: AsepriteRect): AsepriteRect => Object.freeze({x, y, w, h});` und `const frozenSlice = ({bounds, center, pivot}: AsepriteSliceKey): AsepriteFrameSlice => Object.freeze({bounds: frozenRect(bounds), ...(center ? {center: frozenRect(center)} : {}), ...(pivot ? {pivot: Object.freeze({x: pivot.x, y: pivot.y})} : {})});` — kopiert werden genau die geprüften Felder, nichts sonst vom Json.
     - `slicesAt(slices, index, frozen: Map<AsepriteSliceKey, AsepriteFrameSlice>)`: statt `Object.freeze({bounds, …})` in Zeile 279 den Eintrag aus `frozen` holen und beim ersten Mal mit `frozenSlice(key)` anlegen. Die Map entsteht in `parse()` vor der Frame-Schleife (Zeile 459) und lebt nur für diesen Aufruf; so teilen alle Frames, an denen ein Key gilt, ein Objekt.
     - `frame`, `spriteSourceSize` und `sourceSize` der Frame-Daten bleiben flache Kopien des Json-Eintrags: `TexturePackerJson` gibt jedem Frame seinen Eintrag als `data` dokumentiert mit, und ihre Typen sind nicht `readonly`. Kein Nebenbefund.
     - TSDoc: `AsepriteFrameSlice` (Zeilen 88-99) — »Frozen, and a copy of the key in force: the frames a key is in force at share one object.« `parse()` (Zeilen 292-295) nach »The json handed in is left as it is«: »and shares no slice with the atlas«. Guide `docs/sprites.md` Zeilen 418-421: die Slices sind eingefrorene Kopien, ein Objekt je Key.
     - Test `the slices of a frame are frozen copies of their key, one object for every frame the key is in force at`: die `bounds`/`center`/`pivot` eines Frames sind nicht dieselben Objekte wie im Json (vor dem Fix rot: `toBe` derselben Objekte), `Object.isFrozen()` auf Slice, `bounds`, `center`, `pivot`, zwei Frames unter demselben Key liefern dasselbe Slice-Objekt (`toBe`; vor dem Fix rot), ein Schreibversuch auf `bounds.x` wirft im Strict Mode einen `TypeError` und das Json bleibt gleich.
  3. **`meta` in `TexturePackerJson.parse()` immer prüfen** (`TexturePackerJson.ts`).
     - Nach der `frames`-Prüfung (Zeile 91), vor `if (parentCoords === undefined)`: `const meta: unknown = data.meta; if (!isObject(meta)) throw new TypeError(`TexturePackerJson: the json has a meta of ${describeValue(meta)} — a texture atlas json carries its meta as an object {image, size}`);` In Zeile 94 dann `const size: unknown = meta['size'];` ohne den bisherigen `isObject(data.meta) ? … : undefined`-Umweg. Die Prüfung liegt vor dem ersten `add()`, der `target` bleibt bei Ablehnung unverändert.
     - `meta.image` wird hier nicht geprüft: eine Atlas-Ressource reicht einem Adapter ein von außen geschriebenes Json ohne `meta.image` durch, wenn ein `overrideImageUrl` das Bild nennt — das bleibt lesbar.
     - TSDoc `@throws {TypeError}` (Zeilen 64-67): »… the json has a `meta` that is no object, or — without `parentCoords` — no `meta.size` …«.
     - Tests in `TexturePackerJson.spec.ts`: `refuses a meta that is no object, with parentCoords as well` — `meta: undefined` und `meta: 'x'` mit `new TextureCoords(0, 0, 16, 16)` als `parentCoords` werfen den `TypeError` oben (vor dem Fix rot: kein Wurf, `meta` `undefined` zurück), der übergebene `target` bleibt leer; ohne `parentCoords` wirft `meta: undefined` jetzt dieselbe Meldung. Die bestehende Erwartung an Zeile 262-266 (`meta` ein Objekt ohne `size`) bleibt unverändert; eine Spec, die für ein fehlendes `meta` noch »has a meta.size of undefined« erwartet, wird auf die neue Meldung gezogen.
  4. **Timing prüfen** (`FrameBasedAnimations.ts`, `resolveTiming()` Zeilen 183-232).
     - Nach dem `number`-Zweig (Zeile 190): `const value: unknown = timing; if (!isObject(value) || Array.isArray(value)) throw new Error(`FrameBasedAnimations: add() got timing of ${describeValue(value)} for the animation ${animNameInError(name)} — timing is a duration in seconds or an object {duration | frameRate | durations, playback?}`);` — `isObject` aus `../utils/isObject.js`. `Error` wie jede andere Ablehnung in `add()`. Deckt `null`, Strings, Booleans, Funktionen und Arrays.
     - TSDoc: `@throws` von `resolveTiming()` (Zeilen 179-181) und der Absatz »An animation carries at least one frame …« von `add()` (Zeilen 390-395) um »timing that is neither a number nor an object« ergänzen.
     - Test in `FrameBasedAnimations.spec.ts`: `refuses timing that is neither a number nor an object, naming it and the animation` — `null`, `"1"`, `true`, `[0.5]` je mit der Meldung oben (vor dem Fix rot: `null` wirft »Cannot read properties of null«, `"1"` einen rohen `TypeError` des `in`-Operators).
  5. **Frames einer `TextureCoords`-Liste prüfen** (`FrameBasedAnimations.ts`, Zweig `Array.isArray(args[2])` Zeilen 450-453).
     - `import type {TextureCoords}` (Zeile 10) wird ein Wert-Import `import {TextureCoords} from './TextureCoords.js';` (`TextureCoords.ts` importiert nichts, kein Zyklus).
     - Vor der Kopie jedes Element prüfen: `if (!(frame instanceof TextureCoords)) throw new Error(`FrameBasedAnimations: add() got a frame of ${describeValue(frame)} at index ${index} for the animation ${animNameInError(name)} — a frame of a list is a TextureCoords`);`, dann `frames = list.slice()`. `instanceof` wie bei `TextureAtlas` und `TileSet` daneben.
     - TSDoc von `add()` (Absatz »What picks the frames is refused as well …«, Zeilen 397-403): um »a frame of a list that is no `TextureCoords`, naming its index« ergänzen.
     - Test: `refuses a frame of a list that is no TextureCoords, naming its index and the animation` — `[coords, undefined]`, `[{x: 0}]`; nichts registriert, `hasAnimation()` `false`, der Zähler anonymer Namen unverändert (vor dem Fix rot: `add()` nimmt an). Specs, die Attrappen statt echter `TextureCoords` in Listen reichen, auf echte `TextureCoords` ziehen.
  6. **`PowerOf2ImageLoader.load()` ohne Callback** (`PowerOf2ImageLoader.ts`).
     - Ohne `onErrorCallback` gehen beide Fehler auf die Konsole, statt zu verschwinden; erneut werfen scheidet aus, denn der Wurf aus dem `load`-Callback übersprünge in three's `ImageLoader` die übrigen Callbacks desselben Bildes und `manager.itemEnd(url)` (three 0.187.0, `src/loaders/ImageLoader.js`, `onImageLoad()`).
     - Im Padding-`catch` (Zeile 73-76): mit Callback wie bisher, ohne: `console.error(`PowerOf2ImageLoader: the image "${url}" could not be padded to a power of 2, and load() was given no onErrorCallback`, error)`. Als viertes Argument an `this.imageLoader.load()` (Zeile 81) `onErrorCallback ?? ((event) => console.error(`PowerOf2ImageLoader: the image "${url}" did not load, and load() was given no onErrorCallback`, event))`. Jede Konsolenzeile mit `// biome-ignore lint/suspicious/noConsole: load() was given no onErrorCallback, and the failure must not vanish` (Muster: `TextureStore.ts:978`).
     - TSDoc für `load()` (heute keins): was sie liefert, und »Without `onErrorCallback`, a failure — an image that does not load, a padding that fails — is written to the console, and `onLoadCallback` is not called.« Der `@deprecated`-Text der Klasse bleibt.
     - Tests in `PowerOf2ImageLoader.spec.ts` mit einem über den Setter `imageLoader` eingesetzten Fake-Loader: `writes a padding that fails to the console without an onErrorCallback` (kein 2D-Kontext; vor dem Fix rot: `console.error` nie gerufen) und `writes an image that does not load to the console without an onErrorCallback` (Fake ruft das vierte Argument; vor dem Fix rot); mit Callback bleibt die Konsole still.
  7. **Abgelöste Texturen freigeben, ohne Fehler zu verlieren** (`TextureResource.ts`).
     - Modul-Helfer neben `reportError` (Zeile 164): `const disposeCaught = (texture: Texture | undefined): {error: unknown} | undefined => { try { texture?.dispose(); return undefined; } catch (error) { return {error}; } };` mit einem Kommentar, warum: three dispatcht hier den `dispose`-Event der Textur, und ein werfender Listener ist kein Fehlschlag des Schritts, der sie abgelöst hat.
     - `#publishImageWithTexture()` (Zeilen 957-980): das `finally` entfällt; nach dem `try { batch(…) } catch { publishError = … }` `const releaseError = disposeCaught(previous);`, dann `reportError(this, {source: 'texture', id: this.id, error: …})` erst für `publishError`, dann für `releaseError` — zwei Events in der Reihenfolge, in der die Fehler entstanden; kein `#fail()`, also kein Eintrag, der `getAsync()` ablehnen ließe. Dasselbe in `#publishImageWithoutTexture()` (Zeilen 1001-1017) mit `stale`.
     - `#takeBackImage()` (Zeilen 1025-1038): im `finally` `const releaseError = disposeCaught(previous); if (releaseError) reportError(this, {source: 'texture', id: this.id, error: releaseError.error});`.
     - Kommentar Zeilen 895-900 neu: beide Handler werfen nichts mehr — die `error`-Events gehen über `emitSafe()`, und die Freigabe einer abgelösten Textur fängt einen werfenden `dispose`-Listener und meldet ihn —, daher kein abschließendes `.catch()`.
     - TSDoc `TextureResourceEvents`, Unterpunkt »a throw raised while the resource publishes what it loaded …« (Zeilen 101-103): ergänzen um »or a listener of the `dispose` event of a texture the resource lets go of — one a new image replaced, or one taken back with its image —, each reported as an event of its own«.
     - Tests in `TextureResource.spec.ts` (vor dem Fix je rot: kein `error`-Event bzw. ein Unhandled Rejection oder ein roher Wurf aus dem Effekt): `reports a dispose listener of the texture a new image replaces that throws, after the throw of a subscriber of the new texture` (mit Factory: Bild A, dann B; ein Subscriber von `texture` wirft bei B, ein `dispose`-Listener von Textur A wirft; erwartet: zwei `{source: 'texture', id}`-Events in dieser Reihenfolge, kein Unhandled Rejection, Textur B veröffentlicht, A disposed), `reports a dispose listener that throws of the texture a run without a factory takes back` (Pfad `stale`), `reports a dispose listener that throws of the texture a cleared imageUrl takes back` (`#takeBackImage()`; der Setter wirft nicht).
  8. **`meta` eines von außen geschriebenen `atlasJson` sicher lesen** (`TextureResource.ts`, `AtlasTextureResource`).
     - Modul-Helfer: `const imageNamedBy = (json: TexturePackerJsonData): string | undefined => { const meta: unknown = json.meta; if (!isObject(meta)) return undefined; const image = meta['image']; return typeof image === 'string' ? image : undefined; };` mit Kommentar: ein Json von außen ist typisiert, nicht geprüft; alles andere nennt kein Bild. `isObject` aus `../utils/isObject.js`.
     - Effekt, der `imageUrl` ableitet (Zeile 1576): `context.imageUrl.set(this.overrideImageUrl ?? imageNamedBy(this.atlasJson))`. Atlas-Effekt, Bildwächter (Zeile 1612): `… !== (this.overrideImageUrl ?? imageNamedBy(atlasJson))`. Der Atlas-Image-Effekt (Zeile 1539) bleibt: ein geholtes Json hat `isAtlasJsonResponse()` mit `meta` als Objekt passiert, und `typeof imageUrl !== 'string'` fängt dort jeden Nicht-String.
     - Im `try` des Atlas-Effekts als erste Anweisung, vor der Adapterwahl (Zeile 1616 — `pickAtlasAdapter()` liest `json.meta.app` ungeschützt): `const meta: unknown = atlasJson.meta; if (!isObject(meta)) throw new TypeError(`TextureResource: the atlasJson of resource "${this.id}" has a meta of ${describeValue(meta)} — an atlas json carries its meta as an object {image, size}`);` — das `catch` nimmt Atlas und Animationen zurück und meldet `fail('atlasParse', {source: 'texture', …})`, wie bei jedem Adapterfehler.
     - Ergebnis: Ein Json, dessen `meta` kein Objekt ist oder dessen `meta.image` kein String ist, nennt kein Bild. Ohne `overrideImageUrl` gilt die bestehende Regel für ein Json ohne Bild — kein `imageUrl`, `imageCoords`, `texture`, `atlas`, `frameBasedAnimations` zurück, kein `error` (Vertrag der Spec `an atlas json written from outside that names no image takes the texture and the atlas back`, Zeile 2796, `errors` leer). Mit `overrideImageUrl` lädt das Bild des Overrides, und ein `meta`, das kein Objekt ist, wird einmal als `error` mit `source: 'texture'` gemeldet, sobald das Bild da ist; ein falsches `meta.image` spielt neben einem Override keine Rolle, wie beim geholten Json.
     - Abweichung von der Empfehlung, mit Grund: ein `meta.image`, das kein String ist, wird nicht als `atlasParse` gemeldet, sondern wie ein fehlendes Bild behandelt. Ein von außen geschriebenes Json ohne Bild meldet heute nichts, und die Spec Zeile 2796 hält das fest; den Vertrag zu kippen ist nicht Teil des Findings. Eine Meldung im Atlas-Effekt vor dem Bildwächter liefe außerdem nach dem Zurücknehmen von `imageCoords` ein zweites Mal.
     - TSDoc: `atlasJson` (Zeilen 1350-1374) — ein Punkt: »A json whose `meta` is no object, or whose `meta.image` is no string, names no image: without an `overrideImageUrl` it is treated as a json that names none; beside one, a `meta` that is no object is reported as a json its adapter cannot read.« Klassen-TSDoc »What is taken back« (Zeilen 323-325): »… whose json names no image — a `meta` that is no object or a `meta.image` that is no string names none — …«. `TextureResourceEvents` Zeilen 106-107: »… cannot read — a `meta` that is no object among it —, as soon as …«.
     - Tests (vor dem Fix je rot): `an atlasJson written from outside whose meta is no object names no image` — erst gültiges Json samt Bild, dann `{...atlasJson, meta: undefined}`: Schreiben wirft nicht, kein roher `TypeError` aus einem Effekt, `atlas`, `texture` `undefined`, `errors` leer; `an atlasJson written from outside whose meta.image is no string loads no image` — `meta: {...atlasJson.meta, image: 42}`: der Image-Loader wird nie mit `42` gerufen, `imageUrl` `undefined`, `errors` leer; `beside an overrideImageUrl, an atlasJson written from outside whose meta is no object is reported once as a json its adapter cannot read` — genau ein Event `{source: 'texture', id}` mit dem `TypeError` oben (vor dem Fix: die rohe Meldung »Cannot read properties of undefined (reading 'app')«), `texture` aus dem Override steht, `atlas` `undefined`.
  9. **`atlasUrl = undefined` nimmt zurück, was von ihr kam** (`TextureResource.ts`, Entscheidung des Plans vom 2026-10-31: wie `imageUrl = undefined`, erste Option der Empfehlung).
     - Im Fetch-Effekt (Zeilen 1490-1531) ersetzt `if (!atlasUrl) return;` (Zeile 1494) durch: ohne Url und mit geholtem Json (`fetchedAtlasJsonSignal.value !== undefined`) in einem `batch()` `fetchedAtlasJsonSignal.set(undefined)`, `atlasJsonSignal.set(undefined)` und `context.imageUrl.set(undefined)`, dann `return`. Kommentar: eine gelöschte Url nimmt das von ihr geholte Json zurück und mit ihm, was daraus gebaut ist, wie ein gelöschtes `imageUrl`; ein von außen geschriebenes Json hat keine Url und bleibt. Der Image-Effekt nimmt dann `imageCoords` und `texture` zurück und gibt die Textur frei, der Atlas-Effekt `atlas` und `frameBasedAnimations`, der Atlas-Image-Effekt löscht den Eintrag `atlasImage`; ein laufender Fetch bricht schon heute über das Cleanup ab.
     - Woran »von außen« erkennbar ist: der `atlasJson`-Setter leert `#fetchedAtlasJson` (Zeile 1389). Mit `#fetchedAtlasJson` gesetzt ist `atlasJson` das geholte Json oder — bei einem geholten Json ohne Bild — schon `undefined`.
     - `overrideImageUrl` bleibt als Eingabe stehen und wirkt wieder, sobald ein neues Json kommt; ohne Json leitet der `imageUrl`-Effekt nichts ab.
     - TSDoc: `atlasUrl` (Zeilen 1335-1338) — »A cleared url takes the json fetched from it back, and with it the `imageUrl`, the `imageCoords`, the `texture` — released —, the `atlas` and the `frameBasedAnimations`, as a cleared `imageUrl` does on an image or a tile set resource; an `atlasJson` written from outside has no url and stays.« Klassen-TSDoc »What is taken back«: neuer Punkt mit demselben Inhalt. Guide `docs/textures.md`, Absatz ab Zeile 558: ein Satz dazu und wie man das Json behält (`resource.atlasJson = resource.atlasJson` vor dem Löschen der Url macht es zu einem von außen).
     - Tests (vor dem Fix je rot): `a cleared atlasUrl takes back the json fetched from it, its image, texture, atlas and animations, and releases the texture` — nach Fetch und Bild: `atlasJson`, `imageUrl`, `imageCoords`, `texture`, `atlas`, `frameBasedAnimations` `undefined`, Textur disposed, kein `error`, ein später Subscriber von `atlas` hört nichts (retained Event geleert); `a cleared atlasUrl leaves an atlasJson written from outside standing` — nach Fetch `resource.atlasJson = resource.atlasJson!`, dann `atlasUrl = undefined`: alles bleibt (grün auch vor dem Fix, hält den Migrationsweg fest). Die Specs Zeilen 2286, 2316, 2372 und 2796 (Url vor `activate()` gelöscht) bleiben unverändert grün.
  10. **Dirty-Liste als Set** (`DynamicAtlas.ts`).
      - `readonly #dirty: FrameRect[] = []` (Zeile 178) → `readonly #dirty = new Set<FrameRect>()`; `#changed()` (Zeilen 746-752): `else this.#dirty.add(rect);` ohne `includes()`. In `upload()` (Zeilen 476-530) `dirty.size` statt `dirty.length` (Zeilen 477 und 488), `dirty.clear()` statt `dirty.length = 0` (Zeilen 490, 529); ebenso in `clear()` (Zeile 451) und `dispose()` (Zeile 551). Die Iteration `for (const rect of dirty)` bleibt, die Einfügereihenfolge eines `Set` erhält die Reihenfolge der Kopien. Der Kommentar Zeile 177 (»each once«) bleibt wahr.
      - Kein neuer Test: Verhalten unverändert, die Spec `copies a cell changed twice once, and nothing at the next call without a change` (`DynamicAtlas.spec.ts:962`) hält die Deduplizierung fest. Kein CHANGELOG-Eintrag (keine sichtbare Änderung).
  11. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, Skill `updating-changelog`). Alle betroffenen APIs sind seit 0.24.0 oder früher veröffentlicht.
      - `### Changed`: `change AtlasTextureResource#atlasUrl: clearing it takes back the json fetched from it and, with it, imageUrl, imageCoords, texture (released), atlas and frameBasedAnimations, as clearing imageUrl does on an image or a tile set resource; an atlasJson written from outside stays (**BREAKING**). See the Migration Guide` — sinngemäß, Code in Backticks. BREAKING wie bei der Ablehnung in `TextureStore.loadAsync()` unter `[0.24.0]` (Zeile 124 des Abschnitts): eine sichtbare Verhaltensänderung einer veröffentlichten API.
      - `### Migration Guide`: `#### Clearing atlasUrl takes the atlas back` mit Before/After — vorher blieben Atlas und Textur nach `resource.atlasUrl = undefined` stehen; wer sie behalten will, schreibt das Json vorher von außen: `resource.atlasJson = resource.atlasJson;` dann `resource.atlasUrl = undefined;`.
      - `### Fixed`, je ein Eintrag: Repeat-Grenze in `AsepriteJson.parse()` (Meldung, kein Frame-Array vorher; Ping-Pong über einen Frame), eingefrorene Slice-Kopien, `TexturePackerJson.parse()` prüft `meta` auch mit `parentCoords`, `FrameBasedAnimations#add()` lehnt Timing ohne Zahl/Objekt und Listen-Frames ohne `TextureCoords` mit benannter Meldung ab, `PowerOf2ImageLoader#load()` ohne `onErrorCallback` schreibt Fehler auf die Konsole, `AtlasTextureResource` liest `meta`/`meta.image` eines Jsons von außen ohne rohen Wurf und meldet einen werfenden `dispose`-Listener einer abgelösten oder zurückgenommenen Textur als `error`-Event mit `source: 'texture'`. Beschreibt, was jetzt gilt — kein »früher«, kein »statt bisher« (Konvention des Plans).
  12. Am Ende `pnpm run ci` und den Report nach dem Rückgabevertrag.
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · alle zehn Fundstellen unverändert (`src/texture/` seit d9b648bf nur in `sampleAtlasFrame.ts` berührt): RES-006 `AsepriteJson.ts:180`/`:438`, BUG-021 `:279`, BUG-022 `TexturePackerJson.ts:169`, BUG-023 `FrameBasedAnimations.ts:194`, BUG-024 `PowerOf2ImageLoader.ts:74`, CONS-010 `TextureResource.ts:1494`, BUG-025 `:1576`/`:1612`, RES-007 `:975`/`:1012`, BUG-026 `FrameBasedAnimations.ts:453`, PERF-004 `DynamicAtlas.ts:749` · zwei Nebenbefunde gleicher Ursache aufgenommen (`#takeBackImage()` `TextureResource.ts:1029-1037`; Ladefehler ohne Callback `PowerOf2ImageLoader.ts:81`) · offene Folgen: keine unter erledigten Paketen; »Offene Befunde« ohne Eintrag gleicher Ursache · Restplan unverändert (Pakete 9–13 berühren `src/texture/` nicht)
  - 2026-11-01 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-8.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG · 14 Dateien geändert (`src/texture/` 11, `docs/sprites.md`, `docs/textures.md`, `CHANGELOG.md`) · Arbeitsbaum schmutzig · roter Lauf je Bugfix belegt · Verify (eigen) `pnpm run ci` exit=0, `paket-8.verify.log`
  - 2026-11-01 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-8.diff`
  - 2026-11-01 Zug 3: Urteil freigegeben · alle zehn Findings und beide »Dazu«-Punkte behoben · 2 klein · Report `paket-8.review-0.json`
  - 2026-11-01 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-01 Zug 5: Commit fd239a63 (14 Dateien), Verify `paket-8.verify.log` exit=0, Trailer `Remediation-Run: 2026-10-31`

## Review (Zug 3, opus, freigegeben)

| Finding | Urteil | Fundstelle (Stand fd239a63) |
| --- | --- | --- |
| RES-006 | behoben | `AsepriteJson.ts:458-470` (Grenze), `:179` (Ping-Pong über einen Frame), TSDoc `:335-336`, `docs/sprites.md:382-384` |
| BUG-021 | behoben | `AsepriteJson.ts:274-281` (`frozenRect`/`frozenSlice`), `:297-301`, `:498`; TSDoc `:90-91`, `:318`; `docs/sprites.md:422-423` |
| BUG-022 | behoben | `TexturePackerJson.ts:95-100`, `:103`; `@throws` `:66-67` |
| BUG-023 | behoben | `FrameBasedAnimations.ts:194-201`; TSDoc `:180-183`, `:405-406` |
| BUG-024 | behoben | `PowerOf2ImageLoader.ts:83-91`; TSDoc `:39-44` |
| CONS-010 | behoben | `TextureResource.ts:1533-1546`; TSDoc `:369-372`, `:1369-1372`; `docs/textures.md:560-563`; CHANGELOG Changed (BREAKING) + Migration Guide |
| BUG-025 | behoben | `TextureResource.ts:251-258` (`imageNamedBy()`), `:1628`, `:1664`, `:1668-1675`; TSDoc `:109-110`, `:347-349`, `:1405-1407` |
| RES-007 | behoben | `TextureResource.ts:171-181` (`disposeCaught()`), `:1000-1008`, `:1040-1047`; Kommentar `:923-925`; TSDoc `:102-106` |
| BUG-026 | behoben | `FrameBasedAnimations.ts:463-475`, Wert-Import `:11`; TSDoc `:409` |
| PERF-004 | behoben | `DynamicAtlas.ts:178`, `:750`, `:451`, `:477`, `:488-490`, `:529`, `:551` |
| Dazu `#takeBackImage()` | behoben | `TextureResource.ts:1065-1068` |
| Dazu Ladefehler ohne Callback | behoben | `PowerOf2ImageLoader.ts:98-102` |

Kleine Befunde (keine Runde):
- `AsepriteJson.ts:464-469` — bei `repeat === 0` ist `count = n`; ein Loop-Tag über mehr als 8192 Frames wird mit »… with a repeat of "0" … lower its repeat« abgelehnt, der Rat passt dort nicht (praktisch kaum erreichbar, TSDoc deckt es mit »at all«).
- `AsepriteJson.ts:336` (114 Zeichen) und `FrameBasedAnimations.ts:409-410` — TSDoc-Absätze nach dem Einfügen nicht neu umbrochen.

Nebenbefund (Urteil `→ Scope`, Scope-Regel »alles, info eingeschlossen«): `TextureCoords.spec.ts:109` doppeltes `describe('root')`, vorbestehend.

## Abgleich

| Finding | Fundstelle jetzt | Einordnung |
| --- | --- | --- |
| RES-006 | `AsepriteJson.ts:180` (Schleife in `framesOfTag()`), `:438` (Grenze nur bei ungleichen Dauern), `repeatOf()` `:146-156` ohne Obergrenze | unverändert |
| BUG-021 | `AsepriteJson.ts:279` — `Object.freeze({bounds, …})` friert nur die Hülle ein, je Frame neu | unverändert |
| BUG-022 | `TexturePackerJson.ts:169` — `return [target, data.meta]`, `meta` nur ohne `parentCoords` gelesen (`:93-103`) | unverändert |
| BUG-023 | `FrameBasedAnimations.ts:194` — `timing.playback` ohne Objektprüfung | unverändert |
| BUG-024 | `PowerOf2ImageLoader.ts:73-76` — `onErrorCallback?.(error); return;` | unverändert |
| CONS-010 | `TextureResource.ts:1494` — `if (!atlasUrl) return;` im Fetch-Effekt | unverändert |
| BUG-025 | `TextureResource.ts:1576` (`this.atlasJson.meta.image` im `imageUrl`-Effekt), `:1612` (Bildwächter vor dem `try`) | unverändert |
| RES-007 | `TextureResource.ts:975-980` und `:1012-1017` — `previous?.dispose()`/`stale?.dispose()` im `finally` vor der Meldung | unverändert; dazu `#takeBackImage()` `:1029-1037` |
| BUG-026 | `FrameBasedAnimations.ts:453` — `frames = args[2].slice();` ohne Elementprüfung | unverändert |
| PERF-004 | `DynamicAtlas.ts:749` — `!this.#dirty.includes(rect)` | unverändert |

Nachgesehen mit `git diff --stat d9b648bf HEAD -- packages/twopoint5d/src/texture/` (nur `sampleAtlasFrame.ts`, Paket 1) und an jeder Fundstelle im Stand 88a937ca.

**Nebenbefunde in dieses Paket** (beide vorbestehend, an d9b648bf identisch):
- `#takeBackImage()` teilt die Ursache von RES-007 — die Freigabe einer abgelösten Textur im `finally`, deren werfender Listener ungefangen bleibt. Ohne ihn behöbe das Paket die Ursache an zwei von drei Stellen.
- Der Ladefehler ohne `onErrorCallback` in `PowerOf2ImageLoader.load()` teilt die Ursache von BUG-024 — dieselbe Methode, dieselbe fehlende Regel »ohne Callback auf die Konsole«.

**Entscheidungen dieses Zugs** (vom Runner, je mit Grund oben im Vorgehen):
- Grenze für den Tag-Repeat ist `FrameBasedAnimations.MaxTextureSize` gespielter Frames, gerechnet vor jedem Array (Präzedenz `tileCount`).
- Slice-Kopien mit genau den geprüften Feldern, ein eingefrorenes Objekt je Key, geteilt von den Frames.
- `TexturePackerJson.parse()` prüft `meta` als Objekt, nicht `meta.image` (Override-Pfad der Atlas-Ressource).
- `PowerOf2ImageLoader`: `console.error` statt erneut werfen (three's `ImageLoader` bräche seine Buchführung).
- RES-007: zwei getrennte `error`-Events statt eines `AggregateError` — jedes trägt seinen eigenen Fehler, ein Listener muss nichts auspacken; Meldung über `reportError()`, nicht `#fail()`, wie bei einem werfenden Subscriber.
- BUG-025: Abweichung von der Empfehlung für ein `meta.image`, das kein String ist (siehe Schritt 8).
- CONS-010: nur ein geholtes Json wird mit der Url zurückgenommen; CHANGELOG `Changed` mit **BREAKING**, Migration Guide, Commit mit `!` (Repo-Praxis, z. B. 801906f3 `fix(texture)!:`).
- Modell stärkste Stufe: Schritte 7–9 ändern den Effekt-Graph von `AtlasTextureResource` (Reihenfolge der Effekte, Batches, Zurücknehmen), wo ein falscher Schritt still eine Textur verliert oder doppelt meldet. Effort `medium`: der Detailplan nennt Werte und Stellen.

## Findings im Volltext

**RES-006 · low · packages/twopoint5d/src/texture/AsepriteJson.ts:180** (auch `:438`) — Obergrenze für `repeat` eines Aseprite-Tags setzen
`framesOfTag()` baut für ein Tag mit `repeat` r ≥ 1 ein Indexarray der Länge r × Frames. `repeatOf()` prüft nur Ganzzahl ≥ 0, keine Obergrenze. Das Limit `MaxFramesWithDurations` greift nur bei ungleichen Dauern; bei gleichen Dauern wird jedes beliebig große `repeat` (etwa `"1000000000"`) materialisiert, die Schleife läuft r-mal und `indices.map` plus `frameNames` allozieren erneut — der Parse hängt oder läuft in Out-of-Memory, obwohl 'once' mit einer Gesamtdauer genügen würde.
Beleg: `for (let i = 0; i < repeat; i++) { … indices.push(...pass) }`
Empfehlung: `repeat` gegen eine sinnvolle Höchstzahl (oder Gesamtframezahl) prüfen und mit klarer Fehlermeldung ablehnen, bevor `indices` gebaut wird.

**BUG-021 · low · packages/twopoint5d/src/texture/AsepriteJson.ts:279** — Slice-Rechtecke des Aseprite-Json kopieren statt zu teilen
`slicesAt()` friert nur das äußere Objekt ein; `bounds`, `center` und `pivot` sind dieselben Objekte wie im übergebenen Json. Die Doku verspricht „The json handed in is left as it is" und `AsepriteFrameSlice` ist `readonly` — wer `frame.data.slices.x.bounds.x` ändert, verändert das Quell-Json und alle Frames, die denselben Key teilen (ein Key gilt für viele Frames).
Beleg: `Object.freeze({bounds, ...(center ? {center} : {}), ...(pivot ? {pivot} : {})})`
Empfehlung: Rechtecke und Pivot beim Aufbau kopieren (und einfrieren) oder die gemeinsame Nutzung dokumentieren; ein Slice-Objekt je Key cachen statt je Frame neu zu bauen.

**BUG-022 · low · packages/twopoint5d/src/texture/TexturePackerJson.ts:169** — `meta` in `TexturePackerJson.parse()` prüfen, wenn `parentCoords` gegeben ist
Nur ohne `parentCoords` wird `data.meta` gelesen und geprüft. Mit `parentCoords` gibt `parse()` `data.meta` ungeprüft zurück, obwohl der Rückgabetyp `TexturePackerMetaData` ein Objekt verspricht — fehlt `meta`, bekommt der Aufrufer `undefined` ohne Fehler und stolpert später an anderer Stelle (`meta.image`).
Beleg: `return [target, data.meta];`
Empfehlung: `meta` in beiden Pfaden als Objekt prüfen (TypeError mit Subjekt), oder den Rückgabetyp ehrlich auf `| undefined` setzen.

**BUG-023 · low · packages/twopoint5d/src/texture/FrameBasedAnimations.ts:194** — Timing, das `null` oder kein Objekt ist, mit benanntem Fehler ablehnen
`resolveTiming()` behandelt Timing aus einem JSON-Katalog sonst sorgfältig (Playback, doppelte Felder), liest aber `timing.playback` ohne Prüfung auf `null`/String/Array. Ein Katalog mit `"timing": null` löst einen rohen `TypeError: Cannot read properties of null` ohne Subjekt und Animationsnamen aus — gegen die Meldungsregel des Projekts.
Beleg: `const playback: unknown = timing.playback === undefined ? 'loop' : timing.playback;`
Empfehlung: Vor dem Zugriff `isObject(timing)` prüfen und mit `FrameBasedAnimations: add() got timing of … for the animation …` ablehnen.

**BUG-024 · low · packages/twopoint5d/src/texture/PowerOf2ImageLoader.ts:74** — Fehler des Padding-Schritts in `PowerOf2ImageLoader.load()` nicht verschlucken
Wirft das Padding (kein 2D-Kontext, `drawImage`) und wurde kein `onErrorCallback` übergeben, ruft `onErrorCallback?.(error)` nichts auf: der Fehler verschwindet, weder `onLoadCallback` noch ein Log läuft, der Aufrufer wartet für immer. Die Klasse ist deprecated, der Pfad existiert aber noch.
Beleg: `onErrorCallback?.(error); return;`
Empfehlung: Ohne Callback den Fehler per `console.error` melden oder erneut werfen; im Deprecation-Text darauf hinweisen.

**CONS-010 · low · packages/twopoint5d/src/texture/TextureResource.ts:1494** — `atlasUrl = undefined` einer Atlas-Ressource konsistent zurücknehmen
Wird `imageUrl` einer Bild- oder Tile-Set-Ressource gelöscht, nimmt die Ressource Koordinaten, Textur, Atlas und Animationen zurück (dokumentiert). Löscht man `atlasUrl` einer Atlas-Ressource, kehrt der Fetch-Effekt mit `return` zurück: `#fetchedAtlasJson`, `atlasJson`, `imageUrl`, Textur, Atlas und Animationen bleiben stehen, ein laufender Fetch wird zwar abgebrochen, aber nichts wird zurückgenommen. Das Verhalten steht weder im TSDoc von `atlasUrl` noch in den Regeln „What is taken back" der Klasse.
Beleg: `const atlasUrl = this.atlasUrl; if (!atlasUrl) return;`
Empfehlung: Entweder beim Löschen der URL `#fetchedAtlasJson` leeren (dann folgen Atlas und Textur wie beim Bild) oder das Stehenbleiben im TSDoc von `atlasUrl` festschreiben.
Entscheidung des Plans (2026-10-31): erste Option, Verhaltensänderung im CHANGELOG.

**BUG-025 · low · packages/twopoint5d/src/texture/TextureResource.ts:1576** (auch `:1612`) — `meta` eines von außen geschriebenen `atlasJson` vor dem Lesen prüfen
Das TSDoc von `atlasJson` verspricht, dass ein nicht lesbares Json als `error` (source 'texture') gemeldet wird und das Schreiben nicht wirft. Der Effekt, der `imageUrl` ableitet, und der Atlas-Effekt lesen aber `atlasJson.meta.image` ungeschützt (Zeile 1612 liegt vor dem `try`). Ein Json ohne `meta` (JS-Aufrufer, Cast) löst einen rohen TypeError im Effekt aus, der über den globalen Fehlerkanal von signalize läuft; ein nicht-String als `meta.image` landet ungeprüft als `imageUrl` und geht an den Image-Loader.
Beleg: `context.imageUrl.set(this.overrideImageUrl ?? this.atlasJson.meta.image);`
Empfehlung: `meta` und `meta.image` im `atlasJson`-Setter oder in beiden Effekten prüfen und den Fall als `fail('atlasParse', …)` melden wie einen Adapterfehler.

**RES-007 · low · packages/twopoint5d/src/texture/TextureResource.ts:975** (auch `:1012`) — Werfenden Dispose-Listener der abgelösten Textur nicht den `publishError` verschlucken lassen
`#publishImageWithTexture()` und `#publishImageWithoutTexture()` fangen den Wurf eines Subscribers in `publishError` und melden ihn nach dem `finally`. Wirft `previous.dispose()` im `finally` (ein `dispose`-Listener der abgelösten Textur), ersetzt dieser Wurf den Ablauf: der `error`-Event für `publishError` geht nie hinaus, und der Wurf endet als unhandled rejection aus dem `.then()`-Handler (der Kommentar bei Zeile 895 nimmt das in Kauf). Der Fehler des Subscribers geht dabei verloren.
Beleg: `} finally { previous?.dispose(); } if (publishError) { reportError(…) }`
Empfehlung: `previous?.dispose()` in ein eigenes try/catch legen, beide Fehler per `reportError()` melden (wie `dispose()` es mit `throwCollected` tut), statt einen Wurf aus dem Promise-Handler entkommen zu lassen.

**BUG-026 · low · packages/twopoint5d/src/texture/FrameBasedAnimations.ts:453** — Elemente einer `TextureCoords`-Liste in `FrameBasedAnimations#add()` prüfen
Die Variante mit einer Liste von `TextureCoords` kopiert das Array, prüft aber kein Element. `add()` ist die Stelle, an der alle anderen Eingaben (Tile-Ids, Frame-Namen, Query, Timing) mit benannter Meldung abgelehnt werden; ein Element, das keine `TextureCoords` ist (JS-Aufrufer, Katalog-Eigenbau, `undefined` im Array), wird akzeptiert, `animation()` hält es als `{coords}`, und erst `bakeDataTexture()` scheitert mit einem rohen `coords.getTexCoords is not a function`, ohne Animations- und Elementnamen.
Beleg: `frames = args[2].slice();`
Empfehlung: Jedes Element mit `instanceof TextureCoords` prüfen und mit `FrameBasedAnimations: add() got a frame of … at index … for the animation …` ablehnen, bevor die Animation registriert wird.

**PERF-004 · low · packages/twopoint5d/src/texture/DynamicAtlas.ts:749** — Dirty-Liste des `DynamicAtlas` ohne lineare Suche pflegen
`#changed()` prüft mit `this.#dirty.includes(rect)`, ob eine Zelle schon vorgemerkt ist: eine lineare Suche je Änderung, also quadratisch in der Zahl der Änderungen zwischen zwei `upload()`-Aufrufen. Wer nach dem ersten `upload()` viele kleine Zellen anlegt oder neu zeichnet (Textlabels, Zähler), zahlt n² Vergleiche; die Grenze von `WHOLE_UPLOAD_SHARE` greift erst in `upload()`, nicht beim Sammeln.
Beleg: `} else if (!this.#dirty.includes(rect)) { this.#dirty.push(rect);`
Empfehlung: Die Liste als `Set<FrameRect>` führen (Einfügereihenfolge bleibt erhalten) oder ein Flag am `FrameRect` setzen.
