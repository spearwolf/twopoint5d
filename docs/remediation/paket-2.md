# Paket 2 — Dependencies: Audit-Gate, Update-Bot, Lookbook entrümpeln, .astro unter ESLint

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: DEPS-005 (medium), DEPS-008 (low), CONS-030 (low)
- Ziel: Verwundbare und tote Dependencies werden sichtbar oder verschwinden, Updates kommen per Bot, und der Lint-Gate deckt auch die Lookbook-Komponenten ab.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `apps/lookbook/package.json` (`sass`, `caniuse-lite` raus; `pnpm update` hebt `astro`, `marked`)
  - `apps/lookbook/public/js/rainbow-line-v0.2.1.js`, `apps/lookbook/public/js/rainbow-line-v0.4.0.js` (löschen, das Verzeichnis `public/js/` verschwindet damit)
  - `apps/lookbook/src/components/icons/HomeIcon.astro`, `CodeIcon.astro`, `InfoIcon.astro` (löschen)
  - `apps/lookbook/src/images/iconoir/undo.svg`, `code.svg`, `info-circle.svg`, `home.svg`, `web-window-xmark-solid.svg` (löschen)
  - `apps/lookbook/src/layouts/Layout.astro:25`
  - `.prettierignore:27-29`
  - `eslint.config.mjs:10`, `:24`, `:30`
  - `package.json` (Root; `pnpm update` hebt die Specifier)
  - `pnpm-workspace.yaml` (neuer Block `overrides:`)
  - `pnpm-lock.yaml` (frisch aufgelöst)
  - `.github/dependabot.yml` (neu)
  - `.github/workflows/ci.yml` (neuer Schritt nach `Install dependencies`, Zeile 34-35)
  - `packages/twopoint5d/package.json:55` (`lintPkg`)
  - `docs/architecture.md` (§3 Zeilen 63-65 und 74, Abschnitt »In CI«, §5)
