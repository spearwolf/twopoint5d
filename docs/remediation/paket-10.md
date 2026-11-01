# Paket 10 — Vertex Objects und Event-Namen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: RES-008 (low), BUG-027 (low), READ-006 (low), API-005 (low), CONS-014 (low)
- Ziel: Vertex-Object-Geometrien rollen gescheiterte Konstruktion zurück, lesen Buffer-Daten sicher und melden Use-after-free sprechend, und die Event-Namen tragen ein Emitter-Präfix.
- Modell: stärkste Stufe — die Accessoren in `createVertexObjectPrototype.ts` sind der heißeste Pfad der Library (Inlining, Allokationsbudget, Bench), und CONS-014 ändert öffentliche Event-Namen über `display/`, `stage/` und `controls/` hinweg.
- Effort: medium — jeder Schritt steht mit Namen, Werten und Testfällen unten; Regressionstests mit rotem Lauf und eine Bench-Messung vorher/nachher sind zu leisten, kein Transkript.
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`, `VertexObjectGeometry.ts` (+ `VertexObjectGeometry.spec.ts`)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`, TSDoc in `types.ts` (+ `VertexObjectPool.spec.ts`)
  - `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts` (+ `createVertexObjectPrototype.spec.ts`), TSDoc in `VertexObjectPool.ts`, `VOBufferPool.ts`, `constants.ts`, `src/vertex-objects/README.md`
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts` (nur TSDoc)
  - `packages/twopoint5d/src/events.ts` (+ neu `src/events.spec.ts`), Literale in `src/stage/Canvas2DStage.spec.ts`, `packages/twopoint5d-testing/test/pan-control-cursor.test.js`, `pan-control-input.test.js`, `pan-control-switch-off.test.js`
  - `packages/twopoint5d/docs/resource-lifecycle.md` (§1, §5), `packages/twopoint5d/docs/stages.md` (»Events«), `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci` (zwischendurch genügt `pnpm nx test twopoint5d -- src/vertex-objects` bzw. `-- src/events.spec.ts`; nie zwei Läufe parallel im selben Checkout, die Bench nie neben einem Gate)
- Commit: `fix(twopoint5d)!: leave nothing behind when a vertex object geometry fails to build, read buffers data by own names only, name a released vertex object in its error and let every event name carry its emitter`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · RES-008 unverändert (`VOBufferGeometry.ts:56-57`, `VertexObjectGeometry.ts:14`; `src/vertex-objects/` seit d9b648bf nur in `threeVertexLayout.spec.ts` berührt) · BUG-027 unverändert (`VertexObjectBuffer.ts:372`) · READ-006 unverändert (`createVertexObjectPrototype.ts:28/37`, `VertexObjectPool.ts:135-136`) · API-005 unverändert (`InstancedVOBufferGeometry.ts:364-389`, Feldkommentar `:96-107`) · CONS-014 unverändert (`events.ts:13-22/202-209/230-241`, seit d9b648bf unberührt) · keine offene Folge aus erledigten Paketen, kein Eintrag in »Offene Befunde« teilt eine Ursache — alle bleiben liegen
  - 2026-11-01 Zug 1: Implementierer beauftragt (`claude -p`, opus, effort medium), Brief `paket-10.impl-0.brief.txt`, Report nach `paket-10.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG · 24 Dateien geändert, neu `src/events.spec.ts` (mitgezogen über den Plan hinaus: `pan-control-dispose.test.js`, `docs/proposals/display-fullscreen.md`, `src/display/Display.ts` TSDoc) · Arbeitsbaum schmutzig · Bench ohne Verlust, Form mit Wächter bleibt · Verify `pnpm run ci` exit=0 (`paket-10.verify.log`)
  - 2026-11-01 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-10.diff`, Report nach `paket-10.review-0.json`
  - 2026-11-01 Zug 3: Urteil freigegeben, alle fünf Findings behoben, 2 × klein, 0 kritisch/wichtig · Diff `paket-10.diff`
  - 2026-11-01 Zug 4: keine Runde nötig
  - 2026-11-01 Zug 5: committet b3de20ef (25 Dateien), Verify `paket-10.verify.log` exit=0, Plan auf `[x]`, 2 Nebenbefunde in »Offene Befunde«

## Rahmen für den Implementierer

- `src/vertex-objects/**` ist in `packages/twopoint5d/vite.config.ts` auf statements 94, branches 90,
  functions 90, lines 95 gehalten. Jeder neue Zweig braucht einen Test, der ihn nimmt — die sechs
  Wächter der Accessoren aus Schritt 3 eingeschlossen.
- Meldungen nach AGENTS.md, »Error and warning messages«: Subjekt vorn, ohne Klammern.
- Konventionen des Plans: keine Finding-IDs, kein Satz über den Vorzustand (»no longer«, »now«,
  »instead of before«, »used to«) — in Code, Kommentaren, Guide, README, CHANGELOG, Migration
  Guide und Commit-Message.
- Für jede Verhaltensänderung zuerst der Regressionstest, rot sehen, dann beheben; der rote Lauf
  gehört in den Report (`pnpm nx test twopoint5d -- src/path/to/file.spec.ts`).
- CHANGELOG über den Skill `updating-changelog`, alle Einträge unter `## [Unreleased]`.
- Hot-Path-Regel aus AGENTS.md: `pnpm test:allocations` hält die Accessoren allokationsfrei; ein
  Accessor, den V8 nicht mehr inlined, boxt seinen Rückgabewert und fällt dort auf. Das Gate
  enthält die Allocation-Specs.

## Vorgehen

### 1. Ein gescheiterter Konstruktor von `VOBufferGeometry` und `VertexObjectGeometry` lässt nichts zurück (RES-008)

Heute: `VOBufferGeometry.ts:50-61` hängt den Pool per `this.#attachments.attach(this.pool)` ein
und ruft `initializeAttributes()` ohne Rückweg. Wirft das (ein `setAttribute()`, ein
`RangeError` beim Index-Array), bleibt ein selbst gebauter Pool undisposed und ein übergebener
zählt für immer als angehängt — `VertexObjectPool#resize()` verweigert ihn dann
(`VertexObjectPool.ts:152`). `VertexObjectGeometry.ts:14` baut seinen `VertexObjectPool` vor
`super()`, und `super()` kann nicht wissen, dass er dort gebaut wurde. Vorbild ist der
Instanced-Zweig: `InstancedVOBufferGeometry.ts:193-205` und `InstancedVertexObjectGeometry.ts:44-57`.

**Regressionstests zuerst**, in `src/vertex-objects/VertexObjectGeometry.spec.ts`, ein neuer
Block `describe('a constructor that throws', …)` am Ende des äußeren `describe`. Muster und
Helfer wie in `InstancedVertexObjectGeometry.spec.ts`: `createSandbox()` aus `sinon`,
`afterEach(() => sandbox.restore())`, und `disposedPoolsOf(dispose, descriptor)` (dort `:580-582`)
in diese Datei kopiert. Den Wurf löst
`sandbox.stub(BufferGeometry.prototype, 'setAttribute').throws(new Error('setAttribute'))` aus
(`BufferGeometry` aus `three/webgpu`); der `descriptor` der Datei hat Indices, `setIndex()` läuft
also vorher durch. Vier Tests:

1. `new VOBufferGeometry(descriptor, 10)` wirft `'setAttribute'`; danach ist genau ein Pool mit
   `pool.descriptor === descriptor` über `VOBufferPool.prototype.dispose` gelaufen und
   `isDisposed === true`.
2. `new VOBufferGeometry(handedIn, 10)` mit `handedIn = new VertexObjectPool<VO>(descriptor, 10)`
   wirft; danach `handedIn.isDisposed === false`, `handedIn.isAttachedToGeometry === false`, und
   `handedIn.resize(20)` wirft nicht und setzt `capacity` auf `20`.
3. `new VertexObjectGeometry(descriptor, 10)` wirft; genau ein Pool des `descriptor` ist
   disposed, und er ist ein `VertexObjectPool`.
4. `new VertexObjectGeometry(handedIn, 10)` mit einem übergebenen `VertexObjectPool` wirft;
   danach wie Test 2.

Vor dem Fix rot: 1 und 3 (kein `dispose`), 2 und 4 (`isAttachedToGeometry` bleibt `true`,
`resize(20)` wirft).

**Fix `VOBufferGeometry`** — Konstruktor nach `super()`:

```ts
super();
this.pool = source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity);
this.name = 'VOBufferGeometry';
if (!(source instanceof VOBufferPool)) {
  this.declareOwnedPool(this.pool);
}

try {
  this.#attachments.attach(this.pool);
  initializeAttributes(this, this.pool, this.#buffers, this.#bufferSerials, this.#slots);
  // (Kommentar zur Route unverändert)
  this.#routes.add({pool: this.pool, buffers: this.#buffers, bufferSerials: this.#bufferSerials});
} catch (error) {
  // a constructor that throws leaves nothing behind: a pool it built goes, and a pool handed
  // in is no longer counted as attached
  this.#attachments.detachAll();
  if (this.#attachments.owns(this.pool)) {
    this.pool.dispose();
  }
  throw error;
}
```

Der Kommentar »a pool handed in is no longer counted as attached« beschreibt den Ablauf im
`catch`, keinen Vorzustand des Codes — er steht so auch in `InstancedVOBufferGeometry.ts:194-195`.
Wirft `new VOBufferPool()` selbst, ist nichts gebaut und nichts zurückzurollen; das bleibt
außerhalb des `try`.

TSDoc des Konstruktors (`VOBufferGeometry.ts:37-40`): an den bestehenden `@throws` den Satz aus
`InstancedVOBufferGeometry.ts:121-122` anhängen: »Whatever the constructor throws, a pool it
built from a descriptor or description is disposed, and a pool handed in is left as it was —
alive, and not counted as attached.«

**Fix `VertexObjectGeometry`** — wie `InstancedVertexObjectGeometry.ts:40-57`:

```ts
constructor(source: VertexObjectPool<VOType> | VertexObjectDescriptor | VertexObjectDescription, capacity: number) {
  const buildsPool = !(source instanceof VertexObjectPool);
  const pool = buildsPool ? new VertexObjectPool<VOType>(source, capacity) : source;
  try {
    super(pool, capacity);
  } catch (error) {
    // super() only ever sees a pool and cannot tell that it was built here, so the pool built
    // above goes here
    if (buildsPool) pool.dispose();
    throw error;
  }
  this.name = 'VertexObjectGeometry';
  // (bestehender Kommentar)
  if (buildsPool) {
    this.declareOwnedPool(this.pool);
  }
}
```

Dazu ein TSDoc am Konstruktor, Wortlaut nach `InstancedVertexObjectGeometry.ts:22-29`: baut den
Pool aus einem Pool, Descriptor oder einer Description; `@throws what the constructor of
{@link VOBufferGeometry} throws. Whatever this constructor throws, a pool it built from a
descriptor or description is disposed, and a pool handed in is left as it was.`

**Doku** `packages/twopoint5d/docs/resource-lifecycle.md:54-57`: der Satz »The constructors of
`InstancedVOBufferGeometry` and `InstancedVertexObjectGeometry` and
`InstancedVOBufferGeometry#attachInstancedPool()` do the same …« nennt alle vier Geometrien:
»The constructors of `VOBufferGeometry`, `VertexObjectGeometry`, `InstancedVOBufferGeometry` and
`InstancedVertexObjectGeometry`, and `InstancedVOBufferGeometry#attachInstancedPool()`, do the
same for the pools they build from a descriptor or a description: one that throws disposes them
and leaves a pool handed in as it was — alive, and not counted as attached, so its `resize()`
takes it again.« Die Code-Auszüge in §1 (`:63-74`) bleiben wahr und bleiben stehen.

**CHANGELOG** `### Fixed`: »`VOBufferGeometry` and `VertexObjectGeometry` whose constructor
throws dispose a pool they built from a descriptor or a description and leave a pool handed in
alive and unattached, so `VertexObjectPool#resize()` takes it again«.

### 2. Buffers-Data werden nur über eigene Properties gelesen (BUG-027)

Heute: `VertexObjectBuffer.ts:372` liest `buffersData?.buffers[bufferName]` auf einem gewöhnlichen
Objekt. `bufferName` ist freier Text der Description; heißt ein Buffer `constructor`, `toString`
oder `__proto__` und fehlt er in `buffers`, findet der Lookup ein Mitglied von `Object.prototype`,
und `checkBufferArray()` wirft (`… takes a Float32Array, got function` bzw. `got object`), statt
ein frisches Array anzulegen. `createTypedArray.ts:34` schützt dieselbe Falle schon mit
`Object.hasOwn`. Die übrigen Lookups des Moduls laufen über `Object.entries()`/`Object.keys()`
(`VOBufferPool.ts:312/326`, `VertexObjectBuffer.ts:590`, `sameVertexObjectDescription.ts:47-53`)
und sind nicht betroffen — im Zug 0 nachgesehen.

**Regressionstest zuerst**, in `src/vertex-objects/VertexObjectPool.spec.ts`, neben dem Test
`use buffersData structure to directly create a pool …` (`:384`):
`test.each(['constructor', 'toString', '__proto__'])('builds a fresh array for a buffer named %s that the buffers data does not hold', …)`.
Descriptor: `new VertexObjectDescriptor({attributes: {a: {size: 1, bufferName}}})` (Typ
`float32` per Vorgabe). `new VertexObjectPool(descriptor, {capacity: 2, usedCount: 0, buffers: {}})`
wirft nicht, und `pool.buffer.buffers.get(bufferName)!.typedArray` ist ein `Float32Array` der
Länge 2. Ein zweiter Test nimmt den positiven Weg: ein Pool mit `bufferName: 'constructor'`,
`toBuffersData()`, ein zweiter Pool aus diesen Daten teilt sich das Array
(`toBe(source.buffer.buffers.get('constructor')!.typedArray)`). Vor dem Fix rot: der erste wirft
einen `TypeError` aus `checkBufferArray()`.

**Fix** `VertexObjectBuffer.ts:372`:

```ts
// a buffer name is free text of the description: in a plain object, `constructor` or `__proto__`
// would find a member of Object.prototype rather than nothing
const array =
  buffersData != null && Object.hasOwn(buffersData.buffers, bufferName) ? buffersData.buffers[bufferName] : undefined;
```

TSDoc `VertexObjectBuffersData#buffers` (`types.ts:347-350`) bekommt den Satz: »Read by own
property: a buffer this record does not hold as an own property gets a fresh array.«

**CHANGELOG** `### Fixed`: »a pool built from buffers data takes a buffer only from an own
property of `buffers`: a buffer named `constructor`, `toString` or `__proto__` that the data does
not hold gets a fresh array«.

### 3. Ein freigegebenes Vertex Object antwortet mit einem Fehler, der es benennt (READ-006)

Heute: jeder generierte Accessor in `createVertexObjectPrototype.ts:24-219` liest
`this[bufferKey]!.bufferList[bufferIndex]!`. Hat der Pool das Objekt losgelassen — `freeVO()`, ein
`usedCount` oder `resize()`, der seinen Slot zurücklässt, `dispose()`; alle Wege laufen über
`VOUtils.clearBuffer()` und setzen `voBuffer` auf `undefined` —, kommt ein roher `TypeError:
Cannot read properties of undefined (reading 'bufferList')` ohne Subjekt.

**Entscheidung (Zug 0):** ein expliziter Wächter je Accessor, der Fehler wird außerhalb gebaut.
`voBuffer` bleibt `undefined` für ein losgelassenes Objekt — das ist dokumentiert
(`constants.ts:1-5`, `getDescriptorOf.ts`, `VO`-Typ in `types.ts:255`) und öffentlich über
`VOUtils`. Ein Sentinel-Objekt statt `undefined` fiele deshalb aus, und es machte die Inline-Caches
der Accessoren, die alle Descriptoren teilen (`docs/architecture.md`, Abschnitt
`vertex-objects/`), nach dem ersten gefangenen Fehler polymorph. Ein Vergleich gegen `undefined`
vor dem ohnehin nötigen Map-Check kostet einen Branch; ob das messbar ist, entscheidet die Bench
unten, nicht die Annahme.

**Bench vorher** — vor jeder Änderung, im sauberen Baum, nicht neben einem Gate: in
`packages/twopoint5d` zweimal `pnpm vitest bench --run src/vertex-objects/hot-path.bench.ts`
(ohne JSON-Reporter, schreibt keine Datei). Notiert werden `hz` der Fälle
`six pools, one descriptor`, `component setters x, y, z`, `setPosition(x, y, z)`,
`getPosition(target)`.

**Regressionstests zuerst**, in `src/vertex-objects/createVertexObjectPrototype.spec.ts`, ein neuer
Block `describe('a vertex object its pool has let go of', …)`. Zwei Descriptoren decken alle sechs
Factories ab:

- `vertexCount: 1` mit `rotation: {size: 1}` (Property `rotation` — Getter/Setter aus
  `makeAttributeGetter`/`makeAttributeSetter`) und `instancePosition: {components: ['x', 'y', 'z']}`
  (Properties `x`, `y`, `z`; `setInstancePosition` — 3 Werte, `makeFixedAttributeValueSetter`;
  `getInstancePosition` — `makeAttributeValuesGetter`)
- `vertexCount: 5` mit `position: {components: ['x', 'y', 'z']}` (`setPosition` — 15 Werte,
  `makeWideAttributeValueSetter`) und `color: {size: 4}` (`setColor` — 20 Werte,
  `makeAttributeValueSetter` über `arguments`)

Tests:

1. Nach `pool.freeVO(vo)` wirft jeder Zugriff ein `Error` (nicht `TypeError`), dessen Meldung mit
   `VO#<name>` beginnt — `test.each` über: Lesen und Schreiben von `rotation` und `x`,
   `getInstancePosition()`, `setInstancePosition(1, 2, 3)`, `setPosition(1, 2, 3)`,
   `setColor(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20)`. Für `x` die
   ganze Meldung wörtlich (siehe unten), für die übrigen der Anfang
   `VO#<name> is not available: this vertex object has been released by its pool`; `<name>` ist
   bei Properties der Name (`VO#x`), bei Methoden der Name mit `()` (`VO#setPosition()`).
2. Dieselbe Meldung für `x` über jeden der vier Wege, `test.each`: `freeVO()`, `usedCount = 0`
   über einen Slot hinweg, `resize(0)` (Pool ohne Geometrie), `dispose()`.
3. Ein lebendes Objekt desselben Pools liest und schreibt nach dem Loslassen eines anderen weiter
   (Schutz gegen einen Wächter am falschen Objekt).

Vor dem Fix rot: die Meldung lautet `Cannot read properties of undefined (reading 'bufferList')`
bzw. `… (reading 'bufferList')` beim Schreiben, und der Typ ist `TypeError`.

**Fix** in `createVertexObjectPrototype.ts`:

- Modul-lokal, außerhalb der Factories:

  ```ts
  // built out of line: the accessors carry one compare, and the call that builds the error never
  // runs on the hot path
  function releasedError(accessor: string): Error {
    return new Error(
      `VO#${accessor} is not available: this vertex object has been released by its pool — by freeVO(), by a usedCount or a resize() that left its slot behind, or by dispose()`,
    );
  }
  ```

- Jede der sechs Factories bekommt den Namen des Accessors als Parameter, wie
  `makeAttributeValuesGetter` ihn schon trägt (`getterName`): `makeAttributeGetter` und
  `makeAttributeSetter` den Property-Namen (`property.name`, ergibt `VO#x`), die Setter-Factories
  und der Values-Getter `${property.name}()` (ergibt `VO#setPosition()`). Der Name wird in der
  Factory gebunden, nicht im Accessor zusammengesetzt — keine Allokation pro Aufruf.
- Jeder Accessor liest den Buffer einmal und prüft ihn:

  ```ts
  return function getAttribute(this: VO) {
    const buffer = this[bufferKey];
    if (buffer === undefined) throw releasedError(subject);
    const idx = this[indexKey] * instanceOffset + attrOffset;
    return buffer.bufferList[bufferIndex]!.typedArray![idx];
  };
  ```

  Entsprechend in den übrigen fünf; im Values-Getter steht der Wächter vor der Prüfung der
  `target`-Länge. Die übrigen `!` (Record und `typedArray` eines lebenden Objekts) bleiben.
- Der Kommentarblock `:20-23` beschreibt, was jetzt gilt, ohne Rückblick, etwa: »every accessor
  below checks one thing and takes the rest for granted. A vertex object its pool has let go of
  has no buffer, and the accessor answers it with an error that names the accessor — one compare
  per call, the error built out of line. A vertex object alive in its pool has its buffer, that
  buffer holds its typed array and lists the record of every buffer of its descriptor at the
  position the accessor was built with: these accessors run per sprite and per frame, so they
  assert that (`!`) rather than check it.« Die Kommentare »the vertex object is alive in its
  pool: see above the factories« in den Accessoren werden dazu passend gekürzt oder entfallen.

**Bench nachher** — dieselben zwei Läufe, dieselben vier Fälle. Regel: verliert ein Fall in
beiden Läufen mehr als 10 % `hz` gegen den besseren Vorher-Lauf, wechseln alle sechs Accessoren
auf die Form ohne Vergleich auf dem Erfolgspfad und werden erneut gemessen:

```ts
return function getAttribute(this: VO) {
  try {
    const idx = this[indexKey] * instanceOffset + attrOffset;
    return this[bufferKey]!.bufferList[bufferIndex]!.typedArray![idx];
  } catch (error) {
    throw this[bufferKey] === undefined ? releasedError(subject) : error;
  }
};
```

Es bleibt die Form mit dem kleineren Verlust. Alle Zahlen (vorher, nachher, ggf. die zweite Form)
gehören in den Report, Abschnitt »Verify«. `pnpm test:allocations` muss in jedem Fall grün sein —
er ist Teil des Gates.

**TSDoc und README**, die das Versprechen »fails« jetzt einlösen und den Fehler nennen:

- `VertexObjectPool.ts:135-136` (`resize()`): »… any further read or write on such a vertex
  object throws an `Error` that names the accessor.«
- `VOBufferPool.ts:132-134` (`usedCount`-Setter) und `:210-211` (`dispose()`) ebenso.
- `constants.ts:1-5` (`voBuffer`): ein Satz, dass jeder generierte Accessor ein Objekt ohne Buffer
  mit `VO#<accessor> is not available: …` beantwortet.
- `src/vertex-objects/README.md`, Abschnitt »The accessors a description generates« (`:66-90`),
  ein Absatz am Ende: ein Vertex Object, das sein Pool losgelassen hat — `freeVO()`, ein
  `usedCount` oder `resize()`, der seinen Slot zurücklässt, `dispose()` —, liest und schreibt
  nichts mehr; jeder Accessor wirft ein `Error`, das ihn nennt, z. B. `VO#x is not available:
  this vertex object has been released by its pool …`.

**CHANGELOG** `### Fixed`: »every generated accessor of a vertex object its pool has let go of —
through `freeVO()`, a `usedCount` or `resize()` that leaves its slot behind, or `dispose()` —
throws an `Error` that names the accessor: `VO#x is not available: this vertex object has been
released by its pool …`«. Kein Satz über den rohen `TypeError`.

### 4. Der GPU-Speicher abgelöster Routen steht in der TSDoc (API-005)

Reine Dokumentation, kein Code, kein Test, kein CHANGELOG-Eintrag (keine Verhaltensänderung).
Sachstand im Zug 0 nachgesehen: `giveUpArray()` (`InstancedVOBufferGeometry.ts:18-23`) lässt beim
Ablösen nur das CPU-Array des Attributs los; das Attribut bleibt in `#vacatedSlots` bis
`dispose()` (`:96-107`, `:469-483`), und three gibt den GPU-Buffer erst im Dispose-Event der
Geometrie frei. Ein Slot, den eine Route einmal hatte, bleibt gesperrt (`everHeld()`, `:312`).

- TSDoc `detachInstancedPool()` (`:364-389`), ein Absatz vor `@returns`: »The gpu memory of the
  attributes this route built stays in use until this geometry is disposed: three.js frees the
  gpu buffer of an attribute only through the dispose event of the geometry, and the slot keeps
  the attribute, with an empty array, until then. A long-lived geometry that attaches and detaches
  pools under new attribute names again and again holds the gpu buffers of every one of them until
  `dispose()` — for changes like that, build a new geometry.«
- TSDoc `attachInstancedPool()` (`:218-268`), im Absatz über die Slots (`:232-236`) ein Satz:
  »A route detached later keeps its gpu memory until the geometry is disposed — see
  {@link detachInstancedPool}.«
- `packages/twopoint5d/docs/resource-lifecycle.md` §5, ein Absatz nach »A shared material holds on
  to every mesh drawn with it.« (`:397-406`): »**A detached route holds its gpu buffers until its
  geometry goes.** `InstancedVOBufferGeometry#detachInstancedPool()` lets go of the typed arrays of
  the route, but three frees a gpu buffer only through the dispose event of the geometry, one
  attribute per name: the slot keeps the attribute, with an empty array, and its gpu buffer stays
  until `dispose()`. A long-lived geometry that changes its pools under new attribute names grows
  by one gpu buffer per name — build a new geometry for changes like that.«

### 5. Jeder Event-Name trägt seinen Emitter (CONS-014)

Entscheidung vom 2026-10-31 (Plan, »Entscheidungen«): generische Namen bekommen ein
Emitter-Präfix, absichtlich geteilte (`dispose` der Stages) bleiben und sind dokumentiert,
Breaking Change mit CHANGELOG und Migrationshinweis.

**Regel (Zug 0):** der Wert jeder Konstante ist ihr Name ohne `On`, der erste Buchstabe klein —
die Form, die `OnStageResize = 'stageResize'` und `OnStageTransitionStart =
'stageTransitionStart'` schon haben. Einzige Ausnahme: `OnStageDispose` und
`OnCanvas2DStageDispose` teilen `'dispose'`. Eine Regel für die ganze Datei statt einer Auswahl
»generischer« Namen, weil ein Spec sie über jeden Export halten kann und ein künftiger Name ohne
Emitter dann rot wird; `hideCursor`/`restoreCursor` kollidieren heute mit nichts, fallen aber
unter dieselbe Regel und denselben Release. `OnAddToParent`/`OnRemoveFromParent` erfüllen die
Regel schon (`'addToParent'`, `'removeFromParent'`) und bleiben; ihre Konstanten-Namen werden
nicht umbenannt — die Namen der Konstanten bleiben alle, es ändern sich nur Werte.

Neue Werte in `packages/twopoint5d/src/events.ts`:

| Konstante | Wert |
| --- | --- |
| `OnDisplayResize` | `'displayResize'` |
| `OnDisplayRenderFrame` | `'displayRenderFrame'` |
| `OnDisplayInit` | `'displayInit'` |
| `OnDisplayStart` | `'displayStart'` |
| `OnDisplayRestart` | `'displayRestart'` |
| `OnDisplayPause` | `'displayPause'` |
| `OnDisplayDispose` | `'displayDispose'` |
| `OnDisplayError` | `'displayError'` |
| `OnDisplayFullscreenChange` | `'displayFullscreenChange'` |
| `OnCanvas2DStageResize` | `'canvas2DStageResize'` |
| `OnCanvas2DStageRender` | `'canvas2DStageRender'` |
| `OnPanControl2DUpdate` | `'panControl2DUpdate'` |
| `OnPanControl2DHideCursor` | `'panControl2DHideCursor'` |
| `OnPanControl2DRestoreCursor` | `'panControl2DRestoreCursor'` |

Unverändert: `OnStageAdded`, `OnStageRemoved`, `OnStageResize`, `OnStageUpdateFrame`,
`OnStageFirstFrame`, `OnStageAfterCameraChanged`, `OnStageAfterSceneChanged`, `OnStageDispose`
(`'dispose'`), `OnAddToParent`, `OnRemoveFromParent`, `OnStageTransitionStart`,
`OnStageTransitionEnd`, `OnCanvas2DStageDispose` (`'dispose'`).

`OnDisplayDispose` wird umbenannt: `Display` ist keine Stage, kein `StageRenderer` hört auf ein
Dispose seines Hosts (`IStageRendererHost` fragt `isDisposed`, `StageRenderer.ts:334`), im Zug 0
nachgesehen.

**Regressionstest zuerst**, neu `packages/twopoint5d/src/events.spec.ts`:

```ts
import {describe, expect, test} from 'vitest';
import * as events from './events.js';

// the end of every stage of the library goes out under one name
const SHARED_DISPOSE = ['OnCanvas2DStageDispose', 'OnStageDispose'];

const constants = Object.entries(events).filter(
  (entry): entry is [string, string] => entry[0].startsWith('On') && typeof entry[1] === 'string',
);

describe('event names', () => {
  test('each is the name of its constant without On, which names the emitter', () => {
    for (const [name, value] of constants) {
      if (SHARED_DISPOSE.includes(name)) continue;
      expect(value, name).toBe(name[2]!.toLowerCase() + name.slice(3));
    }
  });

  test('two constants share a name only where the stages announce their end', () => {
    const byValue = new Map<string, string[]>();
    for (const [name, value] of constants) byValue.set(value, [...(byValue.get(value) ?? []), name]);
    for (const [value, names] of byValue) {
      if (value === 'dispose') expect([...names].sort(), value).toEqual(SHARED_DISPOSE);
      else expect(names, value).toHaveLength(1);
    }
  });
});
```

Vor dem Fix rot: der erste
an `OnDisplayResize` (`'resize'`), der zweite an `'resize'` (`OnCanvas2DStageResize`,
`OnDisplayResize`) und an `'dispose'` (drei statt zwei).

**Fix:** die Werte nach der Tabelle. Dazu ein Kommentar am Kopf von `events.ts` (nach den
Imports), Inhalt: der Wert jeder Konstante ist ihr Name ohne `On`, der erste Buchstabe klein; er
nennt den Emitter, sodass zwei Emitter nie aus Versehen einen Namen teilen und ein
Listener-Objekt mit Methoden unter diesen Schlüsseln nur den Emitter hört, an dem es hängt; die
eine Ausnahme ist `'dispose'`, unter dem jede Stage der Library — `Stage2D`, `StageRenderer`,
`StageMaskWorldStage`, `Canvas2DStage` — ihr Ende meldet. Am TSDoc von `OnStageDispose`
(`:143-148`) und `OnCanvas2DStageDispose` (`:208`) je ein Satz, dass der Name mit der anderen
Konstante geteilt ist und warum.

**Was die Umbenennung mitzieht** (die Library selbst nutzt überall die Konstanten oder
berechnete Schlüssel — `[OnDisplayResize]: …` —, im Zug 0 gegreppt):

- `src/stage/Canvas2DStage.spec.ts:122-129` erwartet die Literale `'resize'` und `'render'` im
  Log → `OnCanvas2DStageResize`/`OnCanvas2DStageRender`.
- `packages/twopoint5d-testing/test/pan-control-cursor.test.js:82`,
  `pan-control-input.test.js:281`, `pan-control-switch-off.test.js:47` abonnieren
  `'restoreCursor'` → `OnPanControl2DRestoreCursor`, importiert aus `@spearwolf/twopoint5d`
  (die Dateien importieren `PanControl2D` von dort schon). Die Texte der `expect`-Meldungen
  (»restoreCursor events …«) dürfen bleiben.
- Nicht anfassen: `StageRenderer.spec.ts:1662-1668` (`'resize'` ist das Event eines Mock-Hosts,
  kein Library-Event), `Display.ts:1463/1506` und `Display.spec.ts:1666/1788-1794` (das DOM-Event
  `resize` des Fensters), `DisplayStateMachine.ts:12-15` (interner Emitter, nicht exportiert).
- Abschluss-Grep, der leer bleiben muss, außer den drei Ausnahmen oben:
  `grep -rn -E "['\"](resize|renderFrame|init|start|restart|pause|error|fullscreenChange|render|update|hideCursor|restoreCursor)['\"]" packages/twopoint5d/src packages/twopoint5d/docs packages/twopoint5d/README.md packages/twopoint5d-testing/test apps/lookbook/src`
  — jeder Treffer, der ein Library-Event meint, geht auf die Konstante.

**Guide** `packages/twopoint5d/docs/stages.md`, Abschnitt »Events« (`:1945ff.`), nach dem Satz
»All event names are exported …«: »Each name carries its emitter — `OnCanvas2DStageResize` is
`'canvas2DStageResize'` —, so a listener object whose methods are keyed by the constants hears
only the emitter it subscribes to. `OnStageDispose` and `OnCanvas2DStageDispose` share
`'dispose'`: every stage of the library announces its end under that one name.«
`docs/display.md` zählt keine Event-Werte auf und bleibt.

**CHANGELOG** `### Changed`, mit **BREAKING** und Verweis auf den Migration Guide, etwa: »change
the values of the event constants of `Display`, `Canvas2DStage` and `PanControl2D`: each is the
name of its constant without `On` — `OnDisplayResize` is `'displayResize'`, `OnDisplayRenderFrame`
`'displayRenderFrame'`, …« mit allen Zeilen der Tabelle außer `OnDisplayFullscreenChange` (unter
`[Unreleased]` neu, nie veröffentlicht; sein `Added`-Eintrag bleibt, wie er ist) und dem Satz,
dass `OnStageDispose` und `OnCanvas2DStageDispose` `'dispose'` behalten. Ein Listener über die
Konstanten, berechnete Schlüssel oder `display.onResize()` und die übrigen `on…()`-Methoden ändert
nichts; einer über einen String oder ein Listener-Objekt mit Methoden unter den alten Namen
schon (**BREAKING**). See the Migration Guide.

**Migration Guide**, neuer Abschnitt `#### Event names carry their emitter` unter `### Migration
Guide`, vor `#### The \`three\` peer dependency range`:

```ts
// Before
on(display, 'resize', ({width, height}) => {});
on(stage, {render(stage) {}});

// After
on(display, OnDisplayResize, ({width, height}) => {});
on(stage, {[OnCanvas2DStageRender](stage) {}});
```

Als **Before**/**After** in zwei Blöcken wie die übrigen Abschnitte dort, Blöcke als `ts` (Auszug,
ohne `check`).

