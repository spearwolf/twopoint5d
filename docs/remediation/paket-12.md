# Paket 12 — Nachlese: StageRenderer-Host-Fehler, Doku, Deploy und Cache-Server

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — Drain aus der Befund-Queue (neun Einträge, alle
  vorbestehend, alle `→ Scope`), dazu eine Stelle gleicher Ursache aus Zug 0
  (`packages/twopoint5d/README.md:55`, Zeile nur aus Leerzeichen)
- Ziel: `StageRenderer` sammelt einen Fehler beim Abonnieren des Hosts nach demselben
  Vertrag wie die übrigen Fehler eines Umzugs, die verbleibenden Doku- und
  Kommentarstellen stimmen und sind umbrochen, der Deploy verliert keine Version und der
  Cache-Server weist ungültige Ports mit der Usage ab.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts` (`:126–130`, `:252–305`, `:306–344`,
    `:346–359`, `:362–372`)
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts` (`:127–174` `makeHost()`,
    `:1300`, `:1372–1385`, `:1426`, neue Tests im `describe('parent / host wiring')` ab
    `:1098`)
  - `packages/twopoint5d/src/stage/README.md` (»Custom host« `:605–610`, dazu jede
    Prosazeile über 88 im ganzen File)
  - `packages/twopoint5d/CHANGELOG.md` (ein neuer Bullet unter `### Fixed` nach `:351`)
  - `packages/twopoint5d/README.md` (`:36–37`, `:44–46`, `:48–50`, `:55`)
  - `AGENTS.md` (`:16`, `:106–108`)
  - `docs/architecture.md` (`:15`, `:52–55`, §4 nach `:257`)
  - `packages/twopoint5d-testing/test/pan-control-dispose.test.js` (`:93–95`)
  - `.github/workflows/deploy.yml` (`:12–14`)
  - `scripts/ci/nxCacheServer.mjs` (`:20–25`),
    `scripts/ci/nxCacheServer/nxCacheServer.test.mjs` (ein Test mehr)
  - nicht anfassen: `Display.ts` (wirft beim Abonnieren nie, siehe Abgleich),
    `add()`/`dispose()`/`remove()` von `StageRenderer` samt ihren Sammelmeldungen (dort
    abonniert niemand einen Host), die Kommentarbreite der übrigen Browser-Tests,
    `packages/twopoint5d/docs/*.md`, `README.md` im Root