- Vorgehen:
  1. **Lookbook entrümpeln (DEPS-008).** Löschen: die zwei Dateien unter
     `apps/lookbook/public/js/`, die drei Icon-Komponenten `HomeIcon.astro`,
     `CodeIcon.astro`, `InfoIcon.astro` unter `apps/lookbook/src/components/icons/`
     und die fünf SVGs `undo.svg`, `code.svg`, `info-circle.svg`, `home.svg`,
     `web-window-xmark-solid.svg` unter `apps/lookbook/src/images/iconoir/`.
     Die übrigen Icons (`SearchIcon`, `CloseDialogIcon`, `GitHubInvertocatIcon`)
     und die SVGs `search.svg`, `xmark.svg`, `xmark-circle-solid.svg` haben
     Importer und bleiben. In `apps/lookbook/src/layouts/Layout.astro:25`
     `<style lang="scss" is:global>` zu `<style is:global>` ändern — der Block
     enthält nur CSS-Custom-Properties und schlichte Regeln, kein SCSS. In
     `apps/lookbook/package.json` `"sass"` aus `dependencies` und
     `"caniuse-lite"` aus `devDependencies` streichen (von Hand, kein
     `pnpm remove`, weil Schritt 3 den Lockfile ohnehin neu auflöst).
     `.prettierignore:27-29` (Kommentar `# vendored build output, …`, Zeile
     `apps/lookbook/public/js` und die folgende Leerzeile) entfernen. In
     `eslint.config.mjs:10` den Eintrag `'**/lookbook/public'` aus `ignores`
     streichen — nach dem Löschen liegt unter `public/` keine Datei mehr, die
     ESLint öffnen würde (nur `.json`, `.png`, `.jpg`, `.webp`, `.svg`).
  2. **`.astro` unter die Regeln stellen (CONS-030).** In `eslint.config.mjs`
     den Block mit `no-console` (Zeile 24) von `files: ['**/*.{js,ts}']` auf
     `files: ['**/*.{js,ts,astro}']` und den `.ts`-Regelblock (Zeile 30) von
     `files: ['**/*.ts']` auf `files: ['**/*.{ts,astro}']` weiten. Sonst nichts
     an der Datei; `eslint-plugin-astro` samt `...astro.configs['flat/recommended']`
     ist schon da. Erwartung: `pnpm lint` bleibt ohne einen Befund, ein
     `--fix` ist nicht nötig (Zug 0 hat es gemessen, siehe Abgleich).
  3. **Dependencies heben und den Baum bereinigen (DEPS-005).** Der Reihe nach,
     vom Repo-Root:
     1. `pnpm update -r` — hebt alles innerhalb der Ranges und schreibt die
        neuen Untergrenzen in die `package.json`-Dateien. Stand 2026-09-21
        werden es im Root `@types/node ^26.6.2`, `@vitest/coverage-v8 ^5.0.1`,
        `eslint ^10.11.0`, `playwright ^1.63.0`, `prettier ^3.9.8`,
        `typescript-eslint ^8.70.0`, `vitest ^5.0.1`, `yaml ^2.9.1`, in der
        Lookbook `astro ^7.3.3`, `marked ^18.0.13`; neuere Patch-Stände sind
        in Ordnung. `nx` (exakt `23.2.0`), `typescript` (`^5.9.3`) und der
        `catalog:` bleiben, wie sie sind.
     2. `git checkout -- pnpm-workspace.yaml` — `pnpm update` sortiert die
        Datei um (schiebt `ignore-workspace-root-check` hinter den Katalog)
        und ändert inhaltlich nichts.
     3. In `pnpm-workspace.yaml` ans Ende, nach `onlyBuiltDependencies`, eine
        Leerzeile und dieser Block:

        ```yaml
        overrides:
          # nx 23.2.x pins smol-toml 1.6.1, which GHSA-7w5x-hrqm-74c2 covers. Drop this entry
          # once the nx in package.json depends on smol-toml >=1.7.1 itself.
          'nx>smol-toml': ^1.7.1
        ```

        Das ist der einzige Override. `koa`, `ws`, `qs`, `rollup` unter
        `@web/*`, `flatted`, `brace-expansion`, `picomatch`,
        `mdast-util-to-hast`, `@humanfs/node` heilt `pnpm update` allein.
     4. `rm pnpm-lock.yaml && pnpm install` — frische Auflösung. Grund:
        `happy-dom@20.7.0` und `jsdom@20.0.3` hängen als aufgelöste optionale
        Peers an `vitest`, obwohl sie seit 5da6fa6b niemand mehr deklariert und
        die Vitest-Suite in der Node-Umgebung läuft; weder `pnpm update`,
        `pnpm dedupe` noch `pnpm install --fix-lockfile` löst sie, nur eine
        frische Auflösung. Dasselbe gilt für `sass` als optionaler Peer von
        `vite` nach Schritt 1. Die frische Auflösung entfernt außerdem die
        Peer-Warnung zu `@emnapi/core`/`@emnapi/runtime` unter
        `eslint-plugin-astro`, die `pnpm update` sonst ausgibt.
     5. `pnpm exec playwright install chromium firefox` — Playwright steigt
        auf 1.63, die Browser-Suite braucht die passenden Browser.
     6. Prüfen: `pnpm audit --audit-level=high` endet mit `No known
        vulnerabilities found` und Exit 0;
        `grep -cE '^  (sass|caniuse-lite|happy-dom|jsdom)@' pnpm-lock.yaml`
        ergibt `0`; `grep -cE '^  playwright@' pnpm-lock.yaml` ergibt `1`
        (die Cache-Regel in `docs/architecture.md` verlangt, dass Root und
        `@web/test-runner-playwright` dieselbe Version auflösen);
        `pnpm install --frozen-lockfile` läuft durch. Meldet `pnpm audit` ein
        Advisory, das in der Liste unter »Abgleich« fehlt (nach dem
        2026-09-21 veröffentlicht), gilt die Entscheidung im Plan: erst
        `pnpm update`, ein Override nur für das, was danach rot bleibt, mit
        Kommentar wie oben.
  4. **Audit-Schritt in CI.** In `.github/workflows/ci.yml` direkt nach dem
     Schritt `Install dependencies` (Zeile 34-35) und vor
     `Read the Playwright version` einfügen:

     ```yaml
           - name: Audit dependencies
             # reports high and critical advisories without failing the run: the published
             # package declares peer dependencies only (lintPkg holds that), so whatever this
             # finds sits in tooling, and Dependabot proposes the update that fixes it
             run: pnpm audit --audit-level=high
             continue-on-error: true
     ```

     Keine weitere Änderung am Workflow; Pins, Step-IDs, Cache-Keys und
     `concurrency` aus Paket 1 bleiben unberührt.
  5. **Dependabot.** Neue Datei `.github/dependabot.yml`, genau so:

     ```yaml
     version: 2
     updates:
       # the four catalog entries in pnpm-workspace.yaml are the peer dependencies of the
       # library; each of their updates comes as a pull request of its own
       - package-ecosystem: npm
         directory: /
         schedule:
           interval: weekly
         groups:
           toolchain:
             patterns: ['*']
             exclude-patterns:
               - three
               - '@types/three'
               - '@spearwolf/eventize'
               - '@spearwolf/signalize'
             update-types: [minor, patch]
       # keeps the commit SHAs the workflows pin, and the version comment next to each, current
       - package-ecosystem: github-actions
         directory: /
         schedule:
           interval: weekly
         groups:
           actions:
             patterns: ['*']
     ```

     Begründung der Gruppen: Dependabot unterstützt pnpm-Kataloge (GA seit
     2025-02-04), ordnet Katalog-Einträge aber pauschal als `production` ein,
     deshalb wird nach `update-types` gruppiert, nicht nach
     `dependency-type`. Ein Sprung von `three` verschiebt den Peer-Range der
     Bibliothek und braucht ein eigenes Review, deshalb stehen die vier
     Katalog-Einträge außerhalb der Gruppe. Majors kommen einzeln.
  6. **Invariante »dist hat keine Runtime-Dependencies« (DEPS-005, Teil 3).**
     In `packages/twopoint5d/package.json:55` wird `lintPkg` zu (JSON-Wert
     exakt so, in Zug 0 positiv und negativ erprobt):

     ```json
     "lintPkg": "pnpm exec publint dist && node -e \"const m = require('./dist/package.json'); if (Object.keys({...m.dependencies, ...m.optionalDependencies}).length > 0) { console.error('dist/package.json declares runtime dependencies; the library ships with peer dependencies only'); process.exit(1); }\"",
     ```

     `lintPkg` hat kein `cache: true` in `nx.json`, an den Nx-Inputs ändert
     sich nichts. `publishNpmPkg` ruft `lintPkg` auf, die Prüfung greift also
     auch vor jedem Publish. Negativprobe für den Report: nach
     `pnpm build:twopoint5d` in `packages/twopoint5d/dist/package.json` von
     Hand `"dependencies": {"left-pad": "^1.3.0"}` einsetzen,
     `pnpm nx run twopoint5d:lintPkg` muss mit Exit 1 und der Meldung enden;
     danach `pnpm build:twopoint5d` erneut (dist ist generiert und
     ungetrackt).
  7. **Doku** in `docs/architecture.md`, englisch, ohne Rückblick auf den
     Vorzustand:
     - §3, Bullet `lint` (Zeilen 63-65): `no-console` gilt in `.ts`, `.js`
       und `.astro`; die `.ts`-Regeln (`consistent-type-imports`, das Verbot
       eines `.ts`-Import-Suffixes) gelten für `.astro`-Dateien ebenso — für
       das Frontmatter direkt, für jeden `<script>`-Block, weil
       `eslint-plugin-astro` ihn als virtuelle `.ts`-Datei an ESLint reicht.
     - §3, Bullet `lintPkg` (Zeile 74): publint gegen `dist/`, und der Lauf
       scheitert, sobald `dist/package.json` `dependencies` oder
       `optionalDependencies` deklariert — die Bibliothek erreicht ihre
       Konsumenten nur mit Peers, und darauf stützt sich, dass der
       Audit-Schritt in CI nicht blockiert.
     - Abschnitt »In CI«: der Schritt `Audit dependencies` nach dem Install,
       `pnpm audit --audit-level=high`, nicht blockierend, mit demselben
       Grund; Dependabot hält die SHA-Pins der Actions wöchentlich aktuell.
     - §5: ein Absatz zu Dependabot (wöchentlich, `npm` und `github-actions`,
       Minor/Patch der Toolchain in einer Gruppe, die vier Katalog-Einträge
       und Majors einzeln) und zu Overrides: sie stehen in
       `pnpm-workspace.yaml`, jeder mit einem Kommentar, der das Advisory
       nennt und sagt, wann der Eintrag wegfallen kann.
     AGENTS.md und README bleiben unverändert. Kein CHANGELOG-Eintrag: nichts
     davon ändert das veröffentlichte Paket (`dist/package.json` trägt
     dieselben Peers aus demselben Katalog).
  8. **Ausdrücklich nicht:** der Mischstil `./constants.js` neben
     extensionlosen Importen in `Card.astro:44-46` und
     `TagCloudFilter.astro:106-108` bleibt. Die Lookbook löst über
     `moduleResolution: Bundler` auf, beide Formen sind dort gültig, auch ihre
     `.ts`-Dateien mischen (4 mit `.js`, 10 ohne), und keine Regel erzwänge
     eine Angleichung — sie liefe beim nächsten Import wieder auseinander. Der
     eigentliche Regelverstoß des Findings, der `.ts`-Suffix, ist weg und wird
     ab Schritt 2 auch im Frontmatter abgewiesen. Ebenfalls nicht: die
     Ignore-Einträge `build` in `.gitignore:4`, `.prettierignore:9` und `:11`
     — das ist ein eigener Befund in »Offene Befunde« mit eigener Ursache.
