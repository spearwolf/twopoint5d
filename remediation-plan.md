# Remediation-Plan — @spearwolf/twopoint5d

Quelle: ./audit.html vom 2026-09-02 · Branch: main · erstellt: 2026-09-03
Baseline: `pnpm lint` ✓ · `NX_TUI=false pnpm build` ✓ · `pnpm test:ci` ✓ · `NX_TUI=false pnpm checkPkgTypes` ✓
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/de85034e-f845-4f1e-9e83-d2c4d63622be/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Scope: 18 vom Nutzer benannte Findings (4 high, 10 medium, 3 low, 1 info) · ausgenommen: alles übrige Backlog, `acknowledged`
Scope-Regel: alles, was im Kern von `packages/twopoint5d/src/vertex-objects/` oder in `packages/twopoint5d/src/sprites/` auffällt, wird in diesem Lauf mit behoben — unabhängig von Severity und Kategorie. Was außerhalb dieser beiden Bereiche liegt, geht als neues Finding ins Audit.
Stand (2026-09-04): **abgeschlossen.** 14 Pakete committet, 18 von 18 Findings des Scopes erledigt, 16 Nebenbefunde mit behoben. Kein Paket blockiert, »Offene Befunde« leer. Paket 15 wurde nicht umgesetzt, sondern als Finding ins Audit übernommen (siehe »Entscheidungen«). Verify-Lauf über alle vier Kommandos grün, Tests ohne Nx-Cache: 1406 Tests in 90 Dateien.

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[!]` blockiert.

## Verify-Kommandos

Vor jedem Commit vollständig, in dieser Reihenfolge:

```
pnpm lint
NX_TUI=false pnpm build
NX_TUI=false pnpm checkPkgTypes
pnpm test:ci
```

**Berichtigt am 2026-09-03 (Zug 0 von Paket 4):** `pnpm test:ci` fährt die
Playwright-Browsertests **mit**. `packages/twopoint5d-testing/project.json:3`
trägt den Tag `ci`, und `--projects=tag:ci` wählt das Projekt damit aus —
nachgesehen in den Verify-Logs von Paket 3 und 7, wo das vierte Kommando beide
Projekte testet und `pnpm web-test-runner` ausführt. Der Satz, der hier vorher
stand, hat Paket 3 zu der Annahme verleitet, die Browsersuite bliebe außen vor,
und Paket 7 hat sie zweimal gefahren. Ein fünftes Kommando gibt es nicht; die
vier oben sind vollständig.

## Entscheidungen

Alle vom Nutzer am 2026-09-03 getroffen.

- **`onDestroyVO` fällt aus der öffentlichen API.** Vorher verifiziert: das
  Symbol existiert ausschließlich in `VertexObjectPool.ts` und dessen Spec —
  kein Lookbook, kein anderes Package, keine Dokumentation außer der
  CHANGELOG-Historie. Begründung des Nutzers: die Engine soll nicht bei jedem
  `destroy()` eines Vertex-Objekts einen Callback abfeuern. `onCreateVO`
  bleibt unangetastet.
- **`createVO()` behält sein Laufzeitverhalten und bekommt einen ehrlichen
  Rückgabetyp:** `(VOType & VO) | undefined`. Das `@ts-ignore` fällt weg.
- **`autoTouch` bleibt der Default und wird nur dokumentiert.** Die generierten
  Setter bekommen kein Serial-Inkrement — der heiße Schreibpfad zahlt nichts.
  Dokumentiert wird, wie sich der Upload über `autoTouch: false` plus
  manuelles `touch()` gezielt steuern lässt.
- **`resize()` bleibt eine Pre-Geometry-Operation und setzt das zur Laufzeit
  durch.** Verifiziert gegen three.js 0.183.1: `BufferAttribute.count` wird
  einmalig im Konstruktor gesetzt (`src/core/BufferAttribute.js:86`), der
  GPU-Buffer wird bei `updateAttribute()` nur beschrieben und nie neu angelegt
  (`WebGPUAttributeUtils`), und ausgetauschte Attribute verlieren ihren
  GPU-Buffer dauerhaft, weil er nur über das `dispose`-Event der Geometry
  freigegeben wird (`renderers/common/Geometries.js:194-208`). Ein dynamisches
  Resize einer lebenden Geometry ist damit nicht implementierbar; `resize()`
  wirft künftig, sobald der Pool an eine Geometry gebunden ist.
- **`float16` wird auf `Float16Array` umgestellt**, der Engine-Floor steigt
  entsprechend auf Node ≥24.
- Nebenbefunde: siehe Scope-Regel im Kopf.
- **Keine Versionsanhebung in diesem Lauf (2026-09-04).** Die Bewertung ist eindeutig
  `0.21.2` → `0.22.0`: mehrere Breaking Changes an der öffentlichen Oberfläche
  (`onDestroyVO` entfernt; `createVO()` und `IProjection#projectionPlane` liefern
  `| undefined`; `resize()` wirft bei angebundener Geometry; `float16` bedeutet
  Half-Float; `dispose()` lässt fremde Pools in Ruhe) und ein angehobener
  Engine-Floor auf Node ≥24. Unter `1.0.0` hebt ein Breaking Change die
  Minor-Stelle. Umgesetzt wird sie hier trotzdem nicht: Der Skill
  `updating-changelog` dieses Repos untersagt ausdrücklich, eine Versionsüberschrift
  zu schneiden oder ein Datum zu setzen — Releases laufen über einen eigenen
  Schritt, den `git log` als `chore: release …` zeigt. Die Einträge bleiben unter
  `[Unreleased]`, `packages/twopoint5d/package.json` bleibt auf `0.21.2`.
  Entscheidung des Nutzers.
- **Der Lauf endet nach Paket 14; Paket 15 und die restliche Queue gehen ins Audit
  (2026-09-03).** Der Abschluss hatte sich eine Kette aus vier Generationen geschnitten
  (Paket 12 → 13 → 14 → 15), alle um `dispose()` gegen three.js, mit der Ursache in
  Paket 1 und Paket 7. Entscheidung des Nutzers: nicht weiter im Abschluss, sondern als
  neue Findings in die `audit.html`. Der Bereich bekommt bei Bedarf einen eigenen Lauf
  mit eigener Planung und eigener Freigabe. Diese Entscheidung **überstimmt die
  Scope-Regel** für die verbliebenen Einträge: vier von ihnen liegen in `sprites/` bzw.
  `vertex-objects/` und wären nach der Regel im Scope. Sie gehen trotzdem ins Audit.
- **Paket 11 wird ohne nachgezogenes Review angenommen (2026-09-03).** Wie schon
  bei Paket 6 hat Runner B implementiert, verifiziert und committet in einer
  Person; die Schleife hat es erkannt und mit Exit 20 angehalten. Beide Fälle
  betrafen ein Paket, das im Detailplan als `opus/low` eingestuft war — die
  sieben Pakete auf `high` haben ihre Kette sauber durchlaufen. Gegenprobe der
  steuernden Session über `02a57fa`: voller Verify-Lauf grün (inklusive
  Playwright-Suite und dem neuen `prettier --check` im Gate), und der Diff ist
  über alle 61 Dateien nachweislich rein formatierend — nach Entfernen von
  Whitespace und Kommata zeichenidentisch bis auf sieben Dateien, die einzeln
  gelesen wurden (Zeilenumbrüche, `bracketSpacing: false`, eine
  präzedenzerhaltende Klammerung). Entscheidung des Nutzers: annehmen, kein
  Review — der mechanische Vergleich belegt mehr als ein Reviewer-Urteil über
  einen Reformat könnte.
- **Paket 6 bleibt committet, das Review wird nachgezogen (2026-09-03).** Runner B
  von Paket 6 hat Implementierer und Reviewer übersprungen und in einer Person
  implementiert, verifiziert und committet; die Schleife hat das erkannt und mit
  Exit 20 angehalten. Gegenprobe der steuernden Session über `0ae2932`: `lint`,
  `build`, `checkPkgTypes` und `test:ci` grün, die letzten drei ohne Nx-Cache,
  repo-weit kein `@ts-ignore` mehr. Entscheidung des Nutzers: der Commit bleibt
  stehen, ein unabhängiges Review über genau diesen Diff wird nachgeholt; findet
  es etwas, behebt es ein Folge-Commit. Paket 6 gilt erst als abgenommen, wenn
  dieses Review vorliegt.

## Konventionen

Gelten für jede Zeile, die in diesem Lauf entsteht — Code, Kommentare,
Dokumentation, CHANGELOG, Migrations-Hinweise, Commit-Messages:

- Inline-Kommentare sind erwünscht, wo sie erklären, *warum* etwas so ist.
- Keine Finding-IDs, auch nicht in der Commit-Message. Sie gehören diesem einen
  Audit, sind danach tot, und die Commit-Message überdauert den Lauf. Sie leben
  in diesem Plan und sonst nirgends; die Verbindung zwischen Finding und Commit
  trägt das Feld `Hash:` unter dem Paket — in genau der Richtung, in der jemand
  sie später sucht. Eine Commit-Message sagt in eigenen Worten, was sie ändert.
- Kein Rückblick auf den Vorzustand: kein »früher«, kein »statt bisher«, kein
  »im Zuge des Audits umgestellt«. Der Test: Ergibt der Satz für jemanden Sinn,
  der den Vorzustand nie gesehen hat? Dann bleibt er. Braucht er ihn, gehört er
  in die Commit-Message — die Historie ist bereits konserviert.

Projektspezifisch ergänzt:

- Conventional Commits, Commit-Messages auf Englisch (so zeigt es `git log`).
- **Source-Imports tragen die `.js`-Endung** (NodeNext-ESM), auch wenn die
  Quelle `.ts` ist. Typen werden mit `import type` importiert
  (`@typescript-eslint/consistent-type-imports` ist scharf geschaltet).
- **Neue öffentliche Symbole müssen in die passende `public-api.ts`**, sonst
  sind sie nicht Teil des Pakets. Alles, was dort nicht steht, ist intern.
- `no-console` ist ein Lint-Fehler in `.ts`/`.js`.
- Jedes Paket, das sichtbares Verhalten ändert, trägt seinen Eintrag in
  `packages/twopoint5d/CHANGELOG.md` unter `Unreleased` nach — nach den Regeln
  des Skills `updating-changelog` (Keep a Changelog 1.1.0; veröffentlichte
  Abschnitte sind unveränderlich; API-Brüche brauchen einen Migrationshinweis).
- Die Bibliothek nutzt `@spearwolf/eventize` und `@spearwolf/signalize`. Wer
  Event- oder Signal/Effect-Code anfasst, lädt vorher `using-eventize` bzw.
  `using-signalize`.

## Vorbestehende Fehler

Keine. Alle vier Verify-Kommandos liefen vor Beginn grün.

Anmerkung zur Baseline: `pnpm build` schlug beim ersten Versuch fehl, weil
`@tailwindcss/vite` nicht installiert war — der Store hinkte dem Commit
`1cfb8cf` hinterher. Nach `pnpm install --frozen-lockfile` grün, Lockfile und
Arbeitsbaum unverändert. Kein Finding, kein Teil des Scopes.

## Offene Befunde

Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:205,309`
  — ein Attribut-Slot der Geometry hat keinen Besitzer: wird derselbe Pool unter
  zwei Namen angebunden, verdrängt die zweite Anbindung die
  `THREE.BufferAttribute`s der ersten aus den Slots, und nach dem Abbau der
  zweiten Route erreicht `touchAttributes()` nur noch das verwaiste `BufferLike`
  der ersten — die Daten stimmen, der Upload wird nicht angestoßen
  (nachgemessen: `version` bleibt auf `0`). Aus Paket 1, vom Reviewer gegen
  `git show HEAD:…` als vorbestehend belegt. Der saubere Fix verlangt, dass die
  Geometry weiß, welche Route einen Slot besitzt, und ihn beim Abbau an eine
  überlebende Route zurückgibt — Umfang eines eigenen Pakets, das
  `initializeAttributes`, `initializeInstancedAttributes`, beide
  Geometry-Klassen, `removeAttributes`, `selectAttributes` und
  `updateUpdateRange` anfasst. Severity: medium. → Scope · **entschieden 2026-09-03:**
  in Paket 7, zusammen mit den drei Folgen aus Paket 1, die dieselbe Ursache haben.
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:330-332`
  — `#syncAttributeArrays()` greift im `else`-Zweig unbedingt auf
  `this.basePool.buffer` zu; auf dem Konstruktorpfad mit einer fremden
  `BufferGeometry` bleibt `basePool` `undefined` und der Zugriff wirft, sobald
  ein Attribut weder zum Instanced- noch zum Base-Pool gehört. Aus Paket 1.
  Severity: medium. → Scope · **entschieden 2026-09-03:** deckungsgleich mit
  BUG-023 — dasselbe `else` an derselben Zeile, das Audit zählt es unter der
  alten Zeilennummer 287. Kein eigener Eintrag, wird in Paket 2 behoben.
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:392-394,423`
  — dieselbe ungeprüfte Dereferenzierung von `basePool` in `update()` und in der
  Attributnamen-Sammlung. Aus Paket 1. Severity: medium. → Scope ·
  **gegenstandslos, 2026-09-03:** beide Stellen stehen in einem `if (this.basePool)` —
  Zeile 389 umschließt 392-394 in `#updateDrawRange()`, Zeile 422 umschließt 423 in
  `#getAutoTouchAttributeNames()`. Ein `grep -n 'basePool' InstancedVOBufferGeometry.ts`
  über den Stand `db79e61` zeigt genau eine ungegatete Dereferenzierung, und das ist
  die aus dem Eintrag darüber (330/332). Die übrigen Zugriffe stehen entweder hinter
  einem Guard (206, 228, 244, 363, 389, 422) oder gehen durch `updateUpdateRange()`,
  das mit `if (pool && buffers)` öffnet (379).
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:374`
  (fortgeschrieben nach Paket 5, vorher `:368`)
  — `let buffers: TouchBuffersType | TouchInstancedBuffersType;` ohne
  Initialisierung, danach über `{...buffers, ...arg}` gelesen; läuft nur durch,
  weil `{...undefined}` legal ist. Das Gegenstück in `VOBufferGeometry.ts` setzt
  explizit `= undefined` (`VOBufferGeometry.ts:100`). Aus Paket 1. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:289,309-316`
  — die private `#serials`-Map behält Einträge für Attributnamen, die es nicht
  mehr gibt; wird ein Name später neu belegt, vergleicht der erste Durchlauf
  gegen die Version des toten Attributs und synchronisiert einmal zu viel oder
  zu wenig. Aus Paket 1. Severity: low. → Scope · **entschieden 2026-09-03:**
  in Paket 7. Dieselbe Ursache: erst mit einem Besitzer je Slot ist überhaupt
  benennbar, wann ein Name die Belegung wechselt. Der Freigabepfad dort meldet die
  gewechselten Namen zurück, und der Serial-Eintrag geht mit ihnen. Ohne eigenen
  roten Test — `#checkBufferSerials()` verdeckt den Fall in `update()`, sobald sich
  der Buffer-Serial des Pools bewegt; die Begründung steht im Detailplan.
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:65`
  — `this.copy(args[2] as any)` kopiert eine fremde `BufferGeometry` samt ihrer
  Attribute in die Geometry, bevor `initializeInstancedAttributes()` läuft;
  diese Attribute gehören keinem Pool und stehen in keiner Route, also außerhalb
  der Anbindungs-Buchhaltung. Aus Paket 1. Severity: low. → Scope ·
  **entschieden 2026-09-03:** in Paket 7. Dieselbe Ursache wie der erste Eintrag —
  ein Slot ohne Besitzer —, nur von der anderen Seite: hier kennt die Buchhaltung
  den Slot gar nicht. Der Sync-Pfad dieser Attribute gehört dagegen zu BUG-023 und
  wird in Paket 2 festgelegt (überspringen statt dereferenzieren).
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:190`
  — `dispose()` gibt über `detachAll()` alle Anbindungen frei, lässt die
  Attribute aber auf der Geometry stehen; für die Absicht von Paket 1 richtig,
  aber wer eine disposte Geometry erneut in eine Szene hängt, bekommt vom
  Renderer neue GPU-Buffer aus alten TypedArrays. Aus Paket 1. Severity: low.
  → Scope · **entschieden 2026-09-03:** in Paket 2, zu MEM-008. Sobald ein
  eigener Pool `dispose()` statt `clear()` bekommt, wird der Eintrag scharf: die
  `THREE.BufferAttribute`s halten die typisierten Arrays weiter fest, und genau
  deren Freigabe ist der Zweck von MEM-008. Ohne diese Hälfte ist MEM-008 halb
  behoben.
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:87,124` —
  `clear()` und `fromBuffersData()` schreiben `#usedCount` am Setter vorbei; die
  Klemme auf `[0, capacity]` ist damit eine Eigenschaft des Setters und keine
  Klasseninvariante. Aus Paket 1. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:129` — `const
  buffer = this.buffer.buffers.get(bufferName)!;` unmittelbar gefolgt von
  `if (buffer)`; das Non-Null-Assertion behauptet, was die Folgezeile bezweifelt.
  Aus Paket 1. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts:21` und
  `initializeInstancedAttributes.ts:16` — das Ergebnis von
  `bufferNameAttributes.get(...)` wird ungeprüft mit `.length` weiterverwendet.
  Aus Paket 1. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:761` —
  der Test `getVO() / createVO() are no-ops after dispose()` verspricht im Namen
  eine Zusicherung, die sein eigener Kommentar einräumt nicht zu prüfen;
  assertiert wird nur `isDisposed`. Aus Paket 1. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:140`
  (fortgeschrieben nach Paket 7, vorher `:139`)
  — beim Einpacken eines Deskriptors in `attachInstancedPool()` bekommt der neue
  Pool hart `capacity: 1`, während der TSDoc der Methode zwei Absätze höher
  verlangt, dass die Kapazitäten zueinander passen. Wer einen Deskriptor statt
  eines Pools übergibt, bekommt einen Pool für genau eine Instanz und keinen Weg,
  das zu ändern. Aus Paket 2. Severity: medium. → Scope · **entschieden 2026-09-03:**
  in Paket 5. Dieselbe Ursache wie die zweite Hälfte von TYPE-003 — der Attach-Pfad
  setzt den eingepackten Pool zu nichts an der Geometry in Beziehung, weder im Typ
  noch in der Kapazität —, und es sind dieselben drei Zeilen, die dort ohnehin
  umgeschrieben werden.
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:28-31`
  — `poolTypedArrayOf()` liefert `undefined` für zwei verschiedene Lagen: der Pool
  kennt den Namen nicht, oder er kennt ihn und hat nach seinem `dispose()` keinen
  Buffer mehr. Im zweiten Fall fällt die Suche zum nächsten Pool durch, statt
  stehenzubleiben. Aus Paket 2. Severity: low. → Scope · **entschieden 2026-09-03:**
  in Paket 7. Dieselbe Ursache — ein Slot ohne Besitzer zwingt zum Probieren. Die
  Funktion fällt dort samt `#poolArrayOf()` weg, weil die Auflösung genau einen Pool
  fragt und nicht mehr durchfallen kann.
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:135` und
  `InstancedVOBufferGeometry.ts:403` (fortgeschrieben nach Paket 7, vorher `:134`
  und `:402`) — der TSDoc-Block von
  `#syncAttributeArrays()` trägt ein `TODO add tests`, obwohl die
  `fromBuffersData`-Fälle in `vertex-buffers-geometry-updates.spec.ts` genau
  diesen Pfad prüfen. Aus Paket 2. Severity: low. → Scope · **entschieden 2026-09-03:**
  in Paket 5. Das Paket schreibt genau diese Methode in beiden Klassen um; ein
  nachweislich falsches `TODO` in dem Doc-Block stehen zu lassen, den man gerade
  bearbeitet, ist die Widersprüchlichkeit, die die Konvention im Kopf verbietet.
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:389-390`
  (fortgeschrieben nach Paket 7, vorher `:388-389`)
  — `update()` ruft dort `#updateBuffersUpdateRange()` vor `#autoTouchAttributes()`,
  `VOBufferGeometry#update()` (`:121-122`) ruft dieselben beiden in umgekehrter
  Reihenfolge.
  Beides funktioniert; zwei Klassen mit derselben Aufgabe sollten dieselbe
  Reihenfolge haben. Aus Paket 2. Severity: low. → Scope · **entschieden 2026-09-03:**
  in Paket 5. Das Paket fasst beide `update()`-Körper an; die Divergenz stehen zu
  lassen, während man in beiden steht, wäre dieselbe Widersprüchlichkeit wie beim
  Eintrag darüber. Nachgesehen, dass die Reihenfolge frei ist: `needsUpdate = true`
  erhöht in three nur `version`, `updateUpdateRange()` schreibt nur
  `updateRanges` — die beiden lesen einander nicht.
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.ts:42`
  — `asPool<VOBaseType>(args[2], args[3] || 1)` macht aus einer ausdrücklich
  übergebenen Base-Kapazität `0` eine `1`; die Basisklasse benutzt an derselben
  Stelle `args[3] ?? 1` und lässt die `0` durch. Die beiden Konstruktoren sind
  sich uneins. Aus Paket 2. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:603` und
  `vertex-buffers-geometry-updates.spec.ts:750` — zwei fast gleichlautende
  Testnamen (»releases the pool it replaces« / »releases the pool it displaces«)
  für zwei verschiedene Dinge: einmal die Anbindung, einmal `dispose()`. Aus
  Paket 1, in Paket 2 sichtbar geworden. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d-testing/test/` — die Browsertest-Suite deckt Display,
  Stage und TextureStore ab, aber keinen Pfad aus `vertex-objects/`. `CLAUDE.md`
  verlangt für Rendering- und GPU-Buffer-Änderungen einen Browsertest, und Paket 2
  hat die Upload-Range der Geometry umgestellt, ohne dass dort etwas davon
  ankommt — der Zusatzlauf war grün, weil er den Pfad nicht kennt. Es fehlt ein
  Fall, der einen echten Upload mit `vertexCount > 1` gegen die GPU fährt. Aus
  Paket 2. Severity: low. → Scope · **verteilt in Paket 12** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:517-531`
  — `#getAutoTouchAttributeNames()` baut pro Aufruf ein Array, und
  `[...Array.from(pool.descriptor.attributes.values())]` kopiert das Array, das
  `Array.from` gerade gebaut hat, ein zweites Mal. Aus Paket 2. Severity: low.
  → Scope · **entschieden 2026-09-03:** gehört zu Paket 5, das die Allokationen
  im Update-Pfad ohnehin herausnimmt. Kein eigenes Paket. · **fortgeschrieben nach
  Paket 7:** `#liveBuffers()` ist samt seinem einzigen Aufrufer gelöscht, die zweite
  Fundstelle des Eintrags ist damit weg; es bleibt die hier genannte
  (jetzt `:517-531`). · **im Detailplan von Paket 5 aufgelöst, 2026-09-03:** die
  Methode fällt dort ganz weg — die Auto-Touch-Auswahl wird als `BufferLike[]`
  zwischengespeichert, und die Namen entstehen nur noch innerhalb dieser einen
  Berechnung.
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:457`
  (fortgeschrieben nach Paket 5, vorher `:465`) —
  `if (this.instancedPool)` in `#checkBufferSerials()` ist immer wahr:
  `instancedPool` ist `readonly` und wird im Konstruktor bedingungslos gesetzt
  (`:36`, `:64`). Der Guard daneben (`if (this.basePool)`, `:461`) ist echt, dieser
  liest sich wie einer. Vorbestehend, nachgesehen an `60f7612:…:324`. Aus Paket 7.
  Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:531` —
  `typedArrays.has(bufAttr.array as any)` im Testhelfer `attributesBackedBy()`; das
  `as any` verdeckt, dass `Set<TypedArray>` und `BufferAttribute['array']` sich im
  Typ nicht decken. Vorbestehend. Aus Paket 7. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts:1` und
  `initializeInstancedAttributes.ts:2` — beide Import-Zeilen verletzen die
  Prettier-Konfiguration des Repos (`{ BufferGeometry}`, `{ InstancedBufferAttribute`).
  `pnpm lint` ist `eslint .` und prüft keine Formatierung, deshalb fällt es nicht auf;
  `npx prettier --check` auf beide Dateien meldet sie. Nachgesehen an `70309b2`:
  identisch, also von Paket 7 nicht verursacht. Aus Paket 7. Severity: low. → Scope
  · **erweitert in Zug 0 von Paket 5 (2026-09-03):** `VOBufferGeometry.ts:2` und
  `InstancedVOBufferGeometry.ts:1-8` gehören zur selben Familie — auch dort meldet
  `npx prettier --check` die Import-Blöcke, und zwar nur diese (nachgemessen:
  2 bzw. 8 Zeilen Diff, sonst nichts). Diese beiden erledigt Paket 5 mit, weil
  sein Implementierer ohnehin in genau diesen Import-Blöcken steht. Die vier
  ursprünglich genannten Dateien bleiben offen und gehören der Drain-Runde,
  zusammen mit der Frage, ob `pnpm lint` Prettier mitfahren lassen sollte.
  · **fortgeschrieben nach Paket 5 (2026-09-03):** die beiden Geometry-Dateien sind
  erledigt und aus diesem Eintrag heraus. Dafür kommt eine fünfte Datei derselben Familie
  hinzu: `vertex-buffers-geometry-updates.spec.ts` (zwei Stellen um `:1122` und `:1196`).
  Vorbestehend, nachgesehen mit `git show HEAD~1:… | npx prettier --check
  --stdin-filepath` — die Stellen melden sich auch im Stand vor dem Commit. · **verteilt in Paket 11** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:17-57`
  (fortgeschrieben nach Paket 3, vorher `:17-35`) — `spritePool`, `createSprite()`,
  `freeSprite()` und die beiden `texture`-Accessoren
  dereferenzieren `this.geometry` bzw. `this.material` ungeprüft, obwohl beide Felder als
  `| undefined` deklariert sind und `dispose()` sie genau darauf setzt. Nach einem `dispose()`
  wirft jeder dieser Zugriffe (nachgemessen gegen `dist/lib` vom Stand `34ce3e3`:
  `TypeError: Cannot read properties of undefined (reading 'instancedPool')` bzw.
  `(reading 'colorMap')`), während `VertexObjects#update()` denselben Fall mit
  `this.geometry?.` abfängt. Eigene Ursache, nicht die der ungebundenen Convenience-API.
  Vorbestehend, `sprites/` ist seit `60f7612` unverändert. Aus Paket 3. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts`,
  `AnimatedSprites/AnimatedSpritesMaterial.ts` (dort nur noch der Import-Block),
  `TexturedSprites/TexturedSpritesGeometry.ts`
  und `TexturedSprites/TexturedSpritesMaterial.ts` — alle vier verletzen die
  Prettier-Konfiguration des Repos (`bracketSpacing: false`, `printWidth: 130`);
  `npx prettier --check` meldet sie, `pnpm lint` ist `eslint .` und prüft keine Formatierung.
  Dieselbe Ursache wie der Eintrag zu `initializeAttributes.ts` weiter oben. Vorbestehend.
  Aus Paket 3. Severity: low. → Scope · **verteilt in Paket 11** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:53` und
  `AnimatedSprites/AnimatedSpritesGeometry.ts:18` — `this.basePool.createVO().make(...)`
  dereferenziert den Rückgabewert ungeprüft, obwohl `createVO()` seit Paket 1
  `(VOType & VO) | undefined` liefert. Derzeit unerreichbar, weil die Base-Pool-Kapazität `1`
  ist und genau ein Objekt erzeugt wird — es sind aber die einzigen beiden Stellen der
  Bibliothek in diesem Bereich, die den ehrlichen Rückgabetyp ignorieren. Vorbestehend: schon
  vor Paket 1 fiel `createVO()` zur Laufzeit auf `undefined` durch, der Typ verschwieg es nur
  (nachgesehen an `60f7612:…/VertexObjectPool.ts:76-83`). Aus Paket 3. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/map2d/TileSprites/TileSpritesGeometry.ts:17` — dieselbe
  ungeprüfte Dereferenzierung von `this.basePool.createVO()` wie im Eintrag darüber, dritte
  Fundstelle derselben Ursache. Aus Paket 3. Severity: low. → Audit — die Scope-Regel greift
  nicht, `map2d/` liegt außerhalb von `vertex-objects/` und `sprites/` · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:7` — das
  Interface `AnimatedSpritesMaterialParameters` ist nicht exportiert, steht aber im
  Konstruktor der exportierten Klasse; im veröffentlichten `.d.ts` erscheint es als lokale
  Deklaration hinter `export {}`, sodass ein Consumer den Optionstyp nicht benennen kann.
  Jedes Geschwister-Material exportiert seinen Parametertyp
  (`TexturedSpritesMaterialParameters`, `TexturedSpriteGeometryParameters`). Vorbestehend.
  Aus Paket 3. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/sprites/node-utils.ts:47-49` — `(modelViewMatrix as any)[0].y`,
  dreimal in einer Zeile, mit dem Kommentar »XXX fix me - this is a hack but it seems to be
  that the types for modelViewMatrix are wrong«. Der Cast dokumentiert eine Typlücke von
  three.js und ist damit vermutlich kein Verhaltensfehler, sondern ein Kandidat für den
  benannten Cast-Helfer, den Paket 6 für den VO-Kern einführt. Vorbestehend. Aus Paket 3.
  Severity: low. → Scope · **entschieden 2026-09-03:** in Paket 6 aufgenommen. Dieselbe
  Ursache wie dessen zweite Hälfte — eine Typlücke von three, die niemand benannt hat —, und
  der Eintrag war beim Notieren schon darauf ausgerichtet. Wird dort zu
  `sprites/matrixColumn.ts`, siehe Schritt 8 des Detailplans.
- [x] `CLAUDE.md:17` — »CI-tagged tests only (skips browser tests that need Playwright):
  `pnpm test:ci`« stimmt nicht: `packages/twopoint5d-testing/project.json:3` trägt den Tag
  `ci`, also wählt `--projects=tag:ci` die Playwright-Suite mit aus. Nachgesehen an
  `60f7612` — der Tag steht dort identisch, von diesem Lauf nicht verursacht; zuletzt
  bewegt in `3b929fa`. Die Fehlannahme hat innerhalb dieses Laufs bereits einen
  Detailplan (Paket 3) und einen doppelten Verify-Lauf (Paket 7) gekostet. In Zug 0 von
  Paket 4 aufgefallen. Severity: low. → Audit — die Scope-Regel greift nicht, `CLAUDE.md`
  liegt außerhalb von `vertex-objects/` und `sprites/` · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:166` — das
  `this.#autoTouchBuffers = undefined` in `attachInstancedPool()` ist unerreichbares
  Kompilat: die Methode ruft davor immer `#detachRoute()`, und das setzt dasselbe Feld
  bedingungslos zurück, auch wenn unter dem Namen noch nichts hing. Empirisch belegt — die
  Zeile allein herausgenommen bleibt der Wächtertest (b) grün, erst mit beiden wird er rot.
  Vorbestehend in derselben Form mit dem Vorgängerfeld `#autoTouchAttrNames`; Paket 5 hat
  sie nur sichtbar gemacht. Aus Paket 5. Severity: low. → Scope · **verteilt in Paket 10** (Drain-Runde 2026-09-03)
- [x] `packages/twopoint5d/src/texture/TextureAtlas.ts:64,68,73,77` — vier Methoden
  versprechen eine Antwort, die ein leerer Atlas nicht hat: `rand(0)` ist `0`, also liefern
  `randomFrameId()` eine Frame-ID, die es nicht gibt, `randomFrame()` und `randomFrames()`
  `undefined` unter dem Typ `TextureAtlasFrame`, und `randomFrameName()` fällt aus der
  Schleife auf ein `return undefined` unter dem Typ `TextureAtlasFrameName`. Paket 6 nimmt
  dort nur den `@ts-ignore` weg und macht die Rückgabe explizit; die Signaturen einzeln zu
  verbreitern hieße, eine von fünf gleich gelagerten Stellen ehrlich zu machen. Der
  vergleichbare Fall im Scope war `createVO()` in Paket 1, und den hat der Nutzer
  entschieden. Vorbestehend, nachgesehen an `60f7612:…/TextureAtlas.ts:77-87`. Aus Paket 6.
  Severity: low. → Audit — die Scope-Regel greift nicht, `texture/` liegt außerhalb von
  `vertex-objects/` und `sprites/` · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/texture/TextureAtlas.ts:12` — `type TextureAtlasFrameName =
  string | symbol;` ist nicht exportiert, steht aber in fünf Signaturen der exportierten
  Klasse (`frameId`, `frame`, `frameNames`, `randomFrameName`, `randomFrameNames`). Im
  veröffentlichten `dist/lib/texture/TextureAtlas.d.ts:8` erscheint der Typ als lokale
  Deklaration hinter `export {}`, ein Consumer kann ihn also nicht benennen. Dieselbe Ursache
  wie der Eintrag zu `AnimatedSpritesMaterialParameters` weiter oben. Vorbestehend,
  nachgesehen an `60f7612:…:12`. Aus Paket 6. Severity: low. → Audit — die Scope-Regel greift
  nicht, `texture/` liegt außerhalb der beiden Bereiche · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/stage/OrthographicProjection.ts:28` und
  `ParallaxProjection.ts:30` — beide Konstruktoren nehmen ausschließlich optionale Argumente
  und liefern ohne sie eine Instanz, die nicht arbeiten kann: `createCamera()` dereferenziert
  `this.projectionPlane`, `updateViewRect()` gibt `this.viewSpecs` an `fitIntoRectangle()`
  weiter, und beides ist dann `undefined` beziehungsweise `{}`. Die Tests, die den Fall
  abdecken sollen (`OrthographicProjection.spec.ts:9-12`, `ParallaxProjection.spec.ts:9-12`,
  je `it('without arguments')`), assertieren nur `toBeDefined()` und halten damit keine
  Zusicherung fest — dieselbe Machart wie der Eintrag zu `VertexObjectPool.spec.ts:761`.
  Vorbestehend, nachgesehen an `60f7612:…/OrthographicProjection.ts:28-33`. Aus Paket 6.
  Severity: low. → Audit — die Scope-Regel greift nicht, `stage/` liegt außerhalb der beiden
  Bereiche
  · **fortgeschrieben in Zug 0 von Paket 9 (2026-09-03):** die Beschreibung »beides ist dann
  `undefined` beziehungsweise `{}`« gilt bis zum Commit von Paket 9; danach halten beide Klassen
  `{}`, weil `OrthographicProjection` das `specs ?? {}` der Schwester bekommt. Das Urteil bleibt
  `→ Audit`: Paket 9 macht die Typen ehrlich, nicht das Verhalten, und die schwachen
  `toBeDefined()`-Tests stehen weiter. Der `TypeError`, den `OrthographicProjection#updateViewRect()`
  bis dahin wirft, ist kein Teil dieses Eintrags — er gehört zu Paket 9. · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `eslint.config.mjs:41` — `'@typescript-eslint/ban-ts-ignore': 0` konfiguriert eine
  Regel, die typescript-eslint mit v6 entfernt hat; installiert ist 8.56.1. Die Zeile fällt
  nur deshalb nicht auf, weil ESLint eine auf `0` gesetzte Regel nie auflöst. Aus Paket 6,
  das die Nachbarzeile 40 anfasst. Severity: info. → Audit — die Scope-Regel greift nicht,
  `eslint.config.mjs` liegt außerhalb der beiden Bereiche · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/texture/TextureStore.spec.ts:281,316` — zwei
  `describe`-Namen tragen `(BUG-11)` und `(BUG-10)`, also Laufnummern eines
  Audits, das es nicht mehr gibt. Altlast aus einem früheren Lauf, von diesem
  Paket nicht berührt. In Paket 2 aufgefallen. Severity: info. → Audit — die
  Scope-Regel greift nicht, `texture/` liegt außerhalb von `vertex-objects/` und
  `sprites/`. · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/stage/OrthographicProjection.ts`, `ParallaxProjection.ts` (medium) — eine ohne Specs konstruierte Projektion liefert eine unbrauchbare Kamera: `#viewRect` bleibt auf `(0, 0)`, daraus werden `pixelRatio = Infinity`, `aspect = NaN` und `fovy = 0`, und `createCamera()` gibt eine Kamera zurück, die nichts rendert. Belegt über `StageRenderer.spec.ts:449` und `OrthographicProjection.spec.ts:10`. Vorbestehend, aus dem nachgezogenen Review zu Paket 6 → Audit (liegt in `stage/`, außerhalb der Scope-Regel) · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/stage/fitIntoRectangle.ts:183` — der Parameter `specs:
  FitIntoRectangleSpecs` ist enger als die Funktion. Ihr Rumpf liest jedes Feld über eine
  `in`-Prüfung oder einen Vergleich auf `fit` (`:184-225`) und lässt das Zielrechteck
  unangetastet, wenn keine Form greift — sie nimmt in Wahrheit jedes
  `Partial<FitIntoRectangleSpecs>`. Weil der Typ das nicht sagt, braucht jede Aufrufstelle mit
  einem Teil-Spec einen Cast; `stage/asFitIntoRectangleSpecs.ts` ist dieser Cast, benannt und
  mit Begründung, aber der Umweg bleibt einer. Weitet man den Parameter, fällt der Helfer weg.
  Vorbestehend, `fitIntoRectangle.ts` ist seit `60f7612` unverändert. In Zug 0 von Paket 9
  aufgefallen. Severity: low. → Audit — die Scope-Regel greift nicht, `stage/` liegt außerhalb
  von `vertex-objects/` und `sprites/` · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/stage/Canvas2DStage.ts:139` — `const viewSpecs =
  this.projection.viewSpecs as any;`, ein unbenannter Cast von genau der Sorte, die Paket 6 im
  übrigen Repository abgeräumt hat. Er steht dort, weil `setCanvasSize()` `width` und `height`
  in ein Spec schreibt, dessen Union-Mitglied gerade ein anderes ist; ein benannter Helfer in der
  Machart von `asFitIntoRectangleSpecs.ts` würde die Grenze aussprechen. Vorbestehend,
  `Canvas2DStage.ts` ist seit `60f7612` unverändert. In Zug 0 von Paket 9 aufgefallen.
  Severity: low. → Audit — die Scope-Regel greift nicht, `stage/` liegt außerhalb von
  `vertex-objects/` und `sprites/` · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:85-87` —
  `dispose()` ruft `this.#animsMap.value?.dispose()` und zerstört damit eine Textur, die der
  Aufrufer hereingereicht hat, über die Konstruktor-Optionen oder den `animsMap`-Setter. Wer das
  Ding nicht gebaut hat, gibt es nicht frei — dieselbe Ownership-Frage, die Paket 2 für Pools
  über `declareOwnedPool()` bereits entschieden hat. Eine zwischen mehreren Materialien geteilte
  Textur ist nach dem `dispose()` eines von ihnen tot. Vorbestehend, nachgesehen an
  `60f7612:…:70-75` — dort identisch. Aus Paket 10. Severity: medium. → Scope · **in Zug 0 von
  Paket 11 geprüft (2026-09-03):** kein Paket von hier aus. Der Befund teilt die Ursache dieses
  Pakets nicht und blockiert Paket 12 nicht; als Nebenbefund gehört er der zweiten Drain-Runde
  des Abschlusses, zusammen mit dem Eintrag darunter — beide sind dieselbe Ownership-Frage.
  · **in Zug 0 von Paket 14 erneut geprüft (2026-09-03):** unberührt, andere Ursache. · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:63-68` — dieselbe
  Ownership-Lücke eine Ebene höher: `dispose()` gibt Geometry und Material auch dann frei, wenn
  der Konstruktor sie fertig übergeben bekommen hat. Vorbestehend, nachgesehen an
  `60f7612:…` — der Rumpf ist unverändert. Aus Paket 10. Severity: medium. → Scope · **in Zug 0
  von Paket 11 geprüft (2026-09-03):** dieselbe Ursache wie der Eintrag darüber, dieselbe
  Behandlung — ein Paket daraus schneidet die zweite Drain-Runde, und dann eines für beide.
  · **in Zug 0 von Paket 13 erneut geprüft (2026-09-03):** unberührt. Paket 13 fasst dieselbe
  Methode an — `TexturedSprites#dispose()` ruft `this.geometry?.dispose()`, und genau dieser
  Aufruf wirft heute —, beantwortet aber eine andere Frage: *ob* der Aufruf durchläuft, nicht
  *ob* er stattfinden darf. Andere Ursache, bleibt in der Queue. · **in Zug 0 von Paket 14
  erneut geprüft (2026-09-03):** unverändert. Paket 14 beantwortet dieselbe Frage wie Paket 13
  — *ob* der Aufruf durchläuft —, nur für eine Geometry, der ein Detach einen Slot genommen hat. · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/updateUpdateRange.ts:13` und
  `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts:26-46` — die Range-Rechnung
  hat zwei Zweige, und nur der schmalere ist im Browser abgedeckt. Trägt ein Buffer mehr als
  ein Attribut, legt `initializeAttributes` einen `InterleavedBuffer` an, und `itemSize` ist
  dann der Stride und nicht die Attributgröße. Genau diese Form fahren die Sprites in jedem
  Frame: `TexturedSpriteDescriptor` (`sprites/TexturedSprites/TexturedSprite.ts:59-70`)
  gruppiert `quadSize`/`texCoords`/`color` und `instancePosition`/`rotation` nach Typ und Usage
  in gemeinsame Buffer. Die neue Browsertest-Datei aus Paket 12 fährt ausschließlich den
  Ein-Attribut-Zweig; ihr Helfer `bufferOf()` hat einen `isInterleavedBufferAttribute`-Zweig,
  den kein Test betritt. Vorbestehend: die Lücke ist so alt wie die Suite, Paket 12 hat sie
  verkleinert und nicht geschlossen. Aus Paket 12. Severity: medium. → Scope · **in Zug 0 von
  Paket 13 geprüft (2026-09-03):** teilt dessen Ursache nicht — Range-Rechnung gegen
  Slot-Reihenfolge — und bleibt für die zweite Drain-Runde liegen. Für das Paket, das daraus
  entsteht: der Test gehört in `vertex-objects-gpu-upload.test.js`, dort trägt der Dateiname
  ihn. Der dispose-Test aus Paket 13 liegt aus demselben Grund in einer eigenen Datei.
  · **in Zug 0 von Paket 14 geprüft (2026-09-03):** teilt dessen Ursache nicht. Paket 14 fährt
  einen extra Pool mit genau einem Attribut und betritt den Interleaved-Zweig damit ebenso wenig
  wie Paket 12; der Eintrag bleibt für die Drain-Runde liegen. · **ins Audit übernommen** (Abschluss 2026-09-03)
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:521` und `:531` —
  `#checkBufferSerials()` und `#updateBuffersUpdateRange()` reichen das Ergebnis von
  `extraInstancedBuffers.get(name)` ungeprüft weiter, während `touchAttributes()` und
  `#getAutoTouchBuffers()` dieselbe Stelle mit einem Guard absichern. Auslösbar ist es nicht:
  `extraInstancedPools` und `extraInstancedBuffers` werden im Gleichschritt gepflegt, und
  `#detachRoute()` löscht beide. Eine Inkonsistenz in der Absicherung, kein Fehler, und
  vorbestehend — die Guards sind so alt wie die beiden Methoden. Aus Paket 14. Severity: low.
  → Scope · **ins Audit übernommen** (Abschluss 2026-09-03)
