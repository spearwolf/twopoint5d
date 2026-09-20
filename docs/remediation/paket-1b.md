# Paket 1b — Ein Präfix pro Schicht, ein Plural pro Sprite

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-003 (medium)
- Ziel: Am Namen einer Klasse ist ablesbar, zu welcher Schicht sie gehört, und
  die Regel dahinter steht verbindlich in `architecture.md` statt im Gedächtnis
  derer, die das Modul geschrieben haben.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/docs/architecture.md`
  - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/VOUtils.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexAttributeDescriptor.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjects.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts`
  - `packages/twopoint5d/src/map2d/public-api.ts`
  - `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `refactor(vertex-objects,sprites,map2d,lookbook): name the layer a class belongs to, give the textured-sprites types the plural of their module, and let map2d export its interfaces as types`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · API-003 unverändert, alle drei
    Fundstellen belegt (`vertex-objects/public-api.ts` unverändert 15 Zeilen,
    `TexturedSpritesGeometry.ts:9-22`, `map2d/public-api.ts:20`) · die Folge aus
    Paket 1 (`TexturedSpritesGeometry.ts:17-21`) in Schritt 4 aufgenommen · ein
    vierter Singular-Schiefstand derselben Ursache in derselben Datei
    aufgenommen (`TexturedSpriteMakeBaseSpriteArgs`) · kein Eintrag aus »Offene
    Befunde« aufgenommen: alle sieben `→ Scope`-Einträge liegen in
    `vertex-objects/` und teilen keine Ursache mit diesem Paket · Restplan
    unverändert
  - 2026-09-20 Zug 1: Implementierer beauftragt · mittlere Stufe, Effort medium ·
    Brief `paket-1b.impl-0.brief.txt`, Report nach `paket-1b.impl-0.json`
  - 2026-09-20 Zug 2: Report FERTIG · 17 Dateien geändert, keine neue ·
    Arbeitsbaum schmutzig · kein Regressionstest (Umbenennungs- und
    Dokumentationspaket, kein Korrektheitsfehler) · eigener Verify-Lauf
    `pnpm run ci`, exit=0 über alle zehn Schritte,
    Log `paket-1b.verify.log`
  - 2026-09-20 Zug 3: Reviewer (mittlere Stufe, Effort medium) · API-003 behoben,
    alle sieben Schritte einzeln belegt · kein kritischer, kein wichtiger Befund ·
    sieben kleine Befunde, unten aufgezählt ·
    Diff `paket-1b.diff`, Report `paket-1b.review-0.json`
  - 2026-09-20 Zug 4: entfällt — keine offenen Befunde nach Runde 0
  - 2026-09-20 Zug 5: committet als `bdbb5ec1`, Verify aus Zug 2 getragen (keine
    Codeänderung dazwischen) · die Commit-Message hat vor dem Commit `lookbook`
    in den Scope bekommen, weil `apps/lookbook/.../BouncingSprites.ts` mit im
    Commit liegt

## Urteil des Reviewers

**API-003 · behoben.** Fundstellen je Schritt:

1. Schichtregel — `packages/twopoint5d/docs/architecture.md:55-69`, hinter der
   nummerierten Aufzählung, vor »The consequence that matters…«; beschreibt den
   Code, nennt die vier querstehenden Klassen beim Namen.
2. Elf TSDoc-Köpfe, je direkt über `export class`, je mit Schichtsatz:
   `VOBufferPool.ts:17`, `VOBufferGeometry.ts:19`,
   `InstancedVOBufferGeometry.ts:29`, `VertexObjectPool.ts:19`,
   `VertexObjectGeometry.ts:10`, `InstancedVertexObjectGeometry.ts:18`,
   `VertexObjectBuffer.ts:39`, `VertexObjectDescriptor.ts:13`,
   `VertexAttributeDescriptor.ts:19`, `VOUtils.ts:10`, `VertexObjects.ts:13`
   (behält den `THREE.Mesh`-Satz).
3. `map2d/public-api.ts:20` — `export type *`; `map2d/types.ts` führt
   ausschließlich `export interface` (Zeilen 5, 16, 26, 33, 48, 111, 151, 177),
   kein Wert, keine Klasse, kein Enum.
4. `TexturedSpritesGeometry.ts` — `TexturedSpritesPool` (`:14`),
   `TexturedSpritesMakeBaseSpriteArgs` (`:18`),
   `TexturedSpritesGeometryParameters` (`:24`), je mit `@deprecated`-Alias
   darunter (`:16`, `:22`, `:32`). `Omit<VertexAttributeUsageOverrides, 'alias'>`
   ist strukturell dieselbe Form; `Omit` über `Pick` erhält die Optionalität.
5. Aufrufer — `TexturedSprites.ts` und `BouncingSprites.ts` umgestellt; eine
   repo-weite Suche nach den drei alten Namen findet nur noch die Aliase und den
   CHANGELOG-Eintrag.
6. CHANGELOG — `### Deprecated` (`:165`) mit allen drei Namen, Grund und der
   Frist von einem Release; `### Changed` (`:39-40`) mit der Typänderung und dem
   `map2d`-Export. Kein Eintrag für TSDoc und `architecture.md`, wie vorgegeben.
