# Paket 7 — Sprites und map2d

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-014 (low), RES-001 (low), CONS-006 (low), CONS-011 (low), API-007 (low), API-001 (low), RES-002 (info), COMP-002 (info), dazu gleicher Ursache wie BUG-014 `FeatureSpritesMaterial.ts:348` und `SpriteResources.ts:160` und gleicher Ursache wie CONS-006 `texture/checkTextureStoreData.ts:16` (alle vorbestehend, in Zug 0 gefunden; Schritte 1d, 1e, 2c)
- Ziel: Sprites lehnen Prototyp-Namen ab und halten Pick-Meshes nur schwach, ihre Guards liegen an einer Stelle, und map2d behandelt Visibility-Grenzen gleich, nimmt Arrays an, gibt Speicher zurück, verliert die veralteten Exporte und ist mit `stage` zusammen vollständig dokumentiert.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/sprites/defineSprite.ts`, `checkFeature.ts`, `spriteDeclarations.ts`, `SpritePicker.ts`, `passes/passFeatures.ts`, `FeatureSprites/FeatureSpritesGeometry.ts`, `FeatureSprites/SpriteResources.ts`, `FeatureSprites/FeatureSpritesMaterial.ts`
  - `packages/twopoint5d/src/texture/checkTextureStoreData.ts` (nur der Guard)
  - neu `packages/twopoint5d/src/utils/isRecord.ts`, `isRecord.spec.ts`, `isStringList.ts`, `isStringList.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts`, `TileSlotTable.ts`, `RectangularVisibilityArea.ts`, `types.ts` (`IMap2DVisibilitor`), `public-api.ts`, `chunk-quad-tree/public-api.ts`, `chunk-quad-tree/base64toUint32Arr.ts`
  - TSDoc: `packages/twopoint5d/src/map2d/AABB2.ts`, `Map2DTileCoords.ts`, `Map2D.ts`, `Map2DTileStreamer.ts`, `Map2DTileRenderer.ts`, `CameraBasedVisibility.ts`, `RectangularVisibilityArea.ts`; `packages/twopoint5d/src/stage/OrthographicProjection.ts`, `ParallaxProjection.ts`, `ProjectionPlane.ts`, `Stage2D.ts`, `StageRenderer.ts`, `ClearStage.ts`
  - Specs: `sprites/defineSprite.spec.ts`, `sprites/SpritePicker.spec.ts`, `sprites/FeatureSprites/FeatureSpritesMaterial.spec.ts`, `sprites/FeatureSprites/SpriteResources.spec.ts`, `map2d/Map2DSpatialHashGrid.spec.ts`, `map2d/TileSlotTable.spec.ts`, `map2d/RectangularVisibilityArea.spec.ts`, `map2d/tileKeys.spec.ts`, `map2d/AABB2.spec.ts` (falls ein Fall fehlt, siehe Schritt 8)
  - Doku: `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`), `packages/twopoint5d/docs/sprites.md`, `docs/map2d.md`, `docs/resource-lifecycle.md`, `docs/proposals/gpu-picking.md`
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: take usage words, attributes, methods and uniforms named like members of Object.prototype in the sprite module and refuse a texture read of such a name a feature does not declare, hold the meshes a SpritePicker drew weakly, share the guards of the sprite and texture modules, let a RectangularVisibilityArea cap its tiles, take a list in add() and remove() of a Map2DSpatialHashGrid and give its buckets back on clear(), remove the deprecated exports of map2d, and document the entry points of map2d and stage`
- Verlauf: siehe Abschnitt »Verlauf« am Ende

## Vorgehen

Reihenfolge: erst die Regressionstests der beiden Bugfixes rot sehen (1a–1e, 3a), dann
beheben. Jede Fehlermeldung unten ist der exakte String. Die Regeln aus `AGENTS.md`
(»Error and warning messages«, `#private`, `.js`-Suffix, `import type`, »Public surface«)
und die »Konventionen« im Plan gelten für jede Zeile — Kommentare, TSDoc, CHANGELOG,
Guides und Testnamen eingeschlossen. Keine Finding-ID in irgendeiner Zeile des Repos.

### 1. Namen aus `Object.prototype` (BUG-014 und gleiche Ursache)

Ein Name, den ein Aufrufer wählt — Usage-Wort, Attribut, Textur, Uniform —, wird in einem
Plain-Object nachgeschlagen oder hineingeschrieben und trifft dabei ein Member von
`Object.prototype` (`constructor`, `toString`, `valueOf`, `hasOwnProperty`, …) oder den
Setter `__proto__`. Regel nach dem Fix: Nachschlagen nur über `Object.hasOwn()`, Sammeln
in einer `Map` oder über `Object.fromEntries()` (das legt jede Taste, `__proto__`
eingeschlossen, als eigene Daten-Property an). Die öffentliche Form der Ergebnisse
bleibt ein Plain-Object.

In Tests ein Objekt mit eigener Taste `__proto__` über einen berechneten Schlüssel bauen
(`{['__proto__']: …}`) oder über `JSON.parse()` — ein Literal `{__proto__: …}` setzt den
Prototyp und prüft nichts.

**1a. `mergeUsageAliases()` (`defineSprite.ts:170-206`).** `aliases` wird eine
`Map<string, string[]>`; Zeile 202 hängt an `aliases.get(word) ?? []` an. Zurück gibt die
Funktion `Object.freeze(Object.fromEntries([...aliases].map(([word, targets]) => [word, Object.freeze(targets)])))`.
Test in `defineSprite.spec.ts`, vor dem Fix rot (`TypeError … is not iterable`):
`takes a usage word named like a member of Object.prototype, and hands it out as a word of its own`
— ein Feature mit Attribut und den Wörtern `constructor` und `toString` (je auf dieses
Attribut); erwartet: `defineSprite()` wirft nicht, `Object.hasOwn(kind.usageAliases, 'constructor')`
und `kind.usageAliases.constructor` gleich `['<attribut>']`, ebenso für `toString`. Dazu im
selben Test ein Wort `__proto__` (berechneter Schlüssel): eigenes Property der
`usageAliases`, Prototyp von `kind.usageAliases` bleibt `Object.prototype`.

**1b. Ziel eines Alias (`defineSprite.ts:195`).** `feature.attributes?.[target] == null` wird
`!Object.hasOwn(feature.attributes ?? {}, target)`. `checkFeature()` hat jeden Wert der
Attribute schon als Record geprüft, `== null` fällt damit nicht weg, sondern ist abgedeckt.
Test, vor dem Fix rot (kein Fehler): `refuses an alias to a name of Object.prototype the feature declares no attribute for`
— Wort `w` auf `toString`; erwartet `Error` mit genau
`defineSprite: feature "<name>" aliases "w" to "toString", which it does not declare`.

**1c. Attribut der Base (`defineSprite.ts:136`).** `name in base.description.attributes`
wird `Object.hasOwn(base.description.attributes, name)`. Test, vor dem Fix rot (Meldung
»… which the base "quad" holds already«): `takes an attribute named like a member of Object.prototype that the base does not hold`
— ein Feature über `QuadBase` mit einem Attribut `toString` (`{size: 1}`); erwartet:
`defineSprite()` wirft nicht, und `Object.hasOwn(kind.description.attributes, 'toString')`.
Lehnt eine spätere Regel des Vertex-Object-Layers den Namen ab, prüft der Test statt
dessen, dass die Meldung nicht die »holds already«-Meldung ist, und der Report sagt es.
Gleiche Stelle, gleiche Ursache: `const attributes: VertexAttributesType = {}` mit
`Object.assign(attributes, own)` (Zeilen 129, 164) schreibt ein Attribut `__proto__` als
Prototyp statt als Taste — `attributes` als `Object.create(null)` anlegen (die Funktion
gibt es nur an `cloneVertexObjectDescription()` weiter, das über `Object.fromEntries()`
ein Plain-Object baut). Kein eigener Test nötig, der Fall läuft im Test zu 1c mit, wenn
das Feature zusätzlich ein Attribut `__proto__` (berechneter Schlüssel) trägt und
`Object.hasOwn(kind.description.attributes, '__proto__')` gilt.

