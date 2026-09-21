# Remediation-Plan — twopoint5d

Quelle: ./audit.html vom 2026-09-21 · Branch: main · erstellt: 2026-09-21
Baseline: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes,
checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser)
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/0c5913dd-6536-4b42-94b0-31ab542295ab/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 3 von 196 Findings (1 high, 1 medium, 1 low), vom Nutzer per ID gewählt: ASYNC-004, BUG-100, MEM-014 · ausgenommen: alle übrigen, acknowledged
Scope-Regel: alles, was den Abbau von Display/Renderer und die Freigabe seiner Ressourcen betrifft (display, Dispose von vertex-objects, die zugehörigen Browser-Tests) — gilt auch für Befunde, die erst im Lauf auffallen; alles andere geht als neues Finding ins Audit
Kaltstarts: 2 Pakete × mindestens 3 Agenten ≈ 6, je Nachrunde zwei mehr · 1,5 Findings je Paket (Paket 1 in Zug 0 geteilt: MEM-014 hat eine eigene Ursache und einen offenen Ausgang)
Stand (2026-09-21): Lauf abgeschlossen · 4 Pakete committet, keines blockiert · Befund-Queue leer (7 Einträge als neue Findings ins Audit, zusammen mit einem induzierten Befund aus Paket 4)

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` blockiert.

## Entscheidungen
- `Display#dispose()` bleibt synchron und behält seine Signatur: `stop()` läuft
  sofort, `renderer.dispose()` hängt an einer abgefangenen Kette — erst das
  laufende Init abwarten (auch ein gescheitertes, ohne Unhandled Rejection),
  dann `device.queue.onSubmittedWorkDone()`. Kein neues `disposeAsync()`, kein
  Aufrufer muss etwas ändern (2026-09-21)
- Das Drain gegen den Firefox-Fehler wird eingebaut, ohne dass das Verhalten
  auf echter Hardware geprüft ist; die Severity bleibt medium. Die Prüfung auf
  echter Hardware und der Bug-Report an Mozilla gehen als offene Aufgabe des
  Nutzers in den Abschlussreport (2026-09-21)
- Heap-Wachstum (MEM-014) nach der Empfehlung: Ursache per Heap-Snapshot
  isolieren; liegt sie in der Bibliothek, dort beheben und `MAX_HEAP_GROWTH`
  auf 0,1 zurücknehmen; liegt sie in three, den Cache im Test-Kommentar
  benennen und die Grenze begründet stehen lassen (2026-09-21)
- Paket 3 nach der Blockade fortsetzen: `stash@{0}` »paket-3-abgebrochen« anwenden
  (grüner Stand aus Runde 1), den fehlenden Testfall ergänzen, der den
  Nachfolger-Display erst nach dem Ende der Freigabe baut, und den ersten Fall
  umbenennen, nach dem Muster unter »Stand bei Blockade« in
  `docs/remediation/paket-3.md`; danach Verify, gezielter Review, Commit. Kein
  Umbau (2026-09-21)

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
- `AGENTS.md` im Repo-Root ist vor der ersten Änderung zu lesen; `dispose()`
  und Ownership folgen verbindlich `packages/twopoint5d/docs/resource-lifecycle.md`.
- Commit-Messages auf Englisch im Conventional-Commits-Stil von `git log`.

## Vorbestehende Fehler
- keine — die Baseline ist vollständig grün

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

Leer. Die `→ Audit`-Einträge stehen als neue Findings in `./audit.html` (Nachführung vom 2026-09-21); der Nebenbefund aus Paket 4 kam nach der dritten Drain-Runde und ging deshalb ebenfalls ins Audit.

## Pakete

