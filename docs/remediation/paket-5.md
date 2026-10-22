# Paket 5 — Vertex-Objekte: Pool-Korrektheit und typisierte Schnittstellen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-033 (low), BUG-034 (low), API-012 (low), COMP-002 (low), READ-001 (low), READ-002 (low), API-013 (low), TYPE-002 (low)
- Ziel: `VertexObjectPool` erkennt Sortierwechsel und gibt Slots bei Fehlern zurück, die Accessor-Namen und Typed-Array-Konstruktoren kommen aus je einer Quelle, und Typen (`sortBy`-Key, `Dependencies.value()`) sagen die Wahrheit; totes `pickUpDirtyRange()` entfällt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`):
  - `src/vertex-objects/VertexObjectPool.ts`
  - `src/vertex-objects/VertexObjectBuffer.ts`
  - `src/vertex-objects/types.ts`
  - `src/vertex-objects/createTypedArray.ts`, `checkBufferArray.ts`, `alignedAttributeSize.ts`
  - neu `src/vertex-objects/vertexObjectProperties.ts` samt neuer Spec `vertexObjectProperties.spec.ts`
  - `src/vertex-objects/vertexObjectPropertyNames.ts`, `valuePropertyLayouts.ts`, `createVertexObjectPrototype.ts`
  - `src/utils/Dependencies.ts`
  - `src/sprites/FeatureSprites/FeatureSprites.ts` (nur der Cast in `sortBy()`), `src/sprites/FeatureSprites/FeatureSpritesGeometry.ts` (nur `grown()`)
  - Specs: `src/vertex-objects/VertexObjectPool.spec.ts`, `VertexObjectPool.sortBy.spec.ts`, `VertexObjectPool.adoptVOs.spec.ts`, `createTypedArray.spec.ts`, `src/utils/Dependencies.spec.ts`
  - Doku: `src/vertex-objects/README.md`, `docs/proposals/pool-sorting.md`, `docs/proposals/growing-capacity.md`, `CHANGELOG.md`
- Vorgehen: siehe Abschnitt »Vorgehen« unten, Schritte 1–9 in dieser Reihenfolge. Jeder Bugfix-Schritt beginnt mit dem Regressionstest und dessen rotem Lauf.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: refuse a sort key function that frees and creates vertex objects in one call, give the slot back when a hook of createVO() throws, let adoptVOs() hand the onCreateVO hook over, type the name key of sortBy() by the number properties of the vertex object and the value of Dependencies with null, remove pickUpDirtyRange() with the hull of the dirty ranges, and derive the accessor names and the typed array classes from one source each`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · Abgleich: alle acht bestehen — BUG-033 nach `VertexObjectPool.ts:467`/`:470` gewandert (Audit 460/463), BUG-034 nach `:285`/`:664` (Audit 278/654), API-013 nach `:445` (Audit 438); API-012, COMP-002, READ-001, READ-002, TYPE-002 unverändert an ihren Fundstellen · Folgen der Pakete 1–4: keine offen · Offene Befunde: drei Einträge, keiner mit der Ursache dieses Pakets (Fence-Einrückung im Doc-Snippet-Check, Rückblick im CHANGELOG-Eintrag `Display#pixelZoom`, Zähler in `#takeOverScale()`) — bleiben liegen · aufgenommen, gleiche Ursache wie BUG-034: ein werfender `voInitialize`-Hook in `createVO()` und ein werfender `onCreateVO`-Hook beim Materialisieren durch `getVO()`/`sortBy()` · Restplan geprüft: keine Änderung
  - 2026-10-22 Zug 1: Implementierer beauftragt (sonnet, effort medium, Session cedc8d36-p5-impl-0), Brief `paket-5.impl-0.brief.md`, Report nach `paket-5.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG · 21 Dateien geändert, neu `vertexObjectProperties.ts` und `.spec.ts` · Arbeitsbaum schmutzig · Verify läuft (`paket-5.verify.log`) → exit=0 (`pnpm run ci`)
  - 2026-10-22 Zug 3: Reviewer beauftragt (opus, effort medium, Session cedc8d36-p5-review-0), Diff `paket-5.diff` (2231 Zeilen, 23 Dateien)
  - 2026-10-22 Zug 3 Urteil (`paket-5.review-0.json`): alle acht behoben · wichtig 1 (Rückblick im Migration Guide, `CHANGELOG.md:256`, `:293`) · klein 2 (`VertexObjectPool.ts:448–449` Umbruch, `pool-sorting.md:87–88` Satzbau)
  - 2026-10-22 Zug 4 Runde 1: offen der wichtige Befund (dazu die zwei kleinen) → derselbe Implementierer per Resume (sonnet, medium), Report nach `paket-5.impl-1.json` → FERTIG (CHANGELOG, `VertexObjectPool.ts`, `pool-sorting.md`) · Verify `pnpm run ci` exit=0 (`paket-5.verify-1.log`) · Reviewer gezielt (sonnet, medium, `paket-5.review-1.json`), Diff `paket-5.r1.diff`
  - 2026-10-22 Zug 4 Runde 1 Urteil (`paket-5.review-1.json`): wichtig und beide kleinen erledigt · neu nur ein vorbestehender kleiner (`NaN`-Zeile, → Queue) · Fortschritt: 3 von 3
  - 2026-10-22 Zug 5: Commit `0d04dce6` (23 Dateien), Verify `paket-5.verify-1.log` exit=0, Trailer `Remediation-Run: 2026-10-21` · Arbeitsbaum sauber

## Abgleich

| Finding | Fundstelle jetzt | Urteil |
| --- | --- | --- |
| BUG-033 | `src/vertex-objects/VertexObjectPool.ts:467` und `:470` — `if (this.usedCount !== n) throw keyFunctionChangedPoolError(n, this.usedCount);` | verschoben, unverändert: nur `usedCount` wird verglichen |
| BUG-034 | `VertexObjectPool.ts:285` `return this.#createVO(this.usedCount++, true);`, `:657` `vo[voInitialize]?.();`, `:664` `const hooked = this.onCreateVO(vo) ?? vo;` | verschoben, unverändert: kein `try` um die Hooks |
| API-012 | `VertexObjectPool.ts:204–267` (`adoptVOs()` samt TSDoc), `src/sprites/FeatureSprites/FeatureSpritesGeometry.ts:108` (`grown.instancedPool.onCreateVO = this.instancedPool.onCreateVO;`), `src/vertex-objects/README.md:294` | unverändert |
| COMP-002 | `src/vertex-objects/VertexObjectBuffer.ts:346–364` (`pickUpDirtyRange()`), `:48–57` (`dirtyFrom`/`dirtyTo`), `:101–102`, `:320–329` (`#markDirty()`); Leser nur `VertexObjectPool.sortBy.spec.ts:87`, `VertexObjectPool.adoptVOs.spec.ts:115` und `:240`; kein Aufrufer in `src/`, `apps/`, `packages/twopoint5d-testing/` | unverändert |
| READ-001 | `src/vertex-objects/valuePropertyLayouts.ts:23`, `createVertexObjectPrototype.ts:238–312`, `vertexObjectPropertyNames.ts:17` | unverändert: dieselben Regeln dreimal |
| READ-002 | `VertexObjectPool.ts:56–79` (`scratchViewOf()`), `createTypedArray.ts:3`, `checkBufferArray.ts:3` (`TYPED_ARRAY_NAMES`), `alignedAttributeSize.ts:3` (`BYTES_PER_ELEMENT`) | unverändert |
| API-013 | `VertexObjectPool.ts:445` `sortBy(key: string \| VOSortKey<VOType>, …)`; einziger weiterreichender Aufrufer `src/sprites/FeatureSprites/FeatureSprites.ts:430` (`key as string \| VOSortKey<Api & VO>`) | verschoben, unverändert |
| TYPE-002 | `src/utils/Dependencies.ts:213` (`value()`), `:145` (`this.#state.set(name, value)`) | unverändert; einziger Aufrufer in `src/` ist `src/map2d/RectangularVisibilityArea.ts:137`, der mit `!= null` prüft und unverändert compiliert |