7. Nichts im `vertex-objects`-Modul umbenannt, keine Methoden-TSDoc,
   `AnimatedSprites/` unberührt.

**Qualität: kein kritischer, kein wichtiger Befund.** Sieben kleine, offen
gelassen — keiner bricht etwas, keiner rechtfertigt eine Runde auf einem grünen
Stand:

- `TexturedSpritesGeometry.ts:26-27` und `CHANGELOG.md:39` — der Kommentar zum
  `Omit` beschreibt einen Schaden, den es so nicht gibt: der Konstruktor liest
  `attributeUsage.alias` nie (`:49-52`), ein gesetztes `alias` würde nicht
  überschreiben, sondern wirkungslos bleiben. Der ehrliche Grund ist, dass der
  Typ kein Feld anbieten soll, das nichts tut.
- `architecture.md:62-64` — die Leitfrage »kennt die Klasse den Typ des Objekts,
  das sie herausgibt« passt auf Pools, nicht auf Geometrien; die beiden
  Geometrieklassen halten einen getypten Pool, sie geben nichts heraus.
- `architecture.md:67` — »Four classes stand across this line, and it is not a
  second rule«: »it« hat kein Bezugswort.
- `InstancedVOBufferGeometry.ts:29` — `{@link VOBufferGeometry} for instanced
  rendering` liest sich wie eine Vererbung, die es nicht gibt (die Klasse erbt
  von `InstancedBufferGeometry`).
- `VertexObjectBuffer.ts:39` — »although its name carries the long prefix«
  erklärt sich nur mit `architecture.md` daneben.
- `CHANGELOG.md:1305` — der »Before«-Block der Migrationsanleitung zeigt
  `TexturedSpritesPool` als Vorzustand; der Alias-Name wäre dort der wahre.
- Commit-Message — der Scope nannte `lookbook` nicht. **Vor dem Commit
  behoben**, siehe Verlauf zu Zug 5.

## Was der Abgleich ergeben hat

**API-003 besteht unverändert.** Alle drei Fundstellen des Findings sind
nachgesehen:

- `packages/twopoint5d/src/vertex-objects/public-api.ts` — exportiert weiterhin
  beide Präfixe nebeneinander; `VertexObjectPool extends VOBufferPool` und
  `VertexObjectGeometry extends VOBufferGeometry` stehen unverändert.
- `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:9-22`
  — `TexturedSpritesBasePool` (Plural) gegen `TexturedSpritePool` (Singular),
  `TexturedSpritesMaterialParameters` (Plural, in der Nachbardatei) gegen
  `TexturedSpriteGeometryParameters` (Singular).
