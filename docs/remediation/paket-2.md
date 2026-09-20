# Paket 2 — Das Route-Plumbing beider Geometrien an einer Stelle führen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ARCH-006 (medium), TYPE-012 (info)
- Ziel: Die Serial- und Auto-Touch-Buchführung der Routen liegt in einem
  Kollaborateur, den beide Geometrieklassen benutzen, statt zweimal
  nebeneinander.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - neu: `packages/twopoint5d/src/vertex-objects/GeometryRoutes.ts`
  - neu: `packages/twopoint5d/src/vertex-objects/parseTouchArgs.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts`
  - `packages/twopoint5d/src/vertex-objects/GeometryPoolAttachments.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit (Subject und Footer, der Footer ist Pflicht — drei öffentliche Felder
  wechseln auf `ReadonlyMap` und ein öffentlicher Rückgabetyp ändert sich):

  ```
  refactor(vertex-objects): hold the routes of both geometries in one collaborator, keep each attribute serial with the slot it belongs to, and let a detached pool arrive with its object surface in reach

  Both geometry classes reached their pools through the same bookkeeping written
  twice: the buffer serials, the array versions, the ownership of a pool a
  geometry built itself, the auto-touch pass and the parser behind `touch()`.
  `GeometryRoutes` owns the routes and everything booked per route,
  `GeometryAttributeSlots` keeps the array version of a slot next to the slot,
  `GeometryPoolAttachments` answers whether a geometry built a pool, and
  `parseTouchArgs` reads the arguments of `touch()` for both. What the two
  geometries upload, and when, and in which order, is unchanged.

  The three maps over the attached pools are views on the routes rather than
  three collections held in step by hand, so a name that answers in one answers
  in all three.

  BREAKING CHANGE: InstancedVOBufferGeometry#extraInstancedPools,
  #extraInstancedBuffers and #extraInstancedBufferSerials are ReadonlyMaps over
  the routes the geometry holds; write to them through attachInstancedPool() and
  detachInstancedPool(). detachInstancedPool() answers with
  VertexObjectPool<unknown> | undefined instead of VOBufferPool | undefined.
  ```

## Was dieses Paket ist und was nicht

Dies ist ein **verhaltenserhaltender Umbau**. Kein Verhalten der beiden
Geometrien ändert sich — weder was hochgeladen wird noch wann noch in welcher
Reihenfolge. Es gibt deshalb **keinen Regressionstest und keinen roten Lauf**:
es wird kein Korrektheitsfehler behoben. Der Beleg ist das bestehende
Sicherungsnetz, das grün bleiben muss:

- `vertex-buffers-geometry-updates.spec.ts` (59 Tests) — die Route-, Serial-
  und Upload-Pfade beider Geometrien
- `InstancedVertexObjectGeometry.spec.ts` (19 Tests) — Attach/Detach, Ownership,
  `autoDispose`, die drei `extraInstanced*`-Maps
- `VertexObjectGeometry.spec.ts` (5 Tests), `VertexObjectPool.spec.ts`
- `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js` (Browser)

**Keine dieser Testdateien wird angefasst.** Wenn ein Test nach dem Umbau rot
ist, ist der Umbau falsch, nicht der Test. Die einzige erlaubte Ausnahme: ein
Test, der einen der beiden Typen aus Schritt 6 in einer Weise benutzt, die
`ReadonlyMap` nicht mehr zulässt (also schreibend). Ein solcher Test existiert
nach Prüfung nicht — alle Zugriffe sind `get`, `has`, `size`. Findet der
Implementierer doch einen, meldet er ihn, statt ihn umzuschreiben.

Die Oberfläche der beiden Klassen bleibt bis auf Schritt 6 unverändert: jedes
öffentliche Feld, jede öffentliche Methode behält Namen und Bedeutung.
`declareOwnedPool()` bleibt als öffentliche Methode auf **beiden** Geometrien
stehen — `VertexObjectGeometry.ts:19` und `InstancedVertexObjectGeometry.ts:42,
45` rufen sie aus ihren Konstruktoren.

`GeometryRoutes` und `parseTouchArgs` sind **interne** Kollaborateure und
kommen **nicht** in `vertex-objects/public-api.ts` — genau wie
`GeometryAttributeSlots` und `GeometryPoolAttachments`, die dort auch nicht
stehen.

## Vorgehen

### Schritt 1 — `GeometryRoutes.ts` anlegen

Neue Datei neben `GeometryAttributeSlots.ts`. Sie besitzt die Routen einer
Geometrie und alles, was pro Route gebucht wird.

Exportierte Typen:

```ts
/** Which half of an instanced geometry a route feeds. A geometry that draws one pool leaves it unset. */
export type RouteGroup = 'base' | 'instanced';

/** The way a geometry reaches one pool: the buffers it built on it and the serial it last saw per buffer. */
export type GeometryRoute = {
  readonly pool: VOBufferPool;
  readonly buffers: AttributeRoute;
  readonly bufferSerials: Map<string, number>;
  readonly group?: RouteGroup;
  /** The name the route was attached under, for the routes of `attachInstancedPool()`. */
  readonly name?: string;
  /** What the caller said about releasing the pool with this route; unset means the caller said nothing. */
  autoDispose?: boolean;
};
```

`AttributeRoute` kommt per `import type` aus `./GeometryAttributeSlots.js`.
`BufferLike` und `TouchBuffersType` aus `./types.js`, `VOBufferPool` aus
`./VOBufferPool.js`, `VertexObjectPool` aus `./VertexObjectPool.js`,
`selectAttributes`, `selectBuffers`, `updateUpdateRange` aus ihren Dateien.

Die Klasse:

```ts
export class GeometryRoutes {
  /** Take on a route the geometry has just built, in the order it was built. */
  add(route: GeometryRoute): void;

