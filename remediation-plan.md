# Remediation-Plan — @spearwolf/twopoint5d

Quelle: ./audit.html vom 2026-09-19 (nachgeführt 2026-09-20) · Branch: main · erstellt: 2026-09-20
Baseline: `pnpm lint` ✓ · `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm checkPkgTypes` ✓ ·
`pnpm checkNameableTypes` ✓ · `pnpm lintPkg` ✓ · `pnpm test:scripts` ✓ · `pnpm test:ci` ✓ ·
`pnpm test:browser` (aus dem Nx-Cache bedient, nicht gemessen — siehe »Vorbestehende Fehler«)
— acht Gates gemessen und grün, das neunte ungeprüft
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/3cf004c7-23ef-47c6-9f89-8290ceb5b5be/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 12 von 138 Findings (5 medium, 4 low, 3 info) · ausgenommen: alles außerhalb des vertex-objects-Moduls
Scope-Regel: alles, was im Modul `packages/twopoint5d/src/vertex-objects/` liegt, jede Severity — auch info. Gilt auch für Befunde, die erst im Lauf auffallen.
Kaltstarts: 7 Pakete × mindestens 3 Agenten ≈ 21, je Nachrunde zwei mehr · die zwei letzten
Pakete tragen keine Audit-Findings, sondern die 12 Queue-Einträge der Drain-Runde
Stand (2026-09-20): Lauf abgeschlossen. 8 Pakete committet — 1 (9e66de55), 1b (bdbb5ec1),
2 (93ccb86c), 3 (48c92657), 3b (bb13c61f), 4 (853e5948), 5 (663070ec), 6 (07277e2d). Kein
Paket blockiert, kein Paket mit nachzuziehendem Review. Die Drain-Runde lief zweimal: 22
Befunde wurden zu den Paketen 4, 5 und 6, 15 gingen als Findings ins Audit zurück — die
letzten fünf davon, weil eine dritte Runde nach der Regel des Skills entfällt. Das
Abschluss-Verify lief cache-frei und grün. Der Report steht in
docs/remediation/20260920-vertex-objects-remediation-report.md.

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` blockiert.

## Entscheidungen

- **`meshCount` wird ersatzlos gestrichen** (2026-09-20). Das Feld verlässt
  `VertexObjectDescription`, `meshPerAttribute` steht fest auf `1`,
  `VertexObjectDescriptor#meshCount` und `getInstanceCount()` entfallen, der
  Absatz über ein abweichendes `meshCount` im TSDoc von `attachInstancedPool()`
  entfällt. Damit sind die drei widersprüchlichen Lesarten — Faktor in
  `initializeInstancedAttributes`, kein Faktor in `update()`, Division in
  `getInstanceCount()` — gegenstandslos. Kein produktiver Descriptor nutzt das
  Feld; die Spec-Fixtures mit `meshCount: 2` werden mit umgestellt. Breaking
  Change, gehört ins CHANGELOG.
- **Die Schichtgrenze wird dokumentiert, nicht umbenannt** (2026-09-20).
  `VO*` bleibt die rohe Buffer-Schicht, `VertexObject*` die typisierte
  Objektschicht; die Regel wird in `architecture.md` verbindlich festgehalten
  und in den TSDocs der betroffenen Klassen benannt. Umbenannt werden nur die
  Singular/Plural-Schiefstände in `sprites` (`TexturedSpritePool` →
  `TexturedSpritesPool`, `TexturedSpriteGeometryParameters` →
  `TexturedSpritesGeometryParameters`), mit deprecated Aliasen für ein Release.
  `map2d/public-api.ts` wechselt auf `export type *`.
- **Die Description gilt nach dem Bau des Descriptors als eingefroren**
  (2026-09-20). Der Konstruktor kopiert oder friert ein, damit spätere
  Änderungen die Konstruktor-Prüfungen nicht umgehen können.
- **Ein generierter Accessor darf keine Property des `basePrototype`
  überschatten** (2026-09-20). Die Namen des `basePrototype` — eigene und
  geerbte — kommen in die Eindeutigkeitsprüfung des Descriptors; eine Kollision
  wirft, wie eine Kollision unter `methods`.
- **PERF-020 wird im vollen Umfang umgesetzt** (2026-09-20), nicht nur der
  kleine Teil: Dirty-Ranges pro Objekt statt eines Serials pro Buffer. Der
  Nutzer hat hoch performante Vertex Objects als Ziel des Laufs benannt.
- **`IMPL-001` wird nur mit seinem vertex-objects-Teil behoben**
  (2026-09-20) — dem `// TODO add optional attributeName?` in `types.ts:46`.
  Seine fünf weiteren Marker liegen in `texture`, `display`, `map2d` und
  `stage` und bleiben außerhalb des Scopes; das Finding bleibt im Audit offen
  und wird beim Abschluss nicht geschlossen, sondern mit diesem Vermerk
  fortgeschrieben.
- **Ein Verify gilt als grün, wenn Chromium durchläuft** (2026-09-20). Bricht
  `pnpm test:browser` allein auf Firefox mit »Tests were interrupted because the
  browser disconnected« oder »Session … is already stopped« ab, ist das
  vorbestehende Flakiness und blockiert keinen Commit. Der Befund gehört dann
  unter »Vorbestehende Fehler« notiert, nicht in eine weitere Runde der
  Fehlerkette. Schlägt ein Browsertest auf Chromium fehl oder wirft Firefox
  einen fachlichen Fehler statt eines Verbindungsabbruchs, gilt das Gate als rot.

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

Projektspezifisch, aus `AGENTS.md`:

- **Code, Kommentare und Dokumentation sind Englisch.** Commit-Messages folgen
  [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
- **Relative Imports tragen den `.js`-Suffix** (NodeNext), Typen kommen über
  `import type` — der Lint erzwingt es.
- **Ein neues öffentliches Symbol ist erst veröffentlicht, wenn es in der
  `public-api.ts` seines Moduls steht**, die `src/index.ts` re-exportiert.
- **Zwei Testflächen.** `*.spec.ts` neben der Quelle (Vitest, Logik) und
  `*.test.js` in `packages/twopoint5d-testing/test/` (echte Browser,
  visuell/WebGL). Eine Änderung an Rendering- oder GPU-Buffer-Code braucht
  beide — das betrifft in diesem Lauf vor allem Paket 3.
- **`dispose()` und Ownership** folgen
  `packages/twopoint5d/docs/resource-lifecycle.md`. Bindend, nicht beratend.
- **Das CHANGELOG** ist `packages/twopoint5d/CHANGELOG.md`, Keep a Changelog
  1.1.0 unter `## [Unreleased]`. Der Skill `updating-changelog` trägt die
  Regeln; ein Breaking Change braucht dort einen Migrationshinweis.
- **Verify-Gate** ist `pnpm run ci`. Eine einzelne Vitest-Datei läuft über
  `pnpm nx test twopoint5d -- src/path/to/file.spec.ts`.

## Vorbestehende Fehler

- `packages/twopoint5d-testing/test/display-adopt-renderer.test.js` und
  `display-dispose.test.js` — brechen auf Firefox mit »browser disconnected« und
  »Session … is already stopped« ab, während Chromium durchläuft. Kein Teil des
  Scopes; das Audit führt die Flakiness der Browser-Suite als eigenes Finding.
  Die Baseline dieses Laufs hat `pnpm test:browser` nicht gemessen: Nx bediente
  den Aufruf aus dem Cache (`2/2 hit`), sodass die Zeile »alle neun grün« im Kopf
  für dieses eine Gate auf einem früheren Lauf beruht. Wer hier ein rotes
  `test:browser` sieht, prüft zuerst, ob nur Firefox die Verbindung verloren hat
  — die Entscheidung oben sagt, was dann gilt.
- `pnpm nx test twopoint5d -- src/path/to/file.spec.ts` endet mit `ELIFECYCLE` und rotem
  Exit-Code, auch wenn jeder Test der Datei grün ist: das `test`-Script läuft mit
  `--coverage`, und über eine einzelne Datei reißen die globalen Schwellen. Wer einen
  Einzeldateilauf beurteilt, liest die Testzeilen, nicht den Exit-Code — für das Urteil über
  ein Paket zählt ohnehin nur `pnpm run ci`.
- Die übrigen acht Gates der Baseline sind gemessen und grün.

## Offene Befunde

Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

Die Drain-Runde des Abschlusses lief zweimal (Paket 4/5 und Paket 6). Die
Befunde, die Paket 6 selbst erzeugt hat, hätten eine dritte Runde verlangt;
die Regel des Skills setzt dort die Grenze: liefert dieselbe Fläche über zwei
Runden hinweg nach, ist ein zweiter Lauf ohne eigene Planung im Gang. Ihr
Urteil ist deshalb auf `→ Audit` gesetzt, und der Report schlägt für das Modul
einen eigenen Lauf vor.

- [x] `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:84, 91`
  — in `createVertexObjectPrototype()` verschattet die lokale
  `const methods: unknown[]` der `flatMap`-Callback die äußere `const {methods} =
  descriptor` aus Zeile 84; `if (methods)` auf Zeile 147 meint die äußere, und wer
  die Funktion von oben liest, hält zwei verschiedene Dinge für eines. Läuft
  korrekt, ist eine Lesefalle. Vorbestehend, Zug 0 von Paket 1, info (Lesbarkeit)
  → Scope — **in Paket 4 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:139-150`
  — die Getter `description` und `indices` geben die Kopie des Descriptors **per
  Referenz** heraus. `descriptor.description.vertexCount = 0` oder
  `descriptor.indices.push(99)` umgehen die Konstruktor-Prüfungen weiterhin, eine
  Ebene weiter innen als zuvor. Der Weg über das übergebene Objekt ist zu, der über
  den Descriptor selbst offen. Vorbestehend, Paket 1, info → Scope — **in Paket 4 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:18-19` —
  `basePrototype` und `methods` stehen als eigene Felder **und** in `description`;
  zwei Quellen für denselben Wert, die nur der Konstruktor synchron hält.
  Vorbestehend, Paket 1, info → Scope — **in Paket 4 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/types.ts:5, 17, 20, 155, 158, 160,
  162, 164, 166-170` — die übrigen exportierten Typen der Datei tragen kein TSDoc
  (`TypedArray`, `VertexAttributeDataType`, `VertexAttributeUsageType`,
  `VO#[voIndex]`, `VOAttrSetter`, `VOAttrGetter`, `BufferLike`, `DrawUsageType`,
  `VertexObjectBuffersData`). Paket 1 hat nur die Description-Typen dokumentiert.
  Vorbestehend, Paket 1, info → Scope — **in Paket 4 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.ts:64-83`
  — die drei `Set`s und die Alias-Auflösung werden **pro Attribut** neu gebaut,
  innerhalb des `map`-Callbacks, obwohl sie für die ganze Description dieselben
  sind. Praktisch folgenlos (der Descriptor-Pfad reicht kein `attributeUsage` und
  nimmt den Early-Return), aber redundant. Vorbestehend, Paket 1, info → Scope — **in Paket 4 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:232` — das TSDoc von
  `fromBuffersData()` beginnt mit dem Präfix »NOTE:«, das keinen Leser adressiert;
  die Nachbarn `toBuffersData()` und `createFromAttributes()` kommen ohne aus.
  Vorbestehend, Paket 1, info (Kosmetik) → Scope — **in Paket 5 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts:162,
  168, 265` — drei Fixtures tragen `as never` auf einem Description-Literal, was
  die Typprüfung des ganzen Literals abschaltet, obwohl TypeScript bei einer Union
  alle Properties zulässt, die in irgendeinem Member bekannt sind. Der Reviewer hat
  die Casts testweise entfernt: `tsc --noEmit` und 260 Tests blieben grün. Die zwei
  Fixtures, die Paket 1 im selben Muster hinzugefügt hat (`:97` und
  `cloneVertexObjectDescription.spec.ts:245`), fallen mit. Vorbestehend, Paket 1,
  info → Scope — **in Paket 4 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjects.ts:26-34` — das TSDoc von
  `update()` trägt einen `XXX`-Marker ohne Auflösung: weder steht dort, was zu tun ist,
  noch wer es entscheidet. Paket 3b hat nachgesehen, was darunter steht: der Marker sitzt
  über einer bewussten und richtigen Entscheidung — `onBeforeRender` wäre zu spät, deshalb
  muss der Aufrufer `update()` selbst rufen. Ein `XXX` über einer getroffenen Entscheidung
  liest sich wie offene Arbeit; die Begründung gehört ins TSDoc, wo ein Aufrufer sie findet,
  bevor er einen Render ohne `update()` baut. Vorbestehend, Paket 1b, info → Scope — **in Paket 5 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:88` — die
  Bedingung `!(args[2] instanceof BufferGeometry) && args[2] instanceof VOBufferPool` prüft
  doppelt; `instanceof VOBufferPool` schließt `BufferGeometry` bereits aus. Vorbestehend,
  Paket 1b, info → Scope (Zeile von `:95` nach `:88` gewandert, Paket 2) — **in Paket 5 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:58-60` — `resize()` wirft
  für eine unzulässige Kapazität ein nacktes `Error`, dessen Text weder die Klasse noch die
  Methode noch den übergebenen Wert nennt. Dieselbe Sache liefert an zwei Nachbarstellen
  einen benannten `RangeError` mit dem Wert im Text (`VertexObjectBuffer.ts:105-108`, der
  `usedCount`-Setter in `VOBufferPool.ts:111-113`). Vorbestehend (geprüft mit
  `git show 5657be6f:`), Paket 3b, info (Fehlermeldung) → Scope — **in Paket 5 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:287-304` (`copy()`) und
  `:318-331` (`copyArray()`) — beide prüfen nicht, ob `targetObjectOffset` plus die Menge der
  Quelldaten in den Zielbuffer passt. Läuft es über, wirft `TypedArray#set()` einen
  `RangeError` ohne Buffer- und Methodennamen, und zwar mitten in einer Schleife, die
  vorherige Buffer bereits geschrieben hat — der Buffer bleibt halb beschrieben zurück.
  `checkBufferArray()` liefert derselben Klasse an anderer Stelle die benannten Fehler vor.
  Vorbestehend (geprüft mit `git show 5657be6f:`), Paket 3b, low → Scope — **in Paket 5 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:19` und
  `InstancedVOBufferGeometry.ts:29-30` — `buffers` und `bufferSerials` sind öffentlich und im
  Inhalt veränderbar; `readonly` schützt nur die Referenz. Ein Aufrufer, der in
  `bufferSerials` schreibt, verstellt genau das Serial, gegen das `GeometryRoutes#syncUploads()`
  den Dirty-Range abholt, und kann damit Uploads unterdrücken. Paket 2 hat die drei
  `extraInstanced*`-Sichten bereits auf `ReadonlyMap` gezogen; diese beiden sind dabei stehen
  geblieben. Vorbestehend (geprüft mit `git show 5657be6f:`), Paket 3b, low → Scope — **in Paket 5 geschnitten** (Drain, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:40-41` —
  `attributes` (eine `Map`) und `bufferNames` (ein `Set`) sind `readonly`-Felder auf
  veränderbaren Containern; `readonly` schützt nur die Referenz.
  `descriptor.attributes.delete('pos')` macht den Descriptor uneins mit seiner
  eingefrorenen Description. `ReadonlyMap`/`ReadonlySet` wären der Zug, den Paket 2 für
  die drei `extraInstanced*`-Sichten schon gemacht hat. Vorbestehend, Paket 4, info
  (Kapselung) → Scope — **in Paket 5 aufgenommen** (Zug 0, 2026-09-20)
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:84-85` — der
  Konstruktor-Kommentar sagt, eine spätere Änderung an der übergebenen Description
  erreiche den Descriptor »no longer«. Das ist ein Rückblick auf einen Vorzustand und
  verstößt gegen die Konventionen dieses Laufs; der Satz stammt aus Paket 1. Ohne das
  »no longer« sagt er dasselbe. Vorbestehend, Paket 4, info (Konvention) → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:2` und
  `cloneVertexObjectDescription.ts:2` — die beiden Module importieren einander als Wert,
  nicht als Typ. Es läuft, weil beide Seiten den Import erst zur Aufrufzeit brauchen, ist
  aber ein Zyklus, der bricht, sobald eines der Module einen Top-Level-Ausdruck bekommt,
  der das andere benutzt. Vorbestehend, Paket 4, low → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/cloneVertexObjectDescription.spec.ts:1,
  76-80` — `createSandbox` aus `sinon` wird importiert, ein `sandbox` angelegt und in
  `afterEach` zurückgesetzt, aber kein Test der Datei benutzt es. Toter Code samt
  überflüssiger Abhängigkeit im Test. Vorbestehend, Paket 4, info → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:155` —
  `Object.fromEntries(entries as [])` castet auf den leeren Tuple-Typ und schleust
  `entries` (`unknown[]`) am Typsystem vorbei. Es läuft, sagt aber nichts darüber, was
  `entries` trägt; ein `[string, PropertyDescriptor][]` als Typ von `entries` selbst
  machte den Cast überflüssig. Vorbestehend, Paket 4, low → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:7-17` —
  `AttributeBufferLayout` samt seiner drei Felder und die ersten sechs Felder von
  `AttributeBuffer` (`bufferName` bis `serial`) tragen kein TSDoc; dokumentiert sind nur
  die vier Felder, die Paket 3b hinzugefügt hat. Dieselbe Lücke, die Paket 4 in `types.ts`
  geschlossen hat, eine Datei weiter. Vorbestehend, Paket 4, info → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/types.ts:121` und `:128` — die
  `{@link VertexAttributeDescriptor#getterName}` und `#setterName` zeigen auf ein Symbol,
  das diese Datei nicht importiert; im Editor und in TypeDoc löst der Link nicht auf, und
  kein Lint fängt es. Paket 4 hat zwei Links derselben Machart dazugelegt (`:145`, `:206`),
  die in der Paketdatei als kleiner Befund stehen; die zweite Fundstelle `:128` hat Paket 5
  nachgetragen. Vorbestehend, Paket 4 und 5, info → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:68` — `readonly
  buffers: Map<string, AttributeBuffer>` ist eine lebende Map mit schreibbaren Einträgen;
  `pool.buffer.buffers.get(name)!.serial = 0` verstellt die Upload-Buchführung genauso, wie
  es `geometry.bufferSerials.set(…)` tat, bevor Paket 5 die Geometrie-Sichten schloss. Die
  Vordertür ist zu, diese Tür nicht. Sie zu schließen ist nicht billig: die Specs schreiben
  durch diese Map, und `AttributeBuffer` trägt seit Paket 3b vier Felder, die
  `VertexObjectBuffer` selbst fortschreibt. Vorbestehend, Paket 5, low → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:288-348` (`copy()`) —
  ein Quell-Buffer, der **schmaler** ist als sein Ziel, kommt durch den Prüfdurchgang, den
  Paket 5 eingezogen hat, und wird still mit falschem Layout geschrieben; geprüft wird nur,
  ob die Elemente hineinpassen, nicht ob die Layouts zueinander gehören. Das TSDoc deckt es
  mit »Both objects should use the same vertex-object-description« ab — eine Bitte, keine
  Prüfung. Vorbestehend, Paket 5, low → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:247` — der Kommentar
  »the pool behind this buffer has let go, so there is nothing left to upload from it« steht
  über `const buf = this.buffers.get(bufferName);` und erklärt die Zeile darunter. Er ist
  außerdem zu eng: `buf == null` trifft auch einen Buffernamen, den dieser Buffer schlicht
  nicht kennt — ein Tippfehler des Aufrufers, kein disposter Pool. Vorbestehend, Paket 5,
  info → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/createTypedArray.ts:26` — `throw new
  Error()` mit dem Text `unknown typed-array data-type: '<wert>'` nennt den Wert, aber weder
  das Modul noch die Funktion. Nach den drei Meldungen, die Paket 5 benannt hat, die einzige
  verbliebene im Modul, die aus der Reihe fällt. Vorbestehend, Paket 5, info
  (Fehlermeldung) → Scope — **in Paket 6 geschnitten** (Drain-Runde 2, 2026-09-20)

- [ ] `packages/twopoint5d/package.json:50` — das `test`-Script läuft mit `--coverage`, und
  bei einem Lauf über eine einzelne Datei greifen die globalen Coverage-Schwellen nicht.
  `pnpm nx test twopoint5d -- src/path/to/file.spec.ts` — das Kommando, das die
  »Konventionen« oben für einen Einzeldateilauf nennen — endet deshalb mit `ELIFECYCLE` und
  rotem Exit-Code, auch wenn jeder Test grün ist. Vorbestehend, Paket 5, low → Audit (liegt
  in der `package.json` des Pakets, außerhalb des Moduls, auf das die Scope-Regel zeigt)
- [ ] `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:62` —
  `this.basePool?.createVO()` benutzt den Optional-Chain auf einem Feld, das als
  nicht-optional deklariert ist (`declare basePool: TexturedSpritesBasePool`). Entweder
  lügt die Deklaration — `InstancedVOBufferGeometry.ts:27` sagt, `basePool` sei optional,
  sobald eine `BufferGeometry` übergeben wird — oder das `?.` ist überflüssig; beides ist
  eine Aussage über denselben Widerspruch. Vorbestehend, Paket 1b, low → Audit (liegt in
  `sprites/`, außerhalb des Moduls, auf das die Scope-Regel zeigt)
- [ ] `apps/lookbook/src/demos/instanced-quads/InstancedQuadsGeometry.ts:22-24` —
  das Interface `BaseQuad` deklariert `x4`, `y4`, `z4`, obwohl `BaseQuadDescriptor`
  mit `vertexCount: 4` nur `x0` … `x3` erzeugt. Drei Properties, die zur Laufzeit
  `undefined` sind und die der Typ zusagt. Vorbestehend, Paket 1, low → Audit
  (liegt in `apps/lookbook`, außerhalb des Moduls, auf das die Scope-Regel zeigt)
- [ ] `apps/lookbook/src/pages/demos/instanced-quads.astro:75` —
  `setInstancePosition: (position: [number, number]) => void` bei einem Attribut
  `instancePosition` mit drei Komponenten; der generierte Setter nimmt drei Werte.
  Die Demo-Version daneben (`InstancedQuadsGeometry.ts:67`) schreibt das Tripel
  korrekt. Vorbestehend, Paket 1, low → Audit (außerhalb des Moduls)
- [ ] `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js:39-56` — der
  Helfer `readBackInterleaved()` umgeht einen Fehler in three 0.185.1: im WebGL-Fallback
  liefert `renderer.getArrayBufferAsync()` für ein `InterleavedBufferAttribute` 0 Bytes,
  weil `WebGLAttributeUtils#createAttribute()` die `byteLength` unter dem Attribut-Wrapper
  ablegt (`:182`), `getArrayBufferAsync()` sie aber unter dem geteilten Buffer sucht
  (`:273-277`). Der Helfer greift dafür im Fallback auf three-Interna zu
  (`renderer.backend.get(...).bufferGPU`, `gl.getBufferSubData`). Fremdabhängigkeit, aus
  diesem Repo nicht behebbar; betrifft jeden Konsumenten, der interleavte Attribute im
  Fallback zurückliest. Der Workaround gehört nach einem three-Upgrade zurückgebaut.
  Vorbestehend (der three-Fehler), Paket 3, low → Audit (liegt in
  `packages/twopoint5d-testing/`, außerhalb des Moduls, auf das die Scope-Regel zeigt)
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts` (8 Stellen, alle auf
  `VertexObjectPool`), `attributeNamesOf.ts` (2), `InstancedVOBufferGeometry.ts` (3),
  `VertexAttributeDescriptor.ts` (2), `VertexObjectBuffer.ts` (2),
  `VertexObjectDescriptor.ts` (1), `VOBufferGeometry.ts` (2) — 19 TSDoc-Links der Form
  `{@link X}` zeigen auf Symbole, die die jeweilige Datei weder importiert noch selbst
  deklariert; sie lösen weder im Editor noch in einem Doc-Generator auf, und kein Lint
  fängt es. Dieselbe Machart, die Paket 6 in `types.ts` abräumt; dort bleibt sie draußen,
  weil die Entscheidung je Stelle neu fällt — ein `{@link dispose}` auf ein Member der
  eigenen Klasse löst auf, ein `{@link VertexObjectPool}` nicht — und sechs Dateien in den
  Diff zöge, die Paket 6 sonst nicht berührt. Ein `import type` ist nicht der Weg:
  `@typescript-eslint/no-unused-vars` steht auf `error` und zählt eine Nutzung im
  Doc-Kommentar nicht. Überwiegend vorbestehend (von 37 Links im Modul standen 32 bereits
  vor `5657be6f`), Paket 6, info → Audit (Drain-Runde 3 entfällt nach der Regel oben) — **als DOC-052 ins Audit eingetragen** (Abschluss, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:88` und `:94` —
  `bufferAttributes` und `bufferNameAttributes` sind öffentliche, schreibbare `Map`s mit
  schreibbaren Records, während die Buffer-Map nebenan seit Paket 6 hinter einem
  read-only Getter liegt. `voBuffer.bufferAttributes.get('pos')!.offset = 3` compiliert,
  und `copyAttributes()` und `toAttributeArrays()` lesen diese Werte bei jedem Aufruf neu,
  verschieben ihre Daten also sofort gegen das Layout. Derselbe Zug wie an `#buffers`:
  privates Feld plus Getter mit `ReadonlyMap<string, Readonly<AttributeBufferLayout>>`.
  Vorbestehend, Paket 6, low → Audit (Drain-Runde 3 entfällt nach der Regel oben) — **als API-058 ins Audit eingetragen** (Abschluss, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:443` (`copyWithin()`) —
  als einzige der drei Kopiermethoden prüft sie weder `targetIndex` noch
  `startIndex`/`endIndex`, während `copy()` und `copyArray()` beide einen `RangeError` mit
  Namen und Wert werfen. Ein gebrochener oder negativer Index läuft in
  `TypedArray#copyWithin()`, das selbst klemmt und schweigt; der `#markDirty()`-Bereich
  darunter wird dann aus Werten gebildet, die niemand geprüft hat. Vorbestehend, Paket 6,
  low → Audit (Drain-Runde 3 entfällt nach der Regel oben) — **als BUG-099 ins Audit eingetragen** (Abschluss, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:251` gegen `:282` — das
  TSDoc von `fromBuffersData()` verspricht, »an array or a `usedCount` that breaks a rule
  throws before anything about the pool has changed«. Der `usedCount`-Setter (`:112-121`)
  wirft nur für einen nicht-ganzzahligen Wert; einen Wert über der Kapazität klemmt er
  still auf `capacity`. Ein Snapshot mit zu großem `usedCount` wird also angenommen und
  leise zurechtgebogen — das TSDoc sagt etwas zu, was der Code nicht hält. Vorbestehend,
  Paket 6, low → Audit (Drain-Runde 3 entfällt nach der Regel oben) — **als DOC-053 ins Audit eingetragen** (Abschluss, 2026-09-20)

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:191` und `:195` —
  `indices` liefert bei jedem Zugriff `this.description.indices ?? []`, `attributeNames`
  jedes Mal ein frisches `Array.from(...)`. Zwei Lesevorgänge geben nie dasselbe Objekt
  zurück (`descriptor.indices !== descriptor.indices`), und beide Getter werden in
  Schleifen der Geometrie-Seite gelesen. Vorbestehend, Paket 6, low → Audit (Drain-Runde 3 entfällt nach der Regel oben) — **als PERF-025 ins Audit eingetragen** (Abschluss, 2026-09-20)
## Pakete

### [x] 1. Die Description eindeutig machen: `meshCount` streichen, jedes Feld benennen, den Descriptor sichern

- Findings: API-048 (low), API-052 (low), API-053 (low), IMPL-001 (low, nur der
  vertex-objects-Teil), DOC-022 (info)
- Ziel: Was eine `VertexObjectDescription` bedeutet, steht dokumentiert und
  widerspruchsfrei in den Typen — ohne das Feld, dessen Semantik sich nie
  entschieden hat.
- Detail: `docs/remediation/paket-1.md`
- Bereich: `packages/twopoint5d/src/vertex-objects/` (`types.ts`,
  `VertexObjectDescriptor.ts`, `cloneVertexObjectDescription.ts`,
  `initializeAttributes.ts`, `InstancedVOBufferGeometry.ts`, `VOBufferPool.ts`,
  `public-api.ts`), dazu jede Description im Repo, die `meshCount` trägt
  (`sprites/`, `map2d/TileSprites/`, `apps/lookbook/`,
  `packages/twopoint5d-testing/test/`, die Specs) und das CHANGELOG
- Hängt ab von: —
- Hash: 9e66de55
- Ergebnis: 2 Runden · API-048, API-052, API-053, IMPL-001 (vertex-objects-Teil)
  und DOC-022 behoben, je mit Reviewer-Urteil und Fundstelle in der Paketdatei ·
  Regressionstests, alle vier vor ihrem Fix rot gesehen:
  `answers from its own copy of the description`,
  `an accessor named like an own property of the basePrototype` samt dem geerbten
  Geschwisterfall, `answers from its own copy of an attribute that declares size
  and components` und `an attribute that declares size and components gets a
  components array of its own` · Reviewer-Urteil nach Runde 1: kein kritisch, kein
  wichtig, committable · fünf kleine Befunde offen gelassen, in der Paketdatei
  aufgezählt · das Verify hing zwei Stunden an einem Fremdprozess, der 11946 von
  12282 MiB VRAM hielt und Firefox' Browser-Sessions abbrechen ließ; der Commit
  trägt einen Lauf nach dessen Ende, exit=0 über alle zehn Schritte
- Nebenbefunde: → Queue (8 Einträge, davon 6 → Scope und 2 → Audit)
- Folgen: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:17-21`
  — `TexturedSpriteGeometryParameters#attributeUsage` hält die anonyme Form
  `{dynamic?: string[]; stream?: string[]; static?: string[]}` nach, die dieses
  Paket eine Datei weiter als `VertexAttributeUsageOverrides` veröffentlicht hat.
  Zwei Deklarationen derselben Sache in einer öffentlichen Oberfläche;
  `Omit<VertexAttributeUsageOverrides, 'alias'>` sagt es in einer Zeile und zeigt
  mit, warum `alias` hier nicht hingehört (die Geometrie setzt es selbst, `:42-45`).
  Paket 1b fasst diese Datei ohnehin an — dort einsortieren. **Verteilt** (Zug 0
  von Paket 1b, 2026-09-20): steht als Schritt 4 in `docs/remediation/paket-1b.md`.
- Schnittstellen: `meshCount` aus `VertexObjectDescription` entfernt ·
  `VertexObjectDescriptor#meshCount` und `VertexObjectDescriptor#getInstanceCount()`
  entfernt · `VertexObjectDescriptor` kopiert die Description im Konstruktor, seine
  Getter antworten aus der Kopie · neue Konstruktor-Regel als Punkt 6: ein
  generierter Accessor, dessen Name auf dem `basePrototype` oder dessen
  Prototypkette (bis vor `Object.prototype`) liegt, wirft `Error` ·
  `cloneVertexObjectDescription(source, attributeUsage?)` ist benannter Export
  statt Default-Export und steht in `vertex-objects/public-api.ts` · neuer
  exportierter Typ `VertexAttributeUsageOverrides` in
  `cloneVertexObjectDescription.ts`, über dieselbe `public-api.ts` veröffentlicht ·
  `initializeInstancedAttributes()` übergibt kein `meshPerAttribute` mehr an
  `InstancedInterleavedBuffer` und `InstancedBufferAttribute`

### [x] 1b. Ein Präfix pro Schicht, ein Plural pro Sprite

- Findings: API-003 (medium)
- Ziel: Am Namen einer Klasse ist ablesbar, zu welcher Schicht sie gehört, und
  die Regel dahinter steht verbindlich in `architecture.md` statt im Gedächtnis
  derer, die das Modul geschrieben haben.
- Bereich: `packages/twopoint5d/docs/architecture.md`,
  `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`,
  `sprites/TexturedSprites/TexturedSprites.ts`,
  `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts`,
  `packages/twopoint5d/src/map2d/public-api.ts`, dazu die TSDoc-Köpfe der
  `VO*`- und `VertexObject*`-Klassen
- Enthält: die Schichtregel in `architecture.md` festschreiben (`VO*` = rohe
  Buffer-Schicht, `VertexObject*` = typisierte Objektschicht) und in den TSDocs
  der betroffenen Klassen benennen · `TexturedSpritePool` →
  `TexturedSpritesPool` und `TexturedSpriteGeometryParameters` →
  `TexturedSpritesGeometryParameters`, je mit deprecated Alias für ein Release ·
  `map2d/public-api.ts:20` von `export * from './types.js'` auf `export type *`
  (die Datei führt ausschließlich Interfaces)
- Dazu in Zug 0 aufgenommen (2026-09-20): `TexturedSpriteMakeBaseSpriteArgs` →
  `TexturedSpritesMakeBaseSpriteArgs` — vierter Singular-Schiefstand derselben
  Ursache in derselben Datei (`:12`), ebenfalls mit Alias · die Folge aus
  Paket 1: `TexturedSpritesGeometryParameters#attributeUsage` nimmt
  `Omit<VertexAttributeUsageOverrides, 'alias'>`, weil dieses Paket dasselbe
  Interface ohnehin umbenennt
- Hängt ab von: — (aber vor Paket 2 und 3, deren Umbauten dieselben Klassenköpfe
  anfassen; die Schichtregel steht dann schon dort, wo sie gilt)
- Aus dem ursprünglichen Paket 1 herausgeschnitten (Zug 0, 2026-09-20): die
  Dateizahl riss die Reviewbarkeitsgrenze, die der Grobplan benannt hatte, und
  die beiden Hälften teilen weder eine Ursache noch eine Datei. Der erste Teil
  behält die Nummer 1, weil die Schleife die laufende Iteration unter ihr führt.
- Detail: `docs/remediation/paket-1b.md`
- Hash: bdbb5ec1
- Ergebnis: 1 Runde · API-003 behoben, Reviewer-Urteil je Vorgehensschritt mit
  Fundstelle in der Paketdatei · kein Regressionstest: das Paket benennt um und
  dokumentiert, es behebt keinen Korrektheitsfehler · Reviewer nach Runde 0: kein
  kritisch, kein wichtig, committable · sieben kleine Befunde offen gelassen, in der
  Paketdatei aufgezählt · einer davon vor dem Commit erledigt: die Commit-Message hat
  `lookbook` in den Scope bekommen · `pnpm run ci` exit=0 über alle zehn Schritte
- Nebenbefunde: → Queue (3 Einträge, davon 2 → Scope und 1 → Audit)
- Folgen: keine. Die Folge aus Paket 1
  (`TexturedSpritesGeometry.ts:17-21`) ist mit Schritt 4 erledigt.
- Schnittstellen: `TexturedSpritePool` → `TexturedSpritesPool`,
  `TexturedSpriteGeometryParameters` → `TexturedSpritesGeometryParameters`,
  `TexturedSpriteMakeBaseSpriteArgs` → `TexturedSpritesMakeBaseSpriteArgs`, je mit
  `@deprecated`-Typalias unter der neuen Deklaration in
  `sprites/TexturedSprites/TexturedSpritesGeometry.ts`; die Aliase halten ein Release ·
  `TexturedSpritesGeometryParameters#attributeUsage` hat den Typ
  `Omit<VertexAttributeUsageOverrides, 'alias'>` statt einer anonymen Form ·
  `map2d/public-api.ts` exportiert `./types.js` als `export type *`, die Interfaces sind
  dort also nur noch als Typen erreichbar · im `vertex-objects`-Modul hat sich kein Name
  bewegt, nur TSDoc-Köpfe sind dazugekommen · die Schichtregel steht als verbindlicher
  Absatz in `packages/twopoint5d/docs/architecture.md:55-69`; wer dort eine neue Klasse
  anlegt, nimmt `VO*` ohne und `VertexObject*` mit Objekttyp

### [x] 2. Das Route-Plumbing beider Geometrien an einer Stelle führen

- Findings: ARCH-006 (medium), TYPE-012 (info)
- Ziel: Die Serial- und Auto-Touch-Buchführung der Routen liegt in einem
  Kollaborateur, den beide Geometrieklassen benutzen, statt zweimal
  nebeneinander.
- Bereich: `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`,
  `InstancedVOBufferGeometry.ts`, ein neues `GeometryRoutes.ts` neben
  `GeometryAttributeSlots.ts` und `GeometryPoolAttachments.ts`
- Enthält: `#serials`, `#syncAttributeArrays`, `#checkBufferSerials`,
  `#firstAutoTouch`, `#autoTouchAttributes`, `#getAutoTouchBuffers`,
  `#releaseSlots`, `declareOwnedPool` und den `touch()`-Argumentparser
  zusammenführen · den sechsfach wiederholten
  `selectBuffers(…).forEach(needsUpdate = true)`-Block in `touchBuffers()`
  auflösen · die Drift im nicht-instanced `touch()` (forEach mit
  closure-zugewiesenem `let buffers`) mit einziehen · `extraInstancedPools` und
  `detachInstancedPool()` auf `VertexObjectPool<unknown>` typisieren und die
  drei öffentlichen Maps als `ReadonlyMap` exponieren
- Hängt ab von: — (aber vor Paket 3, damit dessen Serial-Umbau eine Stelle
  vorfindet statt zwei)
- Zwei Findings, weil die Reviewbarkeit trennt: rund 150 Zeilen Duplikat in
  einer 677-Zeilen-Klasse füllen einen Review-Durchgang allein.
- Detail: `docs/remediation/paket-2.md`
- Hash: 93ccb86c
- Ergebnis: 2 Runden · ARCH-006 und TYPE-012 behoben, je mit Reviewer-Urteil und
  Fundstelle in der Paketdatei · kein Regressionstest: verhaltenserhaltender
  Umbau, kein Korrektheitsfehler behoben; das Sicherungsnetz aus 1457 Vitest-Tests
  und der Browser-Suite blieb grün, keine Testdatei angefasst · Reviewer nach
  Runde 0: 4 × wichtig, committable nein — Lifecycle-Doku zeigte ein
  eingesammeltes Feld, `detach()` löste einen vollen Static-Re-Upload aus, der
  CHANGELOG-Eintrag versprach den angehängten `VOType` zurück, die
  Commit-Message verschwieg den Breaking Change · nach Runde 1: alle vier
  erledigt, kein kritisch, kein wichtig, committable ja · vier kleine Befunde
  offen gelassen, in der Paketdatei aufgezählt · drei bewusste Abweichungen vom
  Detailplan, in der Paketdatei begründet, darunter die Trennung von
  `resetAutoTouch()` und `#dropAutoTouchSelection()`, die die Zusage der
  Verhaltenserhaltung über den Wortlaut von Schritt 1 stellt ·
  `pnpm run ci` exit=0 über alle zehn Schritte
- Nebenbefunde: keine neuen. Der einzige Befund in den geänderten Dateien, der
  auch ohne dieses Paket falsch wäre, steht bereits in der Queue — die doppelte
  Bedingung der Konstruktor-Guard, jetzt auf `InstancedVOBufferGeometry.ts:88`
  statt `:95`
- Folgen: `packages/twopoint5d/src/vertex-objects/updateUpdateRange.ts:4-5` — die
  beiden `| undefined` der Signatur und die `if (pool && buffers)`-Guard sind tot,
  seit der einzige Aufrufer `GeometryRoutes#updateRanges()` ist und eine Route
  immer beides trägt. **Verteilt an Paket 3b** (Zug 0 von Paket 3, 2026-09-20):
  steht als Schritt im Grobplan von Paket 3b, das die Funktion ohnehin zu
  `addUpdateRange(start, count)` umbaut ·
  `packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts:15` — der
  exportierte Typ `ReleasedSlot` hat keinen Importeur mehr, seit
  `InstancedVOBufferGeometry` das Ergebnis von `releaseRoute()` nur noch
  destrukturiert; er bleibt der dokumentierte Rückgabetyp und steht nicht in der
  `public-api.ts`, kostet also nichts. **Gegenstandslos, abgeschlossen** (Zug 0 von
  Paket 3, 2026-09-20): der Typ steht als Rückgabetyp von `releaseRoute()` in
  `GeometryAttributeSlots.ts:104` und wird dort gebraucht; ein Rückgabetyp braucht
  keinen Importeur. Begründung in `docs/remediation/paket-3.md` ·
  `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts:202`
  — der Testname »detachInstancedPool removes the autoDispose tracking entry«
  nennt `#extraInstancedPoolAutoDispose`, eine Buchführung, die dieses Paket
  entfernt hat; die Antwort hängt jetzt am Route-Objekt. Der Test prüft Verhalten
  und bleibt gültig. Dieses Paket durfte die Datei nicht anfassen.
  **Verteilt an Paket 3** (Zug 0 von Paket 3, 2026-09-20): steht als Schritt 4 in
  `docs/remediation/paket-3.md`
- Schnittstellen: `InstancedVOBufferGeometry#extraInstancedPools` ist
  `ReadonlyMap<string, VertexObjectPool<unknown>>`, `#extraInstancedBuffers`
  `ReadonlyMap<string, Map<string, BufferLike>>` und `#extraInstancedBufferSerials`
  `ReadonlyMap<string, Map<string, number>>` — drei Sichten auf dieselben Routen,
  nicht mehr beschreibbar; geschrieben wird über `attachInstancedPool()` und
  `detachInstancedPool()` · `detachInstancedPool(name)` gibt
  `VertexObjectPool<unknown> | undefined` statt `VOBufferPool | undefined` ·
  `TouchInstancedBuffersType` ist jetzt in `vertex-objects/parseTouchArgs.ts`
  deklariert und wird von `InstancedVOBufferGeometry.ts` unverändert
  re-exportiert — der Importpfad von außen bleibt derselbe · zwei neue **interne**
  Kollaborateure, nicht in der `public-api.ts`: `GeometryRoutes.ts` mit der Klasse
  `GeometryRoutes` (`add`, `attach`, `route`, `detach`, `setAutoDispose`,
  `checkSerials`, `updateRanges`, `select`, `selectByUsage`, `autoTouch`,
  `resetAutoTouch`, `clear`, `[Symbol.iterator]`, die drei `attached*`-Sichten),
  den Typen `GeometryRoute` und `RouteGroup` und der Funktion `markForUpload()`;
  `parseTouchArgs.ts` mit `parseTouchArgs()` und dem Typ `TouchArgs` ·
  `GeometryAttributeSlots` hält die Array-Versionen der Slots und bietet
  `syncArrays(geometry)`; `releaseRoute()` löscht die Version eines Slots selbst ·
  `GeometryPoolAttachments` bietet `declareOwned(pool)`, `owns(pool)`,
  `forgetOwned(pool)` und `clear()`; `detachAll()` lässt das Ownership-Set
  **absichtlich** stehen, weil beide `dispose()` danach noch `owns()` fragen ·
  `declareOwnedPool()` bleibt auf beiden Geometrien und delegiert · keine
  Geometrie hält mehr `#serials`, `#releaseSlots`, `#syncAttributeArrays`,
  `#checkBufferSerials`, `#updateBuffersUpdateRange`, `#getAutoTouchBuffers`,
  `#firstAutoTouch`, `#ownedPools` oder `#extraInstancedPoolAutoDispose`

### [x] 3. Das Sicherungsnetz: die ungetesteten Stellen der Pool-Zustandsmaschine und der Interleaved-Zweig der Upload-Range

- Findings: TEST-023 (medium), TEST-014 (medium)
- Ziel: Bevor die Dirty-Buchführung der Buffer umgebaut wird, steht unter jedem
  öffentlichen Verhalten der Pool-Zustandsmaschine eine Spec, und der
  Interleaved-Zweig der Upload-Range wird im Browser wirklich gefahren.
- Bereich: `packages/twopoint5d/src/vertex-objects/` (`VOUtils.spec.ts` und
  `VertexObjects.spec.ts` neu, `VertexObjectPool.spec.ts` und
  `InstancedVertexObjectGeometry.spec.ts` ergänzt),
  `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js`. Kein
  Produktionscode.
- Hängt ab von: Paket 2 (die Serial-Logik liegt danach an einer Stelle)
- Fünf der acht in TEST-023 genannten Lücken sind seit dem Audit geschlossen
  worden — der vorangegangene Lauf hat die Specs mit seinen eigenen Fixes
  geliefert (Commit `4e45accc` und Nachbarn). Offen bleiben `onCreateVO`,
  `VertexObjects.update()` und `VOUtils`; der Abgleich je Stelle mit Fundstelle
  steht in der Paketdatei.
- Aus dem ursprünglichen Paket 3 herausgeschnitten (Zug 0, 2026-09-20): der
  Grobplan führte Sicherungsnetz und Umbau in einem Paket, ausdrücklich in zwei
  Phasen. Getrennt, weil die Reihenfolge sonst unbelegbar bleibt — ein Commit,
  der Specs und den Umbau zugleich trägt, lässt weder Reviewer noch Nachwelt
  erkennen, ob die Specs vor oder nach der Verhaltensänderung geschrieben wurden,
  und ein Test, der erst danach entsteht, beweist nichts. Dazu die Reviewbarkeit:
  vier Spec-Dateien neben acht umgebauten Produktionsdateien füllen keinen
  gemeinsamen Review-Durchgang. Der erste Teil behält die Nummer 3, weil die
  Schleife die laufende Iteration unter ihr führt.
- Detail: `docs/remediation/paket-3.md`
- Hash: 48c92657
- Ergebnis: 1 Runde · TEST-023 und TEST-014 behoben, je mit Reviewer-Urteil und
  Fundstelle in der Paketdatei · kein Regressionstest: das Paket schließt
  Abdeckungslücken und behebt keinen Korrektheitsfehler; keine der neuen Specs blieb
  beim ersten Lauf rot · neu `VOUtils.spec.ts` (9 Tests) und `VertexObjects.spec.ts`
  (5 Tests), ergänzt der `onCreateVO`-Block in `VertexObjectPool.spec.ts` (7 Tests) und
  das vierte `it()` in `vertex-objects-gpu-upload.test.js`; ein Testname in
  `InstancedVertexObjectGeometry.spec.ts:202` geradegezogen · kein Produktionscode ·
  Reviewer nach Runde 0: kein kritisch, kein wichtig, committable ja · zwei bewusste
  Abweichungen vom Detailplan, beide vom Reviewer an der three-Quelle bzw. am Test
  selbst bestätigt und in der Paketdatei begründet · vier kleine Befunde, drei offen
  gelassen und in der Paketdatei aufgezählt, der vierte vor dem Commit erledigt (die
  Commit-Message verschwieg die Umbenennung) · `pnpm run ci` exit=0 über alle zehn
  Schritte; weil `test:ci` und `test:browser` darin aus dem Nx-Cache kamen, wurden beide
  mit `--skipNxCache` nachgefahren, exit=0 und exit=0, keine Firefox-Abbrüche
- Nebenbefunde: → Queue (1 Eintrag, → Audit). Der `XXX`-Marker in `VertexObjects.ts:30`,
  den der Implementierer zusätzlich meldete, steht dort seit Paket 1b
- Folgen: keine. Das Paket fügt Tests hinzu und ändert keine Zeile Produktionscode
- Schnittstellen: keine. Die Oberfläche hat sich nicht bewegt

### [x] 3b. Dirty-Ranges pro Objekt statt eines Voll-Uploads pro Frame

- Findings: PERF-020 (medium), READ-010 (info)
- Ziel: Ein Sprite-Spawn lädt die Objekte hoch, die sich geändert haben, statt
  jeden Buffer des Pools über seinen ganzen genutzten Bereich.
- Bereich: `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`,
  `VertexObjectPool.ts`, `VOBufferPool.ts`, `GeometryRoutes.ts`,
  `updateUpdateRange.ts`, `InstancedVOBufferGeometry.ts`, die Specs dieser
  Dateien, `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js`
  und das CHANGELOG
- Enthält: `touch()` aus dem `getVO()`-Pfad nehmen — ein Vertex Object zu
  materialisieren ändert keine Daten, und `types.ts:45-54` sagt schon heute, dass
  die generierten Setter nichts dirty markieren · `createVO()` und den
  Swap-Pfad von `freeVO()` nur noch den betroffenen Objektindex markieren lassen
  statt jeden Buffer über seinen ganzen Bereich · den Dirty-Objekt-Range
  `[minIdx, maxIdx]` pro Buffer einführen, den `createVO`, `freeVO`,
  `copyAttributes`, `copyWithin`, `copyArray`, `copy`, `resize` und
  `fromBuffersData` weiten · `updateUpdateRange` in ein
  `addUpdateRange(start, count)` übersetzen, das den Range in Elemente rechnet
  (`start = minIdx × vertexCount × itemSize`,
  `count = (maxIdx − minIdx + 1) × vertexCount × itemSize`) · das
  `#firstAutoTouch`-Zurücksetzen in `attachInstancedPool()` auf die neue Route
  beschränken, statt `touchBuffers({static: true})` jede Route hochladen zu
  lassen · die nacherzählenden Kommentare in `VertexObjectPool.ts` `resize()`
  (`:76, 87, 90, 95`) streichen
- Hängt ab von: Paket 3 (die Specs, gegen die der Umbau läuft, stehen danach)
- Folge aus Paket 2, hier einsortiert (Zug 0 von Paket 3, 2026-09-20):
  `updateUpdateRange.ts:4-5` — die beiden `| undefined` der Signatur und die
  `if (pool && buffers)`-Guard sind tot, seit `GeometryRoutes#updateRanges()` der
  einzige Aufrufer ist; beim Umbau auf `addUpdateRange(start, count)`
  geradeziehen
- Der Beweis gehört in `vertex-objects-gpu-upload.test.js`: ein großer,
  überwiegend statischer Pool mit einem Spawn pro Frame lädt nicht mehr alles
  hoch.
- **Ein Pool kann an mehreren Geometrien hängen** — `VOBufferPool#attachGeometry()`
  zählt die Anschlüsse, und beide Geometrieklassen nehmen fremde Pools entgegen.
  Ein einzelner Dirty-Range am Buffer, den der Konsument nach dem Upload leert,
  ist damit **falsch**: die zweite Geometrie fände ihn leer und lüde nichts.
  Tragfähig ist nur eine Buchführung, bei der ein Konsument nichts leert und eine
  Route, die zu weit zurückliegt, auf den vollen Bereich zurückfällt. Das Serial
  pro Buffer bleibt deshalb als Änderungsmelder stehen und wird nicht ersetzt —
  der Range sagt, *wie weit* hochzuladen ist, das Serial, *ob überhaupt*. Der
  Wortlaut des Audits (»`serial` durch einen Dirty-Objekt-Range ersetzen«) geht an
  dieser Stelle am Code vorbei; die Sache, die es meint — Upload pro Objekt statt
  pro Buffer —, steht.
- Vorgefunden wird nach Paket 2 und 3: die Serial-Buchführung liegt in
  `GeometryRoutes#checkSerials()` und `#updateRanges()`, die Auto-Touch-Logik in
  `GeometryRoutes#autoTouch()`; `#firstAutoTouch` wird nur noch von
  `resetAutoTouch()` gesetzt, und dessen einziger Aufrufer ist das Ende von
  `attachInstancedPool()` — genau die Stelle, die dieses Paket auf die neue Route
  beschränken soll. `getVO()` hat repoweit keinen Aufrufer außerhalb seiner
  eigenen Klasse; das `touch()` dort zu streichen bricht in diesem Repo nichts,
  ändert aber öffentliches Verhalten und gehört ins CHANGELOG. Die einzigen
  Specs, die heute auf `updateRanges` prüfen, stehen in
  `vertex-buffers-geometry-updates.spec.ts:596-629` und erwarten in beiden Fällen
  einen Range ab Objekt 0 — sie überleben den Umbau unverändert.
- Detail: `docs/remediation/paket-3b.md`
- Aus Zug 0 (2026-09-20): PERF-020 und READ-010 stehen beide noch; drei der vier
  Fundstellen von PERF-020 sind durch Paket 2 gewandert oder in
  `GeometryRoutes` umgeformt, der Sachverhalt ist überall unverändert. Kein
  Nebenbefund aus der Queue aufgenommen — die zwei, die in Dateien dieses Pakets
  liegen (`VOBufferPool.ts:232`, `InstancedVOBufferGeometry.ts:88`), teilen die
  Ursache nicht. Das Paket bleibt ungeteilt: der Range trägt nur als Ganzes, ein
  halber Mechanismus lädt falsch hoch. Modell: stärkste Stufe, Effort `high` —
  öffentliche API, GPU-Upload-Korrektheit, ein Pool kann an mehreren Geometrien
  hängen.
- Hash: bb13c61f
- Ergebnis: 3 Runden · PERF-020 und READ-010 behoben, je mit Reviewer-Urteil und
  Fundstelle in der Paketdatei · Regressionstests, alle drei vor ihrem Fix rot
  gesehen: `a spawn uploads the object that was created, not the whole pool` und
  `freeing an object in the middle uploads the slot that took its place` (beide
  `{start: 0, …}` über den ganzen Bereich statt des engen Ranges), dazu aus den
  Fehlerketten-Runden `two updates without a render in between upload both
  objects that were written` und `a frame in which nothing is written leaves the
  next spawn its own narrow range` · Reviewer nach Runde 0: 2 × wichtig — ein
  eingetragener, aber nie hochgeladener Range ging beim nächsten `update()`
  verloren, und die beiden Touch-Specs konnten nicht rot werden · nach Runde 1:
  beide geschlossen, dafür ein neuer wichtiger — ein `update()` ohne
  Schreibvorgang trug den vollen Bereich ein, den die neue Vereinigung überleben
  ließ · nach Runde 2: alle geschlossen, kein kritisch, kein wichtig,
  committable ja · drei bewusste Abweichungen vom Detailplan, in der Paketdatei
  begründet: `setUploadRange()` vereinigt einen stehenden Range statt ihn zu
  ersetzen, `syncUploads()` überspringt einen unbewegten Buffer ganz, und
  `GeometryRoutes#touch()` leert die Ranges der Buffer, die es markiert · ein
  kleiner Befund offen gelassen, in der Paketdatei und in `Folgen:` · der Beweis
  im Browser steht: ein Spawn in einem Pool mit 33 belegten Objekten lädt
  `{start: 396, count: 12}` hoch, auf Chromium (WebGL2-Fallback) und Firefox
  (WebGPU) · `pnpm run ci` exit=0 über alle zehn Schritte, beide Test-Gates mit
  `--skipNxCache` nachgefahren, exit=0 und exit=0, kein Firefox-Abbruch
- Nebenbefunde: → Queue (3 neue Einträge, alle → Scope; zwei weitere Meldungen
  standen dort bereits, eine dritte ist als Ergänzung in den vorhandenen
  `VertexObjects.ts`-Eintrag gewandert)
- Folgen: `packages/twopoint5d/CHANGELOG.md:279-289` — der Migrationsabschnitt
  dieses Pakets sagt nicht, dass ein von Hand gesetztes
  `attribute.needsUpdate = true` keinen Voll-Upload mehr impliziert: auf dem
  Attribut kann ein schmaler Range aus einem früheren `update()` stehen, dessen
  Upload noch aussteht, und dann lädt der Render nur diesen hoch und der
  Schreibvorgang geht verloren. Ein Satz im bestehenden Abschnitt genügt, Code
  ist keiner zu ändern. Eigener Schaden, keine vorbestehende Sache — deshalb
  hier und nicht in »Offene Befunde«; die Drain-Runde des Abschlusses nimmt ihn
  mit.
- Schnittstellen: `VertexObjectPool#getVO()` markiert die Buffer seines Pools
  nicht mehr für den Upload — ein Slot zu materialisieren ändert keine Daten ·
  `VertexObjectBuffer#touch(fromIdx = 0, toIdx = capacity - 1)` nimmt einen
  Objektbereich; ohne Argumente bleibt es, was es war · neu
  `VertexObjectBuffer#touchBuffer(bufferName, fromIdx?, toIdx?)` für einen
  einzelnen benannten Buffer und
  `VertexObjectBuffer#pickUpDirtyRange(bufferName, seenSerial, usedCount)`, das
  `{from, to} | null` liefert und das Abholen vermerkt · `AttributeBuffer` trägt
  vier Pflichtfelder mehr: `dirtyFrom`, `dirtyTo`, `dirtySince`,
  `pickedUpSerial` — wer so einen Record selbst baut, füllt sie · alle vier
  Klassen stehen in `vertex-objects/public-api.ts` ·
  `InstancedVOBufferGeometry#attachInstancedPool()` lädt die static Buffer der
  neuen Route hoch und lässt die Routen, die schon da waren, in Ruhe ·
  **intern, nicht in der `public-api.ts`**: `updateUpdateRange.ts` heißt
  `setUploadRange.ts` und exportiert
  `setUploadRange(bufAttr, fromIdx, toIdx, vertexCount, itemSize)`, das einen
  stehenden Range mit dem neuen vereinigt statt ihn zu ersetzen (three leert
  `updateRanges` erst beim tatsächlichen Upload, und der erste Upload eines
  Attributs leert gar nicht — geprüft an `three@0.185.1`) · `GeometryRoutes`
  führt `checkSerials()` und `updateRanges()` in `syncUploads()` zusammen,
  markiert über `touchAttributes(attrNames)` und
  `touchByUsage(bufferTypes, group?)` selbst statt eine Selektion herauszugeben,
  hält `firstAutoTouch` je Route statt einmal für die Geometrie und hat
  `resetAutoTouch()`, `markForUpload()`, `select()` und `selectByUsage()`
  verloren · beide `update()` rufen jetzt `#updateDrawRange()`,
  `#autoTouchAttributes()`, `#routes.syncUploads()`, `#slots.syncArrays(this)`
  in dieser Reihenfolge

### [x] 4. Descriptor und Description: die Seitentüren schließen, die Typen zu Ende benennen

- Nebenbefund: sechs Einträge aus der Befund-Queue, alle vorbestehend, gemeldet
  aus den Paketen 1 und 1b
- Ziel: Was ein Descriptor über seine Getter herausgibt, führt nicht an den
  Prüfungen vorbei, die sein Konstruktor gefahren hat.
- Bereich: `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`,
  `types.ts`, `cloneVertexObjectDescription.ts`, `createVertexObjectPrototype.ts`,
  `createIndicesArray.ts` und die Specs dieser Dateien, dazu
  `packages/twopoint5d/CHANGELOG.md` (dieselbe Datei wie Paket 5, andere Stelle)
- Enthält:
  - `VertexObjectDescriptor.ts:139-150` — die Getter `description` und `indices`
    geben die Kopie des Descriptors per Referenz heraus;
    `descriptor.indices.push(99)` umgeht die Konstruktor-Prüfungen weiterhin. Der
    schwerste der sechs: Paket 1 hat die Vordertür geschlossen und diese offen
    gelassen.
  - `VertexObjectDescriptor.ts:18-19` — `basePrototype` und `methods` stehen als
    eigene Felder und in `description`; zwei Quellen für denselben Wert, die nur
    der Konstruktor synchron hält
  - `createVertexObjectPrototype.ts:84, 91` — die lokale `const methods` des
    `flatMap`-Callbacks verschattet die äußere aus der Destrukturierung; läuft
    korrekt, ist eine Lesefalle
  - `types.ts:5, 17, 20, 155-170` — die übrigen exportierten Typen tragen kein
    TSDoc (`TypedArray`, `VertexAttributeDataType`, `VertexAttributeUsageType`,
    `VO#[voIndex]`, `VOAttrSetter`, `VOAttrGetter`, `BufferLike`, `DrawUsageType`,
    `VertexObjectBuffersData`)
  - `cloneVertexObjectDescription.ts:64-83` — die drei `Set`s und die
    Alias-Auflösung werden pro Attribut neu gebaut, obwohl sie für die ganze
    Description dieselben sind
  - `VertexObjectDescriptor.spec.ts:97, 162, 168, 265` und
    `cloneVertexObjectDescription.spec.ts:245` — `as never` auf
    Description-Literalen schaltet die Typprüfung des ganzen Literals ab. Der
    Reviewer hat die Casts testweise entfernt, `tsc --noEmit` und 260 Tests
    blieben grün.
- Hängt ab von: —
- Aus Zug 0 (2026-09-20): alle sechs Befunde stehen noch, keiner
  gegenstandslos; drei Fundstellen sind gewandert (`:139-150` → Feld `:18` und
  Getter `:153-155`, `:18-19` → `:23-24` und `:77-78`), der Sachverhalt ist
  überall unverändert. Der erste ist ein Korrektheitsfehler und bekommt
  Regressionstests: `VertexAttributeDescriptor#components` (`:63`) reicht
  dasselbe Array durch und ist die dritte Tür in dieselbe Kammer, die das
  Einfrieren mitschließt. Der TSDoc-Schritt ist von den neun genannten Typen
  auf alle 17 undokumentierten Exporte von `types.ts` erweitert — die
  Aufzählung des Befunds war unvollständig, und »kein Export ohne TSDoc« ist
  prüfbar, eine Namensliste nicht. Modell: mittlere Stufe, Effort `high` —
  die Arbeit ist breit, nicht tief, aber sie ändert öffentliches Verhalten
  (Breaking Change, CHANGELOG samt Migrationsabschnitt).
- Detail: `docs/remediation/paket-4.md`
- Hash: 853e5948
- Ergebnis: 2 Runden · alle sieben Schritte erfüllt, je mit Reviewer-Urteil und
  Fundstelle in der Paketdatei · Regressionstests, die drei Schreibversuchs-Tests
  vor dem Fix rot gesehen: `a write to the description throws and leaves it as it
  was`, `a push onto the indices throws and leaves them as they were` und `a push
  onto the components of an attribute throws and leaves them as they were`; dazu
  zwei Tests, die grün bleiben und die Grenze festhalten — `leaves the
  basePrototype to its owner, who can still add a method to it` und `hands out a
  copy through cloneVertexObjectDescription() that is free to change`. Der
  Reviewer hat die Rot-Probe selbst nachgefahren: Freeze-Aufruf auskommentiert →
  3 failed | 26 passed, wiederhergestellt → 29 passed · Reviewer nach Runde 0:
  kein kritisch, 1 × wichtig (`VertexAttributeDescriptor#components` sagte
  `string[]` auf einem eingefrorenen Array zu), 5 × klein · nach Runde 1: beide
  zurückgegebenen Befunde geschlossen, kein kritisch, kein wichtig, committable
  ja · fünf kleine Befunde offen gelassen, in der Paketdatei aufgezählt, einer
  vor dem Commit erledigt (die Commit-Message verschwieg zwei Schritte und die
  zweite Typverengung) · zwei bewusste Abweichungen vom Detailplan, in der
  Paketdatei begründet: ein fünfter Regressionstest, der den Klon-Ausweg des
  Migrationshinweises abfährt, und ein `@ts-expect-error` statt eines Casts im
  `components`-Test, weil ein Cast auf einem `string[]` immer kompiliert und
  nichts festhielte · `pnpm run ci` exit=0 über alle zehn Schritte, beide
  Test-Gates mit `--skipNxCache` nachgefahren, exit=0 und exit=0, kein
  Firefox-Abbruch
- Nebenbefunde: → Queue (7 Einträge, alle → Scope, alle im vertex-objects-Modul)
- Folgen: alle drei im selben Commit entstanden und **an Paket 5 verteilt**,
  dessen Zug 0 sie triagiert — es fasst denselben Migration Guide ohnehin an und
  zielt auf dieselbe Art Arbeit (»dichte Oberflächen, ein vollständiger
  Migrationshinweis«): `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:38`
  — `readonly description: VertexObjectDescription` sagt ein Objekt mit
  schreibbaren Feldern zu (`types.ts:156`, `indices?: number[]`); ein
  Schreibversuch typprüft sauber und wirft zur Laufzeit. Der Compiler sagt es
  also an zwei von drei Türen (`indices`, `components`) und an der dritten nicht.
  Eine tief-readonly Sicht auf die Description-Typen wäre der Zug, sie zöge aber
  alle Verbraucher von `VertexObjectDescription` mit — deshalb nicht im Diff ·
  `packages/twopoint5d/CHANGELOG.md:41` und `:284` — beide Aufzählungen nennen
  fünf der sechs eingefrorenen Dinge; der `attributes`-Record
  (`VertexObjectDescriptor.ts:20`) fehlt, obwohl ein Schreibversuch darauf wirft.
  Ein Halbsatz je Stelle · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts:144`
  — die `@ts-expect-error`-Direktive deckt die ganze Folgezeile statt nur den
  `push`; der Reviewer hat nachgewiesen, dass `tsc` dort auch einen erfundenen
  Methodennamen schluckt. Der Aufruf gehört aus der gedeckten Zeile heraus
- Schnittstellen: `VertexObjectDescriptor#description` ist eingefroren, und mit
  ihr `indices`, der `attributes`-Record, jede Attribut-Description darin, deren
  `components` und das `methods`-Objekt — ein Schreibversuch auf eines davon
  wirft `TypeError`. **Nicht** eingefroren sind der übergebene `basePrototype`
  und die einzelnen Funktionen in `methods`: das ist Verhalten, das dem Aufrufer
  gehört · `VertexObjectDescriptor#indices` antwortet `readonly number[]`,
  `VertexAttributeDescriptor#components` antwortet `readonly string[]`; wer eines
  davon einem veränderbaren Array zuweist, nennt den readonly-Typ oder kopiert
  mit `[...]` · `VertexObjectDescriptor#basePrototype` und `#methods` sind Getter
  auf `this.description` statt eigener Felder und liegen damit nicht mehr auf der
  enumerablen Oberfläche einer Instanz; die Signatur `object | null | undefined`
  ist unverändert · wer eine Description nach dem Bau des Descriptors noch ändern
  will, baut sie mit `cloneVertexObjectDescription()` um und übergibt sie einem
  neuen Descriptor — dieser Weg steht als Migrationsabschnitt im CHANGELOG und
  wird von einer Spec abgefahren · **intern, nicht in der `public-api.ts`**:
  `createIndicesArray(indices, …)` nimmt `readonly number[]` ·
  `cloneVertexObjectDescription()` baut die Usage-Auflösung einmal je Klon in
  `resolveUsageLookup()` statt einmal je Attribut, Signatur und Verhalten
  unverändert · in `types.ts` hat sich kein Symbol bewegt, nur TSDoc ist
  dazugekommen: alle 19 Exporte der Datei tragen jetzt eins

### [x] 5. Pool, Buffer und Geometrie: benannte Fehler, dichte Oberflächen, ein vollständiger Migrationshinweis

- Nebenbefund: sechs Einträge aus der Befund-Queue (vorbestehend, gemeldet aus
  den Paketen 1, 1b und 3b) und eine offene `Folgen:`-Zeile aus Paket 3b
- Ziel: Wer einen Pool falsch bedient, liest im Fehler, welche Klasse, welche
  Methode und welcher Wert gemeint ist — und findet keine öffentliche Map mehr,
  über die er die Upload-Buchführung verstellen kann.
- Bereich: `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`,
  `VertexObjectBuffer.ts`, `VOBufferPool.ts`, `VOBufferGeometry.ts`,
  `InstancedVOBufferGeometry.ts`, `VertexObjects.ts`,
  `packages/twopoint5d/CHANGELOG.md`, dazu aus den Folgen von Paket 4
  `VertexObjectDescriptor.ts`, `VertexObjectDescriptor.spec.ts` und `types.ts`
- Enthält:
  - `VOBufferGeometry.ts:19` und `InstancedVOBufferGeometry.ts:29-30` —
    `buffers` und `bufferSerials` sind öffentlich und im Inhalt veränderbar;
    `readonly` schützt nur die Referenz. Wer in `bufferSerials` schreibt,
    verstellt genau das Serial, gegen das `GeometryRoutes#syncUploads()` den
    Dirty-Range abholt, und kann Uploads unterdrücken. Paket 2 hat die drei
    `extraInstanced*`-Sichten bereits auf `ReadonlyMap` gezogen; diese beiden
    sind stehen geblieben.
  - `VertexObjectBuffer.ts:287-304` (`copy()`) und `:318-331` (`copyArray()`) —
    keine Prüfung, ob `targetObjectOffset` plus Quelldaten in den Zielbuffer
    passt. Läuft es über, wirft `TypedArray#set()` mitten in einer Schleife, die
    vorherige Buffer schon geschrieben hat; der Buffer bleibt halb beschrieben
    zurück. `checkBufferArray()` liefert derselben Klasse anderswo die benannten
    Fehler vor.
  - `VertexObjectPool.ts:58-60` — `resize()` wirft für eine unzulässige Kapazität
    ein nacktes `Error` ohne Klasse, Methode und Wert; die Nachbarstellen
    (`VertexObjectBuffer.ts:105-108`, der `usedCount`-Setter in
    `VOBufferPool.ts:111-113`) liefern einen benannten `RangeError` mit Wert
  - `VertexObjects.ts:26-34` — das TSDoc von `update()` trägt einen `XXX`-Marker
    über einer getroffenen Entscheidung: `onBeforeRender` wäre zu spät, deshalb
    ruft der Aufrufer `update()` selbst. Die Begründung gehört ins TSDoc, wo ein
    Aufrufer sie findet, bevor er einen Render ohne `update()` baut.
  - `InstancedVOBufferGeometry.ts:88` — `!(args[2] instanceof BufferGeometry) &&
    args[2] instanceof VOBufferPool` prüft doppelt
  - `VOBufferPool.ts:232` — das TSDoc von `fromBuffersData()` beginnt mit einem
    »NOTE:«, das keinen Leser adressiert; die Nachbarn kommen ohne aus
  - **Folge aus Paket 3b:** `CHANGELOG.md`, der Abschnitt
    »A write through a vertex object has to say so« unter `### Migration Guide`
    (bei Paket 3b als `:279-289` notiert; Paket 4 setzt einen weiteren
    `####`-Abschnitt in denselben Guide, und die Überschrift trägt über diese
    Verschiebung hinweg) — der Migrationsabschnitt sagt
    nicht, dass ein von Hand gesetztes `attribute.needsUpdate = true` keinen
    Voll-Upload mehr impliziert. Steht auf dem Attribut ein schmaler Range aus
    einem früheren `update()`, dessen Upload noch aussteht, lädt der Render nur
    diesen hoch und der Schreibvorgang geht verloren. Ein Satz im bestehenden
    Abschnitt genügt, Code ist keiner zu ändern.
  - **Folgen aus Paket 4, hier einsortiert** (Zug 5 von Paket 4, 2026-09-20) —
    dieses Paket fasst denselben Migration Guide an und zielt auf dieselbe Art
    Arbeit; sein Zug 0 triagiert sie:
    `vertex-objects/VertexObjectDescriptor.ts:38` — `readonly description:
    VertexObjectDescription` sagt schreibbare Felder zu, obwohl die Description
    eingefroren ist; der Compiler sagt es an `indices` und `components`, an der
    dritten Tür nicht. Eine tief-readonly Sicht auf die Description-Typen zöge
    alle Verbraucher von `VertexObjectDescription` mit — der Zuschnitt gehört in
    den Detailplan, nicht ins Blaue · `CHANGELOG.md:41` und `:284` — beide
    Aufzählungen nennen fünf der sechs eingefrorenen Dinge, der
    `attributes`-Record fehlt; ein Halbsatz je Stelle ·
    `vertex-objects/VertexObjectDescriptor.spec.ts:144` — die
    `@ts-expect-error`-Direktive deckt die ganze Folgezeile und schluckt dort
    auch einen erfundenen Methodennamen; der `getAttribute()`-Aufruf gehört in
    eine eigene Zeile davor
- Hängt ab von: —
- Aus Zug 0 (2026-09-20): alle zehn Befunde stehen noch, keiner gegenstandslos;
  sieben Fundstellen sind um wenige Zeilen gewandert, der Sachverhalt ist
  überall unverändert. Dazugekommen sind zwei Stellen derselben Ursache:
  `VOBufferPool.ts:77-79` wirft dieselbe nackte Kapazitätsmeldung wie
  `VertexObjectPool.ts:58-60`, und die inneren Maps der
  `extraInstanced*`-Sichten erreichen dasselbe Serial wie die beiden Felder, die
  der Befund nennt. Aus »Offene Befunde« aufgenommen:
  `VertexObjectDescriptor.ts:40-41` — gleiche Ursache wie der ReadonlyMap-Schritt
  dieses Pakets; die übrigen sechs offenen Einträge haben je eine eigene Ursache
  und bleiben für die zweite Drain-Runde liegen. Die tief-readonly Sicht aus der
  Folge von Paket 4 wird als zwei abgeleitete Typen neben
  `VertexObjectDescription` geschnitten statt als Umbau des Typs selbst: so
  berührt sie nur, wer `descriptor.description` liest, und das ist im
  Produktivcode eine Stelle. Modell: stärkste Stufe, Effort `high` — sechs
  öffentliche Felder wechseln ihren Typ, zwei Typen kommen zur `public-api.ts`
  dazu, und der Blast Radius der Verengungen zeigt sich erst im `typecheck`.
- Detail: `docs/remediation/paket-5.md`
- Hash: 663070ec
- Ergebnis: 5 Anläufe (Erstumsetzung und 4 Nachbesserungsrunden), 5 Reviewer ·
  alle zehn Schritte erfüllt und je mit Fundstelle bestätigt · der einzige
  Korrektheitsfehler des Pakets ist behoben und über den Plan hinaus zu Ende
  gebracht: `VertexObjectBuffer#copy()` entscheidet in einem Prüfdurchgang über
  **alle** Ziel-Buffer — Name **und** Elementlänge —, bevor der erste geschrieben
  wird, sodass eine abgewiesene Kopie das Ziel unberührt lässt · Regressionstests
  `a source buffer wider than its target leaves no buffer of the target written`
  und `a source missing one of the buffers leaves no buffer of the target
  written` (beide vor dem Fix rot, der zweite zeigte den halb beschriebenen
  Buffer nackt: `[0,0,0,0,0,0,0,0]` statt `[7,7,7,7,7,7,7,7]`), dazu
  `copy() into a released buffer does nothing, whatever the source brings`,
  `copy() into a buffer over a description without attributes does nothing,
  whatever the source brings` und `fromBuffersData() names itself and both
  capacities for a snapshot of another size`, alle drei ebenfalls vor ihrem Fix
  rot · zwei Stellen mehr als geplant benannt (`VOBufferPool` im Konstruktor und
  in `fromBuffersData()`), eine `NOTE:`-Stelle mehr gestrichen · klein: die
  `@ts-expect-error`-Direktive in `VertexObjectDescriptor.spec.ts:147` deckt
  weiterhin die ganze `expect`-Zeile; vier weitere in der Paketdatei
- Nebenbefunde: → Queue
- Folgen: keine. Die vier Typverengungen haben außerhalb des Pakets genau zwei
  Stellen umgeworfen — `vertex-objects/selectAttributes.ts:3-7` und
  `selectBuffers.ts:4`, beide auf `ReadonlyMap` gezogen —, dazu
  `vertex-objects/VertexAttributeDescriptor.ts:12-15` und `:32`, das jetzt aus
  einer read-only Beschreibung liest. Alle drei sind mitgezogen; `pnpm typecheck`
  über Bibliothek, Specs und Lookbook nennt nichts weiter, `checkPkgTypes` und
  `checkNameableTypes` bestätigen es für die gebaute Deklarationsfläche
- Schnittstellen: `VOBufferGeometry#buffers` und `#bufferSerials` antworten
  `ReadonlyMap`, ebenso `InstancedVOBufferGeometry#baseBuffers` (weiter
  `| undefined`), `#baseBufferSerials`, `#instancedBuffers` und
  `#instancedBufferSerials`; alle sechs sind Getter auf privaten Feldern und
  liegen nicht mehr auf der enumerablen Instanzoberfläche ·
  `#extraInstancedBuffers` und `#extraInstancedBufferSerials` geben
  `ReadonlyMap<string, ReadonlyMap<…>>` heraus, die inneren Maps also mit ·
  `VertexObjectDescriptor#attributes` antwortet `ReadonlyMap<string,
  VertexAttributeDescriptor>`, `#bufferNames` antwortet `ReadonlySet<string>`,
  beide ebenfalls als Getter · `VertexObjectDescriptor#description` hat den Typ
  `FrozenVertexObjectDescription` · zwei neue exportierte Typen in
  `vertex-objects/types.ts`, über `export type * from './types.js'` in der
  `public-api.ts` bereits veröffentlicht: `FrozenVertexObjectDescription` und
  `FrozenVertexAttributeDescription` · `cloneVertexObjectDescription()` nimmt
  zusätzlich eine `FrozenVertexObjectDescription` entgegen und liefert
  unverändert eine veränderbare `VertexObjectDescription` — das ist der Ausweg
  aus allen vier Verengungen und steht so im Migrationsabschnitt ·
  `selectAttributes()` und `selectBuffers()` nehmen `ReadonlyMap<string,
  BufferLike>` · `VertexAttributeDescriptor` nimmt im Konstruktor auch eine
  `FrozenVertexAttributeDescription` · `VOBufferPool#fromBuffersData()` wirft für
  eine unpassende Kapazität einen `RangeError` statt eines nackten `Error`,
  ebenso der `VOBufferPool`-Konstruktor und `VertexObjectPool#resize()` — wer auf
  den alten Meldungstext `'Capacity must be a non-negative integer'` oder
  `'Invalid buffersData capacity'` prüft, prüft ins Leere ·
  `VertexObjectBuffer#copy()` wirft `RangeError` für einen `targetObjectOffset`,
  der kein Integer ab 0 ist, und für eine Quelle, die nicht in das Ziel passt;
  auf einem Buffer ohne Attribute und auf dem eines freigegebenen Pools kehrt es
  weiterhin wortlos zurück

### [x] 6. Die Restposten des Moduls: ehrliche Kommentare, dichte Typen, ein vollständiger Prüfdurchgang

- Nebenbefund: zehn Einträge aus der zweiten Drain-Runde, überwiegend aus Paket 5
  gemeldet. Zwei davon sind Folgen dieses Laufs und damit nicht verhandelbar:
  der Prüfdurchgang aus Paket 5 lässt einen zu schmalen Quell-Buffer durch, und
  zwei Kommentare beschreiben einen Zustand, den der Lauf verändert hat.
- Ziel: Was das Modul über sich selbst sagt — in Kommentaren, Typen und
  Fehlermeldungen — stimmt mit dem überein, was es tut.
- Bereich: `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`,
  `VertexObjectDescriptor.ts`, `cloneVertexObjectDescription.ts` samt Spec,
  `createVertexObjectPrototype.ts`, `createTypedArray.ts`, `types.ts`
- Enthält:
  - **Folge aus Paket 5:** `VertexObjectBuffer.ts:288-348` (`copy()`) — ein
    Quell-Buffer, der **schmaler** ist als sein Ziel, kommt durch den
    Prüfdurchgang, den Paket 5 eingezogen hat. Der Durchgang misst die eine
    Richtung und lässt die andere offen.
  - **Folge aus Paket 5:** `VertexObjectBuffer.ts:247` — der Kommentar »the pool
    behind this buffer has let go, so there is nothing left to upload from it«
    steht über einer Zeile, die das nicht mehr bedeutet
  - `VertexObjectDescriptor.ts:84-85` — der Konstruktor-Kommentar sagt, eine
    spätere Änderung an der übergebenen Description erreiche den Descriptor »no
    longer«; seit dem Einfrieren ist das zu schwach formuliert für das, was
    tatsächlich passiert
  - `VertexObjectBuffer.ts:68` — `readonly buffers: Map<string, AttributeBuffer>`
    ist eine lebende Map mit schreibbaren Einträgen; dieselbe Lücke, die Paket 5
    an den Geometrien geschlossen hat, eine Ebene tiefer
  - `VertexObjectBuffer.ts:7-17` — `AttributeBufferLayout` und die ersten sechs
    Felder von `AttributeBuffer` (`bufferName` bis `serial`) tragen kein TSDoc
  - `createVertexObjectPrototype.ts:155` — `Object.fromEntries(entries as [])`
    castet auf den leeren Tuple-Typ und schleust `entries` (`unknown[]`) am
    Typsystem vorbei
  - `VertexObjectDescriptor.ts:2` und `cloneVertexObjectDescription.ts:2` — die
    beiden Module importieren einander als Wert statt als Typ; es läuft, weil
    beide Seiten es aushalten, ist aber nicht, was der Lint erzwingen soll
  - `cloneVertexObjectDescription.spec.ts:1, 76-80` — `createSandbox` aus `sinon`
    wird importiert, ein `sandbox` angelegt und in `afterEach` zurückgesetzt,
    ohne dass die Datei je etwas darauf stellt
  - `types.ts:121` und `:128` — die `{@link VertexAttributeDescriptor#getterName}`
    und `#setterName` zeigen auf ein Symbol, das diese Datei nicht importiert
  - `createTypedArray.ts:26` — `throw new Error()` nennt den Wert, aber weder
    Modul noch Funktion; die Nachbarstellen des Moduls tun beides
- Hängt ab von: —
- Aus Zug 0 (2026-09-20): alle zehn Befunde stehen noch, keiner gegenstandslos;
  zwei Fundstellen sind gewandert (`VertexObjectDescriptor.ts:84-85` → `:96-98`,
  `cloneVertexObjectDescription.ts:2` → `:8`). Ein Befund hat eine andere Ursache
  als gemeldet: **beide** Module brauchen einander als Wert, nicht nur als Typ
  (`VertexObjectDescriptor.ts:99` ruft die Klonfunktion,
  `cloneVertexObjectDescription.ts:79` prüft `instanceof`) — ein `import type`
  bräche den Code. Der Zyklus wird deshalb dort aufgelöst, wo der Wert nur eine
  Weiche stellt: die `instanceof`-Weiche wird eine `in`-Weiche über die Union,
  danach reicht der Typ-Import. Zwei Befunde sind im Umfang gemessen und
  präzisiert: bei `VertexObjectBuffer.ts:7-17` sind es fünf Felder plus das
  Interface (`typedArray` hat seit Paket 5 ein TSDoc), bei den TSDoc-Links in
  `types.ts` sechs Stellen statt zwei — dieselbe Ursache, dieselbe Datei. Nicht
  aufgenommen: dieselbe Link-Machart in sieben weiteren Moduldateien, 19 Stellen,
  überwiegend vorbestehend — steht als neuer Eintrag in »Offene Befunde«, weil
  die Entscheidung je Stelle neu fällt und sechs fremde Dateien in den Diff zöge.
  Modell: stärkste Stufe, Effort `high` — ein Korrektheitsfehler mit
  Regressionstest, dazu eine Typverengung auf der öffentlichen Oberfläche, deren
  Blast Radius sich erst im `typecheck` zeigt.
- Detail: `docs/remediation/paket-6.md`
- Hash: 07277e2d
- Ergebnis: 1 Runde · alle elf Schritte erfüllt, kein kritischer und kein
  wichtiger Befund · Regressionstests
  `a source buffer narrower than its target leaves no buffer of the target written`,
  `a source of another data type leaves no buffer of the target written` und
  `a source describing another vertex count leaves no buffer of the target written`
  in `VertexObjectBuffer.spec.ts`, alle drei vor dem Fix rot · eine gemeldete
  Abweichung: das CHANGELOG bekommt entgegen Schritt 11 einen Migrationsabschnitt
  zur read-only Buffer-Map, weil der Skill `updating-changelog` ihn für den
  Breaking Change an der Typfläche verlangt und Schritt 11 die Frage dem Skill
  überlässt · klein: ein zu lascher Regex in `VertexObjectBuffer.spec.ts:594`,
  eine zu breite Zusage über die `in`-Weiche; beide in der Paketdatei
- Nebenbefunde: → Queue
- Folgen: keine. Außerhalb von `VertexObjectBuffer` schreibt allein
  `VOBufferPool.ts:289` ein Feld eines `AttributeBuffer`, und diese Stelle ist
  über `setTypedArray()` mitgezogen; `pnpm run ci` nennt nichts weiter
- Schnittstellen: `VertexObjectBuffer#buffers` ist ein Getter auf einem privaten
  Feld und antwortet `ReadonlyMap<string, Readonly<AttributeBuffer>>` — die
  Buchführung eines Buffers (`serial`, die Dirty-Felder) und die Map selbst sind
  von außen nicht mehr schreibbar, der Inhalt der typed arrays bleibt es ·
  `VertexObjectBuffer#setTypedArray(bufferName, typedArray)` ist neu, trägt
  `@internal` und steht **nicht** in der `public-api.ts` — sie ist der benannte
  Weg, auf dem der Pool beim Wiedereinspielen eines Snapshots ein ganzes Array
  ersetzt, und tut für einen unbekannten Buffernamen nichts ·
  `VertexObjectBuffer#copy()` entscheidet über beide Layouts, bevor der erste
  Buffer geschrieben wird: abweichender `vertexCount` der Descriptoren oder
  abweichende `itemSize` eines Buffer-Paares werfen `RangeError`, ein
  abweichender `dataType` wirft `TypeError`, alle drei mit Buffernamen und beiden
  Werten; eine abgewiesene Kopie lässt das Ziel unberührt ·
  `cloneVertexObjectDescription()` unterscheidet Descriptor und Description
  strukturell über `'description' in source` statt über `instanceof`, Signatur
  und Überladungen unverändert

