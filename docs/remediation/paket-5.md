# Paket 5 — Texture nachgezogen: gescheiterte Loads melden ihren Fehler, `DynamicAtlas` lehnt nur ab, was sich nicht zeichnen lässt

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nachtragspaket zu Paket 3, keine Audit-Findings). Fundstellen: zwei Folgen
  aus Paket 3, dazu drei Nebenbefunde derselben Ursache (siehe »Abgleich«)
- Folge von: Paket 3
- Ziel: Ein gescheiterter `TextureStore#loadAsync()` rejected mit seinem Ladefehler, auch wenn
  ein Listener des `error`-Events einen neuen Load startet, das Signal abbricht oder den Store
  disposed, und `DynamicAtlas` lehnt nur ab, was sich nicht zeichnen lässt — ein noch ladendes
  Bild-Element, eine geschlossene `ImageBitmap`, einen Canvas ohne Größe —, während es ein
  geladenes Bild ohne natürliche Größe in der Größe zeichnet, die `add()` bekommt bzw. die der
  Frame hat.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/TextureStore.ts`
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts`
  - `packages/twopoint5d/src/texture/DynamicAtlas.ts`
  - `packages/twopoint5d/src/texture/DynamicAtlas.spec.ts`
  - `packages/twopoint5d-testing/test/texture-dynamic-atlas.test.js`
  - `packages/twopoint5d/docs/sprites.md` (Absatz zu `add()`/`redraw()` unter »Atlases built
    at run time: `DynamicAtlas`«, Zeile 470–472)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`)
- Verify: `pnpm run ci` (zum Iterieren vorher:
  `pnpm nx test twopoint5d -- src/texture/TextureStore.spec.ts src/texture/DynamicAtlas.spec.ts`)
- Commit: `fix(texture): a failed catalog load rejects with its own failure, and DynamicAtlas draws a loaded image without a natural size at the size it is given`
  mit diesem Body:

  ```
  - TextureStore#loadAsync() settles a load whose fetch, status or body failed before
    the error event goes out: an error listener that starts another loadAsync(), aborts
    the signal or disposes the store leaves the promise rejecting with that failure
  - DynamicAtlas refuses an image element only while it is still loading; one that has
    loaded without a natural size, an SVG without width and height, is drawn at the size
    add() is given and at the size of the frame by redraw(), and add() without a size
    asks for one
  - DynamicAtlas refuses a closed ImageBitmap or a canvas of no size, saying so
  ```

## Abgleich

Gegen `fd3f7540` (HEAD), 2026-10-21.

**Folge 1 — `TextureStore.ts:631`: unverändert.** `failed()` (`:631–634`) emittiert `error`
per `emitSafe()`, bevor irgendetwas den Load abschließt. Die drei Fehlerstellen vor dem Parse —
`fetch` wirft (`:643–646`), Status (`:648–656`), Body ist kein JSON (`:660–663`) — rufen
`throw failed(…)`. Startet ein `error`-Listener darin `store.loadAsync(other)`, ruft der neue
Aufruf `this.#loadUnderWay?.()` (`:625`), das ist noch `onSuperseded` des gescheiterten Loads
(erst `settle()` in `:605` räumt es ab) → `cutShort()` → `reject(AbortError)`. Der danach
geworfene Ladefehler landet in `attempt().catch` (`:681–685`) und wird an `if (settled) return`
verschluckt. Der Parse-Pfad (`:669–675`) ist richtig: `settle()` steht dort vor dem Parse.

