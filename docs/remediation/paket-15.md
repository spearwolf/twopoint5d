# Paket 15 — vertex-objects: VertexObjectBuffer prüft eine numerische Capacity

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nebenbefund aus der Befund-Queue, Drain-Runde 1; kein Audit-Finding)
- Ziel: Der öffentliche `VertexObjectBuffer`-Konstruktor weist eine `capacity` ab, die keine nicht-negative ganze Zahl ist, und nennt sie in der Fehlermeldung.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts` (Konstruktor samt TSDoc)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.spec.ts` (neuer `describe`-Block am Ende)
  - `packages/twopoint5d/CHANGELOG.md` (zwei bestehende Sätze in `[Unreleased]` erweitern, kein neuer Eintrag)
- Vorgehen:
  1. **Regressionstests zuerst, rot sehen.** In `VertexObjectBuffer.spec.ts` als letzten Block innerhalb von `describe('VertexObjectBuffer', …)`, direkt hinter `describe('buffers data that does not fit the layout', …)`, einen neuen Block `describe('a capacity that is no integer of 0 or more', …)` anlegen. Aufbau wie der Nachbarblock:
     - `makeDescriptor` wie im Nachbarblock (`vertexCount: 2`, `pos: {components: ['x', 'y'], type: 'float32'}`, `id: {size: 1, type: 'uint32'}`).
     - `const branches = [['from a descriptor', () => makeDescriptor()], ['from a source buffer', () => new VertexObjectBuffer(makeDescriptor(), 3)]] as const;` und je Zweig ein `describe(branch, …)` mit drei Tests:
     - `test.each([1.5, NaN, -1, Infinity, -Infinity])('refuses a capacity of %s and names it', (capacity) => …)`: `const build = () => new VertexObjectBuffer(makeSource(), capacity);` — `expect(build).toThrow(RangeError)` und `expect(build).toThrow(\`VertexObjectBuffer: capacity must be a non-negative integer, got ${capacity}\`)`. Den erwarteten Text als **String** an `toThrow()` geben (Teilstring-Vergleich), nicht als RegExp — `1.5` enthält einen Punkt.
     - `test.each([1.5, NaN, -1, undefined])('refuses a buffersData.capacity of %s and names it', (capacity) => …)`: `new VertexObjectBuffer(makeSource(), {capacity, usedCount: 0, buffers: {}} as never)` — `RangeError` und der Text `` `VertexObjectBuffer: buffersData.capacity must be a non-negative integer, got ${String(capacity)}` ``.
     - `test('takes a capacity of 0', …)` (Wächter): `new VertexObjectBuffer(makeSource(), 0)` baut, `capacity` ist `0`, jedes `typedArray` in `buffers` hat die Länge `0`.
     - Lauf: `pnpm nx test twopoint5d -- src/vertex-objects/VertexObjectBuffer.spec.ts`. Erwartet vor dem Fix: alle 18 `refuses …`-Fälle rot (1.5, NaN und `undefined` bauen still, −1 und ±Infinity werfen den `RangeError` der Engine `Invalid typed array length: …` ohne den erwarteten Text), die beiden Wächter grün. Ausgabe des roten Laufs in den Report.
  2. **Konstruktor** (`VertexObjectBuffer.ts:85` ff.). Die Prüfung auf die freigegebene Quelle (`:86-91`) bleibt der erste Schritt — eine freigegebene Quelle meldet sich weiter mit ihrer eigenen Meldung, auch bei unbrauchbarer Capacity. Den Block `:93-99` (`let buffersData …; if (typeof capacityOrBuffersData === 'number') … else …`) ersetzen durch: die Capacity in eine lokale `const capacity` lösen (`typeof capacityOrBuffersData === 'number' ? capacityOrBuffersData : capacityOrBuffersData.capacity`), dann prüfen mit **derselben Regel wie `VOBufferPool`** (`VOBufferPool.ts:72`): `if (capacity < 0 || !Number.isInteger(capacity))` → `throw new RangeError(\`VertexObjectBuffer: ${name} must be a non-negative integer, got ${String(capacity)}\`)`, wobei `name` `'capacity'` ist, wenn `capacityOrBuffersData` eine Zahl ist, sonst `'buffersData.capacity'`. Erst danach `this.capacity = capacity` und `const buffersData = typeof capacityOrBuffersData === 'number' ? undefined : capacityOrBuffersData;`. Der Rest des Konstruktors (beide Zweige, `#takeOrCreateArray`, `voPrototype`) bleibt unverändert. Ein Inline-Kommentar über der Prüfung sagt, warum sie da ist, sinngemäß: dieselbe Regel, an der die Pools eine Capacity messen; ein Bruch oder `NaN` ergäbe Typed Arrays mit abgeschnittener bzw. Länge 0, und `capacity` sagte etwas, das kein Array hält.
  3. **TSDoc des Konstruktors** (`VertexObjectBuffer.ts:64-84`): den Satz `This constructor takes \`buffersData.capacity\` as given and checks it against nothing.` (`:71`) ersetzen durch `The capacity, given as a number or as \`buffersData.capacity\`, has to be an integer of 0 or more; beyond that this constructor checks it against nothing.` — die folgenden Sätze über `VOBufferPool` und `fromBuffersData()` bleiben. Unter dem bestehenden `@throws` (freigegebene Quelle) ein zweites: `@throws a \`RangeError\` that names the value when the capacity, given as a number or as \`buffersData.capacity\`, is no integer of 0 or more`.
  4. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`, Skill `updating-changelog`):
     - `### Changed`, Zeile 136 (`- the \`VOBufferPool\` and \`VertexObjectPool\` constructors throw \`Capacity must be a non-negative integer\` for a capacity, given as a number or as \`buffersData.capacity\`, that is no integer of 0 or more`) um den Buffer erweitern: `…, that is no integer of 0 or more; the \`VertexObjectBuffer\` constructor throws a \`RangeError\` for such a capacity that names the value and whether it came as \`capacity\` or as \`buffersData.capacity\``.
     - `### Migration Guide`, Abschnitt `#### Buffers data has to fit the layout it is handed to`, Zeile 1560 (`A capacity, given as a number or as \`buffersData.capacity\`, has to be an integer of 0 or more.`): den Buffer nennen, etwa `A capacity handed to \`new VertexObjectBuffer()\`, \`new VOBufferPool()\` or \`new VertexObjectPool()\`, given as a number or as \`buffersData.capacity\`, has to be an integer of 0 or more.`
     - Kein neuer Eintrag unter `### Fixed`, kein neuer Migration-Guide-Abschnitt.
  5. Zeile 1 erneut laufen lassen (grün), dann das Verify-Kommando.
