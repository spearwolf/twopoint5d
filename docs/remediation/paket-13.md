# Paket 13 — TextureResource nach Ressourcenform typisieren

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ARCH-002 (low), PERF-011 (low), PERF-012 (low, gegenstandslos — siehe Abgleich), RES-010 (low), BUG-031 (low)
- Ziel: `TextureResource` bietet je Ressourcenform nur die passenden Setter und Typen statt zur Laufzeit zu werfen, lädt bei
  Klassen- oder Rendererwechsel nicht neu, vergleicht Animationsdaten strukturell, gibt bei geleerter `imageUrl` frei, und die
  `TextureFactory` liest das Anisotropie-Maximum lazy.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/texture/TextureResource.ts` (Basis und drei Unterklassen) samt `TextureResource.spec.ts`
  - neu `packages/twopoint5d/src/texture/fetchAtlasJson.ts` samt `fetchAtlasJson.spec.ts` (intern)
  - neu `packages/twopoint5d/src/texture/cmpAnimationsData.ts` samt `cmpAnimationsData.spec.ts` (intern)
  - `packages/twopoint5d/src/texture/TextureStore.ts` samt `TextureStore.spec.ts`
  - `packages/twopoint5d/src/texture/TextureFactory.ts` samt `TextureFactory.spec.ts`
  - `packages/twopoint5d-testing/test/texture-factory-anisotropy.test.js`
  - `packages/twopoint5d/docs/architecture.md` (§ `texture/`, Z. 119–123)
  - `packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md` (§6.3, Z. 407–416)
  - `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]`: Added, Changed, Fixed, Migration Guide)
  - `public-api.ts` bleibt, wie es ist: `export * from './TextureResource.js'` trägt die neuen Klassen und den Typ mit;
    `fetchAtlasJson.ts` und `cmpAnimationsData.ts` kommen **nicht** hinein
- Verify: `pnpm run ci`
- Commit: `refactor(texture)!: give each shape of TextureResource a class of its own — ImageTextureResource, TileSetTextureResource and AtlasTextureResource, each with the inputs of its shape alone — hand their union out of TextureStore, fetch the atlas json in a module of its own, compare frameBasedAnimationsData by content, let a resource on its own drop the image it fetched last once its imageUrl is cleared, and have TextureFactory ask its renderer for the anisotropy maximum at every texture it builds`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · ARCH-002 unverändert, gewandert (Klasse 1334 statt 1227 Zeilen; Würfe
    `TextureResource.ts:194–207`, Setter `:392`, `:407`, `:439`, `:462`, `:484`, `:500`; Fetch `:1083–1161`; TSDoc `:68–110`,
    `:232–274`, `:415–434`; breiter Typ aus `TextureStore.ts:471`, `:524`) · PERF-011 unverändert, gewandert
    (`TextureResource.ts:340`; Schreiber `TextureStore.ts:893`, `:912`) · PERF-012 gegenstandslos: `loadStandalone()`
    `TextureResource.ts:831–840` aus `ac549468` (vor dem Lauf), zwei Pin-Tests verlangt · RES-010 unverändert (`!url`-Zweig
    `:858–861`, `standalone` `:831`) · BUG-031 unverändert (`TextureFactory.ts:189–192`, `:161–167`) · Folgen offen: keine
    (alle `Folgen:` der Pakete 1–12 sind »keine«) · aus »Offene Befunde« nichts übernommen: kein Eintrag teilt die Ursache ·
    ein Nebenbefund neu in die Queue (`TextureStore.ts:441`) · kein Split · Restplan: Paket 13 ist das letzte Paket
  - 2026-10-22 Zug 1: Implementierer beauftragt (opus, effort high), Report `paket-13.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG · 10 Dateien geändert, 4 neu (`fetchAtlasJson.ts`, `cmpAnimationsData.ts` samt Specs) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-13.verify.log`)
  - 2026-10-22 Zug 3: Reviewer (opus, effort high) — alle fünf erfüllt, 0 kritisch, 0 wichtig, 4 klein · Diff `paket-13.diff`, Report `paket-13.review-0.json`
  - 2026-10-22 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-10-22 Zug 5: Commit 2ea485d8 auf Verify `paket-13.verify.log` (exit=0, keine Änderung seither) · 14 Dateien

## Abgleich gegen den Code nach `57cf085f`

- **ARCH-002** besteht, die Fundstellen sind gewandert. `TextureResource.ts` hat 1334 Zeilen, eine Klasse trägt alle drei
  Formen. Welche Setter gelten, entscheidet `type` zur Laufzeit: `wrongShapeError()` (`:194–197`) und
  `derivedImageUrlError()` (`:203–207`) werfen aus `imageUrl` (`:392–397`, auf `atlas`), `atlasUrl` (`:407–413`),
  `atlasJson` (`:439–456`), `overrideImageUrl` (`:462–467`), `atlasAdapter` (`:484–489`) und `tileSetOptions`
  (`:500–505`). Der Konstruktor (`:619–638`) legt die Signale der Form an; der Typ `TextureResource` verrät davon
  nichts, `TextureStore#whenResource()` (`TextureStore.ts:524`) und `#onResource()` (`:471`) liefern denselben breiten Typ.
  Die Atlas-Fetch-Logik steht im Fetch-Effect (`TextureResource.ts:1083–1161`, der `try`-Block `:1097–1141`). Die langen
  TSDoc-Absätze: `TextureResourceEvents` `:68–110`, Klassen-TSDoc `:232–274`, `atlasJson` `:415–434`.
- **PERF-011** besteht. `#frameBasedAnimationsData` (`TextureResource.ts:340`) hat keinen `compare`; die Nachbarn tun es
  (`cmpTexClasses` `:121`, `cmpShallow` `:132`). `TextureStore#parse()` schreibt das frisch geparste Objekt (`:893` für ein
  Tile-Set-Item, `:912` für ein Atlas-Item); jede neue Identität baut ein neues `FrameBasedAnimations`
  (`#registerAnimationsEffect()`, `:1297–1333`) und emittiert es.