**Nebenbefund derselben Ursache, vorbestehend (low), aufgenommen.** Bricht ein `error`-Listener
das Signal des Aufrufers ab oder disposed er den Store, greifen `onAbort` bzw. `onDispose`
(`:614–615`, registriert `:622–623`) genauso, und das Promise rejected mit `AbortError` bzw. dem
Disposed-Fehler statt mit dem Ladefehler — obwohl das `error`-Event schon draußen ist, was der
TSDoc (»no `error` event goes out« für einen abgebrochenen Load) ausschließt. Nachgesehen in
`git show 4bf14f2e:packages/twopoint5d/src/texture/TextureStore.ts`: dort derselbe Ablauf
(`failed()` vor `settle()`), also vor dem Lauf schon so. Ursache identisch — der Versuch ist
beim Melden noch nicht abgeschlossen —, und derselbe Fix behebt ihn; einen eigenen Weg gibt es
nicht. Deshalb hier und nicht in »Offene Befunde«.

**Folge 2 — `DynamicAtlas.ts:371–375` mit `:444–447`: unverändert.** `#sizeOf()` ruft
`#assertLoaded()` auch mit `size`; das lehnt jedes Bild mit natürlicher Größe 0 als »has not
loaded yet« ab, darunter ein fertig geladenes SVG-`<img>` ohne `width`/`height` (`naturalWidth`
0 bei `complete === true`). `drawImage(image, dx, dy, dw, dh)` zeichnet so ein Bild laut Spec in
der gegebenen Größe. Vor Paket 3 (`git show 4bf14f2e`, Zeile 372) lief `#assertLoaded()` nur
ohne `size`.

**Nebenbefunde aus »Offene Befunde«, dieselbe Ursache, aufgenommen.** Die Ursache aller drei
Stellen: `#assertLoaded()` liest jede natürliche Größe 0 als »Bild-Element lädt noch« und gibt
den Rat, der nur für ein ladendes Bild-Element stimmt.

- `DynamicAtlas.ts:297` — `redraw()` lehnt über `#assertLoaded()` ein geladenes SVG ohne eigene
  Größe ab, obwohl es in der Frame-Größe zeichnet. Unverändert. Bliebe es, zeichnete `add()` mit
  `size` das SVG und `redraw()` desselben Frames lehnte es ab.
- `DynamicAtlas.ts:444–447` — eine geschlossene `ImageBitmap` (0 × 0) bekommt »await
  image.decode()«, das sie nicht hat. Unverändert.

## Entscheidungen in Zug 0

- **Settle vor dem Melden.** Ein Schritt vor dem Parse, der scheitert, schließt den Versuch ab
  (`settle()`), meldet dann (`error`-Event) und rejected mit dem Ladefehler. Das ist dieselbe Regel,
  die für den Parse schon gilt (»Once the parse has begun the load is done«), auf den Fehlerfall
  übertragen: ein gescheiterter Load ist vorbei, und nichts, was ein Listener danach tut, schneidet
  ihn noch ab. Die Ansage aus »Entscheidungen« (ein neuer `loadAsync()` bricht den *laufenden*
  Fetch ab) bleibt unberührt — ein gemeldeter Fehlschlag läuft nicht mehr.
- **Was »nicht zeichenbar« heißt.** Bild-Element (`'naturalWidth' in image`): nur `complete ===
  false` wird abgelehnt (lädt noch). Ein fertiges Bild-Element mit natürlicher Größe 0 ist synchron
  nicht als SVG ohne Größe oder als kaputtes Bild zu unterscheiden. Es geht deshalb durch: das SVG
  zeichnet in der gegebenen Größe, und an einem kaputten Bild wirft `drawImage()` laut Spec einen
  `InvalidStateError` (Chromium: »… is in the 'broken' state«, Firefox: »Passed-in image is
  "broken"«). `add()` rollt dann über seinen vorhandenen `try`/`catch` (`:259–265`) zurück und
  belegt keine Zelle. `redraw()` lässt den Frame geleert zurück, wie bei jedem Bild, das beim
  Zeichnen wirft (TSDoc `:283–285`). `ImageBitmap`/Canvas/`OffscreenCanvas` mit Breite oder Höhe 0
  wird immer abgelehnt, mit und ohne `size`, in `add()` und `redraw()`, vor dem Packen bzw. Leeren:
  `drawImage()` wirft dafür ohnehin, die eigene Meldung sagt, woran es liegt.
