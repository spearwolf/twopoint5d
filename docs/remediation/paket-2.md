# Paket 2 — Tooling, Skripte und CI-Workflows

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUILD-001 (low), BUILD-003 (info), DOC-003 (info), TEST-008 (info), TEST-003 (medium), ASYNC-004 (low), BUG-015 (low), DOC-001 (low)
- Dazu, gleiche Ursache wie DOC-001: `scripts/checkDocSnippets/typecheckInputs.test.mjs:18` liest dieselbe Liste aus dem Index (siehe Abgleich)
- Ziel: Publish-Skript, Gate-Sperre, Preview-Generator, Doc-Snippet-Check und die Workflows verhalten sich an ihren Rändern korrekt und sind getestet bzw. dokumentiert.
- Modell: mittlere Stufe — acht kleine, voneinander unabhängige Änderungen, jede hier mit Namen, Werten und Testfällen ausgeschrieben; kein Umbau über Modulgrenzen. Die heikle Stelle (SIGINT in einer Prozessgruppe) ist mit Testcode vorgegeben.
- Effort: medium — mehrere Regressionstests mit rotem Lauf, Kindprozesse und Prozessgruppen in den Specs, zwei Workflows, die sich lokal nur parsen lassen. Kein Transkript im Sinne von `low`.
- Reviewer: stärkste Stufe empfohlen — der Diff berührt `scripts/publishNpmPkg.mjs` und `deploy.yml` (die Publish-Pipeline, AGENTS.md »Publishing«) und die Signal-Semantik von `runExclusive.mjs`; beides fällt erst im Deploy bzw. im Terminal auf.
- Dateien:
  - neu: `scripts/publishNpmPkg/publishDecision.mjs`, `scripts/publishNpmPkg/publishDecision.test.mjs`
  - `scripts/publishNpmPkg.mjs`
  - `scripts/ci/runExclusive.mjs`, `scripts/ci/runExclusive/runExclusive.test.mjs`
  - `scripts/lookbook/demoPreviewConfig.mjs`, `scripts/lookbook/demoPreviewConfig.test.mjs`, `scripts/lookbook/generateDemoPreviews.mjs`, `apps/lookbook/README.md` (»Preview images«)
  - neu: `scripts/checkDocSnippets/trackedMarkdownFiles.mjs`, `scripts/checkDocSnippets/trackedMarkdownFiles.test.mjs`
  - `scripts/checkDocSnippets.mjs`, `scripts/checkDocSnippets/typecheckInputs.test.mjs`
  - neu: `scripts/ci/auditInstalledDependencies.mjs`, `scripts/ci/auditInstalledDependencies/selectAdvisories.mjs`, `scripts/ci/auditInstalledDependencies/selectAdvisories.test.mjs`, `scripts/ci/auditInstalledDependencies/auditInstalledDependencies.test.mjs`
  - `.github/workflows/bench.yml`, `.github/workflows/deploy.yml`, `.github/workflows/ci.yml` (nur der Kommentar des Audit-Schritts)
  - `README.md` (»2. Build and test everything«), `AGENTS.md`, `docs/architecture.md` (§3, »In CI«, §4, §6)
- Nicht anfassen: `packages/twopoint5d/` (kein CHANGELOG-Eintrag — nichts hier ändert die
  veröffentlichte Library oder ihr Paket), die Lockfile, `pnpm-workspace.yaml`.
- **Nie starten:** `scripts/publishNpmPkg.mjs` und `pnpm publishNpmPkg` — weder direkt noch
  als Kindprozess eines Specs (CLAUDE.md, AGENTS.md). `node --check scripts/publishNpmPkg.mjs`
  (nur parsen) und der Typecheck sind erlaubt.

## Abgleich gegen den Code (Zug 0, 2026-10-31, HEAD 726f020f)

- **TEST-003 — unverändert.** `scripts/publishNpmPkg.mjs:49` (`-dev`), `:78-104`
  (`execFile`-Callback mit den Zweigen »bereits veröffentlicht«, E404, Parse-Fehler,
  Timeout/Fehler), `:106-121` (`publishPackage`, Fehlerpfad). Alle Helfer unter
  `scripts/publishNpmPkg/` haben Specs; die Verzweigung selbst hat keinen. Einzig
  `builtinImportsOnly.test.mjs` liest das Skript, statisch.
- **ASYNC-004 — unverändert.** `scripts/ci/runExclusive.mjs:19`
  `FORWARDED_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP']`, `:123`
  `spawn(command, args, {stdio: 'inherit'})` ohne eigene Prozessgruppe, `:127` leitet jedes
  der drei Signale per `child.kill(signal)` weiter. `:137` entfernt vor dem erneuten Auslösen
  die Listener genau dieser Liste.
- **BUG-015 — unverändert.** `scripts/lookbook/generateDemoPreviews.mjs:151-153` meldet einen
  fehlenden Adapter nur als Zeile, `:158-162` schreibt danach jede Demo, `:164-166` Exit 0.
  `scripts/lookbook/demoPreviewConfig.mjs:38-67` (`parsePreviewArgs`, `strict: true`) kennt
  kein `--allow-webgl2`.
- **DOC-001 — unverändert.** `scripts/checkDocSnippets.mjs:43` `git ls-files -z -- '*.md'`,
  `:49` `fs.readFileSync(file, 'utf8')` ohne Existenzprüfung, `:55-57` macht daraus Exit 2;
  der Kopf (`:15-16`) reserviert Exit 2 für »git or the tsconfig is unreadable«. Nachgeprüft:
  `git ls-files` nennt einen Pfad im Merge-Konflikt einmal je Stufe (drei Zeilen für ein
  `c.md` mit den Stufen 1–3).
  **Gleiche Ursache, andere Stelle:** `scripts/checkDocSnippets/typecheckInputs.test.mjs:18-20`
  bildet dieselbe Liste aus dem Index und hält sie gegen die Inputs, die Nx vom Dateisystem
  liest — eine getrackte, aber gelöschte `.md` macht auch diesen Spec rot. Er nimmt künftig
  dieselbe Funktion wie das Skript; damit hält er wörtlich die Liste fest, die das Skript liest.
- **BUILD-001 — unverändert.** `.github/workflows/bench.yml:50-56`: `upload-artifact` mit
  `path: packages/twopoint5d/bench-results`, ohne `if-no-files-found`; `:9-11` nächtlich per
  `schedule`, ohne Prüfung, ob der Commit schon gemessen ist. `packages/*/bench-results` ist
  ignoriert (`.gitignore:31`), ein frischer Checkout hat das Verzeichnis nicht.
- **BUILD-003 — unverändert.** `.github/workflows/ci.yml:87-111` meldend mit
  `continue-on-error: true`; `.github/workflows/deploy.yml:97-100` installiert im Job `build`
  Root und Library, kein Audit-Schritt.
  **Was `pnpm audit` hier kann (lokal geprüft, pnpm 10.27.0):** es liest immer den ganzen
  Lockfile, alle vier Importer. `pnpm --filter … audit` bricht ab mit
  `ERROR  Unknown option: 'recursive'`. `--prod` prüft 344 Pakete, darunter die
  `dependencies` des Lookbooks, und lässt die Root-`devDependencies` (Nx, tsc, attw, publint,
  rimraf) aus — also gerade die Toolchain, die der Build-Job installiert und die das Finding
  meint; `packages/twopoint5d` hat keine `dependencies`. In `pnpm audit --json` beginnt jeder
  Pfad mit der Importer-ID: `.` für den Root, sonst das Verzeichnis mit `__` statt `/`
  (`.>nx>minimatch`, `packages__twopoint5d-testing>@web/test-runner>@web/dev-server>deepmerge`).
