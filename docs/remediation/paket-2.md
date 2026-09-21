# Paket 2 — Heap-Zuwachs der Aufbau-/Abbau-Runden klären

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: MEM-014 (low)
- Ziel: Der lineare Heap-Zuwachs über die Runden in `vertex-objects-heap.test.js` ist per
  Heap-Snapshot einer Ursache zugeordnet — in der Bibliothek behoben und `MAX_HEAP_GROWTH`
  auf 0,1, oder als Cache in three im Test-Kommentar benannt (Entscheidung vom 2026-09-21).
- Modell: stärkste Stufe (`opus`) — eine Untersuchung mit offenem Ausgang über die Grenze
  zwischen Bibliothek und three, dazu eigenes Snapshot-Werkzeug; der Blast Radius steht erst
  nach dem Snapshot fest
- Effort: high — Blast Radius unklar. Die Leitplanken unter »Grenzen« halten den Umfang
- Dateien:
  - immer: `packages/twopoint5d-testing/test/vertex-objects-heap.test.js`
  - nur wenn die Ursache ganz oder teilweise in der Bibliothek liegt: die betroffene Datei
    unter `packages/twopoint5d/src/vertex-objects/` oder `packages/twopoint5d/src/display/`,
    ein Vitest-Spec daneben, `packages/twopoint5d/CHANGELOG.md`
  - nur während der Untersuchung, vor dem Report restlos gelöscht:
    `packages/twopoint5d-testing/probe/`
- Verify: `pnpm run ci && (cd packages/twopoint5d-testing && for i in 1 2 3; do pnpm exec web-test-runner "test/vertex-objects-heap.test.js" --config web-test-runner.config.js || exit 1; done)`
  — die drei Einzelläufe am Ende liefern je eine Zeile `[heap] samples … · growth X % of the
  first sample` ins Log; alle drei Werte gehören ins `Ergebnis:`
- Commit: je nach Ausgang, siehe Schritt 6
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · MEM-014 unverändert, um eine Zeile verschoben
    (`vertex-objects-heap.test.js:12-17` statt `:13-18`, Paket 1 hat den
    `stopAndDrain`-Import entfernt), Schleife und Grenze identisch · nachgemessen auf
    Chromium 153.0.8010.12 (Playwright 1.63): 11,79 %, 11424830 → 12771522 Byte, ≈ 13,5 KB je
    Runde, Log `paket-2.zug0-heap-baseline.log` im Arbeitsverzeichnis · Folge aus Paket 1
    (Canvas bei `dispose()` während des Init) als vorbestehende Ursache eingeordnet, bleibt
    `→ Scope` in »Offene Befunde«, Fundstelle auf `Display.ts:938` nachgeführt · übrige
    Nebenbefunde ohne gemeinsame Ursache, bleiben liegen · Restplan unverändert
  - 2026-09-21 Zug 1: Implementierer beauftragt, `opus`, Effort high · Brief
    `paket-2.impl-0.brief.txt`, Report nach `paket-2.impl-0.json` im Arbeitsverzeichnis
  - 2026-09-21 Zug 2: Report `FERTIG`, Ausgang (a) — V1 11,70 %, V2 0,58 %, V3 0,20 %, V4
    5,24 %; beide Verdachtsstellen bestätigt · geändert nur
    `packages/twopoint5d-testing/test/vertex-objects-heap.test.js` (Kommentar `:12-23`, Wortlaut
    `:107-110`), `probe/` gelöscht · Arbeitsbaum schmutzig · eigener Verify läuft, Log
    `paket-2.verify.log` · Verify exit=0, `growth` 11,79 / 11,79 / 11,78 %
  - 2026-09-21 Zug 3: Reviewer `sonnet`/high, Diff `paket-2.diff` · MEM-014 Ausgang (a) getragen,
    Kommentar mit 3 × wichtig (V2-Zahl 0,6 % nicht vergleichbar gemessen; »all of it inside
    three« zu absolut; Typed Arrays über `RenderObject.attributes` fehlen), 7 × klein
  - 2026-09-21 Zug 4 Runde 1: 3 offen, Resume des Implementierers (`opus`/high) mit den drei
    wichtigen und den kleinen Punkten 4, 6, 7, 9 · Report nach `paket-2.impl-1.json`
    · zurück `FERTIG`: V2-Rest nachgerechnet 2,2 % über 80 Runden, »three retaining what grows«
    samt JIT-Anteil, Typed Arrays (144 B je Runde) aufgenommen, Kommentar jetzt `:12-33` ·
    Verify 2 exit=0, growth 11,79 / 11,79 / 11,79 %, Log `paket-2.verify-2.log` · Review 1
    (`sonnet`/high, Diff `paket-2.diff-2`): 0 offen (vorher 3), 3 × klein
  - 2026-09-21 Zug 5: Commit cf337e90 (`test: name the render objects …`), Trailer
    `Remediation-Run: 2026-09-21` · 2 Runden · Plan auf `[x]`

