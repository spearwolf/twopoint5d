# Paket 1 — Vertex Objects: Descriptor-Validierung, Setter-Semantik, Tests und Doku

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-123 (low), BUG-124 (low), BUG-125 (low), BUG-126 (low), BUG-127 (low), TEST-050 (low), DOC-074 (low), READ-023 (info)
- Ziel: Ungültige Vertex-Layouts scheitern früh mit klarer Meldung, Setter und Kopierpfade verhalten sich an ihren Rändern konsistent, und Tests wie Doku belegen es.
- Modell: mittlere Stufe
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`, sofern nicht anders genannt):
  - `src/vertex-objects/VertexObjectDescriptor.ts`
  - `src/vertex-objects/sharedVertexObjectDescriptor.ts`
  - `src/vertex-objects/VOBufferPool.ts`
  - `src/vertex-objects/VertexObjectBuffer.ts`
  - `src/vertex-objects/createVertexObjectPrototype.ts`
  - `src/vertex-objects/types.ts`
  - `src/vertex-objects/VertexObjectDescriptor.spec.ts`
  - `src/vertex-objects/VertexObjectBuffer.spec.ts`
  - `src/vertex-objects/VertexObjectPool.spec.ts`
  - `src/vertex-objects/createVertexObjectPrototype.spec.ts`
  - `src/vertex-objects/VertexObjectGeometry.spec.ts`
  - `docs/architecture.md`
  - `CHANGELOG.md` (nur `[Unreleased]`)
  - jede weitere Spec oder Browser-Fixture, deren Beschreibung die neuen Regeln abweisen (siehe Schritt 8)
- Verify: `pnpm run ci` (aus dem Repo-Root; schnelle Vorprüfung während der Arbeit: `pnpm nx test twopoint5d -- src/vertex-objects`)
- Commit: `fix(vertex-objects): refuse attribute layouts without a WebGPU vertex format and buffers whose attributes disagree on type, normalized or usage, leave a value as it was for null in the generated setters, check the targetObjectOffset of copyAttributes(), and check the basePrototype again for a pool built on an existing descriptor`
  - Footer (nach Review, Zug 4): `BREAKING CHANGE: VertexObjectDescriptor refuses an attribute layout without a WebGPU vertex format (type float64 or uint8clamped, normalized on any type but int8, uint8, int16 and uint16 or on an attribute of one value, float16 of one value, more than four values per vertex) and a buffer whose attributes disagree on type, normalized or usage.`
- Verlauf:
  - 2026-09-28 Zug 0: Detailplan steht · BUG-123 unverändert (`types.ts:22`), Umfang gegen three 0.185.1 vollständig bestimmt: dazu `float64`, `normalized` auf Float- und 32-Bit-Typen, mehr als 4 Werte · BUG-124 unverändert (`VertexObjectBuffer.ts:255`, `VertexObjectDescriptor.ts:122`), dazu `normalized` als dritte Größe · BUG-125 unverändert (`VertexObjectBuffer.ts:614`) · BUG-126 unverändert (`createVertexObjectPrototype.ts:121`, `:171`, `:220`), dazu `writeValues()` `:90` · BUG-127 unverändert (`sharedVertexObjectDescriptor.ts:23`), dazu der Weg über einen übergebenen Descriptor (`VOBufferPool.ts:91`) · TEST-050 umgeformt: Test steht bei `createVertexObjectPrototype.spec.ts:306`, hat schon ein Nachbar-VO, kann trotzdem nicht rot werden · DOC-074 unverändert (`CHANGELOG.md:570`, `[Unreleased]`) · READ-023 verschoben nach `docs/architecture.md:96` · keine Folgen (kein erledigtes Paket), »Offene Befunde« leer · Restplan geprüft, keine Änderung
  - 2026-09-28 Zug 1–5, erster Anlauf (B): kein Implementierer gestartet, kein `paket-1.impl-*.json`, kein Verify-Log, kein Commit · Rückgabe `paket-1.B.json` (9 Turns, 19 s) nannte `committed` mit Hash `6f8f9b1`, den es nicht gibt · Gegenprobe der Schleife gescheitert, Exit 20 · Nutzer: zurück auf `[ ]`, Detailplan bleibt, Neustart mit `EFFORT_B=high` · Arbeitsbaum danach sauber, kein Stash
  - 2026-09-28 Zug 0, zweiter Anlauf: HEAD unverändert `e7767c6d`, Baum sauber · alle Fundstellen des Abgleichs unverändert nachgesehen (`VertexObjectDescriptor.ts:144`, `:159`, `:168`; `VertexObjectBuffer.ts:16`, `:255`, `:614`; `createVertexObjectPrototype.ts:90`, `:121–124`, `:140`, `:171–186`, `:220`, `:228–229`; `sharedVertexObjectDescriptor.ts:23`; `VOBufferPool.ts:91`, `:232`; `CHANGELOG.md:500`, `:543`, `:570`; `docs/architecture.md:87–97`) · Schritt 8 erneut gegen `src/`, `twopoint5d-testing/test/`, `apps/lookbook/src/` gesucht: nur die zwei bekannten Stellen · Detailplan präzisiert in Schritt 1, 7, 10 · Modell und Effort unverändert · keine Folgen, »Offene Befunde« leer · Restplan unverändert
  - 2026-09-28 Zug 1 (B, zweiter Anlauf): Implementierer beauftragt, `sonnet`, Effort medium, Session `remediate-twopoint5d-p1-impl-0`, Report `paket-1.impl-0.json`
  - 2026-09-28 Zug 2: Report FERTIG (32 Turns, 223 s), 13 Dateien geändert (`CHANGELOG.md`, `docs/architecture.md`, 6 Quellen, 5 Specs unter `src/vertex-objects/`), Arbeitsbaum schmutzig · rote Läufe belegt (18 Tests vor dem Fix rot; Guard-Beleg rot) · Verify `pnpm run ci` exit=0, Log `paket-1.verify.log` (Nx-Cache-Treffer auf dem Stand des Implementierers)
  - 2026-09-28 Zug 3: Reviewer `opus`/medium, `paket-1.review-0.json`, Diff `paket-1.diff` · alle 8 Findings behoben · kritisch 0 · wichtig 4: Regelverweis `docs/proposals/sprite-features.md:42` (»rule 5« → 8), Kommentar `VertexObjectDescriptor.spec.ts:138` (»rule 4« → 7), `CHANGELOG.md:2919` (32-Bit-Weg ohne »normalized weg«), Commit-Message ohne `BREAKING CHANGE:`-Footer · klein 2: three-Version im Kommentar `VertexObjectDescriptor.ts:12–17`, Umbruch `docs/architecture.md:92`
  - 2026-09-28 Zug 4 Runde 1: Footer in die Commit-Zeile oben eingetragen (Runner) · die drei Doku-/Kommentarstellen und beide kleinen Befunde per Resume an denselben Implementierer (`sonnet`/medium, Session `4b148f24-4772-4ec6-ad1a-3138a80a101b`), Report `paket-1.impl-1.json`
  - 2026-09-28 Zug 4 Runde 1 zurück: FERTIG (4 Turns, 63 s), dazu `docs/proposals/sprite-features.md` · alle 5 Stellen gemeldet, keine weiteren Regelverweise · Verify `pnpm run ci` exit=0, Log `paket-1.verify-1.log` · Diff `paket-1.diff-1`, Nachreview per Resume `paket-1.review-1.json`
  - 2026-09-28 Zug 4 Runde 1 Nachreview (`paket-1.review-1.json`): alle 6 Befunde erledigt, neu nur 2 klein → keine weitere Runde
  - 2026-09-28 Zug 5: Commit `93628b3c` (14 Dateien, Footer `BREAKING CHANGE:`, Trailer `Remediation-Run: 2026-09-28`), getragen von Verify `paket-1.verify-1.log` exit=0 · Arbeitsbaum sauber

## Vorgehen

Reihenfolge: erst die Regressionstests aus Schritt 7 schreiben und rot sehen,
dann die Schritte 1–6 umsetzen, dann 8–10. Alle Fehlermeldungen, Kommentare,
TSDoc und Doku englisch, ohne Finding-IDs und ohne Rückblick auf den
Vorzustand (Konventionen im Plan-Kopf).

### 1. `VertexObjectDescriptor#validate()`: Layouts ohne WebGPU-Vertex-Format und uneinige Buffer abweisen

