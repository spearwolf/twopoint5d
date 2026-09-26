# Paket 1 — Sicherungsnetz: texture-Specs ordnen und die Lücken um Loader und Fehlerpfade schließen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-016 (low, anteilig — siehe »Nicht in diesem Paket«), TEST-017 (low),
  TEST-018 (low), CONS-042 (info), TEST-030 (info), CONS-051 (info), CONS-048 (info)
- Nebenbefunde gleicher Ursache, in diesem Paket mit behoben (Begründung unter »Entscheidungen
  in Zug 0«):
  - die übrigen nackten bzw. nur auf die Klasse prüfenden Würfe der texture-Specs
    (Ursache von TEST-030)
  - die Meldungen der beiden Timing-Helfer in `FrameBasedAnimations.ts` ohne Präfix und
    Animationsnamen, und eine `duration` als String ohne Anführungszeichen (Ursache von CONS-051
    und CONS-048)
  - `RectangularVisibilityArea` schreibt einen String-Wert ungequotet (Symptom von CONS-048)
- Ziel: Die texture-Specs liegen dort, wo ihr Gegenstand liegt, prüfen Meldungen statt nackter
  Würfe und decken Loader und Fehlerpfade ab, bevor die folgenden Pakete den Code umbauen.
- Modell: mittlere Stufe
- Effort: medium
- Verify: `pnpm run ci` (Repo-Root)
- Commit: die Message im Abschnitt »Commit« unten, wörtlich
- Dateien:
  - neu: `packages/twopoint5d/src/utils/describeValue.ts`,
    `packages/twopoint5d/src/utils/assertPositiveFinite.spec.ts`,
    `packages/twopoint5d/src/texture/isAtlasJsonResponse.spec.ts`,
    `packages/twopoint5d/src/texture/TexturePackerJson.spec.ts`
  - geändert, Code: `packages/twopoint5d/src/utils/assertPositiveFinite.ts`,
    `packages/twopoint5d/src/texture/TileSet.ts`,
    `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`,
    `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts`
  - geändert, Specs: `packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts`,
    `TextureResource.spec.ts`, `TextureStore.spec.ts`, `TileSet.spec.ts`,
    `PowerOf2ImageLoader.spec.ts`, `TextureImageLoader.spec.ts`, `TileSetLoader.spec.ts`,
    `TextureAtlasLoader.spec.ts` (alle in `packages/twopoint5d/src/texture/`),
    `packages/twopoint5d/src/map2d/RectangularVisibilityArea.spec.ts`
  - Doku: `packages/twopoint5d/CHANGELOG.md` (drei Einträge unter `[Unreleased]` ergänzen)

## Vorgehen

Zeilennummern gelten für den Stand vor dem Paket (HEAD `fceda80b`); sie verschieben sich, sobald
ein früherer Schritt dieselbe Datei ändert. Maßgeblich sind die genannten Namen.

Bei den Schritten 1 und 2 ist das ein Korrektheitsfix an Meldungen: erst die unter »Tests«
genannten Assertions schreiben, rot laufen sehen (`pnpm nx test twopoint5d --
src/utils/assertPositiveFinite.spec.ts src/map2d/RectangularVisibilityArea.spec.ts
src/texture/FrameBasedAnimations.spec.ts`), die Ausgabe in den Report, dann den Code ändern.

### 1. `describeValue()` teilen (CONS-048, Symptom `RectangularVisibilityArea`)

1. Neue Datei `packages/twopoint5d/src/utils/describeValue.ts`, als `function`-Deklaration wie
   die Nachbarn in `utils/`:

   ```ts
   /**
    * A value the way an error message quotes it: a string in double quotes, so `"16"` is told
    * apart from the number 16, everything else as `String()` writes it.
    */
   export function describeValue(value: unknown): string {
     return typeof value === 'string' ? `"${value}"` : String(value);
   }
   ```

   Nicht in `utils/public-api.ts` aufnehmen — intern wie `assertPositiveFinite`.
2. `texture/TileSet.ts:51`: die lokale `const describeValue` entfernen, stattdessen
   `import {describeValue} from '../utils/describeValue.js';`. `assertOption` bleibt sonst gleich.
3. `utils/assertPositiveFinite.ts:9`: `got ${String(value)}` → `got ${describeValue(value)}`.
4. `map2d/RectangularVisibilityArea.ts:13` (`assertAreaSize`): `got ${String(value)}` →
   `got ${describeValue(value)}`.
5. Tests:
   - neue `utils/assertPositiveFinite.spec.ts` (`describe('assertPositiveFinite')`):
     - `'a string is quoted in the message'`: `assertPositiveFinite('abc', 'Subject', 'size')`
       wirft `RangeError` mit genau `[Subject] size must be a finite number above 0, got "abc"`
       — vor dem Fix rot.
     - `'a number is written as it is'`: `0` → `… got 0`, `NaN` → `… got NaN`, `-1` → `… got -1`
       (`test.each` oder drei Assertions).
     - `'a finite number above 0 passes'`: `1` und `0.5` werfen nicht.
   - `map2d/RectangularVisibilityArea.spec.ts`, im `describe` mit den `RangeError`-Tests um
     Zeile 175: neuer Test `'a width that is a string is quoted in the message'`:
     `new RectangularVisibilityArea('5' as unknown as number, 240)` wirft
     `[RectangularVisibilityArea] width must be 0 or a finite number above 0, got "5"` — vor dem
     Fix rot. Die übrigen Tests der Datei bleiben unangetastet.