## Entscheidungen dieses Pakets

- **API-012 — die Fix-Variante.** Die Empfehlung lässt »Hook übernehmen« oder »Nicht-Transfer dokumentieren« offen. Nach der Entscheidung vom 2026-10-21 (»wird das Verhalten gefixt und dokumentiert«) übernimmt `adoptVOs()` den Hook, wenn das Ziel keinen eigenen hat; die Quelle behält ihren. Kopie, nicht Umzug: `VertexObjectPool.adoptVOs.spec.ts:166` verlangt, dass ein Quell-Pool nach der Adoption mit seinem Hook weiterarbeitet. Für `FeatureSprites` ändert sich nichts — `grown()` kopierte schon, jetzt tut es `adoptVOs()`.
- **BUG-033 — Zähler statt abgeschwächter TSDoc.** Gezählt wird in `createVO()` und in `onUsedCountShrunk()`, nicht in `freeVO()`: jedes `freeVO()` senkt `usedCount` und landet dort, ebenso `clear()`, der `usedCount`-Setter, `resize()` nach unten und die Adoption, die einen Pool leert. Der Vergleich mit `usedCount` bleibt daneben stehen, denn `createFromAttributes()` und `fromBuffersData()` erhöhen `usedCount`, ohne durch `createVO()` zu gehen.
- **BUG-034 — auch `voInitialize` und der `getVO()`-Pfad.** Gleiche Ursache: ein Hook wirft, und `#createVO()` lässt seinen Zustand stehen. Ein werfender `voInitialize` hinterlässt in `createVO()` denselben gezählten Slot. Beim Materialisieren (`getVO()`, die Key-Schleife von `sortBy()`) war der Slot schon belegt; dort bleibt er belegt, verliert aber das halb gebaute Vertex-Objekt, damit der nächste `getVO()` den Hook erneut fragt, statt ein Objekt herauszugeben, für das der Hook nie durchlief.
- **COMP-002 — entfernen statt `@deprecated`.** Die Entscheidung vom 2026-10-21 zieht den Breaking Change durch (»`VertexObjectBuffer#pickUpDirtyRange()` entfällt samt Hüllen-Buchführung«); CHANGELOG mit Migrationshinweis.
- **READ-001 — Namen und Lage getrennt.** Die Empfehlung skizziert Einträge `{name, kind, bufferIndex, stride, offset}`; `bufferIndex` und `stride` hängen am Buffer, die Kollisionsprüfung des Descriptors läuft aber vor jedem Buffer. Darum liefert die eine Quelle Name, Art und die Lage *innerhalb des Attributs* (`vertexIndex`, `componentIndex`), und die Lage im Buffer rechnet eine kleine zweite Funktion aus — dieselbe für Prototyp und `valuePropertyLayouts()`.
- **READ-002 — Zugriff über eine Funktion.** Statt `TYPED_ARRAY_OF[type]` direkt zu indizieren, geht jeder Zugriff über `typedArrayOf(dataType)`: `Float16Array` wird über `globalThis` gelesen, damit eine Laufzeit ohne `Float16Array` das Modul weiter lädt (heute fällt dort nur ein float16-Buffer), und ein Name wie `'constructor'` darf nicht über `Object.prototype` einen Konstruktor finden.
- **API-013 — `unknown` lässt jeden String zu.** `NumericKeys<unknown>` wäre `never`; ein Pool ohne Vertex-Objekt-Typ (`new VertexObjectPool(description, n)`) könnte dann gar nicht mehr nach Namen sortieren. Der neue Typ gibt für `unknown` (und `any`) `string`, die Laufzeitprüfung bleibt für beide Fälle.
- **TYPE-002 — Typ erweitern, nicht `null` umschreiben.** Entscheidung vom 2026-10-21: »`Dependencies.value()` nennt `null`«.

## Vorgehen

Vor der ersten Änderung `AGENTS.md` im Repo-Root lesen, für den CHANGELOG den Skill `updating-changelog`. Alle Pfade relativ zu `packages/twopoint5d/`. Ein Spec-Lauf einer Datei: `pnpm nx test twopoint5d -- src/<pfad>.spec.ts`; die Typprüfung der Bibliothek samt Specs: `pnpm nx typecheck twopoint5d`. Bei den reinen Typ-Fixes (Schritte 5 und 6) ist der rote Lauf die Typprüfung, nicht Vitest.

### Schritt 1 — BUG-033: `sortBy()` erkennt Freigeben und Erzeugen im selben Key-Aufruf

1. **Regressionstest zuerst**, in `src/vertex-objects/VertexObjectPool.sortBy.spec.ts`, `describe('by a key function')`, neben `refuses a key function that creates or frees vertex objects, and the sort moves nothing` (`:198`):
   - `refuses a key function that frees a vertex object and creates another, which leaves usedCount where it was` — `makeThings([10, 9, 8, 7])`; die Key-Funktion macht beim ersten Aufruf (`thing === things[0]`) `pool.freeVO(things[1]!)` und `pool.createVO()!.y = -100` und gibt `thing.y` zurück. Erwartet: `toThrow('VertexObjectPool#sortBy(): the key function created and freed vertex objects of this pool, which left usedCount at 4')`, danach die y-Werte in Slot-Reihenfolge `Array.from({length: pool.usedCount}, (_, i) => pool.getVO(i)!.y)` gleich `[10, 7, 8, -100]` — das, was die Key-Funktion hinterließ, unsortiert. Rot vor dem Fix: kein Wurf, Reihenfolge `[-100, 8, 7, 10]`.
   - `refuses a key function that empties the pool and fills it to the same count again` — `const pool = new VertexObjectPool<Thing>(thingDescription, 4); const position = [0, 2, 0, 1, 1, 0, 2, 0, 0]; pool.createFromAttributes({position});` (drei Slots ohne Vertex-Objekt, wie der Test bei `:213`); die Key-Funktion liest beim ersten Aufruf zuerst `const y = thing.y;` — nach `clear()` hat das Objekt keinen Buffer mehr —, ruft dann `pool.clear()` und `pool.createFromAttributes({position})` und gibt `y` zurück. Erwartet derselbe Wurf mit `which left usedCount at 3`. Rot vor dem Fix: kein Wurf.