## Pakete

### [x] 1. Pool-Lifecycle: Freigabe-Semantik, Shrink und Kapazitätsgrenze
- Findings: BUG-024 (high), BUG-025 (medium), MEM-006 (medium), BUG-027 (medium), API-001 (medium), BUG-029 (low)
- Ziel: Der Pool gibt Vertex-Objekte auf jedem Pfad gleich frei, verliert beim Verkleinern niemanden still und meldet seine Kapazitätsgrenze ehrlich.
- Bereich: `packages/twopoint5d/src/vertex-objects/`
- Hängt ab von: —
- Hash: db79e61
- Ergebnis: 4 Runden · BUG-024 entfallen (gegenstandslos mit dem Wegfall von
  `onDestroyVO`, siehe Entscheidungen), BUG-025, MEM-006, BUG-027, API-001 und
  BUG-029 behoben · 16 Regressionstests, davon 12 vor ihrem Fix rot gesehen: die
  fünf aus dem Detailplan (`the swap path leaves no stale vertex object behind
  in the vacated slot`, `the swap path survives a slot that
  createFromAttributes() never materialized`, `shrinking unlinks every vertex
  object beyond the new capacity`, `is rejected while a geometry is attached and
  allowed again after the geometry is disposed`, `is clamped to zero`) und elf
  in `describe('geometry attachments')` um den Anbindungszähler · Verify grün
  über alle vier Kommandos (`<arbeitsdir>/paket-1.verify.log`, exit=0) · klein
  offen: `attributesBackedBy()` in der Spec prüft mit demselben Kriterium wie
  die Implementierung und sieht deshalb nicht, welches Attribut-Objekt in einem
  Slot liegt (`VertexObjectPool.spec.ts:522`)
- Nebenbefunde: → Queue (11 Einträge, alle → Scope)
- Folgen: alle drei aus einer Ursache — ein Attribut-Slot der Geometry hat
  keinen Besitzer, weshalb der Abbau einer Route über die Identität der
  typisierten Arrays entscheiden muss statt über den Slot selbst. Dieselbe
  Ursache trägt den ersten Eintrag in »Offene Befunde«, der vorbesteht.
  **Verteilt am 2026-09-03:** alle drei als Symptome derselben Ursache
  eingeordnet und zusammen mit zwei vorbestehenden Fundstellen zu Paket 7
  geschnitten. **Erledigt mit `34ce3e3`.**
  - `packages/twopoint5d/src/vertex-objects/removeAttributes.ts:35` — teilen
    sich zwei verschiedene Pools ein typisiertes Array (`fromBuffersData()`
    reicht Referenzen per Default zero-copy weiter), zieht die lebende Route dem
    aufgegebenen Pool seine Arrays aus der Mengendifferenz: dessen Attribute
    bleiben in der Geometry, während er `isAttachedToGeometry === false` meldet
    und `resize()` wieder erlaubt ist.
  - `packages/twopoint5d/src/vertex-objects/removeAttributes.ts:48` —
    deklarieren zwei verschiedene Pools unter zwei Namen denselben
    Attributnamen, verliert die Geometry das Attribut ganz, sobald die spätere
    Route abgebaut wird, während der frühere Pool sich als gebunden meldet.
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:522` — der
    Testhelfer teilt die Blindstelle der Implementierung und lässt beide Fälle
    oben grün durchgehen.
- Schnittstellen:
  - `VertexObjectPool#onDestroyVO` entfernt · `createVO()` gibt
    `(VOType & VO) | undefined` zurück · `resize()` wirft bei jeder
    Kapazitätsänderung, solange der Pool eine Geometry trägt; `resize()` auf die
    bestehende Kapazität bleibt ein erlaubter No-op
  - `VOBufferPool#isAttachedToGeometry: boolean` — neuer öffentlicher Getter,
    beantwortet vorab, ob ein `resize()` durchgeht. Dazu `attachGeometry()` und
    `detachGeometry()`, beide `@internal` und über `stripInternal` nicht im
    veröffentlichten `.d.ts`
  - neues internes Modul `GeometryPoolAttachments.ts` mit der gleichnamigen
    Klasse: `attach(pool)`, `detach(pool)`, `detachAll()`, intern eine
    `Map<VOBufferPool, number>`. Beide Geometry-Klassen halten eine als
    `#attachments` und buchen an ihren Aufrufstellen von
    `initializeAttributes()` / `initializeInstancedAttributes()` — die beiden
    Init-Funktionen selbst buchen nicht und sind unverändert
  - neues internes Modul `removeAttributes.ts` mit
    `removeAttributes(geometry, buffers, keepBuffers)`. Beide Module stehen
    bewusst in keiner `public-api.ts`
  - `InstancedVOBufferGeometry#attachInstancedPool(name, pool)` ruft zuerst
    `detachInstancedPool(name)`; `detachInstancedPool()` nimmt die Attribute des
    Pools von der Geometry, sofern keine andere Route dieselben Buffer noch liest

### [x] 2. Geometry-Update: Upload-Range, BufferGeometry-Konstruktor, dispose-Ownership
- Findings: BUG-022 (high), BUG-023 (high), MEM-008 (medium) · dazu aus »Offene
  Befunde«: `InstancedVOBufferGeometry.ts:190` (dispose lässt die Attribute stehen)
- Ziel: Die Geometry lädt genau die belegten Daten hoch, überlebt beide dokumentierten Konstruktorpfade und gibt beim Entsorgen nur frei, was ihr gehört.
- Bereich: `packages/twopoint5d/src/vertex-objects/`
- Hängt ab von: 1 (der `resize()`-Guard aus Paket 1 legt die Pool-Geometry-Verknüpfung an, an der die Ownership-Unterscheidung hängt)
- Hash: 70309b2
- Ergebnis: 5 Runden · BUG-022, BUG-023 und MEM-008 behoben, dazu der Eintrag zu
  `InstancedVOBufferGeometry.ts:190` · 30 neue Tests, davon 17 vor ihrem Fix rot
  gesehen — die Upload-Range (`… uploads every vertex of a used object` und das
  nicht-instanzierte Gegenstück, `count: 3` statt `12` beziehungsweise `15` statt
  `60`), der Konstruktorpfad mit fremder `BufferGeometry` (`TypeError` auf
  `undefined.buffer`), acht Fälle um die Besitz-Regel beim Entsorgen, zwei um
  `update()` nach `dispose()` (`TypeError` auf `undefined.updateRanges`), zwei um
  den Besitz eines Extra-Pools am Pool statt am Namen, zwei um
  `#checkBufferSerials()` auf einem toten Pool (`TypeError` auf
  `undefined.serial`) und einer um die Besitzrücknahme beim Detach · Verify grün
  über alle fünf Kommandos einschließlich der Playwright-Browsertests, ohne
  Nx-Cache gefahren (`<arbeitsdir>/paket-2.verify.log`, exit=0, 84 Test-Dateien,
  1332 Tests) · die Fehlerkette lief 9 → 2 → 0 wichtige Befunde, die Runden 3
  und 4 haben nur noch Kleines abgeräumt
- Bemerkenswert für spätere Pakete: Runde 2 war eine **Rücknahme**. Ein
  Implementierer hatte die Freigabe zusätzlich davon abhängig gemacht, ob eine
  andere Geometry den Pool noch liest (`!pool.isAttachedToGeometry`). Das kennt
  Schritt 10 nicht, und es verschiebt das Problem nur: statt »zu früh
  freigegeben« bekommt man »nie freigegeben«, abhängig von der Reihenfolge, in
  der Geometrien entsorgt werden. Wer an dieser Stelle wieder einen Guard
  einziehen will, löst damit nichts, was der Migrations-Abschnitt nicht schon
  benennt.
- klein offen, alle in `InstancedVOBufferGeometry.ts`, sofern nicht anders
  genannt:
  - `:281-285` gegen `:227-229` — hängt derselbe Pool unter zwei Namen mit
    widersprüchlichen `autoDispose`-Flags, kommen `dispose()` (ODER über alle
    Namen) und die vollständige Detach-Folge (die letzte Route entscheidet) zu
    entgegengesetzten Ergebnissen. In dieser Codebase über keinen Pfad
    erreichbar.
  - `:147` — `attachInstancedPool()` ruft beim Namensüberschreiben die private
    `#detachRoute()` statt der öffentlichen `detachInstancedPool()`; eine externe
    Subklasse, die letztere überschreibt, wird auf diesem Pfad nicht gesehen.
  - `:157-161` — ein zweites `attachInstancedPool(name, pool)` ohne `options`
    löscht ein früher gesetztes explizites `autoDispose` und fällt auf den Besitz
    zurück. Konsistent, steht aber nirgends.
  - `:263-265` — der TSDoc sagt »only the attribute serials« stehen nach
    `dispose()` noch; `#autoTouchAttrNames` und `#firstAutoTouch` überleben
    ebenfalls.
  - `:471` und `VOBufferGeometry.ts:161-162` — der Kommentar am Guard beruft sich
    auf `updateUpdateRange`/`selectAttributes`, die aber die geometrieseitig
    fehlende Route abfangen; die sachlich richtige Analogie ist `#poolArrayOf()`.
  - `:302` — `#ownedPools.clear()` steht kommentarlos, obwohl es die letzte
    Referenz auf einen abgehängten, nicht entsorgten Extra-Pool fallen lässt.
  - `vertex-buffers-geometry-updates.spec.ts:801` — misst den Besitz über den
    Vorgabewert beim Wiederanhängen unter demselben Namen und bliebe deshalb auch
    grün, wenn `#extraInstancedPoolAutoDispose.delete(name)` verlorenginge. Ein
    zweiter Name isolierte die Besitzachse.
  - `vertex-buffers-geometry-updates.spec.ts:817` — redundant zu `:737`; jeder
    Pool des Zyklus stirbt schon beim Detach, das abschließende `dispose()` trägt
    nichts bei.
- Nebenbefunde: → Queue (9 Einträge: 8 → Scope, davon einer schon Paket 5
  zugeordnet · 1 → Audit)
- Folgen: eine offene, in Zug 0 von Paket 12 aufgedeckt — `VOBufferGeometry#dispose()`
  (`VOBufferGeometry.ts:56-74`) und `InstancedVOBufferGeometry#dispose()`
  (`InstancedVOBufferGeometry.ts:268-306`) nehmen der Geometry ihre Attribut-Slots, **bevor**
  `super.dispose()` das `dispose`-Event auslöst; three liest im Aufräumpfad die Attribute noch
  einmal und greift auf `undefined`. Eine Geometry, die einmal gerendert wurde, wirft damit beim
  `dispose()` einen `TypeError`. In diesem Paket entstanden (`70309b2` hat das Abräumen der
  Attribute eingeführt, `34ce3e3` es in `#releaseSlots()` gefasst), also Arbeit dieses Laufs und
  kein Nebenbefund. Severity: high. **Verteilt am 2026-09-03:** als echte Folge zu Paket 13
  geschnitten — eigene Ursache, eigener Bereich, eigener Commit. Die Messung steht dort.
  Die frühere Folge war nach Paket 7 verteilt und ist mit
  `34ce3e3` erledigt — `#poolArrayOf()` ist in diesem
  Paket entstanden und löst einen Attributnamen über die Reihenfolge instanced →
  base → extra auf, was für einen Extra-Pool die falsche Antwort gibt, weil er
  den Slot besetzt, aber zuletzt gefragt wird. Dieselbe Ursache wie die übrigen
  Fundstellen dort: ein Slot ohne Besitzer. Der fehlende Test dazu geht mit.
  Alles Übrige ist mitgezogen:
  `selectAttributes.ts` hat denselben Null-Guard bekommen wie
  `updateUpdateRange.ts`, sechs Tests in `InstancedVertexObjectGeometry.spec.ts`
  sind von `clear()` auf `dispose()` umgeschrieben, und die scharfe Kante für
  geteilte Pools steht im Migrations-Abschnitt. Die drei
  Sprite-Geometry-Klassen (`TexturedSpritesGeometry`, `AnimatedSpritesGeometry`,
  `TileSpritesGeometry`) bauen ihre Pools aus Deskriptoren, fallen also unter
  »selbst gebaut« und werden korrekt freigegeben — geprüft, kein
  Änderungsbedarf.
- Schnittstellen:
  - `Geometry.dispose()` in beiden Klassen: gibt selbst gebaute Pools über
    `dispose()` frei statt sie zu leeren, lässt hereingegebene unangetastet,
    nimmt die Attribute jeder freigegebenen Route von der Geometry und setzt
    `index` auf `null`. Ein zweites `dispose()` bleibt folgenlos.
  - `update()` nach `dispose()` wirft nicht mehr; `updateUpdateRange()`,
    `selectAttributes()` und `#checkBufferSerials()` überspringen, wofür es
    keinen Buffer mehr gibt. Attribute kommen dabei keine zurück, `instanceCount`
    und `drawRange` werden weiterhin geschrieben.
  - `InstancedVOBufferGeometry#attachInstancedPool(name, pool, options)` — der
    Vorgabewert von `autoDispose` ist »hat diese Geometry den Pool gebaut«. Ein
    ausdrücklich übergebenes `autoDispose` gewinnt in beide Richtungen und gilt
    je Attach-Aufruf.
  - `detachInstancedPool(name)` gibt einen Pool, der der Geometry gehört, frei,
    sobald keine ihrer Routen ihn mehr hält.
  - `declareOwnedPool(pool)` — neu in beiden Geometry-Klassen, `@internal`, über
    `stripInternal` nicht im veröffentlichten `.d.ts`, in keiner `public-api.ts`.
    Die beiden Unterklassen buchen nach `super()` nach, weil die Basisklasse dort
    nur noch Pools sieht und einen selbst erzeugten nicht von einem
    hereingegebenen unterscheiden könnte.
  - `GeometryPoolAttachments#holds(pool): boolean` — neu, intern. Beantwortet für
    **eine** Geometry, ob noch eine ihrer Routen den Pool hält. Weiß nichts über
    andere Geometrien, und das ist der Punkt.
  - Attribute, die aus einer über den Konstruktor kopierten fremden
    `BufferGeometry` stammen, gehören keinem Pool: sie werden beim `update()`
    nicht überschrieben und bleiben beim `dispose()` auf der Geometry stehen.

### [x] 7. Attribut-Slots mit Besitzer: der Abbau einer Route trifft nur ihre eigenen Attribute
- Findings: keine Audit-ID — sechs Fundstellen aus einer Ursache: drei Folgen aus
  Paket 1 (`removeAttributes.ts:35-39` und `:43-51`, `VertexObjectPool.spec.ts:522`),
  zwei vorbestehende Einträge aus »Offene Befunde«
  (`InstancedVOBufferGeometry.ts:214`/`:309-328` — derselbe Pool unter zwei Namen,
  `touchAttributes()` erreicht den Slot nicht, medium · `:73-74` — die über den
  Konstruktor kopierte fremde `BufferGeometry` steht außerhalb der Buchführung, low)
  und eine Folge aus Paket 2 (`poolTypedArrayOf()` / `#poolArrayOf()` lösen einen
  Attributnamen über die Reihenfolge instanced → base → extra auf, low), dazu die
  fehlende Testabdeckung der Auflösung bei zwei Pools mit demselben Attributnamen
- Folge von: Paket 1
- Ziel: Die Geometry weiß, welche Route einen Attribut-Slot belegt, gibt ihn beim Abbau an eine überlebende Route zurück und rät nicht mehr über die Identität der typisierten Arrays.
- Bereich: `packages/twopoint5d/src/vertex-objects/`
- Hängt ab von: 2 (Paket 2 hat `#syncAttributeArrays()`, `#detachRoute()` und beide
  `dispose()`-Methoden geschrieben; dieser Umbau setzt darauf auf)
- Hash: 34ce3e3
- Ergebnis: 2 Runden · alle sechs Fundstellen behoben, die fehlende Testabdeckung
  mit ihnen · Regressionstests in `describe('attribute slots')`
  (`vertex-buffers-geometry-updates.spec.ts:1020-1099`) und
  `one pool attached under two names keeps its attributes while either name still
  holds it` (`VertexObjectPool.spec.ts`) — sechs davon vor ihrem Fix rot gesehen ·
  `removeAttributes.ts` gelöscht, `GeometryAttributeSlots.ts` angelegt · Verify grün
  über alle fünf Kommandos einschließlich der Playwright-Browsertests, ohne Nx-Cache
  gefahren (`<arbeitsdir>/paket-7.verify.log`, exit=0, 84 Test-Dateien, 1342 Tests) ·
  die Fehlerkette lief 2 → 0 wichtige Befunde, beide im CHANGELOG, keiner im Code
- klein offen:
  - `GeometryAttributeSlots.ts:105-106` — der Ersetzungszweig von `#claim()` schreibt
    den Anspruch an seine alte Stapelposition zurück; hätte inzwischen eine andere
    Route oben geclaimt, zeigte die Geometry danach ein Attribut, das der Stapel nicht
    als oberstes führt. Über keinen Pfad dieser Codebase erreichbar, weil jede Route
    jeden Namen genau einmal beansprucht — ein toter Zweig mit einer Zusicherung, die
    er nicht hält.
  - `packages/twopoint5d/CHANGELOG.md:38` — »A pool is therefore safe to `resize()`
    once its last route to the geometry is gone« steht unqualifiziert; hängt derselbe
    Pool zusätzlich an einer zweiten Geometry, wirft `resize()` weiter. Der Eintrag
    unter `Changed` (`:20`) trägt die exakte Regel.
  - `packages/twopoint5d/CHANGELOG.md:38` gegen `:22` — die Attribut-Hälfte von
    »Anhängen über einen schon vergebenen Namen« steht nur noch als Kette aus zwei
    Einträgen. Ableitbar, aber an keiner Stelle in einem Satz gesagt.
- Nebenbefunde: → Queue (3 Einträge, alle → Scope)
- Folgen: eine offene — `packages/twopoint5d/CHANGELOG.md:36`, »the geometry leaves
  the attributes built on them alone instead of raising a `TypeError`«: die Wendung
  erzählt den Vorzustand und verstößt gegen die Konvention im Kopf dieses Plans. Der
  Satz trägt auch ohne sie. Aus Paket 2, also aus diesem Lauf und kein Nebenbefund;
  `Unreleased` ist noch änderbar. Severity klein. Zwei Fundstellen derselben Ursache
  hat dieses Paket bereits abgeräumt (`:38` und `:39`/`:40`) — dies ist die dritte,
  und sie liegt in einem committeten Paket. **Verteilt am 2026-09-03:** nach Paket 8.
  Alles Übrige ist mitgezogen: die vier Aufrufstellen von `removeAttributes()`, die
  beiden Init-Signaturen samt ihren zwei Aufrufern, der TSDoc von
  `InstancedVOBufferGeometry.dispose()` und die zwei Kommentare in `#detachRoute()`
  und an `detachInstancedPool()`, die noch den Abbau über die Attribute beschrieben.
  **Geschlossen mit `c117222`** (nachgesehen in Zug 0 von Paket 11): die Zeile lautet jetzt
  »the geometry leaves the attributes built on them alone« und endet dort — der Rückblick
  auf den Vorzustand ist weg. Keine offene Folge mehr unter diesem Paket.
- Schnittstellen:
  - neues internes Modul `GeometryAttributeSlots.ts`, in keiner `public-api.ts`:
    `export type AttributeRoute = Map<string, BufferLike>` — die Identität einer Route
    ist die Buffer-Map, die sie füllt, und sie unterscheidet zwei Routen zu demselben
    Pool. Dazu die Klasse `GeometryAttributeSlots` mit `claim(attrName, route, pool,
    attr)`, `claimExisting(geometry)`, `poolOf(attrName)` und
    `releaseRoute(geometry, route): string[]`. Je Attributnamen ein Stapel von
    Ansprüchen, ältester zuerst; der oberste sitzt im Slot der Geometry. Beide
    Geometry-Klassen halten eine als `#slots` und geben Slots über `#releaseSlots()`
    frei, das die gewechselten Namen aus `#serials` nimmt.
  - `initializeAttributes()` und `initializeInstancedAttributes()` haben einen fünften
    Parameter `slots: GeometryAttributeSlots`. Beide sind intern, beide Aufrufstellen
    stehen in den Geometry-Klassen.
  - entfernt: das Modul `removeAttributes.ts` samt `removeAttributes()`, die
    Modul-Funktion `poolTypedArrayOf()`, `InstancedVOBufferGeometry#poolArrayOf()` und
    `#liveBuffers()`. Keines stand je in einer `public-api.ts`.
  - Verhalten, gegen das ein späteres Paket baut: der Abbau einer Route nimmt genau
    die Attribute mit, die sie gesetzt hat — auch wenn zwei Pools sich typisierte
    Arrays teilen oder denselben Attributnamen deklarieren. Ein übernommener Slot geht
    an die Route zurück, von der er kam, oder an das Attribut einer fremden
    `BufferGeometry`, die dem Aufrufer gehört. Ein Attributname löst sich auf den Pool
    auf, der das Attribut im Slot speist; die Auflage, Attributnamen von Extra-Pools
    von denen der instanced- und base-Route fernzuhalten, entfällt damit.
  - Testhelfer in `VertexObjectPool.spec.ts`: `bufferInSlot(geometry, attrName)` und
    `bufferOfRoute(geometry, name, attrName)` neben `attributesBackedBy()`, das seine
    Grenze jetzt als Kommentar trägt — es beantwortet »welche Attribute lesen aus
    diesem Pool«, nicht »welche Route besitzt diesen Slot«.

### [x] 3. Sprites: gebundene Convenience-API und ladefähige animsMap
- Findings: BUG-021 (high), BUG-028 (medium)
- Ziel: `sprites.createSprite()` liefert ein Sprite statt `undefined`, und ein `AnimatedSpritesMaterial` überlebt eine Texture, die noch lädt.
- Bereich: `packages/twopoint5d/src/sprites/`
- Hängt ab von: —
- Hash: 8e056bf
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts`
  - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`
  - neu: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`
  - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts` (erweitern)
  - `packages/twopoint5d/CHANGELOG.md`
  - keine `public-api.ts` fasst dieses Paket an: `TexturedSprites` und `AnimatedSpritesMaterial`
    stehen bereits in `sprites/public-api.ts`, und alles Neue sind Methoden dieser beiden Klassen.
- Vorgehen:
  1. **Regressionstests zuerst, rot sehen, Ausgabe in den Report.** Neue Datei
     `TexturedSprites.spec.ts` mit `describe('TexturedSprites')`, gebaut über
     `new TexturedSprites(4)` (läuft in Vitest ohne Renderer, nachgemessen):
     - `'createSprite() takes a sprite from the sprite pool'` — `createSprite()` liefert
       ein Objekt, `spritePool.usedCount` ist danach `1`, `spritePool.containsVO(sprite)`
       ist `true`. Rot: der Rückgabewert ist `undefined` und `usedCount` bleibt `0`.
     - `'the sprite of createSprite() writes through to the pool buffer'` —
       `sprite.setPosition(1, 2, 3)`, danach `spritePool.getVO(0).x === 1`. Rot:
       `TypeError` auf `undefined.setPosition`.
     - `'freeSprite() gives a sprite back to the pool'` — nach `freeSprite(sprite)` ist
       `usedCount` wieder `0`. Rot: `TypeError: this.containsVO is not a function`.
     - `'createSprite() answers undefined once the pool is full'` — Kapazität `2`, drei
       Aufrufe, der dritte liefert `undefined`. Grenzfall, vor dem Fix bereits grün: nicht
       als Rot-Nachweis zählen, aber schreiben — er hält den neuen Rückgabetyp fest.
     In `AnimatedSpritesMaterial.spec.ts` ein neues `describe('an animsMap without an image')`:
     - `'constructs with a texture whose image has not arrived yet'` —
       `new AnimatedSpritesMaterial({animsMap: new Texture()})` wirft nicht und trägt die
       Texture. Rot: `TypeError: Cannot read properties of null (reading 'width')`.
     - `'uses the neutral texture coordinates while the image is missing'` —
       `material.texCoordsNode.isTextureNode` ist falsy (der Fallback ist ein `VarNode`,
       der Animationspfad ein `TextureNode`; beides nachgemessen). Rot: derselbe Wurf.
     - `'touchAnimsMap() picks up the image once the texture has one'` — imagelose Texture
       zuweisen, dann `tex.image = {width: 4, height: 4}` setzen, `touchAnimsMap()` rufen;
       danach ist `texCoordsNode.isTextureNode === true`, `texCoordsNode.value === tex`, und
       `material.version` ist gestiegen. Rot: `touchAnimsMap` gibt es nicht.
     - `'touchAnimsMap() without an animsMap does not throw'` und
       `'touchAnimsMap() after dispose() does not throw'`. Rot: dieselbe fehlende Methode.
     `material.needsUpdate` ist in three.js ein reiner Setter — gemessen wird über
     `material.version`, und zwar als Zuwachs: die beiden Effects der Basisklasse haben den
     Zähler nach dem Konstruktor bereits auf `3` gebracht.
  2. **`TexturedSprites.ts`:** die beiden Getter `createSprite` und `freeSprite` fallen weg,
     an ihre Stelle treten zwei Methoden zwischen Konstruktor und `dispose()`:

     ```ts
     createSprite(): TexturedSprite | undefined {
       return this.geometry.instancedPool.createVO();
     }

     freeSprite(sprite: TexturedSprite): void {
       this.geometry.instancedPool.freeVO(sprite);
     }
     ```

     Der Rückgabetyp trägt `| undefined`, weil `VertexObjectPool#createVO()` ihn trägt (siehe
     `Schnittstellen:` unter Paket 1) — dieselbe Ehrlichkeit auf beiden Ebenen, sonst
     verspricht die Convenience-Schicht etwas, das die Schicht darunter nicht hält. Kurzer
     TSDoc an beiden: was sie tun, und dass `createSprite()` an der Kapazitätsgrenze
     `undefined` liefert. Der Getter `spritePool` und die `texture`-Accessoren bleiben, wie
     sie sind.
  3. **`AnimatedSpritesMaterial.ts`:** der Effect baut den Animationspfad nur noch, wenn die
     Texture ein Bild mit brauchbaren Maßen trägt:

     ```ts
     const animsImage = this.animsMap?.image as {width?: number; height?: number} | null | undefined;

     if (animsImage != null && animsImage.width > 0 && animsImage.height > 0) {
       const animsMapSize = vec2(animsImage.width, animsImage.height);
       // … unverändert weiter, `this.animsMap` bleibt der Texture-Parameter von `texture(…)`
     } else {
       this.texCoordsNode = vec4(0, 0, 1, 1);
     }
     ```

     Das `as Texture` an `this.animsMap.image` fällt damit weg: das Bild einer Texture ist
     keine Texture, und die beiden Felder, die hier gelesen werden, sind die ganze Anforderung.
     Die Maße werden auf `> 0` geprüft und nicht nur auf Vorhandensein, weil ein
     `HTMLVideoElement` oder ein noch nicht vermessenes Image-Objekt dasteht, ohne eine Größe
     zu nennen — ein Lookup über `vec2(0, 0)` ist keine bessere Antwort als der Fallback.
  4. **Der Weg zurück, wenn das Bild später eintrifft.** Eine neue Methode:

     ```ts
     touchAnimsMap(): void {
       this.#animsMap.touch();
     }
     ```

     Sie ist nötig, weil die Empfehlung des Audits an dieser Stelle an der Bibliothek
     vorbeigeht: `createSignal()` vergleicht mit `===` (Vorgabe `DEFAULT_EQUALS` in
     `@spearwolf/signalize@1.0.0`), und `TextureLoader` schreibt das geladene Bild in
     *dieselbe* Texture-Instanz und verschickt dabei kein Event. Ein zweites
     `material.animsMap = tex` ist damit ein No-op, und ohne diesen Weg tauscht das Paket den
     `TypeError` bloß gegen ein Sprite, das für immer im Fallback stehen bleibt.
     `Signal#touch()` ist genau dafür da, und `touch` ist in dieser Codebase bereits das Wort
     für »ich habe etwas verändert, das du nicht sehen kannst« (`VOBufferPool#touch()`,
     `touchAttributes()`, `autoTouch`). Der Setter von `animsMap` behält seine reine
     Signal-Semantik: eine gewöhnliche Zuweisung soll keine versteckte Arbeit auslösen.
     Der TSDoc gehört an den `animsMap`-Accessor und sagt in eigenen Worten, dass eine Texture,
     deren Bild später kommt, ein `touchAnimsMap()` braucht.
  5. **Den Kommentar in `makeAnimsMap()`** (`AnimatedSpritesMaterial.spec.ts:10-11`)
     nachziehen: er behauptet, ein Stub-Image sei erforderlich, sobald das Signal einen Wert
     trägt. Nach diesem Paket ist das falsch, und der Helfer stellt das Bild nur noch, weil
     die Tests den Animationspfad wollen.
  6. **`CHANGELOG.md`, Abschnitt `Unreleased`** nach `updating-changelog`:
     - `Added`: `AnimatedSpritesMaterial#touchAnimsMap()` — liest die `animsMap`-Texture neu
       und baut das Animations-Lookup aus ihrem aktuellen Bild.
     - `Changed`: `TexturedSprites#createSprite()` und `#freeSprite()` sind Methoden am Mesh und
       arbeiten auf dem Sprite-Pool seiner Geometry; `createSprite()` liefert
       `TexturedSprite | undefined` und antwortet `undefined`, sobald der Pool seine Kapazität
       erreicht hat.
     - `Fixed`: je ein Eintrag für die beiden Findings.
     - `Migration Guide`: ein kurzer Abschnitt zu `createSprite()`. Der einzige echte Bruch
       trifft Consumer mit `strictNullChecks: true` — `const s: TexturedSprite =
       sprites.createSprite()` ist danach ein Typfehler und will den `undefined`-Fall
       behandeln. Before/After wie in den vorhandenen Abschnitten.
     Die Konvention aus dem Kopf gilt auch hier: jeder Satz beschreibt, was der Code *tut*,
     nicht was er vorher tat. Der Migrations-Abschnitt ist die eine Stelle, an der ein
     Vorher/Nachher hingehört.
  7. Die vier Prettier-Verletzungen in `sprites/` **nicht** mitnehmen — sie stehen als
     eigener Eintrag in »Offene Befunde«. Neue und geänderte Zeilen folgen der
     Repo-Konfiguration (`bracketSpacing: false`, `printWidth: 130`, `singleQuote: true`);
     die umliegenden Zeilen bleiben unangetastet, damit der Diff lesbar bleibt.
- Verify: `pnpm lint && NX_TUI=false pnpm nx run-many -t build --skip-nx-cache && NX_TUI=false pnpm nx run-many -t checkPkgTypes --skip-nx-cache && NX_TUI=false pnpm nx run-many -t test --projects=tag:ci --skip-nx-cache`
  (die vier Kommandos aus dem Kopf, ohne Nx-Cache; die Flagge ist gegen `checkPkgTypes`
  nachgemessen). Die Playwright-Suite läuft hier bewusst **nicht** mit: sie deckt Display,
  Stage und TextureStore ab und kennt keinen Pfad aus `sprites/`, könnte diese Änderung also
  nicht sehen. Ein fünftes Kommando, das den Diff nicht erreicht, ist keine Prüfung.
- Commit: `fix(twopoint5d): bind the sprite convenience API and survive a loading animsMap`
- Ergebnis: 2 Runden · BUG-021 und BUG-028 behoben · 9 neue Tests, davon 8 vor ihrem Fix rot
  gesehen — `createSprite() takes a sprite from the sprite pool` (`expected undefined to be
  defined`), `the sprite of createSprite() writes through to the pool buffer` (`TypeError` auf
  `undefined.setPosition`), `freeSprite() gives a sprite back to the pool` (`TypeError:
  this.containsVO is not a function`) und fünf in `describe('an animsMap without an image')`
  (dreimal `TypeError` auf `null.width`, zweimal `material.touchAnimsMap is not a function`);
  der neunte, `createSprite() answers undefined once the pool is full`, war als Grenzfall
  vorher schon grün · Verify grün über alle vier Kommandos ohne Nx-Cache
  (`<arbeitsdir>/paket-3.verify.log`, exit=0) · die Fehlerkette lief 3 → 1 → 1 Befunde; Runde 2
  hat den letzten kleinen gegen einen anderen kleinen getauscht und damit die Kette beendet
- klein offen:
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:48,55` —
    `createSprite()` und `freeSprite()` dereferenzieren `this.geometry.instancedPool` selbst,
    obwohl der Getter `spritePool` zwei Zeilen darüber genau das tut. Drei Wege zum selben Pool
    in einer Klasse mit vierzig Zeilen; `return this.spritePool.createVO()` machte auch den
    Nachlauf zum ungeprüften `this.geometry` an einer Stelle statt an dreien angreifbar. Der
    Detailplan schreibt die Form vor, deshalb kein Befund des Implementierers.
- Nebenbefunde: → Queue (6 Einträge in Zug 0: 5 → Scope, 1 → Audit; keine neuen aus der
  Umsetzung)
- Folgen: eine offene — `packages/twopoint5d/CHANGELOG.md:43`, »losing the bind to their mesh«
  dreht die Mechanik um: verloren ging die Bindung an den **Pool**, an das Mesh war die
  ungebundene Referenz beim Aufruf gerade fälschlich gebunden. Der zweite Halbsatz der Zeile
  trägt die Wahrheit, der erste widerspricht ihr; »losing the bind to the sprite pool« träfe
  es. In diesem Paket entstanden, also Arbeit dieses Laufs und kein Nebenbefund; `Unreleased`
  ist noch änderbar. Severity klein. **Verteilt am 2026-09-03:** nach Paket 8, zusammen mit
  der gleichgelagerten Folge aus Paket 7. **Geschlossen mit `c117222`** (nachgesehen in Zug 0
  von Paket 11): die Zeile nennt die Mechanik jetzt richtig — »losing their bind to the sprite
  pool«. Keine offene Folge mehr unter diesem Paket.
- Schnittstellen:
  - `TexturedSprites#createSprite(): TexturedSprite | undefined` und
    `TexturedSprites#freeSprite(sprite): void` sind Methoden am Mesh, keine Getter mehr. Die
    abgelöste Aufrufform (`const f = sprites.createSprite; f()`) gibt es nicht mehr;
    `createSprite()` antwortet `undefined`, sobald der Sprite-Pool seine Kapazität erreicht hat.
  - `AnimatedSpritesMaterial#touchAnimsMap(): void` — neu, öffentlich über die bestehende
    Klasse in `sprites/public-api.ts`. Liest die `animsMap`-Texture über `Signal#touch()` neu
    und baut das Animations-Lookup aus ihrem aktuellen Bild. Nötig, weil `TextureLoader` das
    geladene Bild in dieselbe Texture-Instanz schreibt und `DEFAULT_EQUALS` (`===`) ein
    zweites `material.animsMap = tex` verschluckt.
  - `new AnimatedSpritesMaterial({animsMap})` wirft nicht mehr, wenn die Texture kein Bild mit
    Maßen `> 0` trägt; das Material steht dann auf `texCoordsNode = vec4(0, 0, 1, 1)`, bis ein
    `touchAnimsMap()` das Bild nachreicht.

**BUG-021 · high · `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:21-27`** — TexturedSprites.createSprite() liefert stumm undefined — unbound Method-Getter

