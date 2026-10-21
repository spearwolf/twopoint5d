# Paket 3 — Texture: Store und Atlas laden, warten und geben frei, wie sie es zusagen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-007 (medium), BUG-008 (medium), BUG-009 (medium), RES-003 (medium), ASYNC-002 (medium), API-001 (medium)
- Ziel: `DynamicAtlas#add()` lehnt ungeladene Bilder immer ab, und `TextureStore` lädt ohne Renderer die GPU-freien Werte, weist unerreichbare Subtypes ab, trägt disposte Ressourcen aus, sequenziert überlappende `loadAsync()`-Aufrufe und bietet neben dem geliehenen `getAsync()` eine haltende Variante.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/texture/DynamicAtlas.ts`, `packages/twopoint5d/src/texture/DynamicAtlas.spec.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts`, `packages/twopoint5d/src/texture/TextureResource.spec.ts`
  - `packages/twopoint5d/src/texture/TextureStore.ts`, `packages/twopoint5d/src/texture/TextureStore.spec.ts`
  - `packages/twopoint5d/src/texture/internals.ts`
  - `packages/twopoint5d/docs/sprites.md`, `packages/twopoint5d/docs/architecture.md`, `packages/twopoint5d/docs/resource-lifecycle.md`
  - `packages/twopoint5d/CHANGELOG.md`
- Nicht anfassen: `public-api.ts` (exportiert `TextureStore.ts` schon mit `export *`), Lookbook, Browser-Tests (jeder Store dort hat einen Renderer; keine Render- oder GPU-Buffer-Änderung in diesem Paket).
- Vorher lesen: `AGENTS.md`; `packages/twopoint5d/docs/resource-lifecycle.md`; `TextureStore.ts`, `TextureResource.ts`, `DynamicAtlas.ts` und `internals.ts` **ganz** (die Signal-, Event- und Besitzlogik ergibt nur am Stück Sinn); die Skills `using-eventize`, `using-signalize`, `updating-changelog`. Die Specs sind groß (`TextureStore.spec.ts` 3 051 Zeilen, `TextureResource.spec.ts` 2 714) — dort die Helfer oben (`flushMicrotasks`, `makeRendererStub`, `settleWithin`) und die genannten Abschnitte lesen.
- Vorgehen: sieben Schritte, je Korrektheitsfehler zuerst der Regressionstest, rot sehen (den roten Lauf in den Report), dann der Fix. Zeilennummern beziehen sich auf den Stand von `4bf14f2e`.

  1. **`DynamicAtlas#add()` lehnt ein ungeladenes Bild immer ab** (BUG-007)
     - `#sizeOf()` (`DynamicAtlas.ts:361–384`): für jede Bild-Source (`typeof source !== 'function'`) zuerst `const natural = this.#assertLoaded(name, source, 'add()')`; ohne `size` `natural` zurückgeben, mit `size` weiter wie heute die gegebene Größe prüfen und aufrunden. Der Pfad des Draw-Callbacks bleibt, wie er ist.
     - `#assertLoaded()` (`DynamicAtlas.ts:437–444`): zusätzlich ablehnen, wenn `'complete' in image && image.complete === false`. Nur ein `HTMLImageElement` trägt `complete`; `ImageBitmap` und die Canvas-Typen haben keins und bleiben unberührt. Dieselbe Meldung wie heute (`${WHERE}: the image of "${name}" has not loaded yet — await image.decode() before ${call}`). Den Kommentar über der Methode auf beide Fälle umschreiben: natürliche Größe 0, oder noch ladend — die Breite kennt der Browser schon im Zustand »partially available«.
     - `redraw()` ruft `#assertLoaded()` schon heute und bekommt den `complete`-Check ohne eigene Änderung.
     - TSDoc von `add()`: `@throws {Error} … an image element that has not loaded` um »with or without a size« ergänzen.
     - Regressionstests in `DynamicAtlas.spec.ts` neben `refuses an image element that has not loaded` (Zeile 332):
       - `refuses an image element that has not loaded when a size is given` — `{width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, complete: false}` mit `{width: 8, height: 8}`: wirft mit der `add()`-Meldung; danach `atlas.atlas.size === 0`, kein `drawImage`-Aufruf, und ein folgendes `add()` packt bei `{x: 1, y: 1}` (keine Zelle genommen).
       - `refuses an image element that is still loading although its natural size is known` — `{width: 9, height: 5, naturalWidth: 9, naturalHeight: 5, complete: false}` ohne `size`: wirft.
       - `redraw()` eines vorhandenen Frames mit `{…, naturalWidth: 9, naturalHeight: 5, complete: false}` wirft mit der `redraw()`-Meldung, bevor die Zelle gelöscht wird (kein `clearRect` nach dem `add()`).
       - Die Fakes ohne `complete` (`image()` in Zeile 19, das Objekt in Zeile 321) bleiben gültig; die bestehenden Tests bleiben grün.

  2. **Ein Store ohne Renderer lädt die GPU-freien Werte** (BUG-008) — Richtung laut »Entscheidungen« vom 2026-10-21: Bild, `imageCoords`, `atlas`, `tileSet`, `frameBasedAnimations` ohne Renderer; `texture` wartet auf ihn.
     - Image-Effect `#registerImageEffect()` (`TextureResource.ts:778–875`):
       1. Das `if (!factory) return;` (Zeile 797) fällt. Ein Lauf ohne Factory holt das Bild genauso — Lease aus `this[imageSource]`, sonst der Standalone-Weg aus Punkt 4 — und baut `new TextureCoords(0, 0, image.width, image.height)`, aber keine Textur.
       2. Neues privates Feld `#ownTextureUrl?: string` neben `#ownTexture` (Zeile 572): die url, aus der `#ownTexture` gebaut wurde. Im Factory-Pfad zusammen mit `this.#ownTexture = texture` gesetzt (Zeile 831), in `#takeBackImage()` und in `dispose()` geleert.
       3. Ohne Factory, nach dem Laden, ein Batch mit derselben Fehlerbehandlung wie im Factory-Pfad (`publishError`, danach `emitSafe(this, OnError, {source: 'texture', id: this.id, error})`): `#imageUrlOfCoords.set(url)` und `#imageCoords.set(coords)`. Ist `#ownTexture` gesetzt und `#ownTextureUrl !== url`, beschreibt die Textur ein anderes Bild: im selben Batch `#texture.set(undefined)`, `#ownTexture` und `#ownTextureUrl` leeren und die alte Textur nach dem Batch im `finally` disposen — dasselbe Muster wie `#takeBackImage()` (Zeile 882–894). Bei derselben url (Factory nur geleert, oder `textureClasses` ändern sich ohne Factory) bleibt die Textur stehen; der bestehende Test `a textureFactory that is cleared leaves the texture in place` (`TextureResource.spec.ts:2327`) bleibt grün. Ein Throw beim Bau der Koordinaten geht wie heute an `this.#fail('image', {source: 'texture', id: this.id, error})`.
       4. Standalone-Resource ohne `imageSource` (kein Store; heute `new ImageLoader().loadAsync(url)` je Lauf, Zeile 810): weil jetzt der Lauf ohne Factory lädt und der Lauf mit der ankommenden Factory noch einmal, hält `#registerImageEffect()` in einer Closure-Variablen das Promise der zuletzt geladenen url — `let standalone: {url: string; image: Promise<HTMLImageElement>} | undefined` — und gibt es für dieselbe url wieder aus. Ein abgelehntes Promise wird verworfen (`entry.image.catch(() => { if (standalone === entry) standalone = undefined; })`), damit der nächste Lauf neu versucht. Im Store übernimmt das der Cache mit der um eine Microtask verzögerten Freigabe (`TextureStore.ts:309–348`); dort ändert sich nichts.
       5. Den Kommentar Zeile 791–792 (»No factory is a "not yet" instead …«) auf das neue Verhalten umschreiben: ohne Factory wird das Bild geladen und alles außer der Textur publiziert; die Textur der letzten Factory bleibt, solange sie aus demselben Bild stammt.
     - TSDoc:
       - Klassen-TSDoc `TextureResource`, Absatz Zeile 244–250 (»A `textureFactory` that is cleared takes nothing back …«): eine Resource ohne Factory lädt ihr Bild und publiziert `imageCoords` und was daraus gebaut wird (`atlas`, `tileSet`, `frameBasedAnimations`); nur `texture` wartet auf eine Factory, und eine Textur aus einem anderen Bild als dem jetzt geladenen wird zurückgenommen.
       - `TextureStore#renderer` (`TextureStore.ts:273–285`): ohne Renderer lädt der Store Bilder und baut Koordinaten, Atlanten, Tile-Sets und Animationen; `texture` wartet, bis einer gesetzt ist.
       - Statisches `TextureStore.loadAsync()` (Zeile 197–214): der ausgelieferte Store hat keinen Renderer; ein `getAsync(id, 'texture')` wartet, bis `store.renderer` gesetzt ist.
       - `getAsync()` (Zeile 1034–1054): ein Satz dazu — `texture` wartet auf einem Store ohne Renderer, bis einer gesetzt ist.
     - Bestehender Test gegen das alte Verhalten: `does not leak signals or effects` (`TextureStore.spec.ts:305`) sagt im Kommentar »without a renderer there is no texture factory, so the effect reaches no loader«. Jetzt erreicht er den Loader: `ImageLoader.prototype.loadAsync` dort auf ein nie aufgelöstes Promise stubben, Kommentar anpassen, die Erwartungen bleiben. Weitere Tests in `TextureResource.spec.ts`, die `activate()` vor der Factory aufrufen und Ladeaufrufe zählen, mitziehen — dank Punkt 4 bleibt es bei einem Ladeaufruf je url.
     - Regressionstests (rot vor dem Fix):
       - `TextureStore.spec.ts`: `a store without a renderer loads the image, its coordinates, the atlas and the animations, and the texture waits for the renderer` — `new TextureStore()`, `fetch` antwortet mit dem `asepriteJson` aus dem `describe('atlas adapters')` (Zeile 2859), `ImageLoader.prototype.loadAsync` mit `{width: 16, height: 8}`; `getAsync('fighter', ['imageCoords', 'atlas', 'frameBasedAnimations'])` resolved (über `settleWithin` belegt, ohne Fix pending), `resource.texture` ist `undefined`; danach `store.renderer = makeRendererStub()` → `getAsync('fighter', 'texture')` resolved, und `ImageLoader.prototype.loadAsync` lief für die url genau einmal.
       - `TextureStore.spec.ts`: `the store TextureStore.loadAsync() hands out delivers a tile set without a renderer` — statisches `loadAsync(catalogUrl)`, ein Tile-Set-Item; `getAsync(id, 'tileSet')` resolved.
       - `TextureResource.spec.ts`: `without a factory the resource publishes its imageCoords and builds no texture, and the factory that arrives builds it from the same fetch` — `TextureResource.fromImage('hero', 'first.png')`, `activate()`, `flushMicrotasks()`: `imageCoords` gesetzt, `texture` `undefined`; `resource.renderer = stub` → die Textur kommt; `ImageLoader.prototype.loadAsync` genau einmal.
       - `TextureResource.spec.ts`: `a new image url without a factory takes back the texture of the old image` — Factory gesetzt, Textur da; `textureFactory = undefined`; `imageUrl = 'second.png'` → nach dem Laden ist `texture` `undefined`, die alte Textur disposed, `imageCoords` vom neuen Bild.

  3. **`getAsync()` weist Subtypes ab, die die Resource nie liefert; `on()` warnt** (BUG-009)
     - Tabelle in `TextureResource.ts` neben `SUBTYPES_HELD_BACK_BY_STEP` (Zeile 164), mit Kommentar:
       ```ts
       const SUBTYPES_BUILT_BY_TYPE: Record<TextureResourceType, readonly TextureResourceSubType[]> = {
         image: ['imageCoords', 'texture'],
         tileset: ['imageCoords', 'texture', 'tileSet', 'atlas', 'frameBasedAnimations'],
         atlas: ['imageCoords', 'texture', 'atlas', 'frameBasedAnimations'],
       };
       ```
       Belege: `activate()` (Zeile 711–767) registriert für `image` nur den Image-Effect; `#registerTileSetEffects()` setzt `tileSet` und `atlas` und registriert Animationen; `#registerAtlasEffects()` setzt `atlas` und Animationen, nie `tileSet`.
     - Neues Symbol in `internals.ts`, TSDoc nach dem Muster von `loadFailureFor`: `export const subTypesOutOfReach: unique symbol = Symbol('TextureResource.subTypesOutOfReach');`. Methode auf `TextureResource`, `/** @internal */`:
       `[subTypesOutOfReach](subTypes: readonly TextureResourceSubType[], scope: 'type' | 'now'): TextureResourceSubType[]`
       - `'type'`: die angefragten Subtypes, die `SUBTYPES_BUILT_BY_TYPE[this.type]` nicht enthält.
       - `'now'`: dazu `frameBasedAnimations`, wenn die jetzigen Daten keine bauen — `tileset` ohne `frameBasedAnimationsData`; `atlas` ohne `frameBasedAnimationsData`, sobald `#atlas.value` steht und `#adapterAnimations.value` `undefined` ist (vorher ist offen, ob der Adapter Animationen liest).
       - Auf einer disposten Resource `[]`, wie `loadFailureFor`.
     - `#getOnce()` (`TextureStore.ts:1136–1152`): im `#followResource`-Callback neben `rejectIfHeldBack` ein `rejectIfOutOfReach`, das `resource[subTypesOutOfReach](subTypes, 'now')` fragt und bei einem nicht leeren Ergebnis `settle()` und `reject(…)` ruft. Sofort aufrufen; bei `resource.type === 'atlas'` mit angefragtem `frameBasedAnimations` zusätzlich `track(on(resource, TextureResourceEvents.Atlas, rejectIfOutOfReach))` — das Atlas-Event kommt, wenn Atlas und Adapter-Animationen im selben Batch stehen (`TextureResource.ts:1156–1159`).
     - Meldungen, eine Funktion neben `resourceFailedError` (Artikel wie in `wrongShapeError`, `TextureResource.ts:185`):
       - nach Typ: `` `[TextureStore] ${what} cannot resolve: "${id}" is ${article} "${type}" resource, which never builds ${subTypes.join(', ')}` ``
       - `tileset` ohne Daten: `` `[TextureStore] ${what} cannot resolve: "${id}" carries no frameBasedAnimations data` ``
       - `atlas` ohne Daten und ohne Adapter-Animationen: `` `[TextureStore] ${what} cannot resolve: "${id}" carries no frameBasedAnimations data, and its atlas adapter read none out of its json` ``
       - Treffen Typ und Daten zugleich, gewinnt die Meldung nach Typ.
     - `on()`: siehe Schritt 6, Punkt »`#subscribe`« — im Follow-Callback nach `resource.activate()` einmal je Resource-Instanz `resource[subTypesOutOfReach](subTypes, 'type')` prüfen und bei Treffern `console.warn` mit `// biome-ignore lint/suspicious/noConsole: the warning to the developer is the point` (Muster: `src/sprites/FeatureSprites/SpriteResources.ts:186–187`):
       `` `[TextureStore] on(${id}, ${String(type)}) is never called for "${id}": it is ${article} "${type}" resource, which never builds ${subTypes.join(', ')}` ``
       Nur nach Typ: `on()` lebt über spätere `parse()`, die Animationsdaten nachliefern können; eine Resource anderen Typs, die nach `evictMissing` an die Stelle tritt, wird beim Folgen erneut geprüft. `getAsync()` warnt nicht, es rejected.
     - TSDoc: `getAsync()` — rejected auch für einen Subtype, den die Resource nie bauen kann: nach ihrem Typ (`image` baut nur `imageCoords` und `texture`, `atlas` kein `tileSet`) oder weil ihr die Animationsdaten fehlen und ihr Atlas-Adapter keine liest. `on()` — ein Subtype, den der Typ nie baut, wird einmal auf der Konsole gemeldet.
     - Regressionstests in `TextureStore.spec.ts` (rot = pending, über `settleWithin` belegt):
       - `getAsync() for the atlas of an image item rejects, naming the id, the type and the subtype`
       - `getAsync() for the tileSet of an atlas item rejects`
       - `getAsync() for the frameBasedAnimations of a tile set without animation data rejects`
       - `getAsync() for the frameBasedAnimations of a free-tex-packer atlas without animation data rejects once the atlas is there` (`packerJson` aus `describe('atlas adapters')`)
       - `on() for a subtype its resource never builds warns once` (`vi.spyOn(console, 'warn')`)
       - Bestehende Tests, die mit Daten resolven (`an Aseprite item publishes its tags …` Zeile 2898, `a skipped animation entry does not reject getAsync()` Zeile 2301, `a registered adapter is named by an item …` Zeile 2934), bleiben grün.

  4. **Eine direkt disposte Resource verlässt den Store** (RES-003) — Richtung laut »Entscheidungen«: austragen; ein wartendes `getAsync()` rejected mit klarer Meldung.
     - In `parse()` im Block `if (!this.#resources.has(id))` (`TextureStore.ts:862–869`): `once(resource, TextureResourceEvents.Dispose, Priority.Max, () => { if (!this.#disposed && this.#resources.get(id) === resource) this.#resources.delete(id); })`. `Priority` aus `@spearwolf/eventize` wie in `src/display/AdaptiveResolution.ts:1`. `Priority.Max`, damit die Map bereinigt ist, bevor die Listener von `on()` und `getAsync()` den Dispose hören — sie folgen der Id danach neu. `clearUnused()` und `evictMissing` nehmen die Resource vor ihrem `dispose()` heraus, `dispose()` des Stores setzt `#disposed` vorher; der Listener findet dann nichts zu tun. Kommentar mit diesem Warum.
     - `#getOnce()`: im `#followResource`-Callback `track(once(resource, TextureResourceEvents.Dispose, () => { if (settled) return; settle(); reject(resourceDisposedError(what, id)); }))`, mit `` const resourceDisposedError = (what: string, id: string): Error => new Error(`[TextureStore] ${what} was cancelled: the resource "${id}" has been disposed`); `` neben `disposedError`. Beim Dispose des Stores bleibt dessen Meldung die erste: sein `dispose`-Event geht vor den Dispose der Resources hinaus.
     - `on()`: wird die gefolgte Resource disposed, fällt die Subscription aufs Warten auf die Id zurück. Den Follow-Callback als benannte Konstante (`followed`) herausziehen und darin `unsubscribeFromSubType.push(once(resource, TextureResourceEvents.Dispose, () => { clearSubTypeSubscriptions(); if (!isActiveSubscription) return; unsubscribeFromResource?.(); unsubscribeFromResource = this.#followResource(id, followed); }))`. Da die Map schon bereinigt ist, lauscht `#followResource` auf `resource:<id>` und bekommt die Resource, die das nächste `parse()` unter der Id baut — das Versprechen aus dem TSDoc von `TextureStoreEvents.Resource` (Zeile 72–76).
     - TSDoc `TextureResource#dispose()` (`TextureResource.ts:621–637`): eine Resource eines `TextureStore`, die direkt disposed wird, verlässt den Store; das nächste `parse()`, das ihre Id nennt, baut eine neue, `on()` folgt ihr, ein wartendes `getAsync()` rejected. Bei `TextureStore#on()` ein Halbsatz dazu.
     - Regressionstests in `TextureStore.spec.ts` (rot vor dem Fix):
       - `a resource disposed directly leaves the store, and the next parse() builds a new one under its id` — `onResource()` und `whenResource()` liefern danach die neue Instanz (≠ der alten).
       - `a getAsync() waiting on a resource that is disposed directly rejects, naming the id` — ohne Fix pending (`settleWithin`).
       - `an on() subscription whose resource is disposed directly follows the resource the next parse() brings under its id` — der Callback bekommt den Wert der neuen Resource, deren `refCount` ist 1.
       - Die bestehenden Tests zu `clearUnused()`, `evictMissing` und `dispose()` (u. a. Zeile 1005, 1339, 2718–2830) bleiben grün.

  5. **Ein späteres `loadAsync()` bricht ein laufendes ab** (ASYNC-002) — Richtung laut »Entscheidungen«: das ältere Promise rejected mit `AbortError`.
     - Neues Feld `#loadUnderWay?: () => void` in `TextureStore`, Kommentar: bricht das `loadAsync()` ab, dessen Fetch noch läuft; ein späteres ruft es, bevor es selbst holt.
     - In `loadAsync()` (`TextureStore.ts:534–627`), nach den beiden frühen Rejects (disposter Store, Signal schon abgebrochen) und vor dem Fetch, im Executor: `` const onSuperseded = () => cutShort(new DOMException(`${what} aborted: a later loadAsync() on this store took its place`, 'AbortError')); ``, dann `this.#loadUnderWay?.(); this.#loadUnderWay = onSuperseded;`. In `settle()`: `if (this.#loadUnderWay === onSuperseded) this.#loadUnderWay = undefined;`.
     - Ein Load, dessen Parse begonnen hat, ist settled und wird nicht mehr abgebrochen — auch nicht von einem `loadAsync()`, das ein Listener in diesem Parse startet. Ein abgelöster Load sendet kein `error`-Event, wie einer, dessen Signal abbricht. Ein `loadAsync()`, das sofort rejected (disposter Store, abgebrochenes Signal), holt nichts und bricht nichts ab.
     - TSDoc des Instanz-`loadAsync()` (Zeile 505–533), neuer Absatz: ein späteres `loadAsync()` auf diesem Store bricht eines ab, das noch läuft — sein Fetch wird abgebrochen, nichts davon geparst, kein `error`-Event, sein Promise rejected mit einem `AbortError`; Kataloge werden in der Reihenfolge der Aufrufe geparst. Das veraltete `load()` erbt das und resolved weiter mit dem Store; sein TSDoc verweist schon auf `loadAsync()`.
     - Regressionstests in `TextureStore.spec.ts` unter `describe('loadAsync()')` (rot vor dem Fix):
       - `a second loadAsync() cuts the first short: the first rejects with an AbortError, its fetch is aborted, and only the second catalog is parsed` — `fetch` mit zwei Deferreds gestubbt, der erste antwortet nach dem zweiten; `ready` einmal, nur die Ids des zweiten Katalogs, `signal.aborted` der ersten Anfrage `true`.
       - `with evictMissing, the first of two overlapping loads evicts nothing of the second` — erster Katalog ohne `b`, zweiter mit `b`, beide `{evictMissing: true}`; danach ist `b` da.
       - `a loadAsync() started by a ready listener inside the parse of another leaves that one resolving with the store`
       - `a load cut short by a later loadAsync() leaves no abort listener on the caller signal` (Muster: Zeile 741–779)

  6. **`acquireAsync()` hält, was `getAsync()` nur leiht** (API-001) — Richtung laut »Entscheidungen«: additiv, `{value, release()}`; das TSDoc von `getAsync()` nennt den Leihstatus.
     - Exportiertes Interface in `TextureStore.ts`, über `export * from './TextureStore.js'` öffentlich:
       ```ts
       /** What {@link TextureStore.acquireAsync} resolves with: the value, and a hold on the resource it came from. */
       export interface TextureStoreLease<V> {
         /** The value (or tuple of values) of the subtype(s) asked for. */
         readonly value: V;
         /** Gives the hold back. A second call does nothing. */
         release(): void;
       }
       ```
     - Methode:
       ```ts
       acquireAsync<const T extends TextureResourceSubType | readonly TextureResourceSubType[]>(
         id: string,
         type: T,
         options?: {signal?: AbortSignal},
       ): Promise<TextureStoreLease<MapSubTypes<T>>>
       ```
       Dieselben Ablehnungen wie `getAsync()` — disposter Store, fehlende Id, Abbruch, Ladefehler, unerreichbarer Subtype, disposte Resource —, die Meldungen nennen `acquireAsync(…)`: der `method`-Parameter von `#getOnce` bekommt `'acquireAsync'` dazu.
     - `#subscribe`: den Rumpf von `on()` in einen privaten Kern `#subscribe(id, type, callback: (value: MapSubTypes<T>, resource: TextureResource) => void, warnOutOfReach: boolean)` ziehen, der die liefernde Resource mitgibt (Tupel-Pfad und Einzel-Pfad); `on()` ruft ihn mit `(value) => callback(value)` und `true`, `#getOnce` mit `false`. Die Warnung aus Schritt 3 und das Neu-Folgen aus Schritt 4 liegen in `#subscribe`.
     - `#getOnce` bekommt einen Schalter `hold: boolean`. Beim Resolven mit `hold`: zuerst `resource[changeRefCount](1)` auf genau der liefernden Resource, dann `settle()` (die Subscription des Promise gibt ihren eigenen Zähler zurück, der Halt bleibt), dann `resolve({value, release})`, `release` idempotent: `resource[changeRefCount](-1)` genau einmal. `getAsync()` und `get()` laufen mit `hold: false` und resolven den Wert wie heute.
     - TSDoc `acquireAsync()`: resolved wie `getAsync()` und hält die Resource, bis `release()` kommt — `clearUnused()` und `parse({evictMissing: true})` lassen sie stehen. Gehalten wird die Resource, nicht der Wert: ein neuer Renderer, andere Texture-Klassen oder ein anderes Bild lassen sie eine neue Textur bauen und die alte freigeben; wer dem folgen will, abonniert mit `on()`. `dispose()` des Stores gibt alles frei, gehaltene Resources eingeschlossen; ein `release()` danach richtet nichts an.
     - Leihstatus im TSDoc:
       - `getAsync()` (Zeile 1034–1054), neuer Absatz: der Wert ist geliehen — das Promise gibt seinen Halt beim Settlen zurück; `clearUnused()`, `parse({evictMissing: true})` und ein Wechsel von Renderer oder Texture-Klassen können ihn freigeben, während er in einem Material steckt; `acquireAsync()` hält ihn.
       - `TextureStoreParseOptions.evictMissing` (Zeile 141–144): »A caller who wants to keep such a value keeps a subscription as well« → hält ihn mit `acquireAsync()` oder hält eine Subscription.
       - Klassen-TSDoc `TextureStore` (Zeile 185–186), »a caller only borrows it«: `acquireAsync()` nennen.
       - `TextureResource#refCount` (`TextureResource.ts:348–355`): »… a pending `TextureStore#getAsync()` among them, and every lease of `TextureStore#acquireAsync()` that is not released yet«.
     - Tests in `TextureStore.spec.ts` (neue API — der erste Lauf scheitert am Typecheck; das ist hier der rote Lauf):
       - `acquireAsync() holds the resource against clearUnused() until release()` — `refCount` 1 nach dem Resolven, `clearUnused()` entfernt 0; nach `release()` `refCount` 0, `clearUnused()` entfernt 1.
       - `acquireAsync() keeps its resource through parse({evictMissing: true}) of a catalog without it`
       - `release() gives the hold back once, however often it is called`
       - `acquireAsync() rejects as getAsync() does, its messages naming acquireAsync()` — fehlende Id, disposter Store, Abbruch
       - `getAsync() gives its hold back as it settles` — `refCount` 0 nach dem Resolven, falls kein bestehender Test das schon prüft.

  7. **Docs und CHANGELOG** — Konvention »Docs wachsen mit dem Feature«
     - `packages/twopoint5d/docs/sprites.md`:
       - Nach dem `ts check`-Block der Katalog-Sektion unter »Aseprite sheets« (endet Zeile 405): ein kurzer Absatz — der Store dort hat keinen Renderer und braucht für Animationen keinen: ohne Renderer lädt ein `TextureStore` die Bilder und baut Koordinaten, Atlanten, Tile-Sets und Animationen; nur `texture` wartet, bis `store.renderer` gesetzt ist. Ein `getAsync()` nach einem Subtype, den die Resource nie baut, rejected.
       - Zeile 464 (DynamicAtlas): »An image element that has not loaded — its natural size still 0, or `complete` still false — is refused by `add()`, with or without a size, and by `redraw()` alike, before anything is cleared.«
     - `packages/twopoint5d/docs/architecture.md:119–122`: »and `getAsync()` and `on()` hand out what it builds« um `acquireAsync()` ergänzen, das eine Resource hält, bis ihre Lease zurückgegeben ist.
     - `packages/twopoint5d/docs/resource-lifecycle.md:27–28` (»a subscriber of `TextureStore` only borrows it«): `acquireAsync()` hält die Resource gegen `clearUnused()` und `evictMissing`, bis `release()` kommt; die Textur gehört weiter der Resource.
     - `packages/twopoint5d/CHANGELOG.md` unter `## [Unreleased]` nach dem Skill `updating-changelog`, die Prüfung auf einen Migration-Guide-Eintrag eingeschlossen (das ältere `loadAsync()` rejected jetzt, `getAsync()` rejected statt zu hängen):
       - Added: `TextureStore#acquireAsync()` und `TextureStoreLease`.
       - Changed: ein Store ohne Renderer lädt die GPU-freien Werte, `texture` wartet; ein späteres `loadAsync()` bricht ein laufendes ab (`AbortError`); `getAsync()` rejected für Subtypes, die die Resource nie baut, `on()` warnt dafür; eine direkt disposte Resource verlässt den Store.
       - Fixed: `DynamicAtlas#add()` lehnt ein Bild ab, das noch lädt — auch mit `size` und bei `complete === false`.
     - Ein neuer Code-Block in den Docs ist nicht nötig; wer einen schreibt, der für sich steht, markiert ihn `ts check`.

