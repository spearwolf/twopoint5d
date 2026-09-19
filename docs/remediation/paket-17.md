# Paket 17 — Build-Skripte: makePackageJson schneidet nur ein führendes dist/ ab und verkraftet fehlende exports

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (zwei Nebenbefunde aus der Befund-Queue, Drain-Runde 1; beide aus Paket 7, vorbestehend seit `e352b56`)
- Ziel: `makePackageJson.mjs` entfernt nur ein führendes `dist/` bzw. `./dist/` und verarbeitet Manifeste ohne `exports`, mit `exports` als einzelnem Pfad oder mit `null`-Einträgen, ohne zu werfen.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - neu `scripts/makePackageJson/removeDistPathPrefix.mjs`
  - neu `scripts/makePackageJson/removeDistPathPrefix.test.mjs`
  - `scripts/makePackageJson.mjs` (Zeile 5–6 Imports, Zeile 31 Aufruf, Zeilen 63–88 entfallen)
  - `docs/architecture.md` (§4, ein Satz)
- Vorgehen:
  1. **Logik unverändert auslagern (noch kein Fix).** Neues Modul
     `scripts/makePackageJson/removeDistPathPrefix.mjs` mit einem einzigen Export
     `export function removeDistPathPrefix(manifest)`. Zunächst trägt es die heutige
     Logik wortgleich: die beiden Funktionen `removeDistPathPrefix([section, keys])`
     und `removePathPrefixAt(section, key, prefix = 'dist/')` aus
     `scripts/makePackageJson.mjs:65-88` wandern als modulinterne Funktionen ins Modul
     (die innere `removeDistPathPrefix([section, keys])` dafür intern umbenennen in
     `removeDistPathPrefixIn`), und der Export ruft
     `[[manifest, ['main', 'module', 'types']], [manifest.exports]].forEach(removeDistPathPrefixIn)`
     und gibt `manifest` zurück. In `scripts/makePackageJson.mjs`:
     - Import `import {removeDistPathPrefix} from './makePackageJson/removeDistPathPrefix.mjs';`
       zwischen die beiden bestehenden Helfer-Imports (alphabetisch:
       `findUnpublishableSpecifiers`, `removeDistPathPrefix`, `resolveDependencies`).
     - Zeile 31 (`[[outPackageJson, ['main', 'module', 'types']], [outPackageJson.exports]].forEach(removeDistPathPrefix);`)
       wird `removeDistPathPrefix(outPackageJson);`.
     - Zeilen 63–88 löschen: den Trenner `// ----…` und beide Funktionen. Der Trenner
       steht nur über diesen Funktionen; danach endet die Datei mit dem
       `fs.writeFileSync(…)` aus Zeile 61.
  2. **Spec schreiben und rot sehen.** Neue Datei
     `scripts/makePackageJson/removeDistPathPrefix.test.mjs` im Stil der Geschwister
     (`import assert from 'node:assert/strict';`, `import {describe, it} from 'node:test';`,
     ein `describe('removeDistPathPrefix', …)`), jeder Fall mit `assert.deepEqual` auf
     den Rückgabewert. Sieben Fälle, Titel wörtlich:
     - Wächter `removes a leading dist/ and ./dist/ from main, module, types and every exports target` —
       Eingabe in der Form der Bibliothek:
       `{exports: {'.': {types: './dist/lib/index.d.ts', import: './dist/lib/index.js'}}, main: 'dist/lib/index.js', module: 'dist/lib/index.js', types: 'dist/lib/index.d.ts'}`
       → `{exports: {'.': {types: './lib/index.d.ts', import: './lib/index.js'}}, main: 'lib/index.js', module: 'lib/index.js', types: 'lib/index.d.ts'}`
     - Wächter `rewrites every path of a fallback array` —
       `{exports: {'.': ['./dist/a.js', './dist/b.js']}}` → `{exports: {'.': ['./a.js', './b.js']}}`
     - Wächter `leaves a path without dist/ alone` —
       `{exports: {'./package.json': './package.json'}}` bleibt gleich
     - Regression `keeps a dist/ that does not lead the path` —
       `{main: 'lib/dist/index.js', exports: {'.': './lib/dist/index.js'}}` bleibt gleich
       (heute: `lib/index.js` bzw. `./lib/index.js`)
     - Regression `takes a manifest without exports` —
       `{main: 'dist/index.js'}` → `{main: 'index.js'}`; zusätzlich
       `assert.equal('exports' in result, false)` (heute: `TypeError: Cannot convert undefined or null to object`)
     - Regression `keeps a null target in exports` —
       `{exports: {'.': './dist/index.js', './internal/*': null}}` →
       `{exports: {'.': './index.js', './internal/*': null}}` (heute: derselbe `TypeError`)
     - Regression `rewrites exports given as a single path` —
       `{exports: './dist/index.js'}` → `{exports: './index.js'}`
       (heute: `TypeError: Cannot assign to read only property '0' of string`)

     Lauf `node --test scripts/makePackageJson/removeDistPathPrefix.test.mjs` gegen den
     Stand aus Schritt 1: erwartet 4 failed, 3 passed. Die Ausgabe dieses roten Laufs
     gehört in den Report.
  3. **Fix im Modul.** Die ausgelagerte Logik ersetzen; Verhalten:
     - Modulintern `removeDistPrefix(filePath)`: `filePath.replace(/^(\.\/)?dist\//, '$1')`
       — `dist/lib/index.js` → `lib/index.js`, `./dist/lib/index.js` → `./lib/index.js`,
       jeder andere String bleibt (`./lib/dist/x.js`, `./package.json`, `distribution/x.js`).
     - `main`, `module`, `types`: nur umschreiben, wenn der Wert ein String ist.
     - `exports`: nur anfassen, wenn `manifest.exports !== undefined`; dann
       `manifest.exports = <umgeschriebener Wert>`, rekursiv: String → `removeDistPrefix`;
       Array → jedes Element; Objekt (nicht `null`) → neues Objekt mit denselben Keys in
       derselben Reihenfolge (`Object.fromEntries(Object.entries(…).map(…))`), jeder Wert
       umgeschrieben; alles andere, auch `null`, bleibt wie es ist. Inline-Kommentar an
       dieser Stelle: ein `null`-Ziel markiert einen Subpath als nicht exportiert.
     - Die Funktion ändert `manifest` an Ort und Stelle und gibt es zurück (wie
       `resolveDependencies` seine Section ändert).
     - JSDoc am Export im Ton der Geschwister: schreibt `main`, `module`, `types` und
       jedes Ziel in `exports` auf Pfade relativ zu `dist/` um, weil das Manifest aus
       `dist/` heraus veröffentlicht wird; nur ein führendes `dist/` bzw. `./dist/`
       fällt, ein `dist/` weiter hinten gehört zum Namen.
     Danach: alle sieben Fälle grün.
  4. **Doku.** `docs/architecture.md` §4: nach dem Satz, der mit »… the build fails —
     npm installs neither protocol.« endet, und vor »`scripts/makeBanner.mjs` builds the
     version banner.« diesen Satz wörtlich einfügen: »Since `dist/` is what gets
     published, `main`, `module`, `types` and every target in `exports` lose a leading
     `dist/` or `./dist/`; a `dist/` further inside a path is part of the name and
     stays.« Der Absatz darunter (»The logic of both scripts lives in
     `scripts/makePackageJson/` and `scripts/publishNpmPkg/` … the scripts themselves
     only wire it up.«) bleibt, er stimmt nach Schritt 1 auch für die Pfad-Umschreibung.
  5. **Nicht anfassen:** `nx.json` (der Named Input `makePackageJson` umfasst
     `scripts/makePackageJson/*.mjs` ohne `*.test.mjs`, das neue Modul ist damit schon
     drin), `packages/twopoint5d/CHANGELOG.md`, `AGENTS.md`, `scripts/publishNpmPkg*`.
