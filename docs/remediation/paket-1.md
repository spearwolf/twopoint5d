# Paket 1 — TypeScript 6, tsconfig und Paket-Manifest

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: DOC-015 (medium), DEPS-004 (low), DEPS-009 (low), CFG-023 (low),
  CFG-024 (low), DEPS-008 (low), DEPS-007 (low), CONS-057 (info)
- Ziel: Toolchain auf TypeScript 6 und aktuelle Patch-/Minor-Stände, die tsconfig
  TS-7-fest, die ausgelieferten `.d.ts` mit TSDoc und das Manifest samt Peers und
  attw-Profil ehrlich.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `package.json` (Root)
  - `apps/lookbook/package.json`
  - `pnpm-lock.yaml` (nur über `pnpm install`, nie von Hand)
  - `tsconfig.json` (Root)
  - `apps/lookbook/tsconfig.json`
  - `packages/twopoint5d/tsconfig.typecheck.json`
  - `packages/twopoint5d/package.json`
  - `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts` (Zeile 1)
  - `scripts/checkPeerDependenciesOnly.mjs`
  - `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs` (neu)
  - `scripts/checkPeerDependenciesOnly/findUndeclaredImports.test.mjs` (neu)
  - `scripts/checkPeerDependenciesOnly/checkPeerDependenciesOnly.test.mjs`
  - `AGENTS.md` §»Shared dependency versions« (Zeilen 71–74)
  - `docs/architecture.md` §3 (Zeilen 94 und 99–102) und §5 (Zeilen 237–250)
  - `packages/twopoint5d/CHANGELOG.md` (nur der Block `[Unreleased]`)

## Vorab geprüft (Zug 0, 2026-09-30)

Das steht fest und muss nicht erneut herausgefunden werden:

- TypeScript 6.0.3 ist die aktuelle 6.x (7.0.2 ist `latest`). `typescript-eslint`
  8.71.0 verlangt `typescript >=4.8.4 <6.1.0`, `@astrojs/check` 0.9.10 erlaubt
  `^5.0.0 || ^6.0.0`.
- TS 6.0.3 gegen die heutigen Configs: einziger Fehler je Projekt ist TS5101
  (`baseUrl` und `downlevelIteration` deprecated). Mit den geplanten Optionen
  (ohne beide, `types: []` im Root) ist der Stand unter TS 6:
  - Library-Build-Config: 0 Fehler.
  - Library-Typecheck-Config: 7 Fehler (TS2591/TS2339/TS7031: `node:assert`,
    `node:v8`, `node:vm`, `globalThis.gc` in Specs und `src/testing/`), mit
    `types: ["node"]` 0 Fehler.
  - `twopoint5d-testing`: 0 Fehler.
  - Lookbook, nur die `.ts`-Dateien: 1 Fehler, TS2880 in
    `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts:1` (Import Assertion
    `assert {type: 'json'}`). `astro check` über die `.astro`-Dateien ist nicht
    vorab geprobt; `astro/client.d.ts` deklariert `*.css`, die beiden
    Side-Effect-Imports von `global.css` lösen also auch unter dem TS-6-Default
    `noUncheckedSideEffectImports` auf. Was `astro check` unter TS 6 zusätzlich
    meldet, ist Folge des Bumps und gehört in dieses Paket.
- Der Emit von TS 6.0.3 über `tsconfig.build.json` ist byte-gleich zur heutigen
  `dist/lib` (TS 5.9.3). Mit `removeComments: false` tragen 124 der `.d.ts`-Dateien
  zusammen 836 `/**`-Blöcke, `@internal` taucht in keiner `.d.ts` auf
  (`stripInternal` wirkt weiter), `dist/lib` wächst von rund 1,5 auf 2,2 MB.
- `pnpm exec attw --pack dist --profile esm-only` im Paketverzeichnis läuft gegen
  die heutige `dist/` mit Exit 0.
- Der Astro-Alias-Plugin (`astro/dist/vite-plugin-config-alias/index.js`) nimmt
  ohne `baseUrl` das Verzeichnis der tsconfig als Basis für `paths`. Kein Import
  im Lookbook stützt sich auf `baseUrl` (alle nicht-relativen Imports sind
  Pakete oder `~…`-Aliase).
- `prettier` 3.9.9 mit `prettier-plugin-astro` 0.14.1 formatiert kein Repo-File
  anders. `prettier-plugin-astro` 1.1.0 formatiert 9 der 32 `.astro`-Dateien um.
- `nx` 23.2.1 hängt weiter an `smol-toml` 1.6.1; der Override
  `'nx>smol-toml': ^1.7.1` in `pnpm-workspace.yaml` bleibt samt Kommentar stehen.
- `ts.preProcessFile(text, true, true)` meldet statische und dynamische Imports,
  Re-Exporte, `import("…")`-Typen und `/// <reference types>` und überspringt
  Kommentare — geprüft an einem `.d.ts` aus `dist/lib/sprites/` und einem
  Kommentar mit `import … from 'lodash'`.

