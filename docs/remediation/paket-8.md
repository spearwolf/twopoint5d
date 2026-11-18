# Paket 8 — Vertex Objects: Typen, Capacity und Geometrie-Logik

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TYPE-002 (low), TYPE-004 (low), API-009 (low), ARCH-003 (low), RES-004 (info), PERF-003 (info)
- Ziel: Der Compiler prüft die Buffers-Daten eines Pools und den Pool-Typ der benannten Routen, statt dass ein Cast sie behauptet; die Geometrie-Konstruktoren lehnen eine widersprüchliche Capacity ab, beide Geometrieklassen führen ihre gemeinsame Logik über ein internes Delegate, der Indexbuffer ist 16 Bit, wo die Vertices eines Pools das zulassen, und ein Pool gibt den Scratch seiner Sortierungen auf Wunsch zurück.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`, `InstancedVOBufferGeometry.ts`, `VertexObjectGeometry.ts`, `InstancedVertexObjectGeometry.ts`, `GeometryRoutes.ts`, `VOBufferPool.ts`, `VertexObjectPool.ts`, `createIndicesArray.ts`, `initializeAttributes.ts` (nur falls der Typ es verlangt), `types.ts`
  - neu `packages/twopoint5d/src/vertex-objects/VOGeometryPools.ts` und `checkPoolCapacity.ts` (beide intern, nicht in `public-api.ts`)
  - Specs: `vertex-objects/GeometryRoutes.spec.ts`, `createIndicesArray.spec.ts`, `VertexObjectGeometry.spec.ts`, `InstancedVertexObjectGeometry.spec.ts`, `VertexObjectPool.sortBy.spec.ts`, `vertex-buffers-geometry-updates.spec.ts` (ein neuer Fall, Schritt 4h)
  - Browser: `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js`
  - Doku: `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`), `packages/twopoint5d/src/vertex-objects/README.md`, `packages/twopoint5d/docs/proposals/pool-sorting.md` (§2.6), `packages/twopoint5d/docs/sprites.md` (»Performance«)
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: refuse a capacity a geometry would not read beside the pool it is handed, draw from a 16-bit index buffer where the vertices of a pool allow it, let a vertex object pool give back the scratch of its sorts, run the routes, touches and teardown of both vertex object geometries through one internal class, and let the compiler check the buffers data of a pool and the pools attached to an instanced geometry`
- Verlauf: siehe Abschnitt »Verlauf« am Ende

## Abgleich (Zug 0, gegen `ab9147be`)

`packages/twopoint5d/src/vertex-objects/` ist seit dem Audit-Commit `2e3f585b`
unberührt (`git diff --stat 2e3f585b..HEAD -- packages/twopoint5d/src/vertex-objects/`
leer). Alle sechs Findings stehen unverändert:

- **TYPE-002** unverändert: `VOBufferPool.ts:271-277`, der `map()`-Callback in
  `toBuffersData()` ohne Tupeltyp; Vorbild `VertexObjectBuffer.ts:654`.
- **TYPE-004** unverändert: Cast `GeometryRoutes.ts:101`, `#attached` `:88`, `attach()`
  `:129`. Die Empfehlung des Audits trägt nicht ganz: `VertexObjectPool<T>` ist in `T`
  invariant (`onCreateVO` als Funktions-Property, `adoptVOs(source: VertexObjectPool<T>)`,
  `#voIndex`). In Zug 0 per `tsc` gegen die Quellen geprüft: `VertexObjectPool<Thing>` ist
  `VertexObjectPool<unknown>` nicht zuweisbar, auch nicht mit bivariantem `onCreateVO`.
  Abweichung siehe Schritt 2.
- **API-009** unverändert: `VOBufferGeometry.ts:53`, `VertexObjectGeometry.ts:20-22`,
  `InstancedVOBufferGeometry.ts:157-159` (instanced) und `:172-174` (base),
  `InstancedVertexObjectGeometry.ts:40-49`.
- **ARCH-003** unverändert: `dispose()` `VOBufferGeometry.ts:102` /
  `InstancedVOBufferGeometry.ts:478`, `touchAttributes()` `:139` / `:552`, `update()` `:194`
  / `:618`; dazu der Konstruktor-`catch` (`:66` / `:203`) und `declareOwnedPool()`
  (`:83` / `:224`). Die Bookkeeping-Klassen `GeometryPoolAttachments`,
  `GeometryAttributeSlots`, `GeometryRoutes` gibt es schon (früherer Lauf); doppelt ist,
  was die beiden Geometrien mit ihnen tun.
- **RES-004** unverändert, Fundstelle jetzt `VertexObjectPool.ts:569-570` (Audit nennt
  `:563`); Scratch-Felder `:92-101`, Freigabe nur in `dispose()` `:374-379`.
- **PERF-003** unverändert: `createIndicesArray.ts:14` (`Uint32Array` fest),
  `initializeAttributes.ts:46`. three 0.187 behält ein `Uint16Array` als Indexformat
  `uint16` (`three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js:120-133`), füllt die
  Buffergröße auf ein Vielfaches von 4 Bytes auf (`:208-209`), nimmt unter WebGL 2
  `UNSIGNED_SHORT` (`webgl-fallback/utils/WebGLAttributeUtils.js:105-113`) und setzt ein
  `stripIndexFormat` nur für `Line`-Objekte (`webgpu/utils/WebGPUUtils.js:231-235`).

Triage: Die Pakete 1–7 tragen alle `Folgen: keine`. Kein Eintrag in »Offene Befunde«
liegt in `vertex-objects/` oder teilt eine Ursache mit diesem Paket; keiner wird
übernommen.

## Entscheidungen dieses Pakets

- **Ein Paket, kein 8b.** Der Umbau aus ARCH-003 verschiebt rund 250 Zeilen Logik aus
  zwei Dateien in eine dritte; die Verhaltensänderungen in denselben Dateien sind ein
  Guard am Anfang jedes Konstruktors (API-009) und das Verschieben eines Typs. Das bleibt
  im Review unterscheidbar, anders als die rund tausend Zeilen, die Paket 6b abgeteilt
  hat. Die Reihenfolge der Schritte trennt Umbau und Verhalten trotzdem.
