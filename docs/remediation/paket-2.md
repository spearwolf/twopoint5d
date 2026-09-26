# Paket 2 — TextureStore: Bild-Cache, Zustellung und Fehlerpfad von get()

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-018 (medium), ASYNC-001 (medium), BUG-107 (low), BUG-108 (low),
  CONS-054 (low), CONS-055 (low), API-046 (low) — dazu der Testpunkt von TEST-016
  für ASYNC-001 (`store.get()` auf einer Resource, deren Bild-Load rejected)
- Ziel: Der Store lädt jedes Bild genau einmal, zählt Referenzen verlässlich, stellt
  jede Texture einmal zu und lässt ein wartendes `get()` bei einem Ladefehler nicht
  hängen.
- Modell: stärkste Stufe — asynchroner Fehlerpfad über Resource und Store hinweg,
  Reihenfolge von Cleanup und Re-Run eines signalize-Effekts, Cache-Zählung unter
  nebenläufigen Loads
- Effort: high
- Dateien:
  - neu `packages/twopoint5d/src/texture/internals.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts`
  - `packages/twopoint5d/src/texture/TextureStore.ts`
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts`
  - `packages/twopoint5d/src/texture/TextureResource.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci` (zum Iterieren vorher `pnpm nx test twopoint5d -- src/texture`)
- Commit: `fix(texture): keep a cached image across a new run of the image effect and give it back only to the entry that lent it, let TextureStore#get() reject when its resource reports a failure that keeps the asked value from arriving, one reported before the call among them, call a TextureStore#on() subscription once per value whatever parse() comes after, write the defaultTextureClasses of a parse() only once no item conflicts and document them as a field the next parse() reads, and make TextureResource#refCount a read-only count that only the store changes`

## Entscheidungen dieses Pakets

Getroffen in Zug 0, mit Grund. Der Implementierer setzt sie um und stellt sie nicht
neu zur Wahl.

1. **`defaultTextureClasses` wird ein Feld mit dokumentierter Semantik »gilt ab dem
   nächsten `parse()`«** (Auftrag aus »Entscheidungen« vom 2026-09-26: ohne
   gewichtigen Grund die Feld-Semantik). Es gibt keinen gewichtigen Grund für
   Reaktivität: der Store hält die eigenen Klassen eines Items nicht getrennt vor —
   `resource.textureClasses` trägt nur das Zusammengeführte —, ein reaktives
   Durchreichen bräuchte also eine zweite Buchführung je Resource, nur damit eine
   Zuweisung wirkt, die `parse()` ohnehin übernimmt.
2. **Der Bild-Cache gibt ein Bild eine Microtask nach dem letzten Release frei**
   (PERF-018), statt die Resource auf »erst acquire, dann release« umzubauen. signalize
   ruft den Cleanup eines Effekts synchron unmittelbar vor dessen nächstem Lauf auf, und
   dieser Lauf holt dieselbe URL sofort wieder; eine aufgeschobene Freigabe fängt das an
   einer Stelle im Store ab, ohne dass der Image-Effekt der Resource die Reihenfolge von
   Cleanup und Re-Run kennen muss. `TextureResource.ts` wird ohnehin von Paket 3 und 5
   umgebaut; je weniger Logik dort, desto weniger tragen die beiden mit.
3. **`acquire()` gibt einen Lease zurück, der sein eigenes `release()` trägt**
   (BUG-107). Das ist die Empfehlung des Audits (»`acquire` gibt den Eintrag zurück,
   `release` prüft die Identität«) in einer Form, in der ein Release gar nicht mehr über
   die URL gehen kann: der Lease kennt seinen Eintrag, ein zweiter Aufruf tut nichts.
4. **`get()` rejectet auch auf einen Fehler, der vor dem Aufruf gemeldet wurde**
   (ASYNC-001, Abweichung von der Empfehlung des Audits, die nur das wartende `get()`
   abdeckt). Eine Resource lädt einmal und versucht es nicht von selbst erneut; ein
   zweites `await store.get('hero', 'texture')` nach einem 404 hinge sonst genauso
   unbegrenzt wie das erste — das Symptom, das die Entscheidung vom 2026-09-26 beseitigt
   haben will. Dafür führt die Resource je Ladeschritt den Fehler, mit dem dieser Schritt
   zuletzt endete, bis er wieder läuft.
5. **Ein Fehler rejectet nur ein `get()`, dessen Werte er zurückhält.** Die Entscheidung
   vom 2026-09-26 nennt `image`, `atlas` und `texture` als ladeabschließend. `source:
   'texture'` deckt aber zwei Fälle: eine Texture, die nicht gebaut werden kann (dann
   kommt nichts), und einen Tile-Set- oder Atlas-Json, den `TileSet` bzw.
   `TexturePackerJson` zurückweist (dann sind `texture` und `imageCoords` da, nur
   `tileSet`, `atlas`, `frameBasedAnimations` fehlen). Ein `get(id, 'texture')`, das im
   zweiten Fall rejectet, obwohl die Texture im selben Batch erscheint, wäre ein neuer
   Fehler. Deshalb hält jeder Schritt nur die Subtypes zurück, die von ihm abhängen
   (Tabelle in Schritt 4). Fehler der `frameBasedAnimations` bleiben nicht-fatal, wie
   entschieden.
6. **Die Schlüssel für `refCount`, `imageSource` und den Fehler-Record sind Symbole aus
   einem neuen Modul `internals.ts`**, das `public-api.ts` nicht re-exportiert (Auftrag
   aus »Entscheidungen«: modulinternes Symbol). `public-api.ts` re-exportiert
   `TextureResource.ts` mit `export *` — ein dort exportiertes Symbol wäre öffentlich.
   Die Symbole entstehen mit `Symbol('…')`, nicht mit `Symbol.for()`, damit niemand sie
   über die globale Registry erreicht. Die symbol-keyed Member der Klasse tragen
   `/** @internal */`; `stripInternal` (Root-`tsconfig.json`) hält sie aus den
   Deklarationen, sodass `checkNameableTypes` keinen unexportierten Typ sieht.
7. **`refCount` antwortet nach `dispose()` weiter mit seiner Zahl.** Der Getter ist
   `number`; `undefined` wäre ein Typbruch für jeden Leser. Die Zahl sagt nach
   `dispose()`, wie viele Abos die Resource noch halten, und steht deshalb in der TSDoc
   neben `id` und `type`.