- **DOC-003 — unverändert.** `package.json:34` `ci`, `:37` `cbt` (`pnpm run ci`; der Name
  stammt aus `753ff737`, damals `run-s clean build test`). `README.md:214-221` zeigt
  `pnpm cbt` mit einem Kommentar, ohne zu sagen, dass es das Pre-Commit-Gate ist, dass es ein
  Alias ist und warum kein Hook es startet. Kein `.husky`, `.githooks`, `lefthook`.
- **TEST-008 — unverändert.**
  `packages/twopoint5d/src/stage/hot-path-allocations.director.spec.ts:21`
  `BYTES_PER_CALL_LIMIT = 1`; `.github/workflows/ci.yml:59-62` Allocations nur unter Node 24,
  `:159-163` der Cache-Schlüssel nennt nur die Major-Linie (`node24`), weil der Nx-Hash die
  Node-Version auslässt. Nach Entscheidung kein Code, nur die Regel in AGENTS.md.

### Folgen aus erledigten Paketen

- Paket 1, `Folgen:` — `packages/twopoint5d/docs/proposals/gpu-picking.md:196-203` und
  `packages/twopoint5d/docs/proposals/sprite-and-texture-roadmap.md:452` zum Integer-Readback
  unter WebGL 2. Nachgesehen in three 0.187.0
  (`node_modules/.pnpm/three@0.187.0/node_modules/three/build/three.webgpu.js:34592-34623`,
  `WebGLTextureUtils#_getBytesPerTexel(glType, glFormat)`): kennt jetzt `RGBA_INTEGER`,
  `RG_INTEGER` und `RED_INTEGER`. `gpu-picking.md` nennt seine Grundlage mit Version
  (»three 0.186.1 …«) und stimmt für diese, verschweigt aber, dass der Zwang zu Float unter
  0.187 entfallen ist; `sprite-and-texture-roadmap.md:452` behauptet ohne Version im Präsens
  »WebGL 2 reads no integer target back« — unter 0.187 falsch. Guide (`docs/sprites.md`) und
  `SpritePicker.ts:416-418` hat Paket 1 schon nachgezogen; die Zeile in
  `CHANGELOG.md:187` steht unter `[0.24.0]`, also Historie, und bleibt.
  **Einordnung: Symptom von Paket 1** — dieselbe Ursache (die Hebung auf 0.187 ändert eine
  Tatsache, auf der Doku steht), andere Stelle; hätte Paket 1 die Hebung in der Doku zu Ende
  gezogen, gäbe es den Eintrag nicht. Paket 1 ist committet, also **Nachtragspaket 14**, im
  Plan direkt hinter Paket 2: unabhängig, klein, und Paket 9 (SpritePicker) liest das
  Picking-Proposal, bevor es den Picker anfasst. Nicht in dieses Paket: andere Ursache als
  alle acht Findings hier, und ein Doku-Satz über three gehört nicht in einen Tooling-Commit.

### Nebenbefunde aus dem Abgleich

Lokal `pnpm audit --json` (2026-10-31) meldet drei Advisories unter `high`, keins davon steht
im Audit. Alle vorbestehend: dieselben Lockfile-Einträge stehen schon in `d9b648bf`
(`git show d9b648bf:pnpm-lock.yaml`). Keine gemeinsame Ursache mit diesem Paket (hier geht es
darum, *wann* ein Audit blockiert, nicht um die Versionen); sie gehen in »Offene Befunde« des
Plans, Urteil je `→ Scope` (Scope-Regel: jede Severity). Begründung der Urteile:

- `minimatch@10.2.5`/`10.2.6` (`pnpm-lock.yaml:2995`, `:2999`), moderate GHSA-g3hv-75wg-m249,
  über `.>nx>minimatch` und `.>rimraf>glob>minimatch`; behoben ab 11.0.1. Lösbar über einen
  Eintrag unter `overrides` in `pnpm-workspace.yaml`, wie es das Projekt für `nx>undici` schon
  tut, oder über Hebungen von nx und rimraf.
- `glob@13.0.6` (`pnpm-lock.yaml:2475`), moderate GHSA-3g3m-2fjr-6pw4, über `.>rimraf>glob`;
  behoben ab 14.0.2. Derselbe Weg.
- `deepmerge@4.3.1` (`pnpm-lock.yaml:2155`), low GHSA-gcqx-w48m-w2h4, über
  `packages__twopoint5d-testing>@web/test-runner>@web/dev-server>deepmerge`; `patched_versions`
  ist `<0.0.0`, es gibt keinen behobenen Release. Lösbar über `pnpm patch` oder einen Override;
  sollte das nicht tragen, entscheidet die Drain-Runde des Abschlusses mit Begründung.

## Entscheidungen dieses Zug 0

- **TEST-003 über die reine Funktion, nicht über den Kindprozess.** Das Audit nennt beide
  Wege. Ein Spec in `pnpm test:scripts`, der `publishNpmPkg.mjs` als Kindprozess startet,
  führte das Publish-Skript bei jedem Gate aus, von jedem Agenten — CLAUDE.md und AGENTS.md
  verbieten genau das ohne ausdrücklichen Auftrag —, und `releaseFiles()` kopierte eine
  Workspace-`.npmrc`, die ein Token halten kann, in ein Temp-Verzeichnis. Die Entscheidung
  wandert deshalb in `decidePublish()`; im Skript bleibt eine Verdrahtung von drei Zweigen.
- **BUILD-003: »Produktions-Abhängigkeiten« aus »Entscheidungen« gelesen als »die Pakete, die
  der Deploy-Build-Job installiert und die das Release bauen«.** Wörtlich als `--prod` läse
  der Schritt die Lookbook-Abhängigkeiten, die der Job gar nicht installiert, und ließe Nx und
  die übrige Toolchain aus, die das Finding meint — die Library selbst hat keine
  `dependencies`. Der Kern der Entscheidung (Deploy-Build bricht bei high/critical ab, CI
  bleibt meldend) gilt unverändert. Weil `pnpm audit` keinen Filter annimmt, filtert ein
  kleines Skript seine JSON-Ausgabe auf die Pfade, die bei `.` oder `packages/twopoint5d`
  beginnen.
- **BUILD-003: ein Audit ohne Antwort hält den Deploy an** (fail closed). Ein Publish ohne
  Registry geht ohnehin nicht, und ein Deploy-Lauf lässt sich von Hand wiederholen; ein still
  übersprungenes Audit wäre genau die Lücke, die das Finding schließen soll.
- **BUILD-001: auch der optionale Teil wird gebaut** (Nutzer: »alles beheben, im Zweifel die
  saubere Lösung«). Ein nächtlicher Lauf misst einen Commit nur, wenn kein noch gehaltenes
  Artefakt `bench-<sha>` existiert; ein Lauf von Hand misst immer. Die Prüfung über das
  Artefakt (statt über den letzten Lauf) misst einen Commit nach Ablauf der 90 Tage wieder,
  sodass die Reihe auch über eine lange Pause ohne Push nicht abreißt.
- **ASYNC-004: SIGINT wird gar nicht mehr weitergeleitet**, wie empfohlen. Folge, die bewusst
  in Kauf genommen und dokumentiert wird: ein SIGINT allein an die PID von `runExclusive`
  beendet nichts; gestoppt wird ein Lauf per PID mit SIGTERM, das `kill` ohnehin sendet. Eine
  eigene Prozessgruppe für das Kind scheidet aus: dann läge Nx nicht mehr in der
  Vordergrundgruppe des Terminals und bekäme beim Lesen oder Umstellen des TTY (Nx-TUI)
  SIGTTIN/SIGTTOU.

