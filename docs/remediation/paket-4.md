# Paket 4 — vertex-objects: Pool-Kopplung, Index-Stride und Eingabevalidierung

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-073 (medium), BUG-074 (medium), BUG-075 (low), BUG-076 (low), BUG-077 (low)
- Mitgenommen (vorbestehend, gleiche Ursache; Begründung unter »Entscheidungen in Zug 0«):
  - M1 `getter: false` / `setter: false` installiert den Accessor trotzdem, unter dem Property-Namen `"undefined"` (`createVertexObjectPrototype.ts:103-116`)
  - M2 bei `vertexCount` 1 bekommt eine Komponente, die so heißt wie ihr Attribut, keinen Accessor, auch wenn das Attribut mehr als eine Komponente hat (`createVertexObjectPrototype.ts:124`)
  - M3 ein Attribut mit `size` und mehr `components` als `size` erzeugt Komponenten-Accessoren, die in das Nachbarattribut bzw. das nächste Objekt schreiben (`createVertexObjectPrototype.ts:119-135`)
  - M4 der `VOBufferPool`-Konstruktor übernimmt `capacity` (Zahl oder `buffersData.capacity`) ungeprüft; `1.5` ergibt einen Pool, der ein halbes Objekt ausgibt, `NaN` einen Pool mit `usedCount` `NaN` (`VOBufferPool.ts:58-71`)
  - M5 der Setter `usedCount` nimmt `NaN` und gebrochene Werte; `NaN` legt den Pool still, `1.5` lässt `createVO()` ein VO auf Index 1.5 anlegen (`VOBufferPool.ts:84-87`)
- Ziel: Vertex-Object-Pools halten keine verwaisten Objekte, rechnen Indizes mit dem richtigen Stride und weisen fehlgeformte Descriptions, Buffer-Daten und Indizes ab.
- Modell: stärkste Stufe — neun Dateien im Kern der Bibliothek, auf dem jedes Sprite und `map2d` aufsetzen; die Invarianten sind subtil (Hook aus dem Setter, der nie aus dem `super()`-Konstruktor feuern darf; `stripInternal` bei `protected`; atomarer `fromBuffersData()`; eine Namensregel, die den Prototyp exakt spiegeln muss), und der Coverage-Schwellwert für `src/vertex-objects/**` liegt bei 92/84/90/92
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`
  - `packages/twopoint5d/src/vertex-objects/checkBufferArray.ts` (neu, intern)
  - `packages/twopoint5d/src/vertex-objects/createIndicesArray.ts`
  - `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`
  - `packages/twopoint5d/src/vertex-objects/vertexObjectPropertyNames.ts` (neu, intern)
  - `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts`
  - Specs: `createIndicesArray.spec.ts` (neu), `vertexObjectPropertyNames.spec.ts` (neu), `VertexObjectPool.spec.ts`, `VertexObjectBuffer.spec.ts`, `VertexObjectDescriptor.spec.ts`, `VertexObjectGeometry.spec.ts`, `createVertexObjectPrototype.spec.ts` — alle in `packages/twopoint5d/src/vertex-objects/`
  - Browsertest: `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: siehe Abschnitt »Vorgehen« unten — zuerst Schritt 8 (Specs schreiben, rot laufen sehen, Ausgabe in den Report), dann Schritte 1–7, zuletzt Schritt 9
- Verify: `pnpm run ci` (vorher gezielt: `pnpm nx test twopoint5d -- src/vertex-objects`)
- Commit: `fix(vertex-objects): let go of the vertex objects a lower count drops, step each object's indices by its vertex count and refuse descriptions, buffer arrays, capacities and slot indices the layout cannot hold`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · Modul `src/vertex-objects/` seit e352b56 unverändert (`git diff --stat e352b56 HEAD` leer) · BUG-073, BUG-074, BUG-075, BUG-076, BUG-077 unverändert an den Fundstellen des Audits · M1–M5 mitgenommen · Folge aus Paket 3 (`TextureResource.ts:584-594`) als Symptom eingeordnet → Nachtragspaket 9, im Plan hinter Paket 4 · aus »Offene Befunde« nichts mit gleicher Ursache (kein Eintrag berührt `vertex-objects/`) · Restplan: Pakete 5, 6, 7 unberührt, alle Descriptions in Bibliothek, Lookbook und Browsertests halten die neuen Regeln
  - 2026-09-19 Zug 1: Implementierer beauftragt, stärkste Stufe (opus), Effort medium · Brief `paket-4.impl-1.brief.md`, Report `paket-4.impl-1.json`
  - 2026-09-19 Zug 2: Report FERTIG · 7 Quelldateien geändert, neu `checkBufferArray.ts`, `vertexObjectPropertyNames.ts`, `createIndicesArray.spec.ts`, `vertexObjectPropertyNames.spec.ts`; 5 Specs, Browsertest `vertex-objects-gpu-upload.test.js`, CHANGELOG · Rotlauf 30 failed / 194 passed · Arbeitsbaum jetzt schmutzig · 4 Nebenbefunde gemeldet
  - 2026-09-19 Zug 3: Reviewer beauftragt, stärkste Stufe (opus), Effort medium · Diff `paket-4.diff` (1551 Zeilen), Report `paket-4.review-1.json`
  - 2026-09-19 Zug 3: Urteil — BUG-073…077 und M1–M5 behoben, 0 kritisch, 0 wichtig, 1 klein (Prüfreihenfolge Regel 3/4) · commitreif
  - 2026-09-19 Zug 4: keine Runde nötig
  - 2026-09-19 Zug 5: `pnpm run ci` exit=0 (`paket-4.verify.log`) · Commit 4e45acc · Plan auf [x] · 4 Nebenbefunde in »Offene Befunde« (1 → Scope, 2 → Rückfrage, 1 → Audit)

## Abgleich (Zug 0, gegen HEAD d90a308)

