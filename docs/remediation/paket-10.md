# Paket 10 — Sprite-Features: FeatureSprites und SpriteFeature

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-029 (low), BUG-019 (low), READ-005 (low), TYPE-003 (low), CONS-006 (low), API-003 (low), API-011 (low), MEM-008 (low)
- Dazu (Zug 0): Nebenbefund gleicher Ursache wie API-003 — ein Feature, das nie durch
  `defineFeature()` lief, kommt außer über `defineSprite()` noch an drei Stellen ungeprüft
  herein: als Feature eines Passes (`checkPass()`, `src/sprites/passes/passFeatures.ts:24`, läuft
  in `definePass()` und in `passFeatures()`), als Placement-Tausch
  (`FeatureSpritesMaterial#placement`, `FeatureSpritesMaterial.ts:399`;
  `FeatureSprites#placement`, `FeatureSprites.ts:504`) und als Option `placement` von
  `new FeatureSprites()` (`resolveParts()`, `FeatureSprites.ts:156`, prüft sie gegen die Passes,
  bevor das Material sie sieht). Vorbestehend, dieselbe Ursache (`SpriteFeature` ist ein
  Interface, geprüft wird nur in `defineFeature()`), deshalb in dieses Paket.
- Ziel: Das Feature-Sprite-System prüft Features beim Eintritt, lädt auch nach einem werfenden Hook hoch, hält seine Caches begrenzt und seine Singletons wirklich unveränderlich.
- Modell: stärkste Stufe
- Effort: high — der Umbau berührt die öffentliche API an fünf Stellen (neue Abweisungen in
  `defineFeature()`/`defineSprite()`/`definePass()`/Placement-Tausch, eingefrorene Singletons,
  Obergrenze für `views`), dazu `FeatureSprites#update()` auf dem Frame-Pfad unter der
  Allokations-Spec. Jeder Wortlaut steht unten fest; zu entwerfen ist nichts.
- Hängt ab von: —
- Dateien:
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts`, `FeatureSprites.spec.ts`
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSpritesMaterial.ts`, `FeatureSpritesMaterial.spec.ts`
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSpritesGeometry.ts` (Specs `FeatureSpritesGeometry.spec.ts`, `FeatureSprites.grow.spec.ts` bleiben unverändert grün)
  - `packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts` (nur TSDoc am Feld `uniforms`)
  - neu `packages/twopoint5d/src/sprites/checkFeature.ts` (intern, nicht in `public-api.ts`)
  - `packages/twopoint5d/src/sprites/SpriteFeature.ts`, `SpriteFeature.spec.ts`
  - `packages/twopoint5d/src/sprites/defineSprite.ts`, `defineSprite.spec.ts`
  - `packages/twopoint5d/src/sprites/runCheckKind.ts` (neuer interner Export `thrownMessage()`)
  - `packages/twopoint5d/src/sprites/passes/passFeatures.ts`, `packages/twopoint5d/src/sprites/passes/definePass.spec.ts` (oder `pass-features.spec.ts`, wo die Abweisungen von `checkPass()` heute stehen)
  - `packages/twopoint5d/src/sprites/SpriteBase.ts`, `SpriteBase.spec.ts`
  - `packages/twopoint5d/src/sprites/GridBase.ts`, `GridBase.spec.ts`
  - `packages/twopoint5d/src/sprites/features/TableFrame.ts`, `features/TableFrame.spec.ts`
  - neu `packages/twopoint5d/src/utils/deepFreeze.ts` samt `deepFreeze.spec.ts` (intern, nicht in `src/utils/public-api.ts`)
  - `packages/twopoint5d-testing/test/sprites-shadow-pass.test.js` (ein neuer Test)
  - `packages/twopoint5d/docs/resource-lifecycle.md` (§3), `packages/twopoint5d/docs/sprites.md`
  - Proposals: `packages/twopoint5d/docs/proposals/sprite-features.md`, `sprite-uniform-bindings.md` (§3.1), `table-frames-and-palette-swap.md`, `pipeline-stages-and-grid-base.md`
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`, Migration Guide)
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: let FeatureSprites#update() upload its sprites behind a bound source or a visible hook that throws and name the source or the pass in the error, keep a material parameter handed in as undefined from overriding the one of the pass, check every feature that defineSprite(), definePass() and a placement swap take as defineFeature() does, and every field of it, freeze the shared features, bases and sprite kinds all the way down, take at most 64 views in tableFrame(), pair each uniform binding with the vector it writes, hand the descriptor of a growth to the geometry under a key of its own, and name the members that keep working after dispose() in the lifecycle rules`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · BUG-029 unverändert (`FeatureSprites.ts:597–613`) · BUG-019 unverändert (`FeatureSpritesMaterial.ts:117`) · READ-005 unverändert (`FeatureSpritesGeometry.ts:33/78/98`) · TYPE-003 unverändert (`FeatureSprites.ts:246–248/557/607`) · CONS-006 unverändert (`SpriteResources.ts:224/235/295`, `FeatureSpritesMaterial.ts:336/395`, `resource-lifecycle.md` §3 Z. 145–177) · API-003 unverändert (`SpriteFeature.ts:201–226`, `spritePipeline.ts:39`, `defineSprite.ts:222–230`, `spriteDeclarations.ts:117`) · API-011 unverändert (`SpriteFeature.ts:225`, `SpriteBase.ts:98`, `GridBase.ts:119`, `defineSprite.ts:255`) · MEM-008 unverändert (`GridBase.ts:80`, `TableFrame.ts:33/84`) · `src/sprites/` seit dem Audit-Stand 7341059f ohne Änderung · Nebenbefund gleicher Ursache (Features über Passes und Placement-Tausch) ins Paket · Folgen aus erledigten Paketen: keine offen · Queue: kein Eintrag mit gleicher Ursache · Restplan geprüft: unverändert (Pakete 11–13 berühren keine Datei dieses Pakets)
  - 2026-10-24 Zug 1: Implementierer beauftragt (Runde 0), Modell opus (stärkste Stufe), Effort high, Brief `paket-10.impl-0.brief.txt`, Report nach `paket-10.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG · 3 neue Dateien (`src/utils/deepFreeze.ts`, `deepFreeze.spec.ts`, `src/sprites/checkFeature.ts`), 28 geänderte (Quelltext, Specs, Browser-Test, 6 Doku-Dateien, CHANGELOG), keine `public-api.ts` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-10.verify.log`)
  - 2026-10-24 Zug 3: Reviewer beauftragt (Runde 0), Modell opus, Effort high, Diff `paket-10.diff` (2789 Zeilen, 31 Dateien), Report nach `paket-10.review-0.json`
  - 2026-10-24 Zug 3: Urteil — alle 8 Findings und der Nebenbefund behoben, 0 kritisch, 1 wichtig (CHANGELOG:189 Halbsatz über den Vorzustand), 6 klein · Diff `paket-10.diff`
  - 2026-10-24 Zug 4 Runde 1: offen 1 wichtig (CHANGELOG:189) plus 4 klein (Proposal `sprite-features.md:281–283`, TSDoc-Umbruch `defineSprite.ts:226–227`/`passFeatures.ts:20`, `sprites.md:642–643` Umbruch, `sprites.md:18` Einleitung) · Resume Implementierer Session 93db1ff9, opus/high, Brief `paket-10.impl-1.brief.txt`
    zurück: FERTIG, 5 Dateien (`CHANGELOG.md`, `sprite-features.md`, `defineSprite.ts`, `passFeatures.ts`, `sprites.md`) · Verify `pnpm run ci` exit=0 (`paket-10.verify-1.log`) · Diff `paket-10.diff-1` · Reviewer gezielt (Runde 1), opus/high, Report nach `paket-10.review-1.json`
    zurück: alle 5 offenen Befunde erledigt, keine neuen · Fortschritt: 5 von 5
  - 2026-10-24 Zug 5: Commit 7b08fe55 (31 Dateien, Trailer `Remediation-Run: 2026-10-23`), Verify `paket-10.verify-1.log` exit=0 · Plan auf `[x]`, Nebenbefunde (5) in »Offene Befunde«