**1d. Eigene Textur im Frame-Kontext (`FeatureSprites/FeatureSpritesMaterial.ts:348`,
vorbestehend, gleiche Ursache).** `feature.textures?.[textureName] == null` wird
`!Object.hasOwn(feature.textures ?? {}, textureName)`. Test in
`FeatureSpritesMaterial.spec.ts`, vor dem Fix rot, nach dem Muster des vorhandenen Tests
für eine nicht deklarierte Textur: `refuses a read of a texture named like a member of Object.prototype that the feature does not declare`
— eine Stufe ruft die Textur `toString`; erwartet die Meldung
`FeatureSpritesMaterial: feature "<name>" reads the texture "toString", which it does not declare`
(Subjekt so, wie der vorhandene Test es zeigt — `WHERE` der Datei).

**1e. Uniform-Tabelle (`FeatureSprites/SpriteResources.ts:158-162`, vorbestehend, gleiche
Ursache).** `uniforms[name] = makeUniform(value)` auf `{}` setzt für `__proto__` den
Prototyp. Neu: Einträge sammeln und `this.uniforms = Object.freeze(Object.fromEntries(…))`;
`#uniformSizes` bleibt die `Map`. Test in `SpriteResources.spec.ts`, vor dem Fix rot:
`keeps a uniform named __proto__ as a uniform of its own` — ein Feature deklariert die
Uniform `__proto__` (berechneter Schlüssel) mit `1`; erwartet
`Object.hasOwn(resources.uniforms, '__proto__')`, `Object.getPrototypeOf(resources.uniforms) === Object.prototype`
und `resources.setUniform('__proto__', 2)` wirft nicht.

### 2. Gemeinsame Guards (CONS-006 und gleiche Ursache)

**2a. Neu `src/utils/isRecord.ts`:**

```ts
import {isObject} from './isObject.js';

/**
 * Whether `value` is an object whose fields are read by name and that is no array: what
 * `isObject()` takes, arrays excepted. A function is none.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> => isObject(value) && !Array.isArray(value);
```

**Neu `src/utils/isStringList.ts`:**

```ts
/** Whether `value` is an array whose every entry is a string; an empty array is one. */
export const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');
```

Beide nicht in `utils/public-api.ts` (intern). Je eine kleine Spec daneben
(`isRecord.spec.ts`, `isStringList.spec.ts`): Record, Array, `null`, Funktion, Primitive;
Liste aus Strings, leere Liste, gemischte Liste, Nicht-Array.

**2b. Ersetzen.** Die lokalen Kopien fallen weg, die Dateien importieren aus `utils/`:
`sprites/checkFeature.ts:8, 10`, `sprites/passes/passFeatures.ts:20, 22`,
`sprites/FeatureSprites/FeatureSpritesGeometry.ts:41`,
`sprites/FeatureSprites/SpriteResources.ts:49`. Dazu die ausgeschriebenen Kopien derselben
Regeln: `FeatureSpritesGeometry.ts:60` (`Array.isArray(names) && names.every(…)` →
`isStringList(names)`) und `spriteDeclarations.ts:28` in `declarationOf()`
(`declared == null || typeof declared !== 'object' || Array.isArray(declared)` →
`!isRecord(declared)`). Verbleibt ein Import von `isObject` ungenutzt, fällt er weg.

**2c. `texture/checkTextureStoreData.ts:16`** (`isPlainObject`, wortgleich mit `isRecord`):
die Funktion fällt weg, die Datei nimmt `isRecord` aus `utils/`. Sonst nichts an der Datei.

**2d. Uniform-Typen.** `spriteDeclarations.ts` exportiert (`@internal` im TSDoc)
`VECTOR_TYPES` und die Größenfunktion, umbenannt zu
`sizeOfUniformValue(value: SpriteUniformValue): number` — `sizeOf` heißt in
`defineSprite.ts:83` schon die Attributgröße, ein zweiter gleichnamiger Helfer liest sich
falsch. `SpriteResources.ts:76-77` (`VECTOR_TYPES`, `sizeOfValue`) fällt weg und importiert
beide; die Aufrufer in `SpriteResources.ts` (161, 171, 173, 269, 276) nehmen die neuen
Namen. Keine Meldung ändert ihren Wortlaut.

### 3. `SpritePicker` hält gezeichnete Meshes schwach (RES-001)

Entscheidung im Plan: `WeakRef` samt `FinalizationRegistry`. Heute halten zwei Pfade
das Mesh stark: `#entries` (`Map<FeatureSprites, PickEntry>`, Zeile 202) und
`entry.onDispose`, das `sprites` einfängt und am Dispose-Event der Geometrie hängt, die
der Picker über `entry.geometry`/`entry.mesh` selbst hält.

**3a. Regressionstest zuerst** (`SpritePicker.spec.ts`, mit dem vorhandenen
`makeRenderer()`), vor dem Fix rot:
`lets go of a mesh its owner dropped without dispose(), and releases its pick mesh and pick material once the mesh is collected`

- In einer inneren Funktion: Mesh bauen, einen Sprite anlegen, einmal picken (Ergebnis
  abwarten und nicht behalten), `new WeakRef(sprites)` zurückgeben. Vorher einen Spy
  `vi.spyOn(FeatureSpritesMaterial.prototype, 'dispose')` setzen und später nur Aufrufe
  zählen, deren `this.name === 'twopoint5d.SpritePicker'` ist.
- Nichts im Test darf das Mesh danach halten: kein `expect()` auf das Mesh, kein Eintrag
  im Recorder des Renderers, der es erreicht (prüfen, was `makeRenderer()` in `rendered`
  ablegt; hält es das Mesh, legt der Test dort nur ab, was er braucht).
- Dann nach dem Muster von `GridBase.spec.ts:47-62`: bis zu 10 Runden
  `await new Promise((resolve) => setTimeout(resolve, 0)); gc();`, bis `ref.deref()`
  `undefined` ist; `expect(ref.deref()).toBeUndefined()`. (Vor dem Fix bleibt es stehen.)
- Danach bis zu 20 weitere Runden `setTimeout(0)`, bis der Spy für das Pick-Material
  einmal gerufen wurde; erwartet genau 1 Aufruf. (`FinalizationRegistry` ruft frühestens
  in einem späteren Task.)
- `gc` wie in `GridBase.spec.ts` aus `globalThis` mit Fehler, wenn es fehlt.

Zwei weitere Fälle, nach dem Fix grün:
- `releases the pick material of a mesh disposed by its owner once, also after the mesh is collected`
  — Mesh picken, `sprites.dispose()`, Referenz fallen lassen, sammeln wie oben, Spy
  genau 1.
- `keeps the pick mesh of a mesh the caller still holds across a collection` — Mesh
  halten, `gc()` und ein paar Runden, zweiter Pick: kein neues Pick-Material (Spy auf den
  Konstruktor geht nicht; zähle stattdessen, dass der Dispose-Spy 0 bleibt und der zweite
  Pick denselben Treffer liefert).

**3b. Umbau in `SpritePicker.ts`.**

- `PickEntry` bekommt `readonly sprites: WeakRef<FeatureSprites>` und hält das Mesh
  sonst an keiner Stelle.
- `readonly #entries = new WeakMap<FeatureSprites, PickEntry>()` zum Nachschlagen in
  `#sync()`; dazu `readonly #live = new Set<PickEntry>()` für `dispose()` (ein `PickEntry`
  hält das Mesh nicht, also hält das Set es nicht).
- `readonly #collected = new FinalizationRegistry<PickEntry>((entry) => this.#release(entry))`.
  In `#build()`: `this.#collected.register(sprites, entry, entry)` (Held Value und
  Unregister-Token ist der Eintrag).