### 2. Timing-Meldungen von `FrameBasedAnimations#add()` (CONS-051 samt gleicher Ursache)

Heute prüft `calculateDurationFromFrameRate()` mit `frameRate <= 0`; ein `NaN` fällt durch, weil
jeder Vergleich mit `NaN` falsch ist, wird zur Dauer `NaN` und erst die Dauerprüfung in `add()`
meldet ihn — als `duration`. Beide Helfer werfen zudem ohne Präfix und ohne Animationsnamen.

1. `const animNameInError` samt ihrem Kommentar (Zeilen 75–77) nach oben verschieben, direkt vor
   `calculateDurationFromFrameRate`.
2. `import {describeValue} from '../utils/describeValue.js';` ergänzen.
3. `calculateDurationFromFrameRate(frameCount: number, frameRate: number, name: AnimName | undefined)`:
   - Bedingung `if (!(frameRate > 0))`, mit Kommentar darüber: `!(frameRate > 0)` rather than
     `frameRate <= 0` — every comparison with `NaN` is false, and only this form refuses a `NaN`
     here, where the error can name the frameRate instead of the duration it would turn into.
   - Meldung:
     `` `FrameBasedAnimations: add() got a frameRate of ${describeValue(frameRate)} for the animation \`${animNameInError(name)}\` — a frameRate is a number above zero` ``
   - TSDoc: `@param name` ergänzen (the name of the animation, for the error), `@throws` auf
     »Error if frameRate is not a number above 0, `NaN` among them«.
4. `resolveDuration(timing, frameCount: number, name: AnimName | undefined)`: reicht `name` an
   `calculateDurationFromFrameRate` weiter; der letzte Wurf wird
   `` `FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation \`${animNameInError(name)}\`` ``.
   TSDoc `@param name` ergänzen.
5. In `add()`: `resolveDuration(timing, frames.length, name)`; in der Dauer-Meldung
   `got a duration of ${duration}` → `got a duration of ${describeValue(duration)}`.
6. TSDoc:
   - `AnimationTimingOptions`, Absatz »Whichever way it is reached …« (Zeilen 29–30): Satz
     anhängen: »A `frameRate` that is not a number above zero — `NaN` among them — is refused by
     `add()` as well.«
   - `add()`, Absatz »An animation carries at least one frame …« (Zeilen 149–152): nach »… are
     each refused with an error naming the case« einfügen: », as are a `frameRate` that is not a
     number above zero and timing that carries neither a `duration` nor a `frameRate`«.
7. Die Semantik bleibt: jede Eingabe, die heute verworfen wird, wird weiter verworfen, jede
   angenommene weiter angenommen (`frameRate: Infinity` ergibt weiter die Dauer 0, ein
   Standbild). Nur die Meldungen ändern sich.
8. Tests in `FrameBasedAnimations.spec.ts`:
   - Zeile 88 (`'a frameRate of NaN'`): `.toThrow(/NaN/)` →
     ``.toThrow(/got a frameRate of NaN for the animation `not-a-number`/)`` — vor dem Fix rot.
   - neuer Test im selben `describe('add with TextureCoords array')`:
     `'a duration that is a string is quoted in the message'`:
     `animations.add('text', {duration: '1' as unknown as number}, frames)` →
     `.toThrow(/got a duration of "1"/)` — vor dem Fix rot. Die Dauer steckt im Objekt, so wie
     sie aus dem Katalog-JSON kommt; ein String direkt als zweites Argument scheitert schon am
     `in`-Operator in `resolveDuration()` und ist nicht Gegenstand dieses Pakets.
   - neuer Test daneben: `'timing without a duration and without a frameRate names the animation'`:
     `animations.add('bare', {} as never, frames)` →
     ``.toThrow(/got neither a duration nor a frameRate for the animation `bare`/)`` — vor dem
     Fix rot.
   - Zeilen 644 und 653 (`'throw error for zero frameRate'`, `'… negative frameRate'`):
     `'frameRate must be greater than 0'` →
     ``/got a frameRate of 0 for the animation `invalid`/`` bzw.
     ``/got a frameRate of -5 for the animation `invalid`/``.

### 3. Meldungen statt nackter Würfe (TEST-030 samt gleicher Ursache)

Jede Stelle bekommt die Meldung, die der Code heute wirft; wo die Fehlerklasse Teil des Vertrags
ist (`TypeError`, `RangeError`), bleibt die Klassen-Assertion stehen und die Meldung kommt als
zweite dazu — dasselbe Muster wie `TileSet.spec.ts:96-97`. Für Setter die Zuweisung in eine
lokale Funktion ziehen (`const write = () => { … };`) und `expect(write)` zweimal aufrufen.

- `FrameBasedAnimations.spec.ts:67` (TEST-030):
  ``.toThrow(/got a frameRate of 0 for the animation `\(no name\)`/)`` — der Name ist
  `undefined`, `animNameInError` schreibt `(no name)`.
