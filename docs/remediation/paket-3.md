# Paket 3 — Das Sicherungsnetz: die ungetesteten Stellen der Pool-Zustandsmaschine und der Interleaved-Zweig der Upload-Range

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-023 (medium), TEST-014 (medium)
- Ziel: Bevor die Dirty-Buchführung der Buffer umgebaut wird, steht unter jedem
  öffentlichen Verhalten der Pool-Zustandsmaschine eine Spec, und der
  Interleaved-Zweig der Upload-Range wird im Browser wirklich gefahren.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VOUtils.spec.ts` (neu)
  - `packages/twopoint5d/src/vertex-objects/VertexObjects.spec.ts` (neu)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts` (ergänzen)
  - `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts` (eine Zeile)
  - `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js` (ergänzen)
- Kein Produktionscode. Dieses Paket fügt ausschließlich Tests hinzu und
  benennt einen Testnamen um. Ändert sich eine Zeile außerhalb dieser fünf
  Dateien, ist etwas schiefgelaufen.
- Kein CHANGELOG-Eintrag: das Paket ändert nichts, was ein Konsument sieht.
- Verify: `pnpm run ci`
- Commit: `test(vertex-objects): pin the create hook of a pool, the update a mesh passes on, the symbol accessors behind a vertex object, and the upload range of a buffer that carries two attributes, and say what the detach test really checks`
  (fünftes Glied in Zug 5 ergänzt: der Reviewer hat als kleinen Befund gemeldet, dass die
  einzige Änderung an bestehendem Code — die Umbenennung aus Schritt 4 — in keiner Silbe
  der Nachricht stand)
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · TEST-023 zu fünf Achteln gegenstandslos
    (siehe »Abgleich«), drei Lücken bleiben: `onCreateVO`, `VertexObjects.update()`,
    `VOUtils` · TEST-014 unverändert · PERF-020 und READ-010 samt der Folge an
    `updateUpdateRange.ts` in das neu geschnittene Paket 3b verschoben · die Folge
    `GeometryAttributeSlots.ts:15` (`ReleasedSlot`) als gegenstandslos abgeschlossen ·
    keine Queue-Einträge aufgenommen
  - 2026-09-20 Zug 1: Implementierer beauftragt · mittlere Stufe, Effort medium ·
    Brief `paket-3.impl-0.brief.txt`, Report nach `paket-3.impl-0.json`
  - 2026-09-20 Zug 2: Report FERTIG_MIT_VORBEHALT · geändert
    `VertexObjectPool.spec.ts`, `InstancedVertexObjectGeometry.spec.ts`,
    `vertex-objects-gpu-upload.test.js`, neu `VOUtils.spec.ts` und
    `VertexObjects.spec.ts`; kein Produktionscode · Arbeitsbaum schmutzig ·
    `pnpm run ci` exit=0 (`paket-3.verify.log`), darin `test:ci` und `test:browser`
    aus dem Nx-Cache · beide ungecacht nachgefahren
    (`paket-3.verify-tests.log`): exit-test-ci=0, exit-test-browser=0, keine
    Firefox-Abbrüche
  - 2026-09-20 Zug 3: Reviewer beauftragt (stärkste Stufe, Effort medium) ·
    Diff `paket-3.diff` (5 Dateien, 346+/1-), Report `paket-3.review-0.json` ·
    Urteil: TEST-023 und TEST-014 behoben, beide gemeldeten Abweichungen gehen
    durch, kein kritisch, kein wichtig, 4 × klein, committable ja
  - 2026-09-20 Zug 4: entfällt · kein nicht erfüllter Finding, kein kritischer
    und kein wichtiger Befund; die vier kleinen Befunde lösen keine Runde aus
  - 2026-09-20 Zug 5: committet als `48c92657` · Verify aus Zug 2 trägt den Commit
    (seither keine Codeänderung): `paket-3.verify.log` exit=0, dazu
    `paket-3.verify-tests.log` mit beiden Test-Gates ungecacht · Plan auf `[x]`,
    ein Queue-Eintrag (`→ Audit`) aufgenommen

## Abgleich

