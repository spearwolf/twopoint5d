# Paket 1 — Workspace-Konfiguration und Build-Skripte schärfen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: CFG-025 (low), TYPE-015 (info), CFG-022 (info), READ-015 (info), TEST-040 (info)
- Ziel: Root-Manifest, tsconfig, Nx-Inputs und Paket-Skripte sagen eindeutig und prüfbar, was sie tun — eigener Workspace-Name, `noImplicitReturns` an, eingegrenzte Doku-Inputs, die Peer-only-Invariante als getestetes Skript, plattformneutrale Pfad-Erwartungen.
- Modell: mittlere Stufe (sonnet)
- Effort: medium
- Dateien:
  - geändert: `package.json`, `tsconfig.json`, `packages/twopoint5d-testing/project.json`,
    `packages/twopoint5d/package.json`, `scripts/publishNpmPkg/releaseFiles.test.mjs`,
    `docs/architecture.md`, `AGENTS.md`
  - neu: `scripts/checkPeerDependenciesOnly.mjs`,
    `scripts/checkPeerDependenciesOnly/findRuntimeDependencies.mjs`,
    `scripts/checkPeerDependenciesOnly/findRuntimeDependencies.test.mjs`,
    `scripts/checkPeerDependenciesOnly/checkPeerDependenciesOnly.test.mjs`,
    `scripts/checkDocSnippets/typecheckInputs.test.mjs`
  - nicht anfassen: `pnpm-lock.yaml` (muss unverändert bleiben, siehe Schritt 1.3),
    `.github/` (enthält keine Referenz auf den Root-Namen, geprüft per `git grep`)
- Vorgehen: siehe unten, je Finding ein Abschnitt, in dieser Reihenfolge.
- Verify: `pnpm install --frozen-lockfile && git diff --exit-code -- pnpm-lock.yaml && pnpm run ci`
- Commit: `build: name the workspace root twopoint5d-workspace, turn on noImplicitReturns, limit the Markdown inputs of the docs type check to the files git tracks and hold them there with a spec, move the peer-dependencies-only check of lintPkg into a tested script, and build the expected paths of the releaseFiles spec with path.join`
- Verlauf:
  - 2026-09-22 Zug 0: Detailplan steht · CFG-025 unverändert (`package.json:2`) ·
    TYPE-015 unverändert (`tsconfig.json:27`), Probelauf mit `--noImplicitReturns`:
    0 Fundstellen · CFG-022 unverändert (`packages/twopoint5d-testing/project.json:15`),
    ungetracktes `remediation-plan.md` per `nx show target inputs` als Input bestätigt ·
    READ-015 unverändert (`packages/twopoint5d/package.json:56`) · TEST-040 unverändert
    (`scripts/publishNpmPkg/releaseFiles.test.mjs:41-43`), dieselbe Ursache zusätzlich
    in `:52`, `:61-64`, `:71`, `:77`, `:82` derselben Datei · keine Folgen zu verteilen
    (kein erledigtes Paket), »Offene Befunde« leer · Restplan unverändert
  - 2026-09-22 Zug 1: Implementierer beauftragt (sonnet, effort medium), Session `5ff55df3-p1-impl-1`, Report nach `paket-1.impl-1.json`
  - 2026-09-22 Zug 2: Report FERTIG · 7 Dateien geändert, 5 neu (`scripts/checkPeerDependenciesOnly.mjs`, `scripts/checkPeerDependenciesOnly/{findRuntimeDependencies,findRuntimeDependencies.test,checkPeerDependenciesOnly.test}.mjs`, `scripts/checkDocSnippets/typecheckInputs.test.mjs`) · roter Lauf der Inputs-Spec belegt (`.claude/skills/updating-changelog/SKILL.md`) · Arbeitsbaum schmutzig · Verify exit=0 (`paket-1.verify.log`)
  - 2026-09-22 Zug 3: Reviewer (sonnet, medium) — alle fünf Findings behoben, ein kleiner Befund, nichts kritisch/wichtig · Diff `paket-1.diff`, Report `paket-1.review-1.json`
  - 2026-09-22 Zug 4: keine Runde nötig (nur ein kleiner Befund)
  - 2026-09-22 Zug 5: Commit 19890c54, Verify aus Zug 2 (exit=0) trägt ihn

