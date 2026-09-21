# Paket 5 — Drain: Deploy-Checkout, Repo-Hygiene und Lockfile-Stabilität

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — acht Nebenbefunde aus »Offene Befunde« (Pakete 1, 2, 3b), Volltext unten: Deploy-Checkout ohne `head_sha` (low), Testpaket ohne `"private": true` (low), doppelte pnpm-Version in den Workflows (low), `@emnapi`-Peers kippen das Lockfile (low), README-Badge (info), README-Kommentar zu `pnpm cbt` (info), tote `build`-Einträge (info), tote `/.sass-cache`-Zeile (info)
- Ziel: Deploy veröffentlicht genau den Commit, den CI geprüft hat, das Testpaket ist gegen Publish geschützt, die pnpm-Version hat eine Quelle, ein frisches Install ist reproduzierbar, und README sowie Ignore-Dateien beschreiben den tatsächlichen Stand.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `package.json` (Root), `pnpm-lock.yaml` (nur per `pnpm install`), `packages/twopoint5d-testing/package.json`, `README.md`, `.gitignore`, `.prettierignore`, `docs/architecture.md`, `AGENTS.md`
- Nicht anfassen: `pnpm-workspace.yaml`, `mise.toml`, `.github/dependabot.yml`, jede `CHANGELOG.md` (nichts davon erreicht das veröffentlichte Paket)
- Werkzeuge im Arbeitsverzeichnis `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad` (kurz `$W`), nicht Teil des Projekts, nicht ins Repo kopieren:
  - `$W/bin/actionlint` (1.7.12) — HEAD-Workflows sind damit sauber (Exit 0)
  - `$W/paket-5.lockprobe.sh [repo-dir] [runs]` — löst das Lockfile in Wegwerfkopien je `runs`-mal auf beiden Wegen auf (Neuauflösung auf dem Lockfile, Auflösung von Grund auf) und scheitert bei jeder geänderten Zeile oder `missing peer`-Warnung
  - `$W/paket-5.zug0-expected-lock.diff` — der Lockfile-Diff, den Schritt 3 erzeugen muss
