# Paket 9 — vertex-objects: Geometrie-Name, Ownership-TSDoc und Regelreihenfolge

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: CONS-024 (low), CONS-038 (low)
- Ziel: Eine kopierte Geometrie behält ihren Namen, und die Ownership-Texte
  beschreiben, was tatsächlich passiert.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts`
  - `packages/twopoint5d/src/vertex-objects/asInstancedCopySource.ts`
  - `packages/twopoint5d/src/vertex-objects/asThreeTypedArray.ts`
  - `packages/twopoint5d/src/sprites/matrixColumn.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`
  - `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(vertex-objects): keep the geometry name across a copy and check the descriptor rules in the order they are written down`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · CONS-024 unverändert, beide Hälften an
    der Quelle von three 0.185.1 belegt (`BufferGeometry.js:1374` schreibt
    `this.name = source.name`, `:1390-1394` setzt `attribute.clone(data)`) ·
    CONS-038 unverändert (`VertexObjectDescriptor.ts:79-92` gegen TSDoc
    `:38-54`) · dieselbe falsche Ownership-Prämisse an drei vom Finding nicht
    genannten Stellen gefunden (`InstancedVOBufferGeometry.ts:548-549`,
    `GeometryAttributeSlots.ts:60`, `CHANGELOG.md:66` und `:178`) und
    aufgenommen · die vom Finding genannte `#vacatedSlots`-TSDoc trägt die
    Prämisse nicht und bleibt · Folgen aus Paket 7 und 8 als Symptome
    eingeordnet, neues Paket 10 geschnitten · kein Nebenbefund aus der Queue
    kommt herein
  - 2026-09-20 Zug 1: Implementierer beauftragt · `claude -p`, Modell sonnet,
    Effort medium, Session `remediate-twopoint5d-p9-impl-1` · Brief
    `paket-9.impl-1.brief.txt`, Report nach `paket-9.impl-1.json`
  - 2026-09-20 Zug 2: Report `FERTIG` · 9 Dateien geändert, keine neue ·
    3 rote Tests vor dem Fix im Wortlaut im Report · `pnpm run ci` selbst
    gelaufen, exit=0, Log `paket-9.verify.log` · Arbeitsbaum schmutzig
  - 2026-09-20 Zug 3: Reviewer `remediate-twopoint5d-p9-review-1` (sonnet,
    medium) · beide Findings mit allen Teilhälften behoben, Qualität ohne
    Befund · Diff `paket-9.diff` (385 Zeilen, 9 Dateien), Report
    `paket-9.review-1.json`
  - 2026-09-20 Zug 5: keine Fehlerkette nötig, 1 Runde · committet als
    `1ac62496` auf dem Verify-Lauf aus Zug 2, seither keine Codeänderung

## Urteil des Reviewers

- **CONS-024 behoben**, alle drei Hälften: der Name sitzt auf
  `InstancedVOBufferGeometry.ts:125` hinter dem `if/else`-Block und gilt für
  beide Konstruktorpfade; die Ownership-Begründung steht an allen fünf Stellen
  auf `copy()` klont (`InstancedVOBufferGeometry.ts` Konstruktorkommentar,
  `dispose()`-TSDoc und `#syncAttributeArrays()`, `GeometryAttributeSlots.ts`
  `claimExisting()`-TSDoc, die beiden CHANGELOG-Einträge); die drei
  Versionszitate nennen `three 0.185.1` bzw. `@types/three@0.185.4`, und im
  Quellbaum steht kein `0.183` mehr außer dem richtigen `(was ~0.183.1)` im
  Upgrade-Eintrag des CHANGELOG.
- **CONS-038 behoben**: `VertexObjectDescriptor.ts:78-91` prüft die Größe in
  einer eigenen Schleife über alle Attribute und danach die Komponenten in
  einer zweiten. Die Fehlermeldungen und das TSDoc sind wortgleich geblieben.
- **Qualität: keine Befunde**, auch keine kleinen. Der Reviewer hat den
  Namenstest ausdrücklich gegen die Basisklasse geprüft, die inhaltliche
  Wahrheit der neuen Sätze gegen `BufferGeometry.js:1374` und `:1390-1394`
  gehalten und die Konventionen (keine Finding-IDs, kein Rückblick, Englisch)
  einzeln durchgegangen.