- `packages/twopoint5d/src/map2d/public-api.ts:20` — `export * from './types.js'`,
  während `display/`, `texture/` und `vertex-objects/` `export type *` schreiben.

Belegt als vorbestehend: `git show 5657be6f:packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`
zeigt dieselben vier Typnamen; Paket 1 hat an dieser Datei nur den Import von
`cloneVertexObjectDescription` geändert.

**Die Regel aus »Entscheidungen« trifft den Code nicht an jeder Stelle, und das
ist der Grund, warum sie mit Ausnahmen geschrieben wird.** Die Entscheidung vom
2026-09-20 lautet: `VO*` ist die rohe Buffer-Schicht, `VertexObject*` die
typisierte Objektschicht. Für drei Klassenpaare stimmt das. Vier weitere Klassen
im Modul widerlegen es:

| Klasse | Wo sie steht | Was ihr Präfix sagt |
| --- | --- | --- |
| `VertexObjectBuffer` | rohe Schicht — hält die typed arrays und das Attribut-Layout, beide Schichten greifen darauf zu | sagt »typisiert«, ist es nicht |
| `VertexObjectDescriptor` | unter beiden Schichten — die geprüfte Description | dito |
| `VertexAttributeDescriptor` | dito, ein Attribut davon | dito |
| `VOUtils` | arbeitet auf einem `VO`, also am materialisierten Objekt | sagt »roh«, ist es nicht |

Der Grund steht in `types.ts:149` und `constants.ts`: `VO` ist der Name des
Vertex-Objekt-Typs selbst (`export interface VO { [voBuffer]; [voIndex] }`),
und `VOAttrSetter`, `VOAttrGetter`, `voBuffer`, `voIndex` folgen dieser Lesart.
Dasselbe Kürzel trägt im Modul zwei Bedeutungen: »das Vertex-Objekt« und »die
Schicht unter `VertexObject*`«.

Eine Regel, die ein Leser in vier Minuten mit `VOUtils` widerlegt, ist keine
verbindliche Regel. Die Entscheidung verbietet das Umbenennen; also wird die
Regel so geschrieben, dass sie beschreibt, was dasteht: die Linie verläuft an
der Frage »kennt die Klasse den Typ des Objekts, das sie herausgibt«, und die
vier Klassen, die quer dazu stehen, werden beim Namen genannt. Das führt die
Entscheidung aus, es kehrt sie nicht um — umbenannt wird nichts im
`vertex-objects`-Modul.

**Die Folge aus Paket 1 wird hier erledigt, nicht in einem Nachtragspaket.**
`TexturedSpriteGeometryParameters#attributeUsage` (`TexturedSpritesGeometry.ts:17-21`)
hält die anonyme Form `{dynamic?; stream?; static?}` nach, die Paket 1 eine
Datei weiter als `VertexAttributeUsageOverrides` veröffentlicht hat
(`cloneVertexObjectDescription.ts:8`, über `vertex-objects/public-api.ts:12`
exportiert). Die Triage-Tabelle nennt das ein Symptom und schneidet dafür ein
Nachtragspaket, wenn das verursachende Paket committet ist. Hier sind es
dieselben fünf Zeilen, die dieses Paket ohnehin umschreibt — das Interface, dem
sie gehören, wird in Schritt 4 umbenannt. Ein eigenes Paket wären zwei Commits
und zwei Reviews auf denselben Zeilen. Die `Folgen:`-Zeile unter Paket 1 sieht
das so vor.

**`TexturedSpriteMakeBaseSpriteArgs` kommt mit.** Vierter Singular-Schiefstand,
dieselbe Datei (`:12`), dieselbe Ursache, dieselbe öffentliche Oberfläche
(`sprites/public-api.ts:9`). Das Finding beschreibt die Klasse des Fehlers —
»In sprites ist die Singular/Plural-Trennung willkürlich« —, nicht eine
abschließende Liste. Zwei Zeilen darüber umzubenennen und diese stehenzulassen,
hinterließe genau den Zustand, den das Finding meldet.