## Vorgehen

Reihenfolge einhalten: erst Toolchain und tsconfig, dann Manifest, dann das Gate
mit Test zuerst, dann Doku und CHANGELOG. AGENTS.md vorher lesen.

1. **Abhängigkeiten nachziehen (DEPS-004).** In `package.json` (Root) die
   Untergrenzen setzen:
   - `@types/node` `^26.6.3`, `@vitest/coverage-v8` `^5.0.2`, `nx` `23.2.1`
     (exakt, wie bisher ohne Caret), `prettier` `^3.9.9`, `typescript-eslint`
     `^8.71.0`, `vitest` `^5.0.2`, `typescript` `^6.0.3`.
   - `tslib` aus den `devDependencies` streichen: nach Schritt 3 importiert und
     braucht es nichts mehr.
   - `prettier-plugin-astro` bleibt `^0.14.1`.
   In `apps/lookbook/package.json`: `astro` `^7.3.5`, `marked` `^18.0.14`,
   `typescript` `^6.0.3`. `@spearwolf/astro-rainbow-line` bleibt `^1.3.0` (steht
   als Nebenbefund in »Offene Befunde« des Plans, nicht in diesem Paket). `three`
   und `@types/three` im Katalog bleiben unverändert (Entscheidung im Plan).
   Danach `pnpm install` im Root; die Ausgabe darf keine neue Peer-Warnung
   enthalten — erscheint eine, steht sie im Report.
2. **Import Assertion ersetzen.** `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts:1`:
   `assert {type: 'json'}` wird `with {type: 'json'}` (TS2880 unter TS 6).
3. **Root-`tsconfig.json` (DEPS-009, DOC-015, CFG-023, CONS-057).** Die Datei führt
   ihre Optionen alphabetisch; das bleibt so.
   - Zeile 9 `"baseUrl": "."` und Zeile 12 `"downlevelIteration": false` streichen.
   - Zeilen 16–18 (Kommentar und `"exactOptionalPropertyTypes": false`) vor
     `"experimentalDecorators"` ziehen, also direkt hinter `"esModuleInterop"`.
     Den Kommentar dabei auf höchstens rund 90 Zeichen je Zeile umbrechen,
     Wortlaut bleibt.
   - Zeile 20 `"importHelpers": true` → `false`, mit einem Kommentar darüber,
     sinngemäß: tsc schreibt seine Helper in die Ausgabe, statt sie aus `tslib` zu
     importieren — das Paket erreicht seine Konsumenten nur mit Peer Dependencies
     und kann `tslib` nicht mitbringen.
   - Zeile 37 `"removeComments": true` → `false`, mit einem Kommentar darüber,
     sinngemäß: die `.d.ts` tragen die TSDoc in den Editor des Konsumenten; tsc
     kann die Kommentare nicht nur in den Deklarationen behalten, also tragen
     die `.js` sie auch, und der Bundler des Konsumenten streicht sie dort.
   - `"types": []` neu, zwischen `"target"` und `"useDefineForClassFields"`, mit
     einem Kommentar darüber, sinngemäß: Globals kommen aus dem, was eine Datei
     importiert; ein Projekt, das unter Node oder Mocha läuft, nennt diese Typen
     in seiner eigenen Config.
4. **`packages/twopoint5d/tsconfig.typecheck.json`:** `"types": ["node"]` in
   `compilerOptions` neben `"noEmit": true`. Den Kopfkommentar um einen Satz
   ergänzen, sinngemäß: die Specs und `src/testing/` laufen unter Node in Vitest
   (`node:assert`, `node:v8`, `node:vm`, `globalThis.gc`); `tsconfig.build.json`
   erbt `types: []` aus dem Root, so kann der veröffentlichte Code sich nicht auf
   Node-Globals stützen. `packages/twopoint5d/tsconfig.json` und
   `tsconfig.build.json` bleiben unverändert.
5. **`apps/lookbook/tsconfig.json`:** `"baseUrl": "."` (Zeile 4) streichen und den
   drei `paths`-Zielen `./` voranstellen (`"./src/components/*"`,
   `"./src/layouts/*"`, `"./src/demos/*"`). Die auskommentierten Optionen samt
   ihrer Kommentare in den Zeilen 8–12 (`ignoreDeprecations: "5.0"`,
   `importsNotUsedAsValues`) fallen weg: `importsNotUsedAsValues` gibt es seit
   TS 5.5 nicht mehr, und `"5.0"` ist unter TS 6 kein gültiger Wert von
   `ignoreDeprecations`. Den Kommentar an `noEmit` (Zeile 6) grammatisch richten:
   »Astro runs the TypeScript code itself, nothing is emitted.«
   `packages/twopoint5d-testing/tsconfig.json` bleibt unverändert (setzt schon
   `types: ["mocha"]`). `scripts/checkDocSnippets/compileSnippets.mjs` bleibt
   unverändert: seine Overrides `importHelpers: false` und `types: []` decken sich
   jetzt mit dem Root und schaden nicht.
