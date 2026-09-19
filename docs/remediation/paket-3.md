# Paket 3 — texture: Katalog- und Loader-Eingaben absichern

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-067 (high), BUG-068 (medium), BUG-069 (low), BUG-066 (low)
- Mitgenommen (vorbestehend, gleiche Ursache wie BUG-067 — ungeprüfte `TileSetOptions` vor der Layout-Schleife): `tileCount` von 0, negativ, `NaN` oder gebrochen ergibt heute still ein leeres bzw. schiefes TileSet (`frameId()` rechnet dann `% 0` → `NaN`, `frame()` liefert trotz `!` `undefined`); eine `baseCoords`-Breite/-Höhe, die nicht endlich ist (`NaN`, `Infinity`), lässt die Schleife ebenfalls nie enden (`TileSet.ts:143`, `154-180`)
- Ziel: Fehlerhafte Katalogdaten und Throws in Loader-Callbacks enden als benannter Fehler bzw. Rejection statt als Endlosschleife, Absturz oder verlorenem Zustand.
- Modell: mittlere Stufe (sonnet)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/TileSet.ts`, `TileSet.spec.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts`, `TextureResource.spec.ts`
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts` (nur ein neuer Test)
  - `packages/twopoint5d/src/texture/PowerOf2ImageLoader.ts` + neu `PowerOf2ImageLoader.spec.ts`
  - `packages/twopoint5d/src/texture/TextureImageLoader.ts` + neu `TextureImageLoader.spec.ts`
  - `packages/twopoint5d/src/texture/TileSetLoader.ts` + neu `TileSetLoader.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci` (unterwegs schneller: `pnpm nx test twopoint5d -- src/texture`)
- Commit: `fix(texture): refuse tile set options the layout cannot use, skip animation entries that are no object, give an atlas its json image back once the override is cleared and reject the loader promise when the load event throws`

## Vorgehen

Reihenfolge einhalten: Schritt 1 vor Schritt 5 — der `TileSetLoader`-Test in
Schritt 5 baut auf der Validierung aus Schritt 1 auf.

Alle Specs laufen unter Vitest in **Node** (kein `environment` in
`packages/twopoint5d/vite.config.ts`, also kein `document`). `restoreMocks: true`
nimmt `vi.spyOn` zurück, **nicht** `vi.stubGlobal` — wer `vi.stubGlobal` nutzt,
ruft `vi.unstubAllGlobals()` in einem `afterEach`.

### 1. `TileSet` weist Werte ab, mit denen die Layout-Schleife nie endet (BUG-067 + Mitgenommenes)

`TileSet.ts`, am Anfang von `#createTextureCoords()` (heute Zeile 142-145),
**vor** der Schleife. Geprüft werden die *aufgelösten* Werte, also die Getter
(`this.tileWidth`, `this.tileHeight`, `this.margin`, `this.padding`,
`this.spacing`, `this.tileCountLimit`) und `this.baseCoords.width`/`.height` —
so fällt auch der Default aus `baseCoords` darunter (ein 0×0-`baseCoords` ohne
Optionen ergibt `tileWidth` 0 und hängt heute ebenso).

| Wert | gültig, wenn | Regeltext in der Meldung |
| --- | --- | --- |
| `baseCoords.width`, `baseCoords.height` | `Number.isFinite(v)` | `a finite number` |
| `tileWidth`, `tileHeight` | `Number.isFinite(v) && v > 0` | `a finite number above 0` |
| `margin`, `padding`, `spacing` | `Number.isFinite(v) && v >= 0` | `a finite number of 0 or more` |
| `tileCount` (Getter `tileCountLimit`) | `v === Infinity \|\| (Number.isInteger(v) && v >= 1)` | `a whole number of 1 or more` |

- Wurf: `new RangeError(`[TileSet] ${name} must be ${rule}, got ${shown}`)`,
  `name` wie in der Tabelle (`tileWidth`, `baseCoords.width`, `tileCount` …).
  `shown` gibt einen String in Anführungszeichen aus (`"16"`), alles andere per
  `String(value)` (`0`, `-1`, `NaN`) — sonst liest sich `got 16` für den String
  `"16"` wie ein gültiger Wert. Beispiel: `[TileSet] tileWidth must be a finite
  number above 0, got 0`. Ein kleiner modul-lokaler Helfer für Prüfen + Werfen
  ist erwünscht; Name nach Wahl.
- `Number.isFinite`, nicht das globale `isFinite`: ein String aus dem JSON
  (`"tileWidth": "16"`) wird abgewiesen statt zu `"160"` verkettet zu werden.
- Inline-Kommentar (Englisch), der das *Warum* sagt: die Schleife endet nur,
  wenn jeder Schritt vorwärts geht und die Bildgrenzen endlich sind; die Werte
  kommen ungeprüft aus Katalog-JSON (`TextureStore.parse()` →
  `TextureResource.fromTileSet()` → `new TileSet()` in einem Effekt).