### [x] 1. Display-Abbau: Renderer erst nach Init und Drain freigeben
- Findings: ASYNC-004 (high), BUG-100 (medium)
- Ziel: `Display#dispose()` bleibt synchron und gibt den Renderer in jedem Zustand (Init läuft, Init gescheitert, Arbeit eingereicht) vollständig und ohne Unhandled Rejection frei — erst nach dem Init, dann nach dem Leerlaufen der GPU-Queue.
- Bereich: `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d-testing/test/` (Dispose-Tests, `stopAndDrain` aus allen Teardowns, Helfer gelöscht), Doku (`resource-lifecycle.md`, `stage/README.md`, `docs/architecture.md`, CHANGELOG)
- Hängt ab von: —
- Geteilt in Zug 0: MEM-014 ging in Paket 2 — eigene Ursache (Zuwachs bei lebendem Display) und offener Ausgang der Untersuchung, die den Dispose-Fix nicht mitblockieren soll.
- Detail: `docs/remediation/paket-1.md`
- Hash: 049ba431
- Ergebnis: 1 Runde · ASYNC-004 und BUG-100 behoben (Reviewer) · Regressionstests in
  `display-dispose.test.js`: `releases the renderer once an init that dispose() landed in is
  through` (vor dem Fix rot, Chromium und Firefox), `lets no rejection escape when the init
  that dispose() landed in fails` (rot, beide), `releases the renderer only after the GPU has
  run the work submitted to it` (rot auf Firefox/WebGPU, auf Chromium/WebGL2 übersprungen) ·
  `stopAndDrain` aus allen 16 Teardowns entfernt, Helfer gelöscht, Firefox-Suite grün ·
  klein: Zeile 89 Zeichen und Doppelung in `docs/architecture.md:264-265`, Satzbau im
  Konstruktor-TSDoc `Display.ts:395-396`, `stage/README.md:474-477` nennt die Ausnahme
  »Init gescheitert« nicht
- Nebenbefunde: → Queue (4 Einträge)
- Folgen: keine neuen; der Canvas-Befund in »Offene Befunde« greift wie in Zug 0
  vorhergesagt jetzt auch bei `dispose()` während des Init
- Schnittstellen: `Display#dispose()` Signatur unverändert, gibt `renderer.dispose()` aber
  erst nach der Rückkehr frei (nach Init und `onSubmittedWorkDone()`); ein Test, der die
  Freigabe prüft, muss darauf warten · `packages/twopoint5d-testing/test/support/stopAndDrain.js`
  entfernt — Teardowns rufen `dispose()` direkt, auch in `vertex-objects-heap.test.js`

### [x] 2. Heap-Zuwachs der Aufbau-/Abbau-Runden klären
- Findings: MEM-014 (low)
- Ziel: Der lineare Heap-Zuwachs über die Runden in `vertex-objects-heap.test.js` ist per Heap-Snapshot einer Ursache zugeordnet — in der Bibliothek behoben und `MAX_HEAP_GROWTH` auf 0,1, oder als Cache in three im Test-Kommentar benannt (Entscheidung vom 2026-09-21).
- Bereich: `packages/twopoint5d-testing/test/vertex-objects-heap.test.js`; bei Ursache in der Bibliothek `packages/twopoint5d/src/vertex-objects/` oder `src/display/`
- Hängt ab von: 1 (dieselbe Testdatei; Paket 1 nimmt `stopAndDrain` aus ihrem Teardown)
- Aus Paket 1 geteilt (Zug 0, 2026-09-21)
- Detail: `docs/remediation/paket-2.md`
- Hash: cf337e90
- Ergebnis: 2 Runden · MEM-014 behoben als Ausgang (a), Ursache in three (Reviewer) ·
  Snapshot-Sonde auf Chromium 153/WebGL2, three 0.185.1: V1 wie im Test 11,70 %, V2 Material
  je Block 2,2 % über 80 Runden, V3 nur Bibliothek 0,20 %, V4 reines three-Mesh 5,24 % ·
  bestätigt: `RenderObject` je Mesh über `material._listeners.dispose` (hält Mesh, entsorgte
  Geometrie, Typed Arrays, Uniform-Gruppe) — three gibt es frei bei `material.dispose()` oder
  Cache-Key-Wechsel, **nicht** mit dem Renderer; `WebGLBackend.vaoCache` je Attribut-Satz —
  three gibt ihn **nie** frei (kein `deleteVertexArray`, auch nicht in `dispose()`), erst der
  GC des Renderers · Kommentar `vertex-objects-heap.test.js:12-33` benennt beides,
  `MAX_HEAP_GROWTH` bleibt 0,15 · Verify growth 11,79 / 11,79 / 11,79 % · kein
  Regressionstest (kein Bibliotheksfix) · klein: V2-Rest im Kommentar (»the vertex-array cache
  plus JIT code«) deckt im Snapshot nur ≈ 1,6 von 3 KB je Runde; »all of it goes once the
  material is garbage collected« gilt nicht für die Uniform-Gruppe (hängt auch in
  `Info.memoryMap`); die Commit-Message sagt »as the cause«, obwohl JIT-Code mitzählt
- Nebenbefunde: → Queue (3 Einträge)
- Folgen: keine — nur Test-Kommentar geändert
- Schnittstellen: keine