6. **Manifest der Library (DEPS-008, CFG-024).** `packages/twopoint5d/package.json`:
   - `peerDependencies` bekommt `"@types/three": "catalog:"` (Katalog-Regel aus
     AGENTS.md; `makePackageJson.mjs` löst das zu `~0.185.4` auf).
   - Neues Feld `"peerDependenciesMeta": {"@types/three": {"optional": true}}`
     direkt hinter `peerDependencies`. `makePackageJson.mjs` reicht es unverändert
     durch; nichts daran anpassen.
   - `checkPkgTypes` wird `pnpm exec attw --pack dist --profile esm-only`.
   Danach erneut `pnpm install`, damit der Lockfile-Importer der Library den Peer
   kennt.
7. **Gate für nackte Imports (CFG-023), Test zuerst.** `lintPkg` läuft schon
   `node ../../scripts/checkPeerDependenciesOnly.mjs dist`; genau dieses Skript
   lernt, auch die Imports des Pakets gegen `peerDependencies` zu halten. Keine
   neue `lintPkg`-Zeile.
   1. Zuerst in `scripts/checkPeerDependenciesOnly/checkPeerDependenciesOnly.test.mjs`
      `run()` um einen zweiten Parameter `files = {}` erweitern (relativer Pfad →
      Inhalt, Verzeichnisse mit `recursive: true` anlegen) und diesen Fall
      schreiben: »refuses a package whose code imports a package outside its peer
      dependencies: exit code 1, message names file and specifier« —
      Manifest `{peerDependencies: {three: '~0.185.1'}}`, Datei `lib/a.js` mit
      `import {x} from 'tslib';`, erwartet Status 1 und stderr passend zu
      `/lib\/a\.js imports tslib; the library ships with peer dependencies only/`.
      Mit `pnpm test:scripts` **rot sehen** (heute Exit 0) und den roten Lauf in
      den Report.
   2. Neues Modul `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs`,
      importiert `ts` aus `typescript` (wie `checkDocSnippets/compileSnippets.mjs`),
      zwei Exporte mit TSDoc im Stil von `findRuntimeDependencies.mjs`:
      - `packageNameOf(specifier)`: das Paket, das ein Specifier erreicht —
        `@scope/name` für `@scope/name/sub/path.js`, `name` für `name/sub/path`,
        sonst das erste Segment vor `/` (`node:fs` bleibt `node:fs`, `fs` bleibt
        `fs`).
      - `findUndeclaredImports(files, peerDependencies)`: `files` ist ein Array von
        `{file, text}`, `peerDependencies` ein Objekt (darf `undefined` sein).
        Für jede Datei `ts.preProcessFile(text, true, true)`; aus `importedFiles`
        zählt jeder Specifier, der nicht mit `./` oder `../` beginnt und dessen
        `packageNameOf()` kein Schlüssel von `peerDependencies` ist. Aus
        `typeReferenceDirectives` zählt ein Name `x`, wenn weder `x` noch
        `@types/x` ein Peer ist. Rückgabe `[{file, specifier}]` in der Reihenfolge
        von `files`, innerhalb einer Datei die Imports vor den Type-References,
        jeweils in Quelltextreihenfolge. Kommentare zählen nicht — deshalb
        `preProcessFile` statt eines regulären Ausdrucks: mit `removeComments:
        false` stehen TSDoc-Beispiele mit `import … from '…'` in den `.js`.
   3. `scripts/checkPeerDependenciesOnly/findUndeclaredImports.test.mjs` mit
      `node:test` im Stil von `findRuntimeDependencies.test.mjs`, mindestens:
      `packageNameOf` für `three/webgpu` → `three`, `@spearwolf/eventize` →
      `@spearwolf/eventize`, `@scope/name/sub/path.js` → `@scope/name`, `node:fs`
      → `node:fs`; ein nackter Import ohne Peer wird mit Datei gemeldet;
      relative Pfade und Peer-Unterpfade (`three/tsl`, `three/webgpu`) bleiben
      still; ein Import in einem `/** … */`-Kommentar bleibt still;
      `export * from 'x'`, `import('x')`, `import 'x'` und ein `import('x').T`-Typ
      werden gemeldet; `/// <reference types="node" />` wird gemeldet,
      `/// <reference types="three" />` bleibt mit dem Peer `@types/three` still;
      die Reihenfolge über zwei Dateien.
   4. `scripts/checkPeerDependenciesOnly.mjs`: nach der Manifest-Prüfung alle
      Dateien unter `<package-dir>` sammeln, die auf `.js`, `.mjs` oder `.d.ts`
      enden und in keinem `node_modules`-Segment liegen
      (`fs.readdirSync(packageDir, {recursive: true})`, Ergebnis sortieren, damit
      die Ausgabe stabil ist), lesen, an `findUndeclaredImports(files,
      manifest.peerDependencies)` geben und je Treffer
      `` `${path.join(packageDir, file)} imports ${specifier}; the library ships with peer dependencies only` ``
      auf stderr schreiben. Exit 1, wenn Manifest-Befunde oder Import-Befunde
      vorliegen; ein Lesefehler einer Datei endet wie beim Manifest mit
      `cannot read <pfad>: <message>` und Exit 1, ohne Stacktrace. Den
      Kopfkommentar (Zeilen 1–8) neu fassen: das Skript scheitert an einem Paket,
      das etwas deklariert, was npm mitinstallieren würde, oder dessen `.js`,
      `.mjs` oder `.d.ts` ein Paket importiert, das nicht unter seinen
      `peerDependencies` steht; Exit-Codes entsprechend.
   5. Zwei weitere CLI-Fälle in `checkPeerDependenciesOnly.test.mjs`: ein Paket,
      dessen `lib/a.js` nur `three/webgpu` und `./b.js` importiert und dessen
      `lib/a.d.ts` `import('three/webgpu')` als Typ nutzt, besteht mit Exit 0 und
      leerem stderr; eine Datei unter `node_modules/x/index.js` mit einem Import
      von `lodash` wird übergangen (Exit 0).
