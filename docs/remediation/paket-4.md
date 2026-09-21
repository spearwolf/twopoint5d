# Paket 4 — Publish-Skripte und Paketinhalt

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: DOC-035 (low), SEC-004 (low), TEST-027 (low), DOC-049 (info), CONS-050 (info), CFG-016 (low)
- Aufgenommen in Zug 0: Nebenbefund »JS-Source-Maps zeigen ins Leere« (gleiche Ursache und gleiche Zeile wie CFG-016, siehe »Entscheidungen in Zug 0«)
- Ziel: Die Publish- und Manifest-Skripte scheitern verständlich, rufen keine Shell mit interpolierten Werten auf, ihr Abbruchpfad ist getestet, und das Paket liefert keine Declaration-Maps ins Leere.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/tsconfig.build.json` (Schritt 1)
  - `scripts/publishNpmPkg/parseArguments.mjs` (neu), `scripts/publishNpmPkg/parseArguments.test.mjs` (neu) (Schritt 2)
  - `scripts/publishNpmPkg.mjs` (Schritte 3 und 4)
  - `scripts/makePackageJson/resolveDependencies.mjs`, `scripts/makePackageJson/resolveDependencies.test.mjs` (Schritt 5)
  - `scripts/makePackageJson/makePackageJson.test.mjs` (neu) (Schritt 6)
  - `docs/architecture.md` §4 und §6, `AGENTS.md` (eine Zeile), `packages/twopoint5d/CHANGELOG.md` (ein Eintrag) (Schritt 7)
  - nicht anfassen: `scripts/makePackageJson.mjs` (TEST-027 testet es, wie es ist; nur die Negativprobe in Schritt 6 fasst es vorübergehend an), Root-`tsconfig.json` (»lokal bleibt es an«, Entscheidung CFG-016), `packages/twopoint5d/tsconfig.json`, `packages/twopoint5d/tsconfig.typecheck.json`, `nx.json`, `packages/twopoint5d/project.json` (das Target `build` hat `{projectRoot}/tsconfig.build.json` schon als Input), `packages/twopoint5d/package.json`, `.github/**` (der Kommentar `deploy.yml:31` »publishNpmPkg.mjs skips the same two cases« bleibt wahr — die Skip-Regel ändert sich nicht), `scripts/publishNpmPkg/publishedVersions.mjs`, `scripts/makePackageJson/findUnpublishableSpecifiers.mjs`, `scripts/makePackageJson/removeDistPathPrefix.mjs`, `.claude/**`, alles aus »Offene Befunde« des Plans (melden, nicht beheben)

- Vorgehen:
  1. **Keine Maps im Publish-Build (CFG-016 und JS-Source-Maps).**
     `packages/twopoint5d/tsconfig.build.json` wird zu (JSONC, Kommentare wie in
     `tsconfig.typecheck.json` derselben Mappe):
     ```jsonc
     {
       // `pnpm build` emits what npm gets, and the package ships `dist/` without `src/`. A
       // declaration map or a source map would point at `src/`, so the build writes neither.
       "extends": "./tsconfig.json",
       "compilerOptions": {
         "declarationMap": false,
         "sourceMap": false
       },
       "exclude": ["**/*.spec.ts"]
     }
     ```
     Der Kommentar darf anders formuliert sein, sagt aber beides: *was* npm bekommt und
     *warum* deshalb keine Map. Root-`tsconfig.json:11` (`declarationMap: true`) und `:39`
     (`sourceMap: true`) bleiben stehen. Zug 0 hat im gebauten `dist/lib` von `e011cfe5` 268
     Maps gezählt (134 `.d.ts.map`, 134 `.js.map`, jede mit `"sources":["../../src/…"]`,
     ohne `sourcesContent`). Nach dem Gate müssen es 0 sein, und keine `.js`/`.d.ts` in
     `dist/lib` trägt noch ein `//# sourceMappingURL=` (Teil des Verify-Kommandos).
     Achtung lokal: `tsc` räumt `dist/lib` nicht auf, ein `pnpm build` ohne vorheriges
     `pnpm clean` lässt die alten Maps liegen. Das Gate beginnt mit `clean`, der Deploy-Job
     baut aus einem frischen Checkout, beide sind davon nicht betroffen.

  2. **Argumente von `publishNpmPkg.mjs` als Helfer (DOC-035).** Neu
     `scripts/publishNpmPkg/parseArguments.mjs`, im Stil von `publishedVersions.mjs`
     (JSDoc über der Funktion, englisch):
     ```js
     export const USAGE = 'Usage: node scripts/publishNpmPkg.mjs <package-dir> [--dry-run]';

     /**
      * Reads the command line of publishNpmPkg.mjs: exactly one package directory and an
      * optional `--dry-run`. Anything else throws — an unknown option may be a misspelled
      * `--dry-run`, and a publish must not go ahead on a guess.
      */
     export function parseArguments(args) {
       const positionals = [];
       let dryRun = false;
       for (const arg of args) {
         if (arg === '--') {
           // `pnpm run <script> -- --dry-run` hands the `--` on to the script
           continue;
         }
         if (arg === '--dry-run') {
           dryRun = true;
         } else if (arg.startsWith('-')) {
           throw new Error(`unknown option: ${arg}`);
         } else {
           positionals.push(arg);
         }
       }
       if (positionals.length === 0) {
         throw new Error('missing <package-dir>');
       }
       if (positionals.length > 1) {
         throw new Error(`expected one <package-dir>, got ${positionals.length}: ${positionals.join(' ')}`);
       }
       return {packageDir: positionals[0], dryRun};
     }
     ```
     Kein `util.parseArgs`: dessen Fehlertext für eine unbekannte Option empfiehlt, sie
     hinter `--` zu setzen, und genau das filtert diese Funktion weg. Die Werte sind fest:
     `USAGE` wortgleich, die drei Fehlermeldungen wortgleich (die Tests prüfen sie).
     Neu `scripts/publishNpmPkg/parseArguments.test.mjs` (`node:test`, `node:assert/strict`,
     `describe('parseArguments')`, Testnamen als Satz wie in `publishedVersions.test.mjs`),
     mindestens diese Fälle:
     - `['dist']` → `{packageDir: 'dist', dryRun: false}`
     - `['dist', '--dry-run']` und `['--dry-run', 'dist']` → `{packageDir: 'dist', dryRun: true}`
     - `['dist', '--', '--dry-run']` → `{packageDir: 'dist', dryRun: true}`
     - `[]` und `['--dry-run']` → wirft `/missing <package-dir>/`
     - `['dist', '--dryrun']`, `['dist', '--dry-run=true']`, `['-n', 'dist']` → wirft `/unknown option: <arg>/`
     - `['dist', 'other']` → wirft `/expected one <package-dir>, got 2: dist other/`
     Roter Lauf zuerst: die Testdatei vor dem Helfer anlegen,
     `node --test scripts/publishNpmPkg/parseArguments.test.mjs` scheitert (Modul fehlt);
     Ausgabe und Exit-Code in den Report.

  3. **Verdrahtung in `scripts/publishNpmPkg.mjs` (DOC-035).** Als erste Anweisung nach den
     Imports, vor `workspaceRoot` und vor jedem Dateizugriff:
     ```js
     let args;
     try {
       args = parseArguments(process.argv.slice(2));
     } catch (error) {
       console.error(error.message);
       console.error(USAGE);
       process.exit(1);
     }

     const DRY_RUN = args.dryRun;
     ```
     Die alte Zeile 7 (`process.argv.includes('--dry-run')`) entfällt, Zeile 11 wird
     `const packageRoot = path.resolve(projectRoot, args.packageDir);`. Die Ausgabe
     `dryRun: yes|no` und alles danach bleiben, wie sie sind.
     Beleg vorher/nachher, **jeder Aufruf mit `--dry-run`** (Konvention des Laufs), aus
     `packages/twopoint5d`, `dist/` gebaut:
     - `node ../../scripts/publishNpmPkg.mjs --dry-run`: vorher `ENOENT` auf
       `…/packages/twopoint5d/--dry-run/package.json` mit Stacktrace, nachher
       `missing <package-dir>` + Usage-Zeile, Exit 1.
     - `node ../../scripts/publishNpmPkg.mjs dist --dry-run --dryrun`: vorher läuft das
       Skript bis zur npm-Abfrage durch (bei 0.21.2 »already released«, Exit 0), nachher
       `unknown option: --dryrun` + Usage-Zeile, Exit 1, **ohne** npm-Abfrage.
     Den Fall ganz ohne Argumente deckt der Unit-Test (`[]`); ihn per Hand zu starten
     hieße, das Skript ohne `--dry-run` aufzurufen.

  4. **Keine Shell für npm (SEC-004).** In `scripts/publishNpmPkg.mjs`:
     - `` exec(`npm show ${pkgJson.name} versions --json`, (error, stdout, stderr) => …) `` →
       `execFile('npm', ['show', pkgJson.name, 'versions', '--json'], (error, stdout, stderr) => …)`.
       Der Callback bleibt, wie er ist, bis auf den Text `exec() panic: …`: er nennt eine
       Funktion, die es danach nicht mehr gibt → `npm show failed: ${stderr}`.
     - Auch der zweite Aufruf ohne Shell, damit die Datei gar keine Shell mehr startet:
       `` execSync(`npm publish --access public${dryRun ? ' --dry-run' : ''}`, {cwd}) `` →
       `execFileSync('npm', ['publish', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])], {cwd})`.
       Optionen sonst unverändert (kein `stdio`), damit die Ausgabe im Deploy-Log dieselbe
       bleibt.
     - Import-Zeile 1 wird `import {execFile, execFileSync} from 'node:child_process';`.
     Beleg: `git grep -nE '\bexec(Sync)?\(' scripts/publishNpmPkg.mjs` findet nichts. Dazu
     ein Lauf bis zur echten npm-Abfrage, aus `packages/twopoint5d` nach dem Gate:
     `node ../../scripts/publishNpmPkg.mjs dist --dry-run` → erwartet
     `skip publishing, version 0.21.2 is already released`, Exit 0. Braucht Netz; ohne Netz
     kommt `npm show failed: …` mit Exit 1 — dann die Ausgabe in den Report, kein Blocker.

  5. **Workspace-Range: getrimmt und so, wie sie geschrieben steht (CONS-050, DOC-049).**
     In `scripts/makePackageJson/resolveDependencies.mjs`:
     - Zeile 44 trimmt die Range dort, wo sie entsteht, damit jede Prüfung danach und das
       Manifest denselben Wert sehen:
       ```js
       // whitespace around the range belongs to no version range; every check below and the
       // manifest see the trimmed value
       const range = specifier.startsWith('workspace:') ? specifier.slice('workspace:'.length).trim() : '*';
       ```
       Damit fällt auch der Fall `workspace: ` (nur Leerraum) unter `range === ''` und wird
       abgewiesen. Zug 0 hat nachgewiesen, dass er heute als Versionsbereich `" "` ins
       Manifest geht, an `findUnpublishableSpecifiers` vorbei (es prüft auf das Präfix
       `workspace:`): `{a: 'workspace: ', b: 'workspace: ^2.0.0 ', c: 'workspace: *'}` wird
       heute zu `{a: ' ', b: ' ^2.0.0 ', c: ' *'}`.
     - DOC-049, über dem `if` in Zeile 61 ein Satz, der `validRange('') === '*'` nennt:
       ```js
       // semver's validRange('') answers '*', so the empty range needs a check of its own
       if (range === '' || validRange(range) == null) {
       ```
       Der Kommentar in Zeilen 62–63 bleibt.
     - CONS-050, über Zeilen 74–75 der Vorsatz (Entscheidung im Plan: zurück geht der
       getrimmte Rohwert, der Grund steht an der Stelle):
       ```js
       // the range ships as written: validRange only vouches for it, and its normalized form
       // (`^1` becomes `>=1.0.0 <2.0.0-0`) is not what the manifest says
       console.log('resolve package version', pkgName, '->', range);
       return range;
       ```
     Regressionstests zuerst, in `resolveDependencies.test.mjs`, im Stil der vorhandenen
     Fälle (`resolve(section, {})`; `@scope/other` hat die Version `2.3.4-dev`):
     - `a workspace: range ships trimmed and as written`:
       `{'@scope/other': 'workspace: ^2.0.0 '}` → `{'@scope/other': '^2.0.0'}` und
       `{'@scope/other': 'workspace:1.x || >=2.5.0'}` → `{'@scope/other': '1.x || >=2.5.0'}`
       (nicht die normalisierte Form `>=1.0.0 <2.0.0-0||>=2.5.0`)
     - `a workspace: operator with whitespace around it takes the version of the package it names`:
       `'workspace: * '` → `'^2.3.4'`, `'workspace: ~'` → `'~2.3.4'`
     - im vorhandenen Fall `a workspace: specifier whose range is no version range stays as it is`
       eine Zeile mehr: `'workspace: '` bleibt `'workspace: '`
     Roter Lauf vor dem Fix: `node --test scripts/makePackageJson/resolveDependencies.test.mjs`
     — erwartet rot sind der erste Teil des ersten Falls, der zweite Fall und die neue
     Zeile; `1.x || >=2.5.0` ist heute schon grün und hält den Vorsatz fest. Ausgabe in den
     Report.

  6. **Der Abbruch von `makePackageJson.mjs` als Prozess (TEST-027).** Neu
     `scripts/makePackageJson/makePackageJson.test.mjs`. Das Skript nimmt den Workspace-Root
     aus seinem eigenen Pfad und das Projekt aus `cwd`; der Test startet es daher per
     `spawnSync(process.execPath, [script], {cwd: dir, encoding: 'utf8'})` mit
     `script = fileURLToPath(new URL('../makePackageJson.mjs', import.meta.url))` in einem
     Projektverzeichnis aus `fs.mkdtempSync(path.join(os.tmpdir(), 'makePackageJson-script-'))`.
     Es liest dabei Root-`package.json` und `pnpm-workspace.yaml` des Repos, schreibt nur
     nach `<dir>/dist/package.json`.
     - **In jedem Verzeichnis zuerst `dist/` anlegen**, mit einem Kommentar, warum: ohne
       `dist/` scheitert der Schreibversuch selbst mit Exit 1 (in Zug 0 gemessen: gültiges
       Manifest, kein `dist/` → `ENOENT`, Exit 1), und der Test könnte den Wächter nicht von
       einem Absturz unterscheiden.
     - Fall `refuses a specifier npm cannot install: exit code 1, no manifest written`:
       `package.json` = `{name: '@scope/probe', version: '1.0.0', peerDependencies: {three: 'catalog:nope'}}`
       → `status === 1`, `fs.existsSync(<dir>/dist/package.json) === false`, `stderr`
       enthält `peerDependencies.three is "catalog:nope"`.
     - Gegenprobe `writes the manifest when every specifier is a version range`:
       dasselbe mit `three: '^0.185.0'` → `status === 0` (bei Fehlschlag `stderr` in der
       Assertion-Meldung), `<dir>/dist/package.json` existiert, `peerDependencies.three`
       darin ist `'^0.185.0'`. Sie belegt, dass der Aufbau trägt; ohne sie bewiese ein
       grüner Abbruchfall nichts.
     - Aufräumen in `after()`: jedes angelegte Verzeichnis mit
       `fs.rmSync(dir, {recursive: true, force: true})`.
     Kein roter Lauf möglich (der Wächter arbeitet schon, das Finding ist eine
     Testlücke), stattdessen die **Negativprobe**: in `scripts/makePackageJson.mjs:57`
     `process.exit(1);` vorübergehend auskommentieren, den Test laufen lassen (der
     Abbruchfall muss rot werden: Exit 0 und Datei geschrieben), zurücksetzen und mit
     `git diff --exit-code scripts/makePackageJson.mjs` (Exit 0) belegen, dass die Datei
     wieder unverändert ist. Beide Läufe in den Report.

  7. **Doku.**
     - `docs/architecture.md` §4 (»Build and publish pipeline«):
       - Satz zum Build (Z. 153–154): der Publish-Build schreibt weder Declaration-Maps noch
         Source-Maps, weil beide auf `src/` zeigten, das das Paket nicht enthält. Dazu die
         Folge im Workspace, als Tatsache: ein »Go to definition« aus der Lookbook oder dem
         Testpaket in die Bibliothek landet in `dist/lib/*.d.ts`, und der Browser zeigt deren
         `.js`.
       - Z. 162 »a spelled-out range ships as it is«: sie geht so ins Manifest, wie sie
         geschrieben steht, nur ohne umgebenden Leerraum, nicht in der von semver
         normalisierten Form; eine Range aus nichts als Leerraum ist keine.
       - Im Absatz Z. 175–178, hinter dem Satz »… and then publishes `dist/`.«, ein Satz zur
         Kommandozeile:
         `publishNpmPkg.mjs <package-dir> [--dry-run]` bricht bei fehlendem Verzeichnis und
         bei jeder anderen Option — auch einem vertippten `--dry-run` — mit einer
         Usage-Zeile und Exit 1 ab, bevor es npm fragt; npm ruft es ohne Shell auf.
     - `docs/architecture.md` §6, Z. 231–233 (»Their specs import only the helper modules,
       never `publishNpmPkg.mjs` …«): neu fassen — eine Spec startet `makePackageJson.mjs`
       selbst, als Kindprozess in einem Wegwerf-Projektverzeichnis, weil Exit-Code und das
       nicht geschriebene Manifest Verdrahtung sind, die kein Helfer-Test sieht;
       `publishNpmPkg.mjs` läuft in keiner Spec, weil es npm fragt, sobald seine Argumente
       passen; `checkDocSnippets.mjs` bleibt wie beschrieben.
     - `AGENTS.md` ab Z. 40, der Punkt zu `pnpm test:scripts`: »over the helpers of the
       publish pipeline« stimmt danach nicht mehr ganz — ergänzen, dass eine Spec
       `makePackageJson.mjs` als Kindprozess startet. Sonst nichts an `AGENTS.md`.
     - `packages/twopoint5d/CHANGELOG.md`: ein Eintrag unter `## [Unreleased]` →
       `### Removed`, ans Ende des Abschnitts, mit dem Projekt-Skill `updating-changelog`
       (Keep a Changelog, veröffentlichte Abschnitte bleiben unberührt; keine
       Migrationsanleitung, die öffentliche API ändert sich nicht). Inhalt: das
       veröffentlichte Paket enthält keine Declaration-Maps und keine Source-Maps mehr;
       beide zeigten auf die TypeScript-Quellen unter `src/`, die das Paket nicht enthält,
       sodass weder »Go to definition« noch ein Debugger dahinter etwas fand; `.d.ts` und
       `.js` verlieren nur ihren `sourceMappingURL`-Kommentar. Form wie die vorhandenen
       Einträge (`- remove …: …`).
     Alle Sätze englisch und ohne Rückblick auf den Vorzustand (Konventionen des Plans);
     die Changelog-Zeile ist der eine Ort, an dem eine Änderung als Änderung benannt wird.

