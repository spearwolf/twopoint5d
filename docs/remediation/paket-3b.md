# Paket 3b — Typecheck: Browsertests und markierte Doku-Snippets

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TYPE-014 (low), CFG-014 (low)
- Abgespalten aus: Paket 3 (dessen Zug 0, 2026-09-21; Messwerte dort im Abschnitt »Übergabe an 3b«, hier auf `e4dc0a95` neu gemessen)
- Ziel: `pnpm typecheck` prüft auch die Browsertests und jeden als selbsttragend markierten ```ts-Block der Doku gegen die gebaute Bibliothek.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d-testing/tsconfig.json` (neu)
  - `packages/twopoint5d-testing/package.json` (Script `typecheck`, devDependency `@types/mocha`)
  - `packages/twopoint5d-testing/project.json` (Target `typecheck` mit `dependsOn` und `inputs`)
  - `pnpm-lock.yaml` (nur durch `pnpm install` nach der devDependency)
  - `packages/twopoint5d-testing/test/*.test.js` — JSDoc und Casts nach dem Fehlerkatalog unten, betroffen 15 Dateien: `display-constructor`, `display-dispose`, `display-resize`, `hello-twopoint5d-canvas`, `pan-control-cursor`, `pan-control-stylesheet-root`, `stage-pipeline`, `stage-renderer`, `stylesheets`, `texture-store-on`, `vertex-objects-buffers-data`, `vertex-objects-dispose`, `vertex-objects-gpu-upload`, `vertex-objects-heap` (und jede weitere, in der nach einem Fix ein Folgefehler auftaucht)
  - `scripts/checkDocSnippets.mjs` (neu, CLI)
  - `scripts/checkDocSnippets/extractSnippets.mjs`, `scripts/checkDocSnippets/extractSnippets.test.mjs` (neu)
  - `scripts/checkDocSnippets/compileSnippets.mjs`, `scripts/checkDocSnippets/compileSnippets.test.mjs` (neu)
  - `packages/twopoint5d/src/stage/README.md` — genau zwei Fence-Zeilen, sonst nichts (Schritt 6)
  - `AGENTS.md`, `docs/architecture.md`
  - nicht anfassen: `nx.json`, Root-`package.json` (die Gate-Zeile `ci` und `typecheck` = `pnpm nx run-many -t typecheck` greifen das neue Target von selbst auf), `tsconfig.json` im Root, `eslint.config.mjs`, `.github/**`, `.claude/**`, `packages/twopoint5d/src/**/*.ts`, `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d/docs/**`, `packages/twopoint5d-testing/web-test-runner.config.js`, der Doc-Kommentar von `waitUntil` in `texture-store-on.test.js:32` (steht als eigener Befund in »Offene Befunde« des Plans — melden, nicht beheben)

