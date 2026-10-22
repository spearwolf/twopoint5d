# Paket 1 — CI-Workflow und Lookbook-Preview-Skripte absichern

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUILD-001 (low), SEC-001 (low), DEP-001 (info), BUILD-003 (info), RES-007 (low), BUG-032 (low), DX-003 (low), DX-004 (low)
- Ziel: CI läuft auch für Pull Requests, der Nx-Cache-Server begrenzt seine Eingaben, Toolchain-Konfiguration ist begründet und die Preview-Erzeugung meldet jeden Fehlstart, Hänger und Fehler laut.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `.github/workflows/ci.yml`
  - `.github/dependabot.yml`
  - `scripts/ci/nxCacheServer/createCacheServer.mjs`, `scripts/ci/nxCacheServer/createCacheServer.test.mjs`
  - `scripts/lookbook/previewServer.mjs`, `scripts/lookbook/previewServer.test.mjs`
  - `scripts/lookbook/demoPreviewConfig.mjs`, `scripts/lookbook/demoPreviewConfig.test.mjs`
  - `scripts/lookbook/generateDemoPreviews.mjs`
  - `scripts/lookbook/lookbookDemos.mjs`
  - `tsconfig.json`
  - `package.json`, `pnpm-lock.yaml`
  - `docs/architecture.md` (§3 »In CI«, §5)
  - `apps/lookbook/README.md` (Abschnitt »Preview images«)
- Kein CHANGELOG-Eintrag: nichts davon erreicht die veröffentlichte Bibliothek, `packages/twopoint5d/CHANGELOG.md` bleibt unberührt.

## Vorgehen

Reihenfolge der Schritte ist frei, die Regressionstests kommen je Finding vor dem
Fix und müssen einmal rot gelaufen sein (Kommando und rote Ausgabe in den Report).
Schnelle Schleife während der Arbeit: `pnpm test:scripts`; Formatierung der
angefassten Dateien mit `pnpm exec biome check --write <dateien>`.

### 1. CI läuft für Pull Requests (BUILD-001) — `.github/workflows/ci.yml`

Die Entscheidung im Plan steht: `pull_request` kommt dazu, `permissions:
contents: read` bleibt.

1. Zeilen 3–5 ersetzen durch:
   ```yaml
   # every push, Markdown included: a Markdown file is an input of the type check of the
   # docs' marked code blocks. A pull request runs the gate as well; one from a branch of
   # this repository skips it there, the push of that branch has run it already
   on:
     push:
     pull_request:
   ```
2. Im Job `gate` vor `name: ${{ matrix.name }}` einfügen:
   ```yaml
       # a pull request from a fork has no push run in this repository; one from a branch
       # here has, and a second run of the same commit would only double the minutes
       if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name != github.repository
   ```
3. Die Bedingungen der Steps `Drop the Nx cache entries this run did not use` und
   `Save the Nx cache` werden zu
   `success() && steps.nx-cache.outputs.cache-hit != 'true' && github.event_name == 'push'`.
   Kommentar am Save-Step ergänzen, sinngemäß: »only a push to this repository writes
   the cache; a pull request restores it and saves nothing«.
4. `permissions`, `concurrency` und alles andere bleiben. Die Concurrency-Gruppe
   funktioniert für Pull Requests unverändert: `github.ref` ist dort
   `refs/pull/<n>/merge`, ein neuer Push auf den PR löst den älteren Lauf ab.
5. `docs/architecture.md` §3, Unterabschnitt »In CI«:
   - Satz ab Zeile 171 »`.github/workflows/ci.yml` runs the gate on every push, in four
     jobs side by side« wird zu »… runs the gate on every push and on every pull request
     from a fork, in four jobs side by side …«; direkt danach oder am Ende des Absatzes
     ein Satz: ein Pull Request aus einem Branch dieses Repos überspringt seinen
     `pull_request`-Lauf, weil der Push des Branches denselben Commit schon durch das
     Gate geschickt hat.
   - Satz zur Concurrency-Gruppe (Zeile 184 ff.): »The concurrency group of the workflow
     is the branch« ergänzen um »— for a pull request its merge ref —«.
   - Absatz zur Vertrauenswürdigkeit des Caches (Zeile 254–256, »its entries come solely
     from CI runs on pushes to this repository«) bleibt wahr; einen Satz anhängen: ein
     Pull-Request-Lauf stellt den Cache wieder her und speichert nichts.
   - Der Absatz zu `deploy.yml` (Zeile 312 ff.) bleibt: Deploy filtert schon auf
     `workflow_run.event == 'push'` und die Herkunft aus diesem Repo.

### 2. Nx-Cache-Server begrenzt Hash und Eintragsgröße (SEC-001) — `scripts/ci/nxCacheServer/createCacheServer.mjs`

1. Neue exportierte Konstante oberhalb von `createCacheServer`:
   ```js
   // an entry is the tarball of one task's outputs, the largest (the lookbook's dist) some
   // 20 MiB; the bound keeps a runaway Content-Length from filling the runner's disk
   export const MAX_ENTRY_BYTES = 512 * 1024 * 1024;
   ```
2. Signatur `createCacheServer({dir, token, maxEntryBytes = MAX_ENTRY_BYTES})`, der
   JSDoc-Block nennt den neuen Parameter (eine Spec setzt ihn klein).
3. Zeile 37–38: Regex auf `/^[A-Za-z0-9]{1,128}$/`, Kommentar sinngemäß: »Nx hashes are
   digit strings of some twenty digits; anything else could name a path outside dir, and
   a name past 128 characters — the partial file adds some thirty — runs into the 255
   bytes a file name may have«. Antwort bleibt 400.