- Verify (vom Repo-Root, Browser-Suite lokal ohne `xvfb-run`):

  ```bash
  pnpm install --frozen-lockfile \
    && pnpm audit --audit-level=high \
    && go run github.com/rhysd/actionlint/cmd/actionlint@v1.7.7 .github/workflows/ci.yml .github/workflows/deploy.yml \
    && curl -sSfL -o /tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad/dependabot-2.0.json https://www.schemastore.org/dependabot-2.0.json \
    && pnpm dlx ajv-cli@5 validate --spec=draft7 --strict=false -s /tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad/dependabot-2.0.json -d .github/dependabot.yml \
    && pnpm run ci
  ```

  `actionlint` ist nicht installiert, `go` (1.27) schon; `go run` baut es
  beim ersten Aufruf. `json.schemastore.org` antwortet mit einem Redirect,
  deshalb die Adresse `www.schemastore.org` und `curl -L`. Beide Prüfer hat
  Zug 0 gegen die heutigen Dateien bzw. einen Entwurf laufen lassen: grün,
  und eine absichtlich kaputte `dependabot.yml` (`interval: fortnightly`)
  fällt mit Exit 1 durch.
- Erst nach dem Push belegbar (der Lauf pusht nicht): Dependabot öffnet seine
  ersten PRs gruppiert wie geplant; der Schritt `Audit dependencies` läuft im
  Runner und ist grün; der erste CI-Lauf trifft wegen des neuen
  Lockfile-Hashes den primären Nx-Cache-Key nicht und fällt auf
  `nx-<os>-` zurück.