Die Getter `createSprite` und `freeSprite` geben die *ungebundene* Methoden-Referenz
`this.geometry.instancedPool.createVO` zurück. Beim natürlichen Aufruf
`sprites.createSprite()` ist `this` die Mesh-Instanz statt des Pools:
`this.usedCount < this.capacity` ist `undefined < undefined`, die Methode liefert stumm
`undefined` — kein Sprite, kein Fehler. Als detached Referenz
(`const f = sprites.createSprite; f()`) wirft sie einen TypeError. Per Node-Repro gegen
`dist/lib` verifiziert. Die Lookbook-Demos umgehen die API und greifen direkt auf
`geometry.instancedPool` zu — vermutlich, weil dieser Weg nie funktioniert hat.

Empfehlung: Als gebundene Convenience-Methoden implementieren:
`createSprite(): TexturedSprite { return this.geometry.instancedPool.createVO(); }` bzw.
`freeSprite(sprite)` analog — oder die Getter Arrow-Funktionen zurückgeben lassen. Dazu ein
Spec, das beide Aufrufformen abdeckt.

Abweichung von der Empfehlung, entschieden in Zug 0: Methoden statt Arrow-Funktionen, und der
Rückgabetyp lautet `TexturedSprite | undefined`. Die Arrow-Variante hielte auch die abgelöste
Aufrufform am Leben, allokiert aber bei jedem Zugriff einen Closure — in einer Bibliothek, die
in Paket 5 gerade Allokationen aus dem Update-Pfad nimmt, ist das die falsche Richtung, und
`createSprite()` steht typischerweise in einer Schleife. Die abgelöste Form ist zudem die
einzige, die noch nie funktioniert hat: sie hat keinen Aufrufer im Repo, und der Typ
`() => TexturedSprite`, der sie versprach, war die Lüge. Der Spec deckt darum die gebundene
Form vollständig ab statt beide halb.

**BUG-028 · medium · `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:43-44`** — AnimatedSpritesMaterial crasht, wenn die animsMap-Texture noch kein Bild hat

Der Effect liest `this.animsMap.image.width`, sobald `animsMap` gesetzt wird. Bei einer noch
ladenden Texture (Standardfall mit `TextureLoader`) ist `image` null — TypeError direkt im
Konstruktor bzw. beim Setzen der Property (verifiziert:
`new AnimatedSpritesMaterial({animsMap: new Texture()})` wirft). Der Nutzer muss wissen, dass
er die Texture erst nach dem Laden zuweisen darf; das steht nirgends.

Empfehlung: Im Effect auf `this.animsMap?.image?.width` guardieren und ohne Bild den
Fallback-Pfad (`vec4(0,0,1,1)`) nehmen. Da `animsMap` ein Signal ist, genügt ein erneutes
Setzen nach dem Laden — alternativ auf das `onUpdate`/Load-Event der Texture reagieren.

Abweichung von der Empfehlung, entschieden in Zug 0: der Guard kommt wie beschrieben, die
Rückkehr aus dem Fallback nicht über ein erneutes Setzen. Beide Hälften der Empfehlung sind
gegen die Bibliothek geprüft und tragen nicht: `three@0.183.1` verschickt beim Laden einer
Texture kein Event und ruft nur `onLoad` (`src/loaders/TextureLoader.js`), und
`Texture#onUpdate` gehört dem Aufrufer, ist also nicht zu belegen. Ein zweites
`material.animsMap = tex` schreibt dieselbe Instanz und wird von `DEFAULT_EQUALS` (`===`)
verschluckt. Der Weg zurück ist deshalb `touchAnimsMap()`, siehe Schritt 4.

### [x] 4. Generierte Accessoren und TypedArray-Schicht
- Findings: BUG-026 (medium), PERF-009 (medium), API-029 (info)
- Ziel: Die generierten Setter nehmen TypedArrays korrekt entgegen, kopieren ohne Wegwerf-Arrays, und `float16` bedeutet Half-Float.
- Bereich: `packages/twopoint5d/src/vertex-objects/` plus die Werkzeugkette, die den
  Node-Floor festhält (`tsconfig.json`, `package.json`, `mise.toml`,
  `.github/workflows/ci.yml`, `CLAUDE.md`)
- Hängt ab von: —
- Hash: be3213b
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts` (nur `copyAttributes()`)
  - `packages/twopoint5d/src/vertex-objects/createTypedArray.ts`
  - `packages/twopoint5d/src/vertex-objects/types.ts`
  - neu: `packages/twopoint5d/src/vertex-objects/asThreeTypedArray.ts`
  - `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts` (zwei Zeilen plus Import)
  - `packages/twopoint5d/src/vertex-objects/initializeInstancedAttributes.ts` (zwei Zeilen plus Import)
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts` (eine Zeile plus Import)
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts` (eine Zeile plus Import)
  - neu: `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.spec.ts`
  - neu: `packages/twopoint5d/src/vertex-objects/createTypedArray.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.spec.ts` (erweitern)
  - `tsconfig.json` (Workspace-Wurzel, `lib`)
  - `package.json` (Workspace-Wurzel, `engines.node`)
  - `mise.toml`, `.github/workflows/ci.yml`, `CLAUDE.md`
  - `packages/twopoint5d/CHANGELOG.md`
  - keine `public-api.ts` wird angefasst: `asThreeTypedArray.ts` ist intern, und `types.ts`
    steht über `export type * from './types.js'` bereits in `vertex-objects/public-api.ts`.
- Vorgehen:
  1. **Regressionstests zuerst, rot sehen, Ausgabe in den Report.** Neue Datei
     `createVertexObjectPrototype.spec.ts` mit `describe('the generated attribute accessors')`.
     Die Pools werden direkt über `new VertexObjectPool({…}, capacity)` gebaut, wie in
     `VertexObjectPool.spec.ts`. Die Rot-Werte unten sind gegen `dist/lib` vom Stand `8e056bf`
     nachgemessen, die Grün-Werte gegen eine Nachbildung des Zielcodes:
     - `'a multi-component setter takes a typed array'` — `{vertexCount: 1, attributes:
       {pos: {components: ['x','y','z']}}}`, erst `setPos(1, 2, 3)`, dann
       `setPos(new Float32Array([4, 5, 6]))`; `Array.from(getPos())` ist `[4, 5, 6]`.
       Rot: `[NaN, 2, 3]` — das TypedArray landet als einzelner Wert in der ersten
       Komponente, der Rest behält, was vorher dastand.
     - `'a multi-component setter takes a typed array across every vertex'` —
       `{vertexCount: 2, attributes: {pos: {components: ['x','y']}}}`, `setPos([1,2,3,4])`,
       dann `setPos(new Float32Array([9,8,7,6]))`; Ergebnis `[9, 8, 7, 6]`.
       Rot: `[NaN, 2, 3, 4]`.
     - `'a single-component setter takes a typed array'` — `{vertexCount: 3, attributes:
       {bar: {size: 1}}}`, `setBar(new Float32Array([5, 6, 7]))`; Ergebnis `[5, 6, 7]`.
       Rot: `[NaN, NaN, NaN]` — hier läuft der andere Zweig, und er schreibt `undefined`.
     - `'a setter takes the array a getter answers with'` — zwei Vertex-Objekte desselben
       Pools, `a.setPos(1, 2, 3)`, `b.setPos(a.getPos())`; `Array.from(b.getPos())` ist
       `[1, 2, 3]`. Rot: `[NaN, 0, 0]`. Dieser Fall ist der Grund, warum der Befund
       überhaupt jemanden trifft — die generierten Getter antworten mit einem TypedArray,
       der Rundlauf ist also die naheliegende Schreibweise.
     - `'a setter leaves the components it was not given'` — `{vertexCount: 2, attributes:
       {pos: {components: ['x','y']}}}`, `setPos([1,2,3,4])`, dann `setPos([5, 4])`;
       Ergebnis `[5, 4, 3, 4]`. Vor dem Fix bereits grün: nicht als Rot-Nachweis zählen,
       aber schreiben — er hält die Regel fest, auf die der zweite Zweig gezogen wird.
     - `'a single-component setter leaves the vertices it was not given'` —
       `{vertexCount: 3, attributes: {bar: {size: 1}}}`, `setBar([1,2,3])`, dann
       `setBar([9])`; Ergebnis `[9, 2, 3]`. Rot: `[9, NaN, NaN]`.
     - `'a setter still takes its values as separate arguments'` und
       `'a setter still takes its values as a plain array'` — beide vor dem Fix grün,
       beide schreiben: sie sind die Zusicherung, die der Umbau nicht verlieren darf.
     - `'a setter writes into an interleaved buffer at the attribute offset'` —
       `{vertexCount: 2, attributes: {foo: {components: ['x','y']}, bar: {size: 3}}}`; beide
       teilen sich den Vorgabe-Buffer `static_float32` mit `itemSize` 5. Die Attributnamen
       werden sortiert, `bar` sitzt damit auf Offset 0 und `foo` auf Offset 3 — nachgesehen,
       nicht angenommen. Nach `setFoo(new Float32Array([7, 8, 9, 10]))` trägt
       `pool.buffer.buffers.get('static_float32').typedArray` die Werte
       `[0,0,0,7,8, 0,0,0,9,10]`. Rot: `[0,0,0,NaN,0, 0,0,0,0,0]`. Der Fall steht hier, weil
       er als einziger die Offset-Arithmetik des Setters prüft; ein Attribut auf Offset 0
       ließe einen Fehler darin durchgehen.
     - `'a float16 attribute keeps the fraction of a half float'` —
       `{vertexCount: 1, attributes: {v: {size: 1, type: 'float16'}}}`, `vo.v = 0.1` liest
       `0.0999755859375` zurück, `vo.v = 1.5` liest `1.5`. Rot: `0` und `1` — der Wert
       landet in einem Integer-Array und wird abgeschnitten.
     Neue Datei `createTypedArray.spec.ts` mit `describe('createTypedArray')`:
     - `'float16 answers a Float16Array'`. Rot: `Uint16Array`.
     - `'every data type answers its own array class'` — eine Tabelle über alle zehn Werte
       von `VertexAttributeDataType`. Außer `float16` vor dem Fix grün.
     - `'an unknown data type throws'` — vor dem Fix grün.
     In `VertexObjectBuffer.spec.ts` ein Fall zu `copyAttributes()`:
     - `'copyAttributes() stops at the end of the source data'` — Quelldaten, die mitten im
       letzten Objekt enden; der Rest des Buffers bleibt `0`. Vor dem Fix grün, hält die
       Semantik fest, die der allokationsfreie Umbau bewahren muss.
  2. **`createVertexObjectPrototype.ts`, `makeAttributeValueSetter()`** (:52-63) bekommt
     genau diesen Rumpf — er behebt beide Findings in einem Zug und ist gegen den
     Compiler dieses Repos geprüft:

     ```ts
     return function setAttributeValues(this: VO, ...values: number[] | [ArrayLike<number>]) {
       const first = values[0];
       const source: ArrayLike<number> = values.length === 1 && typeof first !== 'number' ? first : (values as number[]);
       const idx = this[voIndex] * vertexCount * bufferItemSize + attrOffset;
       const target = this[voBuffer].buffers.get(bufferName)!.typedArray;
       const {length} = source;
       for (let i = 0, from = 0; i < vertexCount; i++, from += attrSize) {
         const to = idx + i * bufferItemSize;
         for (let j = 0; j < attrSize && from + j < length; j++) {
           target[to + j] = source[from + j];
         }
       }
     };
     ```

     Drei Entscheidungen stecken darin, jede mit ihrem Grund:
     - **Die Unterscheidung läuft über `typeof first !== 'number'`**, nicht über
       `ArrayBuffer.isView(…) || Array.isArray(…)`. Die Signatur verspricht
       `number[] | [ArrayLike<number>]`; »ist das einzige Argument eine Zahl oder nicht«
       ist genau diese Unterscheidung und braucht keine Liste erlaubter Behälterarten.
       Ein `arguments`-Objekt oder ein selbstgebautes `{length, 0, 1, 2}` deckt die
       Signatur ebenfalls ab, und eine Prüfung auf `isView`/`isArray` ließe beide
       weiterhin still danebengehen.
     - **Die innere Schleife ersetzt `Array.prototype.slice.call()` und den
       `attrSize === 1`-Sonderzweig.** Damit fällt pro Vertex ein Wegwerf-Array weg, und
       die beiden Zweige, die heute in ihrer Randbehandlung auseinanderlaufen, werden
       einer. Ein nach Größe 2/3/4 spezialisierter Generator, wie ihn die Empfehlung
       vorschlägt, kommt **nicht**: eine Schleife über zwei bis vier Elemente ohne
       Allokation ist bereits das, was der Befund verlangt, und drei zusätzliche
       Closure-Varianten je Deskriptor sind Code für einen Gewinn, den niemand gemessen
       hat. Abweichung von der Empfehlung, Begründung hier.
     - **`from + j < length` vereinheitlicht die Randbehandlung auf »schreiben, was
       übergeben wurde«.** Heute behält der Mehrkomponenten-Zweig bei zu kurzer Quelle den
       alten Inhalt (`slice` liefert weniger, `set` schreibt weniger), während der
       Einkomponenten-Zweig `undefined` schreibt und damit `NaN` in den GPU-Buffer legt.
       Vereinheitlicht wird auf die Regel des Mehrkomponenten-Zweigs: das ist der Pfad, den
       der Performance-Befund als den heißesten benennt, seine Randbehandlung bleibt damit
       unangetastet, und ein stilles `NaN` im Vertex-Buffer ist genau der Ausgang, den
       dieses Paket beseitigt — ihn an anderer Stelle stehenzulassen wäre widersinnig.
  3. **`VertexObjectBuffer.ts`, `copyAttributes()`** (:166): dieselbe Bewegung, dieselbe
     Randregel. Statt `buffer.typedArray.set(Array.prototype.slice.call(data, idx, idx + attrSize), bufIdx + attr.offset)`
     eine Schleife über `attrSize`, die bei `idx + k < data.length` stehenbleibt. Der
     bestehende Fall `copyAttributes` in `VertexObjectBuffer.spec.ts:229` liefert dann
     unverändert `2` und dieselbe 40-Elemente-Erwartung — gegen eine Nachbildung geprüft.
     Am Rest der Methode ändert sich nichts, insbesondere nicht an der `while`-Schleife
     und nicht an `copiedObjCount`.
  4. **`createTypedArray.ts`** (:9-10): `case 'float16': return new Float16Array(size);`.
     **Keine Feature-Detection.** Die Empfehlung stellt sie frei; sie hätte hier aber nur
     einen Rückfallweg auf `Uint16Array`, also auf den Befund selbst, und zwar still.
     Fehlt der Konstruktor, nennt der `ReferenceError` der Laufzeit ihn beim Namen; das ist
     die bessere Auskunft. Dass three seine eigenen Format-Tabellen mit
     `typeof Float16Array !== 'undefined'` absichert, ist kein Gegenbeispiel — die baut
     three beim Laden des Moduls auf, `createTypedArray()` läuft erst, wenn jemand ein
     `float16`-Attribut deklariert. Abweichung von der Empfehlung, Begründung hier.
  5. **`types.ts`** (:5-15): die `TypedArray`-Union bekommt `Float16Array` und listet jeden
     Typ genau einmal. Die Reihenfolge folgt der von `VertexAttributeDataType` zwei Zeilen
     tiefer — dann stehen beide Listen nebeneinander und die Dublette kann nicht
     zurückkommen:

     ```ts
     export type TypedArray =
       | Float64Array
       | Float32Array
       | Float16Array
       | Uint32Array
       | Int32Array
       | Uint16Array
       | Int16Array
       | Uint8ClampedArray
       | Uint8Array
       | Int8Array;
     ```

  6. **Der Compiler kennt `Float16Array` erst mit einem zusätzlichen `lib`-Eintrag.**
     In `tsconfig.json` der Workspace-Wurzel wird `"lib": ["ES2022", "DOM", "DOM.Iterable"]`
     zu `"lib": ["ES2022", "ESNext.Float16", "DOM", "DOM.Iterable"]`. Nachgemessen mit
     TypeScript 5.9.3: ohne den Eintrag `TS2304: Cannot find name 'Float16Array'`, mit ihm
     sauber. Die Deklaration liegt in `lib.esnext.float16.d.ts` und in keiner der
     ES-Jahrgangs-Libs, `"ES2022"` allein reicht also nie.
     Der Eintrag gehört in die Wurzel und nicht nur in `packages/twopoint5d/tsconfig.json`:
     jedes Projekt des Monorepos erbt von dort, und die Lookbook-App liest die
     `TypedArray`-Union über die gebauten Typen mit. Nx invalidiert korrekt — der benannte
     Input `sharedTsconfigs` in `nx.json` führt `{workspaceRoot}/tsconfig.json`.
  7. **Sechs Stellen, an denen ein Pool-Buffer nach three übergeht, brechen sonst.**
     `@types/three@0.183.1` führt in `src/core/BufferAttribute.d.ts:5-14` eine eigene
     `TypedArray`-Union ohne `Float16Array`; sobald unsere Union ihn enthält, meldet `tsc`
     dort `TS2345` beziehungsweise `TS2322`. Nachgemessen an einer Kopie des Pakets
     außerhalb des Projekts: genau diese sechs, keine weitere — insbesondere bleibt
     `VertexObjectPool.ts:57` (`.set(…subarray(…))`) unberührt.
     - `initializeAttributes.ts:24` — `new InterleavedBuffer(buffer.typedArray, …)`
     - `initializeAttributes.ts:38` — `new BufferAttribute(buffer.typedArray, …)`
     - `initializeInstancedAttributes.ts:19` — `new InstancedInterleavedBuffer(buffer.typedArray, …)`
     - `initializeInstancedAttributes.ts:33` — `new InstancedBufferAttribute(buffer.typedArray, …)`
     - `VOBufferGeometry.ts:164` — `bufAttr.array = poolBuf.typedArray;`
     - `InstancedVOBufferGeometry.ts:440` — `bufAttr.array = poolBuf.typedArray;`

     Dafür ein neues internes Modul `asThreeTypedArray.ts`, eine Funktion, an allen sechs
     Stellen aufgerufen. Kein `@ts-ignore`, kein nacktes `as any` — der Cast bekommt einen
     Namen und einen Satz, der sagt, warum er hält:

     ```ts
     import type {TypedArray as ThreeTypedArray} from 'three/webgpu';
     import type {TypedArray} from './types.js';

     /**
      * three keeps its own union of typed arrays, and `Float16Array` is not in it
      * (`@types/three@0.183.1`, `src/core/BufferAttribute.d.ts`). Both the WebGPU and the
      * WebGL attribute utilities do recognise one at runtime, so the gap sits in the types
      * alone. This is where a pool buffer crosses over into three, and crossing it is all
      * this function does.
      */
     export const asThreeTypedArray = (array: TypedArray): ThreeTypedArray => array as ThreeTypedArray;
     ```

     `import type {TypedArray as ThreeTypedArray} from 'three/webgpu'` löst auf — geprüft.
     Das Modul steht in keiner `public-api.ts`.
  8. **Der Node-Floor steigt auf 24**, wie im Kopf unter »Entscheidungen« beschlossen, und
     er steht an vier Stellen. Alle vier gehören in denselben Commit wie die Umstellung:
     eine allein zurückzulassen macht das Repo widersprüchlich.
     - `package.json` der Wurzel, `engines.node`: `">=22.13"` wird `">=24"`.
     - `mise.toml`: `node = "22"` wird `node = "24"`.
     - `.github/workflows/ci.yml:17`: `node-version: 22` wird `node-version: 24`. **Das ist
       die Stelle, die sonst rot wird und die kein lokaler Verify-Lauf sieht** — die neuen
       Tests laufen hier auf Node 25.9, in der Pipeline auf 22, und dort gibt es
       `Float16Array` nicht. `.github/workflows/deploy.yml:23` steht bereits auf 24 und
       bleibt.
     - `CLAUDE.md:9`: »Node ≥22.13 and pnpm ≥10.22 are required« wird auf ≥24 gezogen.
     **`packages/twopoint5d/package.json` bekommt kein `engines`-Feld.** Es hat heute keines,
     `scripts/makePackageJson.mjs` synthetisiert das veröffentlichte `package.json` aus
     dieser Datei, und die Wurzel-`engines` wandern nicht mit. Eines einzuführen wäre eine
     eigene Entscheidung mit eigenen Folgen — npm-Warnungen und `engine-strict`-Abbrüche für
     Consumer, die die Bibliothek im Browser ausliefern und `float16` nie anfassen. Der
     Beschluss im Kopf spricht vom Floor dieses Repos, und dort steht er jetzt.
  9. **`CHANGELOG.md`, Abschnitt `Unreleased`** nach `updating-changelog`:
     - `Changed`: `float16`-Attribute liegen in einem `Float16Array`; ein über die
       generierten Accessoren geschriebener Wert wird als Half-Float abgelegt und gelesen.
       Die `TypedArray`-Union führt `Float16Array` und jeden Typ genau einmal. Eine
       Laufzeit ohne `Float16Array` wirft beim ersten `float16`-Attribut; alle anderen
       Datentypen sind unberührt.
     - `Changed`: die generierten Mehrkomponenten-Setter und
       `VertexObjectBuffer#copyAttributes()` kopieren elementweise und allozieren pro Vertex
       nichts mehr.
     - `Fixed`: ein Setter nimmt ein TypedArray entgegen wie ein gewöhnliches Array —
       `b.setPos(a.getPos())` schreibt die Werte, die `a` trägt.
     - `Fixed`: übergibt der Aufrufer weniger Werte als `vertexCount * size`, behalten die
       übrigen Komponenten ihren Wert; das gilt für ein- und mehrkomponentige Attribute
       gleich.
     - `Migration Guide`: ein Abschnitt `#### float16 attributes are half floats` mit
       Before/After des Bufferinhalts und den zwei Anforderungen — eine Laufzeit mit
       `Float16Array`, und für Consumer, die den Typ `TypedArray` selbst benennen, ein
       `lib`, das `ESNext.Float16` enthält (in TypeScript 5.9.3 nachgesehen: die
       Deklaration liegt in `lib.esnext.float16.d.ts`). Der Node-Floor des Repos gehört
       nicht in den Migrationshinweis des Pakets — das veröffentlichte `package.json` trägt
       kein `engines`.
     Die Konvention aus dem Kopf gilt: jeder Satz beschreibt, was der Code *tut*. Der
     Migrations-Abschnitt ist die eine Stelle, an der ein Vorher/Nachher hingehört.
 10. **Nicht mitnehmen**, obwohl es in den angefassten Dateien steht:
     - Die Prettier-Verletzungen in den Import-Zeilen von `initializeAttributes.ts:1` und
       `initializeInstancedAttributes.ts:2` — sie stehen als eigener Eintrag in »Offene
       Befunde«, und die Drain-Runde räumt alle Prettier-Fundstellen des Laufs zusammen ab.
       Genau so ist Paket 3 mit den vier Fundstellen in `sprites/` verfahren. Neue und
       geänderte Zeilen folgen der Repo-Konfiguration (`bracketSpacing: false`,
       `printWidth: 130`, `singleQuote: true`), die umliegenden bleiben unangetastet.
     - `createVertexObjectPrototype.ts:132` — `Object.fromEntries(entries as [])`, ein Cast
       auf das leere Tupel. Und `VertexObjectBuffer.ts:82` — das `@ts-ignore` über
       `typedArray: undefined` im Konstruktor. Beide gehören zum Paket der benannten
       Cast-Helfer und stehen in dessen Bereich.
     - Die drei `@ts-ignore` in `VertexAttributeDescriptor.ts:32,37,42`. Dieselbe Zuordnung.
- Verify: `pnpm lint && NX_TUI=false pnpm nx run-many -t build --skip-nx-cache && NX_TUI=false pnpm nx run-many -t checkPkgTypes --skip-nx-cache && NX_TUI=false pnpm nx run-many -t test --projects=tag:ci --skip-nx-cache`
  (die vier Kommandos aus dem Kopf, ohne Nx-Cache). Ein fünftes gibt es nicht: das vierte
  fährt die Playwright-Suite bereits mit, weil `twopoint5d-testing` den Tag `ci` trägt —
  siehe die Berichtigung im Abschnitt »Verify-Kommandos«. Dass `checkPkgTypes` die neue
  Union verträgt, ist vorab geprüft: `attw` über ein Paket, dessen `.d.ts` `Float16Array`
  nennt, meldet »No problems found«.
- Commit: `fix(twopoint5d): accept typed arrays in generated setters and back float16 with Float16Array`
- Ergebnis: 2 Runden · BUG-026, PERF-009 und API-029 behoben · 14 neue Tests, davon 8 vor
  ihrem Fix rot gesehen — in `createVertexObjectPrototype.spec.ts` sieben (`a
  multi-component setter takes a typed array` → `[NaN, 2, 3]`, `… across every vertex` →
  `[NaN, 2, 3, 4]`, `a single-component setter takes a typed array` → `[NaN, NaN, NaN]`,
  `a setter takes the array a getter answers with` → `[NaN, 0, 0]`, `a single-component
  setter leaves the vertices it was not given` → `[9, NaN, NaN]`, `a setter writes into an
  interleaved buffer at the attribute offset` → `[0,0,0,NaN,0, 0,0,0,0,0]`, `a float16
  attribute keeps the fraction of a half float` → `0` statt `0.0999755859375`) und in
  `createTypedArray.spec.ts` einer (`float16 answers a Float16Array`), der vor dem Fix
  nicht als Assertion, sondern als `TS2304: Cannot find name 'Float16Array'` scheiterte —
  dieselbe Lücke, die Schritt 6 mit dem `lib`-Eintrag schließt · die sechs übrigen Fälle
  (drei in `createVertexObjectPrototype.spec.ts`, zwei in `createTypedArray.spec.ts`, einer
  in `VertexObjectBuffer.spec.ts`) waren als Grenzfälle vorher schon grün und halten die
  Zusicherungen fest, die der Umbau nicht verlieren durfte · Verify grün über alle vier Kommandos ohne Nx-Cache
  (`<arbeitsdir>/paket-4.verify.log`, exit=0, 90 Test-Dateien, 1388 Tests plus die fünf
  Playwright-Browsertestdateien) · die Fehlerkette lief 1 → 0: der eine wichtige Befund
  waren zwei CHANGELOG-Zeilen, die den Vorzustand erzählten
- klein offen: keine
- Nebenbefunde: keine neuen aus der Umsetzung · die sechs aus Zug 0 stehen in der Queue
  (5 → Scope, 1 → Audit)
- Folgen: keine. Die sechs Übergabestellen nach three sind über `asThreeTypedArray()`
  mitgezogen, kein Aufrufer außerhalb der Paketdateien greift auf die geänderten
  Signaturen von `setAttributeValues`, `copyAttributes()` oder `createTypedArray()` zu.
  Die Prettier-Verletzungen in den Import-Zeilen von `initializeAttributes.ts:1` und
  `initializeInstancedAttributes.ts:2` stehen unverändert und bleiben ihr eigener Eintrag
  in »Offene Befunde« — nachgesehen mit `npx prettier --check` nach dem Commit.
- Schnittstellen:
  - Ein generierter Attribut-Setter nimmt ein TypedArray entgegen wie ein gewöhnliches
    Array; die Unterscheidung läuft über »ist das einzige Argument eine Zahl«. Übergibt
    der Aufrufer weniger Werte als `vertexCount * size`, behalten die übrigen Komponenten
    ihren Wert — für ein- und mehrkomponentige Attribute gleich. Weder der Setter noch
    `VertexObjectBuffer#copyAttributes()` allozieren pro Vertex noch etwas.
  - Der Datentyp `float16` liegt in einem `Float16Array`; ein über die generierten
    Accessoren geschriebener Wert wird als Half-Float abgelegt und gelesen. Eine Laufzeit
    ohne `Float16Array` wirft beim ersten `float16`-Attribut — keine Feature-Detection,
    kein stiller Rückfall.
  - Die exportierte Union `TypedArray` (`vertex-objects/types.ts`, über
    `export type *` in `vertex-objects/public-api.ts`) führt `Float16Array` und jeden Typ
    genau einmal. Wer den Typ selbst benennt, braucht ein `lib`, das `ESNext.Float16`
    enthält.
  - neues internes Modul `asThreeTypedArray.ts` mit
    `asThreeTypedArray(array: TypedArray): ThreeTypedArray` — der benannte Cast an den
    sechs Stellen, an denen ein Pool-Buffer nach three übergeht. Steht in keiner
    `public-api.ts`.
  - Der Node-Floor des Repos steht auf `>=24` (`package.json`, `mise.toml`,
    `.github/workflows/ci.yml`, `CLAUDE.md`), `tsconfig.json` der Wurzel führt
    `ESNext.Float16` in `lib`. Das veröffentlichte `package.json` trägt weiterhin kein
    `engines`-Feld.

**BUG-026 · medium · `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:52-63`** — Generierte Setter korrumpieren Daten still, wenn ein TypedArray übergeben wird

Der Signaturtyp `VOAttrSetter` verspricht `ArrayLike<number>`, die Implementierung prüft aber
mit `Array.isArray(values[0])` — für `Float32Array` & Co. false. Das TypedArray wird dann als
*einzelner Wert* interpretiert: `vo.setPos(new Float32Array([7,8,9]))` schreibt `NaN` in die
erste Komponente und lässt den Rest unangetastet (verifiziert). Kein Fehler, kein Warning — nur
stilles NaN im GPU-Buffer.

Empfehlung: Prüfung auf `typeof values[0] !== 'number'` oder
`ArrayBuffer.isView(values[0]) || Array.isArray(values[0])` umstellen. Für den Copy-Pfad
`target.set(source.subarray(…))` statt `Array.prototype.slice` nutzen (siehe auch PERF-009).

Abweichung von der Empfehlung, entschieden in Zug 0: die Prüfung kommt als
`typeof first !== 'number'`, der Copy-Pfad aber **nicht** über `subarray()`. Die Quelle ist auf
diesem Pfad in der Mehrzahl der Aufrufe gar kein TypedArray, sondern das Rest-Argument-Array
oder ein gewöhnliches Array — `subarray()` gibt es dort nicht. Eine elementweise Schleife trägt
beide Quellarten, alloziert ebenso wenig und vereinheitlicht dabei die beiden Zweige, die heute
am Rand auseinanderlaufen. Der Grund steht ausführlich in Schritt 2.

**PERF-009 · medium · `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:60`, `VertexObjectBuffer.ts:166`** — Array.prototype.slice pro Vertex im heißesten Schreibpfad

Die generierten Multi-Komponenten-Setter — der Pfad, über den *jede* Sprite-Eigenschaft gesetzt
wird — allozieren pro Vertex ein frisches JS-Array via `Array.prototype.slice.call()`;
`copyAttributes()` ebenso pro Vertex pro Objekt. Bei 10 000 Sprites mit 4 Vertices sind das
40 000 Wegwerf-Arrays pro Attribut-Update — vermeidbarer GC-Druck genau dort, wo die Bibliothek
ihr Performance-Versprechen einlöst.

Empfehlung: Elementweise Kopierschleifen (`for` über `attrSize`) oder `typedArray.set` mit
Subarray-Views statt slice. Die Setter werden einmal pro Descriptor generiert — dort lohnt ein
spezialisierter Codepfad für size 2/3/4.

Abweichung von der Empfehlung, entschieden in Zug 0: elementweise Kopierschleifen ja,
spezialisierter Codepfad für size 2/3/4 nein. Begründung in Schritt 2.

**API-029 · info · `packages/twopoint5d/src/vertex-objects/createTypedArray.ts:9-10`, `types.ts:5-15`** — float16 erzeugt still ein Uint16Array; TypedArray-Union führt Uint16Array doppelt

Der Datentyp `float16` wird auf `Uint16Array` gemappt — wer nicht selbst Half-Float-Bits packt,
bekommt stumm falsche Werte. Seit ES2024/three r160+ gäbe es `Float16Array` bzw. three-seitige
Half-Float-Unterstützung. Nebenbefund: die `TypedArray`-Union listet `Uint16Array` doppelt und
`Float16Array` gar nicht.

Empfehlung: Entweder `Float16Array` verwenden (mit Feature-Detection) oder die
Half-Float-Semantik am Typ dokumentieren. Union-Duplikat bereinigen.

Abweichung von der Empfehlung, entschieden in Zug 0: `Float16Array`, aber ohne
Feature-Detection. Begründung in Schritt 4. Die Aussage »three-seitige
Half-Float-Unterstützung« ist gegen `three@0.183.1` nachgesehen und trägt: die WebGPU- wie die
WebGL-Attributhilfen erkennen `Float16Array` und bilden es auf das `float16`-Vertexformat ab,
während `Uint16Array` dort als Integer-Format ankommt — der Grund, warum die heutige Zuordnung
nicht nur unschön, sondern falsch ist. Eine Grenze, die dabei sichtbar wird und in dieser
Codebase über keinen Pfad erreichbar ist: für `itemSize === 1` kennt
`WebGPUAttributeUtils._getVertexFormat()` kein `float16`-Format und meldet »Vertex format not
supported yet«. Das trifft nur ein einzelnes `float16`-Attribut der Größe 1 in einem eigenen
Buffer — der Vorgabe-Buffername ist `${usage}_${dataType}`, mehrere `float16`-Attribute teilen
sich also einen Buffer mit größerem `itemSize`. Kein Anlass, hier etwas zu bauen; genannt,
damit es niemanden überrascht.

### [x] 5. Render-Loop-Allokationen und Pool-Typisierung
- Findings: PERF-011 (low), PERF-010 (medium, nur Dokumentation), TYPE-003 (low)
- Ziel: `update()` allokiert im Frame nichts mehr, das sich zwischen zwei Frames nicht ändert, und `attachInstancedPool()` nimmt kein `any` mehr entgegen.
- Bereich: `VOBufferGeometry.ts`, `selectAttributes.ts`, `selectBuffers.ts`, `InstancedVOBufferGeometry.ts`, `VertexAttributeDescriptor.ts` (TSDoc zu `autoTouch`)
- Hängt ab von: 2, 7 (beide arbeiten an derselben `update()`-Kette; Paket 7 schreibt
  `#syncAttributeArrays()` in beiden Geometry-Klassen um und löscht `#liveBuffers()`
  und `#poolArrayOf()`. Berichtigt 2026-09-03: `selectAttributes.ts` und
  `updateUpdateRange.ts` fasst Paket 7 entgegen der ursprünglichen Annahme nicht an —
  sie stehen diesem Paket unverändert zur Verfügung)
- Hash: 2ab8fbd
- Ergänzt nach Zug 0 von Paket 4 (2026-09-03): Paket 4 setzt in beiden Geometry-Klassen je
  eine Zeile — `bufAttr.array = asThreeTypedArray(poolBuf.typedArray)` in
  `VOBufferGeometry.ts:164` und `InstancedVOBufferGeometry.ts:440`. Sonst nichts an diesen
  Dateien; Schnitt und Reihenfolge dieses Pakets bleiben, wie sie sind.
- Ergänzt in Zug 0 dieses Pakets (2026-09-03) zum `Bereich:` oben: `selectAttributes.ts`
  fällt heraus, `types.ts` und ein neues Cast-Modul kommen hinzu — Begründung unter
  »Nicht anfassen« bzw. in Schritt 6. Maßgeblich ist die Liste unter `Dateien:`.
