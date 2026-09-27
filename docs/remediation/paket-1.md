# Paket 1 — Hot-Path-Benches und Accessor-/VO-Erzeugung ohne Overhead

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-001 (medium), PERF-023 (low), PERF-025 (low), PERF-022 (low) · dazu die
  Messung für PERF-034 (low); dessen Umsetzung ist Paket 3
- Ziel: Der rAF-Hot-Path von vertex-objects, sprites und map2d hat Allokationstests im
  Gate und Bench-Suiten mit CI-Archiv; die generierten Accessoren erreichen ihr Typed
  Array ohne Map-Lookup, `createVO()` baut ein VO ohne Property-Deskriptoren,
  `createIndicesArray()` prüft seine Indizes einmal statt pro Element — und die Messung der
  Megamorphie liegt als Zahl vor, auf der Paket 3 entscheidet.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - Harness: `packages/twopoint5d/vite.config.ts`, `packages/twopoint5d/tsconfig.build.json`,
    `packages/twopoint5d/project.json`, `packages/twopoint5d/package.json`, `package.json`,
    `.gitignore`, `.prettierignore`, `.github/workflows/ci.yml`,
    neu `packages/twopoint5d/src/testing/measureAllocatedBytes.ts`
  - Allokationstests (neu): `packages/twopoint5d/src/vertex-objects/hot-path-allocations.spec.ts`,
    `packages/twopoint5d/src/sprites/hot-path-allocations.spec.ts`,
    `packages/twopoint5d/src/map2d/TileSprites/hot-path-allocations.spec.ts`
  - Benches (neu): `packages/twopoint5d/src/vertex-objects/hot-path.bench.ts`,
    `packages/twopoint5d/src/sprites/hot-path.bench.ts`,
    `packages/twopoint5d/src/map2d/TileSprites/hot-path.bench.ts`
  - Fixes: `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`,
    `createVertexObjectPrototype.ts`, `createVertexObject.ts`, `createIndicesArray.ts`,
    `GeometryAttributeSlots.ts` (alle in `packages/twopoint5d/src/vertex-objects/`)
  - Tests zu den Fixes: `createVertexObjectPrototype.spec.ts`, `createIndicesArray.spec.ts`
    (beide in `packages/twopoint5d/src/vertex-objects/`)
  - Doku: `AGENTS.md`, `docs/architecture.md`, `packages/twopoint5d/CHANGELOG.md`
- Verify (vom Repo-Root): `pnpm run ci && pnpm bench`
- Commit: `perf(vertex-objects): reach the typed array of a generated accessor by its position in the buffer, build a vertex object by plain assignment and check the indices of createIndicesArray() once, and hold the hot path of vertex objects, sprites and map2d to allocation specs and to benchmarks whose results CI archives`

## Vorgehen

Reihenfolge ist Pflicht: erst Harness und Tests gegen den unveränderten Code (rote Läufe
und Vorher-Zahlen sichern), dann die drei Fixes, dann Doku. Alle Messwerte, die unten
verlangt werden, gehören mit Zahl in den Report.

### 1. Harness

1. `packages/twopoint5d/src/testing/measureAllocatedBytes.ts` anlegen. Der Ordner
   `src/testing/` ist Test-Infrastruktur der Vitest-Suiten der Bibliothek und wird nie
   gebaut oder veröffentlicht (Schritt 1.3). Inhalt, exakt in dieser Form:

   ```ts
   import {GCProfiler, getHeapStatistics} from 'node:v8';

   export interface MeasureAllocatedBytesOptions {
     /** Rounds run before the measurement, default 200. */
     warmUpRounds?: number;
     /** Rounds measured, default 50. */
     rounds?: number;
   }

   export function measureAllocatedBytes(round: () => void, options: MeasureAllocatedBytesOptions = {}): number
   ```

   Ablauf der Funktion, in dieser Reihenfolge:
   1. Ist `globalThis.gc` keine Funktion, wirf
      `new Error('measureAllocatedBytes() needs --expose-gc: run the spec through the Vitest config of packages/twopoint5d, which starts its workers with it')`.
   2. `round()` `warmUpRounds`-mal aufrufen.
   3. `globalThis.gc()` einmal.
   4. `const profiler = new GCProfiler(); profiler.start();` — danach
      `const start = getHeapStatistics().used_heap_size;`
   5. `round()` `rounds`-mal aufrufen.
   6. `const end = getHeapStatistics().used_heap_size;` — danach `const result = profiler.stop();`
   7. `collected` = Summe über `result.statistics` von
      `beforeGC.heapStatistics.usedHeapSize - afterGC.heapStatistics.usedHeapSize`.
   8. Rückgabe `(end - start + collected) / rounds` — die Heap-Bytes einer Runde.

   TSDoc und Kommentare, sinngemäß und auf Englisch: Der Wert zählt, was eine Runde auf dem
   V8-Heap anlegt; was eine Garbage Collection währenddessen wieder einsammelt, rechnet der
   `GCProfiler` zurück, deshalb bleibt die Zahl auch dann stabil, wenn Scavenges mitten in
   der Messung laufen. Die Aufwärmrunden lassen den optimierenden Compiler die Form finden,
   die ein langer Frame-Loop fährt — gemessen wird der Code, den eine Anwendung nach ein
   paar Sekunden ausführt, nicht der Interpreter. Backing Stores von Typed Arrays liegen
   außerhalb des Heaps und zählen nicht. Hintergrund zur Methode: In Zug 0 auf Node 24.21
   lieferte sie nach dem Aufwärmen über wiederholte Läufe dieselben Werte auf ±1 B pro
   Runde, mit und ohne V8-Coverage.

2. `packages/twopoint5d/vite.config.ts`, im Block `test`:
   - `execArgv: ['--expose-gc']` mit Kommentar: die Allokationsspecs rufen `gc()` vor jeder
     Messung (`src/testing/measureAllocatedBytes.ts`), und ohne das Flag gibt es die
     Funktion nicht.
   - `benchmark: {include: ['src/**/*.bench.ts']}` mit Kommentar analog zu `include`: auf
     `src/` festgenagelt wie die Specs.
   - `coverage.exclude` wird `['src/**/*.spec.ts', 'src/**/*.bench.ts', 'src/testing/**']` —
     `coverage.include` zählt jede Datei unter `src/`, auch eine, die kein Spec lädt; eine
     Bench-Datei mit 0 % zöge die Schwellen herunter.
3. `packages/twopoint5d/tsconfig.build.json`: `"exclude": ["**/*.spec.ts", "**/*.bench.ts", "src/testing"]`,
   den Kopfkommentar um einen Satz ergänzen: Benches und `src/testing/` sind
   Test-Infrastruktur und gehören so wenig nach `dist/` wie die Specs.
   `packages/twopoint5d/project.json`: in `targets.build.inputs` hinter
   `"!{projectRoot}/src/**/*.spec.ts"` die Einträge `"!{projectRoot}/src/**/*.bench.ts"` und
   `"!{projectRoot}/src/testing/**"`; neues Target `"bench": {"cache": false}` — Zeitwerte
   sind nie ein Cache-Treffer.
