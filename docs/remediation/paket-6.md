# Paket 6 — API-Linie des Moduls: sprechende Namen, AbortSignal, Callback-Loader deprecated

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-019 (acknowledged), API-020 (acknowledged), API-023 (acknowledged),
  ASYNC-003 (low, Optimierungspotenzial), ARCH-005 (medium, anteilig — die Library-Seite:
  Loader `@deprecated`, der Absatz über beide Wege; die Lookbook-Seite ist Paket 10, und
  erst mit ihm ist ARCH-005 geschlossen)
- Ziel: Das texture-Modul zeigt einen Lade-Weg mit sprechenden Methodennamen und Abbruch
  per `AbortSignal` — `TextureResource#activate()`, `TextureStore#loadAsync()` und
  `TextureStore.loadAsync()`, `TextureStore#getAsync()`, `anisotropy` —; die alten Namen
  und die vier Callback-Loader bleiben als `@deprecated` erreichbar, und `dispose()` bricht
  einen laufenden Katalog-Fetch ab.
- Modell: stärkste Stufe (öffentliche API neu geschnitten, Abbruch- und Dispose-Semantik
  eines laufenden Ladevorgangs)
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/texture/TextureStore.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts`
  - `packages/twopoint5d/src/texture/TextureFactory.ts`
  - `packages/twopoint5d/src/texture/internals.ts` (nur Kommentare)
  - `packages/twopoint5d/src/texture/PowerOf2ImageLoader.ts`, `TextureImageLoader.ts`,
    `TextureAtlasLoader.ts`, `TileSetLoader.ts` (nur TSDoc)
  - Specs: `TextureStore.spec.ts`, `TextureResource.spec.ts`, `TextureFactory.spec.ts`
  - Browser-Tests: `packages/twopoint5d-testing/test/texture-store-on.test.js`,
    `packages/twopoint5d-testing/test/texture-factory-anisotropy.test.js`
  - `packages/twopoint5d/docs/architecture.md` (Abschnitt `### texture/`)
  - `packages/twopoint5d/CHANGELOG.md`
  - **Nicht** in diesem Paket: alles unter `apps/lookbook/` — das ist Paket 10. Die
    Lookbook-Stellen rufen danach weiter die alten Namen auf; die Aliase halten sie
    compilierbar und lauffähig.

## Entscheidungen aus Zug 0

Die Entscheidung vom 2026-09-26 im Plan (»Acknowledged Umbenennungen …«) lässt die genauen
Namen Zug 0. Sie lauten:

| alt | neu | der alte Name |
| --- | --- | --- |
| `TextureResource#load(): TextureResource` | `TextureResource#activate(): TextureResource` | `@deprecated`, ruft `activate()` |
| `TextureStore#load(url, options?)` — löst immer auf | `TextureStore#loadAsync(url, options?: TextureStoreLoadOptions): Promise<this>` — rejectet | `@deprecated`, behält seinen Vertrag: `this.loadAsync(url, options).then(() => this, () => this)` |
| `static TextureStore.load(url)` | `static TextureStore.loadAsync(url, options?: TextureStoreLoadOptions): Promise<TextureStore>` | `@deprecated`, Signatur `(url: string \| URL)` wie heute, ruft `TextureStore.loadAsync(url)` |
| `TextureStore#get(id, type, options?)` | `TextureStore#getAsync(id, type, options?: {signal?: AbortSignal})` | `@deprecated`, derselbe Vertrag, Meldungen nennen `get(…)` |
| `TextureOptions#anisotrophy` | `TextureOptions#anisotropy` | `anisotrophy?: number`, `@deprecated` |
| Klassen `anisotrophy`, `anisotrophy-2`, `anisotrophy-4`, `no-anisotrophy` | `anisotropy`, `anisotropy-2`, `anisotropy-4`, `no-anisotropy` | die alten vier bleiben Teil von `TextureOptionClasses` |

Gründe, je ein Satz:

- **`activate()`** — die Methode lädt nichts, sie registriert die Effekte der Resource; so
  stand es in der Empfehlung des Audits.
- **`loadAsync` für beide Store-Methoden, und die Instanz-Methode rejectet.** Im Modul heißt
  `loadAsync` durchgehend »Promise, das bei einem Fehlschlag rejectet« (`TextureFactory`, alle
  Loader, three.js); die Instanz-Methode bekommt diesen Vertrag, damit ein Aufrufer
  `await store.loadAsync(url)` schreiben kann und ein gescheiterter Katalog-Fetch nicht
  still in einem ewig wartenden `getAsync()` endet — und damit ein Abbruch per `signal`
  überhaupt einen Ort hat, an dem er ankommt. Statisch und Instanz teilen den Namen, weil sie
  denselben Vertrag teilen; die statische Form zählt zusätzlich jeden gemeldeten Fehler des
  Versuchs als Fehlschlag, weil vor ihrem Aufruf niemand am `error`-Event des Stores hängen
  konnte, den sie erst baut.
- **Der Alias `TextureStore#load()` behält »rejectet nie«.** Nicht brechend heißt: wer heute
  `store.load(url)` ohne `catch` aufruft, bekommt keine unbehandelte Rejection.
- **Meldungen von `getAsync()`/`get()` nennen die aufgerufene Methode**, damit ein Aufrufer
  die Meldung zu seiner Zeile findet — ein privater Helfer bekommt den Namen als Parameter.
- **`anisotropy` zählt wie three.js ab 1.** Der Schlüssel heißt nach der Umbenennung wie
  `Texture#anisotropy`; trüge er die Zählung ab 0 weiter, schriebe ein
  `Object.assign(texture, factory.getOptions(…))` eine 0 in die Texture, die three beim
  Sampler zurückweist. Der Alias `anisotrophy` behält seine Zählung ab 0.
