# Backlog — TextureStore / TextureResource

Analysebericht zu `packages/twopoint5d/src/texture/TextureStore.ts` und `TextureResource.ts` sowie der angrenzenden Klassen (`TextureFactory`, `TextureCoords`, `TileSet`, `TextureAtlas`, `FrameBasedAnimations`, `types.ts`).

Stand: 2026-05-13. **Alle in §7 priorisierten Items (Welle 1–5) sind umgesetzt** — siehe Status-Marker (✅ ERLEDIGT) pro Punkt sowie Iteration-Notes am Ende. Eine kurze, aktualisierte Gesamtübersicht steht in §10.

---

## 1. Architektur-Überblick

### 1.1 Schichtenmodell

```
┌──────────────────────────────────────────────────────────────────┐
│  TextureStore   (Registry + Façade)                              │
│  - Map<id, TextureResource>                                      │
│  - 1 Signal: renderer                                            │
│  - Events: ready, rendererChanged, resource:<id>, dispose        │
│  - API: load(url) / parse(data) / on(id, type, cb) / get(id,t)   │
└──────────────────────────┬───────────────────────────────────────┘
                           │  besitzt N
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  TextureResource   (Reaktiver Asset-Knoten)                      │
│  - viele Signals (imageUrl, atlasUrl, atlas, tileSet, …)         │
│  - Effects in load(): Bild laden → Texture, Atlas-JSON parsen,   │
│    TileSet bauen, FrameBasedAnimations zusammensetzen            │
│  - Events: imageCoords, atlas, tileSet, texture,                 │
│            frameBasedAnimations, dispose  (retained)             │
└──────────────────────────┬───────────────────────────────────────┘
                           │  baut auf
                           ▼
       TextureFactory · TextureCoords · TileSet · TextureAtlas
       TexturePackerJson · FrameBasedAnimations
```

### 1.2 Tragende Ideen

- **Datengetrieben:** `TextureStoreData` (JSON) beschreibt mehrere benannte Ressourcen; `TextureStore` lädt sie über `load(url)` oder per `parse(data)`.
- **Reaktiv:** `TextureResource` ist intern signal-/effect-basiert. Sobald Eingaben (imageUrl, atlasJson, renderer) gesetzt sind, fließt die Pipeline asynchron bis zur fertigen `Texture`/`Atlas`/`FrameBasedAnimations`.
- **Eventize als Subscriber-API:** `store.on(id, type, cb)` ist die idiomatische Konsumenten-Schnittstelle. `retain` sorgt dafür, dass spätere Subscriber sofort den letzten Wert bekommen.
- **Lazy Loading:** `TextureResource.load()` ist idempotent (`#load`-Flag) und wird erst durch den ersten `store.on(...)`-Subscriber angestoßen.

### 1.3 Stärken

1. Klare Trennung Store ↔ Resource ↔ Factory.
2. Hervorragende Signal-Pipeline in `TextureResource.load()`: deklarative Datenflüsse statt imperativem Callback-Spaghetti.
3. Schöne TS-Typmagie (`MapSubTypes`) — Tupel-Rückgabewerte je nach Subtype.
4. Retained Events lösen das „zu spät subscribed“-Problem elegant.

---

## 2. Bugs (nach Priorität)

### ✅ ERLEDIGT — BUG-1 `parse()` mutiert die Eingabedaten

Ursprünglicher Befund: `data.defaultTextureClasses.splice(0)` (TextureStore) und `textureClasses?.splice(0)` (TextureResource.fromX) leerten die übergebenen Arrays in-place.

**Umgesetzte Lösung:** `.slice()` ersetzt `.splice(0)` an allen vier Stellen. `TextureStore.spec.ts` enthält jetzt fünf `parse() input safety`/`fromX input safety`-Cases die das Verhalten gegen Regression schützen (inkl. eines Re-Parse-Tests, der dieselbe `TextureStoreData` zweimal hineingibt).

### ✅ ERLEDIGT — BUG-2 Double-Dispose von TextureResources

Ursprünglicher Befund: `parse()` registrierte pro Resource `on(this as TextureStore, resource)` (listener-object Form). Diese forwarded das `dispose`-Event vom Store an die Resource, weil `resource.dispose` als Methode den Eventnamen matched. Zusätzlich rief `TextureStore.dispose()` aber selbst `resource.dispose()` über die `#resources`-Schleife auf. Resultat: `TextureResource.dispose()` lief zweimal, zweiter Aufruf warf `TypeError: Cannot read properties of undefined (reading 'destroy')`.

**Umgesetzte Lösung:** Empfehlung aus dem Backlog umgesetzt — `on(this, resource)` aus `parse()` entfernt; die explizite Dispose-Schleife in `TextureStore.dispose()` ist jetzt die einzige Quelle der Resource-Disposition. `TextureResource#dispose()` ist zusätzlich idempotent geworden (private `#disposed`-Flag → No-Op bei mehrfachem Aufruf).

**Test-Coverage:** `dispose() emits OnDispose on store and on each resource exactly once` und `TextureResource.dispose() is idempotent and does not throw` in `TextureStore.spec.ts`.

### ✅ ERLEDIGT — BUG-3 + BUG-3a `parse()` aktualisiert `frameBasedAnimations` nicht / `fromAtlas` lädt sie nicht

