# Paket 8 — Nachtrag zu Paket 2: Fehler-Records nur für einen Ladeschritt, der ohne Ergebnis endet

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Symptom beider Folgen von Paket 2, triagiert in Zug 0 von Paket 3) · dazu der
  vorbestehende Nebenbefund `TextureResource.ts:799,838` aus »Offene Befunde« · dazu aus diesem
  Zug 0 eine dritte Stelle derselben Folge (Fetch-Effekt) und zwei vorbestehende Stellen derselben
  Ursache (Bridges, Tile-Set-Effekt), siehe »Abgleich«
- Folge von: Paket 2
- Ziel: Ein Fehler-Record einer `TextureResource` steht nur für einen Ladeschritt, der gerade
  läuft und ohne Ergebnis endet — ein von außen geschriebenes `atlasJson` bricht den laufenden
  Atlas-Fetch ab, und der Wurf eines Subscribers zählt nicht als Texture, die nicht gebaut werden
  konnte.
- Modell: stärkste Stufe — die Korrektheit hängt an der Weitergabe von Würfen durch eventize
  (`emitStrict()` schreibt den retained Wert, bevor es wirft) und signalize (`set()`/`batch()`
  werfen erst, nachdem jede Abhängigkeit gelaufen ist) und an der Microtask-Reihenfolge der
  Tests; das Hauptrisiko ist ein Regressionstest, der aus dem falschen Grund grün ist
- Effort: medium — der Mechanismus steht unten mit Namen und Code-Skizzen fest, der
  Implementierer überträgt ihn, statt ihn zu entwerfen
- Dateien: `packages/twopoint5d/src/texture/TextureResource.ts`,
  `packages/twopoint5d/src/texture/TextureStore.ts` (nur TSDoc von `get()`),
  `packages/twopoint5d/src/texture/TextureResource.spec.ts`,
  `packages/twopoint5d/src/texture/TextureStore.spec.ts`, `packages/twopoint5d/CHANGELOG.md`
- Vor dem Code lesen: `AGENTS.md`, die Skills `using-eventize` (Abschnitt »Choosing a dispatch
  function«, Pitfall 5) und `using-signalize` (Pitfalls 7, 11d), für den CHANGELOG
  `updating-changelog`. `TextureResource.ts` ganz lesen, nicht nur die Fundstellen.

## Vorgehen

Alle Zeilennummern gegen HEAD `62c99ce1`. Code, Kommentare, TSDoc und CHANGELOG auf Englisch, im
Ton der Datei; Kommentare erklären das Warum. Keine Finding-IDs, kein Rückblick auf den
Vorzustand (»no longer«, »instead of before«) — auch nicht im CHANGELOG.

Zuerst die Regressionstests aus Schritt 7 schreiben und rot laufen lassen, den roten Lauf in den
Report, dann Schritt 1–6.

1. **Neues Feld für den laufenden Atlas-Fetch** (`TextureResource.ts`, bei den übrigen privaten
   Feldern um `:482-492`):

   ```ts
   // the atlas fetch under way, if there is one: the run of the fetch effect that started it
   // sets it and lets go of it when the fetch is over; that run's cleanup and the `atlasJson`
   // setter cut it short
   #atlasFetch?: AbortController;
   ```

