# Paket 7 — Build-Skripte und Lookbook

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-093 (low), BUG-094 (low), BUG-095 (low)
- Ziel: Die Publish-Pipeline erkennt Erstveröffentlichungen und löst workspace:/catalog:-Versionen richtig auf, und die Crosses-Demo rechnet Grad korrekt um.
- Mitgenommen: ein vorbestehender Nebenbefund gleicher Ursache wie BUG-094 — `resolvePackageVersion(pkgName, isCatalog)` bekommt vom Specifier nur ein Boolean und verliert damit alles hinter dem Protokoll: den Katalognamen (das Finding) und ebenso den Operator bzw. Bereich eines `workspace:`-Specifiers (`workspace:~` und `workspace:^2.0.0` würden als `^<version>` veröffentlicht). Ein Fix, der den Specifier durchreicht, schließt beides; ließe er den Operator liegen, wäre dieselbe Ursache halb behoben.
- Modell: mittlere Stufe (sonnet)
- Effort: medium
- Dateien:
  - geändert: `scripts/publishNpmPkg.mjs`, `scripts/makePackageJson.mjs`, `apps/lookbook/src/demos/crosses/Crosses.ts`, `apps/lookbook/src/pages/demos/crosses.astro`, `package.json` (Root), `nx.json`, `AGENTS.md`, `docs/architecture.md`
  - neu: `scripts/publishNpmPkg/publishedVersions.mjs`, `scripts/publishNpmPkg/publishedVersions.test.mjs`, `scripts/makePackageJson/resolveDependencies.mjs`, `scripts/makePackageJson/resolveDependencies.test.mjs`, `scripts/makePackageJson/findUnpublishableSpecifiers.mjs`, `scripts/makePackageJson/findUnpublishableSpecifiers.test.mjs`
  - nicht anfassen: `packages/twopoint5d/**` (Bibliothek), `packages/twopoint5d/CHANGELOG.md`, `apps/lookbook/src/pages/demos/_crosses.json` (der Tippfehler »VertexObjcts« dort ist DOC-026 und gehört nicht in dieses Paket)
- Verify: `pnpm run test:scripts && pnpm run ci`
- Commit: `fix: recognize a first publish by npm's E404 code, read a single published version as a list, resolve workspace: and named catalog: specifiers from the package and catalog they name, fail the manifest build on a specifier left unresolved and rotate the crosses demo by degrees`
  - Body (eine Zeile, Leerzeile davor): `The helpers of both publish scripts move into modules of their own with node:test specs, which the gate runs as test:scripts.`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · BUG-093 unverändert (`scripts/publishNpmPkg.mjs:28-46`), mit npm 11.19.1 nachgestellt · BUG-094 unverändert (`scripts/makePackageJson.mjs:63-77`, gelesen wird `:76`), umgeformt: schlimmer als beschrieben — `catalog:<name>` bekommt still den Bereich des Default-Katalogs, ein nur unter `catalogs.default` erklärter Katalog wirft `TypeError` · BUG-095 unverändert (`apps/lookbook/src/demos/crosses/Crosses.ts:77-80`, `crosses.astro:47`), in Node nachgestellt · offene Folgen im Plan: keine · »Offene Befunde«: keiner mit gleicher Ursache; neu in die Queue: `removePathPrefixAt` (`scripts/makePackageJson.mjs:113-116`) · mitgenommen: Operator von `workspace:`-Specifiern · Restplan: Paket 7 ist das letzte offene Paket, nichts umzusortieren
  - 2026-09-19 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort medium, Session `remediate-twopoint5d-p7-impl-1`, Report `paket-7.impl-1.json`
  - 2026-09-19 Zug 2: Report FERTIG · geändert `scripts/publishNpmPkg.mjs`, `scripts/makePackageJson.mjs`, `apps/lookbook/src/demos/crosses/Crosses.ts`, `apps/lookbook/src/pages/demos/crosses.astro`, `package.json`, `nx.json`, `AGENTS.md`, `docs/architecture.md` · neu `scripts/publishNpmPkg/publishedVersions{,.test}.mjs`, `scripts/makePackageJson/resolveDependencies{,.test}.mjs`, `scripts/makePackageJson/findUnpublishableSpecifiers{,.test}.mjs` · roter Lauf `paket-7.red.log` (exit=1, 11 rot + Ladefehler wie geplant), Crosses rot `paket-7.cross-red.log` / grün `paket-7.cross-green.log` · Verify des Implementierers Exit 0 (`paket-7.impl-1.verify.log`), cmp gleich · Arbeitsbaum jetzt schmutzig
  - 2026-09-19 Zug 3: Reviewer beauftragt, mittlere Stufe (sonnet), Effort medium, Diff `paket-7.diff`, Report `paket-7.review-1.json`
  - 2026-09-19 Zug 3: Review 1 — BUG-093, BUG-094, BUG-095, Mitgenommener behoben · 0 kritisch, 0 wichtig, 5 klein · Diff `paket-7.diff`
  - 2026-09-19 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-19 Zug 5: Verify selbst `pnpm run test:scripts && pnpm run ci` exit=0 (`paket-7.verify.log`, 18/18 node:test grün, Browsertests aus dem Nx-Cache — Bibliothek unberührt), `cmp` dist/package.json gleich · Commit `0e7db162` (Message aus dieser Datei plus Co-Authored-By-Trailer wie die Vorgänger) · 5 Nebenbefunde in die Queue

