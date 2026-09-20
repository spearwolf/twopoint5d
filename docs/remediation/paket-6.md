# Paket 6 — Die Restposten des Moduls: ehrliche Kommentare, dichte Typen, ein vollständiger Prüfdurchgang

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Befunde: zehn Einträge der zweiten Drain-Runde aus »Offene Befunde«, keine
  Audit-Findings. Zwei davon sind Folgen dieses Laufs (Schritt 1 und Schritt 4),
  acht vorbestehend.
- Ziel: Was das Modul über sich selbst sagt — in Kommentaren, Typen und
  Fehlermeldungen — stimmt mit dem überein, was es tut.
- Modell: stärkste Stufe
- Effort: `high`
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`
  - `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.ts`
  - `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts`
  - `packages/twopoint5d/src/vertex-objects/createTypedArray.ts`
  - `packages/twopoint5d/src/vertex-objects/types.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(vertex-objects): judge both sides of a layout before a copy writes anything, hand out the buffer map of a vertex object buffer as a read-only view, say what every field of an attribute buffer holds, and name the module and the function in the error an unknown data type throws`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · alle zehn Befunde stehen noch, keiner
    gegenstandslos · zwei Fundstellen gewandert
    (`VertexObjectDescriptor.ts:84-85` → `:97`,
    `cloneVertexObjectDescription.ts:2` → `:8`) · ein Befund hat eine andere
    Ursache als notiert (Schritt 6, Zyklus) · zwei Befunde im Umfang gemessen
    und präzisiert (Schritt 3 TSDoc: fünf Felder plus Interface statt sechs
    Felder; Schritt 9 Links: sechs Stellen in `types.ts` statt zwei) · neuer
    Nebenbefund in »Offene Befunde«: dieselbe Link-Machart in sieben weiteren
    Moduldateien, 19 Stellen, nicht in dieses Paket aufgenommen
  - 2026-09-20 Zug 1: Implementierer beauftragt, stärkste Stufe, Effort `high`
    (`paket-6.impl-1.json`, session `334ccea9-ad4f-4fcf-bf90-fc035e4e5dce`)
  - 2026-09-20 Zug 2: Report `FERTIG_MIT_VORBEHALT` · zehn Dateien geändert,
    keine neu · Arbeitsbaum schmutzig · eigener Verify-Lauf `pnpm run ci`
    exit=0 (`paket-6.verify.log`) · Regressionstest: drei Tests in
    `VertexObjectBuffer.spec.ts`, alle drei vor dem Fix rot · Vorbehalt: ein
    Migrationsabschnitt im CHANGELOG, den Schritt 11 ausschließt und den der
    Skill `updating-changelog` verlangt
  - 2026-09-20 Zug 3: Reviewer (stärkste Stufe, Effort `high`,
    `paket-6.review-1.json`) — alle elf Schritte erfüllt, kein kritischer und
    kein wichtiger Befund, drei kleine · Diff:
    `<arbeitsdir>/paket-6.diff`
  - 2026-09-20 Zug 4: entfällt, keine Runde ausgelöst
  - 2026-09-20 Zug 5: committet als `07277e2d`, eine Runde, Verify aus Zug 2
    getragen (seither keine Codeänderung)

## Urteil des Reviewers je Schritt (Zug 3)

Alle elf erfüllt, je mit Fundstelle im Commit `07277e2d`:

| Schritt | Urteil | Fundstelle |
| --- | --- | --- |
| 1 `copy()` misst beide Richtungen | erfüllt | `VertexObjectBuffer.ts:336-342` (vertexCount, vor der Schleife), `:364-369` (itemSize), `:370-375` (dataType), TSDoc `:294-315`, Tests `VertexObjectBuffer.spec.ts:543-596` |
| 2 Buffer-Map read-only | erfüllt | `VertexObjectBuffer.ts:77` (`#buffers`), `:80-82` (Getter), `:546-559` (`setTypedArray()`), `VOBufferPool.ts:289` |
| 3 TSDoc an Layout und Buffer | erfüllt | `VertexObjectBuffer.ts:7`, `:9`, `:11`, `:13`, `:17`, `:19`, `:21`, `:23`, `:25`, `:33` |
| 4 Kommentar über `pickUpDirtyRange()` | erfüllt | `VertexObjectBuffer.ts:259-261` |
| 5 Konstruktor-Kommentar | erfüllt | `VertexObjectDescriptor.ts:97` |
| 6 Zyklus gebrochen | erfüllt | `cloneVertexObjectDescription.ts:8` (`import type`), `:79-82` (`in`-Weiche) |
| 7 `entries` mit Typ | erfüllt | `createVertexObjectPrototype.ts:91`, `:151`, `:155` |
| 8 Sinon-Sandbox raus | erfüllt | `cloneVertexObjectDescription.spec.ts:1` |
| 9 TSDoc-Links in `types.ts` | erfüllt | `types.ts:58`, `:121`, `:128`, `:145`, `:187`, `:233` |
| 10 `createTypedArray()` nennt sich | erfüllt | `createTypedArray.ts:26` |
| 11 CHANGELOG | erfüllt | `CHANGELOG.md:41`, `:42`, dazu der Migrationsabschnitt `:2058-2084` |