8. **Doku.**
   - `AGENTS.md` §»Shared dependency versions« (Zeilen 71–74): hinter »They are
     peer dependencies of the library« ergänzen, dass `@types/three` ein
     optionaler ist (nur ein TypeScript-Konsument braucht ihn). Dazu die Policy
     (DEPS-007): der Katalog-Bereich landet wörtlich im veröffentlichten Manifest,
     und ein 0.x-Minor von three bricht, deshalb bleibt `three` bei der Tilde —
     und jeder `three`-Bump ist ein Release: bis die Library veröffentlicht, trifft
     ein Konsument auf dem neueren three einen Peer-Konflikt.
   - `docs/architecture.md` §5, erster Absatz (Zeilen 237–241): »In the library they
     are `peerDependencies`« ergänzen um `@types/three` als optionalen Peer
     (`peerDependenciesMeta`). Zweiter Absatz (Zeilen 245–247): der Satz über den
     Sprung von `three` sagt zusätzlich, dass er ein eigener Release ist, weil der
     Katalog-Bereich wörtlich ins veröffentlichte Manifest geht.
   - `docs/architecture.md` §5, neuer Absatz direkt hinter dem Dependabot-Absatz
     (hinter Zeile 250), zwei Zurückhaltungen mit Grund (DEPS-004; Entscheidung
     im Plan vom 2026-09-30):
     - TypeScript bleibt auf der 6.x-Linie: `typescript-eslint` 8 lässt nur
       `typescript <6.1.0` zu, und TypeScript 7 exportiert unter `typescript`
       keine Compiler-API mehr (nur `typescript/unstable/*`), während
       `scripts/checkNameableTypes.mjs`, `scripts/checkDocSnippets/compileSnippets.mjs`
       und `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs` die
       klassische API importieren. Der Schritt auf 7 wartet auf beides.
     - `prettier-plugin-astro` bleibt auf 0.14: 1.x formatiert mit dem Rust-Compiler
       `@astrojs/compiler-rs` (0.x) und formatiert einen Teil der `.astro`-Dateien
       um; der Wechsel ist eine Formatierungsänderung eigenen Rechts und kein Teil
       eines Toolchain-Updates. Keine Zählung und kein Datum in den Text.
   - `docs/architecture.md` §3, Zeile 94: `checkPkgTypes` läuft attw mit dem
     Profil `esm-only` — das Paket ist ESM only, `node10` und ein `require` aus
     CommonJS liegen außerhalb, jede andere Auflösung muss gelingen.
   - `docs/architecture.md` §3, Zeilen 99–102: der `lintPkg`-Punkt nennt die
     Import-Prüfung: das Skript scheitert auch, wenn eine `.js`, `.mjs` oder
     `.d.ts` in `dist/` ein Paket importiert, das kein Peer ist; außer Peers darf
     das Paket nur relative Pfade importieren.
   - Markdown bricht bei rund 88–90 Zeichen um, wie die Umgebung.
9. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`; Skill
   `updating-changelog` laden):
   - unter `### Added`: `@types/three` als optionale Peer Dependency (`~0.185.4`):
     ein TypeScript-Konsument erfährt, welche Typen zur Library passen; ein
     JavaScript-Konsument braucht nichts zu installieren.
   - unter `### Changed`: die `.d.ts` des Pakets tragen die TSDoc der Quellen, ein
     Editor zeigt sie zu jedem Export; die `.js` tragen die Kommentare der Quellen
     ebenfalls.
   - `### Migration Guide`, neuer H4 »`@types/three` is an optional peer
     dependency«: Before/After als `json` wie beim vorhandenen H4 »The `three`
     peer dependency range« (Zeile 1430 ff.) — ein TypeScript-Konsument hält
     `@types/three` in seinen `devDependencies` auf `~0.185.4`; npm meldet eine
     andere installierte Version als Peer-Konflikt. Code-Blöcke dort bleiben
     einfache `json`-Blöcke, nicht `ts check`.
   - Keine Einträge für TS 6, `importHelpers`, attw oder die tsconfig: der Emit
     ist byte-gleich, für Konsumenten ändert sich nichts.