- Verify: `pnpm run ci && test -z "$(find packages/twopoint5d/dist -name '*.map' -print -quit)" && ! grep -rq sourceMappingURL packages/twopoint5d/dist/lib`
  — dazu, nicht Teil des Kommandos: die Belege aus den Schritten 2–6 (rote Läufe,
  Negativprobe, Vorher/Nachher der Kommandozeile, Dry-Run bis zur npm-Abfrage).
  `test:scripts` stand in Zug 0 bei 49/49 und wächst um die neuen Fälle.
- Commit: `build: ship the package without maps that point at sources it leaves out, stop the publish script with a usage line on a missing or unknown argument, ask npm without a shell, ship a spelled-out workspace range as written and test that the manifest script refuses what npm cannot install`
- Reviewer: mittlere Stufe, Effort medium — kleiner, mechanischer Diff; der Publish-Pfad
  ist die empfindliche Stelle, deshalb nicht die günstigste.
- Schnittstellen für Zug 5 (in den Plan): `scripts/publishNpmPkg.mjs <package-dir> [--dry-run]`,
  jede andere Option und ein zweites Verzeichnis → Exit 1 vor jeder npm-Abfrage; Helfer
  `parseArguments(args)` und `USAGE` in `scripts/publishNpmPkg/parseArguments.mjs` ·
  npm-Aufrufe per `execFile`/`execFileSync` · `packages/twopoint5d/tsconfig.build.json`
  emittiert keine Maps · `scripts/makePackageJson/makePackageJson.test.mjs` startet
  `makePackageJson.mjs` als Kindprozess · Workspace-Ranges getrimmt · die neue Lage der
  Skip-Regel in `scripts/publishNpmPkg.mjs` (Paket 1 nennt sie noch bei `:21-34`)
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · alle sechs Findings unverändert, keine Datei seit dem Audit angefasst (letzter Commit `e7bc31f0`, 2026-09-20): DOC-035 `publishNpmPkg.mjs:11`, SEC-004 `:26` (Audit: `:29`), TEST-027 `makePackageJson.mjs:50-57`, DOC-049 `resolveDependencies.mjs:61`, CONS-050 `:74-75`, CFG-016 `tsconfig.json:11` (268 Maps in `dist/lib`) · aufgenommen: JS-Source-Maps (gleiche Ursache wie CFG-016) · in DOC-035 aufgegangen: vertipptes `--dry-run` veröffentlicht echt, `--dry-run` vor dem Verzeichnis wird als Verzeichnis gelesen · in CONS-050 aufgegangen: `workspace: ` geht als `" "` ins Manifest · keine offenen Folgen zu verteilen (Paket 1: in Paket 2 aufgegangen, Pakete 2, 3, 3b: —) · aus »Offene Befunde« nichts übernommen (keine Ursache geteilt) · Restplan: keine weiteren offenen Pakete, danach der Abschluss mit der Drain-Runde · Proben unter `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/367efc15-0412-4dbd-9063-976d64b33097/scratchpad/` (`argprobe/`, `mpj/`)
  - 2026-09-21 Zug 1: Implementierer beauftragt (sonnet, effort medium), Session `remediate-twopoint5d-p4-impl-1`, Brief `paket-4.impl-1.brief.txt`, Report `paket-4.impl-1.json` im Arbeitsverzeichnis
  - 2026-09-21 Zug 2: Report FERTIG_MIT_VORBEHALT (Vorbehalt: CHANGELOG nicht ganz gelesen) · geändert `AGENTS.md`, `docs/architecture.md` (§3, §4, §6), `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d/tsconfig.build.json`, `scripts/publishNpmPkg.mjs`, `scripts/makePackageJson/resolveDependencies{,.test}.mjs` · neu `scripts/publishNpmPkg/parseArguments{,.test}.mjs`, `scripts/makePackageJson/makePackageJson.test.mjs` · rote Läufe: parseArguments 0/1 (Modul fehlt), resolveDependencies 11/14; Negativprobe makePackageJson 1/2 rot, `git diff --exit-code` 0 · Maps 268 → 0 · Arbeitsbaum schmutzig · Verify läuft (`paket-4.verify.log`)
  - 2026-09-21 Zug 2 (Ergebnis): Verify exit=0 (`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad/paket-4.verify.log`), `test:scripts` 59/59, 0 Maps, 0 `sourceMappingURL`
  - 2026-09-21 Zug 3: Reviewer (sonnet, medium): alle Findings behoben, 0 kritisch, 0 wichtig, 4 klein · Diff `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad/paket-4.diff`, Report `paket-4.review-1.json`
  - 2026-09-21 Zug 4: keine Runde nötig
  - 2026-09-21 Zug 5: Commit `eee50bfc`, Verify aus Zug 2 (keine Änderung seither) · Plan auf `[x]`, 3 Nebenbefunde in »Offene Befunde«, 1 Folge beim Paket

