# Paket 3b — Dirty-Ranges pro Objekt statt eines Voll-Uploads pro Frame

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-020 (medium), READ-010 (info)
- Ziel: Ein Sprite-Spawn lädt die Objekte hoch, die sich geändert haben, statt
  jeden Buffer des Pools über seinen ganzen genutzten Bereich.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`
  - `packages/twopoint5d/src/vertex-objects/GeometryRoutes.ts`
  - `packages/twopoint5d/src/vertex-objects/updateUpdateRange.ts` → wird zu
    `setUploadRange.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`
  - `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`. Nx bedient `test:ci` und `test:browser` gern aus dem
  Cache (`2/2 hit`), und dann misst der Lauf für diese beiden Gates nichts.
  Beide deshalb einmal nachfahren:
  `pnpm nx run-many -t test --projects=tag:ci --skipNxCache` und
  `pnpm nx run-many -t test --projects=tag:browser --skipNxCache`. Für den
  Browserlauf gilt die Entscheidung im Plan-Kopf: ein reiner
  Firefox-Verbindungsabbruch ist vorbestehende Flakiness, ein Fehlschlag auf
  Chromium ist rot.
- Commit:

  ```
  perf(vertex-objects): upload the objects that were written instead of every buffer a pool holds, and leave the routes already attached out of a new route's first upload

  BREAKING CHANGE: materializing a vertex object through getVO() no longer marks
  the buffers of its pool for upload — reading a slot changes no data. Write
  through the vertex object and call touch(), or give the attribute autoTouch.
  attachInstancedPool() uploads the static buffers of the new route alone; the
  routes that were already on the geometry keep what they had. AttributeBuffer
  carries four more fields, so code that builds such a record itself has to
  fill them.

  VertexObjectBuffer gains touch(fromIdx?, toIdx?) with a range, touchBuffer()
  for a single named buffer and pickUpDirtyRange() for what a consumer still
  owes the gpu. updateUpdateRange.ts becomes setUploadRange.ts, a module-internal
  file that no public api re-exports.
  ```

- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · PERF-020 unverändert, drei der vier
    Fundstellen gewandert (`VertexObjectPool.ts:201-219` → `:218-237`,
    `VertexObjectBuffer.ts:316-320` → `:344-348`, `VOBufferGeometry.ts:181-194`
    → nach Paket 2 in `GeometryRoutes.ts:146-168`; `updateUpdateRange.ts:12-17`
    → `:12-18`), die Nebenstelle `InstancedVOBufferGeometry.ts:260` →
    `:272` · READ-010 unverändert, Zeilen jetzt `:76, 87, 90, 95` · kein
    Nebenbefund aus der Queue aufgenommen (Begründung unten) · die Folge aus
    Paket 2 (`updateUpdateRange.ts:4-5`) ist Schritt 3
  - 2026-09-20 Zug 1: Implementierer beauftragt · Opus, Effort `high` ·
    Brief `paket-3b.impl-0.brief.txt`, Report nach `paket-3b.impl-0.json`
  - 2026-09-20 Zug 2: Report `FERTIG` · 11 Dateien geändert, `updateUpdateRange.ts`
    per `git mv` zu `setUploadRange.ts`, Arbeitsbaum schmutzig · beide
    Regressionsspecs vor dem Umbau rot gesehen (`start: 0, count: 72` statt
    `start: 60, count: 12` bzw. `start: 0, count: 48` statt `start: 12,
    count: 12`) · eigener Verify-Lauf: `pnpm run ci` exit=0, `test:ci`
    `--skipNxCache` exit=0, `test:browser` `--skipNxCache` exit=0, kein
    Firefox-Abbruch · Log `paket-3b.verify.log`
  - 2026-09-20 Zug 3: Reviewer-Urteil (Opus, Effort `high`, Report
    `paket-3b.review-0.json`): PERF-020 und READ-010 je behoben mit Fundstelle ·
    kein kritisch · 2 × wichtig (ein eingetragener, aber nie hochgeladener Range
    geht beim nächsten `update()` verloren; die beiden Touch-Specs können nicht
    rot werden) · 2 × klein · »committable: ja«, aber zwei wichtige Befunde
    lösen Zug 4 aus
  - 2026-09-20 Zug 4 Runde 1: 2 offene Befunde (die beiden wichtigen) an
    denselben Implementierer per `--resume bd908c39`, Opus/`high` · zurück:
    beide geschlossen (`setUploadRange.ts:19-31` vereinigt einen stehenden
    Element-Range mit dem neuen; je ein `createVO()` vor der Messung in den
    beiden Touch-Specs), dazu beide kleinen Befunde und der Regressionstest
    `two updates without a render in between upload both objects that were
    written` (vor dem Fix rot: `{start: 72, count: 12}` statt
    `{start: 60, count: 24}`) · eigener Verify: `pnpm run ci` exit=0, beide
    Test-Gates `--skipNxCache` exit=0, Log `paket-3b.verify-r1.log` · Reviewer
    (Report `paket-3b.review-1.json`) bestätigt alle vier als geschlossen und
    die three-Quellenbehauptung, meldet aber einen neuen wichtigen Befund:
    `syncUploads()` trägt auch ohne Schreibvorgang den vollen Bereich ein, und
    unter der Vereinigung überlebt der und zieht den nächsten Spawn hoch ·
    2 offene Befunde → 1
  - 2026-09-20 Zug 4 Runde 2: der eine offene Befund plus die zwei kleinen an
    denselben Implementierer per `--resume`, Opus/`high`. Das Muster sieht für
    Runde 2 einen frischen Prozess eine Modellstufe höher vor; die stärkste
    Stufe läuft bereits, und der Befund ist eine Folge des Fixes aus Runde 1,
    dessen Code derselbe Prozess im Kopf hat
    · zurück: geschlossen (`GeometryRoutes.ts:175-193` überspringt einen
    Buffer, den nichts bewegt hat), Regressionstest `a frame in which nothing
    is written leaves the next spawn its own narrow range` vor dem Fix rot mit
    `{start: 0, count: 72}` statt `{start: 60, count: 12}` · beide kleinen
    Befunde mit erledigt · ein Folgefall mitgezogen: `GeometryRoutes#touch()`
    (`:269-283`) leert die Ranges der Buffer, die es markiert, weil ein Render
    dem nächsten `update()` zuvorkommen kann · eigener Verify: `pnpm run ci`
    exit=0, beide Test-Gates `--skipNxCache` exit=0 (`test:ci` 1,9 s, 1488
    Tests; `test:browser` 25,0 s, sechs Display-Starts je Browser, kein
    Firefox-Abbruch), Log `paket-3b.verify-r2.log` · Reviewer (Report
    `paket-3b.review-2.json`) bestätigt alle drei als geschlossen, prüft die
    three-Quelle und den neuen `#touch()`-Zweig nach, hält den Mechanismus als
    Ganzes gegen die drei Zusagen und findet kein kritisch, kein wichtig,
    »committable: ja« · 1 offener Befund → 0
  - 2026-09-20 Zug 5: committet als `bb13c61f`, 13 Dateien, +527/−89 ·
    Commit-Message vor dem Commit um die additive Oberfläche ergänzt
    (`touch(fromIdx?, toIdx?)`, `touchBuffer()`, `pickUpDirtyRange()`, die
    Umbenennung der Datei), weil die in Zug 0 geschriebene Fassung sie nicht
    kannte · Arbeitsbaum danach sauber

