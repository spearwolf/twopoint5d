# Paket 12 — InstancedVOBufferGeometry: Pool-Anbindung und Lebenszyklus

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: MEM-005 (low), MEM-006 (low), MEM-010 (low), MEM-011 (low), BUG-028 (low), READ-007 (low), READ-008 (low)
- Dazu (Zug 0): Nebenbefund gleicher Ursache wie MEM-006 — die Konstruktoren von
  `InstancedVOBufferGeometry` und `InstancedVertexObjectGeometry` lassen einen Pool, den sie aus
  einem Descriptor gebaut haben, undisposed liegen, wenn sie danach werfen (Einzelheiten unter
  »Entscheidungen in Zug 0« und in Schritt 4). Vorbestehend, `src/vertex-objects/` seit 7341059f
  bis auf `VertexAttributeDescriptor.ts` (`private` → `#`, Paket 9) unverändert.
- Ziel: `attachInstancedPool()` ist transaktional und leakfrei, `dispose()` idempotent, und die Draw Range einer kopierten Basisgeometrie bleibt stehen.
- Modell: stärkste Stufe — sieben Findings und ein Nebenbefund in einem Modul, aber im
  Lebenszyklus der Geometrie: Rollback der Slot-Buchhaltung, Reihenfolge von Dispose-Event und
  Abbau hinter einem werfenden Listener, was three beim Freigeben eines GPU-Buffers noch liest,
  dazu ein Spec gegen three-Interna. Ein Fehler hier leckt GPU-Speicher, ohne dass ein Test der
  Library ihn sieht.
- Effort: medium — jeder Schritt unten nennt Stelle, Reihenfolge, Wortlaut und Testfall; zu
  entwerfen ist nichts. Mehr Effort lädt zu Umbauten ein, die nicht hier stehen.
- Hängt ab von: —
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.ts` (nur der Konstruktor)
  - `packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts` (neue Methode `withdrawRoute()`)
  - `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts`, `VertexObjectPool.ts` (nur Kommentare)
  - `packages/twopoint5d/src/vertex-objects/VertexAttributeDescriptor.ts`, `VertexObjectDescriptor.ts`,
    `VertexObjectBuffer.ts`, `alignedAttributeSize.ts`, `asInstancedCopySource.ts`,
    `asThreeTypedArray.ts`, `initializeAttributes.ts` (nur Kommentare)
  - neu `packages/twopoint5d/src/vertex-objects/threeVertexLayout.spec.ts`
  - neu `packages/twopoint5d/src/testing/threeWebGPUAttributeUtils.d.ts`
  - Specs: `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`,
    `vertex-buffers-geometry-updates.spec.ts`
  - `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js` (eine Assertion mehr)
  - `packages/twopoint5d/docs/resource-lifecycle.md` (§1, §5)
  - `packages/twopoint5d/docs/architecture.md` (§2 `vertex-objects/`, ein neuer Absatz)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]` → `### Fixed`)
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): let a second dispose() of a vertex object geometry do nothing and its teardown finish behind a dispose listener that throws, release the pools a geometry built when attachInstancedPool() or the constructor refuses, leave the route under the name and the slots as they were when the attributes of a pool cannot be built, let the attributes a detached route leaves behind give up the arrays of their pool, keep the draw range a geometry copied from a BufferGeometry, and hold the vertex layout rules the comments cite to the three in the catalog`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · MEM-005 unverändert (`InstancedVOBufferGeometry.ts:411–412`, `VOBufferGeometry.ts:86–87`) · MEM-006 unverändert (`InstancedVOBufferGeometry.ts:259–260`, Prüfung `:278–286`) · MEM-010 unverändert (`InstancedVOBufferGeometry.ts:359–363`, Doku `:86–97`) · MEM-011 unverändert (`InstancedVOBufferGeometry.ts:288–314`) · BUG-028 unverändert (`InstancedVOBufferGeometry.ts:560–571`, `copy()` `:144`) · READ-007 unverändert an den sechs Fundstellen des Audits, dasselbe Muster dazu an `initializeAttributes.ts:17–19` und `:58–59` und `vertex-buffers-geometry-updates.spec.ts:1784–1785` · READ-008 unverändert (`createVertexObjectPrototype.ts` sechs Blöcke Z. 21/33/54/118/169/212, `arguments`-Begründung `InstancedVOBufferGeometry.ts:483/521`, `VOBufferGeometry.ts:119/148`, `VertexObjectPool.ts:334`, `createVertexObjectPrototype.ts:199`) · Nebenbefund gleicher Ursache wie MEM-006 (Konstruktoren) ins Paket · Folgen aus erledigten Paketen: keine offen · Queue: kein Eintrag mit gleicher Ursache · Restplan geprüft: unverändert
  - 2026-10-24 Zug 1: Implementierer beauftragt (opus, effort medium), Brief `paket-12.impl-0.brief.txt`, Report nach `paket-12.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG (session f189faf5), 21 Dateien geändert/neu (u. a. `threeVertexLayout.spec.ts`, `src/testing/threeWebGPUAttributeUtils.d.ts`), roter Lauf 13 failed vor dem Fix + Browser-Test rot gegen altes `dist`, 6 Abweichungen im Report `paket-12.impl-0.report.md` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-12.verify.log`)
  - 2026-10-24 Zug 3: Reviewer (opus, medium, session ba71ea95) — alle sieben Findings und der Nebenbefund behoben, nichts kritisch/wichtig, fünf klein, freigegeben · Diff `paket-12.diff`, Report `paket-12.review-0.report.md`
  - 2026-10-24 Zug 4: keine Runde nötig
  - 2026-10-24 Zug 5: Commit 8f3d5ff5 (21 Dateien, Trailer `Remediation-Run: 2026-10-23`), Verify aus Zug 2 trägt (keine Änderung seither)

## Für Zug 5

Keine öffentliche Signatur ändert sich, kein Export kommt dazu, keine `public-api.ts` wird
berührt. Die `Schnittstellen:`-Zeile im Plan nennt nach dem Commit: `dispose()` beider
Geometrien kehrt beim zweiten Aufruf sofort zurück (kein zweites `dispose`-Event) und wirft den
Fehler eines Dispose-Listeners erst nach dem Abbau · `attachInstancedPool()` disposed einen
selbst gebauten Pool bei jeder Weigerung und nimmt bei einem Wurf während des Aufbaus Slots,
Attachment und die neue Route zurück, die alte Route unter dem Namen bleibt · die Konstruktoren
von `InstancedVOBufferGeometry` und `InstancedVertexObjectGeometry` disposen bei einem Wurf jeden
Pool, den sie selbst gebaut haben, und geben die Attachments übergebener Pools zurück · ein von
`detachInstancedPool()` zurückgelassenes Attribut trägt ein leeres Array desselben Typs und
`count` 0 · `update()` einer aus einer `BufferGeometry` gebauten Geometrie fasst die Draw Range
nicht an · intern: `GeometryAttributeSlots#withdrawRoute(geometry, route)`, neuer Spec
`src/vertex-objects/threeVertexLayout.spec.ts` über `src/testing/threeWebGPUAttributeUtils.d.ts`.

## Abgleich