## Abgleich

- **DOC-035** — unverändert. `scripts/publishNpmPkg.mjs:11`
  `const packageRoot = path.resolve(projectRoot, process.argv[2]);` — ohne Argument wirft
  `path.resolve` einen `TypeError`. Zwei weitere Formen derselben Ursache (die Kommandozeile
  wird nicht gelesen, sondern angenommen): `:7` `process.argv.includes('--dry-run')` nimmt
  jede andere Schreibweise stillschweigend als echten Publish, und ein `--dry-run` an erster
  Stelle landet in `:11` als Verzeichnis (`…/--dry-run/package.json`, `ENOENT`).
- **SEC-004** — unverändert, Zeile verschoben: `scripts/publishNpmPkg.mjs:26` (Audit: `:29`,
  die drei Token-Zeilen hat `f8d255e3` davor entfernt)
  `` exec(`npm show ${pkgJson.name} versions --json`, …) ``. Dazu `:60`
  `` execSync(`npm publish --access public${dryRun ? ' --dry-run' : ''}`, {cwd}) `` —
  interpoliert nur eine Konstante, startet aber ebenfalls eine Shell.
- **TEST-027** — unverändert. `scripts/makePackageJson.mjs:49-58`: Wächter mit
  `console.error` je Specifier und `process.exit(1)` (`:57`), danach `writeFileSync` nach
  `dist/package.json` (`:60-62`). Getestet sind nur `findUnpublishableSpecifiers.test.mjs`
  (3 Fälle), `removeDistPathPrefix.test.mjs`, `resolveDependencies.test.mjs`; keiner startet
  das Skript. Probe in Zug 0 (`scratchpad/mpj/`): `catalog:nope` mit `dist/` → Exit 1,
  kein Manifest, `stderr` `cannot publish @scope/probe: peerDependencies.three is
  "catalog:nope", which resolves to no version range`; `^0.185.0` mit `dist/` → Exit 0,
  Manifest geschrieben; `^0.185.0` **ohne** `dist/` → Exit 1 (`ENOENT`).
