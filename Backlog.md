# Backlog — Analyse von `twopoint5d`

> Stand: 2026-05-09. Basis: vollständige Quell-Analyse von `packages/twopoint5d`, `packages/twopoint5d-testing`, `apps/lookbook`, sowie der Monorepo-Tooling-Schicht.
>
> Methodik: Sechs unabhängige Explore-Agenten haben parallel die Domänen Architektur (vertex-objects), Rendering-Pipeline (sprites/display/stage), Support-Module (texture/map2d/controls/utils), Tests, Build-System und Dokumentation erforscht. Die kritischsten Bug-Behauptungen wurden anschließend manuell anhand der Quellen verifiziert. Befunde, die sich nicht halten ließen, sind aus dem Bericht entfernt (z. B. ein gemeldeter Bug in `InputControlBase.removeEventListener` — der DOM matcht Listener nicht über `passive`, das ist kein Fehler).

---

## 1. Executive Summary

Die Library ist **architektonisch solide und konzeptionell stark** (klare Schichtung von `vertex-objects` → `sprites`/`map2d`, konsequenter Einsatz von `@spearwolf/eventize`/`@spearwolf/signalize`, ESM-only, sideEffects: false, NodeNext-konformes Source-Layout). Der größte Schwachpunkt ist nicht der Code, sondern die **Diskrepanz zwischen Implementierungstiefe und Außenwirkung**:

- **Rendering-Kerne haben keine Unit-Tests.** `sprites/` (11 Dateien) und `controls/` (4 Dateien) enthalten **null** `*.spec.ts`-Dateien. Display-Klasse mit 517 LOC wird nur über die State-Machine indirekt geprüft.
- **Browser-Tests sind aktuell de facto Smoke-Tests.** Nur 1 von 2 `.test.js`-Dateien hat realen Inhalt (`hello-twopoint5d-canvas.test.js` testet "Display existiert + frameNo > 0"); die andere ist ein Dummy (`number-or-the-beast.test.js`).
- **TSDoc-Coverage ist niedrig** (~6–8 % der Public-API mit `@param`/`@returns`). Gepaart mit der "Read the source, Luke!"-Strategie macht das Onboarding mühsam.
- **Public API hat parallele Klassen-Hierarchien** (`VertexObjectGeometry` vs. `VOBufferGeometry`, `VertexObjectPool` vs. `VOBufferPool`), die für Library-Nutzer verwirrend sind.
- **Build-Scripts haben triviale Redundanzen** (`cbt`, `test:all`, `ci` sind wortgleich) und ungenutzte Dependencies (`tsup`, `use-asset`, `ts-node` werden nirgendwo referenziert).
- **Mehrere belegbare Resource-Cleanup-Lücken** in `dispose()`-Implementierungen.

**Es gibt keine Show-Stopper, aber sehr viel niedrig hängendes Obst.** Die Backlog-Items sind in vier Prioritätsklassen sortiert: 🔴 P1 (Bug oder Risiko), 🟠 P2 (Konsistenz/Wartbarkeit), 🟡 P3 (Modernisierung), 🟢 P4 (Nice-to-have).

---

## 2. Bibliothek `packages/twopoint5d` — Architektur & Code-Qualität

### 2.1 Bestätigte Bugs / Resource-Leaks

#### ✅ ERLEDIGT — `InstancedVOBufferGeometry.dispose()` räumt extra-Pools nicht auf
**Datei:** `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`

Ursprünglicher Befund: `Map.clear()` entfernte zwar die Map-Einträge der `extraInstancedPools`, rief aber kein `clear()` auf den jeweiligen `VOBufferPool`-Instanzen auf. Zusätzlich fehlten `extraInstancedBuffers.clear()` und `extraInstancedBufferSerials.clear()`.

**Umgesetzte Lösung (über das ursprüngliche Fix-Snippet hinaus):**

`attachInstancedPool()` hat einen optionalen dritten Parameter `options?: {autoDispose?: boolean}` bekommen (Default: `true`). Damit kann der Aufrufer steuern, wem der Pool gehört:

- `autoDispose: true` (oder weggelassen) → der Pool wird beim `dispose()` der Geometry mit-aufgeräumt. Sinnvoll, wenn der Pool exklusiv zu dieser Geometry gehört (z. B. ad-hoc für ein `InstancedMesh` erzeugt).
- `autoDispose: false` → die Geometry lässt den Pool unangetastet und entfernt ihn nur aus den eigenen Bookkeeping-Maps. Sinnvoll, wenn derselbe Pool an mehrere Geometries gehängt ist (Pro-Hint des bestehenden TSDoc).

`dispose()` räumt zusätzlich `extraInstancedBuffers` und `extraInstancedBufferSerials` auf und konsumiert die interne autoDispose-Map. `detachInstancedPool()` entfernt das passende autoDispose-Tracking-Eintrag mit.