2. In `VertexObjectPool` ein privates Feld `#slotChanges = 0`, bei den anderen Feldern (nach `#adoptedBy`), mit Kommentar: es steigt, wenn `createVO()` einen Slot ausgibt und wenn `usedCount` sinkt; `sortBy()` hält es über die Key-Funktion fest, die weder erzeugen noch freigeben darf, und ein Freigeben mit anschließendem Erzeugen lässt `usedCount` stehen.
3. `createVO()`: `this.#slotChanges++;` direkt vor `return this.#createVO(this.usedCount++, true);`.
4. `onUsedCountShrunk(from, to)`: `this.#slotChanges++;` als erste Anweisung.
5. `sortBy()`, Zweig der Key-Funktion: vor der Schleife `const changes = this.#slotChanges;`. Beide Prüfungen (vor jedem Slot und nach der Schleife) werden zu `if (this.usedCount !== n || this.#slotChanges !== changes) throw keyFunctionChangedPoolError(n, this.usedCount);`. Der Kommentar vor der Prüfung in der Schleife bleibt sinngemäß.
6. `keyFunctionChangedPoolError(from, to)`: bei `from !== to` der heutige Text unverändert (die Specs bei `:207` und `:227` prüfen ihn); bei `from === to`: `` `VertexObjectPool#sortBy(): the key function created and freed vertex objects of this pool, which left usedCount at ${from} — create and free vertex objects before or after the sort, not inside the key function` ``.
7. TSDoc von `sortBy()`, `@throws`: »when the key function creates or frees a vertex object of this pool — also when it does both and `usedCount` ends where it began —: …«, der Rest bleibt.

### Schritt 2 — BUG-034: ein werfender Hook hinterlässt kein Vertex-Objekt

1. **Regressionstests zuerst**, in `src/vertex-objects/VertexObjectPool.spec.ts`, `describe('onCreateVO')` (`:765`), jeweils mit eigenem Pool und `dispose()` am Ende:
   - `a hook that throws in createVO() gives the slot back, unlinks the vertex object and rethrows its error` — ein `createVO()` vorab; danach ein Hook, der das Objekt merkt und `new Error('no vertex object')` wirft. Erwartet: `createVO()` wirft genau dieses Error-Objekt (`toThrow(error)` bzw. Identität per `try/catch`), `usedCount` ist 1, `getVO(1)` ist `undefined`, `containsVO(gemerktes)` ist `false`. Rot vor dem Fix: `usedCount` 2.
   - `a hook that created a vertex object before it threw keeps that one` — ein `createVO()` vorab; der Hook erzeugt beim ersten Aufruf ein Begleitobjekt (Rekursion über ein Flag begrenzt) und wirft danach. Erwartet: `usedCount` 2, `containsVO(begleiter)` `true`, `getVO(1)` ist der Begleiter (`freeVO()` hat ihn in den zurückgegebenen Slot gezogen). Rot vor dem Fix: `usedCount` 3.
   - `a hook that throws after another pool adopted this one gives the slot back in that pool` — Aufbau wie `adoptingHook()` in `VertexObjectPool.adoptVOs.spec.ts:214` (Quelle mit einem Objekt bei Kapazität 2, Ziel mit Kapazität 4; der Hook setzt sich selbst auf `undefined`, lässt `target.adoptVOs(source)` laufen und wirft). Erwartet: `target.usedCount` 1, `target.getVO(1)` `undefined`, `source.usedCount` 0. Rot vor dem Fix: `target.usedCount` 2.
   - `a hook that throws in getVO() leaves the slot in use with its data, and the next getVO() builds the vertex object again` — Slot aus `createFromAttributes()`; der Hook wirft beim ersten Aufruf und zählt seine Aufrufe. Erwartet: `getVO(0)` wirft, `usedCount` bleibt 1, ein zweites `getVO(0)` liefert ein anderes Objekt als das gemerkte mit den Werten aus `createFromAttributes()`, der Hook lief zweimal, `containsVO(gemerktes)` ist `false`. Rot vor dem Fix: das zweite `getVO(0)` liefert das gemerkte Objekt, der Hook lief einmal.
   - in `describe('voInitialize')` (`:872`): `a voInitialize hook that throws in createVO() gives the slot back as well` — `vi.spyOn(Leveled.prototype, voInitialize).mockImplementation(() => { throw … })` wie in `:876`, Spy im `finally` zurücksetzen. Erwartet: `createVO()` wirft, `usedCount` unverändert. Rot vor dem Fix: `usedCount` um 1 höher.