## Vorgehen

Die Konventionen aus dem Kopf von `./remediation-plan.md` gelten für jede Zeile:
Code, Kommentare und Doku auf Englisch, keine Finding-IDs, kein Rückblick auf den
Vorzustand (»früher«, »statt bisher«, »no longer«). Kommentare erklären, *warum*.

### 1. Root-Manifest umbenennen (CFG-025)

1. `package.json` (Root), Zeile 2: `"name": "@spearwolf/twopoint5d"` →
   `"name": "twopoint5d-workspace"`.
2. Zeile 3, `description`: `"a library to create 2.5d realtime graphics and pixelart with three.js"` →
   `"Nx + pnpm workspace of @spearwolf/twopoint5d, its browser tests and the lookbook"`.
   Grund: die Library-Beschreibung am Root führt `pnpm -r ls` und `pnpm why` genauso in die
   Irre wie der doppelte Name.
3. Nichts sonst zieht mit — Zug 0 hat nachgesehen: kein `--filter`, kein `pnpm -r` in
   Skripten, Workflows oder Doku; `.github/workflows/deploy.yml:39` liest den Namen aus
   `packages/twopoint5d/package.json`, nicht aus dem Root; `scripts/makePackageJson.mjs:28`
   liest vom Root nur `dependencies`/`devDependencies`; der Root ist kein Nx-Projekt
   (`pnpm nx show projects` → `twopoint5d-testing`, `twopoint5d`, `lookbook`).
   Das Lockfile schlüsselt Importer nach Pfad (`.`), nicht nach Name.
4. Prüfen: `pnpm install --frozen-lockfile` läuft durch, `git diff --exit-code -- pnpm-lock.yaml`
   ist leer, `pnpm -r ls --depth -1` zeigt `twopoint5d-workspace@0.0.0` für den Root und
   `@spearwolf/twopoint5d@0.21.2` genau einmal.

### 2. `noImplicitReturns` einschalten (TYPE-015)

1. `tsconfig.json` (Root), Zeile 27: `"noImplicitReturns": false,` → `"noImplicitReturns": true,`.
2. Zwischen `"esModuleInterop": true,` und `"experimentalDecorators": false,` (alphabetische
   Stelle, wie die übrigen explizit auf `false` gesetzten Optionen) einfügen, mit dem
   Kommentar im Stil des vorhandenen über `noUncheckedIndexedAccess`:

   ```jsonc
       // Off on purpose: it would make every optional member of the public option bags
       // reject an explicit `undefined`, in the published declarations too, with no known bug behind it.
       "exactOptionalPropertyTypes": false,
   ```

   Die Zeilenlänge an Prettier ausrichten (`pnpm format` darf den Kommentar umbrechen).
3. `noFallthroughCasesInSwitch` bleibt `false` und ohne Kommentar: ESLints `no-fallthrough`
   (in `eslint:recommended`) deckt es ab — das Audit sagt dazu ausdrücklich »nichts zu tun«.
4. Erwartete Fundstellen: keine. Zug 0 hat mit dem Flag probeweise geprüft (ohne die Datei
   zu ändern): `tsc -p packages/twopoint5d/tsconfig.typecheck.json --noImplicitReturns` (Library
   samt Specs), `tsc -p packages/twopoint5d-testing/tsconfig.json --noImplicitReturns`
   (Browsertests), `tsc -p apps/lookbook/tsconfig.json --noImplicitReturns` (Lookbook-`.ts`),
   die zwei `ts check`-Blöcke in `packages/twopoint5d/src/stage/README.md` und
   `astro check --tsconfig <kopie mit dem flag>` — alle 0 Fehler. Ob `astro check` die Option
   aus `--tsconfig` tatsächlich angewandt hat, ist nicht gegengeprüft; der Beleg ist
   `pnpm typecheck` nach der Umstellung. Taucht dort doch eine Fundstelle auf: den fehlenden
   Zweig mit einem expliziten `return` schließen, der das bestehende Verhalten beibehält
   (meist `return undefined;`), und im Report mit Datei und Zeile nennen. Liegt die Stelle
   in `packages/twopoint5d/src/` außerhalb von `*.spec.ts`, gilt dasselbe — die Änderung ist
   rein typseitig; ein Verhaltenswechsel ist `BLOCKIERT` mit Begründung.

