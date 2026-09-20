# Paket 5 — Pool, Buffer und Geometrie: benannte Fehler, dichte Oberflächen, ein vollständiger Migrationshinweis

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-IDs. Sechs Einträge aus »Offene Befunde« (vorbestehend,
  gemeldet aus den Paketen 1, 1b und 3b), ein siebter, den Zug 0 dazugenommen
  hat, eine offene `Folgen:`-Zeile aus Paket 3b und drei Folgen aus Paket 4.
  Alle stehen unten unter »Befunde im Volltext« und werden als Schritt 1 bis 10
  geführt.
- Ziel: Wer einen Pool falsch bedient, liest im Fehler, welche Klasse, welche
  Methode und welcher Wert gemeint ist — und findet keine öffentliche Map mehr,
  über die er die Upload-Buchführung verstellen kann.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/GeometryRoutes.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjects.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.ts`
  - `packages/twopoint5d/src/vertex-objects/types.ts`
  - `packages/twopoint5d/src/vertex-objects/public-api.ts`
  - `packages/twopoint5d/CHANGELOG.md`

  Dazu jede weitere Stelle, die einer der Typverengungen aus Schritt 3, 4 und 5
  nicht mehr genügt. Die Liste oben ist die erwartete, nicht die erlaubte:
  `pnpm typecheck` nennt die übrigen, und sie gehören mitgezogen.
- Verify: `pnpm run ci`. Nx bedient `test:ci` und `test:browser` gern aus dem
  Cache (`2/2 hit`), und dann misst der Lauf für diese beiden Gates nichts.
  Beide deshalb einmal nachfahren:
  `pnpm nx run-many -t test --projects=tag:ci --skipNxCache` und
  `pnpm nx run-many -t test --projects=tag:browser --skipNxCache`. Für den
  Browserlauf gilt die Entscheidung im Plan-Kopf: ein reiner
  Firefox-Verbindungsabbruch ist vorbestehende Flakiness, ein Fehlschlag auf
  Chromium ist rot. Während der Arbeit reicht
  `pnpm nx test twopoint5d -- src/vertex-objects/<datei>.spec.ts`.
- Commit: `fix(vertex-objects): name the class, the method and the value in the errors a bad capacity and a copy past the end of a buffer throw, hand out the buffer maps of a geometry and the containers of a descriptor as read-only views, and say in the types that the description of a descriptor is frozen`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · alle zehn Befunde stehen noch, keiner
    gegenstandslos · gewanderte Fundstellen: `VOBufferGeometry.ts:19` → `:18-19`,
    `InstancedVOBufferGeometry.ts:29-30` → `:27`, `:29-30` und `:33` (vier Felder
    statt zwei), `VertexObjectBuffer.ts:287-304` → `:288-304`, `:318-331` →
    `:319-333`, `VOBufferPool.ts:232` → `:239-240`, die CHANGELOG-Stelle
    `:279-289` aus Paket 3b → `:313-321` · aus »Offene Befunde« dazugenommen:
    `VertexObjectDescriptor.ts:40-41` (gleiche Ursache wie Schritt 3), die
    übrigen sechs offenen Einträge bleiben für die zweite Drain-Runde liegen ·
    im Abgleich gefunden und in Schritt 2 aufgenommen: `VOBufferPool.ts:77-79`
    wirft dieselbe nackte Meldung wie `VertexObjectPool.ts:58-60`
  - 2026-09-20 Zug 1: Implementierer beauftragt · Modell stärkste Stufe, Effort
    `high` · Brief `paket-5.impl-1.brief.txt`, Report `paket-5.impl-1.json`
  - 2026-09-20 Zug 2: Report `FERTIG` · 17 Dateien geändert, keine neue ·
    mitgezogen über die Planliste hinaus: `VertexAttributeDescriptor.ts`,
    `selectAttributes.ts`, `selectBuffers.ts` · `public-api.ts` unverändert, weil
    sie `export type * from './types.js'` bereits trägt · Arbeitsbaum schmutzig ·
    eigener Verify-Lauf `pnpm run ci` exit=0 (`paket-5.verify.log`), beide Suites
    ohne Nx-Cache nachgefahren, ci-exit=0 und browser-exit=0
    (`paket-5.verify-nocache.log`)
  - 2026-09-20 Zug 3: Reviewer beauftragt · Modell stärkste Stufe, Effort `high` ·
    Diff `paket-5.diff` (1285 Zeilen), Report `paket-5.review-1.json`
    · Urteil: alle zehn Schritte erfüllt, kein `kritisch`, 1 `wichtig`, 8 `klein`
  - 2026-09-20 Zug 4 Runde 1: offen war 1 `wichtig` (die Vorabprüfung in `copy()`
    fängt den halb beschriebenen Buffer im einzig möglichen Fall nicht ab) plus 6
    `klein`, die mitgingen · derselbe Implementierer per `--resume
    24bacbd4-c0bf-4b34-b92f-be2555a7772b`, Modell und Effort unverändert · zurück
    kam `FERTIG`: `copy()` prüft in zwei Durchläufen (erst jeder Buffer auf Name
    und Elementlänge, dann geschrieben), zwei neue Regressionstests vor der Runde
    rot gesehen, drei Tests für den Offset-Guard, vier CHANGELOG-Stellen und der
    `dispose()`-Kommentar berichtigt · Verify `paket-5.verify-r1.log` exit=0,
    ci-exit=0 und browser-exit=0 ohne Cache · zweiter Reviewer auf
    `paket-5.runde-1.diff` (1410 Zeilen), Report `paket-5.review-2.json`
    · Urteil: der wichtige Befund behoben (der Reviewer hat die Rotheit
    nachgestellt), kein `kritisch`, kein `wichtig`, 8 `klein`
  - 2026-09-20 Zug 4 Runde 2: vier der acht kleinen Befunde als `wichtig`
    eingestuft — dreimal Doku, die durch diesen Umbau eine falsche Zusage macht
    (`CHANGELOG.md:157` und `:193`, das TSDoc von `copy()`), und die nackte
    Meldung in `VOBufferPool#fromBuffersData()`, dieselbe Ursache wie Schritt 2 ·
    drei weitere kleine gingen mit · derselbe Implementierer per `--resume`,
    Modell und Effort unverändert (kein frischer Prozess: Runde 1 war nicht
    gescheitert, die Befunde sind eng umrissene Textkorrekturen, und der
    Prompt-Cache trägt) · zurück kam `FERTIG`: Leer-Prüfung vor die Guards von
    `copy()` gezogen (`this.buffers.size === 0`, damit auch eine Description ohne
    Attribute ihr Stillschweigen behält), `fromBuffersData()` wirft einen
    benannten `RangeError`, `CHANGELOG.md:157` in `:42` aufgenommen und
    gestrichen, Paar-Array statt Zwischen-Map, zwei neue Regressionstests vor der
    Runde rot gesehen · Verify `paket-5.verify-r2.log` exit=0, ci-exit=0 und
    browser-exit=0 ohne Cache · dritter Reviewer auf `paket-5.runde-2.diff`
    (1506 Zeilen), Report `paket-5.review-3.json`
    · Urteil: alle sieben behoben, kein `kritisch`, kein `wichtig`, 3 `klein`
  - 2026-09-20 Zug 4 Runde 3: zwei der drei kleinen Befunde als `wichtig`
    eingestuft — `CHANGELOG.md:43` sagte, die Buffer-Maps würden allein über
    `attachInstancedPool()` und `detachInstancedPool()` geschrieben, was für
    `bufferSerials` und für `VOBufferGeometry` nicht stimmt, und das `@throws` von
    `copy()` versprach einen Wurf, den der Early-Return zurücknimmt · frischer
    Implementierer auf mittlerer Stufe, Effort `low` (drei benannte Textstellen
    mit Wortlaut im Brief; kein Resume, weil ein Opus-Kontext für Transkription
    nichts beiträgt) · Nachfassung per `--resume cea75b49-bb96-4ed5-a64c-aeb476c8d55a`
    (`paket-5.impl-4-versuch-2.json`): der gemeldete Nebenbefund an
    `VertexObjectBuffer.ts:284-285` war dieselbe Ursache einen Satz weiter, der
    erste Brief war zu eng geschnitten · Prosaabsatz und `@throws` zu einer
    Fassung zusammengelegt statt einzeln geflickt · Verify
    `paket-5.verify-r3.log` exit=0, ci-exit=0, browser-exit=0 · vierter Reviewer
    auf `paket-5.runde-3.diff`, mittlere Stufe (kleiner, mechanischer Zuwachs),
    Report `paket-5.review-4.json` · Urteil: alle drei behoben, die TSDoc-Fassung
    Pfad für Pfad geprüft, kein `kritisch`, kein `wichtig`, 2 `klein`
  - 2026-09-20 Zug 4 Runde 4: die beiden kleinen mitgenommen, weil beide mit
    Wortlaut vorlagen und dieselbe Überversprechung betrafen, die das TSDoc gerade
    losgeworden war · Resume desselben Prozesses, Modell und Effort unverändert ·
    `CHANGELOG.md:193` nennt jetzt für beide Methoden, was auf einem Buffer ohne
    etwas zu beschreiben geschieht, und der Test `copy() into a buffer over a
    description without attributes does nothing, whatever the source brings` pinnt
    die zweite Hälfte der TSDoc-Zusage · Verify `paket-5.verify-r4.log` exit=0,
    ci-exit=0, browser-exit=0 · fünfter Reviewer auf `paket-5.runde-4.diff`,
    mittlere Stufe, Report `paket-5.review-5.json` · er hat die fehlende
    Gegenprobe selbst nachgeholt: Early-Return entfernt, genau die zwei Tests des
    Early-Return fielen, Arbeitsbaum wiederhergestellt · Urteil: beide behoben,
    kein `kritisch`, kein `wichtig`, 2 `klein` · damit endet die Kette
  - 2026-09-20 Zug 5: Arbeitsbaum gegen `paket-5.runde-4.diff` geprüft und
    byte-identisch befunden (der fünfte Reviewer hatte für seine Gegenprobe eine
    Datei mutiert und zurückgespielt) · Verify trotzdem noch einmal gefahren:
    `paket-5.verify-final.log` exit=0, ci-exit=0, browser-exit=0 ohne Cache ·
    17 Dateien gezielt gestaged, Commit `663070ec`, Arbeitsbaum danach sauber ·
    Commit-Message: der Titel aus dieser Datei, ergänzt um die Atomarität einer
    abgewiesenen Kopie, dazu ein Body für die sechs Schritte, die der Titel nicht
    trägt, und ein `BREAKING CHANGE:`-Footer für die vier Typverengungen

