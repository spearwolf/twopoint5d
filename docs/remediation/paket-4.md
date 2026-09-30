# Paket 4 — Gate- und Publish-Skripte

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-002 (medium), TEST-044 (medium), CFG-002 (low), CFG-021 (low),
  TEST-037 (info), READ-016 (info), DOC-058 (info), DOC-054 (info), DOC-055 (info),
  DOC-056 (info), DOC-057 (info), READ-018 (info)
- Dazu (Folge aus Paket 2, verteilt in Zug 0 Paket 3):
  `scripts/checkDocSnippets/extractSnippets.mjs:29` — `@typedef {…} OpenFence` mit 108
  Zeichen, mehrzeilig schreiben (Schritt 4)
- Dazu (Folge aus Paket 3, verteilt in Zug 0 Paket 4): `docs/architecture.md:143` —
  Zeile mit 91 Zeichen aus dem Umbruch in Runde 1 von Paket 3 (Schritt 7g)
- Dazu (Queue, aufgenommen in Zug 0 Paket 4, gleiche Ursache wie READ-018):
  `.github/workflows/ci.yml:11` — Kommentarzeilen über 90 Zeichen, jetzt `:11`, `:15`,
  `:98`, `:113`, `:132`; die »Folge« `ci.yml:113` aus Paket 3 ist dieselbe Zeile
  (Schritt 6c)
- Dazu (Nebenbefunde aus Zug 0, gleiche Ursache wie DOC-054):
  `scripts/makePackageJson/findUnpublishableSpecifiers.mjs:11` und
  `scripts/makePackageJson/resolveDependencies.mjs:116–117` rufen `startsWith` auf einem
  Wert auf, der kein String sein muss (Schritt 5)
- Dazu (Nebenbefunde aus Zug 0, gleiche Ursache wie READ-018): jede Kommentarzeile über
  90 Zeichen unter `scripts/` (65 Zeilen in 22 Dateien auf 5a413417) und jede
  Prosazeile über 90 in `docs/architecture.md` (Schritt 6b, 7g)
- Ziel: `checkNameableTypes` ist getestet, erkennt `import("…").T` und liest die
  gemeinsame tsconfig; `checkDocSnippets` und `resolveDependencies` melden ihre
  Randfälle richtig und sind sauber kommentiert und getestet.
- Modell: mittlere Stufe (Module zerlegen, lokale Bugfixes mit Regressionstest, Doku;
  die Compiler-API-Stellen sind in Zug 0 geprobt und unten exakt vorgegeben)
- Effort: medium
- Verify: `pnpm run ci` plus die Strukturproben unter »Verify«
- Commit: siehe »Commit«
- Dateien:
  - neu `scripts/shared/readCompilerOptions.mjs`, `scripts/shared/readCompilerOptions.test.mjs`
  - neu `scripts/checkNameableTypes/findUnnameableTypes.mjs`,
    `scripts/checkNameableTypes/findUnnameableTypes.test.mjs`,
    `scripts/checkNameableTypes/checkNameableTypes.test.mjs`
  - `scripts/checkNameableTypes.mjs`
  - `scripts/checkDocSnippets.mjs`, `scripts/checkDocSnippets/compileSnippets.mjs`,
    `scripts/checkDocSnippets/compileSnippets.test.mjs`,
    `scripts/checkDocSnippets/extractSnippets.mjs`,
    `scripts/checkDocSnippets/extractSnippets.test.mjs`
  - `scripts/makePackageJson.mjs`, `scripts/makePackageJson/resolveDependencies.mjs`,
    `scripts/makePackageJson/resolveDependencies.test.mjs`,
    `scripts/makePackageJson/findUnpublishableSpecifiers.mjs`,
    `scripts/makePackageJson/findUnpublishableSpecifiers.test.mjs`,
    `scripts/makePackageJson/makePackageJson.test.mjs`
  - `scripts/publishNpmPkg/publishedVersions.mjs`,
    `scripts/ci/nxCacheServer/createCacheServer.test.mjs`
  - nur Kommentar-Umbruch (Schritt 6b): die übrigen Dateien der Liste dort
  - `packages/twopoint5d-testing/project.json` (Inputs von `typecheck`)
  - `.github/workflows/ci.yml` (nur Kommentare)
  - `docs/architecture.md` (§3, §4, §5, §6 und Umbrüche), `AGENTS.md` (Bullet
    `pnpm test:scripts`)

## Vorgehen

Grundregeln für dieses Paket:

- Die Konventionen aus dem Plan-Kopf gelten, dazu `AGENTS.md`. Jede Zeile, die dieses
  Paket schreibt, ob Kommentar oder Markdown, bleibt bei höchstens 90 Zeichen; Code
  formatiert Prettier (`printWidth` 130), Code-Zeilen werden nicht umbrochen.
- Jede neue oder geänderte `.mjs` unter `scripts/` muss im `checkJs`-Typecheck grün sein
  (`pnpm exec tsc -p scripts/tsconfig.json`, `noImplicitAny` aus, `strictNullChecks`
  an). JSDoc-Typen dort, wo der Check sie braucht, sonst nicht.
- `scripts/publishNpmPkg/*.mjs` importiert nur `node:`-Built-ins und einander
  (`builtinImportsOnly.test.mjs`). Dieses Paket fasst dort nur Kommentare an.
- Kein CHANGELOG-Eintrag: nichts davon erreicht das veröffentlichte Paket (Begründung
  unter »Entscheidungen in Zug 0«).
- Tests mit `node:test` und `node:assert/strict` wie die Nachbarn; Fixtures in
  Wegwerfverzeichnissen unter `os.tmpdir()`, im `after` entfernt.

### Schritt 1 — Ein gemeinsamer Leser der tsconfig (CFG-002, Grundlage für Schritt 2 und 3)

1. Neu `scripts/shared/readCompilerOptions.mjs`, exportiert
   `readCompilerOptions(tsconfigPath)`. Inhalt ist der heutige Körper von
   `scripts/checkDocSnippets/compileSnippets.mjs:68–76` **ohne** das Override-Objekt
   `:79–91`:
   - `ts.readConfigFile(tsconfigPath, ts.sys.readFile)`; bei `error` ein
     `Error(`cannot read ${tsconfigPath}: ${…}`)` (Text wie heute `:70`)
   - `ts.convertCompilerOptionsFromJson(config.compilerOptions,
     path.dirname(tsconfigPath))`; bei Fehlern `Error(`invalid compiler options in
     ${tsconfigPath}: ${…}`)` (Text wie heute `:74–76`)
   - gibt `options` unverändert zurück
   - JSDoc: `@param {string} tsconfigPath`, `@returns
     {import('typescript').CompilerOptions}`
   - Der Kommentar `compileSnippets.mjs:66–67` (»`parseJsonConfigFileContent` would scan
     the whole repository …«) zieht mit um, umbrochen auf ≤ 90. Dazu ein Satz: gelesen
     werden nur die eigenen `compilerOptions` der Datei, `extends` folgt der Leser nicht
     — die Root-Config erbt von nichts.