### 6. Abschluss

- `pnpm format`, dann `pnpm run ci`; Exit-Code und Bench-Zahlen in den Report.
- Abweichungen von diesem Plan mit Grund in den Report.

## Findings im Volltext

**RES-008 · low · packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:51** (dazu `VertexObjectGeometry.ts:14`) — Konstruktor von VOBufferGeometry und VertexObjectGeometry bei Fehlschlag zurückrollen
Die Instanced-Geschwister (InstancedVOBufferGeometry, InstancedVertexObjectGeometry) fangen einen Fehler im Konstruktor ab, disposen selbst gebaute Pools und geben übergebene Pools frei (detachAll). VOBufferGeometry baut den Pool aus Descriptor/Description, hängt ihn per attach() ein und ruft initializeAttributes() ohne try/catch auf; VertexObjectGeometry baut den VertexObjectPool sogar vor super(). Wirft initializeAttributes() (z. B. RangeError beim Allozieren des Index-Arrays bei sehr großer Kapazität), bleibt ein selbst gebauter Pool undisposed, und ein übergebener Pool zählt dauerhaft als an eine Geometrie gebunden, sodass VertexObjectPool#resize() ihn für immer verweigert. Der Fall ist selten, die Zusage aus resource-lifecycle.md §1 gilt aber nur für die Instanced-Varianten, die Familie ist uneinheitlich.
Beleg: `this.#attachments.attach(this.pool); initializeAttributes(this, this.pool, this.#buffers, this.#bufferSerials, this.#slots);` ohne Rollback; vgl. InstancedVOBufferGeometry.ts:193-205
Empfehlung: Dasselbe Muster wie im Instanced-Konstruktor: try/catch um attach+initializeAttributes, im Catch detachAll(), selbst gebauten Pool disposen, Fehler weiterwerfen; in VertexObjectGeometry den selbst gebauten Pool bei einem Wurf aus super() disposen. Einen Test nach dem Muster der Instanced-Konstruktoren ergänzen.