4. In `store()` nach dem 411-Check und **vor** dem 409-Check:
   ```js
   const expectedLength = Number(req.headers['content-length']);
   if (expectedLength > maxEntryBytes) return reply(req, res, 413);
   ```
   und die spätere Zeile `const expectedLength = …` (Zeile 68) entfällt. Reihenfolge
   in `store()` damit: 411 → 413 → 409. `reply()` liest den abgelehnten Body weg und
   verwirft ihn — er berührt die Platte nicht, und der Client kann nach seinem Upload
   den Status lesen. Kein `Connection: close`.
5. Kein `requestTimeout`/`headersTimeout`-Override: die Node-Defaults (300 s / 60 s)
   begrenzen eine hängende Verbindung schon, und jeder Step hat `timeout-minutes`.
6. Regressionstests in `createCacheServer.test.mjs`, zuerst rot:
   - `test('a hash longer than 128 characters answers 400 on GET and PUT, one of 128 is stored', …)`:
     `'1'.repeat(129)` → GET 400, PUT 400, `fs.readdirSync(dir)` leer;
     `'1'.repeat(128)` → PUT 200, danach GET 200. (Heute: GET 500 über
     `ENAMETOOLONG` aus `stat`, PUT endet mit abgerissener Verbindung.)
   - `test('a PUT above the entry limit answers 413 and stores nothing', …)`: eigener
     Server im Test mit `createCacheServer({dir, token: TOKEN, maxEntryBytes: 16})` auf
     Port 0, nach dem Test schließen; PUT mit 17 Byte → 413, PUT mit 16 Byte auf einen
     anderen Hash → 200, im Verzeichnis liegt nur dieser eine Eintrag.
   - `test('the default limit is MAX_ENTRY_BYTES, refused before any body arrives', …)`:
     gegen den Server aus `beforeEach`, roher `http.request` mit
     `'Content-Length': String(MAX_ENTRY_BYTES + 1)` und `auth()`, ohne einen Body zu
     schreiben (`req.flushHeaders()`); Status 413 abwarten, dann `req.destroy()`;
     `fs.readdirSync(dir)` leer.
7. `docs/architecture.md` §3, Absatz zum Cache-Server (Zeile 239 ff.): ein Satz, dass
   der Server einen Hash über 128 Zeichen mit 400 und einen Eintrag über 512 MiB mit
   413 ablehnt.

### 3. `@types/node` an Node 24 binden (DEP-001)

Gewählt: Typen auf die 24er-Linie, nicht CI zusätzlich auf Node 26. Grund: `engines`
erlaubt `^24.16.0 || >=26.3.0`, CI und die lokale Maschine laufen auf 24
(`node --version` → v24.21.0); die Typen der unteren Grenze verbieten genau die
APIs, die auf 24 fehlen, und eine Node-26-Matrix verdoppelte die vier CI-Jobs.

1. Root-`package.json` Zeile 45: `"@types/node": "^24.19.2"` (neueste 24.x laut
   `pnpm view @types/node@24 version` am 2026-10-21). Dann `pnpm install` (ohne
   `--frozen-lockfile`), damit `pnpm-lock.yaml` nachzieht. Danach darf
   `grep -c '@types/node@26' pnpm-lock.yaml` nur `0` liefern.
2. `.github/dependabot.yml`, unter dem bestehenden `ignore:` (nach dem
   `typescript`-Eintrag) einfügen:
   ```yaml
         # @types/node follows the lowest Node line engines allows, the one the workflows
         # run: the types of a later line would let a script call an API Node 24 lacks.
         # Its major moves together with the node-version of the workflows
         - dependency-name: '@types/node'
           update-types: ['version-update:semver-major']
   ```
3. `docs/architecture.md` §5, am Ende des Absatzes über Node- und pnpm-Versionen
   (endet mit »… cut the repo off from later 24.x releases.«): `@types/node` bleibt auf
   der 24er-Linie, der untersten, die `engines` erlaubt, und der, auf der die Workflows
   laufen — die Typen einer späteren Linie ließen ein Skript oder eine Spec eine API
   aufrufen, die Node 24 fehlt, und erst ein Lauf auf 24 bemerkte es;
   `.github/dependabot.yml` ignoriert deshalb seine Major-Updates, sie wandern mit der
   `node-version` der Workflows.
4. Scheitert `pnpm typecheck` danach an einer Node-API: das ist ein Aufruf, den es erst
   ab Node 26 gibt. Durch das Node-24-Äquivalent ersetzen (CI läuft auf 24) und im
   Report unter »Abweichungen« mit Datei und Zeile nennen.

### 4. `noFallthroughCasesInSwitch` einschalten (BUILD-003) — `tsconfig.json`

1. Zeile 29: `"noFallthroughCasesInSwitch": true,` — ohne Kommentar, wie die übrigen
   eingeschalteten Prüfungen.
2. Zug 0 hat das gegen den Code geprüft: `pnpm exec tsc -p <config> --noEmit
   --noFallthroughCasesInSwitch` für `packages/twopoint5d/tsconfig.typecheck.json`,
   `scripts/tsconfig.json`, `apps/lookbook/assets-src/tsconfig.json`,
   `packages/twopoint5d-testing/tsconfig.json` und `apps/lookbook/tsconfig.json` —
   kein TS7029, Exit 0; die Gegenprobe mit einem echten Fall-through meldet TS7029.
   Gestapelte leere `case`-Labels (wie sie Biomes `noUselessSwitchCase: off` in
   `biome.jsonc` erlaubt) zählen für tsc nicht als Fall-through. Meldet
   `pnpm typecheck` (auch `astro check`) dennoch eine Stelle: dort ein `break` bzw.
   `return` setzen, wenn der Fall-through ungewollt ist, sonst den Fall umschreiben,
   und im Report nennen.

### 5. Preview-Server: Fehlstart, Signal-Ende, hängende Probe (RES-007) — `scripts/lookbook/previewServer.mjs`

1. Neue Konstante neben `STARTUP_TIMEOUT_MS`:
   ```js
   // one probe of the server may take this long; a connection that hangs is given up and retried
   const PROBE_TIMEOUT_MS = 2_000;
   ```