- Verify: `pnpm run ci` — während der Arbeit schneller: `pnpm nx test twopoint5d -- src/texture` und `pnpm typecheck`
- Commit: `fix(texture): the store loads without a renderer, sequences catalog loads, lets go of disposed resources and leases values; DynamicAtlas refuses unloaded images`
  Body (englisch, ohne Finding-IDs):
  ```
  - TextureStore without a renderer loads images, coordinates, atlases, tile sets and
    animations; only the texture waits for a renderer
  - getAsync() rejects a subtype its resource never builds, on() warns about it
  - a TextureResource disposed directly leaves its store; a waiting getAsync() rejects,
    on() follows the resource the next parse() builds
  - a later loadAsync() cuts one still under way short with an AbortError
  - add TextureStore#acquireAsync() and TextureStoreLease: a value with a hold on its
    resource until release(); getAsync() says its value is borrowed
  - DynamicAtlas#add() refuses an image element that is still loading, with or without
    a size
  ```
- Verlauf:
  - 2026-10-21 Zug 0: Detailplan steht · BUG-007 unverändert (`DynamicAtlas.ts:371`, `:440`, TSDoc `:241`) · BUG-008 unverändert (`TextureResource.ts:797`, `TextureStore.ts:216`, `:360`) · BUG-009 unverändert (`TextureStore.ts:1136`, `:1001`) · RES-003 unverändert (`TextureStore.ts:446`, `:798`, `TextureResource.ts:638`) · ASYNC-002 unverändert (`TextureStore.ts:534`, `:611`) · API-001 unverändert (`TextureStore.ts:1055`, `:141`, `:1188`, `TextureResource.ts:830`) · `src/texture/` seit `7fee62de` unberührt · Folgen offen: keine (Pakete 1 und 2 »Folgen: —«) · Offene Befunde: 5, keiner mit derselben Ursache, bleiben in der Queue · Restplan: Paket 4 unverändert (berührt `src/texture/` nicht)
  - 2026-10-21 Zug 1: Implementierer beauftragt (Runde 0), opus, Effort high · Brief `paket-3.impl-0.brief.md`, Report `paket-3.impl-0.json`
  - 2026-10-21 Zug 2: Report FERTIG · 11 Dateien geändert (`src/texture/` 7, `docs/` 3, CHANGELOG) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-3.verify.log`)
  - 2026-10-21 Zug 3: Reviewer beauftragt (Runde 0), opus, Effort high · Diff `paket-3.diff`
  - 2026-10-21 Zug 3: Urteil — alle sechs Findings behoben, kein kritischer, kein wichtiger Befund, vier kleine · Report `paket-3.review-0.json`
  - 2026-10-21 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-10-21 Zug 5: committet `ac549468` · Verify aus Zug 2 (`paket-3.verify.log`, exit=0), keine Änderung seither · Nebenbefund `DynamicAtlas.ts:444–447` → Queue (low → Audit) · zwei Folgen (low) im Plan unter dem Paket

## Urteil des Reviewers (Runde 0)

- BUG-007: behoben — `DynamicAtlas.ts:371`, `:446` — `#sizeOf()` ruft `#assertLoaded()` für jede Bildquelle, auch mit `size`; `complete === false` wird abgelehnt, `redraw()` erbt den Check; drei Regressionstests.
- BUG-008: behoben — `TextureResource.ts:877`, `:951`, `:831` — ohne Factory wird das Bild geladen und alles außer der Textur publiziert; eine Textur aus einem anderen Bild wird zurückgenommen; die Standalone-Resource lädt je url einmal.
- BUG-009: behoben — `TextureResource.ts:176`, `:728`, `TextureStore.ts:1324`, `:1079` — Typ-Tabelle plus Datenprüfung für `frameBasedAnimations`; `getAsync()` rejected sofort bzw. beim Atlas-Event, Meldung nach Typ hat Vorrang; `on()` warnt einmal je Resource-Instanz.
- RES-003: behoben — `TextureStore.ts:936`, `:1343`, `:1097` — Dispose-Listener mit `Priority.Max` trägt aus; wartendes `getAsync()` rejected mit `resourceDisposedError`; `on()` folgt der neuen Resource unter der Id.
- ASYNC-002: behoben — `TextureStore.ts:619`, `:626` — `#loadUnderWay`/`onSuperseded` bricht ein laufendes `loadAsync()` mit `AbortError` ab; ein Load im Parse bleibt unberührt; Migration-Guide-Eintrag da.
- API-001: behoben — `TextureStore.ts:1205`, `:1290`, `:162` — `acquireAsync()` und `TextureStoreLease`; Halt vor `settle()`, `release()` idempotent, auch beim synchronen retained Wert; Leihstatus im TSDoc von `getAsync()`, `evictMissing`, Klassen-TSDoc und beiden Docs.