- **PERF-012** ist **gegenstandslos**, behoben vor dem Lauf. `#registerImageEffect()` (`TextureResource.ts:826–944`) holt
  ohne Store über `loadStandalone()` (`:831–840`): ein Lauf mit derselben URL bekommt dasselbe Promise, ein
  fehlgeschlagener Load fällt heraus. Eingeführt in `ac549468` (2026-10-21 16:53, vor dem ersten Commit dieses Laufs,
  `b998e803`); die Evidenz des Findings (`(lease?.image ?? new ImageLoader().loadAsync(url))`) ist der Stand davor. Der Test
  `… the factory that arrives builds it from the same fetch` (`TextureResource.spec.ts:2396`) deckt das Eintreffen einer
  Factory, nicht den Wechsel der Texturklassen und nicht einen zweiten Renderer — die zwei Wege aus der Beschreibung
  bekommen in Schritt 6 je einen Pin-Test, der den Umbau von Schritt 3 absichert.
- **RES-010** besteht unverändert. Im `!url`-Zweig (`TextureResource.ts:858–861`) ruft der Effect `#takeBackImage()`, die
  Closure `standalone` (`:831`) hält das Promise des zuletzt geladenen Bildes bis zum Dispose.
- **BUG-031** besteht unverändert. `TextureFactory` liest das Maximum einmal im Konstruktor (`TextureFactory.ts:189–192`),
  `readMaxAnisotropy()` (`:161–167`) macht aus dem Wurf eines nicht initialisierten Backends 0. Erzeugt wird die Factory
  beim Setzen des Renderers: `TextureStore.ts:408`, `TextureResource.ts:808`. Gegen three 0.186.1 nachgesehen:
  `Renderer#getMaxAnisotropy()` fragt `backend.capabilities` (`src/renderers/common/Renderer.js:2030`); das WebGL-Backend
  legt sie erst in `init()` an (`webgl-fallback/WebGLBackend.js:86` `null`, `:254`), das WebGPU-Backend antwortet fest 16
  (`webgpu/utils/WebGPUCapabilities.js:31`). Das WebGL-Backend klemmt beim Sampler selbst auf das Gerätemaximum
  (`webgl-fallback/utils/WebGLTextureUtils.js:378`); `Renderer#initialized` ist öffentlich (`Renderer.js:1514`).

## Triage

- **Folgen** der erledigten Pakete: keine offen — die `Folgen:`-Zeilen der Pakete 1–12 sind alle »keine«.
- **Offene Befunde:** keiner teilt die Ursache dieses Pakets. Die zwei Einträge unter `src/texture/`
  (`sampleAtlasFrame.ts:105`, `TexturePackerJson.ts:69`) betreffen Meldungstexte und eine fehlende Ablehnung in Parsern,
  nicht die Form der Ressource; sie bleiben in der Queue.
- **Neu in die Queue** (beim Lesen von `TextureStore.ts` aufgefallen, vorbestehend): `TextureStore.ts:441` —
  `registerAtlasAdapter()` zeigt einen abgelehnten Namen mit `String(name)` statt über `describeValue()`; stand so schon in
  `6500527f` (`git show 6500527f:packages/twopoint5d/src/texture/TextureStore.ts`, Z. 441, damals mit Klammer-Präfix). Gleiche
  Art wie der Eintrag zu `sampleAtlasFrame.ts:105`, andere Ursache als dieses Paket. Urteil `→ Scope` (Scope-Regel: alles).

## Gewählter Weg und Gründe

- **Unterklassen je Form, nicht nur ein diskriminierter Typ.** Die Empfehlung nennt »je Form eine Unterklasse oder zumindest
  einen diskriminierten Typ«; »Entscheidungen« (2026-10-21) verlangt die volle Umsetzung, nicht die Minimalvariante. Ein
  generisches `TextureResource<T>` ließe jeden Setter auf jeder Form im Typ stehen (nur mit `never` als Parameter) und
  verengte `TextureStore#whenResource()` ohnehin erst über eine Union. Mit Unterklassen hat jede Form genau ihre Eingaben,
  `resource.type` verengt die Union `AnyTextureResource` auf die Klasse, und der Code einer Form steht in ihrer Klasse.
- **Basis und drei Unterklassen in einem Modul, die Fetch-Logik in einem eigenen.** Die statischen Fabriken
  `TextureResource.fromImage()`, `.fromTileSet()`, `.fromAtlas()` sind veröffentlicht (v0.23.0) und bleiben; sie bauen
  Unterklassen. Stünden die Unterklassen in eigenen Modulen, importierte das Modul der Basis seine Unterklassen und diese die
  Basis — ein Zyklus, in dem `class … extends TextureResource` je nach Einstiegsmodul auf eine noch nicht initialisierte
  Bindung trifft. Ein Modul vermeidet das ohne Registry. Die Empfehlung verlangt das eigene Modul ausdrücklich nur für die
  Atlas-Fetch-Logik; die Klasse jeder Form ist ihr eigener Abschnitt.
- **Der Kanal zwischen Basis und Form ist ein `static {}`-Block**, der eine modulinterne Funktion `shapeContextOf()` belegt —
  das ist der Weg, auf dem ECMAScript einem `#`-Feld einen »friend« gibt. Kein `protected`-Feld, kein exportiertes Symbol,
  nichts davon in den veröffentlichten Typen. Einzige `protected` Methode ist `registerShapeEffects()`, `@internal`
  (`stripInternal` ist an, `tsconfig.json:49`).
- **Der Laufzeitwurf bleibt als Netz für JavaScript.** TypeScript lehnt den Schreibzugriff einer fremden Form ab; ein
  JavaScript-Aufrufer (die Browsertests sind JavaScript) legte ohne Netz still eine eigene Eigenschaft an, die die Ressource
  nie liest — und das Lesen danach antwortete den geschriebenen Wert. Die Accessoren des Netzes stehen per
  `Object.defineProperty` auf dem Prototyp der Form und in keinem Typ. Die Meldungen bleiben wörtlich, wie sie sind: ihr
  Subjekt `TextureResource "<id>"` ist die Basisklasse jeder Ressource, und die Form nennt die Meldung selbst.
- **`frameBasedAnimationsData` gehört nur Tile Set und Atlas.** Eine Bild-Ressource baut nie Animationen
  (`SUBTYPES_BUILT_BY_TYPE`, `:176–180`), der Store schreibt das Feld nur für diese beiden Formen. Auf einer Bild-Ressource
  wirft der Schreibzugriff in JavaScript jetzt den `TypeError` der anderen fremden Eingaben — breaking, steht im CHANGELOG.