## Harte Grenzen

- **`scripts/publishNpmPkg.mjs` wird nie ausgeführt**, auch nicht mit `--dry-run`, auch nicht über `pnpm publishNpmPkg` oder `pnpm nx … publishNpmPkg`. Kein Test importiert `publishNpmPkg.mjs`: das Modul fragt beim Laden die Registry ab und veröffentlicht. Tests importieren nur die Helfer-Module unter `scripts/publishNpmPkg/`. (Entscheidung im Plan vom 2026-09-19: Verifikation über Unit-Test der geänderten Funktion ohne Publish.)
- `scripts/makePackageJson.mjs` darf laufen — es ist Teil von `pnpm build` und schreibt nur `packages/twopoint5d/dist/package.json` (gitignored).
- Umfang ist dieses Paket. Die übrigen Audit-Findings zu diesen Dateien — Token-Präfixe im Log (`publishNpmPkg.mjs:18-19`, SEC-003), das Gate baut viermal (CFG-019), Magic Numbers in Demos (DOC-010) — bleiben liegen.

## Abgleich (Zug 0, HEAD `ef2e69e`)

Alle vier Fundstellen sind seit der Lauf-Basis `e352b56` unverändert (`git diff --quiet e352b56 HEAD -- <datei>`).

**BUG-093 — unverändert.** `scripts/publishNpmPkg.mjs:40` prüft `stderr.toString().includes('npm ERR! code E404')`. Nachgestellt mit npm 11.19.1 (`npm show @spearwolf/definitely-not-published-xyz-4711 versions --json`): Exit 1, stderr beginnt mit `npm error code E404`, stdout trägt `{"error": {"code": "E404", "summary": "Not Found - GET …", "detail": "…"}}`. Die Bedingung ist falsch, das Script nähme den Panic-Zweig (`:44-45`). Für eine einzige veröffentlichte Version antwortet `npm show … --json` mit einem nackten String (`npm show is-number@7.0.0 version --json` → `"7.0.0"`), `versions.includes(pkgJson.version)` (`:34`) wird dann zum Substring-Test.

**BUG-094 — unverändert, umgeformt.** `scripts/makePackageJson.mjs:75-76` prüft `pkgJsonPath` und liest `packageJsonPath` (das Manifest des Pakets, das gerade gebaut wird). Die Katalog-Behandlung (`:64-69`) ist schlimmer als im Audit beschrieben: `resolveDependencies` reicht nur `isCatalog` durch, `resolvePackageVersion` liest für **jeden** `catalog:`-Specifier `pnpmWorkspaceConfig.catalog[pkgName]` — `catalog:legacy` bekommt still den Bereich aus dem Default-Katalog, sobald das Paket dort auch steht; steht der Default-Katalog nur unter `catalogs.default` (laut pnpm gleichwertig zu `catalog:`), ist `pnpmWorkspaceConfig.catalog` `undefined` und die Zeile wirft `TypeError`. Fehlt ein Paket im Katalog, fällt die Suche heute auf das Workspace-Paket und die Root-Dependencies durch (`:72-86`) und liefert einen Bereich, den pnpm nie installiert hat. Unauflösbares endet in `console.warn` (`:88`), der Literal-Specifier landet in `dist/package.json`.

**BUG-095 — unverändert.** `apps/lookbook/src/demos/crosses/Crosses.ts:78` rechnet `(angle * 180) / Math.PI`, der Aufrufer `crosses.astro:47` übergibt Grad (`i * 45 + j * 0.2`). Nachgestellt in Node 25.9 mit der echten `Crosses.ts` (Type-Stripping) und dem gebauten `dist`: `rotate(90)` bringt Vertex 4 von `(0.5, 0.125)` nach `(-0.030496, -0.514485)` statt nach `(-0.125, 0.5)`. Die einzige weitere Grad-Umrechnung im Lookbook (`animated-billboards/BouncingSprites.ts:113`) rechnet richtig herum.

**Triage.** Keine offene `Folgen:`-Zeile im Plan (alle vorigen Folgen sind in den Paketen 8–11 geschlossen). Kein Eintrag in »Offene Befunde« teilt eine Ursache mit diesem Paket — alle liegen in der Bibliothek. Neu aufgefallen und in die Queue geschrieben: `removePathPrefixAt` (`scripts/makePackageJson.mjs:113-116`, vorbestehend seit `e352b56`) ersetzt das erste `dist/` irgendwo im Pfad statt nur ein führendes — eigene Ursache, → Scope. Mitgenommen in dieses Paket: der Operator von `workspace:`-Specifiern (siehe oben, gleiche Ursache wie der Katalogname).

## Entscheidungen dieses Pakets (mit Grund)