2. Parameter `startupTimeoutMs = STARTUP_TIMEOUT_MS` im Options-Objekt von
   `startPreviewServer({command, args, startupTimeoutMs})`, JSDoc-`@param` ergänzen
   (»a spec shortens it«). `deadline` rechnet damit, die Timeout-Meldung nennt diesen
   Wert.
3. Direkt nach `spawn()`:
   ```js
   /** @type {Error | undefined} */
   let spawnError;
   // spawn() reports a command it cannot start (ENOENT, EACCES) as an 'error' event, and an
   // 'error' event without a listener ends the process with a raw stack trace
   child.on('error', (error) => {
     spawnError ??= error;
   });
   ```
   `on`, nicht `once`: ein späteres `'error'` (etwa ein fehlgeschlagenes `kill`) darf
   den Generator ebenso wenig abschießen.
4. Die Warteschleife prüft in dieser Reihenfolge — **`spawnError` zuerst**, weil Node
   nach `ENOENT` auch `exitCode` auf `-2` setzt (in Zug 0 mit Node 24.21 beobachtet)
   und sonst die schwächere Meldung »exited with code -2« gewänne:
   ```js
   if (spawnError) {
     stop();
     throw new Error(`could not start ${command}: ${spawnError.message}`);
   }
   if (child.exitCode !== null || child.signalCode !== null) {
     stop();
     const how = child.exitCode !== null ? `with code ${child.exitCode}` : `on signal ${child.signalCode}`;
     throw new Error(`astro preview exited ${how}:\n${output}`);
   }
   ```
   `stop()` vor jedem Throw: es meldet den `'exit'`-Hook wieder ab, den heute nur der
   Timeout-Pfad abräumt (Nebenbefund gleicher Ursache, gehört hierher).
5. Die Probe bekommt ein eigenes Timeout, das die Deadline nicht überzieht:
   ```js
   const response = await fetch(`${baseUrl}/`, {
     signal: AbortSignal.timeout(Math.max(1, Math.min(PROBE_TIMEOUT_MS, deadline - Date.now()))),
   });
   ```
   Der `catch` bleibt, Kommentar sinngemäß: »not listening yet, or the probe ran out«.
6. Regressionstests in `previewServer.test.mjs`, jeder mit `{timeout: 10_000}`, zuerst rot:
   - `it('rejects with the command it cannot start instead of an unhandled error event', …)`:
     `startPreviewServer({command: path.join(dir, 'no-such-command'), args: () => []})`
     → `assert.rejects(…, /could not start .*no-such-command: .*ENOENT/)`.
   - `it('rejects as soon as the server dies on a signal', …)`: Stand-in
     `['-e', "process.kill(process.pid, 'SIGKILL')"]` mit `command: process.execPath`;
     rejects mit `/exited on signal SIGKILL/`, gemessen unter 5000 ms. (Heute: volle
     30 s → Test-Timeout.)
   - `it('gives up on a server that accepts the connection and never answers, within the startup timeout', …)`:
     Stand-in schreibt seine PID in eine eigene Datei unter `dir` und lauscht auf dem
     übergebenen Port, ohne je zu antworten —
     `args: (port) => ['-e', "require('node:fs').writeFileSync(process.argv[1], String(process.pid)); require('node:net').createServer(() => {}).listen(Number(process.argv[2]), '127.0.0.1');", pidFile2, String(port)]`;
     `startupTimeoutMs: 1500`; rejects mit `/did not answer/` unter 5000 ms, danach
     `waitFor(() => !isAlive(pid))` — `stop()` hat die Gruppe beendet. (Heute: `fetch`
     hängt bis zum `headersTimeout` von undici, 300 s.)
   Jeder neue Stand-in, der eine PID schreibt, wird im `after()` mit aufgeräumt.

### 6. Preview-Event ohne `detail` (BUG-032) — `demoPreviewConfig.mjs`, `generateDemoPreviews.mjs`

1. Das Init-Script wandert als exportierte Funktion nach `demoPreviewConfig.mjs`,
   damit eine Spec es ohne Browser prüfen kann. Erst mit dem **alten** Körper
   (`w.__lookbookPreview ??= event.detail`) herausziehen, den Test schreiben, rot
   sehen, dann fixen:
   ```js
   /**
    * Installed with page.addInitScript() before any script of the page runs: records the first
    * EVENT_GENERATE_PREVIEW as window.__lookbookPreview. Playwright sends the function as its
    * source, so it uses nothing but its argument and the globals of the page.
    * @param {string} eventName
    */
   export function recordPreviewEvent(eventName) {
     document.addEventListener(eventName, (event) => {
       const w = /** @type {any} */ (window);
       // wrapped: the generator waits for a truthy value, and an event may come without a detail
       w.__lookbookPreview ??= {detail: /** @type {CustomEvent} */ (event).detail ?? null};
     });
   }
   ```
   Playwright serialisiert die Funktion per `fun.toString()` zu
   `(function recordPreviewEvent(eventName) {…})("lookbook.generatePreview")`
   (`evaluationScript` in playwright-core 1.63) — eine Funktionsdeklaration ohne
   Bezug auf Modul-Scope trägt das.
2. Kopfkommentar von `demoPreviewConfig.mjs` (Zeile 1–2) anpassen: »The constants, the
   flags and the helpers of `pnpm lookbook:generate-previews` that need no browser,
   apart from the run itself so a spec can import them.«
3. In `generateDemoPreviews.mjs`: `await page.addInitScript(recordPreviewEvent, EVENT_GENERATE_PREVIEW);`
   und
   ```js
   const {detail} = await (
     await page.waitForFunction(() => /** @type {any} */ (window).__lookbookPreview, null, {timeout: timeoutMs})
   ).jsonValue();
   ```
   `trigger: detail?.trigger` bleibt.