## Abgleich

**PERF-020** — jede Fundstelle nachgesehen, der Sachverhalt steht überall noch.

| Fundstelle im Audit | Heute | Befund |
| --- | --- | --- |
| `VertexObjectPool.ts:201-219` (`getVO()`, `#createVO()`) | `getVO()` bei `:218-228`, `#createVO()` bei `:230-237` mit `this.buffer.touch()` in `:232` | verschoben, unverändert |
| `VertexObjectBuffer.ts:316-320` (`touch()`) | `touch()` bei `:344-348`, erhöht jedes `buffer.serial` | verschoben, unverändert |
| `VOBufferGeometry.ts:181-194` (`#updateBuffersUpdateRange`) | Paket 2 hat das Plumbing in `GeometryRoutes#checkSerials()` (`:146-161`) und `#updateRanges()` (`:164-168`) zusammengeführt | umgeformt, Sachverhalt unverändert |
| `updateUpdateRange.ts:12-17` | `:12-18`, rechnet weiterhin `itemSize * vertexCount * pool.usedCount` ab Element 0 | verschoben, unverändert |
| `InstancedVOBufferGeometry.ts:260` (`#firstAutoTouch` neu setzen) | `this.#routes.resetAutoTouch()` in `:272`; `GeometryRoutes#autoTouch()` (`:196-203`) fährt `selectByUsage({static: true})` über **jede** Route | umgeformt, Sachverhalt unverändert |
| Swap-Pfad von `freeVO()` | `VertexObjectPool.ts:194` ruft `copyWithin()`, das in `VertexObjectBuffer.ts:265` jedes Serial erhöht | unverändert |

**READ-010** — die vier Kommentare stehen, gewandert von `:72, 84, 87, 91` auf
`:76, 87, 90, 95`. Drei weitere derselben Machart in derselben Methode: `:70`
(»Create a new buffer with the new capacity«), `:73` (»Copy existing data up to
the minimum of old and new capacity«) und `:114` (»Adjust usedCount if
necessary«). Alle sieben fallen — ein Reviewer, der die Methode nach dem Fix
liest, meldete die drei sonst als eigenen Befund. Stehen bleiben die
Warum-Kommentare in `:81` und `:101-102`.

**Offene Befunde aus der Queue:** keiner aufgenommen. Zwei liegen in Dateien,
die dieses Paket anfasst — das »NOTE:«-Präfix im TSDoc von
`VOBufferPool#fromBuffersData()` (`VOBufferPool.ts:232`) und die doppelte
Bedingung der Konstruktor-Guard (`InstancedVOBufferGeometry.ts:88`) —, aber
keiner teilt die Ursache mit der Dirty-Buchführung. Die gemeinsame Datei ist
kein Grund: die Drain-Runde des Abschlusses schneidet beide mit allen Befunden
vor Augen. Sie bleiben in »Offene Befunde« stehen.

**Folgen aus erledigten Paketen:** die eine offene Folge aus Paket 2
(`updateUpdateRange.ts:4-5` — die beiden `| undefined` und die
`if (pool && buffers)`-Guard sind tot) ist Schritt 3 dieses Pakets. Die beiden
anderen Folgen aus Paket 2 hat Zug 0 von Paket 3 abgeschlossen bzw. verteilt.

## Der Mechanismus

Er trägt nur als Ganzes, deshalb steht er vor den Schritten. Drei Zusagen aus
dem Plan sind bindend:

1. **Das Serial pro Buffer bleibt.** Es sagt, *ob* eine Route hochzuladen hat;
   der neue Range sagt, *wie weit*. Der Wortlaut des Audits (»`serial` durch
   einen Dirty-Objekt-Range ersetzen«) fällt hier gegen den Plan.
2. **Kein Konsument leert etwas.** Ein Pool kann an mehreren Geometrien hängen;
   ein Range, den die erste Geometrie nach ihrem Upload leert, wäre für die
   zweite leer und würde sie nichts laden lassen.
3. **Wer zu weit zurückliegt, bekommt den ganzen genutzten Bereich.**

Das leistet ein Range mit einem Startserial und einer Hochwassermarke:

- `dirtySince` ist das Serial, das der Buffer trug, als der aktuelle Range zu
  sammeln begann. Wer `dirtySince` oder später gesehen hat, hat alles davor
  bereits hochgeladen — der Range deckt für ihn alles ab, was seither geschah.
- `pickedUpSerial` ist das höchste Serial, das irgendein Konsument abgeholt
  hat. Solange es dem aktuellen Serial entspricht, sind alle, die sich je
  gemeldet haben, auf Stand, und die nächste Markierung darf den Range neu
  beginnen statt ihn zu weiten. Das ist die Stelle, an der der Range wieder
  schmal wird, ohne dass ihn jemand leert.
- Eine Route mit `seenSerial < dirtySince` fällt auf `[0, usedCount - 1]`
  zurück. Das ist der Fall der zweiten Geometrie, die einen Frame ausgelassen
  hat, und er ist konservativ richtig: was vor `dirtySince` geschah, ist
  nirgends mehr aufgezeichnet.

Zweitens die Trennung zwischen den beiden Wegen, auf denen ein Buffer hochlädt:

- **Aus dem Serial** — `createVO`, `freeVO`, `copyAttributes`, `copyWithin`,
  `copy`, `copyArray`, `fromBuffersData`, `resize`. Hier weiß der Pool, welche
  Objekte geschrieben wurden, und der Range ist eng.
- **Auf Anforderung** — `touch()`, `touchAttributes()`, `touchBuffers()` und
  `autoTouch`. Hier weiß niemand, welche Objekte geschrieben wurden: die
  generierten Setter markieren nichts (`types.ts:45-54`). Dieser Weg lädt
  **immer** `[0, usedCount - 1]` hoch, genau wie heute.

Daraus folgt der Zuschnitt in `GeometryRoutes`: die Markierung auf Anforderung
und die Range-Rechnung müssen in einer Hand liegen, weil `needsUpdate` an einem
`THREE.BufferAttribute` nur ein Setter ist und sich nicht zurücklesen lässt.
`GeometryRoutes` merkt sich die angeforderten Buffer in einem Set und leert es
am Ende des Durchgangs.

## Vorgehen

### 1. Der Dirty-Objekt-Range am Buffer (`VertexObjectBuffer.ts`)

`AttributeBuffer` bekommt vier Felder neben `serial`, mit TSDoc:

```ts
/** The lowest object index written since `dirtySince`; `-1` while nothing is recorded. */
dirtyFrom: number;
/** The highest object index written since `dirtySince`; `-1` while nothing is recorded. */
dirtyTo: number;
/**
 * The serial this buffer carried when the current range started to collect. A consumer that
 * last saw this serial or a later one has everything from before the range on the gpu already.
 */
dirtySince: number;
/**
 * The highest serial a consumer has taken a range for. Once it has caught up with `serial`,
 * the next write starts a fresh range instead of widening the one that is there — which is how
 * the range gets narrow again without anyone clearing it.
 */
pickedUpSerial: number;
```

Beide Konstruktor-Zweige (der aus einer Quelle kopierende in `:120-129` und der
aus der Description bauende in `:137-170`) setzen sie auf `-1`, `-1`, `0`, `0`.
Die `Omit<AttributeBuffer, 'typedArray'>`-Zwischenform in `:137` trägt sie mit.

Dazu eine private Methode, die jede Markierung nimmt:

```ts
#markDirty(buf: AttributeBuffer, fromIdx: number, toIdx: number): void {
  const from = Math.max(0, fromIdx);
  const to = Math.min(this.capacity - 1, toIdx);
  if (from <= to) {
    if (buf.pickedUpSerial === buf.serial || buf.dirtyFrom < 0) {
      buf.dirtySince = buf.serial;
      buf.dirtyFrom = from;
      buf.dirtyTo = to;
    } else {
      buf.dirtyFrom = Math.min(buf.dirtyFrom, from);
      buf.dirtyTo = Math.max(buf.dirtyTo, to);
    }
  }
  buf.serial++;
}
```

Das Serial steigt auch, wenn der Bereich leer herauskommt — dann bleibt der
Range, wie er war, und die Abfrage unten fällt auf den vollen Bereich zurück.

Und die Abfrage, die ein Konsument stellt:

```ts
/**
 * What a consumer that last saw `seenSerial` has left to upload of `bufferName`: the objects
 * `from` … `to`, capped at the slots in use, or `null` when the buffer has not moved on since.
 *
 * A consumer further behind than the current range reaches gets every object in use — what
 * happened before the range began is recorded nowhere. Taking a range up counts as having
 * caught up, so the next write can start a range of its own.
 */
pickUpDirtyRange(
  bufferName: string,
  seenSerial: number | undefined,
  usedCount: number,
): {from: number; to: number} | null
```

Der Ablauf, buchstäblich:

1. `const buf = this.buffers.get(bufferName)`; `null` zurück, wenn der Buffer
   fehlt — der Pool dahinter hat losgelassen.
