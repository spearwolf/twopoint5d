# Paket 11 — Lookbook-Nachlese: rainbow-line 2, Metadaten und Demo-Reste

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — Drain aus der Befund-Queue (sieben Einträge, alle
  vorbestehend, alle `→ Scope`), dazu ein achter Eintrag gleicher Ursache aus Zug 0
- Ziel: Die Lookbook steht auf `@spearwolf/astro-rainbow-line` 2.x mit passendem
  vendortem Skript, und ihre Metadaten, Komponenten und Demo-Seiten tragen keine toten
  Regeln, irreführenden Kommentare oder Seiteneffekte mehr.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `apps/lookbook/package.json` (`:18`), `pnpm-lock.yaml` (von `pnpm install`
    geschrieben, nicht von Hand)
  - `apps/lookbook/public/js/rainbow-line-v0.4.0.js` (gelöscht),
    `apps/lookbook/public/js/rainbow-line-v0.6.0.js` (neu, Kopie aus dem Paket)
  - `AGENTS.md` (`:86`, `:88`)
  - `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts` (`:63`, `:66`)
  - `apps/lookbook/src/components/DemoNavBar.astro` (`:111–114`, `:141–155`)
  - `apps/lookbook/src/pages/demos/animated-billboards.astro` (`:80`),
    `apps/lookbook/src/pages/demos/animated-sprites.astro` (`:98`)
  - `apps/lookbook/src/pages/demos/textured-quads.astro` (`:35`, `:68`, `:83`, `:114`)
  - `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro` (`:35`, `:89`,
    `:91`)
  - nicht anfassen: `scripts/lookbook/rainbowLineScript.test.mjs` (liest den neuen Pfad
    ohne Änderung, siehe Abgleich), `.prettierignore`, `eslint.config.mjs`,
    `docs/architecture.md` (nennen keine Version), `packages/twopoint5d/CHANGELOG.md`
    (die Lookbook ist privat, nichts davon ist öffentliche API der Library)