2. Neu `scripts/shared/readCompilerOptions.test.mjs`:
   - »reads the root tsconfig with the values the compiler uses«: für
     `<repo>/tsconfig.json` gilt `options.strict === true`,
     `options.noUncheckedIndexedAccess === true` und `options.moduleResolution ===
     ts.ModuleResolutionKind.Bundler` (die JSON-Strings kommen als Enum-Werte an)
   - »an unreadable tsconfig throws with its path«: `assert.throws(() =>
     readCompilerOptions(path.join(dir, 'no-such-tsconfig.json')),
     /cannot read .*no-such-tsconfig\.json/)`
   - »an unknown compiler option value throws«: Wegwerfdatei
     `{"compilerOptions": {"module": "banana"}}` → `assert.throws(…, /invalid compiler
     options in/)`
3. `compileSnippets.mjs` importiert `readCompilerOptions` aus
   `../shared/readCompilerOptions.mjs`; die lokale Funktion fällt. Die Overrides
   (`noEmit`, `noUnusedLocals`, `noUnusedParameters`, `importHelpers`, `types`,
   `moduleDetection`) bleiben samt ihren Kommentaren in `compileSnippets.mjs`, als
   `{...readCompilerOptions(tsconfigPath), …}`.
4. `packages/twopoint5d-testing/project.json`, `targets.typecheck.inputs`: direkt nach
   `"!{workspaceRoot}/scripts/checkDocSnippets/*.test.mjs"` zwei Einträge
   `"{workspaceRoot}/scripts/shared/*.mjs"` und
   `"!{workspaceRoot}/scripts/shared/*.test.mjs"`. Grund: der Code-Block-Check liest
   seine tsconfig jetzt über dieses Modul; ohne den Input bliebe das Target nach einer
   Änderung am Leser im Cache.

### Schritt 2 — Unlesbare tsconfig auch ohne markierte Blöcke (CFG-021)

1. Zuerst der Test in `scripts/checkDocSnippets/compileSnippets.test.mjs`: »an
   unreadable tsconfig throws even when no block is marked« —
   `assert.throws(() => compileSnippets({snippets: [], anchorDir, tsconfigPath:
   path.join(repoRoot, 'no-such-tsconfig.json')}), /cannot read/)`. Rot sehen (heute
   kommt `[]` zurück), Ausgabe in den Report.
2. In `compileSnippets()` die Optionen **vor** der Früh-Rückkehr lesen (heute `:23`
   vor `:25`): erst `const options = …`, dann `if (snippets.length === 0) return [];`.
   `checkDocSnippets.mjs:49–54` fängt den Fehler schon und endet mit Exit 2 — so wie
   der Kopfkommentar es verspricht.

### Schritt 3 — checkNameableTypes zerlegen, testen, `import("…").T` erkennen (TEST-002, TEST-044, CFG-002)

1. Neu `scripts/checkNameableTypes/findUnnameableTypes.mjs` (importiert `node:path` und
   `typescript`). Exporte:
   - `findUnnameableTypes({entry, compilerOptions})` →
     `{exported: number, rows: Array<{name: string, file: string, line: number, uses:
     string[]}>}`. Baut `ts.createProgram([entry], compilerOptions)`. Fehlt
     `program.getSourceFile(entry)`, wirft sie `Error(`no such entry declaration file:
     ${entry}`)`. Der Walk ist der heutige aus `scripts/checkNameableTypes.mjs:41–118`
     unverändert (`deref`, Menge `nameable`, `isLib`, `locate`, `rootOfReference`,
     `referencedName`, Frontier-Schleife); `exported` ist `exported.length` wie in
     `:128`. `rows` sortiert wie `:120` (Datei, dann Zeile), `uses` als sortiertes
     Array, `file` relativ zu `path.dirname(entry)` wie heute `root`.
   - `partitionAccepted(rows, accepted)` → `{accepted, offenders}`; Schlüssel
     `${row.file}:${row.name}` wie `:121–122`; `accepted` ist eine
     `ReadonlyMap<string, string>` (Wert = Begründung).
   - Die Hilfsfunktionen bleiben unexportiert. Der Kommentar über `rootOfReference`
     (`:58–59`) zieht mit um, umbrochen auf ≤ 90.
2. `scripts/checkNameableTypes.mjs` wird zur Verdrahtung:
   - Kopfkommentar `:1–8` inhaltlich wie heute, umbrochen auf ≤ 90. Die Usage-Zeilen
     wörtlich (DOC-058 gilt hier genauso: das Skript läuft aus dem Paketverzeichnis):

     ```
     //   cd packages/twopoint5d && node ../../scripts/checkNameableTypes.mjs [entry.d.ts]
     //   (default: dist/lib/index.d.ts)
     ```

     Dazu eine Exit-Code-Zeile nach dem Muster von `checkDocSnippets.mjs:12`: Exit 0,
     wenn jeder erreichbare Name benennbar oder in `ACCEPTED` steht; 1, wenn nicht; 2,
     wenn Einstiegsdatei oder tsconfig unlesbar sind.
   - `ACCEPTED` bleibt hier, samt Begründung.
   - tsconfig: `path.join(path.resolve(import.meta.dirname, '..'), 'tsconfig.json')`,
     also die Root-tsconfig wie `checkDocSnippets.mjs:20–22`, unabhängig vom
     Arbeitsverzeichnis. Die Optionen gehen **ohne** Overrides an
     `findUnnameableTypes`; ein Kommentarsatz sagt warum: der Check liest nur den
     Checker, keine Diagnosen, und was zählt — Modulauflösung und `lib` —, soll das
     sein, was auch der Code-Block-Check als Konsument benutzt.
   - `try { … readCompilerOptions(…) … findUnnameableTypes(…) } catch (err) {
     console.error(`checkNameableTypes: ${err instanceof Error ? err.message :
     String(err)}`); process.exit(2); }` — Muster `checkDocSnippets.mjs:49–54`.
   - Ausgabe danach Zeichen für Zeichen wie heute `:124–138` (Zeilen der Offender,
     Summary, Hinweiszeile, Exit 1; sonst Summary auf stdout).
   - Gemessen in Zug 0 gegen den gebauten `dist/`: das heutige Skript, eine Kopie mit
     den Optionen der Root-tsconfig und eine Kopie mit zusätzlich dem Zweig aus 3.4
     drucken alle drei `dist/lib/index.d.ts: 317 exported symbols, 1 accepted, 0 not
     nameable`. Diese Zeile muss nach dem Umbau im Gate-Log stehen.
