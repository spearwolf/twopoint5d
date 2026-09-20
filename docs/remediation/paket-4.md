# Paket 4 — Descriptor und Description: die Seitentüren schließen, die Typen zu Ende benennen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-IDs. Sechs Einträge aus »Offene Befunde«, alle
  vorbestehend, gemeldet aus den Paketen 1 und 1b, alle `info`. Sie stehen
  unten unter »Befunde im Volltext« und werden hier als Schritt 1 bis 6
  geführt.
- Ziel: Was ein Descriptor über seine Getter herausgibt, führt nicht an den
  Prüfungen vorbei, die sein Konstruktor gefahren hat.
- Modell: mittlere Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/createIndicesArray.ts`
  - `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts`
  - `packages/twopoint5d/src/vertex-objects/types.ts`
  - `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.ts`
  - `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`. Nx bedient `test:ci` und `test:browser` gern aus dem
  Cache (`2/2 hit`), und dann misst der Lauf für diese beiden Gates nichts.
  Beide deshalb einmal nachfahren:
  `pnpm nx run-many -t test --projects=tag:ci --skipNxCache` und
  `pnpm nx run-many -t test --projects=tag:browser --skipNxCache`. Für den
  Browserlauf gilt die Entscheidung im Plan-Kopf: ein reiner
  Firefox-Verbindungsabbruch ist vorbestehende Flakiness, ein Fehlschlag auf
  Chromium ist rot. Während der Arbeit reicht
  `pnpm nx test twopoint5d -- src/vertex-objects/VertexObjectDescriptor.spec.ts`.
- Commit:

  ```
  fix(vertex-objects): freeze the description a descriptor built for itself, answer basePrototype and methods from that one copy, say what every exported type stands for, build the usage lookup of a clone once instead of once per attribute, and name the entries an attribute contributes to a prototype after what they are

  The descriptor specs assert against the description literals they declare, so the
  casts that switched the type check off over those literals are gone.

  BREAKING CHANGE: the description a VertexObjectDescriptor holds is frozen.
  descriptor.description, descriptor.indices, descriptor.methods and the components
  array behind descriptor.getAttribute(name) throw a TypeError on a write instead
  of changing a descriptor behind the checks its constructor ran.
  VertexObjectDescriptor#indices answers `readonly number[]` and
  VertexAttributeDescriptor#components `readonly string[]`, so a caller that
  assigns either to a mutable array names the readonly type instead. The
  basePrototype handed in and the individual functions of `methods` are left as
  they are — they are behaviour the descriptor shares, not structure it owns.
  ```

## Vorgehen

Die Schritte sind unabhängig voneinander bis auf 1 und 2, die denselben
Konstruktor anfassen — 1 zuerst. Code, Kommentare und TSDoc sind Englisch;
der Abschnitt »Konventionen« im Plan-Kopf gilt für jede Zeile, besonders die
Regel, dass kein Satz auf einen Vorzustand zurückblickt.

### Schritt 1 — die Description des Descriptors einfrieren

Das ist ein Korrektheitsfehler: `VertexObjectDescriptor` sagt im TSDoc seines
`description`-Feldes zu, dass spätere Änderungen ihm nichts anhaben, und sein
Konstruktor listet sechs Regeln, die für seine Lebenszeit gelten sollen.
`descriptor.indices.push(99)` bricht Regel 4, nachdem sie geprüft wurde. Also
**zuerst die Regressionstests, rot sehen, dann beheben** — der rote Lauf
gehört in den Report.

**Zuerst die Tests.** In `VertexObjectDescriptor.spec.ts`, als neuer
`describe`-Block hinter dem Test
`answers from its own copy of an attribute that declares size and components`
(endet auf Zeile 108) und vor `describe('the vertex object prototype')`
(Zeile 110). Vier Tests, drei davon müssen vor dem Fix rot sein:

1. ein Schreibversuch auf `descriptor.description` wirft `TypeError`, und die
   Description trägt danach denselben Wert (`vertexCount` ist der klarste Fall)
2. `descriptor.indices.push(99)` wirft `TypeError`, und `descriptor.indices`
   ist danach unverändert
3. `descriptor.getAttribute('pos')!.components.push('z')` wirft `TypeError`,
   und `descriptor.getAttribute('pos')!.components` ist unverändert — das ist
   die dritte Tür in dieselbe Kammer: `VertexAttributeDescriptor#components`
   (`VertexAttributeDescriptor.ts:63`) reicht dasselbe Array durch