- **`add()` ohne `size`** braucht eine natürliche Größe > 0. Ein fertiges Bild-Element ohne eine
  bekommt eine Meldung, die nach der Größe fragt und das kaputte Bild als zweite Möglichkeit nennt.
- **CHANGELOG.** Der Supersede-Teil ist unveröffentlicht (Paket 3), also wird der Eintrag unter
  `### Changed` ergänzt und kein `Fixed`-Eintrag über einen Fehler geschrieben, den keine Version
  hatte. Signal und Dispose im `error`-Listener waren in 0.23.0 schon so: dafür ein Eintrag unter
  `### Fixed`. Beim `DynamicAtlas` wird der unveröffentlichte `Fixed`-Eintrag aus Paket 3
  umgeschrieben, weil er das Verhalten nach diesem Paket falsch beschreibt; der `redraw()`-Teil für
  SVG behebt Verhalten aus 0.23.0 und gehört in denselben Eintrag.
- **Modell und Effort.** Zwei lokale Bugfixes mit exakten Schritten, Meldungen und Testnamen. Die
  Nebenläufigkeit beschränkt sich auf die Reentrancy eines Listeners in einem einzigen Promise und
  ist unten Zeile für Zeile festgelegt. Die mittlere Stufe reicht. Effort `medium`, nicht `low`:
  zwei Browser-Tests in Chromium und Firefox, deren Verhalten der Implementierer am echten Browser
  nachweist.

## Vorgehen

Erst die Regressionstests, rot sehen, dann der Fix. Die roten Läufe gehören in den Report.

### A. `TextureStore#loadAsync()` — settle, dann melden

1. **Regressionstests** in `TextureStore.spec.ts`, im `describe('loadAsync()')` direkt nach dem
   Test `an error listener that throws leaves the rejection to the failure it was told about, and
   the listeners after it hear the event` (`:599–619`). Helfer der Datei nutzen: `settleWithin`,
   `once`, `TextureStoreEvents.Error`, `catalogUrl`. Für die zweite URL `const otherUrl =
   'http://example.test/other.json'` im Test.
   - `test.each` über die drei Fehler vor dem Parse:
     `['a fetch that fails', 'fetch', () => Promise.reject(new Error('boom'))]`,
     `['a response with a status', 'fetch', () => Promise.resolve(new Response('{"items":{}}', {status: 404}))]`,
     `['a body that is no JSON', 'parse', () => Promise.resolve(new Response('not-json'))]`.
     Name: `'an error listener that starts another loadAsync() on %s leaves the failed load rejecting with its failure, naming the %s step, and the other load parses its catalog'`.
     `fetch` per `vi.spyOn(globalThis, 'fetch').mockImplementation((input) => String(input) ===
     catalogUrl ? answer() : Promise.resolve(new Response('{"items":{"b":{"imageUrl":"b.png"}}}')))`.
     `once(store, TextureStoreEvents.Error, () => { other = store.loadAsync(otherUrl); })`. Erwartet:
     `settled` ist `Error`, `message` ist `` `[TextureStore] load failed at the ${step} step: "${catalogUrl}"` ``,
     `(settled as Error).cause` ist das `error` des einen gemeldeten Events (wie im `test.each` bei
     `:621–641`), `await other` ist `store`, `await store.whenResource('b')` ist eine
     `TextureResource`. `store.dispose()` am Ende.
   - `'an error listener that aborts the signal leaves the rejection to the failure it was told about'`:
     `fetch` rejected mit `fetchError = new Error('boom')`, `const ac = new AbortController()`,
     `on(store, TextureStoreEvents.Error, () => ac.abort())`, `store.loadAsync(catalogUrl, {signal:
     ac.signal})`. Erwartet: `message` ist `` `[TextureStore] load failed at the fetch step: "${catalogUrl}"` ``,
     `cause` ist `fetchError`.
   - `'an error listener that disposes the store leaves the rejection to the failure it was told about'`:
     wie eben, Listener ruft `store.dispose()`. Erwartet dasselbe.
   Vor dem Fix: alle fünf rot (`AbortError` bzw. `… was cancelled: this store has been disposed`).