In `src/vertex-objects/VertexObjectDescriptor.ts`, in `#validate()`, **nach**
der Schleife, die `components.length > size` prüft (heute Zeile 141–149), und
**vor** der Prüfung der Indices, drei neue Prüfungen in dieser Reihenfolge. Alle
drei laufen über `this.attributes.values()` (Deklarationsreihenfolge) und lesen
am `VertexAttributeDescriptor` das Feld `name` und die Getter `bufferName`,
`dataType`, `normalizedData`, `usageType`, `size`. Die erste verletzte Regel
wirft.

**a) Höchstens vier Werte je Vertex** — `attr.size > 4` wirft einen `RangeError`:

```
VertexObjectDescriptor: attribute "${attr.name}" in buffer "${attr.bufferName}" has a size of ${attr.size}, and a WebGPU vertex format holds at most 4 values
```

**b) Ein WebGPU-Vertex-Format je Attribut** — die erste zutreffende Zeile wirft
einen `TypeError`:

| Bedingung | Meldung |
| --- | --- |
| `dataType` ist `'float64'` oder `'uint8clamped'` | `VertexObjectDescriptor: attribute "${name}" in buffer "${bufferName}" is of type ${dataType}, for which WebGPU has no vertex format` |
| `normalizedData` und `dataType` ist keiner von `'int8'`, `'uint8'`, `'int16'`, `'uint16'` | `VertexObjectDescriptor: attribute "${name}" in buffer "${bufferName}" is normalized and of type ${dataType}; WebGPU normalizes int8, uint8, int16 and uint16 only` |
| `normalizedData` und `size === 1` | `VertexObjectDescriptor: attribute "${name}" in buffer "${bufferName}" is normalized with a size of 1; three builds no normalized vertex format of one value, so it needs a size of 2 to 4` |
| `dataType === 'float16'` und `size === 1` | `VertexObjectDescriptor: attribute "${name}" in buffer "${bufferName}" is of type float16 with a size of 1; three builds no float16 vertex format of one value, so it needs a size of 2 to 4` |

Die beiden Typmengen als Modulkonstanten oben in der Datei, z. B.
`const typesWithoutVertexFormat: ReadonlySet<VertexAttributeDataType> = new Set(['float64', 'uint8clamped']);`
und `const normalizableTypes: ReadonlySet<VertexAttributeDataType> = new Set(['int8', 'uint8', 'int16', 'uint16']);`.
Darüber ein Kommentar, der das *Warum* sagt, sinngemäß: three 0.185.1 nimmt
das Format eines Attributs von einem Wert aus einer Tabelle, die nur die
32-Bit-Typen und die 16-Bit-Ganzzahlen kennt, die es ohne `normalized` auf 32
Bit weitet (`WebGPUAttributeUtils.js:32–38`, `:527–529`), das Format eines
größeren aus dem Typed Array und `normalized` (`:12–26`, `:533–548`); WebGPU
selbst kennt kein Format für 64-Bit-Werte, keines, das 32-Bit-Ganzzahlen oder
Floats normalisiert, und keines mit mehr als vier Werten. `Uint8ClampedArray`
steht in keiner der Tabellen.

Nicht abgewiesen werden — und das ist der Maßstab für die Positiv-Tests:
`float32`, `int32`, `uint32` mit 1–4 Werten ohne `normalized`; `int8`,
`uint8`, `int16`, `uint16` mit 1–4 Werten ohne `normalized` (three weitet sie
auf 32 Bit); dieselben vier mit `normalized: true` und 2–4 Werten; `float16`
mit 2–4 Werten ohne `normalized`.

**c) Die Attribute eines Buffers sind sich einig** — eine `Map<string,
VertexAttributeDescriptor>` von `bufferName` auf das erste Attribut dieses
Buffers; jedes weitere Attribut mit demselben `bufferName` muss in `dataType`,
`normalizedData` und `usageType` übereinstimmen, sonst `TypeError`:

```
VertexObjectDescriptor: buffer "${bufferName}" holds attribute "${first.name}" (${summary(first)}) and attribute "${attr.name}" (${summary(attr)}); every attribute of a buffer has to agree on type, normalized and usage
```

mit `summary(a) = `${a.dataType}${a.normalizedData ? ' normalized' : ''}, ${a.usageType}``,
also z. B. `(float32, static)` und `(uint8 normalized, dynamic)`. Kommentar
zum *Warum*: der Buffer übernimmt Elementtyp und Draw-Usage seines ersten
Attributs (Konstruktor von `VertexObjectBuffer`), und three weitet einen Buffer
aus 8- oder 16-Bit-Ganzzahlen nach dem `normalized` des Attributs, das ihn
zuerst hochlädt (`WebGPUAttributeUtils.js:84–93`) — ein abweichendes Attribut
landete sonst ohne Meldung als anderer Typ. Der Default-`bufferName`
(`${usage}_${type}${normalized ? 'N' : ''}`) trennt genau nach diesen drei
Größen, ein Default-Layout verletzt die Regel also nie.

**JSDoc des Konstruktors** (heute Zeile 86–103): die nummerierte Liste
erweitern. Neu nach Regel 3 einfügen, die bisherigen Regeln 4–6 werden 7–9:

4. every attribute holds at most 4 values per vertex (`RangeError`)
5. every attribute has a WebGPU vertex format: its type is neither `'float64'` nor `'uint8clamped'`; `normalized` only on `'int8'`, `'uint8'`, `'int16'` or `'uint16'` and with at least 2 values; `'float16'` with at least 2 values (`TypeError`)
6. the attributes that name the same buffer agree on `type`, `normalized` and `usage` (`TypeError`)

Den `@throws`-Satz ergänzen: die Meldung nennt bei den Regeln 4–6 das Attribut
und seinen Buffer.

### 2. `VertexObjectDescriptor#checkBasePrototype()` — Regel 9 als eigene Methode

In derselben Datei:

- Neues Feld `readonly #propertyOrigins = new Map<string, string>();`. Die
  Namensprüfung in `#validate()` (heute die lokale Map `origins`, Zeile
  159–166) füllt dieses Feld statt einer lokalen Map; Verhalten und Meldung
  bleiben.
- Die Schleife über die Prototypkette (heute Zeile 168–186) wandert unverändert
  in eine neue öffentliche Methode, die `#propertyOrigins` liest:

  ```ts
  /**
   * Throws when a property name of the vertex object appears on the `basePrototype`, neither as an
   * own property nor inherited from a prototype below `Object.prototype` — rule 9 of the
   * constructor. A pool built on a descriptor that exists already calls it again: a `basePrototype`
   * is behaviour its author may extend after the first pool, and a generated accessor would shadow
   * what was added there.
   *
   * @throws an `Error` that names the property, where it comes from, and the basePrototype
   *
   * @internal
   */
  checkBasePrototype(): void
  ```

  Meldung unverändert: `` `VertexObjectDescriptor: the vertex object property "${name}" from ${origin} would shadow a property of the basePrototype` ``.
- `#validate()` ruft am Ende `this.checkBasePrototype()` auf.
- `@internal` genügt: die Root-`tsconfig.json` setzt `stripInternal: true`,
  die Methode erscheint nicht in den veröffentlichten Typen (wie der
  `voPrototype`-Setter derselben Klasse).

### 3. Die Aufrufer von `checkBasePrototype()`

- `src/vertex-objects/sharedVertexObjectDescriptor.ts`, Zeile 23: bei einem
  Cache-Treffer erst `known.checkBasePrototype()`, dann `return known`. Der
  Cache-Eintrag bleibt stehen, auch wenn der Aufruf wirft — die Pools, die ihn
  schon nutzen, behalten ihn, und ein Pool nach Entfernen der Kollision nimmt
  ihn wieder. Kommentar an der Stelle: warum der Treffer noch einmal prüft.
- `src/vertex-objects/VOBufferPool.ts`, Konstruktor Zeile 91: wird ein
  `VertexObjectDescriptor` übergeben, ruft der Konstruktor
  `descriptor.checkBasePrototype()` auf, bevor er ihn übernimmt. Der Weg über
  eine Description ruft nicht zusätzlich auf (dort prüft der Konstruktor des
  Descriptors oder der Cache-Treffer).
- TSDoc von `VOBufferPool#descriptor` (`VOBufferPool.ts:19–27`, dort ist die
  Übernahme eines Descriptors beschrieben): ein Satz dazu, sinngemäß »A pool
  built on a descriptor that exists already — handed in, or shared with an
  earlier pool — checks its `basePrototype` again and throws, as a new
  descriptor would, when a generated accessor would shadow a property added
  there since.«

### 4. `VertexObjectBuffer#copyAttributes()`: `targetObjectOffset` prüfen

In `src/vertex-objects/VertexObjectBuffer.ts`, `copyAttributes()` (heute Zeile
613–653):

- Als erste Anweisung der Methode, vor der Schleife:

  ```ts
  if (!Number.isInteger(targetObjectOffset) || targetObjectOffset < 0) {
    throw new RangeError(
      `VertexObjectBuffer#copyAttributes(): targetObjectOffset must be a non-negative integer, got ${String(targetObjectOffset)}`,
    );
  }
  ```

  Sie steht vor allem anderen, also auch vor der Meldung für den Buffer eines
  disposed Pools: ein falsches Argument ist falsch, gleich in welchem Zustand.
- **Keine** Passt-es-Prüfung wie in `copy()`: `copyAttributes()` kopiert, so
  viele Objekte die Daten hergeben und der Buffer ab dem Offset fasst, und
  antwortet mit dieser Zahl; `VOBufferPool#createFromAttributes()` (Zeile 232)
  lebt von diesem Zählwert. Ein Offset in Höhe der Kapazität oder darüber
  kopiert nichts und antwortet `0` — so bleibt es.
- JSDoc der Methode (heute nur »Throws on the buffer of a disposed pool…«)
  ausbauen: was sie tut (die Werte jedes genannten Attributs ohne Padding, ab
  `targetObjectOffset`, so viele Objekte wie Daten und Kapazität hergeben;
  unbekannte Attributnamen werden übergangen), was sie antwortet (die größte
  Objektzahl über alle Attribute), dazu
  `@throws a RangeError that names the value when targetObjectOffset is no integer of 0 or more; nothing is written then`
  und der bestehende Satz zum disposed Pool.
- Kommentar in Zeile 255 (`// the array of the buffer is built with the data type of its first attribute`)
  ersetzen, sinngemäß: every attribute of a buffer carries the same data type,
  normalization and usage — the descriptor refuses a description where they
  differ — so the first one speaks for all of them.
- TSDoc von `AttributeBufferLayout#bufferName` (Zeile 16–17, »shares with every
  other attribute of the same data and usage type«): sinngemäß »The buffer this
  attribute shares with every other attribute that names it; all of them agree
  on data type, normalization and usage.«

### 5. `createVertexObjectPrototype.ts`: `null` lässt den Wert stehen, und die sechzehn Offsets

In `src/vertex-objects/createVertexObjectPrototype.ts`:

- **`null` wie `undefined`** in allen Stufen der generierten `set…()`-Methoden:
  jede Prüfung `!== undefined` auf einen Wert wird `!= null`.
  - `writeValues()` Zeile 90: `if (value != null) target[to + j] = value;`
    und der Kommentar darüber (Zeile 87–88): »… so `undefined` or `null` here
    is an element the caller handed in as such: it leaves the value as it was«.
  - `makeFixedAttributeValueSetter` Zeile 121–124.
  - `makeWideAttributeValueSetter` Zeile 171–186.
  - `makeAttributeValueSetter` Zeile 220: `if (value != null) …`.
  - Die Weiche `typeof v0 === 'object' && v0 !== null` bleibt wie sie ist: ein
    einzelnes `null` fällt damit auf den Wertepfad und wird dort übergangen.
  - **Nicht** anfassen: `makeAttributeSetter` (der Property-Setter `vo.x = …`)
    — eine Zuweisung schreibt, was sie bekommt, auch `undefined`; das ist
    Zuweisungssemantik und nicht Gegenstand dieses Pakets.
