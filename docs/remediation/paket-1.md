# Paket 1 — Die Description eindeutig machen: `meshCount` streichen, jedes Feld benennen, den Descriptor gegen spätere Änderungen sichern

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-048 (low), API-052 (low), API-053 (low), IMPL-001 (low, nur der
  vertex-objects-Teil), DOC-022 (info)
- Ziel: Was eine `VertexObjectDescription` bedeutet, steht dokumentiert und
  widerspruchsfrei in den Typen — ohne das Feld, dessen Semantik sich nie
  entschieden hat.
- Modell: stärkste Stufe
- Effort: high
- Verify: `pnpm run ci`

**Sprache:** dieses Dokument ist Deutsch, alles Geschriebene ist Englisch —
Code, TSDoc, Inline-Kommentare, CHANGELOG-Einträge, Commit-Message.

## Dateien

Quellen der Bibliothek:

- `packages/twopoint5d/src/vertex-objects/types.ts`
- `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`
- `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.ts`
- `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts`
- `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts` (nur ein
  TSDoc-Absatz)
- `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts` (nur ein TSDoc-Satz)
- `packages/twopoint5d/src/vertex-objects/public-api.ts`
- `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`
  (nur die Import-Zeile)

Descriptions, die `meshCount: 1` tragen — je eine Zeile:

- `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts:60`
- `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprite.ts:31`
- `packages/twopoint5d/src/map2d/TileSprites/descriptors.ts:73`
- `apps/lookbook/src/pages/demos/instanced-quads.astro:79`
- `apps/lookbook/src/demos/instanced-quads/InstancedQuadsGeometry.ts:77`
- `packages/twopoint5d-testing/test/vertex-objects-heap.test.js:37`
- `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js:37, 42, 252`
- `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js:47`

Specs:

- `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts`
- `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.spec.ts`
- `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`
- `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:147`
- `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts:38, 85, 97, 109, 959, 1228`

Dazu `packages/twopoint5d/CHANGELOG.md`.

## Vorgehen

### 1. `meshCount` und `getInstanceCount()` ersatzlos streichen

Das Feld hat drei widersprüchliche Lesarten: Faktor in
`initializeInstancedAttributes`, kein Faktor in
`InstancedVOBufferGeometry#update()` (dort `instanceCount = usedCount`),
Division in `getInstanceCount()`. Keine produktive Description setzt es auf
etwas anderes als `1`. Es verschwindet vollständig.

1. `types.ts`: das Feld `meshCount?: number;` aus `VertexObjectDescription`
   entfernen.
2. `VertexObjectDescriptor.ts`:
   - im TSDoc des Konstruktors die Regel »2. `meshCount`, when given, is a
     positive integer (`RangeError`)« entfernen und die folgenden Regeln neu
     durchnummerieren.
   - in `#validate()` die Destrukturierung auf `const {vertexCount} =
     this.description;` verkürzen und den `meshCount`-Block samt `RangeError`
     entfernen.
   - den Getter `get meshCount(): number` entfernen.
   - `getInstanceCount(capacity: number): number` samt TSDoc und dem darin
     stehenden `TODO remove?!` entfernen.
3. `cloneVertexObjectDescription.ts`: die Zeile `meshCount:
   description.meshCount,` aus dem `target`-Objekt entfernen.
4. `initializeAttributes.ts`: in `initializeInstancedAttributes()` die Zeilen
   `// every instanced attribute advances once per mesh of the descriptor` und
   `const meshPerAttribute = pool.descriptor.meshCount;` entfernen und das
   letzte Argument beider Konstruktoraufrufe weglassen —
   `new InstancedInterleavedBuffer(array, itemSize)` und
   `new InstancedBufferAttribute(array, itemSize, normalized)`. three.js setzt
   `meshPerAttribute` in beiden Fällen selbst auf `1`; ein Kommentar, der nur
   diesen Default nacherzählt, kommt nicht an seine Stelle.
5. `InstancedVOBufferGeometry.ts`, im TSDoc von `attachInstancedPool()`: den
   Satz »This can be very useful if you have instanced attributes that have a
   different _meshCount_ than that of the default `.instancedPool`.« entfernen.
   Der Folgesatz beginnt heute mit »Or you have grouped …« und wird zu einem
   eigenständigen Satz umformuliert, der ohne den gestrichenen auskommt.
6. Aus jeder Description in der Dateiliste oben die Zeile `meshCount: 1,`
   entfernen, samt der Leerzeile, die sie dort teils von den `attributes`
   trennt.