4. eine Klasse, die als `basePrototype` übergeben wurde, nimmt danach noch
   eine Methode an — der Descriptor friert fremdes Verhalten **nicht** ein.
   Dieser Test ist vor dem Fix grün und hält die Grenze fest.

Die Specs laufen als ESM und damit im Strict Mode, in dem ein Schreibversuch
auf ein eingefrorenes Objekt wirft statt still zu scheitern.

**Dann der Fix**, in `VertexObjectDescriptor.ts`:

- Eine modul-lokale, **nicht exportierte** Funktion neben `isPositiveInteger`
  (Zeile 6), die eine Description tief einfriert. Nicht exportiert, weil sie
  genau einen Aufrufer hat und ein öffentliches `freeze` dazu einlüde, auch
  fremde Descriptions einzufrieren — was `cloneVertexObjectDescription()`
  gerade nicht tun darf.
- Eingefroren wird: die Description selbst, `indices`, `attributes`, jede
  Attribut-Description darin, deren `components`, und das `methods`-Objekt.
- **Nicht** eingefroren wird `basePrototype` und keine der Funktionen in
  `methods`. `cloneVertexObjectDescription()` nimmt beide bewusst per Referenz
  (siehe dessen TSDoc, `:30-33`): das ist Verhalten, das die Kopie teilt, und
  es gehört dem Aufrufer. Ein eingefrorener `Sprite.prototype` wäre echter
  Schaden.
- Aufruf im Konstruktor direkt hinter `this.description = cloneVertexObjectDescription(description)`
  (Zeile 69), also **vor** dem Füllen von `attributes`/`bufferNames` und vor
  `#validate()`. Damit ist die Zusage ab dem ersten Moment wahr; `#validate()`
  liest ausschließlich und stört das nicht.
- Das TSDoc des `description`-Feldes (Zeile 14-17) sagt den zweiten Teil der
  Zusage dazu: die Description ist eingefroren, ein Schreibversuch wirft.
- `get indices()` (Zeile 153-155) bekommt den Rückgabetyp `readonly number[]`,
  damit der Compiler es sagt, bevor die Laufzeit es tut.

**Mitzuziehen:** `createIndicesArray(indices: number[], …)`
(`createIndicesArray.ts:11`) nimmt `readonly number[]` — die Funktion liest
nur `length` und `indices[j]`. Ihr einziger Aufrufer ist
`initializeAttributes.ts:36-37`, das `descriptor.indices` destrukturiert.
`createIndicesArray` steht nicht in `vertex-objects/public-api.ts`, ist also
kein Teil der Oberfläche.

Der Blast Radius ist ausgemessen: `descriptor.indices` hat vier Leser
(`VertexObjectDescriptor.ts:106`, `VOBufferGeometry.ts:141`,
`InstancedVOBufferGeometry.ts:473`, `initializeAttributes.ts:36`), alle
lesend; `descriptor.description` hat genau einen
(`cloneVertexObjectDescription.ts:43`), lesend. Kein Produktionscode im Repo
schreibt in eine Descriptor-Innerei. Die drei Mutationen in den Specs
(`VertexObjectDescriptor.spec.ts:86, 87, 103`,
`cloneVertexObjectDescription.spec.ts:256`) gehen auf die **übergebene**
Quelle, nicht auf die Kopie des Descriptors, und bleiben unberührt.

### Schritt 2 — `basePrototype` und `methods` aus der einen Quelle antworten