- Vorgehen:
  1. **Regressionstests zuerst, rot sehen** (`StageRenderer.spec.ts`, im
     `describe('parent / host wiring')`). Zuerst `makeHost()` erweitern: `failures` bekommt
     `onResize?: Error` — `onResize: (h) => { if (failures.onResize) throw failures.onResize; … }`,
     genau wie `onRenderFrame` (`:157`): der Host wirft, bevor er den Handler nimmt. Den
     Kommentar `:127–129` anpassen: »failures: onResize and onRenderFrame make the host
     throw that error before it takes a handler; …«. Dann diese Tests, jeder mit
     `thrownBy()` (`:102`); alle fünf sind vor dem Fix rot, die rote Ausgabe gehört in den
     Report:
     - **umbauen** `:1372` »a host whose onRenderFrame() throws gets its onResize()
       subscription back once the renderer moves on« → neuer Name »a host whose
       onRenderFrame() throws gets its onResize() subscription back at once, and the
       renderer joins no holder«. Direkt nach `expect(thrownBy(() => sr.attach(hostA))).toBe(failure)`:
       `expect(hostA._unsubs).toBe(1)`, `expect(sr.parent).toBeUndefined()`,
       `hostA._emitResize(80, 40)` → `sr.width` bleibt `0`. Danach wie bisher
       `sr.attach(hostB)`: `hostA._unsubs` bleibt `1`, `hostB._emitResize(80, 40)` →
       `[80, 40]`. Ein `OnAddToParent`-Spy (`vi.fn()`, vor dem `attach(hostA)` per `on()`
       angehängt) wird genau einmal gerufen — vom `attach(hostB)`. Vor dem Fix rot:
       `_unsubs` 0 statt 1.
     - **neu** »new StageRenderer(host) throws the error of a host whose onRenderFrame()
       throws, and the host keeps no subscription of it«: `makeHost({onRenderFrame: failure})`,
       `expect(thrownBy(() => new StageRenderer(host))).toBe(failure)`,
       `expect(host._unsubs).toBe(1)`. Vor dem Fix rot: 0.
     - **neu** »a host whose onResize() throws takes nothing: the renderer joins no holder and
       hands the error on«: `makeHost({onResize: failure})`, `sr = new StageRenderer()`,
       Spy auf `OnAddToParent`; `thrownBy(() => sr.attach(host))` ist `failure`,
       `sr.parent` ist `undefined`, der Spy nie gerufen, `host._unsubs` ist `0`. Vor dem Fix
       rot: `parent` antwortet den Host.
     - **neu** »a write to parent that meets a host whose onRenderFrame() throws hands its
       error on after those of the move out, and the renderer joins no holder«:
       `hostA = makeHost()`, `sr = new StageRenderer(hostA)`, `on(sr, OnRemoveFromParent,
       () => { throw eP; })`, Spy auf `OnAddToParent`, `hostB = makeHost({onRenderFrame: eS})`;
       `error = thrownBy(() => { sr.parent = hostB; }) as AggregateError` →
       `toBeInstanceOf(AggregateError)`, `error.message` ist die neue Meldung aus Schritt 2,
       `error.errors` ist `[eP, eS]`; `sr.parent` `undefined`, der Spy nie gerufen,
       `hostA._unsubs` `2`, `hostB._unsubs` `1`. Vor dem Fix rot: `eS` allein fliegt, `eP`
       geht verloren.
     - **neu** »an unsubscribe that throws while the renderer gives back what a refusing host
       handed out joins the error of the host«: `makeHost({onRenderFrame: eS,
       unsubscribeResize: eU})`, `sr = new StageRenderer()`; `thrownBy(() => sr.attach(host))`
       ist ein `AggregateError` mit `errors` `[eS, eU]` und der neuen Meldung,
       `host._unsubs` `1`, `sr.parent` `undefined`. Vor dem Fix rot: `eS` allein.
  2. **Fix in `StageRenderer.ts` — Rückbau, nicht Stehenbleiben** (Begründung unter
     »Entscheidung in Zug 0«):
     - Neue private Methode direkt vor `#addToHost()`, die Schleife aus
       `#removeFromParent()` (`:319–327`) zieht dorthin um, wörtlich:
       ```ts
       // gives up every subscription booked at the host. Each handle is asked on its own,
       // and what one throws waits for the caller like the error of a listener
       #unsubscribeFromHost(errors: unknown[]): void {
         const hostSubscriptions = this.#hostSubscriptions;
         this.#hostSubscriptions = [];
         for (const unsubscribe of hostSubscriptions) {
           try {
             unsubscribe();
           } catch (error) {
             errors.push(error);
           }
         }
       }
       ```
       In `#removeFromParent()` ersetzt `this.#unsubscribeFromHost(errors);` die Zeilen
       `:319–327`; der Kommentar darüber (`:315–318`) verliert nur seinen letzten Satz
       »Each handle is asked on its own, and what one throws waits for the caller like the
       error of a listener« (steht jetzt an der neuen Methode) und wird auf ≤ 90 umbrochen.
     - `#addToHost()` bekommt die Signatur `#addToHost(host: IStageRendererHost, errors:
       unknown[]): boolean` und diese Form (die beiden Handler-Körper bleiben wörtlich):
       ```ts
       // each handle is booked as soon as the host hands it out. A host that throws on
       // either subscription gets back what it handed out and holds nothing of this
       // renderer; its error waits for the caller. Answers whether the host took both
       #addToHost(host: IStageRendererHost, errors: unknown[]): boolean {
         try {
           this.#hostSubscriptions.push(host.onResize(/* unverändert */));
           this.#hostSubscriptions.push(host.onRenderFrame(/* unverändert */));
           return true;
         } catch (error) {
           errors.push(error);
           this.#unsubscribeFromHost(errors);
           return false;
         }
       }
       ```
     - `set parent` (`:284–303`): der Block nach `this.#removeFromParent(errors);` wird zu
       ```ts
       // a listener of the move out can have disposed this renderer or given it another
       // holder: the move ends here then
       if (!this.#disposed && this.#parent === undefined && parent) {
         this.#parent = parent;
         if (this.#addToHost(parent, errors)) {
           try {
             emitStrict(this, OnAddToParent);
           } catch (error) {
             errors.push(error);
           }
         } else {
           // a host that refused a subscription does not hold this renderer
           this.#parent = undefined;
         }
       }
       ```
       `#parent` wird wie bisher *vor* `#addToHost()` gesetzt — die Reihenfolge bleibt, nur
       der Rückbau kommt dazu. Die Meldung von `throwCollected` (`:302`) wird zu
       `'StageRenderer#parent: more than one listener of OnRemoveFromParent, OnStageRemoved and OnAddToParent or subscribe or unsubscribe at a host threw'`.
       Die zwei Specs, die die alte Meldung prüfen (`:1300`, `:1426`), ziehen mit.
     - Kommentar am Feld `#hostSubscriptions` (`:126–129`): nach »…given up by
       #removeFromParent() before OnRemoveFromParent goes out« einschieben », or by
       #addToHost() itself when the host refuses one of them,«; der Rest bleibt, Absatz auf
       ≤ 90 umbrechen.
     - TSDoc von `parent` (`:252–269`): nach `:269` ein neuer Absatz, die bestehenden
       Absätze bleiben wie sie sind, neuer Text bei ≤ 90:
       ```
        *
        * A host whose `onResize()` or `onRenderFrame()` throws as this renderer joins it
        * holds nothing of it: the renderer gives back the subscription the host had handed
        * out and joins no holder — `parent` answers `undefined`, and `OnAddToParent` does
        * not go out. The error of the host joins those of the move out, after them, and an
        * unsubscribe that throws while the renderer gives back joins after it.
       ```
     - TSDoc des Konstruktors (`:362–366`): ans Ende, vor `*/`, der Satz
       `A host that throws as the renderer subscribes makes the constructor throw that
       error and keeps no subscription of the renderer, see {@link parent}.` — bei ≤ 90
       umbrochen, im Rhythmus der drei Zeilen darüber.
  3. **`packages/twopoint5d/src/stage/README.md`.**
     - »Custom host« (`:605–610`): hinter dem Absatz ein neuer Absatz:
       `A host whose onResize() or onRenderFrame() throws as the renderer joins it holds
       nothing of it: the renderer gives back what the host had handed out and joins no
       holder — parent answers undefined, and OnAddToParent does not go out — and the error
       reaches the caller with those of the move out, after them. new StageRenderer(host)
       throws it.` — mit Backticks um `onResize()`, `onRenderFrame()`, `parent`,
       `undefined`, `OnAddToParent`, `new StageRenderer(host)`; umbrochen bei ≤ 88.
     - **Umbruch.** Jeder Absatz und jeder Listenpunkt mit einer Prosazeile über 88 Zeichen
       wird neu auf ≤ 88 umbrochen, im ganzen File (heute 39 Zeilen, u. a. `:556`, `:561`,
       `:566–580`, `:606–607`, `:631–651`, `:660–684`). Ausgenommen: Tabellenzeilen (`|…`),
       Codeblöcke und `:281`, eine Zeile, die nur aus einem Link besteht und sich nicht
       trennen lässt. Kein Wort ändert sich außer im neuen Absatz. Keine umbrochene Zeile
       darf mit `-`, `+`, `*`, `>`, `#` oder `<Ziffer>.` beginnen (Markdown läse sie als
       neuen Block) — dann ein Wort mehr auf die Zeile davor. Fortsetzungszeilen eines
       Listenpunkts behalten ihre zwei Leerzeichen Einzug. Gemessen wird in Zeichen, nicht
       Bytes (macOS-`awk` zählt Bytes, die Gedankenstriche sind drei Bytes):
       `perl -CSD -ne 'chomp; if (/^\s*```/) {$f=!$f; next} next if $f || /^\|/; print "$.: ".length($_)."\n" if length($_) > 88' packages/twopoint5d/src/stage/README.md`
       — danach nur noch `281: 101`.
  4. **`packages/twopoint5d/CHANGELOG.md`**, `[Unreleased]` → `### Fixed`, ein neuer Bullet
     direkt nach `:351` (»fix `StageRenderer` leaving a host: …«), eine Zeile wie seine
     Nachbarn:
     `- fix \`StageRenderer\` joining a host whose \`onResize()\` or \`onRenderFrame()\` throws: the renderer gives back the subscription the host had already handed out and joins no holder — \`parent\` answers \`undefined\`, and no \`OnAddToParent\` goes out —, and the error reaches the caller together with those of the move out of the previous holder, after them. \`new StageRenderer(host)\` throws it and leaves the host no subscription of a renderer nobody holds`
     Kein Migration-Guide-H4: das betrifft nur einen eigenen Host, der beim Abonnieren wirft;
     `Display` tut das nie. Skill `updating-changelog` laden.
  5. **`packages/twopoint5d/README.md`** (Breite ≤ 88, gilt seit Paket 8):
     - `:36` `…like position, normal, colors, etc..` → `…like position, normal, colors,
       etc.`; `:37` `primtives` → `primitives`.
     - `:44–46` ersetzen durch: `Such a geometry almost always needs a material of its own,
       since the built-in materials of three.js know nothing of custom attributes. In this
       library that is a \`NodeMaterial\` whose shader is written in TSL (\`three/tsl\`) and
       reads the attributes through \`attribute()\` nodes, as the sprite materials under
       [src/sprites/](src/sprites/) do.` — umbrochen ≤ 88. (Belegt:
       `TexturedSpritesMaterial extends NodeMaterial`, `src/sprites/node-utils.ts:30`
       `attribute('position')`; Root-`README.md:51` sagt dasselbe in derselben Form.)
     - `:48–50` `…without worrying too much about low-level three.js/WebGL details.` →
       `…without worrying too much about the buffer attributes of three.js underneath.` —
       Absatz ≤ 88 neu umbrechen.
     - `:55` die Zeile aus zwei Leerzeichen wird eine leere Zeile.
  6. **Das Browser-Testpaket beim Namen der Backends** (Quelle: `docs/architecture.md:170–175`,
     je nach Browser WebGPU oder WebGL 2):
     - `AGENTS.md:16` (Tabelle, keine Breitenregel) `browser/WebGL integration tests` →
       `browser integration tests, under WebGPU or WebGL 2 depending on the browser`.
     - `AGENTS.md:107` `(real browsers, visual/WebGL)` → `(real browsers, visual, under
       WebGPU or WebGL 2)`; der Listenpunkt `:106–108` bis `rendering or GPU-buffer code
       needs both.` wird auf ≤ 88 neu umbrochen, der Rest des Punkts ab `:109` bleibt.
     - `docs/architecture.md:15` (Tabelle) `browser/WebGL integration tests` → `browser
       integration tests, under WebGPU or WebGL 2`.
  7. **`docs/architecture.md:52–55`** (Breite ≤ 90, gilt seit Paket 4) — der Absatz wird zu,
     wortgleich, nur neu umbrochen:
     ```
     Per-project `inputs` narrow the cache key further. The library's `build` input list
     excludes `*.spec.ts`, `*.bench.ts` and `src/testing/` — tests, benches and their helpers
     do not invalidate a build, which is also why `pnpm build` alone never type-checks the
     tests and `pnpm typecheck` exists separately.
     ```
  8. **`.github/workflows/deploy.yml:12–14`** — GitHub hält in einer Concurrency-Gruppe
     ohne weiteres nur *einen* wartenden Lauf; ein neuer verdrängt ihn (bricht ihn ab).
     `queue: max` (GitHub Changelog 2026-05-07, Docs »Control the concurrency of workflows
     and jobs«: Werte `single` — Vorgabe — und `max`, bis zu 100 wartende Läufe, mit
     `cancel-in-progress: true` ein Validierungsfehler, auf Workflow- und Job-Ebene) lässt
     sie warten. Der Block wird zu:
     ```yaml
     concurrency:
       # one deploy at a time. By default a group keeps a single run waiting and a newer
       # run cancels it, so a version bump whose deploy waited behind another would never
       # be published; queue: max lets up to 100 runs wait their turn
       group: deploy
       cancel-in-progress: false
       queue: max
     ```
     Kommentarzeilen ≤ 90 (gilt seit Paket 4 für die Workflows). Dazu in
     `docs/architecture.md` §4 hinter `:257` (»…the one kind of run that may name the commit
     to publish.«), im selben Absatz, ≤ 90 umbrochen: `The runs share the concurrency group
     \`deploy\` with \`queue: max\`: one deploy runs at a time and the others wait their
     turn, up to 100 of them, where the default would keep one waiting run and let a newer
     one cancel it — a version bump whose deploy waits behind another would never be
     published.`
  9. **`scripts/ci/nxCacheServer.mjs:20–25`** — Test zuerst, in
     `scripts/ci/nxCacheServer/nxCacheServer.test.mjs` (Imports `node:fs`, `node:os`,
     `node:path` dazu):
     ```js
     it('prints the usage line alone for a port that is no whole number from 0 to 65535, and creates no --dir: exit code 1', () => {
       const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'nx-cache-server-'));
       const dir = path.join(parent, 'cache');
       try {
         for (const port of ['70000', '65536', '-1', '']) {
           const {status, stderr} = run(['--dir', dir, `--port=${port}`]);
           assert.equal(status, 1, `--port=${port}: ${stderr}`);
           assert.match(stderr, /^usage: [^\n]*\n$/, `--port=${port}`);
           assert.equal(fs.existsSync(dir), false, `--port=${port} created --dir`);
         }
       } finally {
         fs.rmSync(parent, {recursive: true, force: true});
       }
     });
     ```
     Vor dem Fix rot bei `70000` (Stacktrace `ERR_SOCKET_BAD_PORT`, `--dir` angelegt); `''`
     ergäbe Port 0 und einen Server, der bis zum Timeout von 10 s lauscht — der rote Lauf
     darf so lange dauern. Dann der Fix: `const port = Number(values.port);` bleibt, darunter
     ```js
     // server.listen() takes a whole number from 0 (any free port) to 65535 and throws on
     // anything else — past the 'error' handler below, after --dir is created
     const portIsValid = /^\d+$/.test(values.port ?? '') && port <= 65535;
     ```
     und die Bedingung wird `if (!values.dir || !portIsValid || !token) {`. Kein neuer Text
     in `USAGE`: ein fehlendes `--dir` gibt heute auch die Usage allein aus, und der
     vorhandene Test `:24–28` hält das. `scripts/`-Typecheck (`checkJs`) muss grün bleiben.
  10. **`packages/twopoint5d-testing/test/pan-control-dispose.test.js:93–95`** — gedrückt
      wurden vier Tasten (`:76–79`), losgelassen wird eine. Die drei Zeilen werden zu:
      ```js
          // every key that went down goes up again and the pointer lets go, as in the other
          // tests of these files, so nothing is left pressed for the next control
          key('keyup', KEY_NORTH);
          key('keyup', KEY_SOUTH);
          key('keyup', KEY_WEST);
          key('keyup', KEY_EAST);
          pointer('pointerup', {x: 30, y: 10, buttons: 0});
      ```
      Vorbild ist `pan-control-keys.test.js:5` (»every keydown a test sends is followed by
      its keyup, so no key stays held for the next control«).