Kleine Befunde (keine Runde):
- `TextureStore.ts:631` — `failed()` sendet `error` vor `settle()`; ein Retry-Listener `on(store, 'error', () => store.loadAsync(fallback))` bricht den gescheiterten Load als abgelöst ab, dessen Promise rejected mit `AbortError` statt mit dem Ladefehler — widerspricht dem TSDoc-Satz »no `error` event goes out«. Vorschlag: in `failed()` vor `emitSafe` `#loadUnderWay` freigeben oder `settle()` vorziehen. Als Folge im Plan.
- `TextureResource.ts:831` — die Closure `standalone` hält das zuletzt geladene Bild nach geleerter `imageUrl` (`#takeBackImage()`, `:859`) bis zum Dispose. Vorschlag: im `!url`-Zweig `standalone = undefined`.
- `docs/sprites.md:471` — umgeschriebener Absatz nicht neu umbrochen (~190 Zeichen, sonst ~100).
- Commit-Message — fügt öffentliche API hinzu, läuft aber als `fix(texture)`; der Reviewer schlägt `feat(texture)` vor. Committet wie in der Paketdatei geplant.

Vom Implementierer gemeldet: Nebenbefund `DynamicAtlas.ts:444–447` (geschlossenes `ImageBitmap`, irreführender Rat `image.decode()`) — vorbestehend, low → Audit, in der Queue. Folge `DynamicAtlas.ts:444` (SVG-`<img>` mit `naturalWidth` 0 wird jetzt auch mit `size` abgelehnt) — von der Paketdatei verlangt, low, als Folge im Plan.