`VertexObjectDescriptor.ts:23-24` und `:77-78` halten beide Werte als eigene
Felder neben der Description, die sie ebenfalls trägt. Ersetze die zwei
Felder durch Getter, die aus `this.description` antworten — genau die Bauart,
die `vertexCount`, `hasIndices` und `indices` in derselben Klasse schon
haben. Die Zuweisungen in Zeile 77-78 entfallen damit.

Signatur unverändert: `object | null | undefined` für beide. Geprüft:
`descriptor.basePrototype` hat einen einzigen Leser
(`createVertexObjectPrototype.ts:157`), `descriptor.methods` zwei
(`VertexObjectDescriptor.ts:115` und `vertexObjectPropertyNames.spec.ts:40, 51`),
alle lesend. Niemand spreadet eine `VertexObjectDescriptor`-Instanz — das
`{...descriptor}` in `VertexObjectPool.spec.ts:177` spreadet eine
`VertexObjectDescription`, ein Plain Object. Der Wechsel von Feld zu Getter
nimmt zwei Namen von der enumerablen Oberfläche des Descriptors, und genau
das ist im TSDoc von `voPrototype` (`:34-39`) schon als erwünscht begründet.

### Schritt 3 — die Lesefalle in `createVertexObjectPrototype()` auflösen

`createVertexObjectPrototype.ts:91` deklariert im `flatMap`-Callback ein
`const methods: unknown[]`, das die äußere Destrukturierung aus Zeile 84
verschattet; `if (methods)` auf Zeile 147 meint die äußere. Läuft korrekt,
liest sich falsch.

Umbenannt wird die **innere**: sie enthält keine Methoden, sondern Paare aus
Name und Property-Deskriptor, die am Ende zu `props` werden. Neuer Name
`attrEntries` — sie ist der Teil, den ein Attribut zur äußeren `entries`
beisteuert. Die äußere `methods` behält ihren Namen, weil sie das Feld
`descriptor.methods` trägt. Reine Umbenennung, sonst keine Zeile.

### Schritt 4 — jedem exportierten Symbol in `types.ts` seinen Satz geben

`types.ts` hat 19 exportierte Symbole; 17 davon tragen kein TSDoc. Der Befund
zählt neun Namen auf und sagt im Satz davor »die übrigen exportierten Typen
der Datei«. Die Aufzählung ist die unvollständigere der beiden Angaben, und
ein Paket, das die Typen zu Ende benennt, darf die Lücke nicht offenlassen.
Darum lautet das Ziel hier prüfbar: **kein exportiertes Symbol dieser Datei
ohne TSDoc** — ein Reviewer sieht das mit einem Blick, eine Namensliste
müsste er abhaken.

Ohne TSDoc sind: `TypedArray` (5), `VertexAttributeDataType` (17),
`VertexAttributeUsageType` (20), `VADescription` (25),
`VAComponentsDescription` (66), `VASizeDescription` (78), `VAComponentsType`
(116), `VASizeType` (117), `VertexAttributeDescription` (119),
`VertexAttributesType` (120), `VertexObjectDescription` (122), `VO` (149),
`VOAttrSetter` (158), `VOAttrGetter` (160), `BufferLike` (162),
`DrawUsageType` (164), `VertexObjectBuffersData` (166). Dazu die Felder
`VO#[voIndex]` (155) und die drei Felder von `VertexObjectBuffersData`
(167-169).

`TouchBuffersType` (23) und `VertexAttributeMethods` (96) haben eins und
bleiben, wie sie sind.

Ein Satz je Symbol, der sagt, wofür es steht und wer es benutzt — kein
Wiederholen des Namens in Prosa (»The TypedArray type is a typed array«).
Bei den vier Interfaces, deren Felder bereits dokumentiert sind
(`VADescription`, `VAComponentsDescription`, `VASizeDescription`,
`VertexObjectDescription`), gehört an den Kopf, was das Interface als Ganzes
ist und wie es zu seinen Geschwistern steht — `VADescription` etwa als die
gemeinsame Hälfte, die `VAComponentsDescription` und `VASizeDescription`
jeweils um ihre eine Art ergänzen, eine Attribut-Größe anzugeben.

