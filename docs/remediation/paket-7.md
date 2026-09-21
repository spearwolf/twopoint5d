# Paket 7 — Drain: Fehlerpfade der Publish- und Manifest-Skripte

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — Nebenbefunde aus der Queue (Paket 4): gescheitertes `npm publish` endet mit rohem Stacktrace (info), fehlende `version` wirft `TypeError` (info), `makePackageJson.mjs` ohne `dist/` endet mit `ENOENT`-Stacktrace (info) · Folge aus Paket 4: `execFile('npm', …)` ohne Shell findet unter Windows kein `npm.cmd` (low) · in Zug 0 aufgenommen, gleiche Ursache (siehe »Abgleich«): die übrigen unbehandelten Fehlerpfade beider Skripte und das verschluckte stdout von `npm publish`
- Ziel: Jeder Fehlerpfad der beiden Skripte endet mit einer Meldung, die sagt, was fehlt, und die npm-Aufrufe funktionieren ohne Shell-Interpolation auch unter Windows.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - geändert: `scripts/publishNpmPkg.mjs`, `scripts/makePackageJson.mjs`, `scripts/makePackageJson/makePackageJson.test.mjs`, `docs/architecture.md` (§4 und §6)
  - neu: `scripts/publishNpmPkg/checkManifest.mjs`, `scripts/publishNpmPkg/checkManifest.test.mjs`, `scripts/publishNpmPkg/npmCommand.mjs`, `scripts/publishNpmPkg/npmCommand.test.mjs`
  - unverändert, bewusst: `nx.json` (der Named Input `makePackageJson` deckt `scripts/makePackageJson.mjs` schon ab, und für `makePackageJson` entsteht kein neuer Helfer; `publishNpmPkg` hat kein Caching), `AGENTS.md` (die Zeile zu `test:scripts` stimmt weiter), `scripts/publishNpmPkg/publishedVersions.mjs` (der Doc-Kommentar beschreibt das Antwortformat von `npm show`, das gleich bleibt), `packages/twopoint5d/CHANGELOG.md` (der Paketinhalt ändert sich nicht)

## Grundsatz für »jeder Fehlerpfad«

Erwartbare Fehler — Umgebung, Eingabedateien, npm — enden mit **einer** Zeile auf stderr, die sagt, was fehlt oder was scheiterte, und mit Exit-Code 1. Kein Stacktrace. Programmierfehler behalten ihren Stacktrace: ein Argument, das `npmCommand` abweist, kann nur aus einem Fehler im Skript kommen, weil alle npm-Argumente Literale sind; das wird **nicht** abgefangen. Eine Eingabedatei, die existiert und sich parsen lässt, wird genommen, wie sie ist (ein `package.json` mit dem Inhalt `null` ist kein Fall dieses Pakets).

Meldungen englisch, wie die übrigen Ausgaben der Skripte. Die Wortlaute unten sind verbindlich — die Probe und die Tests prüfen sie.

## Vorgehen

Reihenfolge: erst die Tests (Schritt 1), rot sehen, dann die Implementierung (Schritte 2–5), dann Doku (Schritt 6). Rote Läufe gehören in den Report.