Der Reviewer hat die drei Regressionstests nachgerechnet statt geglaubt: alle
drei wären vor dem Fix durch die alleinige Längenprüfung gekommen (8 ≤ 16,
4 ≤ 4, 8 ≤ 32) und hätten still geschrieben.

## Die Abweichung beim CHANGELOG

Schritt 11 schließt einen Migrationsabschnitt im Fließtext aus und überlässt die
Frage im letzten Satz dem Skill `updating-changelog`. Der Skill verlangt ihn:
`function inspect(buffers: Map<string, AttributeBuffer>)` compiliert nach
Schritt 2 nicht mehr, das ist ein Breaking Change an der öffentlichen Typfläche.
Der Implementierer hat genau einen `####`-Abschnitt zur read-only Buffer-Map
ergänzt und die Abweichung als Vorbehalt gemeldet; der Reviewer hält die
Auflösung für richtig. Zu `copy()` steht kein Migrationsabschnitt — wer dort in
die neue Prüfung läuft, hatte vorher stille Datenkorruption, es gibt nichts
wiederherzustellen.

## Kleine Befunde des Reviewers (keine Runde ausgelöst)

1. `VertexObjectBuffer.spec.ts:594` — der Regex
   `/VertexObjectBuffer#copy\(\).*1.*4/` nimmt jede Meldung an, in der
   irgendwo eine `1` vor einer `4` steht, und nagelt damit nicht fest, was der
   Testname behauptet. Ein Muster wie `/vertexCount of 1, this buffer one of 4/`
   träfe die Meldung so, wie die Nachbartests den Buffernamen in
   Anführungszeichen festnageln.
2. `cloneVertexObjectDescription.ts:79` — die `in`-Weiche unterscheidet
   strukturell, wo `instanceof` nominal unterschied. Eine
   `VertexObjectDescription`, die nebenher ein Feld `description` trägt, wird nun
   als Descriptor gelesen; die Zusage »Verhalten unverändert« aus Schritt 6 ist
   für diesen einen Fall eine Spur zu breit. Der Zug selbst bleibt richtig.
3. `VertexObjectBuffer.ts:88` und `:94` — `bufferAttributes` und
   `bufferNameAttributes` bleiben öffentliche, schreibbare Maps mit schreibbaren
   Records, während die Tür nebenan zugeht. Steht als Nebenbefund in »Offene
   Befunde«, weil Schritt 2 sie nicht nennt.

## Die Schritte

Diese elf Schritte sind abschließend. Was in den angefassten Dateien daneben
auffällt, wird gemeldet, nicht behoben.

### 1. `copy()` misst beide Richtungen, bevor der erste Buffer geschrieben wird

Datei: `VertexObjectBuffer.ts`, Methode `copy()` (aktuell `:294-348`).

Der Prüfdurchgang, der vor dem ersten Schreibzugriff über alle Buffer
entscheidet (`:317-341`), misst heute nur, ob die Quelle in das Ziel **passt**:
`offset + sourceLength > targetLength` (`:333`). Ein Quell-Buffer, der unter
demselben Namen ein **schmaleres** Layout trägt, kommt durch und wird mit
falschem Stride in das Ziel geschrieben — still, ohne Fehler. Das TSDoc deckt
den Fall mit »Both objects should use the same vertex-object-description« ab;
das ist eine Bitte, keine Prüfung.

Die Regel, die stattdessen gilt und geprüft wird: **Ein Buffer-Paar gehört
zueinander, wenn Name, `itemSize` und `dataType` übereinstimmen und beide
Descriptoren denselben `vertexCount` haben.** Dann ist `sourceLength` exakt
`other.capacity × vertexCount × itemSize`, und die bestehende Längenprüfung
wird zur Folge dieser Regel statt zur einzigen Prüfung.

Umzusetzen:

1. Einmal je Aufruf, **nach** der Prüfung auf die Objektzahl (`:305-309`) und
   **vor** der Schleife über `this.buffers`: unterscheidet sich
   `other.descriptor.vertexCount` von `this.descriptor.vertexCount`, wirf einen
   `RangeError`, der beide Werte nennt, im Stil der Meldungen, die schon dort
   stehen (`VertexObjectBuffer#copy(): …`).
2. In der Schleife, je Buffer-Paar, **vor** der bestehenden Längenprüfung
   (`:333`): unterscheidet sich `source.itemSize` von `buf.itemSize`, wirf einen
   `RangeError`, der den Buffernamen und beide Werte nennt. Unterscheidet sich
   `source.dataType` von `buf.dataType`, wirf einen `TypeError`, der den
   Buffernamen und beide Werte nennt. Ein `TypeError` für die Datentypfrage ist
   das, was `checkBufferArray()` derselben Klasse an anderer Stelle vorliefert.
3. Jede der drei Meldungen endet mit demselben Nachsatz, den die
   »kein Buffer dieses Namens«-Meldung auf `:325-326` trägt: beide Buffer müssen
   aus derselben Vertex-Object-Description gebaut sein.
4. Das TSDoc von `copy()` (`:281-293`) nennt die neue Regel statt der Bitte:
   Welche vier Dinge übereinstimmen müssen, und dass alles vor dem ersten
   Schreibzugriff entschieden wird, sodass eine abgewiesene Kopie das Ziel
   unberührt lässt. Der `@throws`-Block nennt den `TypeError` mit.

Das ist ein Korrektheitsfehler: **zuerst der Regressionstest, rot sehen, dann
beheben.** Der rote Lauf gehört in den Report.

Die Tests gehören in `VertexObjectBuffer.spec.ts` in das bestehende
`describe('a copy the target cannot take buffer for buffer')` (`:497`), neben
die zwei Tests, die dort schon stehen. Drei Tests, je nach dem Muster der
Nachbarn gebaut (Zielinhalt vor dem Aufruf markieren, Wurf erwarten,
Zielinhalt danach unverändert prüfen):

- `a source buffer narrower than its target leaves no buffer of the target written`
  — zwei Descriptoren, deren Attribute denselben Buffernamen belegen, mit
  `size: 4` im Ziel und `size: 2` in der Quelle. **Dieser Test muss vor dem Fix
  rot laufen**; vorher schreibt `copy()` still und wirft nicht.
- `a source of another data type leaves no buffer of the target written`
  — derselbe Buffername über einen ausdrücklich gesetzten `bufferName` in beiden
  Descriptions, mit `type: 'float32'` im Ziel und `type: 'uint32'` in der Quelle.
- `a source describing another vertex count leaves no buffer of the target written`
  — gleiches Attribut, gleicher Buffername, `vertexCount: 4` im Ziel und
  `vertexCount: 1` in der Quelle.

`copyArray()` bleibt, wie es ist: dort kommt ein nacktes `TypedArray` ohne
Layout an, es gibt nichts zu vergleichen.

### 2. Die Buffer-Map eines `VertexObjectBuffer` wird eine read-only Sicht

Datei: `VertexObjectBuffer.ts` (`:68`), dazu `VOBufferPool.ts` (`:289`).

`readonly buffers: Map<string, AttributeBuffer>` ist eine lebende Map mit
schreibbaren Einträgen. `pool.buffer.buffers.get(name)!.serial = 0` verstellt
die Upload-Buchführung genauso, wie es `geometry.bufferSerials.set(…)` tat,
bevor Paket 5 die Geometrie-Sichten geschlossen hat. Die Vordertür ist zu, diese
Tür nicht.

Der Zug ist der, den Paket 5 an den Geometrien gemacht hat:

1. Das Feld wird privat: `readonly #buffers = new Map<string, AttributeBuffer>()`.
   Jede Nutzung innerhalb der Klasse geht auf `this.#buffers` (`:133`, `:136`,
   `:186`, `:189`, `:248`, `:298`, `:317`, `:369`, `:398`, `:416`, `:459`,
   `:493`, `:505`, `:523`, `:526` — die Liste ist der Stand von heute, maßgeblich
   ist der Compiler).
2. Dazu ein Getter mit dem TSDoc, das heute am Feld steht:

   ```ts
   get buffers(): ReadonlyMap<string, Readonly<AttributeBuffer>> {
     return this.#buffers;
   }
   ```

   Die innere `Readonly<AttributeBuffer>`-Sicht ist der Punkt des Schritts: eine
   bloße `ReadonlyMap` schlösse `set()` und `delete()`, aber nicht
   `buf.serial = 0`. Der Inhalt der `typedArray` bleibt schreibbar — die Daten
   schreibt man legitim von außen, die Buchführung nicht.