## Vorgehen

Zeilenangaben gegen HEAD `dff733ff`. Zuerst `AGENTS.md` im Repo-Root lesen. Zu jedem
Korrektheitsfix erst den Regressionstest schreiben und rot laufen sehen (Schritt 10 nennt,
welche Tests vor dem Fix rot sein müssen); die rote Ausgabe gehört in den Report.

### 1. Neues Modul `packages/twopoint5d/src/texture/internals.ts`

Nicht in `public-api.ts` aufnehmen. Kopfkommentar: die Schlüssel und Typen, über die
`TextureStore` die Teile einer `TextureResource` erreicht, die dem Store gehören und
nicht ihren Aufrufern; das Modul steht nicht in `public-api.ts`, damit außerhalb von
`src/texture/` niemand sie benennen kann. Inhalt:

```ts
import type {TextureResourceSubType} from './TextureResource.js';

export interface ImageLease {
  readonly image: Promise<HTMLImageElement>;
  // gives the image back; a second call does nothing
  release(): void;
}

export interface TextureImageSource {
  acquire(url: string): ImageLease;
}

export interface TextureResourceLoadFailure {
  source: 'image' | 'atlas' | 'texture';
  url?: string;
  id?: string;
  status?: number;
  error: unknown;
}

export const changeRefCount: unique symbol = Symbol('TextureResource.changeRefCount');
export const imageSource: unique symbol = Symbol('TextureResource.imageSource');
export const loadFailureFor: unique symbol = Symbol('TextureResource.loadFailureFor');
```

Jeder Export bekommt einen Satz TSDoc, was er ist und wer ihn benutzt. Der
`import type` aus `TextureResource.js` ist rein typseitig und erzeugt zur Laufzeit keinen
Zyklus.

### 2. `TextureResource.ts` — `refCount` read-only (API-046)

- Zeile 292 `refCount: number = 0;` ersetzen durch das private Feld `#refCount = 0;`
  und einen Getter:

  ```ts
  /**
   * How many `TextureStore#on()` subscriptions hold this resource, a pending
   * `TextureStore#get()` among them. `TextureStore#clearUnused()` and
   * `TextureStore#parse()` with `{evictMissing: true}` dispose a resource only while this
   * is 0.
   *
   * Read-only: the store that holds the resource keeps the count.
   */
  get refCount(): number {
    return this.#refCount;
  }

  /** @internal */
  [changeRefCount](delta: 1 | -1): void {
    this.#refCount += delta;
  }
  ```

- Den Kommentar Zeile 294–299 (»Every getter of this class answers `undefined` once
  dispose() has run …«) so ergänzen, dass `refCount` ausgenommen ist: es zählt weiter die
  Abos, die die Resource noch halten.
- TSDoc von `dispose()` Zeile 458–459: »while `id` and `type` still say which resource
  this was« wird zu »while `id` and `type` still say which resource this was and
  `refCount` how many subscriptions still hold it«.

### 3. `TextureResource.ts` — `imageSource` statt `imageLoader` (API-046, BUG-107)

- Das Interface `TextureImageSource` Zeile 165–168 entfällt; `TextureImageSource` und
  `ImageLease` kommen aus `./internals.js`.
- Das Feld Zeile 415–425 `imageLoader?: TextureImageSource;` wird zu

  ```ts
  /**
   * How this resource fetches its image. The store it belongs to injects its shared,
   * de-duplicating cache here; a resource on its own falls back to a plain `ImageLoader`.
   *
   * Every run of the image effect takes one lease and gives it back in its cleanup, which
   * is what lets the store drop a cached image once no resource wants it any more.
   *
   * @internal
   */
  [imageSource]?: TextureImageSource;
  ```

- Image-Effekt Zeile 543–547 und 591–597:
  `const lease = this[imageSource]?.acquire(url);` und
  `(lease?.image ?? new ImageLoader().loadAsync(url))` statt
  `source ? source.acquire(url) : …`; im Cleanup `lease?.release();` statt
  `source?.release(url);`. Den Kommentar Zeile 543–544 anpassen: der Lease wird einmal je
  Lauf genommen und von genau dem Cleanup dieses Laufs zurückgegeben, sodass eine
  zwischendurch ausgetauschte Quelle den Lauf nichts zurückgeben lässt, was er nie
  genommen hat.

### 4. `TextureResource.ts` — Fehler-Record je Ladeschritt (ASYNC-001)

- Modulebene, neben `DERIVED_FROM_IMAGE_PRIORITY`:

  ```ts
  type LoadStep = 'image' | 'atlasFetch' | 'atlasImage' | 'tileSet' | 'atlasParse';

  const ALL_SUBTYPES: readonly TextureResourceSubType[] = Object.values(TextureResourceSubtypes);

  // what a step that ended in a failure keeps from arriving: an image, an atlas json or a
  // texture that is not there takes everything with it, while a tile set or an atlas json
  // that is refused leaves the texture and the coordinates of the image standing
  const SUBTYPES_HELD_BACK_BY_STEP: Record<LoadStep, readonly TextureResourceSubType[]> = {
    image: ALL_SUBTYPES,
    atlasFetch: ALL_SUBTYPES,
    atlasImage: ALL_SUBTYPES,
    tileSet: ['tileSet', 'atlas', 'frameBasedAnimations'],
    atlasParse: ['atlas', 'frameBasedAnimations'],
  };
  ```

- Feld `#loadFailures = new Map<LoadStep, TextureResourceLoadFailure>();` mit einem
  Kommentar: der Fehler, mit dem jeder Schritt zuletzt endete, bis dieser Schritt wieder
  läuft — eine Resource versucht es nicht von selbst erneut, und ein `get()`, das nach dem
  Fehler kommt, muss ihn trotzdem sehen.
- Private Methode `#fail(step: LoadStep, failure: TextureResourceLoadFailure): void`:
  erst `this.#loadFailures.set(step, failure)`, dann `emit(this, OnError, failure)`. Die
  Reihenfolge ist Pflicht: ein Listener des `error`-Events liest den Record.
- Interne Methode:

  ```ts
  /** @internal */
  [loadFailureFor](subTypes: readonly TextureResourceSubType[]): TextureResourceLoadFailure | undefined
  ```

  Nach `dispose()` `undefined`. Sonst der erste Eintrag von `#loadFailures` (in
  Einfügereihenfolge), dessen `SUBTYPES_HELD_BACK_BY_STEP[step]` mindestens einen der
  `subTypes` enthält; keiner → `undefined`.