## Vorgehen

Reihenfolge wie unten. Wo »rot sehen« steht: den Spec zuerst schreiben, laufen lassen, den
roten Lauf mit Ausgabe in den Report, dann beheben. Einzelne Specs laufen mit
`node --test <datei>`; erst am Ende einmal das Gate. Alle Texte in Code, Kommentaren und Doku
auf Englisch, ohne Finding-IDs und ohne Rückblick auf den Vorzustand (Konventionen im Plan).
Die englischen Formulierungen unten sind Vorlagen: Inhalt und Werte sind verbindlich, der
Wortlaut darf sich dem Ton der umgebenden Datei anpassen.

### 1. Publish-Entscheidung als reine Funktion

1. Neu `scripts/publishNpmPkg/publishDecision.mjs`. Importiert nur
   `{describeShowFailure, isNotPublishedError, parsePublishedVersions}` aus
   `./publishedVersions.mjs` (der Spec `builtinImportsOnly.test.mjs` liest das Verzeichnis
   selbst und erfasst die Datei ohne Änderung). Drei Exporte, jeder mit JSDoc:
   - `isDevelopmentVersion(version)` → `version.endsWith('-dev')`. JSDoc: a version marked
     as a development version, which no release publishes.
   - `decidePublish(version, {error, stdout, stderr})` mit dem Parametertyp
     `{error: (Error & {killed?: boolean}) | null, stdout: string, stderr: string}` und dem
     Rückgabetyp `PublishDecision`, als `@typedef` in der Datei:
     `{action: 'skip', message: string, versions: string[]} | {action: 'publish', versions: string[]} | {action: 'publish', message: string} | {action: 'fail', message: string}`.
     Logik in genau der Reihenfolge von `publishNpmPkg.mjs:79-103`:
     - kein `error`: `parsePublishedVersions(stdout.trim())`; wirft das, dann
       `{action: 'fail', message: `npm show printed no version list: ${parseError instanceof Error ? parseError.message : String(parseError)}`}`.
       Enthält die Liste `version`:
       `{action: 'skip', message: `skip publishing, version ${version} is already released`, versions}`,
       sonst `{action: 'publish', versions}`.
     - `error` gesetzt, `!error.killed && isNotPublishedError(stderr)`:
       `{action: 'publish', message: 'oh it looks like this is the first time to publish the package'}`.
       Der Kommentar von `:97` (»a killed npm has answered nothing, whatever it wrote
       before«) zieht mit hierher.
     - sonst `{action: 'fail', message: describeShowFailure(error, stderr)}`.
   - `describePublishFailure(error)` mit Parametertyp `Error & {status?: number | null}` →
     `` `npm publish failed: ${error.status != null ? `exit code ${error.status}` : error.message}` ``.
2. `scripts/publishNpmPkg.mjs` verdrahtet nur noch:
   - Import der drei Funktionen; `parsePublishedVersions`, `isNotPublishedError` und
     `describeShowFailure` werden dort nicht mehr importiert, `NPM_SHOW_TIMEOUT_MS` bleibt.
   - `:49` → `if (isDevelopmentVersion(pkgJson.version)) {`, Meldung unverändert.
   - Der Callback `:78-104` wird zu:
     ```js
     execFile(show.file, show.args, showOptions, (error, stdout, stderr) => {
       const decision = decidePublish(pkgJson.version, {error, stdout, stderr});
       if (decision.action !== 'fail' && 'versions' in decision) {
         console.log('already published versions: ---');
         console.dir(decision.versions);
       }
       if (decision.action === 'skip') {
         console.warn(decision.message);
         process.exit(0);
       } else if (decision.action === 'publish') {
         if ('message' in decision) console.log(decision.message);
         publishPackage(packageRoot);
       } else {
         console.error(decision.message);
         process.exit(1);
       }
     });
     ```
   - In `publishPackage` wird der `console.error(...)` des catch-Blocks zu
     `console.error(describePublishFailure(failure));`; der Cast und die Kommentare
     `:108-109`, `:113-114` bleiben.
   - Was das Skript ausgibt, bleibt auf jedem Pfad Zeichen für Zeichen gleich
     (`console.warn('a', v, 'b')` schreibt dieselbe Zeile wie die Template-Strings oben).
   - Danach `node --check scripts/publishNpmPkg.mjs` — und sonst kein Start des Skripts.
3. Neu `scripts/publishNpmPkg/publishDecision.test.mjs` (`node:test`, `describe`/`it`,
   `node:assert/strict`), ein `it` je Fall, `deepEqual` auf das ganze Ergebnis:
   - `isDevelopmentVersion`: `'0.25.0-dev'` → true; `'0.25.0'`, `'0.25.0-beta.1'`,
     `'0.25.0-dev.1'` → false.
   - kein Fehler, `stdout: '["0.23.0","0.24.0"]\n'`, Version `0.25.0` →
     `{action: 'publish', versions: ['0.23.0', '0.24.0']}`.
   - dieselbe Liste, Version `0.24.0` → `skip` mit
     `'skip publishing, version 0.24.0 is already released'` und der Liste.
   - genau eine veröffentlichte Version als nackter String, `stdout: '"0.24.0"\n'`,
     Version `0.24.0` → `skip`, `versions: ['0.24.0']`.
   - `stdout: ''` und `stdout: 'npm notice …'` → `fail`, `message` passt auf
     `/^npm show printed no version list: /`.
   - Fehler ohne `killed`, `stderr: 'npm error code E404\nnpm error 404 Not Found - GET …\n'`
     und ebenso `'npm ERR! code E404\n'` → `publish` mit der Erstveröffentlichungs-Meldung.
   - Fehler mit `killed: true` und E404 in `stderr` → `fail`,
     `'npm show did not answer within 60 s'` (ein getöteter npm ist nie eine
     Erstveröffentlichung); ebenso `killed: true` mit leerem `stderr`.
   - Fehler, `stderr: 'npm error code E401\n'` → `fail`, `'npm show failed: npm error code E401'`.
   - `new Error('spawn npm ENOENT')`, `stderr: ''` → `fail`, `'npm show failed: spawn npm ENOENT'`.
   - `describePublishFailure(Object.assign(new Error('Command failed'), {status: 1}))` →
     `'npm publish failed: exit code 1'`; mit `status: null` →
     `'npm publish failed: Command failed'`.
4. `docs/architecture.md` §4, hinter »… the scripts themselves only wire it up.« (um Zeile
   356): Which of skip, publish and fail an answer of `npm show` means is `decidePublish()` in
   `scripts/publishNpmPkg/publishDecision.mjs`, whose spec goes through every answer; no spec
   starts the publish script itself.

### 2. SIGINT in `runExclusive` nur einmal beim Kommando