3. `copy()` liest `other.buffers` (`:318`). Das bleibt so: die Quelle wird nur
   gelesen.
4. `VOBufferPool.ts:289` ist die einzige Stelle außerhalb dieser Klasse, die ein
   Feld eines `AttributeBuffer` schreibt (`buffer.typedArray = typedArray` in
   `fromBuffersData()`). Sie bekommt einen benannten Weg: eine Methode auf
   `VertexObjectBuffer`

   ```ts
   /** @internal */
   setTypedArray(bufferName: string, typedArray: TypedArray): void
   ```

   die das Array des benannten Buffers ersetzt und für einen Namen, den dieser
   Buffer nicht kennt, nichts tut — so, wie `touchBuffer()` es für einen
   unbekannten Namen hält. Ein kurzes TSDoc sagt, wofür sie da ist: der Pool
   ersetzt beim Wiedereinspielen eines Snapshots das ganze Array, statt
   hineinzuschreiben. `fromBuffersData()` ruft sie im `else`-Zweig; das
   `touchBuffer()` darunter bleibt, wo es ist.
   `setTypedArray()` kommt **nicht** in die `public-api.ts`.
5. Nichts sonst ist anzupassen, bis der Compiler etwas anderes sagt. Gemessen:
   außerhalb der Klasse ruft niemand `set`/`delete`/`clear` auf dieser Map, und
   die Specs schreiben ausschließlich **in** die typed arrays, nicht auf die
   Records. Was `pnpm typecheck` darüber hinaus nennt — etwa eine Variable, die
   ausdrücklich `AttributeBuffer` statt `Readonly<AttributeBuffer>` deklariert —
   wird mitgezogen; das gehört zu dieser Änderung.

### 3. `AttributeBufferLayout` und `AttributeBuffer` sagen, was sie tragen

Datei: `VertexObjectBuffer.ts` (`:7-40`).

Dokumentiert sind heute nur die vier Felder, die Paket 3b hinzugefügt hat
(`dirtyFrom`, `dirtyTo`, `dirtySince`, `pickedUpSerial`), dazu `typedArray`.
Ohne TSDoc sind:

- das Interface `AttributeBufferLayout` (`:7`) samt seinen drei Feldern
  `bufferName`, `attributeName`, `offset` (`:8-10`)
- von `AttributeBuffer` (`:13`) das Interface selbst und die Felder
  `bufferName`, `itemSize`, `dataType`, `usageType` (`:14-17`) sowie `serial`
  (`:24`)

Je ein Satz, im Ton der Felder, die schon eins haben. Für `offset` gehört dazu,
worauf sich der Wert bezieht (Elemente innerhalb eines Vertex des Buffers, nicht
Bytes); für `itemSize`, dass es die Elemente **aller** Attribute eines Vertex in
diesem Buffer zusammenzählt; für `serial`, dass es mit jedem Schreibvorgang
steigt und die Zahl ist, gegen die ein Konsument seinen Stand hält.

### 4. Der Kommentar über `pickUpDirtyRange()` sagt, was die Zeile bedeutet

Datei: `VertexObjectBuffer.ts:247-249`.

```ts
// the pool behind this buffer has let go, so there is nothing left to upload from it
const buf = this.buffers.get(bufferName);
if (buf == null) return null;
```

Der Kommentar steht über dem `get`, erklärt aber den `null`-Zweig darunter — und
er ist zu eng: `buf == null` trifft auch einen Buffernamen, den dieser Buffer
schlicht nicht kennt, also einen Tippfehler des Aufrufers und keinen
freigegebenen Pool. Der Kommentar wandert über die `if`-Zeile und nennt beide
Fälle. Kein Rückblick auf einen Vorzustand.

### 5. Der Konstruktor-Kommentar des Descriptors sagt, was er tut

Datei: `VertexObjectDescriptor.ts:96-98`.

```ts
// the copy is what keeps the checks below true for the life of this descriptor: a later
// change to the description handed in here no longer reaches it. It is frozen before it is
// assigned, so freezeDescription() still works on an object it is allowed to write to
```

Das »no longer« ist ein Rückblick auf einen Vorzustand und verstößt gegen die
Konventionen dieses Laufs. Ohne dieses Wort sagt der Satz dasselbe: eine spätere
Änderung an der übergebenen Description erreicht diesen Descriptor nicht. Der
Rest des Kommentars bleibt, wie er ist.

### 6. Der Zyklus zwischen Descriptor und Klonfunktion wird gebrochen

Dateien: `cloneVertexObjectDescription.ts:8` und `:79`.

