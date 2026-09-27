# Paket 5b — Ein Descriptor je Description: Pools derselben Description teilen Descriptor und Prototyp

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — Drain-Paket über einen Nebenbefund aus »Offene Befunde« (low, `→ Scope`):
  `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:82` (jeder Pool, der eine Description bekommt, baut einen
  eigenen `VertexObjectDescriptor` und damit einen eigenen Prototyp) · dazu dieselbe Ursache an
  `InstancedVOBufferGeometry.ts:259` (`attachInstancedPool()` baut für eine Description ebenfalls selbst einen
  Descriptor) und in `TexturedSpritesGeometry.ts:59–73` (ein Parameter-Objekt ohne `attributeUsage` klont die
  Sprite-Description trotzdem je Geometrie)
- Ziel: Pools, die aus demselben Description-Objekt entstehen, teilen sich Descriptor und Prototyp, solange die Description seither dieselbe ist — eine danach geänderte Description bekommt einen eigenen Descriptor, wie ohne Teilung —, nachgewiesen durch Prototyp-Identität in den Specs (Pool und Sprite-/Tile-Geometrien) und eine Bench-Variante; `docs/architecture.md` und CHANGELOG sagen es.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - neu `packages/twopoint5d/src/vertex-objects/sameVertexObjectDescription.ts` und `sameVertexObjectDescription.spec.ts`
  - neu `packages/twopoint5d/src/vertex-objects/sharedVertexObjectDescriptor.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts` (Konstruktor `:82`, JSDoc des Felds `descriptor` `:18`)
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts` (`:8` Import, `:257–263`)
  - `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.ts` (nur der Kommentar `:84–85`)
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts` (`:29–36` JSDoc, `:59–73`)
  - `packages/twopoint5d/src/vertex-objects/hot-path.bench.ts` (Test `generated setters across vertex object descriptors`, `:52–102`)
  - Specs: `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`, `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`, `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.spec.ts`, `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.spec.ts`, `packages/twopoint5d/src/map2d/TileSprites/TileSpritesGeometry.spec.ts`
  - `packages/twopoint5d/docs/architecture.md` (`:87–89`)
  - `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]` → `### Changed`, nach `:214`)
  - nicht: `public-api.ts` (beide neuen Module bleiben intern), `VertexObjectDescriptor.ts` (`new VertexObjectDescriptor()` baut weiter immer einen eigenen), kein Browser-Test (kein Render- oder GPU-Buffer-Code berührt), kein Migration Guide