- **DOC-049** — unverändert. `scripts/makePackageJson/resolveDependencies.mjs:61`
  `if (range === '' || validRange(range) == null) {`, der Kommentar `:62-63` nennt
  `validRange('') === '*'` nicht. semver 7.8.5: `validRange('')` → `'*'`,
  `validRange(' ')` → `'*'`.
- **CONS-050** — unverändert, und schärfer als im Audit: `:44` schneidet die Range
  ungetrimmt aus dem Specifier, `:74-75` gibt sie zurück. `validRange(' ^1')` →
  `'>=1.0.0 <2.0.0-0'` (gültig), also geht `' ^1'` mit Leerzeichen ins Manifest. Zug 0 hat
  dazu nachgewiesen: `workspace: ` (nur Leerraum) passiert `range === ''`, weil `' '`
  nicht leer ist, `validRange(' ')` ist `'*'`, und der Versionsbereich `" "` geht ins
  Manifest; `findUnpublishableSpecifiers` sieht ihn nicht, weil er nicht mit `workspace:`
  beginnt.
- **CFG-016** — unverändert. `tsconfig.json:11` `"declarationMap": true` (dazu `:39`
  `"sourceMap": true`), `packages/twopoint5d/tsconfig.build.json` erbt beides über
  `packages/twopoint5d/tsconfig.json`. `dist/lib` (gebaut 2026-09-21 11:36 auf `e011cfe5`):
  134 `.d.ts.map` (107 KB) und 134 `.js.map` (357 KB), `"sources":["../../src/index.ts"]`,
  kein `sourcesContent`; ausgeliefert wird `dist/` (seit Paket 1 ohne `.npmignore`),
  `src/` nicht.