4. Scripts:
   - `packages/twopoint5d/package.json`:
     `"bench": "pnpm vitest bench --run --reporter=default --reporter=json --outputFile.json=bench-results/results.json"`
     (hinter `"coverage"` einsortieren).
   - Root-`package.json`: `"bench": "pnpm nx run-many -t bench"` hinter `"test:affected"`.
     **Nicht** in `"ci"` aufnehmen: das Gate prüft deterministische Größen, die Zeitwerte
     laufen im eigenen CI-Schritt und werden archiviert, nicht gegen Schwellen gehalten
     (Konvention im Plan).
5. `.gitignore`: `packages/*/bench-results` unter `packages/*/coverage`.
   `.prettierignore`: `packages/*/bench-results` unter `packages/*/coverage`.
6. `.github/workflows/ci.yml`:
   - Direkt nach dem Schritt `Build packages and run all tests` ein Schritt
     `Run the hot-path benchmarks` mit `run: pnpm bench` und `timeout-minutes: 10`, davor
     ein Kommentar im Stil der Datei: the timings are archived, not held to a limit — a
     shared runner's timings vary too much for a gate, and it is the series over many runs
     that shows a regression; the allocation specs in the gate hold what can be counted.
   - Hinter `Archive coverage report` ein Schritt `Archive benchmark results`: dieselbe
     gepinnte Action `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1`,
     `if: always()`, `name: bench`, `path: packages/twopoint5d/bench-results`,
     `retention-days: 90` — länger als die 3 Tage der Coverage, weil erst die Reihe über
     Wochen eine Regression zeigt; ein Kommentar sagt das.

### 2. Allokationstests (Gate) — gegen den unveränderten Code schreiben und laufen lassen

Gemeinsame Regeln für alle drei Dateien:

- Jeder Test misst mit `measureAllocatedBytes()` (Import aus `../testing/measureAllocatedBytes.js`
  bzw. `../../testing/measureAllocatedBytes.js`), Optionen Default (200 Aufwärm-, 50
  Messrunden), und teilt das Ergebnis durch die Zahl der Operationen einer Runde.
- Zwei Grenzen, als benannte Konstanten oben in jeder Datei mit Kommentar, der die
  Zahlen aus Zug 0 nennt:
  - `BYTES_PER_CALL_LIMIT = 1` — ein Aufruf, der etwas anlegt, kostet mindestens 16 B;
    gemessen lagen die allokationsfreien Pfade in Zug 0 unter 0,4 B pro Aufruf (Rauschen
    von einigen hundert Byte pro Runde, verteilt auf tausend Aufrufe).
  - `BYTES_PER_VERTEX_OBJECT_LIMIT = 128` — ein VO aus `Object.create(proto)` mit zwei
    Feldern kostet in Zug 0 gemessen 56 B, eines mit Property-Deskriptoren 552 B.
- Die Assertion trägt eine Meldung mit dem gemessenen Wert, etwa
  ``expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT)``.
- Scheitert eine Messung nach dem Fix knapp, wird `warmUpRounds` erhöht, nie die Grenze;
  eine Grenze über den hier genannten ist eine Abweichung mit Grund im Report.
- Keine Assertion auf `update()` einer Geometrie: dessen Allokationen behebt Paket 2 und
  erweitert dafür diese Dateien.

**`src/vertex-objects/hot-path-allocations.spec.ts`**, `describe('vertex objects on the hot path', …)`:

1. `test('the generated accessors of up to four values allocate nothing per call')` —
   `new VertexObjectPool(description, 1000)` mit
   `{vertexCount: 1, attributes: {position: {components: ['x', 'y', 'z'], usage: 'dynamic'}, color: {components: ['r', 'g', 'b', 'a']}, rotation: {size: 1, usage: 'dynamic'}}}`,
   1000 VOs per `createVO()`. Eine Runde schreibt je VO: `vo.x = i`, `vo.rotation = i`,
   `vo.setPosition(i, 1, 2)`, `vo.setColor(colorScratch)` (ein `[number, number, number, number]`
   außerhalb der Runde), `vo.getPosition(positionTarget)` (ein `Float32Array(3)` außerhalb),
   und liest `vo.y` (Ergebnis in eine Summe außerhalb, damit nichts wegoptimiert wird) —
   6 Aufrufe je VO, 6000 je Runde. Grenze `BYTES_PER_CALL_LIMIT`.
2. `test('the per-vertex component accessors of a multi-vertex object allocate nothing per call')` —
   `{vertexCount: 4, attributes: {position: {components: ['x', 'y', 'z']}}, indices: [0, 1, 2, 0, 2, 3]}`,
   1000 VOs; je VO `vo.x0 = i`, `vo.y3 = i`, Lesen von `vo.z2`, `vo.getPosition(target)`
   mit einem `Float32Array(12)` — 4 Aufrufe je VO. Grenze `BYTES_PER_CALL_LIMIT`.
   Den Setter `setPosition()` dieses Attributs (zwölf Werte, Rest-Parameter) **nicht**
   aufnehmen: er alloziert pro Aufruf ein Array und steht als Nebenbefund in der Queue.
3. `test('createVO() allocates the vertex object and nothing else')` — Pool mit Capacity
   1100 und 1000 belegten Slots (Description aus Test 1); eine Runde macht 100-mal
   `const vo = pool.createVO()!; pool.freeVO(vo);` (Anlegen am Ende, Freigeben des letzten
   Slots). Bytes je `createVO()`, Grenze `BYTES_PER_VERTEX_OBJECT_LIMIT`. **Muss vor dem
   Fix aus Schritt 4 rot sein** (erwartet um 550 B) — der rote Lauf gehört in den Report.

**`src/sprites/hot-path-allocations.spec.ts`**, `describe('sprites on the hot path', …)`:

1. `test('moving, turning, tinting and re-framing a textured sprite allocates nothing per call')` —
   `new TexturedSprites(1000)`, 1000 Sprites per `createSprite()`. Je Sprite:
   `sprite.setPosition(i, 1, 2)`, `sprite.rotation = i`, `sprite.setColor(color)` mit einem
   `Color` außerhalb der Runde, `sprite.setFrame(i & 1 ? frame : trimmedFrame)` — die beiden
   Frames wie in `TexturedSprites.spec.ts` (`frame` und `trimmedFrame`, dort Zeile 14–22,
   hierher kopiert). 4 Aufrufe je Sprite. Grenze `BYTES_PER_CALL_LIMIT`.
2. `test('moving and animating an animated sprite allocates nothing per call')` —
   `new AnimatedSpritesGeometry(1000).instancedPool`, 1000 VOs per `createVO()`. Je Sprite:
   `sprite.setPosition(i, 1, 2)`, `sprite.rotation = i`, `sprite.animOffset = i`. Grenze
   `BYTES_PER_CALL_LIMIT`. Die Geometrie am Testende per `dispose()` freigeben.
3. `test('createSprite() allocates the sprite and nothing else')` — `new TexturedSprites(1100)`
   mit 1000 Sprites; Runde: 100-mal `const s = sprites.createSprite()!; sprites.freeSprite(s);`.
   Bytes je `createSprite()` (schließt den `voInitialize`-Hook ein), Grenze
   `BYTES_PER_VERTEX_OBJECT_LIMIT`. Vor dem Fix rot (Zug 0: 552 B).