TEST-023 nennt acht ungetestete Stellen. Fünf davon sind seit dem Audit
geschlossen worden — der vorangegangene Remediation-Lauf (Commit `4e45accc` und
Nachbarn) hat die Specs mitgeliefert, die er für seine eigenen Fixes brauchte.
Nachgesehen an der Fundstelle, nicht vermutet:

| Stelle aus TEST-023 | Stand heute |
| --- | --- |
| `clear()` / `usedCount` senken auf einem lebenden Pool | **geschlossen** — `VertexObjectPool.spec.ts:553` »clear() lets go of every vertex object it handed out« läuft auf einem lebenden Pool und prüft Slot, Zählerstand und gelöste Buffer-Referenz |
| `getVO()` mit Index außerhalb des Bereichs | **geschlossen** — `VertexObjectPool.spec.ts:623-638` »answers undefined for an index that names no used slot« deckt `-1`, `0.5`, `NaN` und `usedCount` ab |
| `createIndicesArray` und die `vertexCount`-gegen-Index-Stride-Relation | **geschlossen** — `createIndicesArray.spec.ts` mit beiden Fällen (Indices, die einen Vertex auslassen, und ein voller Quad) |
| `VertexObjectBuffer` aus einem `buffersData`-Payload falscher Länge/Typs | **geschlossen** — `VertexObjectBuffer.spec.ts:678-760`, `TypeError` für den falschen Typ, `RangeError` für zu kurz und zu lang, dazu die Capacity-Regel |
| eine aus `BufferGeometry` gebaute `InstancedVOBufferGeometry` und ihr `name` | **geschlossen** — `vertex-buffers-geometry-updates.spec.ts:634-651`, beide Richtungen (Klassenname behalten, Fremdname nicht übernehmen) |
| der `onCreateVO`-Hook samt `void`-Rückgabe-Fallback | **offen** — `onCreateVO` kommt repoweit nur an drei Stellen vor, alle in `VertexObjectPool.ts` (`:28` Deklaration, `:233-235` Aufruf). Keine einzige Spec-Referenz |
| `VertexObjects.update()`-Delegation und der `geometry === undefined`-Pfad | **offen** — keine `VertexObjects.spec.ts` |
| `VOUtils` | **offen** als eigene Spec. Die Klasse wird in `VertexObjectPool.spec.ts` als Hilfsmittel benutzt (`getIndex`, `hasBuffer`), aber keine ihrer acht Methoden ist Gegenstand eines Tests |

TEST-014 ist unverändert: der `bufferOf()`-Helfer steht in
`vertex-objects-gpu-upload.test.js:21`, aber `quadDescription` (`:40`) und
`instancedDescription` (`:46`) tragen weiter je ein einziges Attribut pro Buffer.
`initializeAttributes.ts:45` baut den `InterleavedBuffer` erst bei
`attributes.length > 1`, also fährt kein Browsertest diesen Zweig.

**Was dieses Paket nicht mehr enthält.** Der Grobplan führte PERF-020 und
READ-010 in demselben Paket, ausdrücklich in zwei Phasen (»zuerst das
Sicherungsnetz … dann der Umbau«). Die beiden Phasen sind hier getrennt: Paket 3
ist das Sicherungsnetz, das neu geschnittene Paket 3b der Umbau. Die Begründung
steht im Plan unter Paket 3b.

**Folgen aus Paket 2**, in Zug 0 verteilt:

- `updateUpdateRange.ts:4-5` (tote `| undefined` und tote Guard) → **Paket 3b**,
  das die Funktion ohnehin zu `addUpdateRange(start, count)` umbaut.
- `InstancedVertexObjectGeometry.spec.ts:202` (Testname nennt
  `#extraInstancedPoolAutoDispose`) → **dieses Paket**, Schritt 4.
- `GeometryAttributeSlots.ts:15` (`ReleasedSlot` ohne Importeur) →
  **gegenstandslos, abgeschlossen**. Der Typ ist der deklarierte Rückgabetyp von
  `GeometryAttributeSlots#releaseRoute()` in derselben Datei
  (`GeometryAttributeSlots.ts:104`) und wird dort jede Zeile gebraucht. Ein
  Rückgabetyp, den außerhalb seiner Datei niemand beim Namen nennt, ist kein
  toter Export, sondern ein benannter Rückgabetyp. Es ist nichts zu tun, und
  kein Paket muss die Datei dafür aufmachen.