- Vorgehen:
  0. **Rote Proben zuerst.** Vor jeder Änderung `pnpm nx build lookbook` und die fünf
     Proben unter »Proben« laufen lassen, Ausgabe in den Report. Dann die Rauchprobe
     (Schritt 9) einmal gegen den unveränderten Stand, als Baseline für `pageerror` und
     `console.error`.
  1. **rainbow-line 2.1.0.** In `apps/lookbook/package.json:18`
     `"@spearwolf/astro-rainbow-line": "^1.3.0"` → `"^2.1.0"`. Dann im Repo-Root
     `pnpm install` (ohne `--frozen-lockfile`), damit `pnpm-lock.yaml` die Auflösung
     `2.1.0` trägt; CI installiert mit `--frozen-lockfile` und bricht sonst ab. Der Peer
     `astro >=5` des Pakets ist mit `astro ^7.3.5` der Lookbook erfüllt. Danach
     `git diff pnpm-lock.yaml`: geändert sein dürfen nur der Importer `apps/lookbook`
     (specifier und version) und die Einträge `@spearwolf/astro-rainbow-line@…` unter
     `packages:` und `snapshots:` (bei 2.x mit dem Peer `astro`). Hebt `pnpm install`
     anderes mit, ist das eine Abweichung für den Report, kein stiller Beifang.
  2. **Das vendorte Skript tauschen.** `git rm apps/lookbook/public/js/rainbow-line-v0.4.0.js`,
     dann die Datei `rainbow-line-v0.6.0.js` aus dem installierten Paket byte-genau nach
     `apps/lookbook/public/js/rainbow-line-v0.6.0.js` kopieren. Das Paketverzeichnis liefert
     `node -e "console.log(require('path').dirname(require.resolve('@spearwolf/astro-rainbow-line/package.json')))"`,
     ausgeführt in `apps/lookbook/`. Nicht formatieren: `.prettierignore` und die
     ESLint-Ignores decken `apps/lookbook/public/js` schon ab. Danach `cmp` gegen die
     Paketkopie.
  3. **`AGENTS.md` nachziehen.** `:86` `apps/lookbook/public/js/rainbow-line-v0.4.0.js` →
     `rainbow-line-v0.6.0.js`, `:88` `<script src="${BASE_URL}/js/rainbow-line-v0.4.0.js">`
     → `…v0.6.0.js…`. Beide Ersetzungen halten die Zeilenlänge (gleiche Zeichenzahl),
     die Grenze in `AGENTS.md` ist 88. Der übrige Punkt `:86–95` stimmt für 2.x
     unverändert (das Paket liefert die Kopie und dient sie nicht aus; `RAINBOW_LINE_JS`
     bleibt der Schlüssel, den der Test liest) und bleibt stehen.
  4. **Versteckte Tags aus den verwandten Tags (`loadMetadataForDemos.ts:63`).** Die
     Zeile wird zu
     `json.tags.filter((t: string) => t !== tag && !hiddenTags.has(t)).forEach((t: string) => meta.relatedTags.add(t));`.
     Ein versteckter Tag hat in der Tag-Wolke kein Element (`TagCloudFilter.astro:15–23`
     schreibt nur die Schlüssel von `tags`), als verwandter Tag landete er in
     `data-related-tags` und über `LookBookApi.ts:41` im `localStorage`, ohne je ein
     Element zu treffen. Nur die verwandten Tags: `demo.tags` (Karten-Chips in
     `Card.astro:31–39`, Suche in `searchDemos.ts:14`) behalten die versteckten Tags —
     siehe Abgleich, kein Befund.
  5. **Sortieren als Kopie (`loadMetadataForDemos.ts:66`).**
     `tags: json.tags?.sort()` → `tags: json.tags ? [...json.tags].sort() : undefined`.
     Nicht `toSorted()`: die Root-tsconfig, von der die Lookbook erbt, hat
     `lib: ["ES2022", …]`, `toSorted` ist ES2023. Darüber ein Kommentar von einer Zeile, der
     das Warum sagt, sinngemäß `// a copy: json.tags is the array of the imported metadata
     module`. Die Reihenfolge der Tags auf den Karten bleibt dieselbe (Probe 2).
  6. **Tote Regeln in `DemoNavBar.astro`.** Aus dem `<style>`-Block (gescoped, also nur
     gegen das Markup dieser Komponente) diese vier Regeln samt der Leerzeile davor
     löschen: `.lookbook-demo-header img.primary` (`:111–114` — das Logo trägt `class="h-8"`,
     `:29` und `:49`), `.container` (`:141–145`), `.demo-navbar` (`:147–151`),
     `.demo-navbar img.primary` (`:153–155`). Keines dieser Elemente steht im Markup
     `:24–93`; `--color-demo-navbar-background` setzt niemand unter `apps/`. Alle
     übrigen Regeln (`.lookbook-demo-header`, `.rainbow-line-container`, `.demo-title`,
     `.show-source-dialog`, `::backdrop`, `.interactive-action:focus-visible`) bleiben.
     `LookbookHeader.astro:39` (`.lookbook-header img.primary`) ist lebendig
     (`:10` `class="primary"`) und bleibt unberührt.
  7. **Kommentar zu einer API, die es nicht gibt.** In `animated-billboards.astro:80` und
     `animated-sprites.astro:98` den Zeilenkommentar
     `// material.uniforms['time'].value = now;` hinter `material.time = now;` streichen;
     die Zuweisung bleibt. `AnimatedSpritesMaterial` hat kein `uniforms`, `time` ist ein
     Accessor auf einen TSL-Uniform (`AnimatedSpritesMaterial.ts:87–97`), dessen TSDoc das
     schon sagt. Kein Ersatzkommentar.
  8. **`async` ohne `await` und das doppelte Debug-Global.**
     - `textured-quads.astro:83` `async function createMaterial(texture: Texture)` →
       `function createMaterial(texture: Texture)`; dann trägt `createMesh` (`:35`) kein
       `await` mehr außer dem vor `createMaterial` (`:68`): dort `await` weg, `:35`
       `async function createMesh(` → `function createMesh(`, und `:114`
       `demo.scene.add(await createMesh(…))` → `demo.scene.add(createMesh(…))`.
     - `textured-quads-from-tileset.astro:35` `async function makeMesh(…)` →
       `function makeMesh(…)` (`createTexturedQuads` in
       `src/demos/instanced-quads/createTexturedQuads.ts:13` ist synchron), `:89`
       `demo.scene.add(await makeMesh(…))` → `demo.scene.add(makeMesh(…))`.
     - `textured-quads-from-tileset.astro:91` `Object.assign(globalThis, {demo});` samt der
       Leerzeile davor löschen. `demo` ist der `PerspectiveOrbitDemo`, und dessen
       Konstruktor setzt `window.display = this` (`PerspectiveOrbitDemo.ts:48`) — dasselbe
       Objekt unter zweitem Namen, nur auf dieser einen Seite. Die übrigen Debug-Globals der
       Lookbook (`window.display`, `map2d`, `tileRenderer`, `stageRenderer`, …) sind die
       Konvention der Demos für die Konsole und bleiben.
     - Die `async`-Callbacks von `demo.start(…)` in beiden Seiten behalten ihr `async`, sie
       warten auf `loadTextureCatalog()` und `store.getAsync()`.
  9. **Rauchprobe im Browser**, wie in Paket 7: nichts im Gate startet die Lookbook. Ein
     Wegwerf-Skript im Arbeitsverzeichnis des Laufs
     `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad`
     (nicht im Repo), das `playwright` aus dem Repo-Root auflöst
     (`createRequire('/Users/spw/spaceland/twopoint5d/package.json')('playwright')`,
     Chromium ist installiert), gegen `pnpm nx preview lookbook` (hängt selbst an `build`)
     unter `http://localhost:4321/lookbook/`; den Server danach beenden. Geprüft wird:
     - `/lookbook/` und jede Seite unter `/lookbook/demos/*/` (18) ohne `pageerror` und
       ohne `console.error` über die Baseline aus Schritt 0 hinaus;
     - auf `/lookbook/` und `/lookbook/demos/crosses/`: die Antwort auf
       `/lookbook/js/rainbow-line-v0.6.0.js` hat Status 200, und
       `customElements.get('rainbow-line')` ist nach dem Laden definiert;
     - auf `/lookbook/demos/textured-quads-from-tileset/`: `window.display` ist gesetzt,
       `'demo' in globalThis` ist `false`, und `window.display.scene.children.length` ist
       nach dem Start größer als 0 (das Mesh ist ohne `await` angekommen);
     - auf `/lookbook/demos/textured-quads/`: `window.display.scene.children.length > 0`.
     Ausgabe beider Läufe (Schritt 0 und nach den Änderungen) in den Report.