## Vorgehen

Die Schritte sind voneinander unabhängig und dürfen in dieser Reihenfolge
gearbeitet werden. Schritt 1 ist der einzige Korrektheitsfehler des Pakets und
braucht seine Regressionstests zuerst rot.

### 1. `copy()` und `copyArray()` prüfen den Zielbereich, bevor sie schreiben

`VertexObjectBuffer#copy()` (`:288-304`) und `#copyArray()` (`:319-333`) rechnen
den Zieloffset in einen Array-Index um und schreiben los. Passt die Quelle nicht
in den Zielbuffer, wirft erst `TypedArray#set()` — bei `copy()` mitten in einer
Schleife, die vorherige Buffer schon beschrieben hat. Der Buffer bleibt halb
beschrieben zurück, und die Meldung nennt weder die Klasse noch die Methode noch
den Buffer.

**Zuerst die Regressionstests**, in `VertexObjectBuffer.spec.ts`, beide vor dem
Fix rot gesehen (der rote Lauf gehört in den Report):

- ein Buffer der Kapazität 4, `copy()` aus einem Buffer derselben Description
  mit Kapazität 3 und `targetObjectOffset = 2`: erwartet einen `RangeError`,
  dessen Meldung `VertexObjectBuffer#copy()` nennt, **und** dass der Zielbuffer
  danach unverändert ist — der Test schreibt vorher einen Wert in das letzte
  Objekt jedes Buffers und liest ihn danach zurück. Der zweite Teil ist der
  eigentliche Befund: ohne die Vorabprüfung ist der erste Buffer bereits
  geschrieben, wenn der zweite wirft.