- `dispose()` leert `#loadFailures`.
- Diese `emit(this, OnError, …)`-Aufrufe werden zu `this.#fail(<step>, …)`, Payload
  unverändert, die `if (aborted) return;`-Wachen davor bleiben:

  | Zeile | Payload | Schritt |
  | --- | --- | --- |
  | 577 | `{source: 'image', url, error}` | `'image'` |
  | 588 | `{source: 'texture', id: this.id, error}` | `'image'` |
  | 646 | Tile-Set-Zurückweisung, `source: 'texture'` | `'tileSet'` |
  | 715, 727, 738 | Atlas-Fetch mit Status, kein Atlas-Json, Fetch geworfen | `'atlasFetch'` |
  | 758 | Json nennt kein Bild und kein `overrideImageUrl` | `'atlasImage'` |
  | 823 | `TexturePackerJson.parse` wirft, `source: 'texture'` | `'atlasParse'` |

  Die vier `frameBasedAnimations`-Emits (669, 683, 846, 858) bleiben `emit` — nicht-fatal.
- Jeder Schritt räumt seinen Record als **erste Anweisung** jedes Laufs seines Effekts,
  vor jeder frühen Rückkehr: `this.#loadFailures.delete('<step>')` im Image-Effekt
  (ab 534), im Tile-Set-Effekt (ab 612), im Atlas-Fetch-Effekt (ab 702), im Effekt, der
  das Bild des Json auflöst (ab 751), und im Atlas-Effekt (ab 792). Ein neuer Lauf ist ein
  neuer Versuch; ein Lauf ohne Fabrik oder ohne URL ist »noch nicht«, kein Fehler.

### 5. `TextureStore.ts` — Bild-Cache (PERF-018, BUG-107)

- `#imageSource` (Zeile 228–250) wird `#imageSource: TextureImageSource = {acquire: …}`;
  das `release(url)` der Quelle entfällt. `acquire(url)` legt den Eintrag an wie heute
  (samt `catch`, der den Eintrag nur löscht, solange er der aktuelle ist), zählt
  `entry.refCount++` und gibt einen Lease zurück:
  - `image: entry.image`
  - `release()`: einmalig (ein lokales `released`-Flag, ein zweiter Aufruf tut nichts);
    es verschiebt die Freigabe mit `queueMicrotask` und zählt dort
    `entry.refCount--` am **eingefangenen** Eintrag; gelöscht wird nur, wenn
    `entry.refCount <= 0 && this.#images.get(url) === entry`.
- Den Kommentar Zeile 225–227 ergänzen: warum die Freigabe eine Microtask wartet
  (signalize ruft den Cleanup eines Effekts unmittelbar vor seinem nächsten Lauf auf, und
  der holt dieselbe URL gleich wieder — ein Klassen- oder Renderer-Wechsel fände sonst
  einen leeren Cache und lüde neu, ein noch ladendes Bild eingeschlossen), und warum der
  Lease seinen Eintrag kennt (ein fehlgeschlagener Eintrag ist schon ersetzt, wenn die
  Resource, die ihn hielt, loslässt; über die URL träfe ihr Release den Nachfolger).
- `dispose()` bleibt bei `this.#images.clear()`; eine danach fällige Freigabe findet
  ihren Eintrag nicht mehr in der Map und löscht nichts.

### 6. `TextureStore.ts` — Zugriff über die Symbole (API-046)

- Zeile 511 und 599: `resource[imageSource] ??= this.#imageSource;` statt
  `resource.imageLoader ??= …`. Den Kommentar Zeile 508–510 (»the loader goes in before
  the factory …«) auf »the image source« umstellen.
- Zeile 605–607: `resource[changeRefCount](1);` und im Unsubscribe
  `resource[changeRefCount](-1);`.
- Die Lesestellen `resource.refCount` (532, 747) bleiben.

### 7. `TextureStore.ts` — `on()` stellt jeden Wert einmal zu (CONS-055)

In `on()` eine Variable `let subscribedResource: TextureResource | undefined;` neben
`lastValues`. Im `onResource`-Callback (ab Zeile 596) als erste Anweisung
`if (resource === subscribedResource) return;`, nach dem Anlegen der Subtype-Abos
`subscribedResource = resource;`. `clearSubTypeSubscriptions()` setzt
`subscribedResource = undefined`. Kommentar: ein Abo, das vor dem ersten `parse()`
entstand, hört dauerhaft auf `resource:<id>`, und jedes `parse()` meldet die Resource
erneut; dieselbe Instanz neu zu abonnieren hieße, die retained Werte ein zweites Mal
zuzustellen. Die Empfehlung, `lastValues` über Resubscribes zu halten, deckte den
Einzeltyp-Pfad nicht, der keinen `lastValues`-Vergleich hat.

### 8. `TextureStore.ts` — `parse()` und `defaultTextureClasses` (BUG-108, CONS-054)

- Die Zuweisung Zeile 421–423 wandert hinter den Wurf bei Konflikten (Zeile 443–445),
  vor die Schleife, die `withoutSource` meldet. Damit stimmt die TSDoc (»nothing has been
  written or emitted by then«).
- Signal, Getter und Setter Zeile 176–191 werden ein öffentliches Feld:

  ```ts
  /**
   * The texture classes every resource of this store starts from, merged with whatever an
   * item names for itself.
   *
   * {@link TextureStore.parse} reads it: an assignment reaches a resource with the next
   * `parse()` that names that resource, and a `parse()` whose data carries a non-empty
   * `defaultTextureClasses` replaces this value before it reads it. A resource that no
   * later `parse()` names keeps the classes it was given.
   *
   * Keeps its last value once {@link TextureStore.dispose} has run: a configuration array
   * is no resource, and the answer stays right.
   */
  defaultTextureClasses: TextureOptionClasses[] = [];
  ```

- `cmpDefaultClasses` (Zeile 100–106) ist danach unbenutzt und entfällt.

### 9. `TextureStore.ts` — Fehlerpfad von `get()` (ASYNC-001)