## Urteil des Reviewers

Review `paket-10.review-0.json`, Nachprüfung `paket-10.review-1.json`.

- BUG-029 — behoben: `FeatureSprites.ts:90–101` (`judgeVisibility()` über `callerError()`), `:638–668` (`update()` sammelt, lädt hoch, `throwCollected()`); Specs `FeatureSprites.spec.ts` »update() behind code of the caller that throws«, Browser `sprites-shadow-pass.test.js:16–37`
- BUG-019 — behoben: `FeatureSpritesMaterial.ts:118–124`, TSDoc von `pass`
- READ-005 — behoben: `FeatureSpritesGeometry.ts:33–37` (Symbol `growthDescriptor`, `GrowthParameters`), Konstruktor Z. 79, `grown()` Z. 99
- TYPE-003 — behoben: `FeatureSprites.ts:283` (`#bindings`, Union `UniformBinding`), `update()` Z. 649–650 ohne Cast
- CONS-006 — behoben: `docs/resource-lifecycle.md` §3 Z. 147–149 und Absatz »A member over plain values keeps working«, TSDoc am Feld `uniforms` in `SpriteResources.ts`
- API-003 — behoben: `checkFeature.ts:63–123` (Tabelle aus Schritt 2 vollständig, in Reihenfolge), `SpriteFeature.ts:205`, `defineSprite.ts:236–250`
- API-011 — behoben: `deepFreeze.ts`, eingesetzt in `SpriteFeature.ts:206`, `SpriteBase.ts:100`, `GridBase.ts:122`, `defineSprite.ts:275`
- MEM-008 — behoben: `TableFrame.ts:40/88` (`MAX_VIEWS = 64`), Doku-Weg für `grids` in TSDoc von `gridBase()`, `docs/sprites.md:176–181`, `pipeline-stages-and-grid-base.md:218–221`
- Nebenbefund gleicher Ursache (Passes, Placement-Tausch) — behoben: `passFeatures.ts:32`, `FeatureSpritesMaterial.ts:408`, `FeatureSprites.ts:542` und `:186`

Kleine Befunde, stehen gelassen:
- `FeatureSprites.ts:541–542` — `checkFeature()` läuft nach `if (this.#material == null) return;`, ein kaputtes Feature wird auf einer disposten Instanz still geschluckt; Reihenfolge nach Detailplan, dasselbe Muster wie `bindUniform()` (vorbestehend, als Nebenbefund in »Offene Befunde«)
- `CHANGELOG.md:830–848` — der `ts check`-Block unter »More than 64 views« typcheckt, zeigt aber nur ein Gerüst (`const feature = TableFrame;`, `show()` ohne Herkunft von `view`)
- `docs/superpowers/plans/2026-10-08-sprite-uniform-bindings.md:1288–1365` (Arbeitsablage, kein Vertrag) beschreibt noch die parallelen Arrays der Bindungen (Meldung des Implementierers)

Gründe der Urteile an den Nebenbefunden: Scope-Regel »alles, jede Severity« — alle fünf `→ Scope`; keiner teilt die Ursache eines offenen Pakets (11: Text und Sprite-Hilfen, 12: vertex-objects, 13: texture und public-api).

## Für Zug 5

Die `Schnittstellen:`-Zeile im Plan nennt nach dem Commit mindestens: neue interne Module
`src/utils/deepFreeze.ts` (`deepFreeze()`) und `src/sprites/checkFeature.ts` (`checkFeature()`),
interner Export `thrownMessage()` in `src/sprites/runCheckKind.ts` — keines davon gehört in eine
`public-api.ts` (Paket 13 schneidet die benannten Exporte); `defineFeature()`, `defineSprite()`,
`checkPass()`/`definePass()` und die `placement`-Setter werfen `TypeError` nach der Tabelle in
Schritt 2; `QuadBase`, `gridBase()`, Features aus `defineFeature()` und `SpriteKind.description`
tief eingefroren; `tableFrame()` nimmt `views` 2–64; `FeatureSprites#update()` wirft nach dem
Upload (`AggregateError` bei mehreren).

## Abgleich

Stand des Codes: HEAD 2ad669ff, Arbeitsbaum sauber. `git diff --stat 7341059f..HEAD --
packages/twopoint5d/src/sprites` ist leer: kein Paket dieses Laufs hat das Sprite-Modul berührt.

- **BUG-029 — unverändert.** `FeatureSprites#update()` (Z. 597–613) ruft erst `source.write()`
  jeder Bindung (Z. 604–608), dann `judgeVisibility()` jedes Passes mit Hook (Z. 610–611), dann
  `super.update()` (Z. 612). `FeatureSpritesPass#judgeVisibility()` (Z. 79–82) ruft
  `this.pass.visible!(this.#uniform)` ungeschützt.
- **BUG-019 — unverändert.** `FeatureSpritesMaterial.ts:117`
  `const materialParameters = {...pass?.material, ...ownParameters};`. TSDoc von `pass` Z. 47–52
  verspricht »a parameter handed in here wins over one of the pass«. `ShadowPass` und
  `ReflectionPass` tragen `side: DoubleSide` (`passes/passPresets.ts:44–47`, `:73`).
- **READ-005 — unverändert.** Modulvariable `descriptorOfGrowth` (Z. 31–33), gelesen im
  Konstruktor Z. 78, gesetzt und im `finally` geleert in `grown()` Z. 97–104.
- **TYPE-003 — unverändert.** Drei parallele Arrays `#boundNames`, `#boundSources`,
  `#boundVectors` (Z. 245–248), befüllt in `bindUniform()` Z. 553–557, Cast
  `vectors[i] as Vector3 & Vector4` in `update()` Z. 607.
- **CONS-006 — unverändert.** `SpriteResources#uniform()` (Z. 220–229, »Keeps answering it once
  disposed«), `#setUniform()` (Z. 231–245, »Keeps working after dispose()«), `#textureSize()`
  (Z. 291–297), `#declares()` (Z. 299–305), Feld `uniforms` (Z. 95, ohne TSDoc; `dispose()`
  Z. 307–311 sagt »the uniforms stay readable and writable«); `FeatureSpritesMaterial#uniforms`
  (Z. 335–338), `#setUniform()` (Z. 340–347), `#getTexture()`/`#setTexture()`/`#touchTexture()`
  (Z. 349–381, schreiben bei übergebenen Ressourcen weiter durch), `placement` (Z. 383–432, »Keeps
  its last value once disposed«). `resource-lifecycle.md` §3 (Z. 145–177) kennt nur drei
  Reaktionen und schließt mit »This rules out the fourth reaction — a `TypeError` from deep inside
  the class …«.
- **API-003 — unverändert.** `defineSprite()` (Z. 222–256) prüft kein Feature für sich; ein
  `order` von `NaN` macht den Komparator `a[slot]!.order - b[slot]!.order`
  (`spritePipeline.ts:39`) inkonsistent; `textures: {x: null}` wirft in
  `collectSpriteDeclarations()` roh (`declaration.needsImage`, `spriteDeclarations.ts:117`);
  `options == null` wirft roh in `const {base} = options` (Z. 226), `options.features` ohne
  Iterable roh im Spread (Z. 227). `defineFeature()` (`SpriteFeature.ts:201–226`) prüft `name`,
  `order` der fünf Stage-Slots, `checkKind`, `nearestTextures`, Selbst-`requires` — nicht
  `methods`, `initialize`, `textures`, `transform` der Stages, `frame`/`placement`/`colorSource`,
  `attributes`, `usageAliases`, `uniforms` als Record, `requires` als Liste (ein String
  `requires: 'abc'` prüft heute per `'abc'.includes(name)` einen Teilstring).