- `copyArray()` mit einem Quellarray, das über die Kapazität hinausreicht:
  erwartet einen `RangeError`, dessen Meldung `VertexObjectBuffer#copyArray()`
  und den Buffernamen nennt, und einen unveränderten Buffer.

**Dann der Fix.** In `copy()`, vor der `for`-Schleife:

```ts
if (!Number.isInteger(targetObjectOffset) || targetObjectOffset < 0) {
  throw new RangeError(
    `VertexObjectBuffer#copy(): targetObjectOffset must be a non-negative integer, got ${String(targetObjectOffset)}`,
  );
}
if (targetObjectOffset + other.capacity > this.capacity) {
  throw new RangeError(
    `VertexObjectBuffer#copy(): ${other.capacity} objects at offset ${targetObjectOffset} do not fit a buffer of ${this.capacity}`,
  );
}
```

In `copyArray()` die Objektzahl vor das `set()` ziehen — sie wird dort bereits
berechnet, nur drei Zeilen zu spät — und gegen die Kapazität halten:

```ts
// as many objects as the source fills, rounded up: a source that ends inside an object still
// wrote into that object
const objCount = Math.ceil(source.length / (this.descriptor.vertexCount * buf.itemSize));
if (!Number.isInteger(targetObjectOffset) || targetObjectOffset < 0) {
  throw new RangeError(
    `VertexObjectBuffer#copyArray(): targetObjectOffset must be a non-negative integer, got ${String(targetObjectOffset)}`,
  );
}
if (targetObjectOffset + objCount > this.capacity) {
  throw new RangeError(
    `VertexObjectBuffer#copyArray(): buffer "${bufferName}" takes ${objCount} objects at offset ${targetObjectOffset}, which does not fit a buffer of ${this.capacity}`,
  );
}
```

Der bestehende Kommentar über `objCount` wandert mit nach oben; unten bleibt nur
der `#markDirty()`-Aufruf.

Die Grenze ist `>`, nicht `>=`: `clone()` ruft `copy(this)` mit Offset 0 auf
einem Buffer gleicher Kapazität, und `0 + capacity > capacity` ist falsch. Ein
kürzeres Quellarray in `copyArray()` bleibt erlaubt — nur der Überlauf wirft.

Beide Meldungen folgen dem Ton von `checkBufferArray.ts`: Klasse und Methode
vorn, die Werte im Text. Vor dem Schreiben prüfen, nicht beim Schreiben — genau
das ist, was den halb beschriebenen Buffer verhindert.

Vor dem Abschluss dieses Schritts: `grep -rn "\.copy(\|\.copyArray(" packages apps --include=*.ts --include=*.js`
über die Aufrufer laufen lassen und sicherstellen, dass keiner der bestehenden
Aufrufe unter die neue Prüfung fällt.

### 2. Eine unzulässige Kapazität wirft einen benannten `RangeError`

Zwei Stellen werfen dieselbe nackte Meldung `'Capacity must be a non-negative
integer'` für dieselbe Sache, und beide nennen weder Klasse noch Methode noch
Wert. Die Nachbarstellen im Modul machen es vor:
`VertexObjectBuffer.ts:122` wirft `` `VertexObjectBuffer: ${name} must be a
non-negative integer, got ${String(capacity)}` ``, der `usedCount`-Setter in
`VOBufferPool.ts:110-112` wirft `` `VOBufferPool#usedCount must be an integer,
got ${value}` ``.

- `VertexObjectPool.ts:58-60`:

  ```ts
  throw new RangeError(`VertexObjectPool#resize(): capacity must be a non-negative integer, got ${String(capacity)}`);
  ```

- `VOBufferPool.ts:77-79` — der Konstruktor, dieselbe Ursache eine Datei weiter.
  Die Kapazität kommt dort entweder als Zahl oder aus `buffersData.capacity`;
  die Meldung nennt, welches der beiden gemeint ist, wie `VertexObjectBuffer.ts`
  es tut:

  ```ts
  const capacityName = typeof capacityOrData === 'number' ? 'capacity' : 'buffersData.capacity';
  throw new RangeError(`VOBufferPool: ${capacityName} must be a non-negative integer, got ${String(capacity)}`);
  ```

`RangeError` erbt von `Error`, ein `toThrow(Error)` bleibt also grün. Drei Tests
prüfen den alten Wortlaut und werden mitgezogen:
`VertexObjectPool.spec.ts:466`, `:472` und `:764-765`. Der Implementierer sucht
mit `grep -rn "Capacity must be a non-negative integer" packages apps` nach
weiteren, bevor er den Schritt schließt.

Die zweite Meldung in `resize()` — die über `isAttachedToGeometry` — bleibt, wie
sie ist: sie nennt die Methode, beschreibt einen Zustand und keinen Wertebereich,
und `Error` ist dafür der richtige Typ.

### 3. Die Buffer-Maps einer Geometrie gehen als Lesesicht nach außen

Sechs öffentliche Felder geben eine veränderbare `Map` heraus; `readonly` schützt
dort nur die Referenz. Wer in `bufferSerials` schreibt, verstellt genau das
Serial, gegen das `GeometryRoutes#syncUploads()` den Dirty-Range abholt, und kann
Uploads unterdrücken. Paket 2 hat die drei `extraInstanced*`-Sichten bereits auf
`ReadonlyMap` gezogen; diese sind stehen geblieben.

Der Zug ist derselbe wie der, den Paket 4 für `basePrototype` und `methods`
gemacht hat: **ein privates Feld hält die Map, ein Getter gibt sie als
`ReadonlyMap` heraus.** Kein zweites Feld neben dem privaten — zwei Felder für
dieselbe Referenz wären genau der Befund, den Paket 4 eine Datei weiter behoben
hat, und ein Getter hält die Sicht zugleich von der enumerablen Oberfläche der
Instanz fern.

In `VOBufferGeometry.ts`:

```ts
readonly #buffers: Map<string, BufferLike> = new Map();
readonly #bufferSerials: Map<string, number> = new Map();

/** The three.js buffer behind each buffer name of the pool. */
get buffers(): ReadonlyMap<string, BufferLike> {
  return this.#buffers;
}

/** The serial this geometry last saw for each of those buffers. */
get bufferSerials(): ReadonlyMap<string, number> {
  return this.#bufferSerials;
}
```