Stand des Codes: HEAD 0ae02d67, Arbeitsbaum sauber (nur Plan und Paketdateien ungetrackt).
`git diff --stat 7341059f..HEAD -- packages/twopoint5d/src/vertex-objects` nennt allein
`VertexAttributeDescriptor.ts` (Paket 9, `private` → `#`); alle Fundstellen stehen, wo das Audit
sie sah.

- **MEM-005 — unverändert.** `InstancedVOBufferGeometry#dispose()` (Z. 411) setzt
  `this.#disposed = true` und läuft ohne Rückkehr weiter bis `super.dispose()` (Z. 428), das
  `dispose`-Event geht beim zweiten Aufruf ein zweites Mal hinaus. Ebenso
  `VOBufferGeometry#dispose()` (Z. 86–92). Die Specs `is safe to call twice`
  (`InstancedVertexObjectGeometry.spec.ts:235`) und `a second dispose() throws nothing …`
  (`vertex-buffers-geometry-updates.spec.ts:1323`) zählen nur Pool-`dispose()`, die selbst
  idempotent sind, und keine Events.
- **MEM-006 — unverändert.** `attachInstancedPool()` baut den Pool Z. 259–260
  (`new VertexObjectPool(pool, this.instancedPool.capacity)`) und wirft Z. 281–285 aus der
  Slot-Prüfung, ohne ihn freizugeben. `declareOwnedPool()` steht absichtlich erst dahinter
  (Z. 288–292).
- **MEM-010 — unverändert.** `#detachRoute()` Z. 359–363 merkt das zurückgelassene Attribut in
  `#vacatedSlots`, dessen Doku (Z. 86–97) die Grenze nennt (»holds one attribute, and its typed
  array, per name until then«). Geprüft in three 0.186.1, ob beim Freigeben eines GPU-Buffers das
  Array gelesen wird: nein — `WebGPUAttributeUtils#destroyAttribute()` liest
  `backend.get(attribute).buffer`, `WebGLAttributeUtils#destroyAttribute()` `bufferGPU`,
  `Info#destroyAttribute()` die Größe aus `memoryMap`, die `createAttribute()` beim Bau
  eingetragen hat; der `onDispose`-Handler in `src/renderers/common/Geometries.js` geht über
  `geometry.attributes` und `renderObject.getAttributes()` und ruft je Attribut
  `Attributes#delete()`. Damit greift der erste Zweig der Empfehlung.
- **MEM-011 — unverändert.** Nach der Prüfung Z. 290–314 ohne Rückweg:
  `declareOwnedPool()` → `#detachRoute(name)` (Z. 295, die alte Route ist weg) →
  `#attachments.attach()` (Z. 297) → `initializeInstancedAttributes()` (Z. 302, setzt und
  beansprucht Slots einzeln) → `#routes.attach()` (Z. 307). Der Kommentar Z. 288–289 verspricht,
  ein Wurf hinterlasse nichts.
- **BUG-028 — unverändert.** `#updateDrawRange()` Z. 560–571, Zweig ohne `basePool` Z. 569
  `this.setDrawRange(0, Infinity)`; `copy()` Z. 144 hat die Draw Range der Quelle übernommen.
  Kein Aufrufer in der Library baut die Geometrie aus einer `BufferGeometry`
  (`FeatureSpritesGeometry.ts:67` übergibt immer eine Basisbeschreibung), auch kein Demo des
  Lookbooks und kein Browser-Test.
- **READ-007 — unverändert**, an den Fundstellen des Audits: `VertexAttributeDescriptor.ts:10–11`,
  `VertexObjectDescriptor.ts:14–17`, `VertexObjectBuffer.ts:240`, `alignedAttributeSize.ts:8–9`,
  `asInstancedCopySource.ts:10`, `asThreeTypedArray.ts:5–6`. Dasselbe Muster, vom Audit nicht
  gelistet, an `initializeAttributes.ts:17–19` (`:82–107`), `:58–59` (`:119`, `:304`) und im Spec
  `vertex-buffers-geometry-updates.spec.ts:1784–1785` — gehört zum Finding. Außerhalb von
  `vertex-objects/` keine Zeilenverweise auf three (`SpritePicker.ts:68` nennt Methoden,
  `Display.ts:1114` nur die Version). Die Regeln selbst stimmen mit dem installierten three
  0.186.1 überein, in Node geprobt: `_getVertexFormat()` gibt `Int8`/`Uint8`/`Int16`/`Uint16` mit
  einem Wert `undefined` (und loggt `THREE.WebGPUAttributeUtils: Vertex format not supported yet.`),
  `Int32`/`Uint32`/`Float32` `sint32`/`uint32`/`float32`; drei normalisierte `Uint8` `unorm8x4`,
  drei normalisierte `Uint16` `unorm16x4`; `createAttribute()` macht aus `Uint8Array` (ein Wert)
  `Uint32Array` und aus `Int16Array` (zwei Werte) `Int32Array`, lässt das `Uint8Array` eines
  `InterleavedBuffer` stehen und polstert es nicht, polstert drei normalisierte `Uint8` auf
  `_paddedItemSize` 4; `new InstancedBufferGeometry().copy(new BufferGeometry())` lässt
  `instanceCount` `undefined`.
- **READ-008 — unverändert.** Der Fünfzeiler »a vertex object alive in its pool has its buffer …«
  steht wortgleich in `createVertexObjectPrototype.ts` Z. 21–24, 33–36, 54–57, 118–121, 169–172,
  212–215. Die `arguments`-Begründung steht in `InstancedVOBufferGeometry.ts:483–485` und
  `:521–523`, `VOBufferGeometry.ts:119–121` und `:148–150` (je wortgleich, 56 B, Node 24), in
  `VertexObjectPool.ts:334–336` (`touchVO()`, ohne Zahl) und als Begründung der Fabrik in
  `createVertexObjectPrototype.ts:199–202` (56 B und 112 B). `src/vertex-objects/hot-path-allocations.spec.ts`
  misst `touch()` (Z. 398), `touchVO()` (Z. 426) und den Setter über sechzehn Werte (Z. 199).

## Entscheidungen in Zug 0 (mit Grund)

- **MEM-006: den selbst gebauten Pool vor dem Wurf disposen, nicht die Prüfung vorziehen.**
  `attributeNamesOf()` liest die Namen aus denselben Buffer-Maps des Pools, die
  `initializeInstancedAttributes()` durchläuft — sein TSDoc sagt, deshalb könne die Antwort nicht
  von dem abweichen, was tatsächlich beansprucht wird. Eine Prüfung über den Descriptor vor dem
  Bau gäbe genau diese Garantie auf.
- **MEM-011: neue Route zuerst aufbauen, alte erst danach abhängen, den Aufbau in `try`/`catch`
  mit Rücknahme.** Der Umbau von `initializeRoute()` in Bauen und Einsetzen (erster Zweig der
  Empfehlung) träfe auch die beiden Konstruktorpfade; die Reihenfolge allein reicht hier, weil
  die Slot-Prüfung garantiert, dass neue und alte Route keinen Slot teilen. Zur Rücknahme gehört,
  die Namen aus `#everHeld` wieder zu vergessen: sonst weist ein zweiter Versuch mit demselben
  Pool seine eigenen Namen ab, und »the geometry is left exactly as it was« (TSDoc Z. 227–229)
  gälte nicht. Das ist richtig, weil die Prüfung nur Namen durchlässt, die die Geometrie nie hatte,
  und die Attribute des Versuchs den Renderer nie erreicht haben (alles synchron, kein `update()`
  dazwischen). Was nach dem Aufbau läuft — `#detachRoute()` und `#routes.attach()` —, wirft nur bei
  einer gebrochenen Invariante und bleibt außerhalb des `try`.