2. **Fix** in `TextureStore.ts`, innerhalb des `new Promise` von `loadAsync()`:
   - Unter `failed()` (`:631–634`) eine neue lokale Funktion, mit diesem Kommentar:

     ```ts
     // A step before the parse that fails ends the attempt before it is reported: a listener of the
     // `error` event that starts another loadAsync(), aborts the signal or disposes the store finds
     // this load over, and the promise rejects with the failure the event told of
     const fail = (source: 'fetch' | 'parse', error: unknown, status?: number): void => {
       settle();
       reject(failed(source, error, status));
     };
     ```

   - In `attempt()` die drei `throw failed(…)` ersetzen:
     - `catch` um `fetch` (`:643–646`): `if (!settled) fail('fetch', error); return;`
     - `!response.ok` (`:648–656`): den Kommentar dort behalten, dann
       ``fail('fetch', new Error(`[TextureStore] fetch("${String(url)}") answered ${response.status} ${response.statusText}`), response.status); return;``
     - `catch` um `response.json()` (`:660–663`): `if (!settled) fail('parse', error); return;`
   - Der Parse-Pfad (`:669–675`, `reject(failed('parse', error))` nach `settle()`) bleibt.
   - `attempt().catch(…)` (`:679–685`) bleibt im Code. Kommentar ersetzen durch:
     `// attempt() settles every failure it reports itself; a throw it does not foresee still rejects the promise instead of leaving it pending`
   - Kommentar über `onSuperseded` (`:616–618`) ergänzen: auch ein Load, dessen Schritt
     gescheitert ist, ist abgeschlossen und wird von nichts mehr abgeschnitten.
3. **TSDoc** in `TextureStore.ts`:
   - `loadAsync()` (`:555–563`): hinter »An `error` listener that throws changes nothing of this:
     … and the promise rejects as described.« einen Satz: ein `error`-Listener, der einen weiteren
     `loadAsync()` startet, das Signal abbricht oder den Store disposed, ändert daran ebenso nichts —
     ein Load, dessen Schritt gescheitert ist, ist vorbei, wenn das Event hinausgeht, und sein Promise
     rejected mit diesem Fehler.
   - `TextureStoreLoadOptions.signal` (`:204–209`): ein Signal, das abbricht, nachdem ein Schritt
     gescheitert ist (aus einem `error`-Listener), ändert nichts; das Promise rejected mit dem Fehler.
4. **CHANGELOG** (`## [Unreleased]`):
   - `### Changed`, Eintrag `a later TextureStore#loadAsync() on the same store cuts short …`
     (Zeile 78) am Ende ergänzen: ein Load, dessen Fetch, Status oder Body gescheitert ist, ist mit
     seinem `error`-Event ebenso vorbei; ein `loadAsync()`, den ein `error`-Listener startet, nimmt
     nicht seinen Platz ein, und sein Promise rejected mit dem Fehler.
   - `### Fixed` neuer Eintrag: `TextureStore#loadAsync()` rejected mit dem Fehler seines Fetch,
     seines Status oder seines Body auch dann, wenn ein Listener dieses `error`-Events das Signal
     abbricht oder den Store disposed.

### B. `DynamicAtlas` — nur ablehnen, was sich nicht zeichnen lässt