  /** Take on a named route. A name that is in use keeps its route — the caller detaches first. */
  attach(route: GeometryRoute & {name: string}): void;

  /** The named route, or `undefined` if the name is free. */
  route(name: string): GeometryRoute | undefined;

  /** Give up the named route. @returns the route that was there, or `undefined`. */
  detach(name: string): GeometryRoute | undefined;

  /** Say what the caller decided about releasing the pool of the named route. */
  setAutoDispose(name: string, autoDispose: boolean): void;

  /** Every route, unnamed ones first, in the order they were taken on. */
  [Symbol.iterator](): IterableIterator<GeometryRoute>;

  /** The pools of the named routes, keyed by their name. */
  readonly attachedPools: ReadonlyMap<string, VertexObjectPool<unknown>>;
  /** The buffer maps of the named routes, keyed by their name. */
  readonly attachedBuffers: ReadonlyMap<string, AttributeRoute>;
  /** The buffer serials of the named routes, keyed by their name. */
  readonly attachedBufferSerials: ReadonlyMap<string, Map<string, number>>;

  checkSerials(): void;
  updateRanges(): void;
  select(attrNames: string[]): BufferLike[];
  selectByUsage(bufferTypes: TouchBuffersType, group?: RouteGroup): BufferLike[];
  autoTouch(): void;
  /** The next `autoTouch()` uploads every static buffer of the geometry once more. */
  resetAutoTouch(): void;
  /** Give up every route and every piece of bookkeeping over them. */
  clear(): void;
}
```

Die Methoden, Zeile für Zeile aus dem Bestand:

- **`checkSerials()`** — für jede Route die Schleife aus
  `InstancedVOBufferGeometry.ts:574-587` (die lokale Closure `checkBufferSerials`
  wird der Rumpf der Methode): über `route.buffers` laufen, den Buffer gleichen
  Namens in `route.pool.buffer.buffers` suchen, bei `null` überspringen —
  **einschließlich des Kommentars**, der sagt warum —, sonst `route.bufferSerials`
  gegen `poolBuffer.serial` halten und bei Unterschied `buffer.needsUpdate = true`
  setzen und den Serial nachziehen.
- **`updateRanges()`** — `updateUpdateRange(route.pool, route.buffers)` je Route.
  Die Funktion bleibt, wie sie ist.
- **`select(attrNames)`** — `selectAttributes(route.pool, route.buffers, attrNames)`
  über alle Routen, die Ergebnisse aneinandergehängt.
- **`selectByUsage(bufferTypes, group?)`** — `selectBuffers(route.buffers, bufferTypes)`
  über die Routen, deren `group` passt: ohne Argument über **alle** Routen, mit
  `'base'` nur über die Base-Route, mit `'instanced'` über die instanced-Route
  **und jede benannte Route**. Das ist genau die heutige Aufteilung aus
  `InstancedVOBufferGeometry.ts:459-489`; die Extras hängen an `'instanced'`.
- **`autoTouch()`** — hält `#firstAutoTouch = true` und die einmal aufgelöste
  Auswahl `#autoTouchBuffers?: BufferLike[]`, beides aus
  `InstancedVOBufferGeometry.ts:628-681`. Beim ersten Aufruf nach einem
  `resetAutoTouch()` erst `selectByUsage({static: true})` über alle Routen
  markieren, dann die gemerkte Auswahl markieren. Die Auswahl entsteht wie in
  `#getAutoTouchBuffers()`: Namen aller Attribute mit `autoTouch` aus den
  Descriptors **aller** Routen sammeln, dann jede Route mit `selectAttributes`
  nach diesen Namen fragen. Der Kommentar, dass ein Name, den eine Route nicht
  trägt, dort nichts auswählt, kommt mit.
- **`resetAutoTouch()`** — setzt `#firstAutoTouch = true` und wirft die gemerkte
  Auswahl weg. `add()`, `attach()`, `detach()` und `clear()` rufen es selbst:
  eine Auswahl, die eine gegangene Route enthält, hält deren
  `THREE.BufferAttribute`s fest.
- **`clear()`** — jede Route weg, jede der drei Sichten leer, die
  Auto-Touch-Auswahl weg. Die `buffers`- und `bufferSerials`-Maps der Routen
  werden **nicht** geleert: die gehören der Geometrie, die sie hält, und
  `dispose()` räumt sie selbst (Schritt 3 und 4 lassen die `clear()`-Aufrufe
  dort stehen).

Die drei `Readonly`-Sichten sind Projektionen **einer** Quelle: die Klasse hält
die benannten Routen in genau einer `Map<string, GeometryRoute>`, und die drei
Sichten lesen daraus `route.pool`, `route.buffers` und `route.bufferSerials`.
Dafür eine **nicht exportierte** lokale Funktion in derselben Datei:

```ts
/** A read-only view of `source` that answers with `project(value)` — one source, no second map to keep in step. */
function projectValues<K, S, T>(source: ReadonlyMap<K, S>, project: (value: S) => T): ReadonlyMap<K, T>;
```