7. Specs:
   - `VertexObjectDescriptor.spec.ts`: die Zeile
     `expect(descriptor.getInstanceCount(3)).toBe(3);` aus »construct with
     vertexCount and indices« entfernen; den Test »construct with meshCount«
     ganz entfernen — »construct with attributes only« prüft dieselben
     Default-Aussagen (`vertexCount === 1`, `hasIndices` falsy, leere
     `indices`, `attributeNames`, `bufferNames`); den Test »a meshCount that is
     not a positive integer« ganz entfernen.
   - `cloneVertexObjectDescription.spec.ts`: `meshCount: 1,` aus den Fixtures
     entfernen und jedes `expect(clonedDesc.meshCount).toBe(1);` mit streichen.
   - `InstancedVertexObjectGeometry.spec.ts`: `meshCount: 1,` bzw.
     `meshCount: 2,` aus `instancedDescriptor`, `extraInstancedDescriptor` und
     `secondExtraInstancedDescriptor` entfernen. Keine Assertion dieser Datei
     liest `meshPerAttribute` oder `getInstanceCount`.
   - `VertexObjectPool.spec.ts:147`: `{meshCount: 1, attributes:
     descriptor.attributes}` zu `{attributes: descriptor.attributes}`.
   - `vertex-buffers-geometry-updates.spec.ts`: die sechs `meshCount: 1,`-Zeilen
     entfernen.

### 2. Jedes Feld der Description-Typen dokumentieren

TSDoc in `types.ts`, englisch, an jedem Feld, das heute keines hat. `autoTouch`
hat bereits eines und bleibt, wie es ist.

- `VADescription`: `type` (Vorgabe `'float32'`), `normalized`, `usage` (Vorgabe
  `'static'`), `bufferName` (Vorgabe `` `${usage}_${type}${normalized ? 'N' :
  ''}` `` — Attribute, die sich einen Namen teilen, teilen sich einen
  interleaved Buffer).
- `VAComponentsDescription#components` und `VASizeDescription#size`: die beiden
  Wege, die Größe eines Attributs anzugeben. Wer beides angibt, gibt höchstens
  so viele Komponenten an wie `size`; weniger füllen das Attribut auf seine
  Größe auf. Gesagt wird dabei auch, dass die Komponentennamen zu Properties des
  Vertex-Objekts werden — bei `vertexCount > 1` mit angehängtem Vertex-Index.
- `VertexAttributeMethods#getter` und `#setter`, und hier die überraschende
  Semantik ausdrücklich: ein **fehlender** Schlüssel erzeugt den Standardnamen
  (`get`/`set` plus PascalCase des Attributnamens), ein **vorhandener**
  Schlüssel mit einem falsy Wert — `false`, `undefined`, `null` — unterdrückt
  den Accessor ganz, ein String benennt ihn. `{getter: undefined}` ist also
  nicht dasselbe wie ein Objekt ohne `getter`. Nachlesbar in
  `VertexAttributeDescriptor#getterName`/`#setterName`, die über `'getter' in
  this.description` entscheiden.
- `VertexObjectDescription`: `vertexCount` (Vorgabe `1`), `indices` (Indizes in
  `0 … vertexCount - 1`, gemeinsam für alle Objekte des Pools), `attributes`,
  `basePrototype` (der Prototyp, unter dem die generierten Accessoren hängen),
  `methods` (Funktionen, die als Properties auf dem Vertex-Objekt landen; nur
  Werte vom Typ Funktion werden übernommen).

### 3. Das `attributeName`-TODO auflösen

`types.ts`: der Kommentar `// TODO add optional attributeName? to VADescription`
in `VADescription` wird **ersatzlos gestrichen**, ohne Ersatzfeld.

Begründung: `initializeAttributes()` reicht den Schlüssel der Description als
three.js-Attributnamen weiter (`geometry.setAttribute(attrDesc.name, attr)`),
und die Zuordnung zum Buffer regelt `bufferName` bereits. Eine zweite,
entkoppelte Namensebene hat im Repo keinen Aufrufer und keinen Bedarf. Ein TODO
in einem exportierten Interface eines veröffentlichten Pakets ist ein
Versprechen ohne Deckung; es hat seit dem letzten Audit unverändert dort
gestanden.

Die fünf weiteren Marker desselben Findings liegen in `texture`, `display`,
`map2d` und `stage` und sind **nicht** Teil dieses Pakets. Sie bleiben
unangetastet.