- **TYPE-004 mit einer Typ-Löschung statt ganz ohne Cast.** `attach()` und `#attached`
  tragen `pool: VertexObjectPool<unknown>` wie empfohlen, der Downcast von `VOBufferPool`
  in `attachedPools` entfällt, und `attach()` lehnt einen `VOBufferPool` zur Compile-Zeit
  ab. Weil `VertexObjectPool<T>` invariant ist, löscht `attachInstancedPool()` den
  Typparameter an der einen Stelle, an der eine benannte Route entsteht
  (`extraPool as VertexObjectPool<unknown>`; kompiliert, in Zug 0 geprüft). Ein `any` oder
  ein `as unknown as` kommt nicht in Frage.
- **RES-004 als Methode** `VertexObjectPool#releaseSortScratch()`, nicht als Verwerfen
  nach »seltenen« Sortierungen: Entscheidung 2 im Plan (Code-Fix vor Doku-Vermerk), und
  eine Heuristik für »selten« bräche die Zusage, dass jede Sortierung nach der ersten
  nichts allokiert.
- **PERF-003: Grenze `capacity × vertexCount ≤ 65 535`**, wie das Audit sie nennt. Der
  größte Index ist dann 65 534 und trifft nie `0xFFFF`, den Restart-Index von 16-Bit-
  Indices: WebGPU wendet ihn auf Strips an (`Line`, siehe oben), WebGL 2 hält Primitive
  Restart für jeden Draw eingeschaltet (WebGL-2.0-Spezifikation, Abschnitt »Primitive
  Restart is Always Enabled« — in Zug 0 nicht nachgeschlagen; die Grenze ist ohnehin die
  vorsichtige).
- **API-009: Prüfung vor allem anderen** in jedem der vier Konstruktoren, vor der
  Prüfung auf einen disposten Pool und vor jedem Pool-Bau, damit beide Schichten
  dieselbe Reihenfolge haben. Die Basis-Capacity wird nur geprüft, wenn sie übergeben
  wurde (`undefined` heißt »nicht übergeben«, wie bisher).
- **Teardown leert die Maps jeder Route**, auch der benannten. Bisher leerte
  `InstancedVOBufferGeometry#dispose()` die Maps der Basis- und der Instanz-Route, die
  benannten fielen nur aus der Sicht. Eine Regel für alle Routen ist der Sinn des
  Delegates, und die TSDoc von `dispose()` sagt schon, dass danach kein Buffer mehr
  gehalten wird. Sichtbar wird das nur über eine Map, die sich ein Aufrufer vorher aus
  `extraInstancedBuffers`/`extraInstancedBufferSerials` geholt hat: eigener Spec-Fall
  (4h) und eine Zeile im CHANGELOG.

## Vorgehen

Reihenfolge: zuerst die Regressionstests rot sehen (2c im Typecheck; 3c, 4h, 5c, 6c in
Vitest), dann beheben; den Umbau (Schritt 4) als eigenen Schritt nach 1–3, damit jeder
Zwischenstand grün ist. Schritt 1 hat keinen Regressionstest (siehe 1b).
Jede Fehlermeldung unten ist der exakte String. Die Regeln aus `AGENTS.md` (»Error and
warning messages«, `#private`, `.js`-Suffix, `import type`, »Public surface«, »Two test
surfaces«, Allocation-Specs) und die »Konventionen« im Plan gelten für jede Zeile —
Kommentare, TSDoc, CHANGELOG, Guides und Testnamen eingeschlossen. Keine Finding-ID in
irgendeiner Zeile des Repos, kein Rückblick auf den Vorzustand außerhalb der
Commit-Message. Die Dateien aus »Dateien« vor dem ersten Edit ganz lesen.

### 1. Der Rückgabetyp von `toBuffersData()` (TYPE-002)

a. `VOBufferPool.ts:273`: den Callback als
   `(buffer): [string, TypedArray] => [buffer.bufferName, copy ? buffer.typedArray!.slice() : buffer.typedArray!]`
   annotieren, `TypedArray` als `import type` aus `./types.js`. Kommentar darüber wie
   in `VertexObjectBuffer.ts:652-653`: der Tupeltyp wählt die typisierte Überladung von
   `Object.fromEntries()`, ohne ihn ist das Ergebnis `any`.
b. Kein Laufzeit-Regressionstest möglich (das `any` lebt nur im Rumpf, der deklarierte
   Rückgabetyp stimmt schon); Beleg ist `pnpm typecheck`. Im Report so vermerken.

### 2. Der Pool-Typ der benannten Routen (TYPE-004)

a. `GeometryRoutes.ts`: neuer exportierter Typ unter `GeometryRoute`:

   ```ts
   /** A route attached under a name: fed from a `VertexObjectPool`, always on the instanced half. */
   export type AttachedGeometryRoute = GeometryRoute & {
     readonly name: string;
     readonly group: 'instanced';
     readonly pool: VertexObjectPool<unknown>;
   };
   ```

   `#attached: Map<string, AttachedGeometryRoute>`; `attach(route: AttachedGeometryRoute)`;
   `route(name): AttachedGeometryRoute | undefined`; `detach(name): AttachedGeometryRoute | undefined`.
   `attachedPools` projiziert `(route) => route.pool` ohne Cast; der Kommentar
   `:252-253` entfällt, weil der Typ jetzt sagt, was er behauptete.
b. `InstancedVOBufferGeometry#attachInstancedPool()` übergibt
   `pool: extraPool as VertexObjectPool<unknown>` an `routes.attach()`, mit Kommentar:
   die Routen lesen kein Vertex Object des Pools, und TypeScript hält
   `VertexObjectPool<T>` in `T` invariant (`onCreateVO`, `adoptVOs()`), also wird der
   Typparameter hier gelöscht, an der einen Stelle, an der eine benannte Route entsteht.
c. Regressionstest (Typ): `GeometryRoutes.spec.ts` baut seine Pools mit
   `new VertexObjectPool(...)` statt `new VOBufferPool(...)`, und ein neuer Fall
   `attach() takes a VertexObjectPool and refuses a VOBufferPool at compile time` ruft
   `routes.attach()` mit einem `VOBufferPool` unter `// @ts-expect-error a named route is fed from a VertexObjectPool`
   (zur Laufzeit wirft der Aufruf nichts; der Fall prüft nur, dass er durchgeht).
   Vor dem Fix ist `pnpm typecheck` rot (unbenutztes `@ts-expect-error`); den roten
   Typecheck-Lauf in den Report.