- Für `Schnittstellen:` nach dem Commit (B trägt ein): `ci.yml` Schritt
  `Audit dependencies` nach `Install dependencies`, `continue-on-error: true`
  · `pnpm-workspace.yaml` hat einen Block `overrides:` (Eintrag
  `'nx>smol-toml': ^1.7.1`, kommentiert) · `lintPkg` der Bibliothek prüft
  zusätzlich, dass `dist/package.json` keine `dependencies`/
  `optionalDependencies` trägt · `.github/dependabot.yml` mit Gruppen
  `toolchain` (npm, Minor/Patch, ohne die vier Katalog-Einträge) und
  `actions` · Dependency-Stand für Paket 3: `vitest`/`@vitest/coverage-v8`
  5.0.1, Playwright 1.63.
- Commit: `chore(deps): update the toolchain within its ranges, report dependency advisories in CI, let Dependabot propose updates, drop dead weight from the lookbook and hold astro frontmatter to the TypeScript lint rules`
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · DEPS-005 unverändert (`pnpm audit`: 21 Advisories, 12 high / 7 moderate / 2 low, wie im Audit; kein `dependabot.yml`, kein Audit-Schritt in `ci.yml`) · DEPS-008 unverändert (`public/js/` mit beiden Bundles, `sass`, `caniuse-lite`, drei Icons ohne Importer; `.prettierignore`-Eintrag nach `:27-29` gewandert), dazu zwei tote SVGs gleicher Ursache aufgenommen · CONS-030 umgeformt (e7a112b3 hat `eslint-plugin-astro` eingeführt, `<script>`-Blöcke tragen die `.ts`-Regeln; offen nur das Frontmatter) · Folge aus Paket 1 (Lockfile-Churn der `@emnapi`-Peers) → hier aufgegangen, Messbasis 42a88429 = HEAD · Offene Befunde: keiner mit gleicher Ursache, alle bleiben liegen · Restplan unverändert
  - 2026-09-21 Zug 1: Implementierer beauftragt (sonnet, effort medium), Brief `paket-2.impl-1.brief.txt`, Report nach `paket-2.impl-1.json`
  - 2026-09-21 Zug 2: Report FERTIG_MIT_VORBEHALT · 10 Dateien geändert, `.github/dependabot.yml` neu, 10 gelöscht · Arbeitsbaum schmutzig · eigener Verify `paket-2.verify-1.log` exit=1: alles grün bis `test:browser`, dort 13 Firefox-Tests (map2d-tile-upload, map2d-visibility-helpers, stage-pipeline, stage-renderer) Timeout, `GPUInternalError: Buffer … destroyed` — Firefox 155 aus Playwright 1.63 mit WebGPU; laut Implementierer Firefox 151/153 grün, Firefox 155 mit `dom.webgpu.enabled: false` grün · ohne Zug 3 in die Fehlerkette
  - 2026-09-21 Zug 4 Runde 1: offen 1 (Gate rot, Firefox 155/WebGPU) · Entscheidung Runner: Playwright auf `~1.62.1` halten, Dependabot schlägt `playwright` einzeln vor, Firefox-155-Befund → »Offene Befunde« · Resume des Implementierers (Session 4217d9ee, sonnet/medium), Brief `paket-2.impl-2.brief.txt`
    → zurück: FERTIG, `playwright ~1.62.1` ohne Override (Lockfile nur 1.62.1), `playwright` aus Dependabot-Gruppe `toolchain` ausgenommen, Satz in `docs/architecture.md` §5 · eigener Verify `paket-2.verify-2.log` exit=0 (Nx-Cache), Browser-Suite ohne Cache `paket-2.browser-nocache.log` exit=0 · offen 0
  - 2026-09-21 Zug 3: Reviewer (sonnet/medium) · DEPS-005, DEPS-008, CONS-030 behoben · 0 kritisch, 2 wichtig, 4 klein · Diff `paket-2.diff` (gegen HEAD, inkl. gestagter Löschungen), Report `paket-2.review-1.json`
  - 2026-09-21 Zug 4: keine weitere Runde — beide »wichtig« ohne Codeänderung erledigt (siehe Anmerkungen des Reviewers)
  - 2026-09-21 Zug 5: Commit f0a16ba3 auf Verify `paket-2.verify-2.log` exit=0 (Browser-Suite ohne Cache `paket-2.browser-nocache.log` exit=0), Message angepasst (Playwright-Tilde im Subject, Override und `lintPkg` im Body)