2. **Fetch-Effekt** `:788-843` umbauen (`this.#loadFailures.delete('atlasFetch')` und
   `if (!atlasUrl) return;` bleiben die ersten Zeilen):
   - Die lokale Variable `aborted` entfällt; überall, wo sie gelesen wird, steht
     `ac.signal.aborted`. Nach `const ac = new AbortController();` kommt
     `this.#atlasFetch = ac;`.
   - Im `try` stehen nur noch die beiden `await`s (`fetch`, `response.json()`) und die Prüfungen
     der Antwort. Das Ergebnis des Blocks ist entweder die Json (mit gegen `atlasUrl` aufgelöstem
     `meta.image`, genau wie heute `:823-830`) oder ein `TextureResourceLoadFailure` — dieselben
     drei Payloads wie heute `:803-808`, `:815-819`, `:833`. `#fail(...)` und
     `fetchedAtlasJsonSignal.set(...)` stehen **hinter** dem `try`/`catch`. Grund: der Setter von
     `fetchedAtlasJsonSignal` treibt synchron Atlas-Image-, `imageUrl`- und Atlas-Parse-Effekt
     an, und liegt das Bild der Json schon vor, wird der Atlas in diesem Aufruf veröffentlicht;
     ein Subscriber von `atlas`, der dabei wirft, landet heute im `catch` `:831-834` und wird als
     `#fail('atlasFetch', …)` ein Record, der alle Subtypes zurückhält, obwohl der Fetch gelungen
     ist.
   - Ein `finally` am `try` gibt das Feld frei: `if (this.#atlasFetch === ac) this.#atlasFetch = undefined;`
   - Der Wurf aus `fetchedAtlasJsonSignal.set(json)` wird gefangen und als Event gemeldet, ohne
     Record: `emit(this, OnError, {source: 'texture', id: this.id, error})`.
   - Die Cleanup-Funktion: `ac.abort(); if (this.#atlasFetch === ac) this.#atlasFetch = undefined;`

   Skizze (Kommentare im Stil der Datei ausformulieren, `result` darf anders heißen):

   ```ts
   (async () => {
     let result: {json: AtlasJsonResponse} | {failure: TextureResourceLoadFailure};
     try {
       const response = await fetch(atlasUrl, {signal: ac.signal});
       if (ac.signal.aborted) return;
       if (!response.ok) {
         result = {failure: {source: 'atlas', url: atlasUrl, status: response.status, error: new Error(/* wie :807 */)}};
       } else {
         const atlasJson = await response.json();
         if (ac.signal.aborted) return;
         result = isAtlasJsonResponse(atlasJson)
           ? {json: /* meta.image aufgelöst wie :825-830 */}
           : {failure: {source: 'atlas', url: atlasUrl, error: new Error(/* wie :818 */)}};
       }
     } catch (error) {
       if (ac.signal.aborted) return;
       result = {failure: {source: 'atlas', url: atlasUrl, error}};
     } finally {
       if (this.#atlasFetch === ac) this.#atlasFetch = undefined;
     }
     if ('failure' in result) {
       this.#fail('atlasFetch', result.failure);
       return;
     }
     try {
       fetchedAtlasJsonSignal.set(result.json);
     } catch (error) {
       emit(this, OnError, {source: 'texture', id: this.id, error});
     }
   })();
   ```

3. **`atlasJson`-Setter** `:383-393`: vor `this.#fetchedAtlasJson?.set(undefined)` den laufenden
   Fetch abbrechen — `this.#atlasFetch?.abort(); this.#atlasFetch = undefined;` — mit einem
   Kommentar: ein Fetch von `atlasUrl`, der noch läuft, würde nach seiner Ankunft die hier
   geschriebene Json ersetzen (über `#fetchedAtlasJson` und den Atlas-Image-Effekt `:870`), und
   sein Scheitern hielte zurück, was diese Json bringt. Die übrigen Zeilen des Setters bleiben.
   TSDoc des Setters `:366-378`, der Satz »A json written from outside replaces the fetched one,
   and a fetch of `atlasUrl` that failed along with it; it has no url of its own …« wird zu:

   > A json written from outside replaces the fetched one and a fetch of `atlasUrl` that failed,
   > and it cuts short a fetch that is still under way: neither the json nor a failure of that
   > fetch arrives after the write. It has no url of its own and keeps its `meta.image` as
   > written, and the image loader resolves a relative one against the document.