- Vorgehen:
  1. **Regressionstests zuerst, rot sehen, die roten Läufe in den Report.** Rot erwartet ist jeder Test, der Descriptor- oder Prototyp-*Identität* verlangt (heute baut jeder Pool seinen eigenen); die Tests, die Verschiedenheit verlangen, sind vor dem Fix schon grün und stehen im Report als Abdeckung, nicht als Regressionstest. `sameVertexObjectDescription.spec.ts` ist vor dem Fix rot, weil das Modul fehlt — das gilt als roter Lauf.
     1. `src/vertex-objects/VertexObjectPool.spec.ts`: `import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';` ergänzen. Neues `describe('the descriptor of a pool', …)` direkt nach dem Test `construct` (`:116–122`), vor `describe('createVO()'` (`:124`). Die Variable `descriptor` aus `beforeEach` (`:87–114`) ist eine `VertexObjectDescription` und wird so benutzt.
        - `pools built from one description object share its descriptor and the prototype of their vertex objects` — `a = new VertexObjectPool<MyVertexObject>(descriptor, 2)`, `b = … (descriptor, 3)`; `expect(b.descriptor).toBe(a.descriptor)`; `expect(Object.getPrototypeOf(b.createVO())).toBe(Object.getPrototypeOf(a.createVO()))`. Rot erwartet.
        - `pools built from two description objects of the same content build a descriptor each` — zweite Description als eigenes Objekt gleichen Inhalts (lokale Fabrik oder `structuredClone(descriptor)`; die Description aus `beforeEach` hat weder Funktionen noch `basePrototype`); `expect(b.descriptor).not.toBe(a.descriptor)`. Vor dem Fix grün (Abdeckung).
        - `a description changed after a pool was built from it gives the next pool a descriptor of its own, and the pool before keeps its own` — `a = pool(descriptor)`; danach `descriptor.attributes['extra'] = {size: 1};` (`attributes` ist ein `Record<string, VertexAttributeDescription>`, kein Cast nötig); `b = pool(descriptor)`: `expect(b.descriptor).not.toBe(a.descriptor)`, `expect(b.descriptor.getAttribute('extra')).toBeDefined()`, `expect(a.descriptor.getAttribute('extra')).toBeUndefined()`; `c = pool(descriptor)`: `expect(c.descriptor).toBe(b.descriptor)`. Rot erwartet (an der letzten Assertion).
        - `a descriptor built with new VertexObjectDescriptor() stays its own` — `a = pool(descriptor)`, `own = new VertexObjectDescriptor(descriptor)`: `expect(own).not.toBe(a.descriptor)`; `expect(new VertexObjectPool(own, 1).descriptor).toBe(own)`. Vor dem Fix grün (Abdeckung).
        - `a description the descriptor refuses is refused on every pool, and builds a pool once it is fixed` — `const broken: VertexObjectDescription = {vertexCount: 0, attributes: {pos: {size: 1}}};` → `expect(() => new VertexObjectPool(broken, 1)).toThrow(RangeError)` zweimal; `broken.vertexCount = 1;` → `expect(new VertexObjectPool(broken, 1).descriptor.vertexCount).toBe(1)`. Hält fest, dass ein Fehlschlag nichts zwischenspeichert. Vor dem Fix grün (Abdeckung).
     2. `src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`: neuer Test nach `construct with base, instanced and extra-instanced descriptors` (`:90–103`): `pools attached from one description on two geometries share its descriptor` — `const extraDescription: VertexObjectDescription = {attributes: {extra: {size: 1, bufferName: 'extraBuffer'}}};` (Import `type VertexObjectDescription` aus `./types.js` ergänzen), zwei Geometrien `new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1)`, auf jeder `attachInstancedPool('extraPool', extraDescription)`; `expect(second.descriptor).toBe(first.descriptor)`. Rot erwartet. Beide Geometrien am Ende `dispose()`.
     3. `src/sprites/TexturedSprites/TexturedSpritesGeometry.spec.ts`, drei Tests nach `keeps the usage of the sprite description for parameters without attributeUsage` (`:115–122`), jeder Geometrie am Ende `dispose()`:
        - `shares the descriptors of its pools and the prototype of its sprites with every geometry built from a capacity number` — `a = new TexturedSpritesGeometry(10)`, `b = new TexturedSpritesGeometry(10)`: `expect(b.instancedPool.descriptor).toBe(a.instancedPool.descriptor)`, `expect(b.basePool.descriptor).toBe(a.basePool.descriptor)`, `expect(Object.getPrototypeOf(b.instancedPool.createVO())).toBe(Object.getPrototypeOf(a.instancedPool.createVO()))`. Rot erwartet.
        - `shares them for parameters without attributeUsage as well` — `new TexturedSpritesGeometry({capacity: 10})` gegen `new TexturedSpritesGeometry(10)`: `instancedPool.descriptor` identisch. Rot erwartet (heute klont das Parameter-Objekt).
        - `builds a descriptor of its own for parameters with attributeUsage` — zwei Geometrien mit `{capacity: 10, attributeUsage: {dynamic: ['texCoords']}}`: `expect(b.instancedPool.descriptor).not.toBe(a.instancedPool.descriptor)` und beide `.not.toBe(new TexturedSpritesGeometry(10).instancedPool.descriptor)`. Hält fest, was Doku und CHANGELOG sagen. Vor dem Fix grün (Abdeckung).
     4. `src/sprites/AnimatedSprites/AnimatedSpritesGeometry.spec.ts`: neuer Test nach `builds a sprite pool of 100 …` (`:15–24`): `shares the descriptors of its pools and the prototype of its sprites with every other geometry` — wie der erste Test in 3., mit `new AnimatedSpritesGeometry(10)`. Rot erwartet.
     5. `src/map2d/TileSprites/TileSpritesGeometry.spec.ts`: neuer Test nach `builds an instanced pool …` (`:11–18`): dasselbe mit `new TileSpritesGeometry(4)`. Rot erwartet.
     6. `src/vertex-objects/sameVertexObjectDescription.spec.ts` (neu), `describe('sameVertexObjectDescription()')`. Eine lokale Fabrik `make()` baut bei jedem Aufruf ein neues Objekt: `vertexCount: 4`, `indices: [0, 1, 2, 0, 2, 3]`, Attribute `pos: {components: ['x', 'y'], type: 'float32', usage: 'dynamic'}` und `glow: {size: 1, bufferName: 'glowBuffer'}`, `methods: {shine}` (eine modulweite Funktion `shine`), `basePrototype: Sprite.prototype` (eine lokale Klasse `Sprite`). Jede Prüfung gegen `new VertexObjectDescriptor(d).description`, gebaut **vor** der Änderung an `d`:
        - `a description is the same as the copy a descriptor holds of it` → `true`
        - `a second object of the same content is the same` → `sameVertexObjectDescription(make(), new VertexObjectDescriptor(make()).description)` → `true`
        - `a description without indices and methods is the same as its copy` → `true` (Fabrik-Variante ohne `indices` und `methods`)
        - `test.each` über Änderungen, jede → `false`: `vertexCount` 4 → 8 · ein Index geändert · ein Index angehängt · `indices` gelöscht · ein Attribut hinzugefügt · ein Attribut gelöscht · dieselben zwei Attribute in umgekehrter Reihenfolge (neues `attributes`-Objekt) · je eines von `size`, `type`, `normalized`, `usage`, `autoTouch`, `bufferName`, `getter`, `setter` an `glow` geändert oder gesetzt · `getter: undefined` an `glow` gesetzt (der Schlüssel allein ändert den Descriptor: `VertexAttributeDescriptor#getterName` fragt `'getter' in description`) · eine Komponente umbenannt · eine Komponente angehängt · `basePrototype` durch ein anderes Objekt ersetzt · eine Methode durch eine andere Funktion ersetzt · eine Methode hinzugefügt · `methods` gelöscht
  2. **`sameVertexObjectDescription.ts`** (neu, intern — nicht in `public-api.ts`):
     ```ts
     export function sameVertexObjectDescription(
       description: VertexObjectDescription | FrozenVertexObjectDescription,
       frozen: FrozenVertexObjectDescription,
     ): boolean
     ```
     `frozen` ist die Kopie, die ein Descriptor hält (`VertexObjectDescriptor#description`, entstanden über `cloneVertexObjectDescription()`). Die Funktion antwortet `true` genau dann, wenn eine Kopie von `description` dasselbe beschriebe; im Zweifel `false` — ein `false` zu viel kostet nur das Teilen, ein `true` zu viel ließe eine Änderung ins Leere laufen. Verglichen wird jedes Feld, das `cloneVertexObjectDescription()` kopiert, und in derselben Form:
     - `vertexCount`: `===`.
     - `indices`: ist `description.indices` nullish, muss `frozen.indices` nullish sein; sonst gleiche Länge und `===` je Element.
     - `attributes`: `Object.keys()` beider Seiten gleich lang und an jeder Position derselbe Name (die Reihenfolge ist die von `VertexObjectDescriptor#attributeNames`). Je Attribut: gleich viele eigene Schlüssel (`Object.keys()`), jeder Schlüssel der lebenden Seite ist ein eigener Schlüssel der eingefrorenen (`Object.hasOwn`), und sein Wert ist gleich — `components` elementweise, wenn beide Seiten Arrays sind, jeder andere Wert mit `===`.
     - `basePrototype`: `===`.
     - `methods`: ist `description.methods` falsy, muss `frozen.methods` `undefined` sein (die Kopie legt dann keins an); sonst `frozen.methods` vorhanden, gleich viele eigene Schlüssel, jede Funktion `===`.
     Allokationsfreiheit ist nicht verlangt (`Object.keys()` ist in Ordnung): der Vergleich läuft einmal je Pool-Bau, nie im Frame. JSDoc mit `@internal`, ein Satz, was verglichen wird und dass `cloneVertexObjectDescription()` die Liste der Felder vorgibt.
  3. **`sharedVertexObjectDescriptor.ts`** (neu, intern):
     ```ts
     const descriptors = new WeakMap<object, VertexObjectDescriptor>();

     export function sharedVertexObjectDescriptor(
       description: VertexObjectDescription | FrozenVertexObjectDescription,
     ): VertexObjectDescriptor {
       const known = descriptors.get(description);
       if (known !== undefined && sameVertexObjectDescription(description, known.description)) return known;
       const descriptor = new VertexObjectDescriptor(description);
       descriptors.set(description, descriptor);
       return descriptor;
     }
     ```
     Kommentare (Englisch): an der `WeakMap` — keyed by the description object a caller hands a pool; weak, so a description nothing else holds takes its descriptor and prototype with it. Am Vergleich — a description is a plain object its author may change after the first pool; the descriptor holds a frozen copy, and a pool built after the change has to see the change, so a description that no longer matches gets a descriptor of its own and the pools built before keep theirs. Ein Descriptor, dessen Konstruktor wirft, wird nicht eingetragen (folgt aus der Reihenfolge; kein eigener Code). JSDoc mit `@internal`.
  4. **`VOBufferPool.ts`**: `:82` wird `this.descriptor = descriptor instanceof VertexObjectDescriptor ? descriptor : sharedVertexObjectDescriptor(descriptor);` (Import aus `./sharedVertexObjectDescriptor.js`). JSDoc des Felds `descriptor` (`:18`) ergänzen, Präsens, ohne Vorzustand: ein Descriptor, den der Konstruktor bekommt, gilt, wie er ist; aus einer Description entsteht er einmal je Description-Objekt — Pools aus demselben Description-Objekt teilen einen Descriptor und damit den Prototyp ihrer Vertex-Objekte, solange die Description beschreibt, was sie beim ersten dieser Pools beschrieb; eine seither geänderte bekommt einen eigenen. Alle anderen Wege, auf denen eine Description zum Pool wird (`VertexObjectPool`, `VOBufferGeometry`, `VertexObjectGeometry`, beide Instanz-Geometrien), laufen durch diesen Konstruktor und brauchen keine Änderung.
  5. **`InstancedVOBufferGeometry.ts`**, `attachInstancedPool()` (`:257–263`): der Zweig `if (ownsPool)` wird `extraPool = new VertexObjectPool(pool, this.instancedPool.capacity) as VertexObjectPool<VOType>;` — `VertexObjectPool` nimmt Descriptor und Description und teilt dann über Schritt 4. Danach steht `VertexObjectDescriptor` in der Datei nur noch in Typen: Import `:8` auf `import type` umstellen (Lint verlangt es).
  6. **`TexturedSpritesGeometry.ts`**:
     - `:59–73`: `const desc = typeof capacity === 'number' || capacity.attributeUsage == null ? TexturedSpriteDescriptor : cloneVertexObjectDescription(TexturedSpriteDescriptor, {…});` — der Klon-Aufruf bleibt, wie er ist. Ein Parameter-Objekt ohne `attributeUsage` teilt damit Descriptor und Prototyp mit jeder Geometrie aus einer Kapazitätszahl.
     - JSDoc von `attributeUsage` (`:29–35`) um einen Satz ergänzen: a geometry built with `attributeUsage` copies the sprite description and shares its descriptor and the prototype of its sprites with no other geometry; one loop over the sprites of more than four such geometries sees more than four prototypes (see »Library architecture«, the `vertex-objects/` section).
     - **Entscheidung: dokumentieren, nicht eigens lösen.** Gründe: das Teilen ist nach Identität des Description-Objekts definiert, und ein Klon je Geometrie hat per Konstruktion eine eigene; ein inhaltlich geschlüsselter Cache in `sprites/` wäre ein zweiter Cache mit eigener Schlüssel-Semantik (Reihenfolge der Namenslisten, Aliase) und hielte seine Klone stark; die Scope-Regel deckt `vertex-objects/`, nicht `sprites/`; und gemessen kostet es nur die eine Schleife über mehr als vier solcher Geometrien — eine Schleife je Geometrie ist gleich schnell (Messung unten, `setPosition()` 5,84 gegen 5,83 ns/VO).
  7. **`cloneVertexObjectDescription.ts`**, Kommentar `:84–85`: ergänzen, dass `sameVertexObjectDescription()` genau diese Felder vergleicht — ein Feld, das hier dazukommt, kommt dort dazu, sonst teilen Pools einen Descriptor über eine Änderung an diesem Feld hinweg.
  8. **`hot-path.bench.ts`**, Test `generated setters across vertex object descriptors`:
     - Kommentar `:70–71` ersetzen: pools handed the same descriptor share its prototype, and so do pools built from the same description object; `description(k)` builds a new object on every call, so each of the six pools below builds a descriptor and a prototype of its own.
     - Neu neben `makeWriter()` (`:57–63`): ein Writer für alle Pools, der die Schleife über die Pools selbst trägt und den Rundenzähler aus seinem Zustand liest:
       ```ts
       interface WriterState {
         n: number;
         readonly lists: readonly (readonly PositionVO[])[];
       }

       const makeWriterForAll = (): ((state: WriterState) => void) =>
         new Function(
           'state',
           `// writer ${writers++}\nconst n = ++state.n; const lists = state.lists;\nfor (let k = 0; k < lists.length; k++) { const vos = lists[k]; for (let i = 0; i < vos.length; i++) { const vo = vos[i]; vo.x = i + n; vo.y = n; vo.z = i; } }`,
         ) as (state: WriterState) => void;
       ```
       Kommentar darüber (Englisch, Präsens): the writer for all pools is itself the function the bench calls, bound to its state. A writer the bench function calls at a call site of its own is inlined into it, and V8 then runs the loop of the writer in code that does not inline the accessors — six pools of one prototype take about 38 ns per object in that shape, against about 3 ns for a writer per pool, which would hide what the variant is there to show.
     - Neu, nach `sixPools` (`:73`): `const describedPools = Array.from({length: 6}, () => new VertexObjectPool<PositionVO>(sharedDescription, 10_000));` mit `const sharedDescription = description(0);` davor, `const describedVOs = describedPools.map((pool) => fillPool(pool, 10_000));`, und vor dem ersten `bench(...)` eine deterministische Prüfung `expect(new Set(describedPools.map((pool) => pool.descriptor)).size).toBe(1);` (`expect` aus `vitest` importieren) — ohne sie mäße die Variante bei gebrochenem Teilen still den megamorphen Fall.
     - Reihenfolge der vier Varianten, jede per `bench(...).run(options)`, kein `bench.compare()`:
       1. `six pools, one descriptor` — unverändert
       2. `six pools, six descriptors` — unverändert
       3. neu `six pools, one description, one writer for all` — `await bench('six pools, one description, one writer for all', makeWriterForAll().bind(null, {n: 0, lists: describedVOs})).run(options);`, Kommentar: six pools built from one description object share one prototype, so one writer for all of them sees one prototype
       4. `six pools, six descriptors, one writer for all` — auf dieselbe Form umgestellt: `makeWriterForAll().bind(null, {n: 0, lists: sixVOs})`, `writeAll` (`:95`) entfällt, der Kommentar `:93–94` bleibt sinngemäß. Nach 3., weil ihr Lauf die Caches der Accessoren megamorph macht.
     - `describedPools` in die `dispose()`-Schleife (`:101`) aufnehmen.
  9. **`docs/architecture.md`**, der Satz `:87–89` (»Every pool built from a description builds a descriptor and a prototype of its own, … pools handed the same `VertexObjectDescriptor` share its prototype.«) wird ersetzt, Umbruch bei höchstens 94 Zeichen wie die Nachbarzeilen, kein Codeblock:

     > Pools built from the same description object share one descriptor and with it one prototype:
     > the first of them builds the descriptor, and every later one takes it over as long as the
     > description still describes what it did then — a description changed in the meantime gets a
     > descriptor of its own, and the pools built before keep theirs. `new VertexObjectDescriptor()`
     > always builds a new one, and pools handed the same descriptor share it. The sprite and tile
     > geometries build their pools from the description constants of their modules, so one loop
     > over the sprites of several geometries of one type sees one prototype — in the bench, one
     > writer for six pools of one description runs as fast as a writer per pool. A
     > `TexturedSpritesGeometry` built with `attributeUsage` copies the sprite description and shares
     > its prototype with no other geometry.

     Stimmt der Bench-Wert der neuen Variante nicht (siehe Verify), wird der Halbsatz »runs as fast as a writer per pool« nicht geschrieben, sondern das Paket geparkt.
  10. **`CHANGELOG.md`** `[Unreleased]` → `### Changed`, ein Eintrag direkt nach `:214` (`new VertexObjectDescriptor()` copies …), nach dem Skill `updating-changelog` (vorher laden), Präsens, ohne »now«/»instead of«/»as before«: pools built from the same description object share one `VertexObjectDescriptor` and with it the prototype of their vertex objects, as long as the description still describes what it did when the first of them was built; a description changed since then gets a descriptor of its own, and the pools built before keep theirs. It holds for `new VOBufferPool()`, `new VertexObjectPool()`, every geometry that builds its pools from a description and `InstancedVOBufferGeometry#attachInstancedPool()`, and with them for `TexturedSpritesGeometry` — from a capacity number or from parameters without `attributeUsage` —, `AnimatedSpritesGeometry` and `TileSpritesGeometry`: one loop over the sprites of several geometries of one type sees one prototype. A property added to the prototype of a vertex object reaches the vertex objects of every pool built from the same description. `new VertexObjectDescriptor()` builds a descriptor of its own on every call. Kein Migration Guide: keine Signatur ändert sich, kein Aufruf hört auf zu funktionieren.