- **Die Loader bekommen kein `signal`.** Sie werden in diesem Paket `@deprecated`
  (Entscheidung »Zwei Lade-Stacks« vom 2026-09-26); ASYNC-003 wird auf dem Weg geschlossen,
  der bleibt — `loadAsync()` beider Formen und `dispose()` —, zusammen mit dem `signal`, das
  `getAsync()` schon trägt. Der Teil der Empfehlung »bei Abort eine bereits gebaute Texture
  disposen« betrifft nur Loader-Texturen: eine Texture des Stores gehört der Resource und wird
  von ihr freigegeben.
- **Die Lookbook-Seite von ARCH-005 ist Paket 10.** Neun Demo-Stellen mit eigener
  Renderer-Reihenfolge und Sichtprüfung im Browser neben einer API mit ~120 umbenannten
  Aufrufstellen in den Specs sind zwei Aufträge; Paket 10 baut auf den Namen von hier auf.

## Vorgehen

Vorab: `AGENTS.md` im Repo-Root lesen, dazu die Skills `using-eventize`, `using-signalize` und
vor dem CHANGELOG `updating-changelog`. Das Modul ganz lesen (`cat src/texture/*.ts`), nicht
per grep zusammensetzen.

### 1. `TextureResource#activate()` (API-019, Teil 1)

1. Die heutige `load()` (`TextureResource.ts:598-666`) heißt `activate(): TextureResource`,
   Rumpf unverändert. Das private Feld `#load` (`:518`) heißt `#activated`.
2. Neu direkt darunter:

   ```ts
   /**
    * @deprecated Use {@link TextureResource.activate}: it registers the effects of this resource
    *   and loads nothing by itself. The old name stays as an alias until a breaking release
    *   removes it.
    */
   load(): TextureResource {
     return this.activate();
   }
   ```

3. Jede Erwähnung der Methode in TSDoc und Kommentaren von `TextureResource.ts` nennt
   `activate()`: Klassen-TSDoc `:206`, `atlasJson`-TSDoc `:382`, Konstruktor-TSDoc `:524`,
   `dispose()`-TSDoc `:557`, die TSDoc der Methode selbst `:608-610` (der Satz über »the two
   `TextureStore` methods of the same name« wird: `TextureStore#loadAsync()` fetches a catalog
   and builds its resources), die Kommentare `:513-516` (`#atlasFetchDue`), `:669-673`
   (`#registerImageEffect`), `:1037`.
4. `TextureStore#on()` ruft `resource.activate()` (`TextureStore.ts:729`).

### 2. `TextureStore#loadAsync()`, `TextureStore.loadAsync()` und `AbortSignal` (API-019 Teil 2, ASYNC-003)

1. Neue exportierte Schnittstelle in `TextureStore.ts`, direkt unter `TextureStoreParseOptions`:

   ```ts
   export interface TextureStoreLoadOptions extends TextureStoreParseOptions {
     /** … */
     signal?: AbortSignal;
   }
   ```

   TSDoc von `signal`: cuts the load short — the fetch is aborted, nothing is parsed, and the
   promise rejects with an `AbortError`; a signal that aborts once the data is parsed changes
   nothing.
2. Ein privates `AbortController` für die Lebensdauer des Stores (Name frei, z. B.
   `#disposal`). `dispose()` bricht es ab, nachdem das `dispose`-Event hinaus ist und bevor die
   Resources freigegeben werden. Vertrag: sobald `dispose()` zurückkehrt, läuft kein
   Katalog-Fetch des Stores mehr, und jedes wartende `loadAsync()` ist rejectet.
3. **`loadAsync(url: string | URL, options?: TextureStoreLoadOptions): Promise<this>`** — der
   Rumpf der heutigen Instanz-`load()` (`:407-443`), mit diesem Vertrag:
   - Store schon disposed → rejectet sofort mit `disposedError(\`loadAsync(${String(url)})\`)`,
     fetcht nichts.
   - `signal` schon abgebrochen → rejectet sofort mit
     `new DOMException(\`loadAsync(${String(url)}) aborted\`, 'AbortError')`, fetcht nichts,
     legt keinen Listener auf `signal`.
   - Der Fetch bekommt ein Signal, das abbricht, sobald der Aufrufer-`signal` oder der Store
     (`dispose()`) abbricht. Nach jedem `await` (Fetch, `response.json()`) wird geprüft, ob
     abgebrochen wurde — ein gemockter `Response#json()` kennt kein Signal; ein abgebrochener
     Versuch parst nie.
   - Abbruch durch den Aufrufer → rejectet mit der `AbortError`-`DOMException` oben, **kein**
     `error`-Event. Abbruch durch `dispose()` → rejectet mit
     `disposedError(\`loadAsync(${String(url)})\`)`, kein Event.
   - Fetch wirft, Antwort mit Status, Body kein JSON, `parse()` wirft: das `error`-Event geht
     hinaus wie heute (`source`, `url`, bei Status `status`), **und** das Promise rejectet mit
     `loadFailedError(source, url, error)` — derselben Meldung, mit der die statische Form
     heute rejectet (`[TextureStore] load failed at the <source> step: "<url>"`, `cause` = der
     gemeldete Fehler).
   - Ein Item, das keine Resource baut, und ein unbekannter Klassenname sind wie heute nur
     `error`-Events; `loadAsync()` löst trotzdem auf.
   - Löst mit `this` auf, sobald `parse()` auf dem nicht disposed Store gelaufen ist. Wird der
     Store zwischen `response.json()` und `parse()` disposed, rejectet es wie oben.
   - `baseUrl`: wie heute `options?.baseUrl ?? url`; `signal` wird nicht an `parse()` gereicht
     (`const {signal, ...parseOptions} = options ?? {}`).
   - Hygiene wie bei `get()` (`:895-900`, Test `:818`): sobald der Versuch vorbei ist —
     aufgelöst, rejectet, abgebrochen, disposed —, hängt nichts mehr am Aufrufer-`signal`.