Intern wandern alle Stellen auf die privaten Felder: der
`initializeAttributes()`-Aufruf (`:45`), der `#routes.add()`-Aufruf (`:49`), der
`#slots.releaseRoute(this, this.#buffers)`-Aufruf (`:84`) und die beiden
`clear()` in `dispose()` (`:91-92`).

In `InstancedVOBufferGeometry.ts` dasselbe für alle vier Maps — `baseBuffers`
(`:27`), `baseBufferSerials` (`:29`), `instancedBufferSerials` (`:30`) und
`instancedBuffers` (`:33`). `baseBuffers` bleibt optional: privat
`#baseBuffers?: Map<string, BufferLike>`, der Getter antwortet
`ReadonlyMap<string, BufferLike> | undefined`. Das TSDoc über `baseBuffers`
(»Set exactly when `basePool` is …«) bleibt erhalten und wandert an den Getter.
Betroffene Stellen: `:118-122`, `:129-133`, `:388-391` und `:409-412`.

In `GeometryRoutes.ts` die inneren Maps der beiden `attached*`-Sichten
mitziehen — sonst steht die Seitentür neben der geschlossenen Vordertür weiter
offen, denn `geometry.extraInstancedBufferSerials.get('foo')!.set('bar', 99)`
erreicht dasselbe Serial:

```ts
readonly attachedBuffers: ReadonlyMap<string, ReadonlyMap<string, BufferLike>> = projectValues(
  this.#attached,
  (route) => route.buffers,
);

readonly attachedBufferSerials: ReadonlyMap<string, ReadonlyMap<string, number>> = projectValues(
  this.#attached,
  (route) => route.bufferSerials,
);
```

Und in `InstancedVOBufferGeometry.ts:44-45` die beiden Felder, die darauf zeigen,
auf denselben Typ. `GeometryRoute#buffers` und `#bufferSerials` bleiben intern
veränderbar (`AttributeRoute` bzw. `Map<string, number>`): `GeometryRoutes`
schreibt in beide, das ist seine Aufgabe, und der Typ ist nicht Teil der
öffentlichen Oberfläche.

### 4. Die Container eines Descriptors gehen als Lesesicht nach außen

`VertexObjectDescriptor.ts:40-41` — `attributes` (eine `Map`) und `bufferNames`
(ein `Set`) sind `readonly`-Felder auf veränderbaren Containern.
`descriptor.attributes.delete('pos')` macht den Descriptor uneins mit seiner
eingefrorenen Description. Derselbe Zug wie Schritt 3, dieselbe Machart wie bei
den `extraInstanced*`-Sichten:

```ts
readonly #attributes: Map<string, VertexAttributeDescriptor> = new Map();
readonly #bufferNames: Set<string> = new Set();

/** The descriptor of each attribute, keyed by the name the geometry gives it. */
get attributes(): ReadonlyMap<string, VertexAttributeDescriptor> {
  return this.#attributes;
}

/** The names of the buffers the attributes of this descriptor are laid out in. */
get bufferNames(): ReadonlySet<string> {
  return this.#bufferNames;
}
```

Der Konstruktor (`:88-93`) füllt die privaten Felder; die Zuweisungen
`this.attributes = new Map()` und `this.bufferNames = new Set()` entfallen, weil
die Felder sich selbst initialisieren. Alle Leser im Modul kommen mit der
Lesesicht aus — `get()`, `values()`, `keys()` — geprüft in
`initializeAttributes.ts:55,66`, `attributeNamesOf.ts:21`,
`GeometryRoutes.ts:306` und in `VertexObjectDescriptor.ts` selbst (`:105`,
`:112`, `:131`, `:184`, `:188`). Eine Stelle ist im Auge zu behalten:
`VertexObjectPool.spec.ts:147` reicht `descriptor.attributes` als das
`attributes`-Feld einer Description weiter, wo ein `Record` erwartet wird — was
dort nach der Verengung passiert, sagt `pnpm typecheck`, und der Test gehört
mitgezogen statt weggecastet.

### 5. Der Typ sagt, dass die Description eines Descriptors eingefroren ist

`VertexObjectDescriptor.ts:38` — `readonly description: VertexObjectDescription`
sagt ein Objekt mit schreibbaren Feldern zu. `descriptor.description.vertexCount
= 0` typprüft sauber und wirft zur Laufzeit. Der Compiler sagt es an zwei von
drei Türen (`descriptor.indices`, `descriptor.getAttribute(n).components`, beide
aus Paket 4) und an der dritten nicht.

Der Zuschnitt: **zwei neue exportierte Typen in `types.ts`, die aus den
bestehenden abgeleitet werden.** Sie stehen neben `VertexObjectDescription`,
statt es zu ersetzen, und ziehen damit keinen einzigen Verbraucher von
`VertexObjectDescription` mit — nur wer `descriptor.description` liest, sieht den
neuen Typ, und das ist im Produktivcode eine Stelle
(`cloneVertexObjectDescription.ts:73`).

```ts
/** Distributes over the union of attribute descriptions, so each member keeps its own fields. */
type FreezeAttribute<A> = A extends unknown
  ? {readonly [K in keyof A]: K extends 'components' ? readonly string[] : A[K]}
  : never;

/**
 * One attribute of a {@link FrozenVertexObjectDescription}: the same attribute description,
 * with a `components` list that cannot be written to.
 */
export type FrozenVertexAttributeDescription = FreezeAttribute<VertexAttributeDescription>;

/**
 * A {@link VertexObjectDescription} as a {@link VertexObjectDescriptor} hands its own out:
 * frozen down to the `indices`, the attributes record and the `components` of each attribute,
 * so that a write a `TypeError` answers at runtime is already a type error.
 *
 * `basePrototype` and the functions in `methods` keep their types — they are behaviour the
 * descriptor shares, not structure it owns, and they are not frozen.
 */
export type FrozenVertexObjectDescription = {
  readonly [K in keyof VertexObjectDescription]: K extends 'indices'
    ? readonly number[]
    : K extends 'attributes'
      ? Readonly<Record<string, FrozenVertexAttributeDescription>>
      : VertexObjectDescription[K];
};
```