- Verify: `pnpm run ci && pnpm bench`, danach die vier Mittelwerte aus `packages/twopoint5d/bench-results/results.json` lesen (Werte in ms je Iteration, eine Iteration schreibt 60 000 VOs):

  ```bash
  node -e "const r=require('./packages/twopoint5d/bench-results/results.json');const m={};(function w(o){if(Array.isArray(o))o.forEach(w);else if(o&&typeof o==='object'){if(typeof o.name==='string'&&o.latency)m[o.name]=o.latency.mean;Object.values(o).forEach(w)}})(r);const n=['six pools, one descriptor','six pools, six descriptors','six pools, one description, one writer for all','six pools, six descriptors, one writer for all'].map(k=>m[k]);console.log({nsPerVO:n.map(x=>x===undefined?'-':(x*1e6/60000).toFixed(2)),sixVsOne:(n[1]/n[0]).toFixed(2),oneDescriptionVsOne:(n[2]/n[0]).toFixed(2),oneWriterVsOne:(n[3]/n[0]).toFixed(2)})"
  ```

  Erwartet (Zug 0, Node 24.21, tinybench 6.1.4 mit denselben Optionen, Teilen über einen gemeinsamen Descriptor nachgestellt): 3,04 / 3,09 / 3,05 / 55,0 ns/VO, `sixVsOne` um 1,02, `oneDescriptionVsOne` um 1,00, `oneWriterVsOne` um 18. Liegt `oneDescriptionVsOne` bei 1,5 oder darüber, trägt die Doku-Aussage nicht: Paket mit `question` parken, die vier Werte in die Rückgabe. Die vier Werte und die drei Quotienten gehören in die `Ergebnis:`-Zeile.
