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

#### 🔴 P1 — `InstancedVOBufferGeometry.dispose()` räumt extra-Pools nicht auf
**Datei:** `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:122–127`

```ts
override dispose(): void {
  this.basePool?.clear();
  this.instancedPool.clear();
  this.extraInstancedPools.clear();   // ← löscht nur die Map-Einträge,
  super.dispose();                    //    ohne pool.clear() je Pool
}
```

`Map.clear()` entfernt die Map-Einträge, ruft aber kein `clear()` auf den jeweiligen `VOBufferPool`-Instanzen auf. Bei mehrfach erzeugten Geometries mit `attachInstancedPool()` bleiben gehaltene TypedArrays über die three.js-Refs lebendig, bis der GC sie aufnimmt. Begleitend fehlt `extraInstancedBuffers.clear()` und `extraInstancedBufferSerials.clear()`.

**Fix:**
```ts
override dispose(): void {
  this.basePool?.clear();
  this.instancedPool.clear();
  for (const pool of this.extraInstancedPools.values()) pool.clear();
  this.extraInstancedPools.clear();
  this.extraInstancedBuffers.clear();
  this.extraInstancedBufferSerials.clear();
  super.dispose();
}
```

#### 🔴 P1 — `AnimatedSpritesMaterial.dispose()` Reihenfolge unsauber
**Datei:** `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:70–75`

```ts
override dispose(): void {
  super.dispose();              // ← Parent zerstört evtl. SignalGroup(this)
  this.#animsMap.value?.dispose();
  this.#animsMap.set(undefined);
  this.#animsMap.destroy();     // ← könnte auf zerstörter Group laufen
}
```

Die `super.dispose()`-Implementierung in `TexturedSpritesMaterial` ruft `SignalGroup.destroy(this)` auf — danach ist es Glück, dass `#animsMap` noch ein gültiges Signal-Handle hat. Reihenfolge umdrehen:

```ts
override dispose(): void {
  this.#animsMap.value?.dispose();
  this.#animsMap.set(undefined);
  this.#animsMap.destroy();
  super.dispose();
}
```

#### 🟠 P2 — `VOBufferPool` hat keine `dispose()`-Methode
**Datei:** `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`

`pool.clear()` setzt nur `usedCount = 0`, gibt aber TypedArrays/`BufferAttribute`-Refs nicht aktiv frei. Bei langen Sessions mit dynamischer Pool-Erzeugung (z. B. Tile-Streaming) wachsen Heap-Allokationen unnötig, bevor der GC sie aufnimmt. Empfehlung: explizite `dispose()`-Methode, die die internen `BufferAttribute.array`-Felder nullt und (falls nicht von three.js bereits getan) `BufferAttribute.dispose()` triggert.

#### 🟠 P2 — `Display` hat keinen automatischen Window-Resize-Listener
**Datei:** `packages/twopoint5d/src/display/Display.ts` (verifiziert: nur `visibilitychange` auf line 250)

`Display.resize()` ist vorhanden, wird aber nie automatisch durch ein Window-Event getriggert. In Fullscreen-/`resize-to="fullscreen"`-Setups muss der User selbst auf `window.resize` lauschen, was in der Lookbook-Konfiguration via Astro-Page funktioniert, in 0815-Anwendungen aber nicht erwartet wird. Mehrere Optionen:

- Optional-Flag `autoResize: 'window' | 'parent' | false` (default `'window'`) im Constructor, mit sauberem Cleanup in `dispose()`.
- Oder dokumentieren als bewusste Design-Entscheidung mit Beispiel-Snippet im README.

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

#### 🟡 P3 — `CameraBasedVisibility.computeVisibleTiles()` per-Frame-Allocations
**Datei:** `packages/twopoint5d/src/map2d/...` (Agent-Verweis: Zeilen 195, 232, 299–302)

Pro Frame werden `previousTiles.slice(0)`, `new Set<string>()` und `new Vector2()` erzeugt. Bei großen Maps und 60 Hz erzeugt das messbaren GC-Druck. Ein wiederverwendbares Set + zwei vorallokierte `Vector2` reduziert Allokationen ohne Architekturänderung. **Vor dem Fix verifizieren mit einem Profiler-Snapshot** — der Schaden ist nur dann real, wenn die Seite tatsächlich tausende Tiles pro Frame iteriert.

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
| `map2d/` | 28 | 7 | ~25 % | ⚠️ Streaming-Logik kaum geprüft |
| `texture/` | 14 | 5 | ~36 % | ✓ TextureAtlas exzellent (`TextureAtlas.spec.ts`, 230 Zeilen, randomisierte Permutationen) |
| `stage/` | 10 | 5 | ~50 % | ✓ Projection-Tests gut, `Stage2D.spec.ts` aber nur 17 Zeilen |
| `display/` | 10 | 2 | ~20 % | 🔴 Nur `Chronometer` und `DisplayStateMachine` — die Display-Klasse selbst ungetestet |
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

- `number-or-the-beast.test.js` löschen.
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
1. 🔴 `InstancedVOBufferGeometry.dispose()` — extra-Pools korrekt aufräumen (§2.1).
2. 🔴 `AnimatedSpritesMaterial.dispose()` — Reihenfolge korrigieren (§2.1).
3. 🔴 Sprites-Test-Suite anlegen (BaseSprite, TexturedSprite, AnimatedSprite).
4. 🔴 Controls-Test-Suite anlegen (InputControlBase, PanControl2D).
5. 🔴 `apps/lookbook/README.md` ersetzen.
6. 🔴 `number-or-the-beast.test.js` löschen.

### Sprint 2 — API-Konsistenz & Dokumentation (≈ 1–2 Wochen)
7. 🟠 `TextureResource.refCount` → automatisches Cleanup.
8. 🟠 `VOBufferPool.dispose()`.
9. 🟠 TSDoc auf Public-API (alle `public-api.ts`-Exports).
10. 🟠 `Display.autoResize`-Option (oder Doku als bewusste Entscheidung).
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
25. 🟢 `CameraBasedVisibility` Per-Frame-Allocs reduzieren (vorher Profiler-Snapshot!).
26. 🟢 `tsup`-Migration evaluieren (oder devDep entfernen).

---

## 8. Was nicht im Backlog ist (und warum)

- **`InputControlBase.removeEventListener` "passive-Bug"** (von einem Sub-Agenten gemeldet): geprüft — DOM `removeEventListener` matcht Listener nicht über das `passive`-Flag, nur `capture` und Function-Reference matchen. Kein Bug.
- **Kompletter Refactor vom `tsc` zu `tsup`**: technisch denkbar, aber der Status-quo funktioniert und der Aufwand wäre groß. Nur als P4-Erwägung gelistet.
- **Cross-Browser Visual-Regression mit Percy/Chromatic**: leistungsstark, aber kostenpflichtig und für ein Solo-OSS-Projekt unverhältnismäßig. Native Playwright-Screenshots reichen als erster Schritt.

---

*Bericht erstellt durch Multi-Agenten-Analyse mit nachträglicher Quellverifikation. Alle Datei-/Zeilenverweise wurden gegen die aktuelle `main`-Version (Commit `c4693d6`) abgeglichen, soweit Stichproben das zuließen.*