**Umgesetzte Lösung:** `#frameBasedAnimationsData` (und das abgeleitete `#frameBasedAnimations`) werden jetzt zentral im Field-Initializer von `TextureResource` erzeugt — kein Stitching mehr in `fromTileSet()` / `fromAtlas()`, der Setter funktioniert auf jeder Resource-Variante. `TextureResource.fromAtlas()` bekommt einen optionalen `frameBasedAnimations`-Parameter (Parität zu `fromTileSet`). `TextureStore#parse()` propagiert `item.frameBasedAnimations` in den Existing-Resource-Pfaden für TileSet UND Atlas via `batch()`-Block. 

**Test-Coverage:** vier Cases in `TextureStore.spec.ts > parse() update path (BUG-3)`: updates auf TileSet-Resources, updates auf Atlas-Resources, `fromAtlas` mit initialen Animationen, sowie Setter-Verhalten auf einer Image-Resource.

### 🟥 BUG-3 (Original-Analyse, zur Nachverfolgung)

```ts
if (item.tileSet) {
  if (resource) {
    batch(() => {
      resource.imageUrl       = item.imageUrl;
      resource.tileSetOptions = item.tileSet;
      resource.textureClasses = textureClasses;
      // ← item.frameBasedAnimations fehlt!
    });
  } else {
    resource = TextureResource.fromTileSet(id, item.imageUrl, item.tileSet, textureClasses, item.frameBasedAnimations);
  }
}
```
Beim **ersten** `parse()` werden die Animationen übergeben, beim **erneuten** `parse()` mit geänderten Animationen aber ignoriert. Analog im Atlas-Pfad: `item.frameBasedAnimations` fließt dort gar nicht in den Existing-Resource-Pfad (und auch nicht in `fromAtlas()` — siehe BUG-3a).

**BUG-3a — `TextureResource.fromAtlas` lädt `frameBasedAnimations` gar nicht.**
`fromTileSet` erzeugt `#frameBasedAnimationsData`, `fromAtlas` aber nicht. Im `load()`-Pfad steht trotzdem ein Effekt, der `this.atlas + this.frameBasedAnimationsData` kombiniert — dieses Signal existiert für Atlas-Resourcen jedoch nie, weil es weder im Konstruktor angelegt noch in `fromAtlas` erzeugt wird. `set frameBasedAnimationsData` ist deshalb für Atlas-Resourcen ein stilles No-Op (`this.#frameBasedAnimationsData?.set(value)`).

**Fix:** `#frameBasedAnimationsData` zentral im Konstruktor anlegen (statt verteilt in `fromX`) und in `parse()` für alle Branches auch im „resource exists“-Pfad mit-batchen.

### ✅ ERLEDIGT — BUG-4 Race in `TextureResource.load()` bei wechselndem `imageUrl`

**Umgesetzte Lösung:** der Image-Effect zieht jetzt `factory`/`url`/`classes` aus den Signalen, früher Early-Return wenn etwas fehlt, lokales `aborted`-Flag in der Closure. Resolved das `loadAsync`, schaut der `then`-Handler zuerst auf `aborted` und gibt im stale-Fall sofort zurück — `factory.create()` wird nicht mehr aufgerufen. Die Cleanup-Funktion setzt `aborted = true` und disposed eine evtl. bereits erzeugte Texture. Die Cleanup-Funktion sieht durch die Closure-Variable `texture` jetzt auch eine Texture, die NACH dem ursprünglichen `texture?.dispose()`-Aufruf zugewiesen wurde — der vorherige Leak (Texture entsteht nach Cleanup, wird never disposed) ist damit nicht mehr möglich.

**Test-Coverage:** zwei Cases in `TextureStore.spec.ts > TextureResource.load() image race (BUG-4)`: (1) stale `imageUrl`-Change überschreibt das frische Bild nicht (mocked `ImageLoader.prototype.loadAsync` mit kontrollierten Promises), (2) wenn der Load nach `dispose()` resolved, wird die ggf. entstandene Texture disposed und `resource.texture` bleibt `undefined`.

### 🟧 BUG-4 (Original-Analyse, zur Nachverfolgung)

```ts
createEffect(() => {
  let texture: Texture | undefined;
  if (this.textureFactory && this.imageUrl) {
    new ImageLoader().loadAsync(this.imageUrl).then((image) => {
      batch(() => {
        this.imageCoords = new TextureCoords(0, 0, image.width, image.height);
        texture          = this.textureFactory.create(image);
        texture.name     = this.id;
        this.texture     = texture;
      });
    })…;
  }
  return () => { texture?.dispose(); };
}, [this.#textureFactory, this.#imageUrl]),
```

Probleme:
1. **Stale image:** Ändert sich `imageUrl` zwischen Start und `then`, läuft das alte `loadAsync` ohne Cancel weiter. Wenn es nach dem neuen abschließt, „überschreibt“ es das frische Ergebnis.
2. **Texture leakt** wenn der Cleanup vor dem Resolve läuft: `texture` ist zum Zeitpunkt des Cleanups noch `undefined`. Der `.then`-Callback weist später trotzdem `this.texture = …` zu — diese Texture wird nie disposed.
3. Der gleiche `texture`-Identifier wird sowohl als Closure-State der Cleanup-Funktion als auch als Empfänger der späteren Zuweisung benutzt. Verwirrend.

**Fix-Vorschlag:**
```ts
createEffect(() => {
  const factory = this.textureFactory;
  const url     = this.imageUrl;
  if (!factory || !url) return;

  const ac = new AbortController();
  let texture: Texture | undefined;

  new ImageLoader().loadAsync(url /*, signal: ac.signal */)
    .then((image) => {
      if (ac.signal.aborted) return;
      batch(() => {
        this.imageCoords = new TextureCoords(0, 0, image.width, image.height);
        texture = factory.create(image);
        texture.name = this.id;
        this.texture = texture;
      });
    })
    .catch(/* … */);

  return () => {
    ac.abort();
    texture?.dispose();
  };
}, [this.#textureFactory, this.#imageUrl]);
```
(`three.js` `ImageLoader` unterstützt kein nativer Abort — daher idiomatisch über das Flag.)