1. **Die Logik beider Skripte wandert in Helfer-Module, getestet mit `node --test`.** Beide Skripte laufen beim Laden los (`makePackageJson.mjs` schreibt, `publishNpmPkg.mjs` fragt die Registry und veröffentlicht); testbar sind nur ausgelagerte, seiteneffektfreie Funktionen. Der Ort folgt dem Vorbild `scripts/makeBanner/` (Helfer in einem Verzeichnis mit dem Namen des Skripts). Runner ist `node:test` mit `node:assert/strict`: keine neue Abhängigkeit, kein Config-File, Node ≥ 24 ist per `engines` garantiert. Vitest scheidet aus, weil es einen eigenen Config- und Projektrahmen bräuchte; die Skripte gehören keinem Nx-Projekt.
2. **Die Tests laufen im Gate.** Neues Root-Script `test:scripts`, in der `ci`-Kette vor `test:ci`. Ein Test, den das Gate nicht fährt, verrottet; die GitHub-CI (`.github/workflows/ci.yml:31`) fährt `pnpm run ci` als Ganzes und erbt den Schritt damit ohne Änderung am Workflow.
3. **Erstveröffentlichung erkennt `/\bE404\b/` in stderr** — die erste der beiden Empfehlungen (Plan-Entscheidung »wo die Empfehlung zwei Wege nennt, gilt der erste«). Das Muster trifft `npm ERR! code E404` und `npm error code E404` gleichermaßen.
4. **Abbruch nur für Specifier, die npm nicht installieren kann.** Die Empfehlung sagt »Exit 1 statt `console.warn`, wenn eine Version nicht auflösbar ist«. Umgesetzt als Wächter über das fertige Manifest: bleibt nach Auflösung und Override ein `catalog:`- oder `workspace:`-Specifier stehen, bricht der Build mit Exit 1 ab, bevor `dist/package.json` geschrieben wird. Ein unaufgelöstes `*` bricht **nicht** ab (Warnung bleibt): `*` ist ein gültiger Bereich, npm installiert ihn. Der Wächter läuft nach dem Override, weil `package.override.json` Abschnitte streicht (`devDependencies: null`) — ein unauflösbarer Eintrag dort darf den Build nicht brechen — und selbst Specifier einsetzen kann.
5. **Ein `catalog:`-Specifier wird nur aus seinem Katalog aufgelöst.** Fehlt das Paket dort, bleibt der Specifier stehen (Warnung, dann greift der Wächter). Ein Bereich aus einer anderen Quelle wäre einer, den pnpm nie installiert hat.
6. **`workspace:*` bleibt `^<version>`** — die Policy dieses Skripts, auch wenn `pnpm publish` exakt pinnen würde. Nur Specifier, die ihren Operator oder Bereich selbst nennen, bekommen ihn: das ist die mitgenommene Ursache, keine Policy-Änderung.
7. **`optionalDependencies` werden mit aufgelöst.** Der Wächter prüft den Abschnitt, also muss die Auflösung ihn auch kennen — sonst bräche ein auflösbarer Katalog-Eintrag dort den Build.
8. **Crosses: `rotate` nimmt Grad, rechnet mit `MathUtils.degToRad`** (die zweite Form der Empfehlung, weil sie das Idiom ist, das ein Leser kopieren soll; `MathUtils` ist aus `three/webgpu` exportiert, geprüft). Der Parameter heißt `degrees`, damit die Einheit an der Signatur steht.
9. **Crosses: die Drehung je Reihe wird sichtbar.** Mit korrekter Umrechnung dreht `j * 0.2` eine Säule über 20 Reihen um 3,8° — der Term wäre praktisch tot. Neu: `const TWIST = 90 / ROWS` (4,5° je Reihe), eine Säule dreht sich über ihre Tiefe um fast eine Vierteldrehung, die Periode der vierzähligen Symmetrie des Kreuzes; die letzte Scheibe gleicht der ersten also nicht wieder. `i * 45` bleibt: Säulen wechseln zwischen »+« und »×«. Überlappung ist in jeder Drehlage ausgeschlossen — der äußerste Vertex liegt bei Radius √(7,5² + 1,875²) ≈ 7,73, der halbe Säulenabstand ist `SIZE * OFFSET / 2` = 9. Eine Sichtprüfung im Browser ist deshalb nicht nötig.
10. **Kein Regressionstest im Repo für BUG-095, sondern eine Scratch-Prüfung.** Die Lookbook hat keinen Test-Runner (`apps/lookbook/package.json` kennt kein `test`), einen einzuführen sprengt ein Paket mit drei Low-Findings. Rot und Grün belegt ein Node-Skript im Arbeitsverzeichnis, das die echte `Crosses.ts` lädt (Schritt 2), Ausgabe in den Report.
11. **Kein CHANGELOG-Eintrag.** Nichts davon erreicht Nutzer von `@spearwolf/twopoint5d`: `dist/package.json` der Bibliothek bleibt byte-gleich (Schritt 6 prüft das), die Lookbook wird nicht veröffentlicht.

## Vorgehen

`$ARBEITSDIR` ist `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/e44e579b-d9de-4c01-acae-af1edfbe58ff/scratchpad`. Alle Logs und die Scratch-Prüfung liegen dort, nichts davon im Repo.

### Schritt 0 — Referenz des Manifests sichern

```bash
pnpm build:twopoint5d
cp packages/twopoint5d/dist/package.json "$ARBEITSDIR/paket-7.dist-package.before.json"
```

Erwarteter Inhalt der `peerDependencies` darin: `"@spearwolf/eventize": "^6.2.0"`, `"@spearwolf/signalize": "^1.0.0"`, `"three": "~0.185.1"`.

