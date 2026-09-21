# Paket 8 — Drain: letzte Fehlerpfade der Skripte und Umbruch in der Architektur-Doku

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — drei Nebenbefunde aus der Queue (Paket 7), je info:
  unlesbares Nachbar-Manifest im `workspace:`-Pfad, stummes Überspringen fehlender
  Begleitdateien beim Publish, ungleicher Umbruch in `docs/architecture.md`
- Ziel: Auch der `workspace:`-Pfad und das Kopieren der Begleitdateien enden mit einer
  Meldung statt Stacktrace oder Stille, und die Architektur-Doku bricht einheitlich um.
- Modell: mittlere Stufe (`sonnet`)
- Effort: medium
- Dateien:
  - `scripts/makePackageJson/resolveDependencies.mjs` (ändern)
  - `scripts/makePackageJson/resolveDependencies.test.mjs` (Fälle ergänzen)
  - `scripts/publishNpmPkg/releaseFiles.mjs` (neu)
  - `scripts/publishNpmPkg/releaseFiles.test.mjs` (neu)
  - `scripts/publishNpmPkg.mjs` (ändern)
  - `docs/architecture.md` (drei Einfügungen in §4, danach die ganze Datei umbrechen)
  - unberührt: `scripts/makePackageJson.mjs`, `nx.json`, `package.json`, `AGENTS.md`,
    `packages/twopoint5d/CHANGELOG.md` (nichts davon ist für Konsumenten der Bibliothek
    sichtbar), `README.md`
- Verify: `pnpm run ci`, danach die Umbruchprüfung und die Probe aus den Abschnitten
  unten — alle drei Exit 0, die Prüfung endet mit `wrap=ok (0)`, die Probe mit `probe=ok`
- Commit: `build: stop the publish script when a release would go out without its license, changelog or readme, let the manifest script refuse a workspace dependency whose package.json cannot be read or names no version, and wrap the monorepo architecture doc at 88 columns`
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · Nachbar-Manifest unverändert bei
    `resolveDependencies.mjs:86-88` · stummes Überspringen unverändert bei
    `publishNpmPkg.mjs:106-115` (Aufrufer `:81-91`) · Doku-Absätze gewandert nach
    `docs/architecture.md:159-175` und `:196-206`; Umbruchprüfung über die ganze Datei
    69 Verstöße (vor dem Lauf, `da095c73`: 15) → ganze Datei in dieses Paket · keine
    offenen `Folgen:`-Zeilen, Queue sonst beschlossen · Restplan unverändert (letztes
    Paket vor dem Abschluss)
  - 2026-09-21 Zug 1: Probe `paket-8-probe.sh` angelegt, gegen HEAD `probe=FAILED`
    (Fall 6, 7, Schlussprüfung: 4 statt 2 `npm publish`), Log `paket-8-probe.red.log` ·
    Implementierer beauftragt: `sonnet`, Effort medium, `paket-8.impl-1.json`
  - 2026-09-21 Zug 2: Report FERTIG · geändert `resolveDependencies{,.test}.mjs`,
    `publishNpmPkg.mjs`, `docs/architecture.md`, neu `releaseFiles{,.test}.mjs` · rot vorher:
    `resolveDependencies.test.mjs` 14/16 (`SyntaxError`, `TypeError`), `releaseFiles.test.mjs`
    Modul fehlt · Arbeitsbaum schmutzig · Verify `paket-8.verify.log` exit=0 (Gate grün,
    `test:scripts` 76/76, `wrap=ok (0)`, `probe=ok`) · Wort-Diff: nur die drei Einfügungen
  - 2026-09-21 Zug 3: Reviewer (`sonnet`, medium) `paket-8.review-1.json`, Diff `paket-8.diff`
    · Befund 1 und 2 behoben, 3 nicht abnahmefähig · wichtig: `docs/architecture.md:243`
    beginnt mit `>=26.3.0` und öffnet einen Blockquote · 3× klein (unten)
  - 2026-09-21 Zug 4 Runde 1: offen 1 (Blockquote-Zeile) · Umbruchregel und -prüfung in
    dieser Datei um Blocksyntax geschärft (HEAD 68, Stand 1) · Resume derselben Session →
    `paket-8.impl-2.json`
    · zurück: FERTIG, nur `docs/architecture.md:242-243` (Code-Span ungeteilt in `:243`)
    · Verify `paket-8.verify-2.log` exit=1 — `createCacheServer.test.mjs:90` rot, weil der
    Runner selbst eine Datei `/tmp/x` angelegt hatte (Queue) · entfernt, `paket-8.verify-3.log`
    exit=0 (76/76, `wrap=ok (0)`, `probe=ok`, Wort-Diff ohne entfernte Wörter) · Nachreview
    `paket-8.review-2.json` auf `paket-8.diff-2`
  - 2026-09-21 Zug 4 Runde 1 Nachreview: offener Befund behoben (`:243` Code-Span ungeteilt,
    Blockstruktur per `marked` gleich HEAD), nichts Neues · offen 1 → 0
  - 2026-09-21 Zug 5: Commit `89166b69`, getragen von `paket-8.verify-3.log` (exit=0) ·
    Plan auf `[x]` · Queue +2 (`startsWith`, `/tmp/x` im Cache-Server-Test)