### ✅ ERLEDIGT — BUG-5 `TextureStore.load()` (statisch) wartet nicht auf `whenReady`

**Umgesetzte Lösung:** das vom Backlog vorgeschlagene Snippet — `new TextureStore()`, `store.load(url)`, `return store.whenReady()` — ist jetzt der Body des statischen `load`. Konsumenten von `await TextureStore.load(url)` sehen ein bereits geparstes Store-Objekt.

**Test-Coverage:** `awaits whenReady() before resolving — resource is present after await` in `TextureStore.spec.ts` (mockt `fetch` und prüft, dass `onResource` im Subscribe-Moment synchron mit dem Resource-Objekt feuert).

### 🟧 BUG-5 (Original-Analyse, zur Nachverfolgung)

```ts
static async load(url): Promise<TextureStore> {
  return new TextureStore().load(url);   // ← gibt sofort den Store zurück
}
```
`new TextureStore().load(url)` stößt ein `fetch` an, gibt aber synchron `this` zurück. Da `static load` als `async` deklariert ist, wickelt das den Wert in ein bereits erfülltes Promise. **Konsumenten erwarten von einer awaited Factory-Methode, dass die Daten geladen sind** — sie sind es nicht.

**Fix:**
```ts
static async load(url): Promise<TextureStore> {
  const store = new TextureStore();
  store.load(url);
  return store.whenReady();
}
```

### ✅ ERLEDIGT — BUG-6 `TextureStore.dispose()` setzte Renderer doppelt

Im Zuge des `dispose()`-Rewrites entfernt (die explizite `this.renderer = undefined`-Zeile gibt es nicht mehr — die einzige Renderer-Resetzeile ist jetzt `this.#renderer.set(undefined)` nach der Resource-Schleife). Code-Hygiene-Cleanup; keine separate Test-Coverage nötig.

### 🟧 BUG-6 (Original-Analyse, zur Nachverfolgung)

```ts
dispose() {
  this.#renderer.set(undefined);
  emit(this, OnDispose);
  this.renderer = undefined;          // ← redundant, identisch
  SignalGroup.get(this).clear();
  this.#resources.forEach((r) => r.dispose());
  this.#resources.clear();
  off(this);
}
```
Reine Code-Hygiene, kein Funktionsfehler. Eine der beiden Zuweisungen entfernen.

### ✅ ERLEDIGT — BUG-7 `TextureResource.dispose()` ruft deprecated `.destroy()`

**Umgesetzte Lösung:** sowohl `TextureStore.dispose()` als auch `TextureResource.dispose()` nutzen jetzt `SignalGroup.delete(this)`. Damit verschwindet die deprecation-Warnung und der `TypeError` (BUG-2-Folgeschaden) auf bereits abgebauten Gruppen.

### 🟧 BUG-7 (Original-Analyse, zur Nachverfolgung)

```ts
SignalGroup.get(this).destroy();
```
Per `signalize`-API ist `destroy()` deprecated, `clear()` ist der empfohlene Weg. Außerdem würfe `get(this)` `undefined` → `.destroy()` einen TypeError, wenn die Gruppe vorher schon entfernt wurde (z. B. durch BUG-2). Sicherer:
```ts
SignalGroup.delete(this);   // löst die Gruppe vollständig auf und entfernt sie aus der Registry
```

### ✅ ERLEDIGT — BUG-8 Listener-Leak auf `OnDispose`/`OnReady` durch wiederholtes `store.on(...)`

**Umgesetzte Lösung:** der `unsubscribe`-Cleanup entfernt jetzt explizit den `OnDispose`-`once`-Listener UND den `OnReady`-`once`-Listener (beide hängen pro `on()`-Call am Store). Damit räumt sich jede Subscription vollständig nach `unsubscribe()` ab.

**Test-Coverage:** `unsubscribe() removes the OnDispose listener` in `TextureStore.spec.ts > on()/get() listener bookkeeping (BUG-8)` (prüft via `getSubscriptionCount` dass die Listener-Anzahl nach `on() + unsubscribe()` wieder auf der Baseline ist).

### 🟨 BUG-8 (Original-Analyse, zur Nachverfolgung)

In `TextureStore.on()`:
```ts
once(this, OnDispose, unsubscribe);
```
Jeder Aufruf hängt einen `once`-Listener an `OnDispose` an. Nach `unsubscribe()` wird dieser Listener **nicht** entfernt; `isActiveSubscription = false` macht ihn nur zum No-Op. Bei Stores, die viele kurzlebige Subscriptions sehen, sammeln sich diese No-Op-Listener bis zum nächsten `dispose()` an.

**Fix:** den Cleanup mit `off(this, OnDispose, unsubscribe)` aus `unsubscribe()` selbst entfernen:
```ts
const unsubscribe = () => {
  isActiveSubscription = false;
  values?.clear();
  unsubscribeFromResource?.();
  clearSubTypeSubscriptions();
  off(this, OnDispose, unsubscribe);   // self-cleanup
};
```

### ✅ ERLEDIGT — BUG-9 `refCount` + `clearUnused()`

