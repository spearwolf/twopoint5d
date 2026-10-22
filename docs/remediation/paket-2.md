# Paket 2 — Repo-Checks und Test-Helfer korrigieren

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUILD-002 (low), RES-009 (low), SEC-002 (low), TEST-013 (low), RES-008 (low), TEST-011 (low), TEST-012 (low)
- Ziel: Manifest-, Peer-Only- und Doc-Snippet-Check erfassen alle Formen, die sie prüfen sollen, und die Test-Helfer (`measureAllocatedBytes`, `spriteGraph`) rechnen korrekt und räumen auf.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `scripts/makePackageJson.mjs`, `scripts/makePackageJson/findUnpublishableSpecifiers.mjs`, `scripts/makePackageJson/removeDistPathPrefix.mjs` samt ihren `*.test.mjs` und `scripts/makePackageJson/makePackageJson.test.mjs`
  - `scripts/publishNpmPkg.mjs`, `scripts/publishNpmPkg/checkManifest.mjs`, `scripts/publishNpmPkg/publishedVersions.mjs`, neu `scripts/publishNpmPkg/registryEnvironment.mjs`, samt ihren `*.test.mjs` (neu `registryEnvironment.test.mjs`)
  - `scripts/checkPeerDependenciesOnly.mjs`, `scripts/checkPeerDependenciesOnly/findRuntimeDependencies.mjs`, `findRuntimeDependencies.test.mjs`, `checkPeerDependenciesOnly.test.mjs`
  - `scripts/checkDocSnippets/extractSnippets.mjs`, `extractSnippets.test.mjs`
  - `packages/twopoint5d/src/testing/measureAllocatedBytes.ts`, `measureAllocatedBytes.spec.ts`
  - `packages/twopoint5d/src/testing/spriteGraph.ts`, `spriteGraph.spec.ts`
  - Doku: `docs/architecture.md` (§3 Bullet `lintPkg`, §4 Build and publish pipeline), `AGENTS.md` (Abschnitt »Code blocks in Markdown«)
- Kein CHANGELOG-Eintrag: nichts davon erreicht das veröffentlichte Paket. `scripts/` wird nicht veröffentlicht, `src/testing/` erreicht `dist/` nie (AGENTS.md), und das erzeugte Manifest von `@spearwolf/twopoint5d` bleibt Byte für Byte gleich — es trägt weder `link:`/`file:`/`portal:` noch eines der neu umgeschriebenen Pfadfelder.

## Vorgehen

Für jeden Punkt gilt: zuerst den Regressionstest schreiben und rot laufen
sehen (Kommando und Ausgabe des roten Laufs in den Report), dann beheben.
Testnamen wie angegeben, Englisch. Kommentare erklären, warum etwas so ist —
keine Finding-IDs, kein »früher«, kein »jetzt auch«.

`scripts/publishNpmPkg.mjs` wird **nie ausgeführt**, auch nicht mit
`--dry-run` und auch nicht, um diese Änderung zu prüfen. Geprüft wird es über
die Helfer in `scripts/publishNpmPkg/` und `pnpm test:scripts`; die
Verdrahtung im Skript selbst prüft der Review.

### 1. Manifest: unveröffentlichbare Protokolle und `dist/`-Pfade (BUILD-002)

1. `findUnpublishableSpecifiers.mjs`: ein Specifier ist unveröffentlichbar,
   wenn er kein String ist oder auf `/^(catalog|workspace|link|file|portal):/`
   passt. Regex als Modulkonstante (`UNPUBLISHABLE_PROTOCOL`). JSDoc: `link:`,
   `file:` und `portal:` zeigen auf einen Pfad auf der Maschine, die das Paket
   baut — beim Konsumenten gibt es ihn nicht.
   Test in `findUnpublishableSpecifiers.test.mjs`:
   `names every link:, file: and portal: specifier, which point at a path on the machine that builds the package`
   — je einer in `dependencies`, `peerDependencies`, `optionalDependencies`
   (z. B. `link:../a`, `file:../b.tgz`, `portal:../c`), dazu ein `npm:x@^1`
   und ein `github:o/r`, die **nicht** genannt werden.
2. `removeDistPathPrefix.mjs` schreibt diese Felder um (nur ein führendes
   `dist/` oder `./dist/` fällt, wie bisher in `removeDistPrefix()`):
   - Strings: `main`, `module`, `types`, `typings`.
   - Rekursiv wie `exports` (Strings, Arrays, Objekte, `null` bleibt):
     `exports`, `imports`, `bin`, `typesVersions`. Dabei werden nur Werte
     umgeschrieben, nie Schlüssel — Subpfade, `#`-Namen, Befehlsnamen und die
     Versionsbereiche und Muster von `typesVersions` sind keine Dateipfade.
     Die Hilfsfunktion `removeDistPrefixFromExports` heißt danach
     `removeDistPrefixFromTargets`.
   - `browser`: als String umgeschrieben; als Objekt werden Schlüssel **und**
     String-Werte umgeschrieben (beide sind Pfade im Paket), ein Wert `false`
     bleibt stehen.
   JSDoc der Funktion nennt die Felder. Tests in `removeDistPathPrefix.test.mjs`:
   - `removes a leading dist/ from bin, as a path and as a map of commands`
   - `rewrites typings, imports and every path of typesVersions` (z. B.
     `typesVersions: {'>=5': {'*': ['dist/types/*']}}` → `['types/*']`,
     Schlüssel bleiben)
   - `rewrites browser as a path, and the keys and paths of a browser map, keeping a false entry`