- Vorgehen:
  1. **`.github/workflows/deploy.yml`, Job `version`.** Die Zeile 20
     `    if: ${{ github.event.workflow_run.conclusion == 'success' }}` wird ersetzt durch
     ```yaml
         # both jobs check out the commit the CI run names, so only a push to this repository may name it
         if: >-
           ${{ github.event.workflow_run.conclusion == 'success'
           && github.event.workflow_run.event == 'push'
           && github.event.workflow_run.head_repository.full_name == github.repository }}
     ```
     Der Checkout in Zeile 24 bekommt als erste Zeile unter `with:` den `ref`, mit Kommentar darüber:
     ```yaml
           - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
             with:
               # the commit the CI run tested; main may have moved on since
               ref: ${{ github.event.workflow_run.head_sha }}
               sparse-checkout: packages/twopoint5d/package.json
               sparse-checkout-cone-mode: false
     ```
  2. **`.github/workflows/deploy.yml`, Job `deploy`.** Der Checkout in Zeile 67 wird zu
     ```yaml
           - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
             with:
               # the same commit the version job read
               ref: ${{ github.event.workflow_run.head_sha }}
     ```
     und `pnpm/action-setup` in Zeile 69–71 verliert seinen `with:`-Block (`with:` und `version: 10.27.0`, beide Zeilen), dafür ein Kommentar darüber:
     ```yaml
           # installs the pnpm that packageManager in package.json names
           - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
     ```
     SHA und `# v4.4.0` bleiben exakt, wie sie sind.
  3. **`.github/workflows/ci.yml:25-27`** — dieselbe Änderung wie in Schritt 2 an `pnpm/action-setup`: `with:` und `version: 10.27.0` fallen weg, derselbe Kommentar `# installs the pnpm that packageManager in package.json names` steht über dem `- uses:`. Sonst nichts an `ci.yml`.
  4. **Root-`package.json`, `devDependencies`** — zwei Einträge zwischen `"@arethetypeswrong/cli"` und `"@eslint/js"` (alphabetisch):
     ```json
         "@emnapi/core": "^1.11.3",
         "@emnapi/runtime": "^1.11.3",
     ```
     Danach im Repo-Root `pnpm install` (nicht eingefroren, online). Das Lockfile wird **nur** von pnpm geschrieben, nie von Hand. Erwartet ist genau der Diff aus `$W/paket-5.zug0-expected-lock.diff`: im Importer `.` sechs neue Zeilen für die beiden Einträge (`specifier: ^1.11.3`, `version: 1.11.3`), unter `'@napi-rs/wasm-runtime@0.2.4'` wechseln `'@emnapi/core'` und `'@emnapi/runtime'` von `1.4.5` auf `1.11.3` — 8 Plus-, 2 Minuszeilen. Weicht der Diff ab (andere Versionen, weitere Zeilen), nicht nachbessern, sondern im Report mit dem tatsächlichen Diff melden. Danach müssen `pnpm install --frozen-lockfile` und `bash $W/paket-5.lockprobe.sh "$PWD" 5` mit Exit 0 enden; die Ausgabe der Probe gehört in den Report.
  5. **`packages/twopoint5d-testing/package.json`** — nach `"license": "Apache-2.0",` (Zeile 10) die Zeile `"private": true,` einfügen, in derselben Stellung wie im Root-Manifest.
  6. **`README.md:19`** wird zu
     ```markdown
     [![continuous integration status](https://github.com/spearwolf/twopoint5d/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/spearwolf/twopoint5d/actions/workflows/ci.yml)
     ```
     Die beiden Nachbarzeilen (npm-Badge, License-Badge) bleiben unverändert.
  7. **`README.md:91`** wird zu
     ```sh
     $ pnpm cbt  # clean, lint, build, type-check, check the package types and that every published type can be named, lint the manifest, then the script tests, the Vitest suite with coverage and the browser tests
     ```
  8. **`.gitignore`** — Zeile 4 `build` und Zeile 29 `/.sass-cache` löschen, sonst nichts. **`.prettierignore`** — Zeile 9 `apps/*/build` und Zeile 11 `packages/*/build` löschen, sonst nichts. Nach dem Löschen darf `git status --porcelain --ignored` keine neue Datei zeigen, die vorher ignoriert war (Zug 0: es gibt keine).
  9. **`docs/architecture.md` §4**, Absatz ab Zeile 187 (»`.github/workflows/deploy.yml` runs after every successful CI run on `main`.«): direkt nach diesem ersten Satz einfügen:
     > Both jobs check out `github.event.workflow_run.head_sha`, the commit that CI run tested: `main` may have moved on while CI ran, and a newer commit gets a CI run and a deploy of its own. They run only for a CI run triggered by a push to this repository, the one kind of run that may name the commit to publish.

     Der Rest des Absatzes bleibt.
  10. **`docs/architecture.md` §5** — nach dem Absatz, der mit »…that names the advisory it answers and says when the entry can go.« endet (Zeile 213–214), ein neuer Absatz:
      > `@emnapi/core` and `@emnapi/runtime` are root devDependencies that nothing imports. They are peers of `@napi-rs/wasm-runtime`, which `eslint-plugin-astro` pulls in through the WebAssembly build of the Astro compiler. Left undeclared, pnpm resolves that peer one way or the other from run to run: an install that re-resolves on top of the lockfile — after any manifest change, in every Dependabot update — rewrites about 40 lines of `pnpm-lock.yaml` and warns about a missing peer, and a resolution from scratch lands on either form. Declared, every resolution writes the same lockfile. They can go once `pnpm install --lockfile-only --resolution-only` leaves the lockfile untouched and warns about nothing without them.

      Und im letzten Absatz von §5 (»Node and pnpm versions come from `engines`…«) nach dessen erstem Satz einfügen:
      > The exact pnpm is `packageManager` in the root `package.json`; `pnpm/action-setup` in both workflows reads it from there and names no version of its own.
  11. **`AGENTS.md`**, Abschnitt »Rules you cannot read off the code«, direkt nach dem Punkt **Shared dependency versions** ein neuer Punkt:
      ```markdown
      - **`@emnapi/core` and `@emnapi/runtime`** in the root `devDependencies` are imported by
        nothing and stay: they hold `pnpm-lock.yaml` to one resolution
        ([monorepo architecture §5](docs/architecture.md#5-shared-dependency-versions)).
      ```
  12. Formatieren nur die geänderten Nicht-Markdown-Dateien: `pnpm exec prettier --write .github/workflows/deploy.yml .github/workflows/ci.yml package.json packages/twopoint5d-testing/package.json`. Ändert Prettier den gefalteten `if:`-Block aus Schritt 1, gilt Prettiers Form, sofern `actionlint` sauber bleibt.
  13. Abnahme vor dem Verify: `git grep -n 'version: 10.27' .github` und `git grep -n -E '^(build|/\.sass-cache|apps/\*/build|packages/\*/build)$' -- .gitignore .prettierignore` liefern nichts; `git grep -n 'head_sha' .github/workflows/deploy.yml` liefert genau die zwei `ref:`-Zeilen.