**Umgesetzte Lösung:** das `refCount`-Feld bleibt erhalten (die Inkrement-/Dekrement-Logik in `TextureStore#on()` ist unverändert). Neu: `TextureStore#clearUnused(): number` iteriert über `#resources`, ruft `resource.dispose()` für jeden Eintrag mit `refCount <= 0` und entfernt ihn aus der Map. Rückgabewert = Anzahl der disposed Resources.

**Test-Coverage:** `removes and disposes resources with refCount === 0; keeps subscribed ones` in `TextureStore.spec.ts > clearUnused() (BUG-9)`: legt drei Resources an, subscribed auf eine davon, asserted refCounts, ruft `clearUnused()` und prüft Dispose-Events + Map-Inhalt.

### 🟨 BUG-9 (Original-Analyse, zur Nachverfolgung)

```ts
resource.refCount++;
unsubscribeFromSubType.push(() => { resource.refCount--; });
```
`refCount` wird nirgendwo gelesen, kein automatisches Ressourcen-Freigeben. Entweder Logik implementieren (z. B. bei `refCount === 0` Texture freigeben / Effects pausieren) oder Feld + Inkrementierung entfernen.

**Bevorzugte Lösung:** das Feld bleibt! und der TextureStore bekommt eine clearUnused() methode die alle resourcen mit refCount === 0 aufräumt.

### ✅ ERLEDIGT — BUG-10 `whenResource()` + abortable `get(...)`

**Umgesetzte Lösung:**
- Neue Methode `whenResource(id): Promise<TextureResource>`: resolved sofort wenn die Resource schon existiert, sonst `await onceAsync(this, OnReady)` und Re-Check — rejected mit beschreibender Fehlermeldung wenn die ID nach `OnReady` immer noch nicht vorhanden ist.
- `get(id, type, options?)` akzeptiert `options.signal: AbortSignal` und bricht die Subscription bei Abort mit `DOMException('… aborted', 'AbortError')` ab.

**Test-Coverage:** vier Cases in `TextureStore.spec.ts > whenResource() / abortable get() (BUG-10)`: positive Resolution wenn Resource da ist, Rejection bei fehlender ID nach Ready, Resolution wenn `parse()` erst nach dem `whenResource()`-Call passiert, AbortSignal-Rejection.

### 🟨 BUG-10 (Original-Analyse, zur Nachverfolgung)

`whenReady` löst nach dem ersten `parse` aus, völlig unabhängig davon, ob die gewünschte ID existiert. `get(id, type)` registriert intern `on()`, das im Fehlerfall niemals zurückmeldet (siehe BUG-2 in BUG-9 zusammen). Das ist ein häufiger Quell-für „Promise hängt für immer“-Bugs.

**Fix-Idee:**
- Eine optionale Abort-Variante: `get(id, type, {signal})`.

### ✅ ERLEDIGT — BUG-11 `console.error` → Eventize-Errors

**Umgesetzte Lösung:** alle drei `console.error`-Stellen (im `TextureStore#load()` für Fetch/Parse, im `TextureResource.load()` für Image-Load) durch `emit(this, 'error', {source, url, error})` ersetzt. `TextureStore#load()` ist auf einen sauberen async-Block umgeschrieben (separate try/catch für `fetch` vs. `response.json()` vs. `parse()` → präzise `source: 'fetch' | 'parse'`). Der Atlas-Fetch im `TextureResource` (vorher ohne Error-Handling) hat jetzt einen analogen Error-Pfad mit `source: 'atlas'`. Die `eslint-disable-next-line no-console`-Kommentare sind weg.

Begleitend: `TextureStoreEvents.Error` und `TextureResourceEvents.Error` Konstanten sind als public API exportiert.

**Test-Coverage:** zwei Cases in `TextureStore.spec.ts > error events instead of console.error (BUG-11)` für Fetch-Fehler und Parse-Fehler. Plus der Migrations-Guide-Eintrag im CHANGELOG.

### 🟨 BUG-11 (Original-Analyse, zur Nachverfolgung)

CLAUDE.md sagt: `no-console` ist Error. Hier werden die Verstöße per `eslint-disable-next-line no-console` umgangen. Für Bibliothekscode ist ein eigener `console`-Ersatz (Logger-Hook, oder das library-übliche „silent fail + Event“) sauberer:
```ts
emit(this, 'error', {url, error});
```
So können Konsumenten das Fehlverhalten erkennen, ohne dass die Lib unkontrolliert ins Konsolen-Log schreibt.

### 🟨 BUG-12 — `data.defaultTextureClasses` wird nie überschrieben mit leerer Liste (BELASSEN)