### 3. Capacity neben einem übergebenen Pool (API-009)

a. Neu `vertex-objects/checkPoolCapacity.ts`:

   ```ts
   import {describeValue} from '../utils/describeValue.js';
   import type {VOBufferPool} from './VOBufferPool.js';

   /**
    * Throws a `RangeError` when a geometry is handed `pool` together with a capacity other than the
    * pool's own: the geometry takes its size from the pool, so a capacity it would not read stands
    * for a size the caller expects and does not get.
    *
    * @internal
    */
   export function checkPoolCapacity(
     subject: string,
     capacityName: string,
     poolName: string,
     pool: VOBufferPool,
     capacity: unknown,
   ): void {
     if (capacity !== pool.capacity) {
       throw new RangeError(
         `${subject}: ${capacityName} must be the capacity of ${poolName} handed in, ${pool.capacity}, got ${describeValue(capacity)}`,
       );
     }
   }
   ```

b. Aufrufe, jeweils als **erste** Anweisung des Konstruktors (vor der Prüfung auf einen
   disposten Pool, vor `super()`, vor jedem Pool-Bau):
   - `VOBufferGeometry`: `if (source instanceof VOBufferPool) checkPoolCapacity('new VOBufferGeometry()', 'capacity', 'the pool', source, capacity);`
   - `VertexObjectGeometry`: `if (source instanceof VertexObjectPool) checkPoolCapacity('new VertexObjectGeometry()', 'capacity', 'the pool', source, capacity);`
   - `InstancedVOBufferGeometry`: `if (args[0] instanceof VOBufferPool) checkPoolCapacity('new InstancedVOBufferGeometry()', 'capacity', 'the instanced pool', args[0], args[1]);`
     und `if (args[2] instanceof VOBufferPool && args[3] !== undefined) checkPoolCapacity('new InstancedVOBufferGeometry()', 'the base capacity', 'the base pool', args[2], args[3]);`
   - `InstancedVertexObjectGeometry`: dieselben zwei mit `VertexObjectPool` und Subjekt
     `'new InstancedVertexObjectGeometry()'`, vor `asPool()`.

   Ergibt z. B. `new VOBufferGeometry(): capacity must be the capacity of the pool handed in, 10, got 1000`
   und `new InstancedVertexObjectGeometry(): the base capacity must be the capacity of the base pool handed in, 1, got 4`.
c. Regressionstests (vor dem Fix rot):
   - `VertexObjectGeometry.spec.ts`, `test.each` über `VOBufferGeometry` und
     `VertexObjectGeometry`: `refuses a capacity other than the one of the pool handed in, and leaves the pool alive and unattached`
     — Pool mit 10 Slots, `capacity` 1000 → `RangeError` mit der exakten Meldung;
     danach `pool.isDisposed === false`, `pool.isAttachedToGeometry === false`.
   - `InstancedVertexObjectGeometry.spec.ts`, für beide Instanced-Klassen:
     `refuses a capacity other than the one of the instanced pool handed in, and leaves the pool alive and unattached`
     und `refuses a base capacity other than the one of the base pool handed in, and leaves both pools alive and unattached`;
     dazu (grün auch vorher) `takes a base pool without a base capacity`.
d. TSDoc der vier Konstruktoren: ein `@throws a RangeError …`-Satz: wer einen Pool
   übergibt, übergibt dessen Capacity (bei der Basis nur, wenn eine Basis-Capacity folgt);
   die Prüfung kommt vor allem anderen, und der Pool bleibt, wie er war.
e. Aufrufer mit abweichender Capacity mitziehen. In Zug 0 stichprobenartig keiner
   gefunden (Specs, `README.md:298, 306`, `vertex-objects-buffers-data.test.js:47`); der
   Testlauf entscheidet. `FeatureSpritesGeometry` und `TileSpritesGeometry` übergeben
   Descriptions, nie Pools.

### 4. Gemeinsame Logik der Geometrien in einem Delegate (ARCH-003)

Reiner Umbau ohne Verhaltensänderung, mit einer Ausnahme (4h). Die Vererbung von
`BufferGeometry` bzw. `InstancedBufferGeometry` verhindert eine gemeinsame Basisklasse;
beide Geometrien halten deshalb ein Delegate. Der Name folgt Regel 3 in
`docs/architecture.md` (»`vertex-objects/` — the performance core«): die Klasse kennt
keinen Objekttyp, also `VO*`.

a. **`TouchInstancedBuffersType` umziehen**: Definition samt TSDoc aus
   `InstancedVOBufferGeometry.ts:26-30` nach `types.ts`, direkt unter `TouchBuffersType`
   (`:46`). In `InstancedVOBufferGeometry.ts` nur noch `import type`. Öffentlich bleibt
   der Name über `export type * from './types.js'` in `public-api.ts`; ein zweiter Export
   aus `InstancedVOBufferGeometry.ts` darf nicht stehen bleiben (Doppel-Export).