- `FrameBasedAnimations.spec.ts:98`: `.toThrow()` → `.toThrow(/no frames/)`.
- `TextureResource.spec.ts:316` und `:349`: `.toThrow()` →
  `.toThrow('FrameBasedAnimations: there is no animation named "walk"')`.
- `TextureResource.spec.ts`, `describe('setters on the wrong shape')`:
  - `:1256` zusätzlich
    `'TextureResource "hero" is an "image" resource and has no "tileSetOptions"'`
  - `:1267` zusätzlich `'TextureResource "tiles" is a "tileset" resource and has no "atlasUrl"'`
  - `:1278` zusätzlich `/takes its "imageUrl" from the atlas json/`
- `TextureStore.spec.ts:452`: `rejects.toThrow()` →
  `rejects.toThrow('get() aborted before subscription')`.
- `TextureStore.spec.ts:891`: `.toThrow()` →
  `.toThrow('[TextureStore] parse() found 1 item(s) of a conflicting type: "b" is a "image" resource and cannot become "tileset"')`.
- `TextureStore.spec.ts:1315`: zusätzlich `/takes its "imageUrl" from the atlas json/`.
- `TileSet.spec.ts:109`, `:113`, `:117`: je eine zweite Assertion
  `/tileWidth must be a finite number above 0, got 0/`,
  `/tileHeight must be a finite number above 0, got 0/`,
  `/tileWidth must be a finite number above 0, got 0/` (ohne Optionen fällt `tileWidth` auf die
  Breite 0 der `baseCoords` zurück).

### 4. Tote try/catch-Gerüste streichen (CONS-042)

In `TextureResource.spec.ts`:

- `writeUnreadable` (Zeilen 922–930) samt Kommentar entfernen; die Aufrufe werden direkte
  Zuweisungen: `:975` → `resource.atlasJson = unreadableJson('other.png');`, `:996` →
  `resource.atlasJson = unreadableJson('atlas.png');`.
- `refuse` (Zeilen 1121–1130) samt Kommentar entfernen; die Aufrufe `:1160`, `:1186`, `:1200`
  werden `resource.tileSetOptions = refusedOptions;`.
- Die Tests, die ausdrücklich `not.toThrow()` prüfen (`:960`, `:1144`), bleiben, wie sie sind.

### 5. describe-Namen ohne Abschnittsverweise (TEST-017)

In `TextureStore.spec.ts`:

| Zeile | alt | neu |
| --- | --- | --- |
| 319 | `'defaultTextureClasses as signal (§4.6)'` | `'defaultTextureClasses, held as a signal and handed to the resources by parse()'` |
| 351 | `'parse() batching (§6.4)'` | `'parse() emits ready once, after every resource of the data is in place'` |
| 376 | `'central TextureFactory (§3.3, §6.1)'` | `'one TextureFactory for every resource of the store'` |
| 459 | `'event constants (§4.3, §4.7)'` | `'the event and subtype constants match what is emitted'` |

### 6. TextureResource-Tests aus der Store-Spec umziehen (TEST-018)

Acht Tests in `TextureStore.spec.ts` prüfen nur `TextureResource`. Sie ziehen in
`describe('TextureResource')` von `TextureResource.spec.ts` und verschwinden aus der Store-Spec:

| heute in `TextureStore.spec.ts` | Ziel in `TextureResource.spec.ts` |
| --- | --- |
| `describe('parse() update path')` → `'TextureResource.fromAtlas accepts initial frameBasedAnimations data'` (`:1009`) | bestehendes `describe('frame based animations')`, Testname `'fromAtlas accepts initial frameBasedAnimations data'` |
| dort → `'TextureResource.fromImage accepts (but ignores) frameBasedAnimationsData setter without a signal'` (`:1016`) | ebenda, Testname `'fromImage accepts (but ignores) frameBasedAnimationsData setter without a signal'` |
| `describe('TextureResource.load() initial firing (lookbook regression)')` (`:1023`, ein Test) | bestehendes `describe('load()')`, Testname unverändert |
| `describe('TextureResource.load() image race')` (`:1055`, zwei Tests) | neues `describe('an imageUrl that changes while its image loads')`, Testnamen unverändert |
| `describe('TextureResource.fromX input safety')` (`:1626`, drei Tests) | neues `describe('the static factories leave the textureClasses they are given alone')`, Testnamen unverändert |

- Die umgezogenen Tests benutzen die Helfer der Zieldatei: `makeTextureFactory()` statt ihrer
  eigenen Inline-Factory (`const {factory, textures} = makeTextureFactory();`, `textures` statt
  `stubTextures`/`createdTextures`), `asStub(resource.texture)?.tag` statt der Casts,
  `flushMicrotasks` der Zieldatei. Was sie prüfen, bleibt gleich.
- In `TextureStore.spec.ts` danach unbenutzte Imports entfernen (`pnpm lint` meldet sie).

### 7. Spec-Lücken schließen (TEST-016, Anteil dieses Pakets)

Stubs und Mocks nach dem Muster der Nachbartests derselben Datei; `vi.spyOn(…)` wird am Testende
mit `mockRestore()` zurückgesetzt oder über den `afterEach` der Datei.