2. `null` zurück, wenn `seenSerial === buf.serial`.
3. `buf.pickedUpSerial = buf.serial`.
4. Den ganzen genutzten Bereich zurückgeben — `{from: 0, to: usedCount - 1}` —,
   wenn `seenSerial === undefined`, `seenSerial < buf.dirtySince` oder
   `buf.dirtyFrom < 0`.
5. Sonst `from = buf.dirtyFrom`, `to = Math.min(buf.dirtyTo, usedCount - 1)`;
   ist `from > to`, `{from: 0, to: -1}` zurückgeben — geschrieben wurde nur
   außerhalb dessen, was in Gebrauch ist.

`touch()` bekommt zwei optionale Parameter und bleibt ohne sie, was es war:

```ts
/**
 * Mark the objects `fromIdx` … `toIdx` as written in every buffer. Without arguments every
 * object of this buffer counts as written — what a caller that cannot say more has to state.
 *
 * Does nothing on the buffer of a disposed pool, which has no buffer left to mark.
 */
touch(fromIdx = 0, toIdx = this.capacity - 1): void
```

### 2. Die Schreibwege markieren, was sie geschrieben haben

Jede dieser Stellen verliert ihr nacktes `buf.serial++` und ruft `#markDirty`:

| Stelle | Bereich |
| --- | --- |
| `copy(other, targetObjectOffset)` (`:212-229`) | `[targetObjectOffset, targetObjectOffset + other.capacity - 1]`, je Buffer |
| `copyArray(source, bufferName, targetObjectOffset)` (`:243-254`) | nur dieser Buffer, `[targetObjectOffset, targetObjectOffset + Math.ceil(source.length / (vertexCount * buf.itemSize)) - 1]` |
| `copyWithin(targetIndex, startIndex, endIndex)` (`:257-267`) | `[targetIndex, targetIndex + (endIndex - startIndex) - 1]`, je Buffer |
| `copyAttributes(attributes, targetObjectOffset)` (`:270-305`) | je berührtem Buffer `[targetObjectOffset, targetObjectOffset + attrObjCount - 1]`; bei `attrObjCount === 0` **gar nicht markieren**, auch kein `serial++` — geschrieben wurde nichts |
| `touch()` (`:344-348`) | `[fromIdx, toIdx]` nach der Signatur oben |
| `VOBufferPool#fromBuffersData()` (`:277-287`) | je berührtem Buffer `[0, capacity - 1]`: der Array wird ersetzt oder ganz überschrieben |
| `VertexObjectPool#resize()` (`:75-85`) | `newBuf.serial++` entfällt; nach dem Kopieren einmal `newBuffer.touch()` über alle Buffer — der Buffer ist neu, und eine Route, die ihn später bekommt, kann nichts von ihm gesehen haben |

`createVO()` (`:125-134`) markiert den Slot, den es vergeben hat, und
`#createVO()` (`:230-237`) verliert `this.buffer.touch()` ersatzlos:

```ts
createVO(): (VOType & VO) | undefined {
  if (this.isDisposed) return undefined;
  if (this.usedCount < this.capacity) {
    const idx = this.usedCount++;
    const vo = this.#createVO(idx);
    this.#voIndex[idx] = vo;
    // the slot arrives carrying whatever stood in it before, and the draw range has just grown
    // over it, so its vertices have to reach the gpu
    this.buffer.touch(idx, idx);
    return vo;
  }
  return undefined;
}
```

Damit fällt das Markieren aus dem `getVO()`-Pfad: ein Slot zu materialisieren
ändert keine Daten. `freeVO()` bleibt, wie es ist — der Zweig für den letzten
Slot schreibt nichts, der Swap-Zweig markiert über `copyWithin()` den einen
Zielindex.

Das TSDoc von `getVO()` (`:210-217`) bekommt einen Satz, dass es nichts für den
Upload markiert; das von `createVO()` (`:118-124`) einen, dass der vergebene
Slot hochgeladen wird.

### 3. `updateUpdateRange` → `setUploadRange`

`updateUpdateRange.ts` wird zu `setUploadRange.ts` mit einer Funktion, die
einen Objektbereich in Elemente rechnet:

```ts
/**
 * Give `bufAttr` the upload range that carries the objects `fromIdx` … `toIdx`: each of them
 * occupies `vertexCount` vertices of `itemSize` elements. A range that names no object leaves
 * the attribute with a count of 0.
 */
export function setUploadRange(
  bufAttr: BufferLike,
  fromIdx: number,
  toIdx: number,
  vertexCount: number,
  itemSize: number,
): void {
  const start = fromIdx * vertexCount * itemSize;
  const count = Math.max(0, toIdx - fromIdx + 1) * vertexCount * itemSize;
  const current = bufAttr.updateRanges[0];
  if (bufAttr.updateRanges.length !== 1 || current?.start !== start || current?.count !== count) {
    bufAttr.clearUpdateRanges();
    bufAttr.addUpdateRange(start, count);
  }
}
```

Die Rechnung ist die aus dem Grobplan. Der Name weicht von dessen
`addUpdateRange` ab, weil `BufferAttribute#addUpdateRange()` in derselben Zeile
steht und zwei gleichnamige Dinge nebeneinander sich niemand merkt; die Sache
ist dieselbe. Damit ist auch die Folge aus Paket 2 erledigt: die neue Signatur
kennt weder ein `pool: VOBufferPool | undefined` noch ein
`buffers: Map | undefined` und braucht keine `if (pool && buffers)`-Guard.