**BUG-027 · low · packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:372** — Buffers-Data per Own-Property-Lookup statt Objektindex lesen
#takeOrCreateArray liest `buffersData?.buffers[bufferName]` auf einem normalen Objekt. Heißt ein Buffer über `bufferName` etwa `constructor`, `toString` oder `valueOf` und fehlt er in den übergebenen Buffers-Data, findet der Lookup die geerbte Funktion von Object.prototype statt `undefined`; checkBufferArray wirft dann ein TypeError („takes a Float32Array, got function“) statt ein frisches Array anzulegen. Das Projekt schützt dieselbe Falle an anderer Stelle bereits (typedArrayOf nutzt Object.hasOwn), `bufferName` ist aber freier Benutzertext.
Beleg: `const array = buffersData?.buffers[bufferName]; if (array == null) { return createTypedArray(...)`
Empfehlung: Nur eigene Properties akzeptieren: `Object.hasOwn(buffersData.buffers, bufferName) ? buffersData.buffers[bufferName] : undefined`; Spec mit `bufferName: 'constructor'` ergänzen.

**READ-006 · low · packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:28** (dazu `:37`, `VertexObjectPool.ts:136`) — Use-after-free eines Vertex Objects mit sprechendem Fehler beantworten
Die TSDoc von freeVO/resize/dispose verspricht, dass jeder Zugriff auf ein losgelassenes Vertex Object „laut fehlschlägt“. Tatsächlich kommt aus den generierten Accessoren ein rohes `TypeError: Cannot read properties of undefined (reading 'bufferList')` ohne Subjekt und ohne Hinweis auf Pool oder Zustand; die Schreibweise widerspricht der Fehlermeldungs-Regel aus AGENTS.md. Die Entscheidung gegen einen Check pro Zugriff ist dokumentiert (Hot Path, Allokationsbudget); eine Hilfe für den Entwickler fehlt dennoch.
Beleg: `const buf = this[bufferKey]!.bufferList[bufferIndex]!;`
Empfehlung: Die Accessoren unverändert lassen, aber den Fall im Dev-Pfad abfangen: etwa `this[bufferKey]` über einen billigen Guard (`=== undefined`, ein Branch) in einen Fehler `Vertex object: this vertex object has been released by its pool` verwandeln, per Bench gegen die Hot-Path-Kosten prüfen; sonst den Hinweis in die README/TSDoc aufnehmen.