1. **Neu `texture/isAtlasJsonResponse.spec.ts`** (`describe('isAtlasJsonResponse')`):
   - `true` für `{frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}}, meta: {image: 'a.png', size: {w: 16, h: 16}}}`
     und für dieselbe Form ohne `meta.image`.
   - `false` (`test.each`) für: `null`, `'atlas'`, `{meta: …}` ohne `frames`, `frames: null`,
     ein Frame-Eintrag `5`, ein Frame-Eintrag `{}` ohne `frame`, ein `frame` mit `x: '0'`, ein
     `frame` ohne `h`, fehlendes `meta`, `meta: {}` ohne `size`, `size: {w: 16}` ohne `h`,
     `size: {w: '16', h: 16}`.
   - Kein Test mit `frames` als Array: das Format »JSON Array« legt Paket 4 fest.
2. **Neu `texture/TexturePackerJson.spec.ts`** (`describe('TexturePackerJson.parse()')`), Daten
   `{frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}}, b: {frame: {x: 8, y: 0, w: 8, h: 16}}}, meta: {image: 'a.png', size: {w: 16, h: 16}}}`:
   - `'every frame is registered under its name'`: `atlas.frameNames()` ist `['a', 'b']`.
   - `'without parentCoords the frames lie inside the size the meta names'`: `frame('b').coords`
     hat `x 8, y 0, width 8, height 16`, `parent` mit `width 16, height 16`; `s 0.5, t 0, u 0.5,
     v 1`.
   - `'with parentCoords the frames lie inside those coordinates'`: `parentCoords = new
     TextureCoords(0, 0, 32, 32)` → `frame('b').coords.parent` ist genau dieses Objekt, `s` ist
     `0.25`, `u` ist `0.25`, `v` ist `0.5`.
   - `'a target atlas is filled and returned'`: ein `TextureAtlas` mit einem vorher
     eingetragenen Frame `'x'` als `target` → `parse()` gibt genau dieses Atlas-Objekt zurück,
     `frameNames()` ist `['x', 'a', 'b']`.
   - `'the meta comes back as it was given'`: das zweite Tupel-Element ist `data.meta`
     (`toBe`).
3. **`PowerOf2ImageLoader.spec.ts`**, drei neue Tests:
   - `'an image that is no power of 2 is drawn into a canvas of the next powers of 2'`:
     `vi.stubGlobal('document', {createElement: () => canvas})` mit
     `canvas = {width: 0, height: 0, getContext: () => ({drawImage})}`, `drawImage = vi.fn()`;
     Bild `{width: 3, height: 5}` über `captureLoadEvent` → `imgEl` ist `canvas`, `canvas.width`
     `4`, `canvas.height` `8`, `drawImage` mit `(image, 0, 0)` aufgerufen, `texCoords` hat
     `width 3, height 5`, `texCoords.parent` hat `width 4, height 8`, `u` ist `0.75`, `v` ist
     `0.625`.
   - `'an image that fails to load rejects the promise with its error'`:
     `vi.spyOn(ImageLoader.prototype, 'load')` ruft das vierte Argument (`onError`) mit
     `failure = new Error('404')` → `loadAsync('missing.png')` rejectet mit `toBe(failure)`.
   - `'a throw of the load callback is no failure of the load'`: POT-Bild `{width: 4, height: 4}`
     über `captureLoadEvent`; `new PowerOf2ImageLoader().load('even.png', onLoad, onError)` mit
     `onLoad` wirft `callbackError`, `onError = vi.fn()` → `deliver()` wirft `callbackError`,
     `onError` wurde nicht aufgerufen.
4. **`TextureImageLoader.spec.ts`**, zwei neue Tests:
   - `'a loaded image comes back as a texture of that image, built with the texture classes'`:
     Image-Loader-Stub liefert `{imgEl, texCoords}` (feste Objekte), `textureFactory.update`
     zeichnet `(texture, ...classes)` auf; `loadAsync('image.png', ['nearest'])` → `texture`
     ist eine `Texture` mit `texture.image` gleich `imgEl`, `imgEl` und `texCoords` sind die
     gelieferten Objekte, `update` bekam genau diese `texture` und `['nearest']`.
   - `'an image that fails to load rejects the promise with its error and builds no texture'`:
     Stub `load(_url, _onLoad, onError) { onError(failure); }` → `rejects.toBe(failure)`,
     `textureFactory.update` nicht aufgerufen.
5. **`TileSetLoader.spec.ts`**, zwei neue Tests:
   - `'a loaded image comes back as a tile set over its coordinates and a texture named by the url'`:
     `texCoords = new TextureCoords(0, 0, 64, 64)`, Optionen `{tileWidth: 16, tileHeight: 16}`,
     Klassen `['nearest']` → `tileSet.tileCount` ist `16`, `tileSet.baseCoords` ist `texCoords`
     (`toBe`), `texture.name` ist `'tiles.png'`, `update` bekam `['nearest']`, `imgEl` und
     `texCoords` sind die gelieferten Objekte.
   - `'an image that fails to load rejects the promise with its error and builds no texture'`:
     wie bei `TextureImageLoader`.