3. Neu `scripts/checkNameableTypes/findUnnameableTypes.test.mjs`. Fixture-`.d.ts` je
   Fall in ein eigenes Verzeichnis unter
   `fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'checkNameableTypes-')))`
   (`realpathSync`, weil `os.tmpdir()` auf macOS hinter einem Symlink liegt und die
   Pfade der Zeilen sonst auseinanderlaufen können), `after` räumt auf. Die Optionen
   aus `readCompilerOptions(<repo>/tsconfig.json)` — dieselben wie im Gate; relative
   Importe `'./a.js'` finden unter `moduleResolution: Bundler` die `a.d.ts`. Fälle:
   1. »a type the entry exports is nameable«: `index.d.ts` = `export interface A { x:
      number }` + `export declare function f(): A;` → `rows` leer.
   2. »a declaration the entry does not export is reported with its file, line and the
      export that reaches it«: `a.d.ts` = `export interface Hidden { x: number }` +
      `export declare function f(): Hidden;`, `index.d.ts` = `export { f } from
      './a.js';` → `[{name: 'Hidden', file: 'a.d.ts', line: 1, uses: ['f']}]`.
   3. »a type reached only through another unnameable one is reported with the name
      that reaches it«: wie 2, `Hidden` hat `inner: Deeper`, `Deeper` in `a.d.ts`
      exportiert, vom Entry nicht → zwei Zeilen, `Deeper` mit `uses: ['Hidden']`.
   4. »a qualified name is judged by its leftmost name«: `export declare namespace NS {
      interface Inner {} }` + `export declare function g(): NS.Inner;` im Entry →
      leer; `Priv.Inner` aus einem Namespace, den der Entry nicht exportiert → `Priv`
      gemeldet.
   5. »an import type is judged by the name it imports« (TEST-044): `index.d.ts` =
      `export declare const a: import('./internal.js').Hidden;`, `internal.d.ts` =
      `export interface Hidden { x: number }` → `[{name: 'Hidden', file:
      'internal.d.ts', line: 1, uses: ['a']}]`. Im selben Test: `import('./internal.js').NS.Inner`
      meldet `NS`; `import('./internal.js').Pub` bleibt still, wenn der Entry `Pub`
      re-exportiert; `typeof import('./internal.js')` bleibt still (siehe 3.4).
      **Diesen Fall vor 3.4 schreiben und rot sehen** (heute `rows` leer), Ausgabe in
      den Report.
   6. »type parameters and the types of the TypeScript lib are never reported«:
      `export declare function k<T>(x: T): Promise<Map<string, T>>;` → leer.
   7. »an entry that does not exist throws«: `assert.throws(…, /no such entry
      declaration file/)`.
   8. `partitionAccepted`: »a row whose file and name the accepted map lists is
      accepted, every other one is an offender«.
4. TEST-044: in `referencedName` ein Zweig
   `if (ts.isImportTypeNode(node)) return node.qualifier ?? null;` mit einem Kommentar
   (≤ 90): tsc schreibt `import("./x.js").T` in eine Deklaration, wenn es einen Typ aus
   einem Modul übernimmt, das die Datei nicht importiert; der Qualifier nennt die
   Deklaration, `rootOfReference` beurteilt seinen linken Namen; ein `typeof
   import("./x.js")` ohne Qualifier nennt das Modul, keine Deklaration. Probe in Zug 0
   (TypeScript 6.0.3): `checker.getSymbolAtLocation()` auf dem linken Namen des
   Qualifiers liefert das Symbol im Zielmodul (`Hidden` → Interface in
   `internal.d.ts`, `NS.Inner` → `NS`); `typeof import(…)` hat `qualifier ===
   undefined`. Im echten `dist/` kommen nur `import("three/webgpu").…` vor, die
   `isLib` übergeht.
5. Neu `scripts/checkNameableTypes/checkNameableTypes.test.mjs`, Kindprozess-Spec nach
   dem Muster `scripts/makePackageJson/makePackageJson.test.mjs:1–40`
   (`spawnSync(process.execPath, [script, entry], {cwd: dir, encoding: 'utf8'})`,
   Wegwerfverzeichnis mit Fixtures):
   - »reports a declaration it cannot name: exit code 1« — Fixture wie 3.3 Fall 2 →
     `status` 1, `stderr` passt auf `/a\.d\.ts:1 {2}Hidden {2}<- reached from f/`, auf
     `/1 not nameable/` und auf die Hinweiszeile `/add it to ACCEPTED/`
   - »passes a surface whose names are all nameable: exit code 0« — Fixture wie Fall 1
     → `status` 0, `stdout` passt auf `/0 not nameable/`
   - »stops with a message on an entry that does not exist: exit code 2, no stack
     trace« → `status` 2, `stderr` passt auf `/checkNameableTypes: no such entry
     declaration file/`, `assert.doesNotMatch(stderr, /^\s+at /m)`

### Schritt 4 — checkDocSnippets (READ-016, DOC-058, TEST-037, Folge `extractSnippets.mjs:29`)

1. READ-016: `scripts/checkDocSnippets.mjs:31–32` → `const snippets = [];`, `const
   problems = [];`.
2. DOC-058: Kopfkommentar `:1–12` umbrechen auf ≤ 90, Inhalt gleich; die Usage-Zeile
   wörtlich (genau 90 Zeichen):

   ```
   //   cd packages/twopoint5d-testing && node ../../scripts/checkDocSnippets.mjs [file.md …]
   //   (default: every tracked *.md of the repository)
   ```