**Aus »Offene Befunde« kommt nichts mit.** Die sieben `→ Scope`-Einträge liegen
sämtlich in `packages/twopoint5d/src/vertex-objects/` und haben je eine eigene
Ursache: Variablen-Shadowing in `createVertexObjectPrototype`, Getter, die eine
Referenz herausgeben, doppelte Felder im Descriptor, fehlende TSDocs an den
Typ-Aliasen in `types.ts`, pro Attribut neu gebaute `Set`s, ein »NOTE:«-Präfix an
`VOBufferPool#fromBuffersData()`, `as never` in Spec-Fixtures. Keiner davon
entstünde durch das, was dieses Paket tut, und keiner verschwände dadurch. Der
`types.ts`-Eintrag und der `VOBufferPool:232`-Eintrag liegen am nächsten — beide
betreffen TSDoc —, aber dieses Paket schreibt Klassenköpfe, die eine Schicht
benennen, und nicht die TSDoc-Pflege des Moduls. Die zwei `→ Audit`-Einträge
liegen in `apps/lookbook` und damit außerhalb der Scope-Regel.

## Vorgehen

### 1. Die Schichtregel in `packages/twopoint5d/docs/architecture.md`

Ein neuer Absatz im Abschnitt `### vertex-objects/ — the performance core`,
hinter der nummerierten Aufzählung (aktuell `:41-59`) und vor dem Absatz »The
consequence that matters when editing higher layers«. Inhalt, verbindlich
formuliert, nicht beratend:

1. `VO` ist überall im Modul die Abkürzung für »vertex object« — der Typ `VO` in
   `types.ts`, die Symbole `voBuffer` und `voIndex`, `VOAttrSetter`,
   `VOAttrGetter`.
2. Die Schichtgrenze läuft an einer Frage: kennt die Klasse den Typ des Objekts,
   das sie herausgibt? `VOBufferPool`, `VOBufferGeometry` und
   `InstancedVOBufferGeometry` kennen ihn nicht und arbeiten über
   Buffer-Indizes. `VertexObjectPool<VOType>`, `VertexObjectGeometry<VOType>` und
   `InstancedVertexObjectGeometry<VOInstancedType, VOBaseType>` erben von ihnen
   und geben getypte Objekte mit generierten Accessoren heraus.
3. Die Regel für eine neue Klasse: `VO*`, wenn sie ohne Objekttyp auskommt,
   `VertexObject*`, wenn sie einen trägt.
4. Vier Klassen stehen quer zu dieser Linie, und die Doku nennt sie beim Namen,
   damit niemand aus ihnen eine zweite Regel liest: `VertexObjectBuffer`,
   `VertexObjectDescriptor` und `VertexAttributeDescriptor` liegen unterhalb der
   Linie — beide Schichten benutzen sie —, und in `VOUtils` ist `VO` der Typname
   aus Punkt 1, nicht das Schichtpräfix.

Keine Formulierung, die den Vorzustand voraussetzt: kein »wurde nicht
umbenannt«, kein »bisher«, kein »Ausnahme von der Regel« im Sinne eines
Versäumnisses. Die vier Klassen werden als das beschrieben, was sie sind.

### 2. TSDoc-Köpfe an elf Klassen

Jede Klasse bekommt einen TSDoc-Block direkt über `export class`, ein bis drei
Sätze, der sagt, was sie tut **und** auf welcher Seite der Linie sie steht. Der
Inhalt je Klasse steht hier; die Formulierung gehört dem Implementierer.
`VertexObjects.ts:5-9` hat bereits einen Kopf, der die `THREE.Mesh`-Typslots
erklärt — dieser Satz bleibt stehen und bekommt den Schichtsatz dazu.