**API-005 · low · packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:364** (dazu `:97`) — detachInstancedPool-TSDoc um den GPU-Speicher abgelösten Routen ergänzen
Beim Ablösen einer Route gibt giveUpArray() nur das CPU-Array des Attributs frei; den GPU-Buffer kann three erst im Dispose-Event der Geometrie freigeben, und der Slot bleibt für die Lebenszeit der Geometrie gesperrt. Ein Feldkommentar (Z. 97–107) sagt das, die öffentliche TSDoc von detachInstancedPool() und attachInstancedPool() nicht. Wer in einer langlebigen Geometrie zur Laufzeit Pools mit jeweils neuen Attributnamen an- und abhängt, hält die GPU-Buffer aller abgelösten Routen bis zum Dispose.
Beleg: `this.#vacatedSlots.set(attrName, vacated);` — „it lives until dispose()“
Empfehlung: In die TSDoc von detachInstancedPool() einen Satz aufnehmen: GPU-Speicher abgelöster Routen wird erst mit dem Dispose der Geometrie frei; für häufigen Wechsel besser eine neue Geometrie bauen.

**CONS-014 · low · packages/twopoint5d/src/events.ts:13** (dazu `:149`, `:202`, `:230`) — Event-Namen in events.ts einheitlich mit Emitter-Präfix vergeben
Ein Teil der Event-Namen trägt den Emitter im String (`stageResize`, `stageUpdateFrame`, `stageTransitionStart`), ein anderer nur generische Wörter: `resize` ist OnDisplayResize und OnCanvas2DStageResize, `dispose` ist OnDisplayDispose, OnStageDispose und OnCanvas2DStageDispose, dazu `update`, `render`, `start`, `error`, `init`. Zwei Konstanten mit gleichem Wert unterscheiden sich nur im Typ; ein Objekt, das beide Emitter-Rollen trägt oder über eventize an beide Schnittstellen gehängt wird, kann Listener des falschen Ereignisses auslösen. Für OnStageDispose/OnCanvas2DStageDispose ist die Gleichheit gewollt (kommentiert), für die übrigen nicht erkennbar.
Beleg: `export const OnDisplayResize = 'resize';` / `export const OnCanvas2DStageResize = 'resize';` / `export const OnPanControl2DUpdate = 'update';`
Empfehlung: Die absichtlich geteilten Namen (dispose bei Stages) dokumentiert lassen, die übrigen generischen Strings bei der nächsten Gelegenheit mit Präfix versehen oder im Kommentar festhalten, welche Emitter nie auf einem Objekt zusammentreffen; Breaking Change im CHANGELOG vermerken.