- Proben (vor den Änderungen rot, danach grün; jeweils nach `pnpm nx build lookbook`,
  im Repo-Root):
  1. Versteckte verwandte Tags —
     `grep -o 'data-related-tags="[^"]*"' apps/lookbook/dist/index.html | sed 's/^data-related-tags="//; s/"$//' | tr ',' '\n' | grep -c -x -E 'vanilla|react|demo'`
     — in Zug 0 gegen den Build von HEAD: 44 (jedes der 44 Wolken-Elemente trägt
     `vanilla` und/oder `demo`); danach 0. Dazu bleibt die Zahl der Wolken-Elemente
     `grep -o 'data-related-tags="' apps/lookbook/dist/index.html | wc -l` bei 44.
  2. Reihenfolge der Tags — `grep -o 'data-tag="[^"]*"' apps/lookbook/dist/index.html | shasum`
     vor und nach der Änderung gleich (Zug 0: 179 Treffer). Kein Rot-Grün, sondern der
     Beleg, dass die Kopie genauso sortiert.
  3. Ein Skript je Seite — `grep -o '<script[^>]*rainbow-line-v0[^>]*>' apps/lookbook/dist/demos/crosses/index.html`
     und dasselbe für `apps/lookbook/dist/index.html`: in Zug 0 je zwei Tags mit
     `rainbow-line-v0.4.0.js` (1.3.0 schreibt einen je `<RainbowLine>`), danach je einer
     mit `rainbow-line-v0.6.0.js`.
  4. Tote Regeln —
     `grep -rhoE '\.demo-navbar\[|\.container\[data-astro|\.lookbook-demo-header\[[^{},]*primary' apps/lookbook/dist | sort | uniq -c`
     — in Zug 0: 36 × `.demo-navbar[`, 18 × `.container[data-astro`, 18 ×
     `.lookbook-demo-header[…] img[…].primary` (in jeder der 18 Demo-Seiten inline);
     danach leer.
  5. Vendortes Skript — `pnpm test:scripts` (der Spec
     `scripts/lookbook/rainbowLineScript.test.mjs`): mit `^2.1.0` im Manifest und noch
     ohne neue Datei rot (»apps/lookbook/public/js/rainbow-line-v0.6.0.js is missing«),
     nach Schritt 2 grün. Diese rote Zwischenstufe (nach Schritt 1, vor Schritt 2) gehört
     in den Report.