b. **Neu `vertex-objects/VOGeometryPools.ts`** (`@internal`, nicht in `public-api.ts`),
   Klassen-TSDoc: was ein Vertex-Object-Geometry über die Pools hält, die sie zeichnet —
   Routen, Attachments, Attributslots, die geräumten Slots, ob sie disposed ist — und
   warum ein Delegate statt einer Basisklasse. Inhalt:

   ```ts
   /** How a route builds its attributes: `initializeAttributes()` or `initializeInstancedAttributes()`. */
   type InitializeRoute = (
     geometry: BufferGeometry,
     pool: VOBufferPool,
     buffers: AttributeRoute,
     bufferSerials: Map<string, number>,
     slots: GeometryAttributeSlots,
   ) => void;

   /** How many vertices a pool draws: its objects in use times the indices or the vertices of one object. */
   export function drawCountOf(pool: VOBufferPool): number;

   export class VOGeometryPools {
     readonly attachments = new GeometryPoolAttachments();
     readonly slots = new GeometryAttributeSlots();
     readonly routes = new GeometryRoutes();

     get isDisposed(): boolean;

     addRoute(geometry: BufferGeometry, route: GeometryRoute, initialize: InitializeRoute): void;
     abandon(pools: ReadonlyArray<VOBufferPool | undefined>): void;
     detach(geometry: BufferGeometry, name: string): VertexObjectPool<unknown> | undefined;
     touch(arg: string | TouchBuffersType | TouchInstancedBuffersType): void;
     touchBuffers(bufferTypes: TouchBuffersType | TouchInstancedBuffersType): void;
     sync(drawsAnything: boolean): void;
     dispose(geometry: BufferGeometry, emitDispose: () => void): void;
   }
   ```

   Private: `#disposed = false`, `#vacatedSlots` (Map samt TSDoc aus
   `InstancedVOBufferGeometry.ts:97-108`), `#releasesRoute(route: GeometryRoute): boolean`
   (Rumpf aus `:452-454`: `route.autoDispose ?? this.attachments.owns(route.pool)`), und
   die Modul-Funktion `giveUpArray()` samt Kommentar aus `:16-24`.

   - `drawCountOf(pool)`: `pool.descriptor.hasIndices ? pool.usedCount * pool.descriptor.indices.length : pool.usedCount * pool.descriptor.vertexCount`
     (heute doppelt in `VOBufferGeometry.ts:206-213` und `InstancedVOBufferGeometry.ts:631-642`).
   - `addRoute()`: `this.attachments.attach(route.pool)`, dann
     `initialize(geometry, route.pool, route.buffers, route.bufferSerials, this.slots)`, dann
     `this.routes.add(route)` — die Reihenfolge der heutigen Konstruktoren.
   - `abandon(pools)`: `this.attachments.detachAll()`, dann jeden Pool aus `pools`, der
     nicht `undefined` ist und `this.attachments.owns(pool)` erfüllt, disposen. Kommentar
     aus `VOBufferGeometry.ts:67-68`.
   - `detach(geometry, name)`: der Rumpf von `InstancedVOBufferGeometry#detachRoute()`
     (`:413-446`) samt Kommentaren, mit `this.routes.route(name)?.pool` statt
     `this.extraInstancedPools.get(name)` und `geometry` statt `this`.
   - `touch(arg)`: `typeof arg === 'string'` → `this.routes.touchAttribute(arg)`;
     `'base' in arg || 'instanced' in arg` → `this.touchBuffers(arg)`; sonst
     `this.routes.touchByUsage(arg as TouchBuffersType)`. Kommentar: auf einer Geometrie
     mit einer einzigen Route ohne `group` wählen Usage-Typen für eine Hälfte nichts aus —
     das ist das Verhalten des heutigen `continue` in `VOBufferGeometry.ts:177-180`.
   - `touchBuffers(bufferTypes)`: Rumpf aus `InstancedVOBufferGeometry.ts:569-578`.
   - `sync(drawsAnything)`: `if (drawsAnything) this.routes.autoTouch();` dann
     `this.routes.syncUploads();` dann `this.routes.syncArrays();` — mit dem Kommentar
     »before the uploads are synced: what is asked for here decides how wide each of them
     goes«.
   - `dispose(geometry, emitDispose)`, exakt in dieser Ordnung:
     1. `if (this.#disposed) return; this.#disposed = true;`
     2. jeden Eintrag aus `#vacatedSlots`, dessen Slot leer ist
        (`geometry.getAttribute(attrName) === undefined`), per `setAttribute` leihen und
        merken (Kommentar aus `InstancedVOBufferGeometry.ts:482-486`);
     3. `try { emitDispose(); } finally {` — Kommentar zum werfenden Listener aus
        `VOBufferGeometry.ts:112-114`;
     4. im `finally`: geliehene Attribute per `deleteAttribute` zurück,
        `#vacatedSlots.clear()`, `this.attachments.detachAll()`, für jede Route aus
        `this.routes` (unbenannte zuerst, in der Reihenfolge ihres Baus, dann die benannten)
        `this.slots.releaseRoute(geometry, route.buffers)`, `geometry.setIndex(null)`
        (Kommentar aus `VOBufferGeometry.ts:117-118`), für jede Route mit
        `this.#releasesRoute(route)` `route.pool.dispose()` (ein Pool hinter zwei Routen
        wird zweimal gerufen; `dispose()` ist idempotent — als Kommentar), für jede Route
        `route.buffers.clear()` und `route.bufferSerials.clear()`, dann
        `this.routes.clear()` (Kommentar aus `VOBufferGeometry.ts:129`) und
        `this.attachments.clear()`.

     Das ist für beide Geometrien dieselbe Folge wie heute: die Basis-Route entsteht vor
     der Instanz-Route, also lösen sich ihre Slots in derselben Reihenfolge wie in
     `InstancedVOBufferGeometry.ts:511-522`; die Reihenfolge, in der Pools disposed werden,
     hat keine Wirkung nach außen (`VOBufferPool#dispose()` sendet nichts).

c. **`VOBufferGeometry`** nach dem Umbau:
   - Felder `#attachments`, `#slots`, `#routes`, `#disposed` entfallen, an ihre Stelle
     `readonly #pools = new VOGeometryPools();`. `#buffers`, `#bufferSerials` und ihre
     Getter bleiben.
   - Konstruktor: 3b-Prüfung, Prüfung auf einen disposten Pool (unverändert), `super()`,
     `this.name = 'VOBufferGeometry'`, dann `let pool: VOBufferPool | undefined;` und
     **im** `try`: `pool = source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity); this.pool = pool;`,
     bei gebautem Pool `this.declareOwnedPool(pool)`, dann
     `this.#pools.addRoute(this, {pool, buffers: this.#buffers, bufferSerials: this.#bufferSerials}, initializeAttributes)`
     samt dem Kommentar `:63-64`; `catch`: `this.#pools.abandon([pool]); throw error;`.
     Damit entsteht der Pool in beiden Klassen im `try`.
   - `declareOwnedPool(pool)`: `this.#pools.attachments.declareOwned(pool)`.
   - `dispose()`: `this.#pools.dispose(this, () => super.dispose());` — die TSDoc bleibt.
   - `touchAttributes()`: Schleife über `arguments` bleibt (siehe `docs/architecture.md`,
     `arguments` darf nicht weitergereicht werden), Rumpf
     `this.#pools.routes.touchAttribute(arguments[i] as string)`.
   - `touchBuffers(bufferTypes)`: `this.#pools.touchBuffers(bufferTypes)`.
   - `touch()`: Schleife über `arguments`, Rumpf `this.#pools.touch(arguments[i] as string | TouchBuffersType)`.
   - `update()`: `if (this.#pools.isDisposed) return; this.setDrawRange(0, drawCountOf(this.pool)); this.#pools.sync(this.pool.usedCount > 0);`
     — `#updateDrawRange()` und `#autoTouchAttributes()` entfallen.
   - Nicht mehr gebrauchte Imports entfernen.

