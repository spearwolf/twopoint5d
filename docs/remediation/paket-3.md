# Paket 3 — CI- und Deploy-Workflows, Nx-Cache-Server

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-043 (medium), SEC-003 (medium), CFG-025 (low), SEC-001 (low),
  DOC-073 (low), DOC-062 (info)
- Dazu (Folge aus Paket 2, verteilt in Zug 0 Paket 3): `docs/architecture.md:316–319` —
  der Absatz in §6 bricht »as« / »well:« ausgefranst um, und »leaves them out« bezieht die
  aufgezählten Specs nur über »as well« ein
- Dazu (Queue, Dublette von DOC-070 aus Paket 8): `AGENTS.md:50` — verwaiste Zeile
  »whether«; der Absatz `:45–52` wird hier ohnehin neu geschrieben (Schritt 8)
- Ziel: CI prüft auch reine Markdown-Pushes, der Bench-Schritt läuft nach dem
  Cache-Speichern, Deploy trennt Build und Publish nach Rechten und taggt nach dem
  Publish, der Cache-Server vergleicht Tokens zeitkonstant und nennt Argumentfehler.
- Modell: stärkste Stufe (Sicherheitsfix mit Angriffsmodell an der Release-Pipeline;
  die Workflows lassen sich lokal nicht ausführen, ein Fehler zeigt sich erst beim
  nächsten Release)
- Effort: high (Sicherheit; der Reviewer erbt den Wert). Der Detailplan ist für die
  Workflows wörtlich — dort nichts ergänzen, was hier nicht steht.