**Test-Coverage:** sieben neue Cases in `InstancedVertexObjectGeometry.spec.ts` (`describe('dispose()')`-Block) decken Default-Verhalten, explizites `true`/`false`, gemischte Flags pro Pool, Map-Cleanup und das Zusammenspiel mit `detachInstancedPool()` ab.

#### ✅ ERLEDIGT — `AnimatedSpritesMaterial.dispose()` Reihenfolge unsauber
**Datei:** `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`

Ursprünglicher Befund: `super.dispose()` lief vor dem Aufräumen des `animsMap`-Signals. Da das Parent `TexturedSpritesMaterial.dispose()` zuerst `SignalGroup.destroy(this)` aufruft, war das `#animsMap`-Signal danach bereits zerstört — die anschließenden `value?.dispose()` / `set(undefined)` / `destroy()`-Aufrufe funktionierten nur durch signalize's Lenz, dass zerstörte Signals den letzten Wert noch zurückliefern.

**Umgesetzte Lösung:** Reihenfolge umgedreht — die Texture wird disposed, das Signal auf `undefined` gesetzt und das lokale Handle zerstört, _bevor_ `super.dispose()` die SignalGroup abräumt:

```ts
override dispose(): void {
  this.#animsMap.value?.dispose();
  this.#animsMap.set(undefined);
  this.#animsMap.destroy();
  super.dispose();
}
```

**Test-Coverage:** neue `AnimatedSpritesMaterial.spec.ts` (8 Cases): Konstruktion mit/ohne `animsMap`-Option, Dispose-Verhalten (Texture-Release, No-Op ohne `animsMap`, `animsMap`-Reset auf `undefined`), explizite Order-Assertion gegen `NodeMaterial#dispose` via `sinon.calledBefore`, Signal/Effect-Leak-Check via `getSignalsCount`/`getEffectsCount`-Baseline, Idempotenz bei doppeltem Dispose.

#### ✅ ERLEDIGT — `VOBufferPool` hat keine `dispose()`-Methode
**Datei:** `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`

Ursprünglicher Befund: `pool.clear()` setzte nur `usedCount = 0`, gab aber TypedArray-Referenzen nicht aktiv frei. Bei langen Sessions mit dynamischer Pool-Erzeugung (z. B. Tile-Streaming) wuchsen Heap-Allokationen unnötig, bevor der GC sie aufnahm.

**Umgesetzte Lösung:** explizite `dispose()`-Methode auf `VOBufferPool` plus `VertexObjectPool`-Override:

- `VOBufferPool#dispose()` setzt `usedCount = 0`, nullt `buffer.typedArray` für jeden Eintrag in `pool.buffer.buffers` und leert die `buffers`-Map. Damit kann das darunterliegende `ArrayBuffer` vom GC eingesammelt werden, auch wenn downstream `THREE.BufferAttribute`s die Array-Referenz noch kurz halten.
- `VOBufferPool#isDisposed` als Getter; `dispose()` ist idempotent (mehrfache Aufrufe sind No-Ops).
- `VertexObjectPool#dispose()` ruft zusätzlich `onDestroyVO` für jeden noch lebenden VO auf, hängt mit `VOUtils.clearBuffer()` die Buffer-Referenz von jedem getrackten VO ab und leert den internen `#voIndex`. Das deckt auch VOs ab, die nach `freeVO()`-Swaps in alten Slots zurückgeblieben waren.

Bewusst nicht im Scope: `VOBufferGeometry#dispose()` ruft weiterhin `pool.clear()` (nicht `pool.dispose()`) — Pools dürfen laut "Pro-Hint" in `attachInstancedPool()` an mehrere Geometries gehängt werden, der Geometry-Lifecycle darf den Pool also nicht einseitig zerstören. Wer den Pool aktiv freigeben will, ruft `pool.dispose()` selbst auf.

**Test-Coverage:** acht neue Cases im neuen `describe('dispose()')`-Block in `VertexObjectPool.spec.ts` decken Disposed-Flag, TypedArray-Release, Idempotenz, `onDestroyVO`-Fan-out (inkl. Zusammenspiel mit `freeVO()`-Swaps), Buffer-Ref-Unlinking auf VOs und den Edge-Case "kein lebender VO" ab.

#### ✅ ERLEDIGT — `Display` braucht keinen automatischen Window-Resize-Listener
**Datei:** `packages/twopoint5d/src/display/Display.ts`

Ursprünglicher Befund: `Display.resize()` werde nie automatisch durch ein Window-Event getriggert.

**Auflösung als bewusste Design-Entscheidung:** `Display.resize()` läuft am Anfang jedes Frames innerhalb von `renderFrame()` (Display.ts:447). Damit deckt der per-Frame-Aufruf nicht nur Window-Resizes, sondern auch Container-Reflows, `devicePixelRatio`-Änderungen, `resize-to`-Attribut-Mutationen und runtime-Swaps von `resizeToElement` einheitlich ab — ohne DOM-Listener, die in `dispose()` aufgeräumt werden müssten. Re-Computations sind günstig (Hash-Vergleich kürzt No-Ops ab). Ein zusätzlicher `window.resize`-Listener wäre redundant.