- Verify: `W=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad && "$W/bin/actionlint" .github/workflows/ci.yml .github/workflows/deploy.yml && pnpm install --frozen-lockfile && bash "$W/paket-5.lockprobe.sh" "$PWD" 5 && pnpm run ci`
- Commit: `ci: deploy the commit CI tested, take pnpm from packageManager alone, declare the emnapi peers so every resolution writes the same lockfile, mark the test package private, point the README badge at CI and drop ignore entries for directories nothing creates`
- Offen bis zum ersten Push (lokal nicht belegbar): `pnpm/action-setup` ohne `version` liest `packageManager` im CI-Lauf; der Deploy-Job `version` wertet das neue `if:` für einen Push-Lauf als wahr und checkt `head_sha` sparse aus; der Job `deploy` (und damit sein `action-setup` ohne `version`) läuft erst beim nächsten unveröffentlichten Versionsstand; das Badge rendert.
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · Deploy-Checkout unverändert (`deploy.yml:24`, `:67`) · Testpaket unverändert ohne `private` (`packages/twopoint5d-testing/package.json:1-12`) · pnpm-Version unverändert doppelt in `ci.yml:27`, dazu dieselbe Ursache in `deploy.yml:71` (aufgenommen), `mise.toml:3` bleibt · emnapi reproduziert und Ursache isoliert: Neuauflösung 5/5 kippt 38 Zeilen samt `missing peer`, Auflösung von Grund auf nichtdeterministisch (10 parallele Läufe: 6× HEAD-Form, 4× gekippt), mit deklarierten Peers 10/10 identisch und ohne Warnung (`$W/paket-5.zug0-lockprobe-head.log` rot, `$W/paket-5.zug0-lockprobe-declared.log` grün) · README `:19`, `:91` unverändert · `.gitignore:4`, `:29`, `.prettierignore:9`, `:11` unverändert und tot (kein Erzeuger, Astro baut nach `dist`) · das YAML aus Schritt 1–3 an einer Kopie außerhalb des Repos vorgeprüft: `actionlint` Exit 0, `prettier --check` Exit 0 · keine offenen Folgen zu verteilen · Restplan: Paket 6 hängt jetzt von 5 ab
  - 2026-09-21 Zug 1: Implementierer beauftragt (sonnet, low), Report `$W/paket-5.impl-0.json`
  - 2026-09-21 Zug 2: Report FERTIG · 10 Dateien geändert (Liste im Plan-Block) · Arbeitsbaum schmutzig · Verify exit=0 (`$W/paket-5.verify.log`)
  - 2026-09-21 Zug 3: Reviewer (sonnet, low) — alle acht Nebenbefunde behoben, nichts kritisch/wichtig, 4× klein · Diff `$W/paket-5.diff`, Report `$W/paket-5.review-0.json`
  - 2026-09-21 Zug 4: entfällt, keine auslösenden Befunde
  - 2026-09-21 Zug 5: Commit 9974fdb5, Verify `$W/paket-5.verify.log` exit=0

## Urteil des Reviewers

- Deploy-Checkout: behoben, `deploy.yml:31` (Job `version`) und `:76` (Job `deploy`); Guard `deploy.yml:16-19`
- Testpaket `private`: behoben, `packages/twopoint5d-testing/package.json` nach `license`
- pnpm-Version doppelt: behoben in `ci.yml` und `deploy.yml`; `10.27` nur noch in `package.json:12` und `mise.toml:3` (bleibt bewusst)
- `@emnapi`-Lockfile: behoben, Diff +8/−2 wie erwartet, Probe grün
- README-Badge: behoben, `README.md:19`
- README-Kommentar: behoben, `README.md:91`
- Tote `build`-Einträge: behoben, `.gitignore`, `.prettierignore`
- Tote `/.sass-cache`-Zeile: behoben, `.gitignore`