4. Regressionstest in `demoPreviewConfig.test.mjs`, `describe('recordPreviewEvent()')`:
   `globalThis.document` auf ein `new EventTarget()` und `globalThis.window` auf `{}`
   setzen (über `/** @type {any} */ (globalThis)`, sonst lehnt `checkJs` die Zuweisung
   ab) und nach dem Test wieder löschen (`try/finally` oder `t.after`).
   - `it('records an event without a detail as a truthy value', …)`:
     `document.dispatchEvent(new CustomEvent('test.preview'))` →
     `assert.deepEqual(window.__lookbookPreview, {detail: null})` (ein `CustomEvent`
     ohne `detail` trägt `null`).
   - `it('keeps the detail of the first event and ignores later ones', …)`: erst
     `{detail: {demoId: 'a', trigger: 'ready'}}`, dann ein zweites Event mit anderem
     Detail → bleibt `{detail: {demoId: 'a', trigger: 'ready'}}`.

### 7. Seitenfehler lassen eine Demo scheitern (DX-003)

Gewählt: ein `pageerror` (unbehandelte Exception der Seite) macht die Demo
standardmäßig zum Fehlschlag, das alte Bild bleibt, Exit 1. `console.error` bleibt
im Standard ein Problem, das gemeldet und in der Schlusszeile gezählt wird, und
scheitert erst mit `--strict`. Grund: Demos loggen erwartbare Fehler selbst per
`console.error` (`apps/lookbook/src/pages/demos/animated-sprites.astro:67`,
`sprite-reflection.astro:74`), dazu meldet Chromium jedes fehlgeschlagene Laden als
Konsolenfehler — ob ein Lauf heute ohne solche durchkommt, lässt sich ohne GPU-Lauf
nicht prüfen, und ein standardmäßig strenger Lauf könnte jedes Bild verweigern.

1. `demoPreviewConfig.mjs`:
   - Der Typedef `DemoResult` zieht aus `generateDemoPreviews.mjs` hierher (gleicher
     Inhalt); der Generator holt ihn mit
     `/** @typedef {import('./demoPreviewConfig.mjs').DemoResult} DemoResult */`.
   - `parsePreviewArgs()`: Option `strict: {type: 'boolean', default: false}`,
     Rückgabe um `strict: values.strict ?? false` ergänzt, JSDoc-Rückgabetyp mit
     `strict: boolean`.
   - Neu:
     ```js
     /**
      * Why the screenshot of a demo is not written, or undefined when it is.
      * @param {{pageErrors: number, consoleErrors: number}} counts what the page reported up to the screenshot
      * @param {boolean} strict `--strict`: a console error fails the demo as well
      * @returns {string | undefined}
      */
     export function refuseScreenshot({pageErrors, consoleErrors}, strict) {
       if (pageErrors > 0) return `the page threw ${pageErrors} error(s), the old image stays`;
       if (strict && consoleErrors > 0) {
         return `the page logged ${consoleErrors} console error(s) under --strict, the old image stays`;
       }
       return undefined;
     }

     /**
      * The closing lines of a run and its exit code: 1 when a demo failed.
      * @param {DemoResult[]} results
      * @returns {{summary: string, exitCode: 0 | 1}}
      */
     export function summarizeRun(results) {
       const failed = results.filter(({ok}) => !ok).map(({id}) => id);
       // without --strict, the problems of a demo that passed are its console errors
       const noisy = results.filter(({ok, problems}) => ok && problems.length > 0).map(({id}) => id);
       const lines = [
         failed.length === 0
           ? `${results.length} preview(s) written`
           : `${failed.length} of ${results.length} failed, their old images stay: ${failed.join(', ')}`,
       ];
       if (noisy.length > 0) lines.push(`${noisy.length} written with console errors, --strict fails them: ${noisy.join(', ')}`);
       return {summary: lines.join('\n'), exitCode: failed.length === 0 ? 0 : 1};
     }
     ```
2. `generateDemoPreviews.mjs`:
   - `captureDemo(context, baseUrl, id, timeoutMs, strict)`; zwei Zähler
     `pageErrors`/`consoleErrors` neben `problems`, in den beiden bestehenden
     Listenern hochgezählt.
   - Nach der Größenprüfung des Screenshots und **vor** `fs.writeFileSync(temporary, …)`:
     `const refusal = refuseScreenshot({pageErrors, consoleErrors}, strict); if (refusal) throw new Error(refusal);`
     — der bestehende `catch` macht daraus `ok: false` mit allen Problemen und der
     Meldung als letzter Zeile.
   - `main()`: `captureDemo(…, options.timeoutMs, options.strict)`; die Schlusszeile
     kommt aus `summarizeRun(results)`: `console.log(`\n${summary}`); return exitCode;`
     ersetzt Zeile 155–161.
3. Tests in `demoPreviewConfig.test.mjs`:
   - Bestehende `parsePreviewArgs()`-Tests mitziehen: Defaults mit `strict: false`;
     der Flag-Test nimmt `--strict` auf und erwartet `strict: true`.
   - `describe('refuseScreenshot()')`: Seitenfehler → Meldung passt auf
     `/threw 1 error/`; nur Konsolenfehler ohne `strict` → `undefined`; mit `strict` →
     `/--strict/`; beides 0 → `undefined`.
   - `describe('summarizeRun()')`: zwei ok ohne Probleme →
     `{summary: '2 preview(s) written', exitCode: 0}`; ein Fehlschlag → `exitCode: 1`,
     Summary nennt `1 of 2 failed` und die ID; ein ok mit Problemen → zweite Zeile
     nennt `1 written with console errors` und die ID, `exitCode: 0`.