### 4. `GeometryRoutes` führt Markierung und Range zusammen

`GeometryRoute` bekommt ein veränderliches Feld neben `autoDispose`:

```ts
/** Whether this route still owes the static buffers it carries their first upload. */
firstAutoTouch?: boolean;
```

`add()` und `attach()` setzen es auf `true`, bevor die Route in die Liste geht.

Die Klasse bekommt ein `readonly #fullUploads = new Set<BufferLike>()` und
zwei Methoden, die das Markieren übernehmen, statt eine Selektion
herauszugeben:

```ts
/** Mark the buffers behind these attribute names, across every route, for a full upload. */
touchAttributes(attrNames: string[]): void

/**
 * Mark the buffers of these usage types for a full upload: across every route without a
 * `group`, and otherwise only across the routes that feed the named half.
 */
touchByUsage(bufferTypes: TouchBuffersType, group?: RouteGroup): void
```

Beide setzen `needsUpdate` sofort — ein `touch()` ohne folgendes `update()`
wirkt weiter wie bisher — und legen den Buffer zusätzlich in `#fullUploads`.
Die freie, exportierte `markForUpload()` (`:25-29`) wird dafür zur
modulprivaten Hilfe; `select()` (`:171-177`) und `selectByUsage()` (`:183-193`)
werden zu `#select()` und `#selectByUsage()`.

`autoTouch()` (`:196-203`) fragt `firstAutoTouch` je Route statt einmal für die
ganze Geometrie:

```ts
autoTouch(): void {
  for (const route of this) {
    if (route.firstAutoTouch) {
      this.#touch(selectBuffers(route.buffers, {static: true}));
      route.firstAutoTouch = false;
    }
  }

  this.#touch(this.#getAutoTouchBuffers());
}
```

`#firstAutoTouch` (`:225`) und `resetAutoTouch()` (`:213-216`) entfallen;
`#dropAutoTouchSelection()` (`:238-240`) bleibt und wird von `add()`,
`attach()`, `detach()` und `clear()` weiter gerufen. Der Absatz aus dem TSDoc
von `resetAutoTouch()`, der erklärt, warum die volle Runde eine eigene Frage
beantwortet, wandert an das neue Feld.

`checkSerials()` (`:146-161`) und `updateRanges()` (`:164-168`) weichen einer
Methode, die beides in einem Durchgang tut — getrennt ginge es nicht, weil
`checkSerials()` das gesehene Serial überschreibt, das die Range-Abfrage
braucht:

```ts
/**
 * Bring every buffer that uploads on the next frame together with the range it uploads: a
 * buffer whose pool has moved on carries the objects that were written, one that something
 * asked for carries every object in use. Nothing knows which values a generated setter wrote,
 * so an attribute that is touched or carries `autoTouch` uploads the whole area either way.
 */
syncUploads(): void {
  for (const route of this) {
    const {vertexCount} = route.pool.descriptor;
    const {usedCount} = route.pool;

    for (const [bufferName, bufAttr] of route.buffers) {
      const poolBuffer = route.pool.buffer.buffers.get(bufferName);
      // a pool that has been disposed elsewhere carries no buffer to compare against
      if (poolBuffer == null) continue;

      const written = route.pool.buffer.pickUpDirtyRange(bufferName, route.bufferSerials.get(bufferName), usedCount);

      if (written != null) {
        bufAttr.needsUpdate = true;
        route.bufferSerials.set(bufferName, poolBuffer.serial);
      }

      const range = written != null && !this.#fullUploads.has(bufAttr) ? written : {from: 0, to: usedCount - 1};
      setUploadRange(bufAttr, range.from, range.to, vertexCount, poolBuffer.itemSize);
    }
  }

  this.#fullUploads.clear();
}
```

Ein Buffer, den weder ein Serial noch eine Anforderung bewegt hat, bekommt
gar keinen Range eingetragen. **Nachgezogen in Zug 4, Runde 2:** der Codeblock
oben trägt hier noch den vollen genutzten Bereich ein, weil der Schnipsel von
`setUploadRange()` einen stehenden Range ersetzte. Seit der Vereinigung in
Runde 1 überlebt ein so eingetragener Voll-Range das Frame und zieht den
nächsten Spawn hoch; der Code überspringt die Stelle deshalb.

### 5. Die beiden Geometrien

`VOBufferGeometry` (`:99-106`, `:127-135`) und `InstancedVOBufferGeometry`
(`:424-440`, `:462-471`) reichen das Markieren durch statt selbst zu
selektieren:

```ts
touchAttributes(...attrNames: string[]): void {
  this.#routes.touchAttributes(attrNames);
}

touchBuffers(bufferTypes: TouchBuffersType): void {
  this.#routes.touchByUsage(bufferTypes);
}
```

Bei der instanced Geometrie behält `touchBuffers()` seine Fallunterscheidung
über `base` und `instanced` und ruft `touchByUsage(…, 'base')` bzw.
`touchByUsage(…, 'instanced')`. Beide `update()` verlieren den `markForUpload`-
Import und rufen:

```ts
update(): void {
  this.#updateDrawRange();          // bei der instanced Geometrie nach this.instanceCount = …
  this.#autoTouchAttributes();
  this.#routes.syncUploads();
  this.#slots.syncArrays(this);
}
```

Die Reihenfolge dreht sich gegenüber heute — `autoTouch()` stand zwischen
`checkSerials()` und `updateRanges()` und musste jetzt davor. Das ist
verhaltensneutral: `autoTouch()` setzt nur `needsUpdate`, es liest kein Serial
und schreibt keines.