- **Sechzehn Offsets im breiten Setter** (TEST-050): in
  `makeWideAttributeValueSetter` wird `offsets` für **alle sechzehn**
  Parameter berechnet, nicht nur für `count`:
  `Array.from({length: WIDE_SETTER_VALUES}, (_, k) => Math.floor(k / attrSize) * bufferItemSize + (k % attrSize))`.
  Damit ist der breite Setter gebaut wie der feste, dessen `o0 … o3` ebenfalls
  für alle vier Parameter berechnet sind: ein Wert jenseits des Attributs zielt
  auf den nächsten Vertex bzw. das nächste Vertex-Objekt, und allein der
  `count > k`-Guard hält ihn dort heraus. Den Kommentar über `offsets` (heute
  Zeile 139, »the same formula as offsetOf() of the fixed setter above«)
  ersetzen, sinngemäß: one offset for each of the sixteen parameters, those
  beyond the attribute included, like `o0` … `o3` of the fixed setter — the
  `count > k` checks below are what keeps a value beyond the attribute out of
  the next vertex object. Die beiden Konstanten `FIXED_SETTER_VALUES` und
  `WIDE_SETTER_VALUES` samt ihrem Kommentar (heute Zeile 225–229) über
  `makeFixedAttributeValueSetter` verschieben, damit keine Konstante vor ihrer
  Deklaration gelesen wird.
- Allokationsfrei bleibt alles: `offsets` entsteht einmal je Factory-Aufruf, die
  Setter selbst allozieren nichts. `src/vertex-objects/hot-path-allocations.spec.ts`
  und `src/sprites/hot-path-allocations.spec.ts` laufen in `pnpm run ci` mit
  (`test:coverage`) und müssen unverändert grün sein.

### 6. `types.ts`: TSDoc nachziehen

In `src/vertex-objects/types.ts`:

- `VertexAttributeDataType` (Zeile 21): ein Satz dazu — `'float64'` and
  `'uint8clamped'` have no WebGPU vertex format, and a `VertexObjectDescriptor`
  refuses an attribute of either. Die Typunion selbst bleibt unverändert (sie
  benennt auch die Typed Arrays von `TypedArray` und Buffers Data).
- `VADescription#type` (Zeile 41–52): anhängen, welche Layouts der Descriptor
  abweist — die beiden Typen oben, `'float16'` mit einem Wert, mehr als vier
  Werte je Vertex — und dass er es beim Bau mit einer Meldung tut, die Attribut
  und Buffer nennt.
- `VADescription#normalized` (Zeile 53–58): »Has no effect on a floating point
  type« ersetzen durch: only an attribute of `'int8'`, `'uint8'`, `'int16'` or
  `'uint16'` with 2 to 4 values takes it — WebGPU normalizes no other type, and
  three builds no normalized format of one value; the descriptor refuses it
  anywhere else.
- `VADescription#bufferName` (Zeile 81–88): ein Satz dazu — the attributes
  that name one buffer have to agree on `type`, `normalized` and `usage`; the
  descriptor refuses a description where they do not.
- `VertexObjectDescription#basePrototype` (Zeile 170–182): an den Satz »the
  descriptor refuses such a description …« anschließen: and every pool built
  on a descriptor that exists already — handed in, or taken over from an
  earlier pool of the same description — checks it again.
- `VOAttrSetter` (Zeile 231–247): »Fewer values than the attribute has, or a
  value of `undefined`, leave the rest …« → »…, or a value of `undefined` or
  `null`, leave …«.

### 7. Regressionstests — vor dem Fix schreiben und rot sehen

Den roten Lauf mit Kommando und Ausgabe in den Report. `null` in TypeScript als
`null as unknown as number`.

`src/vertex-objects/VertexObjectDescriptor.spec.ts`, im `describe('refuses a description the layout cannot hold')`:

- `an attribute of more than four values` — `{size: 5}` und `{components: ['a', 'b', 'c', 'd', 'e']}`: `RangeError`, Meldung nennt Attribut, Buffer und `size of 5`.
- `an attribute of type float64` und `an attribute of type uint8clamped` — `TypeError`, Meldung nennt Attribut und Buffer.
- `a normalized attribute of a floating point type` — `float32` mit `size: 3`, `float32` mit `size: 1`, `float16` mit `size: 2`: je `TypeError`.
- `a normalized attribute of a 32-bit integer type` — `int32` mit `size: 2`, `uint32` mit `size: 1`: je `TypeError`.
- `a normalized attribute of one value` — `uint8` mit `size: 1`, `int16` mit `size: 1`: je `TypeError`.
- `a float16 attribute of one value` — `TypeError`.
- `two attributes of different types in one buffer` — `a: {size: 2, type: 'float32', bufferName: 'shared'}`, `b: {size: 4, type: 'uint8', bufferName: 'shared'}`: `TypeError`, Meldung nennt `"shared"`, `"a"` und `"b"`.
- `two attributes of different usage in one buffer` — `static` und `dynamic` unter einem `bufferName`: `TypeError`.
- `a normalized and a plain attribute in one buffer` — `uint8` mit `size: 4`, einmal mit `normalized: true`, einmal ohne, unter einem `bufferName`: `TypeError`.

Im `describe('takes every description the layout can hold')`:

- `every attribute layout with a WebGPU vertex format` — die Positivliste aus Schritt 1b, je Größe ein Attribut (z. B. per Schleife über Typ × Größe, jedes Attribut mit eigenem Namen), baut ohne Fehler.
- `attributes that agree on type, normalized and usage in one named buffer` — zwei `uint8`-Attribute mit `normalized: true`, `usage: 'dynamic'`, gleichem `bufferName`: baut.

(Die Positiv-Tests sind vor dem Fix grün; sie belegen, dass die Regeln nicht zu weit greifen. Rot vor dem Fix müssen die Abweisungs-Tests sein.)

`src/vertex-objects/createVertexObjectPrototype.spec.ts`:

- `a setter of up to four values leaves a value it is handed null for as it was` — `{vertexCount: 1, attributes: {pos: {components: ['x', 'y', 'z']}}}`: `setPos(1, 2, 3)`, `setPos(4, null, 6)` → `[4, 2, 6]`; `setPos(null)` → unverändert.
- `a setter of five to sixteen values leaves a value it is handed null for as it was` — `{vertexCount: 4, attributes: {foo: {components: ['x', 'y', 'z']}, bar: {size: 3}}}`: `setFoo(1 … 12)`, `setFoo(9, null, 9)` → `[9, 2, 9, 4, …, 12]`; `setFoo(null)` → unverändert.
- `a setter of more than sixteen values handed a single null writes nothing` — neben dem bestehenden Test für `undefined` (Zeile 403), `{vertexCount: 6, attributes: {pos: {size: 3}}}`.
- `a setter leaves an element of an array-like it is handed null for as it was` — neben dem bestehenden Test für `undefined` (Zeile 415): `setPos([9, null, 9])` auf einem Attribut mit Wert `2` an zweiter Stelle → `2` bleibt; dasselbe über `vertexCount: 2`.
- **TEST-050**: `a setter of five to sixteen values ignores values beyond the attribute` (Zeile 306) — `a.setFoo` bekommt sechzehn Werte (`1 … 16`) statt dreizehn, Erwartungen bleiben (`a` hat `1 … 12`, `b` nur `7`), dazu ein Kommentar wie beim Test für mehr als sechzehn Werte: »a thirteenth value lies where the first value of the next object starts«. Beleg, dass der Test den Guard trägt: **nach** der Offset-Änderung aus Schritt 5 die Guards `count > 12 &&` bis `count > 15 &&` vorübergehend entfernen, den Test laufen lassen (rot: `b` bekommt `13, 14, 15, 16`), Guards wieder herstellen. Diese rote Ausgabe gehört in den Report.

`src/vertex-objects/VertexObjectBuffer.spec.ts`, im `describe('object index checks')`:

- `copyAttributes() turns away a negative targetObjectOffset` — `copyAttributes({…}, -1)`: `RangeError`, Meldung passt auf `/VertexObjectBuffer#copyAttributes\(\).*-1/`; danach Buffer-Inhalt und `serial` unverändert.
- `copyAttributes() turns away a fractional targetObjectOffset` — `1.5`, ebenso.
- `copyAttributes() at an offset of the capacity copies nothing and answers 0` — hält das bestehende Abschneiden fest (vor dem Fix grün, das ist Absicht).

`src/vertex-objects/VertexObjectPool.spec.ts`, im `describe('the descriptor of a pool')`:

- `a basePrototype that takes a name of the vertex object after the first pool is refused on the next pool` — `class Base {}`, Description `{attributes: {pos: {components: ['x', 'y']}}, basePrototype: Base.prototype}`, erster Pool baut; dann `Object.defineProperty(Base.prototype, 'x', {value: 1, configurable: true})`; ein zweiter `new VertexObjectPool(description, 1)` wirft `/"x".*would shadow a property of the basePrototype/`; ein Vertex-Objekt des ersten Pools schreibt und liest `x` weiter über seinen Buffer. `class Base {}` und die Description stehen im Test selbst, nicht auf Modulebene; das `delete Base.prototype.x` steht in einem `finally`, damit auch eine gescheiterte Erwartung nichts hinterlässt.
- `a descriptor handed to a second pool is checked against its basePrototype again` — dasselbe mit einem `new VertexObjectDescriptor(description)`, das beiden Pools übergeben wird; ebenso mit eigenem `Base` im Test und `delete` im `finally`.

### 8. Bestehende Specs, die die neuen Regeln abweisen

Bekannt aus dem Abgleich:

- `src/vertex-objects/VertexObjectGeometry.spec.ts:132` — `level: {size: 1, type: 'int16', normalized: true}` wird `level: {size: 1, type: 'int16'}`. Der Test (»every attribute three draws from starts on a 4-byte boundary …«) behält damit seinen Fall eines 16-Bit-Attributs von einem Wert mit Padding.
- `src/vertex-objects/createVertexObjectPrototype.spec.ts:140` — `{vertexCount: 1, attributes: {v: {size: 1, type: 'float16'}}}` wird ein Attribut mit zwei Werten, dessen erste Komponente `v` heißt: `{vertexCount: 1, attributes: {half: {components: ['v', 'w'], type: 'float16'}}}`; Typparameter des Pools entsprechend `{v: number; w: number}`. Die Erwartungen an `vo.v` bleiben.

Danach die ganze Suite laufen lassen (`pnpm nx test twopoint5d` und
`pnpm test:browser`). Jede weitere Spec oder Browser-Fixture
(`packages/twopoint5d-testing/test/`), deren Beschreibung jetzt abgewiesen
wird, bekommt das nächstliegende gültige Layout, das den Zweck des Tests hält
(ein Wert mehr, `normalized` weg, ein eigener `bufferName`) — nicht den Test
löschen. Jede solche Stelle mit Datei und Zeile in den Report.

### 9. Doku

`packages/twopoint5d/docs/architecture.md`:

- **READ-023**, Zeile 96–97: »An accessor call V8 does not inline does pay for the shared caches, …« → »An accessor call that V8 does not inline pays for the shared caches, …«.
- Zeile 87–91 (geteilte Descriptoren): an »… every later one takes it over as long as the description still describes what it did then« einen Halbsatz anschließen, dass ein Pool, der einen bestehenden Descriptor übernimmt oder übergeben bekommt, dessen `basePrototype` erneut gegen die Namen des Vertex-Objekts prüft, wie es ein neuer Descriptor täte.

### 10. CHANGELOG, nur `[Unreleased]`

Vorher den Skill `updating-changelog` laden und ihm folgen (Keep a Changelog
1.1.0; freigegebene Abschnitte ab `## [0.21.2]` (Zeile 2909) sind
unantastbar). Jeder Block mit der Info-Zeile `ts check` wird von `pnpm
typecheck` gegen das gebaute Paket kompiliert (`AGENTS.md:110`,
`scripts/checkDocSnippets.mjs`) und läuft damit in `pnpm run ci` mit; ein
neuer After-Block muss dort grün sein.

- **DOC-074**, Migration Guide, Absatz ab Zeile 570 (»An attribute with padding that is alone in its buffer …«):
  - Das Beispiel »or a `float16` attribute of `size: 1`« wird »or a `float16` attribute of `size: 3`« — `float16` mit einem Wert weist der Descriptor jetzt ab.
  - Den Satz »An `InterleavedBufferAttribute` has no `addUpdateRange()`, `clearUpdateRanges()`, `updateRanges`, `setUsage()` or `version` — a call to one of them on such an attribute throws a `TypeError`, …« in zwei Aussagen teilen: `addUpdateRange()`, `clearUpdateRanges()` and `setUsage()` are no methods of it, and a call throws a `TypeError`; `updateRanges` and `version` read `undefined` — pushing a range onto `updateRanges` throws, while a comparison on `version` never sees a change and says nothing. Der Halbsatz zu `isBufferAttribute` bleibt; der Satz, dass all das auf dem Buffer dahinter liegt, nennt `attr.data.updateRanges`, `attr.data.addUpdateRange()`, `attr.data.setUsage()` und `attr.data.version`. (Geprüft an three 0.185.1: `InterleavedBufferAttribute.js` hat keinen dieser fünf Member, `InterleavedBuffer.js:68`, `:75`, `:113`, `:127`, `:136` hat alle.)