4. `apps/lookbook/README.md`, »Preview images«:
   - Flag-Tabelle: Zeile `| `--strict` | a demo that logs a console error fails as well |`.
   - Der Satz »A failed demo keeps its old image, and the run exits with 1.« wird zu:
     eine Demo scheitert, wenn sie nicht rechtzeitig signalisiert, wenn die Seite eine
     unbehandelte Exception wirft oder wenn der Screenshot eine andere Größe hat; eine
     gescheiterte Demo behält ihr altes Bild, und der Lauf endet mit 1.
     Konsolenfehler stehen unter der Demo und in der Schlusszeile, das Bild wird
     trotzdem geschrieben; `--strict` lässt eine solche Demo ebenfalls scheitern.
   - Beim Absatz zu `lookbook.generatePreview`: ein Halbsatz, dass das Event kein
     `detail` braucht; hat es eins, druckt der Generator dessen `trigger`.

### 8. Kaputte Demo-Metadatei beim Namen nennen (DX-004) — `scripts/lookbook/lookbookDemos.mjs`

1. `export function listLookbookDemos(dir = demosDir)`, JSDoc
   `@param {string} [dir] the directory of the demo pages; a spec hands in one of its own`.
   `readdirSync` und `readFileSync` lesen aus `dir`.
2. Das Parsen in eigenem `try/catch`:
   ```js
   const full = path.join(dir, file);
   let json;
   try {
     json = JSON.parse(fs.readFileSync(full, 'utf8'));
   } catch (error) {
     throw new Error(`${full}: ${error instanceof Error ? error.message : String(error)}`, {cause: error});
   }
   ```
   Absoluter Pfad statt bloßem Dateinamen: im Terminal anklickbar, und
   `generateDemoPreviews: …` setzt ihn unverändert vor die Meldung.
3. Regressionstest in `demoPreviewConfig.test.mjs`, im bestehenden
   `describe('listLookbookDemos()')`: `it('names the metadata file it cannot parse', …)`
   — Temp-Verzeichnis (`fs.mkdtempSync(path.join(os.tmpdir(), 'lookbook-demos-'))`) mit
   `_broken.json` = `{"url": }`; `assert.throws(() => listLookbookDemos(tmp), (error) =>
   error instanceof Error && error.message.startsWith(`${path.join(tmp, '_broken.json')}: `))`;
   Verzeichnis im `finally` löschen. (Heute: Meldung ohne Dateinamen → rot.)

## Verify

```bash
pnpm install --frozen-lockfile \
  && node -e "const y=require('yaml'),fs=require('fs');for(const f of ['.github/workflows/ci.yml','.github/dependabot.yml'])y.parse(fs.readFileSync(f,'utf8'))" \
  && test "$(grep -c '@types/node@26' pnpm-lock.yaml)" = 0 \
  && pnpm run ci
```

`pnpm run ci` ist das volle Gate; `test:scripts` darin trägt die neuen Specs,
`typecheck` die neuen Node-24-Typen und `noFallthroughCasesInSwitch`. Der Workflow
selbst läuft erst auf GitHub; lokal prüft das Kommando nur, dass beide YAML-Dateien
parsen.

## Commit

`fix(ci): run the gate for pull requests from forks, bound the hashes and entries of the Nx cache server, type the scripts against Node 24, refuse fall-through switch cases, and have the lookbook preview generator report every failed start, hang and page error`

## Für Zug 5: Schnittstellen

Die Oberfläche bewegt sich; diese Zeile gehört nach dem Commit unter das Paket in
den Plan:

- `tsconfig.json`: `noFallthroughCasesInSwitch: true` — ein nicht leerer `case`, der
  durchfällt, compiliert in keinem Projekt mehr.
- `@types/node` `^24.19.2` — Skripte und Specs sind gegen Node 24 typisiert;
  Dependabot ignoriert dessen Major-Updates.
- `createCacheServer({dir, token, maxEntryBytes})`, neuer Export `MAX_ENTRY_BYTES`;
  Hash höchstens 128 Zeichen (400), Eintrag höchstens 512 MiB (413).
- `startPreviewServer({command, args, startupTimeoutMs})`.
- `listLookbookDemos(dir = demosDir)`.
- `demoPreviewConfig.mjs`: `parsePreviewArgs()` liefert `strict`; neue Exporte
  `recordPreviewEvent`, `refuseScreenshot`, `summarizeRun`, Typedef `DemoResult`.
- `pnpm lookbook:generate-previews --strict`; ein `pageerror` lässt eine Demo
  standardmäßig scheitern.

## Abgleich (Zug 0, 2026-10-21, gegen `6500527f`)

Alle acht Findings stehen unverändert an ihren Fundstellen:

- BUILD-001 — `.github/workflows/ci.yml:5` `on: push`, unverändert. Die offene Frage
  des Audits (»Bekommen Pull Requests aus Forks bewusst keinen CI-Lauf?«) ist durch
  die Entscheidung vom 2026-10-21 im Plan beantwortet.
- SEC-001 — `scripts/ci/nxCacheServer/createCacheServer.mjs:38`
  `/^[A-Za-z0-9]+$/` ohne Längenlimit; `:68` `Number(req.headers['content-length'])`
  ohne Maximum, unverändert. Der Name der Partial-Datei (`:69`) enthält den Hash: ein
  Hash über ~220 Zeichen lässt schon `createWriteStream` an `ENAMETOOLONG` scheitern,
  `pipeline` wirft, der `catch` (`:73`) hält das für einen abgebrochenen Client und
  reißt die Verbindung ab statt mit einem Status zu antworten — dieselbe Ursache, die
  Längengrenze aus Schritt 2 behebt beides.
- DEP-001 — `package.json:45` `"@types/node": "^26.6.4"`, `engines` `:9`
  unverändert, `ci.yml:62` `node-version: 24`. Einzige Nennung von `@types/node` im
  Repo; `types: ["node"]` in `packages/twopoint5d/tsconfig.json`,
  `scripts/tsconfig.json`, `apps/lookbook/assets-src/tsconfig.json`.
- BUILD-003 — `tsconfig.json:29` `"noFallthroughCasesInSwitch": false` ohne
  Kommentar, unverändert. Probelauf mit der Option: kein Treffer (siehe Schritt 4).