Jeder Test gibt, was er baut, am Ende mit `dispose()` frei, wie die übrigen Specs der Module.

**`src/map2d/TileSprites/hot-path-allocations.spec.ts`**, `describe('tile sprites on the hot path', …)`:

Aufbau wie in `TileSpritesFactory.spec.ts`: `new TileSprites(new TileSpritesGeometry(1100))`,
`new TileSpritesFactory(tileSprites, makeTileSet(), new RepeatingTilesProvider(1))` mit
`makeTileSet = () => new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128})`,
1000 Tiles per `factory.createTile(coords[i])` mit
`coords[i] = new Map2DTileCoords(i % 40, Math.floor(i / 40), new AABB2(i * 10, 0, 10, 10))`.

1. `test('updateTile() allocates nothing per tile')` — Runde:
   `factory.updateTile(tiles[i], coords[i])` für alle 1000. Grenze `BYTES_PER_CALL_LIMIT`
   (Zug 0: 0,36 B).
2. `test('createTile() and destroyTile() allocate the tile sprite and nothing else')` —
   Runde: 100-mal `const t = factory.createTile(coords[i]); factory.destroyTile(t as TileSprite);`
   (vorher auf `!== undefined` und `!== noTileCapacity` prüfen, per `expect` außerhalb der
   Messung einmal). Bytes je Tile, Grenze `BYTES_PER_VERTEX_OBJECT_LIMIT`. Vor dem Fix rot
   (Zug 0: 552 B).

### 3. Benches (archiviert, keine Schwellen)

Vitest 5 führt Benchmarks als Fixture eines gewöhnlichen Tests aus — kein `describe`/`bench`
auf oberster Ebene wie in Vitest 1–3:

```ts
import {test} from 'vitest';

test('…', async ({bench}) => {
  await bench.compare(bench('a', () => { … }), bench('b', () => { … }), {time: 500, warmupTime: 200});
});
```

`bench('name', fn).run(options)` für eine einzelne Messung. In Zug 0 an einer
Scratch-Kopie geprüft: `vitest bench --run --reporter=json --outputFile=…` schreibt die
Ergebnisse unter `testResults[].assertionResults[].benchmarks[].tasks[]` mit `latency.mean`
in Millisekunden. Optionen überall `{time: 500, warmupTime: 200}`. Keine Assertions auf
Zeitwerte.

**`src/vertex-objects/hot-path.bench.ts`**:

1. `test('generated setters across vertex object descriptors', …)` — die Messung für
   PERF-034. Sechs Pools mit je 10 000 VOs; Description
   `(k) => ({vertexCount: 1, attributes: {position: {components: ['x', 'y', 'z'], usage: 'dynamic'}, [`extra${k}`]: {size: 1 + (k % 3), usage: 'dynamic'}}})`.
   - Variante `six pools, one descriptor`: alle sechs Pools auf **derselben Instanz**
     `new VertexObjectDescriptor(description(0))` — nur so teilen sie einen Prototyp; eine
     Description je Pool baut je Pool einen eigenen Descriptor und damit einen eigenen
     Prototyp.
   - Variante `six pools, six descriptors`: Pool `k` mit `description(k)`.
   - Jeder Pool bekommt einen eigenen Schreiber mit eigener Aufrufstelle:
     `new Function('vos', 'n', 'for (let i = 0; i < vos.length; i++) { const vo = vos[i]; vo.x = i + n; vo.y = n; vo.z = i; }')`,
     typisiert als `(vos: readonly PositionVO[], n: number) => void`. Kommentar, warum
     `new Function`: eine Aufrufstelle je Pool, wie eine Anwendung mit eigener Update-Schleife
     je Sprite-Typ sie hat; Closures aus einem Funktionsliteral teilen sich ihre Inline-Caches
     und machten die Aufrufstelle selbst megamorph — gemessen werden soll das Innere der
     generierten Accessoren. (Nur in der Bench-Datei; die ist nie Teil des Pakets.)
   - Eine Iteration: alle sechs Schreiber je einmal über ihren Pool, `n` zählt mit.
   - Ausgabe per `bench.compare(...)` beider Varianten.
2. `test('generated accessors of one descriptor', …)` — ein Pool mit 10 000 VOs
   (Description wie in Test 1 der Allokationsspec), `bench.compare` von
   `component setters x, y, z`, `setPosition(x, y, z)`, `getPosition(target)`.
3. `test('createVO() and freeVO()', …)` — Pool 1100/1000, eine Iteration 100-mal
   `createVO()` + `freeVO()`.

**`src/sprites/hot-path.bench.ts`**:

1. `test('a frame of 10 000 textured sprites', …)` — `new TexturedSprites(10_000)`, voll
   belegt; `bench.compare` von `move and turn every sprite` (je Sprite
   `setPosition`, `rotation`) und `move every sprite, then update()` (dasselbe plus
   `sprites.update()`), und `update() after moving one sprite`.
2. `test('a frame of 10 000 animated sprites', …)` — `new AnimatedSpritesGeometry(10_000)`,
   voll belegt über `instancedPool.createVO()`; `move every sprite, then update()` mit
   `geometry.update()`.

**`src/map2d/TileSprites/hot-path.bench.ts`**:

1. `test('scrolling 1000 tile sprites', …)` — Aufbau wie in der map2d-Allokationsspec;
   `bench.compare` von `updateTile() for every tile, then update()` (mit `factory.update()`)
   und `destroyTile() and createTile() for 100 tiles, then update()`.

Jede Bench-Datei gibt in `afterAll` bzw. am Testende frei, was sie gebaut hat.

**Vorher-Zahlen:** `pnpm bench` einmal vor Schritt 4 laufen lassen und aus
`packages/twopoint5d/bench-results/results.json` je Task `latency.mean` in den Report
übernehmen, nach allen Fixes noch einmal. Für die PERF-034-Messung zusätzlich je Variante
**ns pro VO** = `latency.mean × 1e6 / 60 000` und den Faktor
`six descriptors / one descriptor` — nach Schritt 4, denn der Default, gegen den Paket 3
entscheidet, ist der numerische Index. Referenz aus Zug 0 (Scratch-Kopie mit numerischem
Index, Node 24.21, eigener Loop statt tinybench): 5,1 ns/VO gegen 53 ns/VO, Faktor 10.

### 4. PERF-023 — Accessoren über einen numerischen Buffer-Index

Zuerst den Regressionstest, rot sehen, dann den Fix.