## Vorgehen

Reihenfolge: erst die beiden Regressionstests rot sehen, dann die Helfer, dann die
Verdrahtung, dann die Doku (erst Inhalt, dann Umbruch). Kommentare und Doku auf Englisch,
ohne Rückblick auf den Vorzustand, ohne Finding-IDs (Abschnitt »Konventionen« im Plan).

### 1. `workspace:`-Pfad: Nachbar-Manifest lesen, ohne zu werfen

Datei `scripts/makePackageJson/resolveDependencies.mjs`, Block ab `:86`
(`if (fs.existsSync(pkgJsonPath)) { … }`).

Heute: `JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))` ohne `catch` (`:87`), dann
`pkgJson.version.replace(/-dev$/, '')` (`:88`) — wirft `SyntaxError` bei kaputtem JSON,
`TypeError` bei fehlender oder nicht-String-`version`, und eine `version` wie `banana`
geht als `^banana` ins Manifest.

Neu, innerhalb des `existsSync`-Blocks:

1. Lesen und Parsen in `try`/`catch`. Im `catch`:
   `console.warn('oops.. cannot read workspace package:', pkgName, '->', \`${pkgJsonPath}: ${error.message}\`, 'referenced from:', referencedFrom);`
   und `return undefined;`
2. `const version = typeof pkgJson?.version === 'string' ? pkgJson.version.replace(/-dev$/, '') : undefined;`
   (`pkgJson?.` deckt ein Manifest ab, das `null` ist.)
3. `if (valid(version) == null)`:
   `console.warn('oops.. workspace package has no version:', pkgName, '->', pkgJsonPath, 'referenced from:', referencedFrom);`
   und `return undefined;` — `valid` aus `semver`, der Import wird zu
   `import {valid, validRange} from 'semver';`. Geprüft ist das: `valid(undefined)`,
   `valid('')`, `valid('banana')`, `valid('1.2')` → `null`; `valid('0.22.0')` → gültig.
4. Danach unverändert: `pkgVersion` aus `range` und `version`, `console.log`, `return`.
5. Ein Kommentar über beiden Ausstiegen, sinngemäß: the package under `packages/` is the
   one pnpm links, so its manifest is the only source of the version; without a readable
   one the specifier stays, and the manifest check refuses it — kein Rückfall auf
   `sharedDependencies` (derselbe Grund wie der Kommentar an `:38-39` beim Katalog).