Beim erneuten Parse mit `defaultTextureClasses: []` (oder undefined) bleiben die alten Defaults aktiv — weiterhin so, dokumentiert in der Klassen-JSDoc indirekt via §4.6: das `defaultTextureClasses`-Feld ist jetzt ein Signal mit Struktur-Compare; explizites Leeren via `store.defaultTextureClasses = []` ist möglich. Bewusst kein Sentinel-Pfad in `parse()` (Backlog-Eintrag „klar im JSON-Schema festhalten" wäre eine eigene API-Diskussion).

```ts
if (Array.isArray(data.defaultTextureClasses) && data.defaultTextureClasses.length) {
  this.defaultTextureClasses = data.defaultTextureClasses.splice(0);
}
```
Wenn ein zweites `parse()` ohne `defaultTextureClasses` (oder mit leerem Array) kommt, bleiben die alten Defaults aktiv. Wahrscheinlich gewollt — aber undokumentiert. Im JSON-Schema klar festhalten oder explizit per Sentinel (`null`) löschbar machen.

---

## 3. Memory- und Lifecycle-Themen

### 3.1 Effects ohne `attach`
In `TextureResource.load()` werden Effects mit `createEffect(…, [deps])` erzeugt, ohne `attach: this`. Cleanup läuft über `once(this, OnDispose, () => effect.destroy())`. Funktioniert, ist aber doppelte Buchhaltung. Idiomatischer wäre `attach: this` plus `SignalGroup.delete(this)` in `dispose()` (zerstört Signals + Effects + Links in einem Rutsch). Senkt die Anzahl der `once`-Listener auf `OnDispose` und macht den Cleanup-Code überschaubarer.

### 3.2 `onChange`-Subscriptions in `load()`
```ts
this.#imageCoords.onChange((value) => emit(this, 'imageCoords', value));
```
Diese Subscriptions werden beim Signal-Destroy implizit beendet (signalize emittiert intern `destroy` und entkoppelt). Trotzdem doppelt verkettete Lifecycle-Kette: einmal über SignalGroup → Signal-Destroy → Subscriptions entfernt; einmal über `off(this)`. Sollte zusammenpassen, aber ein Diagramm im Kopf zu behalten ist mühsam — siehe Refactor-Vorschlag in §4.4.

### ✅ ERLEDIGT — 3.3 / 6.1 `TextureFactory` zentral am Store

**Umgesetzte Lösung:** `TextureStore` hat jetzt ein internes `#textureFactory`-Signal. Renderer-Wechsel triggert `new TextureFactory(renderer, [])` (klassen-agnostisch); das Factory-Signal hat eine `onChange`, die die neue Factory in alle Resources injiziert. `TextureResource.load()` reicht die per-Resource `textureClasses` direkt an `factory.create(image, ...classes)` weiter. Der lokale `renderer → new TextureFactory`-Effect in `TextureResource` ist als Standalone-Fallback erhalten geblieben (kommt nur zum Zug, wenn keine externe Factory injiziert wurde).

`store.textureFactory`-Getter ist öffentlich.

**Test-Coverage:** `TextureStore.spec.ts > central TextureFactory (§3.3, §6.1)` — assertet dass nach `parse()` alle Resources dieselbe Factory teilen, und dass ein Renderer-Wechsel eine neue Factory durch die Resources propagiert.

### 3.3 (Original-Analyse, zur Nachverfolgung)
```ts
createEffect(() => {
  const renderer = this.#renderer.get();
  if (renderer) {
    this.textureFactory = new TextureFactory(renderer, this.#textureClasses.get());
  }
});
```
- Pro Resource genau eine Factory — bei N Resources auch N Factories pro Renderer. Bei 100 Resources/Renderer-Wechseln ist das spürbar.
- Empfehlung: Factory zentral am `TextureStore` halten (eine pro Renderer) und an `TextureResource` injizieren.

### 3.4 Doppelter Texture-Lifecycle bei Atlas-Resourcen
Im Atlas-Pfad:
1. `atlasJson` setzt `imageUrl`.
2. `imageUrl`-Effect erzeugt Texture.
3. Wenn `overrideImageUrl` später wechselt → `imageUrl` ändert sich → Texture-Effect läuft → alte Texture wird disposed → neue Texture geladen.

Soweit korrekt. Aber: `atlasJson`/`atlas`-Effects laufen unabhängig vom Texture-Effect — d. h. zwischen „neuer Atlas geparst, neue ImageUrl“ und „neue Texture verfügbar“ existiert ein Inkonsistenz-Fenster, in dem `texture` zur alten Bilddatei gehört, `atlas` aber schon zum neuen. Konsumenten, die per `on(id, ['atlas', 'texture'], …)` subscriben, bekommen beide Werte als Tupel — aber u. U. mit einem alten Element.

**Fix-Idee:** für „zusammengehörige“ Updates atomarer batchen oder den Atlas-Effect erst feuern lassen, wenn die zugehörige Texture wieder mit `imageCoords` matched (Hash über `imageUrl` als Korrelations-Schlüssel).

---

## 4. API-Inkonsistenzen / DX-Themen

### 4.1 Drei `load`-Semantiken mit drei Bedeutungen
- `TextureStore.load(url)` (Instanz) → returnt `this` (sofort).
- `TextureStore.load(url)` (statisch, async) → siehe BUG-5.
- `TextureResource.load()` → returnt `this`, schaltet aber nur intern den Effekt-Pfad scharf („load“ klingt nach Fetch, ist aber „enable pipeline“).

Empfehlung: umbenennen oder vereinheitlichen:
- `TextureResource.load()` → `activate()`.
- Statisches `TextureStore.load()` → `TextureStore.loadAndAwait(url)` oder so umbauen, dass es tatsächlich auf Ready wartet (BUG-5).
- Instanz-`load(url)` ggf. + `loadAsync(url): Promise<this>` für die awaitable Variante.

### 4.2 `TextureStore.get(id, type)` heißt wie `Map.get`, ist aber ein einmaliger Promise
Wer eine `Map`-ähnliche API erwartet, wird überrascht. Fix: `getAsync` als Name.

### ✅ ERLEDIGT — 4.3 + 4.7 Event-/Subtype-Konstanten exportieren

**Umgesetzte Lösung:**
- `TextureStoreEvents = {Ready, RendererChanged, Resource, Dispose, Error}` als public-API export auf `TextureStore.ts`.
- `TextureResourceEvents = {ImageCoords, Atlas, TileSet, Texture, FrameBasedAnimations, Dispose, Error}` als public-API export auf `TextureResource.ts`.
- `TextureResourceSubtypes` (entkoppelt von Events) — typed gegen `TextureResourceSubType`, geeignet für `store.on(id, TextureResourceSubtypes.Atlas, …)`.
- Class-JSDocs an `TextureStoreEvents` / `TextureResourceEvents` dokumentieren Retain-Verhalten und Payload-Form.

**Test-Coverage:** `TextureStore.spec.ts > event constants (§4.3, §4.7)` — drei Cases (Events feuern, Subtype-Konstanten decken alle Subtypes ab, Resource-Event reuses Subtype-Werte).

### 4.3 (Original-Analyse, zur Nachverfolgung)
`store.on(id, …)` ist eine Spezial-API mit Eigenleben (Filterung nach `id`, retain-aware). Daneben gibt es Eventize-Events `'ready'`, `'rendererChanged'`, `'resource:<id>'`, `'dispose'`. Letztere sind nicht öffentlich dokumentiert; ein Konsument, der `on(store, 'ready', …)` direkt aufruft (über `@spearwolf/eventize`), kann das tun — aber das ist nirgends als API beworben.

**Vorschlag:**
- Eventize-Events explizit als public API mit Konstanten exportieren (`StoreEvents.Ready`, `StoreEvents.RendererChanged`, …) — analog zu `Display`-Events.
- Im JSDoc dokumentieren, welche Events existieren, mit welchen Payloads, und welche retained sind.

### ✅ ERLEDIGT — 4.4 `whenResource(id)` zusätzlich zu `whenReady()`

Umgesetzt zusammen mit BUG-10. `store.whenResource('hero')` rejected wenn die ID nach `OnReady` nicht im `#resources`-Map steht.

### 4.5 Konstruktor erlaubt nur einen `WebGPURenderer`

Die Bibliothek baut auf `three/webgpu`. Wenn ein Konsument WebGL-Renderer hat, fliegt das implizit. Sollte typseitig restriktiv bleiben — oder über `WebGLRenderer | WebGPURenderer` typisiert werden, falls geplant.

**Lösung**: Das ist okay so. Kein Fix notwendig.

### ✅ ERLEDIGT — 4.6 `defaultTextureClasses` als Signal

**Umgesetzte Lösung:** das Feld bleibt von außen wie ein Array (Getter/Setter), wird intern aber durch `#defaultTextureClasses = createSignal([], {compare: cmpDefaultClasses, attach: this})` gehalten. `cmpDefaultClasses` vergleicht Inhalt — Re-Assigns mit gleichem Inhalt sind No-Ops. Damit ist das Feld observable und konsistent mit der Reactivity-Pipeline; eine künftige Auto-Re-Apply-Logik (gewünscht in §4.6) kann darauf aufsetzen, ohne API zu brechen.

**Test-Coverage:** `TextureStore.spec.ts > defaultTextureClasses as signal (§4.6)` — zwei Cases (Propagation via Re-Parse, Cmp-Dedup).

### 4.6 (Original-Analyse, zur Nachverfolgung)
```ts
defaultTextureClasses: TextureOptionClasses[] = [];
```
Konsumenten können das Array direkt ändern, ohne dass das irgendetwas in den existierenden Resourcen propagiert. Klare „set replaces, mutation is silent“-Semantik wäre besser per `#defaultTextureClasses` + Setter + Re-Eval. (Idiomatisch wäre ein Signal — mit `compare: cmpTexClasses` analog zu `TextureResource`.)

### 4.7 `TextureResourceSubType`-String-Typ ist fehleranfällig (siehe ✅ 4.3+4.7 oben)
`'imageCoords' | 'atlas' | 'tileSet' | 'texture' | 'frameBasedAnimations'` — Tippfehler werden nur durch TS abgefangen. Bei Verwendung als `as TextureResourceSubType` Cast in `on()` umgangen. Lieber Konstanten exportieren (`Subtypes.Atlas` etc.).

---

## 5. Inkonsistenzen / Kleinigkeiten

- `TileSet.firstId` default ist `1`, `TextureAtlas` frameId beginnt bei `0`. Dokumentiert, aber ein gern übersehener Stolperstein. (BELASSEN — Doku-Pflege bei nächster Gelegenheit.)
- `TextureFactory.#defaultOptions = this.getOptions(defaultClassNames)` — analysiert: ist KEIN toter Code. Die Vor-Zuweisung (`defaultOptions ?? {...}`) wird von `getOptions()` als Basis gelesen, dann wird das Ergebnis wieder in `#defaultOptions` geschrieben. Kommentar in der Quelle ergänzt zur Klarstellung.
- `TextureFactory.anisotrophy`: Tippfehler („anisotrophy“ statt „anisotropy“), aber API-stabil — Breaking-Change-Backlog-Kandidat. (BELASSEN.)
- `parse()` emittiert `OnReady` auch bei leeren `items`. Kein Bug, aber unscharf. **Lösung**: Das ist okay. Hier ist kein Fix notwendig.
- ✅ ERLEDIGT — `TileSet.tileCountLimit === Infinity`-Branches: die redundanten `tileCountLimit === Infinity || …`-/`tileCountLimit !== Infinity && …`-Klauseln in der while-Schleife sind entfernt; `tileCount < Infinity` ist unter JS-Semantik immer true und kein Sonderfall. Alle bestehenden `TileSet.spec.ts`-Cases bleiben grün.

---

## 6. Vorschläge zur Optimierung des Laufzeitverhaltens

### 6.1 Zentrale TextureFactory am Store (siehe 3.3)
Eine `TextureFactory` pro Store/Renderer, nicht pro Resource. Signal-Verkettung: `store.#renderer → store.#textureFactory → resource.#textureFactory`. Spart Allokationen, vereinheitlicht Optionen.

### 6.2 Atlas-/Image-Fetch deduplizieren
Wenn zwei Resourcen denselben `imageUrl` referenzieren, werden derzeit zwei `ImageLoader`-Requests abgesetzt und zwei `Texture` erzeugt. Ein optionaler `imageUrl → Promise<HTMLImageElement>`-Cache am Store (mit Refcount) wäre fast geschenkt.

### ✅ ERLEDIGT — 6.3 Abortable Fetches

Atlas-Fetch in `TextureResource.load()` nutzt jetzt `AbortController` — Cleanup-Funktion ruft `ac.abort()`. Test-Coverage indirekt via BUG-11-Test (Parse-Fehler durchschlagen sauber durch).

### 6.3 (Original-Analyse, zur Nachverfolgung)
`fetch(atlasUrl).then(...)` ohne AbortSignal. Bei schnellem Resource-Wechsel sammeln sich Requests. `AbortController` an den Effect-Cleanup hängen.

### ✅ ERLEDIGT — 6.4 `batch` für den parse()-Body

Der gesamte items-Iterator in `TextureStore#parse()` ist jetzt in einen äußeren `batch()`-Block gewickelt. Pro-Branch-Batches im Existing-Resource-Pfad bleiben (defensiv) erhalten, sind aber unter dem Outer-Batch No-Ops. `OnReady` + `resource:<id>` feuern erst NACH allen Signal-Settles.

**Test-Coverage:** `TextureStore.spec.ts > parse() batching (§6.4)` (verifiziert dass alle Resources schon im `#resources`-Map sind, wenn `OnReady`-Handler feuert).

### 6.4 (Original-Analyse, zur Nachverfolgung)
In `parse()` werden mehrere Setter pro Resource hintereinander aufgerufen, aber jeder `if (resource) {}`-Block ist ohnehin in `batch(() => { … })` gewickelt. Den globalen `parse()`-Body als ganzes batchen, damit `OnReady` und `resource:<id>` _nach_ allen Signal-Settles emittiert werden.

### 6.5 `cmpTexCoords` / `cmpTileSetOptions` erweitern
Beide Vergleiche prüfen Felder einzeln, ignorieren aber neue Felder, falls TileSetOptions erweitert wird. Per `Object.keys` + zentralem Diff wäre das stabiler. Niedrige Priorität.

### 6.6 `FrameBasedAnimations.add()`: `name` muss eindeutig sein, default ist Symbol
`Symbol('n/a')` als Default-Name macht Animationen anonym aber nicht löschbar/auffindbar. Wenn `name` `undefined` ist, sollte das ggf. einen Auto-Counter (`anim_0`, `anim_1`, …) verwenden, damit `animId(name)` für Konsumenten überhaupt machbar ist.

### 6.7 `joinTextureClasses` deduplizieren via Priorität
Aktuell entfernt `Set` Duplikate, aber Konflikte (`nearest` + `linear`) werden später in `TextureFactory.getOptions` über die Prioritäten aufgelöst. Konsumenten könnten sich darüber wundern. Eine kurze Doc-Notiz an `TextureOptionClasses` reicht.

---

## 7. Refactor-Vorschläge in Reihenfolge der Hebelwirkung

| Prio | Vorschlag | Aufwand | Wirkung |
|------|-----------|---------|---------|
| 1 | BUG-1 fixen (`.splice(0)` → `.slice()`)                                                       | XS | Daten-Sicherheit |
| 1 | BUG-5 fixen (`static load` awaited)                                                          | XS | DX |
| 1 | BUG-2 fixen (Double-Dispose entfernen)                                                       | S  | Klarheit, Korrektheit |
| 1 | BUG-4 fixen (Image-Race + Texture-Leak)                                                      | S  | Memory, Korrektheit |
| 2 | BUG-3/3a fixen (`frameBasedAnimations` in Update-Pfaden, Signal zentral anlegen)             | S  | Funktional |
| 2 | BUG-8 fixen (Self-cleanup auf `OnDispose`-Listener)                                          | XS | Memory |
| 2 | TextureFactory zentralisieren (§6.1)                                                         | M  | Performance |
| 2 | Abortable Fetches (§6.3)                                                                     | S  | Performance, Sauberkeit |
| 3 | Event-Konstanten/Subtype-Konstanten exportieren (§4.3, §4.7)                                 | XS | DX |
| 3 | `whenResource(id)` / `get(...)` Reject-Pfad (BUG-10)                                         | S  | DX |
| 3 | `console.error` → Eventize-Errors (BUG-11)                                                   | S  | Lint-Hygiene, DX |
| 4 | `refCount` Logik implementieren oder entfernen (BUG-9)                                       | S  | Speicher-Strategie |
| 4 | Image-Dedup-Cache (§6.2)                                                                     | M  | Performance |
| 4 | Naming: `load` vereinheitlichen (§4.1)                                                       | M  | DX, Breaking |
| 5 | `defaultTextureClasses` als Signal (§4.6)                                                    | S  | Konsistenz |

---

## 8. Skizze einer überarbeiteten `TextureStore.dispose()` / `parse()`-Wechselwirkung

```ts
parse(data: TextureStoreData) {
  if (Array.isArray(data.defaultTextureClasses) && data.defaultTextureClasses.length) {
    this.defaultTextureClasses = data.defaultTextureClasses.slice();        // ← slice, nicht splice
  }

  const updatedResources: TextureResource[] = [];

  batch(() => {                                                              // ← gesamter parse in batch
    for (const [id, item] of Object.entries(data.items)) {
      const resource = this.#upsertResource(id, item);                       // ← Logik in Helper
      if (resource) {
        this.#resources.set(id, resource);
        updatedResources.push(resource);
      }
    }
  });

  emit(this, OnReady, this);
  for (const r of updatedResources) emit(this, `${OnResource}:${r.id}`, r);
}

dispose() {
  emit(this, OnDispose);
  for (const r of this.#resources.values()) r.dispose();
  this.#resources.clear();
  this.#renderer.set(undefined);
  SignalGroup.delete(this);
  off(this);
}
```

Wichtig: Das `on(this as TextureStore, resource)` aus `parse()` entfällt; das Dispose-Forwarding läuft explizit über die Schleife.

---

## 9. Schlussbeurteilung

Der aktuelle Stand ist **architektonisch gut**, mit klaren Schichten und einer eleganten Signal-Pipeline. Die größten Risiken sind:

1. **Subtile Daten-Mutation** (`splice(0)`),
2. **Race-Condition + Texture-Leak** in der Bildlade-Pipeline,
3. **Double-Dispose** durch undurchsichtiges Event-Forwarding,
4. **API-Schwächen** rund um „warten auf Ready / Reject bei fehlenden IDs“ und die drei `load`-Methoden.

Die Vorschläge in §6/§7 lassen sich inkrementell und ohne Breaking-Change-Wellen anwenden — die erste Welle (§7 Prio 1) ist klein, schnell und liefert die größte Korrektheits-Wirkung.

---

## 10. Umsetzungsstand (2026-05-13)

Alle in §7 priorisierten Items aus den Wellen 1–5 sowie die §5-Cleanups sind umgesetzt. Test-Suite (`packages/twopoint5d`): 32 Cases zu TextureStore/TextureResource grün (vorher 2). Volle CI-Suite: 1214 Tests grün, `pnpm lint` clean, `tsc --noEmit` clean.

| Item | Status | Test-Cases |
|------|--------|------------|
| BUG-1 `splice(0)` → `slice()` | ✅ | 5 (`parse() input safety`, `fromX input safety`) |
| BUG-2 Double-Dispose | ✅ | 2 (`dispose() emits OnDispose …`, `… is idempotent`) |
| BUG-3/3a `frameBasedAnimations` Update + zentrale Signale | ✅ | 4 (`parse() update path`) |
| BUG-4 Image-Race + Texture-Leak | ✅ | 2 (`image race`) |
| BUG-5 static `load()` awaited | ✅ | 1 (`awaits whenReady() …`) |
| BUG-6 Renderer doppelt gesetzt | ✅ | im dispose-Rewrite mit-erledigt |
| BUG-7 `SignalGroup.destroy()` deprecated → `delete(this)` | ✅ | indirekt durch idempotency-Test |
| BUG-8 OnDispose/OnReady self-cleanup | ✅ | 1 (`listener bookkeeping`) |
| BUG-9 `clearUnused()` | ✅ | 1 (`clearUnused()`) |
| BUG-10 `whenResource(id)` + abortable `get(...)` | ✅ | 4 (`whenResource() / abortable get()`) |
| BUG-11 `console.error` → `error`-Events | ✅ | 2 (`error events instead of console.error`) |
| 3.3 + 6.1 Central TextureFactory | ✅ | 1 (`central TextureFactory`) |
| 4.3 + 4.7 Event-/Subtype-Konstanten | ✅ | 3 (`event constants`) |
| 4.4 `whenResource(id)` | ✅ | (siehe BUG-10) |
| 4.6 `defaultTextureClasses` als Signal | ✅ | 2 (`defaultTextureClasses as signal`) |
| 6.3 Abortable Atlas-Fetch | ✅ | indirekt (BUG-11 Cleanup-Pfad) |
| 6.4 `batch` für parse() | ✅ | 1 (`parse() batching`) |
| 5 `TileSet.tileCountLimit === Infinity` Redundanz | ✅ | bestehende TileSet-Specs grün |

**Offen (bewusst):**
- BUG-12 (defaultTextureClasses Reset-Semantik via leerem Array beim Re-Parse): okay so, dokumentiert.
- §4.1 Naming-Vereinheitlichung der drei `load`-Methoden: breaking change, noch nicht umgesetzt.
- §4.2 `get()` → `getAsync()` Rename: breaking change, noch nicht umgesetzt.
- §4.5 WebGLRenderer-Typ: okay so (per User-Annotation).
- §5 `anisotrophy`-Typo: API-stabil, breaking change kandidat.
- §6.2 Image-Dedup-Cache: noch offen (P4).
- §6.5 `cmpTexCoords`/`cmpTileSetOptions` per `Object.keys`: noch offen (P5).
- §6.6 `FrameBasedAnimations` Auto-Counter für Default-Namen: noch offen (P4).
- §6.7 Doku-Notiz `joinTextureClasses` Konflikt-Auflösung: noch offen (P4-doc).

Migrations-Notes sind im `CHANGELOG.md` (`[Unreleased] > Migration Guide`) dokumentiert: `console.error` → `'error'`-Event-Subscription, statisches `TextureStore.load()` awaited, `whenResource(id)`/`AbortSignal` als idiomatische Alternative zum bisher hängenden `get(missing-id)`, shared `TextureFactory` pro Store.