- Der Implementierer meldete drei Abweichungen, alle ohne Befund geblieben:
  der neue `Fixed`-Eintrag steht am Ende von `### Fixed` nach dem Wortlaut des
  Auftrags statt hinter dem darin namentlich genannten Nachbarn; die
  Umformulierungen in `#syncAttributeArrays()` und `claimExisting()` sind frei
  gesetzt; der Reihenfolgetest nutzt `as never` wie sein Nachbartest, weil der
  Typ `size` und `components` gemeinsam nicht erlaubt.
- Der Implementierer hat alle drei Versionszitate selbst gegen `node_modules`
  nachgeprüft — keine der zitierten Aussagen war überholt, nur die Nummer.
- Weder Nebenbefunde noch Folgen: beide Berichte sind hier ausdrücklich leer,
  der Implementierer hat `packages`, `apps` und `docs` nach der Prämisse
  »belong to the caller« und nach `0.183.1` durchsucht.

## Abgleich

| Finding | Stand | Fundstelle heute |
| --- | --- | --- |
| CONS-024 | unverändert, alle Teilaussagen belegt bis auf eine | `InstancedVOBufferGeometry.ts:99`, `:110-111`, `:354-355`; `asInstancedCopySource.ts:10` |
| CONS-038 | unverändert | `VertexObjectDescriptor.ts:79-92`, TSDoc `:38-54` |

**CONS-024, Hälfte »Name«.** `this.name = 'InstancedVOBufferGeometry'` steht auf
Zeile 99, `this.copy(asInstancedCopySource(args[2]))` auf Zeile 109.
`BufferGeometry#copy()` schreibt in three 0.185.1 auf
`node_modules/three/src/core/BufferGeometry.js:1374` `this.name = source.name` —
eine `BufferGeometry`, die der Aufrufer ohne Namen baut, trägt `''`, und das
landet auf der Geometrie. Die Subklasse `InstancedVertexObjectGeometry` ist
nicht betroffen: sie setzt ihren Namen auf `InstancedVertexObjectGeometry.ts:33`
nach `super()`, also nach dem `copy()`.

**CONS-024, Hälfte »Ownership«.** `BufferGeometry#copy()` klont jedes Attribut —
`BufferGeometry.js:1390-1394`, `this.setAttribute(name, attribute.clone(data))`.
Was nach dem `copy()` an der Geometrie hängt, sind eigene Objekte mit eigenen
typed arrays; die Geometrie des Aufrufers bleibt unangetastet und ist nach dem
Konstruktor aus dem Spiel. Jede Aussage »sie gehören dem Aufrufer« ist damit
falsch begründet, auch wo die Schlussfolgerung daneben stimmt.

Das Finding nennt zwei Stellen. Dieselbe Prämisse steht an drei weiteren, und
eine vierte, die es nennt, trägt sie nicht:

| Stelle | Befund |
| --- | --- |
| `InstancedVOBufferGeometry.ts:110-111` | vom Finding genannt — »belong to the caller« |
| `InstancedVOBufferGeometry.ts:354-355` (`dispose()`-TSDoc) | vom Finding genannt — »they belong to the caller« |
| `InstancedVOBufferGeometry.ts:548-549` (`#syncAttributeArrays()`) | **neu** — »it belongs to the caller and is left exactly as it is« |
| `GeometryAttributeSlots.ts:60` (`claimExisting()`-TSDoc) | **neu** — »they belong to the caller« |
| `CHANGELOG.md:66`, `:178` (beide unter `## [Unreleased]`) | **neu**, veröffentlichte Doku — »because they belong to the caller« / »they belong to the caller« |
| `#vacatedSlots`-TSDoc (`InstancedVOBufferGeometry.ts:45-56`) | trägt die Prämisse **nicht**: sie spricht von Routen (»belongs to the route it fell back to«), nicht vom Aufrufer, und ist richtig. Bleibt unangetastet |