Sie gibt ein Objekt mit `size` (Getter), `get`, `has`, `keys`, `values`,
`entries`, `forEach` und `[Symbol.iterator]` zurück; `values`, `entries` und
der Iterator sind Generatoren über `source`. `attachedPools` projiziert mit
`(route) => route.pool as VertexObjectPool<unknown>` — der Cast ist zulässig und
gehört kommentiert: `attachInstancedPool()` nimmt ausschließlich eine
`VertexObjectPool` oder einen Descriptor, aus dem es selbst eine baut
(`InstancedVOBufferGeometry.ts:206-214`), also ist der Pool einer benannten
Route immer eine.

Warum eine Projektion und nicht drei Maps mit `ReadonlyMap`-Typ davor: das
Finding nennt die drei Maps »filled and emptied together« als behauptete
Invariante, die nur Disziplin aufrechterhält. Über einer Quelle ist sie
strukturell wahr, und `attach`/`detach` können sie nicht mehr verfehlen.

### Schritt 2 — `parseTouchArgs.ts` anlegen

Neue Datei, eine Funktion, wie `selectBuffers.ts` und `selectAttributes.ts`
nebenan:

```ts
export type TouchArgs = {
  attrNames: string[];
  /** Usage types that apply to every route. */
  flat?: TouchBuffersType;
  /** Usage types that name a half of an instanced geometry. */
  routed?: TouchInstancedBuffersType;
};

export function parseTouchArgs(args: Array<string | TouchBuffersType | TouchInstancedBuffersType>): TouchArgs;
```

Der Rumpf ist der Parser aus `InstancedVOBufferGeometry.ts:499-513`, wörtlich
mitsamt dem Kommentar, warum pro Route gemerged wird und nicht über sie hinweg.
Die `for...of`-Schleife bleibt eine — kein `forEach`: eine Closure-Zuweisung
verengt den Typ der äußeren `let`-Bindung auf `undefined`, und genau das steht
heute in `VOBufferGeometry.ts:130-136`.

`TouchInstancedBuffersType` steht in `InstancedVOBufferGeometry.ts:19-22`.
Damit `parseTouchArgs.ts` nicht auf die Geometrie zurückzeigt, **zieht der Typ
mit um**: seine Deklaration wandert nach `parseTouchArgs.ts`, und
`InstancedVOBufferGeometry.ts` re-exportiert ihn unverändert mit
`export type {TouchInstancedBuffersType} from './parseTouchArgs.js';`. Der Typ
ist öffentlich (er steht im CHANGELOG unter den 30 exportierten Typen) und muss
über denselben Pfad erreichbar bleiben wie heute.

### Schritt 3 — `GeometryAttributeSlots` nimmt die Attribut-Serials auf

`#serials: Map<string, number>` und `#syncAttributeArrays()` stehen heute in
beiden Geometrien (`VOBufferGeometry.ts:155-183`,
`InstancedVOBufferGeometry.ts:537-571`) und werden in beiden über ein eigenes
`#releaseSlots()` mit den Slots synchron gehalten. Sie sind mit `attrName`
geschlüsselt — demselben Schlüssel wie `GeometryAttributeSlots#slots` — und
gehören deshalb dorthin und nicht zu den Routen.

- `GeometryAttributeSlots` bekommt ein privates `#serials: Map<string, number>`
  und die öffentliche Methode
  `syncArrays(geometry: BufferGeometry): void`.
- Der Rumpf ist der aus `InstancedVOBufferGeometry.ts:544-571` — die
  allgemeinere der beiden Fassungen: sie fragt `poolOf(attrName)` statt eines
  festen Pools und kennt den Slot ohne Pool. Für die einfache Geometrie ist das
  verhaltensgleich: `initializeAttributes()` legt jeden ihrer Slots mit Pool an,
  also antwortet `poolOf()` dort mit genau der `this.pool`, die die alte Fassung
  las. Alle vier Kommentare kommen mit.
- `releaseRoute()` löscht den Serial eines Slots, dessen Belegung sich ändert,
  selbst — also das, was heute die beiden `#releaseSlots()` nach dem Aufruf
  erledigen. Der Kommentar aus `VOBufferGeometry.ts:101-102` (»die Version, gegen
  die verglichen wird, gehört dem Attribut, das gegangen ist«) wandert mit in die
  Methode.
- Das Klassen-TSDoc bekommt einen Satz: die Buchführung kennt zu jedem Slot auch
  die Array-Version, gegen die zuletzt synchronisiert wurde.

Danach hat **keine** der beiden Geometrien mehr ein `#serials` oder ein
`#releaseSlots`. `VOBufferGeometry` ruft in `dispose()`
`this.#slots.releaseRoute(this, this.buffers)` direkt.
`InstancedVOBufferGeometry` ruft es ebenfalls direkt und verarbeitet die
`ReleasedSlot[]` wie heute in `#detachRoute()` weiter (`:312-316`) — die
`#vacatedSlots`-Buchführung bleibt unangetastet, sie gehört allein der
instanced Geometrie.

### Schritt 4 — `GeometryPoolAttachments` nimmt die Ownership auf

`#ownedPools: Set<VOBufferPool>` und `declareOwnedPool()` stehen heute in beiden
Geometrien. Beide Bücher werden an denselben Stellen geführt und in
`InstancedVOBufferGeometry.ts:325-333` im selben Atemzug abgefragt.

`GeometryPoolAttachments` bekommt:

```ts
/** Note that this geometry built `pool` itself, which is what makes it release it. */
declareOwned(pool: VOBufferPool): void;
/** Whether this geometry built `pool` itself. */
owns(pool: VOBufferPool): boolean;
/** Let go of the answer for `pool`: a pool that survives its last route comes back as one from outside. */
forgetOwned(pool: VOBufferPool): void;
```

`detachAll()` und ein neues `clear()` räumen das Set mit. Das Klassen-TSDoc
sagt danach, dass die Klasse über die Beziehung einer Geometrie zu den Pools
Buch führt, die sie erreicht: durch wie viele Routen, und ob die Geometrie den
Pool selbst gebaut hat.

`declareOwnedPool(pool)` bleibt auf **beiden** Geometrien als öffentliche
`@internal`-Methode stehen und delegiert an `declareOwned()`; die Subklassen
rufen sie. Jedes `this.#ownedPools.has(x)` wird zu `this.#attachments.owns(x)`,
jedes `.delete(x)` zu `.forgetOwned(x)`, jedes `.clear()` fällt in das
`clear()`/`detachAll()` der Klasse.

`#extraInstancedPoolAutoDispose` verschwindet: die Antwort steht als
`autoDispose` am Route-Objekt (Schritt 1), und `#releasesExtraPool(name, pool)`
wird zu `route.autoDispose ?? this.#attachments.owns(route.pool)`.

### Schritt 5 — beide Geometrien auf die Kollaborateure stellen

**`VOBufferGeometry`** hält `readonly #routes = new GeometryRoutes()`. Der
Konstruktor legt nach `initializeAttributes()` die eine Route an:
`this.#routes.add({pool: this.pool, buffers: this.buffers, bufferSerials: this.bufferSerials})`
— **ohne** `group`, weil diese Geometrie keine Hälften hat. Die Maps sind die
öffentlichen Felder selbst; die Route bündelt sie, sie kopiert sie nicht.

- `touchAttributes()` → `markForUpload(this.#routes.select(attrNames))`
- `touchBuffers()` → `markForUpload(this.#routes.selectByUsage(bufferTypes))`
- `touch()` → `parseTouchArgs(args)`, dann `touchAttributes(...attrNames)` wenn
  welche da sind und `touchBuffers(flat)` wenn `flat` gesetzt ist. `routed` wird
  hier **nicht** ausgewertet und **nicht** gemeldet: ein `{base: …}` an dieser
  Geometrie wählte auch bisher nichts aus, weil `selectBuffers` in einem solchen
  Objekt keinen Usage-Type findet. Das Verhalten bleibt damit, was es war. Ein
  Satz Kommentar, dass diese Geometrie eine Route hat und die Route-Namen
  deshalb nichts treffen.
- `update()` → `#updateDrawRange()`, dann `this.#routes.checkSerials()`, dann
  `#autoTouchAttributes()`, dann `this.#routes.updateRanges()`, dann
  `this.#slots.syncArrays(this)`. **Die Reihenfolge der fünf Schritte bleibt
  exakt die von heute.**
- `#autoTouchAttributes()` bleibt als kurze Methode:
  `if (this.pool.usedCount === 0) return;` und dann `this.#routes.autoTouch()`.
  Die Abbruchbedingung ist geometriespezifisch und bleibt deshalb hier.
- `dispose()` behält seine Reihenfolge Zeile für Zeile; `#releaseSlots(...)`
  wird zum direkten `releaseRoute()`, `#ownedPools.has(...)` zu `owns(...)`, das
  Wegwerfen der Auto-Touch-Auswahl zu `this.#routes.clear()`. Der Kommentar über
  `super.dispose()` und die Attribut-Slots bleibt Wort für Wort stehen.

**`InstancedVOBufferGeometry`** hält ebenfalls `readonly #routes = new GeometryRoutes()`.

- Der Konstruktor legt die Base-Route mit `group: 'base'` an (nur im
  `else`-Zweig, in dem `basePool` entsteht) und die instanced Route mit
  `group: 'instanced'`.
- `attachInstancedPool()`: nach `initializeInstancedAttributes()` ein
  `this.#routes.attach({name, pool: extraPool, buffers, bufferSerials, group: 'instanced', autoDispose: options?.autoDispose})`.
  Die drei Zeilen, die heute die drei `extraInstanced*`-Maps füllen
  (`:248, 252, 255`), fallen weg — die Maps sind ab jetzt Sichten. Das
  `this.#firstAutoTouch = true` am Ende (`:267`) wird zu
  `this.#routes.resetAutoTouch()`; der Kommentar darüber bleibt. Der
  Früh-Ausstieg für denselben Pool unter demselben Namen (`:198-203`) benutzt
  `this.extraInstancedPools.get(name)` weiter — die Sicht antwortet genauso — und
  setzt `autoDispose` über `this.#routes.setAutoDispose(name, options.autoDispose)`.
- `#detachRoute(name)`: `const route = this.#routes.detach(name)` ersetzt das
  Einsammeln aus drei Maps und die vier `delete()`-Aufrufe (`:301-309`). Die
  Reihenfolge bleibt: erst die Antwort auf `autoDispose` bilden, **dann** die
  Route aus der Buchführung nehmen, dann die Slots freigeben, dann
  `#attachments.detach()`, dann die Auto-Touch-Auswahl (jetzt über
  `resetAutoTouch()` innerhalb von `detach()`), dann die Ownership-Frage aus
  `:325-333`. Alle Kommentare dort bleiben.