| Datei | Klasse (Zeile) | Was der Kopf sagt |
| --- | --- | --- |
| `VOBufferPool.ts` | `VOBufferPool` (12) | Legt die typed arrays für einen ganzen Pool an und besitzt sie; gibt Buffer-Indizes heraus, keine Objekte. Die Schicht unter `VertexObjectPool` |
| `VOBufferGeometry.ts` | `VOBufferGeometry` (15) | Reicht die Buffer eines `VOBufferPool` als eine `THREE.BufferGeometry` an three.js weiter. Die Schicht unter `VertexObjectGeometry` |
| `InstancedVOBufferGeometry.ts` | `InstancedVOBufferGeometry` (24) | Dasselbe für instanced Rendering: ein Basis-Pool und beliebig viele instanced Pools auf einer `THREE.InstancedBufferGeometry`. Die Schicht unter `InstancedVertexObjectGeometry` |
| `VertexObjectPool.ts` | `VertexObjectPool` (15) | Gibt `VOType`-Objekte heraus, deren generierte Getter und Setter in die Buffer des Pools schreiben. Die typisierte Schicht über `VOBufferPool` |
| `VertexObjectGeometry.ts` | `VertexObjectGeometry` (6) | Eine `VOBufferGeometry` über einem `VertexObjectPool<VOType>` |
| `InstancedVertexObjectGeometry.ts` | `InstancedVertexObjectGeometry` (13) | Eine `InstancedVOBufferGeometry` über zwei typisierten Pools: `VOBaseType` für die Basis-Geometrie, `VOInstancedType` je Instanz |
| `VertexObjectBuffer.ts` | `VertexObjectBuffer` (34) | Die typed arrays selbst samt dem Layout, das ein Attribut auf seinen Ausschnitt abbildet. Gehört der untypisierten Seite an, obwohl der Name das lange Präfix trägt — beide Schichten halten einen |
| `VertexObjectDescriptor.ts` | `VertexObjectDescriptor` (8) | Die geprüfte Description: was ein Vertex-Objekt an Attributen, Vertices und Indices hat. Liegt unter beiden Schichten |
| `VertexAttributeDescriptor.ts` | `VertexAttributeDescriptor` (14) | Ein einzelnes Attribut einer Description — Typ, Größe, Komponenten, Usage. Liegt unter beiden Schichten |
| `VOUtils.ts` | `VOUtils` (5) | Liest und setzt die beiden Symbol-Properties, die jedes Vertex-Objekt trägt (`voBuffer`, `voIndex`). `VO` ist hier der Typname aus `types.ts`, nicht das Schichtpräfix |
| `VertexObjects.ts` | `VertexObjects` (10) | Das `THREE.Mesh`, das eine `VOBufferGeometry` oder eine `InstancedVertexObjectGeometry` zeichnet — die Klasse, mit der beide Schichten in der Szene landen |

Ein Kopf, der den Namen nur wiederholt (»A pool of vertex objects.«), erfüllt
den Punkt nicht: der Satz muss die Schicht benennen.

### 3. `map2d/public-api.ts:20` auf `export type *`

`export * from './types.js';` wird zu `export type * from './types.js';`.
`map2d/types.ts` führt ausschließlich Interfaces (`IMap2DRenderableArea`,
`IMap2DTileDataProvider`, `IMap2DTileCoords`, `IMapTileFactory`,
`IMap2DTileRenderer`, `IMap2DVisibleTiles`, `IMap2DVisibilitor`,
`IMap2DVisibilitorHelpers`) — nachgesehen, kein Wert, keine Klasse, kein Enum.
`architecture.md` §1 schreibt diese Form bereits vor, `display/`, `texture/` und
`vertex-objects/` folgen ihr.

### 4. Die vier Typen in `TexturedSprites/TexturedSpritesGeometry.ts`

Umbenennen, je mit einem `@deprecated`-Alias, der ein Release lang stehen
bleibt. Das Muster dafür steht in `controls/PanControl2D.ts:143` und `:196`:
`@deprecated Use {@link Neu}.` plus ein Satz, der sagt, was der neue Name ist.