- TSDoc an den Feldern von `TileSetOptions`: `tileWidth`/`tileHeight` endlich,
  über 0, Default Breite/Höhe der `baseCoords`; `margin`/`padding`/`spacing`
  endlich, 0 oder mehr, Default 0; `tileCount` ganze Zahl ab 1, Default: so
  viele Kacheln, wie hineinpassen. Am Konstruktor `@throws {RangeError}` mit
  denselben Bedingungen in einem Satz.
- **Keine** Prüfung, ob eine Kachel ins Bild passt. Grund:
  `apps/lookbook/src/pages/demos/textured-sprites.astro:60-66` lädt
  `skinball-256.png` (256×256) mit `tileWidth: 256, margin: 1` — mit Rand auf
  beiden Seiten passt die Kachel nicht, die Schleife legt die erste Kachel aber
  unbedingt und die Demo funktioniert. Die Empfehlung des Audits verlangt diese
  Prüfung auch nicht; sie will nur einen Spec, der zeigt, dass der Fall endet.
- Nicht abgedeckt, bewusst: positive Maße so klein, dass `x + step` in Float
  nicht mehr wächst (Größenordnung 1e-16 relativ zu `margin`). Kein realistischer
  Katalogwert; eine Untergrenze wie `>= 1` würde Aufrufer brechen, die mit
  normierten `baseCoords` arbeiten.
- `firstId` wird nicht geprüft — die Layout-Schleife liest ihn nicht; die
  Typprüfung des Katalogs insgesamt ist ein anderes Audit-Finding außerhalb
  dieses Laufs.

Specs in `TileSet.spec.ts`, neuer `describe('degenerate options', …)`:

- **Rot vor dem Fix, sauber** (diese Fälle enden auch ohne Fix, weil `tileCount`
  die Schleife begrenzt bzw. die Schritte vorwärts gehen — erst sie laufen,
  rot sehen, dann fixen). Je `expect(() => new TileSet(base, opts)).toThrow(RangeError)`
  plus Meldung auf den Optionsnamen, `base = new TextureCoords(0, 0, 64, 64)`:
  - `{tileWidth: 0, tileHeight: 16, tileCount: 8}` → `/tileWidth/`
  - `{tileWidth: -16, tileHeight: 16, tileCount: 8}` → `/tileWidth/`
  - `{tileWidth: 16, tileHeight: 0, tileCount: 8}` → `/tileHeight/`
  - `{tileWidth: NaN, tileHeight: 16, tileCount: 8}` → `/tileWidth/`
  - `{tileWidth: '16' as unknown as number, tileHeight: 16, tileCount: 8}` → `/tileWidth.*"16"/`
  - `{tileWidth: 16, tileHeight: 16, margin: -1}` → `/margin/`
  - `{tileWidth: 16, tileHeight: 16, padding: -1}` → `/padding/`
  - `{tileWidth: 16, tileHeight: 16, spacing: -1}` → `/spacing/`
  - `{tileWidth: 16, tileHeight: 16, tileCount: 0}` → `/tileCount/`
  - `{tileWidth: 16, tileHeight: 16, tileCount: 2.5}` → `/tileCount/`
  - `new TextureCoords(0, 0, NaN, 64)` mit `{tileWidth: 16, tileHeight: 16, tileCount: 4}` → `/baseCoords\.width/`
- **Hängen vor dem Fix** — erst nach dem Fix hinzufügen und laufen lassen,
  niemals ohne Fix (eine synchrone Endlosschleife hält den Vitest-Worker fest,
  kein Test-Timeout greift):
  - `{tileWidth: 0, tileHeight: 16}` (ohne `tileCount`, die Form aus dem Katalog) → `toThrow(RangeError)`
  - `{tileWidth: 16, tileHeight: 0}` → `toThrow(RangeError)`
  - `new TileSet(new TextureCoords(0, 0, 0, 0))` ohne Optionen → `toThrow(RangeError)`
- **Wächter, grün vor und nach dem Fix:**
  - Kachel breiter als das Bild: `new TileSet(new TextureCoords(0, 0, 64, 64), {tileWidth: 100, tileHeight: 16})`
    wirft nicht, `tileCount` 4, `frame(1).coords` `{x: 0, y: 0, width: 100, height: 16}`, `frame(4).coords.y` 48.
  - Die Form der Lookbook-Demo: `new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 256, tileHeight: 256, margin: 1})`
    wirft nicht, `tileCount` 1, `frame(1).coords` `{x: 1, y: 1}`.

### 2. Ein abgewiesenes TileSet erreicht den Aufrufer einer Resource als Error-Event (BUG-067, Ende zu Ende)

Kein Code in `TextureResource.ts` für diesen Schritt: der TileSet-Effekt
(`TextureResource.ts:571-581`) läuft im `batch()` des Bild-Effekts, signalize
wirft den Fehler nach der Auslieferung aus dem `batch()` heraus, und der
`.catch` in Zeile 543-552 meldet ihn als `{source: 'texture', id, error}` —
so steht es auch im TSDoc von `TextureResourceEvents`.