### Schritt 5 — die Usage-Auflösung eines Klons einmal bauen

`cloneVertexObjectDescription.ts:64-83`: die drei `Set`s und die
Alias-Auflösung entstehen im `map`-Callback, also pro Attribut, obwohl sie
für die ganze Description dieselben sind. Hochziehen vor den
`Object.entries(...).map(...)`-Aufruf.

**Verhaltenserhaltend, und daran hängt die Sache.** Drei Dinge müssen
stehenbleiben:

1. Der Early Return bei `!attributeUsage` (Zeile 60-62) gibt `clonedDesc`
   **ohne** ein gesetztes `usage`-Feld zurück.
2. Der Early Return bei drei leeren Sets (Zeile 68-70) tut dasselbe. Das ist
   ein beobachtbarer Unterschied zum Rest: `{...clonedDesc, usage}` (Zeile 95)
   setzt das Feld auch dann, wenn keine Liste den Attributnamen nennt — dann
   steht dort `'static'` explizit statt implizit. Beide Wege müssen bleiben,
   wie sie sind.
3. Die Alias-Auflösung (Zeile 72-83) schreibt in dieselben Mengen, die sie
   prüft. Einmal ausgeführt liefert sie exakt das, was jede der bisherigen
   Ausführungen lieferte, weil jede von frischen Sets über dieselbe Schleife
   in derselben Reihenfolge lief.

Das Sicherungsnetz steht: `cloneVertexObjectDescription.spec.ts` hat 269
Zeilen und deckt Aliase, Usage-Wechsel und die Eigenständigkeit der Kopie ab.
Keine dieser Specs darf angefasst werden — außer der einen Zeile aus
Schritt 6.

### Schritt 6 — die `as never` von den Description-Literalen nehmen

Fünf Stellen: `VertexObjectDescriptor.spec.ts:97, 162, 168, 265` und
`cloneVertexObjectDescription.spec.ts:245`. Alle tragen `as never` auf einem
Attribut-Literal, das `size` und `components` zugleich deklariert. Der Cast
ist überflüssig: `VertexAttributeDescription` ist die Union
`VAComponentsType | VASizeType`, und TypeScript lässt in einem Literal für
eine Union jede Property zu, die in irgendeinem Member bekannt ist — `size`
kennt `VASizeType`, `components` kennt `VAComponentsType`. Was der Cast
stattdessen tut, ist die Typprüfung des ganzen Literals abzuschalten, und das
in Tests, deren Gegenstand genau diese Literale sind.

Ersatzlos streichen, keinen anderen Cast an ihre Stelle setzen. `tsc` im
Verify belegt es.

**Nicht anfassen:** `VertexObjectBuffer.spec.ts:678` und `:755` tragen
ebenfalls `as never`, aber nicht aus diesem Grund. Dort werden absichtlich
unzulässige Werte gebaut (`capacity: undefined`, ein `buffers`-Record aus
`unknown`), um einen Laufzeit-Guard zu prüfen; der Cast ist dort die
Voraussetzung des Tests, nicht eine abgeschaltete Prüfung. Sie bleiben, und
die Datei gehört nicht zu diesem Paket.

### Schritt 7 — CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, Keep a Changelog 1.1.0 unter
`## [Unreleased]`. Der Skill `updating-changelog` trägt die Regeln; er ist zu
laden, bevor eine Zeile dort entsteht.

- Ein Eintrag unter `### Changed` (Abschnitt beginnt auf Zeile 39): die
  Description eines Descriptors ist eingefroren, die drei Wege
  (`description`, `indices`, `getAttribute(name).components`) werfen auf einen
  Schreibversuch, `indices` antwortet `readonly number[]`; `basePrototype`
  und die einzelnen Funktionen aus `methods` bleiben unangetastet.