**Queue.** Kein Eintrag aus »Offene Befunde« wird aufgenommen. Der einzige, der
in Reichweite läge — `VOBufferPool.ts:239`, das TSDoc von `fromBuffersData()`
beginnt mit »NOTE:« —, liegt in einer Datei, die dieses Paket nicht anfasst, und
teilt mit keinem seiner Findings die Ursache. Er bleibt für die Drain-Runde
liegen. (Die Zeile ist seit der Aufnahme von `:232` nach `:239` gewandert.)

## Vorgehen

### 1. `VOUtils.spec.ts` anlegen

Neue Datei neben `VOUtils.ts`, Stil der Nachbarn: `import {describe, expect,
test} from 'vitest';`, ein `describe('VOUtils', …)`.

Ein Vertex Object ist hier nichts weiter als ein Objekt mit den beiden
Symbol-Properties aus `constants.js` — es braucht keinen Pool und keinen
Descriptor. Als Buffer genügt ein `new VertexObjectBuffer(descriptor, capacity)`
mit einer minimalen Description (ein Attribut, `vertexCount: 1`); zwei
verschiedene Buffer werden gebraucht, damit `isBuffer()` auch `false` sagen kann.

Zu testen, je ein `test()`:

1. `set(vo, buffer, 3)` schreibt beide Properties und gibt **dasselbe** Objekt
   zurück (`toBe(vo)`), nicht eine Kopie.
2. `getIndex()` und `getBuffer()` antworten, was `set()` geschrieben hat.
3. `setIndex(vo, 7)` bewegt nur den Index; `getBuffer()` antwortet weiter
   denselben Buffer.
4. `isBuffer(vo, buffer)` ist `true` für den Buffer, auf den das Objekt zeigt,
   und `false` für einen zweiten Buffer.
5. `isBuffer(vo, undefined)` ist `true` für ein Objekt ohne Buffer und `false`
   für eines mit — die Methode vergleicht, sie prüft nicht auf Anwesenheit.
6. `hasBuffer()` ist `true` mit Buffer, `false` nach `clearBuffer()`, und
   `false` für ein frisches Objekt, das nie einen hatte.
7. `setBuffer(vo, undefined)` und `clearBuffer(vo)` führen zum selben Zustand;
   beide geben das Objekt zurück.
8. `getBuffer()` antwortet `undefined` für ein Objekt, dem nie einer gesetzt
   wurde.

Kein Test auf Interna der Symbole selbst: geprüft wird, was die acht Methoden
zusagen, nicht wie sie es speichern.

### 2. `VertexObjects.spec.ts` anlegen

Neue Datei neben `VertexObjects.ts`. `VertexObjects` erbt von `THREE.Mesh` aus
`three/webgpu`; das lässt sich unter Vitest ohne Renderer bauen.

Wichtig für den `geometry === undefined`-Pfad: `THREE.Mesh` hat
Default-Parameter (`constructor(geometry = new BufferGeometry(), material = new
MeshBasicMaterial())`, `three.core.js:23338`). `new VertexObjects()` bekommt also
eine **echte** `BufferGeometry`, nicht `undefined`. Der undefined-Fall entsteht
erst, wenn jemand `mesh.geometry = undefined` schreibt — genau das, was eine
Subklasse beim Dispose tut.

Zu testen:

1. Der Konstruktor setzt `name` auf `'VertexObjects'` und `frustumCulled` auf
   `false`.
2. `update()` reicht an die Geometrie weiter: mit einer
   `new VertexObjectGeometry(description, capacity)` als Geometrie ruft
   `mesh.update()` genau einmal `geometry.update()` auf. Spion über `sinon`
   (`createSandbox()`, `sandbox.spy(geometry, 'update')`, `afterEach` mit
   `sandbox.restore()`) — so macht es `VertexObjectGeometry.spec.ts` vor.
3. `update()` auf einem Mesh, dessen `geometry` auf `undefined` gesetzt wurde,
   tut nichts und wirft nicht.
4. `update()` auf einem Mesh mit einer nackten `THREE.BufferGeometry` (die
   Default-Geometrie, die kein `update()` hat) tut nichts und wirft nicht — das
   ist der zweite Halbsatz der Guard `typeof this.geometry?.update ===
   'function'`.