## Abgleich und Triage (Zug 0, 2026-11-01)

- **RES-008** unverändert: `VOBufferGeometry.ts:56-57` (attach + `initializeAttributes()` ohne
  `try`), `VertexObjectGeometry.ts:14` (Pool vor `super()`). Abweichung von der Empfehlung: keine.
- **BUG-027** unverändert: `VertexObjectBuffer.ts:372`. Abweichung: der Test nimmt neben
  `constructor` auch `toString` und `__proto__` (letzteres findet ein Objekt, kein Function).
- **READ-006** unverändert: `createVertexObjectPrototype.ts:28/37/55/116/164/203`. Abweichung:
  die Meldung beginnt mit `VO#<accessor>` statt `Vertex object:` — AGENTS.md verlangt ein
  Subjekt in Form der Klasse oder des Aufrufs, und `VO` ist nach `docs/architecture.md` (Regel 1
  von `vertex-objects/`) der Typname des Vertex Objects; das Muster »… is not available: …« folgt
  `VertexObjectBuffer.ts:105-107` und `VOBufferPool.ts:10-12`. Kein »Dev-Pfad«: die Library kennt
  keinen Build-Schalter dafür, der Wächter läuft immer und wird gemessen.
- **API-005** unverändert: `InstancedVOBufferGeometry.ts:364-389`, Feldkommentar `:96-107`.
  Zusätzlich zur Empfehlung ein Absatz in `resource-lifecycle.md` §5, weil die Lebenszyklus-Doku
  verbindlich ist und dort schon das Gegenstück (»A shared material holds on to every mesh«) steht.