- Commit: `perf: let the pools of one description share its descriptor and prototype` — Body (Englisch, ohne Finding-IDs, ohne Rückblick im Code, die Historie gehört hierher): a pool handed a description looks its descriptor up by the identity of that description object and takes over the descriptor an earlier pool built from it, as long as the description still describes the same attributes, indices, vertex count, base prototype and methods; a changed description gets a descriptor of its own · `attachInstancedPool()` goes through the same lookup, and `TexturedSpritesGeometry` hands its pools the sprite description itself unless `attributeUsage` asks for a copy · one loop over the sprites of several geometries of one type sees one prototype: in the accessor bench one writer for six pools of one description runs at the speed of a writer per pool, where six descriptors take about eighteen times as long · the "one writer for all" bench variants run the writer as the bench function itself, since a writer inlined into the bench callback is measured in code that does not inline the accessors
- Verlauf:
  - 2026-09-27 Zug 0: Detailplan steht · `VOBufferPool.ts:82` unverändert (`descriptor instanceof VertexObjectDescriptor ? descriptor : new VertexObjectDescriptor(descriptor)`) · `InstancedVOBufferGeometry.ts:259` unverändert · gegen `dist/` (5dcd7acf) bestätigt: je zwei `TexturedSpritesGeometry(10)`, `TexturedSpritesGeometry({capacity: 10})`, `AnimatedSpritesGeometry(10)`, `TileSpritesGeometry(10)` und zwei `VertexObjectPool` aus einem Description-Objekt haben verschiedene Descriptoren und Prototypen · alle Description-Pfade laufen durch `VOBufferPool.ts:82`, einzige Ausnahme `attachInstancedPool()` · aufgenommen: `TexturedSpritesGeometry.ts:59–73` (Parameter-Objekt ohne `attributeUsage` klont) · keine offenen `Folgen:` im Plan (Pakete 2b, 3, 4, 5 ohne Folgen) · kein weiterer Queue-Eintrag teilt die Ursache · Bench-Form geändert nach Messung (siehe unten) · Restplan: nach 5b nur der Abschluss, keine Umsortierung; die fünf `→ Audit`-Einträge der Queue bleiben für ihn · Messskripte `paket-5b.zug0-*.mjs` im Arbeitsverzeichnis · Arbeitsbaum sauber
  - 2026-09-27 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-5b.impl-0.json`
  - 2026-09-27 Zug 2: Report FERTIG (Session 696b9710) · 3 neue, 12 geänderte Dateien, Arbeitsbaum schmutzig · 7 Regressionstests vor dem Fix rot · Verify läuft (`paket-5b.verify.log`)
  - 2026-09-27 Zug 2 Verify: `pnpm run ci && pnpm bench` (ohne Nx-Cache) exit=0, `paket-5b.verify.log` · Bench 3,05 / 3,14 / 3,13 / 55,46 ns/VO, sixVsOne 1,03, oneDescriptionVsOne 1,02, oneWriterVsOne 18,16
  - 2026-09-27 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-5b.diff`, Report nach `paket-5b.review-0.json`
  - 2026-09-27 Zug 3: Reviewer (Session 57951f8e) freigegeben, alle Punkte des Befunds erfüllt, drei kleine Befunde · Diff `paket-5b.diff`
  - 2026-09-27 Zug 4: keine Runde (keine kritischen oder wichtigen Befunde)
  - 2026-09-27 Zug 5: Commit 5e4ede07 `perf: let the pools of one description share its descriptor and prototype`, Trailer `Remediation-Run: 2026-09-27`; Verify aus Zug 2 trägt ihn (keine Änderung seither)