1. **Tests zuerst.**
   - `scripts/publishNpmPkg/npmCommand.test.mjs` (neu), Stil wie `parseArguments.test.mjs` (`node:assert/strict`, `node:test`), `describe('npmCommand', …)` mit genau diesen drei Fällen:
     - `starts npm directly outside Windows` — für `'linux'` und `'darwin'`: `npmCommand(['show', '.', 'versions', '--json'], platform)` ergibt `{file: 'npm', args: ['show', '.', 'versions', '--json'], options: {}}`.
     - `hands Windows one command string for cmd.exe and no argument list` — `npmCommand(['publish', '--access', 'public', '--dry-run'], 'win32')` ergibt `{file: 'npm publish --access public --dry-run', args: [], options: {shell: true}}`.
     - `refuses an argument cmd.exe would read, on every platform` — für jede Plattform aus `['linux', 'win32']` und jedes Argument aus `['a b', 'a&b', '%PATH%', 'a^b', 'a|b', '<a', 'a>', '(a)', '!a', '"a"', '']`: `npmCommand(['show', arg], platform)` wirft `/refusing to pass/`.
   - `scripts/publishNpmPkg/checkManifest.test.mjs` (neu), `describe('checkManifest', …)` mit genau diesen vier Fällen:
     - `a manifest with a name and a version passes` — `{name: '@scope/pkg', version: '1.0.0'}` wirft nicht.
     - `a missing or empty version is named` — `{name: 'x'}`, `{name: 'x', version: ''}`, `{name: 'x', version: '  '}`, `{name: 'x', version: 1}` werfen je `/^the manifest has no "version"$/`.
     - `a missing name is named` — `{version: '1.0.0'}` wirft `/^the manifest has no "name"$/`.
     - `a manifest without either names both, and so does one that is no object` — `{}`, `null`, `[]` werfen je `/^the manifest has no "name" and no "version"$/`.
   - `scripts/makePackageJson/makePackageJson.test.mjs` erweitern:
     - `run(peerDependencies)` bekommt ein zweites, optionales Argument `{dist = true, packageJsonText} = {}`: `dist: false` legt `dist/` nicht an; `packageJsonText` wird statt des erzeugten JSON als `package.json` geschrieben. Die beiden bestehenden Aufrufe bleiben unverändert.
     - Der Kommentar über `fs.mkdirSync(path.join(dir, 'dist'))` (heute Zeilen 25–26) wird neu geschrieben und beschreibt das jetzige Verhalten, ohne Rückblick: das Skript schreibt das Manifest nur in ein vorhandenes `dist/`, das sonst der Compiler anlegt, und stoppt ohne es mit eigener Meldung; die Fälle zu den Specifiern brauchen es deshalb, um bis zum Schreiben zu kommen.
     - neuer Fall `stops with a message when dist/ does not exist: exit code 1, no stack trace, dist/ not created` — `run({three: '^0.185.0'}, {dist: false})`: `status` 1, `stderr` passt auf `/dist does not exist, compile the package first/`, `assert.doesNotMatch(stderr, /^\s+at /m)`, `fs.existsSync(path.join(dir, 'dist'))` ist `false` (dafür gibt `run` zusätzlich `dir` zurück).
     - neuer Fall `stops with a message when package.json is not JSON: exit code 1, no stack trace` — `run(undefined, {packageJsonText: '{'})`: `status` 1, `stderr` passt auf `/cannot read .*package\.json: /`, `assert.doesNotMatch(stderr, /^\s+at /m)`.
   - Rot vor der Implementierung: die beiden neuen Specs scheitern am fehlenden Modul, die beiden neuen `makePackageJson`-Fälle an `doesNotMatch` (Stacktrace, gemessen in Zug 0). `pnpm run test:scripts` steht heute bei 59 Tests; danach 68.

2. **`scripts/publishNpmPkg/npmCommand.mjs`** (neu), genau diese Semantik:

   ```js
   // letters, digits and _ @ . / - reach npm unchanged even through cmd.exe; quotes, spaces, % ^ & | < > ( ) ! do not
   const PLAIN_ARGUMENT = /^[\w@./-]+$/;

   /**
    * How to start `npm <args>` so that no shell reads anything into an argument. `npm` is started
    * directly, except on Windows: there it is `npm.cmd`, which Node starts only through `cmd.exe`,
    * so the command becomes a single string for the shell. An argument with any other character is
    * refused on every platform, so a run on Linux fails where Windows would interpret it.
    *
    * @param {string[]} args
    * @param {NodeJS.Platform} [platform]
    * @returns {{file: string, args: string[], options: {shell?: boolean}}}
    */
   export function npmCommand(args, platform = process.platform) {
     for (const arg of args) {
       if (!PLAIN_ARGUMENT.test(arg)) {
         throw new Error(`refusing to pass ${JSON.stringify(arg)} to npm: an argument may hold only letters, digits and _ @ . / -`);
       }
     }
     if (platform === 'win32') {
       return {file: ['npm', ...args].join(' '), args: [], options: {shell: true}};
     }
     return {file: 'npm', args, options: {}};
   }
   ```

   Das leere Argument-Array unter Windows ist Absicht, kein Stil: Node 24 gibt bei `shell: true` zusammen mit Argumenten die Runtime-Warnung `DEP0190` aus (in Zug 0 gemessen), mit einem einzigen String und `[]` nicht.

3. **`scripts/publishNpmPkg/checkManifest.mjs`** (neu):

   ```js
   /**
    * Throws unless the manifest names the package and its version, each as a non-empty string —
    * the two fields a publish needs before it asks npm anything.
    */
   export function checkManifest(pkgJson) {
     const missing = ['name', 'version'].filter((field) => typeof pkgJson?.[field] !== 'string' || pkgJson[field].trim() === '');
     if (missing.length > 0) {
       throw new Error(`the manifest has no ${missing.map((field) => `"${field}"`).join(' and no ')}`);
     }
   }
   ```