| Alt | Neu |
| --- | --- |
| `TexturedSpritePool` (`:10`) | `TexturedSpritesPool` |
| `TexturedSpriteGeometryParameters` (`:15`) | `TexturedSpritesGeometryParameters` |
| `TexturedSpriteMakeBaseSpriteArgs` (`:12`) | `TexturedSpritesMakeBaseSpriteArgs` |

`TexturedSpritesBasePool` (`:9`) bleibt, wie es ist — es trägt den Plural bereits.

Die Aliase stehen in derselben Datei, unter der jeweiligen Deklaration:

```ts
/** @deprecated Use {@link TexturedSpritesPool}. */
export type TexturedSpritePool = TexturedSpritesPool;
```

Im selben Zug bekommt `TexturedSpritesGeometryParameters#attributeUsage` den
Typ, der die Sache bereits deklariert — das ist die Folge aus Paket 1:

```ts
export interface TexturedSpritesGeometryParameters {
  capacity: number;
  attributeUsage?: Omit<VertexAttributeUsageOverrides, 'alias'>;
}
```

`VertexAttributeUsageOverrides` kommt per `import type` aus
`'../../vertex-objects/cloneVertexObjectDescription.js'` (Suffix `.js`, NodeNext).
Das `Omit` ist der Punkt und braucht einen Kommentar, der sagt **warum**: `alias`
gehört nicht in diese Parameter, weil die Geometrie die Aliase selbst setzt
(`TexturedSpritesGeometry.ts:42-45` — `size` → `quadSize`, `position` →
`instancePosition`); ein Aufrufer, der eigene setzte, überschriebe genau die
Abbildung, die das Sprite-Layout ausmacht.

Der Konstruktor (`:30-46`) und die beiden `declare`-Zeilen (`:25-26`) ziehen die
neuen Namen nach.

### 5. Die Aufrufer nachziehen

| Datei | Zeilen | Was |
| --- | --- | --- |
| `sprites/TexturedSprites/TexturedSprites.ts` | 6, 7, 21, 38 | Import und beide Verwendungen auf die neuen Namen |
| `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts` | 1, 25, 37 | `TexturedSpritePool` → `TexturedSpritesPool` |

Beide gehören zur Änderung, nicht zu den Nebenbefunden: ohne sie compiliert der
Stand nicht. `sprites/public-api.ts` braucht keine Änderung —
`export * from './TexturedSprites/TexturedSpritesGeometry.js'` nimmt die neuen
Namen und die Aliase mit.

### 6. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, unter `## [Unreleased]`, Keep a Changelog
1.1.0. Die Abschnitte `### Changed` (`:37`) und `### Deprecated` (`:161`)
existieren bereits — dort einsortieren, keine neuen anlegen:

- **Deprecated**: die drei alten Typnamen, je mit dem neuen daneben und dem
  Grund in einem Halbsatz (der Plural gehört dem Modul `TexturedSprites`, nicht
  einem einzelnen Sprite). Die Aliase halten ein Release; das gehört in den
  Eintrag, weil es die Migrationsfrist ist.
- **Changed**: `TexturedSpritesGeometryParameters#attributeUsage` nimmt
  `Omit<VertexAttributeUsageOverrides, 'alias'>`. Kein Breaking Change — die
  Form ist strukturell dieselbe —, aber der Typ steht jetzt unter einem Namen,
  den ein Aufrufer nennen kann. Dazu `map2d` exportiert seine Interfaces als
  Typen.

Kein Eintrag für die TSDoc-Köpfe und die `architecture.md`-Regel: Keep a
Changelog verzeichnet, was sich für einen Nutzer der Bibliothek ändert.

### 7. Was nicht zu diesem Paket gehört

- Keine Umbenennung im `vertex-objects`-Modul. Weder `VOUtils` noch
  `VertexObjectBuffer` noch die Descriptor-Klassen. Die Entscheidung vom
  2026-09-20 hält das fest, die Doku aus Schritt 1 beschreibt den Zustand.