- Verify: `pnpm run ci && echo "e6243fb9bc3217aa8d50422db059561d22f58f0ed1731483f04411271291b6b3  packages/twopoint5d/dist/package.json" | sha256sum -c -`
  (`ci` enthält `test:scripts`; der Hash ist der des heutigen `dist/package.json` der
  Bibliothek, in Zug 0 aus HEAD `ed1b11e4` in einer Scratch-Kopie neu erzeugt und
  byte-gleich mit dem im Repo gebauten — das Manifest muss nach dem Paket derselbe
  Byte-Strom sein)
- Commit: `fix: let the publish manifest lose only a leading dist/ from its paths and build from one whose exports is missing, a single path or holds a null target`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · beide Nebenbefunde unverändert (HEAD `ed1b11e4`, `scripts/makePackageJson.mjs:65-88` seit `0e7db162` unberührt, in `e352b56` wortgleich) · in Node nachgestellt (inneres `dist/` fällt, fehlendes `exports` und `null`-Ziel werfen `TypeError`) · dazu `exports` als einzelner String (wirft `TypeError`, dieselbe Ursache, im Paket) · keine offenen Folgen zu verteilen; die Queue-Einträge zu `publishNpmPkg.mjs:11` und `:29` haben eigene Ursachen und bleiben `→ Audit`
  - 2026-09-19 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-17.impl-1.json`
  - 2026-09-19 Zug 2: FERTIG · neu `scripts/makePackageJson/removeDistPathPrefix.mjs`, `removeDistPathPrefix.test.mjs`, geändert `scripts/makePackageJson.mjs`, `docs/architecture.md` · roter Lauf 4 failed/3 passed, danach 7/7 · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer (sonnet, effort low) — alle Nebenbefunde erfüllt, 0 kritisch, 0 wichtig, 2 klein · Diff `paket-17.diff`, Report `paket-17.review-1.json`
  - 2026-09-19 Zug 4: keine Runde nötig
  - 2026-09-19 Zug 5: Verify selbst Exit 0 (`paket-17.verify.log`, SHA-256 OK) · Commit `e90de130`

## Abgleich

- **`scripts/makePackageJson.mjs:84-86`** (Queue: `removePathPrefixAt`, `String#replace('dist/', '')`) — unverändert. `section[key].replace(prefix, '')` ersetzt das erste `dist/` irgendwo im String. Nachgestellt: `{main: 'lib/dist/index.js', exports: {'.': './lib/dist/index.js'}}` → `main: 'lib/index.js'`, `'.': './lib/index.js'`. Vorbestehend: `git show e352b56:scripts/makePackageJson.mjs`, Zeilen 113–117, wortgleich.
- **`scripts/makePackageJson.mjs:65-82`** (Queue: `removeDistPathPrefix` bei fehlendem `exports` und `null`) — unverändert. Zeile 31 übergibt `[outPackageJson.exports]`; ohne `exports` läuft `Object.keys(undefined)` (Zeile 72) in `TypeError: Cannot convert undefined or null to object`, ebenso ein `null`-Ziel über `typeof null === 'object'` (Zeile 75 → rekursiver Aufruf → Zeile 72). Nachgestellt mit `{main: 'dist/index.js'}` und `{exports: {'.': './dist/index.js', './internal/*': null}}`. Vorbestehend: `e352b56`, Zeilen 94–111 (`Object.keys` in Zeile 101, `typeof … === 'object'` in Zeile 104).
- **Neu in Zug 0, dieselbe Ursache:** `exports` als einzelner String (`{exports: './dist/index.js'}`, eine gültige Form laut npm) — `Object.keys` liefert die Zeichenindizes, `removePathPrefixAt` schreibt in den String-Primitive und wirft im Strict Mode des ES-Moduls `TypeError: Cannot assign to read only property '0' of string './dist/index.js'`. Ursache wie beim `null`-Ziel: der Walk nimmt für `exports` ein Objekt an. Im Paket, Ziel entsprechend geschärft.
- **Heute folgenlos:** Die Bibliothek trägt `exports` als Objekt ohne `null`, alle Pfade beginnen mit `dist/` bzw. `./dist/`. Das in Zug 0 aus HEAD neu erzeugte `dist/package.json` hat SHA-256 `e6243fb9bc3217aa8d50422db059561d22f58f0ed1731483f04411271291b6b3` und ist byte-gleich mit dem im Repo gebauten.
- **Audit-Überschneidung:** keine. `./audit.html` nennt `scripts/makePackageJson.mjs` nur in BUG-094 (`resolvePackageVersion`, erledigt in Paket 7); SEC-003 und CFG-019 betreffen andere Stellen.