6. **`TextureAtlasLoader.spec.ts`**, vier neue Tests:
   - `'a file loader that fails rejects the promise with its error and loads no image'`:
     Datei-Loader-Stub `load(_url, _onLoad, _onProgress, onError) { onError(failure); }` →
     `rejects.toBe(failure)`, `imageLoad` nicht aufgerufen.
   - `'an image that fails to load rejects the promise with its error'`: Image-Loader-Stub
     `vi.fn((_url, _classes, _onLoad, onError) => onError(failure))` → `rejects.toBe(failure)`.
   - `'the texture classes reach the image loader'`:
     `loadAsync('atlas.json', ['nearest'], {overrideImageUrl: 'sprites.png'})` →
     `imageLoad.mock.calls[0]![1]` ist `['nearest']`.
   - `'an atlas json that names an image loads that image and lays its frames inside it'`: JSON
     `{frames: {'walk.1': {frame: {x: 8, y: 0, w: 8, h: 8}}}, meta: {image: 'http://example.test/sprites.png', size: {w: 16, h: 16}}}`
     ohne Override; der Image-Loader-Stub liefert ein festes `texCoords = new TextureCoords(0,
     0, 16, 16)` → `imageLoad` bekam `'http://example.test/sprites.png'`,
     `atlas.frame('walk.1')!.coords.parent` ist `texCoords` (`toBe`), `s 0.5, t 0, u 0.5, v 0.5`.
     Die absolute URL ist Absicht: Paket 3 löst relative Bild-URLs gegen die URL der JSON-Datei
     auf, absolute bleiben, wie sie sind.
7. **`TextureResource.spec.ts`, `describe('atlas fetch')`**, zwei neue Tests. Der `fetch`-Mock
   hält pro Aufruf das `init.signal` fest und gibt ein Promise zurück, das der Test selbst
   auflöst oder das bei `abort` des Signals mit `new DOMException('aborted', 'AbortError')`
   rejectet — so verhält sich `fetch`.
   - `'dispose() while the atlas fetch is in flight aborts the fetch and loads no image'`:
     `vi.spyOn(ImageLoader.prototype, 'loadAsync')`; `TextureResource.fromAtlas('sprites',
     'atlas.json')`, `load()`, `textureFactory = makeTextureFactory().factory` → das Signal des
     ersten Aufrufs ist nicht abgebrochen; `dispose()` → es ist abgebrochen; zweimal
     `await flushMicrotasks()` → `loadAsync` nicht aufgerufen, kein unbehandeltes Rejection
     (Vitest schlägt sonst selbst an).
   - `'an atlasUrl that changes while its fetch is in flight aborts that fetch, and the json of the new url builds the atlas'`:
     erster Aufruf wie oben, zweiter löst sofort mit einer `Response` der JSON
     `{frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}}, meta: {image: 'second.png', size: {w: 16, h: 16}}}`
     auf; `loadAsync` liefert `{width: 16, height: 16, tag: url}`; Fehler über
     `on(resource, 'error', …)` sammeln. `fromAtlas('sprites', 'first.json')`, `load()`,
     `textureFactory` setzen, `resource.atlasUrl = 'second.json'` → Signal 1 abgebrochen, Signal
     2 nicht; nach zwei bis drei `await flushMicrotasks()` (so viele wie nötig, die Nachbartests
     brauchen zwei): `errors` leer, `resource.imageUrl` ist `'second.png'`,
     `resource.atlas!.frameNames()` ist `['idle.1']`. Am Ende `dispose()`.

### 8. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, unter `[Unreleased]` → `### Changed` drei bestehende,
unveröffentlichte Einträge ergänzen (Skill `updating-changelog`), keinen neuen anlegen:

- Eintrag »change a `tileWidth` or `tileHeight` that is not a finite number above 0 into a
  `RangeError` …« (Zeile 67), Satz anhängen: »A value that is a string is quoted in the
  message — `got "16"` — as `TileSet` quotes it«
- Eintrag »change a `width` or `height` of `RectangularVisibilityArea` …« (Zeile 68), Satz
  anhängen: »A value that is a string is quoted in the message«
- Eintrag »`FrameBasedAnimations#add()` refuses an animation that carries no frames …«
  (Zeile 190), Satz anhängen: »A `frameRate` that is not a number above 0, `NaN` among them, is
  refused with an error that names the `frameRate`, timing that carries neither a `duration` nor
  a `frameRate` with one that says so, and a `duration` or `frameRate` that is a string is quoted
  in the message«

Kein Schlusspunkt an den Einträgen (Stil der Datei).

## Nicht in diesem Paket

- Drei Testpunkte aus TEST-016 würden Verhalten festnageln, das ein späteres Paket gerade ändert.
  Sie sind dort der rote Regressionstest und stehen im Plan unter dem jeweiligen Paket:
  - `store.get()` auf einer Resource, deren Bild-Load rejected — heute hängt das Promise; der
    Test ist der von ASYNC-001 → Paket 2.
  - `parse()` mit fehlendem `items` oder unbekanntem Klassennamen — heute ein nichtssagender
    `TypeError` bzw. ein stilles Wegfallen; der Test ist der von SEC-001 → Paket 3.
  - `new TextureResource(id, 'atlas')` — heute wirft der Setter; der Test ist der von API-047 →
    Paket 5.