- Verify: `pnpm run ci`
- Commit: `fix(vertex-objects): let the VertexObjectBuffer constructor refuse a capacity that is no integer of 0 or more and name the value and where it came from`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · Nebenbefund unverändert an `VertexObjectBuffer.ts:85`/`:93-99` (Datei seit `4e45acc` nicht angefasst, HEAD `ced8c118`), vorbestehend seit `e352b56` (`:89-93`) · Beschreibung korrigiert: `1.5`, `NaN` und `buffersData.capacity` `undefined` werfen nicht, sie bauen still (in Node gegen `dist` nachgestellt) · `buffersData.capacity` als derselbe Eingang im Paket · keine offenen Folgen im Plan, kein Queue-Eintrag mit derselben Ursache · Restplan unverändert
  - 2026-09-19 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-15.impl-1.json`
  - 2026-09-19 Zug 2: Report FERTIG · `VertexObjectBuffer.ts`, `VertexObjectBuffer.spec.ts`, `CHANGELOG.md` · roter Lauf 18 failed | 31 passed, danach 49 passed · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer (sonnet, low) — erfüllt, 0 kritisch, 0 wichtig, 3 klein · Diff `paket-15.diff`
  - 2026-09-19 Zug 4: keine Runde nötig
  - 2026-09-19 Zug 5: `pnpm run ci` exit=0 (`paket-15.verify.log`) · Commit 59d47e54

## Urteil des Reviewers

- Nebenbefund `VertexObjectBuffer.ts:85` (Capacity): behoben — Prüfung mit Pool-Regel nach der Prüfung auf freigegebene Quelle, `RangeError` mit Herkunft und Wert; TSDoc, Spec-Block und beide CHANGELOG-Sätze wie vorgegeben.
- Klein: (1) TSDoc des Konstruktors bricht in der Zeile `more; beyond that this constructor checks it against nothing. A` früh um — kosmetisch; (2) Wächter prüft zusätzlich `buffers.size > 0`, nicht vorgegeben, sinnvoll; (3) Commit-Message ohne Befund.

## Abgleich

Nachgestellt in Node gegen `packages/twopoint5d/dist/lib/vertex-objects/` (gebaut zum Stand `ced8c118`), Descriptor mit `vertexCount: 2`, `position` (float32, 3) und `color` (uint8, 4):

| Aufruf | Ergebnis heute |
| --- | --- |
| `new VertexObjectBuffer(d, 1.5)` | baut still: `capacity` 1.5, `static_uint8` mit 12 Elementen (1,5 Objekte), `static_float32` mit 9 |
| `new VertexObjectBuffer(d, NaN)` | baut still: `capacity` `NaN`, alle Arrays leer |
| `new VertexObjectBuffer(d, -1)` / `Infinity` / `-Infinity` | `RangeError: Invalid typed array length: -8` bzw. `: Infinity` aus `createTypedArray` — keine Klasse, kein Parameter |
| `new VertexObjectBuffer(d, {capacity: undefined, usedCount: 0, buffers: {}})` | baut still: `capacity` `undefined`, alle Arrays leer |
| `new VertexObjectBuffer(d, {capacity: 1.5, …, buffers: <Arrays für 1>})` | `RangeError` aus `checkBufferArray` über die Array-Länge (12 erwartet), nicht über die Capacity |
| `new VertexObjectBuffer(d, {capacity: NaN, …, buffers: <Arrays>})` | `RangeError: … takes exactly NaN elements …` |
| `new VertexObjectBuffer(srcBuffer, 1.5)` | baut still wie oben |
| `new VOBufferPool(d, 1.5 \| NaN \| Infinity \| '3')` | `Error: Capacity must be a non-negative integer` — der Pool prüft vor dem Buffer |

Der Eintrag in der Queue nannte als Ergebnis von `1.5` und `NaN` einen `RangeError: Invalid array length`; das trifft nur negative und unendliche Werte. Brüche und `NaN` erzeugen einen Buffer, dessen `capacity` keine Objektzahl ist — der schwerere Fall, und genau das Ziel des Pakets.

Alle internen Wege zum Konstruktor prüfen vorher: `VOBufferPool`-Konstruktor (`VOBufferPool.ts:72`), `VertexObjectPool#resize()` (`VertexObjectPool.ts:54`), `clone()` reicht die Capacity eines bereits gebauten Buffers weiter. Ungeprüft ist nur der öffentliche Aufruf von außen (`VertexObjectBuffer` wird über `vertex-objects/public-api.ts:7` exportiert) und die Zuweisung `pool.buffer = new VertexObjectBuffer(…)`, die der Browsertest `vertex-objects-buffers-data.test.js:79` mit gültigen Daten aus `toBuffersData()` nutzt.