- **API-011 — unverändert.** `defineFeature()` gibt `Object.freeze({...feature})` zurück
  (Z. 225); `QuadBase` (`SpriteBase.ts:98–123`) und jeder Eintrag von `gridBase()`
  (`GridBase.ts:119–133`) sind flach eingefroren, `description`, `attributes`, `indices` bleiben
  beschreibbar; `defineSprite()` friert die Kind flach ein (Z. 255), `description.attributes` und
  `description.methods` bleiben beschreibbar. Grep in Zug 0 über `src/sprites`,
  `apps/lookbook/src` und `packages/twopoint5d-testing/test`: kein Schreibzugriff auf
  `attributes`, `methods`, `uniforms`, `textures`, `indices`, `description`, `usageAliases`,
  `requires` eines Features oder einer Basis.
- **MEM-008 — unverändert.** `const grids = new Map<string, GridBase>()` (`GridBase.ts:80`),
  `const features = new Map<number, SpriteFeature<TableFrameApi>>()` (`TableFrame.ts:33`);
  `tableFrame()` nimmt jede ganze Zahl ab 2 (Z. 84). `paletteSwap()` begrenzt `colors` auf 1–64
  (`PaletteSwap.ts:57`). Lookbook und Browser-Tests nutzen nur `views: 8`.

## Entscheidungen in Zug 0 (mit Grund)

- **API-011 über ein generisches `deepFreeze()`**, angewandt an den vier Stellen des Findings.
  Es friert einfache Objekte (Prototyp `Object.prototype` oder `null`) und Arrays bis zu den
  Blättern ein und lässt Funktionen, Typed Arrays und Instanzen anderer Klassen — three.js-Objekte
  darunter — stehen. Die `basePrototype`-Objekte von `QuadBase`, `gridBase()` und der Kind gehören
  der Library und werden mit eingefroren; eine Basis, die ein Nutzer schreibt, friert die Library
  nie ein — `defineSprite()` fasst `options.base` nicht an (die Regel des Vertex-Object-Kerns,
  `VertexObjectDescriptor.ts:25–28`, gilt dem Autor eines `basePrototype`).
- **`defineSprite()` friert die Features nicht ein, die man ihm gibt.** Es prüft sie (API-003),
  baut die Beschreibung der Kind aber über `cloneVertexObjectDescription()` als eigene Kopie und
  friert die ein. So bleibt ein Feature, das nie durch `defineFeature()` lief, das des Autors, wie
  `definePass()` es für seine Features schon dokumentiert (`definePass.ts:35–38`). Die Features
  aus `defineFeature()` — alle eingebauten — sind nach diesem Paket ohnehin tief eingefroren.
- **MEM-008, `grids`: Doku statt Begrenzung.** Die Identität ist Vertrag (»Equal options answer
  the same frozen base«, ein Feature erkennt seine Basis per Identität in `checkKind`), ein
  Verdrängen bräche ihn. Ein `Uint16Array` für die Indizes schrumpft nur den Eintrag und verträgt
  sich nicht mit API-011: `Object.freeze()` auf einem Typed Array mit Elementen wirft. Die
  Empfehlung des Audits nennt den Doku-Weg als gleichwertige Alternative. `tableFrame()` bekommt
  die Obergrenze 64 laut »Entscheidungen« im Plan.
- **CONS-006: die Ausnahme in §3 benennen**, nicht die Mitglieder umbauen. Die TSDoc begründet
  das Verhalten (geteilte Uniforms überleben das Material), ein Wurf oder No-op auf
  `FeatureSpritesMaterial#setUniform()` bräche das Teilen über übergebene Ressourcen.
- **BUG-029: Reihenfolge bleibt, Fehler werden gesammelt.** Bindungen → Hooks → Upload bleibt
  (die Hooks lesen, was die Bindungen im selben Aufruf schrieben, `sprites.md` Z. 2557–2562).
  Jede werfende Quelle und jeder werfende Hook wird gesammelt, die übrigen laufen weiter, der
  Upload läuft immer, danach `throwCollected()`. Das ist das Muster von `Stage2D`
  (»Zustand vor dem Weiterwerfen abschließen«, Entscheidung vom 2026-10-23).
- **TYPE-003: gepaarte Einträge mit eigenem Diskriminanten** statt vorgebauter Closures: Daten
  statt Verhalten, im Debugger lesbar, `update()` ohne Cast und ohne Allokation.
- **READ-005: Symbol-Schlüssel im Parameterobjekt** statt eines dritten Konstruktorparameters:
  ein Parameter eines nicht exportierten Typs stünde in der `.d.ts` und fiele durch
  `checkNameableTypes`; der Schlüssel eines modulprivaten Symbols erscheint dort nicht.

## Vorgehen

Reihenfolge der Schritte ist die Empfehlung, nicht Pflicht. Für jeden Korrektheitsfehler zuerst
den Regressionstest, rot sehen, dann beheben; der rote Lauf gehört in den Report. Fehlermeldungen
nach der Regel in `AGENTS.md` (Subjekt vorn, `describeValue()` für zitierte Werte).

### 1. `deepFreeze()` — neu `packages/twopoint5d/src/utils/deepFreeze.ts`

```ts
/**
 * Freezes `value` and every plain object and array it holds, down to the leaves, and answers it.
 * A plain object is one whose prototype is `Object.prototype` or `null`. Functions, typed arrays
 * and instances of other classes — three.js objects among them — stay as they are, and so does
 * what they hold. Only data properties are followed, string and symbol keys alike; a getter is
 * never called. Safe on cycles and on parts that are frozen already.
 *
 * @internal
 */
export function deepFreeze<T>(value: T): T
```

- Implementierung mit einem `WeakSet` der besuchten Objekte; Kinder über
  `Reflect.ownKeys()` und `Object.getOwnPropertyDescriptor()`, nur `'value' in descriptor`.
  Ein schon eingefrorenes Objekt wird trotzdem durchlaufen (ein flach eingefrorenes kann
  beschreibbare Kinder haben).
- Nicht in `src/utils/public-api.ts` aufnehmen.
- `deepFreeze.spec.ts`: friert verschachtelte Records und Arrays ein; lässt eine Funktion, ein
  `Float32Array` mit Elementen, eine `Vector3`-Instanz und deren Felder unberührt
  (`Object.isFrozen(...) === false`); ruft keinen Getter (Getter mit Zähler); übersteht einen
  Zyklus; durchläuft ein flach eingefrorenes Objekt bis zu seinen Kindern; ein Symbol-Schlüssel
  wird gefolgt; antwortet dasselbe Objekt.

### 2. `checkFeature()` — neu `packages/twopoint5d/src/sprites/checkFeature.ts` (API-003)

`STAGE_SLOTS` zieht aus `SpriteFeature.ts` hierher. Typen nur per `import type` aus
`./SpriteFeature.js` (kein Laufzeitzyklus).

```ts
/**
 * Checks a feature on its own, in the words of `where`: that it is an object with a name, and
 * every field it brings for its type. `defineFeature()` runs it, and so does every place that takes
 * a feature — `defineSprite()`, `definePass()` and the placement swap —, since a plain object
 * passes for one. What can only be checked against the other features of a kind, `defineSprite()`
 * checks. @internal
 *
 * @throws a `TypeError` naming the feature and the field
 */
export function checkFeature(feature: unknown, where: string): asserts feature is SpriteFeature
```