d. **`InstancedVOBufferGeometry`** nach dem Umbau:
   - `#attachments`, `#slots`, `#routes`, `#disposed`, `#vacatedSlots`, `giveUpArray()`,
     `#detachRoute()`, `#releasesRoute()`, `#updateDrawRange()`, `#autoTouchAttributes()`
     entfallen; neu `readonly #pools = new VOGeometryPools();`. Die vier Map-Felder und
     ihre Getter bleiben, ebenso `extraInstancedPools`/`extraInstancedBuffers`/
     `extraInstancedBufferSerials` (jetzt über `this.#pools.routes.attached…`).
   - Konstruktor: 3b-Prüfungen, Prüfungen auf disposte Pools (unverändert), `super()`,
     im `try`: Instanz-Pool wie heute; Basis aus `BufferGeometry` wie heute (`copy()`,
     `this.#pools.slots.claimExisting(this)`); sonst Basis-Pool wie heute und
     `this.#pools.addRoute(this, {pool: basePool, buffers: baseBuffers, bufferSerials: this.#baseBufferSerials, group: 'base'}, initializeAttributes)`;
     `this.name = …`; dann
     `this.#pools.addRoute(this, {pool: instancedPool, buffers: this.#instancedBuffers, bufferSerials: this.#instancedBufferSerials, group: 'instanced'}, initializeInstancedAttributes)`;
     `this.instanceCount = 0` samt Kommentar. `catch`:
     `this.#pools.abandon([instancedPool, this.basePool]); throw error;`.
   - `attachInstancedPool()`: Ablauf und Meldungen unverändert, nur über das Delegate:
     `this.#pools.isDisposed`, `this.#pools.routes.setAutoDispose()`,
     `this.#pools.slots.everHeld()`, `this.#pools.attachments.attach()/detach()`,
     `this.#pools.slots.withdrawRoute()`, `this.declareOwnedPool()`,
     `this.#pools.detach(this, name)` an der Stelle von `this.#detachRoute(name)`,
     `this.#pools.routes.attach({..., pool: extraPool as VertexObjectPool<unknown>, ...})` (2b).
   - `detachInstancedPool(name)`: `return this.#pools.detach(this, name);` — TSDoc bleibt.
   - `dispose()`: `this.#pools.dispose(this, () => super.dispose());` — TSDoc bleibt.
   - `touchAttributes()`/`touch()`: Schleifen wie in 4c, `touch()` ruft
     `this.#pools.touch(arguments[i] as string | TouchBuffersType | TouchInstancedBuffersType)`.
   - `touchBuffers(bufferTypes)`: `this.#pools.touchBuffers(bufferTypes)`.
   - `update()`: `if (this.#pools.isDisposed) return; this.instanceCount = this.instancedPool.usedCount;`
     dann bei `this.basePool` `this.setDrawRange(0, drawCountOf(this.basePool))` mit dem
     Kommentar aus `:632-633`, dann `this.#pools.sync(this.instanceCount > 0);`.

e. `VertexObjectGeometry.ts` und `InstancedVertexObjectGeometry.ts` bleiben bis auf
   Schritt 3b unverändert; sie rufen weiter `declareOwnedPool()`.

f. Hot Path: `update()`, `touch()` und `touchAttributes()` gehen jetzt einen Aufruf
   tiefer über `#pools`; neue Allokationen darf das nicht bringen. `pnpm test:allocations`
   (im Gate) hält `touch()` und `update()`; bei Rot den ganzen File nachstellen, nie mit
   `-t` (AGENTS.md).

g. Kein eigenes Spec für `VOGeometryPools`: die Geometrie-Specs
   (`vertex-buffers-geometry-updates.spec.ts`, `VertexObjectGeometry.spec.ts`,
   `InstancedVertexObjectGeometry.spec.ts`, `VertexObjectPool.spec.ts`) und die
   Browser-Tests `vertex-objects-*.test.js` decken jede verschobene Zeile ab und müssen
   unverändert grün bleiben. Fällt die Coverage-Schwelle aus `vite.config.ts`, fehlt ein
   Fall — dann im Report melden, nicht die Schwelle anfassen.

h. Die eine Verhaltensänderung (siehe »Entscheidungen dieses Pakets«), Regressionstest
   in `vertex-buffers-geometry-updates.spec.ts`, vor dem Umbau rot:
   `dispose() empties the buffer and serial maps of a pool attached under a name, as it does those of the base and the instanced pool`
   — Map aus `extraInstancedBuffers.get(name)` und `extraInstancedBufferSerials.get(name)`
   vor `dispose()` holen, danach `size === 0`.

### 5. Der Sort-Scratch eines Pools (RES-004)

a. `VertexObjectPool.ts`, neue öffentliche Methode direkt nach `sortByPreparedKeys()`:

   ```ts
   /**
    * Lets go of the scratch the sorts of this pool have built: the keys, the order of the slots,
    * the merge scratch, the slot array of the vertex objects and the copy of the largest buffer,
    * which together hold more than that buffer itself. The next sort builds it again and allocates
    * on that one call, as the first sort does; {@link sortByPreparedKeys} throws until
    * {@link prepareSortKeys} has prepared keys again. Meant for a large pool that has sorted and
    * will not sort again soon — a pool sorted every frame keeps its scratch.
    *
    * Does nothing on a pool that has not sorted and on a disposed pool.
    */
   releaseSortScratch(): void
   ```

   Rumpf: die sechs Zeilen aus `dispose()` `:374-379` (`#sortKeys`, `#sortOrder`,
   `#sortMerge` auf `undefined`, `#sortVOs = []`, `#sortScratch = undefined`,
   `#sortScratchViews.clear()`). `dispose()` ruft an ihrer Stelle
   `this.releaseSortScratch()`. `#valueLayouts` bleibt — das ist kein Scratch.