**Umgesetzte Aktionen:**
- Class-Level-JSDoc auf `Display` ergänzt mit explizitem "Resize model"-Abschnitt: Resolution-Order (resize-to-Attribut → resizeToCallback → resizeToElement), Fullscreen-CSS-Toggle-Verhalten, Emission-Kontrakt von `OnDisplayResize`.
- Method-JSDoc auf `Display.resize()`, `Display.renderFrame()`, sowie auf `resizeToElement` / `resizeToCallback` / `resizeToAttributeEl` / `MaxResolution`.
- Browser-Test-Suite `packages/twopoint5d-testing/test/display-resize.test.js` mit 13 Cases auf Chromium + Firefox: HTMLElement-Host als Size-Source, `resizeToElement`-Option und Runtime-Swap, `resizeToCallback`-Override, Reaktion auf Container-Resize ohne DOM-Listener, `OnDisplayResize`-Emit-Dedup bei unverändertem Hash, `resize-to="self"` / `"window"` / CSS-Selector, Fullscreen-CSS-Class-Toggle, `pixelZoom`-Skalierung mit `pixelRatio === 1`, `MaxResolution`-Clamp, sowie Initial-Frame-Emit-Garantie.
- Dummy-Browsertest `number-or-the-beast.test.js` entfernt.

#### ✅ ERLEDIGT — `OnDisplayResize` feuerte auf dem ersten Frame doppelt
**Datei:** `packages/twopoint5d/src/display/Display.ts`

Ursprünglicher Befund (festgestellt beim Schreiben der Resize-Tests): Wenn sich die im Konstruktor gemessene Größe und die im ersten `renderFrame()` gemessene Größe unterschieden (häufig, weil zum Konstruktor-Zeitpunkt noch keine CSS-Maße angewandt sind), feuerte auf Frame 1: (1) ein Emit aus `resize()` (Hash geändert), gefolgt von (2) einem Emit aus dem `if (isFirstFrame)`-Branch in `renderFrame()`. Subscriber sahen zwei Resize-Events mit identischen Maßen.

**Umgesetzte Lösung:** Privates Flag `#didEmitResize` markiert, ob `resize()` in seinem letzten Aufruf bereits emittet hat; der First-Frame-Fallback in `renderFrame()` zündet jetzt nur noch dann, wenn `resize()` selbst nicht emittet hat. Damit gilt der Kontrakt: `OnDisplayResize` feuert auf Frame 1 garantiert genau einmal, und auf späteren Frames genau dann (genau einmal), wenn sich der Resize-Hash geändert hat. Class-JSDoc auf `Display` entsprechend präzisiert.

**Test-Coverage:** `display-resize.test.js` enthält jetzt zwei dedizierte Cases: `"emits OnDisplayResize exactly once on the first frame"` (assertet exakt `1` Emission auf Frame 1) und `"does not double-emit OnDisplayResize on the first frame when the size differs from construction"` (Regression-Schutz für genau das Szenario, das den Doppel-Emit bisher provoziert hat — Host wird nach dem Konstruktor, vor `start()`, vergrößert).

#### 🟠 P2 — `TextureResource.refCount` führt zu keinem automatischen Cleanup
**Datei:** `packages/twopoint5d/src/texture/TextureStore.ts:74, 232–234`

`refCount` wird inkrementiert/dekrementiert, aber bei `refCount === 0` wird die Resource **nicht** automatisch aus `#resources` entfernt oder disposed. Über die Laufzeit einer Single-Page-App wachsen so Texture-Caches monoton. Empfohlen:

```ts
set refCount(value: number) {
  this.#refCount = value;
  if (value === 0) this.dispose();   // oder: emit('disposable', this)
}
```

…wobei der TextureStore dann auf das `'disposable'`-Signal hört und den Eintrag aus `#resources` löscht.

#### ✅ ERLEDIGT — `CameraBasedVisibility.computeVisibleTiles()` per-Frame-Allocations
**Datei:** `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`

Ursprünglicher Befund: pro Frame entstanden `previousTiles.slice(0)`, ein neues `visitedIds`-Set, ein `next`-Stack, plus pro sichtbarem Tile ein `TileBox`, zwei `Box3` (jeweils mit zwei `Vector3` im Konstruktor), ein `Vector3` (`centerWorld`), eine `Map2DTileCoords` mit `AABB2` und ein 8-Element-Nachbar-Literal in der inneren Schleife. Zusätzlich war die Wiederverwendungs-Suche (`findIndex` + `splice`) O(n²) und die Distanz-Sortierung (`insertAndSortByDistance`) ebenfalls O(n²).