- **MEM-005 samt Abbau hinter einem werfenden Dispose-Listener.** Mit der bloßen Rückkehr am
  Anfang verlöre die Geometrie den einzigen Weg, ihren Abbau nachzuholen: three's
  `dispatchEvent()` bricht beim ersten werfenden Listener ab, `super.dispose()` wirft, und heute
  holt ein zweiter `dispose()` den Rest nach. Danach bliebe ein übergebener Pool für immer
  `isAttachedToGeometry` und sein `resize()` verweigert. Deshalb geht der Abbau nach dem Event in
  ein `finally`, und der Fehler kommt danach heraus — das Muster von `Display#dispose()`
  (`resource-lifecycle.md` §4) und `PanControl2D#dispose()` (Paket 4). Das gehört zu MEM-005, keine
  Ausweitung: ohne es wäre der Fix eine Folge.
- **MEM-010: erster Zweig der Empfehlung, das Array leeren.** three liest beim Freigeben kein
  Array (siehe Abgleich). Geleert wird beim Abhängen der Route, nicht erst bei Pool-`dispose()`:
  nach dem Abhängen liest niemand mehr die Daten des Attributs, es wird nur noch für die Dauer
  des Dispose-Events in seinen Slot geliehen. Das Array des Pools selbst wird nicht angefasst,
  nur die Referenz des Attributs ersetzt. `count` geht mit auf 0, damit das Attribut in sich
  stimmig bleibt.
- **BUG-028: erster Zweig der Empfehlung, `update()` lässt die Draw Range stehen.** Das ist das
  Ziel des Pakets im Plan. Ohne Basis-Pool hat die Geometrie keine Quelle für eine Draw Range außer
  der kopierten und der, die der Aufrufer selbst setzt.
- **Nebenbefund Konstruktoren in dieses Paket.** Dieselbe Ursache wie MEM-006 — ein Wurf lässt
  einen Pool liegen, den die Geometrie für den Aufruf gebaut hat — an der zweiten Eintrittsstelle,
  und `resource-lifecycle.md` §1 verlangt es für `Display` schon wörtlich (»A `Display`
  constructor that throws after it has built … leaves nothing behind«). Erreichbare Fälle heute:
  `new InstancedVOBufferGeometry(instancedDesc, 10, baseDesc, 1.5)` (der `RangeError` der
  Basis-Kapazität kommt, nachdem der Instanz-Pool gebaut und als eigener erklärt ist),
  `new InstancedVertexObjectGeometry(instancedDesc, 10, baseDesc, -1)` (das zweite `asPool()`
  wirft hinter dem ersten), `new InstancedVertexObjectGeometry(instancedDesc, 10, disposedPool)` und
  `new InstancedVertexObjectGeometry(disposedPool, 10, baseDesc, 1)` (`super()` weist den
  disposten Pool ab, nachdem `asPool()` den anderen gebaut hat). `VertexObjectGeometry` und
  `VOBufferGeometry` bauen höchstens einen Pool und werfen danach nur bei einer gebrochenen
  Invariante — nicht im Paket.
- **READ-007: Methode oder Tabelle von three nennen, keine Zeilen und keine Version, und die
  Regel in einem Spec halten.** Ein Kommentar ohne Version stimmt nach einem three-Bump weiter,
  solange der Spec grün ist; schlägt der Spec an, ist der Kommentar zu prüfen. Der Spec geht über
  three's ungetyptes Modul `three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js` (vom
  `exports`-Eintrag `./src/*` gedeckt, `@types/three` 0.186.0 hat keine Deklaration dafür) und eine
  minimale Deklaration in `src/testing/`, das `tsconfig.build.json` ausschließt, damit sie nicht
  in die Library gerät. Die Regel zu `arrayStride` eines `InterleavedBuffer`
  (`createShaderVertexBuffers()`) braucht ein Render-Objekt und bleibt beim Namen der Methode
  ohne eigenen Fall.
- **READ-008: Invariante einmal über den Fabriken, die `arguments`-Begründung samt Zahlen in
  `packages/twopoint5d/docs/architecture.md` §2 `vertex-objects/`.** Dort steht schon, warum die
  Fabriken geteilt sind; die Zahlen gehören neben die Bench-Zahlen desselben Abschnitts. Kein Code
  ändert sich, nur Kommentare.

## Vorgehen

Jeder Korrektheitsfix: zuerst der Test, rot sehen, dann der Fix. Spies und Stubs auf dem
Testobjekt über `createSandbox()` aus `sinon` (`resource-lifecycle.md` §7, wie in
`InstancedVertexObjectGeometry.spec.ts:63`), `vi.spyOn`/`vi.stubGlobal` nur für Globals wie
`console` und `GPUBufferUsage`. Neue Fälle in `InstancedVertexObjectGeometry.spec.ts` nutzen
dessen Descriptoren (`instancedDescriptor`, `baseDescriptor`, `extraInstancedDescriptor`,
`secondExtraInstancedDescriptor`); wo ein Fall einen neuen Descriptor braucht, steht er hier.

1. **MEM-005 — `dispose()` beider Geometrien idempotent, Abbau hinter einem werfenden Listener.**

   `VOBufferGeometry#dispose()` (Z. 86–110):

   ```ts
   override dispose(): void {
     if (this.#disposed) return;
     this.#disposed = true;

     try {
       // the renderer reads the attributes of this geometry once more while it handles the
       // dispose event, and reaches for the id of a slot before it checks that the slot is
       // filled — so the event goes out while every slot is still there
       super.dispose();
     } finally {
       // a listener of the dispose event that throws holds up none of the teardown: its error
       // reaches the caller once the geometry is down, and a second dispose() has nothing left
       // to do
       this.#attachments.detachAll();
       // … the rest of the method as it is, unchanged and in its order
     }
   }
   ```

   `InstancedVOBufferGeometry#dispose()` (Z. 411–474): `if (this.#disposed) return;` vor
   `this.#disposed = true;`. Das Ausleihen der geräumten Slots (Z. 414–425) bleibt vor dem `try`.
   Im bestehenden `finally` (Z. 429–434) folgt nach `this.#vacatedSlots.clear();` der ganze
   Rest der Methode (Z. 436–473) unverändert und in seiner Reihenfolge, mit dem Kommentar zum
   werfenden Listener wie oben. Die TSDoc beider Methoden bekommt einen Satz: »A second call
   does nothing. A listener of the dispose event that throws holds up none of this: its error
   reaches the caller once the geometry is down.«

   Tests in `InstancedVertexObjectGeometry.spec.ts`, `describe('dispose()')`:
   - `test('a second dispose() sends no second dispose event', …)` — je eine
     `InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1)` und eine
     `VertexObjectGeometry(baseDescriptor, 10)` (Import ergänzen), ein Listener
     `geometry.addEventListener('dispose', () => events++)`, zweimal `dispose()`, `events` ist 1.
     Vor dem Fix rot (2).
   - `test('a dispose listener that throws holds up nothing, and its error comes out once the geometry is down', …)` —
     `handedIn = new VertexObjectPool<VO>(instancedDescriptor, 10)`, Geometrie
     `new InstancedVertexObjectGeometry(handedIn, 10, baseDescriptor, 1)`, `extra =
     geometry.attachInstancedPool('extraPool', extraInstancedDescriptor)`, ein Listener, der
     zählt und `new Error('a listener of dispose')` wirft. `expect(() => geometry.dispose()).toThrow('a listener of dispose')`;
     danach `handedIn.isAttachedToGeometry` `false`, `handedIn.isDisposed` `false`,
     `geometry.basePool!.isDisposed` und `extra.isDisposed` `true`,
     `Object.keys(geometry.attributes)` `[]`, `geometry.index` `null`,
     `geometry.extraInstancedPools.size` 0; ein zweiter `dispose()` wirft nicht, der Zähler bleibt
     bei 1. Dasselbe für `VertexObjectGeometry` mit einem übergebenen
     `VertexObjectPool<VO>(baseDescriptor, 10)`: `pool.isAttachedToGeometry` `false`, Attribute
     leer. Vor dem Fix rot (der übergebene Pool bleibt angehängt, die Attribute stehen).