b. TSDoc von `sortBy()` (`:448-449`): »The first sort allocates the scratch of the pool,
   which grows only with the capacity; every later one allocates nothing« um »until
   {@link releaseSortScratch} lets go of it« ergänzen.
c. Regressionstests in `VertexObjectPool.sortBy.spec.ts` (vor dem Fix rot, die Methode
   fehlt), eigener `describe('releaseSortScratch()')`:
   - `lets go of the keys, and prepareSortKeys() builds new ones` —
     `prepareSortKeys()` vor und nach `releaseSortScratch()` liefert verschiedene Arrays.
   - `sortByPreparedKeys() throws after it until keys are prepared again` — exakte
     Meldung `VertexObjectPool#sortByPreparedKeys(): no keys are prepared for the capacity of this pool — call prepareSortKeys() first`.
   - `the next sort sorts as before` — `sortBy('x')` nach der Freigabe ergibt dieselbe
     Ordnung wie ein Pool, der nie freigegeben hat.
   - `does nothing on a pool that has not sorted and on a disposed pool` — kein Wurf.
d. Doku: `src/vertex-objects/README.md:275-276` (letzter Punkt von »Sorting a pool«) um
   einen Satz zu `releaseSortScratch()` ergänzen; `docs/proposals/pool-sorting.md` §2.6
   (`:177-182`) ebenso; `docs/sprites.md` »Performance« (`:2971-2972`) einen Halbsatz:
   eine Art, die einmal sortiert hat und lange nicht wieder sortiert, gibt den Scratch
   mit `sprites.spritePool?.releaseSortScratch()` zurück (`spritePool` ist der Getter
   `FeatureSprites.ts:408`).

### 6. Der Indexbuffer (PERF-003)

a. `createIndicesArray.ts`: Rückgabetyp `Uint16Array | Uint32Array`. Modul-Konstante
   `const MAX_16_BIT_VERTEX_COUNT = 0xffff;` mit Kommentar: ein Pool von höchstens
   65 535 Vertices nennt keinen Index über 65 534 und damit nie `0xFFFF`, den
   Restart-Index von 16-Bit-Indices, den WebGL 2 bei jedem Draw und WebGPU bei Strips
   anwendet. Ziel-Array:
   `count * stride <= MAX_16_BIT_VERTEX_COUNT ? new Uint16Array(count * itemCount) : new Uint32Array(count * itemCount)`.
   `local` bleibt ein `Uint32Array` (geprüft wird einmal je Index, wie heute). TSDoc der
   Funktion um den Satz zum Elementtyp ergänzen.
b. `initializeAttributes.ts:46` bleibt, solange `new BufferAttribute(…, 1)` den
   Union-Typ annimmt; sonst den Typ dort sauber führen, ohne Cast.
c. Regressionstests (vor dem Fix rot):
   - `createIndicesArray.spec.ts`: `answers a Uint16Array up to 65535 vertices and a Uint32Array beyond`
     — `createIndicesArray([0, 1, 2, 3, 4], 13107, 5)` (65 535 Vertices) ist ein
     `Uint16Array`, dessen größtes Element 65 534 ist (letztes Objekt `[65530, …, 65534]`);
     `createIndicesArray([0, 2, 1, 0, 3, 2], 16384, 4)` (65 536 Vertices) ist ein
     `Uint32Array`, dessen größtes Element 65 535 ist (letztes Objekt
     `[65532, 65534, 65533, 65532, 65535, 65534]`).
   - `VertexObjectGeometry.spec.ts`: `holds the indices of a pool of up to 65535 vertices in a Uint16Array, and of a larger one in a Uint32Array`
     über `geometry.index!.array`; derselbe Fall für das Instanced-Geometry in
     `InstancedVertexObjectGeometry.spec.ts` (Index aus der Basis-Route).
d. Browser, `vertex-objects-gpu-upload.test.js`:
   - `:326-349` (`an object whose indices leave a vertex unused …`): liest den Index heute
     als `Uint32Array` zurück (`:346`). Auf den Typ von `geometry.index.array`
     umstellen, `expect(geometry.index.array).to.be.instanceOf(Uint16Array)` dazu.
   - neu `draws the object behind vertex 65535 from a 32-bit index`: `VertexObjectGeometry`
     auf `quadDescription` (4 Vertices) mit Capacity 16 384 (65 536 Vertices), alle Slots
     belegen, nur das letzte Objekt als bildfüllendes Quad setzen (Muster `:405-410`),
     `index.array` ist `Uint32Array`, das mittlere Pixel trägt die Farbe des Materials —
     gelesen über `renderToPixels()`/`rgbAt()`/`isNearColor()` wie in `:412-416`.
   - neu `draws an odd number of 16-bit indices`: Capacity 1 mit `indices: [0, 1, 2]`
     (6 Bytes, three füllt auf 8 auf) zeichnet sein Dreieck — Pixelprüfung wie oben.
   Beide Fälle rendern, gehören also nicht in `RENDERER_FREE_FILES` und laufen unter
   WebGPU und WebGL 2.
e. Doku: `src/vertex-objects/README.md`, Punkt **`indices`** (`:36-38`) um einen Satz:
   die Geometrie hält die wiederholten Indices in einem `Uint16Array`, solange der Pool
   insgesamt höchstens 65 535 Vertices hat (`capacity × vertexCount`), sonst in einem
   `Uint32Array`.

### 7. CHANGELOG und Doku zu API-009

a. `packages/twopoint5d/CHANGELOG.md` unter `## [Unreleased]` (Skill
   `updating-changelog`), ohne Rückblick, ohne Finding-ID:
   - Added: `VertexObjectPool#releaseSortScratch()`.
   - Changed (breaking): Der Indexbuffer der Vertex-Object-Geometrien ist ein
     `Uint16Array`, solange `capacity × vertexCount` höchstens 65 535 ist, sonst ein
     `Uint32Array`.
   - Changed (breaking): Die Konstruktoren von `VOBufferGeometry`,
     `VertexObjectGeometry`, `InstancedVOBufferGeometry` und
     `InstancedVertexObjectGeometry` werfen einen `RangeError`, wenn sie einen Pool mit
     einer anderen Capacity als seiner eigenen bekommen (die Basis nur mit Basis-Capacity).
   - Changed: `InstancedVOBufferGeometry#dispose()` leert auch die Buffer- und
     Serial-Maps der unter einem Namen angehängten Pools.
   - Migration Guide: zwei Einträge — `pool.capacity` übergeben; `geometry.index.array`
     als das Typed Array lesen, das es ist (Typ prüfen statt `Uint32Array` annehmen).
   `TouchInstancedBuffersType` bleibt unter demselben Namen exportiert: kein Eintrag.