## Abgleich

**DEPS-005 — unverändert.** `.github/` enthält nur `instructions/` und
`workflows/`, kein `dependabot.yml`, kein `renovate.json`; `ci.yml` hat keinen
Audit-Schritt. `pnpm audit` am 2026-09-21 auf HEAD 42a88429: 21 Advisories
(12 high, 7 moderate, 2 low) — `mdast-util-to-hast`, `picomatch` (astro),
`qs`, `rollup`, `koa`, `ws` (`@web/*`), `flatted`, `@humanfs/node` (eslint),
`brace-expansion` (über `eslint-plugin-astro` → `@typescript-eslint/*` →
`minimatch`), `happy-dom`, `@tootallnate/once` (über `jsdom`, beide an
`vitest`), `smol-toml` (nx). `dist/package.json` hat keinen
`dependencies`-Block, nur `peerDependencies`.

Simulation in einer Kopie im Arbeitsverzeichnis von Zug 0 (Projekt
unberührt), mit genau den Schritten 1 und 3 oben:
- nach `pnpm update -r` allein: 3 high — `happy-dom` 20.7.0 (zwei
  Advisories, GHSA-w4gp-fjgq-3q4g, GHSA-6q6h-j7hj-3r64) und `smol-toml` 1.6.1
  (GHSA-7w5x-hrqm-74c2).
- `happy-dom`/`jsdom`: seit 5da6fa6b (2026-09-04) von niemandem deklariert,
  Vitest läuft ohne `environment` (Node), kein Spec setzt
  `@vitest-environment`. Sie bleiben als aufgelöste optionale Peers von
  `vitest` im Lockfile stehen; `pnpm dedupe` und `pnpm install --fix-lockfile`
  lassen sie drin, eine frische Auflösung nimmt sie samt Unterbaum heraus
  (Diff gegen den Update-Stand: +11/−413 Zeilen, nur Entfernungen und
  geänderte Peer-Suffixe).
- `smol-toml`: `nx` 23.2.0 **und** 23.2.1 deklarieren exakt `1.6.1`; ein
  nx-Bump hilft nicht, `pnpm update` auch nicht. Mit `'nx>smol-toml': ^1.7.1`
  löst es auf 1.8.0 (wie die übrigen Nutzer im Baum).