4. **Bild-Effekt** `:601-670`, der `.then(...)`-Zweig `:618-642` und der `.catch` `:650-659`:
   - Im Erfolgs-Handler nach `if (aborted) return;` zuerst `const coords = new TextureCoords(0, 0,
     image.width, image.height)`, dann `factory.create(image, ...(classes ?? []))` — beides in
     einem `try`, dessen `catch` `this.#fail('image', {source: 'texture', id: this.id, error})`
     meldet und zurückkehrt. Die Koordinaten zuerst, damit ein Wurf dort keine erzeugte Texture
     zurücklässt, die niemand freigibt (Paket 4 schneidet `TextureCoords` neu). Im `batch()`
     stehen danach nur noch die drei `set()`-Aufrufe (`#imageUrlOfCoords`, `#imageCoords` mit
     `coords`, `#texture`).
   - Um den `batch()` ein `try`/`catch`/`finally`: der `finally` gibt wie heute `previous` frei;
     der `catch` hält den Wurf fest, und **nach** dem `finally` geht er als
     `emit(this, OnError, {source: 'texture', id: this.id, error})` hinaus — ohne Record und ohne
     `aborted`-Prüfung: alle Werte sind veröffentlicht, jeder Subscriber hat sie gehört, der
     Schritt hat sein Ergebnis. Der Kommentar `:651-656` (signalize reicht den Wurf an den
     Schreiber, hier den `batch()`) wandert an diesen `catch`.
   - Der abschließende `.catch` `:650-659` entfällt. Was danach noch aus einem der beiden
     Handler wirft, ist allein ein `error`-Listener, der selbst wirft — kein Scheitern des
     Schritts; `#fail` darf dafür nie laufen (heute überschriebe er den `image`-Record eines
     gescheiterten Ladens mit einem `source: 'texture'`). Der Ablehnungs-Handler `:643-648`
     bleibt, wie er ist.
   - `let texture` `:611` wird im Erfolgs-Handler lokal, falls es außerhalb nicht mehr gelesen
     wird.
   - Kommentar an `#fail` `:538-542` (oder an `#loadFailures` `:487-489`) ergänzen: hier landet
     nur ein Schritt, der ohne sein Ergebnis endet; ein Subscriber, der beim Veröffentlichen
     eines Ergebnisses wirft, ist kein Scheitern des Schritts.

5. **Die Bridges `publish` `:578-586`** dispatchen mit `emitStrict()` statt `emit()`
   (Import in `:1` ergänzen). Grund: mit `emit()` bricht ein werfender Subscriber die übrige
   Zustellung ab, und eventize schreibt den retained Wert dieses Emits nicht (Skill
   `using-eventize`, Pitfall 5). Ohne Record hinge ein `TextureStore#get()`, dessen Listener
   hinter dem werfenden sitzt oder der erst danach fragt, für immer; bei einem Nachfolger
   bekäme ein später Subscriber sogar die Vorgänger-Texture aus dem retained Event, die der
   Bild-Effekt direkt nach dem `batch()` freigibt. `emitStrict()` ruft jeden Subscriber, schreibt
   den retained Wert und wirft danach — ein Fehler unverändert, mehrere als `AggregateError`.
   Die Library nutzt `emitStrict()` bereits so (`src/display/Display.ts:1028,1047,1626`,
   `DisplayStateMachine.ts:123,149,154`, `docs/resource-lifecycle.md:211`). Kurzer Kommentar an
   der Bridge: jeder Subscriber hört den Wert, und das retained Event nimmt ihn, auch hinter
   einem, der wirft; der Wurf geht danach an den Schreiber weiter. Der `retainClear`-Zweig
   bleibt.

6. **Tile-Set-Effekt** `:698-701`: `tileSetSignal.set(tileSet)` und
   `tileSetAtlasSignal.set(tileSet.atlas)` in einen `batch()`. Grund: ein Subscriber von
   `tileSet`, der wirft, lässt `set()` werfen, und die zweite Zeile liefe nie — die Resource
   behielte den Atlas des vorigen Tile Sets oder gar keinen. Die Verengung von `tileSet` reicht
   nicht in die Closure; vorher an eine `const` binden.