- `frames` als Array in `isAtlasJsonResponse` / `TexturePackerJson` — legt Paket 4 fest.
- Die nur auf die Klasse prüfenden `toThrow(RangeError)` der map2d-Specs und die `§`-Verweise
  in der stage-Domain — stehen als Nebenbefunde in »Offene Befunde« des Plans.

## Verify

`pnpm run ci` (im Repo-Root). Zwischendurch reicht
`pnpm nx test twopoint5d -- src/texture src/utils src/map2d/RectangularVisibilityArea.spec.ts`.

## Commit

```
fix(texture,utils,map2d): name the frameRate that FrameBasedAnimations#add() refuses, NaN among them, together with the animation, quote a string value in the RangeErrors of assertPositiveFinite and RectangularVisibilityArea as TileSet does, move the resource tests of the store spec to TextureResource.spec.ts, say in every describe name what it checks, hold every throw in the texture specs to its message, and cover the loaders, the atlas json guard, TexturePackerJson and an atlas fetch that a dispose() or a new atlasUrl cuts short
```

## Abgleich (Zug 0, 2026-09-26, gegen HEAD `fceda80b`)

- **TEST-016** — umgeformt. Alle vier Loader haben inzwischen eine Spec
  (`PowerOf2ImageLoader.spec.ts`, `TextureImageLoader.spec.ts`, `TileSetLoader.spec.ts` seit
  `d90a3081`, `TextureAtlasLoader.spec.ts`), aber nur für ihre Fehlerpfade beim Bauen der
  Textur: Erfolgspfad, Weitergabe des Ladefehlers und (Atlas) Klassen und Frame-Koordinaten
  fehlen. `isAtlasJsonResponse.ts` und `TexturePackerJson.ts` haben weiter keine eigene Spec.
  Von den Einzelpunkten sind gedeckt: `TileSet` mit degenerierten Optionen
  (`TileSet.spec.ts:80-136`), ein werfender `texture`-Subscriber (`TextureResource.spec.ts:120`),
  Nicht-Objekt-Animationseinträge (`:355`, `:387`), `overrideImageUrl` zurück auf `undefined`
  (`:785-856`). Offen und hier: `dispose()` bzw. neues `atlasUrl` während des Atlas-`fetch`
  (`TextureResource.ts:700-748`, der `AbortController` wird nirgends geübt). Offen und
  verschoben (siehe oben): `store.get()` bei rejectetem Bild, `parse()` ohne `items` /
  unbekannte Klasse, `new TextureResource(id, 'atlas')`.
- **TEST-017** — unverändert: `TextureStore.spec.ts:319`, `:351`, `:376`, `:459`.
- **TEST-018** — unverändert: acht reine `TextureResource`-Tests in `TextureStore.spec.ts`
  (`:1009`, `:1016`, `:1023`, `:1055` mit zwei Tests, `:1626` mit drei Tests); die Datei hat
  1645 Zeilen.
- **CONS-042** — unverändert: `writeUnreadable` in `TextureResource.spec.ts:922-930`, `refuse`
  in `:1121-1130`.
- **TEST-030** — unverändert: `FrameBasedAnimations.spec.ts:67`.
- **CONS-051** — unverändert: `FrameBasedAnimations.ts:240-244`; die Ursache sitzt in
  `calculateDurationFromFrameRate()` (`:48-53`), deren `frameRate <= 0` ein `NaN` durchlässt.
- **CONS-048** — unverändert: `utils/assertPositiveFinite.ts:9`; `describeValue` ist eine
  modulinterne `const` in `texture/TileSet.ts:51`.

## Entscheidungen in Zug 0

- **CONS-051 anders als empfohlen.** Die Empfehlung hängt an die Dauer-Meldung »(from a
  frameRate of …)«. Der `NaN` erreicht die Dauerprüfung aber nur, weil die frameRate-Prüfung
  mit `frameRate <= 0` ihn durchlässt. Mit `!(frameRate > 0)` wird er dort verworfen, wo die
  Meldung die `frameRate` selbst nennt; aus einer `frameRate` kann danach keine ungültige Dauer
  mehr entstehen, der Zusatz wäre toter Code. Verworfen und angenommen wird dasselbe wie heute.
- **Die beiden Timing-Helfer bekommen Präfix und Animationsnamen.** Gleiche Ursache wie CONS-051:
  die Zeitangabe wird außerhalb von `add()` ohne dessen Kontext geprüft. Hätte nur die
  frameRate-Meldung das Format der übrigen `add()`-Meldungen, stünden in einem Helfer zwei
  Formate; TEST-030 soll außerdem auf eine Meldung prüfen, die sagt, welche Animation gemeint
  ist. `getTimingOptions()` in `TextureResource.ts` bleibt, wie sie ist — die Resource meldet
  den Namen im Payload ihres `error`-Events, und die Datei gehört Paket 5.
- **`describeValue()` zieht nach `utils/`**, weil CONS-048 sie außerhalb von `TileSet` braucht.
  Mitgenommen werden die `duration`/`frameRate`-Meldungen (dieselbe Lücke: ein String `"1"` hieß
  »got a duration of 1«) und `RectangularVisibilityArea`: nach diesem Paket quoten
  `Map2DTileStreamer`, `Map2DTileCoordsUtil` und `Map2DSpatialHashGrid` über
  `assertPositiveFinite` einen String, `RectangularVisibilityArea` nicht mehr — ein Symptom
  dieses Pakets, obwohl map2d sonst außerhalb des Scopes liegt.