»Record« heißt `isObject(value) && !Array.isArray(value)` (`isObject` aus `src/utils/isObject.ts`).
»Liste von Strings« heißt `Array.isArray(value) && value.every((x) => typeof x === 'string')`.
Ein Feld mit `null` oder `undefined` gilt als nicht gesetzt (wie die bestehenden `!= null`-Prüfungen).
Alle Abweisungen sind `TypeError`, in dieser Reihenfolge, `N` = Name des Features:

| Prüfung | Meldung |
| --- | --- |
| Feature ist ein Record | `${where}: a feature is an object with a name, got ${describeValue(feature)}` |
| `name` ist ein nicht leerer String | `${where}: a feature needs a name` (Wortlaut wie heute) |
| `attributes` ist ein Record | `${where}: the attributes of feature "N" are no record of attribute descriptions, got ${describeValue(v)}` |
| jeder Wert von `attributes` ist ein Record | `${where}: the attribute "${key}" of feature "N" is no attribute description, got ${describeValue(v)}` |
| `usageAliases` ist ein Record | `${where}: the usageAliases of feature "N" are no record of attribute name lists, got ${describeValue(v)}` |
| jeder Wert von `usageAliases` ist eine Liste von Strings | `${where}: the usage alias "${word}" of feature "N" is no list of attribute names, got ${describeValue(v)}` |
| `methods` ist ein Record | `${where}: the methods of feature "N" are no record of functions, got ${describeValue(v)}` |
| jeder Wert von `methods` ist eine Funktion | `${where}: the method "${key}" of feature "N" is no function` |
| `initialize` ist eine Funktion | `${where}: the initialize of feature "N" is no function` |
| `uniforms` ist ein Record (die Werte prüft weiter `collectSpriteDeclarations()`) | `${where}: the uniforms of feature "N" are no record of uniform declarations, got ${describeValue(v)}` |
| `textures` ist ein Record | `${where}: the textures of feature "N" are no record of texture declarations, got ${describeValue(v)}` |
| jeder Wert von `textures` ist ein Record mit `needsImage` fehlend oder boolesch | `${where}: the texture "${key}" of feature "N" is declared with ${describeValue(v)}; a texture takes {} or {needsImage: true}` |
| `nearestTextures` ist eine Liste von Strings | `${where}: the nearestTextures of feature "N" is no list of texture names` (wie heute) |
| `frame`, `placement`, `colorSource` sind Funktionen | `${where}: the ${slot} of feature "N" is no function` |
| `frameStage`, `local`, `mesh`, `uv`, `color` sind Records | `${where}: the ${slot} stage of feature "N" is no {order, transform}, got ${describeValue(v)}` |
| … mit endlichem `order` | `${where}: the ${slot} stage of feature "N" needs a finite order, got ${describeValue(order)}` (wie heute) |
| … und `transform` als Funktion | `${where}: the ${slot} stage of feature "N" needs a transform function` |
| `requires` ist eine Liste von Strings | `${where}: the requires of feature "N" is no list of feature names` |
| `requires` nennt nicht `N` | `${where}: feature "N" requires itself` (wie heute) |
| `checkKind` ist eine Funktion | `${where}: the checkKind of feature "N" is no function` (wie heute) |

Die Stage-Prüfungen laufen je Slot in der Reihenfolge Record → `order` → `transform`, die Slots in
der Reihenfolge der Tabelle.

### 3. `defineFeature()` — `SpriteFeature.ts` (API-003, API-011)

```ts
export function defineFeature<Api extends object = object>(feature: SpriteFeature<Api>): SpriteFeature<Api> {
  checkFeature(feature, 'defineFeature');
  return deepFreeze({...feature});
}
```

- TSDoc Z. 197–200: »Checks a feature on its own — every field it brings for its type — and
  freezes it, the records and lists inside included: `attributes`, `methods`, `uniforms`,
  `textures`, the stages … A record or list the feature shares with other code is frozen along
  with it. What can only be checked against the other features of a kind — names, requires,
  cardinality — `defineSprite()` checks.«
- `SpriteFeature.spec.ts`: die sechs bestehenden Abweisungen bleiben wörtlich; neu je eine Zeile
  der Tabelle aus Schritt 2 mit `defineFeature` als Subjekt (Tabellentest `test.each`), darunter
  `textures: {x: null}`, `requires: 'abc'`, `local: {order: 1}` ohne `transform`, `methods: {go: 1}`,
  `null` als Feature. Dazu der Einfrier-Test: `Object.isFrozen(Tint.attributes)`,
  `Object.isFrozen(Tint.attributes.color)`, `Object.isFrozen(Tint.methods)`,
  `Object.isFrozen((Tint.attributes.color as {components: string[]}).components)`,
  `Object.isFrozen(Tint.color)`, und `expect(() => { (Tint.methods as Record<string, unknown>).x = 1; }).toThrow(TypeError)`
  — vor dem Fix rot.

### 4. `defineSprite()` — `defineSprite.ts` (API-003, API-011)

Am Anfang, vor `assertSpriteBase()`, in dieser Reihenfolge:

```ts
if (!isObject(options) || Array.isArray(options)) {
  throw new TypeError(`${WHERE}: takes {base, features}, got ${describeValue(options)}`);
}
const {base} = options;
if (!isObject(base) || !isObject(base.description)) {
  throw new TypeError(`${WHERE}: the base is no sprite base, got ${describeValue(base)} — QuadBase, gridBase() or a base of your own`);
}
if (options.features == null || typeof (options.features as Partial<Iterable<unknown>>)[Symbol.iterator] !== 'function') {
  throw new TypeError(`${WHERE}: features is a list of features, got ${describeValue(options.features)}`);
}
const features: readonly SpriteFeature[] = Object.freeze([...options.features]);
for (const feature of features) checkFeature(feature, WHERE);
```

- Danach wie heute `assertSpriteBase()`, `assertFeatureNames()` usw.
- Beschreibung der Kind als eigene, eingefrorene Kopie, vor `checkLayout()` (der Kommentar dort
  verlangt, dass der Descriptor aus genau dem Objekt entsteht, das die Kind herausgibt):

  ```ts
  // a copy of its own, frozen down to the components of every attribute: the attribute descriptions
  // a feature brings stay that feature's, and nothing written to them afterwards reaches the kind
  const description = deepFreeze(
    cloneVertexObjectDescription({attributes, methods, basePrototype: initializerPrototype(features)}),
  );
  checkLayout(description, features, attributeOwners);
  ```

  `cloneVertexObjectDescription` aus `../vertex-objects/cloneVertexObjectDescription.js` (kopiert
  Attribut-Beschreibungen samt `components` und den `methods`-Record, nimmt `basePrototype` und die
  Funktionen per Referenz).
- `return Object.freeze({...})` (Z. 255) bleibt; `usageAliases`, `pipeline`, `features` sind schon
  eingefroren. `base` und die Feature-Objekte werden nicht eingefroren.
- TSDoc von `defineSprite()` (Z. 214–221): die Prüfreihenfolge beginnt mit »the options — an
  object with a base and an iterable of features —, every feature on its own as `defineFeature()`
  checks it, the base contract, …«. Wichtig: Die Feature-Prüfung läuft **vor** dem Basis-Vertrag
  (der Code oben); die TSDoc nennt die Reihenfolge so, wie der Code sie ausführt.
- TSDoc von `SpriteKind` (Z. 19): »… merged and checked once by {@link defineSprite}. Frozen all
  the way down — the kind, its feature list, its pipeline and its description with every attribute
  description in it —; the base and the features stay as their authors left them, and every
  feature out of `defineFeature()` is frozen as deep.«
