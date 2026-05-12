# Backlog — TextureStore / TextureResource

Analysebericht zu `packages/twopoint5d/src/texture/TextureStore.ts` und `TextureResource.ts` sowie der angrenzenden Klassen (`TextureFactory`, `TextureCoords`, `TileSet`, `TextureAtlas`, `FrameBasedAnimations`, `types.ts`).

Stand: 2026-05-12.

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

### 🟥 BUG-1 — `parse()` mutiert die Eingabedaten

`TextureStore.parse()` (Z. 134):
```ts
this.defaultTextureClasses = data.defaultTextureClasses.splice(0);
```
`Array.prototype.splice(0)` **leert** `data.defaultTextureClasses`. Wenn ein Aufrufer die Daten weiterverwendet (z. B. erneutes `parse()`), sind die Defaults weg. Analog dazu mutiert `TextureResource.fromImage/fromTileSet/fromAtlas` mit `textureClasses?.splice(0)` jede übergebene Klassenliste.

**Fix:** `.slice()` (kopiert) statt `.splice(0)` (mutiert + kopiert).

### 🟥 BUG-2 — Double-Dispose von TextureResources

In `parse()` wird pro Resource registriert:
```ts
on(this as TextureStore, resource);   // listener-object form
```
Diese „listener-object“-Form ruft `resource.dispose()` auf, sobald der Store das `dispose`-Event emittiert (Methode `dispose` matcht Eventname `'dispose'`). Anschließend macht `TextureStore.dispose()` aber **zusätzlich** noch:
```ts
this.#resources.forEach((resource) => { resource.dispose(); });
```
Ergebnis: `TextureResource.dispose()` läuft zweimal. Der zweite Aufruf macht `SignalGroup.get(this).destroy()` auf einer bereits abgebauten Gruppe und `emit(this, OnDispose)` auf einem bereits per `off(this)` entkoppelten Objekt — derzeit defensiv genug, um nicht zu werfen, aber semantisch falsch (Listener wurden bereits einmal informiert, Konsumenten bekommen keinen zweiten dispose, was wiederum unauffällig ist — aber es wird Arbeit doppelt gemacht).

**Fix-Optionen:**
- Entweder die explizite `forEach`-Schleife entfernen und sich auf das Event verlassen,
- oder das `on(this, resource)` entfernen und nur die explizite Schleife behalten (klarer und einfacher zu debuggen).
- Empfehlung: explizite Schleife behalten, `on(this, resource)` streichen — Event-Forwarding zwischen Objekten ist hier intransparent und stiftet mehr Verwirrung als Nutzen. Außerdem gilt: `eventize(this)` installiert kein `.emit`-Catch-All — sollte sich später ein zusätzliches Resource-Event ergeben, dessen Methodenname am Store nicht matcht, wäre es stillschweigend „verloren“.

### 🟥 BUG-3 — `parse()` aktualisiert `frameBasedAnimations` bei bestehenden TileSet-Resources nicht

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

### 🟧 BUG-4 — Race in `TextureResource.load()` bei wechselndem `imageUrl`

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

### 🟧 BUG-5 — `TextureStore.load()` (statisch) wartet nicht auf `whenReady`

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

### 🟧 BUG-6 — `TextureResource.dispose()` setzt Renderer doppelt

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

### 🟧 BUG-7 — `TextureResource.dispose()` ruft deprecated `.destroy()`

```ts
SignalGroup.get(this).destroy();
```
Per `signalize`-API ist `destroy()` deprecated, `clear()` ist der empfohlene Weg. Außerdem würfe `get(this)` `undefined` → `.destroy()` einen TypeError, wenn die Gruppe vorher schon entfernt wurde (z. B. durch BUG-2). Sicherer:
```ts
SignalGroup.delete(this);   // löst die Gruppe vollständig auf und entfernt sie aus der Registry
```

### 🟨 BUG-8 — Listener-Leak auf `OnDispose` durch wiederholtes `store.on(...)`

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

### 🟨 BUG-9 — `refCount` ist tote Buchhaltung

```ts
resource.refCount++;
unsubscribeFromSubType.push(() => { resource.refCount--; });
```
`refCount` wird nirgendwo gelesen, kein automatisches Ressourcen-Freigeben. Entweder Logik implementieren (z. B. bei `refCount === 0` Texture freigeben / Effects pausieren) oder Feld + Inkrementierung entfernen.

### 🟨 BUG-10 — `whenReady()` und `get(...)` lösen nie aus, wenn die ID falsch ist

`whenReady` löst nach dem ersten `parse` aus, völlig unabhängig davon, ob die gewünschte ID existiert. `get(id, type)` registriert intern `on()`, das im Fehlerfall niemals zurückmeldet (siehe BUG-2 in BUG-9 zusammen). Das ist ein häufiger Quell-für „Promise hängt für immer“-Bugs.

**Fix-Idee:**
- `onResource(id, …)` darf erkennen, dass nach dem nächsten OnReady eine ID immer noch nicht im Map ist → `emit('resource:<id>:missing', id)` oder Reject der Promise.
- Mindestens eine optionale Timeout-/Abort-Variante: `get(id, type, {signal})`.

### 🟨 BUG-11 — `console.error` umgeht das `no-console`-Lint per `eslint-disable`