- Migration Guide, Abschnitt »An attribute of 8 or 16 bits takes whole 4 bytes per vertex« (Überschrift Zeile 543, erster Absatz Zeile 545): `uint8clamped` aus der Aufzählung streichen und »a layout of 32- and 64-bit attributes stays as it is« auf »a layout of 32-bit attributes stays as it is« kürzen — beide Typen weist der Descriptor jetzt ab.
- Migration Guide, Absatz Zeile 500 (»The constructor checks the description once — the indices lie inside the vertex count, an attribute names no more components than its size — …«): die Aufzählung im Einschub um »every attribute has a WebGPU vertex format« ergänzen.
- `[Unreleased]` nach weiteren Stellen durchsuchen, die ein jetzt abgewiesenes Layout zeigen (`uint8clamped`, `float64`, `normalized`, `size: 1`) und sie ebenso nachziehen.
- Neuer Eintrag unter `### Changed`: `VertexObjectDescriptor` refuses, when it is built, an attribute layout without a WebGPU vertex format — type `float64` or `uint8clamped`, `normalized` on any type but `int8`, `uint8`, `int16` and `uint16` or on an attribute of one value, `float16` of one value, more than four values per vertex — and a buffer whose attributes disagree on `type`, `normalized` or `usage`; the error names the attribute and its buffer. Such a layout built a pool before and failed only once three built the render pipeline.
- Neuer Abschnitt im `### Migration Guide`, z. B. `#### A description without a WebGPU vertex format is refused`: was abgewiesen wird, und je Fall der Weg: `float32` statt `float64`; `uint8` statt `uint8clamped` (mit `normalized: true`, wo die Werte 0 … 1 bedeuten sollen); ein normalisiertes oder `float16`-Attribut von einem Wert bekommt einen zweiten Wert oder einen 32-Bit-Typ; mehr als vier Werte teilen sich auf zwei Attribute auf; Attribute, die sich in einem benannten Buffer nicht einig sind, bekommen je einen eigenen `bufferName`. Before-Block als schlichter `ts`-Block, After-Block als `ts check`-Block, der für sich kompiliert (alle Importe aus `@spearwolf/twopoint5d`).
- Neue Einträge unter `### Fixed`:
  - the generated `set…()` methods of a vertex object leave a value as it was for `null`, as they do for `undefined`, whether it comes as a separate argument or as an element of an array-like
  - `VertexObjectBuffer#copyAttributes()` throws a `RangeError` that names the value for a `targetObjectOffset` that is no integer of 0 or more, as `copy()` and `copyArray()` do, and writes nothing then
  - a pool built on a `VertexObjectDescriptor` that exists already — handed in, or taken over from an earlier pool of the same description — checks its `basePrototype` again and refuses a property added there since that a generated accessor would shadow

## Abgleich

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| BUG-123 | unverändert; Umfang vollständig bestimmt | `types.ts:22`, kein Check in `VertexObjectDescriptor.ts:122 ff.`; three 0.185.1 `WebGPUAttributeUtils.js:12–38`, `:519–556` |
| BUG-124 | unverändert; `normalized` gehört dazu | `VertexObjectBuffer.ts:255–261` (Buffer nimmt Typ und Usage des ersten Attributs), kein Check in `VertexObjectDescriptor.ts:122 ff.` |
| BUG-125 | unverändert | `VertexObjectBuffer.ts:614–653`, kein Check auf `targetObjectOffset` |
| BUG-126 | unverändert; eine Stelle mehr | `createVertexObjectPrototype.ts:121–124`, `:171–186`, `:220`, dazu `writeValues()` `:90` |
| BUG-127 | unverändert; ein Weg mehr | `sharedVertexObjectDescriptor.ts:23` (Treffer ohne Prüfung), dazu `VOBufferPool.ts:91` (übergebener Descriptor) |
| TEST-050 | umgeformt | `createVertexObjectPrototype.spec.ts:306–317`; Nachbar-VO `b` existiert schon, der Test kann trotzdem nicht rot werden, weil `offsets` nur `count` Einträge hat (`createVertexObjectPrototype.ts:140`) |
| DOC-074 | unverändert | `CHANGELOG.md:570`, in `[Unreleased]` → änderbar |
| READ-023 | verschoben | `docs/architecture.md:96` statt `:89` |

## Entscheidungen in Zug 0

- **Umfang von BUG-123 nach der Zeile in »Entscheidungen«, nicht nach der
  Aufzählung des Audits.** Die Entscheidung sagt »Layouts ohne
  WebGPU-Vertex-Format … werden beim Bau des Descriptors abgewiesen«. Gegen
  three 0.185.1 nachgesehen, haben neben den im Audit genannten Fällen auch
  diese keines: `float64` (in keiner Tabelle, `prefixOptions[…]` wirft sogar
  einen TypeError), `normalized` auf `float32`/`float16` ab zwei Werten (kein
  Präfix), `normalized` auf `int32`/`uint32` (`unorm32…` ist kein
  GPUVertexFormat; bei einem Wert fällt `normalized` still weg), mehr als vier
  Werte (`float32x5` usw. gibt es nicht). Nur einen Teil abzuweisen hieße,
  dieselbe Ursache halb zu beheben. Keins dieser Layouts kommt im Repo vor
  (gesucht in `src/`, `twopoint5d-testing/test/`, `apps/lookbook/src/`, Doku).
- **`normalized` auf einem Float-Typ wird auch bei einem Wert abgewiesen**,
  obwohl three dort `float32` ohne Fehler baut. Eine Regel (»`normalized` nur
  auf 8-/16-Bit-Ganzzahlen mit 2–4 Werten«) statt einer, die an der Größe
  kippt; `normalized` auf einem Float bedeutet nichts, und die bisherige Doku
  (»Has no effect on a floating point type«) wird ohnehin neu geschrieben.
- **Die Typunion `VertexAttributeDataType` bleibt**, `float64` und
  `uint8clamped` inklusive. Sie zu verengen wäre ein zweiter, typseitiger
  Bruch der öffentlichen API über die Entscheidung hinaus; die Abweisung zur
  Laufzeit mit Meldung ist, was entschieden wurde, und die TSDoc nennt sie.
- **`normalized` als dritte Größe der Buffer-Einigkeit (BUG-124).** three
  weitet einen 8-/16-Bit-Buffer nach dem `normalized` des Attributs, das ihn
  zuerst hochlädt; ein gemischter Buffer bekommt damit für eines der Attribute
  ein Format ohne Entsprechung. Das fällt unter die Hälfte »ohne
  WebGPU-Vertex-Format« derselben Entscheidung, und die Regel deckt sich dann
  genau mit den drei Größen des Default-`bufferName`.
