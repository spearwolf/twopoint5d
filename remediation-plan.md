# Remediation-Plan — @spearwolf/twopoint5d (Lebenszyklus von Ressourcen)

Quelle: ./audit.html vom 2026-09-04 · Branch: main · erstellt: 2026-09-05
Baseline: `pnpm lint` ✓ · `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm test:ci` ✓ · `pnpm test:browser` ✓ (alle Exit 0; die Test-Läufe kamen aus dem Nx-Cache)
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/0324467f-992a-4743-9d81-92d1b764d8d9/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Scope: 14 von 109 Findings (0 critical, 0 high, 7 medium, 6 low, 1 info) plus der Dispose-Teil von TEST-005 (high, bleibt danach offen) · ausgenommen: alles, was weder Lebenszyklus noch Ressourcen-Wachstum betrifft; acknowledged
Scope-Regel: alles, was Ownership, `dispose()` oder das Verhalten nach `dispose()` betrifft, und alles, was über die Lebenszeit einer Instanz monoton wächst — unabhängig von Severity und Kategorie. Gilt auch für Befunde, die erst im Lauf auffallen.
Stand (2026-09-06): Lauf abgeschlossen — 19 Pakete, 19 Commits (3dd3207 … f90dbbf), kein Paket blockiert, »Offene Befunde« leer (34 Einträge ins Audit zurückgegeben), alle fünf Verify-Kommandos grün · ./audit.html nachgeführt: 14 Findings geschlossen, TEST-005 teilweise, 29 neu, Score 0,5 → 0

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[!]` blockiert.

## Ziel des Laufs

Eine klare, aufgeschriebene Definition, wie die Bibliothek mit `dispose()` und
dem Eigentum an Ressourcen umgeht — und ein Code-Stand, der diese Definition
an jeder Stelle mit `dispose()` einhält und per Test belegt.

## Entscheidungen

- Semver-Urteil: minor unter 0.x, also 0.21.2 → 0.22.0 beim nächsten Release.
  Breaking für Aufrufer: hereingereichte Geometry, Material und Texturen werden
  von `dispose()` nicht mehr freigegeben; `Display`, `TextureStore` und
  `StageRenderer` werfen bzw. rejecten nach `dispose()`; ein Attributslot
  gehört einer Route. Die Version wird in diesem Projekt erst im Release-Commit
  angehoben (`chore: release twopoint5d vX.Y.Z`), deshalb hier keine Anhebung;
  `CHANGELOG.md` `[Unreleased]` trägt alle Einträge samt Migrationshinweisen (2026-09-06)
- Paket 19 schließt die vertex-objects-Kette; die 34 verbliebenen Nebenbefunde
  gehen ins Audit, 29 als neue Findings, 5 als Bestätigung bestehender (2026-09-06)
- Drain-Runde 3: die vertex-objects-Kette wird mit einem letzten Paket 19
  geschlossen (Folge aus Paket 17 plus zwei Scope-Einträge derselben Ursache).
  Was vertex-objects danach noch liefert, geht ohne weitere Runde ins Audit (2026-09-06)
- Drain-Runde 2: die 7 Nebenbefunde mit Urteil »→ Scope« werden als Pakete 16
  bis 18 behoben; die 32 Einträge mit Urteil »→ Audit« gehen in die
  ./audit.html. Bringt eine dritte Runde erneut Scope-Einträge, wird die Kette
  vorgelegt und der Rest ins Audit gegeben (2026-09-06)
- Paket 15: der Commit ea89622 bleibt, obwohl Runner B ihn ohne Implementierer
  und Reviewer geschrieben hat (Exit 20 der Schleife). Inhalt sind 63
  Kommentarzeilen in 15 Spec-Dateien, Verify grün; ein erneuter Paketlauf
  dafür lohnt nicht (2026-09-06, Entscheidung des Nutzers)
- Drain-Runde: alle 16 Nebenbefunde mit Urteil »→ Scope« werden in diesem Lauf
  behoben, nach Domäne geschnitten als Pakete 9 bis 14; die 14 Einträge mit
  Urteil »→ Audit« gehen als neue Findings in die ./audit.html (2026-09-06)
- Scope ist das Kern-Set der Lebenszyklus-Findings plus die beiden
  Ressourcen-Wachstums-Findings MEM-012 und MEM-002 (2026-09-05)
- Ownership strikt: `dispose()` gibt nur frei, was die Instanz selbst erzeugt
  hat. Wer Geometry, Material, Textur oder Pool hereinreicht, bleibt
  Eigentümer und entsorgt selbst. Kein Übernahme-Schalter. Dasselbe Muster wie
  `declareOwnedPool()` in vertex-objects und die Pipeline-Regel im
  stage-README. Wird im CHANGELOG als Verhaltensänderung geführt (2026-09-05)
- Vertrag nach `dispose()`: `dispose()` ist idempotent. Danach wirft der
  Zugriff auf eine freigegebene Ressource (etwa `Display.canvas`) einen
  Error, der Klasse und Zustand nennt. Offene Promises (etwa
  `TextureStore.get()`) werden beim `dispose()` rejected, nicht
  liegengelassen (2026-09-05)
- API-028: `dispose()` der Sprites ruft `removeFromParent()`, statt die
  Reihenfolge nur im TSDoc zu verlangen (2026-09-05)
- MEM-013: die alte Textur wird erst freigegeben, wenn die neue gesetzt ist.
  Kein Lückenframe; das `texture`-Signal zeigt nie auf eine bereits
  freigegebene Textur (2026-09-05)
- BUG-041 und API-035 bleiben draußen: sie erwähnen `dispose()` nur am Rand,
  API-035 wäre ein Breaking Change an der Setter-API (2026-09-05)
- Die Richtlinie lebt als `packages/twopoint5d/docs/resource-lifecycle.md`,
  verlinkt aus dem Package-README und aus AGENTS.md §6 (Konventionen)
  (2026-09-05, Vorschlag des Orchestrators, ohne Widerspruch freigegeben)
- MEM-011: Kollidierende Attributnamen zwischen den Routen einer Geometrie
  werden verboten, statt den Leak zu dokumentieren oder das Attribut je Slot
  umzubauen. `InstancedVOBufferGeometry#attachInstancedPool()` wirft, wenn eine
  Route einen Attributslot belegen würde, in dem diese Geometrie schon einmal
  ein Attribut hatte. Aus einem stillen GPU-Leak wird ein Fehler an der
  Aufrufstelle. Breaking Change mit Migrations-Abschnitt; die Entscheidung fiel
  gegen zwei Alternativen (Grenze nur dokumentieren; ein `BufferAttribute` je
  Slot über die ganze Lebenszeit mit umgehängtem Array) und auf der Grundlage
  der Messung, die unter Paket 5 steht (2026-09-05)

## Konventionen

Gelten für jede Zeile, die in diesem Lauf entsteht — Code, Kommentare,
Dokumentation, CHANGELOG, Migrations-Hinweise, Commit-Messages:

- Inline-Kommentare sind erwünscht, wo sie erklären, _warum_ etwas so ist.
- Keine Finding-IDs, auch nicht in der Commit-Message. Sie gehören diesem einen
  Audit, sind danach tot, und die Commit-Message überdauert den Lauf. Sie leben
  in diesem Plan und sonst nirgends; die Verbindung zwischen Finding und Commit
  trägt das Feld `Hash:` unter dem Paket — in genau der Richtung, in der jemand
  sie später sucht. Eine Commit-Message sagt in eigenen Worten, was sie ändert.
- Kein Rückblick auf den Vorzustand: kein »früher«, kein »statt bisher«, kein
  »im Zuge des Audits umgestellt«. Der Test: Ergibt der Satz für jemanden Sinn,
  der den Vorzustand nie gesehen hat? Dann bleibt er. Braucht er ihn, gehört er
  in die Commit-Message — die Historie ist bereits konserviert.

Projektspezifisch:

- Doku in Englisch, Markdown, schlicht und technisch (AGENTS.md §8).
- Commit-Messages: Conventional Commits, Englisch, wie `git log` es zeigt.
- Public-API-Änderungen laufen über die jeweilige `public-api.ts`; TSDoc an
  jeder öffentlichen `dispose()`-Methode.
- CHANGELOG-Einträge unter `[Unreleased]` in `packages/twopoint5d/CHANGELOG.md`,
  nach dem Skill `updating-changelog`.
- Bugfix heißt Test zuerst: der fehlschlagende Test wird rot gesehen, bevor
  der Fix kommt. Für GPU-Buffer-Verhalten (vertex-objects) zusätzlich ein
  Browser-Test in `packages/twopoint5d-testing/`.
- Skills `using-eventize` und `using-signalize` gelten, sobald Event- oder
  Signal-Code angefasst wird.

## Vorbestehende Fehler

- keine; Baseline vollständig grün

## Offene Befunde

Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] `packages/twopoint5d/src/display/Display.ts:685` — `dispose()` hat keinen
  Idempotenz-Guard: ein zweiter Aufruf feuert `OnDisplayDispose` erneut und ruft
  `this.renderer?.dispose()` auf einem bereits abgeräumten Renderer (aus Paket 1)
  → Scope · 2026-09-05 an Paket 3 zugeschlagen, gleiche Ursache
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:193` —
  `dispose()` setzt `#autoTouchBuffers` zurück, `#firstAutoTouch` aber nicht; ein
  `update()` nach `dispose()` würde die eben freigegebenen Attribute erneut
  einsammeln. Kein Beleg, dass der Pfad heute erreicht wird (aus Paket 1) → Scope
  · 2026-09-05 an Paket 5 zugeschlagen, gleiche Ursache · 2026-09-05, Zug 0 von
  Paket 5 an der Fundstelle: gegenstandslos, die Prämisse trägt nicht. `dispose()`
  leert `this.buffers` (Zeile 71), und jede Auswahl geht über diese Map —
  `selectAttributes()` und `selectBuffers()` antworten danach beide mit `[]`.
  `#getAutoTouchBuffers()` sammelt also nichts ein, gleich wie `#firstAutoTouch`
  steht, und `touchBuffers({static: true})` ist ebenso leer. `#autoTouchBuffers`
  wird zurückgesetzt, weil es Referenzen auf die freigegebenen
  `THREE.BufferAttribute`s hält; `#firstAutoTouch` hält nur ein `boolean`. Die
  Asymmetrie ist die richtige. Keine Änderung
- [x] `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprites.ts:11` —
  der Konstruktor nimmt `material?: Material`, das Feld ist als
  `AnimatedSpritesMaterial | undefined` deklariert. `new AnimatedSprites(geometry,
  new MeshBasicMaterial())` kompiliert, und `sprites.material` gilt danach als
  `AnimatedSpritesMaterial`, ohne eines zu sein — der Compiler bürgt für etwas,
  das der Konstruktor nicht prüft (aus Paket 2) → Audit (low, API; betrifft
  weder Ownership noch `dispose()` noch monotones Wachstum, und die Verengung
  des Parametertyps wäre ein Breaking Change an der Konstruktor-Signatur)
  · 2026-09-06, Abschluss: ins Audit — API-038
- [x] `packages/twopoint5d/src/display/FrameLoop.ts:75-82, 202-213` — ein
  RAF-Treiber hält nie von selbst an. `FrameLoop.stop()` meldet sich beim
  letzten Abgang nur mit `off(this.raf, OnRAF, this)` ab; `RAF.stop()` wird seit
  Paket 3 ausschließlich aus `FrameLoop.resetRAF()` gerufen (Zeile 143), also
  von Hand aus einem Teardown-Hook und aus keinem Abgangspfad heraus. Der
  renderer-gebundene Treiber kommt
  damit durch, weil `Renderer.dispose()` von three.js `setAnimationLoop(null)`
  ruft — der renderer-lose Treiber aber fordert weiter jeden Frame an und misst
  FPS ins Leere, solange die Seite lebt. Der Umbau ist kein Einzeiler: mehrere
  `FrameLoop`s teilen sich einen Treiber, ein Anhalten braucht also eine Zählung
  auf dem Treiber selbst, und es hängt die Schleife daran, an der jedes
  gerenderte Bild hängt (aus Paket 3, Zug 0) → Scope (low, MEM; Verhalten nach
  `dispose()`. Paket 3 nimmt ihn bewusst nicht mit: `resetRAF()` beantwortet
  MEM-001, dieser Befund ist ein eigener Entwurf mit eigenem Risiko)
  · 2026-09-06, Drain-Runde: an Paket 9 zugeschlagen
- [x] `packages/twopoint5d/src/display/Stylesheets.ts:8, 33-39` — die Map
  `installedRules` wird nirgends beschrieben; `installRule()` liest sie in Zeile
  33 und bekommt immer `undefined`. Der Zweig, der eine vorhandene Regel an ihrem
  Index ersetzen soll, ist damit tot, und jeder Aufruf hängt stattdessen eine
  weitere Regel an das globale Stylesheet. Es wächst monoton: eine Regel je
  `new Display(...)` (Zeile 400), eine weitere je erzeugtem Container (Zeile 361),
  und eine je Wertwechsel an `PanControl2D#cursorPanStyle`
  (`controls/PanControl2D.ts:141-149`). Nichts entfernt sie je wieder,
  `Display#dispose()` eingeschlossen. Dass es trotzdem richtig aussieht, ist
  Zufall der Kaskade: alle Regeln teilen denselben Selektor, und `insertRule` am
  Ende lässt die jüngste gewinnen (aus Paket 3, Zug 0) → Scope (low, MEM;
  monotones Wachstum über die Modul-Lebensdauer. Andere Ursache als Paket 3 —
  ein toter Cache-Zweig, nicht der Vertrag nach `dispose()` — deshalb dort nicht
  mitgenommen)
  · 2026-09-06, Drain-Runde: an Paket 9 zugeschlagen
- [x] `packages/twopoint5d/src/display/Stylesheets.ts:6, 14-23` — `getGlobalSheet()`
  legt das `<style>`-Element beim ersten Aufruf im übergebenen `root` an und hält
  es in einer Modulvariablen; jeder spätere Aufruf bekommt dasselbe Blatt zurück
  und ignoriert sein `root`. Ein zweiter `Display` in einem Shadow Root bekommt
  seine Regeln damit in den `document.head` des ersten geschrieben, wo sein
  Canvas sie nicht sieht — und `DisplayParameters.styleSheetRoot` verspricht in
  seinem TSDoc genau diesen Fall (»if the display is used within a shadow DOM,
  this is the option to install the styles only in this shadow root«) (aus
  Paket 3, Zug 0) → Audit (medium, BUG; betrifft weder Ownership noch `dispose()`
  noch monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — BUG-049
- [x] `packages/twopoint5d/src/display/Display.ts:332, 394, 447` — der zweite
  dokumentierte Konstruktorpfad ist tot. `#waitForRenderer` wird ausschließlich
  im HTMLElement-Zweig zugewiesen (Zeile 394); wer einen fertigen
  `WebGPURenderer` hereinreicht, läuft in der letzten Konstruktorzeile auf
  `undefined.then(…)` und bekommt einen `TypeError`, bevor der Konstruktor
  zurückkommt. Die Deklaration `readonly #waitForRenderer!: Promise<…>` hält den
  Compiler still. Kein Test und keine Lookbook-Seite geht diesen Pfad; im ganzen
  Repo konstruiert jedes `new Display(…)` über ein Element (aus Paket 3, von
  Implementierer und zwei Reviewern unabhängig gefunden) → Audit (medium, BUG;
  betrifft weder Ownership noch `dispose()` noch monotones Wachstum — der Pfad
  ist schon vor jedem `dispose()` kaputt)
  · 2026-09-06, Abschluss: ins Audit — BUG-002, dort als erneut bestätigt vermerkt
- [x] `packages/twopoint5d/src/display/Display.ts:447-449` — das
  `this.#waitForRenderer.then(() => { this.frameLoop.start(this); })` am Ende
  des Konstruktors ist ungeguardet. Ein `dispose()`, das vor dem Auflösen der
  Renderer-Initialisierung fällt, hebt damit das `frameLoop.stop(this)` aus
  `dispose()` wieder auf: `FrameLoop#start()` legt das entsorgte Display zurück
  in `#subscribers` und hängt den Loop beim Übergang 0 → 1 erneut an den
  RAF-Treiber. Gezeichnet wird nichts, `renderFrame()` steigt am Flag aus, aber
  der Subscriber-Set wächst um je ein totes Display und hält es bis zum
  Seitenende (aus Paket 3) → Scope (low, MEM; Verhalten nach `dispose()` und
  monotones Wachstum, dieselbe Ursache wie Paket 3. Paket 3 nimmt ihn nicht mit:
  der Befund war auch ohne dieses Paket falsch, und die Regel für Nebenbefunde
  gilt auch dann, wenn die Ursache passt)
  · 2026-09-06, Drain-Runde: an Paket 9 zugeschlagen
- [x] `packages/twopoint5d/src/display/Display.ts:324-329` —
  `isWebGPUBackend` und `isWebGLBackend` sind als `boolean` typisiert und
  antworten nach `dispose()` `false`, weil sie über `this.renderer?.backend`
  gehen. Ein Aufrufer kann »Backend war WebGPU, das Display ist entsorgt« nicht
  von »Backend war nie WebGPU« unterscheiden. Nach der Typregel in Abschnitt 4
  der Richtlinie wäre das ein Fall für Regel 2 (werfen, statt den Typ zu
  belügen); Paket 3 hat sich bewusst auf seine drei Wurf-Stellen beschränkt und
  stattdessen aufgeschrieben, was zutrifft (aus Paket 3) → Scope (low, API;
  Verhalten nach `dispose()`. Zwei weitere Wurf-Stellen sind ein eigener
  Entwurf: sie treffen zwei Member, die heute in jedem Aufrufer ohne
  `try`/`catch` gelesen werden)
  · 2026-09-06, Drain-Runde: an Paket 9 zugeschlagen
- [x] `packages/twopoint5d/README.md:61` — der `#### [display]`-Block verweist
  unter »api docs« auf `src/stage/README.md`, dasselbe Ziel wie der Stage-Block
  darüber; für die Display-Schicht gibt es dort keine Doku (aus Paket 1)
  → Audit (low, DOC)
  · 2026-09-06, Abschluss: ins Audit — DOC-014
- [x] `packages/twopoint5d/src/texture/TextureStore.ts:258-290, 172-181` — nach
  einem Fehler in `load(url)` löst `whenReady()` nie auf. `load()` fängt den
  Fehler von `fetch`, von `response.json()` und von `parse()` ab, emittiert
  `OnError` und kehrt zurück, ohne dass `OnReady` je feuert; `whenReady()` wartet
  darauf und wartet weiter. Das trifft auch das statische
  `TextureStore.load(url)` (Zeile 114–118), dessen ganzer Rumpf
  `store.load(url); return store.whenReady()` ist: eine vertippte URL ergibt eine
  Zusage, die nie fällt. Paket 4 schließt den Dispose-Ausgang dieser Zusage, nicht
  den Fehler-Ausgang — andere Ursache (Fehlerbehandlung statt Lebenszyklus)
  (aus Paket 4, Zug 0) → Audit (medium, BUG; betrifft weder Ownership noch
  `dispose()` noch monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — BUG-041, dort als erneut bestätigt vermerkt
- [x] `packages/twopoint5d/src/texture/TextureStore.ts:352-356` — der
  Einzeltyp-Pfad von `on()` reicht den Wert eines Subtyp-Events ungeprüft an
  `callback(val as MapSubTypes<T>)` weiter, während der Mehrtyp-Pfad daneben
  (Zeile 342–344) `null` und `undefined` herausfiltert. Solange kein Signal je
  leer emittiert, fällt das nicht auf; wer eines räumt und dabei benachrichtigt,
  liefert einem Callback ein `undefined`, dessen Typ eine `Texture` zusagt. Paket 4
  ist dieser Kante bereits ausgewichen, indem es das `texture`-Signal vor dem
  Räumen mutet — die Kante bleibt (aus Paket 4, Zug 0) → Audit (low, API;
  betrifft weder Ownership noch `dispose()` noch monotones Wachstum, und die
  Prüfung im Einzeltyp-Pfad wäre eine Verhaltensänderung an `on()`)
  · 2026-09-06, Abschluss: ins Audit — API-039
- [x] `packages/twopoint5d/src/texture/TextureStore.ts:408-420` — `dispose()`
  emittiert nach dem Dispose-Event noch ein zweites: `this.#renderer.set(undefined)`
  in Zeile 416 löst die `onChange`-Brücke aus Zeile 131–134 aus, die
  `OnRendererChanged` feuert, und `off(this)` kommt erst danach. Ein Abonnent
  bekommt also »Renderer ist jetzt `undefined`« nachgereicht, nachdem ihm gesagt
  wurde, dass der Store weg ist. `Display` sagt seit Paket 3 zu, nach dem
  Dispose-Event nichts mehr zu emittieren; die Schwesterklasse hält das nicht.
  Paket 4 nimmt es nicht mit: die Reihenfolge in `dispose()` umzustellen geht über
  das hinaus, was seine fünf Findings verlangen (aus Paket 4, Zug 0) → Scope
  (low, API; Verhalten nach `dispose()`)
  · 2026-09-06, Drain-Runde: an Paket 10 zugeschlagen
- [x] `packages/twopoint5d/src/texture/TextureResource.ts:189-302` — nach
  `dispose()` antworten die Getter der Resource weiter mit ihrem letzten Wert.
  Elf von ihnen sind `T | undefined` typisiert und fielen damit unter Regel 1 aus
  Abschnitt 4 der Richtlinie (`atlas`, `tileSet`, `imageCoords`,
  `frameBasedAnimations`, `textureFactory`, `renderer` und die übrigen). Paket 4
  räumt ausschließlich `texture`, weil dort eine _freigegebene_ Ressource
  erreichbar bliebe; die anderen halten Werte, die niemand entsorgt hat. Ein
  Nachziehen wäre ein eigener Entwurf: jedes dieser Signale hat ein retained
  Event, jedes Räumen ist damit eine Auslieferung, und die läuft in dieselbe
  Kante wie der Eintrag zwei Zeilen höher (aus Paket 4, Zug 0) → Scope (low, API;
  Verhalten nach `dispose()`)
  · 2026-09-06, Drain-Runde: an Paket 10 zugeschlagen
- [x] `packages/twopoint5d/src/texture/TextureStore.ts:437` — das `unsubscribe()`
  einer `on()`-Subscription endet mit `off(this, OnReady, onReadyHandler)`. Die
  Namensform von `off()` löscht in eventize v6 nicht nur den Listener, sondern den
  retained Wert **und** die Retain-Policy des Events. Nach dem ersten
  `unsubscribe()` irgendeiner Subscription trägt der Store `ready` nicht mehr;
  jede spätere `on()`, `get()`, `whenReady()` oder `whenResource()` wartet dann
  auf das nächste `parse()`, statt aus dem gehaltenen Ready beantwortet zu werden,
  und zwar still. Vom Implementierer gegen den Stand **vor** Paket 4 gemessen:
  `getRetainedEventNames(store)` liefert nach einem `unsubscribe()` nur noch
  `['rendererChanged']`. Ein aufgelöstes `get()` ging diesen Pfad schon vorher, es
  ist also vorbestehend; Paket 4 hat mit der abgewiesenen id lediglich eine zweite
  Tür in dieselbe Lücke gebaut. Kein Aufrufer im Repo trifft ihn heute — der
  Lookbook abonniert und meldet sich nie ab, die Specs bauen je einen frischen
  Store (aus Paket 4) → Audit (high, BUG; eine öffentliche API hört nach einer
  gewöhnlichen Aufrufreihenfolge still auf zu antworten. Das Urteil bleibt
  trotzdem »Audit«: die Scope-Regel dieses Laufs fragt nach Ownership,
  `dispose()`, dem Verhalten danach und nach monotonem Wachstum, und dies ist
  keins davon, sondern ein Fehler in der Abmeldung. Die Regel ist
  severity-unabhängig, ausdrücklich)
  · 2026-09-06, Abschluss: ins Audit — BUG-050
- [x] `packages/twopoint5d/src/texture/TextureResource.ts:361` — `load()` hat
  keinen Guard gegen `#disposed`. Der Pfad ist eng, aber offen: `#load` sperrt nur
  den zweiten Aufruf und wird von `dispose()` nicht zurückgesetzt, ein `load()`
  nach einem `load()` läuft also ohnehin leer. Wer dagegen eine frisch gebaute
  Resource entsorgt und *danach* `load()` ruft, registriert die fünf
  `onChange`-Brücken und die acht Effects auf zerstörten Signalen und in einer
  frisch angelegten SignalGroup; ein zweites `dispose()` kehrt am Flag früh zurück
  und räumt sie nie wieder ab (aus Paket 4) → Scope (low, MEM; Verhalten nach
  `dispose()` und eine Kette, die niemand mehr abbaut)
  · 2026-09-06, Drain-Runde: an Paket 10 zugeschlagen
- [x] `packages/twopoint5d/src/texture/TextureResource.ts:209, 217, 225, 233, 241,
  249` — sechs Setter schreiben über `?.` in ein Signal, das nur die passende
  Bauform der Resource überhaupt anlegt. Auf einer `image`-Resource verschluckt
  `resource.tileSet = …` seinen Wert stumm, und der Getter daneben antwortet
  weiter `undefined`. Der Aufrufer bekommt keinen Hinweis, dass die Zuweisung
  nirgends angekommen ist (aus Paket 4) → Audit (low, API; betrifft weder
  Ownership noch `dispose()` noch monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — API-040
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:103, 121` —
  `toBuffersData()` und `fromBuffersData()` haben nach `dispose()` kein
  definiertes Verhalten. `toBuffersData()` liefert still
  `{capacity, usedCount: 0, buffers: {}}` — Daten, die aussehen wie ein leerer
  Pool statt wie ein toter; `fromBuffersData()` läuft durch eine leere Schleife
  und meldet nichts. Das TSDoc über `dispose()` sagt zu, »any further read/write
  operation on its vertex objects will fail«, und diese beiden fallen weder
  darunter noch unter eine der drei Reaktionen aus Abschnitt 4 der Richtlinie
  (aus Paket 5) → Scope (low, API; Verhalten nach `dispose()`)
  · 2026-09-05, Zug 0 von Paket 7: an Paket 7 zugeschlagen. Beide Methoden sind
  öffentliche Member von `VertexObjectPool`, und die Assertion (c) aus Abschnitt 8,
  die dieses Paket für diese Klasse schuldet, ist ohne eine Entscheidung über die
  beiden nicht zu schreiben. Antwort in Entscheidung 6 dort: beide werfen
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:118-122` und
  `HelpersManager.ts:55-58` — die Punkt-Helfer lecken Geometry und Material, und
  zwar je Frame. `addPointHelper()` baut ein `new Mesh(new BoxGeometry(…), new
  MeshBasicMaterial({color}))`; `HelpersManager.removeFromScene()` räumt einen
  Helfer mit `childNode.removeFromParent()` und
  `(childNode as {dispose?}).dispose?.()` ab. `THREE.Mesh` hat kein `dispose()`,
  der optionale Aufruf greift ins Leere, und Geometry und Material bleiben liegen —
  anders als bei `Box3Helper` und `PlaneHelper`, die beide eines haben
  (nachgesehen in `three/src/helpers/Box3Helper.js:74-79`). Der Verbrauch ist kein
  Einmaleffekt: `CameraBasedVisibilityHelpers#update()` (Zeile 149–154) ruft
  `#helpers.remove()` und danach `createHelpers()`, und `createPlaneHelpers()` legt
  dabei drei bis vier Punkt-Helfer neu an — bei eingeschalteten Helfern also je
  gerendertem Bild. `RectangularVisibilityAreaHelpers` ist nicht betroffen, es
  benutzt ausschließlich `Box3Helper` (aus Paket 6, Zug 0) → Scope (medium, MEM;
  monotones Wachstum über die Lebenszeit, und eine Ressource, die ihr Eigentümer
  nicht freigibt. Paket 6 nimmt es nicht mit: andere Ursache — ein Aufräumer, der
  jedem Kindknoten ein `dispose()` unterstellt, nicht der Dispose-Vertrag der drei
  Klassen dieses Pakets — und eine andere Datei)
  · 2026-09-06, Drain-Runde: an Paket 11 zugeschlagen
- [x] `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:96-98` — `update()` legt
  je Aufruf drei Vektoren an: `visible.offset ?? new Vector2()`,
  `visible.translate ?? new Vector3()` und in jedem Fall
  `new Vector3(offset.x + translate.x, translate.y, offset.y + translate.z)`. Die
  Methode läuft je gerendertem Bild, und der dritte Vektor wird immer gebaut, auch
  wenn die beiden davor aus dem Ergebnis kommen. `CameraBasedVisibility` hält für
  genau diesen Zweck bereits wiederverwendete Instanzen auf der Klasse (aus
  Paket 6, Zug 0) → Audit (low, PERF; GC-Druck, kein monotones Wachstum, und
  weder Ownership noch `dispose()`)
  · 2026-09-06, Abschluss: ins Audit — PERF-013
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:9-20` — die
  Datei deklariert ein eigenes `interface TileBox`, Feld für Feld die Kopie des
  `TileBox` aus `CameraBasedVisibility.ts:9-20`, aus dem Modul, aus dem sie in
  Zeile 4 ohnehin schon importiert. Seit dem `[Unreleased]`-Stand ist
  `TileBox` aus dem Paket exportiert; die Kopie kann fallen, ohne dass sich etwas
  an der Oberfläche ändert (aus Paket 6, Zug 0) → Audit (low, READ; betrifft weder
  Ownership noch `dispose()` noch monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — CONS-009, dort als erneut bestätigt vermerkt
- [x] `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:110` — `dispose()` leert
  `#tiles` mit `clear()`, ohne für die Kacheln `destroyTile()` zu rufen. Die
  Kacheln gehören der Factory: bei `TileSpritesFactory` sind es `TileSprite`-Slots
  aus dem `instancedPool` der Geometrie (`TileSprites/TileSpritesFactory.ts:64-66`).
  Wer eine Factory an einen zweiten Renderer weiterreicht, verliert die Slots des
  ersten — sie bleiben belegt und kommen nie zurück. Paket 6 nimmt es nicht mit:
  Schritt 11 seines Detailplans verbietet die Änderung an `TileSpritesFactory`, und
  der Sachverhalt ist auch ohne dieses Paket derselbe. Das TSDoc über
  `Map2DTileRenderer#dispose()` benennt ihn seit Runde 1 ausdrücklich, statt ihn
  stillschweigend zu decken; der Dispose-Test assertiert dort bewusst nichts, damit
  das Verhalten nicht festgeschrieben wird (aus Paket 6) → Scope (medium, MEM;
  eine Ressource, die beim `dispose()` ihres Halters nicht zurückgegeben wird, und
  ein Pool, dessen belegte Slots monoton wachsen, wenn dieselbe Factory mehrere
  Renderer durchläuft)
  · 2026-09-06, Drain-Runde: an Paket 11 zugeschlagen
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:371-384, 120-121` —
  `findVisibleTiles()` gibt `offset: this.#scratchOffset` und `translate`
  (das ist `#scratchTranslate`, Zeile 279) im Ergebnis heraus. Beide sind
  Klassen-Scratch und werden im nächsten Frame überschrieben; der auf dem
  Cache-Pfad erneut zurückgegebene `#visibleTiles` zeigt auf dieselben Instanzen.
  `Map2DTileStreamer` liest sie synchron, es fällt also heute nicht auf — wer das
  Ergebnis aufhebt, hält Werte, die sich unter ihm ändern (aus Paket 6) → Audit
  (low, API; betrifft weder Ownership noch `dispose()` noch monotones Wachstum,
  sondern eine Aliasing-Zusage im Rückgabewert)
  · 2026-09-06, Abschluss: ins Audit — API-041
- [x] `packages/twopoint5d/src/map2d/Map2D.ts:14-22` — im `tileStreamer`-Setter ist
  `if (this.#renderers.size > 0)` um `if (this.#tileStreamer)` gewickelt; die
  äußere Prüfung spart eine Schleife über ein leeres Set, die innere fragt ein Feld
  ab, das der Konstruktor immer füllt. Zwei tote Verzweigungen, kein Fehlverhalten
  (aus Paket 6) → Audit (low, READ; betrifft weder Ownership noch `dispose()` noch
  monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — READ-009

- [x] `packages/twopoint5d/src/stage/Canvas2DStage.ts:14-110` — die Klasse ist über
  `stage/public-api.ts` veröffentlicht, baut im Konstruktor einen `StageRenderer`,
  einen `Stage2D`, ein `Sprite` mit eigener `SpriteMaterial` und in
  `makeTexture()` eine `TextureFactory` samt `Texture` — und hat kein `dispose()`.
  Alles davon hat sie selbst erzeugt, nichts davon kann ein Aufrufer je freigeben:
  die einzige Freigabe im ganzen Modul ist das `this.texture.dispose()` in
  `makeTexture()` (Zeile 108–110), das die Vorgänger-Textur beim Neuaufbau
  entsorgt und den Rest stehen lässt. Andere Ursache als Paket 7: dort geht es um
  `dispose()`-Methoden, die es gibt und die niemand prüft, hier fehlt die Methode
  (aus Paket 7, Zug 0) → Scope (medium, MEM; Ownership — eine Klasse, die
  ausschließlich selbst gebaute three.js-Ressourcen hält und keinen Weg anbietet,
  sie herzugeben)
  · 2026-09-06, Drain-Runde: an Paket 12 zugeschlagen

- [x] `tsconfig.json:34` — `removeComments: true` streicht die TSDoc-Kommentare auch
  aus dem `.d.ts`-Emit, nicht nur aus dem JavaScript. Nachgemessen am gebauten Stand:
  0 von 126 `.d.ts`-Dateien unter `packages/twopoint5d/dist/lib/` tragen einen
  einzigen Docblock; ein `tsc`-Lauf über eine Probedatei liefert den Block bei
  `--removeComments false` und schluckt ihn bei `true`. Ein Konsument von
  `@spearwolf/twopoint5d` sieht im Editor damit zu keiner öffentlichen Signatur eine
  Beschreibung — auch nicht zu den `dispose()`-Verträgen, die dieser Lauf in sechs
  Paketen geschrieben hat, und `docs/resource-lifecycle.md` liegt ebenfalls nicht im
  Tarball. Verwandt mit DOC-002 (medium, die TSDoc-Abdeckung selbst), aber eine
  andere Ursache: dort fehlt die Doku, hier kommt die vorhandene nicht an.
  Vorbestehend, nachgesehen mit `git show 3dd3207^:tsconfig.json` (aus Paket 8,
  Zug 0) → Audit (medium, DOC; betrifft weder Ownership noch `dispose()` noch
  monotones Wachstum — der Vertrag im Quelltext stimmt, er wird nur nicht
  ausgeliefert)
  · 2026-09-06, Abschluss: ins Audit — DOC-015
- [x] `tsconfig.json:11` — `declarationMap: true` legt neben jede `.d.ts` eine
  `.d.ts.map`, deren `sources` auf `../../../../src/…` zeigt. Ausgeliefert wird aber
  nur `dist/lib/**` samt synthetischer `package.json`, dazu README, CHANGELOG und
  LICENSE (`scripts/publishNpmPkg.mjs:50-59`) — keine einzige `.ts`-Quelle,
  nachgezählt null unter `dist/`. Alle 126 Declaration Maps zeigen beim Konsumenten
  damit ins Leere: »Go to definition« landet auf einer Datei, die im Paket nicht
  existiert. Entweder die Quellen mitliefern oder die Maps weglassen. Vorbestehend,
  nachgesehen mit `git show 3dd3207^:tsconfig.json` (aus Paket 8, Zug 0) → Audit
  (low, BUILD; betrifft weder Ownership noch `dispose()` noch monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — CFG-016
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:96` —
  `createFromAttributes()` hat nach `dispose()` kein definiertes Verhalten.
  `dispose()` leert `buffer.buffers`, lässt `bufferAttributes` aber stehen, also
  greift `VertexObjectBuffer#copyAttributes()` (`VertexObjectBuffer.ts:170-171`)
  auf `undefined` zu. Gemessen: `TypeError: Cannot read properties of undefined
  (reading 'typedArray')` — genau die Reaktion, die Abschnitt 4 der Richtlinie
  ausschließt. Dritte öffentliche Methode derselben Klasse; Paket 7 hat über
  `toBuffersData()` und `fromBuffersData()` entschieden und diese nicht (aus
  Paket 7) → Scope (low, BUG; Verhalten nach `dispose()`)
  · 2026-09-06, Drain-Runde: an Paket 14 zugeschlagen
- [x] `packages/twopoint5d/src/stage/StageRenderer.ts:472-483` und `:296` — ein
  entsorgter `StageRenderer` baut auf zwei Wegen weiter RenderTargets, die kein
  `dispose()` mehr freigibt: `asPassNode()` über `#ensureAsPassNodeRT()`, und
  `renderTo()` über `#ensureInternalRT()`, sobald jemand dem ungeschützten
  öffentlichen Feld `pipeline` nach dem `dispose()` wieder eines zuweist.
  Abschnitt 4 der Richtlinie kennt für `asPassNode()` keine passende Reaktion —
  der Rückgabetyp `Node` behauptet Anwesenheit, also verlangt Regel 2 einen
  Fehler, der Klasse und Zustand nennt. Verwandt: `renderTo()` mit
  `clear === true` räumt nach `dispose()` weiterhin das Ziel des Aufrufers auf
  (`#renderStagesInline`, `:369-377`). Paket 7 hat das TSDoc auf den Stand
  gebracht (`StageRenderer.ts:544-546` nennt beide Wege), das Verhalten aber
  nicht geändert: ein Wurf in `asPassNode()` und ein Guard am `pipeline`-Feld
  sind ein eigener Entwurf, den Schritt 12 des Detailplans ausschließt (aus
  Paket 7) → Scope (low, MEM; Verhalten nach `dispose()`)
  · 2026-09-06, Drain-Runde: an Paket 12 zugeschlagen
- [x] `packages/twopoint5d/src/stage/StageRenderer.ts:614-623` gegen `:194-204`
  — `parent.remove(child)` nimmt das Kind aus `stages`, lässt dessen `#parent`
  aber stehen. `child.parent` nennt danach einen Renderer, der es nicht mehr
  hält; der umgekehrte Weg (`child.parent = undefined`) räumt beide Seiten (aus
  Paket 7) → Scope (low, BUG; die Ownership-Beziehung bleibt halbseitig
  bestehen, das Kind hält eine Referenz auf einen Halter, der es losgelassen
  hat)
  · 2026-09-06, Drain-Runde: an Paket 12 zugeschlagen
- [x] `packages/twopoint5d/src/controls/PanControl2D.ts:365-368` —
  `dispose()` ruft `#restoreCursorStyle()` nicht. Wer ein Control mitten im
  Ziehen entsorgt, lässt die Pan-Cursor-Klasse auf `cursorStylesTarget` liegen
  (Vorgabe `document.body`, `:128`), und der Cursor bleibt für den Rest der
  Seite unsichtbar. Das Element ist hereingereicht — Abschnitt 2 der Richtlinie
  sagt: nicht verändert zurücklassen. Der Kommentar in
  `packages/twopoint5d-testing/test/pan-control-dispose.test.js:53-56` schließt
  genau die Assertion (b) aus, die das gefangen hätte, und ist beim Fix
  mitzuziehen; der erste Fall derselben Datei löst `#hideCursor()` tatsächlich
  aus (aus Paket 7) → Scope (low, BUG; `dispose()` lässt Hereingereichtes
  verändert zurück)
  · 2026-09-06, Drain-Runde: an Paket 13 zugeschlagen
- [x] `packages/twopoint5d/src/controls/PanControl2D.ts:365-368` gegen
  `:200-215` — `dispose()` leert `#pointersDown` nicht. Wer mitten im Ziehen
  entsorgt, dessen nächster `update()`-Aufruf schiebt den vor dem `dispose()`
  angesammelten Pan noch einmal in die `panView` des Aufrufers. Der Testfall aus
  Paket 7 trifft das nicht, weil er erst nach dem `dispose()` drückt; ein
  `pointerdown`/`pointermove`/`dispose()`/`update()` in dieser Reihenfolge zeigt
  es. Anderer Member als der Cursor-Befund darüber, gleiche Methode (aus
  Paket 7) → Scope (low, BUG; Verhalten nach `dispose()`)
  · 2026-09-06, Drain-Runde: an Paket 13 zugeschlagen
- [x] `packages/twopoint5d/src/controls/InputControlBase.ts:47-55` —
  `subscribe()` nach `destroyAllListeners()` setzt `#active` wieder auf `true`,
  über einer leeren Liste. Das Control ist danach formal aktiv und faktisch
  taub; `isActive` verdeckt es nur, weil es zusätzlich die Listenlänge prüft.
  Ein `isDisposed` gibt es an der Basisklasse nicht, ein entsorgtes Control kann
  seinen Zustand also nicht benennen (aus Paket 7) → Scope (low, API; Verhalten
  nach `dispose()`, dieselbe Wiederbelebungslücke, die Paket 3 an `Display` und
  Paket 7 an `StageRenderer` geschlossen haben)
  · 2026-09-06, Drain-Runde: an Paket 13 zugeschlagen
- [x] `packages/twopoint5d/src/display/FrameLoop.ts:133-139` — das gleitende
  Mittel über `measuredFpsCollection` mittelt über 11 Werte statt über die
  deklarierten `MEASURE_COLLECTION_SIZE`. Der `while`-Trimmer läuft nach der
  Mittelung und beim Erreichen der Grenze gar nicht (`10 > 10` ist falsch); ab
  dem 11. Sample hat die Liste zum Zeitpunkt der Mittelung immer 11 Einträge.
  Die Liste ist gebunden, sie wächst nicht — nur das Fenster ist ein anderes als
  das angeschriebene (aus Paket 9) → Audit (low, BUG; weder Lebenszyklus noch
  Wachstum, die Scope-Regel greift nicht)
  · 2026-09-06, Abschluss: ins Audit — BUG-051
- [x] `packages/twopoint5d/src/display/Display.ts:418` — `const {domElement:
  canvas} = this.renderer!;` bricht mit »Cannot destructure property
  'domElement' of undefined« für ein erstes Argument, das weder `WebGPURenderer`
  noch `HTMLElement` ist. Drei Zeilen darüber wirft der `WebGLRenderer`-Zweig
  einen `TypeError`, der sagt, was erwartet wird; dieser Pfad sagt es nicht
  (aus Paket 9) → Audit (low, API; Konstruktor-Eingabe, kein `dispose()`)
  · 2026-09-06, Abschluss: ins Audit — API-042
- [x] `packages/twopoint5d/src/display/Display.ts:404-411` — `...options` wird
  vollständig in die Renderer-Parameter gespreizt, `maxFps`, `resizeTo`,
  `createRenderer`, `styleSheetRoot`, `resizeToElement` und
  `resizeToAttributeEl` landen also im `WebGPURenderer`-Konstruktor. Der
  Ownership-Fall dahinter ist typseitig verriegelt:
  `DisplayRendererParameters` ist `Partial<Omit<…, 'canvas'>>`, ein `canvas` aus
  den Options kann das selbst gebaute also nicht überschreiben, solange niemand
  den Typ umgeht (aus Paket 9) → Audit (low, API; nach Abzug des
  `canvas`-Falls bleibt reine Options-Hygiene)
  · 2026-09-06, Abschluss: ins Audit — API-043
- [x] `packages/twopoint5d/src/display/Display.ts:466-471` — das
  `this.#waitForRenderer.then(…)` am Ende des Konstruktors hat kein `catch`;
  eine abgelehnte Renderer-Initialisierung erzeugt eine unbehandelte Rejection.
  Der Guard, den Paket 9 in den Rumpf gesetzt hat, ändert daran nichts — er
  greift erst, wenn die Zusage erfüllt wird (aus Paket 9, vom Reviewer)
  → Audit (low, BUG; Fehlerbehandlung im Aufbau, kein Verhalten nach
  `dispose()`)
  · 2026-09-06, Abschluss: ins Audit — BUG-052

- [x] `packages/twopoint5d/src/texture/TextureStore.ts:275` — `parse()` hat keinen
  Guard gegen `#disposed` und legt auf einem entsorgten Store weiter Resources in
  `#resources` an. Der zweite `dispose()` kehrt am Flag früh zurück und räumt sie
  nie ab; nur ein `clearUnused()` von Hand käme noch daran. Gemessen: drei
  `parse()`-Aufrufe auf einem entsorgten Store trieben `getSignalsCount()` von 1
  auf 25 — acht Signale je Resource (aus Paket 10, Zug 0) → Scope (low, MEM;
  Verhalten nach `dispose()` und monotones Wachstum über die Lebenszeit des
  Stores) · 2026-09-06, Zug 0 von Paket 10: an Paket 10 zugeschlagen, dieselbe
  Ursache wie der `load()`-Eintrag der Resource
- [x] `packages/twopoint5d/src/texture/TextureStore.ts:238` — `load()` hat keinen
  Guard gegen `#disposed` und holt nach dem `dispose()` weiter über das Netz.
  Gemessen mit einem `fetch`-Stub: er wird gerufen. Der `parse()`-Aufruf am Ende
  der asynchronen Kette deckt zusätzlich den Fall ab, dass das `dispose()` fällt,
  während der Fetch noch fliegt (aus Paket 10, Zug 0) → Scope (low, MEM;
  Verhalten nach `dispose()`) · 2026-09-06, Zug 0 von Paket 10: an Paket 10
  zugeschlagen, gleiche Ursache
- [x] `packages/twopoint5d/src/texture/TextureStore.ts:369` und `:171` — `on()`
  und `onResource()` haben keinen Guard gegen `#disposed` und hinterlassen auf
  einem entsorgten Store Subscriptions, die nichts mehr abmeldet: `on()` legt je
  ein `once(OnDispose)` und ein `once(OnReady)` an, und beide Events können nie
  wieder feuern. Gemessen: zwei `on()`-Aufrufe hinterließen vier Subscriptions,
  ein `onResource()` eine (aus Paket 10, Zug 0) → Scope (low, MEM; monotones
  Wachstum über die Lebenszeit des Stores) · 2026-09-06, Zug 0 von Paket 10: an
  Paket 10 zugeschlagen, gleiche Ursache
- [x] `packages/twopoint5d/src/texture/TextureStore.ts:133` — `get renderer`
  antwortet mit einem Renderer, den jemand dem entsorgten Store zugewiesen hat.
  Die `onChange`-Brücke aus Zeile 157 ist zu diesem Zeitpunkt zerstört, es wird
  also weder ein Event emittiert noch eine `TextureFactory` gebaut —
  `textureFactory` bleibt `undefined`, während `renderer` einen Wert nennt. Das
  Paar läuft auseinander, und der Store sieht lebendig aus. Nach Regel 1 aus
  Abschnitt 4 der Richtlinie muss ein `T | undefined` nach `dispose()`
  `undefined` antworten (aus Paket 10, Zug 0) → Scope (low, API; Verhalten nach
  `dispose()`) · 2026-09-06, Zug 0 von Paket 10: an Paket 10 zugeschlagen,
  gleiche Ursache

- [x] `packages/twopoint5d/src/texture/TextureStore.spec.ts:276, 308, 333, 419` —
  vier `describe`-Namen tragen Abschnittsverweise (`§4.6`, `§6.4`, `§3.3, §6.1`,
  `§4.3, §4.7`) auf ein Dokument, das es im Repo nicht gibt: weder
  `packages/twopoint5d/docs/resource-lifecycle.md` noch ein README trägt diese
  Nummerierung, und andere Markdown-Dateien mit Abschnittsnummern existieren
  nicht. Die Verweise stammen aus `7475b47 refactor: TextureStore and friends`
  und damit von vor diesem Lauf. Ein Testname, der auf nichts zeigt, ist genau
  das, was der Abschnitt »Konventionen« verbietet (aus Paket 10) → Audit (low,
  DOC; betrifft weder Ownership noch `dispose()` noch monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — TEST-017
- [x] `packages/twopoint5d/src/texture/TextureStore.spec.ts:852-1100` — rund
  zehn Tests im `describe('TextureStore')` prüfen ausschließlich
  `TextureResource`: `TextureResource.load() initial firing`,
  `TextureResource.load() image race`, `TextureResource.fromX input safety` und
  weitere. Neben der Datei liegt `TextureResource.spec.ts`, in die sie gehören.
  Kein Defekt, aber jeder, der das Verhalten der Resource sucht, sucht in der
  falschen Datei (aus Paket 10) → Audit (low, TEST; betrifft weder Ownership
  noch `dispose()` noch monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — TEST-018
- [x] `packages/twopoint5d/src/texture/TextureStore.spec.ts:127, 337, 360` gegen
  `:176, 247` — zwei Bauformen für den Renderer-Stub stehen in derselben Datei
  nebeneinander: `{getMaxAnisotropy: () => 16, dispose}` und `{backend: {}}`.
  Beide funktionieren, weil `TextureFactory` den Aufruf von `getMaxAnisotropy()`
  optional macht (`TextureFactory.ts:107`); welche die richtige ist, sagt die
  Datei nicht. Ein gemeinsamer Helfer würde die Frage beantworten (aus Paket 10)
  → Audit (low, TEST; betrifft weder Ownership noch `dispose()` noch monotones
  Wachstum)
  · 2026-09-06, Abschluss: ins Audit — TEST-019
- [x] `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts:30-32` —
  `freeTileSprite(sprite)` ist Zeile für Zeile derselbe Rumpf wie `destroyTile(tile)`
  (`:64-66`): beide rufen `this.tileSprites.geometry?.instancedPool.freeVO(…)`.
  `freeTileSprite()` steht nicht in `IMapTileFactory` (`types.ts:33-46`) und hat im
  ganzen Repo keinen Aufrufer, ist über `map2d/public-api.ts` aber veröffentlicht.
  Zwei Namen für dieselbe Handlung, von denen nur einer im Vertrag steht (aus
  Paket 11, Zug 0) → Audit (low, API; betrifft weder Ownership noch `dispose()`
  noch monotones Wachstum — die Methode tut das Richtige, sie ist nur doppelt)
  · 2026-09-06, Abschluss: ins Audit — API-044
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:58-62` —
  `createHelpers()` greift mit `document.querySelector('.map2dCoords')` in das
  Host-Dokument und schreibt die Ebenenkoordinaten in das gefundene Element. Der
  Block trägt seit jeher `// TODO remove this!`. Bibliothekscode mit einem fest
  verdrahteten CSS-Selektor auf eine Klasse, die das Paket nirgends dokumentiert;
  außerhalb eines DOM ist die Klasse dadurch nicht benutzbar, ohne dass ein Test
  `document` stubben muss (aus Paket 11, Zug 0) → Audit (low, ARCH; betrifft weder
  Ownership noch `dispose()` noch monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — ARCH-004, dort als erneut bestätigt vermerkt
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:149-154` —
  `update()` wirft jeden Helfer weg und baut den ganzen Satz neu auf. Bei
  eingeschalteten Helfern kostet das je gerendertem Bild eine `BoxGeometry` und
  ein `MeshBasicMaterial` je Punkt-Helfer, dazu einen `PlaneHelper` und einen
  `Box3Helper` je sichtbarer Kachel — Allokation und Freigabe im selben Frame, wo
  ein Wiederverwenden der Knoten samt Positionsupdate reichen würde. Kein Leck
  mehr, seit Paket 11 die Freigabe vollständig macht, aber weiter GC- und
  Renderer-Druck (aus Paket 11, Zug 0) → Audit (low, PERF; kein monotones
  Wachstum, und weder Ownership noch `dispose()`)
  · 2026-09-06, Abschluss: ins Audit — PERF-014

- [x] `packages/twopoint5d/src/map2d/HelpersManager.ts:39-46` — `add()` verwirft
  den Knoten stillschweigend, wenn weder `#scene` noch `root` gesetzt ist: der
  `if (target)`-Zweig fällt aus, und der Aufrufer hat seine Referenz nach dem
  `add()` bereits losgelassen. Unter dem Übernahme-Vertrag, den das TSDoc der
  Methode jetzt nennt, ist das genau der Fall, in dem die Übergabe ins Leere
  geht — `CameraBasedVisibilityHelpers.show = true` ohne vorheriges `add(scene)`
  baut fünf Helfer, die niemand mehr sieht und niemand mehr freigibt (aus
  Paket 11, Zug 2) → Scope (medium; Ownership: ein übergebener Knoten geht
  verloren, statt entweder gehalten oder abgelehnt zu werden)
  · 2026-09-06, Drain-Runde 2: an Paket 16 zugeschlagen
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:58` — das
  öffentliche `readonly cammeraBasedVisibility` trägt einen Tippfehler im Namen
  (»cammera«), viermal in der Datei benutzt und über die exportierte Klasse
  veröffentlicht; die Korrektur wäre ein Breaking Change (aus Paket 11, Zug 2)
  → Audit (low, API; betrifft weder Ownership noch `dispose()` noch monotones
  Wachstum)
  · 2026-09-06, Abschluss: ins Audit — API-032, dort als erneut bestätigt vermerkt
- [x] `packages/twopoint5d/src/stage/Canvas2DStage.ts:118-121` — `makeTexture()`
  entsorgt die alte Textur, bevor die neue gebaut und gesetzt ist; solange
  `#textureFactory.create()` läuft, hängt eine freigegebene Textur als
  `sprite.material.map`. Dasselbe Muster, das die Entscheidung vom 2026-09-05
  für `texture/` verboten hat: erst die neue setzen, dann die alte freigeben
  (aus Paket 12, Zug 2) → Scope (medium; Reihenfolge einer Freigabe, und die
  Entscheidung im Kopf des Plans nennt sie beim Namen)
  · 2026-09-06, Drain-Runde 2: an Paket 16 zugeschlagen
- [x] `packages/twopoint5d/src/stage/StageRenderer.ts:174-183` —
  `#renderOrderArray?: string[] = []` startet als leeres Array, und der Getter
  prüft auf Truthiness (`if (!this.#renderOrderArray)`). Ein leeres Array ist
  truthy, also liefert der erste Lesezugriff `[]` statt `['*']`; folgenlos
  bleibt es nur, weil `orderedStages` bei `length === 0` in denselben Zweig
  fällt wie bei `'*'` (aus Paket 12, Zug 2) → Audit (low, BUG; betrifft weder
  Ownership noch `dispose()` noch monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — BUG-053
- [x] `packages/twopoint5d/src/stage/StageRenderer.ts:274-275` — `resize()` gibt
  den beiden RenderTargets `Math.max(1, width)`, während `#ensureRT()` mit
  `Math.floor(width * pixelRatio)` rechnet; bei einem pixelRatio ungleich 1 hat
  das RenderTarget zwischen `resize()` und dem nächsten `#ensureRT()` die
  falsche Größe (aus Paket 12, Zug 2) → Audit (low, BUG; eine
  Größenberechnung, kein Lebenszyklus)
  · 2026-09-06, Abschluss: ins Audit — BUG-054
- [x] `packages/twopoint5d/src/stage/Canvas2DStage.ts:102` und `:153` — zwei
  `as any` führen an `OrthographicProjection#viewSpecs` vorbei (`fit` beim Bau,
  `width`/`height` in `setCanvasSize()`); seit `viewSpecs` als
  `Partial<OrthographicProjectionSpecs>` typisiert ist, braucht es sie
  vermutlich nicht mehr (aus Paket 12, Zug 2) → Audit (low, TYPE; eine
  Typlücke, kein Lebenszyklus)
  · 2026-09-06, Abschluss: ins Audit — TYPE-008
- [x] `packages/twopoint5d/src/stage/StageRenderer.spec.ts:459` und `:587` —
  zwei `toThrowError()`, in Vitest zugunsten von `toThrow()` deprecated (aus
  Paket 12, Zug 2) → Audit (info, QUAL; eine veraltete Matcher-Schreibweise)
  · 2026-09-06, Abschluss: ins Audit — TEST-020
- [x] `packages/twopoint5d/src/controls/PanControl2D.ts:141-146` — der Setter
  `cursorPanStyle` ruft `#installCursorPanStyleRules()` und schreibt darüber an
  `Stylesheets.installRule('PanControl2D', …)`. Seit Paket 9 trägt ein Name genau
  eine Regel im globalen Blatt, und ein anderer `css`-Wert schreibt sie um — die
  Regel gehört damit allen Controls des Moduls gemeinsam. Ein Control, dessen
  `dispose()` gelaufen ist, kann auf diesem Weg den Cursor jedes lebenden
  Controls umstellen; nach Regel 3 in Abschnitt 4 der Richtlinie ist ein
  Schreibzugriff auf einer entsorgten Instanz ein stiller No-op (aus Paket 13,
  Zug 0) → Scope (low, API; Verhalten nach `dispose()`)
  · 2026-09-06, Zug 0 von Paket 13: dort aufgenommen, gleiche Ursache wie die
  drei Einträge des Pakets — eine entsorgte Instanz wirkt weiter nach außen
- [x] `packages/twopoint5d/src/controls/PanControl2D.ts:304-306` —
  `#onPointerMove()` ruft `#restoreCursorStyle()` bei jedem Mausereignis mit
  `buttons === 0`, ohne zu prüfen, ob überhaupt etwas versteckt war. Jede
  Mausbewegung über der Seite feuert damit ein `restoreCursor`-Ereignis und ein
  `classList.remove()` — Ereignisrauschen im Frame-Takt für Abonnenten, die auf
  `restoreCursor` hören (aus Paket 13, Zug 2) → Audit (low, PERF; ein
  Ereignis zu viel im laufenden Betrieb, weder Ownership noch `dispose()` noch
  monotones Wachstum)
  · 2026-09-06, Abschluss: ins Audit — PERF-015
- [x] `packages/twopoint5d/src/controls/PanControl2D.ts:213-220` — der
  angesammelte Pan wird in `update()` nur verrechnet, solange `#pointerDisabled`
  `false` ist. Wer mitten im Ziehen `pointerDisabled = true` setzt, lässt den Pan
  in `#pointersDown` liegen; er wird beim Wiedereinschalten in einem Zug
  nachgeliefert. Dieselbe Bauform wie der Befund, den Paket 13 an `dispose()`
  geschlossen hat, nur über den Setter (aus Paket 13, Zug 2) → Audit (low, BUG;
  ein Setter im laufenden Betrieb, kein Lebenszyklus und kein Wachstum — der Pan
  wird ausgeliefert, nicht angehäuft)
  · 2026-09-06, Abschluss: ins Audit — BUG-055
- [x] `packages/twopoint5d/src/controls/PanControl2D.ts:222-230` — sind Tastatur
  und Zeiger beide abgeschaltet, unterbleibt das `update`-Ereignis, obwohl die
  von Hand gesetzten `speed…`-Felder die `panView` im selben Aufruf verschoben
  haben. Die Bedingung fragt nach den Eingabequellen, nicht danach, ob sich
  etwas bewegt hat (aus Paket 13, Zug 2) → Audit (low, BUG; eine Bedingung im
  laufenden Betrieb, kein Lebenszyklus)
  · 2026-09-06, Abschluss: ins Audit — BUG-056
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:146-150`,
  `:164-171` und `:197-205` — nach `VOBufferPool#dispose()` bleibt der
  `VertexObjectBuffer` hinter `pool.buffer` als Hülle stehen: `descriptor`,
  `capacity`, `attributeNames` und `bufferAttributes` sind unversehrt, `buffers`
  ist leer. Die Klasse ist über `public-api.ts` exportiert und über das
  öffentliche Feld `pool.buffer` erreichbar. Gemessen an einem entsorgten Pool:
  `copyArray()`, `copyAttributes()` und `toAttributeArrays()` werfen je
  `TypeError: Cannot read properties of undefined (reading 'typedArray')`, während
  `copyWithin()`, `touch()` und `clone()` still durchlaufen — `clone()` liefert
  eine zweite Hülle. Paket 14 setzt seinen Guard am Pool und nicht hier: die
  Klasse besitzt ihren Lebenszyklus nicht (der Pool nimmt ihr die Arrays weg) und
  hat keinen Begriff von »verbraucht«; ihr einen zu geben ist ein eigener Entwurf.
  Vorbestehend, `VertexObjectBuffer.ts` ist seit `3dd3207^` unverändert (aus
  Paket 14, Zug 0) → Scope (low, BUG; Verhalten nach `dispose()`)
  · 2026-09-06, Drain-Runde 2: an Paket 17 zugeschlagen
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:25-33` — eine
  `VOBufferGeometry`, die über einem bereits entsorgten Pool gebaut wird, kommt
  still mit null Attributen zur Welt: `#attachments.attach(this.pool)` und
  `initializeAttributes()` laufen über eine leere `buffers`-Map und legen nichts
  an. Gemessen: `new VOBufferGeometry(disposedPool)` → `Object.keys(geometry.attributes).length === 0`
  und `pool.isAttachedToGeometry === true`. Ein Mesh damit zeichnet nichts, und
  der Pool trägt danach eine Anhaftung, die niemand mehr löst. Der Konstruktor
  prüft den Zustand des hereingereichten Pools nicht — andere Ursache als
  Paket 14, das die öffentlichen Member des Pools selbst guardt, und andere
  Klasse. Vorbestehend, `VOBufferGeometry.ts` ist seit `3dd3207^` unverändert
  (aus Paket 14, Zug 0) → Scope (low, BUG; Verhalten nach `dispose()`)
  · 2026-09-06, Drain-Runde 2: an Paket 17 zugeschlagen
  · 2026-09-06, Zug 0 von Paket 17, nachgemessen: der stille Konstruktor steht
    wie beschrieben (null Attribute, null Buffer, ein Index aus dem Descriptor
    mit 24 Einträgen). Die Behauptung »eine Anhaftung, die niemand mehr löst«
    trägt nicht: `VOBufferGeometry#dispose()` ruft `#attachments.detachAll()`
    unbedingt, `isAttachedToGeometry` steht danach wieder auf `false`. Die
    Anhaftung hält genau so lange wie bei jeder anderen Geometrie. Dazu
    gefunden: `InstancedVOBufferGeometry` hat dieselbe Lücke im Konstruktor und
    in `attachInstancedPool()`, beide sind in Paket 17 mit aufgenommen
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:19`, `:63-72`,
  `:93-101` — `dispose()` setzt den Zähler `#geometryAttachments` nicht zurück.
  Ein entsorgter Pool, an dem einmal eine Geometrie hing, antwortet auf dem
  öffentlichen Getter `isAttachedToGeometry` weiter mit `true`, obwohl er keinen
  Buffer mehr hat, an dem etwas hängen könnte; sein TSDoc (`:52-57`) sagt für den
  entsorgten Zustand nichts. Praktisch folgenlos, seit `resize()` wirft — die
  Auskunft ist trotzdem falsch. Vorbestehend (aus Paket 14, Zug 2)
  → Scope (low, BUG; Verhalten nach `dispose()`)
  · 2026-09-06, Drain-Runde 2: an Paket 17 zugeschlagen
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:36-42`, `:74-76`
  und `VertexObjectPool.ts:133-135`, `:158-190` — sieben öffentliche Member ohne
  eine Zeile TSDoc zu ihrem Verhalten nach `dispose()`: der `usedCount`-Getter
  und -Setter, `clear()`, `containsVO()`, `freeVO()` (der Block dort erklärt die
  Kopierkosten, nicht das Verhalten) und `getVO()`. Punkt 6 der Checkliste in
  Abschnitt 7 der Richtlinie verlangt beides — das Verhalten je Member zu
  entscheiden und es in dessen TSDoc zu sagen. Paket 14 hat das Verhalten
  entschieden und am entsorgten Pool gemessen (Entscheidung 5: alle sieben
  erfüllen Abschnitt 4 bereits), die Dokumentation fehlt. Zusicherung (c) aus
  Abschnitt 8 misst damit gegen ein TSDoc, das es nicht gibt. Sammelnd zu
  schließen, ein Satz je Member oder einer an `dispose()`. Vorbestehend (aus
  Paket 14, Zug 2 und Zug 3) → Scope (low, DOC; Verhalten nach `dispose()`)
  · 2026-09-06, Drain-Runde 2: an Paket 17 zugeschlagen
- [x] `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts:41`,
  `src/sprites/TexturedSprites/TexturedSprites.spec.ts:79`,
  `src/texture/TextureStore.spec.ts:75`,
  `src/vertex-objects/InstancedVertexObjectGeometry.spec.ts:127` und
  `src/vertex-objects/vertex-buffers-geometry-updates.spec.ts:668` — fünf
  Dispose-Test-Blöcke, die nie gegen das Muster aus Abschnitt 8 der Richtlinie
  beschriftet wurden. Die übrigen vierzehn Blöcke vermerken jeden Fall ohne Test
  als »has no subject here«; diese fünf tragen zusammen einen einzigen
  Buchstaben (`TextureStore.spec.ts:244`, Fall `(c)`). Für jeden Fall ohne Test
  ist dort nicht zu unterscheiden, ob er geprüft oder übersehen wurde — bei
  `AnimatedSpritesMaterial` etwa fehlt jede Auskunft zu Fall `(a)`. Paket 15
  zieht in allen fünf allein den Fall `(f)` nach, weil das sein Ziel ist; die
  Fälle `(a)` bis `(e)` bleiben dort unbeantwortet. Vorbestehend — vier der
  Blöcke sind älter als der erste Commit dieses Laufs, der fünfte
  (`TexturedSprites.spec.ts`) entstand in Paket 2, bevor die Beschriftung
  Konvention war (aus Paket 15, Zug 0) → Scope (low, TEST; der Nachweis des
  Verhaltens nach `dispose()` ist genau der Gegenstand, den die Scope-Regel
  meint, und die Lücke ist dieselbe, die TEST-005 und TEST-006 für diesen Lauf
  geöffnet haben)
  · 2026-09-06, Drain-Runde 2: an Paket 18 zugeschlagen · 2026-09-06 erledigt
  mit a3299ea, und weiter als der Eintrag reichte: nicht fünf Blöcke, sondern
  alle zwölf unvollständigen tragen jetzt jeden der sechs Fälle
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:25` — `buffer` ist
  ein öffentliches, schreibbares Feld ohne jeden Guard. Wer einem entsorgten Pool
  einen frischen `VertexObjectBuffer` zuweist, hebelt den Dispose-Vertrag aus:
  `createVO()` und `getVO()` fragen zwar `isDisposed`, aber `createFromAttributes()`,
  `toBuffersData()` und `fromBuffersData()` arbeiteten auf dem untergeschobenen
  Buffer. Vorbestehend, das Feld ist älter als der erste Commit dieses Laufs (aus
  Paket 17) → Scope (medium, API; ein schreibbares `buffer` in der öffentlichen
  Fläche ist genau die Ownership-Frage, die die Scope-Regel meint)
  · 2026-09-06, Drain-Runde 3: an Paket 19 zugeschlagen · 2026-09-06 mit
  Paket 19 behoben (f90dbbf)
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts:62-84` — das
  TSDoc von `dispose()` sagt nicht, was hinterher stehenbleibt (`#serials` und
  `#firstAutoTouch` überleben unverändert); die Schwesterklasse schreibt genau
  das in ihr TSDoc (`InstancedVOBufferGeometry.ts:356-359`). Vorbestehend, reine
  Doku-Lücke (aus Paket 17) → Scope (low, DOC; das Verhalten nach `dispose()`
  ist der Gegenstand der Scope-Regel, und Punkt 6 der Checkliste in Abschnitt 7
  der Richtlinie verlangt den Satz)
  · 2026-09-06, Drain-Runde 3: an Paket 19 zugeschlagen · 2026-09-06 mit Paket 19
  behoben (f90dbbf)
- [x] `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:12` —
  die generierten Attribut-Getter greifen ungeprüft auf `this[voBuffer]!.buffers`
  zu. Der `voPrototype` eines Deskriptors trägt nie einen Buffer, jeder Zugriff
  darauf wirft also einen `TypeError`. Das trifft die Testausgabe: sobald eine
  Assertion über einen `VertexObjectBuffer`, einen `VOBufferPool` oder einen
  `VertexObjectDescriptor` fehlschlägt, stirbt der Diff-Printer von Vitest am
  Prototyp, statt die Assertion auszugeben — die eigentliche Fehlermeldung ist
  dann unsichtbar. Vorbestehend (aus Paket 19) → Audit (low, DX; betrifft weder
  Ownership noch `dispose()` noch monotones Wachstum, sondern die Lesbarkeit
  fehlschlagender Tests · gedeckt von der Entscheidung zur Drain-Runde 3)
  · 2026-09-06, Abschluss: ins Audit — DOC-016
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:107-113` —
  `resize()` definiert `capacity` per `Object.defineProperty` mit
  `configurable: true` neu, obwohl die Basisklasse `readonly capacity`
  deklariert (`VOBufferPool.ts:16`); ein Aufrufer kann dieselbe Property von
  außen genauso überschreiben. Vorbestehend (aus Paket 19) → Audit (low, API;
  reine Kapselungsfrage, kein Weg zurück in einen entsorgten Pool — `resize()`
  wirft dort, und die Gegenprobe unter Paket 19 hat die Stelle geprüft ·
  gedeckt von der Entscheidung zur Drain-Runde 3)
  · 2026-09-06, Abschluss: ins Audit — API-045

## Pakete

### [x] 1. Richtlinie für den Lebenszyklus von Ressourcen

- Findings: TEST-006 (medium, der Checklisten-Teil)
- Ziel: Ein Dokument, das Ownership, Idempotenz, den Vertrag nach `dispose()`,
  die Signal- und Effect-Aufräumkette und das Test-Muster für `dispose()` als
  verbindliche Regel festschreibt, und das aus README und AGENTS.md erreichbar ist.
- Bereich: `packages/twopoint5d/docs/resource-lifecycle.md` (neu),
  `packages/twopoint5d/README.md`, `AGENTS.md`
- Hängt ab von: —
- Hash: 3dd3207
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/docs/resource-lifecycle.md` — neu, das ganze Dokument ·
  `packages/twopoint5d/README.md` — ein Block hinzu, sonst unverändert ·
  `AGENTS.md` — eine Zeile in §6 hinzu, sonst unverändert. Drei Dateien, keine vierte.
- Review-Fokus: Der Reviewer prüft nicht Prosa, sondern Wahrheit — jeden Symbolnamen,
  jede Signatur und jedes zitierte Beispiel gegen die Quelldatei, aus der es stammt.
  Ein Satz, der eine API falsch benennt, wird von sechs Folgepaketen befolgt. Deshalb
  ist die mittlere Modellstufe hier die Untergrenze, auch wenn der Diff nur Markdown ist.

#### Warum dieses Paket stark besetzt ist

Das Dokument ist der Vertrag, gegen den die Pakete 2 bis 7 gebaut werden; fünf von
ihnen verlangen wörtlich einen »Dispose-Test nach dem Muster aus Paket 1«. Eine
unscharfe Regel hier wird sechsmal befolgt, und kein späteres Gate fängt ein
Dokument ab, das sich gut liest und das Falsche vorschreibt.

#### Drei Entscheidungen dieses Zuges

Sie stehen hier und nicht unter »Entscheidungen« im Kopf: getroffen hat sie Zug 0
mit dem Code vor Augen, nicht der Nutzer.

1. **Das Dokument ist normativ, nicht deskriptiv.** Es schreibt im Imperativ, was
   ein `dispose()` zu tun hat. Es enthält an keiner Stelle eine Inventarliste
   (»diese Klassen halten die Regel ein«) und keine Aussage über den
   Erfüllungsgrad der Bibliothek. Grund: beim Commit dieses Pakets erfüllt der
   Code die Regel noch nicht überall — genau dafür gibt es die Pakete 2 bis 7 —,
   und eine Inventarliste wäre mit jedem davon wieder falsch.
2. **Kein CHANGELOG-Eintrag in diesem Paket.** Das Dokument ändert kein Verhalten
   und liegt nicht im npm-Tarball: `scripts/publishNpmPkg.mjs` kopiert
   `README-pkg.md`, `CHANGELOG.md` und `LICENSE` nach `dist/`, sonst nichts aus
   dem Paketverzeichnis. Den Eintrag schreibt das erste Paket, das an der
   Oberfläche etwas ändert, und verlinkt das Dokument dort.
3. **Wann ein Zugriff nach `dispose()` wirft und wann er `undefined` antwortet.**
   Die Zeile in »Entscheidungen« nennt den werfenden Fall (`Display.canvas`); der
   Code liefert daneben bereits den stillen Fall (`TexturedSprites#texture`
   antwortet `undefined`, `freeSprite()` tut nichts). Beides ist richtig, und die
   Trennlinie ist der Typ: ein Member, dessen Typ die Abwesenheit schon zulässt
   (`T | undefined`), antwortet `undefined`; ein Member, dessen Typ Anwesenheit
   behauptet, wirft einen Error, der Klasse und Zustand nennt, statt den Typ zu
   belügen; eine verändernde Methode ohne verbleibendes Ziel ist ein stiller No-op.
   Diese Regel steht im Dokument und gilt damit für die Pakete 2 bis 7.

#### Vorgehen

1. **Erst lesen, dann schreiben.** Jede Regel wird gegen Code formuliert, der heute
   dasteht, und jedes Beispiel im Dokument ist aus einer dieser Dateien
   abgeschrieben, nicht erfunden:
   - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts` — `declareOwnedPool()`
     und `dispose()` samt der beiden Kommentare darin; das Referenzmuster für Ownership
     und für die Reihenfolge gegenüber `super.dispose()`.
   - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts` —
     `attachInstancedPool(name, pool, {autoDispose})`: der einzige ausdrückliche
     Übernahme-Schalter der Bibliothek, dessen Vorgabewert selbst wieder der
     Ownership-Regel folgt. Der TSDoc-Block darüber sagt das in ganzen Sätzen.
   - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts` und
     `packages/twopoint5d/src/display/FixedFrameLoop.ts` — der `isDisposed`-Getter.
   - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts` —
     `createEffect(fn, {attach: this})` im Konstruktor, `SignalGroup.delete(this)`
     in `dispose()`, und `super.dispose()` danach.
   - `packages/twopoint5d/src/display/Display.ts` — `dispose()` feuert
     `emit(this, OnDisplayDispose, this)` und räumt erst danach mit `off(this)` ab.
   - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts` —
     die sechs Tests unter `describe('dispose()')`. Aus ihnen wird das Test-Muster
     verallgemeinert, nicht aus einem frei gedachten Entwurf. Sie decken die
     Assertionen (c) bis (e) aus Abschnitt 8 bereits ab; (a) und (b) kommen aus
     `InstancedVertexObjectGeometry.spec.ts`.
   - `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`,
     `describe('dispose()')` — Ownership-Assertions mit `sandbox.spy(obj, 'dispose')`.
   - `packages/twopoint5d/src/stage/README.md`, Abschnitte »Resource lifecycle« und
     »Common pitfalls« — die Schicht-Regel, die das neue Dokument verallgemeinert.
     Das stage-README bleibt unverändert; es ist die Detailansicht einer Schicht,
     das neue Dokument die allgemeine Regel.
   - `AGENTS.md` §6 und §8 sowie `packages/twopoint5d/README.md` ganz, für Ton und
     Auszeichnungsstil der beiden Dateien, in die verlinkt wird.
2. **`packages/twopoint5d/docs/resource-lifecycle.md` anlegen** (das Verzeichnis
   `docs/` gibt es noch nicht). Englisch, Markdown, schlicht und technisch nach
   AGENTS.md §8. Genau diese Abschnitte, in dieser Reihenfolge:
   1. **Scope** — für wen die Regeln gelten: jede Klasse mit einer
      `dispose()`-Methode, und jedes neue Modul, das eine bekommt. Ein Absatz.
   2. **Ownership** — `dispose()` gibt nur frei, was die Instanz selbst erzeugt hat.
      Was durch Konstruktor, Setter oder eine Attach-Methode hereingereicht wurde,
      bleibt dem Aufrufer und wird nicht angefasst. Wer eine Ressource hereinreicht,
      entsorgt sie selbst. Wer eine Ressource herausgibt, die er besitzt, bleibt ihr
      Eigentümer. Beispiel: `VOBufferGeometry` mit `declareOwnedPool()`.
      Ein neuer Übernahme-Schalter wird nicht eingeführt — die Regel beantwortet
      die Frage bereits, und ein Schalter macht aus einer Invariante eine Option.
      `attachInstancedPool(name, pool, {autoDispose})` bleibt der einzige, den es
      gibt, und er ist keiner im Sinne dieses Verbots: sein Vorgabewert stellt
      dieselbe Frage wie die Regel — hat die Geometrie den Pool selbst gebaut? —,
      und er existiert für den Fall, dass ein Pool von mehreren Geometrien geteilt
      wird. Das Dokument beschreibt ihn als das, was er ist, und nicht als Vorbild.
   3. **Idempotence** — `dispose()` darf beliebig oft aufgerufen werden: der zweite
      Aufruf gibt nichts ein zweites Mal frei und wirft nicht. Wo ein Aufrufer den
      Zustand braucht, wird er als `isDisposed`-Getter gezeigt (`VOBufferPool`,
      `FixedFrameLoop`).
   4. **After `dispose()`** — die drei erlaubten Reaktionen eines öffentlichen
      Members, mit der Typregel aus Entscheidung 3 oben als Auswahlkriterium, plus:
      offene Promises werden beim `dispose()` rejected, nicht liegengelassen. Was
      dieser Abschnitt verhindern soll, wird beim Namen genannt — ein `TypeError`
      aus einem Feld, das stillschweigend `undefined` geworden ist, ist keine der
      drei Reaktionen.
   5. **Signals, effects and events** — die Aufräumkette. Jedes Signal und jeder
      Effect einer Instanz entsteht mit `{attach: this}`; `dispose()` ruft
      `SignalGroup.delete(this)`, und das ist der ganze Abbau der Signalseite.
      `SignalGroup.destroy()` ist deprecated und wird nicht verwendet. Auf der
      Eventize-Seite: `off(this)` nimmt alle Listener; eine Klasse, an der andere
      hängen, feuert ihr Dispose-Event, bevor sie ihre eigenen Listener abräumt
      (`Display`). Dazu die Reihenfolgeregel: eigene Ressourcen werden freigegeben,
      **bevor** `super.dispose()` die Signalgruppe abräumt — sonst hängt die
      Freigabe daran, dass ein zerstörtes Signal seinen letzten Wert noch hergibt.
   6. **three.js interop** — eine Klasse, die von `Material`, `BufferGeometry` oder
      `Mesh` erbt, überschreibt `dispose()` und ruft `super.dispose()`. Wo in der
      Methode dieser Aufruf steht, hängt davon ab, was die Basisklasse tut, und
      dieser Abschnitt muss beide Fälle nennen, sonst rät ein späteres Paket:
      - Kündigt `super.dispose()` nur an — `THREE.BufferGeometry` feuert sein
        Dispose-Event, und der Renderer liest daraufhin die Attribute ein letztes
        Mal —, steht es **zuerst**, solange noch alles gefüllt ist. So macht es
        `VOBufferGeometry.dispose()`, mit dem Grund als Kommentar an Ort und Stelle.
      - Räumt `super.dispose()` bereits ab, was die eigene Freigabe noch braucht —
        eine Material-Basisklasse, die `SignalGroup.delete(this)` ruft und damit
        die Signale zerstört, an denen die eigenen Ressourcen hängen —, steht es
        **zuletzt**. So macht es `AnimatedSpritesMaterial.dispose()`.
      Die gemeinsame Regel dahinter, und nur sie ist auswendig zu lernen: nichts
      freigeben, dessen Zugriffsweg der `super`-Aufruf schon gekappt hat, und
      nichts wegnehmen, das der `super`-Aufruf noch lesen wird.
      Ein Mesh, das Geometry und Material besitzt, nimmt sich in `dispose()` per
      `removeFromParent()` aus dem Szenengraph, statt die Reihenfolge vom Aufrufer
      zu verlangen.
   7. **Checklist for a new `dispose()`** — die Liste, die TEST-006 verlangt. Kurz,
      nummeriert, jede Zeile prüfbar: eigene Ressourcen freigeben, fremde nicht
      anfassen; Signalgruppe löschen; Dispose-Event feuern, dann Listener abräumen;
      Verhalten jedes öffentlichen Members nach `dispose()` festlegen und im TSDoc
      nennen; `isDisposed` zeigen, wo es gebraucht wird; die Tests aus Abschnitt 8
      mitliefern.
   8. **The dispose test pattern** — ein lauffähiges Vitest-Skelett, aus dem ein
      Autor kopiert. `createSandbox()` aus `sinon` mit `afterEach(() =>
      sandbox.restore())` für Spies auf Methoden des Prüflings (`vi.spyOn` nur für
      Globale wie `fetch` oder `console`). Fünf Assertionen, jede mit einem Satz,
      was sie beweist: (a) eine selbst erzeugte Ressource wird genau einmal
      freigegeben; (b) eine hereingereichte gar nicht; (c) nach `dispose()` verhält
      sich jedes öffentliche Member wie dokumentiert; (d) ein zweiter
      `dispose()`-Aufruf wirft nicht und gibt nichts erneut frei; (e) keine
      Signal- oder Effect-Leichen — `getSignalsCount()` und `getEffectsCount()` aus
      `@spearwolf/signalize` vor der Konstruktion messen und nach `dispose()`
      wieder auf demselben Wert erwarten. Für GPU-Pufferverhalten der Hinweis auf
      den zusätzlichen Browser-Test in `packages/twopoint5d-testing/`.
3. **Was zitiert werden darf und was nicht.** Als Beispiel taugt nur Code, der die
   Regel heute schon erfüllt — nachgesehen in Zug 0:
   - Erlaubt: `VOBufferGeometry` und `InstancedVOBufferGeometry` (Ownership,
     Reihenfolge), `VOBufferPool` und `FixedFrameLoop` (`isDisposed`),
     `TexturedSprites` als Beispiel für Getter, die nach `dispose()` `undefined`
     antworten, `TexturedSpritesMaterial` und `TileSpritesMaterial` (Signalkette),
     `Display` (Dispose-Event vor `off(this)`), `StageRenderer` samt der Regel aus
     dem stage-README, `AnimatedSpritesMaterial` **ausschließlich** für die
     Reihenfolge »eigene Freigabe vor `super.dispose()`« und für die Leak-Zähler.
   - Verboten als Ownership- oder Vertragsbeispiel, weil die Pakete 2 bis 6 sie
     gerade deshalb anfassen: `TexturedSprites.dispose()` und `AnimatedSprites`
     (geben auch hereingereichte Geometry und Material frei),
     `AnimatedSpritesMaterial#animsMap` (gibt eine hereingereichte Textur frei),
     `Display#canvas` nach `dispose()`, `TextureResource` und `TextureStore`,
     `CameraBasedVisibility`. Ein Dokument, das den Vorzustand dieser Klassen als
     Vorbild zeigt, wäre in drei Commits falsch.
4. **Aus `packages/twopoint5d/README.md` verlinken.** Ein Block im Stil der
   vorhandenen Modul-Blöcke, hinter dem letzten davon (`#### [display]`) und vor
   `have fun!`, mit relativem Ziel `docs/resource-lifecycle.md`. Überschrift und
   Bulletstil der Nachbarblöcke übernehmen; kein Umbau der übrigen Datei.
5. **Aus `AGENTS.md` §6 verlinken.** Ein weiterer Aufzählungspunkt im Stil der vier
   vorhandenen (`-   **Label:** …`, drei Leerzeichen nach dem Strich), relatives
   Ziel `packages/twopoint5d/docs/resource-lifecycle.md`. §8 bleibt unangetastet.
   `CLAUDE.md` bekommt keinen eigenen Verweis — es erklärt AGENTS.md zur
   kanonischen Quelle und erbt den Link damit.
6. **Sonst nichts.** Kein Quellcode, kein Test, kein CHANGELOG, keine Änderung am
   stage-README, keine Umbenennung. Der Diff dieses Pakets hat genau drei Dateien.
   Was beim Lesen der Quellen auffällt und nicht hierher gehört, wird als
   Nebenbefund mit Datei und Zeile gemeldet, nicht behoben.

- Verify: `pnpm lint && bad=$(for f in packages/twopoint5d/docs/resource-lifecycle.md packages/twopoint5d/README.md AGENTS.md; do d=$(dirname "$f"); grep -oP '\]\(\K[^)#]*' "$f" | grep -Ev '^(https?:|mailto:|$)' | while read -r l; do [ -e "$d/$l" ] || echo "BROKEN $f -> $l"; done; done); [ -z "$bad" ] || { echo "$bad"; false; }`
  — `pnpm lint` ist der Regressionsteil (`*.md` steht in `.prettierignore`, der
  Lauf muss also unverändert grün bleiben); der zweite Teil ist der eigentliche
  Beleg: jedes relative Markdown-Ziel der drei Dateien existiert. In Zug 0 gegen
  den heutigen Stand von `README.md` und `AGENTS.md` erprobt, grün, und gegen eine
  absichtlich kaputte Datei rot. Ein voller `pnpm run ci` steht in keinem Verhältnis
  zu einem Diff ohne eine Zeile TypeScript.
- Commit: `docs: add the resource lifecycle rules for dispose() and ownership`
- Ergebnis: 2 Runden · TEST-006 (Checklisten-Teil) erfüllt:
  `packages/twopoint5d/docs/resource-lifecycle.md` mit acht Abschnitten,
  Checkliste und Vitest-Skelett, verlinkt aus `packages/twopoint5d/README.md`
  und `AGENTS.md` §6 · Runde 1 schloss vier Review-Befunde: das
  `AnimatedSpritesMaterial`-Zitat trug einen verbotenen Ownership-Fall, Zeile 8
  behauptete einen Erfüllungsgrad, das Test-Skelett war nicht als Vorlage
  gekennzeichnet, Assertion (c) prüfte nur zwei der drei Reaktionen nach
  `dispose()` · kein Regressionstest, das Paket ändert kein Verhalten
- Nebenbefunde: → Queue (3)
- Folgen: `packages/twopoint5d/docs/resource-lifecycle.md:197` — der Satz über
  die Reihenfolge belegt sich an `AnimatedSpritesMaterial.dispose()`; ändert
  Paket 2 dort die Freigabe, ist der Satz erneut gegen die Quelle zu halten und
  fällt weg, wenn dort keine eigene Freigabe mehr vor `super.dispose()` steht ·
  `packages/twopoint5d/docs/resource-lifecycle.md:90` und `:98` — die Verweise
  auf `TexturedSprites#texture` und `#freeSprite()` als Beispiel für den stillen
  Vertrag nach `dispose()` wandern mit, falls Paket 2 diese Signaturen bewegt ·
  2026-09-05, Zug 0 von Paket 7: beide erledigt, ohne Änderung. Der
  Reihenfolge-Absatz und `AnimatedSpritesMaterial.ts:109-115` sind deckungsgleich,
  und die beiden Beispielnamen stehen unverändert in `TexturedSprites.ts:26` und
  `:69`. Nachgesehen an der Fundstelle, Tabelle unter Paket 7
- Schnittstellen: `packages/twopoint5d/docs/resource-lifecycle.md` — das
  Dokument, auf das die Pakete 2 bis 7 sich mit »dem Muster aus Paket 1«
  beziehen. Abschnitt 7 ist die Checkliste, Abschnitt 8 das Test-Skelett mit den
  fünf Assertionen (a) bis (e); die Typregel für das Verhalten nach `dispose()`
  steht in Abschnitt 4

**TEST-006 · medium · packages/twopoint5d/src/** — Dispose-Tests sind nicht systematisch

Rund 17 Module haben eine `dispose()`-Methode. Geprüft wird sie dort, wo ein
konkreter Bug dazu gezwungen hat, sonst nirgends. Die Häufung von Dispose-Bugs in
diesem Audit ist kein Zufall, sondern die direkte Folge.

Empfehlung: Ein einheitliches Muster pro Modul: Spy auf die freizugebende
Ressource, `dispose()` aufrufen, Freigabe assertieren, danach Idempotenz prüfen.
Als kurze Checkliste in die Contributing-Notizen, damit neue Module das
mitbringen.

### [x] 2. Sprites: Ownership und Vertrag nach dispose()

- Findings: MEM-009 (medium), MEM-010 (medium), API-028 (low), TEST-005 (high,
  nur der Dispose-Test für `TexturedSpritesMaterial`; das Finding bleibt offen)
- Ziel: `TexturedSprites`, `AnimatedSprites` und ihre Materialien geben nur
  frei, was sie selbst erzeugt haben, nehmen sich beim `dispose()` aus dem
  Szenengraph, und jede dieser Klassen hat einen Dispose-Test nach dem Muster
  aus Paket 1.
- Bereich: `packages/twopoint5d/src/sprites/`, dazu `docs/resource-lifecycle.md`
  und `CHANGELOG.md` desselben Pakets
- Restplan-Änderung (2026-09-05, Zug 0 von Paket 1): `TileSpritesMaterial` fällt aus
  diesem Paket heraus. Sein `dispose()` ist bereits `SignalGroup.delete(this)` plus
  `super.dispose()` und fasst die hereingereichte `colorMap` nicht an — die
  Ownership-Lücke, um die es hier geht, hat es nicht. Was ihm fehlt, ist der
  Dispose-Test, und den holt Paket 6 ohnehin. So fasst nur ein Paket die Datei an.
- Folge aus Paket 1 (2026-09-05): ändert dieses Paket die Freigabe in
  `AnimatedSpritesMaterial.dispose()` oder die Signaturen von
  `TexturedSprites#texture` / `#freeSprite()`, werden die Stellen
  `packages/twopoint5d/docs/resource-lifecycle.md:90`, `:98` und `:197`
  mitgezogen. Sie zitieren diesen Code; der Diff dieses Pakets hat dann eine
  Doku-Datei mehr.
- Hängt ab von: 1
- Hash: 0d0aa0f
- Modell: stärkste Stufe
- Effort: medium
- Dateien: zehn, keine elfte.
  1. `src/sprites/TexturedSprites/TexturedSprites.ts` — Ownership-Felder, Konstruktor, `dispose()`, TSDoc
  2. `src/sprites/AnimatedSprites/AnimatedSprites.ts` — `dispose()`, TSDoc
  3. `src/sprites/TexturedSprites/TexturedSpritesMaterial.ts` — `dispose()`, TSDoc
  4. `src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts` — `dispose()`, TSDoc
  5. `src/sprites/TexturedSprites/TexturedSprites.spec.ts` — erweitert
  6. `src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts` — drei Tests geändert, einer entfällt
  7. `src/sprites/AnimatedSprites/AnimatedSprites.spec.ts` — neu
  8. `src/sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts` — neu
  9. `docs/resource-lifecycle.md` — drei Stellen
  10. `CHANGELOG.md` — Einträge unter `### Changed` und ein `####`-Block unter dem
      vorhandenen `### Migration Guide` in `[Unreleased]`
  (alle Pfade relativ zu `packages/twopoint5d/`)

#### Abgleich am Code, Zug 0 (2026-09-05)

| Finding | Fundstelle heute | Urteil |
| --- | --- | --- |
| MEM-009 | `AnimatedSpritesMaterial.ts:90-95` — `dispose()` ruft `this.#animsMap.value?.dispose()` | unverändert, Zeilen um fünf verschoben |
| MEM-010 | `TexturedSprites.ts:64-69` — `dispose()` entsorgt Geometry und Material bedingungslos | unverändert, Zeilen um eins verschoben |
| API-028 | `TexturedSprites.ts:64-69` und `AnimatedSprites.ts:17-22` — kein `removeFromParent()` | unverändert |
| TEST-005 | `src/sprites/` hat zwei Specs (`AnimatedSpritesMaterial.spec.ts`, `TexturedSprites.spec.ts`), keiner für `TexturedSpritesMaterial` | der Dispose-Anteil steht noch offen; der Rest des Findings (BaseSprite, TexturedSprite, AnimatedSprite, Frame-Timing) bleibt außerhalb dieses Pakets |

#### Fünf Entscheidungen dieses Zuges

Getroffen mit dem Code vor Augen, deshalb hier und nicht unter »Entscheidungen« im Kopf.

1. **Keine Ownership-Buchführung in den Materialien.** Weder
   `AnimatedSpritesMaterial` noch `TexturedSpritesMaterial` erzeugt jemals eine
   Textur — `animsMap` und `colorMap` kommen ausschließlich aus den
   Konstruktor-Optionen oder dem Setter. Die Empfehlung des Audits zu MEM-009
   (»die Ownership beim Setzen festhalten«) verwaltet damit eine Unterscheidung,
   die es in diesen Klassen nicht gibt: ein Flag, das nie `true` wird. Der
   `dispose()`-Aufruf auf der Textur fällt ersatzlos weg. Abweichung von der
   Empfehlung, Grund hier.
2. **`AnimatedSprites` gibt gar nichts frei.** Sein Konstruktor nimmt Geometry und
   Material entgegen und baut keines von beiden; nach der Ownership-Regel besitzt
   er also nie etwas. Sein `dispose()` verlässt den Szenengraph und gibt beide
   Referenzen auf, mehr nicht. Das ist eine echte Verhaltensänderung für Aufrufer
   und gehört deshalb in den Migration Guide. Die Alternative — `AnimatedSprites`
   wie `TexturedSprites` eine Kapazität annehmen lassen, damit er etwas besitzen
   *kann* — wäre eine neue API und steht nicht in diesem Lauf.
3. **`TexturedSpritesMaterial.dispose()` räumt seine beiden optionalen Member.**
   `colorMap` und `texCoordsNode` sind `T | undefined` und fallen damit unter
   Regel 1 aus Abschnitt 4 der Richtlinie: sie antworten nach `dispose()`
   `undefined`. Ohne das Räumen antwortet ein zerstörtes Signal weiter mit seinem
   letzten Wert, und der Aufrufer bekommt eine Textur zurück, die ihr Eigentümer
   längst entsorgt haben kann. Die fünf Node-Getter mit nicht-optionalem Typ
   bleiben unangetastet: sie antworten mit ihrem letzten Node, und das ist ein
   gültiger Wert ihres Typs, keine Lüge im Sinne von Regel 2.
4. **Ein Satz am `dispose()` statt fünf Sätze an fünf Gettern.** Punkt 6 der
   Checkliste verlangt das Verhalten nach `dispose()` im TSDoc jedes öffentlichen
   Members. Für die Node-Accessoren steht es einmal im TSDoc von `dispose()`
   (»die Node-Accessoren behalten ihren letzten Node«) statt fünfmal wortgleich;
   die optionalen Member bekommen ihren Satz einzeln. Zweck der Regel ist, dass
   der Aufrufer es findet — eine maßgebliche Stelle tut das besser als fünf
   Kopien, die auseinanderlaufen.
5. **Kein `#disposed`-Flag, kein `isDisposed`-Getter.** Jeder Schritt in diesen
   vier `dispose()`-Methoden ist von sich aus idempotent: geräumte Referenzen
   lassen die optionalen Aufrufe leerlaufen, `removeFromParent()` prüft auf
   `parent === null`, `SignalGroup.delete()` und ein zweites `set(undefined)`
   tun beim zweiten Mal nichts. Ein zusätzliches Flag bewachte nur noch
   `super.dispose()` von three.js, und dessen zweiter Aufruf ist heute schon
   erprobt (`AnimatedSpritesMaterial.spec.ts`, »is safe to call twice«).
   `isDisposed` steht nach Abschnitt 3 dort, wo Aufrufer verzweigen müssen — der
   Lookbook-Aufrufer verzweigt an `spritePool == null`, nicht an einem Zustand.

#### Vorgehen

Reihenfolge einhalten: erst die roten Tests (Schritt 1), dann der Code
(Schritte 2 bis 5), dann Doku und CHANGELOG (Schritte 6 und 7).

1. **Regressionstests zuerst, rot sehen, Ausgabe in den Report.** Diese fünf
   Tests fallen gegen den heutigen Code durch und sind der Nachweis:
   - `TexturedSprites`: eine hereingereichte `TexturedSpritesGeometry` wird nicht entsorgt.
   - `TexturedSprites`: ein hereingereichtes `TexturedSpritesMaterial` wird nicht entsorgt.
   - `TexturedSprites`: `dispose()` nimmt das Mesh aus dem Szenengraph.
   - `AnimatedSprites`: `dispose()` nimmt das Mesh aus dem Szenengraph und entsorgt weder Geometry noch Material.
   - `AnimatedSpritesMaterial`: eine hereingereichte `animsMap` wird nicht entsorgt.
   Kommando: `cd packages/twopoint5d && pnpm vitest --run src/sprites`.
   Der rote Lauf gehört im Wortlaut in den Report.

2. **`TexturedSprites.ts`** — Ownership festhalten, wo sie entsteht.
   - Zwei private Felder: `#ownsGeometry: boolean;` und `#ownsMaterial: boolean;`.
     (`useDefineForClassFields` steht auf `false`, Zuweisung im Konstruktorrumpf
     nach `super()` ist der reguläre Weg.)
   - Der Konstruktor verliert den Vorgabewert am zweiten Parameter. Er lautet
     danach:
     ```ts
     constructor(
       geometry?: number | TexturedSpritesGeometry | TexturedSpriteGeometryParameters,
       material?: Texture | TexturedSpritesMaterial | TexturedSpritesMaterialParameters,
     ) {
       super(
         geometry instanceof TexturedSpritesGeometry ? geometry : new TexturedSpritesGeometry(geometry),
         material instanceof TexturedSpritesMaterial
           ? material
           : isTexture(material)
             ? new TexturedSpritesMaterial({colorMap: material})
             : new TexturedSpritesMaterial(material),
       );

       this.#ownsGeometry = !(geometry instanceof TexturedSpritesGeometry);
       this.#ownsMaterial = !(material instanceof TexturedSpritesMaterial);

       this.name = 'twopoint5d.TexturedSprites';
     }
     ```
     Der Vorgabewert `= new TexturedSpritesMaterial()` muss weg, und das ist die
     eine Falle dieses Pakets: er wird im Konstruktor ausgewertet, ist also ein
     `TexturedSpritesMaterial`, und eine Prüfung `material instanceof
     TexturedSpritesMaterial` hielte ihn für hereingereicht. Das selbst gebaute
     Material bliebe dann für immer liegen. Der `undefined`-Zweig oben baut
     dasselbe Objekt und zählt es richtig. An der veröffentlichten Signatur
     ändert sich dabei nichts: TypeScript schreibt einen Parameter mit
     Vorgabewert ohnehin als `material?: …` in die `.d.ts`.
   - `dispose()`:
     ```ts
     dispose(): void {
       // a mesh without geometry and material cannot be rendered, so it leaves the
       // scene graph before it gives them up, rather than asking the caller to do it first
       this.removeFromParent();

       if (this.#ownsGeometry) {
         this.geometry?.dispose();
       }
       this.geometry = undefined;

       if (this.#ownsMaterial) {
         this.material?.dispose();
       }
       this.material = undefined;
     }
     ```
   - TSDoc an `dispose()`: was freigegeben wird und was nicht, dass das Mesh den
     Szenengraph verlässt, dass `geometry`, `material`, `spritePool` und `texture`
     danach `undefined` antworten und ein zweiter Aufruf nichts tut. Die
     vorhandenen TSDoc-Blöcke an `spritePool`, `createSprite()` und `freeSprite()`
     bleiben, wie sie sind — sie stimmen weiter. `texture` bekommt einen Satz:
     antwortet `undefined`, sobald das Material weg ist; ein Schreibzugriff ist
     dann ein stiller No-op.

3. **`AnimatedSprites.ts`** — `dispose()` ersetzen:
   ```ts
   dispose(): void {
     // a mesh without geometry and material cannot be rendered, so it leaves the
     // scene graph before it gives them up, rather than asking the caller to do it first
     this.removeFromParent();

     this.geometry = undefined;
     this.material = undefined;
   }
   ```
   TSDoc darüber: beide werden dem Konstruktor übergeben und gehören dem
   Aufrufer, diese Klasse entsorgt keines von beiden; `geometry` und `material`
   antworten danach `undefined`; ein zweiter Aufruf tut nichts.

4. **`TexturedSpritesMaterial.ts`** — `dispose()` ersetzen:
   ```ts
   override dispose() {
     // both references are given up while their signals are still live — a write after
     // SignalGroup.delete() would land in a destroyed signal and notify nobody
     this.#colorMap.set(undefined);
     this.#texCoordsNode.set(undefined);

     SignalGroup.delete(this);
     super.dispose();
   }
   ```
   TSDoc an `dispose()` nach Entscheidung 4 oben. TSDoc an den Gettern `colorMap`
   und `texCoordsNode`: antworten `undefined`, sobald das Material entsorgt ist.
   Der `colorMap`-Setter nimmt dem Material kein Eigentum an der Textur — auch das
   gehört in den TSDoc, weil MEM-009 genau diese Erwartung war.

5. **`AnimatedSpritesMaterial.ts`** — `dispose()` ersetzen:
   ```ts
   override dispose(): void {
     // the animsMap texture was handed in and stays the caller's; the reference is cleared
     // here, before super.dispose() tears the signal group down, so the getter answers
     // undefined without a write to an already destroyed signal
     this.#animsMap.set(undefined);
     super.dispose();
   }
   ```
   Der Aufruf `this.#animsMap.destroy()` entfällt: `SignalGroup.delete(this)` in
   der Basisklasse ist nach Abschnitt 5 der Richtlinie der ganze Abbau der
   Signalseite. TSDoc am `animsMap`-Getter: antwortet `undefined` nach
   `dispose()`; die Textur gehört dem Aufrufer und wird nicht entsorgt — der
   vorhandene Setter-TSDoc bleibt, wie er ist, und bekommt denselben Satz.

6. **Tests.** Muster und Assertionen (a) bis (e) stehen in Abschnitt 8 von
   `packages/twopoint5d/docs/resource-lifecycle.md`. Wo eine Assertion in einer
   Klasse kein Subjekt hat, entfällt sie **mit einem Kommentar, der das sagt** —
   nicht stillschweigend.
   - `TexturedSprites.spec.ts`: die fünf vorhandenen Tests bleiben unverändert.
     Neu ein `describe('dispose()')` mit: (a) selbst gebaute Geometry und selbst
     gebautes Material werden je genau einmal entsorgt (`new TexturedSprites(4)`,
     `sandbox.spy` auf beide vor dem `dispose()`); (b) eine hereingereichte
     `TexturedSpritesGeometry` und ein hereingereichtes `TexturedSpritesMaterial`
     werden nicht angefasst — zwei Tests; (b2) wird eine `Texture` als zweites
     Argument übergeben, bleibt sie unangetastet, während das darum gebaute
     Material entsorgt wird; API-028: nach `scene.add(sprites)` ist
     `sprites.parent` nach `dispose()` `null` und `scene.children` leer;
     (c) `geometry` und `material` antworten `undefined` — der vorhandene Test
     »the convenience API answers nothing once the sprites are disposed« deckt
     `spritePool`, `texture`, `createSprite()` und `freeSprite()` schon ab und
     wird um diese beiden Erwartungen ergänzt statt verdoppelt; (d) zweiter
     Aufruf wirft nicht und entsorgt nichts erneut; (e) Signal- und Effect-Zähler
     sind nach `dispose()` wieder auf dem Wert von vor der Konstruktion (die
     Signale stammen aus dem selbst gebauten Material, vertex-objects legt keine an).
   - `AnimatedSprites.spec.ts`, neu: (a) entfällt — diese Klasse baut nichts,
     Kommentar dazu; (b) weder die hereingereichte `AnimatedSpritesGeometry` noch
     das hereingereichte `AnimatedSpritesMaterial` wird entsorgt, und das Material
     ist danach noch benutzbar (`material.colorMap` antwortet weiter mit der
     gesetzten Textur) — das ist der eigentliche Beweis, dass es nicht abgeräumt
     wurde; API-028 wie oben; (c) `geometry` und `material` antworten `undefined`;
     (d) zweiter Aufruf wirft nicht; (e) entfällt mit Kommentar — die Klasse legt
     keine Signale an, und die des hereingereichten Materials abzuräumen ist
     gerade nicht ihre Aufgabe.
   - `TexturedSpritesMaterial.spec.ts`, neu — das ist der Dispose-Anteil von
     TEST-005: (a) entfällt mit Kommentar (das Material baut keine Ressource);
     (b) eine über die Konstruktor-Option und eine über den Setter gesetzte
     `colorMap` wird nicht entsorgt — zwei Tests; (c) `colorMap` und
     `texCoordsNode` antworten `undefined`, die vier Attribut-Node-Getter
     antworten weiter mit ihrem Node; (d) zweiter Aufruf wirft nicht;
     (e) Signal- und Effect-Zähler zurück auf der Ausgangslinie.
   - `AnimatedSpritesMaterial.spec.ts`, drei Eingriffe und sonst nichts:
     »disposes the animsMap texture« kehrt sich um zu »does not dispose an animsMap
     that was handed in« (`animsMapDispose.called` ist `false`); »is safe to call
     twice« erwartet ebenfalls `animsMapDispose.called === false`; »disposes the
     animsMap texture before the underlying NodeMaterial dispose runs« entfällt
     ersatzlos — es prüfte eine Reihenfolge, die es nach dem Wegfall der Freigabe
     nicht mehr gibt, und ein `set()` vor oder nach `SignalGroup.delete()` ist von
     außen nicht zu unterscheiden. Die übrigen zehn Tests der Datei bleiben Zeile
     für Zeile, wie sie sind.

7. **`docs/resource-lifecycle.md`** — drei Stellen, die dieses Paket unwahr macht,
   und keine vierte:
   - Abschnitt 5, der Codeblock unter »and its `dispose()`:« (heute Zeile 130–135)
     zitiert `TexturedSpritesMaterial.dispose()` wörtlich. Neu abschreiben, mit
     den beiden Räum-Zeilen. Der Satz danach — `SignalGroup.delete(this)` ist der
     ganze Abbau der Signalseite — bleibt stehen und stimmt weiter: Räumen ist
     kein Abbau.
   - Abschnitt 6, Zeile 197–198: »[`AnimatedSpritesMaterial.dispose()`](…) is
     ordered this way, for that reason.« Die Klasse gibt nichts mehr frei, belegt
     die Reihenfolge aber weiter — sie räumt ihre `animsMap`-Referenz, bevor
     `super.dispose()` die Signalgruppe abbaut, aus genau demselben Grund. Den
     Satz darauf umschreiben; der generische Codeblock darüber
     (`this.#ownedThing?.dispose(); super.dispose();`) bleibt als allgemeine Regel
     unverändert.
   - Abschnitt 6, Zeile 204–206: »A `Mesh` that **owns** its geometry and material
     takes itself out of the scene graph…«. Nach diesem Paket verlässt auch ein
     Mesh den Szenengraph, das gar nichts besitzt und nur seine Referenzen aufgibt
     — `AnimatedSprites` ist genau dieser Fall, und ohne die Änderung deckt der
     Satz die Ursache von API-028 als erlaubt. Die Bedingung auf »gibt in
     `dispose()` seine Geometry oder sein Material auf« weiten.
   - Ausdrücklich unverändert: Abschnitt 4 zitiert `TexturedSprites#texture`
     (Zeile 90) und `#freeSprite()` (Zeile 98). Beide Signaturen bewegen sich in
     diesem Paket nicht, beide Sätze stimmen weiter. Vor dem Commit einmal
     dagegenhalten, dann liegenlassen.

8. **`CHANGELOG.md`**, `[Unreleased]`, nach dem Skill `updating-changelog`:
   - Unter `### Changed` je ein Eintrag für: `TexturedSprites#dispose()` entsorgt
     nur die selbst gebaute Geometry und das selbst gebaute Material und nimmt das
     Mesh aus dem Szenengraph; `AnimatedSprites#dispose()` entsorgt nichts und
     nimmt das Mesh aus dem Szenengraph; `AnimatedSpritesMaterial#dispose()` fasst
     die `animsMap`-Textur nicht mehr an; `TexturedSpritesMaterial#dispose()`
     räumt `colorMap` und `texCoordsNode`. Ein Verweis auf
     `docs/resource-lifecycle.md` gehört in den ersten dieser Einträge — dieses
     Paket ist das erste des Laufs, das an der Oberfläche etwas ändert, und Paket 1
     hat den Verweis absichtlich hierher gelegt.
   - Ein `####`-Block unter dem vorhandenen `### Migration Guide` in
     `[Unreleased]`: wer Geometry, Material oder Textur selbst gebaut und
     hereingereicht hat, entsorgt sie ab jetzt selbst. Before/After mit echtem
     Code, kopierbar, im Stil der beiden Blöcke, die dort schon stehen. Der Fall,
     der Aufrufern am ehesten unbemerkt entgleitet, ist `new AnimatedSprites(geometry,
     material)` — er verliert seine gesamte Freigabe und braucht die zwei Zeilen
     im After-Block.
   - Die Konventionen des Laufs gelten auch hier: keine Finding-IDs, kein Rückblick
     auf den Vorzustand außerhalb der Before/After-Blöcke, die genau dafür da sind.

9. **Sonst nichts.** Kein `isDisposed`, kein Ownership-Schalter, keine Änderung an
   `TileSpritesMaterial`, an `VertexObjects`, an `packages/twopoint5d-testing/`
   oder am Lookbook. Der Kommentar in
   `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js:102` und der in
   `apps/lookbook/src/pages/demos/textured-sprites.astro:74` beschreiben beide den
   Fall mit eigener Geometry beziehungsweise eigenem Material und stimmen weiter —
   nachsehen, liegenlassen. Was beim Lesen dieser Dateien auffällt und nicht
   hierher gehört, wird als Nebenbefund mit Datei und Zeile gemeldet, nicht behoben.

#### Review-Fokus

- Wird irgendwo eine Ressource freigegeben, die die Instanz nicht gebaut hat, oder
  eine liegengelassen, die sie gebaut hat? Der Konstruktor-Vorgabewert aus
  Schritt 2 ist die Stelle, an der ein Fehler hier lautlos bleibt: das Material
  leckt, und kein Test schlägt an, der es nicht ausdrücklich prüft.
- Stimmen die drei zitierten Stellen in `docs/resource-lifecycle.md` Wort für Wort
  mit dem Code, aus dem sie stammen? Ein Zitat, das im selben Commit falsch wird,
  ist schlimmer als keines.
- Ist jede weggelassene Assertion aus dem Muster von Abschnitt 8 im Test
  kommentiert, oder fehlt sie einfach?
- Waren die fünf Tests aus Schritt 1 vor dem Fix rot? Der Report muss die Ausgabe
  zeigen, nicht behaupten.
- Trägt der Migration Guide den Fall `new AnimatedSprites(geometry, material)`?
  Das ist die Änderung, die einem Aufrufer ohne Compilerfehler durchgeht.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci` — `typecheck` deckt die
  Specs mit ab (`pnpm build` lässt sie aus) und fährt zusätzlich `astro check`
  über den Lookbook, der `TexturedSprites` und `AnimatedSprites` benutzt; das ist
  der Regressionsteil für die Konstruktor-Signatur. `test:browser` bleibt draußen:
  dieses Paket ändert nicht, was `dispose()` mit GPU-Puffern tut, sondern nur, wer
  es aufruft, und das ist mit Spies im Vitest vollständig sichtbar. In Zug 0 gegen
  den heutigen Stand erprobt, Exit 0 in 10 s (Nx-Cache; nach der Änderung laufen
  die Tests wirklich).
- Commit: `fix(sprites): dispose only owned resources and remove sprites from the scene graph`
  (»leave the scene graph« stand im selben Wortfeld, das dieses Paket sonst für
  »nicht anfassen« benutzt; der Wortlaut oben ist der committete)
- Ergebnis: 3 Runden · MEM-009, MEM-010, API-028 und der Dispose-Anteil von
  TEST-005 behoben · `TexturedSprites` entsorgt nur selbst gebaute Geometry und
  selbst gebautes Material und verlässt in `dispose()` den Szenengraph,
  `AnimatedSprites` entsorgt nichts und verlässt ihn ebenso,
  `AnimatedSpritesMaterial` fasst die hereingereichte `animsMap` nicht mehr an,
  `TexturedSpritesMaterial` räumt `colorMap` und `texCoordsNode` ·
  Regressionstests: `does NOT dispose a geometry that was handed in`,
  `does NOT dispose a material that was handed in`, `takes the mesh out of the
  scene graph` (zweimal), `does NOT dispose an animsMap that was handed in`,
  `behaves as documented after dispose()` — acht rote Tests vor dem Fix,
  danach 33/33 grün · neue Specs `AnimatedSprites.spec.ts` und
  `TexturedSpritesMaterial.spec.ts` · Runde 1 schloss drei wichtige Befunde
  (zwei `[Unreleased]`-Absätze im CHANGELOG versprachen die alte
  bedingungslose Freigabe weiter, die Richtlinie schrieb ein Idempotenz-Flag
  als Mechanismus vor und führte damit die vier neuen Methoden als Bug),
  Runde 2 einen (der TSDoc-Satz an `touchAnimsMap()` behauptete einen No-op,
  wo ein Effect läuft) · klein und stehengelassen: `TexturedSpritesMaterial.ts`,
  die beiden `set(undefined)` in `dispose()` laufen ohne `batch()` und lösen
  je einen Effect-Durchgang aus, den das Ergebnis nicht braucht
- Nebenbefunde: → Queue (1)
- Folgen: `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:94-96`
  — der TSDoc-Satz an `touchAnimsMap()` beziffert die Kosten mit »shader
  recompile«; nachgemessen hebt der Aufruf nur die Materialversion, three.js
  löst Programm und Pipeline daraufhin aus seinen Caches neu auf und kompiliert
  nichts. Der Satz steht in der veröffentlichten `.d.ts`; die Handlungsanweisung
  darin bleibt richtig, die Kostenangabe ist zu stark ·
  `packages/twopoint5d/docs/resource-lifecycle.md:70-77` — der Absatz zählt die
  vier Schritte auf, die beim zweiten `dispose()` von sich aus leerlaufen.
  Bringt ein `dispose()` aus den Paketen 3 bis 7 einen weiteren Mechanismus mit,
  gehört er in die Aufzählung, sonst bleibt der Absatz hinter der Praxis zurück ·
  `packages/twopoint5d/CHANGELOG.md:51` — der Verweis auf die Richtlinie ist
  absolut auf `main` verdrahtet, weil `scripts/publishNpmPkg.mjs` kein `docs/`
  in den Tarball kopiert. Zieht ein späteres Paket die Datei um, bricht die URL
  still; der Link-Check aus dem Verify von Paket 1 prüft nur relative Ziele ·
  2026-09-05, Zug 0 von Paket 7: die dritte erledigt, ohne Änderung — kein Paket
  hat `docs/resource-lifecycle.md` umgezogen, die URL trägt. Die erste ist mit
  Paket 8 geschlossen. Die zweite trifft zu und wird Schritt 10 von Paket 7:
  `Map2DTileRenderer#dispose()` aus Paket 6 bringt eine dritte Bauform mit, die
  Abschnitt 3 nicht aufzählt
- Schnittstellen: `new TexturedSprites(geometry?, material?)` — der Vorgabewert
  am zweiten Parameter ist entfallen, die veröffentlichte Signatur bleibt
  gleich (`material?: …`), aber ein weggelassenes Argument zählt jetzt als
  selbst gebaut · `TexturedSprites#dispose()` entsorgt nur selbst Gebautes und
  ruft `removeFromParent()` · `AnimatedSprites#dispose()` entsorgt nichts und
  ruft `removeFromParent()` · `AnimatedSpritesMaterial#dispose()` entsorgt die
  `animsMap` nicht mehr, `#animsMap` antwortet danach `undefined` ·
  `TexturedSpritesMaterial#dispose()` setzt `colorMap` und `texCoordsNode` auf
  `undefined`; die Node-Accessoren behalten ihren letzten Node ·
  `packages/twopoint5d/docs/resource-lifecycle.md` §3 kennt neben dem
  Idempotenz-Flag die flaglose Bauform: zulässig, wenn jeder Schritt beim
  zweiten Aufruf von sich aus leerläuft, nachzuweisen über Assertion (d)

**MEM-009 · medium · packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:85-87** — `AnimatedSpritesMaterial.dispose()` zerstört eine Textur, die ihm nur geliehen war

`dispose()` ruft `this.#animsMap.value?.dispose()` — auch dann, wenn die Textur
über die Konstruktor-Optionen oder den `animsMap`-Setter hereingereicht wurde.
Eine zwischen mehreren Materialien geteilte `animsMap` ist nach dem `dispose()`
eines einzigen von ihnen tot. Wer eine Ressource nicht erzeugt hat, gibt sie
nicht frei. Fasst ein Finding des Vorlaufs mit zusammen, das dieselbe Zeile
beschrieb; dessen Zusatz bleibt gültig: die ebenfalls hereingegebene `colorMap`
wird _nicht_ disposed, die Ownership-Regel ist also auch innerhalb der Klasse
uneinheitlich.

Empfehlung: Die Ownership beim Setzen festhalten und beim Entsorgen nur
freigeben, was das Material selbst gebaut hat — dieselbe Unterscheidung, die für
Pools über `declareOwnedPool()` bereits getroffen ist.

**MEM-010 · medium · packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:63-68** — `TexturedSprites.dispose()` gibt auch hereingereichte Geometry und Material frei

Dieselbe Ownership-Lücke eine Ebene über MEM-009: `dispose()` entsorgt Geometry
und Material unabhängig davon, ob der Konstruktor sie fertig übergeben bekam. Wer
zwei Meshes auf derselben Geometry baut, verliert sie beim ersten `dispose()`.

Empfehlung: Im Konstruktor festhalten, was selbst erzeugt wurde, und nur das
entsorgen. Gemeinsam mit MEM-009 angehen — es ist eine Entscheidung, nicht zwei.

**API-028 · low · packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:53-58, AnimatedSprites/AnimatedSprites.ts:17-22** — `Sprites.dispose()` nullt geometry/material, während das Mesh noch in der Szene hängen kann

`dispose()` setzt `geometry` und `material` auf `undefined`. Hängt das Mesh noch
im Szenengraph, crasht der nächste Render-Frame von three.js mit einem
generischen Fehler tief im Renderer statt einer verständlichen Meldung. Nirgends
dokumentiert, dass `removeFromParent()` vorher Pflicht ist.

Empfehlung: Entweder in `dispose()` zusätzlich `this.removeFromParent()` aufrufen
oder die Reihenfolge im TSDoc festschreiben.

**TEST-005 · high · packages/twopoint5d/src/sprites/** — `sprites/` hat einen Spec auf elf Quelldateien

Ursprünglich null; inzwischen existiert `AnimatedSpritesMaterial.spec.ts` aus
einem früheren Dispose-Fix. Die restlichen zehn Dateien — das eigentliche Herz
der Bibliothek — sind weiterhin ohne Testabdeckung.

Empfehlung: `BaseSprite`: Instanziierung, Position, Scale und Rotation, die
`make()`-Pfade. `TexturedSprite`: Frame-Auswahl, `setColor*`, Atlas-Binding.
`AnimatedSprite`: Frame-Timing, Play- und Pause-Zustände.
`TexturedSpritesMaterial`: Dispose-Verhalten analog zum früheren Fix.

Dieses Paket nimmt ausschließlich den letzten Satz. Der Rest — `BaseSprite`,
`TexturedSprite`, `AnimatedSprite` — bleibt offen; das Finding schließt dieser
Lauf nicht.

### [x] 3. Display und FrameLoop: Zustand nach dispose()

- Findings: BUG-001 (medium), MEM-001 (low)
- Ziel: `Display` ist nach `dispose()` erkennbar unbenutzbar — jedes öffentliche
  Member verhält sich nach der Typregel aus Abschnitt 4 der Richtlinie, der
  Vertrag steht im Klassen-TSDoc, und keine offene Zusage überlebt das
  `dispose()`. Dazu: der modul-globale RAF-Zustand des `FrameLoop` lässt sich für
  Tests zurücksetzen.
- Bereich: `packages/twopoint5d/src/display/`, dazu
  `packages/twopoint5d-testing/test/` sowie `docs/resource-lifecycle.md` und
  `CHANGELOG.md` des Kernpakets
- Aus der Queue zugeschlagen (2026-09-05, Zug 0 von Paket 2):
  `packages/twopoint5d/src/display/Display.ts:685` — `dispose()` hat keinen
  Idempotenz-Guard, ein zweiter Aufruf feuert `OnDisplayDispose` erneut und ruft
  `this.renderer?.dispose()` auf einem bereits abgeräumten Renderer. Dieselbe
  Methode und derselbe Vertrag wie BUG-001, deshalb kein eigenes Paket.
  **Zug 0 von Paket 3 hat die zweite Hälfte der Behauptung widerlegt** — siehe
  die Abgleichtabelle unten; der Guard kommt trotzdem, aus dem Grund, der dort
  steht.
- Hängt ab von: 1
- Hash: d11e279
- Modell: stärkste Stufe
- Effort: high
- Dateien: sechs, keine siebte.
  1. `packages/twopoint5d/src/display/Display.ts` — Flag, Getter, drei Wurf-Stellen, zwei No-op-Guards, `nextFrame()`, TSDoc
  2. `packages/twopoint5d/src/display/FrameLoop.ts` — `resetRAF()` und die eine Zeile, die das möglich macht
  3. `packages/twopoint5d/src/display/FrameLoop.spec.ts` — erweitert um `describe('resetRAF()')`
  4. `packages/twopoint5d-testing/test/display-dispose.test.js` — neu
  5. `packages/twopoint5d/docs/resource-lifecycle.md` — zwei Stellen
  6. `packages/twopoint5d/CHANGELOG.md` — `### Added`, `### Changed`, `### Fixed`, ein `####`-Block unter `### Migration Guide`

  Keine Änderung an `display/public-api.ts`: `export * from './Display.js'` und
  `export * from './FrameLoop.js'` stehen dort bereits, ein neuer Getter und eine
  neue statische Methode kommen darüber automatisch mit. Wer dort etwas
  hinzufügt, hat die Datei nicht gelesen.

#### Abgleich am Code, Zug 0 (2026-09-05)

| Finding | Fundstelle heute | Urteil |
| --- | --- | --- |
| BUG-001 | Audit nennt `Display.ts:270-272, 674-681`. Heute: der `canvas`-Getter steht auf `281-283` und dereferenziert unverändert `this.renderer!.domElement`, `dispose()` auf `685-692` mit `delete this.renderer` in Zeile 691 | unverändert, um elf Zeilen verschoben |
| MEM-001 | Audit nennt `FrameLoop.ts:13-14`. Heute `14-15`: `const rafUniqueInstances: WeakMap<object, RAF>` und `let rafUniqueInstance: RAF \| null` | unverändert, um eine Zeile verschoben |
| Queue-Eintrag `Display.ts:685` | erste Hälfte trifft zu: `emit(this, OnDisplayDispose, this)` läuft beim zweiten Aufruf erneut. Zweite Hälfte trifft **nicht** zu: `delete this.renderer` in Zeile 691 lässt `this.renderer?.dispose()` in Zeile 690 beim zweiten Aufruf ins Leere greifen, der Renderer wird kein zweites Mal entsorgt | teilweise gegenstandslos, siehe Entscheidung 1 |

Nachgesehen und ohne Befund geblieben, damit es niemand ein zweites Mal
nachsieht:

- Der Phantom-Emit erreicht heute in der Regel niemanden: `off(this)` in Zeile
  689 räumt jeden Listener ab, bevor der zweite Aufruf emittiert. Er erreicht
  genau die, die sich **zwischen** den beiden `dispose()`-Aufrufen angemeldet
  haben — etwa über `display.onDispose(…)` oder einen danach gebauten
  `FixedFrameLoop`, der sich in seinem Konstruktor mit
  `once(display, OnDisplayDispose, …)` einhängt.
- `off(this)` löscht auch die zurückgehaltenen Werte: nachgemessen mit
  `@spearwolf/eventize@6.2.0` bekommt ein nach `off(this)` angemeldeter Listener
  für ein `retain`-Event **nichts** mehr, auch nicht den letzten Wert. Der Satz
  im TSDoc darf das also behaupten.
- `three@0.185.1` beendet in `Renderer.dispose()` als letzte Handlung
  `this.setAnimationLoop(null)`. Ein RAF-Treiber, der an einem Renderer hängt,
  hört also mit dessen `dispose()` von selbst auf zu ticken. Nur der
  renderer-lose Treiber tut das nie — das ist der Kern von MEM-001 und der
  Grund, warum `resetRAF()` genau ihn anfassen muss.

#### Sieben Entscheidungen dieses Zuges

Getroffen mit dem Code vor Augen, deshalb hier und nicht unter »Entscheidungen« im Kopf.

1. **Der Idempotenz-Guard kommt, obwohl der zweite Aufruf heute fast harmlos
   ist.** Drei Gründe, und der erste allein trägt: dieses Paket hängt neue Arbeit
   in `dispose()` ein (das Abweisen offener `nextFrame()`-Zusagen, Entscheidung
   5), und die darf kein zweites Mal laufen. Dazu nennt Abschnitt 3 der
   Richtlinie das Flag als Vorgabeform und als sichere Antwort, sobald ein
   Schritt beim zweiten Mal echte Arbeit täte. Und drittens macht das Flag die
   Idempotenz beweisbar statt argumentierbar — Assertion (d) prüft sie dann an
   einer Zusicherung und nicht an einer Kette von Zufällen.
2. **`isDisposed` wird veröffentlicht.** Abschnitt 3 stellt den Getter dorthin,
   »wo Aufrufer verzweigen müssen«. Ab diesem Paket müssen sie: `canvas` wirft,
   und wer eine `Display`-Referenz aus fremder Hand bekommt, hat sonst keine
   Frage, die er stellen könnte, außer `renderer == null` — und das ist ein
   Implementierungsdetail, kein Vertrag. `FixedFrameLoop` im selben Verzeichnis
   zeigt den Getter bereits; zwei Lebenszyklus-Klassen einer Schicht, die
   dieselbe Frage verschieden beantworten, sind eine Falle.
3. **`canvas`, `start()` und `getEventProps()` werfen; `resize()`,
   `renderFrame()`, `stop()` und `dispose()` sind stille No-ops.** Das ist die
   Typregel aus Abschnitt 4, Member für Member angewendet, und nicht mehr:
   `canvas: HTMLCanvasElement` und `getEventProps(): DisplayEventProps` mit
   `renderer: WebGPURenderer` behaupten Anwesenheit, also wird nicht gelogen,
   sondern geworfen. Bei `start()` ist die Regel weniger eindeutig — der
   Rückgabetyp `Promise<Display>` lässt sich mit `this` immer erfüllen. Es wirft
   trotzdem, aus dem Grund, den Abschnitt 4 seiner Regel 2 selbst mitgibt: der
   Stack soll auf den wirklichen Fehler zeigen. Ein `await display.start()`, das
   brav auflöst und nie einen Frame liefert, ist genau die stumme Sackgasse, die
   der Abschnitt verhindern will, und anders als bei `freeSprite()` hängt der
   Aufrufer an der Wirkung. `resize()` und `renderFrame()` dagegen sind
   verändernde Methoden ohne verbleibendes Ziel — Regel 3, wortwörtlich.
4. **Ein Satz an der Klasse statt zwanzig an zwanzig Membern.** Punkt 6 der
   Checkliste verlangt das Verhalten nach `dispose()` im TSDoc jedes öffentlichen
   Members. `Display` hat über zwanzig, die meisten davon Zahlenwerte, die
   einfach ihren letzten Stand behalten. Der maßgebliche Ort ist deshalb der
   Lebenszyklus-Abschnitt im Klassen-TSDoc, der ohnehin schon drei Schritte
   aufzählt und einen vierten bekommt; einen eigenen Satz bekommen nur die fünf
   Member, deren Verhalten überrascht (`canvas`, `start()`, `getEventProps()`,
   `nextFrame()`, `onDispose()`) plus der neue `isDisposed`. Dieselbe Abwägung
   hat Paket 2 in seiner Entscheidung 4 für die Node-Getter getroffen; sie hier
   umzudrehen hieße, in einer Bibliothek zwei Konventionen zu führen.
5. **`nextFrame()` wird beim `dispose()` abgewiesen.** Abschnitt 4 lässt keinen
   Spielraum: »A pending promise is not allowed to survive either … is rejected
   as part of `dispose()`, not left hanging.« Heute hängt sie: `onceAsync()`
   wartet auf `OnDisplayRenderFrame`, `off(this)` nimmt den Listener weg, ohne
   die Zusage aufzulösen, und der Aufrufer wartet bis zum Ende des Tabs. Das ist
   ein vorbestehender Befund und gehört nach der Regel für Nebenbefunde in die
   Queue — er wandert trotzdem in dieses Paket, weil er dieselbe Ursache hat: den
   ungeschriebenen Vertrag von `Display.dispose()`. Ihn zu vertagen hieße,
   dieselbe Methode ein zweites Mal aufzumachen, und genau davor warnt die
   Symptom-Regel.
6. **`FrameLoop.resetRAF()` statt eines Umbaus der RAF-Lebenszeit.** MEM-001
   fragt nach einem statischen `RAF.dispose()`; `RAF` ist nicht exportiert, also
   wird es eine statische Methode an `FrameLoop`, das über
   `export * from './FrameLoop.js'` bereits öffentlich ist. Der Name ist nicht
   `dispose`: `dispose()` heißt in dieser Bibliothek »eine Instanz gibt ihre
   Ressourcen auf«, und hier wird Modulzustand zurückgesetzt. »RAF« ist im
   öffentlichen Wortschatz des Moduls bereits gesetzt (`OnRAF`).
   Nicht Teil dieses Pakets ist die naheliegende Nachbarfrage — soll ein Treiber
   von selbst anhalten, sobald sein letzter `FrameLoop` sich abmeldet? Das ist
   ein eigener Entwurf (mehrere `FrameLoop`s teilen sich einen Treiber, es
   bräuchte eine Zählung auf dem Treiber selbst), es berührt die Schleife, an der
   jedes gerenderte Bild hängt, und MEM-001 selbst sagt »kein akuter Leak«. Als
   Nebenbefund in der Queue, mit Urteil — die Drain-Runde entscheidet, nicht
   dieses Paket.
7. **Der `Display`-Test ist ein Browser-Test, kein Vitest-Spec, und das ist keine
   Bequemlichkeit.** `packages/twopoint5d/vite.config.ts` setzt keine
   `environment`, Vitest läuft also unter `node`: kein `document`, kein `window`,
   kein `requestAnimationFrame`. `new Display(...)` ist dort nicht konstruierbar,
   und ein Spec, der das mit Stubs erzwingt, prüfte die Stubs. Der Vertrag nach
   `dispose()` wird deshalb in `packages/twopoint5d-testing/` belegt, wo bereits
   acht Dateien einen echten `Display` gegen einen echten Renderer fahren.
   `FrameLoop.resetRAF()` dagegen braucht kein DOM und bekommt seinen Spec dort,
   wo der Rest des `FrameLoop` schon geprüft wird.

#### Vorgehen

Reihenfolge einhalten: erst die roten Tests (Schritt 1), dann der Code
(Schritte 2 bis 4), dann Doku und CHANGELOG (Schritte 5 und 6).

1. **Regressionstests zuerst, rot sehen, Ausgabe in den Report.** Acht Tests
   fallen gegen den heutigen Code durch. Sieben davon in der neuen Datei
   `packages/twopoint5d-testing/test/display-dispose.test.js`, einer in
   `FrameLoop.spec.ts`:
   - `canvas` wirft nach `dispose()` einen Fehler, dessen Meldung `Display`,
     das Member und den Zustand nennt (heute: `TypeError: Cannot read properties
     of undefined (reading 'domElement')` — die Meldung nennt nichts davon).
   - `start()` wirft nach `dispose()` (heute: löst auf und startet die
     Zustandsmaschine wieder).
   - `getEventProps()` wirft nach `dispose()` (heute: liefert ein Objekt, dessen
     `renderer` `undefined` ist, obwohl der Typ einen `WebGPURenderer` zusagt).
   - `resize()` und `renderFrame()` werfen nach `dispose()` nicht (heute wirft
     `resize()`, weil es in Zeile 505 über `this.canvas` geht).
   - `isDisposed` ist vor `dispose()` `false` und danach `true` (heute existiert
     das Member nicht).
   - ein zweiter `dispose()`-Aufruf feuert `OnDisplayDispose` nicht erneut:
     nach dem ersten Aufruf einen Listener anmelden, ein zweites Mal entsorgen,
     und der Listener bleibt ungerufen (heute wird er gerufen).
   - eine beim `dispose()` offene `nextFrame()`-Zusage wird abgewiesen (heute
     bleibt sie für immer offen).
   - `FrameLoop.resetRAF()` gibt demselben Renderer einen frischen Treiber
     (heute: `FrameLoop.resetRAF` ist keine Funktion).
   Kommandos für den roten Lauf:
   `cd packages/twopoint5d && pnpm vitest --run src/display/FrameLoop.spec.ts`
   und `pnpm build:twopoint5d && cd packages/twopoint5d-testing && pnpm web-test-runner test/display-dispose.test.js`.
   Der zweite ist in Zug 0 gegen `test/display-resize.test.js` erprobt, Exit 0 —
   eine einzelne Datei als Positionsargument überschreibt das `files`-Glob der
   Konfiguration. Der `build`-Schritt davor ist Pflicht: `nodeResolve` löst
   `@spearwolf/twopoint5d` über `exports` nach `dist/lib/index.js` auf, der
   Browser-Test sieht also den gebauten Stand und nicht die Quelle.
   Der rote Lauf gehört im Wortlaut in den Report.

2. **`Display.ts`** — der Vertrag.
   - Eine Modulfunktion neben `showCanvasMaxResolutionWarning()`, damit alle drei
     Wurf-Stellen dieselbe Meldung tragen und Abschnitt 4 Regel 2 (»an `Error`
     that names the class and the state«) an einer Stelle erfüllt wird:
     ```ts
     function disposedError(member: string): Error {
       return new Error(`Display#${member} is not available: this display has been disposed`);
     }
     ```
   - Ein privates Feld `#disposed = false;` bei den übrigen `#`-Feldern, und der
     Getter dazu:
     ```ts
     get isDisposed(): boolean {
       return this.#disposed;
     }
     ```
   - Der `canvas`-Getter prüft den Renderer, nicht das Flag — damit verengt
     TypeScript den Typ und die Non-Null-Assertion fällt weg:
     ```ts
     get canvas(): HTMLCanvasElement {
       if (this.renderer == null) {
         throw disposedError('canvas');
       }
       return this.renderer.domElement;
     }
     ```
   - `getEventProps()` bekommt denselben Guard an den Anfang und gibt danach
     `renderer: this.renderer` ohne `!` heraus.
   - `start()` prüft **zweimal**: einmal am Anfang, damit der offensichtliche
     Fehlgebrauch sofort auffliegt, und einmal direkt nach
     `await this.#waitForRenderer`, weil ein `dispose()` in genau dieses Warten
     fallen kann und die Zustandsmaschine danach ein totes Display als laufend
     führen würde:
     ```ts
     async start(beforeStartCallback?: (args: DisplayEventProps) => Promise<void> | void): Promise<Display> {
       if (this.#disposed) throw disposedError('start()');

       await this.#waitForRenderer;

       // dispose() can land inside the await above; without this the state machine
       // would report a display as running that has already given up its renderer
       if (this.#disposed) throw disposedError('start()');
     ```
     Der Rest der Methode — `beforeStartCallback`, `pausedByUser = false`,
     `#stateMachine.start()`, `return this` — bleibt unverändert stehen.

     **Auslegung durch Zug 4, Runde 2 (2026-09-05):** aus »prüft zweimal« wird
     »prüft an jedem Aufhängepunkt«. `await beforeStartCallback(…)` ist ein
     dritter, den diese Aufzählung übersieht: fremder Code, in den ein
     `dispose()` genauso fallen kann, und danach laufen
     `pausedByUser = false` und `#stateMachine.start()` ungebremst durch. Der
     Grund, den der Detailplan seinem zweiten Guard selbst mitgibt — »die
     Zustandsmaschine würde danach ein totes Display als laufend führen« —
     trifft dort wörtlich zu. Das ist keine Abweichung vom freigegebenen Weg,
     sondern derselbe Weg an einer Stelle, die beim Zählen durchgerutscht ist;
     ohne den dritten Guard schreibt dieses Paket einen Vertragssatz auf, den
     es selbst nicht hält.
   - `resize()` und `renderFrame()` bekommen je `if (this.#disposed) return;` als
     erste Zeile — bei `resize()` **vor** `this.#didEmitResize = false;`.
   - `dispose()`:
     ```ts
     dispose(): void {
       if (this.#disposed) return;
       this.#disposed = true;

       this.stop();
       this.frameLoop.stop(this);
       // the listeners are still attached here: this event is what tells them to let go,
       // and off(this) below is what makes it the last event this display ever emits
       emit(this, OnDisplayDispose, this);
       off(this);
       this.renderer?.dispose();
       delete this.renderer;
     }
     ```
     Die Zeilen unterhalb des Guards bleiben Wort für Wort, wie sie sind. Wer
     `delete this.renderer` bei der Gelegenheit zu `this.renderer = undefined`
     umschreibt, ändert etwas, das dieses Paket nicht auf dem Zettel hat.
   - `nextFrame()` löst sich vom `onceAsync()` und wird selbst gebaut, damit die
     Zusage ein Ende hat:
     ```ts
     readonly nextFrame = (): Promise<DisplayEventProps> =>
       new Promise<DisplayEventProps>((resolve, reject) => {
         if (this.#disposed) {
           reject(disposedError('nextFrame()'));
           return;
         }
         // dispose() emits before it drops its listeners, so this is the last moment
         // at which a caller waiting for a frame that will never come can be told
         const unsubscribeDispose = once(this, OnDisplayDispose, () => {
           reject(disposedError('nextFrame()'));
         });
         once(this, OnDisplayRenderFrame, (props: DisplayEventProps) => {
           unsubscribeDispose();
           resolve(props);
         });
       });
     ```
     Der zweite `once()`-Listener nimmt sich beim Feuern selbst heraus, der erste
     wird dabei von Hand abgemeldet — sonst sammelt jede `nextFrame()`-Zusage
     einen `OnDisplayDispose`-Listener an, der bis zum `dispose()` liegen bleibt.
     `onceAsync` hat danach keinen Aufrufer mehr und fliegt aus dem Import in
     Zeile 8; `pnpm lint` sagt es, falls nicht.
   - TSDoc, nach Entscheidung 4: der Lebenszyklus-Block im Klassen-TSDoc (heute
     Zeilen 52–63, drei nummerierte Schritte) bekommt einen vierten, der den
     ganzen Vertrag trägt — `renderer` antwortet `undefined` und `isDisposed`
     `true`; `canvas`, `start()` und `getEventProps()` werfen; `resize()`,
     `renderFrame()`, `stop()` und ein zweites `dispose()` tun nichts;
     `nextFrame()` wird abgewiesen, eine offene Zusage ebenso; `width`, `height`,
     `frameNo`, `now`, `deltaTime`, `pixelRatio` und die beiden Backend-Flags
     behalten ihren letzten Wert, `isRunning` ist `false`; es folgt kein Event
     mehr, und wer sich danach anmeldet, bekommt nichts, auch keinen
     zurückgehaltenen Wert. Dazu je ein Satz an `canvas`, `start()`,
     `getEventProps()`, `nextFrame()`, `isDisposed` und `onDispose` — bei
     `onDispose`: ein danach angemeldeter Listener wird nie gerufen.

3. **`FrameLoop.ts`** — der Reset.
   - Zeile 14 wird von `const` auf `let`: `let rafUniqueInstances: WeakMap<object, RAF> = new WeakMap();`.
     Eine `WeakMap` lässt sich nicht leeren, nur ersetzen; das ist der ganze
     Grund für die Änderung und gehört als halber Satz in den TSDoc unten.
   - Die statische Methode, neben `static OnFrame`:
     ```ts
     static resetRAF(): void {
       rafUniqueInstance?.stop();
       rafUniqueInstance = null;
       rafUniqueInstances = new WeakMap();
     }
     ```
   - TSDoc darüber, und es muss vier Dinge sagen, weil jedes davon sonst jemanden
     kostet: wofür es da ist (eine Testdatei, die mehrere Loops in einem Worker
     baut, bekommt je Fall einen frischen Framezähler und eine frische
     FPS-Messung statt der Erbschaft des vorigen); dass ein noch laufender
     `FrameLoop` auf seinen alten Treiber zeigt und nach dem Reset keine Frames
     mehr bekommt, es also in einen Teardown-Hook gehört und nicht neben ein
     lebendes Display; dass die renderer-gebundenen Treiber von hier aus nicht
     angehalten werden können — eine `WeakMap` ist nicht begehbar — und es auch
     nicht müssen, weil `Renderer.dispose()` von three.js als letzte Handlung
     `setAnimationLoop(null)` ruft; und dass der Aufruf in jeder Umgebung sicher
     ist, auch ohne `requestAnimationFrame`, weil ohne dieses nie ein
     renderer-loser Treiber entstanden sein kann.

4. **Tests.** Muster und Assertionen (a) bis (e) stehen in Abschnitt 8 von
   `packages/twopoint5d/docs/resource-lifecycle.md`. Wo eine Assertion in einer
   Klasse kein Subjekt hat, entfällt sie **mit einem Kommentar, der das sagt** —
   nicht stillschweigend.
   - `FrameLoop.spec.ts`, neu ein `describe('resetRAF()')` mit `afterEach(() => FrameLoop.resetRAF())`,
     damit der Modulzustand keinen Fall in den nächsten trägt. Die dreizehn
     vorhandenen Tests bleiben Zeile für Zeile, wie sie sind. Drei Fälle:
     1. Derselbe Renderer bekommt vor dem Reset denselben Treiber und danach
        einen frischen. Beobachtbar am `makeFakeRenderer()`-Stub, der bereits in
        der Datei steht: `renderer.callback` ist nach dem zweiten
        `new FrameLoop(0, renderer)` dieselbe Funktion wie nach dem ersten, nach
        `FrameLoop.resetRAF()` und einem dritten Loop eine andere. Der Treiber
        wird im `RAF`-Konstruktor installiert, ein `loop.start(target)` braucht
        es dafür nicht.
     2. Der renderer-lose Treiber wird angehalten: `requestAnimationFrame` und
        `cancelAnimationFrame` mit `vi.stubGlobal()` belegen (`vi.unstubAllGlobals()`
        im `afterEach`), `new FrameLoop(0)` bauen, `FrameLoop.resetRAF()` rufen,
        und `cancelAnimationFrame` ist mit der ID gerufen worden, die
        `requestAnimationFrame` zurückgegeben hat. Danach baut ein weiterer
        `new FrameLoop(0)` einen neuen Treiber, `requestAnimationFrame` also
        zweimal gerufen. Abschnitt 8 der Richtlinie reserviert `vi`-Werkzeug für
        Globale — genau dieser Fall; `vi.stubGlobal` statt `vi.spyOn`, weil die
        beiden Globalen unter `node` gar nicht existieren.
     3. `FrameLoop.resetRAF()` wirft nichts, wenn nie ein renderer-loser Treiber
        entstanden ist — ohne jeden Stub, also unter blankem `node`. Das ist der
        Fall, der die Methode überhaupt erst in einer Testsuite brauchbar macht.
     Falls `pnpm lint` an einem `new FrameLoop(…)` als bloßer Anweisung hängt,
     wird der Ausdruck an eine Assertion gebunden statt der Regel eine Ausnahme
     zu geben.
   - `packages/twopoint5d-testing/test/display-dispose.test.js`, neu. Aufbau nach
     `display-resize.test.js`: `@esm-bundle/chai`, `makeContainer()`-Fixture im
     `document.body`, Aufräumen im `afterEach`. **Das eigene Teardown entsorgt
     nur** — die `disposeDisplay()`-Helfer der Nachbardateien rufen vorher
     `display.start()`, und das wirft in diesem Paket auf einem entsorgten
     Display; hier wird ohnehin in jedem Fall im Testkörper entsorgt.
     Die meisten Fälle brauchen kein `start()`: ohne es kommt kein Frame, und
     genau das macht Fall (g) überhaupt erst prüfbar.
     - (a) entfällt mit Kommentar: `Display` baut zwar seinen Renderer selbst,
       aber `renderer.dispose()` auszuspionieren heißt, three.js beim Aufräumen
       zuzusehen — der Beweis dafür sind die Backend-Ressourcen, und die sieht
       dieser Test nicht. Was hier zählt, ist der Vertrag danach.
     - (b) entfällt mit Kommentar: ein von außen gereichter `WebGPURenderer` ist
       der zweite Konstruktorpfad, aber sein Eigentum ist nicht Gegenstand dieses
       Pakets und wird von keinem Finding berührt.
     - (c) — der Schwerpunkt, in mehreren Fällen: `canvas` wirft mit einer
       Meldung, die `Display`, das Member und den entsorgten Zustand nennt;
       `start()` wirft; `getEventProps()` wirft; `resize()` und `renderFrame()`
       werfen nicht; `renderer` ist `undefined`, `isDisposed` ist `true`,
       `isRunning` ist `false`; `width`, `height` und `frameNo` tragen noch den
       Wert von vor dem `dispose()`.
     - (d) zweiter Aufruf wirft nicht — und feuert `OnDisplayDispose` nicht
       erneut: nach dem ersten `dispose()` einen Listener anmelden, ein zweites
       Mal entsorgen, Listener bleibt ungerufen.
     - (e) entfällt mit Kommentar: `Display` legt keine Signale und keine Effects
       an; seine Ereignisse laufen über eventize, und deren Abbau ist mit (d)
       und dem Listener-Fall belegt.
     - (f) `nextFrame()` nach `dispose()` wird abgewiesen.
     - (g) eine beim `dispose()` **offene** `nextFrame()`-Zusage wird abgewiesen.
       Der Fall wird mit einer Frist geprüft und nicht mit einem blanken `await`:
       die Zusage annehmen, sofort beide Ausgänge in einen Zustand schreiben,
       `dispose()` rufen, rund 100 ms warten und den Zustand prüfen. So ist der
       rote Lauf ein Fehlschlag mit Aussage (»pending«) statt eines Timeouts der
       ganzen Datei, und die Zusage hat von Anfang an einen Ablehnungs-Handler,
       läuft also nicht als unbehandelte Rejection durch die Suite.

5. **`docs/resource-lifecycle.md`** — zwei Stellen, die dieses Paket berührt,
   und keine dritte:
   - Abschnitt 5, der Codeblock ab »[`Display.dispose()`](…):« (heute Zeilen
     159–168) zitiert die Methode wörtlich. Neu abschreiben, mit Guard und Flag.
     Der Satz davor — eine Klasse, an der andere hängen, feuert ihr
     Dispose-Event, **bevor** sie ihre Listener abräumt — bleibt stehen und
     stimmt weiter; das Zitat belegt ihn nach der Änderung genauso.
   - Abschnitt 4, Regel 2 (heute Zeilen 103–106) hat als einzige der drei Regeln
     kein Beispiel. Paket 1 hat `Display#canvas` dafür ausdrücklich gesperrt,
     weil dieses Paket die Stelle erst herstellen musste; ab jetzt ist sie die
     Referenz. Ein Satz mit Link auf `../src/display/Display.ts`, im Stil der
     Sätze zu Regel 1 und Regel 3.
   - Ausdrücklich unverändert: Abschnitt 3, Zeilen 70–78. Die Aufzählung der
     Schritte, die beim zweiten `dispose()` von sich aus leerlaufen, ist die
     Alternative zum Flag — dieses Paket nimmt das Flag, die dort genannte
     Vorgabeform, und bringt keinen neuen Mechanismus mit. Damit ist die
     stehende Prüfung aus den Folgen von Paket 2 für Paket 3 erledigt.
     Ebenfalls unverändert: der Promise-Absatz in Abschnitt 4. Er nennt »a
     texture request, a load«; sein benanntes Beispiel holt Paket 4 mit
     `TextureStore.get()`.

6. **`CHANGELOG.md`**, `[Unreleased]`, nach dem Skill `updating-changelog`:
   - `### Added`: `Display#isDisposed`; `FrameLoop.resetRAF()` mit einem
     Halbsatz, wofür man es braucht.
   - `### Changed`: der Vertrag nach `Display#dispose()` in einem Eintrag —
     welches Member wirft, welches nichts tut, welches seinen letzten Wert
     behält, und dass ein zweiter Aufruf nichts mehr tut.
   - `### Fixed`: `Display#canvas` beantwortet einen Zugriff nach `dispose()` mit
     einem Fehler, der die Klasse und den Zustand nennt, statt mit einem
     `TypeError` aus der Tiefe; eine offene `Display#nextFrame()`-Zusage bleibt
     beim `dispose()` nicht mehr für immer offen.
   - Ein `####`-Block unter dem vorhandenen `### Migration Guide` in
     `[Unreleased]`: was ein Aufrufer ändern muss, der ein `Display` nach dem
     `dispose()` weiterbenutzt. Before/After mit echtem Code, kopierbar, im Stil
     der Blöcke, die dort schon stehen. Der Fall, der ohne Compilerfehler
     durchgeht, ist `await display.nextFrame()` neben einem `dispose()` aus einem
     anderen Pfad: das war bisher ein stiller Hänger und ist jetzt eine
     Ablehnung, die jemand fangen muss.
   - Die Konventionen des Laufs gelten auch hier: keine Finding-IDs, kein
     Rückblick auf den Vorzustand außerhalb der Before/After-Blöcke, die genau
     dafür da sind.

7. **Sonst nichts.** Kein Umbau der RAF-Lebenszeit (Entscheidung 6), kein
   `dispose()` an `FrameLoop`, keine Änderung an `FixedFrameLoop`,
   `DisplayStateMachine` oder `Chronometer`, keine Änderung an den
   acht vorhandenen Browser-Testdateien, keine am Lookbook.
   **`Stylesheets.ts` bleibt ebenfalls unangetastet, und das ist eine
   Entscheidung, keine Lücke.** Zug 0 hat die Datei gelesen, weil
   `Display#dispose()` die dort installierten CSS-Regeln nie wieder entfernt, und
   dabei zwei Befunde mitgenommen: die tote `installedRules`-Map, an der das
   globale Stylesheet monoton wächst, und das Modul-Blatt, das sein `root` nach
   dem ersten Aufruf ignoriert. Beide stehen mit Urteil unter »Offene Befunde«.
   Keiner von beiden teilt die Ursache dieses Pakets, und ein Nebenbefund wird
   hier nicht nebenbei mitgenommen. Der Lookbook liest
   `display.renderer` (`display-minimal.astro:31`, `display-multi.astro:106`) —
   das Member ist schon `WebGPURenderer | undefined` und bewegt sich hier nicht;
   nachsehen, liegenlassen. Was beim Lesen dieser Dateien auffällt und nicht
   hierher gehört, wird als Nebenbefund mit Datei und Zeile gemeldet, nicht
   behoben.

#### Review-Fokus

- Läuft ein Guard an der falschen Stelle? `resize()` muss **vor**
  `this.#didEmitResize = false;` aussteigen, und `dispose()` muss `#disposed`
  setzen, bevor es emittiert — sonst kann ein Listener aus
  `OnDisplayDispose` heraus ein zweites `dispose()` auslösen und die ganze
  Methode noch einmal fahren.
- Bleibt in `nextFrame()` ein Listener liegen? Löst die Zusage auf, muss der
  `OnDisplayDispose`-Listener abgemeldet sein. Ohne das wächst die Listener-Liste
  mit jedem Frame — genau die Sorte Wachstum, gegen die dieser Lauf angetreten
  ist, eingebaut von der Änderung, die sie beheben soll.
- Erzeugt eine abgewiesene Zusage irgendwo eine unbehandelte Rejection? Die acht
  vorhandenen Browser-Dateien rufen `display.nextFrame()` an 23 Stellen, alle
  mit `await`; der neue Test muss seinen Handler anhängen, bevor er entsorgt.
- Nennt jede Fehlermeldung die Klasse **und** den Zustand, wie Abschnitt 4
  Regel 2 es verlangt? Eine Meldung, die nur »disposed« sagt, hilft im Stack von
  fremdem Code nicht weiter.
- Stimmt das Zitat in Abschnitt 5 der Richtlinie Wort für Wort mit
  `Display.dispose()` überein? Ein Zitat, das im selben Commit falsch wird, ist
  schlimmer als keines.
- Ist jede weggelassene Assertion aus dem Muster von Abschnitt 8 im Test
  kommentiert, oder fehlt sie einfach?
- Waren die acht Tests aus Schritt 1 vor dem Fix rot? Der Report muss die
  Ausgabe zeigen, nicht behaupten.
- Trägt der Migration Guide den Fall der offenen `nextFrame()`-Zusage? Das ist
  die Änderung, die einem Aufrufer ohne Compilerfehler durchgeht.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `test:browser` ist hier nicht optional wie in Paket 2: der ganze Vertrag nach
  `dispose()` wird ausschließlich dort belegt, weil Vitest ohne DOM läuft
  (Entscheidung 7). `test:ci` deckt den `FrameLoop`-Spec ab, `typecheck` fährt
  zusätzlich `astro check` über den Lookbook, der `display.renderer` benutzt.
  In Zug 0 gegen den heutigen Stand erprobt, Exit 0 in 17 s — lint, typecheck und
  `test:ci` kamen aus dem Nx-Cache, der Browser-Lauf selbst brauchte 10 s und lief
  wirklich. Nach der Änderung laufen alle vier echt.
- Commit: `fix(display): give a disposed display a defined contract and reset the shared frame loop driver`
- Ergebnis: 3 Runden · BUG-001, MEM-001 und der aus der Queue zugeschlagene
  Idempotenz-Guard behoben · `Display` trägt ein `#disposed`-Flag und den
  öffentlichen `isDisposed`-Getter; `canvas`, `start()` und `getEventProps()`
  werfen einen Error, der Klasse, Member und Zustand nennt; `resize()`,
  `renderFrame()`, `stop()`, ein zweites `dispose()` und ein Schreibzugriff auf
  `pause` sind stille No-ops; `nextFrame()` ist selbst gebaut und weist eine
  beim `dispose()` offene Zusage ab; `FrameLoop.resetRAF()` setzt den geteilten
  RAF-Treiber zurück · Regressionstests: neun rote Läufe vor dem Fix — drei in
  `FrameLoop.spec.ts` (`resetRAF is not a function`) und sechs Vertragsfälle in
  der neuen Browser-Datei, dazu je ein roter Lauf vor den beiden Guards der
  Fehlerkette (`stays stopped after dispose(), whatever a caller does to it`,
  `start() is refused when dispose() lands inside beforeStartCallback`) ·
  Runde 1 schloss vier Befunde (der `pause`-Setter machte ein entsorgtes
  Display wieder `isRunning === true` und stieß damit den Vertragssatz um, den
  derselbe Commit schreibt; `resetRAF()`-TSDoc widersprüchlich; eine Assertion
  ohne Zähne; Commit-Typ), Runde 2 drei (`start()` prüfte nur an zwei von drei
  Aufhängepunkten — `await beforeStartCallback(…)` war die dritte Tür in
  dieselbe Lücke; `pause` fehlte in den drei Vertragslisten; `FrameLoop.ts:131`
  halbe Wahrheit) · dritter Reviewer ohne neuen Befund · Verify erzwungen ohne
  Nx-Cache, alle vier Läufe echt, Exit 0
- Nebenbefunde: → Queue (3)
- Folgen: `packages/twopoint5d/docs/resource-lifecycle.md:159` — der Codeblock
  zitiert `Display.dispose()` seit diesem Paket samt Guard und Flag Wort für
  Wort; ein späteres Paket, das die Methode anfasst, schreibt das Zitat neu ab ·
  `packages/twopoint5d/docs/resource-lifecycle.md:106-108` — Regel 2 in
  Abschnitt 4 belegt sich jetzt an `Display#canvas` und zitiert den Wortlaut der
  Fehlermeldung aus `disposedError()`; wer die Meldung ändert, ändert diese
  Zeile mit · 2026-09-05, Zug 0 von Paket 7: beide erledigt, ohne Änderung. Nach
  Paket 3 hat kein Paket `Display` angefasst; der zitierte Codeblock ist Zeile für
  Zeile identisch mit `Display.ts:762-775`, und der zitierte Fehlertext ist der,
  den `disposedError()` baut. Nachgesehen an der Fundstelle, Tabelle unter Paket 7
- Schnittstellen: `Display#isDisposed` — neuer öffentlicher Getter ·
  `Display#canvas`, `#start()` und `#getEventProps()` werfen nach `dispose()`
  einen `Error` der Form `Display#<member> is not available: this display has
  been disposed` · `Display#resize()`, `#renderFrame()`, `#stop()`, ein zweites
  `#dispose()` und ein Schreibzugriff auf `#pause` tun nach `dispose()` nichts;
  der `pause`-Getter liest weiter den Zustand, in dem das Display
  zurückgeblieben ist · `Display#nextFrame()` gibt eine selbst gebaute Zusage
  zurück, die beim und nach dem `dispose()` abgewiesen wird; `onceAsync` hat in
  `Display.ts` keinen Aufrufer mehr · `Display#renderer` antwortet nach
  `dispose()` `undefined`, `#isRunning` `false`, `#pixelRatio` liest weiter das
  Fenster, `#isWebGPUBackend` und `#isWebGLBackend` antworten `false` ·
  `FrameLoop.resetRAF()` — neue statische Methode, hält den renderer-losen
  Treiber an und ersetzt die WeakMap; `rafUniqueInstances` ist deshalb `let` ·
  `packages/twopoint5d/docs/resource-lifecycle.md` Abschnitt 4 Regel 2 hat ihr
  Beispiel, Abschnitt 5 zitiert das neue `Display.dispose()`

**BUG-001 · medium · packages/twopoint5d/src/display/Display.ts:270-272, 674-681** — `Display.canvas` wirft nach `dispose()`

`dispose()` macht `delete this.renderer`. Der `canvas`-Getter dereferenziert
weiterhin `this.renderer!.domElement` mit Non-Null-Assertion. Ein Aufruf nach
`dispose()` wirft einen generischen TypeError statt einer aussagekräftigen
Lifecycle-Meldung — und nirgends steht, dass die Instanz danach unbenutzbar ist.

Empfehlung: Getter mit `if (!this.renderer) throw new Error(...)` absichern, oder
ein `#disposed`-Flag setzen und alle öffentlichen Accessoren guardieren.
Lifecycle-Doku in der Klasse ergänzen.

**MEM-001 · low · packages/twopoint5d/src/display/FrameLoop.ts:13-14** — Modul-globaler RAF-Singleton im FrameLoop

`let rafUniqueInstance` und `rafUniqueInstances: WeakMap` sind Modul-globaler
Zustand. Die Per-Renderer-Instanzen sind über die WeakMap sauber GC-fähig, der
Headless-Singleton lebt jedoch für die gesamte Modul-Lebensdauer. In Testläufen
mit vielen sequentiellen Displays bleibt er bestehen.

Empfehlung: Kein akuter Leak, aber ein statisches `RAF.dispose()`, das Singleton
und WeakMap-Einträge leert, würde vor allem Unit-Tests helfen, die mehrere
Displays im selben Worker erzeugen.

### [x] 4. Texture: eine Aufräumkette, keine hängenden Promises, keine verwaisten Resources

- Findings: BUG-042 (low), MEM-004 (low), MEM-005 (info), MEM-013 (low),
  MEM-002 (low)
- Ziel: `TextureResource` hängt Effects und Signals an einer einzigen Kette auf
  und hält nie eine freigegebene Textur am `texture`-Signal; keine Zusage von
  `TextureStore` überlebt ein `dispose()` oder eine fehlende id; und `parse()`
  kann verwaiste Resources auf Wunsch selbst entsorgen.
- Bereich: `packages/twopoint5d/src/texture/TextureResource.ts`,
  `TextureStore.ts` und deren Specs
- Hinweis aus Paket 3 (2026-09-05, Zug 0): »offene Zusagen werden beim
  `dispose()` abgewiesen« bekommt dort seine erste Umsetzung, an
  `Display#nextFrame()`. Die Form: die Zusage selbst bauen statt `onceAsync()`,
  einen `once`-Listener auf das Dispose-Event legen, der ablehnt, und ihn beim
  Auflösen wieder abmelden, damit nicht jede Zusage einen Listener liegen lässt.
  `TextureStore.get()` ist der Fall, den Abschnitt 4 der Richtlinie namentlich
  meint — wer hier eine zweite Form erfindet, hat zwei zu pflegen.
- Aus der Queue zugeschlagen: nichts. Kein offener Nebenbefund teilt eine
  Ursache mit diesem Paket — die acht Einträge, die dieses Paket vorfand, sitzen
  in `display/`, `sprites/` und `README.md`, keiner in `texture/` (geprüft in
  Zug 0). Die vier `texture/`-Einträge, die jetzt dort stehen, hat dieser Zug 0
  selbst hinzugefügt; sie gehören der Drain-Runde, nicht diesem Paket.
- Hängt ab von: 1
- Hash: f72ccf7
- Modell: stärkste Stufe
- Effort: high
- Dateien: fünf, keine sechste.
  1. `src/texture/TextureResource.ts` — `#ownTexture`, `attach: this` an allen acht Effects, Übergabe im Lade-Effect, `dispose()`, TSDoc
  2. `src/texture/TextureStore.ts` — `#disposed`, zwei Fehler-Fabriken, `#whenReady()`, `get()`, `whenReady()`, `whenResource()`, `parse()`/`load()` mit Optionen samt Räumschleife, `dispose()`, TSDoc
  3. `src/texture/TextureResource.spec.ts` — neu
  4. `src/texture/TextureStore.spec.ts` — erweitert, ein vorhandener Test angepasst
  5. `CHANGELOG.md` — `### Added`, `### Changed`, `### Fixed`, ein `####`-Block unter `### Migration Guide`
  (alle Pfade relativ zu `packages/twopoint5d/`)

  Keine Änderung an `texture/public-api.ts`: `export * from './TextureStore.js'`
  und `export * from './TextureResource.js'` stehen dort bereits, ein neuer
  exportierter Options-Typ kommt darüber automatisch mit.

  Keine Änderung an `docs/resource-lifecycle.md`: die Promise-Regel steht dort in
  Zeile 117–119 ohne Beleg (»a texture request, a load«) und in Punkt 7 der
  Checkliste. Beide Sätze werden von diesem Paket erfüllt, nicht verändert. Kein
  Abschnitt zitiert `TextureResource` oder `TextureStore` — Paket 1 hatte beide
  ausdrücklich als Beispiel verboten, weil sie damals die Regel brachen.

#### Abgleich am Code, Zug 0 (2026-09-05)

| Finding | Fundstelle heute | Urteil |
| --- | --- | --- |
| BUG-042 | `TextureStore.ts:368-390` — `get()` steht unverändert an dieser Stelle, baut auf `on()` und legt weder für `OnDispose` noch für eine fehlende id einen Ausgang | unverändert |
| MEM-004 | `TextureResource.ts:348-352` — der Helfer `unsubscribeOnDispose`, und acht `createEffect(...)`-Aufrufe (Zeilen 360, 398, 407, 432, 456, 464, 473, 494), keiner mit `attach` | unverändert, präzisiert: es sind acht Effects, nicht »die Effects« |
| MEM-005 | `TextureResource.ts:328-346` — fünf `onChange`-Brücken, deren Rückgabewert verfällt | unverändert |
| MEM-013 | `TextureResource.ts:385-388` — der Cleanup des Lade-Effects ruft `texture?.dispose()`, das `#texture`-Signal behält die Textur | unverändert, Zeilen um zwei verschoben |
| MEM-002 | `TextureStore.ts:396-406` — `clearUnused()` ist der einzige Weg, `parse()` (Zeile 209–289) räumt nie auf | unverändert, um vierzehn Zeilen verschoben |

Ein Defekt derselben Ursache, den BUG-042 nicht nennt und den dieses Paket
mitnimmt: **`get()` scheitert heute, wenn der Wert schon da ist.** Der Callback
läuft synchron noch innerhalb von `this.on(...)` — `OnReady` ist retained
(Zeile 129), die Subtyp-Events der Resource ebenfalls
(`TextureResource.ts:313`) —, und er ruft dort `unsubscribe()`, dessen `const`
noch in der temporalen Totzone liegt. `get()` gibt dann eine mit
`ReferenceError: Cannot access 'unsubscribe' before initialization` abgelehnte
Zusage zurück. Es ist dieselbe handgebaute Verdrahtung, dieselben drei Zeilen
und derselbe Umbau wie BUG-042; getrennt zu behandeln hieße, `get()` zweimal
aufzumachen. Kein Aufrufer im Repo trifft ihn heute — Lookbook und Browser-Test
gehen über `on()` —, was erklärt, warum er unentdeckt blieb.

Nachgesehen und ohne Befund geblieben, damit es niemand ein zweites Mal
nachsieht:

- `SignalGroup.clear()` zerstört in `@spearwolf/signalize@1.0.0` erst die
  Effects und danach die Signals (`dist/signalize.gcXQq0d2.js`, Zeilen 865–870).
  Ein Effect-Cleanup, das während `SignalGroup.delete(this)` läuft, sieht die
  Signale also noch. Der Entwurf unten stützt sich trotzdem nicht darauf: die
  Textur-Referenz liegt in einem gewöhnlichen Feld, nicht im Signal.
- Kein Code außerhalb der Klasse schreibt `TextureResource#texture`. Die einzige
  Zuweisung an ein `texture`-Member im Repo steht in
  `sprites/TexturedSprites/TexturedSprites.spec.ts:75` und meint eine andere
  Klasse. Der öffentliche Setter bleibt trotzdem, und der Entwurf gibt nur frei,
  was die Resource selbst gebaut hat.
- `packages/twopoint5d-testing/test/texture-store-on.test.js` fährt den Store
  ausschließlich über `on()`, an keiner Stelle über `get()`. Der Umbau von
  `get()` kann diese Datei nicht brechen. Sie bleibt trotzdem im Verify: sie ist
  der einzige Ort, an dem `TextureResource.load()` gegen echte Bilder läuft, und
  dieses Paket fasst die Effect-Kette an.
- `apps/lookbook/src/pages/demos/animated-sprites.astro:81` ist der einzige
  Lookbook-Aufrufer und benutzt `store.on(...)`.
- In `src/texture/` haben nur `TextureResource` und `TextureStore` eine
  `dispose()`-Methode. Paket 7 hat in diesem Verzeichnis danach nichts mehr zu
  holen.
- `test:ci` fährt Vitest mit `--coverage`; für `src/texture/**` gelten Schwellen
  von 70/61/62/70 (`vite.config.ts`). Der Lauf steht heute bei 806 grünen Tests
  und global 69,3/63,56/63,68/69,3. Dieses Paket bringt Tests mit, die Schwelle
  ist also kein Risiko — sie ist nur der Grund, warum ein neuer Zweig ohne Test
  den Verify rot machen kann.

#### Sechs Entscheidungen dieses Zuges

Getroffen mit dem Code vor Augen, deshalb hier und nicht unter »Entscheidungen« im Kopf.

1. **Die Textur wandert in ein eigenes Feld `#ownTexture`, und nur dieses Feld
   wird je freigegeben.** Die Entscheidung im Kopf des Plans verlangt, dass das
   `texture`-Signal nie auf eine freigegebene Textur zeigt. Damit kann der
   Cleanup des Lade-Effects nicht mehr freigeben — er läuft, *bevor* der nächste
   Durchlauf die neue Textur setzt. Die Freigabe rückt deshalb hinter das Setzen
   der neuen: der Nachfolger wird veröffentlicht, dann fällt der Vorgänger. Das
   Feld ist zugleich die Ownership-Buchführung aus Abschnitt 2 der Richtlinie:
   was über den öffentlichen `texture`-Setter hereinkommt, steht nie darin und
   wird nie entsorgt.
2. **`dispose()` räumt das `texture`-Signal, und zwar stumm.** Ohne das Räumen
   verletzt `dispose()` genau die Regel, die dieses Paket schreibt: die Textur
   ist frei, das Signal zeigt weiter auf sie. Geräumt wird über
   `this.#texture.muted = true` vor dem `set(undefined)` — ein gemutetes Signal
   speichert, benachrichtigt aber nicht (`api.md` zu `muted`). Grund: die
   `onChange`-Brücke aus `load()` würde sonst `emit(this, 'texture', undefined)`
   feuern, und der Einzeltyp-Pfad in `TextureStore.on()` (Zeile 352–356) reicht
   den Wert ungeprüft an einen Callback weiter, dessen Typ eine `Texture` zusagt
   — der Mehrtyp-Pfad filtert `null` weg, der Einzeltyp-Pfad nicht. Das
   Dispose-Event ist ohnehin schon draußen; ein Textur-Update hinterher ist
   Lärm, der obendrein den Typ bricht.
3. **Kein öffentlicher `isDisposed`-Getter, weder am Store noch an der
   Resource.** Abschnitt 3 der Richtlinie stellt ihn dorthin, »where callers
   actually have to branch on it, not as boilerplate on every class«. Hier muss
   niemand verzweigen: keine Methode fängt in diesem Paket an zu werfen, `texture`
   antwortet `undefined` (Typ lässt das zu), und eine abgewiesene Zusage fängt
   man mit `catch`. Das ist der Unterschied zu Paket 3, wo `Display#canvas`
   synchron wirft und ein Aufrufer vorher fragen können muss. `TextureStore`
   bekommt das private `#disposed` trotzdem — `get()` braucht es, um auf einem
   längst entsorgten Store sofort abzuweisen statt auf ein Event zu warten, das
   nie wieder kommt, und derselbe Guard macht den Phantom-Emit unmöglich, den
   Paket 3 an `Display` beseitigt hat. `TextureResource` hat sein `#disposed`
   samt Guard bereits (Zeile 305, 317).
4. **`whenReady()` und `whenResource()` kommen mit, obwohl BUG-042 nur `get()`
   nennt.** Abschnitt 4 der Richtlinie kennt keine Ausnahme: »A pending promise
   is not allowed to survive.« `TextureStore` hat genau drei Methoden, die eine
   Zusage herausgeben, und alle drei hängen nach einem `dispose()` bis zum
   Seitenende. Eine davon zu schließen hieße, in derselben Klasse einen
   Vertragssatz aufzuschreiben, den sie an zwei Stellen bricht — und `dispose()`
   in einem späteren Paket ein zweites Mal aufzumachen. Paket 3 hat dieselbe
   Frage an `Display#nextFrame()` mit derselben Begründung so entschieden
   (dessen Entscheidung 5). Der Mechanismus ist für alle drei einer.
5. **`get()` richtet sich bei der fehlenden id nach `whenResource()`, und beide
   teilen sich den Fehlertext.** BUG-042 verlangt genau das (»mit demselben
   Fehler wie `whenResource()` rejecten«). Es ist eine Verhaltensänderung: eine
   id, die erst ein *zweites* `parse()` nachliefert, ließ `get()` bisher warten
   und wird jetzt nach dem ersten `OnReady` abgewiesen. Der übliche Ablauf —
   `get()` vor dem ersten `parse()` — bleibt unberührt. Der Text kommt aus einer
   Modulfunktion, damit die beiden Meldungen nicht auseinanderlaufen können.
   `on()` bleibt unangetastet: eine Subscription, die auf ein späteres `parse()`
   wartet, ist gewollt und wird im Spec (Zeile 16–26) auch so benutzt.
6. **`evictMissing` steht auch an `load(url, options)`, nicht nur an `parse()`.**
   MEM-002 nennt als Anlass »Live-Editing, Hot-Reload«, und genau dieser Ablauf
   geht über `load(url)`, das seine Daten selbst holt und an `parse()` reicht.
   Ohne den Durchgriff wäre die Option für den Fall unerreichbar, für den sie
   gebaut wird. Der Vorgabewert bleibt in beiden Fällen »nicht räumen«. Das
   statische `TextureStore.load(url)` bleibt unangetastet.

#### Vorgehen

Reihenfolge einhalten: erst die roten Tests (Schritt 1), dann der Code
(Schritte 2 und 3), dann die restlichen Tests und das CHANGELOG (Schritte 4
und 5).

1. **Regressionstests zuerst, rot sehen, Ausgabe in den Report.** Elf Tests
   fallen gegen den heutigen Code durch. Kommando für den roten Lauf:
   `cd packages/twopoint5d && pnpm vitest --run src/texture` (in Zug 0 erprobt,
   Exit 0 in 199 ms bei 117 Tests). Der rote Lauf gehört im Wortlaut in den
   Report.

   In `TextureStore.spec.ts`:
   - `get()` auf eine id, die der Store nicht hat, wird abgewiesen, sobald das
     erste `parse()` durch ist — mit derselben Meldung, die `whenResource()`
     wirft (heute: wartet still weiter).
   - eine beim `dispose()` offene `get()`-Zusage wird abgewiesen (heute: bleibt
     für immer offen).
   - `get()` auf einem bereits entsorgten Store wird abgewiesen (heute: wartet
     auf ein Event, das nie wieder kommt).
   - `get()` löst auf, wenn der Wert beim Aufruf schon anliegt: Resource parsen,
     `ImageLoader.prototype.loadAsync` stubben, Textur ankommen lassen, dann
     erst `get(id, 'texture')` rufen (heute: abgelehnt mit
     `ReferenceError: Cannot access 'unsubscribe' before initialization`).
   - eine beim `dispose()` offene `whenReady()`-Zusage wird abgewiesen (heute:
     bleibt offen).
   - eine beim `dispose()` offene `whenResource()`-Zusage wird abgewiesen
     (heute: bleibt offen).
   - `parse(data, {evictMissing: true})` entsorgt und entfernt eine Resource,
     die der neue Datensatz nicht mehr nennt und die niemand abonniert hat, und
     lässt eine abonnierte stehen (heute: die Option gibt es nicht).
   - ein zweites `dispose()` feuert das Dispose-Event nicht erneut: nach dem
     ersten Aufruf einen Listener anmelden, ein zweites Mal entsorgen, der
     Listener bleibt ungerufen (heute wird er gerufen).

   In `TextureResource.spec.ts` (neu):
   - nach einem `imageUrl`-Wechsel bekommt kein Abonnent des `texture`-Events je
     eine bereits entsorgte Textur, und der Vorgänger wird genau einmal
     entsorgt, nachdem der Nachfolger am Signal steht. Aufbau wie im vorhandenen
     Test »stale image result after imageUrl change does not overwrite fresh
     texture«: `loadAsync` zweimal stubben, Stub-Texturen mit einem
     `disposed`-Flag, per `on(resource, 'texture', …)` jede Auslieferung samt
     `disposed`-Zustand mitschreiben (heute: der Vorgänger ist beim Wechsel
     entsorgt, während `resource.texture` weiter auf ihn zeigt).
   - `dispose()` gibt die selbst gebaute Textur frei, und `texture` antwortet
     danach `undefined` (heute: die Textur wird freigegeben, `texture` antwortet
     aber weiter mit ihr).
   - `load()` hinterlässt keinen Dispose-Listener je Effect:
     `getSubscriptionCount(resource)` ist nach `load()` derselbe Wert wie davor
     (heute: acht mehr).

2. **`TextureResource.ts`** — eine Kette, und die Textur wechselt den Besitzer,
   bevor sie fällt.

   - Ein privates Feld bei den übrigen `#`-Feldern, mit dem Grund als Kommentar:
     ```ts
     // the texture this resource built for itself and therefore owns; a texture assigned
     // through the public setter never lands here and is never released by this class
     #ownTexture?: Texture;
     ```
   - Der Helfer `unsubscribeOnDispose` (Zeile 348–352) entfällt ersatzlos. Alle
     acht `createEffect(...)`-Aufrufe bekommen stattdessen `{attach: this}` und
     stehen nackt da, ohne Umhüllung:
     - die beiden auto-tracking Effects (heute Zeile 360 und 494) werden zu
       `createEffect(() => { … }, {attach: this})`;
     - die sechs mit statischer Abhängigkeitsliste werden zu
       `createEffect(() => { … }, [ … ], {attach: this})`.

     Die Abhängigkeitslisten bleiben Zeichen für Zeichen, wie sie sind. Ein
     Effect mit statischen Deps läuft bei der Registrierung nicht von selbst und
     verfolgt nichts automatisch; die beiden ohne Liste tun beides. Wer eine
     Liste hinzufügt oder wegnimmt, ändert die Ladelogik, nicht die
     Aufräumkette. Der Kommentar über dem ersten Effect (»auto-tracking effect
     (no static deps) so it autoruns at registration …«, Zeile 354–358) bleibt
     stehen und stimmt weiter, ebenso `touch(atlasUrlSignal)` in Zeile 486.
   - Die fünf `onChange`-Brücken (Zeile 328–346) bleiben, wie sie sind, und
     bekommen einen Kommentar darüber, der sagt, warum ihr Rückgabewert verfällt
     — sonst liest der Nächste dort wieder eine zweite Kette:
     ```ts
     // these bridges end with the signals they read: the signals are attached to this
     // resource, and SignalGroup.delete(this) in dispose() destroys them
     ```
   - Im Lade-Effect wandert die Freigabe hinter das Veröffentlichen. Der `then`-
     Block lautet danach:
     ```ts
     .then((image) => {
       if (aborted) return;
       texture = factory.create(image, ...(classes ?? []));
       texture.name = this.id;
       batch(() => {
         this.imageCoords = new TextureCoords(0, 0, image.width, image.height);
         this.texture = texture;
       });
       // the predecessor stayed alive while it was still the published value; now that
       // the successor is on the signal, no reader can reach the old one any more
       const previous = this.#ownTexture;
       this.#ownTexture = texture;
       previous?.dispose();
     })
     ```
     und der Cleanup verliert seine Freigabe:
     ```ts
     return () => {
       // a texture that reached the signal outlives this run and is released by the run
       // that replaces it, or by dispose() — freeing it here would leave the signal
       // pointing at a texture that is already gone
       aborted = true;
     };
     ```
     Der `aborted`-Wächter steht in `then` vor `factory.create(…)`, und alles
     danach ist synchron: `texture` ist also entweder nie gesetzt oder
     veröffentlicht. Ein dritter Zustand, den der Cleanup abfangen müsste,
     existiert nicht.
   - `dispose()`:
     ```ts
     dispose() {
       if (this.#disposed) return;
       this.#disposed = true;

       emit(this, OnDispose);

       // the dispose event above is how subscribers learn this resource is gone; muting
       // keeps the clean-up below from following it with a texture update that would hand
       // a subscriber an undefined where the event type promises a Texture
       this.#texture.muted = true;
       this.#texture.set(undefined);

       // released only after the signal has given it up, so no reader can ever reach a
       // texture that is already freed
       this.#ownTexture?.dispose();
       this.#ownTexture = undefined;

       SignalGroup.delete(this);
       off(this);
     }
     ```
   - TSDoc an `dispose()`: welche Textur freigegeben wird und welche nicht, dass
     `texture` danach `undefined` antwortet, dass ein zweiter Aufruf nichts tut,
     und dass jedes andere Member seinen letzten Wert behält. TSDoc am
     `texture`-Getter: antwortet `undefined`, sobald die Resource entsorgt ist.
     TSDoc am `texture`-Setter: eine hier zugewiesene Textur gehört dem
     Aufrufer und wird von dieser Klasse nicht entsorgt.

3. **`TextureStore.ts`** — kein Warten ohne Ausgang, und `parse()` kann räumen.

   - Zwei Modulfunktionen neben `joinTextureClasses`, damit die Meldungen an
     einer Stelle stehen:
     ```ts
     const noResourceError = (id: string): Error =>
       new Error(`[TextureStore] No resource with id "${id}" — check your TextureStoreData.items keys.`);

     const disposedError = (what: string): Error =>
       new Error(`[TextureStore] ${what} was cancelled: this store has been disposed`);
     ```
     `whenResource()` wirft ab jetzt `noResourceError(id)` statt seines
     eingebauten Literals; der Wortlaut ist derselbe, der Test
     »whenResource() rejects after first ready if the id is missing« bleibt grün.
   - Ein privates Feld `#disposed = false;` bei den übrigen `#`-Feldern.
     `dispose()` bekommt `if (this.#disposed) return; this.#disposed = true;` als
     erste zwei Zeilen; der Rest der Methode bleibt Zeile für Zeile, wie er ist.
   - `whenReady()` und `whenResource()` bekommen denselben Ausgang. Statt
     `await onceAsync(this, OnReady)` jeweils eine selbst gebaute Zusage nach der
     Form aus Paket 3 — `once()` gibt seine Abmeldung zurück, und der auflösende
     Zweig meldet den anderen ab:
     ```ts
     #whenReady(what: string): Promise<void> {
       return new Promise<void>((resolve, reject) => {
         if (this.#disposed) {
           reject(disposedError(what));
           return;
         }
         // dispose() emits before it drops its listeners, so this is the last moment at
         // which a caller waiting for a store that will never be ready can be told
         const unsubscribeDispose = once(this, OnDispose, () => {
           reject(disposedError(what));
         });
         once(this, OnReady, () => {
           unsubscribeDispose();
           resolve();
         });
       });
     }
     ```
     `whenReady()` wird dann `await this.#whenReady('whenReady()'); return this;`
     und `whenResource(id)` ruft an der Stelle seines heutigen
     `await onceAsync(…)` das neue `#whenReady(...)` auf und übergibt als `what`
     ein Template-Literal der Form `whenResource(<id>)`, damit die Meldung sagt,
     welche id gewartet hat. Der Rest beider
     Methoden — der Schnellpfad über `#resources.get(id)` und der Wurf über
     `noResourceError(id)` — bleibt unverändert. `onceAsync` hat danach in
     `TextureStore.ts` keinen Aufrufer mehr und fällt aus dem Import.
   - `get()` wird neu verdrahtet. Der Rumpf innerhalb von `new Promise(...)`
     lautet danach:
     ```ts
     if (this.#disposed) {
       reject(disposedError(`get(${id}, ${String(type)})`));
       return;
     }
     if (signal?.aborted) {
       reject(new DOMException('get() aborted before subscription', 'AbortError'));
       return;
     }

     const teardown: Array<() => void> = [];
     let settled = false;

     const settle = () => {
       if (settled) return;
       settled = true;
       signal?.removeEventListener('abort', onAbort);
       for (const unsubscribe of teardown) unsubscribe();
       teardown.length = 0;
     };

     // every listener this promise installs goes through here: on() can deliver a retained
     // value synchronously, before it has even returned its unsubscribe function, so a
     // subscription registered into an already settled promise is dropped instead of left
     const track = (unsubscribe: () => void) => {
       if (settled) {
         unsubscribe();
       } else {
         teardown.push(unsubscribe);
       }
     };

     const onAbort = () => {
       settle();
       reject(new DOMException(`get(${id}, ${String(type)}) aborted`, 'AbortError'));
     };

     track(
       this.on(id, type, (value) => {
         settle();
         resolve(value);
       }),
     );

     track(
       once(this, OnDispose, () => {
         settle();
         reject(disposedError(`get(${id}, ${String(type)})`));
       }),
     );

     // on() keeps waiting for a later parse(); get() answers like whenResource() and gives
     // up once the first ready has gone by without the id showing up
     track(
       once(this, OnReady, () => {
         if (this.#resources.has(id)) return;
         settle();
         reject(noResourceError(id));
       }),
     );

     signal?.addEventListener('abort', onAbort, {once: true});
     ```
     `onAbort` wird von `settle` gelesen, bevor es deklariert ist; das ist
     zulässig, weil `settle` erst später aufgerufen wird — aber `onAbort` muss
     wie oben **vor** dem ersten `track(...)` stehen, sonst greift ein
     synchron auflösender Callback in die Totzone. Genau daran scheitert der
     heutige Code.
   - `parse()` bekommt einen zweiten Parameter und räumt am Ende:
     ```ts
     export interface TextureStoreParseOptions {
       /**
        * Dispose and remove every resource that the parsed data no longer names and that
        * has no subscribers left (`refCount === 0`). Defaults to `false`, which keeps
        * every resource until {@link TextureStore.clearUnused} is called.
        */
       evictMissing?: boolean;
     }
     ```
     Signatur `parse(data: TextureStoreData, options?: TextureStoreParseOptions)`.
     Nach `updatedResources.forEach(...)` am Ende der Methode:
     ```ts
     if (options?.evictMissing) {
       const keep = new Set(updatedResources.map((resource) => resource.id));
       for (const [id, resource] of this.#resources) {
         if (keep.has(id) || resource.refCount > 0) continue;
         resource.dispose();
         this.#resources.delete(id);
       }
     }
     ```
     Die Menge kommt aus `updatedResources` und nicht aus `Object.keys(data.items)`:
     ein Eintrag, der keine der drei Bauformen trifft, erzeugt keine Resource,
     lässt aber eine vorhandene stehen — und die steht dann in
     `updatedResources`. Über die Keys geräumt, fiele sie fälschlich weg.
   - `load(url: string | URL, options?: TextureStoreParseOptions)` reicht die
     Optionen an seinen `this.parse(data)`-Aufruf durch, sonst unverändert.
   - TSDoc: an `parse()` und `load()` je ein Satz zu `evictMissing`; an
     `get()`, `whenReady()` und `whenResource()` je ein Satz, dass eine offene
     Zusage beim `dispose()` abgewiesen wird und ein Aufruf auf einem entsorgten
     Store sofort abgewiesen wird; an `get()` zusätzlich, dass eine id, die nach
     dem ersten `parse()` fehlt, abgewiesen wird statt zu warten. Der vorhandene
     TSDoc an `whenResource()` und `clearUnused()` bleibt sonst stehen.

4. **Tests.** Muster und Assertionen (a) bis (e) stehen in Abschnitt 8 von
   `packages/twopoint5d/docs/resource-lifecycle.md`. `createSandbox()` aus
   `sinon` für Spies auf den Prüfling, `vi.spyOn` für `ImageLoader.prototype`
   — wie es die vorhandenen Tests in `TextureStore.spec.ts` schon halten. Wo
   eine Assertion in einer Klasse kein Subjekt hat, entfällt sie **mit einem
   Kommentar, der das sagt** — nicht stillschweigend.

   - `TextureResource.spec.ts`, neu, mit den drei roten Tests aus Schritt 1 und
     dazu: (a) die selbst gebaute Textur wird genau einmal entsorgt;
     (b) eine über den öffentlichen `texture`-Setter zugewiesene Textur wird
     nicht angefasst — das ist die Ownership-Grenze aus Entscheidung 1;
     (c) `texture` antwortet `undefined`, die übrigen Getter behalten ihren
     letzten Wert; (d) ein zweiter `dispose()`-Aufruf wirft nicht und entsorgt
     nichts erneut; (e) `getSignalsCount()` und `getEffectsCount()` sind nach
     `dispose()` wieder auf dem Wert von vor der Konstruktion. Assertion (e)
     ist hier ein Wächter und kein roter Test — sie ist auch heute grün, weil
     die Effects über die Dispose-Listener sterben; nach dem Umbau belegt sie,
     dass die eine verbliebene Kette dasselbe leistet.
   - `TextureStore.spec.ts`: die acht roten Tests aus Schritt 1 in die
     passenden vorhandenen `describe`-Blöcke, plus (b) ein dem Konstruktor
     übergebener Renderer wird von `dispose()` nicht entsorgt.
   - **Ein vorhandener Test muss angepasst werden, sonst wird der Verify rot:**
     »get() resolves with the correctly-typed tuple for the string-literal form«
     (heute Zeile 240–254) lässt eine `get()`-Zusage absichtlich offen liegen
     (`void p`) und ruft am Ende `store.dispose()`. Ab diesem Paket wird genau
     diese Zusage dabei abgewiesen, und eine unbehandelte Rejection bricht den
     Lauf. Die Zusage bekommt ihren Handler — `await expect(p).rejects.toThrow(…)`
     nach dem `dispose()` —, und der Kommentar »p never resolves in this test«
     wird durch das ersetzt, was jetzt zutrifft. Die übrigen Zeilen der Datei
     bleiben, wie sie sind.
   - Die neuen Tests in `TextureResource.spec.ts` bleiben neu; die vorhandenen
     `TextureResource`-Blöcke in `TextureStore.spec.ts` (»load() initial
     firing«, »load() image race«, »fromX input safety«) werden **nicht**
     verschoben. Ein Umzug wäre ein reiner Dateiwechsel ohne Verhaltensgewinn
     und würde den eigentlichen Diff dieses Pakets unter hundert verschobenen
     Zeilen begraben.

5. **`CHANGELOG.md`**, `[Unreleased]`, nach dem Skill `updating-changelog`:
   - Unter `### Added`: die Option `evictMissing` an `TextureStore#parse()` und
     `#load()` samt dem exportierten `TextureStoreParseOptions`, mit dem
     Vorgabewert und der Abgrenzung zu `clearUnused()`.
   - Unter `### Changed`: `TextureStore#get()` weist eine id ab, die nach dem
     ersten `parse()` fehlt, statt weiter zu warten — mit demselben Fehler wie
     `whenResource()`; `TextureResource#dispose()` gibt die selbst gebaute
     Textur frei und `texture` antwortet danach `undefined`; ein zweites
     `TextureStore#dispose()` tut nichts.
   - Unter `### Fixed`: eine offene Zusage von `get()`, `whenReady()` oder
     `whenResource()` wird beim `dispose()` abgewiesen statt liegengelassen;
     `get()` löst auf, wenn der Wert beim Aufruf schon anliegt; eine Textur wird
     erst freigegeben, wenn ihre Nachfolgerin am `texture`-Signal steht, sodass
     kein Abonnent je eine freigegebene Textur bekommt.
   - Ein `####`-Block unter dem vorhandenen `### Migration Guide` in
     `[Unreleased]`: Before/After mit echtem, kopierbarem Code im Stil der
     Blöcke, die dort schon stehen. Der Fall, der Aufrufern am ehesten unbemerkt
     entgleitet, ist die abgewiesene Zusage — wer `store.get(...)` bisher ohne
     `catch` hielt und den Store später entsorgt, bekommt ab jetzt eine
     Rejection, wo vorher nichts passierte. Der zweite Fall ist die id, die erst
     ein zweites `parse()` nachliefert.
   - Die Konventionen des Laufs gelten auch hier: keine Finding-IDs, kein
     Rückblick auf den Vorzustand außerhalb der Before/After-Blöcke.

6. **Sonst nichts.** Kein öffentlicher `isDisposed`-Getter, keine Umstellung der
   fünf `onChange`-Brücken auf Effects, kein Räumen der übrigen Signale in
   `TextureResource.dispose()`, keine Umsortierung von `TextureStore.dispose()`,
   keine Änderung an `docs/resource-lifecycle.md`, an `public-api.ts`, an
   `packages/twopoint5d-testing/` oder am Lookbook. Was beim Lesen dieser
   Dateien auffällt und nicht hierher gehört, wird als Nebenbefund mit Datei und
   Zeile gemeldet, nicht behoben.

#### Review-Fokus

- Wird irgendwo eine Textur freigegeben, die die Resource nicht gebaut hat, oder
  eine liegengelassen, die sie gebaut hat? Die zwei Stellen sind die Übergabe im
  `then`-Block und `dispose()`; `#ownTexture` ist die einzige Quelle, aus der
  freigegeben werden darf.
- Zeigt das `texture`-Signal zu irgendeinem Zeitpunkt auf eine bereits
  freigegebene Textur? Das ist die Zusage dieses Pakets, und der Test dazu muss
  den Zustand **im Moment der Auslieferung** messen, nicht danach.
- Steht `onAbort` in `get()` vor dem ersten `track(...)`? Eine synchron
  ausgelieferte Retained-Value greift sonst in die Totzone — genau der Defekt,
  den dieses Paket beseitigt, an neuer Stelle wieder eingebaut.
- Bleibt nach einer aufgelösten oder abgewiesenen `get()`-Zusage ein Listener am
  Store liegen? `getSubscriptionCount(store)` vor und nach jedem der vier
  Ausgänge (Wert, Abbruch, Dispose, fehlende id) muss gleich sein. Ohne das
  wächst die Listener-Liste mit jedem `get()` — genau die Sorte Wachstum, gegen
  die dieser Lauf angetreten ist, eingebaut von der Änderung, die sie beheben
  soll.
- Erzeugt eine abgewiesene Zusage irgendwo eine unbehandelte Rejection? Der
  vorhandene Test in Zeile 240–254 ist der bekannte Fall; ein zweiter im
  Browser-Test wäre einer, den `test:ci` nicht sieht.
- Haben alle acht Effects `{attach: this}` bekommen, und ist keine
  Abhängigkeitsliste dabei verrutscht? Ein Effect, der versehentlich eine Liste
  bekommt, läuft bei der Registrierung nicht mehr an; einer, der seine verliert,
  läuft ab da bei jedem gelesenen Signal.
- Ist `unsubscribeOnDispose` restlos verschwunden, oder steht die zweite Kette
  noch irgendwo halb da?
- Nennt jede Fehlermeldung die Klasse und den Zustand, wie Abschnitt 4 Regel 2
  es verlangt?
- Ist jede weggelassene Assertion aus dem Muster von Abschnitt 8 im Test
  kommentiert, oder fehlt sie einfach?
- Waren die elf Tests aus Schritt 1 vor dem Fix rot? Der Report muss die Ausgabe
  zeigen, nicht behaupten.
- Trägt der Migration Guide den Fall der beim `dispose()` abgewiesenen Zusage?
  Das ist die Änderung, die einem Aufrufer ohne Compilerfehler durchgeht.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `test:ci` trägt die neuen Specs und fährt Vitest mit Coverage (Schwellen für
  `src/texture/**`: 70/61/62/70). `test:browser` ist nicht optional: dieses Paket
  fasst die Effect-Kette von `TextureResource.load()` an, und
  `packages/twopoint5d-testing/test/texture-store-on.test.js` ist der einzige
  Ort, an dem diese Kette gegen echte Bilder, echte Texturen und einen echten
  Renderer läuft. `typecheck` deckt die Specs mit ab (`pnpm build` lässt sie
  aus) und fährt zusätzlich `astro check` über den Lookbook, der den Store
  benutzt — das ist der Regressionsteil für die beiden geänderten Signaturen.
  In Zug 0 gegen den heutigen Stand erprobt, Exit 0 in 7 s; alle vier Läufe kamen
  aus dem Nx-Cache, nach der Änderung laufen sie wirklich.
- Commit: `fix(texture): reject pending store promises on dispose and defer freeing a replaced texture`
- Ergebnis: 2 Runden · alle fünf Findings behoben — BUG-042 (`get()` weist auf
  einem entsorgten Store, beim `dispose()` und bei einer nach dem ersten
  `parse()` fehlenden id ab), MEM-004 (acht Effects mit `{attach: this}`,
  `unsubscribeOnDispose` restlos entfernt), MEM-005 (die zweite Lebenszyklus-Kette
  ist fort, die fünf `onChange`-Brücken tragen die Begründung, warum ihr
  Rückgabewert verfällt), MEM-013 (der Nachfolger steht am `texture`-Signal, bevor
  der Vorgänger fällt), MEM-002 (`evictMissing` an `parse()` und `load()`) · dazu
  der Defekt derselben Ursache, den Zug 0 mitgenommen hat: `get()` löst jetzt auf,
  wenn der Wert beim Aufruf schon anliegt · Regressionstests: 13 rote Läufe vor dem
  Fix (`cd packages/twopoint5d && pnpm vitest --run src/texture`, 13 von 133 rot,
  danach 137 grün), darunter `a texture reaches the texture event only while it is
  alive`, `disposes the texture it created itself`, `registers no dispose listener
  of its own`, die drei `rejects a … promise that is still pending`, `get()
  resolves when the value is already there at call time` und
  `parse({evictMissing: true}) disposes and removes resources the new data no
  longer names`; dazu in Runde 2 der eigene rote Lauf für
  `a get() answered synchronously installs no abort listener on the caller signal`
  (mit ausgebautem Guard rot, mit Guard grün) · Runde 1 schloss vier von fünf
  Review-Befunden (falsch beschriebener CHANGELOG-Eintrag, Abort-Listener an einer
  synchron aufgelösten Zusage, `refCount`-Zusage im TSDoc, unkommentiert fehlender
  vierter Ausgang im Zähler-Test) und wies den fünften mit nachgesehener Abfolge
  zurück: der `get()`-Aufrufer in
  `apps/lookbook/src/pages/demos/animated-sprites.astro:92` bricht nicht, weil
  `parse()` die Map im `batch()` füllt und `OnReady` erst danach emittiert — vom
  zweiten Reviewer Schritt für Schritt bestätigt, Lookbook bleibt unangetastet ·
  Runde 2 schloss die zwei kleinen Befunde, die Runde 1 selbst eingebracht hatte ·
  dritter Reviewer ohne neuen Befund · Verify erzwungen ohne Nx-Cache, alle vier
  Läufe echt, Exit 0
- Nebenbefunde: → Queue (3)
- Folgen: —
- Schnittstellen: `TextureStoreParseOptions` — neu exportiert, trägt die Option
  `evictMissing` · `TextureStore#parse(data, options?)` und
  `#load(url, options?)` nehmen sie entgegen, Vorgabewert `false`; mit `true`
  entsorgt und entfernt ein Parse jede Resource, die die neuen Daten nicht mehr
  nennen und deren `refCount` auf 0 steht · `TextureStore#get()`, `#whenReady()`
  und `#whenResource()` geben selbst gebaute Zusagen zurück: eine offene wird beim
  `dispose()` abgewiesen, ein Aufruf auf einem entsorgten Store sofort;
  zusätzlich weist `get()` eine id ab, die nach dem ersten `parse()` fehlt, mit
  demselben Fehler wie `whenResource()` · die beiden Fehlertexte kommen aus den
  Modulfunktionen `noResourceError(id)` und `disposedError(what)` in
  `TextureStore.ts`; wer eine Meldung ändert, ändert sie dort · ein zweites
  `TextureStore#dispose()` tut nichts (privates `#disposed`, kein öffentlicher
  `isDisposed`-Getter — bewusst, Entscheidung 3) · `onceAsync` hat in
  `TextureStore.ts` keinen Aufrufer mehr und ist damit repoweit ohne ·
  `TextureResource#dispose()` gibt ausschließlich die selbst gebaute Textur frei,
  `texture` antwortet danach `undefined`, jedes andere Member behält seinen
  letzten Wert; eine über den öffentlichen `texture`-Setter zugewiesene Textur
  gehört dem Aufrufer · alle acht Effects in `TextureResource.load()` hängen an
  `{attach: this}`, der Helfer `unsubscribeOnDispose` existiert nicht mehr

**BUG-042 · low · packages/twopoint5d/src/texture/TextureStore.ts:368-390** — `TextureStore.get()` hängt nach dispose() und bei unbekannter id

`get(id, type)` baut auf `on()`. Wird der Store disposed, ruft `on()` sein
internes `unsubscribe`; der Promise von `get()` wird dabei weder resolved noch
rejected. Dasselbe, wenn `parse()` die `id` nie liefert: `whenResource(id)`
rejectet in diesem Fall mit einer klaren Meldung, `get()` wartet still. Zwei
Wege, die sich gleich anfühlen, mit zwei verschiedenen Fehlerverhalten.

Empfehlung: In `get()` zusätzlich `once(this, OnDispose, …)` mit Reject
registrieren und nach dem ersten `OnReady` prüfen, ob die `id` existiert; sonst
mit demselben Fehler wie `whenResource()` rejecten.

**MEM-004 · low · packages/twopoint5d/src/texture/TextureResource.ts** — Effects in TextureResource.load() ohne attach, doppelte Buchführung

Die Effects entstehen per `createEffect(..., [deps])` ohne `attach: this`; ihr
Cleanup läuft über `once(this, OnDispose, () => effect.destroy())`. Funktioniert,
ist aber eine zweite Lifecycle-Kette neben der SignalGroup.

Empfehlung: `attach: this` setzen und den Abbau vollständig
`SignalGroup.delete(this)` im `dispose()` überlassen — das zerstört Signals,
Effects und Links in einem Zug. Senkt nebenbei die Zahl der
`OnDispose`-Listener.

**MEM-005 · info · packages/twopoint5d/src/texture/TextureResource.ts** — onChange-Subscriptions und off(this) laufen als zwei parallele Ketten

`this.#imageCoords.onChange(...)` und Geschwister werden beim Signal-Destroy
implizit beendet, zusätzlich räumt `off(this)` auf. Beide Wege passen zusammen,
aber wer den Cleanup nachvollziehen will, muss zwei Diagramme gleichzeitig im
Kopf halten.

Empfehlung: Zusammen mit MEM-004 auf eine Kette reduzieren. Rein struktureller
Cleanup, kein Verhaltensfehler.

**MEM-013 · low · packages/twopoint5d/src/texture/TextureResource.ts:366-388** — Nach einem imageUrl-Wechsel hängt eine disposed Texture am texture-Signal

Der Cleanup des Lade-Effekts ruft `texture?.dispose()`, sobald `imageUrl`,
`textureFactory` oder `textureClasses` sich ändern. Das `texture`-Signal und
damit alle `on('texture')`-Abonnenten behalten aber bis zum Eintreffen des neuen
Bildes die alte, bereits freigegebene Textur. Ein Material, das sie in dieser
Zeit rendert, zwingt three.js zu einem erneuten GPU-Upload der alten Textur, die
danach wieder verworfen wird; bei langsamem Netz ein sichtbarer Doppel-Upload
pro Wechsel.

Empfehlung: Im Cleanup zusätzlich `this.texture = undefined` setzen, damit
Abonnenten den Wechsel sehen, oder die alte Textur erst disposen, wenn die neue
gesetzt ist.

**MEM-002 · low · packages/twopoint5d/src/texture/TextureStore.ts:382-392** — clearUnused() ist reines Opt-in, verwaiste Resources bleiben liegen

Wird `parse()` mehrfach mit unterschiedlichen Resource-IDs aufgerufen
(Live-Editing, Hot-Reload), bleiben die alten Einträge in der internen Map, bis
jemand `clearUnused()` ruft. Bei langlaufenden Apps mit dynamischem Content ist
das eine Speicherlinie, die nur nach oben zeigt.

Empfehlung: Auto-Eviction als Option: nach `parse()` jene Resources entsorgen,
die im neuen Datensatz fehlen _und_ `refCount === 0` haben. Default bleibt
rückwärtskompatibel, aktiviert per `parse(data, {evictMissing: true})`.

### [x] 5. vertex-objects: ein Attributslot gehört einer Route

Umbenannt in Zug 0 (2026-09-05). Der alte Titel — »verdrängtes Attribut erreicht
dispose()« — beschreibt einen Weg, den die Messung unten ausschließt.

- Findings: MEM-011 (medium), READ-005 (info)
- Ziel: Ein Attributslot dieser Geometrie trägt über ihre ganze Lebenszeit genau
  ein `THREE.BufferAttribute`. Eine Route, die einen bereits benutzten Slot
  belegen würde, wird an der Aufrufstelle mit einem Fehler abgewiesen, statt
  still einen GPU-Buffer zurückzulassen. Belegt durch Vitest-Tests für die
  Abweisung und durch einen Browser-Test, der `renderer.info.memory.attributes`
  vor der Geometrie und nach `dispose()` vergleicht.
- Bereich: `packages/twopoint5d/src/vertex-objects/`,
  `packages/twopoint5d-testing/test/`, `packages/twopoint5d/CHANGELOG.md`
- Aus der Queue zugeschlagen (2026-09-05, Zug 0 von Paket 2):
  `VOBufferGeometry.ts:193` (`#firstAutoTouch` nach `dispose()`). In Zug 0 an der
  Fundstelle nachgesehen und als gegenstandslos entschieden — die Begründung
  steht am Eintrag unter »Offene Befunde«. `VOBufferGeometry.ts` fällt damit aus
  dem Diff dieses Pakets heraus.
- Hängt ab von: 1
- Hash: a097c8d
- Modell: stärkste Stufe
- Effort: high

#### Abgleich am Code, Zug 0 (2026-09-05)

`git diff cdc5594..HEAD -- packages/twopoint5d/src/vertex-objects/` ist leer: die
Pakete 1 bis 4 haben dieses Verzeichnis nicht angefasst. Beide Findings stehen
unverändert an ihren Fundstellen.

| Finding | Fundstelle heute | Urteil |
| --- | --- | --- |
| MEM-011 | `GeometryAttributeSlots.ts:90-98` — der `else`-Zweig von `releaseRoute()` stellt das Attribut des Anspruchs darunter in den Slot und meldet kein `vacated`; `InstancedVOBufferGeometry.ts:181-187` — die Hygieneschleife in `attachInstancedPool()` löscht den `#vacatedSlots`-Eintrag, sobald der Name wieder belegt ist | unverändert, Zeilen verschoben. Der Leak ist reproduziert (Messung unten), die Empfehlung des Audits trägt ihn nicht |
| READ-005 | `VOBufferPool.ts:90` — `if (this.buffer != null)` über der Freigabeschleife; `buffer` ist als `VertexObjectBuffer` deklariert (Zeile 9) und der Konstruktor setzt es auf beiden Zweigen (Zeile 20 und 25) | unverändert, Zeile stimmt aufs Wort |

#### Die Messung, auf der dieses Paket steht

Zug 0 hat den Befund im Browser gegen den echten Renderer nachgestellt, statt ihn
aus der Quelle zu erschließen. Probe und Runner-Konfiguration liegen im
Arbeitsverzeichnis unter `probe/` und lassen sich mit
`npx web-test-runner --config <arbeitsdir>/probe/wtr.config.mjs` wiederholen
(Chromium, WebGPU nicht verfügbar, also WebGL2-Backend). Gemessen wurde
`renderer.info.memory.attributes` — der öffentliche Zähler, den `Attributes.update()`
hochzählt und `Attributes.delete()` herunter, backendunabhängig. Der Renderer legt
sich beim ersten Bild ein eigenes Attribut an; die Zahlen unten enthalten es.

| Szenario | nach dem Rendern | nach `dispose()` | |
| --- | --- | --- | --- |
| instanced-Geometrie, rendern, `dispose()` | 3 | 1 | sauber |
| Extra-Route mit eigenen Namen, rendern, detach, `dispose()` | 4 | 1 | sauber |
| dieselbe, mit zweitem Bild nach dem detach | 4 | 1 | sauber |
| zwei Routen auf einem Namen, rendern, obere detach, `dispose()` | 3 | **2** | ein Attribut bleibt |
| dieselbe, mit zweitem Bild nach dem detach | 4 | **2** | ein Attribut bleibt |

Zwei Dinge folgen daraus, und beide sind der Grund für den Zuschnitt:

1. **Wo ein Attributname über die Lebenszeit der Geometrie nur ein Attribut
   trägt, ist heute schon alles sauber.** Die Leih-Mechanik aus `#vacatedSlots`
   trägt: ein detach hinterlässt einen leeren Slot, `dispose()` stellt das
   Attribut für die Dauer des Dispose-Events zurück, der Renderer gibt es frei.
2. **Mehr als ein Attribut je Attributnamen ist nicht freizubekommen.** In
   three.js 0.185.1 gibt `Geometries.initGeometry()` einem `dispose`-Listener die
   Attribute aus `renderObject.getAttributes()` mit; `RenderObject.onGeometryDispose`
   hängt früher am selben Event und setzt den Cache vorher auf `null`, also wird
   die Liste aus der lebenden Geometrie neu aufgelöst — je Attributnamen, den der
   Shader liest, genau das Attribut, das gerade im Slot steht. Ein Slot fasst
   eines. Buchführung verschiebt nur, welches der beiden liegenbleibt; die
   Empfehlung des Audits (»das verdrängte Attribut gehört in die Liste der
   geräumten Slots«) läuft deshalb ins Leere.

Der Ausweg ist damit nicht, das verdrängte Attribut einzusammeln, sondern die
Verdrängung nicht zuzulassen. Das ist die Entscheidung des Nutzers im Kopf
dieses Plans.

#### Sechs Entscheidungen dieses Zuges

Getroffen mit dem Code und der Messung vor Augen, deshalb hier und nicht unter
»Entscheidungen«.

1. **Die Regel lautet: ein Slotname wird je Geometrie einmal vergeben.** Nicht
   »der Slot ist gerade belegt« — das ließe die zweite Hälfte des Lecks offen:
   eine Route anhängen, rendern, ablösen, unter demselben Attributnamen eine
   neue anhängen. Der Slot ist dann leer, das Attribut der ersten Route aber
   hochgeladen und nur noch über `#vacatedSlots` erreichbar; die neue Route
   nimmt ihm den einzigen Platz, an dem `dispose()` es zurückgeben könnte.
   Geprüft wird deshalb gegen alles, was diese Geometrie je in einem Slot
   hatte, nicht gegen den aktuellen Stand.
2. **Der Konstruktor bleibt ausgenommen.** Basis-Route, instanced-Route und die
   aus einer hereingereichten `BufferGeometry` kopierten Attribute dürfen
   weiterhin denselben Namen beanspruchen — `new InstancedVOBufferGeometry(pool,
   10, pool, 10)` und der `[pool, capacity, BufferGeometry]`-Zweig leben davon,
   und beide sind getestet. Der Grund ist kein Zugeständnis: bis der Konstruktor
   zurückkehrt, hat kein Attribut dieser Geometrie den Renderer gesehen, ein dort
   verdrängtes hält also keinen GPU-Buffer. Danach kann die Geometrie es nicht
   mehr wissen, und dann gilt die Regel.
3. **Falsch-positive Abweisungen werden in Kauf genommen.** Wer eine Route
   anhängt, nie rendert und sie wieder ablöst, bekommt beim nächsten Anhängen
   unter denselben Attributnamen einen Fehler, obwohl nichts lecken würde. Die
   Geometrie kann Uploads nicht sehen: `three` ruft in diesem Backend kein
   `onUploadCallback`, und `update()` sagt nichts über gezeichnete Bilder. Ein
   lauter Fehler an der Aufrufstelle ist der bessere Ausgang als ein GPU-Buffer,
   den niemand mehr findet.
4. **Derselbe Pool unter seinem eigenen Namen erneut anzuhängen wird ein
   No-op.** Heute läuft dieser Aufruf durch `#detachRoute()` und baut die
   Attribute neu — die alten sind damit verdrängt und hochgeladen, also genau
   der Leak. Der CHANGELOG verspricht für diesen Fall ohnehin »keeps everything
   it has«; das wird jetzt wörtlich wahr. Ein mitgegebenes `autoDispose` wird
   dabei weiterhin übernommen.
5. **Was durch die Regel tot wird, fällt raus.** Die Hygieneschleife in
   `attachInstancedPool()` kann nicht mehr feuern (ein geräumter Name wird nie
   wieder belegt), und der `replacement`-Parameter von `#detachRoute()` auch
   nicht (der einzige Aufrufer, der ihn belegte, kehrt jetzt vorher zurück).
   Beides wird entfernt statt stehengelassen. `releaseRoute()` selbst bleibt
   unverändert — der `else`-Zweig trägt weiter den Fall »instanced-Route über
   einem kopierten Attribut«, und dort ist er richtig.
6. **READ-005 läuft ohne eigenen Test mit.** Die Bedingung ist nachweislich tot;
   ihr Wegfall ändert kein Verhalten, und `VOBufferPool#dispose()` ist in
   `VertexObjectPool.spec.ts` bereits abgedeckt. Ein Test, der beweist, dass
   nichts passiert ist, beweist nichts.

#### Dateien: neun, keine zehnte

Alle Pfade relativ zu `packages/`, sofern nicht anders genannt.

1. `twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts` — ein privates Set,
   eine Abfrage, TSDoc
2. `twopoint5d/src/vertex-objects/attributeNamesOf.ts` — neu, eine Funktion
3. `twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts` — Guard, No-op,
   zwei Entfernungen, TSDoc
4. `twopoint5d/src/vertex-objects/VOBufferPool.ts` — READ-005, eine Zeile
5. `twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts` —
   neue Tests, umgeschriebene Tests
6. `twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts` — umgeschriebene Tests
7. `twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts` — ein
   umgeschriebener Test
8. `twopoint5d-testing/test/vertex-objects-dispose.test.js` — erweitert
9. `twopoint5d/CHANGELOG.md` — `### Changed`, `### Fixed`, ein `####`-Block unter
   `### Migration Guide`

`docs/resource-lifecycle.md` bleibt unangetastet: die Regel dort ist Ownership
und Verhalten nach `dispose()`, und beides ändert sich nicht. Der Absatz in
Abschnitt 2 über `attachInstancedPool(name, pool, {autoDispose})` beschreibt den
Übernahme-Schalter und bleibt richtig. `public-api.ts` bleibt unangetastet:
`GeometryAttributeSlots` und die neue Datei stehen nicht darin und sind intern.

#### Vorgehen

Reihenfolge einhalten: erst die roten Tests (Schritt 1), dann der Code (2 bis 5),
dann die vorhandenen Tests (6), dann der Browser-Test (7), dann CHANGELOG (8).

1. **Regressionstests zuerst, rot sehen, Ausgabe in den Report.** Diese vier
   fallen gegen den heutigen Code durch, in
   `vertex-buffers-geometry-updates.spec.ts`, im vorhandenen
   `describe('attachInstancedPool()')`:
   - eine Route, die einen Attributnamen der instanced-Route beansprucht, wird
     abgewiesen: `geometry.attachInstancedPool('extra', new VertexObjectPool<VO>(fooDesc, 10))`
     wirft. `fooDesc` gibt es in der Datei bereits.
   - ein Attributname, den eine abgelöste Route hatte, bleibt vergeben: `('extra',
     extraDesc)`, `detachInstancedPool('extra')`, dann `('extra', extraDesc)`
     erneut — wirft.
   - derselbe Pool unter einem zweiten Namen wird abgewiesen: `('extra',
     extraDesc)`, dann `('sameAgain', pool)` — wirft.
   - die Meldung nennt Klasse, den Namen des Aufrufs und die betroffenen Slots
     (`toThrow(/attachInstancedPool\("extra"\)/)` und `/"quux"/`).
   Dazu ein fünfter, der heute grün ist und die Zusage von Entscheidung 4
   festhält: derselbe Pool unter demselben Namen erneut angehängt lässt die
   Attribute stehen — `geometry.getAttribute('quux')` ist danach dasselbe Objekt
   wie davor. Heute baut der Aufruf sie neu, also ist auch dieser rot.
   Kommando: `cd packages/twopoint5d && pnpm vitest --run src/vertex-objects`.
   Der rote Lauf gehört im Wortlaut in den Report.

2. **`attributeNamesOf.ts` anlegen.** Eine Funktion, kein Export in
   `public-api.ts`:

   ```ts
   /**
    * The geometry attribute names a route to this pool puts into slots. Read from the same
    * two maps that {@link initializeAttributes} and {@link initializeInstancedAttributes}
    * walk, so the answer cannot drift from what they actually claim — a disposed pool has no
    * buffers left and therefore claims nothing.
    */
   export function attributeNamesOf(pool: VOBufferPool): string[]
   ```

   Rumpf: über `pool.buffer.buffers.values()`, je Buffer über
   `pool.buffer.bufferNameAttributes.get(buffer.bufferName)`, je Eintrag den
   Namen aus `pool.descriptor.attributes.get(bufAttr.attributeName).name` — beide
   Lookups über `expectDefined()` mit denselben Meldungstexten wie in
   `initializeInstancedAttributes.ts`.

3. **`GeometryAttributeSlots.ts`** — die Geometrie merkt sich, welche Slots sie
   je hatte:
   - ein Feld `readonly #everHeld = new Set<string>();`
   - `#claim()` trägt den Namen dort ein, bevor es den Anspruch ablegt. Weil
     `claimExisting()` durch dieselbe private Methode geht, zählen auch die aus
     einer hereingereichten `BufferGeometry` kopierten Attribute mit — sie
     gehören dem Aufrufer, aber freigeben könnte sie nur das `dispose()` dieser
     Geometrie, und auch sie stünden nach einer Verdrängung ohne Weg dorthin da.
   - eine Abfrage:

     ```ts
     /**
      * Which of `attrNames` this geometry has already had an attribute in. A slot is never
      * handed on: what a second attribute would push out of it could not be given back to the
      * renderer afterwards, so the caller is refused instead.
      */
     everHeld(attrNames: Iterable<string>): string[]
     ```
   - `releaseRoute()`, `claim()`, `claimExisting()` und `poolOf()` bleiben, wie
     sie sind. Der Klassenkommentar bekommt einen Satz: Ansprüche stapeln sich
     nur noch, soweit der Konstruktor sie anlegt.

4. **`InstancedVOBufferGeometry.ts`** — vier Eingriffe in `attachInstancedPool()`
   und zwei daneben:
   - Ganz vorn, vor allem anderen, der No-op aus Entscheidung 4:

     ```ts
     // the same pool taking its own name over again changes nothing about the slots, and
     // rebuilding the attributes would push the live ones off the geometry for good
     if (pool instanceof VertexObjectPool && this.extraInstancedPools.get(name) === pool) {
       if (options?.autoDispose !== undefined) {
         this.#extraInstancedPoolAutoDispose.set(name, options.autoDispose);
       }
       return pool;
     }
     ```
   - Danach wie bisher `ownsPool` bestimmen und den Pool erzeugen — aber
     `this.declareOwnedPool(extraPool)` wandert **hinter** den Guard: ein Wurf
     darf keinen Pool in `#ownedPools` zurücklassen, den `dispose()` später
     freigibt, obwohl er nie angehängt war.
   - Der Guard, vor `#detachRoute()`, damit ein Wurf die Geometrie unberührt
     lässt:

     ```ts
     // three.js frees a gpu buffer only through the dispose event of the geometry, and there
     // for exactly one attribute per name — the one sitting in the slot at that moment. An
     // attribute a second route pushes out of a slot can never be handed back, so the slot is
     // refused instead of leaking it
     const taken = this.#slots.everHeld(attributeNamesOf(extraPool));
     if (taken.length > 0) {
       throw new Error(
         `InstancedVOBufferGeometry#attachInstancedPool("${name}"): this geometry has already had an attribute in the slot ${taken
           .map((attrName) => `"${attrName}"`)
           .join(', ')}. An attribute slot belongs to one route for the life of the geometry — give this pool attribute names of its own, or build a new geometry.`,
       );
     }
     ```
   - Die Hygieneschleife über `#vacatedSlots` (heute Zeilen 181–187) entfällt
     ersatzlos.
   - `#detachRoute(name, replacement)` verliert den zweiten Parameter; die
     Bedingung `pool !== replacement` in Zeile 255 entfällt mit ihm, der
     TSDoc-Absatz darüber ebenso. Beide Aufrufer heißen danach
     `this.#detachRoute(name)`.
   - `#vacatedSlots`: der TSDoc-Satz »An entry lives until `dispose()` unless the
     same attribute name is filled again« stimmt nicht mehr — ein geräumter Name
     wird nie wieder belegt. Neu formulieren: der Eintrag lebt bis `dispose()`,
     und je Name gibt es höchstens einen.
   - TSDoc von `attachInstancedPool()`: ein `@throws`-Absatz mit der Regel, dem
     Grund in einem Satz und dem Ausweg (eigene Attributnamen), dazu der Satz
     über den No-op aus Entscheidung 4. Der Absatz »_Pro-Hint:_ It is also
     possible to attach a vertex-buffer-pool to several instanced geometries at
     the same time« bleibt richtig und bleibt stehen — mehrere Geometrien, nicht
     mehrere Namen an einer.
   - TSDoc von `detachInstancedPool()`: der Satz, dass die Slots dieser Route
     danach für die Lebenszeit der Geometrie vergeben bleiben und keine spätere
     Route sie bekommt.
   - TSDoc am Konstruktor (oder an der Klasse, wo der Ton besser passt): warum
     Basis-, instanced- und kopierte Attribute denselben Namen haben dürfen —
     Entscheidung 2, in zwei Sätzen.

5. **`VOBufferPool.ts`** — READ-005: `if (this.buffer != null)` in `dispose()`
   entfernen, die Schleife und `this.buffer.buffers.clear()` eine Ebene
   herausziehen. Der Kommentar in `toBuffersData()` (Zeile 110), der sich auf
   dieselbe Stelle beruft, bleibt richtig und bleibt stehen.

6. **Die vorhandenen Tests, die das alte Verhalten festhalten.** Sie gehören zu
   dieser Änderung, nicht in ein späteres Paket. Zug 0 hat sie durchgezählt; wer
   mehr findet, zieht sie mit. Maßstab ist immer: kollidiert ein angehängter Pool
   mit einem Namen, den die Geometrie schon hatte?
   - `VertexObjectPool.spec.ts`: `makePool()` liefert immer denselben Descriptor,
     und die Geometrien dort werden aus zwei solchen Pools gebaut — jeder
     Extra-Pool aus `makePool()` kollidiert also. Betroffen: »attachInstancedPool()
     holds the pool until detachInstancedPool() gives it back« (Zeile 600),
     »attaching under a name that is already taken releases the attachment of the
     pool it replaces« (635), »one pool attached under two names stays held until
     both names are gone« (664), »one pool attached under two names keeps its
     attributes while either name still holds it« (684), »the default instanced
     pool keeps its attributes when it is detached as an extra pool« (706),
     »dispose() releases an extra pool that it leaves untouched otherwise« (717).
     Die ersten beiden und der letzte prüfen etwas anderes als die Kollision und
     ziehen auf einen Pool mit eigenen Attributnamen um — der Nachbar-Test bei
     Zeile 623 zeigt, wie das aussieht. Die drei Tests über einen Pool unter zwei
     Namen prüfen genau die entfallene Fähigkeit: sie werden zu je einem Test,
     der die Abweisung festhält, mit dem Grund als Kommentar.
   - `vertex-buffers-geometry-updates.spec.ts`: »attaching over a name that is
     already taken disposes the geometry-built pool it replaces« (757) hängt
     zweimal `extraDesc` an und wird zu einem Abweisungs-Test; »a pool the
     geometry built stays its own when it is attached under a second name« (787)
     und »detachInstancedPool() keeps a pool that another route still reads«
     (867) ebenso; »a pool that outlives its detach stops belonging to the
     geometry« (801) hängt den Pool nach dem detach erneut an — das geht nur noch
     an einer frischen Geometrie, und der Test zieht dorthin um; »every pool of an
     attach/detach cycle under one name is released« (820) läuft in einer Schleife
     und wird zu einem Durchgang plus der Abweisung des zweiten; »a route that
     shares its typed arrays with another pool gives up only its own slots« (1144)
     und »two pools declaring the same attribute name keep the slot with the
     surviving route« (1163) bauen zwei Routen auf `quux` und werden zu
     Abweisungs-Tests; »an extra pool that declares an attribute name of the
     instanced pool feeds the slot it took« (1190) ist die Kollision in Reinform
     und wird zu dem Abweisungs-Test aus Schritt 1 — dann bleibt von ihm nur der
     alte Name, also entfällt er dort und lebt in Schritt 1 weiter.
     Unangetastet bleiben »attaching the same pool again under its own name keeps
     it alive« (766) und »a pool the geometry built stays its own when it is
     attached again under the same name« (777): Entscheidung 4 hält beide grün.
     »dispose() gives a slot back to the attribute of the geometry handed in«
     (1170) bleibt ebenfalls grün — das ist der Konstruktorfall aus Entscheidung 2.
   - `InstancedVertexObjectGeometry.spec.ts`: »empties all extra-instanced
     bookkeeping maps« (178) hängt denselben Descriptor unter `'a'` und `'b'` an.
     Der Test will die leeren Buchführungs-Maps sehen, nicht die Kollision: die
     zweite Anhängung bekommt einen zweiten Descriptor mit eigenem Attributnamen.
   - Ein Test, der nur noch mit einem Kommentar »das ging früher« Sinn ergibt,
     wird gelöscht statt umgeschrieben. Der Vorzustand steht in der Historie.

7. **Browser-Test** in `twopoint5d-testing/test/vertex-objects-dispose.test.js`,
   im vorhandenen `describe`. Er belegt die Zusage in der Währung, in der sie
   gilt — GPU-Puffer beim Renderer:
   - Ein Helfer nimmt die Grundlinie: einmal `display.renderer.render(scene, camera)`
     mit leerer Szene, damit der Renderer seine eigenen Attribute angelegt hat,
     danach `display.renderer.info.memory.attributes` merken. Verglichen wird
     immer gegen diese Grundlinie, nie gegen eine feste Zahl — Chromium fällt auf
     WebGL2 zurück, Firefox fährt WebGPU, und beide sollen dieselbe Aussage
     tragen.
   - »every attribute of a detached route reaches the renderer's free list«: die
     Geometrie aus `makeGeometryWithExtraRoute()`, rendern, `detachInstancedPool('extra')`,
     `dispose()` — der Zähler steht wieder auf der Grundlinie. Heute grün; der
     Test hält fest, dass die Leih-Mechanik trägt, und wäre ohne ihn die einzige
     ungesicherte Stelle des Pakets.
   - dasselbe mit einem zweiten Bild nach dem detach, bevor `dispose()` kommt
     (die Rolle des Materials wechselt dabei auf eines, das `extraOffset` nicht
     mehr liest — sonst kann die Geometrie nicht gezeichnet werden).
   - »a route may not take a slot another route filled«: an derselben Geometrie
     nach dem Rendern eine Route mit dem Attributnamen `instanceOffset` anhängen
     — der Aufruf wirft, die Geometrie zeichnet danach weiter, und ihr `dispose()`
     endet wieder auf der Grundlinie. Das ist das Szenario, das ohne diesen
     Commit ein Attribut zurücklässt.

8. **CHANGELOG.** Unter `[Unreleased]`:
   - `### Changed`: ein Absatz über die Regel — ein Attributslot gehört einer
     Route, `attachInstancedPool()` weist alles andere ab, der Konstruktor bleibt
     ausgenommen, derselbe Pool unter demselben Namen ist ein No-op.
   - `### Fixed`: ein Absatz über den GPU-Buffer, der bisher liegenblieb, mit dem
     Grund in einem Satz (three.js gibt je Attributnamen genau das Attribut frei,
     das beim Dispose-Event im Slot steht).
   - `### Migration Guide`: ein `####`-Block im Stil der vorhandenen, mit
     Vorher/Nachher-Codeblock und dem Ausweg — jeder Route eigene Attributnamen
     geben oder eine eigene Geometrie bauen. Der Skill `updating-changelog` gilt.
   - Kein Verweis auf `docs/resource-lifecycle.md`: dieses Paket ändert weder
     Ownership noch das Verhalten nach `dispose()`.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `test:browser` ist hier nicht optional: die Zusage dieses Pakets ist eine über
  GPU-Puffer, und Vitest läuft ohne Renderer. `test:ci` trägt die drei
  Spec-Dateien, `typecheck` deckt sie mit ab (`pnpm build` lässt sie aus). In
  Zug 0 gegen den heutigen Stand nicht erneut gefahren — die Baseline im Kopf
  dieses Plans ist von heute und vollständig grün, und der Browser-Lauf ist in
  Paket 3 und 4 zuletzt echt durchgelaufen.
- Commit: `fix(vertex-objects): keep an attribute slot with one route for the life of a geometry`
- Ergebnis: 2 Runden · MEM-011 und READ-005 behoben · ein Attributslot dieser
  Geometrie trägt über ihre Lebenszeit genau ein `THREE.BufferAttribute`;
  `attachInstancedPool()` weist eine Route ab, die einen je belegten Slotnamen
  beanspruchen würde, der Konstruktor bleibt ausgenommen, derselbe Pool unter
  demselben Namen ist ein No-op · Regressionstests
  `a route that would take an attribute slot of the instanced pool is refused`,
  `an attribute name that a detached route had stays taken`,
  `the same pool under a second name is refused`,
  `the refusal names the class, the call and the slots it is about`,
  `the same pool under the same name again leaves the attributes it built where they are`
  (alle fünf vor dem Fix rot, 5 von 155) · dazu der Browser-Test
  `a route may not take a slot another route filled`, gegen ein Build mit
  entkerntem Guard gemessen: `expected 2 to equal 1`, deckungsgleich mit der
  Messung des Zug 0 · 17 vorhandene Tests, die das alte Verhalten festhielten,
  umgeschrieben oder gelöscht · Verify exit 0, `test:ci` und `test:browser`
  zusätzlich mit `--skip-nx-cache` echt nachgefahren
  (`paket-5.verify.log`) · klein und offen geblieben: der Zweig
  `if (pool != null && !this.#attachments.holds(pool))` in
  `InstancedVOBufferGeometry.ts:286` ist erreichbar — über einen Pool ohne
  Attribute oder einen vor dem Anhängen entsorgten, die beide leer durch den
  Guard kommen —, hat aber keinen Test; zwei Reviewer haben ihn unabhängig für
  tot gehalten, der zweite hat die Erreichbarkeit am laufenden Code nachgestellt
- Nebenbefunde: → Queue (1)
- Folgen: —
- Schnittstellen: `InstancedVOBufferGeometry#attachInstancedPool(name, pool, options?)`
  wirft, wenn der Pool einen Attributnamen mitbringt, in dem diese Geometrie schon
  einmal ein Attribut hatte — auch dann, wenn die Route, die ihn hatte, längst
  abgelöst ist. Zwei Routen einer Geometrie auf einen Pool sind damit nicht mehr
  herstellbar, solange der Pool Attribute stellt. Derselbe Pool unter demselben
  Namen erneut angehängt ist ein No-op, der ein mitgegebenes `autoDispose`
  übernimmt und die gebauten Attribute stehen lässt. Der Konstruktor ist
  ausgenommen: `new InstancedVOBufferGeometry(pool, 10, pool, 10)` und der
  `[pool, capacity, BufferGeometry]`-Zweig laufen unverändert ·
  `attributeNamesOf(pool)` — neue Modulfunktion in
  `src/vertex-objects/attributeNamesOf.ts`, intern, nicht in `public-api.ts` ·
  `GeometryAttributeSlots#everHeld(attrNames)` — neue Methode, intern

**MEM-011 · medium · packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.ts:92-95, InstancedVOBufferGeometry.ts:174-178** — Ein Attribut, das aus seinem Slot verdrängt wird, behält seinen GPU-Buffer

Gibt eine Route ihren Attribut-Slot auf und liegt darunter noch der Anspruch
einer anderen, stellt `releaseRoute()` deren Attribut in den Slot und meldet ihn
nicht als geräumt; dieselbe Hygieneschleife in `attachInstancedPool()` verwirft
den Eintrag, sobald der Name wieder belegt ist. Das verdrängte Attribut erreicht
damit nie `destroyAttribute()` und sein GPU-Buffer hängt am Backend, wo kein GC
ihn erreicht. Gemessen über `renderer._attributes.has(attr)` in Chromium
(WebGL2-Fallback) und Firefox (WebGPU), Zeile für Zeile identisch: mit Detach
bleibt das obere Attribut beim Renderer, ohne Detach wird es freigegeben. Ein
stilles Leck, kein Wurf — es braucht zwei Routen, die denselben Attributnamen
deklarieren, was seit der Einführung des Anspruchsstapels ausdrücklich erlaubt
und dokumentiert ist.

Empfehlung: Den Slot-Wechsel als Freigabe des verdrängten Attributs behandeln:
das `BufferAttribute`, das den Slot verlässt, gehört in die Liste der geräumten
Slots, damit `dispose()` es erreicht. Der Bereich verdient einen eigenen Lauf —
der Anspruchsstapel und der Dispose-Pfad greifen an mehreren Stellen ineinander.

**READ-005 · info · packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:90** — Ein toter Guard in VOBufferPool#dispose

`if (this.buffer != null)` kann nicht falsch werden: `buffer` ist als
`VertexObjectBuffer` deklariert und der Konstruktor setzt es auf beiden Zweigen.

Empfehlung: Die Bedingung streichen.

### [x] 6. map2d: TileBox-Pool räumen und Dispose-Pfade absichern

- Findings: MEM-012 (medium), TEST-006 (medium, der map2d-Anteil)
- Ziel: Der TileBox-Pool von `CameraBasedVisibility` trägt nach jeder
  Neuberechnung genau die Kacheln, die diese Neuberechnung besucht hat, und
  wächst damit nicht mehr über die Lebenszeit der Map. `Map2D`,
  `Map2DTileRenderer` und `TileSpritesMaterial` halten den Ownership- und den
  Idempotenz-Teil der Richtlinie und belegen ihn mit Dispose-Tests nach dem
  Muster aus Abschnitt 8.
- Bereich: `packages/twopoint5d/src/map2d/`, `packages/twopoint5d/CHANGELOG.md`
- Hinweis aus Paket 2 (2026-09-05): `TexturedSpritesMaterial#dispose()` räumt dort
  seine beiden optionalen Member (`colorMap`, `texCoordsNode`) auf `undefined`,
  weil Abschnitt 4 der Richtlinie das für einen Typ `T | undefined` verlangt.
  `TileSpritesMaterial#colorMap` hat dieselbe Form und dasselbe `dispose()` ohne
  diesen Schritt. Wer hier den Dispose-Test schreibt, entscheidet die Stelle mit —
  entweder gleichziehen oder begründen, warum nicht. **Beantwortet in Zug 0:
  gleichgezogen, Schritt 7.**
- Hängt ab von: 1
- Hash: 8940644
- Modell: stärkste Stufe
- Effort: high

#### Abgleich am Code, Zug 0 (2026-09-05)

`git log cdc5594..HEAD -- packages/twopoint5d/src/map2d/` ist leer: die Pakete 1
bis 5 haben dieses Verzeichnis nicht angefasst. Beide Findings stehen unverändert
an ihren Fundstellen.

| Finding | Fundstelle heute | Urteil |
| --- | --- | --- |
| MEM-012 | `CameraBasedVisibility.ts:111` — `readonly #tileBoxPool = new Map<string, TileBox>()`; gefüllt in `acquireTileBox()` (Zeile 241–251), gelesen in `invalidateTileCoordsCacheIfChanged()` (Zeile 155), an keiner Stelle geleert oder begrenzt | unverändert, Zeile 110 → 111. Jede je besuchte Kachelkoordinate behält ihren Slot samt `coords`, `box`, `frustumBox`, `centerWorld` und `Map2DTileCoords` bis zum Ende der Instanz |
| TEST-006, map2d-Anteil | `Map2D.ts:129`, `Map2DTileRenderer.ts:80`, `TileSprites/TileSpritesMaterial.ts:97` — drei `dispose()`-Methoden im Verzeichnis, keine davon in einer Spec. `grep -rl "describe('dispose" src/map2d` findet nichts | unverändert |

Der Abgleich hat drei Stellen aufgedeckt, an denen der heutige Code gegen die
Richtlinie aus Paket 1 läuft. Sie gehören zu diesem Paket: sie sind genau das,
was der Dispose-Test nach Abschnitt 8 aufdeckt, wenn er geschrieben wird.

| Stelle | Regel | Was dasteht |
| --- | --- | --- |
| `Map2D.ts:132` | Abschnitt 2 — freigegeben wird nur, was die Instanz selbst gebaut hat | `dispose()` ruft `renderer.dispose()` auf jedem Renderer. Ein Renderer kommt ausschließlich über `addTileRenderer()` herein und gehört dem Aufrufer |
| `Map2DTileRenderer.ts:80-86` | Abschnitt 3 — `dispose()` darf beliebig oft gerufen werden | Der zweite Aufruf läuft über den Getter `#factory` in `expectDefined(null, …)` und wirft `expected the tile factory of this renderer, which has been disposed to be defined` |
| `Map2DTileRenderer.ts:37-78` | Abschnitt 4 — nach `dispose()` gilt eine der drei Reaktionen, und ein `TypeError` aus der Tiefe der Klasse ist keine davon | `addTile()` und `reuseTile()` greifen über `this.tileFactory!` auf `null` zu und werfen einen `TypeError`; `endUpdatingTiles()` wirft über `#factory` |

#### Die Falle, die dieses Paket ein Review kosten wird, wenn niemand sie nennt

Im CHANGELOG steht unter `[Unreleased]` → `### Changed` bereits ein Absatz, der
das heutige Verhalten von `Map2DTileRenderer` als gewollt beschreibt: »… `addTile()`
und `reuseTile()` fail with a `TypeError` there … none of the four guards the
field: for the three per-tile methods such a check would run on a path the tile
streamer walks on every update …«. Das ist die Entscheidung eines früheren Laufs,
und sie fällt mit diesem Paket. Der Absatz wird **umgeschrieben**, nicht ergänzt —
ein `[Unreleased]`-Eintrag darf das, ein veröffentlichter nicht.

Dasselbe Muster hat Paket 2 in seiner Runde 1 einen Durchgang gekostet: zwei
`[Unreleased]`-Absätze versprachen weiter, was der Commit gerade abgeschafft hatte.

#### Sechs Entscheidungen dieses Zuges

Getroffen mit dem Code vor Augen, nicht vom Nutzer. Sie stehen hier und nicht im
Kopf des Plans.

1. **Der Pool wird an derselben Stelle geräumt, an der die Sichtbarkeit neu
   berechnet wird** — die zweite der beiden Varianten aus der Empfehlung. Am Ende
   von `findVisibleTiles()` fällt jeder Slot, dessen Id nicht in `#visitedIds`
   steht. Damit gilt eine Invariante, die sich in einem Satz aufschreiben und an
   der Kante testen lässt: der Pool trägt die Kacheln der letzten Neuberechnung
   und keine andere.

   Gegen eine Obergrenze mit Verdrängung spricht, dass sie eine Zahl braucht, die
   niemand herleiten kann, und eine unscharfe Zusage gibt (»höchstens das
   Vierfache des Arbeitssatzes«). Der GC-Einwand trägt hier wenig: `#visitedIds`
   umfasst die sichtbaren Kacheln **samt ihrem Achter-Nachbarring**, das ist bereits
   eine Kachel Hysterese, und `Map2DTileStreamer.update()` legt daneben ohnehin je
   Frame ein `new Vector3(…)` an (siehe »Offene Befunde«). Zeigt eine Messung
   später Druck am nachlaufenden Rand, ist eine LRU-Schranke eine lokale Änderung
   hinter derselben Invariante.

2. **Zwei Id-Räume, und sie sehen sich nicht ähnlich.** `#tileBoxPool` und
   `#visitedIds` sind beide über `toBoxId(x, y)` = `` `${x},${y}` `` verschlüsselt.
   `#previousTilesById` dagegen läuft über `Map2DTileCoords.createID(x, y)` =
   `` `y${y.toString(16)}…` ``. Wer beim Räumen den falschen der beiden nimmt,
   leert den Pool bei jedem Frame vollständig, und kein vorhandener Test schlägt
   an — die Ergebnisse bleiben richtig, nur die Wiederverwendung ist weg.

3. **Kein neuer öffentlicher Zugang für den Test.** Ein Getter auf die Poolgröße
   wäre API, auf die kein Aufrufer je verzweigt. Die Invariante ist ohne ihn
   prüfbar: ein `TileBox` aus `visibility.visibles` ist der Pool-Slot selbst, also
   belegt Objekt-Identität an der Kante, was der Pool behalten hat. Der
   Regressionstest steht in Schritt 2.

4. **`Map2D#dispose()` gibt nichts frei.** Unter Abschnitt 2 bleibt nichts übrig,
   was es freigeben dürfte: Renderer und Visibilitor kommen von außen, und der
   `Map2DTileStreamer` — selbst gebaut, wenn der Konstruktor seinen Vorgabewert
   nimmt — hat weder `dispose()` noch eine Ressource, die eines bräuchte. Es
   löst also die Renderer ab und verlässt den Szenengraphen. Kein
   Übernahme-Schalter (Abschnitt 2 verbietet ihn ausdrücklich), und **kein
   `Map2DTileStreamer#dispose()` erfinden**.

5. **Kein `#disposed`-Flag auf `Map2D`, keins auf `Map2DTileRenderer`.** Bei
   `Map2D` ist die Idempotenz nach Abschnitt 3 »by construction«: ein zweiter
   Durchgang läuft über ein leeres `Set`, und `removeFromParent()` prüft auf einen
   fehlenden Vater. Bei `Map2DTileRenderer` trägt das vorhandene öffentliche Feld
   `tileFactory` den Zustand bereits — `null` heißt entsorgt. Ein zweites Feld
   daneben wäre dieselbe Wahrheit an zwei Orten. Aus demselben Grund bekommt
   keine der beiden Klassen einen `isDisposed`-Getter: Abschnitt 3 will ihn dort,
   wo ein Aufrufer verzweigen muss, und `tileFactory` beantwortet die Frage schon.

6. **`CameraBasedVisibility` bekommt kein `dispose()`.** Es steht in keinem
   Aufrufpfad, der eines rufen dürfte: ein Visibilitor wird über
   `Map2D#visibilitor` hereingereicht und gehört damit dem Aufrufer,
   `IMap2DVisibilitor` deklariert keines, und `Map2DTileStreamer` ruft keines. Mit
   Schritt 3 fällt außerdem der Grund weg, aus dem jemand eines wollen würde. Das
   ist zugleich die Antwort für Paket 7, damit die Frage dort nicht neu aufgeht.

- Dateien:
  `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` — Schritt 3 ·
  `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts` — Schritt 1 und 2 ·
  `packages/twopoint5d/src/map2d/Map2D.ts` — Schritt 4 ·
  `packages/twopoint5d/src/map2d/Map2D.spec.ts` — neu, Schritt 1 und 9 ·
  `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts` — Schritt 5 und 6 ·
  `packages/twopoint5d/src/map2d/Map2DTileRenderer.spec.ts` — neu, Schritt 1 und 9 ·
  `packages/twopoint5d/src/map2d/TileSprites/TileSpritesMaterial.ts` — Schritt 7 ·
  `packages/twopoint5d/src/map2d/TileSprites/TileSpritesMaterial.spec.ts` — neu, Schritt 1 und 9 ·
  `packages/twopoint5d/CHANGELOG.md` — Schritt 8.
  Neun Dateien, keine zehnte.

- Vorgehen:

  1. **Zuerst die roten Tests, alle in einem Zug.** Sie sind der Nachweis, und der
     Report zeigt ihre Ausgabe im roten Lauf, nicht die Behauptung, sie seien rot
     gewesen. Es sind fünf:
     - `CameraBasedVisibility.spec.ts` — der Pool-Test aus Schritt 2.
     - `Map2DTileRenderer.spec.ts` — `is safe to call twice` (heute: `Error`).
     - `Map2DTileRenderer.spec.ts` — `behaves as documented after dispose()`
       (heute: `TypeError` aus `addTile()`).
     - `Map2D.spec.ts` — `does NOT dispose a tile renderer that was handed in`
       (heute: `dispose()` wird gerufen).
     - `TileSpritesMaterial.spec.ts` — `behaves as documented after dispose()`,
       Teil `expect(material.colorMap).toBeUndefined()` (heute: die Textur steht
       noch da).

  2. **Der Regressionstest für den Pool**, in `CameraBasedVisibility.spec.ts`
     unter dem vorhandenen `describe('computeVisibleTiles()')`, benannt
     `drops the pooled TileBox of a tile that is no longer visited`:
     - Kamera aus `makeTopDownCamera()`, `tileCoords` wie in den Nachbartests.
     - Frame 1 auf `[0, 0]` rechnen, danach aus `visibility.visibles` die
       `TileBox`-Objekte je `id` festhalten (dieselbe Technik wie der vorhandene
       Test `low-GC: subsequent non-cached calls reuse the same TileBox objects`,
       Zeile 202 ff.).
     - Mit demselben `visibility` mehrere Frames weit wegfahren — der Mittelpunkt
       wandert in Schritten von mehreren Kachelbreiten, bis keine Kachel des
       ersten Frames mehr sichtbar ist. `tileWidth` ist 100; `[4000, 0]` und
       `[8000, 0]` reichen mit Abstand. Zwischenschritt prüfen: der Schnitt der
       Id-Mengen aus Frame 1 und dem letzten Frame ist leer.
     - Zurück auf `[0, 0]` rechnen. Jedes `TileBox` in `visibility.visibles`, dessen
       `id` im Frame 1 vorkam, muss ein **anderes Objekt** sein als das dort
       festgehaltene: `expect(box).not.toBe(warmBoxes.get(box.id))`.
     - Vor der Änderung liefert der Pool dieselben Objekte zurück und der Test ist
       rot; das ist genau die Aussage »der Pool hat sie nie losgelassen«.
     - Der vorhandene Test aus Zeile 202 bleibt Wort für Wort stehen und grün. Er
       ist die Gegenprobe: was besucht bleibt, wird weiter wiederverwendet. Wer ihn
       anfasst, um den neuen grün zu bekommen, hat den Fix falsch gebaut.

  3. **`CameraBasedVisibility.ts` — den Pool räumen.** In `findVisibleTiles()`,
     nach der `while`-Schleife über `#nextStack` (heute Zeile 294–348) und vor
     `this.visibles.sort(sortByDistance)`:

     ```ts
     // The pool exists to let the next frame mutate the same shells instead of allocating
     // new ones — that pays off only for a slot the next frame comes back to. A slot that
     // was not visited this time keeps a Box3, a Vector3 and a Map2DTileCoords alive for a
     // tile the camera has left behind, so it goes.
     for (const id of this.#tileBoxPool.keys()) {
       if (!this.#visitedIds.has(id)) {
         this.#tileBoxPool.delete(id);
       }
     }
     ```

     Beides sind `toBoxId`-Schlüssel — siehe Entscheidung 2. Aus einer `Map` während
     der Iteration über ihre eigenen Schlüssel zu löschen ist in JavaScript
     definiert und sicher.

     Den Klassenkommentar über `#tileBoxPool` (Zeile 109–110) um die Invariante
     ergänzen: der Pool trägt die Kacheln der letzten Neuberechnung. Der Kommentar
     sagt, was gilt, nicht was vorher galt.

     Sonst nichts an dieser Datei: kein `dispose()`, keine Obergrenze, kein neuer
     Getter, keine Änderung an `acquireTileBox()`.

  4. **`Map2D.ts` — Ownership und Szenengraph.** `dispose()` (Zeile 129–134) wird zu:

     ```ts
     dispose(): void {
       // this map is a scene-graph node itself: it goes before it lets its renderers go,
       // so nothing reaches a half-emptied group in the next frame
       this.removeFromParent();

       for (const renderer of this.#renderers) {
         this.removeTileRenderer(renderer);
       }
     }
     ```

     Der Aufruf `renderer.dispose()` fällt ersatzlos weg. Dazu ein TSDoc-Block über
     `dispose()`, der nach Abschnitt 4 sagt, was danach gilt: die Methode gibt
     nichts frei — Renderer, Visibilitor und ein hereingereichter
     `Map2DTileStreamer` gehören dem Aufrufer, und wer einen Renderer entsorgt
     haben will, entsorgt ihn selbst; die Map nimmt jeden Renderer ab und verlässt
     den Szenengraphen; jedes übrige Member antwortet weiter wie zuvor, weil nichts
     freigegeben wurde; ein zweiter Aufruf tut nichts.

  5. **`Map2DTileRenderer.ts` — Idempotenz.** `dispose()` bekommt am Kopf den
     Wächter auf das Feld, das den Zustand ohnehin trägt:

     ```ts
     dispose(): void {
       const tileFactory = this.tileFactory;
       if (tileFactory === null) return;

       tileFactory.removeFromNode(this.node);
       this.tileFactory = null;
       // …
     }
     ```

  6. **`Map2DTileRenderer.ts` — die sechs Zyklus-Methoden nach `dispose()`.**
     `beginUpdatingTiles()`, `addTile()`, `reuseTile()`, `removeTile()`,
     `clearTiles()` und `endUpdatingTiles()` werden nach Abschnitt 4, Reaktion 3
     zu stillen No-ops. Das Muster ist überall dasselbe und ersetzt die heutigen
     `this.tileFactory!`:

     ```ts
     const tileFactory = this.tileFactory;
     if (tileFactory === null) return;
     ```

     — eine vorhersagbare Verzweigung auf einem monomorphen Feld, an der Stelle,
     an der heute ohnehin ein Map-Lookup und ein `createTile()` stehen. Der Getter
     `#factory` und, falls dadurch unbenutzt, der Import von `expectDefined`
     fallen weg; kein toter Code bleibt liegen. Der Kommentar über `#factory`
     (Zeile 21–22) geht mit ihm.
     `beginUpdatingTiles()` erreicht die Factory heute nicht und braucht den
     Wächter trotzdem: es schreibt `this.node.position`, und das ist eine Mutation
     an einem entsorgten Renderer.
     Das TSDoc über `tileFactory` (Zeile 14–18) bleibt in der Sache richtig und
     wird um den Satz ergänzt, dass jede der sechs Methoden nach `dispose()`
     nichts tut. `node` behält sein `Object3D`; die Factory hat seinen Inhalt
     herausgenommen.

  7. **`TileSprites/TileSpritesMaterial.ts` — mit `TexturedSpritesMaterial`
     gleichziehen.** `dispose()` gibt die Referenz auf die `colorMap` auf, solange
     ihr Signal noch lebt:

     ```ts
     override dispose() {
       // the reference is given up while its signal is still live — a write after
       // SignalGroup.delete() would land in a destroyed signal and notify nobody
       this.#colorMap.set(undefined);

       SignalGroup.delete(this);
       super.dispose();
     }
     ```

     Dazu TSDoc an Getter und Setter von `colorMap`, im Wortlaut der Vorlage in
     `TexturedSpritesMaterial.ts:52` und `:57`. Die drei Node-Signale
     (`#vertexPositionNode`, `#instancePositionNode`, `#quadSizeNode`) bleiben
     unangetastet: sie sind `Node<T>` typisiert, nicht `T | undefined`, und fallen
     damit unter keine Regel aus Abschnitt 4 — genauso hält es die Vorlage.
     Die Textur selbst wird nicht entsorgt, sie kommt über Optionen oder Setter
     herein.

  8. **`CHANGELOG.md`**, unter `[Unreleased]`, nach dem Skill `updating-changelog`:
     - `### Changed`: der vorhandene Absatz zu `Map2DTileRenderer#tileFactory` wird
       ersetzt — er beschreibt heute den `TypeError` und den Fehler beim zweiten
       `dispose()` als gewollt. Der neue Text sagt, was ab jetzt gilt.
     - `### Changed`: ein Absatz zu `Map2D#dispose()` — gibt nichts frei, nimmt
       jeden Renderer ab, verlässt den Szenengraphen, und ein hereingereichter
       Renderer bleibt Sache des Aufrufers. Mit dem Verweis auf
       `docs/resource-lifecycle.md` im Stil der Schwesterabsätze.
     - `### Changed`: ein Absatz zu `TileSpritesMaterial#dispose()` — `colorMap`
       antwortet danach `undefined`, die Textur selbst wird nicht freigegeben.
     - `### Fixed`: der TileBox-Pool von `CameraBasedVisibility` trägt nach jeder
       Neuberechnung nur noch die dabei besuchten Kacheln.
     - `### Migration Guide`: ein `####`-Block im Stil der vorhandenen, mit
       Before/After. Der Fall, der ohne Compilerfehler durchgeht, ist
       `map2d.dispose()` bei einem Aufrufer, der sich darauf verlassen hat, dass
       seine `Map2DTileRenderer` dabei mit entsorgt werden — nach dieser Änderung
       entsorgt er sie selbst. Der zweite Fall ist die Umkehr des `TypeError`:
       ein `try`/`catch` um einen Aufruf auf einem entsorgten Renderer ist ab jetzt
       überflüssig, kein Fehler kommt mehr.
     - Die Konventionen des Laufs gelten auch hier: keine Finding-IDs, und kein
       Rückblick auf den Vorzustand außerhalb der Before/After-Blöcke, die genau
       dafür da sind.

  9. **Die Dispose-Specs**, drei neue Dateien nach dem Muster aus Abschnitt 8 der
     Richtlinie. Vitest läuft in diesem Repo **ohne DOM** (siehe den Hinweis unter
     Paket 7) — alle drei Klassen kommen ohne aus: `Map2D` ist ein `THREE.Group`,
     `Map2DTileRenderer` hält ein `Object3D`, und `TileSpritesMaterial` ist ein
     `NodeMaterial`, für den `TexturedSpritesMaterial.spec.ts` bereits belegt, dass
     er unter Node konstruiert.
     Welche Assertion wo trägt, und was ausdrücklich fehlt — eine weggelassene
     Assertion bekommt eine Kommentarzeile, die sagt warum, so wie es
     `TexturedSpritesMaterial.spec.ts:16-17` vormacht:

     | | `Map2D` | `Map2DTileRenderer` | `TileSpritesMaterial` |
     | --- | --- | --- | --- |
     | (a) selbst gebaute Ressource | entfällt — baut keine | entfällt — baut keine | entfällt — baut keine |
     | (b) hereingereichte bleibt unberührt | Renderer: `dispose` bespitzeln, `called` ist `false` | Factory: `dispose` gibt es dort nicht; stattdessen belegen, dass `removeFromNode` genau einmal läuft und die Factory selbst unangetastet bleibt | `colorMap`-Textur über Konstruktor **und** über Setter, je `dispose` bespitzeln |
     | (c) Verhalten nach `dispose()` | Renderer abgelöst (`streamer.renderers.size === 0`, `map.children` leer), kein Vater mehr, `tileStreamer` antwortet weiter | `tileFactory === null`; die sechs Methoden werfen nicht und tun nichts | `colorMap` ist `undefined`, die drei Node-Getter behalten ihren Knoten |
     | (d) zweiter Aufruf | wirft nicht, löst nichts erneut ab | wirft nicht, `removeFromNode` bleibt bei einem Aufruf | wirft nicht |
     | (e) keine Signale/Effects übrig | entfällt — keine | entfällt — keine | trägt: vier Signale und zwei Effects, gemessen mit `getSignalsCount()`/`getEffectsCount()` vor dem Konstruktor |

     Für `Map2D` und `Map2DTileRenderer` wird der Renderer beziehungsweise die
     Factory als schlichtes Objektliteral gebaut, wie es
     `Map2DTileStreamer.spec.ts:38-47` bereits vormacht — kein `TileSpritesFactory`,
     der eine Textur und einen Renderer nach sich zöge. Spies auf Methoden des
     Prüflings über `createSandbox()` aus `sinon` mit
     `afterEach(() => sandbox.restore())`.

  10. **Kein Browser-Test.** Dieses Paket ändert nicht, was `dispose()` mit
      GPU-Puffern tut, sondern wer es ruft und was danach gilt; beides ist mit
      Spies unter Vitest vollständig sichtbar. `Map2DTileRenderer#dispose()` gibt
      keinen Puffer frei, es nimmt einen Knoten aus einem `Object3D`, und
      `TileSpritesMaterial#dispose()` behält seinen Weg durch `super.dispose()`
      unverändert. Dieselbe Begründung wie bei Paket 2. In
      `packages/twopoint5d-testing/` liegt heute kein map2d-Test, und es kommt
      keiner dazu.

  11. **Sonst nichts.** Keine Änderung an `Map2DTileStreamer`, an `HelpersManager`,
      an `CameraBasedVisibilityHelpers`, an `RectangularVisibilityArea`, an
      `TileSpritesFactory`, an `TileSprites`, an `TileSpritesGeometry`, an
      `types.ts`, an `public-api.ts`, an `packages/twopoint5d-testing/` oder am
      Lookbook. Kein Aufrufer im Repo ruft heute `map2d.dispose()`
      (`grep -rn "\.dispose()" apps/lookbook/src` nachgesehen), die Änderung aus
      Schritt 4 zieht also keine Anpassung nach sich.
      Was beim Lesen dieser Dateien auffällt und nicht hierher gehört, wird als
      Nebenbefund mit Datei und Zeile gemeldet, nicht behoben. Drei stehen bereits
      unter »Offene Befunde«, aus Zug 0; sie sind nicht noch einmal zu melden.

#### Review-Fokus

- Räumt Schritt 3 über den richtigen Id-Raum? `#tileBoxPool` und `#visitedIds`
  laufen über `toBoxId`, `#previousTilesById` über `Map2DTileCoords.createID`. Der
  falsche Schlüssel leert den Pool bei jedem Frame vollständig, ohne dass ein
  einziger Test rot wird — die Ergebnisse bleiben richtig, nur die
  Wiederverwendung ist weg. Der Test aus Zeile 202 ist die einzige Wache davor;
  steht er unverändert da und ist er grün?
- Waren die fünf Tests aus Schritt 1 vor der Änderung rot? Der Report zeigt die
  Ausgabe, nicht die Behauptung.
- Gibt irgendein `dispose()` in diesem Diff etwas frei, das die Instanz nicht
  gebaut hat? Und gibt es umgekehrt etwas auf, das sie behalten müsste?
- Steht im CHANGELOG noch ein `[Unreleased]`-Satz, der das alte Verhalten von
  `Map2DTileRenderer` verspricht? Das ist die Stelle, an der dieses Paket am
  wahrscheinlichsten eine Runde verliert.
- Trägt der Migration Guide den Fall `map2d.dispose()`? Das ist die Änderung, die
  einem Aufrufer ohne Compilerfehler durchgeht: sein Renderer wird ab jetzt nicht
  mehr mit entsorgt.
- Ist jede weggelassene Assertion aus dem Muster von Abschnitt 8 kommentiert, oder
  fehlt sie einfach?
- Ist toter Code aus Schritt 6 wirklich weg — `#factory`, sein Kommentar, und der
  Import von `expectDefined`, falls er unbenutzt wurde?

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci` — `typecheck` deckt die
  Specs mit ab (`pnpm build` lässt sie aus) und fährt zusätzlich `astro check`
  über den Lookbook, dessen drei map2d-Demos `Map2D`, `Map2DTileRenderer` und
  `TileSpritesFactory` benutzen; das ist der Regressionsteil für die Signaturen.
  `test:browser` bleibt draußen, Begründung in Schritt 10. In Zug 0 gegen den
  heutigen Stand erprobt, Exit 0 in 7,6 s (Nx-Cache; nach der Änderung laufen die
  Tests wirklich).
- Commit: `fix(map2d): bound the tile box pool and give the map2d dispose paths a contract`
- Ergebnis: 2 Runden · MEM-012 behoben — der Sweep steht in
  `CameraBasedVisibility.ts:351-359`, nach der `while`-Schleife über `#nextStack`
  und vor dem `sort`, und läuft über den `toBoxId`-Id-Raum · TEST-006
  (map2d-Anteil) erfüllt — drei neue Specs `Map2D.spec.ts`,
  `Map2DTileRenderer.spec.ts`, `TileSprites/TileSpritesMaterial.spec.ts` nach
  Abschnitt 8, jede weggelassene Assertion mit Begründung auskommentiert · die
  drei Richtlinienverstöße aus dem Abgleich ebenfalls behoben
  (`Map2D.ts:137-145`, `Map2DTileRenderer.ts:102-104`, `:29-92`) ·
  Regressionstests, alle vor dem Fix rot: `drops the pooled TileBox of a tile
  that is no longer visited`, `is safe to call twice`, zweimal `behaves as
  documented after dispose()` (Renderer und Material), `does NOT dispose a tile
  renderer that was handed in`, `behaves as documented after dispose()` (Map2D) —
  sechs statt der geplanten fünf, der sechste deckt das fehlende
  `removeFromParent()` · die Gegenprobe `low-GC: subsequent non-cached calls
  reuse the same TileBox objects` steht Wort für Wort unverändert und grün ·
  Runde 1 schloss drei kleine Doku-Befunde: eine Migrations-Überschrift, die das
  Gegenteil ihres eigenen Blocks sagte, ein TSDoc, das das Fallenlassen der
  Kacheln verschwieg, und eine Pool-Invariante, die eine Kante schärfer zog, als
  der Code sie hält · offen geblieben, `klein`: `CHANGELOG.md:94` fehlt ein
  Artikel (»the tiles that run visited«)
- Nebenbefunde: → Queue (3)
- Folgen: keine — kein Aufrufer im Repo ruft `map2d.dispose()`, keine Signatur
  hat sich geändert, `packages/twopoint5d-testing/` enthält keinen map2d-Test
- Schnittstellen: `Map2D#dispose()` gibt nichts frei — es nimmt jeden Renderer
  über `removeTileRenderer()` ab und ruft `removeFromParent()`; ein
  hereingereichter `Map2DTileRenderer` bleibt Sache des Aufrufers und muss von
  ihm selbst entsorgt werden · `Map2DTileRenderer#dispose()` ist idempotent, der
  zweite Aufruf läuft am Wächter `tileFactory === null` leer, und
  `removeFromNode(this.node)` fällt genau einmal · die sechs Zyklus-Methoden
  `beginUpdatingTiles()`, `addTile()`, `reuseTile()`, `removeTile()`,
  `clearTiles()` und `endUpdatingTiles()` sind nach `dispose()` stille No-ops
  statt eines `TypeError`; der öffentliche Zustand ist `tileFactory === null` ·
  der private Getter `#factory` und der Import von `expectDefined` sind aus
  `Map2DTileRenderer.ts` verschwunden · `TileSpritesMaterial#dispose()` setzt
  `colorMap` auf `undefined`, entsorgt die Textur aber nicht; die drei
  Node-Getter behalten ihren Knoten · `CameraBasedVisibility#tileBoxPool` trägt
  nach jeder Neuberechnung, die die Kartenebene findet, nur noch die dabei
  besuchten Kacheln — wer sich auf Objekt-Identität über Frames hinweg verlässt,
  bekommt sie nur noch für eine Kachel, die besucht bleibt

**MEM-012 · medium · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:110** — Der TileBox-Pool von CameraBasedVisibility wird nie geräumt

`#tileBoxPool` sammelt je besuchter Kachelkoordinate dauerhaft eine `TileBox` samt
`Box3`, `Vector3` und `Map2DTileCoords` an. Eine weit reisende Kamera lässt den
Pool monoton über die Lebenszeit der Map wachsen.

Empfehlung: Eine Obergrenze mit Verdrängung der am längsten nicht besuchten
Einträge, oder Räumen an derselben Stelle, an der die Sichtbarkeit ohnehin neu
berechnet wird.

**TEST-006 · medium · packages/twopoint5d/src/** — Dispose-Tests sind nicht systematisch

Rund 17 Module haben eine `dispose()`-Methode. Geprüft wird sie dort, wo ein
konkreter Bug dazu gezwungen hat, sonst nirgends. Die Häufung von Dispose-Bugs in
diesem Audit ist kein Zufall, sondern die direkte Folge.

Empfehlung: Ein einheitliches Muster pro Modul: Spy auf die freizugebende
Ressource, `dispose()` aufrufen, Freigabe assertieren, danach Idempotenz prüfen.
Als kurze Checkliste in die Contributing-Notizen, damit neue Module das
mitbringen.

### [x] 8. touchAnimsMap(): die Kostenangabe im TSDoc auf das Gemessene bringen

- Findings: — (Folge aus Paket 2, kein Audit-Finding)
- Folge von: Paket 2
- Ziel: Der TSDoc-Satz an `AnimatedSpritesMaterial#touchAnimsMap()` beziffert die
  Kosten des Aufrufs mit dem, was er wirklich auslöst.
- Bereich: `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`
  — der zweite Absatz des TSDoc-Blocks über `touchAnimsMap()` (Block heute Zeilen
  89–97, der Absatz Zeilen 94–96). Die Handlungsanweisung darin — beim Laden rufen,
  nicht je Frame — bleibt richtig und bleibt wörtlich stehen.
- Warum ein eigenes Paket (2026-09-05, Zug 0 von Paket 3): Paket 2 hat diesen
  TSDoc-Block in seiner Runde 2 umgeschrieben und dabei die zu starke Kostenangabe
  stehen lassen — eigene Ursache, durch die Änderung entstanden, also eine echte
  Folge und keine Ablage. Sie hat mit keinem noch offenen Paket eine Ursache
  gemeinsam: Paket 7 fasst nur Module an, die keines der Pakete 2 bis 6 behandelt
  hat, und `AnimatedSpritesMaterial` gehört Paket 2.
- Hängt ab von: 2
- Hash: a553383
- Modell: mittlere Stufe
- Effort: medium
- Dateien: eine, keine zweite.
  1. `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts` —
     ein Absatz im TSDoc über `touchAnimsMap()`, sonst keine Zeile

#### Abgleich am Code, Zug 0 (2026-09-05)

Die Folge steht unverändert da. `AnimatedSpritesMaterial.ts:96` sagt weiter »which
costs a shader recompile«; `git blame` weist die Zeilen 93–96 dem Commit `0d0aa0f`
zu, also Paket 2, während die Zeilen darum aus `8e056bf` stammen. Der Satz kommt im
ganzen Repo genau einmal vor: `grep -rn 'recompile'` über Quellen, Doku und Lookbook
findet nur diese Stelle. Der CHANGELOG-Eintrag zu der Methode
(`packages/twopoint5d/CHANGELOG.md:13`) trägt keine Kostenangabe.

#### Was der Aufruf wirklich auslöst, gemessen

Nicht hergeleitet, sondern in Zug 0 an three.js `0.185.1` und am gebauten Stand der
Klasse ausgeführt. Zwei Konfigurationen, und sie kosten verschieden viel:

| Zustand des Materials | `material.version` | `colorNode` | `customProgramCacheKey()` |
| --- | --- | --- | --- |
| ohne `colorMap` | +1 | dieselbe Instanz | unverändert |
| mit `colorMap` (mit oder ohne `animsMap`) | +2 | frische Instanz | wandert |

Der Weg dahinter, jede Station am Quelltext nachgesehen:

1. `touchAnimsMap()` stößt den Effect an, der `texCoordsNode` neu setzt. Liegt eine
   `colorMap` vor, hat der Effect in `TexturedSpritesMaterial` (Konstruktor, Zeile
   147) `texCoordsNode` gelesen und läuft mit; er weist `colorNode` einen frischen
   TSL-Node zu. Ohne `colorMap` hat derselbe Effect den `else`-Zweig genommen,
   `texCoordsNode` nie gelesen und läuft deshalb nicht mit — `colorNode` bleibt
   dieselbe Instanz.
2. `NodeMaterial#customProgramCacheKey()` hasht `childNode.getCacheKey()` über die
   eigenen Node-Properties (`three/src/materials/nodes/NodeMaterial.js:398-438`), und
   `Node#customCacheKey()` ist `this.id`, ein globaler Zähler
   (`three/src/nodes/core/Node.js:470-474`). Ein frischer, inhaltsgleicher Node
   bewegt den Schlüssel also. Gemessen: `vec4(0,0,1,1)` zweimal gebaut ergibt zwei
   verschiedene Schlüssel, dieselbe Instanz erneut zugewiesen denselben.
   `texCoordsNode` selbst zählt hier nicht mit — es ist ein Prototyp-Accessor, und
   `_getNodeChildren()` liest `Object.getOwnPropertyNames(this)`. `colorNode` ist der
   Träger.
3. Wandert der Schlüssel, findet `RenderObjects.get()` beim nächsten Bild
   `initialCacheKey !== getCacheKey()`, wirft das Render-Objekt weg und baut es neu
   (`three/src/renderers/common/RenderObjects.js:126-141`). Der
   `nodeBuilderCache` hat `renderObject.initialCacheKey` als Schlüssel
   (`NodeManager.js:150-153`), greift also nicht — der Shader-Quelltext wird neu
   erzeugt.
4. Kompiliert wird trotzdem nichts. `Pipelines.programs.vertex` und `.fragment` sind
   über den Shader-Quelltext selbst geschlüsselt (`Pipelines.js:186-211`), und der kommt
   unverändert heraus; `backend.createProgram()` fällt damit aus, und der
   Pipeline-Schlüssel `stageVertex.id + ',' + stageFragment.id + ...`
   (`Pipelines.js:429-433`) trifft denselben Eintrag.
5. Ein Leck entsteht dabei nicht: `RenderObject.dispose()` geht über
   `NodeManager#delete()`, und dort fällt der Cache-Eintrag mit `usedTimes === 0`
   weg (`NodeManager.js:419-440`).

Also: kein Shader-Recompile, aber auch kein Nichts. Beides gehört in den Satz.

#### Drei Entscheidungen dieses Zuges

Getroffen mit dem Code vor Augen, deshalb hier und nicht unter »Entscheidungen« im Kopf.

1. **Der Satz nennt eine Obergrenze, keine Fallunterscheidung.** Die Kosten hängen
   daran, ob eine `colorMap` gesetzt ist — aber das ist ein Implementierungsdetail der
   Basisklasse, und die Handlungsanweisung ist in beiden Fällen dieselbe. Ein
   »kann« deckt beide Zustände wahrheitsgemäß ab; zwei Fälle in einem Doc-Kommentar,
   dessen ganze Aussage »nicht je Frame« lautet, kosten den Leser mehr, als sie ihm
   sagen. Die Messung steht oben und ist damit nachprüfbar, ohne im TSDoc zu stehen.
2. **Kein CHANGELOG-Eintrag.** `touchAnimsMap()` steht in `CHANGELOG.md:13` unter
   `[Unreleased] → Added`; die Methode ist nie veröffentlicht worden, ihr Eintrag
   beschreibt sie so, wie sie ausgeliefert werden wird, und trägt selbst keine
   Kostenangabe. Eine Korrektur an ihrer Doku vor der ersten Veröffentlichung ist
   nichts, was ein Nutzer je bemerkt hätte.
3. **Der Rahmen des Absatzes bleibt, wie er ist.** »On a live material without an
   animsMap it is not [a no-op]« bleibt wörtlich stehen, obwohl die Messung zeigt,
   dass die interessante Achse die `colorMap` ist und nicht die `animsMap`. Den Absatz
   um die `colorMap` herum neu zu bauen wäre ein Entwurf und nicht der Auftrag: dieses
   Paket bringt die Kostenangabe auf das Gemessene, sonst nichts.

#### Vorgehen

1. **Kein Regressionstest.** Dieses Paket ändert kein Verhalten, es ändert einen
   Kommentar. Die Regel »Bugfix heißt Test zuerst« greift nicht.
2. **Den zweiten Absatz des TSDoc-Blocks über `touchAnimsMap()` ersetzen.** Genau
   diese drei Zeilen (heute 94–96) gehen heraus:

   ```
      * A silent no-op on a disposed material. On a live material without an animsMap it is not:
      * the call rebuilds the neutral texture coordinates and sets `needsUpdate`, which costs a
      * shader recompile. Call it when a texture has loaded, not once per frame.
   ```

   Und genau diese sechs kommen an ihre Stelle, Wort für Wort, Zeilenumbruch für
   Zeilenumbruch:

   ```
      * A silent no-op on a disposed material. On a live material without an animsMap it is not:
      * the call rebuilds the neutral texture coordinates and sets `needsUpdate`, which can make
      * three.js drop the render object and generate the shader source for it again on the next
      * frame. That source comes out unchanged, so the shader program and the render pipeline
      * come back out of the renderer's caches and nothing is compiled. Call it when a texture
      * has loaded, not once per frame.
   ```

   Die Einrückung ist die des Blocks: drei Leerzeichen, Stern, Leerzeichen. In Zug 0
   an einer Kopie der Datei erprobt — `npx prettier --check` läuft grün darüber, die
   Zeilen bleiben unter der `printWidth` von 130 und halten die Breite des
   umgebenden Blocks (~93 Zeichen).
3. **Sonst nichts.** Kein zweiter Absatz des Blocks wird angefasst, kein anderer
   TSDoc, kein Quellcode, kein Test, kein CHANGELOG, keine Doku unter `docs/`. Der
   Diff dieses Pakets hat eine Datei und einen Hunk. Was beim Lesen auffällt und nicht
   hierher gehört, wird als Nebenbefund mit Datei und Zeile gemeldet, nicht behoben.

- Verify: `pnpm lint && f=packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts && ! grep -qi 'recompile' "$f" && grep -q 'nothing is compiled' "$f" && cd packages/twopoint5d && pnpm vitest --run src/sprites`
  — `pnpm lint` ist der Regressionsteil (Prettier und ESLint über die geänderte
  Datei), die beiden `grep` sind der eigentliche Beleg, dass die zu starke Angabe weg
  ist und die neue dasteht, und der Vitest-Lauf über `src/sprites` beantwortet die
  einzige Gefahr eines Doku-Pakets: dass jemand nebenbei Code angefasst hat. In Zug 0
  erprobt — der `grep`-Teil ist gegen den heutigen Stand rot und gegen den Zielstand
  grün. Ein voller `pnpm run ci` steht in keinem Verhältnis zu einem Diff aus sechs
  Kommentarzeilen.
- Commit: `docs(twopoint5d): correct the cost stated for touchAnimsMap()`
- Ergebnis: 1 Runde · der TSDoc-Absatz über `touchAnimsMap()` beziffert die Kosten
  jetzt als das Gemessene: three.js kann das Render-Objekt verwerfen und den
  Shader-Quelltext neu erzeugen, kompiliert wird nichts · Review ohne Befund in
  jeder Stufe · kein Regressionstest, das Paket ändert kein Verhalten
- Nebenbefunde: keine
- Folgen: keine — die Folge aus Paket 2 ist damit geschlossen

### [x] 7. Dispose-Tests systematisch: die übrigen Module

- Findings: TEST-006 (medium, Rest — schließt das Finding)
- Ziel: Jedes Modul mit einer `dispose()`-Methode, das keines der Pakete 2 bis
  6 angefasst hat, hat einen Dispose-Test nach dem Muster aus Abschnitt 8 der
  Richtlinie; die vier Abweichungen von der Richtlinie, die der Abgleich dabei
  aufgedeckt hat, sind behoben, und die Richtlinie selbst stimmt wieder mit dem
  überein, was die Bibliothek ausliefert.
- Bereich: `packages/twopoint5d/src/controls/PanControl2D.ts`,
  `src/display/FixedFrameLoop.ts`, `src/stage/StageRenderer.ts`,
  `src/vertex-objects/VOBufferPool.ts`, die zugehörigen Specs,
  `packages/twopoint5d-testing/test/`,
  `packages/twopoint5d/docs/resource-lifecycle.md`,
  `packages/twopoint5d/CHANGELOG.md`
- Hinweis aus Paket 3 (2026-09-05, Zug 0): **Vitest läuft in diesem Repo ohne
  DOM.** `packages/twopoint5d/vite.config.ts` setzt keine `environment`, also
  `node`: kein `document`, kein `window`, kein `requestAnimationFrame`, und
  keines der drei ist als Dependency da (weder `jsdom` noch `happy-dom`). Jede
  Klasse, deren Konstruktor oder `dispose()` an den Browser reicht, bekommt
  ihren Beleg deshalb in `packages/twopoint5d-testing/` und nicht als `*.spec.ts`.
  `Display` ist dort bereits abgehakt (Paket 3, `test/display-dispose.test.js`).
  **Beantwortet in Zug 0:** `FrameLoop` bekommt kein `dispose()` (Entscheidung 1),
  `FixedFrameLoop` und `StageRenderer` brauchen keinen Browser (Entscheidung 2),
  `PanControl2D` braucht einen (Schritt 5).
- Hinweis aus Paket 5 (2026-09-05, Zug 0): Zwei Wegweiser, die weiter gelten:
  `VOBufferPool#isDisposed` und `VertexObjectPool` (Zeile 120) tragen den
  Idempotenz-Guard bereits, und die Assertionen (a) und (b) aus Abschnitt 8 sind
  in `InstancedVertexObjectGeometry.spec.ts` unter `describe('dispose()')` schon
  ausformuliert. **Korrigiert in Zug 0:** der Hinweis nannte sechs Dateien mit
  einer `dispose()`-Methode in `src/vertex-objects/` und stützte sich dabei auf
  ein `grep -l "dispose()"`, das den Fließtext mitzählt. Es sind vier —
  `VOBufferGeometry`, `InstancedVOBufferGeometry`, `VOBufferPool`,
  `VertexObjectPool`. `GeometryPoolAttachments.ts:11` und
  `VertexObjectBuffer.ts:18-19` erwähnen `dispose()` ausschließlich im
  Kommentar; beide Klassen deklarieren keine solche Methode. Von den vieren
  bleibt allein `VertexObjectPool` für dieses Paket.
- Hinweis aus Paket 4 (2026-09-05, Zug 0): **`src/texture/` fällt für dieses
  Paket weg.** In dem Verzeichnis haben nur `TextureResource` und `TextureStore`
  eine `dispose()`-Methode, und Paket 4 bringt für beide einen Dispose-Test nach
  dem Muster aus Paket 1 mit — `TextureResource.spec.ts` neu, `TextureStore.spec.ts`
  erweitert.
- Hinweis aus Paket 6 (2026-09-05, Zug 0): **`src/map2d/` fällt für dieses Paket
  weg.** In dem Verzeichnis haben genau drei Dateien eine eigene
  `dispose()`-Methode — `Map2D.ts`, `Map2DTileRenderer.ts` und
  `TileSprites/TileSpritesMaterial.ts` —, und Paket 6 bringt für alle drei einen
  Dispose-Test nach dem Muster aus Abschnitt 8 mit. `HelpersManager` hat selbst
  keine und bekommt hier keine — seine Aufräumung heißt `remove()`.
  `CameraBasedVisibility` bekommt bewusst keine: ein Visibilitor wird
  hereingereicht und gehört dem Aufrufer, `IMap2DVisibilitor` deklariert keine,
  und kein Pfad in der Bibliothek würde eine rufen dürfen. Die Begründung steht
  als Entscheidung 6 unter Paket 6; sie ist beschlossen und nicht neu
  aufzuwerfen.
- Hängt ab von: 1, 2, 3, 4, 5, 6
- Hash: 6c0e9b6
- Modell: stärkste Stufe
- Effort: high

#### Abgleich am Code, Zug 0 (2026-09-05)

Die Bestandsaufnahme läuft über eine Deklaration und nicht über eine Erwähnung:

```
grep -rn '^\s*\(public \)\?\(static \)\?\(override \)\?\(async \)\?dispose\s*(' \
  packages/twopoint5d/src --include=*.ts | grep -v '\.spec\.ts'
```

18 Treffer: 17 Methoden und eine Deklaration in einem Interface
(`map2d/types.ts:86`, `IMap2DTileRenderer` — kein Modul, kein Test). Die 17
decken sich mit der Zahl im Finding.

| Modul | Fundstelle heute | Wo geprüft |
| --- | --- | --- |
| `TexturedSprites`, `TexturedSpritesMaterial`, `AnimatedSprites`, `AnimatedSpritesMaterial` | `sprites/…:82, :164, :24, :109` | Paket 2 |
| `Display` | `display/Display.ts:762` | Paket 3, `twopoint5d-testing/test/display-dispose.test.js` |
| `TextureStore`, `TextureResource` | `texture/…:555, :340` | Paket 4 |
| `VOBufferGeometry`, `InstancedVOBufferGeometry`, `VOBufferPool` | `vertex-objects/…:54, :339, :86` | Paket 5 |
| `Map2D`, `Map2DTileRenderer`, `TileSpritesMaterial` | `map2d/…:137, :104, :105` | Paket 6 |
| **`PanControl2D`** | `controls/PanControl2D.ts:365` | **offen** |
| **`FixedFrameLoop`** | `display/FixedFrameLoop.ts:199` | **teilweise** — die Spec trägt drei Fälle, keiner davon (b) oder (e) |
| **`StageRenderer`** | `stage/StageRenderer.ts:520` | **offen** — ein Fall in `StageRenderer.spec.ts:426`, der die falsche Zusage festhält |
| **`VertexObjectPool`** | `vertex-objects/VertexObjectPool.ts:120` | **teilweise** — `VertexObjectPool.spec.ts:710` deckt (a), (c) und (d) unbeschriftet ab |

TEST-006 steht damit unverändert: vier Module offen, `grep -rn "describe('dispose()'"`
findet für keines von ihnen einen Block.

#### Was der Abgleich zusätzlich gefunden hat

Vier Stellen, an denen der heutige Code gegen die Richtlinie aus Paket 1 läuft.
Sie gehören zu diesem Paket und nicht in die Queue: es sind genau die Stellen,
die der Test nach Abschnitt 8 aufdeckt, sobald er geschrieben wird, und drei von
ihnen machen eine Assertion des Musters unschreibbar, solange sie stehen. Paket 6
ist denselben Weg gegangen und hat die drei Verstöße seines Abgleichs mit
erledigt.

| Stelle | Regel | Was dasteht |
| --- | --- | --- |
| `StageRenderer.ts:525` | Abschnitt 2 — freigegeben wird nur, was die Instanz selbst gebaut hat | `dispose()` ruft `this.pipeline?.dispose()`. `pipeline` ist ein öffentliches Feld, das ausschließlich von außen beschrieben wird; jede Zuweisung im Repo kommt von einem Aufrufer, und das TSDoc von `RootRenderPipeline` zeigt genau diese Form (`root.pipeline = new RootRenderPipeline(display.renderer!)`). Assertion (b) ist gegen diese Zeile rot |
| `StageRenderer.ts:520-527` | Abschnitt 4 — nach `dispose()` gilt eine der drei Reaktionen | `dispose()` löst die Bindung an den Host nicht. Die beiden `once(this, OnRemoveFromParent, …)` aus `#addToHost()` (Zeile 213–229) feuern nie, also rufen `host.onResize` und `host.onRenderFrame` weiter `updateFrame()` und `renderTo()`. Der entsorgte Renderer zeichnet seine Stages jedes Bild weiter, und sobald ihm jemand wieder eine `pipeline` gibt, baut `#ensureInternalRT()` das eben freigegebene RenderTarget neu. Ein stilles Weiterleben ist keine der drei Reaktionen. Es fehlt auch das `off(this)` aus Abschnitt 5 |
| `FixedFrameLoop.ts:150` | Abschnitt 5 — nach `dispose()` überlebt kein Listener | Der Konstruktor legt mit `once(display, OnDisplayDispose, () => this.dispose())` einen Listener auf dem **Display** ab und hebt keinen Handle auf. `dispose()` entfernt nur das Gegenstück (`off(this.display, OnDisplayRenderFrame, this)`); `off(this)` erreicht die Stelle nicht, denn sie hängt am Display und nicht am Loop. Ein Display, das viele kurzlebige Loops überlebt, sammelt je einen Abschluss über einen toten Loop. Gemessen, siehe unten |
| `VOBufferPool.ts:103, 121` | Abschnitt 4 | `toBuffersData()` und `fromBuffersData()` haben nach `dispose()` kein definiertes Verhalten. Stand schon in »Offene Befunde« mit dem Urteil `→ Scope`; hierher genommen, weil beide öffentliche Methoden von `VertexObjectPool` sind und Assertion (c) für diese Klasse ohne eine Entscheidung darüber nicht zu schreiben ist |

#### Die Messung, auf der Schritt 4 steht

Der Listener, den `FixedFrameLoop` auf dem Display zurücklässt, ist nachgezählt
und nicht abgeleitet — dieselbe Aufrufreihenfolge, nur mit dem nackten
`@spearwolf/eventize@6.2.0` statt mit der Klasse:

```js
const display = eventize({}), loop = eventize({});
getSubscriptionCount(display);              // 0
on(display, 'renderFrame', loop);
once(display, 'dispose', () => {});         // was der Konstruktor tut
getSubscriptionCount(display);              // 2
off(display, 'renderFrame', loop); off(loop); // was dispose() tut
getSubscriptionCount(display);              // 1  ['dispose']
```

Die Zahl geht nicht auf null zurück. `getSubscriptionCount` und
`getSubscribedEventNames` sind aus dem Paket exportiert und damit auch das
Messwerkzeug des Tests.

#### Sieben Entscheidungen dieses Zuges

Getroffen mit dem Code vor Augen, nicht vom Nutzer. Sie stehen hier und nicht im
Kopf des Plans.

1. **`FrameLoop` bekommt kein `dispose()`.** Damit ist die Frage beantwortet, die
   der Hinweis aus Paket 3 offengelassen hat. Drei Gründe, jeder für sich
   ausreichend: TEST-006 verlangt Tests für die `dispose()`-Methoden, die es
   gibt, und keine neuen; ein `FrameLoop` ist geteilt gebaut — jedes `Display`
   hält eines, mehrere teilen sich einen Treiber —, und einem geteilten Objekt
   ein `dispose()` zu geben lädt genau den Ownership-Fehler ein, den dieser Lauf
   in sechs Paketen geschlossen hat; und der Freigabeweg existiert bereits
   zweiteilig, `clear()` für die Subscriber und `FrameLoop.resetRAF()` aus
   Paket 3 für den geteilten Treiber. Die eine echte Lücke — ein
   renderer-loser RAF-Treiber, den kein Abgangspfad anhält — steht unter
   »Offene Befunde« mit `→ Scope` und ist dort ausdrücklich als eigener Entwurf
   vermerkt. Sie in dieses Paket zu ziehen hieße, den Entwurf nebenbei zu
   treffen; die Drain-Runde entscheidet ihn mit allen Befunden vor Augen.
2. **`FixedFrameLoop`, `StageRenderer` und `VertexObjectPool` werden unter
   Vitest belegt, `PanControl2D` im Browser.** Nachgesehen, nicht vermutet: die
   Spec von `FixedFrameLoop` baut ihr Display heute schon aus `eventize({})`,
   `StageRenderer.spec.ts:426` fährt `renderTo()` mit einem Attrappen-Renderer
   und baut dabei ein echtes `new RenderTarget(w, h)` unter Node, und
   `VertexObjectPool` fasst nichts an, was es nicht selbst alloziert.
   `PanControl2D` dagegen liest im Konstruktor `document.body` und hängt seine
   Listener an `document` — die Regel aus dem Hinweis von Paket 3 greift.
3. **`StageRenderer#dispose()` gibt die `pipeline` auf, statt sie
   freizugeben.** Abschnitt 2 lässt keinen zweiten Weg zu, und die Alternative
   — die Pipeline zum Eigentum des Renderers erklären — scheitert daran, dass
   es keine Bauform gibt, in der er sie selbst erzeugt. Der Blast Radius ist
   klein und nachgesehen: `grep -rn 'stageRenderer\.dispose\|\.pipeline\s*='`
   über `packages/` und `apps/` findet keinen einzigen Aufrufer von
   `StageRenderer#dispose()` und keine Zuweisung an `pipeline` außerhalb von
   Tests und dem Beispiel im TSDoc.
4. **`StageRenderer#dispose()` löst sich vom Host und gibt seine Stages ab.**
   Die Reihenfolge steht in Schritt 7. Dass die Stages abgegeben und nicht
   entsorgt werden, ist dieselbe Antwort, die Paket 6 für `Map2D#dispose()`
   gegeben hat: sie kommen über `add()` herein und gehören dem Aufrufer, der
   Renderer gibt nur seine Referenzen auf.
5. **Ein entsorgter `StageRenderer` lässt sich nicht wiederbeleben.** Er bekommt
   ein privates `#disposed`, einen öffentlichen `isDisposed`-Getter und einen
   stillen No-op in `add()` und im `parent`-Setter. Das ist wörtlich der Fehler,
   den Paket 3 an `Display` geschlossen hat — dort legte `FrameLoop#start()` ein
   entsorgtes Display in `#subscribers` zurück. Denselben Weg in der
   Schwesterklasse offenzulassen, nachdem er einmal als Fehler benannt ist,
   wäre die teurere Entscheidung. Den Getter rechtfertigt Abschnitt 3: ein
   `StageRenderer` wird wie ein `Display` herumgereicht, ein Halter muss fragen
   können.
6. **`VOBufferPool#toBuffersData()` und `#fromBuffersData()` werfen nach
   `dispose()`, beide.** Für `toBuffersData()` sagt das Abschnitt 4 Regel 2
   direkt: der Rückgabetyp `VertexObjectBuffersData` behauptet Anwesenheit, und
   heute liefert die Methode still `{capacity, usedCount: 0, buffers: {}}` —
   Daten, die wie ein leerer Pool aussehen und nicht wie ein toter.
   `fromBuffersData()` ist ein Sonderfall, der die Regel nicht bricht, sondern
   fortsetzt: die Methode weist ungültige Eingaben schon heute zurück
   (`throw new Error('Invalid buffersData capacity')`), sie ist also keine
   stillschweigend nachgebende Methode, für die Regel 3 gedacht ist. Ein
   entsorgter Pool kann keine Kapazität bedienen. Ein stiller No-op wäre hier
   die schlechtere Antwort, weil ein Aufrufer glauben würde, seine Daten seien
   angekommen — und weil das TSDoc über `dispose()` bereits zusagt, dass jeder
   weitere Lese- und Schreibzugriff fehlschlägt. Abschnitt 4 Regel 3 bekommt
   dafür den halben Satz aus Schritt 10.
7. **`Canvas2DStage` bleibt draußen.** Die Klasse ist öffentlich, baut
   `StageRenderer`, `Stage2D`, `Sprite`, `SpriteMaterial`, `Texture` und eine
   `TextureFactory` selbst — und hat überhaupt kein `dispose()`. Sie fällt
   damit nicht unter die Bestandsaufnahme dieses Pakets, und die Ursache ist
   eine andere: eine fehlende Methode, keine ungeprüfte. Sie geht als
   Nebenbefund in die Queue mit dem Urteil `→ Scope`; das Paket dafür schneidet
   die Drain-Runde, nicht dieser Zug.

#### Die Folgen aus den Paketen 1 bis 3

Sie werden hier verteilt, weil dieses Paket das letzte offene ist. Fünf der
sechs sind an ihrer Fundstelle nachgesehen und erledigt, ohne dass sich eine
Zeile ändert:

| Folge | Nachgesehen | Ergebnis |
| --- | --- | --- |
| Paket 1: `resource-lifecycle.md:197` — der Reihenfolge-Satz belegt sich an `AnimatedSpritesMaterial.dispose()` | `AnimatedSpritesMaterial.ts:109-115` | Der Absatz sagt heute, das Material gebe die Referenz auf und entsorge die Textur nicht. Genau das steht im Code. Deckungsgleich |
| Paket 1: `resource-lifecycle.md:90`, `:98` — die Beispiele `TexturedSprites#texture` und `#freeSprite()` | `TexturedSprites.ts:26` und `:69` | Beide Namen stehen unverändert. Paket 2 hat sie nicht bewegt |
| Paket 2: `CHANGELOG.md:51` — die absolute URL auf die Richtlinie | `packages/twopoint5d/docs/resource-lifecycle.md` | Kein Paket hat die Datei umgezogen, die URL trägt |
| Paket 3: `resource-lifecycle.md:159` — der Codeblock zitiert `Display.dispose()` wörtlich | `Display.ts:762-775` | Zeile für Zeile identisch. Nach Paket 3 hat kein Paket `Display` angefasst |
| Paket 3: `resource-lifecycle.md:106-108` — Regel 2 zitiert den Wortlaut aus `disposedError()` | `Display.ts`, `disposedError()` | ``Display#${member} is not available: this display has been disposed`` — der zitierte Satz |

Offen bleibt die sechste, und sie wird zu Schritt 10: Paket 2 hat vermerkt, dass
die Aufzählung in Abschnitt 3 nachzuziehen ist, falls ein `dispose()` aus den
Paketen 3 bis 7 einen weiteren Mechanismus mitbringt, der von sich aus leerläuft.
Nachgezählt hat er das getan. Abschnitt 3 kennt zwei Bauformen — das private Flag
und die Form, in der jeder Schritt beim zweiten Aufruf von sich aus leerläuft.
`Map2DTileRenderer#dispose()` aus Paket 6 liefert eine dritte: ein früher Ausgang
an dem Zustand, den die Methode selbst aufgibt (`tileFactory === null`), also an
einem öffentlichen Member und nicht an einem privaten Flag. Wer Abschnitt 3
wörtlich nimmt, hält die ausgelieferte Klasse für regelwidrig.

#### Vorgehen

1. **`FixedFrameLoop`: die Assertionen (b), (c) und (e) schreiben, rot sehen.**
   In `packages/twopoint5d/src/display/FixedFrameLoop.spec.ts` einen Block
   `describe('dispose()', …)` anlegen und die drei vorhandenen Fälle
   (`dispose() unsubscribes from Display and ignores further frames`,
   `dispose() is idempotent`, `disposes itself when Display fires OnDisplayDispose`)
   hineinziehen, mit den Kommentarmarken (c) und (d) aus Abschnitt 8. Neu:
   - **(b)** `leaves the Display it was handed exactly as it found it` —
     `getSubscriptionCount(display)` vor dem `new FixedFrameLoop(display)`
     merken, `loop.dispose()`, denselben Wert erwarten. Dieser Test ist vor
     Schritt 4 rot (`2` statt `0`, siehe Messung oben), und sein roter Lauf
     gehört in den Report.
   - **(e)** entfällt: die Klasse legt weder Signal noch Effect an
     (`grep signalize src/display/FixedFrameLoop.ts` ist leer). Die
     Auslassung wird auskommentiert, mit diesem Grund — so wie Paket 6 es
     gehalten hat.
   - **(a)** entfällt: die Klasse baut keine freizugebende Ressource. Ebenso
     auskommentiert.
2. **`FixedFrameLoop`: (c) vollständig machen.** Nach `dispose()` gilt: `isDisposed`
   ist `true`; `fps`, `fixedDelta`, `tickTime`, `tickNo` und `alpha` antworten
   weiter mit ihrem letzten Wert (Typ `number`, Regel 1 greift nicht, Regel 2
   verlangt keinen Wurf, weil kein Wert verloren ging); `reset()` läuft und
   ändert daran nichts mehr, was sie ändern könnte; ein nach `dispose()` über
   `onTick`/`onRender` angemeldeter Handler wird nie gerufen; ein zweites
   `dispose()` tut nichts. Jede dieser Aussagen bekommt ihre Assertion und ihre
   Zeile im TSDoc der Methode (Checkliste Punkt 6).
3. **`FixedFrameLoop`: den Fix.** Der Konstruktor hebt den Handle des
   `once(display, OnDisplayDispose, …)` auf, `dispose()` ruft ihn. Der Skill
   `using-eventize` gilt für diese Zeilen; er entscheidet, ob der Handle oder
   ein `off(display, OnDisplayDispose, …)` mit fester Referenz die Form ist,
   die eventize 6 vorsieht. Danach ist der Test aus Schritt 1 grün.
4. **`StageRenderer`: die fünf Assertionen schreiben, rot sehen.** In
   `packages/twopoint5d/src/stage/StageRenderer.spec.ts` einen Block
   `describe('dispose()', …)`:
   - **(a)** `disposes the render targets it built itself` — `renderTo()` mit dem
     vorhandenen Attrappen-Renderer treibt ein internes RenderTarget hervor;
     `sandbox.spy(RenderTarget.prototype, 'dispose')` zählt die Freigabe.
   - **(b)** `does NOT dispose a pipeline that was handed in` — das ist der
     umgeschriebene Fall aus Zeile 426. Der Test dort heißt heute
     `dispose() releases internal RT and pipeline` und hält mit
     `expect(dispose).toHaveBeenCalledTimes(1)` genau die Zusage fest, die
     Abschnitt 2 verbietet. Er wird umgeschrieben, nicht gelöscht: die
     RT-Hälfte wandert nach (a), die Pipeline-Hälfte kehrt sich um.
   - **(c)** `behaves as documented after dispose()` — `pipeline` und `parent`
     antworten `undefined`, `stages` ist leer, `isDisposed` ist `true`, ein
     `attach(host)` und ein `add(stage)` danach tun nichts, und ein
     `onRenderFrame` des Hosts erreicht den Renderer nicht mehr.
   - **(d)** `is safe to call twice`.
   - **(e)** entfällt, kein signalize in der Datei; auskommentiert mit Grund.
5. **`PanControl2D`: der Browser-Beleg.** Neue Datei
   `packages/twopoint5d-testing/test/pan-control-dispose.test.js`, importiert
   `PanControl2D` aus `@spearwolf/twopoint5d` und braucht weder Display noch
   Renderer — `texture-store-on.test.js` ist die Vorlage für einen Browser-Test
   ohne GPU. Die tragende Assertion ist (c): nach `dispose()` ändert ein auf
   `document` abgesetztes `keydown` mit einem der vier `keyCodes` und ein
   `pointerdown` mit dem konfigurierten `mouseButton` den Zustand des Controls
   nicht mehr (`speedNorth` und Geschwister bleiben `0`), `isActive` ist `false`,
   ein `subscribe()` danach hängt nichts wieder ein, und ein vor dem `dispose()`
   über `on()` angemeldeter Listener bekommt kein Event mehr. Dazu (d). (a) und
   (b) entfallen — die Klasse baut keine freizugebende Ressource und bekommt
   keine hereingereicht —, (e) entfällt mangels signalize; alle drei
   auskommentiert mit Grund.
6. **`VertexObjectPool`: den vorhandenen Block auf das Muster bringen.** Der
   `describe('dispose()')` in `VertexObjectPool.spec.ts:710` deckt (a), (c) und
   (d) bereits ab, unbeschriftet. Die Fälle bekommen ihre Kommentarmarken, (b)
   und (e) werden mit Grund auskommentiert (der Konstruktor nimmt einen
   Deskriptor, keine freizugebende Ressource; kein signalize), und (c) wird um
   die beiden Methoden aus Schritt 9 ergänzt. Keine Umbenennung der
   vorhandenen Testnamen — sie stehen in keiner Ergebniszeile, aber ein
   umbenannter grüner Test kostet Review-Zeit ohne Gegenwert.
7. **`StageRenderer#dispose()` umbauen.** Reihenfolge, und sie ist der Punkt:
   ```
   if (this.#disposed) return;
   this.#disposed = true;
   for (const item of this.stages.slice()) this.remove(item.stage);  // gehören dem Aufrufer
   this.parent = undefined;                                          // feuert OnRemoveFromParent → Host-Abmeldungen
   this.#internalRT?.dispose();      this.#internalRT = undefined;
   this.#asPassNodeRT?.dispose();    this.#asPassNodeRT = undefined;
   this.pipeline = undefined;        // hereingereicht, wird nicht entsorgt
   off(this);                        // zuletzt: die Events oben sollen noch ankommen
   ```
   Der Kommentar an `off(this)` sagt, _warum_ es unten steht, nicht _dass_.
   Dazu `#disposed`, der `isDisposed`-Getter und der stille No-op in `add()`
   und im `parent`-Setter aus Entscheidung 5. Das TSDoc über `dispose()` nennt
   für jeden öffentlichen Member seine Reaktion nach Abschnitt 4.
8. **Den Import aufräumen.** `StageRenderer.ts` importiert heute `emit`,
   `eventize` und `once` aus `@spearwolf/eventize`; `off` kommt dazu.
9. **`VOBufferPool#toBuffersData()` und `#fromBuffersData()` guarden.** Beide
   werfen auf einem entsorgten Pool einen `Error`, der Klasse, Methode und
   Zustand nennt — dieselbe Form, die `Display` und `TextureStore` seit den
   Paketen 3 und 4 tragen, also über eine Modulfunktion statt über zwei
   Zeichenketten am Aufrufort. Das TSDoc beider Methoden sagt es. Der
   Regressionstest steht in `VertexObjectPool.spec.ts` (Schritt 6) und ist vor
   dem Guard rot.
10. **Die Richtlinie nachziehen**, zwei halbe Sätze, mehr nicht:
    - Abschnitt 3, am Absatz über das Flag: die dritte Bauform — ein früher
      Ausgang an dem Zustand, den die Methode selbst aufgibt, mit
      `Map2DTileRenderer#dispose()` als Beleg.
    - Abschnitt 4, an Regel 3: eine verändernde Methode, die ungültige Eingaben
      schon von sich aus zurückweist, weist sie auf einer entsorgten Instanz
      weiter zurück, statt still nachzugeben. `VOBufferPool#fromBuffersData()`
      als Beleg.
    Kein weiterer Satz in dieser Datei. Sie ist von zwei Reviewern gegen die
    Quellen geprüft worden, und die fünf Stellen, an denen dieser Lauf sie
    hätte überholen können, sind oben nachgesehen und stimmen.
11. **CHANGELOG.** Unter `[Unreleased]` → `### Changed` je ein Absatz für
    `StageRenderer#dispose()`, für `FixedFrameLoop#dispose()` und für die beiden
    `VOBufferPool`-Methoden; unter `### Added` einer für `StageRenderer#isDisposed`.
    Dazu ein Abschnitt im Migration Guide für die eine Änderung, die einem
    Aufrufer ohne Compilerfehler durchgeht: seine `pipeline` wird ab jetzt nicht
    mehr mit entsorgt. Form und Ton nach den Absätzen, die die Pakete 2 bis 6
    dort hinterlassen haben; der Skill `updating-changelog` gilt.
12. **Sonst nichts.** Keine Änderung an `FrameLoop`, an `Display`, an
    `InputControlBase`, an `Canvas2DStage`, an `Stage2D`, an
    `RootRenderPipeline`, an `public-api.ts`, an `Stylesheets.ts` oder am
    Lookbook. Kein Aufrufer im Repo ruft `stageRenderer.dispose()`, die
    Änderung aus Schritt 7 zieht also keine Anpassung nach sich. Was beim Lesen
    dieser Dateien auffällt und nicht hierher gehört, wird als Nebenbefund mit
    Datei und Zeile gemeldet, nicht behoben; die Einträge unter »Offene Befunde«
    sind nicht noch einmal zu melden.

#### Review-Fokus

- Waren die Tests aus den Schritten 1, 4 und 9 vor dem jeweiligen Fix rot? Der
  Report zeigt die Ausgabe, nicht die Behauptung. Besonders (b) für
  `FixedFrameLoop`: er ist die einzige Wache über der Messung, auf der Schritt 3
  steht.
- Gibt irgendein `dispose()` in diesem Diff etwas frei, das die Instanz nicht
  gebaut hat? Und gibt es umgekehrt etwas auf, das sie behalten müsste?
- Stimmt die Reihenfolge in `StageRenderer#dispose()`? `off(this)` vor dem
  `parent = undefined` nimmt den beiden `once(this, OnRemoveFromParent, …)` aus
  `#addToHost()` das Ereignis weg, auf das sie warten — die Host-Abmeldungen
  laufen dann nie, und der Test aus (c) bleibt trotzdem grün, solange er den
  Host nicht wirklich feuern lässt. Das ist die Stelle, an der dieses Paket am
  wahrscheinlichsten still falsch wird.
- Ist jede weggelassene Assertion aus dem Muster von Abschnitt 8 kommentiert,
  oder fehlt sie einfach?
- Trägt der Migration Guide den Fall `stageRenderer.dispose()`?
- Steht im CHANGELOG noch ein `[Unreleased]`-Satz, der das alte Verhalten von
  `StageRenderer` oder `VOBufferPool` verspricht? Paket 2 hat an dieser Stelle
  eine Runde verloren, Paket 6 hat sie deshalb vorab benannt.
- Halten die zwei halben Sätze aus Schritt 10 gegen ihre Quelle — und ist es bei
  zweien geblieben?
- Kommen die neuen Fehlermeldungen aus einer Modulfunktion, oder stehen die
  Zeichenketten am Aufrufort? Paket 4 hat dafür `noResourceError()` und
  `disposedError()` eingeführt.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `typecheck` deckt die Specs mit ab (`pnpm build` lässt sie aus) und fährt
  zusätzlich `astro check` über den Lookbook; `test:browser` muss diesmal hinein,
  weil Schritt 5 dort eine Datei anlegt. In Zug 0 gegen den heutigen Stand
  erprobt, Exit 0 (`paket-7.zug0-verify-probe.log` im Arbeitsverzeichnis;
  `test:ci` lief ohne Cache-Treffer, war also echt).
- Commit: `fix(twopoint5d): give the remaining dispose() paths a contract and a test`
- Ergebnis: 2 Runden · TEST-006 (Rest) behoben — vier `describe('dispose()')`-Blöcke,
  wo keiner war (`FixedFrameLoop.spec.ts:149`, `StageRenderer.spec.ts:622`,
  `VertexObjectPool.spec.ts:710` beschriftet und erweitert,
  `twopoint5d-testing/test/pan-control-dispose.test.js` neu), alle zwölf Schritte
  ausgeführt · die vier Richtlinienverstöße geschlossen: Pipeline-Ownership,
  Host-Bindung samt `off(this)`, der auf dem Display zurückgelassene Listener,
  die beiden ungeklärten Pool-Methoden · Regressionstests vor dem jeweiligen Fix
  rot: `leaves the Display it was handed exactly as it found it` (1 statt 0
  zurückgebliebene Subskriptionen, deckt sich mit der Messung oben),
  `behaves as documented after dispose()` für beide Klassen,
  `does NOT dispose a pipeline or an output target that was handed in`,
  `is safe to call twice`, `VOBufferPool: toBuffersData() and fromBuffersData()
  refuse a disposed pool` · Reihenfolge in `StageRenderer#dispose()` durch den
  Gegenversuch abgesichert: mit `off(this)` vor dem Lösen vom Host kippen zwei
  Assertionen, weil der Attrappen-Host seinen Handler wirklich vergisst und nach
  dem `dispose()` weiterfeuert · klein, nicht behoben: `disposedError()` in
  `VOBufferPool.ts:53-55` schreibt den Namen der Basisklasse fest, den eine
  `VertexObjectPool` erbt (`Display` hält es genauso) · klein: der
  Begründungskommentar zu Assertion (b) in `pan-control-dispose.test.js:53-56`
  liest Abschnitt 2 zu eng, siehe den Queue-Eintrag zum Cursor-Style · klein:
  `expect(alpha).toBeGreaterThan(0)` in `FixedFrameLoop.spec.ts:186` reitet auf
  einem Fließkomma-Rest von 4,2e-16, eine andere Frame-Dauer kippt die Assertion,
  ohne dass etwas kaputt wäre
- Nebenbefunde: → Queue (6 Einträge, alle `→ Scope`)
- Folgen: keine
- Schnittstellen: `StageRenderer#isDisposed` — neuer öffentlicher Getter ·
  `StageRenderer#dispose()` entsorgt weder die hereingereichte `pipeline` noch
  ein `outputRenderTarget` noch die Stages: es gibt die Stages über `remove()`
  ab, löst sich vom Host, entsorgt allein seine beiden internen RenderTargets,
  setzt `pipeline` und `parent` auf `undefined` und ruft zuletzt `off(this)` —
  zuletzt, weil die beiden `once(this, OnRemoveFromParent, …)` aus
  `#addToHost()` ihr Ereignis sonst nie bekommen und die Host-Abmeldungen
  ausblieben; mit den Listenern gehen auch die `OnStageAdded`- und
  `OnStageRemoved`-Subskriptionen eines Aufrufers · nach `dispose()` sind ein
  Schreibzugriff auf `parent`, `attach()`, `detach()`, `add()`, `remove()` und
  ein zweites `dispose()` stille No-ops, während `resize()`, `setClearColor()`
  und `invalidateOutputNode()` weiter Werte annehmen, ohne etwas zu treiben ·
  `FixedFrameLoop#dispose()` nimmt auch den `OnDisplayDispose`-Listener vom
  Display herunter, den der Konstruktor dort abgelegt hat (Handle aus `once()`
  aufgehoben), und `reset()` ist danach ein No-op ·
  `VOBufferPool#toBuffersData()` und `#fromBuffersData()` werfen auf einem
  entsorgten Pool; der Text kommt aus der Modulfunktion `disposedError()` in
  `src/vertex-objects/VOBufferPool.ts`, wer die Meldung ändert, ändert sie dort ·
  `packages/twopoint5d/docs/resource-lifecycle.md` §3 kennt als dritte
  Idempotenz-Bauform den frühen Ausgang an dem öffentlichen Zustand, den die
  Methode selbst aufgibt (Beleg `Map2DTileRenderer#dispose()`), und §4 Regel 3
  hält fest, dass eine verändernde Methode, die ungültige Eingaben schon von
  sich aus zurückweist, sie auf einer entsorgten Instanz weiter zurückweist,
  statt still nachzugeben (Beleg `VOBufferPool#fromBuffersData()`)

**TEST-006 · medium · packages/twopoint5d/src/** — Dispose-Tests sind nicht systematisch

Rund 17 Module haben eine `dispose()`-Methode. Geprüft wird sie dort, wo ein
konkreter Bug dazu gezwungen hat, sonst nirgends. Die Häufung von Dispose-Bugs in
diesem Audit ist kein Zufall, sondern die direkte Folge.

Empfehlung: Ein einheitliches Muster pro Modul: Spy auf die freizugebende
Ressource, `dispose()` aufrufen, Freigabe assertieren, danach Idempotenz prüfen.
Als kurze Checkliste in die Contributing-Notizen, damit neue Module das
mitbringen.

### [x] 9. display: Nachzügler nach dispose()

- Nebenbefund: aus Paket 3 (vier Einträge der Queue: RAF-Treiber hält nie an;
  `Stylesheets` wächst je Display, toter Cache-Zweig; Konstruktor startet den
  FrameLoop nach frühem `dispose()` wieder; `isWebGPUBackend`/`isWebGLBackend`
  antworten nach `dispose()` `false` statt zu werfen)
- Ziel: Ein entsorgtes `Display` hinterlässt nichts, was weiterläuft oder
  weiterwächst — kein RAF-Treiber, keine Stylesheet-Regel, kein Subscriber —,
  und seine Backend-Abfragen halten Regel 2 der Richtlinie.
- Bereich: `packages/twopoint5d/src/display/` (`FrameLoop.ts`, `Stylesheets.ts`,
  `Display.ts`) und Specs
- Hängt ab von: 3
- Hash: 1813d63
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/src/display/FrameLoop.ts` ·
  `packages/twopoint5d/src/display/Stylesheets.ts` ·
  `packages/twopoint5d/src/display/Display.ts` ·
  `packages/twopoint5d/src/display/FrameLoop.spec.ts` ·
  `packages/twopoint5d-testing/test/display-dispose.test.js` ·
  `packages/twopoint5d-testing/test/stylesheets.test.js` (neu) ·
  `packages/twopoint5d/CHANGELOG.md`. Sieben Dateien, keine achte.

#### Warum die vier zusammen in einem Paket stehen

Sie sind nicht vier kleine Reparaturen nebeneinander, sondern zwei Paare. Der
Treiber-Fix und der Konstruktor-Guard greifen ineinander: ohne den Guard hält der
Treiber beim `dispose()` zwar an, und das `.then()` des Konstruktors startet ihn
Millisekunden später wieder — der erste Fix wäre ohne den zweiten wirkungslos, und
zwar unbemerkt, weil beides über denselben `frameLoop.start(this)` läuft. Der
Stylesheet-Fix und die Backend-Getter teilen die Datei und die Testdatei mit
ihnen.

#### Fünf Entscheidungen dieses Zuges

Getroffen mit dem Code vor Augen; sie stehen hier und nicht unter
»Entscheidungen« im Kopf.

1. **Der Treiber trägt eine Referenzzählung, keine Abfrage bei eventize.**
   `getSubscriptionCount(raf)` wäre der kürzere Weg und beantwortet die falsche
   Frage: er zählt Listener über alle Events, während die Frage »treibt dieser
   Treiber noch jemanden?« lautet. Ein `Set<FrameLoop>` auf dem `RAF` beantwortet
   genau sie, macht den Übergang 1 → 0 zur einzigen Stelle, an der der Treiber
   anhält, und ist im Test sichtbar.
2. **Anmelden und Zählen liegen in einer Methode.** `RAF#attach(loop)` macht das
   `on(this, OnRAF, loop)` und die Zählung, `RAF#detach(loop)` das `off` und den
   Halt. Getrennt könnten sie auseinanderlaufen, und ein `FrameLoop`, der am
   Treiber hängt, ohne gezählt zu sein, ist genau der Zustand, den dieses Paket
   beseitigt.
3. **Der Treiber startet nicht mehr im Konstruktor.** Er läuft genau dann, wenn
   mindestens ein `FrameLoop` mit mindestens einem Abonnenten an ihm hängt. Die
   Alternative — Autostart beibehalten und nur beim Abgang anhalten — ließe
   `new FrameLoop(0)` ohne je einen Abonnenten weiterhin eine rAF-Kette
   unterhalten, also dieselbe Lücke durch eine zweite Tür. Der Preis sind zwei
   bestehende Assertionen in `FrameLoop.spec.ts` (Schritt 5), die den Autostart
   messen; sie werden mitgezogen, weil dieser Umbau sie umwirft.
4. **`Stylesheets` merkt sich die `CSSStyleRule`, nicht ihren Index.** Der tote
   Zweig ließe sich auch mit dem gespeicherten Index reparieren
   (`deleteRule(index)` vor `insertRule(css, index)`), aber `getGlobalSheet()` ist
   öffentlich: wer selbst eine Regel vorn einfügt, verschiebt jeden gespeicherten
   Index um eins, und ein `deleteRule` löscht dann die Regel eines Fremden. Ein
   Verweis auf das Regelobjekt bleibt gültig, wo immer es im Blatt steht, und der
   Wertwechsel läuft über `rule.style.cssText`. Kein `deleteRule` im ganzen Modul.
5. **`Display.dispose()` räumt keine Stylesheet-Regel ab.** Zwei Displays teilen
   sich die `twopoint5d-canvas`-Regel; wer sie beim `dispose()` des ersten
   entfernte, nähme sie dem zweiten weg. Das monotone Wachstum verschwindet an
   seiner Ursache — eine Regel je Name statt einer je Aufruf —, nicht durch ein
   Aufräumen. `dispose()` bleibt deshalb Zeile für Zeile, wie es ist; der
   Codeblock in `docs/resource-lifecycle.md:159-186` zitiert die Methode und darf
   danach unverändert stimmen.

#### Vorgehen

Die Schritte 1, 4, 6 und 8 schreiben je einen Test, der vor seinem Fix rot laufen
muss. Der rote Lauf gehört mit Kommando und Ausgabe in den Report; ein Test, der
beim ersten Lauf grün ist, belegt nichts.

1. **Roter Test für den Treiber** — vier Fälle in `FrameLoop.spec.ts`, in einem
   eigenen `describe('the shared rAF driver')`-Block mit demselben Teardown, den
   der `resetRAF()`-Block darüber schon führt:

   ```ts
   afterEach(() => {
     FrameLoop.resetRAF();
     vi.unstubAllGlobals();
   });
   ```

   - `stops when the last loop lets go of it`: `requestAnimationFrame` und
     `cancelAnimationFrame` nach dem Muster aus `FrameLoop.spec.ts:278-289`
     stubben, `new FrameLoop(0)`, ein `target` mit `[FrameLoop.OnFrame]() {}`
     über `loop.start(target)` anmelden, `rafIDs` hat einen Eintrag, dann
     `loop.stop(target)` und `cancelled` enthält genau diesen Eintrag. Heute rot
     an der letzten Assertion: `cancelled` bleibt leer.
   - `starts again when a loop comes back`: nach dem `stop()` erneut
     `loop.start(target)`, `rafIDs` wächst um genau eins.
   - `is taken off the renderer when the last loop lets go`: mit
     `makeFakeRenderer()`, `renderer.callback` ist nach dem `start(target)` nicht
     `null` und nach dem `stop(target)` `null`. Heute rot.
   - `keeps running while another loop still holds it`: zwei `FrameLoop`s auf
     **demselben** `makeFakeRenderer()`, beide mit eigenem Target gestartet; nach
     dem `stop()` des ersten ist `renderer.callback` weiterhin gesetzt, nach dem
     des zweiten `null`. Dieser Fall belegt die Zählung; ohne ihn wäre ein Fix,
     der beim ersten Abgang anhält, ebenfalls grün.

2. **`RAF` bekommt die Zählung** (`FrameLoop.ts`, Klasse `RAF`, Zeilen 21-113):

   - Feld `#loops = new Set<FrameLoop>();` mit einem Kommentar, der sagt, warum
     es da ist: der Treiber läuft genau, solange ihn jemand treibt — eine
     rAF-Kette, der niemand zuhört, hält die Seite wach und misst FPS ins Leere.
   - `attach(loop: FrameLoop): void` — `if (this.#loops.has(loop)) return;`, dann
     `this.#loops.add(loop)`, `on(this, OnRAF, loop)` und `this.start()`.
   - `detach(loop: FrameLoop): void` — `if (!this.#loops.delete(loop)) return;`,
     dann `off(this, OnRAF, loop)` und `if (this.#loops.size === 0) this.stop();`.
   - Der Konstruktor (Zeile 48-51) ruft **kein** `this.start()` mehr; `eventize(this)`
     bleibt.
   - `stop()` (Zeile 75-82) bekommt als erste Zeile `if (this.#rafID === 0) return;`.
     Das ist nicht Kosmetik: `FrameLoop.resetRAF()` ruft `rafUniqueInstance?.stop()`,
     und ein Treiber, den `detach()` bereits angehalten hat, liefe dort in
     `cancelAnimationFrame(0)` — unter bare node, wo der Spec läuft, ist das ein
     `ReferenceError`.
   - Der Typverweis auf `FrameLoop` in `RAF` ist zulässig, obwohl die Klasse
     weiter unten steht: er ist rein statisch, zur Laufzeit wird nichts gelesen.
   - `off(this, OnRAF, loop)` ist die Namensform mit Listener-Objekt und nimmt in
     eventize v6 die Retain-Politik des Namens mit. Hier folgenlos, weil auf einem
     `RAF` nie `retain()` gerufen wird — wer das später ändert, ändert diese Zeile
     mit.

3. **`FrameLoop` reicht durch** (`FrameLoop.ts`, Zeilen 185-213): In `start()`
   ersetzt `this.raf.attach(this)` das `on(this.raf, OnRAF, this as FrameLoop)`,
   in `stop()` ersetzt `this.raf.detach(this)` das `off(this.raf, OnRAF, this)`.
   Die beiden Bedingungen (`subscriptionCount === 1` beziehungsweise `=== 0`)
   bleiben, wie sie sind. Das `on(this as FrameLoop, FrameLoop.OnFrame, target)`
   und das `off(this, FrameLoop.OnFrame, target)` bleiben unberührt — sie
   betreffen die Abonnenten des Loops, nicht den Treiber.

4. **Das Messfenster nach einem Halt** — dafür zuerst ein roter Fall im selben
   `describe`-Block: `re-anchors its fps window after a pause`. Renderer-Stub,
   `loop.start(target)`, 31 Ticks im 60-Hz-Raster, so dass ein Sample entsteht
   (`events[30].measuredFps === 60`, dasselbe Muster wie `FrameLoop.spec.ts:94-107`),
   dann `loop.stop(target)`, dann eine Pause von 5000 ms im Zeitstempel, dann
   `loop.start(target)` und weitere 30 Ticks im 60-Hz-Raster: das nächste Sample
   ist wieder 60 und nicht der einstellige Wert, den eine über die Pause hinweg
   gemessene Spanne ergibt.

   Der Fix in `RAF`: Feld `#needsMeasureAnchor = true;`, und `measureFps()`
   (Zeile 84-112) prüft es statt `this.frameNo === 0`:

   ```ts
   if (this.#needsMeasureAnchor) {
     this.measureTimeBegin = now;
     this.measureOnFrame = this.frameNo + MEASURE_FPS_AFTER_NTH_FRAME;
     this.#needsMeasureAnchor = false;
     return;
   }
   ```

   `stop()` setzt es wieder auf `true`. Beim allerersten Tick ist `frameNo === 0`,
   also `measureOnFrame === 30` wie bisher — die fünf vorhandenen FPS-Fälle
   bleiben unverändert grün. Der erklärende Kommentar über dem alten
   `frameNo === 0`-Zweig (Zeilen 86-88) wird auf den neuen Sachverhalt
   umgeschrieben, nicht gelöscht: er nennt den Grund, warum der erste Tick kein
   Sample liefern kann.

5. **Die zwei Assertionen mitziehen, die der Umbau umwirft**
   (`FrameLoop.spec.ts`, `describe('resetRAF()')`):

   - Zeile 262-264: `expect(firstCallback, 'the driver installs itself on the
     renderer').not.toBeNull()` misst den Autostart. Zwischen die Konstruktion und
     das Auslesen von `renderer.callback` kommt ein `loop.start(target)` mit einem
     eigenen Target; die Assertion bleibt im Wortlaut, was sie sagt, wird nur
     wahr, nachdem jemand zuhört. Die Konstruktionen in diesem Fall stehen heute
     inline in der `expect(...)`-Zeile und brauchen dafür je eine Variable.
   - Zeile 291-292: `expect(rafIDs, 'the driver has asked for a frame')
     .toHaveLength(1)` ebenso — `loop.start(target)` davor.

   Kein weiterer Fall der Datei ist betroffen: alle übrigen gehen über
   `subscribe(loop)`, das `loop.start(target)` ruft.

6. **Roter Test für die Stylesheet-Regeln** — neue Datei
   `packages/twopoint5d-testing/test/stylesheets.test.js`. Sie braucht kein
   WebGPU und kein `Display`, nur `import {Stylesheets} from '@spearwolf/twopoint5d'`.
   Der Modulzustand von `Stylesheets` ist je Testdatei frisch, wandert aber von
   Fall zu Fall; deshalb bekommt jeder Fall einen eigenen Regelnamen und misst
   `Stylesheets.getGlobalSheet().cssRules.length` relativ — vorher lesen, nachher
   lesen, Differenz prüfen. Drei Fälle:

   - `installs one rule per name, whatever the css`: zweimal
     `Stylesheets.installRule(name, …)` mit **verschiedenem** css; die Zahl der
     Regeln im Blatt wächst um genau eins. Heute rot: sie wächst um zwei.
   - `the second call wins`: nach den beiden Aufrufen trägt das Blatt den Wert des
     zweiten. Die Regel wird über ihren Selektor `.${className}` gesucht, den
     `installRule()` zurückgibt; geprüft wird eine Eigenschaft, die im css steht
     (etwa `cursor`), nicht der rohe `cssText`, den der Browser normalisiert.
   - `an unchanged css installs nothing`: zweimal derselbe Aufruf, die Zahl wächst
     um eins. Läuft heute schon grün — der frühe Ausstieg ist die eine Hälfte des
     Zweigs, die nie erreicht wird, und dieser Fall hält fest, dass sie es nach
     dem Fix wird.

7. **`Stylesheets.installRule()` füllt seinen Cache** (`Stylesheets.ts`):

   - Zeile 8 wird `const installedRules = new Map<string, {rule: CSSStyleRule; css: string}>();`.
   - `installRule()` (Zeile 25-44) in dieser Gestalt:

     ```ts
     const sheet = Stylesheets.getGlobalSheet(root);
     const className = `${name}-${postFixID}`;

     const prevRule = installedRules.get(name);
     if (prevRule != null) {
       if (prevRule.css === css) {
         return className;
       }
       // the rule object stays valid wherever it sits in the sheet: writing through it
       // cannot be thrown off by a rule someone else inserted in front of it
       prevRule.rule.style.cssText = css;
       prevRule.css = css;
       return className;
     }

     const index = sheet.insertRule(`.${className} {${css}}`, sheet.cssRules.length);
     installedRules.set(name, {rule: sheet.cssRules[index] as CSSStyleRule, css});

     return className;
     ```

     `insertRule()` gibt den Index der eingefügten Regel zurück; die lokale
     Variable `selector` entfällt damit, `index` als Vorabberechnung ebenso.
   - `installRule()` bekommt einen TSDoc-Block, der den Vertrag nennt: ein Name
     trägt genau eine Regel im globalen Blatt, ein Aufruf mit anderem css schreibt
     sie um, ein Aufruf mit demselben css tut nichts, und der Rückgabewert ist der
     postfixierte Klassenname. Kein Rückblick auf den Vorzustand.
   - Ein Kommentar an der Map hält fest, woran sie hängt: `getGlobalSheet()`
     liefert für den ganzen Modullauf dasselbe Blatt, und die Map führt ihre
     Einträge unter dieser Annahme. Wer mehrere Blätter einführt, führt die Map je
     Blatt.

8. **Roter Test für die beiden Display-Fälle** — in
   `packages/twopoint5d-testing/test/display-dispose.test.js`:

   - Im Fall `reports the disposed state and keeps its last values` fallen die
     Zeilen 136-137 weg; die beiden Getter sind dort kein Fall mehr für »keeps its
     last values«.
   - Neuer Fall `isWebGPUBackend and isWebGLBackend throw after dispose()`: Display
     bauen, beide Getter einmal lebend lesen und prüfen, dass sie einen `boolean`
     liefern, `dispose()`, dann beide über `expect(() => …).to.throw(…)` prüfen —
     je eine Assertion auf Klasse und Member (`/Display#isWebGPUBackend/`) und eine
     auf den Zustand (`/disposed/`), im Stil des `canvas`-Falls in Zeile 63-74.
   - Neuer Fall `a dispose() before the renderer is ready leaves the frame loop
     empty`. Er darf die Init-Zeit nicht raten, also hängt er sich über die Option
     `createRenderer` in die Renderer-Erzeugung und verlängert deren `init()`:

     ```js
     import {WebGPURenderer} from 'three/webgpu';

     let rendererIsUp;
     const rendererUp = new Promise((resolve) => { rendererIsUp = resolve; });
     let releaseInit;
     const initReleased = new Promise((resolve) => { releaseInit = resolve; });

     host = makeContainer();
     display = new Display(host, {
       createRenderer: (params) => {
         const renderer = new WebGPURenderer({...params});
         const realInit = renderer.init.bind(renderer);
         // the display waits on a promise that outlives the real init, so the test
         // can land its dispose() inside the window the constructor waits in
         renderer.init = () => realInit().then(rendererIsUp).then(() => initReleased);
         return renderer;
       },
     });

     await rendererUp;
     expect(display.frameLoop.subscriptionCount, 'before the display is up').to.equal(0);

     display.dispose();
     releaseInit();
     await wait(50);

     expect(display.frameLoop.subscriptionCount, 'after the init promise settles').to.equal(0);
     ```

     `await rendererUp` stellt sicher, dass der echte `init()` durch ist, bevor
     `dispose()` fällt — sonst träfe `renderer.dispose()` einen halb aufgebauten
     Renderer, und der Test prüfte etwas anderes als seinen Namen. Heute rot: die
     letzte Assertion liest `1`.

9. **Die beiden Änderungen in `Display.ts`:**

   - Zeilen 324-330: beide Getter prüfen `if (this.#disposed) throw
     disposedError('isWebGPUBackend')` beziehungsweise `…('isWebGLBackend')`,
     bevor sie `this.renderer?.backend` lesen. Geprüft wird `#disposed` und nicht
     `renderer == null`: der Getter fragt nach dem Zustand des Displays, und
     `isDisposed` ist die Zusage, an der ein Aufrufer sich vorher absichert.
     `disposedError()` (Zeile 46-48) bleibt unverändert — ihr Wortlaut ist in
     `docs/resource-lifecycle.md:106-111` zitiert.
   - Jeder der beiden bekommt einen TSDoc-Block nach dem Muster von `canvas`
     (Zeilen 311-316): was er beantwortet, und dass er nach `dispose()` wirft,
     weil der Renderer, den er befragt, weg ist.
   - Zeilen 447-449: der Rumpf des `.then()` beginnt mit `if (this.#disposed) return;`
     und einem Kommentar, der sagt, was der Guard verhindert — ein `dispose()`
     innerhalb dieses `await` legt das entsorgte Display sonst zurück in die
     Abonnentenliste des Loops, wo es bis zum Seitenende bleibt.
   - Das Klassen-TSDoc, Zeilen 79-81: der Satz »`isWebGPUBackend` and
     `isWebGLBackend` are `false` — the renderer they ask about is gone« wandert
     aus der Aufzählung der Member, die ihren letzten Wert behalten, in den Satz
     davor, der die werfenden Member nennt (heute `canvas`, `start` und
     `getEventProps`).

10. **Was in `Display.ts` unangetastet bleibt**, ausdrücklich:

    - `dispose()` (Zeilen 762-775). Der Codeblock in
      `docs/resource-lifecycle.md:159-186` zitiert die Methode Wort für Wort; ein
      Eingriff dort zöge das Zitat nach sich, und dieses Paket braucht keinen.
    - Die Zeile `this.#waitForRenderer.then(…)` behält ihre Gestalt: kein `?.`.
      Dass `#waitForRenderer` im Renderer-Zweig des Konstruktors nie zugewiesen
      wird und dieser Pfad schon vor jedem `dispose()` bricht, ist ein eigener
      Eintrag der Queue mit dem Urteil »→ Audit« — er geht als neues Finding in
      die `./audit.html` und nicht in dieses Paket.
    - `Stylesheets.getGlobalSheet()`. Dass es sein `root`-Argument nach dem ersten
      Aufruf ignoriert, ist ebenfalls ein Queue-Eintrag mit dem Urteil
      »→ Audit«.

11. **CHANGELOG**, `packages/twopoint5d/CHANGELOG.md` unter `[Unreleased]`, nach
    dem Skill `updating-changelog`:

    - In `### Changed` den vorhandenen `Display`-Eintrag (Zeile 61) an der einen
      Stelle richtigstellen, an der er nicht mehr stimmt: die beiden
      Backend-Getter werfen jetzt, statt `false` zu antworten. Der Rest des Satzes
      bleibt Wort für Wort stehen.
    - In `### Changed` ein Eintrag zum `FrameLoop`: der geteilte rAF-Treiber läuft
      genau, solange mindestens ein `FrameLoop` Abonnenten hat, und er läuft von
      selbst wieder an, wenn einer zurückkommt. Nennen, dass ein `FrameLoop` ohne
      Abonnenten keine Frames mehr anfordert.
    - In `### Fixed` zwei Einträge: `Stylesheets.installRule()` hält eine Regel je
      Name und schreibt sie um, statt eine weitere anzuhängen; und ein `Display`,
      das entsorgt wird, bevor sein Renderer bereit ist, hängt sich nicht mehr in
      seinen Frame-Loop.
    - Ein `### Migration Guide`-Abschnitt existiert unter `[Unreleased]` bereits.
      Die werfenden Backend-Getter gehören hinein: wer sie nach `dispose()` liest,
      fragt vorher `isDisposed`.

12. **Sonst nichts.** Keine Änderung an `docs/resource-lifecycle.md` — dieses
    Paket folgt den Regeln, es schreibt keine. Keine Änderung an
    `apps/lookbook/` — `display-multi.astro:89-91` liest die beiden Getter an
    einem lebenden Display, und `pnpm typecheck` fährt `astro check` darüber.
    Keine neue öffentliche API: `RAF` ist modulintern, `#loops`,
    `#needsMeasureAnchor` und `installedRules` sind privat. Was beim Lesen der
    drei Dateien auffällt und nicht hierher gehört, wird als Nebenbefund mit Datei
    und Zeile gemeldet, nicht behoben.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser`
  — `test:browser` ist nicht optional: der Vertrag nach `dispose()` und das
  Verhalten von `Stylesheets` sind beide DOM-abhängig und werden ausschließlich
  dort belegt, weil Vitest ohne DOM läuft. `test:ci` deckt `FrameLoop.spec.ts` ab,
  `typecheck` fährt `astro check` über den Lookbook, der beide Backend-Getter
  liest. In Zug 0 gegen den heutigen Stand erprobt, Exit 0 in 23 s — lint,
  typecheck und `test:ci` kamen aus dem Nx-Cache, der Browser-Lauf lief wirklich
  (13 s). Nach der Änderung laufen alle vier echt.
- Commit: `fix(display): stop the idle rAF driver, keep one style rule per name, guard the backend getters`
- Ergebnis: 1 Runde · alle vier Befunde behoben · der geteilte rAF-Treiber
  zählt seine `FrameLoop`s und hält beim Übergang 1 → 0 an, `Stylesheets` trägt
  eine Regel je Name und schreibt sie über das Regelobjekt um, der Konstruktor
  legt ein früh entsorgtes Display nicht mehr in den Frame-Loop zurück, und die
  beiden Backend-Getter werfen nach `dispose()` · Regressionstests, alle vor dem
  Fix rot gesehen: `stops when the last loop lets go of it`, `starts again when a
  loop comes back`, `is taken off the renderer when the last loop lets go`,
  `keeps running while another loop still holds it`, `re-anchors its fps window
  after a pause` (`FrameLoop.spec.ts`), die drei Fälle in `stylesheets.test.js`,
  `isWebGPUBackend and isWebGLBackend throw after dispose()` und `a dispose()
  before the renderer is ready leaves the frame loop empty`
  (`display-dispose.test.js`) · der Reviewer hat jeden davon selbst gegen den
  Vorzustand rot und gegen den Fix grün gesehen · klein und offen gelassen:
  das TSDoc von `FrameLoop.resetRAF()` (`FrameLoop.ts:161-172`) nennt nicht,
  dass ein überlebender `FrameLoop` den verworfenen Treiber über `attach()`
  wieder weckt; `Stylesheets.installRule()` (`Stylesheets.ts:50`) schriebe ins
  Leere, nähme jemand die Regel aus dem Blatt (im Repo tut das niemand, kein
  `deleteRule`); der ältere Migrations-Block (`CHANGELOG.md:107-110`) zählt die
  werfenden `Display`-Member ohne die beiden Backend-Getter auf, die erst der
  neue Block bei `:145` nennt · Verify ohne Nx-Cache erzwungen, alle vier Läufe
  echt, Exit 0
- Nebenbefunde: → Queue (4)
- Folgen: — · der Umbau warf vier Assertionen in `FrameLoop.spec.ts` um, die den
  Autostart des Treibers maßen (zwei aus Schritt 5 des Detailplans, zwei
  weitere); alle vier sind mitgezogen und im Wortlaut geblieben
- Schnittstellen: `Display#isWebGPUBackend` und `#isWebGLBackend` werfen nach
  `dispose()` denselben Fehler wie `#canvas` (`Display#<member> is not
  available: this display has been disposed`), statt `false` zu antworten — das
  ersetzt die entsprechende Zusage aus Paket 3 · ein `FrameLoop` fordert keine
  Frames mehr an, sobald sein letzter Abonnent geht, und fordert wieder an,
  sobald einer zurückkommt; der geteilte rAF-Treiber startet nicht mehr beim
  Konstruieren, sondern beim ersten `attach()` · `Stylesheets.installRule(name,
  css, root?)` hält genau eine Regel je Name im globalen Blatt und schreibt sie
  bei anderem css um, statt eine weitere anzuhängen; der Rückgabewert bleibt der
  postfixierte Klassenname

**Der rAF-Treiber hält nie an · low · `packages/twopoint5d/src/display/FrameLoop.ts:75-82, 202-213`**

Ein RAF-Treiber hält nie von selbst an. `FrameLoop.stop()` meldet sich beim
letzten Abgang nur mit `off(this.raf, OnRAF, this)` ab; `RAF.stop()` wird seit
Paket 3 ausschließlich aus `FrameLoop.resetRAF()` gerufen (Zeile 143), also von
Hand aus einem Teardown-Hook und aus keinem Abgangspfad heraus. Der
renderer-gebundene Treiber kommt damit durch, weil `Renderer.dispose()` von
three.js `setAnimationLoop(null)` ruft — der renderer-lose Treiber aber fordert
weiter jeden Frame an und misst FPS ins Leere, solange die Seite lebt. Der Umbau
ist kein Einzeiler: mehrere `FrameLoop`s teilen sich einen Treiber, ein Anhalten
braucht also eine Zählung auf dem Treiber selbst, und es hängt die Schleife
daran, an der jedes gerenderte Bild hängt.

**Der Stylesheet-Cache ist tot und das Blatt wächst · low · `packages/twopoint5d/src/display/Stylesheets.ts:8, 33-39`**

Die Map `installedRules` wird nirgends beschrieben; `installRule()` liest sie in
Zeile 33 und bekommt immer `undefined`. Der Zweig, der eine vorhandene Regel an
ihrem Index ersetzen soll, ist damit tot, und jeder Aufruf hängt stattdessen eine
weitere Regel an das globale Stylesheet. Es wächst monoton: eine Regel je
`new Display(...)` (`Display.ts:400`), eine weitere je erzeugtem Container
(`Display.ts:361`), eine je Fullscreen-Umschaltung (`Display.ts:574`) und eine je
Wertwechsel an `PanControl2D#cursorPanStyle` (`controls/PanControl2D.ts:141-149`).
Nichts entfernt sie je wieder, `Display#dispose()` eingeschlossen. Dass es
trotzdem richtig aussieht, ist Zufall der Kaskade: alle Regeln eines Namens teilen
denselben Selektor, und `insertRule` am Ende lässt die jüngste gewinnen.

**Der Konstruktor startet den Frame-Loop nach einem frühen `dispose()` wieder · low · `packages/twopoint5d/src/display/Display.ts:447-449`**

Das `this.#waitForRenderer.then(() => { this.frameLoop.start(this); })` am Ende
des Konstruktors ist ungeguardet. Ein `dispose()`, das vor dem Auflösen der
Renderer-Initialisierung fällt, hebt damit das `frameLoop.stop(this)` aus
`dispose()` wieder auf: `FrameLoop#start()` legt das entsorgte Display zurück in
`#subscribers` und hängt den Loop beim Übergang 0 → 1 erneut an den RAF-Treiber.
Gezeichnet wird nichts, `renderFrame()` steigt am Flag aus, aber der
Subscriber-Set wächst um je ein totes Display und hält es bis zum Seitenende.

**Die Backend-Getter antworten `false`, statt zu werfen · low · `packages/twopoint5d/src/display/Display.ts:324-330`**

`isWebGPUBackend` und `isWebGLBackend` sind als `boolean` typisiert und antworten
nach `dispose()` `false`, weil sie über `this.renderer?.backend` gehen. Ein
Aufrufer kann »Backend war WebGPU, das Display ist entsorgt« nicht von »Backend
war nie WebGPU« unterscheiden. Nach der Typregel in Abschnitt 4 der Richtlinie ist
das ein Fall für Regel 2: einen Fehler werfen, der Klasse und Zustand nennt, statt
den Typ zu belügen. Paket 3 hat sich bewusst auf seine drei Wurf-Stellen
beschränkt und stattdessen aufgeschrieben, was zutrifft; die beiden hier sind ein
eigener Entwurf, weil sie zwei Member treffen, die in jedem Aufrufer ohne
`try`/`catch` gelesen werden.

### [x] 10. texture: Stille nach dispose()

- Nebenbefund: aus Paket 4 (drei Einträge der Queue: `TextureStore.dispose()`
  emittiert nach dem Dispose-Event noch `OnRendererChanged`; die Getter von
  `TextureResource` antworten nach `dispose()` mit ihrem letzten Wert;
  `load()` nach `dispose()` registriert Effects, die niemand mehr abbaut) ·
  dazu vier Fundstellen derselben Ursache, die Zug 0 dieses Pakets an
  `TextureStore` gemessen hat und die unten in »Offene Befunde« stehen
- Ziel: `TextureStore` und `TextureResource` emittieren nach ihrem
  Dispose-Event nichts mehr, nehmen keinen `load()` mehr an und beantworten
  ihre Getter nach der Typregel aus Abschnitt 4 der Richtlinie.
- Bereich: `packages/twopoint5d/src/texture/TextureStore.ts`,
  `TextureResource.ts` und Specs
- Hängt ab von: 4
- Hash: 17e0ac6
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/src/texture/TextureStore.ts` ·
  `packages/twopoint5d/src/texture/TextureResource.ts` ·
  `packages/twopoint5d/src/texture/TextureStore.spec.ts` ·
  `packages/twopoint5d/src/texture/TextureResource.spec.ts` ·
  `packages/twopoint5d/CHANGELOG.md`. Fünf Dateien, keine sechste.

  Keine Änderung an `texture/public-api.ts`: kein neues exportiertes Symbol.

  Keine Änderung an `docs/resource-lifecycle.md`. Dieses Paket erfindet keine
  Regel, es hält drei vorhandene ein — Regel 1 und Regel 3 aus Abschnitt 4 und
  die Reihenfolge aus Abschnitt 5 (»A class others subscribe to emits its
  dispose event **before** it removes its own listeners«). Abschnitt 4 hat für
  jede der drei Regeln bereits ein Beispiel; ein viertes ist Rauschen.

#### Abgleich am Code, Zug 0 (2026-09-06)

Alle drei Einträge existieren noch. Gemessen wurde jeder einzeln, mit einer
Probe-Spec unter `src/texture/`, die danach wieder entfernt wurde.

| Eintrag | Fundstelle heute | Urteil |
| --- | --- | --- |
| `dispose()` emittiert `rendererChanged` nach dem Dispose-Event | `TextureStore.ts:555-570` — `emit(this, OnDispose)` steht in Zeile 559, `this.#renderer.set(undefined)` in 566, `off(this)` erst in 569. Die `onChange`-Brücke aus Zeile 157–160 hängt dazwischen und emittiert | unverändert, um rund 147 Zeilen verschoben; **präzisiert**: nur auf einem Store mit gesetztem Renderer. Steht `renderer` auf `undefined`, ändert `set(undefined)` nichts und es wird auch nichts emittiert |
| Getter antworten mit ihrem letzten Wert | `TextureResource.ts:189-312` | unverändert, **präzisiert**: es sind **14** Getter, nicht elf. Der Eintrag nannte sechs und schrieb »und die übrigen« |
| `load()` ohne Guard gegen `#disposed` | `TextureResource.ts:361` | unverändert, **präzisiert**: es sind fünf Effects, und sie kommen nie wieder weg |

Die Messungen im Einzelnen:

- Ein Store mit Renderer liefert beim `dispose()` die Reihenfolge
  `["dispose", "rendererChanged"]`. Ohne Renderer nur `["dispose"]`.
- Ein zerstörtes Signal gibt seinen letzten Wert weiter heraus.
  `SignalGroup.delete(this)` senkt `getSignalsCount()` auf den Ausgangswert,
  `signal.value` antwortet danach unverändert. Genau deshalb antworten
  `imageUrl`, `tileSetOptions`, `renderer`, `textureFactory` und
  `frameBasedAnimationsData` nach `dispose()` noch mit dem, was zuletzt
  darin stand — und genau deshalb musste Paket 4 `#texture` ausdrücklich
  auf `undefined` setzen, statt sich auf den Destroy zu verlassen.
- `new TextureResource(…)` → `dispose()` → `load()` registriert fünf Effects
  (drei `onChange`-Brücken, den Bild-Lade-Effect, den Renderer-Fallback) in
  einer frisch angelegten SignalGroup. Der zweite `dispose()` kehrt am Flag
  früh zurück, `getEffectsCount()` bleibt oben. Die Reihenfolge ist die
  Bedingung: wer vor dem `dispose()` einmal `load()` gerufen hat, dessen
  `#load` steht auf `true` und der zweite Aufruf kehrt ohnehin früh zurück.

#### Vier Fundstellen derselben Ursache, an `TextureStore` gemessen

Sie stehen als Nebenbefunde in »Offene Befunde« und sind diesem Paket
zugeschlagen, weil sie dieselbe Ursache haben wie der dritte Eintrag oben: ein
öffentlicher Einstiegspunkt, der nach `dispose()` weiterarbeitet und Zustand
anlegt, den der zweite `dispose()` nie mehr abbaut. Die Ziel-Zeile dieses
Pakets verlangt dieselbe Zusage ausdrücklich für beide Klassen, und ein
Paket »Stille nach dispose()« für `texture/`, das den Store weiterbauen lässt,
bräuchte drei Tage später ein zweites über dieselben zwei Dateien.

1. `parse()` (`:275`) hat keinen Guard. Drei Aufrufe auf einem entsorgten
   Store trieben `getSignalsCount()` von 1 auf 25 — acht Signale je Resource,
   und die Resources liegen in `#resources`, das nur `clearUnused()` wieder
   leert.
2. `load()` (`:238`) holt nach dem `dispose()` weiter über das Netz. Gemessen
   mit einem `fetch`-Stub: er wird gerufen.
3. `on()` (`:369`) und `onResource()` (`:171`) lassen Subscriptions liegen.
   Zwei `on()`-Aufrufe auf einem entsorgten Store hinterließen vier, ein
   `onResource()` eine — je ein `once(OnDispose)` und ein `once(OnReady)`,
   die nie wieder feuern können und die nichts mehr abmeldet.
4. `get renderer` (`:133`) antwortet mit einem Renderer, den jemand dem
   entsorgten Store zugewiesen hat. Die Brücke aus Zeile 157 ist da bereits
   zerstört, `textureFactory` bleibt also `undefined` — das Paar läuft
   auseinander, und der Store sieht lebendig aus.

#### Sechs Entscheidungen dieses Zuges

Getroffen mit dem Code vor Augen; sie stehen hier und nicht unter
»Entscheidungen« im Kopf.

1. **`TextureStore.dispose()` bekommt die Reihenfolge von `Display.dispose()`,
   keinen Guard.** `off(this)` wandert direkt hinter `emit(this, OnDispose)`.
   Abschnitt 5 der Richtlinie schreibt genau diese Form vor und zeigt sie an
   `Display`; der Nebenbefund selbst nennt `Display` als die Klasse, die die
   Zusage hält. Zwei Schwesterklassen, ein Muster. Danach ist »nach dem
   Dispose-Event kommt nichts mehr« baulich wahr statt an einem Guard hängend,
   den jemand vergessen kann. Die Alternative, die `onChange`-Brücke zu muten,
   fällt aus: Muten unterdrückt gemessen auch den Abbau von `#textureFactory`,
   der an derselben Brücke hängt.
2. **Die Getter bekommen den Guard, die Setter nicht.** Ist der Getter
   verriegelt, ist ein Schreibzugriff nach `dispose()` von außen nicht mehr zu
   beobachten: er landet gemessen in einem zerstörten Signal, dessen
   `onChange`-Brücken und Effects mit `SignalGroup.delete(this)` fort sind.
   Das ist der stille No-op, den Regel 3 verlangt, und 14 weitere Guards
   sagten dieselbe Sache ein zweites Mal.
3. **`#texture.set(undefined)` in `TextureResource.dispose()` bleibt stehen,
   obwohl der Getter jetzt ohnehin `undefined` antwortet.** Die beiden tun
   Verschiedenes: der Guard ist die Typregel, das Setzen ist die
   Ownership-Regel — es gibt die Referenz auf die Textur her, die gleich
   freigegeben wird, damit kein Leser sie erreicht. Wer eins von beiden für
   redundant hält, entfernt die Zusage aus Paket 4.
4. **`TextureStore#defaultTextureClasses` bleibt, wie es ist.** Der Getter ist
   `TextureOptionClasses[]` typisiert und fiele damit unter Regel 2, also
   »werfen«. Regel 2 richtet sich gegen zwei Dinge: eine freigegebene Ressource
   herausgeben und über Anwesenheit lügen. Ein Konfigurations-Array, das nie
   eine Ressource war und dessen Wert nach dem `dispose()` unverändert richtig
   ist, tut keins von beidem. `Display#canvas` gibt eine freigegebene Ressource
   heraus, `Display#isWebGPUBackend` antwortete `false` auf eine Frage ohne
   Antwort — das ist der Fall, für den Regel 2 da ist. Der Store hätte sonst
   ein einziges werfendes Member, das keine der drei Queue-Zeilen verlangt.
5. **`get textureFactory` bekommt den Guard trotzdem**, obwohl es nach
   `dispose()` schon `undefined` antwortet. Es tut das nur, weil die
   `onChange`-Brücke während `dispose()` zufällig noch läuft — ein Seiteneffekt
   eines Signal-Schreibzugriffs, keine ausgesprochene Zusage. Der Guard sagt
   die Zusage, und die Assertion (c) des Testmusters wird damit aus dem Code
   beweisbar statt aus einer Kette von zwei Signalen.
6. **Kein `isDisposed`-Getter an beiden Klassen.** Paket 4 hat das für
   `TextureStore` ausdrücklich entschieden (dort Entscheidung 3); dieses Paket
   kippt es nicht, und für `TextureResource` gilt dasselbe Argument.

#### Nachgesehen und ohne Befund geblieben

Damit es niemand ein zweites Mal nachsieht:

- `whenReady()`, `whenResource()` und `get()` weisen auf einem entsorgten Store
  gemessen alle drei ab. Paket 4 hat seine Arbeit getan.
- `clearUnused()` antwortet auf einem entsorgten Store `0`. Mit dem Guard an
  `parse()` bleibt `#resources` leer, es gibt also nichts mehr aufzuräumen.
- `TextureFactory` hat kein `dispose()`. Dass der Store die selbst gebaute
  Factory nur loslässt statt sie freizugeben, ist damit kein Ownership-Loch.
- `TextureResource#id`, `#type` und `#refCount` bleiben ungeguardet. Die ersten
  beiden sind `readonly` Identität — eine entsorgte Resource darf weiterhin
  sagen, welche sie war; `refCount` ist die Buchführung der Store-Abos und
  keine Ressource.
- Kein Aufrufer im Repo liest ein Member dieser beiden Klassen nach einem
  `dispose()`. Der Lookbook baut in `apps/lookbook/src/pages/demos/animated-sprites.astro:81`
  einen Store und entsorgt ihn nie.

#### Restplan

Unverändert. Die Pakete 11 bis 14 sitzen in `map2d/`, `stage/`, `controls/` und
`vertex-objects/`; keine der sieben Fundstellen dieses Pakets liegt dort, und
kein Symbol aus `texture/` steht in ihren Detailzeilen. Alle vier »Hängt ab
von« (6, 7, 7, sowie 5 und 7) sind committet. Weder Reihenfolge noch Schnitt
ändern sich.

#### Vorgehen

Alle Zeilennummern gegen den Stand von `1813d63`.

**`src/texture/TextureStore.ts`**

1. In `dispose()` (Zeile 555) `off(this)` aus Zeile 569 direkt hinter
   `emit(this, OnDispose)` in Zeile 559 ziehen. Der Rumpf lautet danach:
   `emit(this, OnDispose);` · `off(this);` · die `for`-Schleife über
   `#resources` · `this.#resources.clear();` · `this.#renderer.set(undefined);`
   · `SignalGroup.delete(this);`. Die Reihenfolgeregel aus Abschnitt 5 bleibt
   damit gewahrt: der Renderer wird hergegeben, bevor die Signalgruppe fällt.
   Kommentar über die beiden Zeilen, warum sie in dieser Reihenfolge stehen —
   die Listener hängen beim `emit` noch dran, weil das Event ihnen sagt
   loszulassen, und `off(this)` macht es zum letzten, das dieser Store je
   sendet; die Aufräumarbeit darunter gibt den Renderer her, und die
   Änderungsbrücke schöbe sonst ein `rendererChanged` hinterher.
2. `get renderer` (Zeile 133): `return this.#disposed ? undefined : this.#renderer.value;`
3. `get textureFactory` (Zeile 146): `return this.#disposed ? undefined : this.#textureFactory.value;`
4. `parse()` (Zeile 275): als erste Zeile des Rumpfs `if (this.#disposed) return;`
5. `load()` (Zeile 238): als erste Zeile des Rumpfs `if (this.#disposed) return this;`
6. `on()` (Zeile 369): als erste Zeile des Rumpfs `if (this.#disposed) return () => {};`
7. `onResource()` (Zeile 171): als erste Zeile des Rumpfs `if (this.#disposed) return () => {};`
8. TSDoc: `dispose()` (Zeile 547) sagt zusätzlich, dass das Dispose-Event das
   letzte ist, das der Store sendet, und dass `renderer` und `textureFactory`
   danach `undefined` antworten. `parse()`, `load()`, `on()` und `onResource()`
   bekommen je einen Satz, dass sie auf einem entsorgten Store nichts tun —
   Abschnitt 4 endet mit »Whichever of the three a member picks, its TSDoc says
   so«. `get renderer` und `get textureFactory` bekommen den Satz aus Regel 1.

**`src/texture/TextureResource.ts`**

9. Vierzehn Getter bekommen `return this.#disposed ? undefined : <bisheriger Ausdruck>;`,
   in dieser Reihenfolge: `imageUrl` (189), `imageCoords` (197), `atlasUrl`
   (205), `atlasJson` (213), `overrideImageUrl` (221), `atlas` (229),
   `tileSetOptions` (237), `tileSet` (245), `frameBasedAnimations` (253),
   `frameBasedAnimationsData` (261), `textureClasses` (269), `textureFactory`
   (280), `texture` (293), `renderer` (306). Alle vierzehn sind
   `T | undefined` typisiert, es gibt also keinen Fall für Regel 2.
   Ein Kommentar an der ersten Stelle sagt einmal, warum die Setter keinen
   Guard bekommen: nach `SignalGroup.delete(this)` liest niemand mehr, was
   ein Schreibzugriff dort ablegt.
10. `load()` (Zeile 361): als erste Zeile des Rumpfs
    `if (this.#disposed) return this;`
11. `dispose()` bleibt unverändert. Insbesondere bleiben die Zeilen 349–350
    (`this.#texture.muted = true;` und `this.#texture.set(undefined);`) samt
    ihrem Kommentar stehen — siehe Entscheidung 3.
12. TSDoc: der Satz in `dispose()` (Zeile 337–338) »Afterwards
    {@link TextureResource.texture} answers `undefined`; every other member
    keeps the last value it had.« wird falsch und wird ersetzt: jeder Getter
    antwortet danach `undefined`, `id` und `type` bleiben, ein Schreibzugriff
    und ein zweiter `dispose()` tun nichts. `load()` bekommt einen Satz, dass
    es auf einer entsorgten Resource nichts tut und `this` zurückgibt.

**`src/texture/TextureResource.spec.ts`**

13. Test (c) `behaves as documented after dispose()` (Zeile 164) wird von
    dieser Änderung umgeworfen und gehört zu ihr. Die drei Assertions
    `expect(resource.imageUrl).toBe('documented.png')`,
    `expect(resource.imageCoords?.width).toBe(8)` und
    `expect(resource.textureFactory).toBeDefined()` werden zu
    `toBeUndefined()`. `expect(resource.id).toBe('documented')` bleibt, dazu
    kommt `expect(resource.type).toBe('image')`. Der Kommentar über dem Test
    (»There is no member of the second kind here«) bleibt richtig und bleibt
    stehen.
14. Neuer Test im `describe('load()')`-Block:
    `load() on a disposed resource registers nothing` — `getSignalsCount()`
    und `getEffectsCount()` merken, `TextureResource.fromImage(…)`,
    `dispose()`, beide Zähler wieder auf dem Ausgangswert, dann `load()`,
    beide Zähler unverändert, dann ein zweiter `dispose()`, immer noch
    unverändert. **Vor dem Fix rot**: gemessen fünf Effects, die bleiben.

**`src/texture/TextureStore.spec.ts`**

15. Vier neue Tests im vorhandenen `describe('dispose()')`-Block (Zeile 74),
    alle vier vor dem Fix rot:
    - `emits nothing after the dispose event` — Store **mit** Renderer (ein
      `{backend: {}}`-Stub reicht, der Store liest ihn nicht), auf `dispose`
      und `rendererChanged` je einen Listener, der seinen Namen in ein Array
      schiebt, Array nach dem Aufsetzen leeren, `dispose()`, erwartet
      `['dispose']`. Gemessen heute: `['dispose', 'rendererChanged']`.
    - `parse() on a disposed store builds no resources` — `dispose()`, dann
      dreimal `parse({items: {…}})` mit verschiedenen ids,
      `getSignalsCount()` unverändert, `clearUnused()` antwortet `0`.
      Gemessen heute: 1 → 25.
    - `load() on a disposed store does not fetch` — `vi.spyOn(globalThis, 'fetch')`,
      `dispose()`, `load(url)`, ein Tick warten, Spy nicht gerufen. Der
      vorhandene Block `error events instead of console.error` (Zeile 330)
      zeigt, wie `fetch` in dieser Datei gestubbt wird.
    - `on() and onResource() on a disposed store leave no subscription` —
      `getSubscriptionCount(store)` vor und nach je zwei `on()` und einem
      `onResource()` auf dem entsorgten Store, unverändert; beide geben eine
      Abmeldefunktion zurück, die nichts tut und nicht wirft. Gemessen heute:
      vier beziehungsweise eine Subscription bleiben liegen.
16. Ein fünfter Test `behaves as documented after dispose()` — Assertion (c)
    des Musters aus Abschnitt 8, die `TextureStore` bisher nicht hat: nach
    `dispose()` und einem anschließenden `store.renderer = rendererStub`
    antworten `renderer` und `textureFactory` beide `undefined`; ein zweiter
    `dispose()`, ein Schreibzugriff auf `renderer`, `parse()`, `load()` und
    `clearUnused()` werfen nicht; `defaultTextureClasses` antwortet weiter mit
    seinem letzten Wert (Entscheidung 4, damit die Entscheidung im Test steht
    und nicht nur im Plan).

**`packages/twopoint5d/CHANGELOG.md`** (Skill `updating-changelog`, alles unter
`[Unreleased]`)

17. Der vorhandene `### Changed`-Eintrag zu `TextureResource#dispose()`
    (Zeile 63) endet auf »every other member keeps its last value« und wird
    damit falsch. In derselben Zeile korrigieren: jeder Getter antwortet
    danach `undefined`, `id` und `type` bleiben. Der Rest der Zeile
    (Ownership der Textur, der Link auf die Richtlinie) bleibt wörtlich.
18. Der vorhandene `### Changed`-Eintrag zu `TextureStore#dispose()` (Zeile 64)
    wird um die neue Zusage erweitert: das Dispose-Event ist das letzte, das
    der Store sendet; `renderer` und `textureFactory` antworten danach
    `undefined`; `parse()`, `load()`, `on()`, `onResource()` und ein
    Schreibzugriff auf `renderer` tun nichts.
19. Ein `####`-Block unter `### Migration Guide`, in der Form der vorhandenen
    Blöcke (`#### A disposed display refuses to be used`, Zeile 107, ist die
    nächstgelegene Vorlage): was ein Aufrufer merkt, der heute einen Getter
    oder `load()` nach dem `dispose()` benutzt, und was er stattdessen tut.
    Kein Rückblick auf den Vorzustand außerhalb dieses Blocks — im
    Migration Guide ist der Vorher-Nachher-Vergleich der Zweck, überall sonst
    verbietet ihn der Abschnitt »Konventionen«.

**Reihenfolge der Arbeit.** Erst die fünf roten Tests (Schritte 14, 15), dann
die Fixes, dann Schritt 13 (der umgeworfene Test), dann TSDoc und CHANGELOG.
Der rote Lauf gehört in den Report.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `test:browser` ist nicht optional: dieses Paket setzt einen Guard an den
  Anfang von `TextureResource.load()`, und
  `packages/twopoint5d-testing/test/texture-store-on.test.js` ist der einzige
  Ort, an dem die Effect-Kette dieser Methode gegen echte Bilder, echte
  Texturen und einen echten Renderer läuft. `test:ci` trägt die neuen Specs und
  fährt Vitest mit Coverage (Schwellen für `src/texture/**`: 70/61/62/70).
  `typecheck` deckt die Specs mit ab (`pnpm build` lässt sie aus) und fährt
  `astro check` über den Lookbook, der den Store benutzt. In Zug 0 gegen den
  heutigen Stand erprobt, Exit 0 in 8,9 s; alle vier Läufe kamen aus dem
  Nx-Cache, nach der Änderung laufen sie wirklich.
- Commit: `fix(texture): silence a disposed store and let a disposed resource answer undefined`
- Ergebnis: 1 Runde · alle sieben Fundstellen behoben, 19 von 19 Schritten des
  Vorgehens erfüllt · Regressionstests `emits nothing after the dispose event`,
  `parse() on a disposed store builds no resources`, `load() on a disposed store
  does not fetch`, `on() and onResource() on a disposed store leave no
  subscription`, `behaves as documented after dispose()` (TextureStore) und
  `load() on a disposed resource registers nothing` (TextureResource), dazu das
  umgeschriebene `behaves as documented after dispose()` in
  `TextureResource.spec.ts` — sieben Tests, alle vor dem Fix rot gesehen ·
  Verify `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser`
  Exit 0, ohne Nx-Cache gefahren · klein und offen geblieben: das TSDoc an
  `TextureStore#defaultTextureClasses`
  (`packages/twopoint5d/src/texture/TextureStore.ts:126`, gleichlautend in
  `:601` und `CHANGELOG.md:64`) sagt »keeps its last value once `dispose()` has
  run«, deckt aber den Schreibzugriff nach `dispose()` nicht ab: der Setter hat
  keinen Guard, und ein zerstörtes Signal nimmt den Wert weiterhin an, sodass
  der Getter danach den neu geschriebenen Wert nennt. Der Getter ist damit das
  einzige von außen les- **und** schreibbare Member des entsorgten Stores, und
  das steht nirgends. Eine Formulierung in der Art »answers the value it was
  last given, before or after `dispose()`« deckt den Code
- Nebenbefunde: → Queue (drei neu; die beiden weiteren, die Implementierer und
  Reviewer gemeldet haben — das `off(this, OnReady, …)` im `unsubscribe()` von
  `on()` und die nie fallende Zusage aus dem statischen `TextureStore.load()` —
  stehen dort seit Paket 4 und sind nur in ihren Zeilennummern nachgezogen)
- Folgen: keine. Kein Aufrufer außerhalb des Pakets liest ein Member der beiden
  Klassen nach einem `dispose()`;
  `apps/lookbook/src/pages/demos/animated-sprites.astro:81` baut einen Store und
  entsorgt ihn nie, `packages/twopoint5d-testing/test/texture-store-on.test.js`
  läuft gegen einen lebenden Store und ist im echten Playwright-Lauf grün
- Schnittstellen: `TextureStore#dispose()` sendet sein Dispose-Event als letztes
  Event überhaupt — `off(this)` steht unmittelbar dahinter, das
  `rendererChanged` aus dem Herausgeben des Renderers erreicht niemanden mehr,
  und auch ein nach `dispose()` angehängter Listener wird nie gerufen · danach
  antworten `TextureStore#renderer` und `#textureFactory` mit `undefined`,
  während `#defaultTextureClasses` weiter seinen Wert nennt (ein
  Konfigurations-Array, keine Ressource) · `TextureStore#parse()`, `#load()`,
  `#on()` und `#onResource()` sind auf einem entsorgten Store stille No-ops;
  `on()` und `onResource()` geben eine Abmeldefunktion zurück, die nichts tut ·
  alle vierzehn Getter von `TextureResource` antworten nach `dispose()`
  `undefined`, die Felder `id` und `type` behalten ihren Wert, und
  `TextureResource#load()` tut nichts und gibt `this` zurück · beide Klassen
  guarden ausschließlich die Getter, nicht die Setter: nach
  `SignalGroup.delete(this)` liest niemand mehr, was ein Schreibzugriff ablegt

### [x] 11. map2d: Helfer und Kacheln kommen zurück

- Nebenbefund: aus Paket 6 (zwei Einträge der Queue, beide medium: die
  Punkt-Helfer in `CameraBasedVisibilityHelpers` lecken Geometry und Material
  je Frame, weil `HelpersManager` einem `Mesh` ein `dispose()` unterstellt;
  `Map2DTileRenderer.dispose()` gibt die Kacheln nicht per `destroyTile()` an
  die Factory zurück)
- Ziel: Jeder Helfer gibt beim Entfernen frei, was er selbst gebaut hat, und
  ein entsorgter `Map2DTileRenderer` gibt jede Kachel an ihre Factory zurück.
- Bereich: `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`,
  `HelpersManager.ts`, `Map2DTileRenderer.ts`, `TileSprites/TileSpritesFactory.ts`
  und Specs
- Hängt ab von: 6
- Hash: 894f9b4
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts` ·
  `packages/twopoint5d/src/map2d/HelpersManager.ts` ·
  `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts` ·
  `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts` (neu) ·
  `packages/twopoint5d/src/map2d/Map2DTileRenderer.spec.ts` ·
  `packages/twopoint5d/docs/resource-lifecycle.md` ·
  `packages/twopoint5d/CHANGELOG.md`. Sieben Dateien, keine achte.

  Keine Änderung an `map2d/public-api.ts`: die neue Klasse `PointHelper` bleibt
  dateilokal und wird nicht exportiert. `CameraBasedVisibilityHelpers.ts` hängt
  zwar an einem `export *`, aber was die Datei nicht exportiert, verlässt sie
  nicht.

  Keine Änderung an `TileSprites/TileSpritesFactory.ts`, obwohl die
  Bereich-Zeile des Grobplans sie nennt. Begründung unten unter »Nachgesehen und
  ohne Befund geblieben«.

#### Abgleich am Code, Zug 0 (2026-09-06)

Beide Einträge existieren unverändert. Gemessen wurde jeder einzeln, mit einer
Probe-Spec unter `src/map2d/`, die danach wieder entfernt wurde; der
Arbeitsbaum ist sauber.

| Eintrag | Fundstelle heute | Urteil |
| --- | --- | --- |
| Punkt-Helfer lecken Geometry und Material | `CameraBasedVisibilityHelpers.ts:118-122` (`addPointHelper()`) gegen `HelpersManager.ts:55-58` (`removeFromScene()`) | unverändert, **belegt**: von fünf Knoten, die ein eingeschaltetes `show` in die Szene hängt, gibt genau einer frei |
| `dispose()` gibt die Kacheln nicht zurück | `Map2DTileRenderer.ts:104-113` | unverändert, **belegt**: kein einziger `destroyTile()`-Aufruf beim `dispose()` |

Die Messungen im Einzelnen:

- `helpers.show = true` auf einer Szene hängt fünf Knoten hinein: einen
  `PlaneHelper` und vier Punkt-Helfer (Punkt auf der Ebene, Ursprung der Ebene,
  die beiden Einheitsvektoren). `helpers.show = false` nimmt alle fünf wieder
  heraus — `scene.children` ist danach leer. Die Freigabe zählt anders:
  `PlaneHelper: geometry=1 material=1`, viermal `Mesh: geometry=0 material=0`.
  `THREE.Mesh` hat kein `dispose()`, der optionale Aufruf in
  `HelpersManager.removeFromScene()` greift ins Leere, und `BoxGeometry` und
  `MeshBasicMaterial` je Punkt-Helfer bleiben liegen. `Box3Helper` und
  `PlaneHelper` haben eines (`three/src/helpers/Box3Helper.js:74-79`,
  `PlaneHelper.js:85-92`) und werden korrekt abgeräumt.
- Ein `Map2DTileRenderer` mit zwei Kacheln liefert beim `dispose()` die
  Aufruffolge `["createTile:y0x0", "createTile:y0x1", "removeFromNode"]`.
  `destroyTile` kommt darin nicht vor. Die beiden Slots bleiben in der Factory
  belegt.
- Die Bauform, die das Paket einführt, trägt: eine Klasse
  `extends Mesh<BoxGeometry, MeshBasicMaterial>` mit einem eigenen `dispose()`
  compiliert unter `pnpm typecheck` ohne `override` (three.js hat auf `Mesh`
  keines), feuert beide Dispose-Events genau einmal und behält `type === 'Mesh'`
  und `isMesh === true`.

#### Die beiden Einträge im Wortlaut

**Punkt-Helfer · medium · `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:118-122` und `HelpersManager.ts:55-58`**

Die Punkt-Helfer lecken Geometry und Material, und zwar je Frame.
`addPointHelper()` baut ein `new Mesh(new BoxGeometry(…), new
MeshBasicMaterial({color}))`; `HelpersManager.removeFromScene()` räumt einen
Helfer mit `childNode.removeFromParent()` und
`(childNode as {dispose?}).dispose?.()` ab. `THREE.Mesh` hat kein `dispose()`,
der optionale Aufruf greift ins Leere, und Geometry und Material bleiben liegen —
anders als bei `Box3Helper` und `PlaneHelper`, die beide eines haben. Der
Verbrauch ist kein Einmaleffekt: `CameraBasedVisibilityHelpers#update()`
(Zeile 149–154) ruft `#helpers.remove()` und danach `createHelpers()`, und
`createPlaneHelpers()` legt dabei drei bis vier Punkt-Helfer neu an — bei
eingeschalteten Helfern also je gerendertem Bild. `RectangularVisibilityAreaHelpers`
ist nicht betroffen, es benutzt ausschließlich `Box3Helper`.

**Kacheln · medium · `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:110`**

`dispose()` leert `#tiles` mit `clear()`, ohne für die Kacheln `destroyTile()` zu
rufen. Die Kacheln gehören der Factory: bei `TileSpritesFactory` sind es
`TileSprite`-Slots aus dem `instancedPool` der Geometrie
(`TileSprites/TileSpritesFactory.ts:64-66`). Wer eine Factory an einen zweiten
Renderer weiterreicht, verliert die Slots des ersten — sie bleiben belegt und
kommen nie zurück. Das TSDoc über `Map2DTileRenderer#dispose()` benennt das
seit Paket 6 ausdrücklich, und der Dispose-Test assertiert dort bewusst nichts,
damit das Verhalten nicht festgeschrieben wird.

#### Fünf Entscheidungen dieses Zuges

1. **Der Punkt-Helfer bekommt ein eigenes `dispose()`, der `HelpersManager`
   bleibt dumm.** Drei Wege waren gangbar: der Manager entsorgt Geometry und
   Material jedes Kindknotens selbst; die beiden Helfer-Klassen führen Buch und
   entsorgen, was sie gebaut haben; oder der Punkt-Helfer wird zu einer Klasse
   mit `dispose()`, wie `Box3Helper` und `PlaneHelper` es sind. Der dritte
   gewinnt: die Freigabe steht neben der Allokation, der Manager greift nicht in
   fremde Knoten hinein, und die Bauform ist die, die three.js für genau diesen
   Zweck vorgibt. Der erste Weg behandelt einen Knoten mit eigenem `dispose()`
   und einen ohne unterschiedlich tief; der zweite verdoppelt die Buchführung,
   die der Manager über `userData` schon führt.
2. **`HelpersManager.add()` ist eine Übergabe, und das wird hingeschrieben.**
   Der Code entscheidet die Eigentumsfrage längst — `removeFromScene()` ruft
   `dispose()` auf dem, was ihm gegeben wurde, und der Aufrufer hält nach dem
   `add()` keine Referenz mehr. Was fehlt, ist der Satz dazu. Er kommt als TSDoc
   an `add()` und `removeFromScene()` und nennt die Bedingung, die ein Knoten
   erfüllen muss: was er besitzt, gibt er in seinem eigenen `dispose()` frei.
   Kein Übernahme-Schalter, Abschnitt 2 der Richtlinie verbietet ihn.
3. **`dispose()` gibt die Kacheln über `clearTiles()` zurück, nicht über eine
   zweite Schleife.** `clearTiles()` ist die Stelle der Klasse, die jede Kachel
   an die Factory zurückgibt; eine Kopie davon in `dispose()` hieße, dieselbe
   Rückgabe an zwei Stellen zu pflegen. Der `++#dataSerial` darin ist folgenlos,
   weil `dispose()` beide Seriennummern zwei Zeilen später zurücksetzt.
   Reihenfolge: erst die Kacheln zurück, dann `removeFromNode()`, dann die
   Factory loslassen — der Weg zur Factory muss offen sein, solange noch etwas
   zurückzugeben ist.
4. **Die Richtlinie bekommt die Regel, die hier gefehlt hat.** Paket 6 hat aus
   Abschnitt 2 (»touch none that was handed in«) gelesen, dass die Kacheln
   fallen gelassen werden müssen, und das im TSDoc festgehalten. Die Lesart ist
   nicht abwegig, sie ist nur unvollständig: geliehen ist nicht besessen, und
   Zurückgeben ist nicht Freigeben. Diese Regel steht bisher nirgends. Sie kommt
   als eigener Absatz ans Ende von Abschnitt 2 und als Halbsatz in Schritt 1 der
   Checkliste in Abschnitt 7. Ohne sie bricht dieselbe Stelle beim nächsten
   Modul wieder auf — das ist die Ursache, die Fundstelle war nur ihr Symptom.
5. **Kein Migrations-Abschnitt.** Der Grund ist nicht Bequemlichkeit: ein
   Aufrufer muss nichts ändern. `destroyTile()` bekommt beim `dispose()` genau
   die Objekte, die es über `removeTile()` und `clearTiles()` ohnehin schon
   bekommt, und keine Signatur bewegt sich. Die `Changed`-Zeile des CHANGELOG
   trägt die Verhaltensänderung; ein Migrations-Block ohne Handlungsanweisung
   wäre Rauschen. Ebenso wenig wird der vorhandene Block
   »`Map2DTileRenderer#tileFactory` is `null` after `dispose()`« erweitert — er
   hat ein anderes Thema.

#### Nachgesehen und ohne Befund geblieben

- **`TileSprites/TileSpritesFactory.ts` braucht keine Änderung.** Die
  Bereich-Zeile des Grobplans nennt die Datei, weil der Eintrag sie als
  Fundstelle der Slots zitiert. `destroyTile()` (`:64-66`) tut bereits das
  Richtige — `instancedPool.freeVO(tile)`. Was fehlte, war der Aufruf, und der
  liegt im Renderer. Paket 6 hat Änderungen an dieser Datei in Schritt 11 seines
  Detailplans ausdrücklich verboten; es gibt keinen Grund, das jetzt aufzumachen.
- **`RectangularVisibilityAreaHelpers` ist nicht betroffen.** Es baut
  ausschließlich `Box3Helper` (`:56`), und der hat ein `dispose()`. Der Fix an
  `HelpersManager` wirkt für diese Klasse nur als Dokumentation.
- **Keine zweite Stelle im Repo hält geliehene Slots und lässt sie beim
  `dispose()` fallen.** Nachgesehen über alle Aufrufer von `createVO()`,
  `freeVO()`, `createTile()` und `destroyTile()`:
  `TexturedSprites#createSprite()` reicht den Sprite an den Aufrufer heraus und
  hält ihn nicht, `AnimatedSpritesGeometry` und `TexturedSpritesGeometry` bauen
  je einen Basis-Sprite, der mit der Geometrie stirbt. `Map2DTileRenderer` ist
  die einzige Klasse, die geliehene Slots in einer eigenen Map sammelt. Der
  Eintrag ist damit ein Einzelfall und kein Symptom einer breiteren Ursache im
  Code — die Ursache liegt in der Richtlinie, siehe Entscheidung 4.
- **Die Helfer-Klassen bekommen kein `dispose()`.** `CameraBasedVisibilityHelpers`
  und `RectangularVisibilityAreaHelpers` bieten mit `show = false` und
  `remove(scene)` bereits zwei Abbauwege, und beide laufen über
  `HelpersManager.removeFromScene()`, das nach diesem Paket vollständig freigibt.
  Ein drittes, `dispose()` genanntes Verfahren wäre ein Alias auf
  `show = false`. `IMap2DVisibilitorHelpers` (`types.ts:112-117`) kennt kein
  `dispose()`, und keines hinzuzufügen hält die Schnittstelle für fremde
  Implementierungen offen.

#### Restplan

Die Pakete 12 (`stage`), 13 (`controls`) und 14 (`vertex-objects`) sind von
diesem Paket nicht berührt: keine gemeinsame Datei, keine Signatur, die sich
bewegt, und `Hängt ab von: 6` ist mit `8940644` erfüllt. Reihenfolge und
Schnitt bleiben, wie sie stehen.

Der Absatz, den dieses Paket in Abschnitt 2 der Richtlinie ergänzt, betrifft
Paket 14 am Rande: dort geht es um `VOBufferPool#createFromAttributes()` nach
`dispose()`, also um den Pool selbst und nicht um einen Halter geliehener Slots.
Zug 0 von Paket 14 liest die Regel dann in ihrer neuen Fassung — das ist
Absicht, nicht Zufall, und kostet nichts.

Drei neue Nebenbefunde stehen unter »Offene Befunde«, alle drei mit Urteil
`→ Audit`: die tote Zwillingsmethode `TileSpritesFactory#freeTileSprite()`, der
harte DOM-Zugriff in `createHelpers()` und der Neubau aller Helfer je Frame.
Keiner davon berührt Ownership, `dispose()` oder monotones Wachstum, keiner
ändert den Schnitt eines offenen Pakets.

#### Vorgehen

1. **`CameraBasedVisibilityHelpers.ts` — die Klasse `PointHelper` anlegen.**
   Dateilokal, nicht exportiert, oberhalb von `CameraBasedVisibilityHelpers`:

   ```ts
   /**
    * A solid box marking a point in the scene, in the shape the three.js helpers have: it owns
    * the geometry and the material it is built from and releases both in {@link dispose}. That
    * is what {@link HelpersManager.add} asks of a node handed to it.
    */
   class PointHelper extends Mesh<BoxGeometry, MeshBasicMaterial> {
     constructor(size: number, color: ColorRepresentation) {
       super(new BoxGeometry(size, size, size), new MeshBasicMaterial({color}));
     }

     dispose(): void {
       this.geometry.dispose();
       this.material.dispose();
     }
   }
   ```

   Kein `override` — `THREE.Mesh` hat kein `dispose()`, das überschrieben würde.
   Der Typimport in Zeile 1 wird um `ColorRepresentation` erweitert:
   `import type {Box3, ColorRepresentation, Object3D} from 'three/webgpu';`.
   `Mesh`, `BoxGeometry` und `MeshBasicMaterial` stehen bereits im Wertimport in
   Zeile 2 und bleiben dort.

2. **`CameraBasedVisibilityHelpers.ts:118-122` — `addPointHelper()` auf die neue
   Klasse ziehen.** Der Rumpf wird zu:

   ```ts
   private addPointHelper(point: Vector3, addToRoot = true, size = 10, color = 0x20f040) {
     const poiBox = new PointHelper(size, color);
     poiBox.position.copy(point);
     this.#helpers.add(poiBox, addToRoot);
   }
   ```

   Signatur, Vorgabewerte und alle vier Aufrufstellen (`:70`, `:73`, `:80`,
   `:81`) bleiben unverändert.

3. **`HelpersManager.ts` — den Übernahme-Vertrag hinschreiben.** TSDoc an
   `add()` (`:33`):

   ```ts
   /**
    * Inserts a node and takes it over: {@link removeFromScene} takes it out of the scene graph
    * again and calls its `dispose()` if it has one. A node that owns a geometry, a material or
    * a texture therefore has to release it there — `Box3Helper` and `PlaneHelper` of three.js
    * do, and a bare `THREE.Mesh` has no `dispose()` for the call to reach.
    */
   ```

   und an `removeFromScene()` (`:48`):

   ```ts
   /**
    * Takes every node this manager added to `scene` out of it, and calls `dispose()` on each one
    * that has such a method. What a node has to bring for that to be enough stands at {@link add}.
    */
   ```

   Am Code dieser Datei ändert sich nichts.

4. **`Map2DTileRenderer.ts:104-113` — `dispose()` gibt die Kacheln zurück.**

   ```ts
   dispose(): void {
     const tileFactory = this.tileFactory;
     if (tileFactory === null) return;

     // a tile is a slot the factory handed out through createTile(); giving it back is the
     // other half of that call, and clearTiles() is the one place in this class that does it
     this.clearTiles();

     tileFactory.removeFromNode(this.node);
     this.tileFactory = null;
     this.#dataSerial = 0;
     this.#updateDataSerial = -1;
   }
   ```

   Der Wächter `tileFactory === null` bleibt der erste Ausdruck der Methode, und
   `clearTiles()` läuft nur, solange er nicht greift — die Idempotenz aus Paket 6
   bleibt damit unverändert, und `removeFromNode()` fällt weiterhin genau einmal.

5. **`Map2DTileRenderer.ts:94-103` — das TSDoc auf den neuen Vertrag bringen.**

   ```ts
   /**
    * Gives every tile this renderer still holds back to the factory with
    * {@link IMapTileFactory.destroyTile}, takes the factory content out of {@link node} and
    * gives the factory up: {@link tileFactory} answers `null` afterwards.
    *
    * Releases nothing of its own — the factory is handed to the constructor and belongs to the
    * caller, and `IMapTileFactory` has no `dispose()` to call. A tile is not owned either, it is
    * borrowed: with `TileSpritesFactory` it is a slot in the `instancedPool` of the geometry, and
    * a factory that goes on to serve a second renderer gets every one of them back. {@link node}
    * keeps its `Object3D`; the factory has taken its content out of it. A second call does
    * nothing.
    */
   ```

6. **`Map2DTileRenderer.spec.ts` — der Regressionstest, vor dem Fix rot.** Als
   erster Test in den vorhandenen `describe('dispose()')`-Block, vor
   `'does NOT release the tile factory that was handed in'`:

   ```ts
   test('gives every tile it holds back to the factory', () => {
     const tileFactory = makeTileFactory();
     const renderer = new Map2DTileRenderer(tileFactory);
     const destroyTile = sandbox.spy(tileFactory, 'destroyTile');

     renderer.addTile(new Map2DTileCoords(0, 0));
     renderer.addTile(new Map2DTileCoords(1, 0));
     renderer.endUpdatingTiles();

     renderer.dispose();

     expect(destroyTile.callCount).toBe(2);
     expect(destroyTile.getCalls().map((call) => (call.args[0] as FakeTile).coords.id)).toEqual(['y0x0', 'y0x1']);
   });
   ```

   Die beiden Ids sind gemessen, nicht geraten. Der Test ist vor dem Fix rot mit
   `callCount === 0`; der rote Lauf gehört in den Report.

7. **`Map2DTileRenderer.spec.ts` — Assertion (d) nachziehen.** Der vorhandene
   Test `'is safe to call twice'` bekommt eine Kachel und einen Spy, damit der
   zweite Aufruf belegt nichts ein zweites Mal zurückgibt:

   ```ts
   test('is safe to call twice', () => {
     const tileFactory = makeTileFactory();
     const removeFromNode = sandbox.spy(tileFactory, 'removeFromNode');
     const destroyTile = sandbox.spy(tileFactory, 'destroyTile');
     const renderer = new Map2DTileRenderer(tileFactory);

     renderer.addTile(new Map2DTileCoords(0, 0));

     expect(() => {
       renderer.dispose();
       renderer.dispose();
     }).not.toThrow();

     expect(removeFromNode.calledOnce).toBe(true);
     expect(destroyTile.calledOnce).toBe(true);
   });
   ```

   Der Kommentar `// (a) has no subject here: …` oben im Block bleibt richtig und
   bleibt stehen: der Renderer baut weiterhin keine eigene Ressource. Auch
   `'behaves as documented after dispose()'` bleibt unverändert — seine Spies
   entstehen nach dem `dispose()` und messen nur, was danach passiert.

8. **`CameraBasedVisibilityHelpers.spec.ts` anlegen.** Neue Datei mit genau zwei
   Tests, beide vor dem Fix rot:

   ```ts
   import type {BufferGeometry, Material} from 'three/webgpu';
   import {Matrix4, Object3D, Plane, Vector2, Vector3} from 'three/webgpu';
   import {afterEach, describe, expect, test, vi} from 'vitest';

   import type {CameraBasedVisibility} from './CameraBasedVisibility.js';
   import {CameraBasedVisibilityHelpers} from './CameraBasedVisibilityHelpers.js';
   import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';

   // The helpers read a handful of members off the visibility and never call back into it, so an
   // object carrying those members is enough to drive them. `visibles` stays empty: the tile
   // helpers are `Box3Helper`s, and this suite is about the nodes the class builds itself.
   function makeVisibility(): CameraBasedVisibility {
     return {
       planeWorld: new Plane(new Vector3(0, 1, 0), 0),
       pointOnPlane: new Vector3(1, 0, 1),
       planeOrigin: new Vector3(),
       visibles: [],
       map2dTileCoords: new Map2DTileCoordsUtil(),
       matrixWorld: new Matrix4(),
       planeCoords2D: new Vector2(),
     } as unknown as CameraBasedVisibility;
   }

   function spyOnReleases(scene: Object3D) {
     return scene.children.map((node) => {
       const geometry = (node as unknown as {geometry?: BufferGeometry}).geometry;
       const material = (node as unknown as {material?: Material}).material;
       return {
         type: node.type,
         geometry: geometry ? vi.spyOn(geometry, 'dispose') : undefined,
         material: material ? vi.spyOn(material, 'dispose') : undefined,
       };
     });
   }
   ```

   Beide Tests stubben das Dokument, weil `createHelpers()` die Ebenenkoordinaten
   in ein Element des Host-Dokuments schreibt und die Suite ohne DOM läuft:
   `vi.stubGlobal('document', {querySelector: () => null})`, dazu
   `afterEach(() => vi.unstubAllGlobals())`.

   Test 1, `'releases the geometry and the material of every helper node it takes down'`:
   Szene bauen, `helpers.add(scene)`, `helpers.show = true`; dann
   `expect(scene.children).toHaveLength(5)` und
   `expect(scene.children.filter((node) => node.type === 'Mesh')).toHaveLength(4)`
   — ein `PlaneHelper` und vier Punkt-Helfer. Spies über `spyOnReleases(scene)`
   nehmen, `helpers.show = false`, dann `expect(scene.children).toHaveLength(0)`
   und für jeden Eintrag `geometry` wie `material` genau ein Aufruf.

   Test 2, `'releases the helper nodes an update replaces'`: derselbe Aufbau,
   statt `show = false` ein `helpers.update()`. Danach stehen wieder fünf Knoten
   in der Szene, und jeder Spy des vorigen Satzes hat genau einen Aufruf. Das ist
   der Frame-Fall, um den es geht.

   Vor dem Fix bekommt in beiden Tests nur der `PlaneHelper` seine Aufrufe, die
   vier `Mesh` haben null. Der rote Lauf gehört in den Report.

9. **`docs/resource-lifecycle.md` — Abschnitt 2 um die fehlende Regel
   ergänzen.** Als neuer Absatz ans Ende von Abschnitt 2, also nach der Zeile
   »Read it as a sharing declaration, not as a template for new APIs.« (Zeile 52)
   und vor `## 3. Idempotence` (Zeile 54):

   ```markdown
   **What was borrowed is given back, even though it was never owned.**

   A slot taken from a pool and a tile taken from a factory are not resources this instance
   owns — but they are resources it holds, and nobody else can reach them. Every acquiring call
   has a releasing counterpart, and `dispose()` is the last place the pairing can still be
   honoured: `createVO()` ↔ `freeVO()`, [`IMapTileFactory.createTile()`](../src/map2d/types.ts)
   ↔ `destroyTile()`. Giving back is not releasing — the pool or the factory stays the owner and
   decides what becomes of the slot, the holder only says that it is done with it.
   [`Map2DTileRenderer.dispose()`](../src/map2d/Map2DTileRenderer.ts) hands every tile it still
   holds back before it lets the factory go, so a factory that goes on to serve a second renderer
   gets the slots of the first one back.

   An instance that passes what it took straight out to the caller has nothing to give back:
   `TexturedSprites#createSprite()` hands the sprite over, and whoever asked for it calls
   `freeSprite()`.
   ```

10. **`docs/resource-lifecycle.md` — Schritt 1 der Checkliste in Abschnitt 7
    (Zeile 241-242) auf denselben Stand bringen:**

    ```markdown
    1. Release every resource this instance created itself, give back every slot it took from a
       pool or a factory, and touch nothing else that was handed in.
    ```

11. **`CHANGELOG.md:45` — die `Changed`-Zeile zu `Map2DTileRenderer#tileFactory`
    umschreiben.** Nur der mittlere Satz bewegt sich; aus

    »`dispose()` takes the factory content out of `node` and releases nothing else: the
    factory is handed to the constructor and stays the caller's.«

    wird

    »`dispose()` gives every tile the renderer still holds back to the factory through
    `destroyTile()` and takes the factory content out of `node`; it releases nothing of its
    own, because the factory is handed to the constructor and stays the caller's.«

    Der Rest der Zeile — Typ, die sechs Zyklus-Methoden, der zweite Aufruf, der
    Verweis auf die Richtlinie — bleibt Wort für Wort stehen.

12. **`CHANGELOG.md` — zwei Zeilen unter `### Fixed`** (`:75`), ans Ende der
    Liste:

    ```markdown
    - fix the point helpers `CameraBasedVisibilityHelpers` draws: each one frees the box geometry and the material it is built from as the helpers are taken down or rebuilt, so a scene with the helpers switched on no longer collects a geometry and a material per point helper and per update
    - fix `Map2DTileRenderer#dispose()`: every tile the renderer holds goes back to the factory through `destroyTile()`, so a `TileSpritesFactory` handed on to a second renderer gets the sprite pool slots of the first one back instead of finding them taken
    ```

    Der Skill `updating-changelog` gilt: `[Unreleased]` ist offen und wird an
    Ort und Stelle geändert, kein veröffentlichter Abschnitt wird angefasst.
    Kein Eintrag unter `### Migration Guide` — Begründung oben, Entscheidung 5.

13. **Verify fahren, den Diff lesen, committen.** Kein `git add -A`.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `typecheck` deckt die neue Spec und die neue Klasse mit ab, was `build` nicht
  tut; `test:browser` läuft mit, weil `destroyTile()` über `freeVO()` an der
  GPU-Buffer-Buchführung des `instancedPool` hängt. Ein neuer Browser-Test
  entsteht nicht: `packages/twopoint5d-testing/` enthält keinen map2d-Test, und
  die Buchführung, die sich hier bewegt, ist reine Slot-Verwaltung und in Vitest
  vollständig prüfbar.
- Commit: `fix(map2d): free what a helper built and give every tile back to its factory`
- Ergebnis: 1 Runde · beide Einträge behoben — die Punkt-Helfer geben Geometry
  und Material selbst frei, `Map2DTileRenderer#dispose()` gibt jede Kachel über
  `clearTiles()` an die Factory zurück · Regressionstests
  `gives every tile it holds back to the factory`,
  `releases the geometry and the material of every helper node it takes down` und
  `releases the helper nodes an update replaces` (alle drei vor dem Fix rot, dazu
  `is safe to call twice` an der neuen Assertion) · Runde 1 schloss zwei wichtige
  Befunde: `PointHelper.dispose()` nimmt sich jetzt per `removeFromParent()` aus
  dem Szenengraph, und das Testmuster in Abschnitt 8 der Richtlinie hat den Fall
  `(f)` für zurückgegebene Slots bekommen · klein und nicht behoben:
  `Map2DTileRenderer.ts:112` ruft kein `tileFactory.update()` nach der Rückgabe
  (kein späteres `endUpdatingTiles()` dieses Renderers zieht nach) ·
  `resource-lifecycle.md:17-22` lässt die Eröffnungsregel von Abschnitt 2
  unqualifiziert stehen und zeigt nicht auf den neuen Absatz 40 Zeilen weiter ·
  das `(f)`-Skelett führt `thing.take(item)` und `new Thing(pool)` ein, die der
  Platzhalter-Absatz nicht kennt, und seine Assertion ist schwächer als die
  Referenz-Umsetzung · `CameraBasedVisibilityHelpers.spec.ts:26-35` nimmt
  `vi.spyOn` für gewöhnliche Objekte, wo die Richtlinie `createSandbox()` vorgibt
  · `PointHelper.dispose()` sagt nichts über Idempotenz
- Nebenbefunde: → Queue (2 neue)
- Folgen: `packages/twopoint5d/src/**/*.spec.ts` (neun Dateien mit
  Dispose-Test-Block, u. a. `src/stage/StageRenderer.spec.ts`,
  `src/texture/TextureResource.spec.ts`) — das Testmuster der Richtlinie hat seit
  diesem Paket sechs Fälle, diese Blöcke führen fünf; der Vermerk »kein
  Gegenstand hier« für `(f)` fehlt, und ein Leser kann nicht zwischen »geprüft«
  und »übersehen« unterscheiden. Als Paket 15 geschnitten.
- Schnittstellen: `Map2DTileRenderer#dispose()` gibt jede Kachel, die der
  Renderer noch hält, über `IMapTileFactory.destroyTile()` an die Factory
  zurück, bevor es `removeFromNode()` ruft und die Factory losläßt — eine
  Factory, die danach einen zweiten Renderer bedient, bekommt die Slots des
  ersten wieder; die Idempotenz und der öffentliche Zustand `tileFactory === null`
  bleiben unverändert · das Testmuster in Abschnitt 8 von
  `docs/resource-lifecycle.md` hat den Fall `(f)` »jeder geliehene Slot geht
  zurück«, Abschnitt 2 trägt die Regel »geliehen ist nicht besessen« und
  Checkliste Schritt 1 in Abschnitt 7 den zugehörigen Halbsatz · die Punkt-Helfer
  in `CameraBasedVisibilityHelpers` sind eine dateilokale Klasse mit eigenem
  `dispose()`, nicht exportiert und nicht in `map2d/public-api.ts`

### [x] 12. stage: Canvas2DStage bekommt ein dispose(), StageRenderer hält seines

- Nebenbefund: aus Paket 7 (drei Einträge der Queue: `Canvas2DStage` hält nur
  selbst gebaute three.js-Ressourcen und hat kein `dispose()` (medium); ein
  entsorgter `StageRenderer` baut über `asPassNode()` und ein neu
  zugewiesenes `pipeline` weiter RenderTargets; `parent.remove(child)` lässt
  `child.parent` stehen)
- Ziel: `Canvas2DStage` gibt alles frei, was es erzeugt hat; ein entsorgter
  `StageRenderer` legt keine RenderTargets mehr an und wirft in
  `asPassNode()` nach Regel 2; `remove()` räumt beide Seiten der Beziehung.
- Bereich: `packages/twopoint5d/src/stage/Canvas2DStage.ts`, `StageRenderer.ts`
  und Specs
- Hängt ab von: 7
- Hash: 5e8d036
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/src/stage/StageRenderer.ts` ·
  `packages/twopoint5d/src/stage/StageRenderer.spec.ts` ·
  `packages/twopoint5d/src/stage/Canvas2DStage.ts` ·
  `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts` (neu) ·
  `packages/twopoint5d/src/stage/README.md` ·
  `packages/twopoint5d/CHANGELOG.md`. Sechs Dateien, keine siebte.

  Keine Änderung an `stage/public-api.ts`: `Canvas2DStage` und `StageRenderer`
  stehen dort seit jeher, und dieses Paket führt kein neues Symbol ein —
  `dispose()` und `isDisposed` sind Member bereits exportierter Klassen.

  Keine Änderung an `packages/twopoint5d/docs/resource-lifecycle.md`.
  Nachgesehen an Abschnitt 3 und 4: dieses Paket bringt weder eine vierte
  Idempotenz-Bauform noch eine vierte Reaktion nach `dispose()`. `Canvas2DStage`
  nimmt das private Flag aus Abschnitt 3, `StageRenderer#asPassNode()` die
  Regel 2 aus Abschnitt 4, die vier Mutatoren von `Canvas2DStage` die Regel 3.
  Alles davon steht dort bereits.

  Keine Änderung an `apps/lookbook/`: `QuadTreeVisualization.ts:18` ist der
  einzige Aufrufer von `Canvas2DStage` im Repo, er entsorgt nichts, abonniert
  nichts und liest keinen Member nach einem `dispose()`.

#### Abgleich am Code, Zug 0 (2026-09-06)

Alle drei Einträge existieren unverändert. Gemessen wurde jeder einzeln gegen
den gebauten Stand unter `packages/twopoint5d/dist/lib/`, mit einem Skript im
Arbeitsverzeichnis (`probe-stage.mjs`); der Arbeitsbaum ist unberührt geblieben.

| Eintrag | Fundstelle heute | Urteil |
| --- | --- | --- |
| `Canvas2DStage` hat kein `dispose()` | `Canvas2DStage.ts:14-164` | unverändert, gelesen: 164 Zeilen, keine Methode `dispose`, und die einzige Freigabe der ganzen Datei ist `this.texture.dispose()` in `makeTexture()` (`:108-110`) |
| ein entsorgter `StageRenderer` baut weiter RenderTargets | `StageRenderer.ts:474-485` (`asPassNode()` über `#ensureAsPassNodeRT()`), `:296` (das ungeschützte Feld `pipeline`), `:334-350` und `:371-379` (`renderTo()`) | unverändert, **belegt** |
| `remove()` lässt `child.parent` stehen | `StageRenderer.ts:661-670` gegen `:184-204` | unverändert, **belegt** · die Zeilenangabe der Queue (`:614-623`) zeigt auf den Stand von Paket 7; `remove()` ist seither ans Dateiende gewandert, der Gegenpart `#removeFromParent()` steht weiter bei `:196` |

Die Messungen im Einzelnen:

- `asPassNode()` auf einem entsorgten Renderer liefert einen Node und legt dafür
  ein frisches `RenderTarget` an. `dispose()` setzt `#asPassNodeRT` auf
  `undefined`, `#ensureAsPassNodeRT()` fragt keinen Zustand ab und baut neu —
  und ein zweites `dispose()`, das es wieder freigäbe, gibt es nicht.
- `renderTo()` auf einem entsorgten Renderer mit `clear === true` ruft
  `renderer.clear()` genau einmal: `#renderStagesInline()` räumt das Ziel des
  Aufrufers auf, obwohl kein Stage mehr da ist, der hineinzeichnen könnte.
- Eine Zuweisung an `pipeline` nach dem `dispose()` wird angenommen; der nächste
  `renderTo()` baut über `#ensureInternalRT()` ein zweites frisches
  `RenderTarget` und hängt es als `outputNode` in die fremde Pipeline.
- `parent.remove(child)` nach `child.parent = parent`: `parent.hasStage(child)`
  ist danach `false`, `child.parent === parent` bleibt `true`. Der umgekehrte
  Weg (`child.parent = undefined`) räumt beide Seiten.

Zwei Randbefunde aus demselben Abgleich. Beide sind dieselbe Ursache an einer
zweiten Tür und werden hier mitbehandelt — Nebenbefunde sind sie nicht:

- `#renderPipelineComposed()` (`StageRenderer.ts:429-442`) greift für ein
  verschachteltes Kind direkt auf `stage.#ensureAsPassNodeRT(renderer)` zu und
  geht damit an der öffentlichen `asPassNode()` vorbei. Ein Kind, das über
  `parent.add(child)` hereinkam statt über `child.parent = parent`, kennt seinen
  Halter nicht und nimmt sich beim eigenen `dispose()` deshalb nicht aus dessen
  `stages` — genau die Bauform, die `Canvas2DStage.ts:97` benutzt. Ein Wächter
  allein in `asPassNode()` ließe diesen Weg offen; er gehört in
  `#ensureAsPassNodeRT()`, wo beide Wege durchkommen.
- Der Platzhalter aus `Canvas2DStage.ts:99` — `new SpriteMaterial({map: new Texture()})`
  — wird vom ersten `updateTexture()` durch die Factory-Textur ersetzt und
  danach von niemandem freigegeben. Dieselbe Ursache wie der Haupteintrag: die
  Klasse gibt nichts frei, weil sie keinen Weg dafür hat.

#### Die drei Einträge im Wortlaut

**`Canvas2DStage` ohne `dispose()` · medium (MEM) · `packages/twopoint5d/src/stage/Canvas2DStage.ts:14-110`**

Die Klasse ist über `stage/public-api.ts` veröffentlicht, baut im Konstruktor
einen `StageRenderer`, einen `Stage2D`, ein `Sprite` mit eigener
`SpriteMaterial` und in `makeTexture()` eine `TextureFactory` samt `Texture` —
und hat kein `dispose()`. Alles davon hat sie selbst erzeugt, nichts davon kann
ein Aufrufer je freigeben: die einzige Freigabe im ganzen Modul ist das
`this.texture.dispose()` in `makeTexture()` (Zeile 108–110), das die
Vorgänger-Textur beim Neuaufbau entsorgt und den Rest stehen lässt. Andere
Ursache als Paket 7: dort geht es um `dispose()`-Methoden, die es gibt und die
niemand prüft, hier fehlt die Methode.

Urteil an der Scope-Regel: `→ Scope` — Ownership, eine Klasse, die
ausschließlich selbst gebaute three.js-Ressourcen hält und keinen Weg anbietet,
sie herzugeben.

**RenderTargets nach `dispose()` · low (MEM) · `packages/twopoint5d/src/stage/StageRenderer.ts:472-483` und `:296`**

Ein entsorgter `StageRenderer` baut auf zwei Wegen weiter RenderTargets, die
kein `dispose()` mehr freigibt: `asPassNode()` über `#ensureAsPassNodeRT()`, und
`renderTo()` über `#ensureInternalRT()`, sobald jemand dem ungeschützten
öffentlichen Feld `pipeline` nach dem `dispose()` wieder eines zuweist.
Abschnitt 4 der Richtlinie kennt für `asPassNode()` keine passende Reaktion —
der Rückgabetyp `Node` behauptet Anwesenheit, also verlangt Regel 2 einen
Fehler, der Klasse und Zustand nennt. Verwandt: `renderTo()` mit
`clear === true` räumt nach `dispose()` weiterhin das Ziel des Aufrufers auf
(`#renderStagesInline`, `:369-377`). Paket 7 hat das TSDoc auf den Stand
gebracht (`StageRenderer.ts:544-546` nennt beide Wege), das Verhalten aber nicht
geändert: ein Wurf in `asPassNode()` und ein Guard am `pipeline`-Feld sind ein
eigener Entwurf, den Schritt 12 des Detailplans von Paket 7 ausschließt.

Urteil an der Scope-Regel: `→ Scope` — Verhalten nach `dispose()`.

**Halbseitige Ownership-Beziehung · low (BUG) · `packages/twopoint5d/src/stage/StageRenderer.ts:614-623` gegen `:194-204`**

`parent.remove(child)` nimmt das Kind aus `stages`, lässt dessen `#parent` aber
stehen. `child.parent` nennt danach einen Renderer, der es nicht mehr hält; der
umgekehrte Weg (`child.parent = undefined`) räumt beide Seiten.

Urteil an der Scope-Regel: `→ Scope` — die Ownership-Beziehung bleibt halbseitig
bestehen, das Kind hält eine Referenz auf einen Halter, der es losgelassen hat.

#### Sechs Entscheidungen dieses Zuges

1. **`asPassNode()` wirft, `renderTo()` schweigt.** Beide Male entscheidet der
   Rückgabetyp, so wie Abschnitt 4 es vorgibt: `asPassNode(): Node` behauptet
   Anwesenheit und fällt unter Regel 2, `renderTo(): void` ist eine verändernde
   Methode ohne etwas, worauf sie noch wirken könnte, und fällt unter Regel 3.
   Der frühe Ausgang in `renderTo()` schließt beide gemessenen Löcher auf einmal
   — den Clear auf dem Ziel des Aufrufers und das interne RenderTarget hinter
   einer neu zugewiesenen `pipeline`.

2. **`pipeline` wird ein Accessor-Paar, ein Schreibzugriff nach `dispose()` ist
   ein stiller No-op.** Nicht, weil der Leak es verlangte — den schließt bereits
   der frühe Ausgang aus `renderTo()` —, sondern weil das TSDoc von Paket 7
   zusagt, `pipeline` antworte nach `dispose()` mit `undefined`, und diese Zusage
   heute nur solange trägt, wie niemand schreibt. Die Klasse hat für genau diese
   Frage schon eine Antwort: Paket 7 hat `parent`, `attach()`, `detach()`,
   `add()` und `remove()` zu stillen No-ops gemacht, weil ein entsorgter
   Renderer sich nicht wiederbeleben lassen soll. `pipeline` ist die letzte
   offene Tür in derselben Wand. Der Preis ist eine öffentliche Eigenschaft, die
   vom Instanz-Feld zum Prototyp-Accessor wird; im Repo gibt es außerhalb von
   Specs und TSDoc-Beispielen keine einzige Zuweisung an sie
   (`grep -rn '\.pipeline\b' packages apps`), und Lese- wie Schreibsemantik einer
   lebenden Instanz ändern sich nicht.

3. **Der Wächter gegen neue RenderTargets sitzt in `#ensureAsPassNodeRT()`, nicht
   in `asPassNode()`.** Grund steht oben im Abgleich: `#renderPipelineComposed()`
   greift bei verschachtelten Kindern an der öffentlichen Methode vorbei direkt
   auf die private zu. `#ensureInternalRT()` bekommt keinen Wächter — nach
   Entscheidung 1 und 2 ist sie auf einer entsorgten Instanz nicht mehr
   erreichbar, und ein Wächter auf totem Pfad ist eine Behauptung ohne Test.

4. **`#removeFromParent()` gibt `#parent` frei, bevor es das Ereignis schickt.**
   Das ist die Voraussetzung dafür, dass `remove()` die Kind-Seite über den
   vorhandenen Weg räumen kann, ohne dass `OnRemoveFromParent` zweimal feuert:
   ruft `remove()` das Kind, räumt das Kind zuerst sein Feld und ruft dann
   `parent.remove(this)` zurück — dort ist der Index längst weg und
   `stage.parent === this` nicht mehr wahr, die Rekursion endet nach einem
   Durchgang. Die Alternative, `stage.parent = undefined` aus `remove()` heraus
   zu setzen, ist gemessen falsch: der Setter ruft `#removeFromParent()`, das
   emittiert, das ruft `remove()`, das setzt wieder — zwei Ereignisse für einen
   Vorgang. Nebenwirkung, die in die Schnittstellen-Zeile gehört: ein Listener,
   der in `OnRemoveFromParent` `renderer.parent` liest, sieht jetzt `undefined`
   statt des alten Halters. Das ist die richtigere Auskunft — das Ereignis heißt
   »du bist entfernt worden«.

5. **`Canvas2DStage` bekommt vier stille No-ops, nicht nur einen.** `render()`
   muss einer werden: es würde sonst über `#textureFactory ||= new TextureFactory(…)`
   die eben losgelassene Factory neu bauen und einen entsorgten `StageRenderer`
   antreiben. `setCanvasSize()` muss es auch: es schreibt `canvas.width` und
   `canvas.height`, und der Canvas kann hereingereicht sein — Abschnitt 2 sagt,
   Hereingereichtes wird nicht verändert, und nach dem `dispose()` gilt das erst
   recht. `setContainerSize()` und der `fit`-Setter kommen mit, weil ein Satz,
   der für die halbe Klasse gilt, kein Vertrag ist, sondern eine Fußnote: »eine
   entsorgte Stage treibt nichts mehr an« ist als ganze Regel billiger zu lesen
   und zu prüfen als vier Einzelfälle. `needsUpdate` bleibt ein einfaches Feld
   und beschreibbar; nach dem `dispose()` liest es niemand mehr.

6. **`sprite.geometry` wird nicht freigegeben.** `THREE.Sprite` teilt sich ein
   modulweites `_geometry` über alle Sprites hinweg (`three@0.185.1`,
   `src/objects/Sprite.js:12`); ein `dispose()` darauf nimmt jedem anderen Sprite
   der Anwendung die Geometrie weg. Die Regel »gib frei, was du selbst gebaut
   hast« zeigt hier ins Leere: gebaut hat das `Sprite` sie nicht, es hat sie
   vorgefunden. Der Test aus Schritt 9 hält das mit einem Spy fest, weil die
   Verwechslung teuer und einladend ist.

#### Nachgesehen und ohne Befund geblieben

- **`Stage2D` und `OrthographicProjection` bekommen kein `dispose()`.** Beide
  haben keines, beide halten nichts Freizugebendes: `Stage2D` baut eine `Scene`
  und eine Kamera aus der Projektion, und three.js gibt für keines von beiden
  eine Freigabe her. `Canvas2DStage#dispose()` nimmt deshalb nur seinen Sprite
  aus der Szene und lässt die beiden stehen. Eine neue `dispose()`-Methode dort
  wäre ein eigener Entwurf und nicht dieses Paket.
- **`ClearStage` und `RootRenderPipeline`** — kein `dispose()`, nichts selbst
  Gebautes, keine Fundstelle.
- **Die Browser-Tests `stage-renderer.test.js` und `stage-pipeline.test.js`**
  hängen an keiner der geänderten Zusagen: `stage-pipeline.test.js:94-118` prüft,
  dass `dispose()` eine hereingereichte Pipeline nicht entsorgt (davon ändert
  sich nichts), `stage-renderer.test.js:163` ruft `detach()` auf einem lebenden
  Renderer. Kein Test im Repo liest `renderTo()` oder `asPassNode()` nach einem
  `dispose()`.
- **`RootRenderPipeline.spec.ts`** weist `sr.pipeline` an sechs Stellen zu, alle
  an lebenden Renderern. Das Accessor-Paar aus Entscheidung 2 lässt sie
  unberührt.
- **Der offene Queue-Eintrag `HelpersManager.ts:39-46`** (`→ Scope`, aus
  Paket 11) hat eine andere Ursache und liegt in `map2d/`. Er bleibt liegen und
  gehört in die nächste Drain-Runde des Abschlusses, nicht in dieses Paket.

#### Restplan

Die Pakete 13 und 14 sind unberührt — `controls/` und `vertex-objects/` teilen
mit `stage/` keine Datei und keine Ursache.

Paket 15 bekommt eine Zeile mehr in seiner Bereich-Angabe: Die neue Datei
`Canvas2DStage.spec.ts` bringt ihren `(f)`-Vermerk von Geburt an mit, und der
`dispose()`-Block in `StageRenderer.spec.ts` bleibt trotz der Änderungen dieses
Pakets in Paket 15s Liste. Grund für das Zweite: Paket 12 fasst diesen Block an
den Assertionen an, nicht an der Frage, ob Fall `(f)` hier einen Gegenstand hat
— das ist das Urteil, das Paket 15 je Datei fällt, und es zwei Pakete früher
nebenbei mitzunehmen hieße, Paket 15s Liste falsch zu machen, ohne seine Arbeit
zu ersparen.

Reihenfolge und Schnitt der offenen Pakete bleiben, wie sie sind.

#### Vorgehen

Reihenfolge im Auftrag: Schritt 7 und Schritt 9 sind Regressionstests und werden
**zuerst** geschrieben und rot gesehen — Schritt 7 gegen die Schritte 1 bis 5,
Schritt 9 gegen Schritt 8. Der rote Lauf beider gehört in den Report.

1. **`StageRenderer.ts` — die Fehlerfabrik anlegen.** Als Modulfunktion über der
   Klasse, in der Form, die `Display.ts:46-48` und `VOBufferPool.ts:7-9` schon
   benutzen:

   ```ts
   function disposedError(member: string): Error {
     return new Error(`StageRenderer#${member} is not available: this renderer has been disposed`);
   }
   ```

2. **`StageRenderer.ts:296` — `pipeline` wird ein Accessor-Paar.** Das Feld wird
   privat, die öffentliche Sicht bleibt gleich, der Schreibzugriff nach
   `dispose()` fällt durch:

   ```ts
   #pipeline?: RenderPipeline;

   /**
    * Optional `THREE.RenderPipeline` running between the stages and the
    * output. Without `buildOutputNode`, the stages render into an internal
    * pass-target whose texture is sampled by the pipeline. With
    * `buildOutputNode`, the pipeline runs a user-defined TSL graph composed
    * from each stage's pass node.
    *
    * The pipeline is handed in and stays the caller's. A disposed renderer
    * answers `undefined` here and takes no new one: like `parent`, `add()` and
    * `attach()`, the write is a silent no-op.
    */
   get pipeline(): RenderPipeline | undefined {
     return this.#pipeline;
   }

   set pipeline(pipeline: RenderPipeline | undefined) {
     if (this.#disposed) return;
     this.#pipeline = pipeline;
   }
   ```

   Die drei internen Lesestellen (`#renderToCurrentTarget()`,
   `#renderPipelineSimple()`, `#renderPipelineComposed()`) laufen über den Getter
   weiter. In `dispose()` (`:568`) weicht `this.pipeline = undefined` der direkten
   Zuweisung `this.#pipeline = undefined` — der Setter sperrt zu diesem Zeitpunkt
   bereits, das Flag steht eine Zeile vorher. Wo die beiden privaten Felder im
   Klassenrumpf stehen, ist zur Laufzeit gleichgültig: Klassenfelder werden
   allesamt bei der Konstruktion initialisiert, lange bevor eine Methode läuft.
   `#pipeline` gehört trotzdem an die Stelle, an der heute das Feld `pipeline`
   steht, damit der Absatz zur Pipeline im Diff beieinander bleibt.

3. **`StageRenderer.ts:334` — `renderTo()` bekommt den frühen Ausgang.** Erste
   Anweisung der Methode, vor der `isWebGLRenderer`-Prüfung:

   ```ts
   renderTo(renderer: WebGPURenderer): void {
     // nothing left to draw and nothing left to draw into: a disposed renderer holds no
     // stage, and the target belongs to the caller — clearing it here would be work on
     // something this renderer let go of
     if (this.#disposed) return;
     // …
   }
   ```

   `updateFrame()` bleibt, wie es ist: es iteriert `orderedStages`, und die ist
   nach `dispose()` leer — ein No-op durch Konstruktion, den Abschnitt 3 der
   Richtlinie ausdrücklich zulässt.

4. **`StageRenderer.ts:483-485` — `#ensureAsPassNodeRT()` wirft.**

   ```ts
   #ensureAsPassNodeRT(renderer: WebGPURenderer): RenderTarget {
     if (this.#disposed) {
       // the guard sits here and not in asPassNode(): a parent pre-renders a nested child
       // through this method directly, and a child added with add() never learned who holds it
       throw disposedError('asPassNode()');
     }
     return (this.#asPassNodeRT = this.#ensureRT(this.#asPassNodeRT, renderer));
   }
   ```

5. **`StageRenderer.ts:196-204` und `:661-670` — beide Seiten der Beziehung.**
   `#removeFromParent()` gibt das Feld frei, bevor es emittiert; `remove()` räumt
   die Kind-Seite über denselben Weg:

   ```ts
   #removeFromParent(): void {
     const parent = this.#parent;
     if (parent == null) return;

     // cleared before the event goes out and before the parent hears about it: a remove()
     // coming back in from the other side finds nothing left to detach, and the recursion
     // between the two halves stops after one pass
     this.#parent = undefined;

     emit(this, OnRemoveFromParent);

     if (parent instanceof StageRenderer) {
       parent.remove(this);
     }
   }
   ```

   ```ts
   remove(stage: IStage): this {
     const index = this.#getIndex(stage);
     if (index !== -1) {
       this.stages.splice(index, 1);
       this.#orderedStages = undefined;
       this.#outputDirty = true;
       emit(this, OnStageRemoved, {stage, renderer: this} as StageRemovedProps);
       if (stage instanceof StageRenderer && stage.parent === this) {
         // the child still names this renderer as its holder; letting go is a move both
         // sides make, whichever of them started it
         stage.#removeFromParent();
       }
     }
     return this;
   }
   ```

   Im `parent`-Setter (`:184-194`) bleibt alles stehen, wie es ist: er ruft
   `#removeFromParent()` und weist danach `#parent` neu zu — die Zuweisung
   überschreibt jetzt ein bereits geleertes Feld statt eines gefüllten, das
   Ergebnis ist dasselbe. In `dispose()` (`:557-561`) entfällt die Zeile
   `this.#parent = undefined;` hinter `this.#removeFromParent();`, weil die
   Methode das jetzt selbst tut; der Kommentar darüber bleibt richtig und bleibt
   stehen.

6. **`StageRenderer.ts` — die vier TSDoc-Stellen auf den neuen Vertrag bringen.**

   - `asPassNode()` (`:466-473`): ein Satz, dass ein entsorgter Renderer hier
     wirft und nicht heimlich ein neues Ziel baut.
   - `remove()` (`:658-660`): ein Satz, dass ein entferntes Kind-`StageRenderer`
     danach `undefined` als `parent` nennt und sein `OnRemoveFromParent` bekommt.
   - `dispose()` (`:525-547`): der letzte Absatz behauptet heute das Gegenteil
     des neuen Verhaltens (»Two calls still build a `RenderTarget` on demand«) und
     wird ersetzt. Der neue Text sagt: `renderTo()` und `updateFrame()` tun
     nichts, `asPassNode()` wirft, ein Schreibzugriff auf `pipeline` fällt durch,
     und `resize()`, `setClearColor()` und `invalidateOutputNode()` nehmen weiter
     Werte an, ohne etwas zu treiben. Kein Rückblick auf den Vorzustand
     (»Konventionen« im Kopf des Plans).
   - der Klassen-Header (`:36-64`) bleibt unberührt.

7. **`StageRenderer.spec.ts` — fünf Regressionstests, alle vor dem Fix rot.**
   Vier davon in den vorhandenen `describe('dispose()')`-Block (`:622`), hinter
   `'is safe to call twice'`; der fünfte in `describe('parent / host wiring (3.7)')`
   (`:282`), hinter `'emits OnAddToParent and OnRemoveFromParent on the child'`.
   Der Block benutzt `it(` und den `sandbox` aus `createSandbox()` — beides
   beibehalten.

   ```ts
   it('throws instead of building a pass target after dispose()', () => {
     const sr = new StageRenderer();
     sr.resize(50, 50);
     sr.dispose();

     expect(() => sr.asPassNode(renderer as any)).toThrow(/StageRenderer#asPassNode\(\) is not available/);
   });

   it('does not pre-render a disposed child into a fresh pass target', () => {
     const parent = new StageRenderer();
     parent.resize(50, 50);
     const child = new StageRenderer();
     // add() alone: the child never learns who holds it, so its dispose() leaves it in the list
     parent.add(child);
     child.dispose();
     parent.pipeline = makePipelineMock() as any;
     parent.buildOutputNode = (passes) => passes[0]!;

     expect(() => parent.renderTo(renderer as any)).toThrow(/StageRenderer#asPassNode\(\) is not available/);
   });

   it('leaves the renderer alone after dispose()', () => {
     const sr = new StageRenderer();
     sr.resize(50, 50);
     sr.setClearColor(null, 0);
     sr.dispose();

     sr.renderTo(renderer as any);

     expect(renderer.clear, 'the target belongs to the caller').not.toHaveBeenCalled();
   });

   it('takes no pipeline after dispose()', () => {
     const sr = new StageRenderer();
     sr.resize(50, 50);
     sr.dispose();

     sr.pipeline = makePipelineMock() as any;
     sr.renderTo(renderer as any);

     expect(sr.pipeline).toBeUndefined();
   });
   ```

   ```ts
   it('remove() clears the parent of the child it lets go', () => {
     const parent = new StageRenderer();
     const child = new StageRenderer(parent);
     const removed = vi.fn();
     on(child, OnRemoveFromParent, removed);

     parent.remove(child);

     expect(parent.hasStage(child)).toBe(false);
     expect(child.parent, 'the child let go of its holder as well').toBeUndefined();
     expect(removed, 'and it said so exactly once').toHaveBeenCalledTimes(1);
   });
   ```

   Rote Läufe, gemessen am heutigen Stand: der erste liefert einen Node statt zu
   werfen, der zweite ebenso, der dritte zählt einen `clear()`-Aufruf, der vierte
   findet die Pipeline gesetzt, der fünfte findet `child.parent === parent`.

   Zwei vorhandene Tests im `dispose()`-Block laufen `renderTo()` und
   `asPassNode()` **vor** dem `dispose()` — sie bleiben unberührt. Der Test
   `'behaves as documented after dispose()'` (`:672`) bekommt zwei Zeilen dazu:
   `expect(() => sr.renderTo(renderer as any)).not.toThrow()` und
   `expect(sr.pipeline).toBeUndefined()` nach einer Zuweisung. Der Kommentar
   `// (e) has no subject here` bleibt stehen.

8. **`Canvas2DStage.ts` — die fehlende Methode und die vier Wächter.**

   Neu am Ende der Klasse, hinter `dispatchEvent()`:

   ```ts
   #disposed = false;

   /** `true` once {@link dispose} has run. */
   get isDisposed(): boolean {
     return this.#disposed;
   }

   /**
    * Release the three.js resources this stage built for itself: the sprite material, the
    * texture behind it and the {@link StageRenderer}. The sprite leaves the scene before its
    * material goes, so no frame reaches a sprite without one.
    *
    * The `WebGPURenderer` and a canvas handed to the constructor belong to the caller and are
    * left untouched — the canvas keeps the size and the content it had. `THREE.Sprite` shares
    * one geometry across every sprite of the module; it is not this stage's to release.
    *
    * Afterwards `isDisposed` is `true`, `texture` answers `undefined`, and `render()`,
    * `setCanvasSize()`, `setContainerSize()`, a write to `fit` and a further `dispose()` do
    * nothing. `canvas`, `renderer`, `projection`, `stage`, `scene`, `sprite`, `stageRenderer`,
    * `width`, `height` and `needsUpdate` keep the values the stage was left with. A `dispose`
    * event goes out to every subscriber before this stage stops listening; no event follows it.
    */
   dispose(): void {
     if (this.#disposed) return;
     this.#disposed = true;

     // the listeners are still attached here: this event is what tells them to let go
     this.dispatchEvent('dispose');
     off(this);

     // out of the scene graph before the material goes — a sprite without one cannot be drawn
     this.sprite.removeFromParent();

     const spriteTexture = this.sprite.material.map;
     this.sprite.material.dispose();
     if (spriteTexture != null && spriteTexture !== this.texture) {
       // the placeholder the constructor put behind the material, still there until the first
       // updateTexture() replaced it
       spriteTexture.dispose();
     }
     this.texture?.dispose();
     this.texture = undefined;
     this.#textureFactory = undefined;

     this.stageRenderer.dispose();
   }
   ```

   `off` kommt aus `@spearwolf/eventize` und muss dem Import in Zeile 1
   hinzugefügt werden.

   Die vier Wächter, jeweils als erste Anweisung:

   ```ts
   set fit(value: Canvas2DStageFitType) {
     if (this.#disposed || this.#fit === value) return;
     // …
   }

   setContainerSize(width: number, height: number) {
     if (this.#disposed) return;
     this.stage.resize(width, height);
   }

   setCanvasSize(width: number, height: number) {
     // the canvas may have been handed in, and a disposed stage does not write to it
     if (this.#disposed || (this.width === width && this.height === height)) return;
     // …
   }

   render() {
     if (this.#disposed) return;
     // …
   }
   ```

   `makeTexture()` und `updateTexture()` bleiben unverändert — sie sind privat
   und nur noch über `render()` erreichbar. Die Reihenfolge in `makeTexture()`
   (erst die alte Textur freigeben, dann die neue setzen) ist nicht Gegenstand
   dieses Pakets und wird nicht angefasst.

9. **`Canvas2DStage.spec.ts` anlegen.** Neue Datei, das Muster aus Abschnitt 8
   der Richtlinie mit allen sechs Fällen, `describe`/`test` wie in
   `CameraBasedVisibilityHelpers.spec.ts`. Vitest läuft hier ohne DOM
   (`vite.config.ts` setzt keine `environment`), also **nicht** die
   `[width, height]`-Überladung des Konstruktors nehmen — die ruft
   `document.createElement`. Der Weg ohne DOM:

   ```ts
   import {createSandbox} from 'sinon';
   import type {WebGPURenderer} from 'three/webgpu';
   import {describe, expect, test, vi, afterEach} from 'vitest';

   import {Canvas2DStage} from './Canvas2DStage.js';

   function makeRenderer() {
     return {
       getMaxAnisotropy: () => 1,
       render: vi.fn(),
       dispose: vi.fn(),
     } as unknown as WebGPURenderer;
   }

   function makeCanvas(width = 32, height = 16) {
     return {width, height} as unknown as HTMLCanvasElement;
   }
   ```

   Gebaut wird durchweg mit `new Canvas2DStage(makeRenderer(), makeCanvas())`.
   Ohne ein `setCanvasSize()` hat der `Stage2D` keine Kamera, und `renderTo()`
   fällt in `Stage2D` durch — `render()` kommt damit unter Node durch, ohne dass
   three.js wirklich zeichnet. Wo ein Test messen will, ob gerendert wurde,
   nimmt er `sandbox.spy(stage.stageRenderer, 'renderTo')` und zählt die Aufrufe;
   ein echter Renderlauf ist an keiner Stelle nötig.

   Die sechs Fälle:

   - **(a)** `dispose()` gibt `SpriteMaterial`, die Platzhalter-Textur, die
     Factory-Textur und den `StageRenderer` je genau einmal frei. Spies auf
     `stage.sprite.material.dispose`, auf `stage.sprite.material.map!.dispose`
     (vor dem ersten `render()` gegriffen), auf `stage.stageRenderer.dispose`.
     Für die Factory-Textur: `stage.needsUpdate = true; stage.render();` und
     danach einen Spy auf `stage.texture!.dispose` legen.
   - **(b)** Der hereingereichte `WebGPURenderer` wird nicht entsorgt, der Canvas
     behält `width` und `height`, und `stage.sprite.geometry.dispose` wird nicht
     gerufen — die dritte Assertion hält Entscheidung 6 fest.
   - **(c)** Nach `dispose()`: `isDisposed === true`, `texture` ist `undefined`,
     `sprite.parent` ist `null`, `stageRenderer.isDisposed === true`, und
     `render()`, `setContainerSize(…)`, `setCanvasSize(…)` sowie ein Schreibzugriff
     auf `fit` werfen nicht und bewirken nichts (`renderTo`-Spy zählt weiter 0,
     `canvas.width` unverändert).
   - **(d)** Zwei `dispose()` hintereinander werfen nicht, und die Spies aus (a)
     stehen danach je auf `calledOnce`.
   - **(e)** hat hier keinen Gegenstand: weder `Canvas2DStage` noch `Stage2D` noch
     `OrthographicProjection` benutzen `@spearwolf/signalize` — nachgesehen, kein
     Import in `src/stage/`. Als Kommentar in den Block, wie in
     `StageRenderer.spec.ts:735`.
   - **(f)** hat hier keinen Gegenstand: die Klasse nimmt keinen Slot aus einem
     Pool und keine Kachel aus einer Factory. Ebenfalls als Kommentar.

   Dazu ein Test außerhalb des `dispose()`-Blocks, der das Ereignis belegt:
   ein `on(stage, 'dispose', handler)` bekommt genau einen Aufruf, und ein
   danach abonnierter `'render'`-Handler bekommt keinen.

10. **`packages/twopoint5d/src/stage/README.md` — zwei Stellen.** In der Tabelle
    »Class roles« (`:47`) den Satz zu `Canvas2DStage` um den Halbsatz ergänzen,
    dass es alles freigibt, was es selbst gebaut hat. Im Abschnitt »Resource
    lifecycle« (`:425`) die Aufzählung um die neuen Zusagen erweitern: ein
    entsorgter `StageRenderer` legt kein `RenderTarget` mehr an, `asPassNode()`
    wirft, `renderTo()` tut nichts, ein Schreibzugriff auf `pipeline` fällt
    durch, und `remove()` räumt beide Seiten. Englisch, schlicht, kein Rückblick
    auf den Vorzustand.

11. **`packages/twopoint5d/CHANGELOG.md` — unter `[Unreleased]`**, nach dem Skill
    `updating-changelog`. Unter `### Added` ein Eintrag für
    `Canvas2DStage#dispose()` und `#isDisposed`. Unter `### Changed` ein Eintrag
    für den neuen Vertrag von `StageRenderer` nach `dispose()` (`asPassNode()`
    wirft, `renderTo()` tut nichts, `pipeline` nimmt keinen Schreibzugriff mehr)
    und einer für `remove()`, das die `parent`-Referenz des Kindes mit auflöst.
    Beide mit dem Verweis auf die Richtlinie in der Form, die die vorhandenen
    Einträge benutzen. Keine Finding-Nummern, in keiner Zeile.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `typecheck` deckt die neue Spec mit ab (`pnpm build` lässt `*.spec.ts` aus),
  `test:browser` fährt `stage-renderer.test.js` und `stage-pipeline.test.js`
  gegen echtes WebGPU und ist die einzige Probe darauf, dass der frühe Ausgang
  in `renderTo()` keinen lebenden Renderpfad mit abschneidet.
- Commit: `fix(stage): give Canvas2DStage a dispose() and hold a disposed renderer to its word`
- Ergebnis: 3 Runden · `Canvas2DStage` hat ein `dispose()`, ein entsorgter
  `StageRenderer` baut kein RenderTarget mehr und räumt beide Seiten der
  Eltern-Kind-Beziehung · Regressionstests: sechs in `StageRenderer.spec.ts`
  (`throws instead of building a pass target after dispose()`, `does not
  pre-render a disposed child into a fresh pass target`, `leaves the renderer
  alone after dispose()`, `takes no pipeline after dispose()`, `remove() clears
  the parent of the child it lets go`, dazu zwei Zeilen in `behaves as
  documented after dispose()`) und fünf in `Canvas2DStage.spec.ts`, alle vor dem
  Fix rot gesehen · eine Abweichung vom Detailplan, vom Reviewer als
  Verbesserung bestätigt: der Platzhalter aus dem Konstruktor liegt in einem
  Feld `#placeholderTexture`, statt in `dispose()` über
  `material.map !== this.texture` gesucht zu werden — der Vergleich verfehlt ihn
  nach dem ersten `render()`, und er hätte eine vom Aufrufer gesetzte Textur mit
  entsorgt · Fehlerkette: 3 Befunde → 1 → 0
- Nebenbefunde: → Queue (5 Einträge: 1 → Scope, 3 → Audit, 1 → Audit/info)
- Folgen: keine · `QuadTreeVisualization.ts:18` ist der einzige
  `Canvas2DStage`-Aufrufer im Repo und entsorgt nichts; die 15
  `pipeline`-Zuweisungen im Repo stehen alle an lebenden Renderern und gehen
  unverändert durch das neue Accessor-Paar
- Schnittstellen: `Canvas2DStage#dispose()` und `#isDisposed` — beides neu; das
  `dispose()` gibt `SpriteMaterial`, die Platzhalter-Textur des Konstruktors,
  die Factory-Textur und den selbst gebauten `StageRenderer` frei, nimmt den
  Sprite vorher aus der Szene und lässt den hereingereichten `WebGPURenderer`,
  den Canvas und die modulweit geteilte `Sprite`-Geometrie unangetastet · nach
  `dispose()` antwortet `Canvas2DStage#texture` mit `undefined`, und `render()`,
  `setCanvasSize()`, `setContainerSize()` sowie ein Schreibzugriff auf `fit`
  sind stille No-ops; `canvas`, `renderer`, `projection`, `stage`, `scene`,
  `sprite`, `stageRenderer`, `width`, `height` und `needsUpdate` behalten ihre
  Werte · das Feld `Canvas2DStage#texture` gehört der Stage, gleich wer es
  geschrieben hat — das TSDoc sagt es an beiden Stellen ·
  `StageRenderer#pipeline` ist ein Accessor-Paar statt eines Instanzfeldes; Lese-
  und Schreibsemantik einer lebenden Instanz sind unverändert, ein
  Schreibzugriff nach `dispose()` ist ein stiller No-op ·
  `StageRenderer#asPassNode()` wirft nach `dispose()`
  (`StageRenderer#asPassNode() is not available: this renderer has been
  disposed`, aus der neuen Modulfunktion `disposedError(member)` in
  `StageRenderer.ts` — wer die Meldung ändert, ändert sie dort); der Wächter
  sitzt in `#ensureAsPassNodeRT()` und greift deshalb auch auf dem Weg über
  `#renderPipelineComposed()`: ein **lebender** Halter mit einem entsorgten Kind
  wirft ab jetzt in jedem Frame, statt ein leeres Kind zu rendern und dabei ein
  RenderTarget zu leaken. Der Migration Guide im CHANGELOG nennt den Ausweg —
  ein über `add()` eingehängtes Kind muss vor seinem `dispose()` über
  `parent.remove(child)` heraus · `StageRenderer#renderTo()` ist nach
  `dispose()` ein No-op und räumt insbesondere das Ziel des Aufrufers nicht mehr
  · `StageRenderer#remove(child)` löst auch die `parent`-Referenz des Kindes,
  und `#removeFromParent()` gibt `#parent` frei, **bevor** es
  `OnRemoveFromParent` emittiert: ein Listener liest dort jetzt `undefined`
  statt des alten Halters

### [x] 13. controls: dispose() mitten im Ziehen

- Nebenbefund: aus Paket 7 (drei Einträge der Queue: `PanControl2D.dispose()`
  stellt den Cursor auf dem hereingereichten Element nicht wieder her und leert
  `#pointersDown` nicht, sodass ein späteres `update()` den alten Pan noch
  ausliefert; `InputControlBase.subscribe()` belebt ein abgebautes Control
  wieder) · dazu ein vierter Eintrag aus Zug 0 dieses Pakets: der Setter
  `cursorPanStyle` schreibt nach `dispose()` weiter an der modulweit geteilten
  Stylesheet-Regel
- Ziel: Ein Control, das mitten im Ziehen entsorgt wird, lässt das Element
  unverändert zurück, liefert nichts mehr aus und lässt sich nicht wiederbeleben.
- Bereich: `packages/twopoint5d/src/controls/PanControl2D.ts`,
  `InputControlBase.ts`; `packages/twopoint5d-testing/test/pan-control-dispose.test.js`
- Hängt ab von: 7
- Hash: e41b45a
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/controls/InputControlBase.ts` ·
  `packages/twopoint5d/src/controls/InputControlBase.spec.ts` (neu) ·
  `packages/twopoint5d/src/controls/PanControl2D.ts` ·
  `packages/twopoint5d-testing/test/pan-control-dispose.test.js` ·
  `packages/twopoint5d/CHANGELOG.md`. Fünf Dateien, keine sechste.

  Keine Änderung an `packages/twopoint5d/src/controls/public-api.ts`:
  `InputControlBase` und `PanControl2D` stehen dort seit jeher, und dieses Paket
  führt kein neues Symbol ein — `dispose()` und `isDisposed` sind Member bereits
  exportierter Klassen.

  Keine Änderung an `packages/twopoint5d/docs/resource-lifecycle.md`.
  Nachgesehen an Abschnitt 3 und 4: dieses Paket bringt weder eine vierte
  Idempotenz-Bauform noch eine vierte Reaktion nach `dispose()`.
  `InputControlBase` nimmt das private Flag aus Abschnitt 3, `PanControl2D`
  greift über den geerbten Getter darauf zu (dieselbe Bauform wie
  `VertexObjectPool.ts:120-121`), und die stillen No-ops nach `dispose()` sind
  Regel 3 aus Abschnitt 4. Alles davon steht dort bereits.

  Keine Änderung an `apps/lookbook/`: `map2d-cam-visi.ts:90` und
  `map2d-rect-visi.ts:99` sind die einzigen `PanControl2D`-Aufrufer im Repo. Sie
  lesen `panView`, schreiben `pointerDisabled` und rufen `update()`, alles an
  einem lebenden Control; entsorgt wird dort keines.

#### Abgleich am Code, Zug 0 (2026-09-06)

Alle drei Einträge existieren unverändert. Kein Commit dieses Laufs hat eine der
beiden Dateien angefasst — `git log -- src/controls/` endet bei `ac64b5a`, lange
vor `3dd3207`. Gelesen wurde je die ganze Datei.

| Eintrag | Fundstelle heute | Urteil |
| --- | --- | --- |
| Cursor bleibt liegen | `PanControl2D.ts:365-368` — `dispose()` ist zeilengleich, ruft `destroyAllListeners()` und `off(this)`, sonst nichts. `#restoreCursorStyle()` steht bei `:285`, `#cursorStylesTarget` bekommt bei `:128` `document.body` als Vorgabe | unverändert |
| Pan wird nachgeliefert | `PanControl2D.ts:365-368` gegen `:200-226` — `update()` mischt bei `:209` über `mergePan(Array.from(this.#pointersDown.values()))` und schreibt das Ergebnis bei `:213-214` in die `panView` des Aufrufers | unverändert |
| Wiederbelebung | `InputControlBase.ts:46-53` — die Zeilenangabe des Eintrags (`47-55`) greift zwei Zeilen zu weit und schneidet `unsubscribe()` (`:55-60`) an; das Symbol ist dasselbe und steht unbewegt da. `subscribe()` setzt `#active = true` (`:51`) ohne jede Rücksicht darauf, dass `destroyAllListeners()` (`:62-65`) die Liste geleert hat | unverändert, Fundstelle präzisiert |

Zwei Wege führen heute in die Wiederbelebung, und der Eintrag nennt nur den
ersten:

1. `dispose()` → `subscribe()` → `#active` ist `true` über einer leeren Liste.
   Für sich genommen folgenlos, `isActive` verdeckt es. Aber danach hängt jeder
   `addEventListener()` seinen Listener wieder an den Host, und die öffentlichen
   Setter `pointerDisabled` und `keyboardDisabled` rufen genau den.
2. `dispose()` → `control.pointerDisabled = false` → drei Listener liegen wieder
   in `#listeners`, unangehängt, weil `#active` `false` ist → `control.isActive =
   true` → `subscribe()` hängt sie an. Das Control ist vollständig zurück, ohne
   dass je `subscribe()` von Hand gerufen wurde.

Der Wächter muss deshalb an beiden Stellen sitzen, in `subscribe()` **und** in
`addEventListener()`. Ein Wächter allein in `subscribe()` lässt Weg 2 offen.

**Ein vierter Befund, in Zug 0 gefunden, gleiche Ursache, hier mit aufgenommen.**
`set cursorPanStyle` (`PanControl2D.ts:141-146`) ruft
`#installCursorPanStyleRules()`, und das schreibt über
`Stylesheets.installRule('PanControl2D', …)` an einer Regel, die sich seit
Paket 9 **alle** Controls des Moduls teilen: ein Name trägt genau eine Regel, und
ein anderer `css`-Wert schreibt sie um. Ein entsorgtes Control kann damit den
Cursor jedes lebenden Controls umstellen. Das ist dieselbe Ursache wie die
Einträge 1 und 3 — eine entsorgte Instanz wirkt weiter nach außen — und dieselbe
Methode-nach-`dispose()`-Frage, die das TSDoc dieses Pakets ohnehin für jeden
öffentlichen Member beantworten muss. Aufgenommen statt in die Queue gelegt; der
Eintrag steht zusätzlich unter »Offene Befunde« mit dem Vermerk.

**Die Trennlinie, an der dieses Paket gemessen wird.** Nach `dispose()` hört eine
Instanz auf, nach außen zu wirken; Werte für sich selbst darf sie weiter
entgegennehmen. Deshalb wird der `cursorPanStyle`-Setter geschlossen (er schreibt
in ein modulweit geteiltes Stylesheet) und `pointerDisabled`, `keyboardDisabled`,
`panView`, `mouseButton`, `keyCodes` und die vier `speed…`-Felder bleiben offen
(sie schreiben in eigene Felder und treiben nichts mehr). Dieselbe Bauform hat
Paket 7 für `StageRenderer#resize()` und Paket 12 für `StageRenderer#pipeline`
gewählt; sie steht als Regel 3 in Abschnitt 4 der Richtlinie.

**`update()` bleibt nach `dispose()` arbeitsfähig**, und das ist Absicht: die vier
`speed…`-Felder sind öffentlich beschreibbar, `panView` gehört dem Aufrufer, und
`Map2DTileRenderer`-artige Halter rufen `update()` aus einer Frame-Schleife, die
nicht notwendigerweise im selben Zug endet. Der Test
`a listener subscribed before dispose() is never called again`
(`pan-control-dispose.test.js:120-140`) hält das seit Paket 7 fest und bleibt
unangetastet. Was `dispose()` wegnimmt, ist allein der aus Pointer-Ereignissen
angesammelte Pan.

**Zwei Fragen, die in Zug 0 entschieden wurden, damit sie im Review nicht neu
aufgehen:**

- `PanControl2D` bekommt **kein** `dispose`-Ereignis. Die Klasse kündigt heute
  keines an, und keiner der vier Befunde verlangt eins; ein neues Ereignis wäre
  öffentliche Fläche, nach der niemand gefragt hat. Punkt 3 der Checkliste in
  Abschnitt 7 der Richtlinie gilt der Reihenfolge, und die wird eingehalten: das
  Ereignis, das diese Klasse tatsächlich besitzt — `restoreCursor` —, geht raus,
  **bevor** `off(this)` läuft.
- `destroyAllListeners()` bleibt, was es ist: ein Zurücksetzen der Listenerliste,
  nach dem ein Control weiterbenutzbar ist. Der Grabstein hängt allein an
  `dispose()`. Die Methode ist öffentlich und exportiert, ihre heutige Bedeutung
  zu kippen wäre ein Bruch, den kein Befund verlangt — und die Trennung ist
  genau die, die `InputControlBase.spec.ts` unten festnagelt.

#### Nachgesehen und ohne Befund geblieben

- **`readOption.ts` und `controls/public-api.ts`** — eine Modulfunktion und zwei
  Re-Exports. Nichts zu entsorgen, keine Fundstelle.
- **Die beiden Aufrufer im Lookbook** (`map2d-cam-visi.ts:90`,
  `map2d-rect-visi.ts:99`) lesen `panView`, schreiben `pointerDisabled` und
  rufen `update()` — alles an einem lebenden Control. Keiner entsorgt eines,
  keiner liest einen Member nach einem `dispose()`. Die Wächter dieses Pakets
  liegen auf Wegen, die dort niemand geht.
- **Kein offener Eintrag in »Offene Befunde« liegt in `src/controls/`.** Alle 31
  offenen Einträge durchgesehen; die drei dieses Pakets sind die einzigen aus
  dem Verzeichnis, und die beiden `→ Scope`-Einträge ohne Paket
  (`map2d/HelpersManager.ts:39-46`, `stage/Canvas2DStage.ts:118-121`) haben eine
  andere Ursache und bleiben für die nächste Drain-Runde liegen.
- **Die geteilte Cursor-Regel ist kein zweiter Befund.** Zwei lebende Controls
  mit verschiedenen `cursorPanStyle`-Werten teilen sich seit Paket 9 eine Regel,
  und der jüngste Schreibzugriff gewinnt für beide. Vor Paket 9 gewann er
  ebenfalls — damals über die Kaskade, weil jede angehängte Regel denselben
  Selektor trug. Das Verhalten hat sich nicht bewegt; was dieses Paket schließt,
  ist allein der Schreibzugriff aus einer **entsorgten** Instanz.
- **`#hideCursorState` bleibt nach `dispose()` auf `MAYBE` stehen**, wenn eine
  Maustaste gedrückt war, ohne dass je gezogen wurde. Das Feld ist privat, kein
  öffentlicher Member liest es, und die Instanz ist tot. Ein Zurücksetzen wäre
  Kosmetik und keine Zusage, die jemand prüfen könnte.
- **Die beiden Folgen aus Paket 1 und Paket 4**, die Zug 0 von Paket 7 als
  erledigt vermerkt hat, sind gegen den heutigen Stand erneut nachgesehen —
  Paket 9 hat `Display.ts` nach jenem Vermerk noch einmal angefasst, und beide
  Folgen hängen an einem wörtlichen Zitat aus dieser Datei. Der Codeblock in
  `resource-lifecycle.md:181-195` ist Zeile für Zeile identisch mit
  `Display.ts:785-797`, und der in `:125-127` zitierte Fehlertext ist der, den
  `disposedError()` (`Display.ts:46-48`) baut. Beide bleiben geschlossen.

#### Restplan

Paket 14 ist unberührt — `vertex-objects/` teilt mit `controls/` keine Datei und
keine Ursache.

Paket 15 bekommt einen Vermerk über zwei Dateien, die ihren `(f)`-Eintrag aus
diesem Paket mitbringen: die neue `InputControlBase.spec.ts` von Geburt an, und
`pan-control-dispose.test.js`, deren Kommentarblock dieses Paket ohnehin
umschreibt. Die Zeile steht unter Paket 15. Der Grund, das hier mitzunehmen
statt es dort zu lassen, ist der Zuschnitt und nicht die Bequemlichkeit: Paket 15
fällt je Datei das Urteil, ob Fall `(f)` einen Gegenstand hat, und für
`PanControl2D` ist es hier bereits gefällt und belegt — die Klasse nimmt keinen
Slot aus einem Pool oder einer Factory. Paket 15 müsste eine Datei ein zweites
Mal aufmachen, um denselben Satz hineinzuschreiben.

Reihenfolge und Schnitt der offenen Pakete bleiben, wie sie sind.

#### Vorgehen

1. **`InputControlBase.ts` — Flag, Getter, `dispose()`.** Neu, hinter
   `unsubscribe()` und vor `destroyAllListeners()`:

   ```ts
   #disposed = false;

   /** `true` once {@link dispose} has run. */
   get isDisposed(): boolean {
     return this.#disposed;
   }
   ```

   und am Ende der Klasse, hinter `destroyAllListeners()`:

   ```ts
   /**
    * Take every listener off its host and put this control out of service.
    *
    * Every host was handed in and stays the caller's: this call removes only what this
    * control put on it and touches nothing else.
    *
    * Afterwards `isDisposed` is `true`, `isActive` is `false`, and the control cannot be
    * brought back — {@link subscribe}, a write of `true` to {@link isActive} and every
    * `addEventListener()` of a subclass do nothing, so no listener reaches a host again.
    * {@link unsubscribe}, {@link destroyAllListeners} and a further `dispose()` do nothing
    * either.
    *
    * {@link destroyAllListeners} is the other way to empty the list, and it is not this one:
    * a control that has been through it takes listeners again.
    */
   dispose(): void {
     if (this.#disposed) return;
     this.#disposed = true;
     this.destroyAllListeners();
   }
   ```

2. **`InputControlBase.ts` — die beiden Wächter.** In `addEventListener()` als
   erste Zeile, mit dem Grund als Kommentar:

   ```ts
   protected addEventListener(host: EventTarget, eventName: string, callback: any, passive = true) {
     // a disposed control takes no new listener. Without this, the public setters of a
     // subclass would refill the list and the next subscribe() would put a spent control
     // back on its hosts
     if (this.#disposed) return;
     // … unverändert weiter
   ```

   und in `subscribe()` ebenso als erste Zeile:

   ```ts
   subscribe() {
     if (this.#disposed) return;
     // … unverändert weiter
   ```

   `unsubscribe()`, `removeEventListener()` und `destroyAllListeners()` bekommen
   **keinen** Wächter: sie laufen über eine leere Liste und setzen `#active` auf
   den Wert, den es ohnehin schon hat. Der `isActive`-Setter bekommt ebenfalls
   keinen — er geht über `subscribe()` und `unsubscribe()` und ist damit
   mitgedeckt.

   Das TSDoc von `subscribe()` und `isActive` bekommt je einen Satz, was nach
   `dispose()` passiert.

3. **`PanControl2D.ts` — der `cursorPanStyle`-Setter.** Erste Zeile des Setters
   bei `:141`:

   ```ts
   set cursorPanStyle(value: string) {
     // the rule behind this is installed under one name for the whole module and shared by
     // every control of it — a disposed control does not get to rewrite what the living ones
     // are showing
     if (this.isDisposed) return;
     if (this.#cursorPanStyle !== value) {
   ```

   Der Konstruktor schreibt den Setter bei `:127`, also lange vor jedem
   `dispose()`; die Zuweisung geht unverändert durch.

4. **`PanControl2D.ts` — `dispose()` ersetzen.** `:365-368` weicht diesem Block,
   der `override` braucht (`noImplicitOverride` steht im Root-`tsconfig.json`):

   ```ts
   /**
    * Take every listener off `document`, give the cursor styles target back the way it was
    * found and drop the pan that was collected but never delivered.
    *
    * The `state` object and the `cursorStylesTarget` element were handed in and stay the
    * caller's: the state keeps the values the last {@link update} wrote, and the element keeps
    * everything but the cursor class this control put on it.
    *
    * Afterwards `isDisposed` is `true`, `isActive` is `false`, and neither a pointer nor a key
    * reaches this control any more. {@link update} still moves {@link panView} by the speed
    * fields a caller sets by hand — what it no longer delivers is a pan from a drag before the
    * call. A write to {@link cursorPanStyle} is refused: it would rewrite a style rule every
    * control of the module shares. `pixelsPerSecond`, `mouseButton`, `keyCodes`,
    * `keyboardDisabled`, `pointerDisabled`, `panView` and the four `speed…` fields still take
    * values, they just drive nothing. Every listener on this control goes with it, and a
    * further `dispose()` does nothing.
    */
   override dispose(): void {
     if (this.isDisposed) return;

     // first: with the listeners off document, no pointer event can refill the state the
     // lines below give up
     super.dispose();

     // the class sits on an element that belongs to the caller, and it comes off here. Only
     // from YES: that is the one state in which it was added and a hideCursor went out, and
     // the class name is shared across the module — restoring from MAYBE would take the class
     // off a target another control is still hiding behind.
     if (this.#hideCursorState === HideCursorState.YES) {
       this.#restoreCursorStyle();
     }

     this.#pointersDown.clear();

     // last: the restoreCursor above still has to reach the listeners that act on it
     off(this);
   }
   ```

   Bewusst in Kauf genommen und im TSDoc nicht versprochen: teilen sich zwei
   lebende Controls denselben `cursorStylesTarget` und ziehen beide, nimmt das
   `dispose()` des einen die geteilte Klasse auch dem anderen weg, bis dessen
   nächstes `pointerdown`/`pointermove` sie neu setzt. Das ist der Preis dafür,
   dass Abschnitt 2 der Richtlinie schwerer wiegt: ein hereingereichtes Element
   wird nicht verändert zurückgelassen. Die Alternative — die Klasse liegen
   lassen — ist genau der Befund.

5. **`InputControlBase.spec.ts` — neu.** Vitest, kein DOM nötig: `EventTarget`
   ist in Node global, ein `new EventTarget()` reicht als Host. Aufbau nach
   Abschnitt 8 der Richtlinie, mit `createSandbox()` aus `sinon` wie in den
   übrigen Specs des Repos.

   ```ts
   import {createSandbox} from 'sinon';
   import {afterEach, describe, expect, test} from 'vitest';

   import {InputControlBase} from './InputControlBase.js';

   // addEventListener/removeEventListener are protected: a subclass is how a caller reaches
   // them, and how this spec does
   class TestControl extends InputControlBase {
     listen(host: EventTarget, eventName: string, callback: EventListener) {
       this.addEventListener(host, eventName, callback);
     }

     unlisten(host: EventTarget, eventName: string, callback: EventListener) {
       this.removeEventListener(host, eventName, callback);
     }
   }
   ```

   Ein `describe('InputControlBase')` mit einem Fall für den lebenden Zustand —
   `listen()` hängt an, `unsubscribe()`/`subscribe()` gehen hin und zurück — und
   darin ein `describe('dispose()')` mit:

   - Kommentar zu **(a)** und **(b)**: die Klasse baut keine eigene Ressource,
     die sie freigeben könnte. Was sie hält, sind Listener-Registrierungen auf
     Hosts, die dem Aufrufer gehören; der Fall darunter ist deren Freigabe und
     zugleich der Beleg, dass am Host sonst nichts angefasst wird.
   - `test('takes its listeners off the host')` — `sandbox.spy(host,
     'removeEventListener')`, zwei Listener anhängen, `dispose()`, danach je ein
     `removeEventListener`-Aufruf und ein `dispatchEvent` erreicht keinen
     Handler mehr.
   - `test('behaves as documented after dispose()')` — **(c)**: `isDisposed`
     `true`, `isActive` `false`, und `subscribe()`, `unsubscribe()`,
     `destroyAllListeners()`, ein `unlisten()` und ein zweites `dispose()`
     werfen nichts.
   - `test('cannot be brought back')` — beide Wege aus dem Abgleich in einem
     Fall: nach `dispose()` erst `subscribe()`, dann `listen(host, …)`, dann
     `isActive = true`; danach `isActive` `false`, `isDisposed` `true`, und ein
     `dispatchEvent` zählt null Aufrufe.
   - `test('is safe to call twice')` — **(d)**: zwei `dispose()` werfen nicht,
     und der `removeEventListener`-Spion hat je Registrierung genau einen
     Aufruf gesehen.
   - `test('destroyAllListeners() is not dispose()')` — die Gegenprobe zur
     Entscheidung oben: nach `destroyAllListeners()` ist `isDisposed` `false`,
     ein neues `listen()` hängt an, und der Host bekommt sein Ereignis wieder.
   - Kommentar zu **(e)**: kein Signal, kein Effekt — die Klasse legt keines an.
   - Kommentar zu **(f)**: kein Slot aus einem Pool oder einer Factory — die
     Klasse nimmt keinen.

   Rote Läufe, gemessen am heutigen Stand: `takes its listeners off the host`
   grün (das kann `destroyAllListeners()` schon), alle übrigen rot — `dispose()`
   und `isDisposed` existieren an der Basisklasse nicht.

6. **`pan-control-dispose.test.js` — drei Fälle dazu, ein Kommentar ersetzt.**

   Der Kommentarblock bei `:53-55` behauptet, Assertion **(b)** habe hier keinen
   Gegenstand. Sie hat einen: `cursorStylesTarget` ist hereingereicht, und
   Abschnitt 2 der Richtlinie verlangt für Hereingereichtes nicht nur »nicht
   freigeben«, sondern auch »nicht verändern«. Der Block weicht zwei Zeilen, die
   auf den neuen Fall zeigen. Die Blöcke zu **(a)** und **(e)** bleiben Wort für
   Wort stehen; dazu kommt ein Block zu **(f)** — kein Slot aus einem Pool oder
   einer Factory, `#pointersDown` hält eigene Objekte —, damit dieser
   Dispose-Test-Block dieselbe Auskunft gibt wie die neun Spec-Dateien aus
   Paket 15.

   Die drei neuen Fälle, alle mit einem eigenen, nicht angehängten
   `document.createElement('div')` als `cursorStylesTarget` — `classList` trägt
   auch an einem losen Element, und `document.body` würde zwischen den Fällen
   und zwischen Chromium und Firefox durchschlagen:

   ```js
   it('leaves the cursor styles target as it found it', () => {
     const target = document.createElement('div');
     control = new PanControl2D({state: makeState(), cursorStylesTarget: target});

     pointer('pointerdown', {x: 10, y: 10});
     pointer('pointermove', {x: 30, y: 10});
     expect(target.classList.length, 'the cursor class while panning').to.equal(1);

     control.dispose();

     expect(target.classList.length, 'after dispose()').to.equal(0);
   });

   it('delivers no pan collected before dispose()', () => {
     control = new PanControl2D({state: makeState()});

     pointer('pointerdown', {x: 10, y: 10});
     pointer('pointermove', {x: 30, y: 10});
     control.dispose();
     control.update(1 / 60);

     expect(control.panView.x, 'panView.x').to.equal(0);
     expect(control.panView.y, 'panView.y').to.equal(0);
   });

   it('cannot be brought back through its public setters', () => {
     control = new PanControl2D({state: makeState()});

     control.dispose();

     // the way that needs no subscribe() call at all: the setter re-registers, and a write
     // to isActive is what would hook the list back onto document
     control.pointerDisabled = false;
     control.isActive = true;

     expect(control.isDisposed, 'isDisposed').to.equal(true);
     expect(control.isActive, 'isActive').to.equal(false);

     pointer('pointerdown', {x: 10, y: 10});
     pointer('pointermove', {x: 30, y: 10});
     control.update(1 / 60);

     expect(control.panView.x, 'panView.x').to.equal(0);
   });
   ```

   Rote Läufe, gemessen am heutigen Stand: der erste findet die Klasse nach dem
   `dispose()` noch auf dem Element, der zweite `-20` statt `0`, der dritte ein
   wiederbelebtes Control mit `-20`.

   Die fünf vorhandenen Fälle bleiben unberührt und laufen unverändert grün.
   Nachgesehen: `ignores keyboard and pointer after dispose()` drückt erst nach
   dem `dispose()` und sammelt deshalb nichts an; `subscribe() after dispose()
   hooks nothing up again` bekommt mit dem Wächter denselben Ausgang aus dem
   besseren Grund; `a listener subscribed before dispose() is never called
   again` lebt von den handgesetzten `speed…`-Feldern, die `update()` weiter
   bedient; `is safe to call twice` trifft ab jetzt einen echten Wächter.

7. **`CHANGELOG.md` — je ein Eintrag unter `[Unreleased]`**, nach dem Skill
   `updating-changelog`, im Ton der Nachbarzeilen (Englisch, ein Satz, der ohne
   Kenntnis des Vorzustands trägt):

   - unter **Added**: `InputControlBase#dispose()` und `#isDisposed` — was das
     `dispose()` abräumt, dass die Hosts dem Aufrufer gehören, dass ein
     entsorgtes Control nicht zurückkommt, und dass `destroyAllListeners()`
     davon unberührt weiter ein Zurücksetzen ist.
   - unter **Fixed**: `PanControl2D#dispose()` — die Cursor-Klasse kommt vom
     hereingereichten Element herunter, der angesammelte Pan wird verworfen,
     und ein Schreibzugriff auf `cursorPanStyle` nach `dispose()` fällt durch,
     statt die modulweit geteilte Regel umzuschreiben.

   Kein Eintrag unter **Migration Guide**: es gibt nichts umzustellen. Wer
   `dispose()` ruft, bekommt mehr Aufräumen, nicht weniger; die einzige
   weggefallene Fähigkeit — ein entsorgtes Control wiederbeleben — war nie ein
   zugesagter Zustand, und `destroyAllListeners()` verhält sich unverändert.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `typecheck` deckt die neue Spec mit ab (`pnpm build` lässt `*.spec.ts` aus),
  `test:ci` fährt sie, und `test:browser` ist Pflicht, weil Schritt 6 die einzige
  Datei anfasst, die `PanControl2D` gegen ein echtes `document` mit echten
  `PointerEvent`s fährt — unter Vitest gibt es keines, das ist der Hinweis aus
  Paket 3, der hier weiter gilt. Nicht separat geprobt: seit `5e8d036` ist keine
  Zeile im Arbeitsbaum bewegt worden, und dessen Verify lief über dieselben vier
  Kommandos grün.
- Commit: `fix(controls): restore the cursor, drop the pending pan and keep a disposed control disposed`
- Ergebnis: 1 Runde · alle vier Befunde behoben — `PanControl2D#dispose()`
  stellt den Cursor auf dem hereingereichten Element wieder her
  (`PanControl2D.ts:397-400`) und leert `#pointersDown` (`:401`), der
  `cursorPanStyle`-Setter ist nach `dispose()` ein stiller No-op (`:141-146`),
  und beide Wiederbelebungswege sind zu (`InputControlBase.ts:18` in
  `addEventListener()`, `:68` in `subscribe()`) · Regressionstests, alle vor dem
  Fix rot: `InputControlBase.spec.ts` mit `takes its listeners off the host`,
  `behaves as documented after dispose()`, `cannot be brought back`,
  `is safe to call twice`, `destroyAllListeners() is not dispose()`, dazu
  `takes no listener back after dispose()` aus Runde 1 (rot nur mit
  herausgenommenem Wächter, der Beleg steht im Report) · `pan-control-dispose.test.js`
  mit `leaves the cursor styles target as it found it`,
  `delivers no pan collected before dispose()` und
  `cannot be brought back through its public setters` · Verify ohne Nx-Cache
  nachgefahren, Exit 0 · keine offenen Befunde
- Nebenbefunde: → Queue (drei, alle in `PanControl2D.ts`, alle mit Urteil
  »→ Audit«)
- Folgen: keine — die beiden Aufrufer im Lookbook
  (`apps/lookbook/…/map2d-cam-visi.ts:90`, `map2d-rect-visi.ts:99`) arbeiten an
  lebenden Controls und laufen unverändert durch `pnpm typecheck` samt
  `astro check`
- Schnittstellen: `InputControlBase#dispose()` und `#isDisposed` — beides neu an
  der Basisklasse, geerbt von jedem Control · nach `dispose()` sind
  `subscribe()` und das geschützte `addEventListener()` stille No-ops, ein
  entsorgtes Control nimmt also keinen Listener mehr an und lässt sich über
  keinen der beiden Wege zurückholen; ein Schreibzugriff `isActive = true` geht
  über `subscribe()` und ist damit mitgedeckt · `destroyAllListeners()` bleibt
  unverändert ein Zurücksetzen, nach dem ein Control wieder Listener nimmt —
  es setzt `#disposed` nicht und lässt über `unsubscribe()` `#active` auf
  `false`, eine danach abgesetzte Registrierung wartet also auf ein
  `subscribe()` · `PanControl2D#dispose()` ist ein `override`, schickt bei
  verstecktem Cursor ein letztes `restoreCursor` vor dem `off(this)` und lässt
  `update()` arbeitsfähig — was es nicht mehr ausliefert, ist der aus Pointern
  angesammelte Pan · ein Schreibzugriff auf `PanControl2D#cursorPanStyle` nach
  `dispose()` fällt durch, die übrigen Setter nehmen weiter Werte an und treiben
  nichts

**Der Cursor bleibt versteckt liegen · low · `packages/twopoint5d/src/controls/PanControl2D.ts:365-368`**

`dispose()` ruft `#restoreCursorStyle()` nicht. Wer ein Control mitten im Ziehen
entsorgt, lässt die Pan-Cursor-Klasse auf `cursorStylesTarget` liegen (Vorgabe
`document.body`, `:128`), und der Cursor bleibt für den Rest der Seite
unsichtbar. Das Element ist hereingereicht — Abschnitt 2 der Richtlinie sagt:
nicht verändert zurücklassen. Der Kommentar in
`packages/twopoint5d-testing/test/pan-control-dispose.test.js:53-56` schließt
genau die Assertion (b) aus, die das gefangen hätte, und ist beim Fix
mitzuziehen; der erste Fall derselben Datei löst `#hideCursor()` tatsächlich aus.

**Der angesammelte Pan wird nachgeliefert · low · `packages/twopoint5d/src/controls/PanControl2D.ts:365-368` gegen `:200-215`**

`dispose()` leert `#pointersDown` nicht. Wer mitten im Ziehen entsorgt, dessen
nächster `update()`-Aufruf schiebt den vor dem `dispose()` angesammelten Pan noch
einmal in die `panView` des Aufrufers. Der Testfall aus Paket 7 trifft das nicht,
weil er erst nach dem `dispose()` drückt; ein
`pointerdown`/`pointermove`/`dispose()`/`update()` in dieser Reihenfolge zeigt es.

**Ein abgebautes Control lässt sich wiederbeleben · low · `packages/twopoint5d/src/controls/InputControlBase.ts:46-53`**

`subscribe()` nach `destroyAllListeners()` setzt `#active` wieder auf `true`, über
einer leeren Liste. Das Control ist danach formal aktiv und faktisch taub;
`isActive` verdeckt es nur, weil es zusätzlich die Listenlänge prüft. Ein
`isDisposed` gibt es an der Basisklasse nicht, ein entsorgtes Control kann seinen
Zustand also nicht benennen. Dieselbe Wiederbelebungslücke, die Paket 3 an
`Display` und Paket 7 an `StageRenderer` geschlossen haben.

**Ein entsorgtes Control schreibt an der geteilten Cursor-Regel · low · `packages/twopoint5d/src/controls/PanControl2D.ts:141-146`**

Der Setter `cursorPanStyle` ruft `#installCursorPanStyleRules()` und schreibt
darüber an `Stylesheets.installRule('PanControl2D', …)`. Seit Paket 9 trägt ein
Name genau eine Regel im globalen Blatt, und ein anderer `css`-Wert schreibt sie
um — die Regel gehört damit allen Controls des Moduls gemeinsam. Ein Control,
dessen `dispose()` gelaufen ist, kann auf diesem Weg den Cursor jedes lebenden
Controls umstellen. Nach Regel 3 in Abschnitt 4 der Richtlinie ist der
Schreibzugriff auf einer entsorgten Instanz ein stiller No-op.

### [x] 14. vertex-objects: der Vertrag eines entsorgten Pools

- Nebenbefund: aus Paket 7 (ein Eintrag der Queue: `VOBufferPool#createFromAttributes()`
  wirft nach `dispose()` einen nackten `TypeError` aus `copyAttributes()`), in Zug 0
  um drei weitere öffentliche Member derselben beiden Klassen erweitert — dieselbe
  Ursache, dieselbe Zeile Fix je Stelle, siehe »Was der Abgleich zusätzlich gefunden hat«
- Ziel: Jedes öffentliche Member von `VOBufferPool` und `VertexObjectPool` antwortet
  nach `dispose()` nach einer der drei Reaktionen aus Abschnitt 4 der Richtlinie, und
  kein Weg belebt einen entsorgten Pool wieder.
- Bereich: `packages/twopoint5d/src/vertex-objects/`
- Hängt ab von: 5, 7
- Hash: 82c275b
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`,
  `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`,
  `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`,
  `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `typecheck` deckt die Spec mit ab (`pnpm build` lässt `*.spec.ts` aus), `test:ci`
  fährt sie. `test:browser` läuft mit, weil `vertex-objects-dispose.test.js` und
  `vertex-objects-gpu-upload.test.js` Pools und Geometrien über echte GPU-Buffer
  fahren und die einzige Stelle wären, an der ein Guard am Pool als geänderter
  Upload-Pfad sichtbar würde. Nachgesehen: keiner der beiden Browser-Tests ruft
  `createVO()`, `resize()` oder `createFromAttributes()` auf einem entsorgten Pool,
  die Erwartung ist also grün — das Kommando ist der billige Beleg dafür, keine
  offene Frage. Nicht als Ganzes geprobt: seit `e41b45a` ist keine Zeile im
  Arbeitsbaum bewegt worden, und dessen Verify lief über dieselben vier Kommandos
  grün. Geprobt wurde in Zug 0 die Spec dieses Pakets allein
  (`pnpm vitest --run src/vertex-objects/VertexObjectPool.spec.ts`): Exit 0,
  40 Tests, 190 ms
- Commit: `fix(vertex-objects): let a disposed pool refuse every slot and stay disposed`
- Ergebnis: 1 Runde · alle vier Stellen behoben — `VOBufferPool#availableCount`
  antwortet `0` (`:44-51`), `#createFromAttributes()` wirft (`:111-127`),
  `VertexObjectPool#createVO()` antwortet `undefined` ohne den abgewiesenen Slot
  zu zählen (`:115-123`), `#resize()` wirft als erste Anweisung des Rumpfes
  (`:45-47`) · vier Regressionstests, alle vier vor dem Fix rot (`4 failed |
  40 passed`; Test 3 fiel nicht an `toBeUndefined()`, sondern mit einem
  `TypeError` aus `createVertexObjectPrototype.ts:12`, weil die Assertion den
  Wert formatiert und dabei seine Getter zieht — derselbe Defekt, andere
  Fehlerart): `VOBufferPool: createFromAttributes() refuses a disposed pool`,
  `VOBufferPool: availableCount is zero after dispose()`, `VertexObjectPool:
  createVO() answers nothing after dispose() and hands out no slot`,
  `VertexObjectPool: resize() refuses a disposed pool and leaves it dead` · der
  Reviewer hat den roten Lauf selbst nachgestellt (beide Quelldateien auf `HEAD`
  zurück, Spec stehen lassen) statt ihn zu glauben · Verify ohne Nx-Cache
  gefahren, alle vier Kommandos Exit 0 · klein, nicht behoben: der
  CHANGELOG-Satz stellt `getVO()` neben `clear()` und `freeVO()` unter »go on
  doing nothing«, es antwortet aber `undefined` — Reaktion 1 der Richtlinie,
  nicht Reaktion 3; der Wortlaut kam so aus Schritt 8 des Detailplans, der Diff
  weicht nicht ab
- Nebenbefunde: → Queue (2 Einträge, beide `→ Scope`)
- Folgen: keine — kein Aufrufer von `resize()` außerhalb der Spec, jeder
  Aufrufer von `createVO()` behandelt `undefined` bereits
  (`TexturedSpritesGeometry.ts:52-55`, `TileSpritesGeometry.ts:18`, die
  Lookbook-Demos), und `createFromAttributes()` wird nirgends an einem Pool
  gerufen, der entsorgt sein könnte
- Schnittstellen: an einem entsorgten `VOBufferPool` antwortet `availableCount`
  `0` und `createFromAttributes()` wirft; an einem entsorgten
  `VertexObjectPool` antwortet `createVO()` `undefined` und `resize()` wirft.
  Der Text von `resize()` kommt aus einer zweiten, dateilokalen Funktion
  `disposedError()` in `src/vertex-objects/VertexObjectPool.ts` (nennt
  `VertexObjectPool`), der von `createFromAttributes()` weiterhin aus der in
  `VOBufferPool.ts` (nennt `VOBufferPool`, auch an einer erbenden Instanz) —
  wer eine Meldung ändert, ändert sie in der jeweiligen Datei.
  `clear()`, `freeVO()`, `getVO()`, `containsVO()`, der `usedCount`-Setter,
  `capacity` und `descriptor` sind unverändert und bleiben es bewusst

#### Abgleich am Code, Zug 0 (2026-09-06)

Der Eintrag aus der Queue steht unverändert. `VOBufferPool#dispose()`
(`VOBufferPool.ts:93-101`) setzt `#disposed`, nullt `usedCount`, nimmt jedem
Buffer sein `typedArray` und leert `this.buffer.buffers`.
`createFromAttributes()` (`:103-108`) reicht ohne jede Prüfung an
`VertexObjectBuffer#copyAttributes()` durch, und das greift in Zeile 170-171 über
`this.buffers.get(attr.bufferName)!` auf `undefined` zu.

Nachgemessen gegen den gebauten Stand (`dist/lib/`, deckungsgleich mit `src/`),
Deskriptor mit `vertexCount: 4` und den Attributen `foo`/`bar` wie in der Spec:

```
createFromAttributes({bar: [1,1,1,1]}) nach dispose()
  → TypeError: Cannot read properties of undefined (reading 'typedArray')
```

Das ist wörtlich die Reaktion, die Abschnitt 4 der Richtlinie ausschließt
(»a `TypeError` raised deep inside the class because a field quietly became
`undefined`«).

`VertexObjectPool.ts` ist seit `3dd3207^` **byteidentisch** — `diff` gegen
`git show 3dd3207^:…` ist leer. Beide Klassen sind damit unverändert
vorbestehend, und was hier steht, ist keine Folge dieses Laufs.

#### Was der Abgleich zusätzlich gefunden hat

Drei weitere öffentliche Member derselben beiden Klassen laufen aus derselben
Ursache gegen die Richtlinie: `dispose()` setzt ein Flag, das außer den zwei
Methoden aus Paket 7 niemand liest. Alle drei sind an einem entsorgten Pool
gemessen, nicht abgeleitet.

| Stelle | Gemessen | Regel |
| --- | --- | --- |
| `VertexObjectPool.ts:101-109` — `createVO()` | Liefert ein Vertex-Objekt zurück, hebt `usedCount` von 0 auf 1 und senkt `availableCount` auf 9. Jeder Zugriff darauf wirft: `vo.x0` lesen, `vo.x0` schreiben, `getFoo()`, `setFoo()`, `getBar()` — je `TypeError: Cannot read properties of undefined (reading 'typedArray')` aus `createVertexObjectPrototype.ts:12-13`. Danach antwortet auch `getVO(0)` wieder mit einem Objekt und `containsVO(vo)` mit `true` | Abschnitt 4 Regel 1 |
| `VertexObjectPool.ts:34-99` — `resize()` | Belebt den Pool wieder. Gemessen an einem entsorgten Pool mit Kapazität 10: `resize(20)` läuft durch, `buffer.buffers.size` geht von 0 auf 1, `capacity` wird auf 20 umdefiniert, `isDisposed` bleibt `true` — und ein anschließendes `createVO()` liefert ein Objekt, in das sich schreiben und aus dem sich lesen lässt (`vo.bar = 42` → `42`). Dieselbe Wiederbelebungslücke, die Paket 3 an `Display`, Paket 7 an `StageRenderer` und Paket 13 an `InputControlBase` geschlossen haben | Abschnitt 4 Regel 3, zweiter Satz |
| `VOBufferPool.ts:44-46` — `availableCount` | Antwortet an einem entsorgten Pool mit `10`, also mit der vollen Kapazität. Das ist kein bloß hässlicher Wert: `for (let i = 0; i < pool.availableCount; i++) pool.createVO()!.setFoo(…)` ist die Schleife, die jede Demo in `apps/lookbook/` schreibt, und sie stürzt an einem entsorgten Pool in der ersten Runde ab | Abschnitt 4 |

Sie gehören in dieses Paket und nicht in die Queue. Die Ursache ist eine,
die Klasse ist dieselbe, und der Fix ist je eine Zeile. Drei Pakete daraus zu
machen hieße, dieselbe Ursache dreimal halb zu beheben. Vor allem aber: die
Zielzeile dieses Pakets — die dritte öffentliche Methode hält denselben Vertrag
wie ihre zwei Geschwister — wäre in dem Moment falsch, in dem sie geschrieben
ist, denn `createVO()` ist eine vierte mit demselben Defekt und demselben
`TypeError`. Assertion (c) aus Abschnitt 8 (»every public member behaves after
`dispose()` as its TSDoc says«) ist für `VertexObjectPool` nicht ehrlich zu
schreiben, solange sie stehen. Genau dieses Argument hat Paket 7 benutzt, um
`toBuffersData()` und `fromBuffersData()` hereinzuholen.

Blast Radius nachgesehen, nicht geschätzt: `grep` über `packages/` und `apps/`
findet keinen einzigen Aufrufer von `VertexObjectPool#resize()` außerhalb der
Spec, und jeder Aufrufer von `createVO()` behandelt `undefined` bereits — der
Rückgabetyp ist seit dem letzten Lauf `(VOType & VO) | undefined`.

#### Sechs Entscheidungen dieses Zuges

Getroffen mit dem Code vor Augen. Sie stehen hier und nicht im Kopf des Plans.

1. **`createFromAttributes()` wirft.** Der Grobplan zeigt darauf, und die Messung
   trägt es: die Methode antwortet an einem entsorgten Pool `[0, 0]`, wenn man
   sie ließe — und genau dasselbe Paar antwortet ein lebender, leerer Pool, dem
   man nichts gegeben hat. Ein Aufrufer kann einen verbrauchten Pool von einem
   bedienbaren nicht unterscheiden. Das ist wörtlich das Argument, mit dem
   Paket 7 `toBuffersData()` zum Werfen gebracht hat (»Daten, die wie ein leerer
   Pool aussehen und nicht wie ein toter«).
2. **`createVO()` antwortet `undefined`, es wirft nicht.** Abschnitt 4 Regel 1
   entscheidet das und nicht der Geschmack: der deklarierte Typ ist
   `(VOType & VO) | undefined`, die Methode antwortet ohnehin schon mit
   `undefined`, sobald `usedCount` die Kapazität erreicht hat, und jeder
   Aufrufer muss den Fall behandeln. Ein Wurf wäre hier die härtere und die
   falsche Antwort.
3. **`resize()` wirft, und der Guard steht vor allen anderen Prüfungen.** Die
   Methode weist ungültige Eingaben schon heute zurück — eine nicht-ganzzahlige
   Kapazität und jede Änderung an einer Geometrie —, sie ist also keine
   stillschweigend nachgebende Methode, für die Regel 3 gedacht ist; derselbe
   Sonderfall, mit dem Paket 7 `fromBuffersData()` begründet hat. Der Guard
   steht als erste Anweisung, damit auch `resize(sameCapacity)` und eine
   kaputte Zahl den Fehler nennen, der den wirklichen Fehler benennt: die
   Benutzung einer freigegebenen Instanz. Eine Ausnahme für den
   Identitätsfall wäre eine zweite Regel für nichts.
4. **`availableCount` antwortet `0`, es wirft nicht.** Kein Wurf, weil ein
   Zähler-Getter, der wirft, aus einem diagnostischen Blick
   (`console.log(pool.availableCount)`) einen Absturz macht. `0` ist keine
   Ausweichantwort, sondern die richtige: nachdem `createVO()` `undefined`
   antwortet und `createFromAttributes()` wirft, ist die Zahl der Slots, die ein
   Aufrufer noch nehmen kann, wirklich null.
5. **Der `usedCount`-Setter, `clear()`, `freeVO()`, `getVO()`, `containsVO()`,
   `capacity`, `descriptor` und `buffer` bleiben, wie sie sind.** Nachgesehen an
   einem entsorgten Pool: `clear()` und `freeVO()` sind stille No-ops,
   `getVO()` antwortet `undefined`, `containsVO()` antwortet `false` — alle vier
   erfüllen Abschnitt 4 bereits. `capacity` und `descriptor` sind Auskünfte
   darüber, was dieser Pool ist, keine Zusagen auf Bedienung. Den
   `usedCount`-Setter zu sperren wäre eine Falle statt eines Fixes:
   `dispose()` schreibt selbst durch diesen Setter (`VOBufferPool.ts:96`,
   **nach** `#disposed = true`), ein Guard dort ließe `usedCount` auf seinem
   letzten Wert stehen. Der Gewinn wäre kosmetisch, der Preis eine
   Reihenfolgeabhängigkeit im `dispose()` selbst. `buffer` siehe Entscheidung 6.
6. **Der Guard sitzt am Pool, nicht am `VertexObjectBuffer`.** Der Buffer
   bleibt nach `dispose()` als Hülle stehen und wirft auf drei seiner
   öffentlichen Methoden denselben `TypeError`. Ihn dort zu schließen hieße,
   der Klasse einen Begriff von »verbraucht« zu geben, den sie nicht hat — sie
   besitzt ihren Lebenszyklus nicht, der Pool nimmt ihr die Arrays weg. Das ist
   ein eigener Entwurf und geht als Nebenbefund in die Queue. Am Pool zu
   guarden schließt außerdem den Weg, den der Befund nennt, und hält die
   Fehlermeldung bei der Klasse, die der Aufrufer in der Hand hält — so wie
   Paket 7 es getan hat.

Zwei Dinge, die dieses Paket ausdrücklich **nicht** anfasst, damit sie niemand
im Review neu aufmacht:

- **Kein Browser-Test kommt dazu.** Die Konvention verlangt einen, wo
  GPU-Buffer-Verhalten sich ändert. Hier ändert sich keines: es entsteht,
  wandert und stirbt kein einziges `THREE.BufferAttribute` anders, die vier
  Guards sind CPU-seitig und verweigern die Arbeit, statt sie anders zu tun.
  Das Verify fährt `test:browser` trotzdem, siehe oben.
- **`docs/resource-lifecycle.md` bleibt unberührt.** Die Regeln, nach denen
  hier entschieden wird, stehen dort bereits vollständig; `resize()` als zweites
  Beispiel neben `fromBuffersData()` unter Regel 3 wäre Wiederholung.

#### Vorgehen

1. **`VOBufferPool.ts` — `availableCount` (`:44-46`) antwortet `0` an einem
   entsorgten Pool.** Getter samt TSDoc:

   ```ts
   /**
    * How many vertex objects this pool can still hand out.
    *
    * `0` once {@link dispose} has run: a disposed pool has no slot left to give, and
    * {@link VertexObjectPool#createVO} answers `undefined` for every one of them.
    */
   get availableCount(): number {
     return this.#disposed ? 0 : this.capacity - this.#usedCount;
   }
   ```

2. **`VOBufferPool.ts` — `createFromAttributes()` (`:103-108`) wirft an einem
   entsorgten Pool.** Der Guard ist die erste Anweisung, der Fehler kommt aus
   dem `disposedError()`, das die Datei schon hat (`:7-9`). Die Methode trägt
   heute kein TSDoc; sie bekommt eines, weil Punkt 6 der Checkliste in
   Abschnitt 7 der Richtlinie es für jedes öffentliche Member verlangt:

   ```ts
   /**
    * Fills the next free slots of this pool from the given attribute arrays and answers how
    * many vertex objects were written and where the first of them sits. An attribute name the
    * descriptor does not know is skipped, and the copy stops at the capacity of the pool.
    *
    * Throws on a disposed pool, which has no slot to write into: an object count of `0` is
    * what a live pool answers when it is full or when it was handed nothing, so a caller
    * could not tell a spent pool from either of them.
    */
   createFromAttributes(attributes: Record<string, ArrayLike<number>>): [objectCount: number, firstObjectIndex: number] {
     if (this.#disposed) {
       throw disposedError('createFromAttributes()');
     }
     const firstObjectIndex = this.#usedCount;
     // … der Rest bleibt, wie er ist
   }
   ```

3. **`VOBufferPool.ts` — das TSDoc von `dispose()` (`:78-92`) nennt alle
   Reaktionen.** Der Satz »After `dispose()` the pool is **dead**: any further
   read/write operation on its vertex objects will fail, and {@link toBuffersData}
   and {@link fromBuffersData} throw.« wird zu:

   ```
    * the array reference. After `dispose()` the pool is **dead**: any further
    * read/write operation on its vertex objects will fail, {@link createFromAttributes},
    * {@link toBuffersData} and {@link fromBuffersData} throw, {@link availableCount} is `0`,
    * and on a {@link VertexObjectPool} `createVO()` answers `undefined` while `resize()`
    * throws. The method is idempotent.
   ```

   Der Rest des Blocks bleibt unverändert, die `NOTE:` am Ende eingeschlossen.

4. **`VertexObjectPool.ts` — ein eigenes `disposedError()`.** Direkt unter den
   Importen, dateilokal und nicht exportiert, in der Form, die `Display.ts:46`,
   `StageRenderer.ts:28` und `VOBufferPool.ts:7` bereits tragen:

   ```ts
   // one message for every method that refuses to work once the pool is gone, so the class, the
   // method and the state are always in the text a caller reads out of a foreign stack
   function disposedError(method: string): Error {
     return new Error(`VertexObjectPool#${method} is not available: this pool has been disposed`);
   }
   ```

   Es nennt `VertexObjectPool`, weil `resize()` dort deklariert ist und der
   Aufrufer diese Klasse in der Hand hält. Das vorhandene `disposedError()` in
   `VOBufferPool.ts` wird **nicht** angefasst, nicht exportiert und nicht
   parametrisiert: drei Module tragen diese Funktion heute je einmal, das ist
   das Muster des Repos.

5. **`VertexObjectPool.ts` — `createVO()` (`:101-109`) antwortet `undefined` an
   einem entsorgten Pool.** Guard als erste Anweisung, plus TSDoc, das die
   Methode heute nicht hat:

   ```ts
   /**
    * Takes the next free slot of this pool and answers the vertex object sitting in it.
    *
    * Answers `undefined` once `usedCount` has reached `capacity`, and on a disposed pool,
    * which has no slot to give: the declared type admits absence, and a caller has to
    * handle it either way. A refused slot is not counted — `usedCount` stays where it is.
    */
   createVO(): (VOType & VO) | undefined {
     if (this.isDisposed) return undefined;
     if (this.usedCount < this.capacity) {
       // … der Rest bleibt, wie er ist
   ```

6. **`VertexObjectPool.ts` — `resize()` (`:34-99`) wirft an einem entsorgten
   Pool.** Der Guard steht **vor** der Ganzzahl-Prüfung, also als erste
   Anweisung des Rumpfes:

   ```ts
   resize(capacity: number): void {
     if (this.isDisposed) {
       throw disposedError('resize()');
     }

     if (capacity < 0 || !Number.isInteger(capacity)) {
       // … der Rest bleibt, wie er ist
   ```

   Das vorhandene TSDoc (`:20-33`) bekommt einen Absatz vor dem Satz »If the new
   capacity is larger, …«:

   ```
    * Throws on a disposed pool, which has no buffers left to size. The method already turns
    * away a capacity it cannot serve, and a resize that allocated fresh buffers would put a
    * disposed pool back into service.
   ```

7. **Die vier Tests, rot zuerst.** Sie kommen in
   `VertexObjectPool.spec.ts` in den vorhandenen Block `describe('dispose()')`
   (ab `:710`), direkt hinter den Test
   `'VOBufferPool: toBuffersData() and fromBuffersData() refuse a disposed pool'`
   (`:834-850`) und **vor** die abschließende Zeile
   `// (e) has no subject here: neither pool creates a signal or an effect.`.
   Jeder Test wird rot gesehen, bevor die Schritte 1 bis 6 gebaut werden — der
   rote Lauf gehört in den Report. Die vier fallen heute je an ihrer ersten
   Zusicherung: Test 1 am Meldungsmuster (es kommt ein `TypeError` mit anderem
   Text), Test 2 an `toBe(0)` (es kommt `10`), Test 3 an `toBeUndefined()` (es
   kommt ein Objekt), Test 4 an `toThrow` (es wirft nichts).

   ```ts
   // (c) every public member behaves after dispose() as its TSDoc says
   test('VOBufferPool: createFromAttributes() refuses a disposed pool', () => {
     const pool = new VOBufferPool(descriptor, 10);

     pool.dispose();

     const create = () => pool.createFromAttributes({bar: [1, 1, 1, 1]});
     expect(create, 'the message names the class and the method').toThrow(/VOBufferPool#createFromAttributes\(\)/);
     expect(create, 'the message names the state').toThrow(/disposed/);
   });

   // (c) every public member behaves after dispose() as its TSDoc says
   test('VOBufferPool: availableCount is zero after dispose()', () => {
     const pool = new VOBufferPool(descriptor, 10);

     expect(pool.availableCount).toBe(10);

     pool.dispose();

     expect(pool.availableCount).toBe(0);
   });

   // (c) every public member behaves after dispose() as its TSDoc says
   test('VertexObjectPool: createVO() answers nothing after dispose() and hands out no slot', () => {
     const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

     pool.createVO();
     pool.dispose();

     expect(pool.createVO()).toBeUndefined();
     expect(pool.usedCount, 'a refused slot is not counted').toBe(0);
     expect(pool.availableCount).toBe(0);
     expect(pool.getVO(0), 'nothing landed in the index either').toBeUndefined();
   });

   // (c) every public member behaves after dispose() as its TSDoc says
   test('VertexObjectPool: resize() refuses a disposed pool and leaves it dead', () => {
     const pool = new VertexObjectPool<MyVertexObject>(descriptor, 10);

     pool.createVO();
     pool.dispose();

     const grow = () => pool.resize(20);
     expect(grow, 'the message names the class and the method').toThrow(/VertexObjectPool#resize\(\)/);
     expect(grow, 'the message names the state').toThrow(/disposed/);

     expect(pool.capacity, 'the capacity is untouched').toBe(10);
     expect(pool.buffer.buffers.size, 'no buffers were built for a dead pool').toBe(0);
     expect(pool.isDisposed).toBe(true);
   });
   ```

   `descriptor` ist die Variable aus dem `beforeEach` der Datei, `MyVertexObject`
   das dort deklarierte Interface, `VOBufferPool` und `VertexObjectPool` sind
   bereits importiert. Der Kommentar `// (f)` wird hier **nicht** gesetzt: diese
   Datei steht in der Liste von Paket 15, und das Urteil über Fall (f) fällt
   dort, damit es einmal und mit allen acht Dateien nebeneinander fällt.

8. **CHANGELOG.** Ein Eintrag unter `[Unreleased]` → `### Changed`, direkt hinter
   den vorhandenen Punkt zu `VOBufferPool#toBuffersData()` und
   `#fromBuffersData()`, in dessen Tonfall, nach dem Skill `updating-changelog`:

   > a disposed `VOBufferPool` hands out nothing and cannot be brought back into
   > service: `createFromAttributes()` and `VertexObjectPool#resize()` throw with a
   > message naming the class, the method and the state, `VertexObjectPool#createVO()`
   > answers `undefined` without counting the refused slot, and `availableCount` is
   > `0`. The object count of `createFromAttributes()` cannot tell a spent pool from a
   > full one, and a `resize()` that allocated fresh buffers would put a disposed pool
   > back to work — both refuse instead. `clear()`, `freeVO()` and `getVO()` go on
   > doing nothing, and `capacity`, `descriptor` and `usedCount` keep saying what this
   > pool is

   **Kein Abschnitt in der Migration Guide.** Nichts, was vorher funktioniert
   hat, verhält sich anders: die drei Wege waren an einem entsorgten Pool ein
   `TypeError`, ein unbrauchbares Objekt und eine unbeabsichtigte
   Wiederbelebung. Paket 7 hat für dieselbe Änderung an den zwei
   Geschwistermethoden ebenfalls nur einen `### Changed`-Punkt gesetzt.

#### Restplan

Offen sind nach diesem Paket nur noch Paket 15 und die zwei Einträge mit Urteil
`→ Scope`, die noch kein Paket haben. Der Schnitt bleibt, wie er steht; eine
Umsortierung gibt es nicht.

Paket 15 fasst dieselbe Datei an — `VertexObjectPool.spec.ts` steht in seiner
Liste der acht Spec-Dateien, die den `(f)`-Vermerk nachziehen. Die Grenze ist in
Schritt 7 gezogen: dieses Paket schreibt vier Tests in den `dispose()`-Block und
keinen `(f)`-Kommentar, Paket 15 schreibt den Vermerk und keinen Test. Für die
Erwartung, die unter Paket 15 steht, ändert sich nichts: `VertexObjectPool`
nimmt keinen Slot aus einem fremden Pool oder einer Factory, es **ist** der Pool
— »kein Gegenstand hier« bleibt das erwartete Urteil.

Zwei neue Nebenbefunde stehen unter »Offene Befunde«, beide mit Urteil
`→ Scope`, beide gemessen: die Hüllen-Methoden des `VertexObjectBuffer` hinter
`pool.buffer` und eine `VOBufferGeometry`, die über einem entsorgten Pool still
mit null Attributen zur Welt kommt. Keiner von beiden gehört in dieses Paket
(Entscheidung 6 und die andere Klasse), keiner ändert den Schnitt von Paket 15,
und ein Paket dafür schneidet die Drain-Runde des Abschlusses und nicht dieser
Zug.

#### Der Befund im Wortlaut

**`VOBufferPool#createFromAttributes()` nach `dispose()` · low · `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:103`**

`createFromAttributes()` hat nach `dispose()` kein definiertes Verhalten.
`dispose()` leert `buffer.buffers`, lässt `bufferAttributes` aber stehen, also
greift `VertexObjectBuffer#copyAttributes()` (`VertexObjectBuffer.ts:170-171`)
auf `undefined` zu. Gemessen: `TypeError: Cannot read properties of undefined
(reading 'typedArray')` — genau die Reaktion, die Abschnitt 4 der Richtlinie
ausschließt. Dritte öffentliche Methode derselben Klasse; Paket 7 hat über
`toBuffersData()` und `fromBuffersData()` entschieden und diese nicht.

Empfehlung: dieselbe Reaktion wie an den zwei Geschwistermethoden — ein Fehler,
der Klasse, Methode und Zustand nennt.

### [x] 15. Dispose-Test-Blöcke: den sechsten Fall nachziehen

- Folge von: Paket 11
- Ziel: Jeder Dispose-Test-Block im Repo sagt für den Fall `(f)` — jeder
  geliehene Slot geht zurück —, ob er einen Gegenstand hat, so wie er es für
  `(a)` bis `(e)` bereits tut.
- Bereich: die fünfzehn Dispose-Test-Blöcke ohne `(f)`-Vermerk — dreizehn in
  `packages/twopoint5d/src/`, zwei in `packages/twopoint5d-testing/test/`. Die
  Liste steht unter »Abgleich am Code«, und sie ist länger als die acht Dateien,
  die hier vorher standen; der Grund steht ebenda.
- Hängt ab von: 11
- Hash: ea89622
- Modell: mittlere Stufe
- Effort: low

Beides ist eine Abweichung von den Paketen 1 bis 14, die durchweg auf der
stärksten Stufe liefen, und beides hat denselben Grund: dieses Paket ändert
keine Zeile Produktivcode und keine Zusicherung. Es fügt fünfzehn Kommentare
ein, deren Inhalt unten wörtlich steht. Hoher Effort auf einer Transkription
erhöht nur die Neigung, nebenbei aufzuräumen — und hier läge das Aufräumen
besonders nahe, weil fünf der Blöcke gar keine Fallbuchstaben tragen. Genau das
darf nicht passieren: die fehlenden Buchstaben `(a)` bis `(e)` sind ein eigener
Eintrag in »Offene Befunde« und gehören der Drain-Runde, nicht diesem Paket.

**Für den Reviewer** ist die Diff-Größe der falsche Maßstab. Fünfzehn Kommentare
sind fünfzehn Tatsachenbehauptungen über den Quelltext — »diese Klasse leiht
keinen Slot« —, und jede einzelne ist am Code nachzuprüfen. Die mittlere Stufe
ist hier die Untergrenze, nicht die günstigste.

#### Abgleich am Code, Zug 0 (2026-09-06)

Maßgeblich ist ein Grep, damit Implementierer, Reviewer und Abschluss dieselbe
Menge meinen:

```
grep -rn "describe(['\"][^'\"]*dispose" packages/twopoint5d/src packages/twopoint5d-testing/test
```

Zwanzig Treffer, davon neunzehn Dispose-Test-Blöcke. Der zwanzigste,
`vertex-buffers-geometry-updates.spec.ts:1038` `describe('update() after
dispose()')`, ist keiner: er prüft das Verhalten von `update()` an einer
entsorgten Geometrie und ist kein Block über den Dispose-Vertrag einer Klasse.
Er bekommt **keinen** Vermerk.

Vier der neunzehn tragen den `(f)`-Vermerk bereits und sind hier nichts zu tun:
`map2d/Map2DTileRenderer.spec.ts:34` (Paket 11, mit Gegenstand und Test),
`stage/Canvas2DStage.spec.ts:54` (Paket 12), `controls/InputControlBase.spec.ts:50`
(Paket 13) und `packages/twopoint5d-testing/test/pan-control-dispose.test.js:35`
(Paket 13, in der Prosaform »Assertion (f) — …«, weshalb ein Grep nach `// (f)`
sie nicht findet).

Bleiben fünfzehn. Für jeden hat Zug 0 an der Fundstelle nachgesehen, ob die
Klasse einen Slot aus einem fremden Pool oder einer Factory hält:

| Block | Nimmt die Klasse einen fremden Slot? | Belegt an |
| --- | --- | --- |
| `display/FixedFrameLoop.spec.ts:149` | nein | `FixedFrameLoop.ts` nennt weder Pool noch Factory |
| `map2d/Map2D.spec.ts:29` | nein | `Map2D.ts` nennt weder Pool noch Factory; die Kacheln liegen eine Ebene tiefer, im `Map2DTileRenderer` |
| `map2d/TileSprites/TileSpritesMaterial.spec.ts:15` | nein | Material, hält nur die hereingereichte `colorMap` |
| `sprites/AnimatedSprites/AnimatedSprites.spec.ts:16` | nein | `AnimatedSprites.ts` hat keine Pool-API — kein `createSprite()`, kein `spritePool` |
| `sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts:41` | nein | Material, hält nur die hereingereichte `animsMap` |
| `sprites/TexturedSprites/TexturedSprites.spec.ts:79` | **nein, aber knapp** | `TexturedSprites.ts:63` ruft `instancedPool.createVO()` und gibt den Slot in derselben Zeile an den Aufrufer weiter; die Klasse führt über keinen Slot Buch. Zurückgegeben wird über `freeSprite()` (`:70`), und das ist der Aufruf des Aufrufers |
| `sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts:15` | nein | Material, hält nur die hereingereichte `colorMap` |
| `stage/StageRenderer.spec.ts:635` | nein | die Stages kommen über `add()` und bleiben dem Aufrufer (`StageRenderer.ts:591-592`), die `RenderTarget`s baut der Renderer selbst (`:530`) |
| `texture/TextureResource.spec.ts:113` | nein | `TextureFactory.create()` (`TextureFactory.ts:131`) baut eine neue `Texture` und führt über keine Buch; es gibt keinen Aufruf, der eine zurückgäbe. Die Textur ist eigen (`#ownTexture`) und fällt unter `(a)` |
| `texture/TextureStore.spec.ts:75` | nein | der Store baut seine `TextureResource`s selbst (`#resources`), und seine geteilte `TextureFactory` verleiht nichts |
| `vertex-objects/InstancedVertexObjectGeometry.spec.ts:127` | nein | die Klasse ruft nirgends `createVO()`; sie hält Pools, nicht Vertex-Objekte — einen eigenen gibt sie frei, einen hereingereichten nicht (`InstancedVertexObjectGeometry.ts:36-41`) |
| `vertex-objects/VertexObjectPool.spec.ts:710` | nein | der Block prüft `VOBufferPool` und `VertexObjectPool`; beide **sind** der Pool, aus dem andere nehmen |
| `vertex-objects/vertex-buffers-geometry-updates.spec.ts:668` | nein | derselbe Gegenstand wie Zeile 127 der Geschwisterdatei: `InstancedVertexObjectGeometry` |
| `twopoint5d-testing/test/display-dispose.test.js:30` | nein | `Display` nennt weder Pool noch Factory |
| `twopoint5d-testing/test/vertex-objects-dispose.test.js:46` | nein | keine Geometrie in diesen Tests nimmt ein Vertex-Objekt aus einem fremden Pool |

Alle fünfzehn Urteile lauten »kein Gegenstand«. Ein neuer Test entsteht in
diesem Paket also nicht, und das ist die Erwartung, die schon im Grobplan stand
— nur belegt statt vermutet.

Gegengeprüft wurde außerdem von der anderen Seite, über die Rückgabe-Aufrufe
statt über die Klassen: `grep -rn 'createVO\|freeVO\|createTile\|destroyTile'`
findet in `src/` genau vier Halter-Kandidaten. `Map2DTileRenderer` hält Kacheln
und hat seinen Test seit Paket 11. `TileSpritesFactory` (`:34`, `:64`) reicht
jede erzeugte Kachel sofort an den Renderer weiter und führt über keine Buch —
sie hat weder ein `dispose()` noch einen Dispose-Test-Block. `TexturedSprites`
steht in der Tabelle. Und die drei Sprite-Geometrien
(`TexturedSpritesGeometry.ts:52`, `AnimatedSpritesGeometry.ts:18`,
`TileSpritesGeometry.ts:18`) nehmen ihr Base-Sprite aus `basePool` — den bauen
alle drei aus einem Descriptor, sie besitzen ihn also, und keine der drei hat
einen Dispose-Test-Block.

#### Warum der Bereich von acht auf fünfzehn gewachsen ist

Der Grobplan nannte acht Dateien. Die Zahl stammt aus der `Folgen:`-Zeile von
Paket 11 — »neun Dateien mit Dispose-Test-Block, u. a. …« —, und sie war schon
damals falsch: derselbe Grep hätte am Commit `894f9b4` vierzehn Blöcke gefunden.
Gezählt wurden offenbar die neun, die dieser Lauf selbst beschriftet hat.

Das ist kein Scope-Wechsel, sondern die Korrektur einer Aufzählung an der
Zielzeile, die über ihr steht: »jeder Dispose-Test-Block im Repo«. Die
`Folgen:`-Zeile von Paket 11 zeigt in dieselbe Richtung — sie nennt als Bereich
`packages/twopoint5d/src/**/*.spec.ts` und schreibt »u. a.« vor ihre Beispiele.
Und die Grobplan-Notiz zu Paket 13 unten hat für den Browser-Test bereits
entschieden, dass Blöcke außerhalb von `src/` mitzählen, »damit die Zielzeile
beim Abschluss belegt ist«.

Die Gegenprobe: bliebe es bei acht, wäre die Zielzeile nach diesem Paket
unbewiesen, und die Drain-Runde müsste ein weiteres Paket für sieben
Kommentarzeilen schneiden — dieselbe Ursache ein zweites Mal halb behoben.

- Dateien: die fünfzehn Blöcke aus der Tabelle oben
- Vorgehen:

  1. **Die Form richtet sich nach der Datei, nicht nach dem Geschmack.** Zwei
     Formen sind im Repo in Gebrauch, und jede Datei bleibt bei der ihren:

     - **Kurzform** in jeder Datei, die schon `// (x) has no subject here: …`
       trägt: `FixedFrameLoop`, `Map2D`, `TileSpritesMaterial`,
       `AnimatedSprites`, `TexturedSpritesMaterial`, `StageRenderer`,
       `TextureResource`, `TextureStore`, `VertexObjectPool`.
     - **Prosaform** — »Assertion (f) of the dispose test pattern … — has no
       subject here: …« — in jeder Datei, die keinen einzigen Fallbuchstaben
       trägt, und in den Browser-Tests, wo sie ohnehin die Hausform ist:
       `AnimatedSpritesMaterial`, `TexturedSprites`,
       `InstancedVertexObjectGeometry`, `vertex-buffers-geometry-updates`,
       `display-dispose.test.js`, `vertex-objects-dispose.test.js`.

     Der Grund für die zweite Form: wo kein anderer Buchstabe steht, erklärt
     sich `(f)` nicht von selbst, und der Leser braucht den Zeiger auf das
     Muster.

  2. **Der Ort ist in den Spec-Dateien immer derselbe**: als letztes im
     `describe`-Block, unmittelbar vor dessen schließendem `});`. Wo der Block
     bereits mit einem `(e)`-Vermerk endet, steht `(f)` mit einer Leerzeile
     darunter — die Buchstabenfolge bleibt lesbar.
     In `display-dispose.test.js` gehört der Vermerk **nicht** ans Ende,
     sondern zu den anderen: hinter den `(e)`-Vermerk (Zeilen 61-62) und vor
     das erste `it(`. In `vertex-objects-dispose.test.js` steht er direkt vor
     dem ersten `it(` (Zeile 95).

  3. **Die Einrückung** folgt der Datei: vier Leerzeichen in allen
     `*.spec.ts` (der Block liegt in einem äußeren `describe`), zwei in den
     beiden Browser-Tests (der Block liegt oben).

  4. **Die fünfzehn Vermerke im Wortlaut.** Zeilenumbrüche dürfen der
     Prettier-Breite folgen, der Inhalt nicht.

     `packages/twopoint5d/src/display/FixedFrameLoop.spec.ts`:

     ```ts
     // (f) has no subject here: this loop borrows nothing — no pool hands it a slot and no
     // factory hands it a tile.
     ```

     `packages/twopoint5d/src/map2d/Map2D.spec.ts`:

     ```ts
     // (f) has no subject here: a Map2D takes no slot from a pool and no tile from a factory.
     // The tile renderers it holds arrive through addTileRenderer() and belong to the caller;
     // the tiles live one layer further down, in the renderers themselves.
     ```

     `packages/twopoint5d/src/map2d/TileSprites/TileSpritesMaterial.spec.ts`:

     ```ts
     // (f) has no subject here: this material takes no slot from a pool and no tile from a
     // factory. The colorMap it is handed is the only resource it ever touches.
     ```

     `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprites.spec.ts`:

     ```ts
     // (f) has no subject here: this mesh takes no slot from a pool. The sprite pool belongs
     // to the geometry it was handed, and this class never draws from it.
     ```

     `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts`:

     ```ts
     // Assertion (f) of the dispose test pattern in docs/resource-lifecycle.md — "gives every
     // slot it took back" — has no subject here: this material takes no slot from a pool and
     // no tile from a factory. The animsMap it holds arrives through the constructor or the
     // setter.
     ```

     `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`:

     ```ts
     // Assertion (f) of the dispose test pattern in docs/resource-lifecycle.md — "gives every
     // slot it took back" — has no subject here, although this is the class that looks like it
     // should: createSprite() takes a slot from the sprite pool and hands it straight to the
     // caller, keeping no record of it. Giving it back is freeSprite(), and that call is the
     // caller's to make. Where this mesh built the geometry itself, dispose() releases the
     // whole pool with it; where a geometry was handed in, the pool and every slot taken from
     // it stay the caller's.
     ```

     `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts`:

     ```ts
     // (f) has no subject here: this material takes no slot from a pool and no tile from a
     // factory. The colorMap it is handed is the only resource it ever touches.
     ```

     `packages/twopoint5d/src/stage/StageRenderer.spec.ts`:

     ```ts
     // (f) has no subject here: this renderer takes no slot from a pool and no tile from a
     // factory. The stages arrive through add() and stay the caller's; the render targets are
     // its own, and case (a) covers them.
     ```

     `packages/twopoint5d/src/texture/TextureResource.spec.ts`:

     ```ts
     // (f) has no subject here: TextureFactory#create() builds a new Texture and keeps no
     // record of it — there is no call that would give one back. The texture a resource
     // materializes is its own, and case (a) covers its release.
     ```

     `packages/twopoint5d/src/texture/TextureStore.spec.ts`:

     ```ts
     // (f) has no subject here: the store takes no slot from a pool and no tile from a
     // factory. The resources it keeps are its own, and its shared TextureFactory builds
     // textures rather than lending them — nothing it hands out is ever given back.
     ```

     `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`:

     ```ts
     // Assertion (f) of the dispose test pattern in docs/resource-lifecycle.md — "gives every
     // slot it took back" — has no subject here: this geometry never calls createVO(). It
     // holds pools, not vertex objects: a pool it built itself is released, and one handed in
     // stays the caller's together with every slot the caller took from it.
     ```

     `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`:

     ```ts
     // (f) has no subject here: both classes under test are the pool others take slots from,
     // not a holder that borrows one.
     ```

     `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`:

     ```ts
     // Assertion (f) of the dispose test pattern in docs/resource-lifecycle.md — "gives every
     // slot it took back" — has no subject here: an InstancedVertexObjectGeometry never calls
     // createVO(). The slots elsewhere in this file are three.js attribute slots, which a
     // route claims on the geometry, not slots lent out by a pool.
     ```

     `packages/twopoint5d-testing/test/display-dispose.test.js`:

     ```js
     // Assertion (f) — "gives every slot it took back" — has no subject: a Display takes no
     // slot from a pool and no tile from a factory.
     ```

     `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js`:

     ```js
     // Assertion (f) of the dispose test pattern in
     // packages/twopoint5d/docs/resource-lifecycle.md — "gives every slot it took back" — has
     // no subject here: no geometry in these tests takes a vertex object from a foreign pool.
     // The slots the cases below speak of are three.js attribute slots, which a route claims
     // on the geometry, not slots lent out by a pool.
     ```

  5. **Was in diesem Paket nicht passiert**, ausdrücklich, weil jede der vier
     Versuchungen naheliegt:

     - Kein Test wird geschrieben, verschoben, umbenannt oder in seinen
       Assertionen verändert. Fünfzehn Kommentare, sonst nichts.
     - `docs/resource-lifecycle.md` wird nicht angefasst. Abschnitt 8 trägt
       den Fall `(f)` seit Paket 11 samt Skelett und Schlussabsatz.
     - Kein CHANGELOG-Eintrag. Nichts an der ausgelieferten Bibliothek ändert
       sich; die `[Unreleased]`-Sektion beschreibt Verhalten, keine
       Testkommentare.
     - Kein Regressionstest und kein roter Lauf davor. Dieses Paket behebt
       keinen Korrektheitsfehler — die Konvention »Bugfix heißt Test zuerst«
       greift hier nicht, und ihr Fehlen ist kein Befund.
     - Die Fälle `(a)` bis `(e)` bleiben in den fünf unbeschrifteten Blöcken
       unbeantwortet. Sie stehen als eigener Eintrag in »Offene Befunde« und
       gehören der Drain-Runde des Abschlusses, die alle Befunde nebeneinander
       sieht.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `test:browser` gehört dazu, weil zwei der geänderten Dateien Browser-Tests
  sind; der Nx-Cache für dieses Target fällt damit, und der Lauf findet
  wirklich statt.
- Commit: `test(twopoint5d): say for every dispose test block whether a borrowed slot exists`
- Ergebnis: 1 Runde · Ziel erreicht — alle fünfzehn Dispose-Test-Blöcke ohne
  `(f)`-Vermerk haben ihn jetzt, je mit dem Urteil »kein Gegenstand« und dessen
  Begründung; zusammen mit den vier bereits beschrifteten Blöcken sagt damit
  jeder der neunzehn Dispose-Test-Blöcke im Repo, ob er einen geliehenen Slot
  zurückzugeben hat · Review ohne Befund, kein Produktivcode berührt, 63 Zeilen
  Kommentar in 15 Dateien
- Nebenbefunde: → Queue (bereits in »Offene Befunde«, aus Zug 0)
- Folgen: keine

#### Was frühere Pakete zu diesem Paket festgehalten haben

Diese Notizen standen im Grobplan und bleiben stehen; Zug 0 hat jede an der
Fundstelle bestätigt.

Die neunte Datei mit einem Dispose-Test-Block heißt
`src/stage/Canvas2DStage.spec.ts` und entsteht in Paket 12; sie bringt ihren
`(f)`-Vermerk von Geburt an mit und ist hier nichts zu tun (2026-09-06, Zug 0
von Paket 12). `src/stage/StageRenderer.spec.ts` bleibt im Bereich, obwohl
Paket 12 denselben Block anfasst: dort ändern sich Assertionen, nicht das Urteil
über Fall `(f)`.

Zwei weitere Dateien tragen ihren `(f)`-Vermerk aus Paket 13 und sind hier
ebenfalls nichts zu tun (2026-09-06, Zug 0 von Paket 13):
`src/controls/InputControlBase.spec.ts` entsteht dort und bringt ihn von
Geburt an mit, und `packages/twopoint5d-testing/test/pan-control-dispose.test.js`
bekommt ihn dort dazu — Paket 13 schreibt den Kommentarblock am Kopf jenes
`describe` ohnehin um, und `PanControl2D` nimmt nachweislich keinen Slot aus
einem Pool oder einer Factory (`#pointersDown` hält eigene Objekte). Die Datei
ist ein Browser-Test und stand in der Liste des Grobplans nie; sie steht hier,
damit die Zielzeile »jeder Dispose-Test-Block im Repo« beim Abschluss belegt ist
und niemand sie ein zweites Mal aufmacht.

`src/vertex-objects/VertexObjectPool.spec.ts` bleibt im Bereich, obwohl Paket 14
denselben `describe('dispose()')`-Block anfasst: dort kommen vier Tests zum
Vertrag eines entsorgten Pools hinein, das Urteil über Fall `(f)` fällt hier.
Die Erwartung ist unverändert »kein Gegenstand hier« — `VertexObjectPool` nimmt
keinen Slot aus einem fremden Pool und keine Kachel aus einer Factory, es **ist**
der Pool, aus dem andere nehmen (2026-09-06, Zug 0 von Paket 14).

### [x] 16. Übergabe ins Leere und Freigabe in falscher Reihenfolge

- Nebenbefund: aus Paket 11 und 12 (zwei Einträge der Queue, beide medium:
  `HelpersManager.add()` verwirft den übergebenen Knoten stumm, wenn weder
  `#scene` noch `root` gesetzt ist; `Canvas2DStage.makeTexture()` entsorgt die
  alte Textur, bevor die neue gebaut und gesetzt ist)
- Ziel: Ein an `HelpersManager` übergebener Knoten wird gehalten oder mit
  klarer Meldung abgelehnt, nie verloren; `Canvas2DStage` gibt die alte Textur
  erst frei, wenn die neue am Material hängt, wie die Entscheidung für
  `texture/` es vorgibt.
- Bereich: `packages/twopoint5d/src/map2d/HelpersManager.ts`,
  `CameraBasedVisibilityHelpers.ts`, `RectangularVisibilityAreaHelpers.ts`,
  `packages/twopoint5d/src/stage/Canvas2DStage.ts` und Specs. Die beiden
  Helfer-Klassen stehen nicht im Grobplan und kommen hier dazu: sie sind die
  einzigen zwei Aufrufer von `HelpersManager.add()` im Repo, und ohne sie kippt
  dieses Paket ihr Verhalten. Begründung unter Entscheidung 2.
- Hängt ab von: 11, 12
- Hash: c4806ff
- Modell: mittlere Stufe
- Effort: medium

Das Modell steht eine Stufe unter der stärksten, auf der die Pakete 1 bis 14
liefen, der Effort auf dem Vorgabewert. Grund für beides: die Produktivänderung
dieses Pakets sind vier Stellen mit zusammen einem Wurf, zwei Wächtern und einer
umgestellten Reihenfolge, und alle vier stehen unten im Wortlaut. Was Urteil
verlangt hat — ablehnen statt halten, und wo die Wächter sitzen —, ist in Zug 0
entschieden und steht als Entscheidung 1 bis 3 dort.

Tiefer geht keiner der beiden. Vier Tests sind zu schreiben, und drei davon sind
kein Abtippen: der Reihenfolge-Test misst einen Zustand **während** eines
`dispose()`-Aufrufs, und die zwei Wächter-Tests sind nur an genau der Stelle rot,
an der dieser Plan sie einsetzt. Wer dort danebengreift, schreibt drei Tests, die
auch vor dem Fix grün sind.

- Dateien: `packages/twopoint5d/src/map2d/HelpersManager.ts` ·
  `packages/twopoint5d/src/map2d/HelpersManager.spec.ts` (neu) ·
  `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts` ·
  `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts` ·
  `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts` ·
  `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.spec.ts` (neu) ·
  `packages/twopoint5d/src/stage/Canvas2DStage.ts` ·
  `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts` ·
  `packages/twopoint5d/CHANGELOG.md`. Neun Dateien, keine zehnte.

  Keine Änderung an `map2d/public-api.ts` und an `stage/public-api.ts`:
  `HelpersManager` wird von keiner `public-api.ts` exportiert und bleibt
  paketintern; die beiden Helfer-Klassen und `Canvas2DStage` sind bereits
  exportiert und bekommen kein neues Member.

  Keine Änderung an `docs/resource-lifecycle.md`. Abschnitt 2 trägt die Regel
  bereits (»Who hands a resource in, disposes it«, und der Absatz zum Geliehenen
  darunter); was dieses Paket ändert, ist nicht die Regel, sondern dass
  `HelpersManager` sie einhält. Wo der Vertrag steht, hat Paket 11 entschieden:
  im TSDoc an `add()`.

#### Abgleich am Code, Zug 0 (2026-09-06)

| Eintrag | Fundstelle heute | Befund |
| --- | --- | --- |
| `HelpersManager.add()` verwirft den Knoten stumm | `map2d/HelpersManager.ts:39-46` | unverändert, gelesen: `const target = addToRoot ? this.root : this.#scene;` und darum ein `if (target)`, dessen Else-Zweig nicht existiert. Zeilennummern stimmen |
| `Canvas2DStage.makeTexture()` gibt zu früh frei | `stage/Canvas2DStage.ts:118-128` | unverändert, gelesen: `this.texture.dispose()` steht in Zeile 120, `this.texture = this.#textureFactory.create(this.canvas)` in Zeile 125, und der Aufrufer `updateTexture()` setzt `sprite.material.map` erst in Zeile 132. Der Eintrag nennt `:118-121`, die Methode reicht bis `:128` |

Nachgesehen und dazugehörig:

- **Wann `target` leer ist.** `get root()` ruft `findRootNode(this.#scene)`, und
  `findRootNode` steigt über `parent` auf und gibt immer einen Knoten zurück
  (`utils/findRootNode.ts:3`). `root` ist also genau dann `undefined`, wenn
  `#scene` es ist. Der Wurf braucht deshalb keine zwei Fälle zu unterscheiden.
- **Wer `add()` ruft.** Genau zwei Klassen, beide in `map2d/`:
  `CameraBasedVisibilityHelpers` (`:87`, `:141`, `:150`, alle aus
  `createHelpers()` heraus) und `RectangularVisibilityAreaHelpers` (`:57`, aus
  `update()` heraus). Beide erreichen `add()`, ohne dass ein `add(scene)` von
  außen gekommen sein muss — `show = true` genügt bei der einen, ein blanker
  `update()` bei der anderen.
- **Was der ungeschützte Wurf kosten würde.** Beide Aufrufer bauen den Knoten in
  der Zeile vor dem `add()` (`new PlaneHelper(…)`, `new PointHelper(…)`,
  `new Box3Helper(…)`). Ein Wurf mitten in `createHelpers()` ließe die bis dahin
  gebauten Knoten ohne Halter zurück — dasselbe Leck, nur lauter. Deshalb hängen
  Wurf und Wächter zusammen und sind nicht zwei Dinge.
- **Wer heute in der Falle sitzt.** `RectangularVisibilityAreaHelpers.update()`
  ist der ernste Fall: die Lookbook-Demos rufen ihn je gerendertem Bild
  (`apps/lookbook/src/demos/map2d-rect-visi.ts:111`). Ohne Szene ist das ein
  `Box3Helper` samt Geometry je Frame, den niemand mehr erreicht.
  `CameraBasedVisibilityHelpers` verliert je Flankenwechsel von `show` fünf
  Knoten, nicht je Frame.
- **Was der Wurf nach außen ändert.** Nichts, solange die Wächter stehen:
  `HelpersManager` verlässt das Paket nicht, und die beiden öffentlichen
  Helfer-Klassen rufen `add()` danach nur noch mit einer Szene. Für einen
  Aufrufer ändert sich, dass `show = true` ohne vorheriges `add(scene)` keine
  Knoten mehr baut, statt fünf zu bauen und wegzuwerfen; sichtbar werden sie wie
  bisher beim ersten `update()` nach dem `add(scene)`.
- **Der zweite Befund hat keinen Frame, aber ein Fenster.** `makeTexture()` und
  die Zuweisung an `sprite.material.map` laufen synchron im selben `render()`;
  es gibt keinen Lückenframe. Was es gibt, ist ein Fenster über
  `TextureFactory.create()` und `update()` hinweg, in dem `sprite.material.map`
  und `Canvas2DStage#texture` beide auf eine bereits freigegebene Textur zeigen.
  Die Entscheidung vom 2026-09-05 verbietet genau diesen Zustand, und der
  CHANGELOG-Eintrag zu `TextureResource` sagt ihn für `texture/` bereits zu.
- **Die zweite Textur des Konstruktors bleibt außen vor.**
  `#placeholderTexture` (`:52`, `:108`) hängt bis zum ersten `updateTexture()`
  an `sprite.material.map` und danach nur noch an diesem Feld; freigegeben wird
  sie in `dispose()`. Beim ersten `updateTexture()` ist `this.texture` noch
  `undefined`, es gibt also keinen Vorgänger freizugeben — das bleibt so. Die
  drei vorhandenen Tests in `Canvas2DStage.spec.ts`, die
  `placeholderDispose.calledOnce` prüfen, gelten unverändert.

#### Entscheidungen dieses Pakets, Zug 0

1. **`HelpersManager.add()` lehnt ab, es hält nicht.** Das Ziel des Grobplans
   lässt beides zu; gewählt ist die Ablehnung mit klarer Meldung. Halten hieße
   eine Warteliste im Manager, die geleert wird, sobald eine Szene kommt — und
   damit genau die Bauform, gegen die die Scope-Regel dieses Laufs geschrieben
   ist: eine Liste, die je `update()` ohne Szene wächst und einen zweiten
   Freigabepfad in `remove()` braucht, damit sie es nicht tut. Dazu käme ein
   Verhalten, das für eine Debug-Anzeige falsch ist: Helfer, die drei Frames alt
   sind, würden nachträglich in eine Szene gespült. Die Ablehnung kostet drei
   Zeilen und ist die Form, die dieser Lauf schon dreimal gewählt hat: die
   Entscheidung zu den kollidierenden Attributnamen im Kopf des Plans nennt sie
   beim Namen — »aus einem stillen GPU-Leak wird ein Fehler an der
   Aufrufstelle« —, und `Display#canvas` und `StageRenderer#asPassNode()`
   sprechen dieselbe Sprache.
2. **Die beiden Aufrufer bekommen einen Wächter, und der gehört zu diesem
   Paket.** Nicht als Beifang: der Wurf aus Entscheidung 1 wirft genau die zwei
   Aufrufstellen um, die es heute gibt, und was die eigene Änderung umwirft,
   zieht sie mit. Ohne die Wächter tauscht dieses Paket ein stilles Leck gegen
   eine Ausnahme im Render-Loop einer Lookbook-Demo. Mit ihnen wird nichts mehr
   gebaut, was nirgends hin kann, und der Wurf ist das, was er sein soll: der
   Vertrag einer paketinternen Klasse, an dem im Repo niemand mehr anstößt.
3. **Der Wächter für `CameraBasedVisibilityHelpers` sitzt in
   `createHelpers()`, nicht an den drei `add()`-Aufrufen und nicht in den zwei
   Aufrufern von `createHelpers()`.** Eine Stelle statt fünf, und sie deckt
   jeden künftigen Weg in die Methode mit ab. Für
   `RectangularVisibilityAreaHelpers` gibt es nur eine Stelle, dort steht er am
   `if` um den `Box3Helper`.
4. **Die Freigabe der Vorgänger-Textur wandert nach `updateTexture()`.**
   `makeTexture()` behält seinen Namen und tut ab jetzt, was er sagt: eine
   Textur bauen. Freigeben kann nur die Stelle, die weiß, wann die neue am
   Material hängt, und das ist `updateTexture()`. Der Gegenweg — beides in
   `makeTexture()` zusammenziehen und `updateTexture()` auflösen — spart nichts
   und nimmt der Klasse eine benannte Methode.
5. **`test:browser` läuft mit, obwohl kein Browser-Test diese drei Klassen
   berührt.** Nachgesehen: `packages/twopoint5d-testing/test/` nennt weder
   `Canvas2DStage` noch `HelpersManager` noch eine der Helfer-Klassen. Der Lauf
   ist hier eine Regressionsprobe auf den geteilten Stage-Pfad, keine gezielte,
   und er steht in der Baseline im Kopf des Plans. Ein neuer Browser-Test
   entsteht nicht: keine der vier Änderungen fasst GPU-Buffer an.

#### Nachgesehen und bewusst nicht geändert

- **`CameraBasedVisibilityHelpers.add(scene)` baut die Helfer nicht nach.** Wer
  `show = true` vor `add(scene)` setzt, sieht die Helfer erst beim nächsten
  `update()`. Das ist das heutige Verhalten, minus des Lecks; ein Nachbauen im
  `add()` wäre eine neue Zusage und steht in keinem Eintrag.
- **`HelpersManager` bekommt kein `dispose()`.** Beschlossen unter Paket 6,
  Entscheidung 6, und unter Paket 7 wiederholt: seine Aufräumung heißt
  `remove()`. Daraus folgt, dass `HelpersManager.spec.ts` und
  `RectangularVisibilityAreaHelpers.spec.ts` **keinen** `describe('dispose()')`
  tragen und damit auch keine Fallbuchstaben `(a)` bis `(f)` brauchen. Paket 18
  wächst durch dieses Paket nicht.
- **Der `document.querySelector('.map2dCoords')`-Block** in `createHelpers()`
  (`:78-83`) wird vom Wächter aus Entscheidung 3 mit übersprungen, solange keine
  Szene da ist. Das ist richtig so — ohne Helfer keine Koordinatenanzeige — und
  der Block selbst bleibt unangetastet; er hat einen eigenen Eintrag in »Offene
  Befunde« mit dem Urteil `→ Audit`.
- **`HelpersManager.remove()` ohne Szene** ist ein No-op und bleibt einer. Dort
  geht nichts verloren: es gibt nichts zu entfernen.
- **`RectangularVisibilityAreaHelpers.update()` berechnet `#viewRect` weiter**,
  auch ohne Szene. Das ist Zustand der Klasse, kein Knoten, und billig.
- **Aus »Offene Befunde« kommt nichts dazu.** Acht der offenen Einträge liegen
  in Dateien, die dieses Paket anfasst oder streift — vier an
  `CameraBasedVisibilityHelpers.ts` (`:9-20`, `:58`, `:58-62`, `:149-154`), drei
  an `StageRenderer`, einer an `Canvas2DStage.ts:102` und `:153`. Alle acht
  haben eine andere Ursache als dieses Paket. Nachgezählt: alle 32 offenen
  Einträge tragen `→ Audit`, keiner `→ Scope` und keiner `→ Rückfrage`. Es gibt
  hier also nichts aufzunehmen, und die Queue ist beim Abschluss vollständig ein
  Fall für die Rückgabe ins Audit.

#### Restplan, geprüft in Zug 0

Unverändert. Paket 17 arbeitet in `vertex-objects/` und teilt mit diesem Paket
keine Datei und keine Ursache. Paket 18 beschriftet Fallbuchstaben in fünf
Spec-Dateien, von denen dieses Paket keine anfasst; und die beiden Specs, die
hier neu entstehen, tragen keinen `describe('dispose()')` — sie vergrößern
Paket 18 also nicht. Die Reihenfolge 16 → 17 → 18 bleibt, jedes »Hängt ab von«
ist gewahrt, kein Paket wird geteilt oder zusammengelegt, und es entsteht keins.

#### Vorgehen

Die Reihenfolge ist Absicht, und sie ist paarweise statt blockweise: Test,
Änderung, Test, Änderung. Der Grund ist der Wurf aus Schritt 2 — er ist es, der
die beiden Wächter-Tests rot macht, und vor ihm wären sie grün geschrieben und
bewiesen nichts. Jeder der vier Tests wird deshalb an der Stelle geschrieben, an
der er rot ist, und **jeder rote Lauf gehört in den Report**: vier Tests, vier
rote Läufe, mit Kommando und Ausgabe.

1. **`packages/twopoint5d/src/map2d/HelpersManager.spec.ts` anlegen.** Neue
   Datei, Vitest, kein `sinon` nötig. Importe:
   `import {Object3D} from 'three/webgpu';`,
   `import {describe, expect, test} from 'vitest';`,
   `import {HelpersManager} from './HelpersManager.js';`. Drei Tests in einem
   `describe('HelpersManager', …)`:

   - `test('adds a node to the scene and marks it as its own', …)` — `scene`
     setzen, `add(node)`, dann `expect(scene.children).toContain(node)`,
     `expect(node.userData['isHelper']).toBe(true)` und
     `expect(node.userData['createdBy']).toBe(manager.uuid)`.
   - `test('adds to the root of the scene graph when asked to', …)` — ein
     `root`, darin ein `scene` (`root.add(scene)`), `manager.scene = scene`,
     dann `add(node, true)`; erwartet wird `root.children` enthält `node` und
     `scene.children` enthält ihn nicht.
   - `test('refuses a node instead of dropping it when no scene is set', …)` —
     frischer Manager ohne Szene:

     ```ts
     const manager = new HelpersManager();
     const node = new Object3D();

     expect(() => manager.add(node)).toThrow(/HelpersManager#add\(\)/);

     expect(node.parent, 'the node is still the callers').toBe(null);
     expect(node.userData['isHelper'], 'and it was not marked either').toBeUndefined();
     ```

     Dieser Test ist der rote: heute kehrt `add()` still zurück.

2. **`HelpersManager.ts` — den Wurf einsetzen.** Der Rumpf von `add()` wird zu:

   ```ts
   add(node: Object3D, addToRoot = false): void {
     const target = addToRoot ? this.root : this.#scene;

     if (target == null) {
       throw new Error('HelpersManager#add() has no scene to add to: set HelpersManager#scene before handing a node over');
     }

     node.userData['isHelper'] = true;
     node.userData['createdBy'] = this.uuid;
     target.add(node);
   }
   ```

   Die Meldungszeile bleibt eine Zeile — `printWidth` ist 130, sie passt. Der
   Wortlaut ist verbindlich: der Test aus Schritt 1 prüft auf
   `HelpersManager#add()`, und wer die Meldung ändert, ändert sie an beiden
   Stellen.

   Dazu ein dritter Absatz an das vorhandene TSDoc der Methode, unter die zwei
   bestehenden:

   ```
    * A manager without a {@link scene} has nowhere to put the node and no way to take it down
    * again, so it refuses the handover with an error instead of accepting a node it would drop.
    * Whoever builds nodes for a manager that may not have one asks {@link scene} first.
   ```

3. **`CameraBasedVisibilityHelpers.spec.ts` erweitern.** Ein dritter Test im
   vorhandenen `describe`, nach den beiden bestehenden. Der `beforeEach`, der
   `document` stubbt, gilt weiter und wird nicht angefasst:

   ```ts
   test('builds no helper while no scene has been handed over', () => {
     const helpers = new CameraBasedVisibilityHelpers(makeVisibility());

     expect(() => {
       helpers.show = true;
       helpers.update();
     }, 'a helper set with nowhere to go is not built').not.toThrow();

     const scene = new Object3D();
     helpers.add(scene);
     helpers.update();

     expect(scene.children, 'and the scene gets the full set once it is there').toHaveLength(5);
   });
   ```

   `Object3D` steht bereits im Import der Datei. Nach Schritt 2 ist dieser Test
   rot: `show = true` läuft ohne Szene in den Wurf aus `add()`.

4. **`CameraBasedVisibilityHelpers.ts` — der Wächter.** Erste Zeile von
   `createHelpers()`, vor `this.createPlaneHelpers()`:

   ```ts
   // the manager refuses a node it cannot place, so nothing is built until there is a scene to
   // build it into — the first update() after add(scene) puts the whole set in
   if (this.#helpers.scene == null) return;
   ```

   Sonst nichts in dieser Datei. Die drei `add()`-Aufrufe, der `show`-Setter und
   `update()` bleiben, wie sie sind. Der Test aus Schritt 3 wird damit grün.

5. **`RectangularVisibilityAreaHelpers.spec.ts` anlegen.** Neue Datei. Die
   Klasse liest von ihrer `visibilityArea` nur `width` und `height`, ein Objekt
   mit diesen beiden Feldern genügt und bekommt einen Kommentar, der das sagt —
   dasselbe Muster wie `makeVisibility()` in
   `CameraBasedVisibilityHelpers.spec.ts`:

   ```ts
   import {Object3D} from 'three/webgpu';
   import {describe, expect, test} from 'vitest';

   import type {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
   import {RectangularVisibilityAreaHelpers} from './RectangularVisibilityAreaHelpers.js';

   // update() reads the width and the height of the area and nothing else
   function makeArea(): RectangularVisibilityArea {
     return {width: 640, height: 480} as unknown as RectangularVisibilityArea;
   }
   ```

   Ein Test in einem `describe('RectangularVisibilityAreaHelpers', …)`:

   ```ts
   test('builds no helper while no scene has been handed over', () => {
     const helpers = new RectangularVisibilityAreaHelpers(makeArea());

     expect(() => {
       helpers.show = true;
       helpers.update();
     }, 'a helper with nowhere to go is not built').not.toThrow();

     const scene = new Object3D();
     helpers.add(scene);
     helpers.update();

     expect(scene.children, 'and the scene gets its helper once it is there').toHaveLength(1);
   });
   ```

   Nach Schritt 2 rot, aus demselben Grund wie Schritt 3.

6. **`RectangularVisibilityAreaHelpers.ts` — der Wächter.** In `update()` wird
   die Bedingung um den `Box3Helper` erweitert, und der Grund steht daneben:

   ```ts
   // the manager refuses a node it cannot place: no scene, no helper
   if (this.#viewRect && this.#helpers.scene != null) {
     const helper = new Box3Helper(this.#viewRect, this.viewRectHelperColor);
     this.#helpers.add(helper);
   }
   ```

   Die Berechnung von `#viewRect` und das `this.#helpers.remove()` darüber
   bleiben unberührt. Der Test aus Schritt 5 wird damit grün.

7. **`Canvas2DStage.spec.ts` erweitern.** Ein Test, und er gehört **nicht** in
   den `describe('dispose()')`-Block, sondern als Geschwister des
   `sends a dispose event`-Tests darüber — er handelt vom laufenden Betrieb, und
   die Fallbuchstaben `(a)` bis `(f)` des Dispose-Blocks gelten ihm nicht:

   ```ts
   test('puts the new texture in place before it releases the one it replaces', () => {
     const stage = makeStage();

     stage.needsUpdate = true;
     stage.render();

     const first = stage.texture!;
     let mapAtRelease: unknown;
     let fieldAtRelease: unknown;

     // calls through: the question is when the release happens, not whether it happens
     const releaseFirst = first.dispose.bind(first);
     sandbox.stub(first, 'dispose').callsFake(() => {
       mapAtRelease = stage.sprite.material.map;
       fieldAtRelease = stage.texture;
       releaseFirst();
     });

     stage.needsUpdate = true;
     stage.render();

     expect(stage.texture, 'the factory built a second texture').not.toBe(first);
     expect(mapAtRelease, 'the material had already moved on').toBe(stage.texture);
     expect(fieldAtRelease, 'and so had the field').toBe(stage.texture);
   });
   ```

   Heute rot: beim `dispose()` steht `sprite.material.map` noch auf `first`, und
   `stage.texture` ebenso.

8. **`Canvas2DStage.ts` — die Reihenfolge umstellen.** `makeTexture()` gibt
   nichts mehr frei:

   ```ts
   private makeTexture(): Texture {
     this.#textureFactory ||= new TextureFactory(this.renderer, ['nearest', 'flipy', 'srgb']);

     this.texture = this.#textureFactory.create(this.canvas);

     return this.texture;
   }
   ```

   `updateTexture()` tut es, nachdem das Material auf die neue zeigt:

   ```ts
   private updateTexture() {
     if (this.needsUpdate) {
       const previous = this.texture;

       this.sprite.material.map = this.makeTexture();
       this.sprite.material.needsUpdate = true;
       this.needsUpdate = false;

       // the material points at the successor before the predecessor falls: nothing ever reads
       // a texture that is already released
       previous?.dispose();
     }
   }
   ```

   Dazu das TSDoc am Feld `texture` (`:54-58`) auf die Zusage bringen, die diese
   Reihenfolge gibt — geändert wird der Halbsatz zur Freigabe, der Rest bleibt:

   ```
    * The texture the canvas content is drawn from. The stage owns whatever sits in this field:
    * `render()` releases it once its successor sits on the sprite material, and so does
    * {@link dispose}.
   ```

9. **`CHANGELOG.md` — zwei Einträge unter `[Unreleased]` › `### Fixed`**, ans
   Ende der Liste, in der Form der vorhandenen Einträge:

   - »fix the helper nodes `CameraBasedVisibilityHelpers` and
     `RectangularVisibilityAreaHelpers` build before a scene has been handed to
     them: switching the helpers on, or updating them, builds nothing while
     there is no scene to put the nodes into, so a set of `Box3Helper`s,
     `PlaneHelper`s and point helpers that no scene shows and nothing releases
     again is never created. The first `update()` after `add(scene)` puts the
     whole set in«
   - »fix the moment `Canvas2DStage` releases the texture it replaces: the
     successor sits on the sprite material before the predecessor falls, so
     neither the material nor a read of `Canvas2DStage#texture` ever reaches a
     texture that is already disposed«

   Kein Eintrag unter `### Added`, `### Changed` oder `### Migration Guide`:
   kein Member kommt hinzu, keine Signatur ändert sich, und für einen Aufrufer,
   der `add(scene)` vor `show` setzt — so wie beide Lookbook-Demos —, ändert
   sich nichts. Keine Finding-Nummern, in keiner Zeile.

   Zur Form: »instead of«/»so … never« beschreibt hier den Unterschied, den ein
   CHANGELOG zu beschreiben hat; die Regel gegen den Rückblick auf den
   Vorzustand aus »Konventionen« gilt dem Quelltext, den Kommentaren und
   `docs/`. Das Muster steht im selben Abschnitt bereits mehrfach, zuletzt im
   Eintrag zu `TextureResource`.

10. **Verify fahren, den Diff lesen, committen.** Kein `git add -A`.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `typecheck` deckt die beiden neuen Specs mit ab, was `pnpm build` nicht tut
  (`*.spec.ts` bleibt draußen); `test:browser` ist die Regressionsprobe auf den
  geteilten Stage-Pfad, Begründung unter Entscheidung 5.
- Commit: `fix(twopoint5d): build no helper without a scene, release the canvas texture last`
- Ergebnis: 1 Runde · beide Einträge behoben — `HelpersManager#add()` wirft,
  statt einen Knoten fallen zu lassen (`HelpersManager.ts:46-48`), und
  `Canvas2DStage#updateTexture()` gibt die Vorgängerin erst frei, wenn die
  Nachfolgerin am Sprite-Material hängt (`Canvas2DStage.ts:127-137`) ·
  Regressionstests `refuses a node instead of dropping it when no scene is set`,
  zweimal `builds no helper while no scene has been handed over` und
  `puts the new texture in place before it releases the one it replaces`, alle
  vier vor dem Fix rot gesehen · Reviewer ohne Befund
- Nebenbefunde: keine neuen — Implementierer und Reviewer nennen nur Einträge,
  die bereits mit dem Urteil `→ Audit` in »Offene Befunde« stehen
- Folgen: keine · beide Lookbook-Demos rufen `add(scene)` vor `show` und
  `update()` und laufen nicht in den neuen Wurf
- Schnittstellen: `HelpersManager#add(node, addToRoot?)` wirft einen `Error`,
  wenn `HelpersManager#scene` nicht gesetzt ist, statt still zurückzukehren —
  wer Knoten für einen Manager baut, der noch keine Szene hat, fragt vorher
  `scene` ab (die Klasse bleibt paketintern, keine `public-api.ts` exportiert
  sie) · `CameraBasedVisibilityHelpers.createHelpers()` und
  `RectangularVisibilityAreaHelpers.update()` bauen ohne Szene keinen Knoten
  mehr; das erste `update()` nach `add(scene)` setzt den vollen Satz ein ·
  `Canvas2DStage#texture` zeigt zu keinem Zeitpunkt auf eine bereits
  freigegebene Textur, und `makeTexture()` gibt nichts mehr frei

**Übergabe ins Leere · medium · `packages/twopoint5d/src/map2d/HelpersManager.ts:39-46`** (aus Paket 11, Zug 2)

`add()` verwirft den Knoten stillschweigend, wenn weder `#scene` noch `root`
gesetzt ist: der `if (target)`-Zweig fällt aus, und der Aufrufer hat seine
Referenz nach dem `add()` bereits losgelassen. Unter dem Übernahme-Vertrag, den
das TSDoc der Methode jetzt nennt, ist das genau der Fall, in dem die Übergabe
ins Leere geht — `CameraBasedVisibilityHelpers.show = true` ohne vorheriges
`add(scene)` baut fünf Helfer, die niemand mehr sieht und niemand mehr freigibt.

Urteil an der Scope-Regel: `→ Scope` (Ownership: ein übergebener Knoten geht
verloren, statt entweder gehalten oder abgelehnt zu werden).

**Freigabe in falscher Reihenfolge · medium · `packages/twopoint5d/src/stage/Canvas2DStage.ts:118-121`** (aus Paket 12, Zug 2)

`makeTexture()` entsorgt die alte Textur, bevor die neue gebaut und gesetzt ist;
solange `#textureFactory.create()` läuft, hängt eine freigegebene Textur als
`sprite.material.map`. Dasselbe Muster, das die Entscheidung vom 2026-09-05 für
`texture/` verboten hat: erst die neue setzen, dann die alte freigeben.

Urteil an der Scope-Regel: `→ Scope` (Reihenfolge einer Freigabe, und die
Entscheidung im Kopf des Plans nennt sie beim Namen).

### [x] 17. vertex-objects: die Hülle hinter dem entsorgten Pool

- Nebenbefund: aus Paket 14 (vier Einträge der Queue: der `VertexObjectBuffer`
  hinter `pool.buffer` wirft nach `dispose()` nackte TypeErrors oder klont eine
  leere Hülle; `new VOBufferGeometry(disposedPool)` entsteht still mit null
  Attributen und hinterlässt eine Anhaftung; `isAttachedToGeometry` antwortet
  nach `dispose()` weiter `true`; sieben öffentliche Member von `VOBufferPool`
  und `VertexObjectPool` haben kein TSDoc zu ihrem Verhalten nach `dispose()`)
- Ziel: Alles, was über einen entsorgten Pool erreichbar ist — sein Buffer, eine
  darüber gebaute Geometrie, sein Anhaftungs-Getter — hält den Vertrag aus
  Abschnitt 4 der Richtlinie, und jedes öffentliche Member sagt es in seinem
  TSDoc.
- Bereich: `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`,
  `VOBufferGeometry.ts`, `InstancedVOBufferGeometry.ts`, `VOBufferPool.ts`,
  `VertexObjectPool.ts` und Specs
- Hängt ab von: 14
- Hash: dde0cc4
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectGeometry.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`
  - `packages/twopoint5d/docs/resource-lifecycle.md`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  dieselben vier Kommandos wie Paket 14, und `test:browser` ist hier kein
  billiger Beleg mehr, sondern die eigentliche Probe: die beiden Konstruktoren,
  die einen Guard bekommen, sind der Weg, über den jede Geometrie in
  `vertex-objects-dispose.test.js`, `vertex-objects-gpu-upload.test.js` und
  `vertex-objects-heap.test.js` entsteht. Nachgesehen in Zug 0: keiner der drei
  baut eine Geometrie über einem entsorgten Pool, keiner ruft
  `attachInstancedPool()` mit einem, die Erwartung ist also grün.
  `typecheck` deckt die Specs mit ab (`pnpm build` lässt `*.spec.ts` aus).
  Geprobt wurde in Zug 0 der Ausgangszustand des Moduls
  (`pnpm vitest --run src/vertex-objects/`): Exit 0, 12 Dateien, 158 Tests,
  226 ms
- Commit: `fix(vertex-objects): name the state a released buffer is in and refuse a disposed pool at the door`

#### Abgleich am Code, Zug 0 (2026-09-06)

Alle vier Einträge der Queue stehen. Gemessen wurde jeder einzeln an einem
entsorgten Pool, in einem Vitest-Lauf über eine eigene Konfiguration im
Arbeitsverzeichnis (`probe/`, außerhalb des Projekts); die Ausgabe liegt
dort als `paket-17.zug0.messung.txt`.

**Eintrag 1 — die Hülle `VertexObjectBuffer`.** Unverändert und in jedem Detail
bestätigt. Nach `VOBufferPool#dispose()` stehen `descriptor`, `capacity`,
`attributeNames` (`["bar","foo"]`), `bufferAttributes` (2) und
`bufferNameAttributes` (2) unversehrt, `buffers` ist leer.
`copyArray()` (`:146-150`), `copyAttributes()` (`:164-195`) und
`toAttributeArrays()` (`:197-226`) werfen je
`TypeError: Cannot read properties of undefined (reading 'typedArray')`;
`copyWithin()` (`:152-162`), `touch()` (`:228-232`) und `clone()` (`:142-144`)
laufen still durch, `clone()` liefert eine zweite Hülle mit `buffers.size === 0`.

Der Abgleich hat eine fünfte Stelle derselben Bauform gefunden, die der Eintrag
nicht nennt: `copy(other)` (`:131-140`) wirft denselben nackten `TypeError`,
und zwar in der anderen Richtung — ein **lebender** Buffer, der aus einem
freigegebenen kopiert. Gemessen. Sie gehört zu diesem Paket: dieselbe Ursache,
dieselbe Zeile Fix, und sie ist der Weg, über den `clone()` überhaupt erst zur
Hülle kommt.

**Eintrag 2 — Geometrie über einem entsorgten Pool.** Der Sachverhalt steht:
`new VOBufferGeometry(disposedPool, 4)` kommt still zur Welt, mit
`Object.keys(geometry.attributes).length === 0`, `buffers.size === 0` und
`pool.isAttachedToGeometry === true`. Der Index wird trotzdem gebaut
(`index.count === 24`, er stammt aus dem Descriptor und nicht aus den Buffern),
die `drawRange.count` bleibt `null`. Ein Mesh damit zeichnet nichts und hält ein
Index-Array.

**Eine Behauptung des Eintrags trägt nicht:** »der Pool trägt danach eine
Anhaftung, die niemand mehr löst«. Gemessen: `geometry.dispose()` ruft
`#attachments.detachAll()` unbedingt, und `isAttachedToGeometry` steht danach
wieder auf `false`. Die Anhaftung wird gelöst, sobald die Geometrie entsorgt
wird — sie hängt also genau so lange wie bei jeder anderen Geometrie auch. Was
bleibt, ist der stille Konstruktor, und der ist Grund genug. Der Queue-Eintrag
ist an seiner Stelle mit einer datierten Zeile korrigiert.

**Dieselbe Lücke sitzt in der Schwesterklasse**, die der Eintrag nicht nennt.
Gemessen: `new InstancedVOBufferGeometry(disposedInstancedPool, 4, baseDesc, 1)`
läuft durch — die Basisroute entsteht vollständig, `instancedBuffers.size === 0`,
`instancedPool.isAttachedToGeometry === true`. Und
`attachInstancedPool('x', disposedPool)` nimmt den toten Pool an, hängt ihn ein
und baut null Buffer; der Slot-Guard davor greift nicht, weil ein Pool ohne
Buffer keinen Slot beansprucht. Der Kommentar in `#detachRoute()` nennt diesen
Zustand sogar beim Namen (»a pool that was disposed before it was attached«) —
der Code weiß von ihm und lässt ihn zu.

**Eintrag 3 — `isAttachedToGeometry` nach `dispose()`.** Steht. Gemessen mit
lebender Geometrie: vor `pool.dispose()` `true`, nach `pool.dispose()` weiter
`true`, erst `geometry.dispose()` bringt es auf `false`. `dispose()`
(`VOBufferPool.ts:101-109`) fasst `#geometryAttachments` (`:19`) nicht an, und
das TSDoc des Getters (`:58-63`) sagt für den entsorgten Zustand nichts.
Nachgesehen, wer den Getter liest: außer den Specs allein
`VertexObjectPool#resize()` (`:55`) — und dort steht seit Paket 14 der
Dispose-Guard davor (`:45-47`). Die Änderung ist damit ohne Nebenwirkung im
Produktionscode.

**Eintrag 4 — die Member ohne TSDoc.** Steht, und die Zählung des Eintrags ist
zu niedrig. Er nennt sechs Member (`usedCount`-Getter und -Setter, `clear()`,
`containsVO()`, `freeVO()`, `getVO()`) und spricht von sieben. Das Ziel dieses
Pakets verlangt »jedes öffentliche Member«, und das sind zwölf: dazu kommen
`buffer`, `descriptor` und `capacity` (die Paket 14 in seiner Entscheidung 5
ausdrücklich bewertet, aber nicht dokumentiert hat), `isDisposed` (ganz ohne
TSDoc) und `onCreateVO`. Gemessen an einem entsorgten Pool:
`usedCount` → `0`, Setter nimmt weiter an (`= 3` liest sich als `3` zurück),
`clear()` still, `containsVO(vo)` → `false`, `freeVO(vo)` still,
`getVO(0)` → `undefined`, `buffer` behält seine Identität und hält die Hülle,
`isDisposed` → `true`, `capacity` → unverändert.

**Ein Loch, das dabei aufging.** Die Auskunft »`getVO()` antwortet `undefined`«
gilt nur, solange `usedCount` auf `0` steht. Gemessen:
`pool.dispose(); pool.usedCount = 3; pool.getVO(0)` baut ein vollwertig
aussehendes Vertex-Object auf der Hülle, dessen Attributzugriffe `undefined`
liefern statt zu scheitern. Der Weg dorthin führt über den `usedCount`-Setter,
den Paket 14 bewusst offen gelassen hat. Siehe Entscheidung 4 unten.

#### Entscheidungen

1. **`VertexObjectBuffer` bekommt seinen Begriff von »freigegeben« — genau den,
   den Paket 14 vertagt hat.** Entscheidung 6 von Paket 14 hat den Guard am Pool
   gesetzt und dazu geschrieben, der Buffer besitze seinen Lebenszyklus nicht,
   ihm einen Begriff davon zu geben sei »ein eigener Entwurf« und gehöre in ein
   eigenes Paket. Dies ist dieses Paket. Es widerspricht Paket 14 nicht, es
   löst dessen Vertagung ein — im Review bitte nicht als Rückschritt aufmachen.

   Der Weg ist der kleinstmögliche: `VOBufferPool#dispose()` greift heute selbst
   in den Buffer hinein (es nullt jedes `typedArray` und leert die Map). Diese
   beiden Zeilen wandern in eine `@internal`-Methode `release()` auf dem Buffer,
   die zusätzlich ein privates `#released` setzt. Damit erfährt der Buffer seinen
   Zustand von dem, der ihn herbeiführt, statt ihn aus einer leeren Map zu
   erraten — und das Hineingreifen verschwindet aus dem Pool. `attachGeometry()`
   und `detachGeometry()` auf dem Pool sind dasselbe Muster und der Beleg, dass
   es hier üblich ist.

2. **Kein neues öffentliches Member.** `#released` bleibt privat, es gibt kein
   `isReleased`. Punkt 8 der Checkliste in Abschnitt 7 der Richtlinie verlangt
   ein `isDisposed` dort, wo ein Aufrufer sich verzweigen muss — der Aufrufer
   hält den Buffer über `pool.buffer` und fragt den Pool, der die Auskunft schon
   gibt. Ein zweites Flag mit zweitem Namen für denselben Zustand wäre Fläche
   ohne Gewinn, und die öffentliche Typform (`checkPkgTypes`,
   `checkNameableTypes`) bleibt so unverändert.

3. **Die sechs Methoden des Buffers teilen sich nach der Typregel aus
   Abschnitt 4 auf, nicht nach Geschmack:**

   | Member | Reaktion | Warum |
   | --- | --- | --- |
   | `copyArray()`, `copyAttributes()`, `toAttributeArrays()` | wirft benannt | Regel 2 in ihrem Geist: heute werfen sie ohnehin, nur nackt und tief drin. Genau das schließt Abschnitt 4 namentlich aus |
   | `copy(other)` mit freigegebener Quelle | wirft benannt | dieselbe Bauform, andere Richtung — es gibt nichts zu lesen |
   | Konstruktor mit freigegebener Quelle | wirft benannt | der deklarierte Rückgabetyp verspricht einen benutzbaren Buffer; eine zweite Hülle ist eine Lüge über den Typ |
   | `clone()` | wirft, geerbt | es geht durch den Konstruktor; ein eigener Guard wäre eine zweite Meldung für dieselbe Sache |
   | `copyWithin()`, `touch()` | bleiben stille No-ops | Regel 3 — **und sie müssen es bleiben**: `VertexObjectPool#freeVO()` ruft `this.buffer.copyWithin()` (`:167`) und `#createVO()` ruft `this.buffer.touch()` (`:194`). Beide sind an einem entsorgten Pool als stille No-ops dokumentiert. Ein Guard hier bricht diese Zusage |

   `copy(this)` auf einem freigegebenen Ziel bleibt still: nichts zu schreiben,
   Regel 3. Es wirft nur, wenn die **Quelle** freigegeben ist.

4. **`getVO()` bekommt einen Guard, der `usedCount`-Setter nicht.** Paket 14
   hat in seiner Entscheidung 5 begründet, warum der Setter offen bleibt:
   `dispose()` schreibt selbst durch ihn, ein Guard dort ließe `usedCount` auf
   dem letzten Wert stehen. Das bleibt so, und es wird hier nicht neu
   aufgemacht. Stattdessen wird das Loch dort geschlossen, wo es sich zeigt:
   `if (this.isDisposed) return undefined;` als erste Zeile von `getVO()`.

   Der Grund ist nicht Symmetrie, sondern Wahrheitsgehalt. Ohne den Guard muss
   das TSDoc von `getVO()` einen Vorbehalt tragen (»antwortet `undefined`,
   solange niemand `usedCount` wieder hochgesetzt hat«), und Zusicherung (c) aus
   Abschnitt 8 misst dann gegen eine bedingte Aussage. Mit ihm ist der Satz
   unbedingt. Eine Zeile, kein Aufrufer im Produktionscode (nachgesehen: außer
   den Specs ruft niemand `getVO()`), und der bestehende Test in
   `VertexObjectPool.spec.ts:884` bleibt grün.

5. **Die beiden Geometrie-Konstruktoren und `attachInstancedPool()` weisen einen
   entsorgten Pool ab.** Reaktion nach Abschnitt 4 Regel 3, zweiter Satz: eine
   Methode, die ungültige Eingaben schon heute abweist, weist weiter ab.
   `attachInstancedPool()` wirft bereits für einen belegten Slot, mit einer
   Meldung, die den Aufruf nennt und sagt, was stattdessen zu tun ist — dieselbe
   Form.

   Warum nicht still lassen: das Ergebnis ist heute eine Geometrie, die nichts
   zeichnet, ein Index-Array hält und einem Aufrufer wie eine funktionierende
   aussieht. Der Fehler ist an der Konstruktionsstelle billig und drei Frames
   später unauffindbar.

6. **`InstancedVOBufferGeometry` kommt mit hinein, obwohl der Queue-Eintrag sie
   nicht nennt.** Dieselbe Ursache (kein Konstruktor prüft den Zustand eines
   hereingereichten Pools), dieselbe Klasse von Defekt, das Schwestermodul in
   derselben Datei-Nachbarschaft. Nur `VOBufferGeometry` zu schließen hieße,
   zwei Geometrien mit gegensätzlichem Vertrag auszuliefern, und der Reviewer
   hätte recht, das als nicht mitgezogene Stelle dieses Umbaus zu melden. Der
   `Bereich` des Pakets ist um diese Datei erweitert.

   `VertexObjectGeometry` und `InstancedVertexObjectGeometry` brauchen keine
   Änderung: beide reichen einen hereingereichten Pool unverändert an
   `super()` durch und sind vom Guard der Basisklasse gedeckt.

7. **Die Meldungen nennen die Basisklasse fest verdrahtet, nicht
   `new.target.name`.** Der Reflex wäre, dem Aufrufer die Klasse zu nennen, die
   er getippt hat. Der Preis dafür ist zu hoch: die Bibliothek liefert
   unminifiziertes ESM, aber jedes Consumer-Bundle minifiziert, und
   `new.target.name` liest sich dort als einzelner Buchstabe. Eine Meldung, die
   in einem fremden Stack lesbar sein soll, darf nicht von Bezeichnernamen zur
   Laufzeit abhängen. Der Stack zeigt die Unterklasse ohnehin. Dasselbe Muster
   wie `disposedError()` in den beiden Pool-Dateien.

8. **`isAttachedToGeometry` antwortet `false` an einem entsorgten Pool.** Der
   Guard sitzt im Getter, der Zähler `#geometryAttachments` bleibt unangetastet.

   Warum nicht werfen: derselbe Grund, den Paket 14 in seiner Entscheidung 4 für
   `availableCount` aufgeschrieben hat — ein diagnostischer Getter, der wirft,
   macht aus einem `console.log()` einen Absturz. Und `false` ist keine
   Ausweichantwort: nach `dispose()` gibt es keine Buffer mehr, auf denen eine
   Geometrie etwas gebaut haben könnte.

   Warum nicht den Zähler in `dispose()` nullen: der Zähler ist die Buchführung
   der Geometrien, nicht des Pools. Ihn zu nullen hieße, einen echten Halt
   stillschweigend fallenzulassen; `detachGeometry()` einer noch lebenden
   Geometrie liefe danach ins Leere. Der Getter beantwortet die Frage, die ein
   Aufrufer wirklich stellt, ohne die Buchführung zu verfälschen. Ein Pool wird
   nie wieder lebendig, der Guard ist also endgültig.

9. **Die Richtlinie bekommt zwei Sätze dazu.** Abschnitt 4 regelt heute, wie
   sich die Member einer entsorgten Instanz verhalten. Er sagt nichts darüber,
   was eine Instanz tut, der eine entsorgte hereingereicht wird — und genau das
   entscheidet dieses Paket dreimal. Ohne die Regel steht der Guard ohne
   geschriebene Grundlage da und das nächste Paket entscheidet ihn neu. Zwei
   Sätze am Ende von Abschnitt 4, Wortlaut unter Schritt 8.

10. **Kein Browser-Test kommt dazu.** Es entsteht, wandert und stirbt kein
    `THREE.BufferAttribute` anders: die Guards verweigern die Arbeit, statt sie
    anders zu tun, und jeder Pfad, der heute grün ist, bleibt buchstäblich
    gleich. Das Verify fährt `test:browser` trotzdem, und hier aus einem echten
    Grund — siehe die Begründung an der `Verify:`-Zeile.

11. **Das Paket wird nicht geteilt.** Fünf Quelldateien sind viel, aber es ist
    eine Ursache mit einem Vertrag, und zwei Pakete müssten sich denselben
    CHANGELOG-Absatz und denselben Richtlinien-Abschnitt teilen.

#### Vorgehen

Reihenfolge: erst die Tests, jeder rot gesehen, dann die Fixes. Die
Konventionen im Kopf des Plans gelten für jede Zeile — kein Rückblick auf den
Vorzustand, keine Finding-Nummern, auch nicht in der Commit-Message.

1. **`VertexObjectBuffer.ts` — die Meldung und der Zustand.** Über die Klasse,
   im Muster der beiden Pool-Dateien:

   ```ts
   // one message for every method that refuses to work once the pool behind this buffer has
   // given up its typed arrays, so the class, the method and the state are always in the text
   // a caller reads out of a foreign stack
   function releasedError(method: string): Error {
     return new Error(`VertexObjectBuffer#${method} is not available: the pool behind this buffer has been disposed`);
   }
   ```

   In der Klasse ein privates Feld `#released = false;` und die interne Methode:

   ```ts
   /**
    * Give up the typed array of every buffer and empty the buffer map.
    *
    * Called by the pool that owns this buffer as part of its `dispose()`. Afterwards the
    * buffer keeps saying what it was — `descriptor`, `capacity`, `attributeNames`,
    * `bufferAttributes` and `bufferNameAttributes` are untouched — but it holds no data:
    * every method that would read or write through a typed array refuses, and the two that
    * have nothing left to do go on doing nothing.
    *
    * @internal
    */
   release(): void {
     for (const buffer of this.buffers.values()) {
       buffer.typedArray = undefined;
     }
     this.buffers.clear();
     this.#released = true;
   }
   ```

2. **`VertexObjectBuffer.ts` — die Guards.** Der Konstruktor wirft, bevor er
   irgendetwas anlegt, wenn die Quelle ein freigegebener Buffer ist:

   ```ts
   if (source instanceof VertexObjectBuffer && source.#released) {
     throw new Error(
       'VertexObjectBuffer: the source buffer holds no typed array any more — the pool behind it has been disposed. ' +
         'Copy the buffer before the pool is disposed, or build a new one from the descriptor.',
     );
   }
   ```

   Auf `source.#released` darf hier zugegriffen werden: private Felder sind in
   TypeScript und in JavaScript klassenweit sichtbar, nicht instanzweit.

   In `copy()`, `copyArray()`, `copyAttributes()` und `toAttributeArrays()`
   ersetzt ein benannter Wurf den nackten `TypeError`. Nicht durch ein
   `#released`-Flag am Methodenanfang, sondern an der Stelle, an der die
   Non-Null-Assertion heute lügt — dort weiß der Code, welcher Buffer fehlt:

   - `copy()`: der Zugriff auf `other.buffers.get(buf.bufferName)!.typedArray!`
     wird geprüft; fehlt der Eintrag, `throw releasedError('copy()')`.
   - `copyArray()`: `this.buffers.get(bufferName)` wird geprüft. **Achtung auf
     die Unterscheidung:** ein fehlender Eintrag bei `#released === true` ist der
     freigegebene Zustand (`releasedError('copyArray()')`), bei
     `#released === false` ein unbekannter Buffername — dafür eine eigene, ebenso
     benannte Meldung, statt beides in einen Topf zu werfen. Eine Meldung, die
     einem Tippfehler »the pool has been disposed« sagt, schickt den Aufrufer in
     die falsche Datei.
   - `copyAttributes()` und `toAttributeArrays()`: beide schlagen erst
     `bufferAttributes` nach und dann `buffers`. Ein Treffer im ersten und ein
     Fehlschlag im zweiten ist genau und nur der freigegebene Zustand →
     `releasedError('copyAttributes()')` bzw.
     `releasedError('toAttributeArrays()')`.

   `copyWithin()` und `touch()` bleiben unverändert. Siehe Entscheidung 3.

3. **`VOBufferPool.ts` — `dispose()` gibt das Hineingreifen ab.** Der Rumpf
   wird zu:

   ```ts
   dispose(): void {
     if (this.#disposed) return;
     this.#disposed = true;
     this.usedCount = 0;
     this.buffer.release();
   }
   ```

   Der `NOTE:`-Absatz im TSDoc von `dispose()` bleibt. Der Satz darüber, der
   `pool.buffer.buffers` beschreibt, wird auf die neue Aufteilung gebracht,
   ohne den Vorzustand zu erzählen.

4. **`VOBufferPool.ts` — `isAttachedToGeometry`.** Getter und TSDoc:

   ```ts
   /**
    * True while at least one geometry has built `THREE.BufferAttribute`s on top of this
    * pool's buffers. While this holds, {@link VertexObjectPool#resize} refuses every change
    * of capacity; only a `resize()` to the capacity the pool already has still goes through,
    * because it leaves the buffers alone.
    *
    * `false` once {@link dispose} has run: a disposed pool has no buffers left for a geometry
    * to read, whether or not one still holds it. The bookkeeping underneath is left as it is,
    * so a geometry that gives the pool up afterwards still counts down correctly.
    */
   get isAttachedToGeometry(): boolean {
     return !this.#disposed && this.#geometryAttachments > 0;
   }
   ```

5. **`VertexObjectPool.ts` — `getVO()` weist ab.** `if (this.isDisposed) return undefined;`
   als erste Anweisung des Rumpfes, mit dem TSDoc aus Schritt 6.

6. **Das TSDoc jedes öffentlichen Members.** Punkt 6 der Checkliste in
   Abschnitt 7 der Richtlinie verlangt den Satz in **dessen** TSDoc, nicht einen
   Sammelabsatz an der Klasse. Ein Satz je Member, mehr nicht. Was jeweils
   dastehen muss — Formulierung im Ton der bereits vorhandenen TSDoc dieser
   beiden Dateien:

   `VOBufferPool.ts`
   - `descriptor` und `capacity`: was dieser Pool ist, keine Zusage auf
     Bedienung; die Werte bleiben nach `dispose()` stehen und sagen weiter, was
     er war.
   - `buffer`: hält nach `dispose()` denselben `VertexObjectBuffer` weiter, der
     dann aber kein `typedArray` und keinen Eintrag in `buffers` mehr trägt —
     jede Methode, die durch ein Array lesen oder schreiben würde, wirft, siehe
     `VertexObjectBuffer`.
   - `get usedCount`: `0` nach `dispose()`, das die Zahl selbst zurücksetzt.
   - `set usedCount`: nimmt weiter jeden Wert an, auch an einem entsorgten Pool;
     `dispose()` schreibt selbst durch diesen Setter. Ein Wert, der dort
     geschrieben wird, kauft nichts — der Pool hat keine Buffer mehr, und
     `createVO()` wie `getVO()` antworten unabhängig davon `undefined`.
   - `get isDisposed`: `true`, sobald `dispose()` gelaufen ist; ein Pool wird
     nie wieder lebendig.
   - `clear()`: setzt `usedCount` auf `0` zurück und gibt nichts frei; an einem
     entsorgten Pool bleibt davon ein No-op ohne Wirkung.

   `VertexObjectPool.ts`
   - `onCreateVO`: der Haken bleibt gesetzt und wird an einem entsorgten Pool nie
     wieder gerufen, weil weder `createVO()` noch `getVO()` noch ein Vertex
     Object erzeugen.
   - `containsVO()`: `false` an einem entsorgten Pool — er hat jedes Vertex
     Object von seinem Buffer gelöst und besitzt keins mehr.
   - `freeVO()`: der vorhandene Absatz über die Kopierkosten bleibt, ein Satz
     kommt dazu: an einem entsorgten Pool ist es ein stilles No-op, weil
     `containsVO()` jedes Vertex Object abweist.
   - `getVO()`: braucht ein TSDoc, es hat keins. Was es tut, plus: antwortet
     `undefined` an einem entsorgten Pool — der deklarierte Typ lässt die
     Abwesenheit zu, und der Index ist mit `dispose()` gefallen.

   `VertexObjectBuffer.ts` — die Klasse hat kein eigenes `dispose()`, ihr
   Zustand kommt vom Pool. Ein Satz je Member, der ihn nennt: `copy()`,
   `clone()`, `copyArray()`, `copyAttributes()` und `toAttributeArrays()` werfen
   mit einer Meldung, die die Klasse, die Methode und den Zustand nennt;
   `copyWithin()` und `touch()` tun nichts; die sechs Lesefelder bleiben stehen
   und sagen weiter, was dieser Buffer war.

7. **Die Guards der Geometrien.** In `VOBufferGeometry` als erste Zeile des
   Konstruktors, **vor** `super()` — nachgemessen in Zug 0, dass TypeScript das
   trotz privater Felder und initialisierter Properties annimmt, solange die
   Anweisung `this` nicht anfasst; so entsteht gar nichts erst halb:

   ```ts
   if (source instanceof VOBufferPool && source.isDisposed) {
     throw new Error(
       'VOBufferGeometry: the pool handed to the constructor has been disposed and holds no buffers ' +
         'to build attributes on. Build the geometry while the pool is alive, or hand it a live pool.',
     );
   }
   ```

   In `InstancedVOBufferGeometry` dasselbe, ebenfalls vor `super()`, für beide
   Quellen: `args[0]` immer, `args[2]` nur, wenn es keine `BufferGeometry` ist.
   Die Meldung nennt, welche der beiden es war (`instanced` / `base`).

   In `attachInstancedPool()` ein dritter Guard. Seine Stelle ist genau
   festgelegt:
   - **nach** dem frühen `return` für denselben Pool unter demselben Namen. Der
     Zweig baut nichts und fasst keinen Buffer an; ihn abzuweisen machte aus
     einem idempotenten Aufruf einen Fehler, und ein `autoDispose`-Update an
     einem Pool, den der Aufrufer gerade fallen lässt, ist legitim.
   - **vor** `#detachRoute(name)` und vor jedem `declareOwnedPool()` — die Datei
     schreibt sich diese Regel im Kommentar über dem Slot-Guard selbst vor: ein
     Wurf darf nichts hinterlassen, was `dispose()` später freigeben müsste.

   ```ts
   if (extraPool.isDisposed) {
     throw new Error(
       `InstancedVOBufferGeometry#attachInstancedPool("${name}"): this pool has been disposed and holds no ` +
         'buffers to build attributes on. Attach a live pool, or leave the name free.',
     );
   }
   ```

   Der Kommentar in `#detachRoute()`, der »a pool that was disposed before it
   was attached« als einen der Wege nennt, über die ein Pool eine zweite Route
   erreicht, stimmt danach nicht mehr. Er wird auf den verbleibenden Weg
   gebracht (ein Descriptor, der keine Attribute deklariert). Das ist keine
   Kür — er beschreibt sonst einen Zustand, den der Code nicht mehr zulässt.

8. **`docs/resource-lifecycle.md`, Abschnitt 4.** Zwei Sätze, als eigener
   Absatz nach dem Absatz über das offene Promise und vor dem Schlusssatz
   »Whichever of the three a member picks, its TSDoc says so.«:

   ```markdown
   The same rule points outwards. A constructor or a method that is handed an instance
   someone has already disposed refuses it, with an error that names the call and the state,
   rather than building something on a resource that is gone. What it would build otherwise
   looks alive to its caller and does nothing at all —
   [`VOBufferGeometry`](../src/vertex-objects/VOBufferGeometry.ts) over a disposed pool is a
   geometry with no attributes, and nothing about it says so until a frame comes out empty.
   ```

9. **`CHANGELOG.md`, unter `[Unreleased]`.** Vorher den Skill
   `updating-changelog` laden; er gilt laut den Konventionen für jeden Eintrag
   dieses Laufs. Vier Eingriffe, nicht drei:

   - **`### Added`, bestehende Zeile ändern statt eine neue anlegen:** die Zeile
     zu `VOBufferPool#isAttachedToGeometry` beschreibt eine Zusage, die noch nie
     ausgeliefert wurde. Der neue `false`-Fall gehört in diese Zeile, nicht in
     `### Changed` — was unveröffentlicht ist, ändert sich nicht, es wird
     beschrieben.
   - **`### Changed`, bestehende Zeile korrigieren:** die Zeile zum entsorgten
     `VOBufferPool` stellt `getVO()` neben `clear()` und `freeVO()` unter »go on
     doing nothing«. `getVO()` antwortet `undefined`, das ist Reaktion 1 der
     Richtlinie und nicht Reaktion 3. Der Satz wird richtiggestellt und um den
     Guard aus Schritt 5 ergänzt. Das ist ein kleiner Befund aus Paket 14, der in
     genau dem Absatz sitzt, den dieses Paket ohnehin anfasst.
   - **`### Changed`, ein bis zwei neue Zeilen:** der freigegebene
     `VertexObjectBuffer` (benannte Fehler statt `TypeError`, kein Klon mehr aus
     einer leeren Hülle) und die drei Stellen, die einen entsorgten Pool
     abweisen (beide Geometrie-Konstruktoren und `attachInstancedPool()`).
   - **`### Migration Guide`, ein `####`-Abschnitt** im Muster der vorhandenen,
     mit **Before** / **After**-Blöcken: eine Geometrie über einem entsorgten
     Pool. Vorher entstand sie still und zeichnete nichts; jetzt sagt der
     Konstruktor es an Ort und Stelle. Der Weg heraus ist, die Geometrie vor dem
     `dispose()` des Pools zu bauen oder einen lebenden zu reichen.

10. **Die Tests.** Jeder wird rot gesehen, bevor sein Fix kommt; der rote Lauf
    gehört in den Report. Wo sie hingehören, ist nicht beliebig:

    - **`VertexObjectPool.spec.ts`**, in den bestehenden
      `describe('dispose()')`-Block, als weitere `// (c)`-Tests im dortigen
      Idiom (`expect(fn, 'the message names the class and the method').toThrow(/…/)`):
      `isAttachedToGeometry` ist `false` nach `dispose()` und der Zähler zählt
      danach korrekt herunter; `getVO()` antwortet `undefined`, auch nachdem
      `usedCount` an einem entsorgten Pool wieder hochgesetzt wurde.
    - **`VertexObjectBuffer.spec.ts`**, ein **neuer** Block
      `describe('after the pool has been disposed')`. Er trägt **keine**
      Fallbuchstaben `(a)` bis `(f)`: das Muster aus Abschnitt 8 gehört der
      Klasse, die ein eigenes `dispose()` besitzt, und `VertexObjectBuffer` hat
      keines. Inhalt: die vier werfenden Methoden je mit Klasse, Methode und
      Zustand in der Meldung; `copyWithin()` und `touch()` werfen nicht;
      `clone()` und `new VertexObjectBuffer(released, n)` werfen; die sechs
      Lesefelder stehen unverändert.
    - **`VertexObjectGeometry.spec.ts`** und
      **`InstancedVertexObjectGeometry.spec.ts`**: je ein neuer Block
      `describe('a pool that has been disposed')`, **außerhalb** des vorhandenen
      `dispose()`-Blocks. Das ist kein Ordnungssinn: der `dispose()`-Block von
      `InstancedVertexObjectGeometry.spec.ts` ist Gegenstand von Paket 18, und
      die beiden Pakete sollen einander nicht in dieselben Zeilen laufen.
      Inhalt: der Konstruktor wirft (bei der instanced-Variante für beide
      Quellen), `attachInstancedPool()` wirft und lässt die Geometrie exakt so
      stehen, wie sie war — Attribute, `extraInstancedPools` und die Anhaftung
      des abgewiesenen Pools unverändert.

11. **Verify selbst fahren**, alle vier Kommandos, Ausgabe ins Log des
    Arbeitsverzeichnisses. Nicht aus dem Nx-Cache: die Baseline im Kopf des
    Plans kam von dort, und ein Cache-Treffer belegt nichts über diesen Diff.

- Ergebnis: 1 Runde · alle vier Queue-Einträge behoben, dazu die drei in Zug 0
  dazugenommenen Stellen (`VertexObjectBuffer#copy()`, der Konstruktor von
  `InstancedVOBufferGeometry`, `attachInstancedPool()`) · Regressionstests: 13
  Tests in vier Spec-Dateien, alle vor den Fixes rot gesehen
  (`VertexObjectBuffer.spec.ts` neuer Block `after the pool has been disposed`,
  je ein Block `a pool that has been disposed` in `VertexObjectGeometry.spec.ts`
  und `InstancedVertexObjectGeometry.spec.ts`, zwei `(c)`-Tests im
  `dispose()`-Block von `VertexObjectPool.spec.ts`) · Runde 1 hat 2 wichtige und
  4 kleine Review-Befunde geschlossen und 2 Tests ergänzt, darunter der Test, der
  die festgelegte Stelle des Guards in `attachInstancedPool()` festhält · Verify
  `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` je ohne
  Nx-Cache, exit 0 (`paket-17.verify.log`) · klein und bewusst stehengelassen:
  das TSDoc von `clear()`, `containsVO()` und `freeVO()` macht unbedingte
  Zusagen, die über den offenen `usedCount`-Setter falsifizierbar sind —
  Entscheidung 4 lässt den Setter offen, Schritt 6 gibt den Wortlaut vor, siehe
  `Folgen:`
- Nebenbefunde: → Queue
- Folgen: `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:102-105`
  (`clear()`), `VertexObjectPool.ts:138-142` (`containsVO()`) und
  `VertexObjectPool.ts:164-170` (`freeVO()`) — die drei TSDoc-Sätze sagen
  unbedingt, was an einem entsorgten Pool geschieht; wer nach `dispose()` den
  offenen `usedCount`-Setter benutzt oder ein Vertex Object über
  `VOUtils.setBuffer()` wieder verknüpft, widerlegt sie. Entweder derselbe
  Guard wie an `getVO()` oder ein Vorbehalt im Satz. Der Text stammt aus diesem
  Paket, die Lücke aus Entscheidung 5 von Paket 14 · 2026-09-06, Drain-Runde 3:
  als Paket 19 geschnitten
- Schnittstellen: `VertexObjectBuffer#release()` — neue `@internal`-Methode, die
  jedem Buffer sein `typedArray` nimmt und die Map leert; `VOBufferPool#dispose()`
  ruft sie, statt selbst hineinzugreifen · an einem so freigegebenen
  `VertexObjectBuffer` werfen `copy()` (mit freigegebener **Quelle**),
  `copyArray()`, `copyAttributes()`, `toAttributeArrays()`, `clone()` und der
  Konstruktor mit einer Meldung aus der dateilokalen Funktion `releasedError()`
  in `VertexObjectBuffer.ts` (Form `VertexObjectBuffer#<methode> is not
  available: the pool behind this buffer has been disposed`); `copyWithin()` und
  `touch()` bleiben stille No-ops, und `copy()` auf ein freigegebenes **Ziel**
  ebenfalls · `copyArray()` und `copy()` unterscheiden den freigegebenen Zustand
  von einem unbekannten Buffernamen bzw. einem abweichenden Descriptor und geben
  je eine eigene Meldung · `VOBufferPool#isAttachedToGeometry` antwortet `false`
  an einem entsorgten Pool, der Zähler `#geometryAttachments` bleibt dabei
  unangetastet und zählt weiter korrekt herunter · `VertexObjectPool#getVO()`
  antwortet `undefined` an einem entsorgten Pool, unabhängig von `usedCount` ·
  `new VOBufferGeometry(pool, …)`, `new InstancedVOBufferGeometry(…)` (beide
  Quellen) und `InstancedVOBufferGeometry#attachInstancedPool(name, pool)` werfen,
  wenn der hereingereichte Pool entsorgt ist; der Guard von
  `attachInstancedPool()` sitzt nach dem frühen `return` für denselben Pool unter
  demselben Namen und vor `#detachRoute()` wie vor jedem `declareOwnedPool()`,
  ein Wurf hinterlässt also nichts · `docs/resource-lifecycle.md` Abschnitt 4
  trägt jetzt auch die Richtung nach außen: wer eine bereits entsorgte Instanz
  hereingereicht bekommt, weist sie ab

### [x] 18. Dispose-Test-Blöcke: die Fälle (a) bis (e) beschriften

- Nebenbefund: aus Paket 15 (ein Eintrag der Queue: fünf Dispose-Test-Blöcke in
  `AnimatedSpritesMaterial.spec.ts`, `TexturedSprites.spec.ts`,
  `TextureStore.spec.ts`, `InstancedVertexObjectGeometry.spec.ts` und
  `vertex-buffers-geometry-updates.spec.ts` tragen für die Fälle `(a)` bis
  `(e)` keinen Vermerk, ob geprüft oder ohne Gegenstand)
- Ziel: Jeder Dispose-Test-Block im Repo sagt für jeden der sechs Fälle aus
  Abschnitt 8 der Richtlinie, ob er ihn prüft oder warum er dort keinen
  Gegenstand hat.
- Bereich: zwölf der neunzehn Dispose-Test-Blöcke — neun in
  `packages/twopoint5d/src/`, drei in `packages/twopoint5d-testing/test/`. Die
  Liste steht unter »Abgleich am Code«, und sie ist länger als die fünf
  Dateien, die hier vorher standen; der Grund steht ebenda.
- Hängt ab von: 15
- Hash: a3299ea
- Modell: mittlere Stufe
- Effort: medium

Beides weicht von Paket 15 ab, das für dieselbe Sorte Arbeit auf `low` stand.
Der Unterschied sind vier neue Tests: Paket 15 war reine Transkription, hier
kommen zu den siebenundvierzig Vermerken vier Fälle, die einen Gegenstand haben
und keinen Test. `medium` ist die Stufe für einen Test samt seinem Idiom;
`high` wäre falsch, weil jeder der vier unten im Wortlaut steht und mehr
Nachdenken nur die Neigung erhöht, nebenbei aufzuräumen.

**Für den Reviewer** ist die Diff-Größe wieder der falsche Maßstab.
Siebenundvierzig Vermerke sind siebenundvierzig Tatsachenbehauptungen über den
Quelltext, und die schwersten sind die vier »kein Gegenstand«: sie behaupten,
dass ein Fall dort nichts zu prüfen findet. Jede einzelne ist am Code
nachzuprüfen, nicht am Vermerk daneben.

#### Abgleich am Code, Zug 0 (2026-09-06)

Maßgeblich ist derselbe Grep wie in Paket 15, damit Implementierer, Reviewer und
Abschluss dieselbe Menge meinen:

```
grep -rn "describe(['\"][^'\"]*dispose" packages/twopoint5d/src packages/twopoint5d-testing/test
```

Dreiundzwanzig Treffer, davon neunzehn Dispose-Test-Blöcke — dieselben neunzehn
wie in Paket 15. Vier Treffer sind keine, und für alle vier steht das Urteil
bereits im Plan: `vertex-buffers-geometry-updates.spec.ts` `describe('update()
after dispose()')` prüft das Verhalten von `update()` an einer entsorgten
Geometrie (Paket 15), und die drei Blöcke, die Paket 17 angelegt hat, tragen
laut dessen Detailplan ausdrücklich keine Fallbuchstaben:
`VertexObjectBuffer.spec.ts` `describe('after the pool has been disposed')`
sowie `VertexObjectGeometry.spec.ts` und `InstancedVertexObjectGeometry.spec.ts`
je `describe('a pool that has been disposed')`. Das Muster aus Abschnitt 8
gehört der Klasse mit eigenem `dispose()`, nicht dem Block über eine fremde
entsorgte Instanz.

Ein Gegencheck über das ganze Repo (`--include='*.ts' --include='*.js'
--include='*.mjs'`, ohne `node_modules` und `dist`) findet außerhalb dieser
beiden Pfade keinen einzigen weiteren Block — auch nicht im Lookbook.

Für jeden der neunzehn Blöcke hat Zug 0 gezählt, welche Buchstaben er trägt:

| Block | trägt | fehlt |
| --- | --- | --- |
| `controls/InputControlBase.spec.ts:50` | a b c d e f | — |
| `stage/Canvas2DStage.spec.ts:80` | a b c d e f | — |
| `stage/StageRenderer.spec.ts:635` | a b c d e f | — |
| `display/FixedFrameLoop.spec.ts:149` | a b c d e f | — |
| `texture/TextureResource.spec.ts:113` | a b c d e f | — |
| `map2d/Map2DTileRenderer.spec.ts:34` | a b c d e f | — |
| `vertex-objects/VertexObjectPool.spec.ts:710` | a b c d e f | — |
| `sprites/AnimatedSprites/AnimatedSprites.spec.ts:16` | a e f | **b c d** |
| `map2d/Map2D.spec.ts:29` | a e f | **b c d** |
| `sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts:15` | a f | **b c d e** |
| `map2d/TileSprites/TileSpritesMaterial.spec.ts:15` | a f | **b c d e** |
| `texture/TextureStore.spec.ts:75` | c f | **a b d e** |
| `twopoint5d-testing/test/display-dispose.test.js:30` | a b e f | **c d** |
| `twopoint5d-testing/test/pan-control-dispose.test.js:35` | a b e f | **c d** |
| `sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts:41` | f | **a b c d e** |
| `sprites/TexturedSprites/TexturedSprites.spec.ts:79` | f | **a b c d e** |
| `vertex-objects/InstancedVertexObjectGeometry.spec.ts:129` | f | **a b c d e** |
| `vertex-objects/vertex-buffers-geometry-updates.spec.ts:668` | f | **a b c d e** |
| `twopoint5d-testing/test/vertex-objects-dispose.test.js:46` | f | **a b c d e** |

Sieben Blöcke sind vollständig, zwölf nicht. Es fehlen siebenundvierzig
Vermerke.

#### Warum der Bereich von fünf auf zwölf gewachsen ist

Die Queue-Zeile, aus der dieses Paket stammt, nennt fünf Dateien, und sie sagt
auch, wie sie auf die Zahl kam: »diese fünf tragen zusammen einen einzigen
Buchstaben«. Das ist gezählt und richtig — nur zählt es die Blöcke mit **null
oder einem** Buchstaben, nicht die mit **weniger als sechs**. Sieben weitere
Blöcke tragen zwei bis vier und beantworten damit ebenfalls nicht, was die
Zielzeile über ihnen verlangt.

Es ist derselbe Fall wie in Paket 15, wo der Bereich aus demselben Grund von
acht auf fünfzehn wuchs: eine Aufzählung wird an der Zielzeile korrigiert, die
über ihr steht. Die Zielzeile lautet unverändert »jeder Dispose-Test-Block im
Repo«, und sie ist mit fünf Dateien nach diesem Paket genauso unbewiesen wie
vorher. Die Gegenprobe ist die aus Paket 15 und diesmal schärfer: bliebe es bei
fünf, schnitte die Drain-Runde des Abschlusses ein drittes Paket für
dreiundzwanzig Kommentarzeilen und einen Test — dieselbe Ursache zum dritten
Mal halb behoben, und nach der
Entscheidung vom 2026-09-06 zu Drain-Runde 2 wäre allein dafür die Kette
vorzulegen.

Die sieben zusätzlichen Blöcke kosten dreiundzwanzig Vermerke und einen einzigen
neuen Test — den Fall `(d)` in `vertex-objects-dispose.test.js`, und der ist
unten begründet. In den übrigen sechs existiert zu jedem fehlenden Buchstaben
bereits ein Test, der ihn trägt; dort ist der Zuwachs Beschriftung und nicht
Arbeit.

#### Ein Fall, der geprüft ist, und sein Test steht daneben statt drin

`sprites/TexturedSprites/TexturedSprites.spec.ts` prüft Fall `(c)` vollständig
— in `test('the convenience API answers nothing once the sprites are
disposed')` (`:62`), und der steht eine Ebene über dem `describe('dispose()')`.
Der Test deckt genau das ab, was das TSDoc von `TexturedSprites#dispose()`
zusichert: `geometry`, `material`, `spritePool` und `texture` antworten
`undefined`, `createSprite()` antwortet `undefined`, `freeSprite()` und der
`texture`-Setter tun nichts.

Verschoben wird er nicht. Der Vermerk im Block nennt ihn beim Namen, und damit
sagt der Block, was er zu sagen hat, ohne dass eine Zeile Test ihren Platz
wechselt. Eine Verschiebung brächte keine Zusicherung dazu und verschöbe die
Zeilennummern des ganzen Blocks.

#### Die vier Fälle, die einen Gegenstand haben und keinen Test

Vier von siebenundvierzig sind keine Beschriftung. Zug 0 hat für jeden an der
Fundstelle nachgesehen, ob der Fall wirklich einen Gegenstand hat und ob der
Test grün laufen wird:

| Fall | Gegenstand | Nachgesehen an |
| --- | --- | --- |
| `TextureStore.spec.ts` `(e)` | Der Store legt drei Signale an (`TextureStore.ts:120, 137, 138`, alle `{attach: this}`), und jede `TextureResource` legt Signale und, sobald `load()` gerufen wird, Effekte an (`TextureResource.ts:173-182, 407`, ebenfalls attached). `dispose()` räumt beides ab: `resource.dispose()` je Resource und `SignalGroup.delete(this)` (`TextureStore.ts:615-620`). In der Datei gibt es keinen Test dieses Musters — `getEffectsCount` wird nicht einmal importiert | `TextureStore.ts:603-621`, `TextureResource.ts:363, 407-445` |
| `InstancedVertexObjectGeometry.spec.ts` `(d)` | `dispose()` ist idempotent gebaut: `#ownedPools.clear()` und die geleerten Maps sorgen dafür, dass der zweite Lauf keinen Pool ein zweites Mal freigibt (`InstancedVOBufferGeometry.ts:404-427`). Kein Test im Repo ruft `dispose()` zweimal auf einer Geometrie | `InstancedVOBufferGeometry.ts:367-427` |
| `vertex-buffers-geometry-updates.spec.ts` `(d)` | Dasselbe für beide Klassen dieses Blocks; `VOBufferGeometry#dispose()` prüft `#ownedPools.has(this.pool)` und leert die Menge danach (`VOBufferGeometry.ts:66-88`) | `VOBufferGeometry.ts:66-88` |
| `vertex-objects-dispose.test.js` `(d)` | Die GPU-sichtbare Hälfte: ein zweiter `dispose()` schickt das three.js-Dispose-Event ein zweites Mal an den Renderer, der seine Buchhaltung für diese Geometrie schon abgeräumt hat. Ob die Freiliste sich dabei noch einmal bewegt, sieht kein Unit-Test | `VOBufferGeometry.ts:66-70` und die Kommentare der bestehenden Fälle dieser Datei |

Die beiden `(d)`-Tests in den vertex-objects-Specs sind kein Duplikat, und der
Grund gehört in den Auftrag: die beiden Blöcke prüfen dieselbe Klasse aus
verschiedenen Richtungen und haben verschiedenes Werkzeug.
`InstancedVertexObjectGeometry.spec.ts` hat `sinon` und beweist mit einem Spy,
dass der **eigene** Pool genau einmal freigegeben wird;
`vertex-buffers-geometry-updates.spec.ts` hat kein `sinon` und beweist im Idiom
seiner Datei über `isDisposed` und `usedCount`, dass ein **hereingereichter**
Pool auch beim zweiten Aufruf unberührt bleibt. Zusammen decken sie die beiden
Hälften von `(d)` ab; einzeln keine ganz.

Für alle vier gilt: die Erwartung ist grün. Läuft einer rot, ist das ein Befund
über den Code und nicht über den Test — dann geht er mit dem Wortlaut des
Fehlschlags in die Fehlerkette, und die Assertion wird nicht abgeschwächt.

- Dateien: die zwölf Blöcke aus der Tabelle mit einem Eintrag in der Spalte
  »fehlt«
- Vorgehen:

  1. **Die Form richtet sich nach der Datei.** Zwei Formen sind im Repo in
     Gebrauch, und die Grenze zwischen ihnen verläuft entlang der Testart:

     - **Kurzform** in jeder `*.spec.ts`: eine Kommentarzeile über dem Test,
       die den Fall trägt, mit dem Satz des Falls aus Abschnitt 8 im Wortlaut.
       So schreiben es die sieben vollständigen Spec-Blöcke, und so schreiben
       es die neuen.
     - **Prosaform** in den drei Browser-Tests unter
       `packages/twopoint5d-testing/test/`: dort stehen **alle** Fallnotizen
       als Block am Kopf des `describe`, vor dem ersten `it(`, und jede nennt
       den Fall, seinen Satz in Anführungszeichen und dann entweder den Test,
       der ihn trägt, oder warum er keinen Gegenstand hat. Das ist die
       Hausform dieser drei Dateien; die neuen Notizen reihen sich in den
       vorhandenen Kopfblock ein.

     Die `(f)`-Vermerke aus Paket 15 bleiben, wie sie sind — auch die vier, die
     in einer `*.spec.ts` in Prosaform stehen (`TexturedSprites`,
     `AnimatedSpritesMaterial`, `InstancedVertexObjectGeometry`,
     `vertex-buffers-geometry-updates`). Sie erklären mehr als einen Satz, und
     ihr Inhalt ist nicht wiederzubeschaffen.

  2. **Der Ort.** In den Spec-Dateien steht der Vermerk unmittelbar über dem
     `test(`, den er beschriftet, mit einer Leerzeile davor. Ein »kein
     Gegenstand«-Vermerk steht dort, wo sein Buchstabe unter den beschrifteten
     Tests fiele: `(a)` und `(b)` am Kopf des `describe`-Blocks, `(d)` und
     `(e)` am Fuß, neben dem `(f)`-Vermerk. Neue Tests stehen als letztes im
     `describe`, vor dem `(f)`-Vermerk.
     Umsortiert wird nichts: die Buchstabenfolge muss nicht von oben nach
     unten laufen, und in `VertexObjectPool.spec.ts` tut sie es auch nicht.

  3. **Die Einrückung** folgt der Datei: vier Leerzeichen in allen `*.spec.ts`,
     zwei in den Browser-Tests.

  4. **Die einunddreißig Vermerke mit dem Satz des Falls.** Wo ein Test den
     Fall trägt, lautet der Vermerk genau so, ohne Zusatz:

     ```ts
     // (a) a resource the instance built itself is released exactly once
     // (b) a resource handed in belongs to the caller and is not touched
     // (c) every public member behaves after dispose() as its TSDoc says
     // (d) the second call throws nothing and releases nothing a second time
     // (e) no signal or effect outlives the instance
     ```

     Er kommt über den Test, der in der Spalte steht. Steht dort mehr als ein
     Test, bekommt der erste den Vermerk und die übrigen keinen.

     | Datei | Fall | über dem Test |
     | --- | --- | --- |
     | `sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts` | b | `does NOT dispose an animsMap that was handed in` (`:42`) |
     | | c | `clears the animsMap reference` (`:60`) |
     | | d | `is safe to call twice` (`:86`) |
     | | e | `does not leak signals or effects` (`:69`) |
     | `sprites/TexturedSprites/TexturedSprites.spec.ts` | a | `disposes the geometry and the material it created itself` (`:80`) |
     | | b | `does NOT dispose a geometry that was handed in` (`:91`) |
     | | d | `is safe to call twice` (`:141`) |
     | | e | `does not leak signals or effects` (`:155`) |
     | `sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts` | b | `does NOT dispose a colorMap that was handed in through the constructor` (`:19`) |
     | | c | `behaves as documented after dispose()` (`:44`) |
     | | d | `is safe to call twice` (`:60`) |
     | | e | `does not leak signals or effects` (`:76`) |
     | `map2d/TileSprites/TileSpritesMaterial.spec.ts` | b | `does NOT dispose a colorMap that was handed in through the constructor` (`:19`) |
     | | c | `behaves as documented after dispose()` (`:44`) |
     | | d | `is safe to call twice` (`:58`) |
     | | e | `does not leak signals or effects` (`:74`) |
     | `sprites/AnimatedSprites/AnimatedSprites.spec.ts` | b | `does NOT dispose the geometry and the material that were handed in` (`:20`) |
     | | c | `gives up the geometry and the material references` (`:57`) |
     | | d | `is safe to call twice` (`:71`) |
     | `map2d/Map2D.spec.ts` | b | `does NOT dispose a tile renderer that was handed in` (`:33`) |
     | | c | `behaves as documented after dispose()` (`:44`) |
     | | d | `is safe to call twice` (`:64`) |
     | `texture/TextureStore.spec.ts` | a | `dispose() emits OnDispose on store and on each resource exactly once` (`:76`) |
     | | b | `does NOT dispose a renderer that was handed to the constructor` (`:125`) |
     | | d | `a second dispose() does not emit the dispose event again` (`:114`) |
     | `vertex-objects/InstancedVertexObjectGeometry.spec.ts` | a | `disposes basePool and instancedPool it built itself` (`:130`) |
     | | b | `does NOT dispose extra instanced pools when autoDispose is false` (`:164`) |
     | | c | `empties all extra-instanced bookkeeping maps` (`:190`) |
     | `vertex-objects/vertex-buffers-geometry-updates.spec.ts` | a | `a pool the geometry built itself is released` (`:680`) |
     | | b | `a pool handed in from outside stays untouched` (`:669`) |
     | | c | `the attributes of every released route leave the geometry` (`:690`) |

     Fünf Tests bekommen ausdrücklich **keinen** Buchstaben, obwohl sie in
     einem beschrifteten Block stehen: `takes the mesh out of the scene graph`
     (in `TexturedSprites.spec.ts:130` und `AnimatedSprites.spec.ts:41`) prüft
     die Reihenfolge beim Verlassen des Szenengraphen, und
     `does not throw when no animsMap was set`
     (`AnimatedSpritesMaterial.spec.ts:54`) prüft den leeren Konstruktor. Beide
     gehören zu keinem der sechs Fälle. Ebenso ohne Buchstaben bleiben
     `TextureResource.dispose() is idempotent and does not throw`
     (`TextureStore.spec.ts:108`, der Gegenstand ist eine andere Klasse, deren
     eigener Block `(d)` bereits trägt) und
     `detachInstancedPool removes the autoDispose tracking entry`
     (`InstancedVertexObjectGeometry.spec.ts:206`).

  5. **Die vier Vermerke mit eigenem Wortlaut in den Spec-Dateien.** Drei sagen
     »kein Gegenstand«, der vierte zeigt auf einen Test außerhalb des Blocks.

     `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts`,
     am Kopf des `describe('dispose()')`:

     ```ts
     // (a) has no subject here: this material builds no resource of its own — the animsMap
     // arrives through the constructor options or the setter, and the time uniform is a
     // shader node, not a resource with a dispose().
     ```

     `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`
     und
     `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`,
     je am Fuß des Blocks, über dem `(f)`-Vermerk:

     ```ts
     // (e) has no subject here: nothing in vertex-objects creates a signal or an effect.
     ```

     `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`,
     unmittelbar über dem `(d)`-Vermerk, sodass die Buchstaben in Ordnung
     bleiben — der Fall ist geprüft, sein Test steht nur nicht in diesem Block:

     ```ts
     // (c) every public member behaves after dispose() as its TSDoc says. The case is proven
     // one level up, by the test "the convenience API answers nothing once the sprites are
     // disposed": geometry, material, spritePool and texture answer undefined, createSprite()
     // answers undefined, and freeSprite() and the texture setter do nothing.
     ```

  6. **Die neun Prosanotizen in den Browser-Tests, im Wortlaut.** Sie reihen
     sich in den vorhandenen Kopfblock ein, sodass die Buchstaben dort von `a`
     bis `f` durchlaufen.

     `packages/twopoint5d-testing/test/display-dispose.test.js`, zwischen der
     `(b)`- und der `(e)`-Notiz:

     ```js
     // Assertion (c) — "every public member behaves after dispose() as its TSDoc says" — is
     // what most of the cases below are: canvas, start(), getEventProps(), isWebGPUBackend
     // and isWebGLBackend throw, resize(), renderFrame() and stop() are silent, and the
     // disposed state with the last values it kept stays readable.

     // Assertion (d) — "the second call throws nothing and releases nothing a second time" —
     // is the case "a second dispose() throws nothing and emits nothing" below.
     ```

     `packages/twopoint5d-testing/test/pan-control-dispose.test.js`, zwischen
     der `(b)`- und der `(e)`-Notiz:

     ```js
     // Assertion (c) — "every public member behaves after dispose() as its TSDoc says" — is
     // what the cases below are about: a disposed control ignores keyboard and pointer, hooks
     // nothing up again through subscribe(), delivers no pan collected before dispose() and
     // cannot be brought back through its public setters.

     // Assertion (d) — "the second call throws nothing and releases nothing a second time" —
     // is the case "is safe to call twice" below.
     ```

     `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js`, **vor**
     der vorhandenen `(f)`-Notiz (Zeile 95), sodass sie am Ende steht:

     ```js
     // Assertion (a) of the dispose test pattern in
     // packages/twopoint5d/docs/resource-lifecycle.md — "releases what it built itself" — is
     // what this file is for. Every geometry below builds its pools from a descriptor, and
     // the cases watch the gpu buffers behind their attributes reach the renderer's free
     // list, which no unit test can see.

     // Assertion (b) — "does not touch what was handed in" — has no subject here: no geometry
     // in these tests is handed a pool, every one of them builds its own.

     // Assertion (c) — "every public member behaves after dispose() as its TSDoc says" — is
     // covered by the attribute and index checks the cases below carry: a disposed geometry
     // answers with no attributes and a null index.

     // Assertion (d) — "the second call releases nothing a second time" — is the case "a
     // second dispose() frees nothing a second time" below. That the call throws nothing is
     // a unit test; that the renderer's free list does not move again is only visible here.

     // Assertion (e) — "leaks no signals and no effects" — has no subject: nothing in
     // vertex-objects creates a signal or an effect.
     ```

  7. **Die vier neuen Tests im Wortlaut.** Zeilenumbrüche dürfen der
     Prettier-Breite folgen, der Inhalt nicht.

     `packages/twopoint5d/src/texture/TextureStore.spec.ts` — als letztes im
     `describe('dispose()')`, vor dem `(f)`-Vermerk. Der Import in Zeile 2
     bekommt `getEffectsCount` dazu:

     ```ts
     // (e) no signal or effect outlives the instance
     test('does not leak signals or effects', () => {
       const baselineSignals = getSignalsCount();
       const baselineEffects = getEffectsCount();

       const store = new TextureStore();
       store.parse({defaultTextureClasses: [], items: {a: {imageUrl: 'a.png'}}});

       // subscribing is what makes the resource load(), and load() is where the effects come
       // from; without a renderer there is no texture factory, so the effect reaches no loader
       store.on('a', 'texture', () => {});

       expect(getSignalsCount()).toBeGreaterThan(baselineSignals);
       expect(getEffectsCount()).toBeGreaterThan(baselineEffects);

       store.dispose();

       expect(getSignalsCount()).toBe(baselineSignals);
       expect(getEffectsCount()).toBe(baselineEffects);
     });
     ```

     `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`
     — als letztes im `describe('dispose()')`, vor dem `(f)`-Vermerk:

     ```ts
     // (d) the second call throws nothing and releases nothing a second time
     test('is safe to call twice', () => {
       const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
       const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

       const baseDispose = sandbox.spy(geometry.basePool!, 'dispose');
       const instancedDispose = sandbox.spy(geometry.instancedPool!, 'dispose');
       const extraDispose = sandbox.spy(extraPool, 'dispose');

       expect(() => {
         geometry.dispose();
         geometry.dispose();
       }).not.toThrow();

       expect(baseDispose.calledOnce).toBe(true);
       expect(instancedDispose.calledOnce).toBe(true);
       expect(extraDispose.calledOnce).toBe(true);
     });
     ```

     `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`
     — als letztes im `describe('dispose')`, vor dem `(f)`-Vermerk. Diese Datei
     kennt kein `sinon`, der Beweis läuft über den hereingereichten Pool:

     ```ts
     // (d) the second call throws nothing and releases nothing a second time
     test('a second dispose() throws nothing and leaves a pool from outside alone', () => {
       const handedIn = new VertexObjectPool<MyInstancedVO>(instancedDesc, 10);
       handedIn.createVO();

       const instanced = new InstancedVertexObjectGeometry<MyInstancedVO, MyBaseVO>(handedIn, 10, baseDesc, 1);
       const {basePool} = instanced;

       expect(() => {
         instanced.dispose();
         instanced.dispose();
       }).not.toThrow();

       expect(handedIn.isDisposed).toBe(false);
       expect(handedIn.usedCount).toBe(1);
       expect(basePool!.isDisposed).toBe(true);

       const plain = new VertexObjectGeometry<MyBaseVO>(baseDesc, 10);
       const {pool} = plain;

       expect(() => {
         plain.dispose();
         plain.dispose();
       }).not.toThrow();

       expect(pool.isDisposed).toBe(true);
     });
     ```

     `packages/twopoint5d-testing/test/vertex-objects-dispose.test.js` — als
     letztes `it(` des Blocks, nach `a rendered geometry disposes after a route
     was replaced by one with other attributes`:

     ```js
     it('a second dispose() frees nothing a second time', async function () {
       const attributesBefore = await attributesBaseline();
       const geometry = new VertexObjectGeometry(quadDescription, 8);
       geometry.pool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
       await renderOnce(new VertexObjects(geometry, new MeshBasicMaterial()));

       geometry.dispose();

       expect(() => geometry.dispose()).to.not.throw();

       // the free list moved once and stays where it is
       expect(display.renderer.info.memory.attributes).to.equal(attributesBefore);
     });
     ```

  8. **Was in diesem Paket nicht passiert**, ausdrücklich, weil jede der fünf
     Versuchungen naheliegt:

     - Kein bestehender Test wird verschoben, umbenannt, umsortiert oder in
       seinen Assertionen verändert. Ein `(c)`-Test, der weniger prüft, als das
       TSDoc der Klasse zusichert, ist trotzdem ein `(c)`-Test: dieses Paket
       sagt, dass ein Fall geprüft wird, es vertieft die Prüfung nicht.
     - Kein Produktivcode wird angefasst. Siebenundvierzig Kommentare und vier
       Tests, sonst nichts.
     - `docs/resource-lifecycle.md` wird nicht angefasst. Abschnitt 8 trägt
       alle sechs Fälle samt Skelett.
     - Kein CHANGELOG-Eintrag. An der ausgelieferten Bibliothek ändert sich
       nichts; die `[Unreleased]`-Sektion beschreibt Verhalten, keine Tests.
     - Kein roter Lauf vor den vier neuen Tests. Sie belegen Verhalten, das
       schon da ist, und beheben keinen Korrektheitsfehler; die Konvention
       »Bugfix heißt Test zuerst« greift hier nicht. Läuft einer rot, ist er
       damit ein Befund und geht in die Fehlerkette, statt angepasst zu werden.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` —
  `test:browser` gehört dazu, weil drei der geänderten Dateien Browser-Tests
  sind und einer davon einen neuen Fall bekommt; der Nx-Cache für dieses Target
  fällt damit, und der Lauf findet wirklich statt.
- Commit: `test(twopoint5d): say for every dispose test block which of its cases it proves`
- Ergebnis: 2 Runden · alle zwölf unvollständigen Dispose-Test-Blöcke tragen
  jetzt jeden der sechs Fälle aus Abschnitt 8 der Richtlinie, sieben waren schon
  vollständig · 47 Vermerke und 5 neue Tests (`TextureStore` »does not leak
  signals or effects«, `InstancedVertexObjectGeometry` »is safe to call twice«
  und »does NOT dispose an instanced pool that was handed in through the
  constructor«, `vertex-buffers-geometry-updates` »a second dispose() throws
  nothing and leaves a pool from outside alone«,
  `vertex-objects-dispose.test.js` »a second dispose() frees nothing a second
  time«) · kein Regressionstest, weil das Paket keinen Korrektheitsfehler behebt
  und die fünf neuen Tests vorhandenes Verhalten belegen · Punkt 4 des Vorgehens
  oben ist an einer Stelle überholt: der Fall `(b)` in
  `InstancedVertexObjectGeometry.spec.ts` steht nicht über »does NOT dispose
  extra instanced pools when autoDispose is false« — dieser Test reicht einen
  Deskriptor herein und die Geometrie baut den Pool selbst, er belegt also das
  Eigentumsflag und nicht die Übergabe; er trägt jetzt keinen Buchstaben, und
  `(b)` steht über dem neuen Test, der dem Konstruktor eine
  `VertexObjectPool`-Instanz hereinreicht · ebenso überholt: der `(d)`-Vermerk
  im Kopfblock von `vertex-objects-dispose.test.js` zitiert den vollen Satz aus
  Abschnitt 8, und der Test dort hält drei Messungen statt einer fest, sodass
  sein Kommentar »the free list moved once and stays where it is« beide Hälften
  belegt · klein: der Kopfblock von `vertex-objects-dispose.test.js` zitiert
  Abschnitt 8 in zweierlei Maß — `(d)` wörtlich, `(a)`, `(b)` und `(e)` in
  Kurzfassung; klein: dieselbe Datei misst die Freiliste unmittelbar nach dem
  zweiten `dispose()` ohne weiteren Frame, was eine Freigabe verpasste, die ein
  Backend erst beim nächsten Render abarbeitet — das ist das Idiom der ganzen
  Datei
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: keine — das Paket fasst keinen Produktivcode an

#### Was frühere Pakete zu diesem Paket festgehalten haben

Diese Notizen standen im Grobplan und in Paket 15; Zug 0 hat jede an der
Fundstelle bestätigt.

Paket 15 hat in allen fünf ursprünglich genannten Blöcken allein den Fall `(f)`
nachgezogen und die Fälle `(a)` bis `(e)` ausdrücklich diesem Paket überlassen.
Vier der fünf `(f)`-Vermerke stehen dort in Prosaform, weil ein einzelner
Buchstabe sich nicht von selbst erklärt; `TextureStore.spec.ts` trug bereits
ein `(c)` und bekam deshalb die Kurzform. Alle fünf bleiben unverändert
stehen, auch wenn der Block nach diesem Paket alle sechs trägt.

Die drei Blöcke aus Paket 17 tragen laut dessen Detailplan keine
Fallbuchstaben, weil das Muster aus Abschnitt 8 der Klasse mit eigenem
`dispose()` gehört und nicht dem Block über eine fremde entsorgte Instanz.
Ebenso bleibt `describe('update() after dispose()')` unbeschriftet (Paket 15).

### [x] 19. vertex-objects: die letzten offenen Türen am entsorgten Pool

- Folge von: Paket 17 (die TSDoc-Sätze an `VOBufferPool#clear()`,
  `VertexObjectPool#containsVO()` und `#freeVO()` versprechen unbedingt, was
  an einem entsorgten Pool geschieht; der offene `usedCount`-Setter und
  `VOUtils.setBuffer()` widerlegen sie)
- Nebenbefund: aus Paket 17 (zwei Einträge der Queue: das öffentliche,
  schreibbare Feld `VOBufferPool#buffer` lässt einem entsorgten Pool einen
  frischen Buffer unterschieben (medium); das TSDoc von
  `VOBufferGeometry#dispose()` sagt nicht, was danach stehenbleibt (low))
- Ziel: Ein entsorgter Pool lässt sich auf keinem öffentlichen Weg mehr
  wiederbeleben — weder über `buffer` noch über `usedCount` noch über
  `VOUtils.setBuffer()` —, und jeder TSDoc-Satz zum Verhalten nach `dispose()`
  in vertex-objects stimmt mit dem Code überein.
- Bereich: `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`,
  `VertexObjectPool.ts`, `VOBufferGeometry.ts`, `VOUtils.ts` und Specs
- Hängt ab von: 17
- Hash: f90dbbf
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`
  - `packages/twopoint5d/src/vertex-objects/VOUtils.ts`
  - `packages/twopoint5d/src/vertex-objects/VOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify:
  `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser && pnpm build && pnpm checkPkgTypes && pnpm checkNameableTypes`
  — die ersten vier wie in Paket 14 und 17. Die drei hinteren kommen dazu, weil
  `VOBufferPool#buffer` von einem Feld zu einem Accessor-Paar wird: das ist die
  einzige Änderung dieses Pakets, die die Form eines öffentlichen Members in der
  ausgelieferten `.d.ts` verschiebt, und `checkPkgTypes` sowie
  `checkNameableTypes` laufen gegen `dist/`, brauchen also den Build davor.
  `test:browser` ist hier wieder billiger Beleg als in Paket 17 — alle vier
  Guards sind CPU-seitig, siehe Entscheidung 6 — läuft aber mit, weil jede
  Geometrie der drei Browser-Tests über einen Pool entsteht. `typecheck` deckt
  die Specs mit ab (`pnpm build` lässt `*.spec.ts` aus). Nicht aus dem Nx-Cache:
  die Baseline im Kopf des Plans kam von dort, und ein Cache-Treffer belegt
  nichts über diesen Diff.
- Commit: `fix(vertex-objects): let a disposed pool refuse a fresh buffer, a fresh count and a vertex object put back`

#### Abgleich am Code, Zug 0 (2026-09-06)

Alle drei Einträge bestehen. Einer trägt eine überholte Begründung, die hier
richtiggestellt wird; der Sachverhalt bleibt.

**Folge aus Paket 17 — die drei TSDoc-Sätze.** Alle drei stehen wörtlich im
Code und sind alle drei falsifizierbar:

| Fundstelle | Der Satz | Womit er fällt |
| --- | --- | --- |
| `VOBufferPool.ts:102-105` (`clear()`) | »On a disposed pool it is a no-op without effect — the count is already `0` and stays there« | `pool.dispose(); pool.usedCount = 3; pool.clear()` — der Setter (`:57-59`) nimmt jeden Wert, also hat `clear()` sehr wohl eine Wirkung |
| `VertexObjectPool.ts:138-145` (`containsVO()`) | »`false` on a disposed pool, which has unlinked every vertex object it handed out« | `VOUtils.setBuffer(vo, pool.buffer)` hängt das Objekt an die Hülle zurück, und `containsVO()` vergleicht nichts als diese beiden (`:144`) |
| `VertexObjectPool.ts:164-194` (`freeVO()`) | »A silent no-op on a disposed pool, which turns every vertex object away through `containsVO`« | fällt mit dem darüber: kommt `containsVO()` durch, läuft `freeVO()` durch bis `usedCount--` (`:191`) und `VOUtils.clearBuffer(vo)` (`:193`) |

**Nebenbefund `VOBufferPool.ts:25` — das schreibbare `buffer`.** Der
Sachverhalt besteht unverändert: `buffer: VertexObjectBuffer` ist ein
öffentliches Feld ohne jeden Guard. Die Begründung des Eintrags stimmt so nicht
mehr, und das ändert nichts an seinem Gewicht: die drei dort genannten Methoden
`createFromAttributes()`, `toBuffersData()` und `fromBuffersData()` werfen seit
Paket 14 an einem entsorgten Pool (`:144`, `:160`, `:185`) und rühren einen
untergeschobenen Buffer gar nicht mehr an. Was übrig ist, wiegt trotzdem: eine
Zuweisung widerlegt das TSDoc des Feldes selbst (`:21-23`, »The same
`VertexObjectBuffer` once `dispose()` has run«), und sie macht aus
`containsVO()`/`freeVO()` wieder arbeitende Methoden — dieselbe Tür, die die
Folge aus Paket 17 von der anderen Seite aufmacht.

**Nebenbefund `VOBufferGeometry.ts:58-65` — das TSDoc von `dispose()`.**
Besteht. Der Kommentar sagt, was freigegeben wird, und nichts darüber, was
danach stehenbleibt. Die Schwesterklasse tut es, mit einem eigenen Absatz
(`InstancedVOBufferGeometry.ts:361-364`).

**Gegenprobe: welche Tür ist danach noch offen?** Jedes öffentliche Member
beider Pool-Klassen einzeln an einem entsorgten Pool durchgesehen. Zu bleiben
hat nichts:

- `descriptor`, `capacity`: `readonly`, und die eine Stelle, die `capacity` über
  `Object.defineProperty` neu setzt, steht in `resize()` (`VertexObjectPool.ts:109`)
  hinter dessen Wurf (`:50-52`).
- `availableCount` → `0`, `isDisposed` → `true`, `isAttachedToGeometry` → `false`,
  `createVO()`/`getVO()` → `undefined`, `resize()`/`createFromAttributes()`/
  `toBuffersData()`/`fromBuffersData()` werfen. Alle aus Paket 14 und 17.
- `attachGeometry()` (`@internal`) erhöht den Zähler auch an einem entsorgten
  Pool, aber die drei Aufrufer sind die beiden Geometrie-Konstruktoren und
  `attachInstancedPool()`, und die drei weisen einen entsorgten Pool seit
  Paket 17 an der Tür ab. `isAttachedToGeometry` antwortet ohnehin `false`.
- `onCreateVO` ist ein öffentliches, schreibbares Feld und bleibt es: der Hook
  wird nur aus `#createVO()` gerufen, und beide Wege dorthin (`createVO()`,
  `getVO()`) sind zu. Sein TSDoc (`VertexObjectPool.ts:19-23`) sagt genau das.
- `pool.buffer.buffers` ist eine `readonly`-Referenz auf eine mutierbare `Map`,
  ein Aufrufer kann also von Hand einen `AttributeBuffer` hineinlegen. Das ist
  keine Wiederbelebung des Pools — `#released` im Buffer bleibt gesetzt, seine
  vier werfenden Methoden werfen weiter, und `getVO()`/`createVO()` bleiben
  stumm. Es ist eine Kapselungsfrage, die jede `readonly`-Map dieser Klasse
  gleichermaßen hat (`bufferAttributes`, `bufferNameAttributes`), und sie gehört
  nicht in dieses Paket.

Nach den Schritten unten ist der Satz »ein entsorgter Pool kommt auf keinem
öffentlichen Weg zurück« vollständig gedeckt.

#### Entscheidungen

Getroffen mit dem Code vor Augen. Sie stehen hier und nicht im Kopf des Plans.

1. **Beide Setter fallen durch, sie werfen nicht.** `buffer` und `usedCount`
   nehmen an einem entsorgten Pool nichts mehr an, still. Abschnitt 4 der
   Richtlinie entscheidet das und nicht der Geschmack: Regel 1 und 2 handeln vom
   Lesen (»answers `undefined`«, »a read after `dispose()` raises«), Regel 3 vom
   Schreiben — »a mutating method with nothing left to act on is a silent
   no-op«.

   Der Ausnahmesatz von Regel 3 greift bei keinem der beiden: er gilt einer
   Methode, »that already turns invalid input away«. Genau darauf hat Paket 14
   den Wurf von `resize()` gestützt (Entscheidung 3 dort: die Methode weist eine
   nicht-ganzzahlige Kapazität und jede Änderung an einer Geometrie schon heute
   zurück). `buffer =` weist nichts zurück, und `usedCount =` klemmt seinen Wert,
   statt ihn abzulehnen.

   Der Präzedenzfall steht in diesem Lauf: Paket 12 hat `StageRenderer#pipeline`
   und `Canvas2DStage#fit` genau so entschieden, und der CHANGELOG-Eintrag von
   Paket 12 gibt sogar den Wortlaut her, den dieses Paket wiederverwendet — »a
   write to `pipeline` falls through, so the getter keeps answering `undefined`«.

   Was gegen den Wurf spricht, ist außerdem ein praktischer Punkt: ein
   werfender `usedCount`-Setter trifft auch `pool.usedCount = 0`, also den
   Aufruf, der gar nichts ändern wollte, und ein werfender `buffer`-Setter wäre
   die einzige neue Ausnahme dieses Laufs an einer Stelle, die heute stumm
   annimmt. Die Auskunft, die ein Aufrufer danach bekommt, ist in beiden Fällen
   wahr und benannt: `usedCount` sagt `0`, und `pool.buffer` gibt die Hülle,
   deren Methoden seit Paket 17 mit Klasse, Methode und Zustand werfen.

2. **`buffer` wird ein Accessor-Paar, kein `@internal`-Setzweg.** Das private
   `#buffer` trägt den Wert, der Getter gibt ihn heraus, der Setter hat den
   Guard. Beide Schreiber im Produktionscode sind nachgesehen und beide
   arbeiten an einem lebenden Pool: der Konstruktor (`VOBufferPool.ts:36`, `:41`)
   und `VertexObjectPool#resize()` (`:84`), das an einem entsorgten Pool schon in
   Zeile 50 wirft. Ein zweiter, geschützter Setzweg wäre also Fläche für
   niemanden. Der Konstruktor schreibt trotzdem direkt auf `#buffer` statt durch
   den Setter — dort ist der Guard ohne Gegenstand, und die direkte Zuweisung in
   beiden Zweigen macht das Feld für TypeScript sicher zugewiesen.

   Dass `resize()` in der Unterklasse steht und `#buffer` nicht sehen kann, ist
   keine Hürde, sondern der Beleg dafür, dass der öffentliche Setter der richtige
   Weg ist: er geht über den Prototyp, und `VertexObjectPool` deklariert kein
   eigenes `buffer`, das ihn verdecken würde.

3. **Kein Guard in `VOUtils.setBuffer()`, und `VertexObjectBuffer` bekommt kein
   `isReleased`.** Der Guard gehört dorthin, wo die Zusage gemacht wird, und die
   macht der Pool. `VOUtils` ist eine Sammlung von Symbolzugriffen ohne jeden
   Zustandsbegriff — ihre sieben Methoden prüfen alle nichts —, und ihr einen zu
   geben hieße, `#released` in die öffentliche Fläche zu heben. Genau das hat
   Paket 17 in seiner Entscheidung 2 abgelehnt, und Paket 14 hat in seiner
   Entscheidung 6 aus demselben Grund den Guard an den Pool gesetzt und nicht an
   den Buffer. Die Tür, um die es geht, schließt der Guard in `containsVO()`:
   danach ist es gleichgültig, worauf ein Vertex Object zeigt.

   `setBuffer()` bekommt dafür einen TSDoc-Satz, der seine Grenze benennt. Die
   übrigen sechs Methoden von `VOUtils` bleiben ohne TSDoc — eine Utility
   flächendeckend zu dokumentieren ist ein eigenes Paket, und keins, das dieser
   Lauf noch aufmacht.

4. **`clear()` und `freeVO()` behalten ihr TSDoc unverändert.** Beide Sätze
   werden durch die Schritte unten wahr, ohne dass eine Silbe daran zu ändern
   wäre: `clear()` schreibt durch den `usedCount`-Setter und wird damit von
   selbst der No-op, den es verspricht, und `freeVO()` kommt nach dem Guard in
   `containsVO()` nie mehr an seiner ersten Zeile vorbei. Das steht hier, damit
   es im Review nicht als vergessene Stelle aufgemacht wird: die Zusage wird im
   Code eingelöst, nicht im Satz abgeschwächt.

5. **Das TSDoc von `VOBufferGeometry#dispose()` bekommt den Absatz der
   Schwesterklasse, wörtlich.** Zwei Klassen mit demselben Vertrag sagen ihn mit
   denselben Worten; eine eigene Formulierung für dieselbe Sache lässt einen
   Leser nach dem Unterschied suchen, den es nicht gibt. Der Satz stimmt für
   beide: bei `VOBufferGeometry` löscht `#releaseSlots()` (`:91-97`) den Serial
   jedes Attributs, das mit der einen Route geht, und was übrig bleibt, gehört
   Attributen, die ein Aufrufer selbst auf die Geometrie gesetzt hat.

6. **Kein Browser-Test kommt dazu.** Dieselbe Lage wie in Paket 14 und 17: es
   entsteht, wandert und stirbt kein einziges `THREE.BufferAttribute` anders.
   Alle vier Guards sitzen CPU-seitig und verweigern Arbeit, statt sie anders zu
   tun. Das Verify fährt `test:browser` trotzdem.

7. **`docs/resource-lifecycle.md` bleibt unberührt.** Regel 3 in Abschnitt 4
   trägt beide Setter schon, und Paket 12 hat auf ihrer Grundlage bereits zwei
   entschieden, ohne die Richtlinie zu erweitern. Ein drittes Beispiel unter
   derselben Regel ist Wiederholung.

#### Vorgehen

1. **Zuerst die Regressionstests, und sie werden rot gesehen.** Alle vier in
   `VertexObjectPool.spec.ts`, in den bestehenden `describe('dispose()')`-Block
   (ab `:710`), ans Ende vor den Kommentar `// (e) has no subject here` (`:931`).
   Jeder trägt darüber die Zeile, die der Block durchgehend führt:
   `// (c) every public member behaves after dispose() as its TSDoc says`.
   `VertexObjectBuffer` steht noch nicht in den Importen der Datei und kommt
   dazu.

   ```ts
   // (c) every public member behaves after dispose() as its TSDoc says
   test('VOBufferPool: a write to buffer falls through on a disposed pool', () => {
     const pool = new VOBufferPool(descriptor, 10);
     const spent = pool.buffer;

     pool.dispose();

     pool.buffer = new VertexObjectBuffer(descriptor, 10);

     expect(pool.buffer, 'a disposed pool keeps the buffer it was disposed with').toBe(spent);
     expect(pool.buffer.buffers.size).toBe(0);
   });

   // (c) every public member behaves after dispose() as its TSDoc says
   test('VOBufferPool: a write to usedCount falls through on a disposed pool, and clear() stays a no-op', () => {
     const pool = new VOBufferPool(descriptor, 10);

     pool.createFromAttributes({bar: [1, 1, 1, 1, 2, 2, 2, 2]});
     expect(pool.usedCount).toBe(2);

     pool.dispose();
     expect(pool.usedCount).toBe(0);

     pool.usedCount = 3;
     expect(pool.usedCount, 'a disposed pool takes no count').toBe(0);

     expect(() => pool.clear()).not.toThrow();
     expect(pool.usedCount).toBe(0);
   });

   // (c) every public member behaves after dispose() as its TSDoc says
   test('VertexObjectPool: containsVO() answers false on a disposed pool, whatever the vertex object points at', () => {
     const pool = new VertexObjectPool<MyVertexObject>(descriptor, 5);
     const vo = pool.createVO()!;

     pool.dispose();

     VOUtils.setBuffer(vo, pool.buffer);

     expect(pool.containsVO(vo)).toBe(false);
   });

   // (c) every public member behaves after dispose() as its TSDoc says
   test('VertexObjectPool: freeVO() stays a no-op on a disposed pool', () => {
     const pool = new VertexObjectPool<MyVertexObject>(descriptor, 5);
     const vo = pool.createVO()!;

     pool.dispose();

     VOUtils.setBuffer(vo, pool.buffer);

     expect(() => pool.freeVO(vo)).not.toThrow();
     expect(pool.usedCount).toBe(0);
     expect(VOUtils.getBuffer(vo), 'freeVO() did not touch the vertex object').toBe(pool.buffer);
   });
   ```

   Erwartet rot, je an einer benannten Stelle: Test 1 an der ersten Assertion
   (der frische Buffer kommt an), Test 2 an `'a disposed pool takes no count'`
   (`3` kommt an), Test 3 an `containsVO()` (`true`), Test 4 an der dritten
   Assertion (`freeVO()` hat `clearBuffer()` gerufen, `getBuffer()` ist
   `undefined`). Der rote Lauf gehört in den Report, mit den Meldungen.

2. **`VOBufferPool.ts` — `buffer` wird ein Accessor-Paar.** An der Stelle, an
   der heute das Feld steht (`:18-25`), damit sein TSDoc dort bleibt und den
   Absatz zum Setter dazubekommt:

   ```ts
   /**
    * The buffer every vertex object of this pool reads and writes through.
    *
    * The same {@link VertexObjectBuffer} once {@link dispose} has run, but one without data: it
    * holds no `typedArray` and no entry in `buffers` any more, and every method of it that would
    * read or write through an array throws.
    *
    * A write falls through on a disposed pool: a pool that has given up its buffers takes no
    * fresh one, and the getter goes on answering the buffer the pool was disposed with.
    */
   get buffer(): VertexObjectBuffer {
     return this.#buffer;
   }

   set buffer(buffer: VertexObjectBuffer) {
     // a disposed pool that took a fresh buffer would let vertex objects work on it again
     if (this.#disposed) return;
     this.#buffer = buffer;
   }
   ```

   `#buffer: VertexObjectBuffer;` kommt zu den privaten Feldern (`:27-29`). Im
   Konstruktor werden beide Zuweisungen (`:36`, `:41`) auf `this.#buffer`
   umgestellt; die Zuweisung an `this.usedCount` in `:42` bleibt, wie sie ist.

3. **`VOBufferPool.ts` — der `usedCount`-Setter nimmt an einem entsorgten Pool
   nichts mehr an.** Das TSDoc (`:51-56`) wird ersetzt, es sagt heute das
   Gegenteil:

   ```ts
   /**
    * Takes every value a live pool can hold, clamped to `0` … {@link capacity}.
    *
    * A write falls through on a disposed pool, which has no slot left to count: the getter
    * goes on answering `0`.
    */
   set usedCount(value: number) {
     if (this.#disposed) return;
     this.#usedCount = Math.max(0, Math.min(value, this.capacity));
   }
   ```

4. **`VOBufferPool.ts` — `dispose()` schreibt den Zähler direkt.** In `:130`
   wird `this.usedCount = 0` zu `this.#usedCount = 0`, mit dem Grund als
   Kommentar daneben:

   ```ts
   // straight to the field: the setter turns a disposed pool away, and this is the write
   // that makes it one
   this.#usedCount = 0;
   ```

   Das ist die Stelle, an der Paket 14 (Entscheidung 5) und Paket 17
   (Entscheidung 4) den Setter offengelassen haben — die Begründung war die
   Reihenfolgeabhängigkeit, die genau diese Zeile auflöst. Der Getter `usedCount`
   (`:46-49`) behält sein TSDoc; es stimmt weiterhin.

5. **`VertexObjectPool.ts` — `containsVO()` bekommt den Guard** und einen Satz,
   der ohne Vorbehalt gilt (`:138-145`):

   ```ts
   /**
    * Whether this vertex object reads and writes through the buffer of this pool.
    *
    * `false` on a disposed pool, whatever a vertex object points at: a pool that has given up
    * its buffers holds none of them any more, and putting one back afterwards does not change
    * that.
    */
   containsVO(vo: VO): boolean {
     if (this.isDisposed) return false;
     return VOUtils.isBuffer(vo, this.buffer);
   }
   ```

6. **`VertexObjectPool.spec.ts:918-929` — der Kommentar im bestehenden Test wird
   richtiggestellt.** Der Test selbst bleibt grün und bleibt stehen; die Zeile
   `// the setter takes every value, on a disposed pool as well — nothing may come out of it`
   (`:925`) sagt nach Schritt 3 das Gegenteil des Codes und wird zu:

   ```ts
   // the write falls through, and even a count that came through must not produce a vertex object
   ```

   Sein Name (`getVO() answers nothing after usedCount was written on a disposed pool`) trägt
   weiter: geschrieben wird, angekommen ist etwas anderes, und `getVO()` bleibt
   in beiden Fällen stumm.

7. **`VOUtils.ts` — `setBuffer()` sagt, was es nicht prüft** (`:33-36`):

   ```ts
   /**
    * Links a vertex object to a buffer, or to nothing.
    *
    * The buffer is taken as it comes: this says nothing about the pool behind it. A disposed
    * pool does not take a vertex object back through this call — its `containsVO()` answers
    * `false` whatever the object points at.
    */
   ```

   Die übrigen sechs Methoden der Klasse bleiben unangetastet.

8. **`VOBufferGeometry.ts` — das TSDoc von `dispose()` sagt, was stehenbleibt.**
   An den bestehenden Kommentar (`:58-65`) kommt der Absatz, den
   `InstancedVOBufferGeometry` an derselben Stelle führt (`:361-364`), wörtlich:

   ```
    * After this call the geometry holds no route, no buffer and no pool of its own any more.
    * What stays behind belongs to the attributes that are still there: their serials from the
    * last `update()`, plus `#firstAutoTouch`.
   ```

9. **`CHANGELOG.md` — der bestehende Eintrag wächst, es kommt keiner dazu.**
   Unter `## [Unreleased]` → `### Changed` steht der Eintrag, der mit »a disposed
   `VOBufferPool` hands out nothing and cannot be brought back into service«
   beginnt und mit »… and `capacity`, `descriptor` and `usedCount` keep saying
   what this pool is« endet. Er beschreibt denselben Vertrag und bekommt diese
   Sätze angehängt:

   ```
   A write to `usedCount` or to `buffer` falls through, so `usedCount` goes on answering `0`
   and `buffer` goes on answering the buffer the pool was disposed with, and
   `VertexObjectPool#containsVO()` answers `false` whatever a vertex object points at, which
   keeps `freeVO()` the no-op it says it is. `buffer` is an accessor pair on the prototype
   now; reading and writing it on a live pool is unchanged.
   ```

   Kein zweiter Eintrag für Schritt 8: ein TSDoc-Absatz ändert kein Verhalten.
   Kein Eintrag unter `### Migration Guide`: an einem lebenden Pool bleibt jeder
   Aufruf, was er war, und die Typform bleibt lesbar wie schreibbar.

10. **Sonst nichts.** Kein Guard in `VOUtils` (Entscheidung 3), kein
    `isReleased` auf `VertexObjectBuffer` (Entscheidung 3), keine Zeile in
    `docs/resource-lifecycle.md` (Entscheidung 7), kein Browser-Test
    (Entscheidung 6), keine Änderung an `clear()` und `freeVO()`
    (Entscheidung 4).

11. **Verify selbst fahren**, die ganze Kette, Ausgabe ins Log des
    Arbeitsverzeichnisses. Nicht aus dem Nx-Cache.

- Ergebnis: 1 Runde · alle drei TSDoc-Sätze der Folge aus Paket 17 eingelöst
  (`clear()` und `freeVO()` wortgleich stehengelassen, `containsVO()` neu
  gefasst), beide Queue-Einträge behoben · Regressionstests
  `VOBufferPool: a write to buffer falls through on a disposed pool`,
  `VOBufferPool: a write to usedCount falls through on a disposed pool, and clear() stays a no-op`,
  `VertexObjectPool: containsVO() answers false on a disposed pool, whatever the vertex object points at`
  und `VertexObjectPool: freeVO() stays a no-op on a disposed pool` (alle vier vor
  dem Fix rot, `4 failed | 46 passed`, danach `50 passed`) · Verify exit 0,
  `paket-19.verify.log`, die vier mittleren Targets ohne Nx-Cache · Abweichung
  vom Detailplan: im Testcode `new VertexObjectBuffer(pool.descriptor, 10)` statt
  `new VertexObjectBuffer(descriptor, 10)`, weil `descriptor` in der Spec ein
  `VertexObjectDescription` ist und kein `VertexObjectDescriptor` · Runde 1 hat
  den einen wichtigen Befund geschlossen (`CHANGELOG.md:87` zählte `dispose()`
  als Schreibweg durch den `usedCount`-Setter auf) · klein und offen gelassen:
  die Aufzählung in `CHANGELOG.md:87` liest sich erschöpfend, nennt aber den
  Konstruktor-Pfad, `resize()`, `createVO()` und `freeVO()` nicht mit; das TSDoc
  von `VOBufferPool#dispose()` (`:129-135`) zählt die beiden durchfallenden
  Setter und `containsVO()` nicht in seiner Liste auf
- Nebenbefunde: → Queue (2 Einträge, beide → Audit)
- Folgen: keine — beide Schreiber auf `pool.buffer` im Repo sitzen an einem
  lebenden Pool oder hinter einem Wurf (`VertexObjectPool.ts:84` in `resize()`),
  `VOUtils.setBuffer()` hat außerhalb der Specs keinen Aufrufer, der einen
  entsorgten Pool erreicht, und die Typform bleibt lesbar wie schreibbar
  (`checkPkgTypes` und `checkNameableTypes` grün)
- Schnittstellen: `VOBufferPool#buffer` ist ein Accessor-Paar auf dem Prototyp
  statt eines Feldes; an einem lebenden Pool bleibt Lesen wie Schreiben
  unverändert, an einem entsorgten fällt das Schreiben still durch und der
  Getter antwortet weiter mit der Hülle, mit der der Pool entsorgt wurde ·
  ebenso fällt ein Schreibzugriff auf `VOBufferPool#usedCount` an einem
  entsorgten Pool durch, der Getter bleibt bei `0`, und `clear()` ist damit der
  No-op, den sein TSDoc verspricht · `VOBufferPool#dispose()` schreibt den
  Zähler direkt auf das private Feld, weil der Setter einen entsorgten Pool
  abweist und genau dieser Schreibvorgang ihn dazu macht ·
  `VertexObjectPool#containsVO()` antwortet `false` an einem entsorgten Pool,
  gleich worauf ein Vertex Object zeigt, und `freeVO()` kommt damit nie an
  seiner ersten Zeile vorbei · `VOUtils.setBuffer()` prüft weiterhin nichts und
  sagt das jetzt in seinem TSDoc — der Guard sitzt am Pool, nicht am Buffer und
  nicht in `VOUtils` · das TSDoc von `VOBufferGeometry#dispose()` trägt den
  Absatz seiner Schwesterklasse wörtlich