5. Eine Geometrie, die nach dem Bau zugewiesen wird (`mesh.geometry = geo`),
   wird von `update()` erreicht — die Delegation liest das Feld, sie merkt sich
   nichts.

Für die Description reicht eine einfache: `vertexCount: 4`,
`attributes: {position: {components: ['x','y','z'], type: 'float32', usage:
'dynamic'}}`.

### 3. Den `onCreateVO`-Hook in `VertexObjectPool.spec.ts` abdecken

Ein eigener `describe('onCreateVO', …)`-Block im bestehenden
`describe('VertexObjectPool', …)`, der die vorhandene `descriptor`-Fixture aus
dem `beforeEach` benutzt. Zu testen:

1. Der Hook wird für jedes von `createVO()` materialisierte Objekt genau einmal
   gerufen und bekommt das Vertex Object, das der Pool gebaut hat — prüfbar
   daran, dass `VOUtils.getIndex(vo)` im Hook den Slot nennt, den der Pool
   gerade vergeben hat.
2. Gibt der Hook ein Objekt zurück, ist **das** das Ergebnis von `createVO()`,
   und `getVO()` auf demselben Index antwortet danach ebenfalls damit.
3. Gibt der Hook `undefined` zurück (`void`-Rückgabe), bleibt es beim Objekt des
   Pools — das ist der `?? vo`-Fallback in `VertexObjectPool.ts:234`.
4. Der Hook wird auch für ein Objekt gerufen, das `getVO()` nachträglich
   materialisiert: `createFromAttributes()` hebt `usedCount`, ohne ein Vertex
   Object zu bauen; der erste `getVO(idx)` darauf löst den Hook aus.
5. Für ein Objekt, das schon im Index steht, wird der Hook **nicht** noch einmal
   gerufen: zweimal `getVO(0)` auf demselben Slot ergibt einen Aufruf.
6. Auf einem disposeten Pool wird der Hook nicht gerufen — weder `createVO()`
   noch `getVO()` bauen dort ein Objekt (so sagt es das TSDoc an `:25-26`).
7. Ein Hook, der nach dem Bau des Pools gesetzt wird, greift ab dem nächsten
   Objekt; ein Hook, der auf `undefined` zurückgesetzt wird, greift nicht mehr.

Zählen über eine einfache Zählvariable oder `sandbox.spy()` — dem Stil der
Nachbartests folgen.

### 4. Den Testnamen in `InstancedVertexObjectGeometry.spec.ts:202` geradeziehen

Der Name lautet »detachInstancedPool removes the autoDispose tracking entry« und
nennt damit `#extraInstancedPoolAutoDispose`, eine Buchführung, die Paket 2
entfernt hat; die Antwort hängt jetzt am Route-Objekt. Der Test prüft Verhalten
und bleibt Zeile für Zeile, wie er ist — **nur der Name ändert sich**, auf etwas,
das das geprüfte Verhalten benennt statt das verschwundene Feld, etwa
»detachInstancedPool forgets what the caller said about auto-disposing the pool«.
Den Test vorher lesen und einen Namen wählen, der zu dem passt, was er wirklich
behauptet.

### 5. Den Interleaved-Zweig im Browser fahren

In `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js` ein
viertes `it()` ergänzen, gebaut wie das erste (`:80`), mit einer neuen Description
neben den beiden vorhandenen:

```js
const interleavedQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {
    position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'},
    color: {components: ['r', 'g', 'b'], type: 'float32', usage: 'dynamic'},
  },
};
```

Beide Attribute erben denselben `bufferName` — `VertexAttributeDescriptor#bufferName`
setzt ihn aus `usage`, `type` und `normalized` zusammen, hier also
`dynamic_float32` für beide. Damit steht in `pool.buffer.buffers` ein einziger
Buffer mit `itemSize: 6`, und `initializeAttributes` nimmt den
`InterleavedBuffer`-Zweig.

Die Zahlen, gegen die der Test prüft, stehen hier und sind nicht zu raten:

- **Reihenfolge im Stride.** `VertexObjectBuffer` sortiert `attributeNames`
  alphabetisch (`VertexObjectBuffer.ts:133`), und der Offset wächst in dieser
  Reihenfolge. Also: `color` bei Offset 0, `position` bei Offset 3. Ein Vertex
  liest sich als `[r, g, b, x, y, z]`.
- **Upload-Range.** `itemSize (6) × vertexCount (4) × usedCount (1) = 24`, also
  `[{start: 0, count: 24}]`. Der Unterschied zum Ein-Attribut-Fall ist genau der
  Punkt: dort wäre die Zahl 12, und eine Rechnung, die den Stride übersieht,
  käme auch hier auf 12.
- **Ein Buffer für beide.** `bufferOf(geometry.getAttribute('position'))` und
  `bufferOf(geometry.getAttribute('color'))` sind dasselbe Objekt (`to.equal`,
  Identität) — der Beweis, dass der Interleaved-Zweig gelaufen ist.

Material: `MeshBasicNodeMaterial`, `positionNode = attribute('position', 'vec3')`,
`colorNode = attribute('color', 'vec3')` — ein Attribut, das kein Shader liest,
bekommt von three keinen GPU-Buffer, und der Kommentar an `:110` sagt das schon.

Ablauf, dem ersten Test nachgebaut:

1. `new VertexObjectGeometry(interleavedQuadDescription, 8)`, Mesh, in die Szene.
2. Ein Quad aus dem Pool, `setPosition([0,0,0, 1,0,0, 1,1,0, 0,1,0])`,
   `setColor([1,0,0, 0,1,0, 0,0,1, 1,1,0])`.
3. `mesh.update()`, rendern, `await display.nextFrame()`.
4. Identität der beiden Buffer prüfen (siehe oben).
5. Beide Attribute desselben Objekts neu schreiben:
   `setPosition([0,0,0, 7,7,7, 8,8,8, 9,9,9])`,
   `setColor([2,2,2, 3,3,3, 4,4,4, 5,5,5])`.
6. `mesh.update()`, dann `expect(bufferOf(position).updateRanges).to.deep.equal([{start: 0, count: 24}])`.
7. Rendern, `await display.nextFrame()`, zurücklesen und die ersten 24 Werte
   prüfen:

   ```js
   [2,2,2, 0,0,0,  3,3,3, 7,7,7,  4,4,4, 8,8,8,  5,5,5, 9,9,9]
   ```

Der `readBack()`-Helfer der Datei (`:36`) funktioniert unverändert: three
entpackt ein `InterleavedBufferAttribute` in
`WebGPUAttributeUtils#_getBufferAttribute()` auf sein `data` und liest den ganzen
interleavten GPU-Buffer zurück. Das zurückgelesene Array trägt den Stride, und
genau so wird oben geprüft.

## Grenzen dieses Pakets

- **Kein Produktionscode.** Die neuen Specs halten fest, was der Code heute
  zusagt. Widerspricht eine Fundstelle der Dokumentation — etwa ein Verhalten,
  das anders ausfällt, als das TSDoc behauptet —, wird das **gemeldet**, nicht
  repariert: Status `FERTIG_MIT_VORBEHALT`, mit Datei, Zeile und dem, was
  stattdessen passiert. Paket 3b baut auf diesem Sicherungsnetz auf und braucht
  es, wie es ist.
- **Keine Regressionstests im Sinne des Skills.** Dieses Paket behebt keinen
  Korrektheitsfehler, es schließt Abdeckungslücken; ein roter Lauf vor dem Fix
  ist hier weder zu erwarten noch zu erzeugen. Bleibt eine der neuen Specs beim
  ersten Lauf rot, ist das ein Befund nach dem vorigen Punkt.
- **Keine bestehende Spec umschreiben**, außer dem einen Testnamen aus
  Schritt 4. Was schon steht, steht.

## Findings im Volltext

**TEST-023 · medium · `packages/twopoint5d/src/vertex-objects/` (keine
`createIndicesArray.spec.ts`, `VertexObjects.spec.ts`, `VOUtils.spec.ts`);
`VertexObjectPool.spec.ts:955-960`; `VertexObjectPool.ts:24` (onCreateVO)** —
Die Spec-Lücken um die Pool-Zustandsmaschine und die ungetesteten Helfer in
vertex-objects schließen