3. TEST-037: neuer Fall in `scripts/checkDocSnippets/extractSnippets.test.mjs`, »a line
   whose info string holds a backtick opens no fence, so a marked block after it is
   found«. Markdown: ``'```inline``` prose'``, `''`, ``'```ts check'``, `'const a =
   1;'`, ``'```'`` → genau ein Snippet mit `line: 4`, `code: 'const a = 1;'`,
   `problems` leer. Das ist bestehendes Verhalten, also statt eines roten Laufs vor
   dem Fix eine Mutationsprobe: `extractSnippets.mjs:43` (`if (rest.includes('`'))
   return;`) auskommentieren, Test rot sehen, Zeile zurück; beides in den Report.
4. Folge aus Paket 2: der `@typedef` in `extractSnippets.mjs:29` wird mehrzeilig in
   JSDoc-Form:

   ```js
   /**
    * @typedef {object} OpenFence
    * @property {boolean} marked
    * @property {number} indent
    * @property {number} ticks
    * @property {number} line
    * @property {string[]} code
    */
   ```

### Schritt 5 — makePackageJson: Werte, die kein String sind, und zwei Texte (DOC-054, DOC-056, DOC-057)

Die Empfehlung zu DOC-054 allein reicht nicht: lässt `resolveDependencies` einen
Nicht-String stehen, wirft `findUnpublishableSpecifiers.mjs:11` denselben `TypeError`
mit `specifier.startsWith(…)`, und `resolveDependencies.mjs:117` tut es mit
`pkgVersion.startsWith(…)` für eine Zahl aus den Root-`devDependencies`. Alle drei
Stellen fallen hier.

1. Zuerst die Tests, jeder rot gesehen, Ausgaben in den Report:
   - `resolveDependencies.test.mjs`: »a dependency whose value is not a string stays as
     it is« — `resolve({a: null, b: 42, c: true}, {})` gibt dasselbe Objekt zurück,
     ohne zu werfen. Heute: `TypeError` aus `:12`.
   - `resolveDependencies.test.mjs`: »a * dependency whose shared version is not a
     string stays *« — `resolve({unknown: '*'}, {}, {unknown: 42})` →
     `{unknown: '*'}`. Heute: `TypeError` aus `:117`.
   - `findUnpublishableSpecifiers.test.mjs`: »names a value that is not a string« —
     `{dependencies: {a: null}, peerDependencies: {b: 42}}` →
     `[{section: 'dependencies', name: 'a', specifier: null}, {section:
     'peerDependencies', name: 'b', specifier: 42}]`. Heute: `TypeError`.
   - `makePackageJson.test.mjs`: »refuses a dependency whose value is not a string:
     exit code 1, no stack trace, no manifest written« — über `packageJsonText`, weil
     `run()` seine Peers als `Record<string, string>` typisiert:
     `run(undefined, {packageJsonText: JSON.stringify({name: '@scope/probe', version:
     '1.0.0', peerDependencies: {three: null}})})` → `status` 1, `stderr` passt auf
     `/peerDependencies\.three is null, which resolves to no version range/`,
     `assert.doesNotMatch(stderr, /^\s+at /m)`, Manifest nicht geschrieben. Heute:
     Stacktrace.
2. `resolveDependencies.mjs:11–12`: vor dem `startsWith` ein Zweig für
   `typeof specifier !== 'string'`, der warnt und den Wert stehen lässt:
   `console.warn('oops.. dependency specifier is not a string:', depName, '->',
   JSON.stringify(specifier), 'referenced from:', context.referencedFrom);` und
   `return;`. Ein Kommentarsatz: ein Manifest ist JSON, ein Wert kann `null`, eine Zahl
   oder ein Objekt sein; er bleibt stehen, und die Manifest-Prüfung weist ihn ab.
3. `resolveDependencies.mjs:117`: `if (typeof pkgVersion === 'string' &&
   !pkgVersion.startsWith('workspace:'))`.
4. `findUnpublishableSpecifiers.mjs:11`: `typeof specifier !== 'string' ||` als erste
   Bedingung; der JSDoc `:3–6` nennt zusätzlich jeden Wert, der kein String ist — npm
   installiert ihn so wenig wie die beiden Protokolle.
5. `makePackageJson.mjs:62`: die Meldung schreibt den Wert als
   `${JSON.stringify(specifier)}` statt `"${specifier}"`. Ein String behält damit seine
   Anführungszeichen (der Test `makePackageJson.test.mjs:47` bleibt grün), `null`
   erscheint als `null`.
6. DOC-056: `resolveDependencies.mjs:44–45` neu schreiben. Inhalt: getrimmt wird, weil
   ein ausgeschriebener Range so ins Manifest geht, wie er dasteht — Leerraum darum
   landete wörtlich im veröffentlichten Manifest, und ein Range aus nichts als
   Leerraum ginge als `*` durch (semver: `validRange(' ')` antwortet `'*'`, geprobt in
   Zug 0; `validRange(' ^1')` ist gültig). Nicht mehr behaupten, Leerraum mache einen
   Range ungültig.
7. DOC-057: `resolveDependencies.mjs:107` → `'oops.. workspace package has no version
   semver can read:'`. Kein eigener Test: reine Wortwahl, und der Testname in
   `resolveDependencies.test.mjs:84` sagt es schon so.

### Schritt 6 — Umbrüche (READ-018 und dieselbe Ursache im Rest der Skripte und in `ci.yml`)

Regel für 6b und 6c: nur umbrechen, der Wortlaut bleibt; eine Zeile mit einem einzigen
Wort am Absatzende vermeiden.

1. READ-018, wörtlich:
   - `scripts/publishNpmPkg/publishedVersions.mjs:2–4` →

     ```
      * `npm show . versions --json`, asked in the package directory, answers with a
      * list, or with a bare string when exactly one version is published. Either way
      * this returns the list.
     ```

     (79/80/25 Zeichen, die Breite des Nachbarblocks `:14–16`)
   - `scripts/ci/nxCacheServer/createCacheServer.test.mjs:20` →

     ```
       // the served directory sits two levels down, so a hash that climbs two levels out
       // of it still lands inside root
     ```

2. Jede übrige Kommentarzeile über 90 Zeichen in einer `.mjs` unter `scripts/`
   umbrechen. Stand 5a413417 (Zeile: Länge); was die Schritte 1–5 ohnehin neu
   schreiben, ist darin enthalten und dort schon erledigt:
   - `scripts/checkDocSnippets.mjs` 2, 3, 6, 7, 8, 10, 12 (Schritt 4.2)
   - `scripts/checkDocSnippets/compileSnippets.mjs` 3, 4, 19, 20, 66 (Schritt 1.1), 89
     — der `@returns`-Typ `:19–20` mehrzeilig wie der `@param` darüber
   - `scripts/checkDocSnippets/compileSnippets.test.mjs` 25
   - `scripts/checkDocSnippets/extractSnippets.mjs` 3, 6, 7, 8, 29 (Schritt 4.4), 38, 73
   - `scripts/checkDocSnippets/extractSnippets.test.mjs` 36, 47
   - `scripts/checkDocSnippets/typecheckInputs.test.mjs` 13
   - `scripts/checkNameableTypes.mjs` 2, 5, 8, 58 (Schritt 3)
   - `scripts/checkPeerDependenciesOnly.mjs` 1
   - `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs` 22
   - `scripts/ci/nxCacheServer/createCacheServer.mjs` 56
   - `scripts/lookbook/demoMetadata.test.mjs` 7, 8, 9, 16, 29
   - `scripts/lookbook/rainbowLineScript.test.mjs` 10, 11, 12
   - `scripts/makePackageJson.mjs` 15, 70
   - `scripts/makePackageJson/makePackageJson.test.mjs` 20, 29, 30
   - `scripts/makePackageJson/removeDistPathPrefix.mjs` 2, 3, 4
   - `scripts/makePackageJson/resolveDependencies.mjs` 48, 65, 87, 88
   - `scripts/publishNpmPkg.mjs` 48, 74, 94
   - `scripts/publishNpmPkg/checkManifest.mjs` 2
   - `scripts/publishNpmPkg/npmCommand.mjs` 1, 5, 6, 7
   - `scripts/publishNpmPkg/releaseFiles.mjs` 5, 6, 7, 8, 9
3. `.github/workflows/ci.yml`: die Kommentarzeilen `:11` (97), `:15` (91), `:98` (92),
   `:113` (96), `:132` (100) umbrechen, Einrückung des Blocks halten. Sonst nichts an
   der Datei.

### Schritt 7 — Doku

`docs/architecture.md` (Stand 5a413417):

1. §3, Bullet `checkNameableTypes` (`:107–110`): ergänzen, dass der Check seine
   Compiler-Optionen aus der Root-`tsconfig.json` liest wie der Code-Block-Check, dass
   er einen Verweis in jeder Form verfolgt, die die Deklarationen tragen —
   Typreferenz, `typeof`-Abfrage, `import("…")`-Typ — und ihn an seinem linken Namen
   beurteilt, und dass seine Logik in `scripts/checkNameableTypes/` liegt.
2. §3, Bullet `test:scripts` (`:118–124`): die Helfer des Nameable-Types-Checks, den
   gemeinsamen tsconfig-Leser (`scripts/shared/`) und die Spec, die
   `checkNameableTypes.mjs` selbst startet, in die Aufzählung aufnehmen.
3. §4, Absatz zu `makePackageJson.mjs` (`:216–217`, »If a `catalog:` or `workspace:`
   specifier is left in the manifest afterwards, the build fails — npm installs neither
   protocol.«): ergänzen, dass die Auflösung einen Wert, der kein String ist, mit einer
   Warnung stehen lässt und der Build an ihm ebenso scheitert, mit einer Meldung, die
   Abschnitt, Name und Wert nennt.
4. DOC-055, §4 `:231–234`: »stops with a usage line and exit code 1 on a missing
   directory, on a second one and on any other option — a misspelled `--dry-run`
   included — before it asks npm.«
5. §5 `:299–302`: der Satz, der die Module mit der klassischen Compiler-API aufzählt,
   nennt danach genau die Nicht-Test-Module unter `scripts/`, die `typescript`
   importieren — Quelle: `grep -rl "from 'typescript'" scripts --include=*.mjs | grep
   -v '\.test\.mjs$'`. Erwartet: `scripts/checkNameableTypes/findUnnameableTypes.mjs`,
   `scripts/shared/readCompilerOptions.mjs`,
   `scripts/checkDocSnippets/compileSnippets.mjs`,
   `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs`.
6. §6 `:345–372`: »The helpers of the publish pipeline, the CI cache server and the
   code block check run under `node --test`« um den Nameable-Types-Check ergänzen;
   »Three specs start a script itself« wird »Four«, mit `checkNameableTypes.mjs`
   gegen Wegwerf-Deklarationsdateien; der Begründungssatz (Exit-Codes und Meldungen
   sind Verdrahtung, die kein Helfer-Test sieht) bleibt.
7. Umbrüche: jede Prosazeile über 90 Zeichen außerhalb von Tabellen und Codeblöcken —
   Stand 5a413417 `:71` (92), `:143` (91, Folge aus Paket 3), `:161` (91), `:186`
   (91), `:318` (91) — durch Neuumbruch ihres Absatzes, Wortlaut gleich.

`AGENTS.md`, Bullet `pnpm test:scripts` (`:45–52`): unter den Helfern den
Nameable-Types-Check nennen und `checkNameableTypes.mjs` unter den Skripten, die eine
Spec als Kindprozess startet. Absatz auf ≤ 90 umbrechen, ohne ein einzelnes Wort auf
der letzten Zeile. Sonst nichts an `AGENTS.md` (der Rest gehört Paket 8).

## Verify

```bash
pnpm run ci
```

Dazu die Strukturproben, jede mit leerer Ausgabe bzw. dem genannten Treffer:

```bash
# 1. keine Kommentarzeile über 90 unter scripts/ (neue Dateien eingeschlossen)
find scripts -name '*.mjs' -not -path '*/node_modules/*' -print0 | xargs -0 awk '{t=$0; sub(/^[ \t]+/,"",t)} t ~ /^(\/\/|\*|\/\*\*)/ && length > 90 {print FILENAME":"FNR": "length}'
# 2. keine Kommentarzeile über 90 in ci.yml
awk '{t=$0; sub(/^[ \t]+/,"",t)} t ~ /^#/ && length > 90 {print FILENAME":"FNR": "length}' .github/workflows/ci.yml
# 3. keine Prosazeile über 90 in docs/architecture.md (Tabellen und Codeblöcke ausgenommen)
awk '/^```/{c=!c; next} !c && !/^\|/ && length > 90 {print FILENAME":"FNR": "length}' docs/architecture.md
# 4. der tsconfig-Leser ist Input des Doc-Typechecks, sein Test nicht
NX_DAEMON=false pnpm exec nx show target inputs twopoint5d-testing:typecheck --json | tr ',' '\n' | grep scripts/shared
# 5. der Gate-Lauf des Checks gegen das echte dist/ (Zeile im ci-Log)
grep 'dist/lib/index.d.ts: 317 exported symbols, 1 accepted, 0 not nameable' \
  /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad/paket-4.verify.log
```

Probe 4 zeigt `scripts/shared/readCompilerOptions.mjs` und nicht
`readCompilerOptions.test.mjs`. Probe 5: steht dort eine andere Zahl, ist der Umbau
nicht verhaltensgleich — Befund, nicht Baseline.

## Commit

```
fix: let checkNameableTypes follow the import types tsc writes into the declarations, read its compiler options from the root tsconfig through a reader it shares with the code block check, and cover it with specs over throwaway declaration files and one that starts it, let the code block check report an unreadable tsconfig when no block is marked and cover the fence rule for a backtick in the info string, let the manifest build refuse a dependency whose value is not a string with a message instead of a stack trace, name the working directory in the usage lines of both checks, say in the monorepo docs that a second package directory stops the publish script, and rewrap the comments of the scripts and of the CI workflow and the lines of the monorepo docs that outgrew their width
```

## Entscheidungen in Zug 0

- **CFG-002: ein gemeinsamer Leser in `scripts/shared/`, kein zweites Exemplar und kein
  Import quer aus `checkDocSnippets/`.** Die Empfehlung will eine Quelle für die
  Compiler-Optionen; zwei Leser derselben Datei mit eigener Fehlerbehandlung liefen
  genauso auseinander wie zwei Options-Objekte. Die Verzeichnisse unter `scripts/`
  gehören je einem Einstiegsskript; ein Modul, das zwei davon dienen, bekommt ein
  neutrales. Preis: ein Input mehr in `twopoint5d-testing/project.json` (Schritt 1.4).
- **CFG-002: die Root-tsconfig ohne Overrides.** Probe in Zug 0: das Skript mit den
  Optionen der Root-tsconfig (`module: ESNext`, `moduleResolution: Bundler`, `lib` mit
  DOM) liefert gegen `dist/` dieselbe Summary wie mit den handgeschriebenen `NodeNext`-
  Optionen (317/1/0). Der Check liest keine Diagnosen, Strenge-Flags ändern nichts.
- **TEST-002: Modul plus Kindprozess-Spec.** Die Empfehlung verlangt Fixture-Tests der
  Kernlogik; der Befund selbst begründet mit dem Gate — ein stiller Fehler dort lässt
  einen unbenennbaren Typ durch oder blockiert ein Release. Das entscheidet der
  Exit-Code, und den sieht nur eine Spec, die das Skript startet (Muster der drei
  Nachbarn `makePackageJson`, `checkPeerDependenciesOnly`, `nxCacheServer`).
- **TEST-044: `typeof import("…")` ohne Qualifier bleibt still.** Es nennt ein Modul,
  keine Deklaration; der Check beurteilt benannte Deklarationen.
- **DOC-054: Abweichung von der Empfehlung.** Ihr »`makePackageJson.mjs` verweigert ihn
  dann mit seiner Meldung« stimmt nicht: `findUnpublishableSpecifiers.mjs:11` würfe
  denselben `TypeError`. Behoben werden deshalb alle drei `startsWith`-Stellen auf
  einem ungeprüften Wert (Nebenbefunde gleicher Ursache, ins Paket genommen), und die
  Meldung schreibt den Wert über `JSON.stringify`, damit `null` nicht als `"null"`
  erscheint.
- **Umbrüche über READ-018 hinaus ins Paket.** READ-018 nennt zwei Kommentare der
  Skripte über der Umbruchbreite; derselbe Zustand steht auf 65 Kommentarzeilen in 22
  Dateien unter `scripts/`, in fünf Kommentarzeilen von `ci.yml` (Queue-Eintrag
  `ci.yml:11`) und in fünf Prosazeilen von `docs/architecture.md`, eine davon Folge aus
  Paket 3. Maß ist die Konvention des Laufs (≤ 90), an der auch die Reviewer von Paket 2
  und 3 gemessen haben. Gleiche Ursache, dieselbe Domäne, großteils dieselben Dateien:
  sonst öffnete die Drain-Runde ein eigenes Paket in genau den Dateien, die dieses
  gerade ändert. Nur Umbruch, kein neuer Wortlaut — die Proben 1–3 machen es prüfbar.
- **TEST-037: Mutationsprobe statt rotem Lauf vor dem Fix.** Die Regel ist
  vorhandenes, richtiges Verhalten; der Test beweist etwas, wenn er bei entfernter
  Regel rot wird.
- **Kein CHANGELOG-Eintrag.** `packages/twopoint5d/CHANGELOG.md` beschreibt die
  Library; keine Änderung erreicht `dist/`. Für ein gültiges Manifest schreibt
  `makePackageJson.mjs` dasselbe `dist/package.json` wie vorher.
- **Modell mittlere Stufe, Effort medium.** Zerlegen eines Moduls, lokale Bugfixes mit
  Regressionstest, Doku, mechanische Umbrüche; kein Nebenläufigkeits- oder
  Sicherheitsanteil, die Compiler-API-Stellen sind geprobt und exakt vorgegeben.

## Für Zug 5 (Schnittstellen im Plan)

B trägt nach dem Commit unter Paket 4 mindestens ein:
- neu `scripts/shared/readCompilerOptions.mjs`: `readCompilerOptions(tsconfigPath)` →
  `CompilerOptions` der Datei selbst (ohne `extends`), wirft mit Pfad und Grund; Input
  von `twopoint5d-testing:typecheck`
- neu `scripts/checkNameableTypes/findUnnameableTypes.mjs`:
  `findUnnameableTypes({entry, compilerOptions})` → `{exported, rows}`,
  `partitionAccepted(rows, accepted)`; `checkNameableTypes.mjs` liest die
  Root-tsconfig, Exit 0/1/2, verfolgt `import("…").T`
- `findUnpublishableSpecifiers` meldet auch Werte, die kein String sind; die Meldung von
  `makePackageJson.mjs` schreibt den Wert über `JSON.stringify`
- Kommentare unter `scripts/`, in `ci.yml` und die Prosa von `docs/architecture.md` bei
  ≤ 90 Zeichen — die Proben 1–3 aus »Verify« gelten für jede spätere Änderung dort
- Offene Befunde: Eintrag `ci.yml:11` abhaken, wenn Schritt 6.3 die Zeilen beseitigt hat

## Restplan (Zug 0)

- Folgen aus Paket 3: `docs/architecture.md:143` → Paket 4 (§3 wird hier ohnehin
  ergänzt). `.github/workflows/ci.yml:113` ist keine Folge: die Zeile stand mit
  denselben 96 Zeichen schon in 576d3fc6 als `ci.yml:95`, Paket 3 hat sie nur mit dem
  Bench-Schritt verschoben; sie gehört zum Queue-Eintrag `ci.yml:11` und geht mit ihm
  in dieses Paket.
- Queue: `ci.yml:11` → Paket 4 (gleiche Ursache wie READ-018). `deploy.yml:12–14`
  (`concurrency`), `nxCacheServer.mjs:22` (Portbereich) und `astro-rainbow-line`
  teilen keine Ursache mit diesem Paket und bleiben liegen; README-Peers bleibt bei
  Paket 8.
- Reihenfolge und Schnitt der offenen Pakete 5–9 bleiben. Paket 4 verschiebt Zeilen in
  `AGENTS.md` (Bullet `test:scripts`, `:45–52`) und in `docs/architecture.md`; Paket 8
  (DOC-076 bei `AGENTS.md:114`) ortet seine Stellen in seinem Zug 0 ohnehin neu. Nach
  Paket 4 steht in `docs/architecture.md` keine Prosazeile über 90 mehr; Paket 8 hat
  dort keinen Umbruch mehr offen. Paket 4 schreibt nichts in den CHANGELOG, Paket 9
  bekommt von hier nichts zu glätten.

## Verlauf

- 2026-09-30 Zug 0: Detailplan steht · TEST-002 unverändert (`checkNameableTypes.mjs`
  138 Zeilen, keine Testdatei) · TEST-044 unverändert (`:69–75`, Probe: Zweig
  `isImportTypeNode` → `qualifier` meldet `Hidden`/`NS`) · CFG-002 unverändert
  (`:26–32`) · CFG-021 unverändert (`compileSnippets.mjs:23`, Leser erst `:25`) ·
  TEST-037 verschoben (`extractSnippets.mjs:38–43`) · READ-016 unverändert
  (`checkDocSnippets.mjs:31–32`) · DOC-058 unverändert (`:10`) · DOC-054 unverändert
  (`resolveDependencies.mjs:12`), dazu gleiche Ursache `findUnpublishableSpecifiers.mjs:11`
  und `resolveDependencies.mjs:117` · DOC-055 verschoben (`docs/architecture.md:231–234`)
  · DOC-056 unverändert (`:44–45`) · DOC-057 unverändert (`:107`) · READ-018 umgeformt:
  `publishedVersions.mjs:1–4` in 576d3fc6 auf 89/88/4 umbrochen (einzelnes »list.«),
  `createCacheServer.test.mjs:20` unverändert (114) · Folgen Paket 3:
  `architecture.md:143` → Paket 4, `ci.yml:113` vorbestehend (576d3fc6 `:95`) = Queue
  `ci.yml:11` → Paket 4 · Probe `checkNameableTypes` gegen `dist/` mit Root-tsconfig und
  Import-Zweig: 317/1/0 wie heute
- 2026-09-30 Zug 1: Implementierer beauftragt (sonnet, Effort medium), Brief
  `paket-4.impl-0.brief.txt`, Report nach `paket-4.impl-0.json`
- 2026-09-30 Zug 2: Report FERTIG_MIT_VORBEHALT (Probe 1 zählte mit awk Bytes, die
  Usage-Zeile `checkDocSnippets.mjs:12` hat 90 Zeichen/92 Bytes; Probe 1 und 3 laufen
  deshalb mit `perl -CSD`) · 5 neue, 29 geänderte Dateien · Arbeitsbaum schmutzig ·
  Verify `paket-4.verify.sh` exit=0, test:scripts 127/127, Proben 1–3 leer, Probe 4
  `scripts/shared/readCompilerOptions.mjs`, Probe 5 317/1/0 im Log
- 2026-09-30 Zug 3: Reviewer (sonnet, medium) `paket-4.review-0.json`: alle zwölf
  Findings und alle »Dazu«-Punkte behoben, 0 kritisch, 0 wichtig, 4 klein · Diff
  `paket-4.diff`
- 2026-09-30 Zug 4: keine Runde (nur kleine Befunde)
- 2026-09-30 Zug 5: Commit c301a1e5 auf dem Verify-Lauf aus Zug 2 (exit=0), 34 Pfade

## Findings im Volltext

**TEST-002 · medium · scripts/checkNameableTypes.mjs:1** — Unit-Tests für
`checkNameableTypes.mjs` ergänzen
Jedes andere Script in `scripts/` zerlegt seine Logik in kleine, pur funktionale Module
mit eigener `*.test.mjs` (z. B. `findRuntimeDependencies`, `removeDistPathPrefix`,
`resolveDependencies`, `releaseFiles`, `parseArguments`). `checkNameableTypes.mjs` bleibt
ein monolithisches 138-Zeilen-Script mit der algorithmisch anspruchsvollsten Logik des
Slices — transitive Symbolauflösung über den TypeScript-Checker, Root-Auflösung
qualifizierter Namen, Alias-Dereferenzierung — und hat keine einzige Testdatei. `grep -rl
checkNameableTypes` findet außer dem Script selbst keine weitere Datei. Das Script ist Teil
des blockierenden `publishNpmPkg`-Gates (`packages/twopoint5d/package.json`), ein stiller
Fehler dort lässt entweder einen unbenennbaren Typ unbemerkt in die öffentliche API oder
blockiert einen validen Release.
Empfehlung: Die Kernlogik (Root-Auflösung, Dereferenzierung, den transitiven Walk) wie bei
den Nachbarscripts in testbare Funktionen auslagern und mit ein paar `.d.ts`-Fixtures
(benennbar/nicht benennbar, `ACCEPTED`-Eintrag, qualifizierter Name) über `node --test`
absichern.

**TEST-044 · medium · scripts/checkNameableTypes.mjs:69-75** — checkNameableTypes auf
`import("…").T`-Referenzen erweitern
`referencedName` behandelt TypeReference, TypeQuery, ComputedPropertyName und
ExpressionWithTypeArguments, aber keinen `ImportTypeNode`. Genau diese Form schreibt tsc in
die `.d.ts`, wenn ein Typ aus einem internen Modul inferiert wird, also im typischen Fall
eines nicht benennbaren Typs. Nachgestellt: `export declare const a:
import("./internal.js").Hidden;` ergibt »0 not nameable« und Exit 0. Aktuell ist die Lücke
latent.
Empfehlung: In `referencedName` `ts.isImportTypeNode(node)` über `node.qualifier` auswerten
und mit einer Fixture testen.

**CFG-002 · low · scripts/checkNameableTypes.mjs:26** — Hartkodierte Compiler-Options von
checkNameableTypes.mjs an das gemeinsame tsconfig.json angleichen
`checkNameableTypes.mjs` baut sein eigenes Options-Objekt (`target: ESNext,
module/moduleResolution: NodeNext, skipLibCheck, strict: true`) von Hand, während das
Schwester-Script `scripts/checkDocSnippets/compileSnippets.mjs:69` dieselben Einstellungen
aus dem echten `tsconfig.json` der Repo-Wurzel liest. Zwei unabhängige Quellen für dieselbe
Art von Konfiguration in derselben Script-Familie können auseinanderlaufen, ohne dass etwas
das bemerkt.
Empfehlung: `checkNameableTypes.mjs` seine Compiler-Options ebenfalls aus `tsconfig.json`
lesen lassen (ggf. mit denselben Overrides wie `compileSnippets.mjs`), statt sie zu
duplizieren.

**CFG-021 · low · scripts/checkDocSnippets/compileSnippets.mjs:23-25** — Der Snippet-Check
meldet eine unlesbare tsconfig nicht, solange es keine markierten Blöcke gibt
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. Bei null
Snippets kehrt `compileSnippets` vor `readCompilerOptions` zurück; eine unlesbare
Root-tsconfig ergibt dann Exit 0 statt des dokumentierten Exit 2 — der Fehler zeigt sich
erst mit dem ersten markierten Block.
Empfehlung: `readCompilerOptions(tsconfigPath)` vor die Früh-Rückkehr ziehen.

**TEST-037 · info · scripts/checkDocSnippets/extractSnippets.mjs:36-38** — Die Regel
»Backtick in der Info-Zeile ist keine Fence« hat keinen Test
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers.
`extractSnippets` folgt CommonMark und behandelt eine Zeile wie ```` ```inline``` prose ````
nicht als Fence; `extractSnippets.test.mjs` deckt die Regel mit keinem Fall ab.
Empfehlung: Einen Fall ergänzen, in dem eine solche Zeile vor einem markierten Block steht
und der Block trotzdem gefunden wird.

**READ-016 · info · scripts/checkDocSnippets.mjs:31-32** — checkDocSnippets deklariert
snippets und problems mit let, ohne sie neu zuzuweisen
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. `let snippets
= []` und `let problems = []` werden nur befüllt, nie neu zugewiesen.
Empfehlung: `const` verwenden.

**DOC-058 · info · scripts/checkDocSnippets.mjs:10** — Die Usage-Zeile von checkDocSnippets
nennt das nötige Arbeitsverzeichnis nicht
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. Die
Usage-Zeile zeigt `node scripts/checkDocSnippets.mjs [file.md …]`; aus dem Repo-Root
aufgerufen, lösen die Snippets `@spearwolf/twopoint5d` nicht auf (TS2307). Der Absatz
darüber erklärt es, die Zeile, die man kopiert, nicht.
Empfehlung: Die Zeile als `cd packages/twopoint5d-testing && node
../../scripts/checkDocSnippets.mjs [file.md …]` schreiben.

**DOC-054 · info · scripts/makePackageJson/resolveDependencies.mjs:12** — resolveDependencies
wirft einen TypeError, wenn ein Dependency-Wert kein String ist
Aufgefallen im Remediation-Lauf vom 2026-09-21 (vorbestehend). `specifier.startsWith(…)`
wirft bei einem Dependency-Wert, der kein String ist (`null`, eine Zahl), einen `TypeError`
mit Stacktrace statt einer Meldung — die letzte Stelle der beiden Publish-Skripte, an der
ein Fehler ungefangen durchläuft. Praktisch kaum erreichbar, weil ein gültiges
`package.json` nur String-Specifier trägt.
Empfehlung: Vor dem `startsWith` `typeof specifier === 'string'` prüfen und einen
Nicht-String wie jeden anderen unauflösbaren Specifier mit Warnung stehen lassen;
`makePackageJson.mjs` verweigert ihn dann mit seiner Meldung.

**DOC-055 · info · docs/architecture.md:189-191** — Die Architektur-Doku nennt nicht, dass
ein zweites Paketverzeichnis ebenfalls abbricht
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. Der Satz zur
Kommandozeile von `publishNpmPkg.mjs` nennt als Abbruchgründe ein fehlendes Verzeichnis und
jede andere Option; ein zweites Verzeichnis bricht ebenso mit Exit 1 ab (`expected one
<package-dir>`).
Empfehlung: Den Fall im selben Satz ergänzen.

**DOC-056 · info · scripts/makePackageJson/resolveDependencies.mjs:44-45** — Der Kommentar
zum Trimmen der workspace:-Range nennt den falschen Grund
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. »whitespace
around the range belongs to no version range« ist ungenau — `validRange(' ^1')` ist gültig.
Der eigentliche Grund ist, dass der Leerraum sonst wörtlich ins veröffentlichte Manifest
ginge und `' '` als `'*'` durchrutschte.
Empfehlung: Den Kommentar auf diesen Grund umschreiben.

**DOC-057 · info · scripts/makePackageJson/resolveDependencies.mjs:107** — Die Warnung
»workspace package has no version« trifft bei einer unlesbaren Version nicht zu
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers. Die Warnung
erscheint auch, wenn das Nachbar-Manifest eine `version` trägt, die semver nicht lesen kann
(etwa `banana`); sie sagt dann etwas Falsches über das Manifest.
Empfehlung: Wortlaut auf »has no version semver can read« ändern.

**READ-018 · info · scripts/publishNpmPkg/publishedVersions.mjs:2-3** — Zwei Kommentare der
Skripte brechen ungleich bzw. über die Umbruchbreite um
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleine Befunde zweier Reviewer. Der
Doc-Kommentar von `parsePublishedVersions` bricht nach 112 und 70 Zeichen um; der
Kommentar zur Verzeichnistiefe im Cache-Server-Test ist rund 115 Zeichen lang. Prettier
lässt beides durch.
Empfehlung: Beide auf die Breite der Nachbarzeilen umbrechen.

## Urteil des Reviewers (Zug 3)

- TEST-002 behoben — `scripts/checkNameableTypes/findUnnameableTypes.mjs`
  (`findUnnameableTypes`, `partitionAccepted`), `checkNameableTypes.mjs` nur Verdrahtung,
  Specs `findUnnameableTypes.test.mjs` (8 Fälle) und `checkNameableTypes.test.mjs` (Exit
  1/0/2)
- TEST-044 behoben — Zweig `ts.isImportTypeNode(node) → node.qualifier ?? null` in
  `referencedName`, Test »an import type is judged by the name it imports«
- CFG-002 behoben — `scripts/shared/readCompilerOptions.mjs`, genutzt von
  `compileSnippets.mjs` (mit Overrides) und `checkNameableTypes.mjs` (Root-tsconfig ohne
  Overrides); Inputs in `packages/twopoint5d-testing/project.json`
- CFG-021 behoben — `compileSnippets.mjs` liest die Optionen vor der Früh-Rückkehr, Test
  »an unreadable tsconfig throws even when no block is marked«
- TEST-037 behoben — neuer Fall am Ende von `extractSnippets.test.mjs`
- READ-016 behoben — `checkDocSnippets.mjs` `const snippets`, `const problems`
- DOC-058 behoben — Usage-Zeilen `checkDocSnippets.mjs:12`, `checkNameableTypes.mjs:6–7`
- DOC-054 behoben (Abweichung wie in Zug 0 entschieden) — `resolveDependencies.mjs:11–24`,
  `typeof`-Guard an `pkgVersion`, `findUnpublishableSpecifiers.mjs:11`,
  `makePackageJson.mjs:62` mit `JSON.stringify`
- DOC-055 behoben — `docs/architecture.md` §4 »on a missing directory, on a second one and
  on any other option«
- DOC-056 behoben — Kommentar zum Trimmen in `resolveDependencies.mjs`
- DOC-057 behoben — Warnung »has no version semver can read«
- READ-018 behoben — `publishedVersions.mjs:2–4`, `createCacheServer.test.mjs:20–21`
- Dazu: `@typedef OpenFence` mehrzeilig · `architecture.md:143` umbrochen · `ci.yml`
  fünf Kommentarzeilen umbrochen · beide `startsWith`-Stellen · Umbrüche unter `scripts/`
  und in `architecture.md` (Wortlaut per Token-Vergleich gleich)

Kleine Befunde (lösen keine Runde aus):
- `scripts/lookbook/demoMetadata.test.mjs:27–30` — Code-Zeile, die mit `/** @type */`
  begann und von Probe 1 erfasst wurde, in zwei `const` gehoben; verhaltensgleich, aber
  mehr als ein Umbruch
- `docs/architecture.md:376–377` — §6-Absatz ausgefranst umbrochen (Zeile 376 mit 70
  Zeichen, »their« passte noch)
- `docs/architecture.md:69` — »a marked block can sit in any of them« bezieht sich nach
  dem Einschub zum tsconfig-Leser auf eine unklare Aufzählung (gemeint: die
  Markdown-Dateien)
- Commit-Message nennt weder den neuen Input von `twopoint5d-testing:typecheck` noch die
  Doku-Ergänzungen in §3–§6

Anmerkung zu den Proben: macOS-`awk` zählt Bytes; die Usage-Zeile
`checkDocSnippets.mjs:12` hat 90 Zeichen, 92 Bytes (»…«). Probe 1 und 3 liefen deshalb
mit `perl -CSD` (`paket-4.verify.sh`).