- Modell: mittlere Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/selectBuffers.ts`
  - `packages/twopoint5d/src/vertex-objects/asInstancedCopySource.ts` (neu)
  - `packages/twopoint5d/src/vertex-objects/types.ts` (TSDoc an `autoTouch`)
  - `packages/twopoint5d/src/vertex-objects/VertexAttributeDescriptor.ts` (TSDoc am Getter)
  - `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`

- Vorgehen:

  1. **`#syncAttributeArrays()` in beiden Geometry-Klassen: ein Durchgang statt zwei, und
     kein `Object.entries` mehr.** `VOBufferGeometry.ts:137-169`,
     `InstancedVOBufferGeometry.ts:405-443`.

     Der Kopf der Schleife wird `for (const attrName in this.attributes)` mit
     `const attr = this.attributes[attrName];` als erster Zeile. `this.attributes` ist in
     three ein einfaches Objektliteral (`BufferGeometry`-Konstruktor), sein Prototyp trägt
     nur nicht-aufzählbare Eigenschaften — `for…in` sieht damit genau die Schlüssel, die
     `Object.entries` geliefert hat, in derselben Reihenfolge, und alloziert dabei weder
     das Paar-Array noch ein Paar je Attribut.

     Die zweite Schleife entfällt, ihr Rumpf wandert in die erste. Das Feld
     `#updateAttributes` wird ersatzlos gelöscht — es hat nur Daten zwischen zwei Schleifen
     derselben Funktion getragen, und mit ihm verschwindet ein Feld, dessen Lebensdauer
     `dispose()` verwalten musste. Also fällt in **beiden** `dispose()`-Körpern die Zeile
     `this.#updateAttributes.clear();` samt ihrem zweizeiligen Kommentar weg
     (`VOBufferGeometry.ts:71-73`, `InstancedVOBufferGeometry.ts:305-307`); an ihre Stelle
     tritt die Zeile aus Schritt 2.

     Die Serial-Prüfung wird zu einem Frühausstieg:

     ```ts
     const version = bufAttr.version;
     // an attribute this geometry has not synced yet carries no serial, and undefined never
     // equals a version
     if (this.#serials.get(attrName) === version) continue;
     this.#serials.set(attrName, version);
     ```

     Das ist wertgleich mit dem heutigen `has`/`get`-Paar: `version` ist in three eine Zahl,
     die im Konstruktor auf `0` gesetzt wird, ein fehlender Eintrag liefert `undefined`, und
     `undefined === <number>` ist nie wahr.

     Danach folgt unverändert der Rumpf der bisherigen zweiten Schleife, mit denselben
     Frühausstiegen und denselben Kommentaren — in `VOBufferGeometry` die beiden
     Nachschlage-Schritte über `this.pool`, in `InstancedVOBufferGeometry` zusätzlich das
     `this.#slots.poolOf(attrName)` davor.

     `InterleavedBuffer` wird danach in keiner der beiden Dateien mehr benannt (es stand nur
     im Typ von `#updateAttributes`) und muss aus dem `import type` verschwinden, sonst
     schlägt `noUnusedLocals` zu. `BufferAttribute` bleibt, es trägt weiter den Cast.

     Aus dem TSDoc-Block über der Methode fällt in beiden Dateien die Zeile `TODO add tests`
     samt der leeren Kommentarzeile davor weg; die `fromBuffersData`-Fälle in
     `vertex-buffers-geometry-updates.spec.ts` prüfen diesen Pfad. Der übrige Text des Blocks
     bleibt Wort für Wort stehen.

  2. **Die Auto-Touch-Auswahl einmal auflösen statt in jedem Frame.** Das ist der Kern des
     Pakets: `#autoTouchAttributes()` reicht heute je Frame eine Namensliste per Spread an
     `touchAttributes()`, das daraus je Route ein `Set` und ein Ergebnis-Array baut und
     über eine frisch allozierte Closure iteriert. Zwischen Anbinden und Loslassen einer
     Route kommt dabei immer dasselbe heraus.

     **In `VOBufferGeometry`:** `#autoTouchAttrNames?: string[]` und
     `#getAutoTouchAttributeNames()` (`:215-224`) fallen weg. An ihre Stelle tritt

     ```ts
     #autoTouchBuffers?: BufferLike[];

     /**
      * The buffers behind the attributes that carry `autoTouch`, resolved once. The selection
      * changes only when a route is added or given up, and this geometry holds exactly one
      * route for its whole life.
      */
     #getAutoTouchBuffers(): BufferLike[] {
       if (this.#autoTouchBuffers == null) {
         const attrNames: string[] = [];
         for (const attr of this.pool.descriptor.attributes.values()) {
           if (attr.autoTouch) {
             attrNames.push(attr.name);
           }
         }
         this.#autoTouchBuffers = selectAttributes(this.pool, this.buffers, attrNames);
       }
       return this.#autoTouchBuffers;
     }
     ```

     und `#autoTouchAttributes()` (`:201-213`) endet auf

     ```ts
     for (const buffer of this.#getAutoTouchBuffers()) {
       buffer.needsUpdate = true;
     }
     ```

     Der frühe Ausstieg bei `this.pool.usedCount === 0` und der `#firstAutoTouch`-Block
     darüber bleiben unverändert.

     **In `InstancedVOBufferGeometry`** dasselbe Feld, und `#getAutoTouchBuffers()` sammelt
     über alle Routen. Die Namensliste ist die **Vereinigung** über alle Pools und wird jeder
     Route ganz vorgelegt — genau das tut `touchAttributes(...names)` heute, und daran ändert
     dieses Paket nichts:

     ```ts
     #getAutoTouchBuffers(): BufferLike[] {
       if (this.#autoTouchBuffers == null) {
         const attrNames: string[] = [];
         const collectNames = (pool: VOBufferPool) => {
           for (const attr of pool.descriptor.attributes.values()) {
             if (attr.autoTouch) {
               attrNames.push(attr.name);
             }
           }
         };
         collectNames(this.instancedPool);
         if (this.basePool) {
           collectNames(this.basePool);
         }
         for (const pool of this.extraInstancedPools.values()) {
           collectNames(pool);
         }

         // every route answers with the buffers it holds for these names, and a name a route
         // does not carry selects nothing there
         const buffers: BufferLike[] = [];
         if (this.basePool) {
           buffers.push(...selectAttributes(this.basePool, this.baseBuffers, attrNames));
         }
         buffers.push(...selectAttributes(this.instancedPool, this.instancedBuffers, attrNames));
         for (const [name, pool] of this.extraInstancedPools) {
           const routeBuffers = this.extraInstancedBuffers.get(name);
           if (routeBuffers) {
             buffers.push(...selectAttributes(pool, routeBuffers, attrNames));
           }
         }
         this.#autoTouchBuffers = buffers;
       }
       return this.#autoTouchBuffers;
     }
     ```

     Die Reihenfolge Base → Instanced → Extra ist die von `touchAttributes()`; der Spread
     beim Einsammeln läuft einmal je Anbinden oder Loslassen über ein Array mit einem
     Eintrag je Buffer-Name und ist an dieser Stelle kein Thema.

     `#autoTouchAttributes` und `#getAutoTouchBuffers` werden dabei **gewöhnliche Methoden**,
     keine Arrow-Felder wie heute (`:501`, `:517`): die Basisklasse schreibt beide als
     Methode, gebunden weitergereicht wird keine von beiden, und die Arrow-Form kostet zwei
     Closures je Geometry.

     **Invalidierung.** Die drei Stellen, an denen sich die Auswahl ändern kann, sind schon
     da: `attachInstancedPool()` (`:167`) und `#detachRoute()` (`:219`) setzen statt
     `this.#autoTouchAttrNames` jetzt `this.#autoTouchBuffers = undefined`. Dazu kommt
     `dispose()` in **beiden** Klassen — dort ist die Zeile neu und steht an der Stelle, an
     der Schritt 1 `#updateAttributes.clear()` entfernt hat:

     ```ts
     // the resolved selection holds the very THREE.BufferAttributes this method is here to
     // let go of
     this.#autoTouchBuffers = undefined;
     ```

     Das ist keine Kosmetik: gibt der Aufrufer den Pool selbst herein, überlebt er das
     `dispose()` der Geometry mit `usedCount > 0`, und ein `update()` danach liefe über eine
     überlebende Auswahl in Attribute, die die Geometry gerade abgegeben hat.

     Der TSDoc von `InstancedVOBufferGeometry#dispose()` zählt auf, was zurückbleibt, und
     nennt dabei `#autoTouchAttrNames` (`:264-267`). Der Halbsatz wird zu »plus
     `#firstAutoTouch`«.

     Der Nachschlagepfad `selectAttributes()` bleibt unverändert — er läuft nach diesem
     Schritt nur noch beim Anbinden und beim öffentlichen `touchAttributes()`.

  3. **`selectBuffers()` ohne Zwischen-Arrays** (`selectBuffers.ts:10-17`). Heute entstehen je
     Usage-Typ ein `Array.from(...)`, ein `filter`-Ergebnis und ein `push(...spread)`; der
     Spread ist bei großen Buffer-Zahlen zusätzlich ein Stack-Risiko. Neu:

     ```ts
     const results: BufferLike[] = [];
     for (const usageType in bufferTypes) {
       if (bufferTypes[usageType as VertexAttributeUsageType] !== true) continue;
       const drawUsage = toDrawUsage(usageType as VertexAttributeUsageType);
       for (const buffer of buffers.values()) {
         if (buffer.usage === drawUsage) {
           results.push(buffer);
         }
       }
     }
     return results;
     ```

     Verhalten und Reihenfolge bleiben gleich. `selectBuffers.spec.ts` muss ohne Änderung
     grün bleiben; ist sie es nicht, ist die Umschreibung falsch und nicht der Test.

  4. **Die Aufrufreihenfolge in `update()` angleichen.** `InstancedVOBufferGeometry#update()`
     (`:389-390`) ruft `#updateBuffersUpdateRange()` vor `#autoTouchAttributes()`,
     `VOBufferGeometry#update()` (`:121-122`) umgekehrt. Die Instanced-Klasse übernimmt die
     Reihenfolge der Basisklasse: `#checkBufferSerials()` → `#autoTouchAttributes()` →
     `#updateBuffersUpdateRange()`. Nachgesehen, dass das frei wählbar ist: `needsUpdate = true`
     erhöht in three nur `version`, `updateUpdateRange()` schreibt nur `updateRanges`, keins
     von beiden liest das andere.

  5. **`attachInstancedPool()` nimmt kein `any` mehr und gibt dem eingepackten Pool die
     Kapazität der Geometry** (`:129-171`).

     ```ts
     attachInstancedPool<VOType = unknown>(
       name: string,
       pool: VertexObjectPool<VOType> | VertexObjectDescriptor | VertexObjectDescription,
       options?: {autoDispose?: boolean},
     ): VertexObjectPool<VOType> {
     ```

     Im Rumpf wird aus `new VertexObjectPool(descriptor, 1)` ein
     `new VertexObjectPool<VOType>(descriptor, this.instancedPool.capacity)`. Der TSDoc der
     Methode verlangt zwei Absätze höher, dass die Kapazitäten zueinander passen, und nennt
     den `.instancedPool` als Bezugsgröße — die harte `1` widerspricht dem eigenen Vertrag,
     und weil ein angebundener Pool seit Paket 1 nicht mehr `resize()`-bar ist, gibt es aus
     ihr auch keinen Ausweg. Wer eine andere Kapazität will, übergibt einen fertigen Pool;
     dieser Weg steht schon offen und wird im TSDoc benannt statt eine neue Option zu bauen.

     Braucht die Verengung durch `instanceof VertexObjectPool` im generischen Fall einen Cast
     auf `VertexObjectPool<VOType>`, ist der in Ordnung — er steht innerhalb der Methode, die
     ihn selbst erzeugt.

     Der TSDoc bekommt einen `@typeParam VOType` und im `@param pool` den Satz, dass ein
     eingepackter Deskriptor die Kapazität des `.instancedPool` erbt. Der Absatz »you should
     make sure that the capacities match each other in each case« wird zu der Aussage, die
     jetzt gilt: für einen hereingereichten Pool bleibt das die Sache des Aufrufers.

     **Abweichung von der Empfehlung des Audits**, Begründung unter TYPE-003 weiter unten:
     eine Laufzeitprüfung »passt das Pool-Schema zur Geometry« wird **nicht** gebaut.

     Aufrufer außerhalb der Bibliothek gibt es nicht — nachgesehen über `packages/` und
     `apps/`, alle Fundstellen liegen in Specs. Ein Aufrufer, dem `unknown` zu eng wird,
     schreibt seinen VO-Typ hin: `attachInstancedPool<MeinVO>('extra', desc)`. Genau das ist
     der Zweck der Änderung; ein zurückgedrehtes `any` wäre keine Lösung.

  6. **Der benannte Cast für `this.copy()` im Konstruktor** (`:72`). Neues Modul
     `asInstancedCopySource.ts`, in der Machart von `asThreeTypedArray.ts` aus Paket 4 — eine
     Funktion, ein Name, der die Grenze benennt, ein TSDoc, das sagt, warum der Cast trägt.
     Steht in **keiner** `public-api.ts`.

     ```ts
     import type {BufferGeometry, InstancedBufferGeometry} from 'three/webgpu';

     /**
      * Hands a plain `BufferGeometry` to `InstancedBufferGeometry#copy()`.
      *
      * three narrows `copy()` to its own class, but the body reads what every
      * `BufferGeometry` carries plus `instanceCount` — which a plain geometry does not have,
      * so the copy leaves it `undefined`. `InstancedVOBufferGeometry#update()` writes its own
      * `instanceCount` from the instanced pool before the first frame is drawn.
      * Checked against three 0.183.1, `src/core/InstancedBufferGeometry.js:36-44`.
      */
     export function asInstancedCopySource(geometry: BufferGeometry): InstancedBufferGeometry {
       return geometry as InstancedBufferGeometry;
     }
     ```

     Im Konstruktor wird daraus `this.copy(asInstancedCopySource(args[2]));`. Zur Laufzeit
     ändert sich nichts — das war vorher ein `as any` und ist jetzt ein Cast mit einem Namen.

  7. **PERF-010: `autoTouch` dokumentieren.** Kein Code, so entschieden im Kopf des Plans
     (»`autoTouch` bleibt der Default und wird nur dokumentiert«). Drei Stellen:

     - `types.ts:35`, an `autoTouch?: boolean` in `VADescription` — dort schreibt der Nutzer
       den Wert hin. Der Block sagt: was der Default je Usage-Typ ist; dass die generierten
       Setter kein Schreiben mitzählen und Auto-Touch deshalb der Pfad ist, über den
       geschriebene Werte überhaupt zur GPU kommen; dass er den Buffer hochlädt, ob sich
       etwas geändert hat oder nicht, ein großer, überwiegend statischer Pool also je Frame
       einen vollen Upload zahlt; und dass `autoTouch: false` plus ein `touch()` nach dem
       Schreiben genau die Frames hochlädt, in denen etwas passiert ist.
     - `VertexAttributeDescriptor.ts:27`, am Getter — zwei Zeilen mit der Default-Regel und
       einem `{@link}` auf das Feld oben.
     - `touch()` in beiden Geometry-Klassen (`VOBufferGeometry.ts:99`,
       `InstancedVOBufferGeometry.ts:366`) bekommt einen vollen TSDoc-Block: was ein Aufruf
       bewirkt, welche beiden Argumentarten er nimmt, und dass er der Gegenpart zu
       `autoTouch: false` ist. `touchAttributes()` und `touchBuffers()` in beiden Klassen
       bekommen je eine Zeile.

     Konvention beachten: kein Rückblick auf einen Vorzustand. Die Blöcke beschreiben, was
     gilt, nicht was war.

  8. **Prettier über die beiden Geometry-Dateien.** `npx prettier --write` auf
     `VOBufferGeometry.ts` und `InstancedVOBufferGeometry.ts`. Nachgemessen betrifft das nur
     die Import-Blöcke (2 bzw. 8 Zeilen); der Implementierer steht in Schritt 1 und 6 ohnehin
     genau dort. Die vier weiteren Dateien derselben Familie bleiben in »Offene Befunde«
     liegen.

  9. **Tests**, alle in `vertex-buffers-geometry-updates.spec.ts`.

     Der einzige rot-vor-grün-Fall ist (a); der Nachweis des roten Laufs gehört in den
     Report:

     (a) `attachInstancedPool()` mit einem Deskriptor gibt dem Pool die Kapazität des
     `.instancedPool`. Heute liefert das `1` — der Test ist vor Schritt 5 rot.

     (b) bis (d) sind **Wächter** für den Cache aus Schritt 2: sie sind vorher wie nachher
     grün und werden rot, sobald die Invalidierung fehlt. Das ist kein nachgereichter
     Regressionstest, sondern die Abdeckung des Risikos, das dieses Paket neu einführt — im
     Report bitte auch so benannt und **nicht** als roter Lauf ausgegeben.

     (b) Nach `attachInstancedPool()` mit einem Pool, dessen Attribut `autoTouch` trägt,
     hebt das nächste `update()` die `version` des zugehörigen `BufferLike` der neuen Route.
     Ohne Invalidierung in `attachInstancedPool()` bleibt sie stehen.

     (c) Nach `detachInstancedPool()` rührt das nächste `update()` die `version` der
     Buffer der abgegebenen Route nicht mehr an und wirft nicht.

     (d) Eine Geometry auf einem **von außen hereingereichten** Pool (nur so überlebt der
     Pool das `dispose()` mit `usedCount > 0`): `update()`, Versionen merken, `dispose()`,
     `update()` — die Versionen stehen. Einmal für `InstancedVOBufferGeometry`, einmal für
     `VOBufferGeometry`. `describe('update() after dispose()')` (`:906`) ist das Zuhause.

     Kein Browsertest in diesem Paket. Alles, was hier schiefgehen kann, ist an `version`
     und `needsUpdate` der three-Attribute in Node ablesbar — genau so ist der Slot-Befund in
     Paket 7 nachgemessen worden. Der Eintrag »die Browsertest-Suite deckt keinen Pfad aus
     `vertex-objects/` ab« bleibt in »Offene Befunde« liegen und gehört der Drain-Runde, die
     ihn einmal richtig baut statt dreimal nebenbei.

  10. **CHANGELOG.** `packages/twopoint5d/CHANGELOG.md`, Abschnitt `Unreleased`, nach den
      Regeln des Skills `updating-changelog` (vorher laden). Unter `Changed` zwei Einträge:

      - `InstancedVOBufferGeometry#attachInstancedPool()` ist generisch über den VO-Typ und
        liefert `VertexObjectPool<VOType>`; ohne Angabe ist der Typ `unknown`.
      - Ein Deskriptor, der an `attachInstancedPool()` übergeben wird, wird zu einem Pool mit
        der Kapazität des `.instancedPool`.

      Dazu ein Migrations-Abschnitt zur Typänderung: wer den zurückgegebenen Pool bisher
      ohne Typangabe weiterbenutzt hat, bekommt `unknown` statt `any` und schreibt seinen
      VO-Typ hin — `attachInstancedPool<MeinVO>('extra', desc)`. Vorher/Nachher gehört genau
      dorthin und nirgends sonst.

      Schritt 1 bis 4 und 7 bekommen **keinen** Eintrag: sie ändern kein sichtbares
      Verhalten. Ein Doku-Zusatz ist in Keep a Changelog keine Kategorie.

- Nicht anfassen — steht in »Offene Befunde« und gehört der Drain-Runde, auch wenn es in
  Reichweite liegt. Melden ja, beheben nein:
  - `InstancedVOBufferGeometry.ts:465` — `if (this.instancedPool)` in
    `#checkBufferSerials()` ist immer wahr.
  - `InstancedVOBufferGeometry.ts:368` — `let buffers: …;` in `touch()` ohne `= undefined`.
  - `initializeAttributes.ts` und `initializeInstancedAttributes.ts` — Prettier und die
    ungeprüften `.length`-Zugriffe.
  - `VertexAttributeDescriptor.ts:32,37,42` — die drei `@ts-ignore`. Sie gehören Paket 6.
  - `selectAttributes.ts` bleibt, wie es ist. Nach Schritt 2 läuft es nicht mehr je Frame,
    und für den öffentlichen `touchAttributes()`-Pfad ist es richtig, wie es dasteht.

- Verify: `pnpm lint && NX_TUI=false pnpm nx run-many -t build --skip-nx-cache && NX_TUI=false pnpm nx run-many -t checkPkgTypes --skip-nx-cache && NX_TUI=false pnpm nx run-many -t test --projects=tag:ci --skip-nx-cache`
  (die vier Kommandos aus dem Kopf, ohne Nx-Cache; das vierte fährt die Playwright-Suite mit).
  Zusätzlich `npx prettier --check` auf die beiden Geometry-Dateien aus Schritt 8 — `pnpm lint`
  ist `eslint .` und sieht Formatierung nicht.
- Commit: `fix(twopoint5d): type attached pools and take the per-frame allocations out of update()`
- Ergebnis: 1 Runde · PERF-011, PERF-010 und TYPE-003 behoben, dazu die vier aus »Offene
  Befunde« aufgenommenen Einträge (Kapazität des eingepackten Pools, `TODO add tests` in
  beiden Klassen, Aufrufreihenfolge in `update()`, `#getAutoTouchAttributeNames()`) ·
  Regressionstest `a descriptor is wrapped in a pool with the capacity of the instancedPool`
  (vor dem Fix rot: `expected 1 to be 10`) · dazu vier Wächter für die Invalidierung des
  neuen Auto-Touch-Caches, die vorher wie nachher grün sind und je durch Herausnehmen ihrer
  Invalidierungszeile rot gemessen wurden — sie decken das Risiko ab, das dieses Paket neu
  einführt · Verify grün über alle vier Kommandos plus `prettier --check` auf die beiden
  Geometry-Dateien, ohne Nx-Cache gefahren (`<arbeitsdir>/paket-5.verify.log`, exit=0,
  90 Test-Dateien, 1398 Tests, dazu die Playwright-Suite über Chromium und Firefox) · der
  Reviewer hat keinen kritischen und keinen wichtigen Befund gefunden, die Fehlerkette
  entfiel damit
- klein offen:
  - `packages/twopoint5d/CHANGELOG.md:28,29` — beide `Changed`-Einträge tragen den
    Vorzustand im Text (»instead of `any`«, »instead of a fixed capacity of `1`«), obwohl
    der Migrationsteil zwanzig Zeilen weiter unten genau dafür da ist.
  - `packages/twopoint5d/CHANGELOG.md:29` — die Kapazitätsänderung bekommt keinen
    Migrationshinweis. Wer bisher einen Deskriptor übergeben hat, alloziert jetzt
    `instancedPool.capacity` Objekte statt einem; bei einem Sprite-System mit 100k
    Instanzen ist das ein spürbarer Sprung.
  - `VOBufferGeometry.ts:102`, `InstancedVOBufferGeometry.ts:368`,
    `VertexAttributeDescriptor.ts:29` und `types.ts:35` — die `{@link}`-Verweise zeigen je
    auf ein Symbol, das in der Datei nicht im Scope ist, und lösen weder im Editor noch in
    einem Doc-Generator auf.
  - `VOBufferGeometry.ts:103`, `InstancedVOBufferGeometry.ts:369` — »an attribute without
    `autoTouch` uploads only through an explicit `touch()`« stimmt nicht: `#firstAutoTouch`
    lädt einmal automatisch hoch, und `#checkBufferSerials()` synchronisiert, sobald sich
    der Buffer-Serial des Pools bewegt. Der Irrtum geht in die harmlose Richtung.
  - `InstancedVOBufferGeometry.ts:331` — »across every route« gilt nur für die flache Form
    von `touchAttributes()`; die `{base, instanced}`-Form schränkt bewusst auf eine Gruppe
    ein, und das unterschlägt die Einzeiler-Doku.
  - `InstancedVOBufferGeometry.ts:438` — `#checkBufferSerials()` legt je `update()` eine
    Closure an. Der Detailplan hat Iterator-Objekte und Eintragspaare ausdrücklich stehen
    lassen, diese Closure aber nicht benannt.
  - `vertex-buffers-geometry-updates.spec.ts:903-940` — die Wächter decken die
    Instanced- und die Extra-Route ab, nicht die Base-Route und nicht die Übernahme eines
    belegten Attributnamens durch einen anderen Pool. Beide Pfade laufen durch dieselbe
    Invalidierung, gemessen ist nur der eine.
- Nebenbefunde: → Queue (1 neuer Eintrag → Scope; dazu die zwei Fundstellen, um die der
  bestehende Prettier-Eintrag erweitert wurde)
- Folgen: keine. Die Signaturänderung von `attachInstancedPool()` hat außerhalb der Specs
  dieses Pakets keinen Aufrufer — nachgesehen über `packages/` und `apps/`, vom Reviewer
  gegen das gebaute `.d.ts` und die Doku im Repo bestätigt.
- Schnittstellen:
  - `InstancedVOBufferGeometry#attachInstancedPool<VOType = unknown>(name, pool, options?)`
    ist generisch über den VO-Typ und liefert `VertexObjectPool<VOType>`. Ohne Angabe ist
    der Typ `unknown`; wer den zurückgegebenen Pool weiterbenutzt, schreibt seinen VO-Typ
    hin — `attachInstancedPool<MeinVO>('extra', desc)`.
  - Ein Deskriptor, der an `attachInstancedPool()` übergeben wird, wird zu einem Pool mit
    der Kapazität des `.instancedPool` statt mit `capacity: 1`. Wer eine andere Kapazität
    braucht, übergibt einen fertigen Pool; für den bleibt der Kapazitätsabgleich Sache des
    Aufrufers.
  - neues internes Modul `asInstancedCopySource.ts` mit
    `asInstancedCopySource(geometry: BufferGeometry): InstancedBufferGeometry` — der
    benannte Cast für `this.copy()` im Konstruktor, in der Machart von
    `asThreeTypedArray.ts`. Steht in keiner `public-api.ts`.
  - Beide Geometry-Klassen halten die Auto-Touch-Auswahl als `#autoTouchBuffers?:
    BufferLike[]` und lösen sie einmal je Anbinden auf. Ein späteres Paket, das eine Route
    hinzufügt oder aufgibt, muss `this.#autoTouchBuffers = undefined` setzen — sonst
    schweigt der Fehler: die Daten stimmen, sie kommen nur nie zur GPU. Die vorhandenen
    Stellen sind `attachInstancedPool()`, `#detachRoute()` und `dispose()` in beiden
    Klassen. Entfallen sind dafür `#autoTouchAttrNames`,
    `#getAutoTouchAttributeNames()` und `#updateAttributes`.
  - `#autoTouchAttributes()` und `#getAutoTouchBuffers()` sind in beiden Klassen
    gewöhnliche Methoden, keine Arrow-Felder.


**PERF-011 · low · `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:86`, `selectAttributes.ts:4-13`, `selectBuffers.ts:10-17`** — Per-Frame-Allokationen in geometry.update()

`#syncAttributeArrays()` ruft jeden Frame `Object.entries(this.attributes)`; der autoTouch-Pfad
baut über `selectAttributes`/`selectBuffers` jeden Frame neue Sets und Arrays. Einzeln harmlos,
in Summe konstantes GC-Grundrauschen im Render-Loop — dem Pfad, den die Bibliothek als heißesten
deklariert.

Empfehlung: Attribut-Listen und autoTouch-Buffer-Auswahl einmalig cachen (sie ändern sich nur bei
attach/detach, wo der Cache schon invalidiert wird) und im Frame nur noch iterieren.

Abgleich in Zug 0 (2026-09-03): `VOBufferGeometry.ts:86` ist heute `:142`, dieselbe Zeile, dazu
`InstancedVOBufferGeometry.ts:410` als zweite Fundstelle. Die Attribut-*Namen* waren schon zum
Zeitpunkt des Audits gecacht (`#autoTouchAttrNames`, nachgesehen an `60f7612:…:155-163`) — offen
ist die *Buffer*-Auswahl, und genau die nimmt Schritt 2 heraus.

Berichtigung an der Beschreibung: `selectBuffers` läuft **nicht** jeden Frame. Im Update-Pfad wird
es nur über `#firstAutoTouch` erreicht, also einmal je Geometry. Es wird trotzdem angefasst
(Schritt 3), weil das öffentliche `touchBuffers()` es je Aufruf fährt und der `push(...spread)`
darin bei vielen Buffern ein Stack-Risiko ist.

Grenze, bewusst gezogen: Ziel ist, aus dem Frame zu nehmen, was sich zwischen zwei Frames nicht
ändert. Iterator-Objekte und Eintrags-Paare aus `Map`-Iterationen in `#checkBufferSerials()` und
`updateUpdateRange()` bleiben stehen — sie sind O(1) je Buffer, V8 analysiert sie in der Regel weg,
und sie herauszuoperieren macht den Code unleserlich, ohne die Aussage des Befunds zu berühren.

**PERF-010 · medium · `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:141-153`, `VertexAttributeDescriptor.ts:27-29`** — autoTouch lädt dynamische Buffer jeden Frame komplett hoch — auch ohne Änderung

Attribute mit `usage: dynamic/stream` bekommen per Default `autoTouch` und werden in jedem
`update()` mit `needsUpdate = true` markiert — unabhängig davon, ob sich etwas geändert hat. Die
generierten Property-Setter erhöhen die Buffer-Serials nämlich nicht, autoTouch ist also der
einzige Sync-Pfad. Konsequenz: ein großer, überwiegend statischer Sprite-Pool lädt seine
dynamischen Buffer 60-mal pro Sekunde vollständig zur GPU. Das Serial-System, das gezielte Uploads
könnte, läuft daran vorbei.

Empfehlung: Kurzfristig dokumentieren (autoTouch bewusst abschaltbar via `autoTouch: false` +
manuelles `touch()`). Mittelfristig: Setter könnten den Buffer-Serial dirty markieren (ein
Integer-Inkrement, kein Overhead), dann kann autoTouch entfallen und nur tatsächlich beschriebene
Buffer werden hochgeladen.

Vom Nutzer entschieden (siehe »Entscheidungen« im Kopf): nur die kurzfristige Hälfte. Der heiße
Schreibpfad zahlt kein Serial-Inkrement, `autoTouch` bleibt der Default. Dieses Paket schreibt
also ausschließlich Dokumentation — Schritt 7.

**TYPE-003 · low · `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:59, 89-90`** — as any-Casts und VertexObjectPool&lt;any&gt; ohne Schema-Validierung

Die Attach-Pfade für zusätzliche Pools nehmen `any` entgegen und prüfen nicht, ob das Pool-Schema
zur Geometry passt. Ein falsch verdrahteter Pool fällt erst beim Rendern auf, dann aber als stiller
Grafikfehler statt als Exception.

Empfehlung: Besser typisierte Overloads für `attachInstancedPool()`, die das Schema des Pools gegen
die Geometry-Description binden.

Abgleich in Zug 0 (2026-09-03): beide Fundstellen stehen unverändert, nur verschoben — `:59` ist
das `this.copy(args[2] as any)` im Konstruktor (heute `:72`), `:89-90` die Signatur von
`attachInstancedPool()` (heute `:129-133`). Nachgesehen an `60f7612:…:60,96-99`.

Abweichung von der Empfehlung, entschieden in Zug 0, zwei Teile:

1. **Keine Overloads, ein generischer Parameter.** »Das Schema des Pools gegen die
   Geometry-Description binden« ist der Zweck der Methode zuwider: extra angebundene Pools tragen
   ausdrücklich *andere* Deskriptoren als der `.instancedPool` — abweichender `meshCount`, andere
   Attributgruppen —, das steht so im TSDoc der Methode. Ein Typ, der beide aneinanderbindet, würde
   genau den Anwendungsfall verbieten, für den es die Methode gibt. Was ohne Schaden geht und das
   `any` wirklich beseitigt, ist ein `VOType` am Aufruf: der Aufrufer bekommt seinen eigenen
   Pool-Typ zurück statt `any`.

2. **Keine Laufzeitprüfung »passt der Pool zur Geometry«.** Der stille Grafikfehler, den der Befund
   beschreibt, hat zwei Achsen, und beide sind inzwischen anders gelagert. Kollidierende
   Attributnamen haben seit Paket 7 eine definierte Bedeutung — der Slot gehört einer Route, und
   wer ihn übernimmt, gibt ihn beim Loslassen zurück; das ist kein stiller Fehler mehr, sondern
   dokumentiertes Verhalten. Bleibt die Kapazität, und die repariert Schritt 5 an der Wurzel, statt
   sie zu melden: ein eingepackter Deskriptor bekommt die Kapazität der Geometry, statt auf `1`
   festzustehen. Eine Prüfung darüber hinaus hätte ohnehin keinen Ausgang — `console.warn` ist in
   diesem Repo ein Lint-Fehler, und `throw` auf einem heute funktionierenden Pfad wäre ein Bruch
   ohne Not.

### [x] 6. Benannte Cast-Helfer statt @ts-ignore
- Findings: TYPE-001 (medium) · dazu aus »Offene Befunde«: `sprites/node-utils.ts:47-49`
  (der unbenannte `as any` auf `modelViewMatrix`, dieselbe Ursache)
- Ziel: Kein `@ts-ignore` mehr im Repository; wo ein Cast nötig bleibt, trägt er einen Namen, der sagt, warum, und eine Lint-Regel hält den Zustand.
- Bereich: `packages/twopoint5d/src/vertex-objects/`, `texture/`, `stage/`, `sprites/` und `eslint.config.mjs`
- Hängt ab von: 1, 4, 5
- Hash: 0ae2932
- Modell: mittlere Stufe
- Effort: low

Steht bewusst am Ende: `VertexObjectPool.ts:83` fällt bereits mit Paket 1 weg,
weitere Stellen können sich in Paket 4 und 5 erledigen. Was hier übrig bleibt,
ist der echte Rest.

Ergänzt nach Zug 0 von Paket 4 (2026-09-03): Paket 4 räumt **kein** `@ts-ignore` ab, der
Bereich oben bleibt also vollständig. Es legt aber den ersten benannten Cast-Helfer des Laufs
an — `vertex-objects/asThreeTypedArray.ts`, eine Funktion, die einen Pool-Buffer nach three
hinüberreicht, weil dessen eigene `TypedArray`-Union kein `Float16Array` kennt. Dieses Paket
übernimmt die Machart, statt eine zweite danebenzustellen: ein Modul je Cast, ein Name, der
die Grenze benennt, ein TSDoc, der sagt, warum der Cast hält. Ob die Helfer am Ende in einem
gemeinsamen Modul liegen, entscheidet Zug 0 dieses Pakets mit allen Stellen vor Augen.

Ergänzt nach Zug 0 von Paket 5 (2026-09-03): Paket 5 legt den zweiten benannten Cast-Helfer an,
`vertex-objects/asInstancedCopySource.ts`, und räumt damit das `as any` aus dem Konstruktor von
`InstancedVOBufferGeometry`. Auch kein `@ts-ignore` — der Bereich oben bleibt vollständig, aber die
Frage nach einem gemeinsamen Modul steht dann über **zwei** vorhandenen Helfern. Schnitt und
Reihenfolge dieses Pakets bleiben, wie sie sind.

Abgleich in Zug 0 (2026-09-03), je Fundstelle nachgesehen:

- Das Audit zählt neun `@ts-ignore`. `VertexObjectPool.ts:83` ist mit Paket 1 weggefallen,
  die übrigen acht stehen unverändert. Zwei Zeilennummern sind gewandert:
  `VertexAttributeDescriptor.ts:32/37/42` liegt jetzt auf `:36/41/46` (der TSDoc-Block zu
  `autoTouch` aus Paket 5 hat vier Zeilen eingefügt). `VertexObjectBuffer.ts:82`,
  `TextureAtlas.ts:86`, `OrthographicProjection.ts:29/31` und `ParallaxProjection.ts:31`
  stehen auf ihren alten Zeilen.
- **Fünf Stellen zählt das Audit nicht mit:** `vertex-buffers-geometry-updates.spec.ts:151`,
  `:165`, `:178`, `:183`, `:195`. Sie liegen mitten im VO-Kern. Deshalb heißt das Ziel oben
  jetzt »im Repository« und nicht mehr »im VO-Kern«: mit der alten Formulierung dürfte ein
  Implementierer fünf Suppressions in `vertex-objects/` stehen lassen und wäre trotzdem
  fertig. `grep -rn '@ts-ignore' packages/ apps/` findet nach diesem Paket nichts mehr.
- **Nur drei der dreizehn unterdrücken überhaupt etwas.** Gemessen an einer Kopie des
  Quellbaums im Arbeitsverzeichnis, alle `// @ts-ignore`-Zeilen entfernt, `tsc` mit der
  echten Projektkonfiguration: es bleiben genau vier Fehlerzeilen, alle in
  `VertexAttributeDescriptor.ts` (TS2339, `size` bzw. `components` auf der jeweils anderen
  Hälfte der Union). Die übrigen zehn stehen über Zeilen, die fehlerfrei sind — sie behaupten
  ein Problem, das es nicht gibt, und das ist die schlechtere Sorte Suppression.
- Warum die zehn trotzdem einmal nötig waren: mit `strictNullChecks: true` kommen sie
  zurück — vier davon als TS2322 (`undefined` auf `TypedArray`, `TextureAtlasFrameName`,
  `ProjectionPlane`, `OrthographicProjectionSpecs`), die fünf im Spec gar nicht. Derselbe
  Lauf meldet dabei **458 Fehler im Paket**. `strictNullChecks` ist ein eigenes Vorhaben
  (im Audit CFG-001, nicht im Scope dieses Laufs), und dieses Paket baut nicht dagegen vor.
  Es baut gegen die Konfiguration, die gilt.
- `sprites/node-utils.ts:47-49` aus »Offene Befunde« kommt hinzu: dreimal
  `(modelViewMatrix as any)[n].y` unter einem `XXX fix me`-Kommentar. Gleiche Ursache wie die
  zweite Hälfte dieses Pakets — eine Typlücke von three, die niemand benannt hat. Der Eintrag
  war beim Notieren schon auf dieses Paket ausgerichtet.
- Ebenfalls hinzu: `ParallaxProjection.ts:37`, `this.viewSpecs as any`. Steht in einer Datei,
  die dieses Paket ohnehin anfasst, und ist derselbe unbenannte Cast. In keiner Liste, weil
  vor diesem Zug 0 niemand hingesehen hat.

Die Umsetzung ist im Arbeitsverzeichnis unter `p6-probe/` einmal vollständig durchgespielt:
`tsc` läuft sauber, `vitest --run` meldet 699 Tests in 45 Dateien grün, `prettier --check`
ist auf allen acht berührten und neuen Dateien zufrieden, und die erzeugten `.d.ts` der sechs
geänderten Module sind **byteweise identisch** mit denen im ausgelieferten `dist/lib`. Der
Implementierer schreibt seinen Code selbst; die Zahlen stehen hier, damit ein Abweichen
auffällt.