3. `makePackageJson.mjs`: `removeDistPathPrefix(outPackageJson)` wandert
   hinter die Schleife, die `package.override.json` einmischt (heute Z. 41,
   vor Z. 50–56) — ein Pfad, den der Override bringt, wird sonst nie
   umgeschrieben. Gleiche Ursache wie das Finding, deshalb hier.
   Kommentar an der Stelle: warum nach dem Override. Den Kommentar Z. 58
   (»a manifest that still names a pnpm protocol«) auf die erweiterte Menge
   anpassen. Test in `makePackageJson.test.mjs`: `run()` bekommt eine Option
   `override` (Objekt, wird als `package.override.json` in das Testverzeichnis
   geschrieben); neuer Fall
   `rewrites a dist/ path that package.override.json brings in` — Override
   `{bin: {probe: './dist/cli.js'}}`, im geschriebenen Manifest steht
   `bin.probe === './cli.js'`.

### 2. Publish: Versionsprüfung mit Frist und derselben Registry wie der Publish (RES-009)

Abweichung von der Empfehlung, mit Grund: `npm publish` übernimmt
`publishConfig.registry` aus dem Manifest vor jeder Konfigurationsdatei und
jeder Umgebungsvariable (npm 11.19, `lib/commands/publish.js`: `publishConfig`
wird geflattet, nur CLI-Flags gehen vor), `npm show` liest `publishConfig`
gar nicht. `packages/twopoint5d/package.json` setzt
`publishConfig.registry`. Die `.npmrc` allein vor `npm show` zu kopieren
(Empfehlung, erste Variante) ließe bei einer `.npmrc` mit anderer Registry
`npm show` dorthin fragen und `npm publish` nach `publishConfig` gehen — die
Abweichung bliebe. `--registry` auf beiden Kommandozeilen (zweite Variante)
scheitert an `PLAIN_ARGUMENT` in `npmCommand.mjs:3` (`:` ist nicht erlaubt)
und an der Regel, dass kein Wert aus dem Manifest auf einer Kommandozeile
steht (`publishNpmPkg.mjs:48–49`, `docs/architecture.md` §4). Deshalb beides:
Kopie vor `npm show` (gleiche `.npmrc`, gleiche Auth- und Scope-Einstellungen)
**und** `publishConfig.registry` als Umgebungsvariable an `npm show`.

1. `checkManifest.mjs`: hat das Manifest `publishConfig.registry` (Schlüssel
   vorhanden), muss der Wert ein String sein, den `URL.canParse()` annimmt und
   dessen `protocol` `http:` oder `https:` ist; sonst wirft es:
   ```js
   throw new Error(`publishConfig.registry is ${JSON.stringify(value)}, which is no http or https URL`);
   ```
   Fehlen Name/Version, bleibt die bestehende Meldung die erste Prüfung.
   JSDoc ergänzen. Tests in `checkManifest.test.mjs`:
   - `a publishConfig.registry that is no http or https URL is named`
     (Werte `42`, `''`, `'registry.npmjs.org'`, `'file:///tmp/registry'`)
   - `a manifest with an https publishConfig.registry, or without publishConfig, passes`
2. Neu `scripts/publishNpmPkg/registryEnvironment.mjs`, nur Node-Built-ins
   oder gar keine Importe (`builtinImportsOnly.test.mjs` liest das
   Verzeichnis selbst):
   ```js
   /**
    * The environment `npm show` runs in. `npm publish` takes `publishConfig.registry` over every
    * config file and environment variable, `npm show` reads no `publishConfig` at all; handed in as
    * `npm_config_registry`, the version check asks the registry the publish goes to, and the value
    * from the manifest stands on no command line.
    * @param {{publishConfig?: {registry?: string}}} pkgJson checked by `checkManifest()`
    * @param {NodeJS.ProcessEnv} [env]
    * @returns {NodeJS.ProcessEnv}
    */
   export function registryEnvironment(pkgJson, env = process.env)
   ```
   Gibt immer ein neues Objekt zurück und ändert `env` nicht. Mit
   `publishConfig.registry`: jeder Schlüssel, der ohne Rücksicht auf
   Groß-/Kleinschreibung `npm_config_registry` heißt, fällt weg (npm liest
   `NPM_CONFIG_REGISTRY` und `npm_config_registry` gleichermaßen, welcher
   gewinnt, hängt von der Reihenfolge ab), dann `npm_config_registry` = der
   Wert. Ohne: eine Kopie von `env`. Tests in neuem `registryEnvironment.test.mjs`:
   - `hands publishConfig.registry to npm show as npm_config_registry, replacing one set in any case`
   - `leaves the environment as it is without publishConfig.registry`
   - `does not change the environment it is given`