Beide Mapped Types sind homomorph (`[K in keyof …]`), die optionalen Felder
bleiben also optional. `FreezeAttribute` bleibt modulintern und wird nicht
exportiert; die beiden anderen werden in
`vertex-objects/public-api.ts` aufgenommen — die Konvention im Plan-Kopf: ein
öffentliches Symbol ist erst veröffentlicht, wenn es dort steht.

Dann:

- `VertexObjectDescriptor.ts:38`: `readonly description: FrozenVertexObjectDescription;`
- Der Konstruktor friert die lokale Kopie ein und weist sie danach zu, damit
  `freezeDescription()` weiter ein veränderbares Objekt bekommt:

  ```ts
  const ownDescription = cloneVertexObjectDescription(description);
  freezeDescription(ownDescription);
  this.description = ownDescription;
  ```

- `cloneVertexObjectDescription()` nimmt den neuen Typ mit an:

  ```ts
  export function cloneVertexObjectDescription(
    source: VertexObjectDescriptor | VertexObjectDescription | FrozenVertexObjectDescription,
    attributeUsage?: VertexAttributeUsageOverrides,
  ): VertexObjectDescription {
  ```

  Sonst könnte ein Aufrufer `cloneVertexObjectDescription(descriptor.description)`
  nicht mehr übersetzen, und genau dieser Weg steht als Ausweg im
  Migrationsabschnitt des CHANGELOG. Im Rumpf braucht der Attribut-Klon einen
  Cast an der Stelle, an der aus der eingefrorenen Sicht wieder eine
  veränderbare Kopie wird (`:83`) — mit einem Kommentar, der sagt warum:

  ```ts
  // the clone owns its structure: the spread and the components copy below build new objects,
  // so what comes out is free to change even when the source was a frozen description
  const clonedDesc = {...desc} as VertexAttributeDescription;
  ```

- `VertexObjectDescriptor.ts:114` castet die Attribut-Description bereits
  (`as {size?: number; components?: string[]}`) und bleibt, wie sie ist.

**Der Nachweis, dass der Typ trägt**, gehört in `VertexObjectDescriptor.spec.ts`,
neben die Freeze-Tests aus Paket 4: ein Test, der mit `@ts-expect-error` über
`descriptor.description.vertexCount = 8` belegt, dass die Zuweisung jetzt ein
Typfehler ist, und der Laufzeit-`TypeError` daneben. Die Direktive ist der
Regressionsnachweis: ohne die Typänderung meldet `tsc` sie als unbenutzt, und
das Gate wird rot. Das ist der rote Lauf dieses Schritts — er läuft über
`pnpm typecheck`, nicht über den Testrunner.

### 6. Die doppelte Prüfung im Konstruktor fällt

`InstancedVOBufferGeometry.ts:88`:

```ts
if (args[2] instanceof VOBufferPool && args[2].isDisposed) {
```

`instanceof VOBufferPool` schließt `BufferGeometry` bereits aus, `!(args[2]
instanceof BufferGeometry) &&` prüft also ein zweites Mal dasselbe. Nach der
Änderung einmal `pnpm typecheck` — das Narrowing der Tupel-Union muss weiter
tragen.

### 7. Der `XXX`-Marker über einer getroffenen Entscheidung fällt

`VertexObjects.ts:26-30` — das TSDoc von `update()` trägt

```
XXX Object3D#onBeforeRender is too late for updating the geometry (attribute data arrays + draw range)
```

Der Marker sitzt über einer bewussten und richtigen Entscheidung, liest sich
aber wie offene Arbeit. Die Begründung gehört als Satz ins TSDoc, wo ein
Aufrufer sie findet, bevor er einen Render ohne `update()` baut — etwa: der
Aufrufer ruft `update()` selbst, weil `Object3D#onBeforeRender` zu spät kommt;
die Attributdaten und die Draw-Range der Geometrie stehen dann bereits fest.
Kein Rückblick auf den Marker, kein »früher«, keine Finding-ID — die
Konventionen im Plan-Kopf gelten für diesen Satz wie für jeden anderen.

### 8. Das `NOTE:`-Präfix fällt

`VOBufferPool.ts:239-240` — das TSDoc von `fromBuffersData()` beginnt mit
»NOTE: «, das keinen Leser adressiert; die Nachbarn `toBuffersData()` und
`createFromAttributes()` kommen ohne aus. Das Präfix streichen, der Satz bleibt
Wort für Wort stehen.

### 9. Der Migration Guide sagt, was er bisher verschweigt

Drei Ergänzungen in `packages/twopoint5d/CHANGELOG.md`, alle unter
`## [Unreleased]`. Die Zeilennummern sind die von heute; die Überschriften
tragen über eine Verschiebung hinweg.

- **`:313-321`, `#### A write through a vertex object has to say so`** (Folge aus
  Paket 3b): der Abschnitt sagt nicht, dass ein von Hand gesetztes
  `attribute.needsUpdate = true` keinen Voll-Upload mehr impliziert. Steht auf
  dem Attribut ein schmaler Range aus einem früheren `update()`, dessen Upload
  noch aussteht, lädt der Render nur diesen hoch und der Schreibvorgang geht
  verloren. Ein Satz im bestehenden Abschnitt genügt, Code ist keiner zu ändern.
- **`:41`** (Eintrag unter `### Changed`) **und `:284`** (erster Absatz von
  `#### The description of a descriptor is frozen`): beide Aufzählungen nennen
  fünf der sechs eingefrorenen Dinge — »its `indices`, every attribute
  description and the `components` of each, and the `methods` object«. Der
  `attributes`-Record selbst fehlt, obwohl ein Schreibversuch darauf wirft
  (`descriptor.description.attributes.extra = {…}` → `TypeError`). Ein Halbsatz
  je Stelle.