- Dateien:
  - `eslint.config.mjs`
  - `packages/twopoint5d/src/vertex-objects/VertexAttributeDescriptor.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`
  - `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`
  - `packages/twopoint5d/src/texture/TextureAtlas.ts`
  - `packages/twopoint5d/src/stage/OrthographicProjection.ts`
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts`
  - neu: `packages/twopoint5d/src/stage/asFitIntoRectangleSpecs.ts`
  - `packages/twopoint5d/src/sprites/node-utils.ts`
  - neu: `packages/twopoint5d/src/sprites/matrixColumn.ts`
  - **keine `public-api.ts`**: die beiden neuen Module sind interne Cast-Helfer in der
    Machart von `asThreeTypedArray.ts` und `asInstancedCopySource.ts`, und die stehen
    ebenfalls in keiner.
  - **kein CHANGELOG-Eintrag**, siehe Schritt 10.
- Vorgehen:
  1. **Die Lint-Regel zuerst, und den roten Lauf in den Report.** In `eslint.config.mjs:40`
     steht `'@typescript-eslint/ban-ts-comment': 0`. Auf `'error'` setzen, sonst nichts an
     der Datei ändern. Danach `pnpm lint` — der Lauf muss **genau 13 Fehler** melden,
     verteilt auf `OrthographicProjection.ts` (29, 31), `ParallaxProjection.ts` (31),
     `TextureAtlas.ts` (86), `VertexAttributeDescriptor.ts` (36, 41, 46),
     `VertexObjectBuffer.ts` (82) und `vertex-buffers-geometry-updates.spec.ts` (151, 165,
     178, 183, 195), jeder mit der Meldung »Use "@ts-expect-error" instead of "@ts-ignore"«.
     Diese Ausgabe ist der Rot-Nachweis dieses Pakets und gehört in den Report. Nachgemessen
     in Zug 0 über `npx eslint . --rule '{"@typescript-eslint/ban-ts-comment":"error"}'`:
     dreizehn Fehler, kein vierzehnter irgendwo sonst im Repo — die Regel kostet außerhalb
     dieses Pakets nichts.
     Die Voreinstellung der Regel ist die gewollte: `@ts-ignore` und `@ts-nocheck` sind
     verboten, ein `@ts-expect-error` mit Beschreibung bleibt der Weg für den Fall, dass
     später wirklich einer nötig wird. Kein `allow`, keine Optionen.
     `'@typescript-eslint/ban-ts-ignore': 0` in Zeile 41 bleibt unangetastet — dazu ein
     eigener Eintrag in »Offene Befunde«.
  2. **`VertexAttributeDescriptor.ts` — die drei echten Fehler.** Die Union
     `VertexAttributeDescription = VAComponentsType | VASizeType` hat `size` nur auf der
     einen und `components` nur auf der anderen Hälfte; die drei Getter lesen beide und
     fallen aufeinander zurück. Das ist ihr Zweck, und die Union kann es nicht ausdrücken.
     Kein Cast, sondern eine Verbreiterung auf dem Weg ins Feld:
     - Den Import in Zeile 1 auf sechs Namen erweitern (mehrzeilig, `prettier` verlangt das
       bei dieser Länge): `VAComponentsDescription`, `VASizeDescription`,
       `VertexAttributeDataType`, `VertexAttributeDescription`, `VertexAttributeMethods`,
       `VertexAttributeUsageType` — alle aus `./types.js`, alle als `import type`.
     - Direkt darunter, vor `toPascalCase`, den modul-lokalen Typ anlegen. Er wird **nicht**
       exportiert:

       ```ts
       type VADescriptionFields = Partial<VASizeDescription> & Partial<VAComponentsDescription> & VertexAttributeMethods;
       ```

     - Das Feld umtypisieren: `private readonly description: VADescriptionFields;`. Der
       Konstruktorparameter behält `VertexAttributeDescription` — dort trifft der Aufrufer
       auf die Union, und dort soll sie stehen. Die Zuweisung braucht keinen Cast: jede
       Hälfte der Union ist auf den Partial-Schnitt zuweisbar.
     - Die drei `// @ts-ignore`-Zeilen ersatzlos streichen. Die Getter-Rümpfe bleiben Zeichen
       für Zeichen, wie sie sind.
     - Darüber ein kurzer TSDoc am Feld, der sagt, warum es breiter ist als der Parameter:
       eine Beschreibung deklariert entweder `components` oder `size`, die Getter unten
       beantworten beide Formen in einem Ausdruck, und genau das kann die Union nicht
       tragen. Kein Rückblick, kein »früher«.
  3. **`VertexObjectBuffer.ts:82` — die Suppression fällt, der Grund bleibt.** Der
     `@ts-ignore` steht über `typedArray: undefined,` im Objektliteral für `Buffer`. Die
     Zeile ist unter der geltenden Konfiguration fehlerfrei; die Suppression streichen. An
     ihre Stelle kommt ein Kommentar, der das Zweiphasige erklärt: das Array kann erst
     entstehen, wenn jede Attribut-Deklaration ihren Anteil zu `itemSize` beigetragen hat —
     die zweite Schleife unmittelbar darunter (`for (const buffer of this.buffers.values())`)
     füllt es. Ein Satz, Gegenwartsform.
  4. **`TextureAtlas.ts:86` — `return;` wird `return undefined;`**, die Suppression fällt.
     Darüber ein Kommentar: ein Atlas ohne benannte Frames hat keinen Namen zu antworten;
     die Schleife darüber findet nichts, weil `rand(0)` null ist und `#frameNames` leer.
     **Die Signatur bleibt `TextureAtlasFrameName`.** Sie zu verbreitern wäre eine
     Typänderung an einer veröffentlichten Klasse für einen einzelnen Rückgabewert, während
     `randomFrame()` und `randomFrameId()` zwei Methoden darüber dieselbe Lücke ungenannt
     lassen — eine Insel der Ehrlichkeit in einer Klasse, die an fünf Stellen gleich
     unehrlich ist. Der Befund über die ganze Klasse steht in »Offene Befunde«. Der
     Vorgänger, an dem sich das messen ließe, ist `createVO()` aus Paket 1: dort hat der
     Nutzer die Verbreiterung entschieden, für ein Symbol im Zentrum dieses Laufs, und
     `texture/` ist es nicht.
  5. **`OrthographicProjection.ts:28-33` — beide Suppressions fallen, die Verzweigung wird
     ehrlich.** `ProjectionPlane.get()` nimmt laut Signatur (`ProjectionPlane.ts:39`) bereits
     `ProjectionPlane | ProjectionPlaneDescription` entgegen und gibt eine Instanz unverändert
     zurück; die `typeof … === 'string'`-Verzweigung wiederholt also, was die Methode selbst
     tut, und trifft dabei den einzigen Fall nicht, um den es geht — den fehlenden Plane.
     Der Konstruktorrumpf wird zu:

     ```ts
     this.projectionPlane = projectionPlane != null ? ProjectionPlane.get(projectionPlane) : undefined;
     this.viewSpecs = specs;
     ```

     Gleiches Laufzeitverhalten in allen drei Fällen: Instanz durchgereicht (`get()` gibt sie
     identisch zurück), Beschreibung aufgelöst, nichts übergeben bleibt nichts. Kein Default,
     kein `??`, keine Ausnahme — `new OrthographicProjection()` ohne Argumente ist ein
     benutzter Pfad (`OrthographicProjection.spec.ts:10`), und was danach fehlt, fehlt heute
     genauso.
  6. **`ParallaxProjection.ts:30-34` — dieselbe eine Zeile**, wörtlich wie in Schritt 5.
     `this.viewSpecs = specs ?? {}` bleibt unverändert.
  7. **`ParallaxProjection.ts:37` — der `as any` bekommt einen Namen.** Neues Modul
     `packages/twopoint5d/src/stage/asFitIntoRectangleSpecs.ts`, in der Machart von
     `asThreeTypedArray.ts`: ein Export, ein TSDoc, der die Grenze benennt.

     ```ts
     import type {FitIntoRectangleSpecs} from './fitIntoRectangle.js';

     export const asFitIntoRectangleSpecs = (specs: Partial<FitIntoRectangleSpecs>): FitIntoRectangleSpecs =>
       specs as FitIntoRectangleSpecs;
     ```

     Der TSDoc sagt: `FitIntoRectangleSpecs` buchstabiert die vollständigen Formen aus, in
     denen sich ein Fit beschreiben lässt; `viewSpecs` hält bis zur ersten Zuweisung ein
     leeres Objekt, für das die Union kein Mitglied hat. `fitIntoRectangle()` liest seine
     Felder über `in`-Prüfungen (`fitIntoRectangle.ts:184-207`) und lässt das Zielrechteck
     unangetastet, wenn keine Form greift — die leere Lage ist also eine definierte Antwort
     und keine fehlende. Im Aufruf `fitIntoRectangle(new Vector2(width, height),
     asFitIntoRectangleSpecs(this.viewSpecs), this.#viewRect)`; der Import kommt in den Block
     oben, alphabetisch vor `fitIntoRectangle`.
  8. **`sprites/node-utils.ts:45-47` — der `XXX fix me` wird eine Funktion.** Neues Modul
     `packages/twopoint5d/src/sprites/matrixColumn.ts`:

     ```ts
     import type {Node} from 'three/webgpu';

     export const matrixColumn = (matrix: Node<'mat4'>, column: number): Node<'vec4'> =>
       (matrix as unknown as Node<'vec4'>[])[column];
     ```

     TSDoc: ein TSL-Knoten ist ein Proxy, `matrix[1]` löst sich beim Bauen des Graphen auf
     die zweite Spalte auf, und die Komponenten-Accessoren arbeiten auf dem Ergebnis.
     `@types/three@0.183.1` deklariert die Matrix als `Node<'mat4'>`
     (`src/nodes/accessors/ModelNode.d.ts:39`) ohne Index-Signatur, die Spalte hat also
     keinen Typ, durch den sie reisen könnte. Version und Datei gehören in den Block — so
     macht es `asThreeTypedArray.ts` auch.
     In `node-utils.ts` verschwinden die beiden Kommentarzeilen (der auskommentierte
     Ausdruck und das `XXX fix me`) mitsamt der Zeile darunter; an ihre Stelle tritt:

     ```ts
     const cameraUp = vec3(
       matrixColumn(modelViewMatrix, 0).y,
       matrixColumn(modelViewMatrix, 1).y,
       matrixColumn(modelViewMatrix, 2).y,
     );
     ```

     Der Import `import {matrixColumn} from './matrixColumn.js';` kommt als eigener Block
     unter den `import type`-Block aus `three/webgpu`, mit Leerzeile dazwischen.
  9. **Die fünf Suppressions im Spec ersatzlos streichen.**
     `vertex-buffers-geometry-updates.spec.ts` Zeilen 151, 165, 178, 183, 195 — jeweils
     nur die `// @ts-ignore`-Zeile, die `expect(…)`-Zeile darunter bleibt. Die Attribute
     sind an ihren `getAttribute()`-Aufrufen bereits gecastet, `isBufferAttribute` und
     Geschwister stehen also auf dem Typ. Kein Kommentar an ihre Stelle: hier war nie etwas
     zu erklären.
  10. **Kein CHANGELOG-Eintrag.** Die Konvention im Kopf verlangt ihn für Pakete, die
     sichtbares Verhalten ändern. Dieses ändert keines: kein Laufzeitpfad bewegt sich, und
     die erzeugten `.d.ts` der sechs geänderten Module sind identisch mit den
     ausgelieferten (in Zug 0 mit `diff` gegen `dist/lib` geprüft). Ein Eintrag darüber, dass
     Suppressions verschwunden sind, wäre außerdem genau der Rückblick auf den Vorzustand,
     den dieselbe Konvention verbietet. Paket 8 erbt von hier nichts.
- Nicht anfassen:
  - **`strictNullChecks`.** Der Schalter steht in `tsconfig.json:33` auf `false`, und ihn
    umzulegen kostet 458 Fehler in diesem Paket allein. Eigenes Vorhaben, nicht dieses.
  - **`VertexAttributeDescriptor.ts:29`**, der `{@link VADescription#autoTouch}`, der nicht
    auflöst. Steht als kleiner Befund unter Paket 5. Ihn zu reparieren hieße
    `VADescription` importieren, und ein Import, den nur ein TSDoc benutzt, fällt unter
    `noUnusedLocals` — der Build bricht. Stehen lassen.
  - **Die Signaturen von `TextureAtlas`** über Schritt 4 hinaus, und `fitIntoRectangle()`
    selbst. Beide wären der größere, richtigere Umbau und beide liegen außerhalb dessen,
    was TYPE-001 benennt.
- Verify: `pnpm lint && NX_TUI=false pnpm nx run-many -t build --skip-nx-cache && NX_TUI=false pnpm nx run-many -t checkPkgTypes --skip-nx-cache && NX_TUI=false pnpm nx run-many -t test --projects=tag:ci --skip-nx-cache && npx prettier --check packages/twopoint5d/src/vertex-objects/VertexAttributeDescriptor.ts packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts packages/twopoint5d/src/texture/TextureAtlas.ts packages/twopoint5d/src/stage/OrthographicProjection.ts packages/twopoint5d/src/stage/ParallaxProjection.ts packages/twopoint5d/src/stage/asFitIntoRectangleSpecs.ts packages/twopoint5d/src/sprites/node-utils.ts packages/twopoint5d/src/sprites/matrixColumn.ts`
  (die vier Kommandos aus dem Kopf, ohne Nx-Cache; das vierte fährt die Playwright-Suite mit.
  Dazu `prettier --check` auf die acht geänderten und neuen Quelldateien — `pnpm lint` ist
  `eslint .` und sieht Formatierung nicht. Das Spec bleibt draußen: es verletzt die
  Prettier-Konfiguration schon vorher an zwei Stellen, das ist ein eigener Eintrag in
  »Offene Befunde«.)
- Commit: `fix(twopoint5d): replace every ts-ignore with a named cast or an honest type`
- Ergebnis: 1 Runde · TYPE-001 behoben (alle 13 Fundstellen, davon 5 vom Audit ungezählt),
  dazu `sprites/node-utils.ts:47-49` und `ParallaxProjection.ts:37` · Rot-Nachweis war der
  Lint-Lauf mit scharfer `@typescript-eslint/ban-ts-comment`: genau 13 Fehler
  (`OrthographicProjection.ts:29,31`, `ParallaxProjection.ts:31`, `TextureAtlas.ts:86`,
  `VertexAttributeDescriptor.ts:36,41,46`, `VertexObjectBuffer.ts:82`,
  `vertex-buffers-geometry-updates.spec.ts:151,165,178,183,195`) · Review ohne Befund ·
  `grep -rn '@ts-ignore' packages/ apps/` findet keine aktive Suppression mehr · Verify grün
  über alle vier Kommandos plus `prettier --check` auf die acht Quelldateien, ohne Nx-Cache
  (`<arbeitsdir>/paket-6.verify.log`, exit=0)
- Nebenbefunde: → Queue (die 4 aus Zug 0; Zug 1–3 haben keinen weiteren gefunden)
- Folgen: keine
- Schnittstellen: `@typescript-eslint/ban-ts-comment` steht in `eslint.config.mjs:40` auf
  `error` — `@ts-ignore` und `@ts-nocheck` sind ab jetzt Lint-Fehler, der Weg für einen
  wirklich nötigen Fall ist `@ts-expect-error` mit Beschreibung · neu und intern (in keiner
  `public-api.ts`): `stage/asFitIntoRectangleSpecs.ts` und `sprites/matrixColumn.ts`, in der
  Machart von `asThreeTypedArray.ts`

**TYPE-001 · medium · `VertexObjectPool.ts:83`, `VertexAttributeDescriptor.ts:32/37/42`,
`VertexObjectBuffer.ts:82`, `TextureAtlas.ts:86`, `OrthographicProjection.ts:29/31`,
`ParallaxProjection.ts:31`** — Neun @ts-ignore, davon sechs im Performance-Kern

Jede Stelle für sich wäre kein Drama. In Summe sind sie das stille Symptom davon, dass die
VO-Description-Typen über die Zeit erodiert sind — typisches Muster: ein Buffer-Slot wird
über ein Symbol gesetzt, das der Type-Index eigentlich nicht erlaubt. Verstärkt durch
CFG-001: ohne `strictNullChecks` sieht der Compiler ohnehin die Hälfte nicht.

Empfehlung: Pro Stelle ein benannter Cast-Helper statt `@ts-ignore`, etwa `asVoSlot()`. Wenn
die Symbol-basierten Slots häufig Casts brauchen, eine zentrale Type-Augmentation aufsetzen.
Sinnvollerweise gemeinsam mit CFG-001 angehen.

Abweichung von der Empfehlung, begründet in Zug 0: »pro Stelle ein Cast-Helfer« geht an zehn
der dreizehn Stellen vorbei, weil dort gar kein Fehler zu casten ist. Ein Helfer entsteht nur,
wo ein Cast wirklich stehen bleibt (Schritt 7 und 8); die drei echten Typfehler lösen sich
über eine Verbreiterung ohne Cast (Schritt 2), und der Rest wird gestrichen. Die zentrale
Type-Augmentation entfällt aus demselben Grund. CFG-001 bleibt draußen, siehe »Nicht
anfassen«.

### [x] 9. Die Kommentare und Typen, die Paket 6 hinterlassen hat, sagen die Wahrheit

- Findings: keine Audit-ID — drei Folgen aus Paket 6, belegt durch das nachgezogene
  Review über `0ae2932` (siehe »Entscheidungen«)
- Folge von: Paket 6
- Ziel: Wo Paket 6 eine Suppression durch einen Kommentar oder einen Cast ersetzt hat, trägt die Erklärung, was der Code tut, und die Signatur sagt, was zurückkommen kann.
- Bereich: `packages/twopoint5d/src/stage/` (`OrthographicProjection.ts`, `ParallaxProjection.ts`,
  `IProjection.ts`, `asFitIntoRectangleSpecs.ts`), `packages/twopoint5d/src/texture/TextureAtlas.ts`,
  `packages/twopoint5d/CHANGELOG.md`
- Hängt ab von: 6
- Hash: a0bce67
- Modell: mittlere Stufe
- Effort: medium
- Fundstellen:
  - `texture/TextureAtlas.ts:86-87` (Abgleich: vorher `:87`) — der Kommentar begründet den Fall
    mit »`rand(0)` ist null«. `rand` ist `(max) => (Math.random() * max) | 0`, also ist `rand(0)`
    gleich `0` und nicht `null`. Erreichbar ist die Stelle allein deshalb, weil `#frameNames`
    leer ist und der Schleifenrumpf nie läuft: bei `size > 0` liegt `randomIdx` in
    `[0, size-1]`, und die Schleife zählt `idx` genau durch diesen Bereich, trifft also immer.
    Der Kommentar nennt einen Grund, den es nicht gibt.
  - `texture/TextureAtlas.ts:77,88,107-112` — `randomFrameName()` deklariert
    `TextureAtlasFrameName`, kann aber `undefined` liefern; `randomFrameNames(count)` schiebt
    dieses `undefined` dann in sein Ergebnis-Array. Nachgemessen an einem leeren Atlas:
    `randomFrameName()` gibt `undefined`, `randomFrameNames(3)` gibt
    `[undefined, undefined, undefined]`.
  - `stage/OrthographicProjection.ts:14-15,29-30` — `projectionPlane: ProjectionPlane` bekommt
    `undefined`, `viewSpecs: OrthographicProjectionSpecs` ein möglicherweise undefiniertes
    `specs`. Beides kompiliert nur, weil `strictNullChecks` aus ist: die Suppression ist gegen
    ein stilles Typloch getauscht statt entfernt. `ParallaxProjection.ts:33` fängt die zweite
    Hälfte mit `specs ?? {}` ab, diese Klasse nicht — und das ist kein Schönheitsfehler:
    `new OrthographicProjection().updateViewRect(800, 600)` wirft
    `TypeError: Cannot use 'in' operator to search for 'pixelZoom' in undefined`, weil
    `fitIntoRectangle()` seine Felder über `in` liest. Dieselbe Folge in der Schwesterklasse:
    `ParallaxProjection.ts:16`, `projectionPlane` dort mit demselben Typ und demselben
    `undefined` aus demselben Commit.
  - `stage/asFitIntoRectangleSpecs.ts:3-9` (Abgleich: der Block, vorher als `:10` notiert) — der
    Docblock verspricht »a defined answer, not a missing one«. Das gilt für `fitIntoRectangle`,
    nicht für den Aufrufer. Der Helfer nimmt jedes `Partial<FitIntoRectangleSpecs>` an und reicht
    es als vollständige Spec weiter, beruhigt den Compiler also für alle künftigen Aufrufer.

Nicht Teil dieses Pakets: dass eine Projektion ohne Specs eine unbrauchbare Kamera
erzeugt (`fov 0`, `aspect NaN`). Das ist vorbestehend, liegt in `stage/` und damit
außerhalb der Scope-Regel — es steht als neues Finding in »Offene Befunde«.

Warum die Typehrlichkeit hier und nicht in Paket 6: Paket 6 hat entfernt, was den
Compiler stumm schaltete. Dass darunter an drei Stellen eine Aussage steht, die nicht
stimmt, sieht man erst, wenn die Suppression weg ist. Das ist der Normalfall bei dieser
Sorte Arbeit und kein Versäumnis des Pakets.

Abgleich in Zug 0 (2026-09-03), je Fundstelle am Code nachgesehen und gemessen:

- Alle vier Fundstellen stehen unverändert; drei Zeilenangaben sind präzisiert, keine ist
  gewandert. Der Arbeitsbaum steht auf `0ae2932`, es liegt nichts dazwischen.
- **Alle vier sind Symptome einer Ursache.** Prüffrage bestanden: hätte Paket 6 sein eigenes
  Ziel zu Ende gebracht — »wo ein Cast nötig bleibt, trägt er einen Namen, der sagt, warum« —,
  wäre keine der vier entstanden. Es sind nicht vier Fehler, sondern viermal dieselbe halbe
  Bewegung: die Suppression fiel, an ihre Stelle trat eine Aussage, die nicht stimmt. Deshalb
  ein Nachtragspaket und nicht vier.
- **Der Typ-Sachverhalt in `TextureAtlas` ist vorbestehend, der Kommentar darüber nicht.**
  Nachgesehen an `60f7612:…/TextureAtlas.ts:77-88`: dort stand derselbe Rumpf mit `// @ts-ignore`
  und `return;`. Paket 6 hat die Markierung entfernt, nicht die Lüge — und die Markierung ist
  durch den Eintrag zu `TextureAtlas.ts:64,68,73,77` in »Offene Befunde« ersetzt worden, der
  alle fünf Methoden derselben Machart führt und das Urteil `→ Audit` trägt.
- **Deshalb bleiben die `TextureAtlas`-Signaturen unangetastet, und der Kommentar wird richtig.**
  Drei Gründe, alle nachprüfbar: (a) das Urteil `→ Audit` an jenem Eintrag misst ihn an der
  Scope-Regel, und `texture/` liegt außerhalb — diese Linie hat der Nutzer gezogen, und der Lauf
  hält sie an sechs weiteren Stellen ein. (b) Eine von fünf gleich gelagerten Methoden ehrlich
  zu machen, ist genau die »Insel der Ehrlichkeit«, die Paket 6 in Schritt 4 seines Detailplans
  begründet abgelehnt hat; seither hat sich nichts geändert, was diese Begründung schwächer
  machte. (c) `createVO()` trägt hier nicht als Präzedenzfall: das hat der Nutzer ausdrücklich
  entschieden, für ein Symbol im Zentrum des Scopes, und `texture/` ist es nicht.
  Die Hälfte des Ziels, die von Signaturen spricht, landet damit in `stage/` — dort, wo die
  Folge tatsächlich liegt.
- **`OrthographicProjection` wirft, wo die Schwester durchläuft.** Gemessen mit einer Vitest-Probe
  gegen den Stand `0ae2932`: `new OrthographicProjection().updateViewRect(800, 600)` wirft
  `TypeError: Cannot use 'in' operator to search for 'pixelZoom' in undefined`,
  `new ParallaxProjection().updateViewRect(800, 600)` läuft durch und liefert
  `getViewRect() === [0, 0, Infinity, Infinity]`. Damit ist dieses Paket ein Bugfix-Paket: erst
  der rote Test, dann der Fix. Der Absturz selbst ist als Laufzeitverhalten vorbestehend, als
  Befund aber nirgends notiert — die beiden `→ Audit`-Einträge zu den Projektionen beschreiben
  die unbrauchbare Kamera, nicht den `TypeError`; gemessen hat ihn vor diesem Zug 0 niemand.
- **Die Angleichung an die Schwesterklasse ist keine Erfindung.** `ParallaxProjection.ts:15`
  führt `viewSpecs` bereits als `Partial<ParallaxProjectionSpecs>` und `:33` weist `specs ?? {}`
  zu; `OrthographicProjection` bekommt genau diese beiden Zeilen. Beide Klassen stammen aus
  demselben Commit `0ae2932`, in dem die `projectionPlane`-Zeile in beiden identisch gemacht und
  die `viewSpecs`-Zeile divergent gelassen wurde. Das ist die halbe Bewegung, um die es geht.
- **`IProjection` muss mit.** `IProjection.ts:8` deklariert `get projectionPlane(): ProjectionPlane`.
  Bliebe das stehen, während die beiden Klassen `ProjectionPlane | undefined` führen, widersprächen
  sich Klasse und Interface im veröffentlichten `.d.ts`, und ein Consumer unter `strictNullChecks`
  bekäme die Klassen nicht mehr auf das Interface zugewiesen. Das ist kein zusätzlicher Befund,
  sondern was die eigene Änderung umwirft.
- **Der Umbau ist in einer Kopie unter `<arbeitsdir>/p9-probe/` einmal vollständig durchgespielt.**
  `tsc` mit der echten Projektkonfiguration: 0 Fehler vorher, 0 Fehler nachher.
  `vitest --run src/stage src/texture`: 216 Tests in 13 Dateien grün. Die erzeugten `.d.ts`
  unterscheiden sich in genau drei Zeilen — `viewSpecs` und `projectionPlane` in
  `OrthographicProjection.d.ts`, `projectionPlane` in `ParallaxProjection.d.ts`, der Getter in
  `IProjection.d.ts` —, sonst nirgends. `prettier --check` ist auf allen berührten Dateien schon
  jetzt zufrieden. Der Implementierer schreibt seinen Code selbst; die Zahlen stehen hier, damit
  ein Abweichen auffällt.
- Zwei Rückwirkungen geprüft, beide folgenlos: `Canvas2DStage.ts:27`
  (`this.projection.viewSpecs.fit = value`) compiliert unter `Partial<…>` weiter, und
  `Canvas2DStage.ts:90` baut seine Projektion ohnehin mit Plane und Specs. Zu `Canvas2DStage.ts:139`
  siehe »Offene Befunde«.