Öffentliche Verhalten ohne Spec: `clear()`/Senken von `usedCount` auf einem
lebenden Pool mit verfolgten VOs (die einzige `clear()`-Spec läuft auf einem
disposeten Pool); `getVO()` mit Index außerhalb des Bereichs; der
`onCreateVO`-Hook (samt `void`-Rückgabe-Fallback, null Spec-Referenzen
repoweit); `createIndicesArray` und damit die `vertexCount`-gegen-Index-Stride-
Relation; `VertexObjects.update()`-Delegation und ihr `geometry ===
undefined`-Pfad; `VOUtils`; `VertexObjectBuffer` aus einem `buffersData`-Payload
falscher Länge/Typs; eine aus `BufferGeometry` gebaute `InstancedVOBufferGeometry`,
die ihren `name` verliert. Alles andere — Dispose-Ownership, Slot-Verweigerung,
Serial-Sync, Update-Ranges — ist gut abgedeckt (96,8 % Lines).

Empfehlung: Je eine Spec im bestehenden Namensstil; die ersten drei sind
zugleich Regressionstests für die genannten Findings.

**TEST-014 · medium · `packages/twopoint5d/src/vertex-objects/updateUpdateRange.ts:13`;
`initializeAttributes.ts:26-46`;
`packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js:40-48`** —
Der Interleaved-Zweig der Upload-Range ist im Browser nicht abgedeckt

Die Range-Rechnung hat zwei Zweige, und nur der schmalere wird im Browser
gefahren. Trägt ein Buffer mehr als ein Attribut, legt `initializeAttributes`
einen `InterleavedBuffer` an, und `itemSize` ist dann der Stride. Genau diese
Form fahren die Sprites in jedem Frame (`TexturedSpriteDescriptor` gruppiert
`quadSize`/`texCoords`/`color`). Re-Check: Der Browsertest kennt inzwischen einen
`bufferOf()`-Helfer für interleaved Attribute, seine beiden Descriptions
(`quadDescription`, `instancedDescription`) tragen aber weiter je ein einziges
Attribut pro Buffer — der Zweig wird nicht gefahren.

Empfehlung: Einen Browsertest ergänzen, der einen Buffer mit mehreren Attributen
gegen die GPU fährt und den hochgeladenen Bereich prüft;
`vertex-objects-gpu-upload.test.js` ist die Vorlage.

## Urteil des Reviewers je Finding

- **TEST-023 — behoben.** Die drei in Zug 0 als offen abgeglichenen Lücken sind zu, und
  die Tests prüfen, was sie behaupten: der `onCreateVO`-Hook in
  `VertexObjectPool.spec.ts:623-716` (sieben Tests, der Index im Hook stammt aus
  `VOUtils.getIndex(vo)` und trifft den vom Pool vergebenen Slot; der `?? vo`-Fallback
  wird gegen das tatsächlich gebaute Objekt gehalten, nicht gegen `toBeDefined()`); die
  `VertexObjects.update()`-Delegation samt beiden Halbsätzen der Guard
  `typeof this.geometry?.update === 'function'` in `VertexObjects.spec.ts:24-63`;
  `VOUtils` in `VOUtils.spec.ts:1-107` mit allen acht Methoden, inklusive der feinen
  Stelle, dass `isBuffer(vo, undefined)` vergleicht statt Anwesenheit prüft.
- **TEST-014 — behoben.** `vertex-objects-gpu-upload.test.js:193-236`. Der
  Interleaved-Zweig wird wirklich gefahren: beide Attribute erben `dynamic_float32`,
  `initializeAttributes.ts:48` nimmt bei `attributes.length > 1` den
  `InterleavedBuffer`-Pfad, und `bufferOf(position) === bufferOf(color)` kann nur halten,
  wenn dieser Pfad gelaufen ist. Die geprüften Zahlen sind an der Quelle bestätigt:
  `VertexObjectBuffer.ts:133` sortiert alphabetisch, also `color` bei Offset 0 und
  `position` bei 3; die Range 24 kommt aus `updateUpdateRange.ts:13` mit dem
  Buffer-`itemSize` 6 als Stride — 12 wäre die Zahl einer Rechnung, die den Stride
  übersieht, und der Test unterscheidet die beiden.