- `touchAttributes()` → `markForUpload(this.#routes.select(attrNames))`; die drei
  Blöcke mit `expectDefined` fallen weg.
- `touchBuffers()` → die sechs `selectBuffers(...).forEach(...)`-Blöcke werden zu
  drei Aufrufen: im `'base' in … || 'instanced' in …`-Zweig je ein
  `selectByUsage(bufferTypes.base, 'base')` und
  `selectByUsage(bufferTypes.instanced, 'instanced')` unter ihren bestehenden
  `if`s, im anderen Zweig ein `selectByUsage(bufferTypes as TouchBuffersType)`.
- `touch()` → `parseTouchArgs(args)`, dann in der heutigen Reihenfolge
  `touchAttributes`, `touchBuffers(flat)`, `touchBuffers(routed)`.
- `update()`, `#autoTouchAttributes()` (Abbruch bei `this.instanceCount === 0`),
  `#updateDrawRange()` und `dispose()` wie bei der einfachen Geometrie: gleiche
  Reihenfolge, nur die Rümpfe delegieren. In `dispose()` bleiben die drei
  `#releaseSlots`-Aufrufe (`:403-409`) als drei `releaseRoute()`-Aufrufe in
  derselben Reihenfolge, und die `clear()`-Aufrufe auf den Geometrie-eigenen
  Maps (`:424-427`) bleiben stehen.
- `#updateBuffersUpdateRange()` und `#checkBufferSerials()` verschwinden als
  Methoden; `update()` ruft die Kollaborateure direkt.

Für das `needsUpdate`-Setzen auf einer Liste steht in **beiden** Klassen
dieselbe Schleife. Sie bekommt eine nicht exportierte Funktion in
`GeometryRoutes.ts`, die beide importieren:

```ts
/** Mark every one of these buffers for the next GPU upload. */
export function markForUpload(buffers: BufferLike[]): void;
```

### Schritt 6 — die Typen der angehängten Pools

Das ist der einzige Schritt, der die Oberfläche bewegt:

- `readonly extraInstancedPools: ReadonlyMap<string, VertexObjectPool<unknown>>`
  (statt `Map<string, VOBufferPool>`)
- `readonly extraInstancedBuffers: ReadonlyMap<string, Map<string, BufferLike>>`
- `readonly extraInstancedBufferSerials: ReadonlyMap<string, Map<string, number>>`
- `detachInstancedPool(name: string): VertexObjectPool<unknown> | undefined`

Alle drei Felder werden mit den Sichten aus Schritt 1 initialisiert
(`= this.#routes.attachedPools` usw.). Das TSDoc über den drei Maps sagt danach
nicht mehr, dass sie zusammen gefüllt und geleert werden, sondern dass sie drei
Sichten auf dieselben Routen sind und ein Name, der eine Antwort hat, in allen
dreien eine hat.

`#detachRoute()` gibt weiterhin den Pool zurück; sein Typ folgt der Sicht.

### Schritt 7 — CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, unter `## [Unreleased]` → `### Changed`,
nach den Regeln des Skills `updating-changelog`. Ein Eintrag über die vier
Signaturen aus Schritt 6, mit dem Migrationshinweis: wer in eine der drei Maps
geschrieben hat, benutzt `attachInstancedPool()` und `detachInstancedPool()`;
wer den Rückgabewert von `detachInstancedPool()` auf `VertexObjectPool` gecastet
hat, kann den Cast weglassen. Kein Eintrag über den Umbau selbst — er ist von
außen nicht zu sehen.

## Was nicht in dieses Paket gehört

- **Die Duplikate anders schneiden.** Die Zuordnung Serials→Slots,
  Ownership→Attachments, Routen→Routes steht oben und ist die Entscheidung
  dieses Pakets.
- **`updateUpdateRange()` umbauen.** Die Funktion wird in Paket 3 zu einem
  `addUpdateRange(start, count)`; hier wird sie nur an einer Stelle statt an
  vieren gerufen.
- **Die Konstruktor-Guard auf `InstancedVOBufferGeometry.ts:95`** anfassen (die
  doppelte Bedingung). Sie steht in der Queue des Plans und hat eine andere
  Ursache als dieses Paket.
- **Die Specs erweitern.** Das Sicherungsnetz für die Pool-Zustandsmaschine ist
  der erste Teil von Paket 3.

## Abgleich (Zug 0, 2026-09-20)

| Finding | Stand | Fundstelle heute |
| --- | --- | --- |
| ARCH-006 | **unverändert, verschoben** | `VOBufferGeometry.ts:99-105, 127-143, 155-246`; `InstancedVOBufferGeometry.ts:142-144, 346-355, 437-524, 537-681` |
| TYPE-012 | **unverändert, verschoben** | `InstancedVOBufferGeometry.ts:44-46, 295-297` |

Die Fundstellen des Audits (`VOBufferGeometry.ts:94-101, 123-149, 151-242`,
`InstancedVOBufferGeometry.ts:339-348, 449-481, 489-515, 517-672` bzw.
`:39-41, 184-188, 288-290`) sind durch die Läufe davor und durch Paket 1 und 1b
gewandert; der Sachverhalt steht Zeile für Zeile.