### 4. `cloneVertexObjectDescription` benennen und veröffentlichen

1. `cloneVertexObjectDescription.ts`: aus dem anonymen Default-Export wird
   `export function cloneVertexObjectDescription(source, attributeUsage?)` mit
   denselben Parametern und demselben Rückgabetyp. Der Default-Export entfällt.
   Die Funktion bekommt TSDoc: was sie kopiert (Struktur samt
   Attribut-Beschreibungen und `indices`-Array), was sie per Referenz übernimmt
   (`basePrototype`) und wozu `attributeUsage` samt `alias` dient.
2. `public-api.ts` des Moduls: `export * from './cloneVertexObjectDescription.js';`
   aufnehmen, alphabetisch einsortiert — nach `'./VertexObjects.js'` und vor
   `'./constants.js'`.
3. Die beiden Import-Stellen auf den benannten Import umstellen:
   `sprites/TexturedSprites/TexturedSpritesGeometry.ts:1` und
   `cloneVertexObjectDescription.spec.ts:4`.

### 5. Der Descriptor hält eine Description, die ihm gehört

Heute hält `VertexObjectDescriptor` die übergebene Description per Referenz, und
`vertexCount`, `indices`, `hasIndices` sowie die Roh-Zugriffe in `#validate()`
lesen sie live. Wer sie nach `new VertexObjectDescriptor()` ändert, umgeht
sämtliche Konstruktor-Prüfungen. Dasselbe gilt eine Ebene tiefer:
`VertexAttributeDescriptor` hält die Beschreibung seines Attributs ebenfalls per
Referenz, sodass eine nachträglich geänderte `usage` den bereits gebauten
`bufferNames`-Satz des Descriptors widerlegt.

Umsetzung im Konstruktor von `VertexObjectDescriptor`, als **erste** Anweisung:

```ts
this.description = cloneVertexObjectDescription(description);
```

Alles Weitere — die `VertexAttributeDescriptor`-Schleife, `basePrototype`,
`methods`, `#validate()` — liest danach ausschließlich `this.description`, also
die Kopie. Die Schleife tut das heute schon; `basePrototype` und `methods`
werden auf `this.description.basePrototype` bzw. `this.description.methods`
umgestellt.

Ein Inline-Kommentar sagt das Warum: die Kopie hält die Prüfungen dieses
Konstruktors gültig, weil eine spätere Änderung an der übergebenen Description
den Descriptor nicht mehr erreicht.

Das TSDoc des Feldes `description` hält fest, dass es die eigene Kopie des
Descriptors ist und eine Änderung an dem Objekt, das der Konstruktor bekam,
nichts mehr bewirkt.

Zum Import: `cloneVertexObjectDescription.ts` importiert seinerseits
`VertexObjectDescriptor` für seinen `instanceof`-Test. Der dadurch entstehende
Zyklus ist unproblematisch und bleibt unkommentiert — beide Module werten auf
Top-Level nur Definitionen aus und greifen erst im Funktionsaufruf auf das
Binding der Gegenseite zu. Der Lint dieses Repos kennt keine Zyklus-Regel.

Regressionstest in `VertexObjectDescriptor.spec.ts`, **vor** dem Fix rot: eine
Description bauen, den Descriptor bauen, danach `vertexCount`, `indices` und die
`usage` eines Attributs am Ursprungsobjekt ändern und prüfen, dass
`descriptor.vertexCount`, `descriptor.indices` und
`descriptor.getAttribute(…)!.usageType` unverändert antworten.

### 6. Ein generierter Accessor überschattet keine Property des `basePrototype`

`createVertexObjectPrototype()` legt die generierten Accessoren auf ein Objekt,
dessen Prototyp `descriptor.basePrototype` ist. Ein gleichnamiges Member des
`basePrototype` wird heute stumm überschattet, während dieselbe Kollision unter
`methods` wirft.

Umsetzung in `VertexObjectDescriptor.#validate()`, als **letzter** Schritt nach
der bestehenden `origins`-Schleife — die Reihenfolge der Regeln ist im TSDoc
festgeschrieben und wird eingehalten:

- Ist `this.description.basePrototype` weder `null` noch `undefined`, dessen
  Prototypkette ablaufen — beginnend beim `basePrototype` selbst, über
  `Object.getPrototypeOf()` weiter, und **vor** `Object.prototype` abbrechen.
- Je Stufe `Object.getOwnPropertyNames()` nehmen; Symbole bleiben außen vor, weil
  die generierten Accessoren ausschließlich String-Namen tragen.