- `#release(entry)` statt `#release(sprites, entry)`:
  `const sprites = entry.sprites.deref();` — wenn vorhanden:
  `sprites.removeEventListener('dispose', entry.onDispose)` und, falls
  `this.#entries.get(sprites) === entry`, `this.#entries.delete(sprites)`. Dann immer:
  `entry.geometry.removeEventListener('dispose', entry.onDispose)`,
  `this.#live.delete(entry)`, `this.#collected.unregister(entry)`, Kette aus der Szene
  nehmen, `entry.mesh.dispose()`, `entry.material.dispose()` — wie heute
  (Zeilen 446-455). Ein zweiter Aufruf für denselben Eintrag darf das Pick-Material nicht
  zweimal freigeben: am Anfang `if (!this.#live.has(entry)) return;`.
- `onDispose: () => this.#release(entry)` — **die Closure darf `sprites` nicht
  einfangen.** V8 legt jede Variable, die irgendeine Closure einer Funktion liest, in den
  gemeinsamen Kontext dieser Funktion, und dann hält jede Closure aus `#build()` sie fest.
  Also liest keine Closure in `#build()` `sprites`; der Test aus 3a ist die Probe. Ein
  Kommentar an der Stelle sagt das in einem Satz.
- `#sync()` (Zeile 352): beim Neuaufbau `this.#release(entry)`. `dispose()` (Zeile 554):
  `for (const entry of [...this.#live]) this.#release(entry);`.
- Kein neuer Pfad auf dem Pick selbst: `#sync()` liest die `WeakMap` und allokiert
  nichts zusätzlich; `new WeakRef()` und `register()` laufen nur in `#build()`.

**3c. Doku desselben Commits.** Der Satz, der heute das starke Halten beschreibt, wird
überall durch die neue Regel ersetzt — kein »no longer«, kein Rückblick:

- TSDoc der Klasse (`SpritePicker.ts:191-196`) und von `pick()` (Zeile 247-248, »A mesh
  drawn once is held until it or the picker is disposed, also when no later pick lists
  it.«): Der Picker hält ein gezeichnetes Mesh schwach. Ein Mesh, das sein Besitzer ohne
  `dispose()` fallen lässt, wird gesammelt; sobald die Engine das meldet, gibt der Picker
  Pick-Mesh und Pick-Material frei — zu einem Zeitpunkt, den die Engine wählt, und bis
  dahin hält das Pick-Mesh Geometrie, Uniforms und Texturen, die es liest. Wer sie sofort
  zurück will, disposed das Mesh.
- `docs/resource-lifecycle.md:122-132`: der Absatz »What an instance builds on a borrowed
  resource goes when that resource goes.« ersetzt »Up to one of those events it holds each
  mesh … lives as long as the picker.« durch dieselbe Regel.
- `docs/sprites.md:2000-2002` (Abschnitt »Ownership« des Pickings): dieselbe Regel statt
  »Until then the picker holds the mesh, … dispose it, or the picker.«
- `docs/proposals/gpu-picking.md:109-110` (§3.1) und §5 »Refusals, ownership, disposal«,
  wo es das Halten bis zum Dispose sagt: auf die schwache Referenz und die
  `FinalizationRegistry` umstellen, ein Satz zur Closure-Falle aus 3b.

### 4. Veraltete map2d-Exporte entfernen (COMP-002)

Entscheidung im Plan: jetzt entfernen (Breaking, 0.26.0).

- `Map2DSpatialHashGrid.ts:14-18` (Typ `Map2DSpatialHashGridKeyType`) und `:77-85`
  (`static getKey()`) fallen weg, ebenso der Import von `tileKey` dort, falls er dann
  ungenutzt ist. `map2d/public-api.ts:9` exportiert nur noch `Map2DSpatialHashGrid`.
- `chunk-quad-tree/public-api.ts:14` (`base64toUint32Arr`) fällt weg. Die Datei
  `base64toUint32Arr.ts` bleibt, sie ist der Helfer von `DataIdsChunk2D`; ihr TSDoc
  verliert `@deprecated` und den Satz »It stays exported until a breaking release.« und
  sagt statt dessen, dass sie intern ist (`@internal`) und eine Unterklasse von
  `DataIdsChunk2D` über `super.prepareData(base64)` dekodiert.
- `map2d/tileKeys.spec.ts:25`: die Zeile mit `Map2DSpatialHashGrid.getKey(x, y)` fällt weg,
  dazu der Import, falls ungenutzt. `base64toUint32Arr.spec.ts` bleibt.
- Im Lookbook, in den Browser-Tests, in den Guides und in `scripts/` gibt es keine
  Verwender (Zug 0, `git grep`); `pnpm typecheck` bestätigt es.

### 5. `add()` und `remove()` nehmen eine Liste (API-007)

`Map2DSpatialHashGrid.ts:145` und `:192`. Entscheidung im Plan: die Array-Überladung.

```ts
add(renderables: readonly Renderable[]): Map2DSpatialHashGrid<Renderable>;
add(...renderables: Renderable[]): Map2DSpatialHashGrid<Renderable>;
add(...args: unknown[]): Map2DSpatialHashGrid<Renderable> {
  const renderables = listOf<Renderable>(args);
  …
```

Ein modulweiter Helfer `listOf<R>(args: readonly unknown[]): readonly R[]` antwortet
`args[0]`, wenn genau ein Argument kommt und es ein Array ist, sonst `args`. Dasselbe
für `remove()`. Die Liste wird gelesen, nicht kopiert und nicht behalten; die
Regel »jede `aabb` wird geprüft, bevor der erste Renderable wandert« gilt für beide Formen.
TSDoc beider Methoden: die zwei Formen, und dass die Listenform für große Mengen da ist —
eine Spread-Übergabe (`grid.add(...list)`) stößt bei einigen hunderttausend Elementen an
das Argument-Limit der Engine. Ein einzelnes Argument, das ein Array ist, gilt als Liste.

Tests in `Map2DSpatialHashGrid.spec.ts`:
- `add() and remove() take the renderables as one list` — 100 000 Renderables in einer
  Liste hinein, `size` 100 000, Stichproben über `findWithin()`, alle per Liste wieder
  heraus, `size` 0.
- `add() with a list adds none of it when one aabb is refused` — eine nicht endliche `aabb`
  in der Liste: `RangeError` wie heute, `size` unverändert, ein schon gehaltener Renderable
  in seinen Zellen.

### 6. Bucket-Liste nach `clear()` zurückgeben (RES-002)

**`TileSlotTable.ts`:** Startkapazität merken (`readonly #capacity`, aus dem
Konstruktorparameter). Neu:

```ts
/**
 * Forgets every entry and goes back to the bucket list it started with — for a table whose
 * entries all go at once. Every entry it held comes out unlinked, as `remove()` leaves one.
 */
reset(): void
```

Rumpf: über die Buckets laufen und bei jedem Eintrag der Kette `nextInBucket = undefined`
setzen, dann `this.#buckets = new Array<T | undefined>(this.#capacity).fill(undefined)` und
`this.#size = 0`. Dazu ein Getter `get bucketCount(): number` (die Länge der Bucket-Liste)
für die Spec — die Klasse ist intern. Der Klassen-TSDoc (Zeilen 33-35) sagt zusätzlich: die
Bucket-Liste schrumpft nicht von selbst; `reset()` geht auf den Anfang zurück. Die
Kamera-Visibility (`TileSlotPool`) ruft `reset()` nicht — ihre Tabelle folgt der größten
Ansicht, und Schrumpfen zwischen zwei Ansichten baute sie je Wechsel neu; ein Satz dazu
in den TSDoc der Klasse.

**`Map2DSpatialHashGrid#clear()` (Zeile 212):** die Schleife leert weiter jedes
`cell.renderables` (die Doku von `getTile()` sagt, dass ein Set geleert zurückbleibt), ruft
aber nicht mehr `this.#cells.remove(cell)` je Zelle, sondern nach der Schleife einmal
`this.#cells.reset()`. TSDoc von `clear()`: die Zellentabelle geht auf ihre Startgröße
zurück.