- Proben (Ausgabe in den Report):
  1. Stage-README-Breite — das `perl`-Kommando aus Schritt 3: nur `281: 101`.
  2. Stage-README ohne Wortänderung außer »Custom host« —
     `git diff --word-diff=porcelain packages/twopoint5d/src/stage/README.md | grep -E '^[-+][^-+]'`
     zeigt nur Wörter des neuen Absatzes.
  3. Library-README — `grep -n -E 'primtives|etc\.\.|fragment shaders|WebGL details|^[[:space:]]+$' packages/twopoint5d/README.md`
     leer; `perl -CSD -ne 'chomp; print "$.: ".length($_)."\n" if length($_) > 88 && !/^\|/' packages/twopoint5d/README.md AGENTS.md`
     nennt keine Zeile, die dieses Paket geschrieben hat.
  4. WebGL-Namen — `git ls-files '*.md' | grep -v -e CHANGELOG -e '^docs/remediation' | xargs grep -n -i webgl | grep -v -e 'WebGL 2' -e WebGL2 -e WebGLRenderer -e webgl2`
     nennt nur noch `README.md:30` (Geschichte), `README.md:56`,
     `packages/twopoint5d/docs/resource-lifecycle.md:39–40` und
     `packages/twopoint5d/src/stage/README.md` (»Under WebGL its context …«) — alle meinen
     das Backend, nicht das Testpaket.
  5. `docs/architecture.md` — `perl -CSD -ne 'chomp; if (/^\s*```/) {$f=!$f; next} next if $f || /^\|/; print "$.: ".length($_)."\n" if length($_) > 90' docs/architecture.md` leer.
  6. Workflow-Struktur (lokal gibt es weder `act` noch `actionlint`):
     `node --input-type=module -e "import {parse} from 'yaml'; import fs from 'node:fs'; const w = parse(fs.readFileSync('.github/workflows/deploy.yml', 'utf8'), {strict: true, uniqueKeys: true}); console.log(JSON.stringify(w.concurrency), Object.keys(w.jobs).join(' '))"`
     → `{"group":"deploy","cancel-in-progress":false,"queue":"max"} version build publish tag`;
     Kommentarbreite `perl -CSD -ne 'chomp; print "$.: ".length($_)."\n" if length($_) > 90' .github/workflows/deploy.yml` leer.