3. `publishedVersions.mjs`: neue Exporte
   - `export const NPM_SHOW_TIMEOUT_MS = 60_000;` — Kommentar: der Publish-Job
     hat 10 Minuten; eine hängende Registry soll mit einer eigenen Zeile enden,
     nicht am Workflow-Limit.
   - `export function describeShowFailure(error, stderr)` → die eine Zeile für
     `console.error`: bei `error.killed === true`
     `` `npm show did not answer within ${NPM_SHOW_TIMEOUT_MS / 1000} s` ``,
     sonst `` `npm show failed: ${String(stderr ?? '').trim() || error.message}` ``
     (der Text, den das Skript heute in Z. 76 baut, samt dem Kommentar dazu).
   Tests in `publishedVersions.test.mjs`:
   - `describeShowFailure names the timeout for an npm show that was killed`
   - `describeShowFailure names npm's stderr, or the error message when stderr is empty`
4. `publishNpmPkg.mjs` umverdrahten, Reihenfolge danach:
   1. Argumente, Manifest lesen, `checkManifest()` — wie heute.
   2. `-dev`-Version: überspringen — wie heute, **vor** dem Kopieren.
   3. `releaseFiles()` und `copyFile()` für jede Datei (heute in
      `publishPackage()`, Z. 82–91), mit derselben Fehlerbehandlung.
      Kommentar: vor `npm show`, damit beide Aufrufe dieselbe `.npmrc` lesen.
   4. `execFile(show.file, show.args, {...show.options, cwd: packageRoot, timeout: NPM_SHOW_TIMEOUT_MS, env: registryEnvironment(pkgJson)}, …)`.
   5. Im Callback: `!error` → wie heute; `else if (!error.killed && isNotPublishedError(stderr))`
      → erster Publish wie heute (ein getötetes npm hat nichts beantwortet);
      sonst `console.error(describeShowFailure(error, stderr))`, Exit 1.
   6. `publishPackage(cwd, dryRun)` enthält nur noch `npm publish` samt
      Fehlerbehandlung und `process.exit(0)`.
   `npm publish` bekommt **keine** Frist: ein mitten im Upload getötetes
   `npm publish` hinterlässt einen ungewissen Stand, und den Job begrenzt
   `timeout-minutes: 10` in `deploy.yml`. `npm publish` bekommt auch kein
   `env` — `publishConfig` gilt dort ohnehin.

### 3. Peer-Only-Check: alle Modul- und Deklarationsformen, gebündelte Abhängigkeiten (SEC-002)

1. `checkPeerDependenciesOnly.mjs` Z. 40: Filter `/\.(c?js|mjs|d\.[cm]?ts)$/`
   — `.js`, `.cjs`, `.mjs`, `.d.ts`, `.d.cts`, `.d.mts`. `ts.preProcessFile`
   mit `detectJavaScriptImports` (dritter Parameter, in
   `findUndeclaredImports` schon `true`) erkennt `require('…')`; nichts
   daran ändern. Kopfkommentar Z. 1–11 auf die sechs Endungen und die
   gebündelten Abhängigkeiten anpassen.
   Test in `checkPeerDependenciesOnly.test.mjs`:
   `refuses an import in a .cjs, .d.mts or .d.cts file: exit code 1, message names each file`
   — `lib/a.cjs`: `const _ = require('lodash');`, `lib/b.d.mts`:
   `import type {X} from 'lodash';`, `lib/c.d.cts`:
   `export type T = import('tslib').X;`; jede der drei Dateien steht in
   `stderr`.
2. `findRuntimeDependencies.mjs`: nach `dependencies` und
   `optionalDependencies` je ein Eintrag `{section, name}` für jedes Element
   der Arrays `bundleDependencies` und `bundledDependencies` (npm kennt beide
   Schreibweisen), in dieser Reihenfolge. Ein Wert, der kein Array ist
   (`true` bündelt alle `dependencies`, die schon einzeln genannt sind;
   `false`), ergibt keinen Eintrag — Kommentar dazu. JSDoc anpassen.
   Tests in `findRuntimeDependencies.test.mjs`:
   - `names every entry of bundleDependencies and bundledDependencies`
   - `passes bundleDependencies: true, which bundles nothing but the dependencies named already`
   Die Meldung im Skript (`declares ${section}.${name}`) passt unverändert.

### 4. Doc-Snippet-Check: Tilde-Fences verfolgen, Fences im Zitat melden (TEST-013)

1. `extractSnippets.mjs` — die Muster und die Meldung wörtlich:
   ````js
   const OPENING_FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;
   const CLOSING_FENCE = /^\s*(`{3,}|~{3,})\s*$/;
   const QUOTED_FENCE = /^\s*>[\s>]*(`{3,}|~{3,})(.*)$/;

   // the problem a quoted fence with `check` in its info string reports
   `a code block marked \`${info}\` inside a blockquote is not checked — only a \`ts check\` block outside a quote is compiled`
   ````
   - `OpenFence` merkt sich das Fence-Zeichen (Property `fence`, Typ: das
     Zeichen Backtick oder Tilde) und die Länge (`ticks` heißt danach
     `size`). Geschlossen wird nur von einer Zeile aus demselben Zeichen mit
     mindestens derselben Länge (CommonMark) — eine Backtick-Zeile in einer
     Tilde-Fence ist Code und umgekehrt.
   - Die Regel »info string enthält einen Backtick → keine Fence« (Z. 68–73)
     gilt nur für Backtick-Fences; der Info-String einer Tilde-Fence darf
     Backticks enthalten (CommonMark).
   - Ein mit `ts check` markierter Block in Tilde-Fence wird gefunden und
     compiliert wie einer in Backticks.
   - `QUOTED_FENCE` wird nur außerhalb einer offenen Fence und nur `inScope`
     geprüft: ist es eine gültige Fence (bei Backticks kein Backtick im Rest)
     und enthält ihr Info-String das Wort `check`, dann ein Problem mit der
     Zeile und der Meldung oben (`info` ist der getrimmte Info-String). Die
     Fence im Zitat wird nicht als offen verfolgt (ihre Codezeilen beginnen
     selbst mit `>` und öffnen nichts).
   - Kopfkommentar Z. 6–9 ergänzen: Backtick- und Tilde-Fences zählen gleich;
     ein Marker im Zitat wird gemeldet, weil `checkDocSnippets` Zitate nicht
     auspackt und der Block sonst still durchfiele.