- Ein neuer `####`-Abschnitt unter `### Migration Guide` (Abschnitt beginnt
  auf Zeile 279), in der Machart der Nachbarn dort: was jetzt gilt, was ein
  Aufrufer stattdessen tut, und warum es so ist. Wer eine Description nach
  dem Bau des Descriptors noch ändern will, baut sie mit
  `cloneVertexObjectDescription()` um und übergibt sie einem neuen
  Descriptor — das ist der Weg, den die Bibliothek dafür anbietet.

Schritt 2 bis 6 sind für einen Aufrufer unsichtbar und gehören in keinen
Eintrag.

## Was dieses Paket ausdrücklich nicht anfasst

`VertexObjectDescriptor#attributes` und `#bufferNames` sind `readonly`-Felder
auf einer `Map` und einem `Set`, deren Inhalt ein Aufrufer verstellen kann —
`ReadonlyMap`/`ReadonlySet` wären der Zug, den Paket 2 für die drei
`extraInstanced*`-Sichten schon gemacht hat und Paket 5 für
`buffers`/`bufferSerials` noch macht. Sie gehören trotzdem nicht hierher:
eine Mutation daran umgeht keine Konstruktor-Prüfung, sie macht den
Descriptor bloß uneins mit seiner eigenen Description. Anderer Schaden,
andere Ursache, und das Ziel dieses Pakets zielt auf die Description.

Das heißt nicht, dass es niemandem auffallen soll: Wer
`VertexObjectDescriptor.ts` anfasst, liest sie ganz und meldet, was darin
falsch ist — das hier gehört dazu, als Nebenbefund im Report, nicht als
stille Mitnahme im Diff.

## Verlauf

- 2026-09-20 Zug 0: Detailplan steht · alle sechs Befunde am Code
  nachgesehen, keiner gegenstandslos · Fundstellen: Shadowing
  `createVertexObjectPrototype.ts:84, 91` unverändert · Getter-Durchreichung
  von Feld `:18` nach `:18` (Feld `description`) und Getter `:153-155`
  (`indices`) gewandert, Sachverhalt unverändert, dazu als dritte Tür
  `VertexAttributeDescriptor.ts:63` gefunden · Doppelfelder von `:18-19` nach
  `:23-24` und `:77-78` gewandert · die neun TSDoc-Lücken in `types.ts` auf
  den genannten Zeilen unverändert, Schritt auf alle 17 undokumentierten
  Exporte der Datei erweitert (Begründung in Schritt 4) · Sets in
  `cloneVertexObjectDescription.ts:64-83` unverändert · alle fünf `as never`
  auf den genannten Zeilen unverändert · keine offene `Folgen:`-Zeile zu
  triagieren, keinen weiteren Nebenbefund aus der Queue aufgenommen (die von
  Paket 5 liegen in anderen Dateien und teilen die Ursache nicht) · Restplan:
  Paket 5 unverändert bis auf den Zeilenhinweis auf `CHANGELOG.md`
- 2026-09-20 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort
  `high`, Brief in `paket-4.impl-0.brief.txt`
- 2026-09-20 Zug 2: Report `FERTIG` · acht Dateien geändert, keine neue ·
  Arbeitsbaum schmutzig · `pnpm run ci` selbst gefahren, exit=0
  (`paket-4.verify.log`); weil Nx beide Test-Gates aus dem Cache bediente
  (`1/1` und `2/2 hit`), beide nachgefahren mit `--skipNxCache`, exit=0 und
  exit=0 (`paket-4.verify-nocache.log`), kein Firefox-Abbruch ·
  `VertexObjectDescriptor.spec.ts` einzeln: 29 Tests grün
- 2026-09-20 Zug 3: Reviewer stärkste Stufe (opus), Effort `high` · alle sieben
  Schritte erfüllt · Qualität: 1 × wichtig (`VertexAttributeDescriptor.ts:62`
  sagt `string[]` auf einem eingefrorenen Array zu), 5 × klein, kein kritisch ·
  Diff: `paket-4.diff`, Report: `paket-4.review-0.json`