- `defineSprite.spec.ts`: neu, vor dem Fix rot —
  `refuses a feature that never passed through defineFeature() as defineFeature() would, in its own name`
  (Tabellentest über eine Auswahl der Zeilen aus Schritt 2 mit Subjekt `defineSprite`, Features
  per `as never`: `order: NaN` in `local`, `textures: {x: null}`, `methods: {go: 1}`,
  `colorSource: 5`, `null`);
  `refuses options that are no object, a base that is none and features that are no list`;
  `freezes its description all the way down` (`Object.isFrozen(kind.description.attributes)`,
  `…methods`, `…attributes.color` und dessen `components`, Schreiben wirft `TypeError`);
  `leaves a feature that never passed through defineFeature() as its author wrote it`
  (`Object.isFrozen(rawFeature.attributes) === false` nach `defineSprite()`, und
  `kind.description.attributes.x !== rawFeature.attributes.x`).

### 5. Weitere Eintrittsstellen eines Features (Nebenbefund gleicher Ursache)

- `passes/passFeatures.ts`, `checkPass()`: in der Schleife über `pass.features`, als erste Zeile,
  `checkFeature(feature, where)` — vor der Namens- und der Datenfeld-Prüfung. Die Abweisungen
  tragen damit das Subjekt `definePass` bzw. das `where` des Aufrufers von `passFeatures()`.
  TSDoc von `checkPass()` und von `definePass()` (`definePass.ts:35–38`): »… features of distinct
  names, each checked as `defineFeature()` checks one, that bring no data …«.
- `FeatureSpritesMaterial.ts`, Setter `placement` (Z. 399): erste Zeile
  `checkFeature(feature, WHERE);` (Subjekt `FeatureSpritesMaterial`). `@throws` der Accessor-TSDoc
  (Z. 392–393) um »a `TypeError` for a feature that is malformed — see `defineFeature()`« ergänzen.
- `FeatureSprites.ts`, Setter `placement` (Z. 504): nach `if (this.#material == null) return;`
  `checkFeature(feature, WHERE);` (Subjekt `FeatureSprites`), vor den Pass-Prüfungen.
- `FeatureSprites.ts`, `resolveParts()`: vor der Pass-Schleife (Z. 150)
  `if (materialParameters.placement != null) checkFeature(materialParameters.placement, WHERE);`.
- Specs: je ein Fall — `definePass({name: 'p', features: [{name: 'f', color: {order: NaN, transform: (c) => c}} as never]})`
  wirft `definePass: the color stage of feature "f" needs a finite order, got NaN`;
  `material.placement = {name: 'odd', placement: 5} as never` wirft
  `FeatureSpritesMaterial: the placement of feature "odd" is no function` und das Material behält
  seine Placement; `sprites.placement = …` dasselbe mit `FeatureSprites`; `new FeatureSprites(kind, {placement: {name: 'odd', placement: 5} as never})`
  wirft mit `FeatureSprites` und lässt nichts gebaut zurück. Vor dem Fix rot (Meldungen ohne
  Subjekt bzw. ein Wurf erst im Effekt).

### 6. `QuadBase` und `gridBase()` (API-011)

- `SpriteBase.ts:98`: `export const QuadBase: SpriteBase<QuadBaseArgs> = deepFreeze({...})` statt
  `Object.freeze`; das innere `Object.freeze` an `defaultArgs` (Z. 122) entfällt, `deepFreeze`
  deckt es. TSDoc von `QuadBase` (Z. 94–97) um »Frozen all the way down, its description and the
  prototype of its base vertex included.« ergänzen.
- `GridBase.ts:119`: `grid = deepFreeze({...})` statt `Object.freeze`; das innere `Object.freeze`
  an `defaultArgs` (Z. 132) entfällt ebenso.
- `SpriteBase.spec.ts`: `Object.isFrozen(QuadBase.description)`, `…attributes`,
  `…attributes.position.components`, `…indices`, `…basePrototype`; `push` auf `indices` wirft
  `TypeError` — vor dem Fix rot. `GridBase.spec.ts`: dasselbe für `gridBase({columns: 3, rows: 3})`.

### 7. `gridBase()` und `tableFrame()` (MEM-008)

- `TableFrame.ts`: `views` ist eine ganze Zahl von 2 bis 64. Konstante neben `TEXELS_PER_FRAME`:
  `const MAX_VIEWS = 64;` mit Kommentar »one feature per number of views stays for the life of the
  page: the bound keeps a caller who derives views from data from filling the cache, and no
  directional sheet has more views«. Prüfung:
  `!(typeof views === 'number' && Number.isInteger(views) && views >= 2 && views <= MAX_VIEWS)`,
  Meldung `tableFrame: views must be a whole number from 2 to ${MAX_VIEWS}, got ${describeValue(views)} — leave views out for frames without views`.
  TSDoc von `TableFrameOptions.views` (Z. 10–15: »a whole number from 2 to 64«) und `@throws`
  (Z. 80).
- `TableFrame.spec.ts` Z. 71: Wortlaut nachziehen; neu `views: 64` wird angenommen, `views: 65`
  abgewiesen — vor dem Fix rot.
- `GridBase.ts`, TSDoc von `gridBase()` (Z. 82–94), nach »Equal options answer the same frozen
  base.«: »Every grid built stays for the life of the page — the identity is what a feature
  recognizes its base by —, so `gridBase()` is meant for a few fixed grids, not for sizes derived
  from data.« Der Kommentar Z. 30–32 bleibt stimmig.

### 8. `FeatureSprites`: Bindungen als Paare (TYPE-003)

- Ersetze `#boundNames`, `#boundSources`, `#boundVectors` (Z. 245–248) durch

  ```ts
  // one binding: the source and the vector of the uniform it writes, of one type, so that update()
  // hands each source its vector without a cast, walking the list by index
  type UniformBinding =
    | {readonly type: 'vec3'; readonly name: string; readonly source: Extract<SpriteUniformSource, {type: 'vec3'}>; readonly vector: Vector3}
    | {readonly type: 'vec4'; readonly name: string; readonly source: Extract<SpriteUniformSource, {type: 'vec4'}>; readonly vector: Vector4};
  ```

  (Typ auf Modulebene, nicht exportiert) und `readonly #bindings: UniformBinding[] = [];`.
- `bindUniform()`: die Eingangsprüfung (Z. 541–548) bleibt. Danach ohne Cast:

  ```ts
  const {value} = node;
  let binding: UniformBinding;
  if (source.type === 'vec3' && value instanceof Vector3) binding = {type: 'vec3', name, source, vector: value};
  else if (source.type === 'vec4' && value instanceof Vector4) binding = {type: 'vec4', name, source, vector: value};
  else throw new TypeError(`${WHERE}: the uniform "${name}" is a ${typeOfUniform(node)}, and the source bound to it writes a ${source.type}`);
  const at = this.#bindings.findIndex((bound) => bound.name === name);
  if (at === -1) this.#bindings.push(binding);
  else this.#bindings[at] = binding;
  ```

  Meldung und »replaced and keeps its place« unverändert.
- `unbindUniform()`: `findIndex` und ein `splice`. `dispose()`: `this.#bindings.length = 0;`.
- Bestehende Specs der Bindungen (`FeatureSprites.spec.ts` »bindUniform()«,
  `spriteDeclarations.spec.ts`, `FeatureSprites.grow.spec.ts`) und
  `src/sprites/hot-path-allocations.spec.ts` › `update() with a plane and a light binding and a pass with a hook allocates nothing per call`
  bleiben unverändert grün.

### 9. `FeatureSprites#update()` und `FeatureSpritesPass#judgeVisibility()` (BUG-029)