### Schritt 1 — Logik unverändert auslagern (reines Refactoring, Fehler bleiben drin)

Damit der rote Lauf in Schritt 2 die Defekte zeigt und nicht eine fehlende Datei.

**`scripts/publishNpmPkg/publishedVersions.mjs`** — zwei Exporte, heutige Logik wörtlich:

```js
export function parsePublishedVersions(stdout) {
  return JSON.parse(stdout);
}

export function isNotPublishedError(stderr) {
  return Boolean(stderr) && stderr.toString().includes('npm ERR! code E404');
}
```

`scripts/publishNpmPkg.mjs` importiert beide (`import {isNotPublishedError, parsePublishedVersions} from './publishNpmPkg/publishedVersions.mjs';`), `:30` wird `const versions = parsePublishedVersions(stdout);`, `:40` wird `} else if (isNotPublishedError(stderr)) {`. Sonst ändert sich an dem Skript in diesem Paket nichts.

**`scripts/makePackageJson/resolveDependencies.mjs`** — `resolveDependencies` und `resolvePackageVersion` aus `scripts/makePackageJson.mjs:49-90` wörtlich übernehmen, exportiert, mit einem dritten Parameter `context` statt der Modul-Globals:

- `export function resolveDependencies(dependenciesSection, context)` — reicht `context` an `resolvePackageVersion` durch.
- `export function resolvePackageVersion(pkgName, isCatalog, {workspaceRoot, packageJsonPath, pnpmWorkspaceConfig, sharedDependencies, referencedFrom})` — `inPackageJson.name` in der Warnung wird `referencedFrom`. `fs`/`path` als `node:fs`/`node:path` importieren.

`scripts/makePackageJson.mjs` baut `const context = {workspaceRoot, packageJsonPath, pnpmWorkspaceConfig, sharedDependencies, referencedFrom: inPackageJson.name};` und ruft `resolveDependencies(outPackageJson.dependencies, context)`, dasselbe für `devDependencies` und `peerDependencies` (die drei Abschnitte von heute); der Block `:47-90` entfällt dort.

Prüfen: `pnpm --dir packages/twopoint5d run makePackageJson && cmp packages/twopoint5d/dist/package.json "$ARBEITSDIR/paket-7.dist-package.before.json"` — muss gleich sein.

### Schritt 2 — Tests schreiben, rot sehen

Alle Tests mit `import {describe, it} from 'node:test';` (oder `test`) und `import assert from 'node:assert/strict';`, Testnamen auf Englisch, keine Finding-IDs.

**`scripts/publishNpmPkg/publishedVersions.test.mjs`**

| Test | Eingabe | Erwartung | vor dem Fix |
| --- | --- | --- | --- |
| `a single published version comes back as a list` | `parsePublishedVersions('"0.21.2"\n')` | `['0.21.2']` (`deepEqual`) | rot |
| `a list of published versions stays a list` | `parsePublishedVersions('[\n  "0.1.0",\n  "0.21.2"\n]\n')` | `['0.1.0', '0.21.2']` | grün |
| `a version that only starts the single published one is not published` | `parsePublishedVersions('"0.21.2"\n').includes('0.21')` | `false` | rot |
| `recognizes the not-found error of current npm` | `isNotPublishedError('npm error code E404\nnpm error 404 Not Found - GET https://registry.npmjs.org/@spearwolf%2fnot-published - Not found\n')` | `true` | rot |
| `recognizes the not-found error of older npm` | `isNotPublishedError('npm ERR! code E404\nnpm ERR! 404 Not Found - GET https://registry.npmjs.org/@spearwolf%2fnot-published - Not found\n')` | `true` | grün |
| `takes no other failure for a first publish` | `isNotPublishedError` mit `'npm error code E401\n'`, `'npm error code ETIMEDOUT\n'`, `''`, `undefined` | je `false` | grün |

**`scripts/makePackageJson/resolveDependencies.test.mjs`** — ein temporärer Workspace je Datei: `fs.mkdtempSync(path.join(os.tmpdir(), 'makePackageJson-'))`, darin `packages/other/package.json` = `{"name": "@scope/other", "version": "2.3.4-dev"}` und `packages/self/package.json` = `{"name": "@scope/self", "version": "9.9.9"}`; im `after`-Hook `fs.rmSync(dir, {recursive: true, force: true})`. Kontext je Test: `{workspaceRoot: dir, packageJsonPath: path.join(dir, 'packages/self/package.json'), pnpmWorkspaceConfig, sharedDependencies, referencedFrom: '@scope/self'}` — `pnpmWorkspaceConfig` und `sharedDependencies` aus der zweiten und dritten Angabe der Spalte unten, `sharedDependencies` ist `{}`, wo die Spalte keine dritte Angabe hat. Jeder Test ruft `resolveDependencies(section, context)` auf einem frischen Objekt und prüft das Objekt danach.