- **CONS-014** unverändert: `events.ts:13-22`, `:149`, `:202-209`, `:230-241`. Abweichung: die
  Regel deckt die ganze Datei (auch `hideCursor`, `restoreCursor`, `renderFrame`,
  `fullscreenChange`), Begründung in Schritt 5. Die Library selbst und das Lookbook nutzen
  ausschließlich Konstanten oder berechnete Schlüssel (`quadtree-playground.astro:38`,
  `Display.spec.ts:175`, `Canvas2DStage.spec.ts:113-117`); Literale nur in den in Schritt 5
  genannten Specs und Browser-Tests.
- **Folgen erledigter Pakete:** keine offen — die `Folgen:`-Zeilen von Paket 1, 4 und 5 sind
  verteilt, alle übrigen sagen »keine«.
- **Offene Befunde:** keiner teilt eine Ursache mit diesem Paket (Lockfile-Advisories,
  `DisplayFullscreen` aus Paket 5, `stage-pipeline.test.js` aus Paket 7, `TextureCoords.spec.ts`
  aus Paket 8, `SpritePicker`, `describeValue()` und `writeText()` aus Paket 9); alle bleiben in
  der Queue.
- **Neue Nebenbefunde:** keine. Im Zug 0 mitgeprüft und unauffällig: die übrigen Objekt-Lookups
  in `vertex-objects/` (`Object.entries`/`Object.keys`), `InstancedVertexObjectGeometry` bei
  einem Wurf aus `asPool()` für die Basis (gefangen), `FrameLoop`/`FixedFrameLoop` (Events als
  `Symbol.for(…)`, kollisionsfrei).