- RES-007 — `scripts/lookbook/previewServer.mjs:41` `spawn()` ohne `'error'`-Listener,
  `:70` nur `child.exitCode`, `:74` `fetch` ohne Signal — unverändert (Zeilen exakt
  wie im Audit).
- BUG-032 — `scripts/lookbook/generateDemoPreviews.mjs:68`
  `w.__lookbookPreview ??= … event.detail`, `:74` `waitForFunction` auf den
  truthy Wert, `:88` `detail?.trigger` — unverändert. Der Lookbook selbst
  (`apps/lookbook/src/demos/utils/demoPreview.ts:36`) sendet immer ein `detail`; der
  Fehler trifft eine Demo, die das Event selbst ohne `detail` feuert.
- DX-003 — `generateDemoPreviews.mjs:58–61` sammelt `pageerror`/`console.error` in
  `problems`, `:88` `ok: true`, `:155–161` zählt nur `ok` — unverändert.
- DX-004 — `scripts/lookbook/lookbookDemos.mjs:20` `JSON.parse(…)` ohne Kontext,
  unverändert. Aufrufer: `generateDemoPreviews.mjs:115`, `demoPreviews.test.mjs:12`,
  `demoMetadata.test.mjs:42`, `demoPreviewConfig.test.mjs:77` — alle ohne Argument,
  der Default-Parameter lässt sie unberührt.

## Triage (Zug 0)

- Folgen: keine — Paket 1 ist das erste, kein erledigtes Paket hat `Folgen:`.
- »Offene Befunde«: leer.
- Nebenbefunde gleicher Ursache, ins Paket genommen: `stop()` fehlt auf den
  Fehlerpfaden vor dem Timeout in `previewServer.mjs` (Schritt 5.4); die abgerissene
  Verbindung bei einem PUT mit überlangem Hash (Schritt 2, siehe Abgleich SEC-001).

## Entscheidungen in Zug 0 (mit Grund)

- BUILD-001: Pull Requests aus einem Branch dieses Repos überspringen ihren
  `pull_request`-Lauf. Der Push des Branches hat denselben Code schon durch das Gate
  geschickt; beide Läufe lägen in verschiedenen Concurrency-Gruppen
  (`refs/heads/<branch>` gegen `refs/pull/<n>/merge`), keiner löste den anderen ab, und
  jeder PR-Push kostete die vier Jobs doppelt. Die Entscheidung im Plan (»läuft auch
  auf `pull_request`«) bleibt gewahrt: für die Beiträge, die der Push-Trigger nicht
  erreicht — Forks —, läuft er.
- BUILD-001: Ein `pull_request`-Lauf speichert den Nx-Cache nicht. GitHub hält einen
  PR-Cache zwar im Scope von `refs/pull/<n>/merge`, aber jeder Eintrag zählt gegen das
  Cache-Kontingent des Repos und kann die Einträge von `main` verdrängen; und
  `docs/architecture.md` §3 verspricht, dass Einträge nur aus Pushes in dieses Repo
  stammen.
- SEC-001: 128 Zeichen und 512 MiB wie empfohlen. Größter Eintrag heute ~21 MiB
  (`apps/lookbook/dist`), Nx-Hashes ~20 Ziffern. Keine Gesamtgrenze über alle
  Einträge: ein Prozess auf dem Runner, der das Token hat, kann die Platte auch direkt
  beschreiben; die Grenze schützt vor einem entgleisten Client, nicht vor einem
  Angreifer auf dem Runner. Abgelehnter Body wird weggelesen statt die Verbindung zu
  schließen — er erreicht die Platte nicht, und Nx kann den Status lesen.
- DEP-001: Typen auf Node 24 statt Node-26-Matrix (Grund in Schritt 3), dazu die
  Dependabot-Sperre, sonst schlägt Dependabot 26 erneut vor.
- BUILD-003: einschalten statt begründen — es gibt keine einzige Fall-through-Stelle,
  die Option kostet nichts und fängt künftige.
- DX-003: `pageerror` scheitert im Standard, `console.error` nur mit `--strict` (Grund
  in Schritt 7).
- RES-007: `startupTimeoutMs` als Option, damit der Hänger-Test in Sekunden statt in
  30 s läuft; `spawnError` vor `exitCode` geprüft (Grund in Schritt 5.4).
- BUG-032: das Init-Script als exportierte Funktion, damit der Regressionstest ohne
  Browser läuft — `test:scripts` läuft in CI im Job `checks`, der keinen Browser
  installiert.

## Restplan (Zug 0)

Unverändert. Paket 1 berührt keine Datei der Pakete 2–13. Zwei Änderungen wirken in
spätere Pakete hinein, ohne Reihenfolge oder Schnitt zu ändern, und stehen nach dem
Commit unter `Schnittstellen:`: `noFallthroughCasesInSwitch: true` gilt für jeden
`switch`, den ein späteres Paket schreibt, und Paket 2 (`scripts/`) compiliert gegen
die Node-24-Typen.

## Verlauf

- 2026-10-21 Zug 0: Detailplan steht · BUILD-001, SEC-001, DEP-001, BUILD-003,
  RES-007, BUG-032, DX-003, DX-004 unverändert an ihren Fundstellen · keine Folgen,
  »Offene Befunde« leer · zwei Nebenbefunde gleicher Ursache ins Paket
  (`previewServer.mjs` `stop()` auf Fehlerpfaden, PUT mit überlangem Hash) ·
  Restplan unverändert