- Jeder so gefundene Name, der in `origins` steht, wirft ein `Error` im Stil der
  bestehenden Meldung, etwa: `` VertexObjectDescriptor: the vertex object
  property "${name}" from ${origin} would shadow a property of the
  basePrototype ``.

`Object.prototype` bleibt ausgenommen: eine Description mit einem Attribut
namens `toString` oder `valueOf` überschattet diese Namen auch ohne
`basePrototype`, weil `createVertexObjectPrototype()` dann auf
`Object.prototype` aufbaut — die Regel würde sonst Descriptions ablehnen, die
nie ein Problem hatten. Aus demselben Grund fällt `constructor` mit weg, sobald
die Kette vor `Object.prototype` endet — es sei denn, es steht als eigene
Property auf dem `basePrototype` selbst, was bei jedem Klassen-Prototyp der Fall
ist und dann auch gemeldet werden soll.

Ins TSDoc des Konstruktors kommt die Regel als letzter Listenpunkt, und
`basePrototype` in `types.ts` bekommt den Satz dazu, dass ein Name, den ein
generierter Accessor belegen würde, dort nicht stehen darf.

Regressionstest in `VertexObjectDescriptor.spec.ts`, **vor** dem Fix rot, im
bestehenden `describe('refuses a description the layout cannot hold')`: je ein
Fall für eine Kollision mit einer eigenen Property des `basePrototype` und einen
über eine Stufe geerbten Namen, dazu ein Fall, der belegt, dass ein Name von
`Object.prototype` (`toString`) weiterhin durchgeht.

**Vorsicht beim Verify:** die vier produktiven Descriptions mit `basePrototype`
— `TexturedSpriteDescriptor`, `AnimatedSpriteDescriptor`, `BaseSpriteDescriptor`
und die beiden in `map2d/TileSprites/descriptors.ts` — müssen die neue Regel
passieren. Sie tun es nach Lage des Codes; `pnpm run ci` ist der Beweis. Schlägt
eine an, ist das ein echter Befund und kein Grund, die Regel aufzuweichen: dann
kommt er in den Report.

### 7. Ein »should«, das der Code als »must« durchsetzt

`VOBufferPool.ts`, im TSDoc von `fromBuffersData()`: die erste Zeile lautet
heute »NOTE: The capacity should be the same as the original pool.« Der Code
lässt keine Wahl — `fromBuffersData()` wirft bei jeder abweichenden Kapazität
`new Error('Invalid buffersData capacity')`. Aus »should« wird »must«, und der
geworfene Fehler steht im selben Satz.

### 8. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, unter `## [Unreleased]`, Keep a Changelog
1.1.0. Der Skill `updating-changelog` trägt die Regeln — lade ihn, bevor du hier
schreibst.

- **Removed** (Breaking Change, braucht einen Migrationshinweis): `meshCount`
  aus `VertexObjectDescription`, `VertexObjectDescriptor#meshCount` und
  `VertexObjectDescriptor#getInstanceCount()`. Der Migrationshinweis sagt, dass
  das Feld aus jeder Description ersatzlos verschwindet und ein Wert `> 1` nie
  durchgängig gewirkt hat, und dass `instanceCount` einer instanzierten
  Geometrie der `usedCount` ihres Pools ist.
- **Added**: `cloneVertexObjectDescription` als benannter Export in der
  öffentlichen API des Moduls.
- **Changed**: `VertexObjectDescriptor` kopiert die Description, die er bekommt,
  sodass spätere Änderungen an ihr ihn nicht mehr erreichen. Und: eine
  Description, deren generierter Accessor eine Property ihres `basePrototype`
  überschatten würde, wird abgelehnt — bisher gewann stumm der Accessor.

## Commit