- Verify: `pnpm run ci`, dazu die Proben 1–6
- Regressionstests: die fünf Tests aus Schritt 1 (StageRenderer, je vor dem Fix rot) und
  der Port-Test aus Schritt 9 (vor dem Fix rot). Doku, Workflow und Browser-Test-Kommentar
  haben keinen Test; ihr Beleg sind die Proben.
- Commit: `fix: let a StageRenderer give back what a host that throws as it subscribes has
  handed out and join no holder, with the error of that host handed on after those of the
  move out, let the deploy workflow queue its runs so a version bump waiting behind another
  deploy still gets published, let the Nx cache server refuse a port that is no whole number
  from 0 to 65535 with its usage line before it creates its directory, say in the library
  README that the materials of a vertex-object geometry are TSL node materials and fix its
  typos, name the backends of the browser tests, let the dispose test of PanControl2D release
  every key it pressed, and rewrap the stage docs and a paragraph of the monorepo docs that
  outgrew their width` — eine Zeile; `fix` ohne Scope, weil das Paket Library, Workflows,
  Skripte und Doku zugleich trägt (wie `c301a1e5`)
- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · alle neun Queue-Einträge bestehen, verschoben:
    `StageRenderer.ts:286–289` jetzt `set parent` `:275–304` samt `#addToHost()`
    `:346–359` und Konstruktor `:367–372`; `packages/twopoint5d/README.md:35` jetzt
    `:36–37`; die übrigen an ihren Zeilen · dazu aus Zug 0 `README.md:55` (Zeile aus
    Leerzeichen, gleiche Ursache wie `:36–37`) · `queue: max` als GitHub-Feature geprüft ·
    offene Folgen: keine (alle unter erledigten Paketen schon verteilt)
  - 2026-09-30 Zug 1: Implementierer beauftragt (sonnet, medium) · Brief
    `paket-12.impl-0.brief.txt`, Report `paket-12.impl-0.json`
  - 2026-09-30 Zug 2: `impl-0` endete ohne Report (wartete auf Hintergrund-CI), per
    `--resume` nachgeholt als `paket-12.impl-0-versuch-2.json` · FERTIG_MIT_VORBEHALT
    (Probe 6: drei `run:`-Zeilen über 90 in `deploy.yml`, keine Kommentare, vorbestehend) ·
    11 Dateien geändert · rot vor dem Fix: 5 StageRenderer-Tests, Port-Test · Arbeitsbaum
    schmutzig · Verify `paket-12.verify.log` exit=0, Proben 1–7 wie erwartet
  - 2026-09-30 Zug 3: Reviewer beauftragt (opus, medium), Diff `paket-12.diff`
  - 2026-09-30 Zug 3: Report `paket-12.review-0.json` · alle 15 Posten erfüllt, nichts
    kritisch oder wichtig, vier klein (unten) · Freigabe
  - 2026-09-30 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-30 Zug 5: committet f1b770e7 (Trailer `Remediation-Run: 2026-09-30`), Verify
    `paket-12.verify.log` exit=0 aus Zug 2 (danach keine Codeänderung), Arbeitsbaum sauber