Tests: `TileSlotTable.spec.ts` —
`reset() forgets every entry, unlinks it and goes back to the buckets it started with`
(über die Startkapazität hinaus füllen, `bucketCount` gewachsen; nach `reset()`: `size` 0,
`bucketCount` wie am Anfang, `get()` findet nichts, jeder Eintrag hat
`nextInBucket === undefined`, ein Eintrag lässt sich wieder hinzufügen und finden).
`Map2DSpatialHashGrid.spec.ts` — `clear() takes the table of its cells back to the size it started with`
mit `vi.spyOn(TileSlotTable.prototype, 'reset')`, und danach `add()`/`findWithin()` wie auf
einem neuen Gitter.

### 7. `maxVisibleTiles` in beiden Visibilitoren (CONS-011)

Entscheidung im Plan: der Code-Fix, die Empfehlung nennt ihn »die Rechteck-Variante
optional kappen lassen«. Also opt-in, die Voreinstellung bleibt `'throw'`.

**Name:** `atLimit`, nicht `onLimit` wie im Audit-Vorschlag — `on…` ist in dieser
Library der Name von Callbacks (`onCreateVO`, `onResource()`), und das hier ist eine Wahl
aus zwei Wörtern: `area.atLimit = 'cap'`.

**`RectangularVisibilityArea.ts`:**

- `#atLimit: 'throw' | 'cap' = 'throw'`, Getter und Setter `atLimit`. Der Setter wirft für
  alles andere `TypeError` mit genau
  `RectangularVisibilityArea: atLimit must be "throw" or "cap", got ${describeValue(value)}`
  und behält den Wert; ein neuer Wert setzt `needsUpdate = true`. Der TSDoc beschreibt
  beide Wörter: `'throw'` wie heute; `'cap'` behält von einem zu großen Rechteck die
  mittleren Tiles, höchstens `maxVisibleTiles`, und warnt beim ersten Mal.
- Im Grenzzweig (Zeile 228-238): bei `'throw'` unverändert. Bei `'cap'` wird
  `tileCoords` (das Scratch-Objekt `#tileCoords`) in place auf ein mittiges Teilrechteck
  verkleinert, mit denselben Seitenverhältnissen, so weit die Ganzzahlen es zulassen:

  ```ts
  const {columns, rows} = tileCoords;
  const max = this.#maxVisibleTiles; // finite here: the rectangle covers more
  const keptColumns = Math.min(columns, max, Math.max(1, Math.floor(Math.sqrt((max * columns) / rows))));
  const keptRows = Math.min(rows, Math.floor(max / keptColumns));
  tileCoords.tileLeft += Math.floor((columns - keptColumns) / 2);
  tileCoords.tileTop += Math.floor((rows - keptRows) / 2);
  tileCoords.columns = keptColumns;
  tileCoords.rows = keptRows;
  // the edges in world units follow, as computeTilesWithinArea() writes them
  tileCoords.left = tileCoords.tileLeft * tileCoords.tileWidth;
  tileCoords.top = tileCoords.tileTop * tileCoords.tileHeight;
  tileCoords.width = keptColumns * tileCoords.tileWidth;
  tileCoords.height = keptRows * tileCoords.tileHeight;
  ```

  Danach läuft die Methode weiter wie ohne Grenze, mit `tilesLength` neu als
  `keptColumns * keptRows` (die Variable wird dafür `let`). `needsUpdate`, `#serial`,
  `#gridChangeRefused` und der Cache-Pfad verhalten sich wie bei einem Aufruf unter der
  Grenze. Vorher prüfen, dass `computeTilesWithinArea()` die vier Kanten genau so
  schreibt (`Map2DTileCoordsUtil.ts`), und die Zeilen danach richten.
- `#warnedCapped = false` und `#warnCapped(covered: number)` wie
  `CameraBasedVisibility.ts:1038-1046`, einmal je Fläche, mit genau
  `RectangularVisibilityArea: the area covers ${covered} tiles of the grid, more than maxVisibleTiles (${limit}), so only the ${kept} in its middle are kept. Raise maxVisibleTiles, make the area smaller or the tiles larger, if the tiles further out should be drawn. This warning is shown once per area.`
  (`kept` = `keptColumns * keptRows`).
- TSDoc von `maxVisibleTiles` und `computeVisibleTiles()`: »throws« gilt unter
  `atLimit = 'throw'`; unter `'cap'` die Kappung.

**`types.ts`, `IMap2DVisibilitor`:** ein Absatz zum Limit: Ein Visibilitor begrenzt die
Tiles eines Aufrufs selbst; `CameraBasedVisibility` behält die der Kamera nächsten und
warnt einmal, `RectangularVisibilityArea` wirft einen `RangeError` oder behält unter
`atLimit = 'cap'` die mittleren und warnt einmal. `Map2D#update()` und
`Map2DTileStreamer#update()` fangen nicht, was `computeVisibleTiles()` wirft — ein
Visibilitor, der wirft, wirft aus der Frame-Schleife (`Map2DTileStreamer.ts:277` ruft
`computeVisibleTiles()` ohne `try`).

**`docs/map2d.md`:** Zeilen 126-128 nennen `atLimit = 'cap'` als zweiten Weg; die Tabelle
(Zeilen 250, 258) bekommt eine Zeile `RectangularVisibilityArea#atLimit` | `'throw'` |
…; dazu ein kurzer Absatz, der beide Visibilitoren an der Grenze nebeneinander stellt
(was jeder tut, dass ein Tausch das Verhalten an der Grenze ändert, und wie man es
angleicht). Ein Codebeispiel nur als `ts check`-Block, der für sich kompiliert.

Tests in `RectangularVisibilityArea.spec.ts`:
- `atLimit takes "throw" and "cap", and refuses anything else, keeping the value it had`
  (`'cap'`, `'throw'`, dann `'clip'`, `undefined`, `1` — je `TypeError` mit der Meldung,
  Wert bleibt).
- `under atLimit "cap" an area over maxVisibleTiles keeps the tiles of a rectangle in its middle, no more than maxVisibleTiles, and warns once`
  — z. B. 20 × 10 Tiles bei `maxVisibleTiles = 50`: 10 × 5 Tiles, die mittleren
  (`tileLeft` und `tileTop` je um 5 bzw. 2 verschoben, mit `Math.floor` nachrechnen),
  `console.warn` genau einmal über zwei zu große Aufrufe.
- `under atLimit "cap" a capped area hands its result back while nothing changes` — zweiter
  Aufruf mit `previousTiles === result.tiles`: `changed === false`, keine `createTiles`.
- `under atLimit "cap" a narrow area keeps a strip of at most maxVisibleTiles` — 1 Zeile
  × 200 Spalten bei `maxVisibleTiles = 50`: 50 × 1.
- Die vorhandenen Tests zum Werfen bleiben unverändert grün (Voreinstellung).

### 8. TSDoc an den Einstiegen von map2d und stage (API-001)

Je ein kurzer TSDoc-Block: Zweck, Besitz (wer hält was, was bleibt beim Aufrufer) und
die Randregel, wo es eine gibt. Was der Block sagt, steht im Code — vorher lesen, nicht
raten; eine Randregel, die `AABB2.spec.ts` noch nicht prüft, bekommt dort einen Fall.
Zuerst die vier mit verborgenem Verhalten:

1. `map2d/AABB2.ts` — Klasse (Achsen: `left`/`top` die kleinere Koordinate,
   `right = left + width`, `bottom = top + height`; die Felder sind frei schreibbar und
   ungeprüft) und jedes Member ohne TSDoc. `isInside()`: halboffen — linker und oberer Rand
   zählen, rechter und unterer nicht, so dass die Kästen eines Gitters keinen Punkt teilen.
   `isInsideAABB()`: geschlossen. `isIntersecting()`: was als Überlappung zählt (Kästen,
   die sich nur an einer Kante berühren, schneiden sich nicht) — aus dem Code ablesen,
   auch für einen Kasten der Breite oder Höhe 0. `isNorthWest()` … `isSouthWest()`: was sie
   über die Lage zum Punkt sagen, streng.
