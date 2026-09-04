# Remediation-Plan — @spearwolf/twopoint5d

Quelle: ./audit.html vom 2026-09-02 · Branch: main · erstellt: 2026-09-04
Baseline: `pnpm lint` ✓ · `pnpm build` ✓ · `pnpm checkPkgTypes` ✓ · `pnpm test:ci` ✗
(Vitest 90/90 Dateien grün, 1406 Tests; Browser-Suite auf Chromium grün, auf Firefox
komplett rot — vorbestehend, siehe unten)
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/68198165-a575-487c-966b-ed0842928a1d/scratchpad
(Diffs und Verify-Logs, außerhalb der Versionierung)
Stand: 2026-09-04 — **Lauf abgeschlossen.** 17 Pakete committet (`23f768c` bis `46a9013`),
keines blockiert, Befund-Queue leer. 24 Findings geschlossen, 28 Nebenbefunde als neue Findings
in `./audit.html` eingetragen. Voller Verify-Lauf gegen die Baseline ohne Nx-Cache: lint, build,
typecheck, checkPkgTypes, checkNameableTypes, lintPkg und test:ci grün; die Browsersuite zeigt
unverändert die 24 vorbestehenden Firefox-Fehler und auf Chromium keinen. Die Version bleibt auf
0.21.2 — die Einstufung des Laufs ist breaking, die Anhebung auf 0.22.0 gehört zum Release und
steht im CHANGELOG unter `[Unreleased]` bereit. Score 14,5 → 19,5 (Harness 54,0 → 70,5,
Code & Laufzeit 60,5 → 49,0).

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[!]` blockiert.

## Verify-Kommandos

Wörtlich, damit der Abschluss gegen dieselbe Baseline prüft:

```
pnpm lint
pnpm build
pnpm checkPkgTypes
pnpm test:ci
```

Ab Paket 4 trennt sich die Browsersuite ab: `pnpm test:ci` fährt dann nur noch die
Vitest-Runde, `pnpm test:browser` die Playwright-Suite. Ab da gehören beide ins Gate,
die Browsersuite mit dem Vorbehalt aus »Vorbestehende Fehler«.

Ab Paket 5 kommt `pnpm lintPkg` (publint gegen das gebaute `dist/`) zwischen
`checkPkgTypes` und `test:ci` dazu, und `pnpm test:ci` erhebt Coverage mit Schwellen —
ein Lauf kann ab hier auch daran rot werden.

Ab Paket 6 kommt `pnpm --filter @spearwolf/twopoint5d run strictCheck` dazu: die
Migrations-Config `packages/twopoint5d/tsconfig.strict.json` prüft einen wachsenden
Ausschnitt der Quellen unter `strictNullChecks` und `noUncheckedIndexedAccess`, ohne zu
emittieren. Sie gehört ins Gate der Pakete 6, 7 und 8; in Paket 8 wächst ihr Ausschnitt
ein letztes Mal, nämlich auf die Specs.

Ab Paket 8a ist sie weg. Beide Schalter stehen dann in der **Root**-`tsconfig.json` —
dort, wo CFG-001 und CFG-002 sie verorten und wo `packages/twopoint5d` wie
`apps/lookbook` sie erben. An die Stelle von `strictCheck` tritt `pnpm typecheck` und
bleibt dauerhaft im Gate, **zwischen `build` und `checkPkgTypes`**. Es fährt zwei
Projekte: `packages/twopoint5d/tsconfig.typecheck.json` prüft `src` samt Specs ohne Emit —
seit Paket 1 emittiert `pnpm build` über `tsconfig.build.json` ohne die Specs, und ohne
diesen Schritt prüfte ihre Typen niemand mehr —, und `apps/lookbook/tsconfig.json` prüft
die 22 `.ts`-Dateien der App, die bis dahin überhaupt kein Compiler gesehen hat. Der
Platz nach `build` ist nicht beliebig: das Lookbook-Target hängt an `^build`, weil es
gegen das gebaute `dist/lib` der Bibliothek prüft.

Ab Paket 16 kommt `pnpm checkNameableTypes` dazu und bleibt dauerhaft im Gate,
**zwischen `checkPkgTypes` und `lintPkg`**. Es fährt `scripts/checkNameableTypes.mjs` über
das gebaute `dist/lib/index.d.ts` und geht rot, sobald ein Typ in einer veröffentlichten
Signatur steht, ohne von außen benennbar zu sein — die eine Fehlerklasse, die `attw` und
`publint` strukturell auflösen und deshalb nie melden. Der Platz ist nicht beliebig: die
beiden Prüfungen der emittierten `.d.ts` stehen zusammen, `lintPkg` befragt das Manifest.
Abschluss und Drain-Runde prüfen ab hier gegen diese Kette.

## Entscheidungen

- `strictNullChecks` **und** `noUncheckedIndexedAccess` werden aktiviert, mit ehrlichen
  Typen: kann eine Funktion `undefined` liefern, steht das künftig in ihrer Signatur —
  auch in der öffentlichen API. Der Lauf nimmt den Typ-Breaking-Change bewusst in Kauf
  und weist ihn in Semver und CHANGELOG aus. (2026-09-04)
- `tsup` wird ohne weitere Evaluation entfernt; die `tsc`-Pipeline bleibt. Ebenso
  entfallen `use-asset`, `ts-node` und `npm-run-all`. (2026-09-04)
- Dependency-Updates umfassen alle Minors **und** alle anstehenden Majors: eslint 9→10,
  nx 22→23, @types/node 22→26, sinon 21→22. (2026-09-04)
- Paket 1 wurde ohne die Belegdateien für Implementierer und Reviewer committet und die
  Schleife hielt darauf an. Der Commit bleibt: Diff deckungsgleich mit dem Detailplan,
  Verify-Gate `exit=0`, Wirkung an zwei gemessenen Zahlen belegt, und der Runner hatte
  ausweislich seiner Statistik zwei Subagenten beauftragt — die Arbeit war delegiert, nur
  ihre Akte fehlte. (2026-09-04)
- Die Tags werden getrennt: `twopoint5d-testing` verliert den Tag `ci` und bekommt einen
  eigenen. `pnpm test:ci` wird damit tatsächlich die schnelle, Playwright-freie Runde,
  die die Dokumentation längst behauptet. (2026-09-04)
- Die Catalog-Ranges `three` und `@types/three` (`~0.183.1`, aktuell 0.185.1 und 0.185.4)
  ziehen in diesem Lauf mit; die veröffentlichte Peer-Range der Bibliothek bewegt sich
  also. Der Eintrag unter »Offene Befunde« steht damit auf `→ Scope` und wird in der
  Drain-Runde des Abschlusses erledigt, nicht in einem der offenen Pakete — für einen
  Nebenbefund schneidet der Abschluss das Paket, nicht ein Runner. Am selben Tag dazu
  gemessen: der Sprung auf `@types/three@0.185.4` verschiebt keinen einzigen der 593
  Strictness-Fehler, und ohne die beiden Schalter kompiliert das Repo darunter
  fehlerfrei. (2026-09-04)

- Die drei Typen, die ohne Export in der veröffentlichten Typoberfläche stehen —
  `TextureAtlasFrameName`, `BufferAttribute` und `Buffer` aus `VertexObjectBuffer` —
  werden exportiert. `BufferAttribute` bekommt dabei einen anderen Namen, weil er den
  gleichnamigen three.js-Typ verdeckt, den dieselbe Datei nebenan meint. Rein additiv für
  Konsumenten. (2026-09-04)

- Der fehlende Wächter über Beispielcode in Docblocks und Markdown geht als neues Finding
  ins Audit, samt den drei Wegen, zwischen denen zuerst entschieden werden muss: Snippets
  durchweg selbsttragend schreiben, eine Präambel-Syntax im Docblock einführen, oder Auszüge
  ausklammern. Die Konvention trägt weiter als ein Paket und gehört an den Anfang eines
  Laufs. (2026-09-04)

- Der Implementierer von Paket 16 wurde mitten in der Arbeit beendet; seine halbe,
  ungeprüfte Umsetzung im Arbeitsbaum ist verworfen worden, das Paket läuft von Zug 0 neu.
  (2026-09-04)

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

Projektspezifisch dazu:

- Conventional Commits, Commit-Messages auf Englisch (so zeigt es `git log`).
- Quell-Imports tragen die `.js`-Endung (NodeNext-ESM), Typen kommen über
  `import type`.
- Neue öffentliche Symbole müssen in die zuständige `public-api.ts`.
- `pnpm publishNpmPkg` und `scripts/publishNpmPkg.mjs` werden in diesem Lauf nicht
  ausgeführt.
- Implementierer und Reviewer werden als eigene Prozesse beauftragt, damit ihre Reports
  als `paket-<N>.impl-*.json` und `paket-<N>.review-*.json` im Arbeitsverzeichnis liegen.
  Das eingebaute Agent-Werkzeug erledigt zwar dieselbe Arbeit, hinterlässt aber keine
  Akte — und ohne Akte lässt sich hinterher nicht mehr zeigen, dass ein Commit vier Augen
  gesehen hat. Die Schleife prüft auf diese Dateien und hält an, wenn sie fehlen.

## Vorbestehende Fehler

- Die gesamte Playwright-Suite auf **Firefox** ist rot: `TypeError: can't access property
  "getSupportedExtensions", this.gl is null` — der headless Firefox dieser Maschine
  bekommt keinen GL-Kontext. Chromium fährt dieselben Tests grün durch. Vor Lauf-Beginn
  vorhanden, kein Teil des Scopes. Ein Paket gilt als verifiziert, wenn Chromium grün ist
  und Firefox nicht *zusätzliche* Fehler zeigt.
  Nach Paket 5 (d011232) am 2026-09-04 im echten Baum nachgemessen und unverändert
  bestätigt: Chromium 0 Fehler, Firefox 24 Fehler, `getSupportedExtensions` 92-mal im
  Log. Der Sprung auf `@web/test-runner@1.0.0`, `@web/test-runner-playwright@1.0.0` und
  `@web/dev-server-esbuild@2.0.0` ändert daran nichts — er reicht dieselbe
  `playwright@1.62.1` durch, die schon vorher stand, und der Abbruch sitzt im
  `WebGPURenderer.init()` in `packages/twopoint5d/src/display/Display.ts:355`. Die
  gegenteilige Erwartung aus einer isolierten Probeinstallation (Zug 0 von Paket 5,
  »zweitens«) trägt nicht; sie ist damit erledigt und darf von den Paketen 6 bis 10
  nicht mehr vorausgesetzt werden. Diese Zahlen sind der Maßstab, gegen den sie ihren
  Verify-Lauf halten.

## Offene Befunde

Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] `package.json:9` — `engines.node` steht auf `>=24`, das Audit geht von `>=22.13` aus,
  die README nennt v18. Zwei Zahlen für dieselbe Anforderung (beim Baseline-Abgleich
  aufgefallen) → Scope, gehört in Paket 10.
  Korrektur aus Zug 0 von Paket 10 (2026-09-04): Die dritte Zahl gibt es nicht. Weder diese
  Zeile noch CFG-003 stimmen darin, dass `AGENTS.md` eine Node-Version nennt — die Datei tut
  es nicht, heute so wenig wie bei `ba44e8e`, und `git log -S "22.13" -- AGENTS.md` findet
  nichts. Im Baum steht die Zahl an fünf Stellen (`package.json:9`, `mise.toml:2`,
  `.github/workflows/ci.yml:21`, `.github/workflows/deploy.yml:27`, `CLAUDE.md:9`), alle
  einig auf 24; `README.md:75` ist die einzige abweichende.
  Erledigt mit Paket 10 (`88f994d`): `README.md:75` nennt jetzt v24, `.nvmrc` mit `24`
  angelegt, `AGENTS.md` verweist auf `engines` statt eine sechste Zahl zu führen
- [x] `package.json:36,39,43,45` — vier weitere Root-devDependencies ohne Abnehmer im
  Workspace: `@types/react`, `@vitejs/plugin-react` und `eslint-plugin-react` (die
  Lookbook-App bringt ihre React-Kette in `apps/lookbook/package.json` selbst mit,
  `eslint.config.mjs` lädt kein React-Plugin) sowie `happy-dom` (keine einzige Spec setzt
  eine DOM-Umgebung; der Name steht nur noch in `nx.json:50` als `externalDependencies`
  von `vitestDefaults`). Dieselbe Ursache wie die drei Namen aus dem Audit, in Paket 1
  beim Lesen von `package.json` und `eslint.config.mjs` aufgefallen → Scope, gehört in
  Paket 2; `happy-dom` zieht dabei die Zeile in `nx.json` mit. Mit Paket 2 (5da6fa6)
  erledigt: alle vier Namen sind aus `package.json` gestrichen, `nx.json:50` führt nur
  noch `vitest`.
- [x] `package.json:52` — `vitest` steht auf `^4.0.18`, aktuell ist 5.0.0. Betrifft die
  Unit-Suite und die in Paket 1 angelegte `packages/twopoint5d/vite.config.ts`; der Major
  stand beim Audit noch nicht an und ist in keiner Entscheidung enthalten (beim
  Versionsabgleich in Paket 2 aufgefallen), Severity low → Scope, gehört in Paket 5.
  Zug 0 von Paket 3: `@vitest/coverage-v8` erscheint im Gleichschritt mit `vitest` und
  steht heute ebenfalls auf 5.0.0. Paket 5 führt Coverage ein und muss dabei ohnehin eine
  Coverage-Version benennen; bliebe der Major in der Queue, pinnte Paket 5 auf `^4` und
  die Drain-Runde risse beides wieder heraus. Deshalb dort und nicht in der Queue.
  Zug 0 von Paket 5: im Detailplan aufgenommen, Schritt 1 und 3. Beide Ranges gehen auf
  `^5.0.0`; in einer isolierten Installation gegen `vitest@5.0.0` fährt die echte Suite
  unverändert 45 Dateien / 703 Tests grün. Mit Paket 5 (d011232) erledigt: `vitest`
  und `@vitest/coverage-v8` stehen auf `^5.0.0`, im Baum als `5.0.0` aufgelöst, die
  Vitest-Runde bleibt bei 45 Dateien / 703 Tests
- [x] `packages/twopoint5d-testing/package.json:26,27,28` — die drei Pakete des
  Browser-Harness liegen je einen Major zurück: `@web/dev-server-esbuild` 1.0→2.0,
  `@web/test-runner` 0.20→1.0, `@web/test-runner-playwright` 0.11→1.0. Sie bewegen sich nur
  gemeinsam und fassen genau die Konfiguration an, die Paket 5 umbaut (beim
  Versionsabgleich in Paket 2 aufgefallen), Severity low → Scope, gehört in Paket 5.
  Zug 0 von Paket 3: derselbe Grund wie beim `vitest`-Eintrag. Paket 5 stellt den
  Browser-Timeout neu ein, und `@web/test-runner` 0.20 → 1.0 ändert das Schema genau der
  Datei, in der dieser Timeout steht. Erst austarieren und dann den Major nachschieben
  hieße, zweimal gegen zwei verschiedene Schemata zu tarieren.
  Zug 0 von Paket 5: im Detailplan aufgenommen, Schritt 2 — der Grund trägt aber nicht.
  Das Schema ist zwischen `0.20.2` und `1.0.0` bis auf die Schreibweise der Typ-Importe
  identisch. Der Sprung bleibt trotzdem hier, aus einem stärkeren Grund: er nimmt
  Firefox den `this.gl is null` weg, der heute alle 24 Firefox-Tests reißt, und
  verschiebt damit die Zeile unter »Vorbestehende Fehler«, gegen die jedes spätere Paket
  seinen Verify-Lauf hält. Mit Paket 5 (d011232) erledigt — der Versionssprung
  sitzt, der zweite Grund trägt aber ebenso wenig wie der erste: im echten Baum bleibt
  Firefox bei 24 Fehlern und 92 Vorkommen. Die Zeile unter »Vorbestehende Fehler« ist
  entsprechend fortgeschrieben
- [x] `package.json:38` — `esbuild` steht auf `^0.27.3`, aktuell ist 0.28.2; die Caret-Range
  erreicht den Sprung bei einer 0.x-Version nie von selbst. Nebenbei: die Begründung des
  Audits für diesen Eintrag trägt nicht — `@web/dev-server-esbuild` bringt sein eigenes
  `esbuild@^0.25.0` mit, der Root-Eintrag bedient den Peer von `vite@8` (beim
  Versionsabgleich in Paket 2 aufgefallen), Severity info → Scope.
  Zug 0 von Paket 3: bewusst **nicht** in Paket 3 mitgenommen, obwohl die Ursache
  dieselbe ist und der Eintrag dort eine einzige Zeile wäre. Kein offenes Paket fasst
  diesen Eintrag an, also arbeitet auch keines doppelt, wenn er liegen bleibt — und die
  Drain-Runde sieht alle Reste nebeneinander, was hier die bessere Übersicht ist.
  Zug 0 von Paket 11: in den Detailplan aufgenommen, Schritt 2. Dabei zweimal korrigiert.
  Die Zeile ist heute `package.json:41`, nicht 38 — Paket 2 hat drei Namen gestrichen und
  Paket 5 zwei angelegt. Und die Begründung des Eintrags trägt in ihrer eigenen Zahl nicht
  mehr: `@web/dev-server-esbuild` bringt seit Paket 5 (`2.0.0`) `esbuild@^0.28.1` mit, nicht
  `^0.25.0`; das war der Stand von `1.0.4`. Der Peer von `vite@8.2.2` lautet
  `^0.27.0 || ^0.28.0`, `^0.28.2` liegt also darin. Am 2026-09-04 im Probe-Workspace
  gemessen, was der Sprung tatsächlich einbringt: das Lockfile führt danach **einen**
  esbuild-Eintrag statt zweier (`0.27.3` und `0.28.2` fallen zu `0.28.2` zusammen)
  Mit Paket 11 (`ff29f29`) erledigt: `package.json` führt `"esbuild": "^0.28.2"`, das Lockfile
  einen einzigen esbuild-Eintrag.
- [x] `pnpm-workspace.yaml:10,11` — die Catalog-Einträge `@types/three` und `three` stehen
  auf `~0.183.1`, aktuell ist 0.185. Beide sind `peerDependencies` der veröffentlichten
  Bibliothek; ein three.js-Minor ist erfahrungsgemäß ein Breaking Change im Renderer, und
  die Range-Änderung ist eine Kompatibilitätsaussage nach außen (beim Versionsabgleich in
  Paket 2 aufgefallen) → Rückfrage: die Scope-Regel nennt Dependencies, schickt reine
  Code- und API-Themen aber ins Audit, und dieser Eintrag ist beides zugleich.
  Zug 0 von Paket 3: die Rückfrage bekommt eine Adresse, damit sie nicht bis zum Abschluss
  liegen bleibt — **Paket 6, Zug 0**. Dort wird sie fällig, und zwar aus einem Grund, den
  Paket 2 noch nicht sehen konnte: `@types/three` liefert die Typen, gegen die die Pakete
  6 bis 8 ihre rund 600 Strictness-Fehler zählen. Ein Minor-Sprung dort verschiebt die
  Zählung. Vor Paket 6 fällig wird die Frage nicht, und Paket 6 entscheidet sie mit den
  frisch gemessenen Zahlen in der Hand statt auf Verdacht.
  Zug 0 von Paket 6: gestellt und beantwortet, die Antwort steht unter »Entscheidungen« —
  die Range zieht mit, das Urteil lautet damit **→ Scope**, und die Drain-Runde des
  Abschlusses erledigt den Eintrag. Der Grund für die Adressierung an dieses Paket trägt
  allerdings nicht: gegen `@types/three@0.183.1` zählt der Strictness-Lauf 593 Fehler,
  gegen `0.185.4` dieselben 593, Zeile für Zeile identisch bis auf drei Meldungstexte, die
  einen Typparameter dazubekommen haben (`Material` → `Material<MaterialEventMap>`). Ohne
  die Schalter kompiliert `0.185.4` das Repo fehlerfrei. Die Pakete 6 bis 8 hängen also
  nicht daran, und die Reihenfolge ist frei.
  Zug 0 von Paket 11: in den Detailplan aufgenommen, Schritt 1, auf `~0.185.4` und `~0.185.1`
  — die heute aktuellen Stände. Am 2026-09-04 im Probe-Workspace gemessen, was der Sprung
  im ganzen Workspace kostet, und es ist genau eine Stelle: `pnpm typecheck` geht rot an
  `apps/lookbook/src/demos/instanced-quads/createTexturedQuads.ts:8` (TS2769), weil
  `vec3()` in `0.185` den `AttributeNode<unknown>` aus einem `attribute('quadSize')` ohne
  Typargument in keiner Überladung mehr annimmt. Dieselbe Zeile steht wortgleich in zwei
  `.astro`-Dateien. Der Typparameter behebt alle drei — die Bibliothek schreibt ihn in
  `src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:44` seit jeher so. Die Bibliothek
  selbst bleibt unberührt: `twopoint5d:typecheck`, `checkPkgTypes` und `lintPkg` sind unter
  `0.185.4` grün, ebenso die Vitest-Runde, und die Browsersuite liefert die bekannten Zahlen
  Mit Paket 11 (`ff29f29`) erledigt: der Catalog führt `three: ~0.185.1` und
  `@types/three: ~0.185.4`; die drei `attribute<'vec2'>('quadSize')` sind nachgezogen.
- [x] `package.json:50` — `typescript` steht auf `^5.9.3`, aktuell ist 7.0.2. Der Sprung ist
  der Wechsel auf den nativen Compiler; er liefe quer zu den Paketen 6–8, deren gesamter
  Inhalt rund 600 unter `tsc` 5.9 gezählte Typfehler sind, und `typescript-eslint` wie
  `attw` müssten ihn mittragen (beim Versionsabgleich in Paket 2 aufgefallen) → Audit,
  Severity low. Zug 0 von Paket 3 hat die Rückfrage aufgelöst, ohne sie stellen zu müssen:
  `typescript-eslint@8.69.0` — die einzige veröffentlichte Linie, Canary eingeschlossen —
  führt `typescript: >=4.8.4 <6.1.0` als Peer. TypeScript 7 ist damit in diesem Repo nicht
  installierbar, ohne `typescript-eslint` fallen zu lassen, und mit ihm den gesamten
  `@typescript-eslint/*`-Regelblock aus `eslint.config.mjs`. Das ist kein Zuschnittproblem,
  das jemand entscheiden könnte, sondern eine Schranke stromaufwärts. Der Befund geht als
  offenes Finding ins Audit, mit dem Peer-Deckel als Grund; fällig wird er wieder, wenn
  `typescript-eslint` v9 erscheint.
  Zug 0 von Paket 11a: ein zweiter Deckel kommt dazu. `@astrojs/check@0.9.10` verlangt
  `typescript: ^5.0.0 || ^6.0.0`, und mit Paket 11a hängt das Typ-Gate der Lookbook daran.
  Am Urteil ändert das nichts und an der Fälligkeit auch nicht — nur daran, wie viele
  Pakete vor einem Sprung auf 7 nachziehen müssten
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `apps/lookbook/astro.config.mjs:14` und `apps/lookbook/package.json:17,23,24,28,29,31`
  — die Lookbook-App lädt die Astro-React-Integration und hält `@astrojs/react`, `react`,
  `react-dom`, `@types/react`, `@types/react-dom` und `styled-components`, rendert damit
  aber nichts: `src/` enthält 36 `.astro`- und 22 `.ts`-Dateien, kein `.tsx`, kein `.jsx`
  und keine einzige `client:`-Direktive. Dieselbe Ursache wie DEPS-001, aber im
  App-Manifest und mit einer Änderung an der Astro-Config statt an einer Manifestzeile —
  deshalb nicht in Paket 2 mitgenommen (beim Abgleich der React-Kette in Paket 2
  aufgefallen), Severity low → Scope.
  Zug 0 von Paket 11: in den Detailplan aufgenommen, Schritte 3 bis 5. Der Befund steht
  unverändert — kein `.tsx`, kein `.jsx`, keine `client:`-Direktive, und `@spearwolf/astro-rainbow-line`,
  das einzige Fremdpaket im Manifest, das eine React-Kette bräuchte, ist ein `.astro`-Wrapper
  ohne jede Abhängigkeit. Die sechs Manifestzeilen sind seit Paket 8a um eine nach unten
  gerutscht (18, 24, 25, 29, 30, 32), die `integrations`-Zeile der Astro-Config steht
  weiterhin auf 14. Am 2026-09-04 im Probe-Workspace gemessen: ohne die sechs Namen und
  ohne die Integration bauen beide Projekte durch, und `astro check` meldet keinen einzigen
  Fehler, der React nennt
  Mit Paket 11 (`ff29f29`) erledigt: die sechs Manifestzeilen und die Astro-Integration sind
  gestrichen, React steht in keinem Manifest des Workspace mehr.
- [x] `.gitignore:11,43,44,48-52` — die Datei sperrt `.nx/` dreifach übereinander
  (`.nx/cache` in Zeile 11, das pauschale `.nx/` in 43, `.nx/workspace-data` in 44, wovon
  die erste und die dritte unter der zweiten verschwinden), und die Zeilen 48/49 stehen
  als 51/52 ein zweites Mal wortgleich da. Das ist die Spur früherer Nx-Migrationen, die
  ihre Einträge anhängen, ohne nachzusehen — beim Lesen der acht anstehenden
  Nx-Migrationen in Paket 3 aufgefallen und zugleich einer der Gründe, dort auf
  `nx migrate` zu verzichten, Severity info → Scope
  Zug 0 von Paket 12: in den Detailplan aufgenommen, Schritt 1. Die Zeilen sind um eins
  gewandert, weil Paket 5 `packages/*/coverage` eingefügt hat — heute stehen `.nx/cache` in
  11, das pauschale `.nx/` in 44, `.nx/workspace-data` in 45, und die Wiederholung von 49/50
  steht in 52/53. Das pauschale `.nx/` fällt, die beiden benannten Einträge bleiben und rücken
  zusammen: so schreibt nx die Regel selbst, und sie verschluckt kein künftiges
  Unterverzeichnis von `.nx/`, das ins Repo gehört
  Mit Paket 12 (`de936e4`) erledigt, in Zug 0 von Paket 13 nachgetragen: `.gitignore` führt
  `.nx/cache` und `.nx/workspace-data` in Zeile 44 und 45 und sonst keinen `.nx`-Eintrag, und
  die Wiederholung von 49/50 ist weg.
- [x] `.github/workflows/ci.yml:40-45` — der Schritt »Archive Playwright test results«
  lädt `packages/twopoint5d-testing/test-results` als Artefakt hoch, und dieses
  Verzeichnis befüllt niemand mehr. Am 2026-09-04 nachgemessen: die volle Browsersuite
  gefahren, davor und danach verglichen — eine einzige Datei, `.last-run.json`, mit
  Änderungszeit vom 2025-06-30, unverändert. Der konfigurierte `defaultReporter` in
  `web-test-runner.config.js` schreibt auf die Konsole, nicht in eine Datei; die
  Datei stammt aus einer `@playwright/test`-Ära, die es hier nicht mehr gibt. Mit
  `if: always()` läuft der Upload bei jedem roten Lauf und liefert nichts — also genau
  dann nichts, wenn jemand hinsehen will (beim Ausmessen der Target-Outputs in Paket 4
  aufgefallen), Severity info → Scope, gehört in Paket 5: dort wird `ci.yml` ohnehin neu
  geschrieben und Coverage als Artefakt eingeführt, und die Frage »was hebt CI auf« wird
  einmal statt zweimal beantwortet.
  Zug 0 von Paket 5: im Detailplan aufgenommen, Schritt 11 — der Schritt lädt
  `packages/twopoint5d/coverage` hoch statt des toten Verzeichnisses. Mit Paket 5 (d011232) erledigt:
  der Schritt heißt »Archive coverage report« und lädt `packages/twopoint5d/coverage`
- [x] `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts:401-415`
  — der Test »descends through a missing-quadrant slot without throwing« steckt vollständig
  in `if (missing != null)`. Besetzt `subdivide(1)` alle vier Quadranten, prüft der Test
  nichts und bleibt trotzdem grün: eine Zusicherung, die ihre eigene Voraussetzung nicht
  zusichert, schweigt genau dann, wenn es darauf ankommt (beim Lesen der Datei in Paket 8
  aufgefallen), Severity low → Scope, die Scope-Regel nennt den Test-Harness und der Scope
  die Kategorie Testabdeckung & Teststrategie.
  Zug 0 von Paket 9: in den Detailplan aufgenommen, Schritt 4b — das Paket öffnet die Datei
  ohnehin für die Folge aus 8a, die dreißig Zeilen darüber sitzt, und dieselbe Datei ein
  zweites Mal für eine Zusicherung aufzuschlagen wäre der teure Weg. Der Eintrag trifft die
  Sache, greift aber zu kurz: die Fixture ist am 2026-09-04 durchgerechnet, `subdivide(1)`
  besetzt **nie** alle vier Quadranten, `northEast` bleibt immer leer, und der Wächter feuert
  heute. Was der Test trotzdem nicht tut, ist den leeren Schacht betreten — sein Punkt
  `[5, -5]` läuft in `findChunksAt()` wegen `-5 < -5 === false` nach `southEast`, also ins
  besetzte Kind. Die Zusicherung ist damit doppelt hohl: ein Wächter, der sie stumm schalten
  kann, über einem Pfad, den sie ohnehin verfehlt. Beides fällt in Paket 9 weg
  Mit Paket 9 (bf868e4) erledigt: der Wächter und das `find()` sind ersatzlos weg, der Test
  sichert `n.nodes.northEast` als `null` zu und betritt den leeren Schacht über den Punkt
  `[5, -6]` statt über `[5, -5]`, das nach `southEast` lief
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts:34-35,62-63,87-88`
  — `expect(Array.from(…)).toEqual(expect.arrayContaining([…]))` prüft eine Teilmenge und
  keine Gleichheit; ein zusätzlicher Attribut- oder Buffer-Name fällt nicht auf. Zeile 63
  hat mit `toMatchObject(['static_float32'])` dasselbe Problem, und beides liest sich wie
  eine vollständige Liste (beim Lesen der Datei in Paket 8 aufgefallen), Severity low →
  Scope, dieselbe Begründung wie beim Eintrag darüber.
  Zug 0 von Paket 9: bewusst **nicht** hereingenommen, obwohl der Eintrag darüber es wurde
  und beide dieselbe Machart haben — eine Zusicherung, die schwächer ist, als sie aussieht.
  Der Unterschied liegt nicht in der Sorte, sondern in der Datei: Paket 9 schlägt
  `ChunkQuadTreeNode.extended.spec.ts` für die Folge aus 8a ohnehin auf, `vertex-objects/`
  fasst es nirgends an, und die Ursache teilt es mit keinem der drei Findings. Damit fehlt
  der Grund, der den anderen Eintrag hereinholt, und der Weg bleibt die Drain-Runde
  Zug 0 von Paket 13: in den Detailplan aufgenommen, Schritt 1, Zeilennummern unverändert —
  und dabei einmal korrigiert. Zeile 63 (`toMatchObject(['static_float32'])`) hat **nicht**
  dasselbe Problem: `toMatchObject` prüft auf einem Array die Länge mit, unter Vitest 5.0.0
  im Probe-Baum gemessen. Sie wird trotzdem auf `toEqual` gebracht, damit ein Leser nicht
  wissen muss, dass derselbe Matcher bei Arrays anders zählt als bei Objekten. Die
  `arrayContaining`-Zeilen sind echte Löcher und werden ausgeschrieben; die Reihenfolge in
  Zeile 88 ist dabei die umgekehrte der bisherigen Aufzählung (`['static_float32',
  'dynamic_float32']`, gegen `dist/lib` gemessen). Fünf Zusicherungen derselben Ursache aus
  `selectBuffers.spec.ts`, `selectAttributes.spec.ts` und `TextureAtlas.spec.ts` gehen
  mit — Begründung im Paketblock
  Erledigt mit Paket 13; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `packages/twopoint5d/src/texture/TextureStore.spec.ts:349,409,425,539` — vier weitere
  `describe`-Namen tragen je eine tote Finding-Nummer aus einem früheren Audit (`7475b47`,
  vor diesem Lauf). Keine davon löst heute noch etwas auf, und jeder Name sagt ohne sie
  dasselbe (beim Review von Paket 8 aufgefallen), Severity info → Scope: die Konventionen
  dieses Laufs schließen genau diese Form für jede neue Zeile aus, und ein Repo, das sie an
  einer Stelle weiterträgt, macht die Regel unglaubwürdig.
  Zug 0 von Paket 8a: an **Paket 9** adressiert. Der Eintrag ist die dritte Fundstelle von
  TEST-013, das dort schon im Paket steht: dieselbe Datei, dieselbe Ursache, und die
  `Ziel:`-Zeile von Paket 9 verspricht sie bereits mit »kein Testname verweist mehr auf
  eine Laufnummer«. Ihn stattdessen in der Drain-Runde zu lassen hieße, dieselbe Datei ein
  zweites Mal für eine Zeile aufzuschlagen.
  Zug 0 von Paket 9: in den Detailplan aufgenommen, Schritt 1 — und dabei zweimal
  korrigiert. Die Zeilennummer `:885` gab es nie: die Datei hat 685 Zeilen und hatte sie
  gegen `ba44e8e`, `23f768c`, `c67ef74`, `dca1018` und `a4bfe10` einzeln nachgezählt
  unverändert. Und es ist nicht **eine** weitere Fundstelle, sondern vier: neben den beiden
  aus dem Audit (281, 316) stehen `(BUG-9)` an 349, `(BUG-8)` an 409, `(BUG-3)` an 425 und
  `(BUG-4)` an 539. Alle sechs verschwinden mit dem Commit dieses Pakets; danach findet ein
  `grep` über `packages/` und `apps/` im ganzen Repo keine Laufnummer mehr
  Mit Paket 9 (bf868e4) erledigt: alle sechs Klammerzusätze sind aus den `describe`-Namen
  verschwunden, kein Testname wurde umbenannt, und der Kontroll-Grep über `packages/` und
  `apps/` bleibt leer
- [x] `.github/workflows/ci.yml:27,32,38` — drei Schritte tragen `env: NPM_TOKEN: xxx`,
  einen Platzhalterwert ohne Funktion: weder `pnpm install --frozen-lockfile` noch der
  Playwright-Download noch der Testlauf authentifiziert sich gegen eine Registry.
  `deploy.yml` kommt ohne die Zeile aus und veröffentlicht trotzdem. Der Eintrag stand
  vor Paket 5 schon an den alten Schritten und ist dort nur mitgewandert (beim
  vollständigen Lesen der beiden Workflows in Paket 5 aufgefallen), Severity info
  → Scope
  Zug 0 von Paket 12: in den Detailplan aufgenommen, Schritt 2, Zeilennummern unverändert. Am
  2026-09-04 gegengeprüft: außerhalb dieser drei Zeilen steht `NPM_TOKEN` im ganzen Repo nur
  in einer Log-Ausgabe von `scripts/publishNpmPkg.mjs:18`, ein `.npmrc` hat das Repo nicht,
  und `pnpm run ci` ruft `publishNpmPkg` nicht auf
  Mit Paket 12 (`de936e4`) erledigt, in Zug 0 von Paket 13 nachgetragen: `grep -rn NPM_TOKEN .github/`
  findet nichts mehr.
- [x] `packages/twopoint5d/package.json:52,53` — `checkPkgTypes` und `lintPkg` betreten
  mit `cd dist` ein Verzeichnis, das erst ein `build` erzeugt, sagen das aber nirgends:
  ihre Abhängigkeit vom Build lebt allein im `dependsOn: ["build"]` der Nx-Targets. Über
  `pnpm nx run-many` und über `pnpm run ci` ist das gedeckt; ein direkter Aufruf im
  Paketverzeichnis läuft gegen ein leeres oder veraltetes `dist/` und meldet je nach
  Stand »All good!« über einem Stand von gestern. `checkPkgTypes` hat diese Eigenschaft
  seit jeher, Paket 5 hat sie mit `lintPkg` ein zweites Mal angelegt (beim Lesen von
  `packages/twopoint5d/package.json` in Paket 5 aufgefallen), Severity low → Scope.
  Zug 0 von Paket 8a: Paket 8a legt ein drittes Script derselben Familie an (`typecheck`)
  und wiederholt das Muster ausdrücklich **nicht** — die Prüfung läuft gegen `src`, betritt
  kein `dist` und braucht deshalb keine Build-Abhängigkeit, die sich verstecken könnte. Der
  Eintrag wächst also nicht und bleibt bei den zwei Scripts, die er nennt
  Zug 0 von Paket 12: in den Detailplan aufgenommen, Schritt 3; die Zeilen heißen heute 53 und
  54, weil Paket 8a `typecheck` darüber eingefügt hat. Der Fix hängt beiden Scripts
  `pnpm run build &&` vor und ersetzt den Verzeichniswechsel durch das Verzeichnis als
  Argument — `attw --pack dist` und `publint dist`, beides am 2026-09-04 gegen das gebaute
  `dist/` gefahren und grün. Gemessene Kosten: 2,3 s je Aufruf
  Mit Paket 12 (`de936e4`) erledigt, in Zug 0 von Paket 13 nachgetragen: beide Scripts stehen
  in `packages/twopoint5d/package.json:53,54` als `pnpm run build && pnpm exec attw --pack dist …`
  und `pnpm run build && pnpm exec publint dist`, kein `cd` mehr.
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:90` — `dispose()` schreibt
  `undefined as unknown as TypedArray` in `buffer.typedArray`. Der Cast verdeckt, dass das
  Feld nach `dispose()` leer ist; jeder Konsument von `pool.buffer.buffers` bekommt weiter
  `TypedArray` versprochen (beim Lesen der Datei in Paket 6 aufgefallen), Severity low
  → Scope. Begründung des Urteils: Das ist keine beliebige Code-Stelle, sondern eine
  Ausweichklappe an genau dem Schalter, den dieser Lauf einbaut. Bleibt sie stehen, legt
  Paket 8 den globalen Schalter über ein bekanntes Loch.
  Zug 0 von Paket 7: an **Paket 8** adressiert und in dessen Hinweisen aufgenommen. Genau
  der Satz darüber ist der Grund — ein Eintrag, dessen Schaden erst entsteht, wenn der
  globale Schalter liegt, darf nicht in der Drain-Runde danach warten.
  Zug 0 von Paket 8: an **Paket 8a** weitergereicht, weil dort der Schalter liegt; die
  Adressierung ist damit unverändert, nur die Paketnummer hat sich beim Schnitt bewegt.
  Am 2026-09-04 nachgemessen, was der ehrliche Typ kostet: `Buffer.typedArray` auf
  `TypedArray | undefined` erzeugt 22 Fundstellen im Produktivcode (8 Dateien) und 16
  weitere in den Specs. Die Liste steht unter Paket 8a. Der Vertrag selbst bleibt: dass
  ein vor `dispose()` gegriffener Buffer danach keinen Array mehr hält, prüft
  `src/vertex-objects/VertexObjectPool.spec.ts:739-759` ausdrücklich, und das ist gewollt
  — geändert wird der Typ, nicht das Verhalten
  Zug 0 von Paket 8a: im Detailplan aufgenommen, Schritte 2 bis 4. Die Zahlen halten auch
  nach Paket 8 — gegen `dca1018` erneut gemessen, wieder 22 + 16, Datei für Datei und
  Zeile für Zeile dieselben. Neu entschieden: `VertexObjectBuffersData.buffers` bleibt
  `Record<string, TypedArray>` und wird **nicht** mitverbreitert. Der Typ ist zugleich der
  Eingabetyp von `fromBuffersData()`, und `toBuffersData()` kann das `undefined` gar nicht
  erzeugen — nach `dispose()` ist die Buffer-Map leer. Mit Paket 8a (a4bfe10) erledigt:
  `Buffer.typedArray` ist `TypedArray | undefined`, der Cast in `dispose()` ist einem
  schlichten `undefined` gewichen, und die 22 + 16 Fundstellen sind aufgelöst. Der Vertrag
  ist unangetastet — `VertexObjectPool.spec.ts:739-759` steht unverändert und prüft ihn
  weiter
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:214` —
  `toAttributeArrays()` liefert für einen unbekannten Attributnamen `[attrName]`, also
  einen Eintrag mit Wert `undefined`, während der Rückgabetyp `Record<string, TypedArray>`
  lautet (beim Lesen der Datei in Paket 6 aufgefallen), Severity low → Scope, aus
  demselben Grund wie der Eintrag darüber: der Typ sagt etwas, was der Code nicht hält,
  und der Schalter fängt es nicht, weil kein Cast und kein `!` im Weg steht, sondern die
  Signatur selbst zu eng deklariert ist.
  Zug 0 von Paket 7: an **Paket 8** adressiert, aus demselben Grund wie der Eintrag darüber.
  Zug 0 von Paket 8: an **Paket 8a** weitergereicht, ebenfalls mit dem Schalter. Warum kein
  Compilerfehler auf die Stelle zeigt, ist am 2026-09-04 an einer Probe geklärt: das
  `.map()` liefert kein Tupel, sondern ein `(string | TypedArray)[]`, `Object.fromEntries()`
  fällt damit auf seine `Iterable<readonly any[]>`-Überladung zurück und gibt `any`. In der
  Probe compiliert ein Methodenaufruf auf dem Ergebnis, den es nicht gibt. Der deklarierte
  Rückgabetyp behauptet danach etwas, das nichts geprüft hat — der Schalter ändert daran
  nichts, weil `any` unter jeder Strictness `any` bleibt.
  Mit Paket 8a (a4bfe10) erledigt: der `.map()`-Callback trägt seinen Tupel-Rückgabetyp,
  `Object.fromEntries()` nimmt damit die typisierte Überladung statt `any`, und die Methode
  gibt `Record<string, TypedArray | undefined>`
  Zug 0 von Paket 8a: im Detailplan aufgenommen, Schritt 6, und dort in drei Änderungen
  zerlegt, die nur zusammen wirken — Tupeltyp am `.map()`-Callback, `[attrName, undefined]`
  im else-Zweig, verbreiterter Rückgabetyp. Am 2026-09-04 gemessen: die drei zusammen mit
  der Verbreiterung aus dem Eintrag darüber erzeugen keinen einzigen zusätzlichen Fehler,
  die Zählung bleibt bei 38. Geht mit Paket 8a auf `[x]`
- [x] `packages/twopoint5d/src/texture/TextureAtlas.ts:53` — `frame(name)` schreibt
  `this.#frames[this.#frameNames.get(name)!]`. Das `!` behauptet einen Namen, der fehlen
  darf; der Zugriff läuft dann über `#frames[undefined]` und liefert zufällig das
  Richtige, nämlich `undefined` (beim Lesen der Datei in Paket 6 aufgefallen), Severity
  low → Scope, dritter Fall derselben Sorte: ein `!`, das eine Prüfung ersetzt, statt
  eine Invariante festzuhalten.
  Zug 0 von Paket 7: in den Detailplan aufgenommen, Schritt 9. Der Eintrag hat dieselbe
  Ursache wie das ganze Paket und steht in einer Datei, die dessen Umbau ohnehin öffnet —
  ihn dafür bis zur Drain-Runde liegen zu lassen hieße, `texture/` ein zweites Mal
  aufzuschlagen. Mit Paket 7 (ac64b5a) erledigt: `frame()` bindet die
  `frameId`, prüft sie auf `!= null` und liefert sonst `undefined`; der Rückgabetyp ist
  unverändert geblieben
- [x] `packages/twopoint5d/src/texture/TextureAtlas.ts:12` — `TextureAtlasFrameName` steht
  in sechs öffentlichen Signaturen und im generierten
  `dist/lib/texture/TextureAtlas.d.ts:8`, ist aber weder exportiert noch in
  `texture/public-api.ts` aufgeführt; Konsumenten können den Typ nicht benennen (beim
  Lesen der Datei in Paket 6 aufgefallen), Severity low → Rückfrage. Der Befund ist
  zweierlei zugleich, und die Scope-Regel entscheidet ihn nicht: als Defekt der
  öffentlichen API schickt sie ihn ins Audit, als Defekt der veröffentlichten
  Typoberfläche — genau dessen, was `checkPkgTypes` und `lintPkg` bewachen — hält sie ihn
  im Lauf. Fällig wird die Frage spätestens in der Drain-Runde des Abschlusses.
  Paket 7 ist unabhängig darauf gestoßen und zählt heute acht statt sechs Signaturen
  (`frame()`, `frameId()`, `frameNames()`, `randomFrameName()`, `randomFrameNames()`);
  `checkPkgTypes` schlägt nicht an, weil der Alias strukturell `string | symbol` ist. Die
  Frage bleibt dieselbe, ihr Gewicht ist gewachsen
  Zug 0 von Paket 14: in den Detailplan aufgenommen, Schritt 4. Der Alias steht heute in
  fünf öffentlichen Methoden (`frame`, `frameId`, `frameNames`, `randomFrameName`,
  `randomFrameNames`) an sechs Typpositionen — die Zahl acht aus Paket 7 zählt die beiden
  internen Verwendungen an `TextureAtlas.ts:14` und `:23` mit. `texture/public-api.ts`
  braucht keine Zeile: es führt `TextureAtlas.js` bereits mit `export *`
  Erledigt mit Paket 14; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:27` — `#cols` wird im
  Setter `tileIds` aus `tileIds[0].length` genommen, also aus der ersten Zeile allein. Bei
  einem Muster mit ungleich langen Zeilen liefert `getTileIdAt()` für die kürzeren
  `undefined` unter einer Signatur, die `number` verspricht, und `getTileIdsWithin()`
  schreibt entsprechend kurze Zeilen in den `Uint32Array`. Weder Konstruktor noch Setter
  prüfen die Rechteckigkeit, und keine Spec deckt den Fall ab (beim Lesen der Datei in
  Paket 7 aufgefallen), Severity low → Audit. Die Scope-Regel schickt reine Code-Findings
  unbesehen ins Audit, und das ist eines: kein Bezug zu Aufbau, Build, Konfiguration oder
  Test-Harness. Paket 7 hält die Stelle als Invariante fest, statt sie zu prüfen — die
  Zeilenzugriffe dort bekommen ein `!` mit ebendieser Begründung, und der Befund ist genau
  die Lücke, die dieses `!` offen lässt
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/utils/Dependencies.ts:90` — eine Abhängigkeit, die ohne
  Callbacks deklariert ist, meldet **nie** eine Änderung. Die Bedingung lautet
  `curValue !== nextValue && callbacks?.equals?.(curValue, nextValue) === false`; fehlen die
  Callbacks, ergibt der rechte Teil `undefined === false`, also `false`, und `equals()` läuft
  durch. `src/map2d/CameraBasedVisibility.ts:90,91` deklariert `'depth'` und `'lookAtCenter'`
  genau so — eine Änderung an beiden invalidiert den Kachelsatz nicht.
  `src/utils/Dependencies.spec.ts:16` deckt nur den Gleichheitsfall ab (beim Lesen der Datei
  in Paket 7 aufgefallen), Severity medium → Audit. Die Scope-Regel schickt reine
  Code-Findings unbesehen ins Audit, und das ist eines: ein Funktionsfehler im
  Bibliothekscode ohne Bezug zu Aufbau, Build, Konfiguration oder Test-Harness
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:110` — `#tileBoxPool` wird nie
  geräumt. Eine weit reisende Kamera sammelt je besuchter Kachelkoordinate dauerhaft eine
  `TileBox` samt `Box3`, `Vector3` und `Map2DTileCoords` an; der Pool wächst monoton über die
  Lebenszeit der Map (beim Lesen der Datei in Paket 7 aufgefallen), Severity medium → Audit,
  reines Code-Finding
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:59-62` — Bibliothekscode
  greift per `document.querySelector('.map2dCoords')` ins Wirtsdokument und schreibt Text
  hinein, mit einem eigenen `// TODO remove this!` daneben. Eine Bibliothek, die auf einen
  CSS-Klassennamen im fremden Dokument zielt, ist an dieser Stelle keine Bibliothek mehr
  (beim Lesen der Datei in Paket 7 aufgefallen), Severity low → Audit, reines Code-Finding
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/controls/InputControlBase.ts:32-42` — `get isActive` liefert
  `#active && #listeners.length > 0`, der Setter routet nur nach `subscribe()` und
  `unsubscribe()`. `ctrl.isActive = true` auf einem Control ohne Listener lässt den Getter
  deshalb auf `false` stehen: was man setzt, liest man nicht zurück. Dazu hat
  `unsubscribe()` keinen `if (this.#active)`-Wächter, `subscribe()` schon (beim Lesen der
  Datei in Paket 7 aufgefallen), Severity low → Audit, reines Code-Finding
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:38` — das öffentliche
  `readonly`-Feld heißt `cammeraBasedVisibility`. Ein Tippfehler in der öffentlichen API,
  den nur ein Breaking Change wieder loswird (beim Lesen der Datei in Paket 7 aufgefallen),
  Severity low → Audit, Defekt der öffentlichen API
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro:56` —
  `atlas.frame(name).coords` ohne Prüfung. `frame()` gibt seit jeher
  `TextureAtlasFrame | undefined`; die Lookbook-App wird nicht unter `strictNullChecks`
  geprüft, der Zugriff bricht also erst, wenn jemand einen Namen tippt, den der Atlas nicht
  führt (beim Review von Paket 7 aufgefallen), Severity low → Audit, reines Code-Finding.
  Zug 0 von Paket 8: der Satz über die fehlende Prüfung bleibt für **diese** Datei richtig,
  auch nachdem Paket 8a beide Schalter in die Root-`tsconfig.json` legt. Der Grund ist ein
  anderer als bisher angenommen: die Lookbook-App erbt die Schalter dann sehr wohl, aber
  ihre 36 `.astro`-Dateien sieht kein Compiler — `astro build` transpiliert ohne Typprüfung
  (am 2026-09-04 mit beiden Schaltern gemessen: `pnpm build` läuft über beide Projekte auf
  `exit=0` durch), und `astro check` ist im Workspace nicht installierbar (eigener Eintrag
  weiter unten). Die 22 `.ts`-Dateien der App prüft Paket 8a mit; ihre zehn Fundstellen
  gehören dorthin. Diese hier gehört nicht dazu und bleibt → Audit.
  Zug 0 von Paket 11: das Urteil kippt auf **→ Scope**, weil die Voraussetzung fällt, auf der
  es stand. Paket 11a installiert `@astrojs/check` und hängt es ins Gate; die Stelle ist
  eine der 96, die es dabei aufdeckt (`astro check` meldet sie als TS2532), und ein Gate,
  das eine bekannte Stelle rot lässt, kommt nicht ins `pnpm run ci`. Sie geht also nicht ins
  Audit, sondern mit den übrigen 95 durch **Paket 11a**. Der Sachverhalt selbst steht
  unverändert.
  Zug 0 von Paket 11a: im Detailplan aufgenommen, Schritt 11. Am 2026-09-04 nachgesehen,
  dass die Invariante trägt: die Namen kommen aus `atlas.frameNames(/numbers32/)`, und
  `frameNames()` liefert Schlüssel der atlas-eigenen Namensmap
  (`packages/twopoint5d/src/texture/TextureAtlas.ts:60-67`)
  Erledigt mit Paket 11a; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:29` — `tileSet.add(renderable)`
  steht im `if`-Zweig und drei Zeilen darunter noch einmal unbedingt; der erste Aufruf ist
  tot (beim Lesen der Datei in Paket 7 aufgefallen), Severity info → Audit
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/map2d/Map2D.ts:30` — `if (this.#tileStreamer)` steht
  unmittelbar nach der Zuweisung auf `:24`, das Feld ist nicht optional und immer belegt.
  Der Zweig kann nicht falsch werden und zählt als ungedeckt in die Coverage (beim Lesen der
  Datei in Paket 7 aufgefallen), Severity info → Audit
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:8-19` und
  `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:9-20` — der Typ `TileBox` steht
  zweimal im selben Verzeichnis, strukturgleich, beide nicht exportiert. Dazu zwei kleinere
  Fundstellen derselben Machart: `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:141`
  trägt ein `atlas.frame(frameName)!` ohne den Satz, der die Invariante benennt, und
  `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts:56` ein überflüssiges `!`
  unmittelbar nach der Zuweisung im `if` darüber (beim Lesen der Dateien in Paket 7
  aufgefallen), Severity info → Audit, reine Wartbarkeit im Bibliothekscode
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts` und
  `initializeInstancedAttributes.ts` — bis auf drei Konstruktoraufrufe Zeile für Zeile
  dieselbe Funktion; jede Korrektur muss zweimal gemacht werden, wie in Paket 6 eben
  zwölf Fundstellen zweimal (beim Beheben ebendieser Fundstellen aufgefallen), Severity
  info → Audit. Reine Wartbarkeit im Bibliothekscode, ohne Bezug zu Aufbau, Build,
  Konfiguration oder Test-Harness — die Scope-Regel greift nicht
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `apps/lookbook/package.json:22` — das Script `astro:check` lässt sich in diesem
  Workspace nicht ausführen: `@astrojs/check` steht in keinem Manifest, und ein Aufruf
  bleibt bei »Astro requires the following dependency to be installed« interaktiv stehen.
  Damit prüft heute nichts die Typen der App: `astro build` transpiliert ohne Typprüfung,
  kein Nx-Target ruft `astro:check`, und `pnpm run ci` kennt es nicht. Die 36 `.astro`- und
  22 `.ts`-Dateien der App laufen ungeprüft (beim Ausmessen der Reichweite des globalen
  Schalters in Paket 8 aufgefallen), Severity low → Scope. Bestand schon vor diesem Lauf;
  Paket 8a legt die Schalter darüber und nimmt die `.ts`-Fundstellen mit, die `.astro`-Seite
  bleibt offen. Ein Paket dafür schneidet die Drain-Runde.
  Zug 0 von Paket 8a: die `.ts`-Hälfte bekommt dort nicht nur ihre zehn Korrekturen,
  sondern auch ein Gate — die App bekommt ein eigenes `typecheck`-Target
  (`tsc -p apps/lookbook/tsconfig.json`, `dependsOn: ["^build"]`), das mit `pnpm typecheck`
  in `pnpm run ci` mitläuft. Das ist keine Aufnahme des Nebenbefunds in das Paket, sondern
  die Schranke für dessen eigene Änderung: zehn Fehler zu beheben, die kein Gate danach
  bewacht, wäre derselbe Schalter über demselben Loch. Am 2026-09-04 nachgemessen, dass es
  ohne `@astrojs/check` trägt: `tsc -p apps/lookbook/tsconfig.json` läuft heute auf
  `exit=0`, sieht 25 Dateien und kommt auch ohne das generierte `apps/lookbook/.astro/`
  aus. Was danach offen bleibt, ist nur noch die `.astro`-Seite — 36 Dateien, die kein
  Compiler erreicht, und für die die Drain-Runde ihr Paket schneidet.
  Zug 0 von Paket 11: die Zeilennummer `:22` gab es nie — das Script steht heute auf
  `apps/lookbook/package.json:14` und stand bei `ba44e8e` auf 13; die 22 traf dort
  `@tailwindcss/vite`. Wichtiger als die Nummer ist die Größe, die bisher niemand gemessen
  hatte: am 2026-09-04 mit einem `@astrojs/check@0.9.10` aus einem Probe-Workspace gegen den
  echten Baum gefahren, meldet `astro check` **96 Fehler in 22 der 36 `.astro`-Dateien** (58
  Dateien gesehen, also beide Hälften der App). Das Paket der Drain-Runde ist damit keine
  Manifestzeile, sondern eine Runde von der Größe der Pakete 6 bis 8, und Paket 11 zerfällt
  daran in zwei: die Dependencies bleiben bei 11, das Gate wandert nach **Paket 11a**. Die
  Zahlen und ihre Aufschlüsselung stehen dort.
  Zug 0 von Paket 11a: im Detailplan aufgenommen, Schritte 1 und 3. Die 96 sind am
  2026-09-04 gegen `ff29f29` im echten Baum nachgemessen — Datei für Datei und Fehlercode
  für Fehlercode dieselben wie in der Zählung aus Paket 11, und der Lauf braucht dafür
  weder drei Sekunden noch das generierte `apps/lookbook/.astro/`. Neu entschieden ist die
  Gestalt des Gates: `astro check` tritt **nicht** neben `tsc`, sondern an seine Stelle.
  Gemessen an einer Probedatei mit zwei Fehlern in `apps/lookbook/src/` meldet es dieselben
  `.ts`-Diagnosen wie `tsc -p tsconfig.json` und sieht zusätzlich die 36 `.astro`-Dateien;
  zwei Prüfer über denselben Dateien, die sich nur einig sein können, sind einer zu viel
  Erledigt mit Paket 11; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:6,12` — die Interfaces
  `BufferAttribute` und `Buffer` sind nicht exportiert, stehen aber in drei öffentlichen
  `readonly`-Feldern von `VertexObjectBuffer` (`buffers`, `bufferAttributes`,
  `bufferNameAttributes`) und landen so im veröffentlichten
  `dist/lib/vertex-objects/VertexObjectBuffer.d.ts:3,8`. Ein Konsument kann die Typen nicht
  benennen; `checkPkgTypes` schlägt nicht an. `BufferAttribute` verdeckt dabei zusätzlich
  den gleichnamigen three.js-Typ, den dieselbe Datei nebenan meint (beim Lesen der Datei in
  Paket 8 aufgefallen), Severity low → Rückfrage — **dieselbe** Frage wie beim Eintrag zu
  `TextureAtlasFrameName` weiter oben, und aus demselben Grund unentscheidbar an der
  Scope-Regel: Defekt der öffentlichen API und Defekt der veröffentlichten Typoberfläche in
  einem. Beide gehören zusammen entschieden, in der Drain-Runde des Abschlusses.
  Zug 0 von Paket 8a: Paket 8a fasst `Buffer.typedArray` an und ändert damit eine Zeile in
  genau diesem `.d.ts`, ohne die Frage zu beantworten — ein Konsument sieht die Änderung
  im veröffentlichten Typ und kann den Typ weiterhin nicht benennen. Das Gewicht der Frage
  wächst dadurch ein zweites Mal; die Adresse bleibt die Drain-Runde
  Zug 0 von Paket 14: in den Detailplan aufgenommen, Schritt 3. Beide werden umbenannt,
  nicht nur `BufferAttribute` — `Buffer` verdeckt den globalen Node-Typ aus demselben
  Grund, aus dem `BufferAttribute` den three.js-Typ verdeckt, und zwei Deklarationen vier
  Zeilen auseinander, von denen nur eine umbenannt wird, lesen sich wie ein Versehen. Sie
  heißen künftig `AttributeBuffer` und `AttributeBufferLayout`.
  `vertex-objects/public-api.ts` braucht keine Zeile: es führt `VertexObjectBuffer.js`
  bereits mit `export *`
  Erledigt mit Paket 14; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `apps/lookbook/src/demos/animated-sprites/BouncingSprites.ts:47` und
  `apps/lookbook/src/demos/animated-billboards/BouncingSprites.ts:58` — beide binden
  `this.spritePool.createVO() as Sprite`. Der Cast verschluckt das `undefined`, das
  `createVO()` bei erreichter Kapazität liefert, und hält den Compiler von genau der Stelle
  fern, die das neue `typecheck`-Target der App sonst gemeldet hätte. In der
  `animated-sprites`-Variante fängt `createSprites()` den Fall zwei Zeilen vorher ab
  (39-44), in der `animated-billboards`-Variante niemand (beim Beheben der zehn
  Lookbook-Fundstellen in Paket 8a aufgefallen; gegen `ba44e8e` nachgesehen, beide Casts
  standen schon vor dem ersten Commit dieses Laufs), Severity low → Scope. Begründung des
  Urteils: dieselbe wie beim Eintrag zu `VOBufferPool.ts:90` weiter oben — keine beliebige
  Code-Stelle, sondern eine Ausweichklappe an genau dem Gate, das Paket 8a über diese App
  legt. Bleibt sie stehen, ist das erste Typ-Gate des Lookbooks an seiner einzigen
  gefährlichen Stelle blind
  Zug 0 von Paket 13: in den Detailplan aufgenommen, Schritt 5, und dabei zweimal korrigiert.
  Die beiden Zeilen heißen seit `a4bfe10` **46 und 57**, nicht 47 und 58. Und es ist nicht die
  einzige gefährliche Stelle: `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts:56`
  trägt dasselbe `createVO() as BounceSprite`, ebenfalls ohne Kapazitätsprüfung davor und
  ebenfalls seit `ba44e8e` unverändert. Alle drei bekommen `as … | undefined` samt Wächter;
  der Pool wird **nicht** umtypisiert, weil der Cast neben der falschen Behauptung eine
  richtige trägt (die Demos hängen `speedX` und Nachbarn zur Laufzeit an), und die gehört
  nicht in den Typparameter der Bibliothek
  Erledigt mit Paket 13; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `packages/twopoint5d/project.json:16` und `apps/lookbook/project.json:16` — die
  `inputs` der beiden `typecheck`-Targets führen `{projectRoot}/package.json` nicht; wer
  das Script `typecheck` selbst ändert, bekommt einen Cache-Treffer auf die alte
  Kommandozeile. Dasselbe Loch tragen `build` und `test` in
  `packages/twopoint5d/project.json`, es ist also älter als diese beiden Zeilen — Paket 8a
  setzt ein bestehendes Muster fort, statt es zu erzeugen (im Review von Paket 8a
  aufgefallen), Severity low → Scope. Gehört in einen Durchgang über **alle** Targets, nicht
  über zwei; die Drain-Runde hat sie nebeneinander.
  Zug 0 von Paket 11a: die zweite Fundstelle steht auf `apps/lookbook/project.json:17`,
  nicht auf 16 — dort steht das `dependsOn`. Paket 11a fasst genau diese `inputs`-Zeile an
  und hängt `.astro`, `.json` und die Astro-Config hinein, lässt `{projectRoot}/package.json`
  aber liegen: der Eintrag hier will einen Durchgang über alle Targets, und den fährt
  Paket 12. Nach 11a ist die Zeile länger und steht tiefer; wer sie sucht, sucht nach
  `inputs`
  Zug 0 von Paket 12: in den Detailplan aufgenommen, Schritt 4 — der geforderte Durchgang über
  alle Targets ist dieser Durchgang, aber er endet bei zweien. `build` führt den benannten
  Input `makePackageJson` (`nx.json:53`) und `test` den Input `vitestDefaults` (`nx.json:63`),
  und beide beginnen mit `{projectRoot}/package.json`; `twopoint5d-testing:test` fährt auf
  `default`, und `lookbook:build` hat gar keine eigenen `inputs`. Am 2026-09-04 im echten Baum
  gemessen: eine Änderung an einem beliebigen Script in `packages/twopoint5d/package.json`
  lässt `nx build twopoint5d` von einem Cache-Treffer auf `0/1 hit` fallen, während
  `nx typecheck twopoint5d` weiter aus dem Cache liest und die alte Kommandozeile ausführt.
  Der Befund stimmt, sein Umfang war zu groß angesetzt
  Erledigt mit Paket 12; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `AGENTS.md:29` — die Zeile beschreibt `pnpm run ci` als »(Clean install, lint, build,
  test)« und lässt damit `typecheck`, `checkPkgTypes` und `lintPkg` aus. Sie war schon vor
  diesem Lauf unvollständig; Paket 8a macht sie um einen weiteren Schritt unvollständiger
  (im Review von Paket 8a aufgefallen), Severity low → Scope, gehört in Paket 10 — dieselbe
  Ursache wie der Eintrag zu `engines.node` ganz oben, und dasselbe Argument, mit dem
  `CLAUDE.md` und `README.md:85` in diesem Paket nachgezogen wurden: eine Zeile, die eine
  Kette aufzählt und Schritte auslässt, ist als Ganzes falsch.
  Erledigt mit Paket 10 (`88f994d`): die Zeile nennt jetzt alle acht Glieder
- [x] `apps/lookbook/src/components/LookBookApi.ts:56` — `getMetadataForDemos()` ist
  exportiert und hat im ganzen Repo keinen Aufrufer, auch in keiner der 36 `.astro`-Dateien;
  mit ihr ist auch `LookBookMetadata` ohne Gebrauch. Toter Export samt seinem Typ (beim
  Beheben der Lookbook-Fundstellen in Paket 8a aufgefallen; gegen `ba44e8e` nachgesehen,
  stand schon vor dem ersten Commit dieses Laufs), Severity info → Audit. Reine Wartbarkeit
  in App-Code, ohne Bezug zu Aufbau, Build, Konfiguration oder Test-Harness — die
  Scope-Regel greift nicht
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:90` — der Guard
  `if (this.buffer != null)` in `dispose()` ist tot: `buffer` ist als
  `VertexObjectBuffer` deklariert und der Konstruktor setzt es auf beiden Zweigen. Der
  globale Schalter macht die Stelle sichtbar, falsch war sie vorher auch (beim Anfassen der
  Datei in Paket 8a aufgefallen; gegen `ba44e8e` nachgesehen, dort Zeile 88, unverändert),
  Severity info → Audit. Reine Wartbarkeit im Bibliothekscode; nicht zu verwechseln mit dem
  Eintrag zu `VOBufferPool.ts:90` weiter oben, der den Typ von `typedArray` betraf und mit
  diesem Paket erledigt ist — beide Sachverhalte teilen die Datei, nicht die Ursache
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/README.md:24,29,30,31,50,56,63` — sieben Verweise ins Leere in
  der Datei, die npmjs.com als Startseite des Pakets anzeigt. Vier zeigen in einen
  `docs/`-Baum, den `37887ba` entfernt hat (`../../docs/Map2D.md` zweimal,
  `../../docs/VertexObjects-legacy.md`, `../../docs/Stage2D.md`, `../../docs/Display.md`),
  zwei nennen Verzeichnisse falsch: die Überschrift »tiled-maps« verlinkt `src/tiled-maps/`,
  das Modul heißt `map2d/`, und »texture atlases and tilesets« verlinkt
  `src/vertex-objects/` statt `src/texture/`. Bei `ba44e8e` zeilengleich vorhanden, also
  vorbestehend (in Zug 0 von Paket 10 aufgefallen, beim Abgleich der `tiled-maps`-Fundstellen
  aus CONS-001), Severity low → Scope. Die Scope-Regel nennt »Agenten- und
  Setup-Dokumentation«, und eine Feature-Übersicht ist beides nicht; ausgeschlossen sind
  nach derselben Regel aber ausdrücklich nur reine Code-Findings, und das hier ist keins.
  Die Auslegung geht deshalb in die Richtung, die den Befund im Lauf hält statt ihn
  hinauszubuchen — Paket 10 nimmt ihn trotz gemeinsamer `docs/`-Herkunft nicht mit, weil
  dort eine Konfigurationszeile fällt und hier eine halbe Seite Prosa neu geschrieben wird
  Zug 0 von Paket 12: in den Detailplan aufgenommen, Schritt 5, alle sieben Zeilennummern
  unverändert. Eine Korrektur: npmjs.com zeigt diese Datei **nicht**.
  `scripts/publishNpmPkg.mjs:54-60` kopiert `README-pkg.md` nach `dist/README.md`, und dessen
  neun Zeilen tragen drei absolute GitHub-Links, alle intakt. Getroffen ist, wer auf GitHub in
  `packages/twopoint5d/` landet — der Befund bleibt, seine Begründung wandert. Zwei der sieben
  werden umgelenkt statt gestrichen: 56 und 63 zeigen künftig auf
  `packages/twopoint5d/src/stage/README.md`, das `Display`, `Stage2D` und `StageRenderer`
  gemeinsam beschreibt. Die Überschrift in 29 wird dabei mit umbenannt — `tiled-maps` ist der
  Modulname, den Paket 10 aus `AGENTS.md` und `CLAUDE.md` genommen hat
  Erledigt mit Paket 12; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `tsconfig.json:19` (Root) — `"jsx": "react-jsx"` ist die letzte Spur von React in der
  Konfiguration des Workspace. Es gibt im ganzen Repo keine `.tsx`- und keine `.jsx`-Datei,
  und mit Paket 11 verlässt auch die Abhängigkeitskette die App; die Zeile richtet danach
  einen Compiler auf eine Sprache aus, die niemand schreibt (in Zug 0 von Paket 11 beim
  Ausmessen der React-Kette aufgefallen; bei `ba44e8e` zeilengleich vorhanden, also
  vorbestehend), Severity info → Scope. In **Paket 11** aufgenommen, Schritt 5: dieselbe
  Ursache wie die sechs Manifestzeilen — sie steht dort, weil React dort stand. Am
  2026-09-04 im Probe-Workspace ohne die Zeile gemessen: `pnpm build`, `pnpm typecheck`,
  `pnpm lint`, `checkPkgTypes`, `lintPkg` und `test:ci` bleiben grün, und `astro check`
  meldet Fehler für Fehler dieselben wie mit ihr
  Mit Paket 11 (`ff29f29`) erledigt: die Root-`tsconfig.json` führt keine `jsx`-Einstellung mehr.
- [x] `packages/twopoint5d/src/display/types.ts:17` — `DisplayRendererParameters` ist leer.
  Die Ableitung `Partial<Omit<ConstructorParameters<typeof WebGPURenderer>[0], 'canvas'>>`
  greift auf einen **optionalen** Konstruktorparameter zu, `ConstructorParameters<…>[0]` ist
  damit `WebGPURendererParameters | undefined`, und `keyof` einer Union mit `undefined` ist
  `never` — `Omit` liefert `{}`. Am 2026-09-04 an einer `tsc`-Probe belegt: `keyof
  DisplayRendererParameters` ist `never`. Wirkung: `DisplayParameters` nimmt aus TypeScript
  **keinen einzigen** Renderer-Parameter an — nicht `antialias`, nicht `forceWebGL`, nicht
  `powerPreference` —, während `Display` sie zur Laufzeit an den `WebGPURenderer`
  durchreicht (`src/display/Display.ts:337-346`). Ein `Display`-Aufruf mit Renderer-Optionen
  ist von außen nur noch mit Cast schreibbar. Seit `d511891` so, also vorbestehend (in Zug 0
  von Paket 11 beim Ausmessen der `.astro`-Fehler aufgefallen — `display-multi.astro:99`
  ist die eine Fundstelle im Repo, die es aufdeckt), Severity medium → Scope. Begründung des
  Urteils: die Scope-Regel schickt reine Code-Findings ins Audit, und ohne diesen Lauf wäre
  das hier eines. Es ist aber zugleich das, was das neue Gate aus Paket 11a nicht schließen
  lässt: entweder fällt der Einzeiler, oder eine Demo verliert ihre Backend-Umschaltung, um
  einen Compilerfehler loszuwerden. Dasselbe Argument hat der Lauf für `VOBufferPool.ts:90`
  und für die beiden `createVO() as Sprite` schon zweimal angenommen. Gehört in **Paket 11a**;
  `NonNullable<…>` um den Zugriff herum genügt, am 2026-09-04 gemessen: `pnpm typecheck` und
  `checkPkgTypes` bleiben grün, und `astro check` verliert genau diesen einen Fehler.
  Zug 0 von Paket 11a: im Detailplan aufgenommen, Schritt 2. Der Sachverhalt steht
  unverändert. An einer `tsc`-Probe im Baum nachgerechnet, was der Zusatz einbringt: `keyof`
  geht von `never` auf 17 Namen — `forceWebGL`, `antialias`, `powerPreference`, `alpha`,
  `depth`, `stencil`, `samples`, `device`, `context`, `multiview`, `requiredLimits`,
  `trackTimestamp`, `getFallback`, `outputType`, `outputBufferType`,
  `logarithmicDepthBuffer`, `reversedDepthBuffer` —, und `canvas` bleibt draußen
  Erledigt mit Paket 11a; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `apps/lookbook/src/components/TagCloudFilter.astro:129,179,182`,
  `apps/lookbook/src/components/DemoNavBar.astro:162`,
  `apps/lookbook/src/components/SearchLookbook.astro:65` und
  `apps/lookbook/src/pages/demos/animated-billboards.astro:118` — sechs Stellen führen den
  Compiler an einer DOM-Abfrage vorbei, die fehlschlagen kann. Viermal steht ein Cast
  unmittelbar auf dem Ergebnis von `querySelector()` und verschluckt dessen `| null`:
  `as HTMLButtonElement` in `TagCloudFilter`, je ein `as HTMLDialogElement` in `DemoNavBar`
  und `SearchLookbook`, ein `as HTMLDivElement` in `animated-billboards`. Dazu nimmt ein
  `(event: any)` als Handler-Parameter (`TagCloudFilter.astro:179`) die zwölf Zeilen
  darunter samt `$tag.parentNode.parentNode as HTMLElement` (`:182`) ganz aus der Prüfung.
  Keine der sechs erzeugt einen der 96 Fehler, die Paket 11a abarbeitet — sie verhindern
  ihn gerade (in Zug 0 von Paket 11a beim Abgleich der `.astro`-Fundstellen aufgefallen;
  gegen `ba44e8e` einzeln nachgesehen, alle sechs standen schon vor dem ersten Commit
  dieses Laufs), Severity low → Scope. Begründung des Urteils: dieselbe, die der Lauf für
  `VOBufferPool.ts:90` und für die beiden `createVO() as Sprite` schon zweimal angenommen
  hat — keine beliebigen Code-Stellen, sondern Ausweichklappen an genau dem Gate, das
  Paket 11a über diese App legt. An **Paket 13** adressiert, nicht an 11a: dort steht der
  Eintrag zu den beiden `createVO() as Sprite`, und das ist dieselbe Ursache — eine
  Prüfung, die schwächer ist, als sie aussieht. Paket 11a fasst die sechs ausdrücklich
  nicht an; ein Gate zu bauen und im selben Zug die Klappen daneben zuzuschweißen wären
  zwei Aufträge in einem Commit
  Zug 0 von Paket 13: in den Detailplan aufgenommen, Schritte 6 und 7. Die drei Zeilen in
  `TagCloudFilter.astro` heißen seit `c3c8edb` **132, 187 und 190**, die in
  `animated-billboards.astro` **119**; `DemoNavBar.astro:162` und `SearchLookbook.astro:65`
  stehen unverändert. Die vier Casts werden zu `querySelector<T>(…)!` mit je einem Satz zur
  Invariante — alle vier Elemente stehen in der Markup-Hälfte derselben Datei, und genau
  diese Form steht in `DemoNavBar.astro` und `SearchLookbook.astro` seit Paket 11a eine Zeile
  darunter bereits da. Das `(event: any)` entfällt ersatzlos, sobald `$tagCloud` als
  `querySelectorAll<HTMLElement>` gelesen wird; `$tag.parentNode.parentNode as HTMLElement`
  weicht `$el.parentElement!`, was nachgesehen derselbe Knoten ist
  Erledigt mit Paket 13; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro:47` —
  `const sample = (arr: any) => arr[…]` führt den Compiler an der ganzen Kette vorbei:
  `texCoords` in Zeile 78 ist dadurch `any`, und die vier Zugriffe `.s/.t/.u/.v` prüft
  niemand. Ein `<T>(arr: T[]) => T` kostet nichts und bindet die Rückgabe an
  `TextureCoords` (in Paket 11a beim Lesen der Datei aufgefallen; bei `ba44e8e` wortgleich
  vorhanden), Severity low → Scope, gehört zu **Paket 13**: dieselbe Ursache wie die sechs
  DOM-Casts und die beiden `createVO() as Sprite` — eine Zusicherung, die schwächer ist,
  als sie aussieht
  Zug 0 von Paket 13: in den Detailplan aufgenommen, Schritt 8, Zeilennummer unverändert. Der
  vorgeschlagene `<T>(arr: T[]) => T` ist in einem `.astro`-`<script>` nicht schreibbar —
  `astro check` meldet dort `ts(7060)`, gemessen im Probe-Baum; es wird deshalb eine
  `function`-Deklaration statt eines Pfeils, und das Element bekommt unter
  `noUncheckedIndexedAccess` ein `!` mit dem Satz zur Invariante
  Erledigt mit Paket 11a; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro:100` —
  `console.log('texCoords', …)` steht im Rumpf der inneren Schleife und feuert bei
  16 × 32 Quads 512-mal pro Seitenaufruf. Die übrigen Demos loggen einmal nach dem Aufbau
  (in Paket 11a beim Lesen der Datei aufgefallen; bei `ba44e8e` an derselben Stelle),
  Severity low → Audit: eine Fundstelle in Demo-Code, die weder Build, Konfiguration,
  Test-Harness noch Setup-Dokumentation berührt
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `apps/lookbook/src/components/SearchLookbook.astro:9` — der Button verspricht
  »Ctrl K«, aber in der Datei steht kein `keydown`-Handler; geöffnet wird der Dialog
  ausschließlich per Klick. Das Label ist eine Zusage, die der Code nicht einlöst — die
  Suche selbst ist mit »TODO search lookbook« (Zeile 24) ohnehin als unfertig markiert (in
  Paket 11a beim Lesen der Datei aufgefallen; bei `ba44e8e` an derselben Stelle),
  Severity low → Audit: eine Feature-Lücke der App, kein Projektaufbau
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/stage/README.md:22-25,239,255,302`,
  `packages/twopoint5d/src/stage/StageRenderer.ts:380,423` und
  `packages/twopoint5d/src/stage/StageRenderer.spec.ts:323,343,439` — die Marker `§3.2`,
  `§6.2`, `§6.3` und `§6.4` nummerieren Abschnitte eines Dokuments, das es nicht mehr gibt:
  `Backlog-StageRenderer.md`, mit `1b5698e` in die `audit.html` konsolidiert. Anders als die
  vier Stellen, die die Datei beim Namen nennen und die Paket 12 mitnimmt, schicken diese
  Marker niemanden ins Leere — die README trägt die Nummern in ihren eigenen Überschriften
  (»Mode C (§6.4)«, »Mode D (§6.2)«, »Mode E (§6.3)«), sie lesen sich damit als
  Modus-Kennungen. Ein stehengebliebenes Etikett ist etwas anderes als ein toter Link, und
  die Ablösung hieße, ein Dokument von 450 Zeilen samt drei `describe`-Namen umzunummerieren
  (in Zug 0 von Paket 12 aufgefallen; `1b5698e` liegt vor `ba44e8e`, also vorbestehend),
  Severity info → Scope, mit derselben Auslegung wie beim Eintrag zu
  `packages/twopoint5d/README.md`: ausgeschlossen sind nach der Scope-Regel nur reine
  Code-Findings, und eine Abschnittsnummer ist keins
  Erledigt mit Paket 12; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `packages/twopoint5d/src/stage/StageRenderer.spec.ts:448,576` — die beiden
  `toThrowError(...)` sind der von Vitest als deprecated markierte Alias von `toThrow`; der
  Compiler meldet sie als TS6385, ohne dass ein Lauf davon rot wird. Zwei Wörter, beide in
  Zeilen, die Paket 12 nicht angefasst hat (im Zug 2 dieses Pakets beim Lesen der Datei
  aufgefallen; die Zeilen stehen seit `ba44e8e` unverändert, also vorbestehend),
  Severity info → Scope: eine Nutzung der Test-API, kein reines Code-Finding
  Erledigt mit Paket 12; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `apps/lookbook/src/components/TagCloudFilter.astro:233`,
  `apps/lookbook/src/pages/demos/textured-sprites.astro:83` und
  `apps/lookbook/src/pages/demos/display-multi.astro:99,115` — vier `as HTML*`-Casts
  derselben Familie wie die neun, die Paket 13 aufgelöst hat, aber eine Stufe schwächer:
  sie verengen ein `Element` beziehungsweise ein `EventTarget`, verschlucken also keine
  Nullbarkeit, sondern nur die Elementart. Drei davon nähmen ein Typargument an
  (`Array.from(document.querySelectorAll<HTMLElement>(…))`, `querySelectorAll<HTMLElement>`),
  beim vierten — `e.currentTarget as HTMLElement` — ist der Cast die übliche Form, weil die
  DOM-Typen `currentTarget` als `EventTarget | null` führen (im Review von Paket 13
  aufgefallen, bei `ba44e8e` an denselben Stellen vorhanden, also vorbestehend),
  Severity info → Scope: dieselbe Auslegung wie bei den beiden Einträgen darüber, eine
  Typzusicherung in der Lookbook ist keins der vier reinen Code-Themen der Scope-Regel
  Erledigt mit Paket 13; die Fundstelle ist im Baum nachgeprüft (2026-09-04)
- [x] `packages/twopoint5d/src/display/FrameLoop.ts:8,9` — die beiden Symbole der Klasse
  liegen als `Symbol.for('onRAF')` und `Symbol.for('onFrame')` in der globalen
  Symbol-Registry, also unter Schlüsseln ohne jedes Namenspräfix; jede andere Bibliothek
  im selben Realm, die dieselben zwei Allerweltsnamen wählt, bekommt dasselbe Symbol und
  damit denselben Eventkanal. Vier Zeilen weiter in `FixedFrameLoop.ts:6,7` macht dasselbe
  Muster es richtig (`twopoint5d:FixedFrameLoop.OnTick`). Ein Schlüsselwechsel ist eine
  Verhaltensänderung an einer öffentlichen Oberfläche, gehört also nicht nebenbei
  mitgenommen (in Zug 0 von Paket 14 beim Auflösen der Symbole aufgefallen; bei `ba44e8e`
  wortgleich vorhanden, also vorbestehend), Severity low → Audit: ein reines
  Code- und API-Thema, das die Scope-Regel unbesehen weiterschickt
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `package.json:26,27,30` (`checkPkgTypes`, `lintPkg`, `ci`) — kein Schritt des Gates prüft, ob
  die veröffentlichte Typoberfläche von außen benennbar ist. `attw` und `publint` sehen
  jeden dieser Typen strukturell aufgelöst und schweigen; genau deshalb konnten sich 34
  solcher Stellen ansammeln, ohne dass je ein Lauf rot wurde. Der Prüfer dafür ist klein
  und in Zug 0 von Paket 14 als `nameable2.mjs` im Arbeitsverzeichnis bereits geschrieben
  und gemessen: Compiler-API über `dist/lib/index.d.ts`, transitive Hülle, zwei bekannte
  Ausnahmen (statische Klassenmitglieder und über `typeof` erreichte Konstanten). Er wäre
  ein nx-Target neben `checkPkgTypes` und eine Kette in `ci` (im Zug 0 von Paket 14
  aufgefallen, vorbestehend seit es das Gate gibt), Severity low → Scope: Build und
  Konfiguration, ausdrücklich in der Scope-Regel. Paket 14 nimmt ihn **nicht** mit — es
  behebt einen Zustand, das Gate zu erweitern ist eine eigene Entscheidung mit Wirkung auf
  jedes folgende Paket und auf den Abschluss.
  Erledigt mit Paket 16 (`46a9013`): `scripts/checkNameableTypes.mjs` läuft als eigenes
  Target zwischen `checkPkgTypes` und `lintPkg` und steht in `ci`, in `publishNpmPkg`, in
  `AGENTS.md` und in `CLAUDE.md`. Von den zwei Ausnahmen des Eintrags bleibt eine —
  `TextureClasses` mit ihrer Begründung in `ACCEPTED` —, die andere ist eine Regel im
  Wanderer geworden: eine qualifizierte Referenz ist so erreichbar wie ihr linkes Ende.
  Grün gemessen `271 exported symbols, 1 accepted, 0 not nameable`, rot über einen
  Probebaum ohne `export * from './types.js'` acht Namen und `exit=1`

- [x] `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:50-66` — im Zweig
  `source instanceof VertexObjectBuffer` wird das mitgelieferte `buffersData` bis auf die
  Kapazität verworfen: die Puffer werden als frische Nullarrays angelegt, während der
  andere Zweig (Zeile 105) die übergebenen Daten übernimmt. Wer
  `new VertexObjectBuffer(otherBuffer, buffersData)` aufruft, bekommt leere Puffer ohne
  Hinweis (im Zug 2 von Paket 14 beim Lesen der Datei aufgefallen; bei `ba44e8e` an
  denselben Stellen vorhanden, also vorbestehend), Severity medium → Audit: ein reines
  Code-Finding, das die Scope-Regel unbesehen weiterschickt
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts:380` —
  `readDataIdAtLocal` rechnet `y * width + x` ohne Grenzprüfung auf `x`. Der Docblock an
  `readDataIdAt` (Zeile 384) verspricht `undefined` außerhalb des Chunks; für ein `x`
  außerhalb `[0, width)` liefert die Methode aber still den Wert der Nachbarzeile. Nur ein
  `y` außerhalb fällt aus dem Array (im Zug 2 von Paket 14 aufgefallen; bei `ba44e8e`
  wortgleich vorhanden, also vorbestehend), Severity low → Audit: ein reines Code-Finding
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/texture/TextureAtlas.ts:29-38` — `add()` mit einem bereits
  vergebenen Namen überschreibt die Zuordnung im Namensregister still und lässt den alten
  Frame in `#frames` stehen; `FrameBasedAnimations#add` wirft im gleichen Fall (im Zug 2
  von Paket 14 aufgefallen, bei `ba44e8e` vorhanden, also vorbestehend), Severity low →
  Audit: ein reines Code-Finding
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:176` — `animId()` greift mit
  `!` auf einen unbekannten Namen zu und wirft bei einem Tippfehler einen `TypeError` auf
  `undefined`, statt `undefined` zu liefern; die Signatur verspricht `number` (im Zug 2 von
  Paket 14 aufgefallen, bei `ba44e8e` vorhanden, also vorbestehend), Severity low → Audit:
  ein reines Code- und API-Thema
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:426-434` —
  `touch()` verschmilzt alle Objekt-Argumente per Spread in eines. Werden ein
  `TouchBuffersType` und ein `TouchInstancedBuffersType` gemischt übergeben, enthält das
  Ergebnis `base`/`instanced`, `touchBuffers()` nimmt den ersten Zweig, und die flachen
  Usage-Keys fallen still unter den Tisch (im Zug 2 von Paket 14 aufgefallen, bei `ba44e8e`
  vorhanden, also vorbestehend), Severity low → Audit: ein reines Code-Finding
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/vertex-objects/selectBuffers.ts:5-9` — schreibt
  `{[Type in VertexAttributeUsageType]?: boolean}` weiterhin inline aus, als Parametertyp
  genau der Funktion, die beide Geometrie-Klassen mit ihrem `TouchBuffersType` aufrufen.
  Paket 14 hat die beiden anderen Vorkommen derselben Form in
  `vertex-objects/types.ts:22` zusammengeführt; ein `import type {TouchBuffersType} from
  './types.js'` würde die dritte Kopie ablösen (im Review von Paket 14 aufgefallen, bei
  `ba44e8e` an derselben Stelle vorhanden, also vorbestehend), Severity info → Audit: ein
  reines Code-Finding
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:24`
  (`AnimationTimingOptions`) und `packages/twopoint5d/src/texture/types.ts:22`
  (`FrameBasedAnimationsTimingData`) — wörtlich derselbe Typ, zweimal deklariert, seit
  Paket 14 beide als Export im Barrel von `texture/`. Sie kollidieren nicht, es sind aber
  zwei Namen für eine Sache; die Zusammenlegung berührt zwei öffentliche Oberflächen und
  gehört nicht nebenbei mitgenommen (im Zug 2 von Paket 14 aufgefallen, bei `ba44e8e`
  beide vorhanden, also vorbestehend), Severity info → Audit: ein reines Code- und
  API-Thema
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:105` (`(jsonData: any)`) und
  `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:141`
  (`atlas.frameNames(args[3] as any)`) — zwei Stellen, an denen der Compiler nichts mehr
  prüft (im Zug 2 von Paket 14 aufgefallen, bei `ba44e8e` an denselben Stellen vorhanden,
  also vorbestehend), Severity info → Audit: ein reines Code-Finding
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `apps/lookbook/src/demos/passes/fovealVisionEffect.ts` — das Modul ist verwaist: der
  Name `fovealVisionEffect` kommt im ganzen Repo nur in dieser Datei vor, kein Demo, keine
  `.astro`-Seite und keine Demo-JSON importiert ihn. 60 Zeilen TSL-Post-Effekt, die nichts
  bündelt und nichts rendert; Paket 15 repariert seinen Docblock, weil er Code zum
  Herauskopieren anbietet, und lässt die Verwaisung stehen (in Zug 0 von Paket 15
  aufgefallen, bei `ba44e8e` gleichfalls unreferenziert, also vorbestehend), Severity info
  → Audit: eine Fundstelle in Demo-Code, die weder Build, Konfiguration, Test-Harness noch
  Setup-Dokumentation berührt — dieselbe Auslegung wie beim `console.log` in
  `textured-quads-from-tileset.astro`
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `packages/twopoint5d/src/stage/ProjectionPlane.ts:84-86`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:300-324` samt seinen
  beiden auskommentierten Aufrufern in
  `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.spec.ts:85,145`,
  `packages/twopoint5d/src/sprites/node-utils.ts:68-81`,
  `apps/lookbook/src/demos/map2d-cam-visi.ts:43,44,108` und
  `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts:53-55` — fünf
  auskommentierte Codeblöcke, die sich nicht mehr einkommentieren lassen: `getPlaneCoords()`
  gäbe unter `strictNullChecks` ein `Vector2 | undefined` als `Vector2` zurück,
  `toDebugJson()` ist eine 25-Zeilen-Methode ohne Aufrufer, `node-utils.ts` trägt GLSL aus
  der Zeit vor TSL, und die beiden Lookbook-Stellen nennen Bezeichner
  (`RectangularVisibilityAreaHelpers`, `rectVisiArea`, `AABB2`), die ihre Datei nicht
  importiert. Anders als die sechs Stellen aus Paket 15 bietet keine davon dem Leser etwas
  an — sie sind Reste, keine Alternativen, und deshalb hat Paket 15 sie liegen lassen (in
  Zug 0 von Paket 15 bei der vollständigen Durchsicht aller auskommentierten Codestücke
  unter beiden `src/`-Bäumen aufgefallen; alle fünf stehen seit `ba44e8e` unverändert, also
  vorbestehend), Severity info → Audit: reine Wartbarkeit, dieselbe Auslegung wie beim toten
  Guard in `VOBufferPool.ts:90`
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `apps/lookbook/README.md` — die Datei ist der unveränderte Starttext des
  Astro-Templates: sie beschreibt `npm create astro@latest -- --template basics`, zeigt den
  Verzeichnisbaum eines Beispielprojekts, verlinkt StackBlitz und CodeSandbox auf
  `withastro/astro` und enthält den Satz »🧑‍🚀 **Seasoned astronaut?** Delete this file. Have
  fun!«. Über die Lookbook selbst — was sie zeigt, wie man sie startet, wo die Demos liegen
  — steht kein Wort darin (in Zug 0 von Paket 15 bei der Suche nach Code-Blöcken außerhalb
  der beiden `src/`-Bäume aufgefallen; bei `ba44e8e` wortgleich, also vorbestehend),
  Severity low → Scope: die Scope-Regel nennt »Agenten- und Setup-Dokumentation«, und eine
  README, die erklärt, wie man die App startet, ist genau das.
  Erledigt mit Paket 16 (`46a9013`): die Datei handelt jetzt von dieser App — was sie
  zeigt, wie man sie startet (samt der Adresse mit `/lookbook`), was in `src/` liegt, wie
  eine Demo dazukommt und welche Prüfungen sie fährt. `ReactDemo.astro` bleibt
  unerwähnt; die Datei ist unreferenziert und steht als eigener Eintrag in dieser Liste
- [x] Kein Schritt des Gates prüft Beispielcode. `pnpm typecheck` erreicht jede `.ts`- und
  `.astro`-Datei und keinen einzigen der 19 ` ```ts `-Blöcke des Repos; genau daran ist der
  globale Schalter aus Paket 8a vorbeigelaufen, und Paket 15 räumt die Folge davon von Hand
  weg. Ohne einen Wächter verrottet dieselbe Stelle beim nächsten Schalter wieder — Paket 8a
  hat das bereits einmal bewiesen. Ein Wächter ist aber nicht klein: die Blöcke sind
  Auszüge, zwölf der 19 brauchen Bezeichner, die im Text ausdrücklich dem Leser gehören
  (`world`, `myScene`, `canvas`), und ein Extraktor kann die nicht erfinden. Ihn zu bauen
  heißt deshalb, zuerst eine Konvention dafür zu beschließen — Snippets durchweg
  selbsttragend schreiben, oder eine Präambel-Syntax im Docblock einführen, oder Auszüge
  ausklammern und damit den Zweck verlieren. Das ist eine Entscheidung darüber, wie dieses
  Projekt seine Beispiele schreibt, und sie trägt weiter als ein Paket (in Zug 0 von
  Paket 15 aufgefallen, als der Probebaum von Hand gebaut werden musste; die Lücke besteht,
  seit es Beispiele gibt, also vorbestehend), Severity low → Rückfrage: die Scope-Regel
  greift — Build und Test-Harness stehen ausdrücklich darin —, aber der Fix legt dem Projekt
  eine Schreibkonvention für Dokumentation auf und sprengt den Umfang eines Pakets
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
- [x] `apps/lookbook/src/layouts/ReactDemo.astro`,
  `apps/lookbook/src/demos/utils/createFrameLoopComponent.js` und elf Dateien in
  `apps/lookbook/public/images/demo-preview/` — dreizehn Reste der react-three-fiber-Zeit,
  die niemand mehr erreicht. `ReactDemo.astro` wird von keiner Datei importiert (die 17
  Demoseiten laden alle `VanillaDemo.astro`, `index.astro` lädt `Layout.astro`), enthält
  selbst kein React und ist bis auf ein `description`-Prop und eine Hintergrundfarbe eine
  Kopie von `VanillaDemo.astro`. `createFrameLoopComponent.js` führt in seinem eigenen
  `@example` ein `useFrameLoop(…)` vor, das es im Repo nicht gibt, und wird nirgends
  importiert. Von den 25 Vorschaubildern nennt kein `_<name>.json` mehr `clouds.png`,
  `crosses-r3f.png`, `map2d-camera-based-visibility-r3f.png`, `map2d-rect-visi-area.png`,
  `map2d-tile-sprites-layer-r3f.png`, `map2d-tile-sprites-r3f.png`,
  `parallax-kastani-r3f.png`, `splotch-starfield.png`,
  `textured-sprites-from-tileset-r3f.png`, `textured-sprites-r3f.png` und
  `two5-post-processing.png`. Keine Folge von Paket 11: bei `ba44e8e` sind alle dreizehn
  Fundstellen genauso unreferenziert, Paket 11 hat nur die React-Kette aus den Manifesten
  genommen (in Zug 0 von Paket 16 beim Ausmessen der Lookbook-Struktur für die neue README
  aufgefallen, also vorbestehend), Severity info → Audit: Fundstellen in Demo-Code, die
  weder Build, Konfiguration, Test-Harness noch Setup-Dokumentation berühren — dieselbe
  Auslegung und dieselbe Ursache wie beim verwaisten `fovealVisionEffect.ts` weiter oben,
  und die Drain-Runde sieht beide Einträge nebeneinander
  Als neues Finding in ./audit.html aufgenommen (2026-09-04)
## Pakete

### [x] 1. Kompilierte Specs aus Build und Testlauf heraushalten

- Findings: CFG-012 (medium)
- Ziel: Das npm-Paket enthält nur Bibliothekscode, und die Vitest-Suite fährt jede
  Assertion genau einmal.
- Bereich: `packages/twopoint5d/tsconfig*.json`, neue Vitest-Config, `project.json`
- Hängt ab von: —
- Hinweis: Fundament des Laufs. Solange `dist/lib/**/*.spec.js` mitläuft, ist jede
  spätere Fehlerzählung — besonders die der Strictness-Pakete — verzerrt.
- Hash: 23f768c
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/tsconfig.build.json` (neu),
  `packages/twopoint5d/vite.config.ts` (neu), `packages/twopoint5d/package.json`,
  `packages/twopoint5d/project.json`
- Vorgehen:
  1. `packages/twopoint5d/tsconfig.build.json` anlegen, genau mit diesem Inhalt:

     ```json
     {
       "extends": "./tsconfig.json",
       "exclude": ["**/*.spec.ts"]
     }
     ```

     Beide Dateien liegen im selben Verzeichnis, deshalb bleiben `include: ["src"]`,
     `rootDir` und `outDir` aus der Basis unverändert gültig. `packages/twopoint5d/tsconfig.json`
     wird **nicht** angefasst: es ist die Projektdatei für Editor und spätere Typprüfung
     der Specs, und genau diese Trennung ist der Sinn der zweiten Datei.
  2. In `packages/twopoint5d/package.json` das Script `compile` von `pnpm tsc` auf
     `pnpm tsc -p tsconfig.build.json` umstellen. Sonst nichts an dieser Datei.
  3. `packages/twopoint5d/vite.config.ts` anlegen, genau mit diesem Inhalt:

     ```ts
     import {defineConfig} from 'vitest/config';

     export default defineConfig({
       test: {
         // Die Suite liegt in den Quellen: eine Spec heißt `*.spec.ts` und steht neben
         // ihrem Modul. Das Muster ist deshalb auf `src/` festgenagelt statt auf den
         // Standard-Glob — kompilierte Ausgabe unter `dist/` trägt dieselben Specs als
         // `.js` und darf nicht mitgesammelt werden.
         include: ['src/**/*.spec.ts'],
       },
     });
     ```

     Der Dateiname ist nicht frei wählbar: `nx.json` führt `{projectRoot}/vite.config.ts`
     bereits im Named Input `vitestDefaults`, der Nx-Cache invalidiert also von selbst.
     Nichts weiter in diese Datei — keine Plugins, keine `environment`-Angabe, keine
     Aliase, keine Coverage-Optionen. Coverage gehört Paket 5.
  4. In `packages/twopoint5d/project.json` beim Target `build` den Eintrag
     `"{projectRoot}/tsconfig.build.json"` in `inputs` aufnehmen. Ohne ihn liest Nx eine
     Änderung an der neuen Datei nicht als Cache-Invalidierung. Bewusst dort und nicht im
     Named Input `sharedTsconfigs`: die Datei gehört diesem einen Projekt, und
     `sharedTsconfigs` hängt zusätzlich an `vitestDefaults`, wo sie nichts zu suchen hat.
  5. Umbrüche und Einrückung nicht von Hand setzen — `pnpm format` erledigt das, `pnpm lint`
     prüft es mit.
  6. Vor dem Messen `pnpm clean` fahren. `tsc` räumt sein `outDir` nicht auf; ohne den
     Clean bleiben die alten Spec-Artefakte liegen und täuschen einen fehlgeschlagenen Fix vor.
- Nachweis statt Regressionstest: Das ist ein Konfigurationsdefekt, kein Laufzeitfehler —
  es gibt keine Zusicherung im Code, die vorher rot sein könnte, und ein Test, der das
  Build-Ergebnis abtastet, würde die Unit-Suite an ein vorhandenes `dist/` binden. Der
  Beleg sind stattdessen zwei Zahlen, beide in den Report:
  `find packages/twopoint5d/dist -name '*.spec.*' | wc -l` fällt von 180 auf 0, und der
  Vitest-Lauf von 90 Dateien / 1406 Tests auf 45 Dateien / 703 Tests. Beides am
  2026-09-04 im Ist-Zustand gemessen.
- Verify (das Gate, muss `exit=0` liefern):
  `pnpm clean && pnpm lint && pnpm build && pnpm checkPkgTypes && NX_TUI=false pnpm nx run twopoint5d:test`
- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm test:ci`. Erwartet ist genau das
  Bild aus »Vorbestehende Fehler« — Chromium grün, Firefox durchgehend `this.gl is null`.
  Die Playwright-Runde steht nicht im Gate, weil sie auf dieser Maschine nie `exit=0`
  liefert; sie wird trotzdem gefahren, weil sie gegen `dist/lib/index.js` läuft und damit
  als Einzige zeigt, dass die Bibliothek nach dem Umbau noch lädt. Neue Fehler dort gehen
  zurück in die Fehlerkette.
- Commit: `build(twopoint5d): keep compiled specs out of dist and out of the vitest run`
- Ergebnis: 0 Runden · CFG-012 behoben · kein Regressionstest, sondern zwei gemessene
  Zahlen: Spec-Artefakte in `packages/twopoint5d/dist` 180 → 0, Vitest 90 Dateien / 1406
  Tests → 45 Dateien / 703 Tests · Review ohne Befund · Gate `exit=0` ·
  `pnpm test:ci` unverändert am Baseline-Bild (Chromium 0 Fehler, Firefox 24, wie vorher)
- Nebenbefunde: —
- Folgen: keine neuen; die in Zug 0 erkannte Folge »Specs verlieren die Typprüfung, weil
  `pnpm build` sie nicht mehr kompiliert« liegt als eigener Hinweis unter Paket 8
- Schnittstellen: `packages/twopoint5d/tsconfig.build.json` — neue Emit-Config, erbt aus
  `tsconfig.json` und schließt `**/*.spec.ts` aus; `pnpm build` läuft ab jetzt darüber ·
  `packages/twopoint5d/vite.config.ts` — Vitest sammelt ausschließlich `src/**/*.spec.ts`,
  eine neue Spec außerhalb von `src/` läuft nicht mit

**CFG-012 · medium · packages/twopoint5d/tsconfig.json:2, packages/twopoint5d/package.json:49**
— 168 kompilierte Spec-Dateien landen in dist — und laufen doppelt

Das Package-tsconfig kompiliert `src` inklusive aller `*.spec.ts` nach `dist/lib` — 168
Spec-Artefakte (js + d.ts + maps) im veröffentlichten npm-Paket, das aus `dist/` publiziert
wird. Zusätzlich sammelt Vitest die kompilierten Specs mit ein: die Suite läuft mit 84
statt 42 Dateien, jede Assertion doppelt.

Empfehlung: Ein `tsconfig.build.json` mit `"exclude": ["**/*.spec.ts"]` für den Build
nutzen (oder `files`-Whitelist im publizierten package.json), und in der Vitest-Config
`dist/**` ausschließen.

Abweichungen von dieser Empfehlung, beide bewusst: Die `files`-Whitelist entfällt — sie
wäre ein zweiter Mechanismus für dasselbe Ziel, und sie säße in `dist/package.json`, also
in einem Publish-Pfad, den dieser Lauf laut »Konventionen« nicht ausführt und damit auch
nicht prüfen kann. Und die Vitest-Config sperrt nicht `dist/**` aus, sondern schließt
`src/**/*.spec.ts` ein: eine Positivliste bleibt auch dann richtig, wenn später ein
weiteres Ausgabeverzeichnis dazukommt.

### [x] 2. Ungenutzte devDependencies entfernen, Minors nachziehen

- Findings: DEPS-001 (low), CFG-011 (info), DEPS-003 (low, Teil 1)
- Ziel: Sieben Abhängigkeiten ohne Abnehmer verlassen das Root-Manifest, und alles, was
  ohne Major-Sprung aktualisierbar ist, steht auf dem heutigen Stand — dazu die zwei
  risikoarmen Majors `@types/node` 26 und `sinon` 22.
- Bereich: `package.json`, `nx.json`, `apps/lookbook/package.json`,
  `packages/twopoint5d-testing/package.json`, `pnpm-lock.yaml`
- Hängt ab von: —
- Hinweis (Zug 0 von Paket 1): Der zweite Eintrag unter »Offene Befunde« nennt vier
  weitere devDependencies ohne Abnehmer — dieselbe Ursache wie DEPS-001, deshalb hier und
  nicht in einem eigenen Paket. Bei `happy-dom` fällt die Zeile in `nx.json` mit, daher
  steht die Datei jetzt im Bereich. `npm-run-all` gehört ausdrücklich **nicht** hierher:
  `run-s` steckt in fünf Scripts, das Manifest verliert es erst in Paket 4, wenn diese
  Scripts neu geschrieben sind.
- Hash: 5da6fa6
- Modell: mittlere Stufe
- Effort: low
- Dateien: `package.json`, `nx.json`, `apps/lookbook/package.json`,
  `packages/twopoint5d-testing/package.json`, `pnpm-lock.yaml`, dazu die vier
  Quelldateien aus Schritt 10
- Vorgehen:
  1. **Manifeste von Hand ändern, dann `pnpm install`.** Kein `pnpm update`, kein
     `--latest`, kein `npm-check`. Die Liste unten ist abschließend; ein Sammelbefehl
     zieht Majors mit, die dieser Lauf bewusst zurückstellt (siehe Schritt 8), und
     versteckt sie im Lockfile-Rauschen. Jede Range unten ist so gewählt, dass die
     gesperrte Version im Lockfile sie nicht mehr erfüllt — `pnpm install` löst dadurch
     genau die gewünschten Einträge neu auf und lässt alles andere stehen.
  2. In `package.json` diese sieben Einträge aus `devDependencies` **streichen**. Alle
     sieben sind am 2026-09-04 per `grep` über `packages/`, `apps/`, `scripts/` und jede
     Konfigdatei des Repos ohne einen einzigen Abnehmer:
     - `"@types/react": "^19.2.14"` (Zeile 36) — außerhalb von `apps/lookbook/` gibt es
       kein `.tsx` und kein `.jsx`, und die Lookbook-App bringt `@types/react` in ihrem
       eigenen Manifest mit.
     - `"@vitejs/plugin-react": "^6.1.1"` (Zeile 39) — keine Vite- oder Vitest-Config im
       Repo lädt das Plugin; die Lookbook-App bekommt ihre React-Integration über
       `@astrojs/react`.
     - `"eslint-plugin-react": "^7.37.5"` (Zeile 43) — `eslint.config.mjs` lädt kein
       React-Plugin.
     - `"happy-dom": "^20.7.0"` (Zeile 45) — keine Spec und keine Vitest-Config setzt
       eine `environment`; die Bibliothek testet gegen three.js-Objekte, nicht gegen DOM.
     - `"ts-node": "10.9.2"` (Zeile 53) — reines ESM-Projekt, kein Aufrufer.
     - `"tsup": "^8.5.1"` (Zeile 55) — die Build-Pipeline bleibt `tsc` plus
       `makePackageJson.mjs`, so entschieden am 2026-09-04. Damit ist auch die
       Evaluationsfrage aus CFG-011 beantwortet: nicht evaluieren, entfernen.
     - `"use-asset": "^1.0.4"` (Zeile 58) — kein Aufrufer.
  3. **`esbuild` bleibt und wird nicht angefasst.** Die Begründung des Audits trägt zwar
     nicht — `@web/dev-server-esbuild@1.0.4` bringt sein eigenes `esbuild@^0.25.0` mit und
     braucht das Root-Paket nicht —, aber der Eintrag ist trotzdem kein toter Buchstabe:
     `vite@8` führt `esbuild` als Peer, und im Root-Importer wird dieser Peer aus genau
     diesem Eintrag bedient (`pnpm-lock.yaml:46`). Ihn zu streichen hieße, die
     Peer-Auflösung von Vite und damit von Vitest der Automatik zu überlassen — eine
     Verhaltensänderung ohne Finding, das sie verlangt. Die Version selbst steht als
     eigener Eintrag unter »Offene Befunde«.
  4. In `nx.json` Zeile 50 den Namen mitziehen, den Schritt 2 aus dem Manifest nimmt:
     `"externalDependencies": ["vitest", "happy-dom"]` wird zu
     `"externalDependencies": ["vitest"]`. Ohne diesen Schritt hängt der Named Input
     `vitestDefaults` an einem Paket, das nicht mehr installiert ist.
  5. In `package.json` diese neun Ranges auf genau diese Werte setzen, Schreibweise wie
     dort vorhanden (alle mit Caret):

     | Eintrag | von | auf |
     | --- | --- | --- |
     | `@arethetypeswrong/cli` | `^0.18.2` | `^0.18.5` |
     | `@types/node` | `^22.19.1` | `^26.4.1` |
     | `@types/sinon` | `^21.0.1` | `^22.0.0` |
     | `globals` | `^17.3.0` | `^17.12.0` |
     | `playwright` | `^1.58.2` | `^1.62.1` |
     | `prettier` | `^3.8.3` | `^3.9.6` |
     | `sinon` | `^21.0.1` | `^22.1.0` |
     | `typescript-eslint` | `^8.56.1` | `^8.69.0` |
     | `yaml` | `^2.8.2` | `^2.9.0` |

     `@types/sinon` springt mit `sinon` mit und ist kein zusätzlicher Major: `sinon@21`
     liefert kein eigenes `types`-Feld, die Typen kommen ausschließlich von dort, und vier
     Specs importieren `createSandbox` aus `sinon`. `@types/node` 26 passt zu dem, worauf
     `engines.node` in Paket 10 vereinheitlicht wird, und zu der Node-Version, unter der
     dieses Repo tatsächlich gebaut wird (v26.8.1 am 2026-09-04).
  6. In `apps/lookbook/package.json` drei Ranges anheben: `@types/react-dom` von
     `^19.2.5` auf `^19.2.7` (Zeile 24), `astro` von `^7.2.10` auf `^7.3.1` (Zeile 25),
     `sass` von `^1.103.1` auf `^1.104.0` (Zeile 30). `@types/react` steht dort bereits
     auf dem aktuellen `^19.2.18` und bleibt unverändert.
  7. In `packages/twopoint5d-testing/package.json` beide Playwright-Ranges auf `^1.62.1`
     setzen: `@playwright/test` (Zeile 18) und `playwright` (Zeile 29). Dass die drei
     Manifeste hier mitlaufen und nicht nur das Root-Manifest, ist Absicht: Playwright
     steht derzeit an drei Stellen auf zwei verschiedenen Versionen, und die Pakete 4 und 5
     bauen die Browsersuite um — ein gespaltener Runner wäre dort eine Falle, deren
     Ursache niemand mehr im Diff sieht.
  8. **Was ausdrücklich stehen bleibt**, obwohl `pnpm outdated` es meldet: `eslint`,
     `@eslint/js` und `nx` (Paket 3), `npm-run-all` (Paket 4), `esbuild` (Schritt 3),
     `typescript`, `vitest`, die drei `@web/*`-Pakete und die Catalog-Einträge `three` und
     `@types/three` (je ein Eintrag unter »Offene Befunde«). `pnpm-workspace.yaml` wird
     in diesem Paket nicht angefasst.
  9. `pnpm install` im Repo-Root fahren. Der `postinstall` von `twopoint5d-testing` lädt
     danach neue Chromium- und Firefox-Binaries für Playwright 1.62 — das dauert Minuten
     und ist kein Fehler. `pnpm-lock.yaml` gehört mit in den Commit.
  10. `pnpm format` fahren. Prettier 3.9 bricht Union-Typen anders um: was in 130 Spalten
      passt, steht jetzt auf einer Zeile. Gemessen mit `prettier@3.9.6 --check .` am
      2026-09-04 betrifft das genau vier Dateien —
      `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts`,
      `packages/twopoint5d/src/texture/types.ts`,
      `packages/twopoint5d/src/utils/Dependencies.ts`,
      `packages/twopoint5d/src/vertex-objects/types.ts`. Diese vier Diffs sind erwartet
      und mechanisch; nichts davon wird von Hand nachgezogen, und darüber hinaus wird
      keine Datei umformatiert.
  11. `.vscode/settings.json` bleibt unverändert. Der Eintrag `"tsup"` steht dort in einer
      Rechtschreib-Wortliste, nicht in einer Abhängigkeitsangabe, und das Wort kommt
      weiterhin in `audit.html` vor. Ihn zu streichen erzeugt Editor-Warnungen und löst
      nichts.
  12. Zug 5, im selben Zug wie der Commit: den zweiten Eintrag unter »Offene Befunde«
      (`package.json:36,39,43,45` — vier weitere Root-devDependencies) auf `[x]` setzen.
      Er ist mit diesem Paket erledigt und darf nicht als offener Posten in den Abschluss
      laufen.
- Nachweis statt Regressionstest: Ein Manifest ohne Abnehmer ist kein Laufzeitfehler; es
  gibt keine Zusicherung im Code, die vorher rot sein könnte, und ein Test, der das
  Manifest abtastet, prüfte nur seine eigene Kopie der Liste. Der Beleg sind zwei Zahlen,
  beide in den Report:
  `node -e "console.log(Object.keys(require('./package.json').devDependencies).length)"`
  fällt von 28 auf 21, und `pnpm outdated -r` nennt keinen der neun Einträge aus Schritt 5
  und keinen der drei aus Schritt 6/7 mehr. Beides am 2026-09-04 im Ist-Zustand gemessen.
- Verify (das Gate, muss `exit=0` liefern):
  `pnpm clean && pnpm lint && pnpm build && pnpm checkPkgTypes && NX_TUI=false pnpm nx run twopoint5d:test`
- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm test:ci`. Erwartet ist das Bild aus
  »Vorbestehende Fehler« — Chromium ohne Fehler, Firefox durchgehend `this.gl is null`.
  Diese Runde zählt in diesem Paket mehr als sonst: Playwright springt von 1.57/1.58 auf
  1.62 und bringt neue Browser-Binaries mit. Maßstab bleibt der Vergleich mit der Baseline
  aus Paket 1 (Chromium 0 Fehler, Firefox 24). Jeder **neue** Fehler unter Chromium geht
  zurück in die Fehlerkette. Ändert sich allein die Firefox-Zahl, ist das kein Grund für
  eine Runde, gehört aber mit der neuen Zahl in die Ergebniszeile — dann hat der
  Browserwechsel das vorbestehende GL-Problem verschoben, und Paket 5 muss das wissen.
- Commit: `chore(deps): remove unused devDependencies and update the toolchain`
- Ergebnis: 1 Runde · DEPS-001, CFG-011 und DEPS-003 (Teil 1) behoben · kein
  Regressionstest, sondern zwei gemessene Zahlen: Root-devDependencies 28 → 21, und
  `pnpm outdated -r` nennt keinen der zwölf Einträge aus Schritt 5–7 mehr · Review ohne
  Befund am Code; seine zwei Punkte betrafen Commit und Plan-Fortschreibung, also Zug 5 ·
  Gate `exit=0`, 45 Dateien / 703 Tests · `pnpm test:ci` unverändert am Baseline-Bild
  (Chromium 0 Fehler, Firefox 24) trotz Playwright-Sprung auf 1.62
- Nebenbefunde: —
- Folgen: —
- Schnittstellen: Root-`devDependencies` haben `@types/react`, `@vitejs/plugin-react`,
  `eslint-plugin-react`, `happy-dom`, `ts-node`, `tsup` und `use-asset` verloren — wer
  eines davon braucht, installiert es neu · `nx.json:50` führt im Named Input
  `vitestDefaults` nur noch `externalDependencies: ["vitest"]` · Playwright steht
  workspace-weit auf `^1.62.1`, `@types/node` auf `^26.4.1`, `sinon`/`@types/sinon` auf
  `^22` · Prettier `^3.9.6` bricht Union-Typen anders um: `pnpm format` vor dem Lint
  fahren

**DEPS-001 · low · package.json:52, 54, 57** — Drei ungenutzte devDependencies: tsup,
use-asset, ts-node

Verifiziert per `grep` über `packages`, `apps` und `scripts` — keine Treffer für `tsup`
und `use-asset`. `ts-node` wird in einem reinen ESM-Projekt nicht gebraucht. Am 2026-08-20
stehen alle drei unverändert im Manifest.

Empfehlung: Entfernen. Bei `tsup` vorher CFG-011 entscheiden — evaluieren oder rauswerfen,
aber nicht liegen lassen. `esbuild` bleibt: das wird über `@web/dev-server-esbuild`
gebraucht.

Abweichung von dieser Empfehlung, bewusst: `esbuild` bleibt, aber nicht aus dem genannten
Grund — siehe Schritt 3. Die Zeilennummern im Audit sind veraltet; die drei Einträge
stehen heute in `package.json:53,55,58`.

**CFG-011 · info · package.json:54** — tsup liegt als devDependency herum, ohne benutzt zu
werden

Die Build-Pipeline ist `tsc` plus `makePackageJson.mjs` und funktioniert. `tsup` könnte
Banner, Source-Maps und optional ein Dual-Format liefern — würde aber eine etablierte
Pipeline ablösen.

Empfehlung: Entweder bewusst evaluieren oder die Dependency entfernen. Der jetzige Zustand
— installiert, unbenutzt, halb gemeint — ist die schlechteste der drei Möglichkeiten. Siehe
DEPS-001.

**DEPS-003 · low · package.json:31-60** — Major-Updates aufgelaufen: eslint 10, nx 23,
@types/node 26

`pnpm outdated` zeigt anstehende Majors (eslint 9→10, @eslint/js 9→10, nx 22→23,
@types/node 22→26, sinon 21→22) plus ein Dutzend Minors. Nichts davon brennt, aber die
Majors werden mit jedem Monat teurer.

Empfehlung: Minors gesammelt aktualisieren; für eslint 10 und nx 23 je einen eigenen
kleinen Upgrade-Commit einplanen.

Dieses Paket trägt Teil 1: alle Minors und Patches, dazu `@types/node` 26 und `sinon` 22.
`eslint` 10 und `nx` 23 bekommen ihren eigenen Commit in Paket 3. Die Majors, die seit dem
Audit dazugekommen sind und in keiner der beiden Listen stehen, liegen als Nebenbefunde in
»Offene Befunde«.

### [x] 3. Toolchain-Majors: eslint 10 und nx 23

- Findings: DEPS-003 (low, Teil 2)
- Ziel: Beide Majors sind installiert, und Lint-Abdeckung wie Nx-Cache verhalten sich
  danach messbar wie vorher.
- Bereich: `package.json`, `pnpm-lock.yaml`
- Hängt ab von: Paket 2
- Hinweis: Bewusst von Paket 2 getrennt. Beide Majors fassen Konfigurations-APIs an,
  die Paket 4 anschließend umbaut — ein gemeinsamer Commit mit sieben Removals wäre
  nicht mehr lesbar.
- Hinweis (Zug 0 von Paket 2): `typescript-eslint` steht ab Paket 2 auf `^8.69.0` und
  braucht hier keinen zweiten Sprung. `eslint`, `@eslint/js` und `nx` sind die einzigen
  drei Einträge, die Paket 2 bewusst hat stehen lassen — was `pnpm outdated` sonst noch
  meldet, ist dort entweder erledigt oder liegt als Eintrag unter »Offene Befunde«.
- Hinweis (Zug 0 von Paket 3): Der Grobplan führte `eslint.config.mjs`, `nx.json` und
  `project.json` im Bereich, weil ein Major üblicherweise Konfiguration mitzieht. Am
  2026-09-04 gegen beide Zielversionen nachgemessen, braucht hier keine dieser Dateien
  eine Änderung; der Bereich schrumpft deshalb auf Manifest und Lockfile. Die Messungen
  stehen ausformuliert im Vorgehen — nicht als Ausschmückung, sondern damit im Zweifel
  nachprüfbar ist, was »erwartet« heißt, statt dass es geraten wird.
- Hash: 247f40b
- Modell: mittlere Stufe
- Effort: low
- Dateien: `package.json`, `pnpm-lock.yaml`
- Vorgehen:
  1. **Drei Zeilen von Hand ändern, dann `pnpm install`.** Kein `nx migrate`, kein
     `pnpm update`, kein `--latest`, kein `npm-check`. Die Liste ist abschließend, und
     jede Range ist so gewählt, dass die gesperrte Version im Lockfile sie nicht mehr
     erfüllt — `pnpm install` löst dadurch genau diese drei Einträge neu auf und lässt
     alles andere stehen. In `package.json` unter `devDependencies`:
     - Zeile 34: `"@eslint/js": "^9.39.2"` → `"@eslint/js": "^10.0.1"`
     - Zeile 39: `"eslint": "^9.39.2"` → `"eslint": "^10.9.1"`
     - Zeile 43: `"nx": "22.5.3"` → `"nx": "23.2.0"`

     Der Versatz zwischen `eslint@10.9.1` und `@eslint/js@10.0.1` ist kein Tippfehler:
     seit v10 erscheinen die beiden auf getrennten Linien. `@eslint/js@10.0.1` führt
     `eslint: ^10.0.0` als Peer und passt.

     `nx` behält seine exakte Schreibweise ohne Caret. Nx erwartet workspace-weit
     dieselbe Version, und die Pin-Schreibweise zu ändern wäre eine zweite Entscheidung,
     die in diesem Paket nichts zu suchen hat.
  2. `pnpm install`. `pnpm-workspace.yaml` bleibt unangetastet: `nx` steht dort bereits
     unter `onlyBuiltDependencies`, sein Postinstall-Build läuft also weiter.
  3. **`nx migrate` wird nicht ausgeführt**, und das ist eine Entscheidung, keine
     Vergesslichkeit. Im Workspace liegt kein einziges `@nx/*`-Paket — weder in einem
     Manifest noch im Lockfile —, und der Sprung 22.5.3 → 23.2.0 plant genau acht
     Migrationen ein, alle am 2026-09-04 einzeln gelesen:
     - Fünf hängen nur Zeilen an `.gitignore` (`.nx/polygraph`, `.nx/self-healing`,
       `.nx/migrate-runs`, `.claude/worktrees`, `.claude/settings.local.json`). Die
       ersten drei sind gegen das vorhandene pauschale `.nx/` redundant, die letzten
       beiden betreffen Werkzeug-Artefakte, die mit diesem Paket nichts zu tun haben.
     - `22-6-0-enable-analytics-prompt` kehrt in einem Prozess ohne Terminal sofort
       zurück (`!process.stdin.isTTY`) und tut nichts.
     - `23-0-0-consolidate-release-tag-config` greift auf einen `release`-Block, den
       diese `nx.json` nicht hat.
     - `23-2-0-set-cache-on-executor-target-defaults` rührt die Schlüssel
       `nx:run-script` und `nx:run-commands` laut eigener Dokumentation nie an, und
       Executor-Schlüssel hat diese `nx.json` ohnehin keine: `build`, `test`,
       `checkPkgTypes` und `publishNpmPkg` sind allesamt Zielname-Schlüssel.

     Der Preis wären eine `migrations.json` im Projektwurzelverzeichnis, ein eigener
     Installationslauf und fünf ungefragte `.gitignore`-Zeilen — für null Wirkung.
  4. **`eslint.config.mjs` wird nicht angefasst.** Nachgemessen: `@eslint/js@10.0.1`
     liefert dieselbe `configs.recommended` wie `9.39.2`, erweitert um genau drei Regeln
     (`no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error`), ohne
     Entfall und ohne geänderte Severity oder Optionen. Diese drei melden über alle 207
     gelinteten Dateien null Befunde, ebenso `no-shadow-restricted-names` mit der neuen
     Voreinstellung `reportGlobalThis`. Das Repo hat keine `.eslintrc`, keine zweite
     `eslint.config.*`, keinen `/* eslint-env */`-Kommentar und kein
     `ESLINT_USE_FLAT_CONFIG`; kein `ignores`-Muster enthält eine eckige Klammer, auf die
     die neu unterstützten POSIX-Zeichenklassen anspringen könnten.
     `typescript-eslint@8.69.0` führt `eslint: ^8.57.0 || ^9.0.0 || ^10.0.0` als Peer,
     `eslint-config-prettier@10.1.8` führt `>=7.0.0`; beide stehen bereits auf ihrer
     neuesten Version, ein Mitziehen entfällt. Die drei `@typescript-eslint`-Regeln, die
     auf `0` stehen und im Plugin längst nicht mehr existieren, bleiben harmlos: ESLint
     überspringt die Validierung jeder Regel mit Severity 0. Sie gehören Paket 10.
     Diese Konfigurationsform wurde in einer isolierten Installation gegen echtes
     `eslint@10.9.1`, `@eslint/js@10.0.1`, `typescript-eslint@8.69.0` und
     `eslint-config-prettier@10.1.8` gefahren — sie lädt, lintet und liefert `exit=0`.
  5. **`nx.json` und die drei `project.json` werden nicht angefasst.** Alle benutzten
     Schlüssel — `defaultBase`, `parallel`, `tui`, `targetDefaults`, `namedInputs` —
     stehen unverändert im Schema von `nx@23.2.0`. Die Neuerung des Majors, das Token
     `"..."` zum Erben von `targetDefaults`-Werten, ist ein Angebot und keine Pflicht;
     wer es nutzen will, tut das in Paket 4, wo die Cache-Defaults ohnehin neu
     geschnitten werden.
  6. Fällt eine dieser Aussagen im Lauf um, ist das eine Folge und wird gemeldet, nicht
     nebenbei behoben. Der Bereich dieses Pakets ist das Manifest.
  7. `pnpm format` vor dem Lint fahren, Umbrüche und Einrückung nicht von Hand setzen.
- Nachweis statt Regressionstest: Ein Versionswechsel an zwei Werkzeugen hat keine
  Zusicherung im Code, die vorher rot sein könnte. Der Beleg sind drei Zahlenpaare, alle
  am 2026-09-04 im Ist-Zustand gemessen und alle in den Report:
  - `pnpm exec eslint --version` steigt von `v9.39.2` auf `v10.x`.
  - `pnpm exec nx --version` meldet unter »Local« statt `v22.5.3` nun `v23.2.0`.
  - Die dritte Zahl ist die wichtige, weil ESLint 10 seinen Config-Suchweg geändert hat:
    er beginnt jetzt beim Verzeichnis der gelinteten Datei und läuft aufwärts, statt vom
    Arbeitsverzeichnis auszugehen.

    ```
    pnpm exec eslint . --format json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(r.length,'Dateien,',r.reduce((n,f)=>n+f.errorCount+f.warningCount,0),'Befunde')})"
    ```

    Heute antwortet das mit `207 Dateien, 0 Befunde` (191 `.ts`, 9 `.js`, 7 `.mjs`).
    Beide Zahlen müssen danach gleich sein. Ein grünes Lint allein beweist an dieser
    Stelle nichts: verlöre die neue Suche Dateien, bliebe `pnpm lint` grün und die
    Abdeckung stürbe unbemerkt. Weicht die Dateizahl ab, ist das ein Befund und geht in
    den Report.
- Verify (das Gate, muss `exit=0` liefern):
  `pnpm clean && pnpm lint && pnpm build && pnpm checkPkgTypes && NX_TUI=false pnpm nx run twopoint5d:test`
- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm test:ci`. Erwartet ist das Bild
  aus »Vorbestehende Fehler« — Chromium ohne Fehler, Firefox durchgehend
  `this.gl is null` (Baseline aus Paket 2: Chromium 0, Firefox 24). Diese Runde zählt
  hier mehr als sonst, weil sie als Einzige `nx run-many` samt Tag-Filter fährt: das Gate
  prüft nur ein einzelnes Projekt, und die Auswahl über `--projects=tag:ci` ist genau der
  Teil von Nx, den Paket 4 als Nächstes umbaut. Jeder neue Fehler unter Chromium geht
  zurück in die Fehlerkette.
- Commit: `chore(deps): upgrade eslint to 10 and nx to 23`
- Ergebnis: 1 Runde · DEPS-003 Teil 2 behoben (`package.json:34,39,43`) · statt
  Regressionstest die drei gemessenen Zahlenpaare: eslint v9.39.2 → v10.9.1, nx lokal
  v22.5.3 → v23.2.0, eslint-JSON-Report 207 Dateien / 0 Befunde vor wie nach dem
  Sprung · Review ohne Befund · Gate `exit=0` (45 Dateien / 703 Tests), `pnpm test:ci`
  Chromium 0 / Firefox 24 wie in der Baseline
- Nebenbefunde: —
- Folgen: —
- Schnittstellen: Toolchain steht auf `eslint@10.9.1`, `@eslint/js@10.0.1` und
  `nx@23.2.0` (exakt gepinnt, ohne Caret). `eslint.config.mjs`, `nx.json` und die drei
  `project.json` sind unverändert gültig; das nx-23-Token `"..."` zum Erben von
  `targetDefaults` steht Paket 4 zur Verfügung

**DEPS-003 · low · package.json:31-60** — Major-Updates aufgelaufen: eslint 10, nx 23,
@types/node 26

`pnpm outdated` zeigt anstehende Majors (eslint 9→10, @eslint/js 9→10, nx 22→23,
@types/node 22→26, sinon 21→22) plus ein Dutzend Minors. Nichts davon brennt, aber die
Majors werden mit jedem Monat teurer.

Empfehlung: Minors gesammelt aktualisieren; für eslint 10 und nx 23 je einen eigenen
kleinen Upgrade-Commit einplanen.

Dieses Paket trägt Teil 2 und damit den Rest des Findings: `eslint`, `@eslint/js` und
`nx`. Teil 1 — alle Minors, `@types/node` 26, `sinon` 22 — liegt in Paket 2 (5da6fa6).
Die Zeilennummern des Audits sind veraltet; die drei Einträge stehen heute in
`package.json:34,39,43`.

Abweichung von dieser Empfehlung, bewusst: Aus »je einen eigenen kleinen Upgrade-Commit«
wird ein gemeinsamer. Nach der Messung oben ist jeder der beiden Sprünge eine einzige
Manifestzeile ohne Folgeänderung; zwei Commits über je eine Zeile trennen nichts, was
sich getrennt lesen ließe. Der Schnitt, den die Empfehlung meint, ist bereits gemacht —
er liegt zwischen Paket 2 und diesem Paket.

### [x] 4. Scripts, Nx-Targets und Projekt-Tags aufräumen

- Findings: CFG-004 (low), CFG-005 (info), CFG-006 (low), CFG-007 (low), CFG-008 (info),
  DEPS-002 (info), DOC-015 (low)
- Ziel: Ein Satz Scripts ohne Dubletten und ohne achtfach wiederholtes `NX_TUI=false`,
  globale Cache-Defaults in `nx.json`, und Tags, die halten, was die Dokumentation über
  sie sagt.
- Bereich: `package.json` (scripts und eine devDependency),
  `packages/twopoint5d/package.json` (scripts), `nx.json`, die drei `project.json`,
  `CLAUDE.md`, `README.md`, `pnpm-lock.yaml`
- Hängt ab von: Paket 3
- Hinweis: Hier entsteht die Trennung von `test:ci` und `test:browser`. Ab diesem Commit
  ändert sich, was das Verify-Gate bedeutet — siehe oben.
- Hinweis (Zug 0 von Paket 1): Hier verlässt auch `npm-run-all` das Manifest, wie in
  »Entscheidungen« beschlossen. `run-s` steht in vier Root-Scripts (`cbt`,
  `rebuild:twopoint5d`, `test:all`, `ci`) und im `build`-Script von
  `packages/twopoint5d/package.json`; deshalb die zweite Datei im Bereich. Ohne diesen
  Schritt bliebe die Entscheidung ohne zuständiges Paket liegen.
- Hinweis (Zug 0 von Paket 4): Der Bereich wächst um zwei Dateien, beide durch die eigene
  Änderung erzwungen und keine Nebenbefunde. `README.md:85` erklärt `pnpm cbt` mit einem
  Kommentar, den dieses Paket unwahr macht; `pnpm-lock.yaml` verliert `npm-run-all`.
- Hash: 3529764
- Modell: mittlere Stufe
- Effort: low
- Dateien: `package.json`, `packages/twopoint5d/package.json`,
  `packages/twopoint5d/project.json`, `packages/twopoint5d-testing/project.json`,
  `apps/lookbook/project.json`, `nx.json`, `CLAUDE.md`, `README.md`, `pnpm-lock.yaml`
- Vorgehen:

  1. **`nx.json`: den TUI-Schalter an einer Stelle setzen.** Der Block `"tui"` bekommt
     genau diesen Inhalt:

     ```json
     "tui": {
       "enabled": false
     }
     ```

     `autoExit` entfällt ersatzlos. Es stellt die Countdown-Sekunden einer Oberfläche
     ein, die nach `enabled: false` nie startet — genau die Sorte toter Konfiguration,
     die dieses Audit an anderen Stellen anstreicht. Nachgemessen an
     `nx@23.2.0` (`dist/src/tasks-runner/is-tui-enabled.js`): `nxJson.tui.enabled`
     entscheidet, die Umgebungsvariable `NX_TUI` hat Vorrang davor, und `--tui` auf der
     Kommandozeile hat Vorrang vor beidem. Wer die Oberfläche einmal will, ruft
     `NX_TUI=true pnpm nx …` — der Ausweg bleibt offen, er steht nur nicht mehr neunmal
     im Manifest.

  2. **`nx.json`: `targetDefaults` für `build` und `test` schärfen.** Der Block bekommt
     genau diesen Inhalt; `checkPkgTypes` und `publishNpmPkg` bleiben unverändert stehen:

     ```json
     "targetDefaults": {
       "build": {
         "dependsOn": ["^build"],
         "cache": true,
         "outputs": ["{projectRoot}/dist"]
       },
       "test": {
         "executor": "nx:run-script",
         "dependsOn": ["^build"],
         "options": {
           "script": "test"
         },
         "cache": true
       },
       "checkPkgTypes": {
         "executor": "nx:run-script",
         "dependsOn": ["build"],
         "options": {
           "script": "checkPkgTypes"
         }
       },
       "publishNpmPkg": {
         "executor": "nx:run-script",
         "dependsOn": ["build"],
         "options": {
           "script": "publishNpmPkg"
         }
       }
     }
     ```

     Beide neuen Zeilen sind am 2026-09-04 gegen `nx@23.2.0` nachgemessen, und beide
     schließen ein Loch, das größer ist als »das Caching greift schlechter, als es
     könnte«:

     - `outputs` bei `build`: Ein Target namens `build` ohne deklarierte `outputs` fällt
       in `nx/dist/src/tasks-runner/utils.js` auf eine Altlast-Liste zurück —
       `dist/<root>`, `<root>/dist`, `<root>/build`, `<root>/public`. Für `twopoint5d`
       greift das nicht, dort steht `outputs` bereits im `project.json`; für `lookbook`
       greift es sehr wohl, und `apps/lookbook/public` enthält 69 versionierte
       Quelldateien — Nx führt sie damit als Build-Ausgabe, legt sie in den Cache und
       stellt sie von dort wieder her. Dass der Wiederherstellungspfad tatsächlich läuft,
       ist gemessen: `apps/lookbook/dist` (21 MB) gelöscht, `nx run lookbook:build`
       gefahren — 2/2 Cache-Treffer, das Verzeichnis kam bitgleich zurück, ohne dass
       Astro lief. Dass derselbe Pfad auch über `public` geht, steht in der Liste oben
       und ist nicht eigens ausprobiert worden; ein Versuch, der versionierte Quellen aus
       einem Cache überschreibt, ist kein Versuch, den man macht, um recht zu behalten.
       Die deklarierte Zeile nimmt die Frage weg.
     - `dependsOn` bei `test`: Die Browsersuite importiert `@spearwolf/twopoint5d`, und
       dessen `exports` zeigen auf `dist/lib/index.js`. Ohne diese Zeile darf
       `pnpm test` die Browsertests gegen ein veraltetes oder fehlendes `dist/` fahren;
       dass es heute gutgeht, liegt allein daran, dass das Gate vorher `build` aufruft.
       Für `twopoint5d` ist die Zeile wirkungslos (keine Projekt-Abhängigkeiten), für
       `twopoint5d-testing` löst sie auf `twopoint5d:build` auf — im Projektgraphen am
       2026-09-04 als einzige Kante `twopoint5d-testing → twopoint5d` bestätigt.

     **Globale `inputs` werden bewusst nicht gesetzt**, und das ist eine Abweichung von
     der Empfehlung des Audits. Sie schlägt »Sources ohne Specs plus geteilte tsconfigs«
     als Default vor; das ist für die `tsc`-Bibliothek richtig und für die Astro-App
     falsch — ein solcher Default hashte keine einzige `.astro`-Datei und lieferte
     Cache-Treffer auf veraltete Ausgabe. Der einzige Input-Satz, der für beide
     Werkzeugketten stimmt, ist `["default", "^default"]`, und genau den wendet Nx
     bereits an, wenn nichts dasteht. Ein globales `test.outputs` entfällt aus demselben
     Grund: gemessen (siehe Schritt 4) schreibt keine der beiden Suiten heute eine Datei.

  3. **`packages/twopoint5d/project.json`: die doppelte `outputs`-Zeile streichen.** Die
     Datei bekommt genau diesen Inhalt:

     ```json
     {
       "name": "twopoint5d",
       "tags": ["ci", "twopoint5d"],
       "root": "packages/twopoint5d",
       "targets": {
         "build": {
           "inputs": [
             "{projectRoot}/src/**/*.ts",
             "!{projectRoot}/src/**/*.spec.ts",
             "{projectRoot}/tsconfig.build.json",
             "sharedTsconfigs",
             "makePackageJson"
           ]
         },
         "test": {
           "inputs": ["vitestDefaults", "{projectRoot}/src/**/*.ts"]
         }
       }
     }
     ```

     `outputs` kommt jetzt aus `nx.json` und trägt denselben Wert; `tsc` schreibt laut
     `packages/twopoint5d/tsconfig.json` nach `dist/lib`, liegt also darunter. Die
     `inputs` bleiben, wo sie sind: sie sind absichtlich enger als `default` und gehören
     dieser einen Werkzeugkette.

  4. **`packages/twopoint5d-testing/project.json`: Tag tauschen, Target definieren.** Die
     Datei bekommt genau diesen Inhalt:

     ```json
     {
       "name": "twopoint5d-testing",
       "tags": ["browser", "twopoint5d"],
       "root": "packages/twopoint5d-testing",
       "targets": {
         "test": {
           "inputs": ["default", "^default"]
         }
       }
     }
     ```

     Der Tag `ci` weicht `browser` — so beschlossen am 2026-09-04. Der Tag `twopoint5d`
     bleibt, damit `pnpm test:twopoint5d` weiterhin beide Suiten meint.

     **`outputs` bleibt weg, und das ist gemessen, nicht vermutet.** Am 2026-09-04 die
     volle Browsersuite gefahren und `packages/twopoint5d-testing/test-results` davor und
     danach verglichen: unverändert eine einzige Datei, `.last-run.json`, mit
     Änderungszeit vom 2025-06-30. Der konfigurierte `defaultReporter` in
     `web-test-runner.config.js` schreibt auf die Konsole, nicht in eine Datei. Die
     Empfehlung des Audits — »Outputs auf das Report-Verzeichnis« — zeigt damit auf ein
     Verzeichnis, das niemand mehr befüllt; der Rest davon liegt als Nebenbefund unter
     »Offene Befunde«.

     `inputs` steht bewusst auf dem breiten Paar statt auf einer engen Liste:
     `default` deckt `test/`, `web-test-runner.config.js` und `package.json` ab und
     lässt das ignorierte `test-results/` draußen, `^default` sorgt dafür, dass jede
     Änderung an der Bibliothek die Suite neu laufen lässt. Zu eng gefasste Inputs
     ergäben hier einen Cache-Treffer auf eine Bibliothek, die sich geändert hat — der
     Fehler, der sich nicht selbst zeigt. `externalDependencies` wird ausdrücklich
     **nicht** eingeschränkt: die Tests importieren `three/webgpu` und `three/tsl`
     direkt, ein `three`-Sprung muss die Suite invalidieren.

  5. **`apps/lookbook/project.json`: Tags nachtragen.** Die Datei bekommt genau diesen
     Inhalt:

     ```json
     {
       "name": "lookbook",
       "tags": ["app"],
       "root": "apps/lookbook",
       "targets": {
         "dev": {
           "dependsOn": ["^build"]
         },
         "start": {
           "dependsOn": ["^build"]
         },
         "preview": {
           "dependsOn": ["build"]
         }
       }
     }
     ```

     **Abweichung von der Empfehlung, bewusst.** Das Audit schlägt `tags: [twopoint5d]`
     vor. Das wäre am 2026-09-04 nachprüfbar falsch: `lookbook` hat ein `build`-Target
     (`pnpm exec astro build`), und `pnpm build:twopoint5d` filtert auf genau diesen Tag.
     Aus »Build core lib only«, wie `CLAUDE.md` das Script beschreibt, würde damit
     stillschweigend »Bibliothek plus Astro-App«. Der Befund selbst — ein Projekt ohne
     jeden Tag fällt aus jedem gefilterten Lauf heraus — bleibt richtig und wird mit
     einem eigenen Tag behoben, der die App benennt, statt sie in eine fremde Auswahl zu
     ziehen.

  6. **`package.json`: der Script-Block.** Er bekommt genau diesen Inhalt, in dieser
     Reihenfolge:

     ```json
     "scripts": {
       "build": "pnpm nx run-many -t build",
       "build:twopoint5d": "pnpm nx run-many -t build --projects=tag:twopoint5d",
       "rebuild:twopoint5d": "pnpm run build:twopoint5d && pnpm run test:twopoint5d",
       "test": "pnpm nx run-many -t test",
       "test:ci": "pnpm nx run-many -t test --projects=tag:ci",
       "test:browser": "pnpm nx run-many -t test --projects=tag:browser",
       "test:twopoint5d": "pnpm nx run-many -t test --projects=tag:twopoint5d",
       "test:affected": "pnpm nx affected -t test",
       "lint": "eslint . && prettier --check .",
       "format": "prettier --write .",
       "clean": "pnpm nx run-many -t clean && rimraf dist",
       "checkPkgTypes": "pnpm nx run-many -t checkPkgTypes",
       "publishNpmPkg": "pnpm nx run-many -t publishNpmPkg",
       "update": "pnpm dlx npm-check --update",
       "ci": "pnpm run clean && pnpm run lint && pnpm run build && pnpm run checkPkgTypes && pnpm run test:ci && pnpm run test:browser",
       "cbt": "pnpm run ci",
       "lookbook": "pnpm nx dev lookbook"
     }
     ```

     Die Reihenfolge ist neu und gruppiert: bauen, testen, Codequalität, Aufräumen und
     Veröffentlichen, dann die zusammengesetzten Einstiege. Das ist Absicht und keine
     Unruhe im Diff — neun der siebzehn Zeilen ändern sich ohnehin, und `ci` und `cbt`
     stehen erst nebeneinander lesbar, wenn sie nebeneinander stehen.

     Vier Dinge stecken darin:

     - `test:all` fällt weg. Es war wortgleich mit `ci` und `cbt` und wird nirgends
       genannt — nicht in `README.md`, nicht in `CLAUDE.md`, nicht in `AGENTS.md`, nicht
       im Workflow.
     - `ci` trägt die Definition, `cbt` ist ein Alias darauf. Das Audit lässt beides zu
       (»als schlanke Aliase behalten oder streichen«); `cbt` bleibt, weil `README.md:85`
       und `CLAUDE.md:22` es als *den* Befehl führen und `.github/workflows/ci.yml:36`
       auf `pnpm run ci` zeigt. Ein Alias, der zwei Dokumente am Leben lässt, kostet eine
       Zeile.
     - `ci` endet auf `test:ci && test:browser`. Ohne den zweiten Aufruf verlöre der
       GitHub-Workflow die Browsersuite in dem Moment, in dem `twopoint5d-testing` den
       Tag `ci` abgibt — eine Regression, die dieses Paket selbst auslöste. Zwei getrennte
       Aufrufe statt eines `pnpm run test`, weil das im Log zwei benannte Abschnitte gibt
       und weil das Gate unten genau an der Grenze zwischen beiden schneidet.
     - `run-s` und `NX_TUI=false` verschwinden vollständig. Die Kette ist `&&`, nicht
       `;`: der erste Fehlschlag bricht ab, wie `run-s` es tat.

  7. **`package.json`: `npm-run-all` aus `devDependencies` streichen** (heute Zeile 42),
     dann `pnpm install`. Kein `pnpm update`, kein `--latest`. Ein `grep` über alle
     `*.json`, `*.yaml`, `*.mjs`, `*.js` und `*.md` außerhalb von `node_modules` fand am
     2026-09-04 genau fünf Aufrufer von `run-s` — die vier Root-Scripts und das
     `build`-Script der Bibliothek. Schritt 6 und Schritt 8 nehmen alle fünf weg, danach
     ist der Aufrufer-Satz leer.

  8. **`packages/twopoint5d/package.json`: das `build`-Script.** Aus
     `"build": "pnpm run-s -sn compile makePackageJson"` wird:

     ```json
     "build": "pnpm run compile && pnpm run makePackageJson"
     ```

     Sonst nichts an dieser Datei.

  9. **`CLAUDE.md`: zwei Zeilen im Abschnitt »Commands« richtigstellen.** Zeile 17 wird
     durch zwei Zeilen ersetzt:

     ```markdown
     - Unit tests only, no browser (Nx tag `ci`): `pnpm test:ci`
     - Browser tests only (Playwright via `@web/test-runner`, Nx tag `browser`): `pnpm test:browser`
     ```

     Zeile 22 wird ersetzt durch:

     ```markdown
     - Full pre-commit gate: `pnpm run ci` (clean → lint → build → checkPkgTypes → test:ci → test:browser); `pnpm cbt` is an alias for it
     ```

     Zeile 15 bleibt wörtlich stehen — `pnpm build:twopoint5d` filtert weiterhin auf Tag
     `twopoint5d`, und dort hat weiterhin nur die Bibliothek ein `build`-Target.

 10. **`CLAUDE.md`: das Tag-Vokabular festhalten.** Im Abschnitt »Repo layout«, hinter
     den drei Projekt-Aufzählungspunkten und vor dem Absatz »The library has **two test
     surfaces**«, dieser Absatz:

     ```markdown
     Nx tags: `twopoint5d` (the library and its browser harness), `ci` (the Vitest suite), `browser` (the Playwright suite), `app` (the Astro lookbook). Every project carries at least one — a project without tags silently drops out of every `--projects=tag:…` run.
     ```

     Das ist der Satz, der den Befund über die fehlenden Tags am Leben hält, nachdem der
     Befund selbst weg ist: Ohne ihn ist das nächste Projekt wieder tag-los, und niemand
     weiß, welcher Tag der richtige gewesen wäre.

 11. **`README.md:85`: den Kommentar hinter `pnpm cbt` richtigstellen.** Aus

     ```sh
     $ pnpm cbt  # => pnpm run clean > build > test
     ```

     wird

     ```sh
     $ pnpm cbt  # clean, lint, build, check package types, then all tests
     ```

     Sonst nichts an dieser Datei. Die Node-Version in `README.md:75` gehört Paket 10 und
     wird hier nicht angefasst.

 12. **`AGENTS.md` wird nicht angefasst.** Nachgesehen am 2026-09-04: die Datei nennt
     `pnpm install`, `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm lookbook` und
     `pnpm run ci` — keinen Tag, kein `NX_TUI`, kein `cbt`, kein `test:ci`. Jede dieser
     Aussagen bleibt nach diesem Paket wahr.

 13. **Formatierung: JSON überlässt du Prettier, Markdown nicht.** `pnpm format` setzt
     Umbrüche und Einrückung in `package.json`, `nx.json` und den drei `project.json`;
     `pnpm lint` prüft es mit. Die lange `ci`-Zeile bleibt dabei eine Zeile — Prettier
     bricht JSON-Strings nicht um. `.prettierignore` schließt dagegen `*.md` und
     `pnpm-lock.yaml` aus: die Zeilen in `CLAUDE.md` und `README.md` schreibst du von
     Hand und richtest sie nach dem, was drumherum steht. Kein Werkzeug korrigiert dich
     dort, und kein Gate meldet es.

 14. Fällt eine der gemessenen Aussagen im Lauf um, ist das eine Folge und wird gemeldet,
     nicht nebenbei behoben.

- Nachweis statt Regressionstest: Konfiguration, kein Laufzeitfehler — es gibt keine
  Zusicherung im Code, die vorher rot sein könnte. Der Beleg sind sechs Messungen, alle
  am 2026-09-04 im Ist-Zustand erhoben und alle in den Report:

  1. `grep -c 'NX_TUI=false' package.json` fällt von **9** auf **0**. (Das Audit spricht
     von acht Scripts; heute sind es neun — `build:twopoint5d`, `test:ci`,
     `test:twopoint5d`, `clean`, `cbt`, `rebuild:twopoint5d`, `test:all`, `lookbook`,
     `ci`.)
  2. `grep -c 'run-s' package.json packages/twopoint5d/package.json` fällt von **4 + 1**
     auf **0 + 0**, und die Root-`devDependencies` gehen von **21** auf **20**.
  3. Tag-Auswahl vorher / nachher, je über
     `pnpm exec nx show projects --projects=tag:<tag>`:

     | Tag | vorher | nachher |
     | --- | --- | --- |
     | `ci` | `twopoint5d-testing`, `twopoint5d` | `twopoint5d` |
     | `browser` | `[]` | `twopoint5d-testing` |
     | `twopoint5d` | `twopoint5d-testing`, `twopoint5d` | unverändert |
     | `app` | `[]` | `lookbook` |

     Ein Tag ohne Treffer ist bei `nx show projects` kein Fehler: die Ausgabe ist `[]`,
     der Exit-Code 0. Die beiden Vorher-Zeilen lassen sich also gefahrlos messen.

  4. `pnpm exec nx show project lookbook --json` führt unter `targets.build.outputs`
     vorher **nichts** und nachher **`["apps/lookbook/dist"]`**, und unter `tags` vorher
     nur den abgeleiteten `npm:private`, nachher zusätzlich `app`.
  5. `pnpm exec nx show project twopoint5d-testing --json` führt unter
     `targets.test.dependsOn` vorher **nichts** und nachher **`["^build"]`**; im Lauf von
     `pnpm run test:browser` steht danach »and 1 task it depends on« im Nx-Abschluss.
  6. Die Vitest-Runde bleibt bei **45 Dateien / 703 Tests**, die Browsersuite bei
     **Chromium 0 Fehler / Firefox 24** — die Zahlen aus Paket 3.

- Verify (das Gate, muss `exit=0` liefern):
  `pnpm run clean && pnpm run lint && pnpm run build && pnpm run checkPkgTypes && pnpm run test:ci`

  Ab diesem Paket steht `test:ci` selbst im Gate statt eines handgeschriebenen
  `nx run twopoint5d:test`: es ist jetzt genau die Vitest-Runde, die die Pakete 1 bis 3
  von Hand nachgebaut haben.

- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm run ci`. Erwartet ist, dass die
  Kette `clean → lint → build → checkPkgTypes → test:ci` durchläuft und erst im letzten
  Glied `test:browser` mit dem Bild aus »Vorbestehende Fehler« stehen bleibt — Chromium
  ohne Fehler, Firefox durchgehend `this.gl is null`. Dieser zweite Lauf ist kein Luxus:
  `pnpm run ci` ist die Zeile, die `.github/workflows/ci.yml:36` aufruft, und das Gate
  oben fährt sie nie am Stück. Ein Tippfehler in der Kette fiele sonst erst in GitHub
  auf. Jeder neue Fehler unter Chromium geht zurück in die Fehlerkette.

- Commit: `build: consolidate the pnpm scripts and model the nx targets explicitly`
- Ergebnis: 1 Runde · CFG-004, CFG-005, CFG-006, CFG-007, CFG-008, DEPS-002 und DOC-015
  behoben · Reviewer ohne Qualitätsbefund · kein Regressionstest (Konfiguration, kein
  Laufzeitverhalten); die sechs Messungen aus dem Detailplan alle wie vorhergesagt
  eingetreten: `NX_TUI=false` 9 → 0, `run-s` 4+1 → 0+0, devDependencies 21 → 20, Tag `ci`
  nur noch `twopoint5d`, Tag `browser` neu `twopoint5d-testing`, Tag `app` neu `lookbook`,
  `lookbook:build.outputs` jetzt `["apps/lookbook/dist"]`, `twopoint5d-testing:test`
  hängt an `^build`, Vitest unverändert 45 Dateien / 703 Tests · Gate `exit=0`; der
  zusätzliche `pnpm run ci` bricht wie erwartet erst in `test:browser` ab, 24 Fehler,
  alle unter Firefox, Chromium fehlerfrei
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `pnpm test:ci` fährt ab hier ausschließlich die Vitest-Runde,
  `pnpm test:browser` ist die Playwright-Suite; beide gehören ins Gate. `pnpm test:all`
  gibt es nicht mehr, `pnpm cbt` ist ein Alias auf `pnpm run ci`, und `pnpm run ci`
  endet auf `test:ci && test:browser`. Nx-Tags: `twopoint5d` (Bibliothek und
  Browser-Harness), `ci` (Vitest), `browser` (Playwright), `app` (Astro-Lookbook) —
  jedes neue Projekt braucht mindestens einen. `nx.json` trägt `tui.enabled: false`
  sowie `build.outputs` und `test.dependsOn` in `targetDefaults`; `npm-run-all` und
  `run-s` stehen nicht mehr zur Verfügung


**CFG-004 · low · package.json:25, 27, 29** — cbt, test:all und ci sind wortgleich

Drei Scripts, identische Kommandozeile: `clean lint build checkPkgTypes test:ci`. Am
2026-08-20 unverändert. Wer das Repo neu betritt, sucht den Unterschied und findet keinen.

Empfehlung: Auf eines reduzieren — `ci` ist der sprechendste Name. Die anderen beiden als
schlanke Aliase behalten oder streichen.

**CFG-005 · info · package.json:15-29** — NX_TUI=false ist in acht Scripts hardcodiert

Dasselbe Präfix in jeder zweiten Script-Zeile. Wer es ändern will, ändert es achtmal.

Empfehlung: Zentral in `nx.json` setzen und aus den Scripts entfernen.

**CFG-006 · low · apps/lookbook/project.json** — apps/lookbook hat keine Nx-Tags

Die Datei definiert Targets, aber kein `tags`-Feld. Damit greifen
`--projects=tag:twopoint5d`-Filter nicht auf die Lookbook — sie fällt bei gefilterten
Läufen stillschweigend heraus.

Empfehlung: Mindestens `tags: [twopoint5d]` setzen, analog zu `twopoint5d-testing`, das
`[ci, twopoint5d]` trägt.

**CFG-007 · low · packages/twopoint5d-testing/project.json** — twopoint5d-testing hat ein
leeres targets-Objekt

`targets: {}`. Das `test`-Target läuft dadurch über den `nx:run-script`-Default ohne
explizite `inputs` und `outputs` — das Caching greift schlechter, als es könnte.

Empfehlung: Target explizit definieren, mit Inputs auf Testdateien und Config, Outputs auf
das Report-Verzeichnis.

**CFG-008 · info · nx.json** — nx.json targetDefaults ohne inputs und outputs

Die Inputs sind nur in `packages/twopoint5d/project.json` definiert, das `test`-Default hat
gar keine Outputs — womit der Cache dort nicht greift. Jedes neue Package müsste die
Definition wiederholen.

Empfehlung: Globale Defaults für `build` (Sources ohne Specs plus geteilte tsconfigs als
Inputs, `dist` als Output) und `test` in `nx.json`. Spart die Wiederholung und macht das
Caching vorhersagbar.

**DEPS-002 · info · package.json:45** — npm-run-all, obwohl pnpm run-s nativ mitbringt

Die Scripts nutzen `pnpm run-s`, das seinerseits aus `npm-run-all` stammt. Eine
Abhängigkeit für etwas, das der Paketmanager selbst kann.

Empfehlung: Optional ersetzen. Kein Druck — funktioniert, kostet aber eine Dependency.

**DOC-015 · low · CLAUDE.md:17** — CLAUDE.md behauptet, test:ci überspringe die Browsertests

»CI-tagged tests only (skips browser tests that need Playwright): `pnpm test:ci`« stimmt
nicht: `packages/twopoint5d-testing/project.json:3` trägt den Tag `ci`, also wählt
`--projects=tag:ci` die Playwright-Suite mit aus. Die Fehlannahme ist teuer: sie hat in
einem einzigen Remediation-Lauf einen Detailplan und einen doppelten Verify-Lauf gekostet,
weil zwei Runner den Browsertest separat nachfuhren, den sie längst gefahren hatten.

Empfehlung: Die Zeile korrigieren — oder, falls die Trennung gewollt ist, den Tag `ci` von
`twopoint5d-testing` nehmen und einen eigenen Tag für die Browsersuite einführen. Beides
ist vertretbar, der heutige Zustand nicht.

Dieses Paket wählt den zweiten Weg, wie am 2026-09-04 beschlossen: der Tag wandert, und
die Zeile wird trotzdem neu geschrieben, weil sie danach etwas anderes beschreibt.

### [x] 5. CI-Pipeline: Flakes sichtbar machen, Coverage einführen

- Findings: TEST-001 (medium), TEST-002 (medium), TEST-007 (low), CFG-009 (info),
  CFG-010 (info)
- Ziel: Der Testlauf in CI ist deterministisch statt dreimal wiederholt, die
  Browsertests bekommen genug Zeit für die GPU-Initialisierung, und Coverage wird
  erhoben und als Artefakt aufbewahrt.
- Bereich: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
  `packages/twopoint5d-testing/web-test-runner.config.js`,
  `packages/twopoint5d/vite.config.ts`, `packages/twopoint5d/package.json`,
  `packages/twopoint5d/project.json`, `package.json`,
  `packages/twopoint5d-testing/package.json`, `nx.json`, `.gitignore`,
  `.prettierignore`, `CLAUDE.md`, `pnpm-lock.yaml`
- Hängt ab von: Paket 1, Paket 4
- Hinweis: Der Retry-Wrapper fällt weg und der Browser-Timeout steigt im selben Zug —
  einzeln behebt keine der beiden Maßnahmen den Flake. `publint` kommt als neue
  devDependency dazu; das ist Folge des Findings, kein eigenes Dependency-Thema.
- Hinweis (Zug 0 von Paket 2): Playwright steht ab Paket 2 workspace-weit auf `^1.62.1`
  statt auf drei verschiedenen Ständen; die Baseline für den Flake ist damit eine andere
  als die im Audit gemessene. Die drei `@web/*`-Pakete des Harness liegen je einen Major
  zurück und stehen als Eintrag unter »Offene Befunde« — wer hier den Browser-Timeout
  anfasst, sollte das wissen, bevor er ihn gegen die alte Version austariert.
- Hinweis (Zug 0 von Paket 3): Aus diesem »sollte das wissen« wird ein Auftrag. Zwei
  Einträge aus »Offene Befunde« sind diesem Paket zugeschlagen, beide aus demselben
  Grund — sie fassen die Dateien an, die dieses Paket ohnehin umschreibt, und jede
  Reihenfolge außer »zusammen« bedeutet dieselbe Arbeit zweimal:
  `vitest` 4 → 5 samt dem im Gleichschritt versionierten `@vitest/coverage-v8`, dessen
  Version dieses Paket mit der Coverage-Einführung ohnehin benennen muss; und die drei
  `@web/*`-Majors, weil `@web/test-runner` 0.20 → 1.0 das Schema genau der Datei ändert,
  in der der Browser-Timeout steht. Beide gehören damit zum Zuschnitt dieses Pakets, und
  Zug 0 von Paket 5 schreibt sie in seinen Detailplan. Erwartungsgemäß wächst der Diff;
  das ist der Preis dafür, den Timeout nur einmal auszutarieren.
- Hinweis (Zug 0 von Paket 4): Ein dritter Eintrag kommt dazu, ebenfalls aus »Offene
  Befunde« — der Artefakt-Schritt in `ci.yml`, der ein Verzeichnis hochlädt, das die
  Browsersuite nie befüllt. Er trifft dieselbe Datei und dieselbe Frage wie die
  Coverage-Einführung: was hebt CI nach einem Lauf auf. Dazu drei Namen, die sich in
  Paket 4 geändert haben und die dieses Paket in `ci.yml` und in den Scripts vorfindet:
  der Gate-Einstieg heißt `pnpm run ci` und endet auf `test:ci && test:browser`,
  `test:ci` ist die reine Vitest-Runde (Tag `ci`), `test:browser` die Playwright-Suite
  (Tag `browser`). Coverage-Ausgabe braucht ein `outputs` am `test`-Target von
  `twopoint5d`; das globale `targetDefaults.test` in `nx.json` hat bewusst keines, weil
  heute keine Suite eine Datei schreibt.
- Hinweis (Zug 0 von Paket 5): Drei Korrekturen an dem, was oben steht, alle am
  2026-09-04 nachgemessen.

  Erstens: **Das Schema von `@web/test-runner` ändert sich beim Major nicht.**
  `TestRunnerConfig` und `TestRunnerCoreConfig` sind zwischen `0.20.2`/`0.13.4` und
  `1.0.0` bis auf die Schreibweise der Typ-Importe identisch, ebenso die Signaturen von
  `defaultReporter`, `playwrightLauncher` und `esbuildPlugin`; `target: 'auto'` verhält
  sich unverändert. Der Grund, mit dem Zug 0 von Paket 3 die drei Majors hierher gezogen
  hat, trägt also nicht. Sie bleiben trotzdem hier, aus einem stärkeren: siehe zweitens.

  Zweitens: **Der Major weckt Firefox auf.** In einer isolierten Installation mit den
  echten sieben Testdateien, den echten Browser-Binaries und den drei Zielversionen
  fällt `TypeError: can't access property "getSupportedExtensions", this.gl is null`
  auf **null** Vorkommen — heute steht dieselbe Meldung 92-mal im Log und reißt alle 24
  Firefox-Tests mit. Firefox läuft dann durch und lässt genau eine Assertion stehen
  (siehe viertens). Die Gegenprobe mit dem alten 2-Sekunden-Timeout und denselben neuen
  Majors liefert dasselbe Bild: es ist der Major, nicht der Timeout. Das Paket ändert
  damit die Zeile unter »Vorbestehende Fehler«, gegen die jedes spätere Paket seinen
  Verify-Lauf hält — und deshalb gehört der Sprung in genau dieses Paket und in kein
  späteres.

  Drittens: **`arethetypeswrong` ist längst verdrahtet.** `publishNpmPkg` in
  `packages/twopoint5d/package.json` ruft `checkPkgTypes` als erstes Glied auf, und
  `deploy.yml` fährt `pnpm run publishNpmPkg`. Die erste Hälfte von CFG-010 ist damit
  erfüllt und wird nicht noch einmal gebaut; offen ist allein `publint`.

  Viertens: Firefox lässt nach dem Sprung eine Assertion stehen —
  `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js:144`, der
  Rücklesetest der Instanz-Attribute liefert dort Nullen statt der geschriebenen Werte.
  Die Datei stammt aus `bbf1e4b` und damit von **vor** dem ersten Commit dieses Laufs:
  der Befund ist vorbestehend und war nur davon verdeckt, dass Firefox bisher gar nicht
  so weit kam. Zug 5 trägt ihn ein, sobald der Verify-Lauf ihn im echten Baum bestätigt.

  Fünftens, weil die Frage sich mit dreizehn Dateien im Bereich von selbst stellt:
  **Das Paket wird nicht geteilt.** Der Schnitt läge nahe — die Werkzeugversionen samt
  Coverage auf der einen Seite, die beiden Workflows auf der anderen —, und er bringt
  nichts. Das Gate führt keine Workflow-Datei aus; ein roter Lauf kann seine Ursache
  also ohnehin nur in der ersten Hälfte haben, und die Zuordnung, für die man teilen
  würde, ist schon gegeben. Dagegen steht der Auftrag aus dem ersten Hinweis, dass
  Retry-Wrapper und Timeout im selben Zug fallen. Zum Umfang: Paket 4 hat neun Dateien
  und ein Lockfile in einer Runde getragen, und jeder Schritt hier ist bis auf die
  Zeichenkette ausgeschrieben.
- Hash: d011232
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `package.json`, `packages/twopoint5d/package.json`,
  `packages/twopoint5d/project.json`, `packages/twopoint5d/vite.config.ts`,
  `packages/twopoint5d-testing/package.json`,
  `packages/twopoint5d-testing/web-test-runner.config.js`, `nx.json`, `.gitignore`,
  `.prettierignore`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
  `CLAUDE.md`, `pnpm-lock.yaml`
- Vorgehen:

  1. **`package.json`: drei Manifestzeilen, dann `pnpm install`.** Kein `pnpm update`,
     kein `--latest`. Die Liste ist abschließend; die eine geänderte Range ist so
     gewählt, dass die gesperrte Version im Lockfile sie nicht mehr erfüllt, die beiden
     neuen Einträge löst `pnpm install` ohnehin frisch auf. Unter `devDependencies`,
     alphabetisch einsortiert:
     - `"vitest": "^4.0.18"` → `"vitest": "^5.0.0"`
     - neu: `"@vitest/coverage-v8": "^5.0.0"`
     - neu: `"publint": "^0.3.24"`

     `@vitest/coverage-v8` führt `vitest: 5.0.0` als exakten Peer; beide Ranges bewegen
     sich nur gemeinsam, deshalb dieselbe Schreibweise. Vitest 5 verlangt
     `node ^22.12 || ^24 || >=26` und `vite ^6.4 || ^7 || ^8` — beides ist erfüllt, die
     Node-Version dieses Repos ist v26.8.1 und `vite` kommt als Peer aus der Auflösung
     (heute `7.2.2`, in einer frischen Auflösung `8.2.2`).

  2. **`packages/twopoint5d-testing/package.json`: die drei Majors des Harness.** Unter
     `devDependencies`:
     - Zeile 26: `"@web/dev-server-esbuild": "^1.0.4"` → `"^2.0.0"`
     - Zeile 27: `"@web/test-runner": "^0.20.2"` → `"^1.0.0"`
     - Zeile 28: `"@web/test-runner-playwright": "^0.11.1"` → `"^1.0.0"`

     Alle drei verlangen `node >=22`; `@web/test-runner-playwright@1.0.0` führt
     `playwright: ^1.53.0` als Abhängigkeit und passt zu dem `^1.62.1`, auf dem Paket 2
     den Workspace vereinheitlicht hat. `@web/dev-server-esbuild@2.0.0` bringt
     `esbuild@^0.28.1` mit; dessen Build-Script ist über `onlyBuiltDependencies` in
     `pnpm-workspace.yaml` bereits freigegeben, die Datei wird **nicht** angefasst. Der
     Root-Eintrag `esbuild` bleibt ebenfalls unverändert — er bedient den Peer von Vite
     und liegt als eigener Eintrag unter »Offene Befunde«.

  3. **`packages/twopoint5d/vite.config.ts`: der Coverage-Block.** Die Datei bekommt
     genau diesen Inhalt:

     ```ts
     import {defineConfig} from 'vitest/config';

     export default defineConfig({
       test: {
         // The suite lives in the sources: a spec is named `*.spec.ts` and sits next to
         // its module. The pattern is therefore pinned to `src/` instead of the default
         // glob — compiled output under `dist/` carries the same specs as `.js` and must
         // not be collected along with them.
         include: ['src/**/*.spec.ts'],
         coverage: {
           provider: 'v8',
           include: ['src/**/*.ts'],
           exclude: ['src/**/*.spec.ts'],
           reporter: ['text-summary', 'lcov'],
           // The thresholds sit below the measured level, not on it: they are meant to
           // report a regression, not to fire on every line that moves. Raise them once
           // the gap has grown too wide.
           thresholds: {
             statements: 65,
             branches: 58,
             functions: 58,
             lines: 65,
             'src/vertex-objects/**': {statements: 90, branches: 82, functions: 88, lines: 90},
             'src/texture/**': {statements: 70, branches: 60, functions: 60, lines: 70},
           },
         },
       },
     });
     ```

     Die sechs Zahlenblöcke sind am 2026-09-04 an der echten Suite unter `vitest@5.0.0`
     gemessen, nicht geschätzt: gesamt 69.87 / 63.24 / 63.76 / 69.82,
     `src/vertex-objects/` 96.12 / 88.28 / 94.81 / 96.66, `src/texture/`
     74.93 / 65.96 / 66.99 / 75.42 (Statements / Branches / Functions / Lines). Genau
     diese Konfigurationsform ist gegen `vitest@5.0.0` und `@vitest/coverage-v8@5.0.0`
     gefahren worden und liefert `exit=0`; eine Gegenprobe mit einer unerreichbaren
     Schwelle auf demselben Glob liefert `exit=1` samt vier `ERROR`-Zeilen. Die Schwellen
     greifen also wirklich und sind keine tote Konfiguration.

     Vitest 5 zählt Glob-Schwellen anders als Vitest 4 — `perFile` wird von der obersten
     Ebene nicht mehr geerbt, und Coverage-Muster matchen auf relative Pfade. Beides ist
     in der Form oben schon berücksichtigt: `perFile` steht nirgends, und jedes Muster
     trägt seinen eigenen `**`.

     **Der vorhandene Kommentarblock wird dabei ins Englische übersetzt**, wie oben
     ausgeschrieben — Inhalt und Aussage bleiben Wort für Wort dieselben. Am 2026-09-04
     über `packages/*/src`, `packages/*/test`, `scripts/` und die Konfigdateien
     nachgesehen: diese Datei ist die einzige im ganzen Repo mit deutschsprachigen
     Kommentaren, alles andere ist englisch. Das ist eine Folge dieses Laufs — Paket 1
     hat die Datei angelegt — und keine vorbestehende Uneinheitlichkeit. Sie wird hier
     mitgenommen und nicht gemeldet, weil dieses Paket die Datei ohnehin neu schreibt und
     die Stelle nirgends billiger zu haben ist.

  4. **`packages/twopoint5d/package.json`: drei Scripts.**
     - `"test": "pnpm vitest --run"` wird zu `"test": "pnpm vitest --run --coverage"`.
       Coverage über die Kommandozeile und nicht über `coverage.enabled` in der Config:
       so bleibt `pnpm watch` frei davon, und jeder `nx run twopoint5d:test` erzeugt den
       Bericht. Gemessen kostet das 615 ms → 744 ms.
     - neu, hinter `checkPkgTypes`: `"lintPkg": "cd dist && pnpm exec publint"`.
     - `"publishNpmPkg"` wird zu
       `"publishNpmPkg": "pnpm run checkPkgTypes && pnpm run lintPkg && node ../../scripts/publishNpmPkg.mjs dist"`.

     Der Name ist `lintPkg` und nicht `checkPkg`: neben `checkPkgTypes` wäre das zweite
     auf einen Blick nicht auseinanderzuhalten, und `publint` prüft das Manifest, nicht
     die Typen. Ein eigenes Target statt einer zweiten Zeile in `checkPkgTypes`, weil ein
     Zielname, der etwas anderes tut, als er sagt, genau die Sorte Konfiguration ist, die
     dieses Audit an anderen Stellen anstreicht.

  5. **`packages/twopoint5d/project.json`: `outputs` am `test`-Target.** Der `test`-Block
     bekommt genau diesen Inhalt:

     ```json
     "test": {
       "inputs": ["vitestDefaults", "{projectRoot}/src/**/*.ts"],
       "outputs": ["{projectRoot}/coverage"]
     }
     ```

     Ohne diese Zeile liefert ein Nx-Cache-Treffer einen Testlauf ohne Coverage-Ausgabe,
     und der Upload in CI lädt nichts hoch — der Fehler, der sich nicht selbst zeigt.
     Bewusst hier und nicht in `targetDefaults.test`: die Browsersuite schreibt weiterhin
     keine Datei, und ein globales `outputs` auf ein Verzeichnis, das dort nie entsteht,
     wäre wieder tote Konfiguration.

  6. **`nx.json`: zwei Ergänzungen.**
     - Im Named Input `vitestDefaults` wird
       `"externalDependencies": ["vitest"]` zu
       `"externalDependencies": ["vitest", "@vitest/coverage-v8"]`. Die Coverage-Ausgabe
       hängt jetzt an diesem Paket; ein Sprung dort muss den Cache verwerfen.
     - In `targetDefaults`, hinter `checkPkgTypes` und vor `publishNpmPkg`:

       ```json
       "lintPkg": {
         "executor": "nx:run-script",
         "dependsOn": ["build"],
         "options": {
           "script": "lintPkg"
         }
       }
       ```

       Wie bei `checkPkgTypes` entsteht das Target nur in Projekten, die das Script
       tatsächlich haben — heute allein `twopoint5d`.

  7. **`package.json`: der Script-Block.** Zwei Änderungen, sonst nichts:
     - neu, direkt hinter `"checkPkgTypes"`:
       `"lintPkg": "pnpm nx run-many -t lintPkg",`
     - `"ci"` bekommt das neue Glied zwischen `checkPkgTypes` und `test:ci`:

       ```json
       "ci": "pnpm run clean && pnpm run lint && pnpm run build && pnpm run checkPkgTypes && pnpm run lintPkg && pnpm run test:ci && pnpm run test:browser",
       ```

     `cbt` bleibt der Alias auf `ci` und wird nicht angefasst. Damit läuft `publint` in
     jedem CI-Lauf und vor jedem Publish — die Bedingung, die das Finding verlangt.
     Nachgemessen am 2026-09-04: `publint@0.3.24` gegen das gebaute
     `packages/twopoint5d/dist` meldet »All good!« und `exit=0`. Der Schritt färbt das
     Gate also nicht rot.

  8. **`packages/twopoint5d-testing/web-test-runner.config.js`: der Mocha-Timeout.**
     Zeile 31: `timeout: '2000',` wird zu `timeout: '10000',`. Sonst nichts an dieser
     Datei. Die Empfehlung nennt 5 bis 10 Sekunden; die obere Grenze, weil ein großzügiger
     Timeout bei grünen Tests nichts kostet und der kalte CI-Runner unter `xvfb` der
     langsamste Fall ist, den diese Zahl abdecken muss.

     **`testsFinishTimeout` wird nicht gesetzt.** Der Vorgabewert von zwei Minuten je
     Testdatei ist in der isolierten Installation einmal gerissen — aber an einer Datei,
     die ihre Bilder aus `/apps/lookbook/public/assets` lädt, und dort war das
     Verzeichnis nur ein Symlink. Im echten Baum liegen die Dateien. Eine Zahl gegen ein
     Probe-Artefakt zu setzen wäre geraten. Falls der Verify-Lauf die Meldung
     »Browser tests did not finish within 120000ms« zeigt, ist das ein Befund und geht in
     die Fehlerkette, nicht in eine stille Erhöhung.

  9. **`.gitignore`: eine Zeile.** Hinter Zeile 32 (`/coverage`) kommt:

     ```
     packages/*/coverage
     ```

     Der vorhandene Eintrag ist auf die Wurzel verankert und deckt
     `packages/twopoint5d/coverage` nicht ab. Ohne die neue Zeile stehen nach jedem
     Testlauf über 130 unversionierte Dateien im Arbeitsbaum.

 10. **`.prettierignore`: eine Zeile.** In die Gruppe bei `packages/*/dist` (Zeile 10/11)
     kommt:

     ```
     packages/*/coverage
     ```

     Auch hier ist `/coverage` in Zeile 4 auf die Wurzel verankert. Am 2026-09-04
     nachgemessen, indem der Coverage-Bericht testweise unter
     `packages/twopoint5d/coverage` abgelegt wurde: `prettier --check .` meldet dann
     `exit=1` und »Code style issues found in 132 files«, allesamt der HTML-Bericht.
     `eslint .` bleibt im selben Versuch bei `exit=0` — **`eslint.config.mjs` wird
     deshalb nicht angefasst**, obwohl `coverage/lcov-report/` drei `.js`-Dateien
     enthält.

 11. **`.github/workflows/ci.yml`: die Schritte.** Der `steps`-Block bekommt genau diesen
     Inhalt:

     ```yaml
         steps:
           - uses: actions/checkout@v4

           - uses: pnpm/action-setup@v4
             with:
               version: 10.27.0

           - uses: actions/setup-node@v4
             with:
               node-version: 24
               cache: pnpm

           - name: Install dependencies
             run: pnpm install --frozen-lockfile
             env:
               NPM_TOKEN: xxx

           - name: Install Playwright Browsers
             run: pnpm exec playwright install --with-deps chromium firefox
             env:
               NPM_TOKEN: xxx

           - name: Build packages and run all tests
             run: xvfb-run pnpm run ci
             timeout-minutes: 20
             env:
               NPM_TOKEN: xxx

           - name: Archive coverage report
             uses: actions/upload-artifact@v4
             if: always()
             with:
               name: coverage
               path: packages/twopoint5d/coverage
               retention-days: 3
     ```

     Vier Dinge stecken darin:

     - `nick-fields/retry@v3` ist weg, der Lauf ist einmalig. Sein `timeout_minutes: 2`
       galt je Versuch und deckte `clean → lint → build → checkPkgTypes → test:ci →
       test:browser` ab; dass darunter etwas als »Flake« erschien, ist mindestens
       ebenso plausibel durch diese Frist erklärt wie durch die Tests. `timeout-minutes`
       am Schritt ersetzt sie mit einem Wert, der einen Hänger fängt, ohne einen
       langsamen Lauf abzuschneiden.
     - Die Reihenfolge von `pnpm/action-setup` und `actions/setup-node` dreht sich um,
       und `run_install: true` weicht einem eigenen `pnpm install --frozen-lockfile`.
       Das ist die Bedingung dafür, dass `cache: pnpm` überhaupt etwas tut: der Cache
       wird von `setup-node` wiederhergestellt, und der Schritt findet pnpm nur, wenn es
       vorher installiert wurde. Bliebe `run_install: true` stehen, liefe die
       Installation vor dem Wiederherstellen und der Cache wäre Zierde.
       `version: 10.27.0` bleibt, weil es mit dem `packageManager`-Feld übereinstimmt.
     - `--frozen-lockfile` ist in CI das richtige Verhalten und war es vorher implizit
       schon (pnpm setzt es, wenn `CI` gesetzt ist); jetzt steht es da, wo man es liest.
     - Der Artefakt-Schritt lädt Coverage statt `packages/twopoint5d-testing/test-results`
       hoch. Das alte Verzeichnis befüllt seit dem Wegfall von `@playwright/test` als
       Reporter niemand mehr — nachgemessen am 2026-09-04, eine einzige Datei mit
       Änderungszeit vom 2025-06-30. `if: always()` bleibt: nach einem roten Lauf ist der
       Bericht am interessantesten.

 12. **`.github/workflows/deploy.yml`: dieselbe Umstellung.** Die drei Schritte werden zu:

     ```yaml
           - uses: actions/checkout@v4

           - uses: pnpm/action-setup@v4
             with:
               version: 10.27.0

           - uses: actions/setup-node@v4
             with:
               node-version: 24
               always-auth: true
               registry-url: https://registry.npmjs.org
               scope: '@spearwolf'
               cache: pnpm

           - name: Install dependencies
             run: pnpm install --frozen-lockfile

           - run: pnpm run publishNpmPkg
             name: Publish npm packages
     ```

     Das Finding nennt `.github/workflows/` und nicht eine einzelne Datei; einen von zwei
     Workflows umzustellen hieße, den nächsten Leser raten zu lassen, welcher der beiden
     der gemeinte Stand ist. Am Publish-Schritt selbst ändert sich nichts — er läuft
     weiterhin über `publishNpmPkg` und damit ab diesem Paket durch `attw` **und**
     `publint`.

 13. **`CLAUDE.md`: zwei Zeilen im Abschnitt »Commands«.** Zeile 23 wird ersetzt durch:

     ```markdown
     - Full pre-commit gate: `pnpm run ci` (clean → lint → build → checkPkgTypes → lintPkg → test:ci → test:browser); `pnpm cbt` is an alias for it
     ```

     Hinter Zeile 24 kommt eine neue Zeile:

     ```markdown
     - Lint the publish manifest: `pnpm lintPkg` (publint, runs against built `dist/`)
     ```

     Beide Stellen macht dieses Paket selbst unwahr beziehungsweise unvollständig; das
     ist keine vorgezogene Doku-Arbeit aus Paket 10. Die Node-Version in `README.md:75`
     und alles Weitere an `AGENTS.md` bleibt unangetastet.

 14. `pnpm install` im Repo-Root fahren, danach `pnpm format`. Umbrüche und Einrückung in
     `package.json`, `nx.json`, `project.json` und `vite.config.ts` setzt Prettier;
     `.gitignore`, `.prettierignore`, die beiden Workflows und `CLAUDE.md` schreibst du
     von Hand und richtest sie nach dem, was drumherum steht — `.prettierignore` schließt
     `*.md` aus, und YAML steht nicht in der Prettier-Auswahl dieses Repos.
     `pnpm-lock.yaml` gehört mit in den Commit.

 15. Fällt eine der gemessenen Aussagen im Lauf um, ist das eine Folge und wird gemeldet,
     nicht nebenbei behoben.

- Nachweis statt Regressionstest: Konfiguration und Werkzeugversionen, kein
  Laufzeitfehler — es gibt keine Zusicherung im Code, die vorher rot sein könnte. Der
  Beleg sind sechs Messungen, alle am 2026-09-04 im Ist-Zustand erhoben und alle in den
  Report:

  1. `pnpm exec vitest --version` steigt von `4.0.18` auf `5.x`, und die Vitest-Runde
     bleibt bei **45 Dateien / 703 Tests**. In der isolierten Installation gegen
     `vitest@5.0.0` sind beide Zahlen unverändert und der Lauf liefert `exit=0`.
  2. `packages/twopoint5d/coverage/lcov.info` existiert nach `pnpm test:ci`, und die
     Konsole zeigt die vier Prozentzahlen der `text-summary`-Ausgabe. Erwartet sind
     69.87 / 63.24 / 63.76 / 69.82 (Statements / Branches / Functions / Lines); eine
     Abweichung nach unten ist ein Befund, nach oben nicht.
  3. `pnpm exec nx show project twopoint5d --json` führt unter `targets.test.outputs`
     vorher **nichts** und nachher **`["packages/twopoint5d/coverage"]`**.
  4. `grep -c 'nick-fields/retry' .github/workflows/ci.yml` fällt von **1** auf **0**,
     und `grep -c 'cache: pnpm' .github/workflows/ci.yml .github/workflows/deploy.yml`
     steigt von **0 + 0** auf **1 + 1**.
  5. `pnpm run lintPkg` liefert `exit=0` und »All good!«.
  6. **Die wichtigste Zahl, weil sie die Baseline dieses Laufs verschiebt:** die
     Browsersuite. Heute Chromium 0 Fehler / Firefox 24, alle 24 aus
     `TypeError: can't access property "getSupportedExtensions", this.gl is null`
     (92 Vorkommen im Log). Erwartet nach dem Sprung: Chromium unverändert 0,
     `getSupportedExtensions` **0-mal**, und Firefox bei genau **einer** offenen
     Assertion — `vertex-objects — gpu upload > an instanced geometry uploads its base
     quad and every used instance`. Kommt ein anderes Bild heraus, gehört es in den
     Report, und die Ergebniszeile nennt die tatsächlichen Zahlen.

- Verify (das Gate, muss `exit=0` liefern):
  `pnpm run clean && pnpm run lint && pnpm run build && pnpm run checkPkgTypes && pnpm run lintPkg && pnpm run test:ci`

  `lintPkg` steht ab hier im Gate, an derselben Stelle wie im `ci`-Script.

- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm run test:browser`. Diese Runde ist
  in diesem Paket kein Beiwerk, sondern die Messung Nummer 6: sie entscheidet, was ab
  jetzt unter »Vorbestehende Fehler« steht. Solange Chromium fehlerfrei bleibt und die
  Firefox-Fehler **weniger** werden, ist das kein Grund für eine Runde. Ein neuer Fehler
  unter Chromium schon.

- Commit: `test: introduce coverage and move the test runners to their current majors`
- Ergebnis: 1 Runde · TEST-001, TEST-002, TEST-007, CFG-009 und die zweite Hälfte von
  CFG-010 behoben (die erste war schon vor dem Paket erfüllt) · kein Regressionstest,
  weil das Paket Konfiguration und Werkzeugversionen ändert; Nachweis sind sechs
  Messungen, fünf davon wie erwartet: `vitest` 4.0.18 → 5.0.0 bei unveränderten
  45 Dateien / 703 Tests, `packages/twopoint5d/coverage/lcov.info` entsteht
  (107.912 Byte) mit 69.87 / 63.24 / 63.76 / 69.82 und greifenden Schwellen (Gegenprobe
  `exit=1`), `targets.test.outputs` von nichts auf `["packages/twopoint5d/coverage"]`,
  `nick-fields/retry` 1 → 0 und `cache: pnpm` 0+0 → 1+1, `pnpm run lintPkg` `exit=0`
  mit »All good!« · **Messung 6 ist umgefallen**: die Browsersuite steht nach dem Sprung
  exakt wie davor — Chromium 0 Fehler, Firefox 24, `getSupportedExtensions` 92-mal.
  Die erwartete einzelne Firefox-Assertion in `vertex-objects-gpu-upload.test.js:144`
  ist damit gegenstandslos statt erledigt: Firefox bricht schon im
  `WebGPURenderer.init()` ab und kommt nie so weit. Der Grund steht in der
  fortgeschriebenen Zeile unter »Vorbestehende Fehler« · Gate `exit=0`
  (`paket-5.verify.log`), Browserlauf separat (`paket-5.browser.log`)
- Nebenbefunde: → Queue (2)
- Folgen: —
- Schnittstellen: `pnpm lintPkg` ist neu (Root-Script über `nx run-many -t lintPkg`,
  im Paket `cd dist && pnpm exec publint`) und steht in `pnpm run ci` zwischen
  `checkPkgTypes` und `test:ci`; das Gate lautet ab hier
  `clean → lint → build → checkPkgTypes → lintPkg → test:ci → test:browser` ·
  `pnpm test:ci` erzeugt jetzt Coverage nach `packages/twopoint5d/coverage`, das
  `test`-Target führt dieses Verzeichnis in `outputs`, und die Schwellen aus
  `packages/twopoint5d/vite.config.ts` lassen den Lauf rot werden, wenn die Abdeckung
  unter 65 / 58 / 58 / 65 fällt (`src/vertex-objects/**` 90 / 82 / 88 / 90,
  `src/texture/**` 70 / 60 / 60 / 70) — wer Code entfernt oder Specs streicht, sieht das
  hier zuerst · `vitest` und `@vitest/coverage-v8` stehen auf `^5.0.0`, `vite` löst als
  `8.x` auf · das Browser-Harness steht auf `@web/test-runner@^1.0.0`,
  `@web/test-runner-playwright@^1.0.0`, `@web/dev-server-esbuild@^2.0.0`, der
  Mocha-Timeout auf 10000 ms · `packages/*/coverage` ist in `.gitignore` und
  `.prettierignore` ausgenommen · beide Workflows installieren mit einem eigenen
  `pnpm install --frozen-lockfile` hinter `actions/setup-node` mit `cache: pnpm`; wer
  einen Schritt einfügt, hält diese Reihenfolge ein

**TEST-001 · medium · .github/workflows/ci.yml:32-34** — CI verpackt die Tests in
nick-fields/retry — Flakes werden maskiert

Der Test-Step läuft unter `nick-fields/retry@v3` mit `timeout_minutes: 2` und drei
Versuchen. Wiederholungslogik glättet Flakes, statt sie zu beheben. Über die Zeit gewöhnt
man sich an einen schwankenden CI-Status, und echte Regressionen verstecken sich hinter
»lief beim zweiten Versuch durch«.

Empfehlung: Retry-Wrapper entfernen. Werden dadurch Tests rot, den konkreten Flake
identifizieren — typischerweise einer der WebGPU-Browser-Tests unter `xvfb`. Notfalls
diesen einen Test in ein separates Nx-Target isolieren, das explizit als best-effort
markiert ist; der Hauptlauf bleibt deterministisch.

Der Rückfallweg »separates Nx-Target« wird nicht vorbereitet, sondern abgewartet: Nach
Messung 6 ist zu erwarten, dass die Browsersuite nach diesem Paket *weniger* schwankt als
vorher. Ein best-effort-Target auf Verdacht anzulegen hieße, die Ausnahme zu bauen, bevor
der Fall eingetreten ist.

**TEST-002 · medium · packages/twopoint5d/package.json** — Keine Coverage-Konfiguration

Kein `vitest --coverage`-Script, keine Coverage-Sektion in der Vitest-Config, keine
Provider-Wahl. Für eine Bibliothek mit Buffer-Manipulation und Cache-Logik ist Coverage
kein Selbstzweck, sondern Frühwarnsystem für ungetestete Grenzfälle: Pool-Resize,
TextureStore-Re-Parse, der Nachbar-Walk in CameraBasedVisibility.

Empfehlung: `@vitest/coverage-v8` aktivieren, Thresholds für `vertex-objects/` und
`texture/` setzen, initial niedrig ansetzen und schrittweise anheben. CI-Artefakt
hochladen für den historischen Verlauf.

Der Empfehlung wird in allen vier Punkten gefolgt; die Schwellen für die beiden genannten
Verzeichnisse stehen in Schritt 3, gemessen statt geschätzt.

**TEST-007 · low · packages/twopoint5d-testing/web-test-runner.config.js** —
Browser-Test-Timeout von 2 Sekunden ist für GPU-Init zu eng

Zwei Sekunden reichen für WebGPU-Adapter-Anforderung plus Shader-Kompilierung auf einem
kalten CI-Runner nicht verlässlich. Genau das speist den Flake, den TEST-001 wegretryt.

Empfehlung: Auf 5 bis 10 Sekunden anheben. Zusammen mit dem Entfernen des Retry-Wrappers
angehen — einzeln behebt keine der beiden Maßnahmen das Problem.

Ergänzung aus Zug 0: Die Vermutung, der 2-Sekunden-Timeout speise den Firefox-Ausfall
dieser Maschine, ist am 2026-09-04 widerlegt — mit den neuen Harness-Versionen und
unverändert 2000 ms läuft Firefox durch. Der Timeout steigt trotzdem, denn die Begründung
des Findings zielt auf den kalten CI-Runner und nicht auf diese Maschine.

**CFG-009 · info · .github/workflows/** — Kein expliziter pnpm-Store-Cache in den Workflows

`pnpm/action-setup@v4` läuft mit `run_install: true`, ohne vorgelagerten Caching-Step.

Empfehlung: `actions/cache` auf den pnpm-Store legen. Lohnt sich, sobald die CI-Läufe
häufiger werden.

Abweichung von dieser Empfehlung, bewusst: statt `actions/cache` von Hand auf den Store zu
legen, übernimmt `actions/setup-node` mit `cache: pnpm` denselben Dienst. Der Schritt steht
ohnehin in beiden Workflows, kennt den Lockfile-Hash als Schlüssel und den Store-Pfad
plattformabhängig; ein handgeschriebener Cache-Block müsste beides selbst führen und
verwahrlost erfahrungsgemäß beim nächsten Runner-Wechsel. Der Preis ist die
Schritt-Umsortierung aus Schritt 11.

**CFG-010 · info · .github/workflows/ci.yml** — publint und arethetypeswrong sind kein
blockendes Gate

`arethetypeswrong` läuft bereits über `checkPkgTypes`, ist aber nicht als Bedingung fürs
Veröffentlichen verdrahtet. `publint` fehlt ganz.

Empfehlung: Beide als blockenden Schritt vor dem Publish. Bei einer ESM-only-Bibliothek
mit synthetisiertem Publish-`package.json` ist das die günstigste Versicherung, die es
gibt.

Abgleich aus Zug 0: Die erste Hälfte trifft nicht mehr zu. `publishNpmPkg` in
`packages/twopoint5d/package.json:53` ruft `checkPkgTypes` als erstes Glied auf, und
`deploy.yml:33` fährt genau dieses Script — `attw` blockiert das Veröffentlichen also
bereits. Offen ist allein `publint`, und das wird in beiden Ketten verdrahtet: im
`ci`-Script und vor dem Publish.

### [x] 6. Strikte Nullability, Teil 1: Fundament und der vertex-objects-Kern

- Findings: CFG-001 (high, Teil 1), CFG-002 (medium, Teil 1)
- Ziel: Ein Migrationspfad steht, über den einzelne Verzeichnisse bereits unter
  `strictNullChecks` und `noUncheckedIndexedAccess` geprüft werden; `vertex-objects/`
  und `sprites/` sind der erste Bereich, der ihn durchläuft.
- Bereich: `packages/twopoint5d/tsconfig.strict.json` (neu),
  `packages/twopoint5d/package.json`, `packages/twopoint5d/src/vertex-objects/`,
  `packages/twopoint5d/src/sprites/`, `packages/twopoint5d/src/texture/TextureAtlas.ts`,
  `packages/twopoint5d/CHANGELOG.md` — nur Produktivcode, keine Specs
- Hängt ab von: Paket 1
- Hinweis: Hier entstehen die Typ-Breaking-Changes an der öffentlichen API. Gemessen
  sind rund 110 Fehler im Produktivcode dieser beiden Verzeichnisse. Jede Signatur, die
  sich ändert, wird für das CHANGELOG festgehalten.
- Hinweis (aus Paket 1): `packages/twopoint5d/tsconfig.build.json` erbt alles aus
  `packages/twopoint5d/tsconfig.json` und fügt nur das Spec-`exclude` hinzu. Ein Schalter,
  der in der Projektdatei umgelegt wird, erreicht den Emit-Build damit von selbst. Die
  Migrations-Config dieses Pakets darf umgekehrt **nicht** in dieser Erbkette hängen — sie
  prüft nur, sie emittiert nicht.
- Hinweis (Zug 0 von Paket 3): Hier wird die Rückfrage zu `three` und `@types/three`
  fällig, die als Eintrag unter »Offene Befunde« liegt (`~0.183.1`, aktuell 0.185).
  Der Grund ist dieses Paket selbst: `@types/three` liefert die Typen, gegen die die
  rund 600 Strictness-Fehler der Pakete 6 bis 8 gezählt sind, und ein Minor-Sprung
  verschiebt diese Zählung. Zug 0 dieses Pakets misst die Fehler ohnehin neu und
  entscheidet die Frage deshalb mit Zahlen statt auf Verdacht — sie an den Nutzer zu
  geben, gehört an diese Stelle und nicht früher.
- Hinweis (Zug 0 von Paket 6): Die Zahlen aus den Hinweisen darüber sind am
  2026-09-04 nachgemessen und fallen anders aus. Beide Schalter zusammen über
  `packages/twopoint5d/tsconfig.json` ergeben 593 Fehler, nicht »rund 600«, und sie
  verteilen sich als 193 im Produktivcode und 400 in den Specs — nicht 110 / 120 / 370.
  Dieses Paket trägt davon 57. Die Verschiebung sitzt also nicht in der Summe, sondern
  im Schnitt: die Specs wiegen schwerer und der Produktivcode leichter als geschätzt.
  Die Rückfrage zu `three` und `@types/three` ist gestellt, beantwortet und steht unter
  »Entscheidungen«; ihr Grund trägt nicht — der Sprung auf `@types/three@0.185.4`
  verschiebt die Zählung um exakt null Fehler.
- Hash: c67ef74
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/tsconfig.strict.json` (neu),
  `packages/twopoint5d/package.json`,
  `packages/twopoint5d/src/vertex-objects/expectDefined.ts` (neu),
  `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts`,
  `packages/twopoint5d/src/texture/TextureAtlas.ts`,
  `packages/twopoint5d/CHANGELOG.md`, dazu die 17 Dateien unter
  `src/vertex-objects/` und `src/sprites/`, die Fehler tragen — aufgezählt in der
  Fehlerliste am Ende dieses Abschnitts. Zwei weitere werden mit geändert, ohne selbst
  einen Fehler zu tragen, weil ihre Deklarationen die Fehler anderswo auslösen:
  `packages/twopoint5d/src/vertex-objects/types.ts` (das `VO`-Interface) und
  `packages/twopoint5d/src/vertex-objects/VertexObjects.ts` (die Basisklasse), beide in
  Schritt 6
- Vorgehen:

  1. **`packages/twopoint5d/tsconfig.strict.json` anlegen**, genau mit diesem Inhalt:

     ```json
     {
       // Prüft nur, emittiert nicht: die beiden Schalter gelten hier für einen Ausschnitt
       // der Quellen, während `tsconfig.json` und der Emit-Build über `tsconfig.build.json`
       // ohne sie laufen. Der Ausschnitt wächst mit jedem Verzeichnis, das fehlerfrei
       // darunter steht, und die Datei verschwindet, sobald beide Schalter in
       // `tsconfig.json` selbst stehen.
       "extends": "./tsconfig.json",
       "compilerOptions": {
         "noEmit": true,
         "strictNullChecks": true,
         "noUncheckedIndexedAccess": true
       },
       "include": ["src/vertex-objects", "src/sprites"],
       "exclude": ["src/**/*.spec.ts"]
     }
     ```

     `include` bestimmt die Wurzeln, nicht den Prüfumfang: TypeScript zieht jede Datei
     mit ins Programm, die von einer Wurzel aus erreichbar ist, und meldet ihre Fehler
     mit. Die Hülle dieser beiden Verzeichnisse umfasst nach Schritt 3 genau zwei weitere
     Dateien — `src/texture/TextureAtlas.ts` und `src/texture/TextureCoords.ts` —, und
     nur die erste trägt Fehler. Deshalb steht `TextureAtlas.ts` im Bereich dieses Pakets,
     obwohl es nicht in einem der beiden Verzeichnisse liegt. Kein Eintrag im `include`
     holt es dazu; es kommt über den Import.

     Weder `nx.json` noch `packages/twopoint5d/project.json` werden angefasst. Der Named
     Input `sharedTsconfigs` zählt seine Dateien einzeln auf und globbt nicht, und die
     Prüfung ist kein Nx-Target — die neue Datei invalidiert also keinen Cache und braucht
     keinen Eintrag.

  2. **In `packages/twopoint5d/package.json` ein Script `strictCheck` aufnehmen**, in der
     Schreibweise der Nachbarn und direkt hinter `compile`:

     ```json
     "strictCheck": "pnpm tsc -p tsconfig.strict.json"
     ```

     Kein Nx-Target, kein Root-Script, kein Schritt in `ci.yml`: die Prüfung lebt drei
     Commits lang, und ihr Durchsetzungsfenster sind genau die Pakete 7 und 8, die sie
     beide in ihrem eigenen Verify-Gate fahren. Was in dieser Zeit an
     `src/vertex-objects/` oder `src/sprites/` bricht, bricht dort und nirgendwo sonst.
     Das Script gibt der Config einen Aufrufer und macht sie über `pnpm run` auffindbar;
     Paket 8 nimmt beide wieder heraus.

  3. **Den Barrel-Import in `src/sprites/TexturedSprites/TexturedSprite.ts:2` auflösen.**
     Die Zeile lautet

     ```ts
     import {voInitialize} from '../../index.js';
     ```

     und wird zu

     ```ts
     import {voInitialize} from '../../vertex-objects/constants.js';
     ```

     Dasselbe Symbol, dieselbe Datei dahinter — `voInitialize` ist in
     `src/vertex-objects/constants.ts:3` definiert und wird von `index.ts` nur
     weitergereicht. Er gehört vor den ersten `strictCheck`-Lauf, weil er über dessen
     Umfang entscheidet: `../../index.js` re-exportiert jede `public-api.ts` des Pakets,
     und damit zieht diese eine Zeile die gesamte Bibliothek in die Hülle von
     `src/sprites/`. Am 2026-09-04 gemessen — mit der Zeile umfasst die Prüfung alle acht
     Module und meldet 193 Fehler, ohne sie umfasst sie `vertex-objects/`, `sprites/` und
     zwei Dateien aus `texture/` und meldet 57. Die Auflösung nimmt außerdem den
     Modulzyklus `index.ts → sprites/public-api.ts → TexturedSprite.ts → index.ts`
     heraus, den ESM zwar trägt, den aber niemand braucht.

     Es ist die einzige Stelle dieser Art im ganzen Paket, Specs eingeschlossen: ein
     `grep -rn "from '\(\.\./\)\+index\.js'"` über `packages/twopoint5d/src` findet
     am 2026-09-04 genau diese eine Zeile.

  4. **`src/vertex-objects/expectDefined.ts` anlegen** — einen internen Helfer, der eine
     Invariante an der Fundstelle festhält, statt sie zu behaupten:

     ```ts
     /**
      * Returns the value, or throws if it is `null` or `undefined`.
      *
      * For lookups whose result is guaranteed by an invariant the type system cannot see —
      * two maps filled from the same list of names, an array index taken from the length of
      * the very collection it indexes. A broken invariant surfaces here, with the name of
      * what was missing, instead of as a property access on `undefined` a few frames later.
      */
     export function expectDefined<T>(value: T | null | undefined, what: string): T {
       if (value == null) {
         throw new Error(`expected ${what} to be defined`);
       }
       return value;
     }
     ```

     Die Datei wird **nicht** in `src/vertex-objects/public-api.ts` aufgenommen: sie ist
     intern, wie `createVertexObject.ts` und `initializeAttributes.ts` daneben auch.

  5. **Die Invarianten-Fundstellen über den Helfer führen.** Das ist die größte Gruppe:
     31 der 57 Fehler sind `TS18048` und `TS2532`. Sie entstehen daran, dass `Map#get()`
     schon unter `strictNullChecks` ein `V | undefined` liefert und
     `noUncheckedIndexedAccess` dasselbe für `arr[i]` tut.
     Angesetzt wird an der Bindung, nicht an jeder Benutzung — ein
     `const attrDesc = expectDefined(descriptor.attributes.get(name), …)` räumt alle
     Verwendungen darunter mit ab. Betroffen:

     - `src/vertex-objects/initializeAttributes.ts` (12 Fehler) und
       `src/vertex-objects/initializeInstancedAttributes.ts` (12) — die Bindungen
       `attributes`, `attrDesc` und `bufAttr`. Der Kommentar, der die Invariante bereits
       ausspricht (»both maps are filled from the same list of attribute names«), bleibt
       stehen; er begründet jetzt die Aufrufe darunter.
     - `src/vertex-objects/InstancedVOBufferGeometry.ts` (6) — `extraInstancedBuffers.get(name)`
       und `extraInstancedBufferSerials.get(name)` in den Schleifen über
       `extraInstancedPools`, dazu `selectAttributes(this.basePool, …)` in `touchAttributes()`.
       Ob `basePool` hier wirklich gesetzt ist, entscheidet der umgebende Code — steht die
       Schleife bereits in einem `if (this.basePool)`, ist das keine Invariante, sondern
       eine Prüfung, die TypeScript nur nicht bis in den Callback trägt; dann eine lokale
       Bindung vor der Schleife statt eines Helfer-Aufrufs.
     - `src/vertex-objects/GeometryAttributeSlots.ts` (3),
       `src/vertex-objects/VertexAttributeDescriptor.ts:54`,
       `src/vertex-objects/createIndicesArray.ts:8`,
       `src/vertex-objects/createVertexObjectPrototype.ts:36,61`,
       `src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:49` (`animsImage.width` und
       `.height` an einem `ImageData`, dessen Maße three.js als optional führt).

     Der Helfer ist die Voreinstellung, nicht die einzige Antwort. Kann ein Wert an einer
     Stelle legitim fehlen, gehört das in den Typ und wird behandelt — siehe Schritt 6.

  6. **Die Typen ehrlich machen, wo ein Wert wirklich fehlen kann.** So beschlossen am
     2026-09-04: kann etwas `undefined` liefern, steht das künftig in seiner Signatur,
     auch in der öffentlichen API. Diese Gruppe trägt 13 × `TS2322`, 7 × `TS2345` und
     4 × `TS2416`; eines der `TS2322` geht an Schritt 7 und nicht hierher:

     - `src/vertex-objects/VertexObjectPool.ts:141,150,151,163` — das private Feld
       `#voIndex` ist als `Array<VOType & VO>` deklariert, wird aber an drei Stellen mit
       `undefined` beschrieben, weil ein freigegebener Slot leer ist. Der Typ lautet
       `Array<(VOType & VO) | undefined>`. Privat, also keine API-Änderung.
     - `src/vertex-objects/types.ts` — `VO[voBuffer]` ist als `VertexObjectBuffer`
       deklariert, während `VOUtils.clearBuffer()` es auf `undefined` setzt und
       `VOUtils.getBuffer()` bereits `VertexObjectBuffer | undefined` zurückgibt. Der Typ
       lautet `VertexObjectBuffer | undefined`. Das räumt `VOUtils.ts:34,39` mit ab und
       ist eine öffentliche Typänderung.
     - `src/vertex-objects/VertexObjectBuffer.ts:83` — der Buffer-Datensatz wird mit
       `typedArray: undefined` angelegt und erst gefüllt, wenn jedes Attribut seinen
       Anteil an `itemSize` beigetragen hat. Entweder trägt der Datensatztyp das
       `| undefined`, oder die Konstruktion wird so umgestellt, dass das Feld bei der
       Anlage steht. Die zweite Variante ist die bessere, wenn sie ohne Umbau der
       Schleife zu haben ist; sie kostet keinen Typ an der Oberfläche.
     - `src/vertex-objects/VertexObjects.ts` — die Basisklasse deklariert
       `geometry: GeoType`, ihr Konstruktor nimmt `geometry?` entgegen, und die drei
       Ableitungen deklarieren `geometry` und `material` als `| undefined`. Daraus kommen
       die vier `TS2416` in `sprites/AnimatedSprites/AnimatedSprites.ts:8,9` und
       `sprites/TexturedSprites/TexturedSprites.ts:14,15`. Die Basis wird nachgezogen:
       `declare geometry: GeoType | undefined;` und ein `material`, das dasselbe sagt.
       Öffentliche Typänderung.
     - `src/texture/TextureAtlas.ts:74,88` — `randomFrame()` und `randomFrameName()`
       geben für einen leeren Atlas nichts zurück, und der Kommentar an Zeile 87 sagt es
       bereits. Beide Rückgabetypen bekommen ihr `| undefined`. Öffentliche Typänderung.
     - `src/sprites/matrixColumn.ts:9` und
       `src/vertex-objects/InstancedVertexObjectGeometry.ts:39` — je ein Argument, das
       als `| undefined` ankommt. Hier entscheidet die Fundstelle, ob der Aufrufer den
       Wert prüfen muss oder ob die aufgerufene Signatur das `| undefined` annehmen soll.

  7. **`!` nur im Schleifeninneren, und nur mit einer Zeile Begründung daneben.**
     `src/vertex-objects/VertexObjectBuffer.ts:168` liegt in einer dreifach
     verschachtelten Kopierschleife, deren eigene Schranke (`idx + k < data.length`) den
     Index garantiert. Ein Helfer-Aufruf je Element wäre hier ein Preis pro Zahl statt pro
     Attribut. An solchen Stellen steht ein `!` mit einem Kommentar, der die Schranke
     benennt. Ein `!` außerhalb eines Element-Loops ist ein Review-Befund.

  8. **Die beiden `TS2564` sind Deklarationen, keine Logik.**
     `src/vertex-objects/VOBufferPool.ts:9` (`buffer`) und
     `src/vertex-objects/VertexObjectDescriptor.ts:13` (`voPrototype`). Beim ersten ist
     nachzusehen, ob der Konstruktor das Feld auf jedem Zweig belegt — dann wird die
     Zuweisung so gestellt, dass TypeScript sie sieht, statt sie zu behaupten. Beim
     zweiten ist die Zuweisung echt verzögert (der Kommentar »lazy initialization!!« sagt
     es und nennt den Initialisierer); dort ist `voPrototype!: object;` richtig, und der
     Kommentar bleibt.

  9. **Kein Laufzeitverhalten ändert sich.** Diese Regel gilt über allen Schritten: Ziel
     ist, dass der Compiler sieht, was der Code ohnehin tut. Die einzige erlaubte
     Ausnahme ist der `throw` aus Schritt 4 — er greift nur, wenn eine Invariante bereits
     gebrochen ist, und ersetzt dort einen Zugriff auf `undefined` durch eine Meldung, die
     sagt, was fehlte. Verlangt eine Fundstelle darüber hinaus eine Verhaltensänderung,
     wird sie gemeldet und nicht umgesetzt: dann steht dort ein Defekt, und ein Defekt
     gehört in ein Paket, das ihn mit einem roten Test einleitet.

  10. **`packages/twopoint5d/CHANGELOG.md` fortschreiben**, unter `## [Unreleased]`. Jede
      öffentliche Signatur aus Schritt 6 bekommt ihren Eintrag unter `### Changed`, und
      jede, die einen Konsumenten unter `strictNullChecks` zum Nachbessern zwingt,
      zusätzlich einen `####`-Abschnitt unter `### Migration Guide`. Die Form steht
      nebenan: `#### VertexObjectPool#createVO() can return undefined` ist der Vorgänger
      derselben Machart. Der Skill `updating-changelog` gilt.

  11. **`pnpm format` fahren**, Umbrüche und Einrückung nicht von Hand setzen. Prettier
      erhält Kommentare in `tsconfig.strict.json` — am 2026-09-04 nachgemessen, `--check`
      läuft über eine JSONC-Datei sauber durch.

  12. **Die Coverage-Schwellen aus Paket 5 sind die enge Stelle dieses Pakets**, und zwar
      an einer Zahl: `src/vertex-objects/**` steht heute bei 88.28 % Branch-Coverage
      (354 von 401) gegen eine Schwelle von 82. Bis dorthin sind es rund 30 zusätzliche
      **nicht** abgedeckte Zweige — und jede `if (x == null)`-Prüfung, die kein Test
      auslöst, ist einer. Genau deshalb steht in Schritt 5 ein gemeinsamer Helfer und
      nicht ein Zweig je Fundstelle: 15 Aufrufe kosten einen ungedeckten Zweig, 15
      eigene Prüfungen kosten fünfzehn. Lines (96.66 %, Schwelle 90) und Functions
      (94.81 %, Schwelle 88) haben mehr Luft, aber nicht beliebig viel. Reißt die
      Schwelle trotzdem, ist das ein Befund für den Report — die Schwellen selbst gehören
      Paket 9 und werden hier nicht angefasst.
- Nachweis statt Regressionstest: Das ist ein Konfigurations- und Typdefekt, kein
  Laufzeitfehler — es gibt keine Zusicherung im Code, die vorher rot sein könnte, und ein
  Test gegen `undefined` an einer Stelle, die der Compiler ab jetzt selbst abfängt, prüfte
  den Compiler. Der Beleg sind drei Zahlen, alle am 2026-09-04 im Ist-Zustand gemessen und
  alle in den Report:
  - `pnpm --filter @spearwolf/twopoint5d run strictCheck` fällt von 57 Fehlern auf 0.
    Die 57 sind einzeln aufgezählt, siehe die Fehlerliste am Ende dieses Abschnitts.
  - `pnpm exec tsc -p packages/twopoint5d/tsconfig.json --noEmit --strictNullChecks
    --noUncheckedIndexedAccess` steht heute bei 593. Die Zahl danach gehört in den
    Report, aber **nicht** ins Gate: die Signaturen aus Schritt 6 werden außerhalb dieses
    Pakets neue Fehler sichtbar machen, und das ist der Zweck der Übung, nicht ihr
    Scheitern. Jede Fundstelle, die dabei neu auftaucht, kommt mit Datei und Zeile als
    Folge in den Report und wird Paket 7 zugeschlagen.
  - Die Vitest-Runde bleibt bei 45 Dateien / 703 Tests. Ändert sich diese Zahl, hat das
    Paket Testcode angefasst, und das tut es nicht.
- Verify (das Gate, muss `exit=0` liefern):
  `pnpm clean && pnpm lint && pnpm --filter @spearwolf/twopoint5d run strictCheck && pnpm build && pnpm checkPkgTypes && pnpm lintPkg && NX_TUI=false pnpm nx run twopoint5d:test`
- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm test:browser`. Maßstab ist die
  Zeile unter »Vorbestehende Fehler« in der nach Paket 5 gemessenen Fassung — Chromium
  0 Fehler, Firefox 24. Diese Runde zählt hier mehr als in den Paketen davor: sie ist das
  Einzige, was den Kern dieses Pakets gegen eine echte GPU fährt, und `vertex-objects/`
  ist genau der Code, den sie belastet. Jeder neue Fehler unter Chromium geht zurück in
  die Fehlerkette.
- Commit: `refactor(twopoint5d): make nullability explicit in the vertex-object core`
- Ergebnis: 2 Runden · CFG-001 und CFG-002 im Umfang dieses Pakets behoben ·
  `packages/twopoint5d/tsconfig.strict.json` prüft `src/vertex-objects` und `src/sprites`
  unter beiden Schaltern, aufrufbar über `pnpm --filter @spearwolf/twopoint5d run
  strictCheck` · kein Regressionstest, der Nachweis sind drei selbst gemessene Zahlen:
  `strictCheck` 57 → 0, der volle Zählauf mit beiden Schaltern 593 → 537, die Vitest-Runde
  unverändert bei 45 Dateien / 703 Tests · Gate `exit=0`
  (`paket-6.verify.log`; das `test`-Target kam dort aus dem Nx-Cache und wurde deshalb mit
  `--skip-nx-cache` eigens nachgefahren, `paket-6.test-uncached.log`) · Browsersuite
  `paket-6.browser.log`: Chromium 0 Fehler, Firefox 24, Fehlermenge zeichenweise
  deckungsgleich mit dem Lauf nach Paket 5 · Branch-Coverage `src/vertex-objects/**`
  88.47 % (353/399) gegen Schwelle 82, gestiegen, weil zwei nie genommene Zweige entfielen
- Abweichung vom Detailplan (Schritt 7): Die vier generierten Attribut-Accessoren in
  `src/vertex-objects/createVertexObjectPrototype.ts` behalten `!` statt des Helfers, je
  mit einem Kommentar, der die Lebensdauer-Invariante ausspricht. Schritt 7 begründet
  seine Regel mit »ein Preis pro Zahl statt pro Attribut« und hält einen Helfer-Aufruf je
  Attributzugriff für vernachlässigbar; der Reviewer hat das Gegenteil gemessen — 1,25×
  bis 1,33× über 3·10⁷ Setter-Aufrufe gegen einen `Float32Array`. Der Attributzugriff
  selbst ist hier der heiße Pfad, die Grenze verläuft also eine Ebene höher, als der
  Schritt annahm. Das `!` an dieser Bindung stand bereits vor dem Umbau; zurückgenommen
  wird nichts, was dieses Paket eingebracht hätte. Der Preis ist benannt: auf einem
  freigegebenen Vertex-Objekt meldet sich dort wieder ein `TypeError` statt der benannten
  Meldung aus `expectDefined()`
- Kleine Befunde, offen gelassen: `src/sprites/matrixColumn.ts:13` löst seine Fundstelle
  über einen Cast statt über eine der beiden vom Plan angebotenen Antworten — die Zeile
  castet ohnehin durch ein Typloch, die Invariante steht als Kommentar daneben ·
  `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts:62` — der Kommentar deckt
  `randomFrame()`, nicht aber `textureAtlas.get(frameId)`; dort trägt eine andere
  Invariante · `src/vertex-objects/InstancedVOBufferGeometry.ts:41-43` — die beiden
  `readonly` Maps sind von außen mutierbar, wer an `detachInstancedPool()` vorbei löscht,
  bekommt jetzt einen Error statt eines stillen Skips; beschlossene Wirkung, in den
  Feldkommentaren angeschrieben
- Nebenbefunde: → »Offene Befunde«, fünf Einträge
- Folgen: `packages/twopoint5d/src/texture/TextureAtlas.spec.ts:189` (TS2345, aus
  `randomFrameName()`) · `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:164`
  und `:171` (je TS2532, aus `VO[voBuffer]`) — alle drei in Specs und damit Paket 8.
  Die vier Aufrufer im Produktivcode und im Lookbook, die dieser Umbau falsch gemacht hat,
  sind mitgezogen und in diesem Commit enthalten:
  `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro:99`,
  `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts:62`,
  `apps/lookbook/src/demos/crosses/Crosses.ts:88`. Gutschrift in die andere Richtung:
  `packages/twopoint5d/src/map2d/TileSprites/TileSprites.ts:6,7` sind mit der Basisklasse
  mit erledigt — zwei Fundstellen weniger für Paket 7
- Schnittstellen: `VO[voBuffer]` ist `VertexObjectBuffer | undefined` · `getDescriptorOf()`
  gibt `VertexObjectDescriptor | undefined` · `VertexObjects<GeoType>` erbt von
  `THREE.Mesh<any, any>`, `geometry` ist `GeoType | undefined`, `material` ist
  `Material | Material[] | undefined` · `TextureAtlas#randomFrame()` und
  `#randomFrameName()` geben `… | undefined`, `#randomFrames()` und `#randomFrameNames()`
  Arrays desselben Elementtyps · intern: `updateUpdateRange(pool, buffers)` nimmt beide
  Argumente auch fehlend · `expectDefined<T>(value, what): T` in
  `src/vertex-objects/expectDefined.ts` wirft mit dem Namen des Fehlenden, ist bewusst
  **nicht** in `public-api.ts` und gehört nicht in die generierten Attribut-Accessoren ·
  `VOBufferPool#fromBuffersData()` setzt einen bereits gebauten `buffer` voraus, den der
  Konstruktor auf beiden Zweigen belegt · in `InstancedVOBufferGeometry` gilt der Lookup
  `extraInstancedBuffers.get(name)` innerhalb einer Schleife über `extraInstancedPools`
  als Invariante und wirft; nur `#detachRoute()` behandelt ihn als optional, weil sein
  Name von außen kommt · das Script `strictCheck` und `tsconfig.strict.json` existieren
  ab hier und verschwinden mit Paket 8

**CFG-001 · high · tsconfig.json:39-40** — strictNullChecks ist deaktiviert, trotz
strict: true

Die Config setzt global `strict: true` und schaltet zwei Zeilen darunter
`strictNullChecks: false`. Damit sind sämtliche Null- und Undefined-Prüfungen für den
Compiler unsichtbar. Konkret spürbar in API-001, wo `createVO()` ein Objekt verspricht und
`undefined` liefert, und in mehreren Signals vom Typ `Signal<T | undefined>`, deren
Konsumenten ungeprüft auf `.value` zugreifen. Der mit Abstand hebelstärkste Punkt dieser
Liste.

Empfehlung: `strictNullChecks: true` setzen. Es fallen erwartungsgemäß viele Fehler an —
inkrementell beheben, notfalls modulweise über eine separate tsconfig-Erweiterung
migrieren. Danach werden echte Null-Defekte vom Compiler gemeldet statt im Code-Review
gesucht.

Abgleich am 2026-09-04: der Sachverhalt steht unverändert, die Zeilennummer ist heute
`tsconfig.json:40`. Das Beispiel aus der Beschreibung trägt nicht mehr —
`VertexObjectPool#createVO()` gibt an `VertexObjectPool.ts:99` bereits
`(VOType & VO) | undefined` zurück, ein früherer Lauf hat die Signatur ehrlich gemacht.
Was bleibt, sind die Aufrufer: `map2d/TileSprites/TileSpritesGeometry.ts:17` dereferenziert
den Rückgabewert ungeprüft, und genau diese Stelle wird unter dem Schalter zum
Compilerfehler. Sie liegt in Paket 7. Der zweite Teil der Beschreibung — Signals vom Typ
`Signal<T | undefined>` — sitzt in `texture/TextureResource.ts` und ebenfalls in Paket 7.
Die empfohlene »separate tsconfig-Erweiterung« ist der Weg dieses Pakets, Schritt 1.

**CFG-002 · medium · tsconfig.json** — noUncheckedIndexedAccess ist nicht aktiviert

Array- und Index-Zugriffe gelten als immer definiert, auch wenn der Index außerhalb der
Grenzen liegen kann. Im Buffer-Kern und in `map2d/` mit ihrer manuellen Index-Arithmetik
ist das in Kombination mit CFG-001 ein doppeltes Leck.

Empfehlung: Aktivieren, sinnvollerweise im selben Durchgang wie CFG-001 — viele
Fundstellen profitieren von beiden Schaltern gleichzeitig.

Abgleich am 2026-09-04: unverändert, der Schalter fehlt in `tsconfig.json` weiterhin
ganz. Die Empfehlung, beide gemeinsam zu ziehen, ist übernommen und bestimmt den Schnitt
der Pakete 6 bis 8: von den 57 Fundstellen dieses Pakets fallen 42 schon unter
`strictNullChecks` allein an, die restlichen 15 kommen erst mit `noUncheckedIndexedAccess`
dazu. Über das ganze Paket gerechnet sind es 461 gegen 593. Getrennt zu ziehen hieße,
`initializeAttributes.ts` und `initializeInstancedAttributes.ts` zweimal anzufassen — dort
liegen beide Sorten in denselben Zeilen.

**Die 57 Fundstellen**, gemessen am 2026-09-04 mit beiden Schaltern, Zeilen und
Fehlercodes an einer Kopie mit aufgelöstem Barrel-Import gegengeprüft. Pfade relativ zu
`packages/twopoint5d/`:

```
src/sprites/AnimatedSprites/AnimatedSprites.ts(8,11)             TS2416
src/sprites/AnimatedSprites/AnimatedSprites.ts(9,11)             TS2416
src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts(49,35)    TS18048
src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts(49,59)    TS18048
src/sprites/TexturedSprites/TexturedSprites.ts(14,11)            TS2416
src/sprites/TexturedSprites/TexturedSprites.ts(15,11)            TS2416
src/sprites/matrixColumn.ts(9,85)                                TS2322
src/texture/TextureAtlas.ts(74,5)                                TS2322
src/texture/TextureAtlas.ts(88,5)                                TS2322
src/vertex-objects/GeometryAttributeSlots.ts(65,70)              TS2532
src/vertex-objects/GeometryAttributeSlots.ts(91,42)              TS18048
src/vertex-objects/GeometryAttributeSlots.ts(93,41)              TS2532
src/vertex-objects/InstancedVOBufferGeometry.ts(364,39)          TS2345
src/vertex-objects/InstancedVOBufferGeometry.ts(506,41)          TS2345
src/vertex-objects/InstancedVOBufferGeometry.ts(514,32)          TS2345
src/vertex-objects/InstancedVOBufferGeometry.ts(519,23)          TS2345
src/vertex-objects/InstancedVOBufferGeometry.ts(524,31)          TS2345
src/vertex-objects/InstancedVOBufferGeometry.ts(584,57)          TS2345
src/vertex-objects/InstancedVertexObjectGeometry.ts(39,29)       TS2345
src/vertex-objects/VOBufferPool.ts(9,3)                          TS2564
src/vertex-objects/VOUtils.ts(34,5)                              TS2322
src/vertex-objects/VOUtils.ts(39,5)                              TS2322
src/vertex-objects/VertexAttributeDescriptor.ts(54,12)           TS2532
src/vertex-objects/VertexObjectBuffer.ts(83,13)                  TS2322
src/vertex-objects/VertexObjectBuffer.ts(168,15)                 TS2322
src/vertex-objects/VertexObjectDescriptor.ts(13,3)               TS2564
src/vertex-objects/VertexObjectPool.ts(141,7)                    TS2322
src/vertex-objects/VertexObjectPool.ts(150,7)                    TS2322
src/vertex-objects/VertexObjectPool.ts(151,7)                    TS2322
src/vertex-objects/VertexObjectPool.ts(163,7)                    TS2322
src/vertex-objects/createIndicesArray.ts(8,32)                   TS2532
src/vertex-objects/createVertexObjectPrototype.ts(36,9)          TS2322
src/vertex-objects/createVertexObjectPrototype.ts(61,9)          TS2322
src/vertex-objects/initializeAttributes.ts(26,9)                 TS18048
src/vertex-objects/initializeAttributes.ts(31,29)                TS18048
src/vertex-objects/initializeAttributes.ts(33,72)                TS18048
src/vertex-objects/initializeAttributes.ts(33,103)               TS18048
src/vertex-objects/initializeAttributes.ts(35,31)                TS18048
src/vertex-objects/initializeAttributes.ts(36,21)                TS18048
src/vertex-objects/initializeAttributes.ts(39,23)                TS18048
src/vertex-objects/initializeAttributes.ts(40,50)                TS18048
src/vertex-objects/initializeAttributes.ts(41,95)                TS18048
src/vertex-objects/initializeAttributes.ts(43,19)                TS18048
src/vertex-objects/initializeAttributes.ts(46,29)                TS18048
src/vertex-objects/initializeAttributes.ts(47,19)                TS18048
src/vertex-objects/initializeInstancedAttributes.ts(21,9)        TS18048
src/vertex-objects/initializeInstancedAttributes.ts(30,29)       TS18048
src/vertex-objects/initializeInstancedAttributes.ts(32,72)       TS18048
src/vertex-objects/initializeInstancedAttributes.ts(32,103)      TS18048
src/vertex-objects/initializeInstancedAttributes.ts(34,31)       TS18048
src/vertex-objects/initializeInstancedAttributes.ts(35,21)       TS18048
src/vertex-objects/initializeInstancedAttributes.ts(38,23)       TS18048
src/vertex-objects/initializeInstancedAttributes.ts(39,50)       TS18048
src/vertex-objects/initializeInstancedAttributes.ts(43,9)        TS18048
src/vertex-objects/initializeInstancedAttributes.ts(47,19)       TS18048
src/vertex-objects/initializeInstancedAttributes.ts(50,29)       TS18048
src/vertex-objects/initializeInstancedAttributes.ts(51,19)       TS18048
```

Die Zeilennummern gelten für den Stand `d011232`. Verschiebt eine Änderung sie, gilt die
Datei plus der Fehlercode; die Liste ist der Umfang, nicht die Landkarte.

### [x] 7. Strikte Nullability, Teil 2: die übrigen Module

- Findings: CFG-001 (high, Teil 2), CFG-002 (medium, Teil 2)
- Ziel: `map2d/`, `texture/`, `stage/`, `display/`, `controls/` und `utils/` sind unter
  beiden Schaltern fehlerfrei.
- Bereich: `packages/twopoint5d/src/` außer `vertex-objects/` und `sprites/`
  (nur Produktivcode), dazu `packages/twopoint5d/tsconfig.strict.json`,
  `packages/twopoint5d/CHANGELOG.md` und die sechs Importzeilen aus Schritt 2
- Hängt ab von: Paket 6
- Hinweis: Rund 120 Fehler. `map2d/chunk-quad-tree/` und `RepeatingTilesProvider` tragen
  den Löwenanteil der Index-Arithmetik.
- Hinweis (Zug 0 von Paket 6): Am 2026-09-04 nachgemessen sind es 138, und zwei davon
  nimmt Paket 6 mit — `src/texture/TextureAtlas.ts` liegt in der Import-Hülle seiner
  Migrations-Config und wird dort mit sauber. Bleiben 136: `map2d/` 75, `texture/` 27,
  `stage/` 21, `display/` 7, `utils/` 3, `controls/` 3. Die Zahl ist ein Boden und keine
  Decke. Paket 6 verbreitert öffentliche Signaturen — `VertexObjects#geometry` und
  `#material`, `VO[voBuffer]`, `TextureAtlas#randomFrame()` und `#randomFrameName()` —,
  und was davon außerhalb seines Bereichs bricht, kommt als Folge hierher; sein Report
  zählt jede Fundstelle mit Datei und Zeile auf. Zwei stehen schon fest:
  `src/map2d/TileSprites/TileSpritesGeometry.ts:17` dereferenziert den Rückgabewert von
  `createVO()` ungeprüft, und `src/texture/TextureResource.ts:132,152,155` halten drei
  Signals, deren Typ die Optionalität ihres Werts nicht trägt. Beide sind Audit-Findings
  aus Kategorien, die dieser Lauf nicht führt; der Schalter macht sie hier trotzdem zur
  Pflicht, weil sonst nichts kompiliert. Zum Vorgehen: die Migrations-Config aus Paket 6
  wird erweitert und nicht ersetzt — ihr `include` wächst auf `["src"]`, das
  Spec-`exclude` bleibt stehen. Der Helfer `src/vertex-objects/expectDefined.ts` steht
  bereit und bleibt intern.
- Hinweis (Ergebnis von Paket 6, c67ef74): Die 136 sind auf **134** gesunken. Paket 6 hat
  `src/texture/TextureAtlas.ts` (2) wie angekündigt mit erledigt, und die Basisklasse
  `VertexObjects` hat `src/map2d/TileSprites/TileSprites.ts:6,7` gratis mit abgeräumt.
  Neue Fundstellen im Produktivcode außerhalb von Paket 6 sind **keine** entstanden: der
  volle Zählauf steht bei 537, und die drei neuen Stellen liegen sämtlich in Specs und
  damit in Paket 8. Die beiden vorab genannten Pflichtstellen —
  `src/map2d/TileSprites/TileSpritesGeometry.ts:17` und
  `src/texture/TextureResource.ts:132,152,155` — stehen unverändert. Die
  `Schnittstellen:`-Zeile von Paket 6 nennt, wogegen dieses Paket compiliert; besonders
  `expectDefined()` ist der bereitstehende Helfer, und die dort protokollierte Abweichung
  gilt weiter: in einen Pfad, der pro Frame und pro Objekt läuft, gehört er nicht.
- Hinweis (Zug 0 von Paket 7): Die 134 sind am 2026-09-04 gegen `c67ef74` bestätigt, und
  zwar zweifach — einmal als Differenz des vollen Zählaufs (537 minus 403 Spec-Fehler) und
  einmal direkt, mit einer Probekopie der Migrations-Config, deren `include` bereits auf
  `["src"]` steht. Sie verteilen sich auf 23 Dateien: `map2d/` 73, `texture/` 27,
  `stage/` 21, `display/` 7, `utils/` 3, `controls/` 3.
  Das Paket bleibt trotz seiner Größe ungeteilt. Der Grund ist nicht Mut, sondern der
  Aufbau der 134: hinter ihnen stehen sechs Muster und keine 134 Entscheidungen — 58-mal
  ein Element- oder Map-Zugriff, 14-mal ein Feld mit verzögerter Zuweisung, der Rest
  verteilt sich auf vier weitere Gruppen, die das Vorgehen unten je einmal beantwortet.
  Der Zuschnitt der Arbeit liegt deshalb in den Gruppen, nicht in einer zweiten
  Paketnummer.
  Das Paket zieht außerdem drei Dinge an sich, die der Grobplan nicht kannte: den
  Umzug des Helfers aus Schritt 2 (ohne ihn gäbe es einen Modulzyklus), den Eintrag
  `packages/twopoint5d/src/texture/TextureAtlas.ts:53` aus »Offene Befunde« (Schritt 9)
  und die CHANGELOG-Pflege für vier öffentliche Typänderungen.
- Hash: ac64b5a
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/tsconfig.strict.json`,
  `packages/twopoint5d/src/utils/expectDefined.ts` (neu, aus `vertex-objects/` verschoben),
  `packages/twopoint5d/CHANGELOG.md`, die 23 Dateien mit Fundstellen (aufgezählt in der
  Fehlerliste am Ende dieses Abschnitts), dazu die sechs Importzeilen in
  `src/vertex-objects/createIndicesArray.ts`, `GeometryAttributeSlots.ts`,
  `InstancedVOBufferGeometry.ts`, `InstancedVertexObjectGeometry.ts`,
  `initializeAttributes.ts` und `initializeInstancedAttributes.ts`
- Vorgehen:

  1. **`packages/twopoint5d/tsconfig.strict.json`: `include` auf `["src"]` setzen.** Eine
     Zeile, sonst nichts an dieser Datei — `noEmit`, beide Schalter und
     `"exclude": ["src/**/*.spec.ts"]` bleiben, wie sie stehen. Der Kommentar im Kopf
     beschreibt den wachsenden Ausschnitt und trägt weiterhin. Am 2026-09-04 mit einer
     Probekopie gemessen: die Config meldet in dieser Form genau die 134 Fundstellen aus
     der Liste am Ende dieses Abschnitts und keine weitere. `nx.json` und
     `packages/twopoint5d/project.json` werden nicht angefasst, aus demselben Grund wie in
     Paket 6.

  2. **`src/vertex-objects/expectDefined.ts` nach `src/utils/expectDefined.ts` verschieben**
     und die sechs Importzeilen mitziehen: `src/vertex-objects/createIndicesArray.ts`,
     `GeometryAttributeSlots.ts`, `InstancedVOBufferGeometry.ts`,
     `InstancedVertexObjectGeometry.ts`, `initializeAttributes.ts`,
     `initializeInstancedAttributes.ts`. Inhalt der Datei unverändert, Aufnahme in
     `src/utils/public-api.ts` findet **nicht** statt — der Helfer bleibt intern, wie er es
     in `vertex-objects/` war.

     Der Umzug ist keine Kosmetik, sondern die Voraussetzung dafür, dass dieses Paket den
     Helfer überhaupt benutzen darf. Die Modulschichtung des Pakets, am 2026-09-04 über
     alle Quell-Importe gemessen: `utils/` und `display/` importieren aus keinem anderen
     Modul, `texture/` nur aus `utils/`, `controls/` nur aus `display/`, `stage/` aus
     `display/` und `texture/`, `map2d/` aus `sprites/`, `texture/`, `utils/` und
     `vertex-objects/`; `vertex-objects/` und `sprites/` importieren aus `texture/` und
     voneinander. Ein Import von `utils/` nach `vertex-objects/` schlösse damit den Kreis
     `utils → vertex-objects → texture → utils`. In `utils/` steht der Helfer dort, wo ihn
     jedes Modul erreichen darf, ohne dass eine Kante zurückläuft.

     Der Rest dieses Schritts ist Buchhaltung: `pnpm --filter @spearwolf/twopoint5d run
     strictCheck` muss nach dem Umzug dieselben 134 Fehler melden wie davor. Tut er es
     nicht, ist eine Importzeile falsch.

  3. **Gruppe A — Element- und Map-Zugriff, dessen Schranke im Code danebensteht: `!` mit
     einer Zeile Begründung.** 58 der 134 Fundstellen tragen `TS2532` oder `TS18048`; sie
     entstehen daran, dass `noUncheckedIndexedAccess` aus `arr[i]` ein `T | undefined`
     macht und `strictNullChecks` dasselbe für `map.get()` tut. Der größere Teil davon
     fällt in diese Gruppe, der Rest in C und D. Wo der Index aus der Länge
     ebenderselben Sammlung stammt — `for (let i = 0; i < xs.length; i++)`, `arr[i % n]`
     mit `n === arr.length` —, ist die Schranke zwei Zeilen darüber sichtbar und der Wert
     kann nicht fehlen.

     Angesetzt wird an der Bindung, nicht an jeder Benutzung: ein `const tile = xs[i]!;`
     räumt alle Verwendungen darunter mit ab. Daneben steht ein Kommentar, der die
     Schranke benennt, nicht die Sprache erklärt — »the loop bound is `visibles.length`«
     trägt, »TypeScript cannot see this« nicht.

     Kein `expectDefined()` in dieser Gruppe. Der Reviewer von Paket 6 hat den Preis eines
     Helfer-Aufrufs je Element gemessen — 1,25× bis 1,33× über 3·10⁷ Aufrufe —, und die
     Stellen hier liegen in genau solchen Pfaden: `ChunkQuadTreeNode.findChunks()` ist im
     eigenen Kommentar als »hot path, per-frame visibility queries« ausgewiesen,
     `CameraBasedVisibility.findVisibleTiles()` läuft je Frame über alle sichtbaren
     Kacheln, `RepeatingTilesProvider.getTileIdAt()` je Kachel.

     Betroffen sind:
     - `src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` — `chunks[i]` in `scoreAxis()`
       (26–36), in `findAxis()` (61–68), in der Partitionsschleife von `subdivide()`
       (169–181) und `local[i]` in `findChunks()` (245–252).
     - `src/map2d/CameraBasedVisibility.ts` — `previousTiles[i]` (134, 135),
       `NEIGHBOR_DX_DY[i]` (217, 218, 328, 329), `this.visibles[i]` (254, 342).
     - `src/map2d/CameraBasedVisibilityHelpers.ts` — `visibles[i]` in `createTileHelpers()`
       (93–100).
     - `src/map2d/RepeatingTilesProvider.ts` — die Zeilenzugriffe `#tileIds[row % #rows]`
       und die Spaltenzugriffe darunter (27, 51, 57, 64, 94, 123, 128, 144, 151, 156).
       Die Schranke, die der Kommentar nennen muss, ist hier eine andere: `#rows` und
       `#cols` werden im Setter `tileIds` aus demselben Array gesetzt, das indiziert wird,
       und jeder Index läuft vorher durch `% #rows` beziehungsweise `% #cols` oder durch
       eine Bereichsprüfung.
     - `src/stage/RootRenderPipeline.ts:33` — `passes[i]` in der Faltungsschleife über
       `passes.length`; die Zeile darüber castet `passes[0]` bereits durch dasselbe Loch.
     - `src/utils/Dependencies.ts:77` — `this.#props[i]` in der Schleife über
       `this.#props.length`.
     - `src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` (210, 211, 213, 218, 219, 221, 261,
       265, 269, 273) — `originX` und `originY` sind `number | null` und tragen dieselbe
       Behandlung, obwohl ihre Schranke kein Index ist, sondern eine Klasseninvariante:
       `subdivide()` belegt beide in demselben Schritt, in dem es `isLeaf` löscht, und
       `clear()` nimmt beides gemeinsam zurück. Ein Knoten, der kein Blatt ist, hat also
       beide. `appendChunk()` verlässt sich darauf hinter seinem `if (this.isLeaf) return`,
       die vier `isNorth*()`/`isSouth*()` hinter ihrer Kind-Prüfung, und `findChunksAt()`
       schreibt heute schon `this.originX!`.
       Die Invariante wird **einmal** an den beiden Felddeklarationen als Kommentar
       ausgesprochen; die Fundstellen darunter bekommen ihr `!` und verweisen nicht jede
       für sich noch einmal darauf. Der Weg über eine Typ-Modellierung — zwei Zustände
       statt zweier Felder — wäre der ehrlichere und ist hier trotzdem falsch: er schriebe
       die Klasse um, und dieses Paket legt einen Schalter um.

  4. **Gruppe B — Feld mit verzögerter Zuweisung: `!:` in der Deklaration.** 14 Fundstellen
     sind `TS2564`. Sie betreffen private Felder, die nicht der Konstruktor belegt, sondern
     eine Methode, die vor jedem Lesen läuft. Das ist derselbe Fall, den Paket 6 an
     `VertexObjectDescriptor#voPrototype` entschieden hat, und er wird hier genauso
     entschieden: `#halfWidth!: number;`, dazu **ein** Kommentar je Klasse, der den
     Initialisierer beim Namen nennt.

     - `src/stage/OrthographicProjection.ts` (21, 22, 24, 25, 27) und
       `src/stage/ParallaxProjection.ts` (21, 23, 24, 26, 28, 29) — Initialisierer ist in
       beiden Fällen `updateViewRect()`.
     - `src/controls/PanControl2D.ts` (107, 150) und
       `src/map2d/RepeatingTilesProvider.ts:15` — hier belegt der Konstruktor das Feld,
       aber über den Setter `tileIds`, durch den TypeScript nicht hindurchsieht.

     Kein Initialwert an die Deklaration schreiben. Eine `0` dort wäre eine Zusicherung,
     die es vorher nicht gab, und sie verwandelt einen Fehlgebrauch — Kamera bauen, ohne
     `updateViewRect()` gefahren zu haben — von einer sichtbaren `NaN`-Matrix in eine
     stillschweigend degenerierte.

  5. **Gruppe C — Invariante ohne Schranke daneben, außerhalb eines heißen Pfads:
     `expectDefined()`.** Wo ein Wert per Invariante da ist, die Stelle aber nicht pro
     Frame und nicht pro Element läuft, wird die Invariante festgehalten statt behauptet.
     Der zweite Parameter benennt, was fehlte, in einer Form, die in einer Fehlermeldung
     Sinn ergibt.

     - `src/map2d/TileSprites/TileSpritesGeometry.ts:17` —
       `this.basePool.createVO().make()`. Genau die Stelle, die die Beschreibung von
       CFG-001 als Beispiel führt; sie läuft einmal je Geometrie, im Konstruktor.
     - `src/controls/InputControlBase.ts:25` — `this.#listeners[index]`, nachdem
       `#findListenerIndex()` einen Index `>= 0` geliefert hat.
     - `src/stage/StageRenderer.ts:549` — `otherStages.splice(index, 1)[0]` innerhalb von
       `if (index !== -1)`.
     - `src/stage/OrthographicProjection.ts` (62, 64) und
       `src/stage/ParallaxProjection.ts` (60, 62) — `this.projectionPlane` ist öffentlich
       und optional, `createCamera()` und `updateCamera()` brauchen es. Hier steht der
       Helfer statt eines `!` aus Gruppe A: Kameraaufbau läuft nicht je Frame, und ein
       fehlendes `projectionPlane` ist ein echter Bedienfehler, der eine Meldung verdient.
     - `src/map2d/CameraBasedVisibilityHelpers.ts` (87, 94, 98) — `tile.frustumBox` und
       `tile.box` sind auf `TileBox` optional. Diese Datei baut Debug-Helfer und läuft nur,
       wenn jemand hinsieht.
     - `src/display/Stylesheets.ts:17` — `styleEl.sheet` ist laut DOM-Typen
       `CSSStyleSheet | null`, und zwar zu Recht: ein `<style>`-Element ohne Dokument hat
       keines. Nach dem `appendChild()` zwei Zeilen darüber hat es eines.
     - `src/map2d/TileSprites/TileSpritesFactory.ts` (34, 45, 46) — `tileDataProvider`,
       `tileSet` und der Rückgabewert von `atlas.get(frameId)` in `createTile()`. Die
       Invariante ist der Konstruktor, nicht ein Index. Diese Methode läuft je Kachel, die
       ins Bild kommt — nicht je Frame, aber stoßweise; misst der Implementierer dort einen
       Preis, gilt für **diese drei** ersatzweise die Form aus Gruppe A, mit dem
       Konstruktor als benannter Schranke. Der Grund gehört dann in den Report.

  6. **Gruppe D — verlorene Verengung: eine lokale Bindung statt einer zweiten
     Abfrage.** Vier Stellen prüfen mit `has()` und lesen dann mit `get()`, oder verengen
     ein `let` und benutzen es in einem Callback, wo die Verengung nicht mehr gilt. Die
     Antwort ist überall dieselbe und kostet keinen zusätzlichen Zweig — sie ersetzt einen
     vorhandenen:

     - `src/display/Stylesheets.ts` (32, 35) — `installedRules.has(name)` gefolgt von
       `installedRules.get(name)` wird zu einem `get()`, dessen Ergebnis der `if` prüft.
     - `src/utils/Dependencies.ts:60` — `this.#callbacks.has(name)` gefolgt von
       `.get(name)`, dieselbe Umformung.
     - `src/display/FrameLoop.ts:25` — `rafUniqueInstances.has()` / `.set()` / `.get()`
       wird zu einem `get()`, einem `if`, und der Rückgabe der lokalen Bindung.
     - `src/texture/TextureStore.ts` (228–231, 242–245, 262, 263) — `resource` ist ein
       `let` und wird von `if (resource)` verengt, aber innerhalb von `batch(() => …)`
       benutzt; die Verengung überlebt die Callback-Grenze nicht. Innerhalb des
       `if`-Zweigs eine `const`-Bindung anlegen und im Callback diese benutzen.
     - `src/texture/TextureStore.ts` (335, 336) — `values` ist genau dann eine `Map`, wenn
       `isMultipleTypes` gilt; beide entspringen derselben `Array.isArray(type)`-Prüfung.
       Innerhalb von `if (isMultipleTypes)` eine `const`-Bindung mit `!` und einem
       Kommentar, der diese Kopplung ausspricht. Kein zweiter `if`: er wäre immer wahr und
       stünde als ungedeckter Zweig in der Coverage.

  7. **Gruppe E — der Typ sagt etwas, was der Code nicht hält: den Typ ändern, nicht den
     Code.** So beschlossen am 2026-09-04. Vier davon sind öffentlich und gehören ins
     CHANGELOG (Schritt 10):

     - `src/map2d/Map2D.ts:39` — `#visibilitor` ist optional, der Getter verspricht
       `IMap2DVisibilitor`. Der Getter bekommt sein `| undefined`. Der **Setter bleibt**
       `IMap2DVisibilitor`: er nimmt heute nichts Leeres entgegen, und das zu ändern wäre
       eine zweite Entscheidung. Öffentlich.
     - `src/map2d/Map2DTileRenderer.ts:66` — `dispose()` schreibt `null` in
       `tileFactory: IMapTileFactory`. Das Feld wird `IMapTileFactory | null`, und die
       sieben Benutzungen (15, 23, 34, 45, 52, 61, 65) laufen über **einen** privaten
       Getter, der den Wert durch `expectDefined()` führt und in seiner Meldung sagt, dass
       der Renderer verworfen ist. Ein `expectDefined()` je Benutzung wäre siebenmal
       derselbe Satz; ein `if` je Benutzung wären sieben ungedeckte Zweige. Öffentlich.
     - `src/map2d/CameraBasedVisibility.ts:193` — `pointOnPlane?: Vector3` bekommt sein
       `| null`. Die Zuweisung bleibt `null`: sie ist die einzige Stelle, an der der Code
       den Unterschied zwischen »nie gesetzt« und »bewusst geleert« ausdrückt, und ein
       Konsument darf auf `=== null` prüfen. Öffentlich.
     - `src/map2d/Map2DSpatialHashGrid.ts:80` — `let renderables: Set<Renderable>;` wird
       zu `let renderables: Set<Renderable> | undefined;`. Der Rückgabetyp der Methode
       trägt das `| undefined` bereits; die lokale Deklaration war die unehrliche.
       Öffentlich in ihrer Wirkung nicht — die Signatur ändert sich nicht.
     - `src/display/FrameLoop.ts` (14, 73) — `let rafUniqueInstance: RAF | null = null;`,
       und die lokale Schnittstelle `ISetAnimationLoop` nimmt
       `callback: ((now: number) => unknown) | null`. Das ist keine Erfindung, sondern die
       Signatur von three.js: `setAnimationLoop(null)` ist dort der Weg, die Schleife
       anzuhalten, und `stop()` benutzt ihn. `FrameLoop.ts` steht in keiner
       `public-api.ts`; die Änderung bleibt intern.
     - `src/texture/TextureResource.ts` (132, 152, 155) — die drei `createSignal()`-Aufrufe
       in `fromTileSet()` und `fromAtlas()` erschließen `Signal<T>`, während das Feld
       `Signal<T | undefined>` ist und `Signal` in seinem Typparameter invariant. Das
       Typargument wird ausgeschrieben:
       `createSignal<TileSetOptions | undefined>(tileSetOptions, {compare: cmpTileSetOptions,
       attach: resource})` und entsprechend `createSignal<string | undefined>` für
       `#atlasUrl` und `#overrideImageUrl`. Die Optionsobjekte bleiben, wie sie stehen.
       Kein Laufzeitunterschied, kein neuer Zweig.
     - `src/texture/TextureStore.ts:70` — `joinTextureClasses(...classes:
       TextureOptionClasses[][] | undefined)` ist als Rest-Parameter nicht schreibbar; das
       `| undefined` gehört an die Elemente, nicht an das Array:
       `(...classes: Array<TextureOptionClasses[] | undefined>)`. Der `?.filter()` im Rumpf
       wird damit zum `filter()`, und `:220` löst sich mit auf — der Aufrufer übergibt
       `item.texture`, das fehlen darf. Die Funktion ist modulintern.

  8. **Gruppe F — vier Einzelfälle, jeder mit seiner eigenen Antwort:**

     - `src/texture/TextureResource.ts` (391, 400, 419, 447, 451, 460, 473) — sieben
       `TS2769`. Die Abhängigkeitsarrays von `createEffect()` verlangen
       `SignalLike<any>[]`, und die übergebenen Felder (`#tileSetOptions`, `#tileSet`,
       `#atlasUrl`, `#atlasJson`, `#atlas`, `#overrideImageUrl`) sind optional, weil nur
       die passende Factory sie anlegt. Beide Blöcke stehen bereits in einem Wächter
       (`if (this.tileSetOptions)` beziehungsweise `if (this.atlasUrl)`). Am Kopf des
       jeweiligen Blocks je eine `const`-Bindung mit `!` anlegen, dazu **ein** Kommentar je
       Block, der sagt, warum: die Signale entstehen in derselben `batch()` wie der Wert,
       den der Wächter gerade gelesen hat. Den Wächter nicht umbauen — er prüft den *Wert*
       und nicht die Existenz des Signals, und diese beiden auszutauschen wäre eine
       Verhaltensänderung. `touch(this.#atlasUrl)` am Ende des zweiten Blocks nimmt
       dieselbe Bindung.
     - `src/texture/FrameBasedAnimations.ts` (160, 166) — `frames` wird in einer
       `if / else if / else if`-Kette belegt, die keinen `else` hat. `TS2454` ist hier kein
       Rauschen: fällt ein Argument durch alle drei Prüfungen, liest der Code eine
       uninitialisierte `let`-Bindung und bekommt einen `ReferenceError` ohne Aussage. Ein
       abschließender `else`-Zweig, der mit einer Meldung wirft, die das dritte Argument
       benennt. Das ist dieselbe Ausnahme von der Regel in Schritt 11, die `expectDefined()`
       genießt: der `throw` greift nur, wenn die Voraussetzung schon gebrochen ist.
     - `src/stage/fitIntoRectangle.ts` (221–224) — `'minPixelZoom' in specs` verengt einen
       optionalen Eigenschaftstyp nicht. Die Prüfung wird zu
       `specs.minPixelZoom != null`, entsprechend für `maxPixelZoom`. Die beiden sind auf
       jedem Eingabewert gleichwertig — bei fehlendem Schlüssel sind beide falsch, bei
       gesetztem `undefined` ergäbe der Vergleich darunter ohnehin `false` —, und die neue
       Form verengt.
     - `src/map2d/CameraBasedVisibility.ts:257` — `this.camera` ist optional und wird an
       eine Signatur gereicht, die eine Kamera verlangt. Die Methode läuft je Frame; hier
       gilt Gruppe A, mit dem Wächter, der bereits eine Zeile darüber steht, als Schranke
       im Kommentar. Steht dort keiner, gehört die Stelle in Gruppe C.

     Diese sechs Gruppen sind die Regeln, nicht die Namensliste. Jede der 134 Fundstellen
     fällt unter genau eine von ihnen, und die aufgezählten Stellen sind die, an denen die
     Zuordnung nicht auf den ersten Blick sichtbar ist — die übrigen ordnet ihr Fehlercode
     ein. Eine Fundstelle, die unter keine Gruppe passt, ist kein Freibrief, sondern ein
     Befund für den Report: dann steht dort etwas anderes als Nullability.

  9. **Den Eintrag `src/texture/TextureAtlas.ts:53` aus »Offene Befunde« mit erledigen.**
     `frame(name)` schreibt `this.#frames[this.#frameNames.get(name)!]` und liefert für
     einen unbekannten Namen zufällig das Richtige, nämlich `undefined` über
     `#frames[undefined]`. Der Rückgabetyp lautet bereits `TextureAtlasFrame | undefined`
     und bleibt unverändert; nur der Weg dorthin wird ehrlich: `frameId` binden, auf
     `!= null` prüfen, sonst `undefined`. Der Eintrag gehört hierher und nicht in die
     Drain-Runde, weil er dieselbe Ursache hat wie das ganze Paket und in einer Datei
     steht, die dieser Umbau ohnehin öffnet. Beim Commit wird seine Zeile in »Offene
     Befunde« auf `[x]` gesetzt.

  10. **`packages/twopoint5d/CHANGELOG.md` fortschreiben**, unter `## [Unreleased]`. Vier
      öffentliche Typänderungen aus Schritt 7 bekommen ihren Eintrag unter `### Changed`:
      `Map2D#visibilitor` (Getter), `Map2DTileRenderer#tileFactory`,
      `CameraBasedVisibility#pointOnPlane` und — falls der Umbau dort eine Signatur
      bewegt — was sonst über eine `public-api.ts` erreichbar ist. Jede, die einen
      Konsumenten unter `strictNullChecks` zum Nachbessern zwingt, bekommt zusätzlich einen
      `####`-Abschnitt unter `### Migration Guide`; die Form steht nebenan, Paket 6 hat
      dieselbe Machart eingetragen. Der Skill `updating-changelog` gilt.

  11. **Kein Laufzeitverhalten ändert sich.** Ziel ist, dass der Compiler sieht, was der
      Code ohnehin tut. Die einzigen Ausnahmen sind die beiden `throw`-Wege — der Helfer
      aus Gruppe C und der `else`-Zweig aus Gruppe F —, und beide greifen nur, wenn eine
      Voraussetzung bereits gebrochen ist; sie ersetzen dort einen Zugriff auf `undefined`
      durch eine Meldung, die sagt, was fehlte. Verlangt eine Fundstelle darüber hinaus
      eine Verhaltensänderung, wird sie gemeldet und nicht umgesetzt: dann steht dort ein
      Defekt, und ein Defekt gehört in ein Paket, das ihn mit einem roten Test einleitet.

  12. **Die Coverage-Schwellen aus Paket 5 sind der zweite Maßstab neben `strictCheck`.**
      Am 2026-09-04 gegen `c67ef74` gemessen, Zweige zuerst: global 63.28 % (1184/1871)
      gegen eine Schwelle von 58, `src/texture/**` 65.96 % (217/329) gegen 60. Daraus ergibt
      sich der Spielraum, und er ist der Grund für die Form der Schritte 3 bis 8: bis zu
      170 zusätzliche ungedeckte Zweige global und 32 in `texture/` — aber jede neue
      `if`-Prüfung, die kein Test auslöst, ist einer, und dieses Paket hat 134 Fundstellen.
      Deshalb steht überall dort, wo eine Invariante gilt, eine Bindung mit `!` oder ein
      Helfer-Aufruf und kein zusätzlicher Zweig. `src/controls/**` ist heute zu 0 %
      abgedeckt (0/108 Zweige) und hat keine einzige Spec — was dort entsteht, zählt
      ungedeckt in den globalen Topf. Reißt eine Schwelle trotzdem, ist das ein Befund für
      den Report; die Schwellen selbst gehören Paket 9 und werden hier nicht angefasst.

  13. **`pnpm format` fahren**, Umbrüche und Einrückung nicht von Hand setzen.
- Nachweis statt Regressionstest: Das ist ein Typdefekt, kein Laufzeitfehler — es gibt
  keine Zusicherung im Code, die vorher rot sein könnte, und ein Test gegen `undefined` an
  einer Stelle, die der Compiler ab jetzt selbst abfängt, prüfte den Compiler. Der Beleg
  sind vier Zahlen, alle am 2026-09-04 gegen `c67ef74` gemessen und alle in den Report:
  - `pnpm --filter @spearwolf/twopoint5d run strictCheck` fällt von 134 Fehlern auf 0.
    Die 134 sind einzeln aufgezählt, siehe die Fehlerliste am Ende dieses Abschnitts.
  - `pnpm exec tsc -p packages/twopoint5d/tsconfig.json --noEmit --strictNullChecks
    --noUncheckedIndexedAccess` steht heute bei 537. Die Zahl danach gehört in den Report,
    aber **nicht** ins Gate: die Signaturen aus Schritt 7 werden in den Specs neue Fehler
    sichtbar machen, und das ist der Zweck der Übung, nicht ihr Scheitern. Jede Fundstelle,
    die dabei neu auftaucht, kommt mit Datei und Zeile als Folge in den Report und wird
    Paket 8 zugeschlagen. Erwartet ist ein Wert, der um die Zahl dieser neuen
    Spec-Fundstellen über 403 liegt und dessen Produktivcode-Anteil 0 ist.
  - Die Vitest-Runde bleibt bei 45 Dateien / 703 Tests. Ändert sich diese Zahl, hat das
    Paket Testcode angefasst, und das tut es nicht.
  - Die Zweig-Coverage bleibt über den Schwellen: global ≥ 58 %, `src/texture/**` ≥ 60 %.
    Ausgangswerte in Schritt 12. Die gemessenen Werte gehören in den Report, damit Paket 8
    und Paket 9 wissen, wie viel Luft nach dem Umbau noch da ist.
- Verify (das Gate, muss `exit=0` liefern):
  `pnpm clean && pnpm lint && pnpm --filter @spearwolf/twopoint5d run strictCheck && pnpm build && pnpm checkPkgTypes && pnpm lintPkg && NX_TUI=false pnpm nx run twopoint5d:test --skip-nx-cache`
  Das `--skip-nx-cache` steht hier bewusst: in Paket 6 lieferte das `test`-Target seinen
  grünen Lauf aus dem Nx-Cache, und der Verify-Lauf musste eigens nachgefahren werden.
- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm test:browser`. Maßstab ist die
  Zeile unter »Vorbestehende Fehler« — Chromium 0 Fehler, Firefox 24. Diese Runde zählt
  hier so viel wie in Paket 6: `map2d/` und `texture/` sind der Code, den die
  Browsersuite gegen eine echte GPU fährt. Jeder neue Fehler unter Chromium geht zurück in
  die Fehlerkette.
- Entschieden in Zug 4 (Kollision im Detailplan): Schritt 7 schreibt für
  `Map2DTileRenderer#tileFactory` **einen** privaten Getter mit `expectDefined()` über alle
  sieben Benutzungen vor; Schritt 3 verbietet den Helfer in Pfaden, die pro Frame oder pro
  Element laufen, und begründet das mit einer Messung (1,25× bis 1,33× über 3·10⁷ Aufrufe).
  Beide Vorgaben treffen auf denselben Zeilen aufeinander. Am 2026-09-04 im Code
  nachgesehen: `Map2DTileStreamer.update()` ruft `reuseTile()` für jede sichtbare Kachel,
  und `CameraBasedVisibility` setzt bei unveränderten Abhängigkeiten
  `reuseTiles = tiles` (`CameraBasedVisibility.ts:179`) — der Getter liegt damit im
  Frame-Pfad, und die Annahme hinter Schritt 7 trägt nicht. Aufgelöst zugunsten von
  Schritt 3, weil der Plan diese Kollision selbst so entscheidet: Schritt 5 gibt für
  `TileSpritesFactory` ausdrücklich die Ersatzform aus Gruppe A frei, sobald dort ein Preis
  anfällt, und Paket 6 hat denselben Konflikt an den Attribut-Accessoren ebenso beschieden.
  Die Typänderung aus Schritt 7 (`IMapTileFactory | null`) bleibt unberührt; nur der Weg zum
  Wert ändert sich in den Methoden, die je Kachel laufen. Ein `!` legt dort keinen Zweig an,
  die Begründung aus Schritt 7 bleibt also gewahrt.
- Commit: `refactor(twopoint5d): make nullability explicit across the remaining modules`
- Ergebnis: 4 Runden · CFG-001 und CFG-002 im Umfang dieses Pakets behoben · alle 134
  Fundstellen in 23 Dateien aufgelöst, `packages/twopoint5d/tsconfig.strict.json` prüft ab
  hier `src` ganz · kein Regressionstest, der Nachweis sind vier selbst gemessene Zahlen:
  `strictCheck` 134 → 0, der volle Zählauf mit beiden Schaltern 537 → 403 mit einem
  Produktivcode-Anteil von 0, die Vitest-Runde unverändert bei 45 Dateien / 703 Tests,
  Zweig-Coverage global 63,22 % (1183/1871) gegen Schwelle 58 und `src/texture/**` 65,65 %
  (216/329) gegen 60 · Gate `exit=0` (`paket-7.verify.log`, selbst gefahren) ·
  Browsersuite `paket-7.browser.log`: Chromium 0 Fehler, Firefox 24,
  `getSupportedExtensions` 92-mal — zahlengleich mit dem Lauf nach Paket 6 · Review in vier
  Durchgängen ohne kritischen Befund
- Abweichung vom Detailplan (Schritt 7, entschieden in Zug 4): siehe den Absatz »Entschieden
  in Zug 4« oben. `Map2DTileRenderer` liest `tileFactory` in `addTile()`, `reuseTile()`,
  `removeTile()` und `clearTiles()` direkt mit `!` statt über den Getter; die Invariante
  steht einmal am Felddeklarations-Kommentar. `expectDefined()` bleibt für
  `endUpdatingTiles()` und `dispose()`. Der Preis ist benannt: auf einem verworfenen
  Renderer melden `addTile()` und `reuseTile()` wieder einen `TypeError` statt der
  benannten Meldung, `removeTile()` und `clearTiles()` finden die Kachelkarte leer und
  laufen stumm durch. Die Typänderung aus Schritt 7 ist unberührt.
- Weitere Abweichungen, alle vom Reviewer geprüft und getragen: die Fundstellenliste ordnet
  `CameraBasedVisibility.ts` 134/135, 217/218 und 254 falsch zu — dort steht `this.camera`,
  nicht `previousTiles[i]`; gearbeitet wurde nach Code und Fehlercode, wie der Nachsatz zur
  Liste es vorsieht · zwei Fundstellen nannte keine Gruppenliste namentlich und fielen nach
  ihrem Fehlercode in Gruppe E: `TextureStore.ts:234` und `DataIdsChunk2D.ts:60`, beide
  über eine verbreiterte Signatur statt über ein `!` · `PanControl2D` bekommt zwei
  Kommentare statt einem je Klasse, weil die beiden Felder 45 Zeilen auseinanderliegen und
  verschiedene Initialisierer haben · bei beiden Projektionen deckt je eine
  `expectDefined()`-Bindung am Kopf von `createCamera()` beide Fundstellen ab · der
  Preis-Vorbehalt aus Schritt 5 für `TileSpritesFactory` wurde nicht gezogen, weil
  `createTile()` je neu ins Bild kommender Kachel läuft und nicht je Frame
- Kleine Befunde, in der Kette mit abgeräumt: die Kommentare an
  `OrthographicProjection.ts:21` und `ParallaxProjection.ts:21` behaupteten eine Reihenfolge,
  die der Code nicht erzwingt · der Schranken-Kommentar an `RepeatingTilesProvider.ts:29`
  deckte den Setter-Pfad nicht · eine Runde hatte freigegebene CHANGELOG-Abschnitte ab
  `## [0.21.2]` umformatiert, zurückgenommen und gegengeprüft: `git diff` zeigt dort 0 Hunks
- Nebenbefunde: → »Offene Befunde«, neun Einträge
- Folgen: keine. Der volle Zählauf zeigt außerhalb der Specs keine Fundstelle mehr, und die
  403 Spec-Fehler sind mit dem Stand vor diesem Paket zeilenidentisch — Paket 8 erbt hier
  nichts Neues. Die vier öffentlichen Typänderungen brechen weder im Produktivcode noch im
  Lookbook noch in der Browsersuite einen Aufrufer; `Map2D#visibilitor` wird an beiden
  Lookbook-Stellen (`apps/lookbook/src/demos/map2d-cam-visi.ts:41`,
  `map2d-rect-visi.ts:64`) nur geschrieben, und der Setter blieb unverändert
- Schnittstellen: `expectDefined<T>(value, what): T` liegt ab hier in
  `packages/twopoint5d/src/utils/expectDefined.ts` und ist weiterhin **nicht** in einer
  `public-api.ts`; wer ihn importiert, nimmt `../utils/expectDefined.js`. Der Umzug war
  nötig, weil ein Import von `utils/` nach `vertex-objects/` den Kreis
  `utils → vertex-objects → texture → utils` geschlossen hätte · `Map2D#visibilitor`
  (Getter) gibt `IMap2DVisibilitor | undefined`, der Setter nimmt unverändert
  `IMap2DVisibilitor` · `Map2DTileRenderer#tileFactory` ist `IMapTileFactory | null` und
  nach `dispose()` leer · `CameraBasedVisibility#pointOnPlane` trägt sein `| null`, und
  `null` heißt dort »bewusst geleert« im Unterschied zu »nie gesetzt« ·
  `DataIdsChunk2D#readDataIdAt()` und `#readDataIdAtLocal()` geben `number | undefined` ·
  `TextureResource.fromTileSet()` nimmt `imageUrl` auch fehlend ·
  `FrameBasedAnimations#add()` wirft jetzt mit einer Meldung, die das dritte Argument
  benennt, statt eine uninitialisierte Bindung zu lesen · `TextureAtlas#frame()` behält
  seinen Rückgabetyp `TextureAtlasFrame | undefined`, erreicht ihn aber über eine Prüfung
  statt über `#frames[undefined]` · intern: `joinTextureClasses()` nimmt
  `Array<TextureOptionClasses[] | undefined>`, `FrameLoop`s `ISetAnimationLoop` nimmt
  `null` wie three.js selbst · `tsconfig.strict.json` prüft ab hier `src` vollständig und
  verschwindet mit Paket 8

**CFG-001 · high · tsconfig.json:39-40** — strictNullChecks ist deaktiviert, trotz
strict: true

Die Config setzt global `strict: true` und schaltet zwei Zeilen darunter
`strictNullChecks: false`. Damit sind sämtliche Null- und Undefined-Prüfungen für den
Compiler unsichtbar. Konkret spürbar in API-001, wo `createVO()` ein Objekt verspricht und
`undefined` liefert, und in mehreren Signals vom Typ `Signal<T | undefined>`, deren
Konsumenten ungeprüft auf `.value` zugreifen. Der mit Abstand hebelstärkste Punkt dieser
Liste.

Empfehlung: `strictNullChecks: true` setzen. Es fallen erwartungsgemäß viele Fehler an —
inkrementell beheben, notfalls modulweise über eine separate tsconfig-Erweiterung
migrieren. Danach werden echte Null-Defekte vom Compiler gemeldet statt im Code-Review
gesucht.

Abgleich am 2026-09-04 (Zug 0 von Paket 7): Der Sachverhalt steht unverändert;
`tsconfig.json:40` trägt weiterhin `strictNullChecks: false`, und Paket 6 hat den Schalter
bewusst nicht dort umgelegt, sondern in der Migrations-Config. Beide in der Beschreibung
genannten Beispiele sind jetzt fällig und liegen in diesem Paket:
`map2d/TileSprites/TileSpritesGeometry.ts:17` dereferenziert den Rückgabewert von
`createVO()` ungeprüft (Schritt 5), und die Signals mit optionalem Wert sitzen in
`texture/TextureResource.ts` (Schritt 7 und 8). Der Schalter selbst wandert in Paket 8 nach
`tsconfig.json`; dieses Paket räumt die letzte Hürde davor weg.

**CFG-002 · medium · tsconfig.json** — noUncheckedIndexedAccess ist nicht aktiviert

Array- und Index-Zugriffe gelten als immer definiert, auch wenn der Index außerhalb der
Grenzen liegen kann. Im Buffer-Kern und in `map2d/` mit ihrer manuellen Index-Arithmetik
ist das in Kombination mit CFG-001 ein doppeltes Leck.

Empfehlung: Aktivieren, sinnvollerweise im selben Durchgang wie CFG-001 — viele
Fundstellen profitieren von beiden Schaltern gleichzeitig.

Abgleich am 2026-09-04 (Zug 0 von Paket 7): unverändert, der Schalter fehlt in
`tsconfig.json` weiterhin ganz. Die vom Audit benannte Stelle — `map2d/` mit seiner
manuellen Index-Arithmetik — ist der Schwerpunkt dieses Pakets: 73 der 134 Fundstellen
liegen dort, und allein `chunk-quad-tree/ChunkQuadTreeNode.ts` (28) und
`RepeatingTilesProvider.ts` (17) tragen zwei Drittel davon. Dass beide Schalter gemeinsam
gezogen werden, ist übernommen und bestimmt weiterhin den Schnitt der Pakete 6 bis 8.

**Die 134 Fundstellen**, gemessen am 2026-09-04 gegen `c67ef74` mit beiden Schaltern und
gegen eine Probekopie der Migrations-Config mit `include: ["src"]` gegengeprüft. Pfade
relativ zu `packages/twopoint5d/`:

```
src/controls/InputControlBase.ts(25,15): error TS2488: Type '[host: EventTarget, eventName: string, callback: any, passive: boolean] | undefined' must have a '[Symbol.iterator]()' method that returns an iterator.
src/controls/PanControl2D.ts(107,3): error TS2564: Property '#cursorPanStyle' has no initializer and is not definitely assigned in the constructor.
src/controls/PanControl2D.ts(150,3): error TS2564: Property '#panView' has no initializer and is not definitely assigned in the constructor.
src/display/FrameLoop.ts(14,5): error TS2322: Type 'null' is not assignable to type 'RAF'.
src/display/FrameLoop.ts(25,7): error TS2322: Type 'RAF | undefined' is not assignable to type 'RAF'.
src/display/FrameLoop.ts(73,38): error TS2345: Argument of type 'null' is not assignable to parameter of type '(now: number) => unknown'.
src/display/Stylesheets.ts(4,5): error TS2322: Type 'null' is not assignable to type 'CSSStyleSheet'.
src/display/Stylesheets.ts(17,7): error TS2322: Type 'CSSStyleSheet | null' is not assignable to type 'CSSStyleSheet'.
src/display/Stylesheets.ts(32,11): error TS18048: 'prevRule' is possibly 'undefined'.
src/display/Stylesheets.ts(35,15): error TS18048: 'prevRule' is possibly 'undefined'.
src/map2d/CameraBasedVisibility.ts(134,26): error TS2532: Object is possibly 'undefined'.
src/map2d/CameraBasedVisibility.ts(135,31): error TS2532: Object is possibly 'undefined'.
src/map2d/CameraBasedVisibility.ts(193,7): error TS2322: Type 'null' is not assignable to type 'Vector3 | undefined'.
src/map2d/CameraBasedVisibility.ts(217,25): error TS2532: Object is possibly 'undefined'.
src/map2d/CameraBasedVisibility.ts(217,86): error TS2532: Object is possibly 'undefined'.
src/map2d/CameraBasedVisibility.ts(218,53): error TS2532: Object is possibly 'undefined'.
src/map2d/CameraBasedVisibility.ts(254,35): error TS2532: Object is possibly 'undefined'.
src/map2d/CameraBasedVisibility.ts(254,56): error TS2345: Argument of type 'IMap2DTileCoords | undefined' is not assignable to parameter of type 'IMap2DTileCoords'.
src/map2d/CameraBasedVisibility.ts(257,23): error TS2345: Argument of type 'OrthographicCamera | PerspectiveCamera | undefined' is not assignable to parameter of type 'OrthographicCamera | PerspectiveCamera'.
src/map2d/CameraBasedVisibility.ts(328,22): error TS2532: Object is possibly 'undefined'.
src/map2d/CameraBasedVisibility.ts(329,22): error TS2532: Object is possibly 'undefined'.
src/map2d/CameraBasedVisibility.ts(342,63): error TS2532: Object is possibly 'undefined'.
src/map2d/CameraBasedVisibilityHelpers.ts(87,25): error TS2345: Argument of type 'Box3 | undefined' is not assignable to parameter of type 'Box3'.
src/map2d/CameraBasedVisibilityHelpers.ts(93,12): error TS18048: 'tile' is possibly 'undefined'.
src/map2d/CameraBasedVisibilityHelpers.ts(94,27): error TS18048: 'tile' is possibly 'undefined'.
src/map2d/CameraBasedVisibilityHelpers.ts(94,27): error TS2345: Argument of type 'Box3 | undefined' is not assignable to parameter of type 'Box3'.
src/map2d/CameraBasedVisibilityHelpers.ts(98,9): error TS18048: 'tile' is possibly 'undefined'.
src/map2d/CameraBasedVisibilityHelpers.ts(98,9): error TS2345: Argument of type 'Box3 | undefined' is not assignable to parameter of type 'Box3'.
src/map2d/CameraBasedVisibilityHelpers.ts(100,9): error TS18048: 'tile' is possibly 'undefined'.
src/map2d/Map2D.ts(39,5): error TS2322: Type 'IMap2DVisibilitor | undefined' is not assignable to type 'IMap2DVisibilitor'.
src/map2d/Map2DSpatialHashGrid.ts(80,12): error TS2454: Variable 'renderables' is used before being assigned.
src/map2d/Map2DTileRenderer.ts(66,5): error TS2322: Type 'null' is not assignable to type 'IMapTileFactory<unknown>'.
src/map2d/RepeatingTilesProvider.ts(15,3): error TS2564: Property '#tileIds' has no initializer and is not definitely assigned in the constructor.
src/map2d/RepeatingTilesProvider.ts(27,18): error TS2532: Object is possibly 'undefined'.
src/map2d/RepeatingTilesProvider.ts(51,11): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
src/map2d/RepeatingTilesProvider.ts(51,18): error TS2532: Object is possibly 'undefined'.
src/map2d/RepeatingTilesProvider.ts(57,11): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
src/map2d/RepeatingTilesProvider.ts(57,18): error TS2532: Object is possibly 'undefined'.
src/map2d/RepeatingTilesProvider.ts(64,9): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
src/map2d/RepeatingTilesProvider.ts(64,16): error TS2532: Object is possibly 'undefined'.
src/map2d/RepeatingTilesProvider.ts(94,27): error TS2532: Object is possibly 'undefined'.
src/map2d/RepeatingTilesProvider.ts(123,29): error TS2532: Object is possibly 'undefined'.
src/map2d/RepeatingTilesProvider.ts(123,29): error TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.
src/map2d/RepeatingTilesProvider.ts(128,33): error TS2532: Object is possibly 'undefined'.
src/map2d/RepeatingTilesProvider.ts(144,23): error TS2532: Object is possibly 'undefined'.
src/map2d/RepeatingTilesProvider.ts(144,23): error TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.
src/map2d/RepeatingTilesProvider.ts(151,27): error TS2532: Object is possibly 'undefined'.
src/map2d/RepeatingTilesProvider.ts(151,27): error TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.
src/map2d/RepeatingTilesProvider.ts(156,31): error TS2532: Object is possibly 'undefined'.
src/map2d/TileSprites/TileSpritesFactory.ts(34,24): error TS2532: Object is possibly 'undefined'.
src/map2d/TileSprites/TileSpritesFactory.ts(45,21): error TS2532: Object is possibly 'undefined'.
src/map2d/TileSprites/TileSpritesFactory.ts(46,23): error TS2532: Object is possibly 'undefined'.
src/map2d/TileSprites/TileSpritesFactory.ts(46,23): error TS2532: Object is possibly 'undefined'.
src/map2d/TileSprites/TileSpritesGeometry.ts(17,5): error TS2532: Object is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(30,9): error TS18048: 'c' is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(32,16): error TS18048: 'c' is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(63,20): error TS2532: Object is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(172,11): error TS18048: 'chunk' is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(173,13): error TS18048: 'chunk' is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(173,43): error TS2345: Argument of type 'ChunkType | undefined' is not assignable to parameter of type 'ChunkType'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(174,18): error TS18048: 'chunk' is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(174,51): error TS2345: Argument of type 'ChunkType | undefined' is not assignable to parameter of type 'ChunkType'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(175,30): error TS2345: Argument of type 'ChunkType | undefined' is not assignable to parameter of type 'ChunkType'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(176,18): error TS18048: 'chunk' is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(177,13): error TS18048: 'chunk' is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(177,43): error TS2345: Argument of type 'ChunkType | undefined' is not assignable to parameter of type 'ChunkType'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(178,18): error TS18048: 'chunk' is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(178,51): error TS2345: Argument of type 'ChunkType | undefined' is not assignable to parameter of type 'ChunkType'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(179,30): error TS2345: Argument of type 'ChunkType | undefined' is not assignable to parameter of type 'ChunkType'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(181,25): error TS2345: Argument of type 'ChunkType | undefined' is not assignable to parameter of type 'ChunkType'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(210,23): error TS18047: 'originX' is possibly 'null'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(211,24): error TS18047: 'originY' is possibly 'null'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(213,34): error TS18047: 'originY' is possibly 'null'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(218,31): error TS18047: 'originX' is possibly 'null'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(219,24): error TS18047: 'originY' is possibly 'null'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(221,34): error TS18047: 'originY' is possibly 'null'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(251,11): error TS18048: 'c' is possibly 'undefined'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(251,44): error TS2345: Argument of type 'ChunkType | undefined' is not assignable to parameter of type 'ChunkType'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(261,53): error TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(265,53): error TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(269,53): error TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts(273,53): error TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
src/map2d/chunk-quad-tree/DataIdsChunk2D.ts(60,5): error TS2322: Type 'number | undefined' is not assignable to type 'number'.
src/stage/OrthographicProjection.ts(21,3): error TS2564: Property '#halfWidth' has no initializer and is not definitely assigned in the constructor.
src/stage/OrthographicProjection.ts(22,3): error TS2564: Property '#halfHeight' has no initializer and is not definitely assigned in the constructor.
src/stage/OrthographicProjection.ts(24,3): error TS2564: Property '#near' has no initializer and is not definitely assigned in the constructor.
src/stage/OrthographicProjection.ts(25,3): error TS2564: Property '#far' has no initializer and is not definitely assigned in the constructor.
src/stage/OrthographicProjection.ts(27,3): error TS2564: Property '#distanceToProjectionPlane' has no initializer and is not definitely assigned in the constructor.
src/stage/OrthographicProjection.ts(62,5): error TS2532: Object is possibly 'undefined'.
src/stage/OrthographicProjection.ts(64,26): error TS2532: Object is possibly 'undefined'.
src/stage/ParallaxProjection.ts(21,3): error TS2564: Property '#halfHeight' has no initializer and is not definitely assigned in the constructor.
src/stage/ParallaxProjection.ts(23,3): error TS2564: Property '#near' has no initializer and is not definitely assigned in the constructor.
src/stage/ParallaxProjection.ts(24,3): error TS2564: Property '#far' has no initializer and is not definitely assigned in the constructor.
src/stage/ParallaxProjection.ts(26,3): error TS2564: Property '#distanceToProjectionPlane' has no initializer and is not definitely assigned in the constructor.
src/stage/ParallaxProjection.ts(28,3): error TS2564: Property '#aspect' has no initializer and is not definitely assigned in the constructor.
src/stage/ParallaxProjection.ts(29,3): error TS2564: Property '#fovy' has no initializer and is not definitely assigned in the constructor.
src/stage/ParallaxProjection.ts(60,5): error TS2532: Object is possibly 'undefined'.
src/stage/ParallaxProjection.ts(62,26): error TS2532: Object is possibly 'undefined'.
src/stage/RootRenderPipeline.ts(33,21): error TS2345: Argument of type 'Node | undefined' is not assignable to parameter of type 'Node'.
src/stage/StageRenderer.ts(549,43): error TS2345: Argument of type 'StageItem | undefined' is not assignable to parameter of type 'StageItem'.
src/stage/fitIntoRectangle.ts(221,64): error TS18048: 'specs.minPixelZoom' is possibly 'undefined'.
src/stage/fitIntoRectangle.ts(222,38): error TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.
src/stage/fitIntoRectangle.ts(223,71): error TS18048: 'specs.maxPixelZoom' is possibly 'undefined'.
src/stage/fitIntoRectangle.ts(224,38): error TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.
src/texture/FrameBasedAnimations.ts(160,46): error TS2454: Variable 'frames' is used before being assigned.
src/texture/FrameBasedAnimations.ts(166,7): error TS2454: Variable 'frames' is used before being assigned.
src/texture/TextureResource.ts(132,7): error TS2322: Type 'Signal<TileSetOptions>' is not assignable to type 'Signal<TileSetOptions | undefined>'.
src/texture/TextureResource.ts(152,7): error TS2322: Type 'Signal<string>' is not assignable to type 'Signal<string | undefined>'.
src/texture/TextureResource.ts(155,7): error TS2322: Type 'Signal<string>' is not assignable to type 'Signal<string | undefined>'.
src/texture/TextureResource.ts(391,11): error TS2769: No overload matches this call.
src/texture/TextureResource.ts(400,11): error TS2769: No overload matches this call.
src/texture/TextureResource.ts(419,11): error TS2769: No overload matches this call.
src/texture/TextureResource.ts(447,14): error TS2769: No overload matches this call.
src/texture/TextureResource.ts(451,11): error TS2769: No overload matches this call.
src/texture/TextureResource.ts(460,11): error TS2769: No overload matches this call.
src/texture/TextureResource.ts(473,15): error TS2769: No overload matches this call.
src/texture/TextureStore.ts(70,29): error TS2370: A rest parameter must be of an array type.
src/texture/TextureStore.ts(220,51): error TS2345: Argument of type '[("srgb" | "anisotrophy" | "anisotrophy-2" | "anisotrophy-4" | "no-anisotrophy" | "nearest" | "mag-nearest" | "min-nearest" | "linear" | "mag-linear" | "min-linear" | "flipy" | "no-flipy" | "linear-srgb")[] | undefined, ("srgb" | "anisotrophy" | "anisotrophy-2" | "anisotrophy-4" | "no-anisotrophy" | "nearest" | "mag-nearest" | "min-nearest" | "linear" | "mag-linear" | "min-linear" | "flipy" | "no-flipy" | "linear-srgb")[]]' is not assignable to parameter of type '("srgb" | "anisotrophy" | "anisotrophy-2" | "anisotrophy-4" | "no-anisotrophy" | "nearest" | "mag-nearest" | "min-nearest" | "linear" | "mag-linear" | "min-linear" | "flipy" | "no-flipy" | "linear-srgb")[][]'.
src/texture/TextureStore.ts(228,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(229,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(230,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(231,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(234,56): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
src/texture/TextureStore.ts(242,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(243,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(244,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(245,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(262,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(263,15): error TS18048: 'resource' is possibly 'undefined'.
src/texture/TextureStore.ts(335,19): error TS18048: 'values' is possibly 'undefined'.
src/texture/TextureStore.ts(336,88): error TS18048: 'values' is possibly 'undefined'.
src/utils/Dependencies.ts(60,16): error TS2339: Property 'clone' does not exist on type 'DependencyCallbacks<any> | undefined'.
src/utils/Dependencies.ts(60,23): error TS2339: Property 'copy' does not exist on type 'DependencyCallbacks<any> | undefined'.
src/utils/Dependencies.ts(77,13): error TS2488: Type '[string, DependencyCallbacks<any> | undefined] | undefined' must have a '[Symbol.iterator]()' method that returns an iterator.
```

Die Zeilennummern gelten für den Stand `c67ef74`. Verschiebt eine Änderung sie, gilt die
Datei plus der Fehlercode; die Liste ist der Umfang, nicht die Landkarte.

### [x] 8. Strikte Nullability, Teil 3: die Specs

- Findings: CFG-001 (high, Specs), CFG-002 (medium, Specs)
- Ziel: Die 17 Spec-Dateien unter `packages/twopoint5d/src/` stehen unter beiden Schaltern
  fehlerfrei, ohne dass eine einzige Zusicherung ihre Bedeutung ändert.
- Bereich: die 17 `*.spec.ts` aus der Fundstellenliste am Ende dieses Abschnitts,
  `packages/twopoint5d/tsconfig.strict.json`
- Hängt ab von: Paket 7
- Hinweis (Folge aus Paket 1): Ab Paket 1 emittiert `pnpm build` über
  `packages/twopoint5d/tsconfig.build.json` und lässt die Specs aus — `pnpm build` prüft
  ihre Typen also nicht mehr, und `pnpm lint` tut es ohnehin nicht (typescript-eslint läuft
  hier ohne Type Information). Was die Pakete 6 und 7 an Signaturen geändert haben, schlägt
  deshalb bis hier in keinem Gate auf, sondern kommt gebündelt an. Dass daraus ein
  dauerhafter Prüfschritt werden muss und nicht nur ein einmaliger, ist Sache von Paket 8a
  — hier trägt die Migrations-Config.
- Hinweis (Zug 0 von Paket 8, 2026-09-04): Der Schnitt des Pakets hat sich geändert. Der
  Grobplan hatte »Specs und der globale Schalter« als ein Paket vorgesehen; gemessen sind
  das 403 Spec-Fundstellen **plus** 22 Fundstellen im Produktivcode aus der Verbreiterung
  von `Buffer.typedArray`, plus zehn im Lookbook, plus die Root-`tsconfig.json`, plus ein
  neues Nx-Target samt seiner vier Dateien, plus CHANGELOG, `CLAUDE.md` und `README.md`.
  Paket 7 hat für 134 Fundstellen vier Runden gebraucht; ein Diff über gut 450 in einer
  einzigen Review ist der Weg in eine Fehlerkette, die ihre fünf Runden verbraucht, ohne zu
  konvergieren. Deshalb trägt Paket 8 nur noch die Spec-Migration — ein einziges,
  gleichförmiges Muster, das sich nach Regeln reviewen lässt statt Stelle für Stelle. Alles
  Urteilslastige liegt in **Paket 8a** dahinter: die zwei Typlöcher, der globale Schalter,
  die Infrastruktur.
- Hinweis (Zug 0 von Paket 8, Zählauf): Am 2026-09-04 gegen `ac64b5a` gemessen, mit einer
  Probekopie von `tsconfig.strict.json` ohne das Spec-`exclude`: **403** Fehler, verteilt
  auf 17 Dateien, und **keine einzige Fundstelle außerhalb der Specs**. Damit trägt die
  Vorhersage aus der `Ergebnis:`-Zeile von Paket 7 auf die Zahl genau. Nach Fehlercode:
  224 × `TS18048` (»is possibly undefined«), 143 × `TS2532` (»Object is possibly
  undefined«), 25 × `TS2345`, 5 × `TS18047` (`null`, nicht `undefined`), 4 × `TS2769`
  (Überladung), je 1 × `TS2339` und `TS2322`. Über 90 % sind damit dasselbe: ein Wert, der
  aus einem Index- oder Map-Zugriff kommt.
- Hash: dca1018
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/tsconfig.strict.json` und die 17 Spec-Dateien aus der
  Fundstellenliste am Ende dieses Abschnitts. **Keine andere Datei.** Kein Produktivcode,
  keine Config außer der genannten, kein CHANGELOG — dieses Paket ändert nichts, was
  ausgeliefert wird.
- Vorgehen:

  1. **`packages/twopoint5d/tsconfig.strict.json`: die Zeile
     `"exclude": ["src/**/*.spec.ts"]` streichen.** Sonst nichts an den
     `compilerOptions` — `noEmit`, beide Schalter und `"include": ["src"]` bleiben, wie sie
     stehen. Der Kommentar im Kopf beschreibt einen »wachsenden Ausschnitt«; dieser Satz
     stimmt danach nicht mehr, weil der Ausschnitt jetzt `src` ganz ist. Er wird auf den
     neuen Stand gebracht, der letzte Satz über das Verschwinden der Datei bleibt richtig.
     Am 2026-09-04 mit einer Probekopie gemessen: die Config meldet in dieser Form genau
     die 403 Fundstellen aus der Liste unten und keine weitere.

  2. **Die vier Regeln.** Sie gelten für jede der 403 Stellen, und sie sind der eigentliche
     Auftrag dieses Pakets — nicht die einzelne Zeile.

     **Regel A — an der Bindung ansetzen, nicht am Gebrauch.** Wo ein Wert einmal gebunden
     und mehrfach benutzt wird, gehört das `!` an die Bindung: aus
     `const vo = pool.createVO();` wird `const vo = pool.createVO()!;`, aus
     `let tileset = grid.getTiles(-1, -1, 2, 2);` wird dasselbe mit `!`. Ein `!` räumt
     damit fünf bis zehn Folgefehler darunter ab. Das ist das Muster, das den Löwenanteil
     trägt — `pool.createVO()`, `grid.getTiles()`, `buffers.get(name)`,
     `extraInstancedPools.get(name)` — und es ist dieselbe Form, die Paket 7 im
     Produktivcode als Gruppe A gefahren hat.

     **Regel B — am Gebrauch nur, wo der Wert ein- oder zweimal vorkommt.**
     `ticks[0]!.tickNo`, `resources['b']!`. Eine Bindung für zwei Benutzungen einzuführen
     bläht den Diff, ohne etwas zu klären.

     **Regel C — keine Zusicherung wird weicher.** Das ist die Regel, an der dieses Paket
     scheitern kann, und deshalb steht sie hier so scharf: Das Argument eines `expect()`
     ändert seine Bedeutung nicht. Aus `expect(ticks[0].tickNo).toBe(0)` wird
     `expect(ticks[0]!.tickNo).toBe(0)` — nicht `expect(ticks[0]?.tickNo)`, nicht
     `toBeCloseTo` statt `toBe`, nicht `toBeDefined()` anstelle der eigentlichen Prüfung,
     und kein Test verliert eine Zeile. Ein `?.` in einer Zusicherung macht aus »der Wert
     ist 0« ein »der Wert ist 0 oder es gibt ihn nicht«, und der Test ist danach grün, wo
     er rot sein müsste. Lässt sich eine Stelle nicht mit A oder B auflösen, geht sie als
     Folge in den Report — mit Datei, Zeile und dem Grund —, nicht in eine umgeschriebene
     Zusicherung.

     **Regel D — kein `expectDefined()` in Specs.** Der Helfer liegt seit Paket 7 in
     `packages/twopoint5d/src/utils/expectDefined.ts` und steht bewusst in keiner
     `public-api.ts`. Eine Spec, die ihn benutzt, prüft ihn mit, statt das Modul zu prüfen,
     um das es geht. `!` ist hier die richtige Form.

  3. **Kommentare: sparsam, anders als in Paket 7.** Paket 7 verlangte im Produktivcode an
     jedem `!` eine Zeile, die die Schranke benennt. Hier gilt das **nicht**, und das ist
     eine bewusste Abweichung: In einer Spec steht die Schranke im Test selbst — die
     Kapazität kommt drei Zeilen darüber aus dem Konstruktor, der Testname sagt, was da
     sein soll, und 400 Kommentare mit »the pool was created with capacity 10« sind Rauschen,
     das die Regel entwertet, wo sie einmal wirklich gebraucht wird. Kommentiert wird nur,
     wo die Invariante **nicht** lokal ist: ein Wert aus einem weit entfernten `beforeEach`,
     oder ein `!`, für das der Test selbst nichts aufsetzt. Der Reviewer kennt Paket 7 und
     wird die fehlenden Kommentare sonst als Befund melden — dieser Absatz ist die Antwort
     darauf.

  4. **Reihenfolge der Dateien: die dicken zuerst.** Zwei Dateien tragen 247 der 403
     Fundstellen, und sie zeigen das Muster in Reinform. Wer dort anfängt, hat die Regeln
     an 60 % des Pakets eingeübt, bevor die Einzelfälle kommen.

  5. **Die Stellen, die nicht nach Schema F gehen.** Sechs Gruppen, alle benannt:
     - `vertex-objects/VertexObjectBuffer.spec.ts:443,446` (`TS2769`) —
       `Array.from(vob.toAttributeArrays(['foo'], 1)['foo'])`: der Indexzugriff auf das
       Record liefert unter `noUncheckedIndexedAccess` ein `TypedArray | undefined`, und
       `Array.from` hat dafür keine Überladung. `!` hinter den Indexzugriff. Paket 8a
       verbreitert den Rückgabetyp dieser Methode; das `!` bleibt danach richtig.
     - `vertex-objects/VertexObjectPool.spec.ts:558,559` — der Helfer `bufferOfRoute()`:
       `extraInstancedPools.get(name)` und `extraInstancedBuffers.get(name)` sind beide
       optional. Beide Bindungen bekommen ihr `!` nach Regel A.
     - `vertex-objects/InstancedVertexObjectGeometry.spec.ts:119` — die Meldung lautet
       »Argument of type '"dispose"' is not assignable to parameter of type 'never'« und
       liest sich wie ein Sinon-Problem. Sie ist keines: `geometry.basePool` ist optional,
       damit findet `sandbox.spy()` keine passende Überladung mehr. `geometry.basePool!`
       und `geometry.instancedPool!` in den beiden Zeilen darüber lösen sie auf.
     - `texture/TextureStore.spec.ts:383,384` (`TS2769`) — `on(resources['b'], 'dispose',
       …)`: derselbe Fall, `resources['b']!`.
     - `map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts:268` (`TS18047`) —
       `n.nodes.northEast` ist `| null`, nicht `| undefined`. Gleiche Behandlung.
     - `vertex-objects/VertexObjectGeometry.spec.ts:58,61` und
       `InstancedVertexObjectGeometry.spec.ts:99,102` (`TS18047`) — `geometry.index` ist bei
       three.js `BufferAttribute | null`. Gleiche Behandlung.

  6. **`vertex-objects/VertexObjectPool.spec.ts:739-759` wird nicht angefasst.** Der Test
     »VOBufferPool: resets usedCount and releases typed-array references« greift Buffer vor
     dem `dispose()` und prüft danach `expect(buf.typedArray).toBeUndefined()`. Er meldet
     heute keinen Fehler, weil der Typ des Feldes die Lücke verdeckt — genau die Lücke, die
     Paket 8a schließt. Dort wird der Test zu der Stelle, an der sich der ehrliche Typ
     auszahlt. Wer ihn hier »aufräumt«, nimmt Paket 8a seinen Beleg weg.

  7. **`pnpm format` fahren, dann `pnpm lint`.** Umbrüche und Einrückung nicht von Hand
     setzen.

- Nachweis statt Regressionstest: Eine Typmigration in Testcode ändert kein
  Laufzeitverhalten; es gibt keine Zusicherung, die vorher rot sein könnte, und ein Test
  über Tests wäre eine zweite Kopie derselben Liste. Der Beleg sind drei Zahlen und eine
  Probe, alle in den Report:
  1. `pnpm --filter @spearwolf/twopoint5d run strictCheck` fällt von 403 auf 0.
  2. Die Vitest-Runde bleibt bei **45 Dateien / 703 Tests** — unverändert grün, keine
     hinzugekommene, keine verschwundene.
  3. Die Zahl der Zusicherungen bleibt gleich:
     `grep -ro 'expect(' packages/twopoint5d/src --include='*.spec.ts' | wc -l` liefert vor
     und nach dem Umbau denselben Wert. Der Ausgangswert wird **vor** der ersten Änderung
     gemessen und steht mit im Report; ohne ihn ist die zweite Messung wertlos.
  4. Die Probe zu Regel C: `git diff -U0 -- '*.spec.ts' | grep '^[-+].*expect('` durchsehen
     und im Report bestätigen, dass jedes `-`/`+`-Paar sich ausschließlich um ein `!` oder
     eine neue Bindung unterscheidet. Kein `?.`, kein gewechselter Matcher, keine
     verschwundene Zeile. In diesem Diff darf `git diff --numstat` für keine Datei mehr
     gelöschte als hinzugefügte Zeilen zeigen — eine geänderte Zeile zählt 1:1, eine
     herausgezogene Bindung fügt hinzu, und nur das Streichen einer Prüfung nähme weg.
- Verify (das Gate, muss `exit=0` liefern):
  `pnpm clean && pnpm lint && pnpm --filter @spearwolf/twopoint5d run strictCheck && pnpm build && pnpm checkPkgTypes && pnpm lintPkg && NX_TUI=false pnpm nx run twopoint5d:test --skip-nx-cache`
  Das `--skip-nx-cache` steht hier aus demselben Grund wie in Paket 7: das `test`-Target
  lieferte dort seinen grünen Lauf aus dem Cache.
- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm test:browser`. Maßstab ist die Zeile
  unter »Vorbestehende Fehler« — Chromium 0 Fehler, Firefox 24. Diese Runde zählt hier
  weniger als in den Paketen 6 und 7: die Browsersuite fährt gegen `dist/lib/index.js`, und
  dieses Paket ändert nichts, was dort landet. Sie läuft trotzdem, weil genau das die
  Behauptung ist, die sie prüft.
- Commit: `test(twopoint5d): make nullability explicit across the vitest suite`
  Bewusst `test` und nicht `refactor` wie in den Paketen 6 und 7: der Diff fasst
  ausschließlich `*.spec.ts` an, und wer `git log` überfliegt, soll ohne den Diff sehen
  können, dass hier kein ausgelieferter Code bewegt wurde.
- Ergebnis: 1 Runde · CFG-001 und CFG-002 im Umfang dieses Pakets behoben · alle 403
  Fundstellen in 17 Spec-Dateien aufgelöst, `packages/twopoint5d/tsconfig.strict.json`
  prüft ab hier `src` ohne jeden Ausschluss, also auch die 45 Spec-Dateien · kein
  Regressionstest, der Nachweis sind vier Zahlen und eine Probe: `strictCheck` 403 → 0,
  die Vitest-Runde unverändert bei 45 Dateien / 703 Tests, die Zahl der Zusicherungen
  vorher wie nachher 1751, und die Regel-C-Probe über die 136 `expect(`-Paare — nach dem
  Entfernen aller `!` sind die entfernten und die hinzugefügten Zeilen als Multimenge
  deckungsgleich, kein `?.` kam hinzu, kein Matcher wechselte, keine Prüfzeile
  verschwand. Der Spec-Diff besteht ausschließlich aus Ausrufezeichen; nicht einmal eine
  neue Bindung war nötig, weshalb Regel A und B im Ergebnis zusammenfallen · Gate
  `exit=0` (`paket-8.verify.log`, selbst gefahren), Zweig-Coverage global unverändert
  63,22 % (1183/1871) · Browsersuite `paket-8.browser.log`: Chromium 0 Fehler, Firefox
  24, `getSupportedExtensions` 92-mal — zahlengleich mit den Läufen nach Paket 6 und 7 ·
  Review in einem Durchgang, kein kritischer und kein wichtiger Befund
- klein (kein eigener Zug, hier vermerkt): `src/texture/TextureStore.spec.ts:91,95`
  tragen `resourceDisposes['a']!++`. Das parst als `(x!)++` und ist korrekt, liest sich
  aber sperrig; eine lokale Bindung wäre klarer gewesen
- Abweichungen vom Detailplan, beide vom Reviewer geprüft und getragen: Schritt 3 hat
  keine einzige Stelle gefunden, an der die Invariante nicht lokal steht — im Diff steht
  deshalb kein neuer Kommentar. Und bei `geometry.basePool`, `geometry.baseBuffers` und
  `sprites.spritePool` sitzt das `!` am Gebrauch statt an einer Bindung, auch bei
  mehrfachem Vorkommen: es gibt dort keine Bindung, an der Regel A ansetzen könnte, und
  eine einzuführen hätte genau die Zeilen erzeugt, die Regel B ablehnt
- Nebenbefunde: → Offene Befunde (3)
- Folgen: keine. Der Diff fasst nur `*.spec.ts` und die Migrations-Config an; `pnpm build`
  emittiert über `tsconfig.build.json` ohne die Specs, `dist/lib/` ist unverändert, und
  die zahlengleiche Browsersuite gegen `dist/lib/index.js` ist der Beleg dafür
- Schnittstellen: `packages/twopoint5d/tsconfig.strict.json` hat sein `exclude` verloren
  und prüft unter beiden Schaltern `src` vollständig, Specs eingeschlossen — wer eine
  neue Spec schreibt, schreibt sie ab hier gegen `strictNullChecks` und
  `noUncheckedIndexedAccess`. Die Datei verschwindet mit Paket 8a; was dann greift, ist
  `pnpm typecheck`. Zwei Stellen sind für Paket 8a bewusst so stehengelassen worden:
  `src/vertex-objects/VertexObjectPool.spec.ts:739-759` ist unangetastet und bleibt der
  Beleg für das Typloch bei `Buffer.typedArray`, und die beiden
  `toAttributeArrays(…)['foo']!` in `src/vertex-objects/VertexObjectBuffer.spec.ts:443,446`
  bleiben auch nach der Verbreiterung des Rückgabetyps richtig

**Fundstellen, 403 in 17 Dateien** (gemessen am 2026-09-04 gegen `ac64b5a`; die
Zeilennummern stehen im Zählauf, nicht hier — gearbeitet wird nach Fehlercode und Code, wie
in Paket 7):

| Datei unter `packages/twopoint5d/src/` | Fehler |
| --- | --- |
| `vertex-objects/VertexObjectPool.spec.ts` | 129 |
| `vertex-objects/vertex-buffers-geometry-updates.spec.ts` | 118 |
| `vertex-objects/VertexObjectBuffer.spec.ts` | 25 |
| `map2d/Map2DSpatialHashGrid.spec.ts` | 24 |
| `display/FixedFrameLoop.spec.ts` | 21 |
| `vertex-objects/InstancedVertexObjectGeometry.spec.ts` | 17 |
| `stage/StageRenderer.spec.ts` | 16 |
| `display/FrameLoop.spec.ts` | 10 |
| `texture/TextureStore.spec.ts` | 9 |
| `vertex-objects/VertexObjectGeometry.spec.ts` | 8 |
| `texture/TextureAtlas.spec.ts` | 7 |
| `stage/RootRenderPipeline.spec.ts` | 6 |
| `sprites/TexturedSprites/TexturedSprites.spec.ts` | 4 |
| `vertex-objects/VertexObjectDescriptor.spec.ts` | 3 |
| `map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts` | 3 |
| `texture/FrameBasedAnimations.spec.ts` | 2 |
| `vertex-objects/createVertexObjectPrototype.spec.ts` | 1 |

Die volle Liste mit Zeile und Fehlercode steht im Arbeitsverzeichnis als
`p8-zug0-fullcount.txt`; sie ist mit
`pnpm exec tsc -p packages/twopoint5d/tsconfig.strict.json` nach Schritt 1 jederzeit neu zu
erzeugen.

**CFG-001 · high · tsconfig.json:39-40** — strictNullChecks ist deaktiviert, trotz
strict: true

Die Config setzt global `strict: true` und schaltet zwei Zeilen darunter
`strictNullChecks: false`. Damit sind sämtliche Null- und Undefined-Prüfungen für den
Compiler unsichtbar. Konkret spürbar in API-001, wo `createVO()` ein Objekt verspricht und
`undefined` liefert, und in mehreren Signals vom Typ `Signal<T | undefined>`, deren
Konsumenten ungeprüft auf `.value` zugreifen. Der mit Abstand hebelstärkste Punkt dieser
Liste.

Empfehlung: `strictNullChecks: true` setzen. Es fallen erwartungsgemäß viele Fehler an —
inkrementell beheben, notfalls modulweise über eine separate tsconfig-Erweiterung
migrieren. Danach werden echte Null-Defekte vom Compiler gemeldet statt im Code-Review
gesucht.

Abgleich am 2026-09-04 (Zug 0 von Paket 8): Der Sachverhalt steht unverändert; die
Root-`tsconfig.json` trägt in Zeile 40 weiterhin `strictNullChecks: false`. Die vom Audit
als Beispiel genannte Stelle — `createVO()` liefert `VO | undefined` — ist eines der
beiden Muster, aus denen die 403 Fundstellen bestehen; das andere ist der Index- und
Map-Zugriff aus CFG-002. Allein `VertexObjectPool.spec.ts` trägt 129 davon. Der Schalter selbst bleibt bis Paket 8a liegen: solange die Specs
rot sind, wäre er ein Schalter über einer Baustelle.

**CFG-002 · medium · tsconfig.json** — noUncheckedIndexedAccess ist nicht aktiviert

Array- und Index-Zugriffe gelten als immer definiert, auch wenn der Index außerhalb der
Grenzen liegen kann. Im Buffer-Kern und in `map2d/` mit ihrer manuellen Index-Arithmetik
ist das in Kombination mit CFG-001 ein doppeltes Leck.

Empfehlung: Aktivieren, sinnvollerweise im selben Durchgang wie CFG-001 — viele
Fundstellen profitieren von beiden Schaltern gleichzeitig.

Abgleich am 2026-09-04 (Zug 0 von Paket 8): unverändert, der Schalter fehlt in der
Root-`tsconfig.json` weiterhin ganz. Sein Anteil an diesem Paket ist mit 143 × `TS2532` der
größere von beiden; `TS18048` verteilt sich auf beide Schalter. Dass sie gemeinsam gezogen
werden, ist übernommen und bestimmt den Schnitt bis Paket 8a.

### [x] 8a. Strikte Nullability, Teil 4: der globale Schalter und was ihn hält

- Findings: CFG-001 (high, der Schalter), CFG-002 (medium, der Schalter)
- Ziel: Beide Schalter stehen in der Root-`tsconfig.json`, die Migrations-Config ist
  verschwunden, ein dauerhaftes `typecheck` im Gate hält die Specs geprüft, und die zwei
  bekannten Typlöcher liegen nicht mehr unter dem Schalter.
- Bereich: `tsconfig.json` (Root), `packages/twopoint5d/tsconfig.strict.json` (entfällt),
  `packages/twopoint5d/tsconfig.typecheck.json` (neu), `packages/twopoint5d/package.json`,
  `packages/twopoint5d/project.json`, `nx.json`, `package.json` (Root),
  `packages/twopoint5d/src/vertex-objects/` (die Fundstellen unten),
  `packages/twopoint5d/src/display/FrameLoop.ts`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`,
  `apps/lookbook/src/` (fünf Dateien), `apps/lookbook/package.json`,
  `apps/lookbook/project.json`, `packages/twopoint5d/CHANGELOG.md`, `CLAUDE.md`,
  `README.md`
- Hängt ab von: Paket 8
- Geteilt aus: Paket 8 — **keine** `Folge von:`-Zeile, und das ist wörtlich gemeint: dieses
  Paket entsteht aus einem Schnitt, nicht aus Schaden, den ein Vorgänger angerichtet hat.
  Eine `Folge von:`-Zeile zählte hier als zweite Generation einer Kette und ließe die
  Generationsregel an einer Stelle anschlagen, an der nichts schiefgegangen ist
- Hinweis (Zug 0 von Paket 8): Dieses Paket ist die zweite Hälfte des ursprünglichen
  Pakets 8. Alles hier ist am 2026-09-04 gegen `ac64b5a` nachgemessen; die Zahlen sind
  Böden und keine Decken, weil Paket 8 zwischendurch die Specs bewegt.
- Hinweis (der Ort der Schalter): **Root-`tsconfig.json`, nicht
  `packages/twopoint5d/tsconfig.json`.** Der Kopf dieses Plans behauptete unter
  »Verify-Kommandos« das Zweite; das war ein Versehen und ist korrigiert. CFG-001 und
  CFG-002 verorten sich beide auf `tsconfig.json:39-40`, und das ist die Datei im
  Repo-Root. Sie wird von `packages/twopoint5d/tsconfig.json` und von
  `apps/lookbook/tsconfig.json` geerbt; `packages/twopoint5d-testing` hat keine tsconfig.
  Der Eingriff selbst ist klein: die Zeile `"strictNullChecks": false` **löschen** statt sie
  auf `true` zu drehen — `strict: true` zwei Zeilen darüber sagt es dann —, und
  `"noUncheckedIndexedAccess": true` alphabetisch zwischen
  `noPropertyAccessFromIndexSignature` und `noUnusedLocals` einfügen; die Datei ist
  durchgehend alphabetisch sortiert. Der zweite Schalter folgt nicht aus `strict` und
  verdient eine Zeile Kommentar, die sagt, was er einbringt.
- Hinweis (was der Schalter im Lookbook auslöst, gemessen): Mit beiden Schaltern in der
  Root-Config läuft `pnpm build` über beide Projekte auf `exit=0` durch — `astro build`
  transpiliert ohne Typprüfung, und die Bibliothek ist im Produktivcode seit Paket 7
  sauber. `checkPkgTypes` und `lintPkg` bleiben ebenfalls grün. Ungeprüft heißt aber nicht
  fehlerfrei: gegen die 22 `.ts`-Dateien der App meldet ein `tsc` mit beiden Schaltern
  **zehn** Fehler in fünf Dateien — `components/LookBookApi.ts` (3),
  `demos/utils/PerspectiveOrbitDemo.ts` (2), `demos/instanced-quads/createTexturedQuads.ts`
  (2), `demos/animated-sprites/BouncingSprites.ts` (2),
  `demos/animated-billboards/BouncingSprites.ts` (1); Codes 3 × `TS2532`, 3 × `TS2345`,
  2 × `TS2564`, je 1 × `TS2322` und `TS18048`. Die Liste liegt im Arbeitsverzeichnis als
  `p8-zug0-lookbook.txt` und ist mit einer Probekopie von `apps/lookbook/tsconfig.json`
  plus beiden Schaltern neu zu erzeugen. Die zehn gehören in dieses Paket: sie sind
  keine Nebenbefunde, sondern das, was die eigene Änderung umwirft. Sie stehen in keinem
  Gate — und genau deshalb ist es dieselbe Ausweichklappe, die dieser
  Plan bei `VOBufferPool.ts:90` zweimal abgelehnt hat: ein Schalter über einem bekannten
  Loch. Die 36 `.astro`-Dateien der App erreicht kein Compiler; das bleibt offen und steht
  als eigener Eintrag unter »Offene Befunde«.
- Hinweis (das erste Typloch, `VOBufferPool.ts:90`): `dispose()` schreibt
  `undefined as unknown as TypedArray` in `buffer.typedArray`. Das Verhalten ist gewollt und
  geprüft — `VertexObjectPool.spec.ts:739-759` fasst es als Vertrag —, der Typ ist es nicht.
  Der ehrliche Weg ist `typedArray: TypedArray | undefined` im Interface `Buffer`
  (`VertexObjectBuffer.ts:17`), und die Entscheidung im Kopf dieses Plans deckt ihn
  ausdrücklich: »kann eine Funktion `undefined` liefern, steht das künftig in ihrer
  Signatur — auch in der öffentlichen API«. Gemessen kostet er **22 Fundstellen im
  Produktivcode** in acht Dateien und **16 in den Specs**, alle mechanisch:
  `VertexObjectBuffer.ts` 6 (128, 129, 143, 150, 175, 207), `createVertexObjectPrototype.ts`
  5 (13, 24, 47, 49, 76), `VOBufferPool.ts` 3 (109, 130, 131), `VertexObjectPool.ts` 2
  (58 ×2), `initializeAttributes.ts` 2 (31, 51), `initializeInstancedAttributes.ts` 2
  (27, 51), `VOBufferGeometry.ts` 1 (161), `InstancedVOBufferGeometry.ts` 1 (489). In den
  Specs: `VertexObjectBuffer.spec.ts` 13, `VertexObjectPool.spec.ts` 2,
  `createVertexObjectPrototype.spec.ts` 1.
  Zur Form: `!` an der Bindung, nicht `expectDefined()`. `createVertexObjectPrototype.ts`
  trägt die generierten Accessoren und läuft je Attribut je Vertex-Objekt — Paket 7 hat den
  Preis eines Helferaufrufs dort mit 1,25× bis 1,33× über 3·10⁷ Aufrufe gemessen, während
  ein `!` zur Laufzeit nichts kostet. Ein Satz je Klasse oder je Datei genügt, der die
  Invariante benennt: ein Buffer, der über einen lebenden Pool erreicht wird, hält sein Array;
  leer ist es nur in einer Referenz, die jemand vor `dispose()` gegriffen hat, und
  `dispose()` leert die Map im selben Atemzug.
- Hinweis (das zweite Typloch, `VertexObjectBuffer.ts:214`): `toAttributeArrays()`
  deklariert `Record<string, TypedArray>` und liefert für einen unbekannten Attributnamen
  einen Eintrag mit Wert `undefined`. Warum darauf kein Compilerfehler zeigt, ist am
  2026-09-04 an einer Probe geklärt: das `.map()` liefert kein Tupel, sondern ein
  `(string | TypedArray)[]`; `Object.fromEntries()` fällt damit auf seine
  `Iterable<readonly any[]>`-Überladung zurück und gibt `any`. In der Probe compiliert ein
  Methodenaufruf auf dem Ergebnis, den es gar nicht gibt. Der Schalter fängt das nicht —
  `any` bleibt unter jeder Strictness `any`. Zwei Dinge sind also zu tun: das `.map()` muss
  echte Tupel liefern (`as const` oder ein expliziter Tupeltyp), damit die typisierte
  Überladung greift, und der Rückgabetyp muss `Record<string, TypedArray | undefined>`
  lauten. Die drei Aufrufer in den Specs (`VertexObjectBuffer.spec.ts:443,446`,
  `vertex-buffers-geometry-updates.spec.ts:402,537,568`) sind nach Paket 8 bereits mit `!`
  versehen beziehungsweise unbetroffen.
- Hinweis (was `strictCheck` ersetzt, und warum es ersetzt werden muss): Der Grobplan sah
  vor, `tsconfig.strict.json` samt dem Script `strictCheck` ersatzlos zu entfernen. Das
  ginge nicht auf: seit Paket 1 emittiert `pnpm build` über `tsconfig.build.json` ohne die
  Specs, `pnpm lint` läuft ohne Type Information, und Vitest transpiliert ohne zu prüfen.
  Ersatzlos gestrichen, endete dieser Lauf mit **weniger** Typprüfung als er begonnen hat —
  ein selbst zugefügter Rückschritt, und Paket 9 schreibt unmittelbar danach neue Specs, von
  denen der Plan verlangt, dass sie »gleich strict-konform« entstehen. Also ein Ersatz:
  - `packages/twopoint5d/tsconfig.typecheck.json` (neu) erbt aus `./tsconfig.json`, setzt
    `"noEmit": true` und sonst nichts. Der Kopfkommentar sagt, warum es die Datei gibt —
    dass der Build die Specs auslässt und diese Prüfung sie deshalb hereinholt. Eine eigene
    Datei statt eines `--noEmit` im Script, weil `packages/twopoint5d/tsconfig.json`
    `noEmit: false` und ein `outDir` von `dist/lib` trägt: ein vergessenes Flag schriebe die
    kompilierten Specs zurück nach `dist/` und machte Paket 1 rückgängig. Am 2026-09-04
    gemessen: `tsc -p packages/twopoint5d/tsconfig.json --noEmit` meldet mit beiden
    Schaltern genau die 403 Fundstellen aus Paket 8 — die Config prüft also den richtigen
    Ausschnitt.
  - `packages/twopoint5d/package.json`: `strictCheck` weicht
    `"typecheck": "pnpm tsc -p tsconfig.typecheck.json"`.
  - `nx.json`: ein `typecheck` in `targetDefaults` nach dem Muster der übrigen Einträge
    (`executor: nx:run-script`, `cache: true`). Kein `dependsOn` — die Prüfung braucht kein
    `dist/`.
  - `packages/twopoint5d/project.json`: das Target `typecheck` mit seinen `inputs`
    (`{projectRoot}/src/**/*.ts`, `{projectRoot}/tsconfig.typecheck.json`,
    `sharedTsconfigs`). Ohne die zweite Zeile liest Nx eine Änderung an der neuen Config
    nicht als Cache-Invalidierung — dieselbe Falle, die Paket 1 bei `tsconfig.build.json`
    schon einmal gestellt hat.
  - Root-`package.json`: `"typecheck": "pnpm nx run-many -t typecheck"`, und in `ci`
    zwischen `lint` und `build` eingehängt.
  - `CLAUDE.md`: die Gate-Zeile nennt die Kette `clean → lint → build → checkPkgTypes →
    lintPkg → test:ci → test:browser` und wird durch den neuen Schritt unvollständig; dazu
    eine eigene Zeile für `pnpm typecheck` in der Kommandoliste. `README.md:85` trägt
    denselben Vorbehalt im Kommentar hinter `pnpm cbt`. Beides aus demselben Grund wie in
    den Paketen 4 und 5: dieses Paket macht die Zeilen selbst unwahr. Die Node-Version in
    `README.md:75` und `AGENTS.md` bleiben unangetastet — die gehören Paket 10.
- Hinweis (CHANGELOG): Unter `## [Unreleased]` gehören die bewegten Signaturen nach
  `### Changed`, und jede Änderung, die einen Konsumenten unter `strictNullChecks` zum
  Nachbessern zwingt, zusätzlich als `####`-Abschnitt unter `### Migration Guide`; die
  Form steht nebenan, die Pakete 6 und 7 haben dieselbe Machart eingetragen. Der Skill
  `updating-changelog` gilt. **Wie viele es sind, sagt Schritt 15** — dieser Hinweis nannte
  zwei, und die Messung an den emittierten Deklarationen hat eine dritte gefunden, die kein
  Mensch angefasst hat.
- Hinweis (was beim Commit auf `[x]` geht): die beiden Einträge unter »Offene Befunde« zu
  `VOBufferPool.ts:90` und `VertexObjectBuffer.ts:214`.
- Hinweis (Abgleich, Zug 0 von Paket 8a, 2026-09-04 gegen `dca1018`): Beide Findings stehen
  unverändert — `tsconfig.json:40` trägt weiterhin `strictNullChecks: false`, und
  `noUncheckedIndexedAccess` fehlt der Datei ganz. Die Bibliothek ist bereit: `strictCheck`
  meldet 0, `tsc -p packages/twopoint5d/tsconfig.json --noEmit` mit beiden Schaltern
  meldet 0 über 170 Dateien, und `tsc -p tsconfig.build.json` mit beiden Schaltern
  ebenfalls 0. Alle Zahlen aus dem Hinweisblock oben halten gegen den heutigen Stand: die
  zehn Lookbook-Fehler stehen zeichengleich in denselben fünf Dateien, und die
  Verbreiterung von `Buffer.typedArray` kostet weiterhin genau 22 + 16 Fundstellen. Die
  Verbreiterung von `toAttributeArrays()` kostet **keine** zusätzliche: mit beiden
  Änderungen zugleich bleibt die Zählung bei 38.
- Hinweis (was der Schalter nebenbei anschaltet): `strictPropertyInitialization` gehört zu
  `strict: true`, liegt aber **still**, solange `strictNullChecks` aus ist. Mit Schritt 1
  wacht es auf. Die Bibliothek trägt das ohne eine einzige Fundstelle; im Lookbook sind
  zwei der zehn Fehler von dieser Sorte (`TS2564`) und haben mit Null-Prüfungen nichts zu
  tun. Wer die zehn nach Muster »irgendwo ein `!`« abarbeitet, geht an ihnen vorbei.
- Hinweis (fünf veröffentlichte Signaturen bewegen sich, ohne dass jemand sie anfasst):
  Am 2026-09-04 gemessen, indem `tsconfig.build.json` einmal mit und einmal ohne die
  Schalter nach `dts-off/` und `dts-on/` emittiert und die `.d.ts` verglichen wurden
  (`p8a-I-*.log`, die beiden Bäume liegen im Arbeitsverzeichnis). Zwei Dateien
  unterscheiden sich, beide an **abgeleiteten** Rückgabetypen, die erst unter
  `strictNullChecks` ehrlich werden:
  - `display/FrameLoop.d.ts` — `start(target: object)` wird von `() => void` zu
    `(() => void) | undefined`. Die Klasse steht in keiner `public-api.ts`, ist über das
    Feld `Display#frameLoop` aber öffentlich erreichbar und im gebauten
    `dist/lib/display/Display.d.ts:24` mit Namen genannt.
  - `map2d/chunk-quad-tree/ChunkQuadTreeNode.d.ts` — `isNorthWest()`, `isNorthEast()`,
    `isSouthEast()` und `isSouthWest()` werden von `boolean` zu `boolean | null`.
    `ChunkQuadTreeNode` ist über `map2d/public-api.ts` voll exportiert.
  Ohne diese Messung stünde am Ende ein veröffentlichtes `.d.ts`, das an fünf Stellen etwas
  anderes sagt als der CHANGELOG, und weder `checkPkgTypes` noch `lintPkg` schlagen darauf
  an. Was mit den beiden Stellen geschieht, steht in Schritt 6 und 7 — sie werden
  verschieden behandelt, und der Unterschied ist der Punkt.
- Hinweis (der Lookbook bekommt sein eigenes Gate — Entscheidung dieses Zug 0): Der Block
  oben stellt fest, dass die zehn Lookbook-Fehler in keinem Gate stehen, und nennt das
  beim Namen: ein Schalter über einem bekannten Loch. Zehn Fundstellen zu beheben, die
  danach niemand nachprüft, wäre genau das noch einmal — der nächste Griff in eine dieser
  Dateien öffnet das Loch wieder, und nichts sagt es. Dieses Paket legt deshalb auch über
  die 22 `.ts`-Dateien der App ein `typecheck`-Target. Gemessen ist das billig und es
  trägt: `tsc -p apps/lookbook/tsconfig.json` läuft heute auf `exit=0` durch, sieht 25
  Dateien und braucht `@astrojs/check` nicht — auch dann nicht, wenn das generierte
  Verzeichnis `apps/lookbook/.astro/` fehlt (nachgemessen, indem es beiseitegeschoben
  wurde). Was es braucht, ist das gebaute `dist/lib` der Bibliothek, denn dorthin löst
  `@spearwolf/twopoint5d` auf. Die 36 `.astro`-Dateien erreicht es weiterhin nicht; dieser
  Rest bleibt der Eintrag unter »Offene Befunde«, und die Drain-Runde schneidet dafür ein
  Paket.
- Hash: a4bfe10
- Modell: stärkste Stufe
- Effort: high
  Die Fundstellen sind einzeln aufgezählt und ihre Form steht seit Paket 7 fest — das
  allein spräche für weniger. Dagegen steht, dass dieses Paket die veröffentlichte
  Oberfläche an drei Stellen bewegt, eine vierte bewusst festhält, und dass ein falsch
  gesetztes `!` in
  `createVertexObjectPrototype.ts` in einem Accessor sitzt, der je Sprite und je Frame
  läuft. Der Reviewer ist hier der eigentliche Grund für die Stufe.
- Dateien:
  - `tsconfig.json` (Root)
  - `packages/twopoint5d/tsconfig.strict.json` (entfällt)
  - `packages/twopoint5d/tsconfig.typecheck.json` (neu)
  - `packages/twopoint5d/package.json`, `packages/twopoint5d/project.json`
  - `apps/lookbook/package.json`, `apps/lookbook/project.json`
  - `nx.json`, `package.json` (Root)
  - `packages/twopoint5d/src/vertex-objects/`: `VertexObjectBuffer.ts`,
    `createVertexObjectPrototype.ts`, `VOBufferPool.ts`, `VertexObjectPool.ts`,
    `initializeAttributes.ts`, `initializeInstancedAttributes.ts`, `VOBufferGeometry.ts`,
    `InstancedVOBufferGeometry.ts`
  - `packages/twopoint5d/src/vertex-objects/`: `VertexObjectBuffer.spec.ts`,
    `VertexObjectPool.spec.ts`, `createVertexObjectPrototype.spec.ts`
  - `packages/twopoint5d/src/display/FrameLoop.ts`,
    `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`
  - `apps/lookbook/src/`: `components/LookBookApi.ts`, `demos/utils/PerspectiveOrbitDemo.ts`,
    `demos/instanced-quads/createTexturedQuads.ts`,
    `demos/animated-sprites/BouncingSprites.ts`,
    `demos/animated-billboards/BouncingSprites.ts`
  - `packages/twopoint5d/CHANGELOG.md`, `CLAUDE.md`, `README.md`
- Vorgehen:
  1. **Die Schalter in die Root-`tsconfig.json`.** Die Zeile `"strictNullChecks": false`
     **löschen**, nicht auf `true` drehen — `"strict": true` zwei Zeilen darüber sagt es
     dann, und eine Zeile, die einen Schalter noch einmal so setzt, wie er ohnehin steht,
     lädt zum nächsten Umschalten ein. Danach `"noUncheckedIndexedAccess": true`
     alphabetisch zwischen `noPropertyAccessFromIndexSignature` und `noUnusedLocals`
     einfügen; die Datei ist durchgehend alphabetisch sortiert. Der zweite Schalter folgt
     nicht aus `strict` und bekommt darüber eine Zeile Kommentar, die sagt, was er
     einbringt: dass ein Index- oder Map-Zugriff, der ins Leere gehen kann, das auch im Typ
     sagt. Die Datei ist bisher kommentarfrei; `tsconfig.json` ist JSONC, und die beiden
     anderen tsconfigs im Repo tragen bereits `//`-Kommentare.
  2. **`Buffer.typedArray` ehrlich machen.** In `VertexObjectBuffer.ts:17` wird das Feld des
     Interface `Buffer` zu `typedArray: TypedArray | undefined`. Über dem Feld steht ein
     Satz, der sagt, wann es leer ist: `VOBufferPool#dispose()` nimmt jedem Buffer sein
     Array und leert dieselbe Map im selben Atemzug — leer sieht das Feld also nur, wer
     eine Referenz vor dem `dispose()` gegriffen hat. Genau das prüft
     `VertexObjectPool.spec.ts:739-759`, und der Test bleibt unangetastet.
  3. **Die 22 Fundstellen im Produktivcode auflösen**, alle in
     `packages/twopoint5d/src/vertex-objects/`, alle nach den Regeln aus Paket 7: `!` an der
     Bindung, wo es eine gibt, sonst am Gebrauch; ein Satz Kommentar nur, wo die Invariante
     **nicht** lokal steht. Kein `expectDefined()` — der Helfer kostet in diesen Pfaden
     einen Funktionsaufruf je Attribut je Vertex-Objekt, und Paket 7 hat den mit 1,25× bis
     1,33× über 3·10⁷ Aufrufe gemessen; ein `!` kostet zur Laufzeit nichts.
     Die Liste, gemessen am 2026-09-04 (volle Ausgabe in `p8a-D-typedarray-all.txt`):
     - `VertexObjectBuffer.ts` 128, 129, 143, 150, 175, 207 — in `copy()`, `copyArray()`,
       `copyWithin()`, `copyAttributes()` und `toAttributeArrays()`. Bei 175 und 207 sitzt
       der Zugriff in der innersten Schleife: dort die Bindung vor die Schleife ziehen
       (`const typedArray = buffer.typedArray!;`), nicht in jeder Iteration ein `!` setzen.
     - `createVertexObjectPrototype.ts` 13, 24, 47, 49, 76 — die vier generierten
       Accessoren. 41 und 70 sind die Bindungen (`const source = …`, `const target = …`);
       ein `!` dort erledigt 47, 49 und 76 mit. Die Kommentare stehen schon da (»a vertex
       object alive in its pool has its buffer …«) und werden um den Halbsatz ergänzt, dass
       dieser Buffer dann auch sein Array hält.
     - `VOBufferPool.ts` 109, 130, 131 — 109 ist `toBuffersData()`, 130/131 ist
       `fromBuffersData()`. Beide erreichen ihren Buffer über `this.buffer.buffers`, und
       diese Map ist nach `dispose()` leer; ein Buffer, der noch drinsteht, hält sein Array.
     - `VertexObjectPool.ts` 58 (zweimal in derselben Zeile),
       `initializeAttributes.ts` 31, 51, `initializeInstancedAttributes.ts` 27, 51,
       `VOBufferGeometry.ts` 161, `InstancedVOBufferGeometry.ts` 489 — je ein Gebrauch,
       `!` am Gebrauch.
  4. **`VertexObjectBuffersData` bleibt, wie es ist.** Der Typ in `types.ts:91-94` behält
     `buffers: Record<string, TypedArray>`. Er ist zugleich der **Eingabetyp** von
     `fromBuffersData()`; ihn zu verbreitern verlangte von jedem Aufrufer, `undefined` in
     seinen Daten zu behandeln, für einen Fall, den `toBuffersData()` gar nicht erzeugen
     kann. Die Verbreiterung von `Buffer.typedArray` sagt etwas über ein Feld nach
     `dispose()`; sie sagt nichts über serialisierte Buffer-Daten.
  5. **Die 16 Fundstellen in den Specs auflösen**, nach den Regeln A bis D aus Paket 8, die
     unter jenem Paket ausgeschrieben stehen — insbesondere Regel C: keine Zusicherung wird
     weicher, kein `?.` in einem `expect()`, kein gewechselter Matcher, keine verschwundene
     Prüfzeile. Verteilung: `VertexObjectBuffer.spec.ts` 13 (50, 59, 143, 152, 261, 267,
     296, 304, 337, 343, 377, 383, 409), `VertexObjectPool.spec.ts` 2 (164, 171),
     `createVertexObjectPrototype.spec.ts` 1 (108). `VertexObjectPool.spec.ts:739-759` und
     die beiden `toAttributeArrays(…)['foo']!` in `VertexObjectBuffer.spec.ts:443,446`
     bleiben unangetastet — Paket 8 hat sie ausdrücklich für dieses Paket so stehenlassen.
  6. **`toAttributeArrays()` reparieren.** Drei Änderungen an
     `VertexObjectBuffer.ts:190-217`, und alle drei zusammen: dem `.map()`-Callback einen
     Rückgabetyp geben (`(attrName): [string, TypedArray | undefined] => {`), damit
     `Object.fromEntries()` seine typisierte Überladung nimmt statt der
     `Iterable<readonly any[]>`-Überladung, die bisher `any` lieferte; aus
     `return [attrName];` wird `return [attrName, undefined];`, weil ein Tupel zwei
     Elemente hat; und der Rückgabetyp der Methode wird
     `Record<string, TypedArray | undefined>`. Ohne den Callback-Typ verpufft die
     Verbreiterung — `any` bleibt unter jeder Strictness `any`, und genau daran ist der
     Fehler bisher unentdeckt geblieben. Gemessen: die drei Änderungen zusammen erzeugen
     keinen einzigen zusätzlichen Fehler.
  7. **`FrameLoop#start()` bekommt seine Signatur ausgeschrieben:**
     `start(target: object): (() => void) | undefined`. Die Methode kehrt an zwei Stellen
     früh zurück — ein `target`, das schon eingetragen ist, bekommt keine zweite
     Abmeldefunktion —, und das ist ein echtes »es gibt hier nichts zu geben«, also der
     Fall, den die Entscheidung im Kopf dieses Plans ausdrücklich meint. Ausgeschrieben
     statt abgeleitet, damit die Änderung im Quell-Diff steht und nicht nur im emittierten
     `.d.ts`.
  8. **Die vier Prädikate in `ChunkQuadTreeNode.ts:268-282` werden enger, nicht weiter.**
     `return this.nodes.northWest && aabb.isNorthWest(…)` wird zu
     `return this.nodes.northWest != null && aabb.isNorthWest(…)`, und der Rückgabetyp
     `: boolean` wird ausgeschrieben — viermal, für alle Himmelsrichtungen. Damit bleibt
     die veröffentlichte Signatur, wie sie ist. Anders als bei `FrameLoop#start()` ist das
     `null` hier keine dritte Antwort, sondern der Durchschlag von `&&`: eine Methode, die
     `isNorthWest` heißt, antwortet ja oder nein. Kein Aufrufer kann den Unterschied sehen
     — die vier werden ausschließlich in den `if`-Zeilen von `findChunks()` (261-264)
     gelesen, wo `null` und `false` dasselbe tun, und keine Spec fasst sie an. Die vier `!`
     in diesen `if`-Zeilen bleiben stehen; TypeScript verengt nicht über einen
     Methodenaufruf hinweg.
  9. **Die zehn Fundstellen im Lookbook.** Die volle Ausgabe liegt als
     `p8a-C-lookbook.txt`; erzeugen lässt sie sich jederzeit mit
     `pnpm exec tsc -p apps/lookbook/tsconfig.json` (nach Schritt 1 ohne weitere Flags).
     Jede einzeln, weil vier verschiedene Ursachen darin stecken:
     - `components/LookBookApi.ts:54` (`TS2322`) — `let metadata: LookBookMetadata = undefined;`
       wird zu `let metadata: LookBookMetadata | undefined;`. Die Funktion darunter gibt
       bereits `LookBookMetadata | undefined` zurück; die Deklaration zieht nach.
     - `components/LookBookApi.ts:61,62` (`TS2345`) — `getAttribute()` liefert
       `string | null`, `JSON.parse()` nimmt kein `null`. Beide Attribute in Konstanten
       binden und, wenn eines fehlt, denselben Weg nehmen wie ein fehlendes Element: nichts
       parsen und `undefined` zurückgeben. Kein `?? '{}'` — ein leeres Objekt wäre die
       Behauptung, es habe Metadaten gegeben.
     - `demos/utils/PerspectiveOrbitDemo.ts:28,35` (`TS2532`) — `Display#renderer` ist
       `WebGPURenderer | undefined`. Im Konstruktor einer `Display`-Ableitung ist er
       gesetzt: `super(...)` hat ihn erzeugt. `!` mit einem Satz, der genau das sagt;
       dieselbe Invariante hält die Bibliothek an vier eigenen Stellen (`Display.ts:282`,
       `360`, `617`, `618`).
     - `demos/instanced-quads/createTexturedQuads.ts:18` (`TS18048` + `TS2532`, beide in
       derselben Zeile) — zwei Löcher hintereinander: `geometry.basePool` ist optional, und
       `createVO()` liefert seit Paket 6 `VO | undefined`. `geometry.basePool!.createVO()!.make()`,
       mit einem Satz: die Geometrie ist eine Zeile darüber mit einer Kapazität konstruiert
       worden, hat also ihren Base-Pool, und der erste `createVO()` darauf findet Platz.
     - `demos/animated-sprites/BouncingSprites.ts:25` und
       `demos/animated-billboards/BouncingSprites.ts:32` (`TS2564`) — das Feld
       `initalSpriteCount: number;` **wird gelöscht**. Es wird nirgends geschrieben und
       nirgends gelesen; die Schreibweise verrät die Herkunft, denn
       `demos/textured-sprites/BouncingSprites.ts` trägt dasselbe Feld korrekt als
       `initialSpriteCount`, im Konstruktor gesetzt und in `createSprites()` als Vorgabewert
       benutzt. Hier ist eine Kopie stehengeblieben, die nie angeschlossen wurde. Kein `!`
       an die Deklaration: eine Zusicherung, dass ein Wert schon zugewiesen werde, wäre an
       dieser Stelle unwahr.
     - `demos/animated-sprites/BouncingSprites.ts:75` (`TS2345`) —
       `this.sprites[spriteIndex]`, wobei `spriteIndex` zwei Zeilen darüber aus
       `Math.floor(Math.random() * this.sprites.length)` kommt. `!` am Gebrauch, die
       Schranke steht lokal.
  10. **`strictCheck` weicht `typecheck`.** `packages/twopoint5d/tsconfig.strict.json`
      löschen und `packages/twopoint5d/tsconfig.typecheck.json` anlegen: erbt aus
      `./tsconfig.json`, setzt `"noEmit": true` und sonst nichts. Kopfkommentar: dass
      `pnpm build` über `tsconfig.build.json` ohne die Specs emittiert und diese Prüfung sie
      deshalb hereinholt. Eine eigene Datei statt eines `--noEmit` im Script, weil
      `packages/twopoint5d/tsconfig.json` `noEmit: false` und `outDir: dist/lib` trägt — ein
      vergessenes Flag schriebe die kompilierten Specs zurück nach `dist/` und machte Paket 1
      rückgängig. Am 2026-09-04 in einer Probe nachgemessen: die Config prüft 170 Dateien,
      emittiert nichts, und `dist/` bekommt keine einzige `.spec.*`-Datei.
      In `packages/twopoint5d/package.json` weicht `strictCheck` dem Eintrag
      `"typecheck": "pnpm tsc -p tsconfig.typecheck.json"`.
  11. **Der Lookbook bekommt dasselbe Target.** In `apps/lookbook/package.json`:
      `"typecheck": "pnpm exec tsc -p tsconfig.json"` — die App-tsconfig trägt `noEmit: true`
      bereits selbst, ein Flag braucht es nicht. Dazu `"typescript": "^5.9.3"` in die
      `devDependencies` der App, dieselbe Range wie im Root-Manifest: heute erreicht `tsc`
      dieses Verzeichnis nur, weil `astro` selbst von TypeScript abhängt, und ein Script,
      dessen Werkzeug zufällig danebenliegt, ist dieselbe Bauart von Defekt, die dieser Plan
      für `cd dist` schon einmal notiert hat.
  12. **Die Verdrahtung in Nx.** In `nx.json` ein `typecheck` in `targetDefaults` nach dem
      Muster der übrigen Einträge — `"executor": "nx:run-script"`,
      `"options": {"script": "typecheck"}`, `"cache": true`. **Kein `dependsOn` im
      Default:** die Bibliothek prüft ihre Quellen und braucht kein `dist/`.
      In `packages/twopoint5d/project.json` das Target `typecheck` mit seinen `inputs`:
      `{projectRoot}/src/**/*.ts`, `{projectRoot}/tsconfig.typecheck.json`,
      `sharedTsconfigs`. Ohne die zweite Zeile liest Nx eine Änderung an der neuen Config
      nicht als Cache-Invalidierung — dieselbe Falle, die Paket 1 bei `tsconfig.build.json`
      schon einmal gestellt hat.
      In `apps/lookbook/project.json` das Target `typecheck` mit `"dependsOn": ["^build"]`
      und den `inputs` `{projectRoot}/src/**/*.ts`, `sharedTsconfigs`, `^default`. Das
      `dependsOn` ist hier echt und nicht vorsichtshalber: die App löst
      `@spearwolf/twopoint5d` auf `packages/twopoint5d/dist/lib/index.d.ts` auf, und ohne
      Build gibt es die Datei nicht. Das generierte `apps/lookbook/.astro/` braucht sie
      nicht — nachgemessen, indem es beiseitegeschoben wurde.
  13. **Das Gate.** In der Root-`package.json`:
      `"typecheck": "pnpm nx run-many -t typecheck"`, und in `ci` **zwischen `build` und
      `checkPkgTypes`** eingehängt. Der Hinweisblock oben sah »zwischen `lint` und `build`«
      vor; das trägt nicht mehr, seit der Lookbook mitprüft: sein Target hängt an `^build`,
      Nx zöge den Build also in den Typecheck-Schritt hinein, und die Kette in `ci` läse
      sich anders, als sie läuft. Nach dem Build steht die Reihenfolge, wie sie ist.
  14. **Doku.** `CLAUDE.md`: die Gate-Zeile nennt die Kette
      `clean → lint → build → checkPkgTypes → lintPkg → test:ci → test:browser` und wird
      durch den neuen Schritt unwahr; dazu eine eigene Zeile für `pnpm typecheck` in der
      Kommandoliste, in der Machart der Nachbarzeilen. `README.md:85` trägt hinter
      `pnpm cbt` einen Kommentar, der die Kette in Prosa zusammenfasst; er nennt sie
      danach vollständig — auch `lintPkg`, das dort schon vor diesem Paket fehlte. Eine
      Zeile, die eine Kette aufzählt und einen Schritt auslässt, ist als Ganzes falsch;
      sie mit einem zweiten Loch stehenzulassen, während man sie gerade anfasst, wäre die
      teurere Variante. `README.md:75` (Node-Version) und `AGENTS.md` bleiben unangetastet —
      die gehören Paket 10.
  15. **CHANGELOG**, Skill `updating-changelog` gilt. Unter `## [Unreleased]` nach
      `### Changed` **drei** Einträge, für die drei Signaturen, die sich bewegen:
      `Buffer.typedArray` (über `VertexObjectBuffer#buffers` erreichbar), der Rückgabetyp
      von `VertexObjectBuffer#toAttributeArrays()` und `FrameLoop#start()`. Jede der drei
      zwingt einen Konsumenten unter `strictNullChecks` zum Nachbessern und bekommt deshalb
      zusätzlich einen `####`-Abschnitt unter `### Migration Guide`; die Form steht nebenan,
      zuletzt bei »`DataIdsChunk2D#readDataIdAt()` can answer `undefined`«.
      Kein Eintrag zu den vier `ChunkQuadTreeNode`-Prädikaten: ihre Signatur bleibt nach
      Schritt 8 genau so, wie sie veröffentlicht ist, und was sich nicht ändert, gehört
      nicht in einen CHANGELOG. Der Schalter selbst gehört ebenfalls nicht hinein — er
      ändert, wie dieses Repo prüft, nicht, was es ausliefert.
  16. **`pnpm format` fahren, dann `pnpm lint`.** Umbrüche und Einrückung nicht von Hand
      setzen.
- Nachweis statt Regressionstest: Die drei Typänderungen im Bibliothekscode ändern kein
  Laufzeitverhalten — es gibt keine Zusicherung, die vorher rot sein könnte. Die eine
  Ausnahme ist Schritt 8: dort wird aus einem `null` ein `false`, und der Beleg dafür ist,
  dass die vier Prädikate ausschließlich in `if`-Bedingungen gelesen werden (`findChunks()`,
  `ChunkQuadTreeNode.ts:261-264`) und in keiner Spec vorkommen. Beides gehört in den Report,
  mit `grep`-Beleg. Dazu vier Zahlen:
  1. `pnpm exec tsc -p apps/lookbook/tsconfig.json` fällt von 10 auf 0.
  2. `pnpm nx run-many -t typecheck` läuft über **beide** Projekte und meldet 0.
  3. Die Vitest-Runde bleibt bei **45 Dateien / 703 Tests**, unverändert grün.
  4. Der Vergleich der emittierten Deklarationen vor und nach dem Paket zeigt **genau
     drei** geänderte Signaturen — `Buffer.typedArray`, `toAttributeArrays()`,
     `FrameLoop#start()` — und keine vierte. Erzeugen wie im Hinweis oben: `dts` einmal
     aus `HEAD` und einmal aus dem Arbeitsbaum nach `--outDir`/`--declarationDir` ins
     Arbeitsverzeichnis, dann `diff -r`. Diese Zahl ist der Beleg, dass der CHANGELOG
     vollständig ist; ohne sie ist er eine Behauptung.
- Verify (das Gate, muss `exit=0` liefern) — es fährt die neue Kette in der Reihenfolge,
  in der `ci` sie ab jetzt fährt, und benutzt für `typecheck` das Target und nicht die
  Paket-Scripts, sonst ist die Verdrahtung nicht belegt:
  `pnpm clean && pnpm lint && pnpm build && NX_TUI=false pnpm nx run-many -t typecheck --skip-nx-cache && pnpm checkPkgTypes && pnpm lintPkg && NX_TUI=false pnpm nx run twopoint5d:test --skip-nx-cache`
  Das `--skip-nx-cache` steht aus demselben Grund wie in den Paketen 7 und 8: das
  `test`-Target lieferte dort seinen grünen Lauf aus dem Cache.
- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm test:browser`. Maßstab ist die Zeile
  unter »Vorbestehende Fehler« — Chromium 0 Fehler, Firefox 24, `getSupportedExtensions`
  92-mal. Sie zählt hier mehr als in Paket 8: dieses Paket ändert Produktivcode, der in
  `dist/lib/index.js` landet, und die Browsersuite fährt genau dagegen.
- Commit: `build: enable strictNullChecks and noUncheckedIndexedAccess across the workspace`
  `build` und ohne Scope, weil der Diff über drei Projekte geht und der Schalter in der
  Root-Config die Änderung ist, aus der alles andere folgt.
- Ergebnis: 1 Runde · CFG-001 und CFG-002 behoben — die Zeile `strictNullChecks: false` ist
  aus der Root-`tsconfig.json` gelöscht (`strict: true` trägt sie), `noUncheckedIndexedAccess`
  steht alphabetisch daneben mit der Zeile Kommentar, die sagt, was er einbringt · kein
  Regressionstest, sondern vier gemessene Zahlen, alle bestätigt: Lookbook 10 → 0 Fehler ·
  `nx run-many -t typecheck` über beide Projekte auf 0 · Vitest unverändert 45 Dateien /
  703 Tests · der `.d.ts`-Vergleich zeigt genau drei bewegte Signaturen und keine vierte,
  vom Reviewer unabhängig in einem Worktree auf `dca1018` nachgerechnet · Browsersuite
  deckungsgleich mit der Baseline (Chromium 0, Firefox 24, `getSupportedExtensions` 92-mal,
  exit=1 wie in den Paketen 7 und 8) · klein: `LookBookApi.ts:66` gibt bei fehlendem
  Attribut still `undefined` zurück, während ein fehlendes Element 15 Zeilen tiefer wirft —
  zwei Wege für denselben Defekt, folgenlos, weil die Funktion repoweit keinen Aufrufer hat
  (der Detailplan widersprach sich an dieser Stelle selbst) · klein: `pnpm-lock.yaml` hat
  neben dem gewollten `typescript`-Eintrag `ws@8.19.0` verloren, weil `happy-dom` und
  `jsdom` beide auf `8.21.3` zusammenfallen — validiert sauber, kostet nur Diff
- Nebenbefunde: → Queue (fünf Einträge)
- Folgen: `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts:358-361`
  und `:369-372` — die vier Prädikate liefern nach Schritt 8 ein ausgeschriebenes `boolean`,
  womit das `|| false` und das `!!` an diesen Stellen tot sind; der `describe`-Block bleibt
  grün und prüft dasselbe, könnte aber direkt auf `toBe(false)` gehen. Nicht angefasst, weil
  Regel C verbietet, an einer Zusicherung zu drehen. Der Detailplan behauptete unter
  Schritt 8, keine Spec fasse die vier an — das trägt nicht, und damit fällt die Stelle
  diesem Paket zu. Gehört in die Runde, die diese Datei ohnehin öffnet: **Paket 9**, das
  Testabdeckung an den Rändern ergänzt
- Schnittstellen: Beide Schalter stehen ab hier in der **Root**-`tsconfig.json` und gelten
  für `packages/twopoint5d` wie für `apps/lookbook` — wer irgendwo im Workspace eine Zeile
  schreibt, schreibt sie unter `strictNullChecks` und `noUncheckedIndexedAccess`, und
  `strictPropertyInitialization` ist damit ebenfalls wach ·
  `packages/twopoint5d/tsconfig.strict.json` und das Script `strictCheck` gibt es nicht
  mehr; an ihre Stelle tritt `pnpm typecheck` (Root: `pnpm nx run-many -t typecheck`), das
  über zwei Projekte läuft: `packages/twopoint5d/tsconfig.typecheck.json` (neu, erbt aus
  `./tsconfig.json`, `noEmit: true`, prüft `src` samt Specs) und `apps/lookbook/tsconfig.json`
  (`dependsOn: ["^build"]`, weil die App gegen `dist/lib` auflöst) · das Gate lautet ab hier
  `clean → lint → build → typecheck → checkPkgTypes → lintPkg → test:ci → test:browser` ·
  `Buffer.typedArray` in `VertexObjectBuffer.ts:17` ist `TypedArray | undefined`; wer einen
  Buffer über einen lebenden Pool erreicht, hält sein Array, und `VOBufferPool#dispose()`
  schreibt dort jetzt `undefined` statt eines Casts ·
  `VertexObjectBuffer#toAttributeArrays()` gibt `Record<string, TypedArray | undefined>`
  und liefert für einen unbekannten Attributnamen ein echtes Tupel statt `any` ·
  `FrameLoop#start(target)` gibt `(() => void) | undefined` — ein bereits eingetragenes
  `target` bekommt keine zweite Abmeldefunktion · `VertexObjectBuffersData.buffers` bleibt
  bewusst `Record<string, TypedArray>` · die vier `ChunkQuadTreeNode`-Prädikate bleiben
  `boolean`, ausgeschrieben · `apps/lookbook` hat `typescript` in seinen `devDependencies`

**CFG-001 · high · tsconfig.json:39-40** — strictNullChecks ist deaktiviert, trotz
strict: true

Die Config setzt global `strict: true` und schaltet zwei Zeilen darunter
`strictNullChecks: false`. Damit sind sämtliche Null- und Undefined-Prüfungen für den
Compiler unsichtbar. Konkret spürbar in API-001, wo `createVO()` ein Objekt verspricht und
`undefined` liefert, und in mehreren Signals vom Typ `Signal<T | undefined>`, deren
Konsumenten ungeprüft auf `.value` zugreifen. Der mit Abstand hebelstärkste Punkt dieser
Liste.

Empfehlung: `strictNullChecks: true` setzen. Es fallen erwartungsgemäß viele Fehler an —
inkrementell beheben, notfalls modulweise über eine separate tsconfig-Erweiterung
migrieren. Danach werden echte Null-Defekte vom Compiler gemeldet statt im Code-Review
gesucht.

Abgleich am 2026-09-04 (Zug 0 von Paket 8a): Der Sachverhalt steht unverändert;
`tsconfig.json:40` trägt weiterhin `strictNullChecks: false`. Von der Empfehlung wird an
einem Punkt bewusst abgewichen: der Schalter wird nicht auf `true` gesetzt, sondern die
Zeile gelöscht — `strict: true` darüber leistet dasselbe, und die verbleibende Zeile wäre
eine Einladung, sie eines Tages wieder umzulegen. Der zweite Halbsatz der Empfehlung, die
Migration über eine separate tsconfig-Erweiterung, ist mit den Paketen 6 bis 8 gefahren und
endet hier: `tsconfig.strict.json` verschwindet in Schritt 10.

**CFG-002 · medium · tsconfig.json** — noUncheckedIndexedAccess ist nicht aktiviert

Array- und Index-Zugriffe gelten als immer definiert, auch wenn der Index außerhalb der
Grenzen liegen kann. Im Buffer-Kern und in `map2d/` mit ihrer manuellen Index-Arithmetik
ist das in Kombination mit CFG-001 ein doppeltes Leck.

Empfehlung: Aktivieren, sinnvollerweise im selben Durchgang wie CFG-001 — viele
Fundstellen profitieren von beiden Schaltern gleichzeitig.

Abgleich am 2026-09-04 (Zug 0 von Paket 8a): unverändert, der Schalter fehlt der
Root-`tsconfig.json` weiterhin ganz. Der Empfehlung wird gefolgt — beide Schalter gehen in
Schritt 1 gemeinsam, wie schon in den Paketen 6 bis 8, wo sie gemeinsam gezählt wurden.

### [x] 9. Testabdeckung an den Rändern ergänzen

- Findings: TEST-010 (info), TEST-011 (info), TEST-013 (info)
- Ziel: Ein Smoke-Test fängt monoton wachsenden Heap über viele Frames ab,
  Grenzfall-Matrizen für Tile-Offsets und Atlas-Indizes laufen tabellengetrieben, und
  kein Testname verweist mehr auf eine Laufnummer, die niemand mehr auflösen kann.
- Bereich: `packages/twopoint5d-testing/test/`, `packages/twopoint5d/src/texture/`,
  `packages/twopoint5d/src/map2d/`
- Hängt ab von: Paket 8a
- Hinweis: Bewusst nach den Strictness-Paketen — so entstehen die neuen Tests gleich
  strict-konform, statt in Paket 8 nachmigriert zu werden. Der Memory-Smoke-Test ist
  auf dieser Maschine nur unter Chromium verifizierbar.
- Hinweis (Zug 0 von Paket 5): Der letzte Satz steht unter Vorbehalt. Paket 5 hebt die
  drei `@web/*`-Majors, und in einer isolierten Installation nimmt das Firefox den
  `this.gl is null` weg — Firefox rendert dort. Trifft das im echten Baum zu, ist der
  Memory-Smoke-Test auch unter Firefox verifizierbar, und der Satz oben ist zu streichen
  statt zu befolgen. Was gilt, steht nach Paket 5 unter »Vorbestehende Fehler«; diese
  Zeile ist der Maßstab, nicht dieser Hinweis. Wahrscheinlich wartet dort auch eine
  offene Firefox-Assertion aus `vertex-objects-gpu-upload.test.js` — dieses Paket fasst
  dieselbe Datei nicht an, sollte den Eintrag aber kennen, bevor es neue Browsertests
  daneben stellt.
- Ergebnis von Paket 5 (2026-09-04, d011232): Der Vorbehalt löst sich zugunsten des
  ursprünglichen Satzes auf. Firefox rendert im echten Baum weiterhin nicht, alle 24
  Tests bleiben rot, und die erwartete einzelne Assertion gibt es nicht. Der
  Memory-Smoke-Test ist also nur unter Chromium verifizierbar, wie oben. Neu für dieses
  Paket: die Vitest-Runde fährt mit Coverage-Schwellen aus
  `packages/twopoint5d/vite.config.ts` (Werte in der `Schnittstellen:`-Zeile von Paket 5).
  Neue Tests heben die gemessene Abdeckung; ob die Schwellen mitwandern, entscheidet
  dieses Paket, statt sie stehen zu lassen, bis der Abstand jede Aussagekraft verloren
  hat.
- Hinweis (Zug 0 von Paket 8): Das ursprüngliche Paket 8 ist geteilt, die Abhängigkeit
  zeigt deshalb jetzt auf **8a** — dort liegt der globale Schalter, und erst danach
  entstehen neue Tests unter denselben Regeln wie der Bestand. Zwei Dinge stehen dann
  bereit, die es beim Schreiben des Grobplans nicht gab: `pnpm typecheck` prüft `src` samt
  Specs und läuft im Gate mit, eine neue Spec wird also sofort auf Strictness geprüft
  statt erst beim nächsten Sammellauf. Und die vier Regeln aus dem Detailplan von Paket 8
  (Bindung statt Gebrauch, kein `expectDefined()` in Specs, keine weichere Zusicherung,
  Kommentar nur bei nicht-lokaler Invariante) gelten für neue Specs unverändert weiter —
  sie stehen dort ausgeschrieben.
- Hinweis (Zug 0 von Paket 8a): Der Eintrag zu `TextureStore.spec.ts:885` aus »Offene
  Befunde« gehört hierher — er ist die dritte Fundstelle von TEST-013 in derselben Datei,
  und die `Ziel:`-Zeile oben deckt ihn bereits ab. Beim Schnitt des Detailplans mitnehmen,
  damit die Drain-Runde nicht für eine Zeile ein eigenes Paket schneidet.
  Zwei Dinge aus Paket 8a, die den Schnitt hier nicht ändern, aber den Rahmen: `pnpm
  typecheck` prüft ab dann `src` samt Specs und läuft im Gate zwischen `build` und
  `checkPkgTypes` — eine neue Spec ist damit sofort auf beide Schalter geprüft. Und
  `packages/twopoint5d-testing` hat weiterhin **keine** tsconfig; die `.test.js` der
  Browsersuite prüft kein Compiler, weder vor noch nach Paket 8a. Ein neuer Browsertest
  dort bekommt seine Sicherheit aus dem Testlauf, nicht aus dem Typsystem.
- Folge aus Paket 8a (a4bfe10):
  `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts:358-361`
  und `:369-372` — die vier Prädikate `isNorthWest()`, `isNorthEast()`, `isSouthEast()` und
  `isSouthWest()` geben seit 8a ein ausgeschriebenes `boolean`, womit das `|| false` und das
  `!!` in diesem `describe`-Block tot sind. Der Block ist grün und prüft weiter dasselbe;
  ohne die Coercions ginge »returns falsy« direkt auf `toBe(false)`. Paket 8a hat die Stelle
  nicht angefasst, weil Regel C verbietet, an einer Zusicherung zu drehen, ohne dass ein
  Paket die Datei ohnehin öffnet. Dieses Paket öffnet sie — beim Schnitt des Detailplans
  mitnehmen.
- Hinweis (Abgleich, Zug 0 von Paket 9, 2026-09-04 gegen `a4bfe10`): Alle drei Findings
  stehen unverändert, TEST-013 allerdings in größerem Umfang als das Audit gezählt hat.
  Im Einzelnen:
  **TEST-010** — `packages/twopoint5d-testing/test/` enthält sieben `.test.js`, keine davon
  misst Speicher. Unverändert.
  **TEST-011** — `grep -rn "test.each\|it.each\|describe.each" packages/twopoint5d/src/`
  liefert im ganzen Paket **null** Treffer. Die beiden benannten Ränder werden heute mit
  Einzelfällen abgedeckt: `Map2DTileCoordsUtil.spec.ts` prüft `getTileCoords()` mit fünf
  Aufrufen, `TileSet.spec.ts` prüft `frameId()` mit genau einem (`frameId(1)` auf einem
  Ein-Kachel-Set). Unverändert.
  **TEST-013** — die Nummern sitzen unverändert an `TextureStore.spec.ts:281` und `:316`.
  Es sind aber **sechs** statt zwei: `:281 (BUG-11)`, `:316 (BUG-10)`, `:349 (BUG-9)`,
  `:409 (BUG-8)`, `:425 (BUG-3)`, `:539 (BUG-4)`. Alle sechs stammen aus demselben Commit
  (`7475b47`), stehen in derselben Datei und fallen unter denselben Satz der `Ziel:`-Zeile.
  Das ist keine Scope-Verschiebung, sondern die vollständig ausgemessene Fundstelle eines
  Findings, das dieses Paket ohnehin trägt. `grep -rn "BUG-\|SEC-\|PERF-\|ARCH-\|TEST-\|CFG-\|DEPS-\|CONS-\|LEAK-"`
  über `packages/` und `apps/` findet im ganzen Repo keine weitere Nummer.
- Hinweis (die Queue-Zeile zu `TextureStore.spec.ts:885` nennt eine Zeile, die es nicht
  gibt): Die Datei hat 685 Zeilen und hatte sie über den ganzen Lauf — gegen `ba44e8e`,
  `23f768c`, `c67ef74`, `dca1018` und `a4bfe10` einzeln nachgezählt. Die Nummer im Eintrag
  ist verschrieben; gemeint war eine der vier Fundstellen, die das Audit nicht zählt. Der
  Eintrag ist entsprechend korrigiert, und die dritte Fundstelle, die er ankündigt, ist in
  Wahrheit die dritte bis sechste. Wer ihn liest, sucht sonst in einer Datei, die dort
  aufhört, wo er hinzeigt.
- Hinweis (was `performance.memory` in diesem Harness wirklich liefert — gemessen am
  2026-09-04 gegen `playwright@1.62.1`, Chromium headless): **Ohne Startflag misst die
  Empfehlung des Audits nichts.** `performance.memory.usedJSHeapSize` steht auf glatten
  `10000000` und bewegt sich nicht, wenn 20 MB alloziert und gehalten werden — Chromium
  quantelt den Wert aus Datenschutzgründen auf einen festen Eimer. Mit
  `--enable-precise-memory-info` folgt er der Allokation byteweise (+2 MB je Schritt,
  sichtbar). Damit ist die Empfehlung umsetzbar, aber nur mit dem Flag.
  **Und sie misst auch mit Flag nichts, solange kein GC erzwungen wird.** Über 120 Frames
  gemessen, je 40 kurzlebige Allokationen: die leckfreie Schleife steigt von 1,5 MB auf
  66 MB und fällt am Ende auf 6,7 MB, die leckende von 13 MB auf 72 MB — die beiden
  Kurven sind nicht unterscheidbar. Ein »wächst nicht monoton« auf dem rohen Wert wäre ein
  Münzwurf, der die saubere Schleife rot meldet. Mit `--js-flags=--expose-gc` und
  `globalThis.gc({execution: 'sync', type: 'major'})` vor jeder Probe trennen sich die
  beiden sauber: **leckfrei 518 → 536 KiB (Delta 18 KiB), leckend 1195 → 78098 KiB
  (Delta 76903 KiB)** — Faktor 4000 zwischen Signal und Rauschen. Deshalb stehen beide
  Flags im Vorgehen, und deshalb weicht der Test von der wörtlichen Empfehlung ab: er
  vergleicht Proben **nach** einem erzwungenen Major-GC statt den rohen Verlauf.
  `launchOptions` reicht `@web/test-runner-playwright@1.0.0` unverändert an
  `playwright.chromium.launch()` durch (`dist/PlaywrightLauncher.js:106`), das Flag kommt
  also an.
- Hinweis (der Heap-Test ist Chromium-only, und er muss sich selbst überspringen): Firefox
  hat weder `performance.memory` noch `globalThis.gc`, und auf dieser Maschine bekommt er
  ohnehin keinen GL-Kontext. Ein neues `.test.js`, das wie seine Nachbarn ein `Display`
  hochfährt, macht aus den 24 Firefox-Fehlern unter »Vorbestehende Fehler« 25 — und der
  Verify-Lauf von Zug 5 liest das als Regression, obwohl nichts kaputt ist. Der Test
  überspringt sich deshalb in einem `before`-Hook, **bevor** ein `Display` entsteht.
  Firefox bleibt damit exakt bei 24, und das ist der Maßstab.
- Hinweis (wovon der Heap-Test die Finger lässt): TEST-010 nennt drei Baustellen —
  TileBox-Pool, VOBufferPool-Dispose, `clearUnused()`. Der TileBox-Pool ist **kein**
  Kandidat: `CameraBasedVisibility.ts:110` leckt nachweislich und steht als offener Befund
  mit dem Urteil → Audit in der Queue, also unbehoben. Ein Smoke-Test darüber wäre am
  ersten Tag rot und würde dieses Paket an einem Defekt aufhängen, den es gar nicht
  beheben darf. Der Test fährt die Geometrie- und Pool-Strecke, die
  `vertex-objects-dispose.test.js` nebenan schon auf Korrektheit prüft.
- Hinweis (was beim Commit auf `[x]` geht): die beiden Einträge unter »Offene Befunde« zu
  `ChunkQuadTreeNode.extended.spec.ts:401-415` und zu
  `TextureStore.spec.ts:349,409,425,539`. Beide sind in diesem Detailplan aufgegangen
  (Schritt 4b und Schritt 1); sie werden mit dem Commit dieses Pakets abgehakt und tragen
  dort den Hash. Der Eintrag zu `VertexObjectDescriptor.spec.ts` bleibt offen und geht in
  die Drain-Runde — die Begründung steht bei ihm.
- Hinweis (die vier Spec-Regeln aus Paket 8 gelten weiter, und Regel C zielt hier besonders
  scharf): Dieses Paket schreibt Zusicherungen neu, statt sie nur strict-fest zu machen.
  Jede Änderung an einem `expect()` muss die Zusicherung **schärfer** machen, nie weicher —
  aus `expect(flags.some((f) => f === false)).toBe(true)` wird eine benannte Erwartung an
  eine benannte Himmelsrichtung, nicht etwas Vageres. Wo eine Stelle sich nicht schärfen
  lässt, geht sie als Folge in den Report, nicht in eine umformulierte Zusicherung.
- Hash: bf868e4
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts` (sechs `describe`-Namen)
  - `packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.spec.ts` (neuer Tabellenblock)
  - `packages/twopoint5d/src/texture/TileSet.spec.ts` (neuer Tabellenblock)
  - `packages/twopoint5d/src/texture/TextureAtlas.spec.ts` (neuer Tabellenblock)
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.extended.spec.ts`
    (zwei Tests deterministisch machen)
  - `packages/twopoint5d-testing/test/vertex-objects-heap.test.js` (neu)
  - `packages/twopoint5d-testing/web-test-runner.config.js` (zwei Chromium-Startflags)
  - `packages/twopoint5d/vite.config.ts` (Coverage-Schwellen nachziehen)
- Vorgehen:
  1. **Die sechs toten Nummern aus `TextureStore.spec.ts`.** In den `describe`-Namen an
     den Zeilen 281, 316, 349, 409, 425 und 539 entfällt jeweils der Klammerzusatz samt
     dem Leerzeichen davor — ` (BUG-11)`, ` (BUG-10)`, ` (BUG-9)`, ` (BUG-8)`, ` (BUG-3)`,
     ` (BUG-4)`. Sonst nichts: die verbleibenden Namen sagen bereits, was der Block
     zusichert (`error events instead of console.error`, `whenResource() / abortable
     get()`, `clearUnused()`, `on()/get() listener bookkeeping`, `parse() update path`,
     `TextureResource.load() image race`). Keiner wird umbenannt, kein Test bewegt sich.
     Zur Kontrolle danach:
     `grep -rn "BUG-\|SEC-\|PERF-\|ARCH-\|TEST-\|CFG-\|DEPS-\|CONS-\|LEAK-" packages/ apps/ --include=*.ts --include=*.js --include=*.mjs --include=*.json`
     muss leer bleiben.
  2. **Tabelle für die Kachel-Offsets**, in `Map2DTileCoordsUtil.spec.ts` als neuer
     `describe`-Block neben den bestehenden. `test.each` über die Rückgabe von
     `getTileCoords(left, 0, width, 16)` bei `new Map2DTileCoordsUtil(16, 16)`, geprüft
     werden `tileLeft` (Feld 0) und `columns` (Feld 2); `tileTop` ist konstant `0`,
     `rows` konstant `1`. Die Matrix ist am 2026-09-04 aus der Implementierung
     durchgerechnet und lautet, als `left → (width: [tileLeft, columns])`:

     ```
     left=-17  0:[-2,1]  1:[-2,1]  15:[-2,2]  16:[-2,2]  17:[-2,2]  32:[-2,3]
     left=-16  0:[-1,0]  1:[-1,1]  15:[-1,1]  16:[-1,1]  17:[-1,2]  32:[-1,2]
     left= -1  0:[-1,1]  1:[-1,1]  15:[-1,2]  16:[-1,2]  17:[-1,2]  32:[-1,3]
     left=  0  0:[ 0,0]  1:[ 0,1]  15:[ 0,1]  16:[ 0,1]  17:[ 0,2]  32:[ 0,2]
     left=  1  0:[ 0,1]  1:[ 0,1]  15:[ 0,1]  16:[ 0,2]  17:[ 0,2]  32:[ 0,3]
     left= 15  0:[ 0,1]  1:[ 0,1]  15:[ 0,2]  16:[ 0,2]  17:[ 0,2]  32:[ 0,3]
     left= 16  0:[ 1,0]  1:[ 1,1]  15:[ 1,1]  16:[ 1,1]  17:[ 1,2]  32:[ 1,2]
     left= 17  0:[ 1,1]  1:[ 1,1]  15:[ 1,1]  16:[ 1,2]  17:[ 1,2]  32:[ 1,3]
     ```

     Dazu ein zweiter Block mit `new Map2DTileCoordsUtil(16, 16, 4, 0)`, der zeigt, dass
     der Offset die Kachelgrenze mitverschiebt — `left → (width: [tileLeft, columns])`:

     ```
     left= 3   1:[-1,1]  16:[-1,2]  17:[-1,2]
     left= 4   1:[ 0,1]  16:[ 0,1]  17:[ 0,2]
     left= 5   1:[ 0,1]  16:[ 0,2]  17:[ 0,2]
     left=19   1:[ 0,1]  16:[ 0,2]  17:[ 0,2]
     left=20   1:[ 1,1]  16:[ 1,1]  17:[ 1,2]
     left=21   1:[ 1,1]  16:[ 1,2]  17:[ 1,2]
     ```

     Ein Kommentar über dem Block hält die eine Unstetigkeit fest, die die Tabelle
     sichtbar macht und die sonst niemand kennt: **eine Auswahl der Breite 0 liefert
     `columns === 0`, wenn `left` genau auf einer Kachelgrenze sitzt, und `columns === 1`
     sonst.** Das ist der entartete Fall und kein Defekt — aber es ist die Zahl, die beim
     nächsten Umbau kippt, wenn niemand sie festhält. Kein Kommentar wiederholt die
     Tabelle in Prosa.
  3. **Tabelle für die Atlas-Indizes**, zwei Blöcke.
     (a) In `TileSet.spec.ts` ein `describe` über die Umlauf-Arithmetik von
     `frameId(tileId)`. Fixture ist das bestehende Set aus dem Test »tiles with margin +
     padding«: `new TileSet(new TextureCoords(0, 0, 128, 256), {margin: 1, padding: 1,
     tileWidth: 55, tileHeight: 61, tileCount: 6, firstId: 4})` — daraus `firstId 4`,
     `lastId 9`, `firstFrameId 0`, `lastFrameId 5`. `test.each` über
     `tileId → frameId`:

     ```
     im bereich   4→0   5→1   6→2   7→3   8→4   9→5
     darueber    10→0  11→1  15→5  16→0
     darunter     3→5   2→4   1→3   0→2  -1→1  -2→0  -3→5
     ```

     Der Grund, warum das eine Tabelle verdient und kein Einzelfall: `frameId()` rechnet
     `((((tileId - firstId) % tileCount) + tileCount) % tileCount) + firstFrameId`, und
     der doppelte Modulo steht dort genau deshalb, weil `%` in JavaScript das Vorzeichen
     des Dividenden behält. Die Zeile »darunter« ist die einzige, die das prüft.
     (b) In `TextureAtlas.spec.ts` ein `describe` über die Ränder des Index. Fixture: ein
     Atlas mit drei Frames, davon zwei benannt. Geprüft werden
     `get(-1) → undefined`, `get(0) → der erste Frame`, `get(2) → der letzte Frame`,
     `get(3) → undefined`, `size → 3`, `frameId(<bekannter Name>) → sein Index`,
     `frameId('nicht-vergeben') → undefined`, `frame('nicht-vergeben') → undefined`.
     Dazu ein zweiter, kurzer Block über den leeren Atlas: `size → 0`,
     `get(0) → undefined`, `randomFrame() → undefined`, `randomFrameName() → undefined`,
     `randomFrames(2) → [undefined, undefined]`,
     `randomFrameNames(2) → [undefined, undefined]`. Der leere Atlas ist der Rand, den
     die Signaturen seit Paket 7 ausdrücklich versprechen; heute prüft ihn nichts.
  4. **Die zwei Stellen in `ChunkQuadTreeNode.extended.spec.ts` deterministisch machen.**
     Beide Fixtures sind am 2026-09-04 durchgerechnet, das Ergebnis steht hier und muss
     nicht erraten werden.
     (a) Test »returns falsy when the corresponding child node is missing« (ab Zeile 349).
     Die Fixture `a = {x:-10, y:-10, w:5, h:5}`, `b = {x:10, y:10, w:5, h:5}` mit
     `subdivide(1)` ergibt **immer** `originX = -5`, `originY = -5`, `northWest = a`,
     `southEast = b`, **`northEast = null`, `southWest = null`**, keine Straddler. Der
     Kommentar »We don't know which two of the four quadrants will be filled« ist damit
     falsch und fällt weg. Statt des Flag-Arrays mit `|| false` (die Coercion ist seit
     `a4bfe10` tot, die Prädikate liefern ausgeschriebenes `boolean`) prüft der Test die
     vier Fälle beim Namen, und zwar so, dass **das fehlende Kind** der Grund für `false`
     ist und nicht die Lage des AABB:
     `expect(n.isNorthEast(new AABB2(0, -10, 1, 1))).toBe(false)` — dieses AABB liegt
     nordöstlich des Ursprungs, der Knoten fehlt;
     `expect(n.isSouthWest(new AABB2(-10, 0, 1, 1))).toBe(false)` — südwestlich, Knoten
     fehlt;
     `expect(n.isNorthWest(new AABB2(-10, -10, 1, 1))).toBe(true)` und
     `expect(n.isSouthEast(new AABB2(0, 0, 1, 1))).toBe(true)` als Gegenprobe, damit die
     beiden `false` oben nicht trivial sind. Der Testname wird entsprechend genau:
     »returns false for a quadrant whose child node is missing«.
     Im zweiten Test des Blocks (»returns true for an AABB clearly inside the quadrant«)
     fallen die vier `!!` weg; `toBe(true)` bleibt.
     (b) Test »descends through a missing-quadrant slot without throwing« (ab Zeile 401).
     Die Fixture `a = {x:-10,y:-10,w:5,h:5}`, `b = {x:-10,y:5,w:5,h:5}`,
     `c = {x:5,y:5,w:5,h:5}` mit `subdivide(1)` ergibt **immer** `originX = -5`,
     `originY = -5`, `northWest = a`, `southWest = b`, `southEast = c`,
     **`northEast = null`**, keine Straddler. Das `find()` über die vier Quadranten und
     das `if (missing != null)` darum entfallen ersatzlos; der Test benennt den fehlenden
     Quadranten und sichert ihn zuerst zu: `expect(n.nodes.northEast).toBeNull()`.
     **Der Punkt, den der Test heute wählt, ist um eins daneben und trifft den leeren
     Schacht gar nicht:** `[5, -5]` läuft in `findChunksAt()` durch
     `y < this.originY` → `-5 < -5` → `false` und landet in `southEast`, also im
     besetzten Kind. Der Test ist grün, ohne je einen `null`-Zweig zu betreten. Richtig
     ist ein Punkt mit `y < -5`, etwa `[5, -6]`; der geht nach `northEast`, findet dort
     `null` und liefert `[]`, weil die Wurzel keine Straddler hält. Also:
     `expect(() => n.findChunksAt(5, -6)).not.toThrow()` und
     `expect(n.findChunksAt(5, -6)).toEqual([])`.
  5. **Der Heap-Smoke-Test.** Neue Datei
     `packages/twopoint5d-testing/test/vertex-objects-heap.test.js`, gebaut wie
     `vertex-objects-dispose.test.js` daneben — dieselben Importe, dasselbe
     `makeContainer()`/`disposeDisplay()`-Muster und eigene Kopien der beiden
     Beschreibungen `quadDescription` und `instancedDescription` (die Nachbardatei
     exportiert nichts). Aufbau:
     - Ein `before(function () { ... })` (kein Arrow, `this.skip()` braucht den Kontext)
       überspringt die ganze Suite, wenn `performance.memory` fehlt **oder**
       `typeof globalThis.gc !== 'function'`. Das ist die Firefox-Schranke und zugleich
       die ehrliche: ohne beide APIs gibt es nichts zu messen. Der `beforeEach`, der das
       `Display` hochfährt, steht **danach** und läuft auf Firefox nie.
     - `this.timeout(30000)` auf dem `describe`, aus demselben Grund wie beim
       Nachbartest: der kalte WebGPU-Start liegt im Hook.
     - Ein Helfer `sampleHeap()`: dreimal
       `globalThis.gc({execution: 'sync', type: 'major'})`, dann 50 ms warten, dann
       `performance.memory.usedJSHeapSize` zurückgeben. Die drei Aufrufe sind gemessen
       nötig — ein einzelner räumt nur die junge Generation.
     - **Ein einziges Material für die ganze Schleife**, im `beforeEach` gebaut und im
       `afterEach` entsorgt: ein `MeshBasicNodeMaterial`, dessen `positionNode` beide
       Attribute liest
       (`attribute('position', 'vec3').add(attribute('instanceOffset', 'vec3'))`). Der
       Shader-Zugriff ist nicht optional — ohne ihn baut three für das Instanz-Attribut
       nie einen GPU-Buffer, und der Test misst eine Strecke, die es gar nicht gibt. Dass
       es nur **eines** gibt, ist die zweite Hälfte derselben Überlegung: ein frisches
       Material je Runde zwingt den `WebGPURenderer` zu einer frischen Pipeline je Runde,
       und der Test misst dann dessen Cache statt der Pool-Strecke, um die es geht.
     - Die Schleife: 20 Aufwärmrunden ohne Probe, danach 100 Runden mit einer Probe vor
       der ersten und je einer nach jeder zwanzigsten — sechs Proben. Je Runde eine
       frische `InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1)`,
       je ein `createVO()` auf `basePool` und `instancedPool`, damit etwas zu übertragen
       ist, dann ein `VertexObjects`-Mesh mit dem gemeinsamen Material, `scene.add()`,
       `display.renderer.render(scene, camera)`, `await display.nextFrame()`,
       `scene.remove(mesh)`, `geometry.dispose()`.
     - Zwei Zusicherungen, und die erste ist die wichtigere:
       (i) `display.renderer.info.memory.geometries` steht am Ende auf demselben Wert wie
       vor der Schleife. Das ist deterministisch, braucht keinen GC und fängt genau die
       Regression, um die es geht — eine Geometrie, die ihren Platz beim Renderer nicht
       zurückgibt.
       (ii) Der Zuwachs von der ersten zur letzten Heap-Probe bleibt unter **4 MiB**. Die
       Schwelle ist bewusst grob: gemessen liegt eine leckfreie Schleife bei 18 KiB
       Zuwachs über 120 Runden, eine leckende bei 75 MiB. Zwischen beidem ist so viel
       Luft, dass die Schwelle nichts über Rauschen aussagt, und genau das soll sie.
     - Ein Kommentar über `sampleHeap()` sagt in zwei Sätzen, warum der erzwungene
       Major-GC dort steht: ohne ihn steigt auch eine leckfreie Schleife monoton, bis der
       GC irgendwann von selbst zuschlägt, und der rohe Verlauf trennt Leck und
       Nicht-Leck nicht.
     - **Wenn die Schwelle beim ersten Lauf reißt, wird sie nicht angehoben, und die
       Schleife wird nicht verkürzt, bis sie grün ist.** Zuerst die beiden Zusicherungen
       gegeneinander lesen: hält (i) und reißt nur (ii), wächst etwas außerhalb der
       Geometrie-Buchführung, und der nächste Schritt ist, die Runde weiter zu entkernen —
       Kamera, Szene und Material stehen ohnehin außerhalb — und erneut zu messen. Hält
       (i) nicht, ist die Sache klar. In beiden Fällen gehen die gemessenen Zahlen in den
       Report, mit Datei und Zeile, und die Schwelle bleibt, wo sie steht. Eine
       Zusicherung, die man an das anpasst, was gerade herauskommt, ist keine.
  6. **Die zwei Startflags** in `packages/twopoint5d-testing/web-test-runner.config.js`,
     ausschließlich am Chromium-Launcher:
     `playwrightLauncher({product: 'chromium', concurrency: 1, launchOptions: {args: ['--enable-precise-memory-info', '--js-flags=--expose-gc']}})`.
     Der Firefox-Launcher bleibt unangetastet. Ein Kommentar daneben sagt, was die Flags
     einbringen: ohne das erste ist `performance.memory.usedJSHeapSize` auf einen festen
     Wert gequantelt und misst nichts, ohne das zweite gibt es keinen erzwungenen GC und
     damit keine vergleichbaren Proben. Kein Rückblick darauf, wie es vorher war.
  7. **Coverage-Schwellen nachziehen**, in `packages/twopoint5d/vite.config.ts`. Der Stand
     vor diesem Paket, am 2026-09-04 gegen `a4bfe10` gemessen: global
     69,10 / 63,22 / 63,40 / 68,96 (statements / branches / functions / lines) gegen
     Schwellen 65 / 58 / 58 / 65; `src/vertex-objects/**` 96,12 / 88,66 / 94,81 / 96,66
     gegen 90 / 82 / 88 / 90; `src/texture/**` 74,21 / 65,65 / 66,99 / 74,44 gegen
     70 / 60 / 60 / 70. Nach dem Einbau der neuen Specs Coverage neu messen
     (`pnpm exec vitest --run --coverage` im Paketverzeichnis) und jede Schwelle auf
     `abgerundeter Messwert − 4` setzen. Zwei Grenzen dazu: **keine Schwelle wird
     gesenkt** — liegt der neue Wert niedriger, bleibt die alte Zahl stehen und der Fall
     geht in den Report. Und **es kommt kein neuer Glob dazu**; `src/map2d/**` steht heute
     bei 48,24 % Funktionen, eine Schwelle dort ist eine eigene Entscheidung und gehört
     nicht in dieses Paket. Der Abstand von vier Punkten ist keine Willkür, sondern die
     Regel, die der Kommentar über dem `thresholds`-Block schon aufstellt: die Schwelle
     meldet eine Regression, sie feuert nicht auf jede Zeile, die sich bewegt. Der
     Kommentar bleibt wörtlich stehen.
  8. **`pnpm format`, dann `pnpm lint`.** Umbrüche und Einrückung nicht von Hand setzen.
- Verify (das Gate, muss `exit=0` liefern):
  `pnpm clean && pnpm lint && pnpm build && NX_TUI=false pnpm nx run-many -t typecheck --skip-nx-cache && pnpm checkPkgTypes && pnpm lintPkg && NX_TUI=false pnpm nx run twopoint5d:test --skip-nx-cache`
  Das `--skip-nx-cache` steht aus demselben Grund wie in den Paketen 7, 8 und 8a: das
  `test`-Target lieferte dort seinen grünen Lauf aus dem Cache. Es zählt hier doppelt —
  die Coverage-Schwellen aus `vite.config.ts` wirken nur, wenn der Lauf wirklich
  stattfindet.
- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm test:browser`. Der Maßstab ist die
  Zeile unter »Vorbestehende Fehler«, und dieses Paket schärft sie: **Chromium 0 Fehler,
  Firefox exakt 24.** Chromium fährt den neuen Heap-Test mit und muss ihn bestehen;
  Firefox überspringt ihn im `before`-Hook und darf deshalb keinen 25. Fehler zeigen. Eine
  25 heißt nicht »Firefox ist kaputt«, sondern »die Schranke im `before` greift nicht« —
  und das ist ein Befund dieses Pakets, kein vorbestehender.
- Commit: `test: add boundary tables for tile and atlas indices and a heap smoke test`
- Ergebnis: 1 Runde · TEST-010, TEST-011 und TEST-013 behoben · neuer Browsertest
  `packages/twopoint5d-testing/test/vertex-objects-heap.test.js` (Chromium grün, Firefox
  überspringt sich im `before`-Hook) · 788 statt 703 Vitest-Tests · Coverage global
  69,13 / 63,33 / 63,40 / 68,98, Schwellen auf 65 / 59 / 59 / 65 gehoben
  (`src/texture/**` 70 / 61 / 62 / 70, `src/vertex-objects/**` 92 / 84 / 90 / 92; global
  `lines` bleibt bei 65 statt 64, weil keine Schwelle gesenkt wird) · Browsersuite
  unverändert am Maßstab: Chromium 0 Fehler, Firefox 24, `getSupportedExtensions` 92-mal ·
  klein, im Commit belassen: der Kommentar zum entarteten Fall `width === 0` steht in
  `Map2DTileCoordsUtil.spec.ts:92-95` über der Offset-Tabelle statt über der Basistabelle,
  auf die er sich bezieht · das gemeinsame Material in `vertex-objects-heap.test.js:95`
  wird im `afterEach` nur genullt statt `dispose()`t · Zusicherung (ii) desselben Tests
  (`:129-133`) kann »kein Leck« nicht von »keine Messung« unterscheiden, fiele
  `--enable-precise-memory-info` weg, bliebe sie stumm grün · `:59` trägt einen Rückblick
  auf den Vorzustand im Kommentar, den die Konventionen ausschließen ·
  `TileSet.spec.ts:75` verweist mit »the "darunter" rows« auf die Zeilenbeschriftung
  dieses Plans statt auf die Kommentare der Tabelle selbst · `TextureAtlas.spec.ts:240-241`
  prüft `get(0)` und `get(lastFrameId)` nur auf `instanceof TextureCoords`, die beiden
  Frames sind ununterscheidbar und ein vertauschter Index bliebe unbemerkt
- Nebenbefunde: keine neuen — der Implementierer hat die vier vollständig geöffneten
  Spec-Dateien gelesen und nichts über den Detailplan hinaus gefunden
- Folgen: keine · der Diff bleibt auf Specs, den neuen Browsertest,
  `web-test-runner.config.js` und `vite.config.ts`; kein Produktivcode, keine
  `public-api.ts`
- Schnittstellen: die Coverage-Schwellen in `packages/twopoint5d/vite.config.ts` lauten ab
  hier global 65 / 59 / 59 / 65, `src/vertex-objects/**` 92 / 84 / 90 / 92 und
  `src/texture/**` 70 / 61 / 62 / 70 (statements / branches / functions / lines) — wer Code
  entfernt oder Specs streicht, sieht es hier zuerst · der Chromium-Launcher in
  `packages/twopoint5d-testing/web-test-runner.config.js` startet mit
  `--enable-precise-memory-info` und `--js-flags=--expose-gc`; ein Browsertest darf
  `performance.memory` und `globalThis.gc` unter Chromium voraussetzen, unter Firefox
  nicht · die Browsersuite umfasst acht `.test.js` statt sieben

**TEST-010 · info · packages/twopoint5d-testing/** — Kein Memory-Smoke-Test über mehrere
Frames

Die Pool- und Cache-Arbeit dieses Backlogs — TileBox-Pool, VOBufferPool-Dispose,
clearUnused — hat kein Netz, das eine Regression auffangen würde.

Empfehlung: Hundert Frames rendern und prüfen, dass `performance.memory.usedJSHeapSize`
nicht monoton wächst. Grob, aber besser als nichts.

**TEST-011 · info · packages/twopoint5d/src/** — Keine tabellengetriebenen Tests für
Grenzfälle

Tile-Offsets und Atlas-Indizes sind klassische Off-by-one-Kandidaten und werden derzeit
einzeln und unvollständig geprüft.

Empfehlung: `test.each()` für die Grenzfall-Matrizen. Wenig Aufwand, deckt den Rand
systematisch ab.

**TEST-013 · info · packages/twopoint5d/src/texture/TextureStore.spec.ts:281,316** — Zwei
describe-Namen tragen Laufnummern eines Audits, das es nicht mehr gibt

Die beiden `describe`-Blöcke führen `(BUG-11)` und `(BUG-10)` im Namen. Solche Nummern
gehören einem einzelnen Audit-Lauf und sind nach ihm nicht mehr auflösbar; im Testnamen
überdauern sie ihn und verweisen ins Leere.

Empfehlung: Die Nummern durch das ersetzen, was der Test tatsächlich zusichert. Ein
Testname, der ohne seine Nummer unverständlich wird, hat sein Argument nie ausgeschrieben.

### [x] 10. Doku und Lint-Konfiguration in Übereinstimmung bringen

- Findings: CFG-003 (low), CFG-013 (info), CONS-001 (info)
- Ziel: Eine einzige Node-Version-Aussage über README, `engines`, `AGENTS.md` und eine
  neue `.nvmrc`; keine ESLint-Regel mehr, die es nicht gibt; kein VitePress mehr im
  Tech-Stack einer Datei, die Agenten als Wahrheit lesen.
- Bereich: `README.md`, `.nvmrc`, `AGENTS.md`, `CLAUDE.md`, `eslint.config.mjs`
- Hängt ab von: Paket 3
- Hinweis: Nimmt den offenen Befund zu `engines.node` mit auf — drei verschiedene
  Node-Versionen für dieselbe Anforderung sind genau dasselbe Problem wie das Finding.
- Hinweis (Zug 0 von Paket 4): An `README.md` und `CLAUDE.md` sind vier Stellen schon
  bewegt, und zwar nicht als Vorgriff auf dieses Paket, sondern weil Paket 4 sie selbst
  unwahr gemacht hätte: die beiden Testzeilen und die Gate-Zeile in `CLAUDE.md` samt
  einem neuen Absatz über das Tag-Vokabular unter »Repo layout«, und der Kommentar hinter
  `pnpm cbt` in `README.md`. Die Node-Version in `README.md:75` ist dabei ausdrücklich
  **nicht** angefasst worden — sie gehört hierher. `AGENTS.md` hat Paket 4 gar nicht
  berührt; die Datei nennt keinen Tag und kein Script, das sich geändert hat.
- Hinweis (Zug 0 von Paket 5): Paket 5 bewegt `CLAUDE.md` ein zweites Mal, aus demselben
  Grund wie Paket 4 — es macht die Gate-Zeile 23 selbst unvollständig und trägt dort
  `lintPkg` nach, dazu eine neue Zeile für `pnpm lintPkg`. `README.md:75` und `AGENTS.md`
  bleiben auch dort unangetastet. Für dieses Paket heißt das: die Node-Version ist
  weiterhin die offene Stelle, die Kommandoliste in `CLAUDE.md` ist es nicht mehr.
- Hinweis (Zug 0 von Paket 8): Paket 8a bewegt `CLAUDE.md` ein drittes Mal und `README.md`
  ein zweites, aus demselben Grund wie die Pakete 4 und 5 — es hängt `pnpm typecheck` ins
  Gate und macht damit die Gate-Zeile in `CLAUDE.md` und den Kommentar hinter `pnpm cbt` in
  `README.md:85` selbst unvollständig. `README.md:75` (Node-Version) und `AGENTS.md` fasst
  es nicht an. Für dieses Paket ändert sich dadurch nichts: die Node-Version über README,
  `engines`, `AGENTS.md` und `.nvmrc` bleibt die offene Stelle, die Kommandolisten sind es
  weiterhin nicht.
- Hinweis (Zug 0 von Paket 8a): unverändert gültig, mit einem Zusatz. Der Kommentar hinter
  `pnpm cbt` in `README.md:85` zählt die Gate-Kette in Prosa auf und ließ schon vor Paket
  8a den Schritt `lintPkg` aus. Paket 8a schreibt die Zeile ohnehin um und nennt die Kette
  dabei vollständig. Für dieses Paket heißt das: an `README.md` bleibt genau eine Stelle
  offen, die Node-Version in Zeile 75.
- Hash: 88f994d
- Modell: mittlere Stufe
- Effort: low
- Abgleich (Zug 0, 2026-09-04, gegen `bf868e4`; Basis für »vorbestehend« ist `ba44e8e`):

  **CFG-003 — existiert, aber sein Gegenüber ist gewandert.** `README.md:75` steht
  unverändert auf »a current node v18+«. `engines.node` steht nicht mehr auf `>=22.13`,
  sondern seit Paket 2 (`5da6fa6`) auf `>=24`; die Zielzahl dieses Pakets ist damit **24**
  und nicht die `22` aus der Empfehlung. Die dritte Behauptung des Findings — »`AGENTS.md`
  ebenfalls 22.13« — trägt nicht: `git log -S "22.13" -- AGENTS.md` findet nichts, und die
  Datei nennt weder heute noch bei `ba44e8e` irgendeine Node-Version. Gezählt wurde heute
  im Baum: die Zahl steht in `package.json:9` (`>=24`), `mise.toml:2` (`24`),
  `.github/workflows/ci.yml:21` (`24`), `.github/workflows/deploy.yml:27` (`24`) und
  `CLAUDE.md:9` (`≥24`) — fünf Stellen, alle einig. `README.md:75` ist die einzige
  abweichende, und `.nvmrc` wie `.node-version` fehlen weiterhin; `mise.toml` bedient nur
  mise. Das Paket schrumpft damit auf eine geänderte Zeile plus eine neue Datei, und
  `package.json` wird **nicht** angefasst — es steht bereits richtig. Deshalb fällt es aus
  dem `Bereich` heraus, `CLAUDE.md` kommt hinein.

  **CFG-013 — existiert, ist aber größer als eine Zeile und kleiner als vermutet.** Gegen
  das installierte `typescript-eslint@8.69.0` nachgesehen (Regeldateien im Plugin):
  `ban-ts-ignore` und `ban-types` haben dort keine Regel mehr, `no-empty-interface` hat
  eine (als deprecated markiert, aber vorhanden). Der Satz aus Zug 0 von Paket 3, es seien
  »drei Regeln, die es längst nicht mehr gibt«, ist damit um eine zu hoch; es sind zwei.
  Beide Zeilen fallen unter dieselbe Ursache und gehen zusammen.

  **CONS-001 — unverändert**, `AGENTS.md:69` führt VitePress weiter. Der zweite Halbsatz
  der Empfehlung — »Zusammen mit ARCH-002 erledigen« — läuft ins Leere: `ARCH-002` gibt es
  in der `audit.html` dieses Laufs nicht, das Finding trägt `status: carried-over` und
  schleppt den Verweis aus einem älteren Report mit. Er wird nicht befolgt.

- Triage (Zug 0): vier Stellen kommen aus »Offene Befunde« oder aus dem Abgleich hinzu,
  eine geht hinaus. Jede mit ihrem Grund:

  1. `package.json:9` (Queue, dort bereits »gehört in Paket 10«) — der Node-Zahlenstreit
     selbst. Deckungsgleich mit CFG-003, wird mit ihm erledigt. Die Zeile in der Queue
     nennt drei Zahlen und stützt sich dabei auf dieselbe Falschannahme über `AGENTS.md`
     wie das Finding; sie ist entsprechend korrigiert.
  2. `AGENTS.md:29` (Queue, dort bereits »gehört in Paket 10«) — die `pnpm run ci`-Zeile
     zählt eine Kette auf und lässt vier Glieder aus.
  3. `AGENTS.md:56` und `CLAUDE.md:52` (aus dem Abgleich) — beide nennen ein Modul
     `tiled-maps/` beziehungsweise eine Klasse `Map2DLayer`. Das Verzeichnis heißt `map2d/`,
     und `Map2DLayer` kommt im ganzen Repo nur in diesen beiden Zeilen vor: kein Quelltext,
     keine `public-api.ts`, keine Spec, kein Demo. Bei `ba44e8e` stand es genauso, also
     vorbestehend. Aufgenommen, weil es dieselbe Ursache ist wie CONS-001 — der Umbau kam
     in den Agenten-Kontextdateien nie an —, und weil es dieselben zwei Dateien sind. Eine
     der beiden zu korrigieren und die andere stehen zu lassen, hieße genau die halb
     behobene Ursache zu erzeugen, gegen die dieser Lauf an mehreren Stellen anschreibt.
  4. `eslint.config.mjs:12` und `:17` (aus dem Abgleich) — `'docs/*'` und `'**/.vitepress'`
     ignorieren Pfade, die es nicht gibt: `docs/` fiel mit `37887ba`, `.vitepress` mit
     `bc361c9`, und `find` findet heute keinen von beiden. Aufgenommen, weil die Ursache
     von CFG-013 nicht »eine entfernte Regel« ist, sondern das, was seine Beschreibung
     sagt: die Datei trägt Anweisungen, die niemand mehr ausführt. Ein Ignore-Muster auf
     ein verschwundenes Verzeichnis ist genau das, eine Zeile über den entfernten Regeln,
     im selben Array. `'**/lookbook/public'` bleibt — das Verzeichnis existiert.
  5. **Hinaus geht** `packages/twopoint5d/README.md`. Die Datei verweist an sieben Stellen
     ins Leere; sie teilt mit Punkt 4 den Auslöser `docs/`, aber nicht die Ursache — dort
     ist es eine Konfigurationszeile, hier die Startseite des npm-Pakets, und der Umfang
     ist ein anderer. Sie steht als neuer Eintrag in »Offene Befunde«, wo der Abschluss sie
     mit allen übrigen Befunden nebeneinander sieht.

- Dateien:
  - `README.md` (Zeile 75)
  - `.nvmrc` (neu)
  - `AGENTS.md` (Zeilen 21/22, 29, 56, 69)
  - `CLAUDE.md` (Zeilen 36, 52)
  - `eslint.config.mjs` (vier Zeilen entfallen)
- Vorgehen: Der Auftrag ist wörtlich. Alle Zeilennummern gelten für den Stand `bf868e4`;
  wo mehrere Zeilen derselben Datei entfallen, wird über den Inhalt gesucht und nicht über
  die Nummer, weil sie sich beim Löschen verschiebt.

  1. **`.nvmrc` anlegen.** Genau ein Inhalt, eine Zeile, abschließender Zeilenumbruch:

     ```
     24
     ```

     Kein Kommentar, kein `v`-Präfix, kein Patchlevel — nvm, fnm und asdf lesen die Datei
     roh, und ein Kommentar darin ist bei fnm ein Fehler. Am 2026-09-04 gemessen:
     `prettier --check .` überspringt die Datei (kein Parser ableitbar) und liefert
     weiterhin `exit 0`; ein Eintrag in `.prettierignore` ist also nicht nötig und wird
     nicht gemacht.

  2. **`README.md:75` ersetzen.** Die Zeile lautet danach:

     ```markdown
     First, you need [node](https://nodejs.org/) v24 or newer and [pnpm](https://pnpm.io/) v10.22 or newer. An `.nvmrc` and a `mise.toml` are checked in, so `nvm use`, `fnm use` or `mise install` picks the right node for you.
     ```

     Die Prosa nennt die Zahl, weil dieser Abschnitt ein Mensch beim Aufsetzen liest; die
     Verweise auf `.nvmrc` und `mise.toml` sagen, wo sie automatisch herkommt. Sonst nichts
     an dieser Datei — Zeile 85 ist mit Paket 8a auf dem Stand.

  3. **`AGENTS.md`: eine Zeile über die Toolchain, ohne eine sechste Zahl.** Unter §2
     direkt nach »Run all commands from the project root.« ein Absatz einfügen:

     ```markdown
     Node and pnpm versions come from `engines` in `package.json`; `.nvmrc` and `mise.toml` carry the same numbers for version managers.
     ```

     Kein Zahlwert an dieser Stelle. Eine Datei, die für ein Publikum ohne Gedächtnis
     geschrieben ist, braucht die Adresse der Zahl und nicht ihre Kopie — die Kopie ist
     genau das, was diesen Befund erzeugt hat.

  4. **`AGENTS.md:29` vervollständigen.** Die Kette in `package.json:30` lautet
     `clean → lint → build → typecheck → checkPkgTypes → lintPkg → test:ci → test:browser`.
     Die Zeile lautet danach:

     ```markdown
     -   **CI Check:** `pnpm run ci` (clean, lint, build, typecheck, checkPkgTypes, lintPkg, then the vitest and browser suites). **Run before committing.**
     ```

     »Clean install« fällt dabei weg und ist kein Kürzungsopfer: `pnpm clean` räumt
     Build-Ausgaben ab und installiert nichts.

  5. **`AGENTS.md:56` auf das Modul umschreiben, das es gibt.** Die Zeile lautet danach:

     ```markdown
     -   `map2d/`: **Tiled Integration.** `Map2D` (holds streamer and renderers), `Map2DTileStreamer`, `Map2DTileRenderer`, `CameraBasedVisibility` (culling).
     ```

     Belegt an `packages/twopoint5d/src/map2d/public-api.ts`: die vier Namen werden dort
     exportiert, `Map2DLayer` nicht.

  6. **`AGENTS.md:69` auf die eine App kürzen.** Die Zeile lautet danach:

     ```markdown
     -   **Apps:** Astro (Lookbook)
     ```

  7. **`CLAUDE.md:36` und `:52` nachziehen.** Zeile 36 verweist auf die AGENTS.md-Stelle
     aus Schritt 6 und wird durch sie gegenstandslos; sie nennt außerdem unter
     `apps/handbook/` »leftover image assets«, wo `git ls-files apps/handbook` heute nichts
     mehr auflistet. Beide Halbsätze fallen, der Rest der Zeile bleibt:

     ```markdown
     - `apps/lookbook` — Astro app, the de-facto live documentation/showcase.
     ```

     Zeile 52 verliert `Map2DLayer` aus demselben Grund wie `AGENTS.md:56`:

     ```markdown
     - `map2d/` — Tiled-map integration: `Map2D` holds the tile streamer and its renderers, `CameraBasedVisibility` culls tiles against the camera frustum.
     ```

  8. **Vier Zeilen aus `eslint.config.mjs` entfernen**, sonst nichts an der Datei:

     ```
     'docs/*',
     '**/.vitepress',
     '@typescript-eslint/ban-ts-ignore': 0,
     '@typescript-eslint/ban-types': 0,
     ```

     Die drei übrigen `0`-Zeilen bleiben stehen, und das ist eine Entscheidung und kein
     Übersehen. Am 2026-09-04 gegen `tseslint.configs.recommended` und
     `pluginJs.configs.recommended` durchgerechnet: `no-empty-function`,
     `no-empty-interface` und `no-non-null-assertion` schalten heute nichts ab, was diese
     Presets einschalten, `no-explicit-any`, `no-unsafe-declaration-merging` und
     `no-this-alias` schon. Die drei wirkungslosen unterscheiden sich von den zwei
     gelöschten in genau dem Punkt, auf den es ankommt: ihre Regeln existieren. Wechselt
     das Projekt je auf `strict` oder `stylistic`, tragen sie sofort wieder — eine Regel,
     die es nicht gibt, kann das nie.

  9. **`pnpm format`, dann `pnpm lint`.** Erwartet ist beides ohne Ausgabe. Am 2026-09-04
     vorab gemessen, mit einer Kopie der Konfiguration ohne die vier Zeilen gegen den
     echten Baum gefahren: `eslint .` liefert `exit 0` und eine byteweise identische
     (leere) Ausgabe wie mit ihnen. Weicht der Lauf davon ab, ist das ein Befund dieses
     Pakets und keine Vorbedingung.

- Verify (das Gate, muss `exit=0` liefern):
  `pnpm clean && pnpm lint && pnpm build && NX_TUI=false pnpm nx run-many -t typecheck --skip-nx-cache && pnpm checkPkgTypes && pnpm lintPkg && NX_TUI=false pnpm nx run twopoint5d:test --skip-nx-cache`
  Der Diff berührt keine Zeile Quelltext, und trotzdem fährt die volle Kette: dies ist das
  letzte Paket, und der Abschluss braucht eine frische Messung gegen dieselbe Baseline, die
  im Kopf dieses Plans steht. `--skip-nx-cache` aus demselben Grund wie in den Paketen 7
  bis 9 — Markdown-Änderungen invalidieren keinen Nx-Cache, ein Cache-Treffer wäre hier
  also sachlich richtig und als Messung trotzdem wertlos.
- Verify (zusätzlich, nicht gatend, eigenes Log): `pnpm test:browser`. Maßstab ist die
  Zeile unter »Vorbestehende Fehler« in der von Paket 9 geschärften Fassung: **Chromium 0
  Fehler, Firefox exakt 24**, `getSupportedExtensions` 92-mal im Log. Eine Abweichung nach
  oben wäre bei einem Diff aus Markdown, einer Punktdatei und vier gelöschten
  Konfigurationszeilen kein Befund dieses Pakets, sondern eine Umgebungsänderung — dann
  gehört die neue Zahl unter »Vorbestehende Fehler«, bevor der Abschluss sie erbt.
- Commit: `chore: settle on one node version and drop references to what no longer exists`
- Ergebnis: 1 Runde · CFG-003, CFG-013 und CONS-001 behoben · Regressionstest entfällt
  (kein Korrektheitsfehler, der Diff berührt keine Zeile Quelltext) · Reviewer ohne Befund,
  weder kritisch noch wichtig noch klein · Gate `exit=0`
  (`paket-10.verify.log`) · Browsersuite separat und nicht gatend: Chromium 0 Fehler,
  Firefox 24, `getSupportedExtensions` 92-mal — exakt die Zahlen unter »Vorbestehende
  Fehler«, also keine Umgebungsänderung (`paket-10.verify-browser.log`)
- Nebenbefunde: keine — Implementierer und Reviewer haben in den fünf berührten Dateien
  keinen gefunden, der nicht schon in »Offene Befunde« steht
- Folgen: keine
- Schnittstellen: — (Doku und Lint-Konfiguration, keine Zeile Quelltext)
- Geschlossen aus »Offene Befunde«: `package.json:9` (Node-Zahlenstreit) und `AGENTS.md:29`
  (unvollständige `pnpm run ci`-Kette)

**CFG-003 · low · README.md:75, package.json:9** — README-Node-Version widerspricht engines

Das README sagt *a current node v18+*, `engines.node` verlangt `>=22.13`, `AGENTS.md`
ebenfalls 22.13. Je nachdem, was man zuerst liest, landet man in einer anderen Realität.
Weder `.nvmrc` noch `.node-version` existieren.

Empfehlung: README an den `engines`-Wert angleichen und ein `.nvmrc` mit `22` anlegen — für
alle mit fnm, nvm oder volta sinkt der Aufwand damit auf null.

**CFG-013 · info · eslint.config.mjs:41** — eslint.config.mjs konfiguriert eine Regel, die
es seit typescript-eslint v6 nicht mehr gibt

`'@typescript-eslint/ban-ts-ignore': 0` benennt eine Regel, die typescript-eslint mit v6
entfernt hat; installiert ist 8.56.1. Die Zeile fällt nicht auf, weil ESLint eine auf `0`
gesetzte Regel nie auflöst — sie steht damit als Anweisung da, die niemand mehr ausführt.

Empfehlung: Die Zeile streichen. Ihre Aufgabe erfüllt die Nachbarzeile `ban-ts-comment`,
die inzwischen auf `error` steht.

**CONS-001 · info · AGENTS.md §5** — AGENTS.md führt das entfernte VitePress weiter im
Tech-Stack

Die Handbook-App ist seit `bc361c9` weg. `CLAUDE.md` stellt das ausdrücklich klar,
`AGENTS.md` ist nicht nachgezogen. Zwei Agenten-Kontextdateien, die sich widersprechen —
genau die Sorte Detail, die eine Maschine zuverlässig falsch aufgreift.

Empfehlung: §5 anpassen: Astro-Lookbook bleibt, VitePress streichen. Zusammen mit ARCH-002
erledigen.

### [x] 11. Dependencies nachziehen und React aus der Lookbook nehmen

- Nebenbefund: `package.json:41` (info) · `pnpm-workspace.yaml:10,11` ·
  `apps/lookbook/astro.config.mjs:1,14` und `apps/lookbook/package.json:18,24,25,29,30,32` (low) ·
  `tsconfig.json:19` (info)
- Ziel: Jede Abhängigkeit im Workspace hat einen Abnehmer, die Catalog-Ranges nennen die
  three.js-Version, gegen die dieser Lauf gemessen hat, und der Compiler ist nirgends mehr
  auf eine Sprache eingestellt, die das Repo nicht schreibt.
- Bereich: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`,
  `apps/lookbook/package.json`, `apps/lookbook/astro.config.mjs`,
  `apps/lookbook/src/demos/instanced-quads/createTexturedQuads.ts`,
  `apps/lookbook/src/pages/demos/instanced-quads.astro`,
  `apps/lookbook/src/pages/demos/textured-quads.astro`, `pnpm-lock.yaml`
- Hängt ab von: —
- Geteilt aus: dem ursprünglichen Paket 11 der Drain-Runde. Dessen zweite Hälfte — das
  Typ-Gate über die `.astro`-Seite — ist beim Ausmessen von einer Manifestzeile auf 96
  Fehler in 22 Dateien angewachsen und steht jetzt als **Paket 11a** dahinter. Keine
  `Folge von:`-Zeile, aus demselben Grund wie bei Paket 8a: das ist ein Schnitt und kein
  Schaden, den ein Vorgänger angerichtet hat.
- Hash: ff29f29
- Modell: mittlere Stufe
- Dateien: `pnpm-workspace.yaml`, `package.json`, `apps/lookbook/package.json`,
  `apps/lookbook/astro.config.mjs`, `tsconfig.json`,
  `apps/lookbook/src/demos/instanced-quads/createTexturedQuads.ts`,
  `apps/lookbook/src/pages/demos/instanced-quads.astro`,
  `apps/lookbook/src/pages/demos/textured-quads.astro`, `pnpm-lock.yaml` (generiert)
- Vorgehen:
  1. `pnpm-workspace.yaml:10,11` — den Catalog auf die heute aktuellen Stände heben:
     `'@types/three': ~0.185.4` und `three: ~0.185.1`. Die Tilde-Ranges bleiben Tilde-Ranges.
  2. `package.json:41` — `"esbuild": "^0.27.3"` auf `"^0.28.2"`.
  3. `apps/lookbook/package.json` — aus `dependencies` diese sechs Einträge streichen:
     `@astrojs/react` (18), `@types/react` (24), `@types/react-dom` (25), `react` (29),
     `react-dom` (30), `styled-components` (32). Nichts sonst in dieser Datei anfassen;
     `@astrojs/check` gehört zu Paket 11a und kommt dort hinein.
  4. `apps/lookbook/astro.config.mjs` — Zeile 1 `import react from '@astrojs/react';` und
     Zeile 14 `integrations: [react()],` ersatzlos streichen. Die Datei behält ihre übrigen
     Felder unverändert; `defineConfig` verlangt kein `integrations`.
  5. `tsconfig.json:19` (Root) — `"jsx": "react-jsx",` streichen. Mit Schritt 3 und 4
     verlässt React den Workspace, und dies ist seine letzte Zeile. Der Compiler bekommt
     damit keine JSX-Einstellung mehr, was richtig ist: es gibt im Repo keine `.tsx`- und
     keine `.jsx`-Datei. Kein Ersatz durch `"jsx": "preserve"` — die `.astro`-Dateien
     übersetzt der Astro-Compiler, nicht `tsc`.
  6. Drei Fundstellen tragen wortgleich `vec3(attribute('quadSize'), 1.0)` und werden zu
     `vec3(attribute<'vec2'>('quadSize'), 1.0)`:
     `apps/lookbook/src/demos/instanced-quads/createTexturedQuads.ts:8`,
     `apps/lookbook/src/pages/demos/instanced-quads.astro:157`,
     `apps/lookbook/src/pages/demos/textured-quads.astro:112`.
     Das ist der Preis von Schritt 1 und gehört deshalb hierher: `vec3()` nimmt unter
     `@types/three@0.185.4` den `AttributeNode<unknown>` in keiner seiner sieben
     Überladungen mehr an, und ohne das Typargument geht `pnpm typecheck` an der ersten
     der drei Stellen rot (TS2769). Die Bibliothek schreibt es in
     `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:44` seit
     jeher genau so; `quadSize` ist ein `vec2` aus `width` und `height`
     (`InstancedQuadsGeometry.ts:80`). Die beiden `.astro`-Stellen sieht heute kein
     Compiler — sie werden trotzdem mitgezogen, weil es dieselbe Zeile und dieselbe
     Ursache ist.
  7. `pnpm install` — das Lockfile neu auflösen und mitcommitten.
- Verify: `pnpm lint && pnpm build && pnpm typecheck && pnpm checkPkgTypes && pnpm lintPkg && pnpm test:ci && pnpm test:browser`
- Commit: `chore(deps): pull three and esbuild forward and drop the unused react chain`
- Ergebnis: 1 Runde · alle sieben Schritte umgesetzt, Review ohne Befund · Catalog auf
  `three ~0.185.1` / `@types/three ~0.185.4`, `esbuild ^0.28.2`, React-Kette und
  `"jsx": "react-jsx"` raus, drei `attribute<'vec2'>('quadSize')` nachgezogen ·
  Gate `clean → lint → build → typecheck → checkPkgTypes → lintPkg → test:ci` exit=0
  (`paket-11.verify.log`), Browsersuite auf der bekannten Baseline: Chromium 0 Fehler,
  Firefox 24, `getSupportedExtensions` 92-mal (`paket-11.verify-browser.log`)
- Nebenbefunde: keine neuen · der Implementierer meldet drei ungeprüfte
  `document.getElementById(…)` (`apps/lookbook/src/pages/demos/instanced-quads.astro:35`,
  `textured-quads.astro:125,134`); sie gehören zu den 96 `astro check`-Fehlern, die
  Paket 11a als Ganzes abarbeitet, und bekommen deshalb keinen eigenen Queue-Eintrag
- Folgen: —
- Schnittstellen: Die veröffentlichte Peer-Range der Bibliothek lautet ab hier
  `three ~0.185.1` und `@types/three ~0.185.4` (Catalog in `pnpm-workspace.yaml`) — das
  ist eine Kompatibilitätsaussage nach außen und gehört in die Semver-Bewertung des
  Abschlusses · unter `@types/three@0.185.4` nimmt `vec3()` einen
  `AttributeNode<unknown>` in keiner Überladung mehr an: wer `attribute('name')` in einen
  TSL-Konstruktor reicht, schreibt das Typargument dazu (`attribute<'vec2'>('quadSize')`) ·
  React ist aus dem Workspace verschwunden — `@astrojs/react`, `react`, `react-dom`,
  `@types/react`, `@types/react-dom` und `styled-components` stehen in keinem Manifest
  mehr, `apps/lookbook/astro.config.mjs` führt kein `integrations`, und die
  Root-`tsconfig.json` hat keine `jsx`-Einstellung: eine `.tsx`- oder `.jsx`-Datei
  bräuchte beides neu · `esbuild` steht workspace-weit auf `^0.28.2` und löst im Lockfile
  als ein einziger Eintrag auf

**Nebenbefund · info · `package.json:41`** — `esbuild` steht auf `^0.27.3`, aktuell ist
0.28.2; eine Caret-Range erreicht den Sprung bei einer 0.x-Version nie von selbst.
Empfehlung: auf `^0.28.2`. Der Peer von `vite@8.2.2` lautet `^0.27.0 || ^0.28.0`,
`@web/dev-server-esbuild@2.0.0` bringt `esbuild@^0.28.1` mit — das Lockfile führt danach
einen esbuild-Eintrag statt zweier.

**Nebenbefund · low · `pnpm-workspace.yaml:10,11`** — die Catalog-Einträge `@types/three`
und `three` stehen auf `~0.183.1`, aktuell sind 0.185.4 und 0.185.1. Beide sind
`peerDependencies` der veröffentlichten Bibliothek; die Range-Änderung ist eine
Kompatibilitätsaussage nach außen und gehört in die Semver-Bewertung des Abschlusses.
Unter »Entscheidungen« vom 2026-09-04 freigegeben.
Empfehlung: auf `~0.185.4` und `~0.185.1`, mit dem Typargument aus Schritt 6.

**Nebenbefund · low · `apps/lookbook/astro.config.mjs:1,14` und
`apps/lookbook/package.json:18,24,25,29,30,32`** — die App lädt die Astro-React-Integration
und hält `@astrojs/react`, `react`, `react-dom`, `@types/react`, `@types/react-dom` und
`styled-components`, rendert damit aber nichts: 36 `.astro`- und 22 `.ts`-Dateien, kein
`.tsx`, kein `.jsx`, keine einzige `client:`-Direktive, und außerhalb der Astro-Config
nennt keine Zeile in `src/` eines dieser Pakete.
Empfehlung: die sechs Einträge und die Integration streichen.

**Nebenbefund · info · `tsconfig.json:19`** — `"jsx": "react-jsx"` richtet den Compiler auf
eine Sprache aus, die im Repo nicht vorkommt, und ist nach Schritt 3 und 4 die letzte Spur
von React im Workspace.
Empfehlung: streichen.

**Am 2026-09-04 im Probe-Workspace gemessen.** Ein `git archive HEAD` außerhalb des
Projekts, alle sieben Schritte angewandt, frisch installiert. Das volle Gate ist grün:
`pnpm lint`, `pnpm build`, `pnpm typecheck`, `pnpm checkPkgTypes`, `pnpm lintPkg` und
`pnpm test:ci` je `exit=0`. Die Browsersuite liefert exakt die Zahlen unter »Vorbestehende
Fehler« — Chromium 0 Fehler, Firefox 24, `getSupportedExtensions` 92-mal —, der
esbuild-Sprung ändert an der Umgebung also nichts. Ohne Schritt 6 geht `pnpm typecheck`
rot, mit ihm grün. Gegenprobe mit zurückgedrehtem Catalog im selben Workspace: `0.183.1`
ist grün ohne Schritt 6, die eine Fehlerstelle hängt also am Sprung und an nichts sonst.

**Was dieses Paket ausdrücklich nicht tut.** `@astrojs/check` installieren, ein Nx-Target
für `astro:check` anlegen oder es ins Gate hängen — das ist Paket 11a, und es ist dort,
weil 96 `.astro`-Fehler dazwischenstehen. Vor und nach diesem Paket sind es je 96 —
zwischendurch 99: Schritt 1 legt die drei Stellen aus Schritt 6 obendrauf, Schritt 6 nimmt
sie in derselben Runde wieder weg.

### [x] 11a. Das Typ-Gate der Lookbook auf die `.astro`-Seite ausdehnen

- Nebenbefund: `apps/lookbook/package.json:14` (low) ·
  `packages/twopoint5d/src/display/types.ts:17` (medium) ·
  `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro:56` (low)
- Ziel: Die 36 `.astro`-Dateien der Lookbook laufen nicht länger ungeprüft durch den
  Build — ein Gate in `pnpm run ci` sieht sie, und es ist grün.
- Bereich: `apps/lookbook/package.json`, `apps/lookbook/project.json`,
  `apps/lookbook/src/` (22 `.astro`-Dateien), `packages/twopoint5d/src/display/types.ts`,
  `pnpm-lock.yaml`
- Hängt ab von: Paket 11
- Geteilt aus: Paket 11 — **keine** `Folge von:`-Zeile, wörtlich gemeint wie bei Paket 8a:
  dieses Paket entsteht aus einem Schnitt, nicht aus Schaden eines Vorgängers. Die
  Drain-Runde hatte diese Arbeit bereits eingeplant; gewachsen ist nur ihre gemessene
  Größe, nicht ihr Auftrag.
- Hash: c3c8edb
- Modell: stärkste Stufe
- Effort: high
- Hinweis (die Zahlen, am 2026-09-04 gegen `ff29f29` im echten Baum nachgemessen):
  `@astrojs/check@0.9.10` ist aktuell (veröffentlicht 2026-07-27) und verlangt als Peer
  `typescript: ^5.0.0 || ^6.0.0`; das Repo steht auf 5.9.3. `astro check` sieht 58 Dateien
  und meldet **96 Fehler in 22 der 36 `.astro`-Dateien**, dazu einen Hinweis. Verteilung:
  `TagCloudFilter.astro` 14, `textured-quads.astro` 9,
  `textured-quads-from-texture-atlas.astro` 8, je 7 in `textured-quads-po2image-loader`,
  `textured-quads-from-tileset`, `stage-nested-pipelines` und `instanced-quads`, je 6 in
  `textured-sprites` und `stage-postprocessing`, `crosses` 5, je 4 in `animated-sprites`
  und `RadioButtons`, `Card` 3, dazu neun Dateien mit je einem. Nach Fehlercode: 35×
  TS18048, 32× TS2345, 10× TS2531, 9× TS2532, 4× TS2339, 3× TS18047, 2× TS2322, 1×
  TS2353. Der Lauf dauert drei Sekunden und kommt ohne das generierte
  `apps/lookbook/.astro/` aus (nachgemessen, indem es beiseitegeschoben wurde: dieselben
  96 Fehler, Zeile für Zeile).
- Hinweis (woher die Fehler kommen): 91 der 96 sind Nullability — das, was Paket 8a in der
  `.ts`-Hälfte der App abgearbeitet hat und in der `.astro`-Hälfte nicht erreichen konnte:
  vor `a4bfe10` stand `"strictNullChecks": false` im Root, danach nicht mehr. Die übrigen
  fünf sind älter als der Schalter: `crosses.astro:56` und `instanced-quads.astro:159`
  (fehlendes Typargument am `attribute()`), `stage-nested-pipelines.astro:54` und
  `stage-postprocessing.astro:37` (je `.add` auf `Node`) sowie `display-multi.astro:99`
  (der leere `DisplayRendererParameters`).
- Hinweis (was dieses Paket ausdrücklich nicht tut): Die fünf DOM-Casts und das
  `event: any` in `TagCloudFilter.astro:179` fasst es **nicht** an — sie erzeugen keinen
  der 96 Fehler, weil sie ihn gerade verhindern, und sie stehen als eigener Eintrag unter
  »Offene Befunde«, an Paket 13 adressiert. Ebenso wenig fasst es
  `{projectRoot}/package.json` in den `inputs` an (Paket 12) oder die beiden
  `createVO() as Sprite` in `demos/animated-*/BouncingSprites.ts` (Paket 13).
- Dateien: `apps/lookbook/package.json`, `apps/lookbook/project.json`,
  `packages/twopoint5d/src/display/types.ts`, `pnpm-lock.yaml` (generiert) und in
  `apps/lookbook/src/`: `components/Card.astro`, `components/DemoCardsGrid.astro`,
  `components/DemoNavBar.astro`, `components/RadioButtons.astro`,
  `components/SearchLookbook.astro`, `components/TagCloudFilter.astro`,
  `pages/demos/animated-billboards.astro`, `pages/demos/animated-sprites.astro`,
  `pages/demos/crosses.astro`, `pages/demos/display-multi.astro`,
  `pages/demos/instanced-quads.astro`, `pages/demos/map2d-cam-visi.astro`,
  `pages/demos/map2d-rect-visi.astro`, `pages/demos/map2d-tile-sprites.astro`,
  `pages/demos/quadtree-playground.astro`, `pages/demos/stage-nested-pipelines.astro`,
  `pages/demos/stage-postprocessing.astro`, `pages/demos/textured-quads.astro`,
  `pages/demos/textured-quads-from-texture-atlas.astro`,
  `pages/demos/textured-quads-from-tileset.astro`,
  `pages/demos/textured-quads-po2image-loader.astro`, `pages/demos/textured-sprites.astro`

**Wie an jeder der 96 Stellen entschieden wird.** Der Lauf hat für genau diese Frage schon
eine Antwort, und sie steht in Paket 8a: Ein `!` ist erlaubt, wenn es eine Invariante
festhält, und es bekommt den Satz dazu, der sie benennt. Ein `!`, das eine Prüfung ersetzt,
die es geben müsste, ist die Ausweichklappe, gegen die dieses Paket überhaupt gebaut ist.
Zwei Regeln, die daraus folgen und für jeden Schritt unten gelten:

- **Ein Satz je Invariante, nicht je Fundstelle.** Fünf `quad!` in derselben Schleife
  teilen einen Kommentar über der Schleife. Fünf Kommentare wären Rauschen, keiner wäre
  eine Behauptung ohne Beleg.
- **Kein erfundener Vorgabewert.** Kein `?? '{}'`, kein `?? 0`, kein leeres Ersatzobjekt,
  wo der echte Wert fehlt. Fehlt etwas wirklich, sagt der Typ das, oder ein Wächter fängt
  es ab. Die eine Ausnahme steht in Schritt 10 und ist dort begründet.

Die Fundstellen unten sind vollständig: 96 Fehler, 22 Dateien, am 2026-09-04 gegen
`ff29f29` im echten Baum gemessen. Wer eine Stelle anders lösen will als hier steht, meldet
das, statt es zu tun.

- Vorgehen:
  1. **`@astrojs/check` installieren.** In `apps/lookbook/package.json` unter
     `devDependencies` (dort steht seit Paket 8a schon `typescript`):
     `"@astrojs/check": "^0.9.10"`. Danach `pnpm install`, das Lockfile wird mitcommittet.
     Damit wird das Script `astro:check` (Zeile 14) zum ersten Mal ausführbar; es bleibt
     wie es ist (`pnpm exec astro check`).
  2. **Der Einzeiler in der Bibliothek.**
     `packages/twopoint5d/src/display/types.ts:17` lautet
     `export type DisplayRendererParameters = Partial<Omit<ConstructorParameters<typeof WebGPURenderer>[0], 'canvas'>>;`
     und wird zu
     `export type DisplayRendererParameters = Partial<Omit<NonNullable<ConstructorParameters<typeof WebGPURenderer>[0]>, 'canvas'>>;`
     Dazu ein Satz darüber, der sagt, warum das `NonNullable` dasteht: der
     Konstruktorparameter ist optional, ohne `NonNullable` ist `keyof` einer Union mit
     `undefined` gleich `never`, und `Omit` liefert dann `{}`. Am 2026-09-04 an einer
     `tsc`-Probe im Baum gemessen: `keyof` der heutigen Fassung nimmt `never` an, `keyof`
     der neuen führt 17 Namen — `forceWebGL`, `antialias`, `powerPreference`, `alpha`,
     `depth`, `stencil`, `samples`, `device`, `context`, `multiview`, `requiredLimits`,
     `trackTimestamp`, `getFallback`, `outputType`, `outputBufferType`,
     `logarithmicDepthBuffer`, `reversedDepthBuffer` —, und `canvas` bleibt korrekt
     draußen. Das nimmt den Fehler an `pages/demos/display-multi.astro:99` weg
     (`TS2353`, `forceWebGL does not exist in type 'DisplayParameters'`); die Demo selbst
     wird **nicht** angefasst, sie war nie falsch.
  3. **Das Gate umstellen.** Zwei Dateien:
     - `apps/lookbook/package.json:13` — das Script `typecheck` lautet heute
       `pnpm exec tsc -p tsconfig.json` und lautet danach `pnpm run astro:check`. Das
       `tsc` fällt weg, es wird nicht danebengestellt. Grund, am 2026-09-04 gemessen: eine
       Probedatei mit zwei Fehlern (`TS18047` aus einem `HTMLElement | null`, `TS2322` aus
       einer falschen Zuweisung) in `apps/lookbook/src/` wird von `astro check` Zeile für
       Zeile und Code für Code genauso gemeldet wie von `tsc -p tsconfig.json`.
       `astro check` sieht dieselben 22 `.ts`-Dateien unter derselben `tsconfig.json` und
       zusätzlich die 36 `.astro`-Dateien — 58 statt 25. Zwei Prüfer über denselben
       Dateien, die sich nur einig sein können, sind einer zu viel; und an dem Tag, an dem
       sie sich uneinig sind, weiß niemand, welcher recht hat.
     - `apps/lookbook/project.json` — das Target `typecheck` behält
       `"dependsOn": ["^build"]` (die App löst gegen `dist/lib` auf) und bekommt vier
       Einträge in `inputs`: `{projectRoot}/src/**/*.astro` (ohne sie gibt eine geänderte
       `.astro`-Datei einen Cache-Treffer auf das alte Ergebnis — das neue Gate wäre von
       seinem ersten Tag an blind), `{projectRoot}/src/**/*.json` (die Demo-Metadaten
       werden unter `resolveJsonModule` importiert und sind damit Typ-Eingabe) und
       `{projectRoot}/astro.config.mjs`. Die bestehenden drei Einträge bleiben.
       `{projectRoot}/package.json` fehlt weiterhin absichtlich: das ist der Eintrag unter
       »Offene Befunde«, den Paket 12 in einem Durchgang über **alle** Targets nachträgt,
       und dieses Paket schneidet ihm nichts weg. Für den eigenen Verify-Lauf ist das
       folgenlos — die Änderung an `inputs` ändert den Target-Hash ohnehin.
  4. **Zwölfmal dasselbe Canvas** (12 Fehler, `TS2345`,
     `HTMLElement | null` → `HTMLElement | WebGPURenderer`). Jede der zwölf Zeilen lautet
     `new PerspectiveOrbitDemo(document.getElementById('canvas-container'), …)`, und jede
     der zwölf Seiten schreibt `<canvas id="canvas-container" resize-to="window">` in ihr
     eigenes Markup. Also `document.getElementById('canvas-container')!`, mit einem Satz
     je Datei: das Element steht im Markup dieser Seite. Dieselbe Schreibweise steht seit
     jeher in `pages/demos/quadtree-playground.astro:33`
     (`document.getElementById('twopoint5d')!`) — sie wird hier nicht erfunden, sondern
     durchgezogen.
     `animated-billboards.astro:54` · `animated-sprites.astro:65` · `crosses.astro:34` ·
     `instanced-quads.astro:35` · `map2d-cam-visi.astro:49` · `map2d-rect-visi.astro:31` ·
     `map2d-tile-sprites.astro:27` · `textured-quads.astro:125` ·
     `textured-quads-from-texture-atlas.astro:85` · `textured-quads-from-tileset.astro:115` ·
     `textured-quads-po2image-loader.astro:89` · `textured-sprites.astro:56`
  5. **Neun weitere DOM-Abfragen auf das eigene Markup** (9 Fehler, `TS2531`). Dieselbe
     Invariante wie in Schritt 4, andere Selektoren; jede gesuchte Klasse steht im Markup
     derselben Datei. Also `!` mit einem Satz je Datei.
     `components/TagCloudFilter.astro:174` (`.tags`, Zeile 8) ·
     `pages/demos/animated-sprites.astro:68` (`.spriteCount`, Zeile 10), `:125`
     (`.moreSprites`, Zeile 11), `:130` (`.lessSprites`, Zeile 9) ·
     `pages/demos/textured-quads.astro:134` (`#texture-preview`, Zeile 11) ·
     `pages/demos/textured-quads-from-texture-atlas.astro:98` ·
     `pages/demos/textured-quads-from-tileset.astro:131` ·
     `pages/demos/textured-quads-po2image-loader.astro:102` (je `#texture-preview`) ·
     `pages/demos/textured-sprites.astro:77` (`.render-as-billboards`)
  6. **`createVO()` in einer Schleife, die die Kapazität nicht überschreitet** (30
     Fehler). Der Pool wird eine Zeile vorher mit genau der Zahl gebaut, die die Schleife
     danach abläuft; `createVO()` findet also Platz. Genau dafür gibt es den Wortlaut
     schon: `src/demos/instanced-quads/createTexturedQuads.ts:17-19` trägt seit Paket 8a
     `geometry.basePool!.createVO()!.make();` samt dem Satz »the geometry was built with a
     capacity, so it has its base pool, and the first createVO() on that pool finds room«.
     Der Satz wird hier übernommen, nicht neu erfunden.
     - Zwei Zeilen der Sorte »Base-Pool«, je zwei Fehler (`TS18048` + `TS2532` in derselben
       Zeile): `instanced-quads.astro:103` und `textured-quads.astro:75`, beide
       `geometry.basePool.createVO().make();` → `geometry.basePool!.createVO()!.make();`
     - Sechs Schleifen mit je einem `const quad`/`const cross`, das `!` bekommt, und einem
       Satz über der Schleife: `crosses.astro:41` (`geometry.pool.createVO()`, Kapazität
       `ROWS * COLS` in Zeile 37, Fehler an 43, 44, 45) · `instanced-quads.astro:132`
       (Fehler an 134, 135, 137) · `textured-quads.astro:79` (Fehler an 81, 82 zweimal,
       84, 90) · `textured-quads-from-texture-atlas.astro:61` (Fehler an 63, 64 zweimal,
       66, 73) · `textured-quads-from-tileset.astro:88` (Fehler an 90, 91 zweimal, 93,
       103) · `textured-quads-po2image-loader.astro:66` (Fehler an 68, 69 zweimal, 71, 77)
  7. **`material` und `renderer`, die im Konstruktor entstehen** (8 Fehler). Beide Felder
     sind in der Bibliothek optional deklariert, weil `dispose()` sie wieder abräumt; wer
     das Objekt gerade gebaut hat, hält sie. Die Bibliothek schreibt an vier eigenen
     Stellen `this.renderer!` (`display/Display.ts:282`, `360`, `617`, `618`), und
     `demos/utils/PerspectiveOrbitDemo.ts:28-29` trägt den Satz dazu.
     - `textured-sprites.astro:73, 74, 75, 81` (`TS18048`, `sprites.material`): **nicht**
       vier `!`, sondern einmal `const material = sprites.material!;` unmittelbar nach
       `new TexturedSprites(CAPACITY, texture)` (Zeile 71), mit dem Satz, dass der
       Konstruktor immer ein `TexturedSpritesMaterial` anlegt. Die vier Zugriffe gehen
       danach über `material`; der in Zeile 81 liegt im Click-Handler und sieht die
       Konstante.
     - `quadtree-playground.astro:35`, `stage-nested-pipelines.astro:53` und `:89`,
       `stage-postprocessing.astro:35` (`TS2345`, `WebGPURenderer | undefined`):
       `display.renderer!`, ein Satz je Datei.
  8. **Die beiden Stage-Demos** (10 Fehler). Zwei Muster, beide mit Vorbild im Repo:
     - `stage-nested-pipelines.astro:54` und `stage-postprocessing.astro:37`, je drei
       Fehler in einer Zeile (`TS18048` auf `scenePass`, `TS2339` `Property 'add' does not
       exist on type 'Node'`, `TS2345` `Node | undefined` → `Node<"vec4">`). Der Rumpf von
       `buildOutputNode` bindet den Pass in eine Konstante und castet sie einmal:
       `const pass = scenePass as Node<'vec4'> & {add(other: Node): Node};`, danach
       `return pass.add(bloom(pass, …));` mit den unveränderten Zahlen der jeweiligen
       Datei. Der Satz dazu steht wörtlich schon in
       `packages/twopoint5d/src/stage/RootRenderPipeline.ts:30-31`: TSL-Knoten führen ihre
       Rechenoperatoren zur Laufzeit über den ShaderNodeProxy, der statische Typ `Node`
       zeigt kein `.add()`. Beide Dateien brauchen dafür `type Node` in ihrem bestehenden
       Import aus `three/webgpu` (Zeile 25 bzw. 24). Am 2026-09-04 an einer `tsc`-Probe im
       Baum gemessen, dass genau diese Fassung durchgeht.
     - `stage-nested-pipelines.astro:68` (`phases[i]`) und `:69` (`worldSprites[i]`),
       `stage-postprocessing.astro:61` (`phases[i]`) und `:62` (`sprites[i]`), je `TS2532`
       aus `noUncheckedIndexedAccess`. Die Schleifenschranke ist die Länge desselben
       Arrays, `phases` ist aus ebendiesem Array gemappt. Also `!` mit einem Satz je Datei
       — dieselbe Lösung, die `RootRenderPipeline.ts:33` mit »The loop bound is
       `passes.length`.« trägt.
  9. **Zwei fehlende Typargumente am `attribute()`** (2 Fehler, `TS2339`). Dasselbe Mittel
     wie in Schritt 6 von Paket 11: ohne Typargument liefert `attribute()` einen
     `AttributeNode<unknown>`, auf dem keine Swizzle-Eigenschaft existiert.
     - `crosses.astro:56` — `abs(attribute('position').z)` wird zu
       `abs(attribute<'vec3'>('position').z)`. `position` ist in `CrossDescriptor`
       (`demos/crosses/Crosses.ts:115`) als `{components: ['x', 'y', 'z']}` erklärt.
       Das `attribute('position')` eine Zeile darüber (`:55`, in `directionToColor(…)`)
       bleibt **unverändert**: dort steht keine Swizzle-Eigenschaft dahinter, der Compiler
       meldet nichts, und eine Änderung ohne Fehler dahinter ist eine Änderung ohne Grund.
     - `instanced-quads.astro:159` — `length(attribute('instancePosition').xy)` wird zu
       `length(attribute<'vec3'>('instancePosition').xy)`. `instancePosition` steht im
       Deskriptor derselben Datei (`:85`) als `{components: ['x', 'y', 'z']}`, ist also
       `vec3`; `.xy` greift die ersten beiden Komponenten ab. Am 2026-09-04 an einer
       `tsc`-Probe gemessen: beide Fassungen compilieren.
  10. **Die sechs Komponenten** (23 Fehler). Hier trägt kein einzelnes Muster; jede Stelle
      einzeln:
      - `components/Card.astro:82` — `const demoId = $el.getAttribute('data-demo-id');`
        liefert `string | null`, `updateCardVisibility()` verlangt `string` (Fehler an 84
        und 87). Die Karte schreibt `data-demo-id={id}` in ihrem eigenen Markup (Zeile 20)
        aus einem Pflicht-Prop → `!` mit diesem Satz.
      - `components/Card.astro:71` — `const tag = el.getAttribute('data-tag');` in einem
        `forEach` über `$el.querySelectorAll('[data-tag]')` (Zeile 63); der Selektor
        garantiert das Attribut (Fehler an 72) → `!` mit diesem Satz.
      - `components/DemoCardsGrid.astro:11` — `body={shortDescription ?? description}` ist
        `string | undefined`, `Card` verlangt `string`. Die `??`-Kette bekommt ihr drittes
        Glied: `body={shortDescription ?? description ?? ''}`. Das ist die eine erlaubte
        Ausnahme von der Regel »kein erfundener Vorgabewert«, und sie ist keine Erfindung:
        beide Felder sind in `IDemo` optional, und eine Demo ohne jeden Text bekommt eben
        keinen. Kein Umbau des `Props.body` von `Card` — die Komponente reicht `body` an
        `marked.parse()` weiter und darf einen String erwarten. (Heute greift das dritte
        Glied nie: alle 17 Demo-JSONs führen mindestens eines der beiden Felder.)
      - `components/DemoNavBar.astro:163` und `components/SearchLookbook.astro:66` — je
        `const closeButton = dialog.querySelector('button');` (Fehler an 172 bzw. 75). Der
        Dialog trägt seinen Button im eigenen Markup → `!` mit diesem Satz. Das
        `as HTMLDialogElement` eine Zeile darüber bleibt stehen; es steht als eigener
        Eintrag unter »Offene Befunde« und gehört nicht hierher.
      - `components/RadioButtons.astro:30` und `:31` — `groupName` und `stateValue` kommen
        aus `getAttribute()`, beide `string | null` (Fehler an 35, 38, 46). Die Schleife
        läuft über `button[data-radio-buttons-group]`, und das eigene Markup (Zeile 17)
        schreibt beide Attribute aus Pflicht-Props → je ein `!`, ein Satz für beide.
      - `components/RadioButtons.astro:42` — `button.parentElement` (`TS18047`). Die
        Buttons stehen im `<div class="radio-buttons">` derselben Komponente → `!` mit
        diesem Satz.
      - `components/TagCloudFilter.astro:19` und `:20` — `tags.get(tag).demoIds` und
        `.relatedTags` (`TS2532`). `category.tags` wird in
        `demos/utils/loadMetadataForDemos.ts:72-87` ausschließlich aus
        `Array.from(tags.keys())` befüllt; jeder Name ist also ein Schlüssel der Map →
        `tags.get(tag)!` mit diesem Satz. Dieselbe Datei schreibt es an zwei Stellen
        bereits so (`:56`, `:85`).
      - `components/TagCloudFilter.astro:119-121` — `$el.getAttribute(attrName).split(',')`
        (`TS2531`). Hier **kein** `!`: `readUniqValuesFromAttribute()` nimmt ein beliebiges
        `Element` und einen beliebigen Attributnamen entgegen und kann über keinen von
        beiden etwas wissen. Das Attribut in eine Konstante binden und bei `null` das
        unveränderte `target` zurückgeben. Für die beiden echten Aufrufer ändert sich
        nichts; die Funktion hört nur auf, eine Zusicherung zu geben, die ihr niemand
        gegeben hat.
      - `components/TagCloudFilter.astro:161-169` — `localConfig.activeTags` ist im
        Callback nicht mehr verengt (`TS18048` an 165). Die Menge vor dem `if` in eine
        Konstante binden (`const activeTags = localConfig.activeTags;`) und den Wächter
        wie die Abfrage darauf umstellen; über ein `const` trägt die Verengung in den
        Callback. `relatedTags` bleibt mit seinem `?.` wie es ist.
      - `components/TagCloudFilter.astro:164` — `const tagName = el.getAttribute(ATTR_TAG);`
        in einer Schleife über `[data-tag]` (Fehler an 165 und 167) → `!`, derselbe Satz
        wie bei `Card.astro:71`.
      - `components/TagCloudFilter.astro:204, 205, 208, 214` — `$activated[0]` und
        `$activated[i]` (`TS2345`, `Element | undefined`). Zeile 196 hat `length === 0`
        gerade ausgeschlossen, die Schleife läuft gegen `$activated.length` → `!` mit
        einem Satz, wie in `RootRenderPipeline.ts:33`.
      - `components/TagCloudFilter.astro:222` — `activeTags` wird zu `Set<string | null>`,
        weil das `.map()` `getAttribute()` durchreicht (Folgefehler an 225, 233 und 243).
        Das `!` gehört in den Map-Callback (`el.getAttribute(ATTR_TAG)!`), dieselbe
        Selektor-Invariante wie oben; damit ist die Menge ein `Set<string>` und die drei
        Folgefehler sind weg. **Nicht** die Signatur von `LookBookShowDemosEventDetail`
        aufweichen.
  11. **`textured-quads-from-texture-atlas.astro:56`** — `atlas.frame(name).coords`
      (`TS2532`). Die Namen kommen aus `atlas.frameNames(/numbers32/)`, und `frameNames()`
      liefert Schlüssel der atlas-eigenen Namensmap
      (`packages/twopoint5d/src/texture/TextureAtlas.ts:60-67`); `frame()` findet sie
      also. → `atlas.frame(name)!.coords` mit diesem Satz. Genau diese Schreibweise steht
      schon in `textured-quads-from-tileset.astro:100`
      (`tileset.atlas.randomFrame()!.coords`, mit Satz).
  12. **Die Kontrolle.** `pnpm exec astro check` in `apps/lookbook` meldet **0 errors**.
      Die Zwischenzahl ist der Maßstab der Arbeit: 96 vorher, 0 nachher. Der eine `hint`,
      den der Lauf zusätzlich meldet, bleibt stehen und reißt nichts — die Vorgabeschwelle
      von `astro check` ist `error`, und sie wird nicht verschärft. Tauchen beim Beheben
      **neue** Fehler auf, die vorher nicht in der Liste standen, sind sie Teil dieses
      Pakets und werden nach denselben zwei Regeln oben gelöst.
      Die volle Ausgabe des Ausgangslaufs liegt im Arbeitsverzeichnis als
      `astro-check-probe/zug0-11a.plain.log`, die reine Fundstellenliste als
      `astro-check-probe/errs-full.txt`; erzeugen lässt sie sich nach Schritt 1 jederzeit
      mit `pnpm exec astro check` in `apps/lookbook`.
- Verify: zwei Läufe, wie Paket 11 sie gefahren hat.
  `pnpm lint && pnpm build && pnpm typecheck && pnpm checkPkgTypes && pnpm lintPkg && pnpm test:ci`
  ist das Gate und muss auf `exit=0` enden; sein Log ist das, was in `verify_log` genannt
  wird. Danach `pnpm test:browser` **getrennt** in ein zweites Log: die Suite endet wegen
  Firefox auf `exit=1`, und ihr Maßstab sind die Zahlen unter »Vorbestehende Fehler«
  (Chromium 0 Fehler, Firefox 24, `getSupportedExtensions` 92-mal), nicht ihr Exit-Code.
  In einer `&&`-Kette risse sie das Gate mit.
- Commit: `build(lookbook): type-check the astro pages and open up DisplayParameters`
- Ergebnis: 2 Runden · alle 96 `astro check`-Fehler in 22 `.astro`-Dateien behoben,
  gegengemessen im echten Baum: 96 vorher, 0 nachher (58 Dateien, der eine `hint` bleibt) ·
  alle drei Nebenbefunde erledigt (`@astrojs/check` installiert und das Script ausführbar,
  `DisplayRendererParameters` öffnet sich von `{}` auf 17 Felder,
  `atlas.frame(name)!.coords` mit dem Satz zur Invariante) · eine Abweichung vom
  Detailplan, vom Reviewer am Code bestätigt: der Folgefehler an `TagCloudFilter.astro`
  hängt an Zeile 229, nicht an 233, und braucht dort dasselbe `!` · Runde 1 der
  Fehlerkette trug die im Paket gefundene Fassung in `stage/README.md` (fünf Snippets,
  vom Reviewer durch einen eigenen Compile-Lauf belegt) und schrieb `CLAUDE.md:24` auf
  das, was das Gate jetzt sieht · klein, ohne Runde: `CLAUDE.md:24` nennt nur die
  `pages/`-Hälfte der 36 `.astro`-Dateien · `stage/README.md:237` behauptet »one cast per
  pass covers both«, was nur für Mode E gilt · `stage/README.md:230` kündigt eine
  Aufzählung an und liefert einen Typ-Exkurs
- Nebenbefunde: → Queue (3)
- Folgen: `packages/twopoint5d/src/stage/RootRenderPipeline.ts:9` — der Klassen-Docblock
  zeigt `new RootRenderPipeline(display.renderer);`, was unter dem Schalter aus Paket 8a
  nicht mehr compiliert · `apps/lookbook/src/pages/demos/stage-postprocessing.astro:36` —
  die auskommentierte Alternative `([scenePass]) => bloom(scenePass, 1.2, 0.6, 0.0);`
  steht ungecastet über der Fassung, die erklärt, warum es ohne Cast nicht geht. Beide
  sind Symptome von Paket 8a: der globale Schalter erreichte, was der Compiler sieht,
  und ließ Beispielcode und auskommentierte Zeilen stehen. Paket 8a ist committet →
  Nachtragspaket 15, das die Ursache zu Ende bringt.
- Schnittstellen: `pnpm typecheck` prüft ab hier auch die 36 `.astro`-Dateien der Lookbook
  — das Script `typecheck` in `apps/lookbook/package.json` fährt `astro check` statt
  `tsc -p tsconfig.json`, `@astrojs/check@^0.9.10` steht in ihren `devDependencies`, und
  das Nx-Target `typecheck` führt `src/**/*.astro`, `src/**/*.json` und
  `astro.config.mjs` in `inputs`. Ein reiner `tsc`-Lauf über die App existiert nicht mehr;
  wer eine `.astro`-Datei schreibt, schreibt sie unter beiden Strictness-Schaltern ·
  `DisplayRendererParameters` ist nicht mehr `{}`, sondern führt die 17 Optionen des
  `WebGPURenderer` ohne `canvas` — `DisplayParameters` nimmt damit erstmals `antialias`,
  `forceWebGL`, `powerPreference` und die übrigen an. Rein additiv für Konsumenten,
  gehört aber in die Semver-Bewertung des Abschlusses und ins CHANGELOG.

**Nebenbefund · low · `apps/lookbook/package.json:14`** — das Script `astro:check` lässt
sich in diesem Workspace nicht ausführen: `@astrojs/check` steht in keinem Manifest, und
ein Aufruf bleibt bei »Astro requires the following dependency to be installed«
interaktiv stehen. Damit prüft nichts die Typen der 36 `.astro`-Dateien: `astro build`
transpiliert ohne Typprüfung, kein Nx-Target ruft `astro:check`, und `pnpm run ci` kennt
es nicht.
Empfehlung: `@astrojs/check` installieren und das Script ins Gate hängen.

**Nebenbefund · medium · `packages/twopoint5d/src/display/types.ts:17`** —
`DisplayRendererParameters` ist leer. Die Ableitung
`Partial<Omit<ConstructorParameters<typeof WebGPURenderer>[0], 'canvas'>>` greift auf einen
**optionalen** Konstruktorparameter zu, `ConstructorParameters<…>[0]` ist damit
`WebGPURendererParameters | undefined`, und `keyof` einer Union mit `undefined` ist
`never` — `Omit` liefert `{}`. Wirkung: `DisplayParameters` nimmt aus TypeScript keinen
einzigen Renderer-Parameter an — nicht `antialias`, nicht `forceWebGL`, nicht
`powerPreference` —, während `Display` sie zur Laufzeit an den `WebGPURenderer`
durchreicht (`src/display/Display.ts:337-346`). Ein `Display`-Aufruf mit Renderer-Optionen
ist von außen nur noch mit Cast schreibbar. Seit `d511891` so.
Empfehlung: `NonNullable<…>` um den Zugriff herum. Rein additiv für Konsumenten, gehört
aber in die Semver-Bewertung des Abschlusses.

**Nebenbefund · low ·
`apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro:56`** —
`atlas.frame(name).coords` ohne Prüfung. `frame()` gibt seit jeher
`TextureAtlasFrame | undefined`.
Empfehlung: die Invariante festhalten — die Namen stammen aus `frameNames()` desselben
Atlas.

### [x] 12. Konfigurations- und Dokumentationsreste

- Nebenbefund: `.gitignore:11,44,45,49-53` (info) · `.github/workflows/ci.yml:27,32,38` (info) ·
  `packages/twopoint5d/package.json:53,54` (low) · `packages/twopoint5d/project.json:16`
  und `apps/lookbook/project.json:17` (low) · `packages/twopoint5d/README.md:24,29,30,31,50,56,63` (low) ·
  `packages/twopoint5d/src/stage/README.md:6`, `packages/twopoint5d/src/stage/StageRenderer.ts:284`,
  `packages/twopoint5d/src/stage/StageRenderer.spec.ts:320` und
  `apps/lookbook/src/pages/demos/stage-nested-pipelines.astro:37-38` (low, in Zug 0 hinzugekommen)
- Ziel: Keine Zeile in einer Konfigurationsdatei, die nichts mehr tut oder etwas anderes
  behauptet als sie bewirkt — und kein Verweis im Paket, der auf eine Datei zeigt, die es
  nicht gibt.
- Bereich: `.gitignore`, `.github/workflows/ci.yml`, `packages/twopoint5d/package.json`,
  die `project.json` beider Projekte, `packages/twopoint5d/README.md`,
  `packages/twopoint5d/src/stage/`, `apps/lookbook/src/pages/demos/`
- Hängt ab von: —
- Hinweis: Die fehlende `{projectRoot}/package.json` in den `inputs` betrifft nicht nur die
  beiden `typecheck`-Targets, sondern auch `build` und `test` — der Durchgang geht über
  alle Targets, nicht über zwei. Vier der sieben README-Verweise zeigen in einen
  `docs/`-Baum, den `37887ba` entfernt hat; zwei nennen Verzeichnisse falsch
  (`src/tiled-maps/` heißt `map2d/`, und »texture atlases and tilesets« verlinkt
  `src/vertex-objects/` statt `src/texture/`).
  **Der erste Satz stimmt nicht — `build` und `test` tragen das Loch nicht; siehe Abgleich,
  Punkt 4. Die Angaben zu den README-Verweisen stimmen.**
- Hinweis (Zug 0 von Paket 11a): Paket 11a legt **kein** weiteres Target an — die Annahme
  aus Zug 0 von Paket 11 trägt nicht. Es stellt das bestehende `typecheck`-Target der App
  von `tsc` auf `astro check` um und erweitert dessen `inputs` um `.astro`, `.json` und die
  Astro-Config; `{projectRoot}/package.json` bleibt dort offen und wartet auf diesen
  Durchgang. Die Zahl der Targets ist damit dieselbe wie heute, und die Reihenfolge der
  beiden Pakete ist frei.
- Hash: de936e4
- Modell: mittlere Stufe
- Effort: low

- Abgleich (Zug 0, 2026-09-04): alle fünf Nebenbefund-Gruppen bestehen fort, drei davon mit
  bewegten Zeilennummern, und **zwei der Hinweise oben stimmen nicht**. Im Einzelnen:

  1. `.gitignore` — unverändert vorhanden, die Zeilen sind ab 33 um eins gewandert, weil
     Paket 5 `packages/*/coverage` eingefügt hat. Heute: `.nx/cache` in 11, das pauschale
     `.nx/` in 44, `.nx/workspace-data` in 45; die Zeilen 49/50 stehen als 52/53 wortgleich
     ein zweites Mal da.
  2. `.github/workflows/ci.yml:27,32,38` — unverändert, die drei `NPM_TOKEN: xxx` stehen
     genau dort. Nachgemessen: außerhalb dieser drei Zeilen kommt `NPM_TOKEN` im ganzen Repo
     nur in `scripts/publishNpmPkg.mjs:18` vor, und zwar in einer Log-Ausgabe. Ein `.npmrc`
     hat das Repo nicht, `pnpm run ci` ruft `publishNpmPkg` nicht auf, und `deploy.yml`
     setzt die Variable nirgends.
  3. `packages/twopoint5d/package.json` — der Sachverhalt besteht, die Zeilen heißen heute
     53 und 54 (Paket 8a hat `typecheck` darüber eingefügt).
  4. **Korrektur zum ersten Hinweis.** `build` und `test` tragen das Loch **nicht**.
     `build` führt in seinen `inputs` den benannten Input `makePackageJson`, und der beginnt
     mit `{projectRoot}/package.json` (`nx.json:53`); `test` führt `vitestDefaults`, und der
     enthält dieselbe Datei (`nx.json:63`). Am 2026-09-04 im echten Baum gemessen: eine
     Änderung an einem beliebigen Script in `packages/twopoint5d/package.json` lässt
     `nx build twopoint5d` von einem Cache-Treffer auf `0/1 hit` fallen, während
     `nx typecheck twopoint5d` **weiter aus dem Cache liest und die alte Kommandozeile
     ausführt** — der Befund selbst ist damit belegt, sein Umfang aber nicht. Auch
     `twopoint5d-testing:test` ist gedeckt (`inputs: ["default", "^default"]`), und
     `lookbook:build` hat gar keine eigenen `inputs` und fällt damit auf `default` zurück.
     Es sind genau die zwei `typecheck`-Targets, und der »Durchgang über alle Targets« ist
     dieser Durchgang: alle anderen sind bereits in Ordnung.
  5. **Korrektur zur `Ziel:`-Zeile, die dieser Zug ersetzt hat.** `packages/twopoint5d/README.md`
     ist **nicht** die Seite, die npmjs.com anzeigt. `scripts/publishNpmPkg.mjs:54-60` kopiert
     `README-pkg.md` nach `dist/README.md`, wenn es existiert — und es existiert, neun Zeilen
     mit drei absoluten GitHub-Links, alle intakt. Die sieben toten Verweise treffen den
     Leser, der auf GitHub in `packages/twopoint5d/` landet. Der Befund bleibt, seine
     Begründung nicht: eine Modulübersicht, deren Hälfte der Links ins Leere zeigt, ist auch
     ohne npm-Startseite falsch.
  6. Die sieben Verweise selbst, Zeile für Zeile nachgesehen: 24 (`src/vertex-objects/` statt
     `src/texture/`), 29 (`src/tiled-maps/`, das Modul heißt `map2d/`), 30 und 31
     (`../../docs/Map2D.md`), 50 (`../../docs/VertexObjects-legacy.md`), 56
     (`../../docs/Stage2D.md`), 63 (`../../docs/Display.md`). Ein `docs/`-Verzeichnis gibt es
     nicht, `37887ba` hat es entfernt. Zeile 11 (`../../README.md`) und das Logo in Zeile 2
     zeigen auf vorhandene Dateien und bleiben unangetastet.

- Triage (Zug 0): eine Gruppe kommt hinzu, eine bleibt draußen.

  1. **Hinzu: die vier Verweise auf `Backlog-StageRenderer.md`.** In Zug 0 aufgefallen, als
     die Ersatzadresse für die toten `docs/Stage2D`- und `docs/Display`-Links gesucht wurde:
     `packages/twopoint5d/src/stage/README.md` existiert und beschreibt beides — und schickt
     in seiner sechsten Zeile den Leser auf `../../../../Backlog-StageRenderer.md`, das es
     nicht gibt. `1b5698e` (»consolidate backlog docs into a single audit.html«, 2026-08-20)
     hat die Datei entfernt; der Commit liegt vor `ba44e8e`, der Sachverhalt ist also
     vorbestehend. Drei weitere Stellen nennen dieselbe Datei beim Namen:
     `StageRenderer.ts:284`, `StageRenderer.spec.ts:320` und
     `stage-nested-pipelines.astro:37-38`.
     Aufgenommen, weil es dieselbe Ursache ist wie die sieben README-Verweise — eine
     Entfernung, die ihre Verweise stehen ließ — und weil die Stelle im Weg des eigenen Fixes
     liegt: dieses Paket richtet zwei README-Zeilen auf `src/stage/README.md` aus, und einen
     Leser auf eine Seite zu schicken, deren erster Absatz ins Leere führt, wäre genau die
     halb behobene Ursache, gegen die dieser Lauf an mehreren Stellen anschreibt. Vier
     Einzeiler, alle Kommentar oder Prosa, keiner davon Verhalten.
  2. **Draußen: die `§`-Nummerierung derselben Dateien.** `§3.2`, `§6.2`, `§6.3` und `§6.4`
     stehen an sieben Stellen in `src/stage/README.md`, an drei in `StageRenderer.ts` und an
     drei in `StageRenderer.spec.ts` — dort sogar in `describe`-Namen. Sie nummerieren
     Abschnitte desselben verschwundenen Dokuments, benennen aber niemanden und schicken
     niemanden irgendwohin: die README trägt die Nummern in ihren eigenen Überschriften
     (»Mode C (§6.4)«, »Mode D (§6.2)«, »Mode E (§6.3)«), sie lesen sich damit als
     Modus-Kennungen. Ein stehengebliebenes Etikett ist etwas anderes als ein toter Link, und
     die Ablösung hieße, ein Dokument von 451 Zeilen samt drei Testnamen umzunummerieren. Als
     eigener Eintrag in »Offene Befunde«, `→ Scope`, für die Drain-Runde.
  3. Aus »Offene Befunde« kommt sonst nichts hinzu: die übrigen offenen Einträge teilen mit
     diesem Paket weder Ursache noch Datei. Offene `Folgen:`-Zeilen erledigter Pakete gibt es
     nicht mehr — die letzten beiden hat Paket 11a nach Paket 15 gegeben.

- Dateien: `.gitignore`, `.github/workflows/ci.yml`, `packages/twopoint5d/package.json`,
  `packages/twopoint5d/project.json`, `apps/lookbook/project.json`,
  `packages/twopoint5d/README.md`, `packages/twopoint5d/src/stage/README.md`,
  `packages/twopoint5d/src/stage/StageRenderer.ts`,
  `packages/twopoint5d/src/stage/StageRenderer.spec.ts`,
  `apps/lookbook/src/pages/demos/stage-nested-pipelines.astro`
- Vorgehen:
  1. **`.gitignore` — die dreifache `.nx`-Sperre auf zwei Zeilen, die doppelte Kopie weg.**
     Zeile 11 (`.nx/cache`) unter `# dependencies` ersatzlos streichen. Den heutigen Block
     aus Zeile 44/45

     ```
     .nx/
     .nx/workspace-data
     ```

     ersetzen durch

     ```
     # nx
     .nx/cache
     .nx/workspace-data
     ```

     Das pauschale `.nx/` fällt also, die beiden benannten Einträge stehen künftig
     beieinander und tragen eine Überschrift wie die Blöcke im Kopf der Datei. Der Grund für
     diese Richtung und nicht die umgekehrte: so schreibt nx die Regel selbst, sie benennt,
     was sie verbirgt, und sie verschluckt kein künftiges Unterverzeichnis von `.nx/`, das
     ins Repo gehören könnte. Der Baum enthält heute nur `cache` und `workspace-data`, die
     Wirkung ist damit unverändert.
     Danach die heutigen Zeilen 51 bis 53 streichen — die Leerzeile und die wortgleiche
     Wiederholung von `.cursor/rules/nx-rules.mdc` und
     `.github/instructions/nx.instructions.md`. Die erste Fassung (heute 49/50) bleibt
     stehen; beide Pfade existieren zwar nicht, aber nx legt sie an, wenn seine Agentenregeln
     laufen.
     Sonst wird an der Datei nichts angefasst. `/coverage`, `/typings`, `/out-tsc`,
     `testem.log` und die übrigen Altlasten sind nicht Teil dieses Auftrags; was daran
     auffällt, wird gemeldet statt behoben.
  2. **`.github/workflows/ci.yml` — drei tote `env`-Blöcke.** In den Schritten »Install
     dependencies«, »Install Playwright Browsers« und »Build packages and run all tests« je
     die beiden Zeilen

     ```yaml
             env:
               NPM_TOKEN: xxx
     ```

     ersatzlos streichen (heute 26/27, 31/32 und 37/38). Danach steht `NPM_TOKEN` in keiner
     Workflow-Datei mehr; `scripts/publishNpmPkg.mjs` bleibt unberührt.
  3. **`packages/twopoint5d/package.json` — die zwei Scripts sagen, worauf sie stehen.**
     Zeile 53 und 54 lauten heute

     ```json
         "checkPkgTypes": "cd dist && pnpm exec attw --pack --ignore-rules cjs-resolves-to-esm no-resolution",
         "lintPkg": "cd dist && pnpm exec publint",
     ```

     und danach

     ```json
         "checkPkgTypes": "pnpm run build && pnpm exec attw --pack dist --ignore-rules cjs-resolves-to-esm no-resolution",
         "lintPkg": "pnpm run build && pnpm exec publint dist",
     ```

     Zwei Änderungen in einem Schritt, beide mit eigenem Grund. Das `cd dist` weicht dem
     Verzeichnis als Argument: `attw` nimmt es laut `--help` als
     »directory containing package.json with --pack«, `publint` nimmt es als Positional, und
     beides ist am 2026-09-04 im echten Baum gegen das gebaute `dist/` gefahren worden — »No
     problems found 🌟« und »All good!«, exit 0. Der Pfad steht danach im Kommando statt in
     einem Verzeichniswechsel davor. Das vorangestellte `pnpm run build` macht die
     Abhängigkeit wahr, statt sie nur zu behaupten: ein direkter Aufruf im Paketverzeichnis
     baut jetzt, was er prüft. Gemessen kostet das 2,3 s je Aufruf, also rund 5 s auf einen
     Gate-Lauf, der Minuten dauert. Die `dependsOn: ["build"]` der Nx-Targets bleiben
     unangetastet — sie decken den Weg über Nx, dieser Schritt deckt den daneben. Nebenläufig
     kollidieren die beiden Builds nicht: `pnpm run ci` ruft `checkPkgTypes` und `lintPkg` in
     getrennten `run-many`-Läufen nacheinander auf, und je Lauf gibt es nur ein Projekt mit
     diesem Target.
     `publishNpmPkg` in Zeile 55 bleibt Wort für Wort stehen.
  4. **`packages/twopoint5d/project.json` und `apps/lookbook/project.json` — die fehlende
     Datei in den `inputs`.** In beiden Dateien bekommt das Target `typecheck` den Eintrag
     `"{projectRoot}/package.json"`, unmittelbar vor `"sharedTsconfigs"`. Für die Bibliothek
     ergibt das

     ```json
         "typecheck": {
           "inputs": [
             "{projectRoot}/src/**/*.ts",
             "{projectRoot}/tsconfig.typecheck.json",
             "{projectRoot}/package.json",
             "sharedTsconfigs"
           ]
         },
     ```

     und für die Lookbook dieselbe Zeile zwischen `"{projectRoot}/astro.config.mjs"` und
     `"sharedTsconfigs"`. Die Bibliotheks-Zeile überschreitet mit dem Zusatz die 130 Zeichen
     aus `.prettierrc` und muss deshalb umbrechen — `prettier --check .` ist Teil von
     `pnpm lint` und sagt, wie. Kein weiteres Target wird angefasst: `build`, `test` und die
     Targets der Testing-Projekte führen die Datei bereits, siehe Abgleich Punkt 4.
  5. **`packages/twopoint5d/README.md` — die sieben Verweise.** Genau diese sieben Zeilen,
     sonst nichts:

     - 24: `#### 📚 [texture atlases and tilesets](src/vertex-objects/)` →
       `#### 📚 [texture atlases and tilesets](src/texture/)`
     - 29: `#### 📚 [tiled-maps](src/tiled-maps/)` → `#### 📚 [map2d](src/map2d/)`.
       Auch die Beschriftung, nicht nur das Ziel: Paket 10 hat `tiled-maps` als Modulnamen
       aus `AGENTS.md` und `CLAUDE.md` genommen, weil das Verzeichnis `map2d/` heißt. Eine
       Überschrift, die weiter den alten Namen führt und auf den neuen zeigt, wäre dieselbe
       Ursache halb behoben. Der Aufzählungspunkt darunter sagt ohnehin »create and render
       tiled maps«, dem Leser fehlt nichts.
     - 30: der Link um »a 2D spatial grid map data structure« fällt weg, der Text bleibt —
       die Zeile lautet danach
       `- create and render tiled maps which are laid out in a 2D spatial grid map data structure`
     - 31: `- api docs: [docs/Map2D](../../docs/Map2D.md)` — ganze Zeile ersatzlos streichen
     - 50: `- _legacy_ api docs: [docs/VertexObjects-legacy](../../docs/VertexObjects-legacy.md)`
       — ganze Zeile ersatzlos streichen
     - 56: `- api docs: [docs/Stage2D](../../docs/Stage2D.md)` →
       `- api docs: [stage layer cheat-sheet](src/stage/README.md)`
     - 63: `- api docs: [docs/Display](../../docs/Display.md)` →
       `- api docs: [stage layer cheat-sheet](src/stage/README.md)`

     Dass 56 und 63 auf dieselbe Datei zeigen, ist kein Versehen: `src/stage/README.md` sagt
     in seinem ersten Satz »Quick reference for `Display` + `Stage2D` + `StageRenderer`« und
     deckt beide Abschnitte. Für `docs/Map2D`, `docs/VertexObjects-legacy` und `docs/Display`
     gibt es keinen Ersatz im Baum, deshalb dort Streichung statt Umlenkung.
  6. **Die vier Verweise auf `Backlog-StageRenderer.md`.** Die Datei existiert nicht; sie ist
     mit `1b5698e` in die `audit.html` gewandert, und die darf in keinem dieser Verweise
     auftauchen — sie überdauert den Lauf nicht. Ersatz ist überall die Cheat-Sheet-README,
     die dieselbe Sache beschreibt:

     - `packages/twopoint5d/src/stage/README.md:3-6` — der Halbsatz nach dem Gedankenstrich
       fällt. Aus

       ```
       Quick reference for `Display` + `Stage2D` + `StageRenderer` and the optional
       `RenderPipeline` integration. Use this page when you want to ship something
       fast and need the canonical idioms — for a deeper dive into the design
       rationale see [`Backlog-StageRenderer.md`](../../../../Backlog-StageRenderer.md).
       ```

       wird

       ```
       Quick reference for `Display` + `Stage2D` + `StageRenderer` and the optional
       `RenderPipeline` integration. Use this page when you want to ship something
       fast and need the canonical idioms.
       ```

     - `packages/twopoint5d/src/stage/StageRenderer.ts:284` —
       `  // Pipeline / RenderTarget integration (§6 of Backlog-StageRenderer.md)` wird
       `  // Pipeline / RenderTarget integration — see "Post-processing" in ./README.md`
     - `packages/twopoint5d/src/stage/StageRenderer.spec.ts:320` —
       `  // Pipeline integration (§6 of Backlog-StageRenderer.md)` wird
       `  // Pipeline integration — see "Post-processing" in ./README.md`
     - `apps/lookbook/src/pages/demos/stage-nested-pipelines.astro:37-38` — aus

       ```js
         // RenderPipeline must own the final draw to the canvas — see §6.3
         // in `Backlog-StageRenderer.md`. Mixing pipeline.render() with
       ```

       wird

       ```js
         // RenderPipeline must own the final draw to the canvas — see "Mode E"
         // in `packages/twopoint5d/src/stage/README.md`. Mixing pipeline.render() with
       ```

     Die Zielabschnitte tragen diese Namen tatsächlich:
     `## Post-processing: \`pipeline\` and \`buildOutputNode\`` in Zeile 228 und
     `### Mode E (§6.3) — nested renderers, each with its own post-effect` in Zeile 303. Die
     bloße Nummer `§6` verschwindet aus beiden Bannerkommentaren, weil die überlebende README
     keinen Abschnitt dieses Namens führt. Alle übrigen `§`-Marker bleiben unangetastet —
     sie sind ein eigener Eintrag in »Offene Befunde«.
  7. **Die Kontrolle.** Fünf Proben, jede mit ihrer erwarteten Ausgabe im Report:

     - `pnpm exec nx show project twopoint5d --json` und `pnpm exec nx show project lookbook --json`:
       `targets.typecheck.inputs` enthält in beiden `{projectRoot}/package.json`.
     - `git status --porcelain` nennt genau die zehn Dateien aus `Dateien:` und nichts aus
       `.nx/` — der Beweis, dass die neue `.gitignore` weiter verbirgt, was sie verbergen soll.
     - `grep -rn 'Backlog-StageRenderer' -I . --exclude-dir=node_modules --exclude-dir=.git --exclude=remediation-plan.md`
       findet nichts.
     - `grep -n 'docs/' packages/twopoint5d/README.md` findet nichts.
     - `grep -rn 'NPM_TOKEN' .github/` findet nichts.
- Verify: zwei Läufe, wie Paket 11 und 11a sie gefahren haben.
  `pnpm lint && pnpm build && pnpm typecheck && pnpm checkPkgTypes && pnpm lintPkg && pnpm test:ci`
  ist das Gate und muss auf `exit=0` enden; sein Log ist das, was in `verify_log` genannt
  wird. Es fährt die beiden geänderten Scripts mit und ist damit zugleich die Probe auf
  Schritt 3. Danach `pnpm test:browser` **getrennt** in ein zweites Log: die Suite endet
  wegen Firefox auf `exit=1`, und ihr Maßstab sind die Zahlen unter »Vorbestehende Fehler«
  (Chromium 0 Fehler, Firefox 24, `getSupportedExtensions` 92-mal), nicht ihr Exit-Code.
  In einer `&&`-Kette risse sie das Gate mit.
- Commit: `chore: declare what the build needs and drop what points nowhere`
- Ergebnis: 1 Runde · alle sieben Vorgehen-Schritte umgesetzt, Review ohne Befund · die
  drei `NPM_TOKEN`-Blöcke, die doppelte `.nx`-Sperre und elf tote Doku-Verweise sind weg ·
  `{projectRoot}/package.json` steht in den `inputs` beider `typecheck`-Targets ·
  `checkPkgTypes` und `lintPkg` bauen jetzt selbst, statt es vorauszusetzen · Gate
  `exit=0`, Browsersuite unverändert auf der Baseline (Chromium 0, Firefox 24,
  `getSupportedExtensions` 92)
- Nebenbefunde: `StageRenderer.spec.ts:448,576` — `toThrowError` statt `toThrow` (TS6385)
  → Queue
- Folgen: —
- Schnittstellen: `pnpm --filter @spearwolf/twopoint5d run checkPkgTypes` und `… lintPkg`
  bauen `dist/` jetzt selbst und nehmen das Verzeichnis als Argument statt per `cd` —
  ein direkter Aufruf im Paketverzeichnis braucht kein vorangestelltes `pnpm run build`
  mehr · sonst unverändert

### [x] 13. Zusicherungen, die weniger prüfen als sie versprechen

- Nebenbefund: `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts:34-35,62-63,87-88` (low) ·
  `apps/lookbook/src/demos/animated-sprites/BouncingSprites.ts:46` und
  `apps/lookbook/src/demos/animated-billboards/BouncingSprites.ts:57` (low) ·
  `apps/lookbook/src/components/TagCloudFilter.astro:132,187,190`,
  `apps/lookbook/src/components/DemoNavBar.astro:162`,
  `apps/lookbook/src/components/SearchLookbook.astro:65` und
  `apps/lookbook/src/pages/demos/animated-billboards.astro:119` (low) ·
  `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro:47` (low) ·
  `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts:56` (low, in Zug 0 hinzugekommen) ·
  `packages/twopoint5d/src/vertex-objects/selectBuffers.spec.ts:40-45,53-65`,
  `packages/twopoint5d/src/vertex-objects/selectAttributes.spec.ts:52-57` und
  `packages/twopoint5d/src/texture/TextureAtlas.spec.ts:105-106,119-120,151` (low, in Zug 0 hinzugekommen)
- Ziel: Wo eine Prüfung wie eine vollständige Liste aussieht, prüft sie auch eine; und wo
  die Lookbook den Compiler an einer gefährlichen Stelle vorbeiführt, führt sie ihn nicht
  mehr vorbei.
- Bereich: `packages/twopoint5d/src/vertex-objects/`, `packages/twopoint5d/src/texture/`,
  `apps/lookbook/src/demos/`, `apps/lookbook/src/components/`,
  `apps/lookbook/src/pages/demos/`
- Hängt ab von: Paket 11a — erfüllt, `c3c8edb` steht. Die übrigen Einträge hängen an nichts.
- Hinweis: Gemeinsame Ursache, verschiedene Gestalt — beides ist eine Prüfung, die
  schwächer ist, als sie aussieht. `arrayContaining` prüft Teilmengen:
  ein zusätzlicher Attribut- oder Buffer-Name fällt nicht auf. Die beiden
  `createVO() as Sprite` verschlucken das `undefined`, das bei erreichter Kapazität
  zurückkommt; in der `animated-sprites`-Variante fängt der Aufrufer den Fall zwei Zeilen
  vorher ab, in der `animated-billboards`-Variante niemand.
- Hinweis (Zug 0 von Paket 11): Die Abhängigkeit von Paket 11 ist gestrichen, sie trug nicht.
  Beide Dateien sind `.ts` und liegen seit Paket 8a im `typecheck`-Target der App; ein
  `astro:check` fügt für sie nichts hinzu. Am 2026-09-04 nachgemessen, indem im
  Probe-Workspace nur die beiden Casts entfernt wurden: `pnpm typecheck` meldet dann **28
  Fehler** in genau diesen zwei Dateien. Das Gate steht also längst, und dieses Paket kann
  jederzeit laufen.
  Dieselbe Messung zeigt, dass der Cast mehr verdeckt als das `undefined`: 18 der 28 sind
  TS18048 (`'sprite' is possibly 'undefined'`), aber 8 sind TS2339 — das lokale `interface
  Sprite` erklärt `x0`, `z0`, `speedX`, `speedY` und `speedRotate`, die der Pool als
  `VertexObjectPool<AnimatedSprite>` gar nicht führt; die Demos hängen sie zur Laufzeit an.
  Die verbleibenden 2 sind TS2345 dort, wo das Ergebnis in ein `Sprite[]` geht. Ein
  `as Sprite | undefined` samt Wächter behält diese Zusicherung und nimmt nur die falsche;
  ob das der richtige Weg ist oder der Pool ehrlicher typisiert gehört, entscheidet der
  Detailplan dieses Pakets.
- Hinweis (Zug 0 von Paket 11a): Die Messung darüber trägt weiter, auch nachdem Paket 11a
  das `typecheck`-Target der App von `tsc` auf `astro check` umstellt. Am 2026-09-04 an
  einer Probedatei in `apps/lookbook/src/` gemessen: `astro check` meldet in `.ts`-Dateien
  Zeile für Zeile und Code für Code dasselbe wie `tsc -p tsconfig.json`. Die 28 Fehler
  bleiben also 28.
  Dazu kommen sechs Fundstellen derselben Machart in `.astro`-Dateien, die dieses Paket
  jetzt mitnimmt — vier Casts unmittelbar auf einem `querySelector()` und ein
  `(event: any)` samt dem, was es verdeckt; Einzelheiten im eigenen Eintrag unter »Offene
  Befunde«. Sie sind die Antwort auf die `Ziel:`-Zeile, die bis heute »der einzige Ort«
  sagte: es sind acht Stellen, und sechs davon sieht erst das Gate aus Paket 11a.

**Zug 0 dieses Pakets, 2026-09-04: der Abgleich.** Alle acht überlieferten Fundstellen
stehen unverändert im Baum, sechs davon unter einer neuen Zeilennummer. Die beiden
`createVO() as Sprite` sind mit `a4bfe10` von 47 und 58 auf **46 und 57** gerutscht; die
drei Stellen in `TagCloudFilter.astro` mit `c3c8edb` von 129/179/182 auf **132/187/190**
und `animated-billboards.astro` von 118 auf **119**. `DemoNavBar.astro:162`,
`SearchLookbook.astro:65`, `textured-quads-from-texture-atlas.astro:47` und die sechs
Zeilen in `VertexObjectDescriptor.spec.ts` stehen, wo sie standen.

Drei Korrekturen am Überlieferten, jede nachgemessen:

1. **`toMatchObject` auf einem Array prüft die Länge mit.** Der Eintrag zu
   `VertexObjectDescriptor.spec.ts` behauptet, Zeile 63 (`toMatchObject(['static_float32'])`)
   habe »dasselbe Problem« wie die `arrayContaining`-Zeilen. Sie hat es nicht: unter Vitest
   5.0.0 im Probe-Baum gemessen, geht `expect(['a', 'b']).toMatchObject(['a'])` rot
   (»expected [ 'a', 'b' ] to match object [ 'a' ]«), `expect(['a', 'b']).toEqual(expect.arrayContaining(['a']))`
   dagegen grün. Ein zusätzlicher Buffer-Name fällt an Zeile 63 also sehr wohl auf. Die
   Zeile wird trotzdem auf `toEqual` gebracht, aber aus einem schwächeren Grund: ein Leser
   soll nicht wissen müssen, dass `toMatchObject` bei Arrays die Länge prüft und bei
   Objekten nicht.
2. **Die Reihenfolge in `bufferNames` ist nicht die, die die alte Zeile suggeriert.**
   `bufferNames` ist ein `Set`, gefüllt in Deklarationsreihenfolge der Attribute. Am
   2026-09-04 gegen das gebaute `dist/lib` gemessen: Test 1 liefert
   `['dynamic_float32', 'static_float32']`, Test 3 aber **`['static_float32', 'dynamic_float32']`**
   — dort steht `foo` auf `static` und `bar` auf `dynamic`. Die alte Zeile 88 zählt beide
   Namen in der umgekehrten Reihenfolge auf und kommt damit durch, weil `arrayContaining`
   die Reihenfolge nicht ansieht. Wer sie beim Umschreiben abtippt, macht den Test rot;
   gegengeprüft, indem genau das im Probe-Baum getan wurde.
3. **Es sind neun Stellen, nicht acht.** `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts:56`
   trägt dasselbe `createVO() as BounceSprite` wie die beiden bekannten, ohne
   Kapazitätsprüfung davor, und stand bei `ba44e8e` an derselben Zeile — vorbestehend.
   Gefunden mit `grep -rn 'createVO() as' apps/lookbook/src packages/twopoint5d/src`, das
   drei Treffer liefert und sonst nichts.

**Zug 0: was noch dazukommt und warum.** Der Auftrag der `Ziel:`-Zeile ist keine Datei,
sondern eine Machart, und ein Durchgang über `packages/` mit `arrayContaining`,
`toMatchObject`, `objectContaining` liefert fünf weitere Zusicherungen derselben Sorte, die
eine vollständige Liste behaupten und eine Teilmenge prüfen:
`selectBuffers.spec.ts:40-45` und `:53-65`, `selectAttributes.spec.ts:52-57`,
`TextureAtlas.spec.ts:105-106`, `:119-120` und `:151`. Sie gehen in dieses Paket, nicht in die
Queue: es ist Fundstelle für Fundstelle dieselbe Ursache wie der Eintrag, den die
Drain-Runde für dieses Paket geschnitten hat, und ein zweites Paket für dieselbe Ursache
nach dem Abschluss wäre genau die Kette, gegen die der Schnitt gemacht wurde. Die
`Ziel:`-Zeile wäre außerdem falsch, sobald fünf davon stehen bleiben.

Nicht dazu gehören, jeweils nachgesehen statt vermutet:

- `VertexObjectGeometry.spec.ts:79` und `InstancedVertexObjectGeometry.spec.ts:219` — über
  beiden steht ein `toHaveLength(2)`. Länge plus Enthaltensein ist bei unterschiedlichen
  Elementen Mengengleichheit; das Loch gibt es dort nicht.
- Jedes `toMatchObject([…])` auf einem Array — `selectBuffers.spec.ts:47`,
  `selectAttributes.spec.ts:40,44,48`, `TextureAtlas.spec.ts:122-125`. Die Länge ist
  geprüft (siehe Korrektur 1); sie bleiben, wie sie sind.
- Die dreizehn `(window as any).x = …` in der Lookbook. Sie hängen einen Debug-Griff ans
  `window` und verschlucken keine Zusicherung; sie sind eine andere Sache und bleiben
  liegen.

**Zug 0: die drei Entscheidungen, die der Detailplan zu treffen hatte.**

1. **Die `createVO()`-Casts bleiben Casts, sie bekommen nur das `undefined` zurück.** Der
   Cast trägt zwei Behauptungen: »hier kommt immer ein Sprite« (falsch, bei vollem Pool
   kommt `undefined`) und »an dieses Objekt hänge ich gleich `speedX` und Nachbarn«
   (richtig, genau das tut die Zeile darunter). Der Pool ehrlicher zu typisieren würde die
   zweite in den Typparameter der Bibliothek schieben und `VertexObjectPool` Attribute
   behaupten lassen, die in keinem Deskriptor stehen. Also fällt nur die falsche Hälfte:
   `as Sprite | undefined` und ein Wächter.
2. **Die DOM-Casts werden zu `querySelector<T>(…)!` mit einem Satz darüber.** Die Regel
   dafür steht seit Paket 11a im Plan: ein `!` ist erlaubt, wenn es eine Invariante
   festhält, und bekommt den Satz, der sie benennt. Alle vier Elemente — die zwei
   `<dialog>`, der `<button class="clear-tags-action">`, das `<div class="loading-wrapper">`
   — stehen in der Markup-Hälfte genau der Datei, die sie sucht; sie sind Invarianten und
   keine fehlende Prüfung. Der Unterschied zum `as` ist, was behauptet und was
   aufgeschrieben wird: `as HTMLButtonElement` auf einem `Element | null` behauptet
   zweierlei auf einmal — nicht `null`, und ein Button — und schreibt keines von beiden
   hin. Das Typargument übergibt die Elementart an die Stelle, an der die DOM-API sie
   nimmt und gegen `Element` bindet; übrig bleibt das `!`, und das ist genau die eine
   Behauptung, für die die Regel den Satz verlangt. Neu ist die Form nicht: in
   `DemoNavBar.astro` und `SearchLookbook.astro` steht sie eine Zeile unter dem Cast
   bereits da (`dialog.querySelector('button')!` samt Kommentar), von Paket 11a
   geschrieben.
3. **`sample` wird eine generische Funktion, kein generischer Pfeil.** `const sample = <T>(…)`
   ist in einem `.astro`-`<script>` nicht schreibbar: gemessen meldet `astro check` dort
   `ts(7060)` (»This syntax is reserved in files with the .mts or .cts extension«). Ein
   `<T,>` hilft und liest sich wie ein Tippfehler; eine `function`-Deklaration hat das
   Problem nicht.
- Hash: 2cbedc2
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts`,
  `packages/twopoint5d/src/vertex-objects/selectBuffers.spec.ts`,
  `packages/twopoint5d/src/vertex-objects/selectAttributes.spec.ts`,
  `packages/twopoint5d/src/texture/TextureAtlas.spec.ts`,
  `apps/lookbook/src/demos/animated-sprites/BouncingSprites.ts`,
  `apps/lookbook/src/demos/animated-billboards/BouncingSprites.ts`,
  `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts`,
  `apps/lookbook/src/components/TagCloudFilter.astro`,
  `apps/lookbook/src/components/DemoNavBar.astro`,
  `apps/lookbook/src/components/SearchLookbook.astro`,
  `apps/lookbook/src/pages/demos/animated-billboards.astro`,
  `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro`
  — zwölf Dateien, kein Produktivcode der Bibliothek, keine `public-api.ts`.
- Vorgehen:

  Jeder Schritt nennt die Zeile vorher und die Zeile nachher. Alle Zeilennummern sind gegen
  `de936e4` gemessen; wo ein Schritt Zeilen einfügt, verschieben sich die folgenden
  Nummern derselben Datei, deshalb steht überall der Text und nicht nur die Nummer.
  Die ganze Fassung unten ist am 2026-09-04 in einem Probe-Arbeitsbaum gefahren worden:
  `astro check` 0 Fehler (58 Dateien, der eine bekannte `hint` bleibt), Vitest 45 Dateien /
  788 Tests grün, `tsc -p packages/twopoint5d/tsconfig.typecheck.json` exit 0, `eslint .`
  exit 0, `prettier --check` sauber. Der Diff dieses Laufs liegt im Arbeitsverzeichnis als
  `p13-probe.diff` (12 Dateien, +49/−43). Er ist Beleg und nicht Auftrag: maßgeblich sind
  die Schritte unten, und wer eine Stelle anders lösen will als hier steht, meldet das,
  statt es zu tun.

  1. **`VertexObjectDescriptor.spec.ts` — sechs Zusicherungen auf Gleichheit.** In allen
     drei Tests wird `expect.arrayContaining(…)` und `toMatchObject(…)` durch die
     ausgeschriebene Liste ersetzt. **Die Reihenfolge im dritten Test ist umgekehrt** —
     siehe Korrektur 2 oben, sie ist gemessen und kein Tippfehler:

     ```
     Zeile 34  → expect(Array.from(descriptor.attributeNames.values())).toEqual(['foo', 'bar', 'plah']);
     Zeile 35  → expect(Array.from(descriptor.bufferNames.values())).toEqual(['dynamic_float32', 'static_float32']);
     Zeile 62  → expect(Array.from(descriptor.attributeNames.values())).toEqual(['foo', 'bar']);
     Zeile 63  → expect(Array.from(descriptor.bufferNames.values())).toEqual(['static_float32']);
     Zeile 87  → expect(Array.from(descriptor.attributeNames.values())).toEqual(['foo', 'bar']);
     Zeile 88  → expect(Array.from(descriptor.bufferNames.values())).toEqual(['static_float32', 'dynamic_float32']);
     ```

     Die Reihenfolge ist kein Zufall, den der Test einfriert: `attributes` ist eine `Map`,
     `bufferNames` ein `Set`, beide in der Deklarationsreihenfolge des Deskriptors gefüllt.
     Genau das soll die Zusicherung sagen.
  2. **`selectBuffers.spec.ts` — zwei Listen ausschreiben, zwei Gegenproben streichen.**
     Der Block in den Zeilen 40-45 lautet danach:

     ```ts
     expect(selectBuffers(geometry.buffers, {dynamic: true})).toEqual([
       geometry.buffers.get('dynamic_float32'),
       geometry.buffers.get('dynamic_uint32'),
     ]);
     ```

     Das `not.toEqual(expect.arrayContaining([… 'static_float32' …]))` darunter entfällt
     ersatzlos: was die Liste vollständig aufzählt, braucht keine Aussage darüber, was
     nicht darin steht. Ebenso der letzte Block der Datei:

     ```ts
     expect(
       selectBuffers(geometry.buffers, {
         dynamic: true,
         static: true,
         stream: true,
       }),
     ).toEqual([
       geometry.buffers.get('dynamic_float32'),
       geometry.buffers.get('dynamic_uint32'),
       geometry.buffers.get('static_float32'),
     ]);
     ```

     `expect(selectBuffers(geometry.buffers, {static: true})).toMatchObject([…])` dazwischen
     bleibt unverändert.
  3. **`selectAttributes.spec.ts` — dieselbe Bewegung, einmal.** Der Block am Ende der Datei:

     ```ts
     expect(selectAttributes(geometry.pool, geometry.buffers, ['position', 'impact'])).toEqual([
       geometry.buffers.get('dynamic_float32'),
       geometry.buffers.get('dynamic_uint32'),
     ]);
     ```

     Das `not.toEqual(…)` darunter entfällt. Die drei `toMatchObject([…])` weiter oben
     bleiben.
  4. **`TextureAtlas.spec.ts` — drei Listen, zwei Gegenproben.** In `frameNames`-Test »with
     regexp« und »with string« steht danach je `expect(names).toEqual(['img_001', 'img_002']);`
     und das `expect(names).toEqual(expect.not.arrayContaining(['foo', Bar]));` darunter
     entfällt. Im Test »without argument«:
     `expect(names).toEqual(['foo', Bar, 'img_001', 'img_002']);` — der Symbol-Eintrag `Bar`
     gehört dazu und steht an zweiter Stelle, das ist die Einfügereihenfolge der vier
     `atlas.add()` darüber. Die vier `atlas.frameNames('…')`-Zeilen mit `toMatchObject` und
     die `expect(Array.isArray(names)).toBeTruthy()`-Zeilen bleiben unangetastet.
  5. **Die drei `createVO()`-Casts.** Jeweils eine Zeile wird zu drei. In
     `apps/lookbook/src/demos/animated-sprites/BouncingSprites.ts:46`:

     ```ts
     const sprite = this.spritePool.createVO() as Sprite | undefined;
     // the loop bound was capped to the free capacity above, so this only guards the pool
     if (sprite == null) break;
     ```

     In `apps/lookbook/src/demos/animated-billboards/BouncingSprites.ts:57` und in
     `apps/lookbook/src/demos/textured-sprites/BouncingSprites.ts:56` (dort heißt der Typ
     `BounceSprite`) steht statt des Kommentars:

     ```ts
     // a full pool has no sprite left to hand out; stop instead of pushing a hole into the list
     ```

     Der Unterschied ist der Sache geschuldet: `animated-sprites` deckelt `count` dreißig
     Zeilen vorher auf die freie Kapazität, die beiden anderen tun das nicht — dort ist der
     Wächter kein Typ-Zugeständnis, sondern der Fix. Ohne ihn schiebt die Schleife heute
     `undefined` in `this.sprites`, und `animate()` bricht daran.
  6. **Die vier DOM-Casts.** Je ein Kommentar davor, `as` weg, Typargument an
     `querySelector`, `!` ans Ende:

     ```ts
     // apps/lookbook/src/components/DemoNavBar.astro:162
     // the dialog is written by the markup of this component
     const dialog = document.querySelector<HTMLDialogElement>('dialog.show-source-dialog')!;

     // apps/lookbook/src/components/SearchLookbook.astro:65
     // the dialog is written by the markup of this component
     const dialog = document.querySelector<HTMLDialogElement>('dialog.search-lookbook-dialog')!;

     // apps/lookbook/src/components/TagCloudFilter.astro:132
     // the <button class="clear-tags-action"> is written by the markup of this component
     const getClearTagsAction = () => document.querySelector<HTMLButtonElement>('.tags .clear-tags-action')!;

     // apps/lookbook/src/pages/demos/animated-billboards.astro:119
     // the <div class="loading-wrapper"> is written by the markup of this very page
     document.querySelector<HTMLDivElement>('.loading-wrapper')!.style.display = 'none';
     ```

     Die letzte verliert dabei ihre Klammern um den Ausdruck; sie waren nur für den Cast da.
  7. **Das `(event: any)` in `TagCloudFilter.astro`.** Zwei Änderungen, die
     zusammengehören. Zuerst Zeile 158 (`const $tagCloud = …`):

     ```ts
     const $tagCloud = document.querySelectorAll<HTMLElement>(CSS_TAG_CLOUD_FILTER);
     ```

     Damit sieht `addEventListener('pointerdown', …)` die `HTMLElementEventMap` und
     typisiert den Parameter von sich aus als `PointerEvent` — die Annotation entfällt
     ersatzlos, statt durch eine andere ersetzt zu werden. Dann der Kopf des Handlers
     (heute Zeile 187-190):

     ```ts
     (event) => {
       const $tag = event.target;
       if (event.isPrimary && event.button === 0 && $tag instanceof HTMLElement && $tag.hasAttribute(ATTR_TAG)) {
         // every tag cloud sits inside the <section class="tags"> of this component
         const $container = $el.parentElement!;
     ```

     `$el.parentElement` ist derselbe Knoten wie das bisherige `$tag.parentNode.parentNode`:
     `$el` ist das `<ul class="tag-cloud-filter">`, auf dem der Listener hängt, `$tag` das
     `<li class="tag">` darin, und Astro-Fragmente erzeugen kein Element — beide Wege enden
     auf dem `<section class="tags">`. Der Weg über `$el` hängt zusätzlich nicht mehr daran,
     wie tief das Ziel des Klicks liegt. Der Rest des Handlers ab
     `const $allTags = …` bleibt Zeile für Zeile, wie er ist.
  8. **Der `sample`-Helfer.** In
     `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro:47`:

     ```ts
     // Math.random() stays below 1, so the index is inside a non-empty array
     function sample<T>(arr: T[]): T {
       return arr[Math.floor(Math.random() * arr.length)]!;
     }
     ```

     Das `!` ist unter `noUncheckedIndexedAccess` nötig und hält die Invariante fest, die
     der Kommentar benennt. Der Aufruf `const texCoords = sample(frames);` bleibt, wie er
     ist, und liefert danach `TextureCoords` statt `any` — die vier Zugriffe `.s/.t/.u/.v`
     in der Zeile darunter sind damit geprüft. Nichts anderes in der Datei wird angefasst.
  9. **Kein Regressionstest.** Dieses Paket behebt keinen Korrektheitsfehler an
     Bibliothekscode; sieben der neun Lookbook-Stellen sind reine Typsache, und die beiden
     übrigen — der fehlende Wächter in den ungedeckelten `createSprites()` von
     `animated-billboards/` und `textured-sprites/` — sitzen in Demo-Code der Lookbook, den
     weder Vitest noch die Browsersuite fährt. Der Nachweis
     dieses Pakets ist der Typprüfer: `astro check` sieht die Stellen ab jetzt, und vor
     Schritt 5 sah es sie nicht. Wer dafür einen roten Lauf sucht, findet ihn, indem er nur
     die Casts entfernt: 28 Fehler in den zwei Dateien, gemessen in Zug 0 von Paket 11.
     Der stumpfe Gegenbeweis zu Schritt 1 dagegen gehört gefahren und in den Report:
     `toEqual(['dynamic_float32', 'static_float32'])` an Zeile 88 statt der gemessenen
     Reihenfolge macht »construct with attributes only« rot.
- Verify: zwei Läufe, wie Paket 11, 11a und 12 sie gefahren haben.
  `pnpm lint && pnpm build && pnpm typecheck && pnpm checkPkgTypes && pnpm lintPkg && pnpm test:ci`
  ist das Gate und muss auf `exit=0` enden; sein Log ist das, was in `verify_log` genannt
  wird. Danach `pnpm test:browser` **getrennt** in ein zweites Log: die Suite endet wegen
  Firefox auf `exit=1`, und ihr Maßstab sind die Zahlen unter »Vorbestehende Fehler«
  (Chromium 0 Fehler, Firefox 24, `getSupportedExtensions` 92-mal), nicht ihr Exit-Code.
  In einer `&&`-Kette risse sie das Gate mit. Erwartung: die Vitest-Runde bleibt bei
  45 Dateien und 788 Tests, `pnpm typecheck` bleibt bei 0 Fehlern über 58 Lookbook-Dateien
  plus dem bekannten `hint` in `PerspectiveOrbitDemo.ts:38`, und die Browsersuite bewegt
  sich nicht — der Diff fasst keine Zeile Produktivcode der Bibliothek an.
- Commit: `test(lookbook): assert the whole list and stop hiding what may be missing`
- Ergebnis: 1 Runde · alle dreizehn Fundstellen umgesetzt, sechs Zusicherungen in
  `VertexObjectDescriptor.spec.ts` und je eine Liste in `selectBuffers.spec.ts`,
  `selectAttributes.spec.ts` und `TextureAtlas.spec.ts` auf `toEqual` gebracht, vier
  Gegenproben ersatzlos gestrichen · drei `createVO()`-Casts geben `… | undefined` und
  bekommen einen Wächter, vier DOM-Casts stehen als `querySelector<T>(…)!` mit Satz
  darüber, `(event: any)` und der generische Pfeil sind weg · kein Regressionstest, statt
  seiner der Gegenbeweis zu Schritt 1: `toEqual(['dynamic_float32', 'static_float32'])` an
  Zeile 88 macht »construct with attributes only« rot (gefahren, Ausgabe im Report
  `paket-13.impl-1.json`), danach zurückgenommen · Reviewer ohne kritischen und ohne
  wichtigen Befund · klein: in der Lookbook stehen vier `as HTML*`-Casts derselben Familie
  außerhalb der zwölf Dateien, siehe »Offene Befunde« · Gate `exit=0`
  (`paket-13.verify.log`), Browsersuite unverändert bei Chromium 0 / Firefox 24 /
  `getSupportedExtensions` 92 (`paket-13.browser.log`)
- Nebenbefunde: → Queue
- Folgen: —
- Schnittstellen: — (Specs und Lookbook-Code, keine Zeile der veröffentlichten Oberfläche)

### [x] 14. Jeder Typ der veröffentlichten Oberfläche wird benennbar

- Nebenbefund: `packages/twopoint5d/src/texture/TextureAtlas.ts:12` (low) ·
  `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:6,12` (low) ·
  dazu 29 weitere Deklarationen derselben Ursache, in Zug 0 mit dem Compiler gemessen
  (Tabelle unter »Vorgehen«)
- Ziel: Jeder Typ, der im veröffentlichten `.d.ts` einer öffentlichen Signatur steht,
  lässt sich von außen benennen.
- Bereich: `packages/twopoint5d/src/` — `controls/`, `display/`, `map2d/`,
  `map2d/chunk-quad-tree/`, `stage/`, `texture/`, `vertex-objects/` samt zwei
  `public-api.ts`
- Hängt ab von: —
- Hash: 0a6287c
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `controls/public-api.ts`, `display/public-api.ts`, `display/Display.ts`, `display/FrameLoop.ts`,
  `map2d/CameraBasedVisibility.ts`, `map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`,
  `map2d/chunk-quad-tree/DataIdsChunk2D.ts`, `stage/StageRenderer.ts`,
  `texture/FrameBasedAnimations.ts`, `texture/PowerOf2ImageLoader.ts`,
  `texture/TextureAtlas.ts`, `texture/TextureAtlasLoader.ts`,
  `texture/TextureImageLoader.ts`, `texture/TextureStore.ts`,
  `texture/TileSetLoader.ts`, `texture/types.ts`,
  `vertex-objects/InstancedVOBufferGeometry.ts`, `vertex-objects/VOBufferGeometry.ts`,
  `vertex-objects/VertexObjectBuffer.ts`, `vertex-objects/types.ts`
  (alle unter `packages/twopoint5d/src/`)

- Vorgehen:

  1. **Den roten Lauf messen und in den Report schreiben.** Im Arbeitsverzeichnis liegt
     `nameable2.mjs`; es lädt `packages/twopoint5d/dist/lib/index.d.ts` mit der
     TypeScript-Compiler-API, nimmt die Menge der von dort exportierten Symbole und
     meldet jede Deklaration aus dem Repo, die in einer dieser exportierten
     Deklarationen referenziert wird, ohne selbst darin zu stehen — transitiv, bis die
     Menge stabil ist.

         pnpm build && node /tmp/claude-1000/-home-spw-spaceland-twopoint5d/68198165-a575-487c-966b-ed0842928a1d/scratchpad/nameable2.mjs

     Vor der Änderung meldet es **34 Zeilen** (Stand `2cbedc2`). Diese Ausgabe gehört in
     den Report; sie ist der Nachweis, den dieses Paket statt eines Regressionstests
     führt — es ändert keine Zeile Laufzeitverhalten, es gibt nichts rot zu bekommen.

  2. **Zwei Lücken im Barrel schließen.** Zwei Klassen sind in ihrer Datei exportiert,
     stehen aber in keiner `public-api.ts`, obwohl die öffentliche Oberfläche sie
     nennt — `Display#frameLoop` ist vom Typ `FrameLoop`, `PanControl2D` erbt von
     `InputControlBase`. Beide Dateien exportieren genau ein Symbol, ein `export *`
     zieht also nichts Weiteres mit:

     - `controls/public-api.ts`: `export * from './InputControlBase.js';`
     - `display/public-api.ts`: `export * from './FrameLoop.js';` (alphabetisch, also
       hinter `FixedFrameLoop.js` — »Fi« sortiert vor »Fr«)

  3. **Zehn Deklarationen umbenennen und exportieren.** Umbenannt wird nur, wo der
     bisherige Name als Export der Bibliothek entweder doppelt vorkäme oder einen
     bekannten fremden Namen verdeckte; alles andere behält seinen Namen. Die vier
     Loader tragen dieselben zwei Namen und würden sich im Barrel von `texture/`
     gegenseitig verdrängen, `BufferAttribute` verdeckt den three.js-Typ gleichen
     Namens (den `vertex-objects/types.ts` nebenan in `BufferLike` meint), und `Buffer`
     verdeckt den globalen Node-Typ. Keiner der zehn Namen wird heute außerhalb seiner
     eigenen Datei benutzt, es gibt also keine Aufrufer nachzuziehen — was der
     Implementierer trotzdem prüft, bevor er die Datei verlässt.

     | Datei (unter `packages/twopoint5d/src/`) | Zeile | bisher | künftig |
     | --- | --- | --- | --- |
     | `texture/PowerOf2ImageLoader.ts` | 11 | `OnImageLoadCallback` | `PowerOf2ImageLoadCallback` |
     | `texture/PowerOf2ImageLoader.ts` | 12 | `OnErrorCallback` | `PowerOf2ImageLoadErrorCallback` |
     | `texture/TextureAtlasLoader.ts` | 16 | `OnLoadCallback` | `TextureAtlasLoadCallback` |
     | `texture/TextureAtlasLoader.ts` | 17 | `OnErrorCallback` | `TextureAtlasLoadErrorCallback` |
     | `texture/TextureImageLoader.ts` | 13 | `OnLoadCallback` | `TextureImageLoadCallback` |
     | `texture/TextureImageLoader.ts` | 14 | `OnErrorCallback` | `TextureImageLoadErrorCallback` |
     | `texture/TileSetLoader.ts` | 15 | `OnLoadCallback` | `TileSetLoadCallback` |
     | `texture/TileSetLoader.ts` | 16 | `OnErrorCallback` | `TileSetLoadErrorCallback` |
     | `vertex-objects/VertexObjectBuffer.ts` | 6 | `BufferAttribute` | `AttributeBufferLayout` |
     | `vertex-objects/VertexObjectBuffer.ts` | 12 | `Buffer` | `AttributeBuffer` |

     Die beiden letzten lesen sich an ihren drei Feldern als
     `readonly buffers: Map<string, AttributeBuffer>`,
     `readonly bufferAttributes: Map<string, AttributeBufferLayout>` und
     `readonly bufferNameAttributes: Map<string, AttributeBufferLayout[]>`: ein
     `AttributeBuffer` ist ein typisiertes Array samt Layout, ein
     `AttributeBufferLayout` sagt, wo ein Attribut darin liegt. Auch das `Omit<Buffer,
     'typedArray'>` an Zeile 74 zieht mit.

  4. **Achtzehn Deklarationen exportieren, Name unverändert.** Nur das Schlüsselwort
     `export` davor:

     | Datei (unter `packages/twopoint5d/src/`) | Zeile | Deklaration |
     | --- | --- | --- |
     | `display/Display.ts` | 45 | `DisplayEventListener` |
     | `display/FrameLoop.ts` | 3 | `ISetAnimationLoop` |
     | `display/FrameLoop.ts` | 8 | `OnRAF` |
     | `map2d/CameraBasedVisibility.ts` | 9 | `TileBox` |
     | `map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` | 4 | `Quadrant` |
     | `map2d/chunk-quad-tree/ChunkQuadTreeNode.ts` | 11 | `IChunkQuadTreeChildNodes` |
     | `map2d/chunk-quad-tree/DataIdsChunk2D.ts` | 4 | `StringDataIdsChunk2DParams` |
     | `map2d/chunk-quad-tree/DataIdsChunk2D.ts` | 9 | `Uint32DataIdsChunk2DParams` |
     | `stage/StageRenderer.ts` | 26 | `StageItem` |
     | `texture/FrameBasedAnimations.ts` | 7 | `AnimName` |
     | `texture/TextureAtlas.ts` | 10 | `TextureAtlasArgs` |
     | `texture/TextureAtlas.ts` | 12 | `TextureAtlasFrameName` |
     | `texture/TextureAtlas.ts` | 14 | `NamedTextureAtlasArgs` |
     | `texture/TextureStore.ts` | 15 | `TextureResourceSubTypeMap` |
     | `texture/TextureStore.ts` | 26 | `MapTuple` |
     | `texture/TextureStore.ts` | 37 | `MapSubTypes` |
     | `texture/types.ts` | 22 | `FrameBasedAnimationsTimingData` |
     | `vertex-objects/InstancedVOBufferGeometry.ts` | 21 | `TouchInstancedBuffersType` |

     `OnRAF` ist ein Symbol und wird wie `voBuffer`, `voIndex` und `voInitialize` in
     `vertex-objects/constants.ts` exportiert: es steht als berechneter Methodenname im
     `.d.ts` von `FrameLoop`, und ohne den Export kann niemand diese Methode benennen.
     `Quadrant` ist ein `enum` und damit ein Laufzeitwert; der Export ist gewollt, denn
     `IChunkQuadTreeChildNodes` ist ein Mapped Type über genau diesen Schlüsseln.

  5. **`TouchBuffersType` zusammenführen statt zweimal benennen.**
     `vertex-objects/VOBufferGeometry.ts:15` und
     `vertex-objects/InstancedVOBufferGeometry.ts:19` deklarieren wörtlich denselben Typ
     `{[Type in VertexAttributeUsageType]?: boolean}`. Beide zu exportieren, gäbe zwei
     gleichnamige Exporte im Barrel von `vertex-objects/`; sie unterschiedlich zu
     benennen, gäbe zwei Namen für eine Sache. Also: die Deklaration einmal nach
     `vertex-objects/types.ts` (dort steht `VertexAttributeUsageType` bereits), dort
     `export`, und beide Geometrie-Dateien holen sie über
     `import type {TouchBuffersType} from './types.js';`. Ein erneutes Re-Export in den
     beiden Dateien gibt es nicht — `vertex-objects/public-api.ts` führt `types.js`
     schon.

  6. **Zwei Zeilen bleiben absichtlich stehen.** Nach der Änderung meldet das Skript aus
     Schritt 1 noch genau diese zwei, und beide sind kein Mangel:

     - `TextureFactory.ts:23` `TextureClasses` — eine private Nachschlagetabelle, kein
       Typ in einer Signatur. Was ein Konsument benennt, ist
       `TextureOptionClasses = keyof typeof TextureClasses`, und das ist exportiert und
       löst sich zu einer Union von String-Literalen auf.
     - `FrameLoop.d.ts` `OnFrame` — ein statisches Feld der Klasse, ab Schritt 2 als
       `FrameLoop.OnFrame` benennbar. Das Skript kennt nur Modul-Exporte und meldet
       Klassenmitglieder deshalb mit.

     Meldet der Lauf **darüber hinaus** etwas, gehört es in dieses Paket: es ist
     dieselbe Ursache, nur eine Ebene tiefer freigelegt. Die Zeilennummern verschieben
     sich durch die Änderung, verglichen wird also über die Namen.

  7. **Was dieses Paket nicht tut.** Es benennt nicht neu, was benennbar wird. Namen wie
     `MapTuple`, `MapSubTypes`, `StageItem` oder `TileBox` sind als Paket-Exporte
     generisch, kollidieren aber mit nichts und verdecken nichts — sie bleiben, wie sie
     sind. `AnimName` und `TextureAtlasFrameName` sind beide `string | symbol` und
     bleiben trotzdem zwei Aliase: sie zusammenzulegen wäre ein Umbau an zwei
     öffentlichen Oberflächen und steht in keinem Auftrag. Und es wird keine neue
     Prüfung ins Gate gehängt; dass diese Lücke ungedeckt ist, steht als eigener
     Eintrag unter »Offene Befunde«.

- Verify: zwei Läufe, wie Paket 11, 11a, 12 und 13 sie gefahren haben.
  `pnpm lint && pnpm build && pnpm typecheck && pnpm checkPkgTypes && pnpm lintPkg && pnpm test:ci`
  ist das Gate und muss auf `exit=0` enden; sein Log ist das, was in `verify_log` genannt
  wird. Danach `pnpm test:browser` **getrennt** in ein zweites Log: die Suite endet wegen
  Firefox auf `exit=1`, und ihr Maßstab sind die Zahlen unter »Vorbestehende Fehler«
  (Chromium 0 Fehler, Firefox 24, `getSupportedExtensions` 92-mal), nicht ihr Exit-Code.
  In einer `&&`-Kette risse sie das Gate mit. Erwartung: die Vitest-Runde bleibt bei
  45 Dateien und 788 Tests, `pnpm typecheck` bleibt bei 0 Fehlern über 58 Lookbook-Dateien
  plus dem bekannten `hint` in `PerspectiveOrbitDemo.ts:38`, und die Browsersuite bewegt
  sich nicht — der Diff ändert kein Laufzeitverhalten. `checkPkgTypes` und `lintPkg` waren
  gegen diese Lücke schon vorher blind und bleiben es; sie belegen nur, dass die neuen
  Exporte das gebaute `dist/` nicht beschädigen.
- Commit: `feat(twopoint5d): export every type the published surface refers to`
- Ergebnis: 1 Runde · alle 31 Deklarationen benennbar gemacht · statt eines
  Regressionstests der Messlauf `nameable2.mjs` gegen `dist/lib/index.d.ts`: vorher 34
  nicht benennbar bei 240 Exporten, nachher 2 bei 271, und die zwei sind die im Vorgehen
  als gewollt benannten (`FrameLoop.OnFrame`, `TextureClasses` über `typeof`) · Reviewer
  hat den Messlauf selbst reproduziert · Gate `exit=0` (`paket-14.verify.log`), Vitest
  45 Dateien / 788 Tests ohne Nx-Cache nachgemessen, Browsersuite deckungsgleich mit der
  Baseline (24 Fehler, 0 auf Chromium, `getSupportedExtensions` 92-mal,
  `paket-14.browser.log`) · Abweichung vom Detailplan: `export * from './FrameLoop.js'`
  steht hinter `FixedFrameLoop.js`, weil die im Plan genannte Position dem im selben Satz
  genannten alphabetischen Kriterium widersprach — der Plantext ist entsprechend korrigiert
  · klein: `vertex-objects/selectBuffers.ts:5-9` schreibt dieselbe Typform weiterhin inline
  aus (als Nebenbefund in der Queue) · klein: der neue Docblock an
  `vertex-objects/types.ts:22` beschreibt den Upload-Zeitpunkt ungenauer als
  `VOBufferGeometry.ts:94` und nennt die Auswertungsregel nicht, dass nur `=== true`
  selektiert
- Nebenbefunde: → Queue (8 Einträge, alle vorbestehende Code-Findings → Audit)
- Folgen: —
- Schnittstellen: 31 neue Exporte der veröffentlichten Oberfläche, rein additiv, keine
  Kollision mit den 240 bestehenden Symbolen. Neu benennbar unter anderem
  `InputControlBase`, `FrameLoop`, `DisplayEventListener`, `ISetAnimationLoop`, `OnRAF`,
  `TileBox`, `Quadrant`, `IChunkQuadTreeChildNodes`, `StringDataIdsChunk2DParams`,
  `Uint32DataIdsChunk2DParams`, `StageItem`, `AnimName`, `TextureAtlasArgs`,
  `TextureAtlasFrameName`, `NamedTextureAtlasArgs`, `TextureResourceSubTypeMap`,
  `MapTuple`, `MapSubTypes`, `FrameBasedAnimationsTimingData`, `TouchInstancedBuffersType`.
  Umbenannt und dabei exportiert: `PowerOf2ImageLoadCallback` und
  `PowerOf2ImageLoadErrorCallback` (`texture/PowerOf2ImageLoader.ts`),
  `TextureAtlasLoadCallback`/`TextureAtlasLoadErrorCallback`,
  `TextureImageLoadCallback`/`TextureImageLoadErrorCallback`,
  `TileSetLoadCallback`/`TileSetLoadErrorCallback`, sowie `AttributeBufferLayout` und
  `AttributeBuffer` in `vertex-objects/VertexObjectBuffer.ts` (vormals datei-lokal, kein
  Aufrufer außerhalb der Datei). `TouchBuffersType` steht jetzt genau einmal, in
  `vertex-objects/types.ts:22`; `VOBufferGeometry.ts` und `InstancedVOBufferGeometry.ts`
  importieren ihn von dort.

**Warum aus drei Typen einunddreißig wurden.** Der Grobplan nannte die beiden Einträge,
die diesem Lauf beim Lesen fremder Dateien aufgefallen waren. Zug 0 hat statt zu lesen
gemessen — die Compiler-API über den einzigen Einstiegspunkt des Pakets,
`dist/lib/index.d.ts` — und dabei 34 Deklarationen gefunden, die in der veröffentlichten
Oberfläche vorkommen, ohne von außen benennbar zu sein. Es ist eine Ursache, kein
Dutzend: nichts im Gate prüft diese Eigenschaft, `attw` und `publint` sehen sie
strukturell aufgelöst und schweigen. Drei davon zu beheben und neunundzwanzig liegen zu
lassen, hieße dieselbe Ursache halb zu beheben und die Drain-Runde des Abschlusses ein
zweites, gleichlautendes Paket schneiden zu lassen. Die Änderung ist rein additiv: 31 neue
Namen, keiner kollidiert mit einem der 240 bereits exportierten Symbole, kein bestehender
Aufrufcode ändert sich. Für Semver und CHANGELOG ist das ein Minor.

### [x] 15. Beispielcode, den kein Compiler sieht

- Folge von: Paket 8a
- Findings: — (entsteht aus zwei Fundstellen von Paket 11a, keine Audit-ID)
- Ziel: Wo das Repo Code zum Herauskopieren anbietet, compiliert er unter den Schaltern,
  die im Repo gelten.
- Bereich: `packages/twopoint5d/src/stage/`, `apps/lookbook/src/demos/passes/`,
  `apps/lookbook/src/pages/demos/`
- Hängt ab von: —
- Hash: 5477b26
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/src/stage/README.md`,
  `packages/twopoint5d/src/stage/RootRenderPipeline.ts`,
  `packages/twopoint5d/src/stage/fitIntoRectangle.ts`,
  `apps/lookbook/src/pages/demos/stage-postprocessing.astro`,
  `apps/lookbook/src/demos/passes/fovealVisionEffect.ts`
- Vorgeschichte: Zug 0 von Paket 12 und Zug 0 von Paket 14 haben je geprüft, ob ihr Diff
  eine der bekannten Fundstellen verschiebt, und beide Male nichts gefunden — Paket 12
  fasste vier Prosazeilen an, Paket 14 zwanzig Deklarationszeilen, keine davon in einem
  Docblock oder einem auskommentierten Codestück. Die Suche unten läuft gegen den Stand
  nach beiden.

**Die Suche ist gefahren und abgeschlossen.** Das Repo bietet außerhalb von
`packages/twopoint5d/CHANGELOG.md` — freigegebene Historie, wird nicht angefasst — genau
**19 ` ```ts `-Blöcke** an: fünf in Docblocks (`display/FixedFrameLoop.ts:44`,
`stage/RootRenderPipeline.ts:8`, `stage/fitIntoRectangle.ts:171`, `stage/ClearStage.ts:18`,
`apps/lookbook/src/demos/passes/fovealVisionEffect.ts:10`) und vierzehn in
`packages/twopoint5d/src/stage/README.md`, der einzigen Markdown-Datei unter beiden
`src/`-Bäumen. Die beiden READMEs außerhalb — `README.md` im Root und
`apps/lookbook/README.md` — führen `sh`-Blöcke und einen Verzeichnisbaum, keinen
TypeScript. Dazu 88 auskommentierte Codezeilen unter beiden Bäumen, alle einzeln
angesehen; was davon übrigblieb, steht unten unter »Was geprüft und in Ordnung ist«.

Jeder der 19 Blöcke wurde am 2026-09-04 gegen `0a6287c` compiliert: als eigene Datei in
einem Probebaum unter der Root-`tsconfig.json`, mit `declare const` für die Bezeichner,
die der Text ausdrücklich dem Leser überlässt (`world`, `myScene`, `canvas`, …), und mit
`noUnusedLocals`/`noUnusedParameters` aus — ein Auszug mit `/* … */`-Rümpfen scheiterte
sonst an seiner eigenen Auslassung, und das sagt nichts über den Leser aus, der den Rumpf
ausfüllt. Ergebnis **8 Fehler in 6 der 19 Blöcke** (`paket-15.snippets.vorher.log`); mit
den Fassungen aus »Vorgehen« **0 Fehler, `exit=0`** (`paket-15.snippets.nachher.log`).
Beide Bäume liegen unter `<arbeitsdir>/p15/proberoot/{vorher,nachher}/` und lassen sich
mit `cd <baum> && <repo>/node_modules/.bin/tsc -p tsconfig.json` erneut fahren.

| Fundstelle | Fehler |
| --- | --- |
| `stage/README.md:73` | TS2345 — `{fit: 'contain'}` ohne `width`/`height` ist kein `ParallaxProjectionSpecs` |
| `stage/README.md:375` | 2× TS2420 — die Klasse nennt drei Interfaces und schreibt eins aus |
| `stage/fitIntoRectangle.ts:173` | 2× TS2345 — das Objektliteral verbreitert `fit` und `anchorPosition` zu `string` |
| `stage/RootRenderPipeline.ts:9` | TS2345 — `WebGPURenderer \| undefined` |
| `pages/demos/stage-postprocessing.astro:37` | TS2345 — `Node \| undefined` statt `Node<'vec4'>` |
| `demos/passes/fovealVisionEffect.ts:11` | TS2345 — `Node \| undefined` statt `PassNode` |

Zwei Korrekturen an den bekannten Fundstellen: Die auskommentierte Zeile in
`stage-postprocessing.astro` steht auf **37**, nicht auf 36 — `c3c8edb` hat eine
Kommentarzeile darübergesetzt. Und sie kostet **einen** Fehler, nicht drei; die Zahl drei
war eine Schätzung, keine Messung.

**Die Fassung steht schon im Repo.** `stage/README.md` führt seit `c3c8edb` beide Formen
vor: `display.renderer!` mit einem Satz zur Invariante, und `scenePass as Node<'vec4'>`
— erweitert um `& {add(other: Node): Node}`, wo das Beispiel wirklich addiert. Die
Schritte unten tragen genau diese Form weiter und erfinden keine zweite.

**Was dieses Paket ausdrücklich nicht tut.** Es baut keinen dauerhaften Wächter für
Beispielcode. Kein Schritt des Gates sieht die 19 Blöcke, und ohne Wächter verrottet
dasselbe beim nächsten Schalter wieder — aber ein Extraktor kann die Bezeichner nicht
erfinden, die zwölf der Blöcke dem Leser überlassen, und ihn zu bauen hieße zuerst, eine
Schreibkonvention für Beispiele zu beschließen. Das trägt weiter als ein Paket und steht
als eigener Eintrag mit dem Urteil `→ Rückfrage` unter »Offene Befunde«. Ebenso wenig
fasst dieses Paket die verwaiste `fovealVisionEffect.ts` als Ganzes an (eigener Eintrag),
die fünf toten auskommentierten Blöcke (eigener Eintrag) oder `apps/lookbook/README.md`
(eigener Eintrag).

- Vorgehen:

  1. **`packages/twopoint5d/src/stage/RootRenderPipeline.ts:9`.** Der Docblock zeigt

     ```
      * root.pipeline = new RootRenderPipeline(display.renderer);
     ```

     `Display#renderer` ist als `renderer?: WebGPURenderer` deklariert und wird von
     `dispose()` wieder abgeräumt. Daraus werden zwei Zeilen, wortgleich mit der Form, die
     `stage/README.md:292-295` für dasselbe Beispiel bereits führt:

     ```
      * // a running display holds its renderer; only dispose() takes it away again
      * root.pipeline = new RootRenderPipeline(display.renderer!);
     ```

     Die Zeile `// → pipeline.outputNode = pass0.add(pass1).add(pass2)…` darunter bleibt
     unverändert stehen.

  2. **`packages/twopoint5d/src/stage/fitIntoRectangle.ts:173`.** Die Zeile

     ```
      * const specs = { fit: 'contain', width: 640, height: 480, anchorPosition: 'top center' };
     ```

     lässt TypeScript `fit` und `anchorPosition` zu `string` verbreitern, womit weder
     `fitIntoRectangle(rect, specs)` noch `calculateAnchorOffset(…, specs.anchorPosition)`
     durchgeht. Ein `as const` bindet beide an ihr Literal und kostet nichts:

     ```
      * const specs = {fit: 'contain', width: 640, height: 480, anchorPosition: 'top center'} as const;
     ```

     Die inneren Leerzeichen entfallen dabei, weil `bracketSpacing` in `.prettierrc` auf
     `false` steht und jede andere Objektschreibweise im Repo ohne sie auskommt.

  3. **`apps/lookbook/src/pages/demos/stage-postprocessing.astro:37`.** Die
     auskommentierte Alternative

     ```
       // stageRenderer.buildOutputNode = ([scenePass]) => bloom(scenePass, 1.2, 0.6, 0.0);
     ```

     zeigt einen anderen Effekt als die Fassung darunter — `bloom` ersetzt das Bild, statt
     darauf addiert zu werden —, sie ist also eine echte Alternative und bleibt stehen. Sie
     bekommt denselben Cast, den die Fassung darunter drei Zeilen tiefer schon trägt:

     ```
       // stageRenderer.buildOutputNode = ([scenePass]) => bloom(scenePass as Node<'vec4'>, 1.2, 0.6, 0.0);
     ```

     `Node` steht in dieser Datei bereits als `type Node` im Import aus `three/webgpu`
     (Zeile 24); es kommt keine Importzeile dazu.

  4. **`apps/lookbook/src/demos/passes/fovealVisionEffect.ts:9-12`.** Der Docblock zeigt

     ```
      * Call as a single positional `Fn` argument:
      * ```ts
      * stageRenderer.buildOutputNode = ([scenePass]) => fovealVisionEffect(scenePass);
      * ```
     ```

     `fovealVisionEffect` nimmt einen `ReturnType<typeof pass>`, und `buildOutputNode`
     liefert unter `noUncheckedIndexedAccess` ein `Node | undefined`. Der Block wird zu:

     ```
      * Call as a single positional `Fn` argument:
      * ```ts
      * import type {PassNode} from 'three/webgpu';
      *
      * // the composer gets one pass node per stage; this renderer was given a single stage
      * stageRenderer.buildOutputNode = ([scenePass]) => fovealVisionEffect(scenePass as PassNode);
      * ```
     ```

     `PassNode` ist der Name, den der Compiler in seiner Fehlermeldung selbst nennt, und
     `three/webgpu` exportiert ihn — im Probebaum nachgemessen. Der Rumpf der Datei ab
     Zeile 14 wird nicht angefasst.

  5. **`packages/twopoint5d/src/stage/README.md:73`**, der erste Codeblock des Dokuments:

     ```
     const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain'}));
     ```

     `ParallaxProjectionSpecs` verlangt zu `fit: 'contain'` eine Auflösung. Die Zahlen
     kommen aus den Demos der Lookbook, die durchweg 800×600 als Designauflösung führen:

     ```
     const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 800, height: 600}));
     ```

  6. **`packages/twopoint5d/src/stage/README.md:375-379`.** Der Block zeigt

     ```ts
     class MyStage implements IStage, IRenderable, IPassProvider {
       // … as above …
       asPassNode(renderer: WebGPURenderer) { return pass(myScene, myCamera); }
     }
     ```

     Ein Kommentar erfüllt kein Interface: die Klasse nennt drei und schreibt eins aus.
     Die vier Glieder aus dem Block darüber (`README.md:357-366`) werden ausgeschrieben,
     mit demselben Auslassungszeichen im Rumpf, das der Block darüber schon verwendet:

     ```ts
     class MyStage implements IStage, IRenderable, IPassProvider {
       name = 'my';
       resize(w: number, h: number) { /* … as above … */ }
       updateFrame(now: number, dt: number, frameNo: number) { /* … as above … */ }
       renderTo(renderer: WebGPURenderer) { /* … as above … */ }

       asPassNode(renderer: WebGPURenderer) { return pass(myScene, myCamera); }
     }
     ```

     Dazu über `import {pass} from 'three/tsl';` eine Zeile
     `import type {IPassProvider} from '@spearwolf/twopoint5d';` — der Name wird hier zum
     ersten Mal im Dokument gebraucht, und der Block darüber importiert nur `IStage` und
     `IRenderable`. Der Fließtext davor (»To make it work inside a parent pipeline's
     `buildOutputNode`, also implement `IPassProvider`«) bleibt, wie er ist.

  7. **`packages/twopoint5d/src/stage/README.md:229`.** Die Zeile

     ```
     `StageRenderer` integrates with `three.RenderPipeline` in two ways:
     ```

     kündigt eine Aufzählung an und liefert einen Typ-Exkurs; die beiden Wege stehen erst
     zwei Absätze später als eigene Überschriften. Der Doppelpunkt weicht dem, was er
     verspricht:

     ```
     `StageRenderer` integrates with `three.RenderPipeline` in two ways — Mode C lets the
     pipeline sample an internal render target, Mode D composes the pass nodes into a TSL
     graph yourself.
     ```

  8. **`packages/twopoint5d/src/stage/README.md:236-237`.** Der Satz »One cast per pass
     covers both« gilt nur für Mode E: dort trägt der Cast beides, in Mode D
     (`README.md:269`) steht nur `Node<'vec4'>`, ohne die Operatoren. Die beiden Zeilen

     ```
     runtime are visible to the static type. One cast per pass covers both, and the
     comment next to it names the reason the pass is there at all.
     ```

     werden zu:

     ```
     runtime are visible to the static type. Each example casts for what it needs —
     `Node<'vec4'>` alone where it only feeds the pass onward, plus `.add()` where it
     composes — and the comment next to the cast names the reason the pass is there at all.
     ```

  9. **Gegenmessen, bevor das Gate läuft.** Der Probebaum unter
     `<arbeitsdir>/p15/proberoot/nachher/` trägt alle 19 Blöcke in der Fassung, die die
     Schritte 1-8 herstellen. Nach den Änderungen wird er gegen die Dateien im Baum
     gehalten: jeder geänderte Block muss zeichengleich mit seiner Probedatei sein, bis
     auf die `declare const`-Präambel und die Kommentarsterne des Docblocks. Weicht ein
     Block ab, gehört die abweichende Fassung in den Probebaum und der Lauf noch einmal
     gefahren — die Zahl im Report ist die aus einem eigenen `tsc`-Lauf, nicht die aus
     diesem Plan.

- Verify: zwei Läufe, wie Paket 11, 11a, 12, 13 und 14 sie gefahren haben.
  `pnpm lint && pnpm build && pnpm typecheck && pnpm checkPkgTypes && pnpm lintPkg && pnpm test:ci`
  ist das Gate und muss auf `exit=0` enden; sein Log ist das, was in `verify_log` genannt
  wird. Danach `pnpm test:browser` **getrennt** in ein zweites Log: die Suite endet wegen
  Firefox auf `exit=1`, und ihr Maßstab sind die Zahlen unter »Vorbestehende Fehler«
  (Chromium 0 Fehler, Firefox 24, `getSupportedExtensions` 92-mal), nicht ihr Exit-Code.
  In einer `&&`-Kette risse sie das Gate mit. Erwartung: die Vitest-Runde bleibt bei
  45 Dateien und 788 Tests, `pnpm typecheck` bleibt bei 0 Fehlern über 58 Lookbook-Dateien
  plus dem bekannten `hint` in `PerspectiveOrbitDemo.ts:38`, und die Browsersuite bewegt
  sich nicht — von den fünf Dateien trägt nur `stage-postprocessing.astro` Laufzeitcode,
  und dort ändert sich eine Kommentarzeile. Der dritte Lauf ist der Probebaum aus
  Schritt 9; er gehört nicht ins Gate, aber seine beiden Zahlen (8 vorher, 0 nachher)
  gehören in den Report.
- Commit: `docs(twopoint5d): make the copyable examples compile`

**Was geprüft und in Ordnung ist.** Damit niemand dieselbe Suche zweimal fährt — dies ist
der Rest der 19 Blöcke und der 88 auskommentierten Zeilen, jeder Punkt angesehen und
bewusst gelassen:

- 13 der 19 Blöcke compilieren unverändert: `display/FixedFrameLoop.ts:44`,
  `stage/ClearStage.ts:18` und die zwölf übrigen in `stage/README.md`. Die vier, die
  `c3c8edb` bereits angefasst hat (`README.md:246,262,292,309`), sind darunter.
- `packages/twopoint5d/src/texture/types.ts:15-20` trägt ein `@example` ohne Fence, das
  zwei Objektliterale zeigt (`{ duration: 0.5 }`, `{ frameRate: 20 }`). Es ist kein
  Programmstück, sondern die Illustration einer Union; ein ` ```ts `-Zaun darum behauptete
  eine Compilierbarkeit, die ein Ausdruck ohne Kontext nicht haben kann. Bleibt.
- `apps/lookbook/src/pages/demos/display-multi.astro:100` (`// display.pixelZoom = 2;`)
  und `apps/lookbook/src/demos/map2d-cam-visi.ts:106` (`// tileSprites.update();`) sind
  abgeschaltete, aber gültige Zeilen — `Display#pixelZoom` steht in `Display.ts:183`,
  `update()` erbt `TileSprites` von `VertexObjects`. Nichts zu tun.
- `packages/twopoint5d/src/map2d/chunk-quad-tree/IDataChunk2D.ts:15` und
  `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:59` sind ein auskommentiertes
  Interface-Glied und eine abgeschaltete Debugzeile; beide wären gültig.
- ASCII-Diagramme (`sprites/BaseSprite.ts:37-85`, `map2d/TileSprites/descriptors.ts:12-59`)
  und auskommentiertes CSS (`components/Card.astro:151`, `pages/index.astro:42,49-52`)
  sind kein TypeScript, kein Schalter erreicht sie.
- `.astro`-Dateien tragen keine HTML-Kommentare, in denen Code stünde.

- Ergebnis: 1 Runde · alle acht Schritte des Vorgehens umgesetzt, Review ohne Befunde ·
  kein Regressionstest, weil das Paket kein Laufzeitverhalten ändert; an seiner Stelle der
  Probebaum unter `<arbeitsdir>/p15/proberoot/`, 8 Fehler vorher, 0 nachher · Gate `exit=0`,
  Browsersuite unverändert auf der Baseline (Chromium 0, Firefox 24, 92 Treffer)
- Nebenbefunde: keine über die vier hinaus, die Zug 0 bereits in die Queue gelegt hat
- Folgen: keine — reine Doku- und Kommentaränderung, kein Aufrufer und kein Test hängt daran
- Schnittstellen: — (die Oberfläche bewegt sich nicht)

### [x] 16. Benennbarkeit ins Gate, und eine README, die von dieser App handelt

- Nebenbefund: `package.json:26,27,30` (low) · `apps/lookbook/README.md` (low)
- Ziel: Ein Typ, der in einer öffentlichen Signatur steht, ohne von außen benennbar zu
  sein, macht das Gate rot — und wer die Lookbook zum ersten Mal öffnet, liest, was sie
  zeigt und wie man sie startet.
- Hash: 46a9013
- Ergebnis: 1 Runde · beide Nebenbefunde behoben · der Reviewer fand keinen Befund, weder
  zur Erfüllung noch zur Qualität, und hat alle neun Schritte gegen den echten Baum
  nachgemessen · Regression dieses Pakets ist kein Vitest-Test, sondern der rote Lauf des
  Prüfers: über einen Probebaum ohne `export * from './types.js'` in
  `map2d/public-api.d.ts` meldet er acht Namen aus `map2d/types.d.ts`,
  `263 exported symbols, 1 accepted, 8 not nameable`, `exit=1` — selbst gefahren, Log
  `paket-16.negativ.log`; gegen das echte `dist/lib` `271 exported symbols, 1 accepted,
  0 not nameable`, `exit=0` · Gate kalt gefahren (`NX_SKIP_NX_CACHE=true`, der warme Lauf
  las nur den Cache des Implementierers zurück) auf `exit=0`, Log `paket-16.verify.log`,
  Vitest unverändert 45 Dateien / 788 Tests · Browsersuite getrennt, Log
  `paket-16.browser.log`: Chromium 0 Fehler, Firefox 24, `getSupportedExtensions` 92-mal —
  deckungsgleich mit »Vorbestehende Fehler«, dieses Paket fasst keine Zeile Laufzeitcode an
- Nebenbefunde: keine neuen — der Implementierer bestätigt nur den bereits in dieser Liste
  geführten Eintrag über die verwaisten Lookbook-Dateien
- Folgen: keine. Die eine Stelle, die dieser Umbau sonst widersprüchlich zurückgelassen
  hätte — die Dev-Server-Adresse ohne `/lookbook` in `AGENTS.md:30` und `CLAUDE.md:22` —,
  ist als Kehrseite der eigenen Änderung mitgezogen worden (Schritt 7)
- Schnittstellen: `pnpm checkNameableTypes` (Root und Paket) ist ein neues Gate-Kommando
  und steht dauerhaft zwischen `checkPkgTypes` und `lintPkg` · das nx-Target
  `checkNameableTypes` hängt an `build` und ist bewusst nicht gecacht ·
  `scripts/checkNameableTypes.mjs` nimmt optional einen Pfad auf eine `.d.ts` als erstes
  Argument, sonst `dist/lib/index.d.ts` ab dem Paketwurzelverzeichnis · seine
  Ausnahmeliste `ACCEPTED` ist nach `datei.d.ts:Name` geschlüsselt und verlangt zu jedem
  Eintrag eine Begründung · `publishNpmPkg` im Manifest von `packages/twopoint5d` führt
  den Schritt mit (ausgeführt wurde es in diesem Lauf nicht)