## Entscheidungen in Zug 0

- **JS-Source-Maps im selben Schritt abschalten** (aufgenommener Nebenbefund). Die
  `.js.map` haben denselben Defekt wie die `.d.ts.map` — `sources` zeigt auf `src/`, das
  nicht im Paket liegt — und hängen an derselben Konfiguration. Der Nutzer hat für die
  Declaration-Maps »abschalten« gewählt, nicht »Quellen mitliefern«; für die JS-Maps wäre
  Mitliefern `inlineSources: true` und brächte die ganzen TypeScript-Quellen ins Paket
  (660 KB ohne Specs, das ausgepackte `dist/lib` wüchse von 920 KB um rund 70 %). Die
  Entscheidung überträgt sich deshalb eins zu eins. Die Folge im Workspace steht in der
  Doku: Lookbook und Testpaket lösen die Bibliothek über `dist/lib` auf, »Go to
  definition« und der Browser-Debugger zeigen dort `.d.ts` bzw. `.js`. Das gilt für die
  Declaration-Maps schon aus der Entscheidung selbst (sie nennt `tsconfig.build.json`, und
  daraus bauen auch die Workspace-Konsumenten); »lokal bleibt es an« heißt: Root-
  `tsconfig.json` unverändert.
- **DOC-035 weiter als die Empfehlung:** nicht nur das fehlende Argument, sondern eine
  strikte Kommandozeile. Ein vertipptes `--dryrun` wird heute ignoriert, und das Skript
  veröffentlicht echt — das ist der gefährlichste Weg, »nicht verständlich« zu scheitern,
  und er hat dieselbe Ursache: die Argumente werden angenommen statt gelesen.
  Ein wörtliches `--` wird überlesen: `pnpm run <script> -- --dry-run` reicht es durch (in
  Zug 0 gemessen mit pnpm 10.27.0: `["dist","--","--dry-run"]`), und Nx 23 setzt es selbst,
  wenn es die pnpm-Version nicht lesen kann
  (`node_modules/nx/dist/src/utils/package-manager.js:189-193`, sonst hängt
  `nx:run-script` die Argumente ohne `--` an, `run-script.impl.js:13`). Der CI-Aufruf
  `pnpm run publishNpmPkg` reicht nur `dist` durch und passiert die strikte Prüfung.