Kein `throw`, kein `process.exit` im Helfer: jeder Specifier, den nichts auflöst, nimmt in
dieser Datei denselben Weg — Warnung, Specifier bleibt stehen, `findUnpublishableSpecifiers`
lässt `makePackageJson.mjs` mit `cannot publish …: <section>.<name> is "workspace:*", which
resolves to no version range` und Exit 1 enden. Dieser Pfad ist bereits getestet
(`makePackageJson.test.mjs`, `refuses a specifier npm cannot install`).
`scripts/makePackageJson.mjs` bleibt deshalb unverändert.

**Regressionstests** in `scripts/makePackageJson/resolveDependencies.test.mjs`, im
bestehenden `describe`. Fixtures im `before()` dazu:

- `writeManifest('noversion', {name: '@scope/noversion'});`
- `writeManifest('badversion', {name: '@scope/badversion', version: 'banana'});`
- `packages/broken/package.json` mit dem Text `{` (roh schreiben, `mkdirSync` mit
  `recursive: true` wie in `writeManifest`)

Neue Fälle (Namen genau so):

- `a workspace: dependency whose package.json is not JSON stays as it is` —
  `resolve({'@scope/broken': 'workspace:*'}, {})` und `… 'workspace:^'` bleiben
  unverändert (`deepEqual` mit der Eingabe).
- `a workspace: dependency whose package has no version semver can read stays as it is` —
  `@scope/noversion` und `@scope/badversion`, je mit `workspace:*` und `workspace:~`,
  bleiben unverändert.

Vor dem Fix rot: der erste Fall wirft `SyntaxError`, der zweite `TypeError`
(`noversion`) bzw. liefert `^banana`. Den roten Lauf
(`node --test scripts/makePackageJson/resolveDependencies.test.mjs`) in den Report.

Kein Fall in `makePackageJson.test.mjs`: das Skript liest die Nachbarpakete aus dem echten
Workspace-Root (aus seinem eigenen Pfad), ein kaputtes Nachbar-Manifest ließe sich dort nur
im Repo selbst anlegen.

### 2. Begleitdateien eines Releases: Helfer `releaseFiles`

Neue Datei `scripts/publishNpmPkg/releaseFiles.mjs`, im Stil von `checkManifest.mjs`
(JSDoc-Kopf, eine Funktion, wirft mit Meldung):

```js
export function releaseFiles({workspaceRoot, projectRoot, packageRoot}) // → Array<{src, dst}>
```

- Pflichtdateien, in dieser Reihenfolge:
  1. `<workspaceRoot>/LICENSE` → `<packageRoot>/LICENSE`
  2. `<projectRoot>/CHANGELOG.md` → `<packageRoot>/CHANGELOG.md`
  3. README: `<projectRoot>/README-pkg.md`, wenn es existiert, sonst
     `<projectRoot>/README.md` → in beiden Fällen `<packageRoot>/README.md`
- Optional: `<workspaceRoot>/.npmrc` → `<packageRoot>/.npmrc`, nur wenn vorhanden, und dann
  als **erster** Eintrag der Liste (Reihenfolge wie die heutigen Kopien in
  `publishNpmPkg.mjs:81-91`). Kommentar dazu, sinngemäß: the repository tracks no `.npmrc`;
  a workspace one carries registry settings to `npm publish` in the package directory, and
  npm never packs it.
- Fehlt eine Pflichtdatei: `throw new Error(…)` mit allen fehlenden Quellpfaden (absolut,
  wie oben gebildet), in der Reihenfolge der Liste, mit `', '` verbunden, gefolgt von
  ` does not exist` bei einem Pfad und ` do not exist` bei mehreren. Beispiel:
  `/…/packages/twopoint5d/CHANGELOG.md does not exist`. Für die README nennt die Meldung
  `<projectRoot>/README.md` — die Datei, auf die zurückgefallen wird.
- Pfade mit `path.resolve`, Existenz mit `fs.existsSync`; kein injizierbarer Parameter,
  die Tests arbeiten mit einem Temp-Verzeichnis.