## Rahmen für den Implementierer

Ein Drain-Paket mit einem echten Fix (`StageRenderer`), einem kleinen Fix mit Test
(Cache-Server), einer Workflow-Zeile und Doku. Konventionen aus dem Plan-Kopf gelten,
insbesondere: Kommentare erklären das Warum, keine Finding-IDs, kein Satz über den
Vorzustand (»now«, »no longer«, »instead of before« gehören nicht in Code, TSDoc, README
oder CHANGELOG-Text — der CHANGELOG-Bullet sagt, was gilt). `pnpm lint` enthält
`prettier --check .` mit `printWidth: 130` für Code; Markdown ist von Prettier
ausgenommen (`.prettierignore: *.md`), seine Breite prüfen die Proben.

Nicht mitnehmen:
- Wiedereintritt während des Abonnierens (ein Host, der den Handler schon im
  `onResize()` ruft, und ein Listener, der dabei `parent` schreibt) — eigener Fall, nicht
  Teil dieses Befunds; die Reihenfolge »`#parent` setzen, dann abonnieren« bleibt.
- Die Kommentarbreite der Browser-Tests: sie folgen `printWidth` 130 (309 Kommentarzeilen
  über 90 in `packages/twopoint5d-testing/test/`, keine aus diesem Lauf). Die neuen
  Kommentarzeilen aus Schritt 10 halten ≤ 90.