- Verify: `pnpm run ci`, dazu die Proben 1–4 und die Rauchprobe aus Schritt 9
- Regressionstest: keiner als Datei. Die Lookbook hat keinen Test-Harness für ihre
  TS-Module (`loadMetadataForDemos.ts` lebt von `import.meta.glob` und läuft nur unter
  Vite); einen dafür aufzubauen wäre neue Test-Infrastruktur für zwei Befunde der
  Stufen low und info. Der rote Lauf ist Probe 1 gegen den gebauten Stand, wie in
  Paket 7 die Rauchprobe der Beleg war. Für das vendorte Skript hält der vorhandene Spec
  (Probe 5) jede künftige Abweichung.
- Commit: `fix(lookbook): move to @spearwolf/astro-rainbow-line 2 and serve the
  rainbow-line 0.6.0 script it loads, leave the hidden tags out of the related tags of the
  tag cloud, sort a copy of the tags of each demo so the imported metadata stays as it is,
  and drop the style rules of the demo navbar that match nothing in its markup, a comment
  on a uniforms API that AnimatedSpritesMaterial does not have, the async of mesh and
  material builders that await nothing and a second global for the display of the tileset
  demo` — eine Zeile; `fix`, nicht `chore(deps)`, weil der Bump der kleinere Teil ist
  und die Lookbook `fix(…lookbook)` schon trägt (`a45cac19`)
- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · alle sieben Queue-Einträge unverändert an ihren
    Zeilen (`package.json:18`, `loadMetadataForDemos.ts:63` und `:66`,
    `DemoNavBar.astro:111–155`, `animated-billboards.astro:80`/`animated-sprites.astro:98`,
    `textured-quads.astro:83`, `textured-quads-from-tileset.astro:91`), alle schon in
    c82f42f7 so · dazu aus Zug 0 `textured-quads-from-tileset.astro:35` (`makeMesh`,
    `async` ohne `await`, gleiche Ursache wie `:83`, vorbestehend c82f42f7 `:74`) ·
    rainbow-line 2.1.0 geprüft (Tarball: Skript `rainbow-line-v0.6.0.js`, Regex des Specs
    trifft) · Proben gegen den Build von HEAD: 44 / 179 / je 2 Skript-Tags / 36+18+18 ·
    offene Folgen: keine (alle unter erledigten Paketen schon verteilt)
  - 2026-09-30 Zug 1: Implementierer beauftragt (sonnet, effort low) · Report nach `paket-11.impl-0.json` (erster Start ohne `setsid` ins Leere, neu mit `nohup`)
  - 2026-09-30 Zug 2: FERTIG_MIT_VORBEHALT (Dateien nicht ganz gelesen) · 11 Pfade (package.json, pnpm-lock.yaml, rainbow-line-v0.4.0.js → v0.6.0.js, AGENTS.md, loadMetadataForDemos.ts, DemoNavBar.astro, 4 Demo-Seiten) · Probe 1 roh 52 statt 44 (zählt Vorkommen), danach 0 · Probe 5 rot 125/2, grün 127/0 · Arbeitsbaum schmutzig · eigener Verify `pnpm run ci` exit=0 (`paket-11.verify.log`), Proben 1–4 bestätigt
  - 2026-09-30 Zug 3: Reviewer (sonnet, low) — alle Schritte und alle acht Befunde erfüllt, nichts kritisch/wichtig, drei klein · Diff `paket-11.diff` (ohne vendortes Skript)
  - 2026-09-30 Zug 4: keine Runde
  - 2026-09-30 Zug 5: committet 5ae2a583 (erster Commit trug nur die Löschung, weil `git add` am gestagten Delete abbrach; per `--amend` vervollständigt, Baum = verifizierter Stand)