- `runCheckKind.ts`: die Formatierung des Geworfenen als interner Export, `runCheckKind()` nutzt
  ihn selbst:

  ```ts
  /** What a thrown value says: the message of an `Error`, a string as it is, anything else as `describeValue()` shows it. @internal */
  export const thrownMessage = (error: unknown): string =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : describeValue(error);
  ```

- `FeatureSprites.ts`, auf Modulebene:

  ```ts
  // what code of the caller threw, as an Error in the words of `where`; a refusal that names `where`
  // already — uniform() of a pass hook asked for a name no feature declares — goes on as it is
  const callerError = (where: string, error: unknown): unknown =>
    error instanceof Error && error.message.startsWith(`${where} `)
      ? error
      : new Error(`${where} threw: ${thrownMessage(error)}`, {cause: error});
  ```

- `FeatureSpritesPass`: `readonly #where: string;` im Konstruktor auf den bestehenden `where`
  (Z. 61) setzen. `judgeVisibility()`:

  ```ts
  judgeVisibility(): void {
    let agrees: boolean;
    try {
      agrees = this.pass.visible!(this.#uniform);
    } catch (error) {
      // the pass keeps the visibility of its last judgement
      throw callerError(this.#where, error);
    }
    this.#hookAgrees = agrees;
    this.visible = this.#enabled && agrees;
  }
  ```