Alle fünf teilen die Ursache des Findings und kommen deshalb in dieses Paket;
drei Stellen aus einer halb behobenen Ursache wären sonst ein eigenes Paket
wert. `CHANGELOG.md:180` sagt nur, an wen ein Slot zurückgeht, und ist richtig —
bleibt.

**CONS-024, Hälfte »Versionszitate«.** Drei Kommentare zitieren `0.183.1`,
installiert sind `three@0.185.1` und `@types/three@0.185.4`
(`pnpm-workspace.yaml:11` sagt `three: ~0.185.1`):
`asInstancedCopySource.ts:10`, `asThreeTypedArray.ts:6` und
`sprites/matrixColumn.ts:5`. Die letzte liegt außerhalb des Paketbereichs im
Grobplan, trägt aber denselben Fehler aus derselben Ursache und kommt mit — ein
eigenes Paket für eine Zeile ist teurer als der Blick beim Vorbeigehen. Die
zitierte Aussage von `asInstancedCopySource.ts` habe ich gegen die installierte
Version nachgeprüft: `three/src/core/InstancedBufferGeometry.js:36-44` trägt
`copy()` unverändert, nur die Nummer ist alt.

**CONS-038.** `#validate()` prüft Regel 3 und Regel 4 in einer gemeinsamen
Schleife über die Attribute (`VertexObjectDescriptor.ts:79-92`), während das
TSDoc auf `:38-54` eine Reihenfolge 1–6 zusagt und »The first rule that fails
throws«. Eine Beschreibung, in der ein früheres Attribut Regel 4 bricht und ein
späteres Regel 3, meldet Regel 4.

## Entscheidungen dieses Pakets

**Der Klassenname gewinnt, auch wenn die Quellgeometrie einen Namen trägt.** Die
Zuweisung wandert hinter den `if/else`-Block und gilt damit für beide
Konstruktorpfade gleich. Der Name ist die Selbstbeschreibung der Klasse — die
Subklasse überschreibt ihn nach `super()` bereits so, und ein Pfad, der ihn vom
Zufallsnamen einer hereingereichten Geometrie abhängig macht, wäre die einzige
Ausnahme im Modul.

**CONS-038 bekommt zwei Schleifen, nicht ein umformuliertes TSDoc.** Beide Wege
stehen in der Empfehlung. Der Code holt die Doku ein statt umgekehrt, weil die
Liste 1–6 eine Zusage über die Fehlermeldung ist und dieses Projekt seine
Meldungen sehr bewusst schreibt — ein Aufrufer mit mehreren kaputten Attributen
sieht dann zuerst das grundsätzlichere Problem (Größe unter 1) statt des
feineren (zu viele Komponenten). Die Kosten sind eine zweite Iteration in einem
Konstruktor, der einmal je Descriptor läuft. Ein TSDoc, das eine
Implementierungseigenart zur Spezifikation erklärt (»Regeln 3 und 4 je
Attribut«), liest sich schlechter und macht die Liste wertlos.

**Kein eigener CHANGELOG-Eintrag für CONS-038.** Die Reihenfolge war bereits
zugesagt, der Code hielt sie nur nicht ein; beide Fälle werfen einen
`RangeError`, und ein Konsument konnte den Unterschied nur sehen, indem er zwei
Regeln zugleich brach. Eine `Fixed`-Zeile dafür wäre Rauschen. CONS-024 bekommt
eine, weil `geometry.name` eine gelesene öffentliche Eigenschaft ist.

**Keine Browser-Testfläche.** Die Konvention verlangt beide Testflächen für
Änderungen an Rendering- oder GPU-Buffer-Code. Hier bewegt sich weder ein Buffer
noch ein Attribut: `name` ist ein Label, die Regelreihenfolge eine Validierung
vor dem ersten Buffer, der Rest sind Kommentare. Vitest genügt.

## Vorgehen

Reihenfolge einhalten: erst die Regressionstests, rot sehen, den roten Lauf in
den Report, dann die Fixes.