Spec in `TextureResource.spec.ts`, im `describe('error sources')`, nach dem
Muster von `'a failure behind a loaded image is not reported as an image failure'`:
`TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 0, tileHeight: 16, tileCount: 4})`
(mit `tileCount`, damit der rote Lauf endet), `ImageLoader.prototype.loadAsync`
auf ein 64×64-Bild gemockt, `makeTextureFactory()`, `load()`, Factory setzen,
`flushMicrotasks()`. Erwartet: genau ein Error-Event mit `source: 'texture'`,
`id: 'tiles'`, `error` ist `instanceof RangeError`; `resource.tileSet` ist
`undefined`. Vor dem Fix rot (kein Fehler, ein TileSet mit acht Kacheln der
Breite 0).

### 3. Animationseinträge, die kein Objekt sind, überspringen sich selbst (BUG-068)

`TextureResource.ts`:

- `animationDataShape` (Zeile 36-41): Parameter auf `data: unknown` umstellen
  und als erste Zeile `if (typeof data !== 'object' || data === null) return undefined;`.
  Die TSDoc darüber um den Satz ergänzen, dass ein Eintrag, der kein Objekt ist
  (`null`, eine Zahl, ein String aus dem Katalog-JSON), ebenfalls `undefined`
  ergibt. Die Aufrufstellen behalten ihren Typ `FrameBasedAnimationsData`.
- TileSet-Pfad (Zeile 590-609): bleibt, wie er ist — er ruft
  `animationDataShape(data)` schon vor dem `try` und überspringt alles außer
  `'tileIds'`/`'firstTileId'`; mit dem geänderten Helfer wirft er für `null`
  nicht mehr.
- Atlas-Pfad (Zeile 727-740): auf dieselbe Form wie der TileSet-Pfad bringen:
  ```ts
  const shape = animationDataShape(data);
  if (shape !== 'frameNameQuery') {
    emit(this, OnError, wrongAnimationDataError(this, name, shape));
    continue;
  }
  try {
    const timing = getTimingOptions(data);
    if ('frameNameQuery' in data) {
      animations.add(name, timing, atlas, data.frameNameQuery);
    }
  } catch (error) {
    // der bestehende Kommentar und das bestehende emit bleiben
  }
  ```
  Das `'frameNameQuery' in data` im `try` dient nur der Typverengung, wie
  `'tileIds' in data` im TileSet-Pfad; nach der Shape-Prüfung ist `data` dort
  sicher ein Objekt.
- TSDoc von `TextureResourceEvents` (Zeile 77-79): »one whose data does not fit
  this kind of resource« → »one whose data is no object or does not fit this
  kind of resource«.

Specs in `TextureResource.spec.ts`, `describe('frame based animations')`, je
eine pro Resource-Form, nach dem Muster der beiden Tests `'… reports animation
data it cannot use'`:

- Tileset: Map `{walk: null, run: {duration: 1, tileIds: [1, 2]}}` (Cast
  `as unknown as FrameBasedAnimationsDataMap`, Kommentar: das Katalog-JSON trägt,
  was es trägt). Erwartet: genau ein Error-Event, `source:
  'frameBasedAnimations'`, `animation: 'walk'`; kein Event mit `source:
  'texture'`; `resource.frameBasedAnimations!.hasAnimation('run')` ist `true`,
  `hasAnimation('walk')` `false`.
- Atlas: dieselbe Prüfung mit `{walk: null, run: {duration: 1, frameNameQuery: 'idle.*'}}`
  gegen das Atlas-JSON des bestehenden Atlas-Tests (Frame `idle.1`).
- Vor dem Fix rot: der Effekt wirft, `frameBasedAnimations` bleibt `undefined`,
  der Fehler kommt als `source: 'texture'`.

### 4. Ein gelöschter `overrideImageUrl` gibt der Resource das Bild der JSON zurück (BUG-069)

Weg: der zweite der Empfehlung — die gefetchte JSON unverändert in einem
eigenen privaten Signal, `atlasJson` trägt weiterhin die aufgelöste URL. Der
erste Weg (JSON unverändert in `atlasJson`) scheitert am Typ: `atlasJson` ist
`TexturePackerJsonData` mit `meta.image: string`, eine JSON ohne Bild (erlaubt,
wenn ein Override da ist) würde den Getter lügen lassen; außerdem erwartet der
bestehende Test `'an atlas json without an image loads with an overrideImageUrl'`
(`TextureResource.spec.ts:517-546`) `atlasJson.meta.image === 'override.png'`.

`TextureResource.ts`:

1. Neues Feld neben `#atlasJson` (Zeile 249):
   `#fetchedAtlasJson?: Signal<AtlasJsonResponse | undefined>;` — Typ
   `AtlasJsonResponse` aus `./isAtlasJsonResponse.js`
   (`import {isAtlasJsonResponse, type AtlasJsonResponse} from './isAtlasJsonResponse.js';`).
   Kurzer Kommentar: die JSON, wie `atlasUrl` sie geliefert hat, ohne
   aufgelöstes Bild.
2. `fromAtlas` (Zeile 236-243): im selben `batch()`
   `resource.#fetchedAtlasJson = createSignal<AtlasJsonResponse | undefined>(undefined, {attach: resource});`.
3. `load()`, Atlas-Zweig (ab Zeile 618): `const fetchedAtlasJsonSignal = this.#fetchedAtlasJson!;`
   neben den anderen drei Signal-Konstanten.
4. Fetch-Effekt (Zeile 625-688): nach der `isAtlasJsonResponse`-Prüfung nur noch
   `fetchedAtlasJsonSignal.set(atlasJson);`. Die Auflösung des Bildes, der
   Fehler »names no image and no overrideImageUrl was given« und das Schreiben
   in `this.atlasJson` (Zeile 659-675 samt Kommentar 671-674) wandern in den
   neuen Effekt.
5. Neuer Effekt direkt hinter dem Fetch-Effekt, statische Deps
   `[fetchedAtlasJsonSignal, overrideImageUrlSignal]`, `{attach: this}`:
   ```ts
   const fetched = fetchedAtlasJsonSignal.value;
   if (!fetched) return;
   const imageUrl = this.overrideImageUrl ?? fetched.meta.image;
   if (typeof imageUrl !== 'string') {
     emit(this, OnError, {
       source: 'atlas',
       url: this.atlasUrl,
       error: new Error(`[TextureResource] the response of "${this.atlasUrl}" names no image and no overrideImageUrl was given`),
     });
     return;
   }
   atlasJsonSignal.set({...fetched, meta: {...fetched.meta, image: imageUrl}});
   ```
   Direkt aufs Signal, nicht über den Setter (siehe 6). Der Kommentar dazu
   (Englisch, ohne Rückblick) sagt: die aufgelöste URL landet in der
   veröffentlichten JSON, weil `atlasJson` als `TexturePackerJsonData` typisiert
   ist und `meta.image` ein String sein muss — wie bei `TextureAtlasLoader`; die
   JSON, wie sie kam, bleibt in `#fetchedAtlasJson`, damit ein Override, der
   wieder gelöscht wird, das Bild an die JSON zurückgibt. Bei fehlendem Bild
   bleibt der zuletzt veröffentlichte Stand stehen (kein `undefined` auf den
   Signalen — Subscriber bekämen es, wo der Event-Typ einen Wert verspricht).
6. Öffentlicher Setter `set atlasJson` (Zeile 314-318): nach den beiden Guards
   `this.#fetchedAtlasJson?.set(undefined);` vor `this.#atlasJson.set(value)`.
   Kommentar: eine von außen geschriebene JSON ersetzt die gefetchte; ein
   späterer Override-Wechsel darf die gefetchte nicht zurückholen. (Ohne das
   würde der neue Effekt bei jedem Override-Wechsel die Nutzer-JSON
   überschreiben — heute bleibt sie stehen.)
7. Unverändert lassen: den `#imageUrl`-Effekt (Zeile 690-700) und den Guard im
   Atlas-Effekt (Zeile 713). Beide lösen `overrideImageUrl ?? atlasJson.meta.image`
   auf; das gibt für eine gefetchte JSON dieselbe Antwort und bleibt für eine
   geschriebene richtig.
8. TSDoc: am Getter `atlasJson` neu: bei einer von `atlasUrl` gefetchten JSON
   nennt `meta.image` das Bild, aus dem die Textur gebaut wird —
   `overrideImageUrl`, solange einer gesetzt ist, sonst das Bild der JSON; eine
   von außen geschriebene JSON ersetzt die gefetchte. Im TSDoc von
   `TextureResourceEvents` (Zeile 70-73) den Fall »names no image and was given
   no `overrideImageUrl` to fall back on« um »or whose `overrideImageUrl` is
   cleared again« ergänzen.

Specs in `TextureResource.spec.ts`, `describe('atlas fetch')`, nach dem Muster
von `'an atlas json without an image loads with an overrideImageUrl'`
(`fetch` und `ImageLoader.prototype.loadAsync` gemockt, `makeTextureFactory()`,
zweimal `flushMicrotasks()` nach jedem Schritt):

- `'clearing the overrideImageUrl gives the image back to the one the json names'`:
  JSON mit `meta.image: 'atlas.png'`, `fromAtlas('sprites', 'atlas.json', 'override.png')`;
  erst `imageUrl` `'override.png'`; dann `resource.overrideImageUrl = undefined` →
  `resource.imageUrl` `'atlas.png'`, `resource.atlasJson?.meta.image` `'atlas.png'`,
  letzter Aufruf des `loadAsync`-Spys mit `'atlas.png'`. Vor dem Fix rot
  (bleibt `'override.png'`).
