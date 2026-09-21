# Paket 1 — CI-Pipeline: Nx-Cache über Läufe, keine Doppelarbeit, gepinnte Actions, schlanker Deploy

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: Cache-Auftrag (Nutzer, Vorrang), CFG-019 (low), CFG-018 (low), SEC-003 (medium), Offene Frage »OIDC Trusted Publisher« (Deploy-Frühausstieg, `always-auth`), CONS-052 (info)
- Ziel: Ein CI-Lauf auf unveränderten Inputs holt Build, Typecheck und Tests aus dem Cache, eine Änderung invalidiert genau die betroffenen Targets, und keine Pipeline baut oder lädt etwas doppelt.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - neu: `scripts/ci/nxCacheServer.mjs`, `scripts/ci/nxCacheServer/createCacheServer.mjs`, `scripts/ci/nxCacheServer/createCacheServer.test.mjs`
  - geändert: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `nx.json`, `packages/twopoint5d/package.json`, `packages/twopoint5d/package.override.json`, `packages/twopoint5d-testing/package.json`, `packages/twopoint5d-testing/project.json`, `apps/lookbook/project.json`, `pnpm-lock.yaml` (nur durch `pnpm install`), `AGENTS.md`, `README.md`, `docs/architecture.md`
  - gelöscht: `scripts/makeBanner.mjs`, `scripts/makeBanner/banner.mjs`, `scripts/makeBanner/makeVersionWithBuild.mjs`, `packages/twopoint5d/.npmignore`
  - **nicht** anfassen: `scripts/publishNpmPkg.mjs`, `scripts/publishNpmPkg/`, `scripts/makePackageJson*` (Paket 4), `packages/twopoint5d/vite.config.ts` und das `test`-Script der Bibliothek (Paket 3), Dependabot (Paket 2)
- Verify: `pnpm install --frozen-lockfile && pnpm run ci && /tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad/bin/actionlint .github/workflows/ci.yml .github/workflows/deploy.yml` — das actionlint-Binary vorher per Schritt 9 ins Arbeitsverzeichnis holen; dazu der Cache-Beleg aus Schritt 8, Protokoll in `paket-1.cacheproof.log`
- Commit: `ci: carry the Nx cache from one CI run to the next, pin every action to a commit and let deploy stop before installing a version npm already has` — Body siehe unten
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · Cache-Auftrag unverändert (kein Cache-Schritt in `ci.yml`; Nx 23.2 legt Cache und Index-DB unter `~/.nx/<workspace-id>/`, die DB heißt `<machine-id>-v3.db`) · CFG-019 unverändert, Zeilen verschoben (`nx.json:67`, `docs/architecture.md:85`) · CFG-018 unverändert · SEC-003: Pinning unverändert, Token-Echo gegenstandslos (seit `f8d255e3`) · OIDC-Frage: `always-auth` unverändert `deploy.yml:28` · CONS-052 umgeformt, nur `README.md:75` weicht ab · keine Folgen offen · 1 Nebenbefund nach »Offene Befunde« (Deploy checkt nicht den geprüften Commit aus) · Restplan unverändert: Reihenfolge und Schnitt von Paket 2–4 bleiben, Übergaben stehen unter »Für Zug 5«
  - 2026-09-21 Zug 1: Implementierer beauftragt (opus, effort medium, `remediate-twopoint5d-p1-impl-1`, Report `paket-1.impl-1.json`)
  - 2026-09-21 Zug 2: Report FERTIG_MIT_VORBEHALT (Lockfile-Drift: optionale `@emnapi`-Peers an `eslint-plugin-astro`/`astro-eslint-parser`/`@astrojs/compiler-*`, stabil; CI-Belege offen bis zum Push) · 15 Dateien (3 neu unter `scripts/ci/`, 4 gelöscht) · Arbeitsbaum schmutzig · eigener Verify `paket-1.verify.log` exit=0 · Cache-Beleg a–e wie Tabelle (0/6, 6/6, 4/6, 0/6, 6/6) · roter Lauf der Server-Spec 0/9 belegt
  - 2026-09-21 Zug 3: Reviewer (opus, medium, `paket-1.review-1.json`) auf `paket-1.diff`: alle 6 Aufträge erfüllt · 0 kritisch, 1 wichtig (Concurrency-Gruppe auf `main` verwirft wartende Läufe, `ci.yml:13` + `docs/architecture.md:83`), 3 klein
  - 2026-09-21 Zug 4 Runde 1: offen 1 wichtig (+ klein: verworfenes `waitFor` in `createCacheServer.test.mjs:131` mitgegeben) → derselbe Implementierer per `--resume 18f1a9ea…`, Report `paket-1.impl-2.json`
  - 2026-09-21 Zug 4 Runde 1 zurück: FERTIG (`ci.yml` Concurrency-Gruppe je Commit auf `main`, Kommentar und `docs/architecture.md:81-85` angepasst; `assert.ok` um `waitFor`) · Verify `paket-1.verify-2.log` exit=0 · Diff `paket-1.diff-2` · Reviewer per Resume (`paket-1.review-2.json`): beide behoben, 1 klein neu (Wortlaut Commit-Body, eingearbeitet) · offen 1 → 0
  - 2026-09-21 Zug 5: Commit `42a88429` (19 Dateien, +526/−123) auf Verify `paket-1.verify-2.log` exit=0; ein erster Teil-Commit `d141d49c` (nur die vier Löschungen, `git add` war an der bereits gestagten Löschung von `.npmignore` abgebrochen) per `--amend` zum vollen Stand ergänzt, Inhalt = geprüfter Diff

## Review