CLAUDE.md sagt: `no-console` ist Error. Hier werden die Verstöße per `eslint-disable-next-line no-console` umgangen. Für Bibliothekscode ist ein eigener `console`-Ersatz (Logger-Hook, oder das library-übliche „silent fail + Event“) sauberer:
```ts
emit(this, 'error', {url, error});
```
So können Konsumenten das Fehlverhalten erkennen, ohne dass die Lib unkontrolliert ins Konsolen-Log schreibt.

### 🟨 BUG-12 — `data.defaultTextureClasses` wird nie überschrieben mit leerer Liste

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

### 3.3 `TextureFactory` wird bei jedem Renderer- bzw. `textureClasses`-Wechsel neu erzeugt
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
- `TextureResource.load()` → `start()`/`activate()`/`enable()`.
- Statisches `TextureStore.load()` → `TextureStore.loadAndAwait(url)` oder so umbauen, dass es tatsächlich auf Ready wartet (BUG-5).
- Instanz-`load(url)` ggf. + `loadAsync(url): Promise<this>` für die awaitable Variante.

### 4.2 `TextureStore.get(id, type)` heißt wie `Map.get`, ist aber ein einmaliger Promise
Wer eine `Map`-ähnliche API erwartet, wird überrascht. Vorschlag: `getAsync` oder `whenAvailable` als Name.

### 4.3 Asymmetrie: `on(id, type, cb)` vs. die globalen `OnReady`/`OnDispose`-Events
`store.on(id, …)` ist eine Spezial-API mit Eigenleben (Filterung nach `id`, retain-aware). Daneben gibt es Eventize-Events `'ready'`, `'rendererChanged'`, `'resource:<id>'`, `'dispose'`. Letztere sind nicht öffentlich dokumentiert; ein Konsument, der `on(store, 'ready', …)` direkt aufruft (über `@spearwolf/eventize`), kann das tun — aber das ist nirgends als API beworben.

**Vorschlag:**
- Eventize-Events explizit als public API mit Konstanten exportieren (`StoreEvents.Ready`, `StoreEvents.RendererChanged`, …) — analog zu `Display`-Events.
- Im JSDoc dokumentieren, welche Events existieren, mit welchen Payloads, und welche retained sind.

### 4.4 `whenReady()` ist zu schwach (siehe BUG-10)
Vorschlag eine zweite Variante:
```ts
async whenResource(id: string): Promise<TextureResource>   // rejects nach erstem Ready, wenn id fehlt
```

### 4.5 Konstruktor erlaubt nur einen `WebGPURenderer`
Die Bibliothek baut auf `three/webgpu`. Wenn ein Konsument WebGL-Renderer hat, fliegt das implizit. Sollte typseitig restriktiv bleiben — oder über `WebGLRenderer | WebGPURenderer` typisiert werden, falls geplant.

### 4.6 `defaultTextureClasses` ist öffentlich + ein mutables Array
```ts
defaultTextureClasses: TextureOptionClasses[] = [];
```
Konsumenten können das Array direkt ändern, ohne dass das irgendetwas in den existierenden Resourcen propagiert. Klare „set replaces, mutation is silent“-Semantik wäre besser per `#defaultTextureClasses` + Setter + Re-Eval. (Idiomatisch wäre ein Signal — mit `compare: cmpTexClasses` analog zu `TextureResource`.)

### 4.7 `TextureResourceSubType`-String-Typ ist fehleranfällig
`'imageCoords' | 'atlas' | 'tileSet' | 'texture' | 'frameBasedAnimations'` — Tippfehler werden nur durch TS abgefangen. Bei Verwendung als `as TextureResourceSubType` Cast in `on()` umgangen. Lieber Konstanten exportieren (`Subtypes.Atlas` etc.).

---

## 5. Inkonsistenzen / Kleinigkeiten

- `TileSet.firstId` default ist `1`, `TextureAtlas` frameId beginnt bei `0`. Dokumentiert, aber ein gern übersehener Stolperstein.
- `TextureFactory.#defaultOptions = this.getOptions(defaultClassNames)` überschreibt das Zeile-davor zugewiesene Default — die erste Zuweisung ist toter Code.
- `TextureFactory.anisotrophy`: Tippfehler („anisotrophy“ statt „anisotropy“), aber API-stabil — Breaking-Change-Backlog-Kandidat.
- `parse()` emittiert `OnReady` auch bei leeren `items`. Kein Bug, aber unscharf.
- `Tilset.tileCountLimit === Infinity` Zweig in der while-Schleife: `tileCountLimit === Infinity || tileCount < tileCountLimit` — die zweite Bedingung ist bei Infinity automatisch true; redundant.

---

## 6. Vorschläge zur Optimierung des Laufzeitverhaltens

### 6.1 Zentrale TextureFactory am Store (siehe 3.3)
Eine `TextureFactory` pro Store/Renderer, nicht pro Resource. Signal-Verkettung: `store.#renderer → store.#textureFactory → resource.#textureFactory`. Spart Allokationen, vereinheitlicht Optionen.

### 6.2 Atlas-/Image-Fetch deduplizieren
Wenn zwei Resourcen denselben `imageUrl` referenzieren, werden derzeit zwei `ImageLoader`-Requests abgesetzt und zwei `Texture` erzeugt. Ein optionaler `imageUrl → Promise<HTMLImageElement>`-Cache am Store (mit Refcount) wäre fast geschenkt.

### 6.3 Abortable Fetches
`fetch(atlasUrl).then(...)` ohne AbortSignal. Bei schnellem Resource-Wechsel sammeln sich Requests. `AbortController` an den Effect-Cleanup hängen.

### 6.4 `batch` an mehr Stellen
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
