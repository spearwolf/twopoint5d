# Paket 11 — Lookbook: CSS, das der Browser verwirft, und ein Bild, das niemand sieht

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine — 9 Nebenbefunde aus »Offene Befunde« des Plans, dazu zwei
  Fundstellen derselben Ursache, die der Abgleich in Zug 0 gefunden hat.
  Volltext unten.
- Ziel: Jede Deklaration im Lookbook wirkt, und was nicht wirkt, steht nicht
  mehr da.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `apps/lookbook/src/pages/demos/animated-billboards.astro`
  - `apps/lookbook/src/pages/demos/animated-sprites.astro`
  - `apps/lookbook/src/pages/demos/display-multi.astro`
  - `apps/lookbook/src/pages/demos/instanced-quads.astro`
  - `apps/lookbook/src/pages/demos/map2d-cam-visi.astro`
  - `apps/lookbook/src/pages/demos/map2d-rect-visi.astro`
  - `apps/lookbook/src/pages/demos/map2d-tile-sprites.astro`
  - `apps/lookbook/src/pages/demos/textured-quads.astro`
  - `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro`
  - `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro`
  - `apps/lookbook/src/pages/demos/textured-quads-po2image-loader.astro`
  - `apps/lookbook/src/pages/demos/textured-sprites.astro`
  - `apps/lookbook/src/pages/index.astro`
  - `apps/lookbook/src/components/TagCloudFilter.astro`
  - `package.json` (Repo-Root, nur die Zeile `engines.node`)
- Verify: `pnpm run ci`
- Commit: `fix(lookbook): make the discarded style rules take effect, and let the node range match the lint plugin`

## Was dieses Paket nicht ist

Ein Regressionstest gehört **nicht** dazu, und das ist keine Nachlässigkeit:
es gibt im Repository keine Testfläche für Lookbook-CSS. Die beiden Flächen
aus den Konventionen decken die Library ab (`*.spec.ts` neben der Quelle,
`*.test.js` in `packages/twopoint5d-testing/test/`), nicht die Astro-App. Der
Beleg dieses Pakets ist der grüne `pnpm run ci`: er baut den Lookbook
(`astro build`), typecheckt ihn (`astro check`) und fährt `eslint .` samt
`prettier --check .` darüber. Keinen Test erfinden, der nichts prüft.

Kein CHANGELOG-Eintrag. `packages/twopoint5d/CHANGELOG.md` ist das einzige
CHANGELOG im Repository und gehört der Library; dieses Paket bewegt keine
Zeile daran. Die `engines` der Root-`package.json` sind ebenfalls nicht
öffentlich — die Root ist `"private": true` und wird nie veröffentlicht.

## Vorgehen

### 1. Doppelte `body`-Regeln verschmelzen (10 Dateien)

In jeder dieser Dateien stehen zwei `body`-Regeln unmittelbar hintereinander
im selben `<style>`-Block, ohne eine Regel dazwischen. Sie werden zu **einem**
Block zusammengezogen, die Deklarationen behalten ihre Reihenfolge. Weil
zwischen den beiden Blöcken keine konkurrierende Deklaration steht, ändert die
Verschmelzung das Rendering nicht.

Fünf dieser Dateien tragen zusätzlich ein totes `background-color`
unmittelbar vor einem `background:`-Shorthand im selben Block; der Shorthand
setzt die Hintergrundfarbe auf `transparent` zurück und überschreibt es
restlos. Die tote Zeile fällt beim Verschmelzen mit weg — das ist in den
Zielblöcken unten schon eingearbeitet.

**`animated-billboards.astro`**, Zeilen 17–24 werden zu:

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background-color: rgb(17 28 38);
    color: #eee;
  }
```

**`instanced-quads.astro`**, Zeilen 13–20 werden zu (`background-color: #391e39`
fällt weg):

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background: radial-gradient(circle, rgba(189, 70, 98, 1) 0%, rgba(37, 4, 73, 1) 100%);
  }
```

**`map2d-cam-visi.astro`**, Zeilen 29–37 werden zu (`background-color` bleibt
hier stehen: die Folgezeile ist `background-image`, kein Shorthand, und
überschreibt die Farbe nicht):

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background-color: #458497;
    background-image: linear-gradient(to bottom, #001020 0, #001020 25%, #667686);
    color: #fff;
  }
```

**`map2d-rect-visi.astro`**, Zeilen 16–24 werden zu (`background-color` bleibt,
gleiche Begründung wie oben):

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background-color: #458497;
    background-image: linear-gradient(to right bottom, #458497 0, #2e4564 52%, #9b1a61);
    color: #eee;
  }