### [x] 3. Display-Abbau: Canvas wiederverwendbar halten, Doku und Test-Kommentare nachziehen
- Nebenbefund: `packages/twopoint5d/src/display/Display.ts:938` (`#releaseRenderer`) (medium, geschätzt) — ein Canvas, der einem `Display` übergeben wurde, trägt nach dessen `dispose()` im WebGL-Backend keinen zweiten Display: three verliert in `WebGLBackend.dispose()` den Kontext (`loseContext()`, three 0.185.1 `WebGLBackend.js:2833-2834`), derselbe Canvas liefert danach denselben, verlorenen Kontext; seit Paket 1 auch bei `dispose()` während des Init (Remount unter React StrictMode auf demselben `<canvas>`) — im Code gelesen, nicht im Browser gesehen (aus Paket 1, Zug 0; Reichweite von diesem Lauf geöffnet)
- In Zug 0 herausgenommen: `packages/twopoint5d/docs/resource-lifecycle.md:5-6` und `:55` (Abschnittsverweise) — deckungsgleich mit DOC-034 (low, carried-over), das außerhalb des per ID gewählten Scopes liegt; bleibt im Audit, kein neues Finding
- Nebenbefund: `packages/twopoint5d/docs/resource-lifecycle.md` §5 three.js interop (low) — nennt nicht, dass ein langlebiges, geteiltes Material in three je gerendertem Mesh ein `RenderObject` samt entsorgter Geometrie und Typed Arrays festhält, bis `material.dispose()` läuft (aus Paket 2, Reviewer)
- Nebenbefund: `packages/twopoint5d-testing/test/vertex-objects-heap.test.js:98` (low) — »a cold webgpu start — adapter plus device — happens in the hook« stimmt für Chromium nicht, dort läuft WebGL2 (aus Paket 2)
- Nebenbefund: `packages/twopoint5d-testing/test/vertex-objects-heap.test.js:164` (low) — Assertion-Meldung »geometries given up their renderer slot« grammatisch schief (aus Paket 2)
- Folge von: 1 — Reviewer-klein aus Paket 1: `docs/architecture.md:264-265` Zeile mit 89 Zeichen und Doppelung; Satzbau im Konstruktor-TSDoc `packages/twopoint5d/src/display/Display.ts:395-396`; `packages/twopoint5d/src/stage/README.md:474-477` nennt die Ausnahme »Init gescheitert« nicht
- Folge von: 2 — Reviewer-klein aus Paket 2: Kommentar `vertex-objects-heap.test.js:12-33` — der V2-Rest (»the vertex-array cache plus JIT code«) deckt im Snapshot nur ≈ 1,6 von 3 KB je Runde; »all of it goes once the material is garbage collected« gilt nicht für die Uniform-Gruppe (hängt auch in `Info.memoryMap`)
- Nebenbefund (Zug 0): `packages/twopoint5d/docs/architecture.md:87`, `packages/twopoint5d/src/stage/README.md:13` und `:44` (low) — Kurzbeschreibungen »Display owns the canvas«; ein übergebener Canvas gehört dem Aufrufer. Vorbestehend (`0ba859d7`), dieselbe Ursache wie der Canvas-Befund, ins Paket genommen
- Ziel: Ein Canvas trägt nach `Display#dispose()` einen neuen `Display`, und Doku, TSDoc und Test-Kommentare rund um den Abbau sagen, was der Code tut.
- Bereich: `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/docs/resource-lifecycle.md` (§5), `packages/twopoint5d/docs/architecture.md`, `packages/twopoint5d/src/stage/README.md`, `docs/architecture.md`, `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d-testing/test/` (`display-dispose.test.js`, `vertex-objects-heap.test.js`)
- Hängt ab von: 1, 2
- Aus der Drain-Runde (2026-09-21), gedeckt von der Scope-Regel
- Detail: `docs/remediation/paket-3.md`
- Hash: 1087d55d
- Ergebnis: 3 Runden (Runde 0, Runde 1, nach Blockade Runde 2 per Resume) · Canvas-Befund
  behoben und alle Doku-/Kommentar-Einträge nachgezogen (Reviewer 0–2) · Regressionstests in
  `display-dispose.test.js`: `a canvas that was handed in carries a second display built while
  the first one is being released` und `… when dispose() lands in the init of the first one`
  (beide vor dem Fix rot auf Chromium), `a WebGL context that does not come back holds the next
  display on its canvas up for a bounded time` (rot auf Chromium, auf Firefox übersprungen),
  `keeps its WebGL context lost while no display follows` (rot vor dem Umbau in Runde 1),
  `a canvas that was handed in carries a second display built after the first one has been
  released` (rot unter der Mutationsprobe, Bedingung `lost == null` in `#releaseRenderer()`
  gestrichen) · Verify `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 · klein: nach einem Timeout
  löscht `takeOverCanvas()` den Eintrag trotz totem Kontext; Doku sagt nicht, dass nur ein
  `Display` den Kontext zurückholt; Kommentar im neuen Fall nennt nur WebGL
- Nebenbefunde: → Queue (bereits eingetragen: `vertex-objects-heap.test.js:130`,
  `stage/README.md`-Abschnittsverweise, `styleImageRendering`-TSDoc, Überlängen in
  `resource-lifecycle.md`)
- Folgen: keine
- Schnittstellen: `Display#dispose()` Signatur unverändert · unter WebGL bleibt der Kontext eines
  übergebenen Canvas nach der Freigabe verloren, bis ein neuer `Display` auf dem Canvas ihn
  wiederherstellt; der Konstruktor wartet dafür auf die laufende Freigabe des Vorgängers
  (höchstens 2000 ms, danach `console.warn` und Start auf dem verlorenen Kontext) · neue
  Test-Helfer in `display-dispose.test.js`: `whenReleased(renderer)`, `expectLiveBackend(display)`