2. **MEM-006 und MEM-011 — `attachInstancedPool()` transaktional.**

   a. `GeometryAttributeSlots` bekommt neben `releaseRoute()`:

   ```ts
   /**
    * Take back the claims of a route whose attributes never reached the renderer: the attempt of
    * an attach that failed half way. Its attributes leave the geometry, and a slot no claim is
    * left on is forgotten as if it had never been held — the geometry refused every name it had
    * held before the attempt, so none of these was taken before it.
    */
   withdrawRoute(geometry: BufferGeometry, route: AttributeRoute): void
   ```

   Gleiche Schleife wie `releaseRoute()`: Claim der Route suchen und entfernen; bleibt kein Claim,
   `geometry.deleteAttribute(attrName)`, `this.#slots.delete(attrName)` und
   `this.#everHeld.delete(attrName)`; bleibt einer (kommt bei einer angehängten Route nicht vor),
   dessen Attribut zurück in den Slot wie in `releaseRoute()`, `#everHeld` bleibt dann. Keine
   Rückgabe. Den Klassenkommentar (Z. 37–39) um einen Satz ergänzen: »A route that is withdrawn
   before it reached the renderer is the one exception: its names are forgotten again.«

   b. `attachInstancedPool()` ab Z. 274, Reihenfolge danach:
   1. Slot-Prüfung wie heute; vor dem `throw`: `if (ownsPool) extraPool.dispose();` mit dem
      Kommentar `// the pool was built for this call alone, and a refused call leaves nothing behind`.
   2. `buffers`/`bufferSerials` anlegen, `this.#attachments.attach(extraPool);`, dann

      ```ts
      try {
        initializeInstancedAttributes(this, extraPool, buffers, bufferSerials, this.#slots);
      } catch (error) {
        // nothing of this attempt has reached the renderer: its slots, its attachment and a pool
        // built for it go, and the route that holds the name has not been touched yet
        this.#slots.withdrawRoute(this, buffers);
        this.#attachments.detach(extraPool);
        if (ownsPool) extraPool.dispose();
        throw error;
      }
      ```
   3. `if (ownsPool) this.declareOwnedPool(extraPool);` — der Kommentar Z. 288–289 wird zu
      `// only once the attributes stand: a pool that is refused or fails is not one of this geometry's own`.
   4. `this.#detachRoute(name);` mit dem Kommentar `// the route that held the name goes only now that its successor stands — the guard above keeps their slots apart`.
   5. `this.#routes.attach({…})` wie heute.

   TSDoc von `attachInstancedPool()`: der erste `@throws` (Z. 227–229) endet »… and the geometry
   is left exactly as it was; a pool built here from a descriptor is disposed.« Neuer `@throws`
   danach: »whatever the attributes of `pool` throw as they are built. The geometry is left as it
   was — the route that holds `name` keeps every attribute it has, and a pool built here from a
   descriptor is disposed — and the error reaches the caller as it was thrown.«

   Tests in `InstancedVertexObjectGeometry.spec.ts`, neues `describe('attachInstancedPool() that fails')`
   mit dem Descriptor

   ```ts
   // two attributes in buffers of their own, so an attach sets two slots one after the other
   const twinDescriptor = new VertexObjectDescriptor({
     attributes: {
       twinA: {size: 1, bufferName: 'twinABuffer'},
       twinB: {size: 1, bufferName: 'twinBBuffer'},
     },
   });
   ```

   und einem Spy `sandbox.spy(VOBufferPool.prototype, 'dispose')` (Import `VOBufferPool`), über
   dessen `thisValues` der Pool gefunden wird, den die Geometrie gebaut hat (`descriptor ===
   twinDescriptor`):
   - `test('a refused descriptor leaves no pool behind: the one built for it is disposed', …)` —
     `geometry.attachInstancedPool('first', extraInstancedDescriptor)`, erst danach den Spy
     anlegen, dann wirft `attachInstancedPool('second', extraInstancedDescriptor)` (Slot
     `"extra"`); der Spy sah genau ein `dispose()`, auf einem Pool mit
     `extraInstancedDescriptor`, der nicht `geometry.extraInstancedPools.get('first')` ist, und
     der ist `isDisposed`. Vor dem Fix rot (kein `dispose()`).
   - `test('a throw while the attributes are built leaves the route under the name, its pool and the slots as they were', …)` —
     `live = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor)`, Attributnamen
     sortiert merken, dann `const setAttribute = sandbox.stub(geometry, 'setAttribute').callThrough();`
     `setAttribute.onSecondCall().throws(new Error('setAttribute'))`.
     `attachInstancedPool('extraPool', twinDescriptor)` wirft `'setAttribute'`; danach
     `extraInstancedPools.get('extraPool')` ist `live`, `live.isDisposed` `false`,
     `live.isAttachedToGeometry` `true`, `getAttribute('extra')` definiert, die sortierten
     Attributnamen wie vorher (kein `twinA`); der für `twinDescriptor` gebaute Pool ist disposed.
     Nach `setAttribute.restore()` geht `geometry.attachInstancedPool('twins', twinDescriptor)`
     durch und legt `twinA` und `twinB` an. Vor dem Fix rot (`live` ist disposed, `twinA` steht).
   - `test('a throw while the attributes of a pool handed in are built leaves that pool unattached and alive', …)` —
     `twins = new VertexObjectPool<VO>(twinDescriptor, 10)`, derselbe Stub,
     `geometry.attachInstancedPool('twins', twins)` wirft; danach `twins.isAttachedToGeometry`
     `false`, `twins.isDisposed` `false`, `geometry.extraInstancedPools.size` 0,
     `geometry.getAttribute('twinA')` `undefined`. Vor dem Fix rot (`twins` bleibt angehängt,
     `twinA` steht).