1. Rot sehen: in `scripts/ci/runExclusive/runExclusive.test.mjs` hinter dem Test »hands a
   SIGTERM on …« zwei neue Tests, beide nach dessen Muster (Wrapper per `spawn`, `'ready'` auf
   stdout abwarten, 10-s-Notausgang im Kommando, keine Busy-Loops):
   - »hands Ctrl-C to its command once: the terminal signals the whole process group«:
     ```js
     const wrapper = spawn(
       process.execPath,
       [script, '--lock', lock, '--', process.execPath, '-e',
         `let count = 0;
          process.on('SIGINT', () => { if (count++ === 0) setTimeout(() => process.exit(10 + count), 500); });
          console.log('ready');
          setTimeout(() => process.exit(9), 10_000);`],
       // a process group of its own, which the command joins: a gate in the foreground of a terminal
       {stdio: ['ignore', 'pipe', 'pipe'], detached: true},
     );
     // … exited/ready wie im SIGTERM-Test …
     assert.ok(wrapper.pid);
     process.kill(-wrapper.pid, 'SIGINT');
     assert.deepEqual(await exited, {code: 11, signal: null});
     assert.equal(fs.existsSync(lock), false);
     ```
     Erwartet rot vor dem Fix: `{code: 12, …}` — das Kommando zählt zwei SIGINT.
   - »leaves its command running on a SIGINT to its own pid alone and holds the lock until
     the command ends«: Kommando
     `process.on('SIGINT', () => process.exit(8)); process.on('SIGTERM', () => process.exit(7)); console.log('ready'); setTimeout(() => process.exit(9), 10_000);`,
     ohne `detached`. Nach `'ready'`: `wrapper.kill('SIGINT')`, dann
     `Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve('running'), 300))])`
     muss `'running'` liefern, das Lock muss noch existieren; danach `wrapper.kill('SIGTERM')`,
     `{code: 7, signal: null}`, Lock weg. Erwartet rot vor dem Fix: das Kommando endet mit 8.
   - Dazu als Wächter (vor dem Fix grün): »dies of a SIGINT its command died of, and releases
     the lock« nach dem Muster von »dies of the signal its command died of«, mit
     `process.kill(process.pid, 'SIGINT')`, erwartet `status: null`, `signal: 'SIGINT'`. Er
     fängt den Fix, der den eigenen SIGINT-Listener vor dem erneuten Auslösen stehen lässt —
     dann hinge der Wrapper bis zum Timeout von `spawnSync`.
2. Fix in `scripts/ci/runExclusive.mjs`:
   - `:19` → `const FORWARDED_SIGNALS = /** @type {const} */ (['SIGTERM', 'SIGHUP']);`
   - `:125-127` → SIGTERM und SIGHUP weiter wie bisher an `child.kill(signal)`; dazu
     `process.on('SIGINT', () => {});` mit dem Kommentar: Ctrl-C in a terminal sends SIGINT
     to the whole foreground process group, so the command has it already, and Nx and pnpm
     read a second one as "stop at once". The listener only keeps the default action of
     SIGINT from ending this process before the command, which would leave the lock behind
     and the command without a parent that waits for it.
   - `:137` entfernt vor `process.kill(process.pid, signal)` die Listener von `SIGINT`
     **und** von `FORWARDED_SIGNALS`, sonst trifft ein weitergereichter Tod durch SIGINT den
     eigenen No-op-Listener und der Prozess endet nie.
   - Kopfkommentar (`:1-11`) um einen Absatz ergänzen: SIGTERM and SIGHUP go on to the
     command; SIGINT does not, because a terminal sends it to the command as well. A SIGINT
     to the pid of this process alone therefore stops nothing — stop a run by its pid with
     SIGTERM, which `kill` sends.
3. `docs/architecture.md` §3, hinter »`ci:gate` called directly takes no lock.« (Zeile 115):
   Ctrl-C reaches the gate once: the terminal sends SIGINT to the whole foreground process
   group, the command included, so the lock hands it on to nobody — Nx and pnpm take a second
   SIGINT for "stop at once". It hands on SIGTERM and SIGHUP; a run is stopped by its pid with
   SIGTERM, while a SIGINT to the pid of the lock alone stops nothing.

### 3. Preview-Generator ohne WebGPU-Adapter

1. Rot sehen in `scripts/lookbook/demoPreviewConfig.test.mjs`:
   - der Test »has defaults for a run without flags« erwartet zusätzlich `allowWebgl2: false`;
     der Test »reads --only as …« bekommt `'--allow-webgl2'` in die Argumente und
     `allowWebgl2: true` ins Ergebnis, sein Titel nennt `--allow-webgl2` mit. Jedes weitere
     `deepEqual` auf ein Ergebnis von `parsePreviewArgs` in der Datei bekommt den Schlüssel
     ebenso. Rot vor dem Fix: `Unknown option '--allow-webgl2'`.
   - neuer `describe('refuseAdapter()')` mit drei Fällen: `refuseAdapter('nvidia ampere', false)`
     → `undefined`; `refuseAdapter(undefined, true)` → `undefined`;
     `refuseAdapter(undefined, false)` → ein String, der auf `/no WebGPU adapter/` und auf
     `/--allow-webgl2/` passt.
2. `scripts/lookbook/demoPreviewConfig.mjs`:
   - `parsePreviewArgs`: Option `'allow-webgl2': {type: 'boolean', default: false}`, im
     Ergebnis `allowWebgl2: values['allow-webgl2'] ?? false`; der JSDoc-Rückgabetyp bekommt
     `allowWebgl2: boolean`.
   - neuer Export neben `refuseScreenshot`:
     ```js
     /**
      * Why the run writes no preview at all, or undefined when it goes ahead. Without a WebGPU
      * adapter three.js renders with WebGL 2, whose images look different from the committed
      * ones, so such a run writes them only under `--allow-webgl2`.
      * @param {string | undefined} adapter what describeWebGpuAdapter() found
      * @param {boolean} allowWebgl2 `--allow-webgl2`
      * @returns {string | undefined}
      */
     export function refuseAdapter(adapter, allowWebgl2) {
       if (adapter !== undefined || allowWebgl2) return undefined;
       return 'Chromium found no WebGPU adapter, so three.js would render every preview with WebGL 2, which looks different; nothing is written. --allow-webgl2 writes them anyway';
     }
     ```
3. `scripts/lookbook/generateDemoPreviews.mjs`: `refuseAdapter` importieren; in `main()`
   direkt hinter `console.log(`WebGPU adapter: …`)` (`:153`) und vor der Zeile
   `${ids.length} demo(s) into …`:
   ```js
   const refusal = refuseAdapter(adapter, options.allowWebgl2);
   if (refusal) {
     console.error(`generateDemoPreviews: ${refusal}`);
     return 2;
   }
   ```
   Der `finally`-Block schließt Browser und Server wie bisher. Kopfkommentar (`:1-4`) um die
   Exit-Codes ergänzen: 0 every preview written, 1 a demo failed, 2 no WebGPU adapter without
   `--allow-webgl2`, or the run could not start.
4. `apps/lookbook/README.md`, »Preview images«: Tabellenzeile
   `| `--allow-webgl2` | write the previews even without a WebGPU adapter, rendered with WebGL 2 |`
   hinter `--strict`. Der Satz »The run prints whether Chromium found a WebGPU adapter;
   without one three.js renders with WebGL 2, which works but may look slightly different.«
   wird zu: The run prints whether Chromium found a WebGPU adapter. Without one three.js would
   render with WebGL 2, which looks different from the committed images, so the run writes
   nothing and exits with 2; `--allow-webgl2` writes them anyway. Der Rest des Absatzes
   (Vulkan unter Linux) bleibt. Dann `grep -n -i 'webgl 2\|adapter' AGENTS.md docs/architecture.md`
   und jede Stelle angleichen, die sagt, der Generator schreibe ohne Adapter.

### 4. `checkDocSnippets`: nur Dateien, die im Arbeitsbaum liegen