- **Ausgaben bleiben auf der Basis**, alle fünf (`imageCoords`, `atlas`, `tileSet`, `texture`, `frameBasedAnimations`): sie
  sind die Events jeder Ressource, und `TextureStore#on()` liest das Tupel mit `resource[subType]` (`TextureStore.ts:1130`).
  Eine Form, die eine Ausgabe nie baut, verengt den Getter auf `undefined` — die Typen sagen, was sie baut.
- **`TextureFactory` fragt den Renderer bei jedem `getOptions()`, ohne Cache** (Abweichung von »mit Cache, sobald ein Wert
  > 0 kam«). Ein Cache hielte die 16 eines WebGPU-Backends vor `init()` fest, das three danach durch WebGL ersetzt; die Abfrage
  ist ein Feldzugriff in three (WebGL merkt sich den Wert selbst), und `getOptions()` läuft einmal je Textur, nicht je Frame.
  Solange der Renderer kein Maximum nennt, bleibt es bei 0 — keine Anisotropie für die Textur, die in diesem Moment entsteht —,
  wie es die Spec `a renderer that cannot name a maximum hands out none` schon festhält. Die Alternative »Factory erst nach
  `init()` bauen« fällt weg: three meldet `init()` nicht, und der Store müsste es selbst aufrufen.
- **`cmpAnimationsData` vergleicht Schlüssel in ihrer Reihenfolge.** Die Animationen entstehen in der Reihenfolge von
  `Object.entries()` (`:1317`); zwei Maps mit vertauschten Schlüsseln bauen verschiedene Animationen. Ein fälschliches
  »verschieden« kostet nur den Rebuild von heute, ein fälschliches »gleich« wäre ein Fehler. Dasselbe katalogweite JSON hat
  nach `JSON.parse()` dieselbe Reihenfolge.
- **Kein Split.** RES-010, PERF-011 und die PERF-012-Pins liegen im Image-Effect und am Signal, die ARCH-002 in derselben Datei
  umbaut; getrennt kollidierten sie. BUG-031 ist klein und unabhängig. Die Schleife findet ein umbenanntes Paket 13 nicht (wie
  in Paket 10 begründet). Der Reviewer läuft auf der stärksten Stufe.

## Vorgehen

Reihenfolge wie hier. Bei jedem Bugfix zuerst der Regressionstest, rot sehen, dann beheben; der rote Lauf gehört in den
Report. Konventionen aus dem Plan-Kopf gelten für jede Zeile, auch für Kommentare, TSDoc und CHANGELOG — keine Finding-IDs,
kein Rückblick auf den Vorzustand, Meldungen beginnen mit ihrem Subjekt (`AGENTS.md`, »Error and warning messages«).

### 1. BUG-031 — `TextureFactory` fragt den Renderer bei jeder Textur

1. Regressionstests in `TextureFactory.spec.ts`, `describe('anisotropy reaches the texture')`, vor dem Fix rot:
   - `a renderer that names its maximum only once it is initialized is asked again, and caps the next texture against it` —
     Stub `{getMaxAnisotropy}`, der bis `ready = true` einen `TypeError` wirft und danach 4 antwortet:
     `getOptions(['anisotropy']).anisotropy` ist vorher 1, danach 4; `update(new Texture(), 'anisotropy-2').anisotropy` danach 2.
   - `a renderer whose maximum changes caps against the one it names at the call` — Stub antwortet erst 16, dann 2:
     `getOptions(['anisotropy-4']).anisotropy` ist erst 4, dann 2.
   - `a renderer that cannot name a maximum hands out none` (`:61`) bleibt unverändert grün.
2. `TextureFactory.ts`: das Feld `#maxAnisotropy = 0` (`:170`) wird `readonly #maxAnisotropy: () => number`. Mit einer Zahl
   gebaut: einmal `toMaxAnisotropy(n)` und eine Funktion, die diesen Wert antwortet; mit einem Renderer:
   `() => readMaxAnisotropy(renderer)`. `getOptions()` ruft sie einmal je Aufruf (`:219`). Kein Cache; ein Kommentar am Feld
   sagt, warum (Backend vor `init()`, three ersetzt WebGPU durch WebGL).
3. TSDoc: `TextureOptions.anisotropy` (`:23–27`) und `@param maxAnisotropyOrRenderer` (`:178`) sagen: ein Renderer wird bei
   jedem `getOptions()`, `create()`, `update()` und beim Laden über `load()`/`loadAsync()` gefragt; die Factory klemmt auf das
   Maximum, das er in diesem Moment nennt; nennt er keins — ein WebGL-Backend vor `init()` —, bekommt die Textur keine
   anisotrope Filterung; eine Textur behält, womit sie gebaut wurde. Der Kommentar über `readMaxAnisotropy()` (`:158–160`)
   sagt »must not stop a texture from being built« statt »a factory«.
4. Browsertest in `packages/twopoint5d-testing/test/texture-factory-anisotropy.test.js`, eigenes `describe` ohne das
   `beforeEach` der Datei: `a factory built before init() of a WebGL backend caps against the maximum that backend names after it`
   — `new WebGPURenderer({forceWebGL: true})`, Canvas in den Body, `new TextureFactory(renderer, [])` **vor**
   `await renderer.init()`, danach `factory.update(new Texture(), 'anisotropy').anisotropy` gleich
   `Math.max(1, renderer.getMaxAnisotropy())`. Abbau im `finally` wie im `afterEach` der Datei (`await renderer.dispose()`,
   Canvas entfernen). `forceWebGL` ist nötig: der WebGL2-Lauf des Harness nimmt `navigator.gpu` weg
   (`web-test-runner.config.js:38–41`), ein `new WebGPURenderer()` startet dort trotzdem auf dem WebGPU-Backend, das vor
   `init()` 16 antwortet — nur ein WebGL-Backend von Anfang an kann vor `init()` nichts nennen. Rot vor dem Fix nur auf einer
   Maschine, deren WebGL ein Maximum über 1 nennt — im Report sagen, ob er hier rot war.
5. `TextureResource.ts`: der Kommentar über dem Fallback (`:795–798`, »A new renderer brings a new factory with its
   anisotropy maximum«) sagt, dass die neue Factory diesen Renderer fragt. Der Effect selbst bleibt.