3. **MEM-010 — das zurückgelassene Attribut gibt das Array seines Pools her.**

   Modulfunktion in `InstancedVOBufferGeometry.ts`:

   ```ts
   // three frees the gpu buffer of an attribute by its identity and the size it booked when it
   // built the buffer, and reads no array to do so: an attribute that is only lent back for the
   // dispose event can let go of the typed array of its pool
   function giveUpArray(attr: BufferAttribute | InterleavedBufferAttribute): void
   ```

   Für eine `InterleavedBufferAttribute` `attr.data`, sonst `attr` selbst: `array` wird
   `new (array.constructor as …)(0)` desselben Typs, `count` wird 0. Aufruf in `#detachRoute()`
   unmittelbar vor `this.#vacatedSlots.set(attrName, vacated);`. Die Doku von `#vacatedSlots`
   (Z. 91–95): der letzte Satz wird »… a geometry that gives up many routes with different
   attribute names holds one attribute per name until then, and each of them holds an empty
   array: it gave up the typed array of its pool as its route was detached.«

   Tests in `InstancedVertexObjectGeometry.spec.ts`, `describe('dispose()')` oder ein neues
   `describe('detachInstancedPool()')`:
   - `test('the attribute a detached route leaves behind holds an empty array of its type, and is lent back for the dispose event', …)` —
     `pool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor)`,
     `attr = geometry.getAttribute('extra') as BufferAttribute`, `type = attr.array.constructor`;
     `detachInstancedPool('extraPool')`; `attr.array.length` 0, `attr.array.constructor` `type`,
     `attr.count` 0. Ein Dispose-Listener merkt sich `geometry.getAttribute('extra')`, nach
     `geometry.dispose()` ist das `attr`. Vor dem Fix rot (Länge 10).
   - dasselbe für ein `InterleavedBufferAttribute`: Descriptor mit zwei Attributen in einem Buffer
     (`pairA: {size: 1, bufferName: 'pairBuffer'}`, `pairB: {size: 1, bufferName: 'pairBuffer'}`),
     `attr.data.array.length` 0, `attr.data.count` 0, `geometry.getAttribute('pairB')` hat
     dieselbe `data`.

   Browser-Test `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js`,
   `it("every attribute of a detached route reaches the renderer's free list", …)`: vor
   `detachInstancedPool('extra')` `const extraAttribute = geometry.getAttribute('extraOffset');`,
   danach `expect(extraAttribute.array.length, 'the attribute left behind lets go of the array of its pool').to.equal(0);`.
   Die bestehende Assertion auf `info.memory.attributes` bleibt der Beleg, dass der Renderer den
   Buffer mit leerem Array freigibt. Vor dem Fix gegen das alte `dist` rot.

4. **Nebenbefund — die Konstruktoren lassen keinen Pool liegen.**

   a. `InstancedVOBufferGeometry`: alles nach `super();` (Z. 136–174) in ein `try`. Im `catch`:
   `this.#attachments.detachAll();`, dann jeden Pool disposen, den `this.#attachments.owns()`
   kennt — `this.instancedPool` und `this.basePool`, beide über `!= null` geprüft, weil der Wurf
   vor ihrer Zuweisung kommen kann —, `throw error`. Kommentar:
   `// a constructor that throws leaves nothing behind: the pools it built go, and a pool handed in is no longer counted as attached`.
   Das `@throws` des Konstruktors (Z. 106–108) bekommt den Satz »Whatever the constructor throws,
   a pool it built from a descriptor or description is disposed, and a pool handed in is left as
   it was.«

   b. `InstancedVertexObjectGeometry`: die beiden `asPool()`-Aufrufe vor `super()` in eigene
   Konstanten, `super()` in ein `try` (die Klasse hat nur `declare`-Felder, `super()` darf dort
   stehen). Wirft das zweite `asPool()` oder `super()`, werden die Pools disposed, die `asPool()`
   hier gebaut hat (`!(args[0] instanceof VertexObjectPool)` bzw. für die Basis
   `!(args[2] instanceof BufferGeometry) && !(args[2] instanceof VertexObjectPool)`), dann
   weiterwerfen. Die beiden `declareOwnedPool()`-Aufrufe danach bleiben.

   Tests in `InstancedVertexObjectGeometry.spec.ts`, `describe('a pool that has been disposed')`
   bzw. ein neues `describe('a constructor that throws')`, je mit dem Spy auf
   `VOBufferPool.prototype.dispose`:
   - `new InstancedVertexObjectGeometry(instancedDescriptor, 10, disposedBase)` wirft wie heute
     (`/base/`, `/disposed/`); der für `instancedDescriptor` gebaute Pool ist disposed.
   - `new InstancedVertexObjectGeometry(disposedInstanced, 10, baseDescriptor, 1)` wirft; der für
     `baseDescriptor` gebaute Pool ist disposed.
   - `new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, -1)` wirft den
     `RangeError` des Pools; der für `instancedDescriptor` gebaute ist disposed.
   - `new InstancedVOBufferGeometry(instancedDescriptor, 10, baseDescriptor, 1.5)` (Import
     ergänzen) wirft den `RangeError`; der für `instancedDescriptor` gebaute `VOBufferPool` ist
     disposed.
   - `new InstancedVertexObjectGeometry(handedIn, 10, baseDescriptor, -1)` mit einem lebenden
     `handedIn`: wirft, `handedIn.isDisposed` `false`, `handedIn.isAttachedToGeometry` `false`.
   Alle vor dem Fix rot bis auf den letzten (Charakterisierung, der Pool wird heute vor dem Wurf
   nicht angehängt).

5. **BUG-028 — `update()` lässt die Draw Range einer aus einer `BufferGeometry` gebauten Geometrie stehen.**

   `#updateDrawRange()` (Z. 560–571) ohne `else`-Zweig: nur mit `basePool` wird die Draw Range
   gesetzt. Kommentar am `if`:
   `// without a base pool the draw range is the one copied from the BufferGeometry handed in, or whatever the caller set since`.
   TSDoc von `update()` (Z. 540–541): »Sets `instanceCount` from the instanced pool and, on a
   geometry with a base pool, the draw range from that pool, uploads …«; ein Satz dazu: »A
   geometry built from a `BufferGeometry` keeps the draw range it copied from it, and one set on
   it since.« Im Konstruktor-TSDoc ein Satz beim `BufferGeometry`-Fall: »Built from a
   `BufferGeometry`, the geometry copies its attributes, its index and its draw range; `update()`
   leaves that draw range as it is.«

   Tests in `vertex-buffers-geometry-updates.spec.ts`, `describe('constructed with a BufferGeometry')`:
   - `test('update() keeps the draw range it copied from that geometry', …)` — `base` mit
     `position` (12 Floats, 3), Index `[0, 1, 2, 0, 2, 3]`, `base.setDrawRange(0, 3)`;
     `new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(instancedDesc, 10, base)`,
     `instancedPool.createVO()`, `update()`; `drawRange` ist `{start: 0, count: 3}`. Vor dem Fix
     rot (`count: Infinity`).
   - `test('update() keeps a draw range set on it', …)` — dieselbe Geometrie ohne eingeschränkte
     Quelle, `geometry.setDrawRange(3, 3)`, `update()`, `{start: 3, count: 3}`. Vor dem Fix rot.