### 3. Markdown-Inputs des Doku-Typechecks eingrenzen (CFG-022)

Entscheidung des Nutzers vom 2026-09-22: eingrenzen, nicht hinnehmen. Hintergrund: Das Nx-Target
`twopoint5d-testing:typecheck` führt `scripts/checkDocSnippets.mjs` aus, das nur
`git ls-files -- '*.md'` liest. Nx hasht aber jede nicht ignorierte Datei, die auf
`{workspaceRoot}/**/*.md` passt — `pnpm nx show target inputs twopoint5d-testing:typecheck --json`
listet heute `remediation-plan.md` (ungetrackt) als Input. Getrackte Markdown-Dateien liegen
(Stand Zug 0, 18 Stück) in: Root (`AGENTS.md`, `CLAUDE.md`, `README.md`),
`.claude/skills/updating-changelog/`, `apps/lookbook/`, `docs/`, `docs/remediation/` (fünf
`*-remediation-report.md`), `packages/twopoint5d/` samt `docs/`, `docs/proposals/`,
`src/stage/`. Ungetrackt daneben liegen während eines Remediation-Laufs `remediation-plan.md`
(Root) und `docs/remediation/paket-*.md`.

1. `packages/twopoint5d-testing/project.json`, Target `typecheck`, `inputs`: den Eintrag
   `"{workspaceRoot}/**/*.md"` an derselben Stelle ersetzen durch genau diese Einträge, in
   dieser Reihenfolge:

   ```json
   "{workspaceRoot}/AGENTS.md",
   "{workspaceRoot}/CLAUDE.md",
   "{workspaceRoot}/README.md",
   "{workspaceRoot}/.claude/skills/**/*.md",
   "{workspaceRoot}/apps/lookbook/**/*.md",
   "{workspaceRoot}/docs/*.md",
   "{workspaceRoot}/docs/remediation/*-remediation-report.md",
   "{workspaceRoot}/packages/twopoint5d/**/*.md",
   ```

   Die Root-Dateien stehen einzeln, nicht als `{workspaceRoot}/*.md`: am Root liegen die
   ungetrackten Arbeitsdateien, um die es geht. Aus demselben Grund nennt die Zeile für
   `docs/remediation/` das Namensmuster der archivierten Reports. JSON erlaubt in
   `project.json` keine Kommentare; die Begründung steht in `docs/architecture.md` (Schritt 3.4).
2. Neue Spec `scripts/checkDocSnippets/typecheckInputs.test.mjs` (läuft über
   `pnpm test:scripts`, das Glob `scripts/**/*.test.mjs` nimmt sie mit; die Negation
   `!{workspaceRoot}/scripts/checkDocSnippets/*.test.mjs` in `project.json` hält sie aus den
   Typecheck-Inputs). Sie fragt Nx selbst, statt Glob-Semantik nachzubauen:

   ```js
   import assert from 'node:assert/strict';
   import {execFileSync} from 'node:child_process';
   import {createRequire} from 'node:module';
   import path from 'node:path';
   import {it} from 'node:test';

   const repoRoot = path.resolve(import.meta.dirname, '../..');
   // resolves through the `./bin/*.js` export of nx to its CLI; started with this node, it needs
   // no shell and no pnpm shim on any platform
   const nxBin = createRequire(path.join(repoRoot, 'package.json')).resolve('nx/bin/nx.js');

   it('every tracked Markdown file is an input of twopoint5d-testing:typecheck', () => {
     const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.md'], {cwd: repoRoot, encoding: 'utf8'})
       .split('\0')
       .filter(Boolean);
     const {files} = JSON.parse(
       execFileSync(process.execPath, [nxBin, 'show', 'target', 'inputs', 'twopoint5d-testing:typecheck', '--json'], {
         cwd: repoRoot,
         encoding: 'utf8',
         // a spec starts no background daemon
         env: {...process.env, NX_DAEMON: 'false'},
       }),
     );
     const inputs = new Set(files);
     assert.deepEqual(
       tracked.filter((file) => !inputs.has(file)),
       [],
       'these tracked Markdown files are no input of twopoint5d-testing:typecheck, so a `ts check` block in them could turn red without invalidating the cache; add a glob for them to the typecheck inputs in packages/twopoint5d-testing/project.json',
     );
   });
   ```

   Oben in die Datei ein Kommentar von zwei, drei Zeilen: `scripts/checkDocSnippets.mjs`
   liest jede getrackte `*.md`, `project.json` nennt sie über Verzeichnisse, und diese Spec
   hält beides beisammen. Die Spec prüft bewusst nur die eine Richtung (jede getrackte Datei
   ist Input): die Gegenrichtung hinge an ungetrackten Dateien im Arbeitsbaum, und die
   dürfen nicht entscheiden, ob das Gate durchläuft — derselbe Grundsatz, den
   `scripts/checkDocSnippets.mjs:35` nennt.
   Zug 0 hat den Aufruf probeweise ausgeführt: `node node_modules/nx/dist/bin/nx.js show target inputs twopoint5d-testing:typecheck --json`
   mit `NX_DAEMON=false` → Exit 0, JSON mit `files`, 0,35 s. Nx liefert Pfade mit `/`,
   `git ls-files` ebenso.
3. Die Spec einmal rot sehen: den Eintrag `"{workspaceRoot}/.claude/skills/**/*.md"`
   vorübergehend aus `project.json` nehmen, `node --test scripts/checkDocSnippets/typecheckInputs.test.mjs`
   → rot mit `.claude/skills/updating-changelog/SKILL.md` in der Meldung, Eintrag zurück,
   grün. Den roten Lauf (Kommando und die Zeilen mit der Meldung) in den Report.