- Endstand nach dem vollen Ablauf (inkl. `sass`/`caniuse-lite` entfernt):
  `pnpm audit` und `pnpm audit --audit-level=high` beide »No known
  vulnerabilities found«, Exit 0; Lockfile-Diff gegen HEAD +952/−1458.
- Auf einer `git archive`-Kopie mit diesem Stand plus den Schritten 1, 2 und
  6: `pnpm install --frozen-lockfile`, `lint`, `build`, `typecheck`,
  `checkPkgTypes`, `checkNameableTypes`, `lintPkg`, `test:scripts`,
  `test:ci` alle Exit 0. `test:browser` nicht gefahren (Playwright-1.63-Browser
  nicht installiert) — das ist der eine offene Teil des Gates für B.

Abweichung von der Empfehlung des Audits: Overrides für `koa`/`ws` unter
`@web/*` braucht es nicht, `pnpm update` heilt sie. Der einzige Override ist
`smol-toml` unter `nx`; `happy-dom` bekommt keinen Override, weil es tot ist
und durch die frische Auflösung verschwindet — ein Override hielte ein
unbenutztes Paket am Leben.

**DEPS-008 — unverändert, Fundstelle `.prettierignore` gewandert.**
`apps/lookbook/public/js/rainbow-line-v0.2.1.js` und `rainbow-line-v0.4.0.js`
existieren; kein Treffer für `rainbow-line-v` oder `js/rainbow` in `src/`,
`docs/`, README, AGENTS. `apps/lookbook/package.json:26` `sass`, `:32`
`caniuse-lite`. `sass` hängt nur an `Layout.astro:25`
(`<style lang="scss" is:global>`), der Block (Zeilen 25-63) nutzt kein
SCSS-Feature. `caniuse-lite`: im Lockfile nur als eigene devDependency der
Lookbook, kein `browserslist` und kein anderer Abhängiger im Baum — es
unterdrückt also auch keine Warnung; entfernen statt annotieren. `HomeIcon`,
`CodeIcon`, `InfoIcon` ohne Importer in `src/`. Der prettier-ignore-Eintrag
steht jetzt in `.prettierignore:27-28` (samt Kommentar), nicht mehr 29-30.
Die SVGs `undo.svg`, `code.svg`, `info-circle.svg` haben nur die drei toten
Icons als Importer und fallen mit ihnen (Folge der eigenen Änderung).
Nebenbefund gleicher Ursache, aufgenommen: `home.svg` und
`web-window-xmark-solid.svg` im selben Verzeichnis haben keinen Importer
(seit 4effe768, 2024-05-11). Nach dem Löschen enthält `public/` keine Datei,
die ESLint öffnet; der Eintrag `'**/lookbook/public'` in
`eslint.config.mjs:10` wird damit gegenstandslos und fällt mit (Folge der
eigenen Änderung). In der Kopie erprobt: ohne `sass` und mit `lang="scss"`
bricht `astro build` ab (»Preprocessor dependency "sass-embedded" not
found«), mit `<style is:global>` baut es, und das CSS mit
`--color-background-dark` landet in `dist/_astro/*.css`.

**CONS-030 — umgeformt.** e7a112b3 (2026-09-20, nach dem Audit-Lauf vom
2026-09-19) hat `eslint-plugin-astro` in die Root-devDependencies und
`...astro.configs['flat/recommended']` in `eslint.config.mjs:17` gebracht und
die `.ts`-Suffixe entfernt (`Card.astro:46` importiert jetzt `./types`).
`eslint --print-config` zeigt: die virtuellen Dateien der `<script>`-Blöcke
(`Card.astro/0_0.ts`) tragen `no-console`, `consistent-type-imports` und
`no-restricted-syntax`; die `.astro`-Datei selbst — also das Frontmatter —
trägt keine der drei. Probe über stdin (`Probe.astro` mit `.ts`-Import,
typ-only-Import und `console.log` im Frontmatter): die aktuelle Config meldet
nur die zwei Verstöße im `<script>`-Block, mit den drei Regeln global gesetzt
kommen die drei im Frontmatter dazu. Dieselben drei Regeln über alle 35
`.astro`-Dateien: 0 Befunde. Die Weitung der Globs ist also der ganze Rest,
und `--fix` hat nichts zu tun. Die Kopie mit geweiteten Globs: `pnpm lint`
Exit 0.

## Triage