**Der Befund ist richtig, seine Ursache steht in der Queue anders, als der Code
sie hergibt** — hier die Abweichung samt Grund, gemessen in Zug 0:

`VertexObjectDescriptor.ts:2` importiert `cloneVertexObjectDescription` und
**braucht den Wert**: der Konstruktor ruft die Funktion auf (`:99`).
`cloneVertexObjectDescription.ts:8` importiert `VertexObjectDescriptor` und
braucht den Wert ebenfalls, für genau einen Ausdruck:

```ts
const description = source instanceof VertexObjectDescriptor ? source.description : source;
```

Ein `import type` auf einer der beiden Seiten bricht deshalb den Code, nicht den
Zyklus. Der Zyklus lässt sich nur dort auflösen, wo der Wert nur für eine Weiche
gebraucht wird — und diese Weiche kommt ohne die Klasse aus, weil die Union sie
strukturell unterscheidet: eine `VertexObjectDescription` trägt kein Feld
`description`, ein `VertexObjectDescriptor` schon. TypeScript verengt `in`
über eine Union:

```ts
const description = 'description' in source ? source.description : source;
```

Umzusetzen:

1. Die Weiche auf `:79` auf die `in`-Form umstellen. Darüber ein Satz, warum sie
   so und nicht über `instanceof` entscheidet: damit dieses Modul den Descriptor
   nur als Typ braucht und die beiden Module einander zur Laufzeit nicht mehr
   bedingen.
2. `:8` auf `import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';`
   umstellen — dasselbe, was `getDescriptorOf.ts:1` bereits tut. Der Lint
   erzwingt `consistent-type-imports`; die Import-Reihenfolge folgt dem, was im
   Modul üblich ist.
3. `VertexObjectDescriptor.ts:2` bleibt unverändert: dort ist der Wert-Import
   richtig, und nach Schritt 1 ist er die einzige Richtung, die übrig bleibt.

Signatur, Überladungen und Verhalten von `cloneVertexObjectDescription()`
bleiben unverändert.

### 7. `createVertexObjectPrototype()` gibt `entries` einen Typ statt eines Casts

Datei: `createVertexObjectPrototype.ts` (`:91`, `:148-152`, `:155`).

`Object.fromEntries(entries as [])` (`:155`) castet auf den leeren Tuple-Typ und
schleust `entries` am Typsystem vorbei. Die Ursache ist `const attrEntries:
unknown[] = []` auf `:91`, über das `flatMap` den Typ von `entries` erbt.

1. `:91` wird `const attrEntries: [string, PropertyDescriptor][] = [];`
2. Der `methods`-Zweig (`:148-152`) gibt seinem `map`-Callback denselben
   Rückgabetyp, sonst liefert er `(string | {value: unknown})[]`:
   `.map(([key, value]): [string, PropertyDescriptor] => [key, {value}])`
3. `:155` wird `const props = Object.fromEntries(entries);` — der Cast fällt weg.

Was der Compiler an den `push`-Aufrufen dazwischen noch anmerkt, wird mitgezogen.
Verhalten und erzeugte Prototypen bleiben unverändert.

### 8. Die Spec ohne Sinon-Nutzung legt kein Sandbox mehr an

Datei: `cloneVertexObjectDescription.spec.ts` (`:1`, `:76`, `:78-80`).

`createSandbox` wird importiert, ein `sandbox` angelegt und in `afterEach`
zurückgesetzt, ohne dass ein Test der Datei je etwas darauf stellt. Import,
`const sandbox` und der `afterEach`-Block fallen weg; `afterEach` fällt aus dem
`vitest`-Import, wenn es sonst nirgends in der Datei benutzt wird. `sinon`
bleibt eine Abhängigkeit des Pakets — fünfzehn weitere Specs benutzen es.

### 9. Die TSDoc-Links in `types.ts` zeigen nur noch auf das, was die Datei kennt

Datei: `types.ts`.

Ein `{@link X}` löst nur auf, wenn `X` im Scope der Datei steht. `types.ts`
importiert `VertexObjectBuffer` als Typ (`:2`) — die Links darauf lösen auf und
bleiben. Sechs Links zeigen auf Symbole, die die Datei nicht kennt:

- `:58` `{@link VertexAttributeDescriptor#autoTouch}`
- `:121` `{@link VertexAttributeDescriptor#getterName}`
- `:128` `{@link VertexAttributeDescriptor#setterName}`
- `:145` `{@link VertexObjectDescriptor}`
- `:187` `{@link VertexObjectDescriptor}`
- `:233` `{@link VOBufferPool}`