1. Regressionstests in `createVertexObjectPrototype.spec.ts`:
   - `test('the generated accessors reach their typed array without the buffers getter')`:
     Pool bauen und ein VO anlegen, **danach**
     `const buffersGetter = vi.spyOn(VertexObjectBuffer.prototype, 'buffers', 'get');`, dann
     `vo.x = 1`, Lesen von `vo.x`, `vo.setPosition(1, 2, 3)`, `vo.getPosition(target)`,
     `vo.getPosition()` und — auf dem Quad-Descriptor aus Test 2 der Allokationsspec — `x0`
     sowie `setPosition(new Float32Array(12))`;
     `expect(buffersGetter).not.toHaveBeenCalled()`. Vor dem Fix rot.
   - `test('a typed array put in through setTypedArray() is the one the accessors read and write')`:
     `pool.buffer.setTypedArray(bufferName, next)` mit einem neuen Array passender Länge,
     dann liest `vo.x` aus `next` und `vo.x = 7` landet in `next`.
   - `test('every buffer built from one descriptor lists its records in the same order')`:
     `bufferList.map((b) => b.bufferName)` gleich `[...buffers.keys()]`, für
     `new VertexObjectBuffer(descriptor, 2)`, dessen `clone()` und
     `new VertexObjectBuffer(descriptor, 5)`; dazu: ein VO, das ein `VertexObjectPool#resize()`
     überlebt, liest und schreibt danach im neuen Buffer.
   - `test('a released buffer lists no records')`: nach `pool.dispose()` ist
     `buffer.bufferList.length === 0`.
2. `VertexObjectBuffer.ts`:
   - Neues Feld `readonly bufferList: AttributeBuffer[] = [];` mit TSDoc und `@internal`:
     die Records von `buffers` in der Reihenfolge der Map, für die generierten Accessoren,
     die einen Record über seine Position statt über seinen Namen erreichen. Jeder Buffer
     aus demselben Descriptor listet sie in derselben Reihenfolge — der Konstruktor baut sie
     aus den sortierten Attributnamen oder übernimmt die Reihenfolge der Quelle —, deshalb
     trägt der Prototyp, den der erste Buffer eines Descriptors baut, für jeden weiteren
     (`resize()`, `clone()`) die richtigen Positionen. Leer, sobald der Pool entsorgt ist,
     wie `buffers`.
   - Ein Modul-Helfer `createAttributeBuffer(bufferName, itemSize, dataType, usageType, typedArray): AttributeBuffer`,
     der das Record-Literal mit **immer derselben Schlüsselreihenfolge** baut:
     `bufferName, itemSize, dataType, usageType, typedArray, serial: 0, dirtyFrom: -1, dirtyTo: -1, dirtySince: 0, pickedUpSerial: 0`.
     Beide Zweige des Konstruktors bauen ihre Records nur noch darüber (der
     Descriptor-Zweig verliert den Spread `{...buffer, typedArray}`; `forming` behält nur,
     was es zum Aufsummieren braucht). Kommentar: alle Records teilen sich damit eine Form,
     und die Accessoren, die `typedArray` von Records vieler Buffer lesen, treffen eine
     einzige Hidden Class. Das ist ein in Zug 0 aufgenommener Nebenbefund mit derselben
     Ursache wie PERF-023: die beiden Zweige legten Records mit verschiedener
     Schlüsselreihenfolge an.
   - Am Ende des Konstruktors, vor dem Bau des Prototyps:
     `for (const record of this.#buffers.values()) this.bufferList.push(record);`
   - `release()`: zusätzlich `this.bufferList.length = 0;`.
   - `setTypedArray()` bleibt, wie es ist: es tauscht das Array im selben Record, und
     `bufferList` zeigt auf dieselben Records.
3. `createVertexObjectPrototype.ts`:
   - Alle fünf Fabriken (`makeAttributeGetter`, `makeAttributeSetter`,
     `makeAttributeValuesGetter`, `makeAttributeValueSetter`, `makeFixedAttributeValueSetter`)
     nehmen statt `bufferName: string` ein `bufferIndex: number` und greifen mit
     `this[voBuffer]!.bufferList[bufferIndex]!` zu. `makeAttributeValuesGetter` braucht den
     `dataType` für `createTypedArray()` weiter aus dem Record.
   - `createVertexObjectPrototype()` bestimmt je Attribut einmal
     `const bufferIndex = voBuffer.bufferList.indexOf(buf);` (der Record `buf`, den es schon
     aus `voBuffer.buffers.get(bufAttr.bufferName)!` holt) und reicht ihn weiter.
   - Den Kommentarblock in jedem Accessor an den Index anpassen (bleibt inhaltlich: ein
     lebendes VO hat seinen Buffer, der hält sein Typed Array und jeden Record seines
     Descriptors; die Accessoren laufen pro Sprite und Frame und asserten deshalb, statt zu
     prüfen).
4. Nach dem Fix: Regressionstest grün, `pnpm bench` für die Nachher-Zahlen und die
   PERF-034-Messung (Schritt 3).

### 5. PERF-025 — VO ohne Property-Deskriptoren

1. Der rote Lauf ist Test 3 der vertex-objects-Allokationsspec und Test 3 der
   sprites-Spec (Schritt 2); beide vor diesem Schritt rot im Report.
2. `createVertexObject.ts`:

   ```ts
   const vo = Object.create(descriptor.voPrototype) as NewVertexObject<VOType>;
   vo[voBuffer] = buffer;
   vo[voIndex] = objectIndex;
   return vo;
   ```

   Kommentar dazu: zwei Zuweisungen halten die Erzeugung auf dem schnellen Pfad; ein
   Property-Deskriptor je Feld kostet drei Deskriptor-Objekte und den langsamen
   Define-Pfad pro VO, und `createVO()` läuft beim Scrollen einer Karte im Frame. Den
   bestehenden Kommentar zu `Object.create()` und `VOType` behalten.
3. Folge, die mitgezogen wird: `voBuffer` und `voIndex` sind jetzt aufzählbare eigene
   Properties — ein Spread oder `Object.assign()` kopiert beide. In Zug 0 geprüft: kein
   Test vergleicht VOs per `toEqual`, kein Code spreadet ein VO. CHANGELOG-Eintrag siehe
   Schritt 7.
4. **Keine** Freiliste freigegebener VO-Objekte (die Empfehlung nennt sie optional):
   ein Pool, der ein freigegebenes VO wieder ausgibt, gäbe einem Aufrufer, der die alte
   Referenz noch hält, ein Objekt zurück, das plötzlich in einen lebenden Slot schreibt.
   Mit 56 B pro VO bleibt nichts, was das rechtfertigt.

### 6. PERF-022 — Meldungen nicht pro Element bauen

Abweichung von der Empfehlung, mit Grund: **keine** lazy Variante `expectDefined(v, () => …)`.
Eine Closure pro Aufruf ist auf genau den Compiler-Stufen eine Allokation, auf denen es das
Template-Literal ist; beide Fundstellen lassen sich ohne sie lösen.