## Entscheidungen in Zug 0

- **Guard für die TSDoc (DOC-015): keiner.** Die Empfehlung des Audits
  (`grep -c '/\*\*' dist/lib/index.d.ts` in `lintPkg`) zählt in einer Datei, die nur
  aus `export * from …` besteht, und liefe immer auf 0. Eine Prüfung über alle
  `.d.ts` wäre ein eigenes Gate-Skript für eine einzige Option; der Kommentar an
  `removeComments` trägt den Grund. Die Verify-Zeile prüft die TSDoc in `dist/`
  einmalig.
- **Kommentare auch im JS.** tsc kann Kommentare nicht nur für die Deklarationen
  behalten; ein zweiter `tsc`-Lauf mit `--emitDeclarationOnly` verdoppelt die
  Build-Zeit für Bytes, die jeder Bundler beim Minifizieren streicht. Ein
  Bundler-Schritt existiert im Build nicht.
- **CFG-023 beide Wege.** `importHelpers: false` beseitigt den einzigen bekannten
  Weg zu einem Nicht-Peer-Import; das Gate hält jeden anderen auf (der Titel des
  Findings verlangt es). Das Gate sitzt in `checkPeerDependenciesOnly.mjs`, weil
  dessen Vertrag »peer dependencies only« genau das ist und `lintPkg` es schon
  gegen `dist` ruft. `.d.ts` zählen mit: ein `/// <reference types="node" />` in
  den Deklarationen wäre derselbe Bruch für TypeScript-Konsumenten.
- **`@types/three` über `catalog:`**, nicht als eigener, weiterer Bereich: AGENTS.md
  verbietet Versionen außerhalb des Katalogs; `~0.185.4` ist die Version, gegen die
  gebaut wird.
- **Patch-Stände des Lookbooks** (`astro`, `marked`) gehören zur selben Ursache
  wie DEPS-004 (Routine-Update, `pnpm outdated` vom 2026-09-30) und kommen mit.
  Der Major von `@spearwolf/astro-rainbow-line` nicht: er ersetzt das vendorte
  Skript nach der Regel in AGENTS.md und gehört ins Lookbook.
- **Urteil am Nebenbefund `@spearwolf/astro-rainbow-line`: → Scope.** Die
  Scope-Regel nimmt jede Severity und jeden später gefundenen Befund; geschätzt
  low, weil nur das Lookbook betroffen ist und nichts davon veröffentlicht wird.
  Keine gemeinsame Ursache mit diesem Paket (anderes Teilsystem, eigener Fix über
  das vendorte Skript), deshalb Queue statt Paket 1.
- **Modell mittlere Stufe, Effort medium:** die Fehlerlage unter TS 6 ist vorab
  vermessen, der Rest ist Konfiguration, ein kleines Modul mit Tests und Doku.
  Offen ist nur `astro check` unter TS 6.

## Verify

```bash
pnpm install --frozen-lockfile && pnpm nx reset && pnpm run ci \
  && test "$(grep -rho '/\*\*' packages/twopoint5d/dist/lib --include='*.d.ts' | wc -l)" -gt 0 \
  && ! grep -rq '@internal' packages/twopoint5d/dist/lib --include='*.d.ts' \
  && ! grep -rq "from 'tslib'" packages/twopoint5d/dist/lib
```

`pnpm nx reset` verwirft den Nx-Cache: die `inputs` der Targets nennen die
Compiler-Version nicht, ein Treffer aus TS-5.9-Zeiten würde sonst einen grünen
Lauf vortäuschen.

## Commit

```
chore(deps): move the toolchain to TypeScript 6 and its current patch releases, make the tsconfigs ready for TypeScript 7, keep the TSDoc in the published declarations, let tsc inline its helpers and lintPkg refuse an import of anything but a peer dependency, run attw with its esm-only profile, declare @types/three an optional peer dependency, and write down that a three bump is a release and why TypeScript 7 and prettier-plugin-astro 1.x wait
```

## Für den Plan nach dem Commit

`Schnittstellen:` unter Paket 1 soll mindestens nennen: `@types/three` optionaler
Peer (`peerDependenciesMeta`) · Root-tsconfig mit `types: []`,
`importHelpers: false`, `removeComments: false`, ohne `baseUrl` und
`downlevelIteration` · Library-Typecheck mit `types: ["node"]` · `tslib` entfernt ·
`checkPkgTypes` = `attw --pack dist --profile esm-only` ·
`findUndeclaredImports(files, peerDependencies)` und `packageNameOf(specifier)` in
`scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs` (importiert
`typescript`; Paket 2 bekommt es in seinen `checkJs`-Typecheck).