4. **`scripts/publishNpmPkg.mjs`** — Verdrahtung, Rest des Skripts bleibt:
   - Imports ergänzen: `checkManifest` aus `./publishNpmPkg/checkManifest.mjs`, `npmCommand` aus `./publishNpmPkg/npmCommand.mjs` (alphabetisch zwischen die bestehenden, wie sie jetzt stehen).
   - Zeile 22 ersetzen durch `const manifestPath = path.resolve(packageRoot, 'package.json');` und einen `try`-Block, der liest, parst und prüft:
     ```js
     let pkgJson;
     try {
       pkgJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
       checkManifest(pkgJson);
     } catch (error) {
       console.error(`cannot publish ${manifestPath}: ${error.message}`);
       process.exit(1);
     }
     ```
     Die `console.log`/`console.dir`-Zeilen und die `-dev`-Prüfung (heute :24–34) bleiben danach unverändert stehen.
   - `npm show` (heute :36): `const show = npmCommand(['show', '.', 'versions', '--json']);` und `execFile(show.file, show.args, {...show.options, cwd: packageRoot}, (error, stdout, stderr) => { … })`. Darüber ein Kommentar mit dem Grund für `.`: npm liest den Namen aus dem Manifest in `packageRoot`, demselben, das `npm publish` dort liest, und kein Wert aus dem Manifest steht in der Kommandozeile.
   - Im Callback:
     - Zweig ohne `error`: `parsePublishedVersions(stdout)` in ein `try`; im `catch (parseError)` `console.error(`npm show printed no version list: ${parseError.message}`)` und `process.exit(1)`. Der Rest des Zweigs bleibt.
     - letzter `else`-Zweig: `console.error(`npm show failed: ${stderr.trim() || error.message}`)`, darüber ein Kommentar: npm begründet sich auf stderr; ließ sich npm gar nicht starten, ist stderr leer und `error.message` nennt den Grund (`spawn npm ENOENT`).
   - `publishPackage` (heute :57–73): `const publish = npmCommand(['publish', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])]);`, dann
     ```js
     try {
       execFileSync(publish.file, publish.args, {...publish.options, cwd, stdio: 'inherit'});
     } catch (error) {
       console.error(`npm publish failed: ${error.status != null ? `exit code ${error.status}` : error.message}`);
       process.exit(1);
     }
     ```
     mit einem Kommentar über dem Aufruf: npm schreibt direkt auf die Konsole — die veröffentlichte Version bei Erfolg, den Grund beim Scheitern —, deshalb nennt die eigene Meldung nur den Exit-Code. `process.exit(0)` danach bleibt.
   - `copyFile` (heute :75–79): `fs.copyFileSync` in ein `try`; im `catch` `console.error(`cannot copy ${src} to ${dst}: ${error.message}`)` und `process.exit(1)`.

5. **`scripts/makePackageJson.mjs`** — Verdrahtung, Logik bleibt:
   - Eine Funktion im Skript (kein Helfer-Modul: sie beendet den Prozess, das ist Verdrahtung):
     ```js
     function readInput(filePath, parse) {
       try {
         return parse(fs.readFileSync(filePath, 'utf8'));
       } catch (error) {
         console.error(`cannot read ${filePath}: ${error.message}`);
         process.exit(1);
       }
     }
     ```
     mit einem Kommentar darüber: jede Datei, aus der das Manifest entsteht, ist Eingabe, die man falsch haben kann, und bekommt eine Meldung statt eines Stacktraces.
   - Alle vier Lesestellen darüber führen: `inPackageJson = readInput(packageJsonPath, JSON.parse)`, `sharedPackageJson = readInput(path.resolve(workspaceRoot, 'package.json'), JSON.parse)`, `pnpmWorkspaceConfig = readInput(path.resolve(workspaceRoot, 'pnpm-workspace.yaml'), YAML.parse)`, `packageJsonOverride = fs.existsSync(packageJsonOverridePath) ? readInput(packageJsonOverridePath, JSON.parse) : {}`.
   - Schreiben (heute :60–62):
     ```js
     const distDir = path.resolve(projectRoot, 'dist');
     const releasePackageJsonPath = path.resolve(distDir, 'package.json');
     if (!fs.existsSync(distDir)) {
       console.error(`cannot write ${releasePackageJsonPath}: ${distDir} does not exist, compile the package first`);
       process.exit(1);
     }
     console.log('Write to', releasePackageJsonPath);
     try {
       fs.writeFileSync(releasePackageJsonPath, JSON.stringify(outPackageJson, null, 2));
     } catch (error) {
       console.error(`cannot write ${releasePackageJsonPath}: ${error.message}`);
       process.exit(1);
     }
     ```
     Über der `existsSync`-Prüfung ein Kommentar mit dem Grund, warum das Skript `dist/` nicht selbst anlegt: das Manifest gehört neben die kompilierte Bibliothek, ein `dist/` mit nichts als einem Manifest wäre ein Paket ohne Code.
   - Der Wächter gegen unveröffentlichbare Specifier (heute :49–58) bleibt, wo und wie er ist.