4. **Alias `load(url, options?: TextureStoreParseOptions): Promise<TextureStore>`** —
   `return this.loadAsync(url, options).then(() => this, () => this);`, TSDoc:
   `@deprecated Use {@link TextureStore.loadAsync}, which rejects when the load fails; this
   name resolves with the store all the same and leaves the failure to the error event. It stays
   as an alias until a breaking release removes it.` Dazu ein Satz: on a disposed store it
   resolves right away and fetches nothing. Der alte Vertrag bleibt damit genau erhalten; neu
   ist nur, dass `dispose()` den Fetch abbricht.
5. **`static loadAsync(url: string | URL, options?: TextureStoreLoadOptions): Promise<TextureStore>`**
   — der Rumpf der heutigen statischen `load()` (`:173-206`), auf die Instanz-`loadAsync()`
   gestellt statt auf `load()` plus `whenReady()`: baut einen Store, rejectet bei **jedem**
   `error`-Event des Versuchs (wie heute: fetch, Status, JSON, `parse()` wirft, ein Item ohne
   Resource, ein unbekannter Klassenname) mit `loadFailedError(source, url ?? id, error)`, bei
   Abbruch mit dem `AbortError` der Instanz-Methode, und disposed den gebauten Store vor der
   Rejection. Keine unbehandelte Rejection bleibt zurück — auch nicht die des
   Instanz-Promises, das der `dispose()` im `catch` rejectet.
6. **Alias `static load(url: string | URL): Promise<TextureStore>`** —
   `return TextureStore.loadAsync(url);`, TSDoc `@deprecated Use {@link TextureStore.loadAsync}.
   It stays as an alias until a breaking release removes it.`
7. TSDoc der vier Methoden neu schreiben; jede sagt, was sie tut, ohne die anderen
   »desselben Namens« zu bemühen. Die Instanz-`loadAsync()` nennt: resolves once parsed,
   rejects on fetch/status/JSON/parse and on abort or dispose, item problems are `error`
   events only; die statische nennt, dass sie jeden gemeldeten Fehler als Fehlschlag zählt und
   warum (niemand konnte vorher lauschen).
8. `dispose()`-TSDoc (`:920-933`): wartende `loadAsync()`-Promises werden rejectet und ihr
   Fetch abgebrochen; nach `dispose()` rejectet `loadAsync()` sofort, der Alias `load()` löst
   sofort auf; `getAsync()` statt `get()`.

### 3. `TextureStore#getAsync()` (API-020)

1. Der Rumpf von `get()` (`:807-902`) wandert in einen privaten Helfer, der den
   Methodennamen als ersten Parameter bekommt (`'get' | 'getAsync'`) und ihn in jede Meldung
   setzt: `disposedError(\`${method}(${id}, ${String(type)})\`)`,
   `\`${method}() aborted before subscription\``, `\`${method}(${id}, ${String(type)}) aborted\``,
   `resourceFailedError(\`${method}(${id}, ${String(type)})\`, failure)`.
2. `getAsync<const T …>(id, type, options?: {signal?: AbortSignal}): Promise<MapSubTypes<T>>`
   ruft ihn mit `'getAsync'`, trägt die heutige TSDoc von `get()`.
3. `get()` ruft ihn mit `'get'`, TSDoc `@deprecated Use {@link TextureStore.getAsync}: it
   answers once, as a promise, where a \`get()\` of a \`Map\` answers right away. It stays as an
   alias until a breaking release removes it.`
4. Jede Erwähnung von `get()` in TSDoc und Kommentaren nennt `getAsync()`:
   `TextureStore.ts:75-76`, `:128-131` (`evictMissing`), `:666`, `:793` (`whenResource`-Bezug
   bleibt), `:923`; `TextureResource.ts:81`, `:319-320`; `internals.ts:26`, `:44`.

### 4. `anisotropy` (API-023)

In `TextureFactory.ts`; jede Zeile muss am Ende gelten:

1. `TextureOptions`: `anisotropy: number` (Pflichtfeld wie seine Nachbarn) mit TSDoc — the
   anisotropy the texture is given, counted as three.js counts it: 1 is none, a value below 1
   counts as 1, and the factory caps it at the maximum of its renderer. Dazu
   `anisotrophy?: number` mit der TSDoc `@deprecated Use {@link TextureOptions.anisotropy},
   which counts as three.js does. This one counts from 0, where 0 is none, and stays until a
   breaking release removes it.` Der Seed der `defaultOptions` im Konstruktor (`:152-155`)
   schreibt `anisotropy: 0` statt `anisotrophy: 0`.
   Kein API der Library nimmt ein volles `TextureOptions`, jede Stelle nimmt
   `Partial<TextureOptions>` — nur ein volles Objektliteral ohne `anisotropy` bemerkt das
   Pflichtfeld.
2. Die Klassentabelle (`:28-73`) trägt die vier neuen Namen und die vier alten, beide mit
   demselben Rohwert (`anisotropy`: `Infinity`, 2, 4, 0 für »none«); `TextureClassPriority`
   (`:100-119`) trägt alle acht mit 500. `isTextureOptionClass()` kennt damit alle acht, und
   `checkTextureStoreData.ts` (`partitionTextureClasses`) lässt beide Schreibweisen durch.