### [x] 4. Display-Abbau: Canvas-Übernahme nach Timeout und Test-Teardown nachziehen
- Nebenbefund: `packages/twopoint5d-testing/test/vertex-objects-heap.test.js:130` (low) — `afterEach` setzt `material = undefined` ohne `material.dispose()`; die `RenderObject`s und die Uniform-Gruppe in `info.memoryMap` bleiben bis dahin hängen · vorbestehend (`0ba859d7`, Zeile 113) (aus Paket 3)
- Folge von: 3 — Reviewer-klein: nach einem Timeout löscht `takeOverCanvas()` den Eintrag trotz totem Kontext (`packages/twopoint5d/src/display/`)
- Folge von: 3 — Reviewer-klein: die Doku sagt nicht, dass nur ein `Display` den verlorenen WebGL-Kontext eines übergebenen Canvas zurückholt (`packages/twopoint5d/docs/resource-lifecycle.md`, `packages/twopoint5d/src/stage/README.md`, `packages/twopoint5d/CHANGELOG.md`, TSDoc in `Display.ts`)
- Folge von: 3 — Reviewer-klein: der Kommentar im neuen Testfall in `packages/twopoint5d-testing/test/display-dispose.test.js` nennt nur WebGL
- Ziel: Die Canvas-Übernahme behandelt einen nach Timeout toten Kontext folgerichtig, die Doku sagt, wer den Kontext zurückholt, und der Heap-Test räumt sein Material ab.
- Bereich: `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/docs/resource-lifecycle.md` (§1), `packages/twopoint5d/src/stage/README.md`, `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d-testing/test/` (`display-dispose.test.js`, `vertex-objects-heap.test.js`)
- Hängt ab von: 3
- Aus der Drain-Runde 2 (2026-09-21), gedeckt von der Scope-Regel
- Zug 0: dieselbe Ursache wie die Timeout-Folge auch in `#releaseRenderer()` — ins Paket genommen; der verlorene Kontext bekommt eine eigene modulinterne Map neben `canvasReleases`, keine Änderung an Exporten oder Signaturen
- Detail: `docs/remediation/paket-4.md`
- Hash: 88019d0c
- Ergebnis: 1 Runde · Timeout-Folge (beide Stellen), Doku-Folge, Testkommentar-Folge und
  Heap-Teardown behoben (Reviewer) · Regressionstest in `display-dispose.test.js`: `a WebGL
  context that did not come back in time gets another restore from the next display on its
  canvas` (vor dem Fix rot auf Chromium, auf Firefox übersprungen) · Verify
  `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 · klein: Kommentar über
  `CONTEXT_RESTORE_TIMEOUT_MS` über den Detailplan hinaus mitgezogen; kommt der Kontext erst nach
  dem Timeout zurück, bleibt der `lostContexts`-Eintrag mit lebendem Kontext stehen, bis der
  nächste `Display` ihn herausnimmt (harmlos, die Map-Beschreibung stimmt dort nur ungefähr)
- Nebenbefunde: → Queue (1 Eintrag: Listener eines gescheiterten WebGL-Inits)
- Folgen: keine
- Schnittstellen: keine Exporte oder Signaturen geändert · modulintern in `Display.ts`:
  `canvasReleases` hält nur noch `Promise<void>` der laufenden Freigabe, neue WeakMap
  `lostContexts` hält den verlorenen Kontext eines Canvas, solange er verloren ist · jeder neue
  `Display` auf einem Canvas mit verlorenem Kontext wartet erneut höchstens 2000 ms und warnt