- **Argumentlogik als Helfer mit Unit-Tests, nicht als Spawn-Test von
  `publishNpmPkg.mjs`:** `docs/architecture.md` §4 und §6 legen fest, dass die Logik in
  `scripts/publishNpmPkg/` liegt und keine Spec `publishNpmPkg.mjs` startet (es fragt npm,
  sobald es lädt), und `CLAUDE.md`/`AGENTS.md` verbieten, das Skript ohne Auftrag
  auszuführen — ein Test in `pnpm test:scripts` liefe in jedem Gate. Die Verdrahtung ist
  ein `try`/`catch` um den Helfer; belegt wird sie per Hand mit `--dry-run` (Schritt 3).
- **SEC-004 auch für `npm publish`:** der zweite Aufruf interpoliert nur eine Konstante,
  aber mit ihm startet die Datei keine Shell mehr, und das Ziel des Pakets sagt es so.
  `stdio` bleibt Vorgabe, damit das Deploy-Log gleich aussieht.
- **CONS-050: trimmen an der Entstehung der Range (`:44`), nicht erst beim `return`.** Nur
  so sieht auch `range === ''` den getrimmten Wert, und `workspace: ` wird abgewiesen statt
  als `" "` veröffentlicht. `workspace: *` und `workspace: ~` verhalten sich danach wie
  ohne Leerzeichen. Zurück geht weiterhin der Rohwert, nicht die normalisierte Form
  (Entscheidung im Plan).