## Entscheidungen in Zug 0

- **Helfer-Modul statt Fix im Skript.** `makePackageJson.mjs` liest und schreibt beim Import Dateien (Zeilen 14–61), ein `node --test`-Spec kann es nicht laden; Paket 7 hat die Logik beider Skripte aus genau diesem Grund in `scripts/makePackageJson/` ausgelagert, und `docs/architecture.md:82-84` sagt schon heute, die Skripte verdrahteten nur. Die Pfad-Umschreibung ist der letzte Rest Logik im Skript — mit dem Auslagern wird der Satz wahr.
- **Erst unverändert auslagern, dann fixen.** So läuft der Spec gegen den alten Code und ist rot, statt als »fehlendes Modul« zu scheitern und nichts über das Verhalten zu beweisen.
- **Führend heißt `dist/` oder `./dist/`.** Beide Formen stehen heute im Manifest (`main` ohne, `exports` mit `./`); das `./` bleibt stehen, damit die Ausgabe byte-gleich bleibt.
- **Nicht-String-Werte in `main`/`module`/`types` bleiben stehen**, statt wie heute an `.replace` zu werfen — das Paket soll nichts erfinden, was ein Manifest-Schema entscheidet.
- **Kein CHANGELOG-Eintrag.** `scripts/` wird nicht veröffentlicht, das Manifest der Bibliothek bleibt byte-gleich (Verify prüft das); wie in Paket 7 erreicht nichts die Nutzer der Bibliothek.
- **Kein Browsertest, kein Vitest.** Reines Node-Skript; das Gate trägt es über `test:scripts`.
- **Effort `low`, mittlere Stufe:** Namen, Regex, Testfälle mit Ein- und Ausgaben und die Schrittfolge stehen hier; es gibt nichts zu suchen, und ein folgsamer Implementierer ist die bessere Wahl als einer, der das Skript nebenbei verbessert.

