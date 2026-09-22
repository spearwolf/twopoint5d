# Remediation-Plan — twopoint5d

Quelle: ./audit.html vom 2026-09-21 · Branch: main · erstellt: 2026-09-22
Baseline: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser)
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/5ff55df3-1e69-4969-a8e1-082491304971/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 11 von 183 Findings (5 low, 6 info), vom Nutzer per ID gewählt: CFG-025, CONS-029, TEST-038, TEST-039, TEST-041, TEST-019, CFG-022, READ-015, TEST-040, TYPE-015, TEST-026 · ausgenommen: alle übrigen, acknowledged
Scope-Regel: Nebenbefunde aus dem Projekt-Setup (Harness-Domäne: Build, Config, Tooling, Tests und Test-Helfer, Lookbook, Skripte) werden in diesem Lauf behoben, jede Severity; Befunde im Library-Code gehen als neues Finding ins Audit. Folgen dieses Laufs werden immer behoben.
Kaltstarts: 2 Pakete × mindestens 3 Agenten ≈ 6, je Nachrunde zwei mehr · 5,5 Findings je Paket
Stand (2026-09-22): Lauf abgeschlossen · beide Pakete committet · nichts blockiert · Befund-Queue ins Audit übergeben

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` blockiert.

## Entscheidungen
- Scope-Regel für Nebenbefunde: Harness-Domäne → dieser Lauf, Library-Code → Audit (2026-09-22)
- CFG-022: Typecheck-Inputs von `{workspaceRoot}/**/*.md` auf die Verzeichnisse mit getrackter Doku eingrenzen, nicht hinnehmen (2026-09-22)
- TEST-026: den Fix, den die beiden Browsertests absichern, testweise im Quellcode zurückdrehen, `dist` bauen, die Tests rot sehen, zurückdrehen; das Ergebnis steht in der Paketdatei. Ein Commit entsteht nur, wenn die Tests den Defekt nicht erkennen und nachgeschärft werden müssen (2026-09-22)
- CFG-025: Das Root-Manifest ist nicht publiziert; die Umbenennung berührt keinen fremden Aufrufer. Alle eigenen Referenzen (Workflows, Skripte, `--filter`, Doku) zieht das Paket mit (2026-09-22)

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
- Projektspezifisch: Code, Kommentare und Doku auf Englisch; Commits nach
  Conventional Commits; `pnpm run ci` ist das Gate vor jedem Commit;
  `pnpm publishNpmPkg` und `scripts/publishNpmPkg.mjs` werden nie ausgeführt.

## Vorbestehende Fehler
- keine — die Baseline ist vollständig grün

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] `packages/twopoint5d/src/display/Display.ts:55-64` — `drainSubmittedWork()` wartet ohne Frist auf `device.queue.onSubmittedWorkDone()`, sodass bei einer Implementierung, die das Promise nach Device-Verlust nie auflöst, die Freigabe des Renderers (`Display.ts:1112-1115`) und über `canvasReleases` jedes spätere Display auf demselben übergebenen Canvas (`Display.ts:183-184`, `:640-643`) ohne Ende warten · vorbestehend seit 049ba431 · Paket 2 (Zug 0, Abgleich von TEST-038) · Severity info (die WebGPU-Spec löst ausstehende `onSubmittedWorkDone()` bei Device-Verlust auf) · Library-Code · → Audit (als ASYNC-006 eingetragen, 2026-09-22)

## Pakete

### [x] 1. Workspace-Konfiguration und Build-Skripte schärfen
- Findings: CFG-025 (low), TYPE-015 (info), CFG-022 (info), READ-015 (info), TEST-040 (info)
- Ziel: Root-Manifest, tsconfig, Nx-Inputs und Paket-Skripte sagen eindeutig und prüfbar, was sie tun — eigener Workspace-Name, `noImplicitReturns` an, eingegrenzte Doku-Inputs, die Peer-only-Invariante als getestetes Skript, plattformneutrale Pfad-Erwartungen.
- Detail: `docs/remediation/paket-1.md`
- Bereich: `package.json`, `tsconfig.json`, `packages/twopoint5d-testing/project.json`, `packages/twopoint5d/package.json`, `scripts/`, `docs/architecture.md`, `AGENTS.md` — `.github/` enthält keine Referenz auf den Root-Namen, und der Probelauf mit `noImplicitReturns` fand keine Library-Fundstelle (Zug 0)
- Hängt ab von: —
- Hash: 19890c54
- Ergebnis: 1 Runde · CFG-025, TYPE-015, CFG-022, READ-015, TEST-040 behoben · Schutz-Spec
  `every tracked Markdown file is an input of twopoint5d-testing:typecheck` (vor dem Eintrag
  für `.claude/skills/**/*.md` rot) · neue Specs für `checkPeerDependenciesOnly.mjs` und
  `findRuntimeDependencies` · klein: `exactOptionalPropertyTypes` steht in `tsconfig.json:18`
  nicht an der alphabetischen Stelle
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: Root-Manifest heißt `twopoint5d-workspace` (Library bleibt
  `@spearwolf/twopoint5d`) · `noImplicitReturns: true` im Root-`tsconfig.json`, gilt auch für
  Specs und Browsertests (`checkJs`) · neues Skript `node scripts/checkPeerDependenciesOnly.mjs
  <package-dir>` (aus `lintPkg`) · Markdown-Inputs von `twopoint5d-testing:typecheck` stehen
  einzeln/je Verzeichnis in `packages/twopoint5d-testing/project.json`; eine neue getrackte
  `*.md` außerhalb davon lässt `scripts/checkDocSnippets/typecheckInputs.test.mjs` rot werden

### [x] 2. Test-Harness und Lookbook-Beschreibungen vereinheitlichen
- Findings: TEST-038 (low, gegenstandslos laut Zug 0: `stopAndDrain.js` in 049ba431 gelöscht, kein Teardown wartet mehr auf die GPU-Queue), TEST-039 (low), TEST-041 (low), TEST-019 (low), TEST-026 (info), CONS-029 (low)
- Ziel: Browser-Teardowns hängen und leaken nicht, das Dirty-Range-Protokoll und `setUploadRange` haben ein Regressionsnetz, der Renderer-Stub hat eine Bauform, die Pipeline-/Projektionstests sind einmal rot gesehen, und die Demo-Beschreibung rendert überall gleich.
- Detail: `docs/remediation/paket-2.md`
- Bereich: `packages/twopoint5d-testing/test/`, `packages/twopoint5d/src/vertex-objects/`, `packages/twopoint5d/src/texture/TextureStore.spec.ts`, `apps/lookbook/src/`
- Hängt ab von: —
- Hash: 7ec25649
- Ergebnis: 1 Runde · TEST-039, TEST-041, TEST-019, TEST-026, CONS-029 behoben, TEST-038
  gegenstandslos · TEST-026: Probe A (Kamera-Listener in `StageRenderer#add()` geleert) macht
  `Mode D: swapping the stage projection …` rot, Probe B (`#outputDirty` im Setter `pipeline`
  entfernt) macht `Mode C: a replaced pipeline takes over the output` rot, in Chromium und
  Firefox, kein Nachschärfen nötig · neue Specs `setUploadRange.spec.ts` und drei
  Zwei-Geometry-Tests in `vertex-buffers-geometry-updates.spec.ts` (u. a. `a write between the
  updates of two geometries sends the second one every object in use`), per Mutation an
  `pickUpDirtyRange`, `#markDirty` und `setUploadRange` je rot gesehen · Lookbook-Dialog rendert
  die Beschreibung als Markdown (`<code>Map2DTileRenderer</code>`)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `VanillaDemo.astro` verlangt `description: string` als Prop (Pflicht, von
  `astro check` geprüft) · Slot `demo-description` in `VanillaDemo` und Slot `description` in
  `DemoNavBar.astro` entfernt — eine neue Demo-Seite reicht die Beschreibung nur noch als Prop

