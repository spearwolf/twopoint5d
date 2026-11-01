# Remediation-Plan — twopoint5d

Quelle: ./audit.html vom 2026-10-31 · Branch: main · erstellt: 2026-10-31
Baseline: `pnpm run ci` ✓ (exit 0; enthält lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:allocations, test:browser)
Verify-Kommando je Paket und im Abschluss: `pnpm run ci`
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 92 von 92 Findings (2 high, 13 medium, 70 low, 7 info; die 19 des Abschnitts »Optimierungspotenzial« eingeschlossen) · ausgenommen: die 17 Einträge unter `acknowledged`
Scope-Regel: alles, jede Severity und jede Kategorie, info eingeschlossen — gilt auch für Befunde, die erst im Lauf auffallen. Ziel ist ein Release ohne offenes Finding.
Kaltstarts: 18 Pakete × mindestens 3 Agenten ≈ 54, je Nachrunde zwei mehr · 5,1 Findings je Paket (Pakete 14, 15, 16 und 22 sind Nachträge ohne eigenes Finding; 11b ist im Zug 0 von 11 abgeteilt, 13b im Zug 0 von 13, 21b im Zug 0 von 21)
Stand (2026-11-01): Lauf abgeschlossen — 32 Pakete committet (726f020f..b89b79b9), keines blockiert, »Offene Befunde« leer; Report: docs/remediation/20261101-remediation-report.md

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` geparkt, Stand im Stash.

## Entscheidungen

Der Nutzer hat am 2026-10-31 den Paketschnitt vorab freigegeben und angeordnet: alles
beheben, three.js vor dem Sprint auf den neuesten Release heben, nur bei einem echten
Konflikt nachfragen, im Zweifel die saubere Lösung, solange ihr Aufwand vertretbar ist.
Die folgenden Punkte hat der Orchestrator auf dieser Grundlage entschieden:

- Das frische Audit ist als `chore: update audit` (d9b648bf) committet, bevor der Lauf beginnt (2026-10-31)
- three und @types/three im `catalog:` von `pnpm-workspace.yaml` auf `~0.187.0` heben, als erstes Paket und vor jedem anderen; die Peer-Range bleibt auf der Tilde (AGENTS.md, »Shared dependency versions«). BUILD-002 wird geschlossen, indem die Bindung jedes Releases an eine three-Minor und der Release-Ablauf dazu dauerhaft dokumentiert sind (2026-10-31)
- Offene Frage »never rejects«: `StageTransition#finished`, `StageDirector#precompile()` und `DisplayFullscreen#request()`/`exit()`/`toggle()` lösen bei einem `dispose()` während ihres Laufs weiterhin auf, statt abzulehnen. Ihr aufgelöster Wert trägt den Ausgang (`state: 'cancelled'`, `isActive`), und ein UI-`await` braucht kein try/catch. Die Ausnahme kommt mit dieser Begründung namentlich in `resource-lifecycle.md` §3, und das TSDoc jedes der Member nennt sie (2026-10-31)
- Offene Frage Kind-Renderer mit eigener Pipeline unter einem Parent im plain mode: einmalige `console.warn` im Stil von `StageRenderOrder#warnAboutSharedNames` (DOC-002), keine Ablehnung (2026-10-31)
- Offene Frage StageDirector unter einem zweiten Renderer: Shapes und Placeholder werden an den Renderer gebunden, für den sie gebaut sind; wechselt er, verwirft der Director sie (dispose) und baut neu. Das gehört zum Cache-Umbau von RES-001 (2026-10-31)
- Offene Frage `atlasUrl = undefined`: verhält sich wie `imageUrl = undefined` und nimmt Atlas, Textur und Animationen der Atlas-Ressource zurück (CONS-010, erste Option der Empfehlung); Verhaltensänderung im CHANGELOG (2026-10-31)
- Offene Frage zur User-Aktivierung auf Mobilgeräten: nur auf echten Geräten klärbar und nicht Teil dieses Laufs. BUG-009 und ASYNC-002 werden defensiv behoben, sodass beide Antworten des Browsers korrekt behandelt werden (2026-10-31)
- CONS-014: generische Event-Namen in `events.ts` bekommen ein Emitter-Präfix; absichtlich geteilte Namen (`dispose` der Stages) bleiben und sind dokumentiert. Breaking Change, steht im CHANGELOG samt Migrationshinweis (2026-10-31)
- API-004 (`StageItem` öffentlich `readonly`) und API-002 (Eingaben auch nach `dispose()` prüfen) werden umgesetzt, beide im CHANGELOG (2026-10-31)
- DEP-002: von `@esm-bundle/chai` auf `chai` 6 über ESM-Import umziehen (2026-10-31)
- DEP-001: jedes Workspace-Paket deklariert die Tools, die seine Scripts aufrufen, als devDependencies (2026-10-31)
- DOC-003: kein Git-Hook. Das Gate läuft minutenlang samt Browsern, und ein reiner Lint-Hook gäbe falsche Sicherheit. Der Alias `cbt` und das Gate werden im README des Repos erklärt (2026-10-31)
- BUILD-003: der Deploy-Build-Job bricht bei high/critical in den dort installierten Produktions-Abhängigkeiten ab; der CI-Audit-Schritt bleibt meldend (2026-10-31)
- TEST-008: kein Code. Die Regel »nach einem Node-Upgrade die Allocation-Specs einmal ohne Nx-Cache laufen lassen« kommt in AGENTS.md zu den Allocation-Specs (2026-10-31)
- BUG-028: `readDataIdAt()` bildet gebrochene Koordinaten mit `Math.floor()` auf die Zelle ab und sagt das im TSDoc (2026-10-31)
- API-006: `Map2DSpatialHashGrid#clear()` und `size` kommen dazu, mit TSDoc und Spec (2026-10-31)
- RES-004: Zug 0 von Paket 9 wählt zwischen harter Grenze und WeakRef. Maßstab: kein neuer Fehler für einen heutigen Aufrufer ohne Not; die Wachstumsgrenze steht in jedem Fall beziffert im JSDoc (2026-10-31)
- Die neue Release-Version selbst (Tag, Publish) ist nicht Teil dieses Laufs; der Abschluss liefert die Semver-Empfehlung (2026-10-31)

- Drain-Runde 2: Ein Fullscreen, den ein anderes Element als das Ziel hält, sperrt `onLandscape` — weder Anfrage noch Scharfschalten, egal wo das Element liegt; die Library stiehlt keinen fremden Fullscreen (2026-11-01, Orchestrator nach Nutzervorgabe »im Zweifel die saubere Lösung«, Nutzer nicht gefragt)
- Drain-Runde 2: Jedes Verlassen eines Fullscreens im Querformat setzt `#declined`, gleich wer ihn betreten hat; die Zusage in `docs/display.md` gilt damit uneingeschränkt (2026-11-01, Orchestrator, Nutzer nicht gefragt)
- Drain-Runde 2: Jeder Name in einer Fehler- oder Warnmeldung geht über `describeValue()`, auch ein als `string` typisierter; die Ausnahme »quoted by hand« in der Regel »Error and warning messages« von `AGENTS.md` entfällt. Begründung: seit Paket 19 escaped `describeValue()`, die Handform nicht — zwei Formen mit verschiedenem Verhalten; der Umbau ist mechanisch. Der Nutzer hat ein Release ohne offenes Issue verlangt, daher nicht ins Audit (2026-11-01, Orchestrator, Nutzer nicht gefragt)
- Drain-Runde 3: Die »klein«-Befunde der Reviewer und die Abweichungen, die die Pakete offen ließen, werden behoben statt ins Audit gegeben (Pakete 25–28); der Nutzer verlangt ein Release ohne offenes Issue. Was Runde 3 selbst an Nebenbefunden erzeugt, geht ohne weitere Runde ins Audit. Ohne Aktion bleiben: drei Commit-Messages (b91ab441, a63429c8, d36fe515 — Historie), die Plausibilitätsnotiz zu uvec4 aus Paket 14, der vom Implementierer begründete Guard in `MothChapel.ts:192`, die bewussten Entscheidungen aus Paket 9 (`null` leert den Slot), 20 (Cast-Helfer), 21b (Ausschlüsse, Material-Cast) und 24 (Kürzung über 120 Einheiten) sowie der Lesevorbehalt aus Paket 24. Ins Audit als Verbesserung: das Lookbook hat keine Testoberfläche (2026-11-01, Orchestrator, Nutzer nicht gefragt)
- Abschlusspaket 29: Die zwei Info-Nebenbefunde der Runde 3 (Prosazeilen über dem Umbruch) und der »klein«-Befund aus Paket 28 (toter `String(cause)`-Zweig in `fetchAsset.ts`) werden statt ins Audit noch behoben; Paket 29 nimmt keine weiteren Nebenbefunde auf, was dort auffällt, geht ins Audit (2026-11-01, Orchestrator, Nutzer nicht gefragt)
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
- Projektspezifisch: AGENTS.md im Repo-Root gilt für jede Zeile (Commits nach
  Conventional Commits auf Englisch, Code/Kommentare/Doku auf Englisch,
  Fehlermeldungen nach den dort beschriebenen Regeln, `#private`-Member,
  `.js`-Suffix bei relativen Imports). Jede öffentliche Änderung bekommt ihren
  Eintrag unter `## [Unreleased]` in `packages/twopoint5d/CHANGELOG.md` (Skill
  `updating-changelog`), und ein neues oder geändertes Feature ändert seinen
  Guide-Abschnitt im selben Commit.
- `pnpm run ci` hält eine Sperre pro Checkout; nie zwei Gates oder Builds
  parallel im selben Arbeitsbaum starten.

## Vorbestehende Fehler
- keine — die Baseline von `pnpm run ci` war vor Lauf-Beginn grün

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] `AGENTS.md:157`, `docs/architecture.md:118`/`:637`, `apps/lookbook/assets-src/README.md:490`/`:491`/`:589`/`:639`/`:642`/`:644` — Prosazeilen 91–103 Spalten über dem Umbruch ihrer Datei (90 bzw. 100), in Absätzen, die Paket 25 nicht anfasst; vorbestehend · aus Paket 25 (Runde 0, Implementierer) · info · → Audit (Entscheidung »Drain-Runde 3«: Nebenbefunde der Runde 3 gehen ohne weitere Runde ins Audit) · stattdessen überführt in Paket 29 (2026-11-01, Orchestrator: drei triviale Stellen, Release ohne offenes Issue)
- [x] `pnpm-lock.yaml:2995`/`:2999` (`minimatch@10.2.5`, `10.2.6`) — moderate GHSA-g3hv-75wg-m249, über `.>nx>minimatch` und `.>rimraf>glob>minimatch`, behoben ab 11.0.1; vorbestehend (schon in d9b648bf) · aus Paket 2 (Zug 0, lokales `pnpm audit`) · moderate · → Scope · überführt in Paket 17 (Drain-Runde, 2026-11-01)
- [x] `pnpm-lock.yaml:2475` (`glob@13.0.6`) — moderate GHSA-3g3m-2fjr-6pw4, über `.>rimraf>glob`, behoben ab 14.0.2; vorbestehend · aus Paket 2 (Zug 0) · moderate · → Scope · überführt in Paket 17 (Drain-Runde, 2026-11-01)
- [x] `pnpm-lock.yaml:2155` (`deepmerge@4.3.1`) — low GHSA-gcqx-w48m-w2h4, über `packages__twopoint5d-testing>@web/test-runner>@web/dev-server>deepmerge`, kein behobener Release (Patch oder Override nötig); vorbestehend · aus Paket 2 (Zug 0) · low · → Scope · überführt in Paket 17 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/stage/StageDirector.ts:672`/`:695`/`:873`/`:902` — die Stage-Argumente von `hide()`, `replace()` (`from`), `setMask()` und `freeze()`/`run()` werden nicht als Objekt geprüft: `hide(undefined)` liest `stage.name` und wirft einen TypeError ohne Subjekt statt einer Ablehnung nach AGENTS.md; vorbestehend (Datei seit d9b648bf unverändert) · aus Paket 4 (Zug 0) · low · → Scope (Eingabeprüfung des Directors, teilt das Thema mit Paket 6) · übernommen in Paket 6 (Zug 0, 2026-11-01: gleiche Ursache wie API-002 — Stellen jetzt `:738`/`:786`/`:1031`/`:1063`); erledigt mit dessen Commit 6d041d1f
- [x] `packages/twopoint5d/src/display/DisplayFullscreen.ts:778ff.` (`#readState()`) — `isArmed` bleibt `true`, nachdem ein `request()` der Seite den Fullscreen betreten hat; nichts entschärft beim Betreten, ein Hinweis »tap for fullscreen« bliebe im Vollbild stehen; vorbestehend (in f9a8bfde `#disarm()` nur in Tap, Setter, `dispose()` und Hochformat) · aus Paket 5 (Runde 4) · low · → Scope · überführt in Paket 18 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/display/DisplayFullscreen.ts:353` (`set onLandscape(true)`) — schaltet neben einem offenen Request scharf, eine Prüfung auf `#pending` fehlt; vorbestehend (in f9a8bfde mit `!isActive` an derselben Stelle) · aus Paket 5 (Runde 4) · low · → Scope · überführt in Paket 18 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/docs/proposals/display-fullscreen.md:11-37` — der Status-Kopf führt »Deviations of the build from the first draft«, ein Rückblick, der nach der Proposal-Konvention ins ADR gehört; vorbestehend (in f9a8bfde `:11`) · aus Paket 5 (Runde 0) · low · → Scope · überführt in Paket 18 (Drain-Runde, 2026-11-01) · im Zug 0 von 18 gegenstandslos: `docs/proposals/README.md` verlangt genau diese Liste, ein ADR-Verzeichnis gibt es nicht (Begründung beim Paket)
- [x] `packages/twopoint5d/src/display/Display.spec.ts:131-135` (`fireFullscreenChange()`) — ruft jeden je registrierten `fullscreenchange`-Listener aus `doc.addEventListener.mock.calls`, auch entfernte; nach einem `dispose()` erreicht der Helfer Listener, die der Browser nicht mehr riefe; vorbestehend (in f9a8bfde `:131`) · aus Paket 5 (Runde 0) · low · → Scope · überführt in Paket 18 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/display/DisplayFullscreen.ts:313-314` — der Konstruktor ruft `#warnConflicts()` zweimal (im Setter `onLandscape` und direkt danach); harmlos, weil jede Warnung einmal je Seite erscheint; vorbestehend · aus Paket 5 (Runde 0) · info · → Scope · überführt in Paket 18 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d-testing/test/stage-pipeline.test.js:40`/`:72`/`:239` (Tests ab `:33`, `:65`, `:232`) — `RenderPipeline`, `Stage2D`, Geometrie und Material gehen nicht über `keep()` und werden nach dem Test nicht freigegeben, gegen die Konvention in `helpers/fixtures.js`; dazu Geometrie und Material von `second` im Test ab `:189`; vorbestehend (an d9b648bf `:40`, `:72`, `:205`) · aus Paket 7 (Runde 0) · low · → Scope · überführt in Paket 17 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/texture/TextureCoords.spec.ts:109` — ein zweites `describe('root')` neben dem ersten, Biome meldet `noIdenticalTestTitle`; vorbestehend (Datei seit d9b648bf unverändert) · aus Paket 8 (Runde 0) · info · → Scope · überführt in Paket 17 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/sprites/SpritePicker.ts:118-125`/`:147`/`:260ff.` (`isShown()`, `#scene`, `#gather()`) — die Pick-Meshes liegen in der Szene des Pickers, außerhalb jeder `ClippingGroup`, unter der die Sprites liegen; three 0.187.0 clippt über die `ClippingGroup`-Vorfahren eines Objekts, `isShown()` übernimmt von den Vorfahren nur `visible`, also trifft ein Pick ein Sprite, wo der Draw es weggeclippt hat (nach Lesen des Codes, nicht ausgeführt); vorbestehend (an d9b648bf kein `ClippingGroup` in der Datei) · aus Paket 9 (Zug 0) · low · → Scope · überführt in Paket 19 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/sprites/SpritePicker.ts:288`/`:299` (`#sync()`) — ein für einen Pass gebautes Material, das der Aufrufer in den `material`-Slot der Sprites legt, wird beim Pick als Material der Sprites genommen: das Pick-Material entsteht ohne den Pass und bekommt `material.placement` des Pass-Materials, das `checkPlacementStandIn()` beim ersten `pick()` ohne Hinweis auf Slot oder Pass ablehnen kann; Paket 9 schließt nur den Konstruktor (`resolveParts()`), der Slot gehört dem Aufrufer (nach Lesen des Codes, nicht ausgeführt); vorbestehend · aus Paket 9 (Zug 0) · low · → Scope · überführt in Paket 19 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/utils/describeValue.ts:71-77` (`describeString()`) — setzt einen String roh zwischen doppelte Anführungszeichen: ein Zeilenumbruch, ein `"` oder ein einzelnes Surrogat darin landet so in jeder Meldung, die ihn zitiert, und eine zitierte Zeichenkette kann über Zeilen laufen oder wie zwei Werte aussehen — die Folge, die die Beschreibung von CONS-011 den handgesetzten Anführungszeichen zuschreibt, bleibt nach dem Umstieg auf `describeValue()`; eine Änderung dort berührt jede Meldung der Library; vorbestehend · aus Paket 9 (Zug 0) · info · → Scope · überführt in Paket 19 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/text/writeText.ts:50` (`prepare()`) — prüft `InstancePosition`, `QuadSize` und `AtlasFrame` über Identität (`sprites.kind.features.includes(feature)`); eine Kopie wie `defineFeature({...QuadSize})` mit derselben API wird als fehlend abgelehnt — Gegenrichtung zur Namensprüfung der Segment-Placement; vorbestehend · aus Paket 9 (Runde 0) · low · → Scope · überführt in Paket 19 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/events.ts:150` (TSDoc `OnStageDispose`) und `packages/twopoint5d/docs/stages.md:1959` (Tabelle »Events«) — nennen als Sender nur `Stage2D` und `StageRenderer`; `StageMaskWorldStage` sendet es ebenfalls (`src/stage/StageMaskWorldStage.ts:85`); vorbestehend (an d9b648bf `events.ts:144`) · aus Paket 10 (Runde 0) · low · → Scope · überführt in Paket 20 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/docs/stages.md:1955ff.` (Tabelle »Events«) — `OnStageTransitionStart`/`OnStageTransitionEnd` fehlen in der Tabelle, sie stehen nur in Prosa bei `:939`; vorbestehend · aus Paket 10 (Runde 0) · info · → Scope · überführt in Paket 20 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:108` (Klassen-TSDoc) — sagt »has exactly four children«, ein Quadrant ohne Chunk ist aber `null` (und nach einer Einachsenteilung sind es zwei); vorbestehend (an d9b648bf derselbe Satz, `null`-Quadranten schon dort) · aus Paket 11 (Runde 0) · info · → Scope · überführt in Paket 20 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:139-142` (Setter `usedCount`) — lässt `undefined` und andere Nicht-Zahlen durch (`Number.isNaN(undefined)` und `Number.isFinite(undefined)` sind `false`), `#usedCount` wird `NaN` gegen das TSDoc `:124-128`, das einen `RangeError` verspricht; dazu lautet die Meldung »must be an integer« statt »a whole number«; vorbestehend (an d9b648bf `:142`) · aus Paket 11 (Runde 0) · low · → Scope · überführt in Paket 20 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:441-442` (`copy()`) — ist die Quelle `other` losgelassen, wirft die Methode `releasedError('copy()')`, dessen Meldung von »the pool behind this buffer« spricht, gemeint ist aber die Quelle; `VertexObjectBuffer.spec.ts:909` prüft nur `/disposed/`; vorbestehend (an d9b648bf `:441`) · aus Paket 11 (Runde 0) · low · → Scope · überführt in Paket 20 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/texture/AsepriteJson.ts:489-492` — `frames` ist ein Literal `{}`, gefüllt über `frames[name] = …`; ein Frame namens `"__proto__"` setzt den Prototyp statt einen Frame anzulegen und verschwindet still (`BitmapFont.frozenCopy()` umgeht das mit `defineProperty`); vorbestehend (an d9b648bf `:459`) · aus Paket 11 (Runde 0) · low · → Scope · überführt in Paket 19 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:352` (`#centerPoint2D`) — nicht `readonly`, obwohl `#dependencyValues` (`:405`) das Objekt festhält; ein neu zugewiesenes Feld ließe das Cache-Gate am alten Objekt, heute weist niemand neu zu (fehlende Typgarantie); vorbestehend (an b91ab441 und d9b648bf ohne `readonly`) · aus Paket 11b (Runde 0) · info · → Scope · überführt in Paket 20 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/stage/transitionEffects.ts:298` (`dissolve()`) — Rauschen je Zelle über den Sinus-Hash `fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453)` mit `cell = floor(uv * resolution / scale)`: bei 4K und `scale` 1 laufen die Argumente bis ~2,2·10⁵ rad — genau der Fall, für den `hash21` im Lookbook (`stage-masks/FoundFootage.ts:327-335`) diagonale Streifen auf manchen GPUs beschreibt; die Library hat keinen Hash ohne `sin()`, eine Änderung verschiebt das Muster eines veröffentlichten Effekts (CHANGELOG) (nach Lesen des Codes, nicht ausgeführt); vorbestehend (an d9b648bf `:296`) · aus Paket 12 (Zug 0) · low · → Scope · überführt in Paket 20 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/sprites/SpritePicker.ts:328`, `src/stage/StageMask.ts:148`, `src/stage/transitionEffects.ts:480`, `src/stage/StageDirector.ts:2338` — `uniform(…) as unknown as UniformNode<'float', number>` ist unter @types/three 0.187 wirkungslos (`uniform(number)` liefert `UniformNode<"float">`, `UniformNode.d.ts:136-155`) und schaltet die Typprüfung dort ab; daneben weitere `as unknown as Node<…>` um TSL-Knoten (`texture/sampleFrameAt.ts:68-95`, `texture/sampleAtlasFrame.ts:114-130`, `sprites/FeatureSprites/FeatureSpritesMaterial.ts:356-384`, `stage/StageDirector.ts:2304`/`:2320`, `stage/transitionEffects.ts:487`, `sprites/SpritePicker.ts:340`), einzeln nicht geprüft, ob 0.187 sie trägt; vorbestehend (an d9b648bf `StageMask.ts:148`, `SpritePicker.ts:321`, `transitionEffects.ts:478`, `StageDirector.ts:1840`) · aus Paket 12 (Zug 0) · info · → Scope · überführt in Paket 20 (Drain-Runde, 2026-11-01)
- [x] `apps/lookbook/src/pages/demos/stage-masks-matte-threshold.astro:197`/`:201` — `SOFTNESS as unknown as number[]` und `SONAR_KINDS as unknown as string[]` für lil-gui: zwei `as const`-Tupel (`:67`, `stage-masks/Sonar.ts:39`) gegen die veränderbaren Listen von lil-gui; `[...SOFTNESS]` bzw. `[...SONAR_KINDS]` schaltete die Typprüfung nicht ab; vorbestehend (an d9b648bf `:197`/`:201`) · aus Paket 12 (Zug 0) · info · → Scope · Paket 13 (READ-004) baut dieselbe Seite um; im Zug 0 von 13 nicht übernommen (andere Ursache: `as const` gegen lil-gui, die beiden Controller bleiben auf der Seite), die Zeilen verschieben sich mit 13 · überführt in Paket 21 (Drain-Runde, 2026-11-01) · im Zug 0 von 21 nach Paket 21b abgeteilt (Paket geteilt: die Dispose-Lücken der Demo-Seiten sind eine Ursache über ≈ 26 Seiten; Fundstellen jetzt beim Paket)
- [x] `packages/twopoint5d/src/stage/fitIntoRectangle.spec.ts:331-408` (`describe('pixelSnap')`) — der lokale Helfer `fit(…)` heißt wie Jasmines fokussiertes `fit`, Biome meldet 17× `noFocusedTests` (Warnung, `biome ci` bleibt grün); Umbenennen beendet das Rauschen; vorbestehend (an d9b648bf `:315ff.`) · aus Paket 12 (Runde 0) · info · → Scope · überführt in Paket 17 (Drain-Runde, 2026-11-01)
- [x] `packages/twopoint5d/src/stage/ProjectionPlane.spec.ts:16` — `describe('constructor')` meldet Biome als `noIdenticalTestTitle` (Warnung); vorbestehend · aus Paket 12 (Runde 0) · info · → Scope · überführt in Paket 17 (Drain-Runde, 2026-11-01)
- [x] `apps/lookbook/src/pages/demos/textured-sprites.astro:55`/`:70` — nach den `await` im `onInit` keine Prüfung auf `demo.isDisposed`, kein `onDispose`: `store` und die Sprites werden nie freigegeben, der anonyme `pointerdown`-Listener `:55` bleibt angemeldet; der Kommentar `:70` »the sprites were disposed« passt nicht zu einem eben gebauten Pool; vorbestehend (an d9b648bf `:54`) · aus Paket 13 (Runde 0) · low · → Scope · überführt in Paket 21 (Drain-Runde, 2026-11-01) · im Zug 0 von 21 nach Paket 21b abgeteilt (Paket geteilt: die Dispose-Lücken der Demo-Seiten sind eine Ursache über ≈ 26 Seiten; Fundstellen jetzt beim Paket)
- [x] `apps/lookbook/src/pages/demos/rope-bridge.astro:124`/`:130`/`:135` — die `canvas`-Listener (`pointerdown`, `pointermove`, `pointerup`, dazu der vierte) sind anonym und werden im `onDispose` `:152` nie abgemeldet, dasselbe Muster wie das Game-Menu vor Paket 13; vorbestehend (an d9b648bf vier `canvas.addEventListener`) · aus Paket 13 (Runde 0) · low · → Scope · überführt in Paket 21 (Drain-Runde, 2026-11-01) · im Zug 0 von 21 nach Paket 21b abgeteilt (Paket geteilt: die Dispose-Lücken der Demo-Seiten sind eine Ursache über ≈ 26 Seiten; Fundstellen jetzt beim Paket)
- [x] `apps/lookbook/src/pages/demos/ui-panels.astro:134`/`:137`/`:138`/`:62` — drei anonyme `canvas`-Listener ohne Abmeldung im `onDispose` `:162`; der `StageRenderer` aus `:62` wird nie freigegeben; vorbestehend · aus Paket 13 (Runde 0) · low · → Scope · überführt in Paket 21 (Drain-Runde, 2026-11-01) · im Zug 0 von 21 nach Paket 21b abgeteilt (Paket geteilt: die Dispose-Lücken der Demo-Seiten sind eine Ursache über ≈ 26 Seiten; Fundstellen jetzt beim Paket)
- [x] `apps/lookbook/src/pages/demos/stage-transitions-gallery.astro:127`/`:210` und `stage-transitions-game-menu.astro:193` — `transition.finished.then(…)` der Galerie prüft nicht auf `display.isDisposed` (anders als die übrigen Seiten), und nach `await precompiled` rufen beide Seiten `preview.ready()` ohne `isDisposed`-Prüfung; vorbestehend · aus Paket 13 (Runde 0) · low · → Scope · überführt in Paket 21 (Drain-Runde, 2026-11-01) · im Zug 0 von 21 nach Paket 21b abgeteilt (Paket geteilt: die Dispose-Lücken der Demo-Seiten sind eine Ursache über ≈ 26 Seiten; Fundstellen jetzt beim Paket)
- [x] `apps/lookbook/src/pages/demos/stage-masks-portal.astro:192` — der Readout heißt `maskOf(other)`, liest aber `maskOf(moor.stage)`; auf der Seite gibt es kein `other`; vorbestehend (an d9b648bf `:195`) · aus Paket 13 (Runde 0) · info · → Scope · überführt in Paket 21 (Drain-Runde, 2026-11-01) · im Zug 0 von 21 nach Paket 21b abgeteilt (Paket geteilt: die Dispose-Lücken der Demo-Seiten sind eine Ursache über ≈ 26 Seiten; Fundstellen jetzt beim Paket)
- [x] `packages/twopoint5d/src/texture/TextureFactory.ts:58-145` (`TextureClasses`) — keine Texturklasse schreibt `generateMipmaps`, ein Katalog-Eintrag kann die Mip-Stufen seiner Textur nicht abschalten; three 0.187 erzeugt sie bei `generateMipmaps === true` (`three.webgpu.js:10706`) und setzt unter WebGPU `mipmapFilter` aus `minFilter` (`:40911`, `NearestFilter` → `'nearest'`), also liest eine `nearest`-Textur bei Verkleinerung unter WebGPU aus Mip-Stufen, unter WebGL 2 nicht; eine Id- oder Datentextur aus dem Store (`MothChapel` `panes`, Paket 13b) muss `generateMipmaps` am geliehenen Objekt setzen (nach Lesen des Codes, nicht ausgeführt); vorbestehend (an d9b648bf dieselbe Klassenliste ohne `generateMipmaps`) · aus Paket 13b (Zug 0) · low · → Scope · überführt in Paket 19 (Drain-Runde, 2026-11-01)
- [x] `apps/lookbook/src/pages/demos/animated-billboards.astro:54-116` — kein Dispose-Pfad: `demo.start()` ohne `onDispose`, der Store aus `loadTextureCatalog()` (`:61`), Geometrien, Materialien und die Bodentextur (`:99`) werden nie freigegeben; vorbestehend (an 353a7dbd schon ohne `onDispose`) · aus Paket 13b (Runde 0) · low · → Scope · überführt in Paket 21 (Drain-Runde, 2026-11-01) · im Zug 0 von 21 nach Paket 21b abgeteilt (Paket geteilt: die Dispose-Lücken der Demo-Seiten sind eine Ursache über ≈ 26 Seiten; Fundstellen jetzt beim Paket)
- [x] `apps/lookbook/src/pages/demos/stage-transitions-gallery.astro:102-104` und `stage-transitions-game-menu.astro:163-165` — `director.precompile()` scheitert im Vorschau-Generator unter WebGPU mit `TypeError: Failed to execute 'drawIndexed' on 'GPURenderPassEncoder': Value is infinite` (»--strict fails them«); an 353a7dbd vorhanden (Vorher-Lauf von 13b), an d9b648bf nicht geprüft — Paket 13 hat die `layers` des `precompile()` der Galerie geändert, also möglicherweise Folge von Paket 13 · aus Paket 13b (Runde 0) · medium · → Scope · überführt in Paket 21 (Drain-Runde, 2026-11-01) · im Zug 0 von 21: besteht (`:102-109`, Spielmenü `:163-166`), Ursache in der Library — eine `InstancedVOBufferGeometry` trägt vor ihrem ersten `update()` three's `instanceCount = Infinity`, und der Off-Screen-Draw von `precompile()` ruft kein `updateFrame()`; vorbestehend (an d9b648bf derselbe Konstruktor und dieselben `layers` des Spielmenüs, `:155`), Paket 13 hat nur die Galerie als zweite Stelle dazugebracht, keine Folge
- [x] `packages/twopoint5d/src/display/DisplayFullscreen.ts:907`/`:938-940` (`#turned()`, `#holdsTarget()`), `:352` (Setter `onLandscape`), `:282-291` (`#onArmedTap`) — `onLandscape` fragt das Ziel an und schaltet scharf, während ein anderes Element im Fullscreen liegt, ohne dass das Ziel im Fullscreen-Stapel ist (ein Video der App im Ziel, das selbst in den Fullscreen ging, oder ein Element außerhalb): `#holdsTarget()` sieht nur `isActive` und `#activeElement`, also zieht die Drehung ins Querformat — oder der scharfe Tap auf das Video, der in der Capture-Phase am Ziel ankommt — das Ziel über diesen Fullscreen; Klassen-TSDoc `:199-202` und Proposal §3.2 regeln nur ein Element, das auf dem Ziel liegt. Offen ist die Regel, welcher fremde Fullscreen sperrt (im Ziel, im Root, im Dokument) (nach Lesen des Codes, nicht ausgeführt); vorbestehend (an d9b648bf `#turned()` mit `this.isActive` allein, `:557`, Setter `:252`) · aus Paket 18 (Zug 0) · low · → Scope · im Zug 0 von 22 nicht übernommen (andere Ursache); ändert der Fix, wann `isArmed` scharf sein darf, zieht er neben Getter `DisplayFullscreen.ts:447-450`, Proposal §3.2 und `docs/display.md:505-506`/`:660` auch das TSDoc von `DisplayFullscreenChangeProps.isArmed` in `src/display/types.ts:72ff.` nach (seit Paket 22) · überführt in Paket 23 (Drain-Runde 2, 2026-11-01)
- [x] `packages/twopoint5d/docs/display.md:510-511` (»Whoever leaves the fullscreen while the phone is still sideways … stays out of it until the phone has turned upright and back«), `src/display/DisplayFullscreen.ts:806-810`/`:922-928` (`#readState()`, `#turned()`) — die Zusage gilt nur für den Fullscreen von `onLandscape`: verlässt der Nutzer im Querformat einen Fullscreen, den ein `request()` der Seite oder jemand anderes betreten hat, setzt nichts `#declined`, und eine halbe Drehung ins andere Querformat fragt wieder an bzw. schaltet scharf; offen ist, ob der Satz eingeschränkt oder `#declined` für jedes Verlassen im Querformat gesetzt wird (nach Lesen des Codes, nicht ausgeführt); vorbestehend (Guide-Satz und `#turned()` ohne `#declined` für fremde Fullscreens schon vor Paket 18) · aus Paket 18 (Runde 0, Reviewer) · low · → Scope · überführt in Paket 23 (Drain-Runde 2, 2026-11-01)
- [x] `packages/twopoint5d/src/` (233 handgesetzte `"${…}"` in 43 Dateien ohne Specs, z. B. `src/texture/AsepriteJson.ts:231`/`:383`/`:397`, `src/texture/TexturePackerJson.ts:129`/`:139`) — Namen vom Typ `string`, die eine Meldung nach der Regel »Error and warning messages« (`AGENTS.md:136-138`) von Hand in Anführungszeichen setzt, stehen dort roh: ein Frame-, Slice- oder Tag-Name aus einem Json mit `"`, `\` oder Zeilenumbruch macht die Meldung mehrdeutig oder mehrzeilig; nach Paket 19 escaped `describeValue()` diese Zeichen, die Handform nicht, und AGENTS.md sagt das; vorbestehend (die Handform an d9b648bf ebenso) · aus Paket 19 (Zug 0) · info · → Rückfrage: ein Fix kippt die Regel »quoted by hand« in AGENTS.md und berührt 233 Stellen in 43 Dateien · überführt in Paket 24 (Drain-Runde 2, 2026-11-01) · im Zug 0 von 24: besteht (232 Zeilen, 294 Vorkommen, 43 Dateien), dazu die blanken Namenslisten und `DisplayFullscreen.ts:49` gleicher Ursache (Fundstellen beim Paket)
- [x] `docs/architecture.md:15`/`:17`/`:105`/`:641` — Prosazeilen über 90 Spalten außerhalb der Absätze von Paket 28 (gleiche Art wie der Eintrag oben zu `:118`/`:637`); vorbestehend · aus Paket 28 (Runde 0, Implementierer) · info · → Audit (Entscheidung »Drain-Runde 3«: Nebenbefunde der Runde 3 gehen ohne weitere Runde ins Audit) · stattdessen überführt in Paket 29 (2026-11-01, Orchestrator: drei triviale Stellen, Release ohne offenes Issue) · im Zug 0 von 29: `:15`/`:17` sind Tabellenzeilen, `:105` steht im Codeblock — ausgenommen nach der Regel aus Paket 25, gegenstandslos; `:641` ist die Zeile, die der Eintrag zu Paket 25 als `:637` führt
- [ ] Log von `pnpm run ci` (`test:browser`) — unter »Webkit WebGL2: 3« stehen `display-dispose`, `sprites-picking`, `vertex-objects-heap`, ohne dass der Lauf sagt, ob das Skips, Retries oder Ausnahmen sind; der Lauf ist grün (0 failed), Bedeutung nicht untersucht; vorbestehend vermutet · aus Paket 29 (Runde 0, Implementierer) · info · → Audit (Paket 29 nimmt nach der Entscheidung »Abschlusspaket 29« keine Nebenbefunde auf)

## Pakete

### [x] 1. three.js 0.187 übernehmen
- Findings: BUILD-002 (info)
- Detail: `docs/remediation/paket-1.md`
- Ziel: three und @types/three stehen auf 0.187, jede API-Folge in Library, Tests und Lookbook ist nachgezogen, und die Bindung des Releases an die three-Minor ist dokumentiert.
- Bereich: `pnpm-workspace.yaml`, `pnpm-lock.yaml`, Folgen in `packages/`, `apps/lookbook/`, `docs/architecture.md`
- Blocker für den kleinen Schnitt: ausdrückliche Anordnung des Nutzers (vor dem Sprint) und Querregel »API-verändernde Dependency-Bumps nach vorn«
- Hängt ab von: —
- Hash: 726f020f
- Ergebnis: 1 Runde · BUILD-002 behoben (Katalog `~0.187.0`, Ablauf einer Hebung in
  `docs/architecture.md` §5, Verweis in `AGENTS.md`) · Regressionstests `a paused display keeps
  the animation loop of three standing through a draw and through a callback set on the renderer`
  (Browser, vor dem Fix rot: expected 8 to equal 2), `holds the animation loop of three through a
  start of it in the pause, …` und `hands start() of the animation loop of three back without a
  call as a paused display is disposed` (Display.spec, vor dem Fix rot), `is lost by a release
  that hands the canvas back, …` und `is lost by a release that does not hand the canvas back`
  (canvasHandover.spec, vor dem Fix rot) · Gate-Folgen behoben: Kontextverlust beim Release,
  TSL ohne `VarNode`-Hülle, Interleaved-Readback-Helfer entfallen · klein: Heap-Kommentar nennt
  1,8 % nur für WebGL2
- Nebenbefunde: keine
- Folgen: `packages/twopoint5d/docs/proposals/gpu-picking.md:197` und
  `packages/twopoint5d/docs/proposals/sprite-and-texture-roadmap.md:452` behaupten weiter, WebGL 2
  lese kein Integer-Target zurück; unter three 0.187.0 liest es `RGBAIntegerFormat` mit 32-Bit-
  Komponenten. Nach Detailplan bewusst nicht angefasst (Proposals halten ihre Grundlage fest) —
  der nächste Zug 0 entscheidet, ob ein Vermerk nötig ist → verteilt im Zug 0 von Paket 2
  (2026-10-31): Symptom dieses Pakets, Nachtragspaket 14
- Schnittstellen: Peer-Ranges `three ~0.187.0`, `@types/three ~0.187.0` · `Display` überdeckt
  in der Pause `renderer._animation.start` mit einer eigenen No-op-Property
  (`#heldAnimationOfThree`, `#stopAnimationOfThree()`/`#startAnimationOfThree()`/
  `#releaseAnimationOfThree()` in `Display.ts:413/2089ff`) — wer in Paket 5 Display umbaut,
  hält diese Paarung · `canvasHandover.ts`: Release ruft `loseContext()` selbst
  (`disposeLosingContext()`, `liveContextOf()`), weil `WebGLBackend#dispose()` ein übergebenes
  Canvas nicht aufgibt · TSL 0.187: Operatoren ohne `VarNode`-Hülle, `vec4()` aus Konstanten ist
  `ConstNode` (Spec-Helfer `src/testing/spriteGraph.ts`)