- `add()`, `remove()`, `dispose()` und ihre Sammelmeldungen.

## Entscheidung in Zug 0: Rückbau statt Stehenbleiben

Der Queue-Eintrag lässt beide Wege offen (»die Buchung aus Paket 10 hält unter Rückbau wie
unter Sammeln«). Gewählt ist der Rückbau: der Renderer gibt zurück, was der Host schon
herausgegeben hat, tritt keinem Halter bei, `parent` antwortet `undefined`, kein
`OnAddToParent`; der Fehler wird gesammelt und nach denen des Auszugs geworfen. Gründe:

- Nur der Rückbau schließt den Konstruktor-Fall. `new StageRenderer(host)` muss werfen,
  wenn der Host wirft — beim bloßen Sammeln bliebe das `onResize()`-Abonnement mit einem
  Renderer am Host, den niemand mehr erreicht.
- Ein Renderer, der `parent === host` antwortet, aber vom Host nur halb (nur Resize) oder
  gar nicht getrieben wird, ist ein Zustand, den kein Aufrufer sieht.
- Es ist die Regel, die `add()` schon hat: ein Halter, der verweigert (dort die Größe),
  nimmt den Renderer nicht auf. Der Auszug aus dem alten Halter ist beim Abonnieren schon
  geschehen und bleibt, wie bei einem Listener, der den Umzug beendet.