## Entscheidungen in Zug 0

Was der Plan offenließ und hier entschieden ist, je mit Grund. Nichts davon kehrt
eine Zeile aus »Entscheidungen« um.

- **BUG-008 über Entkoppeln, nicht über eine Default-Factory.** Die Empfehlung nennt beides; eine Default-Factory würde ohne Renderer eine `Texture` publizieren, die Entscheidung im Plan verlangt, dass `texture` auf den Renderer wartet.
- **BUG-008: die Standalone-Resource behält das Bild der letzten url.** Folge der eigenen Änderung: ohne das holt eine Resource, die vor ihrer Factory aktiviert wird, dasselbe Bild zweimal. Der Store hat dafür schon seinen Cache.
- **BUG-009 prüft auch die Daten für `frameBasedAnimations`, nicht nur die Typ-Tabelle der Empfehlung.** Die Beschreibung des Findings nennt den Fall »ohne `frameBasedAnimationsData` und ohne Adapter-Animationen« ausdrücklich als Hänger. `getAsync()` gibt damit auf, sobald der jetzige Stand nicht liefern kann — wie bei einer Id, die nach dem ersten `parse()` fehlt.
- **BUG-009: `on()` warnt nur nach Typ und per `console.warn`.** Die Empfehlung will eine Dev-Warnung; das Muster mit `biome-ignore` gibt es im Paket schon (`SpriteResources.ts`, `PanControl2D.ts`). Daten können über ein späteres `parse()` nachkommen, `on()` lebt so lange.
- **RES-003: `on()` folgt nach einem direkten Dispose der Resource, die das nächste `parse()` baut.** Dieselbe Ursache — der Store hört den Dispose nicht —, und das TSDoc von `TextureStoreEvents.Resource` verspricht genau dieses Folgen für eine ersetzte Resource.
- **RES-003: der Store-Listener mit `Priority.Max`.** Macht die Reihenfolge gegenüber den Listenern von `on()` und `getAsync()` explizit, statt sie aus der Registrierungsreihenfolge abzuleiten.
- **API-001: der Halt läuft über `changeRefCount` auf der liefernden Resource, Name `TextureStoreLease`.** Eine offen gehaltene `on()`-Subscription würde nach einem direkten Dispose einer neuen Resource folgen, deren Wert die Lease nicht trägt.
- **ASYNC-002: ein abgelöster Load sendet kein `error`-Event.** Er ist kein Fehlschlag, sondern abgebrochen — wie einer, dessen Signal abbricht.
- **Paket nicht geteilt.** BUG-007 (`DynamicAtlas`) ist klein und eigenständig, ein eigenes Paket kostete drei weitere Kaltstarts; die übrigen fünf Findings ändern dieselben zwei gekoppelten Klassen und gehören zusammen.
- **Modell und Effort:** stärkste Stufe und `high` — Event- und Signal-Reihenfolge über zwei gekoppelte Klassen, eine neue öffentliche API und Abbruchsemantik überlappender asynchroner Loads.