3. TSDoc von `TextureOptionClasses` (`:75-86`): die vier `anisotrophy`-Namen sind
   deprecated Aliase der `anisotropy`-Namen und stehen bis zu einem brechenden Release in der
   Union.
4. `defaultOptions` des Konstruktors: fehlt `anisotropy` und steht `anisotrophy` darin, gilt
   `anisotrophy`; stehen beide darin, gilt `anisotropy`.
5. `getOptions()` antwortet mit beiden Schlüsseln: `anisotropy` = der Wert, den `update()` in
   `texture.anisotropy` schreibt, also `Math.max(1, Math.min(roh, max))`; `anisotrophy` = der
   heutige Wert `Math.min(roh ?? 0, max)` (Zählung ab 0), damit ein Leser des alten Schlüssels
   dieselbe Zahl bekommt wie heute.
6. `update()` nimmt beide Schlüssel aus dem `Object.assign()` heraus und setzt
   `texture.anisotropy` genau einmal. Für jede Kombination von Klassen und `defaultOptions`
   bekommt die Texture denselben `anisotropy`-Wert wie heute.
7. Private Namen und Parameter folgen: `#maxAnisotropy`, `toMaxAnisotropy`,
   `readMaxAnisotropy`, Konstruktorparameter `maxAnisotropyOrRenderer`. `.vscode/settings.json`
   bleibt, das Wort steht weiter im Alias.

### 5. Callback-Loader `@deprecated` und der Absatz über beide Wege (ARCH-005, Library-Seite)

1. `@deprecated` an jeder Klasse und jedem ihrer Typen — alle Typen hängen nur an ihrem Loader
   (per `git grep -w` geprüft):
   - `PowerOf2ImageLoader.ts`: `ImageWithTexCoords`, `PowerOf2ImageLoadCallback`,
     `PowerOf2ImageLoadErrorCallback`, `PowerOf2ImageLoader`
   - `TextureImageLoader.ts`: `TextureImage`, `TextureImageLoadCallback`,
     `TextureImageLoadErrorCallback`, `TextureImageLoader`
   - `TextureAtlasLoader.ts`: `TextureAtlasData`, `TextureAtlasLoadOptions`,
     `TextureAtlasLoadCallback`, `TextureAtlasLoadErrorCallback`, `TextureAtlasLoader`
   - `TileSetLoader.ts`: `TileSetData`, `TileSetLoadCallback`, `TileSetLoadErrorCallback`,
     `TileSetLoader`

   Die Klassen-TSDoc nennt den Weg über den Store und den Unterschied in höchstens drei
   Sätzen — `docs/` wird nicht mit dem Paket ausgeliefert, ein Verweis dorthin allein wäre für
   einen npm-Nutzer tot:
   - `TextureImageLoader` → ein Item mit `imageUrl`, `getAsync(id, ['texture', 'imageCoords'])`
   - `TileSetLoader` → ein Item mit `imageUrl` und `tileSet`, `getAsync(id, ['tileSet', 'texture'])`
   - `TextureAtlasLoader` → ein Item mit `atlasUrl` (und `overrideImageUrl`),
     `getAsync(id, ['atlas', 'texture'])`
   - `PowerOf2ImageLoader` → ein Item mit `imageUrl`; das Auffüllen auf Zweierpotenzen hat der
     Store nicht und bekommt es nicht (Entscheidung vom 2026-09-26)

   Schlusssatz jeweils: the class stays until a breaking release removes it. Die Typen
   bekommen einen Satz, der auf ihre Klasse zeigt.
2. **Der Absatz im Modul** — neue Klassen-TSDoc an `TextureStore` (`TextureStore.ts:155`
   hat heute keine): der Store ist der Weg, Texturen, Atlanten und Tile Sets zu laden — ein
   Katalog (`TextureStoreData`) nennt die Resources, `loadAsync()` holt ihn oder `parse()`
   nimmt ihn entgegen, `getAsync()` und `on()` geben ihre Werte heraus; jedes Bild wird einmal
   geholt, jede Resource baut eine Texture und behält sie, ein Aufrufer leiht sie nur. Die vier
   Callback-Loader sind der ältere Weg und deprecated, und dasselbe Bild kommt dort anders
   heraus: ein Loader füllt ein Bild, dessen Seiten keine Zweierpotenzen sind, auf einer
   Canvas auf, die es sind, gibt Koordinaten als Kind dieser Canvas heraus und beginnt mit der
   Klasse `nearest`; der Store lädt das Bild, wie es ist, seine `imageCoords` sind die Wurzel
   des Bildes, und er beginnt ohne Texture-Klasse. Eine Texture eines Loaders gehört dem
   Aufrufer.
3. `packages/twopoint5d/docs/architecture.md`, Abschnitt `### texture/` (`:78-85`): neu
   schreiben, Zeilen umbrechen wie die Nachbarabschnitte (~90 Zeichen; `:84` ist heute zu
   lang). Inhalt: `TextureAtlas`/`TileSet`/`TextureCoords` wie heute; `TextureStore` mit
   `TextureResource` ist der Lade-Weg (Katalog, ein Fetch je Bild, Referenzzählung,
   `getAsync()`/`on()`); `TexturePackerJson` liest die TexturePacker-Formate (JSON Hash und
   JSON Array, gedrehte Frames eingeschlossen); die vier `*Loader` sind deprecated, mit den
   drei Unterschieden aus Punkt 2 in einem Satz; `FrameBasedAnimations` wie heute.