```

**`map2d-tile-sprites.astro`**, Zeilen 12–20 werden zu (identischer Inhalt wie
`map2d-rect-visi.astro`):

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background-color: #458497;
    background-image: linear-gradient(to right bottom, #458497 0, #2e4564 52%, #9b1a61);
    color: #eee;
  }
```

**`textured-quads.astro`**, Zeilen 15–23 werden zu (`background-color: #391e39`
fällt weg; die Leerzeile zwischen den beiden Blöcken verschwindet mit):

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background: radial-gradient(circle, rgb(195, 130, 74) 0%, rgb(95, 26, 26) 100%);
  }
```

**`textured-quads-from-texture-atlas.astro`**, Zeilen 15–21 werden zu
(`background-color` bleibt: kein Shorthand folgt):

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background-color: #3f313f;
  }
```

**`textured-quads-from-tileset.astro`**, Zeilen 17–24 werden zu
(`background-color: #391e39` fällt weg):

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background: radial-gradient(circle, rgba(109 80 87) 0%, rgba(21 2 41) 100%);
  }
```

**`textured-quads-po2image-loader.astro`**, Zeilen 15–22 werden zu
(`background-color: #391e39` fällt weg):

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background: radial-gradient(circle, rgba(93, 101, 116, 1) 0%, rgba(37, 50, 98, 1) 100%);
  }
```

**`textured-sprites.astro`**, Zeilen 17–28 werden zu
(`background-color: #391e39` fällt weg):

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background: radial-gradient(circle, rgb(175 82 82) 0%, rgb(90 148 191) 100%);
    color: #eee;
    font-family: sans-serif;
    font-size: 16px;
    line-height: 2;
  }
```

### 2. Totes `background-color` in `animated-sprites.astro`

Diese Datei hat nur **eine** `body`-Regel, aber dasselbe tote
`background-color`. Zeile 21 (`background-color: #391e39;`) ersatzlos
streichen; Zeile 22 mit dem `background:`-Shorthand bleibt unangetastet. Der
Block sieht danach so aus:

```css
  body {
    height: 100vh;
    overflow-y: hidden;
    background: radial-gradient(circle, rgb(118, 174, 141) 0%, rgb(13, 77, 75) 80%, rgb(3, 11, 28) 100%);
    color: #eee;
  }
```

### 3. `display-multi.astro` — die doppelte Hintergrundfarbe auflösen

Hier liegt der Fall anders als in den zehn Dateien oben: die Regeln stehen
nicht nebeneinander, und nicht jede Wiederholung ist überflüssig.

- `html, body { height: 100%; }` (Zeilen 133–136) **bleibt unverändert**. Sie
  nimmt `html` mit und ist kein Duplikat.
- `body { … background-color: #123; … }` (Zeilen 137–144) **bleibt
  unverändert**.
- `body, .gridContainer { background-color: #123; }` (Zeilen 155–158) fällt
  weg. Für `body` ist die Deklaration eine wortgleiche Wiederholung aus
  Zeile 140, für `.gridContainer` ist sie neu — sie wandert deshalb als letzte
  Deklaration in den bestehenden `.gridContainer`-Block (Zeilen 146–154), der
  danach so aussieht:

```css
  .gridContainer {
    display: grid;
    height: 100%;
    margin: 2px;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    grid-template-areas: '. . .' '. . .';
    gap: 1px;
    background-color: #123;
  }
```

`.gridContainer` trägt sonst keine Hintergrundangabe, es gibt also nichts, was
mit der zugezogenen Zeile konkurriert.

### 4. `display: inline-fl` → `display: inline-flex`

`inline-fl` ist kein gültiger Wert; der Browser verwirft die ganze
Deklaration, und `.actionBtn` bleibt ein Block-`div`. Zwei Stellen:

- `animated-sprites.astro:42` (im `.actionBtn`-Block)
- `textured-sprites.astro:43` (im `.actionBtn`-Block)

Beide auf `display: inline-flex;`. Die `.actionBtn`-Elemente sind an beiden
Stellen direkte Kinder eines Tailwind-`flex flex-wrap`-Containers; der Wechsel
ist deshalb nach außen folgenlos, weil ein Flex-Container seine Kinder
blockifiziert. Innen wird der Textknoten zu einem anonymen Flex-Item — das ist
genau die Wirkung, die die Deklaration von Anfang an haben sollte.

### 5. `index.astro` — die Hintergrundebene, die es nicht gibt