### 2. ARCH-002, Teil 1 — die Atlas-Fetch-Logik in `fetchAtlasJson.ts`

1. Neues internes Modul `packages/twopoint5d/src/texture/fetchAtlasJson.ts` (nicht in `public-api.ts`):

   ```ts
   export type AtlasJsonFetch = {readonly json: AtlasJsonResponse} | {readonly failure: TextureResourceLoadFailure};
   export const fetchAtlasJson = async (url: string, signal: AbortSignal): Promise<AtlasJsonFetch | undefined> => …
   ```

   Inhalt ist der `try`-Block von heute (`TextureResource.ts:1097–1141` ohne das `finally`), die Meldungen wörtlich:
   `fetch(url, {signal})`; nach jedem `await` `undefined`, sobald `signal.aborted`; `!response.ok` → `failure` mit
   `{source: 'atlas', url, status, error: new Error(`TextureResource: fetch("${url}") answered ${status} ${statusText}`)}`;
   ein Body, den `isAtlasJsonResponse()` annimmt → `json`, ein `meta.image`, das ein String ist, über
   `resolveRelativeUrl(image, url)` aufgelöst; sonst `failure` ohne `status` mit
   `TextureResource: the response of "${url}" is no texture atlas json`; ein Wurf → `failure` `{source: 'atlas', url, error}`,
   bei abgebrochenem Signal `undefined`. TSDoc: die Funktion verwirft nie.
2. Der Fetch-Effect des Atlas (Schritt 3.4) ruft sie; das `finally`, das `#atlasFetch` freigibt, und der Rest bleiben im
   Effect. Der Kommentar »No closing .catch()« sagt, dass `fetchAtlasJson()` nie verwirft.
3. Spec `fetchAtlasJson.spec.ts` (`vi.spyOn(globalThis, 'fetch')`): ein relatives `meta.image` gegen eine absolute URL
   (`https://example.test/a/atlas.json` + `atlas.png` → `https://example.test/a/atlas.png`); ein json ohne `image` bleibt ohne;
   404 → `failure` mit `status: 404` und der Meldung; ein Body, der kein Atlas ist → `failure` ohne `status`; `fetch`
   verwirft → `failure` trägt den Fehler; abgebrochen, bevor die Antwort kommt → `undefined`; abgebrochen während `json()` →
   `undefined`. Verschobener Code, kein Rot verlangt; die Fetch-Specs in `TextureResource.spec.ts` bleiben grün.

### 3. ARCH-002, Teil 2 — eine Klasse je Form

Alles in `TextureResource.ts`. Öffentliche Namen und Signaturen exakt so:

1. **`export abstract class TextureResource`** — `protected constructor(id: string, type: TextureResourceType)`. Wirft, wenn
   `new.target === TextureResource` (nur aus JavaScript erreichbar), einen `TypeError`:
   `new TextureResource(): TextureResource is the base of the three shapes of resource — build an ImageTextureResource, a TileSetTextureResource or an AtlasTextureResource, or call TextureResource.fromImage(), fromTileSet() or fromAtlas()`.
   - Bleibt öffentlich: `static fromImage(id, imageUrl, textureClasses?): ImageTextureResource`,
     `static fromTileSet(id, imageUrl, tileSetOptions, textureClasses?, frameBasedAnimations?): TileSetTextureResource`,
     `static fromAtlas(id, atlasUrl, overrideImageUrl?, textureClasses?, frameBasedAnimations?): AtlasTextureResource`
     (Parameter wie heute, `new <Unterklasse>(id)` und dieselben Schreibzugriffe im `batch()`); `readonly id`,
     `readonly type: TextureResourceType`, `refCount`, `get imageUrl(): string | undefined` **ohne Setter**,
     `imageCoords`, `atlas`, `tileSet`, `frameBasedAnimations`, `texture` (Getter), `textureClasses`, `textureFactory`,
     `renderer` (get/set), `activate(): this`, `load(): this` (deprecated, wie heute), `dispose()`. Intern wie heute:
     `[changeRefCount]`, `[imageSource]`, `[loadFailureFor]`, `[subTypesOutOfReach]`.
   - Verlässt die Basis: der Setter `imageUrl`; `atlasUrl`, `atlasJson`, `overrideImageUrl`, `atlasAdapter`,
     `tileSetOptions`, `frameBasedAnimationsData` (get/set); `[atlasAdapterPicker]`.
   - Bleibt in der Basis: Image-Effect samt `#publishImageWithoutTexture()`/`#takeBackImage()`, die Bridges, der
     Fallback-Factory-Effect, `#loadFailures`/`#fail()`, `#ownTexture*`, `dispose()`; die Signale `#imageUrl`,
     `#imageCoords`, `#imageUrlOfCoords`, `#texture`, `#textureFactory`, `#renderer`, `#textureClasses`, `#atlas`, `#tileSet`,
     `#frameBasedAnimations`, `#adapterAnimations`, `#frameBasedAnimationsData`; `#registerAnimationsEffect()`.
     Modulweit wie heute: `LoadStep`, `SUBTYPES_HELD_BACK_BY_STEP`, `SUBTYPES_BUILT_BY_TYPE`, `DERIVED_FROM_IMAGE_PRIORITY`,
     `cmpTexClasses`, `cmpShallow`, `animationDataShape()`, `wrongAnimationDataError()`, `wrongShapeError()`,
     `derivedImageUrlError()`.
2. **`export class ImageTextureResource extends TextureResource`** — `declare readonly type: 'image'`;
   `constructor(id: string)` → `super(id, 'image')`; `get imageUrl()` und `set imageUrl(url: string | undefined)`, mit
   `override`, wie `noImplicitOverride` es verlangt (der Getter steht neben dem Setter, sonst verdeckt der Setter auf dem
   Prototyp den Getter der Basis; dasselbe in 3.3); `override get atlas(): undefined`,
   `override get tileSet(): undefined`, `override get frameBasedAnimations(): undefined`. `registerShapeEffects()` leer.
3. **`export class TileSetTextureResource extends TextureResource`** — `declare readonly type: 'tileset'`;
   `constructor(id: string)`; `imageUrl` get/set; `tileSetOptions` get/set mit eigenem `#tileSetOptions`-Signal
   (`cmpShallow`, eingefrorene Kopie, TSDoc wie heute `:491–495`); `frameBasedAnimationsData` get/set;
   `registerShapeEffects()` registriert den Tile-Set-Effect und den Animations-Effect von heute (`:1003–1071`).