2. `extractSnippets.test.mjs`: der Test »tilde fences are not fences« (Z. 96)
   hält das alte Verhalten fest und wird ersetzt. Die Testnamen wörtlich, in
   der Schreibweise der Datei (Backticks im String):
   ````js
   test('finds a block marked `ts check` in a tilde fence', …)
   test('a backtick fence line inside a tilde fence is code, and a tilde line inside a backtick fence too', …)
   test('a tilde fence closes only on tildes, at least as many as it opened with', …)
   test('the info string of a tilde fence may hold a backtick', …)
   test('a fence marked with `check` inside a blockquote is a problem with its line', …)
   // inside describe('in a CHANGELOG.md')
   test('a quoted marked fence in a released section is no problem', …)
   ````
   Inhalt: im zweiten Fall wird kein Marker im Inneren gefunden und keine
   Fence schließt vorzeitig. Im Zitat-Fall ergeben die Zeilen
   ```` > ```ts check ````, `> > ~~~ts check` und ```` > ```js check ```` je
   ein Problem mit ihrer Zeilennummer, ```` > ```ts ```` keins, und es gibt
   kein Snippet. Die Dokumente baut die Datei schon heute aus Zeilen mit der
   Konstante `FENCE`; für Tilden eine zweite Konstante daneben.
3. Heute trägt kein getracktes Markdown eine Tilde-Fence oder eine Fence im
   Zitat; dieses Kommando gibt nichts aus:
   ````bash
   git ls-files '*.md' | xargs grep -nE '^\s*(>\s*)*~{3,}|^\s*>[ >]*`{3,}'
   ````
   Wird `pnpm typecheck` trotzdem rot, ist das eine Folge dieser Änderung: im
   Report mit Datei und Zeile, und der Block wird korrigiert.
4. `AGENTS.md`, Abschnitt »Code blocks in Markdown«: ein Satz, dass Backtick-
   und Tilde-Fences gleich zählen und ein markierter Block im Zitat den Check
   scheitern lässt.

### 5. `measureAllocatedBytes`: Profiler auch bei Fehler stoppen (RES-008)

1. Test zuerst, in `measureAllocatedBytes.spec.ts`:
   `stops its GC profiler when a round throws, and rethrows` —
   `vi.spyOn(GCProfiler.prototype, 'start')` und `'stop'` (beide sind
   Prototyp-Methoden der JS-Klasse in `node:v8`), dann
   `expect(() => measureAllocatedBytes(() => { throw new Error('round failed'); }, {warmUpRounds: 0, rounds: 1})).toThrow('round failed')`
   — mit `warmUpRounds: 0`, damit der Wurf in einer gemessenen Runde fällt —,
   danach `stop` genau so oft aufgerufen wie `start` (1), Spies in `finally`
   bzw. `afterEach` mit `mockRestore()` zurücksetzen. Rot vor dem Fix: `stop`
   0-mal. Lässt sich der Prototyp nicht bespitzeln, zählt stattdessen ein
   `vi.mock('node:v8', …)`, der `GCProfiler` durch eine zählende Unterklasse
   ersetzt und `getHeapStatistics` durchreicht — in einer eigenen Spec-Datei
   `measureAllocatedBytes.profiler.spec.ts`, damit der Mock den bestehenden
   Test nicht trifft.
2. `measureAllocatedBytes.ts` Z. 49–56: `profiler.start()`, dann
   `try { start messen; Runden; end messen } finally { result = profiler.stop(); }`,
   Auswertung danach wie heute. Kommentar: ein gestarteter Profiler sammelt
   sonst für den Rest des Worker-Prozesses mit und verfälscht die folgenden
   Messungen der Datei. Die Werte `start` und `end` bleiben `used_heap_size`
   unmittelbar vor und nach den Runden.

### 6. `evaluateNode`: jeder Knoten einmal je Aufruf (TEST-011)

1. Test zuerst, in `spriteGraph.spec.ts`:
   `evaluateNode() works out a node read twice once` — eine Kette, die jeden
   Knoten auf beiden Seiten wiederverwendet (`let x = leaf; for 16×: x = add(x, x)`),
   Ergebnis `2 ** 16` bei `leaf` = 1. Gezählt werden die Lesezugriffe auf den
   Wert des Blatts (etwa ein `uniform(1)`, dessen `value` per
   `Object.defineProperty` durch einen zählenden Getter ersetzt ist — auf
   dem Knoten selbst, nicht auf einem Proxy davor; prüfen, dass der Zähler
   ohne Fix wirklich 65 536 zeigt). Erwartung: genau 1. Rot vor dem Fix über
   den Zähler, nicht über eine Zeitüberschreitung — ein synchroner Hänger
   hält den Vitest-Worker an, statt zu scheitern.