1. Regressionstest in `createIndicesArray.spec.ts`, zuerst rot sehen:
   - Oben in der Datei `expectDefined` als Spy auf das Original mocken:

     ```ts
     vi.mock('../utils/expectDefined.js', async (importOriginal) => {
       const original = await importOriginal<typeof import('../utils/expectDefined.js')>();
       return {expectDefined: vi.fn(original.expectDefined)};
     });
     ```

     Dazu `vi` aus `vitest` und `expectDefined` aus `../utils/expectDefined.js` importieren;
     `vi.mock` wird über die Imports gehoben, die beiden bestehenden Tests laufen gegen das
     Original weiter.

   - `test('checks each index once, not once per object')`:
     `createIndicesArray([0, 2, 1, 0, 3, 2], 1000, 4)`, dann
     `expect(vi.mocked(expectDefined)).toHaveBeenCalledTimes(6)` (vorher
     `vi.mocked(expectDefined).mockClear()`; `restoreMocks` stellt nur Spies wieder her,
     nicht diesen Mock). Vor dem Fix: 6000 Aufrufe.
   - `test('names the index an array of indices does not hold')`:
     `createIndicesArray([0, undefined, 2] as unknown as number[], 2, 3)` wirft
     `expected index 1 to be defined`.
2. `createIndicesArray.ts`: die Indizes einmal vor der Schleife in ein lokales Array
   kopieren und dabei prüfen:
   `const local = Uint32Array.from(indices, (index, j) => expectDefined(index, `index ${j}`));`
   Die Doppelschleife liest danach `local[j]!` ohne Prüfung (Kommentar: `j` läuft unter
   `itemCount`, der Länge von `local`). TSDoc der Funktion um den Satz ergänzen, dass
   ein fehlender Index vor dem ersten geschriebenen Element wirft.
3. `GeometryAttributeSlots.ts`, `poolOf()`: die Prüfung entfällt, sie schützt nichts — der
   Index kommt aus der Länge desselben Arrays, und die Antwort darf `undefined` sein:

   ```ts
   const claims = this.#slots.get(attrName);
   // the topmost claim owns the slot; an empty list has none
   return claims === undefined ? undefined : claims[claims.length - 1]?.pool;
   ```

   `poolOf()` läuft über `syncArrays()` in jedem Frame, in dem ein Buffer hochgeladen
   wurde. Der Import von `expectDefined` bleibt (Zeile 117 und 126 brauchen ihn).

### 7. Doku

1. `packages/twopoint5d/CHANGELOG.md`, `[Unreleased]` → `### Changed`, nach dem Skill
   `updating-changelog`: ein Eintrag — ein VO aus `VertexObjectPool#createVO()` oder
   `#getVO()` trägt `voBuffer` und `voIndex` als aufzählbare eigene Properties, ein Spread
   oder `Object.assign()` kopiert beide; die generierten Accessoren erreichen das Typed
   Array ihres Buffers über dessen Position. Harness, Benches und CI-Schritt bekommen
   **keinen** Eintrag: sie erreichen das npm-Paket nicht.
2. `AGENTS.md`:
   - unter »Commands« hinter `pnpm test:coverage`: `pnpm bench` — die Hot-Path-Benchmarks der
     Bibliothek (`src/**/*.bench.ts`) über `vitest bench`; die Zeiten landen in
     `packages/twopoint5d/bench-results/results.json`, das CI archiviert; nicht Teil von
     `pnpm run ci`, weil Zeitwerte archiviert und nicht gegen Schwellen gehalten werden.
   - in der Regel »Two test surfaces« ein Satz: eine `hot-path-allocations.spec.ts` misst
     die Heap-Bytes eines Hot-Path-Aufrufs über `src/testing/measureAllocatedBytes.ts`; die
     Vitest-Konfiguration startet ihre Worker dafür mit `--expose-gc`, und `src/testing/`
     erreicht `dist/` nie.
3. `docs/architecture.md`:
   - §2 hinter dem Absatz zum Target `coverage`: das Target `bench` der Bibliothek —
     `vitest bench` über `src/**/*.bench.ts`, ungecacht, Ausgabe
     `{projectRoot}/bench-results/results.json`, die der CI-Workflow archiviert.
   - §2, Satz zu den `build`-Inputs: schließt `*.spec.ts`, `*.bench.ts` und `src/testing/` aus.
   - »In CI«: ein Absatz zum Schritt `Run the hot-path benchmarks` nach dem Gate und zum
     Artefakt `bench` mit 90 Tagen Aufbewahrung, samt Grund.

### 8. Verify und Report

`pnpm run ci && pnpm bench` vom Repo-Root. In den Report:

- die roten Läufe: PERF-023-Regressionstest, PERF-022-Aufrufzähltest, beide
  `createVO()`/`createSprite()`-Allokationstests und der `createTile()`-Test (Werte);
- je Allokationstest der gemessene Wert nach dem Fix, einmal unter
  `pnpm nx test twopoint5d -- src/vertex-objects/hot-path-allocations.spec.ts src/sprites/hot-path-allocations.spec.ts src/map2d/TileSprites/hot-path-allocations.spec.ts`
  und einmal aus `pnpm test:coverage`;
- die Bench-Zahlen vorher/nachher und die PERF-034-Messung (ns/VO beider Varianten, Faktor).

## Für Runner B

- `Ergebnis:` im Plan nennt die PERF-034-Messung wörtlich in dieser Form:
  `Messung Megamorphie: six pools, one descriptor = a ns/VO · six pools, six descriptors = b ns/VO · Faktor b/a` —
  Paket 3 entscheidet daran (Schwelle 1,5, steht in seinem Block im Plan).
- `Schnittstellen:` nennt mindestens: `measureAllocatedBytes(round, {warmUpRounds, rounds})`
  in `packages/twopoint5d/src/testing/` (Heap-Bytes je Runde, braucht `--expose-gc` aus
  `vite.config.ts`) · die drei `hot-path-allocations.spec.ts` und `hot-path.bench.ts` samt
  Pfad (Paket 2 erweitert sie) · `VertexObjectBuffer#bufferList` (`@internal`, Records in
  Map-Reihenfolge, Accessoren greifen per Index zu) · die Accessor-Fabriken nehmen einen
  `bufferIndex` statt eines Namens · `pnpm bench`.
- PERF-034 wird in diesem Paket **nicht** geschlossen; es steht unter Paket 3.

## Abgleich (Zug 0, 2026-09-27)

- **TEST-001** — unverändert. Kein `bench`-/`perf`-Target in `package.json:13–35`,
  `packages/twopoint5d/package.json:48–60`, `nx.json:7–57`; kein `*.bench.ts`, Vitest nirgends
  im Bench-Modus. `packages/twopoint5d-testing/web-test-runner.config.js:17–20` startet
  Chromium weiter mit `--enable-precise-memory-info --js-flags=--expose-gc`. Nachtrag zur
  Beschreibung des Audits: `packages/twopoint5d-testing/test/vertex-objects-heap.test.js`
  nutzt `performance.memory` und `gc()` bereits — für Lecks über 100 Geometrie-Runden, nicht
  für Allokationen pro Frame; die Lücke besteht also wie beschrieben. `ci.yml:117–123`
  archiviert Coverage, keine Benches.
- **PERF-023** — unverändert: `createVertexObjectPrototype.ts:12, 23, 43, 94, 119`
  (`this[voBuffer]!.buffers.get(bufferName)!`). `VertexObjectBuffer.ts:80` Getter `buffers`.
- **PERF-025** — unverändert: `createVertexObject.ts:18–21`, Aufruf in
  `VertexObjectPool.ts:247` (`#createVO`), `freeVO()` in `VertexObjectPool.ts:192–216`
  verwirft das VO per `clearBuffer`.