6. **READ-007 — Kommentare ohne Zeilen und Version, die Regeln im Spec.**

   a. Neu `packages/twopoint5d/src/testing/threeWebGPUAttributeUtils.d.ts`: ein `declare module
   'three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js'` mit `export default class
   WebGPUAttributeUtils`, Konstruktor `(backend: unknown)`, `createAttribute(attribute:
   BufferAttribute | InterleavedBufferAttribute, usage: number): void` und
   `_getVertexFormat(attribute: BufferAttribute | InterleavedBufferAttribute): string | undefined`
   (Typen aus `three/webgpu`), mit einem Kopfkommentar: three ships no types for its WebGPU
   backend utilities; this declares what `threeVertexLayout.spec.ts` calls, and nothing outside
   `src/testing/` and the specs sees it. Prüfen, dass `pnpm typecheck` die Datei sieht
   (`tsconfig.json` `include: ["src"]`) und `tsconfig.build.json` sie ausschließt
   (`"src/testing"`). Geht der Weg über die Deklaration nicht durch, ein dynamischer Import mit
   einem Spezifizierer aus einer `const` und einem Cast auf dieselbe Form im Spec — dann im Report
   als Abweichung.

   b. Neu `packages/twopoint5d/src/vertex-objects/threeVertexLayout.spec.ts`, Kopfkommentar: the
   rules of three the vertex layout of this module rests on, checked against the three in the
   catalog of `pnpm-workspace.yaml`; a test that fails after a bump names a comment to check
   again, and the comment names the test. Stub-Backend:

   ```ts
   const backendData = new WeakMap<object, Record<string, unknown>>();
   const backend = {
     get(object: object) { /* the entry for object, created on first use */ },
     device: {createBuffer: ({size}: {size: number}) => ({getMappedRange: () => new ArrayBuffer(size), unmap() {}})},
   };
   ```

   `vi.stubGlobal('GPUBufferUsage', {INDEX: 0x10, VERTEX: 0x20})` und `vi.unstubAllGlobals()` im
   `afterEach`; `console.error` über `vi.spyOn(console, 'error').mockImplementation(() => {})`
   stumm, wo `_getVertexFormat()` loggt, und dort geprüft, dass er geloggt hat. Fälle, je mit
   Attributen aus `three/webgpu`:
   - `test('three has a vertex format of one value for the 32-bit types alone', …)` —
     `_getVertexFormat(new BufferAttribute(new X(4), 1))`: `Int8Array`, `Uint8Array`,
     `Int16Array`, `Uint16Array` → `undefined`; `Int32Array` → `'sint32'`, `Uint32Array` →
     `'uint32'`, `Float32Array` → `'float32'`.
   - `test('three rounds the vertex format of more than one value up to whole 4 bytes', …)` —
     `new BufferAttribute(new Uint8Array(6), 3, true)` → `'unorm8x4'`,
     `new BufferAttribute(new Uint16Array(6), 3, true)` → `'unorm16x4'`.
   - `test('three widens an 8- or 16-bit integer BufferAttribute without normalized to 32 bits, and leaves an InterleavedBuffer as it is', …)` —
     nach `createAttribute(attr, 0x20)`: `Uint8Array` (ein Wert) → `attr.array` ist
     `Uint32Array`, `Int16Array` (zwei Werte) → `Int32Array`; ein `InterleavedBufferAttribute`
     über `new InterleavedBuffer(new Uint8Array(8), 4)` → `data.array` bleibt `Uint8Array`.
   - `test('three pads a BufferAttribute whose stride is no multiple of 4 bytes, and never an InterleavedBuffer', …)` —
     `new BufferAttribute(new Uint8Array(6), 3, true)` → `backend.get(attr)._paddedItemSize` 4;
     das `InterleavedBuffer` oben → `backend.get(buffer)._paddedItemSize` `undefined`.
   - `test('InstancedBufferGeometry#copy() of a plain BufferGeometry leaves instanceCount undefined', …)`.
   - Typfall: `// @ts-expect-error three's TypedArray has no Float16Array (asThreeTypedArray.ts)`
     über `const float16: TypedArray = new Float16Array(1);` (`import type {TypedArray} from
     'three/webgpu'`), danach `expect(float16.length).toBe(1)` — die Konstante muss gelesen
     werden, `noUnusedLocals` gilt (Muster: `src/texture/sampleFrameAt.spec.ts:99–104`). Bekommt
     `@types/three` den Typ, schlägt `pnpm typecheck` mit TS2578 an.

   c. Kommentare, jeweils ohne Zeilennummer und ohne »three 0.186.1«/»`@types/three@0.186.0`«,
   mit Verweis auf den Spec. Die Sätze bleiben, was sie sagen; nur die Belege ändern sich:
   - `VertexAttributeDescriptor.ts:10–12` und `VertexObjectDescriptor.ts:14–19`:
     `` `WebGPUAttributeUtils.js:32–36`, `:518–520` `` → `` the table `typeArraysToVertexFormatPrefixForItemSize1` that `WebGPUAttributeUtils#_getVertexFormat()` reads for one value ``;
     `` `:12–26`, `:522–541` `` → `` `typedArraysToVertexFormatPrefix` for more ``; »three
     0.186.1 builds/takes« → »three builds/takes«; ein Halbsatz »— `threeVertexLayout.spec.ts`
     holds it«.
   - `alignedAttributeSize.ts:8–9`: `` `WebGPUAttributeUtils.js:529–539` `` →
     `` `WebGPUAttributeUtils#_getVertexFormat()`, held by `threeVertexLayout.spec.ts` ``.
   - `initializeAttributes.ts:17–20`: `` `WebGPUAttributeUtils.js:82–107` `` →
     `` `WebGPUAttributeUtils#createAttribute()`, held by `threeVertexLayout.spec.ts` ``;
     `:58–59`: `` `WebGPUAttributeUtils.js:119` `` → `` `createAttribute()` pads a buffer
     attribute by its itemSize ``, `` `:304` `` → `` `createShaderVertexBuffers()` ``.
   - `VertexObjectBuffer.ts:240`: `` `WebGPUAttributeUtils.js:202–222` `` →
     `` `WebGPUAttributeUtils#updateAttribute()`; `threeVertexLayout.spec.ts` holds the padding ``.
   - `asInstancedCopySource.ts:10`: »Checked against three 0.186.1,
     `src/core/InstancedBufferGeometry.js:36-44`.« → »`InstancedBufferGeometry#copy()` in three;
     `threeVertexLayout.spec.ts` holds it.«
   - `asThreeTypedArray.ts:5–6`: `` (`@types/three@0.186.0`, `src/core/BufferAttribute.d.ts`) `` →
     `` (the `TypedArray` of `@types/three`, `src/core/BufferAttribute.d.ts`; `threeVertexLayout.spec.ts` fails to compile once it has one) ``.
   - `vertex-buffers-geometry-updates.spec.ts:1784–1785`: wie `initializeAttributes.ts:17–20`.