Diese sechs werden zu einfachen Backticks — `` `VertexAttributeDescriptor#getterName` ``
und so fort. Der Satz, in dem der Link steht, bleibt im Übrigen, wie er ist.

**Nicht** der Weg: die drei Symbole zusätzlich als `import type` holen. Der Lint
dieses Projekts fährt `@typescript-eslint/no-unused-vars` als `error`, und diese
Regel zählt eine Nutzung in einem Doc-Kommentar nicht — ein Import, der den Link
auflösen würde, wäre ein Lint-Fehler. Ein Doc-Generator, für den sich der Aufwand
lohnte, läuft im Projekt nicht; TypeDoc ist nirgends konfiguriert.

Links auf Typen, die `types.ts` selbst deklariert, und die auf
`VertexObjectBuffer` bleiben unangetastet.

### 10. `createTypedArray()` nennt sich in seinem Fehler

Datei: `createTypedArray.ts:26`.

```ts
throw new Error(`unknown typed-array data-type: '${dataType}'`);
```

Der Text nennt den Wert, aber weder das Modul noch die Funktion. Nach den
Meldungen, die Paket 5 benannt hat, ist das die letzte im Modul, die aus der
Reihe fällt. Die Meldung wird auf dasselbe Muster gezogen:
`createTypedArray(): unknown data type '<wert>'` — Funktionsname vorn, Wert im
Text. Die Fehlerklasse bleibt `Error`: der Wert ist weder ein Bereichs- noch ein
Typfehler im Sinne der Nachbarstellen, sondern ein Name, den dieses Modul nicht
kennt.

### 11. Das CHANGELOG hält fest, was sich an der Oberfläche bewegt hat

Datei: `packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`,
Unterabschnitt `### Changed`. Keep a Changelog 1.1.0, der Ton der Einträge, die
dort schon stehen. Zwei Einträge:

1. `VertexObjectBuffer#copy()` entscheidet über das Layout beider Seiten, bevor
   der erste Buffer geschrieben wird: Name, `itemSize`, `dataType` und der
   `vertexCount` beider Descriptoren müssen übereinstimmen, sonst wirft es einen
   `RangeError` beziehungsweise `TypeError`, der den Buffer und beide Werte
   nennt. Ein Quell-Buffer mit schmalerem Layout wurde vorher still mit falschem
   Stride in das Ziel geschrieben. Eine abgewiesene Kopie lässt das Ziel
   unberührt.
2. `VertexObjectBuffer#buffers` ist eine read-only Sicht
   (`ReadonlyMap<string, Readonly<AttributeBuffer>>`) — dieselbe Tür, die an den
   Geometrien bereits zu ist, eine Ebene tiefer. Der Inhalt der typed arrays
   bleibt schreibbar; was nicht mehr geht, ist ein Schreibzugriff auf die
   Buchführung eines Buffers (`serial`, die Dirty-Felder) und auf die Map selbst.

Kein Migrationsabschnitt: wer `copy()` mit zueinander passenden Buffern ruft und
die Buffer-Map liest, merkt von beidem nichts. Ob der Skill `updating-changelog`
darüber hinaus etwas verlangt, entscheidet der Skill.

## Die Befunde im Volltext

Aus »Offene Befunde« in `./remediation-plan.md`, Stand der zweiten Drain-Runde.
Die Zeilennummern sind die der Meldung; wo Zug 0 eine Verschiebung gemessen hat,
steht sie oben beim Schritt.

**1 · Folge aus Paket 5 · low · `VertexObjectBuffer.ts:288-348` (`copy()`)** — ein
Quell-Buffer, der **schmaler** ist als sein Ziel, kommt durch den Prüfdurchgang,
den Paket 5 eingezogen hat, und wird still mit falschem Layout geschrieben;
geprüft wird nur, ob die Elemente hineinpassen, nicht ob die Layouts zueinander
gehören. Das TSDoc deckt es mit »Both objects should use the same
vertex-object-description« ab — eine Bitte, keine Prüfung.

**2 · Folge aus Paket 5 · info · `VertexObjectBuffer.ts:247`** — der Kommentar
»the pool behind this buffer has let go, so there is nothing left to upload from
it« steht über `const buf = this.buffers.get(bufferName);` und erklärt die Zeile
darunter. Er ist außerdem zu eng: `buf == null` trifft auch einen Buffernamen,
den dieser Buffer schlicht nicht kennt — ein Tippfehler des Aufrufers, kein
disposter Pool.