## Findings im Volltext

**BUG-007 · medium · packages/twopoint5d/src/texture/DynamicAtlas.ts:371** — Ladeprüfung in `DynamicAtlas#add()` auch mit `size` und über `complete` ausführen
Weitere Fundstellen: `DynamicAtlas.ts:440`, `DynamicAtlas.ts:241`
`#sizeOf()` ruft `#assertLoaded()` nur auf, wenn für ein Bild keine `size` übergeben wurde. `add(name, img, {width, height})` mit einem noch ladenden `HTMLImageElement` packt deshalb eine Zelle, `drawImage()` zeichnet laut Spec bei einem nicht vollständig dekodierbaren Bild stillschweigend nichts, und der Frame bleibt dauerhaft leer — obwohl das TSDoc (`@throws ... an image element that has not loaded`) und `redraw()` das Gegenteil versprechen. Zusätzlich prüft `#assertLoaded()` nur `naturalWidth > 0`; die Breite ist aber schon im Zustand »partially available« bekannt, während das Bild noch lädt, sodass auch der Pfad ohne `size` ein leeres oder halbes Bild durchlässt.
Beleg: `if (typeof source !== 'function' && size == null) { return this.#assertLoaded(name, source, 'add()'); }` — mit `size` kein Check; `#assertLoaded` testet nur `natural.width > 0`.
Empfehlung: `#assertLoaded()` für jedes Bild-Source in `add()` aufrufen, unabhängig von `size`, und für `HTMLImageElement` zusätzlich `image.complete` verlangen. Spec-Fälle: Bild mit `size`, das noch lädt; Bild mit `naturalWidth > 0` und `complete === false`.