| Test | `section` / `pnpmWorkspaceConfig` / `sharedDependencies` | Erwartung danach | vor dem Fix |
| --- | --- | --- | --- |
| `a workspace:* dependency takes the version of the package it names` | `{'@scope/other': 'workspace:*'}` / `{}` | `'^2.3.4'` | rot (`^9.9.9`) |
| `a workspace:~ dependency keeps its operator` | `{'@scope/other': 'workspace:~'}` / `{}` | `'~2.3.4'` | rot |
| `a workspace:^ dependency keeps its operator` | `{'@scope/other': 'workspace:^'}` / `{}` | `'^2.3.4'` | rot (`^9.9.9`) |
| `a workspace: dependency with a range ships that range` | `{'@scope/other': 'workspace:^2.0.0'}` / `{}` | `'^2.0.0'` | rot |
| `an aliased workspace: dependency stays as it is` | `{'bar': 'workspace:@scope/other@*'}` / `{}` | `'workspace:@scope/other@*'` | grün |
| `catalog: and catalog:default resolve from the default catalog` | `{three: 'catalog:', '@types/three': 'catalog:default'}` / `{catalog: {three: '~1.0.0', '@types/three': '~1.0.1'}}` | `'~1.0.0'`, `'~1.0.1'` | grün |
| `a default catalog declared under catalogs.default resolves` | `{three: 'catalog:'}` / `{catalogs: {default: {three: '~1.0.0'}}}` | `'~1.0.0'` | rot (`TypeError`) |
| `catalog:<name> resolves from the named catalog` | `{three: 'catalog:legacy'}` / `{catalog: {three: '~1.0.0'}, catalogs: {legacy: {three: '~0.9.0'}}}` | `'~0.9.0'` | rot (`~1.0.0`) |
| `a catalog: dependency its catalog does not list stays as it is` | `{three: 'catalog:', extra: 'catalog:missing'}` / `{catalog: {}}` / `{three: '^0.1.0', extra: '^0.2.0'}` | `'catalog:'`, `'catalog:missing'` | rot (`^0.1.0`) |
| `a * dependency nothing resolves stays *` | `{unknown: '*'}` / `{}` | `'*'` | grün |

**`scripts/makePackageJson/findUnpublishableSpecifiers.test.mjs`** — importiert `findUnpublishableSpecifiers` aus `./findUnpublishableSpecifiers.mjs` (existiert vor dem Fix nicht; rot als fehlendes Modul, die anderen beiden Testdateien laufen davon unberührt).

| Test | Eingabe | Erwartung |
| --- | --- | --- |
| `names every catalog: and workspace: specifier left in a dependency section` | `{dependencies: {a: 'catalog:', b: '^1.0.0'}, peerDependencies: {c: 'workspace:*'}, optionalDependencies: {d: 'catalog:x'}, devDependencies: {e: 'workspace:^', f: '*'}}` | `[{section: 'dependencies', name: 'a', specifier: 'catalog:'}, {section: 'peerDependencies', name: 'c', specifier: 'workspace:*'}, {section: 'optionalDependencies', name: 'd', specifier: 'catalog:x'}, {section: 'devDependencies', name: 'e', specifier: 'workspace:^'}]` |
| `passes a manifest whose specifiers are all version ranges` | `{dependencies: {a: '^1.0.0', b: '*'}, peerDependencies: {c: '~0.185.1'}}` und `{}` | je `[]` |

**Scratch-Prüfung für die Crosses-Demo** — nicht ins Repo. Nach `$ARBEITSDIR/paket-7.cross-check.mjs` schreiben, genau so:

```js
import assert from 'node:assert/strict';
const root = '/home/spw/spaceland/twopoint5d';
const {CrossDescriptor} = await import(`${root}/apps/lookbook/src/demos/crosses/Crosses.ts`);
const {VertexObjectPool} = await import(`${root}/packages/twopoint5d/dist/lib/index.js`);
const pool = new VertexObjectPool(CrossDescriptor, 1);
const cross = pool.createVO();
cross.make(1, 1, 1 / 8, 1 / 2, 0);
// vertex 4 sits on the tip of the right arm: (+outer, +inner) = (0.5, 0.125)
cross.rotate(90);
const got = [cross.x4, cross.y4].map((v) => Math.round(v * 1e6) / 1e6);
console.log('vertex 4 after rotate(90):', got);
assert.deepEqual(got, [-0.125, 0.5]);
console.log('ok');
```

Roter Lauf, beide Ausgaben mit Exit-Code in den Report:

```bash
node --test "scripts/**/*.test.mjs" > "$ARBEITSDIR/paket-7.red.log" 2>&1; echo "exit=$?" >> "$ARBEITSDIR/paket-7.red.log"
node "$ARBEITSDIR/paket-7.cross-check.mjs" > "$ARBEITSDIR/paket-7.cross-red.log" 2>&1; echo "exit=$?" >> "$ARBEITSDIR/paket-7.cross-red.log"
```

Erwartet rot: die mit »rot« markierten Tests, `findUnpublishableSpecifiers.test.mjs` als Ladefehler, die Scratch-Prüfung mit `[-0.030496, -0.514485]`.

### Schritt 3 — Beheben

**`scripts/publishNpmPkg/publishedVersions.mjs`**, endgültig:

```js
/**
 * `npm show <name> versions --json` answers with a list, or with a bare string when
 * exactly one version is published. Either way this returns the list.
 */
export function parsePublishedVersions(stdout) {
  return [].concat(JSON.parse(stdout));
}

/**
 * Whether a failed `npm show` means the package was never published. Older npm
 * releases write `npm ERR! code E404`, current ones `npm error code E404` — the
 * error code is what both share.
 */
export function isNotPublishedError(stderr) {
  return /\bE404\b/.test(String(stderr ?? ''));
}
```