## Verlauf

- 2026-09-30 Zug 0: Detailplan steht · DOC-015 unverändert (`tsconfig.json:37`,
  0 `/**` in `dist/lib/**/*.d.ts`) · DEPS-004 unverändert (`package.json:61`
  `typescript ^5.9.3`, `:55` `prettier-plugin-astro ^0.14.1`; weiter die sechs
  Root-Rückstände, `typescript-eslint` jetzt bis 8.71.0, dazu `astro` und `marked`
  im Lookbook)
  · DEPS-009 unverändert (`tsconfig.json:9`, `:12`, `apps/lookbook/tsconfig.json:4`)
  · CFG-023 unverändert (`tsconfig.json:20`; `dist` heute ohne `tslib`) · CFG-024
  unverändert (`packages/twopoint5d/package.json:55`) · DEPS-008 unverändert
  (`packages/twopoint5d/package.json:60-64`, drei Peers) · DEPS-007 unverändert
  (`pnpm-workspace.yaml:11` `~0.185.1`, `three` 0.186.1 erschienen) · CONS-057
  unverändert (`tsconfig.json:18`) · Folgen: keine offen (erstes Paket) ·
  Nebenbefund `@spearwolf/astro-rainbow-line` 2.x → »Offene Befunde« (→ Scope) ·
  Restplan: Reihenfolge unverändert, »Hängt ab von« bei Paket 8 präzisiert und bei
  Paket 9 um 1 ergänzt
- 2026-09-30 Zug 1: Implementierer beauftragt, Modell sonnet (mittlere Stufe), Effort medium,
  Report nach `paket-1.impl-0.json`
- 2026-09-30 Zug 2: Report FERTIG (Volltext im Transkript der Session f3eaa22d, `result` in
  der JSON-Datei ist nur ein Nachsatz) · roter Lauf belegt (`pnpm test:scripts`, actual 0,
  expected 1) · 13 Dateien geändert, 2 neu (`findUndeclaredImports.mjs` samt Test) ·
  Arbeitsbaum schmutzig · Verify exit=0 (`paket-1.verify.log`)
- 2026-09-30 Zug 3: Diff `paket-1.diff`, Reviewer beauftragt (opus, Effort medium)
- 2026-09-30 Zug 3: Reviewer (`paket-1.review-0.json`): alle acht Findings behoben · 1 wichtig
  (`packages/twopoint5d/tsconfig.json` ohne `types: ["node"]`, der Editor zeigt in den Specs
  7 Typfehler, kein Gate sieht sie) · 4 klein · 2 Nebenbefunde (README:60, `#`-Subpath-Import
  im neuen Gate)
- 2026-09-30 Zug 4 Runde 1: offen der wichtige Befund, dazu mitgegeben `#`-Subpath im Gate
  (eigener neuer Code), drei kleine (architecture.md-Satz, CHANGELOG-Before, Zeilenlänge im
  Kopfkommentar) · Resume des Implementierers f3eaa22d, gleiches Profil
- 2026-09-30 Zug 4 Runde 1: Report FERTIG (`paket-1.impl-1.json`) · zusätzlich geändert
  `packages/twopoint5d/tsconfig.json`, `tsconfig.build.json`; `tsconfig.typecheck.json`
  wieder wie in HEAD · Verify exit=0 (`paket-1.verify-1.log`), `tsc -p tsconfig.json
  --noEmit` in der Library exit 0 · Diff `paket-1.r1.diff` · Reviewer
  (`paket-1.review-1.json`): alle fünf Befunde erledigt, zwei neue kleine (Umbrüche)
- 2026-09-30 Zug 5: Commit 5738b5e5, Trailer `Remediation-Run: 2026-09-30`, 16 Dateien ·
  Verify-Log `paket-1.verify-1.log` exit=0

## Urteil des Reviewers

Aus `paket-1.review-0.json`, Stand vor Runde 1; die Fundstellen gelten für Commit 5738b5e5
bis auf die in Runde 1 geänderten Dateien.

- DOC-015 behoben — `tsconfig.json:42` `removeComments: false` samt Kommentar; `/**` in den
  `.d.ts`, kein `@internal`
- DEPS-004 behoben — `package.json:43,46,52,54,60–62`, `tslib` entfernt;
  `apps/lookbook/package.json` `astro ^7.3.5`, `marked ^18.0.14`, `typescript ^6.0.3`;
  Zurückhaltung von TS 7 und `prettier-plugin-astro` 1.x in `docs/architecture.md` §5