- **BUG-073 · unverändert.** `VOBufferPool.ts:84-87` — der Setter klemmt nur, `VOBufferPool.ts:134-136` — `clear()` setzt `usedCount = 0` und sonst nichts; `VertexObjectPool.ts:121-130` (`createVO()` schreibt `#voIndex[idx]`), `:149-159` (`dispose()` entkoppelt als Einziges), `:168-191` (`freeVO()` prüft nur `containsVO()`), `:201-210` (`getVO()` liefert den verwaisten Eintrag aus `#voIndex` auch für `idx >= usedCount`). Das Szenario aus dem Audit läuft so ab wie beschrieben: nach `clear()` + `createVO()` + `freeVO(altesVo1)` steht das lebende VO auf Index 1 und `usedCount` auf 0.
- **BUG-074 · unverändert.** `createIndicesArray.ts:6` — `const stride = Math.max(...indices) + 1;`; `initializeAttributes.ts:37` ruft `createIndicesArray(indices, capacity)`. Die Vertex-Daten liegen mit `descriptor.vertexCount` Vertices pro Objekt (`VertexObjectBuffer.ts:111`, `:155`, `copyWithin()` `:229-235`). Einziger Aufrufer von `createIndicesArray` ist `initializeAttributes.ts` (repo-weit gesucht); die Draw-Range (`VOBufferGeometry.ts:201-206`, `InstancedVOBufferGeometry.ts:608-613`) rechnet mit `indices.length` pro Objekt und bleibt richtig.
- **BUG-075 · unverändert.** `VertexObjectPool.ts:201-210` — `idx < this.usedCount` ist die einzige Prüfung; `resize()` prüft sein Argument (`VertexObjectPool.ts:54-56`).
- **BUG-076 · unverändert.** `VertexObjectBuffer.ts:109-111` und `:153-155` übernehmen `buffersData.buffers[name]` per Referenz ohne Prüfung; `VOBufferPool.ts:218-231` prüft nur `capacity`, setzt `usedCount` vor jeder Array-Prüfung und teilt jedes nicht kürzere Array. Der kürzere Fall ist dokumentiert (`@param copyTypedArrays`, `VOBufferPool.ts:210-212`) und durch die Spec `position: copy (because of smaller array)` in `vertex-buffers-geometry-updates.spec.ts` festgehalten. Die Geometrie übernimmt ein getauschtes Array direkt (`VOBufferGeometry.ts:175`, `InstancedVOBufferGeometry.ts:560`: `bufAttr.array = …`), ein falscher Elementtyp landet also so in three.js.
- **BUG-077 · unverändert.** `VertexAttributeDescriptor.ts:49-51` (`size` 0 bei `components: []`), `VertexObjectDescriptor.ts:35-46` (keine Prüfung), `createVertexObjectPrototype.ts:140-150` (`Object.fromEntries` lässt doppelte Schlüssel stumm kollabieren).

Geprüft gegen die neuen Regeln (alle gültig, keine Anpassung nötig): `BaseSpriteDescriptor` (`sprites/BaseSprite.ts:71`), `TexturedSpriteDescriptor` (`sprites/TexturedSprites/TexturedSprite.ts:59`, trägt `getter: false`), `AnimatedSpriteDescriptor` (`sprites/AnimatedSprites/AnimatedSprite.ts:30`), `TileBaseSpriteDescriptor` und `TileSpriteDescriptor` (`map2d/TileSprites/descriptors.ts:45`, `:72`), Lookbook `CrossDescriptor` (`apps/lookbook/src/demos/crosses/Crosses.ts:110`, 12 Vertices, Index-Maximum 11), `BaseQuadDescriptor`/`InstancedQuadDescriptor` (`apps/lookbook/src/demos/instanced-quads/InstancedQuadsGeometry.ts:49`, `:76`, dazu die Kopie in `apps/lookbook/src/pages/demos/instanced-quads.astro:57-84`), die Descriptions der Browsertests `vertex-objects-*.test.js`. Kein Aufrufer in Bibliothek oder Lookbook senkt `usedCount` oder ruft `clear()` auf einem Pool; keine Unterklasse von `VOBufferPool` außer `VertexObjectPool`; keine Description deklariert `size` und `components` zugleich; keine hat eine Komponente mit dem Namen ihres Attributs.

## Entscheidungen in Zug 0