- `'a json without an image reports an override that is cleared again'`: JSON
  ohne `meta.image`, Override `'override.png'`; nach
  `resource.overrideImageUrl = undefined` genau ein Error-Event
  `source: 'atlas'`, `url: 'atlas.json'`; `resource.imageUrl` bleibt
  `'override.png'`. Vor dem Fix rot (kein Fehler).
- Wächter `'a json written from outside stays when the override changes'`: nach
  dem Fetch `resource.atlasJson = own` mit
  `const own = {frames: {'idle.1': {frame: {x: 0, y: 0, w: 8, h: 8}}}, meta: {image: 'own.png', size: {w: 16, h: 16}}}`, dann
  `resource.overrideImageUrl = undefined` → `resource.atlasJson` ist die eigene
  JSON (`toBe`), `resource.imageUrl` `'own.png'`. Grün vor dem Fix; fällt, wenn
  Punkt 6 fehlt.

Spec in `TextureStore.spec.ts`, beim bestehenden Override-Test (um Zeile 1210-1270):
`'a parse without the overrideImageUrl gives the atlas its json image back'` —
`store.parse({defaultTextureClasses: [], items: {a: {atlasUrl: 'atlas.json', overrideImageUrl: 'override.png'}}})`,
Resource über `store.on('a', 'texture', () => {})` aktivieren, Factory setzen,
flushen, `imageUrl` `'override.png'`; dann dieselbe `parse()` ohne
`overrideImageUrl` → `resource.imageUrl` ist das Bild der JSON. Vor dem Fix rot.

### 5. Ein Throw im `load`-Event der drei Callback-Loader wird zur Fehler-Callback (BUG-066)

Muster ist `TextureAtlasLoader.ts:71-80`: Arbeit im `try`, im `catch`
`onErrorCallback?.(error); return;`, **der Aufruf von `onLoadCallback` steht
hinter dem `try`**. Abweichung von der Empfehlung (»den Rumpf jedes
onLoad-Callbacks in try hüllen«): der Aufruf des `onLoadCallback` bleibt
draußen, sonst meldet ein Loader einen Throw aus dem eigenen Callback des
Aufrufers als Ladefehler — nachdem er ihm schon Erfolg gemeldet hat. So hält es
auch das Gegenbeispiel.

- `PowerOf2ImageLoader.ts` (Zeile 31-51): Canvas-Aufbau und Koordinaten im
  `try`. `canvas.getContext('2d')!` durch einen Null-Check ersetzen, der im
  `try` wirft:
  `throw new Error(`PowerOf2ImageLoader: no 2d context to pad "${url}" to a power of 2`)`
  (Präfix-Stil wie `TextureAtlasLoader:`). Das deckt auch ein fehlendes
  `document` (Worker) ab. Kommentar über dem `try` wie in `TextureAtlasLoader`:
  der Callback läuft im `load`-Event des Bildes, ohne Weg zurück in die Promise
  von `loadAsync()`.
- `TextureImageLoader.ts` (Zeile 38-47): `new Texture(…)` und
  `this.textureFactory.update(…)` im `try`; im `catch` zusätzlich
  `texture?.dispose()` — die Textur hat der Loader gebaut und nie herausgegeben,
  sie gehört ihm (`packages/twopoint5d/docs/resource-lifecycle.md` §1).
- `TileSetLoader.ts` (Zeile 39-53): `new Texture`, `texture.name`,
  `textureFactory.update` und `new TileSet(…)` im `try`; im `catch`
  `texture?.dispose()` und `onErrorCallback?.(error)`.
- Ohne `onErrorCallback` wird der Fehler verschluckt — wie beim Gegenbeispiel;
  `loadAsync()` gibt immer `reject` mit.

Specs, drei neue Dateien neben den Loadern. Ein Stub, der den `onLoad` des
darunterliegenden Loaders **einfängt**, damit der Test das `load`-Event selbst
auslöst:

```ts
let deliver!: () => void;
// stub.load = (_url, onLoad) => { deliver = () => onLoad(image); }
// `image` ist je Loader unten genannt
const promise = loader.loadAsync(…);
deliver();
await expect(promise).rejects.toThrow(…);
```

Vor dem Fix wirft `deliver()` synchron in den Test (rot), nach dem Fix
rejected die Promise.

- `PowerOf2ImageLoader.spec.ts`: `vi.spyOn(ImageLoader.prototype, 'load')` mit
  Einfang, geliefert wird `{width: 3, height: 5}` (keine Zweierpotenz).
  - `vi.stubGlobal('document', {createElement: () => ({getContext: () => null})})`
    → rejected mit `/no 2d context/`.
  - `vi.stubGlobal('document', {createElement: () => { throw new Error('no canvas'); }})`
    → rejected mit `'no canvas'`.
  - Wächter: `{width: 4, height: 8}` resolved mit `imgEl` = dem gelieferten Bild
    und `texCoords` 4×8, ohne `document`.
  - `afterEach(() => vi.unstubAllGlobals())`.