4. **`export class AtlasTextureResource extends TextureResource`** — `declare readonly type: 'atlas'`;
   `constructor(id: string)`; `atlasUrl`, `atlasJson`, `overrideImageUrl`, `atlasAdapter`, `frameBasedAnimationsData`
   get/set mit dem Verhalten und TSDoc von heute; `imageUrl` nur lesend (geerbt); `override get tileSet(): undefined`;
   `/** @internal */ [atlasAdapterPicker]?: (json: TexturePackerJsonData) => AtlasAdapter` (von der Basis hierher);
   eigene `#`-Felder für die Atlas-Signale, `#atlasFetch`, `#atlasFetchDue`; `registerShapeEffects()` registriert die vier
   Effects und den Animations-Effect von heute (`:1073–1291`), samt der zwei `touch()` am Ende; der Fetch-Effect ruft
   `fetchAtlasJson()`.
5. **`export type AnyTextureResource = ImageTextureResource | TileSetTextureResource | AtlasTextureResource`** — TSDoc: was
   `TextureStore` aushändigt; `resource.type` verengt auf die Klasse der Form.
6. **Kanal Basis ↔ Form:** ein modulinternes `interface ShapeContext` mit `imageUrl`, `imageCoords`, `imageUrlOfCoords`,
   `atlas`, `tileSet`, `frameBasedAnimations`, `adapterAnimations`, `frameBasedAnimationsData` (je das `Signal` der Basis),
   `isDisposed(): boolean`, `clearFailure(step: LoadStep): void`, `fail(step: LoadStep, failure: TextureResourceLoadFailure): void`,
   `registerAnimationsEffect(...)` (Signatur von `#registerAnimationsEffect()` heute, `:1297–1301`). Die Basis baut den
   Kontext einmal in ihrem Konstruktor; ein `static {}`-Block in `TextureResource` belegt die modulinterne
   `let shapeContextOf: (resource: TextureResource) => ShapeContext`; beides wird nicht exportiert. Jede Form holt den Kontext
   in ihrem Konstruktor (`readonly #context = shapeContextOf(this)`). `activate()` ruft
   `/** @internal */ protected abstract registerShapeEffects(): void` dort, wo heute die Effects der Form registriert werden
   (nach dem Image-Effect, vor dem Fallback-Factory-Effect); die Reihenfolge der Registrierung bleibt damit dieselbe. Kein
   weiteres `protected` Mitglied, kein Cast zwischen Basis und Unterklasse.
7. **Netz für JavaScript:** ein modulinterner Helfer legt nach den Klassen per `Object.defineProperty` auf den Prototyp jeder
   Form einen Accessor je Eingabe einer anderen Form: der Getter antwortet `undefined`, der Setter wirft
   `wrongShapeError(this, name)`, auf einer disposed Ressource schweigt er (wie heute). Image: `tileSetOptions`, `atlasUrl`,
   `atlasJson`, `overrideImageUrl`, `atlasAdapter`, `frameBasedAnimationsData`; TileSet: `atlasUrl`, `atlasJson`,
   `overrideImageUrl`, `atlasAdapter`; Atlas: `tileSetOptions`. Auf `AtlasTextureResource.prototype` bekommt `imageUrl` den
   Getter der Basis und einen Setter, der `derivedImageUrlError(this)` wirft (disposed: schweigt). Diese Accessoren stehen in
   keinem Typ. Der Kommentar daran und die Kommentare über `wrongShapeError()`/`derivedImageUrlError()` sagen: TypeScript
   lehnt den Schreibzugriff ab, das Netz fängt JavaScript, das sonst still eine eigene Eigenschaft anlegte, die die Ressource
   nie liest.
8. **TSDoc in Listen:**
   - `TextureResourceEvents` (`:68–110`): je Event ein Punkt — die fünf zurückgehaltenen Werte; `error` mit einem Unterpunkt
     je `source` (`image`, `atlas` mit und ohne `status`, `texture`, `frameBasedAnimations` und die Gründe, aus denen ein
     Eintrag übersprungen wird); `dispose`; dazu die Regeln zu werfenden Listenern.
   - Klassen-TSDoc der Basis (`:232–274`): was eine Ressource ist und die drei Klassen; Liste der gemeinsamen Eingaben,
     Liste der Ausgaben; Liste »was zurückgenommen wird und wann« (ein Punkt je Regel); Liste »ohne Texture-Factory«. Was nur
     eine Form betrifft — `imageUrl` als Ein- oder Ausgabe, `tileSetOptions`, `atlasJson` —, wandert in das TSDoc ihrer Klasse.
   - TSDoc von `atlasJson` (`:415–434`): Liste.
   - Keine Regel geht verloren; der Reviewer hält die Listen gegen den Text von heute.

### 4. PERF-011 — `frameBasedAnimationsData` nach Inhalt vergleichen

1. Regressionstests, vor dem Fix rot:
   - `TextureStore.spec.ts`: `a parse of the same catalog again keeps the frameBasedAnimations of a resource and calls on(id, 'frameBasedAnimations') no second time`
     — ein Tile-Set-Item mit `frameBasedAnimations`; `parse(catalog)`, warten, `parse(structuredClone(catalog))`, warten:
     `resource.frameBasedAnimations` ist dieselbe Instanz, der Callback lief einmal. Dasselbe für ein Atlas-Item (Fetch- und
     Image-Mock wie in den Nachbartests).
   - `TextureResource.spec.ts`: `frameBasedAnimationsData equal to the current, written as another object, keeps the animations`
     (Tile Set) und `a frameNameQuery RegExp of the same source and flags keeps the animations, another flag builds new ones`
     (Atlas; der `RegExp` braucht im Test einen Cast, `FrameBasedAnimationsDataByAtlas.frameNameQuery` ist `string`).