## Nebenbefunde im Volltext (Befund-Queue)

**`scripts/makePackageJson.mjs:84-86` (Stand `0e7db162`) · low · aus Paket 7 (Zug 0, vorbestehend seit e352b56)** —
`removePathPrefixAt` entfernt mit `String#replace('dist/', '')` das erste `dist/`
irgendwo im Pfad, nicht nur ein führendes: `./lib/dist/x.js` würde zu `./lib/x.js`;
heute beginnen alle Pfade in `main`, `module`, `types` und `exports` mit `dist/` bzw.
`./dist/`. Urteil: `→ Scope → Paket 17`.

**`scripts/makePackageJson.mjs:65-82` (Stand `0e7db162`) · low · aus Paket 7 (vorbestehend seit e352b56, dort `:101`)** —
`removeDistPathPrefix` wirft `TypeError`, wenn dem Manifest `exports` fehlt
(`Object.keys(undefined)`, Zeile 72), und hält `null` für ein Objekt
(`typeof null === 'object'`, Zeile 75); heute trägt die Bibliothek `exports`,
folgenlos. Urteil: `→ Scope → Paket 17`.

## Urteil des Reviewers

- Nur führendes `dist/` bzw. `./dist/` fällt — behoben: `scripts/makePackageJson/removeDistPathPrefix.mjs` (Regex `/^(\.\/)?dist\//`), Spec `keeps a dist/ that does not lead the path`
- Fehlendes `exports` — behoben: Guard `manifest.exports !== undefined`, Spec `takes a manifest without exports`
- `null`-Ziel in `exports` — behoben: `null` fällt zu `return target` durch, Spec `keeps a null target in exports`
- `exports` als einzelner String — behoben: String-Zweig im rekursiven Walk, Spec `rewrites exports given as a single path`

Kleine Befunde:
- `docs/architecture.md:16-20` — der Absatz mit dem neuen Satz ist nicht neu umbrochen (Zeilen 17 und 20 deutlich kürzer als die Umgebung).
- `removeDistPathPrefix.test.mjs` prüft nur den Rückgabewert, nicht die In-place-Änderung, auf die `scripts/makePackageJson.mjs` sich verlässt (ein `assert.equal(result, manifest)` fehlt).