- Neben `loadFailedError` ein Helfer mit Kommentar im Stil der Nachbarn:

  ```ts
  // one message for a get() whose resource reported a failure that keeps a value it asks for
  // from arriving, naming the step that failed and the url it failed on, if there is one
  const resourceFailedError = (what: string, {source, url, error}: TextureResourceLoadFailure): Error =>
    new Error(`[TextureStore] ${what} failed at the ${source} step${url != null ? `: "${url}"` : ''}`, {cause: error});
  ```

- In `get()` nach dem `track(this.on(…))` (Zeile 707–712), vor den Dispose- und
  Ready-Wachen:

  ```ts
  const subTypes = (Array.isArray(type) ? type : [type]) as readonly TextureResourceSubType[];
  let watchedResource: TextureResource | undefined;
  track(
    this.onResource(id, (resource) => {
      if (resource === watchedResource) return;
      watchedResource = resource;
      const rejectIfHeldBack = () => {
        if (settled) return;
        const failure = resource[loadFailureFor](subTypes);
        if (failure == null) return;
        settle();
        reject(resourceFailedError(`get(${id}, ${String(type)})`, failure));
      };
      track(on(resource, TextureResourceEvents.Error, rejectIfHeldBack));
      rejectIfHeldBack();
    }),
  );
  ```

  Kommentar dazu: ein Fehler, den die Resource vor diesem Aufruf gemeldet hat, zählt wie
  einer, der während des Wartens kommt — der Schritt läuft nicht von selbst wieder. Der
  Wert, den `on()` synchron zustellt, gewinnt, weil `on()` zuerst abonniert.
  `TextureResourceEvents` als Wert aus `./TextureResource.js` importieren,
  `loadFailureFor`, `imageSource`, `changeRefCount` und die Typen aus `./internals.js`.
- TSDoc von `get()` um diesen Absatz ergänzen:

  ```
   * It is rejected as well when the resource reports a failure that keeps a value it asks
   * for from arriving: an image that does not load, an atlas json that cannot be fetched or
   * read or that names no image, a texture that cannot be built — and, for `tileSet`,
   * `atlas` and `frameBasedAnimations`, tile set options that `TileSet` refuses or an atlas
   * json that `TexturePackerJson` cannot read. A failure reported before the call counts as
   * well, until a change of what the failed step reads — its url, its options, the texture
   * classes, the renderer — sends that step off again. The error names the step and the
   * url, and carries what the resource reported as its `cause`. An animation entry that is
   * skipped does not reject.
  ```

- `TextureStoreEvents`, TSDoc Zeile 57–58: »… are emitted by `TextureResource` and are
  subscribed there« wird ergänzt um »; a pending {@link TextureStore.get} for that
  resource is rejected on them«.

### 10. Specs

`TextureStore.spec.ts`, bestehende Helfer (`flushMicrotasks`, `settleWithin`,
`makeRendererStub`, `vi.spyOn(ImageLoader.prototype, 'loadAsync')`) benutzen. Jeder Wurf
und jede Rejection wird an ihrer Meldung geprüft, nicht an der Klasse. Mit **rot** markiert:
vor dem Fix rot, die rote Ausgabe gehört in den Report.

- describe `an image is fetched once for every resource that names it`:
  - **rot** `a change of texture classes builds the new texture from the image already fetched`
    — `on('a', 'texture')`, flush, `parse` mit `texture: ['nearest']` für `a`, flush:
    `loadSpy` einmal, der Callback bekam eine zweite, andere Texture.
  - **rot** `a new renderer builds new textures from the images already fetched` — wie
    oben, statt der Klassen `store.renderer = makeRendererStub()`.
  - **rot** `an image still loading stays in the cache while the texture classes change` —
    `loadAsync` liefert ein von Hand aufgelöstes Promise; Klassenwechsel, solange es
    aussteht; danach auflösen, flush: `loadSpy` einmal, eine Texture mit den neuen Klassen.
  - bestehender Test `the image is fetched again once no resource wants it any more`:
    nach `store.clearUnused()` ein `await flushMicrotasks();` mit Kommentar (der Cache gibt
    ein Bild eine Microtask nach dem letzten Lease frei). Sonst unverändert.
  - **rot** `a load that failed and was retried by another resource keeps the retry cached
    when the first resource lets go` — `loadAsync` rejectet beim ersten Aufruf, danach
    Stub-Bild; `a` abonnieren, flush (Fehlschlag); `b` mit derselben URL abonnieren, flush;
    `a` abbestellen, `clearUnused()` (nimmt nur `a`), flush; `c` mit derselben URL parsen
    und abonnieren, flush: `loadSpy` zweimal, nicht dreimal.
- describe `parse() validates before it writes`:
  - **rot** `a type conflict leaves defaultTextureClasses as they were` — nach einem
    `parse` mit `defaultTextureClasses: ['nearest']` wirft ein `parse` mit
    `defaultTextureClasses: ['linear']` und einem Typkonflikt (Meldung prüfen);
    `store.defaultTextureClasses` bleibt `['nearest']`, und ein folgendes `parse` mit
    `defaultTextureClasses: []` gibt einem neuen Item `['nearest']`.
- describe `defaultTextureClasses, held as a signal and handed to the resources by parse()`
  heißt `defaultTextureClasses, a field the next parse() reads`. Der Test
  `assigning defaultTextureClasses with equal content is a no-op (cmp)` entfällt (er prüft
  den Vergleich des Signals). Neu: `an assignment reaches a resource with the next parse()
  that names it` — Zuweisung, `resource.textureClasses` unverändert, `parse` mit
  `defaultTextureClasses: []` für dasselbe Item, dann die zugewiesenen Klassen.
- neues describe `on() delivers each value once, whenever it subscribed`:
  - **rot** `a subscription made before the first parse() is not called again by a parse()
    that brings the same resource` — Einzeltyp `texture`; nach zweitem `parse` mit
    denselben Daten und flush genau ein Aufruf; `resource.refCount` bleibt 1.
  - **rot** dasselbe für das Tupel `['texture', 'imageCoords']`.
- neues describe `a resource of the store keeps its count and its image source to the
  store`:
  - **rot** `refCount is read-only` — eine Zuweisung an `resource.refCount` (über
    `as unknown as {refCount: number}`) wirft `TypeError` (Meldung per Regex auf
    `refCount`), der Wert bleibt.
  - **rot** `a resource the store has handed out has no imageLoader` —
    nach `store.on('a', 'texture', …)` gilt `'imageLoader' in resource === false`.