## Ausgangslage, gemessen in Zug 0

Der Test baut einen `Display` auf und lässt ihn über alle Runden leben. Jede Runde erzeugt
eine `InstancedVertexObjectGeometry` (Basis-Pool 1 Quad, Instanz-Pool Kapazität 8) und einen
`VertexObjects`-Mesh mit **demselben** `MeshBasicNodeMaterial` für alle Runden, rendert einmal,
wartet `display.nextFrame()` ab, nimmt den Mesh aus der Szene und ruft `geometry.dispose()`.
Der Mesh selbst wird nie entsorgt (hat kein `dispose()`), das Material erst im `afterEach`
fallen gelassen. 20 Aufwärmrunden, dann 100 Runden mit einer Probe alle 20.

Chromium läuft im Test mit dem WebGL2-Backend von three (`THREE.WebGPURenderer: WebGPU is not
available, running under WebGL2 backend.` im Browser-Log). Firefox überspringt die Datei im
`before()`. Jede Aussage dieses Pakets gilt deshalb für Chromium headless mit WebGL2 — genau
diese Umgebung wird untersucht, keine andere.

## Verdacht aus dem Code — gelesen, nicht im Heap gesehen

Beide Stellen sind Hypothesen aus Zug 0. Der Snapshot bestätigt oder verwirft sie; keine von
beiden darf ungeprüft in den Kommentar.

1. **three hält je Mesh ein `RenderObject` am geteilten Material fest.** Der Konstruktor von
   `RenderObject` hängt `onMaterialDispose` als `dispose`-Listener an das Material und
   `onGeometryDispose` an die Geometrie
   (`node_modules/.pnpm/three@0.185.1/node_modules/three/src/renderers/common/RenderObject.js:325-352`).
   `geometry.dispose()` löst nur `onGeometryDispose` aus, und der setzt bloß
   `attributes`/`attributesId` auf `null` (`:337-342`). Entfernt werden die Listener erst in
   `RenderObject#dispose()` (`:958-969`), und das läuft bei `material.dispose()` oder bei einem
   Wechsel des Cache-Keys (`RenderObjects.js:126-136`). Über
   `material._listeners.dispose` (Feld aus `core/EventDispatcher.js:33`) bleiben so je Runde ein
   `RenderObject`, der `VertexObjects`-Mesh, die entsorgte Geometrie und alles, was three unter
   dem `RenderObject` als Schlüssel ablegt (Node-, Binding-, Pipeline-Daten), erreichbar. Die
   `ChainMap` selbst ist eine `WeakMap` und hielte nichts fest.
2. **Das WebGL-Backend legt je Attribut-Satz einen VAO ab und gibt ihn nie frei.**
   `WebGLBackend.vaoCache` ist ein einfaches Objekt (`webgl-fallback/WebGLBackend.js:135`),
   gefüllt in `:901-907` und `:1104-1112`, Schlüssel aus den IDs der Attribute (`_getVaoKey`,
   `:2488-2500`). Jede Runde bringt neue Attribute, also einen neuen Schlüssel; ein
   `deleteVertexArray` gibt es im ganzen Backend nicht. Das wüchse auch, wenn das Material
   entsorgt würde, und endet erst mit dem Renderer.

Auf Seiten der Bibliothek hat Zug 0 nichts gefunden, was eine Runde überlebt:
`VOBufferGeometry#dispose()` und `InstancedVOBufferGeometry#dispose()` geben Routen, Slots,
Index und eigene Pools frei, `VOBufferPool#dispose()` ruft `buffer.release()`, `vertex-objects/`
hat keinen modulweiten Zustand, und `Display#nextFrame()` (`Display.ts:994-1009`) räumt beide
`once`-Listener wieder ab. Das ist gelesen, nicht gemessen — Variante 3 unten misst es.

## Vorgehen

Vorher lesen: `AGENTS.md`, in `packages/twopoint5d/docs/resource-lifecycle.md` die Abschnitte
1 (Ownership), 3 (After `dispose()`) und 5 (three.js interop), den Heap-Test ganz, die unter
»Verdacht« genannten Stellen in three.