Nachgezählt, weil das Audit Zahlen nennt: der
`selectBuffers(…).forEach(needsUpdate = true)`-Block steht in `touchBuffers()`
genau sechsmal (`:461, 466, 470, 477, 481, 485`), `selectAttributes(…).forEach`
in `touchAttributes()` dreimal (`:440, 445, 451`). Die Drift im nicht-instanced
`touch()` steht auf `VOBufferGeometry.ts:130-136`: `args.forEach` mit einer
Closure-Zuweisung an `let buffers`, worauf TypeScript die Bindung auf
`undefined` verengt und der `if (buffers)`-Zweig auf `never` läuft. Die
instanced Fassung benutzt `for...of` und hat das Problem nicht — deshalb ist
der gemeinsame Parser die Fassung mit der Schleife.

Ein Teil der Audit-Empfehlung ist bereits gebaut: `GeometryAttributeSlots` und
`GeometryPoolAttachments` existieren als Kollaborateure. Deshalb geht dieses
Paket nicht der Empfehlung nach, `syncArrays()` bei den Routen unterzubringen,
sondern legt die Attribut-Serials zu den Slots (Schritt 3) — sie sind mit
`attrName` geschlüsselt, nicht mit einer Route, und dass sie heute in zwei
Objekten liegen, ist genau der Grund, warum es ein `#releaseSlots()` in jeder
Geometrie braucht. Dasselbe für die Ownership (Schritt 4).

**Offene Befunde, triagiert:** In der Queue des Plans steht ein Eintrag, der in
einer Datei dieses Pakets liegt —
`InstancedVOBufferGeometry.ts:95`, die doppelte Bedingung in der
Konstruktor-Guard. Er bleibt liegen: seine Ursache ist eine redundante
Typprüfung im Konstruktor, nicht die Duplikation des Route-Plumbings, und die
Zeile wird von diesem Paket nicht angefasst. Urteil `→ Scope` unverändert, die
Drain-Runde des Abschlusses nimmt ihn. Die übrigen elf Einträge liegen in
anderen Dateien oder außerhalb des Moduls; keiner teilt die Ursache dieses
Pakets. Offene `Folgen:`-Zeilen gibt es keine: die eine Folge aus Paket 1 ist in
Paket 1b erledigt, Paket 1b hat keine hinterlassen.

**Restplan:** Paket 3 bleibt, wo es steht, und behält seine Abhängigkeit von
diesem Paket — sein Serial-Umbau findet die Buchführung danach in
`GeometryRoutes.checkSerials()` und `GeometryRoutes.updateRanges()` statt in
vier Methoden zweier Klassen, und sein `#firstAutoTouch`-Punkt trifft
`GeometryRoutes.autoTouch()` und `resetAutoTouch()`. Kein Schnitt, keine
Reihenfolge geändert.

- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · ARCH-006 unverändert, Fundstellen nach
    `VOBufferGeometry.ts:99-105, 127-143, 155-246` und
    `InstancedVOBufferGeometry.ts:142-144, 346-355, 437-524, 537-681` gewandert ·
    TYPE-012 unverändert, nach `InstancedVOBufferGeometry.ts:44-46, 295-297`
    gewandert · keine offenen `Folgen:` zu verteilen · aus der Queue nichts
    übernommen, `InstancedVOBufferGeometry.ts:95` bleibt dort mit `→ Scope` ·
    Restplan unverändert, Paket 3 behält Platz und Abhängigkeit
  - 2026-09-20 Zug 1: Implementierer beauftragt · Modell stärkste Stufe (`opus`),
    Effort `high` · Brief `paket-2.impl-0.brief.txt`, Report nach
    `paket-2.impl-0.json`
  - 2026-09-20 Zug 2: Report `FERTIG` · neu `GeometryRoutes.ts`,
    `parseTouchArgs.ts` · geändert `VOBufferGeometry.ts`,
    `InstancedVOBufferGeometry.ts`, `GeometryAttributeSlots.ts`,
    `GeometryPoolAttachments.ts`, `packages/twopoint5d/CHANGELOG.md` · keine
    Testdatei angefasst, kein Regressionstest (verhaltenserhaltender Umbau) ·
    vier Abweichungen gemeldet, darunter `detachAll()` räumt das Ownership-Set
    nicht mit (sonst bräche `dispose()`) und ein Verhaltens-Seam am
    `resetAutoTouch()` in `detach()` · Arbeitsbaum jetzt schmutzig (7 Dateien) ·
    eigener Verify-Lauf `pnpm run ci` exit=0, Log `paket-2.verify.log`
  - 2026-09-20 Zug 3: Reviewer (Modell `opus`, Effort `high`) urteilt ARCH-006 und
    TYPE-012 je behoben mit Fundstelle · 4 × wichtig, 5 × klein, committable: nein ·
    Diff `paket-2.diff`, Report `paket-2.review-0.json`
  - 2026-09-20 Zug 4 Runde 1: offen waren 4 wichtige Befunde · einer davon
    (`BREAKING CHANGE:`-Footer in der Commit-Message) hier in der Paketdatei
    erledigt, die übrigen drei plus zwei kleine gingen per `--resume` an denselben
    Implementierer (`fa545ba8-05a0-42b5-9c2c-505fe62ccbe2`, Modell und Effort
    unverändert) · zurück kam `FERTIG` mit allen fünf adressiert; die Trennung
    von `resetAutoTouch()` und `#dropAutoTouchSelection()` steht in
    `GeometryRoutes.ts:213, 238`, die Lifecycle-Doku zeigt
    `#attachments.owns()`, der CHANGELOG-Eintrag nennt den Rückgabetyp beim
    Namen · Verify nach der Runde exit=0 (`paket-2.verify-r1.log`), neuer Diff
    `paket-2.diff-r1` · Reviewer (`paket-2.review-1.json`) bestätigt alle fünf
    erledigt, ARCH-006 und TYPE-012 behoben, kein kritisch, kein wichtig,
    committable: ja · offene Befunde damit von 5 auf 0, Kette beendet
  - 2026-09-20 Zug 5: committet als 93ccb86c · Verify trägt der Lauf aus Runde 1
    (`paket-2.verify-r1.log`, exit=0), seither keine Codeänderung · Arbeitsbaum
    danach sauber bis auf Plan und Paketdateien