### [x] 2. Tooling, Skripte und CI-Workflows
- Findings: BUILD-001 (low), BUILD-003 (info), DOC-003 (info), TEST-008 (info), TEST-003 (medium), ASYNC-004 (low), BUG-015 (low), DOC-001 (low)
- Dazu: `scripts/checkDocSnippets/typecheckInputs.test.mjs:18` — dieselbe Index-Liste wie DOC-001 (gleiche Ursache, im Zug 0 aufgenommen)
- Ziel: Publish-Skript, Gate-Sperre, Preview-Generator, Doc-Snippet-Check und die Workflows verhalten sich an ihren Rändern korrekt und sind getestet bzw. dokumentiert.
- Detail: `docs/remediation/paket-2.md`
- Bereich: `scripts/`, `.github/workflows/`, `README.md`, `AGENTS.md`, `docs/architecture.md`, `apps/lookbook/README.md`
- Hängt ab von: —
- Hash: 154cebcb
- Ergebnis: 0 Runden · alle acht Findings behoben (Reviewer opus) · Regressionstests
  `hands Ctrl-C to its command once: the terminal signals the whole process group` (vor dem Fix
  rot: code 12 statt 11) und `leaves its command running on a SIGINT to its own pid alone …`
  (rot: code 8) in `runExclusive.test.mjs`; `leaves out a tracked file the working tree no longer
  holds` und `names a file once while a merge conflict holds it in three stages` in
  `trackedMarkdownFiles.test.mjs` (rot: `gone.md` bzw. dreifaches `c.md`); `refuseAdapter()` und
  `--allow-webgl2` in `demoPreviewConfig.test.mjs` (rot: fehlender Export) · klein: Zeilenumbruch
  in `AGENTS.md:60-64` und `docs/architecture.md:179/368`, Step-Timeout im Deploy-Audit
  verschluckt `pnpm-audit.err`, Adapter-Logzeile vor dem Abbruch (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: neues CLI `node scripts/ci/auditInstalledDependencies.mjs --report <file>
  --importer <dir> …` (Exit 0/1/2), läuft im Job `build` von `deploy.yml` · `runExclusive.mjs`
  leitet nur noch SIGTERM/SIGHUP weiter · `generateDemoPreviews.mjs` endet ohne WebGPU-Adapter
  mit Exit 2, außer mit `--allow-webgl2` · `trackedMarkdownFiles(repoRoot)` in
  `scripts/checkDocSnippets/trackedMarkdownFiles.mjs` · `decidePublish()`/`isDevelopmentVersion()`/
  `describePublishFailure()` in `scripts/publishNpmPkg/publishDecision.mjs`

### [x] 14. Proposals auf three 0.187 nachziehen
- Findings: — (Nachtrag zu Paket 1: dessen `Folgen:`-Zeile, im Zug 0 von Paket 2 als Symptom eingeordnet)
- Folge von: Paket 1
- Ziel: Proposals und Kommentare beschreiben three so, wie 0.187.0 es tut: kein Satz behauptet mehr, WebGL 2 lese kein Integer-Target zurück oder ein `grad()` auf einer Textur mit zwei `NearestFilter` scheitere unter WebGPU; die Float-Wahl des Pickers ist gegen 0.187.0 begründet, und jede Versionsnennung von three in den Proposals ist gegen 0.187.0 geprüft.
- Detail: `docs/remediation/paket-14.md`
- Fundstellen: `packages/twopoint5d/docs/proposals/sprite-and-texture-roadmap.md:452` (Präsens, ohne Version — unter 0.187 falsch) · `packages/twopoint5d/docs/proposals/gpu-picking.md:196-205` (§3.4, begründet Float mit three 0.186.1) · Beleg: `WebGLTextureUtils#_getBytesPerTexel(glType, glFormat)` in three 0.187.0 (`build/three.webgpu.js:34592-34623`) kennt `RGBA_INTEGER`, `RG_INTEGER`, `RED_INTEGER`. Guide und `SpritePicker.ts:416-418` hat Paket 1 nachgezogen; `CHANGELOG.md:187` steht unter `[0.24.0]` und bleibt
- Dazu (Zug 0, gleiche Ursache — Paket 1 hat die Verhaltensänderungen von 0.187.0 im Code nachgezogen, in Proposals und einem Kommentar nicht): `grad()` auf einer Nearest-Textur scheitert unter WebGPU nicht mehr (`WGSLNodeBuilder#generateTextureGrad()`), behauptet in `atlas-frame-sampling.md:9-13` und `:236-238`, `wave-and-segment-sprites.md:416`, `src/sprites/features/RepeatingTextureColor.ts:62-65` · Versionsstempel 0.186 in `gpu-picking.md:115`/`:185`, `growing-capacity.md:73`, `stage-masks.md:713`, Aussagen gegen 0.187.0 geprüft und wahr (`docs/architecture.md` §5, Schritt 3)
- Bereich: `packages/twopoint5d/docs/proposals/`, ein Kommentar in `src/sprites/features/RepeatingTextureColor.ts`
- Steht hier, weil: unabhängig und klein, und Paket 9 liest das Picking-Proposal, bevor es den SpritePicker anfasst
- Hängt ab von: 1
- Hash: 46528b84
- Ergebnis: 0 Runden · alle neun Schritte erfüllt (Reviewer), Aussagen gegen three 0.187.0 gegengeprüft · klein: Umbruch in `wave-and-segment-sprites.md` §4.3 ragged; »which read level 0 alone« hängt grammatisch an »filters«
- Nebenbefunde: keine
- Folgen: keine

### [x] 3. Browser-Test-Harness und Abhängigkeiten der Workspace-Pakete
- Findings: TEST-005 (low), TEST-006 (low), TEST-007 (low), DEP-001 (low), DEP-002 (low)
- Ziel: Die Browser-Tests teilen ihre Helfer, prüfen, was sie zu prüfen behaupten, laufen nicht redundant, nutzen chai 6, und jedes Workspace-Paket deklariert seine Tools.
- Detail: `docs/remediation/paket-3.md`
- Bereich: `packages/twopoint5d-testing/`, `package.json` aller Workspace-Pakete und der Root, `pnpm-workspace.yaml` (Katalog), `pnpm-lock.yaml`, Kommentare in `.github/dependabot.yml` und `deploy.yml`, `AGENTS.md`, `docs/architecture.md`
- Hängt ab von: —
- Hash: a01acfd1
- Ergebnis: 0 Runden · alle fünf Findings behoben (Reviewer opus) · kein Bugfix, daher kein
  Regressionstest; Belege per Verfälschung rot gesehen: Kalibrierung von `countNodeBuilds()`
  ohne Hook wirft (`countNodeBuilds(): three compiled a material …`), Wachstumstest `a sprite
  hidden before its pool grows …` mit Kapazität 3 rot · Gate: 67/56/67/67 Dateien, Skip-Block
  1/3/3/3, keiner aus `display-fullscreen` · Lockfile: nur Importer, `@esm-bundle/chai` und
  `@types/chai@4.3.20` weg, `chai@6.3.0`/`@types/chai@5.2.3` waren schon über vitest aufgelöst ·
  klein: Importreihenfolge `stage-masks.test.js:18`, »starts a renderer« statt »renders« in
  `docs/architecture.md:247`/`web-test-runner.config.js:213`/`fixtures.js:40`, »the four first« in
  `docs/architecture.md:468`, Zeilenumbrüche in `docs/architecture.md`/`AGENTS.md` (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `import {expect} from 'chai'` (chai 6, `@types/chai` 5) · `countNodeBuilds(renderer)`
  in `packages/twopoint5d-testing/test/helpers/fixtures.js`, async, liefert `{count, stop}`, zählt
  über `renderer.debug.onNodeBuilderCreated` und reicht einen vorher gesetzten Hook weiter ·
  `countLit(pixels)` in `fixtures.js` · eine neue Testdatei, von deren Tests keiner rendert,
  gehört in `RENDERER_FREE_FILES` in `web-test-runner.config.js` (läuft dann unter Chromium
  WebGPU, Firefox, WebKit) · Reporter `skippedTestsReporter()` listet am Ende jedes Laufs die
  Skips je Launcher · Katalog um `@types/node`, `playwright`, `rimraf`, `typescript` erweitert;
  Tools stehen im Manifest des Pakets, das sie nutzt — die Root trägt nur Root-Scripts,
  `scripts/` und Workflows

### [x] 4. StageDirector: Transitionen, Stapel und Shape-Cache
- Findings: BUG-001 (high), RES-001 (high), TEST-004 (low), TEST-002 (medium), ASYNC-003 (medium), BUG-006 (medium), BUG-007 (medium), BUG-005 (medium), RES-005 (low, im Zug 0 aus Paket 6 gezogen: `#disposeShape()` entsteht hier für Eviction und Renderer-Wechsel, `dispose()` nutzt dieselbe Hilfe)
- Dazu (Zug 0, vorbestehend, gleiche Ursache — Listener unterbrechen eine Änderung mittendrin oder arbeiten gegen vorher gelesenen Zustand): Fehler von `OnStageAdded`-/`OnStageRemoved`-Listenern in `#join()` (`StageDirector.ts:1414`) und an ungefangenen `#release()`-Stellen (`:842`, `:855-857`, `:1625`); `push()` friert `belowLayer` nach Listenern des Sofortwechsels ein (`:767-771`); `updateFrame()` treibt einen im selben Frame begonnenen Run (`:978-983`) und updatet Stages nach einem `dispose()` aus einem Stage-`updateFrame()` weiter (`:1006-1009`)
- Ziel: Laufende Transitionen überstehen `setStack()`, `show()`, `push()` und werfende Listener mit konsistentem Stapel, und der Shape-Cache wächst nicht unbegrenzt.
- Detail: `docs/remediation/paket-4.md`
- Bereich: `packages/twopoint5d/src/stage/StageDirector*.ts`, `src/testing/stageFixtures.ts` (neu), `docs/stages.md`, `docs/proposals/stage-transitions.md`, `CHANGELOG.md`, `packages/twopoint5d-testing/test/stage-transitions.test.js`
- Hängt ab von: —
- Hash: f9a8bfde
- Ergebnis: 2 Runden · alle neun Findings und N1–N4 behoben (Reviewer opus, drei Durchgänge) ·
  Regressionstests je vor dem Fix rot, u. a. `setStack() keeps the stage a running transition
  brings` (expected [] to have a length of 1), `show() at a position puts a stage whose hide()
  runs there` ([b, a] statt [a, b]), `replace() refuses a ClearStage before it ends the running
  transition of the slot`, `push() shows the stage and freezes the one below when a listener of an
  end it causes throws`, `hide() refuses a slot a listener of the end it causes took out`,
  `dispose()`/`setStack() answers a change a listener asks for with a cancelled transition`,
  `a transition without an effect takes one shared crossfade…` (10 statt 1), `lets go of the
  shape it drew longest ago once it holds more than 16…`, `builds its shapes again for another
  renderer…` (Vitest und Browser `a director drawn by a second renderer draws its stack there`),
  `dispose() goes on past an effect whose dispose() throws…`; in den Runden `push()`/`show()`/
  `push() with at` und `a listener of OnStageAdded that disposes the director makes every change
  answer as a disposed director` (je 'pending' statt 'cancelled'), `precompile() rejects with the
  error of a failed compile and those of the shapes it let go of`, `draws a frozen layer once for
  another renderer…` · klein: zwei Reviewer-Befunde in der Paketdatei (einer als Folge unten)
- Nebenbefunde: keine (N5 stand schon seit Zug 0 in »Offene Befunde«)
- Folgen: `packages/twopoint5d/src/stage/StageDirector.ts:684` und `:1659-1660` — entsorgt der Join
  der Slot-Maske in `#show()` den Director (Listener von `OnStageAdded`/`OnAddToParent`), läuft
  `#useMasks()` weiter und `#join()` prüft und baut am entsorgten Director; hat derselbe Listener
  eine Effekt-Masken-Stage entsorgt, antwortet `show(c, {mask, effect: {masks: [n]}})` mit der
  Ablehnung »that stage has been disposed« statt mit einem abgebrochenen Handle — gegen den Satz in
  `docs/stages.md:941` und Proposal §5.4. Vorschlag des Reviewers: `if (this.isDisposed) return
  undefined;` ganz am Anfang von `#join()`. Dazu fehlt Spec-Abdeckung für `hide()`/`pop()` mit
  Effekt-Masken und `setMask()` über `OnAddToParent` (`StageDirector.spec.ts:777-842`). Für den
  Zug 0 von Paket 6 (Dispose-Konsistenz, dieselbe Datei) → verteilt im Zug 0 von Paket 6
  (2026-11-01): Symptom dieses Pakets, in Paket 6 aufgenommen statt eines eigenen Nachtragspakets
  (dieselben Methoden, deren Einstieg Paket 6 umbaut)
- Schnittstellen: `#join(subject, stage, errors, role?, scale?)` → `Layer | undefined` (undefined,
  wenn ein Listener in `super.add()` den Director entsorgt hat) · `#useMasks(subject, masks,
  errors)` mit Pflichtparameter `errors` · `#ignoresChanges()` (`isDisposed || #stackLocked > 0`)
  ist der Rückweg von `show()`/`hide()`/`replace()`/`push()`/`pop()`/`setStack()`/`setMask()` —
  Argumentprüfungen aus Paket 6 gehören davor · `#refuseStage()`/`#refuseLayer()` prüfen eine Stage
  vor jeder Änderung · `#shapes: Map<string, CachedShape>` mit `{shape, pinned}` (Paket 6 legt das
  Promise der Kompilierung daneben), `KEPT_SHAPES = 16`, `DEFAULT_EFFECT` (eingefrorener
  `crossfade()`), `#shapesFor(renderer, errors)`, `#disposeShape()`, `#lettingGoErrors` ·
  Sammeltexte über `changeThrew(subject)` · Testhilfe `packages/twopoint5d/src/testing/
  stageFixtures.ts`: `createRendererMock()`, `createPlainRenderer()`, `RendererSurface`,
  `fakeStage()`, `plainStage()`, `FakeStage`, `names`

### [x] 5. DisplayFullscreen und Display
- Findings: RES-002 (medium), BUG-002 (medium), ASYNC-001 (medium), ASYNC-002 (medium), BUG-003 (medium), TEST-001 (medium), BUG-008 (low), BUG-009 (low), API-001 (low), CONS-012 (info)
- Dazu (Zug 0, vorbestehend, gleiche Ursache — die Antwort eines Landscape-Requests wird nicht gegen den Zustand des Controllers gehalten): `#turned()` schaltet nach einer Ablehnung, die erst nach `dispose()` eintrifft, einen entsorgten Controller scharf (`DisplayFullscreen.ts:566-568`)
- Ziel: Fullscreen-Requests, Exits und Dispose überstehen werfende Listener und überlappende Aufrufe ohne hängenden Zustand, und ihr Verhalten nach `dispose()` ist dokumentiert.
- Detail: `docs/remediation/paket-5.md`
- Bereich: `packages/twopoint5d/src/display/`, `docs/display.md`, `docs/proposals/display-fullscreen.md`, der Auszug von `Display.dispose()` in `docs/resource-lifecycle.md` §4, `CHANGELOG.md`, `packages/twopoint5d-testing/test/display-fullscreen.test.js`
- Hängt ab von: —
- Hash: 4308cc70
- Ergebnis: 5 Runden · alle zehn Findings und der `#turned()`-Nebenbefund aus Zug 0 behoben (Reviewer
  opus, sechs Durchgänge) · Regressionstests je vor dem Fix rot, u. a. `a fullscreen listener that
  throws: request() resolves true, toggle() leaves, and the next request() asks the browser again`
  (expected false to be true), `dispose() while a request is pending: the controller leaves the
  fullscreen the browser grants afterwards, and the request resolves false`, `request() while an exit
  is under way asks the browser again once the exit is through`, `an armed tap the browser refuses arms
  again`, `a refusal that arrives after dispose() arms nothing`, `a fullscreen stacked on the target:
  isActive is false while it holds, …`, Browser `a fullscreen an element inside the target stacks on
  it: …` (Chromium, Firefox), `a resizeTo callback that reads display.fullscreen lets the constructor
  run through`, `isDisposed is false until dispose() and true after`; in den Runden `an exitFullscreen()
  that throws at once on the turn to portrait leaves the controller standing` (RangeError), Tabelle
  `overlapping calls: the last call of the page wins` (52 Zeilen, 17 rot), Tabelle `the refusal an
  exit() of the page sets in landscape belongs to that call: the last call wins` (12 Zeilen, 4 rot) ·
  Abweichungen: Changed-Eintrag im CHANGELOG zur neuen `AggregateError`-Meldung von `Display#dispose()`
  (veröffentlicht seit 0.24.0, gegen Entscheidung 10 des Zugs 0), kein Test für `fullscreenerror`
  (Entscheidung 9) · klein: ein Reviewer-Befund, unten als Folge
- Nebenbefunde: → Queue (fünf Einträge »aus Paket 5«)
- Folgen: `packages/twopoint5d/src/display/DisplayFullscreen.ts:613` — ein `request()` der Seite, während ein
  Element der App auf einem von `onLandscape` betretenen Ziel gestapelt ist, holt das Ziel nach oben,
  aber die Anhebung `#entered` → `'request'` greift nur bei `#nativeElement() != null`; die nächste
  Drehung ins Hochformat verlässt den Fullscreen der Seite, gegen die Zusage in
  `docs/proposals/display-fullscreen.md` §6.3 (»whoever asked for a fullscreen decides«), die erst dieses
  Paket gegeben hat. Vorschlag des Reviewers: Bedingung auf `this.#holdsTarget()`. Klein, sehr selten
  → verteilt im Zug 0 von Paket 6 (2026-11-01): Symptom dieses Pakets, Nachtragspaket 15
- Schnittstellen: `DisplayFullscreen#isDisposed` neu · nach `dispose()`: `isAvailable` `false`,
  `request()`/`exit()`/`toggle()` resolven `false`, ein offenes Promise ebenso, `isActive`/`mode`/
  `isSupported` lesen weiter Dokument bzw. Browser · `OnDisplayFullscreenChange` geht über `emitSafe()`
  (Host in `Display.ts:1097`), `DisplayFullscreenHost#emit` wirft nicht · `Display#dispose()`: Reihenfolge
  Pause → Fullscreen → Dispose-Event, mehrere Fehler als `AggregateError` mit `Display#dispose(): more
  than one step of the teardown threw`, `cause` = Fehler des letzten Schritts · `Display` erzeugt den
  Controller vor dem ersten `resize()` · Promise-Semantik überlappender Aufrufe: ein Lauf, aufgelöst
  mit dem Endzustand · intern `#run`/`#joinRun()`/`#endRun()`, `#leaveNative(declines)`,
  `PendingRequest {by, exitAfter, declines}`, `PendingExit {requestAfter, turnAfter, declines}`,
  `#holdsTarget()`, `#rearm()`

### [x] 6. StageDirector: Dispose, Eingaben, precompile und Lebenszyklus-Doku
- Findings: BUG-017 (low), API-002 (low), BUG-018 (low), ASYNC-005 (low), IMPL-002 (low) · RES-005 ist seit dem Zug 0 von Paket 4 in Paket 4
- Aus Paket 4 (Zug 0): API-002 setzt die Argumentprüfung vor den neuen Rückweg `#ignoresChanges()` (entsorgt oder `setStack()`/`dispose()` unter Sperre), ASYNC-005 legt das Promise der Kompilierung in den Cache-Eintrag `CachedShape` neben `pinned`
- Aus Paket 5 (Zug 0): die »never rejects«-Ausnahme in `resource-lifecycle.md` §3 nennt für `DisplayFullscreen`, was Paket 5 baut — ein beim `dispose()` offenes Promise von `request()`/`exit()`/`toggle()` resolved `false`, ein danach gewährter Fullscreen wird wieder verlassen, `isDisposed` ist neu. Den Auszug von `Display.dispose()` in §4 zieht Paket 5 selbst nach
- Dazu (Zug 0, Folge von Paket 4, Symptom — dessen `Folgen:`-Zeile): `#join()` prüft und baut an einem Director, den ein Listener eines früheren Joins desselben Aufrufs entsorgt hat (`StageDirector.ts:684` → `:1647-1660`), samt der fehlenden Spec-Abdeckung für `hide()`/`pop()` mit Effekt-Masken und `setMask()` über `OnAddToParent`
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie API-002 — aus »Offene Befunde«): Stage-Argumente von `hide()`, `replace()` (`from`), `setMask()`, `freeze()`/`run()` ohne Objektprüfung (`:738`, `:786`, `:1031`, `:1063`)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie BUG-017 — der Director hebt seinen eigenen Freeze über einen Zustand von Hand auf): `frozeBelow` taut beim `pop()`/`hide()` (`:765-768`), `#removeSlot()` (`:1791-1794`) und `setStack()` (`:999`) auch eine Layer auf, die der Aufrufer danach von Hand eingefroren hat; an der Basis d9b648bf `:679-681`, `:1517-1519`, `:850`
- Folge von: Paket 4 (nur der Teil »Dazu, Folge von Paket 4«; die fünf Findings nicht)
- Ziel: Der Director bleibt bei Dispose, Fehlereingaben und parallelen `precompile()`-Aufrufen konsistent, und `resource-lifecycle.md` beschreibt die neuen Features samt der »never rejects«-Ausnahme.
- Detail: `docs/remediation/paket-6.md`
- Bereich: `packages/twopoint5d/src/stage/StageDirector.ts` (+ `.spec.ts`), `transitionEffects.ts` (+ `.spec.ts`), TSDoc in `src/stage/StageTransition.ts` und `src/display/Display.ts`, `docs/resource-lifecycle.md`, `docs/stages.md`, `CHANGELOG.md`
- Hängt ab von: 4 (dieselbe Datei, setzt auf dessen Umbau), 5 (die Lebenszyklus-Doku beschreibt auch DisplayFullscreen)
- Hash: 6d041d1f
- Ergebnis: 0 Runden · alle fünf Findings und die drei »Dazu«-Punkte behoben (Reviewer opus, ein
  Durchgang, freigabefähig) · Regressionstests je vor dem Fix rot, u. a. `show() with a mask and the
  masks of an effect answers a cancelled transition when a listener of the join of the mask disposes
  the director and a mask stage of the effect` (»that stage has been disposed« geworfen), `refuses
  invalid arguments after dispose() as before, and answers valid ones as a disposed director`,
  `ignores a write to pipeline, buildOutputNode and renderOrder after dispose()`, `a change a listener
  asks for under the lock of setStack() refuses its invalid arguments`, `refuses a stage argument that
  is no object, with the call as its subject` (TypeError »reading 'name'«), vier Tests `a freeze()/run()
  by hand … stays …` (expected false to be true), `a second precompile() of a shape the first one still
  compiles resolves once that compile is through`, `a shape whose compile failed compiles again with
  the next precompile()`, `a precompile() that waits for a compile that fails rejects with its error`,
  `a compile that fails after dispose() resolves the precompile() that started it and the one that
  waits for it`, `refuses a direction that names a member of Object.prototype` · Abweichung:
  `docs/stages.md` »The stack and its slots« und Klassen-TSDoc nennen »throws until dispose()« für
  `renderOrder` · klein: zwei Umbrüche in der Doku (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: modulweit `stageArgument(subject, name, stage)` (TypeError für eine Nicht-Objekt-Stage)
  · `#refuseLayer()` entfernt, Argumentprüfungen stehen vor `#ignoresChanges()` · `CachedShape.compiling?:
  Promise<void>`, `#forgetFailedShape(key, entry, errors)` · `Run.fromByHand`/`toByHand`, gesetzt in
  `#setFrozen()`, das auch `slot.frozeBelow` löscht · `renderOrder`-Setter schweigt nach `dispose()`

### [x] 15. DisplayFullscreen: ein request() der Seite übernimmt den Fullscreen von onLandscape auch unter einem gestapelten Element
- Findings: — (Nachtrag zu Paket 5: dessen `Folgen:`-Zeile, im Zug 0 von Paket 6 als Symptom eingeordnet)
- Folge von: Paket 5
- Ziel: Ein `request()` der Seite macht einen Fullscreen, den `onLandscape` betreten hat, zu ihrem eigenen, auch während ein Element der App darauf gestapelt ist, sodass die nächste Drehung ins Hochformat ihn stehen lässt — wie `docs/proposals/display-fullscreen.md` §6.3 und das TSDoc von `request()` es zusagen.
- Detail: `docs/remediation/paket-15.md`
- Fundstellen: `packages/twopoint5d/src/display/DisplayFullscreen.ts:613` — die Anhebung `#entered` `'landscape'` → `'request'` hängt an `this.#nativeElement() != null` (Stand 4308cc70, im Zug 0 von Paket 6 nachgesehen); Vorschlag des Reviewers von Paket 5: Bedingung auf `this.#holdsTarget()` (`:935`). Zusage in `docs/proposals/display-fullscreen.md:365ff.` (§6.3, »whoever asked for a fullscreen decides«) und `DisplayFullscreen.ts:465-467`
- Bereich: `packages/twopoint5d/src/display/DisplayFullscreen.ts` (+ `.spec.ts`), `docs/proposals/display-fullscreen.md` (§6.3, §13.1), `docs/display.md` (»Which element goes fullscreen«); kein Browser-Test (die Übernahme zeigt sich erst an einer Drehung, die kein Runner macht)
- Steht hier, weil: klein und unabhängig, baut auf Paket 5 auf; Paket 6 davor berührt `DisplayFullscreen` nur in der Doku. In »Offene Befunde« stehen weitere Nebenbefunde derselben Datei aus Paket 5 — der Zug 0 von Paket 15 prüft, ob einer dieselbe Ursache hat
- Zug 0 (2026-11-01): Fundstelle unverändert (Datei seit 4308cc70 unberührt); die Bedingung an `:613` entfällt ganz statt auf `#holdsTarget()` zu wechseln (aus `#entered` folgt `#activeElement`, der Wächter griffe nie). Die fünf Nebenbefunde aus Paket 5 in derselben Datei teilen die Ursache nicht und bleiben in »Offene Befunde«; Begründung in der Paketdatei. Kein CHANGELOG-Eintrag (Fullscreen ist unveröffentlicht, nur unter `[Unreleased]`)
- Hängt ab von: 5
- Hash: 11f2b368
- Ergebnis: 0 Runden · Folge aus Paket 5 behoben (Bedingung `#nativeElement() != null` an der Übernahme entfallen, `DisplayFullscreen.ts:616`) · Regressionstests `a request() on a fullscreen onLandscape has entered while an element of the app lies on top of it makes it the page’s own: …` und `… is the page’s own before the browser answers: …` (vor dem Fix rot, 2 failed) · klein: zwei Absätze in Proposal §6.3 und `docs/display.md` ragged umbrochen, »—,« im Guide-Satz
- Nebenbefunde: keine
- Folgen: keine

### [x] 7. StageRenderer, Stage2D und Render-Target-Pool
- Findings: BUG-019 (low), BUG-029 (low), API-003 (low), API-004 (low), TYPE-004 (low), DOC-002 (low), PERF-003 (low)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie BUG-029 — der Join behandelt `host.onResize()` als reines Abo, obwohl ein Host mit gehaltener Größe darin schon den ersten `resize()` fährt): ein Listener dieses Replays, der den Renderer entsorgt oder umhängt, findet den Abo-Handle noch nicht gebucht (`StageRenderer.ts:400-404`) — Leck am Display bzw. Renderer an zwei Hosts
- Ziel: Renderer und Stage2D lehnen Fehleingaben sichtbar ab, geben ihren Zustand typsicher heraus und übernehmen Kamerawechsel ohne Shader-Rebuild.
- Detail: `docs/remediation/paket-7.md`
- Bereich: `packages/twopoint5d/src/stage/` ohne StageDirector, `docs/stages.md`, `CHANGELOG.md`, `packages/twopoint5d-testing/test/stage-pipeline.test.js`
- Zug 0 (2026-11-01): alle sieben Fundstellen unverändert (Dateien seit d9b648bf unberührt). Abweichungen mit Grund in der Paketdatei: `acquire()` verlangt ganze Zahlen statt `assertPositiveFinite()`; die Warnung für gemischte Schreiber nimmt einen Parent mit `outputRenderTarget` nicht aus und greift erst ab einer zweiten Stage; der Renderer vergleicht nach Kamera-/Szenen-Events die Pass-Nodes, statt neu zu bauen. Eine beim Join abgelehnte Größe macht den Join nicht rückgängig
- Hängt ab von: —
- Hash: 88a937ca
- Ergebnis: 1 Runde · alle sieben Findings und der Re-Entrance-Punkt behoben (Reviewer opus, zwei
  Durchgänge, zweiter ohne Befund) · Regressionstests je vor dem Fix rot, u. a. `makes attach() throw
  the error of a stage that refuses the size, after the join` (»the call threw nothing«), `leaves no
  subscription at the host when a stage disposes the renderer on that size` und `ends the join when a
  stage attaches the renderer to another host on that size` (expected 2 to be +0), `keeps needsUpdate
  when updateViewRect()/getViewRect() of the projection throws …` (4×, expected false to be true),
  `refuses <name> = <wert> with a RangeError before the pool changes` (15×), `hands out its stage items
  read-only, …` (TS2578 unused `@ts-expect-error`), `warns once when it draws such a child beside
  another stage` (0 calls), Stage2D `keeps its node for a new camera …` u. a. (anderer PassNode),
  StageRenderer »keeps the output node« (7×, 2 Builds statt 1), Browser `stage-pipeline.test.js`
  (`expected 2 to equal 1`, `node builds for the switch to B: expected 1 to equal +0`, alle vier
  Launcher) · Runde 1: Sammeltext des `parent`-Setters nennt die abgelehnte Größe, Rückblick im
  CHANGELOG gestrichen (gegen den Wortlaut der Paketdatei, die Konvention des Plans gilt) ·
  Abweichungen: `#composedPasses` wird beim `dispose()` geleert und ist eine Kopie von `passes`;
  Browser-Pixelprüfung über ein `outputRenderTarget` 320×200 · klein: keiner offen