- 2026-09-20 Zug 4, Runde 1: offen waren der wichtige Befund und der kleine zur
  unvollständigen CHANGELOG-Aufzählung · derselbe Implementierer über
  `--resume 3e3a1397` · zurück kam `get components(): readonly string[]` samt
  `@ts-expect-error` im Regressionstest (roter Beleg: `TS2578: Unused
  '@ts-expect-error' directive`) und die vollständige Aufzählung in beiden
  CHANGELOG-Stellen · Verify erneut selbst gefahren, exit=0 dreimal
  (`paket-4.verify-r1.log`) · Reviewer über `--resume be522f4a` auf
  `paket-4.runde-1.diff`: beide Befunde geschlossen, kein kritisch, kein
  wichtig, drei kleine neu · offene Befunde 2 → 0
- 2026-09-20 Zug 5: committet als `853e5948`, neun Dateien · der grüne
  Verify-Lauf aus Runde 1 trägt ihn, seither hat niemand Code angefasst (der
  Arbeitsbaum wurde vor dem Commit Zeile für Zeile gegen `paket-4.runde-1.diff`
  gehalten, weil der Reviewer für seine Proben Dateien angefasst und
  wiederhergestellt hatte) · Commit-Message vor dem Commit um Schritt 3, den
  Wegfall der Casts und `VertexAttributeDescriptor#components` ergänzt

## Urteil des Reviewers je Schritt

Alle Fundstellen aus dem Report der Runde 0, nachgeprüft in Runde 1.

- **Schritt 1 behoben** — `freezeDescription()` in `VertexObjectDescriptor.ts:12-22`,
  nicht exportiert, Aufruf in `:87` vor dem Füllen von `attributes`/`bufferNames`
  und vor `#validate()`. Eingefroren sind Description (`:21`), `attributes` (`:20`),
  jede Attribut-Description (`:16`), deren `components` (`:15`), `indices` (`:18`)
  und das `methods`-Objekt (`:19`); `basePrototype` und die einzelnen Funktionen in
  `methods` bleiben unangetastet. Der Reviewer hat die Rot-Probe selbst gefahren:
  den Freeze-Aufruf auskommentiert → 3 failed | 26 passed, genau die drei
  Schreibversuchs-Tests; Datei wiederhergestellt → 29 passed.
- **Schritt 2 behoben** — `basePrototype` und `methods` antworten als Getter aus
  `this.description` (`VertexObjectDescriptor.ts:160-168`), Signatur unverändert
  `object | null | undefined`, die Felder sind weg.
- **Schritt 3 behoben** — die innere Sammlung heißt `attrEntries`
  (`createVertexObjectPrototype.ts:91`, gepusht in `:94, 105, 114, 132`,
  zurückgegeben in `:144`); die äußere `methods` aus `:84` behält ihren Namen,
  `if (methods)` in `:147` meint unverändert sie.
- **Schritt 4 behoben** — alle 19 Exporte von `types.ts` tragen TSDoc, dazu
  `VO#[voIndex]` (`:186`) und die drei Felder von `VertexObjectBuffersData`
  (`:212, 214, 216`). Kein Satz wiederholt bloß den Namen.
- **Schritt 5 behoben und verhaltenserhaltend** — `resolveUsageLookup()` in
  `cloneVertexObjectDescription.ts:30-53`, Aufruf in `:74` vor dem Objektliteral.
  Beide Early Returns liefern weiterhin ein `clonedDesc` ohne gesetztes
  `usage`-Feld (`:31` und `:37`, abgefangen in `:91`); die Alias-Auflösung
  (`:39-50`) läuft in derselben Reihenfolge über dieselben Mengen. Einziger
  Unterschied: der Lookup entsteht auch bei leeren `attributes` — unbeobachtbar.