## Urteil des Reviewers je Finding (Zug 3 und Zug 4 Runde 1)

**ARCH-006 — behoben.** `GeometryRoutes.ts:76-267` besitzt die Routen samt
Serial- und Auto-Touch-Buchführung; beide Geometrien delegieren
(`VOBufferGeometry.ts:100, 105, 130-134, 149`, `InstancedVOBufferGeometry.ts:425,
432-438, 466-470, 489`). Der Argumentparser liegt einmal in `parseTouchArgs.ts:19`
und trägt beide `touch()` (`VOBufferGeometry.ts:117`,
`InstancedVOBufferGeometry.ts:449`) — die `forEach`-Drift im nicht-instanced
`touch()` ist damit weg. Attribut-Serials und `syncArrays()` stehen einmal in
`GeometryAttributeSlots.ts:54, 143`, die Ownership einmal in
`GeometryPoolAttachments.ts:21-36`. `#serials`, `#releaseSlots`,
`#syncAttributeArrays`, `#checkBufferSerials`, `#updateBuffersUpdateRange`,
`#getAutoTouchBuffers` und `#extraInstancedPoolAutoDispose` existieren in keiner
der beiden Klassen mehr; die sechs `selectBuffers(…).forEach`-Blöcke sind zu drei
`selectByUsage()`-Aufrufen geworden (`InstancedVOBufferGeometry.ts:432, 435, 438`).

**TYPE-012 — behoben.** `InstancedVOBufferGeometry.ts:43-45` exponiert die drei
Felder als `ReadonlyMap`, `:300` gibt `VertexObjectPool<unknown> | undefined`
zurück, und die drei Sichten sind Projektionen einer Quelle
(`GeometryRoutes.ts:78-95`) — die Invariante gilt damit strukturell statt per
Disziplin.

Der Reviewer hat den Verhaltensabgleich gegen den Vorzustand Methode für Methode
geführt: Reihenfolge der fünf `update()`-Schritte, Reihenfolge in beiden
`dispose()`, Routen-Reihenfolge in `touchAttributes()`, `checkSerials()` und
`updateRanges()` (Base vor Instanced vor Benannten), die `base`/`instanced`-
Aufteilung von `touchBuffers()`, die Früh-Ausstiege bei `usedCount === 0` bzw.
`instanceCount === 0`, die `autoDispose`-Auflösung und die Pool-Disposal-Schleife
decken sich. Ein Restunterschied bleibt und ist folgenlos: ein
`detachInstancedPool()` auf einen **freien** Namen wirft die gemerkte
Auto-Touch-Auswahl nicht mehr weg (`GeometryRoutes.ts:123` steigt früh aus), wo
der Vorzustand sie bedingungslos wegwarf — das spart höchstens einen Neuaufbau,
kein Upload verschiebt sich.

## Abweichungen vom Detailplan, bewusst und begründet

1. **`GeometryPoolAttachments#detachAll()` räumt das Ownership-Set nicht mit**
   (`GeometryPoolAttachments.ts:66-83`). Schritt 4 verlangte es; es wäre ein Bug
   gewesen. `detachAll()` steht in beiden `dispose()` **vor** den
   Ownership-Fragen, ein dort geleertes Set hätte jedes `owns()` mit `false`
   beantwortet und keinen selbstgebauten Pool je freigegeben. Nur `clear()` leert
   es, mit Begründung im TSDoc. Vom Reviewer bestätigt.
2. **`detach()` ruft nicht mehr `resetAutoTouch()`** — der Wortlaut von Schritt 1
   gegen die Zusage der Verhaltenserhaltung aus »Was dieses Paket ist und was
   nicht«. Aufgelöst zugunsten der Zusage, entschieden in Zug 4 Runde 1: eine
   private `#dropAutoTouchSelection()` wirft nur die gemerkte Auswahl weg (der
   Speicher-Grund aus Schritt 1) und wird von `add()`, `attach()`, `detach()` und
   `clear()` gerufen; `resetAutoTouch()` setzt zusätzlich `#firstAutoTouch` und
   wird nur noch am Ende von `attachInstancedPool()` gerufen — genau dort, wo der
   Vorzustand es rief. Der Implementierer hat den Unterschied mit einem
   Wegwerf-Spec belegt (vor der Trennung `expected 4 to be 3` auf der `version`
   des statischen Base-Buffers, danach grün) und das Spec anschließend gelöscht;
   die Paketdatei verbietet das Erweitern der Specs.