- Der Vertrag »der Aufruf läuft zu Ende, die Fehler kommen danach, einer unverändert,
  mehrere als `AggregateError` in der Reihenfolge ihres Entstehens« gilt unverändert; das
  Ziel im Plan (»nach demselben Vertrag wie die übrigen Fehler eines Umzugs«) ist damit
  erfüllt, keine Entscheidung wird gekippt.

`queue: max` statt eines Umbaus des Deploys (Gruppe je Version auf Job-Ebene o. ä.): eine
Zeile, und die Serialisierung bleibt — zwei Deploys verschiedener Versionen nebeneinander
könnten `latest` auf npm auf die ältere setzen. GitHub nennt die Reihenfolge der wartenden
Läufe FIFO ohne Garantie; das Verdrängen, um das es geht, ist damit ausgeschlossen.

## Abgleich

- **`StageRenderer.ts:286–289`** (low) — besteht, verschoben: `set parent` `:275–304`,
  `this.#parent = parent` `:290` vor `this.#addToHost(parent)` `:292` ohne `try`; wirft der
  Host, fliegt der Fehler ungesammelt, `throwCollected` `:300` wird nie erreicht.
  `#addToHost()` `:346–359` bucht jeden Handle einzeln (Paket 10). Konstruktor `:367–372`
  geht über den Setter. `Display` wirft beim Abonnieren nie: `onResize`/`onRenderFrame`
  (`Display.ts:2046–2048`) sind `on()` von eventize, und eventize 6.2.0 fängt einen
  Listener, der beim Replay des gehaltenen `OnDisplayResize` wirft, selbst ab
  (`docs/retain.md` »A listener that throws on a replay«: `console.warn`, kein Rethrow).
  Nur ein eigener `IStageRendererHost` wirft. Vorbestehend laut Queue (5738b5e5~1, 0.21.2).
- **`packages/twopoint5d/README.md:44`/`:50`** (low) — unverändert an `:44–46` und `:50`.
- **`packages/twopoint5d/README.md:35`** (info) — besteht, jetzt `:36` (»etc..«) und `:37`
  (»primtives«).
- **Neu aus Zug 0: `packages/twopoint5d/README.md:55`** — eine Zeile aus zwei Leerzeichen
  mitten im `vertex-objects`-Abschnitt; Prettier prüft kein Markdown, deshalb unbemerkt.
  info, gleiche Ursache wie `:36–37` (Schreibfehler im selben Abschnitt), vorbestehend
  (6861f3d0). Ins Paket.
- **`AGENTS.md:16`, `:107`, `docs/architecture.md:15`** (info) — unverändert. Eine Suche
  über alle getrackten `.md`, `.json`, `.yml` fand keine weitere Stelle, die das
  Testpaket »WebGL« nennt; die übrigen Treffer meinen das Backend (Probe 4).
- **`docs/architecture.md:52–55`** (info) — unverändert, `:54` mit 57 Zeichen.
- **`packages/twopoint5d/src/stage/README.md:556ff`** (info) — besteht: 25 Prosazeilen über
  90, 39 über 88. Zielbreite 88 wie die übrigen Library-Docs (Schnittstelle aus Paket 8);
  ein Umbruch nur der Zeilen über 90 ließe Absätze mit 89/90 daneben stehen. `:281` ist
  eine Zeile aus einem einzigen Link, 101 Zeichen, untrennbar — ausgenommen wie die zwei
  Links in `resource-lifecycle.md` in Paket 8.
- **`pan-control-dispose.test.js:93`** (info) — unverändert an `:93–95`; die Konvention
  steht in `pan-control-keys.test.js:5`.
- **`deploy.yml:12–14`** (low) — unverändert. `queue: max` ist seit 2026-05-07 auf
  GitHub verfügbar (Changelog »GitHub Actions concurrency groups now allow larger queues«;
  Docs: `single` Vorgabe, `max` bis 100, nicht mit `cancel-in-progress: true`).
  `docs/architecture.md` §4 nennt die Concurrency-Gruppe des Deploys bisher nicht.
- **`nxCacheServer.mjs:22`** (info) — unverändert; die Prüfung steht vor `fs.mkdirSync`
  (`:27`), greift aber nicht für 70000. Port 0 ist gewollt: der `listen`-Callback liest den
  tatsächlichen Port aus `server.address()`, und die Tests rufen `--port 0`. `''` ergäbe
  heute ebenfalls Port 0 — die Ziffernprüfung schließt das mit aus, gleiche Ursache.
