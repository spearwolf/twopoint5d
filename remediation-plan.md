# Remediation-Plan — twopoint5d

Quelle: ./audit.html vom 2026-09-26 (zuletzt nachgeführt 2026-09-30) · Branch: main · erstellt: 2026-09-30
Baseline: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser — alles grün)
Verify-Kommando: `pnpm run ci` — Einzelschritte bei Bedarf: `pnpm lint` · `pnpm build` · `pnpm typecheck` · `pnpm checkPkgTypes` · `pnpm checkNameableTypes` · `pnpm lintPkg` · `pnpm test:scripts` · `pnpm test:coverage` · `pnpm test:browser`
Arbeitsverzeichnis: /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 66 von 66 offenen Findings (7 medium, 32 low, 27 info) · ausgenommen: 14 acknowledged
Scope-Regel: alles, jede Severity einschließlich info, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen. Ziel des Laufs ist ein Backlog ohne offenes Finding.
Kaltstarts: 10 Pakete (davon ein Nachtragspaket) × mindestens 3 Agenten ≈ 30, je Nachrunde zwei mehr · 7,3 Findings je Audit-Paket
Stand (2026-09-30): Lauf abgeschlossen — 13 Pakete committet (5738b5e5..dcd53a3b), keines blockiert, Befund-Queue leer (coordsTarget als API-066 ins Audit), `pnpm run ci` grün, Report in docs/remediation/20260930-remediation-report.md

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` geparkt, Stand im Stash.

## Entscheidungen
- TypeScript auf ^6.0 heben (TS 7 bleibt durch den Peer-Range von typescript-eslint gesperrt); die tsconfig vorher TS-6/7-fest machen (`baseUrl`, `downlevelIteration` raus, `types` explizit). Die Zurückhaltung von TS 7 und `prettier-plugin-astro` 1.x steht mit Grund in `docs/architecture.md` §5 (2026-09-30)
- three-Peer bleibt bei der Tilde (`~0.185.x`); die Policy »ein three-Bump ist ein Release« steht in AGENTS.md §»Shared dependency versions«. Kein Bump von three in diesem Lauf (2026-09-30)
- `printSceneGraphToConsole` verlässt die öffentliche API (`utils/public-api.ts`) und zieht in die Lookbook; CHANGELOG »Removed« (2026-09-30)
- `PanControl2D`: `update()` und die `on*()`-Helfer werden nach `dispose()` zu No-ops wie `onRestoreCursor()`; TSDoc, Test und CHANGELOG ziehen nach (2026-09-30)
- Ansage ohne Widerspruch: kein Release-Schnitt und kein Version-Bump in diesem Lauf (ein Bump auf `main` würde nach dem Push veröffentlichen); DOC-061 wird dadurch geschlossen, dass der CHANGELOG-Kopf des Unreleased-Blocks die Ansammlung als beabsichtigt festhält, im Einklang mit dem acknowledged Release-Rückstand (2026-09-30)
- Ansage: `@types/three` wird optionaler Peer (`peerDependenciesMeta.optional`) (2026-09-30)
- Ansage: die Lookbook-Suche (Ctrl/Cmd+K) wird implementiert, nicht entfernt — über die schon im DOM liegenden Metadaten (2026-09-30)
- Ansage: `no-explicit-any` und `no-non-null-assertion` gelten wieder für `packages/*/src/**`; die generierten Accessoren in `vertex-objects` bekommen einen gezielten Disable mit Grund (2026-09-30) — **abgelöst** durch die nächste Zeile
- `no-non-null-assertion` bleibt aus; ein Kommentar neben der Regel nennt `noUncheckedIndexedAccess` als Grund (`arr[i]!` ist darunter das Idiom der Hot Loops — die Probe fand 240 `!` im veröffentlichten Code über 30 Dateien, 166 davon Index-Zugriffe, nur 38 in den generierten Accessoren, dazu 1.193 in den Specs). `no-explicit-any` gilt für den veröffentlichten Library-Code: `packages/*/src/**/*.ts` ohne `*.spec.ts`, `*.bench.ts`, `src/testing/**`; die Specs behalten ihre Mocks (`renderer as any`). Rückfrage aus Paket 2, Zug 0 (2026-09-30)
- Ansage: Git-Tags entstehen im Deploy-Workflow nach erfolgreichem Publish; in diesem Lauf wird kein Tag gesetzt (2026-09-30)
- Die »Offenen Fragen« des Audit-Reports beziehen sich auf Findings, die nicht mehr im Backlog stehen; sie sind nicht Teil dieses Laufs (2026-09-30)
- Drain: die Befund-Queue wird nach der Scope-Regel in zwei Pakete (11 Lookbook, 12 Nachlese) geschnitten; der Befund zu `coordsTarget` (Urteil → Rückfrage) geht ins Audit (2026-09-30, Orchestrator im Abschluss)
- Drain, zweite Runde: die offen gebliebenen kleinen Reviewer-Befunde auf die Diffs der Pakete 7, 9, 10 und 12 sind Folgen dieses Laufs und gehen als Paket 13 in den Lauf statt ins Audit (2026-09-30, Orchestrator im Abschluss)

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
- Projektspezifisch: AGENTS.md vor der ersten Änderung lesen. Commit-Messages
  auf Englisch im Conventional-Commits-Stil wie in `git log`. Öffentliche
  API-Änderungen der Library kommen in den `[Unreleased]`-Block von
  `packages/twopoint5d/CHANGELOG.md` (Skill `updating-changelog`). Markdown und
  Kommentare brechen bei rund 88–90 Zeichen um. `pnpm publishNpmPkg` wird nie
  ausgeführt.

## Vorbestehende Fehler
- keine — die Baseline ist vollständig grün

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] `apps/lookbook/package.json:18` — `@spearwolf/astro-rainbow-line` steht auf
  `^1.3.0`, 2.1.0 ist seit 2026-09-24 erschienen und nirgends als zurückgehalten
  begründet; der Major tauscht das vendorte `apps/lookbook/public/js/rainbow-line-v0.4.0.js`
  samt Prüfung in `scripts/lookbook/rainbowLineScript.test.mjs` · aus Paket 1, Zug 0 ·
  low → Scope · geht in Paket 11 (Drain) · erledigt in 5ae2a583 (Reviewer bestätigt)
- [x] `packages/twopoint5d/README.md:60` — »depends on nothing but three.js and
  `@spearwolf/eventize`, both peer dependencies« unterschlägt den Peer
  `@spearwolf/signalize` · aus Paket 1, Zug 3 (Reviewer) · low → Scope · geht in Paket 8
  (derselbe Satz wie die Folge aus Paket 1 zu `@types/three`; Zug 0 Paket 2) · erledigt in
  d05f0422 (verweist auf die Peer-Liste unter Usage, Reviewer bestätigt)
- [x] `AGENTS.md:50` — verwaiste Zeile »whether« (9 Zeichen) im Punkt zu `pnpm
  test:scripts`, der Absatz `:49–52` franst aus; schon in 5738b5e5 so · aus Paket 2, Zug 3
  (Reviewer) · info → Scope · Dublette der AGENTS.md-Hälfte von DOC-070 (Paket 8); geht in
  Paket 3, das den Absatz `:45–52` für den neuen Kindprozess-Spec ohnehin neu schreibt
  (Zug 0 Paket 3) · erledigt in 5a413417 (Absatz neu umbrochen, Reviewer bestätigt)
- [x] `.github/workflows/ci.yml:11` — Kommentarzeilen über der Umbruchgrenze von 90, etwa
  `:11` mit 97 und der Timing-Kommentar am Bench-Schritt mit 96 (in 576d3fc6 elf Zeilen über
  90, die Kommentare darunter dort `:12`, `:16`, `:19`, `:95`, `:102`); schon in 576d3fc6 so
  · aus Paket 3, Zug 3 (Reviewer) · info → Scope · geht in Paket 4 (Zug 0 Paket 4: gleiche
  Ursache wie READ-018; auf 5a413417 die Kommentarzeilen `:11`, `:15`, `:98`, `:113`, `:132`) · erledigt in c301a1e5 (umbrochen,
  Reviewer bestätigt, Probe 2 leer)
- [x] `.github/workflows/deploy.yml:12–14` — `concurrency: deploy` mit `cancel-in-progress:
  false` hält höchstens einen wartenden Lauf; ein neuer verdrängt den älteren wartenden, so
  dass bei zwei Versions-Bumps kurz hintereinander während eines laufenden Deploys die
  mittlere Version nie veröffentlicht wird; schon in 576d3fc6 so, seit CI auch Markdown-Pushes
  fährt, warten öfter Läufe · aus Paket 3, Zug 3 (Reviewer) · low → Scope · geht in Paket 12 (Drain) · erledigt in f1b770e7 (Reviewer bestätigt)
- [x] `scripts/ci/nxCacheServer.mjs:22` — `Number.isInteger(port)` lässt Ports außerhalb
  0–65535 durch (`--port 70000`); `server.listen` wirft dann synchron `ERR_SOCKET_BAD_PORT`
  außerhalb des `'error'`-Handlers: Stacktrace statt Usage-Zeile, `--dir` schon angelegt;
  schon in 576d3fc6 so (`:19`) · aus Paket 3, Zug 2 (Implementierer) · info → Scope · geht in Paket 12 (Drain) · erledigt in f1b770e7 (Reviewer bestätigt)
- [x] `packages/twopoint5d/src/controls/PanControl2D.ts:126` — die Option `coordsTarget`
  (und das Feld `:248`) ändert keinen Pan: der Pan ist die Differenz zweier Positionen
  eines Pointers, und ein Rechteck, das im Drag steht, fällt heraus — so verlangt es die
  TSDoc der Option selbst, und ab Paket 5 steht es per Konstruktion (Rechteck je Pointer
  beim `pointerdown`). Die Option ist erst im `[Unreleased]`-Block hinzugekommen
  (CHANGELOG `:29`); schon in c82f42f7 so (`#toRelativeCoords` `:616–631`) · aus Paket 5,
  Zug 0 · info → Rückfrage: der Fix entfernt oder deprecatet eine öffentliche Option und
  läuft gegen die Entscheidung des Laufs vom 2026-09-19, Pointer gegen ein festes Element
  zu messen (CHANGELOG `:419`) · → ins Audit beim Abschluss (Drain, 2026-09-30), mit der Frage im Text · gebucht als API-066
- [x] `packages/twopoint5d-testing/test/pan-control-dispose.test.js:93` — der Kommentar
  »the keys are still held down as far as the browser is concerned« steht vor einem
  `keyup` nur für `KEY_NORTH`, gedrückt wurden vier Tasten; schon in c82f42f7 so (`:91`)
  · aus Paket 5, Zug 4 (Implementierer Runde 2) · info → Scope · geht in Paket 12 (Drain) · erledigt in f1b770e7 (Reviewer bestätigt)
- [x] `apps/lookbook/src/components/DemoNavBar.astro:111–155` — vier gescopte Regeln ohne
  Element im Markup der Komponente: `.lookbook-demo-header img.primary` (das Logo trägt
  `h-8`, nicht `primary`), `.container`, `.demo-navbar`, `.demo-navbar img.primary`; schon
  in c82f42f7 an denselben Zeilen · aus Paket 7, Zug 0 · info → Scope · geht in Paket 11 (Drain) · erledigt in 5ae2a583 (Reviewer bestätigt)
- [x] `apps/lookbook/src/pages/demos/animated-billboards.astro:80` und
  `animated-sprites.astro:98` — Kommentar `// material.uniforms['time'].value = now;`
  beschreibt eine API, die `AnimatedSpritesMaterial` nicht hat; schon in 4b9306c8 so (`:84`,
  `:118`) · aus Paket 7, Zug 2 (Implementierer) · info → Scope · geht in Paket 11 (Drain) · erledigt in 5ae2a583 (Reviewer bestätigt)
- [x] `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts:63` — versteckte Tags
  (`vanilla`, `react`, `demo`) werden als Schlüssel übersprungen, landen aber als
  `relatedTags` anderer Tags in `data-related-tags` der Tag-Wolke, ohne eigenes Element;
  schon in 4b9306c8 so (`:58`) · aus Paket 7, Zug 2 (Implementierer) · low → Scope · geht in Paket 11 (Drain) · erledigt in 5ae2a583 (Reviewer bestätigt)
- [x] `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts:66` — `json.tags?.sort()`
  sortiert das Array des importierten JSON-Moduls in place; schon in 4b9306c8 so (`:61`) ·
  aus Paket 7, Zug 2 (Implementierer) · info → Scope · geht in Paket 11 (Drain) · erledigt in 5ae2a583 (Reviewer bestätigt)
- [x] `apps/lookbook/src/pages/demos/textured-quads.astro:83` — `async function
  createMaterial` ohne `await` darin; schon in 4b9306c8 so (`:104`) · aus Paket 7, Zug 2
  (Implementierer) · info → Scope · geht in Paket 11 (Drain) · erledigt in 5ae2a583 (Reviewer bestätigt)
- [x] `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro:91` —
  `Object.assign(globalThis, {demo})` als Debug-Global neben `window.display` aus
  `PerspectiveOrbitDemo.ts:48`; schon in 4b9306c8 so (`:131`) · aus Paket 7, Zug 2
  (Implementierer) · info → Scope · geht in Paket 11 (Drain) · erledigt in 5ae2a583 (Reviewer bestätigt)
- [x] `apps/lookbook/README.md:9` — 91 Zeichen, über der Umbruchgrenze; schon in 4b9306c8
  so · aus Paket 7, Zug 2 (Implementierer) · info → Scope · Nähe Paket 8 (DOC-070 an
  `:65–66` derselben Datei) · geht in Paket 8 (Zug 0 Paket 8: gleiche Ursache wie DOC-070,
  der Absatz `:8–12` wird ohnehin neu umbrochen) · erledigt in d05f0422 (umbrochen auf 90,
  Probe 1 leer, Reviewer bestätigt)
- [x] `packages/twopoint5d/README.md:35` — Tippfehler »primtives« und doppelter Punkt
  »etc..« im Absatz zu `vertex-objects`; schon in 6861f3d0 so · aus Paket 8, Zug 0 · info →
  Scope (eigene Ursache: Rechtschreibung; Paket 8 bricht den Absatz nur um und lässt die
  Wörter stehen) · geht in Paket 12 (Drain) · erledigt in f1b770e7 (Reviewer bestätigt)
- [x] `packages/twopoint5d/CHANGELOG.md:188–190` — drei Einträge verweisen klein mit »see
  the migration guide«, die übrigen mit »See the Migration Guide«; schon in 4b9306c8 so ·
  aus Paket 7, Zug 2 (Implementierer) · info → Scope · Nähe Paket 9 (glättet den
  Unreleased-Block) · geht in Paket 9 (Zug 0 Paket 9: gleiche Ursache wie die Folge aus
  Paket 2 `:911–913` — die Einträge verweisen in uneinheitlicher Form auf den Migration Guide;
  es sind neun Stellen der kleinen Form, `:188–190`, `:249–250`, `:306–307`, `:310`, `:339`) · behoben in Paket 9 (f2772ec3)
- [x] `packages/twopoint5d/src/stage/StageRenderer.ts:286–289` — wirft `host.onResize()` oder
  `host.onRenderFrame()`, hat `set parent` den Host schon als `#parent` gesetzt, und der Fehler
  aus `#addToHost()` läuft ungesammelt heraus: die gesammelten Fehler der Abmeldungen und der
  `OnRemoveFromParent`-Listener desselben Aufrufs gehen verloren, `OnAddToParent` geht nie aus,
  `parent` antwortet den Host; über den Konstruktor (`:360–365`) bleibt das schon genommene
  Abonnement mit einem unerreichbaren Renderer am Host. `Display` wirft dort nie
  (`Display.ts:2046–2048`), nur ein eigener `IStageRendererHost`; schon in 5738b5e5~1 so
  (`:283`, Konstruktor `:347`) und in 0.21.2 (`#addToParent()`) · aus Paket 10, Zug 0 · low →
  Scope (eigene Ursache: der Fehlervertrag des Setters erfasst das Abonnieren nicht; die
  Buchung aus Paket 10 hält unter Rückbau wie unter Sammeln) · geht in Paket 12 (Drain) · erledigt in f1b770e7 (Reviewer bestätigt)

- [x] `packages/twopoint5d/README.md:44` und `:50` — der Absatz zu `vertex-objects` spricht
  von »own vertex and fragment shaders« und »low-level three.js/WebGL details«, während die
  Library ihre Materialien als `NodeMaterial` mit TSL baut und über den `WebGPURenderer`
  zeichnet; schon in 6861f3d0 so (`:39`, `:41`) · aus Paket 8, Zug 2/3 (Implementierer und
  Reviewer) · low → Scope · geht in Paket 12 (Drain) · erledigt in f1b770e7 (Reviewer bestätigt)
- [x] `AGENTS.md:16`, `AGENTS.md:107` und `docs/architecture.md:15` — das Browser-Testpaket
  heißt dort »browser/WebGL integration tests« bzw. »visual/WebGL«, die Browser-Tests laufen
  aber je nach Browser unter WebGPU oder WebGL 2 (`docs/architecture.md:171`); schon in
  6861f3d0 so · aus Paket 8, Zug 2 (Implementierer) · info → Scope · geht in Paket 12 (Drain) · erledigt in f1b770e7 (Reviewer bestätigt)
- [x] `docs/architecture.md:52–55` — der Absatz »Per-project `inputs` …« endet `:54` nach
  57 Zeichen (»… which is also why `pnpm build`«) vor einer vollen Zeile, ausgefranst
  umbrochen; schon in 6861f3d0 so · aus Paket 8, Zug 2 (Implementierer) · info → Scope · geht in Paket 12 (Drain) · erledigt in f1b770e7 (Reviewer bestätigt)
- [x] `packages/twopoint5d/src/stage/README.md:556ff` — Prosa-Listenpunkte über 90 Zeichen
  (`:556`, `:566`, `:571`, `:580`, `:642`, `:646`, `:660` u. a.; außerhalb des in Paket 8
  umbrochenen `dispose()`-Punkts); schon in 6861f3d0 so · aus Paket 8, Zug 2
  (Implementierer) · info → Scope · geht in Paket 12 (Drain) · erledigt in f1b770e7 (Reviewer bestätigt)

## Pakete

### [x] 1. TypeScript 6, tsconfig und Paket-Manifest
- Findings: DOC-015 (medium), DEPS-004 (low), DEPS-009 (low), CFG-023 (low), CFG-024 (low), DEPS-008 (low), DEPS-007 (low), CONS-057 (info)
- Ziel: Toolchain auf TypeScript 6 und aktuelle Patch-/Minor-Stände, die tsconfig TS-7-fest, die ausgelieferten `.d.ts` mit TSDoc und das Manifest samt Peers und attw-Profil ehrlich.
- Detail: docs/remediation/paket-1.md
- Bereich: `package.json`, `tsconfig*.json`, `pnpm-workspace.yaml`, `packages/twopoint5d/package.json`, `scripts/lintPkg`/`checkPkgTypes`-Anbindung, `AGENTS.md` §Shared dependency versions, `docs/architecture.md` §5
- Hängt ab von: —
- Hash: 5738b5e5
- Ergebnis: 1 Runde · alle acht Findings behoben (Reviewer-Urteil je Finding in der
  Paketdatei) · Regressionstest »refuses a package whose code imports a package outside
  its peer dependencies: exit code 1, message names file and specifier« in
  `scripts/checkPeerDependenciesOnly/checkPeerDependenciesOnly.test.mjs` (vor dem Gate rot,
  actual 0 / expected 1) · Runde 1: Editor-Config der Library bekam `types: ["node"]`,
  `#`-Subpath-Imports bleiben im Gate still · klein: zwei Kommentarumbrüche (siehe Folgen)
- Nebenbefunde: → Queue
- Folgen: `packages/twopoint5d/README.md:60` — nennt als Peers nur three.js und
  `@spearwolf/eventize`, der optionale Peer `@types/three` fehlt (Paket 8 hängt dafür schon
  an 1) · `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs:17` — TSDoc-Zeile
  134 Zeichen, Absatz `:14–22` neu umbrechen · `packages/twopoint5d/tsconfig.build.json:6–7`
  — Kommentarzeilen 92/93 Zeichen · → verteilt in Paket 2, Zug 0: README an Paket 8, die
  beiden Umbrüche an Paket 2
- Schnittstellen: `@types/three` optionaler Peer der Library (`catalog:` →
  `~0.185.4`, `peerDependenciesMeta.optional`) · Root-`tsconfig.json`: `types: []`,
  `importHelpers: false`, `removeComments: false`, ohne `baseUrl` und
  `downlevelIteration` · `packages/twopoint5d/tsconfig.json` (Editor, erbt
  `tsconfig.typecheck.json`) mit `types: ["node"]`, `tsconfig.build.json` mit
  `types: []` · `apps/lookbook/tsconfig.json` ohne `baseUrl`, `paths` mit `./` · `tslib`
  aus den Root-devDependencies entfernt · TypeScript `^6.0.3` (Root und Lookbook),
  `typescript-eslint` `^8.71.0`, `vitest` `^5.0.2`, `nx` `23.2.1` · `checkPkgTypes` =
  `pnpm exec attw --pack dist --profile esm-only` · neu
  `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs` mit
  `packageNameOf(specifier)` und `findUndeclaredImports(files, peerDependencies)` →
  `[{file, specifier}]` (importiert `typescript`; relative und `#`-Specifier bleiben
  still; Paket 2 bekommt die Datei in seinen `checkJs`-Typecheck) ·
  `checkPeerDependenciesOnly.mjs <dir>` prüft jetzt auch alle `.js`/`.mjs`/`.d.ts` unter
  `<dir>` (ohne `node_modules`) gegen die Peers, Exit 1 bei Treffer

### [x] 2. Lint- und Typecheck-Gates schärfen
- Findings: TYPE-003 (low), TYPE-022 (low), CFG-001 (low), TYPE-001 (low), TYPE-021 (low)
- Dazu aus Paket 1 (Folgen): Umbruch `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs:14–22`, `packages/twopoint5d/tsconfig.build.json:6–7`
- Ziel: ESLint hält `any` im veröffentlichten Library-Code und unbehandelte Promises in `packages/*/src` an und sagt neben der Regel, warum `!` erlaubt bleibt; `scripts/` läuft als eigenes Nx-Projekt durch einen `checkJs`-Typecheck; die öffentlichen Typen von `Dependencies` und die Signatur von `readOption` tragen kein `any` mehr.
- Detail: docs/remediation/paket-2.md
- Bereich: `eslint.config.mjs`, `packages/twopoint5d/src/utils/Dependencies.ts`, `packages/twopoint5d/src/controls/readOption.ts`, `TextureResource.ts:938`, `VertexObjects.ts:22`, neu `scripts/tsconfig.json` und `scripts/project.json`, 18 Dateien unter `scripts/` (Typfehler), `AGENTS.md`, `docs/architecture.md`, CHANGELOG
- Hängt ab von: 1 (typbasiertes Lint und checkJs laufen gegen die TS-6-Toolchain)
- Hash: 576d3fc6
- Ergebnis: 1 Runde · alle fünf Findings und beide Umbrüche aus Paket 1 behoben
  (Reviewer-Urteil je Finding in der Paketdatei) · Regressionstests: drei
  `@ts-expect-error` in `Dependencies.spec.ts` »a declaration that spells out its key is
  held against the shape, its callbacks against the value of its key« (vor dem Fix rot,
  TS2578) · `readOption.spec.ts` »the default answers for a value of null« (vor dem Fix
  rot, expected null to be 100) · `tsc -p scripts/tsconfig.json` vor den Fixes 55 Fehler ·
  Runde 1: Umbrüche in AGENTS.md, docs/architecture.md §6 neu gegliedert, JSDoc-Casts
  geglättet · klein: siehe Paketdatei
- Nebenbefunde: → Queue
- Folgen: `docs/architecture.md:318–319` — neu gegliederter Absatz in §6 bricht »as« /
  »well:« ausgefranst um, und »leaves them out« bezieht die drei aufgelisteten Specs nur
  über »as well« ein (Zusatz »in the same run«) · `scripts/checkDocSnippets/extractSnippets.mjs`
  — `@typedef`-Kommentar 108 Zeichen, mehrzeilig schreiben · `packages/twopoint5d/CHANGELOG.md:911–913`
  — der Migration Guide verweist mit »see the next section« auf den `Dependencies`-H4 und
  hängt so an der Reihenfolge (Paket 9 glättet den Block) · → verteilt in Paket 3, Zug 0:
  §6-Absatz an Paket 3, `extractSnippets.mjs:29` an Paket 4, CHANGELOG `:911–913` an Paket 9
- Schnittstellen: `readOption<O, K>(options: O | null | undefined, propName: K,
  defValue: NonNullable<O[K]>): NonNullable<O[K]>` — `null` nimmt den Default ·
  `DependencyCallbacks<T = unknown>` mit Methoden `equals`/`clone?`/`copy?`,
  `EqualityCallback<T = unknown>`, `CloneCallback<T>`, `CopyCallback<T>` davon abgeleitet ·
  `DependencyDeclaration<Shape>` hält Callbacks gegen `Shape[K]`, Paare mit vollständigen
  Callbacks und beliebigem Namen bleiben erlaubt · `Dependencies<Shape = Record<string,
  unknown>>` · ESLint: `no-explicit-any: error` für `packages/*/src/**/*.ts` ohne
  `*.spec.ts`, `*.bench.ts`, `src/testing/**`; `no-floating-promises` und
  `no-misused-promises` mit `projectService` für `packages/*/src/**/*.ts` (Specs
  eingeschlossen) · neues Nx-Projekt `scripts` (`scripts/project.json`, Tag `scripts`)
  mit Target `typecheck` = `pnpm exec tsc -p scripts/tsconfig.json` (`checkJs`,
  `noImplicitAny: false`, `types: ["node"]`, `include: **/*.mjs`) — jedes neue oder
  geänderte `.mjs` unter `scripts/` muss dort grün sein

### [x] 3. CI- und Deploy-Workflows, Nx-Cache-Server
- Findings: TEST-043 (medium), SEC-003 (medium), CFG-025 (low), SEC-001 (low), DOC-073 (low), DOC-062 (info)
- Dazu aus Paket 2 (Folgen): `docs/architecture.md:316–319` — §6-Absatz neu umbrechen, »leaves them out« eindeutig · aus der Queue: `AGENTS.md:50` »whether« (= AGENTS.md-Hälfte von DOC-070), fällt mit dem Absatz `:45–52`, den dieses Paket ohnehin neu schreibt
- Ziel: CI prüft auch reine Markdown-Pushes, der Bench-Schritt läuft nach dem Cache-Speichern, Deploy trennt Build und Publish nach Rechten und taggt nach dem Publish, der Cache-Server vergleicht Tokens zeitkonstant und nennt Argumentfehler.
- Detail: docs/remediation/paket-3.md
- Bereich: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `scripts/ci/nxCacheServer*`, neu `scripts/publishNpmPkg/builtinImportsOnly.test.mjs`, `docs/architecture.md` §3/§4/§6, `AGENTS.md`
- Hängt ab von: 2 (bringt `scripts/ci/` unter den `checkJs`-Typecheck und fasst dort neun Stellen an, sieben in den Modulen und zwei im Spec; nachgetragen in Zug 0 Paket 2)
- Hash: 5a413417
- Ergebnis: 1 Runde · alle sechs Findings, die §6-Folge aus Paket 2 und der Queue-Eintrag
  `AGENTS.md:50` behoben (Reviewer-Urteil je Finding in der Paketdatei) · Regressionstests:
  `nxCacheServer.test.mjs` »names an option it does not know, then prints the usage line:
  exit code 1« (vor dem Fix rot, stderr nur die Usage-Zeile) · `createCacheServer.test.mjs`
  »the token is compared in constant time, as two digests of one length, whatever the client
  sends« (vor dem Fix rot, callCount 0 !== 3) · Guard `builtinImportsOnly.test.mjs` mit
  Probe-Imports `semver` und `../checkPeerDependenciesOnly/…` je rot · Runde 1:
  `npm_config_ignore_scripts: 'true'` am Publish-Schritt (Abweichung vom wörtlichen
  `deploy.yml` des Detailplans, Grund in der Paketdatei), Guard löst relative Specifier auf ·
  klein: zwei Kommentarzeilen über 90 (unter Folgen)
- Nebenbefunde: → Queue (Kommentarlängen `ci.yml`, `concurrency` im Deploy, Portbereich
  des Cache-Servers)
- Folgen: `docs/architecture.md:143` — Zeile mit 91 Zeichen aus dem Umbruch in Runde 1 ·
  `.github/workflows/ci.yml:113` — verschobener Timing-Kommentar mit 96 Zeichen (steht als
  `+`-Zeile im Diff; Nähe zum Queue-Eintrag `ci.yml:11`) · → verteilt in Paket 4, Zug 0:
  `architecture.md:143` an Paket 4; `ci.yml:113` ist vorbestehend (576d3fc6 `ci.yml:95`,
  von Paket 3 nur verschoben), gehört zum Queue-Eintrag `ci.yml:11` und geht mit ihm an
  Paket 4
- Schnittstellen: `deploy.yml`: Jobs `version` (Outputs `publish`, `version`) → `build`
  (nur `contents: read`, `pnpm install --frozen-lockfile --filter twopoint5d-workspace
  --filter @spearwolf/twopoint5d`, Build und die drei Checks, Artifact `package` =
  `packages/twopoint5d/dist`) → `publish` (`id-token: write`, keine Installation,
  `npm_config_ignore_scripts: 'true'`, `node ../../scripts/publishNpmPkg.mjs dist` in
  `packages/twopoint5d`) → `tag` (`contents: write`, `v<version>` auf `head_sha` über die
  REST-API) · `scripts/publishNpmPkg.mjs` und `scripts/publishNpmPkg/*.mjs` (ohne Tests)
  importieren nur `node:`-Built-ins und relativ nur einander; `builtinImportsOnly.test.mjs`
  hält das — Paket 4 ändert `publishedVersions.mjs` und muss darin bleiben · `ci.yml` ohne
  Pfadfilter (`on: push`), Bench nach »Save the Nx cache«, jeder Checkout beider Workflows
  mit `persist-credentials: false` · `nxCacheServer.mjs` gibt bei einem `parseArgs`-Fehler
  dessen Meldung und die Usage aus, Exit 1 · neu `scripts/ci/nxCacheServer/nxCacheServer.test.mjs`
  (Kindprozess-Spec) · `docs/architecture.md` §6 zählt jetzt vier zusätzliche Specs und
  »Three specs start a script itself«

### [x] 4. Gate- und Publish-Skripte
- Findings: TEST-002 (medium), TEST-044 (medium), CFG-002 (low), CFG-021 (low), TEST-037 (info), READ-016 (info), DOC-058 (info), DOC-054 (info), DOC-055 (info), DOC-056 (info), DOC-057 (info), READ-018 (info)
- Ziel: `checkNameableTypes` ist getestet, erkennt `import("…").T` und liest die gemeinsame tsconfig; `checkDocSnippets` und `resolveDependencies` melden ihre Randfälle richtig und sind sauber kommentiert und getestet.
- Detail: docs/remediation/paket-4.md
- Bereich: `scripts/checkNameableTypes*`, neu `scripts/shared/`, `scripts/checkDocSnippets*`, `scripts/makePackageJson*`, `scripts/publishNpmPkg/publishedVersions.mjs`, Kommentar-Umbrüche in 22 Dateien unter `scripts/` und in `.github/workflows/ci.yml`, `packages/twopoint5d-testing/project.json`, `docs/architecture.md` §3–§6, `AGENTS.md` (Bullet `test:scripts`)
- Dazu (Folge aus Paket 2, verteilt in Zug 0 Paket 3): `scripts/checkDocSnippets/extractSnippets.mjs:29` — `@typedef {…} OpenFence` 108 Zeichen, mehrzeilig schreiben
- Dazu (Folge aus Paket 3, verteilt in Zug 0 Paket 4): `docs/architecture.md:143` — 91 Zeichen · aus der Queue: `ci.yml:11` (Kommentarzeilen über 90, gleiche Ursache wie READ-018; schließt die »Folge« `ci.yml:113` aus Paket 3 ein, die vorbestehend ist)
- Dazu (Nebenbefunde aus Zug 0, gleiche Ursache): `findUnpublishableSpecifiers.mjs:11` und `resolveDependencies.mjs:117` werfen wie DOC-054 auf einem Wert, der kein String ist; 65 Kommentarzeilen über 90 unter `scripts/` und vier Prosazeilen über 90 in `docs/architecture.md` wie READ-018
- Hängt ab von: 2 (checkJs-Typecheck der Skripte)
- Hash: c301a1e5
- Ergebnis: 0 Runden · alle zwölf Findings, die beiden Folgen und die Nebenbefunde aus
  Zug 0 behoben (Reviewer-Urteil je Finding in der Paketdatei) · Regressionstests:
  `compileSnippets.test.mjs` »an unreadable tsconfig throws even when no block is marked«
  (vor dem Fix rot, Missing expected exception) · `findUnnameableTypes.test.mjs` »an import
  type is judged by the name it imports« (vor dem Zweig rot, actual []) ·
  `resolveDependencies.test.mjs` »a dependency whose value is not a string stays as it is«
  und »a * dependency whose shared version is not a string stays *«,
  `findUnpublishableSpecifiers.test.mjs` »names a value that is not a string«,
  `makePackageJson.test.mjs` »refuses a dependency whose value is not a string: exit code
  1, …« (alle vier vor dem Fix rot, TypeError bzw. Stacktrace) · Mutationsprobe für
  `extractSnippets.test.mjs` »a line whose info string holds a backtick opens no fence …«
  rot bei entfernter Regel · Gate druckt weiter 317/1/0 · klein: vier (Paketdatei)
- Nebenbefunde: keine neuen (die Zeilen über 90 in `AGENTS.md` gehören zu Paket 8)
- Folgen: `docs/architecture.md:376–377` — §6-Absatz ausgefranst umbrochen (Zeile 376 mit
  70 Zeichen) · `docs/architecture.md:69` — »a marked block can sit in any of them« bezieht
  sich nach dem Einschub zum tsconfig-Leser nicht mehr eindeutig auf die Markdown-Dateien
  (beide klein, aus dem Review; Nähe zu Paket 8) · → verteilt in Paket 5, Zug 0: beide an
  Paket 8 (Symptome von Paket 4; Paket 8 trägt dieselbe Ursache im Ziel und die Datei im
  Bereich, statt eines Nachtragspakets von zwei Zeilen)
- Schnittstellen: neu `scripts/shared/readCompilerOptions.mjs`:
  `readCompilerOptions(tsconfigPath)` → `CompilerOptions` der Datei selbst (ohne
  `extends`), wirft mit Pfad und Grund; Input von `twopoint5d-testing:typecheck` · neu
  `scripts/checkNameableTypes/findUnnameableTypes.mjs`: `findUnnameableTypes({entry,
  compilerOptions})` → `{exported, rows}`, `partitionAccepted(rows, accepted)`;
  `checkNameableTypes.mjs` liest die Root-tsconfig, Exit 0/1/2, verfolgt `import("…").T` ·
  `findUnpublishableSpecifiers` meldet auch Werte, die kein String sind; die Meldung von
  `makePackageJson.mjs` schreibt den Wert über `JSON.stringify` · Kommentare unter
  `scripts/`, in `ci.yml` und die Prosa von `docs/architecture.md` bei ≤ 90 Zeichen, in
  Zeichen gezählt (`perl -CSD`, macOS-awk zählt Bytes) — gilt für jede spätere Änderung dort

### [x] 5. PanControl2D: Lebenszyklus, Hot Path und Tests
- Findings: PERF-018 (low), PERF-031 (low), TEST-004 (low), TEST-046 (low), API-065 (info), DOC-032 (info), DOC-078 (info), TEST-051 (info), DOC-069 (info), READ-021 (info)
- Ziel: `PanControl2D` ist nach `dispose()` still, alloziert im Pointer- und Update-Pfad nichts, und seine Unit- und Browser-Tests decken Touch, mehrere Pointer, Shadow-Root und Stylesheet-Root trennscharf ab.
- Detail: docs/remediation/paket-5.md
- Bereich: `packages/twopoint5d/src/controls/` (neu `hot-path-allocations.spec.ts`), `packages/twopoint5d/src/events.ts` (TSDoc), `packages/twopoint5d-testing/test/pan-control-*.test.js` und `helpers/fixtures.js` (`pointer()` mit `isPrimary`, `key()` mit `target`), CHANGELOG
- Hängt ab von: —
- Hash: c5037879
- Ergebnis: 2 Runden · alle zehn Findings behoben (Reviewer-Urteil je Finding in der
  Paketdatei) · Regressionstests, alle vor dem Fix rot: `PanControl2D.spec.ts` »update() on
  a disposed control leaves the view where it is and emits nothing« (x 11 statt 1),
  »onUpdate(), onHideCursor() and onRestoreCursor() subscribe nothing on a disposed
  control« (3 Aufrufe), »measures the rectangle of its coordsTarget once per drag, when
  the pointer goes down« (5 statt 1) · `controls/hot-path-allocations.spec.ts` »update()
  with a mouse and a touch down …« (224 B) und »a pointermove of a mouse with no button
  down …« (128 B) · Browser: »a drag keeps the rectangle of its pointerdown when the
  coordsTarget moves under it«, »update() moves the view no further, not even by a speed
  set by hand« · Mutationsproben Shadow Root, Stylesheet-Root und liegengebliebene
  Pointer-Listener nach `dispose()` rot · in Runde 1–2 drei Dispose-Tests, die über
  `update()` belegten, auf die Cursor-Klasse umgebaut, einer gestrichen · klein: keine
  offenen
- Nebenbefunde: → Queue (`pan-control-dispose.test.js:93`)
- Folgen: keine
- Schnittstellen: `PanControl2D#update()` ist nach `dispose()` ein No-op · `onUpdate()`,
  `onHideCursor()`, `onRestoreCursor()` hängen nach `dispose()` nichts an und geben eine
  leere Funktion zurück · das Rechteck von `coordsTarget` wird je Pointer beim
  `pointerdown` gemessen und gilt bis zu dessen Ende · Browser-Fixtures:
  `pointer(type, {…, isPrimary = true, target})`, `key(type, init, target = document)`
  dispatcht `bubbles` und `composed` · CHANGELOG `[Unreleased]`: Added-Einträge zu
  `coordsTarget` und den `on…()`-Helfern angepasst, perf-Eintrag unter Changed,
  Fixed-Ergänzungen zu `dispose()` und `unsubscribe()`, H4 »A disposed `PanControl2D`
  moves its view no further« (Paket 9 glättet)

### [x] 6. Stage und Display: TSDoc und Umzugs-Tests
- Findings: DOC-079 (info), DOC-080 (info), TEST-052 (info), TEST-053 (info)
- Ziel: Die TSDoc von `Display` und `StageRenderer#add()` steht an der richtigen Stelle und sagt den abgebrochenen Umzug vollständig, die Umzugs-Tests prüfen Abmeldung, Fehlerweitergabe und jeden Abbruchgrund, und ein Renderer, den ein Listener beim Umzug disposed, hängt an keinem Host mehr.
- Detail: docs/remediation/paket-6.md
- Bereich: `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/src/stage/StageRenderer.ts`, `StageRenderer.spec.ts`, `packages/twopoint5d/CHANGELOG.md` (Fixed-Eintrag `:345`)
- Dazu (Nebenbefunde aus Zug 0, gleiche Ursache, beide vorbestehend seit 51e8b330): `StageRenderer.ts:324–339` — ein Renderer, den ein vor den Host-Abonnements registrierter Listener von `OnRemoveFromParent` beim Umzug disposed, bleibt am alten Host abonniert (das `off(this)` in `dispose()` überspringt die `once()`-Abmeldungen; gegen `dist/` geprobt: 0 statt 2 Abmeldungen) · low, gleiche Ursache wie TEST-052 · `StageRenderer.spec.ts` — der Abbruchgrund »ein Listener gibt dem Renderer einen anderen Halter« ist für `add()` (`StageRenderer.ts:1188`) und `parent` (`:280`) ungetestet · info, gleiche Ursache wie TEST-053
- Hängt ab von: —
- Begründung für unter fünf Findings: eigene Domäne; mit Paket 5 zusammen sprengte der Diff die Reviewbarkeit (14 Findings über zwei Subsysteme)
- Hash: 4b9306c8
- Ergebnis: 0 Runden · alle vier Findings und die Nebenbefunde A und B behoben
  (Reviewer-Urteil je Finding in der Paketdatei) · Regressionstests, beide vor dem Fix rot
  (`_unsubs` 0 statt 2): `StageRenderer.spec.ts` »add() takes a child off its host when a
  listener registered ahead of the host subscriptions disposes it« und »a write to parent
  takes a renderer off its host when a listener registered ahead of the host subscriptions
  disposes it« · Mutationsproben zu TEST-052, TEST-053 und Nebenbefund B je rot · klein:
  drei (Paketdatei), zwei davon unter Folgen
- Nebenbefunde: keine
- Folgen: `packages/twopoint5d/src/stage/StageRenderer.ts:344–351` — `#addToHost()` legt
  beide Handles in einem `push()` ab; wirft `host.onRenderFrame()`, geht der schon
  genommene Handle von `onResize()` verloren (zwei getrennte `push()`) ·
  `StageRenderer.ts:321–323` — der `catch` um eine werfende Host-Abmeldung in
  `#removeFromParent()` ist ungetestet (`makeHost()` mit werfendem Unsubscribe) · beide
  klein, aus dem Review · → verteilt in Paket 7, Zug 0: beide an das Nachtragspaket 10
  (Symptome der Host-Buchführung aus 4b9306c8; kein offenes Paket teilt die Datei)
- Schnittstellen: `StageRenderer` meldet sich in `#removeFromParent()` vom Host ab, bevor
  `OnRemoveFromParent` ausgeht; die Host-Abonnements hängen nicht mehr als `once()`-Listener
  an diesem Event · CHANGELOG `[Unreleased]` Fixed-Eintrag zu `StageRenderer` (`:345`) um
  einen Satz zur Abmeldung vom Host verlängert (Paket 9 glättet)

### [x] 7. Lookbook: Einstieg, Suche, Demo-Boilerplate
- Findings: DOC-003 (medium), IMPL-004 (low), READ-013 (low), TYPE-019 (low), TYPE-020 (low), API-049 (low)
- Ziel: Die Lookbook bekommt eine »Your First Sprite«-Demo samt Erklärung der VertexObjectDescription, eine funktionierende Ctrl/Cmd+K-Suche, geteiltes Demo-Boilerplate mit einer einzigen Instanced-Quad-Definition und übernimmt `printSceneGraphToConsole` aus der Library-API.
- Detail: docs/remediation/paket-7.md
- Bereich: `apps/lookbook/src/`, `apps/lookbook/README.md`, `packages/twopoint5d/src/utils/`, neu `packages/twopoint5d/src/vertex-objects/README.md` (die Konzeptseite zu DOC-003), `AGENTS.md` (»Deeper docs«), CHANGELOG (Removed und Migration-Guide-H4 zu `printSceneGraphToConsole()`)
- Hängt ab von: —
- Hash: b8868b16
- Ergebnis: 0 Runden · alle sechs Findings behoben (Reviewer-Urteil je Finding in der
  Paketdatei) · kein Regressionstest (kein Finding ist ein Laufzeitfehler); Beleg ist die
  Rauchprobe im Browser, vorher 17 Seiten, `first-sprite` 404, Ctrl+K ohne Wirkung — nachher
  18 Seiten ohne Fehler, Canvas von `first-sprite` nicht einfarbig, erste Karte »your first
  sprite«, Ctrl+K fokussiert das Feld, `sprite` → Enter landet auf `first-sprite` ·
  Abweichung: `TexturePreview` ohne `overflow: hidden`, dafür `max-height: 100%` (sonst
  schnitte die Box ihre Beschriftung und den Hover-Glow ab; Reviewer trägt es) · klein: vier
  (Paketdatei)
- Nebenbefunde: → Queue (sechs Einträge aus dem Report des Implementierers)
- Folgen: keine — die Stellen für Paket 8 und 9 stehen dort schon unter »Aus Zug 0 Paket 7«
  bzw. »Hängt ab von«; jetzt `CHANGELOG.md:342` (Removed) und `:970` (H4), die
  DOC-070-Stelle in `apps/lookbook/README.md` jetzt `:65–66`
- Schnittstellen: `printSceneGraphToConsole` aus `@spearwolf/twopoint5d` entfernt (liegt in
  `apps/lookbook/src/demos/utils/printSceneGraphToConsole.ts`), `findRootNode` bleibt ·
  Lookbook: `VanillaDemo.astro` Prop `fullscreenCanvas?: boolean` schreibt
  `<canvas id="canvas-container" resize-to="window">` und `body.fullscreen-canvas`, hält
  `.actionBtn` global · `~demos/utils/fullscreenCanvas`: `FULLSCREEN_CANVAS_ID`,
  `getFullscreenCanvas()` · `components/TexturePreview.astro` (`size?`, `title?`),
  `TEXTURE_PREVIEW_ID` aus `showTexturePreview.ts` · `IDemo.order?: number` (aufsteigend,
  Vorgabe 0) · `components/searchDemos.ts`: `searchDemos(demos, query)` ·
  `LookbookMetadata.astro` ohne `data-lookbook-tags` · neue Demo
  `/demos/first-sprite` (18 Demos) · neue Konzeptseite
  `packages/twopoint5d/src/vertex-objects/README.md` mit einem `ts check`-Block

### [x] 10. StageRenderer: jeden Host-Handle buchen, sobald er genommen ist
- Findings: — (Nachtragspaket aus den Folgen von Paket 6, geschnitten in Zug 0 Paket 7)
- Folge von: Paket 6
- Ziel: `StageRenderer#addToHost()` bucht jeden Host-Handle einzeln, so dass ein werfendes `host.onRenderFrame()` den schon genommenen `onResize()`-Handle nicht verliert, und die Abmeldeschleife in `#removeFromParent()` ist samt ihrem `catch` getestet.
- Detail: docs/remediation/paket-10.md
- Fundstellen: `packages/twopoint5d/src/stage/StageRenderer.ts:344–351` — `#addToHost()` legt beide Handles in einem `push()` ab; wirft `host.onRenderFrame()`, ist `onResize()` schon abonniert, sein Handle aber nie in `#hostSubscriptions`, und der Renderer bleibt nach dem nächsten Umzug am Resize des alten Hosts (vor 4b9306c8 registrierten zwei `once()`-Aufrufe den ersten Handle sofort) · `StageRenderer.ts:318–324` — der `catch` (`:321–323`) um eine werfende Abmeldung ist ungetestet: die übrigen Handles gehen trotzdem ab, `OnRemoveFromParent` geht trotzdem aus, der Fehler erreicht den Aufrufer; `makeHost()` in `StageRenderer.spec.ts:127` kennt noch keinen werfenden Host
- Dazu (Zug 0, Symptome derselben Ursache — der `catch` aus 4b9306c8 nicht zu Ende geführt): die Sammelmeldungen von `add()`, `parent` und `dispose()` nennen eine werfende Host-Abmeldung nicht, die TSDoc dieser drei, die Stage-README (»Custom host«) und der CHANGELOG-Fixed-Eintrag `:346` sagen nichts über sie
- Bereich: `packages/twopoint5d/src/stage/StageRenderer.ts`, `StageRenderer.spec.ts`, `packages/twopoint5d/src/stage/README.md` (»Custom host«), `packages/twopoint5d/CHANGELOG.md` (ein Satz am Fixed-Eintrag `:346`). Geprüft in Zug 0: für die Buchung selbst kein Eintrag — 0.21.2 (62174770) band jeden Handle über ein eigenes `once()`, der Verlust bestand nur im `[Unreleased]`-Stand
- Hängt ab von: 6 (committet)
- Hash: 6861f3d0
- Ergebnis: 0 Runden · Fundstelle 1 und 2 samt Symptomen behoben (Reviewer-Urteil in der
  Paketdatei) · Regressionstest `StageRenderer.spec.ts` »a host whose onRenderFrame() throws
  gets its onResize() subscription back once the renderer moves on« (vor dem Fix rot:
  `_unsubs` 0 statt 1) · vier Tests der Abmeldeschleife (detach, parent, add, dispose),
  Mutationsprobe ohne `try`/`catch` je rot · klein: vier (Paketdatei)
- Nebenbefunde: keine
- Folgen: `packages/twopoint5d/src/stage/README.md:614ff` (»Resource lifecycle«,
  `dispose()`-Punkt) nennt als nach dem Teardown gemeldeten Fehler nur Listener, nicht eine
  werfende Host-Abmeldung · `StageRenderer.ts:1170–1175` — `add()`-TSDoc-Absatz nach dem
  Einschub ausgefranst umbrochen · beide klein, aus dem Review · → verteilt in Paket 8, Zug 0:
  beide an Paket 8, jetzt `README.md:628–636` und `StageRenderer.ts:1165–1178` (Doku-Zeilen um
  den Code von 6861f3d0, der steht; Paket 8 bringt die Library-Doku auf den Code-Stand und
  bricht um — wie die Doku-Folgen aus Paket 4 in Zug 0 Paket 5 —, kein Nachtragspaket, das
  als dritte Generation der Kette 6 → 10 nur zwei Doku-Zeilen trüge)
- Schnittstellen: Sammelmeldungen neu — `add()`: »… OnStageAdded and OnAddToParent or
  unsubscribe of the previous host threw«, `parent`: »… and OnAddToParent or unsubscribe of
  the previous host threw«, `dispose()`: »… and OnStageDispose or unsubscribe of the host
  threw« · `makeHost(failures?)` in `StageRenderer.spec.ts` mit `onRenderFrame`,
  `unsubscribeResize`, `unsubscribeFrame` · CHANGELOG Fixed-Eintrag `:346` um einen Satz zur
  werfenden Host-Abmeldung verlängert (Paket 9 glättet)

### [x] 8. Library- und Repo-Dokumentation
- Findings: DOC-025 (medium), IMPL-001 (low), DOC-060 (low), DOC-034 (low), DOC-067 (low), READ-025 (info), DOC-059 (info), DOC-070 (info), DOC-076 (info)
- Ziel: README zeigt Konsumenten die ersten fünf Minuten, Architektur-Doku und resource-lifecycle.md stimmen mit dem WebGPU/NodeMaterial-Code überein, und AGENTS.md sowie die Docs sind sauber umbrochen und eindeutig.
- Detail: docs/remediation/paket-8.md
- Bereich: `README.md`, `packages/twopoint5d/README.md`, `packages/twopoint5d/README-pkg.md`, `packages/twopoint5d/package.json` (nur `description`), `packages/twopoint5d/docs/`, `docs/architecture.md`, `AGENTS.md`, `apps/lookbook/README.md`, `packages/twopoint5d/src/stage/README.md` (ein Punkt), `packages/twopoint5d/src/stage/StageRenderer.ts` (ein TSDoc-Absatz) — kein Code, kein CHANGELOG
- Dazu (Folgen aus Paket 10, verteilt in Zug 0 Paket 8): `packages/twopoint5d/src/stage/README.md:628–636` (`dispose()`-Punkt nennt die werfende Host-Abmeldung nicht) · `StageRenderer.ts:1165–1178` (`add()`-TSDoc-Absatz ausgefranst)
- Dazu (Zug 0, gleiche Ursache): Queue `apps/lookbook/README.md:9` (wie DOC-070) · `packages/twopoint5d/package.json:3` `description` »with WebGL and three.js« (wie DOC-025) · alle Zeilen über 88 in Library-Architektur, `AGENTS.md`, Root- und Library-README (wie DOC-067/READ-025; die `AGENTS.md`-Zeilen hat Paket 4 hierher verwiesen)
- Hängt ab von: 1 (Peer-Liste samt optionalem `@types/three` und TS-Stand, die das README nennt), 7 (Link auf die Einstiegs-Demo)
- Dazu (verteilt in Zug 0 Paket 2): `packages/twopoint5d/README.md:60` — der Satz »depends on nothing but three.js and `@spearwolf/eventize`, both peer dependencies« nennt weder den Peer `@spearwolf/signalize` (Queue) noch den optionalen Peer `@types/three` (Folge aus Paket 1); die Peers aus `packages/twopoint5d/package.json` → `peerDependencies`/`peerDependenciesMeta` sind die Quelle
- DOC-070 (Zug 0 Paket 3): die AGENTS.md-Hälfte (»whether«, `AGENTS.md:50`) fiel mit Paket 3 (5a413417, Absatz `:45–52` neu geschrieben); hier bleibt `apps/lookbook/README.md:56`
- Aus Zug 0 Paket 7: Paket 7 legt die Einstiegs-Demo `apps/lookbook/src/pages/demos/first-sprite.astro` und die Konzeptseite `packages/twopoint5d/src/vertex-objects/README.md` an — die Ziele, auf die das README für die ersten fünf Minuten zeigt (DOC-025); der vorhandene Link `src/vertex-objects/` im Library-README trifft die Konzeptseite schon. Paket 7 schreibt außerdem `apps/lookbook/README.md` fort (Zählungen, »Adding a demo«) und ergänzt in `AGENTS.md` »Deeper docs« um einen Punkt; die DOC-070-Stelle »lookbook and« / »is part of« (heute `:55–56`) lässt es stehen, ihre Zeilennummer kann sich verschieben
- Dazu (Folgen aus Paket 4, verteilt in Zug 0 Paket 5): `docs/architecture.md:373–380` — der §6-Absatz »Four specs start a script itself …« ist ausgefranst umbrochen (`:376` mit 70 Zeichen), neu umbrechen · `docs/architecture.md:69` — »a marked block can sit in any of them« bezieht sich nach dem Einschub zum tsconfig-Leser (`:68–69`) nicht mehr eindeutig auf die Markdown-Dateien; den Bezug ausschreiben
- Hash: d05f0422
- Ergebnis: 1 Runde · alle neun Findings und alle Zusatzposten behoben (Reviewer-Urteil je
  Posten in der Paketdatei) · kein Regressionstest (reine Doku); Mutationsprobe am neuen
  `ts check`-Block im README rot (TS2551), danach 19 Blöcke in 4 Dateien, 0 errors · Runde 1
  korrigierte einen eigenen Satz im Schichtbild (»each of them takes its helpers« → »any of
  them may take«, `display/` und `sprites/` importieren nichts aus `utils/`)
- Nebenbefunde: → Queue (vier Einträge aus Paket 8)
- Folgen: keine
- Schnittstellen: `README.md` hat den Abschnitt `## Usage` (Anker `#usage`), auf den
  `packages/twopoint5d/README-pkg.md` (absolut, `https://github.com/spearwolf/twopoint5d#usage`)
  und `packages/twopoint5d/README.md` (relativ) verweisen; sein `ts check`-Block ist einer
  der 19 in 4 Dateien · Root- und Library-README, `README-pkg.md`,
  `packages/twopoint5d/docs/*.md` und `AGENTS.md` stehen bei ≤ 88 Zeichen (Tabellenzeilen,
  HTML-Kopf, Bildzeile und zwei untrennbare Links in `resource-lifecycle.md` `:68`, `:290`
  ausgenommen) — gilt für jede spätere Änderung dort · `description` im Library-Manifest:
  »Create 2.5D realtime graphics and pixelart with three.js and WebGPU«

### [x] 9. CHANGELOG
- Findings: DOC-061 (low), DOC-038 (low), DOC-039 (low), DOC-040 (info), DOC-071 (info), CONS-047 (info)
- Ziel: Der Unreleased-Block sagt, dass seine Ansammlung beabsichtigt ist, und seine Einträge zu Accessor-Paaren, `keys`/`keyCodes`, Pointer-Handling, `loadAsync()` und `dispose()` sind präzise und eindeutig.
- Detail: docs/remediation/paket-9.md
- Bereich: `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]`), die TSDoc hinter CONS-047 (`Stage2D.ts`, `dispose()`), ein Kommentar in `PanControl2D.ts` (`#speedFieldFor()`)
- Dazu (Folge aus Paket 2, verteilt in Zug 0 Paket 3): `packages/twopoint5d/CHANGELOG.md:911–913` — der Migration Guide verweist mit »see the next section« auf den `Dependencies`-H4 und hängt so an der Reihenfolge; auf den H4 beim Namen verweisen
- Dazu (aus der Queue, Zug 0 Paket 9): `CHANGELOG.md:188–190` »see the migration guide« klein — gleiche Ursache wie die Folge aus Paket 2; neun Stellen, einheitlich auf ». See the Migration Guide«
- Dazu (Zug 0, gleiche Ursache, vorbestehend): `CHANGELOG.md:182` — `VOBufferPool#buffer` ist die vierte Accessor-Stelle wie DOC-038 und widerspricht mit »reading and writing … is unchanged« `:242` (»read-only in the published types«) · `PanControl2D.ts:643` — Kommentar mit derselben ungenauen Vorrangregel wie DOC-039 (»Whoever sets keys as well gets keys«)
- »Glätten« in Zug 0 konkretisiert: Verweis auf den Migration Guide an den Einträgen dieses Laufs mit eigenem H4 (`@types/three` `:78`, `Dependencies` `:209`, `PanControl2D#dispose()` `:414`); der Fixed-Eintrag `:346` wird geteilt (Abmelden vom Host als eigener Bullet); der H4 zu `@types/three` rückt zu den Peer-H4. Einträge aus Paket 7 und die übrigen aus 1, 2, 5 geprüft, nichts zu tun
- Hängt ab von: 1, 2, 5, 6, 7, 10 (deren CHANGELOG-Einträge werden hier mitgeglättet; Paket 1 schreibt Einträge zu `@types/three` und den `.d.ts` samt einem Migration-Guide-H4, Paket 2 zu `Dependencies`, `PanControl2D` mit `null`-Option und einen Migration-Guide-H4; Paket 5 ändert die Added-Einträge zu `coordsTarget` und den `on…()`-Helfern und den Fixed-Eintrag zu `PanControl2D#dispose()`, schreibt einen perf-Eintrag unter Changed und den H4 »A disposed `PanControl2D` moves its view no further«; Paket 6 verlängert den Fixed-Eintrag zu `StageRenderer` und Listenern, die werfen (`:345`), um einen Satz zur Abmeldung vom Host — nachgetragen in Zug 0 Paket 6; Paket 7 schreibt unter Removed einen Eintrag zu `printSceneGraphToConsole()` und im Migration Guide den H4 »`printSceneGraphToConsole()` is gone« — nachgetragen in Zug 0 Paket 7. Das Nachtragspaket 10 läuft vor diesem Paket und hängt an den Fixed-Eintrag zu `StageRenderer` (`:346`) einen Satz zur Host-Abmeldung, die wirft — nachgetragen in Zug 0 Paket 10)
- Hash: f2772ec3
- Ergebnis: 0 Runden · DOC-061, DOC-038, DOC-039, DOC-040, DOC-071, CONS-047 behoben, dazu
  die Folge aus Paket 2 (Verweis per H4-Name), die neun Migration-Guide-Verweise (39 in einer
  Form), `VOBufferPool#buffer`, der geteilte Fixed-Eintrag und der verschobene `@types/three`-H4
  · reines Doku-Paket, kein Regressionstest · klein: Kopfsatz »walks a project through all of
  them« überzieht leicht
- Nebenbefunde: keine
- Folgen: keine

### [x] 11. Lookbook-Nachlese: rainbow-line 2, Metadaten und Demo-Reste
- Nebenbefund: `apps/lookbook/package.json:18` (low, rainbow-line-Major samt vendortem Skript und Prüfung), `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts:63` (low, versteckte Tags in `relatedTags`), `loadMetadataForDemos.ts:66` (info, Sortieren in place), `apps/lookbook/src/components/DemoNavBar.astro:111–155` (info, tote Regeln), `animated-billboards.astro:80`/`animated-sprites.astro:98` (info, Kommentar zu nicht existierender API), `textured-quads.astro:83` (info, `async` ohne `await`), `textured-quads-from-tileset.astro:91` (info, Debug-Global) — Drain aus der Befund-Queue
- Ziel: Die Lookbook steht auf `@spearwolf/astro-rainbow-line` 2.x mit passendem vendortem Skript, und ihre Metadaten, Komponenten und Demo-Seiten tragen keine toten Regeln, irreführenden Kommentare oder Seiteneffekte mehr.
- Detail: docs/remediation/paket-11.md
- Dazu (Zug 0, gleiche Ursache wie `textured-quads.astro:83`, vorbestehend seit c82f42f7): `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro:35` — `async function makeMesh` ohne `await` (info)
- Bereich: `apps/lookbook/` (`package.json`, `public/js/`, `src/`), `pnpm-lock.yaml`, `AGENTS.md` (`:86`, `:88`, Skriptname v0.4.0 → v0.6.0) — `scripts/lookbook/rainbowLineScript.test.mjs` greift ohne Änderung (in Zug 0 gegen den Tarball 2.1.0 geprüft), kein CHANGELOG
- Hängt ab von: —
- Hash: 5ae2a583
- Ergebnis: 0 Runden · alle acht Einträge behoben (Reviewer: alle erfüllt, nichts kritisch/wichtig) · kein Regressionstest als Datei; rote Proben gegen den Build: verwandte versteckte Tags 52 → 0, je zwei Skript-Tags v0.4.0 → einer v0.6.0, tote Regeln 36+18+18 → 0, `pnpm test:scripts` rot (»rainbow-line-v0.6.0.js is missing«) vor dem Kopieren · Rauchprobe 19 Seiten ohne Fehler
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: vendortes Skript heißt `apps/lookbook/public/js/rainbow-line-v0.6.0.js` (`@spearwolf/astro-rainbow-line` ^2.1.0)

### [x] 12. Nachlese: StageRenderer-Host-Fehler, Doku, Deploy und Cache-Server
- Nebenbefund: `packages/twopoint5d/src/stage/StageRenderer.ts:286–289` (low, werfendes Host-Abonnieren in `set parent` und Konstruktor), `packages/twopoint5d/README.md:44`/`:50` (low, Shader-/WebGL-Sprache), `packages/twopoint5d/README.md:35` (info, Tippfehler), `AGENTS.md:16`/`:107`/`docs/architecture.md:15` (info, »WebGL«-Testpaket), `docs/architecture.md:52–55` (info, Umbruch), `packages/twopoint5d/src/stage/README.md:556ff` (info, überlange Zeilen), `packages/twopoint5d-testing/test/pan-control-dispose.test.js:93` (info, Kommentar), `.github/workflows/deploy.yml:12–14` (low, verdrängter Deploy-Lauf), `scripts/ci/nxCacheServer.mjs:22` (info, Portbereich) — Drain aus der Befund-Queue
- Ziel: `StageRenderer` sammelt einen Fehler beim Abonnieren des Hosts nach demselben Vertrag wie die übrigen Fehler eines Umzugs, die verbleibenden Doku- und Kommentarstellen stimmen und sind umbrochen, der Deploy verliert keine Version und der Cache-Server weist ungültige Ports mit der Usage ab.
- Detail: docs/remediation/paket-12.md
- Dazu (Zug 0, gleiche Ursache wie `README.md:35`, vorbestehend seit 6861f3d0): `packages/twopoint5d/README.md:55` — Zeile aus zwei Leerzeichen im `vertex-objects`-Abschnitt (info)
- Weg (Zug 0): ein Host, der beim Abonnieren wirft, bekommt zurück, was er schon herausgab, und hält den Renderer nicht — `parent` antwortet `undefined`, kein `OnAddToParent`, der Fehler folgt denen des Auszugs; nur so wirft auch der Konstruktor, ohne ein Abonnement am Host zu lassen. Deploy über `queue: max` der Concurrency-Gruppe (GitHub seit 2026-05-07). Stage-README bei ≤ 88 wie die übrigen Library-Docs
- Bereich: `packages/twopoint5d/src/stage/` (`StageRenderer.ts`, `StageRenderer.spec.ts`, `README.md`), `packages/twopoint5d/README.md`, `AGENTS.md`, `docs/architecture.md` (`:15`, `:52–55`, §4), `packages/twopoint5d-testing/test/pan-control-dispose.test.js`, `.github/workflows/deploy.yml`, `scripts/ci/nxCacheServer.mjs` samt Spec, CHANGELOG (ein Fixed-Bullet)
- Hängt ab von: —
- Hash: f1b770e7
- Ergebnis: 0 Runden · alle neun Queue-Einträge und `README.md:55` behoben (Reviewer-Urteil
  je Posten in der Paketdatei) · Regressionstests vor dem Fix rot: in `StageRenderer.spec.ts`
  »a host whose onRenderFrame() throws gets its onResize() subscription back at once, and the
  renderer joins no holder«, »new StageRenderer(host) throws the error of a host whose
  onRenderFrame() throws, and the host keeps no subscription of it«, »a host whose onResize()
  throws takes nothing: …«, »a write to parent that meets a host whose onRenderFrame() throws
  hands its error on after those of the move out, …«, »an unsubscribe that throws while the
  renderer gives back what a refusing host handed out joins the error of the host«; in
  `nxCacheServer.test.mjs` »prints the usage line alone for a port that is no whole number
  from 0 to 65535, and creates no --dir: exit code 1« · klein: Kommentarzeile
  `StageRenderer.spec.ts:128` mit 93 Zeichen, drei Formulierungs-/Umbruchhinweise (Paketdatei)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `StageRenderer#parent`-Sammelmeldung neu: »StageRenderer#parent: more than
  one listener of OnRemoveFromParent, OnStageRemoved and OnAddToParent or subscribe or
  unsubscribe at a host threw« · ein Host, der beim Abonnieren wirft, hält den Renderer nicht
  (`parent` `undefined`, kein `OnAddToParent`) · `makeHost(failures?)` kennt zusätzlich
  `onResize` · `deploy.yml` Concurrency mit `queue: max` · `nxCacheServer.mjs` lehnt Ports
  außerhalb 0–65535 und Nicht-Ziffern mit der Usage-Zeile ab

### [x] 13. Folgen-Nachlese: First-Sprite-Demo, Suche, Stage-Kommentare
- Nebenbefund: offene kleine Reviewer-Befunde auf die Diffs dieses Laufs (Folgen, keine Runde ausgelöst): `apps/lookbook/src/pages/demos/first-sprite.astro:69` (low, `display.start()`-Promise weder abgewartet noch abgefangen), `first-sprite.astro:58–62` (low, `display.onDispose()` nach zwei `await` — ein `dispose()` während des Ladens lässt Store und Mesh liegen), `first-sprite.astro:21–23` (info, Kommentar rechnet nur die Höhe, Hochkant beschneidet), `apps/lookbook/src/components/SearchLookbook.astro:186–191` (low, Enter navigiert während IME-Komposition, `event.isComposing` ungeprüft) — aus Paket 7 · `packages/twopoint5d/src/stage/IStageRendererHost.ts` (info, Host-Vertrag sagt nicht, dass eine werfende Abmeldung aufgefangen und gemeldet wird) — aus Paket 10 · `packages/twopoint5d/src/stage/StageRenderer.spec.ts:128` (info, Kommentar 93 Zeichen), `packages/twopoint5d/README.md:44–48`/`:52–53` (info, Umbruch nicht greedy), `StageRenderer.ts` Kommentar an `#hostSubscriptions` (info, »that event« ohne eindeutigen Bezug), `packages/twopoint5d/src/stage/README.md:608–610` (info, »once when it leaves the host« verschweigt den Rückbau beim Beitritt) — aus Paket 12 · `packages/twopoint5d/CHANGELOG.md:3–5` (info, »walks a project through all of them in one upgrade« überzieht) — aus Paket 9
- Ziel: Die Einstiegs-Demo räumt beim Abbruch auf und fängt ihr Start-Promise, die Suche respektiert IME-Eingabe, und die im Lauf geschriebenen Kommentare, Doku-Absätze und CHANGELOG-Sätze sind eindeutig und umbrochen.
- Detail: docs/remediation/paket-13.md
- Dazu (Zug 0, Symptom derselben Ursache wie `first-sprite.astro`, aus d05f0422): der `ts check`-Block unter »Usage« im Root-`README.md:106–147` — dem Demo nachgebaut, dieselben drei Mängel (`display.start()` nicht abgewartet, `display.onDispose()` hinter dem `await`, Beschnitt im Hochkant-Fenster)
- Weg (Zug 0): nach dem letzten `await` im Init-Listener `display.isDisposed` prüfen und dann nichts bauen, statt `onDispose()` vor die `await` zu ziehen (sonst liefe die Ablehnung des abgebrochenen Ladens als unbehandelte Promise aus dem Listener); `await display.start()`; Kamera in `onResize` auf `CAMERA_DISTANCE / Math.min(1, aspect)`; IME über `event.isComposing || event.keyCode === 229`
- Bereich: `apps/lookbook/src/` (`pages/demos/first-sprite.astro`, `components/SearchLookbook.astro`), `README.md` (nur der `ts check`-Block), `packages/twopoint5d/src/stage/` (`IStageRendererHost.ts`, `StageRenderer.ts`, `StageRenderer.spec.ts`, `README.md`), `packages/twopoint5d/README.md`, `packages/twopoint5d/CHANGELOG.md` (nur der Kopfabsatz von `[Unreleased]`)
- Hängt ab von: —
- Hash: dcd53a3b
- Ergebnis: 0 Runden · alle zehn Reviewer-Befunde und der README-Block behoben (Reviewer bestätigt) · rote Proben vor dem Fix: IME-Enter (`isComposing` und `keyCode` 229) navigierte weg, Hochkant 390×844 beschnitt das Sprite; danach grün, Rauchprobe über Index und 18 Demos sauber
- Nebenbefunde: keine
- Folgen: keine