**Umgesetzte Lösung:**
- **TileBox-Pool** (`#tileBoxPool: Map<id, TileBox>`): pro Tile-Id (auch über Frames hinweg) genau ein `TileBox` mit eigenen `Box3`/`Vector3`/`Map2DTileCoords`/`AABB2`-Shells. Jeden Frame werden nur die _Inhalte_ über `Box3.min/max.set(…)`, `Vector3.set(…)`, `AABB2.set(…)` mutiert — keine Neuallokation der schweren Three.js-Objekte.
- **Cache-Invalidierung**: ändert sich `tileWidth`/`tileHeight`/`xOffset`/`yOffset` (per `Map2DTileCoordsUtil.equals()`), wird der gecachte `tile.coords`-Slot pro Pool-Eintrag verworfen — `Box3`/`Vector3`-Shells bleiben.
- **`previousTiles`-Lookup**: O(1)-`Map<id, IMap2DTileCoords>` statt O(n)-`findIndex` + O(n)-`splice` — Gesamtkosten der Klassifikation (reuse / create / remove) sinken von O(n²) auf O(n).
- **Reusable Working-Buffers** als Klassen-Felder: `#visitedIds`, `#nextStack`, `#previousTilesById`, `#scratchTranslate`/`#scratchOffset`/`#scratchCamDir`/`#scratchLineEnd`/`#scratchLineOfSight`/`#scratchPlaneIntersection`. `Set.clear()` / `length = 0` statt `new`.
- **Nachbarn-Iteration**: 8 Offsets als modul-globaler `NEIGHBOR_DX_DY`-Konstantenarray, `for`-Schleife statt `Array#forEach` — kein per-Tile-Callback-Allocation.
- **Sortierung**: einmaliges `Array#sort` mit `(a,b) => a.distanceToCamera - b.distanceToCamera` ersetzt das O(n²)-`insertAndSortByDistance` während der Traversierung.

Helper-Vertrag (`CameraBasedVisibilityHelpers` liest `tile.frustumBox`, `tile.box`, `tile.primary`) bleibt unverändert.

**Test-Coverage:** neue `CameraBasedVisibility.spec.ts` (15 Cases): undefined-on-no-camera, Visible-Tiles-Tile-Center, parallel-zur-Ebene mit/ohne `previousTiles`, Cache-Pfad bei unveränderten Deps, Klassifikation create/reuse/remove über Frames, sortierte `visibles`, Helper-Kontrakt, `tile.view`-Aufbau, `offset`/`translate`-Werte, `matrixWorld`-Translation, sowie ein Low-GC-Regressionscheck, der die Identität der gepoolten `TileBox`-, `Box3`- und `Vector3`-Instanzen zwischen non-cached Frames mit identischer Tile-Sichtbarkeit asserted.

---

### 2.2 API-Konsistenz & Wartbarkeit

#### 🟠 P2 — Doppelte Klassenhierarchie in `vertex-objects/`
**Datei:** `packages/twopoint5d/src/vertex-objects/public-api.ts`

Es werden parallel exportiert:
- `VertexObjectGeometry` (dünner Wrapper über `VOBufferGeometry` mit Typ-Narrowing)
- `VOBufferGeometry` (low-level)
- `InstancedVertexObjectGeometry` ↔ `InstancedVOBufferGeometry`
- `VertexObjectPool` ↔ `VOBufferPool`

Grep zeigt: intern (in `sprites/`, `map2d/`) wird **fast ausschließlich** die `VertexObject*`-Variante benutzt. Die `VOBuffer*`-Klassen sind faktisch Implementation-Detail, müssen aber wegen der Generic-Constraints exportiert werden. Optionen:

- Mindestens TSDoc-Banner an die `VOBuffer*`-Klassen: "Internes API. Nutze `VertexObject*` außer du weißt, was du tust."
- Oder: separate Sub-Path-Exports (`@spearwolf/twopoint5d/internals`), so dass die top-level `index.ts` nur die User-facing Variante exponiert.

#### 🟠 P2 — Asymmetrie zwischen `TexturedSprite` und `AnimatedSprite`
**Dateien:** `sprites/TexturedSprites/TexturedSprite.ts`, `sprites/AnimatedSprites/AnimatedSprite.ts`

`TexturedSprite` hat `setColor()`, `setColorValues()`, etc. — `AnimatedSprite` hat keine Color-API. Auch der Convenience-Getter/Setter `texture` existiert nur auf `TexturedSprites`, nicht auf `AnimatedSprites` (dort muss man auf das Material durchgreifen, um `animsMap` zu setzen). Entweder API harmonisieren oder im README explizit dokumentieren.

#### 🟠 P2 — `IProjection.getViewRect()` gibt anonymes Tuple zurück
**Datei:** `packages/twopoint5d/src/stage/projection/IProjection.ts:6`