3. **`projectValues()` materialisiert bei Iteration** (`GeometryRoutes.ts:32-66`).
   Generatoren erfüllen `ReadonlyMap` unter dieser TS-Konfiguration nicht —
   `keys()`, `values()`, `entries()` verlangen `MapIterator`, dem am Generator
   `[Symbol.dispose]` fehlt (TS2322/TS2418). `size`, `get` und `has` delegieren
   direkt; nur die Iterationspfade lesen über ein bei jedem Aufruf frisch aus der
   Quelle gebautes Array. Eine Quelle bleibt es.

## Kleine Befunde, offen gelassen

- `GeometryRoutes.ts:187` — in `selectByUsage()` ist der zweite Term von
  `group === 'instanced' && route.name != null` toter Code: jede benannte Route
  wird mit `group: 'instanced'` angelegt, der vorhergehende Term greift immer
  zuerst. Die Bedingung lässt offen, ob `group` oder `name` die Zugehörigkeit
  entscheidet.
- `GeometryRoutes.ts:105` — `attach()` verschluckt einen belegten Namen mit einem
  stillen `return`. Der einzige Aufrufer hat zu dem Zeitpunkt die Attribute der
  Route bereits auf der Geometrie gebaut; käme es je dazu, hinge eine Route
  unverbucht an der Geometrie und kein `dispose()` fände sie. Heute unerreichbar,
  weil `#detachRoute(name)` vorausläuft — ein `throw` würde die Annahme
  festhalten, statt sie zu unterstellen.
- `GeometryRoutes.ts:210-211` — das TSDoc von `resetAutoTouch()` sagt »A route
  coming or going does not ask it«, aber der einzige Aufrufer ist
  `attachInstancedPool()`, also genau eine kommende Route. Gemeint ist die
  Buchführung innerhalb der Klasse; der Satz behauptet etwas über die Route
  selbst und widerspricht dem Kommentar an der Aufrufstelle.
- `packages/twopoint5d/CHANGELOG.md:163` — »reading them is what it always was«
  stimmt für `get`, `has`, `size` und Iteration, aber die drei Felder sind zur
  Laufzeit keine `Map`-Instanzen mehr, sondern Objektliteral-Sichten
  (`GeometryRoutes.ts:36-63`). Ein JS-Konsument mit `instanceof Map` oder einem
  `structuredClone` über das Feld bekommt eine andere Antwort, und der Satz gibt
  ihm keinen Anlass, danach zu sehen.

Vor dem Commit erledigt, weil sie die Commit-Message trafen und damit in meine
Hand fielen: der fehlende `BREAKING CHANGE:`-Footer und ein Subject, das mit
»hand back the pool type that was attached« denselben zu weit gehenden Anspruch
erhob, der am CHANGELOG-Eintrag als falsch gemeldet worden war.

## Findings im Volltext

**ARCH-006 · medium · Effort M ·
`packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:94-101, 123-149,
151-242; InstancedVOBufferGeometry.ts:339-348, 449-481, 489-515, 517-672`** —
Das gemeinsame Route-/Update-Plumbing aus den beiden Geometrie-Klassen
herausziehen

Weil eine Klasse `BufferGeometry` und die andere `InstancedBufferGeometry`
erweitert, existieren `#serials`, `#syncAttributeArrays`, `#checkBufferSerials`,
`#firstAutoTouch`, `#autoTouchAttributes`, `#getAutoTouchBuffers`,
`#releaseSlots`, `declareOwnedPool` und der `touch()`-Argumentparser zweimal
(~150 Zeilen); die instanced-Variante wiederholt zusätzlich den
`selectBuffers(…).forEach(needsUpdate = true)`-Block sechsmal in
`touchBuffers()` und je einmal pro Route in vier weiteren Methoden. Der nächste
Fix an der Serial/Version-Logik muss an zwei Stellen landen; das nicht-instanced
`touch()` ist bereits gedriftet (forEach mit closure-zugewiesenem `let buffers`,
das TypeScript zu `undefined` verengt, gegenüber for-of in der instanced
Variante).

Empfehlung: Einen `GeometryRoutes`-Kollaborateur neben
`GeometryAttributeSlots`/`GeometryPoolAttachments` einführen, der die Liste der
`{pool, buffers, bufferSerials}`-Routen samt Serial-/Auto-Touch-Zustand besitzt
und `checkSerials()`, `autoTouch(firstTouch)`, `updateRanges()`, `syncArrays()`,
`select()`, `selectByUsage()` anbietet. Beide Geometrien delegieren; die
einfache hält eine Route, die instanced base + instanced + extras.

**TYPE-012 · info · Effort S ·
`packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:39-41,
184-188, 288-290`** — `extraInstancedPools` und `detachInstancedPool()` im
Einklang mit `attachInstancedPool()` typisieren

`attachInstancedPool` speichert immer eine `VertexObjectPool` (Zeile 199-207),
aber die Map und `detachInstancedPool()` geben die Basisklasse zurück, sodass
ein Aufrufer, der `VertexObjectPool<Foo>` angehängt hat, auf dem Rückweg casten
muss, um `createVO()` zu rufen. Die drei öffentlichen Maps sind zudem von außen
mutierbar, obwohl das TSDoc eine Invariante »filled and emptied together«
behauptet.

Empfehlung: `Map<string, VertexObjectPool<unknown>>` speichern,
`VertexObjectPool<unknown> | undefined` aus `detach…` zurückgeben, die Maps als
`ReadonlyMap` exponieren — oder eine `readonly routes`, sobald die
Route-Abstraktion aus ARCH-006 existiert.