- **Geprüft, kein Befund:** Kommentarzeilen über 90 in `pan-control-dispose.test.js`
  (`:6`, `:7` mit 108, …) stammen aus Commits vor diesem Lauf und folgen wie 309 weitere
  in den Browser-Tests `printWidth` 130; die Breitenregel des Laufs gilt seinen eigenen
  Zeilen.

## Triage

- Offene Folgen unter erledigten Paketen: keine. Paket 1, 2, 3, 4, 6 und 10 haben ihre
  Folgen in früheren Zügen 0 verteilt, Paket 5, 7, 8, 9 und 11 haben keine.
- »Offene Befunde«: die neun Einträge mit »geht in Paket 12 (Drain)« sind dieses Paket.
  Der übrige offene Eintrag (`PanControl2D.ts:126`, `coordsTarget`, → Rückfrage) geht laut
  »Entscheidungen« (Drain, 2026-09-30) beim Abschluss ins Audit und teilt keine Ursache
  mit diesem Paket.

## Restplan

Paket 12 ist das letzte offene Paket. Nichts zu verschieben, zu teilen oder
zusammenzulegen; »Hängt ab von« bleibt leer. Nach dem Commit bleibt in »Offene Befunde«
nur der `coordsTarget`-Eintrag, den der Abschluss ins Audit bucht.

## Urteil des Reviewers (Zug 3, `paket-12.review-0.json`)

Alle Posten behoben:

- `StageRenderer.ts` `set parent` — behoben: `#addToHost(parent, errors)` mit Rückbau
  (`#parent = undefined`), `#unsubscribeFromHost()` wie geplant, neue Sammelmeldung, die zwei
  Alt-Specs (`:1300`, `:1426`) mitgezogen
- Konstruktor — behoben: Test »new StageRenderer(host) throws …« prüft `_unsubs === 1`,
  TSDoc-Satz am Konstruktor
- Feldkommentar `#hostSubscriptions`, TSDoc `parent` — behoben, wortgleich mit dem Plan
- Tests — behoben: `StageRenderer.spec.ts:127–131` (`makeHost` mit `onResize`), `:1373–1467`
  (ein umgebauter, vier neue, alle mit `thrownBy()`, Reihenfolgen `[eP, eS]`, `[eS, eU]`)
- `packages/twopoint5d/README.md` `:36–37` (`etc.`, `primitives`), `:44–48` (TSL/`NodeMaterial`),
  `:50–53` (»buffer attributes of three.js underneath«), `:58` (leere Zeile) — behoben
- `AGENTS.md:16`/`:106–108`, `docs/architecture.md:15` — behoben, Wortlaut wie im Plan
- `docs/architecture.md:52–55` — behoben, wortgleich neu umbrochen
- `stage/README.md` — behoben: nur `281: 101` über 88, neuer Absatz »Custom host« `:615–619`
- `pan-control-dispose.test.js:93` — behoben: vier `keyup`, dann `pointerup`
- `deploy.yml:12–18` `queue: max` und §4-Satz `architecture.md:257–260` — behoben
- `nxCacheServer.mjs:21–25` Portprüfung samt Test (`70000`, `65536`, `-1`, `''`) — behoben
- `CHANGELOG.md:352` Fixed-Bullet — behoben, wortgleich

Kleine Befunde (lösen keine Runde aus):

- `StageRenderer.spec.ts:128` — Kommentarzeile an `makeHost()` mit 93 Zeichen, über der
  Kommentarbreite des Laufs; `count` gehört an den Anfang von `:129`
- `packages/twopoint5d/README.md:44–48`, `:52–53` — Umbruch nicht greedy, eine Zeile mit
  11 Zeichen (≤ 88 eingehalten)
- `StageRenderer.ts` Kommentar an `#hostSubscriptions` — durch den geplanten Einschub bezieht
  sich »that event« nicht mehr eindeutig auf `OnRemoveFromParent`
- `stage/README.md:608–610` — der Absatz vor dem neuen sagt, der Renderer rufe jedes
  Unsubscribe »once when it leaves the host«; den Rückbau beim Beitritt nennt erst der
  neue Absatz

Anmerkung aus Zug 2: Probe 6 nennt drei `run:`-Zeilen über 90 in `deploy.yml` (`:98`,
`:175`, `:182`, aus 5a413417) — Shellzeilen, keine Kommentare; die Probe galt der
Kommentarbreite, kein Befund.