- **Folge aus Paket 1** (`pnpm-lock.yaml`, `@emnapi/core`/`@emnapi/runtime`
  an `eslint-plugin-astro`, `astro-eslint-parser`, `@astrojs/compiler-*`):
  kein Defekt, sondern die Messbasis für den Lockfile-Churn. Gemessen wird
  gegen 42a88429, das ist HEAD. `pnpm install --frozen-lockfile` auf HEAD
  läuft ohne Warnung; `pnpm update -r` gibt eine Missing-Peer-Warnung für
  `@napi-rs/wasm-runtime` aus, die frische Auflösung in Schritt 3.4 löst die
  Peers auch für `eslint-plugin-astro` auf und ist warnungsfrei. Aufgegangen
  in diesem Paket.
- **Offene Befunde:** `deploy.yml` ohne `ref`, `private` in
  `twopoint5d-testing`, README-Badge, README-Kommentar zu `cbt`, die
  `build`-Ignore-Einträge — keiner teilt eine Ursache mit Paket 2
  (Dependencies, tote Lookbook-Dateien, ESLint-Abdeckung). Die
  `build`-Einträge liegen zwar in `.prettierignore`, das dieses Paket
  anfasst, stammen aber aus einem alten Build-Layout, nicht aus vendored
  Lookbook-Code. Alle bleiben liegen, Urteile unverändert `→ Scope`.

## Restplan

Geprüft, keine Änderung. Paket 3 hängt weiter an 2 für den finalen
Dependency-Stand und bekommt ihn über `Schnittstellen:` (vitest 5.0.1,
Playwright 1.63); beide Pakete ändern `packages/twopoint5d/package.json`
(hier `lintPkg`, dort ein Coverage-Script) — nacheinander, ohne Konflikt.
Paket 4 berührt `scripts/makePackageJson*`; die neue `lintPkg`-Prüfung liest
nur das Ergebnis und kollidiert nicht mit CONS-050. Kein Finding ist
weggefallen, keine Folge verlangt ein neues Paket.

## Findings im Volltext

**DEPS-005 · medium · `.github/workflows/ci.yml:8-40; package.json:12-33; .github/` (kein dependabot.yml, kein renovate.json)** — Ein Dependency-Schwachstellen-Gate und einen Update-Bot einrichten; nicht zuerst zu pnpm.overrides greifen

Kein `pnpm audit` im Gate, kein Dependabot, kein Renovate. `pnpm audit`
meldet 21 Advisories (12 high, 7 moderate, 2 low), alle in
Dev-only-Transitivketten: brace-expansion (rimraf→glob→minimatch), flatted
(eslint), happy-dom (vitest), koa/ws/rollup/qs (@web/test-runner +
@web/dev-server), picomatch/mdast-util-to-hast (astro), smol-toml (nx).
Keine erreicht das veröffentlichte Paket: `dist/package.json` hat keinen
`dependencies`-Block, nur Peers. `pnpm outdated` zeigt daneben nur
Patch-/Minor-Drift (plus TypeScript 7, siehe DEPS-004). Der Vorlauf führte
die picomatch-Lücke einzeln (low) und die Handarbeit bei Updates als info
(DEPS-006); beides steckt hier drin.

Empfehlung: (1) `pnpm update` für den Drift, dann Overrides nur für das, was
rot bleibt (koa/ws unter `@web/*`), je mit Kommentar zum Advisory. (2) Ein
nicht-blockierender `pnpm audit --audit-level=high`-Schritt in ci.yml und
eine Dependabot-Config für `npm` + `github-actions`. (3) Die Invariante
»dist hat keine `dependencies`« explizit halten: eine Zeile in `lintPkg`.

**DEPS-008 · low · `apps/lookbook/public/js/rainbow-line-v0.2.1.js, rainbow-line-v0.4.0.js; apps/lookbook/package.json:18-33; apps/lookbook/src/layouts/Layout.astro:25-44; .prettierignore:29-30`** — Totes Gewicht aus der Lookbook nehmen: vendored rainbow-line-Bundles, caniuse-lite, sass, drei Icons

Nichts in `src/` referenziert `js/rainbow-line-*` (die Komponente kommt aus
dem Paket `@spearwolf/astro-rainbow-line`, das in drei Komponenten genutzt
wird); die zwei vendored Builds werden in jedem statischen Build
ausgeliefert und haben sogar einen eigenen prettier-ignore-Eintrag.
`caniuse-lite` wird nirgends importiert (vermutlich nur gegen browserslists
»old data«-Warnung — dann sollte ein Kommentar das sagen). `sass` hängt an
genau einem `<style lang="scss">`-Block, der kein SCSS-Feature nutzt.
`HomeIcon`, `CodeIcon`, `InfoIcon` haben keinen Importer. `lil-gui` und
`marked` sind echt genutzt.