b. `src/vertex-objects/README.md`, Abschnitt »Growing a pool«: neuer Punkt nach
   »**Refused**« (`:322-324`): eine Geometrie, die einen Pool bekommt, nimmt dessen
   Capacity — `new VertexObjectGeometry(pool, pool.capacity)`; jede andere wirft einen
   `RangeError`.

## Findings im Volltext

**TYPE-002 · low · packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:271** — Rückgabetyp von toBuffersData() über getupleten Eintragstyp absichern
`Object.fromEntries()` bekommt hier ein Array aus `(string | TypedArray)[]` und beantwortet es mit `any`; das Feld `buffers` von `VertexObjectBuffersData` wird also ungeprüft zugewiesen. `VertexObjectBuffer#toAttributeArrays()` löst dasselbe Problem mit einem expliziten Tupeltyp und nennt den Grund im Kommentar — hier fehlt der Handgriff.
Beleg: `buffers: Object.fromEntries(Array.from(this.buffer.buffers.values()).map((buffer) => [buffer.bufferName, copy ? buffer.typedArray!.slice() : buffer.typedArray!]))` gegenüber `VertexObjectBuffer.ts:654` `(attrName): [string, TypedArray | undefined] =>`
Empfehlung: Den Callback als `(buffer): [string, TypedArray] => …` annotieren, damit der typisierte Overload von `Object.fromEntries()` greift und `buffers` als `Record<string, TypedArray>` geprüft wird.

**TYPE-004 · low · packages/twopoint5d/src/vertex-objects/GeometryRoutes.ts:101** — Pool-Typ der benannten Routen im Typ der Route statt per Cast festhalten
`GeometryRoute.pool` ist ein `VOBufferPool`; die Sicht `attachedPools` castet ihn auf `VertexObjectPool<unknown>`. Dass jede benannte Route einen `VertexObjectPool` trägt, steht nur im Kommentar und in der Disziplin von `attachInstancedPool()`; `attach()` nimmt `GeometryRoute & {name; group}` und erzwingt es nicht.
Beleg: `(route) => route.pool as VertexObjectPool<unknown>`; `attach(route: GeometryRoute & {name: string; group: 'instanced'})`
Empfehlung: Den Typ von `attach()` und von `#attached` um `pool: VertexObjectPool<unknown>` verengen, dann entfällt der Cast. Der Import von `VertexObjectPool` ist als Typ schon da.

**API-009 · low · packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:43** (dazu `VertexObjectGeometry.ts:20`, `InstancedVOBufferGeometry.ts:157`) — Capacity-Parameter der Geometrie-Konstruktoren bei übergebenem Pool nicht stillschweigend ignorieren
`new VOBufferGeometry(pool, capacity)`, `new VertexObjectGeometry(pool, capacity)` und `InstancedVOBufferGeometry(pool, capacity, …)` verlangen eine Capacity, lesen sie aber nur, wenn eine Description oder ein Descriptor gebaut werden muss. Wer einen Pool mit 10 Slots und `capacity: 1000` übergibt, bekommt weder Fehler noch Warnung; die Geometrie hat 10 Slots. Die JSDoc der Konstruktoren sagt das nicht.
Beleg: `this.pool = source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity);`
Empfehlung: Entweder in der JSDoc ausdrücklich festhalten, dass `capacity` bei einem übergebenen Pool nicht gelesen wird, oder bei Abweichung von `pool.capacity` mit einer Fehlermeldung im Stil des Projekts ablehnen. (Entscheidung 2 im Plan: ablehnen.)

**ARCH-003 · low · packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:102** (dazu `InstancedVOBufferGeometry.ts:478`, `VOBufferGeometry.ts:139`, `InstancedVOBufferGeometry.ts:552`, `VOBufferGeometry.ts:194`, `InstancedVOBufferGeometry.ts:618`) — Doppelte Geometrie-Logik von VOBufferGeometry und InstancedVOBufferGeometry zusammenführen
Beide Klassen führen dieselben drei Bookkeeping-Objekte (Attachments, Slots, Routes) und wiederholen `declareOwnedPool()`, `touchAttributes()`, `touch()`, `update()` und das Aufräumen im Konstruktor-`catch` und in `dispose()` (Event-Reihenfolge, `finally`, `releaseRoute`, `setIndex(null)`, Pool-Dispose, Maps leeren). Die beiden Kopien driften bereits: der Pool entsteht in der einen im `try`, in der anderen davor, und nur eine kennt die Leihgabe vakanter Slots. Jede Korrektur am Teardown muss zweimal geschrieben werden.
Empfehlung: Die gemeinsamen Teile (Touch-Methoden, `declareOwnedPool`, Teardown-Skelett) in eine geteilte Hilfsklasse oder ein Delegate verlegen, das beide Geometrien halten; die Vererbung von `BufferGeometry` bzw. `InstancedBufferGeometry` verhindert eine gemeinsame Basisklasse.

**RES-004 · info · packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:563** — Sort-Scratch hält dauerhaft eine Kopie des größten Buffers
Der erste `sortBy()` legt einen `ArrayBuffer` in der Größe des größten Attribut-Buffers an (plus 16 Byte pro Slot für Schlüssel, Ordnung und Merge-Scratch und ein Array für VOs) und behält ihn bis `dispose()`. Ein Pool, der nur einmal sortiert wurde, trägt diesen Zusatz für sein ganzes Leben; bei großen Pools mit breiten Buffern ist das ein Vielfaches der Datenmenge eines einzelnen Buffers.
Beleg: `this.#sortScratch = new ArrayBuffer(bytes);` ohne Rückgabeweg außer `dispose()`
Empfehlung: Falls Speicher knapp wird: eine Methode zum Freigeben des Sort-Scratch anbieten oder den Scratch bei seltenen Sortierungen nach dem Lauf verwerfen. Sonst als dokumentierten Zielkonflikt (Allokationsfreiheit gegen Dauerspeicher) belassen.