7. **Tests** (vor dem Fix rot, Namen wörtlich übernehmen):

   `TextureResource.spec.ts`, im `describe('atlas fetch')` hinter dem Test »an atlasUrl that
   changes while its fetch is in flight …« `:834-876`:
   - `an atlasJson written while the fetch is in flight aborts that fetch` — mit
     `stubAbortableFetch()` `:806-816`; nach `load()` und dem Write ist
     `calls[0]!.signal.aborted` `true`, nach dem Flushen `resource.atlasJson` die geschriebene
     Json und kein `error`.
   - `a fetch that answers after an atlasJson was written leaves the written json in place` —
     ein `fetch`-Mock, der das Signal **nicht** beachtet und erst auf Zuruf antwortet
     (`mockImplementation(() => new Promise((resolve) => { answer = resolve; }))`); Json mit
     `meta.image: 'own.png'` schreiben, dann mit einer Json antworten, die `fetched.png` nennt,
     drei Mal flushen: `resource.atlasJson` ist die geschriebene, `resource.imageUrl` ist
     `'own.png'`, `errors` ist leer. Dieser Mock prüft die `aborted`-Wache, nicht nur den
     Abbruch.
   - `a fetch that fails after an atlasJson was written reports nothing` — derselbe Mock,
     Antwort `new Response('{}', {status: 404})`: `errors` bleibt leer.
   - `a subscriber of the atlas that throws while a fetched json is published is no failure of the fetch`
     — Atlas-Resource auf `first.json` (Json mit `meta.image: 'atlas.png'`, Frame `a`), laden
     bis der Atlas steht; dann `on(resource, 'atlas', …)` mit einem Listener, der nur für einen
     Atlas mit dem Frame `b` wirft (der retained Replay beim Abonnieren wirft so nicht);
     `resource.atlasUrl = 'second.json'` (dieselbe `meta.image`, Frame `b`) — das Bild liegt
     schon vor, also wird der Atlas im Aufruf von `fetchedAtlasJsonSignal.set` veröffentlicht.
     Erwartet: `errors` gleicht `[{source: 'texture', id: <id>}]` (`toMatchObject`), keiner mit
     `source: 'atlas'`, und `resource.atlas!.frameNames()` ist `['b']`.

   `TextureResource.spec.ts`, neues `describe('a subscriber that throws keeps no value from the others')`
   hinter `describe('texture ownership')`:
   - `a subscriber of the texture that throws leaves the texture to every other subscriber and to the retained event`
     — Bild-Resource, zuerst ein werfender `texture`-Listener, dann ein `vi.fn()`; nach dem Laden
     ist der zweite mit der Texture gerufen, und ein danach angelegter `on(resource, 'texture',
     late)` bekommt sie aus dem retained Event.
   - `a subscriber of the tile set that throws leaves the atlas of that tile set on the resource`
     — Tile-Set-Resource, werfender `tileSet`-Listener, `error`-Listener sammelt; nach dem Laden
     ist `resource.atlas` gleich `resource.tileSet!.atlas`, und genau ein `error` mit
     `source: 'texture'`.

   `TextureStore.spec.ts`, im `describe('get() gives up on a resource that cannot deliver')`
   hinter »a get() after an atlasJson written over a failed fetch waits for the atlas«
   `:1739-1771`:
   - `a get() after an atlasJson written over a fetch still in flight is not rejected when that fetch fails`
     — `fetch`-Mock wie oben (antwortet auf Zuruf, beachtet das Signal nicht), Bild-Load auf
     Zuruf wie im Nachbartest; `store.get('a', 'atlas')` startet über `on()` → `load()` den Fetch;
     Json schreiben, mit 404 antworten, flushen, dann das Bild liefern: `settleWithin(...)` löst
     mit `resource.atlas` auf.
   - `a subscriber that throws holds no get() back` — Bild-Item; zuerst
     `store.on('a', 'texture', () => { throw … })`, dann `const pending = store.get('a', 'texture')`,
     flushen, dann `const late = store.get('a', 'texture')`: beide lösen mit
     `(await store.whenResource('a')).texture` auf.

   Die bestehenden Tests `a subscriber of the texture that throws leaves the texture to the
   resource` `:121-143` und `a texture published by a batch that threw is released by its
   successor` `:145-168` bleiben unverändert grün; läuft einer rot, ist das ein Befund, kein
   Anlass, ihn anzupassen.

8. **TSDoc `TextureResourceEvents`** `TextureResource.ts:73-100`: hinter dem Satz zu
   `{source: 'texture', id, error}` ergänzen, sinngemäß:

   > A subscriber of `imageCoords`, `atlas`, `tileSet`, `texture` or `frameBasedAnimations` that
   > throws keeps the value from no one: every other subscriber is called and the retained value
   > is written before the throw goes on. A throw raised while the resource publishes what it
   > loaded — its image, its atlas json and what is built from them — is reported with the same
   > `{source: 'texture', id, error}`; the value stays published, and `TextureStore#get()` does
   > not reject on it.