- `FeatureSprites#update()`:

  ```ts
  override update(): void {
    let errors: unknown[] | undefined;
    const bindings = this.#bindings;
    if (bindings.length > 0 && this.#material != null) {
      this.updateWorldMatrix(true, false);
      const worldToSprites = this.#worldToSprites.copy(this.matrixWorld).invert();
      for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i]!;
        try {
          if (binding.type === 'vec3') binding.source.write(binding.vector, worldToSprites);
          else binding.source.write(binding.vector, worldToSprites);
        } catch (error) {
          (errors ??= []).push(callerError(`${WHERE}: the source bound to the uniform "${binding.name}"`, error));
        }
      }
    }
    const judged = this.#judgedPasses;
    for (let i = 0; i < judged.length; i++) {
      try {
        judged[i]!.judgeVisibility();
      } catch (error) {
        (errors ??= []).push(error);
      }
    }
    // the upload reads neither the bindings nor the hooks: what threw above keeps no sprite of this
    // frame from the gpu
    super.update();
    if (errors !== undefined) throwCollected(errors, `${WHERE}#update(): more than one bound source or visible hook threw`);
  }
  ```

  `throwCollected` aus `../../utils/throwCollected.js`. Kein Allokieren auf dem Weg ohne Wurf.
- TSDoc von `update()` (Z. 591–596) ergänzen: »A source or a hook that throws stops neither the
  others nor the upload: once the upload is done, `update()` throws what it threw as an `Error`
  that names the uniform of the source or the pass of the hook — `FeatureSprites: the visible of
  pass "shadow" threw: …` —, and several as an `AggregateError`. A pass whose hook threw keeps the
  visibility of its last judgement.«
- `FeatureSprites.spec.ts`, neu, vor dem Fix rot:
  `update() uploads what the pools marked when the visible hook of a pass throws, and names the pass`
  (Spy auf `sprites.geometry!.update` einmal gerufen; `toThrow('FeatureSprites: the visible of pass "boom" threw: the hook broke')`; `cause` ist der Originalfehler; `geometry.instanceCount` gleich der Zahl der Sprites);
  `update() writes the other bindings and judges every pass behind a source that throws` (zwei
  Bindungen, die erste wirft: die zweite ist geschrieben, der Hook gefragt, Meldung
  `FeatureSprites: the source bound to the uniform "…" threw: …`);
  `update() throws an AggregateError when more than one source or hook threw`;
  `a pass whose hook throws keeps the visibility of its last judgement`;
  `a hook that asks uniform() for an undeclared name throws that refusal as it is` (Meldung beginnt
  mit `FeatureSprites: the visible of pass "…" reads the uniform`, kein doppeltes Präfix).
- Browser-Test in `packages/twopoint5d-testing/test/sprites-shadow-pass.test.js`:
  `draws the sprites of a frame in which the visible hook of a pass throws` — ein Pass
  `definePass({...ShadowPass, name: 'brokenShadow', visible() { throw new Error('the hook broke'); }})`,
  ein Sprite an bekannter Stelle, `update()` wirft die erwartete Meldung (abgefangen), danach
  `render`, das Pixel an der Stelle des Sprites zeigt dessen Farbe. Gegen das alte `dist` rot
  (ohne Upload `instanceCount` 0, nichts gezeichnet). Fixture-Regeln aus Paket 2: `keep()` und
  `disposeKept()` als erste Zeile im `afterEach`, kein dateilokales `this.timeout()`. Der Fehler
  wird synchron geworfen und abgefangen, `twopoint5dExpectRejection` ist nicht nötig.

### 10. `FeatureSpritesMaterial`: kein `undefined` über dem Pass (BUG-019)

- Z. 115–117:

  ```ts
  const {name, textures, uniforms, placement, resources, pass, ...ownParameters} = options ?? {};
  // the parameters of the pass first, so that a parameter handed in wins; one handed in as
  // undefined counts as not handed in, as FeatureSprites counts it, and setValues() never sees it
  const materialParameters = {
    ...pass?.material,
    ...Object.fromEntries(Object.entries(ownParameters).filter(([, value]) => value !== undefined)),
  };
  ```

  `Object.fromEntries` liefert `{[k: string]: unknown}`; der gefilterte Teil bekommt deshalb den
  Typ zurück über `as typeof ownParameters` — ein Filter, der nur Einträge entfernt, ändert den Typ
  der übrigen nicht. `materialParameters.alphaTest`/`alphaTestNode` (Z. 154) lesen weiter typisiert.
- TSDoc von `pass` (Z. 47–52): »… so a parameter handed in here wins over one of the pass; one
  handed in as `undefined` counts as not handed in.«
- `FeatureSpritesMaterial.spec.ts`, neu, vor dem Fix rot:
  `a parameter handed in as undefined leaves the one of the pass, and nothing is said on the console`
  — `new FeatureSpritesMaterial(kind, {pass: ShadowPass, side: undefined})`: `material.side === DoubleSide`,
  `console.warn` nicht gerufen (Spy). Dazu `new FeatureSprites(kind, {side: undefined})`:
  kein `console.warn`.

### 11. `FeatureSpritesGeometry`: der Deskriptor einer Vergrößerung als Parameter (READ-005)

- Ersetze `let descriptorOfGrowth` (Z. 31–33) durch

  ```ts
  // the key under which grown() hands the constructor the descriptor of the geometry it grows from:
  // a symbol of this module, which no caller of the public constructor holds
  const growthDescriptor = Symbol('growthDescriptor');

  interface GrowthParameters extends FeatureSpritesGeometryParameters {
    readonly [growthDescriptor]?: VertexObjectDescriptor;
  }
  ```

  (beides nicht exportiert).
- Konstruktor (Z. 71–78):

  ```ts
  constructor(kind: SpriteKind<Api>, parameters: number | FeatureSpritesGeometryParameters = 100) {
    const options: GrowthParameters = typeof parameters === 'number' ? {capacity: parameters} : parameters;
    const {capacity = 100, attributeUsage, baseArgs = kind.base.defaultArgs} = options;

    super(options[growthDescriptor] ?? descriptionOf(kind as SpriteKind, attributeUsage), capacity, kind.base.description);
  ```

- `grown()` (Z. 97–104): ohne `try`/`finally`:

  ```ts
  const parameters: GrowthParameters = {capacity, [growthDescriptor]: this.instancedPool.descriptor};
  const grown = new FeatureSpritesGeometry(this.kind, parameters);
  ```

  Der Rest von `grown()` bleibt.
- Refactoring unter unveränderten Specs (`FeatureSpritesGeometry.spec.ts`,
  `FeatureSprites.grow.spec.ts`); `pnpm run checkNameableTypes` und `checkPkgTypes` bleiben grün
  (laufen im Gate).

### 12. Doku

- **`packages/twopoint5d/docs/resource-lifecycle.md` §3 (CONS-006).** Der Einleitungssatz
  (Z. 147–148) wird »Every public member of a disposed instance behaves in one of three ways,
  picked by its declared type — or, for a member over plain values, keeps working (below). Its
  TSDoc says which.« Nach Punkt 3 ein Absatz:

  > **A member over plain values keeps working.** What it reads or writes is no resource the
  > instance gives back — a uniform, the placement a graph was last built with —, so after
  > `dispose()` it answers and takes values as before, and a write reaches only what still reads
  > them: the other materials that share the resources, or nothing that renders.
  > [`SpriteResources`](../src/sprites/FeatureSprites/SpriteResources.ts) keeps `uniforms`,
  > `uniform()`, `setUniform()`, `textureSize()` and `declares()`;
  > [`FeatureSpritesMaterial`](../src/sprites/FeatureSprites/FeatureSpritesMaterial.ts) keeps
  > `uniforms`, `setUniform()` and the getter `placement` — the setter checks what it is handed
  > and changes nothing that renders — and, with resources handed in, `getTexture()`,
  > `setTexture()` and `touchTexture()`, which act on those resources, alive and the caller's.
  > A new member keeps working only over state of this kind.

  Den Satz »This rules out the fourth reaction — a `TypeError` from deep inside the class …«
  (Z. 165–167) umformulieren zu »This rules out a `TypeError` from deep inside the class …« —
  sonst widerspricht er dem neuen Absatz. Zeilenlänge wie im Dokument (≈ 90).
- **`SpriteResources.ts`**: TSDoc am Feld `uniforms` (Z. 95): »The uniforms by declared name.
  Readable and writable after `dispose()`: they are values, not resources.«
- **`packages/twopoint5d/docs/sprites.md`**:
  - Z. 176–179 (»One base per grid«): nach dem ersten Satz »Every grid built stays for the life
    of the page, so `gridBase()` is meant for a few fixed grids, not for sizes derived from data.«
    und »frozen base« bleibt (stimmt jetzt tief).
  - Z. 640 (»The views of a frame«): am Anfang »`n` is a whole number from 2 to 64.«
  - Z. 1925–1926 (»Writing a feature«): »… handed to `defineFeature()`, which checks every field
    of it and freezes it, the records and lists inside included.«
  - Nach der Feldliste, die Z. 1983 beginnt, ein Absatz: »A field of the wrong type — a stage
    without a `transform`, a method that is no function, a texture declared with anything but
    `{}` or `{needsImage: true}` — is refused with a `TypeError` naming the feature and the field.
    `defineSprite()`, `definePass()` and the placement swap hold a feature that never passed
    through `defineFeature()` to the same rules.«
  - Z. 2399–2407 (Pass-Hook): nach »… throws from `update()` for a name that is no uniform of
    the sprites at all.« ergänzen »A hook that throws stops neither the other passes nor the
    upload: `update()` throws once it is done, naming the pass, and the pass keeps the visibility
    of its last judgement.«
  - Z. 2557–2562 (»The order of `update()`«): Satz anhängen »A source or a hook that throws stops
    neither the others nor the upload; `update()` throws what they threw at its end, naming the
    uniform or the pass.«
- **Proposals** (Konvention: geänderte Verträge nachziehen):
  - `sprite-features.md` Z. 280–283: die Liste der Prüfungen von `defineFeature()` auf »every
    field for its type« bringen, Halbsatz »and freezes it, the records and lists inside
    included«; der Abschnitt zu `definePass()` (Z. 749ff.): »each feature checked as
    `defineFeature()` checks one«.
  - `sprite-uniform-bindings.md` §3.1 (Z. 165–175): Punkt 1 »The bindings live in parallel arrays,
    walked by index.« → »Each binding is one entry that pairs the source with the vector of its
    uniform, by type; the list is walked by index.« Nach Punkt 3 ein Satz zum Wurf wie im Guide.
  - `table-frames-and-palette-swap.md` Z. 135 und Z. 220–221: »a whole number from 2 to 64«,
    Meldung wie in Schritt 7.
  - `pipeline-stages-and-grid-base.md` Z. 176: Halbsatz »every grid built stays for the life of
    the page«.
- **`packages/twopoint5d/CHANGELOG.md`** unter `## [Unreleased]` (Skill `updating-changelog`),
  ohne Finding-IDs, ohne Rückblick:
  - `### Fixed`: `FeatureSprites#update()` uploads the sprites of the frame when a bound source or
    a `visible` hook throws, lets every other source and hook run, and throws afterwards, naming
    the uniform or the pass (several as an `AggregateError`) · a material parameter handed to
    `FeatureSpritesMaterial` or `FeatureSprites` as `undefined` leaves the one of the pass in place
    and is not passed to `setValues()`.
  - `### Changed`: `defineFeature()` checks every field of a feature for its type — `attributes`,
    `usageAliases`, `methods`, `initialize`, `uniforms`, `textures`, `frame`, `placement`,
    `colorSource`, the `transform` of every stage, `requires` — with a `TypeError` naming the
    feature and the field (**BREAKING**) · `defineSprite()`, `definePass()` and the `placement`
    of `FeatureSprites` and `FeatureSpritesMaterial` check a feature that never passed through
    `defineFeature()` the same way, and `defineSprite()` refuses options that are no object, a base
    that is none and features that are no list (**BREAKING**) · `defineFeature()`, `QuadBase`,
    `gridBase()` and `defineSprite()` freeze what they answer all the way down — a write into the
    attributes, methods, uniforms, textures, stages of a feature or the description of a base or a
    kind throws a `TypeError` (**BREAKING**) · `tableFrame()` takes `views` from 2 to 64
    (**BREAKING**). Je »See the Migration Guide«.
  - `### Migration Guide`: drei Abschnitte, Überschriften im Stil der vorhandenen —
    `#### A feature written as a plain object` (was `defineSprite()` jetzt abweist, wie man es
    behebt: das Feld in den Typ bringen, den das Interface nennt),
    `#### A write into a feature, a base or a sprite kind` (eine eigene Variante als neues
    Feature/neue Kind bauen: `defineFeature({...Tint, name: 'myTint', …})`),
    `#### More than 64 views in tableFrame()`. Codeblöcke `ts check` nur, wenn sie für sich
    typchecken.

## Findings im Volltext

**BUG-029 · low · packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:597** — Aufrufer-Code in `update()` so ordnen, dass ein Wurf den Upload nicht überspringt
`update()` ruft zuerst `source.write()` jeder Bindung und den `visible`-Hook jedes Passes auf — beides Code des Aufrufers — und erst danach `super.update()`, das die markierten Pools hochlädt. Wirft ein Hook oder eine Quelle, bleibt der Upload dieses Frames aus, die weiteren Bindungen und Passes werden nicht mehr beurteilt, und der Fehler kommt aus dem Render-Loop ohne Bezug zu einem Pass-Namen.
Beleg: `source.write(vectors[i] as Vector3 & Vector4, worldToSprites);` … `judged[i]!.judgeVisibility();` … `super.update();`
Empfehlung: Den Upload in ein `try/finally` legen (oder zuerst hochladen), und den Hook-Fehler mit dem Pass-Namen im Subject (`FeatureSprites: the visible of pass "…"`) weiterreichen.

**BUG-019 · low · packages/twopoint5d/src/sprites/FeatureSprites/FeatureSpritesMaterial.ts:117** — Explizit undefined-Parameter des Materials nicht über die Parameter des Passes legen lassen
`{...pass?.material, ...ownParameters}` lässt einen Schlüssel mit Wert `undefined` den Wert des Passes überschreiben. `new FeatureSpritesMaterial(kind, {pass: ShadowPass, side: undefined})` verliert damit `DoubleSide`, und `Material.setValues()` warnt für den Schlüssel auf der Konsole. Das Dokumentationsversprechen »a parameter handed in here wins« gilt für einen absichtlich gesetzten Wert, nicht für ein bedingt leeres Feld; `FeatureSprites` selbst behandelt undefined bereits als nicht gesetzt (`definedKeys()`).
Beleg: `const materialParameters = {...pass?.material, ...ownParameters};`
Empfehlung: Die Einträge mit Wert `undefined` aus `ownParameters` vor dem Zusammenführen herausfiltern, so wie `definedKeys()` in `FeatureSprites.ts` es für die Prüfung tut, und einen Test mit `{pass, side: undefined}` ergänzen.

**READ-005 · low · packages/twopoint5d/src/sprites/FeatureSprites/FeatureSpritesGeometry.ts:33** (auch Z. 78, 98) — Modul-Variable `descriptorOfGrowth` durch einen expliziten Weg zum Konstruktor ersetzen
`grown()` reicht den Deskriptor über eine veränderliche Modul-Variable an den Konstruktor, den es selbst aufruft, und setzt sie im `finally` zurück. Das ist synchron und korrekt, aber versteckter globaler Zustand: wer den Konstruktor liest, sieht den Pfad nicht, und ein Wurf zwischen Setzen und Lesen würde den Wert nur dank des `finally` nicht verschleppen.
Empfehlung: Eine private statische Fabrik oder ein Symbol-Parameter im Konstruktor, der den Deskriptor trägt, statt der Modul-Variable.

**TYPE-003 · low · packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:607** (auch Z. 557) — Bindungen als gepaarte Einträge statt `as Vector3 & Vector4` halten
Die Bindungen liegen in drei parallelen Arrays; dabei geht die Diskriminierung von `SpriteUniformSource` (`vec3` oder `vec4`) verloren, und `update()` castet den Vektor auf den unmöglichen Typ `Vector3 & Vector4`, um `write()` aufzurufen. Die Korrektheit hängt allein an der Prüfung in `bindUniform()`.
Empfehlung: Pro Bindung ein Eintrag mit typgerechtem Paar (Quelle, Vektor) oder ein vorgebauter `() => void`-Writer je Bindung, der den Cast an einer Stelle kapselt und `update()` ohne Cast lässt; die Allokationsfreiheit bleibt, wenn der Writer einmal beim Binden entsteht.

**CONS-006 · low · packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts:224** (auch `SpriteResources.ts:235`, `:295`, `FeatureSpritesMaterial.ts:336`, `:395`) — Verhalten nach `dispose()` von `SpriteResources` und `FeatureSpritesMaterial` in den Lebenszyklus-Regeln benennen
`uniform()`, `setUniform()`, `textureSize()`, `uniforms` und die Getter/Setter `placement` antworten nach `dispose()` weiter (ein gesetzter Wert, ein Schreibzugriff, der durchgeht, oder ein zuletzt gehaltener Wert). `resource-lifecycle.md` §3 kennt für ein Mitglied nur drei Reaktionen: `undefined`, Wurf oder stilles No-op. Das Verhalten ist in den TSDocs begründet (geteilte Uniforms überleben das Material), die Regel nennt die vierte Reaktion aber nicht, sodass ein Prüfer sie als Verstoß lesen muss.
Empfehlung: In §3 von `resource-lifecycle.md` die Ausnahme »Mitglied bleibt nutzbar, weil andere Materialien dieselben Ressourcen lesen« mit diesen Mitgliedern benennen, oder die Mitglieder auf eine der drei Reaktionen zurückführen.

**API-003 · low · packages/twopoint5d/src/sprites/SpriteFeature.ts:201** (auch `spritePipeline.ts:39`, `defineSprite.ts:227`, `spriteDeclarations.ts:117`) — Features beim Eintritt in `defineSprite()` prüfen, nicht nur in `defineFeature()`
`SpriteFeature` ist ein Interface; `defineSprite()` akzeptiert daher auch Objekte, die nie durch `defineFeature()` liefen (JS-Aufrufer, `as`-Casts). Die Prüfungen von `defineFeature` (Name, endliche `order`, `checkKind`-Typ) fehlen dann. Eine `order` von `NaN` oder `undefined` macht den Komparator `a.order - b.order` inkonsistent, die Stage-Reihenfolge wird still falsch. `textures: {x: null}` wirft einen rohen TypeError (`declaration.needsImage`), und `defineFeature` selbst prüft weder `methods`, `initialize`, `textures` noch die `transform`-Funktionen der Stages; fehlerhafte Werte fallen erst beim Materialbau oder beim ersten `createSprite()` mit einer Meldung ohne Subjekt auf. `options`/`options.features` ohne Iterable ergeben ebenfalls nur ein generisches TypeError.
Beleg: `Object.freeze(features.filter(...).sort((a, b) => a[slot]!.order - b[slot]!.order))`
Empfehlung: Die Einzelprüfung aus `defineFeature` als eigene Funktion herausziehen, in `defineSprite` für jedes Feature aufrufen und um `typeof`-Prüfungen für `methods`, `initialize`, Stage-`transform` und Texturdeklarationen ergänzen; Fehler mit Subjekt `defineSprite: feature "…"` melden.

**API-011 · low · packages/twopoint5d/src/sprites/SpriteFeature.ts:225** (auch `SpriteBase.ts:98`, `GridBase.ts:119`, `defineSprite.ts:255`) — Geteilte Singletons tief einfrieren statt nur flach
`defineFeature`, `QuadBase`, `gridBase()` und `defineSprite()` rufen `Object.freeze` nur auf der obersten Ebene auf; `attributes`, `methods`, `uniforms`, `description.indices` und `description.attributes` bleiben veränderlich. Die Objekte sind aber prozessweit geteilte Singletons (`Tint`, `QuadBase`, der Cache `grids`, `SpriteKind.description`), und die Doku nennt sie »frozen« bzw. »Immutable«. Eine Mutation eines Aufrufers (etwa `QuadBase.description.indices.push`) wirkt auf jede später gebaute Kind-Definition.
Beleg: `return Object.freeze({...feature});`
Empfehlung: Die verschachtelten Container beim Einfrieren mit abdecken (kleiner `deepFreeze` für Records und Arrays, ohne Funktionen und three.js-Objekte anzufassen) oder die Doku auf »flach eingefroren« zurücknehmen.

**MEM-008 · low · packages/twopoint5d/src/sprites/GridBase.ts:80** (auch `features/TableFrame.ts:33`) — Fabrik-Caches der Basen und Features begrenzen
`grids` hält jede Basis für die Lebenszeit der Seite; die Kappung auf 4096 Zellen begrenzt nur die Einzelgröße, nicht die Zahl der Paare (rund 34 000 mögliche Paare mit je bis zu 24 576 Indizes als `number[]`). `tableFrame({views})` nimmt jede ganze Zahl ab 2 und legt je Wert einen Eintrag an. Im Normalbetrieb sind es wenige Werte; ein Aufrufer, der Werte aus Daten ableitet, lässt die Maps unbegrenzt wachsen.
Beleg: `const grids = new Map<string, GridBase>();`
Empfehlung: Für `tableFrame` eine Obergrenze für `views` wie bei `paletteSwap` (64) festlegen und für `grids` die Indizes als `Uint16Array` halten oder die Dokumentation um den Hinweis ergänzen, dass die Fabriken für wenige feste Werte gedacht sind.