## Urteil des Reviewers (Zug 3, 2026-11-01)

- **RES-008** behoben: `VOBufferGeometry.ts:59-74` (try/catch um attach + `initializeAttributes` + Route, `detachAll()`, dispose nur eigener Pool), `VertexObjectGeometry.ts:20-37`; TSDoc an beiden Konstruktoren; `resource-lifecycle.md:54-59`; Tests `VertexObjectGeometry.spec.ts:177-237`.
- **BUG-027** behoben: `VertexObjectBuffer.ts:375` (`Object.hasOwn`), TSDoc `types.ts:349-350`, Tests `VertexObjectPool.spec.ts:400-420`.
- **READ-006** behoben: `releasedError()` `createVertexObjectPrototype.ts:30`, Wächter `:39/48/67/130/180/221`; TSDoc `VertexObjectPool.ts:136`, `VOBufferPool.ts:134/212`, `constants.ts:5-6`, README; Tests `createVertexObjectPrototype.spec.ts:609-748`. Bench hz vorher/nachher: six pools 5417/5394 → 5517/5485; setters x,y,z 30966/31207 → 31782/31423; setPosition 28035/30838 → 31078/30930; getPosition 21261/22293 → 22515/22600 — Wächter-Form bleibt.
- **API-005** behoben: `InstancedVOBufferGeometry.ts:236-237` und `:389-394`, `resource-lifecycle.md:411-416`.
- **CONS-014** behoben: `events.ts:11-15` (Kopfkommentar), Werte `:17-27`, `:208-223`, `:244-255`, geteiltes `'dispose'` an `:155-156`/`:220-221`; `src/events.spec.ts`; mitgezogen `Canvas2DStage.spec.ts`, `pan-control-{cursor,input,switch-off,dispose}.test.js`, `Display.ts:2205`, `docs/proposals/display-fullscreen.md:214`, `stages.md:1949-1952`; CHANGELOG `Changed` **BREAKING** + Migration Guide »Event names carry their emitter«.