In `attachInstancedPool()` entfällt `this.#routes.resetAutoTouch()` (`:272`)
samt seinem Kommentar; `GeometryRoutes#attach()` gibt der neuen Route
`firstAutoTouch = true`, und die Routen, die schon da waren, behalten ihr
`false`. Der Grund — die neue Route schuldet ihren static Buffern den ersten
Upload, die anderen nicht mehr — wandert als Kommentar an die Stelle in
`attach()`.

### 6. Die nacherzählenden Kommentare in `resize()`

In `VertexObjectPool.ts` fallen die Zeilen `:70`, `:73`, `:76`, `:87`, `:90`,
`:95` und `:114` ersatzlos. Die Warum-Kommentare in `:81` und `:101-102`
bleiben, ebenso `:152-153` in `onUsedCountShrunk()`.

### 7. Die Specs

Zuerst die beiden, die den engen Range festnageln — **sie werden vor dem Umbau
geschrieben und müssen rot laufen**, der rote Lauf gehört in den Report. Sie
kommen in den bestehenden `describe('update ranges')`-Block von
`vertex-buffers-geometry-updates.spec.ts` (`:596-630`):

Beide bauen auf dem `quadDesc` des vorhandenen Tests `'a non-instanced geometry
uploads every vertex of every used object'` (`:608-618`) auf: `position` ohne
`usage`, also `static` und damit ohne `autoTouch`
(`VertexAttributeDescriptor.ts:42-52`) — der Upload hängt dort allein am Serial.
Der erste `update()` verbraucht die Auto-Touch-Runde, die den static Buffer
einmal ganz hochlädt; erst der zweite misst den engen Range.

1. `'a spawn uploads the object that was created, not the whole pool'` — eine
   nicht-instanced Geometrie mit 5 Objekten, `update()`, dann ein sechstes
   `createVO()` und `update()`. Erwartet
   `[{start: 5 * 4 * 3, count: 4 * 3}]` für `position`. Vor dem Umbau kommt
   `[{start: 0, count: 72}]`.
2. `'freeing an object in the middle uploads the slot that took its place'` —
   dieselbe Geometrie mit 5 Objekten, `update()`, dann `freeVO()` auf dem
   Objekt in Slot 1 und `update()`. Der Swap holt das Objekt aus Slot 4 nach
   Slot 1; erwartet `[{start: 1 * 4 * 3, count: 4 * 3}]`. Vor dem Umbau kommt
   `[{start: 0, count: 48}]`.

Dazu, nach dem Umbau:

3. `'an attribute that was touched uploads every object in use'` —
   `geometry.touch('position')` statt einer Datenänderung, `update()`, Range
   über alle genutzten Objekte.
4. `'an attribute that uploads on every frame carries every object in use'` —
   dasselbe über ein Attribut mit `autoTouch` (im Fixture `impact`).
5. `'a geometry that missed the frames in between uploads everything'` — zwei
   Geometrien auf einem Pool, `update()` auf beiden, dann zwei `createVO()` mit
   je einem `update()` allein auf der ersten, dann `update()` auf der zweiten.
   Die erste bekommt den engen Range, die zweite den vollen. Das ist der Test
   für die Zusage, dass ein Konsument nichts leert.
6. In `VertexObjectPool.spec.ts`, im `getVO`-Block: `'materializing a vertex
   object in a slot that was filled from attributes marks nothing for upload'` —
   nach `createFromAttributes()` und einem `getVO()` bewegt sich das Serial der
   Buffer nicht.
7. In `InstancedVertexObjectGeometry.spec.ts`: `'attaching a pool leaves the
   static buffers of the routes that were already there alone'` — `update()`,
   Versionen merken, `attachInstancedPool()`, `update()`; die static Buffer der
   Basis- und der instanced Route behalten ihre Version, die der neuen Route
   steigt.

Die vorhandenen Tests `'createVO'` (`:509-531`), `'freeVO:last'` (`:533-562`),
`'freeVO:not(last)'` (`:564-593`), `'dynamic auto update'` (`:445-463`),
`'touch color'` (`:465-485`) und `'touch foo:interleaved'` (`:487-507`) prüfen
`version`, nicht den Range, und überleben den Umbau unverändert: eine
Markierung über einen engen Range erhöht die Version derselben Buffer wie
heute. Dasselbe gilt für die beiden vorhandenen `update ranges`-Tests
(`:597-629`) — beide legen ihre Objekte ab Index 0 an, der enge Range ist dort
der volle. **Läuft einer dieser Tests nach dem Umbau rot, ist das ein Befund am
Umbau, nicht am Test.**

### 8. Der Beweis im Browser

Ein fünftes `it()` in
`packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js`, nach dem
Muster der vier vorhandenen (Display, Scene, Camera aus den Hooks):

`'a spawn in a large, mostly static pool uploads the new object alone'`

Das vorhandene `quadDescription` (`:58-62`) taugt dafür **nicht**: sein
`position` trägt `usage: 'dynamic'`, und ein dynamisches Attribut hat
`autoTouch` per Default an (`VertexAttributeDescriptor.ts:50-52`), lädt also
jeden Frame alles hoch. Der Test bekommt daneben eine eigene Description:

```js
// static and therefore without autoTouch: what reaches the gpu here comes from the pool
// having written something, which is the whole point of this test
const staticQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'static'}},
};
```