- **Maßstab ist WebGPU.** Unter dem WebGL2-Fallback von `WebGPURenderer`
  liefen einzelne abgewiesene Layouts (etwa `uint8clamped`); die Entscheidung
  nennt WebGPU, die Bibliothek importiert durchweg `three/webgpu`.
- **BUG-127 als Prüfung, nicht nur als JSDoc**, und an beiden Wegen, auf denen
  ein Pool einen bestehenden Descriptor nimmt (Cache-Treffer und übergebener
  Descriptor). Die Konstruktorregel sagt »the descriptor refuses such a
  description«; eine JSDoc-Einschränkung machte sie für geteilte Descriptoren
  unwahr. Die Prüfung läuft beim Bau eines Pools, nicht im Frame-Takt.
- **BUG-125 ohne Passt-es-Prüfung.** Abweichung von »dieselbe Bereichsprüfung
  wie in `copy()`«: nur Ganzzahl und ≥ 0. `copyAttributes()` schneidet an der
  Kapazität ab und antwortet mit der Objektzahl, die
  `VOBufferPool#createFromAttributes()` weiterverwendet; eine Passt-es-Prüfung
  machte aus diesem Vertrag einen Wurf.
- **TEST-050: Abweichung von der Empfehlung.** Die Empfehlung (Nachbar-VO
  prüfen) steht schon im Test; rot werden kann er nur, wenn ein Wert jenseits
  des Attributs ohne Guard überhaupt einen gültigen Index träfe. Deshalb
  bekommt `offsets` Einträge für alle sechzehn Parameter, wie der feste Setter
  `o0 … o3` für alle vier hat — dann trägt der Guard, und der Test beweist ihn.
  Die Offsets werden einmal je Factory berechnet; der Hot Path ändert sich
  nicht.
- **BUG-126 nur für die `set…()`-Methoden**, nicht für den Property-Setter
  `vo.x = …`, der auch `undefined` schreibt: dort gilt Zuweisungssemantik, und
  die Entscheidung spricht vom generierten Setter.
- **Modell mittlere Stufe, Effort medium.** Ein Modul, exakte Regeln und
  Meldungen stehen hier; offen ist nur, welche Specs die neuen Regeln noch
  treffen (Schritt 8). Keine Nebenläufigkeit, keine Sicherheit; die
  öffentliche Verhaltensänderung ist entschieden, nicht zu entwerfen.
- **Zweiter Anlauf: Detailplan und Modellstufe bleiben.** Der erste B ist
  nicht am Plan gescheitert, sondern hat keinen Implementierer gestartet und
  einen Commit erfunden; ein Implementierer hat diesen Text nie gesehen. Die
  Neustart-Entscheidung des Nutzers hebt den Effort von B, nicht den des
  Implementierers. Präzisiert wurde nur, was ein Implementierer sonst selbst
  hätte nachsehen müssen: `name` ist ein Feld, kein Getter (Schritt 1); die
  Aufräum-Regel der basePrototype-Tests (Schritt 7); dass `ts check`-Blöcke
  im Gate kompiliert werden (Schritt 10).
- **Der Queue-Eintrag aus der Rückgabe des ersten B entfällt.** Er meldete
  fehlendes Aufräumen in `VertexObjectPool.spec.ts` für Tests, die nie
  geschrieben wurden — kein Sachverhalt im Code, also kein Nebenbefund. Sein
  berechtigter Kern (keine Eigenschaft auf einem geteilten Prototyp stehen
  lassen) steht jetzt als Vorgabe in Schritt 7.

## Restplan

Geprüft, keine Änderung. Die Sprite- und Tile-Descriptions (`BaseSprite.ts`,
`TexturedSprite.ts`, `AnimatedSprite.ts`, `map2d/TileSprites/descriptors.ts`)
nutzen nur `float32`, höchstens vier Werte und Default-Buffer; die neuen Regeln
treffen weder Paket 2 noch Paket 4. `null` im Setter verträgt sich mit der
Entscheidung zu `TexturedSprite#setPosition`/`setColor` (Paket 2), die
`undefined` durchreicht. Im zweiten Anlauf erneut nachgesehen: `src/sprites/`
und `src/map2d/` nennen weder `normalized` noch `float16`, `uint8clamped` oder
`float64` in einer Description; es bleibt bei Reihenfolge und Schnitt.

## Für Zug 5 — was unter `Schnittstellen:` gehört

- `VertexObjectDescriptor` wirft beim Bau `RangeError` (mehr als 4 Werte) bzw. `TypeError` (kein WebGPU-Vertex-Format; Buffer uneinig in `type`/`normalized`/`usage`)
- `VertexObjectDescriptor#checkBasePrototype()` neu, `@internal`; aufgerufen von `sharedVertexObjectDescriptor()` beim Cache-Treffer und vom `VOBufferPool`-Konstruktor für einen übergebenen Descriptor
- `VertexObjectBuffer#copyAttributes()` wirft `RangeError` für einen `targetObjectOffset`, der keine Ganzzahl ≥ 0 ist
- generierte `set…()`-Methoden übergehen `null` wie `undefined`

## Findings im Volltext

**BUG-123 · low · packages/twopoint5d/src/vertex-objects/types.ts:22** — Attribute ohne WebGPU-Vertex-Format schon beim Descriptor abweisen
Die API lässt Attribute zu, für die three 0.185.1 unter WebGPU kein Vertex-Format kennt: `type: 'uint8clamped'` in jeder Größe (keine Zuordnung für `Uint8ClampedArray`, WebGPUAttributeUtils.js:12–20, :32–38) und ein Attribut mit einem Wert je Vertex vom Typ `float16` oder einem 8-/16-Bit-Typ mit `normalized: true` (die Tabelle für itemSize 1 kennt nur 32-Bit-Arrays und die geweiteten 16-Bit-Arrays, :554–556). three meldet »Vertex format not supported yet«, die Pipeline entsteht nicht. Aufgefallen im Remediation-Lauf vom 2026-09-27.
Empfehlung: Solche Layouts in VertexObjectDescriptor mit einer klaren Meldung abweisen oder auf ein unterstütztes Format abbilden; mindestens in der Doku von `type` in types.ts nennen.

**BUG-124 · low · packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:250** (auch `VertexObjectDescriptor.ts:122`) — Attribute mit abweichendem type oder usage im selben Buffer abweisen
Attribute, die per `bufferName` einen Buffer teilen, sich aber in `type` oder `usage` unterscheiden, werden nicht abgewiesen: der Buffer übernimmt still `dataType` und `usageType` seines ersten Attributs, ein `uint8`-Attribut in einem `float32`-Buffer landet ohne Meldung als float32. Aufgefallen im Remediation-Lauf vom 2026-09-27.
Empfehlung: In `VertexObjectDescriptor#validate()` prüfen, dass alle Attribute eines Buffers denselben type und dieselbe usage tragen, und sonst mit Buffer- und Attributnamen werfen.