- **Die übrigen nackten und klassen-only Würfe der texture-Specs kommen mit.** Das Ziel des
  Pakets nennt »Meldungen statt nackter Würfe«; die Stellen haben dieselbe Ursache wie TEST-030.
  Ein `toThrow(TypeError)` besteht auch, wenn ein `undefined`-Zugriff den Wurf auslöst — genau
  das, was TEST-030 beschreibt. Die map2d-Specs mit demselben Muster bleiben draußen (Scope).
- **Drei TEST-016-Punkte gehen an die Pakete 2, 3 und 5.** Ein Test gegen das heutige Verhalten
  würde hängen (ASYNC-001), einen zufälligen `TypeError` festschreiben (SEC-001) oder einen Wurf
  festhalten, den das nächste Paket entfernt (API-047). In den Paketen ist er ohnehin der rote
  Regressionstest. TEST-016 ist erst geschlossen, wenn alle drei dort stehen.
- **Modell mittlere Stufe, Effort medium.** Überwiegend Specs nach genauen Vorgaben, dazu ein
  lokaler Meldungsfix mit Regressionstests; die Mocks für den abgebrochenen `fetch` verlangen
  etwas Eigenleistung, keine Architektur.

## Verlauf

- 2026-09-26 Zug 0: Detailplan steht · TEST-016 umgeformt (Loader-Specs existieren, Lücken
  in Erfolgs- und Ladefehlerpfad; 4 von 10 Einzelpunkten gedeckt, 3 hier, 3 an Paket 2/3/5) ·
  TEST-017, TEST-018, CONS-042, TEST-030, CONS-051, CONS-048 unverändert · im Paket:
  nackte/klassen-only Würfe der texture-Specs, Timing-Meldungen, `RectangularVisibilityArea`
  · Nebenbefunde → Plan »Offene Befunde«: `§`-Verweise in stage, klassen-only `RangeError` in
  map2d-Specs · keine Folgen aus Vorpaketen (erstes Paket)
- 2026-09-26 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-1.impl-0.json`
- 2026-09-26 Zug 2: Report FERTIG · 4 neue, 14 geänderte Dateien (Liste im Diff) · roter Lauf 8 failed vor dem Fix · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-1.verify.log`)
- 2026-09-26 Zug 3: Reviewer (sonnet, effort medium) · alle sieben Findings und drei aufgenommenen Nebenbefunde erfüllt, 2 klein, 0 wichtig, 0 kritisch · Diff `paket-1.diff`, Report `paket-1.review-0.json`
- 2026-09-26 Zug 4: keine Runde nötig
- 2026-09-26 Zug 5: Commit `dff733ff` (18 Dateien) · Verify aus Zug 2 trägt ihn, keine Änderung dazwischen

## Findings im Volltext

**TEST-016 · low · packages/twopoint5d/src/texture/TexturePackerJson.ts:1** — Die Spec-Lücken um die Loader und die Fehlerpfade des texture-Moduls schließen

Der Vorlauf zählte sechs ungetestete Dateien; `TextureFactory.spec.ts` und `TextureAtlasLoader.spec.ts` existieren inzwischen, vier Loader-Dateien (55–63 Zeilen) haben weiter keine Spec, `isAtlasJsonResponse.ts` nur indirekt. Ohne Test sind zudem: `TileSet` mit degenerierten Optionen (BUG-067); `store.get()` auf einer Resource, deren Bild-Load rejected (ASYNC-001 — die Spec in TextureStore.spec.ts:1058-1155 deckt das Rennen, nicht den Fehlschlag); ein werfender `texture`-Subscriber (MEM-001); Nicht-Objekt-Animationseinträge (BUG-068); `new TextureResource(id, 'atlas')` (API-047); `parse()` mit fehlendem `items` oder unbekanntem Klassennamen; `overrideImageUrl` zurück auf `undefined` (BUG-069); `dispose()` während der Atlas-`fetch` in Flight ist (der `AbortController` in TextureResource.ts:629-684 wird nie geübt).

Empfehlung: Eine Spec-Datei pro Loader mit den `ImageLoader.prototype.loadAsync`/`fetch`-Mocks, die die bestehenden Suiten schon nutzen, plus ein Test pro Punkt oben in den Resource-/Store-Suiten.

**TEST-017 · low · packages/twopoint5d/src/texture/TextureStore.spec.ts:319** — Vier describe-Namen verweisen auf Abschnitte eines Dokuments, das es nicht gibt

Vier `describe`-Namen tragen Abschnittsverweise (`§4.6`, `§6.4`, `§3.3, §6.1`, `§4.3, §4.7`) auf ein Dokument, das im Repo nicht existiert. Re-Check: unverändert (Zeilen verschoben).

Empfehlung: Die Verweise durch den Satz ersetzen, den sie meinen.

**TEST-018 · low · packages/twopoint5d/src/texture/TextureStore.spec.ts:1026** — Rund zehn TextureResource-Tests liegen in TextureStore.spec.ts