- Nebenbefunde: → Queue (ein Eintrag »aus Paket 7«)
- Folgen: keine
- Schnittstellen: `StageItem` mit vier `readonly`-Feldern; intern `type StageItemRecord` (nicht
  exportiert), `resizeStage(stageItem: StageItem, …)` unverändert, schreibt über `StageItemRecord` ·
  `StageRenderTargetPool#acquire()` wirft `RangeError` für `width`/`height` ≠ ganze Zahl ≥ 1 und
  `samples` ≠ ganze Zahl ≥ 0, vor `#disposed` (modul-lokal `assertWholeNumber()`) · `Stage2D#asPassNode()`
  liefert einen Node für die Lebensdauer der Stage, `scene`/`camera` werden hineingeschrieben;
  `#passNodeScene`/`#passNodeCamera` entfallen · `StageRenderer`: `OnStageAfterCameraChanged`/
  `OnStageAfterSceneChanged` setzen `#passesToCheck`, `#composedPassesChanged()` vergleicht mit
  `#composedPasses` (Kopie beim Rebuild, verschachtelte Renderer ausgenommen) · `#addToHost()` hält
  eine im Abo nachgereichte Größe und ruft `resize()` nach beiden Abos; `OnAddToParent` nur bei
  `!#disposed && #parent === parent` · Sammeltext `StageRenderer#parent: more than one listener of
  OnRemoveFromParent, OnStageRemoved and OnAddToParent, subscribe or unsubscribe at a host, or a stage
  that refused the size of the host threw` · `#warnAboutPipelineChild()` einmal je Renderer im plain
  mode ab zwei Stages · Browser-Helfer `makeComposedSquare()` in `stage-pipeline.test.js`

### [x] 8. Texturen: Parser, Ressourcen, Loader und DynamicAtlas
- Findings: RES-006 (low), BUG-021 (low), BUG-022 (low), BUG-023 (low), BUG-024 (low), CONS-010 (low), BUG-025 (low), RES-007 (low), BUG-026 (low), PERF-004 (low)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie RES-007 — die Freigabe einer abgelösten Textur im `finally` lässt einen werfenden `dispose`-Listener ungefangen): `#takeBackImage()` (`TextureResource.ts:1029-1037`)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie BUG-024 — ohne `onErrorCallback` verschwindet ein Fehler von `load()`): der Ladefehler, den `PowerOf2ImageLoader.load()` ungeprüft an three's `ImageLoader` durchreicht (`PowerOf2ImageLoader.ts:81`)
- Ziel: Atlas- und Animations-Eingaben werden vollständig geprüft und kopiert, Fehler nicht verschluckt, `atlasUrl` verhält sich wie `imageUrl`, und die Dirty-Liste des DynamicAtlas ist konstant im Aufwand.
- Detail: `docs/remediation/paket-8.md`
- Bereich: `packages/twopoint5d/src/texture/` (+ Specs), `docs/sprites.md` (»Aseprite sheets«), `docs/textures.md` (»Reloading and swapping«), `CHANGELOG.md` (Changed mit Migration Guide, Fixed)
- Zug 0 (2026-11-01): alle zehn Fundstellen unverändert (`src/texture/` seit d9b648bf nur in `sampleAtlasFrame.ts` berührt). Abweichungen und Wahl mit Grund in der Paketdatei: Repeat-Grenze `FrameBasedAnimations.MaxTextureSize` gespielter Frames (Präzedenz `tileCount`); `TexturePackerJson.parse()` prüft `meta` als Objekt, nicht `meta.image`; `PowerOf2ImageLoader` meldet ohne Callback über `console.error` statt zu werfen; ein `meta.image` eines Jsons von außen, das kein String ist, nennt kein Bild und wird nicht gemeldet (Vertrag der Spec für ein Json ohne Bild); eine gelöschte `atlasUrl` nimmt nur ein geholtes Json zurück — CHANGELOG `Changed` mit **BREAKING**, Migration Guide, Commit mit `!`. Restplan unverändert: kein offenes Paket berührt `src/texture/`
- Hängt ab von: —
- Hash: fd239a63
- Ergebnis: 0 Runden · alle zehn Findings und beide »Dazu«-Punkte behoben (Reviewer opus, freigegeben) ·
  Regressionstests je vor dem Fix rot, u. a. `refuses a tag whose repeat plays more frames than a data
  texture holds` (»expected function to throw«), `the slices of a frame are frozen copies of their key, …`
  (Object.is derselben bounds), `refuses a meta that is undefined / "x", with parentCoords as well`,
  `refuses timing that is neither a number nor an object, …` (»Cannot read properties of null«),
  `refuses a frame of a list that is no TextureCoords, …`, `writes a padding that fails / an image that
  does not load to the console without an onErrorCallback` (0 calls), `reports a dispose listener … that
  throws` (3×, `[]` bzw. roher Wurf aus dem Setter), `an atlasJson written from outside whose meta is no
  object names no image` (AggregateError aus signalize), `… whose meta.image is no string loads no image`
  (`loadAsync(42)`), `beside an overrideImageUrl, … reported once …` (rohe Meldung »reading 'app'«),
  `a cleared atlasUrl takes back the json fetched from it, …` · ohne roten Lauf: Ping-Pong über einen Frame
  mit `repeat: "1000000000"` (hinge vor dem Fix) · Abweichung: drei bestehende Aseprite-Specs von 9000 auf
  8192 Frames gezogen; die Prüfung auf `MaxFramesWithDurations` greift damit nur noch bei genau 8192
  gespielten Frames · klein: 2 (Paketdatei)
- Nebenbefunde: → Queue (ein Eintrag »aus Paket 8«)
- Folgen: keine
- Schnittstellen: `AsepriteJson.parse()` wirft für einen Tag über `FrameBasedAnimations.MaxTextureSize`
  gespielte Frames (ohne Playback-Override) · `AsepriteFrameSlice` eingefroren, ein Objekt je Key ·
  `TexturePackerJson.parse()` wirft `TypeError`, wenn `meta` kein Objekt ist, auch mit `parentCoords` ·
  `FrameBasedAnimations#add()` wirft `Error` für Timing ohne Zahl/Objekt und Listen-Frames ohne
  `TextureCoords` (Wert-Import `TextureCoords` in `FrameBasedAnimations.ts`) · `PowerOf2ImageLoader#load()`
  ohne `onErrorCallback` → `console.error` · `AtlasTextureResource#atlasUrl = undefined` nimmt ein
  geholtes Json samt `imageUrl`, `imageCoords`, `texture` (disposed), `atlas`, `frameBasedAnimations`
  zurück (**BREAKING**, CHANGELOG Changed + Migration Guide) · modul-lokal in `TextureResource.ts`:
  `disposeCaught()`, `imageNamedBy()` · `DynamicAtlas#dirty` ist ein `Set<FrameRect>`