- DEPS-009 behoben — Root-`tsconfig.json` ohne `baseUrl`/`downlevelIteration`, `types: []`;
  `apps/lookbook/tsconfig.json` ohne `baseUrl`, `paths` mit `./`; Library-Typecheck mit
  Node-Typen (nach Runde 1 über `packages/twopoint5d/tsconfig.json`)
- CFG-023 behoben — `tsconfig.json:22` `importHelpers: false`; Gate in
  `scripts/checkPeerDependenciesOnly.mjs` und `findUndeclaredImports.mjs`, Tests in
  `checkPeerDependenciesOnly.test.mjs` und `findUndeclaredImports.test.mjs`
- CFG-024 behoben — `packages/twopoint5d/package.json:55` `--profile esm-only`, Doku
  `docs/architecture.md:94–96`
- DEPS-008 behoben — `packages/twopoint5d/package.json:63,66–70`, `dist/package.json` löst zu
  `~0.185.4` auf; `AGENTS.md:74`, `docs/architecture.md:245`, CHANGELOG `Added` und
  Migration-Guide-H4
- DEPS-007 behoben — Policy in `AGENTS.md:75–77` und `docs/architecture.md:250–253`
- CONS-057 behoben — `tsconfig.json:13–17`

Befunde aus Review 0, in Runde 1 erledigt (Review 1 bestätigt): wichtig — Editor-Config der
Library ohne Node-Typen; `#`-Subpath-Imports im Gate; klein — Satz über den Sprung von
`three` in `docs/architecture.md` §5, »Before« im Migration-Guide-H4, Umbruch im Kopf von
`checkPeerDependenciesOnly.mjs`.

Klein und offen (als Folgen im Plan): `findUndeclaredImports.mjs:17` TSDoc-Zeile 134
Zeichen, Absatz `:14–22` neu umbrechen · `packages/twopoint5d/tsconfig.build.json:6–7`
Kommentarzeilen 92/93 Zeichen. Nicht übernommen: Vorschlag, den Commit-Typ auf `build`
oder `feat` zu ändern — `chore(deps)` blieb wie in der Paketdatei.

Nebenbefunde des Reviewers: `packages/twopoint5d/README.md:60` ohne `@spearwolf/signalize`
(vorbestehend, → Queue, → Scope: die Scope-Regel nimmt jede Severity, geschätzt low, weil nur
die README-Aufzählung betroffen ist; Paket 8 bearbeitet die README); dieselbe Stelle ohne
`@types/three` ist Folge dieses Pakets (im Plan unter Folgen).

## Findings im Volltext

**DOC-015 · medium · tsconfig.json:34** — removeComments streicht jede TSDoc aus den
ausgelieferten .d.ts
Die Quellen tragen 418 TSDoc-Blöcke (gezählt über `src/**/*.ts` ohne Specs), die
veröffentlichten Declaration-Dateien unter `dist/lib` tragen null.
`removeComments: true` in der Root-tsconfig entfernt Kommentare nicht nur aus dem JS,
sondern auch aus den `.d.ts`; ein Konsument sieht im Editor zu keiner der 278
exportierten Deklarationen einen Hover-Text — auch nicht zu den ausführlich
dokumentierten `dispose()`-Verträgen, die der Remediation-Lauf gerade geschrieben hat.
Re-Check: unverändert; die Doku-Arbeit der letzten Wochen kommt beim Konsumenten nicht
an.
Empfehlung: `removeComments` auf `false` setzen (oder nur im JS-Emit über einen
Bundler-Schritt entfernen). Der `lintPkg`-Schritt kann mit
`grep -c '/\*\*' dist/lib/index.d.ts` wachen, dass Doku im Paket bleibt.

**DEPS-004 · low · package.json:60** (auch `package.json:54`, `package.json:37`) —
devDependencies nachziehen und die zurückgehaltenen Major-Sprünge von TypeScript und
`prettier-plugin-astro` begründen
`pnpm outdated` (2026-09-26) meldet sechs Patch-/Minor-Rückstände in den
devDependencies (`@types/node`, `@vitest/coverage-v8`, `nx` 23.2.0 → 23.2.1,
`prettier`, `typescript-eslint`, `vitest` 5.0.1 → 5.0.2) und zwei Major-Sprünge, die
der Caret-Range ausschließt: `typescript` `^5.9.3` gegenüber 7.0.2 und
`prettier-plugin-astro` `^0.14.1` gegenüber 1.1.0. `typescript` 7 ist zudem durch den
Peer-Range von `typescript-eslint` 8.70 (`>=4.8.4 <6.1.0`) gesperrt, 6.0 wäre
erreichbar. Beim TypeScript-Sprung wiegt, dass `scripts/checkNameableTypes.mjs` und
`scripts/checkDocSnippets/compileSnippets.mjs` die Compiler-API direkt benutzen.
Nichts im Repo sagt, ob die Zurückhaltung gewollt ist; `pnpm audit` meldet keine
bekannte Schwachstelle, die Wirkung ist gering.
Beleg: `typescript 5.9.3 → 7.0.2`, `prettier-plugin-astro 0.14.1 → 1.1.0`
Empfehlung: Die Patch-/Minor-Stände in einem Routine-Update mitziehen. `typescript` auf
6.0 heben, soweit `typescript-eslint` es zulässt; für 7.x und `prettier-plugin-astro`
1.x entweder ein Upgrade-Fenster einplanen (die beiden Gate-Skripte gegen die neue
Compiler-API prüfen) oder die Zurückhaltung mit einem Satz in `docs/architecture.md` §5
festhalten.