**`scripts/makePackageJson/resolveDependencies.mjs`**, endgültig:

- `resolveDependencies(dependenciesSection, context)`: für jeden Eintrag, dessen Specifier mit `catalog:` oder `workspace:` beginnt oder `*` ist, `resolvePackageVersion(depName, specifier, context)` aufrufen und bei einem Ergebnis eintragen. Kein Ergebnis → Eintrag bleibt unverändert. Kurze TSDoc/JSDoc: ersetzt die Specifier durch die Bereiche, für die sie stehen; was nichts auflöst, bleibt stehen.
- `resolvePackageVersion(pkgName, specifier, {workspaceRoot, pnpmWorkspaceConfig, sharedDependencies, referencedFrom})` — zweiter Parameter ist jetzt der Specifier selbst, `packageJsonPath` fällt aus dem Kontext (auch in `makePackageJson.mjs` und in `resolveDependencies.test.mjs` streichen; die Assertions der Tests bleiben unverändert).
  - `catalog:<name>`: `name = specifier.slice('catalog:'.length) || 'default'`. Für `default`: `pnpmWorkspaceConfig.catalog?.[pkgName] ?? pnpmWorkspaceConfig.catalogs?.default?.[pkgName]`; sonst `pnpmWorkspaceConfig.catalogs?.[name]?.[pkgName]`. Treffer → `console.log('resolve package version from workspace catalog', name, pkgName, '->', version)` und zurückgeben. Kein Treffer → `console.warn('oops.. package not found in workspace catalog:', name, pkgName, 'referenced from:', referencedFrom)` und `undefined` — **kein** Durchfallen auf Workspace-Paket oder Root-Dependencies (Entscheidung 5, ein Kommentar sagt warum).
  - sonst (`workspace:…` oder `*`): `range = specifier.startsWith('workspace:') ? specifier.slice('workspace:'.length) : '*'`. Enthält `range` ein `@` (Alias `workspace:<name>@<range>`), `console.warn` mit Paketname und `referencedFrom`, `undefined` zurück — ein Alias nennt ein anderes Paket als seinen Schlüssel, das bildet dieses Skript nicht ab.
  - Workspace-Paket wie heute unter `packages/<name ohne scope>/package.json` suchen, **`pkgJsonPath` lesen**. `version = pkgJson.version.replace(/-dev$/, '')`. Ergebnis: `range` ist `*` → `^${version}`; `^` oder `~` → `${range}${version}`; alles andere → `range` unverändert. `console.log('resolve package version', pkgName, '->', result)`.
  - Root-Dependencies-Fallback und abschließende Warnung wie heute (Text mit `referencedFrom`).

**`scripts/makePackageJson/findUnpublishableSpecifiers.mjs`**, neu:

```js
const DEPENDENCY_SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'];

/**
 * Lists every `catalog:` or `workspace:` specifier left in a manifest. npm installs
 * neither protocol, so a manifest that still carries one cannot be published.
 */
export function findUnpublishableSpecifiers(packageJson) {
  const found = [];
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, specifier] of Object.entries(packageJson[section] ?? {})) {
      if (specifier.startsWith('catalog:') || specifier.startsWith('workspace:')) {
        found.push({section, name, specifier});
      }
    }
  }
  return found;
}
```

**`scripts/makePackageJson.mjs`**:

- Kontext ohne `packageJsonPath` (die Konstante selbst bleibt, `:13` liest damit das Eingabe-Manifest).
- zusätzlich `resolveDependencies(outPackageJson.optionalDependencies, context);` neben den drei bestehenden Aufrufen (Entscheidung 7).
- nach der Override-Schleife, vor dem Schreiben von `dist/package.json`:

```js
// a manifest that still names a pnpm protocol cannot be installed from npm
const unpublishable = findUnpublishableSpecifiers(outPackageJson);
if (unpublishable.length > 0) {
  for (const {section, name, specifier} of unpublishable) {
    console.error(`cannot publish ${inPackageJson.name}: ${section}.${name} is "${specifier}", which resolves to no version range`);
  }
  process.exit(1);
}
```

**`apps/lookbook/src/demos/crosses/Crosses.ts`**: Import `import {MathUtils, Matrix4, Vector3} from 'three/webgpu';`, dann

```ts
  rotate(degrees: number) {
    this.transform(new Matrix4().makeRotationZ(MathUtils.degToRad(degrees)));
  }
```

**`apps/lookbook/src/pages/demos/crosses.astro`**: unter `const OFFSET_Z = -5;` einfügen

```js
  // degrees each cross turns against the one in front of it: over its depth a column
  // turns by almost a quarter turn, the angle after which a cross looks the same again
  const TWIST = 90 / ROWS;
```

und `cross.rotate(i * 45 + j * 0.2);` wird `cross.rotate(i * 45 + j * TWIST);`.

### Schritt 4 — Gate verdrahten