6. **`docs/architecture.md`**:
   - §4, Absatz ab »The publishable artifact is therefore `dist/`« (heute :179–185): der Halbsatz »and it calls npm without a shell« fällt; an seine Stelle tritt, in eigenen Worten und ohne Rückblick: npm wird über `npm show .` im Paketverzeichnis gefragt, der Name kommt also aus dem Manifest, das `npm publish` dort liest, und kein Wert daraus steht in einer Kommandozeile; npm läuft ohne Shell, unter Windows — wo `npm` ein `npm.cmd` ist, das Node nur über `cmd.exe` startet — als ein einziger String aus Literalen, und ein Argument mit einem Zeichen außer Buchstaben, Ziffern und `_ @ . / -` wird auf jeder Plattform abgewiesen; jeder Fehlschlag — Manifest unlesbar oder ohne `name`/`version`, npm fehlt oder scheitert — endet mit einer Zeile und Exit-Code 1, und was `npm publish` selbst ausgibt, steht direkt in der Konsole. Der Schlusssatz »Never publish from `packages/twopoint5d/` …« bleibt.
   - §4, Absatz zu `makePackageJson.mjs` (heute :159–173), nach dem Satz »If a `catalog:` or `workspace:` specifier is left in the manifest afterwards, the build fails — npm installs neither protocol.«: ein Satz, dass das Skript `dist/package.json` nur in ein vorhandenes `dist/` schreibt und ohne kompilierte Bibliothek mit dem Hinweis stoppt, erst zu kompilieren, und dass eine unlesbare Eingabedatei es mit Pfad und Grund stoppt.
   - §6 (heute :261–266): »because its exit code and the manifest it does not write are wiring that no helper test sees« wird zu »because its exit codes, its messages and the manifest it does not write are wiring that no helper test sees«. Der Satz »No spec runs `publishNpmPkg.mjs` …« bleibt wahr und bleibt stehen — kein Test startet `publishNpmPkg.mjs` (AGENTS.md verbietet jeden Lauf ohne Auftrag; ein Test im Gate wäre ein Lauf bei jedem `pnpm run ci`).
   - Umbruch wie die Nachbarabsätze (rund 90 Zeichen).

- Verify: `pnpm run ci && bash "$ARBEITSDIR/paket-7-probe.sh"` — die Probe steht unten im Abschnitt »Probe« und wird vor dem ersten Lauf wörtlich nach `$ARBEITSDIR/paket-7-probe.sh` geschrieben (`$ARBEITSDIR` = `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad`). Erwartet: Gate grün, `test:scripts` 68 Tests, Probe endet mit `probe=ok` und Exit 0.
- Commit: `build: end every failure of the publish and manifest scripts with one line that says what is missing instead of a stack trace, let npm publish print to the console, ask npm about the package in the directory it publishes and start npm on Windows through cmd.exe with literal arguments only`
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · `publishNpmPkg.mjs:70` (publish ohne `catch`) unverändert · `publishNpmPkg.mjs:31` (`version.endsWith`) unverändert · `makePackageJson.mjs:62` (`writeFileSync` ohne `dist/`) unverändert · Folge Windows `publishNpmPkg.mjs:36` und `:70` unverändert · in Zug 0 aufgenommen: unlesbares Manifest `publishNpmPkg.mjs:22`, leere Meldung bei fehlendem npm `:52`, unparsbare `npm show`-Ausgabe `:38`, `copyFileSync` `:77`, vier Lesestellen `makePackageJson.mjs:16/:18/:21/:25`, verschlucktes stdout `publishNpmPkg.mjs:70` · Probe gegen HEAD rot (5/5 Pfade, `.`-Abfrage) · Offene Befunde: nichts mit gleicher Ursache (einziger offener Eintrag `Display.dispose()` → Audit, bleibt) · Folgen erledigter Pakete: nur die aus Paket 4, hier aufgenommen
  - 2026-09-21 Zug 1: Probe nach `$ARBEITSDIR/paket-7-probe.sh` geschrieben, gegen HEAD `probe=FAILED` · Implementierer beauftragt (sonnet, medium, Session `remediate-p7-impl-1`, Brief `paket-7.impl-1.brief`)
  - 2026-09-21 Zug 2: Report FERTIG_MIT_VORBEHALT (Abweichung: `checkManifest.test.mjs` prüft `{message: /^…$/}`, weil `assert.throws` eine Regex gegen `String(error)` mit Präfix `Error: ` hält) · geändert `scripts/publishNpmPkg.mjs`, `scripts/makePackageJson.mjs`, `scripts/makePackageJson/makePackageJson.test.mjs`, `docs/architecture.md`; neu `scripts/publishNpmPkg/{checkManifest,npmCommand}{,.test}.mjs` · rot vorher: `test:scripts` 63 Tests, 4 fail · Arbeitsbaum schmutzig · eigener Verify `paket-7.verify.log` exit=0, `test:scripts` 68/68, `probe=ok`
  - 2026-09-21 Zug 3: Reviewer (opus, medium, `paket-7.review-1.json`) auf `paket-7.diff`: alle vier Aufträge und sieben Zug-0-Pfade behoben · 1 wichtig (`publishedVersions.mjs:2` nennt `npm show <name>`), 3 klein · abnahmefähig
  - 2026-09-21 Zug 4 Runde 1: offen 1 wichtig (+ klein `publishNpmPkg.mjs:57` zweizeilige Meldung, mitgegeben) → Resume derselben Session `68ac9d74-aeee-4eed-826b-193a9660a7bc` (sonnet, medium), Report `paket-7.impl-2.json`
    zurück: FERTIG · `publishedVersions.mjs:2` nennt `npm show . versions --json`, `publishNpmPkg.mjs:55` parst `stdout.trim()` · Verify `paket-7.verify-2.log` exit=0, 68/68, Probe 5 einzeilig, `probe=ok` · Diff `paket-7.diff-2`, gezielter Review `paket-7.review-2.json`
  - 2026-09-21 Zug 4 Runde 1 Review (opus, medium, `paket-7.review-2.json`): beide Punkte behoben, nichts Neues gebrochen, 1 klein · offene Befunde 1 → 0
  - 2026-09-21 Zug 5: Commit `2a278e39` (9 Dateien, +202/−26) · Verify `paket-7.verify-2.log` exit=0 · Plan auf `[x]`, drei Nebenbefunde in »Offene Befunde«