Empfehlung: `public/js/`, den `.prettierignore`-Eintrag und die drei
Icon-Komponenten löschen; den Block auf `<style is:global>` ändern und
`sass` entfernen; `caniuse-lite` entfernen oder annotieren, warum es
gepinnt ist.

**CONS-030 · low · `eslint.config.mjs:11-13, 42-47; apps/lookbook/src/components/Card.astro:44-46`** — .astro-Dateien unter ESLint stellen; die Import-Regeln enden heute an der Dateiendung

`eslint .` öffnet nie eine `.astro`-Datei (kein astro-Parser, kein
`files`-Glob), `no-console`, `consistent-type-imports` und die repo-eigene
`no-restricted-syntax`-Regel gegen `.ts`-Import-Suffixe gelten für die 17
Seiten-Scripts also nicht — drei Import-Stile in drei aufeinanderfolgenden
Zeilen (`./constants.js`, `./LookBookApi`, `./types.ts`) sind das sichtbare
Symptom, und `.ts`-suffigierte Importe sind genau das, was die Regel
verbietet. `astro check` typprüft sie, erzwingt aber keinen Stil.

Empfehlung: `eslint-plugin-astro` (Flat Config,
`...eslintPluginAstro.configs.recommended`) ergänzen und den
`.ts`-Regelblock auf `**/*.{ts,astro}` weiten; einmal `--fix` laufen lassen.

## Anmerkungen des Reviewers

Urteil je Finding (Review 1, 2026-09-21):

- **DEPS-005 — behoben.** `.github/workflows/ci.yml:36-41` (Audit-Schritt,
  `continue-on-error: true`), `.github/dependabot.yml:1-27`,
  `pnpm-workspace.yaml:20-23` (Override, im Lockfile `smol-toml@1.8.0`),
  `packages/twopoint5d/package.json:55` (`lintPkg`-Invariante), Specifier in
  `package.json` und `apps/lookbook/package.json:23,25` gehoben; Lockfile ohne
  `sass|caniuse-lite|happy-dom|jsdom`, Playwright nur 1.62.1.
- **DEPS-008 — behoben.** `public/js/`, drei Icons, fünf SVGs gelöscht;
  `sass`/`caniuse-lite` raus; `Layout.astro:25` `<style is:global>`;
  `.prettierignore`- und `eslint.config.mjs:10`-Eintrag entfernt; kein
  Verweis mehr im Repo.
- **CONS-030 — behoben.** `eslint.config.mjs:24` `**/*.{js,ts,astro}`, `:30`
  `**/*.{ts,astro}`; Lint-Gate grün.

Wichtig, ohne Runde erledigt:

- Diese Paketdatei nannte in Vorgehen 3.1/3.5 und unter »Für
  `Schnittstellen:`« noch Playwright 1.63. Maßgeblich ist der Stand im Plan
  (`Schnittstellen:` unter Paket 2): Playwright `~1.62.1`. Vorgehen 3.1/3.5
  bleiben als Detailplan von Zug 0 stehen; die Abweichung trägt der Verlauf
  (Zug 4 Runde 1).
- Dependabot ohne `ignore` für Playwright 1.63: bewusst so gelassen.
  Dependabot öffnet für 1.63 einen Einzel-PR und hält ihn offen, statt jede
  Woche einen neuen zu öffnen. Dieser rote PR ist das Signal, dass der
  Firefox-155-Befund in »Offene Befunde« noch offen ist. Ein `ignore` würde
  genau das verstecken.

Klein (keine Runde):

- Commit-Subject »within its ranges« passte nicht zur engeren
  Playwright-Range, Override und `lintPkg` fehlten → Message beim Commit
  angepasst.
- `docs/architecture.md:172-178` (§5) nennt Firefox 155 und `~1.62.1` fest im
  Text, ohne Wegfallbedingung wie bei den Overrides. Wer den Pin löst, zieht
  den Satz mit.
- `packages/twopoint5d/package.json:55`: `node -e`-Einzeiler schwer lesbar,
  Form war im Plan vorgegeben.
- `ci.yml:36-41`: ein roter, nicht blockierender Schritt zeigt nur ein
  Warnsymbol; ob das auffällt, zeigt erst der Runner nach dem Push.