7. **READ-008 — Kommentare an eine Stelle.**

   a. `createVertexObjectPrototype.ts`: über `makeAttributeGetter` (nach dem Absatz Z. 14–18) ein
   Absatz

   ```ts
   // every accessor below takes for granted what it does not check: a vertex object alive in its
   // pool has its buffer, that buffer holds its typed array and lists the record of every buffer of
   // its descriptor at the position the accessor was built with. These accessors run per sprite
   // and per frame, so they assert it (`!`) rather than pay for a check on every value
   ```

   und in jedem der sechs Accessoren statt des Fünfzeilers eine Zeile
   `// the vertex object is alive in its pool: see above the factories`. Z. 199–202 wird zu
   `` // read through `arguments` rather than a rest parameter: docs/architecture.md, `vertex-objects/`, has why and what each costs — separate values cost as well, which is why the setters of up to sixteen values declare their parameters ``
   (auf die Zeilenbreite der Datei umbrechen). Die Kommentare Z. 96–98, 115–116 und 135–137
   bleiben: sie begründen die Parameter ihres eigenen Setters.

   b. `InstancedVOBufferGeometry.ts:483–485` und `:521–523`, `VOBufferGeometry.ts:119–121` und
   `:148–150`: der Dreizeiler wird
   `` // read through `arguments` rather than the rest parameter of the signature: docs/architecture.md, `vertex-objects/` ``;
   die `biome-ignore`-Zeilen bleiben, wie sie sind (sie verweisen auf den Kommentar über der
   Schleife, und der steht weiter dort). `VertexObjectPool.ts:334–336` ebenso, mit »the names are
   read through `arguments` …«.

   c. `packages/twopoint5d/docs/architecture.md`, §2 `vertex-objects/`, neuer Absatz nach dem, der
   mit »… so the factories are shared on purpose.« endet:

   > Methods on the hot path that take any number of values read them through `arguments`, never
   > through a rest parameter: `touch()` and `touchAttributes()` of both geometries,
   > `VertexObjectPool#touchVO()` and the generated `set…()` of an attribute of more than sixteen
   > values. Once the method of a second geometry class has run, V8 builds the rest array on every
   > call — 56 B with a single argument, measured on Node 24 —, while `arguments` stays off the
   > heap as long as the method itself reads only its `length` and its elements; handing it to
   > another function makes V8 build the object. Read with many separate values it costs as well
   > (112 B with twelve values), which is why the generated setters of up to sixteen values declare
   > their parameters one by one. `src/vertex-objects/hot-path-allocations.spec.ts` measures
   > `touch()`, `touchVO()` and the setter of more than sixteen values.

   (ohne Zitatzeichen, auf die Zeilenbreite des Dokuments umgebrochen)

8. **Doku und CHANGELOG.**

   a. `packages/twopoint5d/docs/resource-lifecycle.md` §1, nach dem Satz »A `Display` constructor
   that throws … as `dispose()` would.«: »The constructors of `InstancedVOBufferGeometry` and
   `InstancedVertexObjectGeometry` and `InstancedVOBufferGeometry#attachInstancedPool()` do the same
   for the pools they build from a descriptor: one that throws disposes them and leaves a pool
   handed in as it was.« §5, Auszug von `VOBufferGeometry.dispose()`: auf die neue Form aus
   Schritt 1 (Rückkehr, `try` um `super.dispose()`, Abbau im `finally`), weiter als Auszug mit
   `// …`.

   b. `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` → `### Fixed`, ans Ende, vier Einträge:
   - »a second `dispose()` of a `VOBufferGeometry`, a `VertexObjectGeometry`, an
     `InstancedVOBufferGeometry` or an `InstancedVertexObjectGeometry` does nothing and sends no
     second `dispose` event, and a listener of that event that throws holds up none of the
     teardown: the pools are released or given back, the attributes and the index leave the
     geometry, and the error reaches the caller afterwards«
   - »`InstancedVOBufferGeometry#attachInstancedPool()` disposes the pool it built from a
     descriptor when it refuses the slots that pool would take, and a throw while the attributes of
     a pool are built leaves the geometry as it was: the route that holds the name keeps its pool
     and its attributes, a pool handed in is no longer counted as attached, and its attribute names
     stay free; the constructors of `InstancedVOBufferGeometry` and `InstancedVertexObjectGeometry`
     dispose the pools they built when they throw — a base capacity they refuse, or a disposed pool
     on the other side«
   - »an attribute that `detachInstancedPool()` leaves behind for the dispose event of the
     geometry lets go of the typed array of its pool: a pool released with its route is not kept
     alive by the geometry until it is disposed«
   - »`InstancedVOBufferGeometry#update()` of a geometry built from a `BufferGeometry` keeps the
     draw range it copied from it, and one set on it since; a geometry with a base pool takes its
     draw range from that pool on every `update()`«

   Kein Eintrag beschreibt den Vorzustand (Konventionen im Plan-Kopf); kein Eintrag unter
   `### Changed` oder im Migration Guide — keine Signatur und kein dokumentiertes Verhalten fällt
   weg.

## Findings im Volltext

**MEM-005 · low · packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:411** (dazu `VOBufferGeometry.ts:86`) — dispose() der Geometrie per Flag idempotent machen
dispose() setzt #disposed, kehrt aber bei einem zweiten Aufruf nicht früh zurück. Der zweite Aufruf ruft erneut super.dispose() und sendet damit das dispose-Event ein zweites Mal an alle Zuhörer (etwa SpritePicker, der auf das Event der Geometrie hört). Die Regel in resource-lifecycle.md §2 verlangt, dass ein zweiter Aufruf nichts mehr tut; hier ist er nur 'idempotent by accident'.
Beleg: `override dispose(): void { this.#disposed = true; … super.dispose();`
Empfehlung: Am Anfang `if (this.#disposed) return;` setzen, danach das Flag setzen — wie in VOBufferPool.dispose() — und einen Test (d) mit Zähler auf dem dispose-Event ergänzen.

**MEM-006 · low · packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:260** — Frisch gebauten Pool freigeben, wenn die Slot-Prüfung in attachInstancedPool() ablehnt
Bei einem Descriptor baut attachInstancedPool() zuerst einen neuen VertexObjectPool (Zeile 260) und wirft danach, wenn everHeld() einen belegten Slot meldet (Zeile 281). Der Pool wurde nie deklariert und nie disposed; er hängt nur an der GC. Ob das ein echtes Leck ist, hängt davon ab, ob der Pool etwas außerhalb des Heaps hält; nach der Ownership-Regel ist er aber vom Aufrufer-Code gebaut und gehört dem Wurf zum Aufräumen.
Beleg: `extraPool = new VertexObjectPool(pool, this.instancedPool.capacity)` … `throw new Error(…already had an attribute in the slot …)`
Empfehlung: Die Slot-Prüfung vor dem Bau des Pools über die Attributnamen des Descriptors auswerten, oder den selbst gebauten Pool vor dem throw mit dispose() freigeben.

**MEM-010 · low · packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:361** (dazu Z. 97) — Zurückgelassene Attribute abgetrennter Routen halten die Typed Arrays eines entsorgten Pools bis zum dispose() der Geometrie
detachInstancedPool() merkt sich das Attribut, das einen Slot leer zurücklässt, in #vacatedSlots, damit dispose() es dem Renderer für das dispose-Event zurückleihen kann. Bei autoDispose gibt der Pool seine Typed Arrays frei, das gemerkte BufferAttribute hält das Array aber weiter: der Speicher des Pools bleibt bis zum dispose() der Geometrie erreichbar. Der Code dokumentiert das als Grenze (eine Instanz pro Name); weil ein Name nie wieder belegt werden darf, ist der Zuwachs auf die Zahl verschiedener Namen beschränkt, kann aber bei vielen großen Pools mit wechselnden Attributnamen spürbar werden.
Beleg: `this.#vacatedSlots.set(attrName, vacated);`
Empfehlung: Prüfen, ob three beim Freigeben des GPU-Buffers das Array des Attributs liest; wenn nicht, das Array des gemerkten Attributs durch ein leeres ersetzen, sobald seine Route abgetrennt ist. Sonst die Grenze in der Doku von detachInstancedPool() nennen.