- neues describe `get() gives up on a resource that cannot deliver`:
  - **rot** `get() rejects when the image does not load` — `loadAsync` rejectet mit
    `new Error('404')`; `get('a', 'texture')` rejectet mit
    `[TextureStore] get(a, texture) failed at the image step: "a.png"`, `cause` ist der
    Fehler des Loaders. Mit `settleWithin`, damit der rote Lauf `'pending'` meldet statt am
    Vitest-Timeout zu sterben. Das ist der Testpunkt, den TEST-016 für ASYNC-001 verlangt.
  - **rot** `get() rejects when the atlas json cannot be fetched` — `fetch` antwortet 404
    für `atlas.json`; Meldung `… failed at the atlas step: "atlas.json"`.
  - **rot** `a get() asked after the image failed rejects as well` — erstes `get` rejectet,
    ein zweites danach ebenso, mit derselben Meldung.
  - `a get() for the texture of a tile set whose options TileSet refuses resolves` —
    Item `t` mit `imageUrl: 't.png'` und `tileSet: {tileWidth: 0, tileHeight: 8}`,
    Renderer-Stub, Stub-Bild 4 × 4; `get('t', 'texture')` resolvt mit der Texture.
  - **rot** `a get() for the tileSet of such a resource rejects at the texture step` —
    Meldung `[TextureStore] get(t, tileSet) failed at the texture step`.
  - `a skipped animation entry does not reject get()` — Item `t` mit `imageUrl: 't.png'`,
    `tileSet: {tileWidth: 2, tileHeight: 2}` und
    `frameBasedAnimations: {walk: {firstTileId: 1, tileCount: 2}}` (weder `duration` noch
    `frameRate`), Renderer-Stub, Stub-Bild 4 × 4; `get('t', 'tileSet')` resolvt.
  - `a get() after a new image url waits for that image` — erster Load rejectet, `get`
    rejectet; `parse` mit neuer `imageUrl`, `loadAsync` liefert jetzt; ein neues `get`
    resolvt.
  - `a get() rejected by a failure leaves no listener behind` — `getSubscriptionCount`
    auf Store und Resource nach der Rejection wie vor dem `get`.
- Die bestehenden Bookkeeping-Tests (`on()/get() listener bookkeeping`) müssen
  unverändert grün bleiben.

`TextureResource.spec.ts` braucht nur dann eine Änderung, wenn dort etwas `refCount`
schreibt oder `imageLoader` benutzt (heute nichts davon).

### 11. CHANGELOG `packages/twopoint5d/CHANGELOG.md`

Skill `updating-changelog` laden. Nur neue Bullets unter `[Unreleased]`; keinen
bestehenden Bullet umformulieren (der Skill verlangt dafür eine Rückfrage, die es hier
nicht gibt). Präsens, kein »früher«, kein »statt bisher«.

- `### Changed`:
  - `` `TextureResource#refCount` is read-only: it counts the `TextureStore#on()` subscriptions that hold the resource, a pending `TextureStore#get()` among them, and only the store changes it ``
  - `` `TextureStore#defaultTextureClasses` is a field that `parse()` reads: an assignment reaches a resource with the next `parse()` that names it, and a `parse()` whose data carries non-empty `defaultTextureClasses` replaces it first ``
- `### Fixed`:
  - `` fix the shared image cache of `TextureStore`: a resource whose texture classes or renderer change builds its new texture from the image it already has, and an image still loading stays in the cache. The cache gives an image up one microtask after the last resource lets go of it, and every resource gives back the entry it took, so a load that failed and was retried by another resource leaves the retry cached ``
  - `` fix `TextureStore#get()` for a resource that cannot deliver: it rejects with an error naming the step and the url when the resource reports that its image does not load, that its atlas json cannot be fetched or read or names no image, or that its texture cannot be built — and for `tileSet`, `atlas` and `frameBasedAnimations` when `TileSet` refuses the tile set options or `TexturePackerJson` the atlas json. A failure reported before the call counts until the step that failed runs again. The error carries what the resource reported as its `cause`; a skipped animation entry rejects nothing ``
  - `` fix `TextureStore#parse()` with a type conflict: the `defaultTextureClasses` of its data are not written either ``
  - `` fix `TextureStore#on()` for a subscription made before the first `parse()`: a later `parse()` that brings the same resource does not call it again with the values it already had ``
- `### Migration Guide`, zwei H4 im Stil der bestehenden:
  - `` #### `TextureResource#refCount` is read-only `` — wer `refCount` schrieb, um eine
    Resource vor `clearUnused()` zu schützen, hält stattdessen ein
    `store.on(id, type, callback)` und ruft dessen Unsubscribe-Funktion zum Loslassen.
    Before/After-Codeblock.
  - `` #### `TextureStore#get()` rejects when its resource cannot deliver `` — wer
    `await store.get(…)` ohne `catch` aufruft, bekommt bei einer kaputten URL jetzt eine
    Rejection; `error.cause` trägt den gemeldeten Fehler. Before/After-Codeblock mit
    `try`/`catch`.

### 12. Deklarationen prüfen

Nach `pnpm build`: in `packages/twopoint5d/dist/lib/texture/TextureResource.d.ts` taucht
keines der drei Symbole auf (`grep -nE "changeRefCount|imageSource|loadFailureFor"` leer),
und `refCount` steht dort als `get refCount(): number;`. `pnpm run ci` prüft
`checkNameableTypes`, `attw` und `publint` mit.

## Für Zug 5: Zeilen für den Plan

`Schnittstellen:` unter Paket 2 muss mindestens nennen — Paket 3 (Atlas-Pfad) und Paket 5
(Zerlegung von `load()`) bauen darauf:

- neues internes Modul `src/texture/internals.ts` (nicht in `public-api.ts`): Symbole
  `changeRefCount`, `imageSource`, `loadFailureFor`; Typen `ImageLease`,
  `TextureImageSource` (`acquire(url): ImageLease`), `TextureResourceLoadFailure`
- `TextureResource#refCount` read-only Getter; `[changeRefCount](delta: 1 | -1)`;
  `imageLoader` entfernt, ersetzt durch `[imageSource]`
- `TextureResource#fail(step, failure)` (privat) mit `LoadStep` = `'image' | 'atlasFetch'
  | 'atlasImage' | 'tileSet' | 'atlasParse'` und `SUBTYPES_HELD_BACK_BY_STEP`: **jeder
  neue ladeabschließende Fehler einer Resource geht über `#fail`, jeder Effekt eines
  Schritts räumt seinen Record als erste Anweisung** — sonst sieht `get()` ihn nicht