1. **Regressionstest für den Namen.** In
   `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`,
   in den bestehenden Block `describe('constructed with a BufferGeometry', …)`
   (heute ab Zeile 639). Der Test muss die **Basisklasse** `InstancedVOBufferGeometry`
   bauen, nicht `InstancedVertexObjectGeometry` — die Subklasse setzt ihren Namen
   nach `super()` und wird nie rot. Dafür den Import
   `import {InstancedVOBufferGeometry} from './InstancedVOBufferGeometry.js';`
   ergänzen. Zwei Fälle:
   - `keeps the name of its class when it is built from a BufferGeometry`: eine
     `BufferGeometry` mit einem `position`-Attribut wie in den Nachbartests,
     `new InstancedVOBufferGeometry(instancedDesc, 10, base)`, erwartet
     `geometry.name === 'InstancedVOBufferGeometry'`. Vor dem Fix `''`.
   - `takes no name from the geometry it is built from`: dieselbe Geometrie mit
     `base.name = 'a geometry of the caller'`, dieselbe Erwartung. Vor dem Fix
     `'a geometry of the caller'`.
2. **Regressionstest für die Regelreihenfolge.** In
   `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts`, in den
   bestehenden Block `describe('refuses a description the layout cannot hold', …)`
   (heute ab Zeile 123). Ein Test wie
   `the size of a later attribute before the components of an earlier one`: eine
   Beschreibung mit `attributes: {a: {size: 1, components: ['x', 'y']}, b: {size: 0}}`
   — das erste Attribut bricht Regel 4, das zweite Regel 3. Erwartet wird die
   Meldung von Regel 3 (`/needs a size of at least 1/`). Vor dem Fix kommt die
   von Regel 4 (`declares 2 components for a size of 1`).
3. **Den Namen hinter das `copy()` legen.** In
   `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts` die
   Zeile 99 (`this.name = 'InstancedVOBufferGeometry';`) entfernen und hinter den
   `if/else`-Block des Konstruktors setzen — heute zwischen die schließende
   Klammer auf Zeile 123 und `this.#attachments.attach(this.instancedPool);` auf
   Zeile 125. Mit einem Kommentar, der die Stellung trägt und den nächsten Leser
   davon abhält, sie wieder nach oben zu ziehen, sinngemäß:
   `// after the copy(): BufferGeometry#copy() takes the name of its source, which is usually the empty string`
4. **Die vier Code-Stellen auf die richtige Prämisse umschreiben.** Die Aussage,
   die überall dieselbe ist: `copy()` **klont** die Attribute, also sind es
   eigene Objekte dieser Geometrie mit eigenen typed arrays, kein Pool speist
   sie, und die hereingereichte Geometrie bleibt unangetastet. Was daraus folgt,
   stimmt an jeder Stelle bereits und bleibt stehen — es bekommt nur die
   tragfähige Begründung. Kein Rückblick auf den Vorzustand, die Konvention gilt.
   - `InstancedVOBufferGeometry.ts:110-111` — heute »the attributes that came in
     with it belong to the caller and are claimed before any route initializes,
     so a route that takes such a slot gives it back when it is released«. Der
     Nachsatz ab »claimed« bleibt inhaltlich; die erste Hälfte wird zu »copy()
     cloned those attributes, so they are this geometry's own and no pool feeds
     them«.
   - `InstancedVOBufferGeometry.ts:354-355` (`dispose()`-TSDoc) — heute
     »Attributes copied from a `BufferGeometry` handed to the constructor stay
     where they are — they belong to the caller.« Neu: dass sie bleiben, weil
     kein Pool sie speist und nichts sie abzunehmen hat, und dass sie samt ihrer
     typed arrays dieser Geometrie gehören und mit ihr fallen, während die
     Geometrie, aus der sie geklont wurden, unberührt bleibt.
   - `InstancedVOBufferGeometry.ts:548-549` (`#syncAttributeArrays()`) — heute
     »a slot without a pool holds an attribute copied from a `BufferGeometry` the
     caller handed to the constructor: it belongs to the caller and is left
     exactly as it is«. Die Begründung wird der wahre Grund: hinter einem Slot
     ohne Pool gibt es kein Pool-Array, das eingehängt werden könnte.
   - `GeometryAttributeSlots.ts:60-62` (`claimExisting()`-TSDoc) — heute »These
     come from a `BufferGeometry` copied into the geometry: they belong to the
     caller, no pool feeds them, …«. »they belong to the caller« wird zu »sie
     gehören der Geometrie, die sie hält«; der Rest des Satzes bleibt.