- **PERF-022** — unverändert: `createIndicesArray.ts:17`, `GeometryAttributeSlots.ts:98`
  (`poolOf()`, gerufen aus `syncArrays()` Zeile 158).
- **PERF-034** — unverändert: vier bzw. fünf Fabriken in `createVertexObjectPrototype.ts:6, 17, 28, 80, 99`.
- Keine Folgen aus früheren Paketen (Paket 1 ist das erste), »Offene Befunde« war leer.

## Entscheidungen in Zug 0

- **Paket geteilt:** die Umsetzung von PERF-034 (Codegen-Opt-in per `new Function` oder
  dokumentierter Abschluss) ist Paket 3, hinter Paket 2. Grund: die Vormessung in Zug 0
  bestätigt den Effekt deutlich (Faktor 10 nach dem numerischen Index), damit ist der
  Codegen samt Opt-in-Schalter, CSP-Doku und Paritätstests echte Arbeit, und Paket 1
  trägt mit Harness, drei Suiten, drei Fixes und CI schon genug. Paket 3 plant in seinem
  Zug 0 gegen die gemessene Zahl statt gegen eine Verzweigung hier. Hinter Paket 2, weil
  Paket 2 mit dem Stride-Padding das Buffer-Layout ändert, gegen das der Codegen seine
  Offsets backt. Die Nummer ist 3 statt `1b`: die Schleife liest die Marke von Paket 1
  unter genau dieser Nummer; eine Umbenennung in `1a` ließe sie mitten im Lauf ohne Paket 1
  stehen.
- **Allokationsmessung in Node statt im Browser:** der Hot Path ist reines JS; der
  `GCProfiler` aus `node:v8` rechnet eingesammelte Bytes zurück und liefert nach dem
  Aufwärmen reproduzierbare Werte (Zug 0: ±1 B pro Runde, auch unter V8-Coverage). Die
  Browser-Suite läuft zweimal (Chromium, Firefox), und Firefox hat weder `gc()` noch
  `performance.memory`. Die Specs laufen im Gate über `test:coverage`.
- **Benches nicht im Gate:** eigener CI-Schritt, Zeitwerte archiviert (Konvention im Plan).
- **Keine lazy `expectDefined`-Variante, keine VO-Freiliste** — Gründe in Schritt 5 und 6.

## Nebenbefunde aus Zug 0

- Aufgenommen (gleiche Ursache wie PERF-023): die beiden Konstruktorzweige von
  `VertexObjectBuffer` bauen ihre Records mit verschiedener Schlüsselreihenfolge
  (`VertexObjectBuffer.ts:148–159` gegen `:200–203`), nach `clone()` sehen die Accessoren
  zwei Record-Formen. Schritt 4.2.
- In die Queue (`→ Scope`): `createVertexObjectPrototype.ts:87` — `makeAttributeValueSetter`
  (Attribute mit mehr als vier Werten) nimmt seine Werte als Rest-Parameter und alloziert
  pro Aufruf ein Array: in Zug 0 gemessen 56 B mit einem Array-Argument, 144 B mit zwölf
  Einzelwerten, auch nach dem Aufwärmen. Urteil: Performance-Problem im Code unter
  `vertex-objects/`, die Scope-Regel greift; Severity low (die Sprite-Descriptoren der
  Bibliothek haben nur Attribute bis vier Werte, betroffen sind Quad-VOs mit Werten je
  Vertex). Andere Ursache als dieses Paket (Rest-Parameter, nicht Lookup), deshalb nicht
  hier. Die Allokationsspec aus Schritt 2 lässt diesen Setter bewusst aus; wer ihn behebt,
  nimmt ihn dort auf.

## Verlauf

- 2026-09-27 Zug 0: Detailplan steht · TEST-001, PERF-023, PERF-025, PERF-022, PERF-034
  unverändert an ihren Fundstellen · PERF-034-Umsetzung als Paket 3 abgespalten (hinter
  Paket 2) · keine Folgen zu verteilen · 1 Nebenbefund aufgenommen (Record-Form), 1 in die
  Queue (Rest-Array-Setter, `→ Scope`) · Vormessungen in Scratch-Kopie von `dist/`
  (Node 24.21): Setter 0,01 B/Aufruf, `createVO()` 552 B/VO, `updateTile()` 0,36 B,
  `update()` 2,6 KB/Frame, Megamorphie 5,1 → 53 ns/VO
- 2026-09-27 Zug 1: Implementierer beauftragt (claude-opus-5-5, Effort medium), Report nach `paket-1.impl-0.json` im Arbeitsverzeichnis
- 2026-09-27 Zug 2: Report FERTIG_MIT_VORBEHALT (Session 3510729b-f995-410e-b749-c204c82fb14d) · 4 Abweichungen (modullokale Symbol-Konstanten in `createVertexObjectPrototype.ts`, Megamorphie-Bench sequenziell per `run()`, `warmUpRounds: 1000` in den drei Erzeugungstests, `setColor` aus Sprite-Test 1 genommen) · 18 Dateien geändert/neu, Arbeitsbaum schmutzig · Verify `pnpm run ci && pnpm bench` exit=0 → `paket-1.verify.log`
- 2026-09-27 Zug 3: zwei Reviewer-Prozesse (claude-opus-5-5, medium; ein Startfehler des Runners ließ den ersten doch laufen) → `paket-1.review-0.json` (freigeben), `paket-1.review-0-versuch-2.json` (nachbessern: nur Buchung, kein Code) · Diff `paket-1.diff` · alle vier Findings plus Messung erfüllt, 4 Abweichungen akzeptiert, 1 wichtig (setColor-Allokation, CHANGELOG-Aussage), 3 klein
- 2026-09-27 Zug 4: keine Runde — der wichtige Befund ist vorbestehend (`CHANGELOG.md` Zeile 66 in 05d723d7 behauptet schon »allocate nothing per call« für `setColor()`), gebucht als Nebenbefund in »Offene Befunde« (→ Scope), keine Codeänderung nötig
- 2026-09-27 Zug 5: Commit 92facd32 auf main, Verify aus Zug 2 (exit=0, keine Änderung seither) · Megamorphie aus `bench-results/results.json`: 3,06 gegen 55,09 ns/VO, Faktor 18,0

## Findings im Volltext