**DEPS-009 · low · tsconfig.json:9** (auch `tsconfig.json:12`,
`apps/lookbook/tsconfig.json:4`) — Die tsconfig für TypeScript 6/7 vorbereiten
TypeScript 7.0.2 ist erschienen. Die Root-tsconfig nutzt `baseUrl` und
`downlevelIteration`, die mit TS 6 deprecated sind, und setzt kein `types`.
Library-Code sieht damit `@types/node` und `@types/sinon` als Globals, und mit dem
neuen Default `types: []` ändert sich das Verhalten.
Empfehlung: `baseUrl` und `downlevelIteration` entfernen und `types` explizit setzen
(Library: `[]`), bevor der Major-Bump kommt.

**CFG-023 · low · tsconfig.json:17** (auch `packages/twopoint5d/package.json:56`) —
Nackte Imports im Build-Output gegen die Peer-Liste prüfen
`importHelpers: true` lässt tsc `import … from "tslib"` emittieren, sobald ein Helper
nötig wird, etwa für `using` oder Standard-Decorators bei ES2022. Nach der
Peer-only-Policy kann tslib nie eine Dependency sein, und kein Gate prüft, dass `dist`
nur Peers und relative Pfade importiert. Heute ist `dist` frei von tslib, ein Verstoß
käme aber als kaputter Release an.
Empfehlung: `importHelpers: false` im Build-Tsconfig setzen oder in `lintPkg` die
bare-specifier-Imports in `dist/lib/**/*.js` gegen `peerDependencies` abgleichen.

**CFG-024 · low · packages/twopoint5d/package.json:54** — attw mit dem
esm-only-Profil statt mit abgeschaltetem no-resolution fahren
`--ignore-rules cjs-resolves-to-esm no-resolution` schaltet `no-resolution` auch für
node16-ESM und bundler ab. Eine echte Auflösungsregression dort bliebe stumm.
Empfehlung: `attw --pack dist --profile esm-only` verwenden.

**DEPS-008 · low · packages/twopoint5d/package.json:59-63** (auch `AGENTS.md:66`,
`docs/architecture.md:217-221`) — @types/three als optionalen Peer deklarieren oder
die Doku auf drei Peers korrigieren
AGENTS.md und die Architektur-Doku nennen alle vier Catalog-Einträge Peer
Dependencies. Deklariert sind nur drei. Die publizierten `.d.ts` importieren `three`,
TS-Konsumenten brauchen also `@types/three` in passender Version (~0.185) und erfahren
das nirgends.
Empfehlung: `@types/three: catalog:` mit `peerDependenciesMeta.optional` deklarieren
oder die Doku anpassen.

**DEPS-007 · low · pnpm-workspace.yaml:11** — Die three-Peer-Policy entscheiden und
dokumentieren: ~0.185.1 weist jeden Konsumenten auf 0.186 ab
Der Katalog-Bereich landet wörtlich im veröffentlichten Manifest. Mit three auf 0.186
(laut `pnpm outdated`) bekommt jeder Konsument auf 0.186
`ERESOLVE`/`ERR_PNPM_PEER_DEP_ISSUES`, bis diese Bibliothek released — und sie hat
seit drei Monaten nicht released (der Release-Rückstand selbst ist als CFG-017 vom
Autor akzeptiert). Tilde ist vertretbar, weil three-0.x-Minors breaking sind, aber
dann muss jeder three-Bump ein Release sein, und nichts sagt das.
Empfehlung: Entweder die Tilde behalten und die Policy in AGENTS.md §»Shared
dependency versions« schreiben (»ein three-Bump ist ein Release«), oder auf
`>=0.185.0 <0.187.0` weiten, nachdem gegen 0.186 verifiziert wurde, und die
Obergrenze mit jedem verifizierten Bump mitziehen.

**CONS-057 · info · tsconfig.json:18** — exactOptionalPropertyTypes steht in
tsconfig.json nicht an seiner alphabetischen Stelle
Aufgefallen im Remediation-Lauf vom 2026-09-22, kleiner Befund des Reviewers. Die
bewusst abgeschaltete Option `exactOptionalPropertyTypes` steht nach
`experimentalDecorators`, obwohl die Datei ihre Optionen sonst alphabetisch führt.
Für `tsc` spielt die Reihenfolge keine Rolle.
Empfehlung: Die Option samt Kommentar vor `experimentalDecorators` ziehen.