5. **Die Versionszitate auf die installierte Version bringen.** Vor dem Ändern
   die zitierte Aussage je einmal gegen `node_modules` prüfen und nur die Nummer
   nachziehen, wenn sie noch trägt; trägt sie nicht mehr, gehört das als
   Abweichung in den Report und der Kommentar wird gerade gerückt.
   - `asInstancedCopySource.ts:10`: `three 0.183.1` → `three 0.185.1`. Bereits in
     Zug 0 nachgeprüft: `three/src/core/InstancedBufferGeometry.js:36-44` trägt
     `copy()` unverändert.
   - `asThreeTypedArray.ts:6`: `@types/three@0.183.1` → `@types/three@0.185.4`.
   - `packages/twopoint5d/src/sprites/matrixColumn.ts:5`:
     `@types/three@0.183.1` → `@types/three@0.185.4`.
6. **Die Regeln 3 und 4 entflechten.** In
   `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts` die Schleife
   auf Zeile 79-92 in zwei Schleifen über `this.attributes.values()` teilen: die
   erste prüft nur `isPositiveInteger(attr.size)`, die zweite nur die
   Komponenten gegen `raw.size`. Beide Fehlermeldungen bleiben Wort für Wort, wie
   sie sind, ebenso der Kommentar zur rohen Beschreibung auf Zeile 85. Das TSDoc
   auf `:38-54` bleibt unverändert — es wird jetzt eingelöst.
7. **CHANGELOG.** Alles unter `## [Unreleased]`, also änderbar.
   - Der Eintrag auf Zeile 66 (`### Changed`) endet heute mit »attributes copied
     from a `BufferGeometry` passed to `InstancedVOBufferGeometry` stay where
     they are, because they belong to the caller«. Die Begründung wird dieselbe
     wie im TSDoc: geklont, keinem Pool zugehörig, Eigentum der Geometrie, die
     Quellgeometrie unberührt.
   - Der Eintrag auf Zeile 178 (`### Fixed`) sagt »they belong to the caller, and
     this constructor path has no base pool to resolve them against«. Die erste
     Hälfte wird zu »no pool declares them«; die zweite bleibt.
   - Ein neuer `Fixed`-Eintrag (Abschnitt ab Zeile 167) für den Namen: eine
     `InstancedVOBufferGeometry`, die aus einer `BufferGeometry` gebaut wird,
     antwortet auf `name` mit `'InstancedVOBufferGeometry'` statt mit dem Namen
     der Quellgeometrie. Ein Satz, in der Gangart der Nachbareinträge.
   - Kein Migrationsabschnitt: kein Aufrufer bricht.

## Was dieses Paket nicht anfasst

- `#vacatedSlots` und seine TSDoc (`InstancedVOBufferGeometry.ts:45-56`) — die
  Prämisse steht dort nicht drin, siehe Abgleich.
- `CHANGELOG.md:180` — die Aussage über den Slot, der an die Route zurückgeht,
  ist richtig.
- Das Verhalten von `dispose()` gegenüber den geklonten Attributen. Sie bleiben
  an der Geometrie stehen; das ist kein Leak, weil die Geometrie danach selbst
  fällt und die Arrays mit ihr. Das Finding will die Begründung geradegerückt,
  nicht den Pfad umgebaut.
- `InstancedVertexObjectGeometry.ts` — die Subklasse setzt ihren Namen bereits
  an der richtigen Stelle.
- `packages/twopoint5d/dist/` — Build-Artefakt, in `.gitignore:5`.
- Die Einträge aus »Offene Befunde« im Plan: keiner liegt in `vertex-objects/`
  oder teilt die Ursache dieses Pakets.

## Findings im Volltext

**CONS-024 · low · Konsistenz · effort S ·
`packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:99, 108-112, 354-355; asInstancedCopySource.ts:10`**
— Den Geometrie-Namen nach `copy()` setzen und die kopierten Attribute nicht
mehr »dem Aufrufer« zuschreiben