- Dateien:
  - `packages/twopoint5d/src/stage/OrthographicProjection.ts`
  - `packages/twopoint5d/src/stage/OrthographicProjection.spec.ts`
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts`
  - `packages/twopoint5d/src/stage/IProjection.ts`
  - `packages/twopoint5d/src/stage/asFitIntoRectangleSpecs.ts`
  - `packages/twopoint5d/src/texture/TextureAtlas.ts`
  - `packages/twopoint5d/CHANGELOG.md`
  - **keine `public-api.ts`**: es entsteht kein neues Symbol, nur Typen an vorhandenen.
- Vorgehen:
  1. **Der rote Test zuerst, und der rote Lauf in den Report.** In
     `packages/twopoint5d/src/stage/OrthographicProjection.spec.ts` in den Block
     `describe('construction')`, unmittelbar hinter `it('with plane and specs')`:

     ```ts
     it('starts from an empty spec when built without one', () => {
       const projection = new OrthographicProjection();
       expect(projection.viewSpecs).toEqual({});
       expect(() => projection.updateViewRect(800, 600)).not.toThrow();
     });
     ```

     Dann aus `packages/twopoint5d` heraus
     `npx vitest --run src/stage/OrthographicProjection.spec.ts`. Der Lauf muss rot sein, und zwar
     an der ersten Zusicherung (`viewSpecs` ist `undefined`, nicht `{}`); die zweite wirft
     `TypeError: Cannot use 'in' operator to search for 'pixelZoom' in undefined`. Diese Ausgabe
     ist der Rot-Nachweis dieses Pakets und gehört in den Report.
     Der bestehende `it('without arguments')` zwei Zeilen darüber bleibt unangetastet, auch wenn
     er nur `toBeDefined()` prüft — dazu ein eigener Eintrag in »Offene Befunde«.
  2. **`OrthographicProjection.ts` — drei Zeilen, wörtlich die der Schwesterklasse.**
     - Zeile 14: `viewSpecs: OrthographicProjectionSpecs;` wird
       `viewSpecs: Partial<OrthographicProjectionSpecs>;`
     - Zeile 30: `this.viewSpecs = specs;` wird `this.viewSpecs = specs ?? {};`
     - Zeile 34: `fitIntoRectangle(new Vector2(width, height), this.viewSpecs, this.#viewRect);`
       wird `fitIntoRectangle(new Vector2(width, height), asFitIntoRectangleSpecs(this.viewSpecs), this.#viewRect);`
       Ohne diesen dritten Schritt bricht der Build: `Partial<…>` ist auf `FitIntoRectangleSpecs`
       nicht zuweisbar (gemessen in der Probe: TS2345, `Property 'pixelZoom' is optional … but
       required`). Genau dafür existiert der Helfer, und `ParallaxProjection.ts:37` ruft ihn
       bereits so.
     - Der Import kommt als eigene Zeile in den Block oben, zwischen `./ProjectionPlane.js` und
       `./fitIntoRectangle.js` — dieselbe Stelle wie in `ParallaxProjection.ts:5`:
       `import {asFitIntoRectangleSpecs} from './asFitIntoRectangleSpecs.js';`
     - Zeile 15: `projectionPlane: ProjectionPlane;` wird
       `projectionPlane: ProjectionPlane | undefined;`
     - Der Konstruktorparameter bleibt `specs?: OrthographicProjectionSpecs` — der Aufrufer
       übergibt eine vollständige Spec oder keine, und dort soll die Union stehen.
  3. **`ParallaxProjection.ts` — eine Zeile.** Zeile 16: `projectionPlane: ProjectionPlane;` wird
     `projectionPlane: ProjectionPlane | undefined;`. Sonst nichts an dieser Datei;
     `viewSpecs` und `asFitIntoRectangleSpecs` stehen dort schon richtig.
  4. **`IProjection.ts` — eine Zeile.** Zeile 8: `get projectionPlane(): ProjectionPlane;` wird
     `get projectionPlane(): ProjectionPlane | undefined;`.
  5. **`asFitIntoRectangleSpecs.ts` — der Docblock wird ausgetauscht**, Zeilen 3-9. Der Rumpf
     bleibt Zeichen für Zeichen, wie er ist. Neuer Block, wörtlich:

     ```ts
     /**
      * Every member of the `FitIntoRectangleSpecs` union requires at least one field — `pixelZoom`,
      * `fit`, a `width` or a `height` — so a spec that is empty or only partly filled matches none
      * of them. `fitIntoRectangle()` reads every field it needs through an `in` check or a
      * comparison on `fit` (`fitIntoRectangle.ts:184-225`), so a partial spec is a shape it handles,
      * and this cast widens the parameter to what the function accepts in fact.
      *
      * What it does not say is which rectangle comes back: where no shape matches,
      * `fitIntoRectangle()` hands back the target vector it was given, untouched.
      */
     ```
  6. **`TextureAtlas.ts` — die beiden Kommentarzeilen 86-87 werden ausgetauscht**, `return undefined;`
     bleibt. Neuer Kommentar, wörtlich:

     ```ts
     // reachable only for an atlas without named frames: the loop body never runs,
     // and there is no name to hand back
     ```

     **Die Signaturen dieser Klasse bleiben unverändert** — `randomFrameName()`,
     `randomFrameNames()`, `randomFrameId()`, `randomFrame()` und `randomFrames()` behalten ihre
     Rückgabetypen. Begründung oben im Abgleich.
  7. **`CHANGELOG.md`.** Vorher den Skill `updating-changelog` laden; `Unreleased` ist der einzige
     Abschnitt, der angefasst wird. Drei Einträge, sinngemäß in diesem Wortlaut:
     - unter `### Changed`, ans Ende:
       »`OrthographicProjection#viewSpecs` is typed `Partial<OrthographicProjectionSpecs>`, the
       same type `ParallaxProjection#viewSpecs` carries, and `projectionPlane` on both classes and
       on the `IProjection` interface is typed `ProjectionPlane | undefined`. Both constructor
       arguments are optional, and a projection built without them holds exactly what these types
       name«
     - unter `### Fixed`, ans Ende:
       »fix `OrthographicProjection#updateViewRect()` for a projection built without specs:
       `viewSpecs` holds an empty object from construction on, the shape `ParallaxProjection`
       starts from as well«
     - unter `### Migration Guide`, als neuer `####`-Abschnitt ans Ende:
       Überschrift »Projection fields name the values their constructors write«, darunter ein
       Absatz plus **Before**/**After**-Paar in der Machart der Nachbarabschnitte: ein Consumer
       unter `strictNullChecks`, der `projection.projectionPlane.getPointByDistance(100)` schreibt,
       braucht `?.` oder einen Guard; wer `const s: OrthographicProjectionSpecs = projection.viewSpecs`
       schreibt, braucht `Partial<…>`. Dazu der Satz, dass eine mit Plane und Specs gebaute
       Projektion — der Normalfall — nichts zu ändern hat.
       Der Vorher/Nachher-Kontrast gehört ausschließlich hierher; die Konvention im Kopf nimmt den
       Migrations-Abschnitt ausdrücklich aus.
  8. **Zum Schluss `npx prettier --write` auf die sieben geänderten Dateien**, dann der Verify-Lauf.
- Nicht anfassen:
  - **Die Signaturen von `TextureAtlas`.** Siehe Schritt 6 und den Abgleich. Der Befund über die
    ganze Klasse steht in »Offene Befunde« mit dem Urteil `→ Audit`.
  - **`fitIntoRectangle()` selbst.** Sein Parameter ist zu eng — die Funktion nimmt in Wahrheit
    jedes Partial —, und der Helfer aus Schritt 5 existiert, weil das so ist. Ihn zu weiten hieße,
    den Helfer abzuschaffen; Paket 6 hat das unter »Nicht anfassen« ausdrücklich draußen gelassen,
    und daran ändert dieses Paket nichts.
  - **`strictNullChecks`.** Steht in `tsconfig.json:40` auf `false`; umzulegen kostet 458 Fehler
    allein in diesem Paket. Eigenes Vorhaben.
  - **Die beiden `it('without arguments')`-Tests**, die nur `toBeDefined()` prüfen. Eigener Eintrag
    in »Offene Befunde«, Urteil `→ Audit`.
  - **`Canvas2DStage.ts`.** Compiliert unverändert weiter, in der Probe nachgemessen.
  - **Das Verhalten einer Projektion ohne Plane oder ohne Specs.** Die Kamera, die dabei
    herauskommt, rendert nichts — das ist der `→ Audit`-Eintrag am Ende von »Offene Befunde« und
    bleibt es. Dieses Paket macht die Typen ehrlich, nicht das Verhalten; kein Default, kein
    `??` auf `projectionPlane`, keine Ausnahme im Konstruktor.
- Verify: `pnpm lint && NX_TUI=false pnpm nx run-many -t build --skip-nx-cache && NX_TUI=false pnpm nx run-many -t checkPkgTypes --skip-nx-cache && NX_TUI=false pnpm nx run-many -t test --projects=tag:ci --skip-nx-cache && npx prettier --check packages/twopoint5d/src/stage/OrthographicProjection.ts packages/twopoint5d/src/stage/OrthographicProjection.spec.ts packages/twopoint5d/src/stage/ParallaxProjection.ts packages/twopoint5d/src/stage/IProjection.ts packages/twopoint5d/src/stage/asFitIntoRectangleSpecs.ts packages/twopoint5d/src/texture/TextureAtlas.ts`
  (die vier Kommandos aus dem Kopf, ohne Nx-Cache; das vierte fährt die Playwright-Suite mit.
  Dazu `prettier --check` auf die sechs geänderten Quelldateien — `pnpm lint` ist `eslint .` und
  sieht Formatierung nicht. Alle sechs sind im Ist-Zustand prettier-konform, ein Treffer wäre also
  von diesem Paket verursacht.)
- Commit: `fix(twopoint5d): let a projection without specs survive and declare what its fields hold`
- Ergebnis: 1 Runde · alle vier Fundstellen behoben — der Kommentar in
  `TextureAtlas.ts` nennt jetzt den Grund, den es wirklich gibt, der Docblock von
  `asFitIntoRectangleSpecs.ts` sagt, wofür der Cast steht und wofür nicht, und beide
  Projektionsklassen samt `IProjection` führen die Typen, die ihre Konstruktoren
  tatsächlich schreiben · Regressionstest `starts from an empty spec when built
  without one` (`OrthographicProjection.spec.ts`), vor dem Fix rot gesehen:
  `AssertionError: expected undefined to deeply equal {}` · das Review brachte
  weder einen offenen Punkt noch einen Qualitätsbefund zurück, deshalb keine
  Fehlerkette · Verify grün über alle fünf Kommandos einschließlich der
  Playwright-Browsertests und `prettier --check`, ohne Nx-Cache gefahren
  (`<arbeitsdir>/paket-9.verify.log`, exit=0, 90 Test-Dateien, 1400 Tests)
- Nebenbefunde: → Queue (2 Einträge aus Zug 0, beide → Audit:
  `fitIntoRectangle.ts:183` und `Canvas2DStage.ts:139`). Der Implementierer hat beim
  vollständigen Lesen der sieben Dateien nichts darüber hinaus gefunden.
- Folgen: keine.
- Schnittstellen:
  - `OrthographicProjection#viewSpecs: Partial<OrthographicProjectionSpecs>` — die
    Schwesterklasse trug diesen Typ schon. Der Konstruktorparameter bleibt
    `specs?: OrthographicProjectionSpecs`; ohne Argument steht `{}` im Feld.
  - `projectionPlane: ProjectionPlane | undefined` an beiden Klassen und am Getter
    von `IProjection`. Ein Consumer unter `strictNullChecks` braucht dort ein `?.`
    oder einen Guard.
  - `OrthographicProjection#updateViewRect()` reicht seine Specs über
    `asFitIntoRectangleSpecs()` weiter und wirft nicht mehr, wenn die Projektion
    ohne Specs gebaut wurde. Die Kamera, die dabei herauskommt, rendert weiterhin
    nichts — das ist der `→ Audit`-Eintrag in »Offene Befunde«.
  - `TextureAtlas` unverändert an der Oberfläche: nur zwei Kommentarzeilen.
  - `CHANGELOG.md`: je ein Eintrag unter `Changed` und `Fixed`, dazu der
    Migrations-Abschnitt »Projection fields name the values their constructors
    write«. Paket 8 findet sie dort vor.

### [x] 8. Der `Unreleased`-Abschnitt des CHANGELOG sagt, was der Code tut
- Findings: keine Audit-ID — Folgen aus Paket 7 und Paket 3, beide in einem committeten Paket
  entstanden, dazu die zwei kleinen Befunde, die Paket 7 an derselben Datei offen gelassen hat
- Folge von: Paket 7
- Ziel: Jeder Eintrag unter `Unreleased` beschreibt das geltende Verhalten und beschreibt es richtig; der Vorher/Nachher-Kontrast steht ausschließlich im Migrations-Abschnitt.
- Bereich: `packages/twopoint5d/CHANGELOG.md`
- Hängt ab von: 4, 5, 6, 9 (jedes dieser Pakete trägt noch eigene Einträge unter `Unreleased`
  nach; ein Nachtragspaket davor räumte einen Abschnitt auf, der danach wieder wächst)
- Hash: c117222
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/CHANGELOG.md`
- Bekannte Fundstellen, alle in `packages/twopoint5d/CHANGELOG.md`:
  - `:43` — »losing the bind to their mesh« dreht die Mechanik um: verloren ging die Bindung
    an den Sprite-Pool; an das Mesh war die ungebundene Referenz beim Aufruf gerade
    fälschlich gebunden. Der zweite Halbsatz der Zeile trägt die Wahrheit, der erste
    widerspricht ihr. Aus Paket 3.
  - `:36` — »the geometry leaves the attributes built on them alone instead of raising a
    `TypeError`«: die Wendung erzählt den Vorzustand und verstößt gegen die Konvention im Kopf
    dieses Plans. Der Satz trägt auch ohne sie. Aus Paket 2, in Paket 7 gemeldet.
  - `:38` — »A pool is therefore safe to `resize()` once its last route to the geometry is
    gone« steht unqualifiziert; hängt derselbe Pool zusätzlich an einer zweiten Geometry,
    wirft `resize()` weiter. Der Eintrag unter `Changed` (`:20`) trägt die exakte Regel.
    Aus Paket 7.
  - `:38` gegen `:22` — die Attribut-Hälfte von »Anhängen über einen schon vergebenen Namen«
    steht nur noch als Kette aus zwei Einträgen. Ableitbar, aber an keiner Stelle in einem
    Satz gesagt. Aus Paket 7.
  Zeilennummern sind der Stand von `8e056bf` und wandern mit jedem weiteren Eintrag; Zug 0
  dieses Pakets gleicht sie ab und liest den ganzen `Unreleased`-Abschnitt gegen die
  Konvention im Kopf, statt nur diese vier Stellen anzufassen.
- Ergänzt nach Zug 0 von Paket 4 (2026-09-03): Paket 4 trägt einen Migrations-Abschnitt
  `#### float16 attributes are half floats` nach, und der enthält ein Vorher/Nachher — dort
  gehört es hin, das ist keine Fundstelle für dieses Paket. Die Konvention im Kopf nimmt den
  Migrations-Abschnitt ausdrücklich aus.
- Ergänzt nach Zug 0 von Paket 5 (2026-09-03): Paket 5 trägt zwei Einträge unter `Changed` und
  einen Migrations-Abschnitt zum generischen `attachInstancedPool()` nach. Keine neue Fundstelle;
  die Zeilennummern oben wandern dadurch weiter, was Zug 0 dieses Pakets ohnehin abgleicht.
- Fortgeschrieben nach dem Commit von Paket 5 (2026-09-03): die Einschätzung »keine neue
  Fundstelle« hat nicht gehalten. Der Reviewer hat an den beiden neuen `Changed`-Einträgen
  (`:28,29` im Stand `2ab8fbd`) denselben Verstoß gefunden, um den es diesem Paket geht — sie
  tragen den Vorzustand im Text (»instead of `any`«, »instead of a fixed capacity of `1`«),
  obwohl derselbe Commit zwanzig Zeilen weiter unten einen Migrations-Abschnitt anlegt, wo er
  hingehört. Dazu fehlt der Kapazitätsänderung ein Migrationshinweis: wer bisher einen
  Deskriptor übergeben hat, alloziert jetzt `instancedPool.capacity` Objekte statt einem.
  Beides steht auch unter Paket 5 als kleiner Befund; hier steht es, weil dieses Paket die
  Datei anfasst und der Befund sonst zweimal gefunden werden müsste.

- Fortgeschrieben nach Zug 0 von Paket 6 (2026-09-03): Paket 6 trägt **keinen** Eintrag unter
  `Unreleased` nach und keine neue Fundstelle. Es ändert kein Laufzeitverhalten, und die
  erzeugten `.d.ts` seiner sechs geänderten Module sind identisch mit den ausgelieferten —
  mit `diff` gegen `dist/lib` geprüft. Die Zeilennummern oben wandern durch dieses Paket also
  nicht mehr; maßgeblich bleibt der Stand nach Paket 5. Die Abhängigkeit `Hängt ab von: 4, 5,
  6` bleibt bestehen, ist für 6 aber trivial erfüllt.

- Ergänzt nach Zug 0 von Paket 9 (2026-09-03): Paket 9 trägt einen Eintrag unter `Changed`, einen
  unter `Fixed` und einen `####`-Abschnitt im Migrations-Teil nach — die Zeilennummern oben wandern
  dadurch ein weiteres Mal, maßgeblich wird der Stand nach dem Commit von Paket 9. Der Wortlaut der
  drei Einträge steht in dessen Detailplan und ist gegen die Konvention im Kopf geschrieben
  (Gegenwartsform, kein Vorher/Nachher außerhalb des Migrations-Abschnitts). Das ist eine Erwartung,
  keine Zusicherung: bei Paket 5 hat dieselbe Einschätzung nicht gehalten, und Zug 0 dieses Pakets
  liest den ganzen `Unreleased`-Abschnitt ohnehin Zeile für Zeile.

**Abgleich in Zug 0 (2026-09-03).** Alle vier bekannten Fundstellen stehen noch, an neuen
Zeilennummern: `:43` → `:48`, `:36` → `:43`, `:38` → `:45`, `:22` → `:23`. Die beiden
Paket-5-Einträge stehen unverändert auf `:28` und `:29`, der fehlende Migrationshinweis zur
Kapazität fehlt weiterhin. Nachgesehen wurde außerdem, was dieser Lauf am `Unreleased`-Abschnitt
überhaupt geschrieben hat: `git diff --stat 60f7612 HEAD -- packages/twopoint5d/CHANGELOG.md`
meldet 276 Einfügungen und keine einzige Löschung, die hinzugekommenen Zeilen liegen bei
`10-14`, `20-52` und `89-326`. Das ist zugleich die Grenze dieses Pakets, und sie ist scharf:

- **Anzufassen sind nur diese Zeilen.** Der Lauf hat sie geschrieben, dieses Paket korrigiert
  seine eigene Arbeit.
- **Nicht anzufassen sind `:15-19` und `:53-88`** — die Überschrift `### Changed`, die drei
  Einträge darunter (eventize/signalize-Bump, TSL-Node-Typ, `SignalGroup.delete()`) und der
  Migrations-Abschnitt zu den Peer-Dependencies. Sie standen wörtlich schon in `60f7612`.
  Zwei Gründe, und beide tragen für sich: die Konvention im Kopf dieses Plans gilt »für jede
  Zeile, die in diesem Lauf entsteht«, diese drei sind vorher entstanden; und der Skill
  `updating-changelog` verlangt ausdrücklich, einen fremden `[Unreleased]`-Eintrag nicht
  stillschweigend umzuschreiben, sondern die Umschreibung vorzuschlagen. Sie sind auch nicht
  falsch — sie beschreiben geltendes Verhalten korrekt und tragen ihren Vorher/Nachher-Kontrast
  in einer Machart, die dieser Lauf erst später für sich selbst gewählt hat. Kein Befund, keine
  Queue-Zeile.

Zwei Dinge sind in diesem Abgleich neu dazugekommen, beide aus diesem Lauf und beide echte
Folgen — sie stehen als Schritt 10 und 11 im Vorgehen:

- **Der Block zum Teilen eines Pools steht unter der falschen Überschrift.** `70309b2` hat den
  Abschnitt `#### A geometry releases only the pools it built itself` samt seiner Schlussprosa
  »Sharing a pool between geometries is the caller's job for the same reason…« geschrieben;
  `be3213b` hat den float16-Migrationsabschnitt genau dazwischen eingesetzt. Seither steht die
  Schlussprosa mitsamt ihren **Don't**/**Do**-Beispielen unter der Überschrift »`float16` attributes are
  half floats«, wo »for the same reason« auf die Rundung von Halbfloats zeigt statt auf die
  Besitzregel. Nachgesehen an den beiden Commits.
- **»the old `clear()`«** benennt eine lebende Methode als alt: `VOBufferPool#clear()` existiert
  unverändert (`VOBufferPool.ts:65`). Aus `70309b2`.

Sonst nichts. Der `Unreleased`-Abschnitt wurde Eintrag für Eintrag gelesen; die übrigen Einträge
dieses Laufs beschreiben geltendes Verhalten in der Gegenwartsform. Zwei Stellen wurden geprüft
und bewusst stehen gelassen: »The `TypedArray` union lists `Float16Array` and every other type
exactly once« (`:26`) besteht die Probe der Konvention — der Satz nennt eine Eigenschaft der
heutigen Union und braucht den Vorzustand nicht —, und der Engine-Floor, der in diesem Lauf von
`>=22.13` auf `>=24` gestiegen ist, gehört nicht in diesen CHANGELOG: `engines` steht allein in
der Wurzel-`package.json`, `packages/twopoint5d/package.json` und `package.override.json` führen
das Feld nicht, und `scripts/makePackageJson.mjs` baut das veröffentlichte `package.json` aus
genau diesen beiden. Die Consumer-Hälfte — »the runtime needs `Float16Array`« — steht bereits
unter `Changed` und im Migrations-Abschnitt.

- Vorgehen: Zwölf Schritte in `packages/twopoint5d/CHANGELOG.md`, sonst nichts — elf Ersetzungen
  und ein neuer Migrations-Abschnitt. Jede Ersetzung ist unten
  wörtlich ausgeschrieben, alt und neu. Die Ausgangstexte kommen genau einmal in der Datei vor
  (mit `grep -F` je Zeile nachgemessen) — such nach dem Text, nicht nach der Zeilennummer, und
  ersetze nichts, was hier nicht steht. Zeilenumbrüche: die Aufzählungspunkte unter `Added`,
  `Changed`, `Removed` und `Fixed` sind je eine einzige lange Zeile ohne Umbruch, die Prosa im
  Migrations-Abschnitt bricht bei rund 100 Zeichen um. Halte dich je Stelle an die Umgebung.
  `.prettierignore` schließt `*.md` aus, es gibt also keine Formatierungsprüfung, die dir das
  abnimmt oder dir hineinredet.

  1. Unter `Changed`, Eintrag zu `detachInstancedPool()` — die Attribut-Hälfte des Anhängens
     über einen vergebenen Namen steht bisher nur als Kette aus zwei Einträgen da.
     Ersetze
````markdown
- `InstancedVOBufferGeometry#detachInstancedPool()` disposes a pool that belongs to the geometry as its last route from that geometry goes away. The pool is still returned, and one that a second route of the same geometry still reads stays alive. Attaching over a name that is already taken runs the same path, while a pool that takes its own name over again keeps everything it has
````
     durch
````markdown
- `InstancedVOBufferGeometry#detachInstancedPool()` takes the attributes that route built off the geometry, and disposes a pool that belongs to the geometry as its last route from that geometry goes away. The pool is still returned, and one that a second route of the same geometry still reads stays alive. Attaching over a name that is already taken runs the same path — the attributes of the route it replaces come off with it — while a pool that takes its own name over again keeps everything it has
````

  2. Unter `Changed`, Eintrag zu den Allokationen. Ersetze
     `copy element by element and no longer allocate an array per vertex`
     durch
     `copy element by element and allocate nothing per vertex`

  3. Unter `Changed`, Eintrag zum generischen `attachInstancedPool()`. Ersetze
````markdown
without a type argument the returned pool is typed `unknown` instead of `any`
````
     durch
````markdown
without a type argument the returned pool is typed `VertexObjectPool<unknown>`
````
     (der Migrations-Abschnitt sagt es an seinem Ende in genau diesen Worten)

  4. Unter `Changed`, Eintrag zur eingepackten Kapazität. Ersetze
     ``is wrapped in a pool with the capacity of the `.instancedPool`, instead of a fixed capacity of `1` ``
     durch
     ``is wrapped in a pool that has the capacity of the geometry's `instancedPool` ``

  5. Unter `Fixed`, Eintrag zur Upload-Range. Ersetze
     `uploads every vertex of every object it has in use, not just the first one`
     durch
     `uploads every vertex of every object it has in use`

  6. Unter `Fixed`, Eintrag zu `update()` auf einem entsorgten Pool. Ersetze
     `` the geometry leaves the attributes built on them alone instead of raising a `TypeError` ``
     durch
     `the geometry leaves the attributes built on them alone`

  7. Unter `Fixed`, Eintrag zu `detachInstancedPool()` und beiden `dispose()`. Ein Wort, und es
     ist das entscheidende: die Zusicherung gilt über alle Geometrien, nicht über eine. Ersetze
     `` A pool is therefore safe to `resize()` once its last route to the geometry is gone ``
     durch
     `` A pool is therefore safe to `resize()` once its last route to any geometry is gone ``
     Grund: `VOBufferPool#isAttachedToGeometry` liest einen Zähler über alle Anbindungen
     (`VOBufferPool.ts:50`, `#geometryAttachments > 0`). Hängt derselbe Pool noch an einer
     zweiten Geometry, wirft `resize()` weiter. Die exakte Regel steht im Eintrag unter
     `Changed` zu `VertexObjectPool#resize()`; dieser Satz zeigt jetzt darauf, statt ihr zu
     widersprechen.

  8. Unter `Fixed`, Eintrag zu den Sprite-Methoden — die Mechanik steht verdreht in der Datei.
     Verloren ging die Bindung an den **Sprite-Pool**: der Getter reichte `pool.createVO` und
     `pool.freeVO` ungebunden heraus, und der Aufruf `sprites.createSprite()` lief damit mit dem
     Mesh als `this` statt mit dem Pool (nachgesehen an `60f7612:…/TexturedSprites.ts:21-27`
     gegen den heutigen Stand). An das Mesh war die Referenz beim Aufruf also gerade
     fälschlich gebunden. Ersetze
     `` losing the bind to their mesh when called as `sprites.createSprite()` and `sprites.freeSprite(sprite)`; both reach the sprite pool of the mesh they are called on ``
     durch
     `` losing their bind to the sprite pool when called as `sprites.createSprite()` and `sprites.freeSprite(sprite)`; both run on the sprite pool of the mesh they are called on ``

  9. Unter `Fixed`, Eintrag zur `animsMap`. Ersetze
     `it now falls back to the neutral texture coordinates`
     durch
     `it falls back to the neutral texture coordinates`

  10. Im Migrations-Abschnitt, letzter Absatz von `#### A geometry releases only the pools it
      built itself`. Ersetze
      `` Note that `dispose()` is more than the old `clear()`: it drops the typed arrays of the pool, and any ``
      durch
      `` Note that `dispose()` is more than `clear()`: it drops the typed arrays of the pool, and any ``
      Der Rest der Zeile und die beiden Folgezeilen bleiben, wie sie sind.

  11. Im Migrations-Abschnitt: den Block zum Teilen eines Pools unter seine eigene Überschrift
      zurückholen. Schneide den zusammenhängenden Block aus, der mit der Zeile
      `Sharing a pool between geometries is the caller's job for the same reason: the geometry that built a`
      beginnt und mit dem schließenden ` ``` ` der **Do**-Beispielbox endet — der Zeile
      `shared.dispose(); // when both geometries are gone` folgt die schließende Zeile, und dort
      ist Schluss. Setze ihn unmittelbar hinter die Zeile
      `of a geometry's constructor, or hand them in as pools rather than as descriptors.`
      wieder ein, mit einer Leerzeile davor und einer danach. Danach steht die Reihenfolge so:
      Besitzregel-Abschnitt → »Note that dispose() is more than clear(): …« → Sharing-Block mit
      **Don't**/**Do** → die Überschrift »`float16` attributes are half floats« → die Überschrift
      »`InstancedVOBufferGeometry#attachInstancedPool()` returns a typed pool«.
      Es wird nichts umformuliert, nur verschoben; an der Stelle, an der der Block heute steht,
      bleibt keine Leerzeile zu viel und keine zu wenig zurück.

  12. Im Migrations-Abschnitt einen neuen `####`-Block anlegen, unmittelbar **nach** dem
      Abschnitt »`InstancedVOBufferGeometry#attachInstancedPool()` returns a typed pool«
      (also nach dessen Schlusszeile, die mit »Without a type argument« beginnt)
      und **vor** `#### Projection fields name the values their constructors write`. Der
      Skill `updating-changelog` verlangt eine eigene `####`-Überschrift je eigenständiger
      Migration, und die Kapazität ist eine andere Migration als das Typargument: die eine
      ändert die Laufzeit, die andere die Übersetzung. Wörtlich einzusetzen:

````markdown
#### A descriptor handed to `attachInstancedPool()` gets the instanced pool's capacity

`attachInstancedPool()` wraps a descriptor or description in a pool sized like the geometry's
`instancedPool`, so the extra pool holds one vertex object per instance.

**Before**

```ts
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const extra = geometry.attachInstancedPool('extra', descriptor);
extra.capacity; // 1
```

**After**

```ts
const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1000, baseDescriptor, 1);
const extra = geometry.attachInstancedPool('extra', descriptor);
extra.capacity; // 1000
```

Hand in a pool rather than a descriptor to pick the capacity yourself:

```ts
geometry.attachInstancedPool('extra', new VertexObjectPool(descriptor, 100));
```

A pool handed in that way belongs to the caller, and the geometry leaves it alone on `dispose()`.
````

  Zum Schluss den ganzen `Unreleased`-Abschnitt einmal von oben nach unten lesen und prüfen,
  dass die Reihenfolge der Unterabschnitte steht (Added → Changed → Removed → Fixed →
  Migration Guide) und kein Absatz durch Schritt 11 seine Anbindung verloren hat. Kein Eintrag
  wird hinzugefügt, keiner entfernt, keine veröffentlichte Version angefasst.
- Verify: `pnpm lint && NX_TUI=false pnpm nx run-many -t build --skip-nx-cache && NX_TUI=false pnpm nx run-many -t checkPkgTypes --skip-nx-cache && NX_TUI=false pnpm nx run-many -t test --projects=tag:ci --skip-nx-cache`
  (die vier Kommandos aus dem Kopf des Plans, vollständig — an einer reinen Markdown-Änderung
  können sie nicht scheitern, und genau das ist die Aussage, die der Lauf am Ende braucht.
  Kein `prettier --check`: `.prettierignore` nimmt `*.md` aus, die Prüfung fände nichts)
- Commit: `docs(twopoint5d): describe current behaviour in the unreleased changelog`
- Ergebnis: 1 Runde · alle zwölf Schritte des Detailplans wortgleich umgesetzt, vom Reviewer
  Schritt für Schritt mit Fundstelle bestätigt · null Befunde, keine Fehlerkette · kein
  Regressionstest, weil das Paket keinen Korrektheitsfehler im Code behebt, sondern
  Dokumentationsaussagen berichtigt · Verify über alle vier Kommandos ohne Nx-Cache grün
- Nebenbefunde: keine
- Folgen: keine

Restplan geprüft in Zug 0 von Paket 6 (2026-09-03): Schnitt und Reihenfolge bleiben. Nach
Paket 6 ist Paket 8 das letzte offene, seine Abhängigkeiten sind dann alle erfüllt, und die
Drain-Runde des Abschlusses erbt die Einträge aus »Offene Befunde«, die kein Paket aufnimmt.

Restplan geprüft in Zug 0 von Paket 9 (2026-09-03): Schnitt und Reihenfolge bleiben, und der
Satz darüber ist damit überholt — zwischen Paket 6 und Paket 8 liegt jetzt Paket 9, geschnitten
aus den Folgen des nachgezogenen Reviews. Paket 8 bleibt das letzte offene; seine Abhängigkeit
`4, 5, 6, 9` ist nach dem Commit von Paket 9 vollständig erfüllt, und es muss hinter 9 stehen
bleiben, weil 9 als letztes Paket noch am `Unreleased`-Abschnitt schreibt. Kein Paket wurde
geteilt, zusammengelegt oder umsortiert. Zwei Nebenbefunde sind neu in »Offene Befunde«, beide
`→ Audit`; die Drain-Runde des Abschlusses erbt sie zusammen mit den übrigen offenen Einträgen.

Restplan geprüft in Zug 0 von Paket 8 (2026-09-03): nichts mehr zu prüfen und nichts zu ändern —
Paket 8 ist das letzte offene, hinter ihm steht kein Paket, das eine Umsortierung aufnehmen
könnte. Seine Abhängigkeit `4, 5, 6, 9` ist mit `a0bce67` vollständig erfüllt; kein Paket wurde
geteilt, zusammengelegt oder umsortiert. Zwei Folgen dieses Laufs sind neu dazugekommen und
gehen nicht in ein eigenes Paket, sondern in dieses: sie haben dieselbe Ursache wie die vier
bekannten Fundstellen — ein `Unreleased`-Abschnitt, der nicht sagt, was der Code tut — und
liegen in derselben Datei, die dieses Paket ohnehin anfasst. »Offene Befunde« bleibt unverändert;
die Drain-Runde des Abschlusses erbt die Liste, wie sie steht.

Geschnitten am 2026-09-03 aus zwei Folgen mit derselben Ursache: Einträge unter `Unreleased`,
die den Vorzustand erzählen oder die Mechanik verdrehen. Beide liegen in committeten Paketen,
und `Unreleased` ist bis zum Release änderbar — deshalb ein Nachtragspaket und keine Rückgabe
ins Audit. Kein Code, keine Tests: die Verify-Kommandos laufen trotzdem vollständig, weil
`checkPkgTypes` und `build` das Paket bauen, das die Datei ausliefert.

### [x] 10. Was der Code behauptet, stimmt auch

- Nebenbefund: 13 Einträge aus »Offene Befunde«, alle `low`, alle aus der Drain-Runde
  (2026-09-03 vorgelegt und bestätigt)
- Ziel: Kein Guard, keine Assertion, kein Testname und keine Signatur in `vertex-objects/` und `sprites/` behauptet noch etwas, das der Code daneben nicht einlöst.
- Bereich: `packages/twopoint5d/src/vertex-objects/`, `packages/twopoint5d/src/sprites/`
- Hängt ab von: —
- Hash: 6397adb
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`,
  `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`,
  `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.ts`,
  `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts`,
  `packages/twopoint5d/src/vertex-objects/initializeInstancedAttributes.ts`,
  `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`,
  `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`,
  `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`,
  `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts`,
  `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`,
  `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`,
  `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts`,
  `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`,
  `packages/twopoint5d/CHANGELOG.md`

**Zwei Dinge vorweg, sie gelten für jeden Schritt unten.**

*Der Compiler prüft hier nichts davon nach.* `tsconfig.json:40` setzt `strictNullChecks: false`
bei `strict: true`. Deshalb liefert `Map.get()` kein `| undefined`, ein `| undefined` an einem
Feldtyp verschwindet beim Prüfen, und ein `!` ist wirkungslos. Kein einziger Schritt unten wird
von `build` oder `checkPkgTypes` erzwungen — ein grüner Verify sagt hier »nichts kaputtgemacht«,
nicht »Schritt umgesetzt«. Der Zustand selbst ist im Audit als eigenes, offenes Finding erfasst
und ausdrücklich nicht Teil dieses Laufs — Paket 6 hat den Zusammenhang gemessen und unter seinem
Vorgehen festgehalten: mit `strictNullChecks: true` meldet allein dieses Paket 458 Fehler. Ändere
nichts an dieser Konfiguration und baue auch nicht dagegen vor; du baust gegen die Konfiguration,
die gilt.

*Formatierung.* `initializeAttributes.ts`, `initializeInstancedAttributes.ts`,
`vertex-buffers-geometry-updates.spec.ts`, `TexturedSpritesGeometry.ts`,
`AnimatedSpritesGeometry.ts` und `AnimatedSpritesMaterial.ts` verletzen heute die
Prettier-Konfiguration des Repos. Das ist bekannt und gehört Paket 11. In diesen sechs Dateien
schreibst du im Stil der umgebenden Zeilen und formatierst nichts um — sonst wird dein eigener
Diff unlesbar und der von Paket 11 ebenso. Die sieben übrigen Dateien sind prettier-sauber und
stehen im Verify-Gate.

- Fundstellen (Zeilennummern gegen `c117222` nachgesehen und, wo nötig, berichtigt):
  - `vertex-objects/VOBufferPool.ts:129` — `const buffer = …get(bufferName)!;` unmittelbar
    gefolgt von `if (buffer)`. Die Assertion behauptet, was die Folgezeile bezweifelt.
  - `vertex-objects/VOBufferPool.ts:87,99,124` — drei Schreibzugriffe gehen am `usedCount`-Setter
    vorbei: `dispose()` (87), `createFromAttributes()` (99), `fromBuffersData()` (124). Die Klemme
    auf `[0, capacity]` ist damit eine Eigenschaft des Setters und keine Invariante der Klasse.
    Berichtigt: `clear()` (67) geht bereits durch den Setter, `createFromAttributes()` stand nicht
    im Eintrag.
  - `vertex-objects/InstancedVOBufferGeometry.ts:457` — `if (this.instancedPool)` ist immer wahr:
    `readonly` (32), im Konstruktor bedingungslos gesetzt (60-61). Der `if (this.basePool)`
    daneben (454) ist echt, weil `basePool` optional deklariert ist (26).
  - `vertex-objects/InstancedVOBufferGeometry.ts:165-166` — `this.#autoTouchBuffers = undefined`
    samt Kommentar `// reset auto-touch` ist wirkungslos: `#detachRoute()` setzt dasselbe Feld
    bedingungslos zurück (218) und wird von `attachInstancedPool()` vorher aufgerufen (146).
  - `vertex-objects/InstancedVOBufferGeometry.ts:374` — `let buffers: …;` ohne Initialisierung,
    danach über `{...buffers, ...arg}` gelesen; läuft nur durch, weil `{...undefined}` legal ist.
    Das Gegenstück in `VOBufferGeometry.ts:108` setzt explizit `= undefined`.
  - `vertex-objects/initializeAttributes.ts:23`, `initializeInstancedAttributes.ts:18` — das
    Ergebnis von `bufferNameAttributes.get(...)` wird ungeprüft mit `.length` verwendet
    (vorher `:21` und `:16`).
  - `vertex-objects/InstancedVertexObjectGeometry.ts:29` — `args[3] || 1` macht aus einer
    ausdrücklich übergebenen Base-Kapazität `0` eine `1`; die Basisklasse benutzt an derselben
    Stelle `args[3] ?? 1` (`InstancedVOBufferGeometry.ts:73`). Die beiden Konstruktoren sind sich
    uneins (vorher `:42`).
  - `sprites/TexturedSprites/TexturedSprites.ts:18,22,26,49,56` — `spritePool`, die beiden
    `texture`-Accessoren, `createSprite()` und `freeSprite()` dereferenzieren `this.geometry` bzw.
    `this.material` ungeprüft, obwohl beide als `| undefined` deklariert sind (14-15) und
    `dispose()` sie genau darauf setzt (59-64).
  - `sprites/TexturedSprites/TexturedSpritesGeometry.ts:53`,
    `sprites/AnimatedSprites/AnimatedSpritesGeometry.ts:18` — `this.basePool.createVO().make(…)`
    ignoriert zwei Zusicherungen auf einer Zeile: `basePool` ist optional deklariert, und
    `createVO()` liefert `| undefined`. Derzeit unerreichbar, aber es sind die einzigen Stellen
    des Bereichs, die den ehrlichen Rückgabetyp ignorieren.
  - `sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:7` — das Interface
    `AnimatedSpritesMaterialParameters` ist nicht exportiert, steht aber im Konstruktor der
    exportierten Klasse (40); im veröffentlichten `.d.ts` kann ein Consumer den Optionstyp nicht
    benennen. Jedes Geschwister-Material exportiert seinen Parametertyp.
  - `vertex-objects/VertexObjectPool.spec.ts:782-798` — der Test
    `getVO() / createVO() are no-ops after dispose()` verspricht im Namen eine Zusicherung, die
    sein eigener Kommentar (792-796) einräumt nicht zu prüfen; assertiert werden `getVO()` und
    `isDisposed` (vorher `:761`).
  - `vertex-objects/VertexObjectPool.spec.ts:620` und
    `vertex-buffers-geometry-updates.spec.ts:754` — zwei fast gleichlautende Testnamen
    (»releases the pool it replaces« / »…it displaces«) für zwei verschiedene Dinge: der erste
    prüft `isAttachedToGeometry` und welche Attribute noch auf der Geometry stehen, der zweite
    `isDisposed` (vorher `:603` und `:750`).
  - `vertex-objects/VertexObjectPool.spec.ts:531` — `typedArrays.has(bufAttr.array as any)` im
    Testhelfer `attributesBackedBy()`.

- Vorgehen:

  1. **`vertex-objects/VOBufferPool.ts:129`** — das `!` ersatzlos streichen:
     `const buffer = this.buffer.buffers.get(bufferName);`. Das `if (buffer)` in der Folgezeile
     bleibt und ist die richtige Prüfung: `buffersData.buffers` kommt vom Aufrufer und kann einen
     Namen tragen, den der Deskriptor nicht kennt.

  2. **`vertex-objects/VOBufferPool.ts:87,99,124`** — alle drei Schreibzugriffe durch den Setter
     führen, damit die Klemme eine Invariante der Klasse wird:
     - `87` (in `dispose()`): `this.usedCount = 0;`
     - `99` (in `createFromAttributes()`): `this.usedCount += objectCount;`
     - `124` (in `fromBuffersData()`): `this.usedCount = buffersData.usedCount;`

     Die Lesezugriffe (`97`, `106`) bleiben, wie sie sind. `capacity` ist `readonly` und steht im
     Konstruktor vor dem Aufruf von `fromBuffersData()`, der Setter hat seine Grenze dort also.
     Verhalten: `87` und `99` ändern nichts — `dispose()` schreibt `0`, und `copyAttributes()`
     klemmt sich in `VertexObjectBuffer.ts:164` selbst auf die Kapazität. Nur `124` ändert
     etwas: ein `buffersData.usedCount` außerhalb `[0, capacity]` wird geklemmt statt übernommen.
     Das ist der Regressionstest in Schritt 3. Kein `throw` an dieser Stelle — der Setter ist die
     öffentliche Zusicherung des Feldes, und der zweite Ausgang für kaputte Daten steht zwei
     Zeilen darüber schon (`Invalid buffersData capacity`).

  3. **Regressionstest zu Schritt 2**, in `vertex-objects/VertexObjectPool.spec.ts`, in den
     bestehenden Block `describe('usedCount', …)` (506-515), hinter den vorhandenen Test.
     Vor dem Fix rot (`usedCount` steht auf `99`, `availableCount` auf `-95`):

     ```ts
     test('fromBuffersData() writes through the clamp', () => {
       const pool = new VOBufferPool(descriptor, 4);
       const buffersData = pool.toBuffersData();

       pool.fromBuffersData({...buffersData, usedCount: 99});

       expect(pool.usedCount).toBe(4);
       expect(pool.availableCount).toBe(0);
     });
     ```

     `VOBufferPool` ist in der Datei bereits importiert (Zeile 4), `descriptor` kommt aus dem
     `beforeEach` des äußeren `describe` (72-100).

  4. **`vertex-objects/InstancedVOBufferGeometry.ts:457`** — den Guard auflösen: `if
     (this.instancedPool) {` und die zugehörige schließende Klammer entfernen, der Aufruf von
     `checkBufferSerials(this.instancedPool, this.instancedBuffers, this.instancedBufferSerials)`
     bleibt auf einer Einrückungsebene weniger stehen. Der `if (this.basePool)` darüber bleibt
     unangetastet.

  5. **`vertex-objects/InstancedVOBufferGeometry.ts:165-166`** — die beiden Zeilen (Kommentar
     `// reset auto-touch` und `this.#autoTouchBuffers = undefined;`) entfernen.
     `this.#firstAutoTouch = true;` bleibt: das Feld setzt sonst niemand zurück. An seine Stelle
     kommt ein Kommentar, der sagt, warum hier nur noch die Hälfte steht, etwa:

     ```ts
     // the buffer selection is already gone with the detach above; what is still owed is the
     // first auto-touch, which uploads every attribute of the new route once
     ```

  6. **`vertex-objects/InstancedVOBufferGeometry.ts:374`** — auf die Form der Schwesterklasse
     bringen: `let buffers: TouchBuffersType | TouchInstancedBuffersType | undefined = undefined;`

  7. **`vertex-objects/initializeAttributes.ts:23` und `initializeInstancedAttributes.ts:18`** —
     **kein Guard.** Die Invariante gilt durch Konstruktion, und ein `if (attributes == null)`
     wäre Code, den kein Test je erreicht. `VertexObjectBuffer` füllt `buffers` und
     `bufferAttributes` in derselben Schleife über `attributeNames` (`VertexObjectBuffer.ts:68-91`)
     und leitet `bufferNameAttributes` daraus ab (`:100-109`); jeder Buffername, der einen Buffer
     hat, hat damit auch seine Attribute, und jeder Attributname seinen Deskriptor-Eintrag.
     Schreib die Invariante über die Zeile, in beiden Dateien, sinngemäß:

     ```ts
     // both maps are filled from the same list of attribute names in VertexObjectBuffer, so a
     // buffer name that has a buffer has its attributes, and an attribute name has its descriptor
     ```

     Damit deckt der Kommentar auch das `descriptor.attributes.get(...)` zwei Zeilen weiter unten
     ab, das aus derselben Quelle stammt. Beide Dateien sind Prettier-Verletzer — nur die eine
     Kommentarzeile einfügen, sonst nichts anfassen.

  8. **`vertex-objects/InstancedVertexObjectGeometry.ts:29`** — `args[3] || 1` durch
     `args[3] ?? 1` ersetzen, wortgleich zur Basisklasse (`InstancedVOBufferGeometry.ts:73`). Eine
     ausdrücklich übergebene Base-Kapazität `0` erreicht damit den Pool.

  9. **Regressionstest zu Schritt 8**, in `vertex-objects/InstancedVertexObjectGeometry.spec.ts`,
     im äußeren `describe` hinter den vorhandenen Konstruktor-Tests. Vor dem Fix rot (`capacity`
     steht auf `1`):

     ```ts
     test('an explicit base capacity of 0 reaches the base pool', () => {
       const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 0);

       expect(geometry.basePool.capacity).toBe(0);
     });
     ```

     `instancedDescriptor` und `baseDescriptor` stehen im äußeren `describe` (8-38). Kein `!` vor
     `.capacity` — die Datei greift an anderer Stelle genauso zu (67), und ein `!` wäre genau die
     Behauptung, die dieses Paket abräumt.

  10. **`sprites/TexturedSprites/TexturedSprites.ts:17-56`** — die fünf Zugriffe auf die
      Deklaration bringen, die zwei Zeilen darüber steht. Danach:

      ```ts
      /** The sprite pool of the geometry this mesh was built with — `undefined` once disposed. */
      get spritePool(): TexturedSpritePool | undefined {
        return this.geometry?.instancedPool;
      }

      get texture(): Texture | undefined {
        return this.material?.colorMap;
      }

      set texture(texture: Texture | undefined) {
        if (this.material != null) {
          this.material.colorMap = texture;
        }
      }
      ```

      und in den beiden Methoden `this.geometry?.instancedPool.createVO()` beziehungsweise
      `this.geometry?.instancedPool.freeVO(sprite)`. Die Rückgabetypen von `createSprite()` und
      `freeSprite()` bleiben, wie sie sind. Ergänze die vorhandenen TSDoc-Blöcke der beiden
      Methoden um je einen Halbsatz, der den zweiten Ausgang nennt: `createSprite()` antwortet
      `undefined`, sobald der Pool voll ist **oder** die Sprites disposed sind, `freeSprite()` tut
      dann nichts.

  11. **Regressionstest zu Schritt 10**, in `sprites/TexturedSprites/TexturedSprites.spec.ts`, ans
      Ende des `describe`-Blocks. Vor dem Fix rot (`sprites.spritePool` wirft
      `TypeError: Cannot read properties of undefined`):

      ```ts
      test('the convenience API answers nothing once the sprites are disposed', () => {
        const sprites = new TexturedSprites(4);
        const sprite = sprites.createSprite()!;

        sprites.dispose();

        expect(sprites.spritePool).toBeUndefined();
        expect(sprites.texture).toBeUndefined();
        expect(sprites.createSprite()).toBeUndefined();
        expect(() => sprites.freeSprite(sprite)).not.toThrow();
        expect(() => {
          sprites.texture = undefined;
        }).not.toThrow();
      });
      ```

  12. **`sprites/TexturedSprites/TexturedSpritesGeometry.ts:53` und
      `sprites/AnimatedSprites/AnimatedSpritesGeometry.ts:18`** — beide Zeilen auf dieselbe Form
      bringen, mit dem Klassennamen der jeweiligen Datei in der Meldung:

      ```ts
      const baseSprite = this.basePool?.createVO();
      if (baseSprite == null) {
        throw new Error('TexturedSpritesGeometry: the base pool has no room for the base sprite');
      }
      baseSprite.make(...makeBaseSpriteArgs);
      ```

      Das ersetzt den `TypeError: Cannot read properties of undefined (reading 'make')`, den diese
      Zeile heute in genau diesem Fall wirft, durch eine Meldung, die die Ursache nennt. Kein
      Test: mit einer Base-Kapazität von `1` und einem Pool, aus dem in diesem Konstruktor noch
      niemand gezogen hat, ist keine der beiden Hälften erreichbar. Beide Dateien sind
      Prettier-Verletzer — im Stil der Umgebung schreiben, nichts umformatieren.

  13. **`sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:7`** — `interface` zu
      `export interface` machen. `sprites/public-api.ts` reicht das Modul mit `export *` weiter,
      damit ist der Typ Teil der öffentlichen Oberfläche; an der `public-api.ts` ist nichts zu
      tun. Prettier-Verletzer — nur dieses eine Wort.

  14. **`vertex-objects/VertexObjectPool.spec.ts:782-798`** — den Test auf das benennen, was er
      prüft, und den Kommentar durch eine Zeile ersetzen, die den Vertrag nennt statt die
      Alternativen abzuwägen:
      - Name: `'VertexObjectPool: getVO() answers nothing after dispose()'`
      - Zeilen 792-796 ersetzen durch eine Zeile in der Art:
        `// a disposed pool is dead — nothing it handed out can be read or written again`
      - Aufbau und Assertions bleiben unverändert, die beiden `createVO()`-Aufrufe im Setup
        ebenso: sie sind der Grund, warum `getVO(0)` und `getVO(1)` überhaupt etwas hätten
        antworten können.

  15. **Die beiden fast gleichlautenden Testnamen** — jeder bekommt den Namen dessen, was er
      assertiert:
      - `vertex-objects/VertexObjectPool.spec.ts:620` →
        `'attaching under a name that is already taken releases the attachment of the pool it replaces'`
      - `vertex-objects/vertex-buffers-geometry-updates.spec.ts:754` →
        `'attaching over a name that is already taken disposes the geometry-built pool it replaces'`

  16. **`vertex-objects/VertexObjectPool.spec.ts:531`** — ` as any` ersatzlos streichen:
      `return typedArrays.has(bufAttr.array);`. Nachgemessen: die `TypedArray`-Union von three
      (`@types/three@0.183.1`, `src/core/BufferAttribute.d.ts:5-14`) ist die Union des Repos
      (`types.ts:5-15`) ohne `Float16Array`, three's Typ ist also zuweisbar, und
      `Set<TypedArray>.has(bufAttr.array)` prüft ohne Cast durch — mit `tsc` unter denselben
      Compiler-Optionen gegengeprüft.

  17. **`packages/twopoint5d/CHANGELOG.md`, Abschnitt `Unreleased`** — nach den Regeln des Skills
      `updating-changelog` (lade es, bevor du die Datei anfasst). Veröffentlichte Abschnitte
      bleiben unberührt, die Reihenfolge Added → Changed → Removed → Fixed → Migration Guide
      bleibt stehen. Vier Änderungen:

      - Unter `### Added` eine Zeile: dass `AnimatedSpritesMaterialParameters` exportiert ist und
        ein Consumer den Optionstyp des `AnimatedSpritesMaterial`-Konstruktors benennen kann, wie
        bei jedem Geschwister-Material.
      - Unter `### Changed` eine Zeile: `TexturedSprites#spritePool` ist
        `TexturedSpritePool | undefined` und `#texture` ist `Texture | undefined`; nach `dispose()`
        hält der Mesh weder Geometry noch Material, und `spritePool`, `texture`, `createSprite()`
        und `freeSprite()` antworten `undefined` beziehungsweise tun nichts.
      - Unter `### Fixed` eine neue Zeile zu `InstancedVertexObjectGeometry`: eine ausdrücklich
        übergebene Base-Kapazität `0` erreicht den Base-Pool, statt zu `1` zu werden — derselbe
        Wert, den `InstancedVOBufferGeometry` nimmt.
      - Unter `### Fixed` die vorhandene Zeile zum `VOBufferPool#usedCount`-Setter so erweitern,
        dass sie die Klemme als Invariante nennt: jeder schreibende Pfad — `clear()`, `dispose()`,
        `createFromAttributes()` und `fromBuffersData()` — geht durch den Setter. Der Rest der
        Zeile bleibt, wie er ist. Keine zweite Zeile daneben: zwei Einträge, die einander halb
        widersprechen, sind genau das, was dieses Paket abräumt.
      - Im `### Migration Guide` ein neuer Unterabschnitt, ganz ans Ende, in der Machart der
        vorhandenen (`#### Projection fields name the values their constructors write` ist die
        nächste Vorlage), mit **Before**/**After**-Block:

      ````markdown
      #### `TexturedSprites#spritePool` and `#texture` can be `undefined`

      `TexturedSprites#dispose()` releases the geometry and the material and leaves the mesh
      holding neither. `spritePool` and `texture` name that: both are typed `| undefined`,
      `createSprite()` answers `undefined`, and `freeSprite()` and a write to `texture` do nothing
      once the sprites are disposed. Under `strictNullChecks`, code that reads either field
      without a guard turns into a compile error. Sprites that have not been disposed — the normal
      case — need no change.

      **Before**

      ```ts
      const sprites = new TexturedSprites(1000);
      const pool: TexturedSpritePool = sprites.spritePool;
      ```

      **After**

      ```ts
      const sprites = new TexturedSprites(1000);
      const pool = sprites.spritePool;
      if (pool == null) return; // the sprites were disposed
      ```
      ````

- Verify: `pnpm lint && NX_TUI=false pnpm nx run-many -t build --skip-nx-cache && NX_TUI=false pnpm nx run-many -t checkPkgTypes --skip-nx-cache && NX_TUI=false pnpm nx run-many -t test --projects=tag:ci --skip-nx-cache && npx prettier --check packages/twopoint5d/src/vertex-objects/VOBufferPool.ts packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.ts packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`
  (die vier Kommandos aus dem Kopf des Plans, dazu `prettier --check` über genau die sieben
  berührten Dateien, die heute sauber sind. Die sechs übrigen berührten Dateien verletzen die
  Konfiguration bereits und gehören Paket 11 — stünden sie hier, wäre das Gate von Anfang an rot)
- Commit: `fix(twopoint5d): let guards, types and test names hold what they claim`
- Ergebnis: 2 Runden · alle 13 Fundstellen behoben · 3 Regressionstests, alle drei vor
  ihrem Fix rot gesehen: `fromBuffersData() writes through the clamp`
  (`usedCount` stand auf `99` statt `4`), `an explicit base capacity of 0 reaches the
  base pool` (`capacity` stand auf `1` statt `0`) und `the convenience API answers
  nothing once the sprites are disposed` (`TypeError` auf `undefined.instancedPool`) ·
  die übrigen zehn Fundstellen ändern keine Ausführung, dort ist der Diff der Beleg ·
  Verify grün über alle fünf Teile einschließlich der Playwright-Browsertests, ohne
  Nx-Cache gefahren (`<arbeitsdir>/paket-10.verify.log`, exit=0, 90 Test-Dateien,
  1406 Tests) · die Fehlerkette lief 1 → 0
- Nebenbefunde: → Queue (2 Einträge, beide → Scope)
- Folgen: keine offene. Die eine, die in Runde 1 aufkam, ist geschlossen:
  `apps/lookbook/src/pages/demos/textured-sprites.astro:91` war der einzige Aufrufer
  im Repo, der `TexturedSprites#spritePool` liest, und liegt jetzt hinter einem
  `== null`-Guard in genau der Machart, die der Migrations-Abschnitt des CHANGELOG
  einem Consumer vorzeichnet. Nicht nachgezogen und bewusst nicht: die vier
  ungeguardeten Lesezugriffe in
  `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts:12,24,34` —
  sie prüfen den nicht-disposed Normalfall, ein `!` dort wäre genau die Behauptung,
  die dieses Paket abräumt, und scharf würden sie erst mit `strictNullChecks: true`,
  das im Audit als eigenes offenes Finding steht und nicht zu diesem Lauf gehört.
- Schnittstellen:
  - `TexturedSprites#spritePool` ist `TexturedSpritePool | undefined`, `#texture` ist
    `Texture | undefined`. Nach `dispose()` hält der Mesh weder Geometry noch Material:
    beide Getter antworten `undefined`, `createSprite()` ebenso, `freeSprite()` und ein
    Schreibzugriff auf `texture` tun nichts.
  - `AnimatedSpritesMaterialParameters` ist exportiert und über
    `sprites/public-api.ts` (`export *`) Teil der öffentlichen Oberfläche.
  - `InstancedVertexObjectGeometry`: eine ausdrücklich übergebene Base-Kapazität `0`
    erreicht den Base-Pool, statt zu `1` zu werden — derselbe Wert, den
    `InstancedVOBufferGeometry` nimmt.
  - `VOBufferPool#usedCount`: die Klemme auf `[0, capacity]` ist eine Invariante der
    Klasse, kein Setter-Detail. Jeder schreibende Pfad geht durch den Setter, auch
    `fromBuffersData()` — ein `buffersData.usedCount` außerhalb der Spanne wird geklemmt
    statt übernommen.
  - `TexturedSpritesGeometry` und `AnimatedSpritesGeometry` werfen im Konstruktor einen
    `Error` mit Klassennamen und Ursache, wenn der Base-Pool kein Objekt mehr hergibt,
    statt in einen `TypeError` zu laufen. Über keinen Pfad dieser Codebase erreichbar.

Warum ein Paket und nicht dreizehn: alle dreizehn sind derselbe Fehler in verschiedenen
Kleidern — eine Stelle sagt etwas, das die Stelle daneben nicht hält. Der Diff ist an jeder
einzelnen ein bis drei Zeilen, und ein Reviewer, der sie zusammen liest, sieht das Muster;
dreizehn Commits würden es zerstreuen.

Drei der dreizehn ändern beobachtbares Verhalten und bekommen deshalb je einen Regressionstest,
der vor dem Fix rot ist: die Klemme in `fromBuffersData()`, die Base-Kapazität `0` und die
Convenience-API nach `dispose()`. Die übrigen zehn ändern keine Ausführung — dort ist der Beleg
der Diff, nicht ein Test. Zwei Fundstellen werden ausdrücklich **nicht** durch einen Guard
behoben, sondern durch einen Kommentar, der die tragende Invariante benennt (Schritt 7): ein
Guard vor einer Bedingung, die durch Konstruktion nicht eintreten kann, ist dieselbe Unwahrheit
wie ein `!` vor einem `if` — nur in die andere Richtung.

Restplan geprüft in Zug 0 von Paket 10 (2026-09-03): Schnitt und Reihenfolge bleiben. Paket 11
muss hinter 10 stehen bleiben — sechs der dreizehn Dateien dieses Pakets stehen auf seiner
Reformat-Liste, und ein flächiger Reformat davor machte diesen Diff unlesbar; die Abhängigkeit
`Hängt ab von: 10` ist damit bestätigt und nicht bloß übernommen. Paket 12 hängt von nichts ab
und berührt nur `packages/twopoint5d-testing/`, es kann vor oder nach 11 laufen. Kein Paket
geteilt, keines zusammengelegt, keine neue Nummer vergeben. »Offene Befunde« bleibt unverändert:
die zehn dort noch offenen Einträge tragen alle das Urteil `→ Audit` und liegen sämtlich außerhalb
von `vertex-objects/` und `sprites/` — sie gehen im Abschluss ins Audit zurück, nicht in ein
Paket. Neue Nebenbefunde sind in diesem Zug keine entstanden; dass `strictNullChecks` auf `false`
steht, ist im Audit bereits als eigenes, offenes Finding erfasst und ausdrücklich nicht im Scope
dieses Laufs.

Fortgeschrieben nach dem Commit (2026-09-03): der Satz »»Offene Befunde« bleibt unverändert«
gilt für Zug 0 und nicht mehr für das Paket. Aus den Dateien, die der Implementierer angefasst
hat, sind zwei neue Nebenbefunde zurückgekommen, beide `→ Scope`, beide vorbestehend und beide
aus derselben Ursache: eine `dispose()`-Methode in `sprites/` gibt frei, was ihr nicht gehört
(`AnimatedSpritesMaterial.ts:85-87`, `TexturedSprites.ts:63-68`). Sie stehen jetzt in »Offene
Befunde« und brauchen im Abschluss eine zweite Drain-Runde; ein Paket dafür schneidet dieser
Runner nicht.

### [x] 11. Das Lint-Gate sieht auch Formatierung

- Nebenbefund: 2 Einträge aus »Offene Befunde« (`low`), aus der Drain-Runde
- Ziel: Eine Formatierung, die der Prettier-Konfiguration des Repos widerspricht, wird vom Verify-Gate gemeldet statt übersehen.
- Bereich: `package.json#scripts` und `.prettierignore`, dazu jede Datei, die der Reformat anfasst
- Hängt ab von: 10 (ein flächiger Reformat vor Paket 10 machte dessen Diff unlesbar)
- Hash: 02a57fa
- Modell: mittlere Stufe
- Effort: low
- Dateien: `.prettierignore`, `package.json`, `CLAUDE.md`, `AGENTS.md`,
  `apps/lookbook/src/components/TagCloudFilter.astro` — dazu die 56 Dateien, die
  `npx prettier --write .` anfasst, keine davon von Hand
- Fundstellen:
  - `vertex-objects/initializeAttributes.ts:1`, `initializeInstancedAttributes.ts:2`,
    `vertex-buffers-geometry-updates.spec.ts`, `sprites/AnimatedSprites/AnimatedSpritesGeometry.ts`,
    `sprites/AnimatedSprites/AnimatedSpritesMaterial.ts` (Import-Block),
    `sprites/TexturedSprites/TexturedSpritesGeometry.ts`,
    `sprites/TexturedSprites/TexturedSpritesMaterial.ts` — alle verletzen `bracketSpacing: false`
    bzw. `printWidth: 130`. `npx prettier --check` meldet sie, `pnpm lint` ist `eslint .` und
    prüft keine Formatierung.
  - Die Lücke selbst: solange das Gate Formatierung nicht sieht, wächst diese Liste weiter
    nach. Der Reformat allein behebt den Zustand von heute, nicht die Ursache.
- Vorgehen:
  1. `.prettierignore` um vier Blöcke am Ende erweitern, jeder mit der Kommentarzeile,
     die seinen Grund nennt:

     ```
     # generated by `astro sync`, never hand-edited
     apps/*/.astro

     # playwright run artifacts
     packages/*/test-results

     # vendored build output, kept byte-for-byte as shipped
     apps/lookbook/public/js

     # report artifact, rewritten wholesale by its generator
     audit.html
     ```

     Die ersten beiden sind nötig, obwohl beide Verzeichnisse in einer `.gitignore` stehen:
     Prettier liest ausschließlich die `.gitignore` und die `.prettierignore` im
     Arbeitsverzeichnis und sieht die verschachtelten in `apps/lookbook/` und
     `packages/twopoint5d-testing/` nicht. Nachgemessen: `prettier --check .` meldet ohne
     diese vier Blöcke 67 Dateien, mit ihnen 56.
  2. `apps/lookbook/src/components/TagCloudFilter.astro`, Zeilen 10–29: die drei
     nebeneinanderstehenden Elemente `<h3>`, `<p>` und `<ul>` im `map()`-Ausdruck in ein
     Astro-Fragment fassen — `<>` in eine neue Zeile direkt nach `tagCategories.map((category) => (`,
     `</>` in eine neue Zeile direkt vor dem schließenden `))`. Genau zwei neue Zeilen, am
     übrigen Ausdruck ändert sich nichts.

     Der Grund: `prettier-plugin-astro` parst Ausdrücke mit einem JSX-Parser, und der lehnt
     nebeneinanderstehende Elemente ohne Klammerung ab (`SyntaxError: Adjacent JSX elements
     must be wrapped in an enclosing tag`). Astros eigener Compiler nimmt die Form an, die
     Datei baut heute — aber solange sie so dasteht, endet `prettier --check .` mit einem
     Parse-Fehler, und das Gate wäre ab seiner ersten Minute rot. Ein Fragment erzeugt kein
     Element im DOM. Nachgemessen in Zug 0: mit den beiden Zeilen parst Prettier die Datei
     und formatiert sie ansonsten unverändert — der ganze Diff sind diese zwei Zeilen.

     Scheitert `pnpm nx build lookbook` daran: die beiden Zeilen zurücknehmen und die Datei
     stattdessen mit genau dieser Begründung in `.prettierignore` aufnehmen. Nicht am
     Ausdruck weiterbasteln, nicht die drei Elemente umbauen.
  3. `npx prettier --write .` aus dem Wurzelverzeichnis des Repos, **nach** Schritt 1 und 2.
     Die Reihenfolge ist zwingend: davor geführt schreibt der Lauf `audit.html` (rund 7.000
     Zeilen) und die beiden ausgelieferten `rainbow-line`-Dateien um.

     Erwartet: 56 Dateien, zusammen 1.015 geänderte Zeilen. Von Hand wird an keiner davon
     etwas nachgezogen — kein umbenanntes Symbol, kein sortierter Import, kein Kommentar.
     Was in diesen Dateien sonst noch falsch ist, wird als Nebenbefund gemeldet.
  4. `package.json` im Wurzelverzeichnis, Abschnitt `scripts` — `lint` ersetzen und `format`
     direkt darunter setzen:

     ```json
     "lint": "eslint . && prettier --check .",
     "format": "prettier --write .",
     ```

     ESLint steht vorn, damit ein echter Fehler vor der Formatierung gemeldet wird. Keine neue
     Abhängigkeit: `prettier` steht bereits in `devDependencies`, und `eslint-config-prettier`
     bleibt unangetastet — es schaltet weiterhin die ESLint-Regeln ab, die mit Prettier
     kollidieren, und genau deshalb muss Prettier als eigener Schritt laufen.

     Kein `--ignore-path` an den Aufruf hängen. Die Flagge ersetzt die Voreinstellung, statt
     sie zu ergänzen; damit fällt die `.gitignore` weg und der Lauf greift auf `.nx/cache`
     zu — in Zug 0 gemessen, es sind mehrere tausend Dateien.
  5. Doku nachziehen — die Befehlsliste kennt den neuen Befehl sonst nicht, und eine der
     beiden Beschreibungen wird durch diesen Schritt falsch:
     - `CLAUDE.md`, Befehlsliste: unter der `Lint:`-Zeile eine neue Zeile
       ``- Format: `pnpm format` (Prettier über das ganze Repo; `pnpm lint` meldet, was es ändern würde)``.
       Die `Lint:`-Zeile selbst bleibt, wie sie ist — sie sagt bereits »flat-config ESLint +
       Prettier« und wird durch dieses Paket zum ersten Mal wahr.
     - `AGENTS.md:24` — »**Lint:** `pnpm lint` (ESLint for workspace)« nennt ab jetzt ESLint
       *und* Prettier und verweist auf `pnpm format` als den Weg zurück.

     Beide Dateien fallen unter `*.md` in `.prettierignore` und werden vom Reformat nicht
     angefasst.
  6. Kein Eintrag in `packages/twopoint5d/CHANGELOG.md`. Die Konvention im Kopf verlangt ihn
     für sichtbares Verhalten; die veröffentlichte Oberfläche von `@spearwolf/twopoint5d`
     bewegt sich hier um keinen Buchstaben — Whitespace in den Quellen, ein Repo-Skript, zwei
     Doku-Zeilen.
  7. Den folgenden Nachweis am eigenen Diff wiederholen und in den Report schreiben — er ist
     der einzige Zugang des Reviewers zu einem Diff, den niemand Zeile für Zeile liest. Die
     Messung: für jede geänderte Datei den Inhalt vor und nach dem Formatieren ohne Whitespace,
     ohne Kommata, ohne Semikolons und mit vereinheitlichten Anführungszeichen vergleichen
     (`tr -d '[:space:]' | tr -d ',;' | tr '"' "'"`). In Zug 0 ergab das: **drei** Dateien
     ändern mehr als Layout, Anführungszeichenstil und Trailing Commas, und alle drei so:

     - `apps/lookbook/src/pages/demos/stage-postprocessing.astro:58` — `i * (1.5 * (Math.PI * 2) / sprites.length)`
       wird zu `i * ((1.5 * (Math.PI * 2)) / sprites.length)`
     - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts` (zweimal) —
       `((i * 9301 + 49297) % 233280) / 233280 * 1000 - 500` wird zu `(((i * 9301 + 49297) % 233280) / 233280) * 1000 - 500`
     - `packages/twopoint5d-testing/web-test-runner.config.js` — `testFramework =>` wird zu `(testFramework) =>`

     Die ersten beiden sind Klammern um eine Auswertungsreihenfolge, die `*` und `/` als
     linksassoziative Operatoren ohnehin haben; die dritte sind die Klammern um einen
     einzelnen Pfeilparameter. Kommt der Implementierer auf eine vierte Datei, ist das kein
     Detail, sondern gehört in den Report.
- Verify: `pnpm lint && NX_TUI=false pnpm nx run-many -t build --skip-nx-cache && NX_TUI=false pnpm nx run-many -t checkPkgTypes --skip-nx-cache && NX_TUI=false pnpm nx run-many -t test --projects=tag:ci --skip-nx-cache`
  (die vier Kommandos aus dem Kopf des Plans, die letzten drei ohne Nx-Cache: der Reformat
  fasst fast jede Quelldatei an, und ein grüner Treffer aus dem Cache belegt hier nichts.
  `pnpm lint` trägt ab diesem Paket die Formatprüfung selbst — es ist zugleich das erste
  Kommando und der Beleg, dass das Gate steht.)
- Commit: `build: check formatting in the lint gate and reformat the repo`
- Ergebnis: 1 Runde, keine Fehlerkette · beide Nebenbefunde aus der Drain-Runde behoben:
  `pnpm lint` ist `eslint . && prettier --check .`, `pnpm format` steht daneben, und die
  sieben dreckigen Fundstellen sind mit 56 weiteren Dateien formatiert (487+/578- über 61
  Dateien, davon 5 von Hand) · die Messung nach Schritt 7 bestätigt am eigenen Diff genau die
  drei vorhergesagten Dateien mit mehr als Layout, keine vierte · kein Regressionstest, das
  Paket behebt keinen Korrektheitsfehler · klein: `.github/workflows/ci.yml` und
  `deploy.yml` hat der Reformat mitgenommen, ohne dass der Detailplan sie aufzählte
- Nebenbefunde: keine neuen
- Folgen: keine · die im Detailplan angekündigte Zeilennummern-Neuauflösung ist erledigt:
  `CLAUDE.md:16` → `:17`, die drei übrigen Einträge stehen unverändert auf ihrer Zeile
  (`TileSpritesGeometry.ts:17`, `Canvas2DStage.ts:139`, `AnimatedSpritesMaterial.ts:85-87`,
  je am Symbol nachgesehen)
- Schnittstellen: `pnpm lint` prüft ab hier auch die Formatierung und schlägt bei einem
  Prettier-Verstoß fehl · `pnpm format` schreibt die Formatierung im ganzen Repo

Steht bewusst am Ende: ein breitflächiger Reformat gehört ganz nach vorn oder ganz nach
hinten, nie dazwischen, weil sonst jeder folgende Diff unlesbar wird.

Warum das Gate im `lint`-Skript sitzt und nicht in `eslint.config.mjs`: der Weg über
`eslint-plugin-prettier` liefe Prettier als ESLint-Regel und nähme dafür eine neue
Abhängigkeit, einen langsameren Lauf und eine zweite Konfigurationsebene in Kauf. Der
Gegenwert wäre, dass `--fix` mitformatiert — was `pnpm format` ebenso tut, mit einem Werkzeug,
das das Repo ohnehin installiert hat. `eslint-config-prettier` bleibt daneben stehen und
behält seine Aufgabe: es schaltet die ESLint-Regeln ab, die Prettier widersprächen.

Ab diesem Commit greift das Gate auch in GitHub Actions — `.github/workflows/ci.yml` fährt
`pnpm run ci`, und darin steckt `lint`. Ein falsch formatierter Pull Request fällt dort auf,
nicht erst im Review.

Restplan geprüft in Zug 0 von Paket 11 (2026-09-03): Schnitt und Reihenfolge bleiben. Paket 12
ist das letzte offene, hängt von nichts ab und berührt nur `packages/twopoint5d-testing/`; es
hinter 11 zu lassen ist trotzdem das Bessere, weil sein neuer Testfall dann von einem Gate
empfangen wird, das Formatierung sieht — Paket 11 formatiert drei Dateien in genau diesem
Verzeichnis mit. Kein Paket geteilt, keines zusammengelegt, keine neue Nummer vergeben.

Die beiden `→ Scope`-Einträge aus Paket 10 (`AnimatedSpritesMaterial.ts:85-87`,
`TexturedSprites.ts:63-68`, eine `dispose()`-Methode in `sprites/` gibt frei, was ihr nicht
gehört) bekommen hier kein Paket: sie sind Nebenbefunde, nicht Folgen, und teilen die Ursache
dieses Pakets nicht. Sie blockieren auch Paket 12 nicht. Ihr Weg bleibt die zweite Drain-Runde
des Abschlusses, so wie Paket 10 es notiert hat.

Nach dem Commit nachzuziehen (Zug 5): der Reformat verschiebt Zeilennummern in Dateien, auf die
»Offene Befunde« zeigt. Vier Einträge sind betroffen und werden über ihr Symbol neu aufgelöst,
nicht geschätzt — `map2d/TileSprites/TileSpritesGeometry.ts:17`, `stage/Canvas2DStage.ts:139`,
`sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:85-87` und `CLAUDE.md:16`, letzteres nicht
durch den Reformat, sondern durch die in Schritt 5 eingefügte Zeile. Alle übrigen offenen
Einträge liegen in Dateien, die Prettier nicht anfasst — in Zug 0 gegen die Liste der 56
abgeglichen.

### [x] 12. Ein Browsertest, der einen echten Upload gegen die GPU fährt

- Nebenbefund: 1 Eintrag aus »Offene Befunde« (`low`), aus der Drain-Runde
- Ziel: Die Browsertest-Suite deckt mindestens einen `vertex-objects/`-Pfad ab, und zwar den, an dem ein zu kurz berechneter Upload sichtbar wird.
- Bereich: `packages/twopoint5d-testing/test/`
- Hängt ab von: —
- Hash: bbf1e4b
- Modell: opus
- Effort: medium
- Dateien: `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js` (neu, die einzige Datei dieses Pakets)
- Fundstellen:
  - `packages/twopoint5d-testing/test/` — die Suite deckt Display, Stage und TextureStore ab,
    aus `vertex-objects/` keinen Pfad. `CLAUDE.md` verlangt für Rendering- und
    GPU-Buffer-Änderungen einen Browsertest; die Upload-Range wurde in diesem Lauf
    umgestellt, und der Zusatzlauf war grün, weil er den Pfad nicht kennt.
  - Gebraucht wird ein Fall mit `vertexCount > 1`, der einen echten Upload gegen die GPU
    fährt — genau die Konstellation, in der eine zu kurze Range drei Viertel der Daten
    stale lässt und trotzdem jede Unit-Test-Suite grün bleibt.

**Abgleich (Zug 0, 2026-09-03).** Der Sachverhalt steht unverändert. Die Suite hat fünf
Dateien — `display-resize`, `hello-twopoint5d-canvas`, `stage-pipeline`, `stage-renderer`,
`texture-store-on` —, und `grep -rln "VertexObject\|VOBuffer\|Sprites\|vertex-objects"` über
`packages/twopoint5d-testing/test/` liefert keinen Treffer. Kein Pfad aus `vertex-objects/`
wird im Browser gefahren.

**Triage der offenen Befunde (Zug 0, 2026-09-03).** Beide Stapel sind durchgesehen. Unter den
elf erledigten Paketen steht keine offene `Folgen:`-Zeile mehr — bis auf die eine, die dieser
Zug 0 selbst aufgedeckt hat und die als Paket 13 unten steht. In »Offene Befunde« liegen zwölf
unerledigte Einträge: zehn tragen `→ Audit` und gehören dem Abschluss, der sie als neue
Findings zurückschreibt; zwei tragen `→ Scope` und sind dieselbe Ownership-Frage
(`AnimatedSpritesMaterial.ts:85-87` und `TexturedSprites.ts:63-68` — ein `dispose()`, das
fremde Texturen, Geometrien und Materialien mit freigibt). Zug 0 von Paket 11 hat sie der
zweiten Drain-Runde zugeschlagen; dieser Zug 0 bestätigt das, ohne es neu aufzurollen: sie
teilen die Ursache dieses Pakets nicht, sie blockieren es nicht, und ein Paket für beide
schneidet der Abschluss, wenn sie nebeneinanderliegen. Nichts davon wandert in Paket 12.

**Was Zug 0 nachgemessen hat.** Der Weg ist nicht erfunden, sondern gefahren: die Datei unten
lief am 2026-09-03 vollständig, `pnpm web-test-runner` über die ganze Suite kam mit Exit 0 und
sechs Dateien zurück, und `npx prettier --check` sowie `npx eslint` melden nichts. Die
Messungen dahinter:

- **Die Sonde ist `renderer.getArrayBufferAsync(attr)`.** Sie liest den GPU-Buffer zurück, den
  three für das Attribut angelegt hat, und existiert in beiden Backends
  (`WebGPUBackend.js:323`, `WebGLBackend.js:302`). Damit wird nicht geprüft, was im
  typisierten Array steht, sondern was auf der Karte liegt — das ist der Unterschied, den
  dieses Paket kaufen soll.
- **Beide Browser der Suite kommen dort an, auf verschiedenen Wegen.** Headless Chromium hat
  kein WebGPU und fällt auf WebGL2 zurück (`isWebGPUBackend=false`), Firefox läuft mit
  `dom.webgpu.enabled` echt auf WebGPU (`isWebGPUBackend=true`). Beide liefern dieselben Zahlen.
- **Der erste Upload beweist nichts.** three lädt beim Anlegen des Buffers immer das ganze
  Array hoch (`WebGPUAttributeUtils.js:127-135`, `mappedAtCreation`); erst ab dem zweiten
  Upload greifen die `updateRanges`. Der Test rendert deshalb zweimal und schreibt zwischen
  den Frames in den **Schwanz** des Objekts.
- **Der Test hat Zähne, gegengeprobt.** Wird die Range nach `mesh.update()` von Hand auf den
  alten, zu kurzen Wert gesetzt (`clearUpdateRanges()` + `addUpdateRange(0, 3)`, also
  `itemSize * usedCount` statt `itemSize * vertexCount * usedCount`), liest der Readback in
  beiden Browsern die Werte aus Frame 1 zurück und die Assertion fällt. Ohne diesen Eingriff
  ist sie grün.
- **Ein Attribut, das kein Shader liest, landet nie auf der GPU.** three lädt nur die
  Attribute hoch, die das Programm anfordert. `position` zieht `MeshBasicMaterial` von selbst;
  für `instanceOffset` braucht es ein Material, das die Attribute nennt — deshalb das
  `MeshBasicNodeMaterial` mit `positionNode` im zweiten Fall. Ohne das kommt der Readback als
  Nullen zurück, und der Test wäre grün, ohne irgendetwas zu prüfen. Gemessen.
- **Der `no-console`-Fehler gilt hier nicht**: `eslint.config.mjs:53-67` schaltet ihn für
  `**/*.test.js` ab und setzt die Mocha-Globals. Der eine `console.debug` im `beforeEach` ist
  bewusst da — er sagt in der Ausgabe, welches Backend gerade gemessen hat.
- **Die Mocha-Frist der Suite steht auf 2000 ms** (`web-test-runner.config.js`). Das reicht
  gemessen, aber ein kalter WebGPU-Start liegt näher an der Grenze, als einem lieb ist; die
  Tests heben sie deshalb über `this.timeout(20000)` an, und genau deswegen sind es
  `async function ()` und keine Pfeilfunktionen.

- Vorgehen:
  1. `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js` anlegen, mit exakt
     diesem Inhalt. Er ist nachgemessen — Abweichungen sind erlaubt, wo sie den Text
     verbessern, aber jede Abweichung an den Werten, an der Reihenfolge der Frames oder am
     Material des zweiten Falls hebt eine der Messungen oben auf und muss selbst gemessen
     werden:

     ```js
     import {expect} from '@esm-bundle/chai';
     import {Display, InstancedVertexObjectGeometry, VertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
     import {attribute} from 'three/tsl';
     import {MeshBasicMaterial, MeshBasicNodeMaterial, PerspectiveCamera, Scene} from 'three/webgpu';

     const FIXTURE_ID = 'vertex-objects-gpu-upload-fixture';

     function makeContainer({width = 320, height = 200} = {}) {
       const el = document.createElement('div');
       el.id = `${FIXTURE_ID}-${Math.random().toString(36).slice(2, 8)}`;
       el.style.position = 'absolute';
       el.style.left = '0';
       el.style.top = '0';
       el.style.width = `${width}px`;
       el.style.height = `${height}px`;
       document.body.appendChild(el);
       return el;
     }

     /** The buffer behind an attribute — that is where the update ranges live that steer the upload. */
     function bufferOf(attr) {
       return attr.isInterleavedBufferAttribute ? attr.data : attr;
     }

     /** Reads an attribute back out of the gpu buffer three has uploaded it into. */
     async function readBack(renderer, attr) {
       return Array.from(new Float32Array(await renderer.getArrayBufferAsync(attr)));
     }

     const quadDescription = {
       vertexCount: 4,
       indices: [0, 1, 2, 0, 2, 3],
       attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
     };

     const instancedDescription = {
       meshCount: 1,
       attributes: {instanceOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
     };

     describe('vertex-objects — gpu upload', () => {
       /** @type {Display | undefined} */
       let display;
       /** @type {HTMLElement | undefined} */
       let host;
       let scene;
       let camera;

       beforeEach(async () => {
         host = makeContainer();
         display = new Display(host);
         await display.start();
         console.debug(`Display: backend is ${display.isWebGPUBackend ? 'WebGPU' : 'WebGL'}`);
         scene = new Scene();
         camera = new PerspectiveCamera(75, 1.6, 0.1, 100);
         camera.position.z = 5;
       });

       afterEach(() => {
         display.dispose();
         display = undefined;
         if (host && host.parentNode) {
           host.parentNode.removeChild(host);
         }
         host = undefined;
       });

       it('every vertex of a used object reaches the gpu, not just the first', async function () {
         this.timeout(20000);

         const geometry = new VertexObjectGeometry(quadDescription, 8);
         const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
         scene.add(mesh);

         const quad = geometry.pool.createVO();
         quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);

         mesh.update();
         display.renderer.render(scene, camera);
         await display.nextFrame();

         const position = geometry.getAttribute('position');

         // rewrite the tail of the very same object: only vertex 0 keeps the values it had
         quad.setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
         mesh.update();

         // itemSize (3) * vertexCount (4) * usedCount (1) — a range of 3 would carry vertex 0 alone
         expect(bufferOf(position).updateRanges).to.deep.equal([{start: 0, count: 12}]);

         display.renderer.render(scene, camera);
         await display.nextFrame();

         expect((await readBack(display.renderer, position)).slice(0, 12)).to.deep.equal([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
       });

       it('an instanced geometry uploads its base quad and every used instance', async function () {
         this.timeout(20000);

         const geometry = new InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1);
         const material = new MeshBasicNodeMaterial();
         // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
         material.positionNode = attribute('position', 'vec3').add(attribute('instanceOffset', 'vec3'));
         const mesh = new VertexObjects(geometry, material);
         scene.add(mesh);

         const quad = geometry.basePool.createVO();
         quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
         geometry.instancedPool.createVO().setInstanceOffset([1, 1, 1]);

         mesh.update();
         display.renderer.render(scene, camera);
         await display.nextFrame();

         const position = geometry.getAttribute('position');
         const instanceOffset = geometry.getAttribute('instanceOffset');

         quad.setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
         for (let i = 1; i < 4; i++) {
           geometry.instancedPool.createVO().setInstanceOffset([i * 10, i * 10, i * 10]);
         }

         mesh.update();

         // the base pool counts vertices per object, the instanced pool counts instances
         expect(bufferOf(position).updateRanges, 'base pool').to.deep.equal([{start: 0, count: 12}]);
         expect(bufferOf(instanceOffset).updateRanges, 'instanced pool').to.deep.equal([{start: 0, count: 12}]);

         display.renderer.render(scene, camera);
         await display.nextFrame();

         expect((await readBack(display.renderer, position)).slice(0, 12), 'base quad').to.deep.equal([
           0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9,
         ]);
         expect((await readBack(display.renderer, instanceOffset)).slice(0, 12), 'instances').to.deep.equal([
           1, 1, 1, 10, 10, 10, 20, 20, 20, 30, 30, 30,
         ]);
       });
     });
     ```

  2. Nichts sonst anfassen. Kein Eintrag in `packages/twopoint5d/CHANGELOG.md`: das Paket
     ändert kein sichtbares Verhalten der veröffentlichten Bibliothek, sondern deckt
     bestehendes ab. Keine neue Datei in `packages/twopoint5d/src/`, keine Änderung an
     `web-test-runner.config.js`, keine Änderung an `CLAUDE.md`.
  3. `test-results/` bleibt unversioniert (`packages/twopoint5d-testing/.gitignore`) — was der
     Lauf dort ablegt, gehört nicht in den Commit.

- Verify: die vier Kommandos aus dem Kopf dieses Plans, vollständig und in dieser Reihenfolge.
  `pnpm test:ci` fährt die Playwright-Suite mit; genau dort muss die neue Datei auftauchen
  (»Running 6 test files«).
- Commit: `test(twopoint5d-testing): cover the vertex-object gpu upload in the browser suite`
- Ergebnis: 1 Runde · die Suite fährt jetzt zwei `vertex-objects/`-Pfade im Browser, beide mit
  echtem GPU-Readback über `renderer.getArrayBufferAsync()` · Zähne belegt: mit der verkürzten
  Range (`addUpdateRange(0, 3)`) liest der Readback in Chromium wie in Firefox die Werte aus
  Frame 1 zurück und `every vertex of a used object reaches the gpu, not just the first` fällt ·
  klein: die `this.timeout(20000)`-Zeile muss im `describe`-Body vor den Hook-Registrierungen
  stehen, weil Mocha die Frist beim Anlegen des Hooks kopiert und nicht beim Ausführen liest —
  ungeschrieben · klein: Geometry und Material der beiden Tests werden nicht disposed, der
  Renderer trägt das über den Testlauf mit · klein: kein CHANGELOG-Eintrag, so im Detailplan
  entschieden, obwohl die Datei Browsertests sonst unter »Added« führt (`CHANGELOG.md:434`)
- Nebenbefunde: → Queue (der interleaved Buffer-Zweig der Range-Rechnung bleibt im Browser
  ungedeckt)
- Folgen: keine
- Schnittstellen: keine — das Paket legt eine Testdatei an und ändert an der Oberfläche der
  Bibliothek nichts

### [x] 13. `dispose()` einer gerenderten Geometry wirft nicht mehr

- Folge von: Paket 2
- Ziel: `VOBufferGeometry#dispose()` und `InstancedVOBufferGeometry#dispose()` laufen auch dann
  durch, wenn die Geometry schon einmal gerendert wurde, und geben ihre Attribut-Slots
  weiterhin frei.
- Bereich: `packages/twopoint5d/src/vertex-objects/`, Regressionstest in
  `packages/twopoint5d-testing/test/`
- Hängt ab von: Paket 12 — erledigt (`bbf1e4b`). Übernommen wird von dort das Muster einer
  WebGPU-Testdatei, nicht die Datei selbst; siehe Schritt 1 des Vorgehens.
- Hash: 4465fbc
- Modell: opus
- Effort: medium
- Severity: high
- Fundstellen:
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:56-74` — `#releaseSlots()` (`:60`)
    und `setIndex(null)` (`:61`) nehmen der Geometry ihre Attribute, `super.dispose()` (`:74`)
    kommt danach.
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:268-306` — dieselbe
    Reihenfolge über alle Routen (`:274-281`), `super.dispose()` auf `:306`.
  - Der Aufräumpfad von three liest im `dispose`-Handler die Attribute noch einmal:
    `RenderObject.getAttributes()` schreibt `attributesId[name] = attribute.id`, **bevor** die
    Zeile darunter auf `undefined` prüft (in `three@0.183.1` in `three.webgpu.js:29618-29623`,
    aufgerufen aus `Geometries.onDispose`). Ist der Slot leer, gibt es kein `attribute`, und der
    Zugriff auf `.id` wirft.
  - Betroffen ist damit jeder Consumer, der die dokumentierte Freigabe geht: `TexturedSprites#dispose()`
    ruft `this.geometry?.dispose()`, und die Geometry hat zu dem Zeitpunkt schon gerendert.
- Messung (Zug 0 von Paket 12, 2026-09-03, beide Browser der Suite, identisches Ergebnis):

  | Fall | Ergebnis |
  | --- | --- |
  | einfache `BufferGeometry`, gerendert, `dispose()` | läuft durch |
  | einfache `BufferGeometry`, gerendert, `deleteAttribute('position')`, `dispose()` | `TypeError: … reading 'id'` |
  | `VertexObjectGeometry`, gerendert, aus der Szene genommen, `dispose()` | `TypeError` |
  | `VertexObjectGeometry`, gerendert, noch in der Szene, `dispose()` | `TypeError` |
  | `VertexObjectGeometry`, nie gerendert, `dispose()` | läuft durch |

  Die letzte Zeile ist der Grund, warum kein einziger Vitest-Test das sieht: dort rendert nichts.
  Die zweite isoliert die Ursache — es ist das Abräumen der Attribute vor dem Event, nicht die
  Szenenzugehörigkeit und nichts an den Pools.
- Vorbestehend? Nein, nachgesehen: `git show 60f7612:…/VOBufferGeometry.ts` zeigt ein
  `dispose()`, das nur `this.pool.clear()` und `super.dispose()` tut und die Attribute stehen
  lässt. Das Abräumen kam mit `70309b2` (Paket 2) und wurde in `34ce3e3` (Paket 7) zu
  `#releaseSlots()` gefasst. Eine Folge dieses Laufs, kein Nebenbefund, keine Rückfrage —
  eigener Schaden wird behoben.
- Abgleich (Zug 0, 2026-09-03): der Sachverhalt steht unverändert an beiden Fundstellen.
  `VOBufferGeometry.ts:57-74` — `detachAll()`, `#releaseSlots(this.buffers)` (`:61`),
  `setIndex(null)` (`:62`), `super.dispose()` als letzte Zeile (`:74`).
  `InstancedVOBufferGeometry.ts:269-306` — dieselbe Reihenfolge über alle drei Routen
  (`:274-281`), `super.dispose()` auf `:306`. Weitere `dispose()`-Implementierungen mit
  Geometry-Slots gibt es nicht; `VOBufferPool#dispose()` und `VertexObjectPool#dispose()`
  fassen keine Attribute an.
- Ursachenkette in `three@0.183.1`, nachgesehen in `build/three.webgpu.js` und damit belegt
  statt vermutet:
  1. `BufferGeometry#dispose()` feuert synchron das `dispose`-Event.
  2. `RenderObject#onGeometryDispose` (`:29425-29431`) hängt seit dem Konstruktor daran und
     setzt `this.attributes = null` — der Attribut-Cache des RenderObjects ist damit leer.
  3. `Geometries.onDispose` (`:30631-30661`) hängt seit dem ersten `initGeometry` daran und
     ruft `renderObject.getAttributes()` (`:30636`). Weil der Cache eben geleert wurde, baut
     `getAttributes()` (`:29594`) ihn aus der Geometry neu auf.
  4. Dort steht `attributesId[nodeAttribute.name] = attribute.id;` (`:29620`) **eine Zeile
     über** `if (attribute === undefined) continue;` (`:29623`). Ist der Slot leer, gibt
     `geometry.getAttribute(name)` `undefined` zurück, und der Zugriff auf `.id` wirft.
  Der Wurf schlägt aus `dispatchEvent` bis in den Aufrufer von `dispose()` durch, und
  `Geometries.onDispose` stirbt in der Mitte: die GPU-Buffer werden nicht einmal abgeräumt.
- Entschiedenes Vorgehen: `super.dispose()` wird in beiden Methoden zur **ersten** Anweisung.
  Dann läuft der Aufräumpfad des Renderers gegen vollständige Slots, findet seine Attribute und
  gibt ihre GPU-Buffer frei; alles danach ist Buchhaltung der Geometry, die three nicht mehr
  sieht. Die Zusage, um derentwillen die Slots überhaupt geräumt werden — eine erneut in eine
  Szene gehängte Geometry darf keine frischen GPU-Buffer aus den alten Arrays bekommen —, hängt
  am Endzustand und nicht an der Reihenfolge und bleibt unberührt. Geprüft: `detachAll()` fasst
  nur die Hold-Zähler in `GeometryPoolAttachments` an, `setIndex()` und `deleteAttribute()`
  feuern kein Event, und die vorhandenen Vitest-Specs zu `dispose()`
  (`vertex-buffers-geometry-updates.spec.ts:644-711`,
  `InstancedVertexObjectGeometry.spec.ts:115-205`) assertieren ausschließlich Endzustände und
  bleiben grün.
- Dateien:
  - `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js` (neu)
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
- Vorgehen:
  1. **Zuerst der Regressionstest, und zwar rot.** Er kommt in eine eigene neue Datei
     `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js` und nicht in die
     `vertex-objects-gpu-upload.test.js` aus Paket 12. Grund: die Suite hat kein geteiltes
     Helfer-Modul, jede ihrer fünf Dateien trägt ihr eigenes `makeContainer`/`disposeDisplay`
     (`display-resize`, `stage-pipeline`, `stage-renderer` — dreimal dasselbe nebeneinander).
     Eine Datei je Thema mit dupliziertem Setup ist der Hausstil, und ein `dispose`-Block in
     einer Datei namens `gpu-upload` wäre ein Name, der die Hälfte seines Inhalts verschweigt.
     Was aus Paket 12 übernommen wird, ist das Muster: derselbe Aufbau, dieselben Helfer, und
     die `this.timeout(20000)`-Zeile steht im `describe`-Body **vor** den Hook-Registrierungen,
     weil Mocha die Frist beim Anlegen des Hooks kopiert und nicht beim Ausführen liest.

     ```js
     import {expect} from '@esm-bundle/chai';
     import {Display, InstancedVertexObjectGeometry, VertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
     import {attribute} from 'three/tsl';
     import {MeshBasicMaterial, MeshBasicNodeMaterial, PerspectiveCamera, Scene} from 'three/webgpu';

     const FIXTURE_ID = 'vertex-objects-dispose-fixture';

     function makeContainer({width = 320, height = 200} = {}) {
       const el = document.createElement('div');
       el.id = `${FIXTURE_ID}-${Math.random().toString(36).slice(2, 8)}`;
       el.style.position = 'absolute';
       el.style.left = '0';
       el.style.top = '0';
       el.style.width = `${width}px`;
       el.style.height = `${height}px`;
       document.body.appendChild(el);
       return el;
     }

     /** Teardown must not mask the failure that got it here: no display, or a display that fails to go down. */
     function disposeDisplay(display) {
       if (!display) return;
       try {
         display.dispose();
       } catch {
         // ignore — the fixture still has to leave the dom
       }
     }

     const quadDescription = {
       vertexCount: 4,
       indices: [0, 1, 2, 0, 2, 3],
       attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
     };

     const instancedDescription = {
       meshCount: 1,
       attributes: {instanceOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
     };

     describe('vertex-objects — dispose', function () {
       // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
       this.timeout(20000);

       /** @type {Display | undefined} */
       let display;
       /** @type {HTMLElement | undefined} */
       let host;
       let scene;
       let camera;

       beforeEach(async () => {
         host = makeContainer();
         display = new Display(host);
         await display.start();
         scene = new Scene();
         camera = new PerspectiveCamera(75, 1.6, 0.1, 100);
         camera.position.z = 5;
       });

       afterEach(() => {
         disposeDisplay(display);
         display = undefined;
         if (host && host.parentNode) {
           host.parentNode.removeChild(host);
         }
         host = undefined;
       });

       /** Renders the mesh once, so the renderer has built its bookkeeping for this geometry. */
       async function renderOnce(mesh) {
         scene.add(mesh);
         mesh.update();
         display.renderer.render(scene, camera);
         await display.nextFrame();
       }

       it('a rendered geometry disposes and gives up its slots', async function () {
         const geometry = new VertexObjectGeometry(quadDescription, 8);
         geometry.pool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
         await renderOnce(new VertexObjects(geometry, new MeshBasicMaterial()));

         expect(() => geometry.dispose()).to.not.throw();

         // the slots are given up either way — that is what keeps a re-added geometry from
         // getting fresh gpu buffers built out of the old typed arrays
         expect(Object.keys(geometry.attributes)).to.deep.equal([]);
         expect(geometry.index).to.be.null;
       });

       it('a rendered geometry taken out of the scene disposes and gives up its slots', async function () {
         const geometry = new VertexObjectGeometry(quadDescription, 8);
         geometry.pool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
         const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
         await renderOnce(mesh);

         // the path a consumer walks: TexturedSprites#dispose() calls geometry.dispose()
         // on a geometry that has rendered
         scene.remove(mesh);
         display.renderer.render(scene, camera);
         await display.nextFrame();

         expect(() => geometry.dispose()).to.not.throw();
         expect(Object.keys(geometry.attributes)).to.deep.equal([]);
         expect(geometry.index).to.be.null;
       });

       it('a rendered instanced geometry disposes and gives up its slots', async function () {
         const geometry = new InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1);
         const material = new MeshBasicNodeMaterial();
         // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
         material.positionNode = attribute('position', 'vec3').add(attribute('instanceOffset', 'vec3'));
         geometry.basePool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
         geometry.instancedPool.createVO().setInstanceOffset([1, 1, 1]);
         await renderOnce(new VertexObjects(geometry, material));

         expect(() => geometry.dispose()).to.not.throw();

         expect(Object.keys(geometry.attributes)).to.deep.equal([]);
         expect(geometry.index).to.be.null;
       });
     });
     ```

     Der rote Lauf, bevor eine Zeile am Fix steht:
     `cd packages/twopoint5d-testing && pnpm web-test-runner test/vertex-objects-dispose.test.js`
     (greift das Positionsargument nicht, die ganze Suite mit `pnpm web-test-runner` fahren).
     Erwartet werden drei Fehlschläge in Chromium **und** Firefox, jeder mit einem
     `TypeError` über `id`. Die Ausgabe des roten Laufs gehört in den Report — ohne sie ist
     das Paket nicht fertig.

  2. `VOBufferGeometry#dispose()` (`VOBufferGeometry.ts:56-75`): `super.dispose()` von der
     letzten an die erste Stelle des Rumpfes ziehen, alles Übrige in unveränderter Reihenfolge
     stehen lassen. Darüber ein Kommentar, der die Sache selbst erklärt und nicht den
     Vorzustand — der Test aus »Konventionen« lautet: ergibt der Satz für jemanden Sinn, der
     den Vorzustand nie gesehen hat?

     ```ts
     override dispose(): void {
       // the renderer reads the attributes of this geometry once more while it handles the
       // dispose event, and reaches for the id of a slot before it checks that the slot is
       // filled — so the event goes out while every slot is still there
       super.dispose();

       this.#attachments.detachAll();
       …
     ```

     Der Doc-Block darüber (`:48-55`) bleibt wörtlich stehen: er beschreibt den Endzustand,
     und der ändert sich nicht.

  3. `InstancedVOBufferGeometry#dispose()` (`InstancedVOBufferGeometry.ts:268-307`): dieselbe
     Umstellung, derselbe Kommentar.

  4. Den Doc-Block darüber nachziehen. Sein letzter Satz — »Then `super.dispose()` (the
     `THREE.InstancedBufferGeometry` cleanup) is invoked.« (`:265-267`) — wird durch die
     Umstellung falsch und fällt ersatzlos weg. Die beiden Sätze davor bleiben, sie sprechen
     über den Endzustand.

  5. Kein Eintrag in `packages/twopoint5d/CHANGELOG.md`. Begründet, nicht vergessen: der Wurf
     existiert ausschließlich zwischen `70309b2` (Paket 2) und dem Commit dieses Pakets, beide
     im selben noch unveröffentlichten `Unreleased`-Abschnitt. Ein `Fixed`-Eintrag würde dem
     Leser des kommenden Releases einen Defekt melden, den seine Version nie hatte, und wäre
     genau der Rückblick auf einen Vorzustand, den »Konventionen« ausschließt. Der bestehende
     `Changed`-Eintrag zu beiden `dispose()`-Methoden (`CHANGELOG.md:23`) beschreibt weiterhin
     zutreffend, was die Methoden tun.

  6. Nichts sonst anfassen. Keine Änderung an `web-test-runner.config.js` (`files:
     'test/**/*.test.js'` findet die neue Datei über das Glob), keine an
     `vertex-objects-gpu-upload.test.js`, keine an den Vitest-Specs, keine an `public-api.ts`
     — das Paket führt kein neues Symbol ein.
- Verify: die vier Kommandos aus dem Kopf dieses Plans, vollständig und in dieser Reihenfolge.
  `pnpm test:ci` fährt die Playwright-Suite mit; dort muss die neue Datei auftauchen
  (»Running 7 test files«).
- Commit: `fix(twopoint5d): let a rendered geometry run through dispose()`
- Ergebnis: 1 Runde · beide Fundstellen behoben — `super.dispose()` ist in
  `VOBufferGeometry#dispose()` und `InstancedVOBufferGeometry#dispose()` die erste Anweisung des
  Rumpfes, der Endzustand (leere Slots, `index === null`, freigegebene eigene Pools) bleibt
  unverändert · Regressionstest `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js`
  mit drei Fällen (`a rendered geometry disposes and gives up its slots`, `… taken out of the
  scene …`, `a rendered instanced geometry …`), alle drei vor dem Fix rot mit
  `TypeError: Cannot read properties of undefined (reading 'id')`, in Chromium und Firefox ·
  Verify grün über alle vier Kommandos, ohne Nx-Cache gefahren
  (`<arbeitsdir>/paket-13.verify.log`, exit=0, Vitest 90 Dateien / 1406 Tests, Browsersuite
  7 Dateien) · das Review nennt einen Nebeneffekt, der über das Paketziel hinausgeht:
  `Geometries.onDispose` meldet seinen Listener erst in der letzten Zeile ab, lief also bis
  hierher nie zu Ende — jetzt tut er es, und ein zweites `dispose()` ist ebenfalls harmlos
- klein offen: die drei Testfälle prüfen »wirft nicht« und den Endzustand der Geometry, aber
  nicht den eigentlichen Gewinn — dass die GPU-Buffer jetzt fallen. Ein Test, der die Attribute
  wieder entfernt sieht, bliebe auch dann grün, wenn three den Handler künftig in einem
  `try/catch` schluckt. Zu schließen über `display.renderer.info.memory.geometries`, den der
  Handler in seiner ersten Zeile dekrementiert
  (`packages/twopoint5d-testing/test/vertex-objects-dispose.test.js:83,103,117`).
- Nebenbefunde: keine
- Folgen: eine, als Paket 14 geschnitten —
  `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:191` (Rumpf in
  `#detachRoute`, `:213`): `detachInstancedPool()` nimmt einer lebenden, bereits gerenderten
  Geometry ihre Attribut-Slots, und das spätere `dispose()` läuft danach in denselben
  `.id`-Zugriff, den dieses Paket im Dispose-Pfad geschlossen hat. Die Umstellung von
  `super.dispose()` trägt dort nicht: der Detach-Pfad feuert gar kein Event. Arbeit dieses
  Laufs, nicht vorbestehend — das Abräumen der Slots beim Detach kam mit `db79e61` (Paket 1).
  Vom Reviewer als plausibel gemeldet, nicht im Browser nachgestellt.
- Schnittstellen: keine — das Paket ändert Reihenfolge und Testabdeckung, keine Signatur, kein
  Export, kein neues Symbol.

### [x] 14. Ein Detach nimmt der Geometry einen Attribut-Slot, und `dispose()` läuft trotzdem durch

- Folge von: Paket 13
- Findings: keine Audit-ID — eine Fundstelle aus der Folge von Paket 13
- Ziel: `InstancedVOBufferGeometry#dispose()` läuft auch dann durch, wenn ein früheres
  `detachInstancedPool()` (oder ein `attachInstancedPool()` über einen belegten Namen) einen
  Attribut-Slot geleert hat, den die gebaute Render-Pipeline weiterhin nennt — und der
  Aufräumpfad des Renderers kommt dabei zu Ende, statt in der Mitte zu sterben.
- Bereich: `packages/twopoint5d/src/vertex-objects/`, Regressionstest in
  `packages/twopoint5d-testing/test/`
- Hängt ab von: 13 — erledigt (`4465fbc`). Dessen Umstellung von `super.dispose()` bleibt
  bestehen und ist die Voraussetzung: der Slot wird für genau diesen ersten Aufruf gefüllt.
- Hash: 593aa6c
- Modell: opus
- Effort: medium
- Severity: **medium**, in Zug 0 festgelegt. Der Wurf ist derselbe `TypeError` wie in Paket 13
  und tritt ohne Umweg ein, sobald die beiden Bedingungen unten zusammenkommen — insofern kein
  `low`. Kein `high` wie in Paket 13: dort lag der Auslöser im dokumentierten Standardpfad
  (`TexturedSprites#dispose()` → `geometry.dispose()`, den jeder Consumer geht), hier braucht es
  einen ausdrücklichen Aufruf von `detachInstancedPool()` oder ein `attachInstancedPool()` über
  einen belegten Namen. Nachgesehen: im ganzen Repo ruft das niemand außer den Specs — kein
  Lookbook, kein `sprites/`, kein `map2d/`. Es ist öffentliche, im `Unreleased`-Abschnitt des
  CHANGELOG beschriebene API, also von außen erreichbar, aber nicht auf dem breiten Weg.
- Fundstelle: `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:191`
  (`detachInstancedPool()`) und `:146` (`attachInstancedPool()` über einen belegten Namen),
  gemeinsamer Rumpf in `#detachRoute` (`:202`), das Räumen in `#releaseSlots` (`:244`) →
  `GeometryAttributeSlots#releaseRoute` (`GeometryAttributeSlots.ts:65`), dort
  `geometry.deleteAttribute(attrName)` (`:79`).

#### Abgleich und Messung (Zug 0, 2026-09-03)

Der Befund stand als plausibel im Plan, nicht als belegt. Er ist jetzt belegt, und er reicht
weiter als die Meldung des Reviewers. Gemessen über eine Wegwerf-Datei in der Browsersuite
(`web-test-runner --files …`, Chromium **und** Firefox, in jeder Zeile identisches Ergebnis;
Chromium fällt dabei auf das WebGL2-Backend zurück, Firefox fährt WebGPU — der Wurf liegt in
`RenderObject.getAttributes()` und damit oberhalb beider Backends). Aufbau je Fall:
`InstancedVertexObjectGeometry` mit `basePool` (`position`), `instancedPool` (`instanceOffset`)
und einem über `attachInstancedPool('extra', …)` angehängten Pool (`extraOffset`), ein
`MeshBasicNodeMaterial`, dessen `positionNode` die genannten Attribute liest, einmal gerendert.

| Fall | Ergebnis |
| --- | --- |
| gerendert · Shader liest `extraOffset` · `detachInstancedPool('extra')` · `dispose()` | `TypeError … 'id'` |
| **nie gerendert** · detach · `dispose()` | läuft durch |
| gerendert · Shader liest `extraOffset` · detach · **erneut rendern** | `TypeError … 'id'` schon im Render |
| gerendert · Shader liest `extraOffset` **nicht** · detach · erneut rendern · `dispose()` | läuft durch |
| gerendert · `attachInstancedPool('extra', …)` mit einem anderen Attributnamen · `dispose()` | `TypeError … 'id'` |
| gerendert · detach · `dispose()` zweimal | beide Male `TypeError … 'id'` |

Zwei Bedingungen müssen zusammenkommen: die Geometry war mindestens einmal gerendert, **und**
die für sie gebaute Pipeline nennt den geräumten Attributnamen. Die vierte Zeile isoliert das:
liest der Shader das Attribut nicht, ist der ganze Vorgang harmlos, bis hin zum Weiterrendern.

Die dritte Zeile ist der Teil, den die Meldung des Reviewers nicht hatte: **auch der nächste
`render()` wirft**, nicht erst das spätere `dispose()`. Das ist kein Defekt dieser Bibliothek
und wird hier auch nicht behoben — ein Shader, der ein Attribut liest, das seine Geometry nicht
mehr trägt, kann nicht rendern, und das Material gehört dem Aufrufer. Was fehlt, ist die
Ansage; sie kommt in die JSDoc von `detachInstancedPool()` (Schritt 5).

Vorbestehend? Nein. Das Räumen der Slots beim Detach kam mit `db79e61` (Paket 1) und wurde in
`34ce3e3` (Paket 7) zu `#releaseSlots()` gefasst; `git show 60f7612:…/InstancedVOBufferGeometry.ts`
zeigt ein `detachInstancedPool()`, das die Attribute stehen lässt. Eigener Schaden dieses Laufs.

#### Der Weg, und der Weg, der es nicht wurde

Erst gemessen, dann entschieden. Der naheliegende Griff — beim Detach das `dispose`-Event der
Geometry feuern, solange die Slots noch vollständig sind — behebt den Wurf (gemessen: läuft
durch), reißt aber ein stilles Loch auf. `Geometries.initGeometry` (`three@0.183.1`,
`three.webgpu.js:30627`) setzt `geometryData.initialized = true`, und `onDispose` setzt es nicht
zurück; `has()` (`:30600`) fragt genau dieses Flag ab. Nach einem gefeuerten Event ruft
`updateForRender` also nie wieder `initGeometry`, der Listener bleibt abgemeldet, und jeder
GPU-Buffer, den ein späterer Frame anlegt, wird nie mehr freigegeben. Gemessen an
`renderer.info.memory.geometries`: der Zähler fällt beim Event und steigt beim nächsten Render
nicht wieder. Ein lauter Wurf gegen ein leises Leck zu tauschen ist kein Fortschritt.

**Entschieden ist deshalb: der Slot wird für die Dauer des `dispose`-Events wieder gefüllt, und
zwar mit genau dem `THREE.BufferAttribute`, das ihn verlassen hat.** Der Renderer findet sein
Attribut, `Geometries.onDispose` läuft zu Ende und gibt den GPU-Buffer frei, und der Slot ist
leer, bevor `dispose()` zurückkehrt. Gemessen gegen die Referenz ohne jeden Detach: in beiden
Fällen fällt `renderer.info.memory.geometries` um genau eins, der Endzustand ist
`Object.keys(geometry.attributes) === []` und `geometry.index === null`, und ein zweites
`dispose()` läuft ebenfalls durch.

Warum das originale Attribut und kein frischer Platzhalter: `onDispose` löscht seinen
Buffer-Eintrag am Attribut-Objekt (`this.attributes.delete(geometryAttribute)`). Ein Platzhalter
hätte dort keinen Eintrag, und der GPU-Buffer des geräumten Attributs bliebe liegen — der Fix
gäbe dann weniger frei als das `dispose()` einer nie detachten Geometry.

Der Preis, offen benannt: zwischen `detachInstancedPool()` und `dispose()` hält die Geometry in
einer privaten Map eine Referenz auf ein `THREE.BufferAttribute` und damit auf das TypedArray des
detachten Pools. Die Zusage aus Paket 1 und 7 bleibt gewahrt — sie lautet, dass die Geometry das
Attribut nicht mehr **zeigt**, damit kein Renderpfad aus einem Array liest, das ein `resize()`
inzwischen ausgetauscht hat. Ein Attribut, das in keinem Slot steht, wird von nichts gelesen; der
Pool darf resizen, und das alte Array wird beim `dispose()` der Geometry losgelassen. Schritt 4
verkürzt die Haltezeit zusätzlich auf das Nötige.

#### Dateien

- `packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts`
- `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
- `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
- `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js` (bestehend, aus Paket 13)
- `packages/twopoint5d/CHANGELOG.md`

#### Vorgehen

1. **Zuerst der Regressionstest, und zwar rot.** Er kommt in die bestehende Datei
   `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js` — dieselbe Datei, dasselbe
   Thema, und ihre Helfer (`makeContainer`, `disposeDisplay`, `quadDescription`,
   `instancedDescription`, `renderOnce`, die `beforeEach`/`afterEach`-Hooks) stehen bereits. Keine
   neue Datei. Ergänzt werden auf Modulebene eine dritte Beschreibung und im `describe`-Block
   zwei Fälle:

   ```js
   const extraInstancedDescription = {
     meshCount: 1,
     attributes: {extraOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
   };
   ```

   ```js
   /** A geometry with a third route, and a material whose shader reads all three attributes. */
   function makeGeometryWithExtraRoute() {
     const geometry = new InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1);
     const extraPool = geometry.attachInstancedPool('extra', extraInstancedDescription);
     const material = new MeshBasicNodeMaterial();
     material.positionNode = attribute('position', 'vec3')
       .add(attribute('instanceOffset', 'vec3'))
       .add(attribute('extraOffset', 'vec3'));
     geometry.basePool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
     geometry.instancedPool.createVO().setInstanceOffset([1, 1, 1]);
     extraPool.createVO().setExtraOffset([0, 0, 0]);
     return {geometry, material};
   }

   it('a rendered geometry disposes after one of its routes was detached', async function () {
     const {geometry, material} = makeGeometryWithExtraRoute();
     await renderOnce(new VertexObjects(geometry, material));

     geometry.detachInstancedPool('extra');
     expect(geometry.getAttribute('extraOffset'), 'the detached route gives up its slot').to.be.undefined;

     const geometriesBefore = display.renderer.info.memory.geometries;
     expect(() => geometry.dispose()).to.not.throw();

     // the renderer got all the way through its cleanup, which is what frees the gpu buffers
     expect(display.renderer.info.memory.geometries).to.equal(geometriesBefore - 1);
     expect(Object.keys(geometry.attributes)).to.deep.equal([]);
     expect(geometry.index).to.be.null;
   });

   it('a rendered geometry disposes after a route was replaced by one with other attributes', async function () {
     const {geometry, material} = makeGeometryWithExtraRoute();
     await renderOnce(new VertexObjects(geometry, material));

     geometry.attachInstancedPool('extra', {
       meshCount: 1,
       attributes: {someOtherOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
     });
     expect(geometry.getAttribute('extraOffset'), 'the replaced route gives up its slot').to.be.undefined;

     const geometriesBefore = display.renderer.info.memory.geometries;
     expect(() => geometry.dispose()).to.not.throw();

     expect(display.renderer.info.memory.geometries).to.equal(geometriesBefore - 1);
     expect(Object.keys(geometry.attributes)).to.deep.equal([]);
     expect(geometry.index).to.be.null;
   });
   ```

   Die Zeile mit `info.memory.geometries` ist Absicht und nicht Beiwerk: sie ist der einzige
   Nachweis, dass der Aufräumpfad des Renderers zu Ende läuft, statt nur nicht zu werfen. Ein
   Test, der ausschließlich »wirft nicht« prüft, bliebe auch dann grün, wenn der Wurf irgendwo
   geschluckt und der GPU-Buffer verloren würde. Die drei Fälle, die Paket 13 in dieser Datei
   angelegt hat, bleiben unverändert — sie gehören einem committeten Paket.

   `MeshBasicNodeMaterial` und `attribute` sind in der Datei bereits importiert; `expect`,
   `Display`, `InstancedVertexObjectGeometry` und `VertexObjects` ebenfalls.

   Der rote Lauf, bevor eine Zeile am Fix steht:
   `cd packages/twopoint5d-testing && pnpm web-test-runner --files 'test/vertex-objects-dispose.test.js'`.
   Erwartet werden **zwei** Fehlschläge in Chromium und Firefox, jeder mit einem `TypeError` über
   `id`; die drei Fälle aus Paket 13 bleiben grün. Die Ausgabe des roten Laufs gehört in den
   Report — ohne sie ist das Paket nicht fertig.

2. **`GeometryAttributeSlots.ts`: `releaseRoute()` sagt, was einen Slot verlassen hat.** Heute
   gibt die Methode nur Namen zurück; der Aufrufer kann daraus nicht ablesen, ob der Slot leer
   ist oder an eine darunterliegende Route zurückgefallen ist, und das Attribut selbst hat sie
   ohnehin gerade in der Hand. Neuer exportierter Typ und neuer Rückgabetyp:

   ```ts
   /** What a released route left behind in one attribute slot. */
   export type ReleasedSlot = {
     attrName: string;
     /**
      * The attribute that left the slot, and only set when no claim was left underneath: the
      * slot is empty now. A slot that fell back to another route is filled and names nothing.
      */
     vacated?: BufferAttribute | InterleavedBufferAttribute;
   };
   ```

   Im Rumpf von `releaseRoute()` wird aus `claims.splice(held, 1)` das entfernte Element
   festgehalten und in den beiden Zweigen unterschieden:

   ```ts
   const [released] = claims.splice(held, 1);
   if (!wasOnTop) continue;

   if (claims.length === 0) {
     geometry.deleteAttribute(attrName);
     // deleting the entry the Map iteration is currently on is allowed
     this.#slots.delete(attrName);
     changed.push({attrName, vacated: released.attr});
   } else {
     geometry.setAttribute(attrName, claims[claims.length - 1].attr);
     changed.push({attrName});
   }
   ```

   `changed` wird zu `ReleasedSlot[]`. Der `@returns` des Doc-Blocks wird nachgezogen: er sagt
   dann, dass ein Slot, der jetzt leer ist, das Attribut nennt, das ihn verlassen hat. Der Rest
   des Doc-Blocks bleibt wörtlich stehen — er beschreibt das Verhalten, und das ändert sich nicht.
   Der Typ wird nicht in eine `public-api.ts` aufgenommen: `GeometryAttributeSlots` steht dort
   nicht und bleibt intern.

3. **`VOBufferGeometry.ts`: eine Zeile nachziehen.** `#releaseSlots()` (`:81`) iteriert jetzt über
   Objekte:

   ```ts
   for (const {attrName} of this.#slots.releaseRoute(this, route)) {
   ```

   Sonst nichts. `VOBufferGeometry` kennt keinen Detach zur Laufzeit — sie räumt ihre Slots
   ausschließlich in `dispose()`, und dort erledigt die Umstellung aus Paket 13 den Fall. Die
   Buchhaltung aus Schritt 4 wird hier **nicht** nachgebaut; sie hätte nichts zu tun.

4. **`InstancedVOBufferGeometry.ts`: die geräumten Slots merken und beim Dispose ausleihen.**
   Vier Eingriffe, alle in dieser Datei.

   a) Ein privates Feld, bei den anderen `#`-Feldern (`:39-42`):

   ```ts
   /**
    * The attributes that a detached route left behind in slots nothing else fills. The renderer
    * keeps naming them for as long as it holds a pipeline built for this geometry, so `dispose()`
    * lends them back to their slots for the length of the dispose event.
    */
   readonly #vacatedSlots: Map<string, BufferAttribute | InterleavedBufferAttribute> = new Map();
   ```

   b) `#releaseSlots()` (`:244`) reicht durch, was es erfährt, statt es zu verwerfen:

   ```ts
   #releaseSlots(route: AttributeRoute): ReleasedSlot[] {
     const released = this.#slots.releaseRoute(this, route);
     for (const {attrName} of released) {
       // the slot has changed hands; the version #syncAttributeArrays compares against
       // belongs to the attribute that left
       this.#serials.delete(attrName);
     }
     return released;
   }
   ```

   Der einzeilige Doc-Kommentar darüber bleibt.

   c) `#detachRoute()` (`:213-215`) sammelt ein, was leer zurückbleibt:

   ```ts
   if (buffers != null) {
     for (const {attrName, vacated} of this.#releaseSlots(buffers)) {
       if (vacated != null) {
         this.#vacatedSlots.set(attrName, vacated);
       }
     }
   }
   ```

   Die drei Aufrufe von `#releaseSlots()` in `dispose()` bleiben, wie sie sind — ihr Rückgabewert
   wird dort nicht gebraucht, der Slot ist nach `super.dispose()` geräumt und damit außerhalb der
   Gefahr.

   d) `attachInstancedPool()`, unmittelbar nach `initializeInstancedAttributes(…)` (`:163`):

   ```ts
   // a name that is filled again needs no stand-in, and the entry would keep the typed arrays
   // of a pool this geometry has let go of alive until dispose()
   for (const attrName of this.#vacatedSlots.keys()) {
     if (this.getAttribute(attrName) !== undefined) {
       this.#vacatedSlots.delete(attrName);
     }
   }
   ```

   Das ist Hygiene, keine Korrektheitsbedingung — Schritt 5 prüft die Belegung ohnehin noch
   einmal. Es steht trotzdem hier, weil es eine Referenz genau dann fallen lässt, wenn sie
   sinnlos wird.