**BUG-008 · medium · packages/twopoint5d/src/texture/TextureResource.ts:797** — Store ohne Renderer lädt nichts – getAsync() hängt still
Weitere Fundstellen: `TextureStore.ts:216`, `TextureStore.ts:360`
Der Image-Effect bricht ohne `textureFactory` ab, bevor er das Bild überhaupt anfordert (`if (!factory) return;`). Eine `TextureFactory` entsteht im Store aber nur über den `renderer`-Setter. Ein `new TextureStore()` oder das statische `TextureStore.loadAsync(url)` (baut den Store ohne Renderer) lädt daher kein einziges Bild – und damit kommen auch Werte, die gar keine GPU brauchen (`imageCoords`, `atlas`, `tileSet`, `frameBasedAnimations`), nie an. `getAsync()` bleibt ohne Fehler und ohne Error-Event pending. Das Beispiel in docs/sprites.md:394–404 (`new TextureStore()` … `store.getAsync('fighter', 'frameBasedAnimations')`) läuft genau in diesen Hänger.
Beleg: `if (!url) { this.#takeBackImage(); return; }\n if (!factory) return;`
Empfehlung: Bild-Fetch und `imageCoords` vom Factory-Vorhandensein entkoppeln (Bild laden, Textur erst bauen, wenn eine Factory da ist), oder dem Store ohne Renderer eine Default-Factory `new TextureFactory(0, [])` geben. Zusätzlich im TSDoc von `getAsync()`/static `loadAsync()` und in docs/sprites.md sagen, dass ein Renderer gesetzt sein muss.