- Keine TSDoc-Pflege an Methoden. Schritt 2 sind Klassenköpfe, sonst nichts.
- Keine Änderung an `sprites/AnimatedSprites/`. Dort trägt bereits alles den
  Plural; nachgesehen an `AnimatedSprites.ts`, `AnimatedSpritesGeometry.ts`,
  `AnimatedSpritesMaterial.ts`.

## Restplan — geprüft, unverändert

Paket 2 baut das Route-Plumbing von `VOBufferGeometry.ts` und
`InstancedVOBufferGeometry.ts` in ein neues `GeometryRoutes.ts` zusammen,
Paket 3 die Dirty-Ranges in `VertexObjectPool.ts`, `VertexObjectBuffer.ts` und
`VOBufferPool.ts`. Beide fassen Dateien an, die dieses Paket berührt — aber nur
deren Klassenköpfe, und keine Zeile Logik. Kein Schnitt verschiebt sich, keine
Reihenfolge: dass 1b vor 2 und 3 liegt, ist genau deshalb richtig, weil die
Schichtregel dann schon dort steht, wo die beiden umbauen.

Das neue `GeometryRoutes.ts` aus Paket 2 trägt keines der beiden Präfixe — es
ist ein Kollaborateur, kein Pool und keine Geometrie. Die Regel aus Schritt 1
spricht über Pools und Geometrien und trifft es nicht; sie zu weiten, wäre eine
Regel für einen Fall, den es noch nicht gibt.

## Findings im Volltext

**API-003 · medium · Öffentliche API · effort M · Re-Check: unchanged**
Fundstelle: `packages/twopoint5d/src/vertex-objects/public-api.ts:1-11`;
`sprites/TexturedSprites/TexturedSpritesGeometry.ts:9-15`;
`map2d/public-api.ts:20`

*Die zwei Namensschemata und die doppelte Klassenhierarchie in vertex-objects
vereinheitlichen*

Das vertex-objects-Modul exportiert dasselbe Konzept unter zwei Präfixen:
`VOBufferPool`/`VOBufferGeometry`/`VOUtils` neben
`VertexObjectPool`/`VertexObjectGeometry`/`VertexObjectBuffer`, wobei
`VertexObjectPool extends VOBufferPool` und `VertexObjectGeometry extends
VOBufferGeometry`. Am Namen ist nicht ablesbar, zu welcher Schicht eine Klasse
gehört. In sprites ist die Singular/Plural-Trennung willkürlich:
`TexturedSpritesBasePool` gegen `TexturedSpritePool`,
`TexturedSpriteGeometryParameters` gegen `TexturedSpritesMaterialParameters`
(die Klasse heißt `TexturedSpritesGeometry`). Nebenbei: `map2d/public-api.ts:20`
schreibt `export * from './types.js'`, jedes andere Modul `export type *`, wie
architecture.md §1 es vorschreibt. Re-Check: unverändert.

Empfehlung: Ein Präfix pro Schicht wählen und in architecture.md dokumentieren
(`VO*` = rohe Buffer-Schicht, `VertexObject*` = materialisierte Objektschicht) —
oder, da das Paket 0.x mit Migration-Guide-Gewohnheit ist, die vier
`VO*`-Klassen umbenennen und Typ-Aliase für ein Release behalten.
`TexturedSpriteGeometryParameters` → `TexturedSpritesGeometryParameters`,
`TexturedSpritePool` → `TexturedSpritesPool` mit deprecated Aliasen. map2d auf
`export type *`.

**Abweichung von der Empfehlung:** Von den zwei angebotenen Wegen gilt der
erste — dokumentieren statt umbenennen —, so entschieden am 2026-09-20 und im
Plan unter »Entscheidungen« festgehalten. Die dokumentierte Regel bekommt die
vier Ausnahmen dazu, die der Code enthält; der Grund steht oben unter »Was der
Abgleich ergeben hat«.