## Urteil des Reviewers

Review 1 (`paket-7.review-1.json`), bestätigt nach Runde 1 (`paket-7.review-2.json`):

- `npm publish` ohne Stacktrace — behoben, `scripts/publishNpmPkg.mjs:96-101` (Probe 4)
- fehlende `version` — behoben, `scripts/publishNpmPkg.mjs:29`, `scripts/publishNpmPkg/checkManifest.mjs:5-9` (Probe 2, `checkManifest.test.mjs`)
- `makePackageJson.mjs` ohne `dist/` — behoben, `scripts/makePackageJson.mjs:72-82` (Spec-Fall, `dist/` wird nicht angelegt)
- Folge Windows — behoben, soweit auf Linux prüfbar, `scripts/publishNpmPkg/npmCommand.mjs:14-24`, Aufrufe `scripts/publishNpmPkg.mjs:49` und `:93` (`npmCommand.test.mjs` mit `win32`)
- Zug-0-Pfade: Manifest fehlt/ungültig `publishNpmPkg.mjs:26-33` · leere Meldung ohne npm `:75` · unparsbare `npm show`-Ausgabe `:54-59` (einzeilig seit Runde 1, `:55` `stdout.trim()`) · `copyFileSync` `:108-113` · vier Lesestellen `makePackageJson.mjs:16-34` über `readInput` · stdout von `npm publish` `publishNpmPkg.mjs:97` (`stdio: 'inherit'`) · `npm show .` `:47-51`
- Doku: `docs/architecture.md` §4 (zwei Absätze) und §6 wie vorgegeben, kein Rückblick
- Runde 1: `scripts/publishNpmPkg/publishedVersions.mjs:2` nennt `npm show . versions --json` (war: wichtig, Doku, die lügt)

Abweichung vom Detailplan, vom Reviewer akzeptiert: `checkManifest.test.mjs` prüft `assert.throws(fn, {message: /^…$/})` statt `/^…$/`, weil `assert.throws` eine Regex gegen `String(error)` samt Präfix `Error: ` hält.

## Kleine Befunde

- `scripts/publishNpmPkg.mjs:75` — `npm show failed: ${stderr.trim()}` bleibt mehrzeilig, wenn npm mehrere `npm error …`-Zeilen schreibt (Normalfall); bewusst so gelassen, npms eigener Text ist die bessere Diagnose — Ausnahme vom Grundsatz »eine Zeile«.
- `scripts/publishNpmPkg/publishedVersions.mjs:2-3` — Doc-Kommentar ungleich umbrochen (112 / 70 Zeichen), Prettier lässt ihn durch.
- Commit-Message rund 290 Zeichen im Subject, im Rahmen der Nachbarcommits.

## Nebenbefunde — Begründung der Urteile

- `resolveDependencies.mjs:87-88` → Scope: Build-/Publish-Pipeline (Manifest-Skript), gleiche Ursache wie dieses Paket; nicht nachgezogen, weil der Helfer eine eigene Fehlerschnittstelle bräuchte (werfen mit Pfad, das Skript fängt um `resolveDependencies`) und die Stelle praktisch nicht erreichbar ist — Drain im Abschluss. Vorbestehend: identisch in `8661a91c`.
- `publishNpmPkg.mjs:106-107` → Scope: Publish-Pipeline; vorbestehend (`existsSync`-Guard schon in `8661a91c:66`).
- `docs/architecture.md:165-170`, `:199-200` → Scope: Doku der Build-/Deploy-Pipeline, reine Umbruchkosmetik.