2. `stage/OrthographicProjection.ts:47` und `ParallaxProjection.ts:49` — Klasse,
   `viewSpecs` (das Objekt des Aufrufers wird gehalten, nicht kopiert; wann eine Änderung
   daran wirkt — beim nächsten `updateViewRect()`, auf einem `Stage2D` also erst mit
   `needsUpdate` oder `updateProjection(true)`: im Code von `Stage2D` nachsehen) und
   `projectionPlane`. Nicht festschreiben, wie ungültige Werte in den Specs behandelt
   werden — dazu steht in »Offene Befunde« eine Rückfrage zu `fitIntoRectangle()`; der
   TSDoc verweist dafür auf die Doku von `ProjectionFitSpecs`.
3. `stage/ProjectionPlane.ts` — `static get()`, `clone()`, `equals()`, `applyRotation()`
   (multipliziert die Drehung auf die Orientierung, die das Objekt schon hat —
   `applyQuaternion()`; zweimal gerufen dreht es zweimal), `getPointByDistance()`,
   `getOrigin()` und der Konstruktor, soweit ohne TSDoc.
4. `stage/Stage2D.ts:485` `updateProjection(forceUpdate)` — rechnet die Projektion nur bei
   `needsUpdate` oder `forceUpdate` und gesetzter Projektion neu, nach `dispose()` nichts;
   `updateFrame()` ruft sie je Frame; Fehler der Listener kommen gesammelt (die Meldung
   steht in der Methode). Dazu `isStage2D` (Zeile 93).

Dann:

5. `map2d/RectangularVisibilityArea.ts:20` — Klasse (ein Rechteck in Welt-Einheiten um den
   Mittelpunkt des Streamers; Abgrenzung zu `CameraBasedVisibility` in einem Satz).
6. `map2d/Map2DTileCoords.ts:5` — Klasse und Member ohne TSDoc.
7. `map2d/Map2D.ts` — `addTileRenderer()` (Zeile 205: der Knoten kommt unter die Map, der
   Streamer bekommt den Renderer, ein zweites Mal ändert nichts), `update()` (Zeile 229: je
   Frame; wirft, was der Visibilitor wirft — siehe Schritt 7), `clearTiles()`.
8. `map2d/Map2DTileStreamer.ts:206` — `addTileRenderer()`.
9. `map2d/Map2DTileRenderer.ts:6` — Klasse (Member, die `IMap2DTileRenderer` dokumentiert,
   brauchen keinen eigenen Block).
10. `map2d/CameraBasedVisibility.ts:300` — Feld `camera`.
11. `stage/StageRenderer.ts:1530` — `hasStage()`.
12. `stage/ClearStage.ts:5` — die Felder von `ClearStageOptions` mit ihren Defaults
    (`color` false, `depth` true, `stencil` false, Konstruktor Zeile 37-39) und dieselben
    drei Felder der Klasse.

Kein CHANGELOG-Eintrag für reine TSDoc.

### 9. CHANGELOG und Guides

`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, Skill `updating-changelog`:

- `### Added`: `Map2DSpatialHashGrid#add()` und `#remove()` nehmen die Renderables auch als
  eine Liste — für Mengen, die eine Spread-Übergabe am Argument-Limit der Engine scheitern
  ließen. · `RectangularVisibilityArea#atLimit`: `'throw'` (Voreinstellung) oder `'cap'`,
  das die mittleren Tiles behält und einmal warnt, wie `CameraBasedVisibility` an seiner
  Grenze.
- `### Changed`: `SpritePicker` hält die Meshes, die es gezeichnet hat, schwach; ein Mesh,
  das sein Besitzer ohne `dispose()` fallen lässt, wird gesammelt, und der Picker gibt
  Pick-Mesh und Pick-Material danach frei. · `Map2DSpatialHashGrid#clear()` bringt die
  Tabelle seiner Zellen auf die Startgröße zurück.
- `### Removed` (je **BREAKING**, »See the Migration Guide«):
  `Map2DSpatialHashGrid.getKey()` und `Map2DSpatialHashGridKeyType`; der Export von
  `base64toUint32Arr`.
- `### Fixed`: `defineSprite()` nimmt Usage-Wörter und Attribute an, die wie ein Member von
  `Object.prototype` heißen (`constructor`, `toString`), und lehnt ein Alias auf einen
  solchen Namen ab, den das Feature nicht deklariert, mit eigener Meldung · der
  Frame-Kontext eines Features lehnt eine Textur wie `toString` ab, die es nicht deklariert
  · `SpriteResources` hält eine Uniform `__proto__` als eigene Uniform.