1. **Ausgangswert.** Den Heap-Test dreimal einzeln laufen lassen und die drei
   `growth`-Werte notieren:
   `cd packages/twopoint5d-testing && pnpm exec web-test-runner "test/vertex-objects-heap.test.js" --config web-test-runner.config.js`
   (in Zug 0 so gelaufen, Exit 0, die `[heap]`-Zeile steht unter »Browser logs on
   Chromium«). Der Test lädt `packages/twopoint5d/dist/lib/index.js`: nach jeder Änderung an
   `src/` erst `pnpm build:twopoint5d`.

2. **Sonden-Harness, temporär unter `packages/twopoint5d-testing/probe/`.** Nichts davon wird
   committet.
   - `probe/web-test-runner.probe.config.js`: die Projektkonfiguration
     `web-test-runner.config.js`, reduziert auf den Chromium-Launcher mit **identischen**
     `launchOptions.args` (`--enable-precise-memory-info`, `--js-flags=--expose-gc`),
     derselben `testRunnerHtml`, `rootDir: '../../'`, `files: 'probe/**/*.test.js'`. Dazu am
     Launcher der Hook `createPage` (vorhanden in `@web/test-runner-playwright` 1.0.0,
     `dist/index.d.ts:9`, Signatur `({context, ...}) => Promise<Page>`): Seite anlegen,
     `context.newCDPSession(page)`, und per `page.exposeFunction('__heapSnapshot', async (name) => …)`
     eine Funktion bereitstellen, die über CDP `HeapProfiler.takeHeapSnapshot` auslöst, die
     `HeapProfiler.addHeapSnapshotChunk`-Stücke sammelt und als
     `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0c5913dd-6536-4b42-94b0-31ab542295ab/scratchpad/paket-2.heap-<name>.heapsnapshot`
     schreibt (`<name>` ist das Argument, etwa `v1-first`). Snapshots gehören nicht ins Repo.
   - Ein Fixture-Modul `probe/fixture.js` mit dem Aufbau aus dem Heap-Test (Container,
     `Display`, Szene, Kamera, Material mit `positionNode`, dieselben beiden Beschreibungen,
     `sampleHeap()` wie im Test).
   - Je Variante eine eigene Datei — web-test-runner gibt jeder Datei eine frische Seite, so
     verfälscht keine Variante den Heap der nächsten. Jede Variante: 20 Aufwärmrunden, dann
     100 Runden mit Probe alle 20, Ausgabe per `console.log` als eine Zeile mit den sechs
     Proben, dem Zuwachs in Prozent und in Byte je Runde, dazu diese Zähler nach dem Aufwärmen
     und am Ende: `material._listeners?.dispose?.length ?? 0`,
     `Object.keys(display.renderer.backend.vaoCache ?? {}).length`,
     `display.renderer.info.memory.geometries`.
   - Aufruf: `cd packages/twopoint5d-testing && pnpm exec web-test-runner --config probe/web-test-runner.probe.config.js`

3. **Die Varianten** — das »einzeln abbauen« der Audit-Empfehlung:
   - **V1 wie im Test:** die Runde unverändert. Snapshots `v1-first` direkt nach der ersten
     Probe und `v1-last` nach der letzten. Danach `display.dispose()`, warten, bis der
     Renderer frei ist (auf WebGL2 gibt es keine GPU-Queue; ein paar `setTimeout`-Runden
     reichen), Probe und Snapshot `v1-after-display`. Dann `material.dispose()`, Probe und
     Snapshot `v1-after-material`. So zeigt sich, woran die gewachsenen Objekte hängen: am
     Renderer, am Material oder an keinem von beiden.
   - **V2 Material je Block:** wie V1, aber vor jeder Probe `material.dispose()` und ein
     frisches, gleich gebautes Material für die nächsten 20 Runden. Fällt der Zuwachs auf den
     Rest, den der VAO-Cache erklärt, ist Verdacht 1 der Hauptanteil.
   - **V3 nur Bibliothek:** Geometrie, VOs und `VertexObjects` bauen und abbauen wie in V1,
     aber ohne `scene.add`, ohne `render`, mit `await display.nextFrame()`. Misst, was
     `vertex-objects` und `Display` allein zurücklassen.
   - **V4 nur three:** statt `InstancedVertexObjectGeometry`/`VertexObjects` eine
     `InstancedBufferGeometry` mit einem `BufferAttribute` `position` (4 Vertices, `vec3`),
     Index `[0, 1, 2, 0, 2, 3]`, einem `InstancedBufferAttribute` `instanceOffset` (8 × `vec3`),
     `instanceCount = 1`, dazu ein `THREE.Mesh` mit demselben geteilten Material; rendern,
     `nextFrame()`, entfernen, `geometry.dispose()`. Wächst V4 wie V1, liegt die Ursache
     nicht in der Bibliothek.