**BUG-009 · medium · packages/twopoint5d/src/texture/TextureStore.ts:1136** — getAsync() für einen Subtype, den die Ressourcenform nie liefert, abweisen
Weitere Fundstellen: `TextureStore.ts:1001`
`getAsync(id, type)` prüft die angefragten Subtypes nicht gegen `resource.type`. Eine `image`-Ressource baut nie `atlas`, `tileSet` oder `frameBasedAnimations` (activate() registriert dafür keine Effects), eine `atlas`-Ressource nie `tileSet`, und eine Ressource ohne `frameBasedAnimationsData` und ohne Adapter-Animationen nie `frameBasedAnimations`. `getAsync('hero', ['atlas','texture'])` auf einem Bild-Item bleibt deshalb für immer pending: `loadFailureFor()` findet keinen Fehler, `on()` wartet auf ein vollständiges Tupel. Ein Tippfehler im Katalog (`imageUrl` statt `atlasUrl`) zeigt sich nur als hängende Promise.
Beleg: `const valuesArg = subTypes.map((subType) => resource[subType]).filter((v) => v != null);\nif (valuesArg.length !== subTypes.length) return;`
Empfehlung: Im `#followResource`-Callback von `#getOnce` die Subtypes gegen eine Tabelle `type → erreichbare Subtypes` halten und mit einer sprechenden Fehlermeldung (Id, Typ, Subtype) rejecten; dasselbe als Dev-Warnung in `on()`.