9. **TSDoc `TextureStore#get()`** `TextureStore.ts:795-804`: »… or an `atlasJson` written to the
   resource takes the place of one that could not be fetched.« wird zu »… takes the place of one
   that could not be fetched or is still being fetched.«, und »An animation entry that is
   skipped does not reject.« wird zu »An animation entry that is skipped does not reject, and
   neither does a subscriber of the resource that throws: the value it was handed is there.«

10. **CHANGELOG** `packages/twopoint5d/CHANGELOG.md`, `[Unreleased]` (die betroffenen Einträge
    stammen aus diesem Zyklus und werden ergänzt, nicht dupliziert):
    - `### Fixed` `:375` (`fix TextureStore#get() for a resource that cannot deliver`): »… or
      until an `atlasJson` written to the resource takes the place of one that could not be
      fetched« → »… that could not be fetched or is still being fetched«; »a skipped animation
      entry rejects nothing« → »a skipped animation entry and a subscriber that throws reject
      nothing«.
    - `### Fixed`, neuer Eintrag bei `:330`: `TextureResource` ruft jeden Subscriber eines
      Wert-Events und schreibt den retained Wert, auch hinter einem, der wirft; der Wurf geht
      danach weiter, ein Tile Set und sein Atlas werden zusammen veröffentlicht, und ein Wurf
      beim Veröffentlichen dessen, was die Resource geladen hat, kommt als `error` mit
      `source: 'texture'`.
    - `### Fixed`, neuer Eintrag: ein `atlasJson`, das geschrieben wird, während der Fetch von
      `atlasUrl` läuft, bricht diesen Fetch ab; weder dessen Json noch dessen Scheitern kommt
      nach dem Write an.
    - `### Added` `:33` (`'texture'` als `source`): um den werfenden Subscriber ergänzen.
    - Kein Migrationsabschnitt: keine Signatur, kein Export ändert sich.

- Verify: `pnpm run ci` (schneller Zwischenlauf:
  `pnpm nx test twopoint5d -- src/texture/TextureResource.spec.ts src/texture/TextureStore.spec.ts`)
- Commit: `fix(texture): let an atlasJson written from outside cut the atlas fetch under way short, keep a load failure on record only for a step that ends without a result so that a subscriber that throws holds no TextureStore#get() back, hand every value event of a TextureResource to every subscriber and keep its retained value current behind one that throws, and publish a tile set and its atlas in one batch`
- Für `Schnittstellen:` nach dem Commit: die Bridges dispatchen mit `emitStrict()`; der
  Tile-Set-Effekt schreibt Tile Set und Atlas in einem `batch()`; `#atlasFetch` (privat) ist der
  laufende Atlas-Fetch, der Setter von `atlasJson` bricht ihn ab; im Fetch- und im Bild-Effekt
  stehen `#fail` und das Veröffentlichen hinter dem `try`, ein Wurf beim Veröffentlichen geht
  als `error` mit `source: 'texture'` ohne Record hinaus — Paket 5 übernimmt das in seine
  Registrierer pro Shape.
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · Folge 1 (Setter bricht Fetch nicht ab) unverändert,
    nach `TextureResource.ts:383-393` / `:803,815,833` gewandert · Nebenbefund »spät gelingender
    Fetch überschreibt« unverändert, jetzt `:826` / `:870` · Folge 2 (`.catch` des Bild-Effekts)
    unverändert, jetzt `:650-659` · neu aufgenommen: Fetch-Effekt `:826-834` (Folge von Paket 2,
    Symptom), Bridges `:578-586` und Tile-Set-Effekt `:698-701` (vorbestehend an `fceda80b`,
    gleiche Ursache) · neuer Nebenbefund `atlasJson` vor `load()` → »Offene Befunde« (→ Scope) ·
    keine offenen `Folgen:` zu verteilen (Paket 3: keine) · Restplan unverändert
  - 2026-09-26 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-8.impl-0.json`
  - 2026-09-26 Zug 2: Report FERTIG · geändert `TextureResource.ts`, `TextureStore.ts`, beide Specs, CHANGELOG · 8 Regressionstests vor dem Fix rot · Arbeitsbaum schmutzig · Verify `pnpm run ci` (ohne Nx-Cache) exit=0, `paket-8.verify.log`
  - 2026-09-26 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-8.diff`
  - 2026-09-26 Zug 3: Urteil — alle sechs Stellen behoben, Tests aus dem richtigen Grund grün, 4 × klein, nichts kritisch/wichtig · Report `paket-8.review-0.json`
  - 2026-09-26 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-26 Zug 5: committet `d6022aa4`, Verify `paket-8.verify.log` exit=0 (ohne Nx-Cache)