4. **Snapshots auswerten.** Ein kleines Node-Skript in `probe/`, das die
   `.heapsnapshot`-Dateien parst (Felder nach `snapshot.meta.node_fields`, `edge_fields`,
   `node_types`; Namen aus `strings`): je Konstruktorname Anzahl und Self-Size in `v1-first`
   und `v1-last`, sortiert nach Differenz. Erwartet sind Namen, die um 100 oder ein Vielfaches
   wachsen. Für die drei größten Zuwächse je einen Retainer-Pfad eines Exemplars rückwärts bis
   zu einem langlebigen Objekt (Material, Backend, Renderer, Fenster). Dasselbe knapp für
   `v1-after-display` und `v1-after-material`: welche der gewachsenen Namen sind dort weg.

5. **Einordnen und umsetzen** — nach der Entscheidung vom 2026-09-21, ohne neue Wege:
   - **(a) Ursache in three** — V3 wächst nicht messbar, V4 wächst wie V1, die Retainer-Pfade
     enden an three-Objekten. Keine Änderung an der Bibliothek. Im Heap-Test den Kommentar
     `:12-16` neu schreiben: welche Objekte three je Runde behält, über welche Referenz, und
     wann three sie freigibt (etwa: bis `material.dispose()`; bis der Renderer geht), dazu der
     gemessene Zuwachs mit Chromium-Version, und warum die Grenze darüber liegt — sie lässt
     genau diesen Zuwachs durch und fängt alles darüber. Nur benennen, was der Snapshot gezeigt
     hat; eine Hypothese, die er nicht trägt, fliegt raus. `MAX_HEAP_GROWTH` bleibt `0.15`.
     Den Kommentar `:100-102` (ein Material für die ganze Schleife) daraufhin lesen: er bleibt,
     wird aber im Wortlaut angepasst, falls er dem neuen Kommentar oben widerspricht.
   - **(b) Ursache in der Bibliothek** — V3 wächst, oder ein Retainer-Pfad läuft über ein
     Bibliotheksobjekt, das nach `resource-lifecycle.md` §1/§3 etwas hätte freigeben müssen.
     Zuerst rot: `MAX_HEAP_GROWTH = 0.1` setzen, Heap-Test laufen lassen, der rote Lauf
     (≈ 11,8 % über 10 %) gehört in den Report. Lässt sich die gefundene Haltestelle
     deterministisch prüfen (ein Feld, eine Map, ein Listener, der nach `dispose()` frei sein
     muss), dazu einen Vitest-Spec neben der Quelle, ebenfalls erst rot. Dann den Fix in der
     Quelle, `pnpm build:twopoint5d`, Heap-Test dreimal grün unter 0,1. Kommentar `:12-16`
     neu: gemessener Zuwachs nach dem Fix mit Chromium-Version, warum 0,1. CHANGELOG-Eintrag
     unter `## [Unreleased]` → `### Fixed` nach dem Skill `updating-changelog`.
   - **(c) beides** — den Bibliotheksanteil wie in (b) beheben, rot und grün wie dort (ist
     der Heap-Test bei 0,15 vor dem Fix nicht rot, trägt der Vitest-Spec den roten Lauf,
     sonst V3 vor und nach dem Fix). Dann den Rest dreimal messen: liegt er in allen drei
     Läufen bei höchstens 8 %, `MAX_HEAP_GROWTH = 0.1` — zwei Punkte Abstand wie bei den
     Coverage-Schwellen des Projekts (Commit e4dc0a95); sonst bleibt `0.15`, und der
     Kommentar benennt den three-Anteil wie in (a) mit dem Restwert.

6. **Commit-Message**, auf Englisch, ohne Finding-ID:
   - (a), wenn beide Verdachtsstellen bestätigt sind:
     `test: name the render objects three.js keeps on the shared material and the vertex arrays its WebGL backend caches as the cause of the heap growth across create/render/dispose rounds`
     — bestätigt der Snapshot nur eine davon oder eine andere three-Stelle, nennt die
     Message genau die bestätigte(n) und sonst nichts
   - (b) und (c): `fix(<vertex-objects|display>): release <was der Snapshot als festgehalten zeigte> so that create/render/dispose rounds leave nothing behind on the heap`,
     bei 0,1 ergänzt um `, and hold the heap test to 10 %`; Scope nach dem Modul des Fixes