1. **Regressionstests** in `DynamicAtlas.spec.ts` (`atlasOn`, `image`, `noop`, `rectOf` der Datei).
   Fakes: `const svg = {width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, complete: true} as
   unknown as DynamicAtlasImage` — ein fertig geladenes Bild-Element ohne natürliche Größe.
   - In `describe('add()')`, nach `refuses an image element that is still loading although its natural size is known` (`:352–359`):
     - `'draws an image element that has loaded without a natural size at the size given'`:
       `atlas.add('icon', svg, {width: 16, height: 8})` → `rectOf(atlas, 'icon')` ist `{x: 1, y: 1,
       w: 16, h: 8}`, `drawImage`-Args `[[svg, 0, 0, 16, 8]]`. Vor dem Fix rot.
     - `'refuses a closed ImageBitmap or a canvas of no size, with or without a size, and takes no cell'`:
       `image(0, 0)` → `add('avatar', source)` und `add('avatar', source, {width: 8, height: 8})`
       werfen beide `'DynamicAtlas: the image of "avatar" is 0 × 0 — a closed ImageBitmap or a canvas of no size has nothing to draw'`;
       `atlas.atlas.size` ist 0, kein `drawImage`, das nächste `add('next', noop, {width: 8, height: 8})`
       liegt bei `{x: 1, y: 1}`. Vor dem Fix rot (andere Meldung).
   - Bestehenden Test `refuses an image element that has not loaded` (`:332–338`) umschreiben, er
     prüft das alte Verhalten: neuer Name `'refuses an image element that has loaded without a natural size when no size is given, asking for one'`,
     Fake `svg` (mit `complete: true`), erwartete Meldung
     `'DynamicAtlas: the image of "avatar" has no natural size — an SVG without width and height needs the size: add(name, image, {width, height}); an image that failed to load cannot be drawn at all'`.
   - In `describe('redraw()')`:
     - Bestehenden Test `refuses an image element that has not loaded, before it clears the frame`
       (`:516–525`): Fake bekommt `complete: false`, sonst unverändert (Meldung `… has not loaded yet — await image.decode() before redraw()`).
     - Neu `'draws an image element that has loaded without a natural size at the size of the frame'`:
       Frame per `add('portrait', noop, {width: 10, height: 8})`, `redraw('portrait', svg)` →
       `drawImage`-Args `[[svg, 0, 0, 10, 8]]`. Vor dem Fix rot.
     - Neu `'refuses a closed ImageBitmap or a canvas of no size, before it clears the frame'`:
       `redraw('avatar', image(0, 0))` wirft die 0 × 0-Meldung, `context.calls.length` unverändert.
       Vor dem Fix rot (andere Meldung).
   - Die drei Tests mit `complete: false` (`:340–350`, `:352–359`, `:527–536`) bleiben unverändert grün.
2. **Fix** in `DynamicAtlas.ts`: `#assertLoaded()` (`:440–450`) durch zwei Methoden ersetzen.

   ```ts
   // Refuses an image that cannot be drawn now, before anything is packed or cleared: an image element
   // that is still loading — the browser knows its size once it is "partially available", before the
   // last of it has arrived, and drawImage() draws nothing of it — and an ImageBitmap or a canvas of no
   // size, a closed ImageBitmap among them, which drawImage() refuses. An image element that has
   // finished passes whatever its natural size: an SVG without width and height has none and is drawn
   // at the size it is given, and one that failed to load makes drawImage() throw
   #assertDrawable(name: TextureAtlasFrameName, image: DynamicAtlasImage, call: string): void
   ```

   - Bild-Element (`'naturalWidth' in image`): wirft genau dann, wenn `'complete' in image &&
     image.complete === false`, mit der bestehenden Meldung
     `` `${WHERE}: the image of "${nameOf(name)}" has not loaded yet — await image.decode() before ${call}` ``;
     sonst `return`.
   - Sonst (`ImageBitmap`, Canvas, `OffscreenCanvas`): wirft, wenn `!(image.width > 0) ||
     !(image.height > 0)`, mit
     `` `${WHERE}: the image of "${nameOf(name)}" is ${image.width} × ${image.height} — a closed ImageBitmap or a canvas of no size has nothing to draw` ``.

   ```ts
   // the size an image is drawn at by itself, refused for an image element without a natural size
   #naturalSize(name: TextureAtlasFrameName, image: DynamicAtlasImage): {width: number; height: number}
   ```

   - `const natural = sizeOfImage(image)`; wirft, wenn `!(natural.width > 0) || !(natural.height > 0)`, mit
     `` `${WHERE}: the image of "${nameOf(name)}" has no natural size — an SVG without width and height needs the size: add(name, image, {width, height}); an image that failed to load cannot be drawn at all` ``;
     sonst `natural`.
   - `#sizeOf()` (`:371–376`): `this.#assertDrawable(name, source, 'add()'); if (size == null)
     return this.#naturalSize(name, source);`. Kommentar darüber: mit einer Größe ebenso, denn
     `drawImage()` zeichnet nichts von einem Bild, das noch lädt, und der Frame bliebe für immer leer.
   - `redraw()` (`:297`): `if (typeof source !== 'function') this.#assertDrawable(name, source, 'redraw()');`