## Abweichungen vom Detailplan, beide vom Reviewer bestätigt

1. **Der Readback des interleaved-Browsertests läuft über einen neuen Helfer
   `readBackInterleaved()`**, nicht über den vorhandenen `readBack()`. Die Zusage des
   Detailplans, `readBack()` funktioniere unverändert, gilt nur auf dem WebGPU-Backend;
   Chromium fällt in dieser Umgebung auf WebGL2 zurück. Der Reviewer hat die Ursache an
   der three-Quelle nachgesehen: `WebGLAttributeUtils#createAttribute()` legt `byteLength`
   unter dem Attribut-Wrapper ab (`:182`), setzt auf dem geteilten `bufferAttribute` aber
   nur `bufferGPU`, `bufferType` und `version` (`:99-105`); `getArrayBufferAsync()`
   (`:273-277`) schlägt unter dem geteilten Buffer nach, findet `undefined`, rechnet `NaN`
   und legt einen Zielpuffer von 0 Bytes an. Für ein `InterleavedBufferAttribute` kann
   `readBack()` im WebGL-Fallback also gar nicht funktionieren. Der neue Helfer hält die
   Gabelung und nimmt auf WebGPU den alten Weg. Die Zahlen des Detailplans sind auf beiden
   Backends bestätigt.
2. **Der Testname aus Schritt 4 lautet »a pool that was detached is not disposed a second
   time by geometry.dispose()«** statt des Vorschlags der Paketdatei. Der Test spioniert
   `extraPool.dispose` nach dem Detach an und weist nach, dass `geometry.dispose()` ihn
   nicht ein zweites Mal ruft; der Vorschlag hätte eine Buchführung benannt, die der Test
   gar nicht anfasst. Der Testkörper ist unverändert.

## Kleine Befunde, offen gelassen

- `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js:39-44` — der
  TSDoc-Block über `readBackInterleaved()` beschreibt den three-Fehler, nennt aber weder
  die Version noch die Fundstelle; wer den Workaround nach einem three-Upgrade zurückbauen
  will, muss die Diagnose neu führen. Hineingehörte, dass
  `WebGLAttributeUtils#createAttribute()` die `byteLength` unter dem Attribut-Wrapper
  ablegt und `getArrayBufferAsync()` sie unter dem geteilten Buffer sucht, samt der
  Version, in der das gilt (three 0.185.1).
- `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js:52` —
  `gl.bindBuffer(gl.ARRAY_BUFFER, …)` lässt die Bindung stehen. Heute harmlos, weil der
  Test der letzte der Datei ist und `afterEach` das Display abräumt; ein später
  eingefügtes `it()` erbt sie. Nach dem `getBufferSubData()` müsste
  `gl.bindBuffer(gl.ARRAY_BUFFER, null)` stehen.
- `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js:47` —
  `readBackInterleaved(display, attr)` nimmt das Display, der Schwesterhelfer
  `readBack(renderer, attr)` den Renderer; zwei benachbarte Helfer mit derselben Aufgabe
  und verschiedenen ersten Parametern sind eine Stolperstelle beim Aufruf.
- Commit-Message — vor Zug 5 erledigt: das fünfte Glied benennt jetzt die Umbenennung aus
  Schritt 4.

## Nebenbefunde des Implementierers

- `VertexObjects.ts:30` (der `XXX`-Marker im TSDoc von `update()`) steht bereits seit
  Paket 1b in »Offene Befunde«; der Implementierer hat ihn unter `:20` gemeldet, gemeint
  ist dieselbe Stelle. Nachgesehen: der Marker sitzt auf Zeile 30. Kein neuer Eintrag.
- three 0.185.1 liefert im WebGL-Fallback für interleavte Attribute über
  `getArrayBufferAsync()` 0 Bytes zurück (siehe Abweichung 1). Fremdabhängigkeit, aus
  diesem Repo nicht behebbar, betrifft jeden Konsumenten, der interleavte Attribute im
  Fallback zurückliest. Neu in »Offene Befunde«, Urteil `→ Audit`: der Workaround liegt
  in `packages/twopoint5d-testing/`, außerhalb des Moduls, auf das die Scope-Regel zeigt.