- **Neue Einträge für dieses Paket.** Unter `### Fixed` der Zielbereich von
  `copy()` und `copyArray()` samt dem halb beschriebenen Buffer, den die
  Vorabprüfung verhindert. Unter `### Changed` die benannten `RangeError` aus
  Schritt 2 und die vier Typverengungen aus den Schritten 3, 4 und 5. Die
  Typverengungen sind ein Breaking Change für jeden, der eines der Felder an
  eine `Map`- oder `Set`-Signatur reicht oder in `descriptor.description`
  schreibt, und brauchen einen eigenen `#### `-Abschnitt unter
  `### Migration Guide` mit **Before**/**After**-Block — der Ausweg ist,
  den readonly-Typ zu nennen oder mit `new Map([...geometry.buffers])` zu
  kopieren, und für die Description der Klon über
  `cloneVertexObjectDescription()`, der schon im Abschnitt darüber steht.
  Keep a Changelog 1.1.0, der Skill `updating-changelog` trägt die Regeln.

### 10. Die `@ts-expect-error`-Direktive deckt nur noch ihren Schreibversuch

`VertexObjectDescriptor.spec.ts:143-144` — die Direktive deckt die ganze
Folgezeile statt nur den `push`; der Reviewer von Paket 4 hat nachgewiesen, dass
`tsc` dort auch einen erfundenen Methodennamen schluckt. Der
`getAttribute()`-Aufruf gehört in eine eigene Zeile davor:

```ts
const pos = descriptor.getAttribute('pos')!;

// @ts-expect-error the components are typed `readonly`, and the write throws all the same
expect(() => pos.components.push('z')).toThrow(TypeError);

expect(pos.components).toEqual(['x', 'y']);
```

Danach prüfen, ob dieselbe Machart weitere Direktiven dieser Datei betrifft; die
Nachbarn `:130-136` gehören mit angesehen.

## Abgleich (Zug 0, 2026-09-20)

Jeder Befund an seiner Fundstelle nachgesehen. **Keiner ist gegenstandslos.**

| Schritt | Fundstelle im Plan | Fundstelle heute | Befund |
| --- | --- | --- | --- |
| 1 | `VertexObjectBuffer.ts:287-304`, `:318-331` | `:288-304`, `:319-333` | unverändert |
| 2 | `VertexObjectPool.ts:58-60` | `:58-60` | unverändert; zweite Stelle gefunden |
| 3 | `VOBufferGeometry.ts:19`, `InstancedVOBufferGeometry.ts:29-30` | `:18-19` bzw. `:27`, `:29-30`, `:33` | unverändert, vier Felder statt zwei |
| 4 | `VertexObjectDescriptor.ts:40-41` | `:40-41` | unverändert, aus der Queue dazugenommen |
| 5 | `VertexObjectDescriptor.ts:38` | `:38` | unverändert |
| 6 | `InstancedVOBufferGeometry.ts:88` | `:88` | unverändert |
| 7 | `VertexObjects.ts:26-34` | `:26-30` | unverändert |
| 8 | `VOBufferPool.ts:232` | `:239-240` | unverändert |
| 9 | `CHANGELOG.md:279-289`, `:41`, `:284` | `:313-321`, `:41`, `:284` | unverändert |
| 10 | `VertexObjectDescriptor.spec.ts:144` | `:143-144` | unverändert |

Was Zug 0 entschieden hat, und warum:

- **`VOBufferPool.ts:77-79` kommt in Schritt 2 dazu.** Der Befund nennt nur
  `VertexObjectPool.ts:58-60`, aber die Meldung `'Capacity must be a
  non-negative integer'` steht wortgleich ein zweites Mal im Konstruktor von
  `VOBufferPool` — derselben Vererbungslinie, derselbe Wertebereich, dieselbe
  Ursache. Nur eine der beiden zu benennen hieße, für dieselbe Sache zwei
  verschiedene Meldungen zu hinterlassen. Das ist die Seitentür, die Paket 4
  eine Runde gekostet hat.
- **`VertexObjectDescriptor.ts:40-41` kommt als Schritt 4 dazu**, aus »Offene
  Befunde«. Gleiche Ursache wie Schritt 3, bis in die Formulierung: ein
  öffentliches `readonly`-Feld auf einem veränderbaren Container, und beide
  Einträge verweisen auf denselben Präzedenzfall aus Paket 2. Sie in zwei
  Paketen zu machen hieße, denselben Zug zweimal zu erklären.
- **Die übrigen sechs offenen Einträge bleiben liegen.** Konventionsverstoß im
  Kommentar (`:84-85`), Import-Zyklus, toter `sinon`-Sandbox, der `as []`-Cast,
  die TSDoc-Lücke in `VertexObjectBuffer.ts:7-17` und der kaputte `{@link}` in
  `types.ts:121` haben je eine eigene Ursache. Dass dieses Paket dieselben
  Dateien anfasst, ist kein Grund — die Scope-Regel sagt, ob ein Befund in den
  Lauf gehört, nicht ob er in dieses Paket gehört. Die zweite Drain-Runde des
  Abschlusses schneidet sie mit allen Befunden vor Augen.
- **Schritt 3 zieht die inneren Maps der `attached*`-Sichten mit.** Der Befund
  nennt sie nicht, aber `extraInstancedBufferSerials.get(name)!.set(…)` erreicht
  dasselbe Serial wie `bufferSerials.set(…)`. Eine geschlossene Vordertür neben
  einer offenen Seitentür ist genau der Fehler, den dieser Lauf schon einmal
  bezahlt hat.
- **Schritt 5 bekommt zwei neue Typen statt einer tief-readonly Sicht auf
  `VertexObjectDescription` selbst.** Die Folge aus Paket 4 hielt fest, dass ein
  Umbau der Description-Typen alle ihre Verbraucher mitzöge. Zwei abgeleitete
  Typen daneben tun das nicht: sie berühren nur, wer `descriptor.description`
  liest, und das ist im Produktivcode `cloneVertexObjectDescription.ts:73`.
- **Modell und Effort:** stärkste Stufe, `high`. Sechs öffentliche Felder
  wechseln ihren Typ, zwei Typen kommen zur `public-api.ts` dazu, und der
  Mapped Type aus Schritt 5 muss über eine Union verteilen, ohne die
  Optionalität zu verlieren. »Öffentliche API neu schneiden« steht in der
  Modelltabelle bei der stärksten Stufe, und der Blast Radius der
  Typverengungen zeigt sich erst im `typecheck`.

## Befunde im Volltext

**1 · low · `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:287-304`
(`copy()`) und `:318-331` (`copyArray()`)** — beide prüfen nicht, ob
`targetObjectOffset` plus die Menge der Quelldaten in den Zielbuffer passt. Läuft
es über, wirft `TypedArray#set()` einen `RangeError` ohne Buffer- und
Methodennamen, und zwar mitten in einer Schleife, die vorherige Buffer bereits
geschrieben hat — der Buffer bleibt halb beschrieben zurück. `checkBufferArray()`
liefert derselben Klasse an anderer Stelle die benannten Fehler vor.
Vorbestehend (geprüft mit `git show 5657be6f:`), gemeldet aus Paket 3b.

**2 · info · `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:58-60`**
— `resize()` wirft für eine unzulässige Kapazität ein nacktes `Error`, dessen Text
weder die Klasse noch die Methode noch den übergebenen Wert nennt. Dieselbe Sache
liefert an zwei Nachbarstellen einen benannten `RangeError` mit dem Wert im Text
(`VertexObjectBuffer.ts:105-108`, der `usedCount`-Setter in
`VOBufferPool.ts:111-113`). Vorbestehend (geprüft mit `git show 5657be6f:`),
gemeldet aus Paket 3b.

**3 · low · `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:19` und
`InstancedVOBufferGeometry.ts:29-30`** — `buffers` und `bufferSerials` sind
öffentlich und im Inhalt veränderbar; `readonly` schützt nur die Referenz. Ein
Aufrufer, der in `bufferSerials` schreibt, verstellt genau das Serial, gegen das
`GeometryRoutes#syncUploads()` den Dirty-Range abholt, und kann damit Uploads
unterdrücken. Paket 2 hat die drei `extraInstanced*`-Sichten bereits auf
`ReadonlyMap` gezogen; diese beiden sind dabei stehen geblieben. Vorbestehend
(geprüft mit `git show 5657be6f:`), gemeldet aus Paket 3b.

**4 · info · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:40-41`**
— `attributes` (eine `Map`) und `bufferNames` (ein `Set`) sind `readonly`-Felder
auf veränderbaren Containern; `readonly` schützt nur die Referenz.
`descriptor.attributes.delete('pos')` macht den Descriptor uneins mit seiner
eingefrorenen Description. `ReadonlyMap`/`ReadonlySet` wären der Zug, den Paket 2
für die drei `extraInstanced*`-Sichten schon gemacht hat. Vorbestehend, gemeldet
aus Paket 4.

**5 · Folge aus Paket 4 · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:38`**
— `readonly description: VertexObjectDescription` sagt ein Objekt mit
schreibbaren Feldern zu (`types.ts:156`, `indices?: number[]`); ein
Schreibversuch typprüft sauber und wirft zur Laufzeit. Der Compiler sagt es also
an zwei von drei Türen (`indices`, `components`) und an der dritten nicht. Eine
tief-readonly Sicht auf die Description-Typen wäre der Zug, sie zöge aber alle
Verbraucher von `VertexObjectDescription` mit — deshalb nicht im Diff von
Paket 4.

**6 · info · `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:88`**
— die Bedingung `!(args[2] instanceof BufferGeometry) && args[2] instanceof
VOBufferPool` prüft doppelt; `instanceof VOBufferPool` schließt `BufferGeometry`
bereits aus. Vorbestehend, gemeldet aus Paket 1b.

**7 · info · `packages/twopoint5d/src/vertex-objects/VertexObjects.ts:26-34`** —
das TSDoc von `update()` trägt einen `XXX`-Marker ohne Auflösung: weder steht
dort, was zu tun ist, noch wer es entscheidet. Paket 3b hat nachgesehen, was
darunter steht: der Marker sitzt über einer bewussten und richtigen Entscheidung
— `onBeforeRender` wäre zu spät, deshalb muss der Aufrufer `update()` selbst
rufen. Ein `XXX` über einer getroffenen Entscheidung liest sich wie offene
Arbeit; die Begründung gehört ins TSDoc, wo ein Aufrufer sie findet, bevor er
einen Render ohne `update()` baut. Vorbestehend, gemeldet aus Paket 1b.

**8 · info · `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:232`** — das
TSDoc von `fromBuffersData()` beginnt mit dem Präfix »NOTE:«, das keinen Leser
adressiert; die Nachbarn `toBuffersData()` und `createFromAttributes()` kommen
ohne aus. Vorbestehend, gemeldet aus Paket 1.

**9a · Folge aus Paket 3b · `packages/twopoint5d/CHANGELOG.md`, Abschnitt »A write
through a vertex object has to say so« unter `### Migration Guide`** — der
Migrationsabschnitt sagt nicht, dass ein von Hand gesetztes
`attribute.needsUpdate = true` keinen Voll-Upload mehr impliziert. Steht auf dem
Attribut ein schmaler Range aus einem früheren `update()`, dessen Upload noch
aussteht, lädt der Render nur diesen hoch und der Schreibvorgang geht verloren.
Ein Satz im bestehenden Abschnitt genügt, Code ist keiner zu ändern.

**9b · Folge aus Paket 4 · `packages/twopoint5d/CHANGELOG.md:41` und `:284`** —
beide Aufzählungen nennen fünf der sechs eingefrorenen Dinge; der
`attributes`-Record (`VertexObjectDescriptor.ts:20`) fehlt, obwohl ein
Schreibversuch darauf wirft. Ein Halbsatz je Stelle.

**10 · Folge aus Paket 4 ·
`packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts:144`** —
die `@ts-expect-error`-Direktive deckt die ganze Folgezeile statt nur den `push`;
der Reviewer hat nachgewiesen, dass `tsc` dort auch einen erfundenen
Methodennamen schluckt. Der Aufruf gehört aus der gedeckten Zeile heraus.

## Urteil des Reviewers je Schritt

Die Schritte 1 bis 10 sind vom Reviewer der Runde 0 als erfüllt bestätigt, mit
Fundstelle im geänderten Stand; die Runden 1 bis 4 haben daran nichts
zurückgenommen, sondern nur nachgeschärft. Fundstellen sind die des Standes bei
Commit.

| Schritt | Urteil | Fundstelle |
| --- | --- | --- |
| 1 · `copy()` und `copyArray()` prüfen den Zielbereich, bevor sie schreiben | erfüllt, über den Plan hinaus | `VertexObjectBuffer.ts:294-348` — zwei Durchgänge: Offset-Guard, Objektzahl-Guard, dann eine Prüfschleife über **alle** Ziel-Buffer (Name **und** Elementlänge), und erst danach die Schreibschleife · Tests `VertexObjectBuffer.spec.ts:440-511` und `:799` |
| 2 · benannter `RangeError` für eine unzulässige Kapazität | erfüllt, zwei Stellen mehr als geplant | `VertexObjectPool.ts:61`, `VOBufferPool.ts:78-82` und `:263-266` · Tests `VertexObjectPool.spec.ts:463-480`, `:767-785`, `:817-827` |
| 3 · Buffer-Maps einer Geometrie als Lesesicht | erfüllt | `VOBufferGeometry.ts:18-29`, `InstancedVOBufferGeometry.ts:27-55`, `:66-68`, `GeometryRoutes.ts:96-106` |
| 4 · Container eines Descriptors als Lesesicht | erfüllt | `VertexObjectDescriptor.ts:43-53`, Konstruktor `:95-105` |
| 5 · der Typ sagt, dass die Description eingefroren ist | erfüllt, Typformulierung weicht ab und trägt | `types.ts:176-200`, `VertexObjectDescriptor.ts:40`, `cloneVertexObjectDescription.ts:76`, `:82-84` · Nachweis `VertexObjectDescriptor.spec.ts:125-126` |
| 6 · die doppelte Prüfung im Konstruktor fällt | erfüllt | `InstancedVOBufferGeometry.ts:111` |
| 7 · der `XXX`-Marker fällt | erfüllt | `VertexObjects.ts:29-32` |
| 8 · das `NOTE:`-Präfix fällt | erfüllt, eine Stelle mehr als geplant | `VOBufferPool.ts:242` und `:189` |
| 9 · der Migration Guide sagt, was er verschwieg | erfüllt, drei Teile | `CHANGELOG.md:345`, `:43` und `:343`, neue Einträge `:41-44` und `:191-193`, neuer Migrationsabschnitt `:287-339` |
| 10 · die `@ts-expect-error`-Direktive deckt nur ihren Schreibversuch | erfüllt | `VertexObjectDescriptor.spec.ts:145-148` |

Abweichungen von der Empfehlung des Detailplans, alle vom Reviewer als tragend
bestätigt:

- **`FrozenVertexAttributeDescription` ist die ausgeschriebene Union statt des
  distributiven Hilfstyps `FreezeAttribute<A>`.** Das Gate `checkNameableTypes`
  weist einen unexportierten Hilfstyp zurück, der aus einem exportierten
  erreichbar ist; die ausgeschriebene Form ist typgleich, bleibt homomorph und
  erhält die Optionalität.
- **Der Nachweis für Schritt 5 sitzt am bestehenden Freeze-Test** statt an einem
  neuen. Der Regressionsmechanismus ist derselbe — fällt die Typverengung weg,
  meldet `tsc` die Direktive als unbenutzt und `pnpm typecheck` wird rot.
- **`VertexObjectPool.spec.ts:147` brauchte keine Nacharbeit.** Das `descriptor`
  dort ist eine `VertexObjectDescription` (deklariert in `:73`), kein
  `VertexObjectDescriptor`; die Planannahme war falsch.
- **`VertexObjectDescriptor.ts:126` wurde doch angefasst**, entgegen dem Plan:
  der Cast `as {size?: number; components?: string[]}` behauptete nach der
  Verengung eine Veränderbarkeit, die es nicht mehr gibt. Jetzt
  `components?: readonly string[]`; der Code liest nur `.length`.
- **Die Elementlängenprüfung in `copy()` steht neben der Objektzahlprüfung, nicht
  an ihrer Stelle.** Die Objektprüfung greift zuerst und liefert für den
  Normalfall die Meldung, die ein Aufrufer versteht; die Elementprüfung fängt
  danach den Fall ab, den Objektzahlen nicht sehen können.
- **Der Early-Return von `copy()` prüft `this.buffers.size === 0`, nicht
  `#released`.** Damit behält auch ein Buffer über einer Description ohne
  Attribute sein Stillschweigen, das er immer hatte.
- **Ein bestehender CHANGELOG-Eintrag ist gefallen statt ergänzt worden.** Er
  zitierte die alte Kapazitätsmeldung und stand unter `[Unreleased]`, also nicht
  historisch; sein tragender Halbsatz ist in den verbliebenen Eintrag gewandert.

## Kleine Befunde — festgehalten, nicht behoben

Sie lösten keine Runde aus und stehen hier, damit sie nicht verloren gehen.

- `VertexObjectDescriptor.spec.ts:147` — die `@ts-expect-error`-Direktive deckt
  weiterhin die ganze `expect`-Zeile mitsamt `.toThrow` und `TypeError`. Ein
  Tippfehler in `toThrow` fiele nicht auf. Der `getAttribute()`-Aufruf ist
  herausgewandert, wie Schritt 10 es wollte; die Machart hält damit nur halb, was
  der Befund wollte.
- Die Commit-Message nennt vier der zehn Schritte im Titel. Die übrigen sechs
  stehen im Body, den Zug 5 ergänzt hat.
- `VertexObjectBuffer.spec.ts:801` — der Test über eine Description ohne
  Attribute steht im `describe('after the pool has been disposed')`, obwohl eine
  solche Description kein disposter Pool ist. Er wirkt dort richtig, steht aber
  unter der falschen Überschrift.
- `CHANGELOG.md:193` — der Satz beschreibt, was auf einem Buffer ohne etwas zu
  beschreiben geschieht, und ist als Aussage über den Offset richtig. Für
  `copyArray()` mit einem Namen, den ein nicht-leerer Buffer nicht kennt, wirft
  der Aufruf ein `Error` statt eines `RangeError`, ebenfalls vor dem
  Offset-Guard — ein Randfall des Namens, den der Satz nicht erwähnt.
- `CHANGELOG.md:310-318` — im **After**-Block des neuen Migrationsabschnitts
  steht `geometry.bufferSerials.set('dynamic_float32', 0)` im Before und
  `geometry.touch('position')` im After. Der eine nennt einen Buffer-, der andere
  einen Attributnamen; dass `touch()` die Übersetzung selbst macht, sieht der
  Leser nicht auf Anhieb.