`getViewRect(): [width, height, pixelRatioH, pixelRatioV]` — Tuple-Returns sind in TypeScript-IDEs schwer lesbar. Nach `{width, height, pixelRatioX, pixelRatioY}` umstellen. Breaking-Change, aber gering, da Projection-Implementierungen intern sind.

#### 🟠 P2 — `Stage2D.needsUpdate`-Semantik undokumentiert
**Datei:** `packages/twopoint5d/src/stage/Stage2D.ts:40, 142–148`

Das Flag wird intern auto-resettet, aber der User weiß das nur durch Code-Lesen. TSDoc mit Beispiel.

#### 🟢 P4 — `Display.pixelZoom` Naming
**Datei:** `packages/twopoint5d/src/display/Display.ts:65–79`

Wenn `pixelZoom > 0` wird `devicePixelRatio` ignoriert. Kontraintuitiv. Vorschlag: Umbenennen zu `pixelArtZoom` oder TSDoc-Warnung.

#### 🟢 P4 — Magic-Number `frustumBoxScale = 1.1`
**Datei:** `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:56`

Als Konstante mit Begründungs-Kommentar exponieren oder konfigurierbar machen.

---

### 2.3 Type-Safety

- `InstancedVOBufferGeometry.ts:59,89–90`: `as any`-Casts und `VertexObjectPool<any>` ohne Schema-Validation. Lösbar durch besser typisierte Overloads.
- `Dependencies.equals()` (utils/) hat undokumentierte implizite Semantik (z. B. `null == null`). Zumindest TSDoc-Beispiel.

---

### 2.4 Performance — Was bereits gut ist

Damit der Backlog nicht nur wie eine Mängelliste wirkt, hier explizit das **Solid Stuff**, das **nicht angefasst werden sollte**:

- `Display`: `eventize/retain` korrekt für `OnDisplayInit`, `OnDisplayStart`, `OnDisplayResize` (Display.ts:149–150).
- `Display.dispose()` ruft explizit `off(this)` (Display.ts:475) — Listener werden sauber abgeräumt.
- `visibilitychange`-Listener wird in `dispose()` korrekt entfernt (Display.ts:253).
- `TexturedSpritesMaterial.dispose()` nutzt `SignalGroup.destroy()` korrekt.
- `StageRenderer` (StageRenderer.ts:129–143) bindet Listener mit `once()` an `OnRemoveFromParent` — elegantes Auto-Cleanup-Pattern, sollte als Vorbild für andere Lifecycle-Code dienen.

---

## 3. Tests — Aktueller Zustand & Lücken

### 3.1 Coverage pro Modul (Vitest, `*.spec.ts`)

| Modul | Source-Dateien | Spec-Dateien | % | Bewertung |
|---|---|---|---|---|
| `vertex-objects/` | 26 | 10 | ~38 % | ✓ Gut, kritische Pfade abgedeckt |
| `map2d/` | 28 | 8 | ~29 % | ⚠️ Streaming-Logik kaum geprüft; `CameraBasedVisibility.spec.ts` (15 Cases) seit der Performance-Optimierung neu hinzugekommen |
| `texture/` | 14 | 5 | ~36 % | ✓ TextureAtlas exzellent (`TextureAtlas.spec.ts`, 230 Zeilen, randomisierte Permutationen) |
| `stage/` | 10 | 5 | ~50 % | ✓ Projection-Tests gut, `Stage2D.spec.ts` aber nur 17 Zeilen |
| `display/` | 10 | 2 | ~20 % | ⚠️ `Chronometer` + `DisplayStateMachine` als Vitest-Specs; das Resize-Verhalten der `Display`-Klasse wird seit `display-resize.test.js` (13 Cases, Browser) abgedeckt — übrige Lifecycle-Bereiche der Klasse weiterhin ungetestet |
| `utils/` | 7 | 5 | ~71 % | ✓ Sehr gut |
| **`sprites/`** | **11** | **0** | **0 %** | 🔴 **Komplett ungetestet** |
| **`controls/`** | **4** | **0** | **0 %** | 🔴 **Komplett ungetestet** |

Verifiziert via `find packages/twopoint5d/src/{sprites,controls} -name "*.spec.ts"` → keine Treffer.

### 3.2 Browser-Tests

`packages/twopoint5d-testing/test/`:
- `hello-twopoint5d-canvas.test.js`: Smoke-Test (Display + frameNo > 0).
- `number-or-the-beast.test.js`: **Dummy** (`expect(666).to.equal(666)`). Bitte löschen oder durch realen Test ersetzen.

`web-test-runner.config.js`: Playwright Chromium + Firefox, esbuild-Plugin, **2 s Timeout** — für GPU-Init zu eng. Keine Visual-Regression, keine Pixel-Asserts, keine Memory-Profiling.

### 3.3 Konkrete Test-Roadmap

#### 🔴 P1 — Sprites + Controls absichern (Sprint 1)

Diese 15 Module sind das Herz der Library und haben null Tests. Beginnen mit:

- `sprites/BaseSprite.spec.ts`: Instanziierung, Position/Scale/Rotation-Updates, `make()`-Pfade.
- `sprites/TexturedSprites/TexturedSprite.spec.ts`: Frame-Selection, `setColor*`, Texture-Atlas-Binding.
- `sprites/AnimatedSprites/AnimatedSprite.spec.ts`: Frame-Animation-Timing, Play/Pause-States.
- `sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts`: Dispose-Verhalten (verbunden mit Bug 2.1 #2).
- `controls/InputControlBase.spec.ts`: Listener-Bookkeeping, `subscribe`/`unsubscribe`-Roundtrip, idempotentes `addEventListener`.
- `controls/PanControl2D.spec.ts`: Multi-Pointer-Sequenz, Bounds-Clamping.

#### 🔴 P1 — Dispose-Tests systematisch (Sprint 1, parallel)

17 Module haben `dispose()`-Methoden, nur ~1 prüft sie. Pattern:
```ts
it('dispose() releases shared resources', () => {
  const spy = sinon.spy(somePool, 'clear');
  geometry.dispose();
  expect(spy.calledOnce).to.be.true;
});
```

#### 🟠 P2 — Browser-Tests aufwerten (Sprint 2)

- ✅ `number-or-the-beast.test.js` gelöscht.
- ✅ `display-resize.test.js` ergänzt (13 Cases, Chromium + Firefox).
- Test-Timeout auf 5–10 s erhöhen (`web-test-runner.config.js`).
- Migration zu `@playwright/test` mit nativen Screenshot-Asserts (`expect(page).toHaveScreenshot()`) für Sprite-Rendering und Animation-Frame-Verifikation.
- Memory-Smoke-Test: 100 Frames rendern, `performance.memory.usedJSHeapSize` darf nicht monoton wachsen.

#### 🟡 P3 — Tooling (Sprint 3)

- `vitest --coverage` in CI mit Threshold (initial 30 %, schrittweise auf 60 %).
- `test.each()` für Boundary-Cases (Tile-Offsets, Atlas-Indizes).

---

## 4. Dokumentation

### 4.1 Status

| Asset | Status |
|---|---|
| Root-`README.md` | ✓ Gut, motivierend, leitet zu Lookbook |
| `packages/twopoint5d/README.md` | ✓ Strukturiert mit Feature-Status (✓ stable / ⚠️ WIP) |
| `packages/twopoint5d/CHANGELOG.md` | ✓ Aktuell (Stand Feb 2026) |
| **`apps/lookbook/README.md`** | 🔴 **Unverändertes Astro-Starter-Template** |
| TSDoc auf Public-API | ⚠️ ~6–8 % mit echten `@param`/`@returns`-Annotations |
| Externe Doku-Site | 🔴 **Existiert nicht** — `.github/workflows/deploy.yml` deployt nur npm, nicht die Lookbook |
| Concept-/Tutorial-Seiten | 🔴 Kein "Hello World" für Vertex-Object-Description |

### 4.2 Lookbook Coverage-Mapping

| Modul | Lookbook-Demo | Status |
|---|---|---|
| `sprites/TexturedSprites` | `textured-sprites/` | ✓ |
| `sprites/AnimatedSprites` | `animated-sprites/`, `animated-billboards/` | ✓ |
| `vertex-objects` | `instanced-quads/`, `crosses/` | ✓ |
| `texture/` | implizit in Sprite-Demos | ⚠️ keine dedizierte TextureAtlas/TileSet-Demo |
| `map2d/` | 3 `map2d-*.ts` im Root | ⚠️ nicht gruppiert, kein eigener Ordner |
| `stage/` (Projections) | nur indirekt | 🔴 keine dedizierte Demo |
| `display/` | implizit überall | 🔴 keine dedizierte Demo |
| **`controls/`** | — | 🔴 **fehlt komplett** |

### 4.3 Konkrete Doku-Vorschläge

#### 🔴 P1 — `apps/lookbook/README.md` ersetzen
Astro-Default raus. Stattdessen: was ist Lookbook, wie navigiert man, wo findet man welche Demo (mit Tabelle wie 4.2).

#### 🟠 P2 — TSDoc auf Public-API
Minimalziel: jede Funktion/Klasse, die in einem `public-api.ts` re-exportiert wird, hat `@param`/`@returns`/`@example`. Aufwand: 5 Dateien × 5–10 min pro File ist zu optimistisch geschätzt — realistisch 1–2 Tage Fokuszeit für die Kern-Module.

#### 🟠 P2 — "Your First Sprite" Demo + Concept-Seite
Anfänger-Demo (`apps/lookbook/src/.../hello-world/`), die in 30 Zeilen Code einen einzelnen TexturedSprite zeigt — ohne `BounceSprite`-Subclass, ohne Magic Numbers. Begleitend eine Concept-Seite, die `VertexObjectDescription` erklärt.

#### 🟠 P2 — Lookbook auf GitHub Pages deployen
`.github/workflows/deploy.yml` um Astro-Build + GitHub-Pages-Publish erweitern. Onboarding-Hürde fällt drastisch, wenn `https://spearwolf.github.io/twopoint5d/` einfach existiert.

#### 🟡 P3 — `controls/`-Demo (sobald Tests existieren)
PanControl2D mit kurzer Doku.

#### 🟡 P3 — `ARCHITECTURE.md`
Modul-Dependency-Graph, Erklärung der vertex-objects-Pipeline. Dient Contributors.

---

## 5. Monorepo & Build-System

### 5.1 Root-Scripts

#### 🟠 P2 — `cbt`, `test:all`, `ci` sind wortgleich
**Datei:** `package.json:25–29` (verifiziert)

```json
"cbt": "...clean lint build checkPkgTypes test:ci",
"test:all": "...clean lint build checkPkgTypes test:ci",
"ci": "...clean lint build checkPkgTypes test:ci"
```

Auf eines reduzieren (Empfehlung: `ci`), die anderen als Aliase oder ganz weg.

#### 🟡 P3 — `NX_TUI=false` in 6+ Scripts hardcoded
Zentral in `nx.json` setzen (`tui: { enabled: false }`) statt jedes Script zu fluten.

### 5.2 Ungenutzte / fragwürdige Dependencies

Verifiziert via `grep -r "tsup\|use-asset" packages apps scripts` → **keine Treffer**.

| Dependency | Status | Empfehlung |
|---|---|---|
| `tsup` | nirgendwo importiert | entfernen |
| `use-asset` | nirgendwo importiert | entfernen |
| `ts-node` | nirgendwo benötigt (ESM-Projekt) | entfernen |
| `npm-run-all` | benutzt, aber pnpm hat natives `run-s` | optional ersetzen |
| `esbuild` | wird via `@web/dev-server-esbuild` benötigt | behalten |

### 5.3 Nx-Konfiguration

#### 🟠 P2 — `apps/lookbook` hat keine Nx-Tags
**Datei:** `apps/lookbook/project.json`

Dadurch greifen `--projects=tag:twopoint5d`-Filter nicht. Mindestens `["twopoint5d"]` setzen.

#### 🟠 P2 — `packages/twopoint5d-testing/project.json` hat leere `targets`
Folge: `test`-Target nutzt nur `nx:run-script`-Default ohne explizite `inputs`/`outputs`. Caching ist suboptimal.

#### 🟡 P3 — `nx.json` `targetDefaults.build` ohne `inputs`
Aktuell sind Inputs nur in `packages/twopoint5d/project.json` definiert. Globaler Default in `nx.json` würde Wiederholung in jedem Package-Project sparen:

```json
"build": {
  "dependsOn": ["^build"],
  "inputs": [
    "{projectRoot}/src/**/*.ts",
    "!{projectRoot}/src/**/*.spec.ts",
    "sharedTsconfigs"
  ],
  "outputs": ["{projectRoot}/dist"],
  "cache": true
}
```

`test`-Default hat ebenfalls keine Outputs → Cache greift nicht.

### 5.4 GitHub Actions

#### 🟡 P3 — Kein expliziter pnpm-Store-Cache
`.github/workflows/` setzt `pnpm/action-setup@v4` mit `run_install: true`, ohne Caching-Step davor. Auf großen CI-Runs lohnt sich `actions/cache` für `~/.local/share/pnpm/store`.

### 5.5 Verwaistes Verzeichnis

#### 🟠 P2 — `apps/handbook/docs/images/` ohne `package.json`
Verifiziert: enthält nur Bilder, keine `package.json`, kein Build-Eintrag. Commit `bc361c9` ("chore: remove abandoned handbook app") hat den App-Code entfernt, aber das Asset-Verzeichnis übrig gelassen.

Optionen:
- Wenn die Bilder noch von der `apps/lookbook` referenziert werden → in `apps/lookbook/public/` umziehen.
- Sonst `git rm -r apps/handbook/`.

### 5.6 Build-Pipeline der Core-Lib

Aktuell: `tsc` → `dist/lib/` + `scripts/makePackageJson.mjs` synthetisiert das Publish-`package.json`. Funktioniert, ist aber custom. Mögliche Modernisierungen:

- 🟢 P4: `publint` und `arethetypeswrong` (letzteres ist bereits installiert) zur CI-Validierung des Publish-Artefakts.
- 🟢 P4: Erwägen, ob `tsup` (bereits als devDep installiert!) den `tsc`-Step ersetzen könnte — Vorteil: Banner, Source-Maps, evtl. dual ESM/CJS. Nachteil: würde die etablierte `tsc`-Pipeline ablösen, hoher Refactor-Aufwand. **Nicht hochpriorisiert** — der aktuelle Build funktioniert.

---

## 6. Lookbook (`apps/lookbook`)

### Architektonisch in Ordnung
Astro + React + Tailwind + lil-gui — moderne, etablierte Stacks. Index-Page mit Tag-Filter und `DemoCardsGrid` ist gut gelöst, `LookbookMetadata` und `LookBookApi` sind sinnvolle Abstractions.

### Verbesserungspotenzial
- (4.3) — siehe Doku-Sektion: README ersetzen, GitHub-Pages-Deploy, "Hello World"-Demo, Concept-Seite.
- 🟢 P4 — Magic Numbers in Beispielen (`width=300, height=150` etc.) durch benannte Konstanten oder Code-Kommentare erklären.

---

## 7. Priorisierte Roadmap

### Sprint 1 — Bug-Fixes & Test-Grundlage (≈ 1 Woche)
1. ✅ `InstancedVOBufferGeometry.dispose()` — extra-Pools korrekt aufräumen, inkl. neuer `autoDispose`-Option an `attachInstancedPool()` (§2.1).
2. ✅ `AnimatedSpritesMaterial.dispose()` — Reihenfolge korrigieren, plus 8 Unit-Tests in `AnimatedSpritesMaterial.spec.ts` (§2.1).
3. 🔴 Sprites-Test-Suite anlegen (BaseSprite, TexturedSprite, AnimatedSprite).
4. 🔴 Controls-Test-Suite anlegen (InputControlBase, PanControl2D).
5. 🔴 `apps/lookbook/README.md` ersetzen.
6. 🔴 `number-or-the-beast.test.js` löschen.

### Sprint 2 — API-Konsistenz & Dokumentation (≈ 1–2 Wochen)
7. 🟠 `TextureResource.refCount` → automatisches Cleanup.
8. ✅ `VOBufferPool.dispose()` (siehe §2.1).
9. 🟠 TSDoc auf Public-API (alle `public-api.ts`-Exports).
10. ✅ `Display.autoResize` — als bewusste Design-Entscheidung dokumentiert (per-Frame-Resize-Modell), Test-Coverage in `twopoint5d-testing` (siehe §2.1).
11. 🟠 `apps/handbook/`-Aufräumung.
12. 🟠 Build-Scripts deduplizieren (`cbt`/`test:all`/`ci`), ungenutzte Deps raus.
13. 🟠 Nx-Tags für `lookbook`, Targets für `twopoint5d-testing`.
14. 🟠 Browser-Tests: Timeout hochsetzen, erste Screenshot-Asserts.

### Sprint 3 — Modernisierung & Onboarding (≈ 2 Wochen)
15. 🟡 `IProjection.getViewRect()` → Object-Return (Breaking).
16. 🟡 Vitest-Coverage in CI mit Threshold.
17. 🟡 Lookbook-GitHub-Pages-Deploy.
18. 🟡 "Your First Sprite" Demo + VertexObjectDescription-Concept-Seite.
19. 🟡 `nx.json` targetDefaults erweitern (Inputs/Outputs für Caching).
20. 🟡 `NX_TUI`-Konsolidierung in `nx.json`.
21. 🟡 `controls/`-Demo in Lookbook.

### Sprint 4+ — Nice-to-have
22. 🟢 `publint`/`arethetypeswrong` in CI (`arethetypeswrong` läuft bereits via `checkPkgTypes`, müsste nur als blocking gate definiert werden).
23. 🟢 `Display.pixelZoom`-Renaming.
24. 🟢 `ARCHITECTURE.md`.
25. ✅ `CameraBasedVisibility` Per-Frame-Allocs reduzieren — TileBox-Pool, O(n)-Map-Lookup, reused Set/Stack/Vectors, Single-Sort statt O(n²)-Insert (siehe §2.1).
26. 🟢 `tsup`-Migration evaluieren (oder devDep entfernen).

---

## 8. Was nicht im Backlog ist (und warum)

- **`InputControlBase.removeEventListener` "passive-Bug"** (von einem Sub-Agenten gemeldet): geprüft — DOM `removeEventListener` matcht Listener nicht über das `passive`-Flag, nur `capture` und Function-Reference matchen. Kein Bug.
- **Kompletter Refactor vom `tsc` zu `tsup`**: technisch denkbar, aber der Status-quo funktioniert und der Aufwand wäre groß. Nur als P4-Erwägung gelistet.
- **Cross-Browser Visual-Regression mit Percy/Chromatic**: leistungsstark, aber kostenpflichtig und für ein Solo-OSS-Projekt unverhältnismäßig. Native Playwright-Screenshots reichen als erster Schritt.

---

*Bericht erstellt durch Multi-Agenten-Analyse mit nachträglicher Quellverifikation. Alle Datei-/Zeilenverweise wurden gegen die aktuelle `main`-Version (Commit `c4693d6`) abgeglichen, soweit Stichproben das zuließen.*