4. Prüfen: `pnpm nx show target inputs twopoint5d-testing:typecheck --check remediation-plan.md docs/remediation/paket-1.md`
   meldet beide als **kein** Input; mit `--check docs/architecture.md packages/twopoint5d/src/stage/README.md`
   beide als Input.
5. `docs/architecture.md`, §2, der Absatz ab Zeile 53 (»`twopoint5d-testing:typecheck` is the
   one consumer that also reads Markdown …«): den Satz »Its inputs are that build output, the
   tests, the tsconfig, `package.json`, the modules of the check and every `*.md` of the
   repository: a marked block can sit in any of them, and one that stops compiling has to turn
   the target red.« ersetzen durch:

   > Its inputs are that build output, the tests, the tsconfig, `package.json`, the modules of
   > the check and every Markdown file git tracks: a marked block can sit in any of them, and
   > one that stops compiling has to turn the target red. `project.json` names those files by
   > the directories that hold tracked docs, and the three at the root by name, so an untracked
   > note — which the check never reads — does not invalidate the cache.
   > `scripts/checkDocSnippets/typecheckInputs.test.mjs` asks Nx for the inputs it resolves and
   > fails on a tracked `*.md` outside them; a doc in a new place gets its glob there.

   Umbruch bei 88 Spalten wie der Rest der Datei.

### 4. Die Peer-only-Prüfung von `lintPkg` in ein Skript ziehen (READ-015)

Muster: die übrigen Publish-Helfer — ein Einstiegsskript unter `scripts/`, der Helfer als
reine Funktion im gleichnamigen Verzeichnis, daneben seine Spec (Vorbild
`scripts/makePackageJson/findUnpublishableSpecifiers.mjs` samt Test), und für die
Verdrahtung aus Exit-Code und Meldung eine Kindprozess-Spec (Vorbild
`scripts/makePackageJson/makePackageJson.test.mjs`) — bei einer Prüfung, deren einziges
Ergebnis ihr Exit-Code ist, ist genau diese Verdrahtung ihr Zweck.

1. `scripts/checkPeerDependenciesOnly/findRuntimeDependencies.mjs`:

   ```js
   const RUNTIME_SECTIONS = ['dependencies', 'optionalDependencies'];

   /**
    * Lists every entry of a manifest that npm installs along with the package: its
    * `dependencies` and its `optionalDependencies`, as `{section, name}` in that order.
    * A package that reaches its consumers with peer dependencies only lists none.
    */
   export function findRuntimeDependencies(manifest) {
     const found = [];
     for (const section of RUNTIME_SECTIONS) {
       for (const name of Object.keys(manifest?.[section] ?? {})) {
         found.push({section, name});
       }
     }
     return found;
   }
   ```