**RES-003 · medium · packages/twopoint5d/src/texture/TextureStore.ts:446** — Direkt disposte TextureResource aus dem Store austragen
Weitere Fundstellen: `TextureStore.ts:798`, `TextureResource.ts:638`
`TextureResource#dispose()` ist öffentlich, und der Store reicht Ressourcen über `onResource()`/`whenResource()` heraus. Ruft ein Aufrufer `dispose()` direkt auf, hört der Store das nicht: Er abonniert das `dispose`-Event seiner Ressourcen nirgends. Die tote Instanz bleibt in `#resources`; `#followResource` liefert sie weiter aus, `on()` erhöht ihren `refCount` und hängt Listener an ein Objekt, das nie wieder emittiert (`off(this)` hat auch die Retained-Werte gelöscht), `loadFailureFor()` antwortet auf einer disposten Ressource `undefined`. Folge: `getAsync()` für diese Id bleibt bis zum Store-Dispose pending, und ein erneutes `parse()` mit derselben Id schreibt in die stummen Setter der toten Instanz statt eine neue zu bauen. Die Id ist für die Lebensdauer des Stores tot, bis `clearUnused()` sie zufällig abräumt.
Beleg: `const resource = this.#resources.get(id);\nif (resource) {\n  callback(resource);\n  return () => {};\n}`
Empfehlung: Beim Einfügen in `#resources` `once(resource, 'dispose', …)` registrieren und die Ressource dann aus der Map nehmen (pendende `getAsync()` mit klarer Fehlermeldung rejecten), oder in `parse()`/`#followResource` eine disposte Instanz wie eine fehlende behandeln. Alternativ im TSDoc festhalten, dass eine Store-Ressource nur über `clearUnused()`/`evictMissing` freigegeben wird.

**ASYNC-002 · medium · packages/twopoint5d/src/texture/TextureStore.ts:534** — Überlappende loadAsync()-Aufrufe sequenzieren
Weitere Fundstellen: `TextureStore.ts:611`
Jeder `loadAsync()`-Aufruf auf derselben Store-Instanz läuft unabhängig und ruft `parse()` in der Reihenfolge auf, in der die Antworten eintreffen, nicht in der Reihenfolge der Aufrufe. Wird ein Katalog neu geladen (Hot-Reload, Level-Wechsel), während der vorige Fetch noch läuft, gewinnt der langsamere – also unter Umständen der ältere Katalog. Mit `{evictMissing: true}` räumt der verspätete alte Katalog sogar die Ressourcen des neueren ab, sofern gerade niemand sie abonniert hat. Weder Code noch TSDoc sagen etwas dazu, und kein Test deckt überlappende Loads ab.
Beleg: `const attempt = async () => { … response = await fetch(url, {signal: fetchAbort.signal}); … this.parse(data, {...parseOptions, baseUrl: parseOptions.baseUrl ?? url});`
Empfehlung: Eine Generationsnummer pro Store führen: ein neuer `loadAsync()` bricht den Fetch des laufenden ab (`fetchAbort.abort()`, Rejection mit AbortError) oder lässt dessen Ergebnis vor dem `parse()` fallen. Das Verhalten im TSDoc beschreiben und mit einem Test absichern.

**API-001 · medium · packages/twopoint5d/src/texture/TextureStore.ts:1055** — getAsync() eine haltende Variante geben und den Leihstatus im TSDoc nennen
Weitere Fundstellen: `TextureStore.ts:141`, `TextureStore.ts:1188`, `TextureResource.ts:830`
`getAsync()` ist der Hauptweg der Doku (architecture.md, sprites.md), gibt seine Subscription aber beim Settlen zurück: Der `refCount` fällt auf 0, obwohl die Textur danach in einem Material steckt. `clearUnused()` und `parse({evictMissing: true})` disposen solche Ressourcen samt Textur; ein Renderer-Wechsel des Stores oder geänderte `textureClasses` ersetzen und disposen sie ebenfalls. Der Aufrufer hält dann eine disposte Textur, die three beim nächsten Draw neu hochlädt und die danach niemand mehr freigibt. Der Hinweis steht nur im TSDoc von `evictMissing`, nicht an `getAsync()` selbst; eine haltende Variante gibt es nicht, der Aufrufer muss parallel ein `on()` offenhalten.
Beleg: `track(this.on(id, type, (value) => { settle(); resolve(value); }));` – `settle()` ruft das Unsubscribe und damit `changeRefCount(-1)`.
Empfehlung: Eine Lease-API anbieten, z. B. `acquireAsync(id, type)` → `{value, release()}`, die den `refCount` hält, bis `release()` kommt; im TSDoc von `getAsync()` ausdrücklich sagen, dass der Wert geliehen und ohne Halt ist und `clearUnused()`/`evictMissing`/Renderer-Wechsel ihn freigeben.