- `TextureImageLoader.spec.ts`: `imageLoader`-Stub (`{load(url, onLoad) {…}} as unknown as PowerOf2ImageLoader`)
  liefert `{imgEl: {} as HTMLImageElement, texCoords: new TextureCoords(0, 0, 16, 16)}`;
  `textureFactory`-Stub, dessen `update()` wirft → rejected mit diesem Fehler,
  und `vi.spyOn(Texture.prototype, 'dispose')` einmal gerufen.
- `TileSetLoader.spec.ts`: derselbe Bild-Stub, `textureFactory`-Stub mit
  harmlosem `update()`, `loadAsync('tiles.png', {tileWidth: 0, tileHeight: 16})`
  → rejected mit `RangeError` (`/tileWidth/`), `Texture.prototype.dispose`
  einmal gerufen. Braucht Schritt 1; vor Schritt 5 wirft `deliver()` den
  `RangeError` synchron (rot).

### 6. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` → `### Fixed` (Zeile
139ff.), Skill `updating-changelog` laden. Vier Einträge im Stil der
vorhandenen (»fix …«, eigene Worte, keine IDs):

- `TileSet` wirft einen `RangeError`, der Option und Wert nennt, für
  `tileWidth`/`tileHeight`, die keine endliche Zahl über 0 sind, für negative
  oder nicht endliche `margin`/`padding`/`spacing`, für einen `tileCount`, der
  keine ganze Zahl ab 1 ist, und für nicht endliche Maße der `baseCoords` — ein
  Tippfehler im Katalog friert die Seite nicht mehr ein, eine
  `TextureResource` meldet ihn als `error` mit `source: 'texture'`.
- ein Animationseintrag einer `TextureResource`, der kein Objekt ist (`null`,
  eine Zahl, ein String), wird übersprungen und als `source:
  'frameBasedAnimations'` gemeldet; die übrigen Einträge derselben Map werden
  registriert.
- eine Atlas-`TextureResource`, deren `overrideImageUrl` gelöscht wird (direkt
  oder durch ein `parse()` ohne ihn), lädt wieder das Bild, das ihre JSON nennt;
  nennt die JSON keins, meldet sie das als `error` mit `source: 'atlas'`.
- `PowerOf2ImageLoader`, `TextureImageLoader` und `TileSetLoader` geben einen
  Fehler im `load`-Event des Bildes an den Fehler-Callback, `loadAsync()`
  rejected statt nie zu settlen; ein fehlender 2d-Context wird als Fehler
  gemeldet, eine schon gebaute Textur freigegeben.

Die Migration-Guide-Prüfung des Skills entscheidet der Implementierer; ein
`TileSet`, der bei ungültigen Optionen wirft, ist nach Ansicht dieses Plans ein
Fix ohne Migrationsbedarf.

## Abgrenzung

Diese Audit-Findings liegen im selben Modul, gehören **nicht** zu diesem Paket
und werden nicht mitbehoben:

- Textur-Ownership vor dem `batch()` im Bild-Effekt (`TextureResource.ts:520-534`):
  wirft ein abgeleiteter Effekt im `batch()`, bleibt `#ownTexture` auf dem
  Vorgänger. Schritt 2 macht das für ein abgewiesenes TileSet erreichbar — vor
  dem Paket hing die Seite an dieser Stelle. Ursache und Finding bestehen
  unabhängig davon und bleiben im Audit.
- `TextureStore.get()` ohne Fehlerpfad, Katalog-Typprüfung in `parse()`, die
  breiteren Loader-Specs, schwache Typen (`TileSet#frame()` mit `!`).
- Die neuen Spec-Dateien tragen nur die Regressionstests dieses Pakets.

Kein Browsertest: das Paket ändert weder Rendering- noch GPU-Buffer-Code, und
der DOM-Pfad von `PowerOf2ImageLoader` ist in Vitest über `vi.stubGlobal`
abgedeckt. Die vorhandenen Browsertests (`texture-store-on.test.js` mit
`tileWidth: 64, margin: 1`) laufen im Gate mit.

## Anmerkungen aus Zug 0

- Der Nebenbefund `TileSet.ts:147-148` (`padding << 1` schneidet einen
  gebrochenen `padding` ab) steht schon in »Offene Befunde« des Plans — nicht
  noch einmal melden.

- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · Modul `texture` seit Lauf-Beginn (e352b56) von keinem Commit berührt · BUG-067 unverändert (`TileSet.ts:142-183`, Effekt `TextureResource.ts:571-581`) · BUG-068 unverändert (`TextureResource.ts:36-41`, `590-595`, `727-740`) · BUG-069 unverändert (`TextureResource.ts:659`, `675`, `695`, Guard `713`) · BUG-066 unverändert (`PowerOf2ImageLoader.ts:36-39`, `TextureImageLoader.ts:36-45`, `TileSetLoader.ts:39-53`, Gegenbeispiel `TextureAtlasLoader.ts:71-80`) · mitgenommen: `tileCount`- und `baseCoords`-Prüfung (gleiche Ursache) · offene Folgen: keine (Paket 1 → Paket 8 erledigt, Paket 2 und 8 ohne) · »Offene Befunde«: keiner teilt die Ursache, neu eingetragen `TileSet.ts:147-148` · Restplan geprüft, keine Änderung
  - 2026-09-19 Zug 1: Implementierer beauftragt · sonnet, effort medium · Brief `paket-3.impl-1.brief.md`, Report nach `paket-3.impl-1.json`
  - 2026-09-19 Zug 2: Report FERTIG · geändert `TileSet.ts`, `TileSet.spec.ts`, `TextureResource.ts`, `TextureResource.spec.ts`, `TextureStore.spec.ts`, `PowerOf2ImageLoader.ts`, `TextureImageLoader.ts`, `TileSetLoader.ts`, `CHANGELOG.md` · neu `PowerOf2ImageLoader.spec.ts`, `TextureImageLoader.spec.ts`, `TileSetLoader.spec.ts` · rote Läufe belegt · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer (opus, medium) — alle vier Findings und beide Mitgenommenen behoben · 1 wichtig (CHANGELOG-Einträge blicken auf den Vorzustand zurück), 5 klein · Diff `paket-3.diff`
  - 2026-09-19 Zug 4 Runde 1: offen 1 (wichtig: CHANGELOG-Rückblick) · an denselben Implementierer (resume), dazu 2 kleine Textbefunde · Brief `paket-3.impl-2.brief.md`
    → zurück: FERTIG, CHANGELOG-Einträge und drei Loader-Kommentare sowie Spec-Kommentar umformuliert · Diff `paket-3.r1.diff` · gezielter Reviewer 2 (sonnet, medium)
  - 2026-09-19 Zug 4 Runde 1 Review: `paket-3.review-2.json` — wichtig behoben, beide kleinen behoben, nichts Neues · offen 1 → 0
  - 2026-09-19 Zug 5: `pnpm run ci` exit=0 (`paket-3.verify.log`) · Commit d90a308 · 2 Runden

## Findings im Volltext

**BUG-067 · high · packages/twopoint5d/src/texture/TileSet.ts:147-187 (erreicht über TextureResource.ts:573-576 mit Daten aus types.ts:42)** — TileSet: degenerierte Kachelmaße aus dem Katalog-JSON abweisen, bevor die Layout-Schleife läuft
`tileCountLimit` ist per Default `Infinity`. Mit `tileWidth: 0` (oder negativ) wird `xOffsetNext` null, die Bedingung `x + xOffsetNext + tileOuterWidth + margin <= baseWidth` bleibt für immer wahr, und `x` überschreitet nie das Zeilenende; mit `tileHeight: 0` wächst `y` nie über `baseHeight`. Beides sind Endlosschleifen. Die Optionen kommen direkt aus dem gefetchten Katalog (`TextureStore.parse()` → `fromTileSet()` → `new TileSet()` in einem Effekt), ein Tippfehler in einer ausgelieferten `tileset.json` friert die Seite synchron ein — ohne Error-Event.
Empfehlung: In `#createTextureCoords()` oder im Konstruktor einen benannten `Error` werfen, wenn `tileWidth`/`tileHeight` nicht endlich oder nicht `> 0` sind bzw. `margin`/`padding`/`spacing` negativ. Der TileSet-Effekt in `TextureResource` leitet einen Throw bereits als `{source: 'texture'}` weiter. Spec mit `tileWidth: 0`, negativer Breite und einer Kachel breiter als das Bild.

**BUG-068 · medium · packages/twopoint5d/src/texture/TextureResource.ts:36-41, 590-595, 727-739** — Die Shape-Prüfung der Animationsdaten gegen Nicht-Objekt-Einträge absichern
`frameBasedAnimations` kommt aus dem Katalog-JSON. Für einen Eintrag, der `null`, eine Zahl oder ein String ist (`"walk": null`), wirft der `in`-Operator einen `TypeError` — auf dem TileSet-Pfad in Zeile 591 *vor* dem `try`, auf dem Atlas-Pfad in Zeile 728 außerhalb davon. Der Effekt wirft, die gesamte Animations-Map entfällt (entgegen dem TSDoc »Every other entry of the same map is registered all the same«), der Fehler erscheint als irreführendes `{source: 'texture'}`, und MEM-001 wird als Nebenwirkung ausgelöst.
Empfehlung: `animationDataShape` gibt für `typeof data !== 'object' || data === null` `undefined` zurück; die Atlas-Prüfung `'frameNameQuery' in data` in denselben Helfer ziehen. Je eine Spec für einen `null`-Eintrag auf TileSet- und Atlas-Resource.