- `TextureStore#defaultTextureClasses` ist ein Feld; `TextureStore#get()` rejectet mit
  `[TextureStore] get(<id>, <type>) failed at the <source> step[: "<url>"]`

## Abgleich (Zug 0, 2026-09-26, gegen HEAD `dff733ff`)

- **PERF-018** unverändert — `TextureStore.ts:244-249` `release()` löscht bei
  `refCount <= 0` sofort; der Image-Effekt `TextureResource.ts:533-600` ruft
  `source?.release(url)` im Cleanup (596) vor dem `acquire` (547) des Re-Runs;
  Renderer-Wechsel über `#textureFactory.onChange` `TextureStore.ts:262-266`.
- **ASYNC-001** unverändert — `TextureStore.ts:664-738`: `get()` settelt auf Wert,
  Dispose, Abort und fehlende id, auf keinen Resource-Fehler; die Resource emittiert
  `error` nur an sich selbst (`TextureResource.ts:577, 588, 646, 715, 727, 738, 758, 823`).
- **BUG-107** unverändert — `TextureStore.ts:235-237` (`catch` löscht den Eintrag) und
  `244-249` (`release(url)` sucht per URL und trifft den Nachfolger).
- **BUG-108** unverändert — Zuweisung `TextureStore.ts:421-423` vor der Konfliktprüfung
  `443-445`.
- **CONS-054** unverändert — Signal `TextureStore.ts:176`, Setter `189-191`, einzige
  Lesestelle `461` in `parse()`; der Spec `defaultTextureClasses, held as a signal …`
  (`TextureStore.spec.ts:319-349`) prüft kein reaktives Verhalten.
- **CONS-055** unverändert — `onResource()` `TextureStore.ts:278-289` legt vor dem
  ersten `parse()` einen dauerhaften `resource:<id>`-Listener an; `parse()` emittiert ihn
  bei jedem Lauf (`522-524`); der Callback `594-600` räumt die Abos, setzt `lastValues`
  zurück und abonniert dieselbe Instanz neu.
- **API-046** unverändert — `refCount` öffentliches Feld `TextureResource.ts:292`,
  `imageLoader` `425`; Schreibzugriffe `TextureStore.ts:605-607`, Lesestellen `532`,
  `747`. Außerhalb von `src/texture/` liest nur
  `packages/twopoint5d-testing/test/texture-store-on.test.js:389-392` `refCount`; das
  bleibt mit dem Getter gültig. `imageLoader` einer Resource benutzt keine Spec.
- **TEST-016** (Anteil dieses Pakets) — `TextureStore.spec.ts` hat keinen Test für
  `get()` auf einer Resource, deren Bild-Load rejected; er entsteht hier (Schritt 10).

## Triage in Zug 0

- `Folgen:` von Paket 1 — `TextureResource.ts:20-28` `getTimingOptions()` wirft
  `'Either duration or frameRate must be provided in animation data'`, während
  `FrameBasedAnimations#add()` denselben Fall seit `dff733ff` mit Präfix und
  Animationsnamen meldet. Vor Paket 1 (`git show fceda80b:…/FrameBasedAnimations.ts:72`)
  waren beide Meldungen gleich generisch; die Ungleichheit ist also durch Paket 1
  entstanden. Einordnung: **Symptom** — hätte Paket 1 die Meldung an beiden Prüfstellen
  gezogen, gäbe es den Eintrag nicht. Paket 1 ist committet, also **Nachtragspaket 7**
  mit `Folge von: Paket 1`, im Plan vor Paket 5 eingereiht (es ändert die
  Animations-Effekte, die Paket 5 zerlegt; so zerlegt Paket 5 schon eine einzige
  Prüfstelle). Nicht in Paket 2: andere Ursache, anderer Code.
- »Offene Befunde« — beide Einträge (`stage`-Spec und -README, `map2d`-Specs) liegen
  außerhalb der Domain texture und teilen keine Ursache mit diesem Paket; sie bleiben mit
  ihrem Urteil `→ Audit` liegen.
- Beim Lesen von `TextureStore.ts` und `TextureResource.ts` ist kein weiterer Befund
  aufgefallen. Geprüft und verworfen: dass ein nach dem Ready abgeschlossenes `on()` einer
  neuen Instanz derselben id nicht folgt — eine abonnierte Resource hält `refCount > 0`
  und wird weder von `clearUnused()` noch von `evictMissing` ersetzt, der Fall ist ohne
  ein von außen geschriebenes `refCount` nicht erreichbar, und genau das schließt
  API-046.

## Verlauf

- 2026-09-26 Zug 0: Detailplan steht · PERF-018, ASYNC-001, BUG-107, BUG-108, CONS-054,
  CONS-055, API-046 unverändert an den genannten Zeilen · Folge aus Paket 1
  (`TextureResource.ts:20-28`) als Symptom → neues Paket 7, eingereiht vor Paket 5 ·
  Restplan: Paket 3 hängt jetzt von 2 ab, Paket 5 zusätzlich von 7 · Offene Befunde
  unverändert (2 × → Audit)
- 2026-09-26 Zug 1: Implementierer beauftragt (Runde 0) · Modell opus, Effort high ·
  Brief `paket-2.impl-0.brief.md`, Report nach `paket-2.impl-0.json`
- 2026-09-26 Zug 2: Report FERTIG_MIT_VORBEHALT (Session `59336841-1d1d-4735-8e9b-009b023b6f79`) ·
  neu `src/texture/internals.ts`, geändert `TextureResource.ts`, `TextureStore.ts`,
  `TextureStore.spec.ts`, `CHANGELOG.md` · 15 Tests vor dem Fix rot · Abweichungen: Tests zu
  `on()` parsen erst `{other}`, dann zweimal `{a}` (sonst vorher schon grün), Testnamen und
  CHANGELOG-Eintrag entsprechend; `internals.ts` ohne ungenutzten `import type` · Arbeitsbaum
  schmutzig · eigener Verify `pnpm run ci` exit=0 (`paket-2.verify.log`)