- Dateien:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`
  - `scripts/ci/nxCacheServer.mjs`
  - `scripts/ci/nxCacheServer/createCacheServer.mjs`
  - `scripts/ci/nxCacheServer/createCacheServer.test.mjs`
  - neu `scripts/ci/nxCacheServer/nxCacheServer.test.mjs`
  - neu `scripts/publishNpmPkg/builtinImportsOnly.test.mjs`
  - `docs/architecture.md` (§3 »In CI« und Bullet `test:scripts`, §4 Deploy-Absatz, §6)
  - `AGENTS.md` (Bullet `pnpm test:scripts`, Bullet »Publishing«)
- Nicht anfassen: `packages/twopoint5d/CHANGELOG.md` (keine Änderung an der Library-API),
  `scripts/publishNpmPkg.mjs` und seine Helfer (bleiben unverändert, nur der neue Spec
  kommt dazu), `packages/twopoint5d/package.json`, `nx.json`. Kein `git tag`, kein
  `git push`, nie `pnpm publishNpmPkg` oder `scripts/publishNpmPkg.mjs` ausführen.

## Vorgehen

Reihenfolge: zuerst die beiden Skript-Fixes mit ihren roten Tests (Schritte 1–3), dann
die Workflows (4–6), dann die Doku (7–8).

1. **DOC-073 — Regressionstest zuerst.** Neu
   `scripts/ci/nxCacheServer/nxCacheServer.test.mjs`, nach dem Muster von
   `scripts/checkPeerDependenciesOnly/checkPeerDependenciesOnly.test.mjs` (startet das
   Skript als Kindprozess):

   ```js
   import assert from 'node:assert/strict';
   import {spawnSync} from 'node:child_process';
   import {describe, it} from 'node:test';
   import {fileURLToPath} from 'node:url';

   const script = fileURLToPath(new URL('../nxCacheServer.mjs', import.meta.url));

   // every call here fails before the server listens; the timeout only catches a script
   // that would start serving after all
   const run = (args) =>
     spawnSync(process.execPath, [script, ...args], {
       encoding: 'utf8',
       env: {...process.env, NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: 'secret'},
       timeout: 10_000,
     });

   describe('nxCacheServer.mjs', () => {
     it('names an option it does not know, then prints the usage line: exit code 1', () => {
       const {status, stderr} = run(['--dri', 'cache', '--port', '0']);
       assert.equal(status, 1, stderr);
       assert.match(stderr, /'--dri'[^\n]*\nusage: /);
     });

     it('prints the usage line alone when --dir is missing: exit code 1', () => {
       const {status, stderr} = run(['--port', '0']);
       assert.equal(status, 1, stderr);
       assert.match(stderr, /^usage: [^\n]*\n$/);
     });
   });
   ```

   `node --test scripts/ci/nxCacheServer/nxCacheServer.test.mjs` laufen lassen: der erste
   Test muss rot sein (stderr enthält nur die Usage-Zeile), der zweite grün. Den roten
   Lauf in den Report.

2. **DOC-073 — Fix** in `scripts/ci/nxCacheServer.mjs:8–13`, im Idiom von
   `scripts/publishNpmPkg.mjs:11–18`:

   ```js
   let values;
   try {
     ({values} = parseArgs({options: {dir: {type: 'string'}, port: {type: 'string'}}}));
   } catch (error) {
     // parseArgs names the option or the argument it refuses
     console.error(error instanceof Error ? error.message : String(error));
     console.error(USAGE);
     process.exit(1);
   }
   ```

   Der Rest der Datei bleibt. Beide Tests aus Schritt 1 grün.

3. **SEC-001 — Regressionstest zuerst, dann Fix.**
   In `scripts/ci/nxCacheServer/createCacheServer.test.mjs` `import crypto from
   'node:crypto';` ergänzen. Ein Import von `mock` aus `node:test` entfällt: der Test
   nimmt `t.mock` aus seinem Kontext, das den Spy nach dem Test selbst zurücksetzt. Neuer
   Test, hinter »a wrong token gets 403 on GET and 401 on PUT, and stores nothing«:

   ```js
   test('the token is compared in constant time, as two digests of one length, whatever the client sends', async (t) => {
     const compare = t.mock.method(crypto, 'timingSafeEqual');
     assert.equal((await get('123', 'a-token-far-longer-than-the-right-one')).status, 403);
     assert.equal((await fetch(`${baseUrl}/v1/cache/123`)).status, 403);
     assert.equal((await get('123')).status, 404);
     assert.equal(compare.mock.callCount(), 3);
     for (const call of compare.mock.calls) {
       const [a, b] = call.arguments;
       assert.equal(a.byteLength, b.byteLength);
     }
   });
   ```

   Vor dem Fix rot (`callCount` 0), den roten Lauf in den Report. Der Spy greift, weil
   `createCacheServer.mjs` `crypto.timingSafeEqual` über den Default-Import aufruft —
   genau so muss der Fix es tun, kein benannter Import.

   Fix in `scripts/ci/nxCacheServer/createCacheServer.mjs`:
   - `const expectedAuthorization = …` (`:16`) ersetzen durch

     ```js
     // compared as SHA-256 digests: crypto.timingSafeEqual takes two buffers of one
     // length, and a digest has that length whatever the client sends
     const expectedDigest = sha256(`Bearer ${token}`);
     ```

   - `:32` wird
     `if (!authorized(req)) return reply(req, res, req.method === 'GET' ? 403 : 401);`
   - innerhalb von `createCacheServer`, neben `handle`, `serve`, `store`:

     ```js
     function authorized(req) {
       return crypto.timingSafeEqual(sha256(req.headers.authorization ?? ''), expectedDigest);
     }
     ```

   - auf Modulebene, neben `publish` und `reply`:

     ```js
     function sha256(text) {
       return crypto.createHash('sha256').update(text).digest();
     }
     ```

   Alle Tests der Datei grün, auch »a wrong token gets 403 on GET and 401 on PUT« (dort
   ist `Bearer wrong` kürzer als `Bearer secret` — ein `timingSafeEqual` auf ungehashten
   Puffern würde werfen und 500 antworten).

4. **TEST-043, SEC-003 (Checkout), CFG-025 — `.github/workflows/ci.yml`:**
   - `:3–6` (`on:` / `push:` / `paths-ignore:` / `- '**.md'`) wird

     ```yaml
     # every push, Markdown included: a Markdown file is an input of prettier --check and of
     # the type check of the docs' marked code blocks
     on: push
     ```

   - Der Checkout `:27` bekommt

     ```yaml
     - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
       with:
         # nothing in this workflow pushes, so no token waits in .git/config for an
         # install script to find
         persist-credentials: false
     ```

   - Den Schritt »Run the hot-path benchmarks« (`:94–99`) samt Kommentar hinter
     »Save the Nx cache« (`:106–111`) verschieben, vor »Show the Nx cache server log«.
     Seinem Kommentar vorne eine Zeile voranstellen: `# runs once the Nx cache is saved:
     both cache steps run on success only, and a bench that crashes must not cost the run
     its cache` (auf ≤ 90 Zeichen umbrechen), danach der bestehende Kommentar zu den
     Timings. Die Cache-Schritte behalten `if: success() && …` — ein roter Gate-Lauf
     speichert weiterhin nichts; `if: always()` dort wäre falsch.
   - Sonst nichts an `ci.yml`.

5. **SEC-003, DOC-062 — `.github/workflows/deploy.yml` wird genau diese Datei:**

   ```yaml
   name: Deploy

   on:
     workflow_run:
       workflows: [Continuous Integration]
       types: [completed]
       branches: [main]

   permissions:
     contents: read

   concurrency:
     group: deploy
     cancel-in-progress: false

   jobs:
     version:
       name: Check whether npm has this version
       runs-on: ubuntu-24.04
       # every job works on the commit the CI run names, so only a push to this repository may
       # name it
       if: >-
         ${{ github.event.workflow_run.conclusion == 'success'
         && github.event.workflow_run.event == 'push'
         && github.event.workflow_run.head_repository.full_name == github.repository }}
       outputs:
         publish: ${{ steps.check.outputs.publish }}
         version: ${{ steps.check.outputs.version }}
       steps:
         - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
           with:
             # the commit the CI run tested; main may have moved on since
             ref: ${{ github.event.workflow_run.head_sha }}
             sparse-checkout: packages/twopoint5d/package.json
             sparse-checkout-cone-mode: false
             persist-credentials: false

         - name: Compare the manifest version with npm
           id: check
           # publishNpmPkg.mjs skips the same two cases; this check only spares install and build
           run: |
             name=$(node -p "require('./packages/twopoint5d/package.json').name")
             version=$(node -p "require('./packages/twopoint5d/package.json').version")
             echo "version=$version" >> "$GITHUB_OUTPUT"
             if [[ "$version" == *-dev ]]; then
               echo "$version is a development version"
               echo "publish=false" >> "$GITHUB_OUTPUT"
               exit 0
             fi
             set +e
             npm view "$name@$version" version > npm-view.out 2> npm-view.err
             status=$?
             set -e
             if [ "$status" -eq 0 ] && [ -s npm-view.out ]; then
               echo "$name@$version is on npm already"
               echo "publish=false" >> "$GITHUB_OUTPUT"
             elif [ "$status" -eq 0 ] || grep -q E404 npm-view.err; then
               echo "$name@$version is not on npm yet"
               echo "publish=true" >> "$GITHUB_OUTPUT"
             else
               cat npm-view.err
               exit 1
             fi

     build:
       name: Build and check the package
       needs: version
       if: ${{ needs.version.outputs.publish == 'true' }}
       runs-on: ubuntu-24.04
       # reads the repository and holds no other right: every dependency of the build and its
       # install script runs in this job, away from the publish rights
       env:
         # nothing in this job runs a browser
         PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1'
       steps:
         - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
           with:
             # the same commit the version job read
             ref: ${{ github.event.workflow_run.head_sha }}
             persist-credentials: false

         # installs the pnpm that packageManager in package.json names
         - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0

         - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
           with:
             node-version: 24
             cache: pnpm

         - name: Install the workspace root and the library
           # the root holds the toolchain of the build and the checks; the lookbook, the browser
           # tests, their dependencies and their install scripts stay out
           run: pnpm install --frozen-lockfile --filter twopoint5d-workspace --filter @spearwolf/twopoint5d

         # builds from source: the Nx cache of the CI workflow never reaches a published package
         - name: Build the package
           run: pnpm --filter @spearwolf/twopoint5d run build

         - name: Check the package
           # the checks publishNpmPkg runs before it publishes, here without the publish rights
           run: |
             pnpm --filter @spearwolf/twopoint5d run checkPkgTypes
             pnpm --filter @spearwolf/twopoint5d run lintPkg
             pnpm --filter @spearwolf/twopoint5d run checkNameableTypes

         - name: Hand the package to the publish job
           uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
           with:
             name: package
             path: packages/twopoint5d/dist
             if-no-files-found: error
             retention-days: 1

     publish:
       name: Publish the package to npm
       needs: build
       runs-on: ubuntu-24.04
       permissions:
         id-token: write # npm Trusted Publishing (OIDC)
         contents: read
       steps:
         - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
           with:
             # the publish script, and the license, changelog and readme it copies into the package
             ref: ${{ github.event.workflow_run.head_sha }}
             persist-credentials: false

         - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
           with:
             node-version: 24
             registry-url: https://registry.npmjs.org
             scope: '@spearwolf'

         - name: Take the package the build job checked
           uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
           with:
             name: package
             path: packages/twopoint5d/dist

         # installs nothing: with the publish rights run publishNpmPkg.mjs, its helpers and npm
         - name: Publish npm packages
           working-directory: packages/twopoint5d
           run: node ../../scripts/publishNpmPkg.mjs dist

     tag:
       name: Tag the published version
       needs: [version, publish]
       runs-on: ubuntu-24.04
       permissions:
         # creates the tag through the REST API; the job checks nothing out and installs nothing
         contents: write
       steps:
         - name: Tag the published commit
           env:
             GH_TOKEN: ${{ github.token }}
             TAG: v${{ needs.version.outputs.version }}
             SHA: ${{ github.event.workflow_run.head_sha }}
           # a version gets its tag once, from the deploy that published it; a tag that exists
           # already stays as it is
           run: |
             if existing=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/tags/$TAG" --jq .object.sha 2> /dev/null); then
               if [ "$existing" != "$SHA" ]; then
                 echo "::warning::$TAG exists already and points at $existing, not at $SHA"
               else
                 echo "$TAG exists already"
               fi
             else
               gh api --method POST "repos/$GITHUB_REPOSITORY/git/refs" -f "ref=refs/tags/$TAG" -f "sha=$SHA"
             fi
   ```

   Im Job `version` ist gegenüber heute nur die Zeile `echo "version=$version" …`, der
   Output `version` und `persist-credentials: false` neu; der Vergleichsblock darunter ist
   `deploy.yml:45–63` unverändert. Das `env: NX_DEFAULT_OUTPUT_STYLE` der Workflow-Ebene entfällt, weil im Deploy nichts mehr
   durch Nx läuft (der Build ruft das Paket-Skript direkt). Kommentare auf ≤ 90 Zeichen
   halten; Prettier (`pnpm lint`) formatiert YAML mit — dessen Ausgabe gilt.

6. **Strukturprobe der Workflows** (es gibt lokal weder `act` noch `actionlint`):

   ```bash
   node --input-type=module -e "import {parse} from 'yaml'; import fs from 'node:fs'; for (const f of ['.github/workflows/ci.yml', '.github/workflows/deploy.yml']) { const w = parse(fs.readFileSync(f, 'utf8'), {strict: true, uniqueKeys: true}); console.log(f, Object.keys(w.jobs).join(' ')); }"
   ```

   Erwartet: `ci.yml ci` und `deploy.yml version build publish tag`. Ausgabe in den Report.

7. **Doku `docs/architecture.md`** — Aussagen, die dastehen müssen, im Ton und
   Umbruch (≤ 88–90) der Datei; kein Rückblick auf den Vorzustand:
   - §3 »In CI« (`:134–140`): nach »runs the gate on every push.« — der Workflow hat
     keinen Pfadfilter, weil Markdown Input von `prettier --check` und von
     `twopoint5d-testing:typecheck` ist (§2); ein Push, der nur Docs ändert, fährt das
     Gate also auch, und der Nx-Cache beantwortet die Targets, deren Inputs er nicht
     berührt. Dazu: jeder Checkout, hier und in `deploy.yml`, setzt
     `persist-credentials: false` — nichts in beiden Workflows pusht, also liegt kein
     Token in `.git/config`, das ein Install-Skript finden könnte.
   - §3 Bench-Absatz (`:149–153`): »After the gate …« wird zu: der Schritt läuft,
     sobald der Nx-Cache gespeichert ist — nach dem Speichern, damit ein abstürzender
     Bench den Lauf nicht seinen Cache kostet. Der Rest des Absatzes bleibt.
   - §3 Bullet `test:scripts` (`:118–124`): die Aufzählung nennt zusätzlich die Specs
     des Einstiegsskripts des Cache-Servers (»of the CI cache server and its entry
     script«) und den Check, dass das Publish-Skript nur Node-Built-ins importiert.
   - §4 Deploy-Absatz (`:236–245`) neu, mit diesen Aussagen: `deploy.yml` läuft nach
     jedem erfolgreichen CI-Lauf auf `main` in vier Jobs; jeder arbeitet auf
     `github.event.workflow_run.head_sha` (Begründung wie bisher: `main` kann
     weitergezogen sein), und nur für CI-Läufe aus einem Push in dieses Repository (wie
     bisher). `version` fragt npm (wie bisher); nur wenn weder »schon veröffentlicht«
     noch `-dev` gilt, laufen die anderen drei. `build` hält kein Recht außer dem Lesen
     des Repositorys und ist der Job, in dem die Dependencies und ihre Install-Skripte
     laufen; er installiert Workspace-Root und Library allein (das Kommando wörtlich),
     sodass Lookbook, Browser-Tests und deren Dependencies draußen bleiben, baut die
     Library, läuft `checkPkgTypes`, `lintPkg`, `checkNameableTypes` und reicht `dist/`
     als Artifact `package` weiter. `publish` ist der einzige Job mit `id-token: write`;
     er installiert nichts, checkt den Commit aus, nimmt `dist/` aus dem Artifact und
     ruft `node ../../scripts/publishNpmPkg.mjs dist` in `packages/twopoint5d` — mit den
     Publish-Rechten laufen also nur dieses Skript, seine Helfer und npm. Deshalb
     importieren `publishNpmPkg.mjs` und `scripts/publishNpmPkg/` nichts außer
     Node-Built-ins und einander, und `scripts/publishNpmPkg/builtinImportsOnly.test.mjs`
     hält das. Trusted Publishing, kein npm-Token, SLSA-Provenance, Publisher-Zeile und
     »the first being 0.21.2« bleiben stehen. `tag` folgt einem erfolgreichen Publish und
     legt das Tag `v<version>` auf den veröffentlichten Commit über die REST-API an, mit
     `contents: write` als einzigem Recht, ohne Checkout und ohne Installation; eine
     Version bekommt ihr Tag einmal — ein vorhandenes bleibt, mit einer Warnung, wenn es
     auf einen anderen Commit zeigt. Ein Tag, das der `GITHUB_TOKEN` des Workflows
     anlegt, startet keinen CI-Lauf. Versionen bis 0.21.2 tragen kein Tag.
     Der Satz davor über `publishNpmPkg` (»runs `checkPkgTypes`, `lintPkg` and
     `checkNameableTypes` first and then publishes `dist/`«) bleibt: er beschreibt das
     Skript, der neue Absatz den Deploy.
   - §6 (`:316–319`, Folge aus Paket 2): neu umbrechen und eindeutig machen, dass
     `pnpm test` auch die aufgezählten Specs auslässt, etwa: »The helpers of the publish
     pipeline, the CI cache server and the code block check run under `node --test`
     (`pnpm test:scripts`), and four more specs run in the same run. The Nx project
     `scripts` has no `test` target, so `pnpm test` leaves all of them out. The four
     are:« — »four«, weil die Liste einen Punkt dazubekommt:
     `scripts/publishNpmPkg/builtinImportsOnly.test.mjs` hält `publishNpmPkg.mjs` und
     seine Helfer bei Imports von Node-Built-ins und voneinander, weil der Publish-Job
     des Deploys nichts installiert (§4).
   - §6 (`:331–336`): »Two specs start a script itself …« wird »Three specs …« mit
     `scripts/ci/nxCacheServer.mjs` und einer Kommandozeile, die es ablehnt, als drittem;
     die Begründung (Exit-Codes, Meldungen, Verdrahtung, die kein Helfer-Test sieht)
     bleibt.
   - §4 Schlusssatz »The exception is `scripts/ci/`, which only the CI workflow runs.«
     bleibt.

8. **Doku `AGENTS.md`:**
   - Bullet `pnpm test:scripts` (`:45–52`) als Ganzes neu schreiben und bei ≤ 90 Zeichen
     durchgehend umbrechen (damit verschwindet die verwaiste Zeile »whether« an `:50`):
     die Aufzählung nennt `makePackageJson.mjs`, `checkPeerDependenciesOnly.mjs` und
     `nxCacheServer.mjs` als Skripte, die Specs als Kindprozess starten, und zusätzlich
     »one that holds the publish script to Node's built-ins«; der Rest des Inhalts
     bleibt.
   - Bullet »Publishing« (`:93–97`): ein Satz dazu — `scripts/publishNpmPkg.mjs` und
     `scripts/publishNpmPkg/` importieren nichts außer Node-Built-ins (`node:`) und
     einander, weil der Publish-Job des Deploys nichts installiert;
     `builtinImportsOnly.test.mjs` schlägt bei allem anderen fehl.

9. **Guard für den Publish-Job** — neu `scripts/publishNpmPkg/builtinImportsOnly.test.mjs`
   (die eigene Änderung macht die Regel nötig: ohne ihn fällt ein Import eines Pakets
   erst beim nächsten Release auf, im Publish-Job ohne `node_modules`):

   ```js
   import assert from 'node:assert/strict';
   import fs from 'node:fs';
   import path from 'node:path';
   import {test} from 'node:test';
   import {fileURLToPath} from 'node:url';
   import {findUndeclaredImports} from '../checkPeerDependenciesOnly/findUndeclaredImports.mjs';

   const scripts = fileURLToPath(new URL('..', import.meta.url));

   test("publishNpmPkg.mjs and its helpers import nothing but Node's built-ins and each other: the publish job of the deploy installs nothing", () => {
     const helpers = fs
       .readdirSync(path.join(scripts, 'publishNpmPkg'))
       .filter((name) => name.endsWith('.mjs') && !name.endsWith('.test.mjs'))
       .map((name) => path.join('publishNpmPkg', name));
     // an empty or moved directory would let the check pass on nothing
     assert.ok(helpers.includes(path.join('publishNpmPkg', 'releaseFiles.mjs')), `helpers: ${helpers}`);

     const files = ['publishNpmPkg.mjs', ...helpers].map((file) => ({file, text: fs.readFileSync(path.join(scripts, file), 'utf8')}));
     const packages = findUndeclaredImports(files, undefined).filter(({specifier}) => !specifier.startsWith('node:'));
     assert.deepEqual(packages, []);
   });
   ```

   Er ist von Anfang an grün (heute importieren alle nur `node:` und relativ). Probe, dass
   er beißt: vorübergehend `import 'semver';` an den Anfang von
   `scripts/publishNpmPkg/releaseFiles.mjs`, Test rot sehen, Zeile wieder entfernen. Den
   roten Probelauf in den Report. `findUndeclaredImports` meldet `node:`-Specifier als
   nicht deklariert (`packageNameOf('node:fs')` ist `node:fs`); der Filter danach ist
   Absicht.

## Verify

```bash
pnpm run ci
```

Dazu die Strukturprobe aus Schritt 6. `pnpm run ci` enthält `pnpm lint` (Prettier prüft
das YAML und das Markdown), `pnpm typecheck` (das Nx-Projekt `scripts` prüft jede neue
`.mjs` unter `scripts/` mit `checkJs`) und `pnpm test:scripts` (alle drei neuen bzw.
erweiterten Specs).

## Commit

```
ci: run the gate on every push, Markdown included, run the benchmarks once the Nx cache is saved, build and check the package in a deploy job without publish rights and publish it from a job that installs nothing, tag each published version, keep the token out of every checkout, let the Nx cache server compare its token in constant time and name the option it refuses, and hold the publish script to Node's built-ins
```

## Entscheidungen in Zug 0

- **TEST-043: `paths-ignore` fällt ganz, kein zweiter leichter Job.** Markdown ist Input
  von zwei Gate-Schritten (`prettier --check .` und `twopoint5d-testing:typecheck`, siehe
  `packages/twopoint5d-testing/project.json:15–22`); ein eigener Markdown-Job müsste
  beide nachbauen und die Gate-Definition doppeln. Die Kosten eines Markdown-Pushes
  deckelt der Nx-Remote-Cache: alle Targets ohne Markdown-Input sind Treffer.
- **CFG-025: Schritt verschieben, nicht `if: always()` an den Cache-Schritten.** Das
  zweite hätte einen roten Gate-Lauf den Cache speichern lassen, gegen die dokumentierte
  Regel »A red run saves nothing« (`docs/architecture.md` §3).
- **SEC-003: Split in `build` → `publish` wie empfohlen; Publish über
  `publishNpmPkg.mjs`, nicht über ein nacktes `npm publish`.** Das Skript importiert nur
  `node:`-Built-ins und seine Helfer (geprüft: einziger Import unter den Helfern ist
  `releaseFiles.mjs` → `node:fs`, `node:path`), läuft also ohne Installation und behält
  den einen Publish-Weg samt Skip-Logik und dem Kopieren von LICENSE, CHANGELOG und README.
  Die drei Checks laufen im `build`-Job ohne Publish-Rechte; der Job `publish` checkt voll
  aus (keine Sparse-Muster, die bei einer späteren Änderung am Skript still eine Datei
  vermissen ließen) und führt aus dem Checkout nur das Publish-Skript aus.
- **SEC-003: `--filter` zusätzlich zum Split.** Mit dem Split schützt der Filter nicht
  mehr das OIDC-Token, aber er hält die Install-Skripte und Dependencies aus dem Job
  heraus, dessen `dist/` veröffentlicht wird: Lookbook samt `postinstall`
  (`apps/lookbook/package.json:12`), `sharp`, `@parcel/watcher`, Astro. Probe in Zug 0
  auf 576d3fc6, frischer Klon: `pnpm install --frozen-lockfile --filter
  twopoint5d-workspace --filter @spearwolf/twopoint5d` → »Scope: 2 of 4 workspace
  projects«, 362 Pakete, kein `node_modules` in Lookbook und Testpaket, von den
  Build-Skript-Paketen nur `esbuild` und `nx`; danach `build`, `checkPkgTypes`, `lintPkg`,
  `checkNameableTypes` je Exit 0, `dist/` enthält nur `lib/` und `package.json`.
- **SEC-003: `persist-credentials: false` an jedem Checkout beider Workflows**, auch im
  CI-Job (`ci.yml:27`, die Fundstelle `ci.yml:23` des Findings): nichts pusht, auch
  `typecheckInputs.test.mjs` braucht nur lokales `git ls-files`.
- **DOC-062: eigener Job `tag` statt `contents: write` im Publish-Job** (Abweichung von
  der Empfehlung): so hält kein Job zugleich das OIDC-Recht und ein Schreibrecht aufs
  Repository, und der Job mit Schreibrecht führt keinen Code aus dem Checkout oder aus
  npm aus. Leichtgewichtiges Tag über `POST /repos/{repo}/git/refs` statt `git push`,
  weil kein Checkout Credentials behält; ein annotiertes Tag bräuchte einen zweiten
  API-Aufruf, und nichts im Repo liest Tag-Annotationen. Tag-Format `v<version>` wie
  empfohlen; es gibt kein Versions-Tag, auf das sich ein anderes Format berufen könnte
  (vorhanden nur `remember-bitmap-tool`, `remember-handbook`, `remember-r3f`). Ein
  vorhandenes Tag lässt der Job stehen und warnt nur, wenn es auf einen anderen Commit
  zeigt: der Publish ist dann schon geschehen, und ein roter Deploy würde einen
  gescheiterten Publish vortäuschen. Rulesets des Repos: nur »Copilot review for default
  branch« (Branch), keine Tag-Regel. Die Entscheidung vom 2026-09-30 (»in diesem Lauf
  wird kein Tag gesetzt«) bleibt gewahrt: der Workflow taggt erst beim nächsten Release.
- **SEC-001: Spy-Test auf `crypto.timingSafeEqual`.** Die Eigenschaft ist funktional
  unsichtbar (Antworten gleich vor und nach dem Fix); ein Spy über `t.mock.method` ist der
  einzige Test, der vor dem Fix rot ist. Er bindet den Fix an den Aufruf über den
  Default-Import, was der Detailplan so vorschreibt.
- **Guard `builtinImportsOnly.test.mjs`**: gehört zur eigenen Änderung (sie schafft die
  Regel »Publish ohne Installation«); ohne ihn schlüge ein neuer Paket-Import in den
  Publish-Helfern erst im Release fehl, weit weg von seiner Ursache. Muster wie
  `rainbowLineScript.test.mjs` und `typecheckInputs.test.mjs`.
- **download-artifact v8.0.1** (`3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c`, per
  `gh api repos/actions/download-artifact/git/ref/tags/v8.0.1` aufgelöst, Commit-Objekt):
  aktuelle Version; bricht bei Digest-Abweichung standardmäßig ab. Kompatibel mit
  `upload-artifact` v7.0.1 (gleiches Backend seit v4). Dependabot (`github-actions`)
  hält sie danach aktuell.

## Für Zug 5 (Schnittstellen im Plan)

B trägt nach dem Commit unter Paket 3 mindestens ein:
- `deploy.yml`: Jobs `version` (Outputs `publish`, `version`) → `build` (ohne
  `id-token`, Artifact `package` = `packages/twopoint5d/dist`) → `publish`
  (`id-token: write`, keine Installation, `node ../../scripts/publishNpmPkg.mjs dist` in
  `packages/twopoint5d`) → `tag` (`contents: write`, `v<version>` auf `head_sha`)
- `scripts/publishNpmPkg.mjs` und `scripts/publishNpmPkg/*.mjs` (ohne Tests) importieren
  nur `node:`-Built-ins und einander; `builtinImportsOnly.test.mjs` hält das — Paket 4
  ändert `publishedVersions.mjs` und muss darin bleiben
- `ci.yml` ohne Pfadfilter; Bench nach »Save the Nx cache«; jeder Checkout mit
  `persist-credentials: false`
- Offene Befunde: Eintrag `AGENTS.md:50` abhaken, wenn Schritt 8 die Zeile beseitigt hat;
  unter Paket 8 vermerken, dass die AGENTS.md-Hälfte von DOC-070 mit diesem Hash fiel

## Restplan (Zug 0)

- Folgen aus Paket 2 verteilt: `docs/architecture.md:316–319` → Paket 3 (derselbe
  Unterabschnitt von §6 wird hier für die Kindprozess-Specs umgeschrieben);
  `scripts/checkDocSnippets/extractSnippets.mjs:29` (`@typedef` 108 Zeichen) → Paket 4
  (Kommentare unter `scripts/checkDocSnippets*`, dort liegen TEST-037 und READ-018);
  `packages/twopoint5d/CHANGELOG.md:911–913` (»see the next section«) → Paket 9 (glättet
  den Block). Kein Nachtragspaket: drei Textreste in drei Dateien, jede im Bereich eines
  offenen Pakets, das dieselbe Datei ohnehin anfasst — wie in Zug 0 von Paket 2 mit den
  Folgen aus Paket 1.
- Queue `AGENTS.md:50` ist dieselbe Zeile wie DOC-070 (AGENTS.md-Hälfte, Paket 8); sie
  fällt mit Schritt 8 dieses Pakets. Paket 8 behält DOC-070 für
  `apps/lookbook/README.md:56`.
- Reihenfolge der offenen Pakete bleibt. Paket 4 bekommt die Regel »nur
  `node:`-Imports in `publishNpmPkg*`« über die Schnittstellen-Zeile; der Guard fängt
  einen Verstoß im Gate.
- Die übrigen zwei Einträge der Queue (`astro-rainbow-line`, README-Peers) teilen keine
  Ursache mit diesem Paket und bleiben liegen.

## Verlauf

- 2026-09-30 Zug 0: Detailplan steht · TEST-043 unverändert (`ci.yml:3–6`,
  `twopoint5d-testing/project.json:15–22`) · SEC-003 unverändert (Job `deploy` jetzt
  `deploy.yml:65–97`, Lookbook-`postinstall` `apps/lookbook/package.json:12`, CI-Checkout
  `ci.yml:27` ohne `persist-credentials`) · CFG-025 unverändert (`ci.yml:94`, Save `:106`)
  · SEC-001 unverändert (`createCacheServer.mjs:32`) · DOC-073 unverändert
  (`nxCacheServer.mjs:8–13`) · DOC-062 unverändert (kein Versions-Tag) · Folgen Paket 2:
  §6 → Paket 3, `extractSnippets.mjs:29` → Paket 4, CHANGELOG `:911–913` → Paket 9 ·
  Queue `AGENTS.md:50` = DOC-070, fällt mit Paket 3 · Probe gefilterte Installation auf
  576d3fc6 grün
- 2026-09-30 Zug 1: Implementierer beauftragt · opus (stärkste), Effort high · Session
  `98a3387a-p3-impl-0`, Brief `paket-3.impl-0.brief.txt`, Report `paket-3.impl-0.json`
- 2026-09-30 Zug 2: Report FERTIG · 9 Dateien (7 geändert: `ci.yml`, `deploy.yml`,
  `nxCacheServer.mjs`, `createCacheServer.mjs`, `createCacheServer.test.mjs`,
  `docs/architecture.md`, `AGENTS.md`; neu `nxCacheServer.test.mjs`,
  `builtinImportsOnly.test.mjs`) · rote Läufe: `nxCacheServer.test.mjs` 1/2 rot, Spy-Test
  `callCount` 0 !== 3, Guard-Probe mit `import 'semver'` rot · Arbeitsbaum schmutzig ·
  Verify `pnpm install && nx reset && pnpm run ci` + Strukturprobe exit=0
  (`paket-3.verify.log`, test:scripts 107/107)
- 2026-09-30 Zug 3: Reviewer beauftragt · opus, Effort high · Diff `paket-3.diff` (785
  Zeilen, 9 Dateien) · Report `paket-3.review-0.json`
- 2026-09-30 Zug 3: Urteil — alle 6 Findings, §6-Folge und Queue `AGENTS.md:50` behoben ·
  wichtig 2 (Lifecycle-Skripte aus `dist/package.json` laufen im Publish-Job; Guard lässt
  relative Imports außerhalb der Helfer durch) · klein 3 (Bench-Kommentar ohne
  Satzgrenze `ci.yml:110–114`; »nothing in either workflow pushes« `architecture.md:142`;
  Kommentare > 90 Zeichen `deploy.yml:20,91,100,124,140,150,158`) · Nebenbefunde 2
- 2026-09-30 Zug 4 Runde 1: offen die 2 wichtigen Befunde, die 3 kleinen mitgegeben
  (Runde fällt ohnehin) · Resume `c76bedfc-a2b6-4219-a020-3ce667f31b83` (opus, high) ·
  Abweichung vom wörtlichen `deploy.yml` des Detailplans: `npm_config_ignore_scripts` am
  Publish-Schritt — ohne sie gilt die Aussage »mit den Publish-Rechten laufen nur dieses
  Skript, seine Helfer und npm« nicht, die der Detailplan selbst in §4 verlangt;
  `publishNpmPkg.mjs` bleibt unberührt (`npmCommand` erbt `process.env`)
- 2026-09-30 Zug 4 Runde 1 zurück: FERTIG · `npm_config_ignore_scripts: 'true'` am
  Publish-Schritt (Beleg npm 11.19.0 `lib/commands/publish.js:85/100/217`, libnpmpack,
  pacote; Probe mit `--dry-run`) · Guard löst relative Specifier auf, Proben mit
  `../checkPeerDependenciesOnly/…` und `semver` je rot · 3 kleine behoben · Verify exit=0
  (`paket-3.verify-1.log`, 107/107) · Diff `paket-3.r1.diff` · Reviewer gezielt
  (`paket-3.review-1.json`)
- 2026-09-30 Zug 4 Runde 1 Review: alle 5 Befunde erledigt · klein 2 neu (Kommentarzeilen
  `architecture.md:143` 91 Zeichen, `ci.yml:113` 96 Zeichen) · keine weitere Runde
- 2026-09-30 Zug 5: committet 5a413417 (9 Dateien, +289/−72) auf Verify
  `paket-3.verify-1.log` exit=0 (Arbeitsbaum seither unverändert, gegen `paket-3.r1.diff`
  geprüft) · Trailer `Remediation-Run: 2026-09-30` · Plan: `[x]`, Queue `AGENTS.md:50`
  abgehakt, drei Nebenbefunde in die Queue

## Urteil des Reviewers

Review 0 (`paket-3.review-0.json`, auf `paket-3.diff`), bestätigt nach Runde 1 durch
Review 1 (`paket-3.review-1.json`, auf `paket-3.r1.diff`); Zeilen im Stand von 5a413417
können um wenige Zeilen abweichen:

- TEST-043: behoben — `.github/workflows/ci.yml:3–5` `on: push` ohne Pfadfilter, Grund im
  Kommentar; `docs/architecture.md:136–139`
- SEC-003: behoben — `deploy.yml` Jobs `build` (nur `contents: read`, gefilterte
  Installation, Checks, Artifact) und `publish` (einziger Job mit `id-token: write`,
  installiert nichts, `npm_config_ignore_scripts: 'true'` am Publish-Schritt
  `:148–151`); jeder Checkout mit `persist-credentials: false` (`ci.yml:30`,
  `deploy.yml` alle drei Checkouts); Doku `docs/architecture.md:263–265`
- CFG-025: behoben — Bench nach »Save the Nx cache« (`ci.yml:108–116`), Cache-Schritte
  behalten `if: success() && …`; `docs/architecture.md:155–156`, »A red gate saves nothing«
- SEC-001: behoben — `createCacheServer.mjs:16–18`, `:44–46`, `sha256` auf Modulebene
  `:100–102`; Spy-Test `createCacheServer.test.mjs:84–94`
- DOC-073: behoben — `nxCacheServer.mjs:8–16`; Test `nxCacheServer.test.mjs:18–28`
- DOC-062: behoben — Job `tag` (`deploy.yml` ab `:154`), nur `contents: write`, `needs:
  [version, publish]`, `v<version>` per REST-API auf `head_sha`, vorhandenes Tag bleibt
- Folge aus Paket 2, §6: behoben — `docs/architecture.md:342–366` (»leaves all of them
  out«, vier Specs, »Three specs …«)
- Queue `AGENTS.md:50` »whether«: behoben — Bullet `AGENTS.md:45–52` neu umbrochen

Befunde von Review 0, in Runde 1 behoben: wichtig — Lifecycle-Skripte aus `dist/package.json`
liefen im Publish-Job (jetzt `npm_config_ignore_scripts`); wichtig — Guard ließ relative
Imports außerhalb der Publish-Helfer durch (jetzt aufgelöst und gegen die Menge geprüft;
Reviewer-Proben mit `../…`, dynamischem Import, `'..'`, absolutem Pfad und `file://` je
rot); klein — Satzgrenze im Bench-Kommentar; klein — »nothing in either workflow pushes«;
klein — Kommentarzeilen über 90 in `deploy.yml`.

Kleine Befunde, offen (als Folgen im Plan): `docs/architecture.md:143` 91 Zeichen ·
`.github/workflows/ci.yml:113` Timing-Kommentar 96 Zeichen, mit dem Bench-Schritt
verschoben.

Abweichungen vom Detailplan:
- `deploy.yml` ist nicht mehr wörtlich die Datei aus Schritt 5: `env:
  npm_config_ignore_scripts: 'true'` samt Kommentar am Schritt »Publish npm packages« und
  umbrochene Kommentarzeilen. Grund: ohne die Variable liefen `prepublishOnly`, `prepack`,
  `prepare`, `postpack`, `publish`, `postpublish` aus dem Manifest des Build-Artifacts mit
  dem OIDC-Recht, und die Aussage des Detailplans in §4 (»mit den Publish-Rechten laufen
  nur dieses Skript, seine Helfer und npm«) wäre falsch. Beleg npm 11.19.0
  `lib/commands/publish.js:85/100/217`, libnpmpack `:19/:45`, pacote `lib/dir.js:35`,
  Probe mit `--dry-run`. Kein anderer Lösungsweg: derselbe Split, `publishNpmPkg.mjs`
  unverändert.
- `docs/architecture.md` §4 beschreibt den Deploy als Einleitung plus Liste der vier Jobs
  statt eines Absatzes; alle geforderten Aussagen stehen darin.
- Commit-Message um »and runs none of the package's lifecycle scripts« und »and its own
  helpers« ergänzt (die Änderungen aus Runde 1).

## Findings im Volltext

**TEST-043 · medium · .github/workflows/ci.yml:5-6** (auch
`packages/twopoint5d-testing/project.json:15`) — Markdown-Pushes nicht am Check der
ts-check-Blöcke vorbeilassen
`paths-ignore: '**.md'` lässt CI für jeden Push ausfallen, der nur Markdown ändert. Genau
Markdown ist aber der Input von `twopoint5d-testing:typecheck`, das alle `ts check`-Blöcke
kompiliert. Ein kaputter Doc-Snippet landet so ungeprüft auf main und fällt erst beim
nächsten Code-Push auf, ohne erkennbaren Bezug zur Ursache.
Empfehlung: `paths-ignore` entfernen oder für reine Markdown-Pushes einen leichten Job mit
Build und `twopoint5d-testing:typecheck` fahren.

**SEC-003 · medium · .github/workflows/deploy.yml:61-92** (auch
`apps/lookbook/package.json:12`, `.github/workflows/ci.yml:23`) — Build und Publish in Jobs
mit getrennten Rechten aufteilen
Der Job mit `id-token: write` führt `pnpm install` samt Workspace-`postinstall` und den
Build-Skripten von esbuild, nx, sharp und @parcel/watcher aus und baut dann alles. Jede
Dev-Dependency kann dabei über `ACTIONS_ID_TOKEN_REQUEST_*` ein npm-Publish-Token
anfordern. Die Lookbook-Installation braucht der Publish gar nicht, und der Checkout läuft
ohne `persist-credentials: false`.
Empfehlung: Build und Checks in einem Job ohne `id-token`, `dist/` als Artifact
weitergeben, der Publish-Job lädt nur das Artifact und ruft `npm publish` auf. Mindestens
`--filter @spearwolf/twopoint5d...` und `persist-credentials: false`.

**CFG-025 · low · .github/workflows/ci.yml:94** (auch `.github/workflows/ci.yml:106`) —
Bench-Schritt in CI hinter das Speichern des Nx-Caches legen
Der Schritt »Run the hot-path benchmarks« steht vor »Drop the Nx cache entries this run did
not use« und »Save the Nx cache« (beide `if: success()`). Ein abstürzender Bench kostet
damit das Speichern des Nx-Caches des ganzen Laufs.
Empfehlung: Den Bench-Schritt hinter »Save the Nx cache« verschieben oder die beiden
Cache-Schritte mit `if: always()` laufen lassen.

**SEC-001 · low · scripts/ci/nxCacheServer/createCacheServer.mjs:32** —
Bearer-Token-Vergleich des Nx-Cache-Servers gegen Timing-Angriffe absichern
`req.headers.authorization !== expectedAuthorization` vergleicht das Token mit einem
gewöhnlichen String-Vergleich, der bei einem Unterschied früh abbricht und damit ein
Timing-Seitenkanal ist. Die Angriffsfläche ist durch `server.listen(port, '127.0.0.1',
...)` auf localhost begrenzt, ein Angreifer bräuchte also ohnehin schon Zugriff auf den
CI-Runner-Prozess.
Empfehlung: `crypto.timingSafeEqual` auf gleich lange, z. B. mit SHA-256 vorab gehashte
Puffer anwenden, statt des direkten String-Vergleichs — günstige Absicherung ohne
Funktionsänderung.

**DOC-073 · low · scripts/ci/nxCacheServer.mjs:9** (auch `scripts/ci/nxCacheServer.mjs:13`)
— Konkreten `parseArgs`-Fehler in `nxCacheServer.mjs` ausgeben statt verschlucken
Wirft `parseArgs` (z. B. bei einer unbekannten Option), fängt der leere `catch` sie ab und
setzt nur `values = {}`; das Script zeigt danach ausschließlich die generische
`USAGE`-Zeile, nie die eigentliche Fehlermeldung von `parseArgs`. Wer das Script mit einem
Tippfehler in einer Option aufruft, sieht nicht, welche Option gemeint war.
Empfehlung: Die gefangene Fehlermeldung mit ausgeben (z. B. `console.error(err.message)`
vor der `USAGE`-Zeile), statt sie stillschweigend zu verwerfen.

**DOC-062 · info · .github/workflows/deploy.yml:92** — Releases mit einem Git-Tag markieren
Es gibt keinen einzigen Versionstag. Der Deploy erzeugt weder Tag noch Release, ein
npm-Release lässt sich nur über die Provenance auf seinen Commit zurückführen.
Empfehlung: Nach erfolgreichem Publish `v<version>` taggen oder einen GitHub Release
anlegen (`contents: write` nur im Publish-Job).