4. `docs/resource-lifecycle.md` bleibt: §1 nennt die Loader als Beispiel für
   aufrufereigene Texturen, das gilt weiter.

### 6. Specs

Jede neue öffentliche Methode und jeder Alias braucht einen Test — sonst fällt die
`functions`-Schwelle von `src/texture/**` (93) in `vite.config.ts`.

1. `TextureResource.spec.ts`: die 64 Aufrufe `.load()` → `.activate()`, `describe`/`test`-Namen,
   die `load()` nennen, nennen `activate()`. Neu: `load() is a deprecated alias of activate()
   and registers the effects once` (beide nacheinander gerufen registrieren einmal — über
   `getEffectsCount()`).
2. `TextureStore.spec.ts`:
   - `.get(` → `.getAsync(` (28), `TextureStore.load(` → `TextureStore.loadAsync(` (8), die
     Instanz-Aufrufe `.load(` (16) → `.loadAsync(`, sofern der Test nicht gerade den
     Nie-rejecten-Vertrag prüft: die drei Tests in `describe('load() answers as a promise')`
     (`:538-581`) und `load() on a disposed store does not fetch` (`:220`) bleiben auf `load()`
     und bekommen `describe`-Namen, die sie als Tests des deprecated Alias ausweisen.
     `describe`/`test`-Namen folgen den neuen Namen; die Meldungsprüfungen folgen
     (`'getAsync() aborted before subscription'` usw.).
   - Neu für `loadAsync()` (Instanz): löst nach dem Parse mit dem Store auf · rejectet bei
     Fetch-Fehler, Status, Nicht-JSON und werfendem `parse()` mit
     `[TextureStore] load failed at the <source> step: "<url>"`, und das `error`-Event geht
     trotzdem hinaus · ein Item ohne Resource löst auf und meldet per Event · ein schon
     abgebrochenes `signal` rejectet mit `AbortError` und fetcht nicht · ein `signal`, das
     während des Fetches abbricht, bricht das Signal des Fetches ab (`fetchMock.mock.calls[0][1].signal.aborted`),
     rejectet mit `AbortError`, parst nicht und meldet kein `error` · `dispose()` während des
     Fetches bricht dessen Signal ab und rejectet mit `was cancelled: this store has been
     disposed` · auf einem disposed Store rejectet es, ohne zu fetchen · nach Auflösung und nach
     Rejection hängt kein `abort`-Listener mehr am Aufrufer-`signal` (Spy auf
     `addEventListener`/`removeEventListener` wie im Test `:818`).
   - Neu für die statische `loadAsync()`: ein abgebrochenes `signal` rejectet mit `AbortError`
     und der gebaute Store ist disposed (`vi.spyOn(TextureStore.prototype, 'dispose')`).
   - Aliase: statisches `load()` löst auf wie `loadAsync()` · Instanz-`load()` löst nach einem
     Fetch-Fehler, einem Abbruch und einem `dispose()` mit dem Store auf · `get()` löst auf wie
     `getAsync()` und rejectet mit Meldungen, die `get(<id>, <type>)` nennen.
   - Regressionstest für ASYNC-003, vor dem Fix rot: `dispose() cuts short the catalog fetch
     of a loadAsync() under way` — heute bekommt `fetch` gar kein Signal.
3. `TextureFactory.spec.ts`: die Tests `:23-94`, `:155-158` auf die neuen Klassennamen und
   `anisotropy`. Neu: jeder alte Klassenname ergibt dieselben Optionen und denselben
   `texture.anisotropy` wie sein neuer · `getOptions()` antwortet `anisotropy` ab 1 und
   `anisotrophy` ab 0 (`['no-anisotropy']` → 1 und 0; Faktor mit Maximum 0 und
   `['anisotropy-4']` → 1 und 0; Maximum 8 und `['anisotropy-4']` → 4 und 4) ·
   `defaultOptions` mit nur `anisotrophy` gilt, mit beiden gilt `anisotropy` · `update()`
   hinterlässt keinen eigenen Schlüssel `anisotrophy` auf der Texture ·
   `isTextureOptionClass()` ist für alle acht Namen `true`.

### 7. Browser-Tests

1. `texture-store-on.test.js`: jedes `store.load(catalogUrl)` (17) wird
   `await store.loadAsync(catalogUrl)` an derselben Stelle. Braucht ein Test den Fetch noch im
   Flug, während er danach etwas tut, hält er das Promise in einer `const` und wartet es vor
   dem Testende ab.
2. `texture-factory-anisotropy.test.js`: `'anisotrophy'` → `'anisotropy'`,
   `'anisotrophy-4'` → `'anisotropy-4'`; die Prüfung `not.have.own.property('anisotrophy')`
   bleibt.

### 8. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, `[Unreleased]`)

Skill `updating-changelog` laden.

- **Added**: `TextureResource#activate()`; `TextureStore#loadAsync()` und
  `TextureStore.loadAsync()` samt `TextureStoreLoadOptions#signal`, mit dem Vertrag aus
  Schritt 2; `TextureStore#getAsync()`; `TextureOptions#anisotropy` (Zählung wie three.js) und
  die vier `anisotropy`-Klassennamen.
- **Deprecated**: die vier Callback-Loader samt Typen zugunsten des Stores, mit den
  Unterschieden aus Schritt 5.2; `TextureResource#load()`; `TextureStore#load()` beider
  Formen; `TextureStore#get()`; `TextureOptions#anisotrophy` und die vier
  `anisotrophy`-Klassennamen — jeweils: der alte Name bleibt, bis ein brechendes Release ihn
  entfernt.
- **Fixed**: `TextureStore#dispose()` bricht einen laufenden Katalog-Fetch ab, und ein
  wartendes `loadAsync()` rejectet.