## Rahmen für den Implementierer

Reines Lookbook-Paket plus Lockfile und zwei Wörter in `AGENTS.md`. Keine Zeile unter
`packages/`, kein CHANGELOG. Konventionen aus dem Plan-Kopf gelten, insbesondere:
Kommentare erklären das Warum, keine Finding-IDs, kein Satz über den Vorzustand.
`pnpm lint` enthält `prettier --check .` mit `printWidth: 130` für Code; Markdown
(`AGENTS.md`) bricht bei 88.

Nicht mitnehmen: die übrigen `(window as any).…`-Globals der Demos, die Tag-Chips der
Karten, `LookbookHeader.astro`, den Spec `rainbowLineScript.test.mjs`.

## Abgleich

- **`apps/lookbook/package.json:18`** (low) — unverändert `^1.3.0`, installiert 1.3.0.
  Registry: 2.0.0 (2026-09-22) und 2.1.0 (2026-09-24), `latest` = 2.1.0. Laut CHANGELOG
  des Pakets: 2.0.0 macht `astro >=5` zum Peer (breaking nur für Astro 4), schreibt das
  `<script>` einmal je Seite und setzt den Pfad ohne `BASE_URL` auf `/`; 2.1.0 hebt das
  Web-Component auf 0.6.0, Standardpfad `js/rainbow-line-v0.6.0.js`, pausiert die
  Animation, solange die Linie unsichtbar ist. `RainbowLine.astro` 2.1.0 enthält
  `import.meta.env.RAINBOW_LINE_JS || 'js/rainbow-line-v0.6.0.js'` — der Regex in
  `rainbowLineScript.test.mjs:21` greift unverändert, der Spec prüft danach Existenz und
  Byte-Gleichheit gegen `rainbow-line-v0.6.0.js` im Paket. Die Props sind in 2.x dieselben;
  die Lookbook nutzt `shadow`, `colorSliceWidth`, `cycleDirection`
  (`DemoNavBar.astro:37`, `:62`, `LookbookHeader.astro:18`, `SearchLookbook.astro:21`).
  Versionsnamen im Repo nur in `AGENTS.md:86` und `:88`. `pnpm outdated` in der Lookbook
  nennt daneben nur `typescript` 7 und `three` 0.186, beide durch »Entscheidungen«
  zurückgehalten.
- **`loadMetadataForDemos.ts:63`** (low) — unverändert. Im Build von HEAD tragen alle 44
  Wolken-Elemente `vanilla` und/oder `demo` in `data-related-tags`
  (`tag-categories.json:2` versteckt `react`, `vanilla`, `demo`).
- **`loadMetadataForDemos.ts:66`** (info) — unverändert `json.tags?.sort()`. Beobachtbar
  wird es heute nicht (jede Datei läuft einmal durch, die Seiten importieren aus ihrer
  JSON nur `description` und `title`), aber es verändert das Array eines importierten
  Moduls.