5. **`InstancedVOBufferGeometry#dispose()` (`:267`): den Slot für das Event ausleihen.** Der
   Rumpf beginnt vor `super.dispose()` und räumt danach wieder auf; alles ab
   `this.#attachments.detachAll()` bleibt unverändert stehen.

   ```ts
   override dispose(): void {
     // the renderer reads the attributes of this geometry once more while it handles the
     // dispose event, and reaches for the id of a slot before it checks that the slot is
     // filled — so the event goes out while every slot is there. A slot that a detached route
     // vacated is empty, and the attribute that left it goes back in for that one moment: the
     // renderer then finds what it names, frees its gpu buffer and finishes its bookkeeping.
     const lent: string[] = [];
     for (const [attrName, attr] of this.#vacatedSlots) {
       if (this.getAttribute(attrName) === undefined) {
         this.setAttribute(attrName, attr);
         lent.push(attrName);
       }
     }

     try {
       super.dispose();
     } finally {
       for (const attrName of lent) {
         this.deleteAttribute(attrName);
       }
       this.#vacatedSlots.clear();
     }

     // the geometry is gone either way, so every pool it held gives up its attachment
     this.#attachments.detachAll();
     …
   ```

   Das `finally` schluckt nichts — es stellt sicher, dass ein geliehener Slot auch dann leer
   zurückbleibt, wenn `super.dispose()` aus einem anderen Grund wirft. Ohne es hielte die
   Geometry danach ein Attribut, das auf die Arrays eines längst detachten Pools zeigt, und genau
   das schließen Paket 1 und 7 aus.

   Der Doc-Block über `dispose()` (`:252-266`) bekommt einen Satz am Ende des Absatzes über die
   Attribute — er beschreibt den Endzustand und nicht den Vorzustand:
   »A slot that an earlier `detachInstancedPool()` left empty is empty again when this returns.«