- Vorgehen:
  1. **Typdeklarationen für Mocha.** In `packages/twopoint5d-testing/package.json` unter
     `devDependencies` `"@types/mocha": "^10.0.10"` eintragen (alphabetisch vor `@web/…`), dann
     `pnpm install` im Repo-Root. Kein chai-Shim, keine `paths`: `@esm-bundle/chai/chai.d.ts`
     macht `import chai from "chai"`, und das löst über die eigene Dependency von
     `@esm-bundle/chai` auf `@types/chai@4.3.20` auf (in Zug 0 mit `--traceResolution`
     nachgesehen: `node_modules/.pnpm/@esm-bundle+chai@4.3.4-fix.0/node_modules/@types/chai`,
     ein pnpm-Geschwisterlink, kein Hoist). Der Lockfile-Diff darf nur `@types/mocha` betreffen.
  2. **`packages/twopoint5d-testing/tsconfig.json`** (neu), JSONC wie die Root:
     ```jsonc
     {
       "extends": "../../tsconfig.json",
       "compilerOptions": {
         "allowJs": true,
         "checkJs": true,
         "noEmit": true,
         "noImplicitAny": false,
         "strictNullChecks": false,
         "types": ["mocha"]
       },
       "include": ["test"]
     }
     ```
     Darüber ein Kommentar (englisch, 3–5 Zeilen), der sagt, *warum* die zwei Schalter aus sind:
     die Tests sind JavaScript; unter der Strenge der Root bräuchte fast jede Fixture-Variable
     einen Cast, und diese Casts finden nichts. Unbekannte Member und falsche Argumentformen
     bleiben Fehler — dafür ist die Prüfung da. `types: ["mocha"]` hält Node- und Sinon-Globals
     aus Code heraus, der im Browser läuft.
  3. **Roter Lauf festhalten, bevor ein Test angefasst wird:** aus
     `packages/twopoint5d-testing` `pnpm exec tsc -p tsconfig.json`; Zug 0 hat mit genau dieser
     Konfiguration 81 Fehler gemessen (50 TS2339, 17 TS2345, 6 TS18048, 3 TS2488, 2 TS2722,
     2 TS2353, 1 TS2740). Anzahl und Exit-Code gehören in den Report — das ist der Beleg, dass die
     Prüfung etwas findet.
  4. **Die Tests typsauber machen**, ausschließlich mit JSDoc, `@import`-Tags und Casts nach
     dem Fehlerkatalog unten. Kein Laufzeitverhalten ändert sich: keine neuen Bedingungen,
     keine `instanceof`-Filter, keine anderen Properties, die ein Test liest, keine
     umbenannten Tests. Nach jedem Fix kann ein Folgefehler auftauchen, den der erste
     verdeckt hat (Beispiel: ist die Description typisiert, meldet `new VertexObjectPool(…)`
     ohne VO-Typ `setPosition` auf `VO`). Wiederholen, bis `pnpm exec tsc -p tsconfig.json`
     sauber ist. Zeigt ein Fehler, dass ein Test ein Member liest oder ruft, das die
     Bibliothek nicht hat, ist das genau der Fall, für den TYPE-014 existiert: den Test auf die
     echte API bringen, nicht wegcasten, und die Stelle im Report unter »Abweichungen« nennen.
     `// @ts-expect-error` nur dort, wo ein Test absichtlich ein falsches Argument übergibt,
     immer mit Begründung in derselben Zeile.
  5. **Nx-Target und Script.**
     - `packages/twopoint5d-testing/package.json`, Script neben `test`:
       `"typecheck": "pnpm tsc -p tsconfig.json && node ../../scripts/checkDocSnippets.mjs"`
       (`pnpm tsc` wie in der Bibliothek; `tsc` kommt aus dem Root.)
     - `packages/twopoint5d-testing/project.json`, Target neben `test`:
       ```json
       "typecheck": {
         "dependsOn": ["^build"],
         "inputs": [
           "{projectRoot}/test/**/*.js",
           "{projectRoot}/package.json",
           "sharedTsconfigs",
           "{workspaceRoot}/**/*.md",
           "{workspaceRoot}/scripts/checkDocSnippets.mjs",
           "{workspaceRoot}/scripts/checkDocSnippets/*.mjs",
           "!{workspaceRoot}/scripts/checkDocSnippets/*.test.mjs",
           {"dependentTasksOutputFiles": "**/*", "transitive": true}
         ]
       }
       ```
       Executor, `script` und `cache: true` kommen aus `targetDefaults.typecheck`. Die
       Bibliothek geht über ihre Build-Ausgabe ein, wie bei `lookbook:typecheck`; die
       Markdown-Dateien gehen ein, weil der Snippet-Check sie liest.
  6. **Zwei Blöcke markieren.** In `packages/twopoint5d/src/stage/README.md` die Fence-Zeile
     68 (Abschnitt »Hello world (auto-driven)«, `Display` + `Stage2D` + `StageRenderer`) und die Fence-Zeile 368
     (Abschnitt »Custom stages«, `class MyStage implements IStage, IRenderable`) von ```` ```ts ```` auf ```` ```ts check ````
     ändern, sonst keine Zeile der Datei. Das sind die beiden der 220 `ts`-Blöcke, die gegen den
     Build unverändert compilieren (Zug 0 gemessen, siehe »Entscheidungen«). Keine anderen Blöcke
     markieren, keinen Block umschreiben, um ihn markierbar zu machen.
  7. **Extraktor** `scripts/checkDocSnippets/extractSnippets.mjs`, reine Funktion, kein
     Dateisystem, kein TypeScript:
     `export function extractSnippets(markdown, file)` →
     `{snippets: Array<{file, line, indent, code}>, problems: Array<{file, line, message}>}`.
     - Öffnende Fence: `` ^(\s*)(`{3,})(.*)$ ``; die Info-Zeile (Gruppe 3, getrimmt) in Wörter an
       Whitespace teilen. Marker ist **genau** die Wortfolge `ts`, `check`. Enthält die
       Info-Zeile das Wort `check` in anderer Form (`js check`, `typescript check`,
       `ts check strict`), ist das ein `problem` (»unknown marker … — only `ts check` is
       checked«), damit ein vertippter Marker nicht still durchfällt.
     - Schließende Fence: gleiche Einrückung egal, nur Backticks, mindestens so viele wie die
       öffnende, sonst nichts auf der Zeile. Eine längere öffnende Fence (````` ```` `````)
       wird nicht von einer kürzeren inneren beendet. Alle Fences werden verfolgt, auch
       unmarkierte — sonst gilt ein `ts check` *innerhalb* eines anderen Codeblocks als Marker.
     - `line` = 1-basierte Zeilennummer der ersten Codezeile (Fence-Zeile + 1), `indent` =
       Länge der Einrückung der öffnenden Fence; von jeder Codezeile werden bis zu `indent`
       führende Leerzeichen entfernt (CommonMark-Verhalten für eingerückte Fences in Listen).
     - Eine markierte Fence ohne Ende ist ein `problem` mit der Zeile der Fence.
     - Nur Backtick-Fences; `~~~` wird ignoriert.
  8. **Compiler** `scripts/checkDocSnippets/compileSnippets.mjs`:
     `export function compileSnippets({snippets, anchorDir, tsconfigPath})` → Array von
     `{file, line, column, code, message}` (Diagnosen) und Diagnosen ohne Datei.
     - Compiler-Optionen: `ts.readConfigFile(tsconfigPath, ts.sys.readFile)` +
       `ts.convertCompilerOptionsFromJson(config.compilerOptions, path.dirname(tsconfigPath))`
       — nicht `parseJsonConfigFileContent`, das würde das ganze Repo nach Dateien absuchen
       (die Root-tsconfig hat kein `include`). Darüber: `noEmit: true`, `noUnusedLocals: false`,
       `noUnusedParameters: false`, `importHelpers: false`, `types: []`,
       `moduleDetection: ts.ModuleDetectionKind.Force`. Alles andere bleibt Root-Strenge —
       `strict`, `strictNullChecks`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`: genau an
       diesen Schaltern ist der Beispielcode laut Finding schon einmal vorbeigelaufen.
     - Jedes Snippet wird eine **virtuelle** Datei `path.join(anchorDir, '__doc_snippets__',
       `${index}.ts`)`; nichts wird auf die Platte geschrieben. Ein Compiler-Host auf Basis von
       `ts.createCompilerHost(options)` beantwortet `fileExists`, `readFile` und `getSourceFile`
       für diese Pfade aus dem Speicher und reicht alles andere durch. Weil der virtuelle Ordner
       in `anchorDir` liegt, lösen `@spearwolf/twopoint5d`, `three/webgpu`,
       `@spearwolf/eventize`, `@spearwolf/signalize` so auf wie für einen Konsumenten dort.
     - Ein Programm für alle Snippets (`ts.createProgram({rootNames, options, host})`),
       Diagnosen über `ts.getPreEmitDiagnostics(program)`. Diagnosen einer virtuellen Datei
       werden zurückgerechnet: `line = snippet.line + tsLine` (tsLine 0-basiert),
       `column = tsCharacter + 1 + snippet.indent`, `message` über
       `ts.flattenDiagnosticMessageText(d.messageText, '\n')`. Diagnosen anderer Dateien
       verwerfen (skipLibCheck steht ohnehin), Diagnosen ohne Datei durchreichen.
  9. **CLI** `scripts/checkDocSnippets.mjs`, Kopfkommentar im Stil von
     `scripts/checkNameableTypes.mjs` (was, warum, Aufruf):
     `node scripts/checkDocSnippets.mjs [file.md …]`.
     - `repoRoot = path.resolve(import.meta.dirname, '..')`; `anchorDir = process.cwd()` — das
       Nx-Target ruft es aus `packages/twopoint5d-testing`, dem Paket, das die Bibliothek und
       `three` als Konsument einbindet; der Kopfkommentar sagt das.
     - Ohne Argumente: `execFileSync('git', ['ls-files', '-z', '--', '*.md'], {cwd: repoRoot,
       encoding: 'utf8'})` — nur getrackte Dateien (ungetrackte Notizen, auch die dieses Laufs,
       bleiben draußen). Mit Argumenten: genau diese Dateien.
     - `tsconfigPath = path.join(repoRoot, 'tsconfig.json')`.
     - Ausgabe je Fehler auf stderr: `<pfad>:<line>:<column> - error TS<code>: <message>`,
       Pfad relativ zu `repoRoot`, wenn die Datei darin liegt, sonst absolut; `problems` des
       Extraktors im selben Format ohne TS-Code. Am Ende eine Zeile
       `<n> blocks marked "ts check" in <m> files, <k> errors` (stdout bei 0 Fehlern, sonst
       stderr).
     - Exit 0 ohne Fehler, 1 bei Typfehlern oder Marker-Problemen, 2, wenn `git` oder die
       tsconfig nicht zu lesen sind. Null markierte Blöcke sind kein Fehler.
  10. **Tests für die Helfer** (`node --test`, laufen über `pnpm test:scripts` im Gate; zuerst
      schreiben, rot sehen, dann implementieren — der rote Lauf gehört in den Report):
      - `extractSnippets.test.mjs`: findet einen Block mit dem Marker `ts check`, `line` = Fence + 1,
        den Code ohne Fences · ignoriert Blöcke mit der Info-Zeile `ts`, `js`, `json` · entfernt
        die Fence-Einrückung und meldet sie als `indent` · ein `ts check`-Marker innerhalb eines
        Blocks mit vier Backticks ist kein Marker · `js check` und `ts check strict` ergeben
        je ein `problem` mit Zeile · eine offene markierte Fence ergibt ein `problem`.
      - `compileSnippets.test.mjs` (braucht keinen Build, die Snippets importieren nichts;
        `anchorDir` = `packages/twopoint5d-testing`, `tsconfigPath` = Root-`tsconfig.json`):
        `const n: number = 'x';` an Zeile 10 mit `indent` 2 → genau eine Diagnose, Code 2322,
        Zeile 10, Spalte 9 · zwei Snippets, die beide `const a = 1;` deklarieren → keine
        Diagnose (jedes Snippet ist ein eigenes Modul) · eine unbenutzte Variable → keine
        Diagnose · `const xs: string[] = []; const s: string = xs[0];` → TS2322 (die
        Root-Strenge mit `noUncheckedIndexedAccess` gilt).
      - Kein Test importiert `scripts/checkDocSnippets.mjs` selbst (es liest beim Laden git
        und das Dateisystem) — wie bei `publishNpmPkg.mjs`.
  11. **Doku.**
      - `AGENTS.md`, Tabelle »Projects«, Zeile `packages/twopoint5d-testing`: die Rolle um
        »and the type check of the docs' marked code blocks« ergänzen.
      - `AGENTS.md`, Bullet `pnpm typecheck`: nennt zusätzlich die Browsertests und jeden
        mit `ts check` markierten Block der Markdown-Dateien, beide gegen die gebaute Bibliothek.
      - `AGENTS.md`, »Rules you cannot read off the code«, neuer Bullet nach »Two test
        surfaces«, Kern (englisch, eigene Worte): **Code blocks in Markdown.** A plain `ts` code
        block is an excerpt and nothing checks it. A block that stands on its own — imports
        everything it uses, declares everything it names — carries `ts check` as its info
        string, and
        `pnpm typecheck` compiles it as a module of its own against the built library under the
        root tsconfig (unused locals and parameters allowed). Released CHANGELOG sections are
        not marked after the fact; their blocks show the API of their release.
      - `AGENTS.md`, Bullet »Publishing«: der Satz zu `scripts/ci/` nennt als zweite Ausnahme
        `scripts/checkDocSnippets*` (prüft die Doku, veröffentlicht nichts).
      - `docs/architecture.md` §2: nach dem Absatz über die Konsumenten der Bibliothek ein
        Absatz zu `twopoint5d-testing:typecheck` — der eine Konsument, der Markdown liest:
        Browsertests über die tsconfig des Pakets (`checkJs`, `noImplicitAny` und
        `strictNullChecks` aus) und die markierten Blöcke über `scripts/checkDocSnippets.mjs`,
        beides gegen den Build; Inputs sind Build-Ausgabe, Tests, tsconfig, `package.json`, die
        Module des Checks und jede `*.md` des Repos. Der Satz davor (»a change to the library's
        specs, docs or CHANGELOG leaves them in the cache«) gilt für die drei dort genannten
        Targets weiter; der neue Absatz sagt, warum dieses eine anders ist.
      - `docs/architecture.md` §3, Bullet `typecheck`: um die Browsertests und die markierten
        Blöcke ergänzen. Bullet `test:scripts`: nennt auch die Helfer des Snippet-Checks.
      - `docs/architecture.md` §6: im Absatz zu `@web/test-runner` ein Satz, dass die
        `*.test.js` per `checkJs` typgeprüft werden, mit JSDoc, wo eine Fixture einen Typ
        braucht (VO-Interfaces, Descriptions); im Absatz zu `node --test` den Snippet-Check
        neben Publish-Pipeline und Cache-Server nennen.
      - Kein Rückblick auf den Vorzustand (»now«, »no longer«), keine Finding-IDs.
      - Den Marker in `AGENTS.md` und `docs/architecture.md` nur als Inline-Code schreiben
        (`` `ts check` `` bzw. mit doppelten Backticks um drei Backticks), nie als Zeile, die mit
        drei Backticks beginnt: beide Dateien sind getrackt, der Check läse ein solches Beispiel
        als markierten Block. Nach dem Schreiben mit `grep -nE '^\s*```' AGENTS.md
        docs/architecture.md` nachsehen.

- Fehlerkatalog (Probe auf `e4dc0a95`, Konfiguration wie Schritt 2, 81 Fehler). Muster in
  Zug 0 an Kopien in einer Probe außerhalb des Repos gegen `tsc` 5.9.3 geprüft:
  - **Vertex-Object-Descriptions und VO-Typen** — `vertex-objects-buffers-data:71,76`,
    `vertex-objects-dispose:121–175,235,266–267`, `vertex-objects-gpu-upload:117–274`,
    `vertex-objects-heap:110–112` (TS2345 auf der Description, TS2339 `setPosition`,
    `setInstanceOffset`, `setColor`, `setExtraOffset` auf `VO`). Je Datei oben:
    ```js
    /** @import {VO, VOAttrSetter, VertexObjectDescription} from '@spearwolf/twopoint5d' */
    /** @typedef {VO & {setPosition: VOAttrSetter}} QuadVO */
    ```
    (weitere Typedefs nur, wo die Datei sie braucht: `InstanceVO` mit `setInstanceOffset`,
    `ExtraVO` mit `setExtraOffset`, für die Datei mit `color` eine mit `setPosition` und
    `setColor`). Jede Description, auch die lokalen (`gpu-upload:230`), bekommt
    `/** @type {VertexObjectDescription} */`. Geometrien und Pools über den Kontexttyp der
    Deklaration: `/** @type {VertexObjectGeometry<QuadVO>} */ const geometry = new
    VertexObjectGeometry(quadDescription, 8);`,
    `/** @type {InstancedVertexObjectGeometry<InstanceVO, QuadVO>} */`,
    `/** @type {VertexObjectPool<QuadVO>} */ const source = new VertexObjectPool(…)`, der Pool
    aus `attachInstancedPool` als `/** @type {VertexObjectPool<ExtraVO>} */`. Probe: ein
    vertipptes `setPositon` meldet danach TS2551 »Did you mean 'setPosition'?«.
  - **TSL `attribute(…).add(…)`** — `vertex-objects-dispose:154,171,217`,
    `vertex-objects-gpu-upload:190`, `vertex-objects-heap:95` (TS2339 `add` auf
    `AttributeNode<string>`). `@types/three` weitet `'vec3'` zu `string`, auch in TypeScript.
    Nur der Empfänger bekommt die Const-Assertion:
    `attribute('position', /** @type {const} */ ('vec3')).add(attribute('instanceOffset', 'vec3'))`.
  - **`let` ohne Typ, belegt in einem Callback** — `stage-pipeline:121,146,153,154`
    (`lastPasses`), `display-dispose:228` (`releaseInit`), `:316` (`releaseCallback`),
    `:321–322` (`rejection`), `texture-store-on:152,292,360` (`tuple`, `payload`). JSDoc am
    `let`: `/** @type {() => void} */ let releaseInit;`,
    `/** @type {[Texture, TextureCoords] | undefined} */ let tuple;` (Tupel in der Reihenfolge
    der angefragten Schlüssel, Typen aus den vorhandenen Imports), `lastPasses` als
    `/** @type {PassNode[] | undefined} */` mit Cast bei der Zuweisung
    `lastPasses = /** @type {PassNode[]} */ (passes);` (Stage2D liefert Pass-Nodes, der
    Callback-Parameter ist nur als `Node[]` getypt).
  - **`catch`-Variable ist `unknown`** — `display-dispose:120–121,355–356` (`error.message`),
    ebenso `rejection` oben. `/** @type {Error | undefined} */ let error;` und im `catch`
    `error = /** @type {Error} */ (err);`. `useUnknownInCatchVariables` bleibt an.
  - **`CSSRule` statt `CSSStyleRule`** — `pan-control-cursor:156,177`,
    `pan-control-stylesheet-root:7,37`, `stylesheets:15,53,111,153`. In den drei Finder-Helfern
    (`cursorRules`, `findCursorRule`, `findRule`) das Array casten:
    `/** @type {CSSStyleRule[]} */ (Array.from(Stylesheets.getGlobalSheet(root).cssRules))`.
  - **Rückgabe `Node` von `asPassNode`** — `stage-pipeline:171`:
    `/** @type {PassNode} */ (stage.asPassNode(display.renderer)).renderTarget`;
    `stage-renderer:183,186` (`passNode.value`): `const passNode = /** @type {TextureNode} */
    (sr.asPassNode(display.renderer));` — `value.image` ist in `@types/three` `unknown`, darum
    ein lokaler Helfer, der bei jedem Aufruf frisch liest:
    ```js
    /** @param {TextureNode} node */
    const imageSize = (node) => {
      const image = /** @type {{width: number, height: number}} */ (node.value.image);
      return [image.width, image.height];
    };
    ```
    und `expect(imageSize(passNode)).to.deep.equal([200, 100])` bzw. `[600, 300]`. Typen per
    `/** @import {PassNode, TextureNode} from 'three/webgpu' */`.
  - **`performance.memory`** (nur Chromium) — `vertex-objects-heap:58,66`:
    `/** @type {Performance & {memory?: {usedJSHeapSize: number}}} */ const chromePerformance = performance;`
    auf Modulebene mit einem Satz Kommentar (Chromes nicht standardisierter Heap-Zähler;
    Firefox hat keinen, das prüft der `before()`-Hook), beide Stellen lesen
    `chromePerformance.memory`.
  - **`makeContainer` mit `id`** — `display-resize:7,117,424`: JSDoc
    `@param {{width?: number, height?: number, id?: string}} [options]`.
  - **`querySelector` liefert `Element`** — `hello-twopoint5d-canvas:20`:
    `const el = /** @type {HTMLCanvasElement} */ (document.querySelector('canvas#test-canvas'));`
  - **Absichtlich falsche Argumente** — `display-constructor:59` (`new Display({})`):
    `// @ts-expect-error — the case hands the constructor what it refuses` direkt darüber
    (`new Display(null)` meldet ohne `strictNullChecks` nichts und bleibt so);
    `display-constructor:73` (TS2740, Stub statt Renderer): `makeRendererStub` bekommt
    `@returns {WebGPURenderer}` und gibt `/** @type {WebGPURenderer} */ (/** @type {unknown} */ ({…}))`
    zurück, mit einem Satz Kommentar (der Stub trägt nur, was `Display` am Renderer aufruft).

- Verify: `pnpm run ci`
- Zusatzbelege (Ausgabe in den Report; `ARBEITSDIR=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad`):
  - a) Roter Lauf aus Schritt 3 (Fehlerzahl, Exit-Code) und der rote Lauf der beiden
    `*.test.mjs` vor der Implementierung.
  - b) Negativprobe Tests, aus `packages/twopoint5d-testing`, die Probedatei wird in jedem Fall
    entfernt:
    ```bash
    probe=test/zz-typecheck-negative-probe.test.js
    trap 'rm -f "$probe"' EXIT
    printf "import {Display} from '@spearwolf/twopoint5d';\n/** @param {Display} d */\nexport const n = (d) => d.frameLoop.subscriptionCountt;\n" > "$probe"
    pnpm exec tsc -p tsconfig.json; echo "exit=$?"
    rm -f "$probe"; git status --short test/
    ```
    erwartet: Exit ≠ 0, TS2551 an Zeile 3 der Probedatei, danach keine Spur in `git status`.
  - c) Negativprobe Snippets, aus `packages/twopoint5d-testing`: eine Datei
    `$ARBEITSDIR/paket-3b.snippet-probe.md` per `printf` anlegen mit Prosa, einem markierten
    Block (Fence-Zeile, dann `import {Display} from '@spearwolf/twopoint5d';`,
    `const display = new Display(document.body);`, `display.frameLoop.subscriptionCountt;`,
    schließende Fence) und einem zweiten Block mit der Info-Zeile `js check`;
    `node ../../scripts/checkDocSnippets.mjs "$ARBEITSDIR/paket-3b.snippet-probe.md"; echo "exit=$?"`
    → Exit 1, eine TS2551-Zeile mit dem absoluten Pfad und der Zeile des Tippfehlers in der
    `.md`, eine Marker-Zeile für `js check`.
  - d) Cache, aus dem Repo-Root: `pnpm nx typecheck twopoint5d-testing` zweimal → der zweite
    trifft; an `packages/twopoint5d/docs/proposals/sprite-features.md` eine Leerzeile anhängen
    → Miss; `git checkout -- packages/twopoint5d/docs/proposals/sprite-features.md` → Treffer;
    an `packages/twopoint5d-testing/web-test-runner.config.js` einen Kommentar anhängen →
    Treffer; `git checkout -- packages/twopoint5d-testing/web-test-runner.config.js`. Beide
    Dateien gehören nicht zu diesem Paket, `git checkout` darauf verwirft also nichts von ihm —
    vorher mit `git diff --stat -- <datei>` prüfen, dass sie sauber sind.
  - e) Die Zählzeile des Snippet-Checks aus `pnpm nx typecheck twopoint5d-testing --skip-nx-cache`:
    `2 blocks marked "ts check" in 1 files, 0 errors`.
  - f) `pnpm nx typecheck twopoint5d --skip-nx-cache` → Exit 0: `@types/mocha` erreicht die
    Bibliothek nicht (sie sieht nur `node_modules/@types` im eigenen Paket und im Root), keine
    Kollision mit den Vitest-Globals.
  - Offen bis zum ersten Push: nichts Eigenes — das Target läuft in CI über `pnpm run ci`.