- **Schritt 6 behoben** — kein `as never` mehr in beiden Spec-Dateien; die zwei in
  `VertexObjectBuffer.spec.ts:678` und `:755` sind unangetastet geblieben, wie es
  die Paketdatei verlangt.
- **Schritt 7 behoben** — `### Changed`-Eintrag in `CHANGELOG.md:41`,
  Migrationsabschnitt »The description of a descriptor is frozen« in `:282-311`,
  beide innerhalb von `[Unreleased]` (Released beginnt bei `:1993`). Das
  After-Beispiel ist lauffähig und wird vom Spec-Test `:149-162` abgefahren.

Blast Radius vom Reviewer nachgemessen: `descriptor.indices` hat nur Leser,
`descriptor.description` genau einen (`cloneVertexObjectDescription.ts:73`), und
alle exportierten `*Descriptor`-Konstanten in `sprites/` und `map2d/` sind Plain
`VertexObjectDescription`-Objekte, keine Instanzen — sie werden nie eingefroren.
`.components` hat sieben Leser, alle lesend; `tsc` über `src/` und alle Specs ist
der Beweis, dass die Verengung niemandem etwas wegnimmt.

## Kleine Befunde, offen gelassen

Aus Runde 0, vom Reviewer als `klein` eingestuft, bewusst nicht behoben:

- `VertexObjectDescriptor.ts:38` — `readonly description: VertexObjectDescription`
  sagt ein Objekt mit schreibbaren Feldern zu; ein Schreibversuch typprüft sauber
  und wirft zur Laufzeit. Eine tief-readonly Sicht auf die Description-Typen wäre
  der Zug, sie zöge aber alle Verbraucher von `VertexObjectDescription` mit. Steht
  als `Folgen:`-Zeile im Plan.
- `types.ts:145` und `:206` — die `{@link VertexObjectDescriptor}` und
  `{@link VOBufferPool}` zeigen auf Symbole, die diese Datei nicht importiert; im
  Editor und in TypeDoc löst der Link nicht auf. Dieselbe Machart steht seit jeher
  in `:121`. Wer die Links tragfähig will, nimmt `import type` dazu.

Aus Runde 1, neu:

- `VertexObjectDescriptor.spec.ts:144` — die `@ts-expect-error`-Direktive deckt die
  ganze Folgezeile statt nur den `push`. Der Reviewer hat es nachgewiesen:
  `getAttribute` in einen Namen geändert, den es nicht gibt, und `tsc` meldet
  nichts. Eng machen ließe sich das, indem der Aufruf aus der gedeckten Zeile
  wandert (`const attr = descriptor.getAttribute('pos')!;` davor).
- `CHANGELOG.md:41` und `:284` — die Aufzählung nennt fünf der sechs eingefrorenen
  Dinge; der `attributes`-Record (`VertexObjectDescriptor.ts:20`) fehlt in beiden.
  Der Lead-in deckt es dem Sinn nach, die Liste daneben nicht.
- Commit-Message — der `BREAKING CHANGE`-Footer nannte allein
  `VertexObjectDescriptor#indices`. **Vor dem Commit erledigt**: Subject und Footer
  in dieser Datei nennen jetzt auch die Umbenennung in
  `createVertexObjectPrototype.ts`, den Wegfall der Casts und
  `VertexAttributeDescriptor#components`.

## Nebenbefunde in die Queue

Alle sieben liegen im Modul, auf das die Scope-Regel zeigt, und sind vorbestehend;
sie stehen mit Urteil in »Offene Befunde« des Plans. Die Begründung des Urteils:
die Scope-Regel nennt `packages/twopoint5d/src/vertex-objects/` samt jeder
Severity, und jede der sieben Stellen liegt darin — `→ Scope`, ohne Ausnahme.
Keiner teilt die Ursache dieses Pakets (die Seitentüren des Descriptors), deshalb
nimmt dieses Paket keinen davon mit.

## Befunde im Volltext