## Abgleich

Gegen HEAD `62c99ce1` (Paket 3 hat die Datei seit `724df0eb` umgebaut; die Zeilen im Plan-Block
waren gegen `724df0eb`).

- **Folge 1 von Paket 2 — der Setter bricht den Fetch nicht ab:** unverändert, verschoben. Der
  Setter `TextureResource.ts:383-393` räumt `#fetchedAtlasJson` und den `atlasFetch`-Record und
  lässt den Fetch laufen; sein `AbortController` ist lokal im Effektlauf `:793` und wird nur von
  der Cleanup `:836-839` (neues `atlasUrl`, `dispose()`) abgebrochen. Ein danach scheiternder
  Fetch schreibt über `#fail('atlasFetch', …)` `:803`, `:815`, `:833` den Record neu, der
  `ALL_SUBTYPES` zurückhält (`:157`); ein `get(id, 'atlas')` in diesem Fenster rejectet. Die
  `get()`-TSDoc steht jetzt `TextureStore.ts:795-804`.
- **Nebenbefund »spät gelingender Fetch überschreibt die geschriebene Json«:** unverändert,
  verschoben. `fetchedAtlasJsonSignal.set(...)` `:826-830`, der Atlas-Image-Effekt schreibt
  `atlasJsonSignal.set(...)` `:870` über die Json von außen, gegen die Setter-TSDoc `:370-371`.
  Vorbestehend: an `fceda80b` ohne Abbruch ebenso (`fceda80b:…/TextureResource.ts:338-345`).
- **Folge 2 von Paket 2 — der `.catch` des Bild-Effekts:** unverändert, verschoben nach
  `:650-659`; er meldet jeden Wurf aus dem Erfolgs-Handler, einen Subscriber-Wurf aus dem
  `batch()` `:634-638` eingeschlossen, als `#fail('image', {source: 'texture', …})`. An
  `fceda80b` nur ein Event (`fceda80b:…/TextureResource.ts:580-589`).
- **Neu in Zug 0, dritte Stelle derselben Folge (Symptom, Folge von Paket 2):** im Fetch-Effekt
  steht `fetchedAtlasJsonSignal.set(...)` `:826-830` im selben `try` wie der Fetch. Liegt das
  Bild der Json schon vor (neues `atlasUrl`, dieselbe `meta.image`), veröffentlicht dieser Aufruf
  synchron den Atlas; ein werfender `atlas`-Subscriber landet im `catch` `:831-834` als
  `#fail('atlasFetch', …)` — ein Record für einen gelungenen Fetch, der alle Subtypes
  zurückhält. An `fceda80b` nur ein Event mit `source: 'atlas'` (`fceda80b:…/TextureResource.ts:735-739`).
- **Neu in Zug 0, vorbestehend, gleiche Ursache — die Bridges:** `publish` `:578-586` dispatcht
  mit `emit()` `:583`. Ein werfender Subscriber bricht die Zustellung an die übrigen ab, und der
  retained Wert dieses Emits wird nicht geschrieben (eventize, Pitfall 5). Mit dem Record aus
  Paket 2 wird daraus ein rejectetes `get()`, ohne Record ein hängendes; bei einem Nachfolger
  hält das retained Event die Vorgänger-Texture, die `:640` direkt danach freigibt. Vorbestehend:
  `fceda80b:…/TextureResource.ts:510-518`. Ohne diesen Teil kippte Schritt 4 ein Rejecten in ein
  Hängen — deshalb im Paket und nicht in der Queue.
- **Neu in Zug 0, vorbestehend, gleiche Ursache — der Tile-Set-Effekt:** `:698-701` schreibt
  Tile Set und Atlas nacheinander; ein werfender `tileSet`-Subscriber lässt den ersten `set()`
  werfen, der Atlas wird nie geschrieben. Vorbestehend: `fceda80b:…/TextureResource.ts:627-630`.

## Triage