- **TEST-027 im laufenden Workspace, nicht in einem nachgebauten:** das Skript nimmt den
  Workspace-Root aus seinem eigenen Pfad und löst `yaml`/`semver` aus dem Repo auf; eine
  Kopie in ein Temp-Verzeichnis fände beides nicht. `catalog:nope` scheitert am echten
  `pnpm-workspace.yaml`, das keinen Katalog `nope` hat. Die Gegenprobe benutzt eine
  ausgeschriebene Range und hängt so an keinem Katalogeintrag.
- **Changelog-Eintrag:** der Paketinhalt ändert sich für jeden Konsumenten (268 Dateien
  weniger), die öffentliche API nicht — `### Removed`, keine Migrationsanleitung.

## Findings im Volltext

**DOC-035 · low · scripts/publishNpmPkg.mjs:11** — publishNpmPkg.mjs ohne Argument mit einer Usage-Meldung abbrechen lassen
Ohne Argument ist `process.argv[2]` `undefined`, und `path.resolve` wirft einen `TypeError`, der nicht sagt, was fehlt. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Vor dem `path.resolve` prüfen und mit `Usage: node scripts/publishNpmPkg.mjs <package-dir>` und Exit 1 abbrechen.

**SEC-004 · low · scripts/publishNpmPkg.mjs:29** — Den Paketnamen in publishNpmPkg.mjs nicht in einen Shell-String interpolieren
`pkgJson.name` geht unmaskiert in den Shell-String von `` exec(`npm show ${pkgJson.name} versions --json`) ``. Der Name stammt aus dem eigenen Manifest, die Angriffsfläche ist klein; das Skript läuft aber im Publish-Job mit OIDC-Token. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: `execFile('npm', ['show', pkgJson.name, 'versions', '--json'], …)` statt `exec`.

**TEST-027 · low · scripts/makePackageJson.mjs:50-57** — Den Abbruch von makePackageJson.mjs bei unveröffentlichbaren Specifiern testen
Die Verdrahtung des Wächters (`process.exit(1)`, kein `dist/package.json`) hat keinen Test; getestet ist nur die reine Funktion `findUnpublishableSpecifiers`. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Ein `node --test`-Fall, der das Skript per `spawnSync` gegen ein temporäres Workspace-Verzeichnis mit `catalog:nope` startet und Exit-Code und fehlende Datei prüft.