### [x] 9. Sprites, Text und Fehlermeldungen
- Findings: BUG-016 (low), CONS-008 (low), CONS-009 (low), RES-004 (low), TYPE-003 (low), BUG-014 (low), CONS-011 (low), CONS-006 (low)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie CONS-006 — Graph-Helfer, die `src/testing/spriteGraph.ts` führt, als lokale `traverse()`-Kopie in einer Spec): `src/map2d/TileSprites/TileSpritesMaterial.spec.ts:9-25`, `src/stage/StageDirector.masks.spec.ts:14-21`, `src/stage/maskNodes.spec.ts:66-72`
- Ziel: FeatureSprites, SpriteResources, SpritePicker und BitmapFont prüfen ihre Eingaben einheitlich, halten ihre Caches begrenzt und benennen abgelehnte Werte über `describeValue()`/`describeThreeValue()`.
- Detail: `docs/remediation/paket-9.md`
- Bereich: `packages/twopoint5d/src/sprites/`, `src/text/`, `src/testing/`, eine Meldung in `src/stage/ParallaxProjection.ts`, Specs in `src/stage/` und `src/map2d/TileSprites/`, `docs/sprites.md`, `docs/proposals/pipeline-stages-and-grid-base.md`, `CHANGELOG.md` (Changed mit **BREAKING** und Migration Guide, Fixed)
- Zug 0 (2026-11-01): alle acht Fundstellen unverändert (CONS-006 um Zeilen verschoben). RES-004 nach der Entscheidung vom 2026-10-31: WeakRef, keine harte Grenze und kein `FinalizationRegistry` — eine Grenze würfe für heutige Aufrufer mit vielen Rastern, die Identität zählt nur zwischen gehaltenen Objekten, und die Rückstände sind höchstens 25 846 Schlüssel; Grenze beziffert im JSDoc. Abweichung: CONS-008 lässt `null` durch und leert damit den Slot (Idiom von three.js, heute lauffähig). `BitmapFontInfo`-Listen werden `readonly` (**BREAKING**, Commit mit `!`). Drei neue Nebenbefunde nach »Offene Befunde«; Restplan unverändert
- Hängt ab von: —
- Hash: e2bf6480
- Ergebnis: 0 Runden · alle acht Findings und der »Dazu«-Punkt behoben (Reviewer opus, freigegeben) ·
  Regressionstests je vor dem Fix rot: `refuses › a material built for a pass, and leaves nothing built
  and the material alone` (kein Wurf), in `SpriteResources.spec.ts` sechs zur Texturprüfung (kein Wurf,
  `expected null to be undefined`), `refuses a texture that is no three.js Texture in the name of whoever
  builds the resources` (nach dem Fix geschrieben, gegen den alten `SpriteResources.ts` rot), `is refused
  next to a copy of Rotation or Shear, judged by the name of the feature`, `lets go of a grid nothing
  holds, and answers a held one with every call` (Basis lebte weiter), drei in `BitmapFont.spec.ts` zu
  eingefrorenen Kopien · ohne roten Lauf: Meldungen (Schritt 7), Feldkopie des Pickers, Graph-Helfer ·
  gemeldete Folge `docs/proposals/dynamic-atlas-and-bitmap-text.md:361/389` vom Reviewer verworfen (das
  Proposal nennt `Readonly<BitmapFontInfo>`, weiterhin wahr) · klein: 3 (Paketdatei)
- Nebenbefunde: → Queue (ein Eintrag »aus Paket 9 (Runde 0)«)
- Folgen: keine
- Schnittstellen: `BitmapFontInfo.padding`/`spacing`/`charset` `readonly` (**BREAKING**), `info` und
  `common` tief eingefroren · `SpriteResources` wirft für eine Textur ohne `isTexture` (Konstruktor und
  `setTexture()`, auch nach `dispose()`), `null` leert den Slot · `new FeatureSprites(kind, {material})`
  wirft für ein Pass-Material · SegmentPlacement lehnt Features namens `rotation`/`shear` ab ·
  `gridBase()` hält Basen über `WeakRef` · neu in `src/testing/spriteGraph.ts`: `unwrap()`,
  `attributeNameOf()`, `textureBasesOf()`

### [x] 10. Vertex Objects und Event-Namen
- Findings: RES-008 (low), BUG-027 (low), READ-006 (low), API-005 (low), CONS-014 (low)
- Ziel: Vertex-Object-Geometrien rollen gescheiterte Konstruktion zurück, lesen Buffer-Daten sicher und melden Use-after-free sprechend, und die Event-Namen tragen ein Emitter-Präfix.
- Detail: `docs/remediation/paket-10.md`
- Bereich: `packages/twopoint5d/src/vertex-objects/` (+ README), `src/events.ts` (+ neu `events.spec.ts`), Literale in `src/stage/Canvas2DStage.spec.ts` und drei `pan-control-*.test.js` in `packages/twopoint5d-testing/test/`, `docs/resource-lifecycle.md` (§1, §5), `docs/stages.md` (»Events«), `CHANGELOG.md` (Changed mit **BREAKING** und Migration Guide, Fixed)
- Zug 0 (2026-11-01): alle fünf Fundstellen unverändert (`src/vertex-objects/` und `src/events.ts` seit d9b648bf nur in einer Spec berührt). Wahl und Abweichungen mit Grund in der Paketdatei: READ-006 als Wächter `=== undefined` je Accessor mit Fehler außerhalb gebaut (`voBuffer` bleibt `undefined`, kein Sentinel), Meldung `VO#<accessor> is not available: …`, Bench vorher/nachher mit Ausweichform bei mehr als 10 % Verlust; CONS-014 als eine Regel für ganz `events.ts` — Wert = Konstantenname ohne `On` —, Ausnahme nur `'dispose'` von `OnStageDispose`/`OnCanvas2DStageDispose`, `OnDisplayDispose` wird `'displayDispose'`, Namen der Konstanten bleiben, gehalten von neuem `events.spec.ts`; API-005 zusätzlich ein Absatz in `resource-lifecycle.md` §5. Keine offene Folge, kein Eintrag in »Offene Befunde« teilt die Ursache. Restplan unverändert: 11 berührt die Accessoren nur über seine Allocation-Specs (das Gate von 10 hält sie), 12 und 13 abonnieren Display-Events nur über Konstanten bzw. berechnete Schlüssel (`quadtree-playground.astro:38`) und ziehen nichts nach
- Hängt ab von: —
- Hash: b3de20ef
- Ergebnis: 0 Runden · RES-008, BUG-027, READ-006, API-005, CONS-014 behoben (Reviewer: freigegeben) · Regressionstests, alle vor dem Fix rot: `VertexObjectGeometry.spec.ts` »a constructor that throws« (4), `VertexObjectPool.spec.ts` »builds a fresh array for a buffer named %s that the buffers data does not hold« (3), `createVertexObjectPrototype.spec.ts` »a vertex object its pool has let go of« (14), neu `src/events.spec.ts` »event names« (2) · Bench `hot-path.bench.ts` ohne Verlust, Wächter-Form bleibt · klein: alte Event-Kurznamen in Kommentaren von `PanControl2D.ts`/`PanControl2D.spec.ts`, doppelter Kommentar in `VertexObjectGeometry.ts` (Paketdatei)
- Nebenbefunde: → Queue (2)
- Folgen: keine
- Schnittstellen: Event-Werte (**BREAKING**, Konstanten-Namen unverändert): Wert = Konstantenname ohne `On`, erster Buchstabe klein — `OnDisplayResize` `'displayResize'`, `OnDisplayRenderFrame`, `OnDisplayInit`, `OnDisplayStart`, `OnDisplayRestart`, `OnDisplayPause`, `OnDisplayDispose`, `OnDisplayError`, `OnDisplayFullscreenChange`, `OnCanvas2DStageResize`, `OnCanvas2DStageRender`, `OnPanControl2DUpdate`, `OnPanControl2DHideCursor`, `OnPanControl2DRestoreCursor` entsprechend; nur `OnStageDispose`/`OnCanvas2DStageDispose` teilen `'dispose'`; `src/events.spec.ts` hält die Regel über jeden Export · jeder generierte VO-Accessor wirft für ein losgelassenes Objekt `Error` `VO#<accessor> is not available: this vertex object has been released by its pool — …` · `VOBufferGeometry`/`VertexObjectGeometry`-Konstruktoren disposen bei Wurf den selbst gebauten Pool und lassen einen übergebenen ungebunden

### [x] 11. map2d: Sichtbarkeit, Chunk-Quad-Tree, Spatial Hash Grid und Guide
- Findings: PERF-001 (low), IMPL-001 (low), PERF-002 (low), CONS-004 (low), CONS-013 (low), API-006 (info), BUG-028 (info) · READ-005 ist im Zug 0 nach Paket 11b geteilt
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie CONS-004 — ohne Helfer für »endlich mit Untergrenze« und »ganze Zahl« prüft jede Stelle von Hand, und die Meldungen sind auseinandergelaufen: »of at least 1«, »of 0 or above«, »above 0 or Infinity«, »a non-negative integer« neben »of 0 or more«): die Grundform-Prüfungen außerhalb von `map2d/` in `stage/`, `texture/`, `text/BitmapFont.ts`, `display/FrameLoop.ts` und `vertex-objects/`, abschließend aufgezählt in Schritt 4 der Paketdatei
- Ziel: map2d teilt seine Bäume effizient, nullt nur den nötigen Bereich, prüft Grenzwerte zentral, hat `clear()` am Hash Grid, und der Guide beschreibt alle Bausteine.
- Detail: `docs/remediation/paket-11.md`
- Bereich: `packages/twopoint5d/src/map2d/` (ohne die Suche von `CameraBasedVisibility`), neu drei Helfer in `src/utils/`, die Prüfstellen in `src/stage/`, `src/texture/`, `src/text/BitmapFont.ts`, `src/display/FrameLoop.ts`, `src/vertex-objects/` samt Specs, `docs/map2d.md`, `AGENTS.md` (Regel »Error and warning messages«), `CHANGELOG.md` (Added, Changed mit Migration Guide, Fixed)
- Zug 0 (2026-11-01): alle acht Fundstellen unverändert (`src/map2d/` seit d9b648bf nur in einer Spec berührt). Wahl und Abweichungen mit Grund in der Paketdatei: READ-005 als reiner Refactor nach 11b geteilt (eigener `refactor:`-Commit, an unveränderten Specs nachprüfbar); PERF-001 legt die fehlende Achse auf die Außenkante der Chunks, nicht auf `Infinity`; PERF-002 nullt nur den gebrauchten Bereich und verkleinert nicht; CONS-004 mit `assertFiniteAtLeast()`, `assertWholeNumber()`, `assertWholeNumberOrInfinity()` und dem Wortlaut »of N or more« für jede Grundform-Meldung der Library, die Regel in `AGENTS.md` nennt danach alle fünf Helfer; CONS-013 `readonly` (Typänderung, Commit mit `!`); BUG-028 floort im lokalen Index. Keine offene Folge; kein Eintrag in »Offene Befunde« teilt eine Ursache. Restplan: 11b neu hinter 11; 12 und 13 (Lookbook) unberührt — die Quad-Tree-Demo zeichnet eine Einachsenteilung auf der Außenkante, ohne Änderung
- Hängt ab von: —
- Hash: b91ab441
- Ergebnis: 0 Runden · alle sieben Findings und die »Dazu«-Stellen aus Schritt 4 behoben (Reviewer opus,
  freigegeben) · Regressionstests je vor dem Fix rot: `subdivide() > chunks that only one axis separates`
  »splits a row into a west and an east quadrant, …«, »splits a column into a north and a south
  quadrant, …«, »puts a chunk appended beyond the row into a quadrant of its own« (expected true to be
  false), `readDataIdAt() at a fractional point` »answers the id of the cell the point lies in«
  (undefined statt 1), »counts the cells from the corner of a chunk away from the origin« (4 statt 3),
  »… at a fractional position«, »answers an id for every point the chunk contains«; neun Tests
  `clear() and size` (`grid.clear is not a function`); Typtest `RectangularVisibilityAreaHelpers.spec.ts`
  (TS2578); Helfer-Specs gegen fehlende Module · vorher grün, Abdeckung: »a recomputation after a smaller
  area lays out every tile a larger one covers again« · Abweichung: Brute-Force-Spec der Achsenwahl auf
  die Einachsenregel umgestellt; CHANGELOG `Added` nennt zusätzlich die neuen Guide-Abschnitte · klein: 6
  (Paketdatei)
- Nebenbefunde: → Queue (vier Einträge »aus Paket 11«)
- Folgen: die Regel »Error and warning messages« in `AGENTS.md:123ff.` nennt jetzt alle fünf Helfer für
  jede Grundform-Meldung; zwei Grundform-Prüfungen außerhalb der abschließenden Liste aus Schritt 4 laufen
  weiter von Hand — `packages/twopoint5d/src/texture/TileSet.ts:287-290` (`baseCoords.width`/`height` »a
  finite number«, `tileWidth`/`tileHeight` »a finite number above 0« über `assertOption()`, wären
  `assertFinite()`/`assertPositiveFinite()` mit identischer Meldung) und
  `packages/twopoint5d/src/texture/DynamicAtlas.ts:568-575` (`check` in `#sizeOf()` baut die Meldung von
  `assertPositiveFinite()` von Hand nach, kein Hot Path). Für den Zug 0 von Paket 11b → verteilt im Zug 0
  von Paket 11b (2026-11-01): Symptom dieses Pakets, Nachtragspaket 16
- Schnittstellen: neu (intern, nicht in `public-api.ts`) in `src/utils/`:
  `assertFiniteAtLeast(value, subject, name, min): number`, `assertWholeNumber(value, subject, name,
  min?): number`, `assertWholeNumberOrInfinity(value, subject, name, min): number`, je `RangeError`
  `Subject: name must be a finite number of N or more` / `a whole number[ of N or more]` / `… or more,
  or Infinity`, `, got <describeValue>` · Setter `frustumBoxScale`/`maxVisibleTiles`/`depth` von
  `CameraBasedVisibility` rufen diese Helfer (11b baut nur die Suche um) · `Map2DSpatialHashGrid#clear()`
  und `#size` neu · `RectangularVisibilityAreaHelpers#visibilityArea` `readonly` (**BREAKING**, Migration
  Guide) · `ChunkQuadTreeNode#subdivide()` teilt bei nur einer trennenden Achse in zwei Quadranten, die
  fehlende Origin auf `max(right)` bzw. `max(bottom)` (modul-lokal `farEdge()`) ·
  `DataIdsChunk2D#readDataIdAtLocal()` floort · Meldungswortlaut »of 0 or more« statt »of 0 or above«/»a
  non-negative integer« in `StageDirector`, `softness`-Effekten, `VertexObjectPool`, `VertexObjectBuffer`,
  `VOBufferPool`

### [x] 11b. map2d: die Suche von CameraBasedVisibility in eine eigene Klasse
- Findings: READ-005 (low) — im Zug 0 von Paket 11 abgeteilt; 11 behält seine Nummer, weil die Schleife das laufende Paket unter ihr führt
- Ziel: Die Nearest-first-Suche von `CameraBasedVisibility` — Frontier, Kept und Stop-Margin samt `#beginSearchStop()`, `#updateSearchStop()`, `#searchCanStop()` — steht in einer eigenen internen Klasse mit Feld-Objekt-Schnittstelle, ohne Verhaltensänderung und ohne neue Allokation auf dem Hot Path.
- Detail: `docs/remediation/paket-11b.md`
- Zug 0 (2026-11-01): Fundstelle unverändert, um zwei Zeilen verschoben (Klasse `:206`). Schnitt mit Grund in der Paketdatei: neue interne Klasse `NearestFirstTileSearch` (`src/map2d/NearestFirstTileSearch.ts`) mit `begin(stamp)`, `enqueue(tile, insideProbeHull)`, `run(): boolean` und `kept`; das Säen (Sondentiles, Hülle) und `#warnCapped()` bleiben in `CameraBasedVisibility`; die Sichtobjekte gehen einmal als `TileSearchView` hinüber, die Skalare samt Höhenbereich in einem `Float64Array(5)`; `#setBox()` wird die Modulfunktion `writeTileBox()` für Suche und Platzierung. Keine Spec ändert sich, kein CHANGELOG-Eintrag, kein eigener Spec. Folge aus Paket 11 (TileSet/DynamicAtlas) als Symptom → Nachtragspaket 16; kein Eintrag in »Offene Befunde« teilt die Ursache
- Bereich: `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`, eine neue interne Datei in `src/map2d/` (nicht in `public-api.ts`), die Allokationsspecs `src/map2d/hot-path-allocations*.spec.ts`
- Steht hier, weil: reiner Refactor des größten Hot-Path-Moduls, getrennt von den Verhaltensänderungen in 11, damit sein Commit (`refactor:`) an unveränderten Specs nachprüfbar ist; setzt auf 11 auf (dieselbe Datei, CONS-004 stellt dort die Setter um). Für Zug 0 aus dem Lesen in 11: Doubles kreuzen keinen Aufruf (Modulkommentar `CameraBasedVisibility.ts:59-64`) — die Objekte, die die Suche liest (`#tileWorldMatrix`, `#cameraWorldPosition`, `planeWorld`, `#cameraFrustum`, `#frustumHeight`), sind feste, in place beschriebene Felder und lassen sich der Suche einmal übergeben; Skalare (`depth`, `frustumBoxScale`, `maxVisibleTiles`) brauchen ein `Float64Array` wie `#seenScalars`; `#setBox()` dient Suche und Platzierung (`#placeTile()`) zugleich; `#warnCapped()` nennt `CameraBasedVisibility` und bleibt dort
- Hängt ab von: 11
- Hash: e176d089
- Ergebnis: 0 Runden · READ-005 behoben (Reviewer opus, freigegeben, keine Befunde) · Refactor ohne
  Regressionstest: kein Spec und keine Testdatei geändert, `pnpm run ci` grün einschließlich
  `test:allocations` · `CameraBasedVisibility.ts` 1299 → 1055 Zeilen · klein: 2 (Paketdatei)
- Nebenbefunde: → Queue (ein Eintrag »aus Paket 11b«)
- Folgen: keine
- Schnittstellen: neu (intern, nicht in `public-api.ts`) `src/map2d/NearestFirstTileSearch.ts`:
  `class NearestFirstTileSearch(view: TileSearchView)` mit `begin(stamp)`, `enqueue(tile,
  insideProbeHull)`, `run(): boolean` (true = Limit hat geschnitten), `readonly kept: KeptTiles` ·
  `interface TileSearchView {pool, tileWorldMatrix, cameraWorldPosition, planeWorld, cameraFrustum,
  scalars: Float64Array}` · Indizes `VIEW_DEPTH`, `VIEW_FRUSTUM_BOX_SCALE`, `VIEW_MAX_VISIBLE_TILES`,
  `VIEW_FRUSTUM_HEIGHT_MIN`/`MAX`, Länge `VIEW_SCALARS` · `writeTileBox(target, coords, scalars,
  forFrustum): Box3` · in `CameraBasedVisibility` sind `#cameraWorldPosition`, `#cameraFrustum`,
  `#tileWorldMatrix` jetzt `readonly`; `#frustumHeight` ist `#viewScalars`

### [x] 16. Zahlenprüfungen in TileSet, DynamicAtlas und VertexObjectDescriptor über die gemeinsamen Helfer
- Findings: — (Nachtrag zu Paket 11: dessen `Folgen:`-Zeile, im Zug 0 von Paket 11b als Symptom eingeordnet)
- Folge von: Paket 11
- Ziel: Die letzten Grundform-Prüfungen der Library, die ihre Meldung von Hand bauen, laufen über die Helfer aus `src/utils/`, wie die Regel »Error and warning messages« in `AGENTS.md` es seit Paket 11 verlangt — `TileSet` über `assertFinite()`/`assertPositiveFinite()` und `DynamicAtlas` über `assertPositiveFinite()` mit unverändertem Wortlaut, `vertexCount` von `VertexObjectDescriptor` über `assertWholeNumber(…, 1)` mit dem Wortlaut »a whole number of 1 or more« der übrigen Library.
- Detail: `docs/remediation/paket-16.md`
- Dazu (Zug 0, Symptom derselben Ursache — Paket 11 hat »a non-negative integer« in `vertex-objects/` angeglichen, »a positive integer« nicht): `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:157` (`vertexCount must be a positive integer`, an d9b648bf unverändert, in Schritt 4 von Paket 11 weder umgestellt noch ausgenommen); Wortlaut ändert sich, daher Ergänzung des `Changed`-Eintrags von Paket 11 (`CHANGELOG.md:60`)
- Fundstellen: `packages/twopoint5d/src/texture/TileSet.ts:287-294` (in `#createTextureCoords`: `baseCoords.width`/`height` »a finite number« und `tileWidth`/`tileHeight` »a finite number above 0« über `assertOption()` — `TileSet: <name> must be …, got <describeValue>` ist genau der Wortlaut von `assertFinite(…, 'TileSet', 'baseCoords.width')` bzw. `assertPositiveFinite(…, 'TileSet', 'tileWidth')`) · `packages/twopoint5d/src/texture/DynamicAtlas.ts:568-575` (`check` in `#sizeOf()`: `${WHERE}: the ${what} of the frame ${describeValue(name)} must be a finite number above 0, got …`, danach `Math.ceil`; kein Hot Path). Beide im Zug 0 von 11b an b91ab441 nachgesehen, an der Basis d9b648bf schon gleich (`TileSet.ts:285-291`, `DynamicAtlas.ts:580`)
- Nicht dazu: `VOBufferPool.ts:139-142` aus »Offene Befunde« teilt das Thema, nicht die Ursache (fehlende Typprüfung, `undefined` → `NaN`; ein Setter, der ±Infinity annimmt und klemmt, passt auf keinen Helfer); `sampleAtlasFrame.ts:103-105` und die übrigen eigenen Satzformen hat Paket 11 in seinem Schritt 4 bewusst ausgenommen
- Bereich: `packages/twopoint5d/src/texture/TileSet.ts`, `src/texture/DynamicAtlas.ts`, `src/vertex-objects/VertexObjectDescriptor.ts` (+ TSDoc `:114`), je ihre Spec, `CHANGELOG.md` (nur der bestehende `Changed`-Eintrag `:60`)
- Steht hier, weil: klein und unabhängig, schließt CONS-004 aus Paket 11 bibliotheksweit ab; berührt weder 11b (`src/map2d/`) noch 12/13 (Lookbook)
- Zug 0 (2026-11-01): `TileSet.ts:287-295` und `DynamicAtlas.ts:568-575` unverändert; `VertexObjectDescriptor.ts:157` als drittes Symptom aufgenommen (Suche über `src/` nach handgebauten Zahlenmeldungen, jeder andere Treffer sagt mehr als die Grundform, teilt die Satzform seiner Nachbarn, ist ein begründeter Hot Path oder nimmt `±Infinity` — Liste »Nicht anfassen« in der Paketdatei). Wahl mit Grund in der Paketdatei: zwei Specs halten den Wortlaut fest (`baseCoords.height`, Nicht-Zahl in `DynamicAtlas`); die zusammengesetzten »integer«-Meldungen in `VertexObjectDescriptor` bleiben, wie Paket 11 sie stehen ließ; Commit `fix`, weil die `vertexCount`-Meldung sich sichtbar ändert. Keine offene Folge; kein Eintrag in »Offene Befunde« teilt die Ursache (`VOBufferPool.ts:138-142` bleibt). Restplan unverändert: 12 und 13 (Lookbook) prüfen keinen dieser Wortlaute
- Hängt ab von: 11
- Hash: 06c8ccb7
- Ergebnis: 0 Runden · drei Symptome behoben (`TileSet.ts:289-292` über `assertFinite`/`assertPositiveFinite`, `DynamicAtlas.ts:569-570` über `assertPositiveFinite`, `VertexObjectDescriptor.ts:157` über `assertWholeNumber(…, 1)`) · Specs `a vertexCount that is no whole number of 1 or more` und `a vertexCount given as a string, quoted` vor der Änderung rot (2 failed), neu `a baseCoords height that is not finite is refused` und `DynamicAtlas` `'4'`-Zeile · CHANGELOG `:60` ergänzt · klein: TSDoc `VertexObjectDescriptor.ts:115-117` Punkt 2 sagt weiter »a positive integer `size`« neben »whole number« in Punkt 1
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: Meldung von `new VertexObjectDescriptor()` für `vertexCount` lautet »vertexCount must be a whole number of 1 or more, got …«