```
refactor(vertex-objects,sprites,map2d,lookbook): drop the mesh count a description never settled, say what its fields mean, and let a descriptor own the description it checked

A `meshCount` above 1 was read as a factor when the instanced attributes were
built, ignored when the instance count was written, and divided out again by
`getInstanceCount()`. No description in this repository set it to anything but
1, so the field, the descriptor getter and `getInstanceCount()` are gone rather
than reconciled. Every description in the library, the demos and the browser
tests loses the line that carried it.

Every remaining field of `VertexObjectDescription`, `VADescription` and the
accessor overrides now carries TSDoc, including the difference between an
absent `getter` key and one that is present and falsy.

A descriptor copies the description it is given, so that a later change to that
object cannot reach around the checks its constructor ran. A description whose
generated accessor would shadow a property of its `basePrototype` is refused,
the way a collision under `methods` already was.

`cloneVertexObjectDescription` is a named export and part of the module's
public api, and so is the `VertexAttributeUsageOverrides` type it takes.

The TSDoc of `VOBufferPool#fromBuffersData()` states the capacity rule as the
code enforces it: a capacity other than the original one throws.
```

## Verlauf

- 2026-09-20 Zug 0: Detailplan steht · Abgleich: alle fünf Findings unverändert
  vorhanden · API-048 an allen vier Teilstellen bestätigt (`types.ts:46, 68-75`,
  `VertexObjectDescriptor.ts:119-132`, `cloneVertexObjectDescription.ts:4`,
  `public-api.ts` ohne Klon-Export) · API-052 bestätigt
  (`VertexObjectDescriptor.ts:56` hält per Referenz, Getter lesen live) ·
  API-053 bestätigt (`createVertexObjectPrototype.ts:157`,
  `vertexObjectPropertyNames.ts` kennt den `basePrototype` nicht) · IMPL-001
  vertex-objects-Teil bestätigt (`types.ts:46`) · DOC-022 unverändert, aber von
  `VOBufferPool.ts:203` nach `:234` gewandert · API-003 aus diesem Paket
  herausgeschnitten und zu Paket 1b geworden · ein Nebenbefund in »Offene
  Befunde« gebucht (`createVertexObjectPrototype.ts:84/91`, verschatteter
  `methods`-Name)
- 2026-09-20 Zug 1: Implementierer beauftragt · Opus, Effort high · Brief
  `paket-1.impl-0.brief.txt` · Report `paket-1.impl-0.json`, Session
  `25dd9e16-fdd8-4df7-9e8c-a85ed5d5daa9`
- 2026-09-20 Zug 2: Report FERTIG · 22 Dateien geändert, keine neuen ·
  Regressionstests `answers from its own copy of the description` und die zwei
  `refuses a description the layout cannot hold`-Fälle vor dem Fix rot (3 failed
  | 21 passed) · Arbeitsbaum schmutzig · eigener Verify-Lauf `pnpm run ci`
  exit=0, alle zehn Schritte grün, Log `paket-1.verify.log`
- 2026-09-20 Zug 3: Reviewer Opus/high, Report `paket-1.review-0.json` · alle
  fünf Findings behoben mit Fundstelle · Qualität: 2 × wichtig (geteiltes
  `components`-Array im Klon, fehlender Migrationshinweis), 4 × klein · Diff
  `paket-1.diff` (1405 Zeilen, 22 Dateien)
- 2026-09-20 Zug 4 Runde 1: Resume derselben Session
  `25dd9e16-fdd8-4df7-9e8c-a85ed5d5daa9`, Opus/high, Profil unverändert · Brief
  `paket-1.impl-1.brief.txt`, Report `paket-1.impl-1.json` · 3 wichtige und 3
  kleine Befunde eingereicht, alle 6 zurückgemeldet · zwei neue
  Regressionstests vor dem Fix rot (2 failed | 31 passed) · Report
  FERTIG_MIT_VORBEHALT, Vorbehalt allein am Verify · eigener Verify-Lauf
  `paket-1.verify-r1.log` exit=1: neun von zehn Schritten grün, `test:browser`
  rot ohne Assertion-Fehler — Firefox bricht in `display-adopt-renderer` und
  `display-dispose` die Session ab, ein Fremdprozess hält 11946 von 12282 MiB
  VRAM; die vier vertex-objects-Browsertests laufen in demselben Lauf durch
- 2026-09-20 Zug 4 Runde 1 Review: Reviewer Opus/high, Report
  `paket-1.review-1.json`, Diff `paket-1.diff-r1` (1571 Zeilen) · alle sechs
  Befunde abgeräumt, alle fünf Findings weiterhin behoben, nichts
  zurückgedreht · kein kritisch, kein wichtig · Urteil: committable · offene
  Befunde von 3 wichtig auf 0 gesenkt
- 2026-09-20 Zug 5: der Verify-Lauf wartete rund zwei Stunden auf freien
  Grafikspeicher; nach dem Ende des Fremdprozesses (VRAM von 11946 auf 2131 MiB)
  lief `pnpm run ci` durch — `paket-1.verify-final.log`, exit=0, keine einzige
  Fehlermarkierung, alle zehn Schritte einschließlich `test:browser` grün ·
  22 Dateien gezielt gestaged, committet als `9e66de55`, Pre-Commit-Hooks liefen
  mit · Arbeitsbaum danach sauber bis auf Plan und Paketdatei, die ungetrackt
  bleiben

## Findings im Volltext

**API-048 · low · Öffentliche API · `packages/twopoint5d/src/vertex-objects/types.ts:25-28, 46, 68-76; VertexObjectDescriptor.ts:58-66; cloneVertexObjectDescription.ts:4-7; vertex-objects/public-api.ts`** — getInstanceCount() klären oder streichen, die Description-Typen dokumentieren, cloneVertexObjectDescription benennen und exportieren

`VertexObjectDescription` und `VADescription` sind die primären
Konfigurationstypen und tragen außer `autoTouch` kein TSDoc — `meshCount`,
`indices`, `basePrototype`, `methods`, `bufferName` und die
`getter`/`setter`-Overrides (mit ihrer überraschenden `getter: undefined` ≠
abwesend-Semantik) sind undokumentiert. `getInstanceCount()` ist exportiert, mit
»TODO remove?!« markiert (Vorlauf: DOC-021) und nur von seiner eigenen Spec
genutzt; seine Division durch `meshCount` widerspricht `update()`, das
`instanceCount = usedCount` ohne Multiplikation setzt.
`cloneVertexObjectDescription` ist ein anonymer Default-Export, nicht in
`public-api.ts`, wird aber von `TexturedSpritesGeometry.ts:1` deep-importiert —
ein Nutzer, der dieselbe Usage-Override-Kopie will, hat keinen öffentlichen Weg.

Empfehlung: Jedes Feld der beiden Interfaces dokumentieren; `attributeName`
umsetzen oder den TODO streichen; `getInstanceCount()` entfernen oder seine
Semantik gegen `meshCount` festlegen; `cloneVertexObjectDescription` zu einem
benannten Export machen und in `public-api.ts` aufnehmen.

**API-052 · low · Öffentliche API · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:55-56, 113-120`** — Festlegen, ob eine VertexObjectDescription nach dem Bau des Descriptors eingefroren ist