2. `spriteGraph.ts`: `evaluateNode(root)` wird zu
   `return evaluateCached(root, new Map());` mit einer internen
   `function evaluateCached(root: Node, cache: Map<Node, EvaluatedValue>): EvaluatedValue`,
   die den heutigen Rumpf trägt: zuerst `cache.get(root)` (ein Treffer wird
   zurückgegeben), am Ende das Ergebnis in `cache` ablegen; **jeder**
   rekursive Aufruf im Rumpf geht über `evaluateCached(…, cache)`. Der Cache
   lebt je Top-Level-Aufruf: Uniform-Werte können sich zwischen zwei Aufrufen
   ändern. Kommentar wie bei `nodesOf()` (Z. 13–17): ein Graph, der einen
   Knoten in jedem Kettenglied wiederverwendet, hat exponentiell viele Pfade.
   Zweiter Kommentar: ein gecachtes Array geht an jeden Verwender seines
   Knotens, deshalb verändert kein Zweig ein `EvaluatedValue` — heute tut es
   keiner (`zip`, `flatMap`, `toArray()` erzeugen neue Arrays), und so bleibt
   es. Signatur und Export von `evaluateNode` bleiben gleich.

### 7. `evaluateNode`: `round` wie WGSL (TEST-012)

1. Test zuerst, in `spriteGraph.spec.ts`:
   `evaluateNode() rounds halves to the even neighbour, as WGSL's round does`
   — `round(float(x))` aus `three/tsl` für `2.5 → 2`, `-2.5 → -2`,
   `3.5 → 4`, `-3.5 → -4`, `0.5 → 0`, `1.4 → 1`, `1.6 → 2`, dazu
   `round(vec2(0.5, 1.5)) → [0, 2]`. Rot vor dem Fix: `2.5` gibt 3.
2. `spriteGraph.ts`: modullokale Funktion
   ```ts
   // WGSL's round() takes a half to the even neighbour; GLSL ES leaves the direction of a half to
   // the implementation, so WebGPU is the backend the cpu follows
   const roundHalfToEven = (x: number): number => {
     const r = Math.round(x);
     return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
   };
   ```
   und `case 'round': return zip(a, 0, roundHalfToEven);`. Im TSDoc von
   `evaluateNode` hinter `round` vermerken, dass es Halbwerte zur geraden Zahl
   rundet wie WGSL.
3. Specs, die `evaluateNode` nutzen, liegen in `src/sprites/` und
   `src/texture/sampleFrameAt.spec.ts`. Wird einer davon rot, weil er auf
   einem exakten Halbwert das Aufrunden erwartet: Erwartung auf das
   WGSL-Ergebnis setzen, mit einem Kommentar, dass WGSL Halbwerte zur geraden
   Zahl rundet; Library-Code unter `src/sprites/` und `src/texture/` bleibt
   unberührt (das Runden in `sampleAtlasFrame()` und `tableFrame()` hat einen
   eigenen Auftrag). Jede solche Stelle mit Datei und Zeile in den Report
   unter »Folgen«.

### 8. Doku

- `docs/architecture.md` §3, Bullet `lintPkg` (Z. 141–147): die sechs
  Endungen, und dass auch `bundleDependencies`/`bundledDependencies` den Check
  scheitern lassen.
- `docs/architecture.md` §4 (Z. 284–293): `link:`, `file:` und `portal:`
  scheitern wie `catalog:` und `workspace:` (mit dem Grund aus 1.1); die
  Liste der umgeschriebenen Felder aus 1.2, `browser` mit seinen Schlüsseln;
  der Rewrite läuft nach dem Einmischen von `package.override.json`.
- `docs/architecture.md` §4 (Z. 300–309): LICENSE, CHANGELOG, README und
  `.npmrc` werden kopiert, bevor npm gefragt wird; `npm show` fragt die
  Registry aus `publishConfig.registry` (über `npm_config_registry`), die
  `npm publish` nimmt; nach 60 s ohne Antwort endet das Skript mit einer
  Zeile, die das sagt; `checkManifest` lehnt ein `publishConfig.registry` ab,
  das keine http- oder https-URL ist. Der Satz »so … no value from it stands
  on a command line« bleibt wahr und bleibt stehen.
- Den Abschnitt jeweils ganz lesen; was die Änderung sonst falsch macht,
  mitziehen.

## Verify

```bash
pnpm run ci
```

Das Gate des Projekts, Konvention vor jedem Commit. Gezielt vorab, für die
roten Läufe und Zwischenstände: `pnpm test:scripts`,
`pnpm nx test twopoint5d -- src/testing/`, `pnpm lint`, `pnpm typecheck`.
Der Baseline-Lauf brauchte mit Nx-Cache unter einer Minute; trifft der Cache
nicht und droht der Lauf die Bash-Frist von zehn Minuten zu reißen, wird er
abgekoppelt gestartet wie ein Implementierer (`setsid`, Exit-Code in eine
Datei daneben, in Blöcken warten).

## Commit