## Befund im Volltext

**`packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:82` · low · aus Zug 0 von Paket 3 · `→ Scope`** —
jeder Pool, der eine Description bekommt, baut einen eigenen `VertexObjectDescriptor` und damit einen eigenen
Prototyp; `TexturedSpritesGeometry` (`sprites/TexturedSprites/TexturedSpritesGeometry.ts:61–75`) und
`AnimatedSpritesGeometry` (`sprites/AnimatedSprites/AnimatedSpritesGeometry.ts:24`) übergeben die
Description-Konstante, jede Sprite-Geometrie hat also eigene VO-Maps. Code, der mehrere Geometrien eines Typs
bedient — eine Update-Schleife über mehrere Ebenen, die Methoden des `basePrototype` wie
`TexturedSprite#setPosition()` —, sieht ab fünf Geometrien mehr als vier Maps und wird megamorph: die
Bench-Variante `six pools, six descriptors, one writer for all` aus Paket 3 misst den Mechanismus mit ×18 je VO.
Vorbestehend (`git show 05d723d7:…/VOBufferPool.ts`, Z. 82 gleichlautend). Ein Fix (etwa ein Descriptor je
Description) ändert, wann spätere Änderungen an einer Description noch greifen, und den Absatz zu den
Accessoren in `packages/twopoint5d/docs/architecture.md` aus Paket 3.