3. **TSDoc** in `DynamicAtlas.ts`:
   - `add()` (`:229–245`): ein Bild-Element ohne natürliche Größe (SVG ohne `width`/`height`) braucht
     die `size`. `@throws {Error}` nennt: Bild-Element, das noch lädt — mit oder ohne Größe —,
     Bild-Element ohne natürliche Größe ohne `size`, geschlossene `ImageBitmap` oder Canvas ohne Größe.
     Dazu ein `@throws {DOMException}`: `InvalidStateError` aus `drawImage()` für ein Bild-Element, das
     nicht geladen werden konnte; es wird kein Frame angelegt und keine Zelle belegt.
   - `redraw()` (`:277–289`): ein Bild-Element, das noch lädt, und eine geschlossene `ImageBitmap`
     oder ein Canvas ohne Größe werden abgelehnt, bevor etwas geleert wird; ein geladenes Bild ohne
     natürliche Größe zeichnet in der Frame-Größe; eines, das nicht geladen werden konnte, wirft aus
     `drawImage()` und lässt den Frame geleert zurück, wie jedes Bild, das wirft.
4. **Browser-Tests** in `packages/twopoint5d-testing/test/texture-dynamic-atlas.test.js`, im
   bestehenden `describe`, Pixel lesen wie im Test bei `:196–230` (`atlas.context.getImageData`):
   - `'draws an SVG image without a width and a height at the size add() gives it, and redraws it at the size of the frame'`:
     `atlas = new DynamicAtlas({width: 16, height: 16})`. Zwei `<img>` aus
     `'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="rgb(255,0,0)"/></svg>')`
     bzw. mit `rgb(0,0,255)`, je `await img.decode()`. `atlas.add('icon', red, {width: 4, height: 4})`
     → Pixel im Frame `{x: 1, y: 1, w: 4, h: 4}` rot und deckend; `atlas.redraw('icon', blue)` →
     dieselben Pixel blau. Im Report vermerken, welche `naturalWidth` Chromium und Firefox für das SVG
     melden. Der Vitest-Fake aus B.1 ist der rote Regressionstest; dieser Test ist die Probe am
     echten Browser.
   - `'refuses an image element that failed to load, and takes no cell for it'`: `const broken = new
     Image(); broken.src = 'data:image/png;base64,AAAA'; await broken.decode().catch(() => {});`
     → `atlas.add('broken', broken, {width: 4, height: 4})` wirft einen Fehler mit `name ===
     'InvalidStateError'`, `atlas.atlas.size` ist 0, ein folgendes `add('next', (ctx) => {},
     {width: 4, height: 4})` hat `data.frame` `{x: 1, y: 1, w: 4, h: 4}`. Wirft ein Browser hier
     nicht, ist das ein `BLOCKIERT` mit Browser und Beobachtung im Report. Dann ist die Annahme
     dieses Pakets falsch, und es braucht eine Entscheidung, keinen Workaround.