1. Neu `scripts/checkDocSnippets/trackedMarkdownFiles.mjs`, zuerst **mit der heutigen Logik
   unverändert**: `export function trackedMarkdownFiles(repoRoot)` gibt
   `execFileSync('git', ['ls-files', '-z', '--', '*.md'], {cwd: repoRoot, encoding: 'utf8'}).split('\0').filter(Boolean)`
   zurück — relativ zu `repoRoot`.
2. Rot sehen: neu `scripts/checkDocSnippets/trackedMarkdownFiles.test.mjs`, je Test ein
   frisches Temp-Repo (`fs.mkdtempSync(path.join(os.tmpdir(), 'tracked-markdown-'))`,
   `git init --quiet`, Aufräumen in `afterEach`; kein Commit, also keine Git-Identität nötig;
   `git` über `execFileSync` mit `cwd` auf das Temp-Repo):
   - »leaves out a tracked file the working tree no longer holds«: Dateien `a.md`,
     `docs/b.md`, `with space.md`, `gone.md`, `notes.txt` schreiben, `git add -- .`, dann
     `gone.md` löschen und ein ungetracktes `untracked.md` anlegen → erwartet
     `['a.md', 'docs/b.md', 'with space.md']`. Rot vor dem Filter: `gone.md` steht in der Liste.
   - »names a file once while a merge conflict holds it in three stages«: `c.md` schreiben,
     `sha` aus `git hash-object -w c.md`, dann `git update-index --index-info` mit der Eingabe
     `100644 ${sha} 1\tc.md\n100644 ${sha} 2\tc.md\n100644 ${sha} 3\tc.md\n` (per `input` an
     `execFileSync`) → erwartet `['c.md']`. Rot vor dem Fix: dreimal `c.md` (lokal geprüft).
3. Fix in `trackedMarkdownFiles.mjs`:
   `return [...new Set(listed)].filter((file) => fs.existsSync(path.join(repoRoot, file)));`
   JSDoc: the Markdown files git tracks under `repoRoot` that the working tree holds, relative
   to it, each once. A file deleted or moved without `git rm`/`git mv` stays in the index until
   the next commit and has no blocks to check; a merge conflict lists a path once per stage.
4. `scripts/checkDocSnippets.mjs`: Import; `:43-46` wird zu
   `trackedMarkdownFiles(repoRoot).map((file) => path.join(repoRoot, file))`; der Kommentar
   `:39` bleibt. Kopf `:12-16`: »(default: every tracked *.md of the repository that the
   working tree holds)« und »2: git, the tsconfig or a file named on the command line is
   unreadable.« Eine auf der Kommandozeile genannte, fehlende Datei bleibt Exit 2.
5. `scripts/checkDocSnippets/typecheckInputs.test.mjs`: `:18-20` wird zu
   `const tracked = trackedMarkdownFiles(repoRoot);` (Import aus `./trackedMarkdownFiles.mjs`),
   `execFileSync` bleibt für Nx. Der Kopfkommentar sagt, dass der Spec dieselbe Liste nimmt,
   die `checkDocSnippets.mjs` liest. Die neue Datei ist über
   `{workspaceRoot}/scripts/checkDocSnippets/*.mjs` schon Input von
   `twopoint5d-testing:typecheck` — `project.json` bleibt.
6. `docs/architecture.md` §2 (Zeilen 74-86) bleibt: der Absatz beschreibt die Inputs von
   `twopoint5d-testing:typecheck`, und Nx liest ohnehin nur Dateien, die auf der Platte liegen.

### 5. Bench-Workflow

`.github/workflows/bench.yml`:

1. Kopfkommentar (`:3-7`) ergänzen: A nightly run measures a commit once — a night without a
   push would only add a second point for the same commit — and a run by hand always measures.
2. Neuer Job vor `bench`:
   ```yaml
     lookup:
       name: Look for the archive of this commit
       runs-on: ubuntu-24.04
       timeout-minutes: 5
       # lists the artifacts of the repository; checks nothing out and installs nothing
       permissions:
         actions: read
       outputs:
         measure: ${{ steps.archive.outputs.measure }}
       steps:
         - name: Look for bench-${{ github.sha }}
           id: archive
           env:
             GH_TOKEN: ${{ github.token }}
             EVENT: ${{ github.event_name }}
           # an archive past its 90 days counts as none, so a commit that stays the head of
           # main for longer is measured again
           run: |
             if [ "$EVENT" != schedule ]; then
               echo "measure=true" >> "$GITHUB_OUTPUT"
               exit 0
             fi
             kept=$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=bench-$GITHUB_SHA" --jq '[.artifacts[] | select(.expired | not)] | length')
             if [ "$kept" -gt 0 ]; then
               echo "bench-$GITHUB_SHA is archived already"
               echo "measure=false" >> "$GITHUB_OUTPUT"
             else
               echo "measure=true" >> "$GITHUB_OUTPUT"
             fi
   ```
3. Job `bench`: `needs: lookup` und `if: ${{ needs.lookup.outputs.measure == 'true' }}`.
4. Schritt »Archive benchmark results«: `path: packages/twopoint5d/bench-results/results.json`
   und `if-no-files-found: error`, Kommentar: a run that wrote no results.json fails here
   instead of leaving a gap in the series. Ein einzelner Dateipfad legt `results.json` an die
   Wurzel des Artefakts, wie es das Verzeichnis tat — das Layout bleibt.
5. `docs/architecture.md`, Absatz zu `bench.yml` (um Zeile 230): ein nächtlicher Lauf
   überspringt einen Commit, dessen `bench-<commit sha>` noch gehalten wird; ein Lauf von Hand
   misst immer; ein Lauf ohne `results.json` schlägt fehl.

### 6. Audit im Deploy-Build-Job

1. Neu `scripts/ci/auditInstalledDependencies/selectAdvisories.mjs` (nur `node:`-Importe
   oder keine):
   - `export const BLOCKING_SEVERITIES = ['high', 'critical'];`
   - `export function importerId(dir)` → `'.'` für `'.'`, sonst `dir.replaceAll('/', '__')`;
     JSDoc: the id `pnpm audit --json` writes at the start of a path.
   - `export function selectAdvisories(report, importers)`: wirft
     `new Error('it holds no "advisories" object, so it is no report of pnpm audit')`, wenn
     `report` kein Objekt ist oder `report.advisories` kein Objekt (nicht `null`, kein Array).
     Sonst über `Object.values(report.advisories)`: nur `severity` aus
     `BLOCKING_SEVERITIES`; davon nur Advisories mit mindestens einem Pfad in
     `findings[].paths`, dessen Teil vor dem ersten `>` eine der Importer-IDs ist — exakter
     Vergleich, damit `packages__twopoint5d-testing>…` nicht als `packages__twopoint5d` zählt.
     Ergebnis je Treffer `{severity, module, vulnerableVersions, title, url, path}` aus
     `severity`, `module_name`, `vulnerable_versions`, `title`, `url` und dem ersten
     passenden Pfad; sortiert `critical` vor `high`, dann nach `module`. JSDoc nennt die Form
     des Berichts (`advisories` nach ID, je `module_name`, `severity`, `title`, `url`,
     `vulnerable_versions`, `findings: [{version, paths}]`).