**BUG-069 · low · packages/twopoint5d/src/texture/TextureResource.ts:659, 675, 695** — Das ursprüngliche JSON-Bild behalten, wenn overrideImageUrl wieder gelöscht wird
Der Override wird beim Fetch in `atlasJson.meta.image` eingebacken. Wird `overrideImageUrl` später auf `undefined` gesetzt, läuft der Effekt in Zeile 690 erneut und fällt auf `atlasJson.meta.image` zurück — das ist jetzt der alte Override, nicht das Bild, das die JSON nannte. Der `atlasJson`-Getter meldet den Override, als hätte die JSON ihn genannt. Nur der erste Override »gewinnt«; ein `parse()` mit geänderter `overrideImageUrl` verhält sich gleich.
Empfehlung: Die gefetchte JSON unverändert speichern und `overrideImageUrl ?? json.meta.image` in den Effekten auflösen, die es brauchen (Zeile 695 und der Guard in 713 tun das schon); muss `atlasJson.meta.image` die aufgelöste URL tragen, die Roh-JSON in einem zweiten privaten Feld halten.

**BUG-066 · low · packages/twopoint5d/src/texture/PowerOf2ImageLoader.ts:36-39; TextureImageLoader.ts:36-45; TileSetLoader.ts:39-53 (Gegenbeispiel: TextureAtlasLoader.ts:71-80)** — Ein Throw im load-Event der Callback-Loader zu einer Rejection machen
`TextureAtlasLoader` dokumentiert, warum ein Throw im `load`-Event des Bildes an `onErrorCallback` gehen muss — sonst bleibt die Promise aus `loadAsync()` für immer offen. Seine drei Geschwister tun es nicht: `getContext('2d')!`, das `null` liefert (Context-Limit, Headless), oder ein werfender `TileSet`-Konstruktor (siehe BUG-067) landen in `window.onerror`, und `loadAsync()` settelt nie.
Empfehlung: Den Rumpf jedes `onLoad`-Callbacks in `try { … } catch (e) { onErrorCallback?.(e); }` hüllen und das `!` durch einen Null-Check ersetzen, der `onErrorCallback` ruft.

## Reviewer-Urteil

- BUG-067 behoben — `TileSet.ts:166-187` (Prüfung vor der Schleife über die aufgelösten Getter), Ende zu Ende `TextureResource.spec.ts` »a tile set that is refused is reported as a texture failure«
- BUG-068 behoben — `TextureResource.ts:36-41` (`animationDataShape(data: unknown)` mit Objekt-Guard), TileSet- und Atlas-Pfad mit Shape-Check vor dem `try`
- BUG-069 behoben — `#fetchedAtlasJson` (`TextureResource.ts:254`), Fetch-Effekt setzt nur dieses Signal, neuer Effekt veröffentlicht die aufgelöste JSON, Setter `atlasJson` verwirft die gefetchte (`:329`); Specs in `TextureResource.spec.ts` und `TextureStore.spec.ts`
- BUG-066 behoben — `PowerOf2ImageLoader.ts`, `TextureImageLoader.ts`, `TileSetLoader.ts` nach dem Muster von `TextureAtlasLoader`, `onLoadCallback` hinter dem `try`, Textur im `catch` freigegeben
- Mitgenommen `tileCount` behoben — `TileSet.ts:182-187`; Mitgenommen `baseCoords` behoben — `TileSet.ts:170-171`

Kleine Befunde (ohne Runde):

- `TextureResource.ts` neuer Atlas-Effekt: die Fehlermeldung nennt `this.atlasUrl`, nicht die URL, von der die JSON stammt — fällt auseinander, wenn `atlasUrl` wechselt, der neue Fetch noch läuft oder scheitert und dazwischen `overrideImageUrl` gelöscht wird
- TSDoc von `TextureResourceEvents`: ergänzte Zeile (~107 Zeichen) nicht neu umbrochen
- Kommentar über dem `try` in den drei Loadern unregelmäßig umbrochen (bis ~118 Zeichen)
- `TextureAtlasLoader.ts:73` trägt noch die Formulierung »turned into a call instead« (nicht im Paket, nicht angefasst)
- Commit-Message lang (rund 210 Zeichen Kopf); »never end the layout« in Runde 1 durch »the layout cannot use« ersetzt, weil `tileCount` 0 oder 2.5 die Schleife durchaus beenden

Nebenbefunde, Urteil begründet: `TileSet.ts:67` (`options` bei fehlenden Optionen `undefined`) ist ein Typdefekt ohne Laufzeitfehler, die Getter fangen ihn per `?.` ab → Audit (TYPE); `TileSetLoader.ts:33` vs. `TextureImageLoader.load()` ist eine Inkonsistenz ohne Fehlverhalten → Audit (CONS).