Der Descriptor hält `description` per Referenz; `vertexCount`, `meshCount` und
`indices` lesen sie live. Wer die Description nach `new VertexObjectDescriptor()`
ändert, umgeht die Prüfungen des Konstruktors. Aufgefallen im Remediation-Lauf
vom 2026-09-19, dort als Rückfrage offen geblieben: Ob eine Description nach dem
Bau als eingefroren gilt (kopieren oder `Object.freeze`) oder das Ändern ein
erlaubter Weg ist, ist nirgends festgelegt.

Empfehlung: Entscheiden. Eingefroren: im Konstruktor kopieren (es gibt
`cloneVertexObjectDescription`) oder einfrieren und die abgeleiteten Werte einmal
lesen. Erlaubt: im TSDoc sagen, dass spätere Änderungen ungeprüft bleiben.

**API-053 · low · Öffentliche API · `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:157-161`** — Festlegen, ob generierte Accessoren Properties des basePrototype überschatten dürfen

Die generierten Accessoren liegen auf einem Objekt, dessen Prototyp
`descriptor.basePrototype` ist; eine gleichnamige Property des `basePrototype`
wird stumm überschattet. Die Eindeutigkeitsprüfung des Descriptors deckt
Attribute, Komponenten und `methods` ab, den `basePrototype` nicht. Aufgefallen
im Remediation-Lauf vom 2026-09-19, dort als Rückfrage offen geblieben: Ob das
Überschatten ein Defekt ist (wie eine Kollision unter `methods`) oder ein
gewollter Override-Weg über die Prototypkette, ist nicht festgelegt.

Empfehlung: Entscheiden. Defekt: die Namen des `basePrototype` (eigene und
geerbte bis `Object.prototype`) in die Eindeutigkeitsprüfung aufnehmen. Gewollt:
im TSDoc von `basePrototype` festhalten, dass generierte Accessoren Vorrang
haben.

**IMPL-001 · low · Implementierungsstand · `packages/twopoint5d/src/texture/TexturePackerJson.ts:19; texture/TextureAtlasLoader.ts:88-91; display/Display.ts:430; vertex-objects/types.ts:46; map2d/chunk-quad-tree/DataIdsChunk2D.ts:39; stage/ParallaxProjection.ts:77`** — Die verstreuten TODO-Marker in ausgelieferten Code-Pfaden auflösen