- **BUG-073, erster Weg der Empfehlung, ohne eigenes `clear()`.** Der protected Hook `onUsedCountShrunk(from, to)` wird aus dem `usedCount`-Setter gerufen; `clear()` schreibt durch genau diesen Setter, ein Override von `clear()` täte dieselbe Arbeit ein zweites Mal. Der zweite Weg (`freeVO()` weist Index `>= usedCount` ab) entfällt nach der Entscheidung »gilt der erste«: er verhindert nur die Verschiebung in `freeVO()`, nicht das Aliasing zweier VOs auf einem Slot. Kein Breaking Change im Sinne der Entscheidung: ein VO in einem Slot, den der Pool nicht mehr zählt, teilte sich den Slot mit dem nächsten `createVO()`; `resize()` entkoppelt in derselben Lage schon heute (`VertexObjectPool.ts:97-104`, TSDoc `:45-47`). Die Daten im Buffer bleiben stehen; wer einen Slot über ein Senken hinweg behalten will, hält den Index und holt sich mit `getVO(i)` ein VO, sobald der Zähler ihn wieder deckt — das gehört in den Migration Guide.
- **BUG-076, Länge in `fromBuffersData()` höchstens, nicht genau.** Die Empfehlung (`length === capacity * vertexCount * itemSize` an beiden Stellen) bräche den dokumentierten und per Spec festgehaltenen Pfad »kürzeres Array wird kopiert«. Deshalb: Konstruktor-Pfad (Array wird per Referenz übernommen) verlangt die exakte Länge, `fromBuffersData()` höchstens die Layout-Länge. Der Typ wird an beiden Stellen verlangt — auch beim Kopieren, denn ein Payload mit anderem Elementtyp ist ein falscher Payload. Typvergleich über den Namen (`Object.prototype.toString`) statt `instanceof`, damit ein Array aus einem anderen Realm (Worker, iframe) erkannt wird — genau die Quelle, die das Audit nennt.
- **BUG-077, Namensregel als eigene Funktion, gegen den Prototyp festgenagelt.** Die Eindeutigkeitsprüfung braucht die Namen, die `createVertexObjectPrototype()` erzeugen wird, aber schon im Descriptor-Konstruktor (Empfehlung), wo es noch keinen Buffer gibt. Die Namen hängen nur von der Description ab. Sie entstehen in einer neuen internen Funktion `vertexObjectPropertyNames()`; eine Spec vergleicht deren Ergebnis mit den eigenen Properties von `descriptor.voPrototype`, damit beide Regeln nicht auseinanderlaufen.
- **M1 und M2 mitgenommen**, weil die neue Namensfunktion sonst einen Defekt als Regel festschriebe: sie spiegelt den Prototyp, und der trägt heute einen Namen, den keine Description deklariert (`"undefined"`, M1), und lässt einen weg, den eine deklariert (M2). Beide sitzen in `createVertexObjectPrototype.ts:93-135`, also in der Funktion, deren Ausgabe BUG-077 prüft; ohne M1 müsste die Prüfung zwei Attribute mit `getter: false` als Kollision abweisen oder die Spec `"undefined"` ausnehmen.
- **M3 mitgenommen** als weitere Regel des BUG-077-Validators: gleiche Ursache (eine fehlgeformte Description zeigt sich erst als falsche Pixel), `size`-Regel desselben Attributs.
- **M4 und M5 mitgenommen** mit BUG-075/076: gleiche Ursache (Einstiegspunkte des Pools nehmen Zahlen, die kein Slot-Zähler sein können; `resize()` prüft, Konstruktor und Setter nicht). Die Längenprüfung aus BUG-076 rechnet mit `capacity`, und der Hook aus BUG-073 iteriert Slots von `to` bis `from` — beide sind nur für ganze Zahlen richtig.
- **Browsertest nur für BUG-074.** BUG-074 ändert den Inhalt des Index-Buffers, der auf die GPU geht. Alle übrigen Änderungen entscheiden, welche Eingabe angenommen und welches VO an den Buffer gekoppelt bleibt; für angenommene Eingaben geht dasselbe auf die GPU wie vorher, und die bestehenden Browsertests `vertex-objects-buffers-data.test.js`, `vertex-objects-gpu-upload.test.js`, `vertex-objects-dispose.test.js` decken diese Pfade und müssen grün bleiben.
- **Fehlertypen:** `RangeError` für Zahlen, die eine Regel verletzen (Zähler, Indizes, `size`, `vertexCount`, `meshCount`, Array-Länge), `TypeError` für einen falschen Array-Typ, `Error` für doppelte Property-Namen und für die Kapazität (Text wie in `resize()`). Jede Meldung nennt Klasse bzw. Methode, das betroffene Attribut bzw. den Buffer und den erhaltenen Wert.

## Vorgehen

Alle Pfade relativ zu `packages/twopoint5d/src/vertex-objects/`, sofern nicht anders genannt.

### 1. `VOBufferPool.ts` — Kapazität, Zähler, Hook, `fromBuffersData()` (BUG-073, BUG-076, M4, M5)