**MEM-011 · low · packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:295** — attachInstancedPool() nach der Slot-Prüfung transaktional machen
Nach der Slot-Prüfung läuft die Folge detachRoute → attachments.attach → initializeInstancedAttributes → routes.attach ohne Rollback. Wirft initializeInstancedAttributes dazwischen (etwa durch einen gebrochenen Invariantenvertrag von expectDefined), ist die alte Route unter dem Namen schon weg, der neue Pool zählt als an die Geometrie gehängt (resize() wird verweigert), und bereits gesetzte Attribute stehen ohne Route auf der Geometrie, sodass dispose() sie nie freigibt. Der Kommentar an Zeile 288 verspricht, ein throw hinterlasse nichts; das gilt nur bis zur Prüfung.
Beleg: `this.#detachRoute(name); this.#attachments.attach(extraPool); … initializeInstancedAttributes(this, extraPool, buffers, bufferSerials, this.#slots);`
Empfehlung: Die Attribute zuerst bauen und erst danach die alte Route abhängen und die neue eintragen, oder die Folge in try/catch fassen und im Fehlerfall die Attachment-Zählung und die gesetzten Slots zurücknehmen.

**BUG-028 · low · packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:569** (dazu Z. 144) — Draw Range einer kopierten Basisgeometrie nicht bei jedem update() überschreiben
Wird der Konstruktor mit einer BufferGeometry als Basis gebaut, übernimmt copy() deren drawRange (Zeile 144). Ohne basePool setzt #updateDrawRange() bei jedem update() aber `setDrawRange(0, Infinity)` und verwirft damit eine bewusst eingeschränkte Draw Range der Quelle (etwa eine Geometrie, die nur einen Teil ihres Index zeichnet). Die Doku von update() nennt diese Überschreibung nicht.
Beleg: `} else { this.setDrawRange(0, Infinity); }`
Empfehlung: Ohne basePool die kopierte Draw Range stehen lassen (update() fasst sie dann nicht an), oder die Überschreibung im TSDoc des Konstruktors und von update() nennen.

**READ-007 · low · packages/twopoint5d/src/vertex-objects/VertexAttributeDescriptor.ts:10** (dazu `VertexObjectDescriptor.ts:14`, `VertexObjectBuffer.ts:240`, `alignedAttributeSize.ts:9`, `asInstancedCopySource.ts:10`, `asThreeTypedArray.ts:6`) — Zeilenverweise auf den Quelltext von three aus Kommentaren lösen
Kommentare begründen Layout-Regeln mit Zeilenbereichen in three 0.186.1 (`WebGPUAttributeUtils.js:32–36`, `:202–222`, `:518–541`). Nach dem nächsten three-Bump (jeder ist laut AGENTS.md ein Release) zeigen diese Zeilen ins Leere, und die Begründung der 32-Bit-Aufweitung ist nicht mehr nachprüfbar.
Beleg: `// three 0.186.1 builds no vertex format of one value … (`WebGPUAttributeUtils.js:32–36`, `:518–520`)`
Empfehlung: Statt der Zeilen die Funktion oder Tabelle in three benennen (etwa die Vertex-Format-Tabelle der WebGPU-Attribute-Utils), und die Regel in einem Test festhalten, der bei einem three-Bump anschlägt, falls three den Fall künftig unterstützt.

**READ-008 · low · packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:21** (dazu Z. 33, 54, 118, 169, 212, `InstancedVOBufferGeometry.ts:483`, `:520`, `VOBufferGeometry.ts:119`, `:148`) — Wiederholte Kommentarblöcke der Hot-Path-Accessoren einmal an die Fabrik-Gruppe schreiben
Derselbe fünfzeilige Kommentar (»a vertex object alive in its pool has its buffer …«) steht sechsmal wortgleich in den Accessor-Fabriken; die Begründung für `arguments` statt Rest-Parameter (56 B, Node 24) steht viermal in den Geometrien, dazu zweimal im Pool. Das drückt den Code auf den Kommentar und macht eine Korrektur der Begründung zu einer Suche an zehn Stellen.
Empfehlung: Die Invariante einmal über den Fabriken beschreiben, die Accessoren nur mit einem Einzeiler verweisen; die `arguments`-Begründung an einer benannten Stelle (zum Beispiel docs/architecture.md) festhalten.

## Urteil des Reviewers (Zug 3)

- MEM-005 behoben — `InstancedVOBufferGeometry.ts:482–550`, `VOBufferGeometry.ts:89–118` (frühe Rückkehr, `super.dispose()` im `try`, Abbau im `finally`)
- MEM-006 behoben — `InstancedVOBufferGeometry.ts:314–318` (selbst gebauter Pool vor dem `throw` der Slot-Prüfung disposed)
- MEM-010 behoben — `InstancedVOBufferGeometry.ts:15–23` (`giveUpArray()`) und `:405` (Aufruf in `#detachRoute()`)
- MEM-011 behoben — `InstancedVOBufferGeometry.ts:328–355`, `GeometryAttributeSlots.ts:126–151` (`withdrawRoute()`)
- BUG-028 behoben — `InstancedVOBufferGeometry.ts:618–629`, Tests `vertex-buffers-geometry-updates.spec.ts:1069–1094`
- READ-007 behoben — keine Zeilennummer/Version von three mehr in `src/vertex-objects`, Regeln in `threeVertexLayout.spec.ts`
- READ-008 behoben — Invariante einmal über den Fabriken in `createVertexObjectPrototype.ts`, `arguments`-Begründung in `docs/architecture.md` §2
- Nebenbefund Konstruktoren behoben — `InstancedVOBufferGeometry.ts:150–205`, `InstancedVertexObjectGeometry.ts:32–49`

Kleine Befunde (keine Runde):

- `packages/twopoint5d/CHANGELOG.md:45` — »a pool handed in is no longer counted as attached« liest sich als Vergleich mit der alten Version; besser »is left unattached« (dasselbe »no longer« im Kommentar `InstancedVOBufferGeometry.ts:194–195`, dort aus dem `catch` heraus eindeutig)
- `packages/twopoint5d/docs/resource-lifecycle.md:111–114` — »the pools they build from a descriptor«; der Konstruktor von `InstancedVOBufferGeometry` baut auch aus einer `VertexObjectDescription`
- `InstancedVertexObjectGeometry.ts:22` — Konstruktor ohne eigene TSDoc, die Zusage zum Wurf steht nur an `InstancedVOBufferGeometry`
- `vertex-buffers-geometry-updates.spec.ts:1803–1805` — geänderter Kommentar nicht neu umbrochen
- `GeometryAttributeSlots.ts:139` (`withdrawRoute`) — Zweig für einen Claim, der nicht oben liegt, ungetestet (laut Plan bei angehängter Route nicht erreichbar)