Sechs Marker in der Kernbibliothek, alle vorbestehend: ein toter
Progress-Callback mit auskommentiertem Logging, der an `FileLoader` übergeben
wird; eine Design-Notiz (`// TODO add textureOptions: TextureClasses[]`) in einem
exportierten Interface; `// TODO check if this is still needed` im Display;
`// TODO add optional attributeName?` in `VADescription`; `// TODO support
compression`; `// TODO add jsdoc` über `getZoom()`. Klein, aber sie stehen in der
öffentlichen Oberfläche eines veröffentlichten Pakets.

Empfehlung: Je Marker entscheiden: umsetzen, als Issue auslagern oder streichen.
Für den Progress-Callback `undefined` übergeben.

> **In diesem Paket nur der vertex-objects-Teil**, also `types.ts:46`. Die fünf
> weiteren Marker liegen außerhalb des Scopes dieses Laufs und bleiben stehen.

**DOC-022 · info · Developer Experience · `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:203`** — Ein »should« im TSDoc, das der Code als »must« durchsetzt

Das TSDoc von `fromBuffersData()` beginnt mit »NOTE: The capacity should be the
same as the original pool«. Der Code lässt keine Wahl und wirft bei jeder
abweichenden Kapazität. Re-Check: unverändert.

Empfehlung: »should« durch »must« ersetzen und den geworfenen Fehler im selben
Satz nennen.

> **Abgleich 2026-09-20:** unverändert vorhanden, aber nach
> `VOBufferPool.ts:234` gewandert; der Wurf steht auf `:253`.

## Urteil des Reviewers je Finding-ID

Stand nach der Nachbesserungsrunde, Report `paket-1.review-1.json`. Der
Reviewer hat den Arbeitsbaum byte-identisch gegen den Diff gehalten und die
Regressionstests gegengeprüft, indem er den alten Ausdruck vorübergehend
zurückbaute.

- **API-048 · behoben**, alle vier Teilstellen. TSDoc an jedem Feld der
  Description-Typen (`types.ts:26-146`), die überraschende
  Schlüssel-statt-Wert-Semantik der Accessor-Overrides ausdrücklich
  (`types.ts:100-104`); `getInstanceCount()` und der `meshCount`-Getter aus
  `VertexObjectDescriptor.ts` verschwunden; `cloneVertexObjectDescription` als
  benannter Export (`cloneVertexObjectDescription.ts:39`) in `public-api.ts:12`
  zwischen `'./VertexObjects.js'` und `'./constants.js'`; beide Import-Stellen
  umgestellt (`TexturedSpritesGeometry.ts:1`,
  `cloneVertexObjectDescription.spec.ts:4`).
- **API-052 · behoben.** Die Kopie ist die erste Anweisung des Konstruktors
  (`VertexObjectDescriptor.ts:62-64`) mit dem Warum als Inline-Kommentar;
  `basePrototype`, `methods` und `#validate()` lesen ausschließlich sie
  (`:72-73, 79, 93`); Feld-TSDoc `:9-13`. Regressionstest
  `VertexObjectDescriptor.spec.ts:70-92` — `vertexCount`, `indices` und die
  `usage` eines Attributs werden nach dem Bau am Ursprungsobjekt geändert, der
  Descriptor antwortet unverändert; vor dem Fix an allen drei Assertions rot.
- **API-053 · behoben.** Shadow-Prüfung als letzter Schritt nach der
  `origins`-Schleife (`VertexObjectDescriptor.ts:118-136`), Kette ab
  `basePrototype` selbst, Abbruch vor `Object.prototype`, je Stufe nur
  `getOwnPropertyNames`. Regel 6 im Konstruktor-TSDoc (`:55-56`), Satz in
  `types.ts:136-139`. Vier Tests: eigene Property (`spec.ts:205`), geerbte
  (`:215`), aus `methods` (`:224`), `Object.prototype` geht durch (`:233`).
  Die fünf produktiven Descriptions mit `basePrototype` passieren die Regel
  (`spec.ts:240-252`); `TexturedSprite.prototype#getColor` kommt durch, weil
  das `color`-Attribut `getter: false` trägt.
- **IMPL-001 (nur der vertex-objects-Teil) · behoben.** Kein `TODO`-Marker mehr
  im Modul; `// TODO add optional attributeName? to VADescription` ersatzlos aus
  `types.ts` verschwunden. Scope gehalten — `TexturePackerJson.ts` und
  `Display.ts` tragen ihre Marker unverändert weiter.