- **Migration Guide**: ein neuer Eintrag zu den neuen Namen (Before/After: `store.load(url)`
  → `await store.loadAsync(url)`, `store.get(…)` → `store.getAsync(…)`, `resource.load()` →
  `resource.activate()`, `'anisotrophy-4'` → `'anisotropy-4'`; dazu der Satz, dass
  `loadAsync()` rejectet, wo `load()` auflöste) und einer zu den Loadern (Before/After:
  `new TileSetLoader().loadAsync(url, {tileWidth, tileHeight}, ['nearest'])` → Store mit
  Tile-Set-Item und `getAsync(id, ['tileSet', 'texture'])`, `nearest` ausdrücklich genannt,
  die Texture gehört dem Store). Die **After**-Blöcke der älteren `[Unreleased]`-Einträge,
  die noch die alten Namen empfehlen, nehmen die neuen: `CHANGELOG.md:936-939`
  (`store.load(url)`), `:1112-1125` (`store.get`), `:1176-1182` (`resource.load()`),
  `:2616-2622` (`store.get`) — Zeilen Stand `ee725355`. Ein `loadAsync()` ohne `await` und
  ohne `catch` ist dort kein Vorbild: es rejectet. Die **Before**-Blöcke und die Überschriften
  bleiben. Ein Block mit `ts check` muss danach compilieren.

## Verify

`pnpm run ci` (Repo-Root). Einzeln unterwegs: `pnpm nx test twopoint5d -- src/texture`,
`pnpm typecheck`, `pnpm test:browser`.

## Commit

```
feat(texture): name the load() of TextureResource activate(), the load() methods of TextureStore loadAsync() with an AbortSignal that dispose() pulls as well, and get() getAsync(), spell the anisotropy option and texture classes as three.js does, keep every old name as a deprecated alias, and deprecate the callback loaders in favour of the store
```

## Abgleich (gegen `ee725355`)

- **ARCH-005** `public-api.ts:1` — unverändert. `public-api.ts:2,4,7,12` exportieren die
  vier Loader neben `TextureStore`/`TextureResource`; kein Loader trägt `@deprecated`, das
  Verhältnis beider Wege steht nirgends (`TextureStore` hat keine Klassen-TSDoc,
  `docs/architecture.md:80-85` nennt beide ohne Bezug). Lookbook: neun Stellen auf den
  Loadern (`demos/map2d/map2d-cam-visi.ts:47`, `map2d-rect-visi.ts:75`,
  `map2d-tile-sprites.ts:34`, `pages/demos/animated-billboards.astro:60`,
  `textured-quads.astro:84`, `textured-quads-po2image-loader.astro:56`,
  `textured-quads-from-tileset.astro:64`, `textured-quads-from-texture-atlas.astro:58`,
  `textured-sprites.astro:51`) — an Paket 10.
- **API-019** — umgeformt. Die Beschreibung des Audits (»Instanz-Methode gibt sofort `this`
  zurück«) stimmt nicht mehr: `TextureStore#load()` `:407-443` gibt ein Promise zurück, das
  nie rejectet. Drei Namen, drei Verträge bestehen weiter: statisch `:173-206` (baut, rejectet),
  Instanz `:407` (löst immer auf), `TextureResource#load()` `TextureResource.ts:615-666`
  (registriert Effekte). Empfehlung der ersten Fassung des Audits (`1b5698eb:audit.html`):
  `activate()` für die Resource, `loadAsync(url): Promise<this>` für die Instanz.
- **API-020** — unverändert, `TextureStore.ts:807-902`.
- **API-023** — unverändert: `TextureFactory.ts:23` (`TextureOptions.anisotrophy`),
  `:29-40` (vier Klassennamen), `:109-112`, `:123-151`, `:180`, `:201-205`. Außerhalb von
  `src/`: `texture-factory-anisotropy.test.js:31,41,46`, `.vscode/settings.json:5`.
- **ASYNC-003** `TextureStore.ts:365` — verschoben, Sachverhalt unverändert: der Fetch der
  Instanz-Methode `:413` hat kein Signal, `dispose()` `:934-953` bricht ihn nicht ab, die
  statische Form `:173` nimmt keins; die Loader `PowerOf2ImageLoader.ts:28`,
  `TextureImageLoader.ts:36`, `TextureAtlasLoader.ts:52`, `TileSetLoader.ts:39` ebenso.
  `get()` trägt ein `signal` (`:810`), der Atlas-Fetch einer Resource bricht bei `dispose()`
  ab (`TextureResource.ts:931-934`).
- Folgen der erledigten Pakete: keine offen (1, 2 triagiert und behoben in 7, 8; 3, 4, 5, 7,
  8, 9 ohne Folgen). Die Zeile `Schnittstellen:` unter Paket 5 kündigt dieses Paket an: `load()`
  wird umbenannt und setzt auf die Registrierer — das tut Schritt 1 ohne den Rumpf anzufassen.
- Offene Befunde: keiner teilt eine Ursache mit diesem Paket. `TextureStore.ts` `onResource()`
  (Abo bleibt dauerhaft), `TextureStore.spec.ts:420` (Kommentar), `TextureResource.ts:179`
  (Zeilenlänge), `TextureAtlasLoader.ts:66,78` (Meldung ohne `path` — die Deprecation behebt
  sie nicht), `TexturePackerJson.ts:38-40`, `FrameBasedAnimations.ts:208`,
  `TextureResource.ts:951,953` und `apps/lookbook/public/assets/textures.json` (der Katalog
  nennt keine Demo-Assets außer `ball-pattern-rot--not-power-of-2.png`, mit `flipy`; Paket 10
  gibt ihm damit keinen Verbraucher) bleiben liegen.