- **`DemoNavBar.astro:111–155`** (info) — unverändert: `:111–114`, `:141–145`,
  `:147–151`, `:153–155`. Im Build von HEAD stehen die vier Regeln inline in allen 18
  Demo-Seiten.
- **`animated-billboards.astro:80`, `animated-sprites.astro:98`** (info) — unverändert.
- **`textured-quads.astro:83`** (info) — unverändert; `createMesh` `:35` wartet nur auf
  `createMaterial` (`:68`) und fällt deshalb mit.
- **`textured-quads-from-tileset.astro:91`** (info) — unverändert; `demo` ist dasselbe
  Objekt wie `window.display` aus `PerspectiveOrbitDemo.ts:48`.
- **Neu aus Zug 0, gleiche Ursache wie `textured-quads.astro:83`:**
  `textured-quads-from-tileset.astro:35` — `async function makeMesh` ohne `await`,
  `createTexturedQuads` ist synchron; vorbestehend (c82f42f7 `:74`, `await makeMesh`
  `:129`). info. Ins Paket, nicht in die Queue: dieselbe Ursache, dieselbe Art Seite,
  dieselbe Zeile Arbeit.
- **Geprüft, kein Befund:** Die Karten zeigen die versteckten Tags als Chips (im Build 18
  × `vanilla`, 1 × `demo`), und die Suche findet Demos über sie. `hiddenTags` steht in der
  Konfiguration der Tag-Wolke (`tag-categories.json`) und blendet dort aus; dass die
  Karten sie zeigen, ist keine erkennbare Verletzung einer Absicht. Bleibt stehen.

## Triage

- Offene Folgen unter erledigten Paketen: keine. Paket 1, 2, 3, 4, 6 und 10 haben ihre
  Folgen in früheren Zügen 0 verteilt, Paket 5, 7, 8 und 9 haben keine.
- »Offene Befunde«: die sieben Einträge mit »geht in Paket 11« sind dieses Paket. Die
  übrigen offenen Einträge teilen keine Ursache mit ihm (Library-Code und -Doku,
  Workflows, Cache-Server, Browser-Test-Kommentar → Paket 12; `coordsTarget` → Audit).

## Restplan

Paket 12 bleibt, wie es steht: kein Eintrag dieses Pakets berührt seine Dateien
(`packages/twopoint5d/`, `AGENTS.md:16`/`:107` — dieses Paket ändert nur `:86` und `:88`
ohne Verschiebung —, `docs/architecture.md`, `packages/twopoint5d-testing/`,
`.github/workflows/deploy.yml`, `scripts/ci/`). Reihenfolge und Schnitt unverändert.

## Review

Urteil je Befund (Reviewer, Zug 3), alle behoben:
- `apps/lookbook/package.json:18` — `^2.1.0`, Lockfile ohne Beifang, Skript v0.6.0 vendort
- `loadMetadataForDemos.ts:63` — versteckte Tags aus `relatedTags` gefiltert (Probe 1 → 0)
- `loadMetadataForDemos.ts:66` — sortiert eine Kopie, Kommentar mit Warum (Probe 2 gleich)
- `DemoNavBar.astro:111–155` — vier Regeln gelöscht (Probe 4 leer)
- `animated-billboards.astro:80`, `animated-sprites.astro:98` — Kommentar gestrichen
- `textured-quads.astro:83` samt `:35` — `async`/`await` weg
- `textured-quads-from-tileset.astro:35` — `async`/`await` weg
- `textured-quads-from-tileset.astro:91` — `Object.assign(globalThis, {demo})` gelöscht

Kleine Befunde:
- `textured-quads.astro` — Prettier setzt `createMesh` ohne `async` einzeilig; nötig für das Gate
- `loadMetadataForDemos.ts:63` — lange Zeile, passt in 130
- `loadMetadataForDemos.ts:66` — `tags: undefined` explizit, Verhalten wie vorher
- Probe 1 zählt Vorkommen, nicht Elemente: Baseline 52, nicht 44 wie in Zug 0 notiert