Kleine Befunde:
- `test:browser` und `build` kamen im Verify aus dem Nx-Cache; kein Test-Input geändert
- `docs/architecture.md` §4 (»…name the commit to publish. The first«) und §5 (»…names no version of its own. `.nvmrc`,«) nicht neu umbrochen
- §4 »Its first job« → »The first job« (Abweichung des Implementierers, sachlich richtig)
- `private: true` des Testpakets steht in keiner Doku

## Entscheidungen in Zug 0

**`@emnapi`-Peers explizit deklarieren.** Die Kette ist `eslint-plugin-astro` →
`astro-eslint-parser` → `@astrojs/compiler-rs` → `@astrojs/compiler-binding` →
`@astrojs/compiler-binding-wasm32-wasi` (optional) → `@napi-rs/wasm-runtime@1.2.4`
mit den Peers `@emnapi/core`/`@emnapi/runtime` `^1.7.1 || ^2.0.0-alpha.4`. Im
Root-Importer stellt sie niemand bereit. pnpm 10.27 löst das je nach Weg und Timing
anders: mit Suffix `(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)` (= HEAD, ohne
Warnung) oder ohne Suffix, mit eigenen Snapshots für `compiler-binding`,
`compiler-binding-wasm32-wasi`, `compiler-rs` und `missing peer`-Warnung. Die
Queue-Frage »neue Registry-Stände oder der Lockfile-Stand von Paket 2?« ist damit
beantwortet: keins von beiden — die Versionen bleiben in beiden Formen gleich, nur die
Peer-Auflösung schwankt. Die Neuauflösung auf dem Lockfile kippt immer, die Auflösung
von Grund auf in 4 von 10 parallelen Läufen. Deklariert man die Peers, gibt es genau
eine Form (10/10, beide Wege, keine Warnung).
Verworfen: `peerDependencyRules.ignoreMissing` (unterdrückt nur die Warnung, beide
Formen bleiben, jede Dependabot-PR trägt weiter ~40 fremde Lockfile-Zeilen);
`packageExtensions` mit optionalen Peers (erklärte eine echte Laufzeitanforderung von
`@napi-rs/wasm-runtime` auf wasm32 für optional — die Angabe wäre falsch). Nebenwirkung
der Deklaration, bewusst hingenommen: `@napi-rs/wasm-runtime@0.2.4` (eine reguläre
Dependency, keine Peer-Beziehung) dedupliziert von `@emnapi/*@1.4.5` auf `1.11.3`; das
Paket lädt nur auf wasm32. Range `^1.11.3` = die gelockte Version, Stil der übrigen
devDependencies; Dependabot hebt sie in der Gruppe `toolchain` mit.

**Guard im Deploy-`if:` gehört zum Checkout-Fix.** Mit `ref: head_sha` checkt Deploy
den Commit aus, den der auslösende CI-Lauf nennt. Das ist nur sicher, solange dieser
Lauf ein Push in dieses Repository war. Heute triggert CI nur auf `push`, der Guard
ändert also nichts am Verhalten — er hält die Voraussetzung fest, auf der `head_sha`
beruht: bekäme CI je einen `pull_request`-Trigger, könnte sonst ein Fork-Branch
namens `main` seinen Commit mit OIDC-Rechten veröffentlichen lassen. Gleiche Ursache,
gleiche Stelle, zwei Bedingungen.

**`deploy.yml:71` aufgenommen, `mise.toml:3` bleibt.** Der Queue-Eintrag nennt nur
`ci.yml`; `deploy.yml:69-71` trägt dieselbe Duplikation und fällt mit ihr. `mise.toml`
(`pnpm = "10.27"`) ist ein Bootstrapper für die lokale Maschine, kein Pin: pnpm 10
wechselt selbst auf die Version aus `packageManager` (`manage-package-manager-versions`,
Default an), und `pnpm/action-setup` liest `mise.toml` nicht. Die Zeile lässt sich
nicht streichen, ohne die lokale Umgebung des Nutzers zu ändern — kein Befund.

**Badge mit `?branch=main` und Link.** CI läuft auf jedem Branch; der Parameter legt
fest, welchen Stand das Badge zeigt. Der Link folgt dem License-Badge daneben.