7. **Aufräumen, dann berichten.** `packages/twopoint5d-testing/probe/` vollständig löschen.
   Snapshots, Skript-Ausgaben und Logs bleiben im Arbeitsverzeichnis. `git status --porcelain`
   zeigt danach nur die Dateien aus »Dateien« und die beiden ungetrackten Laufdateien
   (`remediation-plan.md`, `docs/remediation/`).

## Grenzen

- Am Heap-Test ändern sich nur der Kommentar `:12-16`, gegebenenfalls der Wortlaut von
  `:100-102` und im Fall (b)/(c) der Wert von `MAX_HEAP_GROWTH`. Kein Umbau der Schleife, kein
  Material je Runde, keine neue Assertion, keine weitere Messgröße — die Entscheidung vom
  2026-09-21 lässt im three-Fall die Grenze begründet stehen.
- Kein Eingriff in three: kein Patch in `node_modules`, kein `patch-package`, kein
  Versionssprung im `catalog:`.
- Konventionen aus dem Plan-Kopf gelten für jede Zeile: Kommentare auf Englisch und mit dem
  Warum, keine Finding-ID, kein Rückblick auf den Vorzustand (»no longer«, »used to«, »was
  previously« scheitern am Test aus den Konventionen).
- Im Report für jede bestätigte three-Stelle ein Satz, ob three sie überhaupt freigibt (bei
  `material.dispose()`, mit dem Renderer, nie) — B trägt das ins `Ergebnis:`, der Abschluss
  braucht es für einen möglichen Hinweis an three.

## Findings im Volltext

**MEM-014 · low · packages/twopoint5d-testing/test/vertex-objects-heap.test.js:13-18** — Der
Heap der Browser-Testseite wächst mit jeder Aufbau-/Abbau-Runde linear

Aufgefallen im Remediation-Lauf vom 2026-09-21, als Rückfrage an das Audit zurückgegeben: die
Messung sitzt im Test-Harness, die Ursache vermutlich in Bibliothekscode unter `src/`, den die
Scope-Regel des Laufs nicht deckte. Über die sechs Proben wächst der Heap der Testseite linear,
rund 13 KB je Runde — 11,72 % der ersten Probe auf Chromium 151, in sechs Läufen auf 0,01 Punkte
gleich; auf Chromium 153 11,8 %. Ungeklärt ist, ob `vertex-objects`/`display` beim Dispose etwas
festhalten oder ob ein Cache in three wächst. Der Test hält die Grenze deshalb auf
`MAX_HEAP_GROWTH = 0.15` statt der empfohlenen 0,1 — eine Abweichung, die den Zuwachs
durchlässt; die frühere absolute 4-MiB-Linie (≈ 35 %) hatte ihn ganz verdeckt.

Empfehlung: Die Ursache isolieren: Heap-Snapshots nach der ersten und der sechsten Runde
vergleichen (Retainer der gewachsenen Objekte), dabei `Display`, `VertexObjects` und die
three-Geometrie einzeln abbauen. Liegt es in der Bibliothek, dort beheben und die Grenze auf
0,1 zurücknehmen; liegt es in three, den Cache im Test-Kommentar benennen.

Effort laut Audit: M · Status im Audit: carried-over · Paket im Audit: twopoint5d-testing

## Abgleich

- **MEM-014 — unverändert, verschoben.** Am Basis-Commit `0ba859d7` stehen Kommentar und
  `MAX_HEAP_GROWTH = 0.15` in `:13-18`; heute in `:12-17`, weil Paket 1 (`049ba431`) den Import
  von `./support/stopAndDrain.js` in Zeile 5 entfernt und den Teardown auf `display.dispose()`
  umgestellt hat. Die Runde (`:119-130`) und die Messung (`:132-154`) sind Zeichen für Zeichen
  gleich. Nachgemessen auf dem Stand von `049ba431`: 11,79 %.

## Triage der offenen Befunde