- `Folgen:` der erledigten Pakete: Paket 1 → Paket 7 (Zug 0 von Paket 2), Paket 2 → dieses Paket
  (Zug 0 von Paket 3), Paket 3 → keine. Nichts neu zu verteilen.
- »Offene Befunde«, gleiche Ursache wie dieses Paket: nur `TextureResource.ts:799,838` (schon
  zugeteilt). Die übrigen haben andere Ursachen — `onResource()`-TSDoc, Resource-Test in der
  Store-Spec, Spec-Kommentar `:420`, `printWidth`, Präfix in `FrameBasedAnimations`,
  `textures.json`, `TileSet#frame()`, `TextureAtlasLoader`-Meldungen — und bleiben liegen.
- **Neuer Nebenbefund, nicht aufgenommen:** ein `atlasJson`, das vor `load()` geschrieben wird,
  greift nicht. Die Effekte, die es lesen — `imageUrl` aus der Json `:876-886`, Atlas-Parse
  `:888-928` —, haben statische Deps und laufen bei der Registrierung nicht (signalize, Pitfall
  7); `load()` stößt mit `touch(atlasUrlSignal)` `:965` nur den Fetch an, dessen Json die
  geschriebene danach ersetzt, und ohne `atlasUrl` geschieht gar nichts. Vorbestehend an
  `fceda80b` (`:787`, `:828`, `:867`). Andere Ursache als dieses Paket (der Fetch läuft beim
  Write noch gar nicht; es fehlt der erste Lauf der Json-Effekte in `load()`), deshalb in
  »Offene Befunde«, `→ Scope`, low. Er liegt in der Registrierung, die Paket 5 zerlegt — dessen
  Zug 0 triagiert ihn.

## Entscheidungen dieses Zugs

- **Der Wurf eines Subscribers wird weiter als `error` mit `source: 'texture'` und `id`
  gemeldet**, nur ohne Record. So war es an `fceda80b`, und der bestehende Test `:121-143`
  verlangt genau diese Payload; eine neue `source` wäre eine Änderung der öffentlichen
  Event-Payload, die kein Finding verlangt.
- **`emitStrict()` in den Bridges** statt eines `try`/`catch` pro Listener: die Library hat den
  Weg für Events, die jeder Listener hören muss, schon gewählt (`Display`,
  `DisplayStateMachine`, `docs/resource-lifecycle.md`); die prozessweite Mehrkost guarded
  Dispatches (Skill `using-eventize`, »What each one costs«) zahlt jede Anwendung mit einem
  `Display` ohnehin.
- **Der abschließende `.catch` des Bild-Effekts entfällt**, statt ihn auf ein Event ohne Record
  umzustellen: was dort noch ankäme, ist nur ein werfender `error`-Listener, und ein Event an
  dieselben Listener würfe erneut.
- **Abbruch über ein Feld `#atlasFetch`** statt über ein Signal, das den Fetch-Effekt neu
  anstößt: ein erneuter Lauf holte `atlasUrl` noch einmal und ersetzte die geschriebene Json.
- Von der Empfehlung des Reviewers von Paket 2 weicht nichts ab; seine beiden Tests stehen in
  Schritt 7 als »a get() after an atlasJson written over a fetch still in flight is not rejected
  when that fetch fails« und »a fetch that answers after an atlasJson was written leaves the
  written json in place«.
- Die Schritte 2 (Fetch-Effekt) und 5–6 (Bridges, Tile-Set-Effekt) gehen über den Plan-Block
  hinaus. Sie haben dieselbe Ursache — ein Wurf beim Veröffentlichen eines Ergebnisses wird als
  Scheitern eines Ladeschritts behandelt oder hält einen Wert zurück —, und ohne Schritt 5 machte
  das Streichen des Records aus einem rejecteten `get()` ein hängendes.

## Findings im Volltext