Präzisierung aus Zug 0 von Paket 5b: die Methoden des `basePrototype` sind **kein** Fall — V8 inlint
`TexturedSprite#setPosition()` in die Schleife, die sie ruft, und kennt dort die Map des Empfängers; eine
Schleife je Geometrie über sechs Geometrien kostet mit einem Descriptor 5,84, mit sechs 5,83 ns/VO. Teuer ist
allein die eine Aufrufstelle, die die Vertex-Objekte von mehr als vier Prototypen sieht.

## Messungen aus Zug 0

Node 24.21, gegen `packages/twopoint5d/dist/lib` (Stand 5dcd7acf); Teilen ist über einen gemeinsamen
`VertexObjectDescriptor` nachgestellt, das liefert eine Description nach dem Fix. Skripte im Arbeitsverzeichnis.

- tinybench 6.1.4, `{time: 500, warmupTime: 200}` wie `hot-path.bench.ts`, Vitest reicht die Bench-Funktion
  unverändert an tinybench (`vitest/dist/chunks/index.m3L2HgmY.js:8098`) — `paket-5b.zug0-tinybench2.mjs`:
  one descriptor 3,04–3,05 · six descriptors 3,09 · **one description, one writer for all 3,04–3,05** ·
  six descriptors, one writer for all 54,98–55,03 ns/VO.