```
fix: refuse link:, file: and portal: specifiers and strip dist/ from every path field of the published manifest, give npm show a timeout and the registry npm publish uses, extend the peer-only check to CommonJS, .d.mts, .d.cts and bundled dependencies, check tilde-fenced doc blocks and report quoted ones, and have the test helpers stop the GC profiler on a failed round, evaluate a shared node once and round halves to even
```

## Für den Plan nach dem Commit

`Schnittstellen:` unter Paket 2 muss mindestens tragen:
`evaluateNode()` (`src/testing/spriteGraph.ts`) rundet Halbwerte zur geraden
Zahl wie WGSL und rechnet jeden Knoten einmal je Aufruf — ein Regressionstest
auf einem `.5`-Index (Runden in `sampleAtlasFrame()`, `tableFrame()`) zeigt auf
der CPU jetzt das WebGPU-Ergebnis · `extractSnippets()` compiliert
`ts check`-Blöcke in Tilde-Fences und meldet markierte Fences im Zitat ·
neue Exporte `registryEnvironment(pkgJson, env)`
(`scripts/publishNpmPkg/registryEnvironment.mjs`), `NPM_SHOW_TIMEOUT_MS` und
`describeShowFailure(error, stderr)` (`publishedVersions.mjs`) ·
`checkManifest()` lehnt ein `publishConfig.registry` ab, das keine http(s)-URL
ist · `findRuntimeDependencies()` nennt `bundleDependencies`/`bundledDependencies` ·
`findUnpublishableSpecifiers()` lehnt `link:`, `file:`, `portal:` ab ·
`removeDistPathPrefix()` schreibt `typings`, `bin`, `browser`, `imports`,
`typesVersions` um und läuft nach dem Override.

## Verlauf