- 2026-10-21 Zug 1: Implementierer beauftragt (Sonnet, mittlere Stufe, Effort medium), Report nach `paket-1.impl-0.json`
- 2026-10-21 Zug 2: Report FERTIG_MIT_VORBEHALT (session d0c6e176) · 16 Dateien geändert, zusätzlich `apps/lookbook/package.json` (`@types/node` ^24.19.2 als devDependency, sonst blieben 18 Lock-Treffer auf 26.6.4) · rote Läufe für Cache-Server, Preview-Server, recordPreviewEvent, listLookbookDemos belegt · Arbeitsbaum schmutzig
- 2026-10-21 Zug 2: Verify selbst gelaufen, exit=0 (`paket-1.verify.log`)
- 2026-10-21 Zug 3: Reviewer (Opus, medium, session 3b80bb9f) · alle acht Findings behoben · 1 wichtig (Doku/Dependabot nennen nur ein `@types/node`-Manifest, Lookbook-Manifest fehlt), 5 klein · Diff `paket-1.diff`
- 2026-10-21 Zug 4 Runde 1: wichtig + 3 kleine Doku-/Kommentarpunkte + NaN-`Content-Length`-Nebenbefund an denselben Implementierer (Resume d0c6e176, gleiche Flags)
- 2026-10-21 Zug 4 Runde 1: Report FERTIG · `docs/architecture.md`, `ci.yml`, `dependabot.yml` angepasst · NaN-`Content-Length` erreicht den Handler nie (Node 24.21: `HPE_INVALID_CONTENT_LENGTH` → 400), kein Code geändert · Verify selbst exit=0 (`paket-1.verify-1.log`) · Re-Review (Sonnet, medium, session 252753e1, Diff `paket-1.r1.diff`): alle vier Befunde erledigt, nichts Neues außer 1 klein
- 2026-10-21 Zug 5: Commit b998e803 (16 Dateien), Verify-Log `paket-1.verify-1.log` exit=0

## Reviewer-Urteil (Zug 3 und Re-Review, Stand b998e803)

- BUILD-001 behoben — `.github/workflows/ci.yml:6-8` (`push` + `pull_request`), `:33` Job-`if` lässt PRs aus Branches dieses Repos aus, Cache-Löschen/-Speichern nur bei `push`; `permissions: contents: read` bleibt; Doku `docs/architecture.md` §3 »In CI«
- SEC-001 behoben — `scripts/ci/nxCacheServer/createCacheServer.mjs:9` `MAX_ENTRY_BYTES`, `:22` `maxEntryBytes`, `:47` Regex `{1,128}` → 400, `:75-77` 411 → 413 → 409; Tests `createCacheServer.test.mjs:107-155`
- DEP-001 behoben — `package.json:45` und `apps/lookbook/package.json:32` `^24.19.2`, `.github/dependabot.yml:26-31` Ignore-Regel, Begründung `docs/architecture.md:402-408`; Lockfile ohne `@types/node@26`
- BUILD-003 behoben — `tsconfig.json:29` `true`, Typecheck grün ohne Treffer
- RES-007 behoben — `scripts/lookbook/previewServer.mjs:50-56` `'error'`-Listener, `:81-89` `spawnError` vor `exitCode`/`signalCode` jeweils mit `stop()`, `:91-93` Probe-Timeout; Tests `previewServer.test.mjs:80-117`
- BUG-032 behoben — `scripts/lookbook/demoPreviewConfig.mjs:117-124` `recordPreviewEvent`, `generateDemoPreviews.mjs:91,95`; Tests `demoPreviewConfig.test.mjs:122-150`
- DX-003 behoben — `demoPreviewConfig.mjs:79-110` `refuseScreenshot`/`summarizeRun`, `--strict` `:40`; `generateDemoPreviews.mjs:66-75, 92-93, 159-166`; README »Preview images«
- DX-004 behoben — `scripts/lookbook/lookbookDemos.mjs:15-30`; Test `demoPreviewConfig.test.mjs:107-118`

Kleine Befunde (ohne Runde, offen gelassen):
- Commit-Message ist eine einzige Betreffzeile von ~270 Zeichen, Scope `ci` umfasst auch Lookbook-Generator und tsconfig — belassen, weil die Projekt-Historie durchgehend lange Einzeilen-Betreffs nutzt.
- `generateDemoPreviews.mjs:92-93` mit `demoPreviewConfig.mjs:84-89, :105`: bei einer verweigerten Demo steht »the old image stays« zweimal in der Ausgabe (Problemzeile und Schlusszeile).
- `docs/architecture.md:365-372` (Dependabot-Absatz) sagt pauschal, jedes Major-Update komme als eigener PR; Ausnahmen für `typescript` (:389) und `@types/node` (:402) stehen an ihrer Stelle.

## Findings im Volltext

**BUILD-001 · low · .github/workflows/ci.yml:5** — CI auch für Pull Requests auslösen
Der Workflow läuft nur `on: push`. Ein Pull Request aus einem Fork löst keinen Lauf
aus, der Gate-Check ist also für Beiträge von außen nicht erreichbar; für Branches im
eigenen Repo reicht der Push-Trigger. Der Deploy-Workflow filtert korrekt auf
workflow_run.event == 'push' und Fork-Herkunft, ein pull_request-Trigger im CI würde
ihn nicht berühren.
Beleg: `on: push`
Empfehlung: `on: {push: {}, pull_request: {}}` (mit contents: read bleibt das
ungefährlich) oder bewusst im Kommentar festhalten, dass Fork-PRs nicht unterstützt
sind.