## Verlauf

- 2026-09-26 Zug 0: Detailplan steht · ARCH-005 unverändert (Library-Seite hier, Lookbook →
  Paket 10) · API-019 umgeformt (Instanz-`load()` gibt ein nie rejectendes Promise zurück) ·
  API-020 unverändert · API-023 unverändert · ASYNC-003 verschoben (`TextureStore.ts:413`,
  `:934`) · Paket geteilt: Paket 10 »Lookbook auf den Store« angelegt, direkt hinter 6 ·
  keine offenen Folgen, kein Nebenbefund mit gleicher Ursache
- 2026-09-26 Zug 1: Implementierer Runde 0 beauftragt · opus, effort high · Brief und Report
  `paket-6.impl-0.brief`/`.json` im Arbeitsverzeichnis
- 2026-09-26 Zug 2: Report FERTIG · 16 Dateien geändert (texture-Quellen und Specs, `types.ts` nur TSDoc,
  zwei Browser-Tests, `docs/architecture.md`, CHANGELOG) · roter Lauf belegt · Arbeitsbaum schmutzig ·
  Verify `pnpm run ci` exit=0 (`paket-6.verify.log`, Nx-Cache auf identischem Stand)
- 2026-09-26 Zug 3: Reviewer Runde 0 beauftragt · opus, effort high · Diff `paket-6.diff` (16 Dateien,
  +1081/−373)
- 2026-09-26 Zug 3: Reviewer freigeben · alle fünf Findings erfüllt (ARCH-005 anteilig), keine kritischen
  oder wichtigen Befunde, fünf kleine · Report `paket-6.review-0.json`
- 2026-09-26 Zug 4: keine Runde (nur kleine Befunde)
- 2026-09-26 Zug 5: Commit `e5a19377` · Verify `paket-6.verify.log` exit=0, keine Codeänderung seit dem Lauf ·
  Plan auf `[x]`, drei Nebenbefunde in »Offene Befunde«

## Urteil des Reviewers (Runde 0)

- **API-019** behoben — `TextureResource#activate()` `TextureResource.ts:614`, Alias `load()` `:672` über
  denselben `#activated`-Guard (Test `TextureResource.spec.ts:1674`); `TextureStore#loadAsync()`
  `TextureStore.ts:438`, statisch `:196`; Aliase `:538` (rejectet nie) und `:230`; `on()` ruft
  `activate()` `:829`
- **API-020** behoben — `getAsync()` `TextureStore.ts:907`, Alias `get()` `:923`, Helfer `#getOnce()`
  `:933` setzt den Methodennamen in alle vier Meldungen (Test `TextureStore.spec.ts:839`)
- **API-023** behoben — `TextureOptions#anisotropy` Pflicht `TextureFactory.ts:27`, acht Klassen mit
  gleichen Rohwerten und Priorität 500, Seed `:187`, zwei Zählungen in `getOptions()` `:205`, `update()`
  `:246` setzt `texture.anisotropy` einmal; alle Kombinationen durchgerechnet, jede Texture bekommt
  denselben Wert wie vorher
- **ASYNC-003** behoben für den Weg, der bleibt — `#disposal` `TextureStore.ts:326`, `dispose()` bricht
  ab nach dem `dispose`-Event, vor den Resources (`:1079`); Regressionstest `TextureStore.spec.ts:220`;
  die Loader bekommen kein Signal (Entscheidung aus Zug 0)
- **ARCH-005** Library-Seite behoben — `@deprecated` an vier Loadern und 15 Typen, Klassen-TSDoc von
  `TextureStore` `TextureStore.ts:164-179`, `docs/architecture.md:80-93`; Lookbook-Seite offen → Paket 10
- Verträge: Listener-Hygiene auf jedem Pfad (`TextureStore.spec.ts:696-733`), keine unbehandelten
  Rejections, der Nie-rejecten-Vertrag des Alias hält in vier getesteten Fällen, kein neuer Test aus dem
  falschen Grund grün

### Kleine Befunde

- `TextureStore.ts:514` — zwischen dem Ende von `parse()` und `resolve()` liegen Microtasks; ein
  `ac.abort()` oder `store.dispose()` aus einem Listener innerhalb von `parse()` (`ready`, ein
  `on()`-Callback) lässt `loadAsync()` rejecten, obwohl geparst wurde — gegen die TSDoc von
  `TextureStoreLoadOptions#signal` (»a signal that aborts once the data is parsed changes nothing«).
  Lösung: direkt nach `this.parse()` in `attempt()` settlen
- `TextureStore.ts:474` — wirft ein `error`-Listener in `failed()`, rejectet `loadAsync()` mit dessen
  Fehler statt mit `loadFailedError`; der Alias ist nicht betroffen
- `TextureStore.spec.ts:1847` — der Testname »awaits whenReady() before resolving« beschreibt eine
  Implementierung, die die statische Form nicht mehr hat
- `TextureStore.spec.ts:791` und `:804` — zwei Tests prüfen fast dasselbe (disposed Store fetcht nicht,
  einmal über den Alias im eigenen `describe`, einmal verschoben aus `describe('dispose()')`)
- `CHANGELOG.md:245-246` — »goes on resolving«, »go on naming« lehnen sich an den Vorzustand an; im
  Präsens trägt es ohne Vorwissen (»resolves with the store however the attempt ends«, »its messages
  name `get()`«)

### Anmerkungen zum Report des Implementierers