### [x] 12. Lookbook: Module der Masken-Demos
- Findings: ARCH-001 (low), BUG-010 (low), BUG-011 (low), READ-001 (low), READ-002 (low), CONS-001 (low), TYPE-001 (low), TYPE-002 (low) · der Atlas-Teil von ARCH-001 geht im Zug 0 an Paket 13 (CONS-002); ARCH-001 schließt erst mit 13
- Dazu (Zug 0, vorbestehend, gleiche Ursache): BUG-011 — `MothChapel.ts:771` würfelt die Rast pro Frame aus der Folge, die auch `RoseWindow` speist; die Ereignis-Termine `CrawlRig.ts:159`/`FoundFootage.ts:133` rechnen vom Frame statt vom fälligen Zeitpunkt · READ-001 — neun weitere Kappungen in `stage-masks/` und `pages/demos/stage-masks-resolution.astro:205`, `demos/rope-bridge/RopeBridge.ts:417`, `demos/ui-panels/DungeonScreen.ts:397` · READ-002 — `PaintingHallway.ts:188` · CONS-001 — `DrownedHouse.ts:189/:192`, `PaintedMoor.ts:130-131` · TYPE-002 — `demos/stage-transitions/glowLayerBuilder.ts:10-27` (lokaler `Vec4`, Casts um einen Builder)
- Ziel: Die Masken-Demos teilen ihre Helfer in einem Modul, rechnen framerate-unabhängig und randkorrekt und kommen ohne wirkungslose Casts aus.
- Detail: `docs/remediation/paket-12.md`
- Bereich: `apps/lookbook/src/demos/stage-masks/` (neu `helpers.ts`), `demos/stage-transitions/glowLayerBuilder.ts`, `demos/rope-bridge/RopeBridge.ts`, `demos/ui-panels/DungeonScreen.ts`, `pages/demos/stage-masks-resolution.astro`, `pages/demos/_stage-masks-heat-haze.json`; kein Library-Code, kein CHANGELOG
- Zug 0 (2026-11-01): `stage-masks/` seit d9b648bf unberührt, alle Fundstellen an ihren Zeilen. Wahl und Abweichungen mit Grund in der Paketdatei: gemeinsames Modul `stage-masks/helpers.ts` (nicht `shared.ts` — Name der Demo `stage-masks-shared`) mit `SeededRandom` (mulberry32 = `InkRandom`, bitgleich; die Park-Miller-Szenen behalten ihre Seeds und ziehen eine andere feste Folge, Vorschaubilder bleiben), `randomAt(seed, index)`, `smoothstepCpu`, `hash21`, `additive`/`multiply`; Stottern und Kamerasprung über `randomAt(…, floor(t·20))`; BUG-010 teilt durch den Abstand der geklemmten Punkte; unter @types/three 0.187 fallen auch die `bloom()`-Casts in `MirrorShatter.ts:242/:245`. Kein Regressionstest im Repo (das Lookbook hat keine Testoberfläche): rot/grün belegen vier Proben außerhalb des Repos (`<Arbeitsverzeichnis>/paket-12-probe/`, im Zug 0 alle rot). Keine offene Folge; kein Eintrag in »Offene Befunde« teilt eine Ursache; drei neue Nebenbefunde dorthin. Restplan: Paket 13 bekommt den Atlas-Teil von ARCH-001, Reihenfolge unverändert
- Hängt ab von: 1 (three-API)
- Hash: 0beb1f44
- Ergebnis: 0 Runden · ARCH-001 (ohne Atlas-Teil, schließt mit 13), BUG-010, BUG-011, READ-001, READ-002, CONS-001, TYPE-001, TYPE-002 laut Review behoben · Regressionsbelege außerhalb des Repos (das Lookbook hat keine Testoberfläche): Proben `paket-12-probe/` im Arbeitsverzeichnis — `helpers.probe.ts`, `heatHaze.probe.ts`, `crawlRig.probe.ts`, `footageClock.probe.ts`, vor der Änderung alle vier rot, danach 33/33 grün · `Math.min(deltaTime` und `as unknown as` im Lookbook-Quelltext ohne Treffer · wie im Zug 0 entschieden zeigen `stage-masks-shared`/`-rift`/`-frozen`/`-portal` eine andere Zufallsanordnung als ihr Vorschaubild · klein: Import-Reihenfolge `Trench.ts:36-38`, `PaintedMoor.ts:31`; Modul-TSDoc in `helpers.ts` hängt vor `STEP`; holpriger Gedankenstrich im TSDoc von `heatHaze.ts`; `SeededRandom.range()` ohne TSDoc
- Nebenbefunde: → Queue (zwei Lint-Warnungen in Library-Specs)
- Folgen: keine
- Schnittstellen: neu im Lookbook `apps/lookbook/src/demos/stage-masks/helpers.ts`: `class SeededRandom` (`next()`, `range()`; mulberry32, bitgleich zum entfernten `InkRandom` aus `InkWell.ts`), `randomAt(seed, index)`, `smoothstepCpu`, `hash21`, `multiply`, `additive` · `InkRandom` entfernt · die `update`-Methoden der Szenen nehmen `dt` ohne Kappung

### [x] 13. Lookbook: Demo-Seiten — Start, precompile(), Transitions-Steuerung und Tasten
- Findings: BUG-004 (medium), READ-004 (low), RES-003 (low), CONS-003 (low), BUG-013 (low) · CONS-002, BUG-012, READ-003 und der Atlas-Teil von ARCH-001 sind im Zug 0 nach Paket 13b geteilt
- Dazu (Zug 0, vorbestehend, gleiche Ursache): BUG-013 — alle 21 Seiten mit `onInit(async …)`, auch außerhalb des Masken-Slices · CONS-003 — die zehn eigenen `.catch()` an `precompile()` (Kopien mit drei Wortlauten) · RES-003/READ-004 — die Tasten-Handler von `stage-masks-frozen`, `-shared`, `-resolution`, `-portal`, `-flashlight`, `-rift`, `-spotlight` (je eigener Filter; `rift`/`spotlight` schlucken Pfeiltasten in Feldern von lil-gui)
- Ziel: Die Demo-Seiten melden einen gescheiterten Start und ein gescheitertes `precompile()` unter ihrem Namen in der Konsole und über dem Canvas, die Galerie zeichnet B und ihre Masken-Stages vorab, die vier Matte-Seiten teilen eine Transitions-Steuerung, und jeder Tastenkürzel-Handler lässt die Tasten eines lil-gui-Feldes oder -Buttons diesem; das Game-Menu meldet seine Listener beim Dispose ab.
- Detail: `docs/remediation/paket-13.md`
- Bereich: `apps/lookbook/src/pages/demos/` (21 Seiten), neu `src/demos/utils/demoInit.ts` und `demoKeys.ts`, neu `src/demos/stage-masks/TransitionCycler.ts`, `src/demos/stage-transitions/matteMasks.ts`, eine CSS-Regel in `src/layouts/VanillaDemo.astro`, `apps/lookbook/README.md` (»Adding a demo«); kein Library-Code, kein CHANGELOG
- Zug 0 (2026-11-01): alle fünf Fundstellen unverändert (BUG-013 um eine Zeile verschoben; die Seiten seit d9b648bf bis auf `stage-masks-resolution.astro:205` unberührt). Wahl und Abweichungen mit Grund in der Paketdatei: geteilt in 13 (Seiten) und 13b (Asset-Laden der Szenen); Helfer `onDemoInit()`/`catchPrecompile()` in `demoInit.ts` für alle 21 bzw. 13 Stellen, sichtbare Meldung mit Fallback auf `document.body` (`first-sprite` hat kein `<demo-ui>`), im Fehlerfall kein `preview.ready()`; `ignoredKey()` lässt einem Button und einer Checkbox nur Space/Enter (ein Pfeil auf einem fokussierten Button steuert weiter); `layers: [b.stage, ...mattes.maskStages]` wie empfohlen; `TransitionCycler` mit Readouts nur bei Änderung, GUI-Reihenfolge auf zwei Seiten geändert. Rot/grün über Proben außerhalb des Repos (`<Arbeitsverzeichnis>/paket-13-probe/`, vom Implementierer vor der Änderung geschrieben). Keine offene Folge; der Eintrag `matte-threshold.astro:197/:201` in »Offene Befunde« teilt keine Ursache und bleibt. Restplan: 13b neu hinter 13
- Hängt ab von: 12 (Szenen-Dateien unter `stage-masks/`, die 12 umgebaut hat)
- Hash: 353a7dbd
- Ergebnis: 0 Runden · BUG-004, READ-004, RES-003, CONS-003, BUG-013 samt der »Dazu«-Punkte laut Review behoben · Regressionsbelege außerhalb des Repos (das Lookbook hat keine Testoberfläche): Proben `paket-13-probe/` im Arbeitsverzeichnis — `demoInit.probe.ts`, `demoKeys.probe.ts`, `galleryMattes.probe.ts`, `transitionCycler.probe.ts`, vor der Änderung alle vier rot, danach 47/47 grün · kein `onInit(async` und kein `director.precompile(` außerhalb von `catchPrecompile()` mehr im Lookbook · Abweichung: `TransitionCyclerOptions.stages` ist `readonly [StageDirectorLayer, StageDirectorLayer]` (`replace()` verlangt `IStage & IRenderable`); `stage-masks-shared` hängt sein `.finally(() => ink.takeDraws())` an `catchPrecompile()` wie `matte-3d` · klein: `onBegin` und `#shownFrom`/`#shownTo` im Cycler noch als `IStage` typisiert; `matte-ink` setzt `edge.running`/`hall.pointer` jetzt in `onBegin` vor `replace()` (so geplant)
- Nebenbefunde: → Queue (sechs Lookbook-Seiten: Listener ohne Abmeldung, fehlende `isDisposed`-Prüfungen, ein falscher Readout-Name)
- Folgen: keine
- Schnittstellen: neu im Lookbook `src/demos/utils/demoInit.ts`: `onDemoInit(display, demo, init)` (gibt das Unsubscribe von `display.onInit()` zurück; Fehler → `console.error` und `<p class="demo-failure" role="alert">` in `<demo-ui>` oder `document.body`), `catchPrecompile(demo, promise)` · `src/demos/utils/demoKeys.ts`: `ignoredKey(event)` · `src/demos/stage-masks/TransitionCycler.ts`: `class TransitionCycler` (`play()`, `setScrub()`, `restart()`, `holdAt(progress)`, `addControls(gui, {min, max})`, `running`, `dispose()`), `TransitionCyclerSettings`, `TransitionCyclerOptions` · `GalleryMattes#maskStages` · CSS-Klasse `.demo-failure` in `VanillaDemo.astro`

### [x] 13b. Lookbook: Assets der Masken-Szenen über TextureStore laden
- Findings: CONS-002 (low), BUG-012 (low), READ-003 (low), dazu der Atlas-Teil von ARCH-001 (aus Zug 0 von Paket 12) — im Zug 0 von Paket 13 abgeteilt; ARCH-001 schließt erst mit diesem Paket
- Dazu (Zug 0, vorbestehend, gleiche Ursache — Asset an der Textur-API vorbei oder per `fetch()` ohne Statusprüfung, Geladenes bleibt bei Fehlschlag liegen): `stage-transitions/assets.ts:33`/`:62-68`, `sine-scroller.astro:103`/`:113-133`, `ui-panels.astro:97`/`:93-101`, `animated-billboards.astro:100` (eigener `TextureLoader` neben dem Katalog-Store)
- Detail: `docs/remediation/paket-13b.md`
- Ziel: Die zwölf Szenen-Module unter `stage-masks/` laden ihre Bilder und Atlanten über einen `TextureStore` mit unveränderten Texturoptionen, lesen Frames über `TextureAtlas` statt eigener UV-Rechnung, holen ihre Layout-JSONs über einen gemeinsamen Helfer, der `response.ok` prüft und Datei samt Status nennt, geben bei einem Fehlschlag Geladenes frei, und kein Feld verdeckt das globale `window`.
- Bereich: `apps/lookbook/src/demos/stage-masks/` (die Loader von `Crawlspace`, `CrematoriumWindow`, `DeepListening`, `DrownedHouse`, `FoundFootage`, `MirrorBathroom`, `MothChapel`, `PaintingHallway`, `SeancePhotographs`, `Trench`, `WardC`, `WatchingWallpaper`; `RoseWindow.ts`; drei Atlas-Helfer in `helpers.ts`), neu `src/demos/utils/fetchAsset.ts` (`fetchText()`, `fetchJson()`), `src/demos/stage-transitions/assets.ts`, `pages/demos/sine-scroller.astro`, `ui-panels.astro`, `animated-billboards.astro`, ein Eintrag in `public/assets/textures.json`, die Dispose-Zeilen der zwölf Masken-Seiten, `apps/lookbook/README.md` (»Adding a demo«); nichts unter `assets-src/`, kein Library-Code, kein CHANGELOG, keine Vorschaubilder
- Steht hier, weil: dieselben Seiten wie 13 (13 den Rahmen von `onInit`, 13b die Dispose-Zeilen und die Rückgabe der Loader), und `onDemoInit()` aus 13 zeigt die Ladefehler, die 13b mit Datei und Status benennt
- Zug 0 (2026-11-01): alle Fundstellen an ihren Zeilen oder um eine verschoben (BUG-012 `MothChapel.ts:147`, READ-003 `:148`); CONS-002 trifft zwölf Loader, nicht sechs. Wahl und Abweichungen mit Grund in der Paketdatei: je Szene ein Katalog mit `defaultTextureClasses: ['srgb', 'anisotropy', 'flipy']` (MothChapel ohne, je Eintrag), Atlanten `no-flipy` und `setFrame()`, Wraps über `repeat`/`repeat-s`/`repeat-t`; die Atlanten von Crawlspace und WardC wechseln auf `flipY = false` (ihre Sprites stehen nach dem Sprite-Shader heute vermutlich kopfüber, der Bildvergleich zeigt es); `panes.generateMipmaps = false` von Hand (keine Klasse dafür → neuer Nebenbefund); `faceMap` bleibt in `sprites.json` und kommt über `atlasJson` (kein Generatorlauf); `dispose<X>Assets()` entfallen zugunsten `assets.store.dispose()`; Layout-JSONs ohne Laufzeitprüfung; READ-003 als `rose`/`RoseWindowJson`. Rot/grün über Proben außerhalb des Repos (`<Arbeitsverzeichnis>/paket-13b-probe/`), dazu Vorschaubilder vorher/nachher nach `<Arbeitsverzeichnis>/paket-13b-previews/`. Keine offene Folge; kein Eintrag in »Offene Befunde« teilt die Ursache. Restplan: 13b ist das letzte Paket, danach der Abschluss mit der Drain-Runde
- Hängt ab von: 12 (`stage-masks/helpers.ts`), 13 (dieselben Seiten)
- Hash: e68e11b7
- Ergebnis: 1 Runde · CONS-002, BUG-012, READ-003 und der Atlas-Teil von ARCH-001 (ARCH-001 damit ganz) samt der vier »Dazu«-Stellen laut Review behoben · Regressionsbelege außerhalb des Repos (das Lookbook hat keine Testoberfläche): Proben `paket-13b-probe/` im Arbeitsverzeichnis — `fetchAsset.probe.ts`, `sceneLoaders.probe.ts`, `atlasHelpers.probe.ts`, vor der Änderung rot (25 Fehlschläge, eine Datei lud nicht), danach 30/30 grün · Vorschaubilder der 17 Seiten vorher/nachher gleich (WebGPU); die in Schritt 5 erwartete Umkehr der Sprites von Crawlspace/WardC ist nachgerechnet, aber an den vertikal fast symmetrischen Frames nicht sichtbar · Runde 1: Satz zu `flipY` im Abschnitt `flashlight` von `assets-src/README.md` mitgezogen (Ausschluss von `assets-src/` galt Generatoren und Vertrag) · klein: 4 (Paketdatei)
- Nebenbefunde: → Queue (zwei Einträge »aus Paket 13b (Runde 0)«)
- Folgen: keine
- Schnittstellen: neu im Lookbook `src/demos/utils/fetchAsset.ts`: `fetchText(subject, url)`, `fetchJson<T>(subject, url)` (Meldungen `<subject>: <url> answered <status>` / `could not be fetched` / `is no JSON`) · in `src/demos/stage-masks/helpers.ts`: `atlasFrame(atlas, subject, name)`, `setMirroredFrame(sprite, frame)`, `setPlaneUvToFrame(geometry, coords)` · die zwölf `load<X>Assets()` liefern `store: TextureStore`, `dispose<X>Assets()` entfernt (Seiten rufen `assets.store.dispose()`) · `ChapelAssets.window` → `rose`, `WindowJson` → `RoseWindowJson`, `ChapelAssets.faceMap` neu · Katalog-Eintrag `blueGround` in `public/assets/textures.json`

### [x] 17. Drain: Lockfile-Advisories und Hygiene der Specs und Browser-Tests
- Nebenbefund: die Einträge aus »Offene Befunde« mit »überführt in Paket 17« — `pnpm-lock.yaml` (`minimatch` GHSA-g3hv-75wg-m249, `glob` GHSA-3g3m-2fjr-6pw4, `deepmerge` GHSA-gcqx-w48m-w2h4 ohne behobenen Release), `packages/twopoint5d-testing/test/stage-pipeline.test.js` (Ressourcen ohne `keep()`), Biome-Warnungen in `src/texture/TextureCoords.spec.ts:109`, `src/stage/fitIntoRectangle.spec.ts:331-408` (Helfer `fit`), `src/stage/ProjectionPlane.spec.ts:16`
- Dazu (Zug 0, vorbestehend, gleiche Ursache — die Kommentare des `overrides`-Blocks nennen, welche Version die verwundbare Abhängigkeit festhält): `pnpm-workspace.yaml:35` nennt »nx 23.3.x«, im Manifest steht nx 24.0.1 (an d9b648bf ebenso)
- Ziel: `pnpm audit` meldet für den Workspace keine bekannte Schwachstelle mehr (Override, wo eine Version sie behebt, eine dokumentierte Audit-Ausnahme, wo keine Version es kann), die Browser-Tests geben jede Ressource über `keep()` frei, und `biome ci` läuft ohne Warnung über die Specs.
- Detail: `docs/remediation/paket-17.md`
- Zug 0 (2026-11-01): alle sieben Nebenbefunde unverändert (Lockfile-Zeilen verschoben; `stage-pipeline.test.js` hat dieselbe Lücke auch in den Tests `:266`, `:300`, `:334`, aufgenommen). Wahl mit Grund in der Paketdatei, in einer Probe gegen pnpm 10.27.0 geprüft (`pnpm audit` exit 0): Override `'rimraf>glob': ^14.0.2` (rimraf ruft nur `glob()`/`globSync()`, behebt glob und die rimraf-Kette von minimatch); `auditConfig.ignoreGhsas` für GHSA-g3hv-75wg-m249, weil nx bis 24.0.3 minimatch 10.2.5 pinnt und `minimatch.makeRe()` ruft, das 11 entfernt (Override bräche nx; die Lücke braucht `optimizationLevel >= 2`, das nx nie setzt), und für GHSA-gcqx-w48m-w2h4, weil kein Release sie behebt und der einzige Aufrufer mit `nodeResolve: true` unserer Konfiguration nur `{}` mischt — kein Patch, er ließe `pnpm audit` unverändert. Abweichung vom ursprünglichen Ziel-Wortlaut (»Bump oder Override, notfalls Patch«) deshalb; die Regel für Ausnahmen kommt in `docs/architecture.md` §5. Gate unverändert (`lint` ohne `--error-on-warnings`), die Warnfreiheit prüft das Verify. Keine offene Folge; kein anderer Eintrag in »Offene Befunde« teilt die Ursache. Restplan unverändert: 18–21 berühren weder Lockfile noch diese Specs
- Bereich: `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `docs/architecture.md` (§5), `packages/twopoint5d-testing/test/stage-pipeline.test.js`, die drei Specs
- Hängt ab von: —
- Hash: a63429c8
- Ergebnis: 0 Runden · alle sieben Nebenbefunde und der `nx>undici`-Kommentar laut Review behoben · rote Vorher-Läufe: `pnpm audit` exit 1 (»4 vulnerabilities · 1 low | 3 moderate«), `biome ci --error-on-warnings .` exit 1 (»Found 19 warnings«); danach `pnpm audit` exit 0 (2 ignored), Biome ohne Warnung, `pnpm run ci` grün · klein: 3 (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `pnpm-workspace.yaml` neu `overrides.'rimraf>glob': ^14.0.2` und `auditConfig.ignoreGhsas` (GHSA-g3hv-75wg-m249, GHSA-gcqx-w48m-w2h4); Regel dafür in `docs/architecture.md` §5

### [x] 18. Drain: DisplayFullscreen — Armed-Zustand, Warnungen, Spec-Helfer und Proposal-Kopf
- Nebenbefund: die Einträge aus »Offene Befunde« mit »überführt in Paket 18« — `src/display/DisplayFullscreen.ts:778ff.` (`isArmed` bleibt nach Betreten durch `request()`), `:353` (`set onLandscape(true)` neben offenem Request), `:313-314` (`#warnConflicts()` doppelt), `src/display/Display.spec.ts:131-135` (Helfer ruft entfernte Listener), `docs/proposals/display-fullscreen.md:11-37` (Rückblick im Status-Kopf)
- Dazu (Zug 0, vorbestehend, gleiche Ursache — der Controller führt seinen Armed-Zustand nicht mit dem Fullscreen seines Ziels und nicht mit den Antworten des Browsers): ein Fullscreen, den jemand anderes auf dem Ziel betritt, die halbe Drehung eines scharfen Controllers (`#turned()` `:907-916`) und der Pseudo-Modus (`#enterPseudo()` `:947-968`) entschärfen ebenfalls nicht; der Setter schaltet nach einem Exit, der bei seinem Aufruf lief, nie scharf; `makeEventTarget().dispatch()` in `DisplayFullscreen.spec.ts:38-40` ruft einen Listener, den ein früherer derselben Auslieferung entfernt hat
- Ziel: Ein Fullscreen des Ziels ist nie scharf, wer ihn auch betreten hat; `onLandscape = true` neben einer offenen Antwort des Browsers schaltet erst nach dieser Antwort scharf und nur, wenn das Ziel dann nicht im Fullscreen ist; der Konstruktor prüft die Konfliktwarnungen einmal; die Display-Specs feuern `fullscreenchange` nur an Listener, die das Dokument noch hält. Der Proposal-Kopf bleibt, wie er ist.
- Detail: `docs/remediation/paket-18.md`
- Zug 0 (2026-11-01): vier Nebenbefunde unverändert (`#readState()` jetzt `:781ff.`, Setter `:352`, Helfer `Display.spec.ts:129-136`); der Rückblick im Proposal-Kopf ist gegenstandslos — die Abweichungsliste unter der Status-Zeile verlangt `docs/proposals/README.md` (»Reading an implemented proposal«, »Building a proposal«) als einzige Historie eines Proposals, alle 17 umgesetzten Proposals führen sie, ein ADR-Verzeichnis gibt es nicht; der Nebenbefund maß am Schema eines Skills, nicht am Repo. Abweichung vom ursprünglichen Ziel-Wortlaut deshalb. Weg: `#disarm()` in `#readState()` und `#enterPseudo()`; der Setter hängt sein Scharfschalten über `#joinRun().then(#rearm)` an einen laufenden Lauf; gemeinsames Listener-Register `src/testing/eventTargetStub.ts` für beide Display-Specs. Kein CHANGELOG (Fullscreen unveröffentlicht, die »Added«-Zeilen bleiben wahr). Keine offene Folge. Neu in »Offene Befunde«: `onLandscape` neben einem fremden Fullscreen, den das Ziel nicht trägt (andere Ursache, → Scope). Restplan unverändert: 19–21 berühren `src/display/` nicht
- Bereich: `packages/twopoint5d/src/display/DisplayFullscreen.ts` (+ `.spec.ts`), `src/display/Display.spec.ts`, `src/testing/eventTargetStub.ts` (+ `.spec.ts`, neu), `docs/proposals/display-fullscreen.md` (§3.2, §6.2, §13.1), `docs/display.md`
- Hängt ab von: —
- Hash: 1a8ec51e
- Ergebnis: 0 Runden · vier Nebenbefunde samt der im Zug 0 aufgenommenen Stellen laut Review behoben (`#disarm()` in `#readState()` `DisplayFullscreen.ts:793-794` und `#enterPseudo()` `:977`; Setter hängt sich an den laufenden Lauf `:351-360`; zweiter `#warnConflicts()` gestrichen `:313`; Register `src/testing/eventTargetStub.ts` in beiden Display-Specs), Proposal-Kopf entfallen (Zug 0) · Regressionstests in `DisplayFullscreen.spec.ts`, u. a. `a request() of the page on an armed display disarms once the target is in fullscreen, and leaving it in landscape arms nothing`, `a fullscreen someone else enters on the target disarms`, `a half turn of an armed display asks again, and the fullscreen the browser grants is not armed`, `onLandscape = true while an exit() is under way arms once the exit is through`, `a pseudo mode entered while armed disarms` (vor dem Fix rot, 6 failed) · klein: 3 (Paketdatei)
- Nebenbefunde: → Queue (ein Eintrag »aus Paket 18 (Runde 0, Reviewer)«)
- Folgen: `packages/twopoint5d/src/display/types.ts:72` — TSDoc von `DisplayFullscreenChangeProps.isArmed` (»`onLandscape` waits for a tap to enter fullscreen.«) trägt den Zusatz »never while the target is in fullscreen« nicht, den Getter, Proposal §3.2 und Guide jetzt nennen; nicht falsch, aber unvollständig gegenüber den Geschwistern → verteilt im Zug 0 von Paket 19 (2026-11-01): Symptom dieses Pakets (die Semantik ist geändert, eine der vier Stellen, die sie beschreiben, nicht nachgezogen), Nachtragspaket 22