- **DOC-022 · behoben.** `VOBufferPool.ts:234-235`: »must« statt »should«, und
  der geworfene Fehler steht im selben Satz, wörtlich deckungsgleich mit dem
  Wurf auf `:255`.

## Kleine Befunde, offen gelassen

Der Reviewer stufte sie als `klein` ein; sie lösen keine Nachbesserungsrunde aus
und stehen hier, weil sie sonst niemand mehr fände. Keiner davon muss vor dem
Commit fallen.

1. `packages/twopoint5d/src/vertex-objects/types.ts:136-139` — das TSDoc von
   `basePrototype` verspricht die Regel schmaler, als `#validate()` sie
   durchsetzt: »No name a generated accessor takes may appear on it«, während
   die Prüfung jeden Namen aus `origins` nimmt, also auch einen
   `methods`-Eintrag. Regel 6 im Konstruktor-TSDoc ist korrekt, nur dieser Satz
   bleibt dahinter zurück.
2. `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts:105`
   — der Kommentar verweist auf »layout rule 3 of the constructor«, eine
   Listenposition, die dieser Lauf gerade verschoben hat. Die Regel bei ihrer
   Sache zu nennen hält länger als ihre Nummer.
3. `VertexObjectDescriptor.spec.ts:97` und
   `cloneVertexObjectDescription.spec.ts:245` — die neuen Fixtures tragen
   `as never` auf `{size: 2, components: ['x', 'y']}`. Der Cast ist überflüssig
   und schaltet die Prüfung des ganzen Literals ab; der Reviewer hat ihn
   testweise entfernt, `tsc --noEmit` und die 260 Tests blieben grün. Das
   Muster steht seit vor diesem Lauf dreimal in derselben Datei (`:162`,
   `:168`, `:265`) — die Nachbesserung hat es nur fortgeschrieben.
4. `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:17-21`
   — `TexturedSpriteGeometryParameters#attributeUsage` hält weiter die anonyme
   Form `{dynamic?: string[]; stream?: string[]; static?: string[]}` nach,
   dieselbe Gestalt, die eine Datei weiter zu `VertexAttributeUsageOverrides`
   geworden ist, minus `alias`. `Omit<VertexAttributeUsageOverrides, 'alias'>`
   sagt dasselbe in einer Zeile. Die Paketdatei hatte dieser Datei nur die
   Import-Zeile zugestanden.
5. Commit-Message — der Reviewer wollte `VertexAttributeUsageOverrides` mit
   genannt haben, weil die Nachbesserung den Typ mit veröffentlicht. **Erledigt:
   der Halbsatz steht oben im Commit-Block.**

## Der rote `test:browser` und was dahintersteckt

Das Gate `pnpm run ci` endete auf dieser Maschine ab etwa 17:35 Uhr mit Exit 1,
ohne einen einzigen Assertion-Fehler: Firefox bricht in wechselnden
Renderer-lastigen Testdateien die ganze Session ab
(»Tests were interrupted because the browser disconnected«), begleitet von
`THREE.WebGPURenderer: Uncaptured WebGPU GPUOutOfMemoryError`. Gemessen, nicht
vermutet:

- Ein Fremdprozess (`SB-Win64-Shippi`, 8,4 GB RSS) hält 11946 von 12282 MiB
  VRAM. Der Arbeitsspeicher ist frei; die knappe Ressource ist der Grafikspeicher.
- Der Implementierer hat den Arbeitsbaum gestasht und `test:browser` auf dem
  unveränderten HEAD laufen lassen: ebenfalls Exit 1, drei abgebrochene
  Sessions. Danach `git stash pop`, der Stand byte-identisch zum gesicherten
  Patch.
- Die betroffenen Dateien wechseln von Lauf zu Lauf (`display-resize`,
  `hello-twopoint5d-canvas`, dann `display-dispose`, dann sieben Dateien). Ein
  Test, der an einer Änderung hängt, tut das nicht.
- Die vier Browser-Tests dieses Pakets — `vertex-objects-buffers-data`,
  `-dispose`, `-gpu-upload`, `-heap` — laufen in jedem dieser Läufe durch, auf
  beiden Ständen.
- Der Reviewer sieht im Diff nichts, was einen Browser-Test kippen könnte: der
  einzige verhaltensrelevante Eingriff ist das entfallene letzte
  Konstruktor-Argument in `initializeAttributes.ts:100-101`, und der alte Getter
  gab bei fehlendem Feld `1` zurück — genau den Wert, den three.js selbst als
  Default setzt.