`.back-pattern` (Zeilen 39–47) hat genau ein `background-image`, beschreibt in
`background-repeat`, `background-size` und `background-position` aber je zwei
Ebenen. Die Zweitwerte laufen ins Leere. Nach dem Streichen der Zweitwerte
wären alle drei Deklarationen nur noch Initialwerte (`repeat`, `auto`,
`top left` entspricht `0% 0%`) und damit selbst wirkungslos — sie fallen
deshalb ganz weg. Der Zielblock:

```css
  .back-pattern {
    background-color: var(--color-background);
    background-image: var(--page-background-pattern);
  }
```

Das `<style define:vars={{'page-background-pattern': …}}>` in Zeile 38 bleibt
unangetastet.

### 6. `TagCloudFilter.astro` — der verschriebene Klassenname

`tag-catgeory-description` → `tag-category-description`, an **beiden** Stellen
im selben Schritt:

- Zeile 13: `<p class="tag-catgeory-description">{category.description}</p>`
- Zeile 98: der CSS-Selektor `.tag-catgeory-description {`

Der Name wirkt heute nur, weil er an beiden Stellen gleich falsch steht; wer
eine Stelle allein korrigiert, bricht das Styling. Es gibt genau diese zwei
Vorkommen im Repository — eine dritte Stelle existiert nicht.

### 7. `instanced-quads.astro` — ein Import-Stil statt zwei

Die Datei zieht aus `@spearwolf/twopoint5d` zweimal ein, in zwei Stilen — die
Zeilen 24 und 25, gleich am Anfang des `<script>`-Blocks:

```ts
  import type {VertexObjectPool} from '@spearwolf/twopoint5d';
  import {InstancedVertexObjectGeometry, vertexByInstancePosition, VertexObjects, type VO} from '@spearwolf/twopoint5d';
```

Beides wird zu einem Import mit inline markierten Typen — das ist der Stil,
den die Nachbardateien im Lookbook fahren (`stage-postprocessing.astro`,
`stage-nested-pipelines.astro`, `quadtree-playground.astro`: ein Import je
Quelle, Werte alphabetisch, die `type`-Einträge hinten). Einzeilig wäre die
Zeile 143 Zeichen lang und damit über der `printWidth: 130` aus `.prettierrc`;
`prettier --check .` läuft im Lint-Gate mit, also gleich mehrzeilig:

```ts
  import {
    InstancedVertexObjectGeometry,
    vertexByInstancePosition,
    VertexObjects,
    type VertexObjectPool,
    type VO,
  } from '@spearwolf/twopoint5d';
```

Die Verwendungen bleiben, wie sie sind: `VO` in den Interfaces `BaseQuad`
(Zeile 42) und `InstancedQuad` (Zeile 69), `VertexObjectPool` in der Signatur
bei Zeile 122.

### 8. `package.json` — die Node-Range gegen das Lint-Plugin stellen

`eslint-plugin-astro@3.2.1` verlangt `node: "^22.22.3 || ^24.16.0 || >=26.3.0"`,
die Root-`engines` sagen `">=24"`. Auf Node 24.0 bis 24.15 gibt das eine
Engine-Warnung bei jedem `pnpm install`.

Zeile 9 wird zu:

```json
    "node": "^24.16.0 || >=26.3.0",
```

Das ist die Schnittmenge aus dem, was dieses Projekt ohnehin verlangt
(`>=24`, deshalb fällt der `^22.22.3`-Zweig weg), und dem, was das Plugin
akzeptiert. Ein schlichtes `">=24.16.0"` wäre kürzer, ließe aber Node 25 und
26.0–26.2 durch, wo die Warnung weiterläuft — eine halbe Lösung zum selben
Preis. `engines.pnpm` bleibt unverändert; CI (`node-version: 24`) und die
lokale Umgebung liegen über der neuen Untergrenze, es bricht also nichts.

## Nebenbefunde im Volltext

Alle Einträge stammen aus dem Abschnitt »Offene Befunde« in
`./remediation-plan.md` und sind dort mit `→ Paket 11` verbucht. Severity in
Klammern, gemessen an der Scope-Regel des Laufs.

**1 · low · `animated-sprites.astro:42`, `textured-sprites.astro:43`** —
`display: inline-fl;` ist kein gültiger Wert, der Browser verwirft die
Deklaration, und `.actionBtn` bleibt ein Block-`div`. Gemeint war
`inline-flex`. Aus Paket 1, Zug 2.