5. **Docs** `packages/twopoint5d/docs/sprites.md`, der Satz in Zeile 470–471 (»An image element that
   has not loaded — its natural size still 0, or `complete` still false — is refused …«) wird ersetzt:
   ein Bild-Element, das noch lädt (`complete` noch `false`), eine geschlossene `ImageBitmap` und ein
   Canvas ohne Größe werden von `add()` — mit oder ohne Größe — und `redraw()` abgelehnt, bevor etwas
   geleert wird; ein geladenes Bild-Element ohne natürliche Größe, ein SVG ohne `width` und `height`,
   zeichnet in der Größe, die `add()` bekommt, und `redraw()` in der Frame-Größe, `add()` ohne Größe
   lehnt es ab; eines, das nicht geladen werden konnte, lässt `drawImage()` werfen — `add()` belegt
   dann keine Zelle, `redraw()` lässt den Frame geleert. Den Absatz dabei neu umbrechen: die Zeile
   mit `**`remove(name)`**` ist heute überlang.
6. **CHANGELOG** (`## [Unreleased]`, `### Fixed`): den Eintrag `DynamicAtlas#add() refuses an image
   element that has not loaded with a size as well, …` (Zeile 85) neu fassen: `add()` und `redraw()`
   lehnen ein Bild-Element ab, das noch lädt — `complete` noch `false` —, mit einer `size` ebenso und
   auch wenn seine natürliche Größe schon bekannt ist, dazu eine geschlossene `ImageBitmap` oder
   einen Canvas ohne Größe, je mit einer Meldung, die den Fall nennt; ein geladenes Bild-Element ohne
   natürliche Größe, ein SVG ohne `width` und `height`, zeichnet in der `size` von `add()` und in der
   Frame-Größe von `redraw()`.

### Nicht in diesem Paket

- `DynamicAtlas` erkennt ein kaputtes Bild nicht selbst. Synchron ist es von einem SVG ohne Größe
  nicht zu unterscheiden; `drawImage()` meldet es.
- Die übrigen Einträge in »Offene Befunde« (`AdaptiveResolution`, `map2d`, `FeatureSprites`,
  `docs/architecture.md`) haben eine andere Ursache.

## Verlauf

- 2026-10-21 Zug 0: Detailplan steht · Folge `TextureStore.ts:631` unverändert (`:625`, `:631–634`,
  `:643–663`) · Folge `DynamicAtlas.ts:371–375`/`:444–447` unverändert · aufgenommen, gleiche
  Ursache: `DynamicAtlas.ts:297` und `DynamicAtlas.ts:444–447` aus »Offene Befunde«, dazu neu und
  vorbestehend (`git show 4bf14f2e`) `TextureStore.ts:614–615`/`:622–623` (Signal und Dispose im
  `error`-Listener, low) · keine offenen `Folgen:` anderer Pakete · Restplan unverändert (Paket 5
  ist das letzte offene)
- 2026-10-21 Zug 1: Implementierer beauftragt (sonnet, Effort medium), Report nach `paket-5.impl-0.json`
- 2026-10-21 Zug 2: Report FERTIG (Volltext `paket-5.impl-0.report.md`), 7 Dateien geändert (`TextureStore.ts`, `TextureStore.spec.ts`, `DynamicAtlas.ts`, `DynamicAtlas.spec.ts`, `texture-dynamic-atlas.test.js`, `docs/sprites.md`, `CHANGELOG.md`), 5 + 5 Regressionstests vor dem Fix rot, Arbeitsbaum schmutzig · Browser: SVG ohne `width`/`height` meldet `naturalWidth` 150 (Chromium) bzw. 300 (Firefox), nicht 0; kaputtes PNG wirft `InvalidStateError` in allen drei Läufen
- 2026-10-21 Zug 3: Reviewer (sonnet, medium) — alle fünf Fundstellen behoben, Gesamt »freigeben«; ein Befund als `klein` gemeldet, nach den Regeln `wichtig` (Doku, die jetzt lügt): `docs/proposals/dynamic-atlas-and-bitmap-text.md:203–204`, `:223`; klein: Umbruch `docs/sprites.md:123–125`, überlange TSDoc-Zeile `TextureStore.ts:553–555`, `attempt().catch` ohne Test (vom Plan so gewollt), `new Image()` ohne `src` (siehe »Anmerkungen des Reviewers«) · Diff `paket-5.diff`
- 2026-10-21 Zug 4 Runde 1: offen Proposal-Stellen (wichtig) plus die zwei Umbrüche → derselbe Implementierer per `--resume` (sonnet, medium), Report nach `paket-5.impl-1.json`
- 2026-10-21 Zug 4 Runde 1: Report FERTIG — Proposal §3.2/§3.6 umgeschrieben, `docs/sprites.md` Absatz 461–477 und TSDoc von `loadAsync()` neu umbrochen
- 2026-10-21 Zug 4 Runde 1: Verify `pnpm run ci` exit=0 (`paket-5.verify-1.log`) · Nachreview (sonnet, medium, `paket-5.review-1.json`): alle drei Befunde erledigt, ein neuer `klein`, Gesamt »freigeben« · Diff `paket-5.round-1.diff`
- 2026-10-21 Zug 5: committet `0e133345` (8 Dateien), Verify `paket-5.verify-1.log` exit=0, 1 Runde