Abweichungen des Implementierers: `Object.entries(events as Record<string, unknown>)` in `events.spec.ts` (TS2677 mit dem Wortlaut des Plans); Bench mit `--reporter=verbose`; `biome check --write` nur auf eigenen Dateien statt `pnpm format`; Abschluss-Grep zog `'update'` in `pan-control-input.test.js`/`pan-control-dispose.test.js` mit.

### Kleine Befunde

- `src/controls/PanControl2D.ts:687`, `:831`, `:834`, `:846` und Testnamen `PanControl2D.spec.ts:585/606` nennen das Event mit dem alten Kurznamen (»a restoreCursor listener«, »a hideCursor went out«); kein Bruch, aber ein Grep nach dem Wert landet daneben.
- `src/vertex-objects/VertexObjectGeometry.ts:26-27` und `:33` — zweimal fast derselbe Kommentar (»super() only ever sees a pool …«).

### Nebenbefunde (→ »Offene Befunde« im Plan)

- TSDoc `OnStageDispose` (`events.ts:150`) und `stages.md:1959` nennen `StageMaskWorldStage` nicht als Sender — vorbestehend (d9b648bf `events.ts:144`), low, → Scope: Doku-Lücke, Scope-Regel nimmt alles.
- `stages.md` Tabelle »Events« ohne `OnStageTransitionStart`/`End` — vorbestehend, info, → Scope aus demselben Grund.