Alle sechs stammen aus »Offene Befunde« im Plan, sind vorbestehend und als
`info` eingestuft. Der Wortlaut ist der der Queue.

**Schritt 1 · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:139-150`**
— die Getter `description` und `indices` geben die Kopie des Descriptors **per
Referenz** heraus. `descriptor.description.vertexCount = 0` oder
`descriptor.indices.push(99)` umgehen die Konstruktor-Prüfungen weiterhin, eine
Ebene weiter innen als zuvor. Der Weg über das übergebene Objekt ist zu, der über
den Descriptor selbst offen. Vorbestehend, Paket 1, info.
*Abgleich 2026-09-20:* `description` ist heute das `readonly`-Feld auf Zeile 18,
`indices` der Getter auf Zeile 153-155. Beide geben weiterhin die Referenz
heraus. Der schwerste der sechs, und der einzige Korrektheitsfehler.

**Schritt 2 · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:18-19`**
— `basePrototype` und `methods` stehen als eigene Felder **und** in `description`;
zwei Quellen für denselben Wert, die nur der Konstruktor synchron hält.
Vorbestehend, Paket 1, info.
*Abgleich 2026-09-20:* heute Zeile 23-24 (Deklaration) und 77-78 (Zuweisung),
Sachverhalt unverändert.

**Schritt 3 · `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:84, 91`**
— in `createVertexObjectPrototype()` verschattet die lokale
`const methods: unknown[]` der `flatMap`-Callback die äußere `const {methods} =
descriptor` aus Zeile 84; `if (methods)` auf Zeile 147 meint die äußere, und wer
die Funktion von oben liest, hält zwei verschiedene Dinge für eines. Läuft
korrekt, ist eine Lesefalle. Vorbestehend, Zug 0 von Paket 1, info (Lesbarkeit).
*Abgleich 2026-09-20:* Zeilen 84, 91 und 147 unverändert.

**Schritt 4 · `packages/twopoint5d/src/vertex-objects/types.ts:5, 17, 20, 155, 158, 160, 162, 164, 166-170`**
— die übrigen exportierten Typen der Datei tragen kein TSDoc
(`TypedArray`, `VertexAttributeDataType`, `VertexAttributeUsageType`,
`VO#[voIndex]`, `VOAttrSetter`, `VOAttrGetter`, `BufferLike`, `DrawUsageType`,
`VertexObjectBuffersData`). Paket 1 hat nur die Description-Typen dokumentiert.
Vorbestehend, Paket 1, info.
*Abgleich 2026-09-20:* alle genannten Zeilennummern stimmen noch exakt. Die
Aufzählung ist unvollständig — acht weitere Exporte der Datei tragen ebenfalls
keins; siehe Schritt 4 im Vorgehen.

**Schritt 5 · `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.ts:64-83`**
— die drei `Set`s und die Alias-Auflösung werden **pro Attribut** neu gebaut,
innerhalb des `map`-Callbacks, obwohl sie für die ganze Description dieselben
sind. Praktisch folgenlos (der Descriptor-Pfad reicht kein `attributeUsage` und
nimmt den Early-Return), aber redundant. Vorbestehend, Paket 1, info.
*Abgleich 2026-09-20:* Zeilen 64-83 unverändert.

**Schritt 6 · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts:162, 168, 265`**
— drei Fixtures tragen `as never` auf einem Description-Literal, was
die Typprüfung des ganzen Literals abschaltet, obwohl TypeScript bei einer Union
alle Properties zulässt, die in irgendeinem Member bekannt sind. Der Reviewer hat
die Casts testweise entfernt: `tsc --noEmit` und 260 Tests blieben grün. Die zwei
Fixtures, die Paket 1 im selben Muster hinzugefügt hat (`:97` und
`cloneVertexObjectDescription.spec.ts:245`), fallen mit. Vorbestehend, Paket 1,
info.
*Abgleich 2026-09-20:* alle fünf Zeilen unverändert.