## Urteil des Reviewers

- Folge `TextureStore.ts` `failed()` vor `settle()` beim reentranten `loadAsync()`: behoben — `fail()` ruft `settle()` vor dem Melden, alle drei Fehlerstellen vor dem Parse laufen darüber; Tests im `describe('loadAsync()')` von `TextureStore.spec.ts`.
- Signal und Dispose im `error`-Listener: behoben — `settle()` hängt `onAbort`/`onDispose` ab, bevor das Event hinausgeht; TSDoc von `TextureStoreLoadOptions.signal` und `loadAsync()` nachgezogen.
- Folge `DynamicAtlas#add()` mit `size` lehnt geladenes Bild ohne natürliche Größe ab: behoben — `#assertDrawable()` prüft beim Bild-Element nur `complete`, `#naturalSize()` greift nur ohne `size`.
- `DynamicAtlas#redraw()` lehnt geladenes SVG ab: behoben — ruft `#assertDrawable()`.
- Geschlossene `ImageBitmap` bekommt »await image.decode()«: behoben — eigene 0 × 0-Meldung in `add()` mit und ohne `size` und in `redraw()`.
- Proposal `docs/proposals/dynamic-atlas-and-bitmap-text.md` §3.2/§3.6 (Runde 1): beschreibt das Verhalten jetzt wie der Code, Fehlertexte wörtlich.

## Anmerkungen des Reviewers (klein, offen)

- `docs/proposals/dynamic-atlas-and-bitmap-text.md:210` (§3.2): »An image that failed to load makes `drawImage()` throw« gilt nur mit `size`; ohne `size` lehnt `add()` ein kaputtes Bild schon vorher mit der Meldung zur fehlenden natürlichen Größe ab. `docs/sprites.md:474–476` ebenso, dort durch den Satz davor abgedeckt.
- `TextureStore.ts` `attempt().catch(…)`: nur noch für einen unvorhergesehenen Throw da und ohne Test; vom Detailplan so gewollt.
- `DynamicAtlas.ts` `#assertDrawable()`: der Reviewer vermutete, ein `new Image()` ohne `src` (`complete` true, `naturalWidth` 0) werde jetzt mit `size` still als leere Zelle gepackt. Nach HTML-Spec steht so ein Bild im Zustand »broken«, und `drawImage()` wirft `InvalidStateError` — `add()` rollt dann zurück wie beim kaputten PNG, das der Browser-Test belegt. Nicht im Browser nachgeprüft; kein Handlungsbedarf.
- Browser-Probe: Chromium und Firefox melden für ein SVG ohne `width`/`height` eine Ersatzgröße (150 bzw. 300), nicht 0; der Zweig »geladen ohne natürliche Größe« ist nur über den Vitest-Fake belegt.