**3 · vorbestehend · low · `VertexObjectBuffer.ts:68`** — `readonly buffers:
Map<string, AttributeBuffer>` ist eine lebende Map mit schreibbaren Einträgen;
`pool.buffer.buffers.get(name)!.serial = 0` verstellt die Upload-Buchführung
genauso, wie es `geometry.bufferSerials.set(…)` tat, bevor Paket 5 die
Geometrie-Sichten schloss. Die Vordertür ist zu, diese Tür nicht. Sie zu
schließen ist nicht billig: die Specs schreiben durch diese Map, und
`AttributeBuffer` trägt seit Paket 3b vier Felder, die `VertexObjectBuffer`
selbst fortschreibt.

**4 · vorbestehend · info · `VertexObjectBuffer.ts:7-17`** —
`AttributeBufferLayout` samt seiner drei Felder und die ersten sechs Felder von
`AttributeBuffer` (`bufferName` bis `serial`) tragen kein TSDoc; dokumentiert
sind nur die vier Felder, die Paket 3b hinzugefügt hat. Dieselbe Lücke, die
Paket 4 in `types.ts` geschlossen hat, eine Datei weiter.

**5 · vorbestehend · info · `VertexObjectDescriptor.ts:84-85`** — der
Konstruktor-Kommentar sagt, eine spätere Änderung an der übergebenen Description
erreiche den Descriptor »no longer«. Das ist ein Rückblick auf einen Vorzustand
und verstößt gegen die Konventionen dieses Laufs; der Satz stammt aus Paket 1.
Ohne das »no longer« sagt er dasselbe.

**6 · vorbestehend · low · `VertexObjectDescriptor.ts:2` und
`cloneVertexObjectDescription.ts:2`** — die beiden Module importieren einander
als Wert, nicht als Typ. Es läuft, weil beide Seiten den Import erst zur
Aufrufzeit brauchen, ist aber ein Zyklus, der bricht, sobald eines der Module
einen Top-Level-Ausdruck bekommt, der das andere benutzt.

**7 · vorbestehend · low · `createVertexObjectPrototype.ts:155`** —
`Object.fromEntries(entries as [])` castet auf den leeren Tuple-Typ und schleust
`entries` (`unknown[]`) am Typsystem vorbei. Es läuft, sagt aber nichts darüber,
was `entries` trägt; ein `[string, PropertyDescriptor][]` als Typ von `entries`
selbst machte den Cast überflüssig.

**8 · vorbestehend · info · `cloneVertexObjectDescription.spec.ts:1, 76-80`** —
`createSandbox` aus `sinon` wird importiert, ein `sandbox` angelegt und in
`afterEach` zurückgesetzt, aber kein Test der Datei benutzt es. Toter Code samt
überflüssiger Abhängigkeit im Test.

**9 · vorbestehend · info · `types.ts:121` und `:128`** — die
`{@link VertexAttributeDescriptor#getterName}` und `#setterName` zeigen auf ein
Symbol, das diese Datei nicht importiert; im Editor und in TypeDoc löst der Link
nicht auf, und kein Lint fängt es. Paket 4 hat zwei Links derselben Machart
dazugelegt (`:145`, `:206`), die in der Paketdatei als kleiner Befund stehen;
die zweite Fundstelle `:128` hat Paket 5 nachgetragen.

**10 · vorbestehend · info · `createTypedArray.ts:26`** — `throw new Error()` mit
dem Text `unknown typed-array data-type: '<wert>'` nennt den Wert, aber weder das
Modul noch die Funktion. Nach den drei Meldungen, die Paket 5 benannt hat, die
einzige verbliebene im Modul, die aus der Reihe fällt.

## Abgleich (Zug 0, 2026-09-20, gegen `663070ec`)

Kein Befund ist gegenstandslos. Je Befund: was an der Fundstelle steht.