2. Neu `scripts/ci/auditInstalledDependencies.mjs`, Kopfkommentar nach dem Muster von
   `runExclusive.mjs` (wozu, Aufruf, Exit-Codes):
   `node scripts/ci/auditInstalledDependencies.mjs --report <file> --importer <dir> [--importer <dir> …]`.
   `parseArgs` mit `report: {type: 'string'}` und `importer: {type: 'string', multiple: true}`;
   fehlt eins, Usage-Zeile auf stderr, Exit 2. Liest `--report`, `JSON.parse`, ruft
   `selectAdvisories`. Lesefehler, JSON-Fehler und der Wurf von `selectAdvisories` →
   `auditInstalledDependencies: <report> <grund>` auf stderr, Exit 2. Treffer → je Zeile
   `${severity} ${module} ${vulnerableVersions}: ${title} (${url}), reached through ${path}`,
   danach `auditInstalledDependencies: ${n} high or critical advisories reached from ${importers.join(', ')}`,
   alles auf stderr, Exit 1. Kein Treffer →
   `auditInstalledDependencies: no high or critical advisory reached from ${importers.join(', ')}`
   auf stdout, Exit 0.
3. Neu `scripts/ci/auditInstalledDependencies/selectAdvisories.test.mjs`, Fixtures in der Form
   von `pnpm audit --json` (Pfade wie `.>nx>minimatch`, `packages__twopoint5d>three>x`,
   `packages__twopoint5d-testing>@web/test-runner>@web/dev-server>deepmerge`):
   - `importerId('.')` → `'.'`, `importerId('packages/twopoint5d')` → `'packages__twopoint5d'`.
   - `high` über `.>nx>…` → ein Treffer mit diesem Pfad.
   - `critical` über `packages__twopoint5d>…` → Treffer; `critical` und `high` gemischt →
     `critical` zuerst.
   - `high` nur über `packages__twopoint5d-testing>…` und nur über `apps__lookbook>…` → kein
     Treffer.
   - `moderate`, `low`, `info` über `.>…` → kein Treffer.
   - ein Advisory mit zwei Findings, das erste nur über den Lookbook, das zweite über `.` →
     Treffer mit dem Pfad über `.`.
   - `{}`, `null`, `{advisories: null}`, `{advisories: []}` → wirft.
4. Neu `scripts/ci/auditInstalledDependencies/auditInstalledDependencies.test.mjs`, startet das
   Skript als Kindprozess (`spawnSync(process.execPath, [script, …], {encoding: 'utf8', timeout: 10_000})`)
   gegen Fixture-Dateien in einem Temp-Verzeichnis: Treffer → Exit 1, stderr nennt Modul und
   Pfad; keiner → Exit 0 und die Zeile auf stdout; leere Datei, kein JSON, `{}` → Exit 2;
   ohne `--report` und ohne `--importer` → Exit 2 mit Usage-Zeile.
5. `.github/workflows/deploy.yml`, Job `build`, direkt hinter »Install the workspace root and
   the library«:
   ```yaml
         - name: Audit the installed dependencies
           # the toolchain this job installs builds and checks the package the publish job
           # uploads, so a high or critical advisory in it stops the deploy. pnpm audit reads
           # the whole lockfile and takes no --filter; the script keeps the advisories reached
           # from the two projects installed above. An audit without an answer stops the
           # deploy as well: re-run the job once the registry answers
           run: |
             pnpm audit --json > "$RUNNER_TEMP/pnpm-audit.json" 2> "$RUNNER_TEMP/pnpm-audit.err" || true
             if ! node scripts/ci/auditInstalledDependencies.mjs --report "$RUNNER_TEMP/pnpm-audit.json" --importer . --importer packages/twopoint5d; then
               cat "$RUNNER_TEMP/pnpm-audit.err"
               exit 1
             fi
           timeout-minutes: 2
   ```
   (`|| true`: `pnpm audit` endet schon bei einem `low` mit 1; was blockiert, entscheidet das
   Skript.)
6. `.github/workflows/ci.yml`, Kommentar des Schritts »Audit dependencies« (`:88-94`): ein
   Satz dazu — the build job of the deploy holds what it installs to the same level and
   stops on a hit. Der Schritt selbst bleibt.
7. `docs/architecture.md`: im Absatz zu »Audit dependencies« (um Zeile 221) derselbe Satz mit
   Verweis auf §4; im `build`-Punkt von §4 (um Zeile 400): it audits what it installed and
   stops on a high or critical advisory reached from the workspace root or the library
   (`scripts/ci/auditInstalledDependencies.mjs`), and on an audit without an answer; der
   Schlusssatz von §4 (»The exception is `scripts/ci/`: …«) nennt den Audit-Filter des Deploys
   mit, der ebenfalls nichts veröffentlicht.

### 7. README: Gate und Alias

`README.md`, »### 2. Build and test everything« (`:214-221`): vor den Codeblock ein Absatz,
den Codeblock behalten, dahinter ein zweiter:

- `pnpm run ci` is the gate every commit has to pass, the same one CI runs on every push;
  `pnpm cbt` — clean, build, test — is its short name.