**DOC-049 · info · scripts/makePackageJson/resolveDependencies.mjs:61** — Der Kommentar sagt nicht, warum die leere Range vor validRange geprüft wird
`validRange('')` liefert `'*'` — deshalb steht `range === ''` davor. Wer den Check für redundant hält und ihn wegvereinfacht, läuft in den Test mit `workspace:`.
Empfehlung: Einen halben Satz ergänzen, der `validRange('') === '*'` nennt.

**CONS-050 · info · scripts/makePackageJson/resolveDependencies.mjs:74-75** — Zurück geht der Rohwert, nicht der normalisierte Bereich
`workspace: ^1` mit führendem Leerzeichen gilt als gültiger Bereich und ginge mit dem Leerzeichen ins veröffentlichte Manifest. Konsistent mit »ships as it is«, praktisch ohne Fall im Repo.
Empfehlung: Entweder den von `validRange` normalisierten Wert zurückgeben oder den Rohwert-Vorsatz an der Stelle ausschreiben. — Nutzerentscheidung (Plan, 2026-09-21): zurück geht der getrimmte Rohwert, der Vorsatz steht als Kommentar an der Stelle.

**CFG-016 · low · tsconfig.json:11** — declarationMap zeigt beim Konsumenten auf Quellen, die das Paket nicht enthält
`declarationMap: true` legt neben jede `.d.ts` eine `.d.ts.map`, deren `sources` auf `../../../../src/…` zeigt. Ausgeliefert wird nur `dist/lib/**` samt synthetischer `package.json`, README, CHANGELOG und LICENSE — keine einzige `.ts`-Quelle. »Go to definition« landet beim Konsumenten auf einer Datei, die im Paket nicht existiert. Re-Check: unverändert (127 Maps in `dist/lib`).
Empfehlung: Entweder die Quellen mitliefern oder `declarationMap` für den Publish-Build abschalten. — Nutzerentscheidung (Plan, 2026-09-21): im Publish-Build (`tsconfig.build.json`) abschalten, lokal bleibt es an.

## Urteil des Reviewers

- DOC-035 behoben — `scripts/publishNpmPkg.mjs:9-15` (`parseArguments` im `try`/`catch`, Usage-Zeile, Exit 1), `:17`, `:21`; Helfer `scripts/publishNpmPkg/parseArguments.mjs`, Fälle in `parseArguments.test.mjs`
- SEC-004 behoben — `scripts/publishNpmPkg.mjs:36` (`execFile`), `:70` (`execFileSync`), Import `:1`, Fehlertext `:52`
- TEST-027 behoben — `scripts/makePackageJson/makePackageJson.test.mjs:33-38` (Exit 1, kein Manifest, stderr), Gegenprobe `:40-45`
- DOC-049 behoben — `scripts/makePackageJson/resolveDependencies.mjs:63`
- CONS-050 behoben — `resolveDependencies.mjs:46` (Trim an der Entstehung), `:77-78` (Vorsatz), Tests in `resolveDependencies.test.mjs`
- CFG-016 behoben — `packages/twopoint5d/tsconfig.build.json:6-7`; Root-`tsconfig.json:11`/`:39` unverändert
- JS-Source-Maps behoben — dieselbe Stelle, 0 Maps und 0 `sourceMappingURL` in `dist/lib`

## Kleine Befunde

- `docs/architecture.md:182-184` — der Satz zur Kommandozeile nennt ein zweites Verzeichnis nicht, das ebenfalls mit Exit 1 abbricht (`expected one <package-dir>`).
- `scripts/makePackageJson/resolveDependencies.mjs:44-45` — »whitespace … belongs to no version range« ist ungenau (`validRange(' ^1')` ist gültig); der eigentliche Grund ist, dass der Leerraum sonst ins Manifest ginge und `' '` als `'*'` durchrutschte. Wortlaut folgt dem Detailplan.
- `docs/architecture.md` §4, Absatz zu den Specifiern — Zeilenrest `specifier standing). If a` nach dem Umbruch, rein optisch.
- Commit-Subject rund 330 Zeichen, länger als jedes bisherige im `git log` (≈ 260); aus der Paketdatei übernommen.

## Nebenbefunde des Implementierers, nicht in die Queue

- `scripts/publishNpmPkg.mjs:57-67` — `publishPackage` kopiert `.npmrc`, `LICENSE`, `CHANGELOG.md` und README auch beim `--dry-run` nach `dist/`. Kein Befund: `npm publish --dry-run` zeigt den Tarball genau mit diesen Dateien, und `dist/` ist Build-Ausgabe, die jedes `clean` verwirft.
- `scripts/makePackageJson/resolveDependencies.mjs:12` — `specifier.startsWith` wirft bei einem Nicht-String. Kein Befund: in einem gültigen `package.json` sind Specifier Strings, und `JSON.parse` des Manifests ginge dem voraus.
- Vorbehalt des Implementierers: `packages/twopoint5d/CHANGELOG.md` (2756 Zeilen) nur in Kopf, `[Unreleased]` und `### Removed` gelesen.