**TEST-001 · medium · packages/twopoint5d-testing/test/map2d-tile-upload.test.js:1** — Performance-Regressionstests für den rAF-Hot-Path (vertex-objects, sprites, map2d) ergänzen
Weitere Fundstellen: `packages/twopoint5d-testing/web-test-runner.config.js:17`,
`packages/twopoint5d/package.json:50`, `package.json:13`, `nx.json:7`.
Für den performancekritischen rAF-Hot-Path (vertex-objects, sprites, map2d) gibt es in der Harness keine automatisierte Absicherung gegen Allokations- oder Timing-Regressionen. Weder das Root-package.json (Scripts build/test/test:ci/test:coverage/test:browser/test:scripts/test:affected) noch packages/twopoint5d/package.json (compile/typecheck/build/test/coverage/watch/...) noch nx.json (targetDefaults: build/test/typecheck/checkPkgTypes/checkNameableTypes/lintPkg/publishNpmPkg) kennen ein bench- oder perf-Target; Vitest wird nirgends im `bench()`-Modus verwendet. Die Vitest-Stichprobe (VertexObjectPool.spec.ts, FrameLoop.spec.ts, Map2DTileStreamer.spec.ts, TexturedSprites.spec.ts) prüft ausschließlich Korrektheit und Dispose-Lifecycle, nie Allokationszahl oder Zeitbudget pro Frame. Bemerkenswert: web-test-runner.config.js:17-20 startet Chromium bereits mit `--enable-precise-memory-info` und `--js-flags=--expose-gc` — die Infrastruktur für heap-basierte Messungen existiert also —, aber die beiden gesampelten Browsertests (map2d-tile-upload.test.js, sprites-textured-material.test.js) nutzen `performance.memory` oder `gc()` an keiner Stelle; sie prüfen nur, ob ein Buffer-Upload (Versionszähler) passiert oder nicht, nie wie viel dabei alloziert wird. Der CHANGELOG dokumentiert mehrfach handverlesene Allokationsoptimierungen in genau diesem Hot-Path (z. B. "the generated multi-component setters ... allocate nothing per vertex", "an upload ... carries only the objects that were written") — die Einhaltung dieser Eigenschaft hängt aktuell allein von Code-Review ab, nicht von einem Test, der bei einer Regression fehlschlägt.
Empfehlung: Für vertex-objects/sprites/map2d gezielte Vitest-`bench()`-Suiten oder einfache Allokations-Assertions (z. B. Objektzahl vor/nach einem simulierten Frame-Update über `--expose-gc` und `performance.memory` im Browser-Testrunner, der das bereits aktiviert) ergänzen, die bei einer Regression im Hot-Path (neue Allokation pro Frame, O(n)-Verschlechterung) sichtbar fehlschlagen oder zumindest einen Kennwert für den Menschen sichtbar machen. Mindestens einen CI-Schritt vorsehen, der ein solches Bench-Ergebnis archiviert (wie schon für Coverage in ci.yml geschehen), damit Regressionen über die Zeit auffallen.

**PERF-023 · low · packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:12** — Generierte Accessoren ohne string-keyed Map-Lookup pro Wert auflösen
Weitere Fundstellen: `createVertexObjectPrototype.ts:23, 43, 94, 119`.
Jeder generierte Getter und Setter, auch jede einzelne Komponente wie x0 oder y0, löst pro Zugriff `this[voBuffer]!.buffers.get(bufferName)!` auf. Das ist ein Aufruf des Getters VertexObjectBuffer#buffers (mit Brand-Check des Private Fields) plus ein string-keyed Map.get, bevor der eigentliche Typed-Array-Zugriff kommt. Es ist der häufigste Vorgang der Bibliothek; der Code-Kommentar sagt selbst »these accessors run per sprite and per frame«. Aufrufpfad: Anwendungscode im requestAnimationFrame, etwa sprite.x = … oder sprite.setInstancePosition(…) auf TexturedSprite/AnimatedSprite, sowie TileSpritesFactory.updateTile() → setInstancePosition(). Micro-Benchmark (Node/V8, 10 000 VOs, drei Setter je VO, monomorph): 11,6 ns/VO mit Map-Lookup gegenüber 3,4 ns/VO, wenn der Buffer über einen numerischen Index aus einem Array kommt; mit getrennten Callsites 18,6 gegenüber 13,8 ns. In absoluten Zahlen sind das etwa 0,05–0,08 ms pro Frame und 10 000 Sprites.
Beleg: `const buf = this[voBuffer]!.buffers.get(bufferName)!;`
Empfehlung: VertexObjectBuffer führt die AttributeBuffer-Records zusätzlich als Array in fester Reihenfolge ab dem Konstruktor. createVertexObjectPrototype() gibt den Accessoren den numerischen Index statt des Namens mit: `this[voBuffer]!.bufferList[k]!.typedArray![idx]`. Die Records bleiben über setTypedArray() dieselben Objekte, ein Array-Tausch bleibt also sichtbar; resize() baut einen neuen Buffer mit identischem Layout und damit identischen Indizes.

**PERF-025 · low · packages/twopoint5d/src/vertex-objects/createVertexObject.ts:18** — VO-Wrapper in createVO() ohne Property-Deskriptoren anlegen
Weitere Fundstelle: `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:215`.
createVertexObject() baut jedes VO mit `Object.create(proto, {[voBuffer]: {…}, [voIndex]: {…}})`. Das sind pro Aufruf drei Deskriptor-Objekte, dazu der langsame DefineProperties-Pfad statt einer Inline-Allokation. freeVO() verwirft das VO-Objekt (clearBuffer), der nächste createVO() baut ein neues; wiederverwendet wird nur der Slot im Typed Array. Aufrufpfad im Frame: TileSpritesFactory.createTile() → instancedPool.createVO() beim Scrollen der Karte, sowie jede Spawn-Logik im Anwendungscode. Micro-Benchmark (Node/V8): 330 ns je VO mit Deskriptoren gegenüber 9 ns mit Object.create(proto) plus zwei Zuweisungen. 1 000 Spawns pro Frame kosten damit etwa 0,33 ms statt 0,01 ms.
Beleg: `Object.create(descriptor.voPrototype, { [voBuffer]: {value: buffer, writable: true}, [voIndex]: {value: objectIndex, writable: true} })`
Empfehlung: Auf `const vo = Object.create(proto); vo[voBuffer] = buffer; vo[voIndex] = idx;` umstellen. Symbol-Properties tauchen in for…in und Object.keys ohnehin nicht auf; vorher aber prüfen, ob Tests VOs per toEqual vergleichen, denn dort zählen aufzählbare Symbole mit. Wer die Nicht-Aufzählbarkeit braucht, bekommt sie über eine pro Descriptor erzeugte Klasse, deren Konstruktor die beiden Felder setzt. Optional eine Freiliste freigegebener VO-Objekte im Pool führen.

**PERF-022 · low · packages/twopoint5d/src/vertex-objects/createIndicesArray.ts:17** — expectDefined-Meldungen in Schleifen und im Frame-Pfad nicht eager bauen
Weitere Fundstelle: `packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts:98`.
createIndicesArray() ruft für jedes einzelne Element expectDefined(indices[j], `index ${j}`) auf. Das Template-Literal wird bei jedem Aufruf gebaut, auch wenn der Wert vorhanden ist, obwohl j < itemCount ihn ohnehin garantiert. Ein Pool mit capacity 100 000 Quads und 6 Indizes kostet damit beim Bau der Geometrie 600 000 String-Allokationen (VOBufferGeometry-/InstancedVOBufferGeometry-Konstruktor → initializeRoute() → createIndicesArray()).
Beleg: `arr[i * itemCount + j] = expectDefined(indices[j], `index ${j}`) + i * stride;`
Empfehlung: Die Assertion einmal vor der Schleife machen oder die Indizes vorab in ein lokales Uint32Array kopieren. expectDefined eine Variante mit lazy Meldung geben (`expectDefined(v, () => …)`) und sie in Schleifen und im Frame-Pfad verwenden.