## Abgleich

Alle vier Aufträge an der Fundstelle nachgesehen und gegen HEAD `9f6897b8` ausgelöst. Probe-Aufrufe liefen nur mit `--dry-run` und einem Fake-npm auf einem PATH ohne echtes npm; kein Aufruf erreichte die Registry außer den lesenden `npm show` unten.

- **`npm publish` ohne `catch`** — unverändert, `scripts/publishNpmPkg.mjs:70` `execFileSync('npm', ['publish', …], {cwd})`. Fake-npm mit Exit 7: Ausgabe `node:child_process:981 … Error: Command failed: npm publish --access public --dry-run`, Stacktrace.
- **fehlende `version`** — unverändert, `scripts/publishNpmPkg.mjs:31`. Manifest `{"name":"@spearwolf/probe"}`: `TypeError: Cannot read properties of undefined (reading 'endsWith')`, Stacktrace.
- **`makePackageJson.mjs` ohne `dist/`** — unverändert, `scripts/makePackageJson.mjs:62`. Temp-Projekt ohne `dist/`: `Error: ENOENT: no such file or directory, open '…/dist/package.json'`, Stacktrace, Exit 1.
- **Folge Windows** — unverändert, `scripts/publishNpmPkg.mjs:36` `execFile('npm', …)` und `:70` `execFileSync('npm', …)`, beide ohne `shell`. Unter Windows löst Node `npm` ohne Shell nicht über `PATHEXT` zu `npm.cmd` auf (ENOENT), und ein `.cmd` direkt zu starten verweigert Node seit 18.20.2/20.12.2 mit `EINVAL`; `engines.node` ist `^24.16.0 || >=26.3.0`. Unter Linux nicht auslösbar — die Probe belegt nur die Linux-Seite, `npmCommand.test.mjs` den Windows-Zweig mit `platform = 'win32'`.

In Zug 0 aufgenommen, **dieselbe Ursache** — die Verdrahtung beider Skripte lässt Fehler von Dateisystem, Parser und npm ungefangen durchlaufen, statt sie in eine Meldung zu übersetzen; das Ziel des Pakets (»jeder Fehlerpfad der beiden Skripte«) nennt sie schon, die Queue nannte nur die drei zuerst gesehenen:

- `scripts/publishNpmPkg.mjs:22` — Paketverzeichnis ohne `package.json` (etwa `dist` vor dem Build): `ENOENT`-Stacktrace. Ungültiges JSON dort: `SyntaxError`-Stacktrace.
- `scripts/publishNpmPkg.mjs:52` — lässt sich npm nicht starten, ist `stderr` leer: Ausgabe `npm show failed: ` ohne Grund (gemessen mit PATH ohne npm). Das ist zugleich die Meldung, die ein Windows-Nutzer heute sieht.
- `scripts/publishNpmPkg.mjs:38` — `npm show` mit Exit 0, aber ohne JSON: `SyntaxError` im Callback, Stacktrace.
- `scripts/publishNpmPkg.mjs:77` — `copyFileSync` ohne `catch` (Rechte, voller Datenträger).
- `scripts/makePackageJson.mjs:16`, `:18`, `:21`, `:25` — ungültiges JSON/YAML oder fehlende Datei: Stacktrace (gemessen: `package.json` mit Inhalt `{` → `SyntaxError … at file:///…/makePackageJson.mjs:16:28`).
- `scripts/publishNpmPkg.mjs:70`, **stdout von `npm publish`** — `execFileSync` mit Default-`stdio` puffert stdout und gibt es nur als Rückgabewert zurück, den niemand liest (gemessen: `execFileSync('echo', ['hi from child'])` gibt nichts aus); damit fehlt im Deploy-Log die Zeile `+ <name>@<version>`, und im Fehlerfall trägt `error.message` npms stderr ein zweites Mal. Gleiche Ursache und gleiche Zeile wie der Queue-Eintrag »publish ohne catch«: der Aufruf läuft mit Default-Optionen, sein Ergebnis geht in einen Puffer, den niemand liest, sein Scheitern in eine Exception, die niemand fängt. Die Meldung beim Scheitern hängt direkt an der `stdio`-Wahl, deshalb wird beides in einem Zug entschieden (`stdio: 'inherit'`).

## Entscheidungen in Zug 0