- 2026-09-26 Zug 3: Reviewer opus/high (`paket-2.review-0.json`, Diff `paket-2.diff`) · alle
  sieben Findings und der Testpunkt behoben · wichtig: `atlasFetch`-Record bleibt nach einem
  von außen geschriebenen `atlasJson` stehen (`TextureResource.ts:762`, `:374-381`) · klein:
  Animations-Test prüft kein wartendes `get()` (`TextureStore.spec.ts:1781`), TSDoc von
  `TextureStoreEvents` zu allgemein (`TextureStore.ts:65-67`), `dispose()`-TSDoc nicht
  umbrochen (`TextureResource.ts:499`)
- 2026-09-26 Zug 4 Runde 1: offen der wichtige Befund, dazu die drei kleinen mitgegeben ·
  Resume Session `59336841-…` (opus/high), Report nach `paket-2.impl-1.json`
  · zurück: FERTIG · `atlasJson`-Setter räumt den `atlasFetch`-Record, neuer Test `a get() after
  an atlasJson written over a failed fetch waits for the atlas` (vor dem Fix rot), Animations-Test
  auf wartendes `get('t', 'frameBasedAnimations')` umgebaut (gegen »rejectet bei jedem error«
  rot), beide TSDocs nachgezogen, `dispose()`-TSDoc umbrochen · Verify `pnpm run ci` exit=0
  (`paket-2.verify.log`) · Diff `paket-2.round-1.diff`, Reviewer per Resume
  (`paket-2.review-1.json`)
- 2026-09-26 Zug 4 Runde 1, Review: vier Befunde erledigt, nichts Neues gebrochen; gemeldete
  Folge (Fetch scheitert nach `atlasJson`-Write) klein, nach Paket 3 verschoben · Fortschritt:
  1 wichtig + 3 klein → 0 offen
- 2026-09-26 Zug 5: Commit `724df0eb` · Verify `pnpm run ci` exit=0 nach Runde 1
  (`paket-2.verify.log`) · Plan: `[x]`, Ergebnis, 2 Folgen, 5 Nebenbefunde in die Queue,
  Schnittstellen

## Urteil des Reviewers (Zug 3 und Runde 1, Stand `724df0eb`)

- **PERF-018** behoben — Freigabe eine Microtask nach dem letzten Lease (`TextureStore.ts`,
  `queueMicrotask` im `release()` des Lease); Tests `a change of texture classes builds the
  new texture from the image already fetched`, `a new renderer builds new textures from the
  images already fetched`, `an image still loading stays in the cache while the texture
  classes change`
- **ASYNC-001** behoben — `#fail()` und `[loadFailureFor]()` in `TextureResource.ts`, jeder
  Schritt räumt seinen Record als erste Anweisung, der `atlasJson`-Setter räumt `atlasFetch`
  (`TextureResource.ts:383`); Rejection in `TextureStore#get()`, TSDoc von `get()` und
  `TextureStoreEvents` nachgezogen
- **BUG-107** behoben — Lease hält seinen Eintrag, Identitätsprüfung im `release()`,
  einmalig; ein Lease je Lauf des Image-Effekts; Test `a load that failed and was retried by
  another resource keeps the retry cached when the first resource lets go`
- **BUG-108** behoben — Zuweisung hinter dem Konfliktwurf in `parse()`; Test `a type conflict
  leaves defaultTextureClasses as they were`
- **CONS-054** behoben — `defaultTextureClasses` ist ein Feld mit »gilt ab dem nächsten
  `parse()`«, `cmpDefaultClasses` entfernt; describe `defaultTextureClasses, a field the next
  parse() reads`
- **CONS-055** behoben — `subscribedResource` in `on()`; Tests für Einzeltyp und Tupel, beide
  prüfen `refCount`
- **API-046** behoben — `refCount`-Getter über `#refCount`, `[changeRefCount]`,
  `[imageSource]`, Symbole in `internals.ts` außerhalb von `public-api.ts`;
  `dist/lib/texture/TextureResource.d.ts` zeigt `get refCount(): number;` und keines der
  Symbole; Tests `refCount is read-only`, `a resource the store has handed out has no
  imageLoader`
- **TEST-016** (Anteil ASYNC-001) erfüllt — `get() rejects when the image does not load`
  mit `settleWithin`, exakter Meldung und `cause`

Kleine Befunde: alle vier aus Zug 3 in Runde 1 erledigt. Offen als `klein` nur die Folge
unter Paket 2 im Plan (Fetch, der nach einem `atlasJson`-Write scheitert) — der Reviewer
empfiehlt den Abbruch des laufenden Fetches im Setter in Paket 3, mit den zwei dort
genannten Tests; eine Wache nur für den Fehlerpfad hier ließe den vorbestehenden
Überschreib-Fall offen und müsste zurückgebaut werden.

Abweichungen vom Detailplan (vom Reviewer mitgetragen): die Tests zu `on()` parsen erst
`{other}`, dann zweimal `{a}` — mit Abo vor dem ersten `parse()`, das die id schon bringt,
antwortet `onResource` synchron und legt keinen dauerhaften Listener an, der Fall aus der
Paketdatei war vor dem Fix schon grün; Testnamen und CHANGELOG-Bullet sagen deshalb »before
the `parse()` that brings its resource«. `internals.ts` ohne den ungenutzten `import type`
(`noUnusedLocals`).

Urteile der Nebenbefunde (Queue im Plan): `onResource()`-TSDoc, Fetch-Überschreiben,
verirrter Resource-Test, falscher Spec-Kommentar, überlange Zeilen — alle in
`src/texture/**` bzw. seinen Specs, also Domain texture, Scope-Regel greift → Scope; keiner
teilt die Ursache dieses Pakets außer dem Fetch-Überschreiben, das mit der Folge nach
Paket 3 geht.

## Findings im Volltext

**PERF-018 · medium · packages/twopoint5d/src/texture/TextureStore.ts:244-249** — Bilder
nicht neu laden, wenn der Image-Effekt einer Resource neu läuft
(weitere Fundstellen: `TextureResource.ts:547`, `TextureResource.ts:591-597`,
`TextureStore.ts:257-265`)
signalize führt den Cleanup vor dem Re-Run aus. `release(url)` bringt den refCount auf 0
und löscht den Eintrag, das folgende `acquire(url)` startet ein neues
`ImageLoader().loadAsync`. Das passiert bei jeder Änderung von `textureClasses` und bei
jedem Wechsel des `renderer`. Ein Renderer-Wechsel lädt damit jedes Bild des Stores neu
(`THREE.Cache` ist per Default aus). Der Kommentar »One fetch per url for as long as at
least one resource wants it« verspricht das Gegenteil. Ein noch ladendes Bild fliegt auf
demselben Weg aus dem Cache.
Empfehlung: Erst `acquire` des neuen Laufs, dann `release` des alten, oder das Release
auf einen Microtask verschieben. Dazu ein Spec »class change does not refetch«.