Warum `LICENSE` mit hineingehört, obwohl der Befund nur README und CHANGELOG nennt:
dieselbe `copyFile`-Stelle überspringt auch sie stumm, und ein Release ohne Lizenzdatei ist
derselbe Schaden. Warum ein Abbruch statt einer Warnung: eine veröffentlichte Version ist
auf npm unveränderlich, eine fehlende README ließe sich nur mit einer neuen Version beheben.

**Regressionstests** `scripts/publishNpmPkg/releaseFiles.test.mjs` (`node:test`,
`node:assert/strict`, Temp-Verzeichnis per `fs.mkdtempSync(path.join(os.tmpdir(), 'releaseFiles-'))`
mit Unterverzeichnissen `workspace/`, `project/`, `dist/`; aufräumen im `after`). Fälle
(Namen genau so), `deepEqual` gegen die vollständige Liste bzw. `throws` mit `message`-Regex:

- `a release carries LICENSE, CHANGELOG.md and README.md` — alle drei vorhanden, kein
  `.npmrc`, kein `README-pkg.md` → drei Einträge in der Reihenfolge oben.
- `README-pkg.md ships as README.md when the project has one` — beide READMEs vorhanden →
  der dritte Eintrag hat `src` = `project/README-pkg.md`, `dst` = `dist/README.md`.
- `a workspace .npmrc goes along, first` — `workspace/.npmrc` vorhanden → vier Einträge,
  `.npmrc` zuerst.
- `a missing CHANGELOG.md is named` → `/^\S*\/project\/CHANGELOG\.md does not exist$/`
- `a missing README is named by the README.md it falls back to` →
  `/^\S*\/project\/README\.md does not exist$/`
- `every missing file is named in one message` — nichts vorhanden →
  `` `${ws}/LICENSE, ${project}/CHANGELOG.md, ${project}/README.md do not exist` `` exakt.

Die Fixtures je Fall so anlegen, dass die Fälle unabhängig voneinander laufen (eigenes
Temp-Verzeichnis je Fall oder Dateien je Fall anlegen und entfernen). Vor dem Helfer rot:
das Modul fehlt — den Lauf `node --test scripts/publishNpmPkg/releaseFiles.test.mjs` in
den Report.

### 3. Verdrahtung in `scripts/publishNpmPkg.mjs`

- Import `import {releaseFiles} from './publishNpmPkg/releaseFiles.mjs';` hinter dem Import
  von `publishedVersions.mjs` (alphabetisch).
- In `publishPackage(cwd, dryRun)` ersetzen die Zeilen `:81-91` (drei `copyFile`-Aufrufe
  und der README-Zweig):

  ```js
  let files;
  try {
    files = releaseFiles({workspaceRoot, projectRoot, packageRoot: cwd});
  } catch (error) {
    console.error(`cannot publish ${cwd}: ${error.message}`);
    process.exit(1);
  }
  for (const {src, dst} of files) {
    copyFile(src, dst);
  }
  ```

  Die Prüfung sitzt in `publishPackage`, also erst wenn wirklich veröffentlicht wird: ein
  Lauf, der überspringt (`-dev`, Version schon auf npm), bleibt bei Exit 0 und bekommt
  keinen neuen Fehlerfall. Alle Pflichtdateien werden geprüft, bevor die erste kopiert wird.
- `copyFile(src, dst)`: das `if (fs.existsSync(src))` fällt weg (die Liste enthält nur
  vorhandene Dateien), `try`/`catch` um `fs.copyFileSync` mit der Meldung
  `cannot copy ${src} to ${dst}: …` und Exit 1 bleibt — er fängt auch eine Datei, die
  zwischen Prüfung und Kopie verschwindet.
- `fs` bleibt importiert (Lesen des Manifests an `:28`).

### 4. `docs/architecture.md`

**Erst den Inhalt**, zwei Stellen in §4:

1. Absatz »`makePackageJson.mjs` synthesizes …« (heute `:159-175`): direkt hinter der
   schließenden Klammer »… leaves the specifier standing).« einfügen:
   `A package.json there that cannot be read, or whose version semver cannot read, leaves
   the specifier standing as well.` (mit `package.json` in Backticks). Der Rest des
   Absatzes bleibt wörtlich.