- **Windows über `cmd.exe` mit Literalen, nicht über `node npm-cli.js`.** Node startet ein `.cmd` nur über eine Shell (dokumentiert, und seit dem `EINVAL`-Fix erzwungen). Die Alternative ohne Shell — `process.execPath` mit dem `npm-cli.js` neben dem `npm.cmd` auf dem PATH — bildet das `npm.cmd` von npm nicht nach: dessen Shim fragt über `npm-prefix.js` den konfigurierten globalen Prefix und nimmt ein dort per `npm i -g npm` installiertes npm vor dem gebündelten; nachgebaut hieße das, den Shim zu reimplementieren, vereinfacht liefe unbemerkt ein anderes npm als im Terminal. Eine neue Root-Dependency (`cross-spawn`) für einen Aufruf auf einer Plattform, die kein CI fährt, ist mehr Gewicht als der Fehler. Die Shell sieht deshalb nur Literale: `npmCommand` baut den String aus Argumenten, die auf `[\w@./-]` beschränkt sind — Zeichen, die `cmd.exe` unverändert durchreicht —, und weist alles andere auf **jeder** Plattform ab, damit das Gate unter Linux fällt, wo Windows interpretieren würde. Damit hält das Ziel »ohne Shell-Interpolation«: in der Windows-Kommandozeile steht kein Wert, der nicht wörtlich im Quelltext steht.
- **`npm show .` statt `npm show <name>`** — Abweichung von der Empfehlung des (in Paket 4 geschlossenen) Findings zum Shell-String, die `pkgJson.name` als Argument vorsah. Mit `cwd: packageRoot` liest npm den Namen aus demselben Manifest, das `npm publish` im selben Verzeichnis liest, und die Kommandozeile trägt auf keiner Plattform einen Wert aus dem Manifest. Gemessen in Zug 0 mit npm 11.19.0: `npm show . versions --json` in `packages/twopoint5d/dist` listet `0.21.0` … `0.21.2`; in einem Verzeichnis mit unveröffentlichtem Namen `npm error code E404` auf stderr (erkennt `isNotPublishedError` wie bisher); ohne `name` `npm error Invalid package.json, no "name" field`. Das Root-`package.json` hat kein `workspaces`-Feld, npm bleibt also mit seinem Prefix im Paketverzeichnis.
- **`makePackageJson.mjs` legt `dist/` nicht an, sondern stoppt.** Der Queue-Text (»legt `dist/` nicht an«) ließe auch `mkdirSync` zu. `build` ist `compile && makePackageJson`, ohne `dist/` hat `tsc` nicht gelaufen; ein `dist/` mit nichts als einem Manifest wäre ein Paket ohne Code, das erst `checkPkgTypes`/`lintPkg` mit unverständlichen Fehlern aufhielten. Die Meldung sagt, was fehlt: kompilieren.
- **`checkManifest` prüft auch `name`,** obwohl das Skript den Namen nach dieser Änderung nicht mehr an npm übergibt: npm würde mit `Invalid package.json, no "name" field` selbst scheitern, aber erst nach dem Start eines Prozesses und mit einer Meldung, die nicht das Skript formuliert. Zwei Felder in einer Prüfung, eine Meldung.
- **Kein Test startet `publishNpmPkg.mjs`.** Die Fehlerpfade der Verdrahtung belegt die Probe unten, gefahren von B; `docs/architecture.md` §6 sagt schon, warum kein Spec das Skript startet, und AGENTS.md verbietet jeden Lauf ohne Auftrag. `makePackageJson.mjs` dagegen hat seinen Kindprozess-Spec schon und bekommt die zwei neuen Fälle dort.

## Offen bis nach dem Paket

- Ein echter Lauf unter Windows ist hier nicht möglich; den Windows-Zweig belegt allein `npmCommand.test.mjs` mit `platform = 'win32'`.
- Die Zeile `+ @spearwolf/twopoint5d@<version>` im Deploy-Log zeigt sich erst beim nächsten echten Release.

## Probe

Wörtlich nach `$ARBEITSDIR/paket-7-probe.sh` schreiben, mit `bash` fahren. Sie startet `scripts/publishNpmPkg.mjs` nur mit `--dry-run`, mit absolutem `node` und einem PATH, auf dem entweder das Fake-npm oder gar kein npm liegt; das Fake schreibt jeden Aufruf nach `calls.log`, antwortet auf `show` mit `E404` (oder, mit `FAKE_NPM_SHOW=garbage`, mit Nicht-JSON) und scheitert bei `publish` mit Exit 7. Gegen HEAD `9f6897b8` in Zug 0 gefahren: alle fünf Pfade und die `.`-Prüfung `PROBE FAILED`, die `--dry-run`-Prüfung grün, `probe=FAILED`, Exit 1. Nach der Umsetzung: fünfmal Exit 1 mit der erwarteten Zeile, kein Stacktrace, `probe=ok`, Exit 0.