## Entscheidungen in Zug 0

- **`buffersData.capacity` gehört ins Paket.** Die Capacity kommt auf zwei Wegen in denselben Konstruktor und landet im selben Feld; der Titel sagt »numerische Capacity«, aber `{capacity: undefined}` oder `{capacity: 1.5}` ist derselbe ungeprüfte Wert. Die Pools prüfen beide Wege mit einer Regel (CHANGELOG `[Unreleased]`, Zeile 136: »given as a number or as `buffersData.capacity`«), der Buffer tut es danach auch.
- **Regel wie im Pool, Fehlertyp `RangeError` mit Wert.** Die Regel ist wörtlich die des Pools (`capacity < 0 || !Number.isInteger(capacity)`), damit Pool und Buffer dieselben Capacities annehmen. Der Typ ist `RangeError`, weil derselbe Konstruktor eine unpassende Array-Länge schon als `RangeError` meldet (`checkBufferArray`) und `VOBufferPool#usedCount` für `NaN`/Brüche ebenso wirft; der Text folgt dem Präfix der beiden anderen Meldungen des Konstruktors (`VertexObjectBuffer: …`) und nennt den Wert, wie das Ziel verlangt.
- **Die Meldung des Pools bleibt, wie sie ist.** `Capacity must be a non-negative integer` (ohne Wert, als `Error`) steht in zwei Pool-Konstruktoren, in `resize()`, in Specs und im CHANGELOG. Sie anzugleichen wäre Konsistenzpflege ohne Defekt und nicht das Ziel dieses Pakets; ein Aufrufer über den Pool sieht die Meldung des Buffers nie, weil der Pool vorher prüft.
- **Obergrenze nicht geprüft.** Eine ganze Zahl, deren Arrays der Speicher nicht hergibt (`2 ** 40`), wirft weiter den `RangeError` der Engine (`Array buffer allocation failed`) — wie im Pool; das ist Umgebung, keine ungültige Eingabe.
- **CHANGELOG: bestehende Sätze erweitern, kein neuer Eintrag.** Das Abweisen von Capacities ist in `[Unreleased]` neu (0.21.2 kannte es nicht) und steht dort unter `### Changed`; ein zweiter Eintrag unter `### Fixed` beschriebe dieselbe Regel zweimal. Der Migration Guide trägt den Satz zur Capacity schon im Abschnitt, der `new VertexObjectBuffer(source, buffersData)` nennt — er wird um den Konstruktor ergänzt, damit er für den Buffer nicht nur zu gelten scheint.
- **Kein Browsertest.** Die Änderung weist Eingaben ab, bevor ein Typed Array entsteht; für jede angenommene Capacity sind die Arrays bytegleich, nichts erreicht die GPU anders. Der bestehende Browsertest `vertex-objects-buffers-data.test.js` baut mit gültiger Capacity und muss grün bleiben (läuft im Gate).
- **Modell mittlere Stufe, Effort low.** Werte, Meldungstext, Stelle und Testnamen stehen hier; es bleibt Transkription samt rotem Lauf, und `low` hält den Implementierer davon ab, die Pool-Meldungen gleich mit »aufzuräumen«.

## Findings im Volltext

Kein Audit-Finding. Der Nebenbefund aus »Offene Befunde« im Wortlaut:

**`packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:85`** · aus Paket 4 · low · → Scope → Paket 15 — der Konstruktor prüft eine numerische `capacity` nicht; `new VertexObjectBuffer(descriptor, 1.5)` oder `NaN` endet in `RangeError: Invalid array length` aus `createTypedArray` (Zeile 187) statt in einer benannten Meldung; der Pool prüft vorher, der öffentliche Buffer-Konstruktor nicht.

Stand Zug 0 (HEAD `ced8c118`): Fundstelle unverändert; Wirkung laut Abschnitt »Abgleich« anders als beschrieben — `1.5` und `NaN` werfen nicht, sie bauen einen Buffer mit einer `capacity`, die keine Objektzahl ist; nur negative und unendliche Werte enden im unbenannten `RangeError` der Engine.