6. **JSDoc von `detachInstancedPool()` (`:172-189`) um die Grenze ergänzen**, die die Messung
   sichtbar gemacht hat. Ein Absatz vor dem `@returns`:

   ```
    * The attributes this route put on the geometry are gone afterwards. A material whose shader
    * still reads one of them cannot render this geometry any more — give the geometry a material
    * that matches the routes it has left, or take it out of the scene. Disposing it goes through
    * either way.
   ```

7. **`packages/twopoint5d/CHANGELOG.md`: ein Satz an den bestehenden `Changed`-Eintrag** zu
   `detachInstancedPool()` (`CHANGELOG.md:24`, im `Unreleased`-Abschnitt), am Ende der Zeile:

   »A material whose shader still reads an attribute of the detached route cannot render the
   geometry any more; disposing it goes through.«

   **Kein `Fixed`-Eintrag**, und das ist begründet und nicht vergessen: der Wurf existiert
   ausschließlich zwischen `db79e61` (Paket 1, das die Slots beim Detach zu räumen begann) und dem
   Commit dieses Pakets, beide im selben noch unveröffentlichten `Unreleased`-Abschnitt. Ein
   `Fixed`-Eintrag meldete dem Leser des kommenden Releases einen Defekt, den seine Version nie
   hatte — derselbe Grund, aus dem Paket 13 keinen geschrieben hat. Der ergänzte Satz dagegen
   beschreibt Verhalten, das in dieser Version ankommt.

8. **Nichts sonst anfassen.** Keine neue Testdatei, keine Änderung an
   `web-test-runner.config.js`, keine an `vertex-objects-gpu-upload.test.js`, keine an den drei
   Fällen, die Paket 13 angelegt hat, keine an den Vitest-Specs (sie rendern nicht und sehen
   diesen Fall nicht; sie müssen grün bleiben), keine an einer `public-api.ts` — das Paket führt
   kein öffentliches Symbol ein.

- Verify: die vier Kommandos aus dem Kopf dieses Plans, vollständig und in dieser Reihenfolge.
  `pnpm test:ci` fährt die Playwright-Suite mit (»Running 7 test files«).
- Commit: `fix(twopoint5d): let a geometry dispose after one of its routes was detached`
- Kettenlänge: die Kette lautet Paket 2 (aus dem Audit) → Paket 13 → Paket 14, dieses Paket ist
  also die zweite Generation. Wirft es selbst eine Folge, ist die dritte erreicht, und dann
  entscheidet nicht mehr der Runner, sondern der Nutzer: dann ist nicht die Fundstelle das
  Problem, sondern der Weg, den das Räumen der Slots eingeschlagen hat.
- Ergebnis: 2 Runden · der Wurf beim `dispose()` einer gerenderten Geometry, der ein Detach
  einen Attribut-Slot genommen hat, ist behoben — der Slot wird für die Dauer des
  `dispose`-Events mit dem originalen `THREE.BufferAttribute` gefüllt und danach im `finally`
  geleert · Regressionstests `a rendered geometry disposes after one of its routes was detached`
  und `a rendered geometry disposes after a route was replaced by one with other attributes`
  (beide vor dem Fix rot, je mit `TypeError … 'id'`, in Chromium und Firefox) · Review Runde 1:
  2 `wichtig`, 2 `klein`, alle vier in einer Runde erledigt, Nachreview ohne neuen Befund ·
  Verify zweimal grün, der zweite Lauf ohne Nx-Cache
- Nebenbefunde: → Queue
- Folgen: der Ausleih-Mechanismus deckt nur Slots, die **leer** zurückbleiben. Ein Slot, der
  beim Detach an eine darunterliegende Claim zurückfällt, lässt den GPU-Buffer des Attributs
  liegen, das zur Renderzeit tatsächlich auf der GPU lag —
  `packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts:92-95` (`else`-Zweig ohne
  `vacated`) und `InstancedVOBufferGeometry.ts:174-178` (Hygieneschleife). In Zug 4 gemessen
  und belegt, → **Paket 15**
- Schnittstellen:
  - `GeometryAttributeSlots#releaseRoute(geometry, route)` liefert `ReleasedSlot[]` statt
    `string[]`. `export type ReleasedSlot = {attrName: string; vacated?: BufferAttribute |
    InterleavedBufferAttribute}` — `vacated` ist genau dann gesetzt, wenn kein Anspruch mehr
    unter dem Slot lag, der Slot also leer ist, und nennt dann das Attribut, das ihn verlassen
    hat. Modul und Typ bleiben intern, in keiner `public-api.ts`.
  - `InstancedVOBufferGeometry#dispose()` füllt einen Slot, den ein früheres
    `detachInstancedPool()` geleert hat, für die Dauer des `dispose`-Events wieder und leert ihn
    danach. Der Endzustand ist unverändert der aus Paket 2 und 13: keine Attribute, `index` auf
    `null`, ein zweites `dispose()` folgenlos.
  - Dokumentierte Grenze an `detachInstancedPool()` und im CHANGELOG: ein Material, dessen
    Shader ein Attribut der abgebauten Route liest, kann die Geometry nicht mehr rendern; das
    `dispose()` läuft trotzdem durch.

### [x] 15. Ein Slot, der beim Detach an eine andere Route zurückfällt, gibt seinen GPU-Buffer frei

> **Entfallen (2026-09-03), nicht umgesetzt.** Auf Entscheidung des Nutzers als neues
> Finding in die `audit.html` übernommen statt in diesem Lauf behoben — siehe
> »Entscheidungen«. Die Messung unten bleibt stehen: sie ist die Vorarbeit, auf der
> ein eigener Lauf aufsetzt.

- Folge von: Paket 14 · die Ursache selbst stammt aus Paket 1 (`db79e61`), das begann, Slots
  beim Detach zu räumen, und aus Paket 7 (`34ce3e3`), das den Anspruchsstapel eingeführt hat
- Findings: keine Audit-ID — in Zug 4 von Paket 14 gemessen und belegt
- Ziel: das `dispose()` einer Geometry gibt den GPU-Buffer jedes Attributs frei, das für sie je
  auf der GPU lag — auch der Attribute, die ein Detach oder ein erneutes Attach aus ihrem Slot
  verdrängt hat, ohne ihn leer zurückzulassen.
- Bereich: `packages/twopoint5d/src/vertex-objects/`, Regressionstest in
  `packages/twopoint5d-testing/test/`
- Hängt ab von: 14 — erledigt (`593aa6c`). Dessen Ausleih-Mechanismus bleibt bestehen; dieses
  Paket erweitert ihn oder ersetzt ihn, siehe die Frage unten.
- Hash: —
- Modell: opus
- Severity: **medium**. Ein stilles Leck, kein Wurf: `dispose()` läuft durch, die Geometry ist
  intakt, und der Buffer hängt am Backend, wo kein GC ihn erreicht. Es braucht zwei Routen, die
  denselben Attributnamen deklarieren — im Repo tut das heute niemand außer der Messung, seit
  Paket 7 ist es aber ausdrücklich erlaubt und in der Doku beschrieben.
- Fundstelle: `packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts:92-95` — der
  `else`-Zweig von `releaseRoute()` stellt das Attribut der Claim darunter in den Slot und meldet
  `{attrName}` ohne `vacated` · `InstancedVOBufferGeometry.ts:174-178` — die Hygieneschleife in
  `attachInstancedPool()` verwirft den `#vacatedSlots`-Eintrag, sobald derselbe Attributname
  wieder belegt ist.

#### Die Messung, die es belegt (Zug 4 von Paket 14, 2026-09-03)

Maß ist `renderer._attributes.has(attr)` — die `Attributes`-DataMap des Renderers
(`three@0.183.1`, `three.webgpu.js:30346`). Ein Eintrag entsteht ausschließlich über
`Attributes.update()` → `backend.createAttribute()` und verschwindet ausschließlich über
`Attributes.delete()`, wo `backend.destroyAttribute()` steht. Er belegt damit, ob
`destroyAttribute()` für dieses Attribut je gelaufen ist; er belegt nicht die Bytegröße des
liegengebliebenen Buffers. `info.memory.buffers` gibt es im WebGPU-Renderer nicht, und
`info.memory.geometries` taugt hier nicht — der Zähler fällt als erste Anweisung von
`Geometries.onDispose`, also auch dann, wenn der Handler danach stirbt. Chromium (WebGL2-Fallback)
und Firefox (WebGPU) liefern Zeile für Zeile dasselbe.

| Aufbau | Ergebnis |
| --- | --- |
| zwei Routen auf denselben Attributnamen, gerendert, obere detached, `dispose()` | oberes Attribut bleibt beim Renderer (`true`), unteres wird freigegeben |
| dieselbe Referenz **ohne** Detach | oberes Attribut nach `dispose()` freigegeben (`false`) |
| `attachInstancedPool()` über den belegten Namen, gleicher Attributname | altes Attribut bleibt beim Renderer |
| drei Routen auf denselben Namen, nach jedem Attach gerendert, zwei detached | zwei von drei bleiben liegen |

Die letzte Zeile ist die wichtige: **die Zahl der verwaisten Attribute wächst linear** mit der
Zahl der Routen, die unter demselben Namen je gerendert wurden. Der Ausleih-Mechanismus aus
Paket 14 trägt je Attributname genau ein Attribut und kann den Fall deshalb nicht abdecken —
`getAttributes()` löst einen Namen je Durchlauf einmal auf, und ein `dispose`-Event gibt es
genau eins.

#### Was Zug 0 als Erstes zu tun hat

**Diese Frage gehört dem Nutzer, und Zug 0 ist der einzige Zug, der ihn erreicht.** Der
Detailplan von Paket 14 hat sie vorweggenommen: die Kette lautet Paket 1/7 → 13 → 14 → hier, und
ab der dritten Runde am selben Problem ist nicht mehr die Fundstelle die Frage, sondern der Weg,
den das Räumen der Slots eingeschlagen hat. Zug 0 legt die Wahl vor, statt sie zu treffen:

1. **Den Ausleih-Weg erweitern.** `#vacatedSlots` führt je Attributname eine Menge statt eines
   Eintrags, und `dispose()` schickt die Attribute nacheinander durchs Event. Ob das überhaupt
   geht, ist offen — `Geometries.onDispose` meldet seinen Listener beim ersten Durchlauf ab, und
   `initialized` wird nie zurückgesetzt. Zug 0 misst das, bevor er es vorschlägt.
2. **Den Buffer beim Detach freigeben, direkt statt über das Event.** Der Renderer bietet dafür
   keine öffentliche Tür; `renderer._attributes` ist intern, und Paket 14 hat es nur als Messmaß
   benutzt, nicht als API.
3. **Die Ursache umkehren: beim Detach die Slots gar nicht mehr räumen**, sondern den Besitz
   anders führen. Das nimmt die Zusage aus Paket 1 und 7 zurück und ist der teuerste Weg.
4. **Nicht beheben, sondern benennen.** Der Pfad braucht zwei Routen auf demselben
   Attributnamen, und niemand im Repo geht ihn. Ein Satz in der JSDoc von
   `attachInstancedPool()`, ein Eintrag im CHANGELOG, Paket entfällt.

Zug 0 misst zuerst und legt dann vor. Ohne Messung ist Weg 1 eine Vermutung, und dieser Lauf hat
zweimal gezeigt, dass die Messung an dieser Stelle das Gegenteil dessen ergibt, was die Quelle
nahelegt.

- Verify: die vier Kommandos aus dem Kopf dieses Plans, vollständig und in dieser Reihenfolge.
- Commit: steht nach Zug 0 fest — er hängt am gewählten Weg.