- `VertexObjectGeometry(staticQuadDescription, 64)`, `VertexObjects`-Mesh in die
  Szene, 32 Objekte über `createVO()` mit gesetzten Positionen.
- `mesh.update()`, rendern, `await display.nextFrame()`. Dieser Durchgang
  verbraucht die erste Auto-Touch-Runde, die den static Buffer einmal ganz
  hochlädt — danach hängt der Upload allein am Serial.
- Ein weiteres `createVO()` mit einer eigenen Position, `mesh.update()`.
- `expect(bufferOf(position).updateRanges).to.deep.equal([{start: 32 * 4 * 3, count: 4 * 3}])`
  — der Satz, um dessentwillen dieses Paket existiert.
- Rendern, `await display.nextFrame()`, zurücklesen: das 33. Objekt steht auf
  der GPU, und ein Stichprobenobjekt aus den ersten 32 steht unverändert da.

### 9. CHANGELOG

`packages/twopoint5d/CHANGELOG.md` unter `## [Unreleased]`, nach den Regeln von
`updating-changelog`:

- **Changed**: der Upload aus einem Serial trägt nur noch die Objekte, die
  geschrieben wurden — `createVO()`, `freeVO()` über den Swap-Pfad,
  `createFromAttributes()` und die `copy*`-Methoden des Buffers. Ein Attribut,
  das über `touch()` oder `autoTouch` hochlädt, trägt weiterhin jedes Objekt in
  Gebrauch, weil die generierten Setter nicht sagen, was sie geschrieben haben.
  Eine Geometrie, die Frames ausgelassen hat, lädt den ganzen genutzten Bereich.
- **Changed**: `attachInstancedPool()` lädt die static Buffer der neuen Route
  hoch und lässt die Routen, die schon da waren, in Ruhe.
- **Removed** / **Migration Guide**: `getVO()` markiert nichts mehr für den
  Upload. Wer sich darauf verlassen hat, schreibt durch das Vertex Object und
  ruft `touch()`, oder gibt dem Attribut `autoTouch`.
- **Changed**: `AttributeBuffer` trägt `dirtyFrom`, `dirtyTo`, `dirtySince` und
  `pickedUpSerial`; wer so einen Record selbst baut, füllt sie mit.

Der Migrationshinweis ist Pflicht — es ist ein Breaking Change.

## Was der Implementierer beachten muss

- `needsUpdate` an einem `THREE.BufferAttribute` ist ein reiner Setter. Es lässt
  sich nicht zurücklesen, und `version` als Ersatz zu vergleichen führt in die
  Irre, sobald jemand von außen markiert. Deshalb das Set in `GeometryRoutes`.
- `GeometryRoutes.ts`, `setUploadRange.ts`, `selectBuffers.ts` und
  `selectAttributes.ts` stehen **nicht** in `vertex-objects/public-api.ts` —
  dort darf umbenannt und umgeschnitten werden. `VertexObjectBuffer.ts`,
  `VertexObjectPool.ts` und `VOBufferPool.ts` stehen darin; jede Änderung an
  ihrer Oberfläche gehört ins CHANGELOG.
- Der Range wird in **Objektindizes** geführt und erst in `setUploadRange()` in
  Elemente gerechnet. Wer ihn unterwegs in Elementen führt, rechnet `itemSize`
  doppelt.
- `capacity` und `usedCount` sind zwei verschiedene Grenzen: markiert wird gegen
  `capacity` (so groß sind die Arrays), abgeholt gegen `usedCount` (so weit
  reicht der Draw-Range).
- Keine Finding-Nummer wandert ins Repo: nicht in einen Kommentar, nicht in
  einen Testnamen, nicht in die Commit-Message. Die Kommentare dieses Pakets
  schreiben ihr Argument aus, statt auf eine Nummer zu zeigen.
- Innerhalb des Moduls gibt es keinen weiteren Aufrufer von
  `VertexObjectBuffer#touch()`, `markForUpload()`, `checkSerials()`,
  `updateRanges()` oder `updateUpdateRange()` als die hier genannten; außerhalb
  von `packages/twopoint5d/src/vertex-objects/` keinen einzigen. `dist/` ist
  Build-Output und wird nicht angefasst.

## Findings im Volltext

**PERF-020 · medium · Performance · effort L**
`packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:201-219; VertexObjectBuffer.ts:316-320; VOBufferGeometry.ts:181-194; updateUpdateRange.ts:12-17`

getVO() nicht jeden Buffer dirty markieren lassen; Dirty-Ranges pro Objekt erwägen

Dirtiness ist ein Serial pro Buffer und ein Update-Range `[0, usedCount)` pro
Buffer. Ein einzelnes `createVO()`, ein lazy `getVO()` (ein Lesezugriff, der
keine Daten ändert — `#createVO` ruft `buffer.touch()`) oder ein `freeVO()`
über den Swap-Pfad (`copyWithin` erhöht jedes Serial) lädt beim nächsten
`update()` *jeden* Buffer des Pools — statische eingeschlossen — über den ganzen
genutzten Bereich neu hoch. Für einen großen, überwiegend statischen Pool mit
einem Sprite-Spawn pro Frame ist das ein Voll-Upload pro Frame; das
`autoTouch`-TSDoc warnt vor genau diesen Kosten, nur für dynamische Attribute.
Verwandt: `attachInstancedPool()` setzt `#firstAutoTouch` neu
(InstancedVOBufferGeometry.ts:260), was `touchBuffers({static: true})` zu einem
statischen Upload *jeder* Route macht, nicht nur der neuen.