2. `scripts/checkPeerDependenciesOnly/findRuntimeDependencies.test.mjs` (`node:test`,
   `node:assert/strict`, `describe('findRuntimeDependencies', …)`), Fälle:
   - nennt jeden Eintrag aus `dependencies` und `optionalDependencies`, Abschnitt für
     Abschnitt: `{dependencies: {a: '^1.0.0'}, optionalDependencies: {b: '^2.0.0'}}` →
     `[{section: 'dependencies', name: 'a'}, {section: 'optionalDependencies', name: 'b'}]`
   - lässt `peerDependencies` und `devDependencies` außen vor:
     `{peerDependencies: {three: '~0.185.1'}, devDependencies: {vitest: '^5.0.1'}}` → `[]`
   - lässt ein Manifest ohne diese Abschnitte und mit leeren Abschnitten durch: `{}` und
     `{dependencies: {}, optionalDependencies: {}}` → `[]`
   - nennt einen Namen, der in beiden Abschnitten steht, zweimal, einmal je Abschnitt.
3. `scripts/checkPeerDependenciesOnly.mjs`, Einstieg; Kopfkommentar im Stil von
   `scripts/checkDocSnippets.mjs:1-12` (wozu, Aufruf, Exit-Codes):

   ```js
   // The library reaches its consumers with peer dependencies only, and the non-blocking audit
   // step in CI relies on that (docs/architecture.md, §3). This script fails on a manifest that
   // declares anything npm would install along with the package.
   //
   //   node scripts/checkPeerDependenciesOnly.mjs <package-dir>
   //
   // Exit 0: <package-dir>/package.json declares no `dependencies` and no `optionalDependencies`.
   // 1: it declares some, it cannot be read, or the argument is missing.

   import fs from 'node:fs';
   import path from 'node:path';
   import {findRuntimeDependencies} from './checkPeerDependenciesOnly/findRuntimeDependencies.mjs';

   const [packageDir] = process.argv.slice(2);
   if (packageDir == null) {
     console.error('usage: node scripts/checkPeerDependenciesOnly.mjs <package-dir>');
     process.exit(1);
   }

   const manifestPath = path.join(packageDir, 'package.json');
   let manifest;
   try {
     manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
   } catch (error) {
     console.error(`cannot read ${manifestPath}: ${error.message}`);
     process.exit(1);
   }

   const found = findRuntimeDependencies(manifest);
   for (const {section, name} of found) {
     console.error(`${manifestPath} declares ${section}.${name}; the library ships with peer dependencies only`);
   }
   if (found.length > 0) {
     process.exit(1);
   }
   ```

   Jeder Fehler endet mit einer Zeile statt eines Stacktraces — so halten es
   `makePackageJson.mjs` und `publishNpmPkg.mjs` bereits.
4. `scripts/checkPeerDependenciesOnly/checkPeerDependenciesOnly.test.mjs`, Kindprozess-Spec
   nach dem Muster von `makePackageJson.test.mjs` (`spawnSync(process.execPath, [script, dir])`,
   Wegwerfverzeichnis per `fs.mkdtempSync(path.join(os.tmpdir(), 'checkPeerDependenciesOnly-'))`,
   Aufräumen in `after`), Fälle:
   - Manifest mit `dependencies: {foo: '^1.0.0'}` → Exit 1, `stderr` passt auf
     `/declares dependencies\.foo; the library ships with peer dependencies only/`
   - Manifest nur mit `peerDependencies: {three: '~0.185.1'}` → Exit 0, `stderr` leer
   - `package.json` mit Inhalt `{` → Exit 1, `stderr` passt auf `/cannot read .*package\.json: /`,
     kein Stacktrace (`assert.doesNotMatch(stderr, /^\s+at /m)`)
   - ohne Argument → Exit 1, `stderr` passt auf `/^usage: /`
5. `packages/twopoint5d/package.json`, Zeile 56, `lintPkg`:
   `"pnpm exec publint dist && node ../../scripts/checkPeerDependenciesOnly.mjs dist"`.
   `publishNpmPkg` ruft `pnpm run lintPkg` auf und bleibt unverändert. Das Target `lintPkg`
   ist ungecacht (`nx.json`, `targetDefaults.lintPkg` ohne `cache`), es gibt keine Inputs
   nachzuziehen.