2. Neues internes Modul `packages/twopoint5d/src/texture/cmpAnimationsData.ts` (nicht in `public-api.ts`):
   `export const cmpAnimationsData = (a: FrameBasedAnimationsDataMap | undefined, b: FrameBasedAnimationsDataMap | undefined): boolean`.
   Regeln: `Object.is(a, b)` → gleich; beide `RegExp` → `source` und `flags` gleich; beide Arrays → gleiche Länge, Element für
   Element; beide einfache Objekte (Prototyp `Object.prototype` oder `null`) → dieselben eigenen aufzählbaren Schlüssel in
   derselben Reihenfolge (`Object.keys()`), Wert für Wert; alles andere → verschieden. Ein Paar, das auf dem Weg schon
   verglichen wird, gilt als gleich (Zyklen über eine `Map<object, object>` der besuchten Paare). Kommentar: warum die
   Reihenfolge zählt.
3. Spec `cmpAnimationsData.spec.ts`: tiefe Kopie gleich; vertauschte Schlüssel verschieden; `undefined` gegen `{}`
   verschieden; ein Feld mit `undefined` gegen ein fehlendes verschieden; `RegExp` gleich, Flags verschieden, String gegen
   `RegExp` verschieden; Arrays Länge und Element; `NaN` gleich `NaN`; eine geänderte Zahl tief drin verschieden; ein Zyklus in
   beiden Graphen terminiert.
4. `#frameBasedAnimationsData = createSignal(undefined, {compare: cmpAnimationsData, attach: this})` (heute `:340`).
5. TSDoc von `frameBasedAnimationsData` (Tile Set und Atlas): verglichen wird der Inhalt — Daten gleich den aktuellen, etwa
   derselbe Katalog noch einmal geparst, behalten die Animationen, und kein Event geht hinaus; das Objekt wird gehalten, wie
   es geschrieben wurde, eine Änderung daran nach dem Schreiben sieht die Ressource erst mit anderen Daten.

### 5. RES-010 — eine geleerte `imageUrl` gibt das Bild frei

1. Regressionstest in `TextureResource.spec.ts`, vor dem Fix rot:
   `a resource on its own lets go of the image it fetched last once its imageUrl is cleared: the same url fetches again` —
   `TextureResource.fromImage('hero', 'hero.png')`, `activate()`, warten; `imageUrl = undefined`, warten;
   `imageUrl = 'hero.png'`, warten → `ImageLoader.prototype.loadAsync` zweimal gerufen (vorher einmal).
2. Im `!url`-Zweig des Image-Effects (heute `:858–861`) `standalone = undefined`. Der Kommentar an `standalone` (`:827–830`)
   sagt, dass eine geleerte URL es loslässt.

### 6. PERF-012 — Pin-Tests für den Bildcache der Ressource ohne Store

In `TextureResource.spec.ts`, neben `the factory that arrives builds it from the same fetch` (`:2396`), grün vor und nach dem
Umbau (pinnen Bestand, kein Rot verlangt):

- `a resource on its own fetches its image once across a change of its texture classes` — mit Factory, nach dem ersten Bau
  `textureClasses = ['nearest']`: `loadAsync` einmal, die Textur ist eine neue, aus demselben Bild gebaut.
- `a resource on its own fetches its image once across another renderer` — Renderer-Stub A, dann B: `loadAsync` einmal, eine
  neue Factory.

### 7. `TextureStore` reicht die Union aus

- `#resources: Map<string, AnyTextureResource>` (`:342`); `onResource(id, callback: (resource: AnyTextureResource) => void)`
  (`:471`); `whenResource(id): Promise<AnyTextureResource>` (`:524`); `#followResource()` (`:491`) ebenso.
- `parse()` (`:871–959`): vor dem Schreiben der Eingaben einer Form verengt der Code über `resource.type` (die
  Konfliktprüfung davor sichert, dass der Typ passt); keine Casts.
- `resource[atlasAdapterPicker] ??= this.#pickAtlasAdapter` nur für `type === 'atlas'` (`:942`, `:1078`).
- `#subscribe()`, `#getOnce()`, `outOfReachError()` dürfen beim Basistyp `TextureResource` bleiben.
- TSDoc von `whenResource()` und `onResource()` nennt `AnyTextureResource` und die Verengung über `type`.
- Typtests in `TextureStore.spec.ts` (`expectTypeOf`): `whenResource()` löst `AnyTextureResource` auf; nach
  `if (resource.type === 'atlas')` ist es `AtlasTextureResource`.

### 8. Specs mitziehen

- `TextureResource.spec.ts`:
  - die fünf Aufrufe `new TextureResource(id, type)` (`:1770`, `:1798`, `:1812`, `:2638`, `:2769`) →
    `new AtlasTextureResource(id)`, `new TileSetTextureResource(id)`, `new ImageTextureResource(id)`, dazu die drei
    Testnamen, die ihn nennen (`:1763`, `:1792`, `:1811`); `describe('a resource built with its constructor')` (`:1762`)
    handelt von den Konstruktoren der drei Klassen;
  - neu: `new TextureResource(id, 'atlas')` aus JavaScript wirft den `TypeError` aus Schritt 3.1 — der einzige erlaubte
    Cast (über `unknown` auf einen Konstruktortyp), er stellt JavaScript nach;
  - `describe('setters on the wrong shape')` (`:1709–1759`), `carries no input of another shape` (`:1811–1835`) und
    `:2769–2773`: jeder Schreibzugriff mit `// @ts-expect-error <Grund>` und der Laufzeiterwartung von heute; neu: eine
    Bild-Ressource lehnt `frameBasedAnimationsData` ab; das Lesen einer fremden Eingabe antwortet `undefined`, und die
    Ressource hat danach keine eigene Eigenschaft dieses Namens;
  - Typtests (`expectTypeOf`): `fromImage()`/`fromTileSet()`/`fromAtlas()` antworten die Unterklasse, `activate()` dieselbe;
    `ImageTextureResource#atlas` ist `undefined`; `AtlasTextureResource#imageUrl` lässt sich nicht schreiben
    (`@ts-expect-error`).
- `TextureStore.spec.ts`: Schreibzugriffe auf Ressourcen aus `whenResource()`/`onResource()` (`:1942`, `:2001`, `:2205`,
  `:2507`, `:2545` und jeder weitere, den `pnpm typecheck` meldet) verengen vorher über `type`, etwa mit einem lokalen Helfer,
  der bei einer anderen Form wirft; `:2001` (`imageUrl` auf einem Atlas) wird `@ts-expect-error` plus Laufzeiterwartung.