**Folge 1 von Paket 2 · `packages/twopoint5d/src/texture/TextureResource.ts:779,791,802` (gegen
`724df0eb`)** — Ein Atlas-Fetch, der beim Schreiben von `atlasJson` noch läuft und erst danach
scheitert, legt über `#fail('atlasFetch', …)` erneut einen Record an; ein `get(id, 'atlas')` im
Fenster, bevor Atlas und Texture da sind, rejectet dann zu Unrecht, und der Satz der
`get()`-TSDoc `TextureStore.ts:697-699` (»an `atlasJson` … takes the place of one that could not
be fetched«) sagt dafür zu viel. Dieselbe Ursache wie der vorbestehende Nebenbefund
`TextureResource.ts:799,838` (spät gelingender Fetch überschreibt eine von außen geschriebene
Json): der `atlasJson`-Setter (`:374-383`) bricht den laufenden Fetch nicht ab. Vorschlag des
Reviewers: der Setter bricht den Fetch ab, mit zwei Tests (ein nach dem Write scheiternder Fetch
rejectet kein `get()`; ein nach dem Write gelingender Fetch ersetzt die geschriebene Json nicht).

**Folge 2 von Paket 2 · `packages/twopoint5d/src/texture/TextureResource.ts:650` (gegen
`724df0eb`)** — Der `.catch` des Image-Effekts trägt auch den Wurf eines Subscribers, der aus dem
`batch()` zurückkommt, als `#fail('image', {source: 'texture', …})` ein; der Record hält danach
alle Subtypes zurück, obwohl Texture und Koordinaten veröffentlicht sind, bis der Image-Schritt
wieder läuft.

**Nebenbefund aus »Offene Befunde« · `packages/twopoint5d/src/texture/TextureResource.ts:799,838`
(gegen `724df0eb`)** — Ein Atlas-Fetch, der beim Schreiben von `atlasJson` noch läuft, wird
nicht abgebrochen; gelingt er danach, überschreibt der Bild-Effekt die von außen geschriebene
Json, gegen die TSDoc des Setters (»A json written from outside replaces the fetched one«) ·
vorbestehend (`dff733ff:…/TextureResource.ts:328,341`) · low.

**Triage in Zug 0 von Paket 3** — beide Folgen sind Symptome derselben Ursache: der Record steht
für etwas, das kein ladeabschließender Fehler des laufenden Schritts ist.

## Anmerkungen des Reviewers

Urteil je Befund (Reviewer Runde 0, gegen den Arbeitsbaum vor `d6022aa4`):

- Folge 1 von Paket 2 (Setter bricht Fetch nicht ab, scheiternder Fetch rejectet `get()`): behoben — Setter `TextureResource.ts:395-396`, Feld `#atlasFetch` `:507`, Wache `ac.signal.aborted` `:835,855,877`; Tests `TextureResource.spec.ts:940,1003`, `TextureStore.spec.ts:1773`
- Folge 2 von Paket 2 (`.catch` des Bild-Effekts): behoben — `.catch` entfällt, `create` über `#fail` `:645-652`, Wurf aus dem `batch()` als Event ohne Record `:659-683`; Test `TextureStore.spec.ts:1812`
- Nebenbefund spät gelingender Fetch: behoben — Abbruch plus Wache vor `fetchedAtlasJsonSignal.set` `:855,888`; Test `TextureResource.spec.ts:974`
- Fetch-Effekt veröffentlicht im `try`: behoben — `try` `:840-882`, `#fail` `:883-886`, Veröffentlichen `:887-893`; Test `TextureResource.spec.ts:1023`
- Bridges mit `emit()`: behoben — `emitStrict()` `:603`; Test `TextureResource.spec.ts:195-222`
- Tile-Set-Effekt ohne `batch()`: behoben — `:730-737`; Test `TextureResource.spec.ts:225`

Kleine Befunde (nicht behoben, keine Runde):

1. `TextureResource.ts:636-637` — der Kommentar sagt, was aus den Handlern noch wirft, komme nur von einem werfenden `error`-Listener; auch `previous?.dispose()` im `finally` `:679` kann werfen (Dispose-Listener von three) und verdrängt dann den festgehaltenen Wurf.
2. `TextureResource.ts:883-893`, `:681-683` — `#fail` und `emit(OnError)` stehen außerhalb jedes `try`; dem Fetch-Effekt fehlt der Hinweis, den der Bild-Effekt `:636` trägt.
3. `TextureResource.spec.ts:1023-1065` — der Test prüft nur die `source`, nicht das Fehlen des Records; ein `#fail('atlasFetch', {source: 'texture'})` wäre ebenfalls grün.
4. `CHANGELOG.md:329` — »and the throw goes on afterwards« sagt nicht, wohin (an den Schreiber des Werts).