Tests im `describe('TextureStore')` prüfen ausschließlich `TextureResource`: `TextureResource.load() initial firing`, `TextureResource.load() image race`, `TextureResource.fromX input safety`. Neben der Datei liegt `TextureResource.spec.ts`, in die sie gehören. Die Datei ist mit 1504 Zeilen die größte Spec des Repos. Re-Check: unverändert.

Empfehlung: Die Blöcke nach `TextureResource.spec.ts` verschieben.

**CONS-042 · info · packages/twopoint5d/src/texture/TextureResource.spec.ts:922** — Die toten try/catch-Gerüste in den TextureResource-Specs streichen

Die Helfer `writeUnreadable` und `refuse` fangen einen Throw, den der Setter nicht mehr wirft; ihre Kommentare beschreiben den Übergang von der roten zur grünen Phase (»either way«) statt des heutigen Verhaltens. Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: Direkte Zuweisung, Kommentare streichen.

**TEST-030 · info · packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts:67** — Ein nacktes toThrow() prüft nicht, woher der Wurf kommt

Die Zeile belegt nur, dass `add()` wirft — nicht, dass die `frameRate` der Grund ist. Das benachbarte `animId('anim_0')` fängt einen Teil davon ab.

Empfehlung: Auf die Meldung prüfen, nicht nur auf den Wurf.

**CONS-051 · info · packages/twopoint5d/src/texture/FrameBasedAnimations.ts:242** — Die Fehlermeldung nennt die duration, wo die frameRate schuld ist

Bei `{frameRate: NaN}` meldet `add()` »got a duration of NaN«. Für einen Aufrufer, der eine `frameRate` gesetzt hat, zeigt die Meldung auf den falschen Knopf.

Empfehlung: Einen Zusatz »(from a frameRate of …)« anhängen, wenn die Dauer aus einer `frameRate` gerechnet wurde.

**CONS-048 · info · packages/twopoint5d/src/utils/assertPositiveFinite.ts:9** — Die Fehlermeldung folgt dem Format von TileSet, aber nicht dessen describeValue()

Ein String steht bei `TileSet` in Anführungszeichen, hier nackt (`got abc` statt `got "abc"`). Da `value` als `unknown` typisiert ist, ist der Fall erreichbar.

Empfehlung: `describeValue()` auch hier verwenden.

## Review (Zug 3)

Urteil des Reviewers je Finding-ID:

- **TEST-016** (anteilig) — behoben: `texture/isAtlasJsonResponse.spec.ts`, `texture/TexturePackerJson.spec.ts`,
  drei neue Tests in `PowerOf2ImageLoader.spec.ts`, je zwei in `TextureImageLoader.spec.ts` und
  `TileSetLoader.spec.ts`, vier in `TextureAtlasLoader.spec.ts`, Atlas-`fetch` unter `dispose()` bzw. neuem
  `atlasUrl` in `TextureResource.spec.ts:817` und `:838`. Geschlossen erst mit den Regressionstests aus Paket 2, 3, 5.
- **TEST-017** — behoben: `TextureStore.spec.ts:319`, `:351`, `:376`, `:459`, Namen wie in der Tabelle.
- **TEST-018** — behoben: acht Tests nach `TextureResource.spec.ts` umgezogen (`frame based animations`, `load()`,
  `an imageUrl that changes while its image loads`, `the static factories leave the textureClasses they are given alone`),
  in der Store-Spec gelöscht, Assertions gleich.
- **CONS-042** — behoben: `writeUnreadable` und `refuse` samt Kommentaren entfernt, direkte Zuweisungen
  (`TextureResource.spec.ts:1047-1050`, `:1223-1250`).
- **TEST-030** — behoben: `FrameBasedAnimations.spec.ts:67` prüft die Meldung; dazu die übrigen nackten bzw.
  klassen-only Würfe in `TextureResource.spec.ts`, `TextureStore.spec.ts` (`:452`, `:891`, `:1315`), `TileSet.spec.ts`.
- **CONS-051** — behoben: `FrameBasedAnimations.ts` `calculateDurationFromFrameRate()` mit `!(frameRate > 0)` und
  Meldung mit frameRate und Animationsnamen; Semantik unverändert.
- **CONS-048** — behoben: `utils/describeValue.ts`, genutzt in `assertPositiveFinite.ts`, `TileSet.ts`,
  `RectangularVisibilityArea.ts`; Regressionstests `assertPositiveFinite.spec.ts:5`, `RectangularVisibilityArea.spec.ts:~181`.

Kleine Befunde:

- `FrameBasedAnimations.spec.ts:99` — der CHANGELOG nennt das Quoten auch für eine `frameRate` als String, getestet ist
  nur `duration: '1'`.
- `TextureResource.ts:27` — `getTimingOptions()` wirft ohne Präfix und Animationsnamen; laut Zug 0 Paket 5 zugeschlagen,
  als `Folgen:` im Plan eingetragen.

Abweichungen des Implementierers (aus dem Report): `'an add refused for its frames spends no name of the counter'`
bekam zusätzlich `.toThrow(/no frames/)` (übriger nackter Wurf, Ziel des Pakets); `TextureStore.spec.ts:1315` in eine
lokale `write`-Funktion gezogen; neue Spies ohne `mockRestore()`, weil `restoreMocks: true` in `vite.config.ts` gilt.