- 2026-10-21 Zug 0: Detailplan steht · BUILD-002 unverändert (`findUnpublishableSpecifiers.mjs:12`, `removeDistPathPrefix.mjs:8`), dazu `makePackageJson.mjs:41` Rewrite vor dem Override (Z. 50–56), gleiche Ursache, aufgenommen · RES-009 unverändert (`publishNpmPkg.mjs:52`, `.npmrc`-Kopie in `publishPackage()` Z. 82–91), Empfehlung um `publishConfig.registry` erweitert · SEC-002 unverändert (`checkPeerDependenciesOnly.mjs:40`, `findRuntimeDependencies.mjs:1`) · TEST-013 unverändert (`extractSnippets.mjs:16–17`; Test `extractSnippets.test.mjs:96` hält das alte Verhalten) · RES-008 unverändert (`measureAllocatedBytes.ts:49–56`) · TEST-011 eine Zeile verschoben (`spriteGraph.ts:180`, Rekursion Z. 184–257) · TEST-012 unverändert (`spriteGraph.ts:228–229`) · Folgen aus Paket 1: keine · Offene Befunde: Queue leer, nichts übernommen · Restplan: keine Änderung
- 2026-10-22 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort medium, Session `remediate-twopoint5d-p2-impl-0`, Brief `paket-2.impl-0.brief.md`
- 2026-10-22 Zug 2: Report FERTIG (`paket-2.impl-0.json`, Session 4011ea64-bbba-4e07-999a-b27c1bc82d57) · 23 Dateien geändert, 2 neu (`registryEnvironment.mjs`, `registryEnvironment.test.mjs`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`)
- 2026-10-22 Zug 3: Reviewer (sonnet, medium) · alle sieben Findings behoben · kritisch 0, wichtig 0, klein 4 · Diff `paket-2.diff`, Report `paket-2.review-0.json`
- 2026-10-22 Zug 4: keine Runde nötig (nur kleine Befunde)
- 2026-10-22 Zug 5: Commit 698715a3 (25 Dateien), Verify aus Zug 2 trägt ihn (keine Änderung dazwischen)

## Review

Urteil des Reviewers je Finding (Report `paket-2.review-0.json`):

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| BUILD-002 | behoben | `scripts/makePackageJson/findUnpublishableSpecifiers.mjs:3` (`UNPUBLISHABLE_PROTOCOL`), `:15`; `removeDistPathPrefix.mjs` schreibt `typings`, `imports`, `bin`, `typesVersions`, `browser` um; `makePackageJson.mjs:55–57` Rewrite nach dem Override |
| RES-009 | behoben | `scripts/publishNpmPkg.mjs:54–65` Kopie vor `npm show`, `:68–74` `timeout` und `env: registryEnvironment(pkgJson)`, `:96` `!error.killed`, `:101` `describeShowFailure`; `publishedVersions.mjs:22–38`; `registryEnvironment.mjs` neu; `checkManifest.mjs:14–20` |
| SEC-002 | behoben | `scripts/checkPeerDependenciesOnly.mjs:35`; `findRuntimeDependencies.mjs:20–29` |
| TEST-013 | behoben | `scripts/checkDocSnippets/extractSnippets.mjs:17–19`, `:80–90`, `:96–98`, `:128`, `:134–137` |
| RES-008 | behoben | `packages/twopoint5d/src/testing/measureAllocatedBytes.ts:49–62`; Spec `:30–42` |
| TEST-011 | behoben | `packages/twopoint5d/src/testing/spriteGraph.ts` `evaluateCached`; Spec `spriteGraph.spec.ts:47–65` |
| TEST-012 | behoben | `packages/twopoint5d/src/testing/spriteGraph.ts:173–176` `roundHalfToEven`; Spec `spriteGraph.spec.ts:67–81` |

Kleine Befunde (lösen keine Runde aus):
- `scripts/checkDocSnippets/extractSnippets.mjs:8` — Kopfkommentar hat eine 127 Zeichen lange Zeile, Umgebung bricht bei ~90 um.
- `docs/architecture.md` §4, Absatz zu `catalog:`/`link:` — eine überlange Zeile, nicht umbrochen wie der Rest.
- `scripts/checkDocSnippets/extractSnippets.mjs:79–82` — Destrukturieren mit doppeltem Cast umständlich; `quoted[1]`/`quoted[2]` mit einem Cast wie in `:92–93` reichten.
- `scripts/publishNpmPkg.mjs:54–65` — die Release-Dateien werden auch auf dem Pfad »Version schon veröffentlicht« kopiert; fehlt eine, scheitert der Lauf dort. Vom Detailplan so verlangt, `docs/architecture.md` nennt es nicht, lügt aber nicht.

Nebenbefund des Implementierers, Urteil: `scripts/checkDocSnippets/extractSnippets.mjs:11` `OPENING_FENCE` mit `(\s*)` nimmt auch vier und mehr Leerzeichen Einrückung als Fence-Anfang; nach CommonMark ist das ein eingerückter Codeblock. Vorbestehend (`git show d39433f2:scripts/checkDocSnippets/extractSnippets.mjs` hat dasselbe `(\s*)`), eigene Ursache neben der Tilde-Erweiterung, Scope-Regel »alles« greift → Scope, in »Offene Befunde«.

## Abgleich

| Finding | Urteil | Fundstelle heute |
| --- | --- | --- |
| BUILD-002 | unverändert | `scripts/makePackageJson/findUnpublishableSpecifiers.mjs:12` prüft nur `catalog:`/`workspace:`; `scripts/makePackageJson/removeDistPathPrefix.mjs:8` nur `main`, `module`, `types` (+ `exports` Z. 14–16). Zusätzlich: `scripts/makePackageJson.mjs:41` schreibt um, bevor `package.override.json` (Z. 50–56) eingemischt wird — ein Pfad aus dem Override behielte sein `dist/`. Gleiche Ursache, im Paket. |
| RES-009 | unverändert | `scripts/publishNpmPkg.mjs:52` `execFile` ohne `timeout`; `releaseFiles()`/`copyFile()` in `publishPackage()` Z. 82–91, also nach `npm show`. Dazu `publishConfig.registry` in `packages/twopoint5d/package.json` (Schlüssel `publishConfig`), das nur `npm publish` liest — Grund der Abweichung in Schritt 2. |
| SEC-002 | unverändert | `scripts/checkPeerDependenciesOnly.mjs:40` filtert nur `.js`, `.mjs`, `.d.ts`; `scripts/checkPeerDependenciesOnly/findRuntimeDependencies.mjs:1` kennt nur `dependencies`, `optionalDependencies`. |
| TEST-013 | unverändert | `scripts/checkDocSnippets/extractSnippets.mjs:16–17` nur Backtick-Fences; kein Zitat-Check. |
| RES-008 | unverändert | `packages/twopoint5d/src/testing/measureAllocatedBytes.ts:49–56` `start()` … `stop()` ohne `try/finally`. |
| TEST-011 | verschoben | `packages/twopoint5d/src/testing/spriteGraph.ts:180` (Audit: 179), rekursive Aufrufe Z. 184–257 ohne Cache. |
| TEST-012 | unverändert | `packages/twopoint5d/src/testing/spriteGraph.ts:228–229` `case 'round': return zip(a, 0, Math.round);`. |

## Restplan

- Reihenfolge und Schnitt der offenen Pakete bleiben. Paket 3 hängt laut Plan
  von diesem Paket ab (»Doc-Snippet-Check erfasst Tilde-Fences«); DX-001
  braucht die Tilde-Fences zwar nicht — seine zwei Blöcke stehen in
  Backticks —, die Abhängigkeit schadet aber nicht, weil Paket 2 ohnehin
  vorher läuft.
- Pakete 7 und 11 (Runden eines Float-Index in `tableFrame()` und
  `sampleAtlasFrame()`) profitieren von Schritt 7: ihr Regressionstest auf
  einem `.5`-Wert ist auf der CPU dann vor dem Fix rot. Die Schnittstellen-Zeile
  oben trägt das weiter; an ihrem Schnitt ändert es nichts.

## Findings im Volltext

**BUILD-002 · low · scripts/makePackageJson/findUnpublishableSpecifiers.mjs:12** (auch `scripts/makePackageJson/removeDistPathPrefix.mjs:8`) — Manifest-Prüfung um `link:`, `file:` und `portal:` erweitern
Nur `catalog:` und `workspace:` gelten als unveröffentlichbar; ein `link:`-, `file:`- oder `portal:`-Specifier (Pnpm-Overrides, lokale Entwicklungsstände) gelangt ungeprüft ins veröffentlichte Manifest. `removeDistPathPrefix` schreibt zudem nur `main`, `module`, `types` und `exports` um; `bin`, `typesVersions` oder `browser` blieben mit `dist/`-Präfix stehen, falls das Paket sie je bekommt (derzeit nicht gesetzt).
Beleg: `specifier.startsWith('catalog:') || specifier.startsWith('workspace:')`; `['main', 'module', 'types']`
Empfehlung: Regex `^(catalog|workspace|link|file|portal):` verwenden und `bin`/`typesVersions` im Rewrite ergänzen, oder eine Prüfung ergänzen, dass kein Pfad im Manifest mit `dist/` beginnt.

**RES-009 · low · scripts/publishNpmPkg.mjs:52** — Timeout für `npm show` in der Publish-Pipeline setzen
`execFile('npm', ['show', …])` läuft ohne `timeout`. Hängt die Registry oder das Netz, blockiert der Release-Job bis zum Limit des Workflows. Zudem liest `npm show` vor dem Kopieren des Workspace-`.npmrc` (Z. 84–91) nur die Konfiguration ohne diese Datei, `npm publish` danach mit ihr: bei abweichender Registry im `.npmrc` fragt die Versionsprüfung eine andere Registry als der Publish.
Beleg: `execFile(show.file, show.args, {...show.options, cwd: packageRoot}, …)`
Empfehlung: `timeout: 60_000` ergänzen; die `releaseFiles` vor dem `npm show` kopieren oder die Registry explizit per `--registry` an beide Aufrufe geben.

**SEC-002 · low · scripts/checkPeerDependenciesOnly.mjs:40** — Peer-Only-Check auf `.cjs`, `.d.mts` und `.d.cts` ausdehnen
Der Dateifilter erfasst `.js`, `.mjs` und `.d.ts`. Importe in `.cjs`, `.d.mts` oder `.d.cts` fallen durch, der Gate bleibt grün. Das Paket ist heute ESM-only, aber der Check soll genau zusichern, dass nichts außer Peers importiert wird; ein zukünftiger zweiter Build-Output würde unbemerkt ausgenommen.
Beleg: `/\.(js|mjs|d\.ts)$/`
Empfehlung: Regex auf `/\.(c?js|mjs|d\.[cm]?ts)$/` erweitern; `bundleDependencies` in `findRuntimeDependencies` mitprüfen.

**TEST-013 · low · scripts/checkDocSnippets/extractSnippets.mjs:16** — Tilde-Fences und Zitatblöcke im Doc-Snippet-Check erfassen
`OPENING_FENCE` kennt nur Backtick-Fences direkt am Zeilenanfang (mit Einrückung). Ein `ts check`-Block in Tilde-Fence (`~~~`) oder im Blockquote (`> ```ts check`) wird weder kompiliert noch als falscher Marker gemeldet — der Gate liefert still grün. Umgekehrt kann ein Backtick-Beispiel in einer Tilde-Fence als Marker gelesen werden.
Beleg: `/^(\s*)(`{3,})(.*)$/`
Empfehlung: Tilde-Fences mitverfolgen und Zeilen, die mit `>` beginnen und ein Fence samt `check` enthalten, als Problem melden.

**RES-008 · low · packages/twopoint5d/src/testing/measureAllocatedBytes.ts:49** — GCProfiler in `measureAllocatedBytes` auch bei Fehler stoppen
Wirft `round()` während der Messrunden, bleibt der `GCProfiler` gestartet; er sammelt dann für den Rest des Worker-Prozesses bei jeder GC Statistiken mit. Ein fehlschlagender Allocation-Spec verfälscht so die Folgemessungen in derselben Datei.
Beleg: `profiler.start(); … for (…) round(); … profiler.stop()` ohne try/finally
Empfehlung: Rundenschleife in `try { … } finally { result = profiler.stop(); }` fassen.

**TEST-011 · low · packages/twopoint5d/src/testing/spriteGraph.ts:179** — `evaluateNode` mit Memoization gegen exponentielle Laufzeit versehen
`nodesOf` und `graphSignature` besuchen jeden Knoten einmal, weil der Kommentar erklärt, dass ein Graph, der pro Kettenglied denselben Knoten wiederverwendet (der abgerollte Search von `AnimatedFrames`), exponentiell viele Pfade hat. `evaluateNode` dagegen läuft als reiner Baumabstieg: jeder mehrfach referenzierte Knoten wird je Verweis neu berechnet. Auf einem solchen Graphen wächst die Laufzeit mit 2^Tiefe, der Spec hängt statt zu fehlschlagen.
Beleg: `evaluateNode(node.aNode!)` / `evaluateNode(node.bNode!)` ohne Cache, Z. 183–256
Empfehlung: Eine `Map<Node, EvaluatedValue>` je Top-Level-Aufruf mitführen (interne Hilfsfunktion mit Cache-Parameter).

**TEST-012 · low · packages/twopoint5d/src/testing/spriteGraph.ts:228** — `round` in `evaluateNode` wie die GPU auf gerade Zahl runden
Der CPU-Evaluator nutzt `Math.round`, das bei x.5 aufrundet (2.5 gibt 3, -2.5 gibt -2). WGSL `round` rundet halbe Werte zur nächsten geraden Zahl (2.5 gibt 2). Ein Spec, der Pixel-Snapping auf exakten Halbwerten prüft, bestätigt ein Ergebnis, das die GPU nicht liefert.
Beleg: `case 'round': return zip(a, 0, Math.round);`
Empfehlung: Round-half-to-even implementieren (`const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r`) und mit einem Test belegen.