2. Absatz »The publishable artifact is therefore `dist/` …« (heute `:181-194`):
   - hinter »… takes npm's `E404` for a first publish.« einfügen:
     ``Before `npm publish` it copies `LICENSE` from the workspace root, and `CHANGELOG.md`
     and the README from the directory it is started in, into the package directory; the
     README is `README-pkg.md`, or `README.md` if there is none, and ships as `README.md`.
     A workspace `.npmrc` goes along if there is one.``
   - in der Aufzählung »Every failure — a manifest that is unreadable or has no `name` or
     `version`, an npm that is missing or fails — …« zwischen die beiden Glieder einfügen:
     `one of those three files that is missing,` — ergibt »…has no `name` or `version`,
     one of those three files that is missing, an npm that is missing or fails — ends with
     one line and exit code 1 …«.

**Dann umbrechen, die ganze Datei**, nach einer Regel:

- Jede Prosazeile — Absatz oder Listeneintrag samt eingerückter Folgezeilen — ist höchstens
  **88 Zeichen** breit, und keine Zeile endet, solange das nächste Wort des Absatzes noch
  hineinpasst (gieriger Umbruch). Folgezeilen eines Listeneintrags behalten ihre Einrückung
  von zwei Leerzeichen, sie zählt mit.
- Ausgenommen: Überschriften, Tabellenzeilen, Fenced Code Blocks, eine Zeile aus einem
  einzigen Wort (ein langer Link).
- Kein Wort ändert sich durch den Umbruch. Beleg für den Report:
  `git diff --word-diff=porcelain -- docs/architecture.md` zeigt als hinzugefügte Wörter
  nur die drei Einfügungen oben und keine entfernten.
- Mechanisch ist das sicherer als von Hand: ein Wegwerfskript außerhalb des Repos (nicht
  committen), das Blöcke an Leerzeilen, Überschriften, Tabellen, Fences und Listenanfängen
  (`- `, `1. `) trennt und jeden Block gierig bei 88 neu füllt.
- Keine Folgezeile beginnt mit Markdown-Blocksyntax (`>`, `#`, `|`, `- `, `+ `, `* `,
  `1. `, `1) `): wo der gierige Umbruch das erzeugen würde, wandert das Wort davor mit in
  die Folgezeile (in Zug 4 ergänzt, siehe »Umbruchprüfung«). Eine Probe in Zug 0 hat
  genau das an HEAD gezeigt: 131 geänderte Zeilen, danach `wrap=ok (0)`, kein Wort anders.

Warum 88 und warum die ganze Datei: vor dem Lauf (`da095c73`) hielt sich jede Prosazeile
der Datei an 88 Zeichen, bis auf zwei Listenzeilen mit 90 und 91. Die Pakete dieses Laufs
haben Absätze bis 97 Zeichen geschrieben und andere weit darunter umbrochen — der Befund
nennt zwei davon, die Prüfung findet 69 Verstöße in 25 Absätzen und Listeneinträgen. Das ist
dieselbe Ursache an anderen Stellen (Symptom), also gehört sie in dieses Paket; eine Regel
für die ganze Datei ist die einzige, die eine Prüfung halten kann. Markdown rendert den
Umbruch nicht, lesbar wird er nur im Quelltext und im Diff.

## Umbruchprüfung

Aus dem Repo-Root. An HEAD vor dem Paket: `wrap=FAILED (68)`, Exit 1. Nachher:
`wrap=ok (0)`, Exit 0. In Zug 4 (Runde 1) um die Blocksyntax-Regel geschärft: eine
Folgezeile, die mit `>`, `#`, `|`, `- `, `+ `, `* `, `1. ` oder `1) ` beginnt, beendet den
Absatz — der gierige Umbruch hatte `>=26.3.0` an den Anfang von `docs/architecture.md:243`
gesetzt und damit einen Blockquote geöffnet. Eine Zeile darf deshalb früher enden, wenn
das Hochziehen des nächsten Worts die Folgezeile mit Blocksyntax beginnen ließe.