6. `docs/architecture.md`, §3, Bullet `lintPkg` (ab Zeile 89): nennt das Skript —
   »`lintPkg` runs publint against `dist/` and then `scripts/checkPeerDependenciesOnly.mjs`,
   which fails as soon as `dist/package.json` declares `dependencies` or
   `optionalDependencies`.« Der Rest des Bullets bleibt.

### 5. Erwartete Pfade der releaseFiles-Spec mit `path.join` bilden (TEST-040)

`releaseFiles` bildet Pfade mit `path.resolve`; die Spec setzt ihre Erwartungen per
Template-String mit `/` zusammen und prüft zwei Meldungen per Regex mit `\/`. Unter Windows
liefe beides rot. Betroffen ist die ganze Datei, nicht nur `:41-43`:

1. `scripts/publishNpmPkg/releaseFiles.test.mjs:41-43`, `:52`, `:61-64`: jedes
   `` `${ws}/LICENSE` ``, `` `${dist}/LICENSE` ``, `` `${project}/CHANGELOG.md` `` usw. →
   `path.join(ws, 'LICENSE')`, `path.join(dist, 'LICENSE')`, `path.join(project, 'CHANGELOG.md')`
   usw. — dieselben Segmente, nur über `path.join`.
2. `:71` und `:77`: die Regexe `/^\S*\/project\/CHANGELOG\.md does not exist$/` und
   `/^\S*\/project\/README\.md does not exist$/` durch exakte Meldungen ersetzen:
   `` {message: `${path.join(project, 'CHANGELOG.md')} does not exist`} `` bzw. mit
   `'README.md'`. Grund: `\S*` scheitert zusätzlich an einem Temp-Pfad mit Leerzeichen
   (`C:\Users\Jane Doe\…`), und die exakte Form ist die, die `:82` bereits nutzt.
3. `:82`: `` `${ws}/LICENSE, ${project}/CHANGELOG.md, ${project}/README.md do not exist` `` →
   dieselbe Meldung aus `path.join(ws, 'LICENSE')`, `path.join(project, 'CHANGELOG.md')`,
   `path.join(project, 'README.md')`.
4. Die Testnamen bleiben. Kein Kommentar über Windows nötig — `path.join` erklärt sich selbst.

### 6. Doku zu `pnpm test:scripts` nachziehen

1. `docs/architecture.md`, §3, Bullet `test:scripts` (ab Zeile 93), neuer Wortlaut:

   > - `test:scripts` runs `node --test` over `scripts/**/*.test.mjs`, the specs of the
   >   publish pipeline's helpers and of `makePackageJson.mjs` and
   >   `checkPeerDependenciesOnly.mjs` themselves (§4, §6), of the CI cache server, of the
   >   helpers of the code block check, the check that every tracked Markdown file is an
   >   input of `twopoint5d-testing:typecheck`, and the check that the lookbook serves the
   >   script `RainbowLine` loads at runtime.
2. `docs/architecture.md`, §6 (ab Zeile 271): den Satz »One spec starts `makePackageJson.mjs`
   itself, as a child process in a throwaway project directory, because its exit codes, its
   messages and the manifest it does not write are wiring that no helper test sees.« ersetzen
   durch:

   > Two specs start a script itself, as a child process: `makePackageJson.mjs` in a
   > throwaway project directory and `checkPeerDependenciesOnly.mjs` against a throwaway
   > manifest, because their exit codes, their messages and the manifest the first one does
   > not write are wiring that no helper test sees.

   Nach dem Satz »No spec runs `publishNpmPkg.mjs`, … nor `checkDocSnippets.mjs`, which reads
   git and the file system.« anfügen:

   > `scripts/checkDocSnippets/typecheckInputs.test.mjs` runs git and Nx itself: it holds the
   > Markdown inputs of `twopoint5d-testing:typecheck` to the files git tracks.

   Umbruch bei 88 Spalten; der vorhandene Absatz bricht mitten im Satz um (»cleaned up. One
   spec starts«) — beim Ersetzen darf er neu umbrochen werden.