**Keine Regressionstests.** Workflows, Manifeste, Ignore-Dateien und Doku haben keinen
Testträger im Repo. Den roten Lauf ersetzt die Lockfile-Probe: gegen HEAD rot
(`$W/paket-5.zug0-lockprobe-head.log`: Weg 1 5/5 und Weg 2 1/5 mit 38 geänderten
Zeilen und `missing peer`), gegen die deklarierten Peers grün
(`$W/paket-5.zug0-lockprobe-declared.log`). Nach Schritt 4 muss sie im Repo grün
laufen.

## Nebenbefunde im Volltext

**Deploy-Checkout · low · `.github/workflows/deploy.yml:24` und `:67`** (aus Paket 1)
`actions/checkout` ohne `ref` (beide Checkouts, Job `version` und `deploy`) holt bei
`workflow_run` den aktuellen Kopf von `main` statt `github.event.workflow_run.head_sha`;
ein Push zwischen CI-Ende und Deploy wird ungeprüft veröffentlicht. Der Fix muss beide
Checkouts gemeinsam umstellen.
Abgleich: unverändert, beide Checkouts ohne `with.ref`.

**Testpaket ohne Publish-Schutz · low · `packages/twopoint5d-testing/package.json:1-4`** (aus Paket 1)
`"private": true` fehlt im Kopf; das reine Testpaket ist nicht gegen ein versehentliches
Publish geschützt.
Abgleich: unverändert. `apps/lookbook/package.json:5` trägt `"private": true` schon,
das Root-Manifest ebenso (`package.json:7`).

**Doppelte pnpm-Version · low · `.github/workflows/ci.yml:27-28`** (aus Paket 2)
`pnpm/action-setup` nennt `version: 10.27.0` neben `packageManager: pnpm@10.27.0` in
`package.json:12`; Dependabot hebt beide nicht gemeinsam, sie laufen beim nächsten
pnpm-Bump auseinander.
Abgleich: unverändert bei `ci.yml:26-27`; dieselbe Stelle in `deploy.yml:70-71`.
`pnpm/action-setup@fc06bc1…` (v4.4.0) liest ohne `version` das Feld `packageManager`
aus `package.json` (Input `package_json_file`, Default `package.json`, laut `action.yml`
des gepinnten Commits).

**Lockfile kippt bei nicht eingefrorenem Install · low · `pnpm-lock.yaml:58`** (aus Paket 3b)
Ein nicht eingefrorenes, online aufgelöstes `pnpm install` schreibt die optionalen
`@emnapi/core`/`@emnapi/runtime`-Peers an `@astrojs/compiler-binding*`,
`astro-eslint-parser`, `eslint-plugin-astro` neu und warnt
`missing peer @emnapi/core@"^1.7.1 || ^2.0.0-alpha.4"`; `--frozen-lockfile` und
`--lockfile-only --offline` bleiben Fixpunkt.
Abgleich: reproduziert (heute 38 geänderte Zeilen; die +45/−5 aus Paket 3b enthielten
dessen `@types/mocha`-Zeilen), Ursache siehe »Entscheidungen in Zug 0«.

**README-Badge · info · `README.md:19`** (aus Paket 1)
Das Badge »main workflow status« zeigt `deploy.yml`, nicht die CI.
Abgleich: unverändert.

**README-Kommentar · info · `README.md:91`** (aus Paket 1)
Der Kommentar zu `pnpm cbt` lässt `checkNameableTypes` und `test:scripts` aus.
Abgleich: unverändert; das Gate in `package.json:33` ist clean, lint, build, typecheck,
checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser.

**Tote `build`-Einträge · info · `.gitignore:4`, `.prettierignore:9`, `.prettierignore:11`** (aus Paket 1)
`build` und `packages/*/build` nennen ein Verzeichnis, das kein Script der Bibliothek
erzeugt; `apps/*/build` war ungeprüft.
Abgleich: unverändert. `apps/lookbook/astro.config.mjs` setzt kein `outDir`, Astro baut
nach `apps/lookbook/dist`; kein Script, kein Nx-Target, keine Datei im Baum heißt
`build` (außer `node_modules`), `git status --ignored` zeigt nichts darunter.

**Tote `/.sass-cache`-Zeile · info · `.gitignore:29`** (aus Paket 2)
Dart-Sass legt das Verzeichnis nicht an, und die Lookbook hat kein `sass` mehr.
Abgleich: unverändert, kein `.sass-cache` im Baum.