2. Private Methode `#holder(): VertexObjectPool<VOType>` — läuft über `#adoptedBy` bis zum letzten Pool und gibt ihn zurück (»the pool that holds the vertex object the running #createVO() built: this one, or the last of the pools that adopted one another from inside its hook«). Die Schleife bei `:666–667` (`let owner … while (owner.#adoptedBy !== undefined) owner = owner.#adoptedBy;`) wird durch `const owner = this.#holder();` ersetzt.
3. In `#createVO(idx, initialize)`: der Aufruf von `vo[voInitialize]?.()` und der Aufruf von `this.onCreateVO(vo)` laufen in einem `try`. Die Reihenfolge bleibt: `voInitialize`, `this.buffer.touch(idx, idx)`, dann der Hook; der frühe Ausstieg ohne Hook (`if (this.onCreateVO == null) return vo;`) bleibt. Im `catch (error)`:
   - `initialize === true` (der Weg von `createVO()`): `this.#holder().freeVO(vo);` — `freeVO()` ist ein No-op, wenn der Hook das Objekt schon freigegeben hat, und zieht das letzte Objekt in den Slot, wenn der Hook weitere erzeugt hat.
   - `initialize === false` (Materialisieren durch `getVO()` oder `sortBy()`): `const holder = this.#holder(); const at = VOUtils.getIndex(vo); if (holder.#voIndex[at] === vo) holder.#voIndex[at] = undefined; VOUtils.clearBuffer(vo);` — der Slot bleibt mit seinen Daten in Gebrauch.
   - danach `throw error;` — dasselbe Objekt, nicht eingewickelt.
   Ein Kommentar über dem `catch` sagt in einem Satz, warum: ein Vertex-Objekt, dessen Hook warf, wurde nie ausgegeben.
4. TSDoc:
   - `onCreateVO` (`:89–99`) bekommt einen Absatz: A hook that throws — and a `voInitialize` hook that throws — leaves no vertex object behind: `createVO()` gives the slot it took back to the pool that holds the vertex object then, the way `freeVO()` does; `getVO()` leaves its slot in use with its data but without the vertex object, which the next `getVO()` builds again and hands to the hook again. The vertex object handed to the hook is unlinked from its buffer. What the hook did before it threw stands — a vertex object it created keeps its slot, which may be the one given back. The error reaches the caller as it was thrown.
   - `createVO()` und `getVO()`: je ein `@throws` mit Verweis auf `{@link onCreateVO}`.
   - `sortBy()`: »A key function that throws leaves the sort undone as well« wird zu »A key function that throws — or an `onCreateVO` hook of a slot the sort materializes — leaves the sort undone as well«.

### Schritt 3 — API-012: `adoptVOs()` reicht den Hook weiter

1. **Regressionstest zuerst**, in `src/vertex-objects/VertexObjectPool.adoptVOs.spec.ts`, `describe('the source pool afterwards')` (`:165`): `hands the onCreateVO hook of the source to a pool without one, keeps the own hook of one that has it, and the source keeps its hook` — Pool `a` mit Hook `hA` (zählt Aufrufe), frischer `b`: nach `b.adoptVOs(a)` ist `b.onCreateVO === hA` und `a.onCreateVO === hA`, ein `b.createVO()` ruft `hA`; ein frischer `c` mit eigenem Hook `hC` behält nach `c.adoptVOs(b)` `hC`. Rot vor dem Fix: `b.onCreateVO` ist `undefined`.
2. In `adoptVOs()`, nach den Bewegungen (nach `source.usedCount = 0;`, vor den beiden `#adoptedBy`-Zeilen): `this.onCreateVO ??= source.onCreateVO;` mit Kommentar: ein eigener Hook bleibt; ohne ihn ruft dieser Pool für die Vertex-Objekte, die er von nun an baut, den Hook der Quelle, und die Quelle behält ihren.
3. `src/sprites/FeatureSprites/FeatureSpritesGeometry.ts:108`: die Zeile `grown.instancedPool.onCreateVO = this.instancedPool.onCreateVO;` entfällt. Die TSDoc von `grown()` (`:88–95`, »… and the `onCreateVO` hook of the pool included«) bleibt wahr und bleibt stehen. `FeatureSprites.grow.spec.ts:216` (`the onCreateVO hook of the pool moves to the new pool`) und `:231` müssen ohne Änderung grün bleiben — das ist der Beleg, dass die Handkopie überflüssig ist.
4. TSDoc von `adoptVOs()`: nach dem ersten Absatz der Satz »The `onCreateVO` hook of `source` comes along when this pool has none of its own; one of its own stays, and `source` keeps its hook either way.« TSDoc von `onCreateVO`: ein Satz, dass `adoptVOs()` ihn an einen Pool ohne eigenen Hook weitergibt.
5. `src/vertex-objects/README.md`, »Growing a pool«: Kommentar in `:294` → `// every slot, every value, every handle, and the onCreateVO hook`; im Punkt »**What moves.**« ergänzen: the `onCreateVO` hook, when the new pool has none of its own — the old pool keeps its hook.
6. `docs/proposals/growing-capacity.md`, Statuszeile (`:3–7`, »Deviation: …«): zweite Abweichung anfügen — `VertexObjectPool#adoptVOs()` hands the `onCreateVO` hook of the source to a pool without one itself, so `FeatureSpritesGeometry#grown()` copies nothing by hand (§2, step 2; §3). »Deviation:« wird dabei zu »Deviations:« mit zwei Punkten.

### Schritt 4 — COMP-002: `pickUpDirtyRange()` und die Hülle entfallen

1. `src/vertex-objects/VertexObjectBuffer.ts`:
   - `pickUpDirtyRange()` samt TSDoc (`:336–364`) löschen.
   - aus `AttributeBuffer` die Felder `dirtyFrom` und `dirtyTo` samt TSDoc (`:48–57`) löschen, aus `createAttributeBuffer()` die beiden Schlüssel (`:101–102`); die übrigen Schlüssel behalten ihre Reihenfolge.
   - `#markDirty()`: Bedingung `if (buf.pickedUpSerial === buf.serial || buf.dirtyRangeCount === 0)`; im ersten Zweig entfallen `buf.dirtyFrom = from;` und `buf.dirtyTo = to;`, im zweiten die beiden `Math.min`/`Math.max`-Zeilen. TSDoc von `#markDirty()`: den Halbsatz »the hull around them grows to hold them« streichen.
   - TSDoc von `dirtyRangeCount`: »`0` exactly when `dirtyFrom` is `-1`« → »`0` while nothing is recorded«. TSDoc von `dirtyRanges`: der Verweis auf die Hülle fällt weg, falls einer bleibt.
   - TSDoc von `pickUpDirtyRanges()`: »Taking the ranges up counts as having caught up, the way {@link pickUpDirtyRange} does.« → »Taking the ranges up counts as having caught up: the next write starts a range of its own instead of widening these.«
2. Specs, die die Hülle lesen, rechnen sie aus den Paaren: die Paare in `dirtyRanges` sind aufsteigend sortiert und disjunkt (`uploadRanges.ts:16–17`), also ist die Hülle `[dirtyRanges[0], dirtyRanges[2 * dirtyRangeCount - 1]]` und `[-1, -1]` bei `dirtyRangeCount === 0`. Damit bleiben die erwarteten Werte der Tests unverändert:
   - `VertexObjectPool.sortBy.spec.ts:85–87` `dirtyHullOf()` — Kommentar »read through the public bookkeeping« → »the hull around the recorded ranges«.
   - `VertexObjectPool.adoptVOs.spec.ts:115` und `:240` — über einen lokalen Helfer `hullOf(record)` in dieser Spec.
3. `GeometryRoutes#syncUploads()` (`GeometryRoutes.ts:207`) nutzt `pickUpDirtyRanges()` und bleibt, wie es ist.

### Schritt 5 — API-013: der Name-Key von `sortBy()` ist typisiert

1. **Typtest zuerst**, in `src/vertex-objects/VertexObjectPool.sortBy.spec.ts`, `describe('by the name of a value property')`: `takes the names of the number properties of the vertex object type, and any name on a pool without one` —
   - `expectTypeOf<VOSortKeyName<{y: number; x0: number; label(): string; tint: string}>>().toEqualTypeOf<'y' | 'x0'>();`
   - `expectTypeOf<VOSortKeyName<unknown>>().toEqualTypeOf<string>();`
   - im Rumpf `const {pool} = makeThings([2, 1]);` und `expect(() => { // @ts-expect-error — label is a method of Thing, no number\n pool.sortBy('label'); }).toThrow('"label" is no value property');` (Kommentarform an die Datei anpassen), danach `pool.dispose()`.
   Rot vor dem Fix: `pnpm nx typecheck twopoint5d` (Typ `VOSortKeyName` fehlt, `@ts-expect-error` ungenutzt).
2. `src/vertex-objects/types.ts`, direkt nach `VOSortKey`:

   ```ts
   /**
    * The names `VertexObjectPool#sortBy()` takes as its key: every property of `VOType` whose type is
    * `number` — `'y'`, `'rotation'`, `'x0'` on a vertex object of several vertices —, and any string
    * on a pool built without a vertex object type, whose `VOType` is `unknown`. The pool checks the
    * name again when it sorts: a number property that no attribute of the description backs is
    * refused there, with the names there are.
    */
   export type VOSortKeyName<VOType> = unknown extends VOType
     ? string
     : {[K in keyof VOType]-?: VOType[K] extends number ? K : never}[keyof VOType] & string;
   ```

3. `VertexObjectPool.ts`: `sortBy(key: VOSortKeyName<VOType> | VOSortKey<VOType>, options?: VOSortOptions): boolean`, `VOSortKeyName` in den Typ-Import. Der Rumpf bleibt. Engt `typeof key === 'string'` im anderen Zweig nicht auf `VOSortKey<VOType>` ein, ist ein lokales `const keyOf = key as VOSortKey<VOType>;` in diesem Zweig mit einem Satz Kommentar die erlaubte Lösung. TSDoc, erster Punkt der Liste: der Name ist als {@link VOSortKeyName} typisiert, ein Name, der keine Zahl-Property von `VOType` ist, compiliert nicht; geprüft wird er beim Sortieren trotzdem.
4. `src/sprites/FeatureSprites/FeatureSprites.ts:430`: `return pool.sortBy(key as VOSortKeyName<Api & VO> | VOSortKey<Api & VO>, options);`, `VOSortKeyName` importieren. `SpriteSortKeyName<Api>` (`:89`) und die öffentliche Signatur von `FeatureSprites#sortBy()` bleiben unverändert.
5. Specs, die mit einem `string` sortieren, mitziehen — die Laufzeitablehnung ist dort der Test, also bleibt der Aufruf und bekommt einen Cast `as VOSortKeyName<Thing>`: `VertexObjectPool.sortBy.spec.ts:145` (`pool.sortBy(name)` in der Schleife über `['depth', 'label', 'setPosition', 'position', 'tint']`), `:149` und `:452` (`'depth'`). Weitere Fundstellen meldet `pnpm nx typecheck twopoint5d`; Pools ohne Typargument (`VOType` `unknown`, z. B. `:159`) compilieren unverändert.
6. `src/vertex-objects/README.md`, »Sorting a pool«, Punkt »**The key.**«: ein Satz — the name is typed by the number properties of the vertex object type (`VOSortKeyName`), so a misspelt one does not compile; on a pool without a vertex object type any string compiles, and the sort refuses an unknown one with the names there are.
7. `docs/proposals/pool-sorting.md`, Abweichungsliste im Status (`:3–12`): ein Punkt — the name key of `VertexObjectPool#sortBy()` is typed `VOSortKeyName<VOType>`, the number properties of `VOType` and any string for `unknown`, not `string` (§2.1); a key function that frees and creates vertex objects in one call is refused with a message of its own (§2.2).

### Schritt 6 — TYPE-002: `Dependencies#value()` nennt `null`

1. **Typtest zuerst**, in `src/utils/Dependencies.spec.ts`: `value() answers null after an update that wrote null, and its type says so` — `const deps = new Dependencies<{pos: number}>(['pos']); deps.update({pos: null}); expect(deps.value('pos')).toBeNull(); expectTypeOf(deps.value('pos')).toEqualTypeOf<number | null | undefined>();` (`expectTypeOf` aus `vitest` importieren). Zur Laufzeit ist der Test schon grün; rot vor dem Fix ist `pnpm nx typecheck twopoint5d`.
2. `src/utils/Dependencies.ts:212–215`: `value<K extends keyof Shape>(key: K): Shape[K] | null | undefined { return this.#state.get(key as DependencyKey) as Shape[K] | null | undefined; }`. TSDoc: »The value the state holds for `key`: `null` after an {@link update} that wrote `null` for it, and `undefined` for as long as nothing has written one and after an `update()` that left the key out.«
3. `src/map2d/RectangularVisibilityArea.ts:137` prüft mit `!= null` und bleibt unverändert; die Specs lesen mit `!` und bleiben ebenso.

### Schritt 7 — READ-002: eine Tabelle der Typed-Array-Klassen

1. `src/vertex-objects/createTypedArray.ts`:
   - `export interface TypedArrayClass { new (length: number): TypedArray; new (buffer: ArrayBuffer): TypedArray; readonly BYTES_PER_ELEMENT: number; readonly name: string; }` mit einer TSDoc-Zeile (die Klasse eines der Arrays von `TypedArray`, wie `typedArrayOf()` sie liefert).
   - `const TYPED_ARRAY_OF: Readonly<Record<VertexAttributeDataType, TypedArrayClass | undefined>>` mit allen zehn Datentypen in der Reihenfolge von `TypedArray` in `types.ts`; der Eintrag `float16: globalThis.Float16Array` mit Kommentar: über `globalThis` gelesen, damit eine Laufzeit ohne `Float16Array` dieses Modul lädt und nur ein float16-Buffer scheitert, mit einer Meldung, die sagt warum.
   - `export function typedArrayOf(dataType: VertexAttributeDataType): TypedArrayClass` — liest den Eintrag nur über `Object.hasOwn(TYPED_ARRAY_OF, dataType)`, damit ein Name wie `'constructor'` oder `'toString'` keinen Konstruktor aus `Object.prototype` findet. Kein eigener Eintrag: `` throw new Error(`typedArrayOf(): unknown data type '${String(dataType)}'`) ``. Eintrag vorhanden, aber `undefined` — das kann nur `float16` sein —: `throw new Error("typedArrayOf(): this runtime has no Float16Array for data type 'float16'")`.
   - `createTypedArray(dataType, size)` wird zu `return new (typedArrayOf(dataType))(size);` (der `switch` entfällt).
2. `VertexObjectPool.ts`: `scratchViewOf()` (`:54–79`) entfällt; `#scratchView()` baut `new (typedArrayOf(dataType))(this.#sortScratch!)`, der Kommentar von `scratchViewOf()` (»a view of the scratch of a sort in the type of the buffer it takes a copy of, so that every value goes over as it is«) wandert an `#scratchView()`. `TypedArray`/`VertexAttributeDataType` bleiben im Import, soweit noch gebraucht.
3. `checkBufferArray.ts`: `TYPED_ARRAY_NAMES` entfällt, `const expected = typedArrayOf(dataType).name;`. Der Vergleich über den Namen statt `instanceof` bleibt samt Kommentar.
4. `alignedAttributeSize.ts`: `BYTES_PER_ELEMENT` entfällt, `const bytes = typedArrayOf(dataType).BYTES_PER_ELEMENT;`.
5. `createTypedArray.spec.ts` ergänzen (Refactoring, kein roter Lauf nötig):
   - `typedArrayOf() answers the class of every data type, with its name and its bytes per element` — die zehn Paare wie im bestehenden Test, dazu `name` und `BYTES_PER_ELEMENT`.
   - `typedArrayOf() finds no class for a name of Object.prototype` — `'constructor'` und `'toString'` (`as VertexAttributeDataType`) werfen `unknown data type`.
   - `the module loads without Float16Array, and only float16 is refused` — `vi.resetModules()`, `vi.stubGlobal('Float16Array', undefined)`, `const {typedArrayOf} = await import('./createTypedArray.js')`; `typedArrayOf('float16')` wirft `/no Float16Array/`, `typedArrayOf('float32')` ist `Float32Array`; im `finally` `vi.unstubAllGlobals()` und `vi.resetModules()`.
   Die bestehenden Tests in `createTypedArray.spec.ts` und `alignedAttributeSize.spec.ts` bleiben unverändert grün.

### Schritt 8 — READ-001: die Regeln der Accessoren aus einer Quelle

1. Neu `src/vertex-objects/vertexObjectProperties.ts`:

   ```ts
   import type {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';

   /** One property the attributes of a description give their vertex objects. */
   export interface VertexObjectProperty {
     /** The name of the property on the vertex object. */
     readonly name: string;
     /**
      * `'value'`: a getter and a setter of one number — the attribute of one value on one vertex under
      * its own name, or a component property (`x`, `x0` …). `'valuesGetter'` and `'valuesSetter'`: the
      * `get…()` and `set…()` methods of the whole attribute.
      */
     readonly kind: 'value' | 'valuesGetter' | 'valuesSetter';
     /** The attribute the property belongs to. */
     readonly attribute: VertexAttributeDescriptor;
     /** For a `'value'`: the vertex within the attribute; `0` for the attribute of one value under its own name and for the methods. */
     readonly vertexIndex: number;
     /** For a `'value'`: the component within the vertex; `0` for the attribute of one value under its own name and for the methods. */
     readonly componentIndex: number;
   }

   export function vertexObjectProperties(attributes: Iterable<VertexAttributeDescriptor>, vertexCount: number): VertexObjectProperty[];

   /** The element of a `'value'` within the slot of its vertex object, in a buffer of `itemSize` elements per vertex where its attribute starts at `attributeOffset`. */
   export function valueOffsetOf(property: VertexObjectProperty, itemSize: number, attributeOffset: number): number; // property.vertexIndex * itemSize + attributeOffset + property.componentIndex
   ```

   `vertexObjectProperties()` folgt genau den heutigen Regeln, in derselben Reihenfolge: je Attribut zuerst — bei `vertexCount === 1 && attr.size === 1` — der eigene Name als `'value'` mit `vertexIndex` 0 und `componentIndex` 0, sonst `attr.getterName` als `'valuesGetter'` und `attr.setterName` als `'valuesSetter'`, je nur wenn nicht `null`/`undefined`; danach bei `attr.hasComponents` je Komponente (`componentIndex`) und darin je Vertex (`vertexIndex` von 0 bis `vertexCount - 1`) die Komponente als `'value'` unter `` `${component}${vertexCount === 1 ? '' : vertexIndex}` ``, außer bei `vertexCount === 1 && attr.size === 1 && component === attr.name`. TSDoc der Funktion: die Regeln in zwei Sätzen, und dass Prototyp, Namensliste und `valuePropertyLayouts()` sie von hier nehmen; sie hängen allein an der Beschreibung, daher kann der Descriptor sie vor jedem Buffer prüfen.
2. `vertexObjectPropertyNames.ts`: baut die Attribut-Namen aus `vertexObjectProperties(attributes, vertexCount)` (`{name: p.name, origin: \`attribute "${p.attribute.name}"\`}`), dahinter die Funktionen aus `methods` wie heute. Aus der TSDoc entfällt »Whoever changes the rules in one of the two functions changes them in both«; sie sagt stattdessen, dass die Namen die von `vertexObjectProperties()` sind, nach denen `createVertexObjectPrototype()` seine Accessoren baut, dazu die Funktionen aus `methods`.
3. `valuePropertyLayouts.ts`: iteriert `vertexObjectProperties(descriptor.attributes.values(), vertexCount)`, nimmt nur `kind === 'value'`, Layout `{bufferIndex, stride: vertexCount * record.itemSize, offset: valueOffsetOf(p, record.itemSize, bufAttr.offset)}`; `bufAttr`, `record`, `bufferIndex` wie heute über `p.attribute.name`. Aus der TSDoc entfällt »Whoever changes the rules of the accessors in `createVertexObjectPrototype()` changes them here«; die Regeln sind die von `vertexObjectProperties()`.
4. `createVertexObjectPrototype.ts`: die Einträge kommen aus `vertexObjectProperties(descriptor.attributes.values(), descriptor.vertexCount)`; je Property `bufAttr`, `buf`, `bufferIndex` über `p.attribute.name` wie heute. `'value'` → `{enumerable: true, get: makeAttributeGetter(bufferIndex, descriptor.vertexCount * buf.itemSize, valueOffsetOf(p, buf.itemSize, bufAttr.offset)), set: makeAttributeSetter(…dieselben drei…)}` — für den eigenen Namen ist `vertexCount` 1, die Argumente sind also zahlengleich mit heute. `'valuesGetter'` und `'valuesSetter'` wie heute (`makeAttributeValuesGetter(…, attr.size, attr.name, p.name)` bzw. die Auswahl über `FIXED_SETTER_VALUES`/`WIDE_SETTER_VALUES`). Die Factories, ihre Kommentare und der `methods`-Teil bleiben unverändert; der Kommentar »a component is skipped only where it coincides …« wandert nach `vertexObjectProperties.ts`.
5. Neue Spec `src/vertex-objects/vertexObjectProperties.spec.ts`, Beschreibungen über `new VertexObjectDescriptor({…}).attributes.values()`:
   - ein Attribut eines Werts auf einem Vertex → genau `{name: 'rotation', kind: 'value', vertexIndex: 0, componentIndex: 0}`;
   - Komponenten `['x', 'y', 'z']` auf einem Vertex → `getPosition`, `setPosition`, `x`, `y`, `z` in dieser Reihenfolge, `componentIndex` 0, 1, 2;
   - Komponenten `['x', 'y']` auf vier Vertices → nach den Methoden `x0, x1, x2, x3, y0, y1, y2, y3`;
   - eine Komponente gleichen Namens wie ihr Attribut der Größe 1 auf einem Vertex erscheint einmal;
   - `getter: false` → kein `'valuesGetter'`;
   - `valueOffsetOf()` mit `itemSize` 4, `attributeOffset` 1, `vertexIndex` 2, `componentIndex` 1 → 10.
   `vertexObjectPropertyNames.spec.ts`, `valuePropertyLayouts.spec.ts`, `createVertexObjectPrototype.spec.ts` und `VertexObjectDescriptor.spec.ts` bleiben unverändert und grün — sie halten die drei abgeleiteten Listen gegen den Prototyp.

### Schritt 9 — CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`, nach dem Skill `updating-changelog`. Ein `### Removed` gibt es dort noch nicht; es kommt zwischen `### Changed` und `### Fixed`. Einträge im Stil der vorhandenen (kleingeschriebenes Verb vorn bei Added/Removed, Breaking mit `(**BREAKING**)` und »See the Migration Guide«):

- Added: `VOSortKeyName<VOType>` — the names `VertexObjectPool#sortBy()` takes as its key.
- Changed: `VertexObjectPool#sortBy()` takes as a name only a number property of `VOType` (`VOSortKeyName<VOType>`), any string on a pool without a vertex object type (**BREAKING** for TypeScript). See the Migration Guide.
- Changed: `Dependencies#value()` answers `Shape[K] | null | undefined` — `null` after an `update()` that wrote `null` (**BREAKING** for TypeScript). See the Migration Guide.
- Changed: `VertexObjectPool#adoptVOs()` hands the `onCreateVO` hook of the source to a pool without a hook of its own; the source keeps its hook.
- Removed: `VertexObjectBuffer#pickUpDirtyRange()`, and `dirtyFrom` and `dirtyTo` of `AttributeBuffer` (**BREAKING**). See the Migration Guide.
- Fixed: `VertexObjectPool#sortBy()` refuses a key function that frees a vertex object and creates another, which leaves `usedCount` where it was, as it refuses one that changes the count.
- Fixed: `VertexObjectPool#createVO()` gives its slot back when the `voInitialize` or the `onCreateVO` hook throws, and `getVO()` leaves no vertex object in its slot then; the error reaches the caller as it was thrown.

`### Migration Guide`, drei `####`-Einträge wie die vorhandenen (Satz zur Regel, dann **Before**/**After** als schlichte `ts`-Blöcke, nicht `ts check`):

- `#### A sort by a name held in a string` — `const key: string = 'y'; pool.sortBy(key);` → `const key: VOSortKeyName<Ball> = 'y'; pool.sortBy(key);`
- `#### A value of Dependencies that can be null` — `const pos: Vector2 | undefined = deps.value('pos');` → `const pos = deps.value('pos'); if (pos != null) …`
- `#### The upload range of a vertex object buffer` — `VertexObjectBuffer#pickUpDirtyRange()` and the hull `dirtyFrom`/`dirtyTo` are gone; the geometries take the ranges they upload themselves, and `serial` says whether a buffer moved on since a serial one holds. A record of `AttributeBuffer` built by hand drops the two fields.

Die Konvention »kein Rückblick« gilt auch hier: die Prosa nennt die Regel, die jetzt gilt; die Before/After-Blöcke tragen den Unterschied.

## Rückgabevertrag des Implementierers

Status, Dateien, Regressionstests (Name, Kommando, Ausgabe des roten Laufs je Bugfix-Schritt 1, 2, 3; für Schritte 5 und 6 die Ausgabe von `pnpm nx typecheck twopoint5d`), Verify, Abweichungen, Nebenbefunde, Folgen — wie in Zug 2 von `runner.md` beschrieben; der Brief nennt sie.

## Findings im Volltext

**BUG-033 · low · packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:460** (weitere Fundstelle `:463`) — Key-Funktion von `sortBy()` auch bei free+create ohne Zähleränderung erkennen
Der Wächter vergleicht nur `usedCount` vor und nach jedem Key-Aufruf. Gibt eine Key-Funktion ein VO frei und erzeugt im selben Aufruf ein neues, bleibt die Zahl gleich: Es wird nichts geworfen, obwohl die TSDoc (`@throws … when the key function creates or frees a vertex object`) und `VOSortKey` genau das zusagen. Die bereits gelesenen Keys gehören dann zu Slots, deren Inhalt `freeVO()` verschoben hat; sortiert wird nach veralteten Keys. Probe: Keys `[10, 9, 8, 7]`, Key-Funktion gibt Slot 1 frei und erzeugt ein VO mit y = -100 → Ergebnis `[-100, 8, 7, 10]`, nicht aufsteigend. Die Index-Konsistenz bleibt erhalten, falsch ist nur die Draw-Reihenfolge.
Beleg: `if (this.usedCount !== n) throw keyFunctionChangedPoolError(n, this.usedCount);`
Empfehlung: Einen privaten Mutationszähler einführen, den `#createVO(…, true)` und `freeVO()` erhöhen, und ihn statt `usedCount` vergleichen, oder die TSDoc auf das abschwächen, was der Check tatsächlich erkennt.

**BUG-034 · low · packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:654** (weitere Fundstelle `:278`) — Slot zurückgeben, wenn `onCreateVO` in `createVO()` wirft
`createVO()` zählt `usedCount++`, bevor `#createVO()` das VO registriert, `voInitialize` ausführt und den Hook ruft. Wirft der Hook, propagiert die Exception, der Slot bleibt aber gezählt, initialisiert, für den Upload markiert und im Index: Das VO wird gezeichnet, und der Aufrufer hat kein Handle, um es freizugeben (Probe: `usedCount` ist nach dem Wurf 1). Bei `FeatureSprites`, deren Hook selbst Sprites erzeugt und wachsen lässt, wird daraus ein unsichtbar belegter Slot.
Beleg: `return this.#createVO(this.usedCount++, true);` … `const hooked = this.onCreateVO(vo) ?? vo;`
Empfehlung: Den Hook-Aufruf in `try/catch` fassen und im Fehlerfall das VO per `freeVO()` an den Pool zurückgeben, der es dann hält (nach einer Adoption ist das der Adoptierer), bevor die Exception weitergeworfen wird; alternativ das Verhalten in der TSDoc von `onCreateVO` festhalten.

**API-012 · low · packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:220** — `onCreateVO` in `adoptVOs()` mitnehmen oder den Nicht-Transfer dokumentieren
`adoptVOs()` übernimmt Slots, Werte und Handles, den `onCreateVO`-Hook aber nicht. `FeatureSpritesGeometry#grown()` kopiert ihn deshalb von Hand (`grown.instancedPool.onCreateVO = this.instancedPool.onCreateVO`). Die TSDoc von `adoptVOs()` und das Wachstumsbeispiel im Modul-README (»every slot, every value, every handle«) erwähnen den Hook nicht. Wer dem README folgt und einen Hook gesetzt hat, verliert ihn beim ersten Wachstum ohne Fehlermeldung; neue VOs laufen dann ohne Hook.
Beleg: `pool.adoptVOs(old.pool); // every slot, every value, every handle` (src/vertex-objects/README.md:294)
Empfehlung: Entweder übernimmt `adoptVOs()` den Hook, wenn das Ziel keinen eigenen hat, und `FeatureSpritesGeometry#grown()` verzichtet auf die Handkopie. Oder TSDoc und README sagen ausdrücklich, dass der Hook beim Quell-Pool bleibt und vom Aufrufer zu übertragen ist.

**COMP-002 · low · packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:346** (weitere Fundstelle `:328`) — Ungenutztes `VertexObjectBuffer#pickUpDirtyRange()` samt Hüllen-Buchführung entfernen
Seit `GeometryRoutes#syncUploads()` mit `pickUpDirtyRanges()` (Plural) arbeitet, ruft im Repo niemand mehr die Einzahl-Variante auf. Sie ist trotzdem öffentlich und hat einen Seiteneffekt: Sie setzt `pickedUpSerial` und gilt damit als »abgeholt«, sodass der nächste Write einen neuen Bereich beginnt und jede Route ohne diesen Stand auf einen vollen Upload zurückfällt. `dirtyFrom`/`dirtyTo` werden in `#markDirty()` bei jedem Write mitgepflegt, gelesen aber nur von dieser Methode und von Specs.
Beleg: `pickUpDirtyRange(bufferName: string, seenSerial: number | undefined, usedCount: number): {from: number; to: number} | null {`
Empfehlung: Die Methode als `@deprecated` markieren und im nächsten Major entfernen. Danach `dirtyFrom`/`dirtyTo` aus `AttributeBuffer` streichen oder als reine Diagnosewerte kennzeichnen, und die Specs auf `dirtyRanges`/`dirtyRangeCount` umstellen.

**READ-001 · low · packages/twopoint5d/src/vertex-objects/valuePropertyLayouts.ts:23** (weitere Fundstellen `createVertexObjectPrototype.ts:238`, `vertexObjectPropertyNames.ts:17`) — Namensregeln der generierten Accessoren aus einer Quelle ableiten
Welche Property ein Attribut am VO erzeugt (eigener Name bei vertexCount 1 und size 1, `get…`/`set…` sonst, Komponenten mit Vertex-Suffix, Ausnahme bei gleichem Komponenten- und Attributnamen), steht inzwischen dreimal: im Prototyp-Bau, in der Namensliste für die Kollisionsprüfung und neu in den Layouts für `sortBy()`. Die Kommentare verlangen, alle drei gemeinsam zu ändern; abgesichert ist das nur durch Specs.
Empfehlung: Eine Funktion liefern lassen, die pro Attribut die Einträge `{name, kind, bufferIndex, stride, offset}` erzeugt, und Prototyp, Namensliste und `valuePropertyLayouts()` daraus ableiten. Die Kollisionsprüfung im Descriptor braucht dafür nur die Namen, nicht den Buffer.

**READ-002 · low · packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:56** (weitere Fundstellen `createTypedArray.ts:3`, `checkBufferArray.ts:3`, `alignedAttributeSize.ts:3`) — Typed-Array-Konstruktoren je Datentyp in einer Tabelle führen
Die Zuordnung `VertexAttributeDataType` → Typed-Array-Klasse steht viermal: als Switch in `createTypedArray()`, als fast gleicher Switch in `scratchViewOf()` für die Sort-Scratch, als Namenstabelle in `checkBufferArray()` und als Bytegrößen-Tabelle in `alignedAttributeSize()`. Ein neuer Datentyp muss an allen vier Stellen nachgezogen werden.
Empfehlung: Eine Tabelle `TYPED_ARRAY_OF: Record<VertexAttributeDataType, TypedArrayConstructor>` anlegen. `createTypedArray(type, n)` wird dann zu `new TYPED_ARRAY_OF[type](n)`, `scratchViewOf()` zu `new TYPED_ARRAY_OF[type](buffer)`; Name und `BYTES_PER_ELEMENT` liest man vom Konstruktor ab.

**API-013 · low · packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:438** — Den String-Key von `VertexObjectPool#sortBy()` auf numerische Properties typisieren
`sortBy(key: string | VOSortKey<VOType>)` lässt jeden String durch; ein Tippfehler (`'Y'`, `'x'` auf einem VO mit vier Vertices, das nur `x0` … `x3` kennt) fällt erst zur Laufzeit auf. Die Fehlermeldung ist gut, der Compiler könnte aber früher helfen: `VOType` kennt die Properties.
Empfehlung: Den Parameter als `NumericKeys<VOType> | VOSortKey<VOType>` typisieren, mit `type NumericKeys<T> = {[K in keyof T]: T[K] extends number ? K : never}[keyof T] & string`. Die Laufzeitprüfung bleibt für `VOType = unknown` und für Accessoren, die das Interface nicht deklariert.

**TYPE-002 · low · packages/twopoint5d/src/utils/Dependencies.ts:213** (weitere Fundstelle `:145`) — `Dependencies.value()` den Wert `null` im Rückgabetyp nennen lassen
`update()` nimmt laut `DependencyValues` für jeden Schlüssel `Shape[K] | null` und schreibt ein `null` unverändert in den Zustand (Zeile 145). `value()` gibt ihn aber als `Shape[K] | undefined` zurück. Bei `Shape = {pos: Vector2}` liefert `value('pos')` nach `update({pos: null})` also `null` unter einem Typ, der `null` ausschließt — ein `?.` schützt, ein `!== undefined`-Check nicht.
Beleg: `value<K extends keyof Shape>(key: K): Shape[K] | undefined { return this.#state.get(key as DependencyKey) as Shape[K] | undefined; }`
Empfehlung: Rückgabetyp auf `Shape[K] | null | undefined` erweitern oder `null` beim Schreiben als `undefined` ablegen, damit Typ und Zustand übereinstimmen.

## Urteil des Reviewers

Aus `paket-5.review-0.json`, bestätigt nach Runde 1 in `paket-5.review-1.json`:

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| BUG-033 | behoben | `VertexObjectPool.ts:109` (`#slotChanges`), `:286` (`createVO()`), `:344` (`onUsedCountShrunk()`), `:471`/`:475`/`:478` (Prüfungen in `sortBy()`), `:50` (eigene Meldung bei `from === to`) |
| BUG-034 | behoben | `VertexObjectPool.ts:686–700` (`catch` in `#createVO()`), `:708` (`#holder()`), TSDoc an `onCreateVO`, `createVO()`, `getVO()` |
| API-012 | behoben | `VertexObjectPool.ts:260` (`this.onCreateVO ??= source.onCreateVO;`), Handkopie in `FeatureSpritesGeometry.ts` entfernt, README `:294`, `growing-capacity.md:3–10` |
| COMP-002 | behoben | `VertexObjectBuffer.ts`: `pickUpDirtyRange()`, `dirtyFrom`/`dirtyTo` entfernt, `#markDirty()` `:308` gegen `dirtyRangeCount === 0`; CHANGELOG `### Removed` samt Migrationseintrag |
| READ-001 | behoben | neu `vertexObjectProperties.ts`; `createVertexObjectPrototype.ts`, `valuePropertyLayouts.ts`, `vertexObjectPropertyNames.ts` leiten ab; Spec `vertexObjectProperties.spec.ts` |
| READ-002 | behoben | `createTypedArray.ts:12` (`TYPED_ARRAY_OF`), `:31` (`typedArrayOf()`, `Object.hasOwn`, `globalThis.Float16Array`); `scratchViewOf()`, `TYPED_ARRAY_NAMES`, `BYTES_PER_ELEMENT` entfernt |
| API-013 | behoben | `types.ts:309` (`VOSortKeyName`), `VertexObjectPool.ts:452`, `FeatureSprites.ts:430`; Typtest mit `@ts-expect-error` |
| TYPE-002 | behoben | `src/utils/Dependencies.ts:216` (`Shape[K] \| null \| undefined`), TSDoc `:212–215`; Typtest in `Dependencies.spec.ts` |

## Kleine Befunde

- `VertexObjectPool.ts:448–449` — `@throws`-Satz nicht umbrochen: in Runde 1 behoben.
- `docs/proposals/pool-sorting.md:87–88` — Einschub zerbrach den Satz: in Runde 1 behoben.
- `VertexObjectPool.ts:450` — `NaN`-Zeile ohne Schlusspunkt im `@throws`-Tag; vorbestehend (`920bfdac:…VertexObjectPool.ts:443`), in »Offene Befunde« → Scope.
- Anmerkung zum Implementierer-Report: `VertexObjectBuffer.ts` wurde nicht ganz gelesen, `types.ts` und `createVertexObjectPrototype.ts` nur ausschnittweise — die Nebenbefund-Suche in diesen drei Dateien ist unvollständig. Abweichungen vom Detailplan (begründet): ein dritter Hüllen-Leser in `VertexObjectPool.adoptVOs.spec.ts` (Block `from inside an onCreateVO hook`) mitgezogen; §2.1 und §2.2 in `pool-sorting.md` mitgezogen; Fehlermeldung `createTypedArray(): …` heißt jetzt `typedArrayOf(): unknown data type '…'` (kein Test prüft sie).