**ASYNC-001 · medium · packages/twopoint5d/src/texture/TextureStore.ts:664** —
TextureStore.get() einen Fehlerpfad geben, wenn die Resource nicht laden kann
`get()` settelt auf einen Wert, auf Store-Dispose, auf Abort oder auf eine fehlende id
nach dem ersten `ready`. Eine Resource, deren Bild mit 404 antwortet, deren Atlas-JSON
ungültig ist oder deren Texturerzeugung wirft, emittiert `error` nur an der Resource
selbst (so steht es im TSDoc des Stores). Nichts verbindet das mit dem wartenden `get()`:
`await store.get('hero', 'texture')` hängt bei einer kaputten URL unbegrenzt — genau das,
was `whenResource()` laut Doku vermeiden soll. Ohne `AbortSignal` bleibt dem Aufrufer
nur, den Store zu disposen.
Empfehlung: In `get()`, sobald `onResource` die Resource liefert,
`once(resource, TextureResourceEvents.Error, …)` für die ladeabschließenden Quellen
(`image`, `atlas`, `texture`) abonnieren und mit einem Fehler samt Payload rejecten;
`frameBasedAnimations`-Fehler bleiben nicht-fatal. Alternativ Resource-Fehler am Store
weiterreichen und dort hören. Spec mit dem vorhandenen
`ImageLoader.prototype.loadAsync`-Rejection-Mock.

**BUG-107 · low · packages/twopoint5d/src/texture/TextureStore.ts:235-237** —
Image-Cache-Einträge per Identität freigeben, nicht per URL
(weitere Fundstelle: `TextureStore.ts:244-249`)
Schlägt ein Load fehl, löscht der `catch` den Eintrag, obwohl Resource A ihn noch hält.
Resource B legt für dieselbe URL einen neuen Eintrag an. Der Cleanup von A dekrementiert
dann den Eintrag von B auf 0 und löscht ihn. Die Zählung bleibt danach dauerhaft
verschoben.
Empfehlung: `acquire` gibt den Eintrag zurück, `release` prüft
`this.#images.get(url) === entry`.

**BUG-108 · low · packages/twopoint5d/src/texture/TextureStore.ts:421-423** —
defaultTextureClasses in parse() erst nach der Konfliktprüfung schreiben
(weitere Fundstelle: `TextureStore.ts:443-445`)
Laut TSDoc ist bei einem Typkonflikt »nothing has been written«. Tatsächlich stehen die
neuen Default-Klassen bereits im Store, bevor `parse()` wirft, und ein späteres `parse()`
ohne eigene Defaults übernimmt sie.
Empfehlung: Die Zuweisung hinter die Konfliktprüfung verschieben und mit einem Spec
absichern.

**CONS-054 · low · packages/twopoint5d/src/texture/TextureStore.ts:189-191** — Den Setter
defaultTextureClasses wirksam machen oder als Feld dokumentieren
(weitere Fundstelle: `TextureStore.ts:461`)
Das Signal hat keinen Abonnenten, gelesen wird der Wert nur in `parse()`. Eine Zuweisung
erreicht bestehende Resources nie, wirkt erst beim nächsten `parse()` und wird dort bei
nicht-leeren Katalog-Defaults überschrieben. Der Spec »as signal« belegt kein reaktives
Verhalten.
Empfehlung: Entweder ein Effect, der die zusammengeführten Klassen in alle Resources
schreibt, oder die Semantik »gilt ab dem nächsten parse()« dokumentieren und das Signal
durch ein Feld ersetzen.

**CONS-055 · low · packages/twopoint5d/src/texture/TextureStore.ts:281-288** — Doppelte
Zustellung in TextureStore.on() bei wiederholtem parse() verhindern
(weitere Fundstellen: `TextureStore.ts:522-524`, `TextureStore.ts:596-600`)
Existiert die Resource beim Abo noch nicht, bleibt ein dauerhafter `resource:<id>`-Listener
aktiv. Jedes `parse()` emittiert das Event neu, `clearSubTypeSubscriptions()` setzt
`lastValues` zurück, und der Callback bekommt die unveränderte Texture erneut. Wer nach
dem Ready abonniert, bekommt keine Duplikate. Das Verhalten hängt also vom Abo-Zeitpunkt
ab.
Empfehlung: Dieselbe Resource-Instanz nach der ersten Zustellung nicht erneut abonnieren
oder `lastValues` über Resubscribes hinweg behalten.

**API-046 · low · packages/twopoint5d/src/texture/TextureResource.ts:292** — refCount
kapseln
(weitere Fundstellen: `TextureResource.ts:425`, `TextureStore.ts:605-608`,
`TextureStore.ts:747`)
`refCount` entscheidet in `clearUnused`/`evictMissing` über Eviction, ist aber ein
öffentliches, beschreibbares Feld. Wer es ändert oder für eine Nutzungszählung hält (es
zählt nur `on()`-Abos), löst ein Dispose auf einer noch verwendeten Texture aus.
`imageLoader` ist ebenfalls öffentlich erreichbar.
Empfehlung: `refCount` als Getter über ein privates Feld exponieren, das `TextureStore`
über ein modulinternes Symbol ändert. `imageLoader` genauso behandeln.

**TEST-016 · low · packages/twopoint5d/src/texture/TexturePackerJson.ts:1** (anteilig) —
Die Spec-Lücken um die Loader und die Fehlerpfade des texture-Moduls schließen
Anteil dieses Pakets: »`store.get()` auf einer Resource, deren Bild-Load rejected
(ASYNC-001 — die Spec in TextureStore.spec.ts:1058-1155 deckt das Rennen, nicht den
Fehlschlag)«. Der Rest liegt bei Paket 1 (erledigt), 3 und 5.
Empfehlung: ein Test pro Punkt in den Resource-/Store-Suiten, mit den
`ImageLoader.prototype.loadAsync`/`fetch`-Mocks, die die bestehenden Suiten schon nutzen.