- It takes several minutes and starts Chromium, Firefox and WebKit, so no Git hook runs it:
  run it yourself before you commit. A hook that only lints would let through commits the
  gate turns down. One gate runs at a time in a checkout — a second one refuses while the
  first holds `.nx/ci-gate.lock` —, and a `git worktree` has a lock of its own.
  [Monorepo architecture §3](docs/architecture.md#3-the-ci-gate) lists every step.

### 8. AGENTS.md: Allocation-Specs nach einem Node-Upgrade

`AGENTS.md`, Punkt `pnpm test:allocations` (`:49-52`), angehängt: After an upgrade of Node —
the one on your machine, or the line CI installs — run them once as
`pnpm test:allocations --skip-nx-cache`: the Nx hash of a task leaves the Node version out, so
the cache would replay a measurement taken under the old V8. (`--skip-nx-cache` ist in Nx 24
der Kebab-Alias von `--skipNxCache`, lokal in `nx run-many --help` nachgesehen.)

### 9. Listen in AGENTS.md und docs/architecture.md nachziehen

- `AGENTS.md`, Punkt `pnpm test:scripts` (`:57-71`): die Specs des Audit-Filters des Deploys
  aufnehmen (»… the CI cache server, the audit filter of the deploy, the docs' code block
  check …« und bei den Kindprozessen `auditInstalledDependencies.mjs`).
- `AGENTS.md`, Regel »Publishing« (`:163-170`): `scripts/ci/` umfasst den Audit-Filter des
  Deploy-Build-Jobs, der nichts veröffentlicht.
- `docs/architecture.md` §3, Punkt `test:scripts` (Zeilen 170-185): die neuen Specs
  (Publish-Entscheidung, Audit-Filter samt Kindprozess, `trackedMarkdownFiles`) nennen.
- `docs/architecture.md` §6 (Zeilen 575-582): »Five specs start a script itself« wird
  »Six«, die Aufzählung bekommt `scripts/ci/auditInstalledDependencies.mjs` against throwaway
  reports; der Satz »No spec runs `publishNpmPkg.mjs` …« bleibt und bekommt den Halbsatz, dass
  `decidePublish()` dessen Entscheidung trägt und ihr Spec sie abdeckt.

### 10. Abschluss

- `pnpm format`, dann das Verify-Kommando unten. Rot nur durch dieses Paket gilt nicht als
  fertig.
- Kein Commit.

- Verify: `node --input-type=module -e "import fs from 'node:fs'; import {parseDocument} from 'yaml'; for (const f of ['bench', 'ci', 'deploy']) { const doc = parseDocument(fs.readFileSync('.github/workflows/' + f + '.yml', 'utf8')); if (doc.errors.length > 0) { console.error(f, doc.errors.map(String).join('\n')); process.exit(1); } }" && pnpm run ci`
- Commit:
  ```
  fix(ci): stop the deploy on a high advisory and hand Ctrl-C to the gate once

  The build job of the deploy audits the dependencies it installs and stops on a high or
  critical advisory reached from the workspace root or the library, and on an audit that
  gets no answer. pnpm audit reads the whole lockfile and takes no filter, so
  scripts/ci/auditInstalledDependencies.mjs keeps the advisories of those two projects. The
  audit of the CI workflow still only reports.

  runExclusive.mjs no longer hands SIGINT on: Ctrl-C reaches the whole foreground process
  group, the command included, and Nx and pnpm take a second one for "stop at once". SIGTERM
  and SIGHUP still go on to the command.

  The nightly benchmark run skips a commit whose archive is still kept, and a run that writes
  no results.json fails.

  publishNpmPkg.mjs takes its decision from decidePublish(), whose spec covers a development
  version, a version npm lists already, a first publish, a timeout, an answer that is no
  version list and a failed publish.

  The preview generator writes nothing without a WebGPU adapter unless --allow-webgl2 is
  passed. checkDocSnippets.mjs and the spec of its Nx inputs leave out tracked Markdown files
  the working tree does not hold, and name a conflicted file once.

  The README explains pnpm run ci and its alias cbt and why no Git hook runs it; AGENTS.md
  asks for one run of the allocation specs without the Nx cache after a Node upgrade.
  ```
- Verlauf:
  - 2026-10-31 Zug 0: Detailplan steht · alle acht Findings unverändert an ihren Fundstellen
    · dazu `typecheckInputs.test.mjs:18` (gleiche Ursache wie DOC-001) · Folge aus Paket 1
    (Proposals, Integer-Readback) als Symptom → Nachtragspaket 14 hinter Paket 2 · drei
    vorbestehende Advisories (minimatch, glob, deepmerge) → »Offene Befunde«, je `→ Scope`
    · Restplan: nur Paket 14 eingefügt (vor Paket 9, das das Picking-Proposal liest); aus
    Paket 2 folgt keine Änderung an Reihenfolge oder Schnitt der Pakete 3–13, deren
    Fundstellen gleicht jeweils ihr eigener Zug 0 ab
  - 2026-10-31 Zug 1: Implementierer beauftragt, Modell sonnet (mittlere Stufe), Effort medium · Brief `paket-2.impl-0.brief.txt`, Report `paket-2.impl-0.json` im Arbeitsverzeichnis
  - 2026-10-31 Zug 2: Report FERTIG (session c5116870), 15 Dateien geändert, 8 neu (`publishDecision.mjs`+Spec, `trackedMarkdownFiles.mjs`+Spec, `auditInstalledDependencies.mjs`, `auditInstalledDependencies/selectAdvisories.mjs`+2 Specs) · Arbeitsbaum schmutzig · rote Läufe belegt für runExclusive (2), trackedMarkdownFiles (2), demoPreviewConfig (Importfehler statt »Unknown option«) · eigener Verify exit=0 → `paket-2.verify.log`
  - 2026-10-31 Zug 3: Reviewer beauftragt, Modell opus (stärkste Stufe), Effort medium · Diff `paket-2.diff` im Arbeitsverzeichnis
  - 2026-10-31 Zug 3: Urteil — alle acht Findings behoben, 0 kritisch, 0 wichtig, 5 klein · Report `paket-2.review-0.json` (session fb6ca088)
  - 2026-10-31 Zug 4: keine Runde (nur kleine Befunde) · Commit-Message-Befund vor dem Commit in der Message selbst behoben
  - 2026-10-31 Zug 5: committet 154cebcb mit Trailer `Remediation-Run: 2026-10-31` · Verify `paket-2.verify.log` exit=0 (Stand unverändert seit dem Lauf)

## Urteil des Reviewers (Zug 3, opus)

- TEST-003 behoben — `scripts/publishNpmPkg/publishDecision.mjs:31-51`, verdrahtet in `scripts/publishNpmPkg.mjs:45`, `:75-93`, `:102`; Spec `publishDecision.test.mjs` deckt alle Fälle des Plans
- ASYNC-004 behoben — `scripts/ci/runExclusive.mjs:23` (nur SIGTERM/SIGHUP), `:136` No-op-SIGINT-Listener, `:147` entfernt ihn vor dem erneuten Auslösen; Kopf `:10-12`, `docs/architecture.md:116-119`; drei Tests in `runExclusive.test.mjs`
- BUG-015 behoben — `scripts/lookbook/demoPreviewConfig.mjs:47`, `:67`, `:106` (`refuseAdapter`); `generateDemoPreviews.mjs:158-162` Exit 2; `apps/lookbook/README.md`
- DOC-001 behoben — `scripts/checkDocSnippets/trackedMarkdownFiles.mjs:13-18`, genutzt in `scripts/checkDocSnippets.mjs:41`; Begleitstelle `typecheckInputs.test.mjs:20` behoben
- BUILD-001 behoben — `.github/workflows/bench.yml:91` `if-no-files-found: error`, Job `lookup` `:23-51`, `bench` mit `needs`/`if` `:55`
- BUILD-003 behoben — `.github/workflows/deploy.yml:103-115`, Filter `scripts/ci/auditInstalledDependencies.mjs` + `…/selectAdvisories.mjs` mit Specs; gegen echtes `pnpm audit --json` Exit 0, gegen eine nicht erreichbare Registry fail closed (Exit 2)
- DOC-003 behoben — `README.md:216-217`, `:226-230`
- TEST-008 behoben — `AGENTS.md:51-53`

Kleine Befunde (keine Runde):
- `AGENTS.md:60` (119 Zeichen) und `:63-64` nicht neu umbrochen; ebenso `docs/architecture.md:179` (119) und `:368` (127) — Rest der Dateien bricht bei ~90 um
- Commit-Message schrieb die -dev-Prüfung `decidePublish()` zu; vor dem Commit umformuliert auf `scripts/publishNpmPkg/publishDecision.mjs`
- `.github/workflows/deploy.yml:115` `timeout-minutes: 2`: hängt `pnpm audit` an einer stummen Registry, beendet der Step-Timeout den Schritt, bevor `pnpm-audit.err` ausgegeben wird; fail closed hält, nur der Grund fehlt im Log (Ausweg: `timeout 90 pnpm audit …` im Skript)
- `scripts/lookbook/generateDemoPreviews.mjs:157`: Logzeile »WebGPU adapter: none, three.js renders with WebGL 2« steht ohne `--allow-webgl2` direkt vor dem Abbruch, obwohl nichts gerendert wird
- Abweichung laut Implementierer: der rote Lauf in `demoPreviewConfig.test.mjs` war der fehlende Export `refuseAdapter`, nicht `Unknown option '--allow-webgl2'`

## Findings im Volltext

**TEST-003 · medium · scripts/publishNpmPkg.mjs:49** (auch `:78`, `:106`) — Entscheidungsfluss
von publishNpmPkg.mjs mit einem Fake-npm testen
Alle Hilfsfunktionen der Publish-Pipeline (checkManifest, parsePublishedVersions,
isNotPublishedError, npmCommand, releaseFiles …) haben Tests, die Orchestrierung aber nicht: das
Überspringen einer -dev-Version, der Abbruch bei bereits veröffentlichter Version, der
Erstveröffentlichungs-Pfad bei E404 und der Fehlerpfad bei Timeout oder Parse-Fehler stehen nur
im Top-Level-Code des Scripts. Außer builtinImportsOnly.test.mjs (statische Import-Prüfung)
referenziert kein Test das Script. Eine falsch verdrahtete Verzweigung würde erst im Deploy
auffallen — und eine veröffentlichte npm-Version ist unveränderlich.
Beleg: `if (versions.includes(pkgJson.version)) { … process.exit(0) } else { publishPackage(packageRoot) }`
und `else if (!error.killed && isNotPublishedError(stderr)) { publishPackage(packageRoot) }` ohne Test
Empfehlung: Das Script wie runExclusive.test.mjs und nxCacheServer.test.mjs als Kindprozess
starten, mit einem Fake-npm im PATH (Shell-Stub, der show/publish aufzeichnet) und --dry-run:
Fälle -dev, bereits veröffentlicht, E404, Timeout, Parse-Fehler, Publish-Fehler. Alternativ die
Entscheidung in eine reine Funktion (Eingabe: Version, Ergebnis von npm show; Ausgabe:
skip/publish/fail) ziehen und diese testen.

**BUILD-001 · low · .github/workflows/bench.yml:50** — Bench-Workflow: leeres Ergebnis nicht
als Fehler behandeln
upload-artifact hat kein `if-no-files-found: error` (im Gegensatz zu deploy.yml:120). Schreibt
das bench-Script keine bench-results/results.json (Vitest-Fehler im JSON-Reporter,
Pfadänderung), läuft der nächtliche Job grün durch und die 90-Tage-Reihe bekommt Lücken, die
erst Wochen später auffallen. Der Job läuft zudem jede Nacht auch ohne neuen Commit.
Empfehlung: `if-no-files-found: error` setzen; optional per Commit-Vergleich die Nachtläufe
ohne Änderung überspringen.

**ASYNC-004 · low · scripts/ci/runExclusive.mjs:127** — SIGINT in runExclusive nicht doppelt an
den Kindprozess liefern
Das Kind wird ohne eigene Prozessgruppe gestartet. Strg-C im Terminal schickt SIGINT an die
ganze Vordergrundgruppe, also an runExclusive und an das Kind (und dessen Kinder) zugleich; der
Handler leitet es per `child.kill('SIGINT')` ein zweites Mal weiter. Werkzeuge, die ein zweites
SIGINT als »sofort beenden« lesen (Nx, pnpm), brechen dann statt geordnet ab. Die Folge im Gate
ist nicht belegt, der Doppelversand schon.
Beleg: `for (const signal of FORWARDED_SIGNALS) process.on(signal, () => child.kill(signal));`
bei `spawn(command, args, {stdio: 'inherit'})`
Empfehlung: SIGINT nicht weiterleiten, solange das Kind in derselben Prozessgruppe läuft (nur
warten und das Lock danach freigeben); SIGTERM und SIGHUP weiterleiten, die nur den
Elternprozess treffen. Mit einem Test, der das Kind SIGINT zählen lässt.

**BUG-015 · low · scripts/lookbook/generateDemoPreviews.mjs:151** (auch `:153`,
`scripts/lookbook/demoPreviewConfig.mjs:26`) — Preview-Generator ohne WebGPU-Adapter nicht still
committete Bilder überschreiben lassen
Findet Chromium keinen WebGPU-Adapter, rendert three.js mit WebGL 2 (SwiftShader) — laut
Kommentar in chromiumGpuArgs »with another look«. Der Generator meldet das nur als Zeile
(`WebGPU adapter: none …`), schreibt dann aber alle Demos neu nach
apps/lookbook/public/images/demo-preview und gibt Exit 0 zurück. Ein Lauf auf einem Rechner ohne
Vulkan ersetzt die committeten Vorschaubilder unbemerkt durch Bilder anderer Optik.
Beleg: `console.log(`WebGPU adapter: ${adapter ?? 'none, three.js renders with WebGL 2'}`);`
gefolgt von der Schleife über alle Demos
Empfehlung: Ohne Adapter mit Fehler abbrechen (Exit 2) und einen Schalter `--allow-webgl2` für
den bewussten Fall anbieten; die Prüfung in demoPreviewConfig.mjs als reine Funktion testbar
halten.

**DOC-001 · low · scripts/checkDocSnippets.mjs:43** — checkDocSnippets: im Index geführte, aber
gelöschte Markdown-Dateien überspringen
Die Dateiliste kommt aus `git ls-files`, also aus dem Index. Eine getrackte .md-Datei, die im
Arbeitsbaum fehlt (gelöscht oder verschoben, aber noch nicht mit git rm/mv gestaged), lässt
`fs.readFileSync` mit ENOENT werfen; der catch-Block meldet das als Exit 2 mit der Meldung des
Systemfehlers, obwohl der Kommentar Exit 2 für »git oder tsconfig unlesbar« reserviert. Das
Typecheck-Gate wird mitten in einem Umbau rot, ohne dass ein Snippet kaputt ist.
Beleg: `execFileSync('git', ['ls-files', '-z', '--', '*.md'] …)` und danach
`fs.readFileSync(file, 'utf8')` ohne Existenzprüfung
Empfehlung: Fehlende Dateien mit `fs.existsSync` aus der Liste nehmen (oder
`git ls-files --cached --deduplicate` mit Filter) und die Exit-Code-Doku angleichen.

**BUILD-003 · info · .github/workflows/ci.yml:87** — CI-Audit bricht bei high/critical nicht ab
`pnpm audit --audit-level=high` läuft mit continue-on-error und meldet nur Warnung plus
Job-Summary. Die Begründung (veröffentlichtes Paket hat nur Peer-Dependencies, Dependabot
schlägt Updates vor) ist im Kommentar sauber festgehalten und trägt: Treffer liegen in Tooling.
Ein Treffer in der Toolchain, die den Publish-Job speist (npm/Nx im deploy.yml), würde dennoch
nicht blockieren.
Empfehlung: Beibehalten; optional den Audit-Schritt im Deploy-Build-Job als harte Bedingung nur
für die dort installierten Pakete.

**DOC-003 · info · package.json:34** — Pre-Commit-Gate nur per Konvention, kein Hook
`pnpm run ci` ist laut CLAUDE.md das Pre-Commit-Gate, im Repo gibt es aber keinen Git-Hook
(.husky/.githooks/lefthook nicht vorhanden). Das Gate dauert (clean, build, Coverage,
Allocations, Browser x4); ein Hook wäre unpraktisch, aber ein schneller `biome ci` +
`typecheck` Hook würde die häufigsten Rotläufe in CI verhindern. Der Alias `cbt`
(package.json:37) ist ohne Beschreibung kryptisch.
Empfehlung: Optional ein leichtes pre-commit (lint) einführen oder den Alias `cbt` in
AGENTS.md/README erklären.

**TEST-008 · info · packages/twopoint5d/src/stage/hot-path-allocations.director.spec.ts:21** —
Allocation-Specs messen mit festem 1-Byte-Limit; Aussagekraft hängt an Node-Version und
Mock-Pipeline
BYTES_PER_CALL_LIMIT = 1 über 1000 Aufrufe gegen die Heap-Stichprobe. Die CI führt das nur
unter Node 24 aus (ci.yml:59-62), der Nx-Hash kennt die Node-Version nicht (ci.yml:161).
RenderPipeline.render wird durch eine Leerfunktion ersetzt (:61), gemessen wird also nur der
Director, nicht der Pfad im Pipeline-Render. Das ist dokumentiert und vernünftig; als Hinweis,
dass ein grüner Lauf unter anderer V8-Version nicht dasselbe belegt.
Empfehlung: Keine Aktion nötig; beim Node-Upgrade der Allocation-Spezifikationen einen Lauf ohne
Nx-Cache machen.