```bash
#!/usr/bin/env bash
# Fehlerpfade von publishNpmPkg.mjs, gefahren gegen ein Fake-npm, das keine Registry erreicht
# und nichts veröffentlicht; PATH enthält nur das Fake (oder gar kein npm), node wird absolut gestartet.
set -u
REPO=/home/spw/spaceland/twopoint5d
P=$(mktemp -d)
trap 'rm -rf "$P"' EXIT
mkdir -p "$P/bin" "$P/nobin" "$P/cwd" "$P/no-manifest" "$P/no-version" "$P/ok"
cat > "$P/bin/npm" <<'EOF'
#!/bin/sh
echo "$*" >> "${0%/*}/calls.log"
case "$1" in
  show)
    if [ "$FAKE_NPM_SHOW" = garbage ]; then echo 'not json'; exit 0; fi
    echo 'npm error code E404' >&2; exit 1 ;;
  publish) echo 'npm error code EPROBE' >&2; exit 7 ;;
esac
exit 99
EOF
chmod +x "$P/bin/npm"
echo '{"name":"@spearwolf/probe"}' > "$P/no-version/package.json"
echo '{"name":"@spearwolf/probe","version":"1.0.0"}' > "$P/ok/package.json"
NODE=$(command -v node)
FAIL=0
probe() { # <label> <regex für die erwartete Zeile> <package-dir> <env-Zuweisungen …>
  local label=$1 expect=$2 dir=$3; shift 3
  local out code
  out=$(cd "$P/cwd" && env "$@" "$NODE" "$REPO/scripts/publishNpmPkg.mjs" "$dir" --dry-run 2>&1); code=$?
  echo "=== $label (exit=$code)"; grep -v '^  \|^{\|^}\|^\[' <<<"$out" | tail -n 4
  if [ "$code" -ne 1 ] || ! grep -qE "$expect" <<<"$out" || grep -qE '^\s+at |^node:|^file://|^<anonymous_script>|^Node\.js v' <<<"$out"; then
    echo "PROBE FAILED: $label"; FAIL=1
  fi
}
probe '1 no manifest' '^cannot publish .*/no-manifest/package\.json: ENOENT' "$P/no-manifest" PATH="$P/bin"
probe '2 no version' '^cannot publish .*/no-version/package\.json: the manifest has no "version"$' "$P/no-version" PATH="$P/bin"
probe '3 npm missing' '^npm show failed: spawn npm ENOENT$' "$P/ok" PATH="$P/nobin"
probe '4 npm publish fails' '^npm publish failed: exit code 7$' "$P/ok" PATH="$P/bin"
probe '5 npm show prints no JSON' '^npm show printed no version list: ' "$P/ok" PATH="$P/bin" FAKE_NPM_SHOW=garbage
grep -qx 'show \. versions --json' "$P/bin/calls.log" || { echo 'PROBE FAILED: npm show was not asked with "."'; FAIL=1; }
grep -qx 'publish --access public --dry-run' "$P/bin/calls.log" || { echo 'PROBE FAILED: --dry-run did not reach npm publish'; FAIL=1; }
echo "probe=$([ "$FAIL" -eq 0 ] && echo ok || echo FAILED)"
exit "$FAIL"
```

## Restplan

Paket 7 ist das letzte Paket. Keine Fundstelle ist gewandert, kein Auftrag weggefallen, keine Folge aus erledigten Paketen offen außer der hier aufgenommenen; an Reihenfolge und Schnitt ändert sich nichts. Danach bleibt für den Abschluss in »Offene Befunde« allein der Eintrag zu `Display.dispose()` mit dem Urteil `→ Audit`.

## Findings im Volltext

Keine Audit-Findings. Die Aufträge stammen aus »Offene Befunde« und der `Folgen:`-Zeile von Paket 4 in `./remediation-plan.md`:

**Nebenbefund · info · `scripts/publishNpmPkg.mjs:70`** — scheitert `npm publish`, wirft `execFileSync` ungefangen und das Skript endet mit rohem Stacktrace statt einer Meldung wie `npm show failed: …` (vorbestehend, gleiches Verhalten mit `execSync`).

**Nebenbefund · info · `scripts/publishNpmPkg.mjs:31`** — `pkgJson.version.endsWith('-dev')` wirft einen `TypeError`, wenn das Manifest keine `version` trägt (vorbestehend).

**Nebenbefund · info · `scripts/makePackageJson.mjs:62`** — `writeFileSync` legt `dist/` nicht an; ohne vorheriges `tsc` endet das Skript mit `ENOENT`-Stacktrace statt einer Meldung (vorbestehend).

**Folge aus Paket 4 · low (geschätzt) · `scripts/publishNpmPkg.mjs:36` und `:70`** — `execFile`/`execFileSync('npm', …)` ohne Shell finden unter Windows kein `npm.cmd` (die Shell von `exec` fand es); Deploy läuft auf Ubuntu, betroffen wäre ein lokaler Aufruf unter Windows.