```bash
node - <<'EOF'
// every prose line of docs/architecture.md at most 88 wide, and none ends while the next word would still fit;
// fenced code, headings and table rows are exempt, and so is a line that is one word.
// A continuation line must not start with Markdown block syntax (`>`, `#`, `|`, `- `, `+ `, `* `, `1. `, `1) `),
// which would end the paragraph or list item; a line may end early when pulling up the next word would do that.
const W = 88;
const BLOCK = /^(>|#|\||[-+*] |\d+[.)] )/;
const lines = require('fs').readFileSync('docs/architecture.md', 'utf8').split('\n');
const blocks = [];
let block = [], fence = false;
const flush = () => { if (block.length) blocks.push(block); block = []; };
lines.forEach((text, i) => {
  if (text.startsWith('```')) { fence = !fence; flush(); return; }
  if (fence || text.trim() === '' || /^(#|\|)/.test(text)) { flush(); return; }
  if (/^\s*(- |\d+\. )/.test(text)) flush();
  block.push({text, no: i + 1});
});
flush();
let bad = 0;
for (const b of blocks) b.forEach(({text, no}, i) => {
  const next = b[i + 1];
  if (i > 0 && BLOCK.test(text.trim())) { bad++; console.log(`${no}: starts with block syntax`); }
  if (text.length > W && text.trim().includes(' ')) { bad++; console.log(`${no}: over ${text.length}`); return; }
  if (!next) return;
  const words = next.text.trim().split(' ');
  const rest = words.slice(1).join(' ');
  if (text.length + 1 + words[0].length <= W && !(rest && BLOCK.test(rest))) { bad++; console.log(`${no}: short ${text.length}`); }
});
console.log(`wrap=${bad ? 'FAILED' : 'ok'} (${bad})`);
process.exit(bad ? 1 : 0);
EOF
```

## Probe für `publishNpmPkg.mjs`

**Legt B an, nicht der Implementierer** — sie liegt im Arbeitsverzeichnis, nicht im Repo.
Kein Test startet `publishNpmPkg.mjs` (§6 der Architektur-Doku); die Verdrahtung aus
Schritt 3 belegt diese Probe mit Fake-npm, das nichts veröffentlicht und keine Registry
erreicht.

`$ARBEITSDIR/paket-8-probe.sh` = Kopie von `$ARBEITSDIR/paket-7-probe.sh` mit diesen
Änderungen:

1. `probe()` bekommt das Startverzeichnis als viertes Argument:
   `probe <label> <regex> <package-dir> <start-dir> <env…>`; der Aufruf wird
   `cd "$start"` statt `cd "$P/cwd"`. Die Fälle 1–5 übergeben `"$P/cwd"`.
2. `$P/cwd` bekommt `CHANGELOG.md` und `README.md` (Inhalt beliebig) — sonst endet Fall 4
   (`npm publish fails`) nach dem Paket schon an der fehlenden Begleitdatei.
3. Neue Verzeichnisse: `$P/cwd-no-changelog` (nur `README.md`), `$P/cwd-no-readme` (nur
   `CHANGELOG.md`), `$P/cwd-readme-pkg` (`CHANGELOG.md`, `README.md` mit Inhalt `plain`,
   `README-pkg.md` mit Inhalt `pkg`), Paketverzeichnis `$P/ok-readme` mit demselben
   Manifest wie `$P/ok`.
4. Neue Fälle:
   - `probe '6 no CHANGELOG' '^cannot publish .*/ok: .*/cwd-no-changelog/CHANGELOG\.md does not exist$' "$P/ok" "$P/cwd-no-changelog" PATH="$P/bin"`
   - `probe '7 no README' '^cannot publish .*/ok: .*/cwd-no-readme/README\.md does not exist$' "$P/ok" "$P/cwd-no-readme" PATH="$P/bin"`
   - `probe '8 README-pkg.md ships as README.md' '^npm publish failed: exit code 7$' "$P/ok-readme" "$P/cwd-readme-pkg" PATH="$P/bin"`,
     danach `grep -qx pkg "$P/ok-readme/README.md" || { echo 'PROBE FAILED: README-pkg.md did not ship as README.md'; FAIL=1; }`
5. Neue Schlussprüfung: genau zwei `npm publish`-Aufrufe (Fall 4 und 8) —
   `[ "$(grep -c '^publish ' "$P/bin/calls.log")" -eq 2 ] || { echo 'PROBE FAILED: npm publish ran for a release with a missing file'; FAIL=1; }`

B fährt die Probe **vor** dem Implementierer gegen HEAD: erwartet `probe=FAILED` an Fall 6
und 7 (dort läuft heute `npm publish` trotz fehlender Datei, Meldung `npm publish failed:
exit code 7`) und an der Schlussprüfung (4 statt 2 Aufrufe). Nach dem Fix `probe=ok`.
Beides mit Exit-Code in `$ARBEITSDIR/paket-8-probe.red.log` bzw. `paket-8-probe.log`.

## Nicht in diesem Paket

- `scripts/publishNpmPkg/publishedVersions.mjs:6` — `JSON.parse` ohne `catch` ist Absicht,
  der Aufrufer `publishNpmPkg.mjs:54-59` fängt ihn mit Meldung.
- Weitere Lesestellen gibt es in `scripts/makePackageJson/` und `scripts/publishNpmPkg/`
  nicht (Zug 0: `grep` nach `readFileSync`, `JSON.parse`, `existsSync`, `copyFileSync`,
  `writeFileSync`); `scripts/checkNameableTypes.mjs` und `scripts/checkDocSnippets*`
  gehören nicht zu den beiden Skripten dieses Pakets.
- Andere Markdown-Dateien des Repos: die Umbruchregel gilt für `docs/architecture.md`, an
  der der Befund hängt; `.prettierignore:6` nimmt `*.md` ohnehin von Prettier aus.

## Findings im Volltext

**Nebenbefund · info · `scripts/makePackageJson/resolveDependencies.mjs:87-88`** (Paket 7,
vorbestehend — an `da095c73` bei `:82-83`) — ein `workspace:`-Specifier liest das
`package.json` des Nachbarpakets per `JSON.parse` ohne `catch`, und `pkgJson.version.replace`
wirft einen `TypeError`, wenn dort `version` fehlt; beides endet mit Stacktrace statt einer
Meldung — dieselbe Ursache wie Paket 7, in dessen Zug 0 übersehen; praktisch kaum
erreichbar, weil pnpm an kaputtem Workspace-JSON vorher scheitert. → Scope (Publish-Pipeline)

**Nebenbefund · info · `scripts/publishNpmPkg.mjs:106-107`** (Paket 7, vorbestehend — an
`da095c73` `copyFile` bei `:65-68`) — `copyFile` überspringt eine fehlende Quelle stumm;
ein Release ohne `README.md` oder `CHANGELOG.md` im Paketverzeichnis läuft ohne Hinweis
durch. → Scope (Publish-Pipeline)

**Nebenbefund · info · `docs/architecture.md:165-170` und `:199-200`** (Paket 7;
vorbestehend bzw. Paket 5 klein) — Absätze zu `makePackageJson` (Specifier-Satz) und
`deploy.yml` brechen deutlich unter der Umbruchbreite der Nachbarabsätze um. → Scope
(Doku der Publish-Pipeline)

## Abgleich (Zug 0, 2026-09-21, gegen `2a278e39`)

| Befund | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| Nachbar-Manifest ohne `catch` / ohne `version` | unverändert | `resolveDependencies.mjs:86` `existsSync`, `:87` `JSON.parse`, `:88` `version.replace` |
| stummes Überspringen der Begleitdateien | unverändert (Paket 7 hat nur den `copyFileSync`-Fehler gefangen) | `publishNpmPkg.mjs:107` `if (fs.existsSync(src))`, Aufrufer `:81-91` |
| ungleicher Umbruch | gewandert und gewachsen | `docs/architecture.md:159-175` (makePackageJson), `:196-206` (deploy); dazu 23 weitere Absätze und Listeneinträge desselben Musters, 69 Verstöße gegen die Regel oben (an `da095c73`: 15) |

## Triage (Zug 0)

- `Folgen:`-Zeilen der erledigten Pakete: alle `—` oder verteilt (Paket 1 → Paket 2, Paket
  4 → Paket 7). Nichts offen.
- »Offene Befunde«: alle Einträge beschlossen; die drei mit `→ Paket 8` sind dieses Paket.
- Neu in Zug 0 aufgenommen: die übrigen Umbruchverstöße in `docs/architecture.md` — Symptom
  derselben Ursache wie der dritte Befund (Absätze ohne feste Breite umbrochen, großteils
  von den Paketen 1–7 geschrieben), `LICENSE` in der Pflichtliste (dieselbe `copyFile`-Stelle
  wie README und CHANGELOG) und die `version`, die semver nicht lesen kann (derselbe
  ungeprüfte Wert wie die fehlende `version`).

## Restplan (Zug 0)

Paket 8 ist das letzte Paket; danach der Abschluss (Drain der »Offenen Befunde«, die bis
auf dieses Paket beschlossen sind). Keine Änderung an Reihenfolge oder Schnitt.

## Urteil des Reviewers (Zug 3 und Nachreview Runde 1)

| Befund | Urteil | Fundstelle |
| --- | --- | --- |
| Nachbar-Manifest im `workspace:`-Pfad | behoben | `scripts/makePackageJson/resolveDependencies.mjs:86-110` (`try`/`catch`, `typeof`-Guard, `valid(version) == null`, je Warnung und `return undefined`) |
| stummes Überspringen der Begleitdateien | behoben | `scripts/publishNpmPkg/releaseFiles.mjs:24` wirft mit allen fehlenden Pfaden; `scripts/publishNpmPkg.mjs:82-91` endet mit `cannot publish …` vor der ersten Kopie; Probe Fall 6–8 |
| ungleicher Umbruch | behoben (nach Runde 1) | `docs/architecture.md` ganz, `wrap=ok (0)`; `:242-243` Code-Span `^24.16.0 || >=26.3.0` ungeteilt; `marked`: 56 Blöcke wie HEAD, 54 textgleich, die zwei übrigen sind die Absätze mit den Einfügungen |

Kleine Befunde (lösen keine Runde aus):

- `scripts/makePackageJson/resolveDependencies.mjs:108` — die Warnung `workspace package has
  no version` trifft bei einer `version` wie `banana` nicht genau zu; `has no version semver
  can read` wäre genauer (Wortlaut stand so im Detailplan).
- `scripts/publishNpmPkg/releaseFiles.test.mjs` — erwartete Pfade mit `/` zusammengesetzt,
  unter Windows liefe der Test rot (Form vom Detailplan vorgegeben; CI läuft auf Linux).
- Kein Fall für `README-pkg.md` vorhanden, `README.md` fehlend — fachlich richtig, ungeprüft.

## Nebenbefunde und Folgen (Zug 5)

- `resolveDependencies.mjs:11` `specifier.startsWith` auf Nicht-String: vom Implementierer
  gemeldet, an HEAD vor dem Paket gleich (vorbestehend) → Queue, `→ Scope` (Publish-Pipeline).
- `createCacheServer.test.mjs:90`: in Zug 4 rot, weil der Runner mit einer Wegwerf-Pipeline
  `/tmp/x` angelegt hatte; der Test prüft einen festen Pfad außerhalb seines Temp-Verzeichnisses.
  Angelegt in Paket 1 (`42a88429`), also Folge dieses Laufs, nicht vorbestehend → Queue,
  `→ Scope` (Test-Harness, gehört ins Gate).