- Dieselbe Reihenfolge, der Writer aber aus dem Bench-Callback gerufen wie heute `writeAll` (`:95–99`) —
  `paket-5b.zug0-tinybench.mjs`: one description, one writer for all **38,5** ns/VO bei einem einzigen
  Prototyp, six descriptors 54,1–54,4. Ursache: der monomorphe Aufruf inlint den Writer in den Callback, und
  V8 lässt seine Schleife dann in Maglev-Code laufen, der die Accessoren nicht inlint; mit `--no-maglev`
  3,05 gegen 54,4 (`paket-5b.zug0-bench.mjs`), ein Writer auf oberster Ebene gerufen 2,9
  (`paket-5b.zug0-calls.mjs`). Deshalb ruft die Bench beide »one writer for all«-Varianten als gebundene
  Bench-Funktion (Schritt 8); die bestehende Variante 4 misst in der neuen Form dasselbe wie in der alten
  (55,0 gegen 54,6 aus Paket 3), der Faktor 18 im Doku-Absatz bleibt richtig.
- `TexturedSprite#setPosition()`, sechs Pools, ein Writer je Pool — `paket-5b.zug0-sprites.mjs`: ein
  Descriptor 5,84–5,90, sechs Descriptoren 5,83–5,91, sechs `TexturedSpritesGeometry` 5,45 ns/VO.