3. `AGENTS.md`, Bullet `pnpm test:scripts` (Zeilen 40-43): »plus one spec that starts
   `makePackageJson.mjs` as a child process and one that checks the lookbook's vendored
   `rainbow-line` script« → »plus specs that start `makePackageJson.mjs` and
   `checkPeerDependenciesOnly.mjs` as child processes, one that checks the lookbook's vendored
   `rainbow-line` script, and one that asks Nx whether every tracked Markdown file is an input
   of the docs' type check«. Der Rest der Zeile bleibt.

## Urteil des Reviewers

- CFG-025 behoben — `package.json:2-3`, Name `twopoint5d-workspace`, Beschreibung mitgezogen
- TYPE-015 behoben — `tsconfig.json:30` `noImplicitReturns: true`, `:16-18`
  `exactOptionalPropertyTypes: false` mit Kommentar
- CFG-022 behoben — `packages/twopoint5d-testing/project.json` (Typecheck-Inputs eingegrenzt)
  und `scripts/checkDocSnippets/typecheckInputs.test.mjs` als Schutz-Spec im `test:scripts`-Gate
- READ-015 behoben — `scripts/checkPeerDependenciesOnly.mjs` samt
  `scripts/checkPeerDependenciesOnly/findRuntimeDependencies.mjs` und zwei Specs, aufgerufen aus
  `packages/twopoint5d/package.json:56` (`lintPkg`)
- TEST-040 behoben — `scripts/publishNpmPkg/releaseFiles.test.mjs`, alle sechs Stellen über
  `path.join`, exakte Meldungen statt `/`-Regexe

Kleine Befunde:
- `tsconfig.json:18`: `exactOptionalPropertyTypes` steht nach `experimentalDecorators` statt
  davor (alphabetisch `exa` < `exp`, wie der Detailplan vorsah); `tsc` ist die Reihenfolge egal.

## Entscheidungen in Zug 0

- **Beschreibung des Root-Manifests mit umbenannt** (Schritt 1.2): dieselbe Verwechslung wie
  der Name, eine Zeile, harness-intern.
- **`exactOptionalPropertyTypes` als explizites `false` mit Kommentar** statt eines Kommentars
  über einer fehlenden Option: die tsconfig führt ihre bewusst abgeschalteten Optionen
  ohnehin explizit (`downlevelIteration`, `noFallthroughCasesInSwitch`), und ein Kommentar
  braucht eine Zeile, an der er hängt.
- **Root-Markdown einzeln, `docs/remediation/` per Namensmuster** (Schritt 3.1): das ist die
  vom Nutzer freigegebene Eingrenzung, nur feiner an den zwei Stellen, an denen ungetrackte
  Laufdateien neben getrackter Doku liegen. Ein Verzeichnis-Glob dort ließe genau den
  beschriebenen Cache-Miss stehen.
- **Schutz-Spec gegen die Eingrenzung** (Schritt 3.2): die Eingrenzung selbst öffnet ein
  neues Risiko, das `**/*.md` nicht hatte — eine neue getrackte Doku außerhalb der Globs
  wäre kein Input, ein roter `ts check`-Block bliebe als grüner Cache-Treffer stehen. Das ist
  Schaden aus diesem Paket und gehört deshalb in dieses Paket. Nx selbst zu fragen
  (`nx show target inputs --json`) statt Glob-Semantik nachzubauen, weil nur Nx entscheidet,
  was es hasht. Die Nx-Alternative `runtime`-Input (`git ls-files | git hash-object`) wäre
  ein anderer Weg als der freigegebene und bliebe außen vor.
- **Kindprozess-Spec für `checkPeerDependenciesOnly.mjs`** (Schritt 4.4) zusätzlich zur
  Helfer-Spec: das Skript hat als Ergebnis nur seinen Exit-Code; dieselbe Begründung trägt in
  `docs/architecture.md` §6 bereits die Kindprozess-Spec von `makePackageJson.mjs`.
- **TEST-040 über die ganze Datei**: die Fundstelle `:41-43` ist ein Beispiel; `:52`,
  `:61-64`, `:71`, `:77`, `:82` haben dieselbe Ursache. Andere Specs unter `scripts/`
  enthalten keine per `/` gebauten Pfad-Erwartungen (`git grep` über `scripts/*.test.mjs`,
  Treffer nur URLs in `createCacheServer.test.mjs`).