`BufferGeometry.copy()` überschreibt `name` mit dem der Quelle (meist `''`),
eine aus einer `BufferGeometry` gebaute `InstancedVOBufferGeometry` verliert
also ihren Namen. Es *klont* außerdem jedes Attribut mit kopiertem Array, die
Attribute in `claimExisting()` sind also eigene Objekte dieser Geometrie, nicht
die des Aufrufers — die Kommentare in 110-111 und 354-355 und das Feld-TSDoc
argumentieren Ownership von einer falschen Prämisse aus. Beide Helfer zitieren
zudem »three 0.183.1«, installiert ist 0.185.1.

Empfehlung: `this.name = …` unter den `copy()`-Zweig verschieben; die zwei
Kommentare und das TSDoc von `#vacatedSlots`/`dispose()` auf »aus der
übergebenen Geometrie geklont, hier besessen, nie von einem Pool gespeist«
umformulieren; die Versionszitate aktualisieren oder die genaue Nummer streichen.

**CONS-038 · low · Konsistenz · effort S ·
`packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:79-92 (TSDoc :39-50)`**
— Die Regeln des VertexObjectDescriptor in der dokumentierten Reihenfolge prüfen

Das TSDoc verspricht »The first rule that fails throws« in der Reihenfolge 1–6.
Regeln 3 und 4 laufen aber je Attribut verschränkt: verletzt das erste Attribut
Regel 4 und ein späteres Regel 3, wirft Regel 4 zuerst. Wirkung nur auf die
Fehlermeldung. Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: Zwei Schleifen (erst Regel 3 über alle Attribute, dann Regel 4) oder
das TSDoc auf »je Attribut« präzisieren.

## Triage der offenen Folgen

Zug 0 dieses Pakets ist der letzte vor dem Abschluss und hat deshalb alle noch
offenen `Folgen:`-Zeilen des Laufs zu verteilen. Vier Einträge aus zwei Paketen,
alle als Symptom eingeordnet, beide verursachenden Pakete committet — daraus ein
Nachtragspaket 10 (Begründung für das Zusammenlegen dort).

| Aus | Fundstelle | Einordnung |
| --- | --- | --- |
| Paket 7 | `texture/FrameBasedAnimations.ts:161-167` — `add()` vergibt den Auto-Namen vor der Prüfung von `frames` und `duration`, der Zähler bleibt nach einem Wurf vorgerückt | Symptom: wäre nie entstanden, wenn Paket 7 den Namen erst nach der Validierung vergeben hätte. Der Effekt ist kosmetisch, die Reihenfolge trotzdem falsch — eine Methode, die wirft, hinterlässt keinen Seiteneffekt. → Paket 10 |
| Paket 7 | dieselbe Stelle, `if (name)` behandelt den leeren String als »kein Name« | **kein Befund**: von der Paketdatei zu Paket 7 ausdrücklich so gewollt, der Zweig bleibt. Wird in Paket 10 nicht angefasst |
| Paket 8 | `stage/Stage2D.ts:124` — die TSDoc des `camera`-Setters verschweigt, dass die Projektion diese Kamera bei jedem `updateProjection()` und jedem Resize an die Projektionsebene zurückholt | Symptom: die Doku, die der eigene Umbau umgeworfen hat, gehört zu ihm. → Paket 10 |
| Paket 8 | `stage/ParallaxProjection.ts:139`, `OrthographicProjection.ts:135` — `updateCamera()` wirft ab jetzt auf einer Projektion ohne Plane, in keinem CHANGELOG-Eintrag genannt | Symptom, dieselbe Ursache. → Paket 10 |
| Paket 8 | `stage/Canvas2DStage.ts:149-156` — `setContainerSize()` reicht bei unveränderter Größe kein `stage.resize()` mehr durch, Verhaltensänderung ohne CHANGELOG-Zeile | Symptom, dieselbe Ursache. → Paket 10 |

Keine echte Folge im Sinne der Tabelle: keiner der vier Einträge hat eine eigene
Ursache, alle vier sind Doku- oder Reihenfolgenarbeit, die das verursachende
Paket nicht zu Ende gezogen hat.