- Abweichungen vom Detailplan (im Report begründet, vom Reviewer nicht beanstandet): 12 statt 16
  Instanz-Aufrufe `.load(` in `TextureStore.spec.ts`, 16 statt 17 in `texture-store-on.test.js`;
  `types.ts:46` TSDoc mitgezogen; der After-Block unter »`TextureStore#load()` returns a promise« im
  CHANGELOG zeigt `store.loadAsync(url).catch(…)` statt `await`, weil der Satz darunter zwei
  unabhängige Zeilen beschreibt; die statische `loadAsync()` reicht die Rejection der Instanz-Methode
  weiter und nimmt nur Item- und Klassennamen-Fehler aus dem Event
- Als Folge gemeldet, hier eingeordnet: ältere `[Unreleased]`-Bullets und Migration-Guide-Prosa
  (`CHANGELOG.md:21, 94, 96, 146, 227, 305, 306, 400, 1105, 1168-1170, 2638`) nennen `load()`/`get()`
  — sie beschreiben das Verhalten dieser Namen, das die Aliase unverändert tragen, und lügen damit
  nicht; kein Eintrag in »Folgen«
- Als Nebenbefund gemeldet, nicht in die Queue: die `.then`-Handler des Bild-Effekts in
  `TextureResource.ts` ohne abschließendes `.catch()` — so gewollt seit Paket 8 (`d6022aa4`, dort in
  `Schnittstellen:`: ein werfender `error`-Listener endet als unbehandelte Rejection), kein neuer Befund

## Findings im Volltext

**ARCH-005 · medium · packages/twopoint5d/src/texture/public-api.ts:1** — Zwei Lade-Stacks im
texture-Modul mit unterschiedlichem Verhalten für dasselbe Asset
Das Modul exportiert zwei Generationen: die Callback-Loader `PowerOf2ImageLoader`,
`TextureImageLoader`, `TextureAtlasLoader` und `TileSetLoader` (`load(cb, errCb)` plus
`loadAsync`) und den signal-basierten `TextureStore` mit `TextureResource`. Die Loader polstern
jedes Nicht-Zweierpotenz-Bild über einen Canvas auf und liefern `texCoords` als Kind eines
größeren Root; die Resource lädt roh über `ImageLoader`. Dasselbe PNG ergibt je nach Weg eine
andere Textur und andere UV-Wurzeln. Die Lookbook nutzt beide Wege nebeneinander. Re-Check
dieses Laufs: unverändert, beide Stacks sind exportiert und dokumentieren ihr Verhältnis
nirgends.
Empfehlung: Entscheiden, welcher Stack die Zukunft ist. Naheliegend: die Callback-Loader als
`@deprecated` markieren, das POT-Padding als Option in `TextureResource` anbieten oder ganz
streichen, und die map2d-Demos auf den Store umstellen. Bis dahin ein Absatz im Modul, der die
beiden Wege und ihren Unterschied benennt.

**API-019 · acknowledged · packages/twopoint5d/src/texture/TextureStore.ts, TextureResource.ts**
— Drei load()-Methoden mit drei verschiedenen Bedeutungen
Grund der Zurückstellung (2026-05-14): Zurückgestellt auf den nächsten Major: Breaking Change,
Umbenennung nach activate()/loadAsync().
Erste Fassung (`1b5698eb:audit.html`): `TextureStore.load(url)` als Instanz-Methode gibt
sofort `this` zurück. Die statische Variante wartet inzwischen auf Ready.
`TextureResource.load()` lädt gar nichts, sondern schaltet den Effect-Pfad scharf. Drei Namen,
drei Verträge. Empfehlung: `TextureResource.load()` nach `activate()` umbenennen, die
Instanz-Methode um ein `loadAsync(url): Promise<this>` ergänzen.

**API-020 · acknowledged · packages/twopoint5d/src/texture/TextureStore.ts** — get(id, type)
heißt wie Map.get, ist aber ein einmaliges Promise
Grund der Zurückstellung (2026-05-14): Zurückgestellt auf den nächsten Major, gebündelt mit
API-019 (Umbenennung nach getAsync()).
Erste Fassung: Wer eine Map-artige API erwartet, wird überrascht: der Aufruf registriert intern
eine Subscription und liefert ein Promise. Empfehlung: Nach `getAsync` umbenennen.

**API-023 · acknowledged · packages/twopoint5d/src/texture/TextureFactory.ts** —
TextureFactory.anisotrophy — Tippfehler in der öffentlichen API
Grund der Zurückstellung (2026-05-14): Zurückgestellt auf den nächsten Major (Umbenennung mit
Übergangs-Alias).
Erste Fassung: Es heißt anisotropy. Die Property heißt seit jeher anders. Empfehlung:
Umbenennen, mit Alias-Getter für eine Übergangsversion.

**ASYNC-003 · low (Optimierungspotenzial) · packages/twopoint5d/src/texture/TextureStore.ts:365**
(dazu `TextureAtlasLoader.ts:37`, `TextureImageLoader.ts:28`, `TileSetLoader.ts:30`,
`PowerOf2ImageLoader.ts:28`) — AbortSignal für die Loader und TextureStore.load anbieten
`TextureStore.get` und der Atlas-Fetch lassen sich abbrechen, die übrigen Ladewege nicht. Ein
Katalog-Fetch läuft nach `store.dispose()` weiter, bis `parse` ihn verwirft. Eine Texture, die
nach dem Unmount einer Komponente ankommt, muss der Aufrufer selbst erkennen und disposen.
Empfehlung: Optionales `{signal}` in `loadAsync`/`load` einführen, bei Abort eine bereits
gebaute Texture disposen, und `TextureStore.load` beim eigenen Dispose abbrechen.