- Root-`package.json`, `scripts`: `"test:scripts": "node --test \"scripts/**/*.test.mjs\""` hinter `test:ci`/`test:browser` einsortieren; in `ci` `pnpm run test:scripts && ` direkt vor `pnpm run test:ci` einfügen. `cbt` bleibt Alias. Das Glob in Anführungszeichen expandiert Node selbst (geprüft mit Node 25.9: nur Dateien unter `scripts/` laufen, `packages/twopoint5d-testing/test/*.test.js` nicht).
- `nx.json`, `namedInputs.makePackageJson`: hinter `"{workspaceRoot}/scripts/makePackageJson.mjs"` die Einträge `"{workspaceRoot}/scripts/makePackageJson/*.mjs"` und `"!{workspaceRoot}/scripts/makePackageJson/*.test.mjs"`. Ohne sie baut Nx die Bibliothek nach einer Änderung an den Helfern aus dem Cache und `dist/package.json` bleibt alt.

### Schritt 5 — Doku nachziehen (Englisch)

- `AGENTS.md`, Abschnitt »Commands«: neuer Punkt hinter `pnpm test:affected`: `` `pnpm test:scripts` — `node --test` over the helpers of the publish pipeline (`scripts/**/*.test.mjs`); no Nx project owns them, so `pnpm test` does not run them ``. Im Punkt `pnpm run ci` die Kette um `test:scripts` vor `test:ci` ergänzen.
- `docs/architecture.md`:
  - §3: Kette `clean → lint → build → typecheck → checkPkgTypes → checkNameableTypes → lintPkg → test:scripts → test:ci → test:browser`; neuer Punkt in der Liste darunter: `` `test:scripts` runs `node --test` over `scripts/**/*.test.mjs`, the specs of the publish pipeline's helpers (§4). ``
  - §4, Absatz zu `makePackageJson.mjs`: der Satzteil »and `catalog:` versions are resolved to real ranges from `pnpm-workspace.yaml`« wird ersetzt durch eine Beschreibung der Regeln: `catalog:` und `catalog:<name>` aus dem Default- bzw. benannten Katalog in `pnpm-workspace.yaml`; `workspace:` aus dem `package.json` des genannten Pakets (`workspace:^`/`workspace:~` behalten ihren Operator, `workspace:*` wird ein Caret-Bereich, ein ausgeschriebener Bereich geht unverändert raus); bleibt danach ein `catalog:`- oder `workspace:`-Specifier im Manifest, bricht der Build ab — npm installiert keines der beiden Protokolle. Dazu ein Satz: die Logik beider Skripte liegt in `scripts/makePackageJson/` und `scripts/publishNpmPkg/` neben ihren `node --test`-Specs, die Skripte selbst verdrahten sie nur. Im Satz zu `publishNpmPkg`: es überspringt eine Version, die npm schon listet, und nimmt npms `E404` als Erstveröffentlichung.
  - §6: nach den zwei Runnern ein Absatz: die Helfer der Publish-Pipeline laufen unter `node --test` (`pnpm test:scripts`, kein Nx-Projekt); Specs importieren nur die Helfer-Module, nie `publishNpmPkg.mjs`, das beim Laden die Registry abfragt.
- Kein Satz über den Vorzustand (Konvention »kein Rückblick«), keine Finding-IDs.

### Schritt 6 — Verify

```bash
pnpm exec prettier --write package.json nx.json scripts/publishNpmPkg.mjs scripts/makePackageJson.mjs scripts/publishNpmPkg scripts/makePackageJson apps/lookbook/src/demos/crosses/Crosses.ts apps/lookbook/src/pages/demos/crosses.astro
pnpm run test:scripts
node "$ARBEITSDIR/paket-7.cross-check.mjs"
pnpm --dir packages/twopoint5d run makePackageJson && cmp packages/twopoint5d/dist/package.json "$ARBEITSDIR/paket-7.dist-package.before.json"
pnpm run ci
```

Alles grün, `cmp` ohne Ausgabe. Die `.md`-Dateien stehen in `.prettierignore`.

## Findings im Volltext

**BUG-093 · low · scripts/publishNpmPkg.mjs:28-46** — Den Erstveröffentlichungs-Zweig von publishNpmPkg.mjs reparieren: npm 11 schreibt »npm error«, nicht »npm ERR!«
npm ≥10.5 (Node 24 bringt npm 11) gibt nie mehr `npm ERR!` aus, sondern `npm error code E404`. Für ein nie veröffentlichtes Paket nimmt das Script den Panic-Zweig und beendet mit 1. Latent für dieses Paket (schon auf npm), aber das Script ist die Vorlage für jedes zweite Paket in diesem Workspace. Zudem liefert `versions --json` für ein Paket mit genau einer Version einen nackten String, und `versions.includes(…)` wird dann zum Substring-Match.
Empfehlung: Auf `/\bE404\b/` in `stderr` matchen oder das JSON-Fehlerobjekt parsen, das npm mit `--json` auf stdout schreibt; `versions` mit `[].concat(JSON.parse(stdout))` normalisieren.