Urteil des Reviewers (`paket-1.review-1.json`, bestätigt in `paket-1.review-2.json`):

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| Cache-Auftrag | behoben | `scripts/ci/nxCacheServer.mjs`, `scripts/ci/nxCacheServer/createCacheServer.mjs`, `.github/workflows/ci.yml` (Restore/Server/Aufräumen/Save, Playwright-Cache), `nx.json` `vitestDefaults`/`makePackageJson`, `packages/twopoint5d-testing/project.json:7`, `apps/lookbook/project.json:24-28`; Cache-Beleg a–e wie Tabelle |
| CFG-019 | behoben | `packages/twopoint5d/package.json:49,53-55`, `package.override.json:1-4`, `makeBanner*` und `.npmignore` gelöscht, Named Input und Doku-Satz entfernt |
| CFG-018 | behoben | `packages/twopoint5d-testing/package.json` ohne `postinstall`/`@playwright/test`/`playwright`, `ci.yml` Browser nur bei Cache-Miss, `deploy.yml` `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`, Doku in `AGENTS.md`, `README.md`, `docs/architecture.md` §6 |
| SEC-003 | behoben | alle `uses:` auf volle SHAs mit `# vX.Y.Z` (per `git ls-remote` gegengeprüft), `permissions`/`concurrency` in `ci.yml`, `id-token: write` nur im Publish-Job; Token-Echo war schon vorher weg |
| Offene Frage OIDC | behoben | `always-auth` entfernt, Job `version` in `deploy.yml`, Doku `docs/architecture.md` §4 |
| CONS-052 | behoben | `README.md:75` `>=10.22.0` mit `engines` als Quelle |

Kleine Befunde, alle erledigt: verworfenes `waitFor` im Abbruchtest (Runde 1 behoben); Lockfile-Drift und fehlende Punkte im Commit-Body; »runs queue« → »runs never overlap« (im Commit-Body eingearbeitet).

Abweichung vom Detailplan: Die Zielfassung von `ci.yml` in Schritt 5 unten trägt noch den alten `concurrency`-Block (`group: …-${{ github.ref }}`, `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`). Er hätte auf `main` einen wartenden Lauf beim nächsten Push verdrängt; committet ist `group: ${{ github.workflow }}-${{ github.ref == 'refs/heads/main' && github.sha || github.ref }}` mit `cancel-in-progress: true`. Maßgeblich ist der Commit.

Lockfile: der Diff reicht über Schritt 3 hinaus — `pnpm install` löst die optionalen `@emnapi`-Peers an `eslint-plugin-astro`, `astro-eslint-parser` und `@astrojs/compiler-*` neu auf. Der Implementierer hat belegt, dass HEAD mit `--lockfile-only` keinen Diff erzeugt, die Drift also aus dem Streichen der beiden Abhängigkeiten kommt, und dass sie stabil ist.

Nebenbefunde des Implementierers, Urteil an der Scope-Regel: `"private"` im Testpaket betrifft die Publish-Pipeline; Badge und `pnpm cbt`-Kommentar im README beschreiben CI und Gate; `build`-Einträge in `.gitignore`/`.prettierignore` betreffen Build und Lint-Gate — alle `→ Scope`, keiner teilt die Ursache dieses Pakets.

## Abgleich

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| Cache-Auftrag | unverändert | `.github/workflows/ci.yml` hat keinen Cache-Schritt außer dem pnpm-Store (`setup-node` `cache: pnpm`, Z. 22). Nx 23.2 legt den Task-Cache **nicht** unter `.nx/cache`: ohne `cacheDirectory` in `nx.json` und ohne `NX_CACHE_DIRECTORY` gehen Artefakte nach `~/.nx/<16-hex-workspace-id>/cache`, der Index nach `~/.nx/<id>/databases/<machine-id>-v3.db` (`node_modules/nx/dist/src/utils/cache-directory.js`, `db-connection.js`; lokal nachgerechnet). `.nx/workspace-data` enthält nur Projektgraph, Daemon-Log und eine alte DB. |
| CFG-019 | unverändert, verschoben | `packages/twopoint5d/package.json:53-56` (`pnpm run build &&` in `checkPkgTypes`, `checkNameableTypes`, `lintPkg`; `publishNpmPkg` ruft alle drei), `:49` `clean` = `pnpm rimraf build types dist`; `nx.json:67` Named Input `makeBanner`; `docs/architecture.md:85-86` Satz zum Banner; `scripts/makeBanner.mjs` + `scripts/makeBanner/*.mjs` ohne Aufrufer (`git grep` findet nur nx.json und die Doku); `packages/twopoint5d/.npmignore` (19 Zeilen, rollup/jest) wird nie nach `dist/` kopiert; `package.override.json` nullt `rollup`, `nx`, `prettier`, `jest`, die im Manifest nicht vorkommen |
| CFG-018 | unverändert | `packages/twopoint5d-testing/package.json:14` `postinstall`, `:18` `@playwright/test` (kein Test importiert es — alle Tests nutzen `@esm-bundle/chai` + `@web/test-runner`), `:29` `playwright` (Root hat `playwright ^1.62.1`, `@web/test-runner-playwright` bringt sein eigenes mit; Lockfile kennt genau eine Version 1.62.1); `ci.yml:27-28` zweiter Download; `deploy.yml:33-34` Install mit Browser-Download |
| SEC-003 | teils gegenstandslos | Pinning offen: `ci.yml:13,15,19,35`, `deploy.yml:19,21,25` auf beweglichen Tags. Token-Echo **gegenstandslos**: `scripts/publishNpmPkg.mjs:18-19` gibt heute `packageJson: ---` und das Manifest aus, die Token-Zeilen hat `f8d255e3` (2026-09-20) entfernt; `deploy.yml` setzt keine Token-Variable. `permissions`/`concurrency` fehlen in `ci.yml` |
| Offene Frage OIDC | unverändert | `deploy.yml:28` `always-auth: true`; der Job installiert und baut auch dann, wenn die Version auf npm schon existiert (`publishNpmPkg.mjs:32-34` steigt erst nach Install und vier Builds aus) |
| CONS-052 | umgeformt | `AGENTS.md:28` und `docs/architecture.md:108-109` schreiben bereits `>=10.22.0` und nennen `engines` in `package.json` als Quelle. Nur `README.md:75` sagt »v10.22 or newer« |

## Entscheidungen in Zug 0