**PERF-034 · low · packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:6** — Megamorphe Inline-Caches der geteilten Accessor-Fabriken messen und bei Bedarf pro Descriptor erzeugen *(hier nur die Messung, Umsetzung in Paket 3)*
Weitere Fundstellen: `createVertexObjectPrototype.ts:17, 80, 99`.
Alle Accessoren aller Descriptoren stammen aus denselben vier Fabrik-Funktionen. V8 teilt den Feedback-Vektor zwischen Closures desselben Funktionsliterals. Die Inline-Caches für `this[voBuffer]`, `.buffers` und `typedArray[idx]` sehen damit die VO-Maps aller Descriptoren der Anwendung (eine Map je Prototyp) und alle Typed-Array-Element-Kinds; ab fünf VO-Typen werden sie megamorph. Die Bibliothek bringt selbst schon TexturedSprite, AnimatedSprite, TileSprite und die zugehörigen Basis-Descriptoren mit. Micro-Benchmark (Node/V8, 10 000 VOs je Descriptor, getrennte Callsites je Descriptor im Aufrufer): 44,6 ns/VO bei sechs Descriptoren gegenüber 18,6 ns/VO bei einem, also ×2,4. In absoluten Zahlen sind das etwa 0,25 ms mehr pro Frame und 10 000 Sprites.
Empfehlung: Zuerst in einer realen Szene mit mehreren Sprite-Typen im DevTools-Profil prüfen. Bestätigt sich der Effekt, die Accessoren pro Descriptor als eigene Funktionsliterale erzeugen, etwa per Codegenerierung mit `new Function`, wegen CSP (`unsafe-eval`) als Opt-in. Mindestens aber den numerischen Buffer-Index aus der Empfehlung zu den Map-Lookups nutzen, der den Map-Load aus dem polymorphen Pfad nimmt.

## Urteil des Reviewers (Zug 3)

Beide Reviewer-Reports übereinstimmend:

- **TEST-001** — erfüllt: `src/testing/measureAllocatedBytes.ts:61`, drei `hot-path-allocations.spec.ts` (vertex-objects `:49`, sprites `:28`, map2d/TileSprites `:40`) im Gate über `test:coverage`, drei `hot-path.bench.ts`, Script `bench` in `packages/twopoint5d/package.json`, ungecachtes Target in `project.json`, CI-Schritte `Run the hot-path benchmarks` und `Archive benchmark results` (90 Tage) in `.github/workflows/ci.yml`. Einschränkung: `setColor()` fehlt im Sprite-Test 1 (Nebenbefund in der Queue).
- **PERF-023** — behoben: `VertexObjectBuffer.ts:118` (`bufferList`, `@internal`, per `stripInternal` nicht in `dist/`), `:256` Aufbau, `:678` `release()`, `:55` `createAttributeBuffer()` mit einer Record-Form; Accessoren per `bufferList[bufferIndex]` in `createVertexObjectPrototype.ts:20, 32, 53, 105, 131`, Index in `:151`; Regressionstests `createVertexObjectPrototype.spec.ts:337, 361, 379, 409`.
- **PERF-025** — behoben: `createVertexObject.ts:18–24`, CHANGELOG `[Unreleased]` → `Changed`.
- **PERF-022** — behoben: `createIndicesArray.ts:16/23` (`Uint32Array.from` mit einer Prüfung je Index), `GeometryAttributeSlots.ts:97` ohne `expectDefined`; Tests `createIndicesArray.spec.ts:30` ff.
- **Messung PERF-034** — erfüllt: `vertex-objects/hot-path.bench.ts`, sequenziell per `bench(...).run()`. six pools, one descriptor = 3,06 ns/VO · six pools, six descriptors = 55,09 ns/VO · Faktor 18,0. Nicht geschlossen, Umsetzung Paket 3.

Abweichungen, alle akzeptiert: modullokale Konstanten `bufferKey`/`indexKey` in `createVertexObjectPrototype.ts:10–11` (Vitests Module Runner schreibt importierte Bindings in Property-Zugriffe um, die Benches mäßen sonst den Runner; in reinem ESM wirkungslos) · Megamorphie-Bench sequenziell statt `bench.compare()` (`compare()` wärmt alle Varianten vor der ersten Messung und macht die geteilten Closures vorab megamorph; mit `compare()` 46 gegen 55 ns/VO) · `warmUpRounds: 1000` in den drei Erzeugungstests (mit 200 Ausreißer bis 219,6 B; Grenzen unverändert) · `setColor()` aus Sprite-Test 1 genommen, der Test heißt `moving, turning and re-framing a textured sprite allocates nothing per call` · Mock-Typ über `import type * as ExpectDefinedModule` (Lint-Regel `consistent-type-imports`).

Rote Läufe vor dem Fix (Implementierer-Report): `the generated accessors reach their typed array without the buffers getter` — `get buffers` 7-mal gerufen · `checks each index once, not once per object` — 6000 statt 6 Aufrufe · `createVO() allocates the vertex object and nothing else` 555,87 B · `createSprite() allocates the sprite and nothing else` 557,19 B · `createTile() and destroyTile() allocate the tile sprite and nothing else` 557,72 B (Grenze je 128). Nach dem Fix 56–61 B je Erzeugung, 0,02–0,36 B je Accessor-Aufruf.

Kleine Befunde (keine Runde):

- Commit-Betreff rund 330 Zeichen, so aus dem Detailplan übernommen.
- `.github/workflows/ci.yml:16–21`: der Bench-Schritt steht vor `Drop the Nx cache entries…` und `Save the Nx cache` (beide `if: success()`); ein abstürzender Bench kostet das Speichern des Nx-Caches. Platzierung entspricht dem Plan.
- `createVertexObjectPrototype.spec.ts:379 ff.`: `first`, `clone`, `wider` werden nicht freigegeben (ohne Pool folgenlos).
- Beobachten: die Erzeugungstests liegen bei 59–61 B gegen die Grenze 128; mit 200 Aufwärmrunden gab es Ausreißer bis 220 B. Ein roter CI-Lauf dort heißt zuerst `warmUpRounds`, nicht Grenze.

Einordnung der Nebenbefunde: `setColor()` boxt neben `setFrame()` mit getrimmtem Frame 32 B je Sprite (`TexturedSprite.ts:108` → `setColorValues`, Fixed-Setter `createVertexObjectPrototype.ts:110`), am Code von 05d723d7 gleich gemessen (8,09 B/Aufruf) → vorbestehend; die Aussage »allocate nothing per call« stand schon in 05d723d7 im `[Unreleased]`-Abschnitt. Scope-Regel greift (fehlende Absicherung des Hot Paths, Setter unter `vertex-objects/`). `VertexObjectBuffer#toAttributeArrays()` legt pro Vertex ein `subarray()` an, auch in 05d723d7 (`VertexObjectBuffer.ts:572`); Performance im Code unter `vertex-objects/`, Scope-Regel greift, kein Frame-Pfad.