**2 · info · zwei getrennte `body`-Regeln im selben `<style>`-Block**, in acht
Demos unter `apps/lookbook/src/pages/demos/`: `animated-billboards.astro:17,21`,
`instanced-quads.astro:13,17`, `map2d-cam-visi.astro:29,33`,
`textured-quads.astro:15,20`, `textured-quads-from-texture-atlas.astro:15,19`,
`textured-quads-from-tileset.astro:17,21`,
`textured-quads-po2image-loader.astro:15,19`, `textured-sprites.astro:17,21`.
Dazu `display-multi.astro:133,137,155` mit dreimal `body` plus `html, body` und
`body, .gridContainer`. Aus Paket 1, Zug 2.

**3 · info · totes `background-color`** unmittelbar vor einem
`background:`-Shorthand im selben `body`-Block, das der Shorthand
überschreibt, unter `apps/lookbook/src/pages/demos/`:
`animated-sprites.astro:21`, `instanced-quads.astro:18`,
`textured-quads.astro:21`, `textured-quads-from-tileset.astro:22`,
`textured-quads-po2image-loader.astro:20`, `textured-sprites.astro:22`.
Aus Paket 1, Zug 2.

**4 · info · `apps/lookbook/src/pages/index.astro:42-46`** — `.back-pattern`
beschreibt in `background-repeat`, `background-size` und
`background-position` je zwei Ebenen, es gibt aber nur ein `background-image`.
Die Zweitwerte laufen ins Leere. Aus Paket 1, Zug 2.

**5 · info · `apps/lookbook/src/components/TagCloudFilter.astro:14,98`** — der
Klassenname `tag-catgeory-description` ist verschrieben. Er steht an beiden
Stellen gleich und wirkt deshalb; falsch geschrieben bleibt er.
Aus Paket 1, Zug 2.

**6 · info · `apps/lookbook/src/pages/demos/instanced-quads.astro:23`** — die
Datei mischt zwei Import-Stile: `VertexObjectPool` im `import type`-Block, `VO`
als Inline-`type` im Value-Import. Der Lint akzeptiert beides.
Aus Paket 1, Zug 3.

**7 · info · `package.json:9`** — `eslint-plugin-astro` verlangt
`node ^22.22.3 || ^24.16.0 || >=26.3.0`, die Root-`engines` sagen `>=24`. Auf
Node 24.0–24.15 gibt das eine Engine-Warnung; ohne `engine-strict` bricht
nichts, CI und lokaler Rechner liegen darüber. Aus Paket 1, Zug 3.

**8 · info · `apps/lookbook/src/pages/demos/map2d-rect-visi.astro:16,20`** —
zwei getrennte `body`-Regeln im selben `<style>`-Block, dieselbe Ursache wie
Eintrag 2. Aus Paket 11, Zug 0.

**9 · info · `apps/lookbook/src/pages/demos/map2d-tile-sprites.astro:12,16`** —
zwei getrennte `body`-Regeln im selben `<style>`-Block, dieselbe Ursache wie
Eintrag 2. Aus Paket 11, Zug 0.

### Gegenstandslos

**`apps/lookbook/src/images/so-mi-gradient-back-gr.webp`** (info, aus Paket 1,
Zug 0) — der Befund beschrieb einen Import in `index.astro:8`, der das Bild an
eine `define:vars`-Variable reichte, die nur in auskommentierten CSS-Zeilen
vorkam; es landete im Build, ohne je dargestellt zu werden. Paket 1 hat diesen
Import entfernt: `index.astro` zieht heute in Zeile 6 nur noch
`ball-pattern-dark-blueish-4x-30deck-doubled.webp?url` ein, und `grep` über das
ganze Repository findet außerhalb von Plan und Paketdateien keinen Verweis mehr
auf `so-mi-gradient`. Damit landet das Bild nicht mehr im Build — der Befund
ist erledigt, kein Eingriff nötig.

Die Datei selbst bleibt liegen, und zwar mit Absicht: dass ein Design-Asset
ungenutzt in `src/images/` liegt, war nie der Befund, und sie ist dort nicht
allein (`so-mi-gradient-back-li.webp` wurde nie importiert). Astro packt aus
diesem Verzeichnis nur, was importiert wird, es kostet also weder Buildzeit
noch Bundle-Größe; ein Löschen entfernt sie auch nicht aus der Git-Historie.
Ein Asset-Verzeichnis für genau eine von mehreren ungenutzten Dateien
aufzuräumen, wäre willkürlich — und ob der Nutzer das Motiv noch braucht,
sagt der Code nicht.

## Verlauf