1. **Nx-Cache in CI über einen lokalen Remote-Cache-Server, persistiert per `actions/cache`.**
   Ein wiederhergestelltes Cache-Verzeichnis trifft auf einem neuen Runner nie: Nx 23
   fragt bei jedem Lookup zuerst die Index-DB (`UPDATE cache_outputs … WHERE hash = ?1`
   in der nativen Binary), und diese DB heißt nach der Machine-ID. Nx sagt das selbst
   (`tasks-runner/cache.js`, `assertCacheIsValid`: »keyed by machine ID so they would hit
   issues«) und warnt in CI mit »Unrecognized Cache Artifacts«. GitHub-Runner-VMs bekommen
   je Job eine neue Machine-ID. Verworfen:
   - `@nx/shared-fs-cache`: abgekündigt, von CVE-2025-36852 (CREEP) betroffen, lizenzpflichtig.
   - DB nach dem Restore auf die aktuelle Machine-ID umbenennen: hängt an einem
     undokumentierten Dateinamen (`<machine-id>-v3.db`, Quelle `/var/lib/dbus/machine-id`
     vor `/etc/machine-id`) und hebelt eine Prüfung aus, die Nx als Integritätsschutz
     beschreibt.
   - Nx Cloud: vom Nutzer ausgeschlossen.
   Gewählt: Nx' dokumentierter Weg für eigene Remote-Caches
   (<https://nx.dev/docs/kb/self-hosted-caching>, OpenAPI `/v1/cache/{hash}`), aktiviert
   über `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` + `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`
   (`cache.js` `getHttpCache()`, keine Lizenzprüfung). Ein kleiner Node-Server im Runner
   bedient ein Verzeichnis; `actions/cache` sichert genau dieses Verzeichnis mit dem vom
   Nutzer beschlossenen Key (Lockfile + Commit-SHA, Restore-Keys auf den letzten Stand).
   Lokal belegt in Zug 0 mit einem Wegwerf-Server: Lauf mit leerem lokalem Cache →
   `GET 404`, `PUT 200` (190 898 Byte, `Authorization: Bearer <token>`,
   `Content-Type: application/octet-stream`, `Content-Length` gesetzt); zweiter Lauf mit
   *anderem* leerem lokalem Cache- und DB-Verzeichnis → `GET 200`, `Cache: 1/1 hit`.
   Nicht belegt: wie Nx auf `409` reagiert (kam im Probelauf nicht vor) — der Server
   antwortet nach Spec, der Test prüft es serverseitig.
2. **Der Deploy-Job nutzt den Nx-Cache nicht.** Er startet keinen Server und setzt keine
   `NX_SELF_HOSTED_*`-Variable; das veröffentlichte Paket entsteht immer aus dem Quelltext.
   Damit liegt die Vertrauensgrenze des Caches vor dem Publish-Job. Die doppelte
   Build-Arbeit im Deploy erledigt der Frühausstieg (Schritt 6): gebaut wird nur, wenn
   wirklich veröffentlicht wird.
3. **Cache-Einträge nur nach grünem Gate sichern, vorher ungenutzte streichen.** Der
   Server setzt bei jedem Treffer die mtime der Datei auf jetzt; vor dem Save löscht
   `find` alles, was älter ist als eine Marke vom Serverstart. So enthält jeder
   gespeicherte Stand genau die Artefakte des letzten grünen Commits und wächst nicht
   über Läufe hinweg. Ein roter Lauf speichert nichts; der nächste stellt den letzten
   grünen Stand wieder her.
4. **Actions auf den neuesten Release ihres heute benutzten Majors pinnen**, nicht auf
   neue Majors heben: SEC-003 verlangt das Pinnen, nicht das Upgraden. Die Pins
   entsprechen genau dem, was `@v4` heute auflöst, das Verhalten ändert sich also nicht.
   Major-Upgrades kommen als Dependabot-PRs aus Paket 2. Ausnahme: `actions/cache` ist neu
   und kommt gleich in der aktuellen Version v6.1.0. Aufgelöst am 2026-09-21 per
   `git ls-remote`:
   | Action | Tag | Commit |
   | --- | --- | --- |
   | `actions/checkout` | v4.4.0 | `11d5960a326750d5838078e36cf38b85af677262` |
   | `pnpm/action-setup` | v4.4.0 | `fc06bc1257f339d1d5d8b3a19a8cae5388b55320` |
   | `actions/setup-node` | v4.4.0 | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
   | `actions/upload-artifact` | v4.6.2 | `ea165f8d65b6e75b540449e92b4886f43607fa02` |
   | `actions/cache`, `actions/cache/restore`, `actions/cache/save` | v6.1.0 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` |
5. **Vitest-Inputs vervollständigen statt aufweiten.** `vitestDefaults` nennt heute nur
   `vitest` und `@vitest/coverage-v8` als externe Abhängigkeiten, deshalb hasht Nx für
   `twopoint5d:test` 206 npm-Knoten und *nicht* `three`, `@spearwolf/eventize`,
   `@spearwolf/signalize`, `sinon`. Ein Katalog-Bump von `three` ließe die Vitest-Suite aus
   dem Cache grün stehen. Die Liste wird um genau die Pakete ergänzt, die Specs und
   getesteter Code zur Laufzeit laden (per `grep` über `src/**/*.ts`: `three` inkl.
   `three/webgpu`/`three/tsl`, `@spearwolf/eventize`, `@spearwolf/signalize`, `sinon`).
   `AllExternalDependencies` hätte jeden Lint-Bump die Suite neu laufen lassen; die
   Projekt-Doku beschreibt die Liste als bewusst schmal, das bleibt so.
6. **Konsumenten der Bibliothek hängen am Build-Output, nicht an ihren Quellen.**
   `twopoint5d-testing:test` (`["default", "^default"]`) und die Lookbook-Targets
   (`typecheck` mit `^default`, `build` implizit `default` + `^default`) hashen heute
   *alle* Dateien der Bibliothek, auch Specs, `docs/`, `CHANGELOG.md`, `README-pkg.md`,
   `.npmignore` und das Logo. Beide importieren die Bibliothek ausschließlich als
   `@spearwolf/twopoint5d`, also aus `dist/` (geprüft: 24 bzw. 30 Imports, kein relativer
   Pfad in die Quellen). Ersetzt durch
   `{"dependentTasksOutputFiles": "**/*", "transitive": true}` (in Nx 23 vorhanden,
   `schemas/project-schema.json:314`). Eine Spec- oder Doku-Änderung der Bibliothek lässt
   Browser-Suite und Lookbook dann im Cache; eine Änderung am emittierten `dist/` nicht.
7. **Root-`package.json` wird Build-Input.** `scripts/makePackageJson.mjs:18-19` liest sie
   (`sharedDependencies`, von `resolveDependencies.mjs:89` für `workspace:`-Specifier
   außerhalb von `packages/` genutzt). Heute ohne Wirkung, weil die Bibliothek nur
   `catalog:`-Peers hat, aber das Build liest die Datei und muss sie deshalb als Input
   führen.
8. **`checkPkgTypes`, `checkNameableTypes`, `lintPkg` bleiben ungecacht.** Die Doku nennt
   das eine bewusste Entscheidung (`docs/architecture.md:35-36`), die Checks sind ohne
   Build billig, und sie bewachen das Publish.
9. **`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` im Deploy bleibt**, obwohl nach dem Streichen
   des `postinstall` nichts mehr Browser lädt: Die Variable schützt den Publish-Job gegen
   jeden künftigen Install-Hook und kostet eine Zeile. Das Audit empfiehlt sie auch.
10. **Kein Paketschnitt.** Alle Teile dienen demselben Ziel und treffen sich in `ci.yml`.
    Zwei Implementierer hintereinander auf derselben Workflow-Datei kosten mehr, als ein
    großer Diff kostet.
11. **Deploy-Frühausstieg als eigener Job**, nicht über Step-Bedingungen: Der Check-Job
    braucht weder `id-token: write` noch Node-Setup. `id-token: write` wandert auf den
    Publish-Job, und ein übersprungener Publish ist im Actions-UI als »skipped« sichtbar.

## Vorgehen

Alle Code-, Kommentar- und Doku-Texte englisch; Kommentare erklären das *Warum*; kein
Satz über den Vorzustand (Konventionen im Plan-Kopf).

### 1. Nx-Inputs (`nx.json`, zwei `project.json`)

`nx.json`, `namedInputs`:
- `makeBanner` streichen.
- `makePackageJson`: nach `"{projectRoot}/package.override.json"` die Zeile
  `"{workspaceRoot}/package.json"` einfügen.
- `vitestDefaults`, letztes Element:
  `{"externalDependencies": ["vitest", "@vitest/coverage-v8", "three", "@spearwolf/eventize", "@spearwolf/signalize", "sinon"]}`

`packages/twopoint5d-testing/project.json`, `targets.test.inputs`:
`["default", {"dependentTasksOutputFiles": "**/*", "transitive": true}]`

`apps/lookbook/project.json`:
- `targets.typecheck.inputs`: `"^default"` ersetzen durch
  `{"dependentTasksOutputFiles": "**/*", "transitive": true}`, alle anderen Einträge bleiben.
- neues `targets.build`: `{"inputs": ["default", {"dependentTasksOutputFiles": "**/*", "transitive": true}]}`
  (`dependsOn` und `outputs` kommen weiter aus `targetDefaults`).

Prüfen mit `NX_DAEMON=false pnpm nx show target inputs <projekt:target> --json`:
`twopoint5d:test` listet `npm:three`, `npm:@spearwolf/eventize`,
`npm:@spearwolf/signalize`, `npm:sinon`; `twopoint5d-testing:test`, `lookbook:typecheck`
und `lookbook:build` listen keine Datei unter `packages/twopoint5d/` mehr;
`twopoint5d:build` listet `package.json` (Root).

### 2. Gate ohne Zusatz-Builds, totes Material weg (CFG-019)

`packages/twopoint5d/package.json`, `scripts`:
- `"clean": "pnpm rimraf dist"`
- `"checkPkgTypes": "pnpm exec attw --pack dist --ignore-rules cjs-resolves-to-esm no-resolution"`
- `"checkNameableTypes": "node ../../scripts/checkNameableTypes.mjs"`
- `"lintPkg": "pnpm exec publint dist"`
- `publishNpmPkg` bleibt wörtlich; die drei Checks laufen darin auf dem `dist/`, das die
  Nx-Abhängigkeit `publishNpmPkg → build` erzeugt.

`packages/twopoint5d/package.override.json` → `{"scripts": null, "devDependencies": null}`
(Prettier-Format wie die übrigen JSON-Dateien).

Löschen: `scripts/makeBanner.mjs`, `scripts/makeBanner/` (beide Dateien),
`packages/twopoint5d/.npmignore`.

Gegenprobe: `pnpm build:twopoint5d` vor und nach dem Umbau, `dist/package.json` ist
byte-gleich (`cmp`). Beide Kopien liegen im Arbeitsverzeichnis, nicht im Repo.

### 3. Browser nur einmal, nur wo gebraucht (CFG-018)

`packages/twopoint5d-testing/package.json`: `scripts.postinstall`,
`dependencies["@playwright/test"]` und `devDependencies.playwright` streichen. Danach
`pnpm install`; der Lockfile-Diff darf nur diese Einträge betreffen (Importer
`packages/twopoint5d-testing`, Paketeintrag `@playwright/test@1.62.1`). Danach
`pnpm test:browser` einmal lokal grün.

### 4. Nx-Cache-Server (`scripts/ci/`)

Projektmuster wie `scripts/makePackageJson*`: die Logik in einem Modul mit
`node --test`-Spec daneben, das Script verdrahtet nur. `pnpm test:scripts` findet die
Spec über `scripts/**/*.test.mjs` ohne Änderung.

`scripts/ci/nxCacheServer/createCacheServer.mjs` exportiert
`createCacheServer({dir, token})` und gibt einen **nicht lauschenden** `http.Server`
zurück. Nur `node:`-Builtins. Verhalten, in dieser Prüfreihenfolge:

| Anfrage | Bedingung | Antwort |
| --- | --- | --- |
| Pfad nicht `/v1/cache/<x>` (genau ein Segment) | — | `404` |
| Methode weder `GET` noch `PUT` | — | `405` |
| `GET` | `Authorization` ≠ `Bearer <token>` | `403` (Spec: GET kennt 200/403/404) |
| `PUT` | `Authorization` ≠ `Bearer <token>` | `401` |
| beide | `<x>` passt nicht auf `/^[A-Za-z0-9]+$/` | `400` (Nx-Hashes sind Ziffernfolgen; die Regel verhindert Pfade außerhalb von `dir`) |
| `GET` | `<dir>/<x>` existiert | mtime und atime auf jetzt setzen (`fs.promises.utimes`), dann `200`, `Content-Type: application/octet-stream`, `Content-Length` = Dateigröße, Body = Datei |
| `GET` | fehlt | `404` |
| `PUT` | `Content-Length` fehlt | `411` |
| `PUT` | `<dir>/<x>` existiert | `409`, Body verwerfen (`req.resume()`) |
| `PUT` | sonst | Body per `stream.pipeline` nach `<dir>/.<x>.<pid>.<zufall>.partial`; Byteanzahl ≠ `Content-Length` → Partial löschen, `400`; sonst `fs.promises.link(partial, <dir>/<x>)` — `EEXIST` → `409` —, Partial löschen, `200`. Bricht der Client ab (Pipeline wirft), Partial löschen, keine Antwort nötig |

Der Kommentar am Modul sagt in zwei Sätzen, wofür es da ist: Nx indexiert seinen lokalen
Cache in einer DB, die nach der Machine-ID heißt, deshalb kennt ein neuer Runner ein
wiederhergestelltes Cache-Verzeichnis nicht. Nx übernimmt aber Ergebnisse aus einem
Remote-Cache nach seiner OpenAPI-Spec, und dieser Server bedient damit ein Verzeichnis,
das der Workflow per `actions/cache` sichert. Der `link`-Schritt bekommt einen Satz:
Einträge sind unveränderlich, der erste Schreiber gewinnt.

`scripts/ci/nxCacheServer.mjs`: `parseArgs` aus `node:util` mit `--dir` und `--port`;
Token aus `process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`, also derselben Variable,
die Nx liest. Fehlt eines davon: Usage-Zeile auf stderr, Exit 1. `fs.mkdirSync(dir,
{recursive: true})`, `listen(port, '127.0.0.1')`, danach eine Zeile
`nx cache server listening on http://127.0.0.1:<port>, serving <dir>`; `error`-Event
(z. B. `EADDRINUSE`) → Meldung auf stderr, Exit 1.

`scripts/ci/nxCacheServer/createCacheServer.test.mjs` (`node:test`,
`node:assert/strict`, Temp-Verzeichnis via `fs.mkdtempSync(path.join(os.tmpdir(), 'nx-cache-server-'))`, nach jedem Test entfernt,
Server auf Port `0`, globales `fetch`, für die Abbruchfälle `node:http`). Pro Fall ein
`test`:
1. GET auf unbekannten Hash → 404
2. PUT → 200, danach GET → 200 mit identischen Bytes und `Content-Length`
3. zweiter PUT auf denselben Hash → 409, Datei unverändert
4. falsches Token: GET → 403, PUT → 401, danach keine Datei im Verzeichnis
5. Hash `..%2F..%2Fx` bzw. `a.b` → 400, außerhalb des Verzeichnisses entsteht nichts
6. GET frischt die mtime auf: Datei per `utimes` auf 2020 setzen, GET, mtime ist jünger als der Teststart
7. PUT ohne `Content-Length` (chunked über `node:http`) → 411
8. Client bricht einen PUT nach der Hälfte des angekündigten Bodys ab (`req.destroy()`) → binnen 1 s weder `<hash>` noch eine `.partial`-Datei im Verzeichnis
9. `DELETE` → 405; Pfad `/v2/cache/1` → 404

Roter Lauf zuerst: Spec schreiben, gegen ein leeres Modul (`export function
createCacheServer() {}`) laufen lassen, Ausgabe in den Report, dann implementieren.

### 5. `.github/workflows/ci.yml` — Zielfassung

```yaml
name: Continuous Integration

on:
  push:
    paths-ignore:
      - '**.md'

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  # every commit on main keeps its run, so the deploy workflow has a result to follow
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

jobs:
  ci:
    name: Build, Lint and Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0

      - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
        with:
          version: 10.27.0

      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Read the Playwright version
        id: playwright
        run: echo "version=$(pnpm exec playwright --version | awk '{print $2}')" >> "$GITHUB_OUTPUT"

      - name: Cache the Playwright browsers
        id: playwright-cache
        uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ steps.playwright.outputs.version }}

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install --with-deps chromium firefox

      - name: Install the system libraries of the Playwright browsers
        # the cache holds the browsers, not the apt packages they link against
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: pnpm exec playwright install-deps chromium firefox

      - name: Restore the Nx cache
        id: nx-cache
        uses: actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: ${{ runner.temp }}/nx-cache
          key: nx-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ github.sha }}
          restore-keys: |
            nx-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
            nx-${{ runner.os }}-

      - name: Start the Nx cache server
        # Nx indexes its local cache in a database named after the machine id, so a
        # restored ~/.nx means nothing to a new runner. Nx does take results from a
        # self-hosted remote cache; this one serves the directory actions/cache restored.
        run: |
          token=$(openssl rand -hex 16)
          echo "::add-mask::$token"
          touch "$RUNNER_TEMP/nx-cache.start"
          NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="$token" nohup node scripts/ci/nxCacheServer.mjs --dir "$RUNNER_TEMP/nx-cache" --port 47873 > "$RUNNER_TEMP/nx-cache-server.log" 2>&1 &
          curl --silent --output /dev/null --retry 10 --retry-connrefused --retry-delay 1 http://127.0.0.1:47873/v1/cache/0
          echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:47873" >> "$GITHUB_ENV"
          echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=$token" >> "$GITHUB_ENV"

      - name: Build packages and run all tests
        run: xvfb-run pnpm run ci
        timeout-minutes: 20

      - name: Drop the Nx cache entries this run did not use
        # the server touches every entry it serves; what is older than its start went unused
        if: success() && steps.nx-cache.outputs.cache-hit != 'true'
        run: find "$RUNNER_TEMP/nx-cache" -type f \( ! -newer "$RUNNER_TEMP/nx-cache.start" -o -name '*.partial' \) -delete

      - name: Save the Nx cache
        if: success() && steps.nx-cache.outputs.cache-hit != 'true'
        uses: actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
        with:
          path: ${{ runner.temp }}/nx-cache
          key: ${{ steps.nx-cache.outputs.cache-primary-key }}

      - name: Show the Nx cache server log
        if: failure()
        run: cat "$RUNNER_TEMP/nx-cache-server.log" || true

      - name: Archive coverage report
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        if: always()
        with:
          name: coverage
          path: packages/twopoint5d/coverage
          retention-days: 3
```

Die Env-Variablen gehen erst
**nach** dem Start per `$GITHUB_ENV` hinaus, sodass kein früherer Nx-Aufruf gegen einen
Server läuft, den es noch nicht gibt. `restore-keys` greifen zuerst auf denselben
Lockfile-Stand, dann auf den letzten Stand überhaupt.

### 6. `.github/workflows/deploy.yml` — Zielfassung

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
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    outputs:
      publish: ${{ steps.check.outputs.publish }}
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
        with:
          sparse-checkout: packages/twopoint5d/package.json
          sparse-checkout-cone-mode: false

      - name: Compare the manifest version with npm
        id: check
        # publishNpmPkg.mjs skips the same two cases; this check only spares install and build
        run: |
          name=$(node -p "require('./packages/twopoint5d/package.json').name")
          version=$(node -p "require('./packages/twopoint5d/package.json').version")
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

  deploy:
    name: Deploy NPM Packages
    needs: version
    if: ${{ needs.version.outputs.publish == 'true' }}
    runs-on: ubuntu-latest
    permissions:
      id-token: write # Required for OIDC
      contents: read
    env:
      # nothing in the publish job runs a browser
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1'
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0

      - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
        with:
          version: 10.27.0

      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
          scope: '@spearwolf'
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # builds from source: the Nx cache of the CI workflow never reaches a published package
      - run: pnpm run publishNpmPkg
        name: Publish npm packages
```

`npm view` auf eine fehlende Version endet mit `E404`, Exit 1 (in Zug 0 lokal mit npm 11
geprüft); eine vorhandene Version gibt Exit 0 und die Versionsnummer aus. Jeder andere
Fehler, etwa ein Registry-Ausfall, lässt den Job rot werden, statt still zu
veröffentlichen oder still zu überspringen. `always-auth` fällt weg.

### 7. Doku

`docs/architecture.md`:
- §2: den `vitestDefaults`-Satz um die Laufzeitpakete ergänzen, dazu ein Satz: Eine Spec,
  die ein Paket außerhalb dieser Liste importiert, trägt es dort nach, sonst lässt ein
  Bump dieses Pakets ein altes Ergebnis im Cache stehen. Ein neuer Absatz: Die
  Konsumenten der Bibliothek (`twopoint5d-testing:test`, `lookbook:build`,
  `lookbook:typecheck`) nehmen ihren Build-Output als Input
  (`dependentTasksOutputFiles`), nicht ihre Quellen — Specs, Doku und CHANGELOG der
  Bibliothek lassen sie im Cache, ein geändertes `dist/` nicht. `makePackageJson`
  schließt die Root-`package.json` ein.
- §3: neuer Unterabschnitt `### In CI` (keine neue Nummer, damit »§4« im Text stimmt):
  gepinnte Actions (voller Commit-SHA mit `# vX.Y.Z`-Kommentar; Dependabot nennt der
  Text nicht, den richtet erst Paket 2 ein), `permissions: contents: read`, `concurrency`, Playwright-Browser gecacht nach Version,
  Nx-Cache-Mechanik aus Entscheidung 1 und 3 (Server, Verzeichnis, Key-Schema,
  Aufräumen vor dem Save, Save nur nach grünem Gate), Vertrauensgrenze (Einträge stammen
  nur aus CI-Läufen von Pushes in dieses Repo; `deploy.yml` baut ohne den Cache). Ein
  Satz: Root-`playwright` und das von `@web/test-runner-playwright` aufgelöste
  `playwright` müssen dieselbe Version sein, weil der Cache-Key der Root-Version folgt.
- §4: den Satz »`scripts/makeBanner.mjs` builds the version banner.« streichen; bei der
  Override-Datei »(`scripts`, `devDependencies`, tool configs)« → »(`scripts`,
  `devDependencies`)«; im Publish-Absatz: `deploy.yml` prüft zuerst, ob npm die Version
  hat (oder ob sie auf `-dev` endet), und installiert und baut nur sonst.
  Authentifiziert wird über npm Trusted Publishing (OIDC, `id-token: write` nur im
  Publish-Job), es gibt kein npm-Token; Releases tragen SLSA-Provenance und
  `GitHub Actions <npm-oidc-no-reply@github.com>` als Publisher, zuerst 0.21.2. Der Satz
  »Changes under `scripts/` are changes to the publish pipeline« bekommt den Zusatz, dass
  `scripts/ci/` nur der CI-Workflow ausführt.
- §6: »Its `postinstall` installs the browsers.« → die Browser kommen aus
  `pnpm exec playwright install chromium firefox`, `pnpm install` lädt keine.

`AGENTS.md`:
- Commands, nach `pnpm install`: ``- `pnpm exec playwright install chromium firefox` — the browsers for `pnpm test:browser`; once after the first install and after every Playwright bump``
- `pnpm test:scripts`-Zeile: »the helpers of the publish pipeline and the CI cache server (`scripts/**/*.test.mjs`)«
- Regel »Publishing«: `scripts/` ist die Publish-Pipeline, `scripts/ci/` der Nx-Cache-Server des CI-Workflows.
- Zeile 28 bleibt (schreibt schon `>=10.22.0` und nennt `engines`).

`README.md`:
- Z. 75: »[pnpm](https://pnpm.io/) v10.22 or newer« → »[pnpm](https://pnpm.io/) `>=10.22.0`«,
  dazu im selben Satz, dass beide Bereiche aus `engines` der Root-`package.json` stammen.
- Abschnitt »1. Install dependencies«: nach dem `pnpm install`-Block ein Satz und ein
  Block `pnpm exec playwright install chromium firefox` (die Browser-Tests in `pnpm cbt`
  brauchen sie; `--with-deps` auf Linux, falls Systembibliotheken fehlen).

Kein CHANGELOG-Eintrag: nichts davon ändert das veröffentlichte Paket (die Gegenprobe in
Schritt 2 belegt es).

### 8. Cache-Beleg (lokal, Pflicht)

Als Datei `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad/paket-1.cacheproof.sh`
ablegen, aus dem Repo-Root ausführen, die Ausgabe nach `paket-1.cacheproof.log` daneben. Jeder Lauf bekommt ein **frisches** lokales
Cache- und DB-Verzeichnis, stellt also einen neuen Runner dar. Der Remote-Cache ist der
neue Server:

```bash
set -u
ARB=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad
P=$ARB/cacheproof; rm -rf "$P"; mkdir -p "$P"
export NX_DAEMON=false NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=proof NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:47873
node scripts/ci/nxCacheServer.mjs --dir "$P/remote" --port 47873 > "$P/server.log" 2>&1 &
SERVER=$!; sleep 1
run() {
  echo "### $1"
  NX_CACHE_DIRECTORY="$P/$1/cache" NX_WORKSPACE_DATA_DIRECTORY="$P/$1/wd" \
    pnpm nx run-many -t build typecheck test --projects=twopoint5d,twopoint5d-testing,lookbook > "$P/$1.log" 2>&1
  echo "exit=$?"; grep -E '^> nx run|Cache:' "$P/$1.log"
}
run a
run b
echo '// cache probe' >> packages/twopoint5d/src/vertex-objects/createTypedArray.spec.ts
run c
git checkout -- packages/twopoint5d/src/vertex-objects/createTypedArray.spec.ts
echo 'export const cacheProbe = 1;' >> packages/twopoint5d/src/index.ts
run d
git checkout -- packages/twopoint5d/src/index.ts
echo '' >> packages/twopoint5d/CHANGELOG.md
run e
git checkout -- packages/twopoint5d/CHANGELOG.md
kill $SERVER
pnpm nx show target inputs twopoint5d:test --json | grep -oE '"npm:(three|@spearwolf/eventize|@spearwolf/signalize|sinon)"' | sort -u
git status --short
```

| Lauf | Änderung | Erwartung |
| --- | --- | --- |
| a | keine, Remote leer | alle sechs Tasks laufen, keiner aus dem Cache |
| b | keine | alle sechs Tasks `[remote cache]` |
| c | Kommentar an eine Spec | `twopoint5d:typecheck`, `twopoint5d:test` laufen; `twopoint5d:build`, `twopoint5d-testing:test`, `lookbook:typecheck`, `lookbook:build` aus dem Cache |
| d | Export an `src/index.ts` | alle sechs laufen (emittiertes `dist/` ändert sich) |
| e | Leerzeile im CHANGELOG | alle sechs aus dem Cache |

Danach vier `npm:`-Treffer und ein Arbeitsbaum, der nur die Paketänderungen zeigt.
Druckt Nx 23 die Task-Zeilen anders, als das `grep`-Muster erwartet, passt der
Implementierer das Muster an und nennt das neue im Report; die Tabelle bleibt der
Maßstab. Weicht ein Lauf ab, ist das ein Befund, kein Grund, die Tabelle anzupassen.

### 9. YAML-Prüfung

```bash
ARB=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad
mkdir -p "$ARB/bin" && curl -sSfL https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz | tar -xz -C "$ARB/bin" actionlint
"$ARB/bin/actionlint" .github/workflows/ci.yml .github/workflows/deploy.yml
```

Kein Docker, das Binary liegt außerhalb des Repos. `shellcheck` ist lokal nicht
installiert; actionlint prüft die `run:`-Blöcke dann ohne ihn, das steht so im Report.

## Was erst der nächste CI-Lauf nach dem Push belegen kann

Der Lauf pusht nicht. Offen bleibt deshalb:
- Der Server startet im Runner, `curl` erreicht ihn, das Gate läuft mit
  `NX_SELF_HOSTED_REMOTE_CACHE_*` grün.
- Der zweite CI-Lauf auf `main` stellt den Stand des ersten wieder her (`Cache restored
  from key: nx-Linux-…`) und meldet für die unveränderten Targets `[remote cache]` bzw.
  `Cache: n/m hit` mit n > 0.
- Der Playwright-Cache trifft im zweiten Lauf, und der Zweig `install-deps` genügt den
  Browsern (Browser-Suite grün).
- Deploy: Nach dem ersten Push steht `version` auf »0.21.2 is on npm already«, und
  `deploy` ist *skipped*.
- Alle gepinnten SHAs lösen auf (sonst scheitert der Job beim Setup).

## Für Zug 5 (Plan-Einträge, die B schreibt)

`Schnittstellen:` sollte mindestens nennen:
- `scripts/ci/nxCacheServer.mjs --dir <pfad> --port <n>`, Token aus
  `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`
- `ci.yml`: Step-IDs `playwright`, `playwright-cache`, `nx-cache`; Cache-Keys `nx-<os>-<lockfile>-<sha>` und `playwright-<os>-<version>`; neue Schritte (z. B. `pnpm audit` aus Paket 2) gehören nach `Install dependencies` und vor das Gate
- `deploy.yml`: Jobs `version` (Output `publish`) und `deploy`; die Skip-Regel (`-dev`, Version schon auf npm) steht doppelt, dort und in `scripts/publishNpmPkg.mjs:21-34` (Paket 4)
- `nx.json` `vitestDefaults` nennt die Laufzeitpakete; ein neues Coverage-Target (Paket 3) nutzt diesen Named Input, sonst fehlen dieselben Inputs dort wieder
- `twopoint5d-testing` hat kein eigenes `playwright` und keinen `postinstall` mehr

## Commit-Body

```
Nx indexes its local cache in a database named after the machine id, so a
restored cache directory is unknown to the next runner. CI now starts
scripts/ci/nxCacheServer.mjs, a self-hosted remote cache after Nx's OpenAPI
spec, over a directory that actions/cache restores and saves per commit.

- declare what Vitest and the library's consumers really read: the runtime
  packages of the specs, the root manifest makePackageJson reads, and the
  library's build output instead of its sources
- the package checks no longer rebuild the library; their Nx dependency on
  build stays
- drop makeBanner, a .npmignore that never reached dist/, and override keys
  and clean paths that name nothing
- browsers come from an explicit playwright install, cached by version; no
  postinstall downloads them, the publish job included; the testing package
  drops @playwright/test and its own copy of playwright, and pnpm install
  re-resolved the optional @emnapi peers of the astro lint packages
- every action is pinned to a commit; ci.yml reads contents only, keeps one
  run per commit on main and cancels superseded branch runs
- deploy asks npm first and skips install and build for a version npm
  already has; id-token: write is limited to the publish job, runs never
  overlap, and always-auth is gone
- the README states the pnpm floor the way AGENTS.md does, with engines as
  its source
```

## Nebenbefund aus Zug 0

`.github/workflows/deploy.yml:19` — Bei `workflow_run` checkt `actions/checkout` ohne
`ref` den aktuellen Kopf von `main` aus (`GITHUB_SHA` ist dort der letzte Commit des
Default-Branches), nicht `github.event.workflow_run.head_sha`. Landet zwischen dem Ende
eines CI-Laufs und dem Deploy ein weiterer Push, veröffentlicht der Job einen Stand,
dessen eigene CI noch läuft oder rot ist. Vorbestehend: in `HEAD` = `da095c73` so
enthalten. Urteil `→ Scope`: Die Scope-Regel greift, sie nennt die Publish-Pipeline.
Severity geschätzt low: Es braucht zwei Pushes innerhalb einer CI-Laufzeit, und der
zweite muss die Version heben. Nicht in dieses Paket: Die Ursache ist die Wahl des Refs,
nicht Frühausstieg, Pinning oder Cache. Der neue `version`-Job liest bewusst denselben
Ref wie `deploy`, damit beide dieselbe Version sehen; der Fix muss beide Checkouts
gemeinsam umstellen.

## Findings im Volltext

**Cache-Auftrag · Nutzer, Vorrang** — CI bewahrt den Nx-Cache nicht zwischen Läufen auf;
jeder CI-Lauf zeigt `Cache: 0/2 hit` beim Build, Deploy baut danach ein zweites Mal
(0/2). Nx-Cache per `actions/cache` sichern, Key aus Lockfile + Commit-SHA, Restore-Keys
auf den letzten Stand; Playwright-Browser auf ihre Version gekeyt ebenfalls cachen; keine
Nx Cloud. Input-Definitionen in `nx.json`/`project.json` auf fehlende und zu breite
Inputs prüfen (Entscheidungen im Plan, 2026-09-21).

**CFG-019 · low · packages/twopoint5d/package.json:53-56; nx.json:27-33; docs/architecture.md:73; scripts/makeBanner.mjs; packages/twopoint5d/.npmignore:14-16; package.override.json** — Das Gate baut die Bibliothek viermal, und die Pipeline trägt totes Material.
Nx baut vor jedem Check bereits (`dependsOn: ["build"]`); die Scripts rufen dann noch
einmal `pnpm run build &&`, ungecacht, sodass `pnpm run ci` die Bibliothek 4× compiliert
und `publishNpmPkg` 3× mehr. `scripts/makeBanner.mjs` wird von nichts aufgerufen (nur
nx.json:65 und ein Satz in der Doku verweisen darauf), `.npmignore` (jest-/rollup-Einträge)
wird nie nach `dist/` kopiert, wo veröffentlicht wird, `package.override.json` nullt
Schlüssel (`rollup`, `jest`, `prettier`, `nx`), die nicht existieren, und `clean` entfernt
`build types` aus einer früheren Pipeline.
Empfehlung: Das innere `pnpm run build &&` streichen (die Nx-Abhängigkeit bleibt);
`makeBanner*` samt nx-Input und Doku-Satz löschen oder einbinden; `.npmignore` löschen,
die Override-Datei und `clean` kürzen. — Nutzerentscheidung: `makeBanner*` wird gelöscht.

**CFG-018 · low · packages/twopoint5d-testing/package.json:13-18; .github/workflows/ci.yml:24-28; .github/workflows/deploy.yml:33-34** — Nicht bei jedem pnpm install zwei Browser laden, auch nicht im Publish-Job.
Der `postinstall`-Hook `playwright install chromium firefox` zieht bei jedem Install im
Workspace (Contributor-Onboarding, der Deploy-Job, der nur `tsc` + `npm publish` braucht)
rund 300 MB Browser; CI installiert sie danach ein zweites Mal mit `--with-deps`. Lokal
läuft der Hook ohne die OS-Abhängigkeiten, die `--with-deps` mitbringt, und kann einen
Browser hinterlassen, der nicht startet. `@playwright/test` ist eine Dependency, die kein
Test importiert — die Suite läuft auf `@web/test-runner` + mocha/chai.
Empfehlung: Den `postinstall` streichen; den expliziten `playwright install
--with-deps`-Schritt in ci.yml behalten und `pnpm exec playwright install chromium
firefox` in AGENTS.md dokumentieren; `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` in deploy.yml;
`@playwright/test` und die doppelte `playwright`-devDependency entfernen (die Root hat sie
bereits).

**SEC-003 · medium · .github/workflows/deploy.yml:9-11, 19-25, 36; .github/workflows/ci.yml:13-19, 35; scripts/publishNpmPkg.mjs:18-19** — Die Actions des Publish-Workflows auf Commit-SHAs pinnen und keine Token-Präfixe mehr loggen.
Der Job, der ein OIDC-Token mintet und `@spearwolf/twopoint5d` veröffentlicht, führt drei
Drittanbieter-Actions aus, die über bewegliche Tags (`@v4`) aufgelöst werden. Ein
verschobener Tag (das tj-actions-Muster) führt fremden Code mit Publish-Rechten aus. Das
Token-Echo (`NPM_TOKEN.substring(0, 6)`) ist unter OIDC gegenstandslos (beide Variablen
unset), druckt aber sechs Zeichen eines Secrets, sobald jemand auf ein Token zurückfällt;
GitHub maskiert nur das vollständige Secret, nicht Teilstrings.
Empfehlung: Alle `uses:` auf volle SHAs mit `# vX.Y.Z`-Kommentar pinnen (Dependabot mit
`github-actions`-Ökosystem hält sie aktuell); die zwei Token-Zeilen löschen. Optional
`permissions: contents: read` in ci.yml und eine `concurrency`-Gruppe.

**Offene Frage »OIDC Trusted Publisher« · .github/workflows/deploy.yml** — Ist der Trusted
Publisher auf npmjs.com für deploy.yml dieses Repos konfiguriert, und ist der Job seit dem
Wechsel grün gelaufen? Nichts im Repo kann das zeigen; `always-auth: true` in
deploy.yml:28 ist auf npm ≥9 ein No-op und kann weg. — Geklärt (Plan, »Entscheidungen«):
0.21.2 trägt `_npmUser: GitHub Actions <npm-oidc-no-reply@github.com>` und
SLSA-Provenance; `always-auth` und Token-Echo fallen weg; das Ergebnis gehört in
`docs/architecture.md`; Deploy steigt früh aus, wenn die Version schon veröffentlicht ist.

**CONS-052 · info · README.md:75; AGENTS.md:28; docs/architecture.md:109** — Die pnpm-Untergrenze steht in drei Schreibweisen.
`README.md:75` sagt »v10.22 or newer«, `AGENTS.md:28` und `docs/architecture.md:109`
sagen `>=10.22.0`. Dieselbe Zahl, drei Formulierungen — und keine davon nennt die Quelle,
aus der sie stammt.
Empfehlung: Eine Schreibweise wählen und die drei Stellen darauf ziehen. —
Nutzerentscheidung: `>=10.22.0` mit Verweis auf `package.json#engines.pnpm`.