**SEC-001 · low · scripts/ci/nxCacheServer/createCacheServer.mjs:38** (auch :70, :41) — Hash-Länge und Body-Größe im Nx-Cache-Server begrenzen
Der Server lauscht nur auf 127.0.0.1 und prüft das Token zeitkonstant, der
Pfad-Traversal-Schutz (`^[A-Za-z0-9]+$`) ist korrekt. Offen bleibt: die Hash-Länge ist
unbegrenzt, ein Hash über 255 Zeichen scheitert im Dateisystem mit ENAMETOOLONG und
wird zu einem 500 (bei PUT erst nach dem Upload-Versuch, bei GET über `stat`). Der
PUT-Body hat keine Obergrenze, `Content-Length` wird ungeprüft auf Platte geschrieben;
jeder Prozess auf dem Runner mit dem Token (steht in `$GITHUB_ENV`, also in allen
Folgeschritten) kann die Platte füllen. Dazu kein `requestTimeout`/Idle-Timeout-Override
außer den Node-Defaults.
Beleg: `/^[A-Za-z0-9]+$/.test(hash)` ohne Längenlimit; `Number(req.headers['content-length'])` ohne Maximum
Empfehlung: Hash auf `{1,128}` beschränken (400) und ein Maximum für `Content-Length`
(z. B. 512 MiB) mit 413 durchsetzen.

**DEP-001 · info · package.json:45** — @types/node an die unterstützte Node-Version binden
engines erlaubt Node ^24.16.0 || >=26.3.0, CI läuft auf Node 24, die Typen kommen aus
@types/node ^26.6.4. Specs und Skripte können damit Node-26-APIs typisieren, die auf 24
fehlen; der Fehler zeigt sich erst zur Laufzeit. pnpm outdated meldet sonst nur
Patch-/Minor-Updates (vitest 5.0.3 → 5.0.5, biome 2.5.15 → 2.6.2, nx 23.2.1 → 23.3.0,
playwright 1.63.0 → 1.64.1, @types/node 26.6.4 → 26.6.5); nichts deprecated.
Beleg: `"@types/node": "^26.6.4"` bei `"node": "^24.16.0 || >=26.3.0"` und `node-version: 24` in ci.yml
Empfehlung: @types/node auf ^24 pinnen oder in CI zusätzlich Node 26 laufen lassen.

**BUILD-003 · info · tsconfig.json:29** — noFallthroughCasesInSwitch bewusst ausgeschaltet begründen
Alle anderen gelockerten Optionen (exactOptionalPropertyTypes, importHelpers, types)
tragen im tsconfig einen Kommentar mit Grund; noFallthroughCasesInSwitch: false steht
ohne. Biome hat zwar noUselessSwitchCase aus, damit der Fall-through-Pfad dokumentiert
ist, im tsconfig fehlt aber der Hinweis.
Beleg: `"noFallthroughCasesInSwitch": false,`
Empfehlung: Kommentar mit dem Grund ergänzen, oder auf true setzen und die Stellen mit
Fall-through kennzeichnen.

**RES-007 · low · scripts/lookbook/previewServer.mjs:41** (auch :65, :74) — Start des Preview-Servers gegen Fehlstart und Hänger absichern
`spawn()` hat keinen `'error'`-Listener: fehlt `pnpm` im PATH, wirft das nicht
abgefangene Child-Error-Event einen rohen Stacktrace statt der sonst üblichen Meldung.
Wird der Kindprozess per Signal beendet, bleibt `exitCode` null; die Schleife prüft nur
`exitCode` und wartet die vollen 30 s. Der `fetch` in der Schleife hat kein eigenes
Timeout, eine Verbindung, die hängt, überzieht die Deadline beliebig.
Beleg: `child.exitCode !== null` (Z. 70) ohne `signalCode`; `await fetch(`${baseUrl}/`)` ohne `AbortSignal.timeout`
Empfehlung: `child.once('error', …)` anlegen und den Start damit abbrechen,
`signalCode` mitprüfen, dem fetch `signal: AbortSignal.timeout(2000)` geben.

**BUG-032 · low · scripts/lookbook/generateDemoPreviews.mjs:68** (auch :73, :88) — Preview-Event ohne `detail` nicht als erfolgt werten
Der Init-Script merkt sich `event.detail` mit `??=`, `waitForFunction` wartet auf einen
truthy Wert von `window.__lookbookPreview`. Feuert eine Demo das Event ohne `detail`
(undefined/null), wird der Zustand nie truthy und der Lauf endet nach 30 s im Timeout,
obwohl das Ereignis eingetreten ist. Der Code behandelt `detail` an anderer Stelle
selbst als optional (`detail?.trigger`), das ist widersprüchlich.
Beleg: `w.__lookbookPreview ??= event.detail` und `waitForFunction(() => window.__lookbookPreview)`
Empfehlung: Im Init-Script `w.__lookbookPreview ??= {detail: event.detail}` (oder ein
separates Boolean-Flag) setzen und darauf warten.

**DX-003 · low · scripts/lookbook/generateDemoPreviews.mjs:58** (auch :88, :155) — Seiten- und Konsolenfehler beim Preview-Lauf nicht als Fehlschlag werten
`pageerror`- und `console.error`-Meldungen landen in `problems`, aber eine Demo bleibt
`ok: true` und der Lauf endet mit Exit 0, auch wenn sie nur das halbe Bild oder die
WebGL-Fallback-Szene geschossen hat. Das Preview-Bild wird überschrieben, die Probleme
stehen nur im Scrollback.
Beleg: `return {id, ok: true, …, problems}`; `return failed.length === 0 ? 0 : 1` zählt nur `ok`
Empfehlung: Eine Option `--strict` (oder Standardverhalten) einführen, die Demos mit
`pageerror` als fehlgeschlagen führt und das alte Bild behält; mindestens die Zahl der
Demos mit Problemen in der Schlusszeile nennen.

**DX-004 · low · scripts/lookbook/lookbookDemos.mjs:20** — Dateinamen in der Fehlermeldung bei kaputter Demo-Metadatei nennen
`JSON.parse` auf `_<id>.json` ohne Kontext: Eine Syntaxfehler-Meldung wie `Unexpected
token } in JSON at position 41` landet über `generateDemoPreviews: …` ohne Hinweis,
welche der Demo-Dateien gemeint ist.
Beleg: `json: JSON.parse(fs.readFileSync(path.join(demosDir, file), 'utf8'))`
Empfehlung: Parse in try/catch kapseln und `${file}: ${message}` werfen.