- 2026-09-20 Zug 0: Detailplan steht · alle acht Queue-Einträge an der
  Fundstelle geprüft · sieben unverändert, Zeilennummern um eins gewandert bei
  `TagCloudFilter.astro:13` (war 14), `instanced-quads.astro:24,25` (war 23) und
  `display-multi.astro:134,137,155` (war 133) · das Bild
  `so-mi-gradient-back-gr.webp` gegenstandslos, weil Paket 1 den Import aus
  `index.astro` entfernt hat; Datei bleibt liegen, Begründung oben · zwei
  Fundstellen derselben Ursache dazugenommen: `map2d-rect-visi.astro:16,20` und
  `map2d-tile-sprites.astro:12,16`, beide vorbestehend (aus `c3c8edb7`, vor dem
  ersten Paket-Commit `e7a112b3`) · Repo-weiter Scan nach weiteren doppelten
  `body`-Regeln und toten `background-color` brachte nichts darüber hinaus ·
  keine `Folgen:`-Zeile eines erledigten Pakets ist unverteilt · Restplan:
  Pakete 12 und 13 unverändert, keine Überschneidung der Dateien
- 2026-09-20 Zug 1: Implementierer beauftragt, mittlere Stufe, Effort low
- 2026-09-20 Zug 2: Report `FERTIG_MIT_VORBEHALT` (Vorbehalt betrifft nur die
  Vollständigkeit der Nebenbefund-Lektüre, nicht die Umsetzung) · 15 Dateien
  geändert, keine neue · Arbeitsbaum jetzt schmutzig · eigener `pnpm run ci`
  exit=0
- 2026-09-20 Zug 3: Reviewer, mittlere Stufe, Effort low · alle neun Einträge
  und alle acht Schritte behoben, je mit Fundstelle · kritisch: keine ·
  wichtig: keine · Diff:
  `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ecdab9e-7f9f-4c42-ae2e-2cfd00b2febc/scratchpad/paket-11.diff`
- 2026-09-20 Zug 4: entfällt, keine Runde ausgelöst
- 2026-09-20 Zug 5: committet als `19e183e2`, Verify aus Zug 2 (exit=0) trägt
  ihn, seither keine Codeänderung

## Urteil des Reviewers je Eintrag

Alle neun Einträge aus »Nebenbefunde im Volltext« sind behoben:

1. `inline-fl` → `inline-flex` in `animated-sprites.astro` und
   `textured-sprites.astro`; im Repo steht kein `inline-fl` mehr.
2. Zehn Demos tragen nur noch einen `body`-Block; in `display-multi.astro` ist
   `body, .gridContainer` weg und `background-color: #123` steht als letzte
   Deklaration in `.gridContainer`.
3. Das tote `background-color: #391e39` fehlt in den sechs Dateien, in denen ein
   `background:`-Shorthand folgt; die vier Dateien ohne Shorthand behalten die
   Farbe.
4. `index.astro`: `.back-pattern` trägt nur noch `background-color` und
   `background-image`.
5. `TagCloudFilter.astro`: Markup und Selektor gemeinsam auf
   `tag-category-description`; `catgeory` kommt im Repo nicht mehr vor.
6. `instanced-quads.astro`: ein mehrzeiliger Import, Werte alphabetisch,
   `type VertexObjectPool` und `type VO` hinten.
7. `package.json`: `"node": "^24.16.0 || >=26.3.0"`, `engines.pnpm` unverändert.
8. `map2d-rect-visi.astro` — siehe 2.
9. `map2d-tile-sprites.astro` — siehe 2.

Das Bild `so-mi-gradient-back-gr.webp` blieb wie in Zug 0 begründet unangetastet.

## Kleine Befunde des Reviewers

- Die Doku nennt die Node-Untergrenze gerundet: `AGENTS.md:28`, `README.md:75`
  und `docs/architecture.md:108` sagen »Node ≥24« bzw. »v24 or newer«, `.nvmrc`
  und `mise.toml` stehen auf `24`. Die `engines` verlangen jetzt 24.16. Nichts
  bricht — `24` löst zur neuesten 24.x auf, und ohne `engine-strict` bleibt es
  bei einer Warnung —, aber `AGENTS.md` verweist ausdrücklich auf die `engines`
  als Quelle und ist damit gröber als sie. Als Folge in den Plan eingetragen.
- Die Commit-Message konnte der Reviewer nur gegen die Konventionen prüfen, nicht
  im Diff sehen: Englisch, ohne Finding-ID, ohne Rückblick, Conventional Commits.