- **Folgen-Zeile von Paket 1** — »der Canvas-Befund greift jetzt auch bei `dispose()` während
  des Init«. Eingeordnet als **vorbestehende Ursache mit erweiterter Reichweite**, kein
  eigenes Paket. Nachgesehen mit `git show 0ba859d7:packages/twopoint5d/src/display/Display.ts`:
  Zeile 887 rief `this.renderer?.dispose()` synchron, ein `dispose()` nach dem Init verlor den
  Kontext eines übergebenen Canvas also schon vor diesem Lauf (`WebGLBackend.js:2834`,
  `loseContext()`). `Renderer#dispose()` ruft `backend.dispose()` nur bei `_initialized === true`
  (`Renderer.js:2535-2538`); ein `dispose()` während des Init ließ Renderer und Kontext deshalb
  vor Paket 1 ganz liegen — genau der Fehler, den Paket 1 behoben hat. Seitdem führt auch dieser
  Weg in dieselbe vorbestehende Ursache. Der Eintrag bleibt `→ Scope` in »Offene Befunde«,
  Fundstelle auf `Display.ts:938` (`#releaseRenderer`) nachgeführt, mit dem Vermerk, dass der
  Ausgang ins Audit entfällt. Nicht in Paket 2: andere Ursache (Kontextverlust am Canvas gegen
  Heap-Retention bei lebendem Display).
- **Abschnittsverweise in `resource-lifecycle.md`** (`→ Scope`) — andere Ursache, bleibt für
  die Drain-Runde des Abschlusses.
- **`frameNo`-TSDoc, rückblickendes TSDoc, verwaistes TODO in `Display.ts`** (`→ Audit`) —
  andere Ursache, Urteil unverändert.

## Restplan

Unverändert. Paket 2 ist das letzte Paket; seine Abhängigkeit von Paket 1 ist erfüllt
(`stopAndDrain` ist aus dem Teardown des Heap-Tests entfernt). Danach folgt der Abschluss mit
der Drain-Runde über die beiden `→ Scope`-Einträge (Canvas, Abschnittsverweise).

## Urteil des Reviewers

- **MEM-014 — behoben** (Ausgang a, Ursache in three): Kommentar
  `packages/twopoint5d-testing/test/vertex-objects-heap.test.js:12-33` und Material-Kommentar
  `:117-120`; V3 (nur Bibliothek) wächst nicht, V4 (nur three) wächst mit denselben Zählern
  wie V1, alle Retainer-Pfade enden an `material._listeners.dispose` oder `backend.vaoCache`;
  Typed-Array-Aussage (144 B je Runde) am Snapshot nachgezählt, Mechanismus am three-Quelltext
  belegt (`Renderer.js:3692`/`:3714`, `Geometries.js:176-203`, `RenderObject.js:337-342`,
  `:513-515`). Review 0 fand 3 × wichtig, in Runde 1 alle erledigt (Review 1).
- Hinweis an three für den Abschluss: `RenderObject` bleibt am geteilten Material bis
  `material.dispose()` (oder Cache-Key-Wechsel), nicht mit dem Renderer; `WebGLBackend.vaoCache`
  wird nie freigegeben — kein `deleteVertexArray`, auch nicht in `WebGLBackend#dispose()`
  (`:2829-2838`).

## Kleine Befunde (nach Review 1, nicht behoben)

- `vertex-objects-heap.test.js:29-30` — der V2-Rest von 3 KB je Runde ist als »the vertex-array
  cache plus JIT code« zerlegt; der Snapshot `v1-first → v1-after-material` deckt damit nur
  ≈ 1,6 KB je Runde (V2 hat keinen eigenen Snapshot). Vorschlag: »mostly …«.
- `vertex-objects-heap.test.js:21-22` — »all of it goes once the material is garbage collected«
  gilt nicht für die Uniform-Gruppe: sie hängt zusätzlich in `Info.memoryMap` (`Info.js:380`)
  und geht erst mit `RenderObject#dispose()` oder dem Renderer.
- Commit-Message sagt »as the cause of the heap growth«, obwohl der Kommentar JIT-Code und den
  reinen three-Anteil nennt; folgt wörtlich Schritt 6 (a) des Detailplans.

## Nebenbefunde — Begründung der Urteile

- `:98` (WebGPU-Start-Kommentar) und `:164` (Grammatik der Assertion-Meldung) liegen im
  Browser-Test des vertex-objects-Dispose, den die Scope-Regel ausdrücklich nennt → Scope.
- Hinweis in `resource-lifecycle.md` §5 auf das langlebige geteilte Material: betrifft Dispose
  von vertex-objects und seine Doku, vorbestehend (die Bibliothek hielt nie etwas, three schon)
  → Scope.