- `### Migration Guide`, neuer Abschnitt `#### The deprecated exports of map2d are gone`:
  **Before**/**After** als schlichte `ts`-Blöcke (der Before-Block kompiliert gegen die
  neue Library nicht): `Map2DSpatialHashGrid.getKey(x, y)` → `tileKey(x, y)`,
  `Map2DSpatialHashGridKeyType` → `string`, `base64toUint32Arr(data)` → in einer
  Unterklasse von `DataIdsChunk2D` `super.prepareData(data)`.

Kein Satz in CHANGELOG, Guides oder TSDoc vergleicht mit dem Vorzustand (»no longer«,
»now«, »instead of before«) — das gehört in die Commit-Message. Die Guides ändern sich in
den Schritten 3c, 5 (`docs/map2d.md`, Abschnitt zum Gitter: ein Satz zur Listenform, im
vorhandenen `ts check`-Block bei `grid.add(coin, key)` darf die Listenform daneben stehen;
Tabelle Zeile 23 nennt `add()` mit Liste), 6 (`docs/map2d.md` beim `clear()` des Gitters:
die Tabelle geht auf ihre Startgröße zurück) und 7.

## Abgleich (Zug 0, 2026-11-18, gegen f2be2168)

- **BUG-014** unverändert: `defineSprite.ts:202` (`aliases[word] ?? []` auf `{}`), `:195`
  (`feature.attributes?.[target] == null`), `:136` (`name in base.description.attributes`).
  Gleiche Ursache, im Audit nicht genannt: `:129`/`:164` (`Object.assign` auf `{}`),
  `FeatureSprites/FeatureSpritesMaterial.ts:348`, `FeatureSprites/SpriteResources.ts:160`.
- **RES-001** unverändert: `SpritePicker.ts:202` (`Map<FeatureSprites, PickEntry>`); der
  zweite starke Pfad läuft über `entry.onDispose` am Dispose-Event der Geometrie
  (`#build()`, Zeilen 435-441).
- **CONS-006** unverändert: `isRecord` in `checkFeature.ts:8`, `passes/passFeatures.ts:20`,
  `FeatureSpritesGeometry.ts:41`, `SpriteResources.ts:49`; `isStringList` in
  `checkFeature.ts:10`, `passFeatures.ts:22`; `VECTOR_TYPES` in `spriteDeclarations.ts:13`
  und `SpriteResources.ts:76`, Größenfunktion `spriteDeclarations.ts:35` und
  `SpriteResources.ts:77`. Außerhalb von `sprites/` dieselbe Regel als `isPlainObject` in
  `texture/checkTextureStoreData.ts:16`.
- **CONS-011** verschoben: `RectangularVisibilityArea.ts:229-238` wirft;
  `CameraBasedVisibility.ts:875` (`if (search.run()) this.#warnCapped();`) und `:1038`
  (`#warnCapped()`).
- **API-007** verschoben: `Map2DSpatialHashGrid.ts:145` (`add`), `:192` (`remove`), beide
  nur Rest-Argumente.
- **API-001** alle Stellen weiter ohne TSDoc: `RectangularVisibilityArea.ts:20`,
  `Map2DTileCoords.ts:5`, `Map2D.ts:205, 229`, `Map2DTileStreamer.ts:206`,
  `Map2DTileRenderer.ts:6`, `AABB2.ts:4` (Klasse nur »Represents a 2D axis aligned boundary
  box.«, `isInside`/`isIntersecting` ohne Randregel), `CameraBasedVisibility.ts:300`,
  `OrthographicProjection.ts:47`, `ParallaxProjection.ts:49`, `ProjectionPlane.ts:53, 63`,
  `Stage2D.ts:93` (`isStage2D`; im Audit `:86`) und `:485` (`updateProjection`; im Audit
  `:477`), `StageRenderer.ts:1530` (im Audit `:1475`), `ClearStage.ts:5`.
- **RES-002** verschoben: `TileSlotTable.ts:106` (`#grow()`), `Map2DSpatialHashGrid.ts:212`
  (`clear()` ruft `remove()` je Zelle, die Bucket-Liste bleibt).
- **COMP-002** unverändert: `chunk-quad-tree/base64toUint32Arr.ts:9`,
  `Map2DSpatialHashGrid.ts:14-18, 77-85`; Verwender nur `DataIdsChunk2D.ts:76` (intern),
  `tileKeys.spec.ts:25` und die Spec der Funktion.

## Triage (Zug 0)

- Folgen: keine — kein erledigtes Paket trägt eine offene `Folgen:`-Zeile.
- »Offene Befunde«: kein Eintrag teilt eine Ursache mit diesem Paket.
  `SpriteResources.ts` `#shapeError()` ohne `got …` ist eine Frage der Meldungsregel, nicht
  der doppelten Guards; `RepeatingTilesProvider` `tileIds` und `PanControl2D` `keys` sind
  Eingabeprüfungen aus der Familie von Paket 3; `fitIntoRectangle()` und die Display-Maße
  sind Rückfragen. Alle bleiben liegen.
- Neu in die Queue (vorbestehend, info, → Rückfrage): die übrigen `@deprecated`-Exporte
  der Library — Loader in `texture/` (`TileSetLoader`, `TextureImageLoader`,
  `TextureAtlasLoader`, `PowerOf2ImageLoader` samt Typen), `MapTuple`/`MapSubTypes`
  (`TextureStore.ts:54, 68`), `TextureStore.ts:1355`, `TextureResource.ts:896`,
  `TextureFactory.ts:40`, `PanControl2D` `keyCodes` (`:168, 239`),
  `Display.CssRulesPrefixFullscreen` (`Display.ts:384`). Entscheidung 1 deckt nur die
  map2d-Exporte; ob 0.26.0 auch diese entfernt, ist eine Release-Entscheidung — mehrere
  sind erst mit 0.25.0 (2026-11-01) veraltet.

## Entscheidungen dieses Pakets

- Gleiche Ursache mitgenommen: die drei weiteren Prototyp-Lookups (1c zweiter Teil, 1d,
  1e) und `isPlainObject` in `texture/` (2c) — wäre der jeweilige Fix vollständig
  gewesen, gäbe es sie nicht; ohne sie wäre die Regel halb behoben.
- BUG-014: `Map` zum Sammeln, Plain-Object nach außen — die öffentliche Form von
  `SpriteKind#usageAliases` und `SpriteResources#uniforms` bleibt, kein Breaking.
- RES-001: `WeakMap` zum Nachschlagen plus `Set` der Einträge statt `Map<WeakRef, …>` —
  `#sync()` schlägt je Pick nach Mesh nach, eine `WeakMap` tut das ohne Allokation, und
  `dispose()` braucht die iterierbare Menge, die das Mesh nicht hält.
- CONS-011: opt-in (`'throw'` bleibt Voreinstellung), weil die Empfehlung »optional
  kappen« sagt und die Voreinstellung zu kippen über sie hinausginge; Name `atLimit`
  statt `onLimit` (Grund in Schritt 7); Kappung als mittiges Teilrechteck, weil die
  Belegungsliste der Klasse auf Spalten × Zeilen rechnet und ein Rechteck das bleibt,
  was dieser Visibilitor liefert. Die Kamera-Variante bekommt keine Wurf-Option: ein Wurf
  mitten in ihrer Suche bräuchte einen Rückweg für den halb geschriebenen Zustand, und
  die Gleichbehandlung verlangt das nicht.
- RES-002: nur das Gitter setzt zurück; die Kamera-Visibility nicht (Grund in Schritt 6).
- API-001: zusätzlich die Geschwister ohne TSDoc in denselben Klassen
  (`Map2D#clearTiles()`, Member von `AABB2`, `ProjectionPlane`, `ClearStage`) — gleiche
  Ursache, dieselbe Datei.
- Modell stärkste Stufe: GC- und Lebenszeit-Logik im Picker (Closure-Kontext, Test über
  `gc()`), öffentliche Oberfläche (Breaking) über zwei Module und rund 25 TSDoc-Blöcke, die
  Verhalten aus dem Code richtig wiedergeben müssen. Effort `high`: Kappungsrechnung und
  Picker-Umbau verlangen Urteil, und die Oberfläche bewegt sich.

## Findings im Volltext

**BUG-014 · low · packages/twopoint5d/src/sprites/defineSprite.ts:202** — Namen aus Object.prototype in Usage-Aliasen und Attributen über Own-Key-Prüfung abfangen
`mergeUsageAliases()` sammelt in einem Plain-Object `aliases` und liest `aliases[word] ?? []`. Ein Alias-Wort wie `constructor` oder `toString` trifft die geerbte Funktion und `[...fn]` wirft ein TypeError ohne Subjekt (»(a[w] ?? []) is not iterable«) statt einer Fehlermeldung von `defineSprite()`. Dieselbe Lücke in Zeile 195 (`feature.attributes?.[target] == null` hält `toString` für deklariert) und Zeile 136 (`name in base.description.attributes` meldet ein Attribut `constructor` fälschlich als »schon von der Base gehalten«). An den übrigen Stellen des Moduls ist `Object.hasOwn` Regel (`SpriteResources#uniform`, `bindUniform`, `sliceOf`).
Empfehlung: `aliases` und die Attributtabelle als `Object.create(null)` oder `Map` führen, Zeile 195 mit `Object.hasOwn(feature.attributes ?? {}, target)` und Zeile 136 mit `Object.hasOwn(base.description.attributes, name)` prüfen.

**RES-001 · low · packages/twopoint5d/src/sprites/SpritePicker.ts:202** — Pick-Einträge des SpritePicker nicht an starke Mesh-Referenzen binden
`#entries` ist eine `Map<FeatureSprites, PickEntry>` und hält jedes je gepickte Mesh samt Geometrie, Pool und Texturen bis `dispose()` des Meshs oder des Pickers; ein aus der Szene genommenes, nie disposetes Mesh lebt so lange wie der Picker. Die Klassendoku sagt das ausdrücklich, die Lebenszeit ist aber in Apps mit wechselnden Meshes ein stiller Halter. Eine Map ist hier nötig, weil `dispose()` iteriert.
Empfehlung: Optional: `WeakRef` auf das Mesh in der Map plus `FinalizationRegistry` zum Aufräumen der Pick-Meshes, oder in der Doku von `pick()` den Weg über `dispose()` des Meshs als Pflicht für Wegwerf-Meshes hervorheben.

**CONS-006 · low · packages/twopoint5d/src/sprites/checkFeature.ts:8** — Gemeinsame Typ-Guards und Vektor-Helfer des Sprites-Moduls an einer Stelle bündeln
`isRecord` steht wortgleich in vier Dateien des Moduls, `isStringList` in zwei, `VECTOR_TYPES` samt `sizeOf`/`sizeOfValue` in `SpriteResources.ts` und `spriteDeclarations.ts` je einmal. `isUniformValue` wird dagegen schon aus `spriteDeclarations.ts` importiert. Ändert sich eine Prüfregel (etwa Array-Ausschluss), muss man jede Kopie finden; die Regeln der Fehlermeldungen (AGENTS.md) hängen an genau diesen Prüfungen.
Empfehlung: `isRecord` und `isStringList` nach `src/utils/` (neben `isObject`), `VECTOR_TYPES` und die Größenfunktion aus `spriteDeclarations.ts` exportieren und in `SpriteResources.ts` importieren.

**CONS-011 · low · packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:229** — Überschreitung von maxVisibleTiles in beiden Visibilitoren gleich behandeln
Beide Visibilitoren kennen `maxVisibleTiles` mit demselben Default 10 000 und derselben Doku-Formulierung, reagieren aber verschieden: CameraBasedVisibility kappt auf die nächsten Tiles und warnt einmal per console.warn; RectangularVisibilityArea wirft bei jedem Aufruf eine RangeError. Da Map2D#update() die Visibilitor-Ausnahme nicht abfängt, wirft ein zu großes Rechteck (etwa durch eine kleine tileWidth) in jedem Frame aus dem Render-Loop, während derselbe Fall mit der Kamera-Variante still weiterläuft. Beide Verhalten sind dokumentiert, aber wer die Visibilitoren austauscht, stolpert über den Unterschied.
Empfehlung: Die Entscheidung (Fail-fast gegen Kappen) in der Interface-Doku von IMap2DVisibilitor festhalten oder die Rechteck-Variante optional kappen lassen (z. B. Option `onLimit: 'throw' | 'cap'`); mindestens in der Map2D-Anleitung beide Verhalten nebeneinander nennen.

**API-007 · low · packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:119** — add() und remove() des Map2DSpatialHashGrid auch mit Array aufrufbar machen
add() und remove() nehmen ausschließlich Rest-Argumente. Wer eine große Karte in einem Zug einfügt (`grid.add(...entities)`), stößt bei einigen hunderttausend Elementen an das Argumentlimit der Engine und bekommt einen RangeError 'Maximum call stack size exceeded' statt eines Fehlers des Gitters. Das Limit selbst ist ungeprüft (engine-abhängig); der Weg dahin ist aber an der Signatur zu sehen.
Empfehlung: Eine Überladung `add(renderables: readonly Renderable[])` ergänzen oder in der Doku auf Batches (Schleife über Teilstücke) hinweisen.

**API-001 · low · packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:20** — Fehlende TSDoc an öffentlichen Einstiegspunkten von `map2d` und `stage` ergänzen
Beide Module sind sonst gründlich dokumentiert, doch einige öffentliche Einstiege tragen keinen Doc-Kommentar. In `map2d`: `RectangularVisibilityArea`, `Map2DTileCoords`, `Map2D#addTileRenderer`/`update`, `Map2DTileRenderer`, `AABB2` — dessen halboffenes Intervall bei `isInside`/`isIntersecting` (Rand rechts/unten zählt nicht) steht nur im Code. In `stage`: `OrthographicProjection` und `ParallaxProjection` samt `viewSpecs` (bleibt das Objekt des Aufrufers), die Methoden von `ProjectionPlane` (`applyRotation` multipliziert auf die vorhandene Orientierung), `Stage2D#updateProjection()`, `StageRenderer#hasStage()`, die Felder von `ClearStageOptions`.
Weitere Fundstellen: `Map2DTileCoords.ts:5`, `Map2D.ts:205, 229`, `Map2DTileStreamer.ts:206`, `Map2DTileRenderer.ts:6`, `AABB2.ts:5`, `CameraBasedVisibility.ts:300`, `OrthographicProjection.ts:47`, `ParallaxProjection.ts:49`, `ProjectionPlane.ts:53, 63`, `Stage2D.ts:477, 86`, `StageRenderer.ts:1475`, `ClearStage.ts:5`.
Empfehlung: Je einen kurzen TSDoc-Block mit Zweck, Besitzverhältnis und Randregel setzen; zuerst `AABB2`, `viewSpecs`, `applyRotation()` und `updateProjection(forceUpdate)`, weil dort Verhalten verborgen ist, das ein Nutzer sonst aus dem Code lesen muss.

**RES-002 · info · packages/twopoint5d/src/map2d/TileSlotTable.ts:105** — Bucket-Liste der TileSlotTable nach clear() verkleinern
Die Bucket-Liste wächst per #grow() auf das Doppelte, schrumpft aber nie. Nach Map2DSpatialHashGrid#clear() (gedacht für Kartenwechsel oder Level-Reset) bleibt sie auf der Spitzengröße der früheren Karte stehen; bei der Kamera-Visibility bleibt sie auf der Größe der größten je gesehenen Ansicht. Der Speicher ist durch die Spitze begrenzt, kein Leck im Dauerbetrieb.
Empfehlung: Optional: in TileSlotTable eine `reset()`-Methode, die auf die Startkapazität zurückgeht, und diese in Map2DSpatialHashGrid#clear() aufrufen.

**COMP-002 · info · packages/twopoint5d/src/map2d/chunk-quad-tree/base64toUint32Arr.ts:9** — Veraltete Exporte der Map2D-Oberfläche beim nächsten Breaking Release entfernen
Drei Symbole der öffentlichen Oberfläche sind als @deprecated markiert und warten laut Doku auf einen Breaking Release: base64toUint32Arr (intern weiter von DataIdsChunk2D benutzt), Map2DSpatialHashGrid.getKey und der Typ Map2DSpatialHashGridKeyType. Kein Defekt; der Eintrag hält fest, dass sie beim nächsten Major aufzuräumen sind.
Empfehlung: Beim Major entfernen und base64toUint32Arr in eine interne Datei ohne Export in public-api.ts verschieben.

## Verlauf

- 2026-11-18 Zug 0: Detailplan steht · Modell stärkste Stufe, Effort high · BUG-014 unverändert (`defineSprite.ts:136, 195, 202`), dazu gleicher Ursache `defineSprite.ts:129`, `FeatureSpritesMaterial.ts:348`, `SpriteResources.ts:160` · RES-001 unverändert (`SpritePicker.ts:202`, zweiter Pfad über `#build()` 435–441) · CONS-006 unverändert (vier `isRecord`, zwei `isStringList`, `VECTOR_TYPES`/Größenfunktion doppelt), dazu `texture/checkTextureStoreData.ts:16` · CONS-011 verschoben (`RectangularVisibilityArea.ts:229`, `CameraBasedVisibility.ts:875, 1038`) · API-007 verschoben (`Map2DSpatialHashGrid.ts:145, 192`) · API-001 alle Stellen ohne TSDoc, teils verschoben (`Stage2D.ts:93, 485`, `StageRenderer.ts:1530`) · RES-002 verschoben (`TileSlotTable.ts:106`, `Map2DSpatialHashGrid.ts:212`) · COMP-002 unverändert · Folgen: keine offen · Queue: nichts übernommen, ein neuer Eintrag (übrige `@deprecated`-Exporte, → Rückfrage) · Restplan: Paket 11 hängt zusätzlich von 7 ab
- 2026-11-18 Zug 1: Implementierer beauftragt (opus, Effort high), Brief `paket-7.impl-0.brief.txt`, Report nach `paket-7.impl-0.json`
- 2026-11-18 Zug 2: Report FERTIG (Session 25d3b0b2-9218-4a7c-b122-3ff8d4aafacb; JSON trägt nur die Schlusszeile, Report aus dem Transkript) · 42 Dateien geändert, 4 neu (`utils/isRecord*`, `utils/isStringList*`) · rote Läufe 1a–1e (5 failed) und 3a (1 failed) belegt · Abweichungen: `ClippingMirror.source` als `WeakRef`, `#release()` ohne `#entries.get() === entry`, Kappungskanten mit Offset · Nebenbefunde gleicher Ursache: `defineSprite.ts:299`, `defineSprite.ts:267`, `FeatureSpritesMaterial.ts:187`, TSDoc `Map2D`/`Map2DTileStreamer` · Arbeitsbaum schmutzig
- 2026-11-18 Zug 2 (Verify): `pnpm run ci` exit=0, Log `paket-7.verify.log` · Zug 3: Reviewer beauftragt (opus, high), Diff `paket-7.diff` (3475 Zeilen)
- 2026-11-18 Zug 3: Review — alle acht Findings und die drei Stellen gleicher Ursache behoben, kritisch keine · wichtig: `docs/map2d.md:152` (»the 10 000 tiles« statt 9 890), drei ausgeschriebene `isRecord`-Kopien (`defineSprite.ts:268`, `FeatureSpritesMaterial.ts:187`, `FeatureSprites.ts:175`) · klein: `defineSprite.ts:302` `__proto__`-Methode, Offset-Kommentar `RectangularVisibilityArea.ts:290`, `ClippingMirror`-`WeakRef` ungetestet, Zeilenbreite `gpu-picking.md` §3.1, Commit-Message ohne die Fixes gleicher Ursache · Report `paket-7.review-0.json`
- 2026-11-18 Zug 4 Runde 1: offen die beiden wichtigen Befunde, dazu ins Paket genommen (gleiche Ursache): `defineSprite.ts:302` (`__proto__`-Methode, Regressionstest), TSDoc `Map2D` und `Map2DTileStreamer`; mitgegeben die kleinen (Offset-Kommentar, Test für `ClippingMirror`-`WeakRef`, Umbruch `gpu-picking.md`) · Resume Session 25d3b0b2 (opus, high), Brief `paket-7.impl-1.brief.txt`
- 2026-11-18 Zug 4 Runde 1 zurück: FERTIG · alle sieben Punkte umgesetzt · Regressionstests `takes a method named __proto__ as a method of its own, which the sprite handle carries` (vor dem Fix 1 failed) und `lets go of a mesh dropped along with the ClippingGroup above it, and releases its pick material once` (rot ohne WeakRef und rot ohne Scratch-Fix) · zusätzlich `#clippingScratch` in `#place()` geleert (zweiter starker Pfad) · Nebenbefunde keine
- 2026-11-18 Zug 4 Runde 1 Verify: `pnpm run ci` exit=0, Log `paket-7.verify-1.log` · Reviewer gezielt beauftragt (opus, high), Diff `paket-7.diff-1`
- 2026-11-18 Zug 4 Runde 1 Review: sechs von sieben erledigt (map2d.md-Zahl, drei `isRecord`-Kopien, `__proto__`-Methode, Offset-Kommentar, `ClippingMirror`-Test samt Scratch-Leeren); TSDoc `Map2D`/`Map2DTileStreamer` vorhanden, aber neu wichtig `Map2D.ts:9-10` (Besitzsatz widerspricht dem Code, von Runde 1 verursacht); klein: Zeilenbreite `gpu-picking.md:302, 305, 307`, `map2d.md:152`, `defineSprite.ts:304`; gleiche Ursache `texture/FrameBasedAnimations.ts:197` (`isRecord`-Kopie) · Fortschritt ja · Report `paket-7.review-1.json`
- 2026-11-18 Zug 4 Runde 2: frischer Implementierer (opus, high, ohne Resume), offen `Map2D.ts:9-10`, `FrameBasedAnimations.ts:197` samt weiterer exakter Kopien, Zeilenbreiten · Brief `paket-7.impl-2.brief.txt`
- 2026-11-18 Zug 4 Runde 2 zurück: FERTIG (Session 2bb39d54) · `Map2D.ts:7-13` Klassen-TSDoc am Code gerichtet (Visibilitor wandert nur mit, wenn der alte Streamer einen hat) · `FrameBasedAnimations.ts:197` → `isRecord`, keine weiteren exakten Kopien · Zeilenbreiten `gpu-picking.md` §3.1, `map2d.md:152-153`, `defineSprite.ts:303-305` · Nebenbefunde: positive Formen der `isRecord`-Regel `texture/AsepriteJson.ts:128-129`, `stage/StageDirector.ts:365`; `gpu-picking.md:48` Codekommentar 119 Zeichen
- 2026-11-18 Zug 4 Runde 2 Verify: `pnpm run ci` exit=0, Log `paket-7.verify-2.log` · Reviewer gezielt (opus, high), Diff `paket-7.diff-2`
- 2026-11-18 Zug 4 Runde 2 Review: alle drei Punkte erledigt, keine Befunde · Report `paket-7.review-2.json`
- 2026-11-18 Zug 5: Commit ab9147be (`pnpm run ci` exit=0, Log `paket-7.verify-2.log`, 48 Pfade, Trailer `Remediation-Run: 2026-11-17`) · 2 Runden · Nebenbefund `AsepriteJson.ts:128-129`/`StageDirector.ts:365` in »Offene Befunde« (→ Scope)

## Urteil des Reviewers je Finding (Runde 0, bestätigt in Runde 1 und 2)

- **BUG-014** behoben: `sprites/defineSprite.ts:175` (`Map`), `:210` (`Object.fromEntries`), `:199` (`Object.hasOwn` am Alias-Ziel), `:139` (`Object.hasOwn` statt `in`), `:131` (`Object.create(null)`); Methoden über `Object.fromEntries` `:303-307` (Runde 1)
- **BUG-014, gleiche Ursache** behoben: `sprites/FeatureSprites/FeatureSpritesMaterial.ts:349`; `sprites/FeatureSprites/SpriteResources.ts:153-159`
- **RES-001** behoben: `sprites/SpritePicker.ts:211` (`WeakMap`), `:213` (`#live`), `:215` (`FinalizationRegistry`), `:465` (`register`), `:473` (`#release(entry)` mit Guard), `:589` (`dispose()`); `ClippingMirror.source` als `WeakRef` (`:107`) und Leeren von `#clippingScratch` in `#place()` (`:418-420`, Runde 1)
- **CONS-006** behoben: `utils/isRecord.ts`, `utils/isStringList.ts` samt Specs; Kopien entfernt in `checkFeature.ts`, `passes/passFeatures.ts`, `FeatureSpritesGeometry.ts`, `SpriteResources.ts`, `spriteDeclarations.ts`; ausgeschriebene Kopien umgestellt in `defineSprite.ts:269`, `FeatureSpritesMaterial.ts:187`, `FeatureSprites.ts:175` (Runde 1), `texture/FrameBasedAnimations.ts:197` (Runde 2); `VECTOR_TYPES`/`sizeOfUniformValue` `@internal` aus `spriteDeclarations.ts`, importiert in `SpriteResources.ts:29`
- **CONS-006, gleiche Ursache** behoben: `texture/checkTextureStoreData.ts:7, 23 ff.`
- **CONS-011** behoben: `map2d/RectangularVisibilityArea.ts:173` (Setter), `:274-295` (mittiges Teilrechteck), `:381` (`#warnCapped`); `map2d/types.ts:253`; `docs/map2d.md:129-153, 297`
- **API-007** behoben: `map2d/Map2DSpatialHashGrid.ts:67` (`listOf`), `:139-141`, `:193-195`
- **API-001** behoben: TSDoc an allen Stellen aus Schritt 8, dazu `Map2D` Klasse/Konstruktor (`Map2D.ts:9-13, 207-211`) und `Map2DTileStreamer` (`:107-112, 129-134, 199-205, 213-219, 356-361`) aus Runde 1/2; neue Randfälle in `AABB2.spec.ts`
- **RES-002** behoben: `map2d/TileSlotTable.ts:113` (`reset()`), `:60` (`bucketCount`); `Map2DSpatialHashGrid.ts:222`
- **COMP-002** behoben: `getKey()`, `Map2DSpatialHashGridKeyType`, Export `base64toUint32Arr` entfernt; `chunk-quad-tree/base64toUint32Arr.ts` `@internal`; `tileKeys.spec.ts` bereinigt

## Kleine Befunde (ohne Runde)

- `packages/twopoint5d/src/map2d/Map2D.ts:46, 220, 257, 275`: je 101 Zeichen (Runde 1); HEAD hatte in der Datei schon drei Zeilen über 100 — toleriert.
- `packages/twopoint5d/docs/proposals/gpu-picking.md:48`: Kommentar im Codeblock mit 119 Zeichen (vorbestehend).
- Das Leeren von `#clippingScratch` in `SpritePicker#place()` steht nicht in einem `finally`; zwischen Füllen und Leeren wirft nach Urteil des Reviewers nichts.