- `packages/twopoint5d-testing/test/*.js` und Lookbook: kein Aufrufer der entfernten Oberfläche
  (`texture-store-on.test.js:347` liest `imageUrl`, `:384` nutzt `onResource()`); `pnpm typecheck` entscheidet.

### 9. Doku

- `packages/twopoint5d/docs/architecture.md` § `texture/` (`:119–123`): ein Satz — eine Ressource ist je nach Form ein
  `ImageTextureResource`, `TileSetTextureResource` oder `AtlasTextureResource` auf der Basis `TextureResource`, der Store
  reicht `AnyTextureResource` aus.
- `packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md` §6.3 (`:407–416`): `atlasAdapter` ist eine Eingabe
  von `AtlasTextureResource`; die anderen Formen haben sie nicht in ihrem Typ, ein Schreibzugriff aus JavaScript wirft den
  `TypeError` von `wrongShapeError()`.
- `packages/twopoint5d/docs/resource-lifecycle.md:25–30` bleibt (verlinkt die Basis, die Aussage gilt für jede Form).
- Kein `ts check`-Block der Doku nennt `TextureResource` (geprüft); entsteht einer, compiliert ihn der Gate.

### 10. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, `[Unreleased]`, Skill `updating-changelog`)

- **Added:** `ImageTextureResource`, `TileSetTextureResource`, `AtlasTextureResource` — eine Klasse je Form mit den
  Eingaben dieser Form — und `AnyTextureResource`, die Union, die `TextureStore` aushändigt.
- **Changed:**
  - `TextureResource` ist die abstrakte Basis der drei; die Eingaben einer Form stehen nur auf ihrer Klasse,
    `TextureResource.fromImage()`/`fromTileSet()`/`fromAtlas()` antworten die Klasse der Form, `activate()` und `load()`
    antworten `this`, `TextureStore#whenResource()` und `#onResource()` reichen `AnyTextureResource` aus (**BREAKING** für
    TypeScript). See the Migration Guide.
  - `new TextureResource(id, type)` wirft einen `TypeError`; `new ImageTextureResource(id)` usw. bauen eine Ressource
    (**BREAKING**). See the Migration Guide.
  - `frameBasedAnimationsData` auf einer Bild-Ressource wirft in JavaScript den `TypeError` der fremden Eingaben
    (**BREAKING**).
  - `frameBasedAnimationsData` wird nach Inhalt verglichen: derselbe Katalog noch einmal geparst baut keine neuen
    Animationen und meldet keine.
  - `TextureFactory` fragt ihren Renderer bei jeder Textur nach dem Anisotropie-Maximum.
- **Fixed:** eine Factory, die vor `renderer.init()` eines WebGL-Backends gebaut wurde, gibt Texturen danach die Anisotropie,
  die das Backend nennt; eine `TextureResource` ohne Store hält nach geleerter `imageUrl` kein Bild mehr.
- **Migration Guide**, neuer Abschnitt `#### The shapes of TextureResource`: vorher als einfacher `ts`-Block, nachher als
  `ts check`-Block, der gegen die gebaute Bibliothek compiliert (`new AtlasTextureResource('hero')`, eine Ressource aus
  `whenResource()` über `type` verengen, bevor eine Eingabe der Form geschrieben wird).
- Einträge auf Englisch, ohne Rückblick auf den Vorzustand (»previously«, »now« als Gegensatz zu früher).

## Findings im Volltext

**ARCH-002 · low · `packages/twopoint5d/src/texture/TextureResource.ts:260`** (weitere: `:376`, `:391`, `:484`) — TextureResource nach Ressourcenform typisieren statt zur Laufzeit zu werfen
Eine Klasse von 1227 Zeilen trägt drei Formen (`image`, `tileset`, `atlas`) mit formspezifischen Signalen, Effects,
Fetch-Logik und Fehlerpfaden. Welche Setter erlaubt sind, entscheidet `type` zur Laufzeit: `atlasUrl`, `atlasJson`,
`overrideImageUrl`, `atlasAdapter`, `tileSetOptions` werfen auf der falschen Form einen `TypeError`, `imageUrl` wirft auf
`atlas`. Der Typ `TextureResource` verrät davon nichts, `store.whenResource()` liefert immer denselben breiten Typ. Dazu kommen
TSDoc-Blöcke von 40+ Zeilen Fließtext (z. B. `TextureResourceEvents`, Zeile 67–109), in denen die Regeln schwer auffindbar
sind. Jede Änderung an einer Form muss die beiden anderen mitlesen.
Evidenz: `set imageUrl(val) { if (this.#disposed) return; if (this.type === 'atlas') throw derivedImageUrlError(this); … }`
Empfehlung: Mittelfristig je Form eine Unterklasse oder zumindest einen diskriminierten Typ (`TextureResource<'atlas'>`) mit
nur den passenden Settern einführen und die Atlas-Fetch-Logik in ein eigenes internes Modul ziehen; lange TSDoc-Absätze in
Listen gliedern. (effort L)

**PERF-011 · low · `packages/twopoint5d/src/texture/TextureResource.ts:325`** (weitere: `TextureStore.ts:818`, `:837`) — frameBasedAnimationsData strukturell vergleichen
`#textureClasses` und `#tileSetOptions` haben einen Wertevergleich (`cmpTexClasses`, `cmpShallow`),
`#frameBasedAnimationsData` vergleicht per Identität. Jedes `parse()` schreibt das frisch aus JSON erzeugte Objekt, also baut
jede Ressource mit Animationen bei jedem Re-Parse desselben Katalogs ein neues `FrameBasedAnimations`, emittiert es, und jeder
`on(id, 'frameBasedAnimations')`-Subscriber reagiert erneut (typisch: neuer `bakeDataTexture()`, neue DataTexture). Das ist
uneinheitlich mit den beiden Nachbar-Inputs und kostet bei Hot-Reload unnötige Bakes.
Evidenz: `#frameBasedAnimationsData = createSignal<FrameBasedAnimationsDataMap | undefined>(undefined, {attach: this});`
Empfehlung: Einen strukturellen `compare` setzen (tiefer Vergleich der Einträge, RegExp über `source`/`flags`), analog zu
`cmpShallow`. (effort S)