### [x] 19. Drain: SpritePicker, writeText, describeValue und Texturen
- Nebenbefund: die Einträge aus »Offene Befunde« mit »überführt in Paket 19« — `src/sprites/SpritePicker.ts:118-125`/`:147`/`:260ff.` (Pick ignoriert `ClippingGroup`-Clipping), `:288`/`:299` (Pass-Material im `material`-Slot), `src/text/writeText.ts:50` (Feature-Prüfung über Identität), `src/utils/describeValue.ts:71-77` (String roh zitiert), `src/texture/AsepriteJson.ts:489-492` (Frame `"__proto__"`), `src/texture/TextureFactory.ts:58-145` (keine Texturklasse für `generateMipmaps`)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie das Clipping — die Pick-Szene legt die Pick-Meshes flach ab und übernimmt aus den Vorfahren nur `visible`): die Group-Order — die Pick-Meshes liegen unter keiner `Group`, three sortiert aber zuerst nach der `renderOrder` der nächsten Group über einem Mesh; bei gleicher Tiefe nennt der Pick dann ein anderes Mesh als das, das obenauf gezeichnet ist (gegen `docs/sprites.md:1955-1957`)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie `"__proto__"`): `slicesAt()` in `src/texture/AsepriteJson.ts:282`/`:294` — eine Slice namens `"__proto__"` verschwindet ebenso
- Ziel: Der Picker trifft nur, was gezeichnet wird, und weist ein Pass-Material im Slot mit benannter Meldung ab, `writeText` erkennt Features wie die übrige Library, `describeValue()` zitiert Strings eindeutig in einer Zeile, Aseprite-Frames überleben jeden Namen, und ein Katalog-Eintrag kann Mip-Stufen abschalten.
- Detail: `docs/remediation/paket-19.md`
- Zug 0 (2026-11-01): alle sechs Nebenbefunde bestehen (SpritePicker verschoben: `isShown()` `:132-139`, `#gather()` `:274-298`, `#sync()` `:300-325`; die übrigen an ihren Zeilen), keiner gegenstandslos. Wahl und Abweichungen mit Grund in der Paketdatei: je Pick-Eintrag eine eigene Kette aus `ClippingGroup`-Spiegeln (Ebenen der Quelle geteilt, Spiegel über Picks stabil wegen three's Kontext-Cache) und einer `Group`, die die Group-Order trägt; der Slot wird vollständig geprüft (kein `FeatureSpritesMaterial`, andere Art, Pass — dieselben Bedingungen wie im Konstruktor), abgewiesen statt mit dem Pass gezeichnet; `describeValue()` escaped `"`, `\`, `\p{Cc}`, U+2028/U+2029 und einzelne Surrogate wie ein JSON-String, geschnitten wird vorher; handgesetzte Anführungszeichen bleiben (AGENTS.md wird eingeschränkt, neuer Nebenbefund `→ Rückfrage`); `defineProperty` statt Record ohne Prototyp (`slices` geht an den Aufrufer); Klassen `mipmaps`/`no-mipmaps` (Breite 500), MothChapel nimmt die Klasse statt des Workarounds; Proposal `gpu-picking.md` §3.2 samt Abweichungsliste. CHANGELOG `Added`/`Changed`/`Fixed`, nichts **BREAKING**. Folge aus Paket 18 (`types.ts:72`) als Symptom → Nachtragspaket 22. Restplan: 22 neu hinter 19; 20 liest `SpritePicker.ts` nach diesem Paket neu (Zeilen verschieben sich, seine Casts `:328`/`:340` fasst 19 nicht an); 21 unberührt (`MothChapel.ts` gehört nicht zu 21)
- Bereich: `packages/twopoint5d/src/sprites/SpritePicker.ts` (+ Spec), `src/text/writeText.ts` (+ Spec), `src/utils/describeValue.ts` (+ Spec, dazu Specs mit roh zitierten Sonderzeichen), `src/texture/AsepriteJson.ts`, `src/texture/TextureFactory.ts` (+ Specs), `packages/twopoint5d-testing/test/sprites-picking.test.js`, `apps/lookbook/src/demos/stage-masks/MothChapel.ts`, `docs/sprites.md`, `docs/proposals/gpu-picking.md`, `docs/text.md`, `docs/textures.md`, `AGENTS.md`, `CHANGELOG.md`
- Hängt ab von: —
- Hash: 82fe9ab0
- Ergebnis: 1 Runde (zwei wichtige Doku-Befunde des Reviews: Rückblick im Nachsatz `CHANGELOG.md:57`, Slot-Ablehnung fehlte in `gpu-picking.md` §5) · alle sechs Nebenbefunde und beide »Dazu«-Stellen laut Review behoben (`readAncestry()` `SpritePicker.ts:161`, Kette in `#place()` `:378`, `#release()` `:452`, `slotMaterialOf()` `:595`; `writeText.ts:52`; `describeValue.ts:9-24`/`:88`/`:93`; `setOwn()` `AsepriteJson.ts:498`/`:300`; Klassen `TextureFactory.ts:114-119`, Breite `:211-212`; `MothChapel.ts:149`) · Regressionstests, vor dem Fix rot: Vitest `SpritePicker.spec.ts` (4, u. a. `a mesh under ClippingGroups lies under a mirror of each that the camera sees and that is enabled, root first, with its planes and clipIntersection`, `refuses an entry whose material slot holds a material built for a pass, one of another kind or none, naming the entry`), Browser `sprites-picking.test.js` (`does not hit a sprite where a ClippingGroup above it clips it away, …`, `picks the mesh drawn later at one depth by the renderOrder of the group above it before its own`, je 4 Launcher), `writeText.spec.ts` `takes a kind whose features are copies of InstancePosition, QuadSize and AtlasFrame, judged by name`, `describeValue.spec.ts` (3), `AsepriteJson.spec.ts` `keeps a frame named __proto__, …`/`keeps a slice named __proto__ in the slices of a frame`, `TextureFactory.spec.ts` (3) · klein: 4 (Paketdatei)
- Nebenbefunde: keine neuen (die handgesetzten Anführungszeichen stehen seit Zug 0 in »Offene Befunde«)
- Folgen: keine offenen — jede Meldung, die über `describeValue()` einen String mit `"`, `\`, Steuerzeichen, U+2028/U+2029 oder einzelnem Surrogat zitiert, lautet jetzt escaped; das Gate zeigt keine Spec und keinen Aufrufer, der daran bricht
- Schnittstellen: `describeValue()` zitiert Strings escaped wie ein JSON-String plus DEL, C1, U+2028/U+2029, einzelne Surrogate (`\uXXXX` klein), geschnitten wird vor dem Escapen · neue Texturklassen `mipmaps`/`no-mipmaps` (Breite 500), `TextureOptions#generateMipmaps` neu · `SpritePicker#pick()` wirft `TypeError` für einen `material`-Slot ohne `FeatureSpritesMaterial`, mit Material einer anderen Sprite-Art oder für einen Pass (Meldung nennt den Eintrag); intern je Pick-Eintrag eine Kette Holder-`Group` + `ClippingGroup`-Spiegel, das Pick-Mesh liegt dauerhaft im Holder (`pickMesh.parent` ist der Holder, nicht `null`) · `writeText()`/`rewriteText()` erkennen `InstancePosition`, `QuadSize`, `AtlasFrame` am `feature.name`

### [x] 22. DisplayFullscreen: TSDoc von `isArmed` in den Change-Props nachziehen
- Findings: — (Nachtrag zu Paket 18: dessen `Folgen:`-Zeile, im Zug 0 von Paket 19 als Symptom eingeordnet)
- Folge von: Paket 18
- Ziel: Das TSDoc von `DisplayFullscreenChangeProps.isArmed` sagt, was Getter, Proposal §3.2 und Guide seit Paket 18 sagen: nie `true`, solange das Ziel im Fullscreen ist — wer ihn auch betreten hat, nativ oder pseudo — oder unter einem darauf gestapelten Element liegt.
- Detail: `docs/remediation/paket-22.md`
- Zug 0 (2026-11-01): Fundstelle unverändert (`types.ts:72`, Datei seit vor dem Lauf unberührt, `src/display/` seit 1a8ec51e unberührt). Wahl mit Grund in der Paketdatei: Wortlaut des Getters samt `{@link DisplayFullscreen.isArmed}` (Typ-Import steht schon), `isActive`/`mode` bleiben ohne TSDoc (Konvention der Props-Interfaces, kein Nebenbefund), Commit `docs`, kein CHANGELOG. Keine weitere offene Folge; die zwei Nebenbefunde aus Paket 18 teilen die Ursache nicht (Verhalten von `#holdsTarget()`/`#turned()` bzw. `#declined`, nicht die Doku der Props) und bleiben in »Offene Befunde«, der erste mit Vermerk. Restplan unverändert: 20 und 21 berühren `src/display/` nicht
- Fundstellen: `packages/twopoint5d/src/display/types.ts:72` (»`onLandscape` waits for a tap to enter fullscreen.«, Stand 1a8ec51e, im Zug 0 von 19 nachgesehen) · Wortlaut des Getters `src/display/DisplayFullscreen.ts:447-451`
- Bereich: `packages/twopoint5d/src/display/types.ts`; kein Code, kein CHANGELOG-Eintrag (Fullscreen ist unveröffentlicht, nur unter `[Unreleased]`, dessen »Added«-Zeilen wahr bleiben)
- Steht hier, weil: klein und unabhängig; kein anderes offenes Paket berührt `src/display/`. In »Offene Befunde« stehen zwei Nebenbefunde derselben Datei aus Paket 18 (`onLandscape` neben einem fremden Fullscreen, `#declined` nur für den eigenen) — der Zug 0 von 22 prüft, ob einer dieselbe Ursache hat
- Hängt ab von: 18
- Hash: 8379ebe7
- Ergebnis: 0 Runden · Folge aus Paket 18 laut Review behoben (`types.ts:72-76`, Wortlaut des Getters samt `{@link DisplayFullscreen.isArmed}`) · kein Regressionstest (reine Doku) · klein: 1 (Paketdatei)
- Nebenbefunde: keine (`types.ts` ganz gelesen)
- Folgen: keine

### [x] 20. Drain: Stage-Events in der Doku, dissolve-Rauschen, TSL-Casts, Vertex-Pool und map2d-Kleinigkeiten
- Nebenbefund: die Einträge aus »Offene Befunde« mit »überführt in Paket 20« — `src/events.ts:150` und `docs/stages.md:1955ff.` (Sender von `OnStageDispose`, fehlende Transition-Events in der Tabelle), `src/stage/transitionEffects.ts:298` (`dissolve()` mit Sinus-Hash), `as unknown as`-Casts um TSL-Knoten (`SpritePicker.ts:328`, `StageMask.ts:148`, `transitionEffects.ts:480`, `StageDirector.ts:2338` u. a.), `src/vertex-objects/VOBufferPool.ts:139-142` (Setter `usedCount` lässt Nicht-Zahlen durch), `src/vertex-objects/VertexObjectBuffer.ts:441-442` (Meldung bei losgelassener Quelle), `src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:108` (TSDoc »exactly four children«), `src/map2d/CameraBasedVisibility.ts:352` (`#centerPoint2D` ohne `readonly`)
- Dazu (Zug 0, vorbestehend, gleiche Ursache wie `#centerPoint2D` — in place beschriebene Felder ohne `readonly`, die einzigen der Klasse): `#matrixWorldInverse`, `#tileBoxMatrix`, `#tileBoxOffset` in `src/map2d/CameraBasedVisibility.ts:359`/`:363`/`:369`
- Ziel: Doku und TSDoc nennen jeden Sender und jedes Event, `dissolve()` rauscht ohne `sin()`-Hash streifenfrei, die TSL-Casts entfallen, wo @types/three 0.187 sie trägt, und Pool, Buffer und map2d prüfen bzw. dokumentieren, was ihr TSDoc verspricht.
- Detail: `docs/remediation/paket-20.md`
- Zug 0 (2026-11-01): alle acht Nebenbefunde bestehen, an ihren Zeilen (die Casts in `SpritePicker.ts` nach Paket 19 bei `:405`/`:417`), keiner gegenstandslos. Wahl und Abweichungen mit Grund in der Paketdatei: `dissolve()` über Hoskins' »hash without sine« (Formel von `hash21` im Lookbook) als interne Funktion `cellHash()`; kein CHANGELOG dafür — `dissolve()` ist unveröffentlicht (nur unter `[Unreleased]`, `CHANGELOG.md:34`), Ziel-Wortlaut deshalb ohne »CHANGELOG: Muster ändert sich«; Casts nach einer Probe außerhalb des Repos (`<Arbeitsverzeichnis>/paket-20-probe/casts.probe.diff`, tsc exit 0): 32 von 34 entfallen, bleiben nur `FeatureSpritesMaterial.ts:358` und der innere Cast von `:384`, dazu `typedNodes.ts`/`matrixColumn.ts` als bewusste Helfer; `usedCount` lehnt Nicht-Zahlen mit `RangeError` »must be a whole number, Infinity or -Infinity« ab; `copy()` nennt die losgelassene Quelle im Wortlaut der Konstruktor-Meldung. CHANGELOG nur `Fixed` für `usedCount` und `copy()`. Keine offene Folge; die drei offenen Einträge in »Offene Befunde« teilen keine Ursache und bleiben. Restplan unverändert: 21 berührt die Library höchstens in `src/stage/` und liest `StageDirector.ts` nach diesem Paket neu (20 ändert dort nur Typen)
- Bereich: `packages/twopoint5d/src/stage/` (`transitionEffects.ts`, `StageMask.ts`, `StageDirector.ts` samt Specs), `src/events.ts`, `src/vertex-objects/` (`VOBufferPool.ts`, `VertexObjectBuffer.ts`, Specs), `src/map2d/` (`CameraBasedVisibility.ts`, `chunk-quad-tree/ChunkQuadTreeNode.ts`), `src/sprites/SpritePicker.ts`, `src/sprites/FeatureSprites/FeatureSpritesMaterial.ts`, `src/texture/sampleFrameAt.ts`, `src/texture/sampleAtlasFrame.ts`, `src/texture/AtlasFrameTable.ts`, `docs/stages.md`, `CHANGELOG.md` (`Fixed`), `packages/twopoint5d-testing/test/stage-transitions.test.js`
- Hängt ab von: 19 (beide berühren `SpritePicker.ts`)
- Hash: d36fe515
- Ergebnis: 0 Runden · alle acht Nebenbefunde und die drei weiteren `readonly`-Felder laut Review behoben (`events.ts:150-152`, `docs/stages.md:1959`/`:1960`; `ChunkQuadTreeNode.ts:108-110`; `CameraBasedVisibility.ts:352`/`:359`/`:363`/`:369`; `VOBufferPool.ts:126-128`/`:139-142`; `releasedSourceError()` `VertexObjectBuffer.ts:110-116`/`:450`; `cellHash()` `transitionEffects.ts:289-298`, `:309`; Casts: `grep "as unknown as"` listet nur noch die geplanten Ausnahmen, `FeatureSpritesMaterial.ts:359`/`:385`) · Regressionstests, vor dem Fix rot: `VertexObjectPool.spec.ts` `usedCount refuses a value that is no number, and the count stays where it was`, `fromBuffersData() refuses buffers data whose usedCount is no number, and leaves the pool as it was`, `the constructor refuses buffers data whose usedCount is no number`, `usedCount refuses NaN and a fraction` (neue Meldung); `VertexObjectBuffer.spec.ts` `copy() from a released buffer throws`; `transitionEffects.spec.ts` `dissolve builds its noise without sin()`, `cellHash answers a value in 0 … 1 spread over the range, at the cells of a 4K picture as well` · Browser `stage-transitions.test.js` `dissolve() switches about half of the picture at progress 0.5, at the cells of a 4K picture as well` (Abdeckung, kein roter Lauf) · klein: 5 (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `VOBufferPool#usedCount` (und damit `VertexObjectPool#usedCount`, Konstruktor, `fromBuffersData()`) wirft `RangeError` `VOBufferPool#usedCount must be a whole number, Infinity or -Infinity, got …` auch für Nicht-Zahlen · `VertexObjectBuffer#copy()` mit losgelassener Quelle: `VertexObjectBuffer#copy(): the source buffer holds no typed array any more — the pool behind it has been disposed` · neu intern `cellHash(cell: Node<'vec2'>): Node<'float'>` in `src/stage/transitionEffects.ts` (`@internal`, nicht in `public-api.ts`) · `dissolve()` hat ein anderes Zellmuster

### [x] 21. Drain: precompile unter WebGPU — eine Instanz-Geometrie zeichnet vor ihrem ersten update() keine Instanz
- Nebenbefund: aus »Offene Befunde« (überführt in Paket 21) — `stage-transitions-gallery.astro:102-109` und `stage-transitions-game-menu.astro:163-166` (`precompile()` scheitert unter WebGPU mit `drawIndexed … Value is infinite`; medium). Die übrigen sieben Einträge, die die Drain-Runde hierher überführt hatte, gehen im Zug 0 mit ihrer Ursache nach 21b
- Ziel: `precompile()` der Transition-Seiten läuft unter WebGPU durch: eine `InstancedVOBufferGeometry` zeichnet vor ihrem ersten `update()` keine Instanz, unter WebGPU wie unter WebGL 2, und Guide und TSDoc sagen das und dass der Off-Screen-Draw von `precompile()` kein Frame der Stage ist.
- Detail: `docs/remediation/paket-21.md`
- Zug 0 (2026-11-01): Nebenbefund besteht, Ursache geklärt (nach Lesen des Codes, nicht ausgeführt; die roten Browser-Tests in Zug 1 belegen sie): `#drawOffScreen()` (`StageDirector.ts:2376-2381`) zeichnet die `layers` mit `renderTo()` ohne `updateFrame()`; `GalleryScene#ships` (`GalleryScene.ts:101-124`) und `GameLevel#ships`/`#shots` (`GameLevel.ts:97-139`) bekommen ihr erstes `update()` erst in `OnStageUpdateFrame`, ihre Geometrie trägt noch three's `instanceCount = Infinity` (aus einer `BufferGeometry`: `undefined`), und three reicht ihn an `drawIndexed()` weiter (`three.webgpu.js:5869-5883`, `:50784`), das unter WebGPU `[EnforceRange]` verlangt; WebGL 2 macht daraus still 0. Vorbestehend (an d9b648bf derselbe Konstruktor ohne `instanceCount` und dieselben `layers` des Spielmenüs `:155`), Paket 13 hat nur die Galerie als zweite Stelle dazugebracht — keine Folge. Wahl mit Grund in der Paketdatei: `this.instanceCount = 0` als letzte Anweisung im `try` des Konstruktors (deckt beide Konstruktorpfade), kein `updateFrame()` im Off-Screen-Draw, Draw-Range unverändert, keine Lookbook-Datei; three baut die Pipeline vor der Prüfung auf 0 Instanzen, der Zweck von `precompile()` bleibt. Regressionstests Vitest (beide Pfade) und Browser (`vertex-objects-gpu-upload.test.js`, `stage-transitions.test.js`), Verify zusätzlich der Vorschau-Generator mit `--strict` für die zwei Seiten, Bilder danach zurückgesetzt. CHANGELOG `Fixed`. Paket geteilt: die sieben Lookbook-Einträge samt 20 weiteren Seiten derselben Ursache und `PerspectiveOrbitDemo.ts:29` nach 21b. Keine offene Folge (alle `Folgen:`-Zeilen verteilt); die drei offenen Einträge in »Offene Befunde« teilen keine Ursache. Restplan: 21b hinter 21, danach der Abschluss
- Bereich: `packages/twopoint5d/src/vertex-objects/` (`InstancedVOBufferGeometry.ts`, `asInstancedCopySource.ts`, `vertex-buffers-geometry-updates.spec.ts`, `README.md`), TSDoc von `StageDirector#precompile()`, `docs/stages.md`, `docs/sprites.md`, `CHANGELOG.md` (`Fixed`), `packages/twopoint5d-testing/test/stage-transitions.test.js`, `vertex-objects-gpu-upload.test.js`; nichts unter `apps/lookbook/`
- Hängt ab von: —
- Hash: ba93887b
- Ergebnis: 0 Runden · Nebenbefund `precompile()` unter WebGPU behoben (Galerie und Spielmenü laufen im Vorschau-Generator mit `--strict` durch) · Regressionstests (vor dem Fix rot): Vitest `draws no instance before its first update(): instanceCount starts at 0 …` (`Infinity`) und `starts at an instanceCount of 0, where copy() of a plain BufferGeometry would leave it undefined` (`undefined`), Browser `precompile() draws a layer whose sprites wait for their first update(), and resolves` und `an instanced geometry drawn before its first update() draws nothing and throws nothing` (rot unter Chromium WebGPU, WebGL-2-Launcher grün) · Reviewer FREIGABE, vier kleine Befunde (Umbrüche, Satzstellung in `sprites.md`) in der Paketdatei
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `InstancedVOBufferGeometry#instanceCount` beginnt bei 0 (beide Konstruktorpfade) und folgt dem Instanz-Pool erst ab dem ersten `update()`; ein Mesh ohne `update()` zeichnet keine Instanz

### [x] 21b. Drain: Lookbook — Dispose-Pfade der Demo-Seiten, isDisposed nach await, ein Readout und zwei Casts
- Nebenbefund: aus »Offene Befunde« (überführt in Paket 21, im Zug 0 von 21 hierher abgeteilt), Fundstellen nach dem Abgleich vom 2026-11-01 — `textured-sprites.astro:55` (anonymer `pointerdown`-Listener, kein `onDispose`, Kommentar `:70` »the sprites were disposed«), `rope-bridge.astro:124`/`:130`/`:135`/`:136` (vier anonyme `canvas`-Listener, `onDispose` `:152` meldet keinen ab), `ui-panels.astro:139`/`:142`/`:143` (drei anonyme `canvas`-Listener, `onDispose` `:167`) und `:63` (`StageRenderer` nie freigegeben), `animated-billboards.astro:54-122` (`demo.start(async …)` ohne `onDispose` und ohne `isDisposed` nach den `await`; Store `:61`, Geometrie, Materialien, Datentextur der Animationen `:73`, Boden `:99-114`), `stage-transitions-gallery.astro:127`/`:148` (`finished.then` ohne `display.isDisposed`) und `:209-210` sowie `stage-transitions-game-menu.astro:192-193` (`preview.ready()` nach `await precompiled` ohne `isDisposed`, die übrigen Seiten prüfen es), `stage-masks-portal.astro:184` (Readout `maskOf(other)` liest `maskOf(moor.stage)`), `stage-masks-matte-threshold.astro:153`/`:157` (`SOFTNESS as unknown as number[]`, `SONAR_KINDS as unknown as string[]`; `[...SOFTNESS]`/`[...SONAR_KINDS]` tragen ohne Cast)
- Dazu (Zug 0 von 21, vorbestehend, gleiche Ursache — eine Demo-Seite gibt beim `dispose()` ihres Displays nicht frei, was sie baut, und meldet ihre Listener nicht ab; an d9b648bf ebenso, 17 der Seiten seither ohne Commit): `apps/lookbook/src/demos/utils/PerspectiveOrbitDemo.ts:29` (`OrbitControls` am Canvas, nie `controls.dispose()`, 15 Seiten bauen darauf) · die Button-Listener `rope-bridge.astro:140`/`:144` und `ui-panels.astro:149`/`:153`/`:157` (rufen nach dem Dispose in freigegebene Objekte) · die `Stage2D` `rope-bridge.astro:75` und `ui-panels.astro:62` ohne `dispose()` (`StageRenderer#dispose()` lässt seine Stages nur los) · ohne jedes `onDispose`: `animated-sprites`, `atlas-frames-on-meshes`, `cardboard-parade`, `crosses`, `display-minimal`, `instanced-quads`, `map2d-cam-visi`, `map2d-rect-visi`, `map2d-tile-sprites`, `quadtree-playground`, `sprite-reflection`, `stage-nested-pipelines`, `stage-postprocessing`, `textured-quads`, `textured-quads-from-texture-atlas`, `textured-quads-from-tileset`, `vector-balls` (je `.astro` unter `pages/demos/`; was jede baut, prüft der Zug 0 von 21b — eine Seite, die nichts Eigenes hält, bekommt keinen leeren Pfad) · Listener ohne Abmeldung neben einem `onDispose`: `boomer-shooter-corridor` (3 `addEventListener`, 0 `remove…`), `platformer` (3 neben 2), `sine-scroller` (4 neben 0) · `apps/lookbook/README.md` »Adding a demo« nennt keine Regel dafür
- Ziel: Jede Demo-Seite gibt beim `dispose()` ihres Displays frei, was sie baut, und meldet jeden Listener ab, den sie anmeldet; nach einem `await` und in einem `then` prüft sie `isDisposed`, bevor sie weiterbaut; »Adding a demo« nennt die Regel; der Portal-Readout heißt nach dem, was er liest, und `matte-threshold` reicht lil-gui Kopien statt Casts.
- Detail: `docs/remediation/paket-21b.md`
- Dazu (Zug 0, vorbestehend, gleiche Ursache — die Seite hat keinen vollständigen Freigabepfad für das, was sie baut): frühe Rücksprünge nach einem `await`, die Gebautes der Modulebene liegen lassen (Galerie `:66-69`, Spielmenü `:53-56`, `boomer-shooter-corridor.astro:110-113`, die elf Masken-Seiten mit ihrem Director, `swaying-grass` ganz ohne Prüfung); ein Ladefehler nach dem Bau des Stores lässt ihn liegen, gegen `apps/lookbook/README.md:75` (in den Seiten, die `getAsync()` selbst awaiten, und `src/demos/platformer/assets.ts:57-107` für die gebackenen `animsMap`); `stage-postprocessing.astro:43-51` lädt ein Bild 80-mal als eigene Textur · dazu (vorbestehend, nötig für den Ladefehler-Schritt): `animated-sprites.astro:55`, `sprite-reflection.astro:65` hängen ihr asynchrones Init als `on(demo, OnDisplayInit, async …)` an `onDemoInit()` vorbei
- Zug 0 (2026-11-01): alle sieben Nebenbefunde und `PerspectiveOrbitDemo.ts:29` unverändert an ihren Zeilen (`apps/lookbook/` seit e68e11b7 unberührt); Inventur aller 42 Seiten samt Modulen: 38 Seiten und 7 Module ändern sich, `display-multi` und `stage-masks-without-director` sind vollständig. Wahl mit Grund in der Paketdatei: zwei `onDispose`-Ebenen (Modulebene direkt nach dem Bau, Init am Ende), der Director der Masken-Seiten wandert dafür auf die Modulebene; anonyme Listener über das `signal` eines `AbortController` (Muster `CorridorWalker.ts:50-65`), benannte bleiben; `start(async …)` bleibt (die Ablehnung von `start()` nach einem Dispose ist Vertrag der Library); Debug-Globals, Würfe beim Bauen nach dem Laden, DOM-Zustand des Markups und zwei harmlose `.finally` bleiben draußen; `PerspectiveOrbitDemo` gibt seine Controls selbst frei; neu `QuadTreeVisualization#dispose()` und `disposeNightCity()`. Kein Regressionstest im Repo: rot/grün über eine Probe außerhalb des Repos (`<Arbeitsverzeichnis>/paket-21b-probe/disposeProbe.mjs`, Playwright gegen `astro preview`, Displays über CDP `queryObjects` entsorgt, Listener-Register und markierte three-Objekte), Teil des Verify. Keine offene Folge; die drei offenen Einträge in »Offene Befunde« teilen die Ursache nicht. Restplan unverändert: 21b ist das letzte Paket, danach der Abschluss
- Bereich: `apps/lookbook/src/pages/demos/` (38 Seiten), `src/demos/utils/PerspectiveOrbitDemo.ts`, `src/demos/map2d/` (drei Module), `src/demos/atlas-frames-on-meshes/NightCity.ts`, `src/demos/quadtree-playground/QuadTreeVisualization.ts`, `src/demos/platformer/assets.ts`, `apps/lookbook/README.md`; kein Library-Code, kein CHANGELOG, keine Vorschaubilder
- Steht hier, weil: im Zug 0 von 21 abgeteilt — eine Ursache über ≈ 26 Seiten und reine Lookbook-Hygiene, andere Natur als der Library-Fix von 21; die vier ursprünglich genannten Seiten gehören zu derselben Ursache und gehen mit, Readout und Casts teilen nur die Seiten
- Hängt ab von: — (21 ändert keine Datei unter `apps/lookbook/`)
- Hash: 4d959c08
- Ergebnis: 0 Runden · die sieben Nebenbefunde und `PerspectiveOrbitDemo.ts:29` behoben, dazu alle Zeilen der Tabellen in Schritt 4–7 (38 Seiten, 7 Module, README-Absatz »Adding a demo«) · Regressionsprobe außerhalb des Repos `paket-21b-probe/disposeProbe.mjs` (Playwright gegen `astro preview`, beide Phasen, alle 42 Seiten): vor dem Fix rot mit 43 PASS / 38 FAIL / 3 n/a (Listener von OrbitControls, Button- und Canvas-Listener, Würfe beim Klick nach dem Dispose, lil-gui nie entfernt, `swaying-grass` baut nach dem Laden weiter), danach 81 PASS / 0 FAIL / 3 n/a · Reviewer FREIGABE ohne Befund im Repo; das RenderTarget, das die Probe auf vier Director-Seiten meldet, ist das schon freigegebene `passTarget` von `precompile()` (`StageDirector.ts:1391-1397`, frei in `:1444-1446`), nur über three-Interna noch erreichbar — Messartefakt, kein Befund
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: Lookbook-intern — `QuadTreeVisualization#dispose()` neu, `disposeNightCity(city: Group)` neu neben `makeNightCity()`, `PerspectiveOrbitDemo` gibt seine `OrbitControls` im eigenen `dispose()` frei, `platformer/assets.ts` backt `animsMap` erst nach dem `Promise.all` (`toSheet()`)

### [x] 23. Drain 2: DisplayFullscreen — fremder Fullscreen sperrt onLandscape, Verlassen im Querformat
- Nebenbefund: die beiden Einträge aus »Offene Befunde« mit »überführt in Paket 23« — `src/display/DisplayFullscreen.ts:907`/`:938-940`/`:352`/`:282-291` (`onLandscape` zieht das Ziel über einen fremden Fullscreen) und `docs/display.md:510-511` mit `DisplayFullscreen.ts:806-810`/`:922-928` (`#declined` nur für den Fullscreen von `onLandscape`)
- Ziel: `onLandscape` fragt nicht an und schaltet nicht scharf, solange ein anderes Element als das Ziel im Fullscreen liegt, und jedes Verlassen im Querformat hält den Nutzer draußen, bis das Gerät aufrecht und zurück gedreht ist — nach den beiden Einträgen der Drain-Runde 2 unter »Entscheidungen«; Getter, TSDoc (auch `types.ts:72ff.`), Proposal §3.2 und Guide sagen dasselbe.
- Detail: `docs/remediation/paket-23.md`
- Zug 0 (2026-11-01): beide Nebenbefunde bestehen (`src/display/` seit 1a8ec51e/8379ebe7 unberührt; Wächter jetzt `#turned()` `DisplayFullscreen.ts:919`, Setter `:359`, `#rearm()` `:940`, `#onArmedTap` `:282-291`; die Einschränkung auf `'landscape'` steht in `#readState()` `:808`, dazu in `#exit()` `:703` und `#leavePseudo()` `:990`), beide vorbestehend (an d9b648bf `:464`, `:603`). Wahl mit Grund in der Paketdatei: fremd ist jedes Fullscreen-Element von `doc.fullscreenElement` oder der Root des Ziels, solange `#holdsTarget()` nicht greift (eine Shadow Root nennt kein Element außerhalb); neu `#foreignFullscreen()`, `#fullscreenHolds()` (Wächter von Setter, `#turned()`, `#rearm()` und scharfem Tap; `#lock()` bleibt auf `#holdsTarget()`), `#decline()` (setzt `#declined` und entschärft) und Feld `#foreignHeld`; das Ende eines fremden Fullscreens im Querformat zählt als Verlassen (Lesart von Entscheidung 2); `request()` der Seite fragt neben einem fremden Fullscreen weiter an. Zwei Zeilen der Tabelle `the refusal an exit() of the page sets in landscape …` (`DisplayFullscreen.spec.ts:1540`/`:1542`) kehrt Entscheidung 2 um, sie werden angepasst. Kein CHANGELOG (Fullscreen unveröffentlicht, `CHANGELOG.md:28` wird erst damit uneingeschränkt wahr), kein Browser-Test (Gate und Drehung). Keine offene Folge; der übrige offene Eintrag in »Offene Befunde« gehört zu Paket 24 (andere Ursache). Restplan unverändert: 23 fügt keine Meldung hinzu, 24 liest `DisplayFullscreen.ts` danach neu
- Blocker für den kleinen Schnitt: andere Domäne und andere Verifikation als Paket 24; beide Einträge teilen die Datei
- Bereich: `packages/twopoint5d/src/display/`, `docs/display.md`, `docs/proposals/display-fullscreen.md`, `CHANGELOG.md` (nur `[Unreleased]`)
- Hängt ab von: —
- Hash: f02c7d86
- Ergebnis: 0 Runden · beide Nebenbefunde laut Review behoben (neu `#foreignFullscreen()`/`#fullscreenHolds()`/`#decline()` `DisplayFullscreen.ts:995-1018`, Feld `#foreignHeld` `:276-278`; Wächter Setter `:381`, `#turned()` `:960`, `#rearm()` `:981`, Tap `:296-300`; Einschränkung auf `'landscape'` gestrichen in `#readState()` `:832`, `#exit()` `:727`, `#leavePseudo()` `:1055`; TSDoc, `types.ts:73-76`, Guide `docs/display.md:507-515`/`:609-612`/`:669`, Proposal §3.2/§6.2/§6.3/§13.1) · Regressionstests in `DisplayFullscreen.spec.ts`, Block `a fullscreen of another element: onLandscape takes nothing from it` (Specs 1–10) und Specs 11–15 der Paketdatei (vor dem Fix rot: 21 failed / 189 passed; Spec 9 und 10 grün vor und nach), zwei Zeilen der Tabelle `the refusal an exit() of the page sets in landscape …` auf `halfTurnAsks: false` umgestellt · klein: 4 (Paketdatei; Umbrüche in Proposal §6.2/§6.3 und Guide, ein mehrdeutiger Kommentar `DisplayFullscreen.ts:992`)
- Nebenbefunde: keine (`DisplayFullscreen.ts` und `types.ts` ganz gelesen)
- Folgen: keine — `CHANGELOG.md:28` (»the user who leaves in landscape is not thrown back in …«) wird damit erst uneingeschränkt wahr, kein Eintrag nötig (Fullscreen unveröffentlicht); keine Signatur geändert, `apps/lookbook/src/demos/utils/fullscreenButton.ts:26-28` liest `isArmed` nur
- Schnittstellen: keine öffentliche Signatur geändert · Verhalten: `onLandscape` fragt nicht an und `isArmed` ist nie `true`, solange ein anderes Element als das Ziel im Fullscreen liegt (außer es liegt auf dem Ziel gestapelt) · jedes Verlassen im Querformat setzt den Rückzug, auch das Ende eines fremden Fullscreens · intern neu `#foreignFullscreen()`, `#fullscreenHolds()` (Wächter neben `#holdsTarget()`; `#lock()` bleibt auf `#holdsTarget()`), `#decline()` (einzige Stelle, die `#declined` setzt), Feld `#foreignHeld`

### [x] 24. Drain 2: Namen in Meldungen einheitlich über describeValue()
- Nebenbefund: der Eintrag aus »Offene Befunde« mit »überführt in Paket 24« — 233 handgesetzte `"${…}"` in 43 Dateien unter `packages/twopoint5d/src/` (ohne Specs)
- Dazu (Zug 0, vorbestehend an d9b648bf, gleiche Ursache — ein Name steht roh in der Meldung): die blanken Listen bekannter Namen `src/sprites/features/frameSlices.ts:39` (`namesOf()`), `src/sprites/FeatureSprites/SpriteResources.ts:183`/`:253`/`:276`, `src/texture/AsepriteJson.ts:488`, `src/texture/TextureStore.ts:1049`, `src/vertex-objects/VertexObjectPool.ts:44-47`, `src/sprites/FeatureSprites/FeatureSpritesGeometry.ts:81` · der Wert in eigenen einfachen Anführungszeichen `src/display/DisplayFullscreen.ts:49` (`orientationLock '${type}'`)
- Ziel: Jeder Name in einer Fehler- oder Warnmeldung der Library geht über `describeValue()`, auch jeder einer Liste der bekannten Namen, die Regel »Error and warning messages« in `AGENTS.md` kennt keine Handform mehr, und die Specs prüfen die Meldungen mit dem Wortlaut, den `describeValue()` für gewöhnliche Namen schreibt (identisch zur Handform, solange kein `"`, `\` oder Zeilenumbruch im Namen steht; eine Liste bekannter Namen zitiert jetzt jeden Namen).
- Detail: `docs/remediation/paket-24.md`
- Zug 0 (2026-11-01): Nebenbefund besteht, leicht verschoben — 232 Zeilen mit 294 Vorkommen in 43 Dateien auf f02c7d86 (`AsepriteJson.ts:383` jetzt `:389`, Regel jetzt `AGENTS.md:135-139`). Wahl mit Grund in der Paketdatei: ein Paket, ein Commit (Diff mechanisch, ein Reviewer hält ihn), der Schnitt je Modul entfällt; die blanken Namenslisten und `DisplayFullscreen.ts:49` gehen mit (sonst widerspräche der neue Text in `AGENTS.md` dem Code); das eigene Vokabular der Library (Optionsschlüssel, Untertypen, Feld- und Exportnamen, Wahlmöglichkeiten aus Konstanten wie `sampleAtlasFrame.ts:89-101`) bleibt blank, statischer Text in Anführungszeichen ebenso; `defineSprite.ts:232` liest die Meldung des Descriptors und zitiert mit ihm über `describeValue()`; Kürzung über 120 Einheiten nimmt das Paket in Kauf; kein Wächter im Gate, die Vollständigkeit belegen zwei `git grep` im Verify. Wortlaut des neuen Absatzes in `AGENTS.md` und der erweiterten `Fixed`-Zeile `CHANGELOG.md:91` steht in der Paketdatei; vier Proposal-Zitate der Listen-Meldungen ziehen nach, ohne Abweichungseintrag. Regressionstests je Modul mit escaptem Namen (rot vor dem Umbau), ≈ 25 bestehende Erwartungen der Listen und `DisplayFullscreen.spec.ts:1365` ändern ihren Wortlaut. Keine offene Folge; »Offene Befunde« hat keinen weiteren offenen Eintrag. Restplan unverändert: 24 ist das letzte Paket, danach der Abschluss
- Blocker für den kleinen Schnitt: ein mechanischer Umbau über 43 Dateien sprengt jedes Nachbarpaket
- Bereich: `packages/twopoint5d/src/` (43 Dateien der Inventur, `display/DisplayFullscreen.ts`, 14 Specs), `AGENTS.md`, `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]`, `Fixed`), drei Proposals (`animation-playback-and-aseprite.md`, `flip-anchor-nine-slice.md`, `pool-sorting.md`); kein Guide, nichts unter `apps/` oder `packages/twopoint5d-testing/`
- Hängt ab von: 23 (`DisplayFullscreen.ts` liegt in beiden Flächen)
- Hash: dddfd7fd
- Ergebnis: 1 Runde (wichtig im Review: ein fünftes Proposal-Zitat `animation-playback-and-aseprite.md:297` `its tags are: idle, walk, kick` stand noch blank; klein: Cast `as string` in `TexturePackerJson.ts:129` mitgenommen) · Nebenbefund samt »Dazu«-Stellen laut Review behoben: keine handgesetzte Interpolation mehr in `packages/twopoint5d/src/` ohne Specs (beide `git grep` aus Schritt 9 leer), acht Namenslisten über `.map(describeValue)`, `DisplayFullscreen.ts:49`, Paarung `defineSprite.ts:232`/`:233`, Regel `AGENTS.md:135-144`, `CHANGELOG.md:91`, fünf Proposal-Zitate · Regressionstests, vor dem Umbau rot (`8 failed | 749 passed`): `escapes a quote in the name two slices share` (`AsepriteJson.spec.ts`), `escapes a line break in a frame name that appears twice` (`TexturePackerJson.spec.ts`), `escapes a quote in the id of a resource it does not hold` (`TextureStore.spec.ts`), `escapes a quote in the name two features share` und `names the attributes of features that do not fit, a quote in their names escaped` (`defineSprite.spec.ts`), `escapes a quote in the name of a stage it cannot take` (`StageRenderer.spec.ts`), `escapes a quote in the face of a font of more than one page` (`BitmapFont.spec.ts`), `escapes a line break in the name of an attribute without a size` (`VertexObjectDescriptor.spec.ts`); 14 bestehende Erwartungen auf den zitierten Listen-Wortlaut nachgezogen · klein: 0 offen
- Nebenbefunde: keine (Vorbehalt des Implementierers: die geänderten Dateien nicht ganz gelesen, nur Diffs und gezielte Suchen — steht in der Paketdatei)
- Folgen: keine offenen — Urls und Namen über 120 UTF-16-Einheiten erscheinen in Meldungen mit `…` gekürzt (im Detailplan in Kauf genommen, keine Spec bricht)
- Schnittstellen: keine Signatur bewegt · Wortlaut: jede Liste bekannter Namen in einer Meldung zitiert jeden Namen (`its tags are: "idle", "run"`, `declared: "colorMap"`, `known: "texturepacker", "aseprite";`, `name one of "x", "y", …`), `orientationLock "portrait" and onLandscape cannot work together`; `AGENTS.md` kennt keine handgesetzten Anführungszeichen mehr — neue Meldungen zitieren jeden Namen über `describeValue()`

### [x] 25. Drain 3: Prosa der Markdown-Doku — Umbrüche, Wortlaut, fehlende Angaben
- Detail: `docs/remediation/paket-25.md`
- Hash: 5edbc74f
- Ergebnis: 0 Runden · alle 25 bestehenden Stellen und die Zug-0-Zusätze (Mip-Stufen in `textures.md`/`MothChapel.ts`, laufbedingte und vorbestehende Überlängen) behoben, Reviewer: alle Schritte erfüllt, keine kritischen/wichtigen Befunde · Doku-Paket, kein Regressionstest
- Nebenbefunde: → Queue
- Folgen: keine
- Nebenbefund: 26 offene Reviewer-Befunde (»klein«) und Abweichungen aus den committeten Paketen, je mit Fundstelle:
  - `AGENTS.md:60, :63-64; docs/architecture.md:179, :368` — Absätze nach der Änderung nicht neu umbrochen (119/127 Zeichen statt ~90). (aus paket-2.md)
  - `docs/architecture.md:247; packages/twopoint5d-testing/web-test-runner.config.js:213; packages/twopoint5d-testing/test/helpers/fixtures.js:40` — »every test file that starts a renderer« passt nicht zum Kriterium von RENDERER_FREE_FILES, genauer wäre »that renders«. (aus paket-3.md)
  - `docs/architecture.md:468` — »the four first« statt »the first four«. (aus paket-3.md)
  - `docs/architecture.md:247, 483-484, 516-517, 567-568; AGENTS.md:186-188` — Zeilenumbruch der Umgebung gebrochen. (aus paket-3.md)
  - `packages/twopoint5d/docs/stages.md:796` — Ergänzter Satz nicht neu umbrochen (~150 Zeichen, Nachbarn ≤ 100). (aus paket-6.md)
  - `packages/twopoint5d/docs/resource-lifecycle.md:31` — Zeile nach dem neuen DynamicAtlas-Satz zu lang, Absatz nicht neu umbrochen. (aus paket-6.md)
  - `packages/twopoint5d/docs/proposals/pipeline-stages-and-grid-base.md:184` — Zeilenrest »Frozen all the way down, its description and the« nicht neu umbrochen. (aus paket-9.md)
  - `packages/twopoint5d/CHANGELOG.md:60` — »for NaN or a value that is no number« unterschlägt ±Infinity, für das sich bei TexturePackerJson/AsepriteJson/BitmapFont die Meldung ebenfalls ändert. (aus paket-11.md)
  - `packages/twopoint5d/docs/map2d.md:255, :177` — »the most chunks a leaf keeps« / »leaves up to that many chunks in a leaf« sagt zu viel zu: ohne trennende Achse behält ein Blatt beliebig viele. (aus paket-11.md)
  - `packages/twopoint5d/docs/map2d.md:352` — Prosazeile mit 115 Zeichen nicht umbrochen. (aus paket-11.md)
  - `apps/lookbook/assets-src/README.md:620` — Kurze Zeile nach »atlas upright. The art is«, Absatz nicht neu umbrochen. (aus paket-13b.md)
  - `packages/twopoint5d/docs/proposals/wave-and-segment-sprites.md §4.3 (keine Zeile)` — Umbruch in §4.3 ragged. (aus paket-14.md)
  - `packages/twopoint5d/docs/proposals/wave-and-segment-sprites.md §4.3 (keine Zeile)` — »which read level 0 alone« bezieht sich grammatisch auf die Filter statt auf die Textur. (aus paket-14.md)
  - `packages/twopoint5d/docs/proposals/display-fullscreen.md §6.3 (keine Zeile)` — §6.3 nach der Einfügung nicht neu umbrochen. (aus paket-15.md)
  - `packages/twopoint5d/docs/display.md:596-601` — Absatz »Which element goes fullscreen« nicht neu umbrochen. (aus paket-15.md)
  - `packages/twopoint5d/docs/display.md:601` — »—,« im neuen Guide-Satz liest sich holprig. (aus paket-15.md)
  - `docs/architecture.md §5 (keine Zeile)` — Neuer Satz »and with it the audit step of CI (§3)«: der CI-Schritt meldet mit --audit-level=high nur, die Ausnahme ändert dort praktisch nichts; formal richtig. (aus paket-17.md)
  - `packages/twopoint5d/docs/display.md:507` — Neu umbrochene Zeile mit 105 Zeichen statt ~100. (aus paket-18.md)
  - `packages/twopoint5d/docs/proposals/gpu-picking.md:279-281` — »Ownership« nennt Holder-Group und ClippingGroup-Spiegel je Eintrag nicht. (aus paket-19.md)
  - `packages/twopoint5d/docs/textures.md:101-103` — »What is left alone« nennt nur die Wrap-Werte, nicht generateMipmaps. (aus paket-19.md)
  - `AGENTS.md:140` — »A three.js object refused for its class is named« steht nach dem Umbruch als halbe Zeile mitten im Absatz. (aus paket-19.md)
  - `packages/twopoint5d/docs/stages.md:798-805` — Eine Zeile deutlich länger als die Nachbarn. (aus paket-21.md)
  - `packages/twopoint5d/docs/sprites.md:1174-1175` — Der neue Satz steht vor »update() of the mesh uploads …« und liest sich holprig. (aus paket-21.md)
  - `packages/twopoint5d/docs/proposals/display-fullscreen.md:406` — Zeile ~150 Zeichen; Einschub »— of the turn, of the armed tap or of the page« liest sich als Klammer ohne Ende. (aus paket-23.md)
  - `packages/twopoint5d/docs/proposals/display-fullscreen.md:373-375` — Nach dem Einschub bricht :374 nach ~45 Zeichen, »happened« steht allein am Anfang von :375. (aus paket-23.md)
  - `packages/twopoint5d/docs/display.md:515` — 101 Zeichen, eins über dem Umbruch der Nachbarzeilen. (aus paket-23.md)
- Abgleich (Zug 0, 2026-11-01): 25 der 26 Stellen bestehen, 10 davon verschoben (Stand je Stelle in der Paketdatei); `display.md:507` gegenstandslos — `f02c7d86` (Paket 23) hat den Absatz `:503-511` neu geschrieben, er hält jetzt höchstens 99 Zeichen
- Dazu (Zug 0, Folge von Paket 19, Symptom — dessen Mip-Abschnitt in `textures.md` sagt nicht, was three tut): `packages/twopoint5d/docs/textures.md:88-91` und `apps/lookbook/src/demos/stage-masks/MothChapel.ts:146-148` begründen `no-mipmaps` damit, dass three unter WebGPU eine `nearest`-Textur verkleinert aus ihren Mip-Stufen lese; three 0.187.0 liest eine Textur mit zwei `NearestFilter` mit `textureLoad` auf Level 0 ohne Sampler (`WGSLNodeBuilder.js:857-890`). Hier statt eines Nachtragspakets: Stelle `textures.md:101-103` überarbeitet denselben Abschnitt
- Dazu (Zug 0, gleiche Ursache — ein Satz eingefügt oder angehängt, ohne den Absatz neu zu umbrechen; Doku vollständig gemessen): neun laufbedingte Stellen, die kein Reviewer nannte (`docs/architecture.md:507`, `display-fullscreen.md:606`, `animation-playback-and-aseprite.md:422`, `gpu-picking.md:19`, `sprites.md:1211`/`:1613`/`:1807`, `text.md:177`, `textures.md:568`), und 20 vorbestehende Zeilen (`AGENTS.md:270`, `packages/twopoint5d/docs/architecture.md:9`, `display.md:11`, `sprite-visibility.md:190`, `stage-masks.md:5`/`:184`/`:276`/`:287`, `sprites.md:486`/`:589`/`:1954`, `stages.md:187`/`:514`/`:532`/`:678`/`:1417`/`:1482`/`:1483`, `textures.md:217`, `assets-src/README.md:165`); Zeilen, die nur eine zitierte Meldung, Formel oder einen Link tragen, bleiben (30, Liste in der Paketdatei)
- Folge von: Paket 19 (nur der Teil »Dazu, Folge von Paket 19«; die Reviewer-Befunde nicht)
- Ziel: Jede Prosazeile der Markdown-Doku, die den Umbruch ihrer Datei sprengt — die genannten Stellen der Reviewer, die übrigen aus diesem Lauf und die vorbestehenden, die Zug 0 gemessen hat —, steht im Umbruch ihrer Datei (90 bzw. 100 Spalten), und die genannten Sätze sagen genau, was der Code tut: die Blattgrenze von `subdivide()`, ±Infinity im CHANGELOG, `generateMipmaps` und das Lesen der Mip-Stufen in `textures.md` und `MothChapel.ts`, die Ownership des Pickers, »renders« statt »starts a renderer«, der Audit-Satz in §5 und »the first four«.
- Bereich: `AGENTS.md`, `docs/architecture.md`, `packages/twopoint5d/docs/**`, `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]`, Zeile `:62`), `apps/lookbook/assets-src/README.md`; dazu drei Code-Kommentare (`web-test-runner.config.js:213`, `fixtures.js:40`, `MothChapel.ts:146-148`)
- Hängt ab von: —
- Hash: —

### [x] 26. Drain 3: TSDoc und Kommentare im Library-Code, Import-Reihenfolge
- Detail: `docs/remediation/paket-26.md`
- Nebenbefund: 17 offene Reviewer-Befunde (»klein«) und Abweichungen aus den committeten Paketen, je mit Fundstelle:
  - `packages/twopoint5d-testing/test/vertex-objects-heap.test.js:29` — Heap-Kommentar nennt nur die WebGL2-Zahl (1,8 %), gemessen 1,82 % WebGL2 / 1,93 % WebGPU. (aus paket-1.md)
  - `packages/twopoint5d-testing/test/stage-masks.test.js:18` — countNodeBuilds im Import nicht alphabetisch einsortiert. (aus paket-3.md)
  - `packages/twopoint5d/src/texture/AsepriteJson.ts:336; packages/twopoint5d/src/texture/FrameBasedAnimations.ts:409-410` — TSDoc-Absätze nach dem Einfügen nicht neu umbrochen (114 Zeichen). (aus paket-8.md)
  - `packages/twopoint5d/src/sprites/features/SegmentPlacement.ts:63-65` — JSDoc bricht nach »So is a kind with NineSlice,« mitten im Satz um. (aus paket-9.md)
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:340` — @throws-Zeile deutlich länger als ihre Nachbarn. (aus paket-9.md)
  - `packages/twopoint5d/src/controls/PanControl2D.ts:687, :831, :834, :846; PanControl2D.spec.ts:585/606` — Kommentare und Testnamen nennen Events mit den alten Kurznamen (»a restoreCursor listener«, »a hideCursor went out«). (aus paket-10.md)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectGeometry.ts:26-27, :33` — Zweimal fast derselbe Kommentar »super() only ever sees a pool …«. (aus paket-10.md)
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:252` — Kommentar »at most maxVisibleTiles bytes« stimmt nicht, wenn maxVisibleTiles nach einer großen Fläche gesenkt wird. (aus paket-11.md)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts:147` — Leerzeile vor dem neuen describe fehlt. (aus paket-11.md)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:139; VertexObjectBuffer.ts:168, :183, :401, :500, :575` — TSDocs sagen »integer of 0 or more« statt »whole number« (inhaltlich richtig; vom Implementierer gemeldet). (aus paket-11.md)
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts (TSDoc #placeTile(), keine Zeile genannt)` — TSDoc von #placeTile() wiederholt sich (»Expects the search to have kept it.«). (aus paket-11b.md)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:115-117` — TSDoc-Punkt 2 sagt »a positive integer size« neben »a whole number of 1 or more« in Punkt 1; gewollt, liest sich wie ein Rest. (aus paket-16.md)
  - `packages/twopoint5d/src/display/DisplayFullscreen.spec.ts:4` — Import ../testing/eventTargetStub.js steht zwischen den ./-Imports (in Display.spec.ts:15 davor). (aus paket-18.md)
  - `packages/twopoint5d/src/text/writeText.ts:28-30` — Kommentar vermischt »the names they are exported under« und »the name of the feature«. (aus paket-19.md)
  - `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:127-128` — Drei Gedankenstriche in einem TSDoc-Satz, liest sich holprig. (aus paket-20.md)
  - `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:608-609` — TSDoc von update() bricht unregelmäßig um (eine Zeile ≈ 140 Zeichen). (aus paket-21.md)
  - `packages/twopoint5d/src/display/DisplayFullscreen.ts:992` — Kommentar »#fullscreenHolds() counts the fullscreens of other elements on top of it« ist mehrdeutig. (aus paket-23.md)
- Abgleich (Zug 0, 2026-11-01): alle 17 Stellen bestehen, 4 verschoben (`AsepriteJson.ts:334`, `VertexObjectPool.ts:140`/`VertexObjectBuffer.ts:176`, `:191`, `:409`, `:508`, `:583`, `InstancedVOBufferGeometry.ts:609-612`, `DisplayFullscreen.ts:993`), `#placeTile()` jetzt `CameraBasedVisibility.ts:1013-1014`; keine gegenstandslos
- Dazu (Zug 0, Symptome der Pakete 10 und 11, gleiche Ursache): sieben Testtexte mit `restoreCursor` (`pan-control-cursor.test.js:95`/`:104`, `pan-control-input.test.js:274`/`:289`/`:298`, `pan-control-switch-off.test.js:57`, dazu `PanControl2D.spec.ts:587`/`:608`), Spec-Titel `VertexObjectBuffer.spec.ts:1116` (»integer of 0 or more«), Kurzzeile `VOBufferPool.ts:211` (laufbedingt, `b3de20ef`)
- Dazu (Zug 0, vorbestehend, gleiche Ursache — eine Zeile über 110 überragt ihre Nachbarn um 10 und mehr; Kommentare vollständig gemessen und gegen `d9b648bf` geblamt): `SegmentPlacement.ts:67`, `stage/matte.spec.ts:54`, `DynamicAtlas.ts:529`, `TextureFactory.ts:165`, `TextureStore.ts:893`, `TileSet.ts:82` (samt »to up to«), `InstancedVOBufferGeometry.ts:257`, `vertex-objects/types.ts:24`; einzeilige Kommentare und gleichmäßig breite Absätze bleiben (Liste und Grund in der Paketdatei). Die Meldung `VertexObjectDescriptor.ts:170` bleibt, nur das TSDoc ändert sich (Paket 16 hat sie als eigene Meldungsklasse stehen lassen)
- Ziel: Jedes genannte TSDoc und jeder Kommentar ist eindeutig, wiederholt sich nicht, nennt die Events mit ihren heutigen Namen und ist wie seine Nachbarn umbrochen; Imports und Leerzeilen folgen der Umgebung. Dazu ist jeder Kommentarabsatz, in dem eine Zeile über 110 ihre Nachbarn um 10 und mehr überragt, auf höchstens 100 Spalten umbrochen, und kein Testtext nennt ein Event der Pan-Control mit seinem alten Kurznamen.
- Bereich: `packages/twopoint5d/src/**` (24 Dateien, nur Kommentare, Testtexte, ein Import, eine Leerzeile), `packages/twopoint5d-testing/test/` (fünf Dateien); keine Meldung, kein Verhalten, kein CHANGELOG, kein Markdown
- Hängt ab von: —
- Hash: —
- Hash: 9f119a6d
- Ergebnis: 0 Runden · alle 17 überführten Stellen und die Zusätze aus Zug 0 erledigt (Reviewer: Schritte 1–26 erfüllt) · kein Regressionstest (kein Verhalten geändert) · klein: zwei regelkonforme Umbrüche in `PanControl2D.ts`/`FeatureSprites.ts`
- Nebenbefunde: keine
- Folgen: keine

### [x] 27. Drain 3: Verhalten und Tests der Library — Aseprite-Rat, meta.image, Spec-Lücken, ein Cast
- Detail: `docs/remediation/paket-27.md`
- Nebenbefund: 8 offene Reviewer-Befunde (»klein«) und Abweichungen aus den committeten Paketen, je mit Fundstelle:
  - `packages/twopoint5d/src/texture/AsepriteJson.ts:464-469` — Bei repeat === 0 wird ein Loop-Tag über 8192 Frames mit dem unpassenden Rat »lower its repeat« abgelehnt. (aus paket-8.md)
  - `packages/twopoint5d/src/texture/TextureResource.ts:251-258 (imageNamedBy(), laut Review)` — BUG-025: ein meta.image eines Jsons von außen, das kein String ist, wird nicht als atlasParse gemeldet, sondern still wie ein fehlendes Bild behandelt. (aus paket-8.md)
  - `ohne Zeile` — Drei Aseprite-Specs von 9000 auf 8192 Frames gezogen; die Prüfung auf MaxFramesWithDurations greift in den Specs nur noch bei genau 8192 gespielten Frames. (aus remediation-plan.md (Paket 8, Ergebnis))
  - `packages/twopoint5d/src/display/DisplayFullscreen.ts:358` — Eine aufgeschobene Schärfung entfällt, wenn die Seite nach einer Ablehnung synchron erneut request() ruft; entspricht §6.2, aber ohne Test. (aus paket-18.md)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:732-743` — Prüfung »Buffer-Werte unverändert« greift nicht, weil die Daten per toBuffersData({copy: true}) aus demselben Pool stammen. (aus paket-20.md)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:746-750` — Konstruktor-Test prüft nur die Klasse RangeError, nicht die Meldung. (aus paket-20.md)
  - `packages/twopoint5d/src/stage/transitionEffects.ts:503` — Geprüfter Upcast progress: p as Node<'float'> bleibt, obwohl derselbe Wert bei :495 ohne Cast durchgeht. (aus paket-20.md)
  - `ohne Zeile` — Kein Test für das fullscreenerror-Event (Entscheidung 9, Abweichung von der Empfehlung zu TEST-001); getestet ist nur die Ablehnung über das Promise (DisplayFullscreen.spec.ts:157 laut Zug 0). (aus paket-5.md)
- Abgleich (Zug 0, 2026-11-01): alle acht Stellen bestehen, keine gegenstandslos (Aseprite-Meldung jetzt `AsepriteJson.ts:465`, `imageNamedBy()` `TextureResource.ts:253-260`, Aufschub `DisplayFullscreen.ts:381`, `VertexObjectPool.spec.ts:732-744`/`:746-750`, `transitionEffects.ts:503`; der Controller hört `fullscreenerror` nicht, die Ablehnung kommt über das Promise)
- Dazu (Zug 0, gleiche Ursache — die Grenzprüfung kennt nur die Wiederholung als Grund für zu viele Frames): die Durations-Meldung `AsepriteJson.ts:474-478` rät ebenso »lower its repeat« bei einem Tag, der ohne Wiederholung 8192 Frames spannt, und mit eigenem Playback überspringt `:456-457` die Zählung, sodass ein Tag über mehr als 8192 Frames durchgeht, gegen das TSDoc `:333-334`
- Dazu (Zug 0, gleiche Ursache — die Meta-Prüfung steht hinter dem Tor »ohne Bild nichts bauen« des Atlas-Effekts): ein `meta`, das kein Objekt ist, ohne `overrideImageUrl` bleibt ebenso still (`TextureResource.spec.ts:1592`); das TSDoc des Setters `onLandscape` (`DisplayFullscreen.ts:360-362`) nennt die Bedingung nicht, die der neue Test zu Befund 4 festhält
- Ziel: `AsepriteJson.parse()` rät nur dann zu einem kleineren `repeat`, wenn die Wiederholung die Ursache ist, und prüft die Grenze der Frames auch für einen Tag mit eigenem Playback; ein `atlasJson` von außen, dessen `meta` kein Objekt oder dessen `meta.image` gesetzt, aber kein String ist, wird einmal je Schreiben als Fehler gemeldet; die genannten Specs prüfen, was sie prüfen sollen (Grenzen um 8191/8192 Frames, unveränderte Buffer-Werte, Meldung im Konstruktor-Test, aufgeschobene Schärfung, `fullscreenerror`); der Cast in `transitionEffects.ts:503` entfällt.
- Zug 0 (2026-11-01): Wahl mit Grund in der Paketdatei: der Rat richtet sich danach, ob ein Durchgang des Tags die Grenze hält (»lower its repeat«), sonst »split it into shorter tags« (bei eigenen Dauern auch »give its frames one duration«); die Zählung gilt auch mit eigenem Playback. Ein `meta.image` ohne Wert bleibt still (Vertrag von Paket 8, `TextureResource.spec.ts:3023`), ein gesetztes, das kein String ist, wird ohne Override gemeldet, ein `meta`, das kein Objekt ist, immer; gemeldet aus dem Effekt, der `imageUrl` ableitet (läuft einmal je Schreiben von Json oder Override), unter dem neuen internen Ladeschritt `'atlasJson'` mit denselben zurückgehaltenen Subtypen wie `atlasParse` — ein `getAsync()` des Atlas lehnt ab, statt zu warten; die Meta-Prüfung im `try` des Atlas-Effekts entfällt (Abweichung vom Wortlaut »als atlasParse«: der Schritt ist intern, das Event ist dasselbe, `source: 'texture'`). Specs der Befunde 3–5 und 8 sind Abdeckung, belegt durch benannte Verfälschungen; Befunde 1 und 2 mit rotem Lauf. CHANGELOG nur die beiden `Fixed`-Zeilen `:75`/`:80` ergänzt. Keine offene Folge; »Offene Befunde« hat keinen Eintrag gleicher Ursache. Restplan unverändert: 28 berührt keine Datei dieses Pakets
- Bereich: `packages/twopoint5d/src/texture/` (`AsepriteJson.ts`, `TextureResource.ts`, Specs samt `TextureStore.spec.ts`), `src/display/DisplayFullscreen.ts` (nur TSDoc) samt Spec, `src/vertex-objects/VertexObjectPool.spec.ts`, `src/stage/transitionEffects.ts`, `docs/sprites.md` (»Aseprite sheets«), `CHANGELOG.md` (nur `[Unreleased]` → `Fixed`)
- Hängt ab von: —
- Hash: ef8d23ab
- Ergebnis: 0 Runden · alle acht Nebenbefunde behoben (Reviewer: erfüllt je Befund und je Schritt) · rot vor dem Fix: `refuses a tag that spans more frames than a data texture holds, whatever its repeat, and advises to split it` (4 Zeilen), `refuses a tag that spans more frames with their own durations than an animation holds, and advises one duration or a split`, die beiden umbenannten `TextureResource.spec.ts`-Tests zu `meta`/`meta.image`, `an overrideImageUrl written after an atlasJson whose meta.image is no string builds the atlas, and the report goes out once`, TextureStore `a getAsync() of the atlas rejects once an atlasJson whose meta.image is no string is written …` · Abdeckungs-Specs (8191/8194 Frames, aufgeschobene Schärfung, `fullscreenerror`, Vertex-Pool) unter benannten Verfälschungen rot, zurückgenommen · klein (5, in der Paketdatei): Testname `TextureResource.spec.ts:1680` »as a json its adapter cannot read«, »and so« in `CHANGELOG.md:75`, Satzbau `sprites.md:383-387`, `messageOf(settled)` gegen einen Atlas `TextureStore.spec.ts:2741`, zwei `await Promise.resolve()` statt `flush()` `DisplayFullscreen.spec.ts:242-243`
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: keine öffentliche — `AtlasTextureResource` meldet ein `atlasJson` von außen mit `meta` kein Objekt (immer) oder gesetztem `meta.image` kein String (ohne Override) als `error` mit `source: 'texture'`, ein `getAsync()` des Atlas lehnt dann ab (interner Ladeschritt `'atlasJson'`)

### [x] 28. Drain 3: Gate, Lockfile, Workflows, Preview-Generator und Lookbook-Reste
- Detail: `docs/remediation/paket-28.md`
- Nebenbefund: 12 offene Reviewer-Befunde (»klein«) und Abweichungen aus den committeten Paketen, je mit Fundstelle:
  - `ohne Zeile` — Gate unverändert: lint bleibt biome ci . ohne --error-on-warnings; die Warnfreiheit prüfte nur das Verify, das Gate erzwingt sie nicht. (aus paket-17.md)
  - `pnpm-workspace.yaml (auditConfig.ignoreGhsas, keine Zeile)` — minimatch 10.2.5 unter nx (GHSA-g3hv-75wg-m249) und deepmerge 4.3.1 (GHSA-gcqx-w48m-w2h4) bleiben im Lockfile, per Audit-Ausnahme stummgeschaltet statt Bump/Override (Abweichung vom Ziel-Wortlaut). (aus paket-17.md)
  - `.github/workflows/deploy.yml:115` — Step-Timeout »timeout-minutes: 2« beendet einen hängenden pnpm audit, bevor pnpm-audit.err im Log steht; fail closed hält, nur der Grund fehlt. (aus paket-2.md)
  - `scripts/lookbook/generateDemoPreviews.mjs:157` — Logzeile »WebGPU adapter: none, three.js renders with WebGL 2« steht ohne --allow-webgl2 direkt vor dem Abbruch, obwohl nichts gerendert wird. (aus paket-2.md)
  - `apps/lookbook/src/demos/stage-masks/Trench.ts:36-38; PaintedMoor.ts:31` — Relative Imports nicht hinter three/* und ~demos/* einsortiert. (aus paket-12.md)
  - `apps/lookbook/src/demos/stage-masks/helpers.ts (keine Zeile)` — Modul-TSDoc steht als zweiter Doc-Block vor STEP. (aus paket-12.md)
  - `apps/lookbook/src/demos/stage-masks/heatHaze.ts (keine Zeile)` — TSDoc »It bends both pictures«: Gedankenstrich vor Komma, sehr lange Zeile. (aus paket-12.md)
  - `apps/lookbook/src/demos/stage-masks/helpers.ts (keine Zeile)` — SeededRandom.range() ohne TSDoc. (aus paket-12.md)
  - `apps/lookbook/src/demos/stage-masks/TransitionCycler.ts:78` — onBegin als (from: IStage, to: IStage) typisiert, bekommt StageDirectorLayer; ebenso #shownFrom/#shownTo. (aus paket-13.md)
  - `apps/lookbook/src/demos/utils/fetchAsset.ts (keine Zeile)` — Die Layout-JSONs der zwölf Szenen werden nicht zur Laufzeit validiert (CONS-002 nannte den ungeprüften Cast); fetchJson() prüft nur Status und JSON-Syntax. (aus paket-13b.md)
  - `ohne Zeile` — stage-masks-shared/-rift/-frozen/-portal zeigen nach dem Umbau eine andere Zufallsanordnung als ihr Vorschaubild; die Vorschaubilder wurden nicht neu erzeugt. (aus remediation-plan.md (Paket 12, Ergebnis))
  - `ohne Zeile` — Die Vorschaubilder des Lookbooks (Galerie, Game-Menu mit dissolve()) bleiben nach der Änderung des Zellmusters unverändert, nicht neu erzeugt. (aus paket-20.md)
- Ziel: `pnpm lint` bricht bei Warnungen ab, minimatch und deepmerge stehen ohne Audit-Ausnahme im Lockfile (Override auf eine behobene Version, für deepmerge notfalls `pnpm patch`; nur wenn beides nachweislich scheitert, bleibt die Ausnahme mit Begründung), Deploy-Workflow und Preview-Generator melden ihren Grund, die genannten Lookbook-Stellen sind typ- und doc-sauber, die Layout-JSONs werden beim Laden geprüft, und die Vorschaubilder der Demos, deren Bild sich geändert hat, sind neu erzeugt (`pnpm lookbook:generate-previews --only=…`).
- Abgleich (Zug 0, 2026-11-01): alle zwölf Stellen bestehen, drei verschoben (`Trench.ts:29-31`, `TransitionCycler.ts:39`/`:62-63`, Generator `:156-161`); Befund 10 betrifft zehn Dateien in neun Szenen, nicht zwölf; `biome ci --error-on-warnings .` ist auf ef8d23ab schon grün
- Dazu (Zug 0, vorbestehend an d9b648bf, gleiche Ursache wie der Deploy-Befund — ein Schritt-Timeout ohne Frist des Kommandos verschluckt dessen Ausgabe): `.github/workflows/ci.yml:96-112` (Schritt `Audit dependencies`)
- Zug 0 (2026-11-01): Wahl mit Grund in der Paketdatei. Die beiden Audit-Ausnahmen bleiben, weil Override und Patch nachweislich scheitern — nx 24.0.3 (neuester Release) pinnt minimatch 10.2.5 und ruft `minimatch.makeRe()`, das 11 entfernt; deepmerge hat keinen Fix, 4.1.1 unter der Range hat gar keinen Schutz, und ein `pnpm patch` lässt `pnpm audit` unverändert (Probe `<Arbeitsverzeichnis>/paket-28-probe/`); geändert werden nur der deepmerge-Kommentar (zwei Aufrufer statt einem, Grund gegen den Patch) und ein Satz in `docs/architecture.md` §5. `pnpm audit` im Deploy und in CI bekommt `timeout -k 10 90` innerhalb von `timeout-minutes: 2`. Layout-JSONs über ein neues Modul `apps/lookbook/src/demos/utils/checkJson.ts` (typisierte Prüf-Kombinatoren, `jsonObject<T>` an das bestehende Interface gebunden), `fetchJson()` nimmt die Prüfung als Pflichtparameter. `#shownFrom`/`#shownTo` im Cycler bleiben `IStage` (halten `StageTransition#from`/`#to`, enger nur per Cast), `onBegin` wird `StageDirectorLayer`. Vorschaubilder: alle 42 zweimal unter `--strict` erzeugen, gegen die eingecheckten messen, nur die mit geändertem Inhalt übernehmen. Kein CHANGELOG. Keine offene Folge im Plan; der offene Eintrag in »Offene Befunde« hat eine andere Ursache und bleibt (→ Audit). Restplan unverändert: 28 ist das letzte Paket, danach der Abschluss
- Bereich: `package.json`, `AGENTS.md`, `docs/architecture.md` (§3, §4, §5, `lint`), `pnpm-workspace.yaml` (nur Kommentar), `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `scripts/lookbook/generateDemoPreviews.mjs`, `apps/lookbook/src/demos/` (14 Szenen-/Hilfsdateien, neu `utils/checkJson.ts`), `apps/lookbook/README.md`, `apps/lookbook/public/images/demo-preview/` (nur geänderte Bilder); nicht `pnpm-lock.yaml`, nicht `biome.jsonc`, kein Library-Code, kein CHANGELOG
- Hängt ab von: —
- Hash: 87825336
- Ergebnis: 1 Runde · Befunde 1–12 und 3a behoben (Reviewer) · Belege statt Regressionstest: `pnpm lint` mit doppeltem `describe`-Titel vorher exit 0, nachher exit 1; `pnpm audit` exit 0; Probeläufe der Audit-`run`-Blöcke (Deploy exit 1 mit Grund, CI exit 0 mit Zeile im Summary); Proben `checkJson`/`fetchJson`/Layouts vor der Änderung rot, danach grün (32 Tests) · Vorschaubilder: zwei `--strict`-Läufe exit 0 (WebGPU), acht neu übernommen (`stage-masks-frozen`, `-heat-haze`, `-matte-threshold`, `-rift`, `-shared`, `stage-nested-pipelines`, `stage-postprocessing`, `stage-projections`); `-portal`, `stage-transitions-gallery`, `-game-menu` unter der Messregel, unverändert · klein: toter `String(cause)`-Zweig in `fetchAsset.ts`
- Nebenbefunde: → Queue
- Folgen: —
- Schnittstellen (Lookbook): `fetchJson(subject, url, check)` — dritter Parameter `JsonCheck<T>` Pflicht · neu `apps/lookbook/src/demos/utils/checkJson.ts` (`JsonCheck`, `jsonNumber`, `jsonString`, `jsonOneOf`, `jsonList`, `jsonTuple`, `jsonRecord`, `jsonObject`) · `checkCrawlLayout` aus `stage-masks/CrawlRig.ts` exportiert · `pnpm lint` = `biome ci --error-on-warnings .`

### [x] 29. Abschluss: letzte Überlängen in der Prosa und ein toter Zweig in fetchAsset.ts
- Detail: `docs/remediation/paket-29.md`
- Nebenbefund: die zwei Einträge aus »Offene Befunde« mit »überführt in Paket 29« — Prosazeilen über dem Umbruch ihrer Datei in `AGENTS.md:157`, `docs/architecture.md:15`/`:17`/`:105`/`:118`/`:637`/`:641`, `apps/lookbook/assets-src/README.md:490`/`:491`/`:589`/`:639`/`:642`/`:644` · dazu »klein« aus Paket 28: toter `String(cause)`-Zweig in `apps/lookbook/src/demos/utils/fetchAsset.ts`
- Ziel: Keine Prosazeile in diesen drei Dateien liegt über dem Umbruch ihrer Datei, und `fetchAsset.ts` hat keinen toten Zweig. Dieses Paket nimmt keine weiteren Nebenbefunde auf; was auffällt, kommt mit Urteil `→ Audit` in die Queue.
- Blocker für den kleinen Schnitt: letzte Reste nach Drain-Runde 3, kein Nachbarpaket mehr offen
- Abgleich (Zug 0, 2026-11-01, gegen 87825336): `AGENTS.md:157`, `docs/architecture.md:118`, `assets-src/README.md:490`/`:491`/`:589`/`:639`/`:642`/`:644` und der Zweig `fetchAsset.ts:47` unverändert · `docs/architecture.md:637` ist jetzt `:641` (dieselbe Zeile, verschoben durch Paket 28) · `:15`/`:17` (Tabellenzeilen) und `:105` (Codeblock) gegenstandslos, nach der Regel aus Paket 25 ausgenommen · Zielzeilen fertig gerechnet in der Paketdatei; `fetchJson()` fängt nur noch den `TypeError` einer Ablehnung und gibt alles andere unverändert weiter (Grund in der Paketdatei) · keine offenen Folgen, Queue leer, Restplan unverändert
- Bereich: `AGENTS.md`, `docs/architecture.md`, `apps/lookbook/assets-src/README.md`, `apps/lookbook/src/demos/utils/fetchAsset.ts`
- Hängt ab von: —
- Hash: b89b79b9
- Ergebnis: 0 Runden · alle neun Prosazeilen umgebrochen (Messschleife und Wortdiff leer) · toter `String(cause)`-Zweig entfernt, `fetchJson()` gibt alles außer dem `TypeError` einer Ablehnung unverändert weiter · Probe `what a check throws besides its refusal rejects as it is` außerhalb des Repos (vor dem Fix rot, 1 failed/3 passed; danach 4/4) · klein: `TypeError` aus einem Bug im Check wird weiterhin als Ablehnung gemeldet; Commit-Message holprig
- Nebenbefunde: → Queue
- Folgen: —