**BUG-094 · low · scripts/makePackageJson.mjs:63-77** — resolvePackageVersion liest die falsche package.json für workspace:-Abhängigkeiten und kennt keine benannten Kataloge
`pkgJsonPath` wird auf Existenz geprüft, gelesen wird aber `packageJsonPath` (das Paket, das gerade gebaut wird), eine `workspace:*`-Abhängigkeit würde also mit dem Versionsbereich des *eigenen* Pakets veröffentlicht. Heute hat die Bibliothek nur `catalog:`-Peers, der Pfad ist tot; an dem Tag, an dem ein zweites Workspace-Paket referenziert wird, bekommt `dist/package.json` stumm einen falschen Bereich. Die `catalog:`-Behandlung kennt nur den Default-Katalog: `catalog:foo` fiele durch, und das Literal `catalog:foo` würde ausgeliefert.
Empfehlung: `pkgJsonPath` lesen; `catalog:<name>` über `pnpmWorkspaceConfig.catalogs?.[name]` auflösen; den Build mit Exit 1 abbrechen statt `console.warn`, wenn eine Version nicht auflösbar ist.

**BUG-095 · low · apps/lookbook/src/demos/crosses/Crosses.ts:77-80; apps/lookbook/src/pages/demos/crosses.astro:47** — Cross#rotate rechnet Grad falsch herum um
Der Aufrufer übergibt Grad (`i * 45`), `makeRotationZ` will Radiant, und die Umrechnung multipliziert mit 180/π statt π/180. 45° werden ≈2578 rad — das Bild wirkt nur deshalb absichtsvoll, weil das Aliasing die Kreuze zufällig streut. Als »minimal example of how to use the VertexObjects mesh« lehrt es ein falsches Idiom in der einen Methode, die ein Leser kopieren soll.
Empfehlung: `const theta = (angle * Math.PI) / 180;` (oder `THREE.MathUtils.degToRad`), dann die Konstanten in `crosses.astro:44-48` nachprüfen, damit das Layout weiter gut liest.

## Urteil des Reviewers (Review 1, `paket-7.review-1.json`)

- **BUG-093 — behoben.** `scripts/publishNpmPkg/publishedVersions.mjs:15-17` (`/\bE404\b/`), eingehängt in `scripts/publishNpmPkg.mjs:40`; Normalisierung `[].concat(JSON.parse(stdout))` in `publishedVersions.mjs:5-7`, Aufruf `publishNpmPkg.mjs:30`.
- **BUG-094 — behoben.** `scripts/makePackageJson/resolveDependencies.mjs:76` liest `pkgJsonPath`; `catalog:`/`catalog:default`/`catalog:<name>` in `:41-54`, kein Durchfallen auf andere Quellen; Abbruch mit Exit 1 in `scripts/makePackageJson.mjs:349-358` (vom Reviewer mit `catalog:nope` und `workspace:../x` provoziert, `dist/package.json` wird nicht geschrieben).
- **BUG-095 — behoben.** `apps/lookbook/src/demos/crosses/Crosses.ts:69-71` (`MathUtils.degToRad`), `apps/lookbook/src/pages/demos/crosses.astro:50` (`TWIST`).
- **Mitgenommen (Operator/Bereich von `workspace:`) — behoben.** `resolveDependencies.mjs:56-79`, alle vier Fälle getestet.

### Kleine Befunde

1. `scripts/makePackageJson/resolveDependencies.mjs:76-79`, `:81-86` — ein pfadförmiger Specifier wie `workspace:../other` gilt als ausgeschriebener Bereich und geht als `../other` raus; der Wächter (`findUnpublishableSpecifiers.mjs:13-19`) prüft nur das Präfix. Abhilfe: einen `range`, der kein gültiger semver-Bereich ist, verwerfen (Specifier bleibt stehen, Wächter bricht ab) oder im Wächter `semver.validRange` prüfen.
2. `resolveDependencies.mjs:81-86` — fehlt das genannte Workspace-Paket unter `packages/`, greift der Root-Fallback auch für einen ausgeschriebenen Bereich (`workspace:^2.0.0`) und liefert `sharedDependencies[pkgName]`; widerspricht `docs/architecture.md:169-170` (»a spelled-out range ships as it is«). Abhilfe: ausgeschriebenen Bereich vor dem Paket-Lookup zurückgeben.
3. `scripts/makePackageJson.mjs:349-358` — die Verdrahtung des Wächters (`process.exit(1)`) hat keinen Test, nur die reine Funktion; denkbar ein `spawnSync` gegen ein temporäres Verzeichnis.
4. `apps/lookbook/public/images/demo-preview/crosses.png` zeigt vermutlich noch die alte, gestreute Optik der Demo (nur am Dateinamen geprüft) — neu erzeugen.
5. Commit-Message ohne Scope (die Vorgänger schreiben `fix(<scope>):`), `scripts` wäre stimmiger; beibehalten wie im Detailplan. Der fehlende Trailer ist beim Commit ergänzt.

### Begründung der Urteile an den Nebenbefunden

- `removeDistPathPrefix` ohne `exports`: Absturz des Build-Skripts für eine gültige Manifest-Form — Korrektheitsdefekt, → Scope.
- `publishNpmPkg.mjs:11` fehlende Usage-Meldung: Bedienbarkeit, kein falsches Ergebnis — → Audit.
- `publishNpmPkg.mjs:29` Shell-Interpolation: Härtung, Eingabe stammt aus dem eigenen Manifest — → Audit (SEC).
- `crosses.astro` doppelte `body`-Regel und `console.dir`: Stil bzw. Aufräumen — → Audit (CONS).