Empfehlung: Klein: `touch()` aus dem `getVO()`-Pfad nehmen (ein VO zu
materialisieren ändert keine Daten) und in `freeVO()` nur die betroffenen Buffer
touchen. Groß: `serial` durch einen Dirty-Objekt-Range `[minIdx, maxIdx]` pro
Buffer ersetzen, den `createVO`, `freeVO`, `copyAttributes`, `fromBuffersData`
weiten und `updateUpdateRange` in `addUpdateRange(start, count)` übersetzt. Der
Browsertest `vertex-objects-gpu-upload.test.js` ist der Ort für den Beweis.

**READ-010 · info · Lesbarkeit & Clean Code · effort S**
`packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:72, 84, 87, 91`

Kommentare in resize(), die die nächste Zeile nacherzählen

»Manually copy data for each buffer…«, »Update the buffer reference«, »Resize
the voIndex array…«, »Update the VO's internal buffer reference…« — die
Kommentare sagen, was die Zeile darunter ohnehin sagt, nicht warum. Dieselbe
Methode macht es an Zeile 97-98 richtig vor. Re-Check: unverändert.

Empfehlung: Die nacherzählenden Zeilen streichen; wo eine Entscheidung
dahintersteht, den Grund hinschreiben.

## Urteil des Reviewers je Finding

Aus `paket-3b.review-2.json` (dritter Durchgang, auf dem committeten Stand):

- **PERF-020 — erfüllt.** Alle sechs Fundstellen zu: `getVO()` markiert nichts
  mehr (`VertexObjectPool.ts:221-230`, Spec `VertexObjectPool.spec.ts:747`),
  `createVO()` markiert genau seinen Slot (`VertexObjectPool.ts:130`), der
  Swap-Pfad von `freeVO()` markiert über `copyWithin()` den einen Zielindex
  (`VertexObjectBuffer.ts:344`), `touch()` führt einen Range
  (`VertexObjectBuffer.ts:432-436`), `setUploadRange()` rechnet Objektindizes in
  Elemente (`setUploadRange.ts:15-38`), und `attachInstancedPool()` setzt
  `firstAutoTouch` pro Route (`GeometryRoutes.ts:113-122`, `:239-248`, Spec
  `InstancedVertexObjectGeometry.spec.ts:260`). Der Beweis im Browser steht in
  `vertex-objects-gpu-upload.test.js:143-178`: `{start: 396, count: 12}` bei 33
  belegten Objekten, plus Rücklesen des Nachbarn und einer unberührten
  Stichprobe.
- **READ-010 — erfüllt.** Alle sieben nacherzählenden Kommentare in
  `VertexObjectPool.ts` sind weg (`grep` auf alle sieben Wortlaute: kein
  Treffer); die Warum-Kommentare in `:81` und `:96-97` stehen, dazu ein neuer in
  `:83`.

Zur Reichweite, vom Reviewer als kein Mangel am Paket vermerkt:
`TileSpritesFactory.update()` (`map2d/TileSprites/TileSpritesFactory.ts:66-70`)
ruft je Frame `touch()` über alle drei Instanced-Attribute, map2d holt aus dem
engen Range also nichts. Sprites und Billboards fahren über `autoTouch` und
ebenfalls voll. Der Gewinn liegt bei den statischen Attributen und bei
Konsumenten, die gezielt markieren.

## Kleine Befunde, offen gelassen

Aus dem dritten Reviewer-Durchgang, keiner behoben:

- `packages/twopoint5d/CHANGELOG.md:279-289` — der Migrationsabschnitt sagt
  nicht, dass ein von Hand gesetztes `attribute.needsUpdate = true` keinen
  Voll-Upload mehr impliziert: auf dem Attribut kann ein schmaler Range aus
  einem früheren `update()` stehen, dessen Upload noch aussteht, und dann lädt
  der Render nur diesen hoch. Ein Satz im bestehenden Abschnitt genügt, Code ist
  keiner zu ändern. **Nicht in »Offene Befunde« eingetragen** — der Abschnitt
  ist in diesem Paket entstanden, der Befund ist keine vorbestehende Sache,
  sondern eine Lücke in der eigenen Doku. Er steht hier und in der
  `Folgen:`-Zeile des Plans.
- `docs/remediation/paket-3b.md:432-434` — der überholte Prosa-Satz zum
  unbewegten Buffer. In Zug 5 geradegezogen.

Aus dem zweiten Durchgang, in Runde 2 erledigt: das TSDoc von `uploaded()` und
der fehlende `Added`-Eintrag für die `touch()`-Signatur.

## Nebenbefunde des Implementierers

Fünf, alle vorbestehend (nachgesehen mit `git show 5657be6f:<pfad>`), keiner
behoben. Zwei standen schon in »Offene Befunde« (`InstancedVOBufferGeometry.ts:88`,
`VOBufferPool.ts:239`), drei sind neu dazugekommen und in »Offene Befunde«
eingetragen. Das Urteil `→ Scope` für alle drei: sie liegen in
`packages/twopoint5d/src/vertex-objects/`, worauf die Scope-Regel ohne
Severity-Schranke zeigt.

Den sechsten — den `XXX`-Marker in `VertexObjects.ts:26-34` — trägt die Queue
bereits seit Paket 1b; der Eintrag ist um das ergänzt, was der Implementierer
darin gefunden hat: der Marker steht über einer richtigen Entscheidung, deren
Begründung (`onBeforeRender` wäre zu spät) ins TSDoc gehört.