**PERF-012 · low · `packages/twopoint5d/src/texture/TextureResource.ts:810`** — Standalone-TextureResource: Bild bei Klassen- oder Renderer-Wechsel nicht neu laden
Ohne Store fällt der Image-Effect auf `new ImageLoader().loadAsync(url)` zurück. Jeder neue Lauf des Effects – geänderte
`textureClasses`, neuer Renderer und damit neue Fallback-Factory – startet einen neuen Request samt Decode desselben Bildes,
obwohl sich die URL nicht geändert hat. Der Store verhindert das mit seinem Lease-Cache; die Standalone-Resource hat keinen.
Evidenz: `(lease?.image ?? new ImageLoader().loadAsync(url)).then(`
Empfehlung: Das zuletzt geladene Bild samt URL in der Resource halten und bei gleicher URL wiederverwenden, oder der
Standalone-Resource eine private Instanz der Store-`TextureImageSource` geben. (effort S; origin: induced, Lauf 2026-09-26)

**RES-010 · low · `packages/twopoint5d/src/texture/TextureResource.ts:831`** (weitere: `:859`) — Geleerte `imageUrl` gibt das zuletzt geladene Bild frei
Die Closure `standalone` hält das zuletzt geladene Bild nach geleerter `imageUrl` (`#takeBackImage()`) bis zum Dispose der
Ressource. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Im `!url`-Zweig `standalone = undefined` setzen; Spec, der nach dem Leeren keinen Verweis mehr findet.
(effort S; origin: induced, Lauf 2026-10-21)

**BUG-031 · low · `packages/twopoint5d/src/texture/TextureFactory.ts:189`** (weitere: `TextureFactory.ts:161`, `TextureStore.ts:360`, `TextureResource.ts:760`) — Anisotropie-Maximum der TextureFactory lazy vom Renderer lesen
Die Factory liest `renderer.getMaxAnisotropy()` genau einmal im Konstruktor. three 0.186 beantwortet das über
`backend.capabilities`, das beim WebGL-Backend bis `init()` `null` ist; der `catch` macht daraus 0. Store und
Standalone-Resource bauen ihre Factory in dem Moment, in dem `renderer` gesetzt wird – typischerweise vor
`await renderer.init()`. Mit `forceWebGL` bleibt `anisotropy`/`anisotropy-4` dann für die Lebensdauer der Factory wirkungslos,
ohne Meldung. Umgekehrt meldet das WebGPU-Backend vor `init()` pauschal 16, auch wenn three danach auf WebGL zurückfällt.
Evidenz: `this.#maxAnisotropy = typeof maxAnisotropyOrRenderer === 'number' ? … : readMaxAnisotropy(maxAnisotropyOrRenderer);`
Empfehlung: Den Renderer statt der Zahl halten und das Maximum in `getOptions()` bei Bedarf lesen (mit Cache, sobald ein Wert
> 0 kam), oder im Store die Factory erst nach `renderer.init()` (bzw. bei `renderer.initialized`) bauen. (effort S; origin:
induced, Lauf 2026-09-26)

## Urteil des Reviewers (Zug 3, 2026-10-22, Commit 2ea485d8)

- **ARCH-002 behoben** — abstrakte Basis `TextureResource.ts:318`, Unterklassen `:998` (Image), `:1046` (TileSet), `:1196`
  (Atlas), Union `:1520`; Kanal `static {}` `:368–370` und `ShapeContext` `:230–251`; JS-Netz `:1527–1560`; Fetch in
  `fetchAtlasJson.ts:20`, Aufruf `TextureResource.ts:1358`; TSDoc als Listen (Events `:69–113`, Basis `:255–317`, `atlasJson`
  `:1238–1258`), gegen HEAD gehalten ohne verlorene Regel; Store reicht die Union aus (`TextureStore.ts:475`, `:532`, Verengung
  in `parse()` ab `:896`).
- **PERF-011 behoben** — `TextureResource.ts:383–386` (`compare: cmpAnimationsData`), `cmpAnimationsData.ts:54`; Tests
  `TextureStore.spec.ts:1691`, `TextureResource.spec.ts:788`, `:808`.
- **PERF-012 gegenstandslos** (behoben vor dem Lauf in `ac549468`), Pin-Tests `TextureResource.spec.ts:2651`
  (Texturklassen-Wechsel) und `:2673` (anderer Renderer).
- **RES-010 behoben** — `TextureResource.ts:803` (`standalone = undefined` im `!url`-Zweig), Kommentar `:770–774`, Test
  `TextureResource.spec.ts:2431`.
- **BUG-031 behoben** — `TextureFactory.ts:177–181`, `:204–210`, `:237`, TSDoc `:26–32`, `:189–193`; Specs
  `TextureFactory.spec.ts:74`, `:93`; Browsertest `texture-factory-anisotropy.test.js:57`; Kommentar `TextureResource.ts:729–733`.

Abweichungen des Implementierers (vom Reviewer gedeckt): die Regel »every resource takes its `frameBasedAnimations` back while
its data is cleared« ist für den Atlas mit lesendem Adapter genauer gefasst; `new TextureResource()` aus JS räumt vor dem Wurf
die schon angelegten Signale ab (`SignalGroup.delete(this)`); Typtest auch für den Callback von `onResource()`.

### Kleine Befunde

- `cmpAnimationsData.ts:11–20`, `:26` — die Zykluserkennung merkt sich je `a` nur einen Partner; Graphen mit Zyklen
  verschiedener Periode (`a.x = a` gegen `b1.x = b2, b2.x = b1`) laufen in `RangeError: Maximum call stack size exceeded`,
  gegen das Versprechen im Kommentar `:22–23`. Aus JSON kommt nie ein Zyklus. Abhilfe: `Map<object, Set<object>>`.
- `TextureResource.ts:434–436` gegen `:1098`, `:1320` — der Kommentar sagt, die Setter der Form prüfen das Dispose-Flag; die
  zwei `frameBasedAnimationsData`-Setter tun es nicht (ohne Schaden, die Signale sind nach `dispose()` gelöscht).
- `TextureResource.ts:761–767` mit `stripInternal` — `registerShapeEffects()` fehlt im veröffentlichten d.ts; eine fremde
  Unterklasse kompiliert und stürzt in `activate()` ab. Ein Satz im Klassen-TSDoc, dass die Basis nur die drei Formen der
  Bibliothek trägt, reicht.
- `CHANGELOG.md:103` — »… `source` and `flags` —: data equal …«, Gedankenstrich vor Doppelpunkt.