## Urteil des Reviewers (Zug 3, Runde 0)

Gesamturteil: freigegeben. Eigene Läufe des Reviewers: 16 Spec-Dateien, 285 Tests grün; Verify-Log gegengelesen.

- Pools aus demselben Description-Objekt teilen Descriptor und Prototyp — behoben: `VOBufferPool.ts:91` über `sharedVertexObjectDescriptor()` (`sharedVertexObjectDescriptor.ts:15–29`), Nachweis `VertexObjectPool.spec.ts:126–132`.
- Geänderte Description bekommt einen eigenen Descriptor — behoben: `sharedVertexObjectDescriptor.ts:24`, Nachweis `VertexObjectPool.spec.ts:141–154`; ein werfender Konstruktor cacht nichts (`:163–172`).
- `attachInstancedPool()` — behoben: `InstancedVOBufferGeometry.ts:259`, Import `import type` (`:8`), Nachweis `InstancedVertexObjectGeometry.spec.ts:104–116`.
- `TexturedSpritesGeometry` ohne `attributeUsage` — behoben: `TexturedSpritesGeometry.ts:65`, JSDoc `:36–39`, Specs `TexturedSpritesGeometry.spec.ts:124–158`, `AnimatedSpritesGeometry.spec.ts:26–36`, `TileSpritesGeometry.spec.ts:20–30`.
- `sameVertexObjectDescription` — alle 22 Änderungsarten der Paketdatei in `test.each`; Feld-für-Feld gegen `cloneVertexObjectDescription.ts:103–127` gehalten, kein Pfad zu einem falschen `true` gefunden.
- Bench-Variante `hot-path.bench.ts:92–102` mit deterministischer Descriptor-Prüfung; Doku `docs/architecture.md:87–97`; CHANGELOG `CHANGELOG.md:215`; Kommentar `cloneVertexObjectDescription.ts:84–87`.

Kleine Befunde (lösen keine Runde aus):
1. `sharedVertexObjectDescriptor.ts:24` — die Konstruktorregel, dass kein Accessor-Name auf dem `basePrototype` stehen darf, wird für einen Descriptor aus dem Cache nicht erneut geprüft; bekommt der `basePrototype` nach dem ersten Pool eine kollidierende Eigenschaft, werfen spätere Pools nicht. Beim geteilten Descriptor war das immer so. Optional ein Satz in der JSDoc.
2. `TexturedSpritesGeometry.ts:67–69` — drei `capacity.attributeUsage?.` im Klon-Zweig überflüssig (Paketdatei verlangte den Klon-Aufruf unverändert).
3. `TexturedSpritesGeometry.ts:65` — `attributeUsage: {}` klont weiter und teilt nicht; von der JSDoc korrekt beschrieben.

Abweichungen des Implementierers (vom Reviewer getragen): Cast `description as VertexObjectDescription` in `sharedVertexObjectDescriptor.ts` (Konstruktor typisiert nur die lebende Form; `readonly number[]`), Non-null-Assertions wegen `noUncheckedIndexedAccess`, Testnamen `%s is not the same`, ein Satz mehr im Bench-Kommentar zur Variante 4.