| # | Fundstelle laut Queue | Befund | Fundstelle heute |
| --- | --- | --- | --- |
| 1 | `VertexObjectBuffer.ts:288-348` | steht | `copy()` bei `:294-348`, der Prüfdurchgang bei `:317-341`, die einzige Längenprüfung auf `:333` |
| 2 | `VertexObjectBuffer.ts:247` | steht | unverändert, Kommentar `:247` über `:248` |
| 3 | `VertexObjectBuffer.ts:68` | steht | unverändert |
| 4 | `VertexObjectBuffer.ts:7-17` | steht, Umfang gemessen | `AttributeBufferLayout` (`:7`) und drei Felder, dazu `AttributeBuffer` (`:13`) mit `bufferName`…`usageType` (`:14-17`) und `serial` (`:24`) — **fünf** Felder ohne TSDoc, nicht sechs: `typedArray` hat seit Paket 5 eins |
| 5 | `VertexObjectDescriptor.ts:84-85` | steht, gewandert | jetzt `:96-98`; Paket 5 hat das TSDoc darüber verlängert |
| 6 | `…Descriptor.ts:2`, `clone….ts:2` | steht, **andere Ursache** | zweite Fundstelle nach `:8` gewandert; beide Seiten brauchen den **Wert**, nicht nur den Typ (`Descriptor:99` ruft die Funktion, `clone:79` prüft `instanceof`) — siehe Schritt 6 |
| 7 | `createVertexObjectPrototype.ts:155` | steht | unverändert; Ursache ist `const attrEntries: unknown[]` auf `:91` |
| 8 | `cloneVertexObjectDescription.spec.ts:1, 76-80` | steht | unverändert; `sandbox` wird in keinem Test der Datei benutzt |
| 9 | `types.ts:121`, `:128` | steht, Umfang gemessen | sechs Links lösen nicht auf (`:58`, `:121`, `:128`, `:145`, `:187`, `:233`); die auf `VertexObjectBuffer` lösen auf, weil `:2` den Typ importiert |
| 10 | `createTypedArray.ts:26` | steht | unverändert |

Gemessen und für die Schritte gebraucht:

- **Zu Schritt 2.** Außerhalb von `VertexObjectBuffer.ts` ruft niemand
  `set`/`delete`/`clear` auf der Buffer-Map — diese drei stehen nur in der Klasse
  selbst (`:136`, `:189`, `:526`). Genau **eine** Stelle außerhalb schreibt ein
  Feld eines `AttributeBuffer`: `VOBufferPool.ts:289`. Alle übrigen Leser
  (`initializeAttributes.ts:41`, `attributeNamesOf.ts:12`,
  `GeometryAttributeSlots.ts:164`, `GeometryRoutes.ts:175`,
  `createVertexObjectPrototype.ts:12/23/40/70/89`, `VertexObjectPool.ts:77-82`,
  `VOBufferPool.ts:236/270/284` und die Specs) lesen die Records und schreiben
  allenfalls **in** die typed arrays. Der Blast Radius ist damit kleiner, als der
  Befund gefürchtet hat.
- **Zu Schritt 9.** Das Projekt konfiguriert kein TypeDoc, und
  `@typescript-eslint/no-unused-vars` steht in `eslint.config.mjs` auf `error`.

## Entscheidungen dieses Zug 0

Zwei Abweichungen von dem, was die Queue vorschlägt, je mit Grund:

1. **Schritt 6 wird über die `in`-Weiche gelöst, nicht über `import type` auf
   beiden Seiten** — weil beide Seiten den Wert brauchen und ein Typ-Import den
   Code bräche. Der Zyklus wird dort aufgelöst, wo der Wert nur eine Weiche
   stellt. Verhalten und Signatur bleiben.
2. **Schritt 9 nimmt alle sechs nicht auflösenden Links in `types.ts`, nicht nur
   die zwei gemeldeten** — dieselbe Ursache, dieselbe Datei, ein Durchgang. Die
   übrigen Moduldateien tragen dieselbe Machart; sie bleiben draußen, siehe
   unten.

## Was dieses Paket **nicht** anfasst

Ein Nebenbefund aus Zug 0, in »Offene Befunde« eingetragen und dort mit `→ Scope`
beurteilt: dieselbe Link-Machart steht in sieben weiteren Dateien des Moduls, mit
19 Stellen — `VOBufferPool.ts` allein trägt acht Links auf `VertexObjectPool`,
dazu `attributeNamesOf.ts` (2), `InstancedVOBufferGeometry.ts` (3),
`VertexAttributeDescriptor.ts` (2), `VertexObjectBuffer.ts` (2),
`VertexObjectDescriptor.ts` (1) und `VOBufferGeometry.ts` (2). Nicht in dieses
Paket aufgenommen, obwohl die Ursache dieselbe ist: die Entscheidung fällt je
Stelle neu (ein `{@link dispose}` auf ein Member der eigenen Klasse löst auf, ein
`{@link VertexObjectPool}` nicht), sie zöge sechs Dateien zusätzlich in den Diff,
die dieses Paket sonst nicht berührt, und der Ertrag ist Kosmetik ohne
Laufzeitwirkung. Überwiegend vorbestehend: von 37 Links im Modul standen 32
bereits vor dem ersten Commit dieses Laufs (gezählt mit `git show 5657be6f:`).

Ebenfalls draußen: `copyArray()` (kein Layout auf der Quellseite, das sich
vergleichen ließe) und `VertexObjectDescriptor.ts:2` (dort ist der Wert-Import
richtig).