1. Konstruktor: direkt nach der Zuweisung von `this.descriptor` (dessen eigene Prüfung aus Schritt 7 läuft zuerst) die Kapazität prüfen — `typeof capacityOrData === 'number' ? capacityOrData : capacityOrData.capacity`; ist sie keine ganze Zahl ≥ 0, `throw new Error('Capacity must be a non-negative integer')` (derselbe Text wie `VertexObjectPool#resize()`), bevor ein `VertexObjectBuffer` gebaut wird.
2. Setter `usedCount` (Zeile 84-87) wird zu:
   ```ts
   set usedCount(value: number) {
     // ±Infinity is clamped like any other value out of range; a fraction or NaN names no slot
     if (Number.isNaN(value) || (Number.isFinite(value) && !Number.isInteger(value))) {
       throw new RangeError(`VOBufferPool#usedCount must be an integer, got ${value}`);
     }
     if (this.#disposed) return;
     const previous = this.#usedCount;
     this.#usedCount = Math.max(0, Math.min(value, this.capacity));
     if (this.#usedCount < previous) {
       this.onUsedCountShrunk(previous, this.#usedCount);
     }
   }
   ```
   Die Prüfung steht vor dem Disposed-Zweig: `docs/resource-lifecycle.md` verlangt, dass ungültige Eingabe auch auf einem entsorgten Objekt abgewiesen wird. TSDoc des Setters ergänzen: wirft `RangeError` für `NaN` und Brüche; ein niedrigerer Wert gibt auf einem `VertexObjectPool` jedes Vertex Object in den fallengelassenen Slots frei (wie `freeVO()`: jedes weitere Lesen oder Schreiben darüber schlägt fehl), die Daten im Buffer bleiben stehen.
3. Neuer Hook direkt unter `setCapacity()`, Muster wie dort:
   ```ts
   /**
    * Called by the `usedCount` setter once the count has gone down from `_from` to `_to`: the
    * slots `_to` … `_from - 1` hold no vertex object in use any more. Never called while the
    * constructor runs — the count only rises there, before a subclass has its own fields — and
    * never on a disposed pool.
    *
    * @internal
    */
   protected onUsedCountShrunk(_from: number, _to: number): void {}
   ```
   `@internal` ist Pflicht: das Repo baut mit `stripInternal` (`tsconfig.json:41`), und die Override in `VertexObjectPool` trägt es ebenfalls (Schritt 2.1), sonst steht die Methode in der `.d.ts` der Unterklasse ohne ihre Basis. Unterstrich-Präfix wegen `argsIgnorePattern: '^_'` in `eslint.config.mjs`.
4. `clear()` bleibt `this.usedCount = 0;`. TSDoc neu: setzt `usedCount` auf `0`; die Buffer behalten ihre Daten und werden nicht freigegeben; auf einem `VertexObjectPool` wird jedes bisher ausgegebene Vertex Object freigegeben (Verweis auf den Setter). Der bestehende Satz zu entsorgten Pools bleibt. Den Satz in der TSDoc von `dispose()` (»In contrast to {@link clear} (which only resets `usedCount` to `0`)«) so anpassen, dass er stimmt: `clear()` gibt keinen Speicher frei.
5. `fromBuffersData()` (Zeile 214-233), neue Reihenfolge: Disposed-Prüfung (wie jetzt) → Kapazitätsprüfung (wie jetzt) → **alle** Einträge von `buffersData.buffers`, deren Name `this.buffer.buffers` kennt, mit `checkBufferArray('VOBufferPool#fromBuffersData()', bufferName, typedArray, buffer.dataType, this.capacity * this.descriptor.vertexCount * buffer.itemSize, 'at-most')` prüfen → dann `this.usedCount = buffersData.usedCount` (kann für `NaN`/Bruch werfen; bis hierher ist nichts geschrieben) → dann die bestehende Kopier-/Teile-Schleife unverändert. Ein Name, den das Layout nicht kennt, wird weiter übergangen. TSDoc ergänzen: jedes Array muss den Typed-Array-Typ seines Buffers haben und darf höchstens `capacity × vertexCount × itemSize` Elemente lang sein; ein kürzeres wird kopiert (wie dokumentiert); ein Array, das eine Regel verletzt, wirft, bevor irgendetwas am Pool geändert ist.

### 2. `VertexObjectPool.ts` — Hook-Override und `getVO()` (BUG-073, BUG-075)

1. Override, zwischen `containsVO()` und `dispose()`:
   ```ts
   /** @internal */
   protected override onUsedCountShrunk(from: number, to: number): void {
     for (let i = to; i < from; i++) {
       const vo = this.#voIndex[i];
       if (vo != null) {
         VOUtils.clearBuffer(vo);
         this.#voIndex[i] = undefined;
       }
     }
   }
   ```
   Nur in einen Slot schreiben, der ein VO hält: `resize()` ruft den Setter, nachdem `#voIndex` durch ein Array der neuen Kapazität ersetzt ist (Zeile 106-111); ein Schreiben jenseits davon verlängerte das Array. Einen Inline-Kommentar dazu.
2. `freeVO()`: Reihenfolge nicht ändern. Die Slot-Buchhaltung (Zeile 174-186) leert `#voIndex[lastUsedIdx]` vor `this.usedCount--`, der Hook findet dort also nichts mehr. Kein Code-Eingriff, nur nicht umstellen.
3. `getVO()` (Zeile 201-210): nach der Disposed-Zeile
   `if (!Number.isInteger(idx) || idx < 0 || idx >= this.usedCount) return undefined;`
   und danach `let vo = this.#voIndex[idx]; if (vo == null) { … }` (die Bedingung `idx < this.usedCount` ist dann schon erfüllt). TSDoc: `undefined` für einen Index, der keine ganze Zahl in `0` … `usedCount - 1` ist, und auf einem entsorgten Pool.
4. `dispose()` und `resize()` bleiben unverändert (`dispose()` schreibt `#usedCount` direkt, der Hook feuert dort nicht; das Entkoppeln erledigt `dispose()` selbst).

### 3. `checkBufferArray.ts` (neu, intern, nicht in `public-api.ts`) — BUG-076

```ts
import type {VertexAttributeDataType} from './types.js';

const TYPED_ARRAY_NAMES: Record<VertexAttributeDataType, string> = {
  float64: 'Float64Array',
  float32: 'Float32Array',
  float16: 'Float16Array',
  uint32: 'Uint32Array',
  int32: 'Int32Array',
  uint16: 'Uint16Array',
  int16: 'Int16Array',
  uint8clamped: 'Uint8ClampedArray',
  uint8: 'Uint8Array',
  int8: 'Int8Array',
};

export function checkBufferArray(
  owner: string,
  bufferName: string,
  array: unknown,
  dataType: VertexAttributeDataType,
  layoutLength: number,
  lengthRule: 'exact' | 'at-most',
): void
```

- Typ: erwartet `TYPED_ARRAY_NAMES[dataType]`; tatsächlich `ArrayBuffer.isView(array) ? Object.prototype.toString.call(array).slice(8, -1) : Array.isArray(array) ? 'Array' : array === null ? 'null' : typeof array`. Weicht er ab: `throw new TypeError(`${owner}: buffer "${bufferName}" holds ${dataType} data and takes a ${expected}, got ${actual}`)`. Ein Kommentar sagt, warum über den Namen verglichen wird (ein Array aus einem Worker oder einem anderen Realm besteht keinen `instanceof`).
- Länge (`array` ist ab hier ein Typed Array): `'exact'` und `length !== layoutLength` → `throw new RangeError(`${owner}: buffer "${bufferName}" takes exactly ${layoutLength} elements (capacity × vertexCount × itemSize), got ${length}`)`; `'at-most'` und `length > layoutLength` → dieselbe Meldung mit `at most`.
- TSDoc an der Funktion: was sie prüft, beide Regeln, beide Fehlertypen.

### 4. `VertexObjectBuffer.ts` — Konstruktor (BUG-076)

1. In beiden Zweigen (Zeile 103-114 und 150-157): ist `buffersData?.buffers[bufferName]` definiert, vor der Zuweisung `checkBufferArray('VertexObjectBuffer', bufferName, array, buffer.dataType, this.capacity * this.descriptor.vertexCount * buffer.itemSize, 'exact')`. Ein nicht genannter Name bekommt weiter ein frisches Array.
2. TSDoc des Konstruktors (Zeile 63-79) ergänzen: jedes Array in `buffersData` muss den Typed-Array-Typ seines Buffers haben und genau `capacity × vertexCount × itemSize` Elemente lang sein, sonst wirft der Konstruktor (`TypeError` bzw. `RangeError`, mit dem Buffer-Namen). Der Absatz »takes `buffersData.capacity` as given and checks it against nothing« bleibt für die Kapazität wahr und bleibt stehen.

### 5. `createIndicesArray.ts` und `initializeAttributes.ts` (BUG-074)

1. Signatur `export function createIndicesArray(indices: number[], count: number, stride: number): Uint32Array`; die Zeile `const stride = Math.max(...indices) + 1;` entfällt; Rest unverändert. TSDoc: `stride` ist die Zahl der Vertices eines Objekts — der Abstand zwischen den Vertices eines Objekts und denen des nächsten in jedem Attribut-Buffer; der Descriptor garantiert, dass jeder Index darunter liegt.
2. `initializeAttributes.ts:37`: `createIndicesArray(indices, capacity, descriptor.vertexCount)`.

### 6. `vertexObjectPropertyNames.ts` (neu, intern) und `createVertexObjectPrototype.ts` (BUG-077, M1, M2)

1. `createVertexObjectPrototype.ts:103-116`: den Getter-Eintrag nur pushen, wenn `attr.getterName != null`, den Setter-Eintrag nur, wenn `attr.setterName != null` (M1).
2. `createVertexObjectPrototype.ts:124`: Bedingung `descriptor.vertexCount > 1 || attr.size > 1 || component !== attr.name` (M2). Übersprungen wird eine Komponente nur noch, wenn sie mit dem Attribut-Accessor aus Zeile 93-101 zusammenfällt (ein Vertex, `size` 1, gleicher Name — derselbe Slot). Kommentar dazu.
3. Neue Datei, spiegelt Schritt 6.1/6.2 exakt:
   ```ts
   import type {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';

   export interface VertexObjectPropertyName {
     name: string;
     /** `attribute "<name>"` or `methods` */
     origin: string;
   }

   export function vertexObjectPropertyNames(
     attributes: Iterable<VertexAttributeDescriptor>,
     vertexCount: number,
     methods: object | null | undefined,
   ): VertexObjectPropertyName[]
   ```
   Regeln, je Attribut `attr` in Einfügereihenfolge, `origin` = `attribute "${attr.name}"`:
   - `vertexCount === 1 && attr.size === 1` → `attr.name`; sonst `attr.getterName` und `attr.setterName`, jeweils nur, wenn definiert
   - bei `attr.hasComponents`: für jede Komponente `c` und jeden `vertexIndex` in `0` … `vertexCount - 1`, sofern `vertexCount > 1 || attr.size > 1 || c !== attr.name` → `${c}${vertexCount === 1 ? '' : vertexIndex}`
   - danach jeder Schlüssel aus `Object.entries(methods ?? {})` mit Funktionswert, `origin` = `methods`
   TSDoc: die Namen, die `createVertexObjectPrototype()` als eigene Properties anlegt, in derselben Regel; wer eine ändert, ändert beide (die Spec aus Schritt 8.6 hält sie zusammen).

### 7. `VertexObjectDescriptor.ts` — Validierung (BUG-077, M3)

Am Ende des Konstruktors (nach `this.methods = description.methods;`) eine private Methode `#validate()` aufrufen. Regeln in dieser Reihenfolge, der erste Verstoß wirft:

1. `description.vertexCount != null` und nicht (`Number.isInteger` und `>= 1`) → `RangeError('VertexObjectDescriptor: vertexCount must be a positive integer, got <wert>')`
2. dasselbe für `meshCount`
3. je Attribut (`this.attributes`): `attr.size` keine ganze Zahl `>= 1` → `RangeError('VertexObjectDescriptor: attribute "<name>" needs a size of at least 1 (a positive integer size or at least one component), got <size>')` (deckt `components: []`, `size: 0`, `size: 1.5`)
4. je Attribut, dessen rohe Description (`description.attributes[name]`) `size` (nicht `null`/`undefined`) **und** `components` deklariert: `components.length > size` → `RangeError('VertexObjectDescriptor: attribute "<name>" declares <n> components for a size of <size>')` (M3). Weniger Komponenten als `size` bleiben erlaubt (Auffüllen auf eine Ausrichtung).
5. je Eintrag `i` an Position `j` von `this.indices`: nicht (`Number.isInteger(i)` und `0 <= i < this.vertexCount`) → `RangeError('VertexObjectDescriptor: index <i> at position <j> must be an integer in 0 … <vertexCount - 1>')`
6. `vertexObjectPropertyNames(this.attributes.values(), this.vertexCount, this.methods)` in eine `Map<name, origin>` einlesen; ein Name, der schon drinsteht → `Error('VertexObjectDescriptor: the vertex object property "<name>" comes from both <origin1> and <origin2>')`

TSDoc des Konstruktors: die sechs Regeln als Liste und `@throws`. `VertexAttributeDescriptor` bleibt ohne eigene Prüfung (er wird auch einzeln gebaut, siehe `VertexAttributeDescriptor.spec.ts`).

### 8. Specs — zuerst schreiben, rot sehen (Ausgabe in den Report), dann Schritte 1–7

Rotlauf: `pnpm nx test twopoint5d -- src/vertex-objects`. Guard-Specs (unten mit »Wächter« markiert) dürfen schon vorher grün sein.

1. `createIndicesArray.spec.ts` (neu): `createIndicesArray([0, 1, 2], 3, 4)` → `[0, 1, 2, 4, 5, 6, 8, 9, 10]` (rot: vorher fehlt der Parameter, der Stride ist 3); Wächter `createIndicesArray([0, 2, 1, 0, 3, 2], 2, 4)` → `[0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6]`.
2. `VertexObjectGeometry.spec.ts`: `a description whose indices leave a vertex unused draws every object from its own vertices` — `new VertexObjectGeometry({vertexCount: 4, indices: [0, 1, 2], attributes: {position: {components: ['x', 'y', 'z']}}}, 2)`, `Array.from(geometry.index!.array)` gleich `[0, 1, 2, 4, 5, 6]` (vorher `[0, 1, 2, 3, 4, 5]`).
3. `VertexObjectPool.spec.ts`, neues `describe('a count that goes down')`:
   - `clear() lets go of every vertex object it handed out`: 3× `createVO()` (vo0–vo2), `clear()`, `const live = pool.createVO()!`, `pool.freeVO(vo1)` → `VOUtils.getIndex(live)` ist `0`, `pool.usedCount` ist `1`, `pool.containsVO(vo0|vo1|vo2)` alle `false`, `VOUtils.hasBuffer(vo0)` `false`, `pool.getVO(0)` ist `live`
   - `a lower usedCount lets go of the vertex objects above it`: 3 VOs mit Werten, `pool.usedCount = 1` → vo0 gekoppelt, vo1/vo2 nicht; `pool.usedCount = 3` → `pool.getVO(1)` ist ein neues Objekt (`not.toBe(vo1)`) und liest die Werte, die vo1 geschrieben hatte (die Daten bleiben im Buffer)
   - `fromBuffersData() with a lower usedCount lets go of the vertex objects above it`
   - Wächter: `a count that goes up keeps every vertex object` (`usedCount` hochsetzen, alle VOs bleiben gekoppelt)
   - `usedCount refuses NaN and a fraction` (`RangeError`, Zähler unverändert; auch auf einem entsorgten Pool); Wächter `usedCount clamps Infinity to the capacity and -Infinity to 0`
   - `getVO() answers undefined for an index that names no used slot`: `-1`, `0.5`, `NaN`, `usedCount` → `undefined`; nach `getVO(-1)` hat ein folgendes `createVO()` Index 0 und `usedCount` ist 1
   - `a pool refuses a capacity that is not a non-negative integer`: `new VertexObjectPool(desc, 1.5)`, `-1`, `NaN`, und mit `{...pool.toBuffersData(), capacity: 1.5}` → wirft `'Capacity must be a non-negative integer'`
   - `fromBuffersData() refuses an array of another type and leaves the pool as it was` (`Uint32Array` für einen `float32`-Buffer, anderer `usedCount` im Payload → `TypeError` mit Buffer-Namen; `usedCount` und `pool.buffer.buffers.get(name)!.typedArray` unverändert)
   - `fromBuffersData() refuses an array longer than the layout and leaves the pool as it was` (`RangeError`)
4. `VertexObjectBuffer.spec.ts`, für beide Konstruktor-Zweige (aus einem Descriptor, aus einem Quell-Buffer): falscher Typ → `TypeError` mit Buffer-Namen; zu kurz und zu lang → `RangeError`; Wächter: ein Typed Array aus einem anderen Realm wird angenommen (`vm.runInNewContext('new Float32Array(<n>)')` aus `node:vm`; Vitest läuft hier in der Node-Umgebung).
5. `VertexObjectDescriptor.spec.ts`, eine Spec je Regel aus Schritt 7: `vertexCount` 0 / 1.5 / -1; `meshCount` 0; `components: []`; `size: 0`; `size: 1.5`; `{size: 1, components: ['a', 'b', 'c']}`; Index `>= vertexCount`, negativ, gebrochen; zwei Attribute mit Komponente `x`; `components: ['x', 'x']`; ein `methods`-Schlüssel gleich einem generierten Accessor (`setPos`). Wächter: `BaseSpriteDescriptor`, `TexturedSpriteDescriptor`, `AnimatedSpriteDescriptor`, `TileBaseSpriteDescriptor`, `TileSpriteDescriptor` bauen ohne Wurf; zwei Attribute mit `getter: false` kollidieren nicht; `{size: 4, components: ['x', 'y', 'z']}` ist erlaubt.
6. `vertexObjectPropertyNames.spec.ts` (neu): für jede dieser Descriptions ist `Object.getOwnPropertyNames(descriptor.voPrototype)` (nach `new VertexObjectBuffer(descriptor, 1)`) sortiert gleich den sortierten Namen aus `vertexObjectPropertyNames()`: `TexturedSpriteDescriptor`, `BaseSpriteDescriptor`, eine mit `vertexCount` 1 und einem `size`-1-Attribut, eine mit `{rotation: {components: ['rotation']}}`, eine mit `{foo: {components: ['foo', 'bar']}}`, eine mit `getter`/`setter` als String, eine mit `methods`. Der Fall `TexturedSpriteDescriptor` ist vor Schritt 6.1 rot (`"undefined"`), der Fall `foo` vor Schritt 6.2.
7. `createVertexObjectPrototype.spec.ts`: `an attribute declared without a getter gets none` — der Prototyp von `{vertexCount: 1, attributes: {color: {components: ['r', 'g'], getter: false}}}` hat kein `"undefined"` und kein `getColor`, aber `setColor`, `r`, `g`; `a component named like its attribute gets its accessor` — `{vertexCount: 1, attributes: {foo: {components: ['foo', 'bar']}}}`: `vo.foo = 3` landet im Buffer (`vo.getFoo()[0]` ist `3`).
8. Browsertest in `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js`, neues `it('an object whose indices leave a vertex unused is drawn from its own vertices', …)` nach dem Muster der bestehenden Fälle: Description `{vertexCount: 4, indices: [0, 1, 2], attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}}}`, `new VertexObjectGeometry(description, 2)`, zwei VOs mit `setPosition([...])`, `mesh.update()`, rendern, `await display.nextFrame()`, dann `Array.from(new Uint32Array(await display.renderer.getArrayBufferAsync(geometry.index)))` → die ersten sechs Werte sind `[0, 1, 2, 4, 5, 6]`. Der Browsertest läuft gegen `dist`; rot vor dem Fix ist erwünscht (`pnpm build:twopoint5d`, dann `pnpm test:browser`), aber nicht Pflicht. Liest ein Backend den Index-Buffer nicht zurück, im Report melden (`FERTIG_MIT_VORBEHALT`), nicht auf eine CPU-seitige Prüfung ausweichen.

Der Coverage-Schwellwert für `src/vertex-objects/**` (`vite.config.ts`) muss halten; die Specs oben decken jeden neuen Zweig.

### 9. CHANGELOG — Skill `updating-changelog`, unter `## [Unreleased]` in `packages/twopoint5d/CHANGELOG.md`

- `### Fixed`: der Index-Buffer eines Objekts beginnt bei `i × vertexCount`, auch wenn seine `indices` einen Vertex nicht referenzieren; `clear()` und ein niedrigerer `usedCount` geben die Vertex Objects der fallengelassenen Slots frei, ein neues Vertex Object teilt sich keinen Slot mit einem alten; `getVO()` antwortet `undefined` für einen Index, der keinen benutzten Slot nennt; `getter: false`/`setter: false` legen keine Property an; eine Komponente, die wie ihr Attribut heißt, bekommt ihren Accessor.
- `### Changed`: `new VertexObjectDescriptor()` (und damit jeder Pool und jede Geometrie aus einer Description) weist eine fehlgeformte Description ab — die sechs Regeln; `VertexObjectBuffer` und `VOBufferPool#fromBuffersData()` prüfen jedes Array aus `buffersData` auf Typ und Länge; der Pool-Konstruktor verlangt eine ganzzahlige Kapazität ≥ 0; `usedCount` wirft für `NaN` und Brüche.
- `### Migration Guide`, Abschnitte in der Form der bestehenden: »A vertex object description is checked when its descriptor is built« · »A lower `usedCount` lets go of the vertex objects above it« (Weg: den Index halten, `getVO(i)` gibt ein Vertex Object für den Slot, sobald der Zähler ihn wieder deckt) · »Buffers data has to fit the layout it is handed to«. Ob `usedCount`/Kapazität einen eigenen Abschnitt brauchen, entscheidet der Skill.
- Konvention »kein Rückblick«: Einträge und Abschnitte beschreiben das Verhalten, das jetzt gilt, und was aufrufender Code tun muss — kein »früher«, »no longer«, »now« als Gegenüberstellung zum Vorzustand (Paket 3 brauchte dafür eine zweite Runde).

## Findings im Volltext

**BUG-073 · medium · packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:84-87, 134-136; VertexObjectPool.ts:121-130, 168-191** — Verfolgte Vertex-Objekte entkoppeln, wenn clear() oder ein niedrigerer usedCount ihre Slots fallen lässt
`VertexObjectPool.dispose()` entkoppelt jedes verfolgte VO, aber `clear()` und ein Write nach unten auf `usedCount` — die naheliegenden »alle Sprites entfernen«-Aufrufe — lassen `#voIndex` und jedes `vo[voBuffer]` intakt. Nachvollzogen: 3× `createVO()`, `clear()`, `createVO()` → das neue VO und das alte vo0 sitzen beide auf Index 0 und aliasieren denselben Slot; ein folgendes `freeVO(vo1)` (alt, aber noch `containsVO`) nimmt den else-Zweig mit `lastUsedIdx = 0`, verschiebt das *lebende* VO auf Index 1 (außerhalb des Draw-Range) und senkt `usedCount` unter das, was tatsächlich ausgegeben wurde. Stumm, kein Wurf.
Empfehlung: `clear()` in `VertexObjectPool` überschreiben (alle VOs entkoppeln, `#voIndex` zurücksetzen) und `VOBufferPool` einen protected Hook (`onUsedCountShrunk(from, to)`) geben, mit dem die Subklasse VOs in `[to, from)` entkoppelt; alternativ `freeVO()` ein VO mit Index `>= usedCount` abweisen lassen. Spec: VOs anlegen, `clear()`, erneut anlegen, ein altes freigeben, Index des lebenden VO und `usedCount` prüfen.

**BUG-074 · medium · packages/twopoint5d/src/vertex-objects/createIndicesArray.ts:3-10; initializeAttributes.ts:35-39** — Den Index-Buffer-Stride aus vertexCount ableiten, nicht aus max(indices)+1
Die Vertex-Daten liegen mit `descriptor.vertexCount` Vertices pro Objekt (VertexObjectBuffer.ts:112/156), der Objekt-Offset im Index-Buffer ist aber `Math.max(...indices) + 1`. Jede Description, deren Indizes ihren letzten Vertex nicht referenzieren (`vertexCount: 4, indices: [0,1,2]` oder ein zusätzlicher ungenutzter Vertex), zeichnet Objekt *i* ≥ 1 aus den falschen Vertices — stumm. Alle Descriptions im Repo erfüllen zufällig `max+1 === vertexCount` (BaseSprite, TileSprites, Crosses mit 12), und es gibt keine Spec für `createIndicesArray`.
Empfehlung: `descriptor.vertexCount` als dritten Parameter `stride` übergeben; `VertexObjectDescriptor` einen Index `>= vertexCount` bei der Konstruktion abweisen lassen. Spec mit einer Description, deren Indizes einen Vertex unreferenziert lassen.

**BUG-075 · low · packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:201-210** — Den an getVO() übergebenen Index validieren
`-1 < usedCount` und `1.5 < usedCount` passieren beide, ein negativer oder gebrochener Index materialisiert also ein VO mit diesem Index: Writes darüber gehen auf negative/gebrochene TypedArray-Offsets (stumm verworfen), `#voIndex[-1]` wird eine Streu-Property, und ein späteres `freeVO()` davon führt `copyWithin(-1 * …)` aus — ein negatives `target` zählt vom Ende und überschreibt die Daten des letzten Objekts. `resize()` (Zeile 54-56) validiert sein Integer-Argument, `getVO()` nicht.
Empfehlung: `if (!Number.isInteger(idx) || idx < 0 || idx >= this.usedCount) return undefined;` (der deklarierte Typ lässt Abwesenheit zu) und eine Spec für `getVO(-1)` / `getVO(0.5)`.

**BUG-076 · low · packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:109-113, 153-156; VOBufferPool.ts:218-231** — buffersData-Arrays gegen das Layout prüfen, an das sie übergeben werden
`fromBuffersData()` prüft `capacity` (eine Zahl im Payload), nie die Arrays: ein `Float32Array` für einen `uint32`-Buffer oder ein Array länger als das Layout wird per Referenz übernommen; der Konstruktor-Pfad übernimmt jede Länge und jeden Typ ohne den Kapazitäts-Check. Der GPU-Buffer des Renderers behält seine Größe, ein längeres Array funktioniert nur, weil `updateUpdateRange` den Range klemmt; ein falscher Elementtyp füttert den Shader stumm mit Müll. `toBuffersData()`→Worker→`fromBuffersData()` ist der dokumentierte Transferpfad, Payloads aus einem anderen Realm sind die realistische Quelle.
Empfehlung: An beiden Stellen `typedArray.length === capacity * vertexCount * itemSize` und den Konstruktor (bzw. `BYTES_PER_ELEMENT` + dataType-Map) prüfen und mit dem Buffer-Namen werfen; Specs für falsche Länge und falschen Typ.

**BUG-077 · low · packages/twopoint5d/src/vertex-objects/VertexAttributeDescriptor.ts:49-51; VertexObjectDescriptor.ts:35-46; createVertexObjectPrototype.ts:140-150** — Fehlgeformte Descriptions bei der Konstruktion des VertexObjectDescriptors abweisen
Nichts wird validiert: `components: []` ergibt `size` 0 (`??` fängt 0 nicht) und einen `InterleavedBuffer` mit Stride 0 (NaN-`count` in three); zwei Attribute, die beide eine Komponente `x` deklarieren (oder ein `methods`-Schlüssel gleich einem generierten Accessor), kollabieren stumm in `Object.fromEntries`, ein Attribut wird unerreichbar; ein Index `>= vertexCount` wird akzeptiert (siehe BUG-074). All das zeigt sich Frames später als falsche Pixel statt am Descriptor.
Empfehlung: Ein `validate()`-Schritt im `VertexObjectDescriptor`-Konstruktor: `size >= 1`, eindeutige Accessor-/Komponentennamen über alle Attribute, `indices` in `[0, vertexCount)`, `vertexCount`/`meshCount` positive Integer. Eine Spec pro Regel.

## Urteil des Reviewers (Zug 3, `paket-4.review-1.json`)

- **BUG-073** behoben — `VOBufferPool.ts:104-114` (Setter ruft `onUsedCountShrunk`), `VOBufferPool.ts:42` (Hook, `@internal`), `VertexObjectPool.ts:145-155` (Override); `clear()` läuft durch den Setter, im Konstruktor feuert der Hook nie
- **BUG-074** behoben — `createIndicesArray.ts:11`, `initializeAttributes.ts:37`; Browsertest `vertex-objects-gpu-upload.test.js:149-170`
- **BUG-075** behoben — `VertexObjectPool.ts:216`
- **BUG-076** behoben — `checkBufferArray.ts`, `VertexObjectBuffer.ts:178-191` (`'exact'`), `VOBufferPool.ts:256-269` (`'at-most'`, atomar vor jedem Schreiben)
- **BUG-077** behoben — `VertexObjectDescriptor.ts:66-110`, `vertexObjectPropertyNames.ts`, festgehalten durch `vertexObjectPropertyNames.spec.ts`
- **M1** behoben — `createVertexObjectPrototype.ts:103-121`
- **M2** behoben — `createVertexObjectPrototype.ts:131`, gespiegelt in `vertexObjectPropertyNames.ts:37`
- **M3** behoben — `VertexObjectDescriptor.ts:86-91`
- **M4** behoben — `VOBufferPool.ts:71-74`
- **M5** behoben — `VOBufferPool.ts:105-108`

Kleine Befunde:
- `VertexObjectDescriptor.ts:79-92` — Regeln 3 und 4 laufen je Attribut verschränkt; verletzt das erste Attribut Regel 4 und ein späteres Regel 3, wirft Regel 4 zuerst, abweichend von »der erste Verstoß in Regelreihenfolge« in Plan und TSDoc. Wirkung nur auf die Fehlermeldung.

Abweichungen des Implementierers (angenommen): `describeArray()` als Hilfsfunktion in `checkBufferArray.ts`; `#takeOrCreateArray()` in `VertexObjectBuffer.ts`, ein `null`-Eintrag in `buffersData.buffers` bekommt ein frisches Array; zusätzliche Spec `says where each name comes from`; Kapazität und `usedCount` ohne eigenen Migrationsabschnitt; Browsertest nicht gegen altes `dist` rot gesehen, stattdessen mit alter Erwartung rot gegengeprüft.

Nebenbefunde, Begründung der Urteile:
- `VertexObjectBuffer.ts:85` capacity ungeprüft → Scope: Korrektheitsdefekt (unbenannter Wurf statt Prüfung), die Scope-Regel nimmt jede Severity.
- `VertexObjectDescriptor.ts:55` Description per Referenz → Rückfrage: ob Mutieren nach dem Bau erlaubt ist, entscheidet die API-Absicht, nicht der Code.
- `VertexObjectDescriptor.ts:125` `TODO remove?!` → Audit: Doku, kein Bug.
- `createVertexObjectPrototype.ts:157` Überschatten des `basePrototype` → Rückfrage: Prototypkette kann gewollter Override-Weg sein.