- Commit: `test: type-check the browser tests and every Markdown code block marked "ts check" against the built library`

- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · TYPE-014 unverändert (`packages/twopoint5d-testing/package.json:13-15` nur `test`, keine tsconfig im Paket, `tsconfig.json:4` `allowJs: false`), Fundstelle `display-dispose.test.js:34-37` durch Paket 3 nach `:28-31` gewandert; Probe auf `e4dc0a95`: 577 Fehler unter Root-Strenge, 81 gelockert (Übergabe maß 585/83 auf `f0a16ba3`) · CFG-014 unverändert (220 `ts`-Blöcke, 0 markiert, `.prettierignore:5` `*.md`); markierbar ohne Umschreiben: `packages/twopoint5d/src/stage/README.md:68` und `:368` · keine offenen Folgen zu verteilen (Paket 1: in Paket 2 aufgegangen, Pakete 2 und 3: —) · aus »Offene Befunde« nichts übernommen (`waitUntil`-Kommentar: andere Ursache, bleibt in der Queue) · Restplan: Paket 4 unverändert, keine Überschneidung (`scripts/publishNpmPkg*`, `scripts/makePackageJson*`, `tsconfig.build.json` gegen `scripts/checkDocSnippets*`) · Probe-Konfigurationen und Logs unter `$ARBEITSDIR/paket-3b.probe/` (`strict.log`, `loose.log`)
  - 2026-09-21 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort medium · Brief `$ARBEITSDIR/paket-3b.impl-1.brief.txt`, Report `paket-3b.impl-1.json`
  - 2026-09-21 Zug 2: erster Zug endete ohne Report (Gate im Hintergrund, mit dem Zug beendet) → Resume derselben Session, Report `paket-3b.impl-1-versuch-2.json`: FERTIG_MIT_VORBEHALT · 6 neue, 20 geänderte Dateien (14 Tests, Lockfile von Hand auf die `@types/mocha`-Zeilen begrenzt) · roter Lauf 81 Fehler/Exit 2, `*.test.mjs` 0/2 · Arbeitsbaum schmutzig · eigener Verify `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 (`$ARBEITSDIR/paket-3b.verify.log`, `test:scripts` 49/49) · `pnpm install --frozen-lockfile --offline` exit 0
  - 2026-09-21 Zug 3: Reviewer beauftragt (sonnet, medium), Diff `$ARBEITSDIR/paket-3b.diff` (1998 Zeilen), Report `paket-3b.review-1.json`
  - 2026-09-21 Zug 3: Urteil TYPE-014 behoben, CFG-014 behoben · 0 kritisch, 0 wichtig, 5 klein
  - 2026-09-21 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-21 Zug 5: Commit e011cfe5, Verify aus Zug 2 (`$ARBEITSDIR/paket-3b.verify.log`, exit=0) trägt ihn — keine Änderung seither

## Abgleich

- **TYPE-014** — unverändert. `packages/twopoint5d-testing/package.json:13-15`: `scripts`
  enthält nur `test`; das Paket hat weder `tsconfig.json` noch `jsconfig.json`; Root
  `tsconfig.json:4` `"allowJs": false`, kein `checkJs`; `project.json` des Pakets kennt nur
  `test`. Die zitierten JSDoc-Annotationen (`display-dispose.test.js:34-37`) stehen nach dem
  Umbau durch Paket 3 an `:28-31`. Der Umfang ist gewachsen: 25 Testdateien, 4.752 Zeilen
  (Audit: 3,4k), darunter die von Paket 3 neue `renderer-backend.test.js` und
  `sprites-rotation.test.js` — beide ohne Befund in der Probe.
- **CFG-014** — unverändert. Root-`package.json` `typecheck` = `pnpm nx run-many -t typecheck`,
  kein Target liest Markdown; 220 `ts`-Blöcke in getrackten `.md`
  (`packages/twopoint5d/CHANGELOG.md` 186, `packages/twopoint5d/src/stage/README.md` 14,
  `packages/twopoint5d/docs/resource-lifecycle.md` 10,
  `packages/twopoint5d/docs/proposals/sprite-features.md` 6,
  `.claude/skills/updating-changelog/SKILL.md` 4), keiner markiert.

## Entscheidungen in Zug 0

- **Strenge der Browsertests: `noImplicitAny` und `strictNullChecks` aus**, der Rest wie die
  Root. Gemessen auf `e4dc0a95`: Root-Strenge 577 Fehler (203 TS18048, 116 TS7005, 69 TS7006,
  40 TS7034, 18 TS2532 — fast alles Casts auf Fixture-Variablen, die in JS nur als
  `/** @type */ (x)` gehen), gelockert 81. Das Finding will umbenannte Member und falsche
  Argumentformen finden; TS2339, TS2345 und TS2551 bleiben in beiden Stufen erhalten, die
  Probe mit einem vertippten `setPositon` belegt es. Die Empfehlung der Übergabe aus Paket 3
  ist damit übernommen.
- **Kein chai-Shim** (Abweichung von der Empfehlung des Audits): die Typen lösen über die
  eigene Dependency von `@esm-bundle/chai` auf `@types/chai@4.3.20` auf, mit
  `--traceResolution` nachgesehen. Die Übergabe vermutete den pnpm-Hoist; es ist der
  Geschwisterlink im `.pnpm`-Verzeichnis des Pakets, der bei jeder Installation entsteht.
- **`@types/mocha` `^10.0.10`** als devDependency des Testpakets, `types: ["mocha"]` in dessen
  tsconfig. Der Mocha von `@web/test-runner` ist 10.x.
- **Der Snippet-Check hängt am `typecheck` von `twopoint5d-testing`**, nicht an der
  Bibliothek: Snippets importieren `@spearwolf/twopoint5d` wie ein Konsument, und
  `packages/twopoint5d-testing` ist das Paket, in dem dieser Name samt `three`,
  `@spearwolf/eventize` und `@spearwolf/signalize` auf den Build auflöst. Die Bibliothek
  selbst prüft gegen ihre Quellen und hat kein `dependsOn: build` im `typecheck`. Ein
  eigenes Target (`checkDocSnippets`) hätte `pnpm typecheck` nicht erreicht, das Ziel im Plan
  verlangt genau das.
- **Virtuelle Dateien über die Compiler-API** statt generierter `.ts` auf der Platte, nach dem
  Vorbild von `scripts/checkNameableTypes.mjs`: kein Ausgabeverzeichnis, kein Eintrag in
  `.gitignore`, keine Reste nach einem Abbruch, und die Rückrechnung auf `datei.md:zeile`
  liegt in einer Hand.
- **Optionen für Snippets:** Root-Strenge, dazu `noUnusedLocals`/`noUnusedParameters` aus
  (Beispielcode deklariert, was er zeigt, ohne es zu benutzen — Block 368 fiele sonst an
  `w`, `h`, `now`, `dt`), `moduleDetection: force` (jeder Block ein eigenes Modul, zwei
  `const display` kollidieren nicht), `importHelpers: false` (es wird nichts ausgegeben,
  `tslib` ist unnötig), `types: []` (Snippets sehen das DOM und ihre Imports, keine
  Node-, Mocha- oder Sinon-Globals).
- **Nur getrackte `.md`** über `git ls-files`: das Audit zählt getrackte Dateien, und
  ungetrackte Notizen — die dieses Laufs eingeschlossen — sollen die Prüfung nicht tragen.
- **Markiert werden genau zwei Blöcke**, `packages/twopoint5d/src/stage/README.md:68` und
  `:368`: in Zug 0 als Einzelmodule gegen den Build mit den Optionen oben compiliert, 0
  Fehler. Die anderen zwölf Blöcke des Stage-READMEs brauchen Namen aus Nachbarblöcken
  (`display`, `stage`, `Color`, `root`, `canvas`), die zehn in `resource-lifecycle.md` sind
  Auszüge aus Klassen, die sechs in `sprite-features.md` zeigen eine API, die es noch nicht
  gibt, die im CHANGELOG gehören veröffentlichten Versionen (unveränderlich nach
  `updating-changelog`), die in `.claude/skills/` sind Anleitungstext. Einen Block
  umzuschreiben, damit er markierbar wird, ist Dokuarbeit außerhalb beider Findings.
- **Marker-Grammatik streng** (genau `ts check`, jede andere Form mit `check` ist ein Fehler):
  ein vertippter Marker darf nicht still aus der Prüfung fallen.
- **Nebenbefund `waitUntil`-Kommentar** (`texture-store-on.test.js:32`) bleibt in »Offene
  Befunde«, obwohl dieses Paket die Datei anfasst: falsche Prosa, keine gemeinsame Ursache
  mit fehlender Typprüfung — der Typecheck findet ihn nicht.

## Findings im Volltext

**TYPE-014 · low · packages/twopoint5d-testing/package.json:13-16; tsconfig.json:4 (allowJs: false); packages/twopoint5d-testing/test/display-dispose.test.js:34-37** — Die Browsertests typprüfen; heute tut es nichts
Das Paket hat keine `tsconfig.json`/`jsconfig.json`, die Root-Config hat `allowJs: false` und
kein `checkJs`, und es gibt kein `typecheck`-Script — `pnpm typecheck` überspringt das Projekt
stumm, und die `@type`-JSDoc-Annotationen in 3,4k Zeilen Tests sind Dekoration. Ein
umbenanntes öffentliches Mitglied (`display.frameLoop.subscriptionCount`,
`renderer.info.memory.attributes`) fällt erst zur Laufzeit im Browser auf. ESLint lintet die
Dateien, aber ohne Typinformation.
Empfehlung: `packages/twopoint5d-testing/tsconfig.json`, die die Root erweitert, mit
`allowJs`, `checkJs`, `noEmit`, `include: ["test"]`, `types: ["mocha"]` (plus chai-Typ-Shim)
und ein `typecheck: tsc -p tsconfig.json`-Script; die Nx-Target-Inputs wie bei der Bibliothek.

**CFG-014 · low · package.json; packages/twopoint5d/**/*.md; .prettierignore (*.md)** — Kein Schritt des Gates prüft Beispielcode
`pnpm typecheck` erreicht jede `.ts`- und `.astro`-Datei und keinen der `ts`-Codeblöcke des
Repos. Genau daran ist die Umstellung auf `strictNullChecks` und `noUncheckedIndexedAccess`
vorbeigelaufen: Beispielcode blieb stehen und compilierte nicht mehr. Ohne Wächter verrottet
dieselbe Stelle beim nächsten Schalter wieder. Re-Check: unverändert.
Empfehlung: Vor dem Wächter steht eine Konvention: Snippets selbsttragend schreiben, eine
Präambel-Syntax im Docblock einführen, oder Auszüge ausklammern. Erst die Konvention
beschließen, dann den Extraktor bauen. (Beschlossen 2026-09-21, siehe »Entscheidungen« im
Plan: Opt-in-Marker, typgeprüft gegen den Build, Konvention in `AGENTS.md`.)

## Urteil des Reviewers (`paket-3b.review-1.json`)

- **TYPE-014 — behoben:** `packages/twopoint5d-testing/tsconfig.json:1-17`, `package.json:15`
  (Script `typecheck`), `project.json:9-22` (Target), Annotationen in 14 Testdateien; eigener
  `tsc -p tsconfig.json` Exit 0, roter Lauf 81 Fehler, Negativprobe TS2551.
- **CFG-014 — behoben:** `scripts/checkDocSnippets.mjs`,
  `scripts/checkDocSnippets/{extract,compile}Snippets.mjs`, Marker an
  `packages/twopoint5d/src/stage/README.md:68` und `:368`, Konvention `AGENTS.md:78-83`;
  eigene Proben: Tippfehler → Exit 1 mit `.md`-Zeile/Spalte 6:19, fehlende Datei → Exit 2,
  keine Marker → Exit 0, CRLF, Mehrfach-Leerzeichen, Vierer-Fence, `sh check` → Problem.
- Abweichungen des Implementierers geprüft und angenommen: Lockfile (+8, Fixpunkt unter
  `--lockfile-only --offline`), `releaseInit`/`releaseCallback` als `(value?: unknown) => void`,
  Backtick-Info-Zeile keine Fence, Marker-Problem mit Spalte 1, Marker-Probleme vor Typfehlern.

### Kleine Befunde (lösen keine Runde aus)

- `scripts/checkDocSnippets.mjs:12` — die Usage-Zeile nennt den Aufruf ohne Arbeitsverzeichnis;
  aus dem Repo-Root lösen die Snippets `@spearwolf/twopoint5d` nicht auf (TS2307). Vorschlag:
  `cd packages/twopoint5d-testing && node ../../scripts/checkDocSnippets.mjs [file.md …]`.
- `scripts/checkDocSnippets/compileSnippets.mjs:26` — bei 0 Snippets Rückkehr vor
  `readCompilerOptions`; eine unlesbare tsconfig ergibt dann Exit 0 statt 2.
- `scripts/checkDocSnippets/extractSnippets.test.mjs` — die Regel »Backtick in der Info-Zeile ist
  keine Fence« (`extractSnippets.mjs:28`) hat keinen Test.
- `scripts/checkDocSnippets.mjs:14-15` — `let snippets`/`let problems` werden nie neu zugewiesen.
- `packages/twopoint5d-testing/project.json:15` — `{workspaceRoot}/**/*.md` erfasst ungetrackte
  Dateien, der Check liest nur getrackte: unnötige Misses, kein falsches Ergebnis (so geplant).

### Nebenbefunde (in »Offene Befunde« des Plans)

- `display-resize.test.js:469`, `vertex-objects-heap.test.js:73-75`: beide per `git blame`
  vor dem ersten Paket-Commit entstanden (7de63c45e, bf868e409), Harness-Kommentare → Scope.
- emnapi-Peers im Lockfile: der Implementierer sah den Churn bei einem Online-`pnpm install`,
  der Reviewer auf einer Kopie mit `--lockfile-only --offline` keinen; Dependencies → Scope.