**BUG-125 · low · packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:614** — targetObjectOffset in copyAttributes() prüfen wie in copy()
`copyAttributes()` prüft `targetObjectOffset` nicht, anders als `copy()` und `copyArray()`: ein negativer Offset schreibt auf negative Indizes, ein gebrochener auf Nicht-Integer-Indizes, beides ohne Wirkung und ohne Meldung. Aufgefallen im Remediation-Lauf vom 2026-09-27.
Empfehlung: Dieselbe Bereichsprüfung wie in `copy()` vorschalten und einen RangeError werfen; mit einem Test für negativen und gebrochenen Offset absichern.

**BUG-126 · low · packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:121** (auch `:171`, `:220`) — Ein einzelnes null im generierten Setter nicht als 0 schreiben
Ein einzelnes `null` als Wert eines generierten Setters landet in allen drei Setter-Stufen als 0 im Buffer: die Prüfung ist `!== undefined`, das Array-like wird erst bei `!== null` erkannt. Die `VOAttrSetter`-JSDoc spricht nur von `undefined`; TypeScript lässt `null` nicht zu, JavaScript-Aufrufer schon. Aufgefallen im Remediation-Lauf vom 2026-09-27.
Empfehlung: Werte mit `!= null` prüfen, sodass `null` wie `undefined` den Wert stehen lässt, oder das Verhalten in der JSDoc festschreiben.

**BUG-127 · low · packages/twopoint5d/src/vertex-objects/sharedVertexObjectDescriptor.ts:24** — Kollisionsprüfung mit dem basePrototype auch für geteilte Descriptoren
Die Konstruktorregel, dass kein Accessor-Name auf dem `basePrototype` stehen darf, wird für einen Descriptor aus dem Cache nicht erneut geprüft. Bekommt der `basePrototype` nach dem ersten Pool eine kollidierende Eigenschaft, werfen spätere Pools derselben Description nicht.
Empfehlung: Die Prüfung bei einem Cache-Treffer wiederholen oder die Einschränkung in der JSDoc von `sharedVertexObjectDescriptor` festhalten.

**TEST-050 · low · packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.spec.ts:305** — Test der Setter-Grenze so bauen, dass er ohne Guard rot wird
`a setter of five to sixteen values ignores values beyond the attribute` kann nicht rot werden: ohne den `count > k`-Guard wäre der Index `NaN`, und ein Schreiben auf ein Typed Array mit `NaN`-Index tut nichts. Das Verhalten stimmt, den Guard beweist der Test nicht.
Empfehlung: Den Test so anlegen, dass ein fehlender Guard in einen gültigen Nachbarslot schreiben würde (etwa ein zweites VO direkt dahinter), und diesen Slot prüfen.

**DOC-074 · low · packages/twopoint5d/CHANGELOG.md:569** — Migrationsabsatz zu InterleavedBufferAttribute präzisieren
Der Migration Guide zählt `updateRanges` und `version` zu dem, was auf einer `InterleavedBufferAttribute` einen `TypeError` wirft. Beide lesen sich dort als `undefined`: ein Schreiben in `updateRanges` wirft, ein Vergleich auf `version` sieht still nie eine Änderung.
Empfehlung: Den Satz in zwei Aussagen trennen: was wirft und was still undefined liefert, jeweils mit dem Weg über `attribute.data`.

**READ-023 · info · packages/twopoint5d/docs/architecture.md:89** — Satz zu nicht inlinten Accessor-Aufrufen in architecture.md glätten
»An accessor call V8 does not inline does pay …« liest sich holprig (Relativsatz ohne »that«).
Empfehlung: Umformulieren, etwa »An accessor call that V8 does not inline pays …«.

## Urteil des Reviewers

Reviewer `opus`/medium, `paket-1.review-0.json` und Nachreview `paket-1.review-1.json`, Commit `93628b3c`.

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| BUG-123 | behoben | `VertexObjectDescriptor.ts:19–20` (Typmengen), `#checkVertexFormats` `:194–226`, Aufruf `:173`; JSDoc Regeln 4–6 `:110–115`; `types.ts:21–24`, `:55–66`; Tests `VertexObjectDescriptor.spec.ts:325–413`, Positivliste `:445–458` |
| BUG-124 | behoben | `VertexObjectDescriptor.ts:228–246`; `VertexObjectBuffer.ts:16`, `:255–256`; `types.ts:96–98`; Tests `VertexObjectDescriptor.spec.ts:386–413`, `:460–470` |
| BUG-125 | behoben | `VertexObjectBuffer.ts:626–630`, JSDoc `:614–624`; Tests `VertexObjectBuffer.spec.ts:763–791` |
| BUG-126 | behoben | `createVertexObjectPrototype.ts:90`, `:127–130`, `:179–194`, `:228`; `types.ts:248`; Tests `createVertexObjectPrototype.spec.ts:419–475` |
| BUG-127 | behoben | `VertexObjectDescriptor.ts:261` (`checkBasePrototype()`, `@internal`); `sharedVertexObjectDescriptor.ts:28`; `VOBufferPool.ts:95–101`; Tests `VertexObjectPool.spec.ts:164–194` |
| TEST-050 | behoben | `createVertexObjectPrototype.ts:148` (16 Offsets), Konstanten `:95–99`; Test `createVertexObjectPrototype.spec.ts:317–318`; ohne Guards rot (Implementierer-Report) |
| DOC-074 | behoben | `CHANGELOG.md:574` |
| READ-023 | behoben | `docs/architecture.md:98` |

Behobene Befunde aus Runde 1: Regelverweise `docs/proposals/sprite-features.md:42` und `VertexObjectDescriptor.spec.ts:138` auf neue Nummerierung, `CHANGELOG.md:2919` (32-Bit-Weg lässt `normalized` fallen), `BREAKING CHANGE:`-Footer, three-Version im Kommentar, Umbruch in `architecture.md`.

Kleine Befunde (offen, lösen keine Runde aus):
- `src/vertex-objects/VertexObjectDescriptor.ts:13`: Kommentarblock ungleich umbrochen (erste Zeile 104 Zeichen nach Einschub der three-Version).
- `docs/architecture.md:93`: Zeile endet nach 62 Zeichen, Nachbarn bei ~95 — kosmetischer Umbruch im Markdown-Quelltext.
- `CHANGELOG.md:200` (`[Unreleased]`, `### Changed`): der ältere Eintrag zu `new VertexObjectDescriptor()` zählt die Abweisungsregeln ohne die drei neuen auf; der neue `### Changed`-Eintrag deckt sie ab (vom Implementierer gemeldet, vom Reviewer nicht beanstandet).