- **Restplan unverändert**: Paket 2 teilt keine Datei mit diesem Paket und hängt von nichts
  darin ab. Einzige Berührung: `noImplicitReturns` gilt nach dem Commit auch für die Specs
  und Browsertests (`checkJs`), die Paket 2 schreibt — das gehört in die
  `Schnittstellen:`-Zeile dieses Pakets.
- **Modell mittlere Stufe, Effort `medium`**: zwölf Dateien, zwei davon Prosa-Doku, fünf neue
  Skript-/Spec-Dateien; kein Umbau über Modulgrenzen, keine Nebenläufigkeit, keine
  öffentliche API der Library.

## Findings im Volltext

**CFG-025 · low · `package.json:2`** — Das Root-Manifest anders benennen als die Library
Root und `packages/twopoint5d` heißen beide `@spearwolf/twopoint5d`. `pnpm -r ls` listet den
Namen doppelt, und `pnpm outdated -r` schreibt die Root-devDependencies dem Library-Paket zu.
`--filter` funktioniert nur über eine implizite Regel.
Empfehlung: Das Root umbenennen, etwa in `twopoint5d-workspace`.

**TYPE-015 · info · `tsconfig.json:27`** — noImplicitReturns einschalten;
exactOptionalPropertyTypes bewusst auslassen
`noFallthroughCasesInSwitch` ist bereits durch ESLints `no-fallthrough` (in
`eslint:recommended`) abgedeckt — nichts zu tun. `noImplicitReturns` ist billig, fängt die
»Return in einem Zweig vergessen«-Klasse, und die strenge Basis (`noUncheckedIndexedAccess`,
`noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`) zeigt, dass die Codebasis es
verträgt. `exactOptionalPropertyTypes` würde jede Options-Bag im öffentlichen `.d.ts` und
jedes `foo?: T = undefined` in Tests berühren — Churn ohne bekannten Bug dahinter.
Empfehlung: `noImplicitReturns: true` setzen, das Aufkommende fixen (vermutlich eine
Handvoll), und die Entscheidung gegen `exactOptionalPropertyTypes` in einem Kommentar neben
der Option festhalten.

**CFG-022 · info · `packages/twopoint5d-testing/project.json:15`** — Der Typecheck-Input
`{workspaceRoot}/**/*.md` erfasst auch ungetrackte Dateien
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. Das Target
`twopoint5d-testing:typecheck` nimmt jede `.md` im Workspace als Input, der Snippet-Check
liest aber nur getrackte Dateien. Eine lokale Notiz invalidiert den Cache ohne Anlass —
unnötige Misses, kein falsches Ergebnis (so geplant).
Empfehlung: Hinnehmen oder die Inputs auf die Verzeichnisse mit getrackter Doku eingrenzen,
sobald die Misses spürbar werden. — Entschieden (Plan, »Entscheidungen«, 2026-09-22):
eingrenzen.

**READ-015 · info · `packages/twopoint5d/package.json:56`** — Die lintPkg-Prüfung auf
Laufzeit-Dependencies steckt in einem node -e-Einzeiler
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. Die Invariante
»das Paket liefert nur Peer-Dependencies aus« steht als rund 250 Zeichen langer
`node -e`-String mit escapten Anführungszeichen im Script `lintPkg` — schwer zu lesen, nicht
testbar.
Empfehlung: In ein kleines Skript unter `scripts/` ziehen (mit Spec, wie die übrigen
Publish-Helfer) und aus `lintPkg` aufrufen.

**TEST-040 · info · `scripts/publishNpmPkg/releaseFiles.test.mjs:41-43`** — Die
releaseFiles-Spec setzt erwartete Pfade mit / zusammen
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. Die erwarteten
`src`/`dst`-Pfade entstehen per Template-String mit `/`, `releaseFiles` selbst nutzt
`path.join`; unter Windows liefe die Spec rot. CI läuft auf Linux, betroffen wäre ein lokaler
Lauf unter Windows — derselbe Kreis, für den `npmCommand` einen Windows-Zweig trägt.
Empfehlung: Die Erwartungen mit `path.join` bilden.
(Anmerkung Zug 0: `releaseFiles.mjs` nutzt `path.resolve`, nicht `path.join`; bei den
absoluten Pfaden der Spec liefern beide dasselbe.)