**PERF-003 · info · packages/twopoint5d/src/vertex-objects/initializeAttributes.ts:46** (dazu `createIndicesArray.ts:14`) — Indexbuffer immer als Uint32Array, auch wenn Uint16 genügt
`createIndicesArray()` baut für jede Geometrie mit Indices ein `Uint32Array` über die volle Capacity. Bleibt `capacity × vertexCount` unter 65536, genügte ein `Uint16Array` bei halbem Speicher und halber Upload-Last. three wählt das Indexformat aus dem Array-Typ.
Empfehlung: Den Elementtyp nach `capacity × vertexCount` wählen (Uint16 bis 65535, sonst Uint32); die Rückgabetypen von `createIndicesArray()` und deren Tests entsprechend anpassen.

## Urteil des Reviewers (Runde 0, `paket-8.review-0.json`)

- TYPE-002 behoben — `VOBufferPool.ts:271-273`, Callback als `(buffer): [string, TypedArray] =>` annotiert; Beleg ist der Typecheck
- TYPE-004 behoben — `GeometryRoutes.ts:34-38` (`AttachedGeometryRoute`, `pool: VertexObjectPool<unknown>`), Cast in `attachedPools` entfällt, Typ-Löschung nur in `InstancedVOBufferGeometry.ts` `attachInstancedPool()`; Regressionstest `@ts-expect-error` in `GeometryRoutes.spec.ts`
- API-009 behoben — `checkPoolCapacity.ts:11-23`, erste Anweisung in `VOBufferGeometry.ts:42`, `VertexObjectGeometry.ts:25-27`, `InstancedVOBufferGeometry.ts:108-113`, `InstancedVertexObjectGeometry.ts:46-51`, `@throws` in allen vier TSDocs
- ARCH-003 behoben — `VOGeometryPools.ts` (intern), beide Geometrien delegieren `dispose()`, `touch()`, `touchBuffers()`, `update()`, Konstruktor-Cleanup (`abandon()`) und `detach()`; Pool entsteht in beiden Klassen im `try`
- RES-004 behoben — `VertexObjectPool.ts:546-562` `releaseSortScratch()`, TSDoc von `sortBy()`/`prepareSortKeys()` ergänzt
- PERF-003 behoben — `createIndicesArray.ts:3-5, 22` (`count * stride <= 0xffff` → `Uint16Array`), Tests in Unit-Specs und zwei Browser-Fällen in `vertex-objects-gpu-upload.test.js`
- Kritisch: keine · Wichtig: keine

### Kleine Befunde (offen, lösen keine Runde aus)

- `VertexObjectPool.ts:605`: ruft eine Key-Funktion von `sortBy()` (oder ein dadurch ausgelöster `onCreateVO`-Hook) selbst `releaseSortScratch()` auf, liest `#sortByOwnKeys()` `this.#sortKeys!` als `undefined` und endet in einem `TypeError` ohne Klassen- und Methodennamen; keine Datenverluste. Abhilfe: Guard wie beim Erzeugen/Freigeben von VOs aus der Key-Funktion, oder ein Satz in der TSDoc.
- `docs/sprites.md:2957`: der neue Halbsatz steht als 140-Zeichen-Zeile in einem sonst umbrochenen Listenpunkt.
- Vom Implementierer gemeldet: in `VertexObjectGeometry` und `InstancedVertexObjectGeometry` läuft die Capacity-Prüfung bei übergebenem Pool zweimal (Subklasse und `super()`), harmlos, Folge der Vorgabe »Prüfung vor allem anderen in jedem Konstruktor«.

### Nebenbefund

- `attachInstancedPool()` nimmt einen Pool mit abweichender Capacity an (TSDoc sagt es zu, schon in `2e3f585b:InstancedVOBufferGeometry.ts:239`). Vorbestehend, nicht Folge: Paket 8 hat das Verhalten nicht angefasst, nur die Konstruktoren schärfer gemacht. Urteil `→ Rückfrage`, weil Ablehnen eine dokumentierte Zusage umkehrt, die Entscheidung 2 (nur Konstruktoren) nicht deckt.

## Verlauf

- 2026-11-18 Zug 0: Detailplan steht · Modell stärkste Stufe, Effort medium · `vertex-objects/` seit `2e3f585b` unberührt · TYPE-002 unverändert (`VOBufferPool.ts:271-277`) · TYPE-004 unverändert (`GeometryRoutes.ts:88, 101, 129`), Empfehlung weicht ab: `VertexObjectPool<T>` invariant, per `tsc` belegt, eine Typ-Löschung an der Attach-Stelle (Schritt 2b) · API-009 unverändert (vier Konstruktoren) · ARCH-003 unverändert, Delegate `VOGeometryPools` · RES-004 unverändert, jetzt `VertexObjectPool.ts:569-570` · PERF-003 unverändert, three-Quellen zu `uint16`/Padding/Strip-Format geprüft · Folgen der Pakete 1–7: keine · »Offene Befunde«: keiner gleicher Ursache, keiner übernommen · Restplan unverändert
- 2026-11-18 Zug 1: Implementierer beauftragt (opus, Effort medium), Brief `paket-8.impl-0.brief.txt`, Report nach `paket-8.impl-0.json`
- 2026-11-18 Zug 2: Report FERTIG, 23 Dateien (neu `VOGeometryPools.ts`, `checkPoolCapacity.ts`; mitgezogen `hot-path-allocations.spec.ts`), rote Läufe für 2c, 3c, 4h, 5c, 6c belegt, Arbeitsbaum schmutzig
- 2026-11-18 Zug 2 Verify: `pnpm run ci` exit=0, Log `paket-8.verify.log`
- 2026-11-18 Zug 3: Reviewer beauftragt (opus, Effort medium), Diff `paket-8.diff`, Report nach `paket-8.review-0.json`
- 2026-11-18 Zug 3 Ergebnis: alle sechs Findings behoben, kritisch/wichtig keine, klein zwei (`VertexObjectPool.ts:605`, `docs/sprites.md:2957`) · Report `paket-8.review-0.json` · keine Fehlerkette
- 2026-11-18 Zug 5: Commit e97f246c (23 Dateien, Trailer `Remediation-Run: 2026-11-17`), Verify aus Zug 2 (`paket-8.verify.log`, exit=0) trägt, seither keine Änderung · Nebenbefund `attachInstancedPool()` nach »Offene Befunde«
